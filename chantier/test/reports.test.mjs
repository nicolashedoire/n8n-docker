import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createToolServer } from '../server.mjs';
import { estimate } from '../quantities.mjs';

const catalog = JSON.parse(readFileSync(new URL('../catalog.json', import.meta.url)));
const rules = JSON.parse(readFileSync(new URL('../rules.json', import.meta.url)));
const minimal = { project_type: 'bathroom', length_m: 4, width_m: 3 };
// API tests inject bytes rather than a PDF library: rendering and layout are verified separately.
const pdf = Buffer.from('%PDF-1.4\n% isolated report API fixture\n%%EOF\n');
const withoutReport = result => { const { report, ...businessResult } = result; return businessResult; };
const reportPath = result => new URL(result.report.url).pathname;
const reportId = result => reportPath(result).match(/^\/reports\/([a-f0-9]{32})\.pdf$/)?.[1];

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'chantier-report-test-'));
  const reportDir = join(root, 'reports');
  await mkdir(reportDir);
  const instances = [];
  t.after(async () => {
    for (const instance of instances.reverse()) if (instance.server.listening) await instance.close();
    await rm(root, { recursive: true, force: true });
  });
  return {
    root,
    reportDir,
    async start(options = {}) {
      const instance = createToolServer({ catalog, rules, reportDir, renderReport: async () => pdf, ...options });
      instances.push(instance);
      await new Promise(resolve => instance.server.listen(0, '127.0.0.1', resolve));
      const url = `http://127.0.0.1:${instance.server.address().port}`;
      return { ...instance, url, async post(input) {
        const response = await fetch(url + '/tools/estimate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
        });
        return { status: response.status, data: await response.json() };
      } };
    },
  };
}

// http.request keeps raw traversal paths intact, unlike URL-normalizing fetch clients.
async function rawGet(base, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(base);
    const request = http.request({ hostname: url.hostname, port: url.port, path, method: 'GET' }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    request.on('error', reject);
    request.end();
  });
}

test('a bathroom calculation adds a downloadable PDF without changing its deterministic result', async t => {
  const env = await fixture(t);
  const rendered = [];
  const server = await env.start({ renderReport: async data => { rendered.push(structuredClone(data)); return pdf; } });
  const response = await server.post(minimal);
  assert.equal(response.status, 200);
  assert.deepEqual(withoutReport(response.data), estimate(minimal, catalog, rules));
  assert.equal(response.data.report.status, 'ready');
  assert.equal(new URL(response.data.report.url).origin, 'http://localhost:8788');
  assert.match(reportPath(response.data), /^\/reports\/[a-f0-9]{32}\.pdf$/);
  assert.match(response.data.report.filename, /^[^\r\n/\\]+\.pdf$/);
  assert(Number.isFinite(Date.parse(response.data.report.created_at)));
  assert.equal(rendered.length, 1);
  assert.deepEqual(rendered[0].estimate, estimate(minimal, catalog, rules));
  assert.deepEqual(rendered[0].catalog, catalog);
  assert.equal(rendered[0].reportId, reportId(response.data));
  assert.equal(rendered[0].generatedAt, response.data.report.created_at);
  const snapshot = JSON.parse(await readFile(join(env.reportDir, `${reportId(response.data)}.json`), 'utf8'));
  assert.equal(snapshot.schema_version, 1);
  assert.equal(snapshot.report_id, reportId(response.data));
  assert.equal(snapshot.generated_at, response.data.report.created_at);
  assert.deepEqual(snapshot.input, minimal);
  assert.deepEqual(snapshot.estimate, estimate(minimal, catalog, rules));
  assert.deepEqual(snapshot.catalog, catalog);
  const download = await fetch(server.url + reportPath(response.data));
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-type'), /^application\/pdf(?:;|$)/);
  assert.match(download.headers.get('content-disposition'), /^attachment;/);
  assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(download.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), pdf);
});

test('a partial study keeps its unknown total and can export the priced floor alone', async t => {
  const env = await fixture(t);
  const server = await env.start({ reportPublicBaseUrl: 'http://localhost:9876' });
  const input = { ...minimal, height_m: 2.7 };
  const { data } = await server.post(input);
  assert.equal(data.status, 'partial');
  assert.equal(data.total_eur, null);
  assert.equal(data.known_subtotal_eur, 153.01);
  assert.deepEqual(data.unpriced_components.map(component => component.section), ['walls']);
  assert.deepEqual(withoutReport(data), estimate(input, catalog, rules));
  assert.equal(data.report.status, 'ready');
  assert.equal(new URL(data.report.url).origin, 'http://localhost:9876');
});

test('invalid, incomplete and unsupported calculations create no misleading PDF', async t => {
  const env = await fixture(t);
  let calls = 0;
  const server = await env.start({ renderReport: async () => { calls++; return pdf; } });
  for (const input of [
    { ...minimal, width_m: -1 },
    { project_type: 'bathroom', length_m: 4 },
    { project_type: 'load_bearing_wall' },
  ]) {
    const { status, data } = await server.post(input);
    assert.equal(status, 200, 'Business validation keeps the existing HTTP contract');
    assert.deepEqual(withoutReport(data), estimate(input, catalog, rules));
    assert.equal(data.report.status, 'not_available');
    assert.equal(data.report.url, undefined);
  }
  assert.equal(calls, 0);
  assert.deepEqual(await readdir(env.reportDir), []);
});

test('PDF files remain downloadable after the tool server restarts without re-rendering', async t => {
  const env = await fixture(t);
  const first = await env.start();
  const { data } = await first.post(minimal);
  await first.close();
  const second = await env.start({ renderReport: async () => { throw new Error('An existing report must not be regenerated'); } });
  const response = await fetch(second.url + reportPath(data));
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdf);
  assert((await readdir(env.reportDir)).includes(`${reportId(data)}.json`), 'The original calculation snapshot is persisted beside the PDF');
});

test('only opaque PDF paths are public; snapshots, directories and traversal remain inaccessible', async t => {
  const env = await fixture(t);
  await writeFile(join(env.root, 'private.pdf'), 'PRIVATE_CONTENT_CANARY');
  const server = await env.start();
  const { data } = await server.post(minimal);
  const id = reportId(data);
  for (const path of [
    `/reports/${'0'.repeat(32)}.pdf`,
    `/reports/${id}.json`,
    '/reports/',
    '/reports/private.pdf',
    '/reports/../private.pdf',
    '/reports/%2e%2e%2fprivate.pdf',
    `/reports/${id}.pdf/extra`,
    `/reports/${id}.pdf%00`,
  ]) {
    const response = await rawGet(server.url, path);
    assert.equal(response.status, 404, path);
    assert(!response.body.includes('PRIVATE_CONTENT_CANARY'), path);
    assert(!response.body.includes(env.root), 'Filesystem paths must stay private');
  }
});

test('renderer failure preserves the estimate and exposes a generic unavailable report status', async t => {
  const env = await fixture(t);
  const secret = 'RENDER_SECRET_CANARY /private/internal/path';
  const server = await env.start({ renderReport: async () => { throw new Error(secret); } });
  const { status, data } = await server.post(minimal);
  assert.equal(status, 200);
  assert.deepEqual(withoutReport(data), estimate(minimal, catalog, rules));
  assert.equal(data.report.status, 'unavailable');
  assert.equal(data.report.url, undefined);
  assert.equal(typeof data.report.message, 'string');
  assert(!JSON.stringify(data).includes(secret));
  assert(!JSON.stringify(data).includes('/private/internal/path'));
  const health = await fetch(server.url + '/health');
  assert.equal(health.status, 200);
});

test('storage failure cannot destroy a valid calculation or publish a broken download link', async t => {
  const env = await fixture(t);
  const blocked = join(env.root, 'not-a-directory');
  await writeFile(blocked, 'occupied');
  const server = await env.start({ reportDir: blocked });
  const { status, data } = await server.post(minimal);
  assert.equal(status, 200);
  assert.deepEqual(withoutReport(data), estimate(minimal, catalog, rules));
  assert.equal(data.report.status, 'unavailable');
  assert.equal(data.report.url, undefined);
  assert(!JSON.stringify(data).includes(blocked));
});

test('successive estimates receive unique opaque IDs and preserve earlier files', async t => {
  const env = await fixture(t);
  const server = await env.start();
  const first = (await server.post(minimal)).data;
  const firstPdf = await readFile(join(env.reportDir, `${reportId(first)}.pdf`));
  const firstSnapshot = await readFile(join(env.reportDir, `${reportId(first)}.json`));
  const second = (await server.post(minimal)).data;
  assert.notEqual(first.report.url, second.report.url);
  assert.match(reportId(first), /^[a-f0-9]{32}$/);
  assert.match(reportId(second), /^[a-f0-9]{32}$/);
  assert.deepEqual(await readFile(join(env.reportDir, `${reportId(first)}.pdf`)), firstPdf);
  assert.deepEqual(await readFile(join(env.reportDir, `${reportId(first)}.json`)), firstSnapshot);
  const names = await readdir(env.reportDir);
  assert.equal(names.filter(name => name.endsWith('.pdf')).length, 2);
  assert.equal(names.filter(name => name.endsWith('.json')).length, 2);
});


test('timed-out renders retain their work slots until settlement and never publish late PDFs', async t => {
  const env = await fixture(t);
  const releases = [];
  let calls = 0;
  const server = await env.start({ reportTimeoutMs: 20, renderReport: () => {
    calls++;
    return calls > 2 ? Promise.resolve(pdf) : new Promise(resolve => releases.push(resolve));
  } });
  const timedOut = await Promise.all([server.post(minimal), server.post(minimal)]);
  for (const { status, data } of timedOut) {
    assert.equal(status, 200);
    assert.equal(data.report.status, 'unavailable');
    assert.equal(data.report.url, undefined);
    assert.equal(data.total_eur, 1316.41);
  }
  assert.equal((await fetch(server.url + '/health')).status, 200);
  const busy = await server.post(minimal);
  assert.equal(busy.data.report.status, 'unavailable');
  assert.equal(calls, 2, 'A timeout must not allow unbounded background renders');
  releases.forEach(resolve => resolve(pdf));
  await new Promise(setImmediate);
  assert.deepEqual(await readdir(env.reportDir), [], 'Late completion after a timeout must not publish artifacts');
  const recovered = await server.post(minimal);
  assert.equal(recovered.data.report.status, 'ready');
  assert.equal(calls, 3, 'Settled renderers release capacity for the next request');
});

test('oversized render output is rejected before a ready download link is published', async t => {
  const env = await fixture(t);
  const tooLarge = Buffer.alloc(5 * 1024 * 1024 + 1, 32);
  tooLarge.write('%PDF-1.4');
  const server = await env.start({ renderReport: async () => tooLarge });
  const { data } = await server.post(minimal);
  assert.equal(data.report.status, 'unavailable');
  assert.equal(data.report.url, undefined);
  assert.equal(data.total_eur, 1316.41);
  assert.deepEqual(await readdir(env.reportDir), []);
});

test('two concurrent render slots bound work without blocking the tools health endpoint', async t => {
  const env = await fixture(t);
  const releases = [];
  let signalTwoCalls;
  const twoCalls = new Promise(resolve => { signalTwoCalls = resolve; });
  const server = await env.start({ renderReport: () => new Promise(resolve => {
    releases.push(resolve);
    if (releases.length === 2) signalTwoCalls();
  }) });
  const first = server.post(minimal);
  const second = server.post(minimal);
  try {
    await twoCalls;
    assert.equal((await fetch(server.url + '/health')).status, 200);
    const third = await server.post(minimal);
    assert.equal(third.data.report.status, 'unavailable');
    assert.equal(third.data.report.url, undefined);
    assert.equal(third.data.total_eur, 1316.41);
    assert.equal(releases.length, 2, 'An overflowing request must not start a third renderer');
  } finally {
    releases.forEach(resolve => resolve(pdf));
  }
  for (const response of await Promise.all([first, second])) assert.equal(response.data.report.status, 'ready');
});

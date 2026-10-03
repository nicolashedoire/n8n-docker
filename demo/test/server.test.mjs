import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDemoServer } from '../server.mjs';

const payload = { request_id: 'test_001', first_name: 'Camille', last_name: 'Martin', email: 'camille@example.test', message: 'Un devis pour automatiser 50 demandes par semaine, budget 4000 euros, échéance novembre.', scenario: 'normal' };
const analysis = { category: 'devis', summary: 'Automatisation de la qualification commerciale.', missing_information: [], draft_reply: 'Bonjour, merci pour ces précisions. Nous allons étudier votre besoin.' };
async function start(t, options = {}) {
  const app = createDemoServer({ dbPath: ':memory:', publicOrigin: null, ...options });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = async (path, body, headers = {}) => {
    const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  return { ...app, base, post };
}

test('reservation is atomic under concurrent duplicates and detects changed payloads', async t => {
  const { post, base } = await start(t);
  const calls = await Promise.all(Array.from({ length: 20 }, () => post('/requests/reserve', payload)));
  assert.equal(calls.filter(r => r.body.route === 'process').length, 1);
  assert.equal(calls.filter(r => r.body.route === 'duplicate').length, 19);
  assert.ok(calls.every(r => !Object.hasOwn(r.body.record, 'attempt_token')));
  assert.ok(calls.filter(r => r.body.route === 'duplicate').every(r => !Object.hasOwn(r.body, 'attempt_token')));
  const conflict = await post('/requests/reserve', { ...payload, message: 'Autre demande.' });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error.code, 'id_conflict');
  const listing = await (await fetch(base + '/requests')).json();
  assert.equal(listing.records.length, 1);
  assert.equal(listing.records[0].events.filter(e => e.kind === 'reserved').length, 1);
});

test('derived identity is stable after normalization and inputs are bounded', async t => {
  const { post } = await start(t);
  const { request_id: _, ...input } = payload;
  const a = await post('/requests/reserve', { ...input, email: ' CAMILLE@EXAMPLE.TEST ' });
  const b = await post('/requests/reserve', input);
  assert.equal(a.body.request_id, b.body.request_id);
  assert.equal(b.body.route, 'duplicate');
  assert.equal((await post('/requests/reserve', { ...payload, email: 'bad' })).status, 400);
  assert.equal((await post('/requests/reserve', { ...payload, message: 'x'.repeat(10001) })).status, 400);
});

test('lease recovery rejects a stale worker and commits only the new result', async t => {
  let clock = Date.now();
  const { post } = await start(t, { leaseMs: 100, now: () => clock });
  const a = await post('/requests/reserve', payload);
  clock += 101;
  const b = await post('/requests/reserve', payload);
  assert.notEqual(a.body.attempt_token, b.body.attempt_token);
  assert.equal((await post('/requests/test_001/result', { attempt_token: a.body.attempt_token, analysis })).status, 409);
  const committed = await post('/requests/test_001/result', { attempt_token: b.body.attempt_token, analysis });
  assert.equal(committed.body.record.status, 'pending_review');
  assert.equal((await post('/requests/reserve', payload)).body.route, 'duplicate');
});

test('result validates strict schema independently and cannot approve itself', async t => {
  const { post } = await start(t);
  const reserved = await post('/requests/reserve', payload);
  const token = reserved.body.attempt_token;
  for (const invalid of [{ ...analysis, approved: true }, { ...analysis, category: 'approved' }, { ...analysis, missing_information: 'budget' }]) {
    const result = await post('/requests/test_001/result', { attempt_token: token, analysis: invalid });
    assert.equal(result.status, 422);
  }
  const valid = await post('/requests/test_001/result', { attempt_token: token, analysis: { ...analysis, missing_information: ['Budget'] }, status: 'approved', metrics: { model: 'local-test', arbitrary_secret: 'never-store' } });
  assert.equal(valid.body.record.status, 'needs_info');
  assert.deepEqual(valid.body.record.metrics, { model: 'local-test' });
  const duplicate = await post('/requests/test_001/result', { attempt_token: token, analysis: { ...analysis, missing_information: ['Budget'] } });
  assert.equal(duplicate.body.route, 'duplicate');
  assert.equal((await post('/requests/test_001/result', { attempt_token: token, analysis })).status, 409);
});

test('human approval requires matching Origin and CSRF session; records no delivery', async t => {
  const { post, base } = await start(t);
  const reserved = await post('/requests/reserve', payload);
  await post('/requests/test_001/result', { attempt_token: reserved.body.attempt_token, analysis });
  assert.equal((await post('/requests/test_001/approve', {})).status, 403);
  const page = await fetch(base + '/');
  const cookie = page.headers.get('set-cookie').split(';')[0];
  const html = await page.text();
  const csrf = /name="csrf-token" content="([a-f0-9]+)"/.exec(html)[1];
  const headers = { Cookie: cookie, Origin: base, 'X-CSRF-Token': csrf };
  assert.equal((await post('/requests/test_001/approve', {}, { ...headers, Origin: 'https://attacker.invalid' })).status, 403);
  assert.equal((await post('/requests/test_001/approve', {}, { ...headers, 'X-CSRF-Token': 'wrong' })).status, 403);
  const approved = await post('/requests/test_001/approve', {}, headers);
  assert.equal(approved.body.record.status, 'approved');
  assert.deepEqual(approved.body.record.events.at(-1).details, { decision: 'approved', actor: 'local_reviewer', delivery: 'none' });
  assert.equal((await post('/requests/test_001/reject', {}, headers)).status, 409);
});

test('sink failure preserves qualification and technical error is durable', async t => {
  const { post } = await start(t);
  const reserved = await post('/requests/reserve', payload);
  const attempt_token = reserved.body.attempt_token;
  await post('/requests/test_001/result', { attempt_token, analysis });
  const failed = await post('/requests/test_001/sink', { attempt_token, status: 'failed', error: 'Google Sheets indisponible' });
  assert.equal(failed.body.record.status, 'pending_review');
  assert.deepEqual(failed.body.record.analysis, analysis);
  assert.equal(failed.body.record.sink_status, 'failed');
  assert.equal((await post('/requests/test_001/sink', { attempt_token: 'wrong', status: 'synced' })).status, 409);
  const second = await post('/requests/reserve', { ...payload, request_id: 'test_002' });
  const error = await post('/requests/test_002/result', { attempt_token: second.body.attempt_token, error: { code: 'invalid_json', message: 'Réponse du modèle invalide.' } });
  assert.equal(error.body.record.status, 'technical_error');
});

test('injected faults are explicit and do not invoke LLM; real request only forwards message', async t => {
  const forwarded = [];
  const { post } = await start(t, { fetchImpl: async (url, options) => {
    forwarded.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ message: { content: JSON.stringify(analysis) }, prompt_eval_count: 200, eval_count: 50 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } });
  const api = await post('/llm', { message: 'test', scenario: 'api_error' });
  assert.equal(api.status, 503);
  assert.equal(api.body.metrics.injected_fault, 'api_error');
  const invalid = await post('/llm', { message: 'test', scenario: 'invalid_json' });
  assert.equal(invalid.status, 200);
  assert.throws(() => JSON.parse(invalid.body.text));
  assert.equal(forwarded.length, 0);
  const real = await post('/llm', { message: 'test', scenario: 'normal', email: 'never-forward@example.test' });
  assert.equal(real.status, 200);
  assert.equal(real.body.metrics.prompt_tokens, 200);
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0].messages.at(-1).content, 'test');
  assert.equal(JSON.stringify(forwarded[0]).includes('never-forward'), false);
});

test('deduplication survives reopening the SQLite store', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'qualification-demo-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const dbPath = join(folder, 'demo.sqlite');
  let app = createDemoServer({ dbPath });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const response = await fetch(base + '/requests/reserve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  assert.equal((await response.json()).route, 'process');
  await app.close();
  app = createDemoServer({ dbPath });
  assert.equal(app.db.prepare('SELECT COUNT(*) AS count FROM requests').get().count, 1);
  assert.equal(app.db.prepare('SELECT status FROM requests').get().status, 'processing');
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const reopenedBase = `http://127.0.0.1:${app.server.address().port}`;
  const replay = await fetch(reopenedBase + '/requests/reserve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  assert.equal((await replay.json()).route, 'duplicate');
  await app.close();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDemoServer } from '../server.mjs';
import { applyQualificationRules, composeAnalysis } from '../qualification-policy.mjs';

const payload = { request_id: 'test_001', first_name: 'Camille', last_name: 'Martin', email: 'camille@example.test', message: 'Un devis pour automatiser 50 demandes par semaine, budget 4000 euros, échéance novembre.', scenario: 'normal' };
const extraction = { category: 'devis', facts: { need: 'automatiser 50 demandes par semaine', budget: '4000 euros', deadline: 'novembre', availability: '', product: '', problem: '' } };
const analysis = composeAnalysis(applyQualificationRules(extraction));
async function start(t, options = {}) {
  const app = createDemoServer({ dbPath: ':memory:', publicOrigin: null, llmProvider: 'ollama', ...options });
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
  assert.equal((await post('/requests/test_001/result', { attempt_token: a.body.attempt_token, extraction, analysis })).status, 409);
  const committed = await post('/requests/test_001/result', { attempt_token: b.body.attempt_token, extraction, analysis });
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
  const incompleteExtraction = { ...extraction, facts: { ...extraction.facts, budget: '' } };
  const incompleteAnalysis = composeAnalysis(applyQualificationRules(incompleteExtraction));
  const valid = await post('/requests/test_001/result', { attempt_token: token, extraction: incompleteExtraction, analysis: incompleteAnalysis, status: 'approved', metrics: { model: 'local-test', arbitrary_secret: 'never-store' } });
  assert.equal(valid.body.record.status, 'needs_info');
  assert.deepEqual(valid.body.record.metrics, { model: 'local-test', qualification_version: 'facts-v2', draft_method: 'template' });
  const duplicate = await post('/requests/test_001/result', { attempt_token: token, extraction: incompleteExtraction, analysis: incompleteAnalysis });
  assert.equal(duplicate.body.route, 'duplicate');
  assert.equal((await post('/requests/test_001/result', { attempt_token: token, extraction, analysis })).status, 409);
});

test('human approval requires matching Origin and CSRF session; records no delivery', async t => {
  const { post, base } = await start(t);
  const reserved = await post('/requests/reserve', payload);
  await post('/requests/test_001/result', { attempt_token: reserved.body.attempt_token, extraction, analysis });
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
  await post('/requests/test_001/result', { attempt_token, extraction, analysis });
  const failed = await post('/requests/test_001/sink', { attempt_token, status: 'failed', error: 'Google Sheets indisponible' });
  assert.equal(failed.body.record.status, 'pending_review');
  assert.deepEqual(failed.body.record.analysis, analysis);
  assert.equal(failed.body.record.sink_status, 'failed');
  assert.equal((await post('/requests/test_001/sink', { attempt_token: 'wrong', status: 'synced' })).status, 409);
  const second = await post('/requests/reserve', { ...payload, request_id: 'test_002' });
  const error = await post('/requests/test_002/result', { attempt_token: second.body.attempt_token, error: { code: 'invalid_json', message: 'Réponse du modèle invalide.' } });
  assert.equal(error.body.record.status, 'technical_error');
});

test('facts-v2 requires source-grounded extraction and independently recomputes the draft', async t => {
  const { post } = await start(t);
  const reserved = await post('/requests/reserve', payload);
  const attempt_token = reserved.body.attempt_token;
  const extraction = { category: 'devis', facts: { need: 'automatiser 50 demandes par semaine', budget: '4000 euros', deadline: 'novembre', availability: '', product: '', problem: '' } };
  const expected = composeAnalysis(applyQualificationRules(extraction));
  const metrics = { qualification_version: 'facts-v2', draft_method: 'template' };
  const missing = await post('/requests/test_001/result', { attempt_token, analysis: expected, metrics });
  assert.equal(missing.status, 422);
  assert.equal(missing.body.error.code, 'invalid_extraction');
  const bypass = await post('/requests/test_001/result', { attempt_token, analysis: expected });
  assert.equal(bypass.status, 422);
  assert.equal(bypass.body.error.code, 'invalid_extraction');
  const fabricated = await post('/requests/test_001/result', { attempt_token, extraction: { ...extraction, facts: { ...extraction.facts, budget: '9000 euros' } }, analysis: expected, metrics });
  assert.equal(fabricated.status, 422);
  assert.equal(fabricated.body.error.code, 'invalid_extraction');
  const corrupted = await post('/requests/test_001/result', { attempt_token, extraction, analysis: { ...expected, draft_reply: 'Nous souhaitons automatiser notre entreprise.' }, metrics });
  assert.equal(corrupted.status, 422);
  assert.equal(corrupted.body.error.code, 'analysis_mismatch');
  const saved = await post('/requests/test_001/result', { attempt_token, extraction, analysis: expected, metrics });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.record.status, 'pending_review');
  assert.deepEqual(saved.body.record.extraction, extraction);
  assert.deepEqual(saved.body.record.metrics, metrics);
  assert.deepEqual(saved.body.record.events.at(-1).details.extraction, extraction);
});

test('injected faults are explicit and do not invoke LLM; real request only forwards message', async t => {
  const forwarded = [];
  const { post } = await start(t, { fetchImpl: async (url, options) => {
    forwarded.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ message: { content: JSON.stringify({ category: 'autre', facts: { need: '', budget: '', deadline: '', availability: '', product: '', problem: '' } }) }, prompt_eval_count: 200, eval_count: 50 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
  assert.deepEqual(JSON.parse(forwarded[0].messages.at(-1).content), { message_client: 'test' });
  assert.deepEqual(forwarded[0].format.required, ['category', 'facts']);
  assert.equal(real.body.metrics.qualification_version, 'facts-v2');
  assert.equal(JSON.stringify(forwarded[0]).includes('never-forward'), false);
});

test('OpenAI health and HTTP adapter expose provider metadata without the key', async t => {
  const fakeKey = 'sk-test-http-adapter-only';
  let calls = 0;
  const { post, base } = await start(t, { llmProvider: 'openai', llmOptions: { apiKey: fakeKey, env: {} }, fetchImpl: async (url, options) => {
    calls += 1;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, `Bearer ${fakeKey}`);
    return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(extraction) }] }], usage: { input_tokens: 180, output_tokens: 80 } }), { status: 200 });
  } });
  const health = await (await fetch(base + '/health')).json();
  assert.deepEqual(health, { status: 'ok', storage: 'sqlite', provider: 'openai', model: 'gpt-5.6-terra', key_configured: true });
  const result = await post('/llm', { message: payload.message });
  assert.equal(result.status, 200);
  assert.equal(result.body.metrics.provider, 'openai');
  assert.equal(result.body.metrics.completion_tokens, 80);
  assert.equal(calls, 1);
  assert.equal(JSON.stringify({ health, result }).includes(fakeKey), false);
});

test('legacy stored analysis remains readable without extraction after the write contract is strengthened', async t => {
  const { post, db, base } = await start(t);
  await post('/requests/reserve', payload);
  const legacy = { category: 'autre', summary: 'Ancien résumé enregistré.', missing_information: [], draft_reply: 'Ancien brouillon à relire.' };
  db.prepare('UPDATE requests SET status=?,analysis=?,metrics=? WHERE id=?').run('pending_review', JSON.stringify(legacy), '{}', payload.request_id);
  const response = await (await fetch(base + '/requests/' + payload.request_id)).json();
  assert.deepEqual(response.record.analysis, legacy);
  assert.equal(response.record.extraction, null);
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

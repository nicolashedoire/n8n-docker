import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLlmProvider } from '../llm-provider.mjs';

const fakeKey = 'sk-test-not-a-real-key';
const facts = { category: 'autre', facts: { need: '', budget: '', deadline: '', availability: '', product: '', problem: '' } };
const prompt = { messages: [{ role: 'system', content: 'Extract facts.' }, { role: 'user', content: '{"message_client":"Bonjour"}' }], schema: { type: 'object', properties: {}, additionalProperties: false } };
const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const openai = options => createLlmProvider({ env: {}, provider: 'openai', apiKey: fakeKey, defaultKeyFile: null, ...options });

test('Responses uses strict JSON schema, no storage, low reasoning and reads text after reasoning items', async () => {
  const calls = [];
  const text = JSON.stringify(facts);
  const adapter = openai({ fetchImpl: async (url, options) => {
    calls.push({ url, ...options, body: JSON.parse(options.body) });
    return jsonResponse({ status: 'completed', output: [
      { type: 'reasoning', summary: [] },
      { type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: text.slice(0, 35) }, { type: 'output_text', text: text.slice(35) }] },
    ], usage: { input_tokens: 450, output_tokens: 110 } });
  } });
  const result = await adapter.generate(prompt);
  assert.deepEqual(JSON.parse(result.text), facts);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.openai.com/v1/responses');
  assert.equal(calls[0].headers.Authorization, `Bearer ${fakeKey}`);
  assert.equal(calls[0].redirect, 'error');
  assert.equal(calls[0].body.model, 'gpt-5.6-terra');
  assert.equal(calls[0].body.store, false);
  assert.deepEqual(calls[0].body.reasoning, { effort: 'low' });
  assert.equal(calls[0].body.max_output_tokens, 2000);
  assert.deepEqual(calls[0].body.text.format, { type: 'json_schema', name: 'qualification_facts', strict: true, schema: prompt.schema });
  assert.equal(Object.hasOwn(calls[0].body, 'tools'), false);
  assert.equal(result.metrics.provider, 'openai');
  assert.equal(result.metrics.prompt_tokens, 450);
  assert.equal(result.metrics.completion_tokens, 110);
  assert.equal(result.metrics.qualification_version, 'facts-v2');
  assert.equal(JSON.stringify(result).includes(fakeKey), false);
});

test('refusal text is not interpreted as extraction or exposed in the provider error', async () => {
  const adapter = openai({ fetchImpl: async () => jsonResponse({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Raw provider detail with a sensitive prompt fragment.' }] }] }) });
  await assert.rejects(adapter.generate(prompt), error => error.code === 'llm_refused' && error.status === 422 && !error.message.includes('sensitive'));
});

test('incomplete generation is rejected even when its partial text is valid JSON', async () => {
  const adapter = openai({ fetchImpl: async () => jsonResponse({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(facts) }] }] }) });
  await assert.rejects(adapter.generate(prompt), error => error.code === 'llm_incomplete');
});

test('non-JSON output and missing message text fail closed', async () => {
  for (const content of [[{ type: 'output_text', text: 'Here is a reply instead of JSON.' }], []]) {
    const adapter = openai({ fetchImpl: async () => jsonResponse({ status: 'completed', output: [{ type: 'message', content }] }) });
    await assert.rejects(adapter.generate(prompt), error => ['llm_invalid_json', 'llm_envelope_invalid'].includes(error.code));
  }
});

test('401 and 429 return safe actionable errors, without hidden retry or fallback', async () => {
  for (const [status, code, expectedHttp] of [[401, 'openai_auth_error', 502], [429, 'openai_rate_limited', 503]]) {
    let calls = 0;
    const adapter = openai({ fetchImpl: async () => { calls += 1; return jsonResponse({ error: { message: `provider may echo ${fakeKey} or private-input` } }, status); } });
    await assert.rejects(adapter.generate(prompt), error => error.code === code && error.status === expectedHttp && !JSON.stringify(error).includes(fakeKey) && !error.message.includes('private-input'));
    assert.equal(calls, 1);
  }
});

test('configured secret file takes precedence over environment and is never exposed in metadata', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'qualification-key-test-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const file = join(folder, 'fixture-key');
  writeFileSync(file, 'test-file-key\n', { mode: 0o600 });
  let authorization;
  const adapter = createLlmProvider({ provider: 'openai', env: { OPENAI_API_KEY_FILE: file, OPENAI_API_KEY: 'test-env-key' }, defaultKeyFile: null, fetchImpl: async (_url, options) => {
    authorization = options.headers.Authorization;
    return jsonResponse({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(facts) }] }] });
  } });
  assert.deepEqual(adapter.metadata(), { provider: 'openai', model: 'gpt-5.6-terra', key_configured: true });
  await adapter.generate(prompt);
  assert.equal(authorization, 'Bearer test-file-key');
  const broken = createLlmProvider({ provider: 'openai', env: { OPENAI_API_KEY_FILE: join(folder, 'missing'), OPENAI_API_KEY: 'test-env-key' }, defaultKeyFile: null });
  assert.equal(broken.metadata().key_configured, false);
  await assert.rejects(broken.generate(prompt), error => error.code === 'openai_key_unreadable' && !error.message.includes(folder));
});

test('missing key makes no network request and a configured key does not silently select OpenAI', async () => {
  let calls = 0;
  const adapter = openai({ apiKey: '', fetchImpl: async () => { calls += 1; throw new Error('Must not run.'); } });
  assert.equal(adapter.metadata().key_configured, false);
  await assert.rejects(adapter.generate(prompt), error => error.code === 'openai_key_missing');
  assert.equal(calls, 0);
  assert.equal(createLlmProvider({ env: { OPENAI_API_KEY: fakeKey }, defaultKeyFile: null }).metadata().provider, 'ollama');
});

test('timeout is bounded and transport exception contents are redacted', async () => {
  const timeout = openai({ fetchImpl: async () => { throw new DOMException('sensitive prompt fragment', 'TimeoutError'); } });
  await assert.rejects(timeout.generate(prompt), error => error.code === 'llm_timeout' && !error.message.includes('sensitive'));
  const unavailable = openai({ fetchImpl: async () => { throw new Error(`Network error with ${fakeKey}`); } });
  await assert.rejects(unavailable.generate(prompt), error => error.code === 'llm_unavailable' && !JSON.stringify(error).includes(fakeKey));
});

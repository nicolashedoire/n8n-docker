import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../incident-response.js', import.meta.url), 'utf8');
const handle = new Function('$input', '$execution', source);
const run = error => handle({ first: () => ({ json: { error } }) }, { id: 'test-123' })[0].json;

test('incident response discloses no raw provider error or invented price', () => {
  const result = run({ message: '503 Provider failed with authorization sk-test-secret and private prompt 750 euros', stack: 'private/stack' });
  assert.equal(result.status, 'technical_error');
  assert.equal(result.no_order_placed, true);
  assert.equal(result.incident.reference, 'chantier-test-123');
  assert.doesNotMatch(JSON.stringify(result), /sk-test-secret|private|750|Provider/);
  assert.match(result.output, /pas pu terminer/);
});

test('permanent credential and quota incidents do not invite blind retries', () => {
  for (const message of ['401 Incorrect API key provided: sk-test-secret', '429 insufficient_quota',
    'Insufficient quota detected. <a href="https://docs.n8n.io/">Learn more</a>',
    'Authorization failed - please check your credentials']) {
    const result = run(message);
    assert.equal(result.incident.retryable, false);
    assert.doesNotMatch(result.output, /Réessayez/);
  }
});

test('transient and malformed responses have safe, actionable messages', () => {
  for (const [message, expected] of [['Request timed out.', 'TIMEOUT'], ['429 too many requests', 'RATE_LIMITED'], ['Unexpected token in JSON', 'INVALID_RESPONSE']]) {
    const result = run(message);
    assert.equal(result.incident.code, expected);
    assert.equal(result.incident.retryable, true);
    assert.match(result.output, /estimation/);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createToolServer, refreshProduct } from '../server.mjs';

const catalog = JSON.parse(readFileSync(new URL('../catalog.json', import.meta.url)));
const rules = JSON.parse(readFileSync(new URL('../rules.json', import.meta.url)));
const product = catalog.products.find(item => item.id === 'tile_arcano_95985488');
const CANARY = 'TEST-ONLY-PRIVATE-DIAGNOSTIC-DO-NOT-EXPOSE';
const pricePage = amount => `<script type="application/ld+json">${JSON.stringify({
  '@type': 'Product', url: product.source_url,
  offers: { '@type': 'Offer', price: amount, priceCurrency: 'EUR',
    priceSpecification: { referenceQuantity: { value: 1, unitText: 'carton' } } },
})}</script>`;

async function app(t, options = {}) {
  const instance = createToolServer({ catalog, rules, ...options });
  await new Promise(resolve => instance.server.listen(0, '127.0.0.1', resolve));
  t.after(() => instance.close());
  const origin = `http://127.0.0.1:${instance.server.address().port}`;
  return { origin, post: async (path, body) => {
    const response = await fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  } };
}

test('supplier 429 and 500 preserve the dated estimate and discard upstream error bodies', async t => {
  for (const status of [429, 500]) {
    let calls = 0, cancelled = false;
    const server = await app(t, { fetchImpl: async () => {
      calls++;
      return new Response(new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode(CANARY)); },
        cancel() { cancelled = true; },
      }), { status, headers: { 'Content-Type': 'text/html', 'Retry-After': '60' } });
    } });
    const details = await server.post('/tools/product', { product_id: product.id, refresh: true });
    assert.equal(details.status, 200, 'Refresh failure is an explicit business fallback, not a loss of the product snapshot');
    assert.equal(details.data.refresh.status, 'http_error');
    assert.equal(details.data.refresh.http_status, status);
    assert.equal(details.data.price_status, 'snapshot');
    assert.equal(details.data.catalog_snapshot_date, catalog.snapshot_date);
    assert.deepEqual(details.data.product.price, product.price);
    assert.equal(details.data.live_price, undefined);
    assert.equal(calls, 1, 'Supplier refresh falls back immediately rather than amplifying a rate limit');
    assert.equal(cancelled, true);
    assert(!JSON.stringify(details.data).includes(CANARY));
    const estimate = await server.post('/tools/estimate', { project_type: 'bathroom', length_m: 4, width_m: 3 });
    assert.equal(estimate.data.status, 'ok');
    assert.equal(estimate.data.total_eur, 1316.41);
    assert.equal(calls, 1, 'Calculations remain independent of supplier availability');
  }
});

test('network exception details and stack traces never escape in an HTTP tool result', async t => {
  const server = await app(t, { fetchImpl: async () => {
    const error = new Error(`TLS diagnostic ${CANARY}`);
    error.stack = `private-stack ${CANARY}`;
    throw error;
  } });
  const response = await server.post('/tools/product', { product_id: product.id, refresh: true });
  assert.equal(response.status, 200);
  assert.equal(response.data.refresh.status, 'fetch_failed');
  assert.equal(response.data.price_status, 'snapshot');
  assert.equal(response.data.live_price, undefined);
  assert.deepEqual(response.data.product.price, product.price);
  assert(!JSON.stringify(response.data).includes(CANARY));
  assert.equal(response.data.refresh.error, undefined);
  assert.equal(response.data.refresh.stack, undefined);
});

test('a broken response stream cannot promote its partial page into a live price', async () => {
  const result = await refreshProduct(product, { fetchImpl: async () => {
    let sent = false;
    return new Response(new ReadableStream({ pull(controller) {
      if (!sent) { sent = true; controller.enqueue(new TextEncoder().encode(pricePage('99.99'))); }
      else controller.error(new Error(`connection reset ${CANARY}`));
    } }), { headers: { 'Content-Type': 'text/html' } });
  } });
  assert.equal(result.refresh.status, 'fetch_failed');
  assert.equal(result.price_status, 'snapshot');
  assert.equal(result.live_price, undefined);
  assert(!JSON.stringify(result).includes(CANARY));
});

test('the refresh deadline still aborts a stalled body after response headers arrive', async () => {
  let observedAbort = false;
  const result = await refreshProduct(product, { timeoutMs: 10, fetchImpl: async (_url, options) => {
    return new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('<html>'));
      options.signal.addEventListener('abort', () => {
        observedAbort = true;
        controller.error(new DOMException('body stalled', 'AbortError'));
      }, { once: true });
    } }), { headers: { 'Content-Type': 'text/html' } });
  } });
  assert.equal(observedAbort, true);
  assert.equal(result.refresh.status, 'timeout');
  assert.equal(result.price_status, 'snapshot');
  assert.equal(result.live_price, undefined);
});

test('malformed JSON and non-object JSON are rejected without reflecting the input', async t => {
  const server = await app(t);
  for (const raw of [`{"private":"${CANARY}"`, 'null', '[]', '42', '"text"']) {
    const response = await fetch(server.origin + '/tools/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: raw,
    });
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    const body = await response.json();
    assert.equal(body.error.code, 'invalid_json');
    assert(!JSON.stringify(body).includes(CANARY));
    assert.deepEqual(Object.keys(body.error).sort(), ['code', 'message']);
  }
  const healthy = await (await fetch(server.origin + '/health')).json();
  assert.equal(healthy.status, 'ok', 'Bad requests do not poison the service');
});

test('unexpected internal configuration faults produce a generic 500, then health stays available', async t => {
  // An internally malformed rule simulates an unexpected programmer/configuration
  // error beyond request validation. The API must not return a Node stack trace.
  const server = await app(t, { rules: { ...rules, rules: [null] } });
  const response = await server.post('/tools/rules', { project_type: 'tiling', room_type: 'dry' });
  assert.equal(response.status, 500);
  assert.deepEqual(response.data, { error: { code: 'internal_error', message: 'Erreur interne du service d’outils.' } });
  const health = await fetch(server.origin + '/health');
  assert.equal(health.status, 200);
});

test('a verified changed live price is displayed separately and does not silently change future estimates', async t => {
  let calls = 0;
  const server = await app(t, { fetchImpl: async () => {
    calls++;
    return new Response(pricePage('99.99'), { headers: { 'Content-Type': 'text/html' } });
  } });
  const refreshed = await server.post('/tools/product', { product_id: product.id, refresh: true });
  assert.equal(refreshed.data.price_status, 'live_verified');
  assert.equal(refreshed.data.live_price.amount, 99.99);
  assert.equal(refreshed.data.estimate_price_basis, 'catalog_snapshot');
  assert.equal(refreshed.data.product.price.amount, 11.77);
  const estimate = await server.post('/tools/estimate', { project_type: 'tiling', room_type: 'dry', surface_m2: 12, margin_pct: 10, product_ids: { tile: product.id } });
  assert.equal(estimate.data.total_eur, 153.01);
  const cached = await server.post('/tools/product', { product_id: product.id, refresh: false });
  assert.equal(cached.data.price_status, 'snapshot');
  assert.equal(cached.data.product.price.amount, 11.77);
  assert.equal(calls, 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createToolServer, extractVerifiedPackPrice, refreshProduct } from '../server.mjs';

const catalog = JSON.parse(readFileSync(new URL('../catalog.json', import.meta.url)));
const rules = JSON.parse(readFileSync(new URL('../rules.json', import.meta.url)));
const product = catalog.products[0];
const structuredPage = (overrides = {}) => `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', url: product.source_url,
  offers: { '@type': 'Offer', price: '12.34', priceCurrency: 'EUR', priceSpecification: { referenceQuantity: { value: 1, unitText: 'carton' } }, ...overrides } })}</script>`;

async function app(t, fetchImpl) {
  const instance = createToolServer({ catalog, rules, fetchImpl });
  await new Promise(resolve => instance.server.listen(0, '127.0.0.1', resolve));
  t.after(() => instance.close());
  const url = `http://127.0.0.1:${instance.server.address().port}`;
  return { url, post: async (path, body) => {
    const response = await fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  } };
}

test('HTTP tools expose a dated limited catalogue and a model-free health check', async t => {
  let externalCalls = 0;
  const server = await app(t, async () => { externalCalls++; throw new Error('unexpected'); });
  const health = await (await fetch(server.url + '/health')).json();
  assert.equal(health.model, null); assert.equal(health.catalog_products, 7);
  const search = await server.post('/tools/search', { query: 'carrelage', category: 'tile' });
  assert.equal(search.status, 200);
  assert.equal(search.data.search_scope, 'curated_catalog_only');
  assert.equal(search.data.products.length, 2);
  assert(search.data.products.every(p => p.source_url.startsWith('https://') && p.price.unit === 'pack'));
  const details = await server.post('/tools/product', { product_id: product.id });
  assert.equal(details.data.price_status, 'snapshot');
  assert.equal(details.data.refresh.status, 'not_requested');
  assert.equal(externalCalls, 0);
});

test('HTTP rules and estimator share the actual catalogue contract', async t => {
  const server = await app(t);
  const policy = await server.post('/tools/rules', { project_type: 'tiling', room_type: 'dry' });
  assert.equal(policy.data.status, 'allowed');
  const result = await server.post('/tools/estimate', { project_type: 'tiling', room_type: 'dry', surface_m2: 20, margin_pct: 10, product_ids: { tile: product.id } });
  assert.equal(result.data.status, 'ok');
  assert.equal(result.data.lines[0].packs, 21);
});

test('tool inputs reject URLs, unknown products, invalid types and oversized requests', async t => {
  const server = await app(t);
  assert.equal((await server.post('/tools/product', { product_id: product.id, url: 'http://localhost/private' })).status, 422);
  assert.equal((await server.post('/tools/product', { product_id: 'absent' })).status, 404);
  assert.equal((await server.post('/tools/product', { product_id: product.id, refresh: 'true' })).status, 422);
  assert.equal((await server.post('/tools/search', { query: 'x'.repeat(70_000) })).status, 413);
  const notJson = await fetch(server.url + '/tools/search', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
  assert.equal(notJson.status, 415);
});

test('price refresh follows only the exact catalogue URL, rejects redirects, and keeps snapshot intact', async () => {
  const snapshot = structuredClone(product);
  let calls = 0;
  const result = await refreshProduct(product, { fetchImpl: async (url, options) => {
    calls++; assert.equal(url, product.source_url); assert.equal(options.redirect, 'error');
    return new Response(structuredPage(), { headers: { 'Content-Type': 'text/html' } });
  }, now: () => new Date('2026-10-04T12:00:00Z') });
  assert.equal(calls, 1); assert.equal(result.price_status, 'live_verified');
  assert.equal(result.live_price.amount, 12.34); assert.equal(result.live_price.unit, 'pack');
  assert.deepEqual(product, snapshot); assert.deepEqual(result.product.price, snapshot.price);
  const redirect = await refreshProduct(product, { fetchImpl: async () => ({ ok: true, redirected: true, url: 'https://other.example/' }) });
  assert.equal(redirect.refresh.status, 'redirect_rejected');
});

test('bare €/m², multiple offers and malformed structured data never become live pack prices', () => {
  assert.equal(extractVerifiedPackPrice(structuredPage({ priceSpecification: undefined }), product).status, 'unverified_price_unit');
  assert.equal(extractVerifiedPackPrice(structuredPage({ priceCurrency: 'USD' }), product).status, 'unverified_price');
  assert.equal(extractVerifiedPackPrice('<script type="application/ld+json">{broken}</script>', product).status, 'unverified_product_identity');
  assert.equal(extractVerifiedPackPrice(structuredPage() + structuredPage(), product).status, 'unverified_product_identity');
});

test('verified supplier SKU can identify a product when JSON-LD omits its URL', () => {
  const html = structuredPage().replace(`"url":${JSON.stringify(product.source_url)}`, `"sku":${JSON.stringify(product.retailer_reference)}`);
  assert.equal(extractVerifiedPackPrice(html, product).status, 'live_verified');
  assert.equal(extractVerifiedPackPrice(html.replace(String(product.retailer_reference), 'wrong-reference'), product).status, 'unverified_product_identity');
});

test('untrusted source URLs and non-HTML content are not parsed for prices', async () => {
  let calls = 0;
  const bad = await refreshProduct({ ...product, source_url: 'https://127.0.0.1/private' }, { fetchImpl: async () => { calls++; } });
  assert.equal(bad.refresh.status, 'source_not_allowlisted'); assert.equal(calls, 0);
  const json = await refreshProduct(product, { fetchImpl: async () => new Response('{}', { headers: { 'Content-Type': 'application/json' } }) });
  assert.equal(json.refresh.status, 'unsupported_content_type');
});

test('refresh page size is bounded even without Content-Length', async () => {
  const oversized = await refreshProduct(product, { maxBytes: 20,
    fetchImpl: async () => new Response('x'.repeat(30), { headers: { 'Content-Type': 'text/html' } }) });
  assert.equal(oversized.refresh.status, 'page_too_large');
  assert.equal(oversized.price_status, 'snapshot');
});

test('refresh timeout returns a visible snapshot fallback, never a made-up live price', async () => {
  const result = await refreshProduct(product, { timeoutMs: 10, fetchImpl: async (_url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  }) });
  assert.equal(result.refresh.status, 'timeout'); assert.equal(result.price_status, 'snapshot');
  assert.equal(result.live_price, undefined); assert.deepEqual(result.product.price, product.price);
});

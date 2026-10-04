import http from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { estimate, selectRules } from './quantities.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MAX_BODY = 65_536;
const MAX_PRODUCT_PAGE = 2 * 1024 * 1024;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const normalize = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const clone = value => JSON.parse(JSON.stringify(value));
class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new HttpError(status, code, message); };

function fields(input, allowed) {
  if (!object(input)) fail(400, 'invalid_input', 'Objet JSON requis.');
  const extra = Object.keys(input).filter(key => !allowed.includes(key));
  if (extra.length) fail(422, 'unknown_fields', `Champs non acceptés : ${extra.join(', ')}.`);
}
function text(value, field, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(422, 'invalid_input', `${field} : texte requis, maximum ${max} caractères.`);
  return value.trim();
}
function exactSourceUrl(product) {
  try {
    const url = new URL(product.source_url);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
    // Catalogue entries are the complete URL allowlist; callers cannot supply URLs.
    if (!['www.leroymerlin.fr', 'leroymerlin.fr'].includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}
function validateCatalog(catalog) {
  if (!object(catalog) || !Array.isArray(catalog.products) || !/^\d{4}-\d{2}-\d{2}$/.test(catalog.snapshot_date ?? '')) throw new Error('Catalogue daté requis.');
  const ids = new Set();
  for (const product of catalog.products) {
    if (!object(product) || typeof product.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(product.id) || ids.has(product.id)) throw new Error('Identifiants du catalogue invalides ou dupliqués.');
    if (typeof product.name !== 'string' || !['tile', 'board', 'rail', 'stud', 'insulation'].includes(product.category)) throw new Error('Produit de catalogue invalide.');
    ids.add(product.id);
  }
}

/** Accept only one unambiguous Product/Offer with an explicitly stated per-pack basis. */
export function extractVerifiedPackPrice(html, product) {
  const products = [];
  const visit = value => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!object(value)) return;
    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
    if (types.includes('Product')) products.push(value);
    if (value['@graph']) visit(value['@graph']);
  };
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    try { visit(JSON.parse(match[1])); } catch { /* Unparseable structured data is never guessed. */ }
  }
  const stripFragment = value => { try { const url = new URL(value); url.hash = ''; return url.href; } catch { return null; } };
  const source = stripFragment(product.source_url);
  const supplierSku = product.retailer_reference ?? product.metadata?.supplier_sku;
  const candidates = products.filter(item => stripFragment(item.url ?? item['@id']) === source
    || (supplierSku && String(item.sku) === String(supplierSku)));
  if (candidates.length !== 1) return { status: 'unverified_product_identity' };
  const offers = Array.isArray(candidates[0].offers) ? candidates[0].offers : [candidates[0].offers];
  if (offers.length !== 1 || !object(offers[0]) || offers[0]['@type'] !== 'Offer') return { status: 'ambiguous_offer' };
  const offer = offers[0];
  const amount = typeof offer.price === 'number' ? offer.price : typeof offer.price === 'string' && /^\d+(?:\.\d{1,2})?$/.test(offer.price) ? Number(offer.price) : NaN;
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6 || offer.priceCurrency !== 'EUR') return { status: 'unverified_price' };
  const basis = offer.priceSpecification?.referenceQuantity;
  // A bare JSON-LD price could be €/m² or €/piece. Do not silently treat it as €/pack.
  if (!basis || basis.value !== 1 || !['pack', 'paquet', 'carton', 'lot'].includes(normalize(String(basis.unitText ?? '')))) return { status: 'unverified_price_unit' };
  return { status: 'live_verified', amount, currency: 'EUR', unit: 'pack' };
}

export async function refreshProduct(product, { fetchImpl = fetch, now = () => new Date(), timeoutMs = 8000, maxBytes = MAX_PRODUCT_PAGE } = {}) {
  const result = { product: clone(product), price_status: 'snapshot', refresh: { status: 'not_attempted' } };
  const source = exactSourceUrl(product);
  if (!source) { result.refresh.status = 'source_not_allowlisted'; return result; }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(8000, Math.max(1, timeoutMs)));
  const discard = async response => { try { await response.body?.cancel(); } catch { /* Preserve the explicit fallback reason. */ } };
  try {
    const response = await fetchImpl(source, { method: 'GET', redirect: 'error', signal: controller.signal,
      headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Atelier-n8n-catalog-demo/1.0' } });
    if (response.redirected || (response.url && response.url !== source)) { await discard(response); result.refresh.status = 'redirect_rejected'; return result; }
    if (!response.ok) { await discard(response); result.refresh.status = 'http_error'; result.refresh.http_status = response.status; return result; }
    if (!/^text\/html\b|^application\/xhtml\+xml\b/i.test(response.headers.get('content-type') ?? '')) { await discard(response); result.refresh.status = 'unsupported_content_type'; return result; }
    const length = Number(response.headers.get('content-length'));
    const limit = Math.min(MAX_PRODUCT_PAGE, Math.max(1, maxBytes));
    if (Number.isFinite(length) && length > limit) { await discard(response); result.refresh.status = 'page_too_large'; return result; }
    if (!response.body) { result.refresh.status = 'empty_page'; return result; }
    const reader = response.body.getReader();
    const chunks = []; let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) { await reader.cancel(); result.refresh.status = 'page_too_large'; return result; }
      chunks.push(Buffer.from(value));
    }
    const extracted = extractVerifiedPackPrice(Buffer.concat(chunks).toString('utf8'), product);
    result.refresh = { status: extracted.status, source_url: source, checked_at: now().toISOString() };
    if (extracted.status === 'live_verified') {
      result.price_status = 'live_verified';
      result.live_price = { amount: extracted.amount, currency: 'EUR', unit: 'pack', observed_at: now().toISOString(), source_url: source };
    }
    return result;
  } catch (error) {
    result.refresh = { status: controller.signal.aborted || ['AbortError', 'TimeoutError'].includes(error.name) ? 'timeout' : 'fetch_failed', source_url: source };
    return result;
  } finally { clearTimeout(timer); }
}

async function body(req) {
  if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) fail(415, 'json_required', 'Content-Type application/json requis.');
  const chunks = []; let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > MAX_BODY) fail(413, 'body_too_large', 'Corps limité à 64 Kio.');
    chunks.push(chunk);
  }
  try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!object(value)) throw new Error(); return value; }
  catch { fail(400, 'invalid_json', 'Objet JSON valide requis.'); }
}

export function createToolServer(options = {}) {
  const catalog = clone(options.catalog ?? JSON.parse(readFileSync(resolve(HERE, 'catalog.json'), 'utf8')));
  const rules = clone(options.rules ?? JSON.parse(readFileSync(resolve(HERE, 'rules.json'), 'utf8')));
  validateCatalog(catalog);
  if (!Array.isArray(rules.rules)) throw new Error('Règles structurées requises.');
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    try {
      const url = new URL(req.url, 'http://local.invalid');
      if (req.method === 'GET' && url.pathname === '/health') return send(200, { status: 'ok', service: 'chantier-tools', catalog_products: catalog.products.length,
        catalog_snapshot_date: catalog.snapshot_date, model: null, price_mode: 'catalog_snapshot', no_order_placed: true });
      if (req.method !== 'POST' || !['/tools/rules', '/tools/search', '/tools/product', '/tools/estimate'].includes(url.pathname)) return send(404, { error: { code: 'not_found', message: 'Outil inconnu.' } });
      const input = await body(req);
      if (url.pathname === '/tools/rules') return send(200, selectRules(input, rules));
      if (url.pathname === '/tools/search') {
        fields(input, ['query', 'category']);
        const query = text(input.query, 'query', 150);
        const category = input.category;
        if (category !== undefined && !['tile', 'board', 'rail', 'stud', 'insulation'].includes(category)) fail(422, 'invalid_category', 'Catégorie inconnue.');
        const tokens = normalize(query).split(/[^a-z0-9]+/).filter(Boolean);
        const scored = catalog.products.filter(product => !category || product.category === category).map(product => {
          const haystack = normalize([product.id, product.name, product.category, ...(product.tags ?? [])].join(' '));
          return { product, score: tokens.reduce((sum, token) => sum + Number(haystack.includes(token)), 0) };
        }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id));
        return send(200, { status: 'ok', search_scope: 'curated_catalog_only', search_method: 'lexical_any_token_ranked',
          message: 'Recherche lexicale dans cette sélection datée, pas dans tout le site fournisseur ni sur le Web.',
          catalog_snapshot_date: catalog.snapshot_date, query, total_matches: scored.length,
          products: scored.slice(0, 10).map(({ product }) => product) });
      }
      if (url.pathname === '/tools/product') {
        fields(input, ['product_id', 'refresh']);
        const id = text(input.product_id, 'product_id', 100);
        if (input.refresh !== undefined && typeof input.refresh !== 'boolean') fail(422, 'invalid_input', 'refresh doit être un booléen.');
        const product = catalog.products.find(item => item.id === id);
        if (!product) fail(404, 'unknown_product', 'Référence absente du catalogue ; rechercher son identifiant exact.');
        const result = input.refresh ? await refreshProduct(product, { fetchImpl: options.fetchImpl, now: options.now, timeoutMs: options.refreshTimeoutMs })
          : { product, price_status: 'snapshot', refresh: { status: 'not_requested' } };
        return send(200, { status: 'ok', ...result, catalog_snapshot_date: catalog.snapshot_date,
          estimate_price_basis: 'catalog_snapshot',
          note: 'La consultation en ligne ne modifie pas le catalogue. Le calcul déterministe utilise toujours les prix du relevé daté ; un éventuel prix live est affiché séparément.' });
      }
      return send(200, estimate(input, catalog, rules));
    } catch (error) {
      if (res.headersSent) return res.end();
      send(error instanceof HttpError ? error.status : 500, { error: {
        code: error instanceof HttpError ? error.code : 'internal_error', message: error instanceof HttpError ? error.message : 'Erreur interne du service d’outils.' } });
    }
  });
  return { server, close: () => new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose())) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const app = createToolServer();
  const port = Number(process.env.PORT ?? 3000);
  app.server.listen(port, process.env.HOST ?? '0.0.0.0', () => console.log(JSON.stringify({ event: 'ready', service: 'chantier-tools', port })));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => app.close().then(() => process.exit(0)));
}

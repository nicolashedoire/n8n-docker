#!/usr/bin/env node
/** Real n8n agent checks for a room described with two dimensions.
 * Default is --dry-run; --run sends three chat messages in one session.
 * Each message can trigger several billable model calls and tool calls.
 * Synthetic prompts, responses and traces stay in ignored work/chantier-validation.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { readExecutions, TOOL_NAMES } from './extract-execution.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webhook = process.env.CHANTIER_CHAT_URL ?? 'http://localhost:5678/webhook/atelier-agent-chantier/chat';
const url = new URL(webhook);
assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.protocol === 'http:' && !url.username && !url.password && !url.search, 'Only an unauthenticated local chat URL is accepted.');
const prefix = `check-chantier-room-${new Date().toISOString().replace(/\D/g, '').slice(0, 17)}-${randomBytes(3).toString('hex')}`;
const scenarios = [
  { id: 'minimal_room', message: 'Je refais ma salle de bains de 4 m sur 3 m.' },
  { id: 'shower_followup', message: 'Il y aura une douche avec un receveur. Garde les dimensions.' },
  { id: 'height_followup', message: 'En fait, la hauteur sous plafond est de 2,70 m.' },
].map(item => ({ ...item, session: prefix }));

function persist(directory, name, value) {
  writeFileSync(resolve(directory, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}
function calls(trace, kind) { return trace.steps.filter(step => step.tool === TOOL_NAMES[kind]); }
function calculation(step) { return step.input?.calculation ?? step.input; }
function near(actual, expected, message) {
  assert(typeof actual === 'number' && Math.abs(actual - expected) < 1e-6, message);
}
function sourceProduct(catalog, id) {
  const product = catalog.products.find(item => item.id === id);
  assert(product, `Selected product must exist in the source catalogue: ${id}.`);
  return product;
}
function assertComponentPrices(component, catalog) {
  assert(Array.isArray(component.lines) && component.lines.length, 'A priced component needs purchase lines.');
  let cents = 0;
  for (const line of component.lines) {
    const product = sourceProduct(catalog, line.product_id);
    assert(Number.isInteger(line.packs) && line.packs > 0, 'Purchase packs must be positive integers.');
    near(line.price_per_pack?.amount, product.price.amount, 'Pack price must match the dated catalogue.');
    near(line.total_eur, Math.round(product.price.amount * 100) * line.packs / 100, 'Line subtotal must equal integer packs times pack price.');
    assert.equal(line.price_per_pack.source_url, product.source_url, 'Every price retains its source.');
    cents += Math.round(line.total_eur * 100);
  }
  near(component.total_eur, cents / 100, 'Component total equals its line subtotals.');
  return cents;
}
function assertGeography(result, height) {
  const m = result.measurements;
  assert(m && typeof m === 'object', 'The room estimator must return measured quantities.');
  near(m.floor_area_m2, 12, 'The floor remains 4 x 3 = 12 m².');
  near(m.perimeter_m, 14, 'The rectangular room has a 14 m perimeter.');
  near(m.height_m, height, 'The current height is preserved in the calculation.');
  near(m.gross_wall_area_m2, 14 * height, 'Gross wall area must follow the current height.');
  near(m.net_wall_area_m2, 14 * height, 'Unknown openings must not be invented or deducted.');
  assert.deepEqual([...m.wall_lengths_m].sort((a, b) => a - b), [3, 3, 4, 4], 'All four room walls must be represented once.');
}
function assertAssumptions(result, scenario) {
  assert.equal(result.preliminary, true, 'A room estimate from limited input is preliminary.');
  assert(Array.isArray(result.assumption_origins), 'Default and provided values must remain distinguishable.');
  const fields = new Map(result.assumption_origins.map(item => [item.field, item]));
  for (const field of ['length_m', 'width_m']) assert.equal(fields.get(field)?.origin, 'provided', `${field} must retain its supplied origin.`);
  if (scenario.id !== 'height_followup') {
    assert.equal(fields.get('height_m')?.origin, 'default', 'The default height must not be presented as supplied by the user.');
    near(fields.get('height_m')?.value, 2.5, 'The documented default height is 2.50 m.');
  }
  assert.equal(fields.get('margin_pct')?.origin, 'default', 'The default margin must not be presented as supplied.');
  near(fields.get('margin_pct')?.value, 10, 'The documented default margin is 10%.');
  if (scenario.id === 'height_followup') {
    assert.equal(fields.get('height_m')?.origin, 'provided', 'The corrected height must come from the latest message.');
    near(fields.get('height_m')?.value, 2.7, 'The corrected height must be 2.70 m.');
  }
}
function assess(scenario, trace, response, catalog, previous) {
  assert.equal(response.status, 200, 'The local published chat must return HTTP 200.');
  assert.equal(trace.status, 'success', 'The n8n execution must finish successfully.');
  assert(trace.intermediate_steps_present, 'Saved agent intermediate steps are required as evidence.');
  assert(typeof trace.output === 'string' && trace.output.trim(), 'The agent must produce a human answer.');
  const estimates = calls(trace, 'estimate').filter(step => calculation(step)?.project_type === 'bathroom');
  const step = estimates.filter(item => ['ok', 'partial'].includes(item.observation?.status)).at(-1);
  assert(step, 'The turn must reach a useful room estimate instead of only asking technical questions.');
  const input = calculation(step), result = step.observation;
  near(input.length_m, 4, 'The 4 m length must be retained.');
  near(input.width_m, 3, 'The 3 m width must be retained.');
  assert.equal(input.margin_pct, undefined, 'Unconfirmed margin must be left to the explicit calculator default.');
  if (scenario.id !== 'height_followup') assert.equal(input.height_m, undefined, 'Unconfirmed height must remain a calculator default across turns.');
  const height = scenario.id === 'height_followup' ? 2.7 : 2.5;
  assertGeography(result, height);
  assertAssumptions(result, scenario);
  assert.equal(result.no_order_placed, true, 'No order must be placed.');
  assert.equal(result.no_payment, true, 'No payment must be made.');
  const floor = result.components?.floor, walls = result.components?.walls;
  assert.equal(floor?.status, 'ok', 'The floor component must stay calculable.');
  const floorCents = assertComponentPrices(floor, catalog);
  near(floor.measurements?.surface_with_margin_m2, 13.2, 'The floor includes 10% margin.');
  if (scenario.id === 'minimal_room') {
    assert(calls(trace, 'rules').some(item => item.index < step.index), 'Rules must precede the initial calculation.');
    assert(calls(trace, 'search').some(item => item.index < step.index), 'A catalogue search must precede the initial calculation.');
    assert(/hypoth[eè]se|provisoire|pr[eé]liminaire|par d[eé]faut/i.test(trace.output), 'The answer must identify assumptions or provisional status.');
    assert(/2[,.]5\s*0?\s*m|2[,.]50/i.test(trace.output), 'The assumed height must be visible to the user.');
  }
  if (scenario.id === 'height_followup') {
    assert.equal(result.status, 'partial', 'An unsupported wall height must yield a partial room result.');
    assert(['unsupported', 'needs_information'].includes(walls?.status), 'The existing wall materials must not be approved at 2.70 m.');
    assert(!walls.lines?.length, 'No unverified wall purchase lines may survive the unsupported height.');
    assert.equal(result.total_eur, null, 'Unknown wall costs must not silently become zero.');
    near(result.known_subtotal_eur, floorCents / 100, 'The known subtotal must contain only priced components.');
    near(previous.floor_total_eur, floor.total_eur, 'Changing the height must not change floor cost.');
    assert(/2[,.]7\s*0?\s*m|2[,.]70/i.test(trace.output), 'The updated height must be visible in the answer.');
    assert(/37[,.]8\s*0?/.test(trace.output), 'The changed wall area must be visible in the answer.');
  } else {
    assert.equal(walls?.status, 'ok', 'The documented preliminary wall scenario must produce a component estimate.');
    const wallCents = assertComponentPrices(walls, catalog);
    near(result.total_eur, (floorCents + wallCents) / 100, 'Room material total must equal the priced floor and wall components.');
    const boardLines = walls.lines.filter(line => line.category === 'board');
    assert(boardLines.length, 'The wall estimate must include boards.');
    for (const line of boardLines) assert.equal(sourceProduct(catalog, line.product_id).metadata?.moisture_resistance, 'H1', 'Bathroom boards must be H1.');
  }
  if (scenario.id === 'shower_followup') {
    assert(['direct_shower_spray', 'shower_tray'].includes(input.water_exposure), 'The shower context must not be discarded.');
    assert(/douche|receveur/i.test(trace.output) && /protection|[eé]tanch[eé]it[eé]/i.test(trace.output), 'The answer must separate shower water protection from the materials estimate.');
  }
  return { outcome: result.status, execution_id: trace.id, tool_calls: trace.steps.map(item => item.tool),
    parsed_intermediate_steps: trace.steps.length, floor_total_eur: floor.total_eur,
    total_eur: result.total_eur, known_subtotal_eur: result.known_subtotal_eur,
    measurements: result.measurements, assumption_origins: result.assumption_origins,
    answer_review_required: true };
}
async function fetchTrace(afterId) {
  for (let pass = 0; pass < 12; pass++) {
    const records = readExecutions({ sessionId: prefix, afterId }).executions;
    const trace = records.findLast(record => ['success', 'error', 'crashed', 'canceled'].includes(record.status));
    if (trace) return trace;
    await sleep(500);
  }
  throw new Error('No completed synthetic execution trace was found after the chat response.');
}

if (!process.argv.includes('--run') || process.argv.includes('--dry-run')) {
  console.log(JSON.stringify({ mode: 'dry_run', workflow_id: 'atelierAgentChantier01', scenarios,
    command: 'node chantier/test-agent-room.mjs --run',
    note: 'Aucun appel réseau ou modèle. --run envoie trois messages successifs dans une même session fictive. Les valeurs viennent des traces des outils réels ; la réponse naturelle reste à relire.' }, null, 2));
} else {
  const directory = resolve(root, 'work/chantier-validation', prefix);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const catalog = JSON.parse(readFileSync(resolve(root, 'chantier/catalog.json'), 'utf8'));
  const results = [];
  for (const scenario of scenarios) {
    const started = Date.now(); let trace;
    console.log(`DÉBUT ${scenario.id} : session fictive, fournisseur réel.`);
    try {
      const before = Number(readExecutions({ cursorOnly: true }).latest_id);
      const http = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sendMessage', sessionId: prefix, chatInput: scenario.message }), signal: AbortSignal.timeout(330_000) });
      const content = await http.text(); let body;
      try { body = JSON.parse(content); } catch { body = { non_json: true, text: content.slice(0, 120000) }; }
      const response = { status: http.status, body };
      persist(directory, `${scenario.id}-response`, { request: scenario, response });
      trace = await fetchTrace(before);
      persist(directory, `${scenario.id}-trace`, trace);
      const details = assess(scenario, trace, response, catalog, results.at(-1));
      results.push({ case: scenario.id, passed: true, duration_ms: Date.now() - started, ...details });
    } catch (error) {
      const message = error.code === 'ERR_ASSERTION' ? String(error.message).split('\n')[0]
        : error.name === 'TimeoutError' ? 'Chat timeout; n8n may still be executing.' : String(error.message).slice(0, 300);
      results.push({ case: scenario.id, passed: false, duration_ms: Date.now() - started, error: message,
        ...(trace ? { execution_id: trace.id, parsed_intermediate_steps: trace.steps.length, tool_calls: trace.steps.map(item => item.tool) } : {}) });
    }
    console.log(JSON.stringify(results.at(-1)));
    persist(directory, 'summary', { created_at: new Date().toISOString(), prefix, results,
      limitations: 'Three synthetic turns in one session. Saved calls, calculator measurements and prices are asserted. Natural-language answers require human review. No complete quote, construction certification, live stock or purchase is claimed.' });
    // A failed first turn must not produce misleading follow-up assertions or paid retries.
    if (!results.at(-1).passed) break;
  }
  const passed = results.length === scenarios.length && results.every(item => item.passed);
  console.log(JSON.stringify({ passed, passed_cases: results.filter(item => item.passed).length, total_cases: results.length,
    planned_cases: scenarios.length, directory, results }, null, 2));
  process.exitCode = passed ? 0 : 1;
}

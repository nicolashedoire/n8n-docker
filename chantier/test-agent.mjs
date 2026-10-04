#!/usr/bin/env node
/** Four sequential, synthetic agent checks. Default is a dry run: no model/API calls.
 * node chantier/test-agent.mjs --dry-run
 * node chantier/test-agent.mjs --run
 * Responses/traces remain under ignored work/chantier-validation, with mode 0600.
 * These bounded checks measure actual tool use, not general building compliance.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { readExecutions, TOOL_NAMES } from './extract-execution.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webhook = process.env.CHANTIER_CHAT_URL ?? 'http://localhost:5678/webhook/atelier-agent-chantier/chat';
const url = new URL(webhook);
assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.protocol === 'http:' && !url.username && !url.password && !url.search, 'Only an unauthenticated local chat URL is accepted.');
const prefix = `check-chantier-${new Date().toISOString().replace(/\D/g, '').slice(0, 17)}-${randomBytes(3).toString('hex')}`;
const scenarios = [
  { id: 'ambiguous', session: `${prefix}-ambiguous`, message: 'Je veux refaire une pièce en placo.' },
  { id: 'tiling', session: `${prefix}-tiling`, message: 'Je veux carreler 20 m² au sol dans un salon intérieur sec, avec du carrelage gris. Je confirme une marge de 10 % et un budget de 350 euros pour les carreaux seuls. Choisis une référence adaptée dans ton catalogue et calcule les cartons et le total estimatif.' },
  { id: 'partition', session: `${prefix}-partition`, message: 'Je crée une cloison non porteuse de 4 m de long et 2,50 m de haut dans une chambre sèche, sans porte ni fenêtre. Je veux un simple parement de chaque côté, une finition peinte légère et une isolation phonique dans la cloison. Marge de 10 %, budget de 500 euros pour les matériaux de ton catalogue. Propose les références et une estimation, en indiquant les hypothèses à valider.' },
  { id: 'wet_followup', session: `${prefix}-partition`, message: 'Finalement cette même cloison, avec les mêmes dimensions et la même isolation, est pour une salle de bains privative. La finition reste peinte légère, hors projection directe d’eau. Je passe le budget à 800 euros et garde la même marge. Reprends le choix des plaques et recalcule l’estimation ; précise ce qui reste à vérifier pour la protection à l’eau.' },
];

function persist(directory, name, value) { writeFileSync(resolve(directory, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }); }
function calls(trace, kind) { return trace.steps.filter(step => step.tool === TOOL_NAMES[kind]); }
function calculation(step) { return step.input?.calculation ?? step.input; }
function validEstimate(trace) { return calls(trace, 'estimate').filter(step => step.observation?.status === 'ok').at(-1); }
function near(actual, expected, label) { assert(typeof actual === 'number' && Math.abs(actual - expected) < 1e-6, label); }
function sourceProduct(catalog, id) {
  const product = catalog.products.find(item => item.id === id);
  assert(product, 'A selected product must exist in the source catalogue.');
  return product;
}
function assertPrices(result, catalog) {
  assert(Array.isArray(result.lines) && result.lines.length > 0, 'The successful calculator result must contain purchase lines.');
  let cents = 0;
  for (const line of result.lines) {
    const product = sourceProduct(catalog, line.product_id);
    assert(Number.isInteger(line.packs) && line.packs > 0, 'Purchase packs must be positive integers.');
    near(line.price_per_pack?.amount, product.price.amount, 'Pack price must match the dated catalogue.');
    near(line.total_eur, Math.round(product.price.amount * 100) * line.packs / 100, 'Line subtotal must equal packs × pack price.');
    assert.equal(line.price_per_pack.source_url, product.source_url, 'A price must retain its source.');
    cents += Math.round(line.total_eur * 100);
  }
  near(result.total_eur, cents / 100, 'Total must equal the sum of tool line subtotals.');
  assert.equal(result.no_order_placed, true, 'The estimate must not place an order.');
  assert.equal(result.no_payment, true, 'The estimate must not perform a payment.');
}
function assertToolSequence(trace, step) {
  assert(calls(trace, 'rules').some(item => item.index < step.index), 'Rules must be consulted before the successful calculation.');
  assert(calls(trace, 'search').some(item => item.index < step.index), 'Catalogue search must precede the successful calculation.');
}
function assertPartition(step, catalog, room, budget) {
  const input = calculation(step), out = step.observation;
  assert.equal(input.project_type, 'partition'); assert.equal(input.room_type, room);
  assert.deepEqual(input.wall_lengths_m, [4]); near(input.height_m, 2.5, 'The original height must be retained.');
  assert.deepEqual(input.openings, []); near(input.margin_pct, 10, 'The confirmed margin must be retained.');
  near(input.budget_eur, budget, 'The latest budget must be used.');
  assert.equal(input.wall_finish, 'light', 'Painted light finish must be retained.');
  assert(input.layers === undefined || input.layers === 1, 'Only single facing was requested.');
  assert.equal(input.framing_system, 'partition_m48_single_600');
  assert(input.product_ids.insulation, 'Requested cavity insulation must be included.');
  assert.equal(out.measurements.faces, 2, 'A partition has two board faces.');
  near(out.measurements.gross_wall_area_m2, 10, 'Gross wall area must be 10 m².');
  near(out.measurements.board_area_with_margin_m2, 22, 'Board area must cover two faces plus margin.');
  const board = sourceProduct(catalog, input.product_ids.board);
  assert.equal(board.metadata.moisture_resistance, room === 'wet' ? 'H1' : 'standard', 'Board moisture class must match the demonstrated use.');
  if (room === 'wet') {
    assert.equal(input.room_usage, 'private_bathroom');
    assert.equal(input.water_exposure, 'outside_direct_spray', 'The explicitly stated water exposure must be retained.');
  }
  assertPrices(out, catalog);
}
function assess(scenario, trace, response, catalog, previous) {
  assert.equal(trace.status, 'success', 'The n8n execution must succeed.');
  assert(trace.intermediate_steps_present, 'Agent intermediateSteps must be saved and parsed.');
  assert(typeof trace.output === 'string' && trace.output.trim(), 'The trace must contain the final agent answer.');
  assert(response.status === 200, 'The published chat must return HTTP 200.');
  const report = { tool_calls: trace.steps.map(step => step.tool), parsed_intermediate_steps: trace.steps.length, execution_id: trace.id };
  if (scenario.id === 'ambiguous') {
    assert.equal(calls(trace, 'estimate').length, 0, 'An ambiguous request must not trigger a fabricated estimate.');
    assert(/\?/.test(trace.output) && /cloison/i.test(trace.output) && /doublage/i.test(trace.output), 'The answer must ask which kind of plasterboard project is meant.');
    return { ...report, outcome: 'clarification', answer_review: 'Question wording checked; no calculation tool was called.' };
  }
  if (scenario.id === 'wet_followup') {
    assert(previous, 'The dry partition turn must exist in the same synthetic session.');
    assert(calls(trace, 'rules').some(step => step.input?.project_type === 'partition' && step.input?.room_type === 'wet'), 'The changed use must trigger consultation of wet-room rules.');
    for (const step of calls(trace, 'estimate')) assert.equal(calculation(step)?.room_type, 'wet', 'The follow-up must not recalculate stale dry-room assumptions.');
    const step = validEstimate(trace);
    if (!step) {
      const missing = calls(trace, 'estimate').find(item => item.observation?.status === 'needs_information' && item.observation.missing_fields?.length);
      assert(missing && /\?/.test(trace.output), 'A deferred wet estimate must expose a real missing-information result and ask a question.');
      return { ...report, outcome: 'wet_clarification', missing_fields: missing.observation.missing_fields, manual_review_required: true };
    }
    assertPartition(step, catalog, 'wet', 800);
    assert(/hydrofuge|\bH1\b/i.test(trace.output), 'The human answer must mention the new H1/hydrophobic board choice.');
    return { ...report, outcome: 'wet_recalculation', total_eur: step.observation.total_eur };
  }
  const step = validEstimate(trace);
  assert(step, 'A sufficiently specified request must reach a successful calculation tool result.');
  assertToolSequence(trace, step);
  if (scenario.id === 'tiling') {
    const input = calculation(step), out = step.observation;
    assert.equal(input.project_type, 'tiling'); assert.equal(input.room_type, 'dry');
    near(input.surface_m2, 20, 'The stated surface must be 20 m².'); near(input.margin_pct, 10, 'The margin must be 10 %.'); near(input.budget_eur, 350, 'The budget must be 350 EUR.');
    near(out.measurements.surface_with_margin_m2, 22, 'The calculation must include the confirmed margin.');
    const tile = sourceProduct(catalog, input.product_ids.tile);
    assert.equal(out.lines.length, 1, 'Only tiles are requested in this scenario.');
    assert.equal(out.lines[0].packs, Math.ceil(22 / tile.pack.coverage_m2), 'Cartons must be rounded using the actual catalogue coverage.');
    assertPrices(out, catalog);
  } else assertPartition(step, catalog, 'dry', 500);
  return { ...report, outcome: 'estimate', total_eur: step.observation.total_eur };
}

async function fetchTrace(sessionId, afterId) {
  for (let pass = 0; pass < 12; pass++) {
    const records = readExecutions({ sessionId, afterId }).executions;
    const trace = records.findLast(record => ['success', 'error', 'crashed', 'canceled'].includes(record.status));
    if (trace) return trace;
    await sleep(500);
  }
  throw new Error('No completed synthetic execution trace was found after the chat response.');
}

if (!process.argv.includes('--run') || process.argv.includes('--dry-run')) {
  console.log(JSON.stringify({ mode: 'dry_run', workflow_id: 'atelierAgentChantier01', scenarios: scenarios.map(item => ({ id: item.id, session: item.session, message: item.message })), command: 'node chantier/test-agent.mjs --run', note: 'Aucun appel réseau ou modèle. --run lance quatre tours séquentiels ; les deux derniers partagent la mémoire. Les observations réelles des outils sont vérifiées, puis une relecture humaine des réponses reste nécessaire.' }, null, 2));
} else {
  const directory = resolve(root, 'work/chantier-validation', prefix);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const catalog = JSON.parse(readFileSync(resolve(root, 'chantier/catalog.json'), 'utf8'));
  const results = []; let partitionTrace;
  for (const scenario of scenarios) {
    const started = Date.now(); let response, trace;
    console.log(`DÉBUT ${scenario.id} : session fictive, fournisseur réel.`);
    try {
      const before = readExecutions({ cursorOnly: true }).latest_id;
      const http = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sendMessage', sessionId: scenario.session, chatInput: scenario.message }), signal: AbortSignal.timeout(330_000) });
      const text = await http.text(); let body; try { body = JSON.parse(text); } catch { body = { non_json: true, text: text.slice(0, 120000) }; }
      response = { status: http.status, body };
      persist(directory, `${scenario.id}-response`, { request: scenario, response });
      trace = await fetchTrace(scenario.session, Number(before));
      persist(directory, `${scenario.id}-trace`, trace);
      if (scenario.id === 'partition') partitionTrace = trace;
      const details = assess(scenario, trace, response, catalog, partitionTrace);
      results.push({ case: scenario.id, passed: true, duration_ms: Date.now() - started, ...details });
    } catch (error) {
      const message = error.code === 'ERR_ASSERTION' ? String(error.message).split('\n')[0] : error.name === 'TimeoutError' ? 'Chat timeout; n8n may still be executing.' : String(error.message).slice(0, 300);
      results.push({ case: scenario.id, passed: false, duration_ms: Date.now() - started, error: message, ...(trace ? { execution_id: trace.id, parsed_intermediate_steps: trace.steps.length, tool_calls: trace.steps.map(step => step.tool) } : {}) });
    }
    console.log(JSON.stringify(results.at(-1)));
    persist(directory, 'summary', { created_at: new Date().toISOString(), prefix, results, limitations: 'Four synthetic turns, once each. Assertions validate saved tool calls and calculator results. Natural-language answers require human review; no certification, live stock check or completed purchase is claimed.' });
    if (!results.at(-1).passed && process.argv.includes('--fail-fast')) break;
  }
  const passed = results.every(item => item.passed);
  console.log(JSON.stringify({ passed, passed_cases: results.filter(item => item.passed).length, total_cases: results.length, planned_cases: scenarios.length, directory, results }, null, 2));
  process.exitCode = passed ? 0 : 1;
}

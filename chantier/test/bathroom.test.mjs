import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { estimate, selectRules } from '../quantities.mjs';
import { createToolServer, refreshProduct } from '../server.mjs';

const catalog = JSON.parse(readFileSync(new URL('../catalog.json', import.meta.url)));
const rules = JSON.parse(readFileSync(new URL('../rules.json', import.meta.url)));
const minimal = { project_type: 'bathroom', length_m: 4, width_m: 3 };
const run = (patch = {}, cat = catalog) => estimate({ ...minimal, ...patch }, cat, rules);
const category = result => Object.fromEntries(result.lines.map(item => [item.category, item]));
const origins = result => Object.fromEntries(result.assumption_origins.map(item => [item.field, item]));

test('bathroom needs only two dimensions and publishes provisional defaults honestly', () => {
  const policy = selectRules({ project_type: 'bathroom' }, rules);
  assert.equal(policy.status, 'allowed');
  assert.deepEqual(policy.required_fields, ['length_m', 'width_m']);
  const result = run();
  assert.equal(result.status, 'ok');
  assert.equal(result.preliminary, true);
  assert.equal(result.measurements.floor_area_m2, 12);
  assert.equal(result.measurements.perimeter_m, 14);
  assert.equal(result.measurements.gross_wall_area_m2, 35);
  assert.deepEqual(result.measurements.wall_lengths_m, [4, 3, 4, 3]);
  assert.equal(origins(result).length_m.origin, 'provided');
  for (const field of ['height_m', 'margin_pct', 'openings', 'include_insulation', 'wall_finish', 'water_exposure'])
    assert.equal(origins(result)[field].origin, 'default', field);
  assert(origins(result).openings.reason.includes('ne signifie pas'));
  assert.equal(result.budget.status, 'not_provided');
  assert.equal(result.no_order_placed, true);
  assert.equal(result.no_payment, true);
});

test('bathroom quantities use one face, per-pan cuts, doubled stud stations and one cavity', () => {
  const result = run(), lines = category(result), walls = result.components.walls;
  assert.equal(walls.measurements.faces, 1);
  assert.equal(walls.measurements.stud_multiplier, 2);
  assert.deepEqual(walls.measurements.base_studs_by_wall, [16, 12, 16, 12]);
  assert.equal(walls.measurements.board_minimum_by_pan, 24);
  assert.equal(walls.measurements.board_area_with_margin_m2, 38.5);
  assert.equal(lines.tile.packs, 13);
  assert.equal(lines.board.packs, 26);
  assert.equal(lines.rail.packs, 14);
  assert.equal(lines.stud.packs, 62);
  assert.equal(lines.insulation.required_quantity, 38.5);
  assert.equal(lines.insulation.packs, 5);
  assert.equal(lines.insulation.purchased_units, 65, 'Five complete lots of thirteen panels, not five panels');
  assert.equal(lines.insulation.coverage_purchased_m2, 46.8);
  assert.equal(result.components.floor.total_eur, 153.01);
  assert.equal(walls.total_eur, 1163.4);
  assert.equal(result.total_eur, 1316.41);
  assert(walls.assumptions.some(value => value.includes('une seule face')));
  assert(!walls.assumptions.some(value => value.includes('H1 sur les deux faces')));
  assert.equal(lines.rail.price_per_pack.basis, 'retailer_recommended');
  assert(lines.rail.price_per_pack.notice.includes('conseillé'));
  assert(result.limitations.some(value => value.includes('pas un devis')));
});

test('opening data reduce wall/insulation area without pretending door framing disappears', () => {
  const result = run({ openings: [{ wall_index: 0, width_m: 0.9, height_m: 2.1 }] });
  const lines = category(result);
  assert.equal(result.status, 'ok');
  assert.equal(result.measurements.openings_area_m2, 1.89);
  assert.equal(result.measurements.net_wall_area_m2, 33.11);
  assert.equal(lines.rail.packs, 14);
  assert.equal(lines.stud.packs, 66);
  assert.equal(lines.board.packs, 25);
  assert.equal(lines.insulation.required_quantity, 36.421);
  assert.equal(origins(result).openings.origin, 'provided');
});

test('confirmed height and margin override defaults and geometry always recalculates', () => {
  const result = run({ length_m: 5, height_m: 2.4, margin_pct: 0, include_insulation: false });
  assert.equal(result.status, 'ok');
  assert.equal(result.measurements.floor_area_m2, 15);
  assert.equal(result.measurements.perimeter_m, 16);
  assert.equal(result.measurements.gross_wall_area_m2, 38.4);
  assert.equal(result.measurements.margin_pct, 0);
  assert.equal(origins(result).height_m.origin, 'provided');
  assert.equal(category(result).insulation, undefined);
  assert.equal(category(result).tile.packs, 14);
});

test('height outside sourced lining range retains floor but never reports a full total', () => {
  const result = run({ height_m: 2.7, budget_eur: 2000 });
  assert.equal(result.status, 'partial');
  assert.equal(result.preliminary, true);
  assert.equal(result.measurements.gross_wall_area_m2, 37.8);
  assert.equal(result.components.floor.status, 'ok');
  assert.equal(result.components.walls.status, 'unsupported');
  assert.equal(result.components.walls.lines, undefined);
  assert.equal(result.total_eur, null);
  assert.equal(result.known_subtotal_eur, 153.01);
  assert.equal(result.pricing_status, 'scope_partial');
  assert.equal(result.budget.status, 'cannot_determine');
  assert.deepEqual(result.unpriced_components.map(item => item.section), ['walls']);
});

test('tiled walls do not silently reuse the light-finish 600 mm lining', () => {
  for (const wall_finish of ['tile', 'heavy', 'unknown']) {
    const result = run({ wall_finish });
    assert.equal(result.status, 'partial');
    assert.equal(result.components.floor.status, 'ok');
    assert.notEqual(result.components.walls.status, 'ok');
    assert.equal(result.total_eur, null);
  }
});

test('a shower does not block provisional base quantities or become waterproofing approval', () => {
  const result = run({ water_exposure: 'shower_tray' });
  assert.equal(result.status, 'ok');
  assert.equal(result.measurements.floor_area_for_tiles_m2, 12);
  assert.equal(origins(result).water_exposure.value, 'shower_tray');
  assert.equal(origins(result).shower_footprint_m2.origin, 'default');
  assert(result.limitations.some(value => value.includes('aucun carrelage dans le receveur')));
  assert(result.limitations.some(value => value.includes('H1 ne')));
  const measured = run({ water_exposure: 'shower_tray', shower_footprint_m2: 1.2 });
  assert.equal(measured.measurements.floor_area_m2, 12);
  assert.equal(measured.measurements.floor_area_for_tiles_m2, 10.8);
  assert.equal(category(measured).tile.packs, 11);
  assert.equal(measured.measurements.gross_wall_area_m2, 35);
});

test('bathroom refuses contradictory room context, bad geometry and impossible openings', () => {
  for (const patch of [{ room_type: 'dry' }, { length_m: '4' }, { width_m: -1 }, { height_m: 0 }, { margin_pct: 31 },
    { surface_m2: 12 }, { shower_footprint_m2: 12 }, { include_insulation: 'yes' },
    { openings: [{ wall_index: 4, width_m: 1, height_m: 2 }] }, { openings: [{ wall_index: 0, width_m: 5, height_m: 2 }] },
    { openings: [{ wall_index: 0, width_m: 3, height_m: 1 }, { wall_index: 0, width_m: 2, height_m: 1 }] }]) {
    const result = run(patch);
    assert.equal(result.status, 'invalid_input', JSON.stringify(patch));
    assert.equal(result.lines, undefined);
  }
  for (const room_usage of ['public_wet_room', 'swimming_pool']) assert.equal(run({ room_usage }).status, 'unsupported');
  const missing = estimate({ project_type: 'bathroom', length_m: 4 }, catalog, rules);
  assert.deepEqual(missing.missing_fields, ['width_m']);
});

test('unknown product price stays unknown and a standard board cannot masquerade as H1', () => {
  const amended = structuredClone(catalog);
  amended.products.find(item => item.id === 'rail_placo_r48_3000').price.amount = null;
  const result = run({ budget_eur: 2000 }, amended);
  assert.equal(result.status, 'ok');
  assert.equal(result.total_eur, null);
  assert.equal(result.pricing_status, 'snapshot_partial');
  assert.equal(result.budget.status, 'cannot_determine');
  const incompatible = run({ product_ids: { board: 'board_standard_2500x1200' } });
  assert.equal(incompatible.status, 'partial');
  assert.equal(incompatible.components.walls.status, 'unsupported');
  assert.equal(incompatible.total_eur, null);
});

test('HTTP room calculation succeeds without hidden model calls or extra user data', async t => {
  const app = createToolServer({ catalog, rules, fetchImpl: () => { throw new Error('Unexpected external call'); } });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(() => app.close());
  const response = await fetch(`http://127.0.0.1:${app.server.address().port}/tools/estimate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(minimal) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.status, 'ok');
  assert.equal(result.total_eur, 1316.41);
});

test('new retailer refresh allowlist remains exact and rejects lookalike hosts', async () => {
  const board = catalog.products.find(item => item.id === 'board_placomarine_h1_2500x600');
  let calls = 0;
  const fetchImpl = async url => { calls++; assert.equal(url, board.source_url); return new Response('', { status: 403 }); };
  const allowed = await refreshProduct(board, { fetchImpl });
  assert.equal(calls, 1);
  assert.equal(allowed.refresh.status, 'http_error');
  const blocked = await refreshProduct({ ...board, source_url: board.source_url.replace('www.entrepot-du-bricolage.fr', 'www.entrepot-du-bricolage.fr.evil.example') }, { fetchImpl });
  assert.equal(calls, 1);
  assert.equal(blocked.refresh.status, 'source_not_allowlisted');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { estimate, selectRules } from '../quantities.mjs';

const catalog = JSON.parse(readFileSync(new URL('../catalog.json', import.meta.url)));
const rules = JSON.parse(readFileSync(new URL('../rules.json', import.meta.url)));
const tile = { project_type: 'tiling', room_type: 'dry', surface_m2: 20, margin_pct: 10,
  product_ids: { tile: 'tile_arcano_95985488' }, budget_eur: 350 };
const partition = { project_type: 'partition', room_type: 'dry', wall_lengths_m: [4], height_m: 2.5,
  openings: [], margin_pct: 10, framing_system: 'partition_m48_single_600', wall_finish: 'light', stud_spacing_m: 0.6,
  include_insulation: true, product_ids: { board: 'board_standard_2500x1200', rail: 'rail_r48_3000', stud: 'stud_m48_2500', insulation: 'insulation_45mm' }, budget_eur: 500 };
const run = (input, cat = catalog) => estimate(input, cat, rules);
const byCategory = result => Object.fromEntries(result.lines.map(line => [line.category, line]));

test('tiling uses actual box coverage and box price, with exact cent totals', () => {
  const result = run(tile);
  assert.equal(result.status, 'ok');
  assert.equal(result.lines[0].packs, 21);
  assert.equal(result.lines[0].purchased_units, 63);
  assert.equal(result.total_eur, 247.17);
  assert.equal(result.budget.status, 'within_budget');
  assert.equal(result.pricing_status, 'snapshot_complete');
  assert.equal(result.no_order_placed, true);
  assert.equal(result.lines[0].price_per_pack.status, 'catalog_snapshot');
});

test('whole-box boundary does not add a spurious box; supplier coverage overrides nominal tile size', () => {
  assert.equal(run({ ...tile, surface_m2: 10.8, margin_pct: 0 }).lines[0].packs, 10);
  const result = run({ ...tile, surface_m2: 10.7, margin_pct: 0, product_ids: { tile: 'tile_verve_83275585' } });
  assert.equal(result.lines[0].packs, 11, '1.06 m² per box, not 3 × nominal 0.6 × 0.6');
});

test('invalid units, negative quantities and excessive margin are refused', () => {
  for (const patch of [{ surface_m2: '20' }, { surface_m2: -1 }, { margin_pct: 31 }, { margin_pct: '10%' }, { budget_eur: -3 }, { surface_cm2: 200000 }])
    assert.equal(run({ ...tile, ...patch }).status, 'invalid_input', JSON.stringify(patch));
});

test('missing data gives precise questions without quantities', () => {
  const result = run({ project_type: 'partition', room_type: 'unknown' });
  assert.equal(result.status, 'needs_information');
  assert(result.missing_fields.includes('room_type'));
  assert(result.questions.every(question => question.field && question.question));
  assert.equal(result.lines, undefined);
  const missingOpenings = { ...partition }; delete missingOpenings.openings;
  assert(run(missingOpenings).missing_fields.includes('openings'));
});

test('partition computes 2 faces, conservative per-pan boards, rails and cavity insulation once', () => {
  const result = run(partition);
  assert.equal(result.status, 'ok');
  const lines = byCategory(result);
  assert.equal(result.measurements.net_wall_area_m2, 10);
  assert.equal(result.measurements.faces, 2);
  assert.equal(lines.board.packs, 8);
  assert.equal(lines.rail.packs, 5);
  assert.equal(lines.stud.packs, 9);
  assert.equal(lines.insulation.required_quantity, 11);
  assert.equal(lines.insulation.packs, 1);
  assert.equal(lines.insulation.purchased_units, 4, 'One lot contains four rolls');
  assert.equal(result.total_eur, 170.51);
});

test('an opening reduces net area but never removes framing mechanically', () => {
  const before = run(partition);
  const after = run({ ...partition, openings: [{ wall_index: 0, width_m: 0.9, height_m: 2.1 }] });
  assert.equal(after.status, 'ok');
  assert.equal(after.measurements.openings_area_m2, 1.89);
  assert.equal(after.measurements.net_wall_area_m2, 8.11);
  const a = byCategory(before), b = byCategory(after);
  assert.equal(b.rail.packs, a.rail.packs);
  assert.equal(b.stud.packs, 11);
  assert(b.stud.packs > a.stud.packs);
  assert.equal(b.board.packs, 8, 'Geometric minimum avoids ideal reuse of cutouts');
  assert.equal(b.insulation.required_quantity, 8.921);
});

test('rails and studs count each pan separately', () => {
  const result = run({ ...partition, wall_lengths_m: [4, 4], margin_pct: 0 });
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.measurements.base_studs_by_wall, [8, 8]);
  assert.equal(byCategory(result).rail.packs, 8);
  assert.equal(byCategory(result).stud.packs, 16);
});

test('openings must reference a wall and fit its dimensions and cumulative width/area', () => {
  for (const openings of [
    [{ wall_index: 2, width_m: 1, height_m: 2 }],
    [{ wall_index: 0, width_m: 4.1, height_m: 1 }],
    [{ wall_index: 0, width_m: 1, height_m: 2.6 }],
    [{ wall_index: 0, width_m: 4, height_m: 2.5 }],
    [{ wall_index: 0, width_m: 3, height_m: 1 }, { wall_index: 0, width_m: 2, height_m: 1 }],
  ]) assert.equal(run({ ...partition, openings }).status, 'invalid_input');
});

test('ceilings, two layers, excessive heights, spacing and mismatched faces are not accepted', () => {
  assert.equal(run({ ...partition, project_type: 'ceiling' }).status, 'unsupported');
  assert.equal(run({ ...partition, layers: 2 }).status, 'unsupported');
  assert.equal(run({ ...partition, height_m: 2.51 }).status, 'unsupported');
  assert.equal(run({ ...partition, stud_spacing_m: 0.7 }).status, 'unsupported');
  assert.equal(run({ ...partition, faces: 1 }).status, 'invalid_input');
  assert.equal(run({ ...partition, framing_system: 'made_up' }).status, 'unsupported');
});

test('tile and heavy wall finishes never reuse the light 600 mm rule', () => {
  assert.equal(run({ ...partition, wall_finish: 'unknown' }).status, 'needs_information');
  for (const wall_finish of ['tile', 'heavy']) assert.equal(run({ ...partition, wall_finish }).status, 'unsupported');
});

test('wet use requires private context, water exposure and verified H1 board', () => {
  assert.equal(run({ ...partition, room_type: 'wet' }).status, 'needs_information');
  const wet = { ...partition, room_type: 'wet', room_usage: 'private_bathroom', water_exposure: 'outside_direct_spray' };
  assert.equal(run(wet).status, 'unsupported', 'Standard board cannot silently become H1');
  const result = run({ ...wet, product_ids: { ...wet.product_ids, board: 'board_h1_2500x1200' } });
  assert.equal(result.status, 'ok');
  assert.equal(byCategory(result).board.packs, 8);
  assert(result.assumptions.some(text => text.includes('choix conservateur')));
  assert(result.limitations.some(text => text.includes('étanchéité')));
  for (const patch of [{ room_usage: 'public_wet_room' }, { room_usage: 'swimming_pool' }, { water_exposure: 'direct_shower_spray' }, { water_exposure: 'shower_tray' }])
    assert.equal(run({ ...wet, ...patch }).status, 'unsupported');
});

test('dry classification cannot bypass a conflicting wet usage or direct water exposure', () => {
  const contradictions = [{ room_usage: 'private_bathroom' }, { room_usage: 'public_wet_room' },
    { room_usage: 'swimming_pool' }, { water_exposure: 'direct_shower_spray' }, { water_exposure: 'shower_tray' }];
  for (const base of [partition, tile]) for (const patch of contradictions) {
    const result = run({ ...base, ...patch });
    assert.equal(result.status, 'invalid_input', JSON.stringify(patch));
    assert.equal(result.issues[0].field, 'room_type');
    assert.equal(result.lines, undefined);
  }
  assert.equal(run({ ...partition, water_exposure: 'outside_direct_spray' }).status, 'ok', 'Absence of direct water exposure is not a contradiction with a dry room');
});

test('lining does not reuse a two-face partition frame', () => {
  const result = run({ ...partition, project_type: 'lining' });
  assert.equal(result.status, 'needs_information');
  assert.equal(result.lines, undefined);
});

test('budget overrun and unknown prices are explicit, never invented', () => {
  const over = run({ ...tile, budget_eur: 200 });
  assert.equal(over.budget.status, 'over_budget');
  assert.equal(over.budget.difference_eur, -47.17);
  const missingPrice = structuredClone(catalog);
  missingPrice.products.find(p => p.id === tile.product_ids.tile).price.amount = null;
  const unknown = run(tile, missingPrice);
  assert.equal(unknown.total_eur, null);
  assert.equal(unknown.pricing_status, 'snapshot_partial');
  assert.equal(unknown.budget.status, 'cannot_determine');
});

test('sales packs round required pieces up, without multiplying their unit price twice', () => {
  const packed = structuredClone(catalog);
  const board = packed.products.find(p => p.id === partition.product_ids.board);
  board.pack.quantity = 3; board.pack.coverage_m2 = 9; board.price.amount = 24;
  const result = run(partition, packed);
  const boardLine = byCategory(result).board;
  assert.equal(boardLine.required_quantity, 8);
  assert.equal(boardLine.packs, 3);
  assert.equal(boardLine.purchased_units, 9);
  assert.equal(boardLine.total_eur, 72);
});

test('insulation cannot silently exceed the frame profile width', () => {
  const oversized = structuredClone(catalog);
  oversized.products.find(p => p.id === partition.product_ids.insulation).metadata.thickness_mm = 100;
  assert.equal(run(partition, oversized).status, 'unsupported');
  assert.equal(run(partition).status, 'ok');
});

test('rules expose supported scope, source references, input units and safe defaults', () => {
  const result = selectRules({ project_type: 'partition', room_type: 'wet' }, rules);
  assert.equal(result.status, 'allowed');
  assert(result.sources.length);
  assert(result.required_fields.includes('room_usage'));
  assert(result.required_fields.includes('water_exposure'));
  assert.equal(result.input_contract.recommended_parameters.framing_system, 'partition_m48_single_600');
  assert.equal(result.input_contract.units.lengths, 'm');
});

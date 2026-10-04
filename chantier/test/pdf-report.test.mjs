import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { estimate } from '../quantities.mjs';
import { renderStudyPdf } from '../pdf-report.mjs';

const catalog = JSON.parse(await readFile(new URL('../catalog.json', import.meta.url)));
const rules = JSON.parse(await readFile(new URL('../rules.json', import.meta.url)));
const context = { catalog, reportId: 'pdf-test-20261004', generatedAt: '2026-10-04T16:15:00.000Z' };
// Read the standard-font text in PDFKit content streams, including split TJ runs.
// This checks document content without adding a PDF parser to the production API.
function inspect(buffer) {
  const raw = buffer.toString('latin1');
  const text = [...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].flatMap(match => {
    try {
      const stream = inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
      return [...stream.matchAll(/\[([^\]]*)\]\s*TJ/g)].map(run => [...run[1].matchAll(/<([0-9a-f]+)>/gi)].map(hex => Buffer.from(hex[1], 'hex').toString('latin1')).join(''));
    } catch { return []; }
  }).join('\n');
  return { raw, text, compact: text.replace(/\s+/g, ' '), pages: [...raw.matchAll(/\/Type \/Page\b/g)].length };
}

test('PDF reproduces bathroom quantities, dated prices, origin labels and clickable sources in three pages', async () => {
  const result = estimate({ project_type: 'bathroom', length_m: 4, width_m: 3 }, catalog, rules);
  const pdf = await renderStudyPdf({ ...context, estimate: result });
  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  const doc = inspect(pdf);
  assert.equal(doc.pages, 3);
  assert.match(doc.compact, /1 316,41/);
  assert.match(doc.compact, /13 cartons|13 conditionnement/);
  assert.match(doc.compact, /26 conditionnement/);
  assert.match(doc.compact, /14 conditionnement/);
  assert.match(doc.compact, /62 conditionnement/);
  assert.match(doc.compact, /5 conditionnement/);
  assert.match(doc.compact, /Hypothèse/);
  assert.match(doc.compact, /Transmis/);
  assert.match(doc.compact, /prix conseillé/i);
  assert.match(doc.compact, /04\/10\/2026/);
  assert.match(doc.compact, /18:15/); // UTC to Europe/Paris, independent of host timezone.
  assert.match(doc.compact, /ne signifie pas étanchéité complète/);
  assert.match(doc.raw, /\/URI \(https:\/\/www\.leroymerlin\.fr/);
  assert.match(doc.raw, /\/URI \(https:\/\/www\.placo\.fr/);
  assert.match(doc.compact, /pdf-test-20261004/);
});

test('PDF makes unsupported walls explicit and never displays a complete total for a partial bathroom', async () => {
  const result = estimate({ project_type: 'bathroom', length_m: 4, width_m: 3, height_m: 2.7 }, catalog, rules);
  assert.equal(result.total_eur, null);
  const doc = inspect(await renderStudyPdf({ ...context, estimate: result }));
  assert.equal(doc.pages, 3);
  assert.match(doc.compact, /SOUS-TOTAL CONNU/);
  assert.match(doc.compact, /153,01/);
  assert.match(doc.compact, /37,8 m²/);
  assert.match(doc.compact, /2,7 m/);
  assert.match(doc.compact, /Doublages des murs : non chiffré/);
  assert.match(doc.compact, /Total du périmètre non déterminé/);
  assert.doesNotMatch(doc.compact, /1 316,41|TOTAL DES MATÉRIAUX SÉLECTIONNÉS/);
});

test('PDF preserves unavailable prices and rejects non-calculable business results', async () => {
  const snapshot = structuredClone(catalog);
  delete snapshot.products.find(item => item.id === 'tile_arcano_95985488').price;
  const result = estimate({ project_type: 'bathroom', length_m: 4, width_m: 3 }, snapshot, rules);
  const doc = inspect(await renderStudyPdf({ ...context, catalog: snapshot, estimate: result }));
  assert.match(doc.compact, /SOUS-TOTAL CONNU/);
  assert.match(doc.compact, /1 163,40/);
  assert.match(doc.compact, /Non chiffré/);
  await assert.rejects(renderStudyPdf({ ...context, estimate: { status: 'needs_information', missing_fields: ['length_m'] } }), /résultat de calcul/);
  await assert.rejects(renderStudyPdf({ ...context, estimate: result, generatedAt: 'invalid' }), /Date de génération/);
});

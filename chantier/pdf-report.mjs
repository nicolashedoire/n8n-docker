import PDFDocument from 'pdfkit';

// This renderer accepts only the calculator's result. It does not call a model,
// visit a supplier, recompute a price or turn an assumption into a measurement.
const C = { ink: '#183C37', text: '#243C38', muted: '#687D76', line: '#DCE5DF', pale: '#F1F6F2', green: '#186C54', amber: '#865516', amberPale: '#FBF3E6', white: '#FFFFFF' };
const L = 44, W = 507.28, BOTTOM = 788;
const safeText = value => String(value ?? '').normalize('NFC').replace(/[\u2010-\u2015\u2212]/g, '-').replace(/[\u00a0\u202f]/g, ' ').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
const num = (value, digits = 2) => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('fr-FR', { maximumFractionDigits: digits }).replace(/[\u00a0\u202f]/g, ' ') : 'Non renseigné';
const money = value => typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[\u00a0\u202f]/g, ' ')} €` : 'Non chiffré';
const dateOnly = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? value.split('-').reverse().join('/') : 'Date non renseignée';
const https = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; } };
const category = { tile: 'Carrelage de sol', board: 'Plaques de parement', rail: 'Rails', stud: 'Montants', insulation: 'Isolation' };
const sectionName = { floor: 'Sol', walls: 'Doublages des murs' };
const fieldName = { length_m: 'Longueur intérieure', width_m: 'Largeur intérieure', height_m: 'Hauteur', margin_pct: 'Marge de découpes', openings: 'Ouvertures', include_insulation: 'Isolation', wall_finish: 'Finition des murs', room_usage: 'Usage de la pièce', water_exposure: 'Exposition à l’eau', shower_footprint_m2: 'Emprise déduite au sol', framing_system: 'Système de doublage' };

function fieldValue(item) {
  if (['length_m', 'width_m', 'height_m'].includes(item.field)) return `${num(item.value)} m`;
  if (item.field === 'margin_pct') return `${num(item.value)} %`;
  if (item.field === 'shower_footprint_m2') return `${num(item.value)} m²`;
  if (item.field === 'openings') return Array.isArray(item.value) && item.value.length ? `${item.value.length} ouverture(s) renseignée(s)` : 'Aucune déduction';
  if (item.field === 'include_insulation') return item.value ? 'Incluse' : 'Non incluse';
  const values = { light: 'Légère / peinture', tile: 'Carrelage mural', heavy: 'Revêtement lourd', unknown: 'À préciser', private_bathroom: 'Salle de bains privative', outside_direct_spray: 'Hors projection directe', direct_shower_spray: 'Projection directe de douche', shower_tray: 'Douche avec receveur', bathroom_lining_placo_m48_double_600: 'M48 doublés, entraxe 600 mm' };
  return values[item.value] ?? safeText(item.value);
}

/** Build an A4 study without any filesystem or network side effects. */
export async function renderStudyPdf({ estimate, catalog, reportId, generatedAt = new Date() }) {
  if (!estimate || !['ok', 'partial'].includes(estimate.status) || !Array.isArray(estimate.lines)) throw new TypeError('Un résultat de calcul ok ou partial est requis pour le rapport.');
  const instant = new Date(generatedAt);
  if (!Number.isFinite(instant.getTime())) throw new TypeError('Date de génération invalide.');
  const reference = safeText(reportId || 'etude').slice(0, 100);
  const stamp = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'long', timeStyle: 'short' }).format(instant);
  const project = { bathroom: 'Salle de bains', tiling: 'Carrelage', partition: 'Cloison non porteuse', lining: 'Doublage' }[estimate.project_type] ?? 'Projet de matériaux';
  const m = estimate.measurements ?? {};
  const partial = estimate.status === 'partial' || estimate.total_eur === null;
  // Body pagination stops at BOTTOM; the smaller native bottom margin leaves
  // room for the footer without PDFKit creating an automatic extra page.
  const doc = new PDFDocument({ size: 'A4', margins: { top: 44, left: L, right: L, bottom: 15 }, bufferPages: true, autoFirstPage: false,
    info: { Title: `Étude préliminaire - ${project}`, Author: 'L’Atelier n8n', Subject: `Métré et matériaux - ${reference}`, Creator: 'L’Atelier n8n - calculateur déterministe', CreationDate: instant, ModDate: instant } });
  const chunks = [];
  const result = new Promise((resolve, reject) => { doc.on('data', data => chunks.push(data)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  let y = 0;
  const set = (size = 10, bold = false, color = C.text) => doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color);
  const h = (text, width, size = 10, bold = false) => { set(size, bold); return doc.heightOfString(safeText(text), { width, lineGap: 2 }); };
  function page(label) {
    doc.addPage();
    set(9, true, C.green); doc.text('L’ATELIER N8N  /  AGENT CHANTIER', L, 30, { width: 330, lineBreak: false });
    set(8, false, C.muted); doc.text(label, L + 325, 31, { width: W - 325, align: 'right', lineBreak: false });
    doc.strokeColor(C.line).lineWidth(0.7).moveTo(L, 50).lineTo(L + W, 50).stroke();
    y = 69;
  }
  function ensure(height, label = 'Suite de l’étude') { if (y + height > BOTTOM) page(label); }
  function text(value, { size = 10, bold = false, color = C.text, gap = 7, width = W, x = L } = {}) {
    const height = h(value, width, size, bold); ensure(height + gap); set(size, bold, color); doc.text(safeText(value), x, y, { width, lineGap: 2 }); y += height + gap;
  }
  function heading(number, title) {
    ensure(38); set(9, true, C.green); doc.text(number, L, y + 3, { width: 26 }); set(16, true, C.ink); doc.text(title, L + 29, y, { width: W - 29 }); y += 32;
  }
  function callout(title, body, amber = false) {
    const titleHeight = h(title, W - 26, 10, true);
    const height = 15 + titleHeight + 5 + h(body, W - 26, 9) + 12; ensure(height + 9);
    doc.roundedRect(L, y, W, height, 5).fill(amber ? C.amberPale : C.pale);
    set(10, true, amber ? C.amber : C.green); doc.text(safeText(title), L + 13, y + 11, { width: W - 26, lineGap: 2 });
    set(9, false, C.text); doc.text(safeText(body), L + 13, y + 16 + titleHeight, { width: W - 26, lineGap: 2 }); y += height + 10;
  }
  function bullet(value, size = 9) {
    const height = h(value, W - 14, size); ensure(height + 6); set(size, true, C.green); doc.text('-', L, y, { width: 10 }); set(size, false); doc.text(safeText(value), L + 14, y, { width: W - 14, lineGap: 2 }); y += height + 6;
  }
  function rule() { doc.strokeColor(C.line).lineWidth(0.5).moveTo(L, y).lineTo(L + W, y).stroke(); y += 10; }

  page('CADRAGE ET HYPOTHÈSES');
  text('Étude préliminaire\ndes matériaux', { size: 28, bold: true, color: C.ink, gap: 9 });
  const dimensions = estimate.project_type === 'bathroom' ? ` - ${num(m.length_m)} × ${num(m.width_m)} m` : '';
  text(`${project}${dimensions}`, { size: 15, bold: true, color: C.green, gap: 8 });
  text(`${stamp} (Europe/Paris)  |  Réf. ${reference}`, { size: 8, color: C.muted, gap: 15 });
  const priceY = y;
  doc.roundedRect(L, priceY, W, 78, 7).fill(C.ink);
  set(9, true, '#C4E3D4'); doc.text(partial ? 'SOUS-TOTAL CONNU - ÉTUDE PARTIELLE' : 'TOTAL DES MATÉRIAUX SÉLECTIONNÉS', L + 16, priceY + 14, { width: W - 32 });
  set(25, true, C.white); doc.text(money(partial ? estimate.known_subtotal_eur : estimate.total_eur), L + 16, priceY + 34, { width: 245 });
  set(8, false, C.white); doc.text(partial ? 'Total du périmètre non déterminé.\nLes postes non chiffrés restent à compléter.' : 'Prix relevés, conditionnements entiers.\nCe montant ne couvre pas une rénovation complète.', L + 266, priceY + 40, { width: W - 282, lineGap: 3 });
  y += 94;

  const metrics = estimate.project_type === 'bathroom'
    ? [['Sol brut', `${num(m.floor_area_m2)} m²`], ['Murs bruts', `${num(m.gross_wall_area_m2)} m²`], ['Périmètre', `${num(m.perimeter_m)} m`]]
    : estimate.project_type === 'tiling'
      ? [['Surface', `${num(m.surface_m2)} m²`], ['Avec marge', `${num(m.surface_with_margin_m2)} m²`], ['Marge', `${num(m.margin_pct)} %`]]
      : [['Murs bruts', `${num(m.gross_wall_area_m2)} m²`], ['Murs nets', `${num(m.net_wall_area_m2)} m²`], ['Hauteur', `${num(m.height_m)} m`]];
  for (const [i, [label, value]] of metrics.entries()) {
    const x = L + i * (W + 12) / 3, width = (W - 24) / 3;
    doc.roundedRect(x, y, width, 55, 4).fill(C.pale); set(8, false, C.muted); doc.text(label, x + 11, y + 10, { width: width - 22 }); set(17, true, C.ink); doc.text(value, x + 11, y + 26, { width: width - 22 });
  }
  y += 72;
  heading('01', 'Données et hypothèses');
  const origins = (estimate.assumption_origins ?? []).filter(item => fieldName[item.field]);
  if (origins.length) {
    text('« Transmis » désigne une valeur reçue par le calculateur, sans validation sur place. « Hypothèse » désigne un défaut annoncé et modifiable.', { size: 8.5, color: C.muted, gap: 8 });
    const cols = [L, L + 137, L + 389];
    for (const [index, item] of origins.entries()) {
      const value = fieldValue(item), height = Math.max(22, h(value, 242, 8.5) + 9, h(fieldName[item.field], 129, 8.5) + 9); ensure(height);
      if (index % 2 === 0) doc.rect(L, y, W, height).fill(C.pale);
      set(8.5, false); doc.text(fieldName[item.field], cols[0] + 6, y + 5, { width: 125, lineGap: 2 });
      set(8.5, true); doc.text(safeText(value), cols[1], y + 5, { width: 242, lineGap: 2 });
      set(8, false, item.origin === 'default' ? C.amber : C.green); doc.text(item.origin === 'default' ? 'Hypothèse' : item.origin === 'derived' ? 'Calculé' : 'Transmis', cols[2], y + 6, { width: 108 }); y += height;
    }
    y += 8;
  } else {
    for (const item of (estimate.assumptions ?? []).slice(0, 5)) bullet(item, 9);
  }
  if (estimate.project_type === 'bathroom') text('Sans relevé des ouvertures ou du receveur, aucune déduction n’est appliquée. Cela ne signifie pas que ces éléments sont absents. Les références proposées sont détaillées aux pages suivantes.', { size: 8.5, color: C.muted, gap: 0 });
  if (partial) for (const component of estimate.unpriced_components ?? []) callout(`${sectionName[component.section] ?? component.section} : non chiffré`, component.reason, true);

  page('QUANTITÉS ET BUDGET');
  heading('02', 'Liste des matériaux');
  text('Les quantités d’achat sont arrondies au conditionnement de vente. Le prix unitaire correspond au carton, au lot ou à la pièce décrits ci-dessous.', { size: 9, color: C.muted, gap: 13 });
  const widths = [193, 56, 109, 73, W - 431];
  const xs = [L]; for (let i = 0; i < widths.length - 1; i++) xs.push(xs[i] + widths[i]);
  function tableHeader() {
    doc.rect(L, y, W, 31).fill(C.ink);
    ['Matériau', 'Achats', 'Conditionnement', 'Prix / achat', 'Sous-total'].forEach((label, i) => { set(8, true, C.white); doc.text(label, xs[i] + 7, y + 10, { width: widths[i] - 14, align: i >= 3 ? 'right' : 'left' }); }); y += 31;
  }
  tableHeader();
  for (const [index, item] of estimate.lines.entries()) {
    const label = `${item.name}\n${category[item.category] ?? ''}${item.section ? ` / ${sectionName[item.section] ?? item.section}` : ''}`;
    const pack = safeText(item.pack_label || `${num(item.units_per_pack)} unité(s)`);
    const height = Math.max(h(label, widths[0] - 14, 8.5), h(pack, widths[2] - 14, 8.5), 28) + 20;
    if (y + height > BOTTOM - 85) { page('QUANTITÉS ET BUDGET - SUITE'); tableHeader(); }
    if (index % 2 === 0) doc.rect(L, y, W, height).fill(C.pale);
    set(8.5, false); doc.text(safeText(label), xs[0] + 7, y + 10, { width: widths[0] - 14, lineGap: 2 });
    set(11, true, C.ink); doc.text(num(item.packs, 0), xs[1] + 7, y + 10, { width: widths[1] - 14 });
    set(8.5, false); doc.text(pack, xs[2] + 7, y + 10, { width: widths[2] - 14, lineGap: 2 });
    set(8.5, false); doc.text(money(item.price_per_pack?.amount), xs[3] + 4, y + 10, { width: widths[3] - 11, align: 'right' });
    set(9, true); doc.text(money(item.total_eur), xs[4] + 4, y + 10, { width: widths[4] - 11, align: 'right' }); y += height;
  }
  y += 11;
  text(`${partial ? 'Sous-total connu' : 'Total sélection'} : ${money(partial ? estimate.known_subtotal_eur : estimate.total_eur)}`, { size: 16, bold: true, color: C.green, gap: 7 });
  if (partial) text('Le total complet reste inconnu : ne pas utiliser ce sous-total comme budget de l’ensemble du projet.', { size: 9, color: C.amber, gap: 10 });
  else if (estimate.components?.floor && estimate.components?.walls) text(`Sol : ${money(estimate.components.floor.total_eur)}  |  Murs : ${money(estimate.components.walls.total_eur)}`, { size: 9, color: C.muted, gap: 10 });
  const recommended = estimate.lines.filter(item => item.price_per_pack?.basis === 'retailer_recommended');
  if (recommended.length) text('Prix conseillé à confirmer : ' + recommended.map(item => `${category[item.category] ?? item.name} (${money(item.price_per_pack.amount)} par achat)`).join(', ') + '.', { size: 8.5, color: C.amber, gap: 10 });
  if (estimate.budget?.status !== 'not_provided' && estimate.budget?.amount_eur !== undefined) text(`Budget transmis : ${money(estimate.budget.amount_eur)}. ${estimate.budget.status === 'cannot_determine' ? 'Comparaison impossible tant que le périmètre reste incomplet.' : estimate.budget.status === 'within_budget' ? 'La sélection chiffrée est dans cette enveloppe ; les exclusions restent à financer.' : 'La sélection chiffrée dépasse cette enveloppe.'}`, { size: 9, gap: 10 });
  rule();
  heading('03', 'Ce que représentent les quantités');
  for (const item of estimate.lines) {
    const unit = item.required_unit === 'm2' ? 'm²' : 'pièce(s)';
    const coverage = item.coverage_purchased_m2 != null ? `, couvrant ${num(item.coverage_purchased_m2)} m²` : '';
    bullet(`${category[item.category] ?? item.name} : besoin calculé ${num(item.required_quantity)} ${unit} ; achat de ${num(item.packs, 0)} conditionnement(s)${coverage}.`, 8.5);
  }
  text('Méthode : surfaces et marge calculées en code, arrondi au supérieur par conditionnement ; ossature calculée par pan. Les rails et montants ne sont pas déduits comme une simple surface.', { size: 8.5, color: C.muted, gap: 0 });

  page('LIMITES ET RÉFÉRENCES');
  heading('04', 'À confirmer avant tout achat');
  callout('Hydrofuge H1 ne signifie pas étanchéité complète', 'La protection des zones exposées, les joints, pieds, traversées et accessoires doivent être définis dans un système adapté. Ce rapport ne valide ni le support, ni le plan de pose, ni la conformité de l’ouvrage.', true);
  const exclusions = [
    'Matériaux principaux sélectionnés uniquement. Main-d’œuvre, livraison, outils, consommables et disponibilité ne sont pas inclus ou vérifiés.',
    'Colle, joints, primaire, protections à l’eau, fixations, vis, bandes, enduits et finitions non sélectionnés restent à chiffrer.',
    ...(estimate.project_type === 'bathroom' ? [
      'Sanitaires, plomberie, électricité, ventilation et dépose ne sont pas chiffrés. Aucun carrelage dans un receveur n’est prescrit.',
      'Le gabarit de doublage est limité à 2,50 m et à une finition légère. Une finition murale carrelée ou une autre hauteur demande un système à confirmer.',
    ] : []),
    'Dimensions, ouvertures, implantation, assemblage fabricant et performances attendues doivent être vérifiés. Aucun achat ni paiement n’a été effectué.',
  ];
  for (const value of exclusions) bullet(value, 8.5);
  text('Prix relevés à une date donnée, sans garantie de prix en caisse. Les fiches ci-dessous sont cliquables ; vérifier le prix, le magasin et les stocks avant achat.', { size: 8.5, color: C.muted, gap: 10 });
  heading('05', 'Sources et prix datés');
  function source(title, detail, url) {
    const valid = https(url), height = h(title, W, 8.7, true) + h(detail, W, 8) + 8;
    ensure(height); set(8.7, true, valid ? C.green : C.text); doc.text(safeText(title), L, y, { width: W, lineGap: 2, ...(valid ? { link: valid, underline: true } : {}) }); y += h(title, W, 8.7, true) + 2;
    set(8, false, C.muted); doc.text(safeText(detail), L, y, { width: W, lineGap: 2 }); y += h(detail, W, 8) + 6;
  }
  for (const [index, item] of estimate.lines.entries()) {
    const price = item.price_per_pack ?? {}, product = catalog?.products?.find(candidate => candidate.id === item.product_id);
    source(`${index + 1}. ${item.name}`, `${price.seller ?? product?.seller ?? 'Fournisseur'} | relevé du ${dateOnly(price.snapshot_date ?? estimate.catalogue_snapshot_date)} | ${money(price.amount)} / achat${price.basis === 'retailer_recommended' ? ' - prix conseillé' : ''}`, price.source_url ?? product?.source_url);
  }
  const seen = new Set(estimate.lines.map(item => https(item.price_per_pack?.source_url)).filter(Boolean));
  const ruleSources = (estimate.sources ?? []).filter(item => { const url = https(item.url); if (!url || seen.has(url)) return false; seen.add(url); return true; });
  if (ruleSources.length) {
    y += 2;
    for (const item of ruleSources) source(item.title, `Référence documentaire vérifiée le ${dateOnly(item.checked_on)}.`, item.url);
  }
  text(`Traçabilité : calculateur déterministe, règle ${estimate.rule_id ?? 'non renseignée'} ; catalogue du ${dateOnly(estimate.catalogue_snapshot_date)}. Le PDF reproduit le résultat structuré de l’outil, sans rédaction ni calcul par le modèle.`, { size: 7.5, color: C.muted, gap: 0 });

  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i); doc.strokeColor(C.line).lineWidth(0.6).moveTo(L, 802).lineTo(L + W, 802).stroke();
    set(7, false, C.muted); doc.text(`Étude préliminaire - Réf. ${reference}`, L, 812, { width: W - 60, lineBreak: false });
    doc.text(`${i + 1} / ${pages.count}`, L + W - 50, 812, { width: 50, align: 'right', lineBreak: false });
  }
  doc.end();
  return result;
}

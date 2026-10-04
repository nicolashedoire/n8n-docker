/** Deterministic procurement estimates. This module performs no I/O or model calls. */
const PROJECTS = ['tiling', 'partition', 'lining'];
const ROOMS = ['dry', 'wet', 'unknown'];
const PRODUCT_FIELDS = ['tile', 'board', 'rail', 'stud', 'insulation'];
const INPUT_FIELDS = ['project_type', 'room_type', 'room_usage', 'water_exposure', 'surface_m2', 'wall_lengths_m', 'height_m',
  'openings', 'margin_pct', 'stud_spacing_m', 'framing_system', 'wall_finish', 'layers', 'faces', 'include_insulation', 'product_ids', 'budget_eur'];
const LABELS = {
  project_type: 'S’agit-il de carrelage, d’une cloison non porteuse ou d’un doublage ?',
  room_type: 'La pièce est-elle sèche ou humide ?',
  room_usage: 'S’agit-il d’une salle de bains privative, ou d’un autre local humide (usage public, piscine) ?',
  water_exposure: 'La zone est-elle hors projection directe de douche, dans la douche ou dans un receveur ?',
  surface_m2: 'Quelle surface faut-il carreler, en mètres carrés ?',
  wall_lengths_m: 'Quelles sont les longueurs de chaque pan, en mètres ?',
  height_m: 'Quelle est la hauteur des pans, en mètres ?',
  openings: 'Y a-t-il des portes ou fenêtres ? Indiquez leur pan (wall_index à partir de 0), largeur et hauteur ; sinon [] .',
  margin_pct: 'Quelle marge de découpes et pertes souhaitez-vous, de 0 à 30 % ?',
  stud_spacing_m: 'Quel entraxe des montants est prévu par le système, en mètres (au maximum 0,60 m) ?',
  framing_system: 'Quel système de cloison ou doublage est confirmé ? Utiliser l’identifiant indiqué par les règles.',
  wall_finish: 'La cloison reçoit-elle une finition légère (peinture/papier), du carrelage ou un autre revêtement lourd ?',
  product_ids: 'Quelles références du catalogue faut-il chiffrer ?',
};
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const absent = value => value === undefined || value === null || value === '';
const finite = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const round = (number, digits = 3) => Math.round((number + Number.EPSILON) * 10 ** digits) / 10 ** digits;
// Tolerance only removes binary floating-point noise near an integer, not material quantities.
const ceil = value => Math.ceil(value - 1e-10);

function information(fields, extra = {}) {
  const missing_fields = [...new Set(fields)];
  return { status: 'needs_information', missing_fields,
    questions: missing_fields.map(field => ({ field, question: LABELS[field] ?? `Préciser ${field}.` })), ...extra };
}
function unsupported(reason, extra = {}) {
  return { status: 'unsupported', reason, ...extra };
}
function invalid(issues) { return { status: 'invalid_input', issues }; }

export function selectRules(input, rulesDocument) {
  if (!object(input)) return invalid([{ field: 'body', message: 'Objet JSON requis.' }]);
  const unknown = Object.keys(input).filter(key => !['project_type', 'room_type'].includes(key));
  if (unknown.length) return invalid(unknown.map(field => ({ field, message: 'Champ non accepté par cet outil.' })));
  if (absent(input.project_type)) return information(['project_type'], { supported_scopes: PROJECTS });
  if (!PROJECTS.includes(input.project_type)) return unsupported('Ce type de projet n’est pas chiffré : plafonds, structure et cas complexes hors périmètre.', { supported_scopes: PROJECTS });
  const available = (rulesDocument?.rules ?? []).filter(rule => rule.project_type === input.project_type);
  if (absent(input.room_type) || input.room_type === 'unknown') return information(['room_type'], { supported_scopes: available, assumptions: [] });
  if (!ROOMS.includes(input.room_type)) return invalid([{ field: 'room_type', message: 'Valeur attendue : dry, wet ou unknown.' }]);
  const rule = available.find(rule => rule.room_type === input.room_type);
  if (!rule) return unsupported('Aucune règle sourcée du catalogue ne couvre cette combinaison projet/pièce.', { supported_scopes: available });
  const required = [...new Set([...(rule.required_fields ?? []), ...(input.room_type === 'wet' ? ['room_usage', 'water_exposure'] : [])])];
  return { status: rule.status, rule_id: rule.id, project_type: rule.project_type, room_type: rule.room_type,
    required_fields: required, questions: required.map(field => ({ field, question: LABELS[field] ?? `Préciser ${field}.` })),
    framing: rule.framing ?? null, assumptions: rule.assumptions ?? [], limitations: rule.limitations ?? [],
    supported_scopes: rule.supported_scopes ?? available.map(item => ({ project_type: item.project_type, room_type: item.room_type, status: item.status })),
    sources: rule.sources ?? [], reason: rule.reason ?? null,
    input_contract: {
      project_type: PROJECTS, room_type: ['dry', 'wet'], room_usage_for_wet: ['private_bathroom'],
      water_exposure_for_wet: ['outside_direct_spray'], wall_finish_for_partition: ['light'],
      units: { lengths: 'm', area: 'm2', margin_pct: 'percent 0..30', budget_eur: 'EUR' },
      openings: 'Array<{wall_index: integer from 0, width_m: number, height_m: number}>; [] means no opening',
      product_ids: input.project_type === 'tiling' ? { tile: 'catalogue ID' } : { board: 'catalogue ID', rail: 'catalogue ID', stud: 'catalogue ID', insulation: 'optional catalogue ID' },
      recommended_parameters: rule.framing ? { framing_system: rule.framing.system, stud_spacing_m: rule.framing.max_stud_spacing_m, layers: 1, faces: rule.framing.faces } : null,
      note: 'Recommended parameters describe only this bounded procurement estimator, not approval of an installed building system.',
    } };
}

function publicPrice(product, catalogDate) {
  const amount = product.price?.amount;
  const available = finite(amount, 0, 1_000_000) && product.price?.currency === 'EUR' && product.price?.unit === 'pack'
    && Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6;
  return { amount: available ? amount : null, unit: 'pack', currency: 'EUR',
    status: available ? 'catalog_snapshot' : 'unavailable',
    snapshot_date: product.snapshot_date ?? catalogDate ?? null, source_url: product.source_url ?? null };
}

function line(product, packs, requiredUnits, unit, basis, catalogDate) {
  const price = publicPrice(product, catalogDate);
  const cents = price.amount === null ? null : Math.round(price.amount * 100) * packs;
  return { product_id: product.id, name: product.name, category: product.category,
    required_quantity: round(requiredUnits, 4), required_unit: unit, packs,
    purchased_units: packs * product.pack.quantity,
    coverage_purchased_m2: product.pack.coverage_m2 ? round(packs * product.pack.coverage_m2, 4) : null,
    price_per_pack: price, total_eur: cents === null ? null : cents / 100, calculation: basis };
}

function totals(lines, budget) {
  const knownCents = lines.reduce((sum, item) => sum + (item.total_eur === null ? 0 : Math.round(item.total_eur * 100)), 0);
  const unknown = lines.filter(item => item.total_eur === null).map(item => item.product_id);
  const complete = unknown.length === 0;
  const total = complete ? knownCents / 100 : null;
  return { currency: 'EUR', total_eur: total, known_subtotal_eur: knownCents / 100,
    pricing_status: complete ? 'snapshot_complete' : 'snapshot_partial', missing_prices: unknown,
    budget: absent(budget) ? { status: 'not_provided' } : {
      amount_eur: budget,
      status: !complete ? 'cannot_determine' : total <= budget ? 'within_budget' : 'over_budget',
      difference_eur: complete ? (Math.round(budget * 100) - knownCents) / 100 : null,
    }, exclusions: ['Livraison et disponibilité non vérifiées.', 'Main-d’œuvre, outils et consommables non sélectionnés exclus.',
      'Prix relevés à une date donnée, sans garantie de prix en caisse.'] };
}

/** Returns a tool-friendly business result, including precise questions when data is absent. */
export function estimate(input, catalog, rulesDocument) {
  if (!object(input)) return invalid([{ field: 'body', message: 'Objet JSON requis.' }]);
  const unexpected = Object.keys(input).filter(key => !INPUT_FIELDS.includes(key));
  if (unexpected.length) return invalid(unexpected.map(field => ({ field, message: 'Champ non accepté ; unités uniquement en mètres, m² et euros.' })));
  const missing = [];
  const issues = [];
  if (absent(input.project_type)) missing.push('project_type');
  else if (!PROJECTS.includes(input.project_type)) return unsupported('Plafonds, ouvrages porteurs, double ossature et systèmes complexes ne sont pas dimensionnés.');
  if (absent(input.room_type) || input.room_type === 'unknown') missing.push('room_type');
  else if (!ROOMS.includes(input.room_type)) issues.push({ field: 'room_type', message: 'Valeur attendue : dry ou wet.' });
  if (input.room_type === 'dry' && (
    ['private_bathroom', 'public_wet_room', 'swimming_pool'].includes(input.room_usage)
    || ['direct_shower_spray', 'shower_tray'].includes(input.water_exposure)
  )) return invalid([{ field: 'room_type', message: 'Données contradictoires : un usage humide ou une exposition directe à l’eau ne peut pas être déclaré dry. Clarifier la pièce et son exposition avant chiffrage.' }]);
  if (input.room_type === 'wet') {
    if (absent(input.room_usage) || input.room_usage === 'unknown') missing.push('room_usage');
    else if (input.room_usage !== 'private_bathroom') return unsupported('Seule une salle de bains privative explicitement identifiée peut utiliser les règles humides de ce prototype.');
    if (absent(input.water_exposure) || input.water_exposure === 'unknown') missing.push('water_exposure');
    else if (input.water_exposure !== 'outside_direct_spray') return unsupported('Les projections directes de douche, receveurs et zones d’exposition à l’eau non confirmées sont hors du périmètre de ce calcul.');
  }
  if (absent(input.margin_pct)) missing.push('margin_pct');
  else if (!finite(input.margin_pct, 0, 30)) issues.push({ field: 'margin_pct', message: 'Marge numérique de 0 à 30 % requise.' });
  if (!absent(input.budget_eur) && (!finite(input.budget_eur, 0, 1_000_000) || Math.abs(input.budget_eur * 100 - Math.round(input.budget_eur * 100)) > 1e-6))
    issues.push({ field: 'budget_eur', message: 'Budget positif ou nul en euros, avec au maximum deux décimales.' });
  if (absent(input.product_ids)) missing.push('product_ids');
  else if (!object(input.product_ids) || Object.keys(input.product_ids).some(key => !PRODUCT_FIELDS.includes(key)) || Object.values(input.product_ids).some(id => typeof id !== 'string' || !id.trim()))
    issues.push({ field: 'product_ids', message: 'Objet de références exactes du catalogue : tile, board, rail, stud, insulation.' });
  if (issues.length) return invalid(issues);
  if (missing.length) return information(missing);
  const policy = selectRules({ project_type: input.project_type, room_type: input.room_type }, rulesDocument);
  if (policy.status !== 'allowed') {
    if (policy.status === 'needs_information') return information(policy.required_fields?.length ? policy.required_fields : ['framing_system'], { rules: policy,
      reason: policy.reason ?? 'Le système et son implantation doivent être validés avant chiffrage.' });
    return unsupported(policy.reason ?? 'Aucune règle autorisée ne couvre ce cas.', { rules: policy });
  }
  const missingPolicyFields = policy.required_fields.filter(field => absent(input[field]) && !['layers', 'faces'].includes(field));
  if (missingPolicyFields.length) return information(missingPolicyFields, { rules: policy });
  const required = input.project_type === 'tiling' ? ['tile'] : ['board', 'rail', 'stud'];
  if (input.include_insulation !== undefined && typeof input.include_insulation !== 'boolean') return invalid([{ field: 'include_insulation', message: 'Booléen requis.' }]);
  if (input.include_insulation === false && input.product_ids.insulation) return invalid([{ field: 'product_ids.insulation', message: 'Contradiction : une référence isolante est fournie alors que include_insulation vaut false.' }]);
  const includeInsulation = input.include_insulation === true || Boolean(input.product_ids.insulation);
  if (includeInsulation && input.project_type !== 'tiling') required.push('insulation');
  const irrelevant = Object.keys(input.product_ids).filter(key => !required.includes(key));
  if (irrelevant.length) return invalid(irrelevant.map(key => ({ field: `product_ids.${key}`, message: 'Référence non utilisée par ce type de calcul.' })));
  const absentProducts = required.filter(key => !input.product_ids[key]);
  if (absentProducts.length) return information(absentProducts.map(key => `product_ids.${key}`), { questions: absentProducts.map(key => ({ field: `product_ids.${key}`, question: `Quelle référence ${key} du catalogue faut-il utiliser ?` })) });
  const selected = {};
  for (const key of required) {
    const product = catalog?.products?.find(item => item.id === input.product_ids[key]);
    if (!product || product.category !== key) return invalid([{ field: `product_ids.${key}`, message: 'Référence absente du catalogue ou catégorie incorrecte.' }]);
    if (!product.compatible_uses?.includes(input.project_type)) return unsupported(`La référence ${product.id} n’est pas validée pour ce type de projet.`);
    if (!Number.isInteger(product.pack?.quantity) || product.pack.quantity < 1) return unsupported(`Conditionnement non exploitable pour ${product.id}.`);
    if (input.room_type === 'wet' && !product.metadata?.room_types?.includes('wet')) return unsupported(`Usage en pièce humide non confirmé pour ${product.id}.`);
    selected[key] = product;
  }
  const factor = 1 + input.margin_pct / 100;
  const assumptions = [...policy.assumptions, 'Calcul d’approvisionnement indicatif ; le plan de pose et le système complet restent à vérifier.'];
  const limitations = [...policy.limitations];
  const lines = [];
  let measurements;
  if (input.project_type === 'tiling') {
    const irrelevant = ['wall_lengths_m', 'height_m', 'openings', 'stud_spacing_m', 'framing_system', 'wall_finish', 'layers', 'faces', 'include_insulation'].filter(key => input[key] !== undefined);
    if (irrelevant.length) return invalid(irrelevant.map(field => ({ field, message: 'Champ de cloison/doublage non utilisé pour un carrelage.' })));
    if (absent(input.surface_m2)) return information(['surface_m2']);
    if (!finite(input.surface_m2, 0.01, 10_000)) return invalid([{ field: 'surface_m2', message: 'Surface numérique en m², entre 0,01 et 10 000.' }]);
    const tile = selected.tile;
    if (!finite(tile.pack.coverage_m2, 0.0001, 10_000)) return unsupported('Surface couverte par carton non vérifiée pour cette référence.');
    const withMargin = input.surface_m2 * factor;
    const packs = ceil(withMargin / tile.pack.coverage_m2);
    lines.push(line(tile, packs, withMargin, 'm2', `ceil(surface_m2 × (1 + marge/100) / couverture_m2_par_carton) = ${packs}`, catalog.snapshot_date));
    measurements = { surface_m2: input.surface_m2, margin_pct: input.margin_pct, surface_with_margin_m2: round(withMargin, 4) };
    limitations.push('Colle, joints, primaire, étanchéité, profils et plinthes ne sont pas chiffrés.', 'Le calepinage, les découpes et le support peuvent nécessiter davantage de matière.');
  } else {
    if (absent(input.wall_finish) || input.wall_finish === 'unknown') return information(['wall_finish']);
    if (input.wall_finish !== 'light') return unsupported('Le système simple à entraxe 600 ne couvre pas ici les revêtements lourds ou carrelés : système, format, masse et entraxe à confirmer.');
    if (input.surface_m2 !== undefined) return invalid([{ field: 'surface_m2', message: 'Fournir les dimensions de chaque pan ; une surface seule ne dimensionne pas l’ossature.' }]);
    if (input.layers !== undefined && input.layers !== 1) return unsupported('Seul un parement simple, une couche par face, est couvert.');
    const faces = input.project_type === 'partition' ? 2 : 1;
    if (input.faces !== undefined && input.faces !== faces) return invalid([{ field: 'faces', message: `Ce projet impose ${faces} face(s) ; ne pas modifier ce facteur.` }]);
    for (const field of ['wall_lengths_m', 'height_m', 'openings', 'stud_spacing_m', 'framing_system']) if (absent(input[field])) missing.push(field);
    if (missing.length) return information(missing, { rules: policy });
    if (!Array.isArray(input.wall_lengths_m) || !input.wall_lengths_m.length || input.wall_lengths_m.length > 50 || input.wall_lengths_m.some(length => !finite(length, 0.05, 100)))
      issues.push({ field: 'wall_lengths_m', message: 'De 1 à 50 longueurs numériques en mètres, entre 0,05 et 100.' });
    if (!finite(input.height_m, 0.1, 2.5)) return unsupported('Hauteur hors périmètre : maximum 2,50 m et minimum 0,10 m.');
    if (!finite(input.stud_spacing_m, 0.1, 0.6)) issues.push({ field: 'stud_spacing_m', message: 'Entraxe numérique entre 0,10 et 0,60 m, conforme au système choisi.' });
    const framing = policy.framing;
    if (!framing || typeof input.framing_system !== 'string' || input.framing_system !== framing.system)
      return unsupported('Système d’ossature non confirmé par une règle sourcée.', { rules: policy });
    if (framing.faces !== faces || framing.layers !== 1 || !finite(framing.max_height_m, 0.1, 2.5) || !finite(framing.max_stud_spacing_m, 0.1, 0.6))
      return unsupported('Règle d’ossature insuffisante pour ce calcul.');
    if (input.height_m > framing.max_height_m || input.stud_spacing_m > framing.max_stud_spacing_m)
      return unsupported('Hauteur ou entraxe au-delà des limites du système confirmé.', { rules: policy });
    if (!Array.isArray(input.openings) || input.openings.length > 100) issues.push({ field: 'openings', message: 'Liste de 0 à 100 ouvertures requise.' });
    if (issues.length) return invalid(issues);
    for (const key of ['board', 'rail', 'stud']) {
      if (!selected[key].metadata?.framing_systems?.includes(input.framing_system)) return unsupported(`Compatibilité du produit ${selected[key].id} avec le système non confirmée ; ne pas transposer une règle à des marques mixtes.`);
    }
    if (input.room_type === 'wet' && selected.board.metadata?.moisture_resistance !== 'H1') return unsupported('Le parement de la salle de bains privative doit être explicitement classé H1 dans ce catalogue.');
    const board = selected.board, rail = selected.rail, stud = selected.stud;
    if (!finite(board.pack.width_m, 0.1, 3) || !finite(board.pack.height_m, input.height_m, 5)
      || !finite(rail.pack.length_m, 0.1, 20) || !finite(stud.pack.length_m, input.height_m, 5))
      return unsupported('Dimensions de vente absentes ou insuffisantes : pas de raccord vertical de plaque ou montant calculé.');
    const boardArea = board.pack.width_m * board.pack.height_m;
    if (board.pack.coverage_m2 !== undefined && Math.abs(board.pack.coverage_m2 - boardArea * board.pack.quantity) > 1e-5)
      return unsupported('Surface du paquet de plaques incohérente avec ses dimensions.');
    const openingAreas = input.wall_lengths_m.map(() => 0);
    const openingWidths = input.wall_lengths_m.map(() => 0);
    const openingCounts = input.wall_lengths_m.map(() => 0);
    for (let i = 0; i < input.openings.length; i++) {
      const opening = input.openings[i];
      if (!object(opening) || Object.keys(opening).some(key => !['wall_index', 'width_m', 'height_m'].includes(key))
        || !Number.isInteger(opening.wall_index) || opening.wall_index < 0 || opening.wall_index >= input.wall_lengths_m.length
        || !finite(opening.width_m, 0.01, 100) || !finite(opening.height_m, 0.01, input.height_m)) {
        issues.push({ field: `openings[${i}]`, message: 'Pan valide (index à partir de 0), largeur et hauteur positives, hauteur ≤ mur.' }); continue;
      }
      const wall = opening.wall_index;
      if (opening.width_m > input.wall_lengths_m[wall]) issues.push({ field: `openings[${i}].width_m`, message: 'Largeur supérieure au pan.' });
      openingAreas[wall] += opening.width_m * opening.height_m;
      openingWidths[wall] += opening.width_m;
      openingCounts[wall]++;
    }
    for (let wall = 0; wall < input.wall_lengths_m.length; wall++) {
      if (openingAreas[wall] >= input.wall_lengths_m[wall] * input.height_m - 1e-10 || openingWidths[wall] > input.wall_lengths_m[wall] + 1e-10)
        issues.push({ field: `openings.wall_${wall}`, message: 'Ouvertures incompatibles avec ce pan : surface ou largeur cumulée excessive. Les ouvertures superposées et leur implantation ne sont pas modélisées.' });
    }
    if (issues.length) return invalid(issues);
    const grossArea = input.wall_lengths_m.reduce((sum, length) => sum + length * input.height_m, 0);
    const removedArea = openingAreas.reduce((sum, area) => sum + area, 0);
    const netArea = grossArea - removedArea;
    const boardSurface = netArea * faces * factor;
    const surfaceBoards = ceil(boardSurface / boardArea);
    const geometricBoards = input.wall_lengths_m.reduce((sum, length) => sum + ceil(length / board.pack.width_m) * faces, 0);
    const boardUnits = Math.max(surfaceBoards, geometricBoards);
    lines.push(line(board, ceil(boardUnits / board.pack.quantity), boardUnits, 'piece',
      `max(ceil(surface_nette × ${faces} faces × marge / surface_plaque), somme ceil(longueur_pan / largeur_plaque) × ${faces}) = ${boardUnits}`, catalog.snapshot_date));
    const baseRailUnits = input.wall_lengths_m.reduce((sum, length) => sum + 2 * ceil(length / rail.pack.length_m), 0);
    const railUnits = ceil(baseRailUnits * factor);
    lines.push(line(rail, ceil(railUnits / rail.pack.quantity), railUnits, 'piece',
      `ceil(somme 2 × ceil(longueur_pan / longueur_rail) × marge) = ${railUnits} ; ouvertures non déduites`, catalog.snapshot_date));
    const studUnitsByWall = input.wall_lengths_m.map((length, i) => ceil(length / input.stud_spacing_m) + 1 + 2 * openingCounts[i]);
    const studUnits = ceil(studUnitsByWall.reduce((sum, count) => sum + count, 0) * factor);
    lines.push(line(stud, ceil(studUnits / stud.pack.quantity), studUnits, 'piece',
      `ceil(somme (ceil(longueur_pan / entraxe) + 1 + 2 × ouvertures_pan) × marge) = ${studUnits}`, catalog.snapshot_date));
    if (includeInsulation) {
      const insulation = selected.insulation;
      const thickness = insulation.metadata?.thickness_mm;
      const railWidth = rail.metadata?.profile_width_mm;
      const studWidth = stud.metadata?.profile_width_mm;
      if (!finite(thickness, 1, 500) || !finite(railWidth, 1, 500) || !finite(studWidth, 1, 500)
        || thickness > Math.min(railWidth, studWidth)
        || !insulation.metadata?.framing_systems?.includes(input.framing_system))
        return unsupported('Épaisseur ou compatibilité de l’isolant non confirmée pour la largeur utile de cette ossature.');
      if (!finite(insulation.pack.coverage_m2, 0.0001, 1000)) return unsupported('Couverture du paquet isolant non vérifiée.');
      const insulationArea = netArea * factor;
      lines.push(line(insulation, ceil(insulationArea / insulation.pack.coverage_m2), insulationArea, 'm2',
        'ceil(surface_nette_de_cavité × marge / couverture_paquet), une seule cavité, pas une fois par face', catalog.snapshot_date));
    }
    measurements = { wall_lengths_m: input.wall_lengths_m, height_m: input.height_m, faces, layers: 1,
      gross_wall_area_m2: round(grossArea, 4), openings_area_m2: round(removedArea, 4), net_wall_area_m2: round(netArea, 4),
      board_area_with_margin_m2: round(boardSurface, 4), board_minimum_by_pan: geometricBoards,
      base_studs_by_wall: studUnitsByWall, stud_spacing_m: input.stud_spacing_m, margin_pct: input.margin_pct };
    assumptions.push('Plaques verticales de hauteur suffisante, sans raccord vertical ; minimum par largeur de pan sans réemploi idéal des découpes.',
      'Rails haut/bas comptés par pan sur les longueurs brutes ; aucun vide soustrait à l’ossature.',
      'Montants de rive comptés pour chaque pan, plus deux montants par ouverture ; la marge est ensuite appliquée.');
    limitations.push('Vis, bandes, enduits, fixations, joints, renforts et traverses complémentaires des ouvertures non chiffrés.',
      'Implantation des ouvertures, chevauchement, retours, angles et calepinage détaillé à vérifier.',
      'Ce calcul ne vérifie ni résistance mécanique, ni feu, ni performance acoustique ou thermique.');
    if (!includeInsulation) limitations.push('Isolation non incluse dans cette estimation.');
    if (input.room_type === 'wet') {
      assumptions.push('Le chiffrage retient H1 sur les deux faces comme choix conservateur ; ce n’est pas une obligation générale de traiter deux faces.');
      limitations.push('Une plaque H1 ne constitue pas un système d’étanchéité ; protection à l’eau et accessoires à confirmer.');
    }
  }
  return { status: 'ok', estimate_type: 'procurement_only', project_type: input.project_type, room_type: input.room_type,
    rule_id: policy.rule_id, measurements, lines, ...totals(lines, input.budget_eur), assumptions, limitations,
    sources: policy.sources, catalogue_snapshot_date: catalog.snapshot_date ?? null,
    no_order_placed: true, no_payment: true };
}

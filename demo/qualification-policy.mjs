/**
 * Facts-v2: small, deterministic business policy shared with generated n8n Code nodes.
 * Each exported function is self-contained so Function#toString can embed its exact
 * implementation in a node, without packages, network access or hidden state.
 * Evidence matching proves that text occurs in the source, not its semantic relevance.
 * It normalizes NFC, U+2018/U+2019 apostrophes to U+0027, case and whitespace only.
 * Numbers, words, other punctuation and accents are not corrected or paraphrased.
 */

export function validateExtraction(input, source) {
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const exactKeys = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
  const canonical = value => value.normalize('NFC').replace(/[‘’]/gu, "'").replace(/\s+/gu, ' ').trim().toLowerCase();
  const fields = ['need', 'budget', 'deadline', 'availability', 'product', 'problem'];
  if (typeof source !== 'string' || !source.trim()) throw new Error('Message source absent.');
  if (!exactKeys(input, ['category', 'facts'])) throw new Error('Extraction : champs inattendus ou absents.');
  if (!['devis', 'rendez_vous', 'support', 'autre'].includes(input.category)) throw new Error('Extraction : catégorie invalide.');
  if (!exactKeys(input.facts, fields)) throw new Error('Extraction : les six faits sont requis.');
  const message = canonical(source);
  const facts = {};
  for (const key of fields) {
    const value = input.facts[key];
    if (typeof value !== 'string' || value.length > 300) throw new Error(`Extraction : fait ${key} invalide.`);
    const normalized = value.normalize('NFC').replace(/\s+/gu, ' ').trim();
    if (value !== '' && !normalized) throw new Error(`Extraction : fait ${key} vide non canonique.`);
    if (normalized && !message.includes(canonical(normalized))) throw new Error(`Extraction : fait ${key} non attesté dans le message.`);
    facts[key] = normalized;
  }
  return { category: input.category, facts };
}

export function applyQualificationRules(extraction) {
  const requiredByCategory = {
    devis: ['need', 'budget', 'deadline'],
    rendez_vous: ['need', 'availability'],
    support: ['product', 'problem'],
    autre: ['need'],
  };
  const required = requiredByCategory[extraction?.category];
  const fields = ['need', 'budget', 'deadline', 'availability', 'product', 'problem'];
  if (!required || !extraction.facts || fields.some(key => typeof extraction.facts[key] !== 'string')) throw new Error('Extraction validée requise pour la qualification.');
  const facts = Object.fromEntries(fields.map(key => [key, extraction.facts[key]]));
  // Deliberately finite list of exact generic phrases. This is not a semantic classifier.
  // New vague expressions must be evaluated in the corpus, not guessed by a broad regex.
  const genericNeeds = new Set([
    'automatiser mon entreprise', 'automatisation de mon entreprise',
    'automatiser notre entreprise', 'automatisation de notre entreprise',
    'automatiser mon activité', 'automatiser notre activité',
    'mon entreprise', 'notre entreprise', 'mon activité', 'notre activité',
    'un devis', 'devis', 'des renseignements', 'renseignements',
    'des informations', 'informations', 'aide', 'bonjour',
  ]);
  const needKey = facts.need.replace(/\s+/gu, ' ').trim().toLowerCase().replace(/[.!?]+$/u, '');
  const ignored_generic_need = genericNeeds.has(needKey);
  if (ignored_generic_need) facts.need = '';
  const labels = {
    need: extraction.category === 'rendez_vous' ? 'Le sujet du rendez-vous' : 'Le besoin ou le périmètre précis',
    budget: 'Le budget disponible', deadline: 'L’échéance souhaitée',
    availability: 'Les disponibilités pour le rendez-vous',
    product: 'Le produit ou service concerné', problem: 'La description du problème',
  };
  const missing_fields = required.filter(key => facts[key] === '');
  return {
    category: extraction.category, facts, required_fields: [...required], missing_fields,
    missing_information: missing_fields.map(key => labels[key]), ignored_generic_need,
  };
}

export function composeAnalysis(qualification) {
  const categories = {
    devis: { summary: 'Demande de devis', acknowledgement: 'votre demande de devis' },
    rendez_vous: { summary: 'Demande de rendez-vous', acknowledgement: 'votre demande de rendez-vous' },
    support: { summary: 'Demande de support', acknowledgement: 'votre demande de support' },
    autre: { summary: 'Demande à examiner', acknowledgement: 'votre demande' },
  };
  const category = categories[qualification?.category];
  if (!category || !Array.isArray(qualification.required_fields) || !Array.isArray(qualification.missing_fields) || !Array.isArray(qualification.missing_information)) throw new Error('Qualification structurée requise pour le brouillon.');
  const labels = {
    need: qualification.category === 'rendez_vous' ? 'Sujet' : 'Besoin',
    budget: 'Budget', deadline: 'Échéance', availability: 'Disponibilités', product: 'Produit ou service', problem: 'Problème',
  };
  const questions = {
    need: qualification.category === 'rendez_vous'
      ? 'Quel sujet souhaitez-vous aborder lors du rendez-vous ?'
      : qualification.category === 'autre'
        ? 'Pouvez-vous préciser l’objet de votre demande ?'
        : 'Pouvez-vous préciser le besoin et le périmètre attendus ?',
    budget: 'Quel budget souhaitez-vous consacrer à ce projet ?',
    deadline: 'À quelle échéance souhaitez-vous aboutir ?',
    availability: 'Quelles sont vos disponibilités pour ce rendez-vous ?',
    product: 'Quel produit ou service est concerné ?',
    problem: 'Quel problème rencontrez-vous ?',
  };
  if (qualification.missing_fields.some(key => !Object.hasOwn(questions, key))) throw new Error('Code de précision inconnu.');
  const observed = qualification.required_fields.filter(key => qualification.facts[key] !== '')
    .map(key => `${labels[key]} : « ${qualification.facts[key]} ».`);
  const missing = qualification.missing_information.length
    ? ` Informations à préciser : ${qualification.missing_information.join(' ; ')}.` : '';
  const summary = `${category.summary}.${observed.length ? ' ' + observed.join(' ') : ''}${missing}`;
  // Only fixed provider-language templates enter the draft: never quote model/source text.
  const draft_reply = qualification.missing_fields.length
    ? `Bonjour,\n\nMerci pour ${category.acknowledgement}. Pour pouvoir l’étudier, nous avons besoin des précisions suivantes :\n\n${qualification.missing_fields.map(key => '- ' + questions[key]).join('\n')}\n\nCes précisions permettront d’examiner votre demande.\n\nCordialement.`
    : `Bonjour,\n\nNous avons bien reçu ${category.acknowledgement}. Les éléments transmis permettent d’étudier votre demande. Nous reviendrons vers vous après examen.\n\nCordialement.`;
  return { category: qualification.category, summary, missing_information: [...qualification.missing_information], draft_reply };
}

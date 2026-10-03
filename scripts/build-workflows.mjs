#!/usr/bin/env node
/**
 * Build the public, credential-free workflow. Optional local binding:
 * SHEETS_DOCUMENT_ID=... SHEETS_CREDENTIAL_ID=... node scripts/build-workflows.mjs --local
 * The private binding is written only to ignored local-files/02-qualification-ia.json.
 * The public export never reads a credential, sheet ID or private API URL from the environment.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const api = 'http://qualification-api:3000';
export const SHEET_COLUMNS = ['demande_id', 'date', 'prenom', 'nom', 'email', 'demande', 'categorie', 'resume', 'informations_manquantes', 'brouillon_reponse', 'statut', 'erreur', 'modele'];
const id = (name) => createHash('sha256').update(`atelier-qualification:${name}`).digest('hex').slice(0, 32);

export function buildWorkflow({ documentId = '', credentialId = '', sheetName = 'Qualification IA' } = {}) {
  const sheetsEnabled = Boolean(documentId && credentialId);
  const nodes = [];
  const connections = {};
  const add = (name, type, typeVersion, position, parameters, extra = {}) => {
    const n = { parameters, id: id(name), name, type: `n8n-nodes-base.${type}`, typeVersion, position, ...extra };
    nodes.push(n); return n;
  };
  const code = (name, position, jsCode, extra = {}) => add(name, 'code', 2, position, { jsCode }, extra);
  const connect = (from, to, output = 0) => {
    const outputs = (connections[from] ??= { main: [] }).main;
    while (outputs.length <= output) outputs.push([]);
    outputs[output].push({ node: to, type: 'main', index: 0 });
  };
  const http = (name, position, url, jsonBody, extra = {}) => add(name, 'httpRequest', 4.4, position, {
    method: 'POST', url, sendBody: true, specifyBody: 'json', jsonBody,
    options: { timeout: 15000, response: { response: { responseFormat: 'json' } } },
  }, { onError: 'continueErrorOutput', ...extra });
  const condition = (name, position, expression, expected, type = 'string') => add(name, 'if', 2.2, position, {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{ id: id(`${name}-condition`), leftValue: expression, rightValue: expected, operator: { type, operation: type === 'boolean' ? 'true' : 'equals', ...(type === 'boolean' ? { singleValue: true } : {}) } }],
      combinator: 'and',
    }, options: {},
  });
  const note = (name, position, width, height, content, color) => add(name, 'stickyNote', 1, position, { content, width, height, color });

  note('01 · Entrées', [-540, -420], 1030, 240,
    '## 1 · Recevoir et réserver\nFormulaire natif ou webhook de test → normalisation → validation côté API.\n\nUne réservation persistante identifie la demande. Un rejeu terminé reprend le résultat existant : aucun nouvel appel au modèle.', 5);
  note('02 · Qualification', [520, -420], 1080, 240,
    '## 2 · Qualifier avec un vrai LLM\nOllama local : catégorie, résumé, informations manquantes et brouillon.\n\n3 tentatives HTTP maximum, délai de 1 s, timeout de 120 s. JSON parsé et contrôlé dans n8n, puis validé indépendamment par le serveur.', 6);
  note('03 · Suivi humain', [1640, -420], 1330, 240,
    '## 3 · Conserver et présenter\nLe serveur conserve le résultat avant la synchronisation Google Sheets.\n\nLe brouillon attend toujours une lecture humaine. Informations manquantes → `needs_info`. Erreur technique → `technical_error`. Aucun envoi automatique.', 4);
  note('Configuration Google Sheets', [1910, 650], 850, 280,
    '### Google Sheets · branche facultative\nLe fichier public ne contient aucun identifiant de document ou de connexion.\n\nGénérer la copie locale avec `SHEETS_DOCUMENT_ID`, `SHEETS_CREDENTIAL_ID` et éventuellement `SHEETS_TAB_NAME`, puis `node scripts/build-workflows.mjs --local`.\n\nPréparer les colonnes indiquées dans le README. Le nœud natif ajoute ou met à jour la ligne par `demande_id`, en mode RAW. Sans connexion, le résultat reste disponible dans le suivi local.', 7);
  note('Scénarios contrôlés', [-540, 600], 990, 220,
    '### Démonstration des erreurs\nLe formulaire utilise le scénario normal. Pour le webhook, `scenario: "api_error"` injecte une panne HTTP ; `scenario: "invalid_json"` injecte une sortie de modèle invalide. Ces deux cas sont explicitement simulés.\n\nLa qualification normale appelle réellement le modèle. Données fictives pour la démonstration.', 3);

  add('Formulaire de contact', 'formTrigger', 2.6, [-500, -40], {
    authentication: 'none', formTitle: 'L’Atelier n8n · Votre demande',
    formDescription: 'Décrivez votre besoin. Une personne relira la réponse préparée avant tout envoi.',
    formFields: { values: [
      { fieldLabel: 'Prénom', fieldName: 'first_name', fieldType: 'text', requiredField: true },
      { fieldLabel: 'Nom', fieldName: 'last_name', fieldType: 'text', requiredField: true },
      { fieldLabel: 'E-mail', fieldName: 'email', fieldType: 'email', requiredField: true },
      { fieldLabel: 'Votre demande', fieldName: 'message', fieldType: 'textarea', requiredField: true },
    ] }, responseMode: 'onReceived', options: { path: 'atelier-qualification-form', buttonLabel: 'Transmettre ma demande',
      respondWithOptions: { values: { respondWith: 'text', formSubmittedText: 'Votre demande a été reçue. Elle va être analysée et relue par une personne.' } } },
  }, { webhookId: 'atelier-qualification-form' });
  add('Webhook de démonstration', 'webhook', 2.1, [-500, 240], {
    httpMethod: 'POST', path: 'atelier-qualification', responseMode: 'lastNode', responseData: 'firstEntryJson',
    options: {},
  }, { webhookId: 'atelier-qualification-webhook' });
  code('Normaliser la demande', [-240, 80], `
const raw = $input.first().json;
const source = raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body) ? raw.body : raw;
const text = value => typeof value === 'string' ? value.trim() : '';
const input = {
  first_name: text(source.first_name ?? source['Prénom'] ?? source.Name),
  last_name: text(source.last_name ?? source.Nom ?? source['Last Name']),
  email: text(source.email ?? source['E-mail'] ?? source.Email).toLowerCase(),
  message: text(source.message ?? source['Votre demande'] ?? source.Demand),
  scenario: text(source.scenario) || 'normal',
};
if (text(source.request_id)) input.request_id = text(source.request_id);
const issues = [];
if (!input.first_name || input.first_name.length > 100) issues.push('Prénom requis, 100 caractères maximum.');
if (!input.last_name || input.last_name.length > 100) issues.push('Nom requis, 100 caractères maximum.');
if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(input.email) || input.email.length > 254) issues.push('Adresse e-mail invalide.');
if (!input.message || input.message.length > 10000) issues.push('Demande requise, 10 000 caractères maximum.');
if (!['normal', 'api_error', 'invalid_json'].includes(input.scenario)) issues.push('Scénario inconnu.');
return [{ json: { valid: issues.length === 0, input, issues } }];`);
  condition('Entrée valide ?', [0, 80], '={{ $json.valid }}', true, 'boolean');
  code('Entrée à corriger', [220, 430], `return [{json:{ok:false,status:'invalid_input',issues:$input.first().json.issues}}];`);
  http('Réserver sans doublon', [250, 40], `${api}/requests/reserve`, '={{ $json.input }}');
  condition('Nouvelle tentative ?', [510, 40], '={{ $json.route }}', 'process');
  code('Résultat déjà disponible', [750, 390], `
const response = $input.first().json;
return [{json:{ok:true,route:'duplicate',request_id:response.request_id,record:response.record,message:'Demande déjà reçue : résultat existant, sans nouvel appel IA.'}}];`);
  code('Réservation refusée', [250, 620], `return [{json:{ok:false,status:'reservation_error',message:'Réservation impossible. Vérifier les données et la disponibilité du service ; aucune qualification lancée.'}}];`);

  const llm = http('Qualifier avec Ollama', [780, 0], `${api}/llm`,
    '={{ { message: $("Normaliser la demande").first().json.input.message, scenario: $("Normaliser la demande").first().json.input.scenario } }}',
    { retryOnFail: true, maxTries: 3, waitBetweenTries: 1000 });
  llm.parameters.options.timeout = 120000;
  code('Valider le JSON du modèle', [1050, -20], `
const response = $input.first().json;
const reservation = $('Réserver sans doublon').first().json;
const out = { attempt_token: reservation.attempt_token, metrics: response.metrics ?? {} };
try {
  if (typeof response.text !== 'string') throw new Error('Le modèle doit retourner un texte JSON.');
  const analysis = JSON.parse(response.text);
  const keys = ['category', 'summary', 'missing_information', 'draft_reply'];
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis) || Object.keys(analysis).sort().join('|') !== keys.sort().join('|')) throw new Error('Champs JSON inattendus ou absents.');
  if (!['devis', 'rendez_vous', 'support', 'autre'].includes(analysis.category)) throw new Error('Catégorie invalide.');
  if (typeof analysis.summary !== 'string' || !analysis.summary.trim() || analysis.summary.length > 2000) throw new Error('Résumé invalide.');
  if (!Array.isArray(analysis.missing_information) || analysis.missing_information.length > 20 || !analysis.missing_information.every(x => typeof x === 'string' && x.trim() && x.length <= 300)) throw new Error('Informations manquantes invalides.');
  if (typeof analysis.draft_reply !== 'string' || !analysis.draft_reply.trim() || analysis.draft_reply.length > 5000) throw new Error('Brouillon invalide.');
  out.analysis = analysis;
} catch (error) {
  out.error = { code: 'INVALID_LLM_OUTPUT', message: error instanceof SyntaxError ? 'Le modèle a produit un JSON invalide.' : error.message };
}
return [{json:out}];`);
  code('Contenir la panne IA', [1050, 260], `
return [{json:{attempt_token:$('Réserver sans doublon').first().json.attempt_token,error:{code:'LLM_UNAVAILABLE',message:'Appel IA en échec après les tentatives bornées. Revue humaine nécessaire.'},metrics:{scenario:$('Normaliser la demande').first().json.input.scenario}}}];`);
  http('Enregistrer le résultat', [1340, 80], `={{ '${api}/requests/' + encodeURIComponent($('Réserver sans doublon').first().json.request_id) + '/result' }}`, '={{ $json }}');
  code('Persistance à vérifier', [1340, 470], `return [{json:{ok:false,status:'persistence_error',request_id:$('Réserver sans doublon').first().json.request_id,message:'Le résultat ne peut pas être confirmé. Consulter le service avant une nouvelle tentative.'}}];`);
  code('Préparer le suivi', [1630, 80], `
const response = $input.first().json;
const record = response.record ?? response;
const input = record.input ?? record;
const analysis = record.analysis ?? {};
// RAW in Google Sheets preserves strings without evaluating spreadsheet formulas.
const row = {
  demande_id: record.request_id ?? record.id ?? $('Réserver sans doublon').first().json.request_id,
  date: record.created_at ?? record.createdAt ?? new Date().toISOString(),
  prenom: input.first_name ?? '', nom: input.last_name ?? '', email: input.email ?? '', demande: input.message ?? '',
  categorie: analysis.category ?? '', resume: analysis.summary ?? '',
  informations_manquantes: (analysis.missing_information ?? []).join(' | '), brouillon_reponse: analysis.draft_reply ?? '',
  statut: record.status ?? 'unknown', erreur: record.error?.code ?? '', modele: record.metrics?.model ?? '',
};
return [{json:{record,row,sheets_enabled:${sheetsEnabled}}}];`);
  condition('Google Sheets configuré ?', [1890, 80], '={{ $json.sheets_enabled }}', true, 'boolean');
  const sheet = add('Synchroniser Google Sheets', 'googleSheets', 4.7, [2150, -20], {
    operation: 'appendOrUpdate', documentId: { __rl: true, mode: documentId ? 'id' : 'list', value: documentId },
    sheetName: { __rl: true, mode: 'name', value: sheetName },
    columns: { mappingMode: 'defineBelow', value: Object.fromEntries(SHEET_COLUMNS.map(key => [key, `={{ $json.row.${key} }}`])),
      matchingColumns: ['demande_id'], schema: SHEET_COLUMNS.map(key => ({ id: key, displayName: key, required: false, defaultMatch: key === 'demande_id', display: true, type: 'string', canBeUsedToMatch: true, removed: false })),
      attemptToConvertTypes: false, convertFieldsToString: false },
    options: { cellFormat: 'RAW' },
  }, { disabled: !sheetsEnabled, onError: 'continueErrorOutput', retryOnFail: true, maxTries: 3, waitBetweenTries: 1000 });
  if (sheetsEnabled) sheet.credentials = { googleSheetsOAuth2Api: { id: credentialId, name: 'Google Sheets · connexion locale' } };
  http('Confirmer la synchronisation', [2420, -40], `={{ '${api}/requests/' + encodeURIComponent($('Réserver sans doublon').first().json.request_id) + '/sink' }}`,
    '={{ { attempt_token: $("Réserver sans doublon").first().json.attempt_token, status: "synced" } }}');
  http('Signaler l’échec Sheets', [2420, 260], `={{ '${api}/requests/' + encodeURIComponent($('Réserver sans doublon').first().json.request_id) + '/sink' }}`,
    '={{ { attempt_token: $("Réserver sans doublon").first().json.attempt_token, status: "failed", error: "Synchronisation Google Sheets impossible après les tentatives bornées." } }}');
  http('Conserver sans Google Sheets', [2140, 450], `={{ '${api}/requests/' + encodeURIComponent($('Réserver sans doublon').first().json.request_id) + '/sink' }}`,
    '={{ { attempt_token: $("Réserver sans doublon").first().json.attempt_token, status: "skipped" } }}');
  code('Terminer sans Google Sheets', [2420, 560], `
const response = $input.first().json;
return [{json:{ok:true,record:response.record ?? response,sheets_sync:'skipped',message:'Résultat conservé dans le suivi local. Google Sheets non configuré.'}}];`);
  code('Résultat prêt pour relecture', [2720, 80], `
const response = $input.first().json;
const record = response.record ?? response;
return [{json:{ok:true,record,message:record.status === 'technical_error' ? 'Erreur contenue et conservée : revue humaine nécessaire.' : 'Résultat conservé. La réponse reste un brouillon à relire.'}}];`);
  code('Suivi de synchronisation à vérifier', [2710, 430], `
return [{json:{ok:false,status:'sink_tracking_error',record:$('Préparer le suivi').first().json.record,message:'Résultat conservé, mais état de synchronisation non confirmé. Consulter Google Sheets avant tout rejeu.'}}];`);

  connect('Formulaire de contact', 'Normaliser la demande');
  connect('Webhook de démonstration', 'Normaliser la demande');
  connect('Normaliser la demande', 'Entrée valide ?');
  connect('Entrée valide ?', 'Réserver sans doublon'); connect('Entrée valide ?', 'Entrée à corriger', 1);
  connect('Réserver sans doublon', 'Nouvelle tentative ?'); connect('Réserver sans doublon', 'Réservation refusée', 1);
  connect('Nouvelle tentative ?', 'Qualifier avec Ollama'); connect('Nouvelle tentative ?', 'Résultat déjà disponible', 1);
  connect('Qualifier avec Ollama', 'Valider le JSON du modèle'); connect('Qualifier avec Ollama', 'Contenir la panne IA', 1);
  connect('Valider le JSON du modèle', 'Enregistrer le résultat'); connect('Contenir la panne IA', 'Enregistrer le résultat');
  connect('Enregistrer le résultat', 'Préparer le suivi'); connect('Enregistrer le résultat', 'Persistance à vérifier', 1);
  connect('Préparer le suivi', 'Google Sheets configuré ?');
  connect('Google Sheets configuré ?', 'Synchroniser Google Sheets'); connect('Google Sheets configuré ?', 'Conserver sans Google Sheets', 1);
  connect('Conserver sans Google Sheets', 'Terminer sans Google Sheets'); connect('Conserver sans Google Sheets', 'Suivi de synchronisation à vérifier', 1);
  connect('Synchroniser Google Sheets', 'Confirmer la synchronisation'); connect('Synchroniser Google Sheets', 'Signaler l’échec Sheets', 1);
  for (const name of ['Confirmer la synchronisation', 'Signaler l’échec Sheets']) {
    connect(name, 'Résultat prêt pour relecture'); connect(name, 'Suivi de synchronisation à vérifier', 1);
  }
  return {
    id: 'atelierQualificationIA01', name: 'L’Atelier n8n · Qualification IA des demandes', nodes, connections,
    pinData: {}, active: false, settings: { executionOrder: 'v1', timezone: 'Europe/Paris', saveManualExecutions: true }, tags: [],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const local = process.argv.includes('--local');
  const config = local ? { documentId: process.env.SHEETS_DOCUMENT_ID ?? '', credentialId: process.env.SHEETS_CREDENTIAL_ID ?? '', sheetName: process.env.SHEETS_TAB_NAME ?? 'Qualification IA' } : {};
  if (local && Boolean(config.documentId) !== Boolean(config.credentialId)) throw new Error('Both SHEETS_DOCUMENT_ID and SHEETS_CREDENTIAL_ID must be provided together.');
  const destination = resolve(root, local ? 'local-files/02-qualification-ia.json' : 'workflows/02-qualification-ia.json');
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${JSON.stringify(buildWorkflow(config), null, 2)}\n`, { mode: local ? 0o600 : 0o644 });
  console.log(local ? 'Workflow local généré dans local-files (ignoré par Git).' : 'Workflow public généré sans identifiants privés.');
}

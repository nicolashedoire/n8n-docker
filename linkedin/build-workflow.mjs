import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { verifyPage } from './lib/verify-page.mjs';
import { prepareJobs } from './lib/prepare-jobs.mjs';

const id = name => createHash('sha256').update('atelier-linkedin:' + name).digest('hex').slice(0, 32);
const node = (name, type, typeVersion, position, parameters, extra = {}) => ({ id: id(name), name, type, typeVersion, position, parameters, ...extra });
const names = ['1 · Lancer la veille', '2 · Choisir la recherche', '3 · Télécharger LinkedIn', '4 · Vérifier la page', '5 · Extraire les cartes', '6 · Lire les annonces', '7 · Préparer le tableau', '8 · Télécharger le CSV'];
const fields = [
  ['title', '.base-search-card__title', 'text'],
  ['company', '.base-search-card__subtitle', 'text'],
  ['location', '.job-search-card__location', 'text'],
  ['url', 'a.base-card__full-link', 'attribute', 'href'],
  ['published_at', 'time[datetime]', 'attribute', 'datetime'],
].map(([key, cssSelector, returnValue, attribute]) => ({ key, cssSelector, returnValue, returnArray: false, ...(attribute ? { attribute } : {}) }));
const nodes = [
  node(names[0], 'n8n-nodes-base.manualTrigger', 1, [0, 300], {}),
  node(names[1], 'n8n-nodes-base.set', 3.4, [230, 300], {
    assignments: { assignments: [
      { id: id('keywords'), name: 'keywords', value: 'n8n', type: 'string' },
      { id: id('location'), name: 'location', value: 'France', type: 'string' },
      { id: id('max_results'), name: 'max_results', value: 10, type: 'number' },
      { id: id('priority_terms'), name: 'priority_terms', value: 'n8n, automatisation, automation, IA', type: 'string' },
    ] }, options: {},
  }, { notes: 'Changer ici la recherche. 10 = plafond de lignes exportées, pas nombre de pages. Les mots prioritaires servent uniquement au tri dans le titre.', notesInFlow: false }),
  node(names[2], 'n8n-nodes-base.httpRequest', 4.4, [460, 300], {
    method: 'GET', url: 'https://www.linkedin.com/jobs/search/',
    sendQuery: true, queryParameters: { parameters: [
      { name: 'keywords', value: '={{ $json.keywords }}' },
      { name: 'location', value: '={{ $json.location }}' },
    ] },
    sendHeaders: true, headerParameters: { parameters: [{ name: 'Accept', value: 'text/html' }] },
    options: { timeout: 15000,
      redirect: { redirect: { followRedirects: false } },
      response: { response: { fullResponse: true, neverError: true, responseFormat: 'text', outputPropertyName: 'body' } },
    },
  }, { retryOnFail: false, notes: 'Une requête anonyme, sans cookies ni clé. Les codes HTTP sont examinés au nœud suivant. Une panne réseau arrête ce nœud.', notesInFlow: false }),
  node(names[3], 'n8n-nodes-base.code', 2, [690, 300], {
    mode: 'runOnceForAllItems', jsCode: `${verifyPage.toString()}\nreturn [{json: verifyPage($input.first().json)}];`,
  }),
  node(names[4], 'n8n-nodes-base.html', 1.2, [920, 300], {
    operation: 'extractHtmlContent', sourceData: 'json', dataPropertyName: 'html',
    extractionValues: { values: [{ key: 'cards', cssSelector: '.jobs-search__results-list .base-search-card', returnValue: 'html', returnArray: true }] },
    options: { trimValues: true, cleanUpText: true },
  }, { alwaysOutputData: true }),
  node(names[5], 'n8n-nodes-base.html', 1.2, [1150, 300], {
    operation: 'extractHtmlContent', sourceData: 'json', dataPropertyName: 'cards',
    extractionValues: { values: fields }, options: { trimValues: true, cleanUpText: true },
  }, { alwaysOutputData: true, notes: 'HTML accepte directement un tableau de fragments : il crée un item par carte. Les cinq champs restent rattachés à leur annonce.', notesInFlow: false }),
  node(names[6], 'n8n-nodes-base.code', 2, [1380, 300], {
    mode: 'runOnceForAllItems',
    jsCode: `${prepareJobs.toString()}\nconst config = $('${names[1]}').first().json;\nconst timestamp = $('${names[3]}').first().json.collected_at;\nreturn prepareJobs($input.all().map(item => item.json), config, timestamp).map(json => ({ json }));`,
  }, { notes: 'Table consultable dans Output > Table. Le score compte les mots prioritaires présents dans le titre : il ne juge pas la pertinence du poste pour une personne.', notesInFlow: false }),
  node(names[7], 'n8n-nodes-base.convertToFile', 1.1, [1610, 300], {
    operation: 'csv', binaryPropertyName: 'data', options: {
      fileName: "={{ 'veille-linkedin-' + $now.toFormat('yyyy-MM-dd-HHmm') + '.csv' }}", headerRow: true, delimiter: ';',
    },
  }),
  node('Comprendre la collecte', 'n8n-nodes-base.stickyNote', 1, [-50, 40], {
    content: '## 1. Collecter une page publique\nModifier les critères dans **2**, puis lancer le workflow. Une seule requête, 15 s maximum, sans relance.\n\nEn cas de refus HTTP, de connexion imposée ou de structure inconnue, la collecte s’arrête avec un message explicite.',
    height: 200, width: 875, color: 5,
  }),
  node('Comprendre le résultat', 'n8n-nodes-base.stickyNote', 1, [870, 40], {
    content: '## 2. Transformer et télécharger\nLes nœuds **5 et 6** extraient les cartes puis leurs champs par sélecteurs CSS. **7** nettoie, dédoublonne et trie : ouvrir sa table de sortie. **8** fournit le CSV via Download.\n\nScraping déterministe, sans IA. Première page seulement ; le tri regarde les titres, pas les descriptifs complets.',
    height: 200, width: 890, color: 4,
  }),
];
const connections = Object.fromEntries(names.slice(0, -1).map((name, index) => [name, { main: [[{ node: names[index + 1], type: 'main', index: 0 }]] }]));
const workflow = {
  id: 'atelierLinkedinVeille01', name: 'L’Atelier · LinkedIn public → CSV', active: false,
  nodes, connections, pinData: {}, settings: { executionOrder: 'v1', timezone: 'Europe/Paris', saveManualExecutions: true, saveDataSuccessExecution: 'all', saveDataErrorExecution: 'all', executionTimeout: 60 },
};
await mkdir(new URL('./workflows/', import.meta.url), { recursive: true });
await writeFile(new URL('./workflows/linkedin-veille.json', import.meta.url), JSON.stringify(workflow, null, 2) + '\n');
console.log('Workflow LinkedIn généré : 8 nœuds + 2 notes.');

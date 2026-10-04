import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const systemMessage=readFileSync(resolve(root,'chantier/agent-prompt.txt'),'utf8');
const nodes=[];
const nid=name=>createHash('sha256').update('chantier:'+name).digest('hex').slice(0,32);
const add=(name,type,typeVersion,position,parameters,extra={})=>nodes.push({id:nid(name),name,type,typeVersion,position,parameters,...extra});
add('Décrire mon chantier','@n8n/n8n-nodes-langchain.chatTrigger',1.5,[-440,0],{
  public:true,mode:'hostedChat',authentication:'none',
  initialMessages:'Bonjour ! Décrivez votre chantier : carrelage, cloison ou doublage. Nous préciserons les dimensions, l’usage de la pièce et les matériaux avant de préparer une liste d’achat estimative.',
  options:{responseMode:'lastNode',loadPreviousSession:'notSupported',allowFileUploads:false,
    title:'L’Atelier · Agent achats chantier',subtitle:'Des matériaux sourcés, des quantités calculées, une liste à valider.',inputPlaceholder:'Ex. Je veux créer une cloison de 4 m dans une chambre…'}
},{webhookId:'atelier-agent-chantier'});
add('Agent achats chantier','@n8n/n8n-nodes-langchain.agent',3.1,[-100,0],{
  promptType:'auto',hasOutputParser:false,
  options:{systemMessage,maxIterations:8,returnIntermediateSteps:true,enableStreaming:false}
});
add('Modèle OpenAI','@n8n/n8n-nodes-langchain.lmChatOpenAi',1.3,[-520,240],{
  model:{__rl:true,mode:'id',value:'gpt-5.6-terra'},responsesApiEnabled:true,
  options:{reasoningEffort:'low',timeout:60000,maxRetries:1,extraBody:'{"store":false}'}
});
add('Mémoire de la conversation','@n8n/n8n-nodes-langchain.memoryBufferWindow',1.4,[-280,240],{
  sessionIdType:'customKey',sessionKey:'={{ $json.sessionId }}',contextWindowLength:8
});
function tool(name,x,route,description,body){
  add(name,'n8n-nodes-base.httpRequestTool',4.5,[x,240],{
    descriptionType:'manual',toolDescription:description,method:'POST',url:`http://chantier-api:3000/tools/${route}`,
    sendBody:true,contentType:'json',specifyBody:'json',jsonBody:body,
    options:{timeout:15000,response:{response:{responseFormat:'json'}}}
  });
}
tool('Consulter les règles',-20,'rules',
  'Consulter les règles sourcées du chantier, les questions à poser, le choix standard/hydrofuge, les systèmes autorisés et les limites. À appeler avant tout chiffrage ou conseil technique. project_type: tiling (carrelage), partition (cloison), lining (doublage), ceiling (plafond) ou unknown. room_type: dry, wet ou unknown.',
  '={{ { project_type: $fromAI("project_type", "tiling, partition, lining, ceiling ou unknown selon le chantier", "string"), room_type: $fromAI("room_type", "dry pour pièce sèche, wet pour pièce humide, unknown si non précisé", "string") } }}');
tool('Rechercher les matériaux',240,'search',
  'Rechercher des produits dans le catalogue sélectionné et daté de Leroy Merlin. Ce n’est pas une recherche de tout le Web. Renvoie identifiants, noms, catégories, dimensions, conditionnements, prix relevés et liens sources. Chercher notamment carrelage, plaque BA13, hydrofuge, rail48, montant48, laine45. Les prix sont des relevés datés, pas des stocks locaux.',
  '={{ { query: $fromAI("query", "Recherche de matériaux en français, ex plaque BA13 hydrofuge, rail montant isolation, carrelage gris", "string") } }}');
tool('Consulter une fiche fournisseur',500,'product',
  'Lire une référence déjà trouvée dans le catalogue. product_id doit être un identifiant exact de Rechercher les matériaux. refresh=true tente une lecture en ligne de sa fiche autorisée ; sinon retourne le relevé daté. Respecter refresh.status : un échec n’est pas un prix en direct. Aucun stock local n’est vérifié.',
  '={{ { product_id: $fromAI("product_id", "Identifiant exact retourné par le catalogue", "string"), refresh: $fromAI("refresh", "true pour tenter une lecture du prix en ligne, false pour utiliser explicitement le relevé daté", "boolean") } }}');
tool('Calculer les quantités',760,'estimate',
  'Calcul déterministe de quantités et budget : appeler après règles et sélection réelle de produits. Objet calculation : project_type tiling|partition|lining; room_type dry|wet; room_usage private_bathroom et water_exposure outside_direct_spray obligatoires si wet (projection douche, receveur ou exposition inconnue non chiffrés); margin_pct 0..30; budget_eur facultatif. Carrelage: surface_m2, product_ids:{tile:id}. Placo: wall_lengths_m (longueurs de chaque pan),height_m,openings:[{wall_index:0,width_m,height_m}], layers:1, wall_finish:"light" (peinture/finition légère; tile et heavy hors périmètre), stud_spacing_m:0.6,framing_system (identifiant autorisé par règles),product_ids:{board:id,rail:id,stud:id,insulation:id facultatif}. Ne remplace pas des dimensions absentes par des suppositions. L’outil contrôle unités, domaine, compatibilités élémentaires et arrondis de conditionnement ; retourne erreurs/questions si nécessaire. Les hypothèses du système restent à faire valider.',
  '={{ $fromAI("calculation", "Objet JSON du métré avec les seuls paramètres confirmés, les identifiants de produits du catalogue et le framing_system autorisé par les règles. Voir description complète de l’outil.", "json") }}');
add('Lire ce workflow','n8n-nodes-base.stickyNote',1,[-560,-290],{
  content:'## 🧱 Agent achats chantier\n**Un chat, un agent et quatre outils.**\nLe modèle choisit ses appels et réutilise leurs résultats. Ouvrez le chat, puis une exécution pour voir les outils réellement utilisés.\n\n**Démo :** « Je crée une cloison de 4 m × 2,50 m dans une chambre, sans ouverture, finition peinte, avec isolation phonique et 10 % de marge. » Puis : « Et si c’est une salle de bains ? »',height:230,width:720,color:4
});
add('Sources et calculs','n8n-nodes-base.stickyNote',1,[220,-290],{
  content:'## Sources, hypothèses et décisions\nCatalogue Leroy Merlin sélectionné et daté ; règles fabricants Placo/ISOVER.\nCalculs dans un outil contrôlé : quantités, conditionnements et total partiel.\n**Hydrofuge ≠ étanchéité complète.** Pas de commande automatique.\nLes limites du système et les postes non chiffrés restent visibles.',height:230,width:720,color:5
});
const connections={
  'Décrire mon chantier':{main:[[{node:'Agent achats chantier',type:'main',index:0}]]},
  'Modèle OpenAI':{ai_languageModel:[[{node:'Agent achats chantier',type:'ai_languageModel',index:0}]]},
  'Mémoire de la conversation':{ai_memory:[[{node:'Agent achats chantier',type:'ai_memory',index:0}]]}
};
for(const name of ['Consulter les règles','Rechercher les matériaux','Consulter une fiche fournisseur','Calculer les quantités']) connections[name]={ai_tool:[[{node:'Agent achats chantier',type:'ai_tool',index:0}]]};
const workflow={id:'atelierAgentChantier01',name:'L’Atelier · Agent IA achats chantier',active:false,nodes,connections,pinData:{},settings:{executionOrder:'v1',timezone:'Europe/Paris',saveManualExecutions:true,saveDataSuccessExecution:'all',saveDataErrorExecution:'all',executionTimeout:300}};
writeFileSync(resolve(root,'chantier/workflow.json'),JSON.stringify(workflow,null,2)+'\n');
const local=structuredClone(workflow);
local.nodes.find(n=>n.name==='Modèle OpenAI').credentials={openAiApi:{id:'atelierChantierOpenAI',name:'OpenAI · Agent achats chantier'}};
mkdirSync(resolve(root,'local-files'),{recursive:true});
writeFileSync(resolve(root,'local-files/03-agent-achats-chantier.json'),JSON.stringify(local,null,2)+'\n',{mode:0o600});
console.log('Workflow créé : 8 nœuds exécutables + 2 notes. Export public sans identifiant de connexion.');

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
  initialMessages:'Bonjour ! Dites-moi simplement quelle pièce vous refaites et ses dimensions. Par exemple : « Je refais ma salle de bains de 4 m sur 3 m. » Je préparerai une première estimation avec des hypothèses à confirmer.',
  options:{responseMode:'lastNode',loadPreviousSession:'notSupported',allowFileUploads:false,
    title:'L’Atelier · Agent achats chantier',subtitle:'Des matériaux sourcés, des quantités calculées, une liste à valider.',inputPlaceholder:'Je refais ma salle de bains de 4 m sur 3 m…'}
},{webhookId:'atelier-agent-chantier'});
add('Agent achats chantier','@n8n/n8n-nodes-langchain.agent',3.1,[-100,0],{
  promptType:'auto',hasOutputParser:false,
  options:{systemMessage,maxIterations:8,returnIntermediateSteps:true,enableStreaming:false}
},{onError:'continueErrorOutput',retryOnFail:true,maxTries:2,waitBetweenTries:1000});
add('Modèle OpenAI','@n8n/n8n-nodes-langchain.lmChatOpenAi',1.3,[-520,240],{
  model:{__rl:true,mode:'id',value:'gpt-5.6-terra'},responsesApiEnabled:true,
  options:{reasoningEffort:'low',timeout:60000,maxRetries:0,extraBody:'{"store":false}'}
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
  'Consulter les règles sourcées du chantier, les questions à poser, le choix standard/hydrofuge, les systèmes autorisés et les limites. À appeler avant tout chiffrage ou conseil technique. project_type: bathroom (pièce entière salle de bains depuis longueur/largeur), tiling (carrelage seul), partition (cloison seule), lining (doublage isolé), ceiling (plafond) ou unknown. bathroom fournit des hypothèses et produits proposés pour une première estimation sans questionnaire technique. room_type: dry, wet ou unknown.',
  '={{ { project_type: $fromAI("project_type", "bathroom pour salle de bains entière avec dimensions, sinon tiling, partition, lining, ceiling ou unknown", "string"), room_type: $fromAI("room_type", "dry pour pièce sèche, wet pour pièce humide, unknown si non précisé", "string") } }}');
tool('Rechercher les matériaux',240,'search',
  'Rechercher des produits dans le catalogue sélectionné et daté de fournisseurs de bricolage. Ce n’est pas une recherche de tout le Web. Renvoie identifiants, noms, catégories, dimensions, conditionnements, prix relevés et liens sources. Chercher notamment carrelage, plaque BA13, hydrofuge, rail48, montant48, laine45. Les prix sont des relevés datés, pas des stocks locaux.',
  '={{ { query: $fromAI("query", "Recherche de matériaux en français, ex plaque BA13 hydrofuge, rail montant isolation, carrelage gris", "string") } }}');
tool('Consulter une fiche fournisseur',500,'product',
  'Lire une référence déjà trouvée dans le catalogue. product_id doit être un identifiant exact de Rechercher les matériaux. refresh=true tente une lecture en ligne de sa fiche autorisée ; sinon retourne le relevé daté. Respecter refresh.status : un échec n’est pas un prix en direct. Aucun stock local n’est vérifié.',
  '={{ { product_id: $fromAI("product_id", "Identifiant exact retourné par le catalogue", "string"), refresh: $fromAI("refresh", "true pour tenter une lecture du prix en ligne, false pour utiliser explicitement le relevé daté", "boolean") } }}');
tool('Calculer les quantités',760,'estimate',
  'Calcul déterministe des quantités et prix. BATHROOM (pièce entière): calculation={project_type:"bathroom",length_m:number,width_m:number}. Ces deux dimensions suffisent à une estimation provisoire. Paramètres facultatifs UNIQUEMENT si fournis/confirmés par utilisateur: height_m,margin_pct,budget_eur,openings:[{wall_index:0,width_m,height_m}],include_insulation,wall_finish:"light"|"tile"|"heavy",water_exposure:"unknown"|"outside_direct_spray"|"direct_shower_spray"|"shower_tray". product_ids:{tile,board,rail,stud,insulation} peut contenir les identifiants du catalogue sélectionnés après règles/recherche. Omettre les dimensions/options inconnues: le calculateur les expose comme hypothèses, sans les faire passer pour des faits. Calcule lui-même sol, périmètre, quatre murs à une face, quantités et total partiel. Une hauteur hors système peut retourner partial avec sol conservé et murs non chiffrés. AUTRES PROJETS: project_type tiling|partition|lining,room_type dry|wet,margin_pct,budget_eur facultatif; wet exige room_usage private_bathroom et water_exposure outside_direct_spray. tiling: surface_m2,product_ids:{tile}. partition: wall_lengths_m,height_m,openings,layers:1,wall_finish:"light",stud_spacing_m:0.6,framing_system depuis règles,product_ids:{board,rail,stud,insulation?}. Respecter la portée exacte du résultat et les exclusions.',
  '={{ $fromAI("calculation", "Objet JSON du calcul. Pour bathroom: longueur et largeur connues suffisent; ne renseigner la hauteur/marge/ouvertures/budget que si l’utilisateur les a indiqués. Les défauts proviennent du moteur et sont annoncés comme hypothèses. Voir contrat de l’outil.", "json") }}');
add('Expliquer l’incident','n8n-nodes-base.code',2,[400,0],{
  mode:'runOnceForAllItems',jsCode:readFileSync(resolve(root,'chantier/incident-response.js'),'utf8')
});
add('Lire ce workflow','n8n-nodes-base.stickyNote',1,[-560,-290],{
  content:'## 🧱 Une demande suffit pour commencer\n**À copier seul dans le chat :**\n« Je refais ma salle de bains de 4 m sur 3 m. »\n\nL’agent propose une première liste, indique ses hypothèses et pose une question utile pour affiner. Les outils sont appelés selon le besoin.\n**Pour tester la mémoire :** attendre la réponse, puis envoyer « En fait, la hauteur est de 2,70 m. »',height:230,width:720,color:4
});
add('Sources et calculs','n8n-nodes-base.stickyNote',1,[220,-290],{
  content:'## Sources, hypothèses et décisions\nCatalogue fournisseurs sélectionné et daté ; règles fabricants Placo/ISOVER.\nCalculs dans un outil contrôlé : quantités, conditionnements et total partiel.\n**Hydrofuge ≠ étanchéité complète.** Pas de commande automatique.\nDimensions seules → hypothèses explicites → estimation provisoire.\nLa douche et les protections à l’eau restent des postes distincts.',height:230,width:720,color:5
});
const connections={
  'Décrire mon chantier':{main:[[{node:'Agent achats chantier',type:'main',index:0}]]},
  'Agent achats chantier':{main:[[],[{node:'Expliquer l’incident',type:'main',index:0}]]},
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
console.log('Workflow créé : 8 nœuds du parcours + 1 réponse aux incidents + 2 notes. Export public sans identifiant de connexion.');

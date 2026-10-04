#!/usr/bin/env node
/** Read-only, workflow-scoped n8n trace reader. Never reads workflowData or credentials.
 * node chantier/extract-execution.mjs --session=check-chantier-... [--after-id=0]
 * Only synthetic check-chantier-* sessions are returned. No database writes.
 */
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const WORKFLOW_ID = 'atelierAgentChantier01';
export const TOOL_NAMES = Object.freeze({
  rules: 'Consulter_les_r_gles', search: 'Rechercher_les_mat_riaux',
  product: 'Consulter_une_fiche_fournisseur', estimate: 'Calculer_les_quantit_s',
});

// Runs inside the existing n8n image, where node:sqlite and flatted are installed.
// All SQL values are bound parameters; the database is opened readOnly:true.
const reader = String.raw`
const {DatabaseSync}=require('node:sqlite');
const {createRequire}=require('node:module');
const req=createRequire('/usr/local/lib/node_modules/n8n/package.json');
const {parse}=req('flatted');
const cfg=JSON.parse(process.argv[2]);
const db=new DatabaseSync('/home/node/.n8n/database.sqlite',{readOnly:true});
const workflowId='atelierAgentChantier01';
const metadata=db.prepare('SELECT max(id) AS latest FROM execution_entity WHERE workflowId=?').get(workflowId);
if(cfg.cursorOnly){console.log(JSON.stringify({workflow_id:workflowId,latest_id:metadata.latest??0}));db.close();process.exit(0);}
const rows=db.prepare('SELECT e.id,e.status,e.finished,e.startedAt,e.stoppedAt,d.data FROM execution_entity e JOIN execution_data d ON d.executionId=e.id WHERE e.workflowId=? AND e.id>? ORDER BY e.id DESC LIMIT ?').all(workflowId,cfg.afterId,cfg.limit);
const toolNodes=['Consulter les règles','Rechercher les matériaux','Consulter une fiche fournisseur','Calculer les quantités'];
const forbidden=/^(authorization|api[_-]?key|credential[s]?|headers?|access[_-]?token|refresh[_-]?token|password|secret|cookie|set-cookie)$/i;
function safe(value,depth=0,seen=new WeakSet()){
 if(depth>15)return '[depth limit]';
 if(typeof value==='string')return value.replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g,'[REDACTED]').replace(/Bearer\s+[A-Za-z0-9._-]+/gi,'Bearer [REDACTED]').slice(0,120000);
 if(!value||typeof value!=='object')return value;
 if(seen.has(value))return '[circular]';seen.add(value);
 const out=Array.isArray(value)?value.map(v=>safe(v,depth+1,seen)):Object.fromEntries(Object.entries(value).filter(([k])=>!forbidden.test(k)).map(([k,v])=>[k,safe(v,depth+1,seen)]));
 seen.delete(value);return out;
}
function unpack(value){
 for(let i=0;i<5;i++){
  if(typeof value==='string'){try{value=JSON.parse(value);continue;}catch{return value;}}
  if(Array.isArray(value)&&value.length===1){value=value[0];continue;}
  if(value&&typeof value==='object'&&Object.keys(value).length===1&&Object.hasOwn(value,'json')){value=value.json;continue;}
  break;
 }return value;
}
function outputs(runs){return (runs??[]).flatMap(run=>(run.data?.main??[]).flat().filter(Boolean).map(item=>item.json)).filter(Boolean);}
const executions=[];
for(const row of rows){
 let decoded;try{decoded=parse(row.data);}catch{continue;}
 const runData=decoded?.resultData?.runData??{};
 const chats=outputs(runData['Décrire mon chantier']);
 const chat=chats.find(item=>item.sessionId===cfg.sessionId);
 if(!chat||!chat.sessionId.startsWith('check-chantier-'))continue;
 const agent=outputs(runData['Agent achats chantier']);
 const final=agent.findLast(item=>typeof item.output==='string')??agent.at(-1)??{};
 const rawSteps=agent.flatMap(item=>Array.isArray(item.intermediateSteps)?item.intermediateSteps:[]);
 const steps=rawSteps.map((step,index)=>({index,tool:step.action?.tool??null,input:safe(unpack(step.action?.toolInput)),observation:safe(unpack(step.observation))}));
 const executedToolNodes=toolNodes.filter(name=>Array.isArray(runData[name])&&runData[name].length>0);
 const errors=Object.entries(runData).filter(([name])=>name==='Agent achats chantier'||toolNodes.includes(name)).flatMap(([node,runs])=>runs.filter(r=>r.error).map(r=>({node,name:r.error.name??'Error',message:safe(r.error.message??'')})));
 executions.push({id:String(row.id),status:row.status,finished:Boolean(row.finished),started_at:row.startedAt,stopped_at:row.stoppedAt,session_id:chat.sessionId,chat_input:safe(chat.chatInput??''),output:safe(final.output??''),intermediate_steps_present:agent.some(item=>Array.isArray(item.intermediateSteps)),steps,executed_tool_nodes:executedToolNodes,errors});
}
db.close();console.log(JSON.stringify({workflow_id:workflowId,latest_id:metadata.latest??0,executions:executions.reverse()}));
`;

export function readExecutions({ sessionId, afterId = 0, limit = 100, cursorOnly = false } = {}) {
  if (!cursorOnly && !/^check-chantier-[A-Za-z0-9_-]+$/.test(sessionId ?? '')) throw new Error('A synthetic check-chantier-* session is required.');
  if (!Number.isSafeInteger(Number(afterId)) || Number(afterId) < 0) throw new Error('afterId must be a nonnegative integer.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('limit must be between 1 and 500.');
  const container = process.env.CHANTIER_N8N_CONTAINER ?? 'n8n-desktop-n8n-1';
  if (!/^[A-Za-z0-9_.-]+$/.test(container)) throw new Error('Invalid container name.');
  const config = JSON.stringify({ sessionId, afterId: Number(afterId), limit, cursorOnly });
  const result = spawnSync('docker', ['exec', '-i', container, 'node', '-', config], {
    input: reader, encoding: 'utf8', timeout: 20_000, maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error('Read-only n8n trace extraction failed; check the running container and database schema.');
  try { return JSON.parse(result.stdout); } catch { throw new Error('The trace reader did not return JSON.'); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const value = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  try {
    console.log(JSON.stringify(readExecutions({ sessionId: value('session'), afterId: Number(value('after-id') ?? 0), cursorOnly: process.argv.includes('--cursor') }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

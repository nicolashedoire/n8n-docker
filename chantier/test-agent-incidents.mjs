#!/usr/bin/env node
/** Native n8n fault injection against a local fake Responses API.
 * Default --dry-run does not start Docker or call a model.
 * --run uses NEW containers, a NEW database volume and an internal-only network.
 * It never reads production credentials or mounts the production n8n database.
 * No real LLM calls or purchases occur; all API keys and responses are synthetic.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const n8nImage = 'docker.n8n.io/n8nio/n8n@sha256:b73045abaddb40cb4024e86eea1b1f69093501a7339f685a4cd486b7743d23ae';
const mockImage = 'node:22-bookworm-slim';
const marker = 'Réponse synthétique après rétablissement du service.';
const key = 'sk-chantier-synthetic-incident-test-only';
const agentRetryProbe = process.argv.includes('--agent-retry-probe');
const allCases = [
  { id: 'auth401', expected: 'AUTHENTICATION', retryable: false, maxRequests: 2 },
  { id: 'quota429', expected: 'QUOTA_EXCEEDED', retryable: false, maxRequests: 2 },
  { id: 'server503', expected: 'SERVICE_UNAVAILABLE', retryable: true, maxRequests: 2 },
  { id: 'invalid_json', expected: 'INVALID_RESPONSE', retryable: true, maxRequests: 2 },
  { id: 'timeout', expected: 'TIMEOUT', retryable: true, maxRequests: 2 },
  { id: 'recover503', recovery: true, expectedRequests: 2 },
  { id: 'recover429', recovery: true, expectedRequests: 2 },
  { id: 'after_tool503', expected: 'SERVICE_UNAVAILABLE', retryable: true, maxRequests: 4, afterTool: true },
];
const only = process.argv.find(value => value.startsWith('--only='))?.slice('--only='.length);
if (only) assert(allCases.some(item => item.id === only), 'Unknown --only case.');
const cases = only ? allCases.filter(item => item.id === only) : allCases;

const mockSource = String.raw`
import http from 'node:http';
const key='sk-chantier-synthetic-incident-test-only';
const marker='Réponse synthétique après rétablissement du service.';
const stats={};
const known=new Set(['auth401','quota429','server503','invalid_json','timeout','recover503','recover429','after_tool503']);
function success(){return {id:'resp_synthetic',object:'response',created_at:Math.floor(Date.now()/1000),status:'completed',error:null,incomplete_details:null,
 model:'synthetic-model',output:[{id:'msg_synthetic',type:'message',status:'completed',role:'assistant',content:[{type:'output_text',text:marker,annotations:[]}]}],
 usage:{input_tokens:1,output_tokens:1,total_tokens:2,input_tokens_details:{cached_tokens:0},output_tokens_details:{reasoning_tokens:0}},parallel_tool_calls:true,tools:[],tool_choice:'auto'};}
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://local.invalid');
 const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Retry-After':'0.01'});res.end(JSON.stringify(data));};
 if(req.method==='GET'&&url.pathname==='/health')return json(200,{status:'ok',synthetic:true});
 if(req.method==='GET'&&url.pathname==='/stats')return json(200,{stats});
 if(url.pathname==='/tool'){stats.synthetic_tool_requests=(stats.synthetic_tool_requests??0)+1;return json(200,{synthetic:true,output:'Outil fictif sans effet externe.'});}
 const match=url.pathname.match(/^\/([a-z0-9_]+)\/v1\/responses$/);
 if(req.method!=='POST'||!match||!known.has(match[1]))return json(404,{error:{message:'Unknown synthetic endpoint.'}});
 const id=match[1]; const record=stats[id]??={requests:0,synthetic_auth_only:true,paths:[],streaming:false};
 record.requests++;record.paths.push(url.pathname);
 if(req.headers.authorization!==('Bearer '+key)){record.synthetic_auth_only=false;return json(403,{error:{message:'Only the exact synthetic credential is accepted.'}});}
 const chunks=[];let bytes=0;
 for await(const chunk of req){bytes+=chunk.length;if(bytes>1000000)return json(413,{error:{message:'Synthetic body limit'}});chunks.push(chunk);}
 let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{return json(400,{error:{message:'Invalid synthetic request'}});}
 record.streaming=Boolean(body.stream);
 const error=(status,message,type,code)=>json(status,{error:{message,type,param:null,code}});
 if(id==='after_tool503'){
  if(record.requests===1){
   const tool=body.tools?.find(item=>item.type==='function');
   if(!tool?.name)return error(400,'Synthetic function tool not found.','invalid_request_error','missing_tool');
   const response=success();response.output=[{id:'fc_synthetic',type:'function_call',status:'completed',call_id:'call_synthetic',name:tool.name,arguments:'{}'}];
   return json(200,response);
  }
  return error(503,'Synthetic service unavailable after successful tool.','server_error','service_unavailable');
 }
 if(id==='auth401')return error(401,'Incorrect API key provided: SYNTHETIC-KEY-REDACTED','invalid_request_error','invalid_api_key');
 if(id==='quota429')return error(429,'You exceeded your current quota, please check your plan and billing details.','insufficient_quota','insufficient_quota');
 if(id==='server503'||(id==='recover503'&&record.requests===1))return error(503,'Synthetic upstream service unavailable.','server_error','service_unavailable');
 if(id==='recover429'&&record.requests===1)return error(429,'Synthetic request rate limit exceeded.','rate_limit_error','rate_limit_exceeded');
 if(id==='invalid_json'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{"output":BROKEN_SYNTHETIC_JSON');return;}
 if(id==='timeout'){const timer=setTimeout(()=>{if(!res.destroyed)json(200,success());},15000);res.on('close',()=>clearTimeout(timer));return;}
 if(body.stream){
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});
   const done=success(),item=done.output[0],part=item.content[0];let n=0;
   const event=(type,data)=>res.write('event: '+type+'\ndata: '+JSON.stringify({type,sequence_number:n++,...data})+'\n\n');
   event('response.created',{response:{...done,status:'in_progress',output:[]}});
   event('response.output_item.added',{output_index:0,item:{...item,status:'in_progress',content:[]}});
   event('response.content_part.added',{item_id:item.id,output_index:0,content_index:0,part:{...part,text:''}});
   event('response.output_text.delta',{item_id:item.id,output_index:0,content_index:0,delta:marker});
   event('response.output_text.done',{item_id:item.id,output_index:0,content_index:0,text:marker});
   event('response.content_part.done',{item_id:item.id,output_index:0,content_index:0,part});
   event('response.output_item.done',{output_index:0,item});
   event('response.completed',{response:done});res.end();return;
 }
 return json(200,success());
}).listen(3000,'0.0.0.0');
`;

const traceReader = String.raw`
const {DatabaseSync}=require('node:sqlite');const {createRequire}=require('node:module');
const req=createRequire('/usr/local/lib/node_modules/n8n/package.json');const {parse}=req('flatted');
const db=new DatabaseSync('/home/node/.n8n/database.sqlite',{readOnly:true});
const row=db.prepare('SELECT e.id,e.status,e.startedAt,e.stoppedAt,d.data FROM execution_entity e JOIN execution_data d ON d.executionId=e.id WHERE e.workflowId=? ORDER BY e.id DESC LIMIT 1').get(process.argv[2]);
if(!row){console.log(JSON.stringify({error:'missing_execution'}));db.close();process.exit(0);}
const data=parse(row.data);const runs=data.resultData?.runData??{};
function outputs(name){return(runs[name]??[]).flatMap(r=>(r.data?.main??[]).flat().filter(Boolean).map(x=>x.json));}
const safeError=e=>e?{name:e.name??null,message:String(e.message??'').slice(0,500),description:String(e.description??'').slice(0,500)}:null;
console.log(JSON.stringify({id:String(row.id),status:row.status,started_at:row.startedAt,stopped_at:row.stoppedAt,
 incident_output:outputs('Expliquer l’incident'),agent_output:outputs('Agent achats chantier'),
 nodes:Object.entries(runs).map(([name,items])=>({name,runs:items.map(r=>({status:r.executionStatus,duration_ms:r.executionTime,error:safeError(r.error)}))})),
 workflow_error:safeError(data.resultData?.error)}));db.close();
`;

function docker(args, { timeout = 120000, input, check = true } = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8', input, timeout, maxBuffer: 12 * 1024 * 1024 });
  if (check && (result.error || result.status !== 0)) throw new Error(`Docker operation failed (${args[0]}): ${(result.error?.message ?? result.stderr ?? '').slice(0, 600)}`);
  return result;
}
function fixtureWorkflow(template, scenario, credentialId) {
  const agent = structuredClone(template.nodes.find(node => node.name === 'Agent achats chantier'));
  const model = structuredClone(template.nodes.find(node => node.name === 'Modèle OpenAI'));
  const incident = structuredClone(template.nodes.find(node => node.name === 'Expliquer l’incident'));
  assert(agent && model && incident, 'The current public workflow must contain the agent, model and incident handler.');
  assert.equal(agent.onError, 'continueErrorOutput', 'The public agent must route a controlled error output.');
  if (agent.retryOnFail) assert.equal(agent.maxTries, 2, 'Only a bounded two-attempt agent policy is supported by this suite.');
  if (agentRetryProbe) Object.assign(agent, { retryOnFail: true, maxTries: 2, waitBetweenTries: 1000 });
  const sourceConnection = template.connections[agent.name]?.main?.[1]?.find(link => link.node === incident.name);
  assert(sourceConnection, 'The actual workflow must connect agent error output 1 to the incident handler.');
  agent.parameters.promptType = 'define';
  agent.parameters.text = 'Ceci est un test synthétique sans chantier. Réponds simplement au message.';
  agent.parameters.options = { ...agent.parameters.options, systemMessage: 'Test synthétique. Réponds sans outil.', maxIterations: 2, enableStreaming: false };
  model.parameters.model = { __rl: true, mode: 'id', value: 'synthetic-model' };
  model.parameters.responsesApiEnabled = true;
  assert([0, 1].includes(model.parameters.options?.maxRetries), 'Unexpected model retry policy; inspect it before extending the request bounds.');
  model.parameters.options = { ...model.parameters.options,
    ...(scenario.id === 'timeout' ? { timeout: 1000 } : {}) };
  model.credentials = { openAiApi: { id: credentialId, name: `SYNTHETIC ONLY ${scenario.id}` } };
  delete agent.credentials; delete incident.credentials;
  const trigger = { id: 'incident-start', name: 'Test manuel synthétique', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [-400, 0], parameters: {} };
  const tool = { id: 'incident-tool', name: 'Outil synthétique', type: 'n8n-nodes-base.httpRequestTool', typeVersion: 4.5,
    position: [100, 300], parameters: { descriptionType: 'manual', toolDescription: 'Outil synthétique inutile pour cette réponse.', method: 'GET', url: 'http://fault-api:3000/tool', options: { timeout: 1000 } } };
  return { id: `incident_${scenario.id}`, name: `TEST JETABLE · ${scenario.id}`, active: false,
    nodes: [trigger, agent, model, incident, tool], connections: {
      [trigger.name]: { main: [[{ node: agent.name, type: 'main', index: 0 }]] },
      [agent.name]: { main: [[], [{ node: incident.name, type: 'main', index: 0 }]] },
      [model.name]: { ai_languageModel: [[{ node: agent.name, type: 'ai_languageModel', index: 0 }]] },
      [tool.name]: { ai_tool: [[{ node: agent.name, type: 'ai_tool', index: 0 }]] },
    }, settings: { executionOrder: 'v1', executionTimeout: 35, saveManualExecutions: true, saveDataSuccessExecution: 'all', saveDataErrorExecution: 'all' } };
}
function assess(scenario, trace, stats, agentAttempts, allStats) {
  assert.equal(trace.status, 'success', 'The workflow must finish by returning a result or a controlled incident.');
  assert.equal(trace.workflow_error, null, 'No unhandled workflow error may remain.');
  assert(stats?.synthetic_auth_only, 'Only the exact synthetic credential may reach the fake API.');
  assert(stats.requests >= 1, 'The actual native model node must call the fake endpoint.');
  if (scenario.recovery) {
    assert.equal(stats.requests, scenario.expectedRequests, 'A bounded retry must recover on the second request.');
    assert.equal(trace.incident_output.length, 0, 'A recovered request must not reach the error branch.');
    assert(trace.agent_output.some(item => item.output === marker), 'The agent must return the successful synthetic model response.');
    return { outcome: 'recovered', requests: stats.requests };
  }
  assert(stats.requests <= Math.max(scenario.maxRequests, agentAttempts), 'The bounded retry policy must not exceed the expected fake API request count.');
  if (scenario.afterTool) {
    assert(stats.requests >= 2, 'The injected failure must follow a successful function-call response.');
    assert(allStats.synthetic_tool_requests >= 1, 'The native tool node must actually contact the synthetic tool server.');
    assert(trace.nodes.some(node => node.name === 'Outil synthétique' && node.runs.some(run => run.status === 'success')), 'The tool must succeed before the model failure.');
  }
  assert.equal(trace.incident_output.length, 1, 'The actual incident Code node must return exactly one item.');
  const output = trace.incident_output[0];
  assert.equal(output.status, 'technical_error');
  assert.equal(output.incident?.code, scenario.expected, 'The normalized runtime error must be classified correctly.');
  assert.equal(output.incident?.retryable, scenario.retryable);
  assert.equal(output.incident?.reference, `chantier-${trace.id}`);
  assert.equal(output.no_order_placed, true);
  assert(typeof output.output === 'string' && output.output.includes(output.incident.reference));
  assert(!/sk-|Bearer|BROKEN_SYNTHETIC|SYNTHETIC-KEY|stack|http:\/\/fault-api|\/v1\/responses/i.test(output.output), 'The user message must not expose raw diagnostics, keys or fake service details.');
  return { outcome: 'controlled_incident', code: output.incident.code, retryable: output.incident.retryable, requests: stats.requests,
    ...(scenario.afterTool ? { successful_synthetic_tool_calls: allStats.synthetic_tool_requests } : {}) };
}

if (!process.argv.includes('--run') || process.argv.includes('--dry-run')) {
  console.log(JSON.stringify({ mode: 'dry_run', agent_retry_probe: agentRetryProbe, cases, isolation: 'Fresh n8n database and containers; internal Docker network; exact synthetic credential; no production mounts, imports, restarts or API calls.',
    n8n_image: n8nImage, mock_image: mockImage, command: 'node chantier/test-agent-incidents.mjs --run',
    note: 'The current public agent/model/error handler are cloned. CLI --file is unsupported in this n8n release: import and execution occur only in the disposable database.' }, null, 2));
} else {
  const suffix = `${new Date().toISOString().replace(/\D/g, '').slice(0, 17)}-${randomBytes(3).toString('hex')}`;
  const prefix = `chantier-incidents-${suffix}`;
  const network = `${prefix}-net`, volume = `${prefix}-db`, mock = `${prefix}-mock`, runner = `${prefix}-n8n`;
  const directory = resolve(root, 'work/chantier-incidents', prefix), fixtures = resolve(directory, 'fixtures');
  mkdirSync(fixtures, { recursive: true, mode: 0o755 });
  const persist = (name, data) => writeFileSync(resolve(directory, `${name}.json`), JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  const created = { network: false, volume: false, mock: false, runner: false };
  const results = []; let topError;
  const cleanup = () => {
    for (const [name, present] of [[runner, created.runner], [mock, created.mock]]) if (present) docker(['rm', '-f', name], { check: false, timeout: 20000 });
    if (created.volume) docker(['volume', 'rm', volume], { check: false, timeout: 20000 });
    if (created.network) docker(['network', 'rm', network], { check: false, timeout: 20000 });
  };
  const onInterrupt = () => { cleanup(); process.exit(130); };
  process.once('SIGINT', onInterrupt); process.once('SIGTERM', onInterrupt);
  try {
    docker(['image', 'inspect', n8nImage]); docker(['image', 'inspect', mockImage]); // Do not pull images.
    const template = JSON.parse(readFileSync(resolve(root, 'chantier/workflow.json'), 'utf8'));
    assert.equal(template.id, 'atelierAgentChantier01', 'Clone only the expected public workflow.');
    assert(!template.nodes.some(node => node.credentials), 'Public source must not contain production credential references.');
    const workflows = cases.map(scenario => fixtureWorkflow(template, scenario, `synthetic_${scenario.id}`));
    const credentials = cases.map(scenario => ({ id: `synthetic_${scenario.id}`, name: `SYNTHETIC ONLY ${scenario.id}`, type: 'openAiApi', data: { apiKey: key, url: `http://fault-api:3000/${scenario.id}/v1` } }));
    writeFileSync(resolve(fixtures, 'mock.mjs'), mockSource, { mode: 0o644 });
    writeFileSync(resolve(fixtures, 'workflows.json'), JSON.stringify(workflows), { mode: 0o644 });
    writeFileSync(resolve(fixtures, 'credentials-SYNTHETIC-ONLY.json'), JSON.stringify(credentials), { mode: 0o644 });
    const agentAttempts = workflows[0].nodes.find(node => node.name === 'Agent achats chantier').retryOnFail ? 2 : 1;
    persist('source', { workflow_sha256: createHash('sha256').update(JSON.stringify(template)).digest('hex'), incident_code_sha256: createHash('sha256').update(template.nodes.find(node => node.name === 'Expliquer l’incident').parameters.jsCode).digest('hex'), n8n_image: n8nImage, agent_retry_probe: agentRetryProbe, agent_attempts: agentAttempts,
      model_max_retries: workflows[0].nodes.find(node => node.name === 'Modèle OpenAI').parameters.options.maxRetries });
    docker(['network', 'create', '--internal', network]); created.network = true;
    docker(['volume', 'create', volume]); created.volume = true;
    docker(['run', '-d', '--pull=never', '--name', mock, '--network', network, '--network-alias', 'fault-api', '--read-only', '--tmpfs', '/tmp', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '-v', `${fixtures}:/fixtures:ro`, mockImage, 'node', '/fixtures/mock.mjs']); created.mock = true;
    docker(['run', '-d', '--pull=never', '--name', runner, '--network', network, '--user', '0', '--entrypoint', 'sh',
      '--cap-drop', 'ALL', '--cap-add', 'CHOWN', '--security-opt', 'no-new-privileges', '-v', `${fixtures}:/fixtures:ro`, '-v', `${volume}:/home/node/.n8n`,
      '-e', 'N8N_DIAGNOSTICS_ENABLED=false', '-e', 'N8N_PERSONALIZATION_ENABLED=false', '-e', 'N8N_VERSION_NOTIFICATIONS_ENABLED=false',
      '-e', 'N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true', '-e', 'N8N_LOG_LEVEL=warn',
      n8nImage, '-c', 'chown -R 1000:1000 /home/node/.n8n && exec sleep infinity']); created.runner = true;
    for (let pass = 0; pass < 20; pass++) {
      const health = docker(['exec', runner, 'node', '-e', "fetch('http://fault-api:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"], { check: false, timeout: 5000 });
      if (health.status === 0) break;
      if (pass === 19) throw new Error('The isolated fake API did not become ready.');
      await sleep(200);
    }
    console.log('Environnement jetable prêt : réseau interne, base neuve, connexion synthétique.');
    const cli = args => docker(['exec', '--user', '1000:1000', runner, 'n8n', ...args], { timeout: 150000 });
    const importedCredentials = cli(['import:credentials', '--input=/fixtures/credentials-SYNTHETIC-ONLY.json']);
    writeFileSync(resolve(directory, 'credential-import.log'), importedCredentials.stdout + importedCredentials.stderr, { mode: 0o600 });
    const importedWorkflows = cli(['import:workflow', '--input=/fixtures/workflows.json']);
    writeFileSync(resolve(directory, 'workflow-import.log'), importedWorkflows.stdout + importedWorkflows.stderr, { mode: 0o600 });
    for (const scenario of cases) {
      const started = Date.now(); let trace, stats;
      console.log(`DÉBUT ${scenario.id} : aucun appel API réel.`);
      try {
        const execution = cli(['execute', `--id=incident_${scenario.id}`, '--rawOutput']);
        // These logs contain synthetic data only and remain private/ignored.
        writeFileSync(resolve(directory, `${scenario.id}-cli.log`), execution.stdout + execution.stderr, { mode: 0o600 });
        trace = JSON.parse(docker(['exec', '-i', runner, 'node', '-', `incident_${scenario.id}`], { input: traceReader }).stdout);
        persist(`${scenario.id}-trace`, trace);
        const allStats = JSON.parse(docker(['exec', runner, 'node', '-e', "fetch('http://fault-api:3000/stats').then(r=>r.text()).then(t=>process.stdout.write(t))"]).stdout);
        stats = allStats.stats[scenario.id]; persist('mock-stats', allStats);
        results.push({ case: scenario.id, passed: true, duration_ms: Date.now() - started, execution_id: trace.id, agent_attempts: agentAttempts, ...assess(scenario, trace, stats, agentAttempts, allStats.stats) });
      } catch (error) {
        results.push({ case: scenario.id, passed: false, duration_ms: Date.now() - started,
          error: String(error.message).split('\n')[0].slice(0, 800), execution_id: trace?.id ?? null, requests: stats?.requests ?? null });
      }
      console.log(JSON.stringify(results.at(-1)));
      persist('summary', { created_at: new Date().toISOString(), results, planned_cases: cases.length, real_model_calls: 0, isolation: 'new_database_internal_network_synthetic_credential' });
    }
  } catch (error) { topError = String(error.message).slice(0, 1000); console.error(topError); }
  finally { cleanup(); process.removeListener('SIGINT', onInterrupt); process.removeListener('SIGTERM', onInterrupt); }
  const leftovers = [];
  for (const [kind, name] of [['container', runner], ['container', mock], ['volume', volume], ['network', network]]) {
    if (docker([kind, 'inspect', name], { check: false, timeout: 15000 }).status === 0) leftovers.push({ kind, name });
  }
  const passed = !topError && results.length === cases.length && results.every(result => result.passed) && leftovers.length === 0;
  const summary = { passed, created_at: new Date().toISOString(), real_model_calls: 0, agent_retry_probe: agentRetryProbe, planned_cases: cases.length, results, top_error: topError ?? null, leftovers, directory };
  persist('summary', summary); console.log(JSON.stringify(summary, null, 2)); process.exitCode = passed ? 0 : 1;
}

#!/usr/bin/env bash
# Explicit local install. Uses the existing local OpenAI key without printing it.
set -euo pipefail
umask 077
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
TASK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TASK_ROOT"
TASK_ID=atelierAgentChantier01
TASK_CREDENTIAL_ID=atelierChantierOpenAI
TASK_CONTAINER=n8n-desktop-n8n-1
TASK_REMOTE="/tmp/chantier-install-$$"
TASK_LOCAL="local-files/chantier-install-$$"
cleanup() {
  docker exec "$TASK_CONTAINER" rm -f "$TASK_REMOTE-workflow.json" "$TASK_REMOTE-credential.json" "$TASK_REMOTE-backup.json" >/dev/null 2>&1 || true
  rm -f "$TASK_LOCAL-credential.json"
}
trap cleanup EXIT
test -s local-files/openai-api-key || { echo 'Clé OpenAI locale existante requise (local-files/openai-api-key).' >&2; exit 1; }
node chantier/build-workflow.mjs
# Embed the current source and locked PDF dependency into the tools image.
docker compose -f compose.yaml -f compose.chantier.yaml build chantier-api
bash chantier/start.sh

TASK_PROJECT_ID="$(docker exec -i "$TASK_CONTAINER" node - <<'JS'
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('/home/node/.n8n/database.sqlite',{readOnly:true});
const rows=db.prepare("SELECT id FROM project WHERE type='personal'").all();
if(rows.length!==1) throw new Error('Un projet personnel unique est requis pour cette installation locale.');
console.log(rows[0].id);db.close();
JS
)"
[[ "$TASK_PROJECT_ID" =~ ^[A-Za-z0-9_-]+$ ]] || exit 1
TASK_STATE="$(docker exec -i "$TASK_CONTAINER" node - <<'JS'
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('/home/node/.n8n/database.sqlite',{readOnly:true});
const wf=!!db.prepare('SELECT id FROM workflow_entity WHERE id=?').get('atelierAgentChantier01');
const cr=!!db.prepare('SELECT id FROM credentials_entity WHERE id=?').get('atelierChantierOpenAI');
console.log(`${wf ? 'existing' : 'new'} ${cr ? 'credential-present' : 'credential-missing'}`);db.close();
JS
)"
if [[ "$TASK_STATE" = existing* ]]; then
  mkdir -p backups
  docker exec "$TASK_CONTAINER" n8n export:workflow --id="$TASK_ID" --output="$TASK_REMOTE-backup.json" >/dev/null
  docker cp "$TASK_CONTAINER:$TASK_REMOTE-backup.json" "backups/chantier-before-install-$(date +%Y%m%d-%H%M%S).json" >/dev/null
fi
if [[ "$TASK_STATE" = *credential-missing ]]; then
  TASK_CREDENTIAL_FILE="$TASK_LOCAL-credential.json" node --input-type=module - <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const apiKey=readFileSync('local-files/openai-api-key','utf8').trim();
if(!apiKey || /\s/.test(apiKey)) throw new Error('Clé locale invalide.');
writeFileSync(process.env.TASK_CREDENTIAL_FILE,JSON.stringify([{id:'atelierChantierOpenAI',name:'OpenAI · Agent achats chantier',type:'openAiApi',data:{apiKey,url:'https://api.openai.com/v1'}}]),{mode:0o600});
JS
  docker exec -i -e "TASK_IMPORT_PATH=$TASK_REMOTE-credential.json" "$TASK_CONTAINER" node -e 'require("node:fs").writeFileSync(process.env.TASK_IMPORT_PATH,require("node:fs").readFileSync(0),{mode:0o600})' < "$TASK_LOCAL-credential.json"
  docker exec "$TASK_CONTAINER" n8n import:credentials --input="$TASK_REMOTE-credential.json" --projectId="$TASK_PROJECT_ID"
fi
docker exec -i -e "TASK_IMPORT_PATH=$TASK_REMOTE-workflow.json" "$TASK_CONTAINER" node -e 'require("node:fs").writeFileSync(process.env.TASK_IMPORT_PATH,require("node:fs").readFileSync(0),{mode:0o600})' < local-files/03-agent-achats-chantier.json
docker exec "$TASK_CONTAINER" n8n import:workflow --input="$TASK_REMOTE-workflow.json" --projectId="$TASK_PROJECT_ID"
docker exec "$TASK_CONTAINER" n8n publish:workflow --id="$TASK_ID"
docker restart "$TASK_CONTAINER" >/dev/null
docker compose -f compose.yaml -f compose.chantier.yaml up -d --wait --wait-timeout 180 n8n chantier-api
echo "Agent publié : http://localhost:5678/workflow/$TASK_ID"
echo "Chat : http://localhost:5678/webhook/atelier-agent-chantier/chat"

#!/usr/bin/env bash
# Explicit install/update: backup, import, publish, then restart n8n.
set -euo pipefail
umask 077
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
TASK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TASK_ROOT"
TASK_WORKFLOW=''
TASK_OPEN=1
while [ "$#" -gt 0 ]; do
  case "$1" in
    --no-open) TASK_OPEN=0; shift ;;
    --public) TASK_WORKFLOW="$TASK_ROOT/workflows/02-qualification-ia.json"; shift ;;
    --workflow)
      if [ "$#" -lt 2 ]; then echo "--workflow attend un fichier JSON." >&2; exit 2; fi
      TASK_WORKFLOW="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: scripts/install-demo.sh [--no-open] [--public | --workflow fichier.json]"
      echo "Importe et publie explicitement la démo. Sauvegarde l’ancien workflow avant remplacement."
      echo "Par défaut : copie privée local-files/02-qualification-ia.json si présente, sinon export public."
      echo "N8N_PROJECT_ID permet de choisir le projet si plusieurs projets sont disponibles."
      exit 0 ;;
    *) echo "Option inconnue : $1" >&2; exit 2 ;;
  esac
done
if [ -z "$TASK_WORKFLOW" ]; then
  if [ -f local-files/02-qualification-ia.json ]; then
    TASK_WORKFLOW="$TASK_ROOT/local-files/02-qualification-ia.json"
  else
    TASK_WORKFLOW="$TASK_ROOT/workflows/02-qualification-ia.json"
  fi
fi
if [ ! -f "$TASK_WORKFLOW" ]; then echo "Workflow introuvable : $TASK_WORKFLOW" >&2; exit 1; fi

./scripts/start-demo.sh --no-open
source "$TASK_ROOT/scripts/demo-compose.sh"
build_demo_compose "$TASK_ROOT"
TASK_ID=atelierQualificationIA01
TASK_REMOTE_INPUT="/tmp/atelier-install-$$.json"
TASK_REMOTE_BACKUP="/tmp/atelier-backup-$$.json"
cleanup() {
  "${TASK_COMPOSE[@]}" exec -T n8n rm -f "$TASK_REMOTE_INPUT" "$TASK_REMOTE_BACKUP" >/dev/null 2>&1 || true
}
trap cleanup EXIT
"${TASK_COMPOSE[@]}" exec -T -e "DEMO_INPUT_PATH=$TASK_REMOTE_INPUT" n8n node -e 'const fs=require("node:fs"); fs.writeFileSync(process.env.DEMO_INPUT_PATH,fs.readFileSync(0),{mode:0o600});' < "$TASK_WORKFLOW"
"${TASK_COMPOSE[@]}" exec -T -e "DEMO_INPUT_PATH=$TASK_REMOTE_INPUT" n8n node - <<'JS'
const fs = require('node:fs');
const workflow = JSON.parse(fs.readFileSync(process.env.DEMO_INPUT_PATH, 'utf8'));
if (workflow.id !== 'atelierQualificationIA01' || !Array.isArray(workflow.nodes)) {
  console.error('Fichier refusé : un export de la démo atelierQualificationIA01 est requis.');
  process.exit(1);
}
JS

# Read only the project binding and IDs, never credential or user records.
TASK_DISCOVERY="$("${TASK_COMPOSE[@]}" exec -T -e "DEMO_TARGET_PROJECT_ID=${N8N_PROJECT_ID:-}" n8n node - <<'JS'
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/home/node/.n8n/database.sqlite', { readOnly: true });
const id = 'atelierQualificationIA01';
const exists = Boolean(db.prepare('SELECT id FROM workflow_entity WHERE id=?').get(id));
let project;
if (process.env.DEMO_TARGET_PROJECT_ID) {
  project = db.prepare('SELECT id FROM project WHERE id=?').get(process.env.DEMO_TARGET_PROJECT_ID);
  if (!project) { console.error('N8N_PROJECT_ID ne correspond à aucun projet existant.'); process.exit(1); }
} else {
  project = db.prepare('SELECT projectId AS id FROM shared_workflow WHERE workflowId=? AND role=?').get(id, 'workflow:owner');
  if (!project) {
    const projects = db.prepare("SELECT id FROM project WHERE type='personal'").all();
    if (projects.length !== 1) {
      console.error(projects.length === 0
        ? 'Créer d’abord le compte propriétaire dans n8n, puis relancer l’installation.'
        : 'Plusieurs projets personnels : définir N8N_PROJECT_ID pour choisir la destination.');
      process.exit(1);
    }
    project = projects[0];
  }
}
console.log(project.id);
console.log(exists ? 'existing' : 'new');
db.close();
JS
)"
TASK_PROJECT_ID="${TASK_DISCOVERY%%$'\n'*}"
TASK_EXISTING="${TASK_DISCOVERY##*$'\n'}"
if [[ ! "$TASK_PROJECT_ID" =~ ^[A-Za-z0-9_-]+$ ]]; then echo "Identifiant de projet invalide." >&2; exit 1; fi

if [ "$TASK_EXISTING" = existing ]; then
  mkdir -p backups
  TASK_BACKUP="backups/qualification-before-install-$(date +%Y%m%d-%H%M%S)-$$.json"
  "${TASK_COMPOSE[@]}" exec -T n8n n8n export:workflow --id="$TASK_ID" --output="$TASK_REMOTE_BACKUP" >/dev/null
  "${TASK_COMPOSE[@]}" cp "n8n:$TASK_REMOTE_BACKUP" "$TASK_BACKUP" >/dev/null
  chmod 600 "$TASK_BACKUP"
  echo "Ancienne version sauvegardée dans $TASK_BACKUP (ignoré par Git)."
fi

echo "Installation explicite de la démo depuis $TASK_WORKFLOW…"
"${TASK_COMPOSE[@]}" exec -T n8n n8n import:workflow --input="$TASK_REMOTE_INPUT" --projectId="$TASK_PROJECT_ID"
"${TASK_COMPOSE[@]}" exec -T n8n n8n publish:workflow --id="$TASK_ID"
echo "Redémarrage de n8n pour charger la version publiée…"
"${TASK_COMPOSE[@]}" restart n8n
"${TASK_COMPOSE[@]}" up -d --wait --wait-timeout 240 n8n qualification-api
TASK_N8N_ADDRESS="$("${TASK_COMPOSE[@]}" port n8n 5678)"
TASK_N8N_PORT="${TASK_N8N_ADDRESS##*:}"
echo "Workflow prêt : http://localhost:$TASK_N8N_PORT/workflow/$TASK_ID"
echo "Tableau de relecture : http://localhost:8787"
echo "Les prochains démarrages utilisent Start-Demo.command sans réimporter le workflow."
if [ "$TASK_OPEN" -eq 1 ] && command -v open >/dev/null 2>&1; then
  open "http://localhost:$TASK_N8N_PORT/workflow/$TASK_ID"
fi

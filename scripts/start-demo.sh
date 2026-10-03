#!/usr/bin/env bash
# Start the existing installation. This script never imports a workflow.
set -euo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
TASK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TASK_ROOT"
TASK_OPEN=1
for TASK_ARG in "$@"; do
  case "$TASK_ARG" in
    --no-open) TASK_OPEN=0 ;;
    -h|--help)
      echo "Usage: scripts/start-demo.sh [--no-open]"
      echo "Démarre Docker, Ollama local et les services existants, sans réimporter le workflow."
      exit 0 ;;
    *) echo "Option inconnue : $TASK_ARG" >&2; exit 2 ;;
  esac
done
TASK_COMPOSE=(docker compose -f compose.yaml -f compose.demo.yaml)

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker Desktop est requis : https://www.docker.com/products/docker-desktop/" >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 est requis. Mettre à jour Docker Desktop." >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  if command -v open >/dev/null 2>&1; then open -a Docker; fi
  echo "Démarrage de Docker Desktop…"
  TASK_DOCKER_READY=0
  for ((TASK_ATTEMPT=0; TASK_ATTEMPT<90; TASK_ATTEMPT++)); do
    if docker info >/dev/null 2>&1; then TASK_DOCKER_READY=1; break; fi
    sleep 2
  done
  if [ "$TASK_DOCKER_READY" -ne 1 ]; then
    echo "Docker n’est pas prêt. Ouvrir Docker Desktop puis relancer ce script." >&2
    exit 1
  fi
fi
if ! command -v curl >/dev/null 2>&1; then echo "curl est requis." >&2; exit 1; fi
TASK_OLLAMA_BIN="$(command -v ollama || true)"
if [ -z "$TASK_OLLAMA_BIN" ] && [ -x /Applications/Ollama.app/Contents/Resources/ollama ]; then
  TASK_OLLAMA_BIN=/Applications/Ollama.app/Contents/Resources/ollama
fi
if [ -z "$TASK_OLLAMA_BIN" ]; then
  echo "Ollama est requis : https://ollama.com/download" >&2
  exit 1
fi
# Explicitly constrain a daemon started by this script to the loopback interface.
export OLLAMA_HOST=127.0.0.1:11434
if ! curl -fsS --max-time 2 http://127.0.0.1:11434/api/version >/dev/null 2>&1; then
  umask 077
  mkdir -p runtime
  echo "Démarrage d’Ollama sur 127.0.0.1:11434…"
  nohup "$TASK_OLLAMA_BIN" serve >runtime/ollama.log 2>&1 </dev/null &
  TASK_OLLAMA_PID=$!
  printf '%s\n' "$TASK_OLLAMA_PID" >runtime/ollama.pid
  TASK_OLLAMA_READY=0
  for ((TASK_ATTEMPT=0; TASK_ATTEMPT<60; TASK_ATTEMPT++)); do
    if curl -fsS --max-time 2 http://127.0.0.1:11434/api/version >/dev/null 2>&1; then TASK_OLLAMA_READY=1; break; fi
    if ! kill -0 "$TASK_OLLAMA_PID" 2>/dev/null; then break; fi
    sleep 1
  done
  if [ "$TASK_OLLAMA_READY" -ne 1 ]; then
    echo "Ollama n’a pas démarré. Consulter runtime/ollama.log (fichier ignoré par Git)." >&2
    exit 1
  fi
fi
if ! "$TASK_OLLAMA_BIN" show qwen2.5:3b >/dev/null 2>&1; then
  echo "Téléchargement initial du modèle local qwen2.5:3b (environ 1,9 Go)…"
  "$TASK_OLLAMA_BIN" pull qwen2.5:3b
fi

echo "Démarrage des services n8n et du tableau de relecture…"
"${TASK_COMPOSE[@]}" up -d --wait --wait-timeout 240 n8n qualification-api
TASK_N8N_ADDRESS="$("${TASK_COMPOSE[@]}" port n8n 5678)"
TASK_N8N_PORT="${TASK_N8N_ADDRESS##*:}"
echo "Tableau de relecture : http://localhost:8787"
echo "Éditeur n8n : http://localhost:$TASK_N8N_PORT"
echo "Le workflow installé est conservé. Première installation : scripts/install-demo.sh"
if [ "$TASK_OPEN" -eq 1 ] && command -v open >/dev/null 2>&1; then
  open http://localhost:8787
fi

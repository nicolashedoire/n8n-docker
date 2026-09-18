#!/bin/bash
set -euo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")"
if ! command -v docker >/dev/null; then
  echo "Installe Docker Desktop : https://www.docker.com/products/docker-desktop/"
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  open -a Docker
  echo "Démarrage de Docker Desktop…"
  ready=0
  for i in {1..60}; do
    if docker info >/dev/null 2>&1; then ready=1; break; fi
    sleep 2
  done
  if [ "$ready" -ne 1 ]; then echo "Docker n'est pas prêt. Ouvre Docker Desktop puis réessaie."; exit 1; fi
fi
docker compose up -d --wait --wait-timeout 240
# Lire le port réellement publié par Compose (y compris la configuration .env).
address=$(docker compose port n8n 5678)
port=${address##*:}
echo "n8n est prêt : http://localhost:$port"
open "http://localhost:$port"

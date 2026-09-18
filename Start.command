#!/bin/bash
set -euo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")"
if ! command -v docker >/dev/null; then
  echo "Install Docker Desktop : https://www.docker.com/products/docker-desktop/"
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  open -a Docker
  echo "Starting Docker Desktop…"
  ready=0
  for i in {1..60}; do
    if docker info >/dev/null 2>&1; then ready=1; break; fi
    sleep 2
  done
  if [ "$ready" -ne 1 ]; then echo "Docker is not ready. Open Docker Desktop and try again."; exit 1; fi
fi
docker compose up -d --wait --wait-timeout 240
# Read the port published by Compose, including any .env override.
address=$(docker compose port n8n 5678)
port=${address##*:}
echo "n8n is ready: http://localhost:$port"
open "http://localhost:$port"

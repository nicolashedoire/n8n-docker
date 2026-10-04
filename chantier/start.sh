#!/usr/bin/env bash
set -euo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
TASK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TASK_ROOT"
docker info >/dev/null
docker compose -f compose.yaml -f compose.chantier.yaml up -d --wait --wait-timeout 180 n8n chantier-api
echo "Éditeur : http://localhost:5678/workflow/atelierAgentChantier01"
echo "Chat : http://localhost:5678/webhook/atelier-agent-chantier/chat"
echo "Outils : http://localhost:8788/health"

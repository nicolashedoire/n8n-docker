#!/usr/bin/env bash
# Source this file, then call build_demo_compose to populate TASK_COMPOSE.
# As a command, it forwards arguments to the same provider-aware Compose command.
# Environment files are parsed by Compose; their contents are never sourced by Bash.

build_demo_compose() {
  local TASK_DEMO_ROOT
  TASK_DEMO_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
  TASK_COMPOSE=(docker compose)
  if [ -f "$TASK_DEMO_ROOT/.env" ]; then
    TASK_COMPOSE+=(--env-file "$TASK_DEMO_ROOT/.env")
  fi
  if [ -f "$TASK_DEMO_ROOT/.env.demo" ]; then
    TASK_COMPOSE+=(--env-file "$TASK_DEMO_ROOT/.env.demo")
  fi
  TASK_COMPOSE+=(-f "$TASK_DEMO_ROOT/compose.yaml" -f "$TASK_DEMO_ROOT/compose.demo.yaml")

  # Compose resolves dotenv syntax and shell precedence. Only the provider value
  # leaves this pipe; other environment values are never printed or evaluated.
  if ! TASK_LLM_PROVIDER="$(
    set -o pipefail
    "${TASK_COMPOSE[@]}" config --environment | awk '
      /^LLM_PROVIDER=/ { sub(/^LLM_PROVIDER=/, ""); print; found=1 }
      END { if (!found) print "ollama" }
    '
  )"; then
    echo "Impossible de lire la configuration Compose de la démonstration." >&2
    return 1
  fi
  TASK_LLM_PROVIDER="${TASK_LLM_PROVIDER:-ollama}"
  case "$TASK_LLM_PROVIDER" in
    ollama) ;;
    openai) TASK_COMPOSE+=(-f "$TASK_DEMO_ROOT/compose.openai.yaml") ;;
    *) echo "LLM_PROVIDER doit valoir ollama ou openai." >&2; return 1 ;;
  esac
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  set -euo pipefail
  if [ "$#" -eq 0 ] || [ "${1:-}" = --help ]; then
    echo "Usage: bash scripts/demo-compose.sh <commande Compose> [arguments]"
    echo "Utilise .env, puis .env.demo si présent ; ajoute le montage secret uniquement pour OpenAI."
    exit 0
  fi
  build_demo_compose
  exec "${TASK_COMPOSE[@]}" "$@"
fi

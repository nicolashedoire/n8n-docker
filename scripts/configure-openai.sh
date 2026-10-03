#!/usr/bin/env bash
# Run interactively: never pass an API key as a command-line argument.
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TASK_ROOT"
umask 077
mkdir -p local-files
echo "Configuration OpenAI pour L’Atelier n8n"
echo "Collez votre clé API OpenAI ci-dessous, puis Entrée. La saisie est masquée."
echo "Elle sera enregistrée uniquement dans local-files/openai-api-key (ignoré par Git)."
echo "Pour annuler : Ctrl+C."
IFS= read -r -s -p "Clé API : " TASK_OPENAI_KEY
printf '\n'
if [[ ! "$TASK_OPENAI_KEY" =~ ^sk-[A-Za-z0-9_-]{20,}$ ]]; then
  echo "Format de clé invalide : aucun fichier modifié." >&2
  exit 1
fi
printf '%s' "$TASK_OPENAI_KEY" >local-files/openai-api-key
chmod 600 local-files/openai-api-key
unset TASK_OPENAI_KEY
printf 'LLM_PROVIDER=openai\nOPENAI_MODEL=gpt-5.6-terra\n' >.env.demo
chmod 600 .env.demo
echo "Clé enregistrée localement. Configuration OpenAI prête au prochain démarrage."

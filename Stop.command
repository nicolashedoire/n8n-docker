#!/bin/bash
set -euo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")"
docker compose stop
echo "n8n is stopped. Your workflows and account are preserved."

#!/usr/bin/env bash
# Attach a finished social card to an Asana task.
#
#   attach-card.sh <task_gid> <card.jpg>
#
# Needs ASANA_TOKEN (a personal access token from
# app.asana.com → Settings → Apps → Developer apps → Personal access tokens).
# The Asana MCP connector has no attachment-upload tool, so this is the only
# path that puts the image ON the card rather than linking to it from elsewhere.
#
# Put it in wet-ink-ops/.env as a line `ASANA_TOKEN=...` — this script reads it
# from there. Do NOT rely on exporting it in a shell: the daily scheduled run
# does not inherit an interactive shell's environment.
set -euo pipefail

[ $# -eq 2 ] || { sed -n '2,5p' "$0"; exit 1; }
TASK="$1"; FILE="$2"

# env wins; otherwise read the repo .env (gitignored)
if [ -z "${ASANA_TOKEN:-}" ]; then
  ENV_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/.env"
  if [ -f "$ENV_FILE" ]; then
    ASANA_TOKEN=$(grep -E '^[[:space:]]*ASANA_TOKEN=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"'"'"' \r')
  fi
fi
: "${ASANA_TOKEN:?ASANA_TOKEN not set and not found in wet-ink-ops/.env — see header}"
[ -f "$FILE" ] || { echo "no such file: $FILE" >&2; exit 1; }

curl -sf -X POST https://app.asana.com/api/1.0/attachments \
  -H "Authorization: Bearer $ASANA_TOKEN" \
  -F "parent=$TASK" \
  -F "file=@$FILE" \
| python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]; print("attached:", d["name"], d.get("permanent_url",""))'

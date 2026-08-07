#!/usr/bin/env bash
# Attach a finished social card to an Asana task.
#
#   attach-card.sh <task_gid> <card.jpg>
#
# Needs ASANA_TOKEN (a personal access token from
# app.asana.com → Settings → Apps → Developer apps → Personal access tokens).
# The Asana MCP connector has no attachment-upload tool, so this is the only
# path that puts the image ON the card rather than linking to it from elsewhere.
set -euo pipefail

[ $# -eq 2 ] || { sed -n '2,5p' "$0"; exit 1; }
TASK="$1"; FILE="$2"

: "${ASANA_TOKEN:?ASANA_TOKEN is not set — see header}"
[ -f "$FILE" ] || { echo "no such file: $FILE" >&2; exit 1; }

curl -sf -X POST https://app.asana.com/api/1.0/attachments \
  -H "Authorization: Bearer $ASANA_TOKEN" \
  -F "parent=$TASK" \
  -F "file=@$FILE" \
| python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]; print("attached:", d["name"], d.get("permanent_url",""))'

#!/usr/bin/env bash
# ONE command for a Wet Ink social card: generate the art, composite the card,
# and (if a task gid is given and ASANA_TOKEN is set) attach it to the task.
#
#   wetink-card.sh "<headline>" <beat> "<subject brief>" [task_gid]
#
#   headline  4-8 words, hook first. NOT the outlet's headline.
#   beat      industry | business | creators | features | galleries | "side notes"
#   subject   ONE concrete physical object or scene. Never a real person.
#   task_gid  optional — Asana task to attach to. Omit to just make the file.
#
# Prints the path to the finished card on the last line.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ $# -ge 3 ] || { sed -n '2,12p' "$0"; exit 1; }
HEADLINE="$1"; BEAT="$2"; SUBJECT="$3"; TASK="${4:-}"

# slug the headline so runs don't collide
SLUG=$(printf '%s' "$HEADLINE" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | cut -c1-40 | sed 's/-$//')
OUT="/tmp/wetink-card-${SLUG}.jpg"

"$HERE/make-card.sh" "$HEADLINE" "$BEAT" "$SUBJECT" "$OUT"

if [ -n "$TASK" ]; then
  if [ -n "${ASANA_TOKEN:-}" ]; then
    "$HERE/attach-card.sh" "$TASK" "$OUT"
  else
    echo "WARNING: ASANA_TOKEN not set — card built but NOT attached to task $TASK" >&2
    echo "         Report this in the run report; do not silently drop it." >&2
  fi
fi

echo "$OUT"

#!/usr/bin/env bash
# Wet Ink news desk — Phase 2.5 already-covered check.
#
# Asks the live site whether Wet Ink has already published on a story, so the
# desk doesn't re-file something the magazine already ran (which is exactly
# what happened with the Aylo/Pornhub Montreal shooting on the first test run).
#
# Usage:  wetink-covered.sh "Eporner" "Briskin" "jurisdiction"
#
# Prints one block per search term: post id, date, title, link — or NO MATCH.
#
# This exists as a script, not an inline curl, for a boring but important
# reason: the inline form embedded the search term AND a $(date +%s) cache
# buster in the command string, so every call was a byte-different command and
# could never match a stored permission rule. One prompt per story, per run,
# forever. A fixed script path is a stable prefix that can be allowed once.
#
# Reading the result: a hit only counts as already-covered if it is the SAME
# story — distinctive-entity overlap AND publish date within roughly ±10 days.
# Searching "Pornhub" returns awards posts that share the entity but are a
# different story. When uncertain, draft it and flag "possible existing
# coverage" on the card rather than silently skipping.

set -uo pipefail

if [ $# -eq 0 ]; then
  sed -n '2,22p' "$0"
  exit 2
fi

UA="WetInkNewsDesk/1.0"
BASE="https://wetinkmag.com/wp-json/wp/v2/posts"

for term in "$@"; do
  enc=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$term")
  echo "=== $term ==="
  curl -sS -m 25 -A "$UA" \
    "${BASE}?search=${enc}&per_page=5&_fields=id,date,link,title&_cb=$(date +%s)" \
  | python3 -c '
import sys, json, html
try:
    posts = json.load(sys.stdin)
except Exception:
    print("  (could not parse response)"); sys.exit(0)
if not isinstance(posts, list) or not posts:
    print("  NO MATCH"); sys.exit(0)
for p in posts:
    title = html.unescape(p.get("title", {}).get("rendered", ""))
    print(f'"'"'  [{p.get("id")}] {p.get("date","")[:10]}  {title}'"'"')
    print(f'"'"'        {p.get("link","")}'"'"')
'
  echo
done

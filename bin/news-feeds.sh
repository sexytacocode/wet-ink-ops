#!/usr/bin/env bash
# Wet Ink news desk — RSS tier.
#
# Pulls every configured feed, filters to a trailing window, and prints one
# TSV row per item:  ISO_DATE <TAB> SOURCE <TAB> TITLE <TAB> URL
#
# Why this exists: the desk used to WebFetch each outlet's HTML index page and
# let the model read dates off the page. That produced repeated stale-news
# near-misses (a 2022 Visa ruling nearly filed as breaking on 2026-07-16) and a
# permission prompt per new domain. RSS carries a publisher-supplied <pubDate>,
# so the window filter here is arithmetic, not a model judgement.
#
# Usage:
#   news-feeds.sh              # last 2 days
#   news-feeds.sh --days 7     # last 7 days
#   news-feeds.sh --list       # print configured feeds and exit
#
# Dates in the output are the publisher's. Trust them over anything scraped.

set -uo pipefail

DAYS=2
LIST_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --days) DAYS="${2:-2}"; shift 2 ;;
    --list) LIST_ONLY=1; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"

# Direct publisher feeds: SOURCE|URL
# Only feeds that are ON-BEAT go here. The Guardian's /media and /technology
# feeds were tried and removed: they are general-interest firehoses (raccoons,
# Pokémon, TV listings) and drowned the real signal. The Guardian is still a
# tier-one source for this beat — it just arrives via the Google News queries
# below, which filter to the beat instead of the section.
FEEDS='
AVN|https://avn.com/feed/articles.rss
AVN Legal|https://avn.com/feed/articles/legal.rss
YNOT|https://www.ynot.com/feed/
'

# Google News RSS queries. XBIZ publishes no feed of its own, so it is covered
# via site: search. These also serve as the entity/topic sweep.
GNEWS_QUERIES='
XBIZ|site:xbiz.com
OnlyFans|OnlyFans
Aylo/Pornhub|Pornhub OR Aylo OR MindGeek
Age verification|"age verification" porn OR adult
Payments|porn OR adult "payment processor" OR debanking OR Visa OR Mastercard
Platforms|Fansly OR Chaturbate OR Streamate OR "adult platform"
Creator labor|OnlyFans "management agency" OR chatters OR exploitation
'

if [ "$LIST_ONLY" = "1" ]; then
  echo "Direct feeds:"; echo "$FEEDS" | grep -v '^$' | sed 's/^/  /'
  echo "Google News queries (window applied via when:Nd):"
  echo "$GNEWS_QUERIES" | grep -v '^$' | sed 's/^/  /'
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fetch () { curl -sS -m 30 -L -A "$UA" "$1" -o "$2" 2>/dev/null; }

# Collect: direct feeds
i=0
echo "$FEEDS" | grep -v '^$' | while IFS='|' read -r name url; do
  i=$((i+1))
  fetch "$url" "$TMP/direct-$i.xml" && echo "$name" > "$TMP/direct-$i.name"
done

# Collect: Google News
i=0
echo "$GNEWS_QUERIES" | grep -v '^$' | while IFS='|' read -r name q; do
  i=$((i+1))
  enc=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$q when:${DAYS}d")
  fetch "https://news.google.com/rss/search?q=${enc}&hl=en-US&gl=US&ceid=US:en" "$TMP/gnews-$i.xml" \
    && echo "GNews:$name" > "$TMP/gnews-$i.name"
done

python3 - "$TMP" "$DAYS" <<'PY'
import sys, os, glob, html
from email.utils import parsedate_to_datetime
from datetime import datetime, timedelta, timezone
import xml.etree.ElementTree as ET

tmp, days = sys.argv[1], int(sys.argv[2])
cutoff = datetime.now(timezone.utc) - timedelta(days=days)

# Content farms and affiliate-listicle mills that pollute the OnlyFans queries.
SPAM_DOMAINS = {
    "greenbot.com", "thecollegesoflaw.com", "outlookindia.com",
    "deccanherald.com", "theislandnow.com", "urbanmatter.com",
}
# Titles that are affiliate SEO bait, not news.
SPAM_TITLE_BITS = (
    "members-only content", "content refresh", "best onlyfans",
    "top onlyfans", "hottest onlyfans", "onlyfans accounts",
    "onlyfans models to follow", "free onlyfans",
)

def is_spam(title, src, link):
    t = title.lower()
    if any(b in t for b in SPAM_TITLE_BITS):
        return True
    if any(d in link.lower() or d.split(".")[0] in src.lower() for d in SPAM_DOMAINS):
        return True
    return False

rows, seen, dropped = [], set(), 0
for xmlf in sorted(glob.glob(os.path.join(tmp, "*.xml"))):
    namef = xmlf[:-4] + ".name"
    source = open(namef).read().strip() if os.path.exists(namef) else "?"
    try:
        root = ET.parse(xmlf).getroot()
    except ET.ParseError:
        continue
    for item in root.iter("item"):
        def t(tag):
            el = item.find(tag)
            return (el.text or "").strip() if el is not None and el.text else ""
        title, link, pub = t("title"), t("link"), t("pubDate")
        if not title or not link:
            continue
        try:
            dt = parsedate_to_datetime(pub)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        except Exception:
            continue
        if dt < cutoff:
            continue
        # Google News wraps the real outlet name in the title as " - Outlet",
        # and its <link> is a JS redirect, NOT a citable article URL.
        src = source
        if source.startswith("GNews:"):
            if " - " in title:
                title, _, outlet = title.rpartition(" - ")
                src = f"{outlet.strip()} (via GNews)"
            else:
                src = source.replace("GNews:", "") + " (via GNews)"
        title = html.unescape(title)
        if is_spam(title, src, link):
            dropped += 1
            continue
        key = title.lower()[:90]
        if key in seen:
            continue
        seen.add(key)
        rows.append((dt, src, title, link))

rows.sort(key=lambda r: r[0], reverse=True)
for dt, src, title, link in rows:
    print(f"{dt.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M')}\t{src}\t{title}\t{link}")

print(f"\n# {len(rows)} items in the last {days}d, newest first. {dropped} spam items dropped.", file=sys.stderr)
print("# Dates are publisher-supplied — trust them over anything scraped off an index page.", file=sys.stderr)
print("# '(via GNews)' URLs are Google redirects, NOT citable. Resolve the canonical URL", file=sys.stderr)
print("# (search the headline + outlet) before quoting or linking. Never invent a URL.", file=sys.stderr)
PY

# Wet Ink Ops

Operational repo for scheduled Wet Ink Magazine workflows. Currently runs
one daily routine: detect newly published articles on wetinkmag.com and
create Instagram Reels + platform captions for any articles that haven't
been processed yet.

## How this repo works

This is a thin router. The actual logic lives in the skills under
`.claude/skills/`. When a scheduled task fires, follow the skill end to
end — do not improvise or restate skill rules in this file.

The pipeline skill (`content-pipeline`) is the entry point. It chains
into the other three skills and the reviewer subagent on its own.

## Daily content pipeline

When invoked, follow `.claude/skills/content-pipeline/SKILL.md` end to
end. That skill handles: site scrape → tracker diff → parallel Reel +
caption build → image-fidelity review → Asana task creation → tracker
update.

Do not deviate from it. If something looks wrong, save a report and
stop — do not improvise fixes.

## Inbound news → draft pipeline

When invoked, follow `.claude/skills/news-triage/SKILL.md` end to end.
This is a fast NEWS desk (the OUTBOUND-news counterpart to
content-pipeline): it scans the adult-industry trade press (AVN, XBIZ,
YNOT) + mainstream crossover coverage for TIMELY current stories in Wet
Ink's beats — platform news, law & money (age-verification, bills,
creator taxes, payment processors), notable performers, industry-wide —
scores them on a newsworthiness + relevance rubric (multi-outlet pickup
is the key signal), writes a fast original news draft in Wet Ink voice
for every in-scope story scoring 3+, and files an Asana task in the
"Wet Ink — News Triage" project with the full draft embedded in the card
(embed-only — no Google Doc). Its only output is the editorial draft;
social graphics stay with content-pipeline. It is NOT for evergreen
keyword SEO (how-to guides, "X vs Y" comparisons, glossary/pillar
pages) — Wet Ink writes those in-house. Rejected + already-covered
+ out-of-scope stories are logged to the Triage Log task. Not yet
scheduled — runs on demand until validated, then promote to a daily
(≤48h window) or weekly (≤7d) routine.

## Skills available in this repo

- `content-pipeline` — orchestrator for the daily social run
- `news-triage` — inbound industry-news → SEO draft → Asana assignment
- `instagram-reels` — source of truth for Reel template, Canva folder,
  brand kit, Asana project/section/assignee/follower IDs
- `social-post-optimizer` — platform-specific caption rules (Instagram,
  X/Twitter, TikTok, YouTube)
- `wet-ink-voice` — editorial voice rules applied to all written output

## Subagents available

- `reel-image-reviewer` (`.claude/agents/reel-image-reviewer.md`) —
  read-only verifier that confirms each Reel scene uses the article's
  hero image and not a template default. Invoked by `content-pipeline`
  before any Asana task is created. Do not skip this gate.

## Required MCP connectors

The scheduled task must have these authorized at the routine level:

- **Google Drive** — read the tracker sheet
- **Canva** — duplicate templates, edit scenes, move designs to the
  Reels folder, read design pages for the reviewer
- **Asana** — create tasks in the Wet Ink Social Media project
- **Claude in Chrome** — write new article rows + flip "In Asana"
  flag on the tracker sheet (the only safe write path; Drive
  overwrite would destroy other tables in the sheet)

## Scheduled-run output

Each run writes a markdown report to
`/Users/andrewnagle/Claude/Wet Ink Organic Social Posts/content-pipeline-<YYYY-MM-DD>.md`
summarizing: new articles found, sheet rows appended, reviewer verdict,
Canva/Asana links, captions generated, and anything that needs manual
attention.

On reviewer FAIL, the run halts before creating Asana tasks and saves
a `-FAIL.md` report with the failing scenes and asset_ids. A human
fixes the design or reruns the article.

## What this repo is NOT for

- Carousels (use `instagram-carousel` skill directly in Desktop)
- Newsletter sends (Klaviyo pipeline lives elsewhere)
- Analytics rollups (planned for a future routine — `weekly-analytics`)
- Any one-off content work — keep that in Desktop chat where the skills
  also live

## Source-of-truth rule

If you find yourself about to type a Canva template ID, brand kit ID,
Asana project/section/user ID, or any other operational identifier in
this file or in `content-pipeline`, stop. Those facts belong in the
downstream skill (`instagram-reels`, `instagram-carousel`, etc.). One
source per fact. Drift between this file and the skills has caused
real bugs.

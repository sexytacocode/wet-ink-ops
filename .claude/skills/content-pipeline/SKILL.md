---
name: content-pipeline
description: >
  Daily content pipeline for Wet Ink Magazine. Checks for newly published articles on
  wetinkmag.com, compares against the Wet_Ink_IG_Content_Tracker Google Sheet, and
  automatically creates Instagram Reels + platform captions for any articles that
  haven't been processed yet. Includes an image-fidelity review gate before Asana
  task creation to catch the recurring template-image leak.
  Triggers include: "run the content pipeline," "check for new articles," "any new
  articles today," "daily content check," "content pipeline," "new article check," or
  any request to detect new Wet Ink articles and create social content from them. Use
  this skill even if the user just says "check for new articles" without mentioning
  reels — the skill handles the full detect-and-create workflow. For on-demand
  Instagram carousels, use the instagram-carousel skill instead — this skill only
  handles Reels automatically.
---

## ⚠️ PRE-FLIGHT CHECKLIST

- [ ] **bash / curl / python3 available** — Used to scrape the all-posts page, parse HTML, and POST to the tracker webhook.
- [ ] **Tracker webhook reachable** — Sheet reads AND writes go to `https://wet-ink-ops.vercel.app/api/webhook` (Vercel-hosted serverless function in this same repo, at `api/webhook.js`). Requires the `WEBHOOK_SECRET` env var. For local testing, pull it from Vercel with `vercel env pull .env.local && export $(grep WEBHOOK_SECRET .env.local | xargs)`. The webhook handles all sheet I/O — no Google Drive MCP, no Chrome MCP, no Apps Script. Works headlessly so the daily scheduled routine doesn't need a laptop awake or any Google connector at all.
- [ ] **Asana MCP loaded** — Used by Phase 1.5 preflight check and Phase 4 task creation. Load via `tool_search` query `"asana"`.
- [ ] **Subagent: `reel-image-reviewer`** — Defined at `.claude/agents/reel-image-reviewer.md`. Required for the Phase 3 gate. If unavailable (e.g. running in Claude Desktop), see "Desktop fallback" below.
- [ ] **Skills referenced** — `instagram-reels`, `wet-ink-voice`, `social-post-optimizer`. Do not duplicate their rules in this skill; read them when invoked.

---

## SOURCE-OF-TRUTH RULE

This skill does NOT restate Canva template IDs, Asana assignee IDs, brand kit IDs, or any operational specific that belongs to a downstream skill. Those drift. Always read them from:

- `instagram-reels` SKILL.md — Reel template, brand kit, Reel folder, Social Media project ID, "To Edit" section, assignee (Natasha) and collaborator (Holly) IDs
- `instagram-carousel` SKILL.md — carousel-specific IDs (out of scope for this skill)
- `social-post-optimizer` SKILL.md — platform-specific caption rules and limits
- `wet-ink-voice` SKILL.md — voice rules

Only IDs unique to THIS skill live in the "Required IDs" section below.

---

## OVERVIEW

This skill runs in five phases:

**Phase 1 — Detect & log (cheap, ~25-40K tokens)**
Scrape wetinkmag.com/all-posts, diff against the tracker sheet, append new rows via the webhook.

**Phase 1.5 — Preflight check (cheap, ~5K tokens)**
For the most recent new article, check Asana + the tracker's `In Asana` column to see whether the reel was already created via an ad-hoc run. Branches the pipeline:
- Both negative → proceed to Phase 2 (normal build)
- Asana has it → skip Phase 2-3, jump to Phase 4 Step 11 (flip flag), done
- Both positive → exit pipeline, nothing to do

**Phase 2 — Build (parallel subagents, only if Phase 1.5 says proceed)**
For the FIRST new article, fan out two subagents simultaneously from the same article inputs:
- **Reel subagent** — invokes `instagram-reels` (which pulls `wet-ink-voice` for on-design copy). Produces Uncensored + SFW designs and returns the uploaded asset_id.
- **Caption subagent** — invokes `social-post-optimizer` + `wet-ink-voice`. Produces Instagram caption, hashtags, and X/Twitter copy (both Uncensored and SFW).

**Phase 3 — Review (image-fidelity gate)**
Invoke `reel-image-reviewer` subagent with the two design_ids and the expected asset_id. Reviewer reads each design with a fresh context and verifies every scene's editable fill uses the article hero image, not a template default.

**Phase 4 — Commit (only on reviewer PASS)**
Create one Asana task per Reel with platform captions embedded in the description, then flip the article's tracker row via the webhook. On reviewer FAIL, save a structured report and stop — no Asana tasks, no tracker flip.

**Why one article at a time?** Each Reel build still uses ~150K tokens in the subagent context. Processing one article per run keeps total token use predictable and aligns with how Andrew prioritizes the queue manually.

**Reels for every category.** Per Andrew's standing direction, every new article gets a reel — Side Notes, Industry, Business, Features, Creators, Galleries. The reels skill handles per-category framing.

---

## TRACKER SHEET

- **Sheet title:** `Wet_Ink_IG_Content_Tracker`
- **Sheet ID:** `1sPQwj2ZSu9A7drg2YuUwQrcwVQ7JQNcbM7qRbQhMhaA`
- **View URL:** https://docs.google.com/spreadsheets/d/1sPQwj2ZSu9A7drg2YuUwQrcwVQ7JQNcbM7qRbQhMhaA/edit
- **Reads** go through the Google Drive MCP (`read_file_content`).
- **Writes** go through the webhook at `https://wet-ink-ops.vercel.app/api/webhook`. See "Webhook API" below. NEVER write to the sheet via the Drive MCP — `create_file` would overwrite the multi-table structure.

### Sheet structure

The "Article Coverage" tab contains three logical tables (the second is a separate tab in newer versions of the sheet):

1. **Article Coverage table** (rows 1..N) — the one we read & append to.
   10 columns (A–J): `# | Article Title | Published Date | Posted on IG? | Post Type | IG Post Date | IG Link | Create Post? | New Post Type | In Asana`.
   *Note:* an older version had an extra `Order` column making it 11 columns. The live sheet has 10.

2. **Instagram Posts performance table** (rows N+1..M) — read-only for this skill; populated by other tooling.
   Columns: `# | Date Posted | Post Type | Caption | Likes | Comments | Reach | Shares | Saved | Engagement | Link`.

3. **Webflow Articles slug map** — separate tab.

The webhook locates the end of the Article Coverage table by detecting the Instagram Posts header (column B = "Date Posted") and inserts new rows right above it, regardless of whether there are blank separator rows or POSTED:/NOT POSTED: summary rows in between.

### If the sheet doesn't exist (rare)

If `search_files` with `title contains 'Wet_Ink_IG_Content_Tracker'` returns nothing, stop and ask the user — don't auto-create. The sheet has bespoke structure that shouldn't be regenerated from scratch.

---

## WEBHOOK API

The Vercel-hosted webhook (`api/webhook.js` in this repo) handles all sheet writes. It auths via OAuth refresh token tied to `andrew@hollyrandallagency.com` (same Internal OAuth client as the GA4/Search Console/YouTube MCPs — see memory note `google_analytics_mcp_auth.md`). Requests require an `X-Webhook-Secret` header.

**Base URL:** `https://wet-ink-ops.vercel.app/api/webhook`
**Auth:** `X-Webhook-Secret: $WEBHOOK_SECRET` (pull from Vercel with `vercel env pull .env.local`).

| Action | Body | Returns |
|---|---|---|
| `ping` | `{"action":"ping"}` | `{ok:true, message:"pong"}` |
| `append` | `{"action":"append", "title":"...", "date":"Month DD, YYYY"}` | `{ok:true, inserted_at_row, row_number, title}` — or `{ok:true, skipped:true, existing_row}` if the title is already in the tracker (idempotent) |
| `flip_in_asana` | `{"action":"flip_in_asana", "title":"..."}` | `{ok:true, row, title}` — sets column J to `Y` for the matching article row |
| `delete_row` | `{"action":"delete_row", "row":N}` | `{ok:true, deleted_row:N}` — one-off cleanup; shifts all rows below up by 1 |

The `append` action auto-computes `#` (max existing + 1), fills the 10 default columns (`Posted on IG?`=N, `Create Post?`=Y, `New Post Type`=Reel, `In Asana`=N), and inherits formatting from the article row above (cell colors, dropdowns, conditional formatting).

---

## PHASE 1: DETECT NEW ARTICLES

### Step 1: Scrape the all-posts page

Call `web_fetch` with `url: https://wetinkmag.com/all-posts`. The response is ~70KB of HTML and will exceed the inline token limit — `web_fetch` will save the body to a temp file and return the path. Parse from that file via bash + python.

The page lists ~25-30 articles per page in reverse chronological order. Each article appears as an anchor:

```html
<a href="/posts/<slug>" ...>
  <div class="...category...">Category Name</div>
  <h2>Article Title</h2>
  ...
  <span>Month DD, YYYY</span>
</a>
```

**URL pattern is `/posts/<slug>` (with the `s`).** A previous version of this skill used `/post/` — that's wrong.

Parse out: title, category, publish date, full URL. Pattern that works:

```python
import re, html as htmllib
pat = re.compile(r'<a [^>]*href="(/posts/[^"]+)"[^>]*>(.*?)</a>', re.DOTALL)
for href, inner in pat.findall(page):
    slug = href.rsplit('/', 1)[-1]
    title_m = re.search(r'<h2[^>]*>(.*?)</h2>', inner, re.DOTALL)
    title = htmllib.unescape(re.sub(r'<[^>]+>', '', title_m.group(1))).strip() if title_m else ''
    date_m = re.search(r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}\b', inner)
    date = date_m.group(0) if date_m else ''
    cat_m = re.search(r'<div[^>]*class="[^"]*cate[^"]*"[^>]*>(.*?)</div>', inner, re.DOTALL)
    category = re.sub(r'<[^>]+>', '', cat_m.group(1)).strip() if cat_m else ''
    # ...
```

Dedupe by slug (the page sometimes renders both a tile and a featured-card link to the same article).

**Page 1 is sufficient for daily runs** — new articles always appear at the top. Only fetch page 2 if doing initial sheet setup.

### Step 2: Read the tracker via webhook

```bash
curl -X POST "https://wet-ink-ops.vercel.app/api/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -d '{"action":"list_titles"}'
```

Returns `{ok: true, count: N, rows: [{row, num, title, date, in_asana}, ...]}`. The `rows` array is every Article Coverage entry, top-to-bottom. Use `title` for the diff in Step 3 and `in_asana` later in Phase 1.5.

(The Drive MCP previously did this read, but the webhook now exposes it directly — one fewer connector for the scheduled routine.)

### Step 3: Compare

An article from the site is "new" if its title does not appear in the sheet's Article Coverage `Article Title` column.

**Matching rules:**
- Lowercase both sides
- Strip leading/trailing whitespace
- Strip trailing `?`, `!`, `.`, `,`
- Normalize curly quotes (`’` → `'`, `“` → `"`)
- If a site title is a close-but-not-exact match (likely a Webflow edit), flag for the user instead of treating as new

### Step 4: Append new rows via the webhook

For each new article, POST to the tracker webhook:

```bash
curl -X POST "https://wet-ink-ops.vercel.app/api/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -d '{
    "action": "append",
    "title": "<article title verbatim from scrape>",
    "date":  "<Published Date, e.g. \"May 12, 2026\">"
  }'
```

The webhook handles everything: auto-computes the next `#`, fills the 10 default columns, and inherits formatting from the article row above. See "Webhook API" above for the full contract.

**Idempotency:** The webhook is idempotent on `title`. A duplicate POST returns `{ok:true, skipped:true, existing_row:N}` rather than inserting a duplicate. This guards against retries (Vercel function retries on cold start) and pipeline reruns.

**On error:** If the webhook returns a 4xx/5xx, save the proposed rows to `/Users/andrewnagle/Claude/Wet Ink Organic Social Posts/content-pipeline-<YYYY-MM-DD>.md` and stop the pipeline. Do NOT attempt a Drive overwrite.

### Step 5: Report findings

Tell the user:
- Total articles parsed from page 1 of all-posts
- Count already in tracker
- Count new (with titles, dates, categories, URLs)
- Whether Phase 1.5 will proceed (yes if at least one new article)

If no new articles: "All articles are tracked. Nothing new to process." Exit the pipeline.

---

## PHASE 1.5: PREFLIGHT CHECK

This phase prevents the pipeline from re-doing work that was already done via an ad-hoc run of the `instagram-reels` skill (or another route). It runs against the **FIRST new article** — the one Phase 2-4 would process.

### Step 5.5a: Search Asana

Load Asana MCP via `tool_search` query `"asana search tasks"`, then search the Wet Ink Social Media project for any task whose name contains the article title:

```
mcp__asana__search_tasks_preview:
  workspace: "<wet ink workspace gid>"
  projects.any: "1214264767251100"   # Wet Ink Social Media project
  text: "<article title>"
```

(The Wet Ink Social Media project ID and other operational IDs live in `instagram-reels` SKILL.md "Required Asana IDs" section — do not restate them here.)

Match logic: a task is a hit if its name, after the same normalization the webhook uses, contains the article title. Normalization:
- lowercase, trim
- `‘’` → `'`, `“”` → `"`
- `—–` → `-`
- strip trailing `?!.,`
- collapse whitespace

The Wet Ink Reels pattern is two tasks per article: `<Article Title> — Long Uncensored Reel` and `<Article Title> — Long SFW Reel`. Either matching counts as "Asana has it."

### Step 5.5b: Check the tracker In Asana column

You already have the tracker rows from Step 2 (`list_titles` response). Find the article's row by title in that array and read its `in_asana` field:
- `Y` → counts as "tracker says yes"
- `N`, empty, or `—` → counts as "tracker says no"

If you don't have the Step 2 data still in context (long Phase 2 may have evicted it), re-call `list_titles` via the webhook — same as Step 2.

### Step 5.5c: Branch the pipeline

| Asana check | Tracker `In Asana` | Action |
|---|---|---|
| no match | `N` / empty | **Proceed to Phase 2** (normal build) |
| match found | `N` / empty | Asana has it, tracker is stale. **Skip Phase 2-3.** Jump to Phase 4 Step 11 (flip flag to `Y`), then exit. Include the existing Asana task URL in the final report. |
| no match | `Y` | Tracker says yes but Asana doesn't. Log a warning, **proceed to Phase 2** anyway — the tracker is wrong, fix it by building. |
| match found | `Y` | Already-processed. **Exit the pipeline** with no further action. Include the Asana task URL in the final report. |

The decision and reasoning must appear in the Phase 4 final report so it's clear why Phase 2-4 ran or didn't.

---

## PHASE 2: BUILD (PARALLEL SUBAGENTS)

### Step 6: Fetch article content

For the FIRST (most recent) new article, fetch the article page with `web_fetch`. The body will likely exceed the inline limit — parse from the temp file the same way as Phase 1 Step 1.

Extract and stash for use by both subagents:

- `title` — full article title
- `body_excerpt` — opening 2-3 paragraphs (enough for caption + reel hook drafting)
- `key_claims` — 2-3 of the article's strongest claims
- `hero_image_url` — the top `cdn.prod.website-files.com` image URL on the article page
- `author` — author name if available
- `category` — Side Notes / Industry / Business / Features / Creators / Galleries
- `article_url` — full URL

**If `hero_image_url` is missing or clearly not article-specific, do NOT proceed to Phase 2.** Save a report flagging "no usable hero image" and stop. The whole pipeline depends on the article image being available — letting it proceed is what causes the template-image leak in the first place.

### Step 7: Spawn the two build subagents in parallel

Spawn both at the same time. They have no dependency on each other.

**Reel subagent prompt:**

```
Read .claude/skills/instagram-reels/SKILL.md and execute it end to end
for this article:

Title: {title}
Body excerpt: {body_excerpt}
Key claims: {key_claims}
Hero image URL: {hero_image_url}
Author: {author}
Category: {category}

Return a structured result:
  uncensored_design_id: ...
  uncensored_edit_url: https://www.canva.com/design/.../edit
  sfw_design_id: ...
  sfw_edit_url: https://www.canva.com/design/.../edit
  uploaded_asset_id: ...   ← required for Phase 3 reviewer
  step_7_self_check_flags: [...] ← any flags raised by the reels skill's inline checks

Do NOT create Asana tasks. That happens in Phase 4 of the parent pipeline.
```

**Caption subagent prompt:**

```
Read .claude/skills/social-post-optimizer/SKILL.md and
.claude/skills/wet-ink-voice/SKILL.md.

Produce platform copy for this article:

Title: {title}
Body excerpt: {body_excerpt}
Key claims: {key_claims}
Category: {category}
Article URL: {article_url}

Return a structured result:
  instagram_caption: "..." (SFW, within IG limits)
  instagram_hashtags: ["#...", "#..."]
  twitter_uncensored: "..." (within X limits)
  twitter_sfw: "..." (within X limits)

Apply wet-ink-voice rules. Respect each platform's character limits.
Do NOT post anything. Output text only.
```

Collect both results before proceeding. If either subagent fails, stop the pipeline, save a report, and surface the failure. Do NOT proceed to Phase 3 with partial output.

**Critical hand-off:** The Reel subagent MUST return `uploaded_asset_id`. The reviewer cannot do its job without it.

---

## PHASE 3: REVIEW (IMAGE-FIDELITY GATE)

### Step 8: Invoke the reviewer subagent

Spawn the `reel-image-reviewer` subagent:

```
Run the reel-image-reviewer agent.

Inputs:
- expected_asset_ids: [{uploaded_asset_id}]   # wrap the single uploaded asset_id in a list; reviewer takes a list to support multi-photo articles in the future
- designs:
    - { id: {uncensored_design_id}, version: "Uncensored" }
    - { id: {sfw_design_id}, version: "SFW" }

Return the structured report defined in your agent instructions.
```

Wait for the reviewer's report. Do not proceed to Phase 4 until it returns.

### Step 9: Branch on result

- **OVERALL: PASS** → proceed to Phase 4.
- **OVERALL: FAIL** → save the failure report to `/Users/andrewnagle/Claude/Wet Ink Organic Social Posts/content-pipeline-<YYYY-MM-DD>-FAIL.md` including: which scenes failed, the actual asset_ids found, and the Canva edit URLs. Do NOT create Asana tasks. Do NOT update the tracker. Surface the failure in the final report so a human can fix or rerun.
- **OVERALL: INCONCLUSIVE** → treat as FAIL.

---

## PHASE 4: COMMIT (PASS BRANCH ONLY)

### Step 10: Create Asana tasks

Defer to `instagram-reels` SKILL.md Step 9 for task structure (assignee, section, follower IDs, project ID). DO NOT restate those IDs here.

Augment each task's `notes` field with the captions from Phase 2. The Uncensored task carries `twitter_uncensored`; the SFW task carries `twitter_sfw`. Both tasks include the IG caption since the Reel itself will be posted on Instagram regardless of version.

**Notes template for each task:**

```
Edit text and images as needed.

Canva link: https://www.canva.com/design/{design_id}/edit

Article: {title}
Version: {Long Uncensored | Long SFW} (5 scenes)
Reviewer: PASS — all 5 scenes verified against article hero image.

---
Suggested Instagram caption:
{instagram_caption}

Hashtags:
{instagram_hashtags joined with spaces}

---
Suggested X/Twitter copy ({Uncensored | SFW}):
{twitter_uncensored or twitter_sfw}
```

### Step 11: Flip `In Asana` via the webhook

POST to the tracker webhook to set column J (`In Asana`) to `Y` for the article's row:

```bash
curl -X POST "https://wet-ink-ops.vercel.app/api/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -d '{
    "action": "flip_in_asana",
    "title": "<article title>"
  }'
```

The webhook normalizes the title the same way the `append` action does, so a curly-quote drift between scrape and tracker won't cause a miss. On success it returns `{ok:true, row:N, title}`.

If the webhook returns an error (title not found in tracker), log it but don't block — the Asana tasks have been created at this point, so the failure is recoverable (a human can flip the flag manually). Include the error in the Phase 4 final report.

### Step 12: Final report

Tell the user / log to the scheduled-run report:

- Article processed (title, category, URL)
- Phase 1.5 preflight outcome (built fresh / skipped-built / skipped-done)
- Reviewer verdict: PASS (or skipped if Phase 1.5 routed us around it)
- Both Canva edit URLs (Uncensored + SFW) — newly created OR pre-existing from Asana
- Both Asana task URLs
- IG caption preview (first 100 chars)
- Number of new articles remaining unprocessed
- "Run the pipeline again in a fresh conversation to process the next article."

---

## DESKTOP FALLBACK (no subagent support)

If this skill is invoked in an environment without subagent support (Claude Desktop), execute Phase 2-3 sequentially in the main context instead of spawning subagents:

1. Run the `instagram-reels` skill inline. Capture design IDs and `uploaded_asset_id`.
2. Run `social-post-optimizer` + `wet-ink-voice` inline to draft captions.
3. **Skip the formal reviewer subagent.** Instead, after both designs are committed, run the reviewer's checks inline: open each design with `Canva:start-editing-transaction` (then `cancel-editing-transaction` to stay read-only), find each page's `editable: true` image fill, confirm its `asset_id` is in the article's `uploaded_asset_ids` list, and verify the template fingerprint (5 pages of 1080×1920 + decorative asset `MADWDzB46Dw` on every page). See `.claude/agents/reel-image-reviewer.md` for the full rules. If any scene fails, stop and report — do not create Asana tasks.
4. Proceed to Phase 4 only if the manual check passes.

The Desktop path is less reliable than the subagent gate because the same context that built the designs is checking them. Prefer running this skill through Claude Code / cloud routine when possible.

---

## REQUIRED IDS (UNIQUE TO THIS SKILL)

Only IDs that don't belong to a downstream skill:

- **Wet Ink site URL:** `https://wetinkmag.com/all-posts`
- **Tracker sheet ID:** `1sPQwj2ZSu9A7drg2YuUwQrcwVQ7JQNcbM7qRbQhMhaA`
- **Backup report directory:** `/Users/andrewnagle/Claude/Wet Ink Organic Social Posts/`

All Canva template/folder/brand-kit IDs and all Asana project/section/assignee/collaborator IDs are read from `instagram-reels` SKILL.md. If you find yourself about to type a Canva or Asana ID into this skill, stop — it belongs in the downstream skill instead.

---

## EDGE CASES

**Galleries / photo-only articles** (e.g., red-carpet recaps, "Best Dressed"): The reel subagent should pick the strongest image from the gallery as the hero. If no usable image exists, stop at Step 6 — do not proceed to Phase 2 without a confirmed hero image.

**Side Notes** (short news items): These ALWAYS get reels per Andrew's direction. The reel skill anchors the hook on the article's core claim and keeps scenes tight. If a Side Notes piece is truly only 1-2 sentences, the caption subagent should also keep platform copy proportionally tight.

**Articles with explicit titles:** The SFW reel and SFW X/Twitter copy each need a reframed title/lead. Both subagents handle this in their own skills — no coordination needed at this layer.

**Webflow title edits:** If a site title is similar but not identical to a tracked title, do NOT auto-add as new. Flag the diff to the user and let them confirm.

**Sheet write fails (Phase 1):** If the webhook returns an error (e.g., Vercel deploy is down, refresh token revoked), save the proposed rows to the backup file and stop the pipeline. Do NOT proceed to Phase 2-4 without a confirmed tracker write — that's how duplicate work happens.

**Multiple new articles in one run:** Process only the FIRST (most recent) new article in Phases 2-4. All new articles get added to the tracker in Phase 1. Tell the user how many Phase 2+ candidates remain.

**Curly-quote drift:** Webflow renders straight quotes (`'`) but Google Sheets sometimes auto-corrects to curly (`’`). Always normalize quote characters before comparing titles.

**Reviewer FAIL on one design but not the other:** Treat as overall FAIL. Don't half-commit. Save the report and stop.

---

## CAROUSEL ON DEMAND

This skill does NOT automatically create carousels. For a carousel, use the `instagram-carousel` skill directly:

> "Create an Instagram carousel for [article title]"

When that skill finishes, it should update the article's tracker row: `New Post Type` → `Carousel`, `In Asana` → `Y`.

---

## TOKEN BUDGET ESTIMATE

Parallel subagents change the math vs. the old serial design:

- **Phase 1 only (detect + sheet append):** ~25-40K tokens (main context)
- **Phase 2 parallel build:** ~150K Reel subagent + ~30K caption subagent (isolated contexts, run concurrently)
- **Phase 3 reviewer:** ~15-25K reviewer subagent (isolated context)
- **Phase 4 commit + main coordination overhead:** ~30K main context

Total: roughly 230-275K tokens per article processed, comparable to the old single-context number but with proper context isolation and a real review gate. Wall-clock time is faster because Phase 2 subagents run in parallel.

---

## SCHEDULED-RUN BEHAVIOR

When this skill is invoked from a scheduled task (no user present, no laptop required):

- Phase 1 runs to completion: scrape, read tracker, POST new article rows to the webhook.
- Phase 1.5 preflight runs against the first new article. If it says "already in Asana," skip ahead to Phase 4 Step 11 (flip flag) and exit. If "already done end to end," exit immediately.
- Phase 2-4 proceed automatically for the FIRST new article only, **only if Phase 1.5 says proceed AND Phase 1 webhook write succeeded AND Step 6 found a usable hero image**.
- Reviewer FAIL halts at Phase 3, saves the FAIL report, does NOT create Asana tasks.
- Reviewer PASS continues through Phase 4.
- Final output is a markdown report. If running locally with access to `/Users/andrewnagle/Claude/Wet Ink Organic Social Posts/`, save it as `content-pipeline-<YYYY-MM-DD>.md` there. If running as a remote CCR routine (no local filesystem access), print the report as the final assistant message instead — it'll show up in the routine's run log at claude.ai/code/routines.

Report should cover: new articles found, sheet rows appended, Phase 1.5 outcome, reviewer verdict, Canva/Asana links, captions generated, anything that needs manual attention.

The scheduled routine needs `WEBHOOK_SECRET` available. The remote-trigger API doesn't expose env vars, so the secret is currently embedded in the routine's user prompt (visible only to the user's account). If that ever changes (e.g., env var support added), migrate it out of the prompt.

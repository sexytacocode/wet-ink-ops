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
- [ ] **Skills referenced** — `instagram-reels`, `instagram-carousel`, `wet-ink-voice`, `social-post-optimizer`. Do not duplicate their rules in this skill; read them when invoked. Every article gets a carousel built alongside its Reels (no cycle gating).

---

## SOURCE-OF-TRUTH RULE

This skill does NOT restate Canva template IDs, Asana assignee IDs, brand kit IDs, or any operational specific that belongs to a downstream skill. Those drift. Always read them from:

- `instagram-reels` SKILL.md — Reel template, brand kit, Reel folder, Social Media project ID, "To Edit" section, assignee (Natasha) and collaborator (Holly) IDs
- `instagram-carousel` SKILL.md — carousel template, carousel folder, carousel-specific QA rules
- `social-post-optimizer` SKILL.md — platform-specific caption rules and limits
- `wet-ink-voice` SKILL.md — voice rules

Only IDs unique to THIS skill live in the "Required IDs" section below.

---

## OVERVIEW

This skill runs in six phases:

**Phase 1 — Detect & log (cheap, ~25-40K tokens)**
Scrape wetinkmag.com/all-posts, resolve the Webflow CMS item id for each parsed article, diff against the tracker sheet, append new rows (with `webflow_id`) via the webhook.

**Phase 0.5 — Self-heal audit (cheap, ~5-10K tokens)**
For every `In Asana=Y` row from May-10-2026 onward, verify Asana actually has the expected 2 (or 3 with carousel) tasks matched by ArticleID custom field. If a row is short, re-create the missing tasks. Catches the "tracker says Y but Asana is empty" failure mode.

**Phase 1.5 — Preflight check (cheap, ~5K tokens)**
Pick the **target article** for this run — defined as the tracker row with the most recent `Published Date` where `In Asana` is `N`, blank, or `—`. (Today's newly-scraped articles naturally fall into this set because `append` writes `In Asana=N`; backlog articles from prior runs that never built do too.) Then check Asana + the tracker's `In Asana` column to see whether the reel was already created via an ad-hoc run. Branches the pipeline:
- No target article found (everything is `In Asana=Y`) → exit pipeline
- Target found, both checks negative → proceed to Phase 2 (normal build)
- Target found, Asana already has it → skip Phase 2-3, jump to Phase 4 Step 11 (flip flag), done
- Target found, both positive → exit pipeline, nothing to do

**Phase 2 — Build (parallel subagents, only if Phase 1.5 says proceed)**
For the target article from Phase 1.5, fan out subagents simultaneously from the same article inputs:
- **Reel subagent** — invokes `instagram-reels` (which pulls `wet-ink-voice` for on-design copy). Produces Uncensored + SFW Reel designs and returns the list of uploaded `asset_ids` (one per article image) plus the per-scene assignment.
- **Caption subagent** — invokes `social-post-optimizer` + `wet-ink-voice`. Produces Instagram caption, hashtags, and X/Twitter copy (both Uncensored and SFW).
- **Carousel subagent** (always spawned) — invokes `instagram-carousel`. Produces one SFW carousel design with text + images swapped from the article. Carousels don't have Uncensored versions (Instagram throttles explicit content).

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
   12 columns (A–L): `# | Article Title | Published Date | Posted on IG? | Post Type | IG Post Date | IG Link | Create Post? | New Post Type | In Asana | Carousel | Webflow ID`.
   - **Column J `In Asana`** — Y once the Reel Asana tasks have been created.
   - **Column K `Carousel`** — Y once a Carousel has been built for this article. The pipeline auto-builds a carousel for **every** article (no cycle gating). Historical rows from the cycle-era may have K=N — those are not retroactively rebuilt; the column tracks "has a carousel been built for this article yet" forever forward.
   - **Column L `Webflow ID`** — the Webflow CMS item id for this article. This is the **durable unique key** threaded through the pipeline (titles are fragile: curly quotes, Webflow edits, partial matches). Populated by Phase 1 on insert and copied to the Asana `ArticleID` custom field on each task. Used as the matching key in Phase 1.5 preflight, Phase 4 verify, and Phase 0.5 self-heal.

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
| `append` | `{"action":"append", "title":"...", "date":"Month DD, YYYY", "webflow_id":"<cms item id>"}` | `{ok:true, inserted_at_row, row_number, title, webflow_id}` — or `{ok:true, skipped:true, existing_row}` if the title is already in the tracker (idempotent). `webflow_id` is optional but the pipeline should always supply it. |
| `list_titles` | `{"action":"list_titles"}` | `{ok:true, count:N, rows:[{row, num, title, date, in_asana, carousel, webflow_id}, ...]}` — every row in the Article Coverage table |
| `flip_in_asana` | `{"action":"flip_in_asana", "title":"...", "value":"Y"|"N"}` | `{ok:true, row, value, title}` — sets column J (`In Asana`). Default value is `Y`. |
| `flip_carousel` | `{"action":"flip_carousel", "title":"...", "value":"Y"|"N"}` | `{ok:true, row, value, title}` — sets column K (`Carousel`). Default value is `Y`. |
| `set_webflow_id` | `{"action":"set_webflow_id", "title":"...", "webflow_id":"<id>"}` OR `{"action":"set_webflow_id", "row":N, "webflow_id":"<id>"}` | `{ok:true, row, webflow_id}` — writes column L. Used by the backfill to populate the Webflow ID for rows that predate the column. |
| `lookup_by_webflow_id` | `{"action":"lookup_by_webflow_id", "webflow_id":"<id>"}` | `{ok:true, row, num, title, date, in_asana, carousel, webflow_id}` — returns the matching row, or 404 `{ok:false, error:"not found"}`. |
| `init_columns` | `{"action":"init_columns"}` | `{ok:true, written:"L1=Webflow ID"}` or `{ok:true, skipped:true}` if L1 already says `Webflow ID`. One-shot init of the column header — already run, listed here for documentation. |
| `delete_row` | `{"action":"delete_row", "row":N}` | `{ok:true, deleted_row:N}` — one-off cleanup; shifts all rows below up by 1 |

The `append` action auto-computes `#` (max existing + 1), fills the 12 default columns (`Posted on IG?`=N, `Create Post?`=Y, `New Post Type`=Reel, `In Asana`=N, `Carousel`=N, `Webflow ID`=passed value or empty), and inherits formatting from the article row above (cell colors, dropdowns, conditional formatting).

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

Parse out: title, category, publish date, slug, full URL. Pattern that works:

```python
import re, html as htmllib
pat = re.compile(r'<a [^>]*href="(/posts/[^"]+)"[^>]*>(.*?)</a>', re.DOTALL)
for href, inner in pat.findall(page):
    slug = href.rsplit('/', 1)[-1]                # KEEP — used to resolve webflow_id below
    title_m = re.search(r'<h2[^>]*>(.*?)</h2>', inner, re.DOTALL)
    title = htmllib.unescape(re.sub(r'<[^>]+>', '', title_m.group(1))).strip() if title_m else ''
    date_m = re.search(r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}\b', inner)
    date = date_m.group(0) if date_m else ''
    cat_m = re.search(r'<div[^>]*class="[^"]*cate[^"]*"[^>]*>(.*?)</div>', inner, re.DOTALL)
    category = re.sub(r'<[^>]+>', '', cat_m.group(1)).strip() if cat_m else ''
    # ...
```

Dedupe by slug (the page sometimes renders both a tile and a featured-card link to the same article). **Keep the slug per article** — Step 1.5 below uses it to resolve the Webflow CMS item id, which we thread through as the durable unique key.

**Page 1 is sufficient for daily runs** — new articles always appear at the top. Only fetch page 2 if doing initial sheet setup.

### Step 1.5: Resolve Webflow CMS item id for each parsed article

Once Step 1 has the list of articles, look up the Webflow CMS item id for each. The id is the durable unique key the pipeline threads through:

- tracker column L (`Webflow ID`)
- Asana `ArticleID` custom field (GID `1215162242710046`) on every task this pipeline creates
- Phase 1.5 preflight matches Asana tasks by ArticleID, not by name
- Phase 4 verify and Phase 0.5 self-heal match by ArticleID

Load the Webflow MCP `data_cms_tool` via `tool_search` if not already loaded. The Wet Ink site exposes a "Posts" collection. For each parsed article, query items by slug:

```
data_cms_tool
  action: "list_collection_items"   # or whatever the MCP exposes for filtered list
  collection: "Posts"               # or its collection id, look up once and cache
  filter: { slug: <article.slug> }  # exact match on the slug
```

Take `item.id` from the response → that's the `webflow_id`. Save it on the article record alongside `title`, `date`, `category`, `slug`, `url`.

If `data_cms_tool` lookup fails (collection not found, slug not matched, MCP down): log a warning and proceed with `webflow_id=""`. The webhook accepts empty webflow_id and the row will just be missing column L (backfill can fix it later). Do NOT fail the pipeline over a webflow_id lookup miss — Phase 1.5 preflight gracefully falls back to title matching when an article has no webflow_id.

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
    "date":  "<Published Date, e.g. \"May 12, 2026\">",
    "webflow_id": "<Webflow CMS item id from Step 1.5; omit or empty string if lookup failed>"
  }'
```

The webhook handles everything: auto-computes the next `#`, fills the 12 default columns (including column L `Webflow ID`), and inherits formatting from the article row above. See "Webhook API" above for the full contract.

**Idempotency:** The webhook is idempotent on `title`. A duplicate POST returns `{ok:true, skipped:true, existing_row:N}` rather than inserting a duplicate. This guards against retries (Vercel function retries on cold start) and pipeline reruns.

**On error:** If the webhook returns a 4xx/5xx, save the proposed rows to `/Users/andrewnagle/Claude/Wet Ink Organic Social Posts/content-pipeline-<YYYY-MM-DD>.md` and stop the pipeline. Do NOT attempt a Drive overwrite.

### Step 5: Report findings

Tell the user:
- Total articles parsed from page 1 of all-posts (or from the Webflow CMS fallback)
- Count already in tracker
- Count newly appended this run (with titles, dates, categories, URLs)
- Count of "backlog" rows (already in tracker but `In Asana = N`)
- Whether Phase 1.5 will proceed (yes if newly-appended count + backlog count > 0)

If newly-appended count + backlog count == 0: "All tracker rows are in Asana. Nothing to process." Exit the pipeline.

---

## PHASE 0.5: SELF-HEAL AUDIT (POST-PHASE-1)

Runs immediately after Phase 1 completes (before Phase 1.5 picks a target). Catches the "Canva designs built, tracker flipped to `In Asana=Y`, but Asana tasks weren't actually created" failure mode that motivated the ArticleID migration. Cheap — a single Asana `search_tasks` per affected row.

**Scope:** every tracker row where `in_asana == "Y"` AND `Published Date >= 2026-05-10`. Roughly the May-10-onwards window (the same window Phase 1.5 uses for target selection). Pre-May-10 rows are out-of-scope.

For each in-scope row:

1. Skip rows with empty `webflow_id` (we have nothing to look up by). Log them as "skipped — no webflow_id" for the final report.
2. Search Asana by ArticleID custom field:
   ```
   mcp__asana__search_tasks
     workspace: "<wet ink workspace gid>"
     projects.any: "1214264767251100"
     custom_fields: '{"1215162242710046.contains":"<row.webflow_id>"}'
     fields: ["gid", "name", "permalink_url"]
   ```
   **Important: the `.contains` suffix is required for text custom fields in the Asana search filter.** A plain `"1215162242710046": "..."` filter returns a 400 `Not a valid search parameter`. Use `.contains` for exact-string matching on text fields (the ID strings are stable and there's no overlap risk).
3. Expected count:
   - **3** if `row.carousel == "Y"` (Uncensored Reel + SFW Reel + SFW Carousel)
   - **2** otherwise (Uncensored Reel + SFW Reel only)
4. If actual count == expected → row is healthy, skip.
5. If actual count < expected → row is **short**:
   - Look up the article's existing Canva designs by searching the Wet Ink Reels folder (`FAHHtY3V36U`) and the carousel folder (see `instagram-carousel` SKILL.md for its folder id) for design titles starting with the article title.
   - Spawn the **caption subagent** (Phase 2 Step 7 caption prompt) to regenerate captions from the article URL.
   - For each missing task type (Uncensored Reel, SFW Reel, or Carousel), call `Asana:create_tasks` with the same parameters Phase 4 Step 10 uses — and crucially, set `custom_fields: '{"1215162242710046":"<row.webflow_id>"}'`.
   - Verify with the same logic Phase 4 Step 10.5 uses. If still short after re-create, save a FAIL note and surface it in the final report (do not retry — manual intervention required).
6. If actual count > expected → log as "over-built; manual review" and skip. (Likely a duplicate from a previous ad-hoc run; don't auto-delete.)

If no rows need healing, Phase 0.5 is a no-op. Report the count anyway so the user knows the audit ran.

**Why now and not later:** running this BEFORE Phase 1.5 means the self-heal catches stale rows on the same pipeline tick that would otherwise process today's new article — no waiting for a future run, no half-broken state lingering.

---

## PHASE 1.5: PREFLIGHT CHECK

This phase has two jobs:
1. **Pick the target article** — the tracker row this run will process in Phase 2-4.
2. **Decide whether to build it** — checking Asana + tracker against ad-hoc runs that already produced a Reel.

### Step 5.5a (pre-select): Identify the target article

From the `list_titles` response in Phase 1 Step 2 (still in context), filter rows by **both** criteria:
1. `in_asana` is `"N"`, blank, `"—"`, or anything other than `"Y"`.
2. `Published Date` is on or after **`2026-05-10`**. Parse the date string (formats vary — `"May 14, 2026"`, `"May 8, 2026"`, etc.) into a comparable date and skip anything older. **This is the backlog cutoff** — older articles in the tracker are considered out-of-scope for the pipeline. Andrew will deal with pre-May-10 backlog manually if at all.

Sort that filtered set by `Published Date` descending — newest first. The first row is the **target article** for this iteration.

This rule naturally:
- Picks up freshly-scraped articles immediately (they were appended with `In Asana=N` in Phase 1 Step 4)
- Catches up "backlog" rows from the last few days that were appended on prior runs but never built
- Skips articles that are already in Asana (`In Asana=Y`)
- Skips the long tail of older articles (~70 pre-May-10 rows that aren't worth retroactively building)

If the filtered set is empty, exit the pipeline — there's nothing to do.

### Step 5.5b: Carousel decision — always true

Every article gets a carousel built in addition to its Reels. Set `needs_carousel = true` unconditionally and continue.

```
needs_carousel = true   # every article, no cycle gating
```

(Historical note: this used to be a 1-of-3 cycle anchored at 2026-05-18. The gating was removed because the editorial value of a carousel per article outweighs the token cost. The `Carousel` column K still tracks build state per article so the self-heal can detect missing carousel tasks, but it no longer drives the decision — every fresh target gets a carousel.)

If the article was already processed via ad-hoc means and the preflight (below) returns "skipped-built-already," the carousel build is also moot — that iteration doesn't build anything fresh.

The rest of Phase 1.5 (Step 5.5c and 5.5d below) checks whether the target article was already processed via an ad-hoc route, and routes the pipeline accordingly.

### Multi-article runs

After completing Phase 4 Step 12 (or Phase 4 Step 11 if Asana already had the article), **loop back to Step 5.5 with the remaining eligible articles**. Process up to **10 articles per run** (a safety cap; lift it later if needed). Stop conditions:

- Filtered set is empty (no more eligible articles)
- Loop has executed 10 times in this run (cap)
- Any iteration hits a fatal error (Phase 1 webhook write fails, no hero image, reviewer INCONCLUSIVE for unrecoverable reasons)

Each iteration is independent — Phase 1 is NOT re-run within the loop (already done for this run). Just Phase 1.5 → 2 → 3 → 4, with a fresh target article selection at the start of each iteration.

### Step 5.5c: Search Asana by ArticleID custom field

Load Asana MCP via `tool_search` query `"asana search tasks"`, then search the Wet Ink Social Media project by the **ArticleID custom field** (GID `1215162242710046`) equal to the target row's `webflow_id`:

```
mcp__asana__search_tasks:
  workspace: "<wet ink workspace gid>"
  projects.any: "1214264767251100"   # Wet Ink Social Media project
  custom_fields: '{"1215162242710046.contains":"<target.webflow_id>"}'
  fields: ["gid", "name", "permalink_url"]
```

(The Wet Ink Social Media project ID and other operational IDs live in `instagram-reels` SKILL.md "Required Asana IDs" section — do not restate them here.)

**Why custom-field search and not title search:** titles are fragile. Webflow edits, curly-quote drift, and partial-substring false positives caused the original failure mode this whole change was designed to fix. The ArticleID custom field is the durable unique key.

**Match interpretation** (carousel is always expected on new builds — see Step 5.5b):
- **3 matches** → **Asana has the full set** (Uncensored + SFW + Carousel). Treat as "skipped-built-already" and route to Phase 4 Step 11.
- **2 matches on a historical row** (where column K Carousel == "N") → also counts as "Asana has it" for cycle-era articles that never got a carousel. Don't retroactively build one. Route to Phase 4 Step 11.
- **1 or 2 matches on a new-era row** → **partial-built**. The pipeline crashed mid-Phase-4 in a previous run. Treat as "needs build" so Phase 2-4 fires and the verify step (Phase 4 Step 10.5) creates the missing task(s). Phase 4 Step 10 task creation should idempotently skip the already-existing ones (search again right before each create).
- **0 matches** → **needs build** (normal path).

**Fallback when `target.webflow_id` is empty** (e.g., older row from before the column existed, or Step 1.5 lookup failed): fall back to the original name-based search:

```
mcp__asana__search_tasks_preview:
  workspace: "<wet ink workspace gid>"
  projects.any: "1214264767251100"
  text: "<article title>"
```

Match logic for the fallback: a task is a hit if its name, after the same normalization the webhook uses, contains the article title. Normalization:
- lowercase, trim
- `‘’` → `'`, `“”` → `"`
- `—–` → `-`
- strip trailing `?!.,`
- collapse whitespace

The Wet Ink Reels pattern is two tasks per article: `<Article Title> — Long Uncensored Reel` and `<Article Title> — Long SFW Reel`. Either matching counts as "Asana has it" in the fallback path.

### Step 5.5d: Check the tracker In Asana column

You already have the tracker rows from Step 2 (`list_titles` response). Find the article's row by title in that array and read its `in_asana` field:
- `Y` → counts as "tracker says yes"
- `N`, empty, or `—` → counts as "tracker says no"

If you don't have the Step 2 data still in context (long Phase 2 may have evicted it), re-call `list_titles` via the webhook — same as Step 2.

### Step 5.5e: Branch the pipeline

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

For the **target article** identified in Phase 1.5 Step 5.5, fetch the article page with `web_fetch` (or via the Webflow CMS MCP `data_cms_tool` if WebFetch is blocked — the Webflow CMS fallback is also available as a fallback for Phase 1's site scrape).

Extract and stash for use by both subagents:

- `title` — full article title
- `body_excerpt` — opening 2-3 paragraphs (enough for caption + reel hook drafting)
- `key_claims` — 2-3 of the article's strongest claims
- **`article_image_urls` — an ORDERED LIST of every content image** in the article. See "Image extraction rules" below.
- `author` — author name if available
- `category` — Side Notes / Industry / Business / Features / Creators / Galleries
- `article_url` — full URL

**If `article_image_urls` is empty, do NOT proceed to Phase 2.** Save a report flagging "no usable article images" and stop. The pipeline depends on at least one article-specific image being available.

#### Image extraction rules

The first image in the list is the **hero** — it should always be present. Subsequent images come from the article body. The Reel build distributes images across the 5 scenes (see `instagram-reels` SKILL.md for the distribution algorithm).

**When fetching via Webflow CMS (`data_cms_tool`)**:
The Wet Ink Posts collection schema has **two separate top-level image fields** plus inline body images. Extract all three categories:

1. **`fieldData["main-image"].url`** — the article-page hero. Place at **element 0** of `article_image_urls`.
2. **`fieldData["thumbnail-image"].url`** — the listing-card thumbnail. **This is a SEPARATE field with a DIFFERENT image** (typically a different shot from the same photoshoot — confirmed for Wet Ink posts). Place at **element 1**. Do NOT assume it duplicates `main-image`; verify by URL and de-dupe only if the URLs literally match.
3. **Body images** — parse `fieldData["content"]` (rich-text HTML). Extract every `<img src="...">` whose `src` is on `cdn.prod.website-files.com`. Append them in document order starting at element 2.

Final `article_image_urls` for a typical Wet Ink post: `[main-image, thumbnail-image, body_img1, body_img2, ...]`. Most posts will produce 2-4 entries. The N≥2 distribution rule in `instagram-reels` Step 3 handles all the spreads.

If `main-image` is missing or empty, fall back to `thumbnail-image` as element 0. If both are missing, do NOT proceed to Phase 2 — see the "If `article_image_urls` is empty" rule below.

**When scraping the live page (`web_fetch` or raw HTML)**:
- Hero image is the CSS `background-image` on the `.hero-image` div (NOT an `<img>` tag — the page uses CSS bg for the header).
- Body images are `<img>` tags inside the article body, NOT inside `.side-social-button`, `.social-icon`, `.menu-*`, `.post-thumb` (related-posts thumbnails in the footer), or any nav/footer chrome. Filter aggressively — only inline `<img>` tags on `cdn.prod.website-files.com` with `naturalWidth > 200`.

**De-duplicate.** If the same URL appears in both the hero field and the body (the CMS sometimes auto-inserts the hero into the body), keep only the first occurrence.

**Validation.** Each URL should match `https://cdn.prod.website-files.com/...\.(jpe?g|png|webp)`. Drop anything that doesn't, plus anything that looks like an icon or thumbnail (path includes `icon`, `thumb`, `avatar`, `logo`).

### Step 7: Spawn the two build subagents in parallel

Spawn both at the same time. They have no dependency on each other.

**Reel subagent prompt:**

```
Read .claude/skills/instagram-reels/SKILL.md and execute it end to end
for this article:

Title: {title}
Body excerpt: {body_excerpt}
Key claims: {key_claims}
Article image URLs (ordered, hero first): {article_image_urls}
Author: {author}
Category: {category}

The reels skill's Step 3 must upload ALL of the article image URLs
above (not just the first one) and distribute them across the 5
scenes per the skill's distribution algorithm. The reviewer's
coverage check will FAIL if any uploaded image isn't used in at
least one scene, so this isn't optional.

Return a structured result:
  uncensored_design_id: ...
  uncensored_edit_url: https://www.canva.com/design/.../edit
  sfw_design_id: ...
  sfw_edit_url: https://www.canva.com/design/.../edit
  uploaded_asset_ids: [...]   ← LIST. one per uploaded article image, in upload order.
                                 Required for Phase 3 reviewer.
  scene_asset_assignment:     ← which uploaded asset_id ended up on each of the 5 scenes
    scene_1: <asset_id>
    scene_2: <asset_id>
    scene_3: <asset_id>
    scene_4: <asset_id>
    scene_5: <asset_id>
  step_7_5_flags: [...]       ← any flags raised by the reels skill's inline QA checks

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

**Carousel subagent prompt** (always spawn — every article gets a carousel):

```
Read .claude/skills/instagram-carousel/SKILL.md and execute it end to end
for this article:

Title: {title}
Body excerpt: {body_excerpt}
Key claims: {key_claims}
Article image URLs (ordered, hero first): {article_image_urls}
Author: {author}
Category: {category}
Article URL: {article_url}

The carousel skill uses the same article images you'd pass to the
Reel subagent. Upload them and distribute across the carousel slides
per the skill's rules. All carousel text is SFW (Instagram throttles
explicit content) — there's no Uncensored carousel version.

Return a structured result:
  carousel_design_id: ...
  carousel_edit_url: https://www.canva.com/design/.../edit
  uploaded_asset_ids: [...]      ← list, one per uploaded image
  step_7_5_flags: [...]          ← any flags raised by the carousel skill's inline QA

Do NOT create Asana tasks. That happens in Phase 4 of the parent pipeline.
```

Collect all subagent results before proceeding. If any subagent fails, stop the pipeline, save a report, and surface the failure. Do NOT proceed to Phase 3 with partial output.

**Critical hand-off:** The Reel subagent MUST return `uploaded_asset_ids` (list). The reviewer cannot do its job without it. The Carousel subagent returns its own `uploaded_asset_ids` for its design.

---

## PHASE 3: REVIEW (IMAGE-FIDELITY GATE)

### Step 8: Invoke the reviewer subagent

Spawn the `reel-image-reviewer` subagent:

```
Run the reel-image-reviewer agent.

Inputs:
- expected_asset_ids: {uploaded_asset_ids}    # the FULL list returned by the Reel subagent — one entry per uploaded article image. Order matches the article_image_urls input.
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

Defer to `instagram-reels` SKILL.md Step 9 for task structure (assignee, section, follower IDs, project ID). DO NOT restate those IDs here. Carousel tasks reuse the same Asana project, section, and assignee.

**Every task MUST set the ArticleID custom field.** This is the durable unique key the rest of the pipeline (preflight, self-heal, verify) matches on. Add `custom_fields: {"1215162242710046": "<target.webflow_id>"}` to every task object in the `create_tasks` call. (Note: on **create/update**, the custom_fields map uses the plain GID as the key — `.contains` is a SEARCH filter qualifier and does NOT apply to writes. The `update_tasks` MCP also accepts a nested object directly rather than a JSON string.)

If `target.webflow_id` is empty for this article (older row that wasn't backfilled, or Step 1.5 lookup failed): create the tasks without the custom field but log a WARNING in the final report — the article will be invisible to Phase 0.5 self-heal and Phase 1.5 preflight ArticleID search, falling back to title-based matching only.

Create:
- **Two Reel tasks** — Uncensored + SFW. Per the existing template below.
- **One Carousel task** — always (every article gets a carousel). Single SFW carousel; no Uncensored version.

Augment each Reel task's `notes` field with the captions from Phase 2. The Uncensored Reel task carries `twitter_uncensored`; the SFW Reel task carries `twitter_sfw`. Both Reel tasks include the IG caption. The Carousel task includes the IG caption + hashtags only (no X/Twitter copy — carousel posts go to IG, not X).

**Notes template for each Reel task:**

```
Edit text and images as needed.

Canva link: https://www.canva.com/design/{design_id}/edit

Article: {title}
Version: {Long Uncensored | Long SFW} (5 scenes)
Reviewer: PASS — all 5 scenes verified against article images.

---
Suggested Instagram caption:
{instagram_caption}

Hashtags:
{instagram_hashtags joined with spaces}

---
Suggested X/Twitter copy ({Uncensored | SFW}):
{twitter_uncensored or twitter_sfw}
```

**Notes template for the Carousel task** (always created):

```
Edit text and images as needed.

Canva link: https://www.canva.com/design/{carousel_design_id}/edit

Article: {title}
Type: Instagram Carousel (SFW only)

---
Suggested Instagram caption:
{instagram_caption}

Hashtags:
{instagram_hashtags joined with spaces}
```

### Step 10.5: Verify Asana tasks by ArticleID

After `create_tasks` returns, re-query Asana to confirm the tasks actually landed AND have the ArticleID custom field set. This catches the failure mode that motivated this whole change: `create_tasks` returning "success" but tasks not appearing, or appearing without the custom field.

```
mcp__asana__search_tasks
  workspace: "<wet ink workspace gid>"
  projects.any: "1214264767251100"
  custom_fields: '{"1215162242710046.contains":"<target.webflow_id>"}'
  fields: ["gid", "name", "permalink_url"]
```

**Expected count:**
- N = **3** for every fresh build (Uncensored + SFW + Carousel — carousels are now built for every article).

**If actual count != expected:** save a FAIL report to `/Users/andrewnagle/Claude/Wet Ink Organic Social Posts/content-pipeline-<YYYY-MM-DD>-VERIFY-FAIL.md` with:
- target article (title, webflow_id, URL)
- expected count, actual count
- list of returned task gids + names
- the `create_tasks` response

**DO NOT flip the tracker** (`In Asana=Y`) on verify FAIL. The tracker stays `N` so the next pipeline run / self-heal phase can retry. Surface the failure prominently in the final report so the user can intervene.

If `target.webflow_id` is empty (couldn't be set in Step 10), skip the verify step but log a NOTICE in the final report explaining why verification was skipped.

### Step 11: Flip tracker flags via the webhook

Two flips per article that went through Phase 2-4:

**Always — flip `In Asana` (column J) to Y:**

```bash
curl -X POST "https://wet-ink-ops.vercel.app/api/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -d '{
    "action": "flip_in_asana",
    "title": "<article title>",
    "value": "Y"
  }'
```

**Always — flip `Carousel` (column K) to Y (every article gets a carousel):**

```bash
curl -X POST "https://wet-ink-ops.vercel.app/api/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -d '{
    "action": "flip_carousel",
    "title": "<article title>",
    "value": "Y"
  }'
```

Both webhook actions normalize the title the same way the `append` action does, so curly-quote drift won't cause a miss.

If either webhook returns an error (title not found in tracker), log it but don't block — the Asana tasks have been created at this point, so the failure is recoverable (a human can flip the flag manually). Include the error in the Phase 4 final report.

### Step 12: Final report

Tell the user / log to the scheduled-run report:

- Article(s) processed in this run (title, category, URL — one section per iteration if the loop fired multiple times)
- Phase 1.5 preflight outcome per article (built fresh / skipped-built / skipped-done)
- Reviewer verdict: PASS (or skipped if Phase 1.5 routed us around it)
- Canva edit URLs: 2 Reels (Uncensored + SFW) + 1 Carousel per article
- Asana task URLs: 2 Reel tasks + 1 Carousel task per article
- IG caption preview (first 100 chars)
- Number of remaining eligible articles (post-May-10, `In Asana != Y`)
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
- **Webflow Posts collection:** look up once via `data_cms_tool` `list_collections` (cached if the lookup is repeated within a run)
- **Asana `ArticleID` custom field GID:** `1215162242710046` (text custom field on the Wet Ink Social Media project `1214264767251100`). Holds the Webflow CMS item id. THE durable unique key the pipeline matches on — never use title-substring matching when this is available.
- **Asana `ArticleID` custom_field_settings GID** (only needed for admin/setup, not for normal pipeline operation): `1215162242710047`
- **Backup report directory:** `/Users/andrewnagle/Claude/Wet Ink Organic Social Posts/`

All Canva template/folder/brand-kit IDs and all Asana project/section/assignee/collaborator IDs are read from `instagram-reels` SKILL.md. If you find yourself about to type a Canva or Asana ID into this skill, stop — it belongs in the downstream skill instead.

---

## EDGE CASES

**Galleries / photo-only articles** (e.g., red-carpet recaps, "Best Dressed"): The reel subagent should pick the strongest image from the gallery as the hero. If no usable image exists, stop at Step 6 — do not proceed to Phase 2 without a confirmed hero image.

**Side Notes** (short news items): These ALWAYS get reels per Andrew's direction. The reel skill anchors the hook on the article's core claim and keeps scenes tight. If a Side Notes piece is truly only 1-2 sentences, the caption subagent should also keep platform copy proportionally tight.

**Articles with explicit titles:** The SFW reel and SFW X/Twitter copy each need a reframed title/lead. Both subagents handle this in their own skills — no coordination needed at this layer.

**Webflow title edits:** If a site title is similar but not identical to a tracked title, do NOT auto-add as new. Flag the diff to the user and let them confirm.

**Sheet write fails (Phase 1):** If the webhook returns an error (e.g., Vercel deploy is down, refresh token revoked), save the proposed rows to the backup file and stop the pipeline. Do NOT proceed to Phase 2-4 without a confirmed tracker write — that's how duplicate work happens.

**Multiple unprocessed articles** (newly-scraped + backlog from prior runs): Phase 2-4 processes exactly one per run — the most recent unprocessed article, per Phase 1.5 Step 5.5's selection rule. Older unprocessed articles get picked up by subsequent runs (which fire twice daily). Tell the user how many backlog candidates remain after this run.

**Curly-quote drift:** Webflow renders straight quotes (`'`) but Google Sheets sometimes auto-corrects to curly (`’`). Always normalize quote characters before comparing titles.

**Reviewer FAIL on one design but not the other:** Treat as overall FAIL. Don't half-commit. Save the report and stop.

---

## CAROUSELS — AUTOMATED FOR EVERY ARTICLE

The pipeline builds a carousel for every article in addition to its Reels — no cycle gating. Set in Phase 1.5 Step 5.5b (`needs_carousel = true`, always).

To retroactively build a carousel for an older article (cycle-era row where K = N), invoke the `instagram-carousel` skill directly:

> "Create an Instagram carousel for [article title]"

Then flip the tracker manually via the webhook:

```bash
curl -X POST "https://wet-ink-ops.vercel.app/api/webhook" \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -d '{"action":"flip_carousel","title":"[article title]","value":"Y"}'
```

---

## TOKEN BUDGET ESTIMATE

Parallel subagents change the math vs. the old serial design:

- **Phase 1 only (detect + sheet append):** ~25-40K tokens (main context)
- **Phase 2 parallel build:** ~150K Reel subagent + ~30K caption subagent + ~100K Carousel subagent (isolated contexts, run concurrently).
- **Phase 3 reviewer:** ~15-25K reviewer subagent (isolated context)
- **Phase 4 commit + main coordination overhead:** ~30K main context

Total: ~330-375K tokens per article (Reel + Carousel always). Wall-clock time is faster because subagents run in parallel.

---

## SCHEDULED-RUN BEHAVIOR

When this skill is invoked from a scheduled task (no user present, no laptop required):

- Phase 1 runs to completion: scrape, read tracker, append new article rows via the webhook.
- Phase 1.5 selects the most recent unprocessed article (`In Asana != Y` AND `Published Date >= 2026-05-10`) and runs the preflight on it. If Asana already has it, skip ahead to Phase 4 Step 11 (flip flag) for that article. If both checks positive (fully done), skip to the loop check. If no eligible article exists at all, exit.
- Phase 2-4 proceed for the selected target article, **only if Phase 1.5 says proceed AND Step 6 found at least one usable article image**.
- After each Phase 4 completes (or after Phase 1.5 routes around Phase 2-3), **loop back to Phase 1.5** and process the next eligible article. Up to 10 articles per run (safety cap).
- Reviewer FAIL halts at Phase 3, saves the FAIL report, does NOT create Asana tasks.
- Reviewer PASS continues through Phase 4.
- Final output is a markdown report. If running locally with access to `/Users/andrewnagle/Claude/Wet Ink Organic Social Posts/`, save it as `content-pipeline-<YYYY-MM-DD>.md` there. If running as a remote CCR routine (no local filesystem access), print the report as the final assistant message instead — it'll show up in the routine's run log at claude.ai/code/routines.

Report should cover: new articles found, sheet rows appended, Phase 1.5 outcome, reviewer verdict, Canva/Asana links, captions generated, anything that needs manual attention.

The scheduled routine needs `WEBHOOK_SECRET` available. The remote-trigger API doesn't expose env vars, so the secret is currently embedded in the routine's user prompt (visible only to the user's account). If that ever changes (e.g., env var support added), migrate it out of the prompt.

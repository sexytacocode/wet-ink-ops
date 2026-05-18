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
Pick the **target article** for this run — defined as the tracker row with the most recent `Published Date` where `In Asana` is `N`, blank, or `—`. (Today's newly-scraped articles naturally fall into this set because `append` writes `In Asana=N`; backlog articles from prior runs that never built do too.) Then check Asana + the tracker's `In Asana` column to see whether the reel was already created via an ad-hoc run. Branches the pipeline:
- No target article found (everything is `In Asana=Y`) → exit pipeline
- Target found, both checks negative → proceed to Phase 2 (normal build)
- Target found, Asana already has it → skip Phase 2-3, jump to Phase 4 Step 11 (flip flag), done
- Target found, both positive → exit pipeline, nothing to do

**Phase 2 — Build (parallel subagents, only if Phase 1.5 says proceed)**
For the target article from Phase 1.5, fan out two subagents simultaneously from the same article inputs:
- **Reel subagent** — invokes `instagram-reels` (which pulls `wet-ink-voice` for on-design copy). Produces Uncensored + SFW designs and returns the list of uploaded `asset_ids` (one per article image) plus the per-scene assignment.
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
- Total articles parsed from page 1 of all-posts (or from the Webflow CMS fallback)
- Count already in tracker
- Count newly appended this run (with titles, dates, categories, URLs)
- Count of "backlog" rows (already in tracker but `In Asana = N`)
- Whether Phase 1.5 will proceed (yes if newly-appended count + backlog count > 0)

If newly-appended count + backlog count == 0: "All tracker rows are in Asana. Nothing to process." Exit the pipeline.

---

## PHASE 1.5: PREFLIGHT CHECK

This phase has two jobs:
1. **Pick the target article** — the tracker row this run will process in Phase 2-4.
2. **Decide whether to build it** — checking Asana + tracker against ad-hoc runs that already produced a Reel.

### Step 5.5 (pre-select): Identify the target article

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

The rest of Phase 1.5 (Step 5.5a and 5.5b below) checks whether the target article was already processed via an ad-hoc route, and routes the pipeline accordingly.

### Multi-article runs

After completing Phase 4 Step 12 (or Phase 4 Step 11 if Asana already had the article), **loop back to Step 5.5 with the remaining eligible articles**. Process up to **10 articles per run** (a safety cap; lift it later if needed). Stop conditions:

- Filtered set is empty (no more eligible articles)
- Loop has executed 10 times in this run (cap)
- Any iteration hits a fatal error (Phase 1 webhook write fails, no hero image, reviewer INCONCLUSIVE for unrecoverable reasons)

Each iteration is independent — Phase 1 is NOT re-run within the loop (already done for this run). Just Phase 1.5 → 2 → 3 → 4, with a fresh target article selection at the start of each iteration.

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

Collect both results before proceeding. If either subagent fails, stop the pipeline, save a report, and surface the failure. Do NOT proceed to Phase 3 with partial output.

**Critical hand-off:** The Reel subagent MUST return `uploaded_asset_id`. The reviewer cannot do its job without it.

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

**Multiple unprocessed articles** (newly-scraped + backlog from prior runs): Phase 2-4 processes exactly one per run — the most recent unprocessed article, per Phase 1.5 Step 5.5's selection rule. Older unprocessed articles get picked up by subsequent runs (which fire twice daily). Tell the user how many backlog candidates remain after this run.

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

- Phase 1 runs to completion: scrape, read tracker, append new article rows via the webhook.
- Phase 1.5 selects the most recent unprocessed article (`In Asana != Y` AND `Published Date >= 2026-05-10`) and runs the preflight on it. If Asana already has it, skip ahead to Phase 4 Step 11 (flip flag) for that article. If both checks positive (fully done), skip to the loop check. If no eligible article exists at all, exit.
- Phase 2-4 proceed for the selected target article, **only if Phase 1.5 says proceed AND Step 6 found at least one usable article image**.
- After each Phase 4 completes (or after Phase 1.5 routes around Phase 2-3), **loop back to Phase 1.5** and process the next eligible article. Up to 10 articles per run (safety cap).
- Reviewer FAIL halts at Phase 3, saves the FAIL report, does NOT create Asana tasks.
- Reviewer PASS continues through Phase 4.
- Final output is a markdown report. If running locally with access to `/Users/andrewnagle/Claude/Wet Ink Organic Social Posts/`, save it as `content-pipeline-<YYYY-MM-DD>.md` there. If running as a remote CCR routine (no local filesystem access), print the report as the final assistant message instead — it'll show up in the routine's run log at claude.ai/code/routines.

Report should cover: new articles found, sheet rows appended, Phase 1.5 outcome, reviewer verdict, Canva/Asana links, captions generated, anything that needs manual attention.

The scheduled routine needs `WEBHOOK_SECRET` available. The remote-trigger API doesn't expose env vars, so the secret is currently embedded in the routine's user prompt (visible only to the user's account). If that ever changes (e.g., env var support added), migrate it out of the prompt.

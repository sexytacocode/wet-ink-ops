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

- [ ] **Google Drive tools loaded** — Reads only. Load via `tool_search`: `search_files`, `read_file_content`. (Do NOT use `create_file` to write back — it would overwrite the multi-table sheet.)
- [ ] **web_fetch / bash available** — Used to scrape the all-posts page. The page is ~70KB and will exceed the inline token limit, so the fetched body should be parsed via bash/python from the temp file `web_fetch` saves it to.
- [ ] **Claude in Chrome MCP available** — Used to write new article rows into the tracker sheet (the only safe write path; see "Sheet writes" below). Load via `tool_search` with query `"claude-in-chrome"`.
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

This skill runs in four phases:

**Phase 1 — Detect & log (cheap, ~25-40K tokens)**
Scrape wetinkmag.com/all-posts, diff against the tracker sheet, append new rows.

**Phase 2 — Build (parallel subagents, only if new articles found)**
For the FIRST new article, fan out two subagents simultaneously from the same article inputs:
- **Reel subagent** — invokes `instagram-reels` (which pulls `wet-ink-voice` for on-design copy). Produces Uncensored + SFW designs and returns the uploaded asset_id.
- **Caption subagent** — invokes `social-post-optimizer` + `wet-ink-voice`. Produces Instagram caption, hashtags, and X/Twitter copy (both Uncensored and SFW).

**Phase 3 — Review (image-fidelity gate)**
Invoke `reel-image-reviewer` subagent with the two design_ids and the expected asset_id. Reviewer reads each design with a fresh context and verifies every scene's editable fill uses the article hero image, not a template default.

**Phase 4 — Commit (only on reviewer PASS)**
Create one Asana task per Reel with platform captions embedded in the description, then flip the article's tracker row. On reviewer FAIL, save a structured report and stop — no Asana tasks, no tracker flip.

**Why one article at a time?** Each Reel build still uses ~150K tokens in the subagent context. Processing one article per run keeps total token use predictable and aligns with how Andrew prioritizes the queue manually.

**Reels for every category.** Per Andrew's standing direction, every new article gets a reel — Side Notes, Industry, Business, Features, Creators, Galleries. The reels skill handles per-category framing.

---

## TRACKER SHEET (READ-ONLY VIA DRIVE)

- **Sheet title:** `Wet_Ink_IG_Content_Tracker`
- **Sheet ID:** `1sPQwj2ZSu9A7drg2YuUwQrcwVQ7JQNcbM7qRbQhMhaA`
- **View URL:** https://docs.google.com/spreadsheets/d/1sPQwj2ZSu9A7drg2YuUwQrcwVQ7JQNcbM7qRbQhMhaA/edit

### Sheet structure (DO NOT overwrite)

The sheet contains FOUR stacked tables in one tab:

1. **Article Coverage table** (the one we read & append to)
   Columns: `# | Article Title | Published Date | Posted on IG? | Post Type | IG Post Date | IG Link | Create Post? | New Post Type | Order | In Asana`

2. **Posted / Not Posted summary** (rolling counters)

3. **Instagram Posts performance table**
   Columns: `# | Date Posted | Post Type | Caption | Likes | Comments | Reach | Shares | Saved | Engagement | Link`

4. **Article slug map** (Title | Slug | Published Date)

**Critical:** A CSV-overwrite via `create_file` would destroy tables 2-4 and the formatting. NEVER write to this sheet via the Drive MCP. Only write via Chrome MCP (typing into the live spreadsheet) so the existing structure stays intact.

### If the sheet doesn't exist (rare)

If `search_files` with `title contains 'Wet_Ink_IG_Content_Tracker'` returns nothing, stop and ask the user — don't auto-create. The sheet has bespoke structure that shouldn't be regenerated from scratch.

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

### Step 2: Read the tracker sheet

```
read_file_content(fileId: "1sPQwj2ZSu9A7drg2YuUwQrcwVQ7JQNcbM7qRbQhMhaA")
```

The Article Coverage table is the first markdown table in the response. Extract the `Article Title` column for comparison. Note the highest `#` value — that's where appends start.

### Step 3: Compare

An article from the site is "new" if its title does not appear in the sheet's Article Coverage `Article Title` column.

**Matching rules:**
- Lowercase both sides
- Strip leading/trailing whitespace
- Strip trailing `?`, `!`, `.`, `,`
- Normalize curly quotes (`’` → `'`, `“` → `"`)
- If a site title is a close-but-not-exact match (likely a Webflow edit), flag for the user instead of treating as new

### Step 4: Append new rows via Chrome MCP

For each new article, append a row to the bottom of the Article Coverage table. The next-row number is the highest existing `#` + 1.

**Default column values for new rows:**

| Column | Value |
|---|---|
| `#` | next sequential number |
| `Article Title` | from web scrape |
| `Published Date` | from web scrape (e.g., "May 6, 2026") |
| `Posted on IG?` | `N` |
| `Post Type` | (blank) |
| `IG Post Date` | (blank) |
| `IG Link` | (blank) |
| `Create Post?` | `Y` |
| `New Post Type` | `Reel` |
| `Order` | (blank — Andrew sets the queue order manually) |
| `In Asana` | `N` (will flip to `Y` after Phase 4 PASS) |

**Chrome MCP write procedure:**

1. `tabs_context_mcp` (creates the tab group if needed) → `tabs_create_mcp` for a new tab
2. `navigate` to `https://docs.google.com/spreadsheets/d/1sPQwj2ZSu9A7drg2YuUwQrcwVQ7JQNcbM7qRbQhMhaA/edit`
3. Wait for page load (`computer.action: "wait"` ~3s)
4. Use `javascript_tool` to find the cell coordinates of the next empty row in the Article Coverage table. The table starts at row 2 (row 1 is the header) and ends at the row before the "POSTED:" summary cell. Locate the last filled `#` value, then target the next row.
5. Click into the cell at column A of the next empty row.
6. Type values tab-separated using `key: "Tab"` between cells.
   - Sequence per row: `<#>`, Tab, `<title>`, Tab, `<date>`, Tab, `N`, Tab, Tab, Tab, Tab, `Y`, Tab, `Reel`, Tab, Tab, `N`, Enter
7. After all new rows are typed, take a screenshot to confirm the rows landed in the correct table (and not in one of the other tables below).

**Fallback if Chrome MCP fails:** If the extension isn't connected or sheet writes error, save the proposed rows to `/Users/andrewnagle/Claude/Wet Ink Organic Social Posts/content-pipeline-<YYYY-MM-DD>.md` and tell the user to paste manually. Do NOT attempt a Drive overwrite.

### Step 5: Report findings

Tell the user:
- Total articles parsed from page 1 of all-posts
- Count already in tracker
- Count new (with titles, dates, categories, URLs)
- Whether Phase 2 will proceed (yes if at least one new article)

If no new articles: "All articles are tracked. Nothing new to process."

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
- expected_asset_id: {uploaded_asset_id}
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

### Step 11: Update tracker via Chrome MCP

Find the article's row in the Article Coverage table by title (use the same matching rules as Phase 1 Step 3). Flip `In Asana` from `N` to `Y`. No other columns change at this stage.

### Step 12: Final report

Tell the user / log to the scheduled-run report:

- Article processed (title, category, URL)
- Reviewer verdict: PASS
- Both Canva edit URLs (Uncensored + SFW)
- Both Asana task URLs
- IG caption preview (first 100 chars)
- Number of new articles remaining unprocessed
- "Run the pipeline again in a fresh conversation to process the next article."

---

## DESKTOP FALLBACK (no subagent support)

If this skill is invoked in an environment without subagent support (Claude Desktop), execute Phase 2-3 sequentially in the main context instead of spawning subagents:

1. Run the `instagram-reels` skill inline. Capture design IDs and `uploaded_asset_id`.
2. Run `social-post-optimizer` + `wet-ink-voice` inline to draft captions.
3. **Skip the formal reviewer subagent.** Instead, after both designs are committed, explicitly re-load each design's pages via `Canva:get-design-pages` and manually compare each scene's editable fill `asset_id` against `uploaded_asset_id`. If any scene shows a different asset, stop and report — do not create Asana tasks.
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

**Sheet write fails (Phase 1):** If Chrome MCP can't append new rows, save the proposed rows to the backup file and tell the user. Phase 2-4 should still run for the most recent new article — losing the sheet write shouldn't block reel creation.

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

When this skill is invoked from a scheduled task (no user present):

- Phase 1 runs to completion: scrape, read tracker, append new rows via Chrome MCP, save backup file.
- Phase 2-4 proceed automatically for the FIRST new article only. Skip Phase 2-4 entirely if Chrome MCP isn't connected (no autonomous Canva work without a confirmed tracker write path) or if no hero image was found at Step 6.
- Reviewer FAIL halts at Phase 3, saves the FAIL report, does NOT create Asana tasks.
- Reviewer PASS continues through Phase 4.
- Final output is a markdown report saved to `/Users/andrewnagle/Claude/Wet Ink Organic Social Posts/content-pipeline-<YYYY-MM-DD>.md` summarizing: new articles found, sheet rows appended, reviewer verdict, Canva/Asana links, captions generated, anything that needs manual attention.

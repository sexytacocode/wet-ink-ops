---
name: news-triage
description: >
  Fast NEWS desk for Wet Ink Magazine. Monitors adult-industry trade press (AVN, XBIZ,
  YNOT) and mainstream/Google-Alerts crossover coverage for TIMELY, current stories in
  Wet Ink's beats — platform news (acquisitions, feature launches, policy changes), law
  & money (age-verification laws, bills, creator taxes, payment-processor moves), notable
  adult creators/performers in the news, and industry-wide stories the media is picking
  up — and turns them into a rich multi-outlet summary plus a short Wet Ink angle so Wet Ink
  stays current and rides the news cycle. Scores each story on a newsworthiness + relevance
  rubric (multi-outlet pickup is the key signal), writes a structured SOURCE SUMMARY that
  synthesizes EVERY outlet covering the story (topline, what happened, key quotes, the bigger
  picture, and how the coverage connects) followed by a 1–2 sentence Wet Ink pitch, and files
  an Asana task in the "Wet Ink — News Triage" project with the summary + pitch embedded in
  the card (no Google Doc — embed-only is the default). It does NOT write the finished
  article — editors write that from the summary. This is the OUTBOUND-news counterpart to
  content-pipeline (which turns our OWN published articles into social). The desk's main
  output is the source summary + pitch → Asana; it also attaches a draft social card to
  INSTAGRAM-destination stories only (Phase 5.5, added 2026-07-29 at Andrew's request —
  those stories never become articles, so nothing else would ever make art for them).
  Finished captions and all ARTICLE/BOTH artwork stay with content-pipeline. It is NOT for evergreen, search-keyword content
  (how-to guides, "X vs Y" comparisons, glossary/pillar pages) — Wet Ink writes those
  in-house; this desk only does current news. Triggers include: "run the news triage," "check industry news," "what's
  happening in the industry," "news triage," "any breaking adult-industry news," "what
  should we cover today," or any request to scan the press for timely stories to cover fast.
  Use this skill — not content-pipeline — when the goal is fast original coverage of current
  external news.
---

## ⚠️ PRE-FLIGHT CHECKLIST

- [ ] **WebSearch / WebFetch available** — used in Phase 1 to pull current headlines from the trade press and mainstream crossover coverage. Load via `tool_search` if deferred.
- [ ] **bash / curl / python3 available** — Phase 2.5 already-covered check hits the wetinkmag.com WordPress REST API (`/wp-json/wp/v2/posts?search=...`) to confirm Wet Ink hasn't already published the story.
- [ ] **Asana MCP loaded** — Phase 0 dedupe read + Phase 5 task creation. Load via `tool_search` query `"asana"`.
- [ ] **Google Drive MCP loaded** — Phase 4 Google Doc creation. Load via `tool_search` query `"google drive create_file"`. The `create_file` tool turns `textContent` (markdown/plain) into a native `application/vnd.google-apps.document` automatically — that is the draft.
- [ ] **Skills referenced** — `wet-ink-voice` (for the Wet Ink angle/pitch line only — the summary itself is neutral reporting). Read it when invoked; do not restate its rules here.
- [ ] **Rubric** — read `rubric.md` in this skill folder before scoring. It holds the current SEO keyword clusters (distilled from the "Wet Ink SEO Audit — April 2026" Asana project) and the scoring bands.
- [ ] **Social card tool (only if any story routes `INSTAGRAM`)** — `bin/wetink-card/` needs the `higgsfield` CLI on `$PATH` with credits (`higgsfield account status`), and `attach-card.sh` needs `ASANA_TOKEN` exported. Neither is a blocker: if either is missing, file the tasks without cards and say so in the run report.

---

## SOURCE-OF-TRUTH RULE

This skill does NOT restate the Wet Ink voice rules, the social caption rules, or any operational ID that belongs elsewhere. The only IDs that live here are the News-Triage-specific ones in "Required IDs" below. Voice rules live in `wet-ink-voice`; keyword clusters live in `rubric.md`.

---

## OVERVIEW — seven phases

**Phase 0 — Load Asana dedupe ledger (cheap).** Pull every existing task in the News Triage project (all sections) plus the Triage Log comments. Build the set of already-*triaged* source URLs and headlines so we don't re-file a story we already filed. Asana is the store of record for triage — there is no separate database.

**Phase 1 — Gather candidates (cheap, web).** Pull recent (≤48h, or ≤7d on a weekly run) headlines from the four source tiers. Collect for each: headline, source name, canonical URL, published time, one-paragraph summary.

**Phase 2 — Score & select.** Score every fresh candidate on the weighted rubric in `rubric.md`. Anything scoring **3+** is "accepted" and proceeds toward drafting; **0–2** is "rejected" and gets logged (Phase 5b), not drafted. On a normal run cap accepted stories at **3 per run** (highest score first) to keep token + writer load sane; note any overflow in the report.

**Phase 2.5 — Already-covered check (wetinkmag.com) — MANDATORY GATE.** Before any accepted story is drafted, query the live WordPress site to confirm Wet Ink has not already published an article on it. A story that passes the Asana ledger (never triaged) can still already exist as a published post — the two layers catch different things. See "ALREADY-COVERED CHECK" below. Already-covered stories are dropped from drafting and logged as `already-covered` (not as score-rejects).

**Phase 2.6 — Route to a destination.** For every story that survived 2.5, score two more axes from `rubric.md` — **search demand / SEO value (0–3)** and **social pull (0–3)** — and derive a **DESTINATION**: `ARTICLE`, `INSTAGRAM`, `BOTH`, or `NEITHER`. These do not change accept/reject; they answer what the story should *become*. Some stories are for readers to read, others exist to be found in search — different jobs, and one story rarely does both equally. Verify any SEO score of 2–3 against real Search Console data (`mcp__search-console__get_search_analytics`, wetinkmag.com, last 28 days, filtered to the story's core query) and record the actual impressions/clicks on the card. `NEITHER` gets a line in the run report, not a card.

**Phase 3 — Summarize (one subagent per accepted story).** For each accepted story, write a structured SOURCE SUMMARY that synthesizes **every** outlet covering it — topline, what happened, key quotes, the bigger picture, and how the coverage connects — then a 1–2 sentence Wet Ink angle/pitch. This is reporting for an editor, NOT a finished article; the editor writes the article from it. See "Summary spec" below. Invoke `wet-ink-voice` for the pitch line only; the summary body stays neutral and attributed.

**Phase 4 — (removed.)** Summaries are embedded in the Asana card, not saved as Google Docs. Embed-only is the default (Andrew's call, 2026-06-25): simpler, self-contained, no Drive dependency (Drive's daily write quota bit a prior run). Skip Doc creation entirely.

**Phase 5 — File Asana tasks.**
- **5a (accepted):** one task per story in News Triage → **New Review** section, assignee + follower per "Required IDs", with the structured card (source, outlets covering, link, score, beat) followed by the **source summary + Wet Ink pitch embedded in `html_notes`** (see "ASANA TASK" for the format). No Google Doc. Staff then move it to **Approved** (taking it into their content timeline) or **Not Interested** (rejected — reviewed weekly).
- **5b (not-summarized log):** record every NOT-summarized candidate — score-rejected (0–2), `already-covered` (with the existing post id/link), and `out-of-scope (evergreen — in-house)` — in the Phase 6 run report with one-line reasoning, so the rubric stays auditable and the same story isn't re-checked blindly next run. Do NOT file these as Asana cards (the bot's rejects are distinct from staff's "Not Interested" moves). Optionally maintain a single recurring "News Triage — Log" task in New Review if Andrew later wants the rejects visible in Asana; default is report-only.

**Phase 5.5 — Social card (DESTINATION = `INSTAGRAM` only).** Stories routed `INSTAGRAM` never become articles, so they never get a hero image from anywhere else — this is the one destination with no other source of art. Generate a card and attach it to the task:

```bash
bin/wetink-card/wetink-card.sh "<short social headline>" <beat> "<subject brief>" <task_gid>
```

One command: it generates the art, composites the card, attaches it to the task, and prints the file path. (`make-card.sh` and `attach-card.sh` are the two halves underneath — call them directly only when debugging.)

- `<beat>` is the story's Wet Ink category — `industry` (most law/platform news), `business`, `creators`, `features`, `galleries`, `side notes`. It sets the accent colour, and it should match the beat already recorded on the card.
- `<subject brief>` is what the collage should *show* — one concrete physical object or scene, in plain words ("a battered filing cabinet with records spilling out", "a domestic wifi router with hand-inked signal arcs"). Concrete objects work; abstractions do not.
- **Never brief a real person.** No likenesses, no recognisable faces — symbolic objects only. A fabricated photo of a named person is the one failure mode that costs the magazine credibility.
- The headline on the card is a **short social headline**, not the source outlet's headline and not the eventual article title — 4–8 words, the hook first.
- The card is a **draft for the editor**, same as everything else this desk files. Note it in the task as `Draft card — regenerate or replace as needed.`
- `ARTICLE` and `BOTH` stories are **out of scope here** — those get their art from `content-pipeline`/Canva when the piece is built, and the editorial-only boundary otherwise holds.

If `make-card.sh` fails (no Higgsfield credits, CLI missing, generation timeout), **file the task anyway without the card** and note the failure in the run report. The summary is the deliverable; the card is an addition, never a blocker.

**What happens after this desk hands off.** `bin/wetink-card/card_scheduler.py` (hourly, launchd) schedules approved cards to @wetinkmag through `social-scheduler`. It only picks up a task once it is **in the Approved section AND carries a `CAPTION:` block** in its notes. That second gate is why this desk must keep writing `For the post` as bullets rather than finished copy — an editor writes the `CAPTION:` line, and an approved card without one is reported and skipped, never posted. Do not write a `CAPTION:` line from this desk. See `bin/wetink-card/README.md`.

**Phase 6 — Run report.** Write `news-triage-<YYYY-MM-DD>.md` to `/Users/andrewnagle/Claude/Wet Ink Organic Social Posts/` summarizing: sources scanned, candidates found, scores, summaries filed, Asana task links, cards generated (or why not), not-summarized log (rejected / already-covered / out-of-scope with reasons), and anything needing manual attention.

---

## SOURCES (Phase 1)

### Step 1 — ALWAYS start with the RSS pull (one command)

```
bin/news-feeds.sh --days 2        # or --days 7 on a weekly run
```

Full path: `/Users/andrewnagle/Documents/wet-ink-ops/bin/news-feeds.sh`

Prints one TSV row per item — `DATE · SOURCE · TITLE · URL` — newest first, already filtered to the window. It pulls AVN (all articles + the dedicated legal feed), YNOT, and Google News queries covering XBIZ (which publishes no feed of its own), OnlyFans, Aylo/Pornhub, age verification, payments/debanking, platforms, and creator-labour. Run `--list` to see the exact feeds and queries.

**Why this is step 1 and not optional:** the dates in this output are publisher-supplied `<pubDate>` values, so the freshness filter is arithmetic rather than a model reading a date off an index page. Reading dates off HTML indexes produced repeated stale-news near-misses — four stale stories presented as current in the 2026-07-21 run, and a 2022 Visa ruling nearly filed as breaking news on 2026-07-16. **Prefer a feed date over any date inferred from page text.**

Two things the output demands of you:
- Rows marked **`(via GNews)`** carry a Google redirect URL, **not a citable article URL.** Resolve the canonical link (search the headline + outlet) before quoting or linking. Never invent a URL.
- The feed is a *lead list*, not a verdict. Court and legal candidates still require date-confirmation against the primary ruling or a dated outlet before drafting.

### Step 2 — sweeps and the wider net

Then run the keyword + breaking-news sweeps below to catch what the feeds miss. Prefer each outlet's news index / RSS; fall back to a site-scoped web search (`site:avn.com`, etc.) for the trailing window.

**Fetching blocked outlets:** `theguardian.com` and `freespeechcoalition.com` return 400/403 to the WebFetch user agent but **200 to a normal browser UA** — they are not blocking Wet Ink, they are blocking that UA. Fetch them with `curl -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36"` instead of giving up and crediting them second-hand. `courthousenews.com` returns 403 even with a browser UA — that one is a real block.

**Lesson from reverse-engineering @swceosociety (2026-06-25):** a US-adult-trade-only net misses most of the best stories. SWCEO's grid sourced from European investigative outlets, statehouse nonprofits, international independent press, SW-movement media, and mainstream business/tech press — none of which AVN/XBIZ/YNOT carry. Cast the wide net below every run.

| Tier | Outlets | What to pull |
|---|---|---|
| **Trade — primary** | AVN (avn.com), XBIZ (xbiz.com) | Business, legal/legislation, performer & studio news, awards. The backbone. |
| **Trade — secondary** | YNOT (ynot.com) and similar B2B adult outlets | Deeper trade/business angle, creator-economy commentary. |
| **Mainstream + business/tech** | Rolling Stone, NYT, Variety, The Guardian, **Forbes, The Information, CNBC, Bloomberg** | Crossover culture stories AND platform/AI/financial stories (e.g. Grok's adult-traffic story broke in Forbes/The Information, not the trades). |
| **Legal & policy trackers** | **Free Speech Coalition** (freespeechcoalition.com — the adult industry's own litigation/legislation tracker; THE source for every age-verification bill & suit), NetChoice, CCIA, NCOSE press releases, court dockets | Age-verification laws, bills, rulings, debanking. Most US legal stories surface here first. |
| **International & investigative** | **BIRN / Balkan Insight**, EUobserver, Euronews, Journalismfund, Daily Maverick, **Meduza** (Russia), regional statehouse nonprofits (Kansas Reflector / States Newsroom network) | Cross-border + US-state stories the US trades never run (Czechia OFM trafficking → BIRN; Russian creator prosecutions → Meduza; Kansas NCOSE dismissal → statehouse nonprofits). |
| **SW-rights movement media** | **TheColu.mn**, ESWA, and advocacy/NGO + political-party comms | Decriminalization, sex-work politics, international policy (e.g. Die Linke backing SW rights → TheColu.mn). |
| **Google Alerts** | Any RSS/alert feeds Andrew maintains | If an alerts feed URL is configured, fetch it; otherwise approximate with keyword searches from `rubric.md`. |
| **Competitor signal** | @swceosociety (SexWorkCEO Society) on IG/Threads, and similar industry-news accounts | Best-effort sense-check: competitors running a news desk surface the exact stories we should score. If they've posted a story, treat it as a strong newsworthiness signal and run it through the rubric. IG blocks scraping — check via browser (Chrome MCP) or a shared screenshot; this is a signal, not an automated feed. Never copy their framing — Wet Ink covers the same news with its own voice and angle. |

**Beat watchlist (track threads over time):** many stories are sequels — "second Russian creator detained," "final NCOSE suit dismissed." Keep a running list of live threads (Russia porn crackdown, US state age-verification litigation, OFM/trafficking prosecutions, debanking, Grok/X adult-content saga) and re-check each for developments every run, so follow-ons get caught as fast as competitors catch them.

### ⚠️ MANDATORY: run BOTH a keyword sweep AND a breaking-news sweep

Two different searches catch two different story types. Run **both** every time — skipping the second is how the pipeline misses the biggest story of the week.

1. **Keyword sweep** — searches built from the `rubric.md` clusters (OnlyFans how-to, platform comparison, creator finance, etc.). Catches evergreen/SEO-shaped stories. *This alone is NOT sufficient.*
2. **Breaking-news sweep** — generic + entity-based searches that contain NO product keywords, so they surface hard news a keyword search structurally cannot. Run all of these every time:
   - Generic: `"adult industry news this week"`, `"porn industry news <current month year>"`, `"sex work news <current month year>"`.
   - **Entity sweep** — search each major industry entity by name for fresh news: **Aylo / Pornhub / MindGeek**, **OnlyFans**, **Fansly**, **Chaturbate / Streamate**, **Visa / Mastercard adult**, plus the big studios and any performer currently in the news. A shooting, lawsuit, death, ban, or raid involving one of these is top-of-rubric news even when it shares zero words with a keyword cluster (e.g. the June 2026 Aylo HQ shooting — pure hard news, no SEO keyword in sight, would have scored 5 and was missed by a keyword-only run).
   - **Topic sweep** — search creator-welfare and structural-industry themes that name no single entity: **creator exploitation / OnlyFans management agencies (OFMs) / "chatters"**, **debanking / payment processors**, **trafficking & coercion investigations**, **deepfake & AI-content policy**, **age-verification enforcement**. A major mainstream investigation (e.g. the June 2026 Guardian + BBC exposé of exploitative OnlyFans managers — Guardian + BBC, top-tier, missed by an entity-only sweep) is exactly what this catches.
   - Any story where an industry entity OR its creators are the *target or subject* of violence, litigation, legislation, exploitation, or a major corporate event is **auto-newsworthy 3/3** — score it and draft it (or pitch it) even if SEO opportunity is low.
   - **User-supplied URLs** — if Andrew drops article links into the run, treat each as a pre-found candidate: fetch/score it like any other (run the already-covered check), and draft if it clears. URLs are a valid input, not a bypass of the rubric.

For each candidate capture: `headline`, `source`, `url` (canonical), `published_at`, `summary` (≤80 words). Drop paywalled stories you cannot read enough of to draft from. Drop anything already in the Phase 0 dedupe set (normalize URLs: strip query/UTM, lowercase host).

---

## ALREADY-COVERED CHECK (Phase 2.5) — wetinkmag.com

**Why this exists:** the Asana ledger (Phase 0) only knows what *this pipeline* has triaged. Wet Ink writers publish articles directly, off-pipeline. Without this gate, the pipeline will happily re-draft a story the magazine already ran — which is exactly what happened with the June 2026 Aylo/Pornhub shooting (already live as post **1305**, "Gunman Targeted Pornhub's Parent Company in Montreal, Killing Two," 2026-06-24) on the first test run. Run this gate on **every accepted (3+) candidate before drafting.**

### How to check

Use the helper script — it wraps the site's public REST search endpoint (the same source `content-pipeline` uses) and cache-busts every call:

```
bin/wetink-covered.sh "<TERM>" ["<TERM>" ...]
# e.g. bin/wetink-covered.sh "Aylo" "Montreal" "Pornhub"
```

Full path: `/Users/andrewnagle/Documents/wet-ink-ops/bin/wetink-covered.sh`

**Call it via the script, never as a raw inline `curl`.** The old inline form embedded both the search term and a `$(date +%s)` cache-buster in the command string, so every call was a byte-different command that could never match a stored permission rule — a guaranteed approval prompt per story, per run. The script path is stable and is allow-listed once.

For each accepted candidate:
1. Pick its **2–4 most distinctive terms** — proper-noun entities and the event, NOT generic words. For the Aylo story: `Aylo`, `Montreal`, `Pornhub` ✅ — not `shooting`, `porn`, `industry` ❌ (those return unrelated posts).
2. Run a search for each distinctive term (entities first; they're highest-signal). `Montreal` alone returned only post 1305; `Aylo` returned 1305 plus unrelated Pornhub-Awards posts.
3. **Judge whether a returned post is the SAME story, not merely the same topic.** A hit counts as already-covered only if BOTH:
   - **Distinctive overlap** — the post title/topic clearly concerns the same event/subject (e.g. a Montreal shooting at Pornhub's parent), not just a shared entity. "Pornhub Awards Returns" shares the word *Pornhub* with the shooting story but is plainly a different story → NOT a match.
   - **Date proximity** — the published post is dated within roughly ±10 days of the event (this is a news desk; near-simultaneous coverage of the same event is the dupe case). Example: a Wet Ink post on the Aylo shooting dated within days of June 22 is a match for an Aylo-shooting candidate.
4. If a same-story match is found → **drop the candidate from drafting**, record `already-covered: post <id> <link>`, and skip straight to logging it (Phase 5b, as `already-covered`). Do NOT create a Doc or an Inbox task for it.
5. If no match → proceed to draft. When genuinely uncertain (a plausible but not clear match), do NOT silently skip — draft it but add a `⚠ possible existing coverage: <link>` line to the Asana card so the editor can merge or kill. Missing a real story is worse than a flagged maybe-dupe.

### Belt-and-suspenders

Also fold the candidate's source URL and a normalized headline into the **Phase 0 Asana ledger** comparison — if a prior run already filed this exact story as a task, skip it the same way. The WP check (already *published*) and the Asana check (already *triaged*) are complementary; run both.

---

## SCORING (Phase 2)

Read `rubric.md` — it is the source of truth. This desk scores on **newsworthiness (0–3) + relevance/news-traction (0–3) → 0–5 band**, NOT on evergreen keyword-SEO. The two halves answer:

- **Newsworthiness & timeliness** — is this real, current news happening now? Platform deals/feature launches/policy changes, new laws & rulings, creator taxes, a notable performer's death/arrest/controversy rank high. Old, soft, or promo ranks low.
- **Relevance & news traction** — is it in one of the four beats (platform · law & money · people · industry-wide) AND already covered by **more than one outlet**? Multi-outlet pickup is the strongest single "cover this now" signal. Names a platform, a known star, or the industry.

**Scope filter (apply before scoring):** if a candidate is evergreen how-to / "X vs Y" comparison / glossary / pillar content with NO hard-news peg, it is OUT OF SCOPE — Wet Ink writes those in-house. Log it `out-of-scope (evergreen — in-house)`, do not draft it.

Only in-scope stories scoring **3+** are drafted. Record the two sub-scores and a one-line reasoning for every candidate — the rubric must stay auditable.

---

## SUMMARY SPEC (Phase 3)

The deliverable is a **rich, structured source summary** — a fast, accurate brief that gives an editor everything they need to decide whether (and how) to cover the story, then write it themselves. It is NOT a finished article and NOT a 350–650-word original draft. Think of the detailed summary you'd give a colleague: what happened, the key facts and quotes, the context, and how the outlets covering it line up. Accuracy and synthesis beat length.

**Multi-outlet synthesis is the core of the job.** A story that ≥2 outlets are covering must draw from ALL of them, not one. Read across the coverage, merge the facts, note where sources add different details or diverge, and link every one. Connecting the articles that mention the same story is a hard requirement, not a nicety — it's the whole reason this desk exists.

Write each summary with these labeled sections (skip a section only if the story genuinely has nothing for it):

- **Headline** — a clear, current news headline (`<h2>`). One keyword-forward variant is welcome but optional; do NOT contort it into evergreen keyword-SEO.
- **Topline** — 1–2 sentences: the core of the story (who, what, when). This is the "if you read nothing else" line.
- **What happened** — the key facts as a short bulleted list (use `<strong>` lead-ins or dashes; Asana allows no `<ul>`/`<li>`, so separate each point with a blank line and a leading `—`). Chronology or salience order. Attribute anything contested.
- **Key quotes** — the notable on-the-record quotes, each with speaker + who reported it (`"…" — Name, via XBIZ`). Quote sparingly and exactly; never fabricate or paraphrase inside quotation marks.
- **The bigger picture** — the context that makes it matter to the adult industry: the pattern it fits, the stakes, prior chapters of the story. Reported, not opinionated — save the take for the pitch.
- **Across the coverage** — one short block explicitly connecting the outlets: who reported it first, what each adds, where they disagree, and the links. This is where "connect other articles about the same story" lives. If only one outlet has it, say so (single-source = weaker signal, note it).
- **Wet Ink angle / pitch** — 1–2 sentences ONLY, in Wet Ink voice (invoke `wet-ink-voice`): the take/angle Wet Ink would bring that the wires won't have. This is the one place opinion and voice belong. Not a paragraph, not a draft — a pitch.

Guardrails:
- **Plain English (hard rule):** write the card so a busy editor gets it on one read. One idea per sentence; average ~15–20 words, hard cap ~30. Active voice, name the actor ("the DOJ nominated him," not "he was nominated"). Everyday words over insider or legal register — *say* "he wants prosecutors to charge porn sites," not "a federal prosecutorial theory aimed at distributors." Spell out any acronym or legal term on first use, in plain words, in the same sentence (`the Comstock Act — an 1873 law banning obscene material sent by mail`). No stacked subordinate clauses and no more than one em-dash aside per paragraph. This governs **every line the desk writes in its own words** — Topline, What happened, The bigger picture, Across the coverage, SEO angle, For the post, and the Wet Ink angle (voice, but still short and plain). It does NOT apply inside **Key quotes**: quotes stay exact, however they were phrased.
- **Plain ≠ vague.** Simplifying is a wording change, never a content change. Keep every attribution, hedge, date, number and caveat — if a sentence gets long, split it in two rather than dropping the qualifier. "Nothing has been charged and he has not been confirmed" is plain already; don't cut it to save words.
- **Attribution over invention:** attribute every fact ("as XBIZ reported," "according to the filing," "first reported by…"). Facts on a developing story are provisional — hedge where the reporting hedges, and never invent specifics (names, numbers, motive). If the story can't be confidently sourced (ideally to ≥2 outlets), file it as a thin summary flagged `single-source — needs verification`, not padded with guesses.
- **Length:** scale to the story — most summaries land ~150–350 words plus the bullets. A huge story can run longer; a simple one shorter. Don't pad to hit a number.
- **Sourcing/tone:** the summary body is neutral wire-style reporting. Dry Wet Ink wit belongs only in the one-line pitch, and never for deaths, violence, or arrests.
- **Status:** every card carries `Status: AI source summary — verify facts before publish; editor writes the article.`

The summary is **research for a human editor**, not publish-ready copy. Say so in the status line. For developing/sensitive stories, flag it explicitly.

---

## DELIVERY — embed-only (no Google Doc)

The summary + pitch goes **inside the Asana card** (`html_notes`), not a Google Doc. This is the default and the only supported path; do not create Drive files. (History: a Doc-based version existed but Drive's daily write quota is unreliable and the Doc added a click without adding value. If a Doc is ever wanted again, it's an explicit opt-in, not the default.)

---

## ASANA TASK (Phase 5a)

Create one task per accepted story via `create_tasks`:
- `project_id` = News Triage project · `section_id` = **New Review**
- `assignee` + `followers` per "Required IDs"
- `name` = the news headline (no prefix on the task itself)
- `html_notes` = the structured card:

```
SOURCE: <lead outlet — who reported it first / best>
OUTLETS COVERING: <every outlet on the story — multi-outlet pickup is why we're covering it>
LINK: <url(s)>
SCORE: <0–5>  (news <n>/3 · relevance <n>/3)
BEAT: <platform | law & money | people | industry>
DESTINATION: <ARTICLE | INSTAGRAM | BOTH>
Search demand: <PROVEN | LIKELY | WEAK | NONE> (<n>/3)
Social pull: <STRONG | WORKS | WEAK | NONE> (<n>/3)
Why (not) an article: <1–2 plain sentences — is anyone searching for this, and how do we know?>
Why (not) a social post: <1–2 plain sentences — does one fact carry it, or does it need setup?>
```

**Always lead with the word, never a bare number.** `2/3` reads as 67% — a mediocre grade — to anyone who hasn't read the rubric, when in fact 2 is a PASS: the cut line on both axes is between 1 and 2, so 2 or 3 = do it, 0 or 1 = don't. Writing `Search demand: LIKELY (2/3)` says that; writing `SEO 2/3` says the opposite of what it means.

The `DESTINATION` line comes from Phase 2.6 / the routing matrix in `rubric.md`. Where the SEO sub-score is 2–3, cite the Search Console evidence inline (e.g. `SEO 3/3 — 340 impressions / 12 clicks on age-verification queries, last 28d`); where it rests on cluster match alone, say that instead of implying data you didn't pull.

**Both `Why` lines are mandatory on every card, in whichever direction the verdict went** — an editor needs the "why not" more than the "why", because it's what stops them spending a day on a piece nobody will search for. Write them for someone who has never heard the phrase "query cluster": say "nobody is searching for this yet — it's news, people don't know it happened", not "no standing cluster". Keep the numbers, but always attached to what they mean. The translation table in `rubric.md` ("Explaining the verdict to the team") is the reference — follow it.

Then, in the SAME `html_notes`, embed the **source summary + pitch** below the card (this replaces the old draft embed). Use Asana-allowed tags only (`<h2>`, `<strong>`, `<em>`, `<hr/>`, `<a>`; separate paragraphs and bullet lines with blank lines — no `<p>`/`<br>`/`<ul>`/`<li>`, so write bullets as blank-line-separated lines each beginning with `—`):

```
<hr/><h2><news headline></h2><em>AI source summary — verify facts before publish; editor writes the article. Flag sensitivity if any.</em>

<strong>Topline:</strong> <1–2 sentences: who/what/when.>

<strong>What happened:</strong>

— <key fact 1>

— <key fact 2>

— <key fact 3…>

<strong>Key quotes:</strong>

— "<exact quote>" — <Speaker>, via <outlet>

<strong>The bigger picture:</strong> <context / stakes / prior chapters — reported, not opinion.>

<strong>Across the coverage:</strong> <who broke it, what each outlet adds, where they diverge — with links: <a href="url">Outlet</a>, <a href="url">Outlet</a>.>

<strong>Wet Ink angle:</strong> <1–2 sentences, Wet Ink voice — the take the wires won't have.>

<hr/><strong>Sources:</strong> <linked outlets>. — Auto-filed by news-triage; verify facts before publish.
```

Then append the block(s) matching the DESTINATION — one, both, or neither:

```
<strong>SEO angle:</strong> <the exact words people would type into Google that this piece should come up for, plus what the search data actually showed — e.g. "Wet Ink appeared 340 times for 'age verification' in the last 28 days and got 12 clicks, so people are looking and we're not winning them", or plainly "we have no search data of our own here — this is based on similar topics". Suggest a search-friendly headline ONLY if it isn't a contortion.>

<strong>For the post:</strong>

— <the hook: the single number, quote or fact the graphic leads with>

— <supporting fact 2>

— <supporting fact 3, in the order they should land>

<strong>Social discovery:</strong> <searchable terms or handles worth naming in the caption. SFW-safe on public channels.>
```

**`For the post` is bullets an editor writes from, not a finished caption.** Writing the actual post copy stays with `content-pipeline` — this desk hands over the facts and the hook, same as it hands over a summary rather than a finished article.

Escape `&` as `&amp;` and keep it well-formed (single `<body>` root). Every outlet named in OUTLETS COVERING should appear as a link in "Across the coverage" and/or Sources — the connective tissue between the articles is the point.

**Idempotency:** never create a task whose source URL or headline is already in the Phase 0 dedupe set. Search before creating.

---

## REQUIRED IDS (News-Triage-specific only)

- **News Triage project:** `1214626977185389` — sections (Andrew's 3-column workflow, updated 2026-06-25):
  - **New Review** `1214627031218530` — where THIS pipeline files every new drafted task. Always create here.
  - **Not Interested** `1214627002359292` — staff move a card here if it's not relevant. Reviewed weekly to learn what the rubric should stop surfacing. The pipeline never writes here.
  - **Approved** `1214626977182068` — staff pull a card here when they're taking it into their normal content timeline. The pipeline never writes here.
- **Default assignee:** Lina Lecaro `1215534312768275`
- **Default follower:** Holly Randall `1212147273860299`
- **Routing:** default every card to Lina (assignee) + Holly (follower). If a story clearly belongs to another writer by beat, assign them instead — but absent a beat→writer map, Lina is the default triage owner who reassigns.
- **Test assignee:** Andrew Nagle `1212156902878402` — use on any explicitly-labeled test run so staff aren't notified.

---

## NOTES

- **Cadence:** built to run on demand now; intended to become a daily (≤48h window) or weekly (≤7d window) scheduled routine. The window is the only thing that changes between cadences.
- **Why one task per story, capped at 3:** keeps writer load and token cost predictable, mirrors how content-pipeline processes one article per run.
- **Dedupe is two-layer:** (1) the News Triage project itself (any existing task across New Review / Not Interested / Approved counts as already-triaged), and (2) the wetinkmag.com WP REST already-published check (Phase 2.5). The WP layer is the durable one — it survives even if Asana cards are moved or cleared.
- **Failure rule:** if a story can't be summarized confidently from available sources (paywall, too thin, single weak source), file a short summary flagged `single-source — needs verification` (New Review task, no Doc) rather than padding it with guesses. Never invent facts, names, numbers, or motive to fill a summary; hedge exactly where the reporting hedges.

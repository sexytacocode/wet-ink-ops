---
name: news-triage
description: >
  Fast NEWS desk for Wet Ink Magazine. Monitors adult-industry trade press (AVN, XBIZ,
  YNOT) and mainstream/Google-Alerts crossover coverage for TIMELY, current stories in
  Wet Ink's beats — platform news (acquisitions, feature launches, policy changes), law
  & money (age-verification laws, bills, creator taxes, payment-processor moves), notable
  adult creators/performers in the news, and industry-wide stories the media is picking
  up — and turns them into a quick first draft so Wet Ink stays current and rides the news
  cycle. Scores each story on a newsworthiness + relevance rubric (multi-outlet pickup is
  the key signal), writes an original news draft in Wet Ink voice, and files an Asana task
  in the "Wet Ink — News Triage" project with the full draft embedded in the card (no
  Google Doc — embed-only is the default). This is the OUTBOUND-news counterpart to
  content-pipeline (which turns our OWN published articles into social). The desk's only
  output is the editorial draft → Asana; social graphics are explicitly out of scope for now
  (that stays with content-pipeline). It is NOT for evergreen, search-keyword content
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
- [ ] **Skills referenced** — `wet-ink-voice` (mandatory for every draft), optionally `social-post-optimizer` for the suggested social hook. Read them when invoked; do not restate their rules here.
- [ ] **Rubric** — read `rubric.md` in this skill folder before scoring. It holds the current SEO keyword clusters (distilled from the "Wet Ink SEO Audit — April 2026" Asana project) and the scoring bands.

---

## SOURCE-OF-TRUTH RULE

This skill does NOT restate the Wet Ink voice rules, the social caption rules, or any operational ID that belongs elsewhere. The only IDs that live here are the News-Triage-specific ones in "Required IDs" below. Voice rules live in `wet-ink-voice`; keyword clusters live in `rubric.md`.

---

## OVERVIEW — seven phases

**Phase 0 — Load Asana dedupe ledger (cheap).** Pull every existing task in the News Triage project (all sections) plus the Triage Log comments. Build the set of already-*triaged* source URLs and headlines so we don't re-file a story we already filed. Asana is the store of record for triage — there is no separate database.

**Phase 1 — Gather candidates (cheap, web).** Pull recent (≤48h, or ≤7d on a weekly run) headlines from the four source tiers. Collect for each: headline, source name, canonical URL, published time, one-paragraph summary.

**Phase 2 — Score & select.** Score every fresh candidate on the weighted rubric in `rubric.md`. Anything scoring **3+** is "accepted" and proceeds toward drafting; **0–2** is "rejected" and gets logged (Phase 5b), not drafted. On a normal run cap accepted stories at **3 per run** (highest score first) to keep token + writer load sane; note any overflow in the report.

**Phase 2.5 — Already-covered check (wetinkmag.com) — MANDATORY GATE.** Before any accepted story is drafted, query the live WordPress site to confirm Wet Ink has not already published an article on it. A story that passes the Asana ledger (never triaged) can still already exist as a published post — the two layers catch different things. See "ALREADY-COVERED CHECK" below. Already-covered stories are dropped from drafting and logged as `already-covered` (not as score-rejects).

**Phase 3 — Draft (one subagent per accepted story).** For each accepted story, write an ORIGINAL first-draft article in Wet Ink voice. This is a Wet Ink *take* — reported and rewritten, never a copy-paste of the source. See "Draft spec" below. Invoke `wet-ink-voice` inside each draft.

**Phase 4 — (removed.)** Drafts are embedded in the Asana card, not saved as Google Docs. Embed-only is the default (Andrew's call, 2026-06-25): simpler, self-contained, no Drive dependency (Drive's daily write quota bit a prior run). Skip Doc creation entirely.

**Phase 5 — File Asana tasks.**
- **5a (accepted):** one task per draft in News Triage → **New Review** section, assignee + follower per "Required IDs", with the structured card (source, outlets covering, link, score, beat, pitch, angle, reasoning) followed by the **full draft embedded in `html_notes`** (see "ASANA TASK" for the format). No Google Doc. Staff then move it to **Approved** (taking it into their content timeline) or **Not Interested** (rejected — reviewed weekly).
- **5b (not-drafted log):** record every NOT-drafted candidate — score-rejected (0–2), `already-covered` (with the existing post id/link), and `out-of-scope (evergreen — in-house)` — in the Phase 6 run report with one-line reasoning, so the rubric stays auditable and the same story isn't re-checked blindly next run. Do NOT file these as Asana cards (the bot's rejects are distinct from staff's "Not Interested" moves). Optionally maintain a single recurring "News Triage — Log" task in New Review if Andrew later wants the rejects visible in Asana; default is report-only.

**Phase 6 — Run report.** Write `news-triage-<YYYY-MM-DD>.md` to `/Users/andrewnagle/Claude/Wet Ink Organic Social Posts/` summarizing: sources scanned, candidates found, scores, drafts written, Asana task links, not-drafted log (rejected / already-covered / out-of-scope with reasons), and anything needing manual attention.

---

## SOURCES (Phase 1)

Scan all four tiers every run. Prefer each outlet's news index / RSS; fall back to a site-scoped web search (`site:avn.com`, etc.) for the trailing window.

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

The site is WordPress; use its public REST search endpoint (same source `content-pipeline` uses; cache-bust every call):

```
https://wetinkmag.com/wp-json/wp/v2/posts?search=<TERM>&per_page=5&_fields=id,date,link,title&_cb=$(date +%s)
```

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

## DRAFT SPEC (Phase 3)

This is a **news draft** — fast, current, publishable-soon coverage of an event, not an evergreen SEO article. Report the news in our own words, synthesize across the outlets covering it, link out, and add the Wet Ink angle. Speed and accuracy beat length.

Hard requirements:
- **Voice:** invoke `wet-ink-voice` and follow its checklist. Flowing prose, insider authority, ≤2 em dashes, a proper noun per paragraph. Dry wit only where the subject allows — drop it entirely for deaths, violence, arrests, or other grim news.
- **News shape:** lead with **what happened** (the actual news, not a "in a world where" windup), then **why it matters to the adult industry** — the Wet Ink angle the wires won't have. Keep it tight and current; this should read like it was written today because it was.
- **Originality / attribution:** never paste source sentences. Attribute facts ("as XBIZ reported," "according to the filing," "first reported by…") and list every source URL in a **Sources** line at the bottom. When ≥2 outlets cover it, synthesize — and note the multi-outlet pickup, it's why we're covering it.
- **Headline:** a clear, current news headline. One keyword-forward variant is welcome but optional — do NOT contort it into evergreen keyword-SEO. A short editorial H1 plus 1–3 subheads if the story needs them; subheads are optional for a short brief.
- **Length:** **350–650 words** for a standard news brief. Bigger stories can run longer, but default short and fast. If a story is really an evergreen feature/guide, it does NOT belong here (see scope filter) — note it for the in-house track instead.
- **Accuracy guardrails:** facts on a developing story are provisional — attribute, hedge where the reporting hedges, and never invent specifics (names, numbers, motive). If the story can't be confidently sourced (ideally to ≥2 outlets), file it as a pitch, not a drafted article.
- **Front matter** in the card header (the structured block, not a Doc): `Beat:` (platform / law & money / people / industry) · `Suggested slug:` · `Angle:` · `Outlets covering:` · `Status: First draft (AI) — needs editor review; verify facts before publish`.

The draft is a **fast first draft for a human editor to verify and finish**, not publish-ready. Say so in the status line. For developing/sensitive stories, flag it explicitly.

---

## DELIVERY — embed-only (no Google Doc)

The full draft goes **inside the Asana card** (`html_notes`), not a Google Doc. This is the default and the only supported path; do not create Drive files. (History: a Doc-based version existed but Drive's daily write quota is unreliable and the Doc added a click without adding value. If a Doc is ever wanted again, it's an explicit opt-in, not the default.)

---

## ASANA TASK (Phase 5a)

Create one task per accepted draft via `create_tasks`:
- `project_id` = News Triage project · `section_id` = **New Review**
- `assignee` + `followers` per "Required IDs"
- `name` = the news headline (no `[DRAFT]` prefix on the task itself)
- `html_notes` = the structured card:

```
SOURCE: <lead outlet>
OUTLETS COVERING: <list the outlets — multi-outlet pickup is why we're covering it>
LINK: <url(s)>
SCORE: <0–5>  (news <n>/3 · relevance <n>/3)
BEAT: <platform | law & money | people | industry>
PITCH: <one line — what happened>
ANGLE: <the Wet Ink take, 1–2 lines>
REASONING: <why it scored where it did>
```

Then, in the SAME `html_notes`, embed the **full draft** below the card (this replaces the old "DRAFT: <Doc link>" line). Use Asana-allowed tags only (`<h2>`, `<strong>`, `<em>`, `<hr/>`, `<a>`; separate paragraphs with blank lines — no `<p>`/`<br>`):

```
<hr/><h2><draft headline></h2><em>Fast news draft (AI). Verify facts before publish; editor review required. Flag sensitivity if any.</em>

<full draft body — lead with what happened, then "Why this matters for the industry">

<hr/><strong>Sources:</strong> <outlets>. — Auto-filed by news-triage; verify and finish before publish.
```

Escape `&` as `&amp;` and keep it well-formed (single `<body>` root). See the filed examples (Pornhub/Apple age-verification; OnlyFans manager racket) for the exact shape.

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
- **Failure rule:** if a draft can't be written confidently from available sources (paywall, too thin, single weak source), file the story as a *pitch* (New Review task, no Doc, status "needs research") instead of a fabricated draft. Never invent facts to fill a draft.

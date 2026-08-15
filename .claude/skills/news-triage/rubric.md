# News Triage Rubric

**What this pipeline is for:** a fast NEWS desk. It catches timely, current stories
in Wet Ink's world and turns them around quickly so the magazine stays relevant and
rides the news cycle. Speed and currency are the point.

**What this pipeline is NOT for:** evergreen, search-keyword articles — "how to start
an OnlyFans," "OnlyFans vs Fansly: which to choose," beginner guides, glossary/explainer
pieces, pillar pages. Wet Ink writes those in-house on its own schedule. If a candidate
is an evergreen how-to/comparison/guide with no hard news peg, it is OUT OF SCOPE — do
not draft it. (A keyword topic that suddenly has a NEWS peg — e.g. a new tax bill for
creators — is in scope as news.)

Last synced: 2026-06-25.

---

## The beats (in scope)

A candidate is in scope only if it's a current news event in one of these:

1. **Platform** — acquisitions, funding/valuation, ownership/leadership changes, new
   feature launches, ToS / payout / verification / policy changes, bans, outages,
   shutdowns. (OnlyFans, Pornhub/Aylo, Fansly, Chaturbate, Streamate, etc.)
2. **Law, regulation & money** — age-verification laws and enforcement (e.g. UK / Apple
   / US state laws affecting adult sites), bills and legislation, court rulings,
   taxes for adult creators, payment-processor & banking moves (Visa/Mastercard,
   debanking).
3. **People** — anything involving a named, notable adult creator / OnlyFans / Pornhub
   star: launches, controversies, lawsuits, deaths, arrests, mainstream-media crossover,
   major career moves, milestones.
4. **Industry-wide** — trends, data, or events affecting the industry as a whole that
   mainstream or trade media is actively covering.

---

## Scoring model

Two axes, each 0–3. Final band = `round((newsworthiness + relevance) / 6 * 5)` → 0–5.
**3+ = ACCEPT (draft fast). 0–2 = REJECT (log, don't draft).**

### Newsworthiness & timeliness (0–3)
- **3** — Breaking/major and current: a platform sold or changed a major policy, a new
  law or ruling, a notable performer's death/arrest/big controversy. Happening now.
- **2** — Solid current news: a feature launch, a notable creator's launch/milestone, a
  meaningful bill moving, a smaller-but-real platform change.
- **1** — Marginal/soft or not very fresh; minor update.
- **0** — Not news (evergreen explainer, old, or pure promo).

### Relevance & news traction (0–3)
- **3** — Squarely in a beat above AND already covered by **more than one outlet**
  (trade + mainstream, or several outlets) — corroborated and clearly resonating.
  Names a platform, a known star, or the industry as a whole.
- **2** — In a beat and covered by at least one credible outlet; clearly relevant to
  Wet Ink's audience.
- **1** — Tangential to the beats or thinly sourced (single low-credibility outlet).
- **0** — Not relevant to Wet Ink's audience, or unverifiable.

### Fast acceptance heuristic
If a story (a) is in one of the four beats, (b) names a platform / a known adult star /
the industry, and (c) has been picked up by **two or more outlets**, it is almost always
a 3+ — accept and draft it fast. Multi-outlet pickup is the strongest single signal that
something is worth covering now.

A hard-news 3/3 with lower relevance can still clear 3 — when a big industry entity is the
target/subject of violence, litigation, a major deal, or new law, accept it.

---

## DESTINATION routing (Phase 2.6) — run only on ACCEPTED (3+) stories

The accept score answers *is this worth covering*. It does not answer *what should it
become*. Some stories are for readers to read; others exist to be found in search and
pull new people to the site. Those are different jobs, and a story can do one, both, or
neither. Score two more axes — they never change accept/reject, they only route.

### Search demand / SEO value (0–3)

**The trap:** most hard news scores LOW here, and that's correct. Nobody is googling a
thing they don't yet know happened. SEO value in news comes from one of two places —
the story either attaches to a **standing query** people search continuously, or it
creates a **durable query** that will still be searched next month. A story with neither
can be big news and still be worth 0 for search.

- **3 · PROVEN** — Attaches to a live keyword cluster in this file AND Search Console shows
  Wet Ink already getting impressions on related queries. Proven, measurable demand.
- **2 · LIKELY** — Clearly maps to a standing cluster (age verification, creator taxes,
  platform comparison, payouts) or creates an obviously durable query — "is [platform]
  shutting down", "what is the [X] law" — but no Search Console corroboration yet.
- **1 · WEAK** — Thin/short-lived search interest; a spike that dies in a week.
- **0 · NONE** — No query behind it. Trade-only inside baseball, awards, appointments.

**Verification (Search Console).** For each accepted story, check real data before
assigning 2 or 3 — use `mcp__search-console__get_search_analytics` on wetinkmag.com,
last 28 days, filtering queries by the story's core term (e.g. `age verification`,
`OnlyFans tax`). Impressions with few clicks = strong opportunity (we surface but don't
win). Zero impressions = we have no foothold; score on cluster match alone and say so.
Record the actual numbers on the card — "SEO 3/3" with no evidence behind it is a guess,
and guesses are what this axis exists to replace.

### Social pull (0–3)

- **3 · STRONG** — One striking fact, number, quote, or image carries the whole story.
  Tellable in a headline plus a graphic. Provokes a reaction — money, injustice, drama, a
  name people know.
- **2 · WORKS** — Interesting but needs a sentence or two of setup to land.
- **1 · WEAK** — Needs real context; hard to compress without distorting it.
- **0 · NONE** — Procedural, technical, or too grim/legally delicate to post.

**Reading the scores — 2 is a PASS, not a mediocre grade.** These are four named bands, not
a mark out of three, and the cut line sits between 1 and 2 on both axes: **2 or 3 = do it,
0 or 1 = don't.** A 2 is a yes. Because `2/3` looks like 67% to anyone who hasn't read this
file, **never put a bare score on a card** — always lead with the word and put the number in
brackets after it: `Search demand: LIKELY (2/3)`, `Social pull: STRONG (3/3)`.

### The routing matrix

| | **Social 2–3** | **Social 0–1** |
|---|---|---|
| **SEO 2–3** | **BOTH** — article is the asset; the post drives traffic to it | **ARTICLE** — a search play. May get no social traction; that's fine, it's not the point |
| **SEO 0–1** | **INSTAGRAM** — post it, don't write it. Real reader interest, no search demand behind it | **NEITHER** — file the summary as a watchlist note; don't commission work |

Put the verdict on the card as a **`DESTINATION:`** line with both sub-scores. Ambiguity
is allowed and useful — "Instagram now, Article if the ruling lands" is a legitimate
destination.

### Explaining the verdict to the team (mandatory, plain English)

The scores are for auditing the desk. They do **not** explain anything to the editor
reading the card. Every card must also carry two short plain-English lines — one for each
half of the verdict, written for someone who has never heard the words "query cluster":

```
Why an article / Why not an article: <1–2 plain sentences>
Why a social post / Why not a social post: <1–2 plain sentences>
```

Both lines appear on every card, whichever way the verdict went — "why not" is the more
useful half, because it stops an editor spending a day on a piece nobody will find.

**Say the reason, not the score.** The score is the conclusion; the line is the reason a
person can check. Translate the machinery:

| Don't write | Write |
|---|---|
| "no standing query cluster" | "nobody is searching for this — it's news, people don't know it happened yet" |
| "cluster-creation play" | "nobody searches this today, but they will once it lands. If we publish first we own that search" |
| "cluster match only, no impressions" | "we're going on similar topics — we have no search data of our own on this yet" |
| "SEO 3/3, 340 impressions" | "people already search this: Wet Ink showed up 340 times for 'age verification' in the last 28 days and only got 12 clicks, so the demand is there and we're not winning it" |
| "high social pull" | "one number does the whole job here, so it works as a graphic with no setup" |
| "low social pull, procedural" | "you'd need three sentences of background before it makes sense, which doesn't work on a feed" |

Numbers stay in — an editor should be able to see the evidence — but a number always
arrives attached to what it means, never on its own.

### What the card carries for each destination

The desk still does **not** write finished copy — editors write from the summary, same as
always. What changes is which bullets it hands them.

- **ARTICLE / BOTH** — the standard source summary, plus an **`SEO angle`** line: the
  specific query the piece should target and the Search Console evidence for it. If a
  keyword-shaped headline exists that isn't a contortion, suggest it.
- **INSTAGRAM / BOTH** — add a short **`For the post`** block: the 2–4 facts that would
  carry a text-in-image post, in the order they should land, plus the single number or
  quote that is the hook. Bullets an editor can write from, **not** finished caption copy
  — writing the actual post stays with `content-pipeline`. Add a **`Social discovery`**
  note where it's useful: the searchable terms or account handles worth naming in the
  caption. Keep SFW-safe on public channels per the existing hashtag rules.
- **NEITHER** — one line in the run report. No card.

---

## Out of scope (do NOT draft here — in-house editorial track)
- Evergreen how-to / beginner guides ("how to start an OnlyFans," camming guides).
- "X vs Y: which should you choose" comparison/buyer's-guide pieces.
- Glossary / kink explainers, pillar pages, financial-literacy guides.
- Generic listicles and SEO keyword pages with no news peg.

If a candidate is one of these AND has no hard-news peg, log it as `out-of-scope
(evergreen — in-house)` and move on. Optionally note strong evergreen ideas in the run
report so the editorial team can pick them up manually, but never draft them here.

## Audience-relevance reference (signal only, NOT drafting targets)
Topics Wet Ink's readers care about — useful for judging the relevance axis, NOT for
keyword targeting: platform economics & policy, sex-work law and age verification,
creator banking/taxes/debanking, notable performers, industry business moves, and the
culture/politics around adult work. A news story touching these scores higher on relevance.

## Hard lines (never draft)
- Anything involving minors or implying minors — instant reject, do not log salaciously.
- Non-consensual content, leaks, doxxing, revenge material — reject.
- Unverified rumor presented as fact — if it can't be sourced to a credible outlet (ideally
  more than one), file as a pitch, never a drafted article.

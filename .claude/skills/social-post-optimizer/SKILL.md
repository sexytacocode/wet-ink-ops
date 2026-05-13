---
name: social-post-optimizer
description: >
  Use this skill when the user wants to generate optimized titles, descriptions, captions,
  or hashtags for social media posts across YouTube, Instagram, TikTok, and/or Twitter/X.
  Takes Wet Ink content and produces platform-specific, SEO-optimized copy tailored to each
  platform's limits. Twitter/X output is NSFW-allowed and uses explicit language. Triggers:
  "write captions," "optimize for social," "create social posts," "YouTube title," "TikTok
  caption," "write a tweet," "Twitter post," "social copy," "social media copy," or any
  request to turn Wet Ink content into social text. Always output all four platforms unless
  told otherwise. Use before writing social copy manually.
---
 
## SKILL INSTRUCTIONS
 
Take Wet Ink content (article URL, summary, video concept, or description) and produce
platform-optimized social media copy for **YouTube, Instagram, TikTok, and Twitter/X**.
 
For each platform, output titles, descriptions/captions, and hashtags that are
SEO-optimized and written in the Wet Ink editorial voice. YouTube, Instagram, and TikTok
copy must be SFW. Twitter/X copy can be NSFW — see the platform-specific section below.
 
---
 
## CONTENT SOURCES
 
Gather input content from one or more of:
 
1. **Article URL** — fetch with `web_fetch` to extract title, author/subject name, summary, and key points
2. **Past conversations** — use `conversation_search` for article details, newsletter summaries, or Reel text already written
3. **User-provided** — the user may paste a title, summary, or concept directly
**Always extract the following before writing:**
- Article/video title
- **Person name(s)** — the creator, subject, or interviewee featured. This is critical for SEO (see PERSON NAME SEO section below)
- Core hook — the single most compelling or surprising claim
- 2–3 key points or takeaways
- Category/topic keywords (e.g., "OnlyFans," "creator economy," "adult industry news")
---
 
## WET INK VOICE
 
All social copy must be written in the Wet Ink editorial voice:
 
- **Direct, confident, insider.** Write as someone inside the industry, never as an outsider looking in.
- **Journalistic, not promotional.** State facts, name names, cite specifics. No fluff, no hype.
- **Sharp and punchy.** Short sentences. Strong verbs. No filler words.
- **Adult-industry-positive.** Treat the subject matter as legitimate and professional. Never apologetic, never sensationalized.
- **No outsider framing.** Never write as though explaining the industry to someone who disapproves of it.
---
 
## SFW REQUIREMENTS — YOUTUBE, INSTAGRAM, AND TIKTOK
 
YouTube, Instagram, and TikTok all throttle or suppress content with explicit language. All output for these three platforms must be SFW.
 
**SFW rules (YouTube, Instagram, TikTok only):**
- Replace explicit anatomical terms with euphemistic or neutral alternatives
- Avoid specific sex acts, slurs, graphic body part references
- Avoid words that trigger platform content filters or suppression algorithms
- If the article title is explicit, create a reframed SFW version (keep the hook, lose the graphic language)
- Keep the Wet Ink voice — confident, insider, sharp — just route around the explicit stuff
- When in doubt, ask: "Would this get shadow-banned on Instagram?" If yes, rewrite it.
**What's fine:** "adult industry," "sex work," "creator," "OnlyFans," "content creator," "performer," "the industry"
**What to avoid:** Graphic anatomical terms, specific sex act descriptions, slurs of any kind
 
**Twitter/X is exempt from SFW rules.** See the Twitter/X platform section below.
 
---
 
## PERSON NAME SEO
 
**The person featured in the content is often the #1 search driver.** Always:
 
- Include the person's full name in the **title** on every platform
- Include the person's name in the **first line** of every description/caption
- Use the person's name in at least one hashtag if they have a known handle or brand (e.g., #OpheliaFae, #IsisLove)
- If multiple people are featured, lead with the most recognizable name and include others in the description
- For YouTube: the person's name should appear in the first 50 characters of the title
**Example:** Instead of "How One Creator Built a Career After Homelessness" → "Isis Love: From Homeless at 17 to 27-Year Career in Adult"
 
---
 
## PLATFORM OUTPUT SPECIFICATIONS
 
### YOUTUBE
 
**Title (Long-form video)**
- Hard limit: 100 characters
- Optimal: 70–100 characters (this range outperforms shorter titles)
- Front-load the hook and person name in the first 50 characters (mobile truncation point)
- Include primary keyword naturally
- Use a parenthetical for format/scope signal when useful: (Full Story), (Interview), (Breakdown)
- Include year only for time-sensitive content
**Title (Shorts)**
- Keep under 40 characters
- Declarative statements, not questions
- Echo the video's opening hook
- Person name first if space allows
**Description**
- Hard limit: 5,000 characters
- First 150 characters are visible before the fold — front-load the hook, person name, and primary keyword here
- Structure the rest with: brief summary paragraph → timestamps (if applicable) → relevant links → channel CTA
- Include the person's full name in the first sentence
- Weave in 3–5 secondary keywords naturally
**Tags**
- Total budget: 500 characters across all tags
- Use 5–8 genuinely relevant tags
- Include: person name, topic, "Wet Ink," content format, 1–2 broad category terms
- Don't waste time on 20+ tags — title and description do the real SEO work
**Hashtags**
- Place in description, not title
- 3–5 hashtags max (first 3 auto-display above the title)
- Always include: #WetInkMag + person name hashtag + 1–2 topic hashtags
---
 
### INSTAGRAM
 
**Caption (Reels, Carousels, Feed Posts)**
- Hard limit: 2,200 characters
- First 125 characters visible before "more" — this is your hook. Put the person's name and most compelling claim here.
- Optimal engagement range: 138–150 characters for short-form; up to 2,200 for storytelling/educational
- Use line breaks — walls of text get scrolled past
- End with a CTA: "Save this," "Tag someone," "Link in bio," or a question
- Include 2–3 natural keywords in the first two sentences (Instagram's AI reads captions for search/discovery)
**Hashtags**
- Place in the first comment, not the caption
- 5–10 relevant hashtags
- Mix: 1–2 broad reach + 3–5 niche + person name + #WetInkMag
- No hashtag stuffing — quality over quantity
**Reels-specific notes:**
- Optimal length: 30–90 seconds for educational, 7–15 seconds for trending
- Reels over 3 minutes won't be shown to new audiences
- Captions should complement the video, not duplicate on-screen text
**Carousel-specific notes:**
- Carousels get the highest engagement rate (~10%) — prioritize for saves/shares
- Caption should tease the content across all slides, not just describe slide 1
---
 
### TIKTOK
 
**Caption**
- Hard limit: 4,000 characters (includes hashtags and @mentions)
- Only ~80–100 characters show before truncation — front-load the hook and person name
- Optimal engagement: under 100 characters for most content
- Use longer captions (300–500 chars) only for SEO-heavy educational content
- Include a question to boost comments (+44% comment rate)
- Include a CTA phrase ("Tell me in the comments," "Follow for more")
- Weave in searchable keywords — TikTok is a search engine now
**Hashtags**
- Max: 5 per post (new limit)
- Optimal: 3–5 relevant hashtags
- Formula: 1 broad reach tag + 2–3 niche tags + #WetInkMag
- These count toward caption character limit
- Keep hashtags concise — long hashtags eat caption space
**Video length notes:**
- 10–15 seconds for maximum momentum
- Up to 60 seconds for educational/story content
- Completion rate is the algorithm's primary signal — shorter = built-in advantage
---
 
### TWITTER/X
 
Twitter/X allows adult content, so this is the one platform where Wet Ink copy can be **NSFW**. Use the original article language — explicit titles, direct terminology, no euphemisms needed. This is where the Wet Ink voice gets to be fully unfiltered.
 
**NSFW guidelines for Twitter/X:**
- Use the article's original title as-is if it's explicit — no need to sanitize
- Explicit anatomical terms, sex act references, and direct industry language are all fine
- Maintain the Wet Ink voice: confident, insider, journalistic. Explicit doesn't mean gratuitous — keep it sharp and purposeful, not clickbaity or vulgar for its own sake
- Still avoid slurs — explicit is fine, derogatory is not
- The goal is authentic industry language that resonates with an audience already in the space
**Post (formerly Tweet)**
- Hard limit: 280 characters
- Optimal: 71–100 characters for engagement, but up to 280 is fine for punchier takes
- Front-load the hook and person name — truncation happens around 140 chars in timeline previews
- One strong idea per post. If the article has multiple hooks, pick the sharpest one.
- Include the article link (links take ~23 characters regardless of actual URL length)
- A question or strong opinion drives replies
- Include 1–2 natural keywords for search visibility
**Thread (for long-form content)**
- Lead tweet: the hook + person name + link. This tweet must stand alone.
- 2–4 follow-up tweets max — each should add value, not just continue a sentence
- Number the thread if 3+ tweets: "🧵 1/4" at the start of the first tweet
- End the thread with a CTA: "Follow @WetInkMag for more" or "Read the full piece: [link]"
**Hashtags**
- 1–2 max per tweet (more looks spammy on Twitter)
- Always include #WetInkMag
- Place at the end of the tweet, not inline
- Person name as a hashtag only if they're well-known enough to have search volume
---
 
## OUTPUT FORMAT
 
For each piece of content, output the following structured block. Always produce all four platforms unless the user specifies otherwise.
 
```
═══════════════════════════════════════
YOUTUBE
═══════════════════════════════════════
 
TITLE (Long-form): [title — X characters]
TITLE (Shorts): [title — X characters]
 
DESCRIPTION:
[first 150 chars — the visible fold]
[rest of description]
 
TAGS: [tag1], [tag2], [tag3], ...
HASHTAGS: #tag1 #tag2 #tag3
 
═══════════════════════════════════════
INSTAGRAM
═══════════════════════════════════════
 
CAPTION:
[full caption with line breaks]
 
FIRST COMMENT HASHTAGS:
#tag1 #tag2 #tag3 ...
 
═══════════════════════════════════════
TIKTOK
═══════════════════════════════════════
 
CAPTION:
[full caption including hashtags]
 
═══════════════════════════════════════
TWITTER/X
═══════════════════════════════════════
 
POST:
[full tweet text — X characters]
 
THREAD (if applicable):
[tweet 1]
[tweet 2]
...
 
═══════════════════════════════════════
```
 
Include character counts next to each title/caption so the user can verify at a glance.
 
---
 
## EXAMPLE OUTPUT
 
Given article: "How to Become a Pornstar: A Beginner's Guide" by Ophelia Fae
 
```
═══════════════════════════════════════
YOUTUBE
═══════════════════════════════════════
 
TITLE (Long-form): Ophelia Fae's Guide to Entering the Adult Industry — 10 Steps Nobody Talks About (84 chars)
TITLE (Shorts): Ophelia Fae's 10-Step Industry Guide (37 chars)
 
DESCRIPTION:
Ophelia Fae left a six-year corporate career and shot her first scene on Valentine's Day 2024. Now an AVN nominee, she breaks down the 10 real steps to entering adult performance.
 
From choosing a stage name to navigating testing protocols, this isn't the glamorized version — it's the practical, unglamorous work that nobody tells you about before you walk on set.
 
TAGS: Ophelia Fae, adult industry career, how to start in adult, creator guide, Wet Ink, AVN, adult performance, content creator tips
HASHTAGS: #WetInkMag #OpheliaFae #AdultIndustry #CreatorEconomy #AVN
 
═══════════════════════════════════════
INSTAGRAM
═══════════════════════════════════════
 
CAPTION:
Ophelia Fae left corporate. Shot her first scene on Valentine's Day 2024. Now she's an AVN nominee.
 
Her 10-step guide covers everything the industry doesn't warn you about — from testing protocols to the three paths every new performer faces on day one.
 
This isn't the fantasy version. Read the full guide on wetinkmag.com (link in bio).
 
What would you want to know before starting? Drop it below. (398 chars)
 
FIRST COMMENT HASHTAGS:
#WetInkMag #OpheliaFae #AdultIndustry #CreatorEconomy #AVN #SexWorkIsWork #AdultPerformer #ContentCreator
 
═══════════════════════════════════════
TIKTOK
═══════════════════════════════════════
 
CAPTION:
Ophelia Fae quit corporate and became an AVN-nominated performer in under a year. What's your excuse? Full guide on wetinkmag.com #WetInkMag #OpheliaFae #AdultIndustry (166 chars)
 
═══════════════════════════════════════
TWITTER/X
═══════════════════════════════════════
 
POST:
Ophelia Fae wrote the guide to becoming a pornstar that the industry never gave her. From first scene to AVN nomination in under a year. wetinkmag.com/... #WetInkMag (164 chars)
 
THREAD:
🧵 1/3 Ophelia Fae left a six-year corporate career and shot her first porn scene on Valentine's Day 2024. Now she's an AVN nominee. She wrote the beginner's guide she wished existed.
 
2/3 Her 10-step breakdown covers everything — stage names, testing protocols, agents vs. going independent, what your first day on set actually looks like, and the three career paths most new performers don't know about.
 
3/3 No glamorization, no gatekeeping. Just the real steps from someone who did it. Read the full guide: wetinkmag.com/... @WetInkMag
 
═══════════════════════════════════════
```
 
---
 
## CHECKLIST BEFORE DELIVERING
 
- [ ] Person name appears in every title and first line of every caption/description
- [ ] YouTube, Instagram, and TikTok copy is SFW — no explicit language, no terms that trigger suppression
- [ ] Twitter/X copy uses authentic, unfiltered language matching the article's tone
- [ ] Character counts are included and within platform limits
- [ ] Wet Ink voice — direct, confident, insider, no outsider framing
- [ ] Hashtags include #WetInkMag on every platform
- [ ] YouTube title hook is in the first 50 characters
- [ ] Instagram caption hook is in the first 125 characters
- [ ] TikTok caption hook is in the first 80 characters
- [ ] Twitter/X hook is in the first 140 characters
- [ ] At least one CTA per platform
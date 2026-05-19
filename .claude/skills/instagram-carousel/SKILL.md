---
name: instagram-carousel
description: >
  Use this skill when the user wants to create Instagram carousel posts from Wet Ink magazine
  articles. This covers the full workflow: finding article content, duplicating the Canva carousel
  template, uploading article images, and swapping text and images across all slides. Triggers
  include: "create an Instagram post," "make a carousel," "Instagram carousel from article,"
  "social media post for [article name]," "create posts from my articles," or any request
  involving turning Wet Ink articles into Instagram content. Use this skill even if the user
  only mentions one article or asks about social content generally — the skill covers the
  complete carousel creation pipeline. Always use this skill before attempting to build
  Instagram carousels manually or using generate-design from scratch.
---

## ⚠️ PRE-FLIGHT CHECKLIST — READ BEFORE DOING ANYTHING

Before writing a single line of copy or making any API call, confirm all of the following:

- [ ] **All carousel text must be SFW** — Instagram throttles posts with explicit language. Draft SFW from the start.
- [ ] **Correct template** — Use `DAHHrgpO6aE`. Do not create carousels from scratch or use any other template.
- [ ] **Move to folder after each commit** — Every completed carousel must be moved to `FAHILIV3D2w` using `Canva:move-item-to-folder`. This is not optional.
- [ ] **Load `Canva:move-item-to-folder`** via `tool_search` before starting — it is a deferred tool.
- [ ] **Create Asana task after carousel is done** — one task per carousel, assigned to Natasha, in "To Edit" section. Include Canva edit link. Add Holly as a contributor.
- [ ] **Use the correct Canva URL format** — When sharing or storing a link to the new design, always construct it as `https://www.canva.com/design/{design_id}/edit` using `design.id` from the `merge-designs` response. Do NOT pass on the `urls.edit_url` field (the `https://www.canva.com/d/...` shortlink) — those open a different design and break the workflow for Natasha.

If any of the above is unclear, re-read the full skill before proceeding.

---

## SKILL INSTRUCTIONS

Create Instagram carousel posts from Wet Ink articles by duplicating an on-brand Canva template and swapping in article-specific content.

---

## SFW GUIDELINES

All carousels are published on Instagram, which throttles posts with explicit sexual language. Write SFW from the start — there is no uncensored carousel version.

- Replace explicit anatomical terms with euphemistic alternatives
- Avoid specific sex acts, slurs, graphic body part references
- Keep the Wet Ink voice — confident, insider, sharp — just route around the explicit stuff
- If the article title is explicit, create a shortened/reframed cover title for the carousel

For non-explicit articles, SFW is a non-issue — just write naturally in the Wet Ink voice.

---

## REQUIRED CANVA IDS

- **Carousel template design:** `DAHHrgpO6aE` ("Copy of Carousel How to Regain Momentum and Reconnect with Your Audience")
- **Wet Ink brand kit:** `kAG8J_AhIkQ`
- **Template structure:** 4 pages at 1080×1350 (Instagram portrait)
- **Shared carousels folder:** `FAHILIV3D2w` ("Wet Ink - Instagram Carousels")

---

## REQUIRED ASANA IDS

- **Social media project:** `1214264767251100` ("Wet Ink Social Media")
- **"To Edit" section:** `1214264977347926`
- **"Edited" section:** `1214265071278910`
- **"Published" section:** `1214265072303679`
- **Natasha (assignee):** `1213652591985519`
- **Holly Randall (contributor):** `1212147273860299`

---

## ARTICLE CONTENT SOURCES

Article content for Wet Ink comes from two places:

1. **Past conversations** — Search conversation history using `conversation_search` for the article title, author, or topic. Look for: article title, summary text, bullet points, hero image URL (usually a Klaviyo CDN URL starting with `https://d3k81ch9hvuctc.cloudfront.net/company/SsnjrB/images/`).

2. **User-provided** — The user may provide the article URL, title, summary, and/or image URL directly.

If the article URL is provided, fetch it with `web_fetch` to extract content. If the image URL is not available, ask the user to provide one.

---

## WORKFLOW

### Step 1: Gather Article Content

Collect the following for the target article:
- **Title** (used on slide 1)
- **Hook/opening** (1-2 sentences for slide 2 — the most compelling opening detail)
- **Summary/key point** (1-2 sentences for slide 3 — the article's core argument or payoff)
- **Hero image URL** (used on slides 1 and 4)

Use `conversation_search` to find article details from the Issue #5 newsletter build or other past conversations. The newsletter-content skill workflow produces summaries and bullets that work well as carousel text.

### Step 2: Load Canva Tools

Search for and load the following Canva tools (they are deferred and must be loaded via `tool_search`):
- `Canva:merge-designs` — to duplicate the template
- `Canva:upload-asset-from-url` — to upload the article image
- `Canva:start-editing-transaction` — to open editing session
- `Canva:perform-editing-operations` — to swap text and images
- `Canva:commit-editing-transaction` — to save changes
- `Canva:get-design-thumbnail` — to preview slides
- `Canva:move-item-to-folder` — to move each completed design to the shared folder
- `Asana:create_tasks` — to create editing tasks for Holly (load via `tool_search` query "create tasks")

**Important:** Load these tools early in the conversation before they cycle out of context.

### Step 3: Upload Article Image

```
Canva:upload-asset-from-url
  name: "[Article Title] Image"
  url: [hero image URL]
```

Save the returned `asset_id` — you'll need it for image swaps.

### Step 4: Duplicate the Template

```
Canva:merge-designs
  type: "create_new_design"
  title: "[Article Title] - Instagram Carousel"
  operations: [{
    type: "insert_pages",
    source: { type: "design", design_id: "DAHHrgpO6aE" }
  }]
```

Save the returned `design_id` for the new design.

### Step 5: Edit the New Design

Start an editing transaction on the new design:

```
Canva:start-editing-transaction
  design_id: [new design ID]
```

The template has this element structure (element IDs are consistent across copies):

| Page | Element ID | Content Type | Replace With |
|------|-----------|--------------|--------------|
| 1 | Title text element | TEXT | Article title |
| 1 | Hero image element | IMAGE (editable) | Article image |
| 2 | Body text element | TEXT | Hook/opening text |
| 3 | Body text element | TEXT | Summary/key point text |
| 4 | Background image element | IMAGE (editable) | Article image |
| 4 | CTA text | TEXT | Keep as-is ("read the full article on" / "WETINKMAG.COM") |

**Important notes on element IDs:**
- Element IDs change with each duplicate. Read them from the `start-editing-transaction` response.
- The editable image elements are the ones with `"editable": true` in the fills array.
- Page 1 has one editable image (the hero/background). Pages 2-3 have no editable images (background gradient only). Page 4 has one editable image.
- The ">" arrow elements on each page should be left unchanged.

Perform all edits in a single `perform-editing-operations` call:

```
Canva:perform-editing-operations
  operations: [
    { type: "update_title", title: "[Article Title] - Instagram Carousel" },
    { type: "replace_text", element_id: "[page 1 title element]", text: "[Article Title]" },
    { type: "update_fill", element_id: "[page 1 editable image]", asset_type: "image", asset_id: "[uploaded asset ID]", alt_text: "[description]" },
    { type: "replace_text", element_id: "[page 2 body text]", text: "[Hook/opening]" },
    { type: "replace_text", element_id: "[page 3 body text]", text: "[Summary/key point]" },
    { type: "update_fill", element_id: "[page 4 editable image]", asset_type: "image", asset_id: "[uploaded asset ID]", alt_text: "[description]" }
  ]
```

### Step 6: Preview and Save

After editing, get thumbnails for all 4 pages using `get-design-thumbnail` and show them to the user. Then commit:

```
Canva:commit-editing-transaction
  transaction_id: [transaction ID]
```

Then immediately move to the shared folder:

```
Canva:move-item-to-folder
  item_id: [design ID]
  to_folder_id: "FAHILIV3D2w"
```

Provide the user with the Canva edit URL constructed as `https://www.canva.com/design/{design_id}/edit` using the `design.id` returned by `merge-designs` (e.g. `https://www.canva.com/design/DAHJCJsTxxU/edit`).

**Do NOT use `urls.edit_url` from the merge-designs response.** That field returns a `https://www.canva.com/d/...` shortlink that opens a different design — likely a new draft Canva spawned for the share flow rather than the design that was actually edited. Sharing that link with Natasha breaks the workflow because the text and image swaps live on the `design.id` design, not the shortlink target.

The same rule applies anywhere a Canva link gets surfaced: in chat to the user, in the Asana task notes, or anywhere else. Always build it from `design.id`.

### Step 6.5: Post-Creation QA Checklist

**Before presenting the final design to the user, verify all of the following:**

1. **No stale template text remains.** Check every text element returned in the editing response. If any element still contains text from the original template article (e.g., "How to Regain Momentum," "camming," "fan clubs"), it must be replaced before committing.
2. **Both background images were swapped.** Confirm both editable fill elements (page 1 and page 4) show the uploaded article `asset_id`, not the template's original `asset_id`. Compare the asset IDs directly.
3. **Slide 4 (CTA) text is unchanged.** Confirm "read the full article on" and "WETINKMAG.COM" are still the template defaults.
4. **All text is SFW.** Re-read slides 1-3 and confirm no explicit language that Instagram would throttle.
5. **Text length is appropriate.** Slide 2 should be 1-3 sentences max. Slide 3 should be 1-2 sentences. If text is too long, it won't fit the template's text box.

**If any check fails, fix it before committing.**

### Step 7: Create Asana Task

After the carousel is committed, create an Asana task in the "To Edit" section of the Wet Ink Social Media project, assigned to Natasha, with Holly Randall added as a contributor.

Use `Asana:create_tasks` (load via `tool_search` if needed) with:

```
default_project: "1214264767251100"
tasks: [
  {
    name: "[Article Title] — Instagram Carousel",
    notes: "Edit text and images as needed.\n\nCanva link: https://www.canva.com/design/[design_id]/edit\n\nArticle: [article title]",
    assignee: "1213652591985519",
    section_id: "1214264977347926",
    followers: "me,1212147273860299"
  }
]
```

**Important:** Include the Canva edit link in the task description so Natasha can go straight to it. Build the link as `https://www.canva.com/design/{design_id}/edit` from `design.id` — never paste in `urls.edit_url` (the `/d/...` shortlink), since that opens a different design. Add the user (Andrew) and Holly Randall as followers on each task.

---

## CAROUSEL TEXT GUIDELINES

- **Slide 1 (Cover):** Article title only. Bold, punchy. No subtitle needed — the template handles the visual weight.
- **Slide 2 (Hook):** The most compelling opening detail. Should make someone stop scrolling. 1-3 sentences max.
- **Slide 3 (Payoff):** The article's core argument or what the reader will learn. 1-2 sentences.
- **Slide 4 (CTA):** Don't change — template already has "read the full article on WETINKMAG.COM."

Write in the Wet Ink editorial voice: direct, confident, industry-insider. No outsider framing.

---

## PHOTO CENTERING NOTE

The template's image elements use a large fill area that extends beyond the visible slide. When the article image doesn't center well (e.g., the subject's face is cut off), the user will need to adjust cropping manually in Canva after the design is created. Flag this to the user if the uploaded image has a non-standard aspect ratio.

---

## BATCH WORKFLOW

To create carousels for multiple articles:
1. Gather all article content first
2. Upload all images to Canva
3. Create each carousel sequentially (duplicate → edit → commit → move to folder)
4. Create Asana tasks for all completed carousels (one task per carousel, assigned to Natasha, with Holly as contributor)
5. Provide all Canva links at the end

**Important:** In long conversations, Canva tools may cycle out of context. If tools become unavailable, suggest the user start a fresh chat with the article details pre-loaded.

---

## ISSUE #5 ARTICLE REFERENCE

These are the articles from the most recent Wet Ink issue for quick reference:

1. **How to Become a Pornstar: A Beginner's Guide** — by Ophelia Fae
   - Image: `https://d3k81ch9hvuctc.cloudfront.net/company/SsnjrB/images/455a7edf-e8e7-4c3b-a8fb-41abbba89c67.jpeg`

2. **Homeless and Pregnant at 17: Isis Love's Origin Story** — 27-year career
   - Image: `https://d3k81ch9hvuctc.cloudfront.net/company/SsnjrB/images/1a947944-7110-4b0a-9e1c-f2f703daebb2.jpeg`

3. **The U.K. Wants to Ban Step-Family Porn** — legislative breakdown
   - Image: `https://d3k81ch9hvuctc.cloudfront.net/company/SsnjrB/images/2867633a-5a2e-4b22-946b-5dc836b95be9.jpeg`

4. **Deconstructing the Whorearchy** — by Jude D. Grey
   - Image: `https://d3k81ch9hvuctc.cloudfront.net/company/SsnjrB/images/e3828623-b19a-45a6-94c9-30ab60ff73ba.jpeg`

5. **AVN & XMA Red Carpet** — photo gallery (no single hero image)

---

## WORKED EXAMPLES

These examples show the exact text used on completed carousels. Use them to calibrate tone, length, and voice.

### Example 1: How to Regain Momentum and Reconnect with Your Audience

- **Canva design:** `DAHHrgpO6aE`
- **Article:** Business/strategy piece on camming and fan club crossover

| Slide | Content |
|-------|---------|
| 1 (Cover) | How to Regain Momentum and Reconnect with Your Audience |
| 2 (Hook) | There's something important in our industry that people often miss: the close relationship between camming and subscription-based fan clubs. Let's take a quick look at how this relationship began. |
| 3 (Payoff) | Cam platforms introduced subscription-based fan clubs so models could earn money even when they weren't live. |
| 4 (CTA) | read the full article on WETINKMAG.COM |

### Example 2: Homeless and Pregnant at 17 — Isis Love's Origin Story

- **Canva design:** `DAHHroS8OUU`
- **Article:** Career profile — 27-year adult industry veteran

| Slide | Content |
|-------|---------|
| 1 (Cover) | Homeless and Pregnant at 17: Isis Love's Origin Story |
| 2 (Hook) | Before the 27-year career, before XXX Tryouts, before any of it — Isis Love was seventeen, pregnant, and sleeping under train tracks in Berkeley. She worked 13 jobs just to survive. |
| 3 (Payoff) | We traced her path from a laundromat pay phone to one of the longest-running careers in adult entertainment — and the financial discipline that made it possible. |
| 4 (CTA) | read the full article on WETINKMAG.COM |

### Example 3: The U.K. Wants to Ban Step-Family Porn

- **Article:** Legislative breakdown of the U.K. Crime and Policing Bill

| Slide | Content |
|-------|---------|
| 1 (Cover) | The U.K. Wants to Ban Step-Family Porn |
| 2 (Hook) | The U.K.'s Crime and Policing Bill would ban step-family content and adult roleplay simulating minors — without defining what any of those terms actually mean. |
| 3 (Payoff) | Critics warn the vague wording invites case-by-case enforcement and liability-driven platform over-compliance, echoing the fallout from FOSTA-SESTA in the United States. |
| 4 (CTA) | read the full article on WETINKMAG.COM |

**Voice notes from these examples:**
- Slide 2 leads with the single most compelling hook — the detail that makes someone stop scrolling.
- Slide 3 pulls back to the article's broader argument or significance.
- Tone is direct, insider, never explanatory. "We traced her path" not "This article traces her path."
- SFW is maintained throughout — no explicit language even on articles with explicit titles.

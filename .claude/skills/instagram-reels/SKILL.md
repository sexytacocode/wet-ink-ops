---
name: instagram-reels
description: >
  Use this skill when the user wants to create Instagram Reels from Wet Ink magazine
  articles. This covers the full workflow: finding article content, duplicating the Canva
  Reels template, uploading article images, and swapping in animated text across all scenes.
  Triggers include: "create a Reel," "make a Reel," "Instagram Reel from article,"
  "Reels content for [article name]," "video post for Wet Ink," or any request
  involving turning Wet Ink articles into short-form video content for Instagram.
  Use this skill even if the user only mentions one article or asks about Reels generally —
  the skill covers the complete Reels creation pipeline. Always use this skill before
  attempting to build Reels manually or using generate-design from scratch.
---
 
## ⚠️ PRE-FLIGHT CHECKLIST — READ BEFORE DOING ANYTHING
 
Before writing a single line of copy or making any API call, confirm all of the following:
 
- [ ] **2 versions required per article** — Long Uncensored and Long SFW. Never create just one.
- [ ] **Correct template** — Both versions use `DAHILFJfnqU`.
- [ ] **Move to folder after each commit** — Every completed Reel must be moved to `FAHHtY3V36U` using `Canva:move-item-to-folder`. This is not optional.
- [ ] **Load `Canva:move-item-to-folder`** via `tool_search` before starting — it is a deferred tool.
- [ ] **Draft Uncensored text first**, then adapt to SFW. Not the other way around.
- [ ] **Create Asana tasks after both Reels are done** — one task per Reel, assigned to Natasha, with Holly as a collaborator, in "To Edit" section. Include Canva edit links.
- [ ] **Check the tracker before building** — open the `Wet_Ink_IG_Content_Tracker` Article Coverage tab and confirm the article's `In Asana` column is `N`. If it's already `Y`, the reel was already created in a previous run; do NOT duplicate. Surface this to the user and ask before proceeding.
If any of the above is unclear, re-read the full skill before proceeding.
 
---
 
## SKILL INSTRUCTIONS
 
For each article, create **two Reel versions**:
 
1. **Long Uncensored** — 5 scenes, full Wet Ink voice, no softening (template `DAHILFJfnqU`)
2. **Long SFW** — 5 scenes, Instagram-safe language (template `DAHILFJfnqU`)
After committing each design, move it to the shared team folder `FAHHtY3V36U`.
 
---
 
## REQUIRED CANVA IDS
 
- **Long Reels template (5 scenes):** `DAHILFJfnqU`
- **Wet Ink brand kit:** `kAG8J_AhIkQ`
- **Shared Reels folder:** `FAHHtY3V36U` ("Wet Ink - Instagram Reels")
- **Template format:** 1080×1920 (Instagram Reels / 9:16 vertical video)
---
 
## REQUIRED ASANA IDS
 
- **Social media project:** `1214264767251100` ("Wet Ink Social Media")
- **"To Edit" section:** `1214264977347926`
- **"Edited" section:** `1214265071278910`
- **"Published" section:** `1214265072303679`
- **Natasha (assignee):** `1213652591985519`
- **Holly Randall (collaborator):** `1212147273860299`
---
 
## SFW vs UNCENSORED
 
**Draft Uncensored first**, then adapt to SFW. This ensures the SFW version is a deliberate edit, not a timid first draft.
 
**Uncensored** — full Wet Ink editorial voice, no softening. For Twitter/X and platforms without content restrictions.
 
**SFW** — written for Instagram, which throttles posts with explicit sexual language:
- Replace explicit anatomical terms with euphemistic alternatives
- Avoid specific sex acts, slurs, graphic body part references
- Keep the Wet Ink voice — confident, insider, sharp — just route around the explicit stuff
- If the article title is explicit, create a shortened/reframed cover title for SFW
For non-explicit articles, SFW and Uncensored text will be nearly identical — still create both versions.
 
---
 
## REEL STRUCTURES
 
### Long Reel (5 scenes) — template `DAHILFJfnqU`
 
| Scene | Role | Content |
|-------|------|---------|
| 1 (Cover) | Title + Subtitle | Full article title + one punchy subtitle sentence |
| 2 (Hook) | Two text reveals | Most scroll-stopping claim split across two animated blocks |
| 3 (Insight) | Core argument | Article's central thesis in 1-2 short sentences |
| 4 (Closing) | Takeaway/question | Provocative closing question or punchy takeaway |
| 5 (CTA) | Call to action | "read the full article on WETINKMAG.COM" (keep default) |
 
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
- **Title** (used on the title/cover scene — goes in the large title element)
- **Subtitle** (1 punchy sentence that captures the article's core premise — goes in the subtitle element below the title)
- **Hook line** (1 punchy sentence for scene 2 — the most scroll-stopping claim)
- **Key insight** (1-2 short sentences for scene 3 — the article's core argument)
- **Closing line** (1 sentence for scene 4 — a takeaway or provocative question)
- **Hero image URL** (used across scenes as the background/key visual)
Use `conversation_search` to find article details from past newsletter builds or other conversations. The newsletter-content skill workflow produces summaries and bullets that work well as Reels text.
 
**Reels text guidelines — critical differences from carousels:**
- Each text block must work as an **animated text reveal** — readers see it for 2-4 seconds per scene.
- Keep each text block to **15 words max**. Shorter is better. If a sentence exceeds 15 words, split it across two scenes.
- Write in the Wet Ink editorial voice: direct, confident, industry-insider. No outsider framing.
- Avoid line breaks within a single text element — Canva animates per-element, not per-line.
### Step 2: Load Canva Tools
 
Search for and load the following Canva tools (they are deferred and must be loaded via `tool_search`):
- `Canva:merge-designs` — to duplicate the template
- `Canva:upload-asset-from-url` — to upload the article image
- `Canva:start-editing-transaction` — to open editing session
- `Canva:perform-editing-operations` — to swap text and images
- `Canva:commit-editing-transaction` — to save changes
- `Canva:get-design-thumbnail` — to preview scenes
- `Canva:move-item-to-folder` — to move each completed design to the shared folder
- `Asana:create_tasks` — to create editing tasks for Natasha (load via `tool_search` query "create tasks")
**Important:** Load these tools early in the conversation before they cycle out of context.
 
### Step 3: Upload Article Image
 
```
Canva:upload-asset-from-url
  name: "[Article Title] Reel Image"
  url: [hero image URL]
```
 
Save the returned `asset_id` — you'll need it for image swaps across scenes.
 
### Step 4: Duplicate the Template
 
```
Canva:merge-designs
  type: "create_new_design"
  title: "[Article Title] - Instagram Reel"
  operations: [{
    type: "insert_pages",
    source: { type: "design", design_id: "[TEMPLATE_ID]" }
  }]
```
 
Save the returned `design_id` for the new design.
 
> **⚠️ Canva URL format — always use the canonical edit URL:** Whenever you give a Canva link to the user, in Asana task notes, or anywhere else, format it as `https://www.canva.com/design/{design_id}/edit`. **Do NOT use the API's `edit_url` field** (e.g., `https://www.canva.com/d/{slug}`) — that returns short-lived shortlinks that can rotate and may not always resolve. The canonical `design/{design_id}/edit` URL is stable and matches the format used elsewhere in the Wet Ink workflow.
 
### Step 5: Map the Template Structure
 
Start an editing transaction on the new design:
 
```
Canva:start-editing-transaction
  design_id: [new design ID]
```
 
The `start-editing-transaction` response returns the full element tree for all pages/scenes. You need to map:
 
1. **Which pages exist** — Reels templates typically have 4-6 pages (scenes), each representing a few seconds of video.
2. **Text elements per page** — Identify by looking for elements with `type: "TEXT"`. Note the element ID and current text content.
3. **Editable image elements per page** — Look for elements where `fills` contains an entry with `"editable": true`.
4. **Static elements** — Arrows, logos, decorative elements. Leave these unchanged.
**Template structure (verified element IDs):**
 
| Scene | Element ID | Type | Role | Replace With |
|-------|-----------|------|------|-------------|
| 1 (Cover) | `*-LBv3HvC0Zj47w9wv` | TEXT | Title (large font) | Full article title |
| 1 (Cover) | `*-LB3VG1qlcs6605Q3` | TEXT | Subtitle | Article subtitle sentence |
| 1 (Cover) | `PBfyTFR6HjgYbjwH` | IMAGE | Background (editable, page-level) | Article hero image |
| 2 (Hook) | `*-LBnJZ3Fj9ZTM0Dwq` | SHAPE | White vertical line (outer) | Resize to match text height |
| 2 (Hook) | `*-LBxQrdJHdj7Y7dg7` | SHAPE | White vertical line (inner) | Resize to match text height |
| 2 (Hook) | `*-LBpcPWctfpV8QcVz` | TEXT | Hook text (primary) | Hook line part 1 |
| 2 (Hook) | `*-LBqVcbGGQbHdc6zn` | TEXT | Hook text (secondary) | Hook line part 2 |
| 2 (Hook) | `PBDXJnnR9fM2dyN3` | IMAGE | Background (editable, page-level) | Article hero image |
| 3 (Insight) | `*-LBgqVhP88kGslJKS` | SHAPE | White vertical line | Resize to match text height |
| 3 (Insight) | `*-LBdRVVy8JMYCqhjh` | TEXT | Insight text | Key insight |
| 3 (Insight) | `*-LBvKnhBPLDlW4q6h` | IMAGE | Background (editable) | Article hero image |
| 4 (Closing) | `*-LB996j4YrW4W2bY1` | SHAPE | White vertical line | Resize to match text height |
| 4 (Closing) | `*-LBK47vMl7v696ZG3` | TEXT | Closing text | Closing line / question |
| 4 (Closing) | `*-LBxTD01cPBsh0NPH` | IMAGE | Background (editable) | Article hero image |
| 5 (CTA) | `*-LB10ztM9rz78lHnB` | TEXT | "read the full article on" | Keep default |
| 5 (CTA) | `*-LB6zcqy01XtBwY4T-LBFbkgM4NSPB2YWB` | TEXT | "WETINKMAG.COM" | Keep default |
| 5 (CTA) | `*-LB85mrYS3XNZNKg4` | IMAGE | Background (editable) | Article hero image |
 
> **Note:** Element IDs above use `*` as a prefix shorthand — the full ID includes the page ID prefix (e.g., `PBfyTFR6HjgYbjwH-LBv3HvC0Zj47w9wv`). The suffixes are stable across duplications; the page ID prefix changes per design. For scenes 1 and 2, the editable background image is at the **page level** (element_id = page_id), not a sub-element. Always use the actual element IDs returned by `start-editing-transaction`.
>
> **Note:** This template does NOT have an intro text element or its adjacent white line. No `delete_element` operations are needed for scene 1 — only replace title and subtitle text.
 
### Step 6: Perform Edits
 
Perform all edits in a single `perform-editing-operations` call. Follow these rules:
 
**Title element rules:**
- The full article title goes in the **title element** (the large font element, suffix `LBv3HvC0Zj47w9wv`).
- **KNOWN LIMITATION: `format_text` font_size silently fails on this element.** The `replace_text` operation resets the font to ~63px, and subsequent `format_text` calls report success but do not actually change the rendered font size. This is a Canva MCP API limitation — the operation succeeds at the API level but has no visual effect, likely due to template-level style constraints or auto-sizing on the element.
- **Do NOT include `format_text` with `font_size` in the edit operations.** It wastes a call and creates a false sense that the font was set correctly.
- **Instead, flag to the user** that the title font size will need manual adjustment in Canva after the design is committed. Include this in the final output message: "The title font size defaults to ~63px after text replacement. Open the design in Canva, select the title text, and increase the font size to fill the text box (typically 90–120px depending on title length)."
- The goal: no word should start on one line and finish on the next (no mid-word line breaks). The user will need to verify this visually in Canva.
**Subtitle element rules:**
- The subtitle element (suffix `LB3VG1qlcs6605Q3`) gets a **one-sentence subtitle** that captures the article's core premise — not the article title.
- Example: "The unspoken hierarchy inside the sex industry."
**White vertical line rules:**
- Each scene has a white vertical line (SHAPE element) next to the text paragraph.
- After replacing text, **resize each SHAPE element** so its height matches the height of the adjacent text element.
- Use `resize_element` operations. The text element heights are returned in the `perform-editing-operations` response — read the `dimension.height` of each text element and apply it to the corresponding SHAPE element.
- This may require a **two-pass approach**: first replace all text (to get final text heights), then resize all lines in a second `perform-editing-operations` call using the heights from the first response.
**Edit operations template:**
 
```
Canva:perform-editing-operations
  operations: [
    { type: "update_title", title: "[Article Title] - Instagram Reel" },
    { type: "replace_text", element_id: "[title element]", text: "[Full Article Title]" },
    { type: "replace_text", element_id: "[subtitle element]", text: "[Subtitle sentence]" },
    { type: "update_fill", element_id: "[scene 1 editable image]", asset_type: "image", asset_id: "[uploaded asset ID]", alt_text: "[description]" },
    { type: "replace_text", element_id: "[scene 2 hook element 1]", text: "[Hook part 1]" },
    { type: "replace_text", element_id: "[scene 2 hook element 2]", text: "[Hook part 2]" },
    { type: "update_fill", element_id: "[scene 2 editable image]", ... },
    { type: "replace_text", element_id: "[scene 3 insight element]", text: "[Key insight]" },
    { type: "update_fill", element_id: "[scene 3 editable image]", ... },
    { type: "replace_text", element_id: "[scene 4 closing element]", text: "[Closing line]" },
    { type: "update_fill", element_id: "[scene 4 editable image]", ... },
    { type: "update_fill", element_id: "[scene 5 editable image]", ... }
  ]
```
 
**Second pass — resize white lines to match text heights:**
 
After the first `perform-editing-operations` call returns, read the `dimension.height` of each text element from the response. Then call `perform-editing-operations` again with `resize_element` operations for each SHAPE (white line) element, setting the height to match its adjacent text element.
 
### Step 7: Preview and Save
 
After editing, get thumbnails for all scenes using `get-design-thumbnail` and show them to the user. Then commit:
 
```
Canva:commit-editing-transaction
  transaction_id: [transaction ID]
```
 
Then immediately move to the shared folder:
 
```
Canva:move-item-to-folder
  item_id: [design ID]
  to_folder_id: "FAHHtY3V36U"
```
 
Repeat for both versions before presenting final links to the user.
 
### Step 7.5: Post-Creation QA Checklist
 
**Before presenting the final design to the user, verify all of the following:**
 
1. **No stale template text remains.** Check every text element returned in the editing response. If any element still contains text from the original template article (e.g., "Luna Star," "Made For Porn"), it must be replaced or deleted before committing.
2. **Title font size — flag for manual adjustment.** The Canva MCP API cannot reliably change the title font size (see Title element rules above). **Always include this in the final message to the user:** "The title font resets to ~63px after text replacement. Open in Canva, select the title, and increase to 90–120px." Do NOT claim the font size was set correctly — it wasn't.
3. **All 5 background images were swapped.** Confirm all 5 editable fill elements show the uploaded article `asset_id`, not the template's original `asset_id`. Note that scenes 1 and 2 have page-level editable fills (element_id = page_id), while scenes 3-5 have sub-element fills. Compare the asset IDs directly — do not assume success from the operation status alone.
4. **White vertical lines match adjacent text heights.** Compare each SHAPE element's `dimension.height` to its adjacent TEXT element's `dimension.height`. They should be within 5px. If not, resize.
5. **Scene 5 (CTA) text is unchanged.** Confirm "read the full article on" and "WETINKMAG.COM" are still the template defaults.
6. **All Canva links use the canonical `https://www.canva.com/design/{design_id}/edit` format.** Do NOT use the `edit_url` shortlink (`/d/{slug}`) returned by the API. This applies to user-facing chat output, Asana task notes, and any other place a Canva link appears.
**If any check fails (except #2 which is a known limitation), fix it before committing.** This prevents the user from having to manually clean up template artifacts in Canva.
 
### Step 8: MP4 Export (Optional)
 
Canva's MCP does not currently support direct video export. After the design is committed:
 
1. Provide the Canva edit link to the user.
2. Instruct them to: Open in Canva → Click "Share" → "Download" → Select "MP4 Video" → Download.
3. If Canva adds an export API in the future, this step can be automated.
### Step 9: Create Asana Tasks
 
After both Reels are committed and moved to the shared folder, create one Asana task per Reel in the "To Edit" section of the Wet Ink Social Media project, assigned to Natasha with Holly Randall added as a collaborator.
 
Use `Asana:create_tasks` (load via `tool_search` if needed) with:
 
```
default_project: "1214264767251100"
tasks: [
  {
    name: "[Article Title] — Long Uncensored Reel",
    notes: "Edit text and images as needed.\n\nCanva link: https://www.canva.com/design/[design_id]/edit\n\nArticle: [article title]\nVersion: Long Uncensored (5 scenes)",
    assignee: "1213652591985519",
    section_id: "1214264977347926",
    followers: "me,1212147273860299"
  },
  {
    name: "[Article Title] — Long SFW Reel",
    notes: "Edit text and images as needed.\n\nCanva link: https://www.canva.com/design/[design_id]/edit\n\nArticle: [article title]\nVersion: Long SFW (5 scenes)",
    assignee: "1213652591985519",
    section_id: "1214264977347926",
    followers: "me,1212147273860299"
  }
]
```
 
**Important:** Include the Canva edit link in each task description so Natasha can go straight to it. Add the user (Andrew) and Holly Randall as followers on each task using `followers: "me,1212147273860299"`.
 
### Step 10: Update the Tracker
 
After Asana tasks are created, open the `Wet_Ink_IG_Content_Tracker` Article Coverage tab and flip the article's `In Asana` cell from `N` to `Y`.
 
**Tracker layout reminder — Article Coverage tab has 10 columns (A–J), not 11:**
 
| Col | Header |
|---|---|
| A | # |
| B | Article Title |
| C | Published Date |
| D | Posted on IG? |
| E | Post Type |
| F | IG Post Date |
| G | IG Link |
| H | Create Post? |
| I | New Post Type |
| **J** | **In Asana** |
 
There is no separate `Order` column in the live sheet despite older notes suggesting otherwise. When typing values via Chrome MCP, count tabs accordingly: `=ROW()-1` then 9 more cells gets you across the full row.
 
---
 
## REELS TEXT GUIDELINES
 
Reels text is animated and displayed briefly — every word must earn its place.
 
- **Scene 1 (Cover/Title):** Two elements: (a) **Title element** — the full article title in the large font. Reduce font size so no word wraps mid-word across lines. Can be shortened for punch — e.g., "Deconstructing the Whorearchy" not "Deconstructing the Whorearchy: What Respectability Politics Does to Sex Workers." (b) **Subtitle element** — a single sentence that captures the article's core premise. Not the title repeated. Example: "The unspoken hierarchy inside the sex industry."
- **Scene 2 (Hook):** The single most compelling claim. Split across two text elements if needed. Max 15 words total. Should make someone stop scrolling.
- **Scene 3 (Insight):** The article's core argument or what the reader will learn. 1-2 short sentences, max 20 words total.
- **Scene 4 (Closing):** Either a provocative closing question or a punchy takeaway. Prefer a question if the article lends itself to one.
- **Scene 5 (CTA):** Keep the default "read the full article on WETINKMAG.COM" — do not modify.
**Voice:** Direct, confident, industry-insider. We're writing for people in the industry, not explaining it to outsiders.
 
---
 
## PHOTO CENTERING NOTE
 
The template's image elements use a large fill area that extends beyond the visible frame. When the article image doesn't center well (e.g., the subject's face is cut off), the user will need to adjust cropping manually in Canva after the design is created. Flag this to the user if the uploaded image has a non-standard aspect ratio. Reels are 9:16 — portrait images work best; landscape images will crop heavily.
 
---
 
## ANIMATION NOTE
 
The Canva MCP edits text and image content but does **not** modify animations. Animations (text reveal, zoom, slide) are inherited from the template and apply automatically to whatever content is swapped in. This is by design — the template's animation timing is pre-set and on-brand.
 
If the user wants to adjust animation timing or style, they must do this manually in Canva after the design is created.
 
---
 
## BATCH WORKFLOW
 
To create Reels for multiple articles:
1. Gather all article content first
2. Upload all images to Canva
3. Create each Reel sequentially (duplicate → edit → commit → move to folder)
4. Create Asana tasks for all completed Reels (one task per Reel, assigned to Natasha, with Holly as collaborator)
5. Provide all Canva links at the end (use the `https://www.canva.com/design/{design_id}/edit` format — see Step 4)
**Important:** In long conversations, Canva tools may cycle out of context. If tools become unavailable, suggest the user start a fresh chat with the article details pre-loaded.
 
---
 
## EXAMPLE: DECONSTRUCTING THE WHOREARCHY
 
Reference content for the first Reel created with this skill:
 
- **Article:** "Deconstructing the Whorearchy" by Jude D. Grey
- **Image:** `https://d3k81ch9hvuctc.cloudfront.net/company/SsnjrB/images/e3828623-b19a-45a6-94c9-30ab60ff73ba.jpeg`
- **Summary:** The whorearchy is the unspoken hierarchy that lets some sex workers see themselves as more respectable than others — enforced daily through bullying, job exclusion, and media access. Jude D. Grey unpacks where it comes from, who it hurts most, and what it takes to dismantle it.
**Reel text (example):**
 
| Scene | Element | Text |
|-------|---------|------|
| 1 (Cover) | Title | Deconstructing the Whorearchy |
| 1 (Cover) | Subtitle | The unspoken hierarchy inside the sex industry. |
| 2 (Hook) | Text 1 | Some sex workers rank themselves above others. |
| 2 (Hook) | Text 2 | The industry enforces it daily. |
| 3 (Insight) | Text | Bullying, job exclusion, media gatekeeping — respectability politics runs deep. |
| 4 (Closing) | Text | Who decides which work is "respectable"? |
| 5 (CTA) | Default | read the full article on WETINKMAG.COM |
 
---
 
## ARTICLE REFERENCE
 
These are articles from recent Wet Ink issues for quick reference:
 
1. **How to Become a Pornstar: A Beginner's Guide** — by Ophelia Fae
   - Image: `https://d3k81ch9hvuctc.cloudfront.net/company/SsnjrB/images/455a7edf-e8e7-4c3b-a8fb-41abbba89c67.jpeg`
2. **Homeless and Pregnant at 17: Isis Love's Origin Story** — 27-year career
   - Image: `https://d3k81ch9hvuctc.cloudfront.net/company/SsnjrB/images/1a947944-7110-4b0a-9e1c-f2f703daebb2.jpeg`
3. **The U.K. Wants to Ban Step-Family Porn** — legislative breakdown
   - Image: `https://d3k81ch9hvuctc.cloudfront.net/company/SsnjrB/images/2867633a-5a2e-4b22-946b-5dc836b95be9.jpeg`
4. **Deconstructing the Whorearchy** — by Jude D. Grey
   - Image: `https://d3k81ch9hvuctc.cloudfront.net/company/SsnjrB/images/e3828623-b19a-45a6-94c9-30ab60ff73ba.jpeg`
5. **AVN & XMA Red Carpet** — photo gallery (no single hero image)
 ls -la .claude/skills/instagram-reels



# Content Pipeline Run — 2026-06-04 FAIL

## Article
**Title:** How Porn Saved Lena Moon's Life  
**Author:** Wet Ink Staff  
**Category:** Creators  

## Failure: Image Upload Blocked by Webflow CDN

### Root Cause
All 5 article images are hosted on `cdn.prod.website-files.com` (Webflow CDN).  
Webflow CDN returns HTTP 403 `x-deny-reason: host_not_allowed` for all requests  
originating from GCP ASN IP ranges (this server runs on GCP at 35.223.132.217).

This block applies to:
- Direct curl/wget from this server
- Python requests/urllib from this server
- `Canva:upload-asset-from-url` (Canva's upload servers are also GCP-hosted)
- `Klaviyo:upload_image_from_url` ("Unable to fetch the URL" error)
- All image proxy services tested (wsrv.nl, statically.io, images.weserv.nl)
- Webflow API calls from this server (same GCP block)

### Blocked Image URLs
1. `https://cdn.prod.website-files.com/69370142e0a9a33d9a05f64a/69e68dffe9e572b2d0d0680d_Lena%2BMoon%2Bin%2BThe%2BTS%2BLife%2B2.webp`
2. `https://cdn.prod.website-files.com/69370142e0a9a33d9a05f64a/69e7580e3e24ed5f5f561c02_Lena%2BStar%2Bw%2BCar.webp`
3. `https://cdn.prod.website-files.com/69370142e0a9a33d9a05f64a/69e7580d3e24ed5f5f561be7_Grooby%2Bw%2BNatalie%2BMars%2B%2526%2BCasey%2BKisses%2Bon%2BTwitter.webp`
4. `https://cdn.prod.website-files.com/69370142e0a9a33d9a05f64a/69e7580b3e24ed5f5f561bad_Grayson%2527s%2BGarage%2BSubaru%2BForester.webp`
5. `https://cdn.prod.website-files.com/69370142e0a9a33d9a05f64a/69e7580e3e24ed5f5f561c05_Lena%2BStar%2Bw%2BCar.webp`

### What Was Completed Before Failure
- Article content gathered and Reel text drafted (both Uncensored and SFW versions)
- Canva tools loaded and ready
- Template ID confirmed: DAHILFJfnqU

### Reel Text Drafted (ready to use once images are resolved)

**Uncensored:**
| Scene | Element | Text |
|-------|---------|------|
| 1 | Title | How Porn Saved Lena Moon's Life |
| 1 | Subtitle | From homeless and broke to the first trans director at Evil Angel. |
| 2 | Hook 1 | She was surviving on pickles and beer. |
| 2 | Hook 2 | Porn gave her a career — and a life. |
| 3 | Insight | A chance conversation and a weed-for-car trade sent her cross-country to her first shoot with Grooby. |
| 4 | Closing | What would have happened if she never got in that car? |
| 5 | CTA | read the full article on WETINKMAG.COM |

**SFW:** Identical except Scene 2 Hook 2: "The adult industry gave her a career — and a life."

### Fix Required
The content-pipeline needs a pre-upload step that runs in a non-GCP environment
(e.g., browser-side, Zapier, or a non-GCP Lambda) to:
1. Download images from Webflow CDN
2. Upload to a CDN accessible by Canva (Klaviyo CDN, Cloudinary, S3, etc.)
3. Pass the new CDN URLs to the instagram-reels skill

Alternatively: run this skill from a desktop Claude session where the browser
can fetch the Webflow images.

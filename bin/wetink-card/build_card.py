#!/usr/bin/env python3
"""Compose a Wet Ink social card: generated art plate + real logo + real brand type.

The image model NEVER draws the logo or the headline — it only makes the plate.
Everything brand-critical is composited here, so the type is always Anton, the
wordmark is always the real one, and a headline can be changed without paying
for a regeneration.

  python3 build_card.py <plate.png> "<headline>" <beat> <out.jpg>

Beats are Wet Ink's own site categories (the .wi-dot colour system).
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont, ImageStat

W, H = 1080, 1350          # Instagram 4:5

# Wet Ink category accent system, read off the live site's .wi-dot rules
BEAT = {
    "industry":   "#FF0F7B",
    "business":   "#0099FF",
    "creators":   "#00FF66",
    "features":   "#C8005A",
    "galleries":  "#9933FF",
    "side notes": "#FF69B4",
}
INK = "#0A0A0A"
PAPER = (242, 239, 233)

M = 72                     # margin
HERE = os.path.dirname(os.path.abspath(__file__))
A = lambda f: os.path.join(HERE, "assets", f)


def fit_lines(draw, words, font_path, size, max_w):
    """Balanced wrap. Greedy wrapping strands widows ('PICK' alone on line 2),
    so choose the break points that even out the line lengths instead."""
    import itertools
    font = ImageFont.truetype(font_path, size)
    ws = words.split()
    best = None
    for n in range(1, 4):                       # try 1, 2, then 3 lines
        for breaks in itertools.combinations(range(1, len(ws)), n - 1):
            widths, prev = [], 0
            for b in list(breaks) + [len(ws)]:
                widths.append(draw.textlength(" ".join(ws[prev:b]), font=font))
                prev = b
            if max(widths) > max_w:
                continue
            cost = max(widths) - min(widths)     # prefer even line lengths
            if best is None or cost < best[0]:
                best = (cost, breaks)
        if best:
            break
    if best is None:
        return font, None
    lines, prev = [], 0
    for b in list(best[1]) + [len(ws)]:
        lines.append(" ".join(ws[prev:b]))
        prev = b
    return font, lines


def build(plate_path, headline, beat, out_path):
    accent = BEAT.get(beat.lower().strip(), BEAT["industry"])

    art = Image.open(plate_path).convert("RGB")
    scale = max(W / art.width, H / art.height)
    art = art.resize((round(art.width * scale), round(art.height * scale)), Image.LANCZOS)
    card = art.crop(((art.width - W) // 2, 0, (art.width - W) // 2 + W, H))

    # --- lay the text block out first so we know how much room it needs
    d = ImageDraw.Draw(card)
    logo = Image.open(A("wetink-logo.png")).convert("RGBA")
    lw = 300
    logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)

    size = 92
    font, lines = fit_lines(d, headline.upper(), A("anton.ttf"), size, W - 2 * M)
    while lines is None and size > 52:
        size -= 6
        font, lines = fit_lines(d, headline.upper(), A("anton.ttf"), size, W - 2 * M)
    if lines is None:                            # pathological headline
        font = ImageFont.truetype(A("anton.ttf"), 52)
        lines = [headline.upper()]
    lead = round(size * 0.94)
    block_h = M + logo.height + 54 + 46 + 4 + 34 + lead * len(lines) + 28

    # --- legibility guard: the plate is asked to leave its top clear, but that
    # is a request to a model, not a guarantee. If the text zone is busy or
    # dark, lay a flat paper band behind it so a bad plate degrades to a plain
    # card instead of an unreadable one.
    zone = card.crop((0, 0, W, block_h))
    grey = zone.convert("L")
    mean = ImageStat.Stat(grey).mean[0]
    busy = ImageStat.Stat(grey).stddev[0]
    if mean < 170 or busy > 46:
        card.paste(Image.new("RGB", (W, block_h), PAPER), (0, 0))
        print(f"  legibility guard applied (mean={mean:.0f} stddev={busy:.0f})")

    # --- composite the brand furniture
    d = ImageDraw.Draw(card)
    card.paste(logo, (M, M), logo)
    y = M + logo.height + 54

    kf = ImageFont.truetype(A("barlow-bold.ttf"), 34)
    x = M
    for ch in beat.upper():
        d.text((x, y), ch, font=kf, fill=accent)
        x += d.textlength(ch, font=kf) + 4
    y += 46

    d.rectangle([M, y, W - M, y + 4], fill=accent)   # square ends, no radius
    y += 34

    for ln in lines:
        d.text((M, y), ln, font=font, fill=INK)
        y += lead

    card.save(out_path, quality=94)
    print(f"{out_path}  {beat} {accent}  headline {size}px / {len(lines)} lines")


if __name__ == "__main__":
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    build(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])

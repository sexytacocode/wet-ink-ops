#!/usr/bin/env bash
# Generate a Wet Ink social card for a news story: art plate (GPT Image 2 via
# Higgsfield) + composited logo/headline/beat colour.
#
#   make-card.sh "<headline>" <beat> "<subject brief>" <out.jpg>
#
#   beat     industry | business | creators | features | galleries | "side notes"
#   subject  what the collage should show, e.g.
#            "a domestic wifi router with two antennas, hand-inked signal arcs"
#
# The plate is deliberately MONOCHROME — the beat colour is composited on top,
# so one visual language covers all six categories and nothing clashes.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ $# -eq 4 ] || { sed -n '2,12p' "$0"; exit 1; }
HEADLINE="$1"; BEAT="$2"; SUBJECT="$3"; OUT="$4"

command -v higgsfield >/dev/null || { echo "higgsfield CLI not found" >&2; exit 1; }

PLATE="${OUT%.*}-plate.png"

# House style. Everything here is load-bearing:
#   - two tones only, so the beat colour is the card's only colour
#   - visible physical process (torn paper, toner grit, tape shadows) is what
#     stops it reading as AI — see agency/playbooks/design.md
#   - the ink spill off the bottom edge echoes the logo's drips and is what
#     makes unrelated subjects read as one publication
#   - the empty upper 45% is where the logo and headline go
read -r -d '' PROMPT <<EOF || true
Physical cut-and-paste collage photographed flat on a scanner, vertical.
STRICTLY TWO TONES ONLY: black ink and off-white newsprint paper. Absolutely no
colour of any kind — monochrome only. Subject: ${SUBJECT}, scissor-cut from a
harshly photocopied high-contrast black-and-white halftone photograph,
blown-out contrast, heavy photocopier grit and toner speckle. The cuttings are
stuck onto hand-torn strips of newsprint that overlap and physically connect
them, held with matte masking tape casting real shadows, so nothing floats
unattached. Hand-brushed black ink marks with visible bristle texture. A spill
of glossy black ink runs and drips down off the bottom edge with wet pooling
edges. Slightly crooked, imperfect, made by human hands. Visible scanner
texture, paper grain, dust specks. NOT digital, NOT rendered, no gradients, no
glow, no bokeh, no cinematic lighting, no 3D. Punk zine collage. The entire
upper 45 percent of the frame must be completely plain empty off-white
newsprint with nothing on it at all. No readable text, no letterforms, no logos.
EOF

echo "→ generating plate…"
URL=$(higgsfield generate create gpt_image_2 \
        --prompt "$PROMPT" \
        --aspect_ratio 3:4 --quality high --resolution 2k \
        --wait --wait-timeout 15m 2>/dev/null | tail -1)

[ -n "$URL" ] || { echo "no plate returned" >&2; exit 1; }
curl -sf -o "$PLATE" "$URL"

python3 "$HERE/build_card.py" "$PLATE" "$HEADLINE" "$BEAT" "$OUT"
echo "plate: $PLATE"

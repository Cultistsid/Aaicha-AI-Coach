#!/usr/bin/env python3
"""Generate the Aaicha app icon (coral background, cream serif "A")
and emit assets/icon.png at 1024×1024."""

import os
from PIL import Image, ImageDraw, ImageFont

SIZE = 1024
CORAL = (204, 120, 92, 255)     # #cc785c
CREAM = (250, 249, 245, 255)    # #faf9f5
CORAL_DEEP = (180, 96, 70, 255) # subtle inner glow

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "icon.png")
OUT = os.path.abspath(OUT)


def find_serif_font(size):
    candidates = [
        "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
        "/System/Library/Fonts/Supplemental/Georgia.ttf",
        "/Library/Fonts/Georgia.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def main():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded-rect coral background (macOS Big Sur+ icon shape)
    radius = int(SIZE * 0.225)
    draw.rounded_rectangle((0, 0, SIZE, SIZE), radius=radius, fill=CORAL)

    # Subtle vignette by drawing a soft inner border
    border = int(SIZE * 0.015)
    draw.rounded_rectangle(
        (border, border, SIZE - border, SIZE - border),
        radius=radius - border,
        outline=CORAL_DEEP,
        width=4,
    )

    # The "A" — large serif glyph centered
    font = find_serif_font(int(SIZE * 0.72))
    text = "A"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    # Optical baseline correction — serif fonts have descenders that push
    # the visual center down; nudge up slightly.
    x = (SIZE - text_w) // 2 - bbox[0]
    y = (SIZE - text_h) // 2 - bbox[1] - int(SIZE * 0.02)
    draw.text((x, y), text, fill=CREAM, font=font)

    img.save(OUT, "PNG")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()

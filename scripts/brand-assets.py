"""Derive every published brand asset from the single supplied master logo.

Run from the project root:  python3 scripts/brand-assets.py path/to/master.png

The master artwork is one square image (dark navy field with a glowing circular
emblem).  App icons must stay readable inside Android's circle/squircle masks,
so the maskable variant re-centres the emblem at ~78% scale on the sampled
background colour, while the UI mark is cropped to a transparent circle.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
ICONS = PUBLIC / "icons"
BRAND = PUBLIC / "brand"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def background_colour(image: Image.Image) -> tuple[int, int, int]:
    """Average the four corners: the master art uses a flat navy field."""
    w, h = image.size
    inset = max(2, w // 100)
    samples = [
        image.getpixel((inset, inset)),
        image.getpixel((w - inset, inset)),
        image.getpixel((inset, h - inset)),
        image.getpixel((w - inset, h - inset)),
    ]
    return tuple(sum(channel) // len(samples) for channel in zip(*samples))  # type: ignore[return-value]


def square(image: Image.Image) -> Image.Image:
    side = min(image.size)
    left = (image.width - side) // 2
    top = (image.height - side) // 2
    return image.crop((left, top, left + side, top + side))


def circle_mark(image: Image.Image, size: int, inset_ratio: float = 0.985) -> Image.Image:
    """Transparent PNG: emblem cropped to a soft circle for use on any surface."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    art = square(image).convert("RGBA").resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size * 4, size * 4), 0)
    draw = ImageDraw.Draw(mask)
    radius = int(size * 4 * inset_ratio / 2)
    centre = size * 2
    draw.ellipse((centre - radius, centre - radius, centre + radius, centre + radius), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS).filter(ImageFilter.GaussianBlur(size / 400))
    canvas.paste(art, (0, 0), mask)
    return canvas


def maskable(image: Image.Image, size: int, colour: tuple[int, int, int], scale: float = 0.78) -> Image.Image:
    canvas = Image.new("RGB", (size, size), colour)
    inner = int(size * scale)
    art = square(image).convert("RGB").resize((inner, inner), Image.LANCZOS)
    offset = (size - inner) // 2
    canvas.paste(art, (offset, offset))
    return canvas


def fit_font(draw: ImageDraw.ImageDraw, text: str, available: int, preferred: int, path: str) -> ImageFont.FreeTypeFont:
    size = preferred
    while size > 12:
        font = ImageFont.truetype(path, size)
        if draw.textlength(text, font=font) <= available:
            return font
        size -= 2
    return ImageFont.truetype(path, 12)


def og_card(image: Image.Image, width: int = 1200, height: int = 630) -> Image.Image:
    colour = background_colour(image)
    canvas = Image.new("RGB", (width, height), colour)
    draw = ImageDraw.Draw(canvas)
    for step in range(height):
        blend = 0.30 * (1 - step / height)
        draw.line(
            [(0, step), (width, step)],
            fill=tuple(min(255, int(channel + (255 - channel) * blend)) for channel in colour),
        )
    emblem = int(height * 0.58)
    art = circle_mark(image, emblem)
    canvas.paste(art, (int(width * 0.05), (height - emblem) // 2), art)
    text_x = int(width * 0.05) + emblem + 48
    available = width - text_x - 48
    title = "Real Education Time"
    body = "Class 6-12  •  CBSE / Bihar Board / ICSE"
    tag = "One-time access  •  Rs 7 / Rs 9"
    title_font = fit_font(draw, title, available, 58, FONT_BOLD)
    body_font = fit_font(draw, body, available, 27, FONT_REGULAR)
    tag_font = fit_font(draw, tag, available, 24, FONT_BOLD)
    draw.text((text_x, height // 2 - 96), title, font=title_font, fill=(255, 255, 255))
    draw.text((text_x, height // 2 - 18), body, font=body_font, fill=(196, 214, 255))
    draw.text((text_x, height // 2 + 22), "AI tutor  •  Real tests  •  Performance analysis", font=body_font, fill=(196, 214, 255))
    draw.text((text_x, height // 2 + 82), tag, font=tag_font, fill=(126, 231, 205))
    return canvas


def main() -> None:
    source = Path(sys.argv[1]).expanduser()
    master = Image.open(source)
    ICONS.mkdir(parents=True, exist_ok=True)
    BRAND.mkdir(parents=True, exist_ok=True)
    colour = background_colour(master.convert("RGB"))

    square(master.convert("RGB")).resize((512, 512), Image.LANCZOS).save(ICONS / "icon-512.png", optimize=True)
    square(master.convert("RGB")).resize((192, 192), Image.LANCZOS).save(ICONS / "icon-192.png", optimize=True)
    maskable(master, 512, colour).save(ICONS / "maskable-512.png", optimize=True)
    square(master.convert("RGB")).resize((180, 180), Image.LANCZOS).save(ICONS / "apple-touch-icon.png", optimize=True)
    square(master.convert("RGB")).resize((48, 48), Image.LANCZOS).save(ICONS / "favicon.png", optimize=True)
    icon_sizes = [(16, 16), (32, 32), (48, 48)]
    square(master.convert("RGB")).resize((256, 256), Image.LANCZOS).save(
        PUBLIC / "favicon.ico", sizes=icon_sizes
    )
    circle_mark(master, 512).save(BRAND / "ret-logo.png", optimize=True)
    circle_mark(master, 256).save(BRAND / "ret-logo-256.png", optimize=True)
    og_card(master).save(BRAND / "og-image.png", optimize=True)
    print(f"brand assets written from {source.name}; sampled background rgb{colour}")


if __name__ == "__main__":
    main()

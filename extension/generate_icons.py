"""
Generate DriveGuard extension icons (PNG) using Pillow.
Run from the extension/ directory:  python generate_icons.py
"""
import math
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    raise SystemExit("Pillow is required: pip install Pillow")

SIZES = [16, 48, 128]
OUT_DIR = Path(__file__).parent / "icons"
OUT_DIR.mkdir(exist_ok=True)


def draw_shield_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Background circle
    pad = size * 0.04
    d.ellipse([pad, pad, size - pad, size - pad], fill="#4f46e5")

    # Shield shape (filled white)
    s = size
    shield_pts = _shield_points(s)
    d.polygon(shield_pts, fill="white")

    # Lock body (indigo filled rect)
    lw = s * 0.22
    lh = s * 0.20
    lx = (s - lw) / 2
    ly = s * 0.50
    d.rounded_rectangle([lx, ly, lx + lw, ly + lh], radius=s * 0.04, fill="#4f46e5")

    # Lock shackle (arc)
    arc_pad = s * 0.30
    arc_top = s * 0.35
    arc_bot = s * 0.54
    d.arc([arc_pad, arc_top, s - arc_pad, arc_bot], start=200, end=340, fill="#4f46e5", width=max(1, int(s * 0.06)))

    return img


def _shield_points(s):
    # Symmetric shield: wide at top, tapers to a point at the bottom
    mx = s / 2
    top = s * 0.22
    shoulder_y = s * 0.35
    side_x = s * 0.20
    bottom = s * 0.78
    pts = [
        (mx, top),
        (s * 0.80, shoulder_y),
        (s * 0.80, s * 0.55),
        (mx, bottom),
        (s * 0.20, s * 0.55),
        (s * 0.20, shoulder_y),
    ]
    return pts


def main():
    for size in SIZES:
        img = draw_shield_icon(size)
        path = OUT_DIR / f"icon{size}.png"
        img.save(path, "PNG")
        print(f"  Wrote {path}")
    print("Icons generated successfully.")


if __name__ == "__main__":
    main()

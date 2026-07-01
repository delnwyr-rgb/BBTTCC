#!/usr/bin/env python3
"""whiten-to-alpha — turn bright-line art (circuits / sigils / hexes) into a clean
transparent PNG overlay, with optional baked feather/halo glow.

WHY: A naive "delete white" threshold leaves ugly white halos on anti-aliased edges.
This does proper COLOR-TO-ALPHA: alpha is derived from each pixel's distance from the
background color, and the line color is un-premultiplied so edges stay crisp and
true-colored over ANY background. Output works under Normal AND glows correctly under
the Add/Screen blend modes used by scene-overlay-helper.macro.js.

DEPENDS:  pip install pillow numpy        (host-side authoring tool — not loaded by Foundry)

USAGE:
  python3 whiten-to-alpha.py INPUT.png [OUTPUT.png] [options]

  # basic — white background -> transparent, trimmed to the art's footprint
  python3 whiten-to-alpha.py circuit.png

  # baked glow: feathered halo around every line (great for Add/Screen overlays)
  python3 whiten-to-alpha.py circuit.png --glow

  # tune the glow + source on a BLACK background instead of white
  python3 whiten-to-alpha.py sigil.png out.png --glow --glow-radius 8 --glow-intensity 0.85 --bg black

OPTIONS:
  --bg {white,black}     background color to remove (default: white)
  --glow                 bake a feathered halo behind the lines
  --glow-radius  N       base blur radius in px (default: 6)
  --glow-intensity F     halo strength 0..1 (default: 0.7)
  --no-trim              keep the original canvas size (don't crop to footprint)
"""
import argparse
import os
import numpy as np
from PIL import Image, ImageFilter, ImageOps


def color_to_alpha(im, bg):
    """Return (rgb float HxWx3, alpha float HxW 0..255) with `bg` made transparent."""
    a = np.asarray(im.convert("RGB"), dtype=np.float32)
    if bg == "white":
        # white(min channel = 255) -> alpha 0; saturated line (low min) -> alpha high
        alpha = 255.0 - a.min(axis=2)
        A = np.maximum(alpha / 255.0, 1e-4)[..., None]
        rgb = (a - 255.0 * (1.0 - A)) / A                 # un-premultiply over white
    else:  # black
        alpha = a.max(axis=2)                              # brightness = ink amount
        A = np.maximum(alpha / 255.0, 1e-4)[..., None]
        rgb = a / A                                        # un-premultiply over black
    return np.clip(rgb, 0, 255), alpha


def to_rgba(rgb, alpha):
    return Image.fromarray(np.dstack([rgb, alpha[..., None]]).astype(np.uint8), "RGBA")


def soft_glow(base, radius, intensity):
    """One feathered halo layer: premultiply -> gaussian blur -> un-premultiply -> scale."""
    arr = np.asarray(base, np.float32)
    al = arr[..., 3:] / 255.0
    pm = np.dstack([arr[..., :3] * al, arr[..., 3]]).astype(np.uint8)   # premultiplied
    blur = np.asarray(Image.fromarray(pm, "RGBA").filter(ImageFilter.GaussianBlur(radius)), np.float32)
    ba = np.maximum(blur[..., 3:] / 255.0, 1e-4)
    col = np.clip(blur[..., :3] / ba, 0, 255)                           # un-premultiply
    ga = np.clip(blur[..., 3] * intensity, 0, 255)
    return to_rgba(col, ga)


def main():
    p = argparse.ArgumentParser(description="white/black background -> transparent overlay PNG")
    p.add_argument("input")
    p.add_argument("output", nargs="?")
    p.add_argument("--bg", choices=["white", "black"], default="white")
    p.add_argument("--glow", action="store_true")
    p.add_argument("--glow-radius", type=float, default=6.0)
    p.add_argument("--glow-intensity", type=float, default=0.7)
    p.add_argument("--no-trim", action="store_true")
    args = p.parse_args()

    out = args.output
    if not out:
        stem, _ = os.path.splitext(args.input)
        out = f"{stem}-overlay{'-glow' if args.glow else ''}.png"

    rgb, alpha = color_to_alpha(Image.open(args.input), args.bg)
    res = to_rgba(rgb, alpha)

    if args.glow:
        # Pad so halos near the edges aren't clipped, then stack two layers:
        # a wide faint bloom + a tighter brighter one, both BEHIND the crisp lines.
        pad = int(args.glow_radius * 3) + 2
        res = ImageOps.expand(res, border=pad, fill=(0, 0, 0, 0))
        wide = soft_glow(res, args.glow_radius * 2.2, args.glow_intensity * 0.5)
        tight = soft_glow(res, args.glow_radius, args.glow_intensity)
        res = Image.alpha_composite(Image.alpha_composite(wide, tight), res)

    if not args.no_trim:
        bbox = res.split()[3].point(lambda v: 255 if v > 8 else 0).getbbox()
        if bbox:
            res = res.crop(bbox)

    res.save(out)
    w, h = res.size
    print(f"wrote {out}  ({w}x{h}){'  +glow' if args.glow else ''}")


if __name__ == "__main__":
    main()

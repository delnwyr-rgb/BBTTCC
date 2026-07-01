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

  # BATCH: convert a whole folder -> writes into <folder>/overlays/
  python3 whiten-to-alpha.py ~/art/Circuits --glow
  python3 whiten-to-alpha.py ~/art/Circuits --glow --out-dir ~/art/ready

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


IMG_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff")


def convert_one(inp, outp, args):
    """Convert a single image file inp -> outp per args. Returns (w, h)."""
    rgb, alpha = color_to_alpha(Image.open(inp), args.bg)
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

    res.save(outp)
    return res.size


def _out_name(inp, glow):
    stem, _ = os.path.splitext(os.path.basename(inp))
    return f"{stem}-overlay{'-glow' if glow else ''}.png"


def main():
    p = argparse.ArgumentParser(description="white/black background -> transparent overlay PNG (file or folder)")
    p.add_argument("input", help="an image file OR a folder of images (batch mode)")
    p.add_argument("output", nargs="?", help="output file (single) — ignored in folder mode")
    p.add_argument("--bg", choices=["white", "black"], default="white")
    p.add_argument("--glow", action="store_true")
    p.add_argument("--glow-radius", type=float, default=6.0)
    p.add_argument("--glow-intensity", type=float, default=0.7)
    p.add_argument("--no-trim", action="store_true")
    p.add_argument("--out-dir", help="folder mode: where to write (default: <input>/overlays)")
    args = p.parse_args()

    # ── FOLDER (batch) MODE ──────────────────────────────────────────────────
    if os.path.isdir(args.input):
        out_dir = args.out_dir or os.path.join(args.input, "overlays")
        os.makedirs(out_dir, exist_ok=True)
        # Skip non-images and our own outputs so re-runs don't reprocess results.
        files = sorted(
            f for f in os.listdir(args.input)
            if f.lower().endswith(IMG_EXTS)
            and not f.lower().endswith(("-overlay.png", "-overlay-glow.png"))
        )
        if not files:
            print(f"no source images in {args.input}")
            return
        ok = 0
        for f in files:
            src = os.path.join(args.input, f)
            dst = os.path.join(out_dir, _out_name(src, args.glow))
            try:
                w, h = convert_one(src, dst, args)
                print(f"  ✓ {f}  ->  {os.path.basename(dst)}  ({w}x{h})")
                ok += 1
            except Exception as e:  # noqa: BLE001 — keep batch going on a bad file
                print(f"  ✗ {f}  SKIPPED  ({e})")
        print(f"done: {ok}/{len(files)} -> {out_dir}{'  +glow' if args.glow else ''}")
        return

    # ── SINGLE FILE MODE ─────────────────────────────────────────────────────
    out = args.output or os.path.join(
        os.path.dirname(args.input), _out_name(args.input, args.glow))
    w, h = convert_one(args.input, out, args)
    print(f"wrote {out}  ({w}x{h}){'  +glow' if args.glow else ''}")


if __name__ == "__main__":
    main()

# Bad Eden — Overlay Art Workflow (console → Foundry)

End-to-end pipeline for getting circuit / sigil / hex art onto maps as glowing
Foundry tiles. Two halves: a **console converter** (turn art into clean overlay
PNGs) and two **in-world macros** (place & manage the tiles).

> Sibling docs in this folder: `OVERLAY-ART-SPEC.md` (how to author the source art —
> background colours, resolution-to-grid, glow recipe) and the tool files themselves.

---

## 0. One-time setup (already done on this machine)

```bash
# a dedicated venv so Homebrew Python isn't touched
python3 -m venv ~/.venvs/overlay
~/.venvs/overlay/bin/pip install -r ~/modules/bbttcc-travel/tools/requirements.txt   # pillow + numpy

# the alpha/glow commands live in a sourceable script; ~/.zshrc sources it:
#   source ~/modules/bbttcc-travel/tools/overlay-shell.sh
```

If the `glow` / `alpha` commands ever go missing (new machine, fresh shell), redo the two
steps above. To use them in a single session without touching your profile:
`source ~/modules/bbttcc-travel/tools/overlay-shell.sh`.

---

## 1. Convert art → transparent overlay PNG  (the console half)

Two commands, both wrappers over `whiten-to-alpha.py`:

| Command | Result |
|---|---|
| `alpha FILE` | white/black background → **transparent**, no glow |
| `glow FILE`  | transparent **+ baked feather/halo** (the neon look) |

```bash
# single file  → writes <name>-overlay.png / <name>-overlay-glow.png next to the input
glow  ~/Desktop/mysigil.png
alpha ~/Desktop/mycircuit.png

# whole FOLDER (batch) → writes into <folder>/overlays/
glow  ~/art/Circuits
glow  ~/art/Circuits --out-dir ~/art/ready

# tuning
glow  sigil.png --glow-radius 8 --glow-intensity 0.85   # wider / brighter halo
glow  sigil.png --bg black                              # art drawn on BLACK, not white
alpha pic.png   --no-trim                               # keep original canvas (don't crop)
```

**Flags:** `--bg {white,black}` · `--glow` · `--glow-radius N` (default 6) ·
`--glow-intensity F` (0–1, default 0.7) · `--no-trim` · `--out-dir DIR` (folder mode).

**Why not just delete white?** These do proper *colour-to-alpha* → clean anti-aliased
edges, no white halos. Design rule of thumb: **Add/Screen blend → black or transparent
background; Multiply → white; Normal → transparent.** (Full detail in `OVERLAY-ART-SPEC.md`.)

---

## 2. Store the PNG where Foundry can see it

Drop converted overlays into the art library:

```
art/bbttcc/GOTTGAIT/Circuits and Sigils/
```

- Local testing: put it under your Foundry `Data/` at that path.
- Live worlds: `bin/ft-deploy <that path>` (a `.png` is a plain asset — deploy + F5, no restart).

The **placer macro opens its file browser straight to this folder** by default.

---

## 3. Place it in-world  (the Foundry half)

Run **`scene-overlay-helper.macro.js`** — paste its contents into a **GM Script macro** and
execute (these are paste-run tools, not loaded modules; re-paste after any edit).

Dialog options:
- **Blend** — Add / Screen (glow), Multiply (burn-in), Normal (flat).
- **Fit** — cover whole scene, or custom size in grid squares at the view centre.
- **Layer** — Ground (below tokens; floor art) / Overlay (above tokens; wards).
- **Opacity**, **Tint** (colour picker + "apply" toggle).
- **Spin** — continuous rotation around the tile centre (speed in °/sec, negative = reverse;
  round-sigil / orbital-ring friendly). The gold frame spins with it.
- **Pulse** — gentle breathing (amp + speed). Stacks with Spin.
- **Gold frame glow** — the GM control-bar "Hexchrome" halo drawn as a glowing frame around
  the tile (colour picker + intensity). Pairs with Pulse to breathe.
- **Snap to grid**, **Clear old overlays first**.

Then drag/scale the tile on the Tiles layer like any tile.

---

## 4. Manage / retune  (`scene-overlay-manager.macro.js`)

Paste-run as a GM Script macro. Lists every overlay on the current scene:

- **Edit…** — tick ONE overlay → reopens the full Helper-style dialog pre-filled with its
  current settings; change blend / layer / opacity / rotation / tint / pulse / frame / even
  swap the image, and it updates the tile in place (no re-placing).
- Per-overlay + bulk **Show / Hide / Delete**.
- **Frame ON / Frame off** — toggle the gold frame on existing overlays *without re-placing*.
- **Frame colour** picker — Frame ON applies (and **recolours**) to the chosen colour, so the
  tune loop is: tick → pick colour → Frame ON → nudge → Frame ON again.
- Only ever touches BBTTCC overlay tiles (the `flags["bbttcc-travel"].overlay` stamp);
  hand-placed art tiles are left alone.

---

## How the glow effects persist (for future maintainers)

Foundry tiles have no `blendMode` in their schema, so the look is stashed in
`flags["bbttcc-travel"].overlay` and re-applied to `tile.mesh` on `drawTile`/`refreshTile`,
with a ticker for the pulse. The **gold frame** is a PIXI Graphics (concentric strokes:
wide low-alpha halo + crisp border + inner sheen) drawn into a container on `canvas.primary`,
bound to the tile mesh's real transform so it tracks on move/rotate. Both macros carry an
identical copy of this renderer behind one shared guard key (`game.bbttcc.__overlayHooked`),
so running either renders effects and running both never double-hooks.

**Make it permanent across reloads:** lift that renderer block into a `bbttcc-travel` init
script (no schema change needed) — until then it re-registers each time a macro runs.

---

## Quick reference

```bash
glow  FILE|FOLDER   [--glow-radius N --glow-intensity F --bg black --out-dir DIR]
alpha FILE|FOLDER   [--bg black --no-trim --out-dir DIR]
```
- Art in → `art/bbttcc/GOTTGAIT/Circuits and Sigils/`
- Place → `scene-overlay-helper.macro.js`  (Add blend + optional Pulse / Gold frame)
- Manage/recolour → `scene-overlay-manager.macro.js`

**Golden path:** white-background art → `glow` → drop in the art folder → helper → **Add** blend. Done.
```

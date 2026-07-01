# Bad Eden — Overlay Art Spec (circuits / sigils / hexes)

Authoring spec for the transparent PNG overlays used by
`scene-overlay-helper.macro.js` (place) + `scene-overlay-manager.macro.js` (toggle/remove).
The goal: art that drops onto a Dungeon Alchemist export, lands **on the grid**, and reads
as **glowing light** (not a flat sticker) when blended with Add/Screen.

---

## 1. The golden rule — design *for the blend*

The helper applies a real PIXI blend mode to the tile. With **Add** and **Screen**:

- **Black (`#000000`) becomes invisible.** Add/Screen treat black as "no light."
- **Bright colors = glow.** The brighter the pixel, the stronger it lights the floor.
- So author your circuits/sigils as **bright lines on a transparent _or_ pure-black background.**

| Blend | Use it for | Background should be |
|---|---|---|
| **Add** | Neon circuitry, hot sigils, energy | Transparent **or** pure black |
| **Screen** | Softer glow, runes, faint wards | Transparent **or** pure black |
| **Multiply** | Etched/burned-in lines, soot, inlay | **White** (white = invisible under Multiply) |
| **Normal** | Opaque decals, painted tile inlays | Transparent |

> Rule of thumb: **Add/Screen → black background. Multiply → white background. Normal → transparent.**
> Transparent works for all three but black/white backgrounds give the cleanest edges (no semi-transparent halo).

---

## 2. Resolution — match the grid so it lands square

A Foundry scene has a **grid size in pixels per square** (`scene.grid.size`, often 100–150px;
DA exports commonly land at 70–256 px/tile depending on your export setting). Size your PNG to:

```
PNG width  (px) =  squares_wide  ×  grid_px  ×  supersample
PNG height (px) =  squares_tall  ×  grid_px  ×  supersample
```

- **`grid_px`** = your scene's px-per-square. Check it: select the scene → Grid → *Size*, or in console `canvas.scene.grid.size`.
- **`supersample`** = `2` is the sweet spot. Author at 2× the on-canvas size so the glow stays crisp when players zoom; the helper scales it down to fit. (Use `1` for huge full-scene sheets to keep file size sane.)

### Worked examples (assuming a 100 px/square scene)

| Overlay | On grid | Author at 2× | Notes |
|---|---|---|---|
| Single floor sigil | 3×3 sq | **600 × 600** | place with custom-fit, 3×3 |
| Circuit conduit strip | 1×8 sq | **200 × 1600** | tile several end-to-end |
| Hex-grid ward ring | 6×6 sq | **1200 × 1200** | Overlay layer, pulse on |
| Full-room circuit floor | scene size | **= scene px, ×1** | use "Cover whole scene" fit |

> Keep individual PNGs **≤ ~4096 px on the long edge** and **≤ ~8 MB**. Bigger = canvas hitches.
> For full-scene sheets, supersample `1` and lean on the natural export resolution.

---

## 3. Format & channels

- **Format:** `.png` with a real **alpha channel** (32-bit RGBA). Also fine: `.webp` (smaller).
- **Power-of-two friendly** dimensions help GPU texture memory but aren't required.
- **Premultiplied alpha:** export straight/un-premultiplied (standard PNG) — Foundry/PIXI handle it.
- **Trim transparent margins** so the art's bounding box ≈ its grid footprint; this makes
  custom-fit sizing predictable (a 3×3 sigil should fill a 3×3 PNG corner-to-corner).

---

## 4. The glow look (in your image editor)

To get that lit-circuit feel *baked into the PNG* (stacks with the in-Foundry blend):

1. Draw lines on their own layer over **black** (or transparent).
2. Duplicate the line layer → **Gaussian blur** the copy (4–12px) → set to **Screen/Add** → that's the bloom halo.
3. Optional: a second, wider blurred copy at low opacity for ambient glow.
4. Keep a thin, bright **core** line on top so it stays readable when shrunk.
5. Flatten the glow stack (not the background) → export PNG with transparency.

Then in Foundry pick **Add** (hot) or **Screen** (soft), set **Opacity ~0.7–0.9**, and enable **Pulse**
(amp ~0.15–0.25, speed ~1.0–1.5) for sigils that breathe.

---

## 5. Tint trick — one PNG, many colors

Author your art **white/neutral**, then use the helper's **Tint** field (`#39d6ff` cyan,
`#b061ff` violet, etc.). Because the mesh is tinted multiplicatively, a white-line PNG recolors
cleanly to any faction/energy palette — so you only draw each circuit/sigil **once**.

---

## 6. Layer choice cheat-sheet

| You want… | Helper "Layer" | Why |
|---|---|---|
| Circuitry **on the floor** under minis | **Ground** | elevation 0, sort below tokens |
| A **ward / shield dome / hazard glow** over tokens | **Overlay** | elevation 20, draws on top |

Ground overlays read as part of the map; Overlay overlays read as active magic/energy in the air.

---

## 7. Quick checklist before export

- [ ] Background is **black** (Add/Screen) / **white** (Multiply) / **transparent** (Normal)
- [ ] Canvas size = `squares × grid_px × 2` (or ×1 for full-scene sheets)
- [ ] Transparent margins trimmed to the grid footprint
- [ ] Bright core line + blurred bloom layer for the glow
- [ ] Saved as RGBA `.png` (or `.webp`), long edge ≤ ~4096px, file ≤ ~8MB
- [ ] Dropped into your `art/bbttcc/…` library so the FilePicker finds it

---

*Files:* `scene-overlay-helper.macro.js` (place) · `scene-overlay-manager.macro.js` (manage) · this spec.
*All three live in `modules/bbttcc-travel/tools/` and run in-world — no `ft-deploy` needed.*

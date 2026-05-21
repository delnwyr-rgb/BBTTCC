# BBTTCC Tableau — System-Level Substrate

**Status:** Live · Phase A spike playtest-validated 2026-05-21 across 7 commits (`edd4789` → `ae8c052`).
**Owner:** delnwyr (GM/designer)
**Engine:** `bbttcc-raid/scripts/tableau.canvas.js`
**Tuning UI:** `bbttcc-master-content/tools/tableau-tune.macro.js`
**API:** `game.bbttcc.api.raid.tableau`
**First consumer:** Courtly Intrigue S.2 — see `COURTLY_INTRIGUE_SPEC.md`

---

## What it is

Forced-perspective canvas rendering. Tokens flagged as **tableau actors** render at a visual scale derived from their Y position on the scene — closer to the camera = larger, farther back = smaller, with a tunable curve so the falloff feels like real depth instead of linear interpolation. Z-order follows Y so closer tokens correctly draw over farther ones. The selection border, resource bars, and nameplate all scale together so the GM authoring view stays clean.

The capability is **system-level**, not courtly-only. Anywhere a scene benefits from depth, you flip a scene flag and start placing tokens.

## Why we built it instead of using Vistas

- **No paid-module dependency.** Vistas is the marquee Foundry/Ember perspective-canvas module; we get the capability without the licensing tail.
- **Scene flags live next to raid config.** Scenario engines can read tableau state directly — a courtly anytime "Sidle Closer" can move a token by a sensible step; a successful expose can knock a courtier visually backward; a combat boss can call its own depth band as a stage cue.
- **Full UX control.** Live tuning panel, on-canvas guide lines, set-from-token buttons, per-scene persistence. Whatever the gameplay needs, we ship.

---

## What it unlocks (playtest 2026-05-21)

- **Courtly tableaux** — the original target. Portrait tokens, throne rooms, masque scenes.
- **Forced-perspective combat** — boss as colossal foreground figure, party at midground scale, minions arriving from back wall. The party's strike rolls and ranges work unchanged.
- **Ambush staging** — enemies spawn tiny at backY then grow as they advance toward the line.
- **Cinematic entrances** — a figure enters at scale 0.15 through a back archway and scales up as they walk forward.
- **Duels** — two foreground figures square off; witnessing crowd shrinks into the back.
- **Hold-the-line defense** — PCs anchored front-of-stage, waves arriving from the back.
- **Non-raid scenes** — dialog tableaus, vendor stalls, exploration set-pieces. The substrate doesn't care if the scene is a raid.

## Mental model

| Layer | Y range | Visual role |
|---|---|---|
| **Foreground band** | near `frontY` | The active scene. Hero figures, primary combatants, central courtiers. Scale ≈ `maxScale`. |
| **Midground band** | middle Y | Supporting characters, ranged attackers, secondary courtiers. Mid-curve scale. |
| **Background band** | near `backY` | Environment figures, distant enemies, audience, dead bodies. Scale ≈ `minScale`. |

The curve exponent shapes the falloff. Linear (curve=1.0) feels flat; ease-in (curve=2.0–3.0) feels like real depth. Per-scene tuning means a wide salon, a deep cathedral, and an outdoor courtyard each get their own perspective signature.

---

## Scene-level config

```js
scene.flags["bbttcc-raid"].tableau = {
  enabled:  true,
  frontY:   2484,    // canvas Y for max scale (closer to camera)
  backY:    1016,    // canvas Y for min scale (back wall)
  minScale: 0.25,    // scale at backY
  maxScale: 1.00,    // scale at frontY (slider goes to 5.0 for dramatic foreground)
  curve:    1.8,     // pow exponent; 1.0 = linear, >1 = aggressive falloff
  zSortByY: true
}
```

Set via the live-tuning macro (or `api.enable(partial)`); per-scene persistence is automatic.

## Per-token opt-in

```js
token.flags["bbttcc-raid"].tableauActor = true
```

Toggled by the GM in the tuning panel ("Mark Selected as Courtier" — the label is courtly-flavored for now but the flag is generic). Future consumer modules can re-label the button as appropriate.

## API surface

```js
game.bbttcc.api.raid.tableau.enable(partial, scene)          // write config + apply
game.bbttcc.api.raid.tableau.disable(scene)                  // turn off + restore tokens
game.bbttcc.api.raid.tableau.setFrontBack(frontY, backY)
game.bbttcc.api.raid.tableau.markActor(token, on)
game.bbttcc.api.raid.tableau.readConfig(scene)
game.bbttcc.api.raid.tableau.applyAll()                      // force recompute
game.bbttcc.api.raid.tableau.showGuides(scene)               // draw frontY/backY lines
game.bbttcc.api.raid.tableau.hideGuides()
```

The API namespace lives under `raid` for now because raid is the first consumer module. If a non-raid consumer needs it, the API can be mirrored at `game.bbttcc.api.canvas.tableau` without breaking existing callers.

---

## Known interactions

- **Range mechanics unchanged.** Strike-range checks and AoE templates use document coordinates (grid-distance), not visual scale. A "30ft fireball" works correctly whether the caster is visually huge or tiny. This is the right call — visual distance ≠ mechanical distance is a defensible tabletop convention.
- **Hit-area asymmetry.** A token at scale 0.25 has a 25%-visual hit-area-vs-footprint discrepancy: GM can click anywhere in the original footprint to select. For combat targeting this is *helpful* (small back-stage targets are easier to grab than they look); for player UX it's mostly invisible.
- **VFX inherits scale.** Manifestation effects, weapon strikes, and other visual placeables share the same canvas group as tokens; they pick up the depth scaling automatically. Free win.
- **Rigs.** Large tokens (rigs at 5×5 grid spaces, bosses at 8×8) scale via the same math. A back-stage rig at minScale 0.25 looks naturally distant; a foreground rig at maxScale 2.0 looks looming. No special-case handling needed.

## Non-interactions (things that DON'T work)

- **PC token vision/lighting fields** are not scaled — they remain at document-scale. This is correct: vision range is mechanical, not visual.
- **Token controls HUD** (the right-click radial) renders at canvas scale, not tableau scale. Slight visual mismatch but functional.
- **GM-only token outlines / dispositions** render at original scale. Possible future polish.

---

## When NOT to use a tableau

- **Tactical grid combat** where positional adjacency and flanking matter for mechanics. The grid is still drawn but visual scale obscures relative positions. Use a flat scene.
- **Theater-of-the-mind** scenes where token positions are abstract. No benefit from depth.
- **Scenes with frequent token spawn/despawn** (large mob encounters). Per-frame depth recompute is cheap for ~12 tokens but worth measuring at higher counts.
- **Scenes where players need to read token nameplates from a distance.** Back-stage names get tiny.

## Performance cap

12 named tokens per tableau is the design ceiling. Beyond that, per-frame scale recompute starts costing measurable frame time. The tuning macro doesn't currently enforce this — add a warning if we see scenes pushing past it in playtest.

---

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| A | Engine + tuning UI + per-scene tuning + guide lines + set-from-token | ✅ Done (2026-05-21) |
| A.x | Polish: nameplate scale, max-slider extension, file naming | ✅ Done |
| Substrate doc | This file | ✅ Done |
| B (Courtly) | On-canvas HUD: Influence/Suspicion + Courtier roster + Secrets panels | Next |
| Combat opt-in | Validate tableau on a real combat scene; document any gotchas | Recommended after a Phase B session |
| Lift to own module | If non-raid uses accrue, migrate `tableau.canvas.js` + API to `bbttcc-tableau` | Deferred until 2+ non-raid consumers exist |

---

## See also

- `COURTLY_INTRIGUE_SPEC.md` — first consumer's design memo
- [[tableau-native-vistas-2026-05-21]] — strategic framing in memory
- [[courtly-intrigue-s2-design-memo-2026-05-20]] — parent design memo
- [[ft-hud-draggable-helper]] — the HUD helper Phase B will use for floating panels

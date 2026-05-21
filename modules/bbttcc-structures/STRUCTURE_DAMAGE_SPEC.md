# Structure Damage Path — Design Spec

**Status:** Paper phase complete + signed off 2026-05-20. Ready for Phase A scaffold.

**Scope fence:** This spec covers the **building system** — schema, damage path, Forge bridge, Bulwark hookups, Rig unification. The **Siege Raid Type** is its own future sprint and inherits from this spec.

---

## §1 — Motivation

Playtesters are already aiming Rig weapons at structures that foes stand on, intuitively reaching for "less lethal takedown" patterns. The Bulwark class (which absorbed the retired Breaker) is already authored against a Structure damage vocabulary — Catastrophic Entry "ignores structure resistance," Siege Cost "−1 Violence OP this Siege," Ruin to Renewal "purifies fortification" — but no Structure entity exists for those abilities to interact with. Rigs feel flimsy in play because they have no hardness model beyond a single integrity track. Facilities (deployed via Holdings Phase C) need to be targetable on Raid maps as massive rendered tokens.

This spec gives all of that a single mechanical home, **reusing the existing RFI materials catalog** (~60 materials across 3 seeded sets) as the load-bearing fiction.

## §2 — Schema lock

New flag namespace on any actor that can be damaged structurally. Lives on a new module `bbttcc-structures` (rationale §8).

```
actor.flags.bbttcc-structures = {
  hasStructure:   true,
  facilityMode:   true|false,           // raises BOM scale ceiling + unlocks Holdings bridge
  materialBOM:    [
    { materialKey, qty, family, tier, tagsCache }   // family/tier denormalized for damage hot path
  ],
  state:          "intact"|"damaged"|"breached"|"razed",
  plates:         { current, max },     // both derived from BOM; current updated on chip
  threshold:      Number,               // derived; cached
  resists:        ["kinetic","hex-resistant",...],
  loadBearing:    Boolean,              // derived: any sephirotic units > 0
  collapseProfile: {
    fallFt: 10|20|30,                   // scales with footprint
    damageDice: "2d10",                 // scales with size category
    nonlethal: true,                    // cap at 1 HP minimum
    knockbackFt: 5,
    triggerState: "breached"            // override: "damaged" for bridges
  },
  history:        [                     // last 10 state transitions for chat-card replay
    { at, dmg, fromState, toState, chipped, salvaged }
  ]
}
```

### Derivation pass (on BOM change + on damage)

```
Plates_max  = Σ(qty × familyCoef[family])
Threshold   = Σ(qty × tier × threshWeight[family]) ÷ Σ(qty)
Resists     = ⋃ nativeResists[family]
            + ⋃ tag-derived resists (hex / qliphothic / curse from material tags[])
loadBearing = (count of sephirotic-family units > 0)
```

## §3 — Structural families

One new field per material: `structuralFamily`. Assigned by override map (default heuristic from existing `tags[]` + name).

| Family | Plate coef | Threshold weight | Chip-N | Native resists | Authored in catalog |
|---|---|---|---|---|---|
| **Stone** | 4 | 1.0 | 8 | kinetic; weak to concussive | Mountain Stone, Anchorstone, Anchor Quartz, River Clay |
| **Metal** | 3 | 1.2 | 6 | kinetic + piercing; weak to heat | Scribed Steel, Cold-Iron, Heart-Iron, Bog-Iron, Rad-Iron, Sacred Gold, Soft Alloy, Ore Vein |
| **Ward** | 2 | 0.8 | 5 | *typed from material tags* (hex / qliph / curse) | Hex-Glyph Plate, Hex-Script, Witness Resin, Tree-of-Life Shard |
| **Wood** | 2 | 0.6 | 4 | flexible; weak to fire | Ash-Wood, Sept-Stamped Haft, Vow-Shaft |
| **Salvage** | 2 | 0.7 | 5 | unpredictable (roll quirk on chip) | Scrap Salvage, Pre-Fall Component, Heart-Coil |
| **Cloth** | 1 | 0.3 | 2 | low; lets blunt through | Sept-Cloth, Silence-Silk, Blessed Thread, Root Leather |
| **Memetic** | 1 | 0.5 | 3 | affects truth/witness rolls, not damage directly | Witness-Glass, Fogged Quartz, Memory Resin, Vow-Bone |
| **Sephirotic** | 3 | 1.5 | 10 | **LOAD-BEARING** — blocks transition to Razed | Yesodium, Tree-of-Life Shard (dual-tag with Ward) |

## §4 — Damage flow

Wedge at top of `game.fourththing.rolls.applyDamageFromButton` (canonical damage path per [[chat-apply-damage-canonical]]). If target has `hasStructure: true`, delegate to `applyStructureDamage`.

```
applyStructureDamage(target, dmg, sourceTags=[]):
  effDmg = applyResistsAndVulns(dmg, target.resists, sourceTags)   // ×0.5 / ×2

  if effDmg < Threshold:
    // Chip-only — paint, splinter, mortar dust. NO plate loss.
    chipMaterial(target, queue[0], 1)
    jitter = 1d4 - 1                       // 0..3 extra chips (locked rubble jitter)
    chipMaterial(target, queue[0], jitter)
  else:
    // Pierce
    platesLost = min(effDmg, plates.current)
    plates.current -= platesLost
    chipCount = floor(effDmg / chipN[family])  // walks the chip queue, family by family
    queueChips(target, chipCount)
    jitter = 1d4 - 1
    queueChips(target, jitter)                 // applies to whichever family is being chipped when jitter hits

  recomputeDerived(target)
  newState = stateFromPlates(target.plates, target.loadBearing)
  if newState !== state:
    transitionState(target, state, newState)   // chat card, VFX, Collapse if Breached
  emit hook "bbttcc:structure:damageApplied"
```

### Chip queue order

Fragile first, load-bearing last:

`Cloth → Wood → Salvage → Memetic → Ward → Metal → Stone → Sephirotic`

Within a family, lowest-Tier first. Stable alphabetic tiebreak.

### Rubble jitter

**Locked at `1d4 − 1` (0 to 3 extra chips).** Asymmetric upside for the attacker; rubble comes apart in unkind chunks. Considered `1d4 − 2` for symmetric jitter — rejected because chipping shouldn't spare material that damage already paid for.

## §5 — State machine + Collapse

| State | Plates % | Extra condition | Collapse fires? | Tokens-on-top effect |
|---|---|---|---|---|
| Intact | ≥75% | — | no | — |
| Damaged | 50–75% | — | no | — |
| **Breached** | 25–50% | — | **YES** | fall + prone + knockback |
| Razed | <25% | **AND** no sephirotic | no (already collapsed) | rubble persists; footprint becomes difficult terrain |

### Load-bearing lock

Plates may drop below 25%, but Structure **cannot** leave Breached for Razed while any Sephirotic-family unit remains in BOM. Fiction: Yesod is the foundation. You can rubble a sept; until the foundation stone shatters, it remembers itself. Mechanically: Yesodium and Tree-of-Life Shard are the most strategically prized defensive materials in the game, and give Bulwark Ruin to Renewal a specific narrative target (recover the foundation, the sept rebuilds).

### Collapse trigger

Fires once, on transition into Breached (or Damaged for bridges via `collapseProfile.triggerState`):
- Find tokens whose center lies inside Structure footprint (token.bounds ∩ structure.bounds)
- Roll `collapseProfile.damageDice` (default 2d10; scales 1d10 / 2d10 / 4d10 / 6d10 by size category)
- **Nonlethal cap** — damage cannot reduce target below 1 HP. This is the "less lethal takedown" hook
- Apply `prone` Active Effect (1 round)
- Knock `collapseProfile.knockbackFt` away from collapse origin
- GM-relay socket for non-owner targets (per [[crew-rig-combat-arc-2026-05-19-20]] relay pattern)
- Chat card: per-target apply-damage button with GM override
- Hook: `bbttcc:structure:collapse`

## §6 — Salvage payout

| Transition | Salvage to attacker | BOM remaining to defender |
|---|---|---|
| Intact → Damaged | 0% | rest intact |
| Damaged → Breached | **50%** of chipped material drops as Items into scene (or attacker's faction stockpile if siege-flagged) | rest of un-chipped BOM intact |
| Breached → Razed | **+25%** additional drops | rest is rubble (irrecoverable) |
| Bulwark **Catastrophic Entry** | **0%** (broke the latch, not the wall) | defender keeps everything not naturally chipped |
| Bulwark **Ruin to Renewal** (Faith/Economy DC 15) | n/a | **100%** of remaining BOM flows to defender or capturing faction stockpile — irreversible reclamation |

→ Bulwark's strategic identity at campaign level: the only class that can convert a fortification into stockpile without razing it. Catastrophic Entry = the safe entry; Ruin to Renewal = the post-battle reclamation. Both already in the dialog (see `ft-class-automation.js:openBreakerRuin`), now mechanically loaded.

## §7 — First 5 Structure recipes

Forge → Facility actor (Rig + `facilityMode: true` + BOM stamped).

| Structure | Footprint | BOM | Plates | Threshold | Resists | Special |
|---|---|---|---|---|---|---|
| **Sept Wall** (1 segment) | 6×1 | Mountain Stone ×12, Anchorstone ×6, Blessed Thread ×4, Yesodium ×1 | 67 | ~3.0 | kinetic, blessed, foundation | T1 faction unlock; baseline fortification |
| **Bunker Gate** | 4×2 | Scribed Steel ×10, Hex-Glyph Plate ×4, Yesodium ×2 | 44 | ~3.6 | kinetic+piercing, hex-resistant, warded, foundation | T2 unlock; canonical fortress entry |
| **Watchtower** | 2×2 (tall) | Ash-Wood ×8, Mountain Stone ×4, Hex-Iron Cleat ×2, Focusing Lens ×1 | 33 | ~1.6 | kinetic (partial), warded (light) | T1; +1 detection rolls in containing Hex |
| **Glyph-Ward Pylon** | 1×1 | Hex-Glyph Plate ×6, Sept Tuning Fork ×2, Tree-of-Life Shard ×1 | 17 | ~2.5 | hex-resistant++, qliphothic-resistant++, foundation | T3; radiates +1 ward resist to all adjacent Structures (stackable) |
| **Sept Bridge** | 8×1 | Mountain Stone ×8, Ash-Wood ×4, Cold-Iron ×3, Yesodium ×1 | 39 | ~2.4 | kinetic, foundation | T1; `collapseProfile.triggerState: "damaged"` — falling into the ravine is the whole point |

## §8 — Rig unification

Rig actors stamp `hasStructure: true` at create-time; BOM derived from chassis chip. Same damage path, same Forge integration.

| Chassis | BOM | Plates | Threshold |
|---|---|---|---|
| **Hexmobile** | Bog-Iron ×4, Ash-Wood ×2, Hex-Iron Cleat ×1 | 17 | ~1.7 |
| **ATR** (Assault Tactical Rig) | Scribed Steel ×6, Heart-Iron ×3, Cold-Iron ×2 | 33 | ~3.0 |
| **Pilot Mount** | Cold-Iron ×3, Ash-Wood ×2 | 13 | ~2.2 |

Small-arms damage (roll < Threshold) → cosmetic chip only, no Plate loss. **This is the solidity feel** — a Hexmobile shrugs off pistol rounds, an ATR shrugs off rifle rounds, only Rig-grade weapons or focused Manifestations meaningfully ablate either. Forge becomes the canonical campaign path to harden a Rig: spend stockpile, append to BOM, gain Plates + resist tags.

Per [[pack-stamp-vs-actor-copy-triggers]] — schema authoring on new Rigs must be paired with a retro-stamp macro for existing campaign Rigs (Phase E).

## §9 — Forge bridge

Four recipe modes, all share the existing `materialOf: [{materialKey, qty}]` grammar:

1. **Structure recipes** — consume from faction stockpile; spawn Facility actor. New "Fortifications" category in Forge UI.
2. **Harden recipes** — append materials to existing Rig/Facility BOM mid-campaign. "Reforge" tab on selected actor.
3. **Repair recipes** — refill chipped Plates by re-spending matching materials. **Per-family slice repair** — Hex-Glyph Plate chips can only be refilled with ward-family material (same key preferred; higher-tier ward acceptable at 1.5× cost penalty).
4. **Reclamation** — Bulwark Ruin to Renewal hooks Forge engine in reverse; recovered BOM lands in stockpile on successful DC.

**Material economy ring:** Hex Resource Nodes → faction stockpile → Forge → Structure/Rig BOM → combat attrition → salvage drops → back to stockpile. One loop.

## §10 — Module shape

```
bbttcc-structures/
├── module.json                          ("socket": true — V13 manifest gotcha per [[foundry-v13-socket-manifest]])
├── scripts/
│   ├── api.structures.js                game.bbttcc.api.structures.{stampBOM, applyDamage,
│   │                                        derive, transitionState, collapseFootprint,
│   │                                        dropSalvage, reclaim, recipes}
│   ├── damage-path-wedge.js             wedges applyDamageFromButton
│   ├── structure-sheet-panel.enhancer.js renders BOM grid on Rig/Facility sheet
│   ├── forge-recipes-structures.js      registers 5 starter Structure recipes
│   └── collapse-renderer.js             token VFX + chat card on transitions
├── data/
│   ├── structural-families.json         family coefficients, chip-N table, native resists
│   └── material-family-map.json         materialKey → family override (default heuristic)
└── STRUCTURE_DAMAGE_SPEC.md             this doc
```

API exposure pattern per [[bbttcc-api-exposure-pattern]]: install at both script-load AND `Hooks.once("ready")` to survive cache + load-order races.

## §11 — Sheet UI panel sketch

```
┌─ STRUCTURE ──────────────────────────────────────────┐
│  State: ◆ Damaged   Plates: ▰▰▰▰▰▰▰▰▱▱  32/44       │
│  Threshold: 3   Load-bearing: ⚜ (Yesodium ×2)        │
│                                                       │
│  MATERIAL BOM                              [Forge ▸]  │
│  ▰▰▰▰▰▰▰▱▱▱  Scribed Steel    Metal T3   7/10        │
│  ▰▰▰▰         Hex-Glyph Plate Ward  T3   4/4         │
│  ▰▰           Yesodium        ⚜Seph T3   2/2  LB     │
│                                                       │
│  RESISTS: kinetic · piercing · hex-resistant · warded │
│           · foundation-bound                          │
│                                                       │
│  [Harden] [Repair] [Reclamation (Bulwark)]            │
└──────────────────────────────────────────────────────┘
```

## §12 — Phase order

- **Phase A:** Module scaffold + schema + derivation + sheet panel (no damage path yet) — paper-test BOM math on real Rigs without combat consequences.
- **Phase B:** Damage-path wedge + state machine + Collapse trigger. Wedge into `applyDamageFromButton` per [[chat-apply-damage-canonical]].
- **Phase C:** Salvage drops + Bulwark Catastrophic Entry / Ruin to Renewal hookups. Modify `openBreakerRuin` dispatch in `ft-class-automation.js` to enrich the existing menu with target-structure context.
- **Phase D:** Forge recipes (5 starter Structures) + Harden + Repair UI. Hook into existing Forge engine.
- **Phase E:** Rig BOM auto-stamp at create-time (via `bbttcc-auto-link/scripts/rig-builder.js`) + retro-stamp macro for existing campaign Rigs.

## §13 — Bulwark class touchpoints (no new abilities needed)

Existing abilities that snap into this system without modification of mechanics — only of the dispatch context:

- **Catastrophic Entry** → bypasses Structure Threshold for the attacker; salvage payout drops to 0%
- **Siege Cost** → already speaks the right language ("−1 Violence OP this Siege") — Siege Raid Type sprint will define what this discount applies to
- **Shockwave Footing** → ripple effect into adjacent Structure tiles (1 extra chip per adjacent Structure on knockback)
- **Ruin to Renewal** → Forge engine reverse → 100% BOM reclamation to faction stockpile on Faith/Economy DC 15
- **Frame Dice** → unaffected; Bulwark personal armor stays on its existing Frame mechanic. Frame is the body's hardness; Structure BOM is the building's.
- **Anchor stance** (Cataclyst L5) → "cannot be moved" — interacts cleanly with Collapse knockback (Anchor immune)

## §14 — Scope fence (deferred to Siege Raid Type sprint)

- Multi-round structure attrition loop on the Raid Console
- Holdings tick-down cascade as Facilities go Breached/Razed (bridges to [[holdings-phase-d-2026-05-14]] neglect ticks)
- Coalition support-faction stockpile pooling for repairs mid-siege
- Defender pre-stage UI (stockpile materials to specific Facilities before siege starts)
- Attacker demolition-vs-capture strategic choice tooling
- Siege-specific maneuvers ("Sapper Mine", "Battering Ram", "Glyph-Breach Ritual")

The current spec gives the Siege sprint everything it needs to build on top: a Structure damage path that already speaks BOM, state, salvage, and Bulwark hookups. Forward-link: [[siege-raid-type]].

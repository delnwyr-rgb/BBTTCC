# BBTTCC Ancestry Refactor — v2.0 Migration Notes

**Date:** 2026-04-18
**Sprint:** Ancestry canon rebuild (per `fourththing/REFRACTOR_NOTES.md` step 2)
**Predecessor state:** `bbttcc-master-content` ancestries pack, v1.x
**Successor state:** `bbttcc-master-content` ancestries pack, v2.0

---

## Canon result — 8 ancestries

| # | Ancestry | Heritages / Subspecies |
|---|---|---|
| 1 | **Cryptidkin** *(new root)* | Chupacabra, Jackalope, Furrykin |
| 2 | **Echo-Diver** | — *(time-sense reframe; rats of the new world)* |
| 3 | **Menhirkin** | — *(living embodiment of sentient land)* |
| 4 | **Oldenborn** | Earthbound, Lumenwrought, Stormborn Nomad, Rustland Scavenger |
| 5 | **Human** | Cro-Magnon, Denisovan, Florensis, Neanderthal |
| 6 | **Qliph-Scarred** | — *(unchanged)* |
| 7 | **Sephirotic Scion** | — *(unchanged)* |
| 8 | **Circuitborn** | Exo-Knight, Parallax, Salvage, Synapse *(unchanged)* |

---

## File-level changes

### New files (drop into `packs/ancestries/`)

| File | Type | Notes |
|---|---|---|
| `cryptidkin.json` | species | New root. `_id: c9a7f1d26e3b4c81` |
| `cryptidkin_chupacabra.json` | feat | New subspecies. `_id: ck1chupa0heritg8` |
| `cryptidkin_jackalope.json` | feat | Demoted from species. Preserves `_id: yiZiL1OaWx9qX5bF` |
| `cryptidkin_furrykin.json` | feat | Consolidated from species + 5 sub-heritages. Preserves `_id: a2b5906bad32ad4c` |
| `human_cro_magnon.json` | feat | New. Replaces Erectus. `_id: hcromagn0h1tage8` |
| `human_denisovan.json` | feat | Converted from race-type to v2 heritage feat. Preserves `_id: TjBhlDjlMKL60wbo`. All 4 Tier grants baked in at levels 0/5/11/17. |
| `human_denisovan_tier1_high_altitude_blood.json` | feat | Tier I Denisovan power. `_id: FeRlU9VFJ5Yvhfnw` (preserved) |
| `human_denisovan_tier2_stone_singer.json` | feat | Tier II. `_id: KGKE4OFLm1YKA1X6` (preserved) |
| `human_denisovan_tier3_ancient_logic.json` | feat | Tier III. `_id: 79yheJC4yYIUTIHT` (preserved) |
| `human_denisovan_tier4_peak_anchor.json` | feat | Tier IV. `_id: h4Q4skT4ohrKa6z3` (preserved) |
| `oldenborn_stormborn_nomad.json` | feat | Demoted from species. Preserves `_id: nKHhfdL3U98tJj6r` |
| `oldenborn_rustland_scavenger.json` | feat | Demoted from species. Preserves `_id: bILvIQnnHx5eVzYb` |

### Updated files (overwrite existing)

| File | Change |
|---|---|
| `echo_diver.json` | Core reframed: Temporal Flinch, Niche Survivor, Vault Sight. "Rats of the new world" identity. Version → 2.0.0 |
| `menhirkin.json` | Reframed as sentient land. Heartstone binds to faction hex. Stone Memory → Land Memory. Added Sentient Land faction consult. Added Tremorsense 10. Version → 2.0.0 |
| `oldenborn.json` | Heritage list updated: Earthbound, Lumenwrought, Stormborn Nomad, Rustland Scavenger. Version → 2.0.0 |
| `human.json` | Heritage list updated: Cro-Magnon, Denisovan, Florensis, Neanderthal. Art swapped to Cro-Magnon. Version → 2.0.0 |

### Unchanged (no-op for this sprint)

- `circuitborn.json` + 4 clade heritages
- `qliph_scarred.json`
- `sephirotic_scion.json`
- `human_florensis.json`, `human_neanderthal.json`
- `oldenborn_earthbound.json`, `oldenborn_lumenwrought.json`

### Retire (move to `archive/retired-ancestries-v2/`)

| File | Reason |
|---|---|
| `jackalope.json` | Species demoted to Cryptidkin heritage; heritage file now carries the old `_id` |
| `stormborn_nomad.json` | Species demoted to Oldenborn heritage |
| `rustlander_scavenger.json` | Species demoted to Oldenborn heritage (renamed Rustland Scavenger) |
| `furrykin.json` | Species collapsed into Cryptidkin heritage; heritage file now carries the old `_id` |
| `furrykin_felid.json` | Clade collapsed into consolidated Furrykin heritage |
| `furrykin_leporid.json` | Clade collapsed |
| `furrykin_mustelid.json` | Clade collapsed |
| `furrykin_ursid.json` | Clade collapsed |
| `furrykin_vulpin.json` | Clade collapsed |
| `human_erectus.json` | Heritage replaced by Cro-Magnon |
| `oldenborn_sky_threaded.json` | Retired per refactor spec |
| `oldenborn_ember_touched.json` | Retired per refactor spec |
| `ancestries/echo-diver.json` *(dup)* | Stale duplicate of `echo_diver.json` |
| `ancestries/qliph-scarred.json` *(dup)* | Stale duplicate of `qliph_scarred.json` |
| `ancestries/hex-giant_menhirkin.json` *(dup)* | Stale duplicate of `menhirkin.json` |

---

## UUID preservation strategy

The three demoted species (Jackalope, Stormborn Nomad, Rustlander Scavenger) and the collapsed Furrykin root all **retain their original `_id`** on the new heritage items. Additionally, the Denisovan race item's `_id` is preserved on the new Denisovan heritage feat, and all 4 Denisovan Tier feats retain their original UUIDs. Existing character sheets that reference these UUIDs will continue to resolve — they'll just resolve to a `feat` instead of a `species`/`race`. This means:

- **Expected behavior:** a legacy PC with "Jackalope" as their species entry will, after this patch, resolve that reference to the Cryptidkin Heritage: Jackalope feat. The player will need to *add* Cryptidkin as their species root separately.
- **Not expected:** PC sheets going blank. The item lookup still finds something.

A world-side migration macro is recommended (see "Wiring macro" below).

---

## Placeholder Tier-I UUIDs

The following ItemGrant advancements reference placeholder Tier-I feat UUIDs that need to be wired after compendium import (standard BBTTCC pattern):

- `cryptidkin.json` → `CKCORETRAITPLACE` (core traits feat)
- `cryptidkin_chupacabra.json` → `CKCHUPATIER1PLC0`
- `human_cro_magnon.json` → `HCROMAGNONTIERI0`

Jackalope, Furrykin, Stormborn Nomad, and Rustland Scavenger heritages reuse **existing** Tier-I feat UUIDs from the legacy ancestries pack (already wired), so those should resolve immediately on import.

Denisovan ships with all 4 Tier feats in the patch pack (`FeRlU9VFJ5Yvhfnw`, `KGKE4OFLm1YKA1X6`, `79yheJC4yYIUTIHT`, `h4Q4skT4ohrKa6z3`) and resolves fully on import — no wiring needed.

Menhirkin and Echo-Diver keep their existing feat UUIDs; only descriptive text and `flags.bbttcc.version` changed.

### Tier-grant pattern inconsistency (flagged for future sprint)

**Denisovan is the only heritage in this pack that grants all 4 Tiers via advancements at levels 0/5/11/17.** All other heritages (Cro-Magnon, Florensis, Neanderthal, Earthbound, Lumenwrought, Stormborn Nomad, Rustland Scavenger, Jackalope, Furrykin, Chupacabra) only grant Tier I at level 0. Tier II/III/IV for those heritages are presumably handled by a separate wiring hook or class-level progression path.

This is preserved as-is because Denisovan's source file explicitly included all 4 grants and the other heritages' source files did not. Recommend a future consistency pass to either:
- (a) Backfill Tier II/III/IV grants on all heritages to match Denisovan, or
- (b) Strip Denisovan back to Tier I only and rely on the same external hook the other heritages use.

Do not resolve this inside the v2.0 ancestry sprint. Flag it for the Sorting Engine v2 / Character Wizard Step 0 sprint.

---

## Wiring macro (pseudocode)

Create a one-shot world macro to:

```js
// 1. For each legacy species _id that is now a heritage feat _id,
//    scan actors.world for PCs that have the item and log their state.
//    (They will already resolve; this is just visibility.)

// 2. Optionally, for PCs flagged as one of the demoted species,
//    auto-append the new root species (Cryptidkin or Oldenborn) to
//    their items list. Non-destructive; requires GM confirmation.

// 3. Wire the three new placeholder Tier-I UUIDs to their feats
//    once the Tier-I feat items are authored.

// 4. For retired Oldenborn heritages (Sky-Threaded, Ember-Touched)
//    and Erectus, flag affected PCs for GM review.
//    Do not auto-delete. Let the GM decide who becomes what.
```

Pattern precedent: the existing Furrykin wiring macro described in the legacy heritage files (`furrykin_felid.json` et al., note "Run the Furrykin wiring macro after you store feats/species in compendiums").

---

## In-world migration voice

For affected players, the in-fiction framing is:

> "The faction ledger got cleaner. Some names on the sheet didn't survive the audit. If your last sheet said *Erectus*, it now says *Cro-Magnon*. If it said *Sky-Threaded*, the GM gets to tell you what the land remembers you as now. If it said *Jackalope*, you already knew you were a rumor — now the paperwork agrees."

---

## Downstream systems that touch ancestries

Per `CURRENT_SPRINT.md` and userMemories, the following systems read from ancestry items. They should all continue to function without code changes, but spot-check after import:

- **Faction Creation Wizard** — species picker dropdown
- **Character Sheet (BBTTCC native)** — ancestry display in sidebar
- **Sorting Engine v1** — ancestry as a sort key
- **Strategic Hooks** — faction OP edges (opEffects flags read directly; Stormborn Nomad and Rustland Scavenger carry these on the new heritage items, so campaign-start OP bonuses still trigger)
- **Hex Synergy** — terrainSynergy flag (preserved)

The `Sorting Engine v2 + Character Wizard Step 0` sprint should treat this canon as the input for ancestry selection UX.

---

## Checklist before closing the sprint

- [ ] All 11 new/updated JSONs imported to `packs/ancestries/`
- [ ] 14 retire-list files moved to `archive/retired-ancestries-v2/`
- [ ] Three duplicate files (`echo-diver.json`, `qliph-scarred.json`, `hex-giant_menhirkin.json`) deleted from `ancestries/`
- [ ] Wiring macro authored for the three placeholder Tier-I UUIDs
- [ ] Cro-Magnon Tier-I feat authored (replaces Erectus Tier-I)
- [ ] Chupacabra Tier-I feat authored (new)
- [ ] Cryptidkin core-traits feat authored (new)
- [ ] Spot-check: faction wizard dropdown shows exactly 8 roots
- [ ] Spot-check: existing Jackalope / Stormborn / Rustland / Furrykin PCs still resolve their ancestry item
- [ ] `CURRENT_SPRINT.md` updated with ancestry v2.0 entry under "Locked Systems"

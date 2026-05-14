# Heritages v1.1 Drop — Changelog (2026-04-19)

Supersedes the v1.0 (Phase 2) bundle dropped earlier today. All 16 ancestry heritages now live as RFI-native wrappers + Tier I feats, built against the Phase 3 defense engine.

## What landed

**16 heritage wrappers** at `packs/heritages/` — overwrote 12 Phase 2 files (menhirkin/echo_diver/qliph_scarred/sephirotic_scion × 3) and added 4 new (Human Cro-Magnon/Denisovan, Oldenborn Stormborn Nomad/Rustland Scavenger).

**16 Tier I feat JSONs** at `packs/ancestries/` — one per heritage, linked via `ItemGrant` advancement. Placeholder UUIDs match Tier I `_id` values, so import with IDs preserved needs no wiring; else run the handoff macro (Part E of the handoff doc).

**Strategic Hooks** on every heritage — OP edge + hex synergy + per-turn faction ability. Readable by faction-layer code via `flags.bbttcc.opEffects`.

## Engine compatibility

All grants use the Phase 3 structured shape: `flags.fourththing.grants.resistances: [{type, flavor?}, ...]`. Entries can mix type-only strings and flavor-qualified objects. The engine honours both. Resistance distribution (8 of 16 heritages):

| Heritage | grants |
|---|---|
| Menhirkin (Igneous) | `[{type:"energy", flavor:"fire"}]` |
| Echo-Diver (Abyssal) | `[{type:"energy", flavor:"cold"}, {type:"kinetic", flavor:"thunder"}, "psychic"]` |
| Echo-Diver (Empyrean) | `[{type:"energy", flavor:"lightning"}, {type:"kinetic", flavor:"thunder"}, "psychic"]` |
| Echo-Diver (Tellurian) | `[{type:"energy", flavor:"fire"}, "poison"]` |
| Qliph-Scarred (Husk) | `["psychic"]` |
| Sephirotic Scion (Seraphic) | `[{type:"energy", flavor:"fire"}, "sephirotic"]` |
| Human (Denisovan) | `["poison"]` |
| Oldenborn (Rustland Scavenger) | `[{type:"poison", flavor:"inhaled"}]` |

Narrower flavor-qualified grants dodge the "resist all energy" blowout that killed the v1.0 design under RFI's 7-type consolidation.

## What was archived

**Phase 2 signature feats** — 12 files moved from `packs/ancestry_feats/` → `packs/ancestry_feats/.archive-phase2-superseded-2026-04-19/`. They lived in the wrong folder (the v1.1 convention puts tier feats in `packs/ancestries/`) and were superseded by the v1.1 tierfeats anyway.

**Legacy 5E Oldenborn tier1 stubs** — `oldenborn_rustland_tier1.json` and `oldenborn_stormborn_tier1.json` moved to `packs/ancestries/.archive-superseded-5e-tier1-2026-04-19/`. v1.1 uses the fuller slug names (`_scavenger` / `_nomad`).

**Pre-drop backups** — full copies of `packs/heritages/` and `packs/ancestries/` at `packs/.backup-pre-v11-2026-04-19-v11drop-{heritages,ancestries}/`.

## Still open (from handoff Appendix B)

- **TODO(core-item-auth)** — 4 new ancestry Cores (Menhirkin "The Land Stood Up", Echo-Diver "Half-Second Inheritance", Qliph-Scarred "What Walked Out", Sephirotic "The Higher Register") need standalone feat items on their base ancestry JSONs, matching Oldenborn's "Old Memory, Old Flesh" pattern. Fiction + mechanics are designed in Part B of the handoff; just need JSON authoring.
- **TODO(tier-ladder)** — Tier II / III / IV feats for the 12 new heritages. Reference heritages (Stormborn, Rustland, Cro-Magnon, Denisovan) already have tiers II–IV authored from the old 5E content.
- **TODO(adv-call)** — Metamorphic Pressure Remade needs playtest to finalize the 4-option daily-random resistance mapping.
- **Smoke test** — one character per heritage, verify Tier I granted at creation, resistances appear in `system.derived.defenses.resistances`, uses refresh on Soma Break, `flags.bbttcc.opEffects` reachable.
- **Art pass** — several heritage `img` paths reference files that may not exist yet; broken-image placeholder will render until art lands.

## 2026-04-19 follow-up — wizard wiring + GM compile macro (target: Ancestries pack)

**Making the heritages playable + selectable in the character wizard.** Heritages live alongside their root species item in the **BBTTCC Ancestries** compendium — no separate heritages compendium.

Three changes landed today:

1. **GM compile macro** at `modules/bbttcc-master-content/tools/compile-loose-packs.macro.js` — **folder-aware**. Walks both `packs/heritages/*.json` and `packs/ancestries/*.json` and imports each file into `bbttcc-master-content.ancestries`, keyed by `_id`. Items land in the matching folder tree: `{Family}/{Lineage} (Heritage)/Ancestry Features/` for tier feats, `{Family}/{Lineage} (Heritage)/` for heritage wrappers, `{Family}/` for ancestry Cores. Folders are matched case/space/dash-insensitively (so "Echo-Diver" = "Echo Diver" = "echo_diver") and created if missing. Existing items skipped; flip `UPDATE_EXISTING = true` at the top to overwrite.
2. **No new compendium registered** — the `packs/heritages/` folder is source-only; Foundry doesn't load it as a pack. Heritages end up in the Ancestries compendium at import time and can be organized under each ancestry's folder manually.
3. **Wizard query unchanged** — `bbttcc-auto-link/scripts/character-wizard.js` already queries `bbttcc-master-content.ancestries`. Heritages there (identified by `flags.bbttcc.kind === "heritage"` / `identifier ending _heritage`) get filtered by `flags.bbttcc.family` against the selected species automatically.

### Partner steps to flip everything live — TWO macros, run in order

**IMPORTANT:** My earlier base-ancestry edits went to loose JSON files at `packs/*.json` (root) which aren't in a registered compendium. The live base-ancestry items sit in `packs/ancestries/*.ldb`. Macro 2 below patches those LDB items directly by `system.identifier`.

1. **Restart Foundry** if you haven't already (module.json changed on the previous drop — the empty Heritages LDB was initialized on that restart).
2. Confirm a **BBTTCC Heritages** compendium appears in the sidebar (empty, but present).
3. **Macro 1 — Compile Loose JSONs:**
   - Create a new **Script** macro named `BBTTCC Compile Loose JSONs`.
   - Paste the full contents of `modules/bbttcc-master-content/tools/compile-loose-packs.macro.js`.
   - **Save & Execute.** Expect the chat card to show: Heritages pack created ~16, Ancestries pack created ~20 (16 tier1 feats + 4 Cores).
4. **Macro 2 — Patch Base Ancestries:**
   - Create a second **Script** macro named `BBTTCC v1.1 Base-Ancestry Patch`.
   - Paste the full contents of `modules/bbttcc-master-content/tools/update-base-ancestries.macro.js`.
   - **Save & Execute.** Expect the chat card to show: Menhirkin / Echo-Diver / Qliph-Scarred / Sephirotic Scion each with `added core, dropped [4 old titles]`.
5. Re-run either macro whenever loose JSONs land or base-ancestry wiring shifts — both are idempotent.

### Smoke test (from handoff Part E)

After compile:

- Open the **BBTTCC Character Wizard**, pick **Echo-Diver** as species → heritage step should show **Abyssal / Empyrean / Tellurian** filtered by family.
- Pick **Abyssal** → create the character.
- On the sheet, verify:
  - Tier I feat **Tide Recall** appears in the feat list.
  - Derived defenses chip strip shows resist chips for **energy (cold), kinetic (thunder), psychic**.
  - `flags.bbttcc.opEffects` readable via `actor.getFlag("bbttcc-factions", ...)` or the faction-layer hook.
- Click **Soma Break** → any 1/Soma-Break tier-I uses should reset.
- Repeat for one character per family (Menhirkin / Qliph-Scarred / Sephirotic / Human / Oldenborn).

### Notes

- The new heritages pack label renders as "BBTTCC Heritages" in the compendium sidebar.
- If you see the chat summary with `errored > 0`, check the browser console — the per-file log line names the exact file + reason (usually a malformed `_id` or a duplicate from a prior partial run).
- The macro also compiles the 16 Tier I feats + 4 Cores that have been sitting as loose JSONs in `packs/ancestries/` since the earlier drops. Expect those in the first-run "created" column too.

## 2026-04-19 follow-up — 4 ancestry Cores landed

TODO(core-item-auth) closed. Four new consolidated Core feats authored per v1.1 handoff Part B, matching the Oldenborn "Old Memory, Old Flesh" pattern (one Core per ancestry bundling all traits).

**New files** in `packs/ancestries/`:

| File | Core id | Grants |
|---|---|---|
| `menhirkin_core.json` | `7kH3xU2kPkLufnd4` | — (narrative only) |
| `echo_diver_core.json` | `nwrNGGcXK4BiamPn` | — (narrative only) |
| `qliph_scarred_core.json` | `8tR9NvqX4X69JIEb` | `resistances: [{type: "qliphothic"}]` |
| `sephirotic_scion_core.json` | `CBbxY2PqvDYxL57J` | `resistances: [{type: "sephirotic"}]` |

**Base ancestry rewiring:**
- `menhirkin.json` — dropped per-trait Cores (Heartstone, Stone Memory, Gravity Well, Living Rampart); added consolidated Core. Kept Size, Stonebound, Strategic Hooks.
- `echo_diver.json` — dropped per-trait Cores (Amphibious Physiology, Echo Sense, Spark Conductor, Temporal Afterimage, Vault Sight); added consolidated Core (Vault Sight is now inside the Core per v1.1). Kept Size, Strategic Hooks.
- `qliph_scarred.json` — dropped per-trait Cores (Shadow Resilience, Qliphothic Saturation, Hunger Mask, Shadow-Wake); added consolidated Core. Kept Size, Strategic Hooks.
- `sephirotic_scion.json` — dropped per-trait Cores (Sephirotic Physiology, Sefirot Attunement, Holy Conduit, Light of Harmony); added consolidated Core. Kept Size, Strategic Hooks.

**Engine impact:** Qliph-Scarred and Sephirotic Scion heritages now grant baseline qliphothic / sephirotic resistance to *all* members of the ancestry via the ancestry Core. Heritage-specific resistance grants (e.g., Seraphic's `{type:"energy", flavor:"fire"}` + `sephirotic`) stack on top — the Phase 3 engine dedupes, so there's no double-application.

**Legacy** — The old granular per-trait Core items remain in the LDB as orphans. PCs created before this change keep whatever trait items they already have. Fresh PCs get the new consolidated Core. No destructive action taken on the LDB.

## Post-import wiring

If Foundry regenerated document IDs during import (shouldn't happen if `_id` values are preserved), run the macro from Part E of `BBTTCC_Heritages_v1.1_Handoff.docx` to rebind heritage → tier1 ItemGrant UUIDs by slug match.

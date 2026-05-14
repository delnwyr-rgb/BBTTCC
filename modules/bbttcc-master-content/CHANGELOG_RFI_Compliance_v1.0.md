# BBTTCC → RFI Compliance Sweep — v1.0

**Date:** 2026-04-19
**Scope:** Part A system features + Part B skills + Part C content sweep (Parts 1–7 of the handoff).
**Reference:** `BBTTCC_RFI_Compliance_Sweep_Handoff_v1.0.docx`

## Summary
Brought the `fourththing` system and the `bbttcc-master-content` module into RFI compliance. Three new system features shipped; 1,408 content JSONs swept; all LevelDB packs rebuilt.

## Part A — New system features (fourththing)

### A1. Canonical damage types
Collapsed 5 types → 7. Elemental variants fold into `energy`; radiant/necrotic renamed to sephirotic/qliphothic; added new `radiation` track that increments `system.radiation.rp` instead of decrementing a pool.
- `module.js:1397` — `FT.DAMAGE_TYPES` replaced with the 7-type table.
- `module.js:2089` — `applyDamageFromButton` branches on track; radiation accumulates and reports threshold crossings.
- `module.js:1030` — damage-type select picks up the new types automatically; Track select gained a `Radiation` option.
- `template.json` — weapon gained `damageFlavor`; power gained `damageType` and `damageFlavor`.
- `ft-translation.js` — pre-fold rules added for fire/cold/lightning/acid/thunder → energy, radiant → sephirotic, necrotic/darkness → qliphothic, bludgeoning/piercing/slashing/force → kinetic.

### A2. Exploding dice + Surge pool
Unified roll protocol replaces advantage/disadvantage. 10s explode, each explosion banks +1 Surge; double-10 on base dice flags a bonus action ("Act Again").
- `ft-progression.js:67` — `skillRollWithRank` rewritten with `explodeFromBase` helper; handles floor-4 and reroll-low adjustments cleanly before the explosion pass; Master/Legendary roll 3d10 keep best 2 with per-die chain totals.
- `template.json` — `resources.surge` added to character actor type.
- `character-sheet.hbs` — Surge counter panel added under Action Economy; "Act Again" button shows when `flags.fourththing.bonusActionAvailable` is set; Spend menu dialog wires 1/2/3/5 Surge options.
- `module.js` — `_onFtActAgain`, `_onFtSurgeSpend` handlers registered; `ftFlags` exposed on the sheet context.

### A3. Soma Break
One-ceremony refresh replaces short/long rest. Resets item uses, clarity, all resource dice, burn, forge, Integrity, Stress, Surge. Soft GM gate via dialog confirm on same-scene repeat.
- `module.js` — `game.fourththing.actions.somaBreak(actor, { confirmed })` added.
- `character-sheet.hbs` — ❈ Soma Break button added to the level-actions row.
- `_onFtSomaBreak` handler registered.

## Part B — Engagement + Armor skills

### B1. Engagement skills
Already present in template.json: `brawl` · `melee` · `firearms`. No change.

### B2. Armor skills (new)
- `template.json` — `plating` (Body), `weave` (Intrigue), `warding` (Soul) added under Actor.character.skills.
- `template.json` — armor item template gained `armorSkill: "weave"` (default) and `equipped: true` fields.

### B3. Rank-scaled armor bonus
- `module.js` — `FT.ARMOR_RANK_SCALE` table added (0 = nothing, 1 = half, 2 = full, 3 = full+1, 4 = full+2, 5 = full+3).
- `module.js` — `ftComputeArmorBonus(actor, sys)` helper sums contributions across all equipped armor items, respecting the wearer's rank in each item's declared `armorSkill`.
- `module.js` — `prepareDerivedData` now calls `ftComputeArmorBonus` and applies the deltas to guard/evasion/resolve; stashes breakdown on `system.derived.armorBreakdown`.
- Scene-trigger mechanics (Master reroll, Legendary auto-success) are deferred — see TODO(armor-scene).

## Part C — Content sweep

### Files swept
- `packs/ancestries/` — 59 loose JSONs (40 modified).
- `packs/heritages/` — 16 loose JSONs (15 modified).
- `packs/ancestry_feats/` — 48 loose JSONs (swept).
- `packs/classes/` — 364 JSONs (unpacked → swept → repacked).
- `packs/items/` — 514 JSONs (unpacked → swept → repacked).
- `packs/doctrines/` — 127 JSONs (unpacked → swept → repacked).
- `packs/npcs/` — 30 JSONs (unpacked → swept → repacked).
- `packs/documentation/` — 63 JSONs (unpacked → swept → repacked).
- `packs/scenes/` — 189 JSONs (unpacked → swept → repacked).
- `packs/vehicles/` — 5 JSONs (unpacked → swept → repacked).
- `packs/subclasses/` — LevelDB was empty (no entries to sweep).
- `archive/` — skipped per handoff.

### Sweep totals
- **Files processed:** 1,408
- **Files changed (pass 1 + pass 2):** ~570 unique
- **Strings translated:** 1,025 (808 pass 1 + 217 pass 2)
- **LevelDB packs repacked:** 7

### Voice preservation
Mal dialogue in-quote (`"..."` and curly `"..."`) is skipped by the translator. Mechanical terms outside quotes are swept per Part C rulebook (stats, derived stats, skills, saves, magic vocab, damage types, conditions, advantage/disadvantage, PB, rest mechanics).

### Known sweep limitations
- `advantage on <html-tag>...` patterns where a tag breaks the phrase aren't fully caught. Single residual in `classes/Workshop_Demi_Sanctum_...json` — flag and hand-edit during smoke test.
- 11 strings in Phase 5 were parsed but their exact JSON encoding differed from the raw source text (likely alternate unicode escapes); they were translated in-memory but not written. Re-running the sweep after a second file-parse round will catch these if needed.

## TODO cluster summary

| Tag | Count | Scope |
|-----|-------|-------|
| TODO(adv-call) | 231 | Designer review needed on advantage-replacement calls. Default applied: "reroll the lowest die" / "roll 3d10 keep lowest 2". |
| TODO(pb-call) | 96 | Designer review needed on proficiency-bonus replacement. Default applied: `tier` (details.tier). |
| TODO(death-mech) | 3 | Residual death-save references. Death/dying/reincarnation system unimplemented — future sprint. |
| TODO(feat-acq) | — | Feat acquisition system unimplemented — content can reference feats; no ceremony. |
| TODO(identity-swap) | — | No respec UI. Future sprint. |
| TODO(resist-runtime) | — | Content authors correct resistance types but damage pipeline may not apply `armor.resistances` yet. |
| TODO(armor-scene) | inline | Master/Legendary armor-rank scene triggers not yet wired. |

## Smoke test checklist
1. Open a character, roll a skill check; verify 10s chain and Surge increments.
2. Roll two 10s on base dice; verify "Act Again" button appears.
3. Spend Surge via the menu; confirm chat message and value decrement.
4. Press ❈ Soma Break; verify item uses, clarity, integrity, stress, surge all reset; confirm second press in same scene prompts.
5. Equip an armor item with `armorSkill: "plating"`; raise the wearer's Plating rank; verify guard scales per table.
6. Apply damage from a chat button with a radiation-type weapon; verify `system.radiation.rp` increments and thresholds log.

## Defaults applied (Appendix A)
- PB replacement → `tier`.
- Advantage replacement → reroll lowest die / 3d10 keep lowest 2.
- damageFlavor fallback → empty, not guessed.
- Armor retrofit → heavy→plating, light/med→weave, unarmored→warding (pending per-item designer pass).
- Resistance runtime wiring → deferred to a separate sprint.

— End of v1.0 changelog.

# BBTTCC Heritages v1.0-rfi — Phase 2 Drop Notes

**Date:** 2026-04-19
**Scope:** 12 heritages (Menhirkin, Echo-Diver, Qliph-Scarred, Sephirotic Scion × 3 lineages) + 12 signature feats, ported from the original D&D5E design doc to Roll for Initiation (fourththing) vocabulary.

## What changed vs. the original design doc

- Translated all rules text to RFI canon: **Soma Break** replaces short/long rest; **Tier** replaces proficiency bonus; **reroll-lowest** replaces advantage; attribute-defense saves (Guard / Evasion / Resolve DC = 10 + attr + attr) replace D&D save-DC formulas; the 7 damage types replace the D&D 13.
- Applied the **Option-C variety pass** for resistance grants: only 4 of 12 heritages grant a damage-type resistance via the Phase 1 defense engine. The rest get non-resistance boons (defense-pick, +Tier to initiative, narrative immunities, reroll-lowest riders) so no triad is "the resist one."
- Wired the Phase 1 engine via `flags.fourththing.grants.{resistances, immunities}` on each heritage item. The `FourthThingActor.prepareDerivedData` pipeline aggregates these into `system.derived.defenses` and the damage application pipeline applies x0 immunity / x½ resistance automatically on click.

## Resistance distribution (Phase 1 engine grants)

| Heritage | Grants |
|---|---|
| Menhirkin (Igneous) | resist **energy** |
| Echo-Diver (Abyssal) | resist **psychic** |
| Qliph-Scarred (Husk) | resist **psychic** |
| Sephirotic Scion (Seraphic) | resist **sephirotic** |

The other 8 heritages grant no engine resistance. Menhirkin (Sedimentary) lets the player pick **one** of {energy, poison, qliphothic} at creation — the GM toggles it on the sheet's base-defenses editor chip row in edit mode (Phase 1 UX).

## Deferred to Phase 3

- **Vulnerability primitive** — Diabolic's "cold iron cost" stays narrative.
- **Flavor-level carve-outs** — Igneous's Molten Bearing damage is "energy with fire flavor" but the engine doesn't read `damageFlavor` yet.
- **Condition immunity** — Cherubic's "immune to magical sleep" and Tellurian's "cannot be forced-moved / cannot be knocked prone" are narrative until the condition-and-flavor engine lands.
- **Duration-gated resistance** — Chthonic's Underworld Passage "half qliphothic damage during passage" is narrative; the engine only does flat resistance grants right now.

## Post-import wiring

After the 24 JSONs are imported into the `bbttcc-master-content.ancestries` LevelDB compendium, the heritage ItemGrant placeholder UUIDs need no change — the signature feats were authored with `_id` values matching the placeholders in the design doc:

| Heritage | Signature `_id` |
|---|---|
| menhirkin_igneous | `MENIGNEOUSTIER1P` |
| menhirkin_metamorphic | `MENMETAMORPHTR1P` |
| menhirkin_sedimentary | `MENSEDIMENTTR1PL` |
| echo_diver_abyssal | `EDABYSSALTIER1PL` |
| echo_diver_empyrean | `EDEMPYREANTR1PLC` |
| echo_diver_tellurian | `EDTELLURIANTR1PL` |
| qliph_scarred_husk | `QLHUSKTIER1PLACE` |
| qliph_scarred_diabolic | `QLDIABOLICTIER1P` |
| qliph_scarred_chthonic | `QLCHTHONICTR1PLC` |
| sephirotic_scion_cherubic | `SSCHERUBICTR1PLC` |
| sephirotic_scion_ophanic | `SSOPHANICTIER1PL` |
| sephirotic_scion_seraphic | `SSSERAPHICTIER1P` |

All ids are 16 chars alphanumeric, so they satisfy Foundry's document-id constraint.

## Known canon drift still open

1. Retired heritages in this folder (`oldenborn_sky_threaded`, `oldenborn_ember_touched`, `human_erectus`, and the five Furrykin clades) are still physically present — the ANCESTRY_CANON_v2.0 pass retires them at the species-picker level but did not delete the files.
2. Missing heritage wrappers noted in the design doc: Oldenborn (Stormborn Nomad / Rustland Scavenger), Human (Cro-Magnon / Denisovan). Not in Phase 2 scope.
3. Each base ancestry JSON (`../menhirkin.json` etc.) should list its heritages in the description. Small edit pass, not done yet.

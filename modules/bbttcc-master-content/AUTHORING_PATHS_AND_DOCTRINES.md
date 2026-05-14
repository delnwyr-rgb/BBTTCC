# Authoring Paths & Doctrines (BBTTCC RFI)

This guide is for GMs adding a new **Path** (class) or **Doctrine** (subclass) to BBTTCC. It documents the canonical folder layout, file-naming conventions, and the level-stamping workflow that the in-game **+ Apply Path Features** button relies on.

> **TL;DR** Put your loose JSON sources under `packs/classes/<your-path>/{class-features,<doctrine-folder>}/` using the canonical filenames (`tier_N_*.json`, `l01_*.json` etc.), then run `node tools/stamp-loose-source-levels.mjs` and the in-Foundry `stamp-prerequisite-levels.macro.js`. That's it.

---

## 1. Folder layout

```
packs/classes/
  <your-path-id>/                  e.g. bulwark, shadow_courier, pactkeeper
    class-features/                Path-wide features (granted to anyone in the path)
      tier_1_<slug>.json           Tier 1 features (granted at level 1)
      tier_2_<slug>.json           Tier 2  (level 6+)
      tier_3_<slug>.json           Tier 3  (level 11+)
      tier_4_<slug>.json           Tier 4  (level 16+)
    <doctrine-folder>/             One folder per doctrine
      l01_<slug>.json              Doctrine L1 feature
      l05_<slug>.json              L5
      l09_<slug>.json              L9
      l13_<slug>.json              L13
      l17_<slug>.json              L17
```

Every doctrine folder name is a slugified doctrine name (`path-of-the-avalanche`, `route-of-the-wayfarer-tongue`). Each doctrine has exactly **5 features** at L1 / L5 / L9 / L13 / L17 — the cadence in `SUBCLASS_FEATURE_LEVELS`.

---

## 2. Filename → unlock level

| Filename pattern | Unlocks at level |
|---|---|
| `tier_1_*.json` | 1 |
| `tier_2_*.json` | 6 |
| `tier_3_*.json` | 11 |
| `tier_4_*.json` | 16 |
| `l01_*.json` | 1 |
| `l05_*.json` | 5 |
| `l09_*.json` | 9 |
| `l13_*.json` | 13 |
| `l17_*.json` | 17 |

**The filename is canon.** The stamping tool reads the filename, computes the level, and writes it to `system.prerequisites.level` on the JSON. The runtime grant filter (`applyPathFeatures` in `systems/fourththing/ft-progression.js`) then reads that one structured field.

---

## 3. Required item fields

A feature item is a Foundry `feat`. Minimum viable shape (see `tools/templates/path-feature.json` for a full skeleton):

```json
{
  "name": "Avalanche L1: Kinetic Inversion",
  "type": "feat",
  "img": "icons/svg/wing.svg",
  "system": {
    "category": "technique",
    "identifier": "bulwark_avalanche_l1_kinetic_inversion",
    "requirements": "Bulwark Initiation 1",
    "prerequisites": { "items": [], "repeatable": false, "level": 1 },
    "description": { "value": "<p>(1st Level) ...</p>", "chat": "" },
    "advancement": {},
    "uses": { "spent": 0, "recovery": [], "max": "" },
    "activities": {}
  },
  "effects": [],
  "flags": { "bbttcc": { "kind": "classfeat" } }
}
```

**Naming canon for `name` and `identifier`:**

- Class features: `<Path> — Tier N: <Feature>` (e.g. *Bulwark — Tier 1: Founding Stance*)
- Doctrine features: `<Doctrine> L<N>: <Feature>` (e.g. *Avalanche L1: Kinetic Inversion*)
- Identifiers: lowercase snake_case mirroring the name, with explicit `_tier1_` or `_l01_` segment

Following the canon means even pre-stamp content stays parseable by the regex fallbacks in `deriveItemUnlockLevel`.

---

## 4. Authoring workflow

1. **Copy** a template from `tools/templates/` and rename it.
2. **Fill in** name, identifier, description, requirements, and activities.
3. **Place** the file under the correct `packs/classes/<your-path>/...` folder.
4. **Stamp** loose sources:
   ```bash
   cd modules/bbttcc-master-content
   node tools/stamp-loose-source-levels.mjs --dry   # preview
   node tools/stamp-loose-source-levels.mjs         # write
   ```
5. **Compile** the loose sources into the LevelDB pack via `tools/compile-loose-packs.macro.js` (run inside Foundry as a Script macro).
6. **Stamp the live pack** as a safety net (catches anything a non-canonical file might have missed):
   - Open `tools/stamp-prerequisite-levels.macro.js` in a Foundry Script macro.
   - Run with `DRY_RUN = true` first. Review the console report.
   - Flip to `DRY_RUN = false` and re-run.
7. **Verify** by creating a new Tier-1 character of your path/doctrine, then clicking **+ Apply Path Features** on the Steward tab. Only L1 features should land.

---

## 5. How granting actually works

There is **no auto-grant on level-up** today. The grant pipeline is:

| Trigger | Source | Behavior |
|---|---|---|
| Character creation (Tree Wizard v2) | `bbttcc-auto-link/scripts/character-wizard.js` → `collectLevelOneGrants` | Reads the class/path/heritage doc's `system.advancement` array for `ItemGrant` entries at level ≤ 1. |
| `levelUp()` dialog | `systems/fourththing/ft-progression.js` → `levelUp` | Bumps stats, awards skill points, picks a Technique. **Does not grant features.** |
| **+ Apply Path Features** button | `systems/fourththing/ft-progression.js` → `applyPathFeatures` | Walks the class+doctrine folders, dedupes by name, gates by `deriveItemUnlockLevel` against the actor's tier and level. |

So after a tier-up, the player (or GM) clicks **+ Apply Path Features** and the new tier's items are pulled in. Re-clicking is harmless — name-based dedup skips what's already on the sheet.

---

## 6. Future migration: auto-grant on level-up

If you want to retire the manual button, populate the path doc's `system.advancement` with `ItemGrant` entries pointing to each feature's compendium UUID at the right level. The dnd5e ItemGrant pipeline is already wired through `collectLevelOneGrants` for L1; extending it to all levels means generalizing that helper to walk every tier and calling it from `levelUp()`. The `deriveItemUnlockLevel` helper can pre-compute the level → UUID map for any path.

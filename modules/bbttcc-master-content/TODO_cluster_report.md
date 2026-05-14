# RFI Compliance Sweep — TODO Cluster Report

**Generated:** 2026-04-19
**Scope:** Files flagged by the sweep for designer review before sign-off.

## How to use
Each entry lists a file path + the pattern that triggered the flag. Grep to find the exact line. Batch-review with Dave then bulk-patch once calls are locked in.

---

## TODO(adv-call) — 231 instances
Advantage/disadvantage replacement applied the default (reroll lowest / 3d10 keep lowest 2). Designer may want a different mechanic per instance.

### Top affected dirs
- `packs/classes/` — 57 files
- `packs/items/` — 65 files
- `packs/npcs/` — 12 files
- `packs/scenes/` — 3 files
- `packs/documentation/` — 2 files
- `packs/vehicles/` — 1 file

### Grep to list
```bash
grep -rl "TODO(adv-call)" --include="*.json" \
  /tmp/bbttcc_unpack \
  "/Users/gamingaccount/Library/Application Support/FoundryVTT/Data/modules/bbttcc-master-content/packs/"
```

### Per-instance triage options
Per Part C.2 of the handoff:
- (a) grant +1 skill rank to [X] for this roll — scene-scoped
- (b) reroll the lowest die, keep new result — **default applied**
- (c) +2 to the roll — minimal option
- (d) resistance rewrite — when phrased as "advantage on saves vs X"

---

## TODO(pb-call) — 96 instances
PB/proficiency bonus replaced with `tier` (details.tier, 1–4). Designer may prefer a specific attribute value per context.

### Top affected dirs
- `packs/classes/` — 44 files
- `packs/items/` — 13 files
- `packs/npcs/` — 3 files

### Per-instance triage options
- Replace with a specific attribute (e.g., `+Soul modifier` when flavor suggests mental fortitude)
- Replace with a fixed number per tier table
- Remove entirely if the bonus is redundant with tier progression

---

## TODO(death-mech) — 3 instances
Death-save references flagged; death mechanic is unimplemented. Placeholder: "last stand check".

### Affected files
Find with:
```bash
grep -rl "TODO(death-mech)" --include="*.json" \
  /tmp/bbttcc_unpack \
  "/Users/gamingaccount/Library/Application Support/FoundryVTT/Data/modules/bbttcc-master-content/packs/"
```

### Scope hint
Part of a future sprint covering dying/reincarnation design. Leave flags in place until the mechanic exists.

---

## TODO(feat-acq)
No feat-slot budget exists yet. Feats are drag-and-drop only. Content can reference feats but there's no ceremony for earning them.

### Scope hint
Add a feat-slot budget per level/tier; wire into the level-up flow.

---

## TODO(identity-swap)
No UI for swapping class/ancestry/archetype/heritage on an existing character.

### Scope hint
Design a respec flow; preserve XP and character history.

---

## TODO(resist-runtime)
The content sweep authors correct RFI resistance types (kinetic/energy/poison/psychic/sephirotic/qliphothic/radiation) on armor items. The damage pipeline in `module.js:applyDamageFromButton` does **not** currently consume `armor.resistances`. Content is forward-compatible.

### Scope hint
Audit the damage path. When an actor is hit with a type listed in any equipped armor's `resistances` array, halve (or zero) the incoming damage. Respect the armorSkill rank gate — unworn-correctly armor grants nothing.

---

## TODO(armor-scene)
Master (rank 4) and Legendary (rank 5) armor scene triggers not yet wired:
- Master: once per scene when hit, shift to "reroll lowest" OR "floor 4" on the attacker's roll.
- Legendary: scene-trigger becomes auto-success on the defense check, 1/scene.

### Scope hint
Add a scene-scoped counter per (actor, armor-item) pair; expose a button on the character sheet under the armor row.

---

## Ongoing handoff gaps
From Appendix B of the handoff:

### heritage canon drift
`packs/heritages/` still contains retired entries (sky_threaded, ember_touched, erectus, 5 furrykin clades). Canonical Oldenborn and Human heritage wrappers are missing.

### signature feat authoring
12 heritage signature features shipped 2026-04-19 reference placeholder UUIDs. Feat items need authoring + wiring macro.

— End of TODO report.

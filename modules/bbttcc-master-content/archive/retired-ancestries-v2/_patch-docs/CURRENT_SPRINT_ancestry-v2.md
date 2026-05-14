# CURRENT_SPRINT.md — Ancestry Canon v2.0 Refactor (Parallel Sprint)

## Sprint Goal
Simplify the ancestry canon from ~10 roots with uneven subspecies coverage down to **8 canonical ancestries** with clean heritage trees. Player-facing, GM-facing, and Foundry-facing truth all aligned.

## Status: PATCH PACK DELIVERED — Ready for apply + wire

Patch contents live under `bbttcc-ancestry-v2-patch.zip`:
```
bbttcc-ancestry-v2-patch/
├── packs/ancestries/        # 11 JSONs (7 new/updated roots + 4 heritages)
├── docs/
│   ├── MIGRATION_NOTES.md   # File-level diff, retire list, wiring checklist
│   └── ANCESTRY_CANON_v2.0.md   # Mal-voice player-facing canon doc
└── archive/retired-ancestries/  # (empty — this is the destination for retires)
```

## Canon Result — 8 Ancestries

| Ancestry | Heritages |
|---|---|
| **Cryptidkin** *(new)* | Chupacabra, Jackalope, Furrykin |
| **Echo-Diver** | — |
| **Menhirkin** | — |
| **Oldenborn** | Earthbound, Lumenwrought, Stormborn Nomad, Rustland Scavenger |
| **Human** | Cro-Magnon, Denisovan, Florensis, Neanderthal |
| **Qliph-Scarred** | — |
| **Sephirotic Scion** | — |
| **Circuitborn** | Exo-Knight, Parallax, Salvage, Synapse |

## Key Changes Summary

- **Cryptidkin** absorbs Jackalope (species→heritage), Furrykin (species + 5 clade heritages consolidated→1 heritage), and introduces Chupacabra (new heritage).
- **Echo-Diver** reframed around time-sense / survival niche. Identity: "rats of the new world." Added Temporal Flinch, Niche Survivor.
- **Menhirkin** reframed as living embodiment of sentient land. Heartstone binds to faction-controlled hex. Added Sentient Land consult hook and Tremorsense 10.
- **Oldenborn** loses Sky-Threaded and Ember-Touched. Gains Stormborn Nomad and Rustland Scavenger (both demoted from species).
- **Human** retains Florensis, Neanderthal, and **Denisovan** (preserved from v1 canon with all 4 Tier feats bundled). Loses Erectus. Gains Cro-Magnon (symbolic thought, coalition, tool-mind).
- **Circuitborn, Qliph-Scarred, Sephirotic Scion** unchanged (no instruction to modify).

## UUID Preservation

Old `_id` values retained on demoted/consolidated heritages:
- Jackalope `yiZiL1OaWx9qX5bF` → Cryptidkin Heritage: Jackalope
- Furrykin `a2b5906bad32ad4c` → Cryptidkin Heritage: Furrykin
- Stormborn Nomad `nKHhfdL3U98tJj6r` → Oldenborn Heritage: Stormborn Nomad
- Rustlander Scavenger `bILvIQnnHx5eVzYb` → Oldenborn Heritage: Rustland Scavenger
- Denisovan `TjBhlDjlMKL60wbo` → Human Heritage: Denisovan (plus all 4 Tier feats preserved)

Legacy PC sheets referencing these UUIDs will still resolve (to a feat instead of a species). Players will need to add the root species separately; no blank sheets expected.

## Placeholder Tier-I UUIDs (need wiring)

- `CKCORETRAITPLACE` — Cryptidkin core-traits feat
- `CKCHUPATIER1PLC0` — Chupacabra Tier I
- `HCROMAGNONTIERI0` — Cro-Magnon Tier I

Jackalope / Furrykin / Stormborn Nomad / Rustland Scavenger heritages reuse existing (wired) Tier-I UUIDs from the legacy pack.

## Apply Checklist

- [ ] Copy 11 JSONs from patch to `bbttcc-master-content/packs/ancestries/`
- [ ] Move 14 retire-list files to `archive/retired-ancestries-v2/` (see MIGRATION_NOTES.md for full list)
- [ ] Delete duplicate stubs: `echo-diver.json`, `qliph-scarred.json`, `hex-giant_menhirkin.json`
- [ ] Author 3 new Tier-I feats (Cryptidkin core traits, Chupacabra, Cro-Magnon)
- [ ] Run wiring macro to resolve placeholder UUIDs
- [ ] Spot-check faction wizard species dropdown (should show exactly 8)
- [ ] Spot-check existing Jackalope / Stormborn / Rustland / Furrykin PCs still resolve
- [ ] Update Sorting Engine v1 ancestry sort keys if it has a hardcoded list
- [ ] Promote `ANCESTRY_CANON_v2.0.md` into player-facing User's Guide v2.0 pipeline

## Locked Systems (Do Not Modify)

- Raid Console + Commit Console
- Campaign Engine + Story Console + Beat Editor
- Leylines + Gates
- Faction Systems (Faction Level, Health tracks, Garrison Upkeep)
- Territory/Travel (Hex Chrome, Travel Engine, Rig→Travel Bridge)
- Character Options (9 classes, 6 species → **now 8 ancestries**, subclasses)
- Sorting Engine v1
- OP spend pattern: `op.commit(factionId, NEGATIVE deltas, reason)`

## Next Dependencies

- **Sorting Engine v2 + Character Wizard Step 0** — input is now the 8-ancestry canon above.
- **User's Guide v2.0** — ancestry section pulls from `ANCESTRY_CANON_v2.0.md`.

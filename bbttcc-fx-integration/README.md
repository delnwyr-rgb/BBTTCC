# BBTTCC FX — Integration Pack v0.1

This module is a native FX layer for BBTTCC that patches the live runtime rather than editing templates.

## What it currently does

- Patches the BBTTCC Raid Console class at runtime.
- Adds checkbox pulse / maneuver family highlighting without touching HBS.
- Hooks `_commitRound()` to show:
  - maneuver invoke pulses
  - maneuver impact pulses
  - raid outcome banners
  - facility / rig / boss outcome cues
- Wraps `territory.advanceTurn()` to show a light turn presentation from returned row data.

## Installation

1. Copy this folder into `Data/modules/bbttcc-fx`
2. Enable the module in Foundry.
3. Keep `bbttcc-raid` and `bbttcc-territory` enabled.

## Current patch targets

### Raid Console

The module patches the runtime class exposed by the raid module export shim.
It does **not** rewrite the uploaded raid file.

### Turn Driver

The module wraps `game.bbttcc.api.territory.advanceTurn()` after the existing Turn Driver + tracks wrapper are installed.

## Safety rules

- No mechanics are owned by this module.
- If FX fails, raids and turns still resolve.
- No OP spends or world mutations occur here.

## Best next follow-up

- Add real token / hex primitives once the canonical territory highlight API is chosen.
- Add targeted boss phase visuals tied to `round.meta.boss.damageStep`.
- Expand turn event classification from row summaries into explicit FX events.

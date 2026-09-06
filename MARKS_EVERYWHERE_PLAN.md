# Marks everywhere — unification plan (ruled 2026-09-06)

**Ruling (Dave):** one unit for faction Operations Points, and it is the **mark** — storage, API,
authored data, and display. "OP" survives only as the *name of the resource* ("Violence OP"), never as
a quantity. Rationale: factions accrue Momentum from every OP check; fine-grained marks give many
small, meaningful accrual moments (beat rewards of +1/+2 marks are intended, not typos).

**Today:** storage + op-engine API are already marks. Ten copies of the 1 OP = 10 marks constant
(4 hardcoded: `rfi-pricing.js`, `module.raid-console.js`, campaign `module.js`, `op-engine.js`).
Display is OP (bank ÷ 10) on the faction sheet, player HUD, raid console, market, campaign check
labels ("1 OP"). Catalog data in OP: raid maneuver costs (`bbttcc_maneuvers_v1_4.json` + EFFECTS
registry), market `econCost`, agent-api `normalizeCost`, tikkun ritual spends. Beat `opDeltas`: marks
(correct by this ruling; lint E02 "in MARKS" warning retired).

## Phases (each independently deployable; run the walker + lint after each)

1. **Constant collapse** — the 4 hardcoded `10`s read `game.bbttcc.api.op.OP_TO_MARKS`; add
   `api.op.fmt(marks)` = the ONE display formatter (default: plain integer + "marks"). Pure risk
   reduction, no gameplay change. ~1 hour.
2. **Display → marks** — faction sheet OP card, player HUD, raid console cost/bank readouts,
   travel console mitigation costs, campaign check labels ("1 OP" → "10 marks"), market price
   tags, exchange/vault UIs (already marks) — every number through `api.op.fmt`. Templates:
   `faction-sheet.hbs` and the enhancer render strings. ~half a day; visual-only, playtest by eye.
3. **Catalog data → marks** — raid maneuver costs ×10 in the JSON + registry (with the agent-api
   `normalizeCost` and `validate.maneuver` schema updated), market `econCost` ×10 and drop the
   conversion, tikkun `spend*` fields ×10, campaign `_OP_TO_MARKS` spend becomes `10` marks
   explicitly named. Migration macro (DRY_RUN) for any live-world copies of catalog data.
   ~half a day + a raid gauntlet run (`raid-gauntlet-runner`) to prove costs still gate.
4. **Sweep + lint** — repo grep for `OP_TO_MARKS|/ 10|* 10` must return only the op-engine
   constant itself; parameter names carry the unit (`marks`), never `amount`; `lint-campaign.js`
   rule: any `op*` quantity field that is not an integer → ERROR. Retire the constant when nothing
   reads it.

## Do-not-touch (different unit on purpose)
Momentum (dice, integer), Surge (dice), Victory Points, build units, materials, darkness. Only the
nine OP channels are marks.

## Related rulings the same day
- No d20: canon die is `2d10x10` everywhere a module rolls (system `rolls.checkFormula/flatCheck`).
- Campaign OP checks now bank Momentum on exploded tens (mirrors the faction sheet's roll).
- Raid contests + travel checks still roll NON-exploding 2d10 — pending Dave's call after the DC
  curve playtest.

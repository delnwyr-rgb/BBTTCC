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

1. **Constant collapse — ✅ DONE 2026-09-06 (deployed both, pm2 restarted).** Authority = `systems/fourththing/rfi-pricing.js` `MARKS_PER_OP` (the ONLY literal), copied onto `game.fourththing.constants.MARKS_PER_OP` (via import into `FT`) and `.pricing.MARKS_PER_OP`; op-engine reads it lazily (`_marksPerOp()`), republishes `api.op.OP_TO_MARKS` (snapshot at ready) + `api.op.marksPerOp()` (live), and keeps ONE guarded mirror `MARKS_PER_OP_FALLBACK_NON_FT` that warns once on a host without the system (dnd5e parity). Raid console + campaign module constants → `_mpo()` readers; ft-class-automation imports the constant; market ×5 / encounters / factions-module fallbacks read `fourththing.constants`. Sweep grep now returns exactly the authority + the mirror.
   Original scope: — the 4 hardcoded `10`s read `game.bbttcc.api.op.OP_TO_MARKS`; add
   `api.op.fmt(marks)` = the ONE display formatter (default: plain integer + "marks"). Pure risk
   reduction, no gameplay change. ~1 hour.
2. **Display → marks — ✅ DONE 2026-09-06 (deployed, F5 only).** Engine: `fmt`/`fmtNum` added, legacy `formatMarksAsOP*` render marks. Surfaces: faction sheet (helpers, header totals, cost lines, GM-edit inputs step 1 in marks, tips, lang label "OP Bank (marks)"), raid console (`_rcOP`, cost lines, "Requires 10 X marks", staged/bank readout), raid planner, inbox card, diplomacy transfer inputs (now marks, no ×10), banks treasury chips, onboarding stipend + tour text, travel console (shortfalls, est. cost, weather delta), campaign OP chips/tooltips/desperation/sacrifice, market legacy `costLabel` (catalog OP ×10 shown as marks until phase 3). Roll BONUSES still derive as bank÷10 (a d10-scale number, not a quantity) — unchanged by design.
   Original scope: — faction sheet OP card, player HUD, raid console cost/bank readouts,
   travel console mitigation costs, campaign check labels ("1 OP" → "10 marks"), market price
   tags, exchange/vault UIs (already marks) — every number through `api.op.fmt`. Templates:
   `faction-sheet.hbs` and the enhancer render strings. ~half a day; visual-only, playtest by eye.
3. **Catalog data → marks — ✅ DONE 2026-09-06 (deployed both; system restarted).** Findings: raid maneuver costs were ALREADY marks (JSON `opCosts`, registry `cost:{violence:10}`); the real OP-authored data was elsewhere. Converted: market legacy catalog `cost.economy` (seeds ×10 + one-time GM `ready` migration guarded by setting `catalogMarksMigrated`; every `/OP_TO_MARKS` conversion in purchase/dialog/preview removed; `costLabel` plain marks), strategic-throughput deferred yields (8 literals ×10, `scheduleFactionOP` no longer ×10), agent-api preview `opDeltas` (×10), Tikkun hex yield (`YIELD_MARKS_PER_TURN = 10`), Tikkun ritual (spends already clamped/debited in marks — bonus weight fixed to per-20-marks = the original "per 2 OP"; template labels/step 10), core bridge (dialog in marks, step 10; engine rule units per 10 marks via `_mpo()`; all chat/error strings marks). INPUT surfaces → marks with step 10 and "per 10 marks" mechanics: courtly influence (init commits + round spends, `_m10` rounding, bank clamp in whole tens, spending-lock message ×10), infiltration alarm (spends + flashback), raid-console dialogs (9 inputs relabeled, defaults 20), siege planner buffer commits, siege HUD join (defaults 20/10), diplomacy transfers, inbox counter rows, campaign backing (`+2 per 10 marks`; the marks-vs-OP pool compare bug fixed), factions travel-archetype econ, GM bank edit (OP branch removed). Display stragglers phase 2 missed → marks: siege HUD/state/throughput/muster/outcome-writeback, exchange summary, hex-travel shortfall, system bounty tag, bestiary bounty fmt, onboarding stipend. Left as rule-unit derivations (not quantities): roll bonuses (bank÷10), turn-driver logistics slots, `atkSpendInt = marks/10` effect units. Deferred: `bbttcc-encounters/scene.launcher.js` works in OP internally (75 reads, converted at read/save) — a phase-4 internal refactor.
   Original scope: — raid maneuver costs ×10 in the JSON + registry (with the agent-api
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

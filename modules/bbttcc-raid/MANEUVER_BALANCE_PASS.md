# BBTTCC Maneuver Catalog — Balance / Variety / Creativity Pass

**Status:** 🟢 Wave 1 + Wave 2 + Mal-voicing + Faction-kit ALL BUILT 2026-05-23/24 — all code `node --check` clean. Awaiting operator macro runs + live test. Nothing live-tested yet. **This closes all three workstreams** (balance / Mal voice / faction kit).
**Date:** 2026-05-23
**Owner:** delnwyr (GM/designer)
**Parent doc:** `MANEUVER_CATALOG_SPEC.md` (the mid-May S1/S2/S2.5 curation). This memo is the *post-Courtly / post-Siege* follow-up — the parent spec was last touched 2026-05-14/15, before Courtly Intrigue (5/21) and the Siege engine (5/22–23) shipped, so its §6 inventory is stale.
**Companion files:** live pack `../bbttcc-master-content/packs/doctrines` (authoritative) · `scripts/maneuvers-sprint2-content.enhancer.js` · `scripts/maneuvers-sprint3a-content.enhancer.js` · `scripts/maneuvers-courtly-content.enhancer.js`

---

## 1. Corrected audit (2026-05-23, read from the live LevelDB pack)

The parent spec's §6 said 59 entries. Reading the authoritative pack directly:

- **69 maneuvers** (`flags.bbttcc.kind === "maneuver"`)
- **74 strategic activities**
- **143 total doctrine feat docs**
- **+12 Courtly maneuvers that exist ONLY at runtime** (registered into `EFFECTS` by `maneuvers-courtly-content.enhancer.js`, never seeded to the pack) → effective playable catalog ≈ **81**

### Engine × tier (pack, 69)

| Engine | T1 | T2 | T3 | T4 | **Total** | Share |
|---|---|---|---|---|---|---|
| **Violence** | 13 | 6 | 7 | 5 | **31** | **45%** |
| **Intrigue** | 7 | 8 | 3 | 1 | **19** | 28% |
| **Presence** | 2 | 2 | 3 | 3 | **10** | 14% |
| **Universal** | 5 | 1 | 1 | 1 | **8** | 12% |
| *Untagged* | 1 | — | — | — | **1** | — |
| **Courtly** *(runtime-only)* | 5 | 4 | 2 | 1 | **(12)** | — |
| **Siege** | — | — | — | — | **0** | 0% |

Intrigue's 19 = 9 legacy + 10 Infiltration (S3a). Presence's *real* depth is 10 pack + 12 Courtly = 22, but the compendium only shows 10.

### Cleared false alarms

- **Costing is coherent.** Tier→band: T1→light (9/10), T2→medium (9/10), T3→medium (9/10), T4→heavy (10/10). No free or mis-banded maneuvers. Legacy costs live at `flags.bbttcc.opCosts`; modern at `flags.bbttcc.meta.opCosts` — cosmetic split, see §5.
- **Intrigue/Presence "understaffing" is resolved** — Infiltration + Courtly filled it after the parent spec snapshot.

---

## 2. Problems, ranked

1. **Violence dominance (31/69, 45%).** Several are near-duplicates: `Rally the Line` / `Radiant Rally` / `Battlefield Harmony` are all "buff ally morale/attack"; `Supply Overrun` / `Supply Surge` (universal) overlap.
2. **Siege has zero maneuvers.** A flagship raid type with no doctrine catalog hooks into its rich state machine (supply BFS, layer-breach, champion duel, morale, relief force).
3. **Courtly's 12 are runtime-only.** Invisible in compendium; not faction-ownable; Presence under-reads.
4. **Universal thin (8).** The most reusable pool is the smallest.
5. **Swingy T4 landmines** — feel-bad / unbounded effects (see §3.D).
6. **Creativity clusters in new content.** Canvas-touching + anytime maneuvers are almost all S2/Infiltration/Courtly; the legacy Violence block is abstract strategic nudges.
7. **Coherence debt** — two cost conventions; fireMode untagged on pack docs; `Psychological Pressure` has no engine tag.

---

## 3. Proposed change-set

Net effect: Violence 31→~28, Universal 8→12, Siege 0→4 (breach-scene only; strategic siege actions stay in the planner), Courtly made visible (Presence 10→22 in compendium), 3 T4s retuned. New spread ≈ Violence 35% / Intrigue 24% / Presence 27% / Universal 15% / Siege breach 5%.

### 3.A — Siege Breach-Scene maneuvers (NEW, ~4) — *scoped down 2026-05-23*

**Reframed after the operator flagged that "a lot of Siege activity ended up in the Strategic Activities planner."** Confirmed: Siege has TWO action layers —

- **Strategic layer (planner):** 9 counter-activities registered `kind:"strategic"` + `siegeCounterActivity:true` (`Reinforce Garrison`, `Call Relief`, `Sue for Terms`, `Champion Defends Wall`, `Pray for Omen`, `Demand Surrender`, `Champion Withdraws/Returns`, `Storm Final Assault`) + `begin_siege` — `siege-counter-activities.js` lines 266–274. These own the turn-economy / meter-shift actions. **Correct home — leave them.**
- **Tactical layer (Breach Scene):** uses the regular maneuver budget (`Storm Final Assault` doubles "next Breach Scene's maneuver budget"). **No siege-specific maneuvers exist** → breach assaults fire generic Violence maneuvers.

So the maneuver-catalog gap is narrow: **the Breach Scene has no siege-flavored tactical maneuvers.** Author ~4 that fire during assault rounds and reuse the **existing S1 scene-intent verbs** (damage/buff tokens on the bound breach battle scene — same plumbing as `Artillery Salvo`). **Content-only; NO `__siegeScenario.applyEffects` substrate** (that would only be needed for strategic meter-shift maneuvers, which the planner counter-activities already cover — we deliberately do NOT duplicate them).

| Tier | Name | Side | Fire-mode | Cost (marks) | Concept (reuses S1 canvas verbs) |
|---|---|---|---|---|---|
| T1 | **Sap the Walls** | Atk | anytime | violence 2 (20, light) | `damageSceneTokens` 4 vs enemy breach tokens |
| T1 | **Shore the Gate** | Def | anytime | logistics 2 (20, light) | `buffSceneTokens` — defender tokens gain "Braced" for 1 round |
| T3 | **Sortie en Masse** | Def | anytime | violence 3 + softpower 1 (40, medium) | Defender tokens gain "Sally" (+atk) + `damageSceneTokens` 4 on besiegers |
| T4 | **Crack the Keep** | Atk | post-commit | violence 5 + logistics 2 (70, heavy) | On success: `damageSceneTokens` 11 + breach-burst `playCanvasVfx` + morale +1 |

*Tiers aligned to cost-bands (T1→light, T3→medium, T4→heavy) per the parent spec's locked bands. If we later want strategic-tier siege maneuvers (supply/buffer/morale shifts) NOT covered by the planner, THEN the `__siegeScenario.applyEffects` substrate becomes relevant — deferred unless a real gap surfaces.*

### 3.B — Universal top-up (8 → 12, +4)

Cross-engine fuels; cross-layer entries must no-op gracefully (per parent spec §3 †).

| Tier | Name | Fire-mode | Cost | Concept |
|---|---|---|---|---|
| T1 | **War Chest** | pre-roll | economy 2 (20) | +1 OP of a chosen pool refunded next round |
| T2 | **Field Chaplaincy** | anytime | faith 2 + softpower 1 (30) | −1 darkness; hold morale steady this round |
| T2 | **Cultural Offensive** | post-commit | culture 3 + softpower 1 (40) | On success: softpower/morale shift in any engine |
| T3 | **Total Mobilization** | pre-roll | logistics 3 + economy 2 (50) | +1 to all friendly rolls AND a friendly-token scene buff (no-op-safe) |

### 3.C — Violence consolidation (31 → ~28)

**Merge/retire 3 redundant ally-buffs** into one clean entry, freeing slots without losing function:
- Fold `Radiant Rally` + `Battlefield Harmony` into `Rally the Line` (keep the best name; preserve the darkness-on-success rider as a tier upgrade). *Retires 2.*
- Retire `Supply Overrun` (Violence) in favor of universal `War Chest` / `Supply Surge` (overlapping "gain economy next round"). *Retires 1.*

*(Alternatively: re-slot rather than retire — keep the docs but retag 1–2 dual-engine ones toward Universal. Flag for sign-off.)*

### 3.D — Retune the swingy T4s

| Maneuver | Issue | Proposed |
|---|---|---|
| `Reality Hack` | "Re-run the round as if it never happened" — erases consequence, feel-bad for the other side | "Re-roll your faction's round result once; you must keep the second result. Darkness +1." |
| `Void-Signal Collapse` | "Nullify ALL maneuvers this round" — flattens everyone's turn | "Nullify all *enemy* maneuvers this round; your own still resolve. Darkness +1." |
| `Chrono-Loop Command` | Inverted incentive (parent §2.D) | "Re-run one failed roll on success; on failure, Darkness +1." |

### 3.E — Courtly → pack seeding (coherence fix)

Seed the 12 runtime Courtly maneuvers into the doctrines pack (idempotent seed macro, same pattern as `seed-sprint2-maneuvers`). Makes Presence read at full depth in the compendium and lets factions own them. Also tag `Psychological Pressure` engine = `presence`.

### 3.F — (Optional, lower priority) Coherence debt

- Migrate legacy `flags.bbttcc.opCosts` → `meta.opCosts` so cost has one home.
- Persist `fireMode` onto pack docs (currently runtime-tagged only).
- Defer unless we're already mutating the pack for 3.A–3.E.

---

## 4. Implementation plan (operator-run, DRY_RUN-gated — matches prior sprints)

1. **Author content** in a new `scripts/maneuvers-balance-content.enhancer.js` (Siege breach ×4 + Universal ×4 + retuned T4 overrides), self-registering into `EFFECTS` + `__THROUGHPUT` + fireMode (same single-source pattern as S2).
2. **Siege breach maneuvers reuse the S1 scene-intent verbs** (`damageSceneTokens` / `buffSceneTokens` / `playCanvasVfx`) on the bound breach battle scene — same plumbing as `Artillery Salvo`. No new substrate. Tag `raidTypes:["siege","violence"]` so they surface in both breach scenes and ordinary Violence raids.
3. **Seed macros** in `bbttcc-master-content/tools/`: `seed-balance-maneuvers.macro.js` (new entries) + `seed-courtly-maneuvers.macro.js` (the 12 runtime-only) + `merge-redundant-violence.macro.js` (3.C retire/merge) + `retune-t4-maneuvers.macro.js` (3.D text/throughput). All `DRY_RUN=true` default, idempotent.
4. **Mal-voice pass** (separate workstream, deferred per 2026-05-23 decision): flavor-line-only rewrite once balance lands.

---

## 5. Open questions for sign-off

1. ✅ **RESOLVED + reframed (2026-05-23).** Siege has no `__siegeScenario.applyEffects` branch (`module.raid-console.js:1718–1729` routes scenarioEffects only to infil/courtly). BUT the operator flagged that siege's turn-economy actions already live in the Strategic Activities planner (9 counter-activities, `siege-counter-activities.js:266–274`). So we **scope 3.A down to ~4 Breach-Scene tactical maneuvers** that reuse the existing S1 scene-intent verbs (damage/buff tokens on the bound breach scene) — **content-only, no substrate**. The `__siegeScenario.applyEffects` work is deferred indefinitely (only needed for strategic meter-shift maneuvers, which the planner already covers). All of 3.A/3.B/3.E are now content-only / low-risk.
2. **3.C: merge vs re-slot?** Retire the 2–3 redundant Violence buffs outright, or keep the docs and just retag toward Universal/Presence?
3. **Siege attacker/defender split** — confirm the 8-entry attacker/defender balance feels right, or weight one side.
4. **Scope of this pass** — ship 3.A + 3.B + 3.E (additive, low-risk) first, and treat 3.C + 3.D (mutating existing entries) as a second wave?

---

## 5.5. Wave 1 — BUILT 2026-05-23 (additive, low-risk)

**Files (all `node --check` clean):**
- `bbttcc-raid/scripts/maneuvers-balance-content.enhancer.js` — 8 maneuvers (4 Siege breach + 4 Universal), self-registering into EFFECTS + `__THROUGHPUT` + fireMode; exposes `game.bbttcc.api.raid.balanceManeuvers`. Reuses S1 scene-intent verbs only.
- `bbttcc-raid/module.json` — enhancer registered (esmodule index 90, after courtly).
- `bbttcc-master-content/tools/seed-balance-maneuvers.macro.js` — seeds the 8 into the doctrines pack (DRY_RUN default; siege-tagged get a castle icon).
- `bbttcc-master-content/tools/seed-courtly-maneuvers.macro.js` — seeds the 12 runtime Courtly maneuvers into the pack + tags `Psychological Pressure` engine=presence (DRY_RUN default).

**Operator run order:**
1. Reload Foundry (F5) — loads the new enhancer.
2. Console check: `game.bbttcc.api.raid.balanceManeuvers.length === 8`.
3. Run **seed-balance-maneuvers** macro `DRY_RUN=true` → review chat report → set `DRY_RUN=false`, re-run.
4. Run **seed-courtly-maneuvers** macro `DRY_RUN=true` → review → `DRY_RUN=false`, re-run.
5. Open the doctrines compendium — 8 new + 12 courtly should appear with full metadata.
6. **Light-up test:** open a Siege Breach Scene with enemy tokens, fire **Sap the Walls** → enemy tokens lose integrity (same loop as Artillery Salvo). Fire **Total Mobilization** in any raid → +1 friendly rolls + movement buff on bound scene.

**Wave 2 (proposed, NOT built):** 3.C merge redundant Violence buffs (operator chose merge), 3.D retune the 3 swingy T4s. Ship after Wave 1 playtests clean.

## 5.6. Wave 2 — BUILT 2026-05-24 (mutating: merge + retune)

**3.C MERGE — Radiant Rally + Battlefield Harmony → Rally the Line.** Rally the Line now carries the +2 Morale / −1 Darkness rider. The two retired maneuvers are removed from every runtime surface so they no longer appear in the picker:
- `compat-bridge.js` — both EFFECTS entries + FAMILY_BY_KEY lines removed (RETIRED comments left).
- `data/bbttcc_maneuvers_v1_4.json` — radiant_rally entry removed; rally_the_line text updated (40→39 entries).
- `bbttcc-agent-api.js` — both THROUGHPUT handlers removed (prevents GM stub-resurrection); rally_the_line THROUGHPUT gains the morale/darkness `factionEffects` rider.
- `raid-resolveRaidRound.throughput.enhancer.js` — radiant_rally special-case → `rally_the_line` (with radiant_rally OR-kept for legacy in-flight rounds).
- `module.raid-console.js` — removed from picker lists (infiltration/infiltration_alarm/liberation/siege/any). The `attackerMarginDelta` Battlefield Harmony block (~7895) left **dormant + guarded** (can never fire now).
- `effects-fire-mode-tags.js` — both tags removed.

**3.D RETUNE** (in `bbttcc-agent-api.js` THROUGHPUT + JSON text + pack desc):
- **Chrono-Loop Command** — fixed inverted incentive: rerun one failed roll on Success; **Darkness +1 on failure** (was: free rerun, penalty only on 2nd use).
- **Void-Signal Collapse** — scope `bothSides`→`enemy`; consumer `_b2ApplyNullifyAllManeuvers` (`module.raid-console.js`) now keeps attacker-side rows (`if (side === "att") continue;`). Caster's own maneuvers still resolve.
- **Reality Hack** — `rewindRound` (erase the round) → bounded `rerollRoundResult` keep-second + **Darkness +1**, fires on any outcome.

`rewindRound` / `rerunFailedRoll` had **no consumers** (GM-adjudicated previews) → those retunes are text + preview-shape only. Only Void-Signal touched live logic (the 3-line consumer guard).

**Operator run order (Wave 2):**
1. Reload Foundry (loads the code-side merge + retune).
2. Run **apply-maneuver-wave2** macro `DRY_RUN=true` → review (4 desc updates, 2 deletes, faction sweep) → `DRY_RUN=false`, re-run.
3. Verify: Radiant Rally + Battlefield Harmony gone from picker + compendium; Rally the Line shows merged rider; the 3 T4/T3 read the retuned text.

## 5.7. Mal-Voicing pass — BUILT 2026-05-24 (flavor-line-only)

Every maneuver's **compendium description** (`system.description.value`) rewritten into Mal's diegetic voice (per `bbttcc-mal-voice/scripts/voices/mal.js` — fragments, dry snark, "stewards/y'all/poor dears", sparing ALL CAPS, anthropomorphized objects). Structure: `<p>Mal narration</p><p><b>mechanical clause — numbers UNCHANGED</b></p>`. The terse raid-console **tooltip** (`EFFECTS.text`) is deliberately left mechanical — Mal lives in the "read about it" surface, not the quick-glance tip.

- `bbttcc-master-content/tools/mal-voice-maneuvers.macro.js` — `MAL` map of **86 keyed descriptions** (all 67 live pack + 8 Wave-1 + 12 Courtly; retired radiant_rally/battlefield_harmony excluded). Updates pack docs; DRY_RUN default; idempotent (skips already-Mal); reports any key not yet in the pack.
- **Run LAST** — after seed-balance + seed-courtly + wave2, so every key exists in the pack.

## 5.8. Faction starter-kit — BUILT 2026-05-24 (one usable T1 per engine)

Problem: the raid console locks a faction to its OWNED maneuvers once it owns any, and the old 4 starters were 3×Violence + 1×Intrigue — so a new faction had nothing usable in Presence/Universal/Courtly contexts.

- `bbttcc-factions/scripts/module.js` — `_BBTTCC_STANDARD_START_MANEUVERS` expanded 4→7: added `logistics_surge_s2` (Universal, anytime — usable in EVERY raid type), `opt_infernal_bargain` (Presence, anytime), `courtly_whispered_aside` (Courtly, anytime). Both creation paths (`_bbttccEnsureBaselineDoctrine` + `PKG_STANDARD_V1`) inherit it. Grant builds embedded items from EFFECTS (fail-open), so no pack-seed dependency.
- `bbttcc-master-content/tools/backfill-faction-engine-maneuvers.macro.js` — grants the 3 new keys to EXISTING factions (which won't re-run baseline seed). DRY_RUN default, idempotent.

## 5.9. MASTER operator run order (everything, in sequence)

All code is live on F5 reload (enhancers + module edits). The macros are pack/faction mutations — run in THIS order, each DRY_RUN→review→`false`→re-run:

1. **Reload Foundry (F5).** Console sanity: `game.bbttcc.api.raid.balanceManeuvers.length === 8`.
2. `seed-balance-maneuvers.macro.js` — adds the 8 new maneuvers to the pack.
3. `seed-courtly-maneuvers.macro.js` — adds the 12 Courtly maneuvers + tags Psychological Pressure.
4. `apply-maneuver-wave2.macro.js` — merge (delete radiant_rally/battlefield_harmony, update Rally the Line) + retune descriptions + faction sweep.
5. `mal-voice-maneuvers.macro.js` — Mal-voices all 86 descriptions. (Run LAST — needs steps 2–4 done so every key exists. Should report 0 not-found.)
6. `backfill-faction-engine-maneuvers.macro.js` — grants the 3 engine-coverage maneuvers to EXISTING factions (new factions already get them).
7. **Live-test:** breach scene + Sap the Walls; a Courtly raid shows Mal-voiced courtly maneuvers; create a fresh faction → confirm 7 starter maneuvers spanning all engines.

## 6. Decisions log

- **2026-05-23** — Balance pass chosen as first workstream (over Mal-voice / faction-kit). Mal-voice = flavor-line-only, deferred to after balance. Faction starter kit = one usable T1 per engine (tracked separately).
- **2026-05-23** — Direction: rebalance by *filling holes* (Siege, Universal, Courtly-visibility), not by gutting Violence. Merge only the genuinely redundant Violence buffs.
- **2026-05-23** — Operator flagged siege turn-economy actions already live in the Strategic Activities planner (9 counter-activities). **Siege scope cut from 8 maneuvers → 4 Breach-Scene tactical maneuvers** that reuse S1 canvas verbs; strategic siege actions stay in the planner (not duplicated). Killed the `__siegeScenario.applyEffects` substrate dependency.
- **2026-05-23** — Sequencing: **Wave 1 = additive (3.A+3.B+3.E)** first, playtest, then **Wave 2 = mutating (3.C merge + 3.D retune)**. Violence dupes: **merge** Radiant Rally + Battlefield Harmony into Rally the Line (Wave 2).
- **2026-05-23** — Wave 1 BUILT (enhancer + 2 seed macros + module.json), syntax-clean, awaiting operator macro runs.
- **2026-05-24** — Mal-voicing = compendium `system.description.value` only (flavor line + preserved bold mechanic); tooltip `EFFECTS.text` left terse-mechanical. One macro, 86 keyed descriptions, run last.
- **2026-05-24** — Faction kit: expanded starter maneuvers 4→7 (added Universal/Presence/Courtly anytime T1s) so the owned-maneuver lock never leaves a new faction empty in any raid type. Backfill macro for existing factions.
- **2026-05-24** — Wave 2 BUILT. Merge done by excising the EFFECTS source (`compat-bridge.js` + JSON) + THROUGHPUT handlers rather than only the picker lists — because `_mansForType` surfaces maneuvers by raidTypes tag-match AND GM stub-synthesis, not just the explicit lists. Retunes: 2 of 3 were consumer-less previews (text-only); Void-Signal needed a 3-line consumer guard. Battlefield Harmony's margin mechanic left dormant+guarded rather than excised (lower risk). 1 pack-mutation macro (`apply-maneuver-wave2`) handles desc updates + deletes + faction sweep.

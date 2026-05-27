# Surge Unification Spec — v0 (pilot: Harmony Marshal + Soul-Smith)

**Status:** Design locked. **Phases 1 (Burn generalization) + 2 (Soul-Smith) BUILT + DEPLOYED to both live instances** 2026-05-26 — syntax-checked, unit-tested (33/33), md5-verified on both Lightsail instances + pm2-restarted. **NOT yet live-tested. NOT git-committed.** Phases 3 (Harmony Marshal) + 4 (roster) pending.
**Date:** 2026-05-26
**Scope of this doc:** the universal model + two archetypes + full spec for the two pilot classes (Harmony Marshal, Soul-Smith). The rest of the roster is converted in a later pass once these two are playtested.

---

## 0. Thesis & goals

Surge becomes **the** core dice pool for *every* class. The fun, sacred generator — **dice explode → bank Surge** ("gods on earth; don't hit reality too hard") — stays universal and untouched. On top of that, each class has a **unique flavor generator** that also feeds Surge, plus a small set of **class-exclusive spend entries** (its old tiered powers, re-priced in Surge).

Goals:
1. **Kill clutter** — one currency, one HUD number, one mental model.
2. **Modernize the archaic classes** — give the pool-less classes real round-by-round agency.
3. **Preserve identity** — differentiation moves into *how you generate* and *what's on your menu*, not into bespoke pools.

### The design test (apply to every class)
> *At zero Surge, what does this class DO on its turn — and what does it itch to spend Surge on?*

If the answer is "nothing," the class is archaic. Harmony Marshal and Soul-Smith both answer "nothing" today (see §3/§4). This spec forces a non-empty answer.

---

## 1. Universal model

### Core currency: Surge
| Tier | Surge cap |
|------|-----------|
| T1 | 4 |
| T2 | 6 |
| T3 | 8 |
| T4 | 10 |

(Existing `_ftSurgeCap`; per-foe override flag `flags.fourththing.surgeCap` already honored.)

### Two intakes
1. **The surging roll** — explosion banks Surge. Universal, sacred, already wired via `_ftBankSurge` (central chokepoint over ~12 explosion sites). **Do not change.**
2. **Class flavor hook** — an automatable, per-class trigger that also banks Surge (Pool) or Surge+Burn (Burn). Defined per class in §3/§4.

### Spend
- **Shared menu** — the existing ~26 Surge options, available to everyone.
- **Class-exclusive entries** — the re-specced tier powers, priced in Surge, tier-gated.

### Two iron rules
- **Surge amplifies, never gates.** Every class's core function works at 0 Surge. Surge buys *extra / bigger / now*. Archaic classes get Surge-fueled boosts, not a Surge on-switch.
- **Overflow = reality pushes back.** Banking past cap is never silent.
  - *Pool* classes: excess is lost **and** triggers a minor instability (GM-light; e.g. a beat of narrative friction). v0 keep simple: excess lost, optional 1-pt blowback at GM discretion.
  - *Burn* classes: excess Surge dumps into **Burn** (see §2).

---

## 2. The two archetypes

### Pool archetype
Surge accumulates; spent on discrete menu entries. Predictable. Low cognitive load. **Harmony Marshal.**

### Burn archetype
Surge with a **coupled heat clock**. Same generative act produces both the good (Surge) and the bad (Burn). This is the reconciliation of Aurablade's "two camps."

- **Surge** = the spendable currency (the GOOD camp). Spent normally.
- **Burn** = a heat/risk clock **0→8** (the BAD camp). Same number, second readout.
- **1-for-1 coupling** (the Aurablade signature): the flavor hook grants Surge **and** ticks Burn by the same amount.
- **Bands** (reuse Aurablade's, max **8**): **Cool 0–1 / Stoked 2–3 / Overheated 4–8.**
  - *Stoked* — your class effects are **amplified** (payload differs per class).
  - *Overheated* — **backlash** each round until you vent (payload per class). The zone is wide; **unlocked abilities AND penalties escalate per point** toward the ceiling, mirroring Aurablade's proven staged design (each step gives you more *and* costs you more). Hitting **8** = hard ceiling / worst backlash + forced vent.
- **Vent** = an action; lowers Burn (−2). Does **not** touch banked Surge.
- **Overflow** — Surge gained past cap dumps into Burn 1-for-1 ("can't hold it; it turns to heat").
- **Two readouts on the HUD** — a fuel gauge (Surge) + an overheat clock (Burn), driven from the two numbers. Reuse the rig heat-gauge pattern (`_ftBuildRigStatusHtml` analog).

> Aurablade and Soul-Smith share this *structure* but differ in *payload* — Aurablade Burn amplifies **damage** (destructive register); Soul-Smith Burn amplifies **repair** (constructive register). Same engine, opposite fiction. That's the proof the archetype generalizes.

---

## 3. Class spec — Harmony Marshal (Pool)

**Identifier:** `harmony-marshal` / `harmony_marshal`
**Today:** zero round-based agency except Rallying Words (a banked reroll). Everything else is faction Soft Power OP + hex loyalty on the `advanceTurn` tick. **Fails the design test.**

### Generation hook — *Harvest the party's surges*
> When an **ally within 30 ft** lands a **surging roll** (explosion), the Marshal banks **+1 Surge**. Max **+2 Surge/round** from this hook (so a hot 4-PC party doesn't firehose). The Marshal's own explosions bank normally on top.

Fiction: harmony = the team's collective brilliance resonating into the leader. Fully automatable — we already detect explosions in `_ftBankSurge`; just scan for an in-aura Marshal and bank theirs (respect foe-surge gating — a foe Marshal harvests only if its surge flag is on).

### Spend menu (v0 costs vs cap)
| Entry | Cost | Tier gate | Effect |
|-------|------|-----------|--------|
| **Rallying Words** | 1 | T1 | Target ally rerolls one die (or gains +1 die) on their next roll this round. (Signature, spammable.) |
| **Ease Attrition** | 2 | T1 | Strip one condition **or** clear stress / heal a small Integrity bump on an ally. |
| **Rally to Me** (Loyalty) | 2 | T2 | An ally in aura immediately takes a reaction or a basic action out of turn. |
| **Unity Flourish** | 3 | T3 | All allies in aura gain +1 to checks (or +1 die) until the start of your next turn. |
| **Conductor's Crescendo** | 5 | T4 | 1/scene. Aura crescendo: allies reroll all 1s this round **and** each clears one condition. |

### Strategic layer — KEEP AS-IS
The campaign-tick versions stay exactly as built and fire on `bbttcc:advanceTurn:end` (`module.js:12177`):
- Attrition Easer → spend 1 Soft Power OP → −1 faction attrition.
- Loyalty Steward → +1 hex Loyalty (`bbttcc-territory` ns).
- Unity Conductor → +2 Soft Power OP / strategic turn.

The class now has **dual presence**: round-based Surge menu *and* the strategic tick. The tier powers exist on both layers (combat echo + campaign effect).

### Code touch-points
- `_ftBankSurge` — add the in-aura ally-explosion harvest (foe-gating aware).
- Surge spend dialog / `_onFtSurgeSpend` — register the 5 class-exclusive entries, gated by identifier + tier.
- Existing handlers `harmony_marshal_*` (`module.js:1818–2029`) → keep as the strategic-layer effects; surface tier powers as Surge entries too.
- `advanceTurn:end` (`12177`) — unchanged.
- HUD: no new gauge needed (Surge is already always shown).

---

## 4. Class spec — Soul-Smith (Burn)

**Identifier:** `soul-smith` / `soul_smith`
**Today:** on a round of combat it does **passive poison/necrotic resist (T3) and nothing else**. Atonement Crucible is 1/arc, Relic of Rebirth is 1/use, Forge Initiate is narrative. A campaign-layer class in a combat costume. **Fails the design test hardest — this is the class you flagged.**

### Burn track
- Range **0→8** (same ceiling as Aurablade — proven), bands **Cool 0–1 / Stoked 2–3 / Overheated 4–8** (unlocked effects + penalties escalate per point toward 8).
- **Stoked** payload: repairs are **+50% (or +1 die)** — the hotter the forge, the better the weld.
- **Overheated** payload: at the start of your turn while Overheated, the furnace bites — take **1d6 to self** *or* your next repair fizzles (GM/player pick), until you vent.
- **Vent**: action, **−2 Burn**.
- Burn resets on scene end / rest (mirror Aurablade's reset).

### Generation hook — *Damage stokes the forge*
> When the Soul-Smith **or any ally within 30 ft takes damage** (`_applyDamageToActor`), gain **+1 Surge and +1 Burn** (the 1-for-1 coupling). Capped at **+2 Surge / +2 Burn per round** from this hook. Explosions bank Surge normally (no Burn — the sacred source stays clean).

Fiction: the party's wounds feed the furnace. A **reactive medic engine** — the more the team is hurt, the more fuel you have to mend them, but the hotter (and more dangerous) you run.

### Spend menu (v0 costs vs cap)
| Entry | Cost | Tier gate | Effect (Burn-band scaled) |
|-------|------|-----------|---------------------------|
| **Forge-Weld** (Forge Initiate) | 1 | T1 | Restore Plating/Integrity to an ally. Amount scales by Burn band (Cool → base, Stoked → +50%). *The battlefield repair the class is missing.* |
| **Atonement** (Atonement Crucible) | 2 | T2 | Cleanse a debuff / corruption / condition from an ally. |
| **Share the Furnace** (Furnace of Renewal) | 2 | T3 | Grant an ally poison/necrotic resist (1 min) **or** a regen tick. (Passive self-resist stays — see below.) |
| **Relic of Rebirth** (capstone) | 5 | T4 | Forge a temporary relic (buff item) for an ally, **or** 1/fight keep an ally from dropping (combat-echo of the campaign resurrection). |

### Passive — KEEP AS-IS
T3+ poison+necrotic resist stays as the class-identity baseline in `_computeBaselineResistances()` (`module.js:6826–6831`). Not a managed AE.

### Strategic layer — KEEP AS-IS
Hex repair (Forge Initiate), 1/arc Spark purification (Atonement Crucible), 1/use region restore (Relic of Rebirth) remain as the campaign-layer skin.

### Code touch-points
- `_applyDamageToActor` — add the forge hook (Surge+Burn on self/in-aura-ally damage; per-round cap; foe-gating aware).
- **Generalize Burn** out of Aurablade-only (`ft-class-automation.js` `AURABLADE_ACTIONS` + `module.js` consumers) into a shared Burn-archetype module that Soul-Smith also uses. *This is the one real refactor in the pilot.*
- Surge spend dialog — register the 4 class-exclusive entries; read Burn band for repair scaling.
- `_computeBaselineResistances` (`6826`) — unchanged.
- HUD: add the **two-readout** Burn gauge (fuel + overheat) using the rig heat-gauge pattern; character-sheet.hbs.

---

## 5. Don't-break list

- **Foe Surge gating** — NPCs/monsters bank/spend Surge only when `flags.fourththing.surgeEnabled === true`. Both new hooks (Harmony harvest, Soul-Smith forge) must route through the same gate so a foe of these classes doesn't free-generate.
- **`_ftBankSurge` is the single banking chokepoint** — hook there, don't add parallel banking paths.
- **The explosion source stays sacred** — never add a "spend Surge to force an explosion that refunds Surge" loop (infinite engine). Forced explosions must be net-negative / non-refunding.
- **Aurablade** must keep working through the Burn generalization — its payload (damage amplify, fury/dread/mercy one-shots) is unchanged; only the *track infrastructure* is shared.

---

## 6. Tuning — resolved + remaining

**Resolved 2026-05-26:**
1. ✅ Harmony harvest cap = **+2 Surge/round** (confirmed good).
2. ✅ Soul-Smith explosions do **NOT** stoke Burn — explosions stay pure Surge, keeping the medic from perma-overheating.
3. ✅ **Burn max = 8 for ALL Burn classes** — matches Aurablade's working track (staged abilities + penalties across 0→8); not tier-scaled, not 6.

**Remaining (playtest to settle):**

4. Overheated backlash severity — 1d6/fizzle feels right for a support class; Aurablade's may be harsher. Per-class payload is fine.
5. Per-entry Surge costs are v0 guesses against the cap — confirm a T1 (cap 4) can act roughly every 1–2 rounds.

---

## 7. Phasing / implementation order

1. ✅ **Burn generalization — BUILT 2026-05-26.** Extracted a shared Burn substrate in `ft-class-automation.js`: a `BURN_CLASSES` registry (each class declares `max` / `bands` / `vent` / HUD `tag`+`icon`) + helpers `ftBurnClassFor` · `ftIsBurnClass` · `ftBurnMax` · `ftGetBurn` · `ftBurnBandFor` · `ftAddBurn`. `getBurnBand(burn, bands=BURN_BANDS)` now takes optional per-class bands (backward-compatible). `openStabilizeBurn` reads vent options + bands from the descriptor. `module.js` char + NPC sheet contexts now compute `burnClass` and pass its bands to `getBurnBand`; the char-sheet Burn `<span>` tag is `{{burnClass.tag}}`-driven. **Aurablade preserved byte-identical** (bands === `BURN_BANDS`, max 8, vent unchanged, all payloads/one-shots/auras/`syncAurabladeEffects`/`somaBreak` untouched). Per-stage structure (0→8) is preserved — only the substrate is shared.
   - *Deferred to Phase 2 (built with Soul-Smith):* the per-class HUD **block** — the char-sheet Burn panel is still gated `{{#if activePools.aurablade}}` and fused with the Aurablade-only Aura row. Soul-Smith gets its own block (no aura row, its own buttons, two-readout gauge); that's when the gate flips to `{{#if burnClass}}` with the aura row inner-gated.
2. ✅ **Soul-Smith — BUILT + DEPLOYED 2026-05-26.** Registered `soul-smith` in `BURN_CLASSES` (own bands Cool/Stoked/Overheated, vent quench/bank/overdraw). Forge generation hook `_ftSoulSmithForgeOnDamage` in `_applyDamageToActor` (self or friendly-within-30ft takes integrity damage → +1 Surge +1 Burn, +2/round cap via round-keyed `flags.fourththing.soulSmith.forge`, foe-gated). Class-exclusive Surge entries via new `classFilter` prop + `_ftActorMatchesClass`: **Forge-Weld** (fully wired — 1d8+tier repair ×1/×1.5/×2 by band, Overheated adds a 1d6 Stress backlash), Atonement / Share-the-Furnace / Relic-of-Rebirth (one-shot flag + chat, GM-enforced — deepen in Phase 2.1). HUD Burn gauge + Vent button on the Soul-Smith panel. T3 passive resist + strategic handlers untouched.
   - *Phase 2.1 polish:* fully wire Atonement (condition cleanse) / Share-the-Furnace (resist AE) / Relic-of-Rebirth (prevent-drop consumer); optional turn-start Overheated backlash (currently backlash fires on Forge-Weld-while-Overheated to avoid touching the combat turn loop).
3. **Harmony Marshal** — harvest hook + spend menu (no new gauge).
4. **Playtest both**, settle §6, *then* template the rest of the roster.

Every remaining class then answers the §0 test via the same three slots: **archetype · generation hook · spend menu.**

# BBTTCC Courtly Intrigue — Design Memo (S.2)

**Status:** Design doc · paper phase. Not yet authoring code.
**Last touched:** 2026-05-20
**Owner:** delnwyr (GM/designer)
**Companion files:** `scripts/raid-courtly.influence.enhancer.js` (engine) · `scripts/module.raid-console.js` (console integration §3448–3590) · `scripts/raid-maneuvers.js` (catalog) · `MANEUVER_CATALOG_SPEC.md` (sibling spec)
**Predecessors:** [[s3a-infiltration-engine-2026-05-15]] (UX precedent) · [[raid-visualization-sprint-handoff-2026-05-12]] (canvas-play vocabulary) · [[scenario-engine-preview-lies-pattern]] (engineering hazard) · `ea5ca2a` (preview-lies fix shipped 2026-05-20)

---

## 0. Vision

A Courtly Intrigue raid is **a tableau, not a battle map**. Picture the reference: a static backdrop (throne room, salon, war council, arcane archive, masked ball) with portrait-art tokens of named courtiers standing in the scene. Pseudo-3D depth — tokens farther "back" appear smaller. Floating holographic panels carry the scene's UI (favor tracks, suspicion bar, secrets, round log) so the canvas itself is the dashboard.

Movement is **optional but supported**. Most scenes are static (everyone in position). A few will have meaningful motion — sidling closer to whisper, retreating from an exposed scandal, stepping into the light. When motion happens, the depth-scale updates live.

The engine itself stays — influence HP, 4 actions, scandal, intimidate backlash — and gets **layered** with new tracks (Suspicion, Favor, Secrets, Faction-relationship deltas) and a **fuller anytime ladder**. Outcomes expand from 3 to 5, and the consequential ones leave **persistent marks** on actors and the faction relationship matrix.

---

## 1. Locked decisions (2026-05-20)

| Decision | Choice | Source |
|---|---|---|
| Scene model | Static backdrop + portrait-art tokens + depth-scale-by-Y | User Q1, image reference |
| Movement | Optional; supported via live depth-scale recompute | User Q1 |
| New mechanical tracks | Suspicion + per-NPC Favor + Secrets/Leverage cards + Faction-relationship deltas | User Q2 |
| Anytime ladder size | Full ladder, 8–12 maneuvers | User Q3 |
| End-of-raid outcomes | 5 flavored outcomes with persistent marks on winner+loser | User Q4 |
| Preview-lies bug | Already fixed (`ea5ca2a` 2026-05-20) | — |

---

## 2. Vocabulary

| Term | Meaning |
|---|---|
| **Tableau** | The scene + depth-scale setup for a courtly raid. Not "battlefield." |
| **Courtier** | A named NPC token on the tableau. Each has a Favor track. The PCs *target* courtiers; courtiers don't take damage. |
| **Influence (A/D)** | Faction-side social HP. Unchanged from current engine. |
| **Suspicion** | Cumulative rumor heat 0–10. Rises with expose/intimidate. Triggers reactions at thresholds. Visible in HUD. |
| **Favor** (per courtier) | –3..+3 disposition track. Persists on the NPC actor. **Court Bonus** = sum of favors of courtiers aligned with you, capped at ±5. |
| **Secret / Leverage** | A discrete item-flag earned via expose or specific anytimes. Spendable for a one-time effect. Persists until spent. |
| **Faction-relationship delta** | Outcome-driven nudge on the attacker↔defender relationship value (via existing auto-rel-nudge from [[economy-phase-cd-2026-05-09]]). |
| **Scandal Scar** | Persistent flag on an actor written by a Tarnished/Humiliation outcome. Visible on faction sheet. Penalty to future courtly attempts until laundered. |

**Do NOT use:** "social combat" (clinical), "diplomacy roll" (too narrow), "court HP" (use Influence).

---

## 3. The Tableau — scene + depth model

### 3.1 Scene-level configuration

A courtly scene is any Foundry scene with `flags.bbttcc-raid.tableau = { ... }`:

```js
flags["bbttcc-raid"].tableau = {
  enabled: true,
  frontY: 600,        // canvas Y for "closest to camera" (scale 1.0)
  backY:  150,        // canvas Y for "back wall"        (scale 0.40)
  minScale: 0.40,
  maxScale: 1.00,
  zSortByY: true      // higher Y (closer) draws on top
}
```

The GM sets these by dragging two markers on the scene editor (or via a sidebar tool). Defaults are reasonable for a 1920×1080 backdrop.

### 3.2 Per-token rendering

Tokens flagged as `flags.bbttcc-raid.tableauActor: true` participate in depth-scale:

- **Aspect:** width=1, height=2 grid units (or whatever the portrait art demands). Token art = portrait, not top-down.
- **Scale formula:** `scale = lerp(minScale, maxScale, (token.y - backY) / (frontY - backY))`, clamped.
- **Apply on:** `drawToken`, `refreshToken`, `updateToken` (for y changes). Visual-only (`token.mesh.scale.set(...)`); we do NOT persist scale to the document — the formula re-derives from Y each refresh.
- **Z-sort:** Token `sort` field set to `Math.round(token.y)`. Higher Y = drawn over lower Y. This keeps farther figures visually behind closer ones.

### 3.3 Grid + movement

- Grid type: **gridless** recommended (smoothest motion) but works with square/hex too.
- The tableau is not turn-based for *position*. Tokens move freely whenever the GM (or a maneuver that triggers movement) wants. Movement is narrative, not action-economy.
- For maneuvers that *involve* motion (e.g. "Sidle Closer" anytime), the maneuver handler nudges the token's Y by a small delta and lets the auto-scale handle the visual.

### 3.4 Holographic UI panels

The HUD lives **on the canvas**, not as a sheet window. Three floating panels (use the existing `_ftMakeHudDraggable` helper from [[ft-hud-draggable-helper]]):

1. **Influence + Suspicion panel** (top-left): two bars + suspicion meter + round chip.
2. **Courtier roster panel** (right side): list of NPC tokens with portrait thumbs and current favor pill. Click a row → ping the token; click favor pill → open Favor adjust dialog (GM only).
3. **Secrets & Leverage panel** (bottom-left, collapsed by default): inventory of held secret-cards. Drag to play.

Each panel persists position via `_ftMakeHudDraggable`'s storage key (`courtly:hud:influence`, `courtly:hud:roster`, `courtly:hud:secrets`).

Visual treatment: semi-transparent dark glass + cyan/violet glow to match the reference image's holographic feel.

### 3.5 Open canvas questions

- Does Foundry V13's PIXI mesh scale survive a `refreshToken` without thrashing? **Verify in spike.** Fallback: hook `canvas.app.ticker` and reapply each frame (cheap; tokens are few).
- How do we handle tokens that exit the tableau zone (Y above frontY or below backY)? **Clamp.** They sit at min/max scale.
- Hidden tokens (GM-only courtiers behind a curtain): respect Foundry's `hidden` flag; scale still applies for the GM's view.

---

## 4. Engine extensions

The existing `step()` stays as the per-exchange resolver. We add four parallel systems.

### 4.1 Suspicion track (0–10, per raid)

- **Starts** at 0 (neutral court) or higher if the GM seeds it.
- **Rises** automatically on: `expose` action (+1), `intimidate` action (+1), failed `expose` by 5+ margin (+2 extra: "everyone saw you reaching"), playing a Secret (+2 if it was Stolen, +0 if Earned via subtle anytime).
- **Falls** via: certain anytimes (Public Toast, Quote the Old Law, Stage a Distraction); maintaining 2 consecutive rounds with no expose/intimidate (–1 per quiet round).
- **Thresholds:**
  - **5+** — Court is uneasy. Expose actions get +1 to roll (rumors believed); Persuade actions get –1 (audience distracted).
  - **8+** — Crisis. A neutral courtier defects to whichever side has higher influence; outcome floor changes (no "Clean Triumph" available — minimum becomes "Tarnished Victory"). VFX: red glow around scene edges.
  - **10** — Court collapses; raid ends in **Public Humiliation** for whichever side has lower influence (or Mutual Ruin if tied).

### 4.2 Favor per courtier (–3..+3, persistent)

- Stored as `actor.flags.bbttcc-raid.courtFavor = { [factionId]: number }`.
- Each named NPC token on the tableau has a favor entry for the attacker and defender factions.
- **Shifted by:** anytimes targeting specific courtiers (Whispered Aside +1, Plant a Doubt –1 against opponent, etc.), and by outcomes (a Tarnished Victory writes –1 to all courtier-attacker favors).
- **Court Bonus:** at the start of each step, compute `sum(favorForSide, courtiersWithFavor>=1)` for each side, cap ±5, add to that side's roll bonus. Surface in the chat card.
- **Cross-raid persistence:** carries between sessions. Letting a courtier love you across multiple raids becomes a real campaign asset.
- **GM adjuster:** clicking a favor pill in the roster opens a small dialog: `–3 / –2 / –1 / 0 / +1 / +2 / +3`, plus an "ally to" radio (attacker / defender / both / neither).

### 4.3 Secrets / Leverage cards

- An Item document under a hidden compendium `bbttcc-master-content.courtly-secrets`, type `feat`.
- Each secret has: `name`, `description`, `effect` (one of: `+2 to one roll` / `force opponent to reroll` / `inflict 2 influence damage outside an exchange` / `clear scandal flag` / `+1 favor with chosen courtier` / `–1 favor between two courtiers`), `acquisition` (`earned` or `stolen` — affects suspicion when played).
- **Earned** via specific anytimes (Read the Room, Decipher a Cipher, Eavesdrop) — quiet, +0 suspicion when played.
- **Stolen** via aggressive anytimes or as a Lasting Mark from a previous Tarnished Victory — louder, +2 suspicion when played.
- **Inventory** lives on the holding actor as an embedded item with `flags.bbttcc-raid.secret = { acquisition, raidId }`. The Secrets panel on the tableau renders the holder's inventory; drag-to-play executes the effect and consumes the item.
- **Cap:** 5 secrets per faction at any time. Excess on acquire forces the faction to discard one (GM choice, or oldest).

### 4.4 Faction-relationship delta

End-of-raid outcomes nudge the attacker↔defender relationship via the existing auto-rel-nudge API (see [[economy-phase-cd-2026-05-09]]). Magnitudes:

| Outcome | Δ (attacker→defender) | Δ (defender→attacker) |
|---|---|---|
| Clean Triumph | –1 | –2 |
| Tarnished Victory | –1 | –1 |
| Stalemate | 0 | 0 |
| Public Humiliation (of attacker) | +1 | –2 |
| Mutual Ruin | –2 | –2 |

(Asymmetric because the loser's bitterness is usually stronger than the winner's contempt.)

---

## 5. Anytime maneuver ladder

Ten maneuvers, all tagged `engine:courtly`, fire-mode `anytime`. Each costs 1–2 OP from a specific category. Authored as compendium docs in `bbttcc-master-content.maneuvers` and entries in `scripts/maneuver-catalog.js`. Fire-mode tag registry in `scripts/effects-fire-mode-tags.js`.

| # | Name | Cost | Effect | Suspicion δ |
|---|---|---|---|---|
| 1 | **Whispered Aside** | 1 Diplomacy | Pick a courtier. +1 Favor to your side. | 0 |
| 2 | **Public Toast** | 1 Soft Power | Lower Suspicion by 1. Next Persuade by your side: +1. | –1 |
| 3 | **Plant a Doubt** | 1 Intrigue | Pick a courtier. –1 Favor to opponent's side. | +1 |
| 4 | **Quote the Old Law** | 2 Diplomacy | Lower Suspicion by 2. Cancels any one Scandal flag on the table. | –2 |
| 5 | **Read the Room** | 1 Intrigue | Draw 1 Earned Secret. GM reveals which courtier holds an opposing-side Secret. | 0 |
| 6 | **Stage a Distraction** | 1 Soft Power | Lower Suspicion by 1. Force opponent to discard one Stolen Secret if held. | –1 |
| 7 | **Forged Letter** | 2 Intrigue | Stolen Secret enters your hand. Suspicion +2 because it's *almost* convincing. | +2 |
| 8 | **Sidle Closer** | 1 Diplomacy | Move your visible token forward (scale up). +1 to your next Persuade or Inspire. Triggers tableau movement. | 0 |
| 9 | **Eavesdrop** | 1 Intrigue | Pick a courtier. Earn a Secret tied to that courtier (GM-flavored). | 0 |
| 10 | **Call the Question** | 2 Soft Power | Force the next exchange to resolve at +0 spend on both sides (caps spending arms-race). Lasts 1 round. | 0 |
| 11 | **Patron's Word** | Spend a Favor (–1 favor with a +2 courtier) | +3 to one roll. Cannot be Intimidate. | 0 |
| 12 | **Mask Off** | 1 Violence + clear a Scar | Convert your own Scandal Scar into +2 to one Intimidate this raid. Burns the scar. | +2 |

**Authoring note:** Each maneuver needs (a) compendium item doc, (b) fire-mode tag entry, (c) handler in the catalog. Reuses the S3a Infiltration pattern — see `raid-infiltration.alarm.enhancer.js` for handler shape.

---

## 6. End-of-raid outcomes (5 flavored, persistent marks)

Triggers based on final state of Influence + Suspicion:

| Outcome | Trigger | Marks written |
|---|---|---|
| **Clean Triumph** | Winner's Influence > 50% of max AND Suspicion < 5 AND no Scandal flags on winner. | **Winner:** +1 permanent Favor with all on-tableau courtiers (cap +3). **Loser:** –1 Influence cap on next courtly raid against this faction. **Rel-delta:** see §4.4. |
| **Tarnished Victory** | Winner's Influence ≤ 50% of max OR Suspicion ≥ 5, but no Scandal-on-winner at end. | **Winner:** 1 Earned Secret gifted, +1 Favor with 1 courtier (GM choice). **Loser:** **Scandal Scar** flag on faction actor (–2 to first roll of next courtly raid). **Rel-delta** applied. |
| **Stalemate** | Both sides Influence > 25% of max at round-cap, OR mutually conceded. | Both factions get 1 Earned Secret each. No Favor shift. No marks. **Suspicion** resets to 3. |
| **Public Humiliation** | Loser reaches 0 Influence AND had a Scandal flag at the end, OR Suspicion hit 10. | **Loser:** **Scandal Scar (heavy)** on faction actor (–3 to first roll, –1 to second roll of next courtly raid, plus visible "Disgraced" pip on faction sheet that lasts 3 sessions). **Winner:** +1 permanent Favor with 2 courtiers (GM choice). **Rel-delta:** worst of the table. |
| **Mutual Ruin** | Both sides ≤ 0 Influence on the same exchange. | **Both:** Scandal Scar (light). **Rel-delta:** –2 both ways. **Court:** loses 2 courtiers permanently (they retire in disgust); GM removes them from the roster. |

**Scandal Scar lifecycle:**
- Light: –2 to first roll of next courtly raid against any faction. Cleared by a Clean Triumph.
- Heavy: persists 3 sessions OR until cleared by a special "Laundering" non-raid action (separate design — out of scope for S.2).
- Stored as `actor.flags.bbttcc-raid.scandalScars = [{ severity, ts, sourceRaidId, clearedAt? }]`.

---

## 7. Implementation phases

### Phase A — Tableau MVP (canvas + depth-scale)
- Scene flag schema + GM editor sidebar tool (or macro) for setting frontY/backY.
- Token render hook applying scale-from-Y + sort-by-Y. Visual-only mesh scale.
- Portrait-aspect token sample art (or a debug colored rect for the spike).
- One throne-room backdrop authored as a Foundry scene.
- **Exit criteria:** drag a token in the tableau scene, see it scale + reorder live.
- **LOC estimate:** ~150–200.
- **Risk:** PIXI mesh-scale interplay with V13 token refresh. Resolve in spike before further phases.

### Phase B — HUD on canvas
- Three floating panels via `_ftMakeHudDraggable`: Influence/Suspicion, Courtier roster, Secrets.
- Bind to live `__courtlyScenario.getState()`.
- Roster reads from courtier tokens on canvas with the `tableauActor` flag.
- **LOC estimate:** ~250–300.

### Phase C — Engine extensions
- Suspicion track (state + step() integration + threshold reactions).
- Favor per courtier (storage + Court Bonus calc + GM adjuster dialog).
- Secrets compendium + inventory + draw/play handlers.
- Rel-delta wiring to existing auto-rel-nudge.
- **LOC estimate:** ~400–500.

### Phase D — Anytime ladder
- 10–12 compendium docs in `bbttcc-master-content.maneuvers`.
- Fire-mode tags + handlers in the catalog.
- Wire to fire-mode UI panel ([[raid-viz-phase-4d-fire-mode-ui-2026-05-14]]).
- **LOC estimate:** ~300 (mostly authoring + small handlers).

### Phase E — Outcome marks + flavor
- Outcome detector at end-of-raid (replaces current 3-way `outcome`).
- Scandal Scar flag writer + reader (faction sheet badge).
- Chat-card flavor variants per outcome.
- Disgraced pip on faction sheet (lasts 3 sessions).
- **LOC estimate:** ~200.

### Phase F — Polish + VFX
- Per-action VFX presets (whisper sparkle, scandal-pulse, court-collapse).
- Multiplayer relay: extend the `bbttcc-raid` socket (manifest flag already set per [[foundry-v13-socket-manifest]]) to broadcast favor shifts, suspicion crosses, secret plays.
- HUD theme to match reference image's holographic glow.
- **LOC estimate:** ~150–250.

**Total est.:** ~1500–1800 LOC across phases. Comparable to S3a Infiltration's ~860 LOC scope but with more authoring (12 maneuvers, scene art, outcome flavor).

---

## 8. Resolutions (2026-05-20)

All Phase-A-blocking questions from the original §8 are resolved:

1. **Scene art pipeline.** ✅ **Resolved.** User provides backdrops for MVP playtest; staff artist commissions for final product. No blocker.
2. **Courtier authoring UX.** ✅ **Resolved.** Ship each backdrop as a **pre-configured scene** with the desired NPC tokens already placed and seeded with starting favors. No runtime roster picker for v1. GM can still drag in extras manually. Eliminates ~80 LOC of picker UI.
3. **Player visibility of secrets.** ✅ **Resolved as recommended.** Opposing players see card-back + acquisition tag (Earned/Stolen) but not content. Suspicious shuffle is visible; intel is hidden.
4. **Token art aspect.** ✅ **Resolved.** User already produces portrait art with backgrounds removed (transparent-PNG silhouettes, full-body). Foundry's token width/height with `texture.scaleX/Y` handles aspect natively. No crop hack needed.
5. **Round cap.** ✅ **Resolved.** **6-round cap** ships for v1; if both sides still standing at round 6, outcome is Stalemate. Revisit after first playtest if pacing feels off.
6. **Crossover with Infiltration (now: Scenario Pivots).** ✅ **Resolved — promoted to its own design feature.** See §9 below. *All three scenario types (Violence / Infiltration / Courtly) can pivot to either of the others mid-raid.*
7. **VTT performance.** ✅ **Resolved.** Hard cap of **12 named courtier tokens** per tableau. Beyond that, FPS risk on per-frame depth recompute. Warning surfaced in scene-config tool if exceeded.

---

## 9. Scenario Pivots — all three can become any of the others

**User insight (2026-05-20):** "We already have a botched infiltration turning into a Violence raid or a negotiation. I think all have the opportunity to turn into all."

This is a real design feature, not just a courtly concern. Each scenario engine should support **entering FROM another scenario with carried state** and **exiting TO another scenario with carried state**.

### 9.1 The three transitions involving Courtly

| Transition | Trigger | State carry-in / carry-out |
|---|---|---|
| **Infiltration → Courtly** | Operative caught and brought before authority; or GM-narrated negotiation breakout | Alarm level → initial Suspicion (alarm 0–10 maps 1:1). Stolen items collected during infiltration → seed Secrets inventory (Stolen-tagged). Body-discovery flags → Scandal flag on attacker entry. |
| **Courtly → Violence** | Suspicion hits 10 AND no Stalemate condition met; OR a specific anytime escalates ("Mask Off" if used recklessly); OR GM call | Final Influence → starting morale modifier for each side's stewards (≥ 50% Influence: +1 morale; ≤ 25%: –1). Held Scandal Scars → –1 to a chosen combat roll. Court Bonus snapshot → initial favor-of-onlookers (any present courtier with +2 favor adds a stewards' worth of soft-power support to that side's first round). |
| **Courtly → Infiltration** | "Slip away mid-event" anytime maneuver (TBD, not in §5's 12); or GM call | Secrets inventory carries unchanged. Suspicion → initial alarm level. Active Scandal flag → +2 starting alarm. |

(Symmetric transitions — **Violence → Courtly** (parley), **Violence → Infiltration** (tactical retreat into stealth), **Infiltration → Violence** (already exists in legacy) — are out of scope for S.2 but should reuse the same `pivotState` carrier.)

### 9.2 Pivot mechanic

- New API: `game.bbttcc.api.raid.pivotScenario({ fromKind, toKind, fromState, attackerId, defenderId, label, gmOverride? })`
- Returns a fresh scenario instance of `toKind` with `state` pre-seeded per §9.1 table.
- The Raid Console row's `activityKey` is rewritten and the round HUD swaps.
- A chat card announces the pivot with flavor ("The masque shatters — steel drawn!").

### 9.3 Phase placement

Pivots are **Phase G** (post-MVP). The 6-phase rollout in §7 ships Courtly stand-alone first. Once the courtly engine is stable, Phase G adds Infiltration→Courtly carry-in and Courtly→Violence carry-out, then symmetric edges in a follow-on.

### 9.4 Cross-spec impact

This feature touches all three scenario engines. A separate brief design memo `SCENARIO_PIVOTS_SPEC.md` should be written before Phase G coding begins, capturing the `pivotState` carrier shape and the full 6-edge transition table. Out of scope for *this* memo.

---

## 10. What we are NOT doing in S.2

- **PC presence on the tableau as fighters.** PCs participate via maneuvers (their faction's anytimes) and via GM-narrated turns; they're not on the bar as a separate health track.
- **Multi-faction free-for-all.** Two factions per raid. Multi-faction courtly is a follow-on.
- **Branching narrative outcomes.** The 5 outcomes are mechanical. Story consequences are GM-authored, not codified.
- **Voice/audio cues.** Out of scope.
- **Laundering Scandal Scars.** Heavy scars persist; the mechanic to wash them off is a separate design.
- **The full Scenario Pivots system.** §9 captures the courtly-relevant transitions but defers full implementation to Phase G + a sibling `SCENARIO_PIVOTS_SPEC.md`.

---

## 11. Sign-off checklist

- [x] User reviews this memo and confirms the locked decisions (2026-05-20)
- [x] Open questions in §8 resolved (2026-05-20)
- [x] Memory entry [[project_courtly_intrigue_s2_design_memo_2026_05_20]] created to point at this file
- [ ] Phase A spike scheduled (depth-scale tech verification — PIXI mesh.scale + V13 refreshToken interplay)
- [ ] Backdrop assets received from user for first playtest scene (1 backdrop is enough to start)
- [ ] First scene authored: backdrop + 4–6 pre-placed named NPC tokens with starting favors
- [ ] Phase A LOC budget approved (~150–200)
- [ ] Sibling `SCENARIO_PIVOTS_SPEC.md` queued for after Phase F of this memo lands

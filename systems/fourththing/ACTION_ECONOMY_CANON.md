# BBTTCC Action Economy — Canon

**Status:** Locked 2026-05-19. Source of truth for combat action budgets across PCs, NPCs, Elites, Bosses, and Rigs.

This document defines the per-turn action budget. Implementation references back to specific call sites in `fourththing/module.js` so this canon and the code stay aligned.

---

## 1. Universal Baseline

Every actor — PC, NPC, Elite, Boss — has the same baseline each turn:

| Slot          | Count | Notes                                                    |
| ------------- | ----- | -------------------------------------------------------- |
| Action        | 1     | Buys 1 Strike OR 1 Invocation (see §2).                  |
| Bonus Action  | 1     | Only spendable on abilities tagged `activation:"bonus"`. |
| Reaction      | 1     | Triggered (see §3).                                      |
| Movement      | walk speed (ft) | Already wired via `system.actions.movementBudgetFt`. |

Slots reset on `FourthThingCharacterSheet._onFtNewTurn` (`module.js:10553`).

**Tier does NOT scale action count.** Extra strikes / extra invocations come from class features, not free tier scaling.

---

## 2. What 1 Action Buys

> **1 Action = 1 Strike OR 1 Invocation.** Not both.

Anything beyond a single strike or single invocation per Action must come from a class/path feature that explicitly grants it (e.g. Aurablade dual-strike, Cosmic Linguist twin-cast). Those features are authored to consume the appropriate slot.

### Enforcement points

- **Strikes:** `ftOpenEngageDialog` (`module.js:873`). Personal-weapon path must gate on `system.actions.actionUsed`. (Rig-weapon path at line 15570 already does.)
- **Invocations:** `castManifestation` (`module.js:2574`). Must gate on `system.actions.actionUsed` for `activation:"action"` items, `bonusUsed` for `activation:"bonus"`, and `reactionUsed` for `activation:"reaction"`. The dispatcher already maps activation→pool at `module.js:2704` (`POOL_KEY_FROM_TYPE`).
- **Combat menu** (Dash / Disengage / Hide / Aid / Dodge / Hold): already gated via `cost:"actionUsed"` (`module.js:4541+`). No change needed.

---

## 3. Reactions — Canonical Triggers

A reaction can be spent on **any one** of these per turn:

1. **Opportunity Strike** when an enemy leaves your reach.
2. **Defensive ability** triggered by being hit / targeted (Parry, Shield Block, Counterspell-style).
3. **Aid / Assist** on an ally's roll within range.
4. **Manifestation** explicitly authored with `activation:"reaction"`.

Reaction-trigger UI surfaces should set `system.actions.reactionUsed = true` before resolving (pattern at `module.js:14607-14619`).

---

## 4. Rigs

**Rigs do not roll initiative.** Crew act on their own turns. The Rig is a platform; crew are the actors.

| Crew role  | Turn spend                                           | Gate                                                    |
| ---------- | ---------------------------------------------------- | ------------------------------------------------------- |
| Pilot      | 1 Action → 1 vehicle maneuver (Steer/Hold/Evasive/Brace/Ram/Repair) | `pilotActionUsedThisRound` + `system.actions.actionUsed` (`module.js:15441`) |
| Gunner     | 1 Action → 1 rig weapon fire                         | `system.actions.actionUsed` + per-gunner-per-weapon flag `rigWeaponsFiredThisRound[weaponId]` |
| Engineer   | 1 Action → repair / brace                            | `engineerRepairedThisRound` + `actionUsed`              |

Crew can spend their Bonus and Reaction normally while boarded. All rig combat gates reset via the pilot's `_onFtNewTurn`.

### Shots per weapon per round

> **A rig weapon can fire up to N times per round, where N = number of gunners on the rig.**

This is a natural consequence of the gunner gate above:

- Each gunner spends 1 Action to fire 1 weapon (`actionUsed` gate).
- The per-gunner-per-weapon flag stops a single gunner from double-tapping the same weapon in the same round.
- A 1-gunner crew on a 4-weapon rig therefore fires only 1 weapon/round. Multi-gunner crews stack: 3 gunners can all fire the same weapon → 3 shots that round, OR each fire different weapons.

**Per-weapon rate of fire** (autocannon faster, siege slower) is deferred. When authored, it lives as `flags.fourththing.rigGear.shotsPerRound` on the weapon item and overrides the default per-gunner-per-weapon cap. Not in Phase A scope.

---

## 5. Elites

Elites sit between Standard NPC and Boss.

- Standard 1 + 1 + 1 baseline.
- **+1 Bonus Manifestation per round** — free, does NOT consume the bonus-action slot. Once per round, fires from the Surge pool like any boss manifestation.

**Flag:** `flags.bbttcc-auto-link.eliteTier: true` on `type:"character"` + `entityKind:"npc"` actors.

**Reset:** `flags.fourththing.combat.bonusManifestationUsedThisRound` is per-ROUND, not per-turn. Cleared via `_ftClearPerRoundCombatFlags` on Combat-tracker round advance and `bbttcc:raid:roundCommit`. The `_onFtNewTurn` button does NOT clear it (correct — fresh turn within the same round preserves the spent bonus mani).

**Behavior:** When an elite tries to cast an Action-typed manifestation and `actionUsed` is already burned, the cast is permitted and `bonusManifestationUsedThisRound` is burned in its place. Order is opportunistic — elites always prefer to spend the action slot first; the bonus mani is a fallback for a second cast.

---

## 6. Bosses

Bosses scale through manifestation budget and legendary actions, **not** action-count multiplication.

### 6.1 Baseline

Same 1 + 1 + 1 + Movement as everyone else.

### 6.2 Manifestation Slots

> **Manifestation Slots per round = Boss Tier.**

| Tier | Slots / round |
| ---- | ------------- |
| T1   | 1             |
| T2   | 2             |
| T3   | 3             |
| T4   | 4             |

Replaces today's unlimited-cast loophole. Each `castManifestation` call by a boss debits one slot. Slots refill on round start (Combat hook, not per-turn).

**Flag:** `flags.fourththing.bossManifestationSlots = { max: <tier>, current: <n> }`.

**Refill points:** `_ftRefillBossManifestationSlots(actor)` writes `{ max:tier, current:tier }`. Called from:
- `Hooks.on("updateCombat")` when `round` advances forward — refills any boss combatants.
- `Hooks.on("bbttcc:raid:roundCommit")` via `_ftClearAllBoardedPerRoundFlags` — refills every boss in the world (raid scenes don't always use the Foundry combat tracker).
- Lazy init at cast time when the flag is absent (fresh boss = full slots).

**Stale state across sessions:** If a session ends with a boss mid-cast (e.g. 1/3 remaining), the slot persists. Next round-advance refills. Edge case acknowledged; not patched in Phase B core.

### 6.3 Legendary Actions (T3+)

| Tier | Legendary Actions per round |
| ---- | --------------------------- |
| T3   | 1                           |
| T4   | 2                           |

Usable **between PC turns** (after any PC's turn ends, before the next begins). Refill on round start.

**Legendary menu** — a Legendary Action can be spent on:

1. **Move** (up to half speed).
2. **Strike** — 1 weapon attack. Does NOT consume the boss's normal Action.
3. **Cast a Manifestation** — fires through `castManifestation`. **Counts against Manifestation Slots** (§6.2) — pressure trade between save-the-cast and cast-now.
4. **Authored ability** — authored 2-3 entries per boss (e.g. "Aura Pulse", "Summon Mook"). Lives in `flags.fourththing.bossLegendaryActions.menu`, surfaced in the legendary UI.

**Implementation surfaces:**

- **Flag shape:** `flags.fourththing.bossLegendaryActions = { max, current, menu: [{ id, icon, label, description }] }`. `max` is derived from tier each refill (T1/T2=0, T3=1, T4=2). `menu` persists across refills.
- **Refill points:** `_ftRefillBossLegendaryActions(actor)` invoked alongside `_ftRefillBossManifestationSlots` on `updateCombat` round advance and `bbttcc:raid:roundCommit`.
- **Sheet UI** (`boss-sheet.hbs` Combat tab): "Round Resources" panel shows `X/Y Mani Slots` + `X/Y Legendary` with a `Spend` button (disabled when `current === 0` or `max === 0`). "Legendary Menu" panel below for authoring (add / remove); built-ins are always available in the picker regardless of menu state.
- **Picker dialog** (`_onFtBossLegendaryOpen`): lists 3 built-in entries + N authored entries. Click debits 1 slot, emits a violet chat card (`_ftPostBossLegendaryChat`), GM resolves the action manually (strike roll, narrative move, or library Cast click).
- **"Counts against Manifestation Slots" coupling:** intentional decoupling — the Cast legendary entry just signals intent; the GM clicks Cast on a library item, which Phase B's gate debits independently. Two debits for one cast (1 Legendary + 1 Mani Slot) is the canon pressure.
- **Boss-builder template pre-seed:** deferred. `BOSS_TEMPLATES` could carry a `legendaryMenu:[...]` field that the builder writes through; today the GM authors each entry on the sheet.

**Flag:** `flags.fourththing.bossLegendaryActions = { max: <0|1|2>, current: <n>, menu: [<entry>] }`.

---

## 7. Implementation Phases

- **Phase A — Baseline gates.** Gate personal-weapon `ftOpenEngageDialog` and `castManifestation` against `actionUsed`/`bonusUsed`/`reactionUsed`. Honor `activation:` on items.
- **Phase B — Boss/Elite economy.** Manifestation Slots on bosses (Tier-many per round), Elite bonus manifestation flag, round-start refill hook.
- **Phase C — Legendary Actions.** Boss legendary UI (menu, between-turn fire), boss-builder field for authored legendary entries.

Ship each phase + playtest before moving to the next.

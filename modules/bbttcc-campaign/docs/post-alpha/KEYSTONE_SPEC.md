# KEYSTONE — the classless build · spec
### `fourththing` + `bbttcc-master-content` · **v0.1 DRAFT — 2026-09-05** (8 rulings open, §6)

**Thesis.** Paths (classes) stop being a *type of thing a Steward is* and become
*a recommended way to spend picks*. The pool of 275 path feats already in
`bbttcc-master-content.classes` becomes the menu. A Steward buys **keystones**
(engines), **principles** (path features) and **refinements** (doctrine rungs)
against a slot budget, gated by tier, attribute and prerequisites. The nine
paths survive as **exemplars** — pre-filled pick lists the sorting engine can
suggest and a player can accept, edit or ignore. There is no multiclassing
because there is nothing to multi: a second keystone is just an expensive pick.

**Design laws** (engine retrospective, unchanged): events are the spine · one
authority per fact · seat model once · chain as object · lint from day one.
The fact this spec makes single-authority: **"what can this Steward do" = the
feat items on the actor.** Never the class identifier.

---

## 0. Vocabulary

| Term | Means | Today's equivalent |
|---|---|---|
| **Keystone** | The feat that *installs an engine* — a resource pool or state track with its own UI and Surge entries (Burn, Frame dice, Access dice, Resonance, Forge, Mandate, Refraction, Pact ledger, Lexicon). | Class core / Tier 1 feature |
| **Principle** | A standalone path feature. Uses an engine if one is present; otherwise inert or narrative. | Class Features folder items |
| **Refinement** | A rung on a doctrine **chain**. Rung N requires rung N-1 and a level. | Subclass L1/5/9/13/17 features |
| **Chain** | An ordered doctrine ladder, entered at rung 1. Chain as object: one document lists its rungs. | Subclass item + folder |
| **Exemplar** | A named recommended build: ordered picks by level. | Class item |
| **Slot** | The pick currency. Granted by level. | (implicit: "you get what your class gets") |
| **Gate** | An attribute floor on a pick (e.g. Soul ≥ 3). | none |

## 1. What exists (evidence — `KEYSTONE_AUDIT_2026_09_05.md`)

- **275 feats** across 9 paths / 27 doctrines. Class items are shells
  (identifier + prose). Audit proposes **14 keystones · 103 principles · 158
  refinements**.
- **Unlock level**: 247 stamped in `system.prerequisites.level`; **28 have no
  derivable level** (5 Cosmic Linguist, 3 Pactkeeper, **20 Soul-Smith** — the
  whole Forge doctrine set is unleveled). 0 stamped/prose conflicts.
- **Payload**: 108 feats are prose-only (no AE / grants / triggers / activities /
  uses). Highest: Pactkeeper 24/29, Cosmic Linguist 21/25, Aurablade 17/20.
  These are narrative principles; under the rubric they still cost a slot.
- **Structured prerequisites**: `system.prerequisites.items` exists on every
  feat and is populated on **zero**. That is the field this spec fills.
- **Runtime class-keying** (what must change):
  - `detectActivePools` / `ftBurnClassFor` / `_ftActorMatchesClass` — all match
    `class` OR `feat` identifiers by `<slug>_` prefix. *Already half feat-driven.*
  - Surge menu: 136 entries, **113 gated** (41 `classFilter` + 72 doctrine gates
    reading the subclass item).
  - `applyPathFeatures` — grants by compendium *folder* under the class item;
    `deriveItemUnlockLevel` regexes prose for levels.
  - `FEATURE_ROUTER` (184 keys) — per-feature already; no change.
  - Sorting engine v2 resolves class → doctrine; starter kits keyed `{path, doctrine}`.

## 2. The rubric (proposed — rulings in §6)

### 2.1 Slot budget
| Level | Grants | Notes |
|---|---|---|
| 1 | **1 keystone + 1 chain entry + 1 principle** | Chain entry = rung 1 of any chain whose engine you hold (R3). |
| 3, 5, 7, 9, 13, 15, 17, 19 | 1 slot | Odd levels = picks (skill points already land on 3/6/9/12/15/18). |
| 6, 11, 16 | keystone **tier-up** (free) | The keystone's T2/T3/T4 growth features are the keystone's own — not picks. |
| 11 | +1 slot, may buy a **second keystone** (cost 2) | The "multiclass" door, opened once, at Tier 3 (R1). |
| 20 | capstone slot (any rung 5, any chain you're in) | |

Total by L20: 1 keystone (+1 optional) · ~10 slots · 3 free tier-ups. A
single-path character today receives ≈ keystone + 3 tier features + 5 doctrine
rungs + a handful of principles ≈ the same shape. **The rubric is calibrated so
every current class build is legal and costs the whole budget.**

### 2.2 Costs
| Kind | Cost | Extra rule |
|---|---|---|
| Keystone (first) | free at L1 | one per Steward until L11 |
| Keystone (second) | 2 slots | L11+; its tier-ups then ride the same 6/11/16 clock relative to purchase (R2) |
| Principle | 1 | requires its engine's keystone if `engine` is set; inert-if-missing is NOT allowed (R4) |
| Refinement | 1 | requires previous rung + rung level (1/5/9/13/17) + the chain's engine |
| Retrain | swap 1 pick per tier-up | keystones never retrain (R6) |

### 2.3 Gates
Every keystone carries an attribute floor. Proposed (R5 — **Dave rules the
column**; these are my read of each engine's register):

| Engine | Keystone | Gate |
|---|---|---|
| Burn + Aura | Aurablade Core | Violence 3 |
| Frame Dice + Ruin | Bulwark Founding Stance | Body 3 |
| Access Dice | Shadow Courier Liminal Operator | Intrigue 3 |
| Resonance | Dreamwalker Oneiric Reservoir | Soul 3 |
| Forge | Soul-Smith Sanctified Forge Initiate | Body 2 + Soul 2 |
| Mandate | Harmony Marshal Initiate | Presence 3 |
| Refraction | Wyrdlens Lens Read | Mind 3 |
| Pact ledger | Pactkeeper The Bargain | Presence 2 + Mind 2 |
| Lexicon | Cosmic Linguist True-Name Touch | Mind 2 + Soul 2 |

Principles and refinements inherit their engine's gate; a few may carry their
own (worksheet column `gate`).

## 3. Data model

One flag, one authority. Stamped onto each feat in the pack by the P0 macro
(reads the worksheet):

```js
flags.fourththing.keystone = {
  kind:     "keystone" | "principle" | "refinement",
  engine:   "burn" | "frame" | "access" | "resonance" | "forge" | "mandate" | "refraction" | "pact" | "lexicon" | null,
  chain:    { id: "<subclass identifier>", rung: 1..5 } | null,
  gate:     { violence?: n, intrigue?: n, presence?: n, body?: n, mind?: n, soul?: n },
  cost:     1 | 2,
  exemplars:["aurablade", ...]           // which recommended builds list it (derived, for UI)
}
system.prerequisites.level = <n>        // already canonical; the 28 gaps get stamped
system.prerequisites.items = ["<prev rung id>", "<keystone id>"]   // the prereq graph, finally populated
```

Exemplar (class item, unchanged type — becomes a template):
```js
flags.fourththing.exemplar = { picks: [{ level: 1, featId }, { level: 3, featId }, ...] }
```
Chain (subclass item, unchanged type): `flags.fourththing.chain = { engine, rungs: [featId ×5] }`.

**Engine presence** becomes a pure function: `engineOf(actor) = set of
keystone.engine over actor.items`. Every reader of "is this actor an X" in
`ft-class-automation.js` and `module.js` reroutes through it.

## 4. Build plan (phases — each independently shippable, class builds stay legal throughout)

| Phase | Deliverable | Touches | Player-visible? |
|---|---|---|---|
| **P0 Stamp** | Worksheet ruled → `stamp-keystone-metadata.macro.js` writes the flag + prerequisites onto all 275 feats; export `_source`; lint (`bin/ft-keystone-audit --lint`: every feat has kind, level, engine-or-null; every refinement has a chain + rung; every chain has 5 rungs; every principle with an engine has a reachable keystone). | pack only | no |
| **P1 Engines by keystone** | `engineOf(actor)`; `detectActivePools`, `ftBurnClassFor`, `_ftActorMatchesClass`, the 113 Surge gates → read engine/chain from feat flags instead of class/subclass items. Class item becomes optional for play. | `ft-class-automation.js`, `module.js` | no (identical outcomes for existing actors) |
| **P2 Picker** | "Principles" tab gains **⊕ Choose a Principle**: budget readout, eligible list (tier · gate · prereqs · slots), exemplar filter ("show me the Aurablade way"). `applyPathFeatures` retargets to "apply exemplar picks up to my level" — same button, template-driven, no folder walk. Level-up hook offers the pick instead of auto-granting. | sheet template + `ft-progression.js` | **yes** |
| **P3 Downstream** | Sorting engine returns an *exemplar* (same resolver, renamed output); starter manifestation kits keyed by keystone engine; incarnation forge / onboarding copy; guides. | sorting-engine, character-options, onboarding | yes |

P0 is the labor (Dave rules ~40 cells; the rest derive). P1 is the risk (113
gate sites, but mechanical). P2 is the feature. Ship P0+P1 in one release with
zero rules change; P2 is the moment the game becomes classless.

## 5. Lint from day one
`bin/ft-keystone-audit` grows a `--lint` mode in P0 that fails on: missing
kind/level; refinement without chain/rung; chain with ≠5 rungs; engine
principle whose keystone doesn't exist; keystone without gate; exemplar whose
picks are illegal under §2 (that last one is the self-check that every current
class is still a valid build).

## 6. Rulings needed

| # | Question | My recommendation |
|---|---|---|
| R1 | When may a second keystone be taken? | L11 (Tier 3), cost 2. Never a third. |
| R2 | Second keystone's tier-ups: on the level clock (6/11/16 → it arrives at T3 already) or relative to purchase? | Relative to purchase (T2 five levels after, etc.). Late engines stay young. |
| R3 | Can you enter a chain whose engine you don't hold? | No. Chains are the *voice* of an engine. |
| R4 | Engine-principle without keystone: forbidden, or allowed-but-inert? | Forbidden. Inert picks are traps. |
| R5 | Gate table §2.3 | rule the column; 3 is "one point above baseline 2" |
| R6 | Retraining | 1 swap per tier-up, keystones never. |
| R7 | The 108 prose-only feats — do they cost a full slot? | Yes, but P0 flags them `narrative:true` so the picker shows it honestly. Pricing them at 0 makes them mandatory. |
| R8 | Name. "Keystone" is my word for the engine-installing pick. | Keep it, or give it a Bad Eden word. The flag name follows the ruling. |

## 7. Risks
- **The engine-less character.** A Steward who takes only principles and no
  keystone has no pool UI and half the Surge menu dark. §2.1 makes the L1
  keystone mandatory, which closes it.
- **Exemplar drift.** If nobody re-runs the lint when a feat is re-leveled, the
  Aurablade "class" silently becomes an illegal build. Lint is CI for content.
- **Surge menu combinatorics.** Two engines = two sets of Surge entries. The
  menu already filters per entry, so it composes; the UI may need bucket
  headers by engine.
- **Guides + Bible** narrate nine classes. Nothing breaks; the words become
  "the nine exemplars" and the third guide gains a chapter.

## 8. Not in scope
Ancestry/heritage feats (own pool, own rubric later) · manifestation kits'
contents · faction doctrines (`doctrines` pack = raid maneuvers, unrelated) ·
NPC/monster stat blocks (monsters have no aptitude requirements and no picks).

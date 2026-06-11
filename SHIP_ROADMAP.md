# SHIP ROADMAP — Bad Eden / Roll For Initiation

> **Living document.** Started 2026-05-26. Target ship window: ~mid-2027 (Foundry VTT marketplace).
> This is the canonical planning artifact for the road to ship. Refine it over time; don't re-derive it each session.
> Update the **Status**, **Decision Log**, and **Open Questions** sections as things change.

---

## 0. How to use this doc

- **Status line** below = the one-glance "where are we." Keep it current.
- **Decision Log** (§7) = locked choices + the reasoning, so we don't relitigate.
- **Open Questions** (§8) = unresolved forks that block or shape work.
- Everything else is the plan. The plan is allowed to change — when it does, note why in the Decision Log.

**STATUS (2026-06-10):** Phase 0 in progress (~40%). Architecture + ID strategy locked (two-layer; per-layer phased rename). **Display rebrand largely landed** (commits R1→R4b: identifier-aware BBTTCC→Bad Eden / Fourth Thing→RFI across modules `.js`, `lang`/`.hbs`/`.css`, master-content JSON, + live-world scrub macro). **Migration framework landed** (`systems/fourththing/migrations/` + `flags.fourththing.schemaVersion`, system v0.6.1 — baseline v1). Repo hygiene partial (`58b0ddf` untracked 317 strays + gitignored LevelDB artifacts; `$HOME` backup sprawl remains). Still NOT started: combat/actor adapter seam, marketplace research. Playtest/refinement continues on the live build in parallel.

---

## 1. The goal

Ship to the Foundry VTT marketplace on a ~1-year horizon, in two product lines:

1. **D&D5E first** — system-agnostic engines (campaign, hex map, raid/siege, factions) running on `dnd5e`.
2. **Roll For Initiation second** — the bespoke Bad Eden system + content, built on the same engines.

Four workstreams the owner identified, reframed in §2:
1. **Branding** — world setting `BBTTCC → Bad Eden`; system `Fourth Thing / fourththing → Roll For Initiation (RFI)`.
2. **Consolidation** — fewer installs; collapse the 21-micro-module sprawl into coherent packages.
3. **D&D5E parity** — release model is dnd5e first, then RFI.
4. **Chunk out engines for separate sale** — campaign / hex map / raid as system-agnostic standalone modules.

---

## 2. The reframe: 4 goals → 2 product lines on a layered architecture

The four goals are in tension as a flat list ("consolidate to one install" vs. "split for separate sale"). They resolve cleanly as **two layers**:

- **Layer A — system-agnostic engines.** Decoupled from the RFI system, sold standalone, run on dnd5e (and later other systems). **This is the D&D5E-first product line.**
- **Layer B — Bad Eden / Roll For Initiation.** The bespoke system + content + glue. Depends on Layer A.

**Key insight: goals 3 and 4 are the same goal.** The decoupled engines on dnd5e *are* the first marketplace entry. RFI is the second release on the same engines. "Consolidate" = collapse 22 units into a handful of coherent packages **per layer** — not one mega-module.

Branding maps onto the layers:
- **Layer A** → neutral / studio-brand product names (NOT "Bad Eden" — that's the world).
- **Layer B** → "Bad Eden" (world/content) + "Roll For Initiation" (system).

---

## 3. Current state (recon snapshot, 2026-05-26)

Canonical code: `/Users/gamingaccount/modules/` (21 modules) + `/Users/gamingaccount/systems/fourththing/` (1 system). ~200K LOC.
(Ignore the dozens of dated backup folders in `$HOME` — see §9 hygiene.)
Canonical git branch = **`origin/monorepo-init`** (NOT `main` — see memory `project_git_rebaseline_2026_05_25`).
Live: two pm2 Foundry instances on Lightsail with **real saved worlds** using these flag scopes + system ID → renames are **data migrations**, not find/replace.

### Dependency hubs
- `bbttcc-core` — the `game.bbttcc.api` registry. Foundation.
- `bbttcc-territory`, `bbttcc-factions`, `bbttcc-raid` — depended on by many.
- `bbttcc-campaign` — top-level aggregator; pulls in 6 others.

### The dnd5e scaffolding finding (this flips the effort model)
This is **not** "a fourththing system with aspirational dnd5e flags." It's the **inverse**: the original BBTTCC dnd5e module suite with a custom system (`fourththing`) grafted on. Evidence (dnd5e refs in code):

| Module | dnd5e refs | What it means |
|---|---|---|
| `bbttcc-raid` (37K LOC) | **0 in code** | Siege/strategy logic is system-agnostic; fourththing coupling is a thin **damage-resolution seam** only |
| `bbttcc-factions` | 1 comment | Effectively agnostic |
| `bbttcc-campaign` | 2 (one generic HP deduction) | Effectively agnostic |
| `bbttcc-territory` | ~4 (`flags.dnd5e.skills.*.adv` AE writes) | Trivially abstractable |
| `bbttcc-auto-link` | **47 — real dnd5e v5** | Live, sophisticated dnd5e integration (`dnd5e.preUseActivity`, advancement objects, sidebar Class Resources card) |
| `bbttcc-master-content` | **787 — dnd5e-schema content** | Content authored in dnd5e item format (`flags.dnd5e.originType`, dnd5e damage types) |
| `esoteric-magic` | 9 — real | Complete working dnd5e spell-correspondence module |

**Conclusion:** Layer A engines are closer to **dnd5e-ready** than to fourththing-locked. "Pivot back to dnd5e" = returning engines to their native habitat. Bespoke coupling is concentrated in the `fourththing` *system* + the thin raid damage seam. *(Update 2026-06-10, D6: `bbttcc-structures` is Layer A too — its damage model is already agnostic; see `ADAPTER_SEAM_PREP.md`.)*

### System config (`systems/fourththing/system.json`)
- id `fourththing`; title already hybrid: *"Roll for Initiation (Bad Eden Core Rules)"*; version 0.6.0.
- compatibility min 11 / verified 13. Actor types: `character, npc, rig, boss`. Item types incl. RFI-specific `spark`.
- **No migration framework** (no `schemaVersion`, no upgrade hooks) — migrations are ad-hoc macros today. **This must be added before more saved-data shapes accumulate.**

---

## 4. Target architecture (22 units → ~10 coherent packages)

### Layer A — agnostic engines (dnd5e first), each behind a combat/actor adapter
| Product | Built from | Coupling to break |
|---|---|---|
| Faction & OP Engine | `factions` + `core` API registry | none meaningful |
| Hex Overworld / Campaign Map | `territory` (+ `travel`, `encounters`?) | a few skill-advantage AE writes |
| Raid & Siege Engine | `raid` (+ `aae`) | thin damage-resolution seam |
| Campaign Beat Engine | `campaign` | one HP deduction |
| AI GM / Faction Advisor | `mal-voice` | already provider-abstracted; sellable solo |

### Layer B — Bad Eden / Roll For Initiation (ships second; depends on Layer A)
- `fourththing` → the **Roll For Initiation** system (rigs / manifestations / frame dice). ⚠️ **Structures moved to Layer A (D6, 2026-06-10)** — they must be damageable on dnd5e directly, so the structure damage model is system-agnostic and rides the combat adapter as a registered interceptor, NOT folded into the RFI system. Only `collapse.js`'s knockback/prone secondary effects stay RFI-flavored (via adapter methods).
- `master-content` → **Bad Eden Content**.
- `auto-link` + `character-options` → **Character Builder** — ⚠️ `auto-link` is *also* the dnd5e-sheet bridge, so it must be **decomposed**: the dnd5e-bridge part belongs to Layer A, the Bad-Eden-builder part to Layer B.
- Long tail (`tikkun`, `radiation`, `esoteric-magic`, `market`, `facility-console`, `world`, `fx-integration`, `sorting-engine`) → collapse into **2–3 Bad Eden packages**. This is where most of the "fewer installs" win lives. (Standalone-sale candidates TBD — Open Q #1.)

### The linchpin: one thin adapter interface — REMAPPED 2026-06-10 → see `ADAPTER_SEAM_PREP.md`

> ⚠️ **The 2026-05-26 map below is partly stale.** A fresh recon (2026-06-10,
> in `ADAPTER_SEAM_PREP.md`) corrects it: fulcrum is now `module.js:13771` (not
> 9924); real cross-module call sites are **~7, not ~30**; only `applyDamage` is
> called cross-module (the other 7 methods are system-internal); and **`bbttcc-
> structures` monkey-patches the fulcrum** (`damage-wedge.js`) — an extraction
> blocker the original map missed. Resolve the wedge strategy before swapping
> call sites. Prep doc has the step order + open questions.


All of Layer A depends on a single **combat/actor adapter** (`game.bbttcc.combat`). The seam is far narrower than feared: **almost the entire combat coupling funnels through ONE function** — `game.fourththing.rolls._applyDamageToActor(actor, amount, opts)` (defined `systems/fourththing/module.js:9924`). Every damage path in `raid` + `structures` (AOE scene intents, maneuver resolution, agent verbs, collapse, the damage-wedge — ~30 call sites) calls that single signature. That function is a monster of RFI-specific mechanics (surge one-shots, Bulwark/Aurablade frame dice, radiation thresholds, integrity tracks, type immunities/resists/vulns) — but **none of that leaks to callers**; they just say "deal N damage of type X" and get a description string back. The whole bespoke model lives *behind* the seam.

⚠️ **Correction:** `bbttcc-bridge.js` (in `core` and the system) is NOT the combat adapter — it's a *resource-sacrifice/faction-OP* bridge + a *character-identity* bridge (echo assets, class/ancestry swaps). The real adapter seed is the `game.fourththing.rolls.*` namespace + `game.fourththing.{resistsForcedMove, applyManifestationStates}`.

**The 8-method contract** (RFI impl already exists; dnd5e impl = thin wrappers over native):
```
applyDamage(actor, amount, {damageType, track="integrity", nonlethal, ignoreResists}) → string   ← fulcrum (~30 sites)
heal(actor, amount, {track}) → string
getHealth(actor, {track}) → {value, max}            // rig integrity vs dnd5e hp
getRole(actor) → "character"|"npc"|"rig"|"boss"
resistsForcedMove(actor, {reason}) → boolean         // collapse knockback gate
applyCondition(actor, caster, cond, {states, duration, dc})   // applyManifestationStates / prone
hasCondition(actor, key) → boolean
rollCheck(actor, {kind, key}) → Roll                 // attributeTest / dnd5e rollSkill
(+ optional UI: openEngageDialog / openCastDialog — RFI-only, feature-gate off on dnd5e)
```
**Extraction mechanic:** define `game.bbttcc.combat` → RFI registers its impl (logic already exists, just rename the entrypoints) → write a dnd5e impl wrapping `actor.applyDamage`/`rollSkill`/status-effects/`system.traits.dr|di|dv` → swap engine call sites from `game.fourththing.rolls._applyDamageToActor(...)` to `game.bbttcc.combat.applyDamage(...)` (same args, same return). Engines then name `fourththing` nowhere.

**Difficulty by module:** `factions`, `aae` = already zero-coupling. `campaign` = trivial (uses dnd5e-native `actor.rollSkill`/`hp` already). `raid` = moderate (all damage via the one signature, ~3 files). `structures` = low (concentrated in ~4 files, same signature). `territory` = moderate (11 calls, all in the player HUD → feature-gate it). The coupling is *pooled*, not spread — this is "insert an adapter layer + update call sites," not "rewrite the engines."

**Branding bonus:** the system bridge ALREADY dual-reads `flags.fourththing.echoAssets ?? flags["roll-for-initiation"].echoAssets` (bbttcc-bridge.js:906,1004) — the read-new-or-old / write-new pattern is exactly the right template for the eventual `fourththing → rfi` flag migration.

---

## 5. Branding & ID strategy (LOCKED — see Decision Log D2)

**Two kinds of "name":**
- **Display strings** (titles, descriptions, UI): `BBTTCC → Bad Eden`, etc. **Cheap, decoupled — rebrand anytime.**
- **Referential identifiers** (module IDs `bbttcc-*`, system ID `fourththing`, flag scopes, settings namespaces, socket channels, pack `system:` fields, asset paths): **load-bearing. Renaming = saved-world data migration.**

**Governing rule:** A published Foundry package ID is **permanent**. Renaming post-publish orphans every install. So the ID rename must happen **before first publish of each product**, and **after** that product's architecture is final (so you never migrate twice).

**Strategy = per-layer phased rename:**
1. **Display rebrand now** — free, do it whenever convenient.
2. **Layer A engines** — assign final clean, neutral IDs **at extraction time** (they're effectively new products; no customers to migrate; your own worlds migrate once).
3. **`fourththing` system ID** — heaviest migration (every saved flag + pack `system:` field), and ships **second** → keep `fourththing` internally through the dnd5e launch; rename it during RFI-release prep with a one-time world-migration script.

---

## 6. Sequencing / phases

> Phases overlap with ongoing playtest. Playtest/refinement continues until ship regardless.

**Phase 0 — Foundations (start now, cheap, low-risk)**
- [x] Display rebrand pass (BBTTCC → Bad Eden, Fourth Thing → RFI) in titles/descriptions/UI. — *R1→R4b; identifier-aware (load-bearing IDs preserved). Spot-audit for stray display strings still worthwhile.*
- [x] Add `schemaVersion` + migration-hook skeleton to the `fourththing` system. — *2026-06-10: `systems/fourththing/migrations/index.js` (version registry + GM-gated run-once-per-world `ready` runner, advance-after-each-step, idempotent contract) + hidden world setting `fourththing.schemaVersion` + manifest `flags.fourththing.schemaVersion: 1` + `game.fourththing.migrations` debug API. Baseline = v1 (no-op stamp). System bumped 0.6.0→0.6.1. The eventual `fourththing→rfi` rename is now just one more numbered entry.*
- [ ] Define the **combat/actor adapter interface**; route the existing raid/structures damage seam through it (no behavior change yet). ← *next-highest leverage; seam already mapped (§4, D3).*
- [~] Repo hygiene (§9). — *partial: `58b0ddf` untracked 317 strays + gitignored LevelDB artifacts. Remaining: `$HOME` backup-folder sprawl; consider moving workspace out of `$HOME`.*
- [ ] Research current Foundry marketplace packaging rules / premium-content reqs / art-license reqs for the ~2027 window (standalone task; don't assert from memory).

**Phase 1 — Decouple Layer A**
- [ ] Map every fourththing touchpoint in `raid`, `territory`, `campaign`, `factions` (most are already thin — see §3).
- [ ] Implement the `dnd5e` adapter behind the interface.
- [ ] Decompose `auto-link` (dnd5e-bridge → Layer A; Bad-Eden-builder → Layer B).
- [ ] Re-validate engines on **current dnd5e v5** (Foundry + dnd5e have moved since the original BBTTCC era).
- [ ] Assign final Layer A package IDs.

**Phase 2 — D&D5E product (FIRST RELEASE)**
- [ ] Package Layer A engines as standalone marketplace products on dnd5e.
- [ ] Marketplace submission, licensing, art clearance.
- [ ] **Ship Layer A on dnd5e.**

**Phase 3 — Consolidate Layer B + finalize RFI**
- [ ] Collapse the Layer B long tail into 2–3 packages.
- [ ] Finalize the RFI `rfi` adapter behind the same interface.
- [ ] Build the `fourththing → rfi` world-migration script; rename the system ID.
- [ ] **Ship RFI / Bad Eden (SECOND RELEASE).**

---

## 7. Decision Log

- **D1 (2026-05-26): Architecture = two layers** (agnostic engines + Bad Eden content). *Why:* resolves the consolidate-vs-split tension; the engines on dnd5e ARE the D&D5E-first product. *Owner-confirmed.*
- **D3 (2026-05-26): Adapter seam mapped — narrow & pooled.** The combat seam = the 8-method `game.bbttcc.combat` contract (§4), funneling through one `_applyDamageToActor` signature. `factions`/`aae`/`campaign` already agnostic; `raid`/`structures`/`territory` coupling is concentrated in a few files. Corrected the earlier wrong assumption that `bbttcc-bridge.js` was the combat-adapter seed.
- **D6 (2026-06-10): Structures are Layer A — damageable on dnd5e directly.** Owner: "Structures must function within the D&D damage footprint; stewards can damage them directly." So `bbttcc-structures` is system-agnostic (Layer A), not Layer B as §4 assumed. The pre-damage interceptor (D5) MUST be system-agnostic — operate on `amount`/`damageType`/`flags["bbttcc-structures"]` only, short-circuit the adapter when it claims a `hasStructure` target (runs the integrity model instead of dnd5e native HP). Feasible: `damage-path.js` already has zero `fourththing` coupling; only `collapse.js` (knockback/prone secondary effects → route via adapter `resistsForcedMove`/`applyCondition`/`getHealth`) + the wedge install point need work. RFI-only opts (`bypassThreshold`/`noSalvage` from Catastrophic Entry) feature-gate off on dnd5e. *Resolves §4's structures-Layer-B assumption + open Q on structures-on-dnd5e.*
- **D5 (2026-06-10): Adapter seam remapped — narrower call-count, wedge complication.** Fresh recon (`ADAPTER_SEAM_PREP.md`) corrects D3: ~7 real cross-module call sites (not ~30), only `applyDamage` is cross-module, fulcrum moved to `module.js:13771`, and `bbttcc-structures` monkey-patches the fulcrum (`damage-wedge.js`) — must be converted to a registered interceptor (preferred) before swapping call sites. The safe committable unit = define `game.bbttcc.combat` in core + alias RFI impl + swap ~7 sites (zero behavior change); dnd5e impl comes after. *Why logged:* the original §4 map would have mislead the extraction (wrong line, wrong count, missed wedge).
- **D4 (2026-06-10): Migration framework = code-derived target + manifest record.** `CURRENT_SCHEMA_VERSION` is derived from `max(MIGRATIONS[].version)` (can't add a step without bumping the target); `system.json flags.fourththing.schemaVersion` mirrors it as the human-readable manifest record (mismatch only warns). Stored version advances after EACH successful step; failure aborts the run and retries next load. Baseline v1 is a no-op stamp — pre-framework ad-hoc macro migrations are NOT replayed. *Why:* gives the eventual `fourththing→rfi` rename (D2) a versioned, run-once-per-world home instead of another paste macro.
- **D2 (2026-05-26): ID strategy = per-layer phased rename** (display rebrand anytime; Layer A clean IDs at extraction; `fourththing` rename deferred to RFI-release prep with migration script). *Why:* IDs are permanent post-publish; dnd5e ships first so the system rename has more runway; avoids a risky big-bang. *Informed by the dnd5e-scaffolding finding (§3).*

---

## 8. Open Questions

1. **Long-tail standalone-sale candidates.** Of `tikkun`, `radiation`, `market`, `facility-console`, `esoteric-magic`, etc. — are any worth selling standalone, or are they all "Bad Eden flavor" that can be freely merged into Layer B packages? *(Shapes how aggressively Phase 3 consolidates.)*
2. **Layer A product naming / studio brand.** What neutral brand do the engines ship under? (Not "Bad Eden.")
3. **dnd5e character layer.** On dnd5e, characters use the dnd5e sheet + `auto-link` augmentation; on RFI, native sheets. How much of the bespoke character experience (manifestations, frame dice) do we expose to dnd5e, vs. keep RFI-only?
4. **Marketplace model.** Free vs. premium per product? Bundle vs. à la carte? (Depends on marketplace research.)
5. **Asset/art licensing** — what's clearable for commercial sale?

---

## 9. Risks & hygiene

- **Saved-world data migration** is the central technical risk of any ID rename. Mitigation: migration framework in Phase 0; per-layer phased rename (§5).
- **dnd5e v5 drift** — the original dnd5e integration predates current dnd5e; re-validation is real work (Phase 1).
- **`auto-link` straddles both layers** — must be decomposed cleanly, not copied.
- **Repo hygiene:** `$HOME` is the git repo and holds ~30 dated backup folders + zips alongside the canonical `modules/`+`systems/`. Before ship, ship artifacts must be per-package and clean. Consider moving the canonical workspace out of `$HOME` and `.gitignore`-ing/archiving the dated snapshots.
- **Live servers run ahead of git** (per memory). Reconcile to `monorepo-init` before reasoning about remote state; never push the orphan `main`.

---

## 10. Glossary
- **Layer A** — system-agnostic engines (dnd5e-first product line).
- **Layer B** — Bad Eden / RFI bespoke system + content.
- **Adapter seam** — the thin combat/actor interface that lets engines target dnd5e or RFI.
- **Referential ID** — an identifier that saved data / runtime depends on (renaming requires migration).
- **RFI** — Roll For Initiation (the system, formerly "Fourth Thing" / `fourththing`).

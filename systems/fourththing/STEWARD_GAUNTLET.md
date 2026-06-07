# STEWARD GAUNTLET — stress-testing the character layer
*Design doc, 2026-06-07. Sister project to SIM-BADEDEN (OP-economy stress test).
Phase 1 shipped same day; Phases 2–4 are a devoted sprint.*

## The thesis
SIM-BADEDEN proved it: **stepping the system through itself finds the errors
designers can't see.** The Brexit audit (one L20 Bulwark, by hand) surfaced 7
broken automations + 1 data corruption in an hour. There are ~13 classes ×
~3 subclasses × ~10 ancestries × crews × archetypes × associations of surface
area. Audit it the way we audited the economy: generate, fire, collect, fix.

## Bug taxonomy (from the Brexit audit — drives the design)
| Class of bug | Example | Detection |
|---|---|---|
| Empty-marker AE (`changes:[]`) | Grim Persistence, Fluid Footwork | **static** |
| Active prose, no route/flags | Anchor or Advance, The Breach | **static** |
| Retired vocabulary | Frame Dice/Ruin Charges post-Surge-fold | **static** |
| Derived-`.value` AE stomp | Surge: Brace | **static** |
| Data corruption | Athletics rank 20 | **static** |
| AoE prose, `area: none` | Screams of Terror | **static** |
| Handler throws at runtime | `ff` ReferenceError in prevent-drop | **dynamic** |
| Dialog flow breaks / dead button | v13 HUD `html[0]` unwrap | **dynamic** |
| Wrong side-effect (fires, but applies wrong) | Stitch single-pool | **dynamic + assertions** |

## Phase 1 — STATIC AUDITOR ✅ (shipped 2026-06-07)
`tools/steward-gauntlet-static-audit.macro.js` — read-only sweep of every
world actor (+ opt-in packs via `SCAN_PACKS`) for all six static classes.
Console tables + JSON blob + GM chat card. Run it after every content sprint.

## Phase 2 — THE FOUNDRY (character factory)
A macro/tool that builds a **coverage roster** of L20 test stewards:
- **One actor per class × subclass** (~13×3 ≈ 39 actors — the class-automation
  surface is the deep one). Name scheme: `GAUNTLET · Bulwark/Avalanche`.
- Ancestries, heritages, crew types, archetypes, associations, alignments
  **distributed across the roster** (covering array, not cross-product) so
  every option appears ≥ 1×.
- Build path = the same functions chargen uses, headless:
  `Actor.create` → add class/subclass/ancestry/feat items from packs →
  `applyPathFeatures` → `applySkillGrantsFromFeatures` →
  `promoteStampedAptitudeAEs` → set level 20 → grant every BBTTCC technique
  at the aptitude levels → starter manifestations + a weapons rack.
- Idempotent: factory deletes + rebuilds its own `GAUNTLET ·` actors only.
- Park them in a `Gauntlet` actor folder + a dedicated test scene with one
  HOSTILE dummy target token (high Integrity sponge) and one FRIENDLY ally.

## Phase 3 — THE RUNNER (fire everything)
For each gauntlet actor, on the test scene, with the sponge targeted:
1. **Dialog auto-pilot** — the hard part. Monkey-patch for the run's duration:
   - `Dialog.prototype.render` → auto-invoke the default button's callback
     with the dialog's own jQuery content (off-DOM render), then close.
   - `Dialog.confirm` / `DialogV2.confirm` → resolve `true`.
   - `foundry.applications.api.DialogV2.wait` → resolve default action.
   - Template-placement promises (`ftPlaceAreaTemplate`) → stub to auto-place
     at the sponge's position (export a test hook or patch the function).
   - Restore everything in `finally`.
2. **Iterate the actor's surface**:
   - every feat where `isActionableFeature` → `dispatchFeatureAction` (wrap)
   - every weapon → `ftOpenEngageDialog` (auto-piloted) → confirm a strike
   - every power → `castManifestation` (auto-piloted)
   - every Surge spend available at the actor's class/tier → `surge.spend`
   - faculty checks, defense checks, skill rolls (one each)
   - Soma Break + Scene Break at the end (resets between actors)
3. **Capture**: wrap `console.error/warn` + `Hooks.onError` + per-call
   try/catch. Record `{ actor, ability, phase, error }`.
4. **Assertions** (the Stitch class of bug — fired but wrong):
   - chat message count increased after each fire (something happened)
   - declared damage abilities: sponge Integrity/Stress actually moved
     (or an Apply button exists in the last message)
   - declared AE abilities: actor/sponge effect count moved
   - declared resource costs: the pool actually decremented
   - 1/scene abilities: second fire is refused; Scene Break re-enables
5. **Throttle**: one ability per ~50ms, chunked per actor, so the world
   doesn't choke; full run target < 10 min.

## Phase 4 — THE FIX LOOP
Runner emits a JSON fail-list (same shape as Phase 1's blob). Triage into the
same batches as the playtest boatloads: code fixes vs content fixes (in-world
macros) vs prose banners. Re-run until green. **Definition of done: a full
gauntlet run with zero errors and zero failed assertions.**

## Risks / gotchas (pre-known)
- Dialog auto-pilot must also catch `new Dialog().render(true)` flows that
  never resolve a Promise — track open apps and force-close after a timeout.
- GM-relay socket paths (`ft-applyDamage`) need the GM client to be the runner.
- AA/Sequencer animations: disable during runs (config flag) or the canvas
  drowns; `fx` calls are try/caught already.
- LevelDB packs: factory READS packs only. Never writes them. (See
  feedback_deploy_leveldb_pack_stop_sync_start.)
- Some abilities are legitimately narrative (Decisive Momentum, Bladed
  Tempo) — runner needs a `NARRATIVE_BY_DESIGN` allowlist so they don't
  pollute the fail list forever.

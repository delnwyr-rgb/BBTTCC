# BBTTCC Raid Maneuver Catalog — Living Spec

**Status:** Working doc · authoring against this spec is in progress.
**Last touched:** 2026-05-14
**Owner:** delnwyr (GM/designer)
**Companion files:** `scripts/compat-bridge.js` (EFFECTS registry) · `scripts/bbttcc-agent-api.js` (THROUGHPUT handlers) · `scripts/effects-fire-mode-tags.js` (Phase 4D fire-mode tags) · `../bbttcc-master-content/packs/doctrines` (live LevelDB pack — authoritative)

---

## 0. Why we're rewriting

The raid system has outgrown its original maneuver catalog. As-shipped maneuvers are nearly all `Strategic × Pre-roll × Light` — `+1 to a roll`, `+3 defender DC`, `-1 alarm`. They don't touch:

- The battle scene canvas, where rigs and stewards now actually fight (Phase 0/1/2/5).
- The unified raid HUD (Phase 3) that shows scenario meters in real time.
- The Phase 4D fire-mode UI (pre-roll / anytime / post-commit), which expects each tier to have meaningful representation across all three modes.

The result: spending OPs on a maneuver feels disconnected from the canvas explosions. Personal-ability magnitude (a steward casting a manifestation) outweighs faction-ability magnitude (the entire faction spending 30 marks for `+1`). Maneuvers should be the *louder* layer, not the quieter one.

This spec catalogs every existing maneuver, classifies the work needed on each, and lays out the target shape of a 60-entry catalog organized across four axes: **engine × layer × fire-mode × cost band**.

---

## 1. Audit snapshot (2026-05-14)

### Source-of-truth divergence

| Source | Count | Notes |
|---|---|---|
| `bbttcc_maneuvers_v1_4.json` | 40 | **Stale** — version-named, hasn't been regenerated since pack updates. |
| `scripts/effects-fire-mode-tags.js` | 47 | Phase 4D — 24 pre-roll · 11 anytime · 12 post-commit. |
| `scripts/bbttcc-agent-api.js` THROUGHPUT | 48 | Preview emitters. |
| **Live `doctrines` pack** | **51** | **Authoritative.** What GMs/players see in the compendium. |

The pack is canonical. The code-side trackers have drifted by ~11 entries — partly because of legacy `⭐ [Option]` Archetype grants and story-unlock maneuvers that were added straight to the pack without code mirrors.

### Live pack composition

- **51 maneuvers** (`flags.bbttcc.kind === "maneuver"`)
- **74 strategic activities** (`flags.bbttcc.kind === "strategic"`)
- **125 total doctrine items** (`type === "feat"`)

Tier distribution:

- **T1:** 18 (incl. 3 `⭐ [Option]` legacy-Archetype grants — Coordinated Advance, Infernal Bargain, Psychological Pressure)
- **T2:** 10
- **T3:** 10
- **T4:** 10
- **Untiered:** 1 — `Suppressive Fire` is missing `meta.tier` (data bug, set to T1)

### Vestige findings (per Explore agent audit)

| Concept | Status | Action |
|---|---|---|
| "Empathy Meter" (legacy UI text) | 2 entries — `empathic_surge`, `moral_high_ground` | **Text fix:** "Empathy Meter" → "Unity" |
| Qliphothic Darkness system | 3 entries — live & intentional | Keep |
| Construct unit type | 1 entry — `overclock_the_golems` | Keep |
| `fortified` tag | 2 entries — `saboteur_s_edge` removes, `siege_breaker_volley` strips | Keep — audit mid-round re-fortification lifecycle |
| Null-returning THROUGHPUT | 0 (all 48 emit structured intents) | None |
| Micro-delta-only handlers | 5 (all post-commit; deferred/paired) | Keep — context appropriate |

### Pack-side data hygiene gaps

- **`meta.raidTypes` is empty for every entry in the live pack.** Engine-gating depends on this. Legacy raidType data lives only in the stale JSON.
- **`meta.unlockKey` is set for only ~5 entries.** The rest are null. The ones currently set are legacy Archetype/story grants — all should be cleared during the refresh.
- **`⭐` and `[Option]` prefixes** are legacy markers from old Archetype designs since superseded. Strip and normalize.

---

## 2. Refresh pass (against existing 51)

### 2.A — Normalize legacy grants

- Strip `⭐` and `[Option]` from these 3 names: Coordinated Advance, Infernal Bargain, Psychological Pressure. They become standard T1 maneuvers.
- Clear `meta.unlockKey` on the ~5 entries previously gated by Archetype/story grants (`sympathetic_stabilization`, `gradient_surge`, `ghost_slip_infiltration`, `battlefield_harmony` + others to audit during sprint).
- Set `meta.availability = "standard"` on every entry not explicitly tagged otherwise.

### 2.B — Text fixes (legacy concept refs)

- `empathic_surge` description: "Empathy Meter +1" → "Unity +1"
- `moral_high_ground` description: "Empathy Meter +2" → "Unity +2"

### 2.C — Data fixes

- `Suppressive Fire`: set `meta.tier = 1`.
- Populate `meta.raidTypes` on every entry — values from canonical set: `["violence"]` / `["intrigue"]` / `["presence"]` / `["universal"]` (or multi-tagged, with one declared as primary).

### 2.D — Verify-then-decide

| Maneuver | Open question |
|---|---|
| `chrono_loop_command` (T3) | The "rerun free; second use → Darkness +1" incentive is inverted/unclear. Consider rewrite: "Rerun on success; on failure Darkness +1." |
| `crown_of_mercy` (T4) | Description references Corrupted Spark — confirm this entity exists post-Tikkun B3 sprint. |
| `logistical_surge` (T2) | "Repeat last round's maneuver at no cost" — confirm the round-applier actually wires `repeatLastManeuver` correctly. THROUGHPUT line 639. |

### 2.E — Source-of-truth canonicalization

**Recommendation:** Make the pack canonical. Build two tools:

1. `tools/extract-doctrines-to-spec.macro.js` — dumps pack → flat JSON suitable for code-side consumers.
2. `tools/sync-maneuver-tags.macro.js` — for each pack maneuver, ensures a THROUGHPUT handler + fire-mode tag exists in the code; logs any gap.

Retire `bbttcc_maneuvers_v1_4.json` after migration; replace with a generated `doctrines-snapshot.json` regenerated on demand.

---

## 3. Target grid (~58 entries, asymmetric)

The catalog gets organized across **four axes**:

1. **Engine** — `violence` / `intrigue (alarm + stealth-canvas)` / `presence (influence, abstract-only)` / `universal`
2. **Layer** — `strategic` (round summary, dice/DC/meter) / `tactical-down` (buff/heal/spawn friendly tokens on bound battle scene) / `tactical-out` (damage/debuff enemy tokens) / `cross-layer` (canvas-wide VFX + meter shift + token effect)
3. **Fire mode** — `pre-roll` / `anytime` / `post-commit` (already wired by Phase 4C/4D)
4. **Cost band** — `light` (5–15 marks) / `medium` (20–40 marks) / `heavy` (50+ marks)

### Engine × bucket distribution (asymmetric per 2026-05-14 canvas decision)

The hybrid-canvas decision (Infiltration gets canvas, Courtly stays abstract) breaks the original symmetric grid. The freed Presence/Universal tactical-layer slots redistribute into Violence/Intrigue, which have the richest canvas surface.

| Engine | Strategic | Tactical-down | Tactical-out | Cross-layer | **Total** |
|---|---|---|---|---|---|
| **Universal pool** | 6 | — | — | 4 † | **10** |
| **Violence** | 4 | 5 | 5 | 4 | **18** |
| **Intrigue (Alarm + canvas)** | 4 | 5 | 5 | 4 | **18** |
| **Presence (abstract-only)** | 12 | — | — | — | **12** |
| **TOTAL** | **26** | **10** | **10** | **12** | **~58** |

† Universal cross-layer maneuvers must no-op gracefully when the active engine lacks a canvas (Presence, or Extended interphase). The S1 scene-intent substrate already returns `{applied:false, note:"no-scene"}` in those cases — payloads should be designed knowing the no-op is possible.

Cell counts are guidance, not contract. Final balance lands during the per-engine authoring sprint as concrete maneuvers crystallize.

### Fire-mode balance per engine

Each 18-entry engine bucket should hit roughly:

- **Pre-roll:** 6–7 (front-load the dice — modify roll, DC, advantage)
- **Anytime:** 5–6 (interrupts/responses — state changes decoupled from dice)
- **Post-commit:** 5–6 (win/loss riders — triggered by round outcome)

Universal pool: 4 / 3 / 3. Presence (12 entries): 4 / 4 / 4.

### Cost banding (locked 2026-05-14)

| Band | Marks (total across pools) | Frequency | Tier alignment |
|---|---|---|---|
| Light | 10–25 | Frequent, several per round | T1 |
| Medium | 26–50 | Signature, 1–2 per round | T2–T3 |
| Heavy | 51+ | Rare, game-shaping | T4 |

Bands map cleanly to tier without being identical — a T2 maneuver can be light if its mechanical effect is modest; a T1 cross-engine combo can land medium. The band drives audit + cost expectations; tier drives availability + power-scaling.

### Anytime fire budget (locked 2026-05-14)

Anytime maneuvers are tied to **tactical round order** (combat-tracker initiative), not strategic raid rounds. Budget by tier:

| Tier | Anytime scope | Resets on |
|---|---|---|
| T1 | per-round (1 per faction per tactical round) | Foundry combat round advance (`updateCombat`) |
| T2–T3 | per-scene (1 per faction per battle scene) | Phase 5 scene transition |
| T4 | per-raid (1 per faction per raid session) | Raid commit / abandon |

Rationale: tying budgets to tactical-round structure makes anytimes feel responsive to in-combat fire rather than abstract strategic decision moments. Cost AND scarcity scale with tier together.

---

## 4. New intent-type substrate

All 48 existing THROUGHPUT handlers emit one of ~30 intent types (`rollBonus`, `defenderDCDelta`, `alarmDelta`, etc.). **None touch the battle scene.** Closing that gap requires teaching the round-applier 5–6 new verbs.

### Proposed new `roundEffects.type` verbs

| Verb | Purpose | Reuses |
|---|---|---|
| `spawnSceneToken` | Spawn an `actorLink:false` (or true) token on the bound battle scene. | Holdings Phase C `deployToScene` plumbing |
| `damageSceneTokens` | AOE region damage to all enemy tokens within radius. | B11.B `_applyDamageToActor` (canonical integrity damage) |
| `buffSceneTokens` | Apply ActiveEffect for `thisRound` or `N rounds` to friendly tokens (e.g. +2 attack). | Standard Foundry AE creation |
| `healSceneTokens` | Restore integrity/HP to friendly tokens. | B11.B integrity API |
| `playCanvasVfx` | Fires `ftPlayCombatVfx` or new "wide-arc" / "sweep" variant. | Phase 2 VFX bridge |
| `tokenInvisibleUntilTurn` | Make one friendly token invisible until its next turn (anytime stealth interrupt). | Foundry token visibility flag |
| `revealEnemyToken` | Flip an enemy token to visible for one round (Intrigue side). | Foundry token visibility flag |

### Per-verb wiring checklist

Each new verb needs:

- THROUGHPUT preview emitter shape (extend the JSDoc in `bbttcc-agent-api.js`)
- Round-applier handler (most likely lives in `raid-resolveRaidRound.throughput.enhancer.js`)
- Subroutine call into the existing system it leverages (Holdings deploy API, integrity API, Phase 2 VFX, AE creation, token visibility)
- Battle-scene resolution: WHICH scene is the bound battle scene? Use Phase 5's `currentSceneIdx` or `canvas.scene` if matching.

### Strategic-canvas-wide VFX vs token-local VFX

The cross-layer maneuvers want a **canvas-wide** VFX signature distinct from the **token-local** ring pulses Phase 2 already emits. Examples:

- Sweeping arc across the canvas (artillery salvo)
- Pulsing border ring (alarm spike)
- Color overlay tint (faction-wide morale shift)

These reinforce the "the faction is acting on the whole battle, not just one rig" feel. New variants for `ftPlayCombatVfx`.

---

## 5. Sprint rollout (restructured 2026-05-14)

Original 4-sprint shape (S1 substrate / S2 Violence+Universal / S3 Intrigue / S4 Presence) is **superseded** as of 2026-05-14. The Infiltration and Courtly engines need substrate work *before* their maneuvers can be authored, and the Extended Raids concept (sieges as multi-session format) gets its own phase. Restructured into 7 phases across what's effectively 6 sprints. Total ~2,150 LOC.

| Phase | Scope | LOC est. | Status |
|---|---|---|---|
| **S1** | Substrate + 3 macros (extract/refresh/sync) | 966 | ✅ shipped 2026-05-14 |
| **S2** | Violence (18) + Universal (10) — pure content | ~300 | next |
| **S3a** | Infiltration engine modernization | ~250 | |
| **S3b** | Intrigue maneuvers (18) | ~150 | |
| **S4a** | Courtly engine modernization | ~120 | |
| **S4b** | Presence maneuvers (12) | ~120 | |
| **S5** | Extended Raids meta-layer | ~250 | |

### S2 — Violence (18) + Universal (10), pure content (~300 LOC)

- Author 10 Universal maneuvers (logistics/faith/diplomacy/economy cross-engine fuels). Cross-layer universals must no-op gracefully when active engine lacks a canvas.
- Author/re-slot 18 Violence maneuvers across the layer × fire-mode grid.
- All 6 S1 scene-intent verbs available freely (Violence has full canvas via B11/B12/Phase 2-5).
- **Light-up moment:** spending OPs makes the battle scene change visibly.

### S3a — Infiltration engine modernization (~250 LOC)

The current `raid-infiltration.alarm.enhancer.js` has only an Alarm meter and a "lockdown" (defender-win) outcome — **no attacker-progress mechanism is encoded**. S3a adds:

- **`infiltrationProgress` meter** parallel to Alarm. Attacker reaches `progressMax` → success outcome (currently entirely GM fiat).
- **Stealth-canvas integration** (the Hybrid decision). Token-positional play layered on top of the meter:
  - Patrol token routes (defender)
  - Line-of-sight cones to "objective" tokens
  - Alarm-proximity rings (attacker token within N grid of an alerted defender token → +alarm per round)
- **Expanded `applyEffects` scenarioEffects vocab.** Today only consumes `alarmDelta`. Add `progressDelta`, `revealDefenderToken`, `hidePatrolRoute`, etc.
- New outcome transitions: `extracted` (attacker win), `lockdown` (defender win), `compromised` (partial — alarm high but objective reached).

### S3b — Intrigue maneuvers (18, ~150 LOC)

Content on top of S3a substrate. Both scenarioEffects (meter shifts) AND roundEffects (S1 scene-intent verbs) are available.

### S4a — Courtly engine modernization (~120 LOC)

The current `raid-courtly.influence.enhancer.js` has a complete HP race + actions system **but no `applyEffects()` method at all** — maneuver-emitted scenarioEffects for Courtly are silently dropped today. S4a adds:

- `applyEffects(scenarioEffects)` consumer on the courtly scenario object (parity with infiltration's existing surface).
- ScenarioEffects vocab (provisional): `influenceDamage` (direct HP), `applyScandal` (status), `swayCourtier` (Influence HP transfer), `revealSecret` (one-shot info reveal), `royalFavor` (mod next exchange).
- NO canvas work — Courtly stays abstract per 2026-05-14 hybrid-canvas decision.
- Couples to the raid-console dispatch at `app.__courtlyScenario.applyEffects(...)` which currently no-ops.

### S4b — Presence maneuvers (12, ~120 LOC)

Pure content, strategic-only. Uses factionEffects + scenarioEffects only — no S1 scene-intent verbs (Courtly has no canvas). Lower entry count (12 vs 18) means each is meatier — no layer-padding.

### S5 — Extended Raids meta-layer (~250 LOC)

Sieges as a single raid that stays *open* across multiple play sessions, with a `raid.campaign` flag on the hex tracking interphase state. Reuses S1–5 substrate per-session; the new shape is the *between-session* layer.

- `hex.flags.bbttcc-raid.campaign = { openedAt, sessions:[], interphase:{ supply, fortifications, fatigue, ... } }`.
- Couples to Holdings Phase D's garrison/upkeep system (defender Holdings degrade/regen during interphase).
- Interphase action layer — new sub-panel of the Raid Console while raid is paused: resupply / fortify / parley / sap as strategic-mode actions that mutate `interphase` state.
- Maneuvers gain optional `extendedOk:true` tag during S2–4b authoring (cheap; pre-emptive flagging during content sprints means S5 doesn't need to re-touch maneuver entries). No new maneuvers authored in S5.
- **Trigger:** still open (see §7).

---

## 6. Maneuver inventory

### 6.A — Sprint 2 NEW authoring (8 entries, 2026-05-14)

Authored declaratively in `bbttcc-raid/scripts/maneuvers-sprint2-content.enhancer.js`; seeded into the doctrines pack via `bbttcc-master-content/tools/seed-sprint2-maneuvers.macro.js`.

| Tier | Name | Key | Engine | Layer | Fire-mode | Cost | Band |
|---|---|---|---|---|---|---|---|
| T1 | Logistics Surge | `logistics_surge_s2` | Universal | strategic | anytime | logistics 1 + economy 1 (20) | light |
| T2 | Diplomatic Channel | `diplomatic_channel` | Universal | strategic | anytime | diplomacy 4 (40) | medium |
| T1 | Faction-wide Rally | `faction_wide_rally` | Universal | cross-layer | pre-roll | softpower 2 (20) | light |
| T3 | Prayer Pulse | `prayer_pulse` | Universal | cross-layer | post-commit | faith 4 + softpower 2 (40) | medium |
| T1 | Suppressive Volley | `suppressive_volley` | Violence | tactical-out | anytime | violence 2 (20) | light |
| T1 | Forward Resupply | `forward_resupply` | Violence | tactical-down | anytime | logistics 2 (20) | light |
| T2 | Coordinated Strike | `coordinated_strike` | Violence | cross-layer | post-commit | violence 3 + softpower 1 (40) | medium |
| T3 | Artillery Salvo | `artillery_salvo` | Violence | tactical-out | anytime | violence 3 + logistics 2 (50) | medium |

Distribution:
- **Universal**: 4 (target 10) — 6 more to author in a future content sprint
- **Violence**: 4 (target 18) — 14 more to author OR re-slot from existing 51
- **Fire-mode**: 1 pre-roll · 5 anytime · 2 post-commit
- **Cost band**: 4 light · 4 medium · 0 heavy (heavy entries land later, typically T4)
- **Tier**: 4 T1 · 2 T2 · 2 T3 · 0 T4

### 6.B — Existing pack entries (post-refresh, 51 legacy)

Populated 2026-05-15 from `doctrines-snapshot-20260515post.json` after the operator ran the S1 refresh-pass macros. Each entry has canonical `meta.raidTypes` set; `meta.engine` is set by the S2.5 `tag-maneuver-engines.macro.js` follow-up (see §10.5).

**Final engine distribution (59 entries total):**

| Engine | Count | vs §3 target | Notes |
|---|---|---|---|
| Universal | 8 | 10 (–2) | 5 S2/S2.5 + 3 from unresolved-tagging |
| Violence | 30 | 18 (+12) | 20 legacy + 4 S2 + 6 from unresolved-tagging |
| Intrigue | 9 | 18 (–9) | All legacy; S3b will author more |
| Presence | 12 | 12 (✓) | 6 legacy + 1 S2.5 + 5 from unresolved-tagging |

The catalog is **Violence-heavy** by historical accident — the pre-overhaul authoring leaned combat-flavored. Per §3 the grid is guidance not contract; reality wins. Sprint 3b/4b authoring will close the Intrigue gap; the Universal gap (–2) is small enough to ignore until natural authoring fills it.

#### Universal (8)

| Tier | Name | Key | Layer | Fire-mode | Source |
|---|---|---|---|---|---|
| T1 | Coordinated Advance | `opt_coordinated_advance` | cross-layer | pre-roll | S2.5 |
| T1 | Divine Favor | `divine_favor` | strategic | post-commit | legacy + unresolved-tag |
| T1 | Faction-wide Rally | `faction_wide_rally` | cross-layer | pre-roll | S2 |
| T1 | Logistics Surge | `logistics_surge_s2` | strategic | anytime | S2 |
| T1 | Supply Surge | `supply_surge` | strategic | pre-roll | legacy + unresolved-tag |
| T2 | Diplomatic Channel | `diplomatic_channel` | strategic | anytime | S2 |
| T3 | Prayer Pulse | `prayer_pulse` | cross-layer | post-commit | S2 |
| T4 | Sephirotic Intervention | `sephirotic_intervention` | strategic | pre-roll | legacy + unresolved-tag |

#### Violence (30)

| Tier | Name | Key | Layer | Fire-mode | Source |
|---|---|---|---|---|---|
| T1 | Battlefield Harmony | `battlefield_harmony` | strategic | post-commit | legacy |
| T1 | Defensive Entrenchment | `defensive_entrenchment` | strategic | pre-roll | legacy |
| T1 | Flank Attack | `flank_attack` | strategic | pre-roll | legacy |
| T1 | Forward Resupply | `forward_resupply` | tactical-down | anytime | S2 |
| T1 | Gradient Surge | `gradient_surge` | strategic | pre-roll | legacy |
| T1 | Last-Stand Banner | `last_stand_banner` | strategic (def) | pre-roll | legacy + unresolved-tag |
| T1 | Patch the Breach | `patch_the_breach` | strategic (def) | anytime | legacy + unresolved-tag |
| T1 | Radiant Rally | `radiant_rally` | strategic | post-commit | legacy |
| T1 | Rally the Line | `rally_the_line` | strategic | pre-roll | legacy |
| T1 | Supply Overrun | `supply_overrun` | strategic | post-commit | legacy |
| T1 | Suppressive Fire | `suppressive_fire` | strategic | pre-roll | legacy (tier-fix) |
| T1 | Suppressive Volley | `suppressive_volley` | tactical-out | anytime | S2 |
| T1 | Sympathetic Stabilization | `sympathetic_stabilization` | strategic | post-commit | legacy |
| T2 | Bless the Fallen | `bless_the_fallen` | strategic | pre-roll | legacy |
| T2 | Command Overdrive | `command_overdrive` | strategic | post-commit | legacy |
| T2 | Coordinated Strike | `coordinated_strike` | cross-layer | post-commit | S2 |
| T2 | Industrial Sabotage | `industrial_sabotage` | strategic | anytime | legacy |
| T2 | Logistical Surge | `logistical_surge` | strategic | post-commit | legacy |
| T2 | Tactical Overwatch | `tactical_overwatch` | strategic | pre-roll | legacy |
| T3 | Artillery Salvo | `artillery_salvo` | tactical-out | anytime | S2 |
| T3 | Defender's Reversal | `defender_s_reversal` | strategic (def) | pre-roll | legacy |
| T3 | Echo Strike Protocol | `echo_strike_protocol` | strategic | pre-roll | legacy |
| T3 | Overclock the Golems | `overclock_the_golems` | strategic | pre-roll | legacy |
| T3 | Quantum Shield | `quantum_shield` | strategic (def) | pre-roll | legacy + unresolved-tag |
| T3 | Radiant Retaliation | `radiant_retaliation` | strategic | anytime | legacy + unresolved-tag |
| T3 | Siege Breaker Volley | `siege_breaker_volley` | strategic | anytime | legacy |
| T4 | Ego Breaker | `ego_breaker` | strategic | anytime | legacy |
| T4 | Ego-Dragon Echo | `ego_dragon_echo` | strategic | pre-roll | legacy + unresolved-tag |
| T4 | Engine of Absolution | `engine_of_absolution` | strategic | post-commit | legacy + unresolved-tag |
| T4 | Qliphothic Gambit | `qliphothic_gambit` | strategic | pre-roll | legacy |

#### Intrigue (9 — under-staffed; S3b will author more)

| Tier | Name | Key | Layer | Fire-mode | Source |
|---|---|---|---|---|---|
| T1 | Flash Interdict | `flash_interdict` | strategic | pre-roll | legacy |
| T1 | Ghost-Slip Infiltration | `ghost_slip_infiltration` | strategic | pre-roll | legacy |
| T1 | Smoke and Mirrors | `smoke_and_mirrors` | strategic | anytime | legacy |
| T2 | Psychic Disruption | `psychic_disruption` | strategic | pre-roll | legacy |
| T2 | Saboteur's Edge | `saboteur_s_edge` | strategic | pre-roll | legacy |
| T2 | Signal Hijack | `signal_hijack` | strategic | anytime | legacy |
| T3 | Chrono-Loop Command | `chrono_loop_command` | strategic | pre-roll | legacy (verify-then-decide) |
| T4 | Reality Hack | `reality_hack` | strategic | post-commit | legacy |
| T4 | Void-Signal Collapse | `void_signal_collapse` | strategic | pre-roll | legacy |

#### Presence (12)

| Tier | Name | Key | Layer | Fire-mode | Source |
|---|---|---|---|---|---|
| T1 | Flash Bargain | `flash_bargain` | strategic | pre-roll | legacy |
| T1 | Infernal Bargain | `opt_infernal_bargain` | strategic | anytime | S2.5 |
| T1 | Prayer in the Smoke | `prayer_in_the_smoke` | strategic | pre-roll | legacy + unresolved-tag |
| T1 | Psychological Pressure | `opt_psychological_pressure` | strategic | anytime | legacy (no throughput — TBD) |
| T2 | Empathic Surge | `empathic_surge` | strategic | post-commit | legacy (Empathy Meter → Unity text-fix) |
| T2 | Faithful Intervention | `faithful_intervention` | strategic | anytime | legacy + unresolved-tag |
| T3 | Counter-Propaganda Wave | `counter_propaganda_wave` | strategic | pre-roll | legacy |
| T3 | Harmonic Chant | `harmonic_chant` | strategic | pre-roll | legacy + unresolved-tag |
| T3 | Moral High Ground | `moral_high_ground` | strategic | post-commit | legacy (Empathy Meter → Unity text-fix) |
| T4 | Crown of Mercy | `crown_of_mercy` | strategic | post-commit | legacy + unresolved-tag |
| T4 | Temporal Armistice | `temporal_armistice` | strategic | post-commit | legacy + unresolved-tag |
| T4 | Unity Surge | `unity_surge` | strategic | post-commit | legacy |

**Notes on the inventory:**

- `layer` for legacy entries defaults to `strategic` (most pre-overhaul maneuvers were strategic-abstract). Some are functionally defensive (`strategic (def)` informal note above). The `meta.layer` field on pack docs is set explicitly by the S2.5 tagger only for S2/S2.5 authoring; legacy entries' `meta.layer` is null and they're treated as strategic by default in picker UI.
- `Fire-mode` for legacy entries reflects what the live registry shows after the Phase 4D tagger applies. **19 of 59 are tagged in the live registry** (40 untagged), which is fewer than the 47 keys declared in `effects-fire-mode-tags.js`. Likely a load-order issue — investigate in S3 (see §9 open items).
- 1 verify-then-decide hand-review entry remains: `chrono_loop_command` (incentive clarity per §2.D). Two of three resolved during the refresh — `crown_of_mercy` and `logistical_surge` were validated as fine.

---

## 7. Open questions

These need decisions before the relevant sprint can start.

### Cross-sprint

- **Pack-canonical means what for code review?** When the pack updates, do we require a PR to update the code-side spec too, or auto-sync via the build tool?

### Per-phase

- **(S3a) Infiltration progress meter:** How does the attacker actually *win*? Counter-meter to Alarm that reaches an "extracted" threshold? Goal hex/token on the stealth-canvas the attacker must reach? Both?
- **(S3a) Stealth-canvas mechanics:** Patrol token routes? Line-of-sight cones to "objective" tokens? Alarm-proximity rings (token within N grid of an alerted defender token → +alarm per round)? Pick a starter subset; rest is iterable.
- **(S4a) Courtly's scenarioEffects vocab:** Provisional `influenceDamage` / `applyScandal` / `swayCourtier` / `revealSecret` / `royalFavor`. Lock the full list during S4a sketch.
- **(S5) Extended trigger:** GM declares "Extended" at raid start? Auto-extends if raid spans real sessions? Tied to a specific Heavy/Siege-tagged hex template?
- **(S5) Interphase action layer location:** New panel on Hex Sheet, or new sub-panel of Raid Console while the raid is paused between sessions?

### Already settled (preserved for context)

- **Source-of-truth direction:** ✅ Pack-canonical (Section 2.E).
- **Diplomacy as universal-pool fuel only:** ✅ Diplomacy is a cost pool, not a raid engine. (Stewardship stays narrative — see Blood Debt RFI bridge.)
- **Cross-engine spend penalty:** ✅ Out-of-engine maneuvers cost 1.5× marks and lose pre-roll status (anytime/post-commit only).
- **Canvas reach per engine:** ✅ Hybrid — Infiltration canvas, Courtly abstract (2026-05-14).
- **Extended Raids shape:** ✅ Meta-layer above engines, not a 4th engine (2026-05-14).
- **Cost-band thresholds:** ✅ Light 10–25 / Medium 26–50 / Heavy 51+ marks total across pools (2026-05-14).
- **Anytime maneuver budget:** ✅ Tier-scoped to tactical-round structure — T1 per-round / T2–3 per-scene / T4 per-raid (2026-05-14).

---

## 8. Decisions log

- **2026-05-14** — Curate to ~60 (vs. keep+grow to 200) confirmed.
- **2026-05-14** — Engine-gated with small universal pool (vs. all-cross-pool-pickable) confirmed.
- **2026-05-14** — Spec memo lives in repo as living working doc.
- **2026-05-14** — Stewardship does NOT become a 5th universal-pool fuel; the Blood Debt / Sacrifice RFI bridge already handles steward→faction OP transfer.
- **2026-05-14** — Diplomacy is a cost pool, not a raid engine.
- **2026-05-14** — `⭐ [Option]` legacy-Archetype prefix and story-unlock `unlockKey` markers all fold into standard catalog during refresh; no special handling preserved.
- **2026-05-14** — Sprint 1 substrate decision: 6 new verbs collapsed from 7 (`tokenInvisibleUntilTurn` + `revealEnemyToken` → `tokenVisibility` with `mode:"hide"|"reveal"`).
- **2026-05-14** — Sprint 1 fire-time wiring uses Hook `bbttcc:raid:maneuver:fired` (zero edits to module.raid-console.js's 7,482 lines). Commit-time wiring deferred until a maneuver authored in S2+ actually needs it.
- **2026-05-14** — **Hybrid canvas reach.** Infiltration gets a tactical stealth-canvas; Courtly stays abstract. Drives the asymmetric grid (Presence is strategic-only, ~12 entries vs the original 16).
- **2026-05-14** — **Extended Raids = meta-layer**, not a 4th engine. `raid.campaign` flag on the hex tracks interphase state between sessions; interphase action layer (resupply/fortify/parley/sap) sits above the per-session engines. Maneuvers tag with optional `extendedOk:true` during content sprints.
- **2026-05-14** — Sprint structure expanded from 4 → 7 phases (S1 / S2 / S3a / S3b / S4a / S4b / S5). Each engine's substrate modernization is its own sub-phase before its content sub-phase. De-risks content sprints; preserves the "shippable wins per phase" pattern.
- **2026-05-14** — Asymmetric grid is **guidance, not contract**. Cell counts (10/18/18/12 ≈ 58) finalize during the per-engine content sprint as concrete maneuvers crystallize.
- **2026-05-14** — **Cost-band thresholds locked**: Light 10–25 / Medium 26–50 / Heavy 51+ marks total across pools. Bands map to tier but aren't identical — band drives audit + cost expectations; tier drives availability + power-scaling.
- **2026-05-14** — **Anytime budget locked**: tier-scoped, tied to tactical-round structure. T1 per-round (resets on `updateCombat`), T2–3 per-scene (resets on Phase 5 transition), T4 per-raid (resets on commit/abandon). Anytimes become responsive to in-combat fire rather than abstract strategic decision moments. Cost AND scarcity scale with tier together.

---

## 9. Sprint 1 — SHIPPED 2026-05-14 (~966 LOC)

Four files landed; no maneuvers authored or pack mutated yet. Substrate is dormant until S2 authors maneuvers that emit the new verbs.

**Tools (`bbttcc-master-content/tools/`):**
- `extract-doctrines-to-spec.macro.js` (223 LOC) — read-only. Dumps live pack → flat snapshot JSON + chat report. Cross-refs EFFECTS for `raidTypes`/`fireMode` and `__THROUGHPUT` for handler presence. Run from a Foundry macro slot; `saveDataToFile` triggers a JSON download.
- `refresh-maneuver-catalog.macro.js` (227 LOC) — mutator. **Default `DRY_RUN = true`.** Applies §2 refresh pass: strip `⭐` / `[Option]`, clear legacy `unlockKey`, set `availability="standard"`, flip `storyOnly` false, set `bb.key`, Suppressive Fire `tier=1`, Empathy Meter → Unity in 2 entries, populate canonical `meta.raidTypes` via `resolveCanonical()`. Reports verify-then-decide list (chrono_loop_command / crown_of_mercy / logistical_surge) without mutating.
- `sync-maneuver-tags.macro.js` (134 LOC) — audit-only. Per-maneuver: EFFECTS present? fire-mode tagged? THROUGHPUT wired? Also reverse direction (code-side keys not in pack — dead-code candidates).

**Substrate (`bbttcc-raid/scripts/`):**
- `raid-scene-intents.enhancer.js` (382 LOC) — adds 6 new `roundEffects.type` verbs:
  - `spawnSceneToken` → Holdings Phase C `deployToScene` (with direct-Token fallback)
  - `damageSceneTokens` → fourththing `_applyDamageToActor` (B11.B canonical integrity damage)
  - `buffSceneTokens` → `actor.createEmbeddedDocuments("ActiveEffect", ...)`
  - `healSceneTokens` → `system.integrity.value` clamp+update
  - `playCanvasVfx` → emits `bbttcc:raid:canvasVfx` hook (Phase 2 bridge listener)
  - `tokenVisibility` → `token.update({hidden})` + optional rounds-based revert
  - Exposed at `game.bbttcc.api.raid.sceneIntents.{apply, HANDLERS, NEW_VERBS}`. Subscribes to `bbttcc:raid:maneuver:fired` for fire-time auto-apply (anytime fires only).
  - GM-only execution; strategic-map scenes (`flag fourththing.strategicMap`) skipped.
- `bbttcc-agent-api.js` (edit only) — JSDoc enum updated to document the 6 new verbs alongside the 30 legacy strategic types.
- `module.json` (edit only) — new enhancer registered.

**Run order for §2 refresh pass:**
1. `extract-doctrines-to-spec.macro.js` → save baseline snapshot
2. `sync-maneuver-tags.macro.js` → confirm code-side gap inventory
3. `refresh-maneuver-catalog.macro.js` with `DRY_RUN=true` → review report
4. Flip `DRY_RUN=false`, re-run → applies refresh to pack
5. `extract-doctrines-to-spec.macro.js` again → post-refresh snapshot for §6 inventory population

**Open items moved to Sprint 2:**
- Run §6 maneuver inventory population from post-refresh snapshot.
- Verify-then-decide list (chrono_loop_command / crown_of_mercy / logistical_surge) — hand review.
- Commit-time scene-intent application (for pre-roll/post-commit fires) — wire when first S2 maneuver needs it.
- Cost-band thresholds — lock before S2 maneuver authoring begins.

---

## 10. Sprint 2 — SHIPPED 2026-05-14 (~675 LOC)

First content sprint. Locked the two pre-S2 design questions (cost bands, anytime budget), shipped a mini-substrate for tier-scoped anytime budget enforcement, authored the first 8 maneuvers against the S1 substrate, and built the seed macro.

**Mini-substrate (`bbttcc-raid/scripts/`):**
- `raid-anytime-budget.enhancer.js` (183 LOC) — tier-scoped anytime budget tracker exposed at `game.bbttcc.api.raid.anytimeBudget.{canFire, consume, getState, reset, scopeForTier}`. Tier mapping: T1=per-round (resets on `updateCombat`), T2-3=per-scene (resets on Phase 5 transition), T4=per-raid (resets on commit/abandon). Auto-consumes on `bbttcc:raid:maneuver:fired` hook. Memory-trims to last 5 rounds per faction.
- `module.raid-console.js` (3-line guard insertion at `_rcFireOneManeuver`) — hard enforcement gate; calls `canFire()` and aborts with `ui.notifications.warn` if budget exhausted. Wrapped in try/catch so missing API never breaks fire path.

**Content (`bbttcc-raid/scripts/`):**
- `maneuvers-sprint2-content.enhancer.js` (355 LOC) — declarative SPRINT2_MANEUVERS array with 8 entries. Each self-registers into EFFECTS + THROUGHPUT + fireMode tag from a single source. Picker discovers them automatically via the existing canonical-raidType match in `_mansForType` (no raid-console edits beyond the budget guard).
- Coverage: 4 Universal + 4 Violence · 1 pre-roll / 5 anytime / 2 post-commit · 4 light / 4 medium · 4 T1 / 2 T2 / 2 T3.

**Operator tooling (`bbttcc-master-content/tools/`):**
- `seed-sprint2-maneuvers.macro.js` (137 LOC) — reads `game.bbttcc.api.raid.sprint2Maneuvers` and creates doctrine pack doc entries with full canonical metadata (engine/layer/costBand/raidTypes/fireMode/cost/tier). **`DRY_RUN = true` default**. Idempotent (skips entries whose `flags.bbttcc.key` is already in the pack).

**Operator run order to ship S2 content visibly:**
1. Reload Foundry (loads new enhancers).
2. Confirm via dev console: `game.bbttcc.api.raid.sprint2Maneuvers.length === 8` and `game.bbttcc.api.raid.anytimeBudget` is defined.
3. Run `seed-sprint2-maneuvers` macro with `DRY_RUN=true` → review chat report.
4. Edit macro: `DRY_RUN=false`, re-run → creates 8 pack entries.
5. Open the doctrines compendium; the 8 new maneuvers should appear with proper metadata.
6. Open a Violence raid console; the 8 new entries should be pickable (Violence/Universal both surface them).

**Light-up moment validation:** Fire `Artillery Salvo` on a bound battle scene with enemy faction tokens present → expect `_applyDamageToActor` reduces their integrity, then a `bbttcc:raid:canvasVfx` hook fires (Phase 2 listener decorates with orange ring pulses). End-to-end loop from raid console → THROUGHPUT preview → S1 scene-intent dispatch → fourththing damage API → canvas VFX.

**Open items moved to Sprint 3:**
- §6.B inventory table population (still requires operator to run the refresh-pass macros).
- Remaining 6 Universal + 14 Violence entries to reach the §3 grid targets — author opportunistically as gameplay reveals gaps, or batch in a focused S2.5 pass.
- Dice-formula support in `damageSceneTokens` / `healSceneTokens` — currently fixed averages (4 / 7 / 11 for 1d6 / 2d6 / 3d6). Worth ~6 LOC of S1 substrate enhancement when S3 authors maneuvers with variable damage.
- "Diplomatic Channel" maneuver (U2) only emits a `factionEffects` note prompting the GM. Wiring an automatic defender-side opt-in dialog is a future GUI polish; for now GM adjudicates.

---

## 10.5. Sprint 2.5 — SHIPPED 2026-05-15 (~213 LOC)

Post-refresh follow-up. The operator ran the S1 refresh-pass macros, which revealed:

- 16 legacy entries had `meta.raidTypes` mappable to canonical engines but no explicit `meta.engine` field.
- 2 entries (`opt_coordinated_advance`, `opt_infernal_bargain`) had pack docs but **no EFFECTS / no THROUGHPUT / no fire-mode tag** — fully orphaned from runtime registration.
- 40 of 59 pack entries have no `fireMode` tag in the live registry (Phase 4D's 47-key tagger only reflects 19 entries — load-order race investigation deferred to S3).

**Deliverables:**

- `bbttcc-master-content/tools/tag-maneuver-engines.macro.js` (192 LOC) — sets `meta.engine` on every pack maneuver: skips already-tagged (S2 entries), applies OVERRIDES for the 14 unresolved entries per hand-curated mapping, derives engine from existing `meta.raidTypes` for the rest. **`DRY_RUN = true` default**. Idempotent.
- `bbttcc-raid/scripts/maneuvers-sprint2-content.enhancer.js` extended (+21 LOC) — adds 2 entries to SPRINT2_MANEUVERS: `opt_coordinated_advance` (T1 Universal cross-layer pre-roll, logistics-fueled friendly buff) and `opt_infernal_bargain` (T1 Presence strategic anytime, defender-pressure social tool). These reuse the existing `opt_*` keys so they bind to the legacy pack docs rather than create duplicates.

**Operator run order for S2.5:**

1. **Reload Foundry** — picks up the new orphan entries in SPRINT2_MANEUVERS.
2. Console check: `game.bbttcc.api.raid.sprint2Maneuvers.length === 10`.
3. **Run `tag-maneuver-engines` with `DRY_RUN=true`** → review chat report (~50 entries tagged, ~10 already-tagged, 0 unmappable).
4. Flip `DRY_RUN=false`, re-run → applies to pack.
5. **Re-run `extract-doctrines-to-spec`** to capture post-tagging snapshot.

**Known caveat — orphan pack-doc descriptions:**

The 2 orphan entries now have proper runtime EFFECTS+THROUGHPUT, so they appear correctly in the raid console picker with new tooltip text. However, their **pack docs in the compendium** still carry the original (pre-S2.5) descriptions, since `seed-sprint2-maneuvers.macro.js`'s idempotency rule is "skip if key exists." Compendium browse will show the legacy text until either (a) the GM manually edits the pack docs, or (b) we add an `UPSERT` mode to the seed macro (deferred — not blocking, since the raid console picker reads from EFFECTS).

**Open items still on the docket:**

- ✅ ~~Fire-mode tag gap~~ — RESOLVED 2026-05-15 (see §10.6).
- ✅ ~~Orphan pack-doc descriptions~~ — RESOLVED 2026-05-15 (see §10.6).
- `chrono_loop_command` verify-then-decide hand review (the inverted-incentive concern from §2.D).
- Intrigue under-staffing (9 vs target 18) closes during S3b authoring.
- Universal slight under-staffing (8 vs target 10) — natural fill during ongoing authoring.

---

## 10.6. Sprint 2.5 cleanup — SHIPPED + DEPLOYED 2026-05-15 (~217 LOC)

> **Status:** ✅ deployed. Post-deploy snapshot (`doctrines-snapshot-20260515new.json`) confirms: 59/59 fire-mode tagged, 0 packMissingRaidTypes (down from 16), 0 noEffectsEntry (down from 2), both orphans refreshed (Coordinated Advance + Infernal Bargain). One residual: `throughputWired: 58/59` — `opt_psychological_pressure` is narrative-only (no THROUGHPUT handler). Pickable + fire-mode-tagged but emits no preview intent. Not blocking; minor S3+ add.

Two small wins that close the S2.5 docket cleanly before S3a.

### Win 1 — Fire-mode tag load-order fix

**Root cause:** Three-stage load:

1. `Hooks.once("ready")` → compat-bridge's `publishCompat` assigns local `EFFECTS` (which contains only **11 maneuver entries** authored inline) to `game.bbttcc.api.raid.EFFECTS`.
2. Same `Hooks.once("ready")` → `effects-fire-mode-tags.js` queues `applyFireModeTags` on `Promise.resolve()` microtask. Runs **immediately after sync ready handlers** — sees only the 11 maneuvers from compat-bridge plus S2 entries (which self-register at script-load), tags ~19 entries.
3. **150ms later** (separate `setTimeout`) → `bbttcc-raid-maneuvers-loader.enhancer.js` reads `data/bbttcc_maneuvers_v1_4.json` and injects ~40 more maneuvers into `EFFECTS` — but the tagger has already run, so these arrive untagged.

**Fix:** Multi-pass deferred apply in `effects-fire-mode-tags.js` — keeps the original microtask pass and adds two `setTimeout` passes (300ms / 1500ms) that fire after the loader's window. `applyFireModeTags` is idempotent (`if (eff.fireMode) continue;`) so re-passes only fill gaps; already-tagged entries don't get clobbered. ~6 LOC edit.

**Expected post-fix tally:** all 47 declared FIRE_MODE_TAGS keys land + the 8 self-tagging S2 entries = **~55 fireMode-tagged** out of 59 (the remaining 4 are entries authored after the 1500ms window, or keys never declared in FIRE_MODE_TAGS).

### Win 2 — Orphan pack-doc description refresh

**Built:** `bbttcc-master-content/tools/refresh-orphan-pack-docs.macro.js` (103 LOC) — narrow-scope macro that syncs the 2 orphan pack docs (`opt_coordinated_advance`, `opt_infernal_bargain`) from runtime catalog. Writes: `name`, `system.description.value`, plus full `flags.bbttcc.meta.*` block (tier/engine/layer/costBand/fireMode/raidTypes/opCosts/availability/authoredSprint) and `flags.bbttcc.effects.text`. **`DRY_RUN=true` default**. Idempotent. `KEYS_TO_REFRESH` is a top-level const — generalizable to future orphans if needed.

### Operator run order

1. **Reload Foundry** — picks up the multi-pass fire-mode tagger.
2. Console check: `Object.values(game.bbttcc.api.raid.EFFECTS).filter(e => e?.fireMode).length` should jump from 19 → ~55.
3. **Run `refresh-orphan-pack-docs` macro** with `DRY_RUN=true` → review chat report (2 entries to refresh).
4. Flip `DRY_RUN=false`, re-run → applies updates.
5. **Re-run `extract-doctrines-to-spec`** → final post-cleanup snapshot. Fire-mode tagged count should match expectations.

---

## 11. Ready for Sprint 3a — Infiltration Engine Modernization

> **Entry point for next conversation.** Read this section + §7 per-phase Qs to come up to speed cold. Memory pointer: [[project-maneuver-catalog-spec-2026-05-14]]. Three design questions need answers before code work begins; nothing else blocks.

S2.5 complete + deployed. Catalog is now in a fully clean, consistent state:

- **59 entries**, all engine-tagged (Universal 8 / Violence 30 / Intrigue 9 / Presence 12)
- All canonical metadata populated on every pack doc
- **Fire-mode coverage 59/59** (multi-pass fix landed everything; 28 pre-roll / 17 anytime / 14 post-commit)
- **Throughput wired 58/59** (one narrative-only: `opt_psychological_pressure`)
- All 51 legacy entries normalized (no ⭐, no legacy unlockKey, availability=standard)
- 10 new S2/S2.5 maneuvers authored against the new substrate (S1 scene-intent verbs + S2 anytime budget)
- Hard enforcement of anytime budget (T1=per-round / T2-3=per-scene / T4=per-raid)
- Playtest-validated end-to-end loop: raid console → THROUGHPUT → scene-intent dispatch → fourththing damage API → Phase 2 VFX

**Open design questions for S3a** (from §7):
- **Infiltration progress meter** — how does the attacker actually win? Counter-meter to Alarm? Goal token/hex on the stealth-canvas? Both?
- **Stealth-canvas mechanics** — patrol token routes? Line-of-sight cones to "objective" tokens? Alarm-proximity rings? Pick a starter subset; the rest is iterable.
- **Expanded `applyEffects` vocab** — what new scenarioEffects.type verbs does the Infiltration engine learn? Likely candidates: `progressDelta`, `revealDefenderToken`, `hidePatrolRoute`, `setAlarmBand`, `addPatrolWaypoint`.

**Existing engine state** (per §1):
- `raid-infiltration.alarm.enhancer.js` (304 LOC): Alarm 0→max with 4 bands, opposed-roll-per-round, only "lockdown" outcome (no attacker-success path), has `applyEffects(scenarioEffects)` consuming only `alarmDelta`.
- Engine API exposed at `game.bbttcc.api.raid.infiltration(...)` and `game.bbttcc.api.raid._lastInfiltration`.

**S3a substrate scope (~250 LOC):**
- New module: `raid-infiltration.progress.enhancer.js` extends the existing Alarm engine with `progressMax` / `progress` state, transitions on threshold cross, success outcome.
- Expanded `applyEffects` vocab in Alarm engine.
- Stealth-canvas substrate — patrol token decoration (re-use Phase 4B affiliation pattern), proximity ring rendering on alerted tokens (re-use Phase 2 VFX bridge), objective-token marker.

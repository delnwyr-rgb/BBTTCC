# RAID ABILITY SURVEY — toward a unified Raid/Siege ability architecture

**Status:** DRAFT v0.1 — 2026-05-31. A living survey/design doc. Grounded in a full
inventory of the 80-maneuver catalog + the granting/casualty/VFX subsystems (see §1).
Many classification calls below are PROPOSALS for the owner to ratify/refine.

---

## §0 — The conceptual model (two axes)

The "raid" system has accreted into **four domains across two substrates**. Naming the
axes is the whole unlock:

**Axis 1 — SUBSTRATE (where the fiction lives):**
- **Tactical Scene** — hero-token scale, one bound scene, resolved in rounds. The PCs are
  *on camera*; the faction is *off camera* and sends **support** (maneuvers + OP-roll
  bonuses) to the heroes on the ground.
- **Strategic Turn** — faction scale, the campaign map, resolved over Advance Turns. Here the
  faction *forces are the fiction* — the troops holding the gate, the supply train, the
  garrison. There is no PC token; the "actors" are numbers and structures.

**Axis 2 — DOMAIN (what kind of conflict):**
- **Violence** · **Infiltration** · **Social** → the three **scene** types (tableau-bound).
- **Siege** → the **strategic** type (turn-bound).

**The throughline the owner named:** *the off-camera faction fiction provides the support.*
In a scene raid, the crew/association backing the heroes feeds them maneuvers and bonuses.
In a siege, that same off-camera fiction is literally the troops — and so it should be
*counted, depleted, and mourned* (casualties) the way a scene's hero-tokens are.

**The opportunity:** the catalog was authored before these axes were named, so abilities are
mis-shelved — siege content sits in the Violence scene bucket, psy-ops spans timescales it was
never sorted into, and crews don't actually grant the maneuvers they thematically own.

---

## §1 — Current-state inventory (grounded; see agent survey)

### 1a. The 80-maneuver catalog (5 sources)
| Source | Count | Notes |
|---|---|---|
| `data/bbttcc_maneuvers_v1_4.json` | 40 | base; abstract/strategic-leaning; legacy raidTypes strings |
| `maneuvers-sprint2-content.enhancer.js` | 10 | scene-token Violence + Universal |
| `maneuvers-sprint3a-content.enhancer.js` | 10 | Infiltration (alarm engine), all single-scene |
| `maneuvers-balance-content.enhancer.js` | 8 | **the only explicit `siege` tags** (4) + Universal |
| `maneuvers-courtly-content.enhancer.js` | 12 | Social/Courtly (influence engine), all single-conversation |

**Raid-type reality:** `resolveCanonical()` (`raid-maneuvers.js:24-68`) collapses everything to
**3** canonical types — `violence`, `intrigue` (=Infiltration), `presence` (=Social). **`siege`
is NOT first-class — it folds into `violence`.** Only the 4 balance maneuvers carry an explicit
`["siege","violence"]` tag.

### 1b. Three flagged groupings (from the survey)
- **SIEGE-FLAVORED (~14):** `siege_breaker_volley`, `saboteur_s_edge`, `last_stand_banner`,
  `patch_the_breach`, `supply_overrun`, `defender_s_reversal`, `void_signal_collapse`,
  `tactical_overwatch`, `industrial_sabotage`, `logistical_surge`, + the 4 balance breach
  maneuvers (`sap_the_walls`, `shore_the_gate`, `sortie_en_masse`, `crack_the_keep`).
- **PSY-OPS / INFO (~25):** `smoke_and_mirrors`, `flash_interdict`, `signal_hijack`,
  `psychic_disruption`, `counter_propaganda_wave`, `moral_high_ground`, `empathic_surge`,
  `unity_surge`, `cultural_offensive`, `opt_infernal_bargain`, the alarm-disruption trio
  (`disable_alarm`/`distract`/`impersonate`), + the entire 12-card Courtly secrets/rumor set.
- **SCENE-TACTICAL (~38):** the sprint2 violence tokens, all 10 sprint3a infiltration, all 12
  courtly, + base token-scale exceptions (`suppressive_fire`, `echo_strike_protocol`, etc.).

### 1c. Granting taxonomy
- **Doctrine system** (faction-owned): embedded `type:"feat"` items with `flags.bbttcc.{kind,key}`
  on the faction actor. `game.bbttcc.api.factions.doctrine.{list,ownedKeys,grant}`. The raid
  console gates factions to OWNED maneuvers (fail-open if a faction has no doctrine items).
- **Character-option unlocks**: 18 group types in `bbttcc-character-options/data/refined-options.js`,
  each mapping to an **l1 + l2 maneuver key**:
  - **Crews (6):** mercenary_band, peacekeeper_corps, covert_ops_cell, cultural_ambassadors,
    diplomatic_envoys, survivors_militia.
  - **Occult (6):** kabbalist, alchemist, tarot_mage, gnostic, goetic_summoner, rosicrucian.
  - **Archetypes (6):** warlord, hierophant, mayor_administrator, wizard_scholar, ancient_blood,
    squad_leader.
- **Echo Assets** (`systems/fourththing/bbttcc-bridge.js:getFactionEchoAssets`): tracks
  `activeCrew[]` / `activeOccult[]` (+ reserves) per faction — **narrative only; grants nothing.**
- **THE GAP:** no hook makes an *active crew* grant *its* maneuvers to the faction it backs.
  Crews unlock maneuvers at the *character* level (roster option count), not as a *crew-supports-
  these-heroes* grant.

### 1d. Troops / casualties / VFX substrate
- **Garrison is counted:** `computeDefenderBudget(hexUuid)` = active champs×2 + wounded×1 +
  rigs×1 + bosses×2 + facilities×0.5 + reinforce. Holdings = `hex.flags.bbttcc-territory.holdings
  {rigIds,bossIds}` + `siege.{attacker,defender}Champions[]`.
- **Casualties — REAL but partial:** raid margin formula (`loser=⌊|margin|/3⌋`, `winner=⌊|margin|/5⌋`),
  applied to the roster via `game.fourththing.rolls._applyDamageToActor` (shuffles N crew/stewards,
  wounds them). Editable casualty card with ± buttons. **STUBBED:** sortie roster write-back
  ("deferred to Phase E", never built) and `lost_supply_crisis` attacker `1d4` holdings loss
  (defined in the outcome matrix, never consumed).
- **No abstract "troop count":** holdings are discrete actors, not a *number of soldiers*. There is
  no muster/garrison-size scalar that support and casualties draw from.
- **Tableau forced-perspective is LIVE** (`tableau.canvas.js`): Y-position → depth scale (0.25–1.0,
  power curve), z-sort by Y, purely cosmetic. Enable via `scene.flags.bbttcc-raid.tableau.enabled`.
- **Siege VFX is DOM/banner-only** (`siege-vfx.js`): full-screen flash, board shake, top banners,
  HUD pulse, per-event (layerBreached/convene/outcome/duel/relief/trojan/cascade/event). **No
  projectile/spatial rendering** — no ballista bolts or fireballs, no from→to animation, no
  scene-locked effects. The hooks exist; the spatial payload + renderer do not.

---

## §2 — The Survey: classification framework

**The sorting test (apply to every ability):**
> *Does it act on a BOUND SCENE (tokens, one room/fight/conversation, rounds) — or on the
> STRATEGIC MAP (a faction, fortifications, supply, over Advance Turns)?*

- **Scene** → it's a **maneuver**, played in a tactical raid/tableau, *granted by the crew/
  association backing the heroes*. Tag with its domain (Violence/Infiltration/Social) — and note
  that **Universal** maneuvers apply to all three.
- **Strategic** → it's a **strategic activity** (siege or campaign), played in the planner,
  resolved on Advance Turn, *owned by the faction*.

**Output of the survey = three tables (drafts in §7):**
1. **Scene maneuvers → granting crew/association → applicable raid type(s).**
2. **Siege/strategic conversions → strategic-activity form → how it plays out.**
3. **Psy-ops split → tactical (in-scene) vs strategic (campaign info-war).**

---

## §3 — Key findings (the opportunity, ranked)

**Finding A — Siege content is mis-shelved in Violence.** ~14 maneuvers assume fortifications/
attrition/supply. They don't belong in a hero-token scene; they belong as **strategic activities**
on the siege turn. `Bombard` (shipped 2026-05-30) is the proof of concept: a "Sap the Walls"-class
maneuver re-expressed as a per-turn strategic activity that chips Plates. Do the same for the rest.

**Finding B — Psy-ops/info spans two timescales and was never sorted.** ~25 abilities. Some are
genuinely tactical (reduce *this scene's* alarm; win *this* exchange). Others are campaign-scale
(propaganda that shifts a faction's morale over turns; supply/info interdiction). Split them: the
in-scene ones stay maneuvers; the campaign ones become **strategic activities** (and many already
have siege analogues — Interdict Supply Line, etc.).

**Finding C — Crews don't grant what they thematically own.** The data is *already there*
(`REFINED_OPTIONS` maps each crew/occult/archetype → maneuvers), but the grant is character-level.
Wire **Echo Assets active crew → faction maneuver grant**: when a crew is "manifesting" for a
faction, its l1/l2 maneuvers become the support that faction can feed its heroes. This is the
"off-camera fiction provides support" model made mechanical.

**Finding D — The off-camera troops need to be a NUMBER, not just actors.** To "count them among
the casualties," sieges (and ideally scene raids) need a **muster/garrison scalar** per side that
(a) scales the support budget, (b) is the pool casualties deplete, and (c) drives the tableau
crowd + VFX intensity. Finish the stubbed casualty write-backs against it.

---

## §4 — Siege-conversion pattern (maneuver → strategic activity)

**The template** (Bombard is the reference implementation):
> A scene maneuver that "does X to the enemy/wall this round" becomes a strategic activity that
> "does X over a turn, resolved on Advance Turn, paid in OP, with a war-log beat + optional VFX."

**Proposed conversions for the 14 siege-flavored maneuvers** (attacker A / defender D):
| Maneuver (scene) | → Strategic activity (siege) | Plays out as |
|---|---|---|
| sap_the_walls / crack_the_keep | **Bombard** (DONE) | per-turn Plate damage to current layer |
| siege_breaker_volley | **Breach Battery** (A) | bigger Plate hit + strips "Fortified" for N turns |
| saboteur_s_edge | **Undermine** (A, Intrigue) | ignore Fortified; small Plate dmg; alarm/exposure risk |
| supply_overrun | *(already)* Interdict/Sortie family | supply pressure |
| shore_the_gate / patch_the_breach | **Shore the Defenses** (D) | restore Plates / +threshold this turn |
| last_stand_banner / defender_s_reversal | **Hold the Line** (D) | negate first Plate loss / reflect a Bombard |
| sortie_en_masse | *(already)* Sortie | sever supply + casualties |
| logistical_surge / industrial_sabotage | **War Economy / Sabotage Works** | OP-econ pressure over turns (siege or campaign) |
| tactical_overwatch | folds into Bombard accuracy / a defender counter | — |
| void_signal_collapse | **Comms Blackout** (A) | suppress a defender activity next turn |

Each gets `siege:true, siegeSide` tags (groundwork already threaded) so they slot into the
**dedicated Siege planner section** (Attacker/Defender groups).

---

## §5 — The off-camera troops fiction + casualties

**Proposal — the MUSTER (a troop-count scalar per side per siege):**
- `siege.attackerMuster` / `siege.defenderMuster` — a "number of soldiers" derived at declare
  from the contributing fiction: garrison holdings (rigs/bosses/facilities) + faction tier +
  active supporters' contingents. (Champions stay named/special on top of the muster.)
- **Muster scales support:** the Anytime/maneuver budget and Bombard/Sortie potency scale with
  muster — bigger host, more it can do per turn.
- **Muster is the casualty pool:** every casualty-dealing beat (Sortie 1d4, Bombard return fire,
  Storm-at-Sea, the breach storm, Divine Plague) deducts from muster *before* it ever touches a
  named roster actor. Named champions/holdings only start dying once the muster is bled out — so
  "the troops" absorb attrition, exactly as fiction expects.
- **End-of-siege casualties report:** finish the stubbed write-backs (`sortie roster`, `lost_
  supply_crisis 1d4 holdings`) and add a **muster reconciliation**: total dead per side, % of host
  lost, which named holdings fell, drained into one chat card + a war-log "butcher's bill" beat.
  Reuse the existing `_applyDamageToActor` roster-application for the named overflow.

**Who lives here (the fiction):** the besieged hex's **garrison** (its holdings + facility crews +
the defender faction's tier-scaled levy); the attacker's **host** (its holdings + supporters'
contingents); **champions** (named PCs/bosses/rigs) standing above the muster on both sides. The
muster is the anonymous mass that holds the gate and dies on the wall; champions are the names the
saga remembers.

---

## §6 — Tableau VFX for siege events (capability EXISTS — wire it)

**Correction to the v0.1 VFX agent finding:** the agent only saw `siege-vfx.js` (the DOM
banner/flash layer). There is ALSO a real **JB2A + Sequencer projectile layer** already integrated
(`bbttcc-fx-integration`, `fx.playSequencerEffect`, rewired Sequencer-direct 2026-05-30, LIVE-
validated). So forced-perspective bolts/fireballs/boulders are NOT a from-scratch gap — the renderer
exists.

**What's live:**
- Forced-perspective **tableau** (Y→depth scaling, `tableau.canvas.js`) — the staged camera.
- DOM **banner/flash/shake** VFX per siege hook (`siege-vfx.js`).
- **JB2A/Sequencer** projectile/effect playback (`fx.playSequencerEffect`) — JB2A `SiegeBoulder` /
  `rolling_boulder` / `eruption` assets confirmed present.

**Already greenlit (handoff written, not started):** **Siege boulder bombardment** —
`[[project_siege_boulder_bombardment_handoff_2026_05_31]]`: JB2A boulders as `tableauActor` tokens
that auto-recede/shrink down a tableau siege scene (free, via tableau Y-scaling on `refreshToken`)
toward the `layer.structureActorId` wall token, explode on impact (`fx.playSequencerEffect` +
`_shakeBoard`), then clean up. Fires a new `bbttcc:siege:bombardment` beat via the existing
siegeHook socket relay (`module.raid-console.js:~6602`).

**The synergy to wire:** the new **Bombard strategic activity** (`828bac4`) is the perfect trigger —
when Bombard resolves on Advance Turn, fire `bbttcc:siege:bombardment` so the boulders arc siege-line
→ wall in forced perspective, impact-burst, and the Plate damage lands visibly. Same pattern for the
event deck (Storm-at-Sea lightning, Divine Plague arrow-rain on the muster) and the breach storm.
Tie projectile **count/intensity to muster size** (§5) — a big host throws more.

**Net:** §6 is not "build a renderer," it's "connect Bombard + the event deck + muster to the
already-greenlit boulder/Sequencer layer."

---

## §7 — Draft deliverable tables (TO RATIFY — owner's calls)

### 7a. Scene maneuver → granting crew/association → raid type(s)
*(Seeded from `REFINED_OPTIONS` l1/l2; "any" = applies to all 3 scene types. Multiple groups MAY
grant the same power. This table is the survey's core worksheet — fill/adjust per group.)*

| Crew / Association | Grants (l1 / l2) | Domain | Applies to |
|---|---|---|---|
| mercenary_band (crew) | hardened_advance / contract_warfare_doctrine | Violence | Violence (+ Siege host?) |
| peacekeeper_corps (crew) | containment_protocol / stability_enforcement | Violence/Social | Violence, Social |
| covert_ops_cell (crew) | silent_entry / deep_cover_network | Infiltration | Infiltration |
| cultural_ambassadors (crew) | psychological_pressure / cultural_diffusion | Social/Psy-ops | Social (+ campaign info-war?) |
| diplomatic_envoys (crew) | formal_parley / integration_framework | Social | Social |
| survivors_militia (crew) | make_do_and_hold / never_scattered | Violence/Universal | all 3 (+ Siege defense?) |
| kabbalist … rosicrucian (6 occult) | per refined-options | mixed/Faith | per-power |
| warlord … squad_leader (6 archetypes) | per refined-options | mixed | per-power |

*(The base-40 + sprint/balance/courtly maneuvers each need a "granted-by" assignment too — many are
currently faction-doctrine-only with no crew home. That's the bulk of the survey work: give every
scene maneuver a crew/association home, allowing shared grants.)*

### 7b. Siege/strategic conversions — see §4.

### 7c. Psy-ops split — tactical vs strategic — see §3 Finding B (worksheet TBD).

---

## §8 — Recommended build sequence
1. **Ratify the framework** (§0–§2) + the conversion list (§4) with the owner.
2. **Dedicated Siege planner section** (already agreed; tags threaded) — gives the strategic
   activities a home and makes §4 visible.
3. **Convert the 14 siege maneuvers → strategic activities** (Bombard pattern), tag them.
4. **Echo-Assets → maneuver grant** (Finding C): `factionApi.echo.grantManeuversByActiveCrew()`
   — wire crews to actually feed their heroes.
5. **The Muster + casualty write-back** (Finding D / §5): troop scalar, finish stubs, butcher's-bill
   report.
6. **Projectile VFX** (§6): `siegeVfx.projectile`, tie to Bombard + event deck.

---

## Open questions for the owner
- Do **scene maneuvers** want a single crew home each, or a many-to-many "any of these crews can
  grant it" map? (The data supports many-to-many.)
- Should the **Muster** exist only for Sieges, or also back scene raids (so a scene's "off-camera
  support" has a depletable size too)?
- For psy-ops: is campaign **info-war** its own strategic track, or a wing of Siege/Courtly?
- VFX: the Sequencer/JB2A layer already exists (`fx.playSequencerEffect`) + the boulder-bombardment
  handoff is greenlit — confirm we wire **Bombard → `bbttcc:siege:bombardment`** as the first
  projectile beat?

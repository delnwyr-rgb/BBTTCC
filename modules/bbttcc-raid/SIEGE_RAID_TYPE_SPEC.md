# SIEGE_RAID_TYPE_SPEC.md

**Status:** SIGNED OFF 2026-05-22 — Phases A · A.5 · B · C · **D (COMPLETE)** · **E (COMPLETE)** SHIPPED+synced 2026-05-22/23. **✅ PHASE F COMPLETE + synced 2026-05-23** (F.1=`0ada94a`, F.2=`d3a5a57`, F.3=`b928954`, F.4=`cdb34ad`). **The core siege engine (Phases A–F) is feature-done and live on both Lightsail instances.** Capstone walkthrough: `tools/SIEGE_PLAYTEST_SCRIPT.md`. Remaining: **Phase G** (Courtly composability / Odyssey journey mode / tactical naval — separate sign-off). Known later-pass items: `lost_pyrrhic` + `abandoned` outcome auto-triggers; desert-specific event; truce maneuver-gating enforcement.
**Parent specs:**
- `bbttcc-structures/STRUCTURE_DAMAGE_SPEC.md` (SIGNED OFF 2026-05-20; Phases A+B+B.9+C+D SHIPPED 2026-05-21)
- `bbttcc-raid/COURTLY_INTRIGUE_SPEC.md` (SIGNED OFF 2026-05-20; ALL PHASES SHIPPED 2026-05-21)
- `bbttcc-raid/MANEUVER_CATALOG_SPEC.md` §11 (S1+S2+S2.5 SHIPPED 2026-05-15)

---

## §0 — North Star: The Iliad and the Odyssey

This engine must be able to re-enact The Iliad and The Odyssey. That is the design touchstone — not a stretch goal, the *acceptance criterion*. Specifically:

- **Extreme protraction** — Troy held ten years. The Epic size dial must reach 20+ campaign turns without breaking pacing.
- **Champions on the wall** — Hector and Achilles are not abstract garrison. Their presence/absence on a given turn pivots the siege. Achilles sulking in his tent ≠ Achilles in the line.
- **Champion death cascade** — Patroclus falls → Achilles rejoins → Hector falls → the war turns. Single-actor deaths trigger Buffer/morale cascades that dwarf any single Bombard maneuver.
- **Champion duels as a maneuver type** — Ajax vs Hector, Paris vs Menelaus. 1v1 tableau scene, narrative weight, outsize effect.
- **Trojan Horse** — a T4 Intrigue play that can resolve a siege without razing a layer. High-risk multi-roll gate.
- **Camp politics** — the Agamemnon-Achilles quarrel was a Courtly Intrigue scenario *inside* the besieging army. Sieges must compose with Courtly.
- **Multiple relief waves** — Penthesilea, Memnon. An array, not a single clock.
- **Naval supply** — beached ships are the depot; sea is the supply spine.
- **Plague, omens, divine intervention** — a Siege Event Deck. Each turn rolls flavor with mechanical bite.
- **The improvement ledger as epic spine** — every memorable beat ("Hector falls," "Funeral games for Patroclus," "Trojan Horse: success") is a ledger entry the system can retell.

The Odyssey lens adds **disguised infiltration as siege resolution** (Odysseus among the suitors → Recognition → massacre tableau, composing Infiltration + Siege). Pure Odyssey-style protracted journeys (crew attrition over voyage) are deferred to a later Journey sprint.

---

## §1 — Concept

Siege is the first BBTTCC raid type that's **protracted across campaign turns**. It is a *container*, not a fixed shape: GMs stack 1-to-N Structure layers, pick a transition rule per layer, dial siege size, and the engine derives pacing.

Two modes:

- **Strategic Mode (default)** — multi-campaign-turn HUD-driven phase. Supply Buffer ticks down per derived Siege Cost. Three threat vectors (Interdict / Relief Force / Counter-Interdict) plus Event Deck create pressure. Both sides plan Counter-Activities on the existing Strategic Activity Planner.
- **Tactical Mode (punctuation)** — GM convenes a Breach Scene on the current layer's POV tableau. Existing raid console + maneuver catalog + `applyStructureDamage` flow handle the assault. `bbttcc:structure:stateChanged` advances the siege to the next layer.

Sieges are the *finale* of a campaign arc, not the start. They require pre-built supply infrastructure (Establish Supply Line), depot qualification (Found Fortress / Designate Capital / Beached Camp), and either alliances or corridor conquest. **This is by design.**

The engine rides almost entirely on existing infrastructure:
- Strategic Activity Planner (`bbttcc-raid/scripts/module.raid-planner.js:891`)
- Turn Driver + `bbttcc:advanceTurn:end` hook (`bbttcc-territory/scripts/turn-driver.js`)
- Hex flag schema + `turn.pending` mechanism (`bbttcc-territory/scripts/main.js`)
- Structure damage path (`bbttcc-structures/damage-path.js:311–393`)
- Bulwark hookups (`bbttcc-structures/bulwark-hookups.js`)
- Holdings garrison roster (`bbttcc-territory` Phase A+B+C+D)
- POV Tableau system (`tableau-native-vistas-2026-05-21`)
- Maneuver catalog + engine-tagger (`bbttcc-raid/MANEUVER_CATALOG_SPEC.md` §11)

What's authored *new*: siege state schema, ~12 activities, the strategic tick handler, the Breach Scene convene flow, the Event Deck, the Champion mechanic, and the outcome write-back matrix.

---

## §2 — Encounter Schema

### Persistent hex flag (independent of any active siege)

```javascript
hex.flags["bbttcc-territory"].structureActorIds: String[]
```

Array of Actor IDs of Structures associated with this hex. Populated by Found Fortress / Forge recipes / manual edit. Default source for siege layers. Multiple Structures per hex permitted.

### Live siege state (only present while siege active)

```javascript
hex.flags["bbttcc-territory"].siege = {
  // Identity
  siegeId: String,                          // unique; UUID-ish
  attackerFactionId: String,
  supportingFactionIds: String[],           // raid-supporters; supply-line eligible
  startedTurn: Number,                      // world turn at planning
  
  // Layers (the walls the attacker must breach)
  layers: [{
    layerId: String,
    structureActorId: String,               // Actor with flags.bbttcc-structures.hasStructure
    sceneId: String,                        // POV tableau scene for this layer
    transitionRule: "razed" | "threshold" | "stockpile",
    thresholdPct: Number?,                  // if transitionRule==="threshold"
    stockpileMax: Number?,                  // if transitionRule==="stockpile"
    stockpileCurrent: Number?,
    breached: Boolean,
    breachedAtTurn: Number?,
    breachedBy: "damage" | "stockpile" | "trojan_horse" | "surrender"
  }],
  currentLayerIdx: Number,                  // 0 = outermost
  
  // Size dial (pacing)
  sizeProfile: "skirmish" | "standard" | "protracted" | "epic",
  targetTurns: Number,                      // derived from size for HUD
  
  // Supply Buffer (OP-denominated reserves)
  buffer: {
    violence: Number,
    logistics: Number,
    economy: Number,
    softPower: Number?,
    diplomacy: Number?,
    faith: Number?,
    intrigue: Number?
  },
  bufferStartingTotal: Number,              // for HUD ratio
  
  // Supply chain
  supplyOriginHexId: String,                // GM-declared depot
  supplyOriginType: "owned_hex" | "beached_camp",
  supplyPathHexIds: String[],               // BFS cache, recomputed each turn
  supplyStatus: "supplied" | "harassed" | "severed",
  supplySeveredAtTurn: Number?,
  gracePeriodTurns: Number,                 // default 2, terrain-modulated
  isNavalSupply: Boolean,
  
  // Conditions snapshot (refreshed each turn)
  perTurnDrain: { violence, logistics, economy, ... },
  conditionsBreakdown: {
    terrain: Number,
    fortified: Number,
    distance: Number,
    supplyEfficiency: Number,
    harassment: Number,
    bulwarkDiscount: Number,
    naval: Number
  },
  
  // Threat state
  interdictionsThisTurn: Number,
  escortPipsThisTurn: Number,
  reliefWaves: [{
    waveId: String,
    callingFactionId: String,
    arrivesTurn: Number,
    resolved: Boolean,
    outcome: "attacker_won" | "attacker_lost" | null
  }],
  
  // Champions (the Iliad layer)
  attackerChampions: [{ actorId, status: "active" | "absent" | "wounded" | "dead", reason }],
  defenderChampions: [{ actorId, status, reason }],
  
  // Event Deck
  eventDeckId: String?,                     // which deck (default = "generic")
  eventsFired: [{ turn, eventId, payload }],
  
  // Improvement narrative spine
  narrativeBeats: [{
    turn: Number,
    kind: String,                           // "champion_duel" | "plague" | "trojan_horse" | "breach" | etc.
    title: String,                          // "Hector falls"
    description: String,                    // for retelling
    actorIds: String[]?,
    payload: Object?
  }],
  
  // Outcome
  status: "active" | "won_storm" | "won_sack" | "won_surrender" | "won_trojan_horse" |
          "lost_hold" | "lost_pyrrhic" | "lost_relieved" | "lost_supply_crisis" | "abandoned",
  endedTurn: Number?
}
```

### Faction back-references

```javascript
faction.flags["bbttcc-factions"].activeSieges: String[]   // hexIds where this faction is attacker
faction.flags["bbttcc-factions"].defendingSieges: String[] // hexIds where this faction is defender
faction.flags["bbttcc-factions"].championRoster: String[]  // Actor IDs flagged as Champions
```

---

## §3 — Strategic Mode

### Begin Siege activity (catalog entry)

Add to `bbttcc-raid/data/bbttcc_activities_v1_4.json`:

```javascript
{
  name: "Begin Siege [T2]",
  type: "feat",
  flags: { bbttcc: {
    kind: "strategic",
    tier: 2,
    rarity: "rare",
    category: "Violence / Military",
    opCosts: { violence: 30, logistics: 20, economy: 10 },
    effects: { text: "Establish a multi-turn siege on a target hex. ..." },
    minFactionTier: 1,
    siegeRequiresTarget: true,
    siegeSizePicker: true
  }}
}
```

Planner UI extends with: size dial (Skirmish/Standard/Protracted/Epic), depot picker, layer-override editor.

### Begin Siege handler

`STRATEGIC_THROUGHPUT["begin_siege"]` in `bbttcc-raid/scripts/siege-throughput.js` (new file):

1. **Validate target hex** — must have `structureActorIds.length > 0` OR GM provided inline layers
2. **Validate depot qualification** — owner + marquee modifier + non-empty holdings + not-besieged + not-fail-state (see §4)
3. **Compute initial supplyPathHexIds** via BFS (see §3 BFS rule)
4. **Consume Bulwark discount** — read `attackerFaction.flags.bbttcc-structures.siegeCostDiscount`; if armed, apply −25% to perTurnDrain and clear TTL
5. **Snapshot champions** — populate `attackerChampions` from attacker faction's roster, plus PCs participating
6. **Initialize Event Deck** — assign `eventDeckId` per terrain/biome (default "generic")
7. **Write `hex.flags.bbttcc-territory.siege`** — full payload
8. **Append narrativeBeat** — `{ kind: "siege_declared", title: "..."  }`
9. **Append improvement ledger** — `kind: "siege_started"`
10. **Schedule next-turn re-queue** — push `type: "planned", activityKey: "siege_tick"` to attacker warLogs

### Strategic tick (per `bbttcc:advanceTurn:end`)

`siegeTurnTick(siegeState)`:

1. **Recompute supply** — BFS along `hex.modifiers.includes("Supply Line") AND hex.ownerFactionId ∈ { attacker, allies (peacetime), raid-supporters (during raid) }`
2. **Update supplyStatus** — supplied / harassed (interdictions > 0) / severed (no path)
3. **Grace clock** — if severed → start clock; past grace → perTurnDrain ×3
4. **Compute perTurnDrain** from conditions matrix (§3 below)
5. **Deduct from Buffer** — round-robin across committed OP categories
6. **Roll Event Deck** — d20 vs deck threshold; if hit, apply event effect + narrativeBeat (see §9)
7. **Resolve relief waves** — for each `reliefWave` with `arrivesTurn === currentTurn`, prompt GM to Convene Relief Scene
8. **Check buffer exhaustion** — if Buffer total ≤ 0 → trigger `lost_supply_crisis` outcome
9. **Check champion attrition** — wounded champions may shift status, dead champions are permanent
10. **Re-queue siege_tick** for next turn unless status !== "active"

### Conditions matrix (perTurnDrain calc)

All inputs read from existing hex flags:

| Factor | Source | Effect |
|---|---|---|
| Base by size | `sizeProfile` | skirmish: 8 / standard: 5 / protracted: 3 / epic: 2 OP per turn |
| Terrain | `hex.flags.bbttcc-territory.terrain.key` | see Terrain Modifier Table below |
| Fortified bonus | `modifiers.includes("Fortified")` | +25% defender threshold (slower breach) |
| Supply chain length | `supplyPathHexIds.length` | +0.5 OP/turn per hex of path |
| Harassment | `interdictionsThisTurn` | +2 OP/turn per active interdiction |
| Bulwark discount | `attacker.flags.bbttcc-structures.siegeCostDiscount.armed` | ×0.75 (consumed on first apply) |
| Naval supply | `isNavalSupply === true` AND `terrain ∈ { sea, coast }` | ×0.7 (sea routes are cheaper, but blockade-vulnerable) |
| Champion deficit | `attackerChampions.filter(c => c.status==="active").length < 1` | +30% (no champions = slower assault) |

### Terrain Modifier Table

Both `perTurnDrain` multiplier AND `gracePeriodTurns` derive from terrain. Drain multiplier > 1.0 = harsh terrain (more attrition). Grace period < 2 = fragile supply.

| Terrain key | Drain ×Mult | Grace Turns | Notes |
|---|---|---|---|
| `radiated` | 1.8 | 0 | Contaminated zone. Supply spoils on arrival; no grace at all. |
| `mountain` | 1.5 | 1 | Narrow passes, slow movement. |
| `badlands` | 1.5 | 1 | Chokepoint-rich, ambush-vulnerable. |
| `canyon` | 1.5 | 1 | Same family as badlands; single-file supply trains. |
| `volcanic` | 1.5 | 1 | Treacherous footing, periodic eruption hazard. |
| `swamp` | 1.4 | 1 | Mired wheels, sickness vector. |
| `tundra` | 1.4 | 1 | Cold spoilage; frostbite attrition. |
| `desert` | 1.3 | 1 | Waterless, exposure. Beached Camp inland fragile. |
| `jungle` | 1.3 | 1 | Disease vector, slow march. |
| `forest` | 1.2 | 2 | Standard but ambush-prone. |
| `coast` | 1.0 | 2 | Naval supply possible; mixed terrain. |
| `hills` | 1.0 | 2 | Default. |
| `plains` | 1.0 | 2 | Default. |
| `road-network` (modifier) | ×0.8 | +1 | Stacks ON TOP of terrain (e.g., plains+road = ×0.8 / 3 turns). |
| `sea` | 0.7 | 1 | Naval-only; fragile to weather + interdiction. |
| `sacred` / `holy-site` (modifier) | ×0.9 | +0 | Slight discount but draws Event Deck attention. |

GM can override grace period per-siege at build time (e.g., a freak storm tightens grace).

### Naval supply notes

- **Sea hexes**: cannot host a permanent depot; CAN be traversed by supply BFS *if* attacker has at least one ship-capable faction unit OR a "Beached Camp" depot
- **Coast hexes**: can host depot via "Beached Camp" alternate flow (see §7)
- **Naval BFS**: traverses sea hexes adjacent to coastal ownership chain; one sea-hop ≈ 0.3 land-hexes of cost
- **Naval interdiction**: third-party faction with naval capability can interdict sea supply via standard Interdict Supply Line (Phase B implements BFS hooks; Phase G enriches naval combat)

---

## §4 — Threat Vectors

### Interdict Supply Line

```javascript
{ name: "Interdict Supply Line [T1]", category: "Intrigue / Espionage",
  opCosts: { intrigue: 15, violence: 10 }, tier: 1 }
```

Targets a hex on any active siege's `supplyPathHexIds`. On resolution:
1. Strip `modifiers: "Supply Line"` from target hex (queued via `turn.pending.repairs.removeModifiers`)
2. Increment `siege.interdictionsThisTurn` on every siege using that hex
3. Shave 10 OP from the Buffer (round-robin)
4. Append narrativeBeat + chat card

### Escort Supply Line / Counter-Interdict

```javascript
{ name: "Escort Supply Line [T1]", category: "Violence / Military",
  opCosts: { violence: 10, logistics: 10 }, tier: 1 }
```

Adds 1 escort pip on a specific siege; each pip cancels one interdiction next tick. Defender-played Sortie attacks targeted at escort-pip-protected hexes get a defender penalty.

### Relief Force (Wave)

```javascript
{ name: "Send Relief Force [T2]", category: "Violence / Military",
  opCosts: { violence: 25, logistics: 15 }, tier: 2 }
```

Defender (or defender's ally) plays it. Pushes a new wave onto `siege.reliefWaves[]`:
- `arrivesTurn = currentTurn + 2` (modulated by distance from calling faction's capital)
- Attacker HUD: "RELIEF APPROACHING — Wave N — 2 turns"
- On `arrivesTurn`: GM prompted to Convene Relief Scene (separate tableau, open-field, NO Structure layers)
- Attacker wins relief scene → wave resolved, `reliefClock` clears, Buffer −15, defender −1 morale
- Attacker loses → siege auto-collapses, `status: "lost_relieved"`
- Multiple waves can stack — defender can call relief repeatedly while paying the cost

### Sortie (defender)

```javascript
{ name: "Sortie [T1]", category: "Violence / Military",
  opCosts: { violence: 20 }, tier: 1 }
```

Defender attacks one adjacent attacker-supply hex. Removes Supply Line modifier + Buffer −15. Risk: defender +1 casualty (1d4 holdings drawn from garrison).

---

## §5 — Tactical Mode: Convene Breach Scene

### Trigger

- **Primary**: GM gesture from Siege HUD → "Convene Breach Scene" button
- **Auto-suggest**: when accumulated tableau-eligible Bombard maneuvers exceed N (default 3), HUD pip lights up
- **Never auto-fire** — dramatic moments are GM pacing decisions

### Flow

1. GM clicks Convene → opens raid console (`game.bbttcc.api.raid.openConsole({ siegeId, layerIdx })`)
2. Scene swap to `siege.layers[currentLayerIdx].sceneId` — relay via existing socket pattern
3. Layer Structure token placed on scene if not present (auto-deploy via `holdings.deployToScene`-like helper)
4. Standard raid console UI; maneuver catalog filtered to `siege` engine-tag
5. Each Bombard / Storm / Sap maneuver fires `applyStructureDamage(layerActorId, dmg, opts)` (existing path)
6. Subscribe to `bbttcc:structure:stateChanged` for layer transitions
7. GM closes Breach Scene → state persists; can re-convene later

### Layer transition handling

On `bbttcc:structure:stateChanged` fire, evaluate current layer's `transitionRule`:

| Rule | Triggers on |
|---|---|
| `razed` | new state === `"razed"` (load-bearing lock means all Sephirotic = 0) |
| `threshold` | `platesCurrent / platesMax ≤ thresholdPct` |
| `stockpile` | `layer.stockpileCurrent ≤ 0` (depleted by defender Renewal cost / Bulwark Siege Cost / Sortie) |

On breach:
1. Set `layers[idx].breached = true; breachedAtTurn = currentTurn; breachedBy = "damage"`
2. Append narrativeBeat: `{ kind: "layer_breached", title: "The Sept Wall falls" }`
3. Fire Catastrophic Entry VFX on tableau (mirrors Bulwark hookup; relays via socket)
4. Advance `currentLayerIdx++`
5. If `currentLayerIdx === layers.length` → trigger Storm outcome
6. Otherwise → scene swap to next layer; broadcast `siegeSceneSwap` socket
7. Defender automatically gets Catastrophic Entry effect from Bulwark on next layer (existing mechanism)

### Champion Duel maneuver

New entry in maneuver catalog (`bbttcc-raid/scripts/maneuvers.json` or equivalent), engine-tagged `siege`:

```javascript
{
  id: "siege_champion_duel",
  category: "I",                            // Invocation
  tier: 1,
  cost: { anytime: 2 },
  text: "Issue a duel challenge to a defender Champion. ...",
  uiHandler: "openChampionDuelDialog"
}
```

When fired:
1. Dialog: pick attacker champion (active only) + defender champion (active only)
2. 1v1 mini-tableau scene (existing PC-vs-token combat flow)
3. Resolution writes `championDeath` event to siege state if either dies
4. Cascade per §8

---

## §6 — Defender + Attacker Model: Champions

### Champion mechanic

A Champion is any Actor (PC, Boss, named NPC, or even a heroic Rig) flagged as such on the owning faction:

```javascript
faction.flags["bbttcc-factions"].championRoster: String[]   // Actor IDs
```

At siege-start, both sides snapshot their available Champions into `siege.{attacker,defender}Champions[]` with starting status `"active"`.

### Champion states

| Status | Set by | Effect on siege |
|---|---|---|
| `active` | default | Contributes +2 Anytime budget per round; can initiate Champion Duels; required to avoid champion-deficit Buffer penalty |
| `absent` | Activity ("Champion Withdraws"), narrative event, GM gesture | Contributes 0; champion-deficit Buffer penalty applies |
| `wounded` | Lost a duel, took heavy hit | Contributes +1 (half budget); 50% chance per turn to recover to active |
| `dead` | Killed in Breach Scene / Duel / event | Permanent; triggers championDeath cascade |

### Champion presence/absence as an Activity

```javascript
{ name: "Champion Withdraws [T2]", category: "Soft Power / Culture",
  opCosts: { softPower: 15, diplomacy: 10 }, tier: 2,
  text: "A named Champion withdraws from the siege ..." }
```

Attacker-played (Achilles sulks in his tent). Sets target champion's status to `absent`. Reverse activity "Champion Returns" (Diplomacy 20 + SoftPower 10) restores `active`.

### Defender Anytime budget per round

Sum of:
- Holdings tier total (rig count × 1 + boss count × 2 + facility count × 0.5)
- Active defender Champions × 2 (each)
- Existing standing maneuver-catalog allowance

### Composability with Courtly Intrigue

The attacker camp (the besieging army) can be the *subject* of a Courtly Intrigue scenario in parallel. The Agamemnon-Achilles quarrel literally maps:

```
Attacker faction (Greeks)
├─ Siege of Troy (this engine)
└─ Courtly Intrigue: "The Quarrel Over Briseis" (Courtly engine, sceneFlags = camp tableau)
   └─ Outcome: Achilles withdraws → siege.attackerChampions["achilles"].status = "absent"
```

Cross-link API: `game.bbttcc.api.siege.applyChampionStatusChange(siegeId, championId, newStatus, source)` — Courtly outcomes can call this directly.

---

## §7 — Activity Catalog

### Attacker-side

| Activity | Tier | Cost | Category | Effect |
|---|---|---|---|---|
| Begin Siege | T2 | V30 + L20 + E10 | Violence | Establishes siege; layers from hex `structureActorIds` or GM override |
| Establish Siege Camp | T1 | V10 + L20 | Violence | Temporarily qualifies an adjacent owned-or-neutral hex as depot; lasts duration of siege (auto-cleared on resolution) |
| Escort Supply Line | T1 | V10 + L10 | Violence | +1 escort pip on a specific siege |
| Counter-Interdict | T1 | V10 + Int10 | Violence | Removes interdiction from specific path hex |
| Demand Surrender | T2 | D20 + V10 + SP10 | Diplomacy | Forces defender Anytime response: yield (won_surrender), parley (defender Buffer-credit +10), refuse (defender −1 morale) |
| Champion Withdraws | T2 | SP15 + D10 | Soft Power | Marks a champion `absent` (story-driven mechanical lever) |
| Champion Returns | T1 | D20 + SP10 | Diplomacy | Restores an `absent` champion to `active` |
| Storm Final Assault | T3 | V40 + L20 | Violence | Aggressive convene: doubles maneuver budget for one Breach Scene; Buffer −30 regardless of outcome |
| **Trojan Horse** | **T4** | **Int40 + D20 + SP20** | **Intrigue** | **3-roll gate: sneak (Int vs def Suspicion) + sabotage (Faith or Diplomacy) + breach (Violence). All succeed → final layer breaches automatically (`won_trojan_horse`). Any fail → −50% attacker forces, Buffer −40, morale −2. ***Sinon Mode (optional force multiplier):*** *commit one `active` attacker Champion as sacrifice at activity-resolution. Their status becomes `dead` immediately + narrativeBeat `"[Champion] enters the gates"` + championDeath cascade fires AS-IF the activity succeeded. In exchange, each of the 3 rolls gets +5, OR (player choice) auto-success on one roll of the player's choice. Mythic gravity — the sacrificed Champion's name is forever attached to the outcome in the War Log.* |

### Defender-side

| Activity | Tier | Cost | Category | Effect |
|---|---|---|---|---|
| Reinforce Garrison | T1 | V15 + L10 | Violence | +1 Anytime budget per round AND +1 Renewal pool |
| Sortie | T1 | V20 | Violence | Adjacent attacker supply hex: remove Supply Line + Buffer −15. Risk: defender 1d4 casualty |
| Call Relief | T2 | D20 + SP20 | Diplomacy | Requires allied faction. Pushes a wave onto `reliefWaves[]` |
| Interdict Supply Line | T1 | Int15 + V10 | Intrigue | Same effect as attacker-side; defender or third party |
| Sue for Terms | T2 | D20 + SP15 | Diplomacy | Negotiated outcome: attacker can accept (`won_sack`) or refuse |
| Champion Defends Wall | T1 | V10 | Violence | Specific defender champion locks to active for 2 turns, +1 Anytime budget |
| Pray for Omen | T1 | F10 | Faith | Re-roll next Event Deck event in defender's favor |

### Cross-faction / Third-party

| Activity | Tier | Cost | Effect |
|---|---|---|---|
| Interdict Supply Line | T1 | Int15 + V10 | Any faction can fire on any active siege |
| Send Relief Force | T2 | V25 + L15 | Requires diplomatic alignment with defender |
| Arms Trade | T2 | E20 + SP10 | Transfer OP to either besieger or besieged (sets faction relationship +/−) |

---

## §8 — Outcomes, Champion Death Cascade, Improvement Ledger

### Outcome matrix

| Outcome | Trigger | Hex write-back | Faction write-back | Ledger entry kind |
|---|---|---|---|---|
| `won_storm` | All layers breached via damage | ownerFactionId → attacker; modifiers: ["Sacked"] +30d. **Holdings handling per-Structure-recipe `onStormHandling` (see Per-Recipe Holdings Handling below)** | attacker +territory bonus; defender −1 morale ×3; Buffer remainder forfeit | `siege_storm` |
| `won_sack` | Attacker accepts Sue for Terms | ownerFactionId stays; modifiers: ["Sacked"] +30d | attacker steals 50% defender stockpile; Buffer remainder refunded | `siege_sack` |
| `won_surrender` | Defender accepts Demand Surrender | ownerFactionId → attacker; holdings preserved (defender retains units, withdraws) | attacker +territory bonus; defender no morale hit (bloodless); Buffer 50% refunded | `siege_surrender` |
| `won_trojan_horse` | Trojan Horse all rolls succeed | as `won_storm` BUT defender holdings preserved 50%; modifiers: ["Sacked", "Treachery"] | attacker +territory bonus; defender −2 morale (humiliation); Buffer 25% refunded | `siege_trojan_horse` |
| `lost_hold` | Buffer hits 0 (no crisis) OR attacker plans Withdraw | no change | attacker −1 morale; defender +1 morale; defender stockpile −15 (war cost) | `siege_hold` |
| `lost_supply_crisis` | Buffer hits 0 with grace expired + no recovery | no change | attacker −2 morale + 1d4 holdings lost (forced retreat casualties) | `siege_supply_crisis` |
| `lost_pyrrhic` | `won_storm` BUT attacker losses > 50% | as Storm BUT attacker −1 morale; holdings transfer halved | as Storm + casualty penalty | `siege_pyrrhic` |
| `lost_relieved` | Relief Force defeats attacker army | no change | attacker −2 morale; relieving faction +1 morale + relationship boost | `siege_relieved` |
| `abandoned` | GM/attacker withdraws before resolution | no change | attacker −1 morale (no other penalties) | `siege_abandoned` |

In all cases:
1. Clear `hex.flags.bbttcc-territory.siege`
2. Remove from `faction.flags.bbttcc-factions.activeSieges` / `defendingSieges`
3. Append improvement ledger entry with full `narrativeBeats[]` payload
4. **Push siege saga entry to existing War Log** (`flags.bbttcc-factions.warLogs`) — type `"siege_resolved"`, full narrativeBeats[] retold, both factions get the entry (attacker as `role: "attacker"`, defender as `role: "defender"`)
5. Broadcast outcome chat card with cinematic VFX + summary

### Per-Recipe Holdings Handling on Storm

Each Structure recipe can declare how its surrounding Holdings (Rigs/Bosses/Facilities stationed at the hex) are treated when that Structure layer is razed via Storm. Schema addition to Structure recipe JSON (extend `bbttcc-structures/structure-recipes.json` in Phase D):

```javascript
{
  // ... existing recipe fields ...
  onStormHandling: {
    rigsBosses: "destroyed" | "captured" | "released" | "scattered",
    facilities: "destroyed" | "looted" | "intact",
    contextOverrides: {
      // optional GM toggle at siege-start can override
      // e.g., "sack" intent → looted; "raze" intent → destroyed
    }
  }
}
```

Recipe defaults:
| Recipe | Rigs/Bosses | Facilities | Rationale |
|---|---|---|---|
| Sept Wall | scattered | destroyed | The wall fell, things inside crushed/fled |
| Bunker Gate | destroyed | looted | Strongpoint razed; loot the armory |
| Watchtower | scattered | intact | Garrison fled but the outpost survives |
| Glyph-Ward Pylon | destroyed | destroyed | Magical resonance shatters everything |
| Sept Bridge | scattered | intact | The bridge fell; outpost on the far side still there |

Per-siege GM override at siege-start: `"intent": "sack" | "raze" | "capture"` modulates the per-recipe defaults across the board.

### Champion Death Cascade

When a Champion's status transitions to `dead` (Breach Scene, Duel, Event):

```javascript
on championDeath(siegeId, championId, side):
  1. siege.{side}Champions[id].status = "dead"
  2. Append narrativeBeat: { kind: "champion_falls", title: `${name} falls`, actorId }
  3. If side === "attacker":
       Buffer.violence -= 20
       attackerFaction.morale -= 2
       eachOtherAttackerChampion.status: 30% chance → "absent" (grief)
  4. If side === "defender":
       defenderFaction.morale -= 2
       eachOtherDefenderChampion.status: 30% chance → "active" if absent (rallying)
       Next turn: layer threshold weakened 10% (the wall mourns)
  5. Broadcast championFalls socket event (VFX + chat card)
  6. Hook bbttcc:siege:championDeath fires for downstream subscribers
```

The cascade is what makes Patroclus's death matter. Achilles (attacker champion, `absent`) has a 30% chance to flip to `active` (or a story trigger forces it). The defender wall threshold weakens (Hector at risk). Next round, the attacker is HUNTING. This is emergent narrative from mechanical primitives.

### Improvement ledger as epic spine

Every siege contributes to the hex's `improvements[]` ledger. The ledger entry for `siege_storm` includes the full `narrativeBeats[]` array, which the system can retell as:

```
Improvement: Siege of Troy [TURN 287]
- Siege declared by Achaean Coalition
- Champion Withdraws: Achilles (attacker camp politics)
- Plague event T2: Buffer −10
- Champion Duel: Hector vs Patroclus → Patroclus falls
- Champion Returns: Achilles (vengeance trigger)
- Champion Duel: Achilles vs Hector → Hector falls
- Layer breached: Outer Wall (damage)
- Trojan Horse: success
- Storm outcome: Troy razed
```

This is recoverable, retellable, narratively rich history. Future sieges or sequels can REFERENCE these beats.

---

## §9 — Siege Event Deck

### Concept

Each turn, the strategic tick rolls **2d10** (Fourth Thing system default) against the active Event Deck's threshold. If hit, an event is drawn and applied. Events have weights and conditions (e.g., naval-only, attacker-only).

2d10 ≥ 14 = ~28% per turn (closest natural 2d10 cut to the desired ~25% target). Bell-curve distribution means events cluster around the middle of campaigns rather than feeling truly random.

### Schema

`bbttcc-raid/data/siege-events.json` (new file):

```javascript
{
  decks: {
    generic: {
      roll: "2d10",
      threshold: 14,                        // 2d10 ≥ 14 = event fires (~28%, ≈ desired 25%)
      events: [
        { id, name, weight, conditions, effects, narrativeText }
      ]
    },
    naval: { ... },
    desert: { ... },
    sacred: { ... }
  }
}
```

### Starter event roster (Phase F authoring)

| Event | Conditions | Effect | Narrative |
|---|---|---|---|
| Plague | duration ≥ 3 turns | Both sides Buffer −10 next turn; random champion → wounded | "A sickness sweeps the camps" |
| Good Omen | none | Random side morale +1; +2 Anytime budget next round | "Birds favor the [side]" |
| Bad Omen | none | Random side morale −1; −1 Anytime budget next round | "The augurs spoke ill" |
| Defection | duration ≥ 5 turns | Random Holding rig/boss switches sides | "Discontent breeds desertion" |
| Sacred Day | none | No maneuvers this round (truce); both sides recover 1 wounded champion | "The festival of [god] is observed" |
| Funeral Games | recent championDeath | Both sides morale +1; improvement ledger beat; no other effect | "Games are held in honor of the fallen" |
| Storm at Sea | naval supply + sea adjacency | Attacker Buffer −15; ships scattered (supplyStatus → severed for 1 turn) | "The sea god is angered" |
| Reinforcements Arrive | none | Random side Buffer +20 (random OP type) | "A column arrives bearing supplies" |
| Champion Wounded | active champions ≥ 2 | Random champion → wounded (illness, mishap) | "Misfortune strikes [name]" |
| Prophet's Visitation | duration ≥ 4 | GM choice: attacker or defender +1 morale, other −1 | "An oracle delivers an unwelcome word" |
| Divine Plague (legendary, rare) | weight 1, duration ≥ 6 | Attacker Buffer −40; 1d4 attacker champions → wounded; defender +2 morale | "A god strikes the army with arrows" |

### Per-deck override

Begin Siege handler picks the deck:
- Terrain `sea` / `coast` → `naval`
- Terrain `desert` → `desert`
- Modifiers includes `Sacred` / `Holy Site` → `sacred`
- Else → `generic`

GM can override at Begin Siege time.

### Event firing relay

Each event fires socket `siegeEvent` so all clients see the same flavor in chat + HUD.

---

## §10 — Multiplayer Relay

Pattern mirrors Courtly S.2 Phase F (`module.bbttcc-raid` socket; `"socket": true` in module.json, already set).

Three new socket message types:

| Type | Payload | Receiver action |
|---|---|---|
| `siegeStateUpdate` | `{ siegeId, partial }` | Refresh HUD (Buffer, layer, status) |
| `siegeVfx` | `{ siegeId, fxKind, target, ... }` | Play Catastrophic Entry / Shockwave / Bombard / Champion Falls / Storm-at-Sea VFX |
| `siegeSceneSwap` | `{ siegeId, fromSceneId, toSceneId, layerIdx }` | Players follow GM to new layer scene |
| `siegeEvent` | `{ siegeId, eventId, narrativeText }` | Chat card + HUD ticker |
| `championStatus` | `{ siegeId, side, championId, status, reason }` | HUD roster update |

### Player Siege HUD

Read-only mirror of GM HUD:
- Current layer + breach % (from `applyStructureDamage` derived state)
- Buffer remaining (color-coded: green > 50%, yellow 25–50%, red < 25%)
- Supply status (supplied / harassed / severed + grace clock)
- Champion roster (both sides, status pips)
- Threat alerts (interdiction at hex X, relief in N turns)
- Last 3 narrativeBeats

---

## §11 — Phasing Plan

### Phase A — Siege state schema + Begin Siege + planner integration
- Author `Begin Siege [T2]` + `Establish Siege Camp [T1]` in catalog
- Planner UI: size dial, depot picker, layer override editor
- Stamp `hex.flags.bbttcc-territory.siege` on resolution
- API: `game.bbttcc.api.siege.{ begin, getState, list, applyChampionStatusChange }` (installed at both script-load and `Hooks.once("ready")` per existing API pattern)
- New file: `bbttcc-raid/scripts/siege-state.js`, `siege-throughput.js`
- **LOC est: ~450**

### Phase B — Strategic tick + Supply Buffer + Conditions Matrix + Naval BFS
- `siegeTurnTick()` per `bbttcc:advanceTurn:end`
- Conditions matrix calc + Buffer drain
- Supply BFS (land + naval) + grace clock
- Bulwark Siege Cost flag consumption
- New file: `bbttcc-raid/scripts/siege-tick.js`, `siege-supply-bfs.js`
- **LOC est: ~500**

### Phase C — Threat vectors (Interdict / Escort / Counter-Interdict / Sortie) — ✅ SHIPPED 2026-05-23
- 4 new activities + handlers → `scripts/siege-threat-vectors.js` (dual-registered ST + EFFECTS, mirrors begin_siege)
- Interdiction state on siege: persistent `interdictedHexIds[]` + per-turn `interdictionsThisTurn`/`escortPipsThisTurn` pulse counters; `sortieCasualtiesTotal` tally. Buffer shave via shared `shaveBuffer()` round-robin (siege-state.js).
- Path-hex modifier strip + restore via `turn.pending.repairs.removeModifiers`/`addModifiers` (territory `resolution-engine.js` honored; strip/restore each cancel a queued opposite on the same hex+turn).
- Tick consumer (siege-tick.js step 0 + reset): escort pips net against interdiction pulses each tick, then both pulse counters reset; persistent severance stays via stripped Supply Line + `interdictedHexIds`.
- Sortie defender-side flow: sever + Buffer −15 + 1d4 casualties (+2 if escort-protected). **Garrison roster write-back deferred to Phase E** (Phase C records casualty count on `sortieCasualtiesTotal` + war log).
- Role guards: attacker can't interdict/sortie own siege; escort/counter restricted to attacker-side. New hooks: `bbttcc:siege:interdicted`/`escortPosted`/`counterInterdicted`/`sortie`.
- Selftest: `tools/siege-phase-c-selftest.macro.js` (8 sections — API surface · registries · catalog · schema · shaveBuffer math · findSiegesUsingHex · netting formula · interdict↔counter round-trip).
- **Catalog**: 4 entries appended to `data/bbttcc_activities_v1_4.json` (now 46 total). All T1, flagged `siegeThreatVector`.
- **LOC est: ~350** (delivered ~440 across siege-threat-vectors.js + siege-state.js + siege-tick.js + selftest)

#### Phase C deferred sub-features
- **Garrison casualty write-back** — sortie records count only; physical holding removal is Phase E (defender activities + roster semantics).
- **Hex-granular escort protection** — escort pips are siege-level; the sortie penalty checks `escortPipsThisTurn > 0` on the siege rather than per-hex. Per-hex escort tracking deferred.
- **Planner hints for threat vectors** — they use the standard hex picker; no dedicated picker UI (which path hex feeds which siege) yet. Phase D/A.6 candidate.

### Phase D — Tactical Convene Breach Scene + Champion Duel maneuver
Sub-phased D.1→D.4 (mirrors Courtly S.2 cadence).

**D.1 — Siege HUD + Convene spine — ✅ SHIPPED 2026-05-23** (`scripts/siege-hud.js`, ~230 LOC)
- On-canvas Siege HUD mirroring `raid-courtly.hud.js` plumbing (DOM panel on `document.body`, innerHTML `_swapPanel`-style update + `_ftMakeHudDraggable` storageKey `siege:hud:panel`). Data source = live `game.bbttcc.api.siege.list()` — no open console needed; surfaces whenever ≥1 active siege. Renders per siege: name · size · Buffer bar (total/start) · supply-status chip (supplied/harassed/severed colour) · interdiction + relief chips · layers strip (current ◄ bronze-highlit, breached ✗ strikethrough) · auto-suggest pip (scaffold; lit by `state._suggestConvene`, which D.2 Bombard accrual will toggle).
- `convene(hexUuid)` (GM): views current layer's bound `sceneId` if set + broadcasts `siegeSceneSwap` socket so players follow → opens raid console w/ `{factionId, siegeId, layerIdx}` context → appends `convene` narrativeBeat → fires `bbttcc:siege:convene` + relays via `siegeHook` socket. Exposed at `game.bbttcc.api.siege.convene` / `.refreshHud`.
- Socket dispatcher (`module.raid-console.js`): new `siegeSceneSwap` branch (non-GM `scene.view()`) + `siegeHook` branch (re-fire `bbttcc:siege:*` locally for HUD/VFX). Mirrors `infilHook`/`courtlyHook`.
- Debounced `_renderAll` on canvasReady + `bbttcc:siege:{begin,ticked,convene,interdicted,counterInterdicted,sortie,layerBreached}`.
- Selftest `tools/siege-phase-d-selftest.macro.js` (6 sections). Module loaded after `siege-planner-enhancer.js`.
- **D.1 deferred**: layer→scene binding editor is the planner Phase A.6 item (convene falls back to console-only when a layer has no `sceneId`); player-side siege filtering (currently all clients see all active sieges read-only).

**D.2 — Layer transition engine — ✅ SHIPPED 2026-05-23** (`scripts/siege-layer-transition.js`, ~165 LOC)
- Subscribes `bbttcc:structure:stateChanged` (payload `{actor, fromState, toState, ctx}` from bbttcc-structures `damage-path.js:436`). GM-only (siege state on shared hex docs; damage applied GM-side via canonical apply-damage path). Matches the changed structure actor to the **current** layer of each active siege.
- `layerBreaches(layer, actor, toState)` predicate (exposed on API): **razed** → `toState==="razed"` (load-bearing locks at "breached" until sephirotic is chipped, then flips and reaches razed — universal terminal trigger, no special-case); **threshold** → `plates.current/plates.max ≤ thresholdPct` (plates at `actor.flags["bbttcc-structures"].plates.{current,max}`; misconfig→razed fallback; max≤0→false); **stockpile** → `layer.stockpileCurrent ≤ 0`.
- On breach: mark `breached/breachedAtTurn/breachedBy="damage"` + `layer_breached` beat + advance `currentLayerIdx`. Final layer → `status="won_storm"` + `endedTurn` + `siege_storm` beat + `bbttcc:siege:outcome` hook (**full §8 write-back = Phase F**). Non-final → scene-swap to next layer's `sceneId` + set `state._suggestConvene=true` (lights the HUD pip). Always fires `bbttcc:siege:layerBreached` + `siegeHook` relay (D.3 VFX subscribes).
- `convene()` (D.1) now clears `_suggestConvene` when the GM acts on the pip.
- Debug API: `siege.breachCurrentLayer(hexUuid)` (force-breach) + `siege.layerBreaches(...)` (pure predicate). Selftest extended (sections 7–8, 13 assertions total). module.json: after siege-tick.js.
**D.3 — Catastrophic Entry VFX — ✅ SHIPPED 2026-05-23** (`scripts/siege-vfx.js`, ~190 LOC)
- Mirrors `raid-courtly.vfx.js` (one-time `ft-siege-vfx-styles` injection, `_banner`/`_fullScreenFlash`/`_pulse`/`_shakeBoard`). Subscribes on every client to the three socket-relayed beats: `bbttcc:siege:layerBreached` (Catastrophic Entry — red full-screen flash + board shake + "{layer} Breached" banner + HUD pulse), `bbttcc:siege:convene` (amber "Breach Scene — Layer N" banner), `bbttcc:siege:outcome` (per-§8-status palette banner + conditional flash/shake). No double-fire: GM fires locally, remotes get the `siegeHook` relay.
- Outcome palette covers all 9 §8 statuses (won_storm red+flash+shake / won_sack amber / won_surrender green / won_trojan_horse violet+flash / lost_hold gray / lost_supply_crisis red+flash / lost_pyrrhic amber+flash / lost_relieved blue / abandoned gray).
- **Wired tick → VFX**: `siege-tick.js` now fires `bbttcc:siege:outcome` + `siegeHook` relay when a tick ends a siege (Buffer exhaustion), so supply-crisis/hold outcomes get banners too. **Also fixed a latent Phase B bug**: tick called `S.setState`/`S.list()` (public-API aliases) against the internals bridge, which only exposes `setSiegeState`/`listActiveSieges` — would `TypeError` on first live tick. Corrected.
- `siege.previewVfx(kind, payload)` debug helper. Selftest section 9 (16 assertions / 9 sections total).
**D.4 — Champion Duel — ✅ SHIPPED 2026-05-23** (`scripts/siege-champion-duel.js`, ~210 LOC)
- `game.bbttcc.api.siege.openChampionDuelDialog({hexUuid?|siegeId?})` — GM dialog: pick an **active** champion per side (from `siege.{attacker,defender}Champions`), resolve by 1d20-each roll (margin ≥ 10 = lethal) or declared winner, optional "lethal" toggle. Loser → `applyChampionStatusChange(...,"dead"|"wounded","champion_duel",side)`. Posts a chat card; appends `champion_duel` beat.
- On a kill, fires `bbttcc:siege:championDeath` (+ relay) — **the Champion Death Cascade subscribes here in Phase F** (grief/rally flips + next-layer threshold −10%, §8). Always fires `bbttcc:siege:championDuel` (+ relay).
- **`uiHandler` note**: the spec's `uiHandler` field is not a real dispatch in this build, so the duel is API + HUD-driven. Catalog entry `siege_champion_duel` registered in EFFECTS (kind maneuver, T1, cost `{anytime:2}`, raidTypes `["siege"]`) with `apply()` → opens the dialog if the console fires it.
- **Siege HUD** (D.1) extended: GM button row "⚔ Convene" + "Duel" (dimmed unless both sides have an active champion) + a champions summary line (`atk ⚔N ·✚ ·☠ / def …`). Re-renders on `championDuel`/`championStatus`/`championDeath`.
- **Siege VFX** (D.3) extended: `bbttcc:siege:championDuel` → "{winner} bests/slays {loser}" banner (+ red flash + shake on a kill).
- Selftest section 10 → **18 checks across 10 sections** total.

**Phase D COMPLETE 2026-05-23** (~975 LOC across D.1–D.4 + selftest). Remaining: Phase E (defender activities + champion roster authoring + Relief Force + Trojan Horse), Phase F (outcome write-back + Event Deck content + Champion Death Cascade + player HUD), Phase G (composability/Odyssey/naval).
- **LOC est: ~550** (delivered ~975 across the four sub-phases)

### Phase E — Defender counter-activities + Champions + Relief Force
Sub-phased E.1→E.4.

**E.1 — Counter-activities — ✅ SHIPPED 2026-05-23** (`scripts/siege-counter-activities.js`, ~310 LOC)
- 9 strategic activities, dual-registered (ST + EFFECTS) like the Phase C threat vectors; all target the besieged hex. Defender: `reinforce_garrison` (+1 Anytime, +1 Renewal), `call_relief` (push wave, arrives turn+2, fires `bbttcc:siege:reliefCalled`), `sue_for_terms` (records offer + `termsOffered` hook), `champion_defends_wall` (lock champion active 2 turns + `championLocks` + +1 Anytime), `pray_for_omen` (`omenReroll=true`). Attacker: `demand_surrender` (records ultimatum + `surrenderDemanded`), `champion_withdraws`/`champion_returns` (via `applyChampionStatusChange`, note `{championId}` or first-eligible), `storm_final_assault` (`stormAssault={budgetMult:2}` + Buffer −30 + lights convene pip).
- Resolver API completes the negotiated loops → fires `bbttcc:siege:outcome` (D.3 VFX has the palette): `siege.resolveTerms(hexUuid,{accept})` → `won_sack`; `siege.resolveSurrender(hexUuid,{response:"yield"|"parley"|"refuse"})` → `won_surrender` / Buffer +10 / morale note.
- Schema: `defenderAnytimeBudget`, `renewalPool`, `championLocks{}`, `omenReroll`, `stormAssault`, `pendingTerms` added to `makeSiegeState`. Catalog: 9 entries (46→55). Selftest `tools/siege-phase-e-selftest.macro.js` (9 checks).
- **E.1 deferred refinements**: full interactive attacker-prompt for terms/surrender (currently API-resolved); distance-modulated relief `arrivesTurn`; champion-picker UI in planner (note JSON for now).

**E.2 — Champion authoring + state machine — ✅ SHIPPED 2026-05-23** (`scripts/siege-champions.js`, ~210 LOC)
- `openChampionRosterDialog(factionId)` — multi-select roster editor writing `faction.flags.bbttcc-factions.championRoster`, with "✨ Auto-suggest top 5" (rank = boss tier×5 / rig tier×4 / PC `system.details.level`; affiliated-first via `system.identity.factionOwnerId`/faction flags). Surfaced as a "⚔ Champions (N)" button on the faction sheet (`renderBBTTCCFactionSheet` hook). **This is what makes D.4 duels + all champion levers playable without hand-editing flags.**
- `processChampionsTurn(state, turn)` — status machine: expire `championLocks` (Champion Defends Wall), roll wounded→active recovery (50%/turn; locked champions skip). **Folded into `siege-tick.js`** before persist → single writer per siege/turn, no race with the supply tick.
- `computeDefenderBudget(hexUuid)` — Anytime budget = holdings (rig×1 + boss×2 + facility×0.5) + active champions×2 + wounded×1 + `defenderAnytimeBudget`. Exposed on API (console integration of the budget is a refinement).
- Selftest extended (section 7 → 14 checks): module · API · `processChampionsTurn` lock-expiry + locked-wounded-skip (deterministic) · `championCandidates` ranking. module.json: after siege-champion-duel.js.

**E.3 — Relief Force scene — ✅ SHIPPED 2026-05-23** (`scripts/siege-relief.js`, ~290 LOC)
- `siege-tick.js` step 7 now MARKS the arriving wave (`wave.arrived=true`) on the state it's about to persist (single-writer-safe — not from a hook subscriber), lights `state._suggestReliefConvene`, and relays `bbttcc:siege:reliefArrives` for VFX. Arrival guard is `arrivesTurn <= turn` so a missed tick can't strand a wave.
- `siege.conveneRelief({hexUuid, waveId?})` — GM gesture (Siege HUD "🛡 Relieve" button): open-field scene swap (`wave.sceneId`/`state.reliefSceneId`, console-only fallback) + `openConsole` with relief context + `bbttcc:siege:reliefConvene` (+relay) + resolution dialog. Mirrors the breach `convene()`.
- Resolution dialog (mirrors the duel): roll (besiegers 1d20 vs relief 1d20, besiegers hold ties) / declared hold / declared break-through. `siege.resolveRelief({hexUuid, waveId?, outcome})` applies it:
  - **attacker_won** → wave `resolved`+`outcome`; Buffer −15 (`shaveBuffer`); defender −1 morale via new `recordMoraleDelta` → `pendingMoraleDeltas[]` (drained by Phase F — relief-won has no terminal outcome hook to carry it); `bbttcc:siege:reliefRepulsed` (+relay); siege grinds on. `_suggestReliefConvene` re-points to the next arrived wave.
  - **attacker_lost** → `status:"lost_relieved"` + `endedTurn`; `bbttcc:siege:outcome` (+relay; D.3 VFX palette already covers it). §8 morale (attacker −2 / relieving +1 / relationship) is **Phase F's** outcome write-back — NOT double-recorded here.
- Schema: `pendingMoraleDeltas[]` added to `makeSiegeState`; `recordMoraleDelta(state,{factionId,delta,reason,turn})` helper exposed on API + internals. HUD: arrived-wave chip glows ("relief here ×N") + GM "🛡 Relieve" button (lit on arrival). VFX: `reliefArrives`/`reliefConvene`/`reliefRepulsed` BLUE/BRONZE banners + previewVfx kinds. module.json: after siege-champions.js. Selftest extended (section 8 → 20 checks).
- **E.3 deferred**: relief-scene `sceneId` binding editor (planner Phase A.6; console-only fallback now); champion participation in the field battle (binary 1d20 now); distance-modulated `arrivesTurn` (still turn+2, shared with E.1).

**E.4 — Trojan Horse T4 + Sinon Mode — ✅ SHIPPED 2026-05-23** (`scripts/siege-trojan-horse.js`, ~280 LOC) — **Phase E COMPLETE**
- `siege.openTrojanHorseDialog({hexUuid?})` GM dialog (HUD "🐴 Trojan" button + catalog `apply()` + `STRATEGIC_THROUGHPUT.trojan_horse`). 3-roll gate, each 1d20 vs a GM-editable DC: **sneak** (default DC = 10 + active defender champions = the watching "Suspicion"), **sabotage** (Faith/Diplomacy flavor pick, DC 12), **breach** (Violence, DC 12).
- **ALL pass** → every unbreached layer marked `breached`+`breachedBy:"trojan_horse"`, `currentLayerIdx`→last, `status:"won_trojan_horse"`+`endedTurn`; fires `bbttcc:siege:trojanHorse{success:true}` + `bbttcc:siege:outcome` (D.3 violet "Gates Open from Within" VFX already wired). **ANY fail** → `shaveBuffer(40)` then halve every remaining category (−50% forces) + attacker −2 morale (`recordMoraleDelta`→`pendingMoraleDeltas`, Phase F drains); fires `bbttcc:siege:trojanFailed` (new RED "Ruse is Undone" VFX); siege continues (next tick's Buffer-exhaustion check ends it if it hit 0).
- **Sinon Mode** (optional): commit an active attacker Champion → `applyChampionStatusChange(...,"dead",...)` + `bbttcc:siege:championDeath` (+relay; Phase F cascade subscribes) fire IMMEDIATELY (as-if success — the champion dies whether or not the ruse then works) + "[name] enters the gates" beat/violet banner. In exchange: **+5 to all three rolls**, OR **auto-success on one roll** of the player's choice. Champion-sacrifice ordering is FIRST (persists the death) so the outcome write re-reads fresh state.
- Catalog: `trojan_horse` T4 legendary Intrigue (Int40+D20+SP20) appended to `bbttcc_activities_v1_4.json` (55→56). VFX: `trojanHorse`/`trojanFailed` handlers + previewVfx kinds. HUD: GM "🐴 Trojan" button (row now `flex-wrap`). module.json after siege-relief.js. Selftest §9 (→27 checks). 6/6 node logic checks green (win/fail/sinon-all/sinon-auto + partial-fail).
- **E.4 deferred**: faction-OP modifiers on the 3 rolls (pure 1d20+DC now, mirrors duel/relief); reading a live Courtly `Suspicion` meter for the sneak DC (uses champion-count proxy now — composability is Phase G).
- **LOC est: ~600** (E.1 ≈ 310 + E.2 ≈ 210 + E.3 ≈ 290 + E.4 ≈ 280 delivered = ~1,090 across Phase E)

### Phase F — Outcomes write-back + Event Deck + Multiplayer Relay + VFX + War Log integration
Sub-phased F.1→F.4.

**F.1 — Outcome write-back engine — ✅ BUILT 2026-05-23** (`scripts/siege-outcome-writeback.js`, ~336 LOC; pending F5 + in-game selftest, NOT yet synced)
- Subscribes `bbttcc:siege:outcome` (GM-only single writer; in-memory lock + "siege flag already cleared" idempotency). Runs the §8 9-row `MATRIX` (`game.bbttcc.api.siege.OUTCOME_MATRIX`): hex ownership→attacker + `["Sacked"]`/`["Sacked","Treachery"]` modifiers (add-turn recorded in `modifierHistory`; 30d auto-expiry deferred) + `recordHexImprovement` ledger entry.
- Faction writes: **drains `state.pendingMoraleDeltas[]`** (E.3 relief −1 / E.4 trojan −2) THEN matrix morale via `factions.bumpMorale`; Buffer refund % via `op.commit` (**OP→marks ×10**, `softPower`→`softpower` remap); `won_sack` steals 50% defender stockpile, `lost_hold` shaves −15 defender stockpile (best-effort across items).
- **Holdings (intent-driven inline)**: on a taken hex, `sack→capture` / `raze→destroy` / `capture→capture`; `byIntentHalf` (Trojan/Pyrrhic) preserves ⌈half⌉. **NON-destructive** — capture reassigns `system.identity.factionOwnerId`; destroy/scatter stamp `flags.bbttcc-raid.siegeFate` + drop from the hex `holdings` roster, actors NEVER deleted.
- `siege_resolved` War Log saga pushed to BOTH factions (role-tagged, full `narrativeBeats[]`) + end-of-siege chat card with the retold saga + clear hex siege flag + remove `activeSieges`/`defendingSieges` back-refs. Fires `bbttcc:siege:writtenBack`. Every external API call is guarded (degrades + console-warns if a sibling API is absent). Selftest `tools/siege-phase-f-selftest.macro.js`. 11/11 node logic checks green.
- **F.1 deferred**: "Sacked" 30d auto-expiry (permanent now); per-recipe `onStormHandling` schema (intent-driven inline instead); `lost_supply_crisis` `atkHoldingsLost: 1d4` is recorded in the matrix but not yet applied (no attacker-holdings-at-hex roster to draw from — revisit with holdings semantics).

**F.2 — Champion Death Cascade — ✅ BUILT 2026-05-23** (`scripts/siege-champion-cascade.js`, ~176 LOC; pending F5 + selftest, not yet synced)
- Subscribes `bbttcc:siege:championDeath` (GM-only; dedupe `siegeId:championId` + per-siege serialize lock). **Attacker** falls: Buffer.violence −20 (clamp 0), attacker morale −2 (immediate `factions.bumpMorale`), 30% each OTHER **absent** attacker champ → `active` (vengeance). **Defender** falls: defender morale −2, 30% each OTHER absent defender champ → `active` (rally), current layer `thresholdPct` +0.10 (clamp 0.95; skipped if razed-rule/null). Appends `champion_falls` beat; fires `bbttcc:siege:cascade` (+relay) → new VFX banner ("N Rally to the Banner" / "The Wall Mourns") + consequences chat card.
- **SPEC CONTRADICTION RESOLVED**: §8 pseudocode line 542 said attacker-death → others → `absent` (grief), but line 551 prose ("Achilles … flip to active") + the Patroclus→Achilles premise + memory all say RALLY (absent → active). Implemented **rally** for both sides. Morale is immediate (faction-level API), not `pendingMoraleDeltas` — the hit lands when the champion falls.
- **RACE FIX**: `Hooks.callAll` doesn't await async handlers, so the Trojan **Sinon** path was reordered to fire `championDeath` AFTER its outcome write (the Duel already fires it last) → the cascade is always the last siege-state writer. Selftest §7 (→10 checks). 13/13 node logic green.
**F.3 — Event Deck content + engine — ✅ SHIPPED + synced 2026-05-23** (`data/siege-events.json` + `scripts/siege-events.js` ~288 LOC; `b928954`)
- **`data/siege-events.json`**: 11 starter events (§9 roster) defined once in `events:{}` + referenced by id from 4 decks (`generic`/`naval`/`desert`/`sacred` — naval adds `storm_at_sea`, sacred adds `sacred_day`; avoids cross-deck duplication). Effect types: `buffer`/`defenderBudget`/`morale`/`moraleSwing`/`championWound`/`championRecover`/`supplySever`/`truce`/`defection`/`ledgerBeat`. Conditions: `minDuration`/`requiresNaval`/`requiresRecentChampionDeath`/`minActiveChampions`.
- **`siege-events.js`** `drawAndApplyEvent({state,hexUuid,hexDoc,turn,deckId,gateRoll})`: filters deck by conditions, weighted-picks (Divine Plague weight 1 vs ~10), honors `omenReroll` (draw two, keep the higher `_defenderFavor` heuristic, consume flag), applies effects, appends beat, pushes `eventsFired`, relays `bbttcc:siege:event`. **Separation of writes**: state-field effects mutate the `state` the TICK persists at step 9; external effects (morale `bumpMorale` / defection `actor.update` / ledger `recordHexImprovement`) written directly + guarded. MODEL NOTE: "Buffer" = attacker supply pool; `buffer` side `defender` routes to `defenderAnytimeBudget` (÷10).
- Tick step 8 rewritten: gate roll stays, fires the engine when ≥threshold (fallback beat if engine unloaded). VFX `event` amber ticker + HUD refresh + previewVfx. module.json: `siege-events.js` after `siege-tick.js`. Selftest §8 (5 checks → 17 total). 15/15 node logic green.
- **F.3 deferred**: a desert-specific event (desert deck = generic for now); `truce`/`eventTruceTurn` is an advisory flag (maneuver-gating enforcement not wired); `supplySever` is a 1-turn nudge (next tick's BFS recomputes).
**F.4 — Player Siege HUD + live relay — ✅ SHIPPED + synced 2026-05-23** (`cdb34ad`; edits to `siege-hud.js`/`siege-tick.js`/`siege-state.js`; 20/20 selftest in-game) — **PHASE F COMPLETE**
- The HUD already rendered read-only for non-GM clients; F.4 makes it a true live player mirror: **Buffer bar colour-banded** (green > 50% / amber 25–50% / red < 25%), **grace-clock** on a severed-supply chip (`grace N`), and a **last-3-`narrativeBeats` saga ticker** footer. (Layers strip, supply/interdiction/relief chips, champion strip already present.)
- **Live relays** (the gap): the strategic tick fired `bbttcc:siege:ticked` GM-only — F.4 relays a lightweight ping so player HUDs re-render every turn; `applyChampionStatusChange` now relays `bbttcc:siege:championStatus` so roster changes (wounded recovery, levers) reach players live. Combined with the already-relayed convene/breach/duel/relief/trojan/cascade/event hooks, players now see the whole siege evolve in real time.
- Selftest §9 (3 checks → **20 total**). 11/11 node logic checks (Buffer bands + grace clock).
- **End-of-siege chat card with retold narrativeBeats — ✅ done in F.1.**
- **War Log integration**: `siege_resolved` entries pushed to `flags.bbttcc-factions.warLogs` for both attacker and defender; existing War Log UI surfaces narrativeBeats[] as the persistent "Siege Saga" view (no new sheet/journal — just extends existing surface)
- **LOC est: ~550**

### Phase G — Composability + Odyssey-journey + advanced naval
- Cross-link API to Courtly Intrigue (camp politics composability)
- Courtly scenario as siege side-effect; champion status change wires
- Odyssey-style journey mode (crew attrition variant)
- Naval combat micro-resolution (Phase F is BFS-only; G is tactical naval)
- Suitor-massacre / Recognition scenario (Odyssey arc)
- **LOC est: ~500 (separate sign-off; may split further)**

**Total core (A-F)**: ~3,000 LOC across 6 phases. Mirrors Courtly S.2 cadence (~2,444 LOC) plus the Iliad-scale features.

---

## Red-line resolutions (SIGNED OFF 2026-05-22)

1. **Size dial values** — `[LOCKED as proposed]` Skirmish 8 / Standard 5 / Protracted 3 / Epic 2 OP base drain per turn. Target turns ~3/6/12/20. First-pass values; will tune during Phase B playtest.

2. **Depot grace period** — `[LOCKED — expanded]` Full Terrain Modifier Table now in §3 covering radiated (0) / mountain / badlands / canyon / volcanic (1) / swamp / tundra (1) / desert / jungle (1) / forest / coast / hills / plains (2) / road-network (+1 stacking modifier) / sea (1, naval) / sacred (modifier, +0). GM can override per-siege.

3. **Buffer commitment shape** — `[LOCKED]` Open: GM/player picks OP-mix ratio with system-suggested defaults at siege-start dialog.

4. **Storm outcome holdings handling** — `[LOCKED]` Per-Structure-recipe `onStormHandling` field. Each of the 5 starter recipes ships with a sensible default (Sept Wall scattered/destroyed, Watchtower scattered/intact, etc.). GM can override per-siege with `intent: sack | raze | capture` master switch. Schema sketched in §8.

5. **Sue for Terms attacker veto** — `[LOCKED]` Defender plays the activity; attacker is prompted at next-turn resolution; accepts/refuses without spending a slot.

6. **Champion roster authoring** — `[LOCKED]` Manual GM flag `faction.flags.bbttcc-factions.championRoster: String[]` with an auto-suggest button (proposes top-N PCs/Bosses by tier/level).

7. **Event Deck threshold** — `[LOCKED]` **2d10 ≥ 14** (Fourth Thing system default die). ~28% per turn, closest natural 2d10 cut to the desired ~25%. Bell-curve distribution means events cluster mid-campaign rather than feeling random.

8. **Trojan Horse T4 cost** — `[LOCKED]` Base cost Int40 + D20 + SP20 stands. **Sinon Mode added as optional force multiplier**: commit one `active` attacker Champion at resolution → status `dead` immediately + championDeath cascade fires + each of 3 rolls gets +5 (or player choice of auto-success on one roll). Mythic gravity; sacrificed Champion's name binds to the outcome in the War Log forever.

9. **Naval supply Phase B scope** — `[LOCKED]` Phase B implements only Beached Camp depots + simple BFS. Full naval BFS (port hexes + ship-capable factions + naval combat) deferred to Phase G.

10. **Improvement ledger retelling UI** — `[LOCKED]` `siege_resolved` entries pushed to existing War Log (`flags.bbttcc-factions.warLogs`) for both factions. The existing War Log UI is the persistent Siege Saga view — no new sheet/journal authored. Phase F deliverable.

---

## Out of scope (deferred)

- **Pure Odyssey journey mode** (crew attrition over a voyage with no fixed siege target) — separate sprint
- **Player-character-driven Sortie raids** (PC-led commando ops during a siege as a sub-mini-scenario) — Phase H
- **Multi-attacker coordinated sieges** (two factions besieging same hex from different depots) — Phase H
- **Persistent siege scars on conquered hexes** with derived gameplay effect — ledger captures it; gameplay effect is Phase H
- **Procedural Trojan Horse variant generation** — single hardcoded multi-roll flow in Phase E
- **Cinematic camera fly-through during scene-swap** — basic swap in Phase D; camera language polish later

---

*End of spec. Ready for red-line.*

# Rig / Boss Schema — Phase 0 Canon
*Locked: 2026-05-07. Source of truth for the Rig + Boss + Facility modernization sprint.*

---

## 0. Top-line decisions (locked)

| Decision | Resolution |
|---|---|
| Rig identity | Crew-piloted vehicle/mech with own actor type, deployable token |
| Facilities | **Unified with Rigs** under a single `rig` actor type via `mobility` axis |
| Bosses | Separate `boss` actor type — adversarial, phase-laddered, Surge-banking |
| Sheets | AppV2, native to `systems/fourththing/` |
| Gear catalog | Real items in `bbttcc-master-content` w/ AE pipeline; cross-compatible across mobility states |
| Mobile output rule | 100% output when parked, **50% when deployed**, 0% when destroyed |
| Crew action economy | **Each steward uses own pool** — boarded stewards spend their own action/bonus/reaction on rig roles |
| Action authoring | **Frame-defined** — each `rig-frame` item declares which actions its roles can take |
| Crew capacity | `mobile`/`hybrid`: `crewMin ≥ 1` (pilot required); `stationary`: `crewMin = 0` (passive output legal) |
| Migration | One-time idempotent: `flags.bbttcc-factions.rigs[]` → Rig actors w/ `mobility: "mobile"` |
| Boss powers | All existing logic (powers/templates/registry/behaviors/doctrine) preserved & migrated |

---

## 1. Rig Actor Type (`fourththing.rig`)

The Rig is the unified entity for vehicles, mounts, mobile barges, stationary forges, garrisons, sail-skiffs, war rigs, and Mad Max / Jabba flavor installations. Mobility is an axis, not a type.

### `system.identity`
```
mobility:        "stationary" | "mobile" | "hybrid"   // default: "mobile"
state:           "parked" | "deployed" | "destroyed"  // current operational mode
factionOwnerId:  string | null                        // faction actor id
binding: {
  hexId:    string | null   // when parked at a hex
  sceneId:  string | null   // when deployed on a scene
  tokenId:  string | null
}
archetype:       string                               // e.g. "war-rig", "sail-barge", "drilling-rig", "garrison"
```

**State machine:**
```
stationary:  parked → destroyed
mobile:      parked ⇄ deployed → destroyed
hybrid:      parked ⇄ deployed → destroyed   // hybrid can do both freely
```

### `system.crew`
```
slots: [
  { role: "pilot" | "gunner" | "engineer" | "crew", actorId: string | null, label: string }
]
capacity: {                                  // frame-defined; sheet may surface as editable max
  pilot:    { min: number, max: number }
  gunner:   { min: 0,      max: number }
  engineer: { min: 0,      max: number }
  crew:     { min: 0,      max: number }
}
crewMin:   number   // sum of role mins; mobile/hybrid ≥ 1; stationary = 0
crewMax:   number   // sum of role maxes
```

**Capacity rules:**
- `mobile` / `hybrid`: `pilot.min = 1` (auto-parks if pilot disembarks)
- `stationary`: `pilot.min = 0` (Bartertown windmill produces grain even when empty)
- All other role mins default to 0; gunners required only if a frame's weapons demand operators

Boarding flow:
1. Steward token → right-click → "Board Rig" (rig must be on same scene)
2. Steward gains `flags.fourththing.boardedRig = <rigId>`; rig pushes steward into a crew slot
3. Steward token hidden; rig token shows boarded count badge
4. While boarded, steward acts only at rig-scale (rig actions; route weapon attacks through `rig-weapon` items; defenses for incoming use rig stats)
5. Stewards spend **their own** action/bonus/reaction pool — a 4-crew rig does up to 4 things per round
6. Disembark restores steward token

### `system.actionsAvailable` (derived from frame)
```
pilot:    [actionId, ...]   // declared by frame.actions.pilot
gunner:   [actionId, ...]
engineer: [actionId, ...]
crew:     [actionId, ...]
```

Actions are registry entries (Section 3.5). Frames pick which actions each role can take — a Sail Barge might grant pilot `["tack-against-wind", "raise-sail", "steer", "evasive"]` instead of `["steer", "ram", "hold-position", "evasive"]`.

### `system.integrity`
```
value:    number   // current
max:      number   // derived: frameBaseIntegrity + (tier - 1) × tierStep
tier:     1..4
bracket:  "personal" | "light" | "medium" | "heavy" | "siege"
          // personal = speeder/bike/motorcycle (single pilot, minimal slots, fastest)
          // light    = scout/skiff (1-2 crew)
          // medium   = barge/hauler (4-8 crew, hybrid candidate)
          // heavy    = war rig/garrison (4-7 crew, multi-weapon)
          // siege    = forge/fortress (stationary infrastructure)
```

Rigs do **not** use `Body` for integrity (no attribute scores). Rig integrity formula is frame-defined:
```
max = frame.baseIntegrity + (tier - 1) × frame.tierStep
```

### `system.defenses`
Full reuse of `rfi-defense-engine`:
```
resist:      { fire: 0, kinetic: 0, ... }   // 7 RFI damage types
immune:      string[]
vulnerable:  string[]
flavor:      string[]
condImmune:  string[]
```

### `system.gear` (managed via embedded items)
Gear is embedded items with subtypes (Section 3). Slot caps come from the equipped frame:
```
frameSlots:    1   // always 1 frame
weaponSlots:   N   // frame-defined
systemSlots:   N   // frame-defined
outputSlots:   N   // frame-defined; 0 = pure combat platform
```

### `system.output`
```
modules:        [outputModuleItem ids]
basePerTurn:    { resource: amount, ... }   // sum of equipped output modules
effectivePerTurn: derived by state:
  parked    → basePerTurn × 1.0
  deployed  → basePerTurn × 0.5  (modules with `mobileLegal: false` produce 0)
  destroyed → 0
```

### `system.travel` (mobile/hybrid only)
```
speed:        number   // hexes per session/turn
range:        number   // max distance per session before refuel
hazardResist: number   // carries existing rig hazard-prevention logic
```

---

## 2. Boss Actor Type (`fourththing.boss`)

### `system.identity`
```
archetype:    string   // pulled from existing boss-templates.js registry
factionId:    string | null
portraitVariants: string[]   // per-phase portraits
```

### `system.phases`
```
ladder: [
  {
    label:               string                    // e.g. "Wounded", "Cornered", "Final"
    integrityThreshold:  number                    // % of max integrity that triggers entry
    onEnterEffects:      [aeData...]               // applied on phase entry
    manifestationGrants: [manifestationItemUuid]   // unlocked at this phase
    surgeBoost:          number                    // bonus Surge die on entry
  }
]
currentPhase:  number   // 0-indexed
```

### `system.integrity`, `system.defenses`
Same shape as Rig. Phase-specific overrides allowed via `phases.ladder[i].onEnterEffects`.

### `system.manifestations` (full RFI)
```
library:   [manifestationItemId]   // curated per archetype
surge:     { current: number, max: number, exploded: number }
momentum:  number                  // raid-tier resource (parallels faction Momentum)
```

### `system.doctrine`
```
slot:  itemId   // from existing boss doctrine registry
```

### `system.powers` (migrated from `boss-powers.js`)
```
powers:     [powerId]               // registry-loaded
cooldowns:  { [powerId]: rounds }
```

### `system.behaviors` (migrated from `boss-behaviors.*.enhancer.js`)
```
behaviors:    [behaviorId]
triggerState: cached recent triggers
```

### `system.raidStats`
Raid console reads from this same actor — single source of truth.
```
rounds:        number
morale:        number
infiltration:  number
alarm:         number
```

---

## 3. Gear / Upgrade Item Subtypes

All authored in `bbttcc-master-content` items pack. Subtype carried in `flags.fourththing.rigGear.subtype`.

| Subtype | Equips on | Slot | Purpose |
|---|---|---|---|
| `rig-frame` | Rig | `frameSlots` (1) | Defines bracket, integrity, slot counts, travel, mobility constraints |
| `rig-weapon` | Rig | `weaponSlots` | Combat module: damage type, base damage, manifestation grants |
| `rig-system` | Rig | `systemSlots` | Utility: sensors, shields, comms, repair bay |
| `output-module` | Rig | `outputSlots` | Resource/buff producer; declares `mobileLegal: bool` |
| `boss-augment` | Boss | (no slot — embedded) | Phase trigger AEs, manifestation grants, defense overrides |
| `boss-template` | (n/a — drag onto blank Boss) | (n/a) | Pre-built archetype config (e.g. Gloomgill) |
| `rig-template` | (n/a — drag onto blank Rig) | (n/a) | Pre-built rig config (war-rig, barge, garrison-fort) |

All gear items use the existing AE pipeline — drop on the actor sheet → AEs apply on equip.

**Cross-compatibility example**: A `Mounted Forge` output-module (`mobileLegal: true`) drops onto a stationary rig (= a forge facility) OR a mobile war-rig (= a war rig with a forge bay producing at 50% during deployment). Same item, same AEs, different deployment context.

### 3.5 Frame schema (load-bearing — frames define rig identity)

```js
flags.fourththing.rigGear = {
  subtype: "rig-frame",
  bracket: "light" | "medium" | "heavy" | "siege",
  baseIntegrity: number,
  tierStep: number,                       // integrity gained per tier above 1
  mobilityAllowed: ["stationary","mobile","hybrid"],   // frame may constrain
  slots: { weapon: N, system: N, output: N },
  travel: { speed: N, range: N },         // ignored if frame is stationary-only
  capacity: {
    pilot:    { min: 0|1, max: N },
    gunner:   { min: 0,   max: N },
    engineer: { min: 0,   max: N },
    crew:     { min: 0,   max: N }
  },
  actions: {
    pilot:    [actionId, ...],            // see Section 3.6
    gunner:   [actionId, ...],
    engineer: [actionId, ...],
    crew:     [actionId, ...]
  },
  visualFrame: "hex-bracket" | "open-corners" | "anchor-ring" | ...   // token frame style
}
```

### 3.6 Action registry

Base actions registered by `systems/fourththing` at startup. Frames pick from this set; modules can extend via `game.fourththing.rig.registerAction({ id, role, label, type, ... })`.

#### Pilot actions
| id | type | effect |
|---|---|---|
| `steer` | action | Move rig up to `frame.travel.speed` hexes/squares |
| `ram` | action | Charge into target; deals collision damage scaled to integrity bracket |
| `hold-position` | action | Steady the rig — gunners gain advantage on attacks until pilot's next turn |
| `evasive` | bonus | Disadvantage on attacks against rig until pilot's next turn |
| `swerve` | reaction | Avoid an incoming attack (skill check vs incoming roll) |
| `tack-against-wind` | action | Sail-frame variant: move + grant rig +reach against downwind targets |
| `raise-sail` / `lower-sail` | bonus | Toggle speed mode on sail frames |

#### Gunner actions
| id | type | effect |
|---|---|---|
| `fire-weapon` | action | Activate equipped `rig-weapon` item; routes through gunner's combat skill + weapon stats |
| `aimed-shot` | action + bonus | Spend both — increased damage / accuracy on next fire |
| `suppression` | action | Use weapon to impose a condition (per weapon's manifestation grant) |
| `reload` | bonus | Refresh weapon ammo or cooldown |
| `opportunity-fire` | reaction | Fire at enemy entering reach |

#### Engineer actions
| id | type | effect |
|---|---|---|
| `repair` | action | Tinkering check; restore rig integrity |
| `boost-system` | bonus | Temp buff to a `rig-system` item until end of round |
| `vent-heat` / `cycle-power` | bonus | Reset a cooldown on a weapon or system |
| `counter-sabotage` | reaction | Cancel a hostile boarding or sabotage attempt |

#### Crew actions
| id | type | effect |
|---|---|---|
| `operate-module` | action | Activate a specific `rig-system` or `output-module` |
| `reload` | bonus | Help a gunner refresh weapon |
| `brace` / `signal` | bonus | Soft buff (defense / coordination) |
| `hold-on` | reaction | Reduce damage to self when rig is hit |

---

## 4. Migration

### `flags.bbttcc-factions.rigs[]` → Rig actors

One-time idempotent migration on world load:
1. For each faction actor with non-empty `flags.bbttcc-factions.rigs[]`:
   - For each rig entry `r`:
     - Create new actor: `type: "rig"`, `mobility: "mobile"`, `factionOwnerId: faction.id`
     - Field map:
       - `r.name` → `actor.name`
       - `r.rigId` → `flags.fourththing.legacyRigId` (audit trail)
       - `r.type` → `system.identity.archetype`
       - `r.damageStep` → `system.integrity` via conversion table
       - existing travel bonuses → `system.travel.{speed,range,hazardResist}`
2. Stamp faction with `flags.bbttcc-factions.rigsMigrated: true`
3. Old `flags.bbttcc-factions.rigs[]` retained read-only as audit (not deleted) until v2 cleanup
4. Old `rig-config-app.hbs` becomes a thin redirect that opens the migrated Rig actor's sheet

### `mobile_facility_node.json` → hybrid-rig template
Reframed as a `rig-template` item with `mobility: "hybrid"`, dock-mode output module.

### `bbttcc-facility-console` → retired
Becomes a thin shim that filters Rig actor list to `mobility: "stationary"`. Module can stay installed for one cycle as a redirect.

---

## 5. Boss Logic Preservation

Every existing boss authoring affordance gets a home in the new Boss sheet:

| Existing file | New home |
|---|---|
| `boss-powers.js` (317 lines) | `game.fourththing.boss.powerRegistry`; surfaced in Boss sheet **Powers** tab |
| `boss-templates.js` (78 lines) | Authored as `boss-template` items in master-content |
| `bossRegistry.js` | Loaded into Boss sheet **GM Edit** tab |
| `bosses.gloomgill.js` | Ported as a `boss-template` item |
| `boss-doctrine.registry.enhancer.js` | Doctrine slot machinery on Boss sheet **Doctrine** tab |
| `boss-behaviors.*.enhancer.js` | Behavior registry hooks re-targeted at Boss actors |
| `boss-config-app.js` (1538 lines) | UI logic ports into Boss sheet's tabs; registry/non-UI logic moves to `game.fourththing.boss.*` helpers |

Goal: nothing the existing 1538-line config-app can do is lost. The Boss sheet's **GM Edit** tab is its successor.

---

## 6. RFI Integration

| RFI subsystem | Rig | Boss |
|---|---|---|
| Integrity formula | `frame.base + (tier - 1) × frame.tierStep` | `bracket × tier` (RFI standard, no Body) |
| Defense engine | Full reuse | Full reuse |
| 7-type damage canon | Yes | Yes |
| Surge banking | **No (v1)** | Yes |
| Manifestation library | No (v1) — gear-granted attacks only | Yes — full curated library |
| Tier (1–4) | Yes | Yes |
| Soma Break interaction | No (rigs don't sleep) | TBD per archetype |

---

## 7. Sheet Tab Layout

### Rig Sheet (AppV2, system-native)
1. **Identity** — name, mobility, state, faction owner, current binding (hex/scene), portrait
2. **Crew** — slots with steward links, board/disembark buttons
3. **Combat** — integrity bar, defense engine display, equipped weapons
4. **Gear** — frame slot, weapon slots, system slots, output module slots
5. **Output** *(visible iff `outputSlots > 0`)* — current effective yield, per-turn breakdown, dock toggle for hybrid
6. **Travel** *(visible iff `mobility !== "stationary"`)* — speed, range, hazard resist, recent travel log
7. **GM Edit** *(gated on `bbttcc-core.gmEditMode`)* — manual integrity, faction reassign, archetype change, migration audit

### Boss Sheet (AppV2, system-native)
1. **Identity** — name, archetype, faction, portrait
2. **Phase Ladder** — current phase, integrity thresholds, transition effects, surge boosts
3. **Combat** — integrity bar, defenses, surge bank, momentum
4. **Manifestations** — library + cast UI
5. **Doctrine** — doctrine slot picker
6. **Powers** — registry-loaded powers with cooldowns
7. **Behaviors** — registry-loaded behavior triggers
8. **Raid** — raid-console state (rounds, morale, infiltration, alarm)
9. **GM Edit** *(gated)* — phase-ladder editor, power picker, doctrine picker, archetype switcher (ports `boss-config-app.js`)

---

## 8. Visual Canon (extends existing hex-visual canon)

| Entity | Token frame | Phase indicator | Hex marker |
|---|---|---|---|
| Stationary Rig | Hex bracket (anchored corners) | Integrity bar bottom | Wrench icon TL |
| Mobile Rig | Hex bracket (open corners) | Integrity bar bottom | Wheel icon TL |
| Hybrid Rig | Hex bracket (mixed) | Integrity bar bottom | Anchor+Wheel icon TL |
| Boss | Phase-banded ring (color shifts per phase) | Phase ladder pip top | Skull icon TL |

---

## 9. Open Questions Deferred to Phase 1+

1. **Mobile rig combat reach** — does a deployed rig occupy 1 hex or N? *(Lean: 1 token, but reach + AoE scale with rig size brackets.)*
2. **Hybrid docking UI** — right-click hex → "Dock here", or sheet button? *(Lean: both — sheet for primary, hex for spatial.)*
3. **Boss + Soma Break** — do bosses get rest cycles, or only narrative-driven phase resets?
4. **Token textures per phase** — auto-swap on phase entry, or GM-manual?
5. **Faction Momentum ↔ Boss Momentum** — separate banks or shared faction-bound resource?
6. **Action HUD surfacing** — which crew actions appear on the player HUD vs only the rig sheet?

---

## 10. Sprint Phases (post-Phase 0)

| Phase | Deliverable |
|---|---|
| 1 | Add `rig` + `boss` to `fourththing/template.json`; skeleton AppV2 sheets |
| 2 | Full Rig sheet (Identity/Crew/Combat/Gear/Output/Travel/GM Edit) |
| 3 | Full Boss sheet + boss-config-app.js logic ported to GM Edit tab |
| 4 | Gear catalog: ~20 items each subtype in master-content |
| 5 | Crew piloting flow (board/disembark, attack/manifestation routing) |
| 6 | Migration: flags.rigs[] → Rig actors, idempotent on world load |
| 7 | Raid console bridge (reads from new Boss actors) |
| 8 | Token visual canon (frames, phase bands, hex markers) |
| 9 | Lightsail deploy: tar full subtree + md5-verified to both PM2 instances |

---

## 11. What this collapses / retires

- `bbttcc-facility-console` module — retired (or thin redirect shim for one cycle)
- `bbttcc-factions/scripts/module.js` rig-flag logic — retired post-migration
- `bbttcc-factions/templates/rig-config-app.hbs` — redirect to Rig sheet
- `bbttcc-raid/templates/boss-config-app.hbs` — redirect to Boss sheet
- `bbttcc-raid/scripts/boss/boss-config-app.js` — UI logic dispersed into Boss sheet tabs
- `mobile_facility_node.json` — reframed as `rig-template` item
- `flags.bbttcc-factions.rigs[]` — read-only audit data post-migration

What stays in modules:
- `bbttcc-raid/scripts/raid-*.js` — raid console + maneuvers (now reads from Boss actors)
- `bbttcc-raid/scripts/boss/*.js` registries — re-pointed at Boss actor type
- `bbttcc-territory/scripts/bbttcc-facility-turn-effects.enhancer.js` — re-pointed at stationary Rig actors
- `bbttcc-factions` — keeps faction sheet, just stops owning rig data

---
*End Phase 0 canon. Phase 1 begins on sign-off.*

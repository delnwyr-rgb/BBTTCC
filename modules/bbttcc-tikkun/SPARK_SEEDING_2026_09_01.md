# Sparks in the World — Phase 1 (2026-09-01)

Owner rulings 2026-09-01: sparks join the progression spine. The five region
scenes are the canonical 141-hex board; sparks anchor **in hexes**; an
**integrated** spark makes its hex count **aligned outright**; an integrated
spark on a faction-owned hex pays **+1 OP/turn** into its sephirah's channel.

## What shipped (Phase 1)

| Piece | Where |
|---|---|
| Canonical-board scoping (worldHealth counts 141, not 336) | `bbttcc-epic/scripts/repair.js` `boardScenes()` + `tools/mark-canonical-board.macro.js` |
| Spark hex anchor `flags.bbttcc-territory.spark {key, state, at}` | `bbttcc-tikkun/scripts/tikkun-hex.enhancer.js` |
| Integrated-spark alignment trump (ignores banner AND darkness) | `repair.js::isHexAligned` (top of predicate) |
| +1 OP/turn yield per integrated owned spark hex (marks, one `op.commit` per faction, GM-whispered report) | `tikkun-hex.enhancer.js` turn listener (gates `apply` + `isGM`) |
| GM verbs `game.bbttcc.api.tikkun.hex.{seat, unseat, integrate, at, all}` | same |
| Hooks `bbttcc:spark:hexSeated` / `bbttcc:spark:hexIntegrated` (epic listens: world-health refresh + the +2 Presence credit) | same + `repair.js` |
| Beat-editor fix: saving a beat no longer destroys `sparkKey`-form spark links | `bbttcc-campaign/apps/campaign-beat-editor.js` |
| DRY_RUN board seeding (the 30-spark placement below) | `bbttcc-tikkun/tools/seed-hex-sparks.macro.js` |

**Run order (GM):** mark-canonical-board → seed-hex-sparks with `DRY_RUN=true`
→ amend table → flip to false → run. Integration is deliberate: sparks seat
**dormant**; a spark only becomes a temple via
`game.bbttcc.api.tikkun.hex.integrate(hexUuid, {actorId})` (beats/arcs get
wired to this in Phase 2).

## Sephirah → OP channel (owner-tunable, `SEPHIRAH_CHANNEL` in the enhancer)

keter→faith · chokmah→culture · binah→logistics · chesed→softpower ·
gevurah→violence · tiferet→diplomacy · netzach→nonlethal · hod→intrigue ·
yesod→economy · malkuth→economy (foundation and kingdom both feed the pool
everything else flows through)

## ⚖️ RULING PENDING — the 30-spark placement draft

10 sephirot × 3 kinds (animate / conceptual / vestigial). The River Heart runs
heaviest (10) — it is the heart; redistribute freely. Amend the `PLACEMENTS`
table in the macro and this file together.

### The Drowned South (6)
| Spark | Hex | Why |
|---|---|---|
| binah **animate** | Blackwater Verge a | the deep mother-water, alive |
| gevurah **conceptual** | Evil Bad Fortress | severity as doctrine |
| gevurah **vestigial** | The Burnt Flats | wrath's ash |
| tiferet **animate** | The Singing Mire | harmony that sings back |
| netzach **conceptual** | Drowned Kudzu Reach f | growth even drowned |
| yesod **animate** | The Anchor Reach | the living anchor |

### The Iron Reaches (4)
| Spark | Hex | Why |
|---|---|---|
| keter **conceptual** | Inconvenient Mountains.k | the crown of the world, inconveniently high |
| hod **conceptual** | CanYAWN Amirite.d | the joke that is secretly a codebook |
| hod **vestigial** | Mount Excuse | eloquence decayed into excuses |
| malkuth **conceptual** | Inconvenient Mountains.b | matter at its most matter-of-fact |

### The Northern Marches (6)
| Spark | Hex | Why |
|---|---|---|
| keter **animate** | The Rotating Chapel | the chapel turns to face what it worships |
| chokmah **conceptual** | Probably Beaumont | the wiser guess |
| chokmah **vestigial** | Maybe Beaumont? | wisdom decayed to a shrug (the two Beaumonts disagree about which is real) |
| binah **vestigial** | Hexen Myre.c | structure sunk in bog |
| netzach **vestigial** | BarrenPlains.b | endurance ground barren |
| hod **animate** | Legansus Waystation | the living relay |

### The River Heart (10)
| Spark | Hex | Why |
|---|---|---|
| chokmah **animate** | The Polygonal Grove | geometry that grows |
| binah **conceptual** | Odaroloc Depths | understanding at depth |
| chesed **animate** | Lyrenn | the farm that feeds strangers |
| chesed **vestigial** | Bedlam Fancies | charity curdled into whimsy |
| gevurah **animate** | Khezek-Tor | the seal that holds (ties to the Valhaulan seal-restore beat) |
| tiferet **conceptual** | Bedlam Thirdword | the third word that reconciles the other two |
| netzach **animate** | Port Kudzu | kudzu endures beyond all reason |
| yesod **conceptual** | ✦ Allesh-Gilliam | **canon**: the Thatward's Ho! finale spark — the two live beat links acquire exactly this spark here |
| yesod **vestigial** | Ynnermire.b | foundation sunk |
| malkuth **animate** | ✦ Furrier's Fixit-Farm | the kingdom mends itself (⚠ Farrier's-vs-Furrier's name ruling still open; macro matches the current hex name) |

### The Saltwake Coast (4)
| Spark | Hex | Why |
|---|---|---|
| keter **vestigial** | Crown Mall | the crown, retail edition |
| chesed **conceptual** | Saltwake Reach e | hospitality of the coast (swap-friendly — a grief-refusal hex like Soft Landing would fit if it lives on a board scene) |
| tiferet **vestigial** | Static Coast g | harmony fallen to static |
| malkuth **vestigial** | Hexen Myre.l | the kingdom's mud |

## Phase 2 (next sessions, in rough order)
1. **Descent arcs**: beat `worldEffects` verbs to seat/integrate at a hex, so
   Recognition→Engagement→Integration plays on the board with real corruption
   risk on the way down (the dark is where the work happens — darkness as the
   required first stage, not a fail-state).
2. **Path-power coupling**: hex-scale manifestations and path features that key
   off spark hexes (`api.tikkun.hex.at` + the two hooks are the seam).
3. **The Ego-Dragon rises**: when the last spark is gathered
   (`egoDragonWarning` finally fires true) — collaborative Final Ritual at
   Daath, sparks as the instruments, the party's own failures as the Dragon's
   attacks, **Dragon's Parley as the canonical crown** (transformation, not
   slaying), Reformation Outcome as the `malkuthAligned` listener that finally
   exists.
4. Reconcile the 3-vs-5 Great Work spark threshold, and cap/curate the travel
   -encounter spark faucet (4 ad-hoc keys not in the pack).

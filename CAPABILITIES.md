# Bad Eden / BBTTCC — Capability Atlas

**Generated 2026-08-27** from a full six-crew code survey (system core + all 24 modules).
This is the canonical "what exists and what can it do" inventory. File:line pointers are
as of the survey date — treat them as landing zones, not gospel, after heavy edits.

**MAINTENANCE RULE:** when a working session adds, renames, or removes a public API,
hook, setting, flag schema, or tool macro, update that module's section here in the
same session (same commit when committing). New modules get a new section. The
**Dormant / Broken registry** (Appendix A) is the "what we're both forgetting" list —
retire entries when fixed, add entries when you build something and don't wire it yet.

Legend: 🔴 broken wire · 🟡 dormant/unwired (built, nothing calls it) · ⚠ trap/gotcha

---

## Contents

- [0. Cross-cutting contracts](#0-cross-cutting-contracts)
- [1. systems/fourththing — the system core](#1-systemsfourththing)
- [2. bbttcc-core](#2-bbttcc-core) · [3. bbttcc-factions](#3-bbttcc-factions) · [4. bbttcc-banks](#4-bbttcc-banks) · [5. bbttcc-territory](#5-bbttcc-territory) · [6. bbttcc-world](#6-bbttcc-world) · [7. bbttcc-structures](#7-bbttcc-structures) · [8. bbttcc-facility-console](#8-bbttcc-facility-console)
- [9. bbttcc-campaign](#9-bbttcc-campaign) · [10. bbttcc-travel](#10-bbttcc-travel) · [11. bbttcc-encounters](#11-bbttcc-encounters)
- [12. bbttcc-raid](#12-bbttcc-raid) (incl. Courtly, Tableau, Siege, Agent API)
- [13. bbttcc-mal-voice](#13-bbttcc-mal-voice) (AI NPC engine) · [14. bbttcc-market](#14-bbttcc-market) · [15. bbttcc-onboarding](#15-bbttcc-onboarding) · [16. bbttcc-master-content](#16-bbttcc-master-content) · [17. bbttcc-sorting-engine](#17-bbttcc-sorting-engine)
- [18. bbttcc-aae](#18-bbttcc-aae) · [19. bbttcc-auto-link](#19-bbttcc-auto-link) · [20. bbttcc-character-options](#20-bbttcc-character-options) · [21. bbttcc-epic](#21-bbttcc-epic) · [22. bbttcc-fx-integration](#22-bbttcc-fx-integration) · [23. bbttcc-radiation](#23-bbttcc-radiation) · [24. bbttcc-tikkun](#24-bbttcc-tikkun)
- [25. surge-powers (Kaeron War world — NOT Bad Eden)](#25-surge-powers)
- [Appendix A — Dormant / Broken registry](#appendix-a--dormant--broken-registry)
- [Appendix B — Hook census highlights](#appendix-b--hook-census-highlights)

---

## 0. Cross-cutting contracts

**API namespaces**
- `game.bbttcc.api.*` — module APIs (core bootstraps null slots so load order can't lose one).
- `game.fourththing.*` (alias `game.rollForInitiation`) — system core. `game.fourththing.epic` = bbttcc-epic (deliberate exception: RFI-exclusive endgame).
- `game.bbttcc.mal.*` — mal-voice AI layer. `game.bbttcc.help` — central tooltip/tour registry (adoption is partial, see modules). `game.bbttcc.apps.*` — app class/instance registry.
- `game.surgePowers` — surge-powers, **dnd5e Kaeron War world only**, no BBTTCC ties.

**Hook naming** — system emits dot-names (`fourththing.manifestationCast`); modules emit `bbttcc:ns:event`. Known deviations: `fourththing:itemAnimated` (deliberate colon holdout), `bbttcc.mutationRoll` (radiation, dot), `bbttcc:enlightenmentChanged` / `bbttcc:opsRecalculated` / `bbttcc:hexImprovement` / `bbttcc:advanceTurn:begin|end` (flat/camel, no ns segment).

**OP economy** — nine channels `violence, nonlethal, intrigue, economy, softpower, diplomacy, logistics, culture, faith` (canon: `bbttcc-factions/scripts/op-engine.js:17-27`). **All storage in MARKS, 1 OP = 10 marks** (`OP_TO_MARKS`, `op-engine.js:14`). Tier-band caps in marks `[50,70,90,110,130]` (`op-engine.js:116`). Banks live at `flags["bbttcc-factions"].opBank.<channel>`. ⚠ The channel list and the ×10 ratio are hardcoded in ~7 and ~5 extra places respectively (`bbttcc-bridge.js:437,449,513`, `exchange-engine.js:281`, `faction-bank-app.js:26`, vault-core `OP_BUCKETS`, diplomacy-apps, unity-bonus, make-salvage macro) — read from `api.op.KEYS`/`OP_TO_MARKS` in new code.

**Turn contract** — `bbttcc:advanceTurn:begin` / `:end {apply}` emitted by `bbttcc-territory/scripts/turn-driver.js` (wrapper stack: driver → tracks → garrison upkeep → turn-requests). **Every listener must gate on BOTH `apply` and `game.user.isGM`.** Census of listeners lives in each module's section; one known mis-gate (campaign ledger phase-door) is 🔴 in Appendix A.

**Actor kinds** — `game.bbttcc.api.actorKind(a)` → `faction|rig|facility|steward|monster|npc`; defined in the **system** (`systems/fourththing/actor-kind.js:41`, mount `:98-104`), cached at `flags.fourththing.kind`. Factions are `type:"npc"` + `flags["bbttcc-factions"].isFaction`.

**Combat seam** — `game.bbttcc.combat.{applyDamage, resistsForcedMove, ...}` slots created null by core (`bbttcc-core/scripts/module.js:48-54`), filled by the system (`systems/fourththing/module.js:15535-15544`). Pre-damage extension point: `game.bbttcc.combat.registerDamageInterceptor(fn)` (`bbttcc-core/scripts/module.js:55-70`); bbttcc-structures is the reference consumer.

**Two "campaign" namespaces** — `api.campaign` (bbttcc-campaign) and `api.campaigns` (created by travel, `hex-travel.js:1763`, holds the LIVE beat injector + a `runBeat` alias). Resolve via fallback like `bbttcc-encounters/scripts/trigger.manager.js:33` does.

---

## 1. systems/fourththing

*Roll for Initiation (Bad Eden Core Rules)* v0.6.1. Actor types `character` ("Steward") / `npc` / `rig`; item types `power weapon armor gear feature feat class subclass race species spark`. Six attributes (violence/intrigue/presence/body/mind/soul), 23 aptitudes, init `2d10x10 + intrigue + bonus`. Standalone-safe: every BBTTCC call guarded (`bbttcc-bridge.js:10`).

### API — `game.fourththing.*` (assembly `module.js:13302`)
- `.constants` = the `FT` table (`module.js:177`). `.items` = RfiItems unified flag schema (`rfi-items.js`). `.craft` = RfiCrafting (`inventory/recipeFor/difficulty/canCraft/recipesAvailable/tryCraft`). `.harvest` = RfiHarvest (`scanScene/attempt/markNode`). `.pricing` = RfiPricing (`rfi-pricing.js:853`).
- `.stack.{identity, findTarget, orCreate, merge}` — inventory stacking (`module.js:8574-8644`). Market delivery uses `orCreate`; `merge(actor)` = one-time dupe collapse.
- `.equipProficiency(actor, item)` → `{skillKey, rank, trained}` (`module.js:10353`) — the Market untrained-chip probe.
- `.surge.{itemFor, openSpendDialog, spend, availableFor}` (`module.js:13350-13372`) — per-class Surge spend tables live `module.js:4176-6600`.
- `.echoAssets.{get, openManager}` + `.roster.{get,set,delete,list,count,open,slug,generate}` + `.spotlight.{can,get,invoke,consume,clear,pickFromCrew,quickInvoke}` (`module.js:13383-13456`, engine `:12692`).
- `.rolls.*` — `applyOvershoot` (`:13692`), `bankRestraint/consumeRestraint` (`:13780/:13802`), `attributeTest` (`:13822`), `skillCheck` (`:13988`), `magicTest` (`:14033`), `resolveManifestationAttack/Save/Contest` (`:14256/:14347/:14491`), `misfireRoll` (`:14622`), `attackTest` (`:14659`), **`_applyDamageToActor`** the canonical damage/heal writer (`:15171`), `applyDamageFromButton` (`:15578`).
- Flat helpers: `castManifestation` (`:7109`), `wizardV2`/`openManifestationWizardV2` (`:15753`), `ftOpenEngageDialog` (`:1137`), `noiseBand/noiseBands/noiseBite` (`:910/:918`), `radiationBite` (`:10045`), `toggleCondition` (`:16139`), `defeatState` (`:16181`), `applyManifestationStates` (`:16192`), `applyEffectsToTarget` (`:6781`), `ftPlayAutoAnimation` (`:1574`), `syncTokenVision` (`:17963`), `classifyStewardItems`, `manifestationGlossaryHTML`, `createManifestationItemData` (`:8441`).
- `.actions.{somaBreak, sceneBreak, fiat, lesserManifestation, endScene}` (`:15748-16088`).
- `.deathMech.{enterLastStand, stabilize, crossThreshold, rollLastStand, addFailures, redeem, forceReincarnation}` (`:16450-16685`).
- `.bloodDebt.{get, add, clear, probe}` (`:16719-16770`).
- **`.darkness.{get, band, bite, gain, wash, setTaint, fragments, addFragment, face}`** + `.darknessBite` (Descent Engine D1, 2026-09-02 — `DESCENT_ENGINE_SPEC.md`): personal Darkness 0–10 on `system.darkness{value,taint,fragments}`, the ONLY sanctioned write path; bands Clear/Shadowed/Umbral/Nadir/Threshold via `FT.DARKNESS_BITE` (+ `FT.CONDITIONS.darkness*` display entries); Umbral+ dims max Clarity −2 (floor 1) in derivation; overflow past 10 scars taint +1; `face()` is the only taint heal (−1, −2 with `darknessSpikes`); sheet chip beside Radiation. **D2/D3 shipped 2026-09-03**: automatic sources — T2+ cast misfires (+1, via NEW hook **`fourththing.misfire` {actorId, tier, band, d10, source: cast|manual}** emitted at both `ftResolveMisfire` cast sites), Umbral+ Chaos casts (misfire softened one band AND +1 Darkness — the boon and its price, `castManifestation` bias calc), dark-hex travel (`bbttcc:afterTravel` listener: dest per-hex darkness ≥5 → +1 to the steward, once per hex per world turn, log `flags.fourththing.darkHexLog`), qliphothic damage ≥6/scene (+1 once, accumulator `flags.fourththing.qliDark`, chokepoint `_applyDamageToActor`), beat tags **`darkness:+N`** / **`fragment:<qliphoth>`** (`bbttcc:beat:resolved` listener, GM-gated); washes — Soma Break drains value to taint floor. `soulSavePenalty` (−2 Nadir+) live in `resolveManifestationSave` for soul saves. D3: fragment ledger UI on the sheet (open/faced + GM-only **Face** button, action `ftFaceFragment`) + public band icon as a marker ActiveEffect synced on `fourththing.darknessChanged`.
- `.rig.{board, disembark}` (`:25856`, impls `:23302/:23536`); `.maneuvers.inferFireMode` (`:25918`); `.vfx.{playCombat, playSweepArc}`.
- `.ae.{register, registerMany, get, has, all, byCategory, docs}` — curated AE-key registry, runtime-extensible (`ae-keys-registry.js`, picker `ae-key-picker.enhancer.js:132`). `.ae.docs()` prints the whole table.
- `._progression.*` (levelUp, tier math, path features, `grantStarterManifestations(actor)` — grants the path+doctrine starter manifestation kit from `bbttcc-master-content.items` by `flags.fourththing.starterKit {path, doctrine, core}`; called by the sheet's "+ Apply Path Features" button and auto-link's creation wizard; idempotent by item name — `ft-progression.js`), `._classAutomation.*` (~60 class dialog openers + `FEATURE_ROUTER`/`dispatchFeatureAction` — `ft-class-automation.js`), `.migrations.{run,list,stored,current}` (`migrations/index.js` — v1 baseline, v2 stamp-actor-kind, v3 repair-aptitude-grants).
- Outbound to modules: `game.bbttcc.combat.applyDamage/resistsForcedMove` (`:15535`), `game.bbttcc.api.raid.battleScenes.{list,current,bind,unbind,activate}` (`:26920`), `actorKind` (actor-kind.js).

### Hooks emitted
`fourththing.noiseChanged` (`:966`) · **`fourththing.darknessChanged {actorId, before, after, taint, source}` / `fourththing.fragmentGained` / `fourththing.fragmentFaced`** (Descent D1) · `fourththing:itemAnimated` (`:1583`) · `fourththing.manifestationCast` (`:7851`, payload incl. `reachPath`, `success`) · `fourththing.overshoot` (`:13773`) · death ladder: `enteredLastStand/stabilized/thresholdCrossed/redeemed/reincarnationPending` (`:16471-16711`) · `bloodDebtChanged/Cleared` (`:16747/:16763`) · `targetLeftReach` (`:17779`) · `revivedFromDying` (`:17900`) · `featureDispatched` (`ft-class-automation.js:7209`) · `bbttcc:rig:damaged/destroyed` (`:15502/:15505`) · `bbttcc:enlightenmentChanged` (`bbttcc-bridge.js:1854`).
Listens (notable): `bbttcc:advanceTurn:end` (`:17827` reminder card), `bbttcc:raid:roundCommit` (`:25797`), `bbttcc:infiltration:*` (`:26389`). Socket: `system.fourththing` + `module.bbttcc-raid` share one GM relay (`:26913`; msg types `ft-boardSelection … ft-grantClarity` `:26795-26891`).

### Schema highlights
- Character: `magic{clarity,noise,sephirah}`, `derived{integrity,stress,guard,evasion,resolve}`, `defenses{resistances,immunities,vulnerabilities}` (⚠ RFI resists live HERE, not 5e `traits.dr`), `lastStand`, `bloodDebt`, `radiation{rp}`, `darkness`, `tikkun`, `actions{...movementBudgetFt}`, 15 conditions incl. 4 radiation rungs.
- Rig: `identity{mobility,state,factionOwnerId}`, `crew{slots,capacity}`, `integrity{value,max,tier,bracket}`, `travel{speed,range,hazardResist,domains,depthRating}`.
- Flags (second schema): `flags.fourththing.rfi.item.*` (price/tech/charges/**chargesMax**/consume.effects/origin), `flags.fourththing.harvest`, `flags.fourththing.discipline.*`, `flags.fourththing.kind`, `flags.fourththing.combat.bonusManifestationUsedThisRound`. ⚠ `actor.system` is AE-mutated in place — writes must go through the SOURCE reader (`module.js:994`).

### Settings / tools
World settings: `overshootEnabled/overshootTierGate/overshootSkillChecks/autoApplyEffects/ftAoeTargetPicker` (`:13605-13638`) + hidden `schemaVersion`. No chat commands. Packs: `starter-manifestations`, `surge-abilities` (+137 `_source` JSONs). `tools/`: 8 paste macros + 6 node build scripts (AA autorec, surge ability builders).

### Dormant/broken → see Appendix A items 1–5.

---

## 2. bbttcc-core

*Strategic Layer Core* v13.1.17 — namespace bootstrap, GM write/audit layer, combat adapter seam, central help registry, global window/theme defaults (`be-theme.css` et al.), and the **Manifestation Bridge** (steward↔faction value transfer).

### API
- ⭐ **`game.bbttcc.api.gmExec.{register, call, primaryGmId, types}`** (`gm-exec.js`, 2026-08-29, Phase 1 of the engine roadmap) — THE seat primitive: `register(type, handler)` GM-side (handler(payload, meta{fromUserId,fromUserName,local}) → serializable result, MUST validate + return fast — kick long work fire-and-forget); `await call(type, payload, {timeoutMs=15000})` from ANY seat (GM = local; player = socket relay on `module.bbttcc-core` to the primary GM w/ ack/timeout). API published at PARSE time (load-order safe); listener arms at ready. Registered types: `op.commit` (bbttcc-factions — makes ALL bank writes player-seat-safe: travel legs, passenger cuts, dialog spends), `travel.hexEnter` (bbttcc-travel — arrival beats run GM-side, ack is a receipt). ⚠ bbttcc-core module.json now has `socket: true` + gm-exec.js first in esmodules (manifest change 2026-08-29 → restart done; clients owe full cache bust).
- `game.bbttcc.api.core` + null slots for factions/territory/characterOptions/campaign/encounters (`module.js:23-30`); `game.bbttcc.combat` slots + `registerDamageInterceptor` (`:48-70`).
- `game.bbttcc.help = {register, entry, tip, dict, apps, applyTooltips}` + `{{bbttccTip}}` helper (`bbttcc-help.js:77-88`) — one source of truth for tooltips AND Operator tours.
- `game.bbttcc.api.gm.{setWorld,setFaction,setActor,setHex}` (`api.gm.js:406-411`) — allowlisted structured-patch writes (`ALLOW` `:111-139`), audited to `bbttcc-core.gmAuditLog` (250-ring), GM-whispered. `setHex` delegates to `territory.gmSetHex`.
- `game.bbttcc.api.story.gottgait.{getState,setState,updateState,logBeat}` (`story.gottgait.js:58`) — state store + beat log only (engine removed).
- `game.bbttcc.api.bridge.{open, manifest, manifestHp, backing}` (`bbttcc-bridge.js:927-936`). `manifestSacrificeToFactionOp` (`:361`) — deposit-marks-first, refund-safe; sacrifice types `integrity/stress/aptitude/manifestation` (tier-priced, `:390-429`; aptitude burn restores on Soma Break via `flags.fourththing.aptitudeBurn`). `spendFactionOpForRoll` (`:492`) — faction OP backs a real RFI roll (+2/OP flat or 1d6/OP dice). Blood Debt canon at `flags.bbttcc.identity.bloodDebt`, prefers `game.fourththing.bloodDebt.add`.
- Global: `Dialog` replaced resizable-by-default (`window-defaults.enhancer.js:51`); all `.window-content` get scroll defaults.

### Settings
`gmEditMode` (world, visible — gates territory build-unit buttons) · `gmAuditLog`, `worldState`, `gottgaitStoryState` (hidden). No hooks emitted, no tools.

⚠ `bbttcc-core.worldState` (api.gm) vs `bbttcc-world.worldState` — **two divergent world-state spines**, nothing reconciles them (Appendix A #14). `combat.dnd5e.js` is a no-op in the RFI world by design.

---

## 3. bbttcc-factions

*Faction & OP Engine* v1.3.17 — faction sheet (V1 `ActorSheet` on `npc`, emits `renderBBTTCCFactionSheet`), OP banks, stockpiles, relations, atomic exchange, async trade inbox, doctrine-as-items, starting packages/wizard, Rig Console, ~14 sheet enhancers.

### API
- **`game.bbttcc.api.op`** (`op-engine.js:416-425`): `preview(factionId, deltas, ctx)`, `commit(...)` (underflow always refused; over-cap refused only when the delta increases an over-cap bucket; `ctx.allowOvercap` bypasses), `KEYS`, `OP_TO_MARKS`, `formatMarksAsOP*`, `opToMarks`, `runMarksMigration` (⚠ epoch guard `MARKS_MIGRATION_EPOCH_MS = 2026-08-15` after the ×10 phantom-treasury incident).
- **`api.factions.exchange`** (`exchange-engine.js:415`): `plan` (pure preview), `share` (allied send, zero friction, needs mutual `allied`), `trade` (tier friction, worst-of-two). Resource shape `{marks:{...}, buildUnits, materials:{...}}`; materials move friction-free. True atomicity with rollback (`_applyDeltasAtomic` `:210`).
- **`api.factions.relations`** (`relations-api.js:193`): `get/set/tier/list/canTrade`; ladder `at_war(0)…allied(5)`; `canTrade` needs both ≥ neutral.
- **`api.factions.stockpile`** (`stockpile-api.js:236`): `get/qty/list/adjust/depositFromCharacter/withdrawToCharacter` → `flags.bbttcc-factions.matStockpile`.
- **`api.factions.pending`** (`pending-trades.js:329`): trade inbox state machine (`pending→accepted|declined|countered|expired`, 7-day TTL, stored on recipient).
- `api.factions.{setMorale,setLoyalty,bumpMorale,bumpLoyalty}` (`faction-meters.enhancer.js:137`).
- `api.victory.{computeVPGain, applyVPGain}` (`vp-engine.js:35/:71`) — `0.5·Unity+0.3·Morale+0.2·Loyalty`, cap +3/turn.
- `api.quests.openQuestLog({factionId})` (`quest-log-app.js:436`).
- Main module (`module.js:4096+`): `startingPackages/listStartingPackages/getStartingPackage` (PKG_STANDARD_V1 `:4130`), `doctrine.{list, ownedKeys, grant}` (`:4197`), `applyStartingPackage` (`:4225`), `createFactionFromPackage` (`:4405`), `previewStartingTerritory`/`assignStartingTerritory` (`:4576/:4642`), `openCreationWizard` (`:4780`).
- Apps: `game.bbttcc.apps.{AlliedSendApp, TradeApp, QuestLog, RigConsole}`.

### Hooks
Emits `bbttcc:economy:share/exchange`, `bbttcc:stockpile:changed`, `bbttcc:trade:pending/settled`, `bbttcc:relationship:changed`. Listens `bbttcc:advanceTurn:end` (momentum reset, pressure, victory gate — all GM-gated), `bbttcc:beforeTravel`.

### UI / settings / tools
Five-tab faction sheet (Overview/Activities/Assets/Relationships/War Logs); Rig Console AppV2; Momentum spend menu (bank +1 per nat-10 OP check; spend 1/2/3/5 — `module.js:3900-4025`); GM Advisor dialog; trade inbox/history/stockpile/meters/dashboard enhancers. Settings: `pendingTradeSweepMinutes`, `autoRelationshipNudge`, `fairTradeTolerance`, `nudgeCooldownHours`. Tool: `repair-marks-double-migration.macro.js` (no DRY_RUN — writes on run).
Tier advancement (wired on 2026-08-28): stability counters accrue per Apply turn (`faction-tier-stability`), `api.factions.{getTierAdvancementReport, canAdvanceTier}` (`faction-tier-advancement-api`), GM Advance Tier button raising opCaps to the marks band (`faction-tier-advance-button`). ⚠ Runs its own tip dicts instead of `game.bbttcc.help`.

---

## 4. bbttcc-banks

*Banks & Loot* v0.1.0 — one **Vault** primitive → personal bank (items only), faction/coalition treasury (items in flag + marks in opBank), on-canvas loot containers. Doctrine: **marks never sit on a steward.**

### API — `game.bbttcc.api.banks` (`vault-core.js:446-465`)
`transferVault({source,target,items,marks,context})` (atomic credit-before-debit + rollback) · `deposit/withdraw/listVault` · `factionTreasury` · `accessibleFactions` · `coalitionLeadFactions/setCoalitionLead` · `openPersonalBank/openFactionBank/openLoot/openLootConfig`. VaultRef kinds `inventory|personal|faction|coalition`; bankable = physical gear or `bound|enduring` manifestations. Emits `bbttcc:vault:changed` (`:363`).

Loot flavors `corpse|chest(tinkering DC12)|terminal(hacking DC14)|cache`; **auto-loot on defeat** (npc integrity/stress → 0 becomes free corpse, active-GM-only, `loot.js:352-401`); Token HUD 🪙/✋ buttons; GM socket relay on `module.bbttcc-banks`. No settings. Tool: `make-salvage.macro.js` (confirm-dialog gated) — salvage refines into marks on faction deposit.

---

## 5. bbttcc-territory

*Hex Territory Map* v1.3.20 (~20k lines, biggest module) — hexes-as-Drawings, terrain/conditions/resource nodes/fog, the **turn pipeline**, resolution/outcome matrix, garrison upkeep, build units, Townbuilder, quest links, GM toolbar + player HUD, Territory Dashboard / Campaign Overview.

### API
- **`api.territory`** (`main.js:3182-3230`): `gmSetHex`, `createHexAt/openHexConfig/claim`, `normalizeTerrainKey/buildTerrainObj`, `leylines.{tierRank,getFactionTierKey,gateUsable,resolveRemoteAdjacency}`, `resourcesToOP`, `recordHexImprovement`, `describeHexModifier/MOD_DESCRIPTIONS`, `computeHexNextSteps`, `traceHexProduction`, `refreshCapitalOverlays`, `refreshAllHexStyles({allScenes})`.
- `openHexSheet` (canonical: `bbttcc-hex-sheet.enhancer.js:1922` — wins over the superseded main.js copy), `holdings` (`:500` — deploy/recall rigs+bosses to scenes, caps, bonuses), `buildUnits.{get,canAfford,spendForAction}`, `townbuilder.{open,getSettlement,ladderFor,LADDER}`, `fog.*` (`hex-fog.layer.js:288`), `harvestHexNode/regrowHex/addHexNode/deleteHexNode/openAddNodeDialog`, `applyOutcome` + `saltHex` (`resolution-engine.js:40/:266`), `getUnityBonusReport`, `questLinks`, `openCampaignOverview`.
- **`api.turn`**: `advanceTurn`/`executeOPRegen` (+aliases) (`turn-driver.js:1782-1791`), `computeLogisticsPressure(+ForFaction)`, `enqueueRequest`, `processRequests`. Wrapper stack: driver (`installDriver` `:1521`) → tracks (`advance-turn.tracks.js:1018`) → garrison upkeep → turn-requests.
- Globals: `BBTTCC_OpenTerritoryDashboard`, dashboard/overview ctors, `window.BBTTCC_RESOLUTIONS`.

### Hooks
Emits `bbttcc:advanceTurn:begin/end{apply}` (`turn-driver.js:1557/:1630`), `bbttcc:hexImprovement`, `bbttcc:territory:hexUpdated`, `bbttcc:gate:unlocked`. Listens `bbttcc:beat:resolved` (gate-unlock listener, GM-only writer), own hooks for facility turn effects / fog / dashboard.

### UI / settings / tools
GM toolbar `#bbttcc-toolbar` (Dashboard/Create Hex/Overview + augment: World Map/Travel Console/Turn Driver); Territory Dashboard + Campaign Overview + Hex Sheet (all AppV2, help-registered); Relationships Config; **Player HUD** (`player-hud.enhancer.js` — faction/steward/abilities tray, rig-aware emanation, only public `game.fourththing.*`); hex fog layer; click-to-edit. Settings: build-unit costs ×3, click-to-edit ×3, townbuilder costs + `townbuilderChargeMaterials` + `districtYieldShare`, fog ×4.
Tools (3) + macros (9): `assign-jackalope-holdings` [DRY_RUN=true], `darkness-stress-test` (writes by design), `link-hex-onenter-beats` [true]; `seed-hex-resource-nodes` ⚠ **DRY_RUN defaults FALSE**; `toggle-hex-visibility` = canonical fog reveal; quest-hint reveal/hide; audit-quest-hex-links.
⚠ NBSP hex names: only two defended sites (`main.js:797`, `townbuilder.js:71`) — anything else matching hex names by string is unguarded.

---

## 6. bbttcc-world

*World State Engine* v0.1.0 — canonical settings-backed world record `{turn, darkness, pressureMod, time{epoch,turnLength,progress}, locks, meta.snapshots}` + GM God Panel.

### API — `game.bbttcc.api.world` (`api.world.js:634-672`)
`getState/setState/applyGMEdit` · `bumpTurn/setDarkness/setPressureMod` · **Turn Ledger sink** `addTime/getTimeBudget` → `{ok, spent, remaining, debt}` · `getWorldLogs` · snapshots `list/create/rollback/delete/export/clearAll` · turn-beats `get/setTurnBeatsMap`, `get/setTurnBeats`. Emits `bbttcc:time:accrued` (`:628`) — its only hook.
GM God Panel via `registerMenu("bbttcc-world","gmGodPanel")` (restricted). All settings hidden. No tools. 🔴 competing spine with core (Appendix A #14).

---

## 7. bbttcc-structures

*Bad Eden: Structures* v0.1.0 (code actually Phase B–E) — material-BOM hardness model for rigs/facilities/fortifications: BOM → Plates/Threshold/resists; damage chips the BOM; states intact→damaged→breached→destroyed; collapse hurts tokens on top; recipes spend faction stockpile.

### API — `game.bbttcc.api.structures` (`api.structures.js:496-534`)
Pure: `computeFamily/deriveBOM/stateFromPlates/canonicalizeDamageType`. Mutating: `stampBOM/clearStructure/fullRepair`. `readState`. `crew.{capacity,read,assign,release,retypeFortification}`. Tables `FAMILIES/FAMILY_MAP/STATE_THRESHOLDS/RUBBLE_JITTER`. `recipes.{list,byId,canAfford,build,harden,repair,reload}` (`recipes.js:422`). `triggerCollapse/findTokensInsideFootprint` (`collapse.js:420`). `_wedge.{install,uninstall,isInstalled}` — the **registered damage interceptor** (converted from monkeypatch 2026-06-10, `damage-wedge.js:11-19`; overflow re-enters with `_skipInterceptors:true`). `bulwark.*` (Ruin-to-Renewal reclamation).
Emits `bbttcc:structure:{collapse, damageApplied, stateChanged}`. Sheet panel on Rig/Boss sheets (Harden/Repair buttons still stubbed → Appendix A #16). Data: `data/*.json`, spec `STRUCTURE_DAMAGE_SPEC.md`. Macros (5): build/damage/retro-stamp/sanity-check(read-only)/stamp-test-bom. ⚠ `damage-path.js` absent from manifest but live via ES import.

---

## 8. bbttcc-facility-console

*Facility Console* v1.0.0 — single-file hex-attached facility editor (bunker/tower/castle/custom presets: tier, SDR, OP modifiers, raid bonuses, travel effects, upgrades, per-turn effects, resolution hooks). Writes `hex.flags["bbttcc-territory"].facilities.primary` via mergeObject. **Pure editor — engines that consume its raw-JSON payloads live in territory.**
API surface = only `game.bbttcc.apps.FacilityConsole` (class; no `api.facilities.open`). Sole launcher: hex sheet (`bbttcc-hex-sheet.enhancer.js:1025`). No settings/hooks/tools. ⚠ authored `upgradesRaw/turnEffectsRaw/resolutionHooksRaw` JSON is unvalidated at edit time — malformed paste fails later inside the territory turn pipeline.

---

## 9. bbttcc-campaign

*The story engine* v1.0.1 — the **beat** as atomic authored content; three drivers (Story Director, dialogue surface via mal-voice, injector); world mutation, casualties, **Turn Ledger** (play→calendar days), **The Turn Press** digest, Campaign Builder (Flow Visualizer/Beat Editor/Table Editor/Quests).

### API — `game.bbttcc.api.campaign` (built `module.js:6845`, installed `:7578`)
- CRUD: `listCampaigns/getCampaign/saveCampaign/createCampaign/deleteCampaign/getAllCampaigns/setAllCampaigns`; `runCampaign`.
- **`runBeat(campaignId, beatId, ctx)`** (`:3884`) — canonical entry; applies `_beatEntryRedirect` (feud + `phaseEntry.belowPhase`); ⚠ deliberately ignores `inject.requires` ("gates are the Director's concern"). `executeBeat` (`:3043`) = the ~800-line lifecycle. **2026-08-27 lifecycle changes**: (a) encounter-type beats WITH choices now SHOW their dialog (old gate silently swallowed authored choices on any encounter beat w/ key); (b) a beat with its own `sceneId` whose registered scenario matches (`own.beatId===beat.id`) launches ITSELF, not the legacy core Encounter→Scenario map; (c) scenario launch is SKIPPED when the beat dialog handled the moment (own scene + dialog ran, or a choice routed on a successful check — failed check / fight pick / closed menu still launches); (d) scene-activation branch drops participating-faction PCs (`spawnFactionPCs`) when `_lastEncounterCtx.encounter.beatId` matches (covers dialog-type encounter beats like Acid Bog); (e) **failed choice checks re-offer the parent menu** (`_scheduleRetryOffer` — GLOBAL on-fail: failNext beat resolves, then the dialog re-opens; OP checks re-price each attempt; GM closes to let a failure stand).
- `gates.{report, requiresMet, value}` (`:6859`); `tikkun.get/max`.
- **`director.{tick, chains, reconcileLevels, state, addPressure}`** (`:6874-6878`). Pressure accrual: turn +30, travel leg +8, raid round +10, resolved beat +3; threshold setting default 60. `speakerActorId` beats are **invited, not fired** (`:5017-5040`).
- **`dialogue.{choicesFor, enact, storyStateFor, doorsFor, pointTheWay}`** (`:6881-6885`) — the mal-voice contract.
- `placements.reconcile` (`:6887` → `reconcileNpcPlacements` `:6053`).
- **`ledger.{get, spend, remaining, timePointsForBeat}`** (`:6888`) — Turn Ledger.
- `tables.*` (+`runRandomTable` with real `dryRun`), `quests.*`, `io.*` (journal-pack bundle export/import/remap/stable-keys).
- `openBuilder/getActiveCampaignId/setActiveCampaignId`; post-build: `openBeatDialog()`, `audio.*` (BeatAudioManager), `stopBeatNarration`, `show/closePlayerFacingBeatDialog`, **`remirrorBeatDialog()`** (2026-08-29 — re-broadcasts the mirror for the GM's currently-open beat dialog; the player mirror is a SINGLETON, so overlapping chains/courier misses can eat it), `_lastEncounterCtx` (stash written by encounters).
- **`digest.{press, render, clear, journalName, opening}`** (`world-digest.js:277`) — The Turn Press. Headlines come ONLY from authored **`beat.digest`** strings of fired beats (max 6); no digest → never in the papers. Spares the authored Opening page.
- Also published here: `api.casualties.{applyFromBeat,applyToHex,applyToFaction,parseTags}` (`casualties-engine.js:542`), `api.worldMutation.{applyWorldEffects, pullTableToScene}` (`world-mutation-engine.js:1471`), `api.opSchedules.{list,tickFaction,tickAll}`, 🟡 `api.rolls.*` (zero consumers).

### Beat data model (as consumed)
- Identity: `id/label/description/type` (+legacy aliases). **Visibility:** `playerFacing` + 4 aliases (`playerFacingDialog/dialogPlayerFacing/playerFacingContent/showToPlayers`) OR-ed at read (`:2175`), normalized+written-back-to-all-five on editor save; broadcast = chat-courier mirror dialog. `beat.digest` (Turn Press headline), `beat.memoryText` (NPC memory; falls back to label+choice), `beat.inviteText`.
- Gates: `inject.requires` (AND-array; forms `{flag, gte|lte|eq}` over 15 named meters · `{questBucket, is|isNot}` · `{beatMark, quest, state}`; fail-open on exception, unknown meter = unmet+warn). `inject.{repeatable, cooldownTurns, oncePerHex, oncePerFaction, oncePerHexGlobal, allowMulti, promptGM, fallbackOnDecline, enforcement, priority, storyChain, politicalTags, travel_threshold, debt_pressure}`. `phaseEntry{belowPhase,to}`.
- Director: `storyChain` (chain order = beats-array order), `priority high|normal|background`, **`speakerActorId`** (NPC embodiment → dialogue surface; `dialogueOffer:false` opts out), director-excluded when `targetHexUuid` / tag `discovery` / `timeScale==="leg"`.
- Content: `sceneId/sceneUuid`, `journal` (GM auto-open), `actors[]`, `audio`, `refs`, `cinematic{enabled,startSceneId,nextSceneId}`.
- Choices: `label/description/prompt/style`, **`next`/`failNext`**, checks (`checkStat/checkDC/checkMode/checkPrompt`), OP support (`support/supportSpend/supportOpKey`, desperation gate, HP-sacrifice), `politicalTags`. **Check semantics (owner ruling 2026-08-30, enforced in dialog + dialogueEnact paths): op.\* checks AUTO-ROLL and gate/spend/roll against the SELECTED steward's faction (`_factionForRosterActor`, primary-faction fallback); ALL non-OP (aptitude) checks go to GM pass/fail adjudication — authored `checkMode:"auto"` is ignored for them.** The dialog's Roster Member dropdown lists ALL participating stewards (campaign coalition rosters, `actorKind==="steward"` only), and the summary OP pool/bonus chips render one labeled block per coalition faction.
- Effects `worldEffects`: `factionEffects/relationshipEffects/worldModifiers/turnRequests/questEffects/warLog/radiationDelta/territoryOutcome/purifyHexes/openTravel(prefills Travel Console)/phaseAdvance/tikkunDelta/levelEffects(monotonic floors)/politics`. Plus `unlocks{maneuvers,strategics}`, `gateUnlocks`, `questId/questStep/questRole`, `offerQuest`, `sparkLink` (Tikkun), `handoff`, `encounter{key,tier}`, **`chase`** (travel seam), `timeScale/timePoints/turnNumber/chapter/act/tags`.

### Hooks
Emits **`bbttcc:beat:resolved` `{campaign, beat, ctx, outcome}`** (`:3748`, the cross-module spine) + `bbttcc:dialogue:choiceEnacted` + `bbttcc-campaign:updateBeat`. Listens: 6× `bbttcc:advanceTurn:end` (director/ledger/title-card/announce/press/op-schedules — all GM-gated EXCEPT 🔴 ledger phase-door, Appendix A #11), `bbttcc:time:accrued`, `bbttcc:afterTravel` (ledger debit + director seam), `bbttcc:raid:roundCommit`, 10× `bbttcc:beat:resolved` meter subscribers, `fourththing.overshoot` (Reality Tear → adversary beat, primary-GM-elected + socket relay).

### Settings / UI / tools
**Beat lint (Phase 4, 2026-08-29)**: GM ready +8s sweeps the active campaign (broken next/failNext links · all-checked no-exit menus · hub-reachable zero-choice venues); toasts only when dirty, one console line when clean. Also 2026-08-29: fired-history `ts` refreshes on EVERY fire (hero anchor follows the table's present; `firstTs` preserved), and the beat-dialog close-race is fixed (`buttonTaken` — a clicked button's callback owns the promise; teardown never resolves early). bbttcc-factions: **token faction sheets redirect to the world actor** (`BBTTCCFactionSheet._render`).
Stores (hidden): `campaigns/injectState/encounterTables(read cross-module by encounters)/quests/activeCampaignId/lastTurnAnnounced/directorState/ledgerEntries` + 15 named meters. Dials (visible): `ledger.turnTimeBudget`, `ledger.travelDaysPerTier` (CSV `1,1,2,3`), `overshoot.drawsBeats`, `director.enabled/pressureThreshold(60)/autoInvite/turnTickOnlyChains("valhaulan_spine")`, `audio.debug`.
UI: Campaign Builder (AppV1, 5,970 lines, Flow Visualizer w/ quests|beats|lanes views), Beat Editor (3,793), Table Editor (`apps/` copy is live), Player Beat Mirror, toolbar 🎬 button, 8 chat-card families (quest offer, title card, talk invite, handoff, level-up, tier, Wendigo/Bandit rungs).
Tools: **84 macros** — 47 DRY_RUN=true (incl. 2026-08-27 `patch-bandit-ambush-mercy` — wires win-beat kill/jail/free choices into the mercy-counted outcome beats, ✅ applied — `seed-words-doors` — parley/commune door + success/fail beats on 10 travel encounter families, tags `words_door`, esoteric-shelf checks meditation/insight/occult/ritual, ✅ applied — and 2026-08-28 `patch-steel-doors` — no-check FIGHT choice beside every words-door, hub-routed when a neutral Win/Lose/Run outcomes hub exists; fixes the fail→re-offer loop trap — ✅ applied; and `patch-no-exit-menus` — unchecked exits for the 6 all-checked menus the link audit found: hazards get slow-lane beats costing timePoints 1, Gilbert routes to his fight, social menus walk free; + bandit steel door → live hub `bandit_ambush_outcome_results`), **19 DRY_RUN=false (write on paste)**, 18 read-only/tests (new: `audit-beat-links` — campaign-wide broken next/failNext/outcomes refs + NO-EXIT MENUS where every choice is checked + words-door family link map). Read-only highlights: `audit-beat-reachability`, `audit-beat-actors`, `audit-monodynamic-exposure`, `campaign-census`, `press-digest`, `reset-console` (🔄 Bad Eden Reset Console). See the module's tools dir; ship-hot list in the survey of 2026-08-27.

---

## 10. bbttcc-travel

*The overworld layer* v1.4.0 — hex-to-hex movement (OP cost, terrain tier, weather, domain gating, 2d10 travel check + encounter roll), multi-leg **Travel Console** with passenger factions + armed mitigation, vertical dive/ascend, scene transitions, world overview map, and the **Chase** primitive. Hosts the LIVE CampaignBeatInjector.

### API
- **`api.travel.travelHex`** (`api.travel.js:1008`; core engine `hex-travel.js`, drift guard re-asserts the wrapper `api.travel.js:1016-1036`).
- `travel.domains.*` (`hex-travel.js:1807-1824`): terrainMedium, requiredDomainsForTerrain, rigDomains, factionTravelDomains, canFactionEnterTerrain, factionSubDepth, factionAirReach.
- `travel.dive/surface/ascend/descend` (`:1827-1832`); `api._hexTravel.{TERRAIN_TABLE, getHexAtPoint, getHexTerrainSpec, _encounterDc}` (the console's preview contract).
- `travel.emitAfterTravelWithEncounter(...)` (`bbttcc-travel-console.js:2765`).
- `travel.weather.{archetypes, get, tooltip}`; `travel.arc.rollStep`; `travel.mitigation.{rosterAbilities, coverageFor, coversWeather, filterByWeather, usesFor, getMode, setMode}`.
- **`travel.chase.{start, runLeg, end, open, state}`** (`chase.js:601`). Lead-meter pursuit: lead≤0 CAUGHT, ≥escapeAt ESCAPED; per-leg Pace `2d10+tier+speed*2+bonus`; terrain bias `hazard/combat/discovery/extreme/mix`; domain gates as tactics (pursuer can't enter → quarry escapes; quarry can't → cornered −2); gambits `redline/potshot/feint` at 10 marks via `op.commit`; `endChase` fires `bbttcc:chase:resolved`, war-logs both sides, then runs `followUp.{onCaught,onEscaped}` via `campaign.runBeat`. **Beat seam**: author `beat.chase = {quarry, pursuer, route[], lead, escapeAt, onCaught, onEscaped}`; side spec accepts `{fromCtx:true}`. State survives reload (`bbttcc-travel.activeChase`). GM Chase Console 🏁.
- ⭐ **`api.travel.rideSession.{get, list, save, clear}`** (Phase 2, 2026-08-29) — the ride as a first-class persisted object: world setting `bbttcc-travel.rideSessions` keyed by factionId `{id, factionId, joiningFactionIds, legs[], executed, stage riding|encounter, encounter{beatId,key,label}, createdTs, updatedTs}`. Console writes at execute-start / encounter-pause (remaining legs; final-leg pause clears — arrival owns it) / completion (clears); player-seat writes relay via gmExec `travel.rideSession.save`. Console shows **"↻ Resume ride — N legs remain"** when a session exists and the planner is empty; Resume restores legs. Reload mid-ride no longer loses the route.
- `api.transition.{dive, back, flash, shake, portalSwirl, requestDive, consumeDive}` (`scene-transition.js:294`) — road encounters use `audience:"activate"` (2026-08-26 ruling: table moment).
- `api.worldMap.*` (`world-overview.js:465`), `api.travelPlanner.{open,close}` (planner UI pill deliberately killed — API alive, no entry point), `game.bbttcc.ui.travelConsole` singleton, `game.bbttcc.runVisuals`, overlay renderer globals.
- **`game.bbttcc.api.campaigns.injector`** (`hex-travel.js:1588`) — THE canonical injector (ruling 2026-08-28): `maybeRunBeatById` (hex_enter, `defaults:{oncePerHex:true}`), `maybeInject("travel_threshold")`, `dryRun`. Tag matching: ctx→tags `trigger./terrain./band./radiation./tone.` **+ autoDebt tags** (`debt:<n>`, `debt` at ≥2 `[HV_DEBT:` war-log markers); hard-prefix filter + overlap score **+ foreshadow.<chain> +15 when the chain is in motion**; `inject.requires` gated via `api.campaign.gates.requiresMet` (fail-open); debt-ish winners need a GM Run/Decline (decline persists per campaign:hex:beat in `state.declinedDebt`, falls through; non-GM clients skip debt beats); no injection in combat; 1-turn global cooldown (hex_enter exempt).

### Travel math & OP debits
Check: `travelAdvantage ? 3d10kh2 : 2d10` `+ @int + @scout` (`hex-travel.js:1131`); encounter DC = base 12 + tier×2 (settings `travelEncounterBaseDC/TierStep/travelDomainGate`, world-visible). Lead faction pays via `spendOP → op.commit` inside travelHex (`:528-553`); **passenger factions each pay their own leg debit** (Phase E1, console `:2150-2230`, allied-only join); mitigation bridge stages/consumes uses on `beforeTravel`/`afterTravel` (forecast mode never drains). Console: Vanguard Stack armed-mitigation, `worldEffects.openTravel` prefill seam (`:2681`), floating "Open Travel Console" button.

### Hooks
Emits `bbttcc:beforeTravel`, `bbttcc:afterTravel {…, success, rollTotal, dc, encounter, joiningFactionIds, participantFactionIds}` (participant fields added 2026-08-27 — feed the encounter-scene PC drop), `bbttcc:chase:resolved`. Listens `bbttcc:advanceTurn:end` (weather tick, GM-gated), `bbttcc:beat:resolved` (chase seam, GM-gated), `updateToken` (hex arrival). Socket `module.bbttcc-travel` encounter arbitration (primary-GM elected).

### Tools
13 macros: `start-chase`, `dive-here`, `setup-underwater-dive`, travel gauntlet forge/runner/static-audit (audit read-only), overlay helpers, world-overview setup ×5 (`world-overview-migrate` is the only DRY_RUN-gated one, default true). ⚠ 12 of 13 write on paste.

---

## 11. bbttcc-encounters

*Arbitration + staging* v1.0.0 between a travel result and a playable scene. Listens `bbttcc:afterTravel` (GM-gated first statement), Launch/Decline/**Reroll** policy dialog (reroll re-picks from campaign travel tables `travel_<terrain>_t<tier>` → `travel_generic_t<tier>`), then: **preferred path** = stash ctx on `campaign._lastEncounterCtx` → `transition.requestDive({audience:"activate"})` → `campaign.runBeat(campaignId, beatId)`; **legacy path** = static Encounter→Scenario→Scene registry (on retirement path — warns on every use).

### API — `game.bbttcc.api.encounters` (`api.encounters.js:1076`)
`getScenario/listScenarios/getSceneConfig/listMappings/getScenarioKeyForEncounter` · `launchFromEncounterCtx/launchForEncounterKey/launchScenario` · `testFire` (GM console; `ctx.source==="manual-testFire"` suppresses ALL world effects) · `hasScenario/registerScenario/unregisterScenario/clearExternalScenarios` · `registerCampaignBeatScenario`.
`_launcher.playScenario` (`scene.launcher.js:1627`): per step activate scene → generic `scenario.spawn.actors[]` → **`spawnFactionPCs`** (2026-08-27, re-ruled 2026-08-30: **stewards only** — `actorKind()==="steward"`, crew/association echoes excluded — for ALL factions on the ACTIVE CAMPAIGN's roster `campaign.factionIds`+primary, ctx factions as campaign-less fallback; skips stewards already on scene, bottom-center row, FRIENDLY) → bespoke `spawner.run` (registry has ONE entry: `bandit_ambush_standard`, hardcoded ids). Then outcome prompt → war log → auto-return (skipped if the beat path dived). `applyWorldEffectsForOutcome` (~1300 lines of per-scenario switches) divides/multiplies opBank by OP_TO_MARKS on read/save.
`_spawner.{run, SPAWNERS, spawnAtCenter, spawnActors, spawnTokens, spawnFactionPCs}` · archetypes `getArchetype/listArchetypes` (🟡 zero consumers) · outcomes `getOutcomeSetForScenario/listOutcomeSets`.
**Settlement (2026-08-28 refactor)**: `await runBeat()` is the DECLARED chain-completion event (the campaign engine awaits every choice hop, verdict hub, and in-chain retry; ctx + `__chain` marker threaded through all hops). After it returns, `settleEncounter` waits only on real combat (6s grace for (end)-door fights to reach the tracker, audible "End Combat to move on" notice, 45-min hard stop), then returns the table + nudges/suppresses, and **emits `bbttcc:encounterChainSettled` + stamps `game.bbttcc._encounterChainSettledTs` + socket-relays `{t:"bbttccEncounterChainSettled"}` over `module.bbttcc-campaign`** (listener registered per client at ready). All window/title polling deleted. No settings (reads `bbttcc-campaign.encounterTables` cross-module), no tools, no styles. ⚠ declared circular dependency travel↔encounters.

---

## 12. bbttcc-raid

*Raid & Siege Engine* v1.3.14.4 — 104 esmodules, ~40k lines. Raid console, maneuver catalog, strategic activities, **Courtly Intrigue**, **Tableau**, **Siege**, **Agent API**, orbital strikes.

### 12.1 Raid core
Flow: `api.raid.openConsole({factionId})` (`module.raid-console.js:6693`; smart-routes players into in-flight raids) → session state at `flags.bbttcc-raid.raidSession` (rev-guarded; player writes relay `{t:"raidSession"}` to GM) → per-round maneuver gating → `resolveRoundWithManeuvers` (`raid-roundflags.enhancer.js:34`) or scenario engines → `applyPostRoundEffects` (wrapped by victory/morale enhancers) → world mutations via `api.worldMutation.applyWorldEffects` → war log.
**Maneuver catalog authority** = `compat-bridge.js` `EFFECTS` (`:322`; published `api.raid.{EFFECTS, listEffects}` `:751`), hydrated by JSON loaders (`data/bbttcc_maneuvers_v1_4.json` etc.) + sprint/courtly/balance content enhancers + Character-Option injection (⭐ [Option] entries). Raid types (`raid-maneuvers.js:24`): canonical `violence ⚔ / intrigue 🥷(→Alarm) / presence ♕(→Courtly)`; 11 legacy keys deprecated.
**`_canFactionUseManeuver` gate order** (`module.raid-console.js:7618`): 0 tier SCALE (maneuver tier→faction tier 1/2/3; crew grants arm access, never scale) → 0.1 crew/occult grant short-circuit → 1 doctrine ownership (fail-open at zero doctrine items) → 2 learned/unlock (`flags.bbttcc-factions.unlocks.maneuvers`) → 3 option-derived roster check (early return) → 4 rig-role (rig_combat only). GM bypasses unless `ignoreGM`.
Other API: `canUseManeuver`, `crewGrants{crewMap,occultMap,classMap}`, `TYPES/getTypes/resolveCanonical/getManeuvers`, `STRATEGIC_THROUGHPUT/auditStrategicThroughput` (`strategic-throughput.js:652`), `resolveRaidRound`, `anytimeBudget`, `sceneIntents`, `forcePlanningMode`, `orbitalStrike/orbitalStrikeHex/findOrbitalBunker` (`orbital-strike.js:357`), `openBossBuilder`, `pickTargetHex`.
Hooks: emits `bbttcc:raid:maneuver:fired` (`:1931`), `bbttcc:raid:roundCommit` (`:6591`), `bbttcc:raid:canvasVfx`. Socket branches on `module.bbttcc-raid`: raidSession/raidCinematic/raidPill/raidVfx/infilHook/courtlyHook/siegeRequest(+Result)/siegeSceneSwap/siegeHook/courtlyPlaySecret. Setting: only `bossState`. Activity Planner = `module.raid-planner.js` (strategic-only).

### 12.2 COURTLY subsystem (spec `COURTLY_INTRIGUE_SPEC.md`)
**Influence engine** (`raid-courtly.influence.enhancer.js`) — social combat as HP duel. `api.raid.courtly({attackerId, defenderId, atkInitDip, atkInitSoft, ...})` (`:322`); Influence HP = `10 + dipOP + softOP/2`; four actions/exchange **persuade/inspire/expose(Scandal on hit-by-6+)/intimidate(violence presence bonus, backlash on fail-by-5+)**; round cap 6; Suspicion track 0..10 (≥10 = court collapse). Scenario object (18 methods incl. `step, applyEffects, drawSecret, converseSecret, spendFavorAndBoost, armLastWord, burnScandalScar`) mirrored at `api.raid._lastCourtly` — ⚠ **GM-client only**; non-GM paths need socket relays (only `playSecret` has one). Read-only state mirror on both factions at `flags.bbttcc-raid.courtlyActive`.
Scenario-effect vocabulary (`applyEffects` `:1162`): `suspicionRise/Fall, queueRollMod, queueReroll, queueActionBonus, clearScandal, favorShift, discardSecret, lockSpend, armLastWord, drawSecret, converseSecret, spendFavor, noteForGM, burnScandalScar`. Outcomes: cleanTriumph / tarnishedVictory / publicHumiliation (+3wk `disgracedUntil`) / stalemate / mutualRuin; scars at `flags.bbttcc-raid.scandalScars` (light −2 r1, heavy −3/−1), one-shot `nextCourtlyInfluenceCapDelta`. **`courtlyDoor` flag** `{defenderId, method:"invited"|"conceded", npcName}` — stamped by mal-voice court doors, consumed at scenario creation (invited +2 exch-1; conceded +1, Suspicion starts 1). Courtier favor at actor flag `courtFavor{[factionId]: -3..3}`; courtiers = tokens flagged `tableauActor`.
**Secrets API** (`raid-courtly.secrets.api.js`) — `api.raid.courtlySecrets.{addSecret, playSecret, getSecrets, enforceCap(5), EFFECT_KEYS(15), EFFECT_INFO, describeEffect, normEffectKeys}`. Secrets = feat Items from pack **`bbttcc-master-content.courtly-secrets`**, flag `flags["bbttcc-raid"].secret = {acquisition:"earned"|"stolen", effectKey|effectKeys(compound "a+b" fire in order), raidId, acquiredAt, source{npcActorId,speakerName}}`. Effect keys: `rollPlus2/3, forceReroll, influenceDmg2/3, clearScandal, favorPlus1/2, favorShift, coverTracks, doubleAgent, oppRollMinus2, stirThePot, discardStolen, freezePurse`. Play = handler chain → item deleted → stolen adds +2 Suspicion → **betrayal memory** written to the divulging NPC via `mal.npc.addMemory` + hook `bbttcc:dialogue:secretBetrayed`. Non-GM play relays `{t:"courtlyPlaySecret"}` (activeGM-guarded).
**Acquisition**: `drawSecret` (blind pack draw) · **`converseSecret`** (probes tableau courtiers via `mal.npc.armedSecretCount`; "Work them"/"Listen in" opens a REAL mal-voice conversation — `readTheRoom` = NPC approaches, `eavesdrop` = unobserved, slipped truth = stolen; secret arrives asynchronously through the divulge/approval flow) · outcome awards · maneuvers Read the Room / Eavesdrop / Forged Letter.
**HUD** (`raid-courtly.hud.js`) — three draggable panels (Influence+Suspicion w/ secret DROP ZONE · Courtier Roster w/ GM favor pills · Secrets & Leverage, viewer-scoped, drag-or-click Play), gated on open console + `scene.flags["bbttcc-raid"].tableau.enabled`. **VFX** consumes `bbttcc:courtly:vfx`. Faction-sheet badge strip (Scandal/Disgraced/Inf-delta). **12 courtly anytime maneuvers** (`maneuvers-courtly-content.enhancer.js`: whispered_aside, public_toast, plant_a_doubt, the_last_word (Cosmic Linguist), quote_old_law, read_the_room, stage_distraction, forged_letter, sidle_closer, eavesdrop, call_question, patrons_word, mask_off).

### 12.3 Tableau (`tableau.canvas.js`, spec `TABLEAU_SUBSTRATE.md`)
Forced-perspective canvas substrate; scene opt-in `flags.bbttcc-raid.tableau.enabled`, token opt-in `tableauActor`. Visual-only (`mesh.scale/sort` — never persisted; mechanics untouched). Config: axis y|elevation, frontY/backY, minScale/maxScale, curve, `stageTop/stageBottom` (letterbox band — the REAL art extent), `tokenSize:6`, `baseElevation`. ⚠ depth **multiplies** the texture-fit base scale (`fitScale` `:96`); token Y = CENTER on the line. Auto-enrol + auto-size at `preCreateToken` (1×1 grows to tokenSize; structures exempt). GM Token-HUD 🎭 pin toggle; PIXI front/back/bounds guides.
API `api.raid.tableau.{DEFAULTS, readConfig, enable, disable, sizeExisting, setStageBounds, stageBand, setFrontBack, markActor, setDepth, applyAll, showGuides, hideGuides}` (`:468`). Tuner UI = `bbttcc-master-content/tools/tableau-tune.macro.js` (+elevation variant). Companion `tableau.directional-art.js` (`api.raid.directionalArt`; the module's only two visible settings: swap on movement/rotation).

### 12.4 Siege (15 files; specs `SIEGE_RAID_TYPE_SPEC.md`)
`api.siege.*` (`siege-state.js:661`): state CRUD (`getState/setState/clearState/list`), `makeSiegeState` (layers w/ breach tracking, supply, musters, threat vectors, renewal pool, champion locks, pendingTerms), `bfsSupplyPath` (real BFS hot-replaces Phase-A stub), `validateDepot`, `joinSiege/siegeForFaction/findSiegesUsingHex`, `shaveBuffer/bufferTotal/topUpBuffer/restoreLayers`, champions (`snapshotChampions/applyChampionStatusChange/openChampionDuelDialog`), `convene` (Breach Scene spine: view bound scene + `siegeSceneSwap` broadcast + openConsole + `bbttcc:siege:convene`), `conveneRelief`, `openTrojanHorseDialog`, `formUpBoth/recallMuster`, `clashManeuvers/fireManeuver/resolveClash`, `applyOutcomeWriteback/OUTCOME_MATRIX`, `layerBreaches/breachCurrentLayer`, `bindScene` (`flags.bbttcc-raid.siegeHexUuid`), `previewVfx`, tables `TERRAIN_MODIFIERS/SIZE_PROFILES/...`.
**Siege HUD** (`siege-hud.js`) — appears whenever ≥1 siege active (no console needed): supply/buffer/layers/garrison/champions/muster + GM action strip; non-GM join relays `{t:"siegeRequest"}`. **Siege VFX** (`siege-vfx.js`) — 28 hooks incl. 9 clash beats; Sequencer/JB2A volleys (⚠ fragile post-PIXI-v8 — `siege-bombardment-diag.macro.js` exists for this).

### 12.5 Agent API (spec `AGENT_API_SPEC.md`)
`api.agent.{registerVerb, capabilities, invoke, validateAgainstSchema, registerSocketEnvelope, socketEnvelopes, validateSocketEnvelope}` (`agent-registry.js:363`) — schema-validated verb registry (layers query/simulation/action), telemetry hook `bbttcc:agent:call` on every invoke. ~25 query/sim verbs (`agent-verb-schemas.js`: snapshot, audits, observation, legal actions, travel/raid estimates, candidates, recommendNext, simulate.maneuver, gm.* advisors) + 9 action verbs (`agent-action-verbs.js`: world.setState, faction.setMorale/bumpMorale, stockpile deposit/withdraw/transfer, manifestation.applyDamage, territory.deployHolding/recallHolding). Engine = `bbttcc-agent-api.js` (3.6k lines, reads `bbttcc-campaign` settings cross-module). ⚠ socket envelope registry declares 5 of the 10 actually-handled message types; `validateSocketEnvelope` never called by emitters.

### 12.6 Tools (16; NO DRY_RUN convention here — GM-guards + read-only design instead)
`raid-gauntlet-static-audit` (READ-ONLY sweep for grant orphans/tier sanity/etc.) · `raid-gauntlet-foundry` (forge: idempotent RAIDGAUNTLET test docs) · `raid-gauntlet-runner` (drives live surface under a Dialog autopilot — owner-run) · `setup-raid-test-scenarios` (⚠ mutating, no GM guard; header = best prose description of the maneuver gate order) · `siege-perspicacity-setup` (hardcoded ids) · `end-siege` (the End Siege button the engine never shipped — teardown w/ confirm) · `agent-api-selftest` · `siege-phase-{a,c,d,e,f}-selftest` · `siege-bombardment-diag` · `hammer-of-god` (tactical orbital strike) · `orbital-strike-hex` (strategic).

---

## 13. bbttcc-mal-voice

*The AI voice layer* — BYO-key LLM module, two halves: **voice registry + trigger engine** (Mal, The Watcher, GM Advisor, Faction Advisor, Operator) and the far more finished **NPC dialogue engine** (`npc-dialogue.js`, ~2.8k lines): any non-player-owned token becomes a live conversational NPC with persona assembled at send-time and **Anthropic tool calls as the seam back into game mechanics**.

### API — `game.bbttcc.mal.*`
`settings.{get,set,provider,apiKey,model,endpoint,budget,policy,debug}` (`module.js:132`) · `lore.{getPrimer,getDefault,setOverride,clearOverride,enabled}` (`lore-primer.js:158`) · `providers.anthropic.{call, DEFAULT_MODEL, COST_TABLE, estimateCost}` (`providers/anthropic.js:444`) · `voices.{register,unregister,get,list,enabled,setEnabled,...}` (`voice-registry.js:221`) · `triggers.{fire, defaultContextBuilder, slimSnapshot, truncateForLLM}` (`trigger-engine.js:309`) · `output.{render, beginStream,...}` · **`npc.{talkTo, editPersona, addMemory, nudge, armedSecretCount, setTestChoices, _buildPersonaPrompt, _gatherWorldLore, _gatherDossier}`** (`npc-dialogue.js:2698`).

### Backend
Browser fetch → `api.anthropic.com/v1/messages` (`anthropic-dangerous-direct-browser-access`). Default model `claude-sonnet-5`; per-model request sanitization; prompt-cache blocks (1h on the lore primer — deliberately fat 6.5KB so it clears the cacheable minimum); SSE streaming w/ tool_use reconstruction; retry on 429/5xx and empty-refusal; cost estimator; 200-entry `callLog`.

### NPC dialogue flow (`_send` `npc-dialogue.js:1618`)
Prompt = [lore primer, cached 1h] + [persona, cached] + live tail (STORY MOMENTS / WAYS YOU CAN OPEN / SECRETS YOU GUARD / COURT DOOR / live courtly board / THE ROOM IS LISTENING) + full history. One tool round per message (`toolChoice:"none"` on continuation).
**Persona** (`_buildPersonaPrompt` `:649`): WHO YOU ARE → YOUR STORY → SHARED HISTORY (durable `memories` flag, cap 30) → COMMON KNOWLEDGE (journal `npcCommonJournal`, default "NPC Common Knowledge", 9k chars) → **THE WORD GOING ROUND** (journal `npcWorldDigestJournal`, default **"The Turn Press"**, 4k chars, re-read EVERY send; relayed as neighbor gossip, no "turns/editions") → PEOPLE & PLACES (dossier) → WHAT THE CHRONICLE SAYS (keyword sweep; only FIRED beats when story state available) → YOUR PRESENT MOMENT (authoritative DONE/UNDERWAY/**NOT YET**, overrides everything) → PRIVATE TRUTH → HOW TO SPEAK (anti-confabulation rule 2b `:704`).
**Journal page tags** (`_parsePageTags` `:464`): `@after: <questId|beat:<beatId>>[:completed]` (fails CLOSED — never leaks the future) · `@knownBy: <actor|faction:X|all>` (dossier pages injected whole, tiered personal→faction→all under a 12k budget).
**Speaker identity** (`_speakerActor` `:878`): controlled token → `user.character` → user name; turns stored `"<Name>: <line>"`; recognition = `@knownBy` dossier pages + durable memories (no name-matching gate). Player/NPC boundary by OWNERSHIP (`_refusalReason` `:2353`).
**Tools the model can call**: `divulge_secret` (closed enum of ARMED secrets — GM arms them in the 🧠 persona editor, one per line `Label :: effectKey :: unlock :: truth`; genuine unlock → `_grantSecret` clones from `bbttcc-master-content.courtly-secrets`, stamps `secret.source`, calls `courtlySecrets.addSecret`, marks spent in `persona.secretsUsed`, writes NPC regret/trust memory; GM convos confirm inline, player convos post a GM approval card) · `open_court_door` (stamps `courtlyDoor` on the faction) · `court_notices` (suspicion +1 murmur / +2 stir) · `point_the_way` (mid-conversation doors incl. NPC hand-offs that open the next NPC's window) · `enact_story_choice` (campaign beat pipeline). All fail-soft when APIs absent.
UI: dialogue window; 🧠 persona editor (topics/private truth/drag-drop secret arming — Courtly Secret Forge rows drag onto it); 💬 Token-HUD button; keybind **Y** = speak with hovered NPC (players, no ownership needed); intro-audio on open; 5 chat-card families. `nudge()` = NPC speaks first.

### Settings / tools
World: `apiProvider/apiKey/model/customEndpoint/monthlyBudgetUSD/defaultPolicy/debug` + hidden `registeredVoices/callLog`; `useLorePrimer/lorePrimerOverride`; `dialogueEnactMode/dialogueIntroAudio/npcCommonJournal/npcWorldDigestJournal/npcDialoguePlayers`.
Tools: ~20 GM seeders — world dossier (base + full 41-entity), common knowledge, per-region dossiers (Allesh-Gilliam/Khezek/Lyrenn/Valhaulan/Garden), 4 hex-vignette packs (⚠ each requires its bbttcc-campaign sibling seeder FIRST), rite/seal ending pages (branched via `@after: beat:`), receipts foreshadow, prisoner-rite truths, persona patches, `mal-voice-smoketest`, **`audit-persona-coverage` (read-only, 2026-08-27)** — maps 🧠 persona coverage (topics/truth/armed-vs-spent secrets/court door) across the cast, ranked by story weight (speaker beats ×3 + actors[] refs + scene presence + faction), buckets 🔴 unarmed story NPCs / 🟠 partial / 💤 spent-out / 🟢 armed; console report + GM card. **`seed-persona-wave1` (DRY_RUN, 2026-08-27)** — arms the audit's top canon-grounded targets: Dougan Marsh (full kit incl. doubleAgent feud secret + summit court door), Captain Robot (forceReroll receipt-pattern secret + clean-call door), Road Bandit/Razor Raider light personas on ALL copies, stage-direction notes for the speechless creatures; deliberately skipped Joans/Errata courtiers/Sweet Release pending owner input — resolved by **`seed-persona-wave2-crews` (DRY_RUN, 2026-08-28)**: voice-only personas for Marginalia's six Errata crew/Association echoes, Toblerone's Sweet Release pair (first-draft flavor), and Avuncular Joans (small-talk-as-art, canonizes nothing).

---

## 14. bbttcc-market

Single-file procurement console (`scripts/market.js`, ~2k lines). Faction spends OP/marks on catalog entries of 7 kinds (gear/rig/rig_upgrade/facility/facility_upgrade/hex_asset/actor); **Economic Horizon** pricing (rarity-vs-horizon distance; in-horizon gear can be free "Standard Issue"; artifacts refuse purchase); GM catalog + vendor editor.
API `api.market.{purchase, openMarket, openCatalogEditor, listVendors, listCatalog}` (`:1918-1952`). Purchase validates ALL delivery prereqs before spending (⚠ OP engine has no rollback). Gear delivery via `game.fourththing.stack.orCreate` (`:723`, 2026-08-27) w/ legacy-type coercion + `origin:"vendor"` stamp; **untrained-hands warning chips** on weapon/armor rows via `equipProficiency` (`:1478-1522` — warning, not a block). Settings: `vendors/catalog/lastContext` (hidden). Registers 20+ tips into `game.bbttcc.help` under `"market"`. Faction-sheet header "Market" button. No tools.

---

## 15. bbttcc-onboarding

Diegetic tutorial director — **The Operator** walks a new player through 17 beats (`beats.js:2689`: incarnation → meatsuit → driving (Test Track) → stewardship claim/turn → outfitting → crew_occult → surge → manifestations → combat_sim → travel → 3 raids → proving_trials → final_showdown → graduation) using the player's REAL steward/rig/faction. All scaffolding flagged (`flags["bbttcc-onboarding"].spawned` / `tutorialScene`) so teardown only ever deletes its own.
API `game.bbttcc.onboarding.*`: `settings/user/resolve/wireScene/sceneWiring/setKickoffMap` (`module.js:296`) · `beats.{register,list,get}, start, skip, reset, status, activeRuns, isRunning, ui.*` (`director.js:435`) · `speak/riff/operatorAvailable/screen.*` (`operator-voice.js:277`) · `runAsGM` + relay ops (`relay.js:96`) · **stage.js 30+ staging helpers** (spawnDummy/mintRig/grantOp/spawnFoe/claimHex/setRaidSession/beginShowdownCombat/teardownFinale/cleanup/...) — all privileged ops relay to lowest-id GM · `tours.{register,list,get,start,stop,menu}` + `offerTour`.
**Lane system** (`stage.js`): `activeRuns` world-setting registry, 0.17 lane separation, 15-min staleness — parallel-safe concurrent tutorials. **18 tours** (`tour-defs.js`) — step text reads `game.bbttcc.help` (tours + tooltips = one source). `tour-beats.js` wraps beats to offer tours + resume lines; first-open offers wrap Planner/Raid Console opens. `incarnation-forge.js`: no steward → Sorting Engine Tree Wizard v2; no faction → founding ceremony.
Emits `bbttcc:tour:started/ended`. Settings: `completed/offerOnReady(log-only)/activeRuns/campaignWakeBeatId/campaignResumeBeatId`. Tools: `onboarding-setup.macro.js` (authors tutorial scenes — owner-run), `wire-tutorial-scenes.macro.js` (GUI re-pointer), `tour-menu`, `repair-op-overcap` (report-first).

---

## 16. bbttcc-master-content

The content pack: 11 declared compendia (`ancestries classes subclasses items vehicles npcs npc-abilities doctrines courtly-secrets documentation scenes`) + `packs/_source/` JSON canon (2,034 files) + **tools/ = 202 in-Foundry macros + 12 node scripts** (the authoring/repair toolchain). Runtime script = only `np-ancestries-router.js` (4 non-playable ancestry families → CHAR_OPT_ABILITIES dispatch).
**Pack canon status**: `_source` exported for 10/11 — 🔴 **`subclasses` has NO `_source` export** (LevelDB only). 🔴 **`heritages` LevelDB pack exists on disk but is NOT declared in module.json** (never loads); same for loose-JSON `ancestry_feats`. ~53MB of backup archaeology in the module root (3 archives, stale item packs, a shell-glob-accident directory).
**Tool families** (see survey 2026-08-27 for the full 202-entry catalog): AA animation stampers [DRY_RUN,GM] · **Courtly**: `courtly-secret-forge.macro.js` (interactive secret-template builder — rows drag onto mal-voice personas), `create-courtly-secrets` (3-sample seeder), `seed-courtly-maneuvers` [D] · maneuver catalog/balance sync ×14 · **`tableau-tune.macro.js`** + elevation variant (live tableau tuning panels) · leygates/harvest-node setup · gear/item creators ×20 · rigs/bosses/bestiary seeders ×17 · pricing stamps · class/path/doctrine authoring ×30 (incl. 9 prose-body rewrites) · **`create-starter-kit-manifestations.macro.js`** (seeds the 81 path/doctrine starter-kit manifestations into `items` under "Starter Kits — Path Manifestations", stamped `flags.fourththing.starterKit {path, doctrine, core}`; self-linting, idempotent; consumed by `game.fourththing._progression.grantStarterManifestations`) · effects/triggers/passives stampers · D&D-vocab scrubs (phase 2–7) · ancestry seed-or-scrub consoles · pack plumbing (`compile-loose-packs`, `probe-pack-duplicates`) · targeted playtest repairs · **Steward Gauntlet** 3-phase harness · read-only audits (`audit-aa-coverage`, `price-audit`, `audit-maneuvers-fire-mode`, ...).

---

## 17. bbttcc-sorting-engine

Character creation by **Tree-of-Life quiz**: ten sefirot stations → ~20 answers → 29-trait vector → full build resolution. Two generations both load; **v2 is canonical**.
API: `game.bbttcc.sortingEngineV2` (`bbttcc-sorting-engine-v2.js:436`: `scoreQuiz, resolveCategory/Alignment/Ancestry/Occult/Philosophy/Archetype/Crew/Class/Doctrine, runFullDescent, computePillarTally(mercy/severity/neutral pillar readout), assembleWizardInputs, writePillarTally(seeds AAE drift)`) · **`game.bbttcc.openTreeWizardV2(actorOrNull)`** (`wizard-v2:2535`; Descent → Review ("Your descent suggests…", overridable) → Finalize; applies via auto-link's `runGuidedCreatePipeline`) · `game.bbttcc.dumpSEPacks` diagnostic. Spec `data/bbttcc_sorting_engine_v2_full_spec.json` (resolver order alignment→ancestry→occult→philosophy→archetype→crew→class→doctrine; heritage + faculties deliberately player-picked, Option B 2026-04-23). Consumers: onboarding incarnation-forge, auto-link Create button. 🟡 whole v1 generation (`api.sorting.*`) loads with zero consumers.

---

## 18. bbttcc-aae

*Adaptive Adversary Engine* — faction moral/political model. **Live layer**: 8 hardcoded political philosophies (`POLITICAL_PHILOSOPHIES` `module.js:31`) stored at `flags.bbttcc-aae.politicalPhilosophy`; **drift pipeline** `applyPoliticalImpact({factionId, actorIds, tags, source})` (`:448`) scores policy tags vs roster philosophy distribution → `driftScore` −100..100 (called by bbttcc-campaign `:3589` — "🗳️ Political Pressure" cards). API `game.bbttcc.api.aae.{listPoliticalPhilosophies, get/setPoliticalPhilosophy, getPoliticalTagCatalog, readFactionDriftState, writeFactionDriftState, applyPoliticalImpact}` + 🟡 dead Moral Profile POC (`generateMoralProfile/getMoralProfile/suggestPreferredOps` — zero callers). No hooks, no UI, no settings, no tools. ⚠ Philosophy flag read directly (not via API) by bridge/raid/factions/auto-link; sorting-engine wizard ships stub descriptions with a "wire pending" TODO.

---

## 19. bbttcc-auto-link

*Character Builder* v0.8.2 (name is legacy) — actor-creation surface + character-sheet layer. Four "Create …" directory buttons (RFI Character→Tree Wizard v2, NPC, Monster, Rig; native Create hidden); three authoring dialogs; two marker sheet subclasses ("Bad Eden Character/NPC Sheet"); DOM-injected **Bad Eden Identity tab** (identity dropdowns, enlightenment, Tikkun sparks read-only, ▶ Use feature buttons, aptitude-grant repair) + multi-sheet tab healer.
API: `api.autoLink.{runGuidedCreatePipeline(vestigial), getGuidedState, inspectIdentity}` · `api.npcBuilder.{open, mintEchoMember, mintEchoRoster}` (`npc-builder.js:1066`) · `api.monsterBuilder.{open, categories, templates}` · `api.rigBuilder.{open, seedFromActor, mintFromChassis, computeRigCost}` (`rig-builder.js:1844`). Emits `bbttcc:enlightenmentChanged` (🟡 zero listeners). Global aptitude guard normalizes `downgrade→upgrade` on skill grants (`character-wizard.js:55-80` — the live part of that file). Creation wizard auto-grants the path/doctrine starter manifestation kit post-import via `game.fourththing._progression.grantStarterManifestations` (3 items non-TCC / 8 TCC; soft no-op on pre-kit system builds). Tool: `backfill-monster-creaturetype` [DRY_RUN=true].

---

## 20. bbttcc-character-options

v1.2.0 — owns character **identity** (archetype/crew/occult/political/alignment/enlightenment), the **Tier Engine** (tiered feat sync to level), the OP scanner (9 buckets off items+AEs), and the **enlightenment ladder** (one reconciled AE, Clarity aura to nearby friendlies, once-per-Soma-Break **Minor Miracle**). 7 compendium packs.
API: `api.characterOptions.{recalcActor, recalcAll, refined{data,getOwnedOptionCounts,getUnlocksForActor}}` (`module.js:41-68`) · `api.identity.{getIdentityFlags, setIdentityFlags, syncOptionTiers, getTierForLevel}` · `api.enlightenment.{miracle, canMiracle, miracleAvailable}` (`enlightenment.js:423`). Emits `bbttcc:opsRecalculated`. Sheet row `#bbttcc-enlightenment-row` + ✦ Minor Miracle button (routes through `castManifestation({miracle:true, freeClarity:true})`). No settings.
Tools (8): enlightenment gauntlet ×3 (static-audit read-only / forge / runner) · `animate-occult` [D=true] · `convert-npcs-to-callings` [D=true] · `repair-aptitude-grants` · `fix-aptitude-grants-everywhere` (also fixes source packs) · `repair-rank-inflation` [D=true].
🟡 Perk backlog: enlightenment AE flags `opRegenBonus/healingHalved/darknessSpikes` written but implemented nowhere (only `auraClarity` + `minorMiracles` live). `refined-options` data = "no mechanics yet".

---

## 21. bbttcc-epic

*Epic Play* v0.1.0 — the **level 18–30 endgame**, fourththing-only, namespaced **`game.fourththing.epic`** (deliberate). P1 **The Gate**: Convergence when level ≥18 AND enlightenment apex (`enlightened`→keter / `qliphothic`→thaumiel), latched at `flags.bbttcc-epic.converged`, one-time beat, hook. P2 **Presence**: per-steward heat/notoriety (`flags.bbttcc-epic.presence{value,masked}`), faction aggregation, masking, bands. P3 **Repair**: World Health from protagonist-aligned hexes, Malkuth seam at 100%, `alignHex`/`integrateSpark` actions paying Presence.
API: `epic.{isConverged, convergencePath, computeConvergence, epicBand, evaluate, resetConvergence}` (`epic-gate.js:223`) · `epic.presence.{get, isMasked, adjust, set, mask, unmask, partyTotal, hunted, band, sync}` (`presence.js:247`) · `epic.worldHealth`, `epic.repair.{alignHex, integrateSpark, reach, worldHealth}` (`repair.js:266`).
Emits `bbttcc:epic:converged / :presence:changed / :malkuthAligned` (🟡 zero external listeners); listens `bbttcc:territory:hexUpdated`, `bbttcc:advanceTurn:end`, `bbttcc:spark:deposited/repaired`, `bbttcc:spark:hexSeated/hexIntegrated` (tikkun-hex: world-health refresh + Presence credit). UI: Ascension sheet panel, faction Presence chip, World-Health chip on Campaign Overview. Hidden settings `protagonistFactions/malkuthAligned`. Specs `~/EPIC_P*_SPEC.md`. 🟡 `alignHex/integrateSpark` have no UI callers; `ascent` band computed but unused (release 2).
**P3.1 (2026-09-01)**: `boardScenes()` — worldHealth counts only scenes flagged `bbttcc-epic.boardScene` (the 5 canonical region scenes = 141 hexes; stamp via `tools/mark-canonical-board.macro.js`; falls back to all scenes if none flagged). `isHexAligned` trump: a hex whose `flags.bbttcc-territory.spark.state === "integrated"` counts aligned regardless of banner or darkness (owner ruling).
**A1 — THE GAZE (2026-09-02, `adversary.js` + repair.js; `DESCENT_ENGINE_SPEC.md` Part II, 8 rulings locked)**: Reach ENFORCED — `reachBudget(fid)`/`tryDebitReach(fid)` (exported + on `epic.repair`), budget = `REACH_BY_BAND[band]` Acts of Repair per faction per Apply turn (`flags.bbttcc-epic.reachSpent`, reset by GM-gated advanceTurn listener; tikkun-hex `integrate` shares the budget). Presence economics: masked repairs earn half (round up), Shadowed+ darkness dims −1 (`effectiveRepairPresence`). **Boiling Point**: world setting `bbttcc-epic.boilingPoint` = bandPoints + 3×temples + wh%/10 + 5×Lamps, recomputed each Apply turn by the active-GM writer; 1d100 ≤ BP fires escalation (A1 = omen cards at all tiers; hunter/reprisal/corruption/fracture events = A2). API `epic.adversary.{boilingPoint, compute, census}`. Emits `bbttcc:adversary:boiled/:event`. Tool: `descent-selftest.macro.js` (read-only).

---

## 22. bbttcc-fx-integration

*Combat FX* v0.1.0 — keyed FX registry (banners/overlays/shake/canvas pulse/JB2A bursts with fallback chains) + engine + API, plus raid-console patch, `territory.advanceTurn` wrap, Tier-A class VFX (listens `fourththing:itemAnimated`), JB2A DB self-heal (re-fires `sequencer.ready`), AA crash shim.
API `game.bbttcc.api.fx` (alias `game.bbttcc.fx.api`; surface `api/fx-api.js:505-528`): `playKey, playRolls, playScenarioShift, playTurnPresentation, playHexActivity, playSequencerEffect, register, get, effectForFamily, burstForFamily, keyExists, resolveKey, normalizeRaidType, raidToneForType, durationForKey, ...`. Consumers: raid (console, courtly, infiltration, throughput), territory turn-driver, travel scene-transition.
🔴 **Settings namespace bug**: 4 client settings registered under `"bbttcc-fx"` (`core/fx-settings.js:2`) but module id is `bbttcc-fx-integration` → reads throw, swallowed, module runs on hardcoded defaults; all user toggles inert (Appendix A #7). Tools (3): `probe-jb2a-keys` / `selftest-fx-jb2a` / `verify-doctrine-vfx` (read-only; FIRE_SAMPLES opt-in).

---

## 23. bbttcc-radiation

v13.1.16 — RP as a REAL debuff. P1 environmental (travel legs, scene fallout **zones** with drift + tinted overlay, per-turn exposure); P2 (`radiation-effects.js`) the 5-rung sickness ladder Clean/Irradiated25/Sickened50/Poisoned75/Terminal100 (`rollPenalty/integrityCap/loseReaction/loseAction/tick`), mirrored as real token-HUD conditions; band crossings roll **double-edged mutations** (boon+bane AE pairs).
API `api.radiation.{get, set, add, levelFor}` (`api.radiation.js:87`) · `tierFor/tiers/sync` (`radiation-effects.js:129`) · `zone.{getScene,setScene,clearScene}` (`zone.enhancer.js:127`; scene flag `{intensity,drift,color,radius}`) · `mutations.{list,add,remove,clear}` (`mutations.enhancer.js:195`). Storage: `system.radiation.rp` (fourththing) w/ one-time flag→system max-merge migration (`rpStoreUnified` latch). Emits **`bbttcc.mutationRoll`** (⚠ dot namespace). Listens `bbttcc:afterTravel`, `bbttcc:advanceTurn:end` (turn exposure: PCs half RP floored, −1 in safe areas). Sheet tab `bbttcc-radiation`; zone overlay; GM mutation cards. Settings: `enableAutomaticTracking` (🟡 read nowhere), `enableZoneDrift`, `showZoneOverlay`, hidden `rpStoreUnified`. No tools.
🔴 Duplicate ladders: fourththing `_ftRadiationBite` (`module.js:10040`) duplicates the tier table; comment claims it reads `tierFor()` — it doesn't (Appendix A #8).

---

## 24. bbttcc-tikkun

*The Great Work* v13.1.16 — spiritual victory condition. 30 Sparks of Light (10 sephirot × 3 kinds, pack `bbttcc-tikkun.sparks`) through identify → acquire → integrate → deposit; **method alignment** (misaligned gather corrupts; corrupted sparks block readiness and need **repair**: materials + OP + 2d10 ritual, DC drops per partial attempt); culminates in a 3-round **Final Ritual** (Invocation→Contact→Integration → faction VP/unity/darkness).
API `api.tikkun.*` (`api.tikkun.js:541`): `hasSpark, gatherSpark(+ByItem), resolveSparkItem, checkMethodAlignment, SEPHIRAH_METHOD_ALIGNMENT, getAllSparks, createConstellationForActor, markSparkPhase, identifySpark/acquireSpark/integrateSparkCharacter, depositSpark, getGreatWorkState(+ForAllFactions)` · faction `listSparks/integrateSpark/revokeSpark` (sparks.enhancer) · `beginRitual` + `_lastRitual` (ritual.enhancer `:206`) · `openRitualConsole` (`tikkun-ritual-console.js:243`) · `openRepairLedger/openRepairRitual/openDepositLedger` (`tikkun-repair.enhancer.js:553`).
Emits `bbttcc:spark:{corrupted, deposited, repaired}` + **`bbttcc:spark:{hexSeated, hexIntegrated}`** (tikkun-hex). Listens **`bbttcc:beat:resolved`** (routes `beat.sparkLink` → spark API; payload schema at `tikkun-beat-listener.enhancer.js:11-19`) + `bbttcc:advanceTurn:end` (hex-spark yield, gates apply+isGM). UI: character-sheet tab, GM faction-sheet "⚒ Spark Repair Ledger" / "→ Pending Deposits" buttons, Ritual Console AppV2, corruption flavor cards. No settings.
**Sparks-in-the-world (2026-09-01, `tikkun-hex.enhancer.js`)**: hex Drawing anchor `flags.bbttcc-territory.spark {key, state: dormant|integrated, at}`; API `game.bbttcc.api.tikkun.hex.{seat, unseat, integrate, at, all, SEPHIRAH_CHANNEL}` (GM verbs); integrated spark on a faction-owned hex pays +1 OP/turn into its sephirah's channel (marks via `api.op.commit`, one commit per faction, GM-whispered report; sephirah→channel map owner-tunable in-file). Alignment trump lives in bbttcc-epic `isHexAligned`. Seeding: `tools/seed-hex-sparks.macro.js` [DRY_RUN=true, ⚠ placement ruling pending — `SPARK_SEEDING_2026_09_01.md`].
Tools (5): `load-sparks-pack` ⚠ **DRY_RUN=false (armed)** · `seed-hex-sparks` [DRY_RUN=true] · tikkun gauntlet ×3 (static-audit read-only / forge / runner). ⚠ Structural smell: three files race to populate one namespace (api/hotfix/enhancer, all install-if-absent).

---

## 25. surge-powers

**⚠ NOT Bad Eden.** Standalone dnd5e module v1.2.0 for the **Kaeron War / Angaria** world (`the-third-kaeron-war` on the `foundry` instance). Global `game.surgePowers` (`get/max/grant/spend/set/openMenu/menu/applyEntry/profOf/editPool`). Pool at `flags.surge-powers.value`, max 2×prof (min 4). Fill: kept d20 ≥ threshold(15) +1, nat-20 explodes, **cast +2** (`dnd5e.postUseActivity`), **combat start +1** (GM-gated `combatStart` + `createCombatant` late-join guard), long rest +prof. Spend: 23 universal powers, minProf gates. ⚡ Token-HUD + sheet-header button (left-click menu / right-click editor). Settings ×6 world-visible. No BBTTCC references in either direction.

---

## Appendix A — Dormant / Broken registry

*The "what we're both forgetting" list. 🔴 = broken wire (should fix) · 🟡 = dormant (decide: wire, keep as future seam, or delete). Retire lines when resolved.*

### 🔴 Broken wires — OPEN
4. **DESIGNED (2026-09-01): `~/DESCENT_ENGINE_SPEC.md`** — the Negredo arc (personal Darkness engine + Epic P4 Adversary/Boiling Point + Ego-Dragon Final Ritual + Reformation Outcome) specced as one arc with build order D1→G3; ⚖ 8 owner rulings pending before D1. `system.darkness{value,taint,fragments}` remains reader-less until D1 ships; `darknessSpikes` closes in D3; Radiation stays the reference ladder pattern.

### ✅ Broken wires — FIXED 2026-08-28 (deployed both instances + restarted)
1. ~~actor-kind.js not in esmodules~~ — **false alarm**: ES-imported by `module.js:173` + `migrations/index.js:32`; manifest-invisible but fully live.
2. ~~`resetLegendaryOnSceneChange` never fires~~ — added to the ft-progression import and the `_progression` export object.
3. ~~`species` missing from system.json itemTypes~~ — added (constructor validates against this list, per `module.js:22700` comment).
6. ~~socket envelopes 5/10 declared~~ — all 11 message types now declared in `agent-socket-envelopes.js`; **raidPill schema corrected** (handler reads `key/label/raidType`, never `text`).
7. ~~fx settings namespace~~ — `MOD` fixed to `bbttcc-fx-integration` in `fx-settings.js` + `fx-engine.js`; the four client FX toggles now function.
8. ~~radiation ladder duplication~~ — `FT.RADIATION_BITE` declared the single source of truth (stale comment fixed); module TIERS now syncs its mechanical fields FROM the system table at ready (labels + Clean rung stay local).
9. ~~contested-takeover mislabel~~ — removed from raid module.json esmodules (was a Fortify-Hex re-wrap risking a double defense-queue; file kept on disk, unloaded).
11. ~~campaign ledger phase-door pre-GM-gate~~ — GM gate moved above the Phase Charter calendar-door block in `_onAdvanceTurnEndLedger`.
12. ~~`bbttcc:enlightenmentChanged` orphan~~ — reclassified: it's telemetry, not broken; tracked as dormant (#17 family).
10. ~~two parallel beat injectors~~ — **RULED: travel's is canonical.** autoDebt tag synthesis, the `inject.requires` Story Director gate (via `api.campaign.gates.requiresMet`), foreshadow +15 scoring, and the GM debt prompt (per campaign:hex:beat decline gate, falls through to next candidate; non-GM clients skip debt beats) are now IN travel's `maybeInject` (`hex-travel.js`, helpers near `_beatTags`). Campaign's `injector.fire` stays as a **manual GM console tool**, annotated deprecated; its three trigger-hook listeners remain emitter-less by design.
13. ~~faction tier-advancement dormant~~ — **RULED: wired on.** `faction-tier-stability` / `-advancement-api` / `-advance-button` added to bbttcc-factions module.json `scripts` (after victorygate). Stability accrues on Apply turns (GM-gated, reads the pressure enhancer's flags); `api.factions.{getTierAdvancementReport, canAdvanceTier}` live; GM Advance Tier button raises opCaps to the marks band.
14. ~~two world-state spines~~ — **RULED: bbttcc-world canonical.** `api.gm.setWorld` now mirrors `turn.number`/`world.darkness` writes into `api.world.applyGMEdit` after its own store+audit, so the spines can't disagree; core's store remains for audit continuity + legacy readers. (One-way: api.world writes do NOT mirror back — read world state from `api.world.getState()`.)
15. ~~master-content pack gaps~~ — **double false alarm.** The 27 subclass docs live in the `classes` pack (which IS `_source`-exported); the `subclasses` pack is EMPTY in repo AND on both live instances (verified by fvtt extract 2026-08-28) — a vestige, nothing to preserve. Heritages likewise live in the `ancestries` pack (56 `_source` files); `packs/heritages/` is superseded loose-JSON source material, not a functioning pack — all code reads `bbttcc-master-content.ancestries`. Do NOT declare either. (The ~53MB backup archaeology in the module root remains a tidy-up candidate.)
16. ~~structures harden/repair "stubbed"~~ — the header comment was stale: all three dialogs (Harden/Repair/Reclamation) were fully implemented — but DEAD, because the faction picker filtered `type === "character"` while factions are `type:"npc"` + flag. Filter fixed to `isFaction` flag (both dialogs); header corrected.

### ✅ Dormant items resolved 2026-08-28 (deployed both + restarted)
17. **Advisor voices wired** (new `bbttcc-mal-voice/scripts/advisor-triggers.js`): manual consults always on — `game.bbttcc.mal.advisors.{gm({mode}), faction(id)}`, 🕯 Advisor button on faction sheets (GM + owners), `tools/consult-gm-advisor.macro.js` hotbar macro; ambient fires (scene-enter → GM Advisor, sheet-open → Faction Advisor, 60s voice debounce) behind world setting `advisorAmbient`, **default OFF** — every fire is a real API call. `bbttcc:faction:opChanged` (too noisy to pay for) and `bbttcc:raid:initiate` (belongs to bbttcc-raid) deliberately stay unemitted.
20. **Epic Acts of Repair surfaced**: converged Stewards' Ascension panel now has ⚒ Align Hex (GM hex-picker dialog, NBSP-safe names, unaligned-first) and ✨ Integrate Spark (opens tikkun's Deposit Ledger — Presence credit flows through the deposit hook).
21. **Enlightenment perks closed out**: `opRegenBonus` (0.10) implemented — advanceOPRegen wrapper in `enlightenment.js` grants +10% of the regen that actually landed (snapshot-delta, cap-respecting via `op.commit`) to factions with an enlightened roster member; `healingHalved` was **already live** (system heal path reads the qliphothic level, `module.js:15238` — the AE flags are markers, mechanics read levels); `darknessSpikes` deferred with the Darkness arc (#4).
23/27/28/29. **Housekeeping deletes** (git rm, recoverable): campaign `scripts/module.j` + `world-mutation-engine.j` + `scripts/campaign-table-editor.js` (dead dup of `apps/`), factions `faction-meters.js`, territory `hex-config-build-units.enhancer.js`, auto-link `sidepanel.js` (also unloaded from manifest), tikkun `scripts/module.js` empty shell (also unloaded — ritual-console self-initializes `mod.api`).
24-partial. `runGuidedCreatePipeline` was a **false alarm** — sorting-engine's wizard-v2 applies through it (`wizard-v2:1684`); it's the live apply path, not dead.

### ✅ Cleanup pass 2026-08-28 (round 2)
- mal-voice: provider choices trimmed to Anthropic only (the three phantom options + inert `customEndpoint` setting removed; `mal.settings.endpoint` kept, returns "").
- Radiation: empty `RadiationTracker`/`RadiationZoneConfig` shells, `openRadiationTracker`, the never-read `enableAutomaticTracking` setting, and both orphaned templates removed (also fixed a latent `mod.api` overwrite race with `RadiationAPI`).
- Campaign `bbttcc-rolls-api.js` deleted (zero consumers) — import removed from module.js.
- aae Moral Profile POC methods removed from the public API (internal tables retained; old `moralProfile` actor flags inert).
- master-content: ~16MB of untracked backup archaeology (5 archives, 2 backup dirs, 2 manifest baks, 3 stale item packs, glob-accident dir, BBTTCC stub) tarred to `~/badeden-attic/bbttcc-master-content-attic-2026-08-28.tar.gz` and deleted from the module.
- Structures manifest: vestigial `"socket": true` removed; description updated from "Phase A" to reality.
- NEW `bbttcc-raid/tools/courtly-selftest.macro.js` — read-only courtly wiring self-test (API surface, EFFECT_KEYS↔INFO parity, pack health + per-doc effect-key validity, 12 maneuvers registered/tagged, socket envelopes, mal-voice seams, scandal-flag shapes).

### 🟡 Dormant — still actionable (feature-sized, unscheduled)
- mal-voice: `sheetPopup`/`tokenSpeechBubble` output channels stubbed; `monthlyBudgetUSD` advisory-only (no enforcement).
- char-options `refined-options`: Slice-1 data, "no mechanics yet".
- raid `queue-drawings.consumer`: legacy-gated hard stop — retire or revive with the queue system.

### 📦 By design / legacy-kept (reclassified 2026-08-28 — not defects)
- Encounters legacy Encounter→Scenario registry + `testFire` + single hardcoded SPAWNERS entry + unread archetype metadata: documented retirement path — reachable only for beat-less travel encounters, warns on use. Remove once all travel encounters are campaign-authored.
- Sorting-engine v1 generation: superseded by v2, kept for console BC (`api.sorting.*`). Delete when confident.
- Travel planner pill: deliberately killed (console is canonical); `api.travelPlanner` API kept for future use. `_maybeAutoScoutSigns` stub: superseded by campaign Scout Signs tables.
- Epic `ascent` band (L21–30): reserved for release 2. Epic hooks + `bbttcc:enlightenmentChanged` + `bbttcc:dialogue:secretDivulged`/`courtDoorOpened` + `bbttcc:chase:resolved` + `bbttcc:tour:started`: **telemetry seams** — emitted for future consumers, harmless.
- tikkun hotfix + sparks-enhancer install-if-absent guards: deliberate race-safety nets.
- Territory `main.js` hex-sheet class: superseded by the enhancer (ready wins); `encounters.js` retired shim kept so legacy callers don't crash; build-unit "asset" action: documented placeholder for the future asset system.
- Banks coalition vault + thin marks channel: Phase 2 scaffold by design.
- auto-link native sheet templates: documented dead code (all Bad Eden UI is DOM-injected) — delete candidates when convenient.
- raid `bbttcc:raid:published` ghost listener + `bbttcc:courtly:scarAccrued` doc-example: harmless declared intentions.

---

## Appendix B — Hook census highlights

**The spine hooks** (emitter → key consumers):
- `bbttcc:advanceTurn:end {apply}` (territory turn-driver) → system reminder card, campaign ×6, world-digest/Turn Press, world-mutation OP schedules, travel weather tick, radiation exposure, factions momentum/pressure/victory, epic world-health, facility turn effects. **ALL new listeners: gate on `apply` AND `isGM`.**
- `bbttcc:beat:resolved {campaign, beat, ctx, outcome}` (campaign `module.js:3748`) → tikkun sparkLink, territory gate-unlocks, travel chase seam, onboarding handoff, campaign's own 10 meter subscribers, builder refresh.
- `bbttcc:afterTravel` (travel) → encounters arbitration (GM-gated), radiation, mitigation drain, campaign ledger+director.
- `fourththing.manifestationCast` / `fourththing.overshoot` / `fourththing:itemAnimated` (system) → campaign adversary draw, mal-voice Watcher, fx class VFX, onboarding gates.
- `bbttcc:raid:roundCommit` (raid) → system, campaign director, mal-voice Mal.
- `bbttcc:courtly:state` / `:vfx` (raid, socket-relayed) → courtly HUD, mal-voice live court board.

**Orphans** (emitted, never consumed): `bbttcc:enlightenmentChanged`, `bbttcc:epic:*` ×3, `bbttcc:dialogue:secretDivulged`, `bbttcc:dialogue:courtDoorOpened`, `bbttcc:chase:resolved` (informational), `bbttcc:time:accrued` → campaign ledger (consumed — OK), `bbttcc:tour:started`.
**Ghosts** (consumed, never emitted): `bbttcc:raid:published`, `trigger.travel_threshold` family, `bbttcc:gm:advise` / `bbttcc:scene:enter` / `bbttcc:faction:sheetOpened` / `bbttcc:faction:opChanged` / `bbttcc:raid:initiate` / `bbttcc:manifestation:cast` / `bbttcc:courtly:scarAccrued` (mal-voice trigger declarations).

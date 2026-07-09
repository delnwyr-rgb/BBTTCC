// modules/bbttcc-territory/scripts/bbttcc-hex-sheet.enhancer.js
// Bad Eden — Hex Sheet 3.4 (syntax-safe AppV2; no optional chaining / nullish / spread)
//
// API: game.bbttcc.api.territory.openHexSheet(hexUuid)
//
// Notes:
// - Full replacement. Fixes prior bad-token insertion that caused parse failure.
// - GM edit UI for Hex Configuration lives in hex-config enhancers; this sheet remains a read/inspect surface.

(() => {
  const MOD_T = "bbttcc-territory";
  const TAG   = "[bbttcc-hex-sheet]";

  const api = (foundry && foundry.applications && foundry.applications.api) ? foundry.applications.api : null;
  const ApplicationV2 = api ? api.ApplicationV2 : null;
  const HandlebarsApplicationMixin = api ? api.HandlebarsApplicationMixin : null;

  function log()  { console.log.apply(console, [TAG].concat([].slice.call(arguments))); }
  function warn() { console.warn.apply(console, [TAG].concat([].slice.call(arguments))); }

  function ensureNS() {
    if (!game.bbttcc) game.bbttcc = { api: {} };
    if (!game.bbttcc.api) game.bbttcc.api = {};
    if (!game.bbttcc.api.territory) game.bbttcc.api.territory = {};
    if (!game.bbttcc.apps) game.bbttcc.apps = {};
    if (!game.bbttcc.apps.hexSheets) game.bbttcc.apps.hexSheets = {};
  }

  async function resolveHexDoc(uuid) {
    if (!uuid) return null;
    const raw = String(uuid);
    const parts = raw.split(".");

    if (parts[0] === "Scene" && parts.length >= 4) {
      const sc = (game.scenes && game.scenes.get) ? game.scenes.get(parts[1]) : null;
      if (sc) {
        if (parts[2] === "Drawing") return (sc.drawings && sc.drawings.get) ? (sc.drawings.get(parts[3]) || null) : null;
        if (parts[2] === "Tile")    return (sc.tiles && sc.tiles.get) ? (sc.tiles.get(parts[3]) || null) : null;
      }
    }

    const scenes = game.scenes ? Array.from(game.scenes) : [];
    for (let si = 0; si < scenes.length; si++) {
      const sc = scenes[si];
      const drawings = (sc && sc.drawings && sc.drawings.contents) ? sc.drawings.contents : [];
      for (let i=0;i<drawings.length;i++) if (drawings[i] && drawings[i].uuid === raw) return drawings[i];
      const tiles = (sc && sc.tiles && sc.tiles.contents) ? sc.tiles.contents : [];
      for (let j=0;j<tiles.length;j++) if (tiles[j] && tiles[j].uuid === raw) return tiles[j];
    }
    return null;
  }

  function pips(value, max) {
    const v = Math.max(0, Math.min(max, Number(value || 0)));
    let s = "";
    for (let i=0;i<max;i++) s += (i < v) ? "⬢" : "◌";
    return s;
  }

  // Radiation severity band (mirrors main.js `_radTier` + the HEX_TIPS copy):
  // I at 1–2, II at 3–5, III at 6–9, IV at 10+; "—" when clean.
  function radTier(rad) {
    const r = Math.max(0, Math.round(Number(rad) || 0));
    if (r <= 0) return "—";
    if (r <= 2) return "I";
    if (r <= 5) return "II";
    if (r <= 9) return "III";
    return "IV";
  }

  // Canonical pressure stores are flags.bbttcc-territory.mods.radiation and
  // .mods.darkness — that's what the turn engine (advance-turn.tracks.js
  // decay/spread, api.turn.processRequests.js) reads and writes. Older hexes
  // may only carry the legacy shapes main.js once wrote
  // (radiation.value / darkness.local); read those as a one-time fallback so
  // old hexes don't display zero. Writes always land on mods.*.
  function readRadiation(tf) {
    const mods = (tf && typeof tf.mods === "object" && tf.mods) ? tf.mods : {};
    if (mods.radiation !== undefined) return Math.max(0, Number(mods.radiation) || 0);
    const legacy = (tf && tf.radiation && typeof tf.radiation === "object") ? tf.radiation.value : (tf ? tf.radiation : 0);
    return Math.max(0, Number(legacy) || 0);
  }

  function readDarkness(tf) {
    const mods = (tf && typeof tf.mods === "object" && tf.mods) ? tf.mods : {};
    if (mods.darkness !== undefined) return Math.max(0, Number(mods.darkness) || 0);
    const legacy = (tf && tf.darkness && typeof tf.darkness === "object") ? tf.darkness.local : (tf ? (tf.localDarkness ?? tf.darkness) : 0);
    return Math.max(0, Number(legacy) || 0);
  }

  function _safeHexSheetId(hexUuid){
    try {
      var raw = String(hexUuid || '');
      // Prefer the tail id (Drawing/Tile id) for shorter window ids.
      var parts = raw.split('.');
      var tail = parts.length ? parts[parts.length - 1] : raw;
      tail = String(tail).replace(/[^A-Za-z0-9_-]/g, '_');
      if (!tail) tail = raw.replace(/[^A-Za-z0-9_-]/g, '_');
      if (tail.length > 48) tail = tail.slice(0, 48);
      return 'bbttcc-hex-sheet-' + tail;
    } catch (_e) {
      return 'bbttcc-hex-sheet-' + String(Date.now());
    }
  }

  function _readWorldTurn() {
    try {
      const w = game && game.bbttcc && game.bbttcc.api ? game.bbttcc.api.world : null;
      if (w && typeof w.getState === "function") {
        const st = w.getState() || {};
        const t = Number(st.turn || 0);
        if (Number.isFinite(t) && t >= 0) return Math.floor(t);
      }
    } catch (e) {}
    return 0;
  }

  function _classifyModifier(mod, curTurn) {
    const enabled = (mod && mod.enabled !== false);
    const exp = Number(mod && mod.expiresTurn ? mod.expiresTurn : 0) || 0;
    const expired = (exp > 0 && curTurn > 0 && curTurn >= exp);
    return { enabled, expired, exp };
  }

  /* ============== Help / tooltip dictionary (central registry) ==============
     Registered into game.bbttcc.help (bbttcc-core) under appKey "hex" at ready.
     Consumed three ways:
       - templates:   data-tooltip="{{bbttccTip 'hex' '<key>'}}"  (hex-sheet.hbs)
       - JS DOM:      _hexTipApply(el, "<key>")  (Active Effects chips, Quests card)
       - tours:       inert data-tour="hex.<key>" anchors use the same keys.
     Style: "Name — what it is. What it does mechanically. When/why you'd use it."
     Numbers below are read from the actual engines: advance-turn.tracks.js
     (radiation decay/spread, darkness, Purified cleanup, BU accrual),
     territory-build-units.enhancer.js (BU costs/effects), main.js
     (production trace, radiation tiers, size/integration multipliers),
     hex-resource-nodes.enhancer.js (harvest), and the Holdings tables above. */
  const HEX_TIPS = {
    // ---- Identity / sidebar ----
    art:       "Hex Artwork — a portrait image for this territory, stored on the hex. Click to view it full-size; the GM can click to set or replace it.",
    identity:  "Hex identity — name, size, and type. Type sets the hex's base resource pips; size multiplies them (outpost ×0.5, village ×0.75, town ×1, city ×1.5, metropolis ×2, megalopolis ×3).",
    status:    "Status — the hex's claim state (unclaimed until a faction takes it). Claimed hexes feed their owner's OP income every turn and can be engineered with Build Units.",
    owner:     "Owner — the faction that controls this hex. The owner collects its resource yields as OP each turn, earns Build Units from its Materials pips, and defends it when raided. Unclaimed hexes pay no one.",

    // ---- Holdings ----
    holdings:          "Holdings — rigs, bosses, and facilities stationed at this hex. Each adds a strategic bonus to the defender's DC when this hex is raided, and the GM can deploy them as linked tokens onto a bound battle scene for tactical play.",
    holdingsBonus:     "Total Holdings bonus — the summed defender-DC bonus from everything stationed here. The rigs lane and the facilities lane are each soft-capped at +15; boss bonuses stack uncapped.",
    holdingsBosses:    "Bosses — stationed boss actors. Bonus scales with the boss's tier: T1 +2, T2 +4, T3 +6, T4 +10. Bosses also lend their doctrine keys to the hex's defense.",
    holdingsRigs:      "Rigs — mobile rigs stationed here. Bonus by weight bracket: light +1, medium +3, heavy +5, siege +8 (personal rigs add nothing). This lane is soft-capped at +15 total.",
    holdingsFacilities:"Facilities — stationary rigs stationed here. Bonus by kind: garrison/fort +5, hex-cannon +5, forge +3, trade/market +2, anything else +1. This lane is soft-capped at +15 total.",
    holdingsMissing:   "Stale reference — a stationed actor that no longer exists in the world (deleted). It contributes nothing; the GM can clear it with ×.",
    holdingsStation:   "GM — Station: pick rigs, bosses, or facilities from the world roster and station them at this hex. The owning faction's assets are listed first; other factions' assets sit under an expander.",
    holdingsDeploy:    "GM — Deploy: spawn every stationed Holding as a linked token on this hex's bound battle scene (bind one via the Battle Scenes panel first). Linked tokens write damage back to the real actor, so hurt persists across rounds and scenes.",
    holdingsRecall:    "GM — Recall: remove this hex's previously deployed Holding tokens from the bound battle scene. The actors themselves are untouched.",
    holdingsRemove:    "GM — remove this entry from the hex's Holdings. Only the station reference is cleared; the actor itself is not deleted.",
    holdingsNeglect:   "Neglected — garrison upkeep went unpaid. Each unpaid turn advances the counter; at 3 total unpaid turns the stationed Holdings defect and abandon the hex.",
    holdingsAbandoned: "Recently abandoned — Holdings defected from this hex after garrison upkeep went unpaid too long. Re-station assets via ＋ Station; this badge fades about 30 days after the event.",

    // ---- Tracks & State ----
    tracks:      "Tracks & State — the hex's live gauges: Integration (how developed it is), Radiation, local Darkness, and any active weather.",
    integration: "Integration (0–6) — how thoroughly the owner has absorbed this hex. 0 wild, 1–2 outpost, 3–4 developing, 5 settled, 6 integrated heartland. Higher integration multiplies all production: ×1.05 at 3+, ×1.10 at 5, ×1.20 at 6.",
    radiation:   "Radiation — this hex's radiation level. It decays 1 per turn on its own, but at 3+ it can spread each turn (25% chance per neighbor, up to the 6 nearest hexes). While a hex is Radiated, its owning faction's global Darkness climbs 1 per turn. Purify the hex to zero it out.",
    darkness:    "Local Darkness — Qliphothic taint pooled in this hex itself, tracked separately from the owning faction's global Darkness. Faction Darkness rises 1/turn while the faction owns any Radiated hex, and cleansing a Purified hex drops it by 2.",
    weather:     "Weather — active weather on this hex and how many turns it has left. Hover the chip for the full effect breakdown; weather is written by the Travel engine and ticks down each turn.",

    // ---- Pressure & Conditions ----
    pressure:      "Pressure & Conditions — radiation severity plus any persistent condition tags on this hex. Conditions are set by GM tools and turn effects (raid fallout, cleansing rituals) and drive the turn engine's radiation/darkness bookkeeping.",
    radiationTier: "Radiation Tier — severity band from the radiation value: I at 1–2, II at 3–5, III at 6–9, IV at 10+. '—' means no radiation.",
    conditions:    "Conditions — persistent tags on this hex. Radiated marks active radiation (auto-set when it spreads, auto-cleared when it decays to 0). Purified cleanses this hex AND its ~6 nearest neighbors each turn and lowers the owner's global Darkness by 2. Contaminated and Corrupted mark lasting damage from raids and rituals.",
    gmRad:         "GM — nudge this hex's radiation up or down (±1 / ±5). It then decays 1 per turn and, at 3+, can spread to neighboring hexes.",
    gmDark:        "GM — nudge this hex's local Darkness up or down by 1.",
    gmConditions:  "GM — toggle a persistent condition tag on this hex (Radiated, Contaminated, Purified, Corrupted). The turn engine reads these: Purified cleanses each turn; Radiated feeds the owner's Darkness.",
    gmCondClear:   "GM — clear every condition tag from this hex at once.",

    // ---- Tabs / stage ----
    tabOverview: "Overview — the live control surface: recorded yields, resource nodes, Build Unit engineering, and notes.",
    tabDossier:  "Dossier — the hex's story and math: production trace, active modifiers, the full improvement timeline, and suggested next steps.",
    stagePill:   "Integration stage — plain-language name for the hex's integration progress: Untouched Wilderness (0) → Foothold/Outpost (1–2) → Developing Territory (3–4) → Settled Province (5) → Integrated Heartland (6).",

    // ---- Overview pane ----
    yields:      "Resources / Yields — the resource pips recorded on this hex (Food, Materials, Trade, Military, Knowledge). Each turn they convert into OP marks for the owning faction — leyline flow modulates the take (surge ×1.3, stagnation ×0.6) and Food also feeds Logistics 1:1. Every 2 Materials pips across a faction's hexes generate 1 Build Unit at end of turn.",
    nodes:       "Resource Nodes — harvestable material deposits on this hex. Each shows its material, RFI tier, the gather check (DC + attribute), its yield roll, and remaining charges. Depleted nodes hide from players until the GM regrows them.",
    nodeHarvest: "Harvest — roll 2d10 + the listed attribute (passive bonuses apply) against the node's DC. Success rolls the yield formula, delivers that many units of the material to your character's inventory, and consumes 1 charge; failure costs nothing.",
    nodeRich:    "Rich node — a lucky strike carrying extra charges.",
    nodeAdd:     "GM — author a new resource node on this hex: pick the material, tier, attribute, DC, charges, and yield formula.",
    nodeRegrow:  "GM — reset every node on this hex to its maximum charges, including depleted ones players can no longer see.",
    nodeDelete:  "GM — permanently remove this node from the hex. Charges and any rich/discovered state are lost.",
    buildUnits:  "Build Units (Engineering) — spend the owning faction's BU on physical work in this hex. BU are generated at end of turn from Materials pips across all owned hexes (every 2 pips → 1 BU). Anyone with owner permission on the owning faction — or the GM — can spend here.",
    buFortify:   "Fortify Hex — spends BU (world setting, default 2) to stamp the Fortified modifier on this hex: +3 defense when it is raided. Already-Fortified hexes don't stack a second copy.",
    buRepair:    "Repair Hex — spends BU (world setting, default 1) to remove the Damaged Infrastructure modifier (−25% production). Only useful when the hex actually carries that damage.",
    buAsset:     "Build Asset — spends BU (world setting, default 3) and logs the construction to the faction war log. The asset system itself is still a placeholder: nothing is stamped on the hex yet beyond the spend.",
    gmNotes:     "GM Notes — free-text notes stored on this hex by the GM. Anyone who can open the sheet can read them; edit them via the GM Hex Config.",

    // ---- Dossier pane ----
    whatsHere:  "What's Here — the hex's current identity: integration stage, sephirothic alignment if set, and the production trace showing how base pips become final output.",
    sephirot:   "Sephirot — the sephirah this hex is aligned to. Alignment adds flat bonuses to the hex's effective output (e.g. Keter +1 to all resources, Gevurah +3 Military +1 Defense, Malkuth +4 Trade) and matters to campaign goals that want aligned territory.",
    production: "Production trace — how output is computed: base pips from the hex type, × size multiplier (outpost 0.5 … megalopolis 3.0), × integration multiplier (×1.05 at 3+, ×1.10 at 5, ×1.20 at 6). Modifiers and sephirot bonuses apply on top in the live income engine.",
    prodManual: "Manual override — the pips stored on this hex override the auto-calculated production.",
    modifiers:  "Active Modifiers — named effects stamped on this hex (Fortified +3 defense, Trade Hub +50% trade, Damaged Infrastructure −25% production, Radiation Zone −75%…). They scale the hex's production and defense every turn; each entry records when and how it arrived.",
    timeline:   "How We Got Here — the hex's append-only improvement ledger: builds, modifier changes, size/type/sephirot changes, integration steps, raid outcomes. Newest first; the last 60 entries are shown.",
    nextSteps:  "What's Next — a coach panel that reads the hex's current state and suggests concrete follow-ups: integration pushes, type/size upgrades, sephirot alignment, modifier fixes, and owner actions.",
    planPill:   "Open the Activity Planner with this activity, this hex, and the owning faction preselected — plan the suggested move in one click.",

    // ---- JS-built cards ----
    quests:       "Quests — campaign quests linked to this hex. Players see links on visible hexes (or ones the GM has hinted); the GM sees everything plus hint controls.",
    questLink:    "GM — link an existing campaign quest to this hex, optionally revealing the hint immediately (players then see the quest on this hex even while it is fogged).",
    questHint:    "GM — toggle the hint. Revealed: players can see this quest on the hex even under fog. Hidden: the link stays fog-gated.",
    questUnlink:  "GM — remove the link between this quest and this hex. The quest itself is untouched.",
    worldMods:    "GM — Active Effects: persistent world-modifier effects stored on this hex, each with its expiry turn. Click a chip to enable or disable it in place.",
    worldModChip: "GM — click to toggle this world modifier on/off. '(to Tn)' is its expiry turn; disabled or expired chips render dimmed."
  };

  // Stamp a registry tooltip onto a JS-built element (skips silently when the
  // registry isn't available — e.g. bbttcc-core disabled).
  function _hexTipApply(el, key) {
    try {
      const t = game.bbttcc?.help?.tip?.("hex", key) || "";
      if (t && el) el.dataset.tooltip = t;
    } catch (_e) {}
  }

  // Fallback {{bbttccTip}} helper so hex-sheet.hbs renders even when this
  // script's templates hit Handlebars before bbttcc-core's init has run (or
  // bbttcc-core is disabled — a mustache with args and no helper would throw
  // "Missing helper"). Delegates to the central registry at call time, so
  // whichever module wins the registration race, the lookup is identical.
  Hooks.once("init", function () {
    try {
      if (!Handlebars.helpers.bbttccTip) {
        Handlebars.registerHelper("bbttccTip", function (appKey, key) {
          return game.bbttcc?.help?.tip?.(appKey, key) ?? "";
        });
      }
    } catch (e) { warn("bbttccTip fallback helper registration failed", e); }
  });

  // ─── Holdings Phase A (2026-05-14) ─────────────────────────────────────
  // Strategic bonus tables locked by holdings design memo. Rigs and
  // facilities share the same actor type (`rig`); the `identity.mobility`
  // field distinguishes them (stationary → facility). Stacking is allowed
  // with a soft cap of +15 each on the rigs and facilities lanes.

  const _HLD_RIG_BONUS = {
    personal: 0,
    light:    1,
    medium:   3,
    heavy:    5,
    siege:    8
  };
  const _HLD_BOSS_BONUS = { 1: 2, 2: 4, 3: 6, 4: 10 };
  const _HLD_RIG_CAP      = 15;
  const _HLD_FACILITY_CAP = 15;

  // Facility bonus inferred from name keywords. Default +1 for unknown
  // facility types so authored content still registers a baseline.
  function _hldFacilityBonus(name) {
    const n = String(name || "").toLowerCase();
    if (n.includes("garrison") || n.includes("fort"))     return { bonus: 5, type: "garrison" };
    if (n.includes("forge"))                              return { bonus: 3, type: "forge" };
    if (n.includes("hex-cannon") || n.includes("cannon")) return { bonus: 5, type: "cannon" };
    if (n.includes("trade") || n.includes("market"))      return { bonus: 2, type: "trade" };
    return { bonus: 1, type: "other" };
  }

  function _hldClassify(actor) {
    if (!actor) return null;
    if (actor.type === "boss") return "boss";
    if (actor.type === "rig") {
      const mob = String(actor.system?.identity?.mobility || "mobile").toLowerCase();
      return (mob === "stationary") ? "facility" : "rig";
    }
    return null;
  }

  // P.5 2026-05-26 — the faction an asset belongs to, for the Station picker's
  // owner filter. Rigs/facilities carry it on identity.factionOwnerId; bosses on
  // identity.factionId (system.factionId as a generic fallback). "" = unlinked.
  function _hldActorFactionId(actor) {
    const sys = actor?.system || {};
    return String(sys?.identity?.factionOwnerId || sys?.identity?.factionId || sys?.factionId || "");
  }

  function _hldBonusForActor(actor) {
    const kind = _hldClassify(actor);
    if (!kind) return null;
    if (kind === "boss") {
      const tier = Math.max(1, Math.min(4, Number(actor.system?.integrity?.tier) || 1));
      const bonus = _HLD_BOSS_BONUS[tier] ?? 2;
      const doctrineKeys = Array.isArray(actor.system?.raidProfile?.doctrineKeys)
        ? actor.system.raidProfile.doctrineKeys.slice()
        : [];
      return { kind, bonus, label: actor.name, tier, doctrineKeys };
    }
    if (kind === "rig") {
      const bracket = String(actor.system?.integrity?.bracket || "medium").toLowerCase();
      const bonus = _HLD_RIG_BONUS[bracket] ?? 0;
      return { kind, bonus, label: actor.name, bracket };
    }
    // facility
    const fb = _hldFacilityBonus(actor.name);
    return { kind, bonus: fb.bonus, label: actor.name, facilityType: fb.type };
  }

  function _hldReadHoldings(hex) {
    const tf = (hex?.flags && hex.flags[MOD_T]) ? hex.flags[MOD_T] : {};
    const h  = (tf && tf.holdings) ? tf.holdings : {};
    const rigIds  = Array.isArray(h.rigIds)  ? h.rigIds.slice()  : [];
    const bossIds = Array.isArray(h.bossIds) ? h.bossIds.slice() : [];
    const rows = [];
    for (const id of rigIds) {
      const a = game.actors?.get?.(id);
      if (!a) { rows.push({ kind: "missing", id, label: `(missing actor: ${id})`, bonus: 0 }); continue; }
      const b = _hldBonusForActor(a);
      if (b) rows.push(Object.assign({ id, actor: a }, b));
    }
    for (const id of bossIds) {
      const a = game.actors?.get?.(id);
      if (!a) { rows.push({ kind: "missing", id, label: `(missing actor: ${id})`, bonus: 0 }); continue; }
      const b = _hldBonusForActor(a);
      if (b) rows.push(Object.assign({ id, actor: a }, b));
    }
    return rows;
  }

  function _hldComputeBonuses(hex) {
    const rows = _hldReadHoldings(hex);
    let rigs = 0, bosses = 0, facilities = 0;
    const doctrineKeys = [];
    for (const r of rows) {
      if (r.kind === "rig")       rigs       += Number(r.bonus || 0);
      else if (r.kind === "boss") {
        bosses += Number(r.bonus || 0);
        if (Array.isArray(r.doctrineKeys)) doctrineKeys.push.apply(doctrineKeys, r.doctrineKeys);
      }
      else if (r.kind === "facility") facilities += Number(r.bonus || 0);
    }
    rigs       = Math.min(rigs,       _HLD_RIG_CAP);
    facilities = Math.min(facilities, _HLD_FACILITY_CAP);
    return {
      rows,
      rigs,
      bosses,
      facilities,
      total: rigs + bosses + facilities,
      doctrineKeys: Array.from(new Set(doctrineKeys))
    };
  }

  // ─── Holdings Phase C (2026-05-14) ────────────────────────────────────
  // Tactical deployment — spawn the rigs/bosses/facilities stationed at a
  // hex as tokens on the hex's currently bound battle scene. Tokens are
  // `actorLink:true` so the damage path from `_applyDamageToActor` writes
  // back to the canonical actor doc; per the Damage Tracking Unification
  // sprint shipped earlier today, integrity is the single source of truth
  // so persistent damage carries across rounds and scene transitions.
  // Phase 5 (multi-scene orchestrator) already binds scenes to hexes; we
  // resolve the deployment target by:
  //   1. canvas.scene if it's in the hex's bound list (GM is looking at it)
  //   2. else hex.flags["bbttcc-raid"].battleScenes[currentSceneIdx]
  //   3. else error toast — bind a scene via Phase 5's BATTLE SCENES panel.
  function _hldResolveSceneForDeploy(hexDoc) {
    if (!hexDoc) return null;
    const raid = (hexDoc.flags && hexDoc.flags["bbttcc-raid"]) ? hexDoc.flags["bbttcc-raid"] : {};
    const list = Array.isArray(raid.battleScenes) ? raid.battleScenes : [];
    const cur  = Math.max(0, Number(raid.currentSceneIdx || 0));
    const active = (typeof canvas !== "undefined") ? canvas?.scene : null;
    if (active && list.some(e => e && e.sceneId === active.id)) return active;
    const entry = list[cur] || list[0];
    if (entry?.sceneId) {
      const sc = game.scenes?.get?.(entry.sceneId);
      if (sc) return sc;
    }
    return null;
  }

  async function _hldDeployToScene(hexDoc, opts) {
    opts = opts || {};
    if (!hexDoc) return { ok: false, error: "no hex" };
    let scene = null;
    if (opts.sceneId) scene = game.scenes?.get?.(opts.sceneId) || null;
    if (!scene) scene = _hldResolveSceneForDeploy(hexDoc);
    if (!scene) return { ok: false, error: "no bound battle scene" };

    const rows = _hldReadHoldings(hexDoc).filter(r => r && r.kind !== "missing" && r.actor);
    if (!rows.length) return { ok: false, error: "no Holdings to deploy" };

    // De-dup: skip actors that already have a deployment-tagged token on the scene.
    const sceneTokens = (scene.tokens && scene.tokens.contents) ? scene.tokens.contents : [];
    const alreadyByActor = new Set();
    for (const t of sceneTokens) {
      const tag = t?.flags?.[MOD_T]?.holdingDeployment;
      if (tag?.hexId === hexDoc.id && tag?.actorId) alreadyByActor.add(String(tag.actorId));
    }

    // Grid-aligned layout near scene center, 4-wide rows with 2-cell stride.
    const gridSize = Number(scene.grid?.size ?? scene.gridSize ?? 100);
    const sw = Number(scene.width || 4000);
    const sh = Number(scene.height || 3000);
    const cx = Math.round((sw / 2) / gridSize) * gridSize;
    const cy = Math.round((sh / 2) / gridSize) * gridSize;
    const cols = 4;
    const stride = gridSize * 2;

    // Tableau scenes (siege dioramas / courtly stages): tokens flagged
    // flags["bbttcc-raid"].tableauActor get forced-perspective depth scaling
    // (tableau.canvas.js). Muster contingents bake the flag at creation; bake it
    // here too so deployed rigs/bosses join the depth layer on drop — no
    // tableauStageScene() retro-fix needed.
    const _tableau = game.bbttcc?.api?.raid?.tableau || null;
    let onTableau = false;
    try { onTableau = _tableau?.readConfig?.(scene)?.enabled === true; } catch (_e) {}

    const tokenData = [];
    const skipped = [];
    let placed = 0;
    for (const r of rows) {
      const actor = r.actor;
      if (!actor) continue;
      if (!opts.force && alreadyByActor.has(actor.id)) { skipped.push(actor.name); continue; }
      const col = placed % cols;
      const row = Math.floor(placed / cols);
      const x = cx + (col - Math.floor(cols / 2)) * stride;
      const y = cy + row * stride;
      let proto;
      try { proto = await actor.getTokenDocument({ x, y }); }
      catch (e) { warn("getTokenDocument failed", actor.name, e); continue; }
      const data = (proto && typeof proto.toObject === "function") ? proto.toObject() : foundry.utils.deepClone(proto);
      data.x = x;
      data.y = y;
      data.actorLink = true;
      data.hidden = false;
      data.flags = data.flags || {};
      data.flags[MOD_T] = Object.assign({}, data.flags[MOD_T] || {}, {
        holdingDeployment: {
          hexId: hexDoc.id,
          hexUuid: hexDoc.uuid || null,
          actorId: actor.id,
          kind: r.kind,
          deployedAt: Date.now()
        }
      });
      if (onTableau && actor.getFlag?.("bbttcc-structures", "hasStructure") !== true) {
        // Structures hold their authored size on the stage (2026-06-04) — only
        // non-structure holdings (mobile rigs, bosses) join the depth layer.
        data.flags["bbttcc-raid"] = Object.assign({}, data.flags["bbttcc-raid"] || {}, { tableauActor: true });
      }
      tokenData.push(data);
      placed++;
    }
    if (!tokenData.length) return { ok: true, created: 0, skipped, scene };

    let created = [];
    try {
      created = await scene.createEmbeddedDocuments("Token", tokenData);
    } catch (e) { warn("token create failed", e); return { ok: false, error: "createDocuments failed" }; }
    if (onTableau) { try { await _tableau?.applyAll?.(); } catch (_e) {} }
    return { ok: true, created: created?.length || 0, skipped, scene };
  }

  async function _hldRecallFromScene(hexDoc, opts) {
    opts = opts || {};
    if (!hexDoc) return { ok: false, error: "no hex" };
    let scene = null;
    if (opts.sceneId) scene = game.scenes?.get?.(opts.sceneId) || null;
    if (!scene) scene = _hldResolveSceneForDeploy(hexDoc);
    if (!scene) return { ok: false, error: "no bound battle scene" };
    const toDelete = [];
    for (const t of (scene.tokens?.contents || [])) {
      const tag = t?.flags?.[MOD_T]?.holdingDeployment;
      if (tag?.hexId === hexDoc.id) toDelete.push(t.id);
    }
    if (!toDelete.length) return { ok: true, removed: 0, scene };
    try { await scene.deleteEmbeddedDocuments("Token", toDelete); }
    catch (e) { warn("token delete failed", e); return { ok: false, error: "deleteEmbeddedDocuments failed" }; }
    return { ok: true, removed: toDelete.length, scene };
  }

  // Expose for Phase B (raid console will read these to compute defender DC)
  // and downstream consumers. Done in TWO places for safety:
  //   1. At script-load (here) — covers consumers that read at init time
  //   2. At ready hook (below) — defends against load-order races where some
  //      OTHER script clobbers game.bbttcc.api.territory between init and ready
  const _hldApi = {
    classify: _hldClassify,
    bonusForActor: _hldBonusForActor,
    readHoldings: _hldReadHoldings,
    computeBonuses: _hldComputeBonuses,
    resolveSceneForDeploy: _hldResolveSceneForDeploy,
    deployToScene: _hldDeployToScene,
    recallFromScene: _hldRecallFromScene,
    RIG_BONUS: _HLD_RIG_BONUS,
    BOSS_BONUS: _HLD_BOSS_BONUS,
    RIG_CAP: _HLD_RIG_CAP,
    FACILITY_CAP: _HLD_FACILITY_CAP
  };
  function _hldInstallApi() {
    try {
      if (!game.bbttcc) game.bbttcc = { api: {} };
      if (!game.bbttcc.api) game.bbttcc.api = {};
      if (!game.bbttcc.api.territory) game.bbttcc.api.territory = {};
      game.bbttcc.api.territory.holdings = _hldApi;
    } catch (e) { console.warn("[bbttcc-territory/holdings] api install failed", e); }
  }
  _hldInstallApi();
  try { Hooks.once("ready", _hldInstallApi); } catch (_eHk) {}

  if (!ApplicationV2 || !HandlebarsApplicationMixin) {
    warn("Foundry ApplicationV2 APIs not available; Hex Sheet cannot install.");
    return;
  }

  class BBTTCC_HexSheet extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(
      foundry.utils.deepClone(super.DEFAULT_OPTIONS || {}),
      {
        id: "bbttcc-hex-sheet-base",
        classes: ["bbttcc","bbttcc-hex-sheet"],
        position: { width: 960, height: 600 },
        window: {
          title: "Bad Eden — Hex Sheet",
          resizable: true,
          controls: [],
          icon: ""
        }
      },
      { inplace: false }
    );

    static PARTS = {
      // 2026-05-13 — Declare the part root as scrollable so long hex
      // sheets (overview + battle scenes + harvest nodes + etc.) don't
      // require the whole window to grow. The empty selector targets
      // the part root itself; AppV2/HandlebarsApplicationMixin attaches
      // overflow-y:auto + scroll-position-restore between renders.
      body: {
        template: "modules/" + MOD_T + "/templates/hex-sheet.hbs",
        scrollable: [""]
      }
    };

    constructor(hexUuid, options) {
      super(options || {});
      this.hexUuid = String(hexUuid || "");
      try {
        // Ensure this window never collides with Territory Dashboard or other apps.
        this.options.id = _safeHexSheetId(this.hexUuid);
        if (this.options.window && this.options.window.title) {
          // keep existing title
        } else {
          if (!this.options.window) this.options.window = {};
          this.options.window.title = 'Bad Eden — Hex Sheet';
        }
      } catch (_eId) {}
      this._hexDoc = null;
      this._abort = null;
      this.__activeDossierTab = "overview";
      this.__hexImprovementHookId = null;

      try {
        if (!this.options.window) this.options.window = {};
        if (!Array.isArray(this.options.window.controls)) this.options.window.controls = [];
        if (this.options.window.icon == null) this.options.window.icon = "";
      } catch (e) {}
    }

    async _preparePartContext(partId, context) {
      if (partId !== "body") return context;

      this._hexDoc = await resolveHexDoc(this.hexUuid);
      const doc = this._hexDoc;

      if (!doc) {
        return Object.assign({}, context, {
          name: "(missing hex)",
          size: "",
          type: "",
          status: "missing",
          ownerName: "—",
          facilitySummary: "None",
          hasResources: false,
          resourcesList: [],
          integrationProgress: 0,
          integrationPips: pips(0,6),
          radiation: 0,
          radiationPips: pips(0,6),
          darkness: 0,
          darknessPips: pips(0,6),
          radiationTier: "—",
          conditionsCount: "0",
          hasConditions: false,
          conditions: [],
          hexImage: "",
          isGM: !!(game.user && game.user.isGM),
          notes: "Could not resolve hex for UUID: " + this.hexUuid
        });
      }

      const tf = (doc.flags && doc.flags[MOD_T]) ? doc.flags[MOD_T] : {};

      // World Modifiers (persistent GM-only effects)
      try {
        const arr = (tf && Array.isArray(tf.worldModifiers)) ? tf.worldModifiers : [];
        this._worldModifiers = arr.slice();
      } catch (e) {
        this._worldModifiers = [];
      }
      const ownerId = tf.factionId || "";
      const owner = ownerId ? ((game.actors && game.actors.get) ? game.actors.get(ownerId) : null) : null;

      const resources = tf.resources || {};
      const keys = Object.keys(resources || {});
      const resourcesList = keys.map(function (k) { return { label: k, value: resources[k] }; });

      const integ = tf.integration || {};
      const integProg = Number((typeof integ.progress !== "undefined") ? integ.progress : 0);

      const rad = readRadiation(tf);
      const dark = readDarkness(tf);

      // Pressure & Conditions — persistent tags read from the canonical
      // flags.bbttcc-territory.conditions array (what the turn engine's
      // darkness feed / Purified cleanup consume).
      const conditions = Array.isArray(tf.conditions)
        ? tf.conditions.map(c => String(c).trim()).filter(Boolean)
        : [];

      const fac = (tf.facilities && tf.facilities.primary) ? tf.facilities.primary : {};
      const facType = (fac && fac.facilityType) ? fac.facilityType : "";
      const facilitySummary = facType ? (String(facType).charAt(0).toUpperCase() + String(facType).slice(1)) : "None";

      const hexImage = String(tf.hexImage || "");

      // Resource Nodes (Phase 2). Only surface non-depleted nodes by default;
      // include a depleted-count for transparency. Hidden hexes shouldn't even
      // be reaching this code path for non-GMs (fog cascade), but defensively
      // gate the listing on hex visibility for non-GMs.
      const isGMUser = !!(game.user && game.user.isGM);
      const allNodes = Array.isArray(tf.resourceNodes) ? tf.resourceNodes : [];
      const hexHidden = !!doc.hidden;
      const showNodes = isGMUser || !hexHidden;
      const liveNodes = allNodes.filter(n => Number(n?.charges ?? 0) > 0);
      const depletedNodes = allNodes.length - liveNodes.length;
      const resourceNodes = showNodes ? liveNodes.map(n => ({
        id: n.id,
        materialKey: n.materialKey,
        materialName: n.materialName || n.materialKey,
        tier: n.tier || "I",
        dc: Number(n.dc ?? 12),
        skill: n.skill || "body",
        yieldFormula: n.yieldFormula || "1d4",
        charges: Number(n.charges ?? 0),
        maxCharges: Number(n.maxCharges ?? n.charges ?? 0),
        rich: !!n.rich,
        chargesPct: Math.max(0, Math.min(100, Math.round((Number(n.charges ?? 0) / Math.max(1, Number(n.maxCharges ?? n.charges ?? 1))) * 100)))
      })) : [];

      // -----------------------------------------------------------------
      // Hex Dossier — payload (Overview/Dossier tabs)
      // Mirrors main.js BBTTCC_HexSheetApp dossier; reads via the API
      // helpers exposed by main.js so this stays a thin surfacing layer.
      // -----------------------------------------------------------------
      const dossier = (() => {
        const tApi = (game.bbttcc && game.bbttcc.api && game.bbttcc.api.territory) ? game.bbttcc.api.territory : {};
        const describeMod = (typeof tApi.describeHexModifier === "function") ? tApi.describeHexModifier : (() => null);
        const computeNext = (typeof tApi.computeHexNextSteps === "function") ? tApi.computeHexNextSteps : (() => ({}));
        const traceProd   = (typeof tApi.traceHexProduction === "function") ? tApi.traceHexProduction : (() => null);

        const stageLabels = { wild:"Untouched Wilderness", outpost:"Foothold / Outpost", developing:"Developing Territory", settled:"Settled Province", integrated:"Integrated Heartland" };
        const integration = Number(integProg || 0);
        const stageKey = integration >= 6 ? "integrated"
          : integration === 5 ? "settled"
          : integration >= 3 ? "developing"
          : integration >= 1 ? "outpost"
          : "wild";

        const mh = (tf && tf.modifierHistory && typeof tf.modifierHistory === "object") ? tf.modifierHistory : {};
        const activeModifiers = (Array.isArray(tf.modifiers) ? tf.modifiers : [])
          .map(m => String(m).trim())
          .filter(Boolean)
          .map(m => {
            const desc = describeMod(m) || "(no description on record)";
            const lc = (typeof m.toLowerCase === "function") ? m.toLowerCase() : m;
            const histRec = mh[m] || mh[lc] || null;
            const addedTs = (histRec && histRec.addedTs) ? new Date(histRec.addedTs).toLocaleString() : null;
            const addedTurn = (histRec && histRec.addedTurn != null) ? histRec.addedTurn : null;
            const sourceActivity = (histRec && histRec.source && histRec.source.activity) || (histRec && histRec.addedBy) || null;
            return { name: m, description: desc, addedTs, addedTurn, sourceActivity };
          });

        let trace = null;
        try { trace = traceProd(doc); } catch (_e) { trace = null; }
        const productionRows = trace ? [
          { label:"Food",      base: trace.base.food,      sized: trace.sized.food,      final: trace.final.food },
          { label:"Materials", base: trace.base.materials, sized: trace.sized.materials, final: trace.final.materials },
          { label:"Trade",     base: trace.base.trade,     sized: trace.sized.trade,     final: trace.final.trade },
          { label:"Military",  base: trace.base.military,  sized: trace.sized.military,  final: trace.final.military },
          { label:"Knowledge", base: trace.base.knowledge, sized: trace.sized.knowledge, final: trace.final.knowledge }
        ] : [];

        const improvements = Array.isArray(tf.improvements) ? tf.improvements : [];
        const kindIcons = {
          build: "fas fa-hammer", modifier_added: "fas fa-plus-circle", modifier_removed: "fas fa-minus-circle",
          size_up: "fas fa-arrow-up", size_down: "fas fa-arrow-down",
          sephirot_set: "fas fa-star", sephirot_changed: "fas fa-star-of-david",
          type_change: "fas fa-shapes", integration_step: "fas fa-mountain",
          owner_action: "fas fa-user-shield", garrison: "fas fa-shield-alt",
          raid_outcome: "fas fa-crosshairs", legacy_seed: "fas fa-seedling"
        };
        const timeline = improvements.slice(-60).reverse().map(e => ({
          id: (e && e.id) || "",
          ts: (e && e.ts) || 0,
          when: (e && e.ts) ? new Date(e.ts).toLocaleString() : "",
          turn: (e && e.turn != null) ? ("T" + e.turn) : "",
          kind: (e && e.kind) || "",
          kindIcon: (e && kindIcons[e.kind]) || "fas fa-history",
          label: (e && (e.label || e.kind)) || "",
          description: (e && e.description) || "",
          activity: (e && e.source && e.source.activity) || "",
          factionId: (e && e.source && e.source.factionId) || ""
        }));

        let nextRaw = {};
        try { nextRaw = computeNext(doc) || {}; } catch (_eN) { nextRaw = {}; }
        const flatten = (a) => Array.isArray(a) ? a : [];
        const nextSteps = {
          integration: flatten(nextRaw.integration),
          typeSize: flatten(nextRaw.typeSize),
          sephirot: flatten(nextRaw.sephirot),
          modifiers: flatten(nextRaw.modifiers),
          ownerActions: flatten(nextRaw.ownerActions)
        };
        const nextStepsHasAny = Object.keys(nextSteps).some(k => nextSteps[k].length > 0);

        return {
          stageKey,
          stageLabel: stageLabels[stageKey] || "—",
          activeModifiers,
          hasActiveModifiers: activeModifiers.length > 0,
          productionRows,
          productionShown: !!trace && productionRows.some(r => Number(r.final || 0) !== 0 || Number(r.base || 0) !== 0),
          manualOverride: !!(trace && trace.manualOverride),
          integMult: (trace && trace.integMult != null) ? trace.integMult : 1.0,
          sizeMult: (trace && trace.sizeMult != null) ? trace.sizeMult : 0,
          sephirotKey: String(tf.sephirotKey || "").toLowerCase() || null,
          sephirotName: tf.sephirotName || null,
          timeline,
          hasTimeline: timeline.length > 0,
          nextSteps,
          nextStepsHasAny
        };
      })();

      const activeTab = this.__activeDossierTab || "overview";

      // ───────────── Build Units (Engineering) panel ─────────────
      // Single canonical player-accessible surface for hex BU spends.
      // Replaces the GM-only Hex Editor BU buttons.
      const buApiAvail = !!(game?.bbttcc?.api?.territory?.buildUnits?.spendForAction);
      const _buNum = (k, fb) => {
        try { return Math.max(0, Number(game.settings.get(MOD_T, k) ?? fb) || 0); }
        catch (_e) { return Math.max(0, Number(fb) || 0); }
      };
      const cFort = _buNum("buildUnitCostFortify", 2);
      const cRep  = _buNum("buildUnitCostRepair", 1);
      const cAss  = _buNum("buildUnitCostAsset", 3);
      const buHasOwner = !!owner;
      const buBalance = buHasOwner
        ? Math.max(0, Math.floor(Number(owner.getFlag("bbttcc-factions", "buildUnits") ?? 0) || 0))
        : 0;
      // Player can spend if they have OWNER permission on the owning faction actor (or are GM).
      const buCanEngineer = buHasOwner && (isGMUser || !!owner.isOwner);
      // Blocked states explain the blocker; the affordable state pulls the
      // full mechanical explanation from the central help registry (falling
      // back to the short label when bbttcc-core is unavailable).
      const _tip = (cost, label, helpKey) => {
        if (!buHasOwner) return "This hex has no owning faction.";
        if (!buCanEngineer) return `Only ${owner.name} (or GM) can engineer this hex.`;
        if (buBalance < cost) return `Need ${cost} BU; ${owner.name} has ${buBalance}.`;
        return (game.bbttcc?.help?.tip?.("hex", helpKey) || "") || `${label} — spends ${cost} BU.`;
      };
      const buildUnits = {
        enabled: buApiAvail,
        hasOwner: buHasOwner,
        ownerName: buHasOwner ? owner.name : "",
        balance: buBalance,
        canFortify: buCanEngineer && buBalance >= cFort,
        canRepair:  buCanEngineer && buBalance >= cRep,
        canAsset:   buCanEngineer && buBalance >= cAss,
        costs: { fortify: cFort, repair: cRep, asset: cAss },
        fortifyTip: _tip(cFort, "Fortify Hex", "buFortify"),
        repairTip:  _tip(cRep,  "Repair Hex", "buRepair"),
        assetTip:   _tip(cAss,  "Build Asset", "buAsset"),
        hint: !buHasOwner
          ? "Assign an owner to this hex before spending Build Units."
          : !buCanEngineer
            ? `Only ${owner.name} (or GM) can spend BU here.`
            : `Spent from ${owner.name}. Generated end-of-turn from Materials pips on owned hexes (every 2 → 1 BU).`
      };

      // Carry-over (2026-05-12) — surface active weather on the hex card with
      // the same rich multi-line tooltip the Travel Console uses. Reads
      // flags.bbttcc-territory.weather written by writeWeatherToHex; renders
      // via game.bbttcc.api.travel.weather.tooltip when available.
      const w = (tf && tf.weather && typeof tf.weather === "object") ? tf.weather : null;
      const _wKey = w?.key || "";
      const _wLabel = w?.label || _wKey;
      const _wRem = Number(w?.remainingTurns) || 0;
      const _tipFn = game?.bbttcc?.api?.travel?.weather?.tooltip;
      const weather = (_wKey && _wRem > 0) ? {
        active: true,
        key: _wKey,
        label: _wLabel || "Weather",
        remainingTurns: _wRem,
        tooltip: (typeof _tipFn === "function")
          ? _tipFn(_wKey, _wLabel, _wRem)
          : `${_wLabel || _wKey} — ${_wRem} turn(s) remaining`
      } : { active: false };

      // Holdings Phase A — compute strategic bonuses + grouped lists for the panel.
      // Phase D — surface garrison-neglect state alongside the bonus summary.
      let holdingsView = null;
      try {
        const ho = _hldComputeBonuses(doc);
        const _negFlag = (tf && tf.holdingsNeglect && typeof tf.holdingsNeglect === "object") ? tf.holdingsNeglect : {};
        const _negTurns = Math.max(0, Number(_negFlag.turns || 0));
        const _negThreshold = 3;  // mirrors _HLD_NEGLECT_THRESHOLD in garrison-upkeep.enhancer.js
        const _abandonedAt = Number(_negFlag.abandonedAt || 0);
        // Treat the abandonment badge as "recent" within ~30 days; after that
        // it fades from the surface but remains in the flag for audit.
        const _abandonedRecent = (_abandonedAt > 0) && ((Date.now() - _abandonedAt) < (30 * 24 * 3600 * 1000));
        const rigsList       = ho.rows.filter(r => r.kind === "rig");
        const bossesList     = ho.rows.filter(r => r.kind === "boss");
        const facilitiesList = ho.rows.filter(r => r.kind === "facility");
        const missingList    = ho.rows.filter(r => r.kind === "missing");
        const mkRow = (r) => ({
          id: r.id,
          label: r.label,
          bonus: Number(r.bonus || 0),
          bracket: r.bracket || "",
          tier: r.tier || null,
          facilityType: r.facilityType || ""
        });
        holdingsView = {
          rigs: rigsList.map(mkRow),
          bosses: bossesList.map(mkRow),
          facilities: facilitiesList.map(mkRow),
          missing: missingList.map(r => ({ id: r.id, label: r.label })),
          rigsBonus: ho.rigs,
          bossesBonus: ho.bosses,
          facilitiesBonus: ho.facilities,
          totalBonus: ho.total,
          doctrineKeys: ho.doctrineKeys,
          hasAny: ho.rows.length > 0,
          rigsCapped:       ho.rows.reduce((s, r) => s + (r.kind === "rig" ? Number(r.bonus || 0) : 0), 0) > _HLD_RIG_CAP,
          facilitiesCapped: ho.rows.reduce((s, r) => s + (r.kind === "facility" ? Number(r.bonus || 0) : 0), 0) > _HLD_FACILITY_CAP,
          neglectTurns: _negTurns,
          neglectThreshold: _negThreshold,
          isNeglected: _negTurns > 0,
          abandonedRecent: _abandonedRecent,
          lastAbandonedCount: Number(_negFlag.lastAbandonedCount || 0)
        };
      } catch (e) { warn("holdings compute failed", e); holdingsView = { rigs:[], bosses:[], facilities:[], missing:[], totalBonus:0, hasAny:false, neglectTurns:0, neglectThreshold:3, isNeglected:false, abandonedRecent:false, lastAbandonedCount:0 }; }

      return Object.assign({}, context, {
        name: tf.name || doc.text || doc.name || "(unnamed hex)",
        size: tf.size || "outpost",
        type: tf.type || "wilderness",
        status: tf.status || "unclaimed",
        ownerName: (owner && owner.name) ? owner.name : "Unclaimed",
        facilitySummary: facilitySummary,
        hasResources: !!keys.length,
        resourcesList: resourcesList,
        resourceNodes,
        hasResourceNodes: resourceNodes.length > 0,
        depletedNodes,
        integrationProgress: integProg,
        integrationPips: pips(integProg,6),
        radiation: rad,
        radiationPips: pips(rad,6),
        darkness: dark,
        darknessPips: pips(dark,6),
        radiationTier: radTier(rad),
        conditionsCount: String(conditions.length),
        hasConditions: conditions.length > 0,
        conditions: conditions,
        weather,
        hexImage: hexImage,
        isGM: isGMUser,
        notes: tf.notes || tf.note || "No notes stored on this hex.",
        dossier,
        activeTab,
        isOverview: activeTab === "overview",
        isDossier: activeTab === "dossier",
        buildUnits,
        holdings: holdingsView
      });
    }

    async _onRender(ctx, opts) {
      await super._onRender(ctx, opts);

      let root = null;
      // AppV2-safe: never querySelector by id (ids can collide across apps).
      if (this.form && this.form instanceof HTMLElement) root = this.form;
      if (!root) {
        try {
          // Foundry sometimes stores the root on this.element (jQuery-ish) or as HTMLElement.
          const el = this.element && this.element[0] ? this.element[0] : this.element;
          if (el && el instanceof HTMLElement) root = el;
        } catch (e) {}
      }
      if (!root) return;

      if (this._abort) { try { this._abort.abort(); } catch (e) {} }
      this._abort = new AbortController();
      const sig = this._abort.signal;

      // ───────────── Dossier tab strip — bind + apply state ─────────────
      try {
        const applyTabState = () => {
          const active = this.__activeDossierTab || "overview";
          root.querySelectorAll("[data-bbttcc-hex-tab]").forEach(btn => {
            btn.classList.toggle("active", btn.getAttribute("data-bbttcc-hex-tab") === active);
          });
          root.querySelectorAll("[data-bbttcc-hex-pane]").forEach(pane => {
            pane.style.display = (pane.getAttribute("data-bbttcc-hex-pane") === active) ? "" : "none";
          });
        };
        applyTabState();
        root.querySelectorAll("[data-bbttcc-hex-tab]").forEach(btn => {
          btn.addEventListener("click", (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            const next = String(btn.getAttribute("data-bbttcc-hex-tab") || "overview");
            if (next === this.__activeDossierTab) return;
            this.__activeDossierTab = next;
            applyTabState();
          }, { capture: true, signal: sig });
        });
      } catch (eTab) { warn("hex sheet tab bind failed", eTab); }

      // Live refresh: ledger writes from anywhere in the system fire
      // Hooks.callAll("bbttcc:hexImprovement", { hexUuid }). Re-render so
      // the timeline + next-steps panes stay current without manual reload.
      try {
        if (this.__hexImprovementHookId == null) {
          const myUuid = this.hexUuid;
          this.__hexImprovementHookId = Hooks.on("bbttcc:hexImprovement", (payload) => {
            const u = (payload && payload.hexUuid) || "";
            if (!myUuid || u !== myUuid) return;
            try { this.render({ force: false }); } catch (_e) {}
          });
        }
      } catch (eH) { warn("hex sheet improvement hook failed", eH); }

      // ───────────── Dossier next-step deep-link to Activity Planner ─────────────
      // Activity-key pills inside the "What's Next" cards open the planner with
      // factionId locked, the activity preselected, and the hex preselected.
      root.addEventListener("click", (ev) => {
        let pill = null;
        try {
          pill = (ev.target && ev.target.closest) ? ev.target.closest('[data-bbttcc-deep-plan][data-activity-key]') : null;
        } catch (_e) { pill = null; }
        if (!pill) return;
        ev.preventDefault(); ev.stopPropagation();

        const activityKey = String(pill.getAttribute("data-activity-key") || "").trim();
        if (!activityKey) return;

        const doc = this._hexDoc;
        if (!doc) {
          if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("Hex doc not resolved.");
          return;
        }
        const tf2 = (doc.flags && doc.flags[MOD_T]) ? doc.flags[MOD_T] : {};
        const factionId = String(tf2.factionId || "").trim();
        if (!factionId) {
          if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("This hex has no owning faction — claim it first to plan an activity here.");
          return;
        }

        const raidApi = (game.bbttcc && game.bbttcc.api && game.bbttcc.api.raid) ? game.bbttcc.api.raid : null;
        if (!raidApi || typeof raidApi.openActivityPlanner !== "function") {
          if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("Activity Planner not available.");
          return;
        }

        let app = null;
        try {
          app = raidApi.openActivityPlanner({ factionId: factionId, lockFaction: true });
        } catch (eOpen) {
          warn("openActivityPlanner threw", eOpen);
          return;
        }
        if (!app) return;

        // First render is async — set state on next tick, then re-render so the
        // activity row highlights and the hex <select> snaps to this hex.
        setTimeout(() => {
          try {
            if (app._plannerState) {
              app._plannerState.selectedKey = activityKey;
              app._plannerState.selectedHexUuid = this.hexUuid;
            }
            app.render(false);
          } catch (eSet) { warn("planner preselect failed", eSet); }
        }, 80);
      }, { capture: true, signal: sig });

      root.addEventListener("click", (ev) => {
        let btn = null;
        try {
          btn = (ev.target && ev.target.closest) ? ev.target.closest('[data-action="open-facilities"]') : null;
        } catch (e) { btn = null; }
        if (!btn) return;
        ev.preventDefault(); ev.stopPropagation();

        const FacConsole = (game.bbttcc && game.bbttcc.apps) ? game.bbttcc.apps.FacilityConsole : null;
        if (!FacConsole) {
          if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("Facility Console not available.");
          return;
        }
        new FacConsole({ hexUuid: this.hexUuid }).render({ force: true, focus: true });
      }, { capture:true, signal: sig });

      // Resource Node harvest button (Phase 2 wiring).
      // Resolves the actor: if the user has assigned a character, use it.
      // Otherwise fall back to the first OWNER-permission character actor
      // they have. GM with no assignment opens a picker.
      root.addEventListener("click", async (ev) => {
        let btn = null;
        try {
          btn = (ev.target && ev.target.closest) ? ev.target.closest('[data-action="harvest-hex-node"]') : null;
        } catch (e) { btn = null; }
        if (!btn) return;
        ev.preventDefault(); ev.stopPropagation();

        const nodeId = btn.getAttribute("data-node-id");
        if (!nodeId) return;
        const api = game.bbttcc && game.bbttcc.api && game.bbttcc.api.territory;
        if (!api?.harvestHexNode) {
          ui.notifications?.error("Harvest API not loaded.");
          return;
        }
        const hexDoc = this._hexDoc;
        if (!hexDoc) { ui.notifications?.warn("Hex doc not resolved."); return; }

        // Pick an actor.
        let actor = game.user.character;
        if (!actor) {
          // Harvesters are people, not factions. Factions are stored as
          // type:"npc" + isFaction flag, so a plain type check leaks them into
          // this picker — filter by canonical kind (steward/npc), with a flag
          // fallback if the system's actorKind API isn't loaded.
          const _harvestKind = (a) => game.bbttcc?.api?.actorKind?.(a)
            ?? (a?.flags?.["bbttcc-factions"]?.isFaction ? "faction" : a?.type);
          const owned = (game.actors?.contents || []).filter(a => {
            if (!a.isOwner) return false;
            const k = _harvestKind(a);
            return k === "steward" || k === "npc" || k === "character";
          });
          if (owned.length === 1) actor = owned[0];
          else if (owned.length > 1) {
            const opts = owned.map(a => `<option value="${a.id}">${a.name}</option>`).join("");
            const choice = await new Promise((resolve) => {
              new Dialog({
                title: "Harvest — pick a character",
                content: `<form><div class="form-group"><label>Character</label><select name="actorId">${opts}</select></div></form>`,
                buttons: {
                  ok: { label: "Harvest", callback: ($html) => {
                    const root = $html?.[0] ?? $html;
                    resolve(root?.querySelector?.("[name='actorId']")?.value || null);
                  }},
                  cancel: { label: "Cancel", callback: () => resolve(null) }
                },
                default: "ok"
              }).render(true);
            });
            actor = choice ? game.actors.get(choice) : null;
          }
        }
        if (!actor) { ui.notifications?.warn("No character available to harvest."); return; }

        try {
          btn.disabled = true;
          await api.harvestHexNode(actor, hexDoc, nodeId);
          // Re-render to reflect new charges.
          this.render({ force: false });
        } catch (err) {
          console.warn("[bbttcc-hex-sheet] harvest failed", err);
          ui.notifications?.error("Harvest failed — see console.");
        } finally {
          btn.disabled = false;
        }
      }, { capture:true, signal: sig });

      // GM-only: regrow all nodes on this hex back to maxCharges.
      root.addEventListener("click", async (ev) => {
        let btn = null;
        try {
          btn = (ev.target && ev.target.closest) ? ev.target.closest('[data-action="regrow-hex-nodes"]') : null;
        } catch (e) { btn = null; }
        if (!btn) return;
        ev.preventDefault(); ev.stopPropagation();
        if (!game.user?.isGM) return;

        const api = game.bbttcc && game.bbttcc.api && game.bbttcc.api.territory;
        const hexDoc = this._hexDoc;
        if (!api?.regrowHex || !hexDoc) return;
        const r = await api.regrowHex(hexDoc);
        ui.notifications?.info(`Regrew ${r.count} nodes on this hex.`);
        this.render({ force: false });
      }, { capture:true, signal: sig });

      // GM-only: add a resource node to this hex via material picker dialog.
      root.addEventListener("click", async (ev) => {
        let btn = null;
        try {
          btn = (ev.target && ev.target.closest) ? ev.target.closest('[data-action="add-hex-node"]') : null;
        } catch (e) { btn = null; }
        if (!btn) return;
        ev.preventDefault(); ev.stopPropagation();
        if (!game.user?.isGM) return;

        const api = game.bbttcc && game.bbttcc.api && game.bbttcc.api.territory;
        const hexDoc = this._hexDoc;
        if (!api?.openAddNodeDialog || !hexDoc) return;
        const node = await api.openAddNodeDialog(hexDoc);
        if (node) this.render({ force: false });
      }, { capture:true, signal: sig });

      // GM-only: delete a single resource node by id.
      root.addEventListener("click", async (ev) => {
        let btn = null;
        try {
          btn = (ev.target && ev.target.closest) ? ev.target.closest('[data-action="delete-hex-node"]') : null;
        } catch (e) { btn = null; }
        if (!btn) return;
        ev.preventDefault(); ev.stopPropagation();
        if (!game.user?.isGM) return;

        const nodeId = btn.getAttribute("data-node-id");
        if (!nodeId) return;
        const api = game.bbttcc && game.bbttcc.api && game.bbttcc.api.territory;
        const hexDoc = this._hexDoc;
        if (!api?.deleteHexNode || !hexDoc) return;

        const ok = await Dialog.confirm({
          title: "Delete resource node",
          content: `<p>Remove this node from the hex? Charges and any rich/discovered state are lost.</p>`
        });
        if (!ok) return;

        const r = await api.deleteHexNode(hexDoc, nodeId);
        if (r?.ok) {
          ui.notifications?.info("Node removed.");
          this.render({ force: false });
        } else {
          ui.notifications?.error(r?.error || "Delete failed");
        }
      }, { capture:true, signal: sig });

      // Holdings Phase A (2026-05-14) — Station rigs/bosses/facilities at this hex.
      // GM-only. Opens a roster picker dialog grouped by type with multi-select.
      // Writes to hex.flags[MOD_T].holdings.{rigIds,bossIds,lastUpdated}.
      root.addEventListener("click", async (ev) => {
        let btn = null;
        try { btn = ev.target?.closest?.('[data-action="holdings-add"]'); } catch (_e) { btn = null; }
        if (!btn) return;
        ev.preventDefault(); ev.stopPropagation();
        if (!game.user?.isGM) return;
        const hexDoc = this._hexDoc;
        if (!hexDoc) return;
        const tf = (hexDoc.flags && hexDoc.flags[MOD_T]) ? hexDoc.flags[MOD_T] : {};
        const h  = (tf.holdings && typeof tf.holdings === "object") ? tf.holdings : {};
        const rigIds  = Array.isArray(h.rigIds)  ? h.rigIds.slice()  : [];
        const bossIds = Array.isArray(h.bossIds) ? h.bossIds.slice() : [];
        const already = new Set([].concat(rigIds, bossIds));

        // Build candidate list from world actors. Group by classification.
        // P.5 2026-05-26 — tag each candidate as owned by the hex's controlling
        // faction (hex flag `factionId`). Owned assets render in the main groups;
        // other-faction assets fold into a collapsible <details> so the GM can
        // still station them for scenario reasons. No hex owner = show all.
        const ownerFactionId = String(tf.factionId || "");
        const groups = { boss: [], rig: [], facility: [] };
        try {
          for (const a of (game.actors?.contents || [])) {
            const kind = _hldClassify(a);
            if (!kind) continue;
            if (already.has(a.id)) continue;
            const b = _hldBonusForActor(a);
            const meta = (kind === "boss") ? `T${b?.tier || 1}` :
                         (kind === "rig")  ? String(b?.bracket || "—") :
                         String(b?.facilityType || "facility");
            const owned = !ownerFactionId || (_hldActorFactionId(a) === ownerFactionId);
            groups[kind].push({ id: a.id, name: a.name, bonus: b?.bonus ?? 0, meta, owned });
          }
        } catch (eList) { warn("holdings: candidate list failed", eList); }

        const groupHtml = (label, color, rows) => {
          if (!rows.length) return "";
          const items = rows.map(r => `
            <label style="display:flex; align-items:center; gap:.5rem; padding:.3rem .4rem; border-radius:6px; border:1px solid rgba(75,85,99,0.35); margin-bottom:.25rem;">
              <input type="checkbox" name="holding" value="${r.id}" data-kind="${label.toLowerCase()}">
              <span style="flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${foundry.utils.escapeHTML(r.name)}</span>
              <span style="font-size:.7rem; padding:0 .35em; border-radius:3px; background:rgba(40,40,40,0.5); color:${color}; text-transform:capitalize;">${foundry.utils.escapeHTML(r.meta)}</span>
              <span style="font-size:.75rem; color:#fbbf24; font-weight:600;">+${r.bonus}</span>
            </label>`).join("");
          return `<div class="bbttcc-holdings-group" data-group="${label.toLowerCase()}" style="margin-bottom:.6rem; padding:.5rem .55rem; border:1px solid rgba(148,163,184,0.25); border-radius:8px; background:rgba(2,6,23,0.25);">
            <div style="font-weight:700; color:${color}; margin-bottom:.4rem; padding-bottom:.25rem; border-bottom:1px solid rgba(148,163,184,0.18);">${label} <span style="opacity:.55; font-weight:500; font-size:.85em;">(${rows.length})</span></div>
            ${items}
          </div>`;
        };
        // P.5 — owned assets in the main groups; other-faction assets in a
        // collapsible disclosure below (only when the hex has an owner).
        const _owned = (rows) => rows.filter(x => x.owned);
        const _other = (rows) => rows.filter(x => !x.owned);
        const bossesHtml     = groupHtml("Bosses",     "#a78bfa", _owned(groups.boss));
        const rigsHtml       = groupHtml("Rigs",       "#60a5fa", _owned(groups.rig));
        const facilitiesHtml = groupHtml("Facilities", "#34d399", _owned(groups.facility));
        const ownedEmpty = !_owned(groups.boss).length && !_owned(groups.rig).length && !_owned(groups.facility).length;

        let otherHtml = "";
        if (ownerFactionId) {
          const otherCount = _other(groups.boss).length + _other(groups.rig).length + _other(groups.facility).length;
          if (otherCount) {
            const oBoss = groupHtml("Bosses",     "#a78bfa", _other(groups.boss));
            const oRig  = groupHtml("Rigs",       "#60a5fa", _other(groups.rig));
            const oFac  = groupHtml("Facilities", "#34d399", _other(groups.facility));
            otherHtml = `<details style="margin-top:.4rem;">
              <summary style="cursor:pointer; opacity:.8; font-size:.85rem; padding:.25rem 0;">Other factions' assets (${otherCount}) — station anyway</summary>
              <div style="margin-top:.4rem; display:flex; flex-direction:column; gap:.4rem;">${oBoss}${oRig}${oFac}</div>
            </details>`;
          }
        }
        const ownerName = ownerFactionId ? (game.actors?.get?.(ownerFactionId)?.name || "the controlling faction") : "";
        const filterNote = ownerFactionId
          ? `<p style="margin:0 0 .25rem 0; opacity:.7; font-size:.78rem;">Showing <b>${foundry.utils.escapeHTML(ownerName)}</b>'s assets. Other factions' assets are under the expander below.</p>`
          : "";
        // DialogV2 does NOT use ApplicationV2's `scrollable: [...]` part
        // declaration, so the hex sheet's native scroll pattern doesn't
        // apply here. Inline height + overflow on the <form> gets ignored
        // by DialogV2's layout. The working pattern in this codebase
        // (Coalition Support Factions dialog in raid-console.js) is a
        // wrapper <div> INSIDE the form with explicit max-height +
        // overflow-y:auto. Form/dialog stay natural-sized; the inner
        // wrapper clips and scrolls. Mirrors that here.
        const content = `<form style="display:flex; flex-direction:column; gap:.4rem;">
          <p style="margin:0 0 .25rem 0; opacity:.85; font-size:.85rem;">Select rigs, bosses, or facilities to station at this hex. Each adds its strategic bonus to defender DC when this hex is raided.</p>
          ${filterNote}
          <div style="max-height:60vh; overflow-y:auto; padding-right:.35rem; display:flex; flex-direction:column; gap:.4rem;">
            ${bossesHtml}
            ${rigsHtml}
            ${facilitiesHtml}
            ${ownedEmpty && !otherHtml ? '<p style="opacity:.7;">No eligible actors found (or all are already stationed here).</p>' : ""}
            ${ownedEmpty && otherHtml ? `<p style="opacity:.7; font-size:.82rem;">No assets owned by ${foundry.utils.escapeHTML(ownerName)} are available — see other factions below.</p>` : ""}
            ${otherHtml}
          </div>
        </form>`;

        let picked = [];
        const dlg = new foundry.applications.api.DialogV2({
          window: { title: "Station Holdings", resizable: true },
          position: { width: 520, height: "auto" },
          content,
          buttons: [
            { action: "apply", label: "Station Selected", default: true, callback: (event, button, dialog) => {
              const r = dialog.element ?? dialog;
              picked = Array.from(r.querySelectorAll('input[name="holding"]:checked')).map(el => ({
                id: String(el.value || "").trim(),
                kind: String(el.dataset.kind || "").toLowerCase()
              })).filter(x => x.id);
            }},
            { action: "cancel", label: "Cancel", callback: () => { picked = null; } }
          ]
        });
        await dlg.render({ force: true });
        await new Promise(res => { const i = setInterval(() => { if (!dlg.rendered) { clearInterval(i); res(); } }, 100); });
        if (!picked || !picked.length) return;

        const nextRigIds  = rigIds.slice();
        const nextBossIds = bossIds.slice();
        for (const p of picked) {
          if (p.kind === "bosses") { if (!nextBossIds.includes(p.id)) nextBossIds.push(p.id); }
          else                     { if (!nextRigIds.includes(p.id))  nextRigIds.push(p.id); }
        }
        try {
          await hexDoc.update({
            [`flags.${MOD_T}.holdings`]: {
              rigIds:  nextRigIds,
              bossIds: nextBossIds,
              notes:   String(h.notes || ""),
              lastUpdated: Date.now()
            }
          });
          ui.notifications?.info(`Stationed ${picked.length} Holding${picked.length===1?"":"s"}.`);
          this.render({ force: false });
        } catch (eU) { warn("holdings: update failed", eU); ui.notifications?.error("Failed to station Holdings — see console."); }
      }, { capture:true, signal: sig });

      // Holdings remove — per-row × button.
      root.addEventListener("click", async (ev) => {
        let btn = null;
        try { btn = ev.target?.closest?.('[data-action="holdings-remove"]'); } catch (_e) { btn = null; }
        if (!btn) return;
        ev.preventDefault(); ev.stopPropagation();
        if (!game.user?.isGM) return;
        const hexDoc = this._hexDoc;
        if (!hexDoc) return;
        const id = String(btn.dataset.id || "").trim();
        const kind = String(btn.dataset.kind || "").toLowerCase();
        if (!id) return;

        if (kind === "boss") {
          const ok = await Dialog.confirm({
            title: "Remove Boss from Holdings",
            content: `<p>Remove this boss from the hex Holdings? The boss actor itself is not deleted — only the station reference.</p>`
          });
          if (!ok) return;
        }

        const tf = (hexDoc.flags && hexDoc.flags[MOD_T]) ? hexDoc.flags[MOD_T] : {};
        const h  = (tf.holdings && typeof tf.holdings === "object") ? tf.holdings : {};
        const nextRigIds  = (Array.isArray(h.rigIds)  ? h.rigIds  : []).filter(x => String(x) !== id);
        const nextBossIds = (Array.isArray(h.bossIds) ? h.bossIds : []).filter(x => String(x) !== id);
        try {
          await hexDoc.update({
            [`flags.${MOD_T}.holdings`]: {
              rigIds:  nextRigIds,
              bossIds: nextBossIds,
              notes:   String(h.notes || ""),
              lastUpdated: Date.now()
            }
          });
          this.render({ force: false });
        } catch (eU) { warn("holdings: remove failed", eU); ui.notifications?.error("Failed to remove Holding — see console."); }
      }, { capture:true, signal: sig });

      // Holdings Phase C (2026-05-14) — Deploy stationed Holdings as tokens
      // on the hex's bound battle scene. Tokens are actorLink:true so the
      // unified integrity damage path persists across rounds and scene
      // transitions. Resolution prefers canvas.scene (if bound to THIS hex),
      // else falls back to the hex's current bound scene per Phase 5.
      root.addEventListener("click", async (ev) => {
        let btn = null;
        try { btn = ev.target?.closest?.('[data-action="holdings-deploy"]'); } catch (_e) { btn = null; }
        if (!btn) return;
        ev.preventDefault(); ev.stopPropagation();
        if (!game.user?.isGM) return;
        const hexDoc = this._hexDoc;
        if (!hexDoc) return;
        try {
          btn.disabled = true;
          const r = await _hldDeployToScene(hexDoc);
          if (!r.ok) {
            if (r.error === "no bound battle scene") {
              ui.notifications?.warn("No bound battle scene. Bind one via the ⚔ Battle Scenes panel first.");
            } else if (r.error === "no Holdings to deploy") {
              ui.notifications?.warn("No Holdings stationed at this hex to deploy.");
            } else {
              ui.notifications?.error(`Deploy failed: ${r.error}`);
            }
            return;
          }
          const parts = [];
          parts.push(`Deployed ${r.created} Holding${r.created === 1 ? "" : "s"} to "${r.scene?.name || "scene"}".`);
          if (r.skipped?.length) parts.push(`Skipped ${r.skipped.length} already-present (${r.skipped.slice(0,3).join(", ")}${r.skipped.length>3?"…":""}).`);
          ui.notifications?.info(parts.join(" "));
        } catch (eD) { warn("holdings: deploy failed", eD); ui.notifications?.error("Deploy failed — see console."); }
        finally { try { btn.disabled = false; } catch(_e){} }
      }, { capture:true, signal: sig });

      // Holdings Phase C — Recall deployed tokens (those tagged with this
      // hex's holdingDeployment flag) from the bound battle scene.
      root.addEventListener("click", async (ev) => {
        let btn = null;
        try { btn = ev.target?.closest?.('[data-action="holdings-recall"]'); } catch (_e) { btn = null; }
        if (!btn) return;
        ev.preventDefault(); ev.stopPropagation();
        if (!game.user?.isGM) return;
        const hexDoc = this._hexDoc;
        if (!hexDoc) return;
        try {
          btn.disabled = true;
          const r = await _hldRecallFromScene(hexDoc);
          if (!r.ok) {
            if (r.error === "no bound battle scene") ui.notifications?.warn("No bound battle scene to recall from.");
            else ui.notifications?.error(`Recall failed: ${r.error}`);
            return;
          }
          if (!r.removed) ui.notifications?.info("No deployed Holdings to recall.");
          else ui.notifications?.info(`Recalled ${r.removed} Holding token${r.removed === 1 ? "" : "s"} from "${r.scene?.name || "scene"}".`);
        } catch (eR) { warn("holdings: recall failed", eR); ui.notifications?.error("Recall failed — see console."); }
        finally { try { btn.disabled = false; } catch(_e){} }
      }, { capture:true, signal: sig });

      // Build Units (Engineering) — Fortify / Repair / Asset.
      // Single canonical surface for hex BU spends; replaces the GM-only Hex Editor surface.
      root.addEventListener("click", async (ev) => {
        let btn = null;
        try {
          btn = (ev.target && ev.target.closest) ? ev.target.closest('[data-action="bu-spend"]') : null;
        } catch (e) { btn = null; }
        if (!btn) return;
        ev.preventDefault(); ev.stopPropagation();
        if (btn.disabled) return;

        const action = btn.getAttribute("data-bu-action");
        if (!action) return;

        const buApi = game?.bbttcc?.api?.territory?.buildUnits;
        if (!buApi?.spendForAction) {
          ui.notifications?.error?.("Build Units API not loaded.");
          return;
        }

        const hexDoc = this._hexDoc;
        if (!hexDoc) { ui.notifications?.warn?.("Hex doc not resolved."); return; }

        const tf = (hexDoc.flags && hexDoc.flags[MOD_T]) ? hexDoc.flags[MOD_T] : {};
        const factionId = tf.factionId || tf.ownerId || null;
        if (!factionId) { ui.notifications?.warn?.("This hex has no owning faction."); return; }

        try {
          btn.disabled = true;
          const res = await buApi.spendForAction({
            factionId,
            hexUuid: hexDoc.uuid,
            action,
            note: `Hex Sheet (Overview): ${action}`
          });
          if (res?.ok) {
            this.render({ force: false }); // refresh balance + buttons + modifiers
          }
        } catch (err) {
          console.warn("[bbttcc-hex-sheet] BU spend failed", err);
          ui.notifications?.error?.("BU spend failed — see console.");
        } finally {
          // If render fired, this btn is gone; harmless either way.
          try { btn.disabled = false; } catch (_e) {}
        }
      }, { capture:true, signal: sig });

      // ───────────── Pressure & Conditions — GM controls ─────────────
      // hex-rad / hex-dark nudge the canonical turn-engine stores
      // (flags.bbttcc-territory.mods.radiation / .darkness); hex-cond toggles
      // the named tag in flags.bbttcc-territory.conditions; hex-cond-clear
      // empties the tag list. Radiation keeps its "Radiated" tag in sync the
      // same way advance-turn.tracks.js does (tagged while > 0, cleared at 0).
      root.addEventListener("click", async (ev) => {
        let btn = null;
        try {
          btn = (ev.target && ev.target.closest)
            ? ev.target.closest('[data-action="hex-rad"],[data-action="hex-dark"],[data-action="hex-cond"],[data-action="hex-cond-clear"]')
            : null;
        } catch (e) { btn = null; }
        if (!btn) return;
        ev.preventDefault(); ev.stopPropagation();
        if (!game.user?.isGM) return;

        const doc = this._hexDoc;
        if (!doc) { ui.notifications?.warn("Hex doc not resolved."); return; }

        const action = String(btn.getAttribute("data-action") || "");
        const tf = (doc.flags && doc.flags[MOD_T]) ? doc.flags[MOD_T] : {};
        const mods = (tf.mods && typeof tf.mods === "object") ? foundry.utils.deepClone(tf.mods) : {};
        let conds = Array.isArray(tf.conditions) ? tf.conditions.slice() : [];

        if (action === "hex-rad") {
          const delta = Number(btn.getAttribute("data-delta") || 0) || 0;
          const next = Math.max(0, readRadiation(tf) + delta);
          mods.radiation = next;
          if (next > 0 && !conds.includes("Radiated")) conds.push("Radiated");
          if (next === 0) conds = conds.filter(c => c !== "Radiated");
        } else if (action === "hex-dark") {
          const delta = Number(btn.getAttribute("data-delta") || 0) || 0;
          mods.darkness = Math.max(0, readDarkness(tf) + delta);
        } else if (action === "hex-cond") {
          const name = String(btn.getAttribute("data-cond") || "").trim();
          if (!name) return;
          if (conds.includes(name)) {
            conds = conds.filter(c => c !== name);
            // Mirror the engine's invariant (Radiated ⇔ radiation > 0).
            if (name === "Radiated") mods.radiation = 0;
          } else {
            conds.push(name);
            // Spread floors freshly-Radiated hexes at 1 — do the same here.
            if (name === "Radiated") mods.radiation = Math.max(1, readRadiation(tf));
          }
        } else if (action === "hex-cond-clear") {
          conds = [];
        } else {
          return;
        }

        try {
          await doc.update({
            [`flags.${MOD_T}.mods`]: mods,
            [`flags.${MOD_T}.conditions`]: Array.from(new Set(conds))
          }, { parent: doc.parent });
          this.render({ force: false });
        } catch (eP) {
          warn("pressure control failed", eP);
          ui.notifications?.error("Pressure update failed — see console.");
        }
      }, { capture:true, signal: sig });

      root.addEventListener("click", async (ev) => {
        let img = null;
        try {
          img = (ev.target && ev.target.closest) ? ev.target.closest('[data-action="hex-image-edit"]') : null;
        } catch (e) { img = null; }
        if (!img) return;
        ev.preventDefault(); ev.stopPropagation();

        const doc = this._hexDoc;
        if (!doc) return;

        const isGM = !!(game.user && game.user.isGM);
        const FilePicker = (foundry && foundry.applications && foundry.applications.apps && foundry.applications.apps.FilePicker)
          ? foundry.applications.apps.FilePicker
          : (typeof window !== "undefined" ? window.FilePicker : null);
        const ImagePopout = (foundry && foundry.applications && foundry.applications.apps && foundry.applications.apps.ImagePopout)
          ? foundry.applications.apps.ImagePopout
          : (typeof window !== "undefined" ? window.ImagePopout : null);

        const cur = String(((doc.flags && doc.flags[MOD_T] && doc.flags[MOD_T].hexImage) || ""));

        if (!isGM) {
          if (cur && ImagePopout) {
            try { new ImagePopout({ src: cur, window: { title: (doc.flags && doc.flags[MOD_T] && doc.flags[MOD_T].name) || "Hex" } }).render({ force: true }); }
            catch (e) { try { new ImagePopout(cur, { title: "Hex" }).render(true); } catch (e2) {} }
          }
          return;
        }

        if (!FilePicker) {
          if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("FilePicker not available.");
          return;
        }
        try {
          const fp = new FilePicker({
            type: "image",
            current: cur || "",
            callback: async (path) => {
              try {
                await doc.update({ ["flags." + MOD_T + ".hexImage"]: String(path || "") }, { parent: doc.parent });
                this.render({ force: true });
              } catch (eUp) { warn("hex image save failed", eUp); }
            }
          });
          fp.render(true);
        } catch (eFP) { warn("FilePicker open failed", eFP); }
      }, { capture: true, signal: sig });

      // GM-only: Active Effects chips under Tracks & State
      try {
        if (!game.user || !game.user.isGM) {
          // skip (player view)
        } else {
        const doc = this._hexDoc;
        if (!doc) {
          // skip (no doc)
        } else {

        const curTurn = _readWorldTurn();
        const mods = Array.isArray(this._worldModifiers) ? this._worldModifiers : [];

        // Find the Tracks & State card by its header text
        const cards = root.querySelectorAll('.bbttcc-hex-card');
        let tracksCard = null;
        for (let i = 0; i < cards.length; i++) {
          const c = cards[i];
          const h = c ? c.querySelector('div') : null;
          const txt = h ? String(h.textContent || "").trim() : "";
          if (txt === "Tracks & State") { tracksCard = c; break; }
        }
        if (!tracksCard) {
          // No matching card (template changed). Skip chips — must not
          // `return` here: that bailed out of _onRender before the Quests
          // card below could inject (fixed 2026-07-07).
        } else {

        // Remove prior injected block
        const prev = tracksCard.querySelector('[data-bbttcc-worldmods="1"]');
        if (prev) prev.remove();

        const box = document.createElement('div');
        box.setAttribute('data-bbttcc-worldmods', '1');
        box.setAttribute('data-tour', 'hex.worldMods');
        box.style.marginTop = '10px';
        box.style.paddingTop = '8px';
        box.style.borderTop = '1px solid rgba(148,163,184,0.18)';

        const head = document.createElement('div');
        head.textContent = 'Active Effects';
        head.style.fontWeight = '800';
        head.style.marginBottom = '6px';
        _hexTipApply(head, 'worldMods');
        box.appendChild(head);

        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.flexWrap = 'wrap';
        wrap.style.gap = '6px';
        box.appendChild(wrap);

        if (!mods.length) {
          const none = document.createElement('div');
          none.textContent = 'None.';
          none.style.opacity = '0.75';
          none.style.fontSize = '12px';
          wrap.appendChild(none);
        } else {
          for (let i = 0; i < mods.length; i++) {
            const m = mods[i];
            if (!m || typeof m !== 'object') continue;
            const key = String(m.key || '').trim();
            if (!key) continue;

            const st = _classifyModifier(m, curTurn);

            const chip = document.createElement('button');
            chip.type = 'button';
            chip.setAttribute('data-action', 'toggle-world-mod');
            chip.setAttribute('data-mod-key', key);
            chip.className = 'bbttcc-pill';
            chip.style.cursor = 'pointer';
            chip.style.borderColor = 'rgba(59,130,246,0.75)';
            chip.style.color = '#93c5fd';
            chip.style.background = 'rgba(2,6,23,0.25)';
            chip.style.userSelect = 'none';

            let label = String(m.label || key);
            if (st.expired) label += ' (expired)';
            else if (st.exp > 0) label += ' (to T' + String(st.exp) + ')';
            chip.textContent = label;

            if (!st.enabled) chip.style.opacity = '0.45';
            else if (st.expired) chip.style.opacity = '0.55';

            _hexTipApply(chip, 'worldModChip');
            wrap.appendChild(chip);
          }
        }

        tracksCard.appendChild(box);

        // Toggle handler
        box.addEventListener('click', async (ev2) => {
          const btn = (ev2.target && ev2.target.closest) ? ev2.target.closest('[data-action="toggle-world-mod"][data-mod-key]') : null;
          if (!btn) return;
          ev2.preventDefault(); ev2.stopPropagation();

          const key = String(btn.getAttribute('data-mod-key') || '').trim();
          if (!key) return;

          try {
            const MOD_T2 = MOD_T;
            const tf2 = (doc.flags && doc.flags[MOD_T2]) ? foundry.utils.deepClone(doc.flags[MOD_T2]) : {};
            const arr2 = Array.isArray(tf2.worldModifiers) ? tf2.worldModifiers.slice() : [];
            let touched = false;
            for (let j = 0; j < arr2.length; j++) {
              const cur = arr2[j];
              if (!cur || typeof cur !== 'object') continue;
              if (String(cur.key || '') !== key) continue;
              cur.enabled = !(cur.enabled !== false);
              arr2[j] = cur;
              touched = true;
              break;
            }
            if (!touched) return;
            tf2.worldModifiers = arr2;
            await doc.update({ ['flags.' + MOD_T2]: tf2 }, { parent: doc.parent });
            this.render({ force: true });
          } catch (eToggle) {
            warn('toggle world modifier failed', eToggle);
          }
        }, { capture: true, signal: sig });
        }
        }
        }
      } catch (eMods) {
        // non-fatal
      }

      // ───────────── Quests card (Hex ↔ Quest links) ─────────────
      try {
        const doc = this._hexDoc;
        if (doc) {
          const ql = (game.bbttcc?.api?.territory?.questLinks) || null;
          const isGMUser = !!(game.user && game.user.isGM);
          const links = ql?.listQuestsForHex ? ql.listQuestsForHex(doc.id) : [];
          const visible = isGMUser ? links : links.filter(l => !doc.hidden || l.hinted);

          // Find the GM Notes card (last main-pane card) so we insert the
          // Quests card just above it. Falls back to appending to the main pane.
          const mainPane = root.querySelector('main.bbttcc-pane');
          if (mainPane) {
            const scroller = mainPane.querySelector('.bbttcc-pane-scroll') || mainPane;
            const prev = scroller.querySelector('[data-bbttcc-quests-card="1"]');
            if (prev) prev.remove();

            const card = document.createElement('div');
            card.className = 'bbttcc-hex-card';
            card.setAttribute('data-bbttcc-quests-card', '1');
            card.setAttribute('data-tour', 'hex.quests');

            const header = document.createElement('div');
            header.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;";
            const title = document.createElement('div');
            title.style.cssText = "font-weight:800;";
            title.innerHTML = "📜 Quests";
            _hexTipApply(title, 'quests');
            header.appendChild(title);
            if (isGMUser) {
              const linkBtn = document.createElement('button');
              linkBtn.type = "button";
              linkBtn.className = "bbttcc-btn bbttcc-btn-small";
              linkBtn.setAttribute('data-action', 'bbttcc-quest-link-add');
              linkBtn.textContent = "+ Link Quest";
              _hexTipApply(linkBtn, 'questLink');
              header.appendChild(linkBtn);
            }
            card.appendChild(header);

            if (!visible.length) {
              const empty = document.createElement('div');
              empty.className = "bbttcc-muted";
              empty.textContent = isGMUser ? "No quests linked to this hex." : "No quests known here.";
              card.appendChild(empty);
            } else {
              const list = document.createElement('div');
              list.style.cssText = "display:flex; flex-direction:column; gap:6px;";
              for (const q of visible) {
                const row = document.createElement('div');
                row.style.cssText = "display:grid; grid-template-columns: 1fr auto; gap:6px; align-items:center; padding:6px 8px; border:1px solid rgba(55,65,81,0.6); border-radius:8px; background:rgba(15,23,42,0.55);";
                const left = document.createElement('div');
                const name = document.createElement('div');
                name.style.cssText = "font-weight:700;";
                name.textContent = "📜 " + q.name;
                const status = document.createElement('span');
                status.style.cssText = "opacity:.6; font-size:.78rem; margin-left:6px;";
                status.textContent = "[" + q.status + "]";
                name.appendChild(status);
                if (isGMUser) {
                  const hintTag = document.createElement('span');
                  hintTag.style.cssText = "font-size:.74rem; margin-left:6px; padding:1px 6px; border-radius:6px; " +
                    (q.hinted ? "background:rgba(34,197,94,0.18); color:#86efac;" : "background:rgba(148,163,184,0.18); color:#cbd5e1;");
                  hintTag.textContent = q.hinted ? "hinted" : "fog-gated";
                  name.appendChild(hintTag);
                }
                left.appendChild(name);
                if (q.description) {
                  const desc = document.createElement('div');
                  desc.style.cssText = "opacity:.78; font-size:.78rem; margin-top:2px;";
                  desc.textContent = q.description;
                  left.appendChild(desc);
                }
                row.appendChild(left);

                const ctrls = document.createElement('div');
                ctrls.style.cssText = "display:flex; gap:4px; align-items:center;";
                if (isGMUser) {
                  const tBtn = document.createElement('button');
                  tBtn.type = "button";
                  tBtn.className = "bbttcc-btn bbttcc-btn-small";
                  tBtn.setAttribute('data-action', 'bbttcc-quest-toggle-hint');
                  tBtn.setAttribute('data-quest-id', q.questId);
                  tBtn.textContent = q.hinted ? "Hide Hint" : "Reveal Hint";
                  _hexTipApply(tBtn, 'questHint');
                  ctrls.appendChild(tBtn);

                  const uBtn = document.createElement('button');
                  uBtn.type = "button";
                  uBtn.className = "bbttcc-btn bbttcc-btn-small";
                  uBtn.setAttribute('data-action', 'bbttcc-quest-unlink');
                  uBtn.setAttribute('data-quest-id', q.questId);
                  uBtn.textContent = "Unlink";
                  _hexTipApply(uBtn, 'questUnlink');
                  ctrls.appendChild(uBtn);
                }
                row.appendChild(ctrls);
                list.appendChild(row);
              }
              card.appendChild(list);
            }

            // Insert before GM Notes card if found, else append.
            const cards = scroller.querySelectorAll('.bbttcc-hex-card');
            let gmNotesCard = null;
            for (const c of cards) {
              const head = c.querySelector('div');
              if (head && String(head.textContent || "").trim() === "GM Notes") { gmNotesCard = c; break; }
            }
            if (gmNotesCard && gmNotesCard.parentNode) {
              gmNotesCard.parentNode.insertBefore(card, gmNotesCard);
            } else {
              scroller.appendChild(card);
            }

            // Click handlers — GM only.
            if (isGMUser) {
              card.addEventListener('click', async (ev) => {
                const t = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
                if (!t) return;
                const action = t.getAttribute('data-action');
                if (!["bbttcc-quest-link-add","bbttcc-quest-toggle-hint","bbttcc-quest-unlink"].includes(action)) return;
                ev.preventDefault(); ev.stopPropagation();
                const api = game.bbttcc?.api?.territory?.questLinks;
                const cApi = game.bbttcc?.api?.campaign?.quests;
                if (!api) { ui.notifications?.error("Quest links API not loaded."); return; }

                if (action === "bbttcc-quest-toggle-hint") {
                  const qid = t.getAttribute('data-quest-id');
                  const cur = links.find(l => l.questId === qid);
                  await api.setHint(doc.id, qid, { hinted: !cur?.hinted });
                  this.render({ force: false });
                  return;
                }
                if (action === "bbttcc-quest-unlink") {
                  const qid = t.getAttribute('data-quest-id');
                  await api.unlinkHexQuest(doc.id, qid);
                  this.render({ force: false });
                  return;
                }
                if (action === "bbttcc-quest-link-add") {
                  const all = cApi?.listQuests ? cApi.listQuests({ status: "all" }) : [];
                  const linkedIds = new Set(links.map(l => l.questId));
                  const candidates = all.filter(q => !linkedIds.has(q.id));
                  if (!candidates.length) { ui.notifications?.warn("No unlinked quests available."); return; }
                  const opts = candidates
                    .map(q => `<option value="${q.id}">${q.name} [${q.status}]</option>`)
                    .join("");
                  const choice = await new Promise(resolve => {
                    new Dialog({
                      title: "Link Quest to Hex",
                      content: `<form>
                        <div class="form-group"><label>Quest</label><select name="qid">${opts}</select></div>
                        <div class="form-group"><label><input type="checkbox" name="hinted"> Reveal hint immediately (players see scroll on this hex even while fogged)</label></div>
                      </form>`,
                      buttons: {
                        ok: { label: "Link", callback: ($html) => {
                          const r = $html?.[0] ?? $html;
                          resolve({
                            qid: r?.querySelector?.('[name="qid"]')?.value || null,
                            hinted: !!r?.querySelector?.('[name="hinted"]')?.checked
                          });
                        }},
                        cancel: { label: "Cancel", callback: () => resolve(null) }
                      },
                      default: "ok"
                    }).render(true);
                  });
                  if (!choice?.qid) return;
                  await api.linkHexQuest(doc.id, choice.qid, { hinted: choice.hinted });
                  this.render({ force: false });
                  return;
                }
              }, { capture:true, signal: sig });
            }
          }
        }
      } catch (eQ) {
        warn("Quests card injection failed", eQ);
      }
    }

    async close(options) {
      try {
        if (this.__hexImprovementHookId != null) {
          Hooks.off("bbttcc:hexImprovement", this.__hexImprovementHookId);
          this.__hexImprovementHookId = null;
        }
      } catch (_eHk) {}

      try {
        const key = this.hexUuid;
        if (game.bbttcc && game.bbttcc.apps && game.bbttcc.apps.hexSheets && game.bbttcc.apps.hexSheets[key] === this) {
          delete game.bbttcc.apps.hexSheets[key];
        }
      } catch (e) {}

      try {
        if (Object.getOwnPropertyDescriptor(globalThis, "__bbttcc_dashboard")) delete globalThis.__bbttcc_dashboard;
        if (Object.getOwnPropertyDescriptor(globalThis, "__bbttcc_dashboard_opening")) delete globalThis.__bbttcc_dashboard_opening;
        if (Object.getOwnPropertyDescriptor(globalThis, "__bbttcc_dashboardOpening")) delete globalThis.__bbttcc_dashboardOpening;
        if (Object.getOwnPropertyDescriptor(globalThis, "__bbttcc_dashboard_lock")) delete globalThis.__bbttcc_dashboard_lock;
        if (Object.getOwnPropertyDescriptor(globalThis, "__bbttcc_dashboardLock")) delete globalThis.__bbttcc_dashboardLock;
      } catch (e) {}

      return super.close(options);
    }
  }

  Hooks.once("ready", function () {
    ensureNS();

    // Central help registry (bbttcc-core). Order-safe + guarded: if the
    // registry is absent (core disabled) the sheet simply renders without
    // hover help.
    try { game.bbttcc?.help?.register?.("hex", HEX_TIPS); } catch (_eHelp) {}

    game.bbttcc.api.territory.openHexSheet = function (hexUuid) {
      if (!hexUuid) {
        if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("openHexSheet: hexUuid required.");
        return null;
      }
      const key = String(hexUuid);

      const existing = game.bbttcc.apps.hexSheets[key];
      if (existing) {
        // Reuse only a live app. A stale cache entry with a detached DOM
        // used to swallow the open-click entirely (fixed 2026-07-07).
        const el = (existing.element instanceof HTMLElement) ? existing.element : (existing.element && existing.element[0]);
        if (existing.rendered || (el && el.isConnected)) {
          existing.render({ force: true, focus: true });
          return existing;
        }
        delete game.bbttcc.apps.hexSheets[key];
      }

      const app = new BBTTCC_HexSheet(key);
      game.bbttcc.apps.hexSheets[key] = app;
      app.render({ force: true, focus: true });
      return app;
    };

    log("Hex Sheet 3.6 installed (Dossier + Planner deep-link).");
  });
})();

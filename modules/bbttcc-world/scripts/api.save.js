// modules/bbttcc-world/scripts/api.save.js
// Bad Eden — SAVE GAME (2026-09-08, owner request: "a legit save game that
// snapshots EVERYTHING and brings back everything exactly as it was").
//
// A save slot is ONE JSON file under Data/bbttcc-saves/<worldId>/ holding:
//   settings  — every WORLD-scope setting registered by a Bad Eden namespace
//               (bbttcc-*, fourththing, surge-powers): campaigns, quests, tables,
//               director state (fired beats, invites, choices), injector state,
//               story phase, turn, meters, ledger, Turn Press editions…
//   actors    — every Actor in full (system, flags, ownership, prototype
//               token, ITEMS and EFFECTS): stewards' level/feats/equipment,
//               factions' tier/caps/bank/VP/holdings, NPCs, bestiary…
//   scenes    — every Scene's flags + its DRAWINGS (the hexes) and TOKENS in
//               full — hexes on every scene, not just the current one.
//   journal   — journal entries carrying a Bad Eden flag (Turn Press etc.).
// Restore is EXACT by default: documents are updated non-recursively (keys
// that vanished are removed), embedded items/effects/drawings/tokens are
// replaced wholesale with their saved ids, and actors that did not exist at
// save time are deleted (opt-out). Scenes are never deleted. After a load the
// GM's client — and every connected client — reloads, because modules cache
// state in memory.
//
// Storage is a FILE, not a setting: settings are broadcast to every client on
// change and a save can be tens of MB. The small index (labels, sizes, which
// slot is the GOLDEN MASTER) lives in the world setting `bbttcc-world.saveIndex`.
// Foundry has no file-delete API, so "delete" overwrites the file with a stub
// and drops the index row.
//
// LAYERS (2026-10-14, owner: "changes to game functionality should survive a load;
// the golden master is a giant undo-story button"): every captured thing is
// either STORY (the play-through: turn, phase, director/quest ledgers, stewards,
// factions, rigs, hex ownership/builds/pressure, tokens, Turn Press) or GAME
// (the authored game: campaigns bundle, tables, catalog, vendors, facilitation,
// tuning knobs, Mal Voice config, library NPCs, hex definitions, travel links).
//   load(id, {mode:"story"})  — the default in the Save Games window and for
//                               ⟲ Load golden master: restores STORY only.
//   load(id, {mode:"exact"})  — the 2026-09-08 behaviour: everything, exactly
//                               (API default, so runner macros are unchanged).
// A save still CAPTURES both layers (it is a full backup either way), except
// the God Panel snapshot store and the Mal Voice call log, which are neither.
// Classification: settings — `bbttcc.layer` on the registration wins, then the
// GAME_SETTINGS table below, else STORY (so a new key is reset by default);
// actors — `flags.bbttcc-world.layer` wins, then character/rig/faction = STORY,
// other npc = GAME; hexes — HEX_DEF_KEYS stay live, every other territory key
// comes from the save; live-only hexes are never deleted, saved hexes missing
// live are not re-created, geometry/text/travel links stay live.
// QUEST REGISTRY SPLIT (2026-10-14): `bbttcc-campaign.quests` is GAME (quest
// definitions — 56 records identical across 8 turns of play in the 10-13
// saves; the play state lives on the factions' coalition track and the hexes).
// A story load merges only its per-record status/completedTs/completedTurn
// from the save (STATE_OVERLAYS); live-only records (new quests) stay as
// authored. The hex-side link map `flags.bbttcc-territory.quests` is likewise
// definition, with hinted/hintTs merged from the save.
//
// API: game.bbttcc.api.world.saves.{list, save, load, plan, setGolden, remove,
//      exportSlot, importFile, golden, open, layers}
(() => {
  const MOD = "bbttcc-world";
  const TAG = "[bbttcc-world/save]";
  const SETTING_INDEX = "saveIndex";
  const log  = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);

  const OUR_NS = (ns) => /^bbttcc-/.test(ns) || ns === "fourththing" || ns === "surge-powers";
  const FP = () => (foundry?.applications?.apps?.FilePicker?.implementation) || foundry?.applications?.apps?.FilePicker || globalThis.FilePicker;
  const worldId = () => String(game.world?.id || "world");
  const saveDir = () => `bbttcc-saves/${worldId()}`;
  const randId = () => foundry.utils.randomID(12);
  const clone = (o) => foundry.utils.deepClone(o);
  const isGM = () => !!game.user?.isGM;

  // ── layers ───────────────────────────────────────────────────────────────
  // Never captured — not story, not game (snapshot store = saves of saves; call log = billing noise).
  const EXCLUDE_SETTINGS = new Set(["bbttcc-world.worldSnapshots", "bbttcc-mal-voice.callLog"]);
  // GAME-layer settings: left alone by a story load. Namespace-wide entries end in ".*".
  const GAME_SETTINGS = [
    "fourththing.*", "surge-powers.*", "bbttcc-mal-voice.*",
    "bbttcc-campaign.campaigns", "bbttcc-campaign.encounterTables", "bbttcc-campaign.quests",
    "bbttcc-campaign.facilitation.policy", "bbttcc-campaign.facilitation.mode",
    "bbttcc-campaign.director.enabled", "bbttcc-campaign.director.autoInvite", "bbttcc-campaign.director.pressureThreshold",
    "bbttcc-campaign.director.sealDoneActs", "bbttcc-campaign.director.sealCompletedQuests", "bbttcc-campaign.director.turnTickOnlyChains",
    "bbttcc-campaign.overshoot.drawsBeats", "bbttcc-campaign.invites.playerAccept",
    "bbttcc-campaign.ledger.travelDaysPerTier", "bbttcc-campaign.ledger.turnTimeBudget",
    "bbttcc-market.catalog", "bbttcc-market.vendors", "bbttcc-market.deliveryFeeBase", "bbttcc-market.deliveryFeePerDanger", "bbttcc-market.catalogMarksMigrated",
    "bbttcc-territory.hexFogColor", "bbttcc-territory.hexFogEnabled", "bbttcc-territory.hexFogAlpha", "bbttcc-territory.tableAnnouncements",
    "bbttcc-territory.questMarkers", "bbttcc-territory.districtYieldShare", "bbttcc-territory.townbuilderChargeMaterials",
    "bbttcc-territory.townbuilderBuCostT1", "bbttcc-territory.townbuilderBuCostT2", "bbttcc-territory.townbuilderBuCostT3",
    "bbttcc-territory.buildUnitCostRepair", "bbttcc-territory.buildUnitCostFortify", "bbttcc-territory.buildUnitCostAsset",
    "bbttcc-core.travelTierSource", "bbttcc-core.travelDomainGate", "bbttcc-core.travelEncounterBaseDC", "bbttcc-core.travelEncounterTierStep",
    "bbttcc-core.gmEditMode", "bbttcc-core.gmAuditLog",
    "bbttcc-raid.directionalArtOnRotate", "bbttcc-raid.directionalArtOnMove",
    "bbttcc-radiation.rpStoreUnified", "bbttcc-radiation.enableZoneDrift",
    "bbttcc-travel.doorsPlayerActivate",
    "bbttcc-factions.opRelayStrict", "bbttcc-factions.autoRelationshipNudge", "bbttcc-factions.fairTradeTolerance",
    "bbttcc-factions.nudgeCooldownHours", "bbttcc-factions.expireSweepIntervalMinutes",
    "bbttcc-onboarding.wakeThemeSrc", "bbttcc-onboarding.campaignWakeBeatId", "bbttcc-onboarding.campaignResumeBeatId",
    "bbttcc-onboarding.offerOnReady", "bbttcc-onboarding.operatorAudience",
    "bbttcc-epic.protagonistFactions", "bbttcc-epic.daathSceneId"
  ];
  // GAME settings that carry a little play state inside: a story load keeps the live value and merges only these keys.
  // Values are sometimes JSON strings (🪤 2026-09-09) — decode, merge, re-encode in the live value's shape.
  const asObj = (v) => { if (typeof v === "string") { try { return { obj: JSON.parse(v), str: true }; } catch (_e) { return { obj: null, str: true }; } } return { obj: (v && typeof v === "object") ? v : null, str: false }; };
  const QUEST_STATE_KEYS = ["status", "completedTs", "completedTurn"];
  const STATE_OVERLAYS = {
    "bbttcc-campaign.quests": (liveVal, savedVal) => {
      const L = asObj(liveVal), S = asObj(savedVal);
      if (!L.obj || !S.obj) return liveVal;
      const out = clone(L.obj);
      for (const [id, sq] of Object.entries(S.obj)) {
        const lq = out[id]; if (!lq || typeof lq !== "object" || !sq || typeof sq !== "object") continue;   // live-only = new definition, stays; saved-only = deleted since, stays gone
        for (const k of QUEST_STATE_KEYS) { if (k in sq) lq[k] = clone(sq[k]); else delete lq[k]; }
      }
      return L.str ? JSON.stringify(out) : out;
    }
  };
  const GAME_NS = new Set(GAME_SETTINGS.filter(k => k.endsWith(".*")).map(k => k.slice(0, -2)));
  const GAME_KEYS = new Set(GAME_SETTINGS.filter(k => !k.endsWith(".*")));
  function settingLayer(ns, key) {
    const full = `${ns}.${key}`;
    if (EXCLUDE_SETTINGS.has(full) || (ns === MOD && key === SETTING_INDEX)) return "exclude";
    try {
      const tag = game.settings.settings.get(full)?.bbttcc?.layer;
      if (tag === "game" || tag === "story") return tag;
    } catch (_e) {}
    if (GAME_KEYS.has(full) || GAME_NS.has(ns)) return "game";
    return "story";
  }
  // Actors: stewards (character), rigs and faction actors are the play-through; every other npc is the library.
  function actorLayer(a) {
    const flags = a?.flags || {};
    const tag = flags["bbttcc-world"]?.layer;
    if (tag === "game" || tag === "story") return tag;
    if (a?.type === "character" || a?.type === "rig") return "story";
    if (flags["bbttcc-factions"]?.isFaction === true) return "story";
    return "game";
  }
  // Hex drawings: these territory keys DEFINE the hex (stay live); everything else is play state (from the save).
  const HEX_DEF_KEYS = ["isHex", "kind", "name", "type", "terrain", "terrainType", "terrainKey", "notes", "hexImage", "createdAt",
    "resourceNodes", "resources", "size", "capital", "population", "campaign", "quests"];
  const HEX_LEYLINE_STATE = ["flowState", "purity", "memoryCharge"];   // placement/resonance stay live; charge + gate state are play
  const isHexFlags = (f) => !!(f && typeof f["bbttcc-territory"] === "object" && f["bbttcc-territory"]);
  function storyFlagsForDrawing(liveFlags, savedFlags) {
    const out = clone(liveFlags || {});   // every scope from live: travel links, campaign hooks, onboarding, raid tableau
    const sT = savedFlags?.["bbttcc-territory"], lT = liveFlags?.["bbttcc-territory"];
    if (sT && typeof sT === "object") {
      const t = {};
      if (lT) for (const k of HEX_DEF_KEYS) if (k in lT) t[k] = clone(lT[k]);
      for (const [k, v] of Object.entries(sT)) if (!HEX_DEF_KEYS.includes(k)) t[k] = clone(v);   // live-only state keys drop
      if (lT?.leylines || sT.leylines) {
        const ll = clone(lT?.leylines ?? sT.leylines ?? {}); const sl = sT.leylines || {};
        for (const k of HEX_LEYLINE_STATE) if (k in sl) ll[k] = clone(sl[k]);
        if (sl.gate && typeof sl.gate === "object") ll.gate = Object.assign({}, ll.gate || {}, { enabled: sl.gate.enabled, locked: sl.gate.locked });
        t.leylines = ll;
      }
      // quest links: which quests point at this hex is authored (live); whether a link was hinted in play is state (save)
      if (lT?.quests && typeof lT.quests === "object") {
        const q = clone(lT.quests); const sq = (sT.quests && typeof sT.quests === "object") ? sT.quests : {};
        for (const [qid, e] of Object.entries(q)) { if (!e || typeof e !== "object") continue; const se = sq[qid]; e.hinted = !!se?.hinted; e.hintTs = se?.hintTs ?? null; }
        t.quests = q;
      }
      out["bbttcc-territory"] = t;
    }
    const sR = savedFlags?.["bbttcc-raid"];
    if (sR && typeof sR === "object" && "currentSceneIdx" in sR) out["bbttcc-raid"] = Object.assign({}, out["bbttcc-raid"] || {}, { currentSceneIdx: sR.currentSceneIdx });
    return out;
  }
  const layers = { setting: settingLayer, actor: actorLayer, drawingFlags: storyFlagsForDrawing, overlay: (ns, key, live, saved) => (STATE_OVERLAYS[`${ns}.${key}`] ? STATE_OVERLAYS[`${ns}.${key}`](live, saved) : undefined),
    GAME_SETTINGS, EXCLUDE_SETTINGS: [...EXCLUDE_SETTINGS], STATE_OVERLAY_KEYS: Object.keys(STATE_OVERLAYS), HEX_DEF_KEYS, HEX_LEYLINE_STATE, QUEST_STATE_KEYS };

  // ── index ────────────────────────────────────────────────────────────────
  function readIndex() {
    try {
      const v = game.settings.get(MOD, SETTING_INDEX);
      const o = (v && typeof v === "object") ? clone(v) : {};
      o.slots = Array.isArray(o.slots) ? o.slots : [];
      return o;
    } catch (_e) { return { slots: [] }; }
  }
  async function writeIndex(idx) { await game.settings.set(MOD, SETTING_INDEX, idx); return idx; }
  function list() {
    const idx = readIndex();
    return idx.slots.slice().sort((a, b) => (b.golden ? 1 : 0) - (a.golden ? 1 : 0) || (Number(b.at) || 0) - (Number(a.at) || 0));
  }
  function golden() { return readIndex().slots.find(s => s.golden) || null; }

  // ── file plumbing ────────────────────────────────────────────────────────
  async function ensureDir() {
    const fp = FP();
    const parts = saveDir().split("/");
    let path = "";
    for (const p of parts) {
      path = path ? `${path}/${p}` : p;
      try { await fp.browse("data", path); }
      catch (_e) { try { await fp.createDirectory("data", path); } catch (e2) { if (!/EEXIST|exists/i.test(String(e2?.message || e2))) throw e2; } }
    }
    return saveDir();
  }
  async function writeFile(name, text) {
    const fp = FP();
    const dir = await ensureDir();
    const file = new File([text], name, { type: "application/json" });
    const res = await fp.upload("data", dir, file, {}, { notify: false });
    if (!res?.path) throw new Error("upload returned no path");
    return res.path;
  }
  async function readFile(path) {
    const url = foundry.utils.getRoute ? foundry.utils.getRoute(path) : `/${path}`;
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`fetch ${path}: HTTP ${resp.status}`);
    return await resp.json();
  }

  // ── capture ──────────────────────────────────────────────────────────────
  function captureSettings() {
    const out = [];
    for (const [fullKey, cfg] of game.settings.settings.entries()) {
      try {
        if (!cfg || cfg.scope !== "world") continue;
        const ns = String(cfg.namespace || fullKey.split(".")[0]);
        if (!OUR_NS(ns)) continue;
        const key = String(cfg.key || fullKey.slice(ns.length + 1));
        if (settingLayer(ns, key) === "exclude") continue;   // the index, the snapshot store, the call log
        let value = game.settings.get(ns, key);
        if (value && typeof value === "object" && typeof value.toObject === "function") value = value.toObject();
        out.push({ ns, key, value: clone(value) });
      } catch (e) { warn("setting capture skipped", fullKey, e); }
    }
    return out;
  }
  const SCENE_STRIP = ["walls", "lights", "sounds", "templates", "notes", "tiles", "regions", "thumb"];
  function captureScene(scene) {
    const o = scene.toObject();
    for (const k of SCENE_STRIP) delete o[k];
    return o;   // keeps _id, name, flags, drawings[], tokens[], and the scene's own fields
  }
  function hasOurFlags(doc) {
    const f = doc?.flags || {};
    return Object.keys(f).some(OUR_NS);
  }
  function capture(opts = {}) {
    const settings = captureSettings();
    const actors = game.actors.map(a => a.toObject());
    const scenes = game.scenes.map(captureScene);
    const journal = game.journal.filter(hasOurFlags).map(j => j.toObject());
    const counts = {
      settings: settings.length,
      actors: actors.length,
      items: actors.reduce((n, a) => n + (a.items?.length || 0), 0),
      scenes: scenes.length,
      drawings: scenes.reduce((n, s) => n + (s.drawings?.length || 0), 0),
      tokens: scenes.reduce((n, s) => n + (s.tokens?.length || 0), 0),
      journal: journal.length
    };
    return {
      kind: "bbttcc-savegame", v: 1,
      id: randId(), label: String(opts.label || "").trim() || `Save ${new Date().toLocaleString()}`,
      note: String(opts.note || ""), at: Date.now(), by: String(game.user?.name || ""),
      world: worldId(), foundry: String(game.version || ""),
      turn: (() => { try { return Number(game.bbttcc?.api?.world?.getState?.()?.turn) || 0; } catch (_e) { return 0; } })(),
      storyPhase: (() => { try { return Number(game.settings.get("bbttcc-campaign", "storyPhase")) || 0; } catch (_e) { return 0; } })(),
      counts, settings, actors, scenes, journal
    };
  }

  async function save(opts = {}) {
    if (!isGM()) throw new Error("GM only");
    const snap = capture(opts);
    const text = JSON.stringify(snap);
    const name = `${snap.id}.json`;
    const path = await writeFile(name, text);
    const idx = readIndex();
    const row = { id: snap.id, label: snap.label, note: snap.note, at: snap.at, by: snap.by, path, bytes: text.length,
      turn: snap.turn, storyPhase: snap.storyPhase, counts: snap.counts, golden: false };
    if (opts.golden) { for (const s of idx.slots) s.golden = false; row.golden = true; }
    idx.slots.push(row);
    await writeIndex(idx);
    log("saved", row);
    return row;
  }

  // ── restore ──────────────────────────────────────────────────────────────
  const stripDoc = (o) => { const d = clone(o); delete d._id; delete d._stats; delete d.items; delete d.effects; delete d.pages; delete d.drawings; delete d.tokens; return d; };
  const sameJson = (a, b) => { try { return JSON.stringify(a) === JSON.stringify(b); } catch (_e) { return false; } };
  const folderOk = (folderId) => !folderId || !!game.folders.get(folderId);

  async function load(id, opts = {}) {
    let res;
    try { res = await _loadInner(id, opts); }
    finally { try { game.bbttcc.restoring = false; Hooks.callAll("bbttcc:restore:end", { id }); } catch (_e) {} }
    // 2026-10-18: a restore re-creates every steward's gear rows exactly as the snapshot held them — a snapshot taken
    // before stack-on-add (or mid-shopping) resurrects duplicate lines (Marginalia came back with 32 rows for 7 items).
    // Fold them straight back into ×N lines through the system's own merge.
    try {
      const merge = game.fourththing?.stack?.merge;
      if (game.user?.isGM && typeof merge === "function") {
        let merged = 0, deleted = 0;
        for (const a of (game.actors?.contents ?? [])) { if (a.type !== "character") continue; const r = await merge(a); merged += Number(r?.merged) || 0; deleted += Number(r?.deleted) || 0; }
        if (deleted) console.log("[bbttcc-world] restore: re-stacked", merged, "gear group(s),", deleted, "duplicate row(s) folded");
      }
    } catch (e) { console.warn("[bbttcc-world] post-restore re-stack failed", e); }
    return res;
  }
  async function replaceEmbedded(parent, type, savedArr) {
    const coll = parent.getEmbeddedCollection(type);
    const cur = coll.map(d => d.toObject());
    if (sameJson(cur, savedArr)) return 0;
    const ids = coll.map(d => d.id);
    // bbttccRestore on the DELETE too: deleteToken listeners (raid muster refunds, crew
    // release) must stand down, or they credit the just-restored faction pools.
    if (ids.length) await parent.deleteEmbeddedDocuments(type, ids, { bbttccRestore: true });
    if (savedArr?.length) await parent.createEmbeddedDocuments(type, savedArr, { keepId: true, bbttccRestore: true });   // restore mode: creation hooks stand down (2026-09-12)
    return 1;
  }

  // What a load would do — shown in the confirm.
  const modeOf = (opts) => (opts?.mode === "story" ? "story" : "exact");
  function plan(snap, opts = {}) {
    const mode = modeOf(opts); const story = mode === "story";
    // settings — per layer
    const settingsChangeList = [], settingsKeepList = [], settingsMergeList = [];
    let settingsUnknown = 0;
    for (const s of snap.settings) {
      const full = `${s.ns}.${s.key}`;
      if (!game.settings.settings.has(full)) { settingsUnknown++; continue; }
      const layer = settingLayer(s.ns, s.key);
      if (layer === "exclude") continue;
      let live; try { live = game.settings.get(s.ns, s.key); } catch (_e) {}
      if (sameJson(live, s.value)) continue;
      if (story && layer === "game") {
        const ov = STATE_OVERLAYS[full];
        if (ov && !sameJson(live, ov(live, s.value))) settingsMergeList.push(full); else settingsKeepList.push(full);
      } else settingsChangeList.push(full);
    }
    // actors — per layer
    const savedActorIds = new Set(snap.actors.map(a => a._id));
    const touched = snap.actors.filter(a => !story || actorLayer(a) === "story");
    const actorsUpdate = touched.filter(a => game.actors.get(a._id)).length;
    const actorsCreate = touched.length - actorsUpdate;
    const actorsKept = snap.actors.length - touched.length;
    const extras = game.actors.filter(a => !savedActorIds.has(a.id));
    const actorsDelete = extras.filter(a => !story || actorLayer(a) === "story").map(a => a.name);
    const actorsDeleteGame = story ? extras.filter(a => actorLayer(a) === "game").map(a => a.name) : [];
    // scenes + hexes
    const scenesKnown = snap.scenes.filter(s => game.scenes.get(s._id)).length;
    const scenesMissing = snap.scenes.filter(s => !game.scenes.get(s._id)).map(s => s.name);
    const scenesExtra = game.scenes.filter(s => !snap.scenes.some(x => x._id === s.id)).map(s => s.name);
    let hexesMerged = 0, hexesLiveOnly = 0, hexesSavedMissing = 0;
    if (story) for (const s of snap.scenes) {
      const scene = game.scenes.get(s._id); if (!scene) continue;
      const savedHex = (s.drawings || []).filter(d => isHexFlags(d.flags));
      const savedIds = new Set(savedHex.map(d => d._id));
      for (const d of savedHex) { if (scene.drawings.get(d._id)) hexesMerged++; else hexesSavedMissing++; }
      hexesLiveOnly += scene.drawings.filter(d => isHexFlags(d.flags) && !savedIds.has(d.id)).length;
    }
    const others = game.users.filter(u => u.active && u.id !== game.user.id).map(u => u.name);
    return { mode, actorsUpdate, actorsCreate, actorsKept, actorsDelete, actorsDeleteGame, scenesKnown, scenesMissing, scenesExtra,
      settingsChange: settingsChangeList.length, settingsKeep: settingsKeepList.length, settingsMerge: settingsMergeList.length, settingsChangeList, settingsKeepList, settingsMergeList, settingsUnknown,
      hexesMerged, hexesLiveOnly, hexesSavedMissing, journal: snap.journal.length, others };
  }

  async function _loadInner(id, opts = {}) {
    if (!isGM()) throw new Error("GM only");
    const row = readIndex().slots.find(s => s.id === id);
    if (!row) throw new Error("save not found in index");
    const snap = await readFile(row.path);
    if (snap?.kind !== "bbttcc-savegame") throw new Error("not a Bad Eden save file");
    const mode = modeOf(opts); const story = mode === "story";
    const deleteExtras = opts.deleteExtras !== false;            // story-layer actors made since the save
    const deleteGameExtras = story ? opts.deleteGameExtras === true : deleteExtras;   // library npcs made since the save: opt-IN on a story load
    const progress = typeof opts.progress === "function" ? opts.progress : (() => {});
    const report = { mode, settings: 0, settingsKept: 0, settingsMerged: 0, actorsUpdated: 0, actorsCreated: 0, actorsKept: 0, actorsDeleted: 0, itemsReplaced: 0, scenes: 0, drawings: 0, hexesMerged: 0, tokens: 0, journal: 0, errors: [] };
    game.bbttcc = game.bbttcc || {};
    game.bbttcc.saveRestoreActive = true;
    // RESTORE MODE (fix-the-boat item 4, 2026-09-12): a restore recreates every document; hooks that
    // treat 'created' as 'new' (territory's pristine-hex defaults, raid's post→turn normalizer) must
    // stand down. game.bbttcc.restoring + bbttccRestore create option + bbttcc:restore:begin/end.
    game.bbttcc ??= {}; game.bbttcc.restoring = true; try { Hooks.callAll("bbttcc:restore:begin", { id }); } catch (_e) {}
    try {
      // 1. settings (world state, campaigns, director ledgers…)
      progress("settings", 0, snap.settings.length);
      for (const s of snap.settings) {
        try {
          if (!game.settings.settings.has(`${s.ns}.${s.key}`)) continue;
          const layer = settingLayer(s.ns, s.key);
          if (layer === "exclude") continue;
          const live = game.settings.get(s.ns, s.key);
          if (sameJson(live, s.value)) continue;
          if (story && layer === "game") {
            const ov = STATE_OVERLAYS[`${s.ns}.${s.key}`];
            const merged = ov ? ov(live, s.value) : undefined;
            if (merged === undefined || sameJson(live, merged)) { report.settingsKept++; continue; }
            await game.settings.set(s.ns, s.key, merged); report.settingsMerged++; continue;   // game setting, play-state keys only
          }
          await game.settings.set(s.ns, s.key, s.value);
          report.settings++;
        } catch (e) { report.errors.push(`setting ${s.ns}.${s.key}: ${e?.message || e}`); }
      }

      // 2. actors — update in place (identity kept for linked tokens), create
      //    the missing with their saved ids, delete the extras.
      let n = 0;
      for (const a of snap.actors) {
        progress("actors", ++n, snap.actors.length);
        if (story && actorLayer(a) === "game") { report.actorsKept++; continue; }
        try {
          const existing = game.actors.get(a._id);
          const body = stripDoc(a);
          if (!folderOk(body.folder)) body.folder = null;
          if (existing) {
            const curBody = stripDoc(existing.toObject());
            if (!sameJson(curBody, body)) { await existing.update(body, { diff: false, recursive: false }); report.actorsUpdated++; }
            report.itemsReplaced += await replaceEmbedded(existing, "Item", a.items || []);
            await replaceEmbedded(existing, "ActiveEffect", a.effects || []);
          } else {
            const data = clone(a); delete data._stats;
            if (!folderOk(data.folder)) data.folder = null;
            await Actor.implementation.create(data, { keepId: true });
            report.actorsCreated++;
          }
        } catch (e) { report.errors.push(`actor ${a.name}: ${e?.message || e}`); }
      }
      if (deleteExtras || deleteGameExtras) {
        const savedIds = new Set(snap.actors.map(a => a._id));
        const extras = game.actors.filter(x => !savedIds.has(x.id))
          .filter(x => (actorLayer(x) === "story") ? deleteExtras : deleteGameExtras).map(x => x.id);
        if (extras.length) { try { await Actor.implementation.deleteDocuments(extras); report.actorsDeleted = extras.length; } catch (e) { report.errors.push(`delete actors: ${e?.message || e}`); } }
      }

      // 3. scenes — flags + drawings (hexes) + tokens, every scene in the save.
      n = 0;
      for (const s of snap.scenes) {
        progress("scenes", ++n, snap.scenes.length);
        const scene = game.scenes.get(s._id);
        if (!scene) continue;
        try {
          if (story) {
            // STORY: the scene itself (art, dimensions, flags = hub/tableau/board wiring) stays live. Hexes that exist
            // in both get definition-from-live + state-from-save flags; live-only hexes stay; saved-missing stay gone.
            const updates = [];
            for (const d of (s.drawings || [])) {
              if (!isHexFlags(d.flags)) continue;
              const live = scene.drawings.get(d._id); if (!live) continue;
              const flags = storyFlagsForDrawing(live.toObject().flags, d.flags);
              if (!sameJson(live.toObject().flags, flags)) updates.push({ _id: d._id, flags });
            }
            if (updates.length) { await scene.updateEmbeddedDocuments("Drawing", updates, { diff: false, recursive: false, bbttccRestore: true }); report.hexesMerged += updates.length; }
          } else {
            const body = stripDoc(s);
            if (!folderOk(body.folder)) body.folder = null;
            delete body.active;   // which scene is active is the GM's business, not the save's
            const curBody = stripDoc(captureScene(scene)); delete curBody.active;
            if (!sameJson(curBody, body)) await scene.update(body, { diff: false, recursive: false });
            report.drawings += await replaceEmbedded(scene, "Drawing", s.drawings || []) ? (s.drawings?.length || 0) : 0;
          }
          report.tokens += await replaceEmbedded(scene, "Token", s.tokens || []) ? (s.tokens?.length || 0) : 0;
          report.scenes++;
        } catch (e) { report.errors.push(`scene ${s.name}: ${e?.message || e}`); }
      }

      // 4. journal entries carrying our flags (Turn Press editions etc.)
      for (const j of snap.journal) {
        try {
          const existing = game.journal.get(j._id);
          const body = stripDoc(j);
          if (!folderOk(body.folder)) body.folder = null;
          if (existing) {
            if (!sameJson(stripDoc(existing.toObject()), body)) await existing.update(body, { diff: false, recursive: false });
            await replaceEmbedded(existing, "JournalEntryPage", j.pages || []);
          } else {
            const data = clone(j); delete data._stats;
            if (!folderOk(data.folder)) data.folder = null;
            await JournalEntry.implementation.create(data, { keepId: true });
          }
          report.journal++;
        } catch (e) { report.errors.push(`journal ${j.name}: ${e?.message || e}`); }
      }
      // 5. chat hygiene (2026-09-09): saves don't carry chat, so invitation cards
      //    written AFTER this slot still show live Accept buttons — but their
      //    Director once-gates were just rolled back. Seal them.
      try {
        const cutoff = Number(snap.at) || 0; report.staleCards = 0;
        for (const m of game.messages ?? []) {
          const inv = m.getFlag?.("bbttcc-campaign", "talkInvite");
          if (!inv || inv.accepted || inv.stale) continue;
          if (Number(m.timestamp) > cutoff) { await m.setFlag("bbttcc-campaign", "talkInvite", Object.assign({}, inv, { stale: true, staleReason: `loaded save "${row.label}"` })); report.staleCards++; }
        }
      } catch (e) { report.errors.push(`chat hygiene: ${e?.message || e}`); }
    } finally {
      game.bbttcc.saveRestoreActive = false;
    }
    log("loaded", row.label, report);
    try {
      await ChatMessage.create({
        whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
        content: `<div class="bbttcc-card"><b>${story ? "⟲ Story reset to" : "💾 Save loaded"}: ${foundry.utils.escapeHTML(row.label)}</b><br/>` +
          `${report.settings} settings${story ? ` (${report.settingsKept} game-layer kept${report.settingsMerged ? `, ${report.settingsMerged} merged` : ""})` : ""} · actors ${report.actorsUpdated} updated / ${report.actorsCreated} created / ${report.actorsDeleted} deleted${story ? ` / ${report.actorsKept} library kept` : ""} · ${report.scenes} scenes (${story ? `${report.hexesMerged} hexes merged` : `${report.drawings} drawings`}, ${report.tokens} tokens) · ${report.journal} journal` +
          (report.staleCards ? ` · ${report.staleCards} newer invitation card(s) sealed` : "") +
          (report.errors.length ? `<br/><span style="color:#f87171">${report.errors.length} error(s) — see console</span>` : "") +
          `<br/><i>All clients reload now.</i></div>`
      });
    } catch (_e) {}
    return { ok: report.errors.length === 0, row, report };
  }

  // ── slot management ──────────────────────────────────────────────────────
  async function setGolden(id) {
    if (!isGM()) throw new Error("GM only");
    const idx = readIndex();
    for (const s of idx.slots) s.golden = (s.id === id) ? !s.golden : false;
    await writeIndex(idx);
    return idx.slots.find(s => s.golden) || null;
  }
  async function remove(id) {
    if (!isGM()) throw new Error("GM only");
    const idx = readIndex();
    const row = idx.slots.find(s => s.id === id);
    if (!row) return false;
    try { await writeFile(`${id}.json`, JSON.stringify({ kind: "bbttcc-savegame-deleted", id, at: Date.now() })); } catch (e) { warn("stub overwrite failed", e); }
    idx.slots = idx.slots.filter(s => s.id !== id);
    await writeIndex(idx);
    return true;
  }
  // PRUNE (owner ask 2026-09-21: "maybe we just only keep the last 20 saves"): the golden master always stays; of the
  // rest, the newest `keep` survive and older slots are removed (file stubbed, slot dropped from the index).
  async function prune({ keep = 20 } = {}) {
    if (!isGM()) throw new Error("GM only");
    const rows = readIndex().slots.slice().sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0));
    const keepN = Math.max(0, Math.floor(Number(keep) || 0));
    const survivors = new Set(rows.filter(s => s.golden).map(s => s.id));
    for (const s of rows.filter(s => !s.golden).slice(0, keepN)) survivors.add(s.id);
    const doomed = rows.filter(s => !survivors.has(s.id));
    let removed = 0; for (const s of doomed) { try { if (await remove(s.id)) removed++; } catch (e) { warn("prune remove failed", s.id, e); } }
    return { removed, kept: survivors.size, doomed: doomed.map(s => ({ id: s.id, label: s.label, at: s.at })) };
  }
  function exportSlot(id) {
    const row = readIndex().slots.find(s => s.id === id);
    if (!row) return false;
    const a = document.createElement("a");
    a.href = foundry.utils.getRoute ? foundry.utils.getRoute(row.path) : `/${row.path}`;
    a.download = `bbttcc-save-${worldId()}-${(row.label || row.id).replace(/[^\w.-]+/g, "_")}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    return true;
  }
  async function importFile(file) {
    if (!isGM()) throw new Error("GM only");
    const text = await file.text();
    const snap = JSON.parse(text);
    if (snap?.kind !== "bbttcc-savegame") throw new Error("not a Bad Eden save file");
    snap.id = randId();   // a fresh slot id — never collide with an existing row
    const body = JSON.stringify(snap);
    const path = await writeFile(`${snap.id}.json`, body);
    const idx = readIndex();
    const row = { id: snap.id, label: `${snap.label} (imported)`, note: snap.note || "", at: snap.at || Date.now(), by: snap.by || "", path, bytes: body.length,
      turn: snap.turn, storyPhase: snap.storyPhase, counts: snap.counts || {}, golden: false, importedAt: Date.now() };
    idx.slots.push(row);
    await writeIndex(idx);
    return row;
  }
  async function readSlot(id) {
    const row = readIndex().slots.find(s => s.id === id);
    if (!row) throw new Error("save not found");
    return await readFile(row.path);
  }

  Hooks.once("init", () => {
    try {
      game.settings.register(MOD, SETTING_INDEX, {
        name: "Bad Eden Save Games (index)", hint: "Slot metadata for the file-based save games. Files live under Data/bbttcc-saves/<world>/.",
        scope: "world", config: false, type: Object, default: { slots: [] }
      });
    } catch (e) { warn("index setting registration failed", e); }
  });

  Hooks.once("ready", () => {
    try {
      game.bbttcc = game.bbttcc || {};
      game.bbttcc.api = game.bbttcc.api || {};
      game.bbttcc.api.world = game.bbttcc.api.world || {};
      game.bbttcc.api.world.saves = {
        list, golden, save, load, plan, readSlot, setGolden, remove, prune, exportSlot, importFile, capture, layers,
        dir: saveDir,
        open: () => { try { globalThis.BBTTCCSaveGameApp?.open?.(); } catch (e) { warn("open failed", e); } }
      };
      log("installed — api.world.saves");
    } catch (e) { warn("install failed", e); }
  });
})();

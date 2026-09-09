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
// API: game.bbttcc.api.world.saves.{list, save, load, plan, setGolden, remove,
//      exportSlot, importFile, golden, open}
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
        if (ns === MOD && key === SETTING_INDEX) continue;   // the index is not part of a save
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

  async function replaceEmbedded(parent, type, savedArr) {
    const coll = parent.getEmbeddedCollection(type);
    const cur = coll.map(d => d.toObject());
    if (sameJson(cur, savedArr)) return 0;
    const ids = coll.map(d => d.id);
    if (ids.length) await parent.deleteEmbeddedDocuments(type, ids);
    if (savedArr?.length) await parent.createEmbeddedDocuments(type, savedArr, { keepId: true });
    return 1;
  }

  // What a load would do — shown in the confirm.
  function plan(snap) {
    const savedActorIds = new Set(snap.actors.map(a => a._id));
    const actorsUpdate = snap.actors.filter(a => game.actors.get(a._id)).length;
    const actorsCreate = snap.actors.length - actorsUpdate;
    const actorsDelete = game.actors.filter(a => !savedActorIds.has(a.id)).map(a => a.name);
    const scenesKnown = snap.scenes.filter(s => game.scenes.get(s._id)).length;
    const scenesMissing = snap.scenes.filter(s => !game.scenes.get(s._id)).map(s => s.name);
    const scenesExtra = game.scenes.filter(s => !snap.scenes.some(x => x._id === s.id)).map(s => s.name);
    const settingsChange = snap.settings.filter(s => {
      try { return game.settings.settings.has(`${s.ns}.${s.key}`) && !sameJson(game.settings.get(s.ns, s.key), s.value); } catch (_e) { return false; }
    }).length;
    const settingsUnknown = snap.settings.filter(s => !game.settings.settings.has(`${s.ns}.${s.key}`)).length;
    const others = game.users.filter(u => u.active && u.id !== game.user.id).map(u => u.name);
    return { actorsUpdate, actorsCreate, actorsDelete, scenesKnown, scenesMissing, scenesExtra, settingsChange, settingsUnknown, journal: snap.journal.length, others };
  }

  async function load(id, opts = {}) {
    if (!isGM()) throw new Error("GM only");
    const row = readIndex().slots.find(s => s.id === id);
    if (!row) throw new Error("save not found in index");
    const snap = await readFile(row.path);
    if (snap?.kind !== "bbttcc-savegame") throw new Error("not a Bad Eden save file");
    const deleteExtras = opts.deleteExtras !== false;
    const progress = typeof opts.progress === "function" ? opts.progress : (() => {});
    const report = { settings: 0, actorsUpdated: 0, actorsCreated: 0, actorsDeleted: 0, itemsReplaced: 0, scenes: 0, drawings: 0, tokens: 0, journal: 0, errors: [] };
    game.bbttcc = game.bbttcc || {};
    game.bbttcc.saveRestoreActive = true;
    try {
      // 1. settings (world state, campaigns, director ledgers…)
      progress("settings", 0, snap.settings.length);
      for (const s of snap.settings) {
        try {
          if (!game.settings.settings.has(`${s.ns}.${s.key}`)) continue;
          if (sameJson(game.settings.get(s.ns, s.key), s.value)) continue;
          await game.settings.set(s.ns, s.key, s.value);
          report.settings++;
        } catch (e) { report.errors.push(`setting ${s.ns}.${s.key}: ${e?.message || e}`); }
      }

      // 2. actors — update in place (identity kept for linked tokens), create
      //    the missing with their saved ids, delete the extras.
      let n = 0;
      for (const a of snap.actors) {
        progress("actors", ++n, snap.actors.length);
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
      if (deleteExtras) {
        const savedIds = new Set(snap.actors.map(a => a._id));
        const extras = game.actors.filter(x => !savedIds.has(x.id)).map(x => x.id);
        if (extras.length) { try { await Actor.implementation.deleteDocuments(extras); report.actorsDeleted = extras.length; } catch (e) { report.errors.push(`delete actors: ${e?.message || e}`); } }
      }

      // 3. scenes — flags + drawings (hexes) + tokens, every scene in the save.
      n = 0;
      for (const s of snap.scenes) {
        progress("scenes", ++n, snap.scenes.length);
        const scene = game.scenes.get(s._id);
        if (!scene) continue;
        try {
          const body = stripDoc(s);
          if (!folderOk(body.folder)) body.folder = null;
          delete body.active;   // which scene is active is the GM's business, not the save's
          const curBody = stripDoc(captureScene(scene)); delete curBody.active;
          if (!sameJson(curBody, body)) await scene.update(body, { diff: false, recursive: false });
          report.drawings += await replaceEmbedded(scene, "Drawing", s.drawings || []) ? (s.drawings?.length || 0) : 0;
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
    } finally {
      game.bbttcc.saveRestoreActive = false;
    }
    log("loaded", row.label, report);
    try {
      await ChatMessage.create({
        whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
        content: `<div class="bbttcc-card"><b>💾 Save loaded: ${foundry.utils.escapeHTML(row.label)}</b><br/>` +
          `${report.settings} settings · actors ${report.actorsUpdated} updated / ${report.actorsCreated} created / ${report.actorsDeleted} deleted · ${report.scenes} scenes (${report.drawings} drawings, ${report.tokens} tokens) · ${report.journal} journal` +
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
        list, golden, save, load, plan, readSlot, setGolden, remove, exportSlot, importFile, capture,
        dir: saveDir,
        open: () => { try { globalThis.BBTTCCSaveGameApp?.open?.(); } catch (e) { warn("open failed", e); } }
      };
      log("installed — api.world.saves");
    } catch (e) { warn("install failed", e); }
  });
})();

/* Bad Eden – Location Doors (town hub maps) — 2026-09-14
 *
 * A town hub is a composited top-down map of a settlement (Dungeon Alchemist
 * `da-merge` output) whose buildings are DOORS: click one and the table dives
 * into that location's scene. Mirrors world-overview.js's region links, one
 * level down: world map → region → TOWN HUB → location.
 *
 * Data model (all under the "bbttcc-travel" flag scope):
 *   - Hub scene:        flags["bbttcc-travel"].isTownHub = true
 *                       flags["bbttcc-travel"].townLabel = "Furrier's Fixit Farm"
 *                       flags["bbttcc-travel"].hexUuid   = <the hex Drawing this town sits on>
 *   - Door Drawing:     flags["bbttcc-travel"].locationLink = { key, label, targetSceneUuid,
 *                         sceneUuids?: [every scene that IS this location — exterior/interior POVs,
 *                                       battlemap — for quest matching],
 *                         beatId?: "the location's opener beat" }
 *     With beatId, a click RUNS that beat (campaign.runBeat after transition.requestDive) so the
 *     beat's own sceneId + chain carry the table inside; a sealed/failed beat falls back to a plain
 *     dive to targetSceneUuid.
 *   - Location scene:   flags["bbttcc-travel"].returnLink = { targetSceneUuid: <hub>, label }
 *                       (scene-transition.js already renders that as the "⬅ Back" button)
 *
 * QUEST ENGINE SEAM — no new schema. A beat's existing `sceneId` is the one
 * authority for "where does this happen" (executeBeat already dives to it).
 * A door LIGHTS UP when any active quest on the table has an un-completed beat
 * whose sceneId is the door's target scene; the Quest Log renders those doors
 * as 📍 pills (api.travel.doors.forQuest) and clicking one pans to the door.
 *
 * Seats: a GM click activates the location for the whole table (arrival is a
 * table moment — 2026-08-26 ruling). A player click relays through
 * bbttcc-core gmExec (`travel.doors.dive`) so the primary GM performs the
 * activation; with no GM online it falls back to a local view-dive.
 * World setting `doorsPlayerActivate` (default true) turns the relay off.
 *
 * Click mechanism = stage pointerdown + hit-test (the reliable path), NOT the
 * clickDrawing hook. Plain left-click only; Shift/Ctrl/Meta clicks stay free
 * for the hex editor and the travel planner.
 */
(() => {
  const SCOPE = "bbttcc-travel";
  const MOD_FAC = "bbttcc-factions";
  const MOD_CAM = "bbttcc-campaign";
  const TAG = "[bbttcc travel/doors]";
  const log = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);

  // ---------- flags ----------
  const linkOf = (d) => {
    const doc = d?.document ?? d;
    const l = doc?.flags?.[SCOPE]?.locationLink;
    return (l && typeof l === "object" && l.targetSceneUuid) ? l : null;
  };
  const isTownHub = (scene = canvas?.scene) => !!scene?.flags?.[SCOPE]?.isTownHub;
  const townLabel = (scene = canvas?.scene) => String(scene?.flags?.[SCOPE]?.townLabel || scene?.name || "town");

  function doorDrawings(scene = canvas?.scene) {
    if (!scene) return [];
    if (scene === canvas?.scene && canvas?.drawings?.placeables) {
      return canvas.drawings.placeables.filter(d => !!linkOf(d));
    }
    return (scene.drawings?.contents || []).filter(doc => !!linkOf(doc));
  }

  function centerOf(d) {
    const doc = d?.document ?? d;
    if (d?.center && Number.isFinite(d.center.x)) return { x: d.center.x, y: d.center.y };
    const shape = doc?.shape || {};
    const w = Number(shape.width ?? doc?.width ?? 0), h = Number(shape.height ?? doc?.height ?? 0);
    return { x: Number(doc?.x || 0) + w / 2, y: Number(doc?.y || 0) + h / 2 };
  }

  // ---------- hit-test (same recipe as world-overview.js) ----------
  function drawingContainsGlobal(d, gx, gy) {
    try {
      const shape = d.document.shape || {};
      const t = String(shape.type || "").toLowerCase();
      const w = Number(shape.width ?? d.document.width ?? 0);
      const h = Number(shape.height ?? d.document.height ?? 0);
      const c = centerOf(d);                       // scene space — pivot-independent
      if (t === "p" || (Array.isArray(shape.points) && shape.points.length >= 6)) {
        const local = d.toLocal(new PIXI.Point(gx, gy));
        return new PIXI.Polygon(shape.points).contains(local.x, local.y);
      }
      const rx = w / 2, ry = h / 2; if (rx <= 0 || ry <= 0) return false;
      const nx = (gx - c.x) / rx, ny = (gy - c.y) / ry;
      if (t === "e") return (nx * nx + ny * ny) <= 1;   // doors are ellipses
      return Math.abs(nx) <= 1 && Math.abs(ny) <= 1;    // rectangle
    } catch (_e) { return false; }
  }
  function hitDoorAt(gx, gy) {
    const all = doorDrawings().sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).reverse();
    for (const d of all) if (drawingContainsGlobal(d, gx, gy)) return d;
    return null;
  }
  function localPos(event) {
    const stage = canvas.app.stage;
    if (typeof event?.getLocalPosition === "function") return event.getLocalPosition(stage);
    if (typeof event?.data?.getLocalPosition === "function") return event.data.getLocalPosition(stage);
    const g = event?.global ?? event?.data?.global ?? { x: 0, y: 0 };
    return stage.toLocal(g);
  }

  // ---------- quest seam: which doors does the story point at? ----------
  function _campaign() {
    try {
      const api = game.bbttcc?.api?.campaign;
      const id = api?.getActiveCampaignId?.();
      const c = id ? api?.getCampaign?.(id) : null;
      if (c) return c;
    } catch (_e) {}
    try {
      const raw = game.settings.get(MOD_CAM, "campaigns");
      const store = (typeof raw === "string") ? JSON.parse(raw) : (raw || {});
      const id = String(game.settings.get(MOD_CAM, "activeCampaignId") || "");
      const map = Array.isArray(store) ? Object.fromEntries(store.map(c => [c.id, c])) : (store.campaigns || store);
      return map?.[id] || null;
    } catch (_e) { return null; }
  }
  const _sceneKeys = (uuids) => {
    const s = new Set();
    for (const u of [].concat(uuids || [])) {
      const v = String(u || "").trim(); if (!v) continue;
      s.add(v); const id = v.split(".").pop(); s.add(id); s.add(`Scene.${id}`);
    }
    return s;
  };
  const linkScenes = (l) => [l.targetSceneUuid].concat(Array.isArray(l.sceneUuids) ? l.sceneUuids : []);
  function _factionActors() {
    try { return game.actors.filter(a => a?.getFlag?.(MOD_FAC, "isFaction")); } catch (_e) { return []; }
  }
  /** Active quests on the table → { questId: { name, completedBeatIds:Set } } */
  function _activeQuests() {
    const out = {};
    for (const a of _factionActors()) {
      const q = a.getFlag(MOD_FAC, "quests");
      const active = q?.active && typeof q.active === "object" ? q.active : {};
      for (const [qid, tr] of Object.entries(active)) {
        const rec = out[qid] || (out[qid] = { questId: qid, completed: new Set(), factions: [] });
        rec.factions.push(a.id);
        const prog = tr?.progress?.beats || {};
        for (const [bid, b] of Object.entries(prog)) if (String(b?.state || "") === "completed") rec.completed.add(bid);
      }
    }
    return out;
  }
  /** Beats that place quest `questId` somewhere: [{beatId, label, sceneRef}] */
  function beatsForQuest(questId) {
    const c = _campaign(); if (!c) return [];
    const beats = Array.isArray(c.beats) ? c.beats : [];
    const qid = String(questId || "");
    return beats
      .filter(b => b && String(b.questId || b.questID || b.quest || "") === qid)
      .map(b => ({ beatId: String(b.id), label: String(b.label || b.id), sceneRef: String(b.sceneUuid || b.sceneId || "").trim() }))
      .filter(b => b.sceneRef);
  }
  /** All doors in the world (every town hub scene): [{key,label,targetSceneUuid,drawingUuid,hubSceneUuid,hubLabel,x,y}] */
  function listAll() {
    const out = [];
    for (const sc of game.scenes?.contents || []) {
      if (!isTownHub(sc)) continue;
      for (const doc of (sc.drawings?.contents || []).filter(x => !!linkOf(x))) {   // documents, never placeables
        const l = linkOf(doc); const c = centerOf(doc);
        out.push({ key: String(l.key || doc.id), label: String(l.label || l.key || "door"), targetSceneUuid: l.targetSceneUuid,
          sceneUuids: linkScenes(l), beatId: l.beatId || null,
          drawingUuid: doc.uuid, hubSceneUuid: sc.uuid, hubLabel: townLabel(sc), x: c.x, y: c.y });
      }
    }
    return out;
  }
  /** Doors a quest points at (un-completed beats with a sceneId that is a door target). */
  function forQuest(questId) {
    const placed = beatsForQuest(questId); if (!placed.length) return [];
    const active = _activeQuests()[String(questId)];
    const done = active?.completed || new Set();
    const doors = listAll(); const hits = [];
    for (const d of doors) {
      const keys = _sceneKeys(d.sceneUuids);
      const beats = placed.filter(b => keys.has(b.sceneRef) && !done.has(b.beatId));
      if (beats.length) hits.push({ ...d, beats });
    }
    return hits;
  }
  /** For the CURRENT hub scene: door drawing id → [{questId, beatId}] for active quests. */
  function litDoorsHere() {
    const lit = new Map();
    if (!isTownHub()) return lit;
    const actives = _activeQuests();
    for (const qid of Object.keys(actives)) {
      for (const d of forQuest(qid)) {
        if (d.hubSceneUuid !== canvas.scene.uuid) continue;
        const arr = lit.get(d.drawingUuid) || []; arr.push({ questId: qid, beats: d.beats }); lit.set(d.drawingUuid, arr);
      }
    }
    return lit;
  }

  // ---------- visuals: hover highlight + quest pulse + 📍 pins ----------
  // Line widths are ZOOM-AWARE (a 10px line on a 15,000px map is sub-pixel zoomed out),
  // and every destroy is tolerant: the canvas tears our objects down before canvasReady.
  let _fx = null;           // PIXI container on the drawings layer
  let _pulse = [];          // [{d, g, pin, phase}]
  let _hover = null;
  const zoom = () => Math.max(0.01, canvas?.stage?.scale?.x || 1);
  const px = (n) => n / zoom();                                  // n screen px → scene units
  const safeDestroy = (o) => { try { if (o && !o.destroyed) o.destroy({ children: true }); } catch (_e) {} };
  function fxLayer() {
    if (_fx && !_fx.destroyed && _fx.parent) return _fx;
    _fx = new PIXI.Container(); _fx.name = "bbttcc-doors-fx"; _fx.eventMode = "none";
    (canvas.drawings || canvas.stage).addChild(_fx);
    return _fx;
  }
  function radiusOf(d) {
    const shape = d.document.shape || {};
    return Math.max(Number(shape.width || d.document.width || 100), Number(shape.height || d.document.height || 100)) / 2;
  }
  function clearHover() { safeDestroy(_hover); _hover = null; }
  function drawHover(d) {
    const z = zoom();
    if (_hover && !_hover.destroyed && _hover._door === d && _hover._z === z) return;
    clearHover();
    const g = new PIXI.Graphics(); const c = centerOf(d); const r = radiusOf(d);
    g.lineStyle(Math.max(px(5), r * 0.03), 0x7ff6ff, 0.95); g.drawCircle(c.x, c.y, r + px(6));
    fxLayer().addChild(g); _hover = g; _hover._door = d; _hover._z = z;
    try { document.body.style.cursor = "pointer"; } catch (_e) {}
  }
  function clearPulses() { for (const p of _pulse) { safeDestroy(p.g); safeDestroy(p.pin); } _pulse = []; }
  function _tick() {
    if (!_pulse.length || !canvas?.ready) return;
    const t = performance.now() / 1000;
    for (const p of _pulse) {
      if (!p.g || p.g.destroyed) continue;
      const k = (Math.sin(t * 2.2 + p.phase) + 1) / 2;           // 0..1
      const c = centerOf(p.d); const r = radiusOf(p.d);
      p.g.clear();
      p.g.lineStyle(Math.max(px(6), r * 0.05), 0xffd166, 0.45 + 0.5 * k); p.g.drawCircle(c.x, c.y, r + r * 0.02 + r * 0.06 * k);
      p.g.lineStyle(Math.max(px(2), r * 0.015), 0xffffff, 0.7 * (1 - k)); p.g.drawCircle(c.x, c.y, r + r * 0.12 + r * 0.18 * k);
      if (p.pin && !p.pin.destroyed) { p.pin.y = c.y - r - r * 0.05 - r * 0.06 * k; p.pin.alpha = 0.85 + 0.15 * k; }
    }
  }
  let _tickBound = false;
  function ensureTicker() { if (_tickBound) return; canvas.app.ticker.add(_tick); _tickBound = true; }
  function dropTicker() { try { canvas?.app?.ticker?.remove(_tick); } catch (_e) {} _tickBound = false; }
  function makePin(d, questCount) {
    const c = centerOf(d); const r = radiusOf(d);
    const size = Math.max(48, Math.round(r * 0.55));
    const pin = new PIXI.Text(questCount > 1 ? `📍×${questCount}` : "📍", { fontFamily: "Signika, sans-serif", fontSize: size, fill: 0xffffff, stroke: 0x000000, strokeThickness: Math.round(size / 10), dropShadow: true, dropShadowBlur: size / 6, dropShadowAlpha: 0.6 });
    pin.anchor.set(0.5, 1); pin.x = c.x; pin.y = c.y - r; pin.eventMode = "none";
    return pin;
  }
  function refreshLit() {
    clearPulses();
    if (!isTownHub() || !canvas?.ready) return;
    let lit; try { lit = litDoorsHere(); } catch (e) { warn("lit refresh failed", e); return; }
    for (const d of doorDrawings()) {
      const hits = lit.get(d.document.uuid); if (!hits) continue;
      const g = new PIXI.Graphics(); const pin = makePin(d, hits.length);
      fxLayer().addChild(g); fxLayer().addChild(pin);
      _pulse.push({ d, g, pin, phase: Math.random() * 6.28 });
    }
    if (_pulse.length) ensureTicker();
  }
  /** One-shot attention pulse on a door (Quest Log 📍 click). */
  async function pulse(drawingUuid, { ms = 2600 } = {}) {
    const d = doorDrawings().find(x => x.document.uuid === drawingUuid); if (!d) return false;
    const g = new PIXI.Graphics(); fxLayer().addChild(g);
    const t0 = performance.now(); const c = centerOf(d); const r = radiusOf(d);
    const fn = () => {
      const u = (performance.now() - t0) / ms;
      if (u >= 1 || g.destroyed) { try { canvas.app.ticker.remove(fn); } catch (_e) {} safeDestroy(g); return; }
      const k = (u * 3) % 1; g.clear();
      g.lineStyle(Math.max(px(6), r * 0.05), 0x7ff6ff, 1 - k); g.drawCircle(c.x, c.y, r + r * 0.05 + r * 0.6 * k);
    };
    canvas.app.ticker.add(fn); return true;
  }
  /** The canvas is going away: forget our display objects (it destroys them itself). */
  function forgetVisuals() { dropTicker(); _pulse = []; _hover = null; _fx = null; try { if (document.body.style.cursor === "pointer") document.body.style.cursor = ""; } catch (_e) {} }

  // ---------- the dive ----------
  /** GM seat only: run the door's opener beat with a pending cinematic dive; true if the beat took the table somewhere. */
  async function _runDoorBeat(doc, link, { audience = "activate", label } = {}) {
    const beatId = String(link?.beatId || "").trim(); if (!beatId || !game.user.isGM) return false;
    const camp = game.bbttcc?.api?.campaign; const cid = camp?.getActiveCampaignId?.();
    const tx = game.bbttcc?.api?.transition;
    if (!camp?.runBeat || !cid) return false;
    const c = centerOf(doc);
    try {
      tx?.requestDive?.({ hexUuid: doc.uuid, focus: c, audience, label: label || link.label, originUuid: canvas?.scene?.uuid || null });
      const r = await camp.runBeat(cid, beatId, { source: "town-door", doorKey: link.key });
      if (r && r.ok === false) { warn(`door beat ${beatId} declined`, r); tx?.consumeDive?.(); return false; }
      return true;
    } catch (e) { warn(`door beat ${beatId} failed`, e); try { tx?.consumeDive?.(); } catch (_e) {} return false; }
  }
  async function _diveLocal(d, { audience = "view", label } = {}) {
    const link = linkOf(d); if (!link) return false;
    const tx = game.bbttcc?.api?.transition;
    const c = centerOf(d);
    if (tx?.dive) return tx.dive(link.targetSceneUuid, { focus: c, hexUuid: d.document.uuid, label: label || link.label, audience });
    const scene = await fromUuid(link.targetSceneUuid); if (!scene) return false;
    if (audience === "activate" && game.user.isGM) await scene.activate(); else await scene.view();
    return true;
  }
  function playerActivateAllowed() {
    try { return !!game.settings.get(SCOPE, "doorsPlayerActivate"); } catch (_e) { return true; }
  }
  /** Dive through a door (by drawing uuid) from any seat. */
  async function dive(drawingUuid, opts = {}) {
    const d = doorDrawings().find(x => x.document.uuid === drawingUuid);
    const link = d ? linkOf(d) : null;
    if (!link) return ui.notifications?.warn?.("That door leads nowhere (no locationLink)."), false;
    const where = `${link.label || "location"} · ${townLabel()}`;
    if (game.user.isGM) {
      if (await _runDoorBeat(d.document, link, { audience: "activate", label: link.label })) return true;
      return _diveLocal(d, { audience: "activate", label: link.label });
    }
    const gx = game.bbttcc?.api?.gmExec;
    if (playerActivateAllowed() && gx?.call && gx.primaryGmId?.()) {
      try {
        const r = await gx.call("travel.doors.dive", { drawingUuid, sceneUuid: canvas.scene.uuid }, { timeoutMs: 8000 });
        if (r?.ok) return true;
        warn("relay declined", r);
      } catch (e) { warn("relay failed, falling back to a local view", e); }
    }
    ui.notifications?.info?.(`Stepping into ${where} (your view only).`);
    return _diveLocal(d, { audience: "view", label: link.label });
  }
  /** Bring this client to a door: pan+pulse if on its hub, else view-dive to the hub first. */
  async function goto(drawingUuid, { scale = 1.1 } = {}) {
    const doc = await fromUuid(drawingUuid).catch(() => null); if (!doc) return false;
    const hub = doc.parent; if (!hub) return false;
    if (canvas?.scene?.id !== hub.id) {
      const tx = game.bbttcc?.api?.transition; const c = centerOf(doc);
      if (tx?.dive) await tx.dive(hub.uuid, { label: townLabel(hub), audience: "view", landAt: { x: c.x, y: c.y, scale } });
      else await hub.view();
      await new Promise(r => setTimeout(r, 400));
    } else {
      const c = centerOf(doc);
      await canvas.animatePan({ x: c.x, y: c.y, scale, duration: 600 });
    }
    return pulse(drawingUuid);
  }

  // ---------- stage interaction ----------
  function onPointerDown(event) {
    try {
      const btn = event.button ?? event.data?.originalEvent?.button ?? 0;
      if (btn !== 0) return;
      const oe = event.data?.originalEvent ?? event.originalEvent ?? event;
      if (oe?.shiftKey || oe?.ctrlKey || oe?.metaKey || oe?.altKey) return; // editor / planner clicks stay free
      const p = localPos(event);
      const hit = hitDoorAt(p.x, p.y); if (!hit) return;
      event.stopPropagation?.();
      dive(hit.document.uuid);
    } catch (err) { console.error(TAG, "pointerdown error:", err); }
  }
  let _moveBroken = false;
  function onPointerMove(event) {
    if (_moveBroken) return;
    try {
      const p = localPos(event); const hit = hitDoorAt(p.x, p.y);
      if (hit) drawHover(hit); else { clearHover(); try { if (document.body.style.cursor === "pointer") document.body.style.cursor = ""; } catch (_e) {} }
    } catch (err) { _moveBroken = true; clearHover(); console.error(TAG, "hover disabled after error:", err); }
  }
  const _stage = { down: null, move: null };
  function unbindStage() {
    try { if (_stage.down) canvas.stage.off("pointerdown", _stage.down); } catch (_e) {}
    try { if (_stage.move) canvas.stage.off("pointermove", _stage.move); } catch (_e) {}
    _stage.down = _stage.move = null; clearHover();
  }
  function bindStage() {
    unbindStage(); _stage.down = onPointerDown; _stage.move = onPointerMove;
    canvas.stage.on("pointerdown", _stage.down); canvas.stage.on("pointermove", _stage.move);
  }

  // ---------- wire-up ----------
  function onCanvasReady() {
    forgetVisuals(); unbindStage();
    if (!isTownHub()) return;
    bindStage(); refreshLit();
    const n = doorDrawings().length;
    ui.notifications?.info?.(`${townLabel()}: click a building to go inside (${n} doors).`);
  }
  Hooks.on("canvasReady", onCanvasReady);
  Hooks.on("canvasTearDown", () => { try { unbindStage(); } catch (_e) {} forgetVisuals(); });
  // Quest progress lives on faction actors; a beat completing re-lights the doors.
  Hooks.on("updateActor", (a, diff) => { try { if (isTownHub() && foundry.utils.hasProperty(diff, `flags.${MOD_FAC}.quests`)) refreshLit(); } catch (_e) {} });
  Hooks.on("bbttcc:beat:resolved", () => { try { if (isTownHub()) refreshLit(); } catch (_e) {} });
  for (const h of ["createDrawing", "updateDrawing", "deleteDrawing"]) Hooks.on(h, (doc) => { try { if (doc?.parent?.id === canvas?.scene?.id && isTownHub()) refreshLit(); } catch (_e) {} });

  Hooks.once("init", () => {
    try {
      game.settings.register(SCOPE, "doorsPlayerActivate", {
        name: "Location doors: player clicks move the table",
        hint: "When a player clicks a building on a town hub map, the GM seat activates that location for everyone (a table moment). Off = the player only views it.",
        scope: "world", config: true, type: Boolean, default: true
      });
    } catch (e) { warn("setting register failed", e); }
  });

  Hooks.once("ready", () => {
    game.bbttcc = game.bbttcc || { api: {} }; game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.travel = game.bbttcc.api.travel || {};
    game.bbttcc.api.travel.doors = { list: listAll, forQuest, beatsForQuest, litDoorsHere, dive, goto, pulse, refreshLit, isTownHub, _hitDoorAt: hitDoorAt };
    // GM-side relay: a player's door click becomes a table activation on the primary GM.
    try {
      game.bbttcc.api.gmExec?.register?.("travel.doors.dive", async (payload, meta) => {
        if (!game.user.isGM) return { ok: false, why: "not-gm" };
        if (!playerActivateAllowed()) return { ok: false, why: "setting-off" };
        const doc = await fromUuid(String(payload?.drawingUuid || "")).catch(() => null);
        const link = doc ? linkOf(doc) : null;
        if (!link || !isTownHub(doc.parent)) return { ok: false, why: "not-a-door" };
        const scene = await fromUuid(link.targetSceneUuid).catch(() => null);
        if (!scene) return { ok: false, why: "no-scene" };
        // Only honour a click on the hub the table is actually on.
        if (game.scenes?.active?.id !== doc.parent.id) return { ok: false, why: "table-elsewhere" };
        const tx = game.bbttcc?.api?.transition; const c = centerOf(doc);
        const label = `${link.label || "inside"} (${meta?.fromUserName || "a player"})`;
        // Fire-and-forget (gmExec rule: return fast); the beat chain may take minutes.
        (async () => {
          if (canvas?.scene?.id === doc.parent.id && await _runDoorBeat(doc, link, { audience: "activate", label })) return;
          if (canvas?.scene?.id === doc.parent.id && tx?.dive) tx.dive(link.targetSceneUuid, { focus: c, hexUuid: doc.uuid, label, audience: "activate" });
          else await scene.activate();
        })().catch(e => warn("relay dive failed", e));
        return { ok: true, sceneUuid: scene.uuid, beatId: link.beatId || null };
      });
    } catch (e) { warn("gmExec register failed", e); }
    log("ready — town hub doors armed");
  });
})();

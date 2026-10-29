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

  function allDoorDrawings(scene = canvas?.scene) {
    if (!scene) return [];
    if (scene === canvas?.scene && canvas?.drawings?.placeables) {
      return canvas.drawings.placeables.filter(d => !!linkOf(d));
    }
    return (scene.drawings?.contents || []).filter(doc => !!linkOf(doc));
  }
  // A door whose opener beat belongs to a LATER ACT isn't on the map yet (Dave 2026-10-28: the Yard showed Brennig in front
  // of the Shipment, which waits for Act 3) — no label, no click, no Quest Log pill. A GM editing drawings still sees it.
  const _doorOpen = (d) => { const l = linkOf(d); return !(l?.beatId && _laterAct(l.beatId)); };
  function doorDrawings(scene = canvas?.scene) { return allDoorDrawings(scene).filter(_doorOpen); }

  function centerOf(d) {
    const doc = d?.document ?? d;
    if (d?.center && Number.isFinite(d.center.x)) return { x: d.center.x, y: d.center.y };
    const shape = doc?.shape || {};
    const w = Number(shape.width ?? doc?.width ?? 0), h = Number(shape.height ?? doc?.height ?? 0);
    return { x: Number(doc?.x || 0) + w / 2, y: Number(doc?.y || 0) + h / 2 };
  }

  // ---------- hit-test (same recipe as world-overview.js) ----------
  // Scene point → the drawing's shape space (origin = doc.x/y, rotation undone about the
  // shape centre). Pure document math — no placeable transforms, no screen-space mixups.
  function sceneToShape(doc, gx, gy) {
    const shape = doc.shape || {};
    const w = Number(shape.width ?? doc.width ?? 0), h = Number(shape.height ?? doc.height ?? 0);
    const cx = Number(doc.x || 0) + w / 2, cy = Number(doc.y || 0) + h / 2;
    const r = -((Number(doc.rotation) || 0) * Math.PI) / 180;
    const dx = gx - cx, dy = gy - cy;
    return { x: dx * Math.cos(r) - dy * Math.sin(r) + w / 2, y: dx * Math.sin(r) + dy * Math.cos(r) + h / 2, w, h };
  }
  function drawingContainsGlobal(d, gx, gy) {
    try {
      const shape = d.document.shape || {};
      const t = String(shape.type || "").toLowerCase();
      const w = Number(shape.width ?? d.document.width ?? 0);
      const h = Number(shape.height ?? d.document.height ?? 0);
      const c = centerOf(d);                       // scene space — pivot-independent
      if (t === "p" || (Array.isArray(shape.points) && shape.points.length >= 6)) {
        const local = sceneToShape(d.document, gx, gy);   // gx/gy are scene coords (localPos)
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
      for (const doc of (sc.drawings?.contents || []).filter(x => !!linkOf(x) && _doorOpen(x))) {   // documents, never placeables
        const l = linkOf(doc); const c = centerOf(doc);
        out.push({ key: String(l.key || doc.id), label: String(l.label || l.key || "door"), targetSceneUuid: l.targetSceneUuid,
          sceneUuids: linkScenes(l), beatId: l.beatId || null,
          drawingUuid: doc.uuid, hubSceneUuid: sc.uuid, hubLabel: townLabel(sc), x: c.x, y: c.y });
      }
    }
    return out;
  }
  /** A beat gated to an act the story hasn't reached (inject.requires storyPhase gte) — no pill, no pulse for it yet. */
  function _laterAct(beatId) {
    let phase = 0;
    try { phase = Number(game.settings.get("bbttcc-campaign", "storyPhase")) || 0; } catch (_e) { return false; }
    const b = (_campaign()?.beats || []).find(x => String(x?.id) === String(beatId));
    const req = Array.isArray(b?.inject?.requires) ? b.inject.requires : [];
    return req.some(r => r && r.flag === "storyPhase" && r.gte != null && Number(r.gte) > phase);
  }
  /** Doors a quest points at (un-completed beats with a sceneId that is a door target). */
  function forQuest(questId) {
    const placed = beatsForQuest(questId).filter(b => !_laterAct(b.beatId)); if (!placed.length) return [];
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

  // ---------- visuals: HexChrome labels + NOW pins (Dave, 2026-10-26) ----------
  // The door Drawings' own gold ellipses and plain text are hidden on the hub (shown again while a GM has the
  // Drawings layer open, to edit them). Each door gets a glowing HexChrome label at its centre, kept at a readable
  // SCREEN size at any zoom; the label is the thing you click (the ellipse still counts too). A door the story's
  // NOW points at (each active quest's ready next beat lives behind it) gets a small glowing hex pin above its
  // label — no rings anywhere.
  let _fx = null;           // PIXI container on the drawings layer
  let _labels = [];         // [{d, c, plate, text, w, h, lit, hover, pin}]
  let _hoverDoor = null;
  let _flash = null;        // {d, t0, ms}
  const LABEL_PX = 21;      // label font size in SCREEN px
  const PIN_PX = 34;        // pin height in SCREEN px
  const BLUE = 0x9fc8f2, BLUE_EDGE = 0x4a8fd6, GOLD = 0xf4c842, GOLD_GLOW = 0xffdf6b, PANEL = 0x060e20;
  const zoom = () => Math.max(0.01, canvas?.stage?.scale?.x || 1);
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
  /** Hide the Drawing's own ring + text (one graphics object holds both) unless a GM is editing drawings. */
  function _syncDrawingVisibility() {
    const editing = !!(game.user?.isGM && canvas?.drawings?.active);
    for (const d of allDoorDrawings()) { try { if (d.shape) d.shape.visible = editing; } catch (_e) {} }
    if (_fx) _fx.visible = !editing;
  }
  // the Circuit face has no ⇩⇧⇦⇨ — the fallback drew them as hairlines
  const ARROWS = { "⇩": "▼", "⇧": "▲", "⇦": "◀", "⇨": "▶" };
  const _labelText = (d) => { const l = linkOf(d); return String(d.document.text || l?.label || l?.key || "door").trim().replace(/[⇩⇧⇦⇨]/g, ch => ARROWS[ch]); };
  function _hexPath(g, cx, cy, w, h) {   // a label plate with hex-cut ends
    const k = h / 2;
    g.drawPolygon([cx - w / 2 + k, cy - h / 2, cx + w / 2 - k, cy - h / 2, cx + w / 2, cy, cx + w / 2 - k, cy + h / 2, cx - w / 2 + k, cy + h / 2, cx - w / 2, cy]);
  }
  function _drawPlate(L) {
    const g = L.plate; g.clear();
    const hot = L.hover || (_flash && _flash.d === L.d);
    const edge = L.lit ? GOLD : (hot ? 0x7ff6ff : BLUE_EDGE);
    g.lineStyle(hot ? 3 : 2, edge, 0.95); g.beginFill(PANEL, hot ? 0.9 : 0.8); _hexPath(g, 0, 0, L.w, L.h); g.endFill();
    L.glow.clear(); L.glow.lineStyle(8, L.lit ? GOLD_GLOW : (hot ? 0x7ff6ff : BLUE_EDGE), L.lit || hot ? 0.55 : 0.28); _hexPath(L.glow, 0, 0, L.w, L.h);
    L.text.style.fill = L.lit ? GOLD : (hot ? 0xe6fbff : BLUE);
    L.text.style.dropShadowColor = L.lit ? GOLD_GLOW : 0x8fc0f0;
  }
  function _makePin() {
    const pin = new PIXI.Container(); pin.eventMode = "none";
    const hex = (g, r) => { const pts = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; pts.push(Math.cos(a) * r, Math.sin(a) * r); } g.drawPolygon(pts); };
    const glow = new PIXI.Graphics(); glow.beginFill(GOLD_GLOW, 0.75); hex(glow, 15); glow.endFill();
    try { glow.filters = [new PIXI.BlurFilter(8)]; } catch (_e) {}
    const body = new PIXI.Graphics(); body.lineStyle(2, 0xfff3c4, 1); body.beginFill(GOLD, 1); hex(body, 10); body.endFill();
    body.lineStyle(0); body.beginFill(BLUE_EDGE, 1); hex(body, 4.5); body.endFill();
    const stem = new PIXI.Graphics(); stem.beginFill(GOLD, 0.9); stem.drawPolygon([-3, 9, 3, 9, 0, 17]); stem.endFill();
    pin.addChild(glow, stem, body);
    return pin;
  }
  // NOW pins live on the fx layer, not inside L.c — destroy them too or every rebuild strands one.
  function clearLabels() { for (const L of _labels) { safeDestroy(L.c); if (L.pin) safeDestroy(L.pin); } _labels = []; }
  function _buildLabels() {
    clearLabels();
    const layer = fxLayer();
    for (const d of doorDrawings()) {
      const c = new PIXI.Container(); c.eventMode = "none";
      const glow = new PIXI.Graphics(); try { glow.filters = [new PIXI.BlurFilter(5)]; } catch (_e) {}
      const plate = new PIXI.Graphics();
      const text = new PIXI.Text(_labelText(d), {
        fontFamily: '"BBTTCC Display Circuit", "BBTTCC Display", Signika, sans-serif', fontSize: LABEL_PX * 2, fill: BLUE, letterSpacing: 1,
        dropShadow: true, dropShadowColor: 0x8fc0f0, dropShadowBlur: 10, dropShadowDistance: 0, dropShadowAlpha: 0.9, align: "center"
      });
      text.scale.set(0.5); text.anchor.set(0.5);   // rendered at 2× for crisp edges
      const w = text.width + LABEL_PX * 1.8, h = LABEL_PX * 1.9;
      c.addChild(glow, plate, text); layer.addChild(c);
      const L = { d, c, glow, plate, text, w, h, lit: false, hover: false, pin: null };
      _drawPlate(L); _labels.push(L);
    }
    _syncDrawingVisibility();
  }
  function _labelOf(d) { return _labels.find(L => L.d === d) || null; }
  /** Scene-space rect of a door's label (for the click / hover hit-test). */
  function labelHitAt(x, y) {
    const s = 1 / zoom();
    for (const L of [..._labels].reverse()) {
      const p = centerOf(L.d); const hw = (L.w * s) / 2, hh = (L.h * s) / 2;
      if (Math.abs(x - p.x) <= hw && Math.abs(y - p.y) <= hh) return L.d;
    }
    return null;
  }
  function _tick() {
    if (!_labels.length || !canvas?.ready) return;
    _syncDrawingVisibility();
    const s = 1 / zoom(); const t = performance.now() / 1000;
    for (const L of _labels) {
      if (!L.c || L.c.destroyed) continue;
      const p = centerOf(L.d);
      let k = 1;
      if (_flash && _flash.d === L.d) {
        const u = (performance.now() - _flash.t0) / _flash.ms;
        if (u >= 1) { _flash = null; _drawPlate(L); } else k = 1 + 0.18 * Math.abs(Math.sin(u * Math.PI * 3));
      } else if (L.hover) k = 1.08;
      L.c.position.set(p.x, p.y); L.c.scale.set(s * k);
      if (L.pin && !L.pin.destroyed) {
        const bob = Math.sin(t * 2.4) * 3;
        L.pin.position.set(p.x, p.y - ((L.h / 2) + PIN_PX * 0.75 + bob) * s);
        L.pin.scale.set(s * (PIN_PX / 26));
        L.pin.alpha = 0.85 + 0.15 * (Math.sin(t * 2.4) + 1) / 2;
      }
    }
  }
  let _tickBound = false;
  function ensureTicker() { if (_tickBound) return; canvas.app.ticker.add(_tick); _tickBound = true; }
  function dropTicker() { try { canvas?.app?.ticker?.remove(_tick); } catch (_e) {} _tickBound = false; }
  function clearHover() {
    const L = _hoverDoor ? _labelOf(_hoverDoor) : null; _hoverDoor = null;
    if (L) { L.hover = false; _drawPlate(L); }
  }
  function drawHover(d) {
    if (_hoverDoor === d) return;
    clearHover(); _hoverDoor = d;
    const L = _labelOf(d); if (L) { L.hover = true; _drawPlate(L); }
    try { document.body.style.cursor = "pointer"; } catch (_e) {}
  }

  /** The beats the story's NOW points at: each active quest's ready next beat. */
  async function _nowBeats() {
    const api = game.bbttcc?.api?.campaign; if (!api?.director?.situation) return [];
    const sit = await api.director.situation({ full: false }).catch(() => null);
    return (sit?.quests || []).filter(q => q.state === "active" && q.next?.ready && q.next.beat).map(q => ({ quest: q.key, beat: q.next.beat }));
  }
  /** Doors the NOW lives behind: the beat's scene is one of the door's scenes (AJ's send-off plays on the North
   *  Gate's scene), or the door's opener IS the beat. → Map drawingUuid → [{quest, beatId}] */
  async function nowDoorsHere() {
    const lit = new Map();
    if (!isTownHub()) return lit;
    const now = await _nowBeats(); if (!now.length) return lit;
    for (const d of doorDrawings()) {
      const l = linkOf(d); const keys = _sceneKeys(linkScenes(l));
      for (const n of now) {
        const sid = String(n.beat.sceneId || "").trim();
        const here = (sid && keys.has(sid)) || String(l.beatId || "") === String(n.beat.id);
        if (here) { const a = lit.get(d.document.uuid) || []; a.push({ questId: n.quest, beatId: n.beat.id }); lit.set(d.document.uuid, a); }
      }
    }
    return lit;
  }
  let _refreshSeq = 0;
  async function refreshLit() {
    const seq = ++_refreshSeq;
    if (!isTownHub() || !canvas?.ready) { clearLabels(); return; }
    if (_labels.length !== doorDrawings().length || _labels.some(L => L.c.destroyed || !doorDrawings().includes(L.d))) _buildLabels();
    let lit; try { lit = await nowDoorsHere(); } catch (e) { warn("lit refresh failed", e); lit = new Map(); }
    if (seq !== _refreshSeq) return;   // a newer refresh superseded this one
    for (const L of _labels) {
      L.lit = lit.has(L.d.document.uuid);
      if (L.lit && !L.pin) { L.pin = _makePin(); fxLayer().addChild(L.pin); }
      if (!L.lit && L.pin) { safeDestroy(L.pin); L.pin = null; }
      _drawPlate(L);
    }
    ensureTicker();
  }
  /** One-shot attention flash on a door's label (Quest Log 📍 click). */
  async function pulse(drawingUuid, { ms = 2600 } = {}) {
    const d = doorDrawings().find(x => x.document.uuid === drawingUuid); if (!d) return false;
    if (!_labels.length) await refreshLit();
    _flash = { d, t0: performance.now(), ms }; const L = _labelOf(d); if (L) _drawPlate(L);
    ensureTicker(); return true;
  }
  /** The canvas is going away: forget our display objects (it destroys them itself). */
  function forgetVisuals() { dropTicker(); _labels = []; _hoverDoor = null; _flash = null; _fx = null; try { if (document.body.style.cursor === "pointer") document.body.style.cursor = ""; } catch (_e) {} }

  // ---------- the dive ----------
  /** GM seat only: run the door's opener beat with a pending cinematic dive; true if the beat took the table somewhere. */
  async function _runDoorBeat(doc, link, { audience = "activate", label } = {}) {
    const beatId = String(link?.beatId || "").trim(); if (!beatId || !game.user.isGM) return false;
    const camp = game.bbttcc?.api?.campaign; const cid = camp?.getActiveCampaignId?.();
    const tx = game.bbttcc?.api?.transition;
    if (!camp?.runBeat || !cid) return false;
    const c = centerOf(doc);
    try {
      // the table chose the map: any beat window still waiting (the Welcome Round) closes, or the door's chain
      // routing back to the walk would stack a second one on top of it (2026-10-26)
      try { await camp.closeOpenBeatDialogs?.(); } catch (_eC) {}
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
    // The walk-in gate guards the CLICK too (it lives on the door's Region link; a click on the Drawing used to skip it).
    const gated = _gateForDoor(d.document, link);
    if (gated && !gateMet(gated.gate)) {
      ui.notifications?.info?.(gated.gate?.message || `${where}: not yet.`);
      if (game.user.isGM) return _gmOnce(`fallback:${gated.key}`) ? _runFallbackBeat(gated.region, gated.link) : false;
      const gx = game.bbttcc?.api?.gmExec;
      if (gated.region && gx?.call && gx.primaryGmId?.()) { try { const r = await gx.call("travel.doors.enter", { regionUuid: gated.region.uuid, sceneUuid: canvas?.scene?.uuid }, { timeoutMs: 8000 }); return !!r?.ok; } catch (e) { warn("gate relay failed", e); } }
      return false;
    }
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
  // ---------- walk-in doors (Regions, 2026-09-30) ----------
  // A door may also be a Region over the same rectangle (town-hub runner, `walkIn: true`): walking a token into it
  // fires this on the mover's client. The Region carries flags[bbttcc-travel].locationLink = { ...door link, doorKey,
  // gate? }. gate = { beatMark | anyOf:[beatMark…], fallback?: beatId, message? }: unmet → the fallback beat plays
  // instead of the interior (Donny on the wall; nobody gets past him without a vibe check). One fire per region per
  // 8 s on each seat, and once per door per 8 s on the GM relays, so a party crossing a threshold does not open the
  // same door four times. The same gate guards a click on the door Drawing (dive + the travel.doors.dive relay).
  const _entered = new Map();
  const regionLinkOf = (doc) => { const l = doc?.flags?.[SCOPE]?.locationLink; return (l && typeof l === "object" && l.doorKey) ? l : null; };
  /** The gate guarding a door Drawing: its own link.gate, else the walk-in Region with the same doorKey. */
  function _gateForDoor(drawingDoc, link) {
    const key = String(link?.doorKey || link?.key || "");
    const region = key ? ((drawingDoc?.parent?.regions?.contents || []).find(r => regionLinkOf(r)?.doorKey === key) || null) : null;
    const rlink = region ? regionLinkOf(region) : null;
    const gate = link?.gate || rlink?.gate || null;
    if (!gate) return null;
    return { gate, region, link: rlink || { ...link, doorKey: key, gate }, key: region?.uuid || drawingDoc?.uuid || key };
  }
  // GM-side once-per-window (a party crossing a threshold, or four players walking in, fires once per door).
  const _gmFired = new Map();
  function _gmOnce(key, ms = 8000) {
    const now = Date.now();
    if ((_gmFired.get(key) || 0) > now - ms) return false;
    _gmFired.set(key, now);
    return true;
  }
  function gateMet(gate) {
    if (!gate || typeof gate !== "object") return true;
    const st = game.bbttcc?.api?.campaign?.story; const has = (m) => { try { return !!st?.hasMark?.(m); } catch (_e) { return false; } };
    if (gate.beatMark) return has(gate.beatMark);
    if (Array.isArray(gate.anyOf) && gate.anyOf.length) return gate.anyOf.some(has);
    return true;
  }
  async function _runFallbackBeat(regionDoc, link) {
    const beatId = String(link?.gate?.fallback || "").trim(); if (!beatId || !game.user.isGM) return false;
    const camp = game.bbttcc?.api?.campaign; const cid = camp?.getActiveCampaignId?.();
    if (!camp?.runBeat || !cid) return false;
    try { const r = await camp.runBeat(cid, beatId, { source: "town-door-gate", doorKey: link.doorKey }); return !(r && r.ok === false); }
    catch (e) { warn(`gate fallback ${beatId} failed`, e); return false; }
  }
  /** A token walked into a door Region (call from the Region's executeScript on the mover's client). */
  async function enter(regionUuid, { tokenUuid = null } = {}) {
    const doc = await fromUuid(String(regionUuid || "")).catch(() => null);
    const link = doc ? regionLinkOf(doc) : null;
    if (!link || !isTownHub(doc.parent)) return false;
    // Keyed on the REGION (not region+token): a party walking in together opens the door once.
    const k = doc.uuid; const now = Date.now();
    if ((_entered.get(k) || 0) > now - 8000) return false; _entered.set(k, now);
    const door = (doc.parent.drawings?.contents || []).find(d => linkOf(d)?.key === link.doorKey);
    // A Region whose door Drawing was removed (runner removeDoors) is an orphan — it opens nothing, gate or not.
    if (!door) { warn(`walk-in door ${link.doorKey} has no Drawing on ${doc.parent.name}`); return false; }
    const where = `${link.label || link.doorKey} · ${townLabel(doc.parent)}`;
    if (!gateMet(link.gate)) {
      ui.notifications?.info?.(link.gate?.message || `${where}: not yet.`);
      if (game.user.isGM) return _gmOnce(`fallback:${doc.uuid}`) ? _runFallbackBeat(doc, link) : false;
      const gx = game.bbttcc?.api?.gmExec;
      if (gx?.call && gx.primaryGmId?.()) { try { const r = await gx.call("travel.doors.enter", { regionUuid: doc.uuid, tokenUuid, sceneUuid: canvas?.scene?.uuid }, { timeoutMs: 8000 }); return !!r?.ok; } catch (e) { warn("gate relay failed", e); } }
      return false;
    }
    return dive(door.uuid);
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
      const hit = labelHitAt(p.x, p.y) || hitDoorAt(p.x, p.y); if (!hit) return;
      event.stopPropagation?.();
      dive(hit.document.uuid);
    } catch (err) { console.error(TAG, "pointerdown error:", err); }
  }
  let _moveBroken = false;
  function onPointerMove(event) {
    if (_moveBroken) return;
    try {
      const p = localPos(event); const hit = labelHitAt(p.x, p.y) || hitDoorAt(p.x, p.y);
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
  Hooks.on("bbttcc:story:changed", () => { try { if (isTownHub()) refreshLit(); } catch (_e) {} });
  // the story store is a world setting: every seat hears it change, not just the GM who ran the beat
  Hooks.on("updateSetting", (st) => { try { const k = String(st?.key || ""); if (isTownHub() && (k === `${MOD_CAM}.storyState` || k === `${MOD_CAM}.storyPhase`)) refreshLit(); } catch (_e) {} });
  for (const h of ["createDrawing", "updateDrawing", "deleteDrawing"]) Hooks.on(h, (doc) => { try { if (doc?.parent?.id === canvas?.scene?.id && isTownHub()) { clearLabels(); setTimeout(() => refreshLit(), 50); } } catch (_e) {} });

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
    game.bbttcc.api.travel.doors = { list: listAll, forQuest, beatsForQuest, litDoorsHere, nowDoorsHere, dive, goto, pulse, refreshLit, isTownHub, enter, gateMet, _hitDoorAt: hitDoorAt };
    // GM-side relay (walk-in gate, 2026-09-30): a player's token hit a gated door Region and the gate is shut —
    // the GM seat plays the fallback beat (Donny) at the table. The gate is re-checked here; players cannot skip it.
    try {
      game.bbttcc.api.gmExec?.register?.("travel.doors.enter", async (payload, meta) => {
        if (!game.user.isGM) return { ok: false, why: "not-gm" };
        const doc = await fromUuid(String(payload?.regionUuid || "")).catch(() => null);
        const link = doc ? regionLinkOf(doc) : null;
        if (!link || !isTownHub(doc.parent)) return { ok: false, why: "not-a-door" };
        if (game.scenes?.active?.id !== doc.parent.id) return { ok: false, why: "table-elsewhere" };
        if (gateMet(link.gate)) return { ok: false, why: "gate-open" };   // open gates go through the dive relay instead
        if (!_gmOnce(`fallback:${doc.uuid}`)) return { ok: true, deduped: true };   // the party's other movers
        (async () => { await _runFallbackBeat(doc, link); })().catch(e => warn("relay fallback failed", e));
        return { ok: true };
      });
    } catch (e) { warn("gmExec enter relay register failed", e); }
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
        // The walk-in gate is re-checked here — a player click cannot skip it.
        const gated = _gateForDoor(doc, link);
        if (gated && !gateMet(gated.gate)) {
          if (_gmOnce(`fallback:${gated.key}`)) _runFallbackBeat(gated.region || doc, gated.link).catch(e => warn("relay fallback failed", e));
          return { ok: true, gated: true };
        }
        // Several seats walking/clicking the same door at once open it once.
        if (!_gmOnce(`dive:${doc.uuid}`)) return { ok: true, deduped: true };
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

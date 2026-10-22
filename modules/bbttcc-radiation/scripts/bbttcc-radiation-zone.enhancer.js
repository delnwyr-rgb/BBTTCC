// ============================================================================
// Bad Eden — Radiation "green screen" (scene tint)
//
// One switch (owner ruling 2026-10-22): the tint is DERIVED from the hex Radiation
// level — nothing is set on the scene any more. A scene glows when a hex that leads
// to it is hot:
//   • the hex's on-enter beat (flags.bbttcc-territory.campaign.onEnterBeatId) has
//     this scene as its sceneId, or
//   • the hex lists this scene among its battle scenes (flags.bbttcc-raid.battleScenes)
// The hottest such hex wins:  1 Radiated → light · 2 Contaminated → medium ·
// 3 Radiation Zone → heavy. Hex maps themselves never tint.
//
// Retired 2026-10-22: hand-set scene zones (zone.setScene/clearScene), zone drift on
// Advance Turn, and zone fallout on travel legs — exposure is the hex level only.
//
// The GM seat derives it and caches { level, hexes } on flags.bbttcc-radiation.greenScreen so player
// seats (which can't see other scenes' hexes or the beats) draw the same tint.
// API: game.bbttcc.api.radiation.zone.{getScene (cached) → { intensity, level, color, hexes } | null, compute, sync, redraw}
// ============================================================================

(() => {
  const TAG     = "[bbttcc-radiation/zone]";
  const MOD_SCN = "bbttcc-radiation";
  const MOD_T   = "bbttcc-territory";
  const NAME    = "bbttcc-radiation-zone-overlay";
  const COLOR   = "#A3E635";
  const BY_LEVEL = [
    { intensity: "none",     alpha: 0 },
    { intensity: "low",      alpha: 0.18 },
    { intensity: "moderate", alpha: 0.24 },
    { intensity: "high",     alpha: 0.32 }
  ];

  const bareId = (v) => String(v?.id ?? v ?? "").replace(/^Scene\./, "").trim();

  function resolveScene(sceneOrId) {
    if (!sceneOrId) return canvas?.scene ?? game.scenes?.active ?? null;
    if (sceneOrId instanceof Scene) return sceneOrId;
    return game.scenes?.get(bareId(sceneOrId)) ?? null;
  }

  // Beat ids whose scene is this one (active campaigns' beats).
  function beatIdsForScene(sceneId) {
    const out = new Set();
    try {
      const all = game.bbttcc?.api?.campaign?.getAllCampaigns?.();
      const list = Array.isArray(all) ? all : Object.values(all || {});
      for (const c of list) for (const b of (c?.beats || [])) {
        if (b?.id && b.sceneId && bareId(b.sceneId) === sceneId) out.add(String(b.id));
      }
    } catch (e) { console.warn(TAG, "beat scan failed", e); }
    return out;
  }

  // GM-side derivation (a player seat cannot see other scenes' hexes or the campaign beats).
  function computeZoneForScene(sceneOrId, beatMap = null) {
    const sc = resolveScene(sceneOrId);
    if (!sc) return null;
    const sid = sc.id;
    const beats = beatMap ? (beatMap.get(sid) || new Set()) : beatIdsForScene(sid);
    const radApi = game.bbttcc?.api?.territory?.radiation;
    let level = 0; const hexes = [];
    for (const s of game.scenes ?? []) for (const d of s.drawings ?? []) {
      const tf = d.flags?.[MOD_T];
      if (!tf || !(tf.isHex === true || tf.kind === "territory-hex")) continue;
      const lv = radApi ? radApi.level(d) : Math.max(0, Math.min(3, Number(tf.mods?.radiation) || 0));
      if (lv <= 0) continue;
      const onEnter = String(tf.campaign?.onEnterBeatId || "");
      const battles = d.flags?.["bbttcc-raid"]?.battleScenes;
      const linked = (onEnter && beats.has(onEnter))
        || (Array.isArray(battles) && battles.some(e => bareId(e?.sceneId ?? e?.uuid ?? e) === sid));
      if (!linked) continue;
      hexes.push(tf.name || d.text || d.id);
      level = Math.max(level, lv);
    }
    if (!level) return null;
    return { intensity: BY_LEVEL[level].intensity, level, color: COLOR, hexes };
  }

  // The GM derives each scene's level and caches it on the scene (flags.bbttcc-radiation.greenScreen
  // = { level, hexes }) so every seat — players included — draws the same tint. It is a cache of the
  // hex Radiation level, never an input: only syncGreenScreens() writes it.
  function getZoneForScene(sceneOrId) {
    const sc = resolveScene(sceneOrId);
    const g = sc?.getFlag?.(MOD_SCN, "greenScreen");
    const level = Math.max(0, Math.min(3, Number(g?.level) || 0));
    if (!level) return null;
    return { intensity: BY_LEVEL[level].intensity, level, color: COLOR, hexes: Array.isArray(g.hexes) ? g.hexes : [] };
  }

  function beatMapByScene() {
    const map = new Map();
    try {
      const all = game.bbttcc?.api?.campaign?.getAllCampaigns?.();
      const list = Array.isArray(all) ? all : Object.values(all || {});
      for (const c of list) for (const b of (c?.beats || [])) {
        if (!b?.id || !b.sceneId) continue;
        const sid = bareId(b.sceneId);
        if (!map.has(sid)) map.set(sid, new Set());
        map.get(sid).add(String(b.id));
      }
    } catch (e) { console.warn(TAG, "beat scan failed", e); }
    return map;
  }

  let _syncTimer = null;
  function scheduleSync() {
    if (!game.user?.isGM || (game.users?.activeGM && !game.users.activeGM.isSelf)) return;
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(() => syncGreenScreens().catch(e => console.warn(TAG, "sync failed", e)), 400);
  }
  async function syncGreenScreens() {
    if (!game.user?.isGM || (game.users?.activeGM && !game.users.activeGM.isSelf)) return 0;
    const beatMap = beatMapByScene();
    let n = 0;
    for (const sc of game.scenes ?? []) {
      const z = computeZoneForScene(sc, beatMap);
      const cur = sc.getFlag(MOD_SCN, "greenScreen");
      const curLv = Number(cur?.level) || 0;
      if (!z && !curLv) continue;
      if (z && curLv === z.level && JSON.stringify(cur?.hexes || []) === JSON.stringify(z.hexes)) continue;
      if (z) await sc.setFlag(MOD_SCN, "greenScreen", { level: z.level, hexes: z.hexes });
      else await sc.unsetFlag(MOD_SCN, "greenScreen");
      n++;
    }
    if (n) console.log(TAG, `green screen cache updated on ${n} scene(s)`);
    return n;
  }

  // ---------------------------------------------------------------------------
  // Overlay
  // ---------------------------------------------------------------------------

  function removeZoneOverlay() {
    try {
      const layer = canvas.foreground || canvas.stage;
      const old = layer?.getChildByName?.(NAME);
      if (old) old.destroy(true);
    } catch (e) { console.warn(TAG, "removeZoneOverlay failed", e); }
  }

  function drawZoneOverlay() {
    try {
      removeZoneOverlay();
      const sc = canvas.scene;
      if (!sc) return;
      let show = true;
      try { show = game.settings.get(MOD_SCN, "showZoneOverlay"); } catch (_e) { show = true; }
      if (!show) return;

      const zone = getZoneForScene(sc);
      if (!zone) return;
      const layer = canvas.foreground || canvas.stage;
      if (!layer) return;

      const g = new PIXI.Graphics();
      g.name = NAME;
      g.interactive = false; g.interactiveChildren = false; g.eventMode = "none";   // never eats clicks

      const alpha = BY_LEVEL[zone.level].alpha;
      const col = PIXI.utils.string2hex(zone.color);
      const w = canvas.dimensions.width, h = canvas.dimensions.height;
      g.beginFill(col, alpha); g.drawRect(0, 0, w, h); g.endFill();
      g.lineStyle(1, col, alpha * 0.6);   // subtle fallout stripes
      for (let y = 0; y < h; y += 64) { g.moveTo(0, y); g.lineTo(w, y + 32); }
      layer.addChild(g);
      console.log(TAG, `green screen on ${sc.name}: level ${zone.level} (${zone.hexes.join(", ")})`);
    } catch (e) { console.warn(TAG, "drawZoneOverlay failed", e); }
  }

  function publishAPI() {
    game.bbttcc ??= { api: {} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.radiation ??= {};
    game.bbttcc.api.radiation.zone = { getScene: getZoneForScene, compute: computeZoneForScene, sync: syncGreenScreens, redraw: drawZoneOverlay };
  }

  Hooks.once("init", () => {
    game.settings.register(MOD_SCN, "showZoneOverlay", {
      name: "Radiation: green screen",
      hint: "Tint a battlemap green when the hex that leads to it is radiated (light / medium / heavy by the hex's Radiation level).",
      scope: "client", config: true, type: Boolean, default: true
    });
    Hooks.on("canvasReady", drawZoneOverlay);
  });

  Hooks.once("ready", () => {
    publishAPI();
    // A hex's level or on-enter beat changed → the GM re-derives the cache; every seat redraws
    // when its scene's cache flag changes.
    Hooks.on("bbttcc:hexRadiationChanged", scheduleSync);
    Hooks.on("updateDrawing", (doc, diff) => {
      const m = diff?.flags?.[MOD_T];
      if (m && (m.mods !== undefined || m.campaign !== undefined)) scheduleSync();
    });
    Hooks.on("updateScene", (scene, diff) => {
      if (scene.id === canvas?.scene?.id && diff?.flags?.[MOD_SCN] !== undefined) drawZoneOverlay();
    });
    scheduleSync();
    if (canvas?.scene) drawZoneOverlay();
    console.log(TAG, "green screen ready (derived from hex Radiation level).");
  });
})();

// bbttcc-raid/scripts/siege-muster.js
// RAID_ABILITY_SURVEY.md §5 — The Muster, made visible. Stage 1: "Form Up".
//
// A tableau siege scene models ONE BATTLE within the long siege. The off-camera troops
// (§5 muster) deploy onto that stage as UNIT tokens — each token is a contingent/phalanx
// carrying a `strength` count (a slice of the muster), NOT one-soldier-per-token. Combat is
// resolved by SIMULATION (the siege margin/casualty math), so a unit needs no stat block —
// just a sprite + a strength flag. That is why we can safely auto-create the unit actor.
//
// Placement is forced-perspective by side (tableau.canvas.js): attackers downstage
// (high Y → near/big), defenders at the wall (low Y → far/small). Every token is flagged
// tableauActor so the depth-curve scales it, and tagged musterDeployment for de-dup + recall.
//
// Stage 2 (next): "Resolve the Clash" — simulate the engagement, deplete unit strength,
// rout at zero, reconcile casualties into the §5 muster, fire the projectile VFX.
//
// API (game.bbttcc.api.siege.*):
//   musterToScene({ side, hexUuid?, sceneId?, units?, total?, cols?, label?, disposition?,
//                   unitActorId?, baseY?, force? }) → { ok, created, side, total, per, units, scene }
//   recallMuster({ side?, hexUuid?, sceneId? }) → { ok, removed }
//   musterSize({ side, hexUuid? }) → number | null

(() => {
  globalThis.__bbttcc_siege_muster_loaded_v1 = Date.now();

  const MOD_R = "bbttcc-raid";
  const MOD_T = "bbttcc-territory";
  const MOD_F = "bbttcc-factions";
  const TAG = "[bbttcc/siege-muster]";

  const _num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const _api     = () => game?.bbttcc?.api;
  const _siege   = () => _api()?.siege;
  const _tableau = () => _api()?.raid?.tableau;

  // ── Muster derivation (§5 seed) ──────────────────────────────────────────────
  function _factionTier(f) {
    const t = Number(f?.flags?.[MOD_F]?.tier);
    return (Number.isFinite(t) && t > 0) ? t : 1;
  }
  function _echoCrewCount(f) {
    const ea = f?.flags?.fourththing?.echoAssets || f?.flags?.["roll-for-initiation"]?.echoAssets || {};
    return Array.isArray(ea.activeCrew) ? ea.activeCrew.length : 0;
  }
  // A troop-count scalar from faction tier + active crew. This IS the §5 muster seed:
  // deploy writes it onto siege state, Stage 2's clash depletes it.
  function _factionMuster(f) {
    if (!f) return 60;
    return Math.max(20, 20 * _factionTier(f) + 15 * _echoCrewCount(f));
  }

  // ── Siege / faction / scene resolution ───────────────────────────────────────
  async function _resolveSiege(hexUuid) {
    const S = _siege(); if (!S) return null;
    // Explicit hex → the active scene's bound hex (works on the hexless diorama) → first active
    // siege from list(). NOTE: listActiveSieges() entries are { hexUuid, hexName, sceneId, siege }
    // (state lives under `.siege`), and it only returns ACTIVE sieges — so any entry is valid.
    let uuid = hexUuid || null;
    if (!uuid) { try { uuid = S.resolveActiveHexUuid?.() || null; } catch (_e) {} }
    if (!uuid) {
      try {
        const list = await S.list?.();
        const arr = Array.isArray(list) ? list : [];
        if (arr.length) uuid = arr[0].hexUuid || null;
      } catch (_e) {}
    }
    if (!uuid) return null;
    const st = await S.getState(uuid);
    return st ? { hexUuid: uuid, state: st } : null;
  }

  function _hexOwnerId(hexDoc) {
    const f = hexDoc?.flags?.[MOD_T] || {};
    for (const c of [f.factionId, f.ownerFactionId, f.controllerFactionId, f.faction]) {
      if (typeof c === "string" && c.length) return c;
    }
    return null;
  }

  async function _factionForSide(side, hexUuid, state) {
    if (side === "attacker") return game.actors.get(state?.attackerFactionId) || null;
    try { const hex = await fromUuid(hexUuid); const id = _hexOwnerId(hex); return id ? (game.actors.get(id) || null) : null; }
    catch (_e) { return null; }
  }

  function _wallTokenCenter(scene, state) {
    try {
      const idx = state?.currentLayerIdx ?? 0;
      const wallId = (state?.layers || [])[idx]?.structureActorId;
      if (!wallId || !scene) return null;
      const td = (scene.tokens?.contents || []).find(t => t.actorId === wallId);
      if (!td) return null;
      const gs = _num(scene.grid?.size || scene.gridSize, 100);
      return { x: _num(td.x) + _num(td.width, 1) * gs / 2, y: _num(td.y) + _num(td.height, 1) * gs / 2 };
    } catch (_e) { return null; }
  }

  // ── The unit actor (minimal — combat is simulated) ───────────────────────────
  function _pickActorType() {
    let types = game.documentTypes?.Actor || CONFIG?.Actor?.documentClass?.metadata?.types || [];
    const arr = Array.isArray(types) ? types : Object.keys(types || {});
    for (const t of ["npc", "character"]) if (arr.includes(t)) return t;
    return arr[0] || "npc";
  }
  async function _ensureUnitActor(unitActorId) {
    if (unitActorId) { const a = game.actors.get(unitActorId); if (a) return a; }
    let a = game.actors.find(x => x?.getFlag?.(MOD_R, "musterUnit") === true);
    if (a) return a;
    try {
      a = await Actor.create({
        name: "Muster Unit",
        type: _pickActorType(),
        img: "icons/svg/mystery-man.svg",
        flags: { [MOD_R]: { musterUnit: true } }
      });
    } catch (e) { console.warn(TAG, "unit actor create failed", e); return null; }
    return a;
  }

  // ── Form Up ───────────────────────────────────────────────────────────────────
  async function musterToScene(opts = {}) {
    if (!game.user?.isGM) return { ok: false, error: "GM only" };
    const side = (opts.side === "defender") ? "defender" : "attacker";

    const sib = await _resolveSiege(opts.hexUuid);
    if (!sib) return { ok: false, error: "no active siege found (pass { hexUuid })" };
    const { hexUuid, state } = sib;

    // Scene: explicit → current layer's sceneId → the scene the GM is looking at.
    let scene = opts.sceneId ? game.scenes.get(opts.sceneId) : null;
    if (!scene) { const sid = (state.layers || [])[state.currentLayerIdx ?? 0]?.sceneId; if (sid) scene = game.scenes.get(sid); }
    if (!scene) scene = canvas?.scene || null;
    if (!scene) return { ok: false, error: "no scene to deploy onto" };

    const faction = await _factionForSide(side, hexUuid, state);
    const total = _num(opts.total, 0) || _factionMuster(faction);
    let K = _num(opts.units, 0);
    if (!K) K = Math.max(2, Math.min(8, Math.round(total / 30)));
    const per = Math.max(1, Math.round(total / K));

    const unitActor = await _ensureUnitActor(opts.unitActorId);
    if (!unitActor) return { ok: false, error: "could not resolve a unit actor" };

    // Forced-perspective: ensure tableau is on so depth-scaling applies.
    const tab = _tableau();
    try { if (tab && tab.readConfig?.(scene)?.enabled !== true) await tab.enable?.({}, scene); } catch (_e) {}
    const cfg = (tab?.readConfig?.(scene)) || { frontY: 800, backY: 200 };

    // De-dup per side (recall or pass force to redeploy).
    const existing = (scene.tokens?.contents || []).filter(t => {
      const m = t?.flags?.[MOD_R]?.musterDeployment; return m && m.hexUuid === hexUuid && m.side === side;
    });
    if (existing.length && !opts.force) {
      return { ok: false, error: `${side} muster already deployed (${existing.length} units) — recall first, or pass { force: true }`, existing: existing.length };
    }

    // Formation: a block anchored on the wall's X (or scene centre), in the side's depth band.
    const gs = _num(scene.grid?.size || scene.gridSize, 100);
    const sw = _num(scene.width, 4000), sh = _num(scene.height, 3000);
    const wall = _wallTokenCenter(scene, state);
    const anchorX = wall ? wall.x : sw / 2;
    const cols = Math.max(1, _num(opts.cols, Math.min(K, 4)));
    const stride = gs * 1.6;
    // attacker → downstage (near frontY, big); defender → at the wall (near backY, far/small).
    const baseY = (opts.baseY != null) ? _num(opts.baseY)
                : (side === "attacker" ? _num(cfg.frontY, 800) : _num(cfg.backY, 200) + stride);
    const disposition = (opts.disposition != null) ? _num(opts.disposition) : (side === "attacker" ? 1 : -1);
    const dispMode = globalThis.CONST?.TOKEN_DISPLAY_MODES?.ALWAYS ?? 50;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    const tokenData = [];
    for (let i = 0; i < K; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const x = Math.round(clamp(anchorX + (col - (cols - 1) / 2) * stride, gs, sw - gs));
      const y = Math.round(clamp(baseY + row * stride, gs, sh - gs));
      let proto;
      try { proto = await unitActor.getTokenDocument({ x, y }); }
      catch (e) { console.warn(TAG, "getTokenDocument failed", e); continue; }
      const data = (proto && typeof proto.toObject === "function") ? proto.toObject() : foundry.utils.deepClone(proto);
      data.x = x; data.y = y;
      data.actorLink = false;          // independent tokens → per-unit strength differs/depletes
      data.hidden = false;
      data.disposition = disposition;
      data.displayName = dispMode;
      data.name = `${side === "attacker" ? "⚔" : "🛡"} ${opts.label || "Contingent"} · ${per}`;
      data.flags = data.flags || {};
      data.flags[MOD_R] = Object.assign({}, data.flags[MOD_R] || {}, {
        tableauActor: true,
        unitStrength: per,
        musterDeployment: { hexUuid, side, factionId: faction?.id || null, strength: per, deployedAt: Date.now() }
      });
      tokenData.push(data);
    }
    if (!tokenData.length) return { ok: false, error: "no unit tokens could be built" };

    let created = [];
    try { created = await scene.createEmbeddedDocuments("Token", tokenData); }
    catch (e) { console.warn(TAG, "token create failed", e); return { ok: false, error: `createEmbeddedDocuments failed: ${e.message}` }; }

    try { await tab?.applyAll?.(); } catch (_e) {}

    // Seed §5 muster + record the deployment on siege state (Stage 2's clash reads this).
    try {
      const S = _siege(); const st = await S.getState(hexUuid);
      if (st) {
        st[side === "attacker" ? "attackerMuster" : "defenderMuster"] = total;
        st.musterDeployments = st.musterDeployments || {};
        st.musterDeployments[side] = { total, per, units: K, tokenIds: created.map(t => t.id), sceneId: scene.id, deployedAt: Date.now() };
        await S.setState(hexUuid, st);
      }
    } catch (e) { console.warn(TAG, "muster state write failed", e); }

    ui.notifications?.info(`Formed up ${created.length} ${side} contingent(s) — ${total} strong.`);
    return { ok: true, created: created.length, side, total, per, units: K, scene: scene.id };
  }

  // ── Recall ──────────────────────────────────────────────────────────────────
  async function recallMuster(opts = {}) {
    if (!game.user?.isGM) return { ok: false, error: "GM only" };
    const sib = await _resolveSiege(opts.hexUuid);
    const hexUuid = sib?.hexUuid || opts.hexUuid || null;
    const side = opts.side ? (opts.side === "defender" ? "defender" : "attacker") : null;
    const scene = opts.sceneId ? game.scenes.get(opts.sceneId) : (canvas?.scene || null);
    if (!scene) return { ok: false, error: "no scene" };
    const ids = (scene.tokens?.contents || []).filter(t => {
      const m = t?.flags?.[MOD_R]?.musterDeployment; if (!m) return false;
      if (hexUuid && m.hexUuid !== hexUuid) return false;
      if (side && m.side !== side) return false;
      return true;
    }).map(t => t.id);
    if (!ids.length) return { ok: true, removed: 0 };
    try { await scene.deleteEmbeddedDocuments("Token", ids); }
    catch (e) { return { ok: false, error: e.message }; }
    ui.notifications?.info(`Recalled ${ids.length} muster unit(s).`);
    return { ok: true, removed: ids.length };
  }

  async function musterSize(opts = {}) {
    const sib = await _resolveSiege(opts.hexUuid); if (!sib) return null;
    const side = (opts.side === "defender") ? "defender" : "attacker";
    const f = await _factionForSide(side, sib.hexUuid, sib.state);
    return _factionMuster(f);
  }

  // ── Install ───────────────────────────────────────────────────────────────────
  function _install() {
    const S = _siege(); if (!S) return false;
    S.musterToScene = musterToScene;
    S.recallMuster  = recallMuster;
    S.musterSize    = musterSize;
    return true;
  }
  Hooks.once("ready", () => {
    if (!_install()) {
      let n = 0;
      const iv = setInterval(() => { if (_install() || ++n > 40) clearInterval(iv); }, 250);
    }
    console.log(TAG, "ready — game.bbttcc.api.siege.{musterToScene,recallMuster,musterSize}");
  });

  console.log(TAG, "loaded");
})();

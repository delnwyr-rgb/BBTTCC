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
  const _turn    = () => { try { return Number(game.bbttcc?.api?.world?.getState?.()?.turn) || 0; } catch { return 0; } };

  // The territory HEX MAP must never be auto-flipped into a battle diorama: stamping
  // flags.bbttcc-raid.tableau onto it makes bbttccIsHexMapScene() (territory/main.js)
  // misclassify it and suppress ALL hex chrome — the 2026-06-04 "extra hex" regression.
  // A scene holding real territory hexes is the map: deploy flat there, no forced perspective.
  function _sceneHasHexes(scene) {
    try { return (scene?.drawings?.contents || []).some(d => d?.flags?.[MOD_T]?.isHex === true); }
    catch (_e) { return false; }
  }

  // Fire a siege beat locally + relay over the socket so VFX/HUD react on every client.
  // Mirrors siege-vfx._relaySiege / siege-counter-activities._relayHook.
  function _relay(hook, payload) {
    try { Hooks.callAll(hook, payload); } catch (e) { console.warn(TAG, "relay callAll failed", e); }
    try { game.socket?.emit?.(`module.${MOD_R}`, { t: "siegeHook", hook, payload }); } catch (_e) {}
  }

  // ── Muster derivation (§5 seed) ──────────────────────────────────────────────
  function _factionTier(f) {
    const t = Number(f?.flags?.[MOD_F]?.tier);
    return (Number.isFinite(t) && t > 0) ? t : 1;
  }
  function _echoCrewCount(f) {
    const ea = f?.flags?.fourththing?.echoAssets || f?.flags?.["roll-for-initiation"]?.echoAssets || {};
    return Array.isArray(ea.activeCrew) ? ea.activeCrew.length : 0;
  }
  // LEGACY fallback only (pre-pool formula). THE MUSTER POOL (siege-muster-pool.js) now owns
  // the real number — this formula survives as the pool's CAP and as the deploy total when
  // the pool engine is absent or the side has no faction (unowned hex).
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

  // ── Garrison helpers (defenders ON the walls) ────────────────────────────────
  // Each fortification layer with a wall token on the scene can be MANNED: a slice of the
  // defender muster stands on the wall's footprint. Because garrison contingents are NPC
  // contingents (not structures), the breach collapse (collapse.js findTokensInsideFootprint)
  // catches them automatically → breaching a manned wall slaughters its garrison.
  function _layerWallTokens(scene, state) {
    const out = [];
    const gs = _num(scene.grid?.size || scene.gridSize, 100);
    for (const layer of (state?.layers || [])) {
      const wallId = layer?.structureActorId;
      if (!wallId) continue;
      const td = (scene.tokens?.contents || []).find(t => t.actorId === wallId);
      if (!td) continue;
      const w = _num(td.width, 1) * gs, h = _num(td.height, 1) * gs;
      let plateMax = 0;
      try { plateMax = _num(_api()?.structures?.readState?.(game.actors.get(wallId))?.plates?.max, 0); } catch (_e) {}
      out.push({ layer, td, x: _num(td.x), y: _num(td.y), w, h, cx: _num(td.x) + w / 2, cy: _num(td.y) + h / 2, plateMax });
    }
    return out;
  }
  // K slot CENTERS clustered on a wall's footprint, biased toward the battlements (upper third),
  // clamped so each token center lands inside the wall's grid cells (so collapse catches them).
  // Returns top-left token coords (center − gs/2).
  function _garrisonSlots(wall, K, gs) {
    const cols = Math.max(1, Math.min(K, 4));
    const rows = Math.ceil(K / cols);
    const sx = gs * 0.9, sy = gs * 0.75;
    const slots = [];
    for (let i = 0; i < K; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      let ccx = wall.cx + (c - (cols - 1) / 2) * sx;
      let ccy = wall.cy + (r - (rows - 1) / 2) * sy - wall.h * 0.12;   // bias up = on the battlements
      ccx = Math.max(wall.x + gs * 0.3, Math.min(wall.x + wall.w - gs * 0.3, ccx));
      ccy = Math.max(wall.y + gs * 0.3, Math.min(wall.y + wall.h - gs * 0.3, ccy));
      slots.push({ x: Math.round(ccx - gs / 2), y: Math.round(ccy - gs / 2) });
    }
    return slots;
  }

  // ── Crew join (a contingent mans the structure it stands on) ──────────────────
  // The structure owns the crew relationship (game.bbttcc.api.structures.crew). A muster
  // contingent whose center sits on a fortification's footprint auto-JOINS that structure's
  // garrison; drag it off and it's released. garrisonWalls pre-tags its drops so it can assign
  // them race-free; hand-drags are handled live by the create/move hooks below.
  function _structureTokenUnder(scene, tokDoc) {
    if (!scene || !tokDoc) return null;
    const gs = _num(scene.grid?.size || scene.gridSize, 100);
    const cx = _num(tokDoc.x) + _num(tokDoc.width, 1) * gs / 2;
    const cy = _num(tokDoc.y) + _num(tokDoc.height, 1) * gs / 2;
    for (const t of (scene.tokens?.contents || [])) {
      if (t.id === tokDoc.id) continue;
      const a = t.actor;
      if (a?.getFlag?.("bbttcc-structures", "hasStructure") !== true) continue;
      const w = _num(t.width, 1) * gs, h = _num(t.height, 1) * gs;
      const x = _num(t.x), y = _num(t.y);
      if (cx >= x && cx <= x + w && cy >= y && cy <= y + h) return t;
    }
    return null;
  }
  // Re-evaluate which structure (if any) a contingent crews, releasing the old + joining the
  // new. Single-token, sequential — safe for one-at-a-time user drags. Skips when unchanged.
  async function _reconcileCrew(tokDoc) {
    if (!game.user?.isGM) return;
    const md = tokDoc?.flags?.[MOD_R]?.musterDeployment;
    if (!md) return;                                   // only muster contingents
    const crew = _api()?.structures?.crew; if (!crew) return;
    const scene = tokDoc.parent; if (!scene) return;
    const prevId = tokDoc.flags?.[MOD_R]?.crewingStructureId || null;
    // Routed/spilled rubble (strength 0) doesn't man walls — when an ejected 💀 contingent is
    // shoved onto a neighbour's footprint, don't re-crew it. Release from any prior wall + bail.
    if (_tokStrength(tokDoc) <= 0) {
      if (prevId) { const a = game.actors.get(prevId); if (a) { try { await crew.release(a, tokDoc.id); } catch (_e) {} } }
      if (prevId) { try { await tokDoc.update({ [`flags.${MOD_R}.crewingStructureId`]: null }); } catch (_e) {} }
      return;
    }
    const structTok = _structureTokenUnder(scene, tokDoc);
    const newId = structTok?.actor?.id || null;
    if (prevId === newId) return;                      // no change (also breaks the flag-write loop)
    if (prevId) { const a = game.actors.get(prevId); if (a) { try { await crew.release(a, tokDoc.id); } catch (_e) {} } }
    if (newId) {
      const strength = _num(tokDoc.flags?.[MOD_R]?.unitStrength, md.strength);
      try { await crew.assign(structTok.actor, { tokenId: tokDoc.id, label: tokDoc.name, strength }); } catch (_e) {}
      try { const c = crew.read(structTok.actor); ui.notifications?.info?.(`${tokDoc.name} mans ${structTok.actor.name}.`); } catch (_e) {}
    }
    try { await tokDoc.update({ [`flags.${MOD_R}.crewingStructureId`]: newId }); } catch (_e) {}
  }
  async function _releaseCrewOnDelete(tokDoc) {
    if (!game.user?.isGM) return;
    const prevId = tokDoc?.flags?.[MOD_R]?.crewingStructureId || null;
    if (!prevId) return;
    const crew = _api()?.structures?.crew; const a = game.actors.get(prevId);
    if (crew && a) { try { await crew.release(a, tokDoc.id); } catch (_e) {} }
  }

  // ── Pool checkin (survivors come home) ────────────────────────────────────────
  // THE SINGLE REFUND PATH: any deleted muster contingent credits its SURVIVING strength
  // back to its faction's pool — recallMuster's deletes and hand-deletes both land here, so
  // nothing double-refunds. Routed contingents (strength 0) and clash casualties (strength
  // already depleted on the token) refund exactly what survived. NOTE: deleting a whole
  // SCENE skips deleteToken hooks — recall the muster before tearing a battle scene down.
  async function _refundPoolOnDelete(tokDoc) {
    if (!game.user?.isGM) return;
    const md = tokDoc?.flags?.[MOD_R]?.musterDeployment;
    if (!md?.factionId) return;
    const s = _tokStrength(tokDoc);
    if (s <= 0) return;
    const f = game.actors.get(md.factionId); if (!f) return;
    try { await _siege()?.pool?.credit?.(f, s, "recalled from the field"); } catch (e) { console.warn(TAG, "pool refund failed", e); }
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

    // Faction override (Supporter Integration 2026-06-03): a JOINED supporter musters its own
    // contingents alongside the lead's. Default (no opts.factionId) = the side's principal
    // faction, exactly as before.
    let faction;
    if (opts.factionId) {
      faction = game.actors.get(opts.factionId) || null;
      if (!faction) return { ok: false, error: `faction ${opts.factionId} not found` };
      if (side === "attacker" && opts.factionId !== state.attackerFactionId && !(state.participants?.[opts.factionId]?.joined)) {
        return { ok: false, error: `${faction.name} hasn't joined this siege — Join Siege first` };
      }
    } else {
      faction = await _factionForSide(side, hexUuid, state);
    }

    const unitActor = await _ensureUnitActor(opts.unitActorId);
    if (!unitActor) return { ok: false, error: "could not resolve a unit actor" };

    // Forced-perspective: ensure tableau is on so depth-scaling applies.
    const tab = _tableau();
    try { if (tab && tab.readConfig?.(scene)?.enabled !== true && !_sceneHasHexes(scene)) await tab.enable?.({}, scene); } catch (_e) {}
    const cfg = (tab?.readConfig?.(scene)) || { frontY: 800, backY: 200 };

    // De-dup per FACTION within the side (recall or pass force to redeploy) — a supporter
    // forming up next to an already-deployed lead is the whole point, so only the same
    // faction's prior deployment blocks.
    const dedupFid = faction?.id || null;
    const existing = (scene.tokens?.contents || []).filter(t => {
      const m = t?.flags?.[MOD_R]?.musterDeployment;
      if (!m || m.hexUuid !== hexUuid || m.side !== side) return false;
      return dedupFid ? (m.factionId === dedupFid) : true;
    });
    if (existing.length && !opts.force) {
      return { ok: false, error: `${faction?.name || side} muster already deployed (${existing.length} units) — recall first, or pass { force: true }`, existing: existing.length };
    }

    // THE MUSTER POOL (discrete-costs directive): Form Up CHECKS TROOPS OUT of the faction's
    // finite pool — you field what you actually have (capped by overextension), not a formula.
    // Recall checks survivors back in (deleteToken hook below); casualties never come home.
    // No pool API / no faction → legacy formula (e.g. an unowned defender hex).
    const P = _siege()?.pool || null;
    let total = Math.max(0, _num(opts.total, 0));
    if (P && faction) {
      const avail = P.fieldable(faction);
      total = total ? Math.min(total, avail) : avail;
      if (total <= 0) {
        const pp = P.get(faction);
        return { ok: false, error: `${faction.name} has no troops to field (pool ${pp.size}/${pp.cap}${pp.effectiveCap < pp.cap ? `, fields at most ${pp.effectiveCap} — ${pp.band}` : ""}) — ⚒ Raise Troops first.` };
      }
    } else if (!total) {
      total = _factionMuster(faction);
    }
    let K = _num(opts.units, 0);
    if (!K) K = Math.max(2, Math.min(8, Math.round(total / 30)));
    K = Math.max(1, Math.min(K, total));               // never more units than troops
    // Exact strengths (first `rem` units carry the remainder) so the checkout sums to `total`.
    const baseStr = Math.floor(total / K), remStr = total - baseStr * K;
    const strengths = Array.from({ length: K }, (_, i) => baseStr + (i < remStr ? 1 : 0));
    const per = Math.max(1, Math.round(total / K));

    // Formation: a block anchored on the wall's X (or scene centre), in the side's depth band.
    const gs = _num(scene.grid?.size || scene.gridSize, 100);
    const sw = _num(scene.width, 4000), sh = _num(scene.height, 3000);
    const wall = _wallTokenCenter(scene, state);
    const cols = Math.max(1, _num(opts.cols, Math.min(K, 4)));
    const stride = gs * 1.6;
    // Stagger co-combatant blocks: when OTHER factions already hold this side's band, shift
    // this faction's block sideways (alternating right/left) so allied hosts stand abreast.
    let anchorX = wall ? wall.x : sw / 2;
    {
      const otherFactions = new Set((scene.tokens?.contents || [])
        .map(t => t?.flags?.[MOD_R]?.musterDeployment)
        .filter(m => m && m.hexUuid === hexUuid && m.side === side && m.factionId && m.factionId !== dedupFid)
        .map(m => m.factionId));
      const bi = otherFactions.size;
      if (bi > 0) anchorX += Math.ceil(bi / 2) * (cols * stride + gs) * (bi % 2 ? 1 : -1);
    }
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
      const str = strengths[i];
      data.name = `${side === "attacker" ? "⚔" : "🛡"} ${opts.label || (opts.factionId ? (faction?.name || "Contingent") : "Contingent")} · ${str}`;
      data.flags = data.flags || {};
      data.flags[MOD_R] = Object.assign({}, data.flags[MOD_R] || {}, {
        tableauActor: true,
        unitStrength: str,
        musterDeployment: { hexUuid, side, factionId: faction?.id || null, strength: str, deployedAt: Date.now() }
      });
      tokenData.push(data);
    }
    if (!tokenData.length) return { ok: false, error: "no unit tokens could be built" };

    let created = [];
    try { created = await scene.createEmbeddedDocuments("Token", tokenData); }
    catch (e) { console.warn(TAG, "token create failed", e); return { ok: false, error: `createEmbeddedDocuments failed: ${e.message}` }; }

    // Checkout: the fielded strength leaves the pool (survivors return on recall/delete).
    if (P && faction) {
      const deployed = created.reduce((a, t) => a + _num(t.flags?.[MOD_R]?.unitStrength, 0), 0);
      try { await P.debit(faction, deployed, `form up — ${side}`); } catch (e) { console.warn(TAG, "pool debit failed", e); }
    }

    try { await tab?.applyAll?.(); } catch (_e) {}

    // Seed §5 muster + record the deployment on siege state (Stage 2's clash reads this).
    // The side scalar is RECOMPUTED from ALL same-side tokens on the scene (faction-agnostic
    // sum), so a supporter's contingents ADD to the muster instead of clobbering the lead's.
    let sideTotal = total;
    try {
      const S = _siege(); const st = await S.getState(hexUuid);
      if (st) {
        sideTotal = _sideUnitTokens(scene, hexUuid, side).reduce((a, t) => a + _tokStrength(t), 0) || total;
        st[side === "attacker" ? "attackerMuster" : "defenderMuster"] = sideTotal;
        st.musterDeployments = st.musterDeployments || {};
        const prev = st.musterDeployments[side];
        const prevIds = (prev?.sceneId === scene.id)
          ? (prev.tokenIds || []).filter(id => scene.tokens.get(id))
          : [];
        st.musterDeployments[side] = { total: sideTotal, per, units: K, tokenIds: [...prevIds, ...created.map(t => t.id)], sceneId: scene.id, deployedAt: Date.now() };
        await S.setState(hexUuid, st);
      }
    } catch (e) { console.warn(TAG, "muster state write failed", e); }

    ui.notifications?.info(`Formed up ${created.length} ${side} contingent(s) — ${total} strong${sideTotal !== total ? ` (side now ${sideTotal})` : ""}.`);
    try { _siege()?.refreshHud?.(); } catch (_e) {}   // pool chips just changed (checkout)
    return { ok: true, created: created.length, side, total, sideTotal, per, units: K, scene: scene.id };
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
      if (opts.factionId && m.factionId !== opts.factionId) return false;   // supporter recalls only ITS host
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
    // What the side could field RIGHT NOW: the finite pool (capped by overextension),
    // legacy formula only when the pool engine is absent / the hex has no faction.
    const P = _siege()?.pool;
    return (P && f) ? P.fieldable(f) : _factionMuster(f);
  }

  // ── Garrison the Walls (defenders man the fortifications) ─────────────────────
  // Split the defender muster: most of it GARRISONS the wall layers (staged on each present
  // wall's footprint, tagged garrisonLayerId), the rest stands as a field RESERVE behind. A
  // manned wall fights stiffer (resolveClash scales its bonus to remaining garrison); breaching
  // a wall culls its garrison (collapse → muster bridge) and the survivors bleed into the muster.
  async function garrisonWalls(opts = {}) {
    if (!game.user?.isGM) return { ok: false, error: "GM only" };

    const sib = await _resolveSiege(opts.hexUuid);
    if (!sib) return { ok: false, error: "no active siege found (pass { hexUuid })" };
    const { hexUuid, state } = sib;

    let scene = opts.sceneId ? game.scenes.get(opts.sceneId) : null;
    if (!scene) { const sid = (state.layers || [])[state.currentLayerIdx ?? 0]?.sceneId; if (sid) scene = game.scenes.get(sid); }
    if (!scene) scene = canvas?.scene || null;
    if (!scene) return { ok: false, error: "no scene to deploy onto" };

    const faction = await _factionForSide("defender", hexUuid, state);
    const garrisonPct = Math.max(0, Math.min(1, opts.garrisonPct != null ? _num(opts.garrisonPct, 0.7) : 0.7));

    // De-dup the whole defender side (garrison + reserve).
    const existing = (scene.tokens?.contents || []).filter(t => {
      const m = t?.flags?.[MOD_R]?.musterDeployment; return m && m.hexUuid === hexUuid && m.side === "defender";
    });
    if (existing.length && !opts.force) {
      return { ok: false, error: `defender muster already deployed (${existing.length} units) — recall first, or pass { force: true }`, existing: existing.length };
    }

    // THE MUSTER POOL: the garrison is checked out of the defender's finite pool, same as
    // the attacker's Form Up. Unowned hex (no defender faction) → legacy formula, no debit.
    const P = _siege()?.pool || null;
    let total = Math.max(0, _num(opts.total, 0));
    if (P && faction) {
      const avail = P.fieldable(faction);
      total = total ? Math.min(total, avail) : avail;
      if (total <= 0) {
        const pp = P.get(faction);
        return { ok: false, error: `${faction.name} has no troops to man the walls (pool ${pp.size}/${pp.cap}${pp.effectiveCap < pp.cap ? `, fields at most ${pp.effectiveCap} — ${pp.band}` : ""}) — ⚒ Raise Troops first.` };
      }
    } else if (!total) {
      total = _factionMuster(faction);
    }

    const tab = _tableau();
    try { if (tab && tab.readConfig?.(scene)?.enabled !== true && !_sceneHasHexes(scene)) await tab.enable?.({}, scene); } catch (_e) {}
    const cfg = (tab?.readConfig?.(scene)) || { frontY: 800, backY: 200 };

    const unitActor = await _ensureUnitActor(opts.unitActorId);
    if (!unitActor) return { ok: false, error: "could not resolve a unit actor" };

    const gs = _num(scene.grid?.size || scene.gridSize, 100);
    const sw = _num(scene.width, 4000), sh = _num(scene.height, 3000);
    const dispMode = globalThis.CONST?.TOKEN_DISPLAY_MODES?.ALWAYS ?? 50;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    const walls = _layerWallTokens(scene, state);
    const garrisonTotal = walls.length ? Math.round(total * garrisonPct) : 0;
    const reserveTotal = total - garrisonTotal;
    const weights = walls.map(w => Math.max(1, w.plateMax || 1));
    const wsum = weights.reduce((a, b) => a + b, 0) || 1;

    const mkTok = async (x, y, strength, deploy, label, crewingStructureId = null, hidden = false) => {
      let proto;
      try { proto = await unitActor.getTokenDocument({ x, y }); }
      catch (e) { console.warn(TAG, "getTokenDocument failed", e); return null; }
      const data = (proto && typeof proto.toObject === "function") ? proto.toObject() : foundry.utils.deepClone(proto);
      data.x = x; data.y = y; data.actorLink = false; data.hidden = hidden; data.disposition = -1; data.displayName = dispMode;
      data.name = `🛡 ${label} · ${strength}`;
      data.flags = data.flags || {};
      data.flags[MOD_R] = Object.assign({}, data.flags[MOD_R] || {}, {
        tableauActor: true, unitStrength: strength,
        // Pre-tag the crewing structure so the create-hook skips it (no race) — garrisonWalls
        // assigns these to the structure crew itself, sequentially, just below.
        crewingStructureId: crewingStructureId || null,
        musterDeployment: Object.assign({ hexUuid, side: "defender", factionId: faction?.id || null, strength, deployedAt: Date.now() }, deploy)
      });
      return data;
    };

    const tokenData = [];
    const plannedGarrison = {};   // layerId → { full, units, per }
    for (let wi = 0; wi < walls.length; wi++) {
      const wall = walls[wi];
      const g = Math.round(garrisonTotal * weights[wi] / wsum);
      if (g <= 0) continue;
      const K = Math.max(1, Math.min(5, Math.round(g / 25) || 1));
      const per = Math.max(1, Math.round(g / K));
      const slots = _garrisonSlots(wall, K, gs);
      for (let i = 0; i < K; i++) {
        // hidden:true → the garrison is BOARDED inside the wall (invisible) until it crumbles.
        const d = await mkTok(slots[i].x, slots[i].y, per, { garrisonLayerId: wall.layer.layerId }, "Garrison", wall.td.actorId, true);
        if (d) tokenData.push(d);
      }
      plannedGarrison[wall.layer.layerId] = { full: g, units: K, per, structureActorId: wall.td.actorId };
    }

    // Field reserve — a band at the defender's deep position (far/small on the tableau).
    let plannedReserve = null;
    if (reserveTotal > 0) {
      const Kr = Math.max(1, Math.min(6, Math.round(reserveTotal / 30) || 1));
      const perR = Math.max(1, Math.round(reserveTotal / Kr));
      const cols = Math.max(1, Math.min(Kr, 4));
      const stride = gs * 1.6;
      const baseY = (opts.reserveBaseY != null) ? _num(opts.reserveBaseY) : _num(cfg.backY, 200) + stride;
      const anchorX = sw / 2;
      for (let i = 0; i < Kr; i++) {
        const col = i % cols, row = Math.floor(i / cols);
        const x = Math.round(clamp(anchorX + (col - (cols - 1) / 2) * stride, gs, sw - gs));
        const y = Math.round(clamp(baseY + row * stride, gs, sh - gs));
        const d = await mkTok(x, y, perR, { reserve: true }, "Reserve");
        if (d) tokenData.push(d);
      }
      plannedReserve = { total: reserveTotal, units: Kr, per: perR };
    }

    if (!tokenData.length) return { ok: false, error: "no defender units could be built" };

    let created = [];
    try { created = await scene.createEmbeddedDocuments("Token", tokenData); }
    catch (e) { console.warn(TAG, "garrison token create failed", e); return { ok: false, error: `createEmbeddedDocuments failed: ${e.message}` }; }

    // Checkout: the deployed garrison + reserve leave the defender's pool.
    if (P && faction) {
      const deployed = created.reduce((a, t) => a + _num(t.flags?.[MOD_R]?.unitStrength, 0), 0);
      try { await P.debit(faction, deployed, "garrison the walls"); } catch (e) { console.warn(TAG, "pool debit failed", e); }
    }

    try { await tab?.applyAll?.(); } catch (_e) {}

    // Crew the walls: each garrison contingent JOINS its wall's structure. Sequential awaits =
    // race-free (the create-hook skips these since they ship with crewingStructureId pre-set).
    const crew = _api()?.structures?.crew;
    if (crew) {
      for (const t of created) {
        const md = t.flags?.[MOD_R]?.musterDeployment;
        const structId = md?.garrisonLayerId ? plannedGarrison[md.garrisonLayerId]?.structureActorId : null;
        const wallActor = structId ? game.actors.get(structId) : null;
        if (wallActor) { try { await crew.assign(wallActor, { tokenId: t.id, label: t.name, strength: _num(t.flags?.[MOD_R]?.unitStrength, md.strength) }); } catch (_e) {} }
      }
      // Retype each manned fortification: zero the inherited vehicle crew (pilot/gunner) so the
      // CREW tab stops offering them. The garrison runs through the siege crew relationship.
      for (const layerId of Object.keys(plannedGarrison)) {
        const a = game.actors.get(plannedGarrison[layerId]?.structureActorId);
        if (a && crew.retypeFortification) { try { await crew.retypeFortification(a); } catch (_e) {} }
      }
    }

    // Record the deployment: per-layer garrison (with token ids) + reserve, and seed defenderMuster.
    try {
      const S = _siege(); const st = await S.getState(hexUuid);
      if (st) {
        st.defenderMuster = total;
        st.musterDeployments = st.musterDeployments || {};
        const garrison = {};
        for (const [layerId, meta] of Object.entries(plannedGarrison)) {
          const ids = created.filter(t => t.flags?.[MOD_R]?.musterDeployment?.garrisonLayerId === layerId).map(t => t.id);
          garrison[layerId] = { full: meta.full, units: meta.units, per: meta.per, tokenIds: ids };
        }
        const reserveIds = created.filter(t => t.flags?.[MOD_R]?.musterDeployment?.reserve === true).map(t => t.id);
        st.musterDeployments.defender = {
          total, garrisonPct, sceneId: scene.id, deployedAt: Date.now(),
          garrison, reserve: plannedReserve ? Object.assign({}, plannedReserve, { tokenIds: reserveIds }) : null
        };
        await S.setState(hexUuid, st);
      }
    } catch (e) { console.warn(TAG, "garrison state write failed", e); }

    const layersManned = Object.keys(plannedGarrison).length;
    ui.notifications?.info(`Garrison deployed — ${total} strong: ${garrisonTotal} on ${layersManned} wall(s), ${reserveTotal} in reserve.`);
    try { _siege()?.refreshHud?.(); } catch (_e) {}
    return { ok: true, total, garrisonTotal, reserveTotal, layersManned, created: created.length, scene: scene.id };
  }

  // ── Stage 2: Resolve the Clash ───────────────────────────────────────────────
  // Simulate the engagement between the two formed-up musters. A short multi-round
  // attrition exchange: each side fells the other in proportion to its CURRENT strength
  // (Lanchester-ish), tilted by the defender's wall (lost once breached) + any Storm order
  // + luck. It then depletes each unit token's `strength`, routs units at zero, reconciles
  // the §5 muster (muster IS the field → equals the surviving strength), lays down a
  // butcher's-bill beat + chat card, and fires the projectile VFX. Combat is SIMULATED
  // (units carry only a strength flag, no stat block) — exactly the model Stage 1 set up.

  function _sideUnitTokens(scene, hexUuid, side) {
    return (scene.tokens?.contents || []).filter(t => {
      const m = t?.flags?.[MOD_R]?.musterDeployment;
      return m && m.hexUuid === hexUuid && m.side === side;
    });
  }
  const _tokStrength = (t) => Math.max(0, _num(t?.flags?.[MOD_R]?.unitStrength, 0));

  // Clash morale (overextension bites): an overextended faction's host fights soft. The
  // side multiplier is the strength-weighted average of each contributing faction's morale
  // mult (×1/×1/×0.95/×0.90/×0.80 by logistics band) — a fresh supporter stiffens a
  // strained lead's line in proportion to the troops it actually fields.
  function _sideMoraleMult(tokens) {
    const P = _siege()?.pool; if (!P) return 1;
    let w = 0, m = 0;
    for (const t of tokens) {
      const s = _tokStrength(t); if (s <= 0) continue;
      const fid = t?.flags?.[MOD_R]?.musterDeployment?.factionId;
      const f = fid ? game.actors.get(fid) : null;
      m += s * (f ? P.clashMoraleMult(f) : 1);
      w += s;
    }
    return w > 0 ? (m / w) : 1;
  }

  // Distribute `casualties` across `tokens` proportional to current strength (largest-
  // remainder), never below 0 and never beyond a unit's strength. Returns Map id → newStrength.
  function _distributeCasualties(tokens, casualties) {
    const out = new Map();
    for (const t of tokens) out.set(t.id, _tokStrength(t));
    const live = tokens.filter(t => _tokStrength(t) > 0);
    const total = live.reduce((a, t) => a + _tokStrength(t), 0);
    const cas = Math.min(Math.max(0, Math.round(casualties)), total);
    if (total <= 0 || cas <= 0) return out;
    const alloc = live.map(t => {
      const exact = cas * (_tokStrength(t) / total);
      const floor = Math.floor(exact);
      return { id: t.id, take: floor, frac: exact - floor, cap: _tokStrength(t) };
    });
    let rem = cas - alloc.reduce((a, x) => a + x.take, 0);
    alloc.sort((a, b) => b.frac - a.frac);
    for (let i = 0; i < alloc.length && rem > 0; i++) if (alloc[i].take < alloc[i].cap) { alloc[i].take++; rem--; }
    let guard = 0;
    while (rem > 0 && guard++ < 10000) {                       // spill any capped remainder
      let placed = false;
      for (const x of alloc) { if (rem <= 0) break; if (x.take < x.cap) { x.take++; rem--; placed = true; } }
      if (!placed) break;
    }
    for (const x of alloc) out.set(x.id, Math.max(0, x.cap - x.take));
    return out;
  }

  function _clashTitle(outcome) {
    return ({
      defender_routed: "The wall is swept",
      attacker_routed: "The assault is thrown back",
      mutual_collapse: "Both hosts break",
      stalemate:       "The lines grind"
    })[outcome] || "The lines meet";
  }

  async function _clashCard({ hexName, outcome, breached, atkLost, defLost, A, D, A0, D0, rounds, atkMorale = 1, defMorale = 1 }) {
    // Overextension footnote — only when a side actually fought soft.
    const mLine = (atkMorale < 1 || defMorale < 1)
      ? `<div style="font-size:0.72em;color:#c9a;margin-top:.25rem;">overextension saps morale: ⚔ ×${atkMorale.toFixed(2)} · 🛡 ×${defMorale.toFixed(2)}</div>`
      : "";
    const pct = (lost, base) => base > 0 ? Math.round(100 * lost / base) : 0;
    const color = outcome === "defender_routed" ? "#ff7a5a"
                : outcome === "attacker_routed" ? "#88bbff"
                : outcome === "mutual_collapse" ? "#ff5555" : "#d9a441";
    try {
      await ChatMessage.create({
        content: `<div class="bbttcc-siege-clash" style="border:1px solid ${color};border-radius:6px;padding:.5rem .7rem;">
          <h3 style="margin:0 0 .3rem;color:${color};">⚔ ${foundry.utils.escapeHTML(_clashTitle(outcome))} — ${foundry.utils.escapeHTML(hexName || "the fortress")}</h3>
          <div style="font-size:0.82em;color:#ccc;">The lines met ${breached ? "at the breach" : "before the wall"} over ${rounds} round${rounds === 1 ? "" : "s"}.</div>
          <table style="width:100%;margin-top:.35rem;font-size:0.8em;color:#ddd;border-collapse:collapse;">
            <tr style="color:#999;"><th style="text-align:left;"></th><th style="text-align:right;">Fell</th><th style="text-align:right;">Left</th><th style="text-align:right;">Lost</th></tr>
            <tr><td style="color:#ffb;">⚔ Attacker</td><td style="text-align:right;">${atkLost}</td><td style="text-align:right;">${A}</td><td style="text-align:right;">${pct(atkLost, A0)}%</td></tr>
            <tr><td style="color:#bdf;">🛡 Defender</td><td style="text-align:right;">${defLost}</td><td style="text-align:right;">${D}</td><td style="text-align:right;">${pct(defLost, D0)}%</td></tr>
          </table>${mLine}
        </div>`
      });
    } catch (e) { console.warn(TAG, "clash card failed", e); }
  }

  async function resolveClash(opts = {}) {
    if (!game.user?.isGM) return { ok: false, error: "GM only" };

    const sib = await _resolveSiege(opts.hexUuid);
    if (!sib) return { ok: false, error: "no active siege found (pass { hexUuid })" };
    const { hexUuid, state } = sib;

    let scene = opts.sceneId ? game.scenes.get(opts.sceneId) : null;
    if (!scene) { const sid = (state.layers || [])[state.currentLayerIdx ?? 0]?.sceneId; if (sid) scene = game.scenes.get(sid); }
    if (!scene) scene = canvas?.scene || null;
    if (!scene) return { ok: false, error: "no scene" };

    const atkTokens = _sideUnitTokens(scene, hexUuid, "attacker");
    const defTokens = _sideUnitTokens(scene, hexUuid, "defender");
    if (!atkTokens.length || !defTokens.length) {
      return { ok: false, error: `both sides must be formed up first (attacker units: ${atkTokens.length}, defender units: ${defTokens.length}) — run musterToScene for each side` };
    }

    let A = atkTokens.reduce((a, t) => a + _tokStrength(t), 0);
    let D = defTokens.reduce((a, t) => a + _tokStrength(t), 0);
    const A0 = A, D0 = D;
    if (A <= 0 || D <= 0) return { ok: false, error: `a side is already spent (attacker ${A}, defender ${D}) — recall + re-form to fight again` };

    // Fortification posture: an unbreached current layer lets the defender trade up; once
    // breached the structural advantage is gone. ON TOP of the stone, a MANNED wall fights
    // stiffer — the bonus scales with how much garrison still holds the current layer (full
    // garrison → big bonus, thinned/slaughtered → little). Storm Final Assault presses harder.
    const layer = (state.layers || [])[state.currentLayerIdx ?? 0] || null;
    const breached = !!layer?.breached;
    // Garrison fill on THIS layer's structure — the CREW relationship is the source of truth:
    // live crewing strength / the structure's garrison capacity. Full = stiff, slaughtered = soft.
    let garrisonFrac = 0;
    const wallActor = layer?.structureActorId ? game.actors.get(layer.structureActorId) : null;
    const crewApi = _api()?.structures?.crew;
    if (wallActor && crewApi) {
      const cap = _num(crewApi.capacity?.(wallActor), 0);
      if (cap > 0) {
        const cr = crewApi.read?.(wallActor) || { assigned: [] };
        let live = 0;
        for (const m of (cr.assigned || [])) { const t = scene.tokens.get(m.tokenId); if (t) live += _tokStrength(t); }
        garrisonFrac = Math.max(0, Math.min(1, live / cap));
      }
    }
    const structuralMult = breached ? 1.0 : _num(opts.wallMult, 1.3);   // the stone itself
    const garrisonMult   = 1 + 0.4 * garrisonFrac;                       // manned battlements
    const stormMult = state.stormAssault ? 1.25 : 1.0;
    // Overextension morale: each side's effectiveness scales with how healthy the factions
    // fielding it are (see _sideMoraleMult) — critically overextended hosts hit at ×0.80.
    const atkMorale = _sideMoraleMult(atkTokens);
    const defMorale = _sideMoraleMult(defTokens);
    const atkEff = _num(opts.atkEff, 0.15) * stormMult * _num(opts.attackerBonus, 1) * atkMorale;
    const defEff = _num(opts.defEff, 0.15) * structuralMult * garrisonMult * _num(opts.defenderBonus, 1) * defMorale;

    const rounds = Math.max(1, Math.min(6, _num(opts.rounds, 3)));
    const luck = () => 0.78 + Math.random() * 0.44;            // 0.78–1.22 per-exchange swing
    const roundLog = [];
    for (let r = 0; r < rounds; r++) {
      const defCas = Math.min(D, Math.round(A * atkEff * luck()));   // attacker fells defenders
      const atkCas = Math.min(A, Math.round(D * defEff * luck()));   // defenders fell attackers
      A = Math.max(0, A - atkCas);
      D = Math.max(0, D - defCas);
      roundLog.push({ round: r + 1, atkCas, defCas, atkLeft: A, defLeft: D });
      if (A <= 0 || D <= 0) break;
    }
    let outcome = "stalemate";
    if (A <= 0 && D <= 0) outcome = "mutual_collapse";
    else if (D <= 0) outcome = "defender_routed";
    else if (A <= 0) outcome = "attacker_routed";
    const atkLost = A0 - A, defLost = D0 - D;

    // Deplete the unit tokens to match the simulated survivors; rout (mark/optionally remove) at 0.
    const atkNew = _distributeCasualties(atkTokens, atkLost);
    const defNew = _distributeCasualties(defTokens, defLost);
    const updates = [], routedIds = [];
    const _mkUpdate = (t, side) => {
      const newStr = (side === "attacker" ? atkNew : defNew).get(t.id) ?? _tokStrength(t);
      const f = t.flags?.[MOD_R] || {};
      const md = f.musterDeployment || {};
      const routed = newStr <= 0;
      const label = String(t.name || "").replace(/^💀\s*/, "").replace(/\s*·\s*\d+.*$/, "").trim() || "Contingent";
      const u = {
        _id: t.id,
        name: routed ? `💀 ${label} · 0` : `${label} · ${newStr}`,
        [`flags.${MOD_R}.unitStrength`]: newStr,
        [`flags.${MOD_R}.musterDeployment`]: Object.assign({}, md, { strength: newStr, routed })
      };
      if (routed) { u.alpha = 0.4; routedIds.push(t.id); }
      updates.push(u);
    };
    for (const t of atkTokens) _mkUpdate(t, "attacker");
    for (const t of defTokens) _mkUpdate(t, "defender");
    try { if (updates.length) await scene.updateEmbeddedDocuments("Token", updates); }
    catch (e) { console.warn(TAG, "token depletion update failed", e); }
    if (opts.removeRouted && routedIds.length) {
      try { await scene.deleteEmbeddedDocuments("Token", routedIds); }
      catch (e) { console.warn(TAG, "routed-token removal failed", e); }
    }
    try { await _tableau()?.applyAll?.(); } catch (_e) {}

    // Reconcile the §5 muster (muster IS the field → equals surviving strength) + record the
    // clash for the end-of-siege butcher's bill.
    const turn = _turn();
    try {
      const S = _siege(); const st = await S.getState(hexUuid);
      if (st) {
        st.attackerMuster = A;
        st.defenderMuster = D;
        st.clashCasualties = st.clashCasualties || { attacker: 0, defender: 0 };
        st.clashCasualties.attacker += atkLost;
        st.clashCasualties.defender += defLost;
        st.clashes = Array.isArray(st.clashes) ? st.clashes : [];
        st.clashes.push({ turn, rounds: roundLog.length, atkLost, defLost, atkLeft: A, defLeft: D, outcome });
        S.appendNarrativeBeat(st, {
          turn, kind: "clash", title: _clashTitle(outcome),
          description: `The lines meet ${breached ? "at the breach" : "before the wall"}: attacker −${atkLost} (${A} left), defender −${defLost} (${D} left).`,
          payload: { atkLost, defLost, atkLeft: A, defLeft: D, outcome, rounds: roundLog.length }
        });
        await S.setState(hexUuid, st);
      }
    } catch (e) { console.warn(TAG, "clash state write failed", e); }

    // §6 VFX — fire the clash spectacle on every client (relayed). Volley scales with host size.
    const wallId = layer?.structureActorId || null;
    const volley = Math.max(2, Math.min(8, Math.round(Math.min(A0, D0) / 30)));
    _relay("bbttcc:siege:clash", { siegeId: state.siegeId, hexUuid, outcome, atkLost, defLost, atkLeft: A, defLeft: D, rounds: roundLog.length });
    _relay("bbttcc:siege:projectile", { structureActorId: wallId, family: breached ? "fire" : "boulder", count: volley, direction: "incoming", shake: true });
    if (D > 0) _relay("bbttcc:siege:projectile", { structureActorId: wallId, family: "arrows", count: Math.max(2, Math.round(volley * 0.7)), direction: "outgoing", shake: false });

    // Hex name for the card. On the hexless tableau, fromUuid returns the territory drawing —
    // its display name lives in flags.bbttcc-territory.name (a bare Drawing has no .name), so
    // read that first (matches listActiveSieges) before any .name fallback.
    let hexName = null;
    try { const ref = await fromUuid(hexUuid); hexName = ref?.flags?.[MOD_T]?.name || ref?.name || null; } catch (_e) {}
    await _clashCard({ hexName, outcome, breached, atkLost, defLost, A, D, A0, D0, rounds: roundLog.length, atkMorale, defMorale });
    try { _siege()?.refreshHud?.(); } catch (_e) {}

    ui.notifications?.info(`Clash resolved — ${_clashTitle(outcome)} (attacker −${atkLost}, defender −${defLost}).`);
    return { ok: true, outcome, rounds: roundLog.length, attacker: { start: A0, left: A, lost: atkLost, morale: atkMorale }, defender: { start: D0, left: D, lost: defLost, morale: defMorale }, log: roundLog, routed: routedIds.length };
  }

  // ── Collapse → muster bridge ──────────────────────────────────────────────────
  // When a wall breaches, collapse.js culls the tokens on its footprint (rubble damage + prone).
  // For garrison contingents that's the fiction made real — so fold those casualties into the
  // abstract muster: reduce unitStrength by the rubble toll, rout at 0, reconcile defenderMuster.
  // GM-only (collapse is GM-authoritative). Harmless globally: non-muster tokens are skipped.
  async function _onStructureCollapse(payload) {
    if (!game.user?.isGM) return;
    const scene = canvas?.scene; if (!scene) return;
    const structActor = payload?.actor;
    const results = Array.isArray(payload?.results) ? payload.results : [];

    // Everything keys off the TOKEN id (reliable for unlinked muster tokens sharing one base
    // actor). One update per token (cull + eject merged), applied in a single batch.
    const updateMap = new Map();   // tokenId → token update obj
    let hexUuid = null, culled = 0;

    // 1. Casualty cull — the caught contingents lose unitStrength by the rubble toll.
    for (const res of results) {
      const loss = Math.max(0, _num(res?.rolled, _num(res?.applied, 0)));
      if (loss <= 0) continue;
      const tid = res?.tokenId || res?.actor?.token?.id || null;
      const tok = tid ? scene.tokens.get(tid)
                      : (scene.tokens?.contents || []).find(t => t.actor?.id === res?.actor?.id);
      const md = tok?.flags?.[MOD_R]?.musterDeployment;
      if (!tok || !md) continue;                                            // not a muster contingent
      const prev = _tokStrength(tok);
      const next = Math.max(0, prev - loss);
      culled += (prev - next);
      const routed = next <= 0;
      const label = String(tok.name || "").replace(/^💀\s*/, "").replace(/\s*·\s*\d+.*$/, "").trim() || "Garrison";
      const u = updateMap.get(tok.id) || { _id: tok.id };
      u.name = routed ? `💀 ${label} · 0` : `${label} · ${next}`;
      u[`flags.${MOD_R}.unitStrength`] = next;
      u[`flags.${MOD_R}.musterDeployment`] = Object.assign({}, md, { strength: next, routed });
      if (routed) u.alpha = 0.4;
      updateMap.set(tok.id, u);
      if (md.hexUuid && !hexUuid) hexUuid = md.hexUuid;
    }

    // 2. EJECT set = every CAUGHT contingent (above) ∪ any token crewing the collapsed structure.
    // Whatever the collapse touched OR that manned the wall spills out — ALWAYS unhide; reposition
    // downstage only if the wall token still exists (a razed wall has none → unhide in place).
    const ejectIds = new Set(updateMap.keys());
    if (structActor) {
      for (const t of (scene.tokens?.contents || [])) {
        if (t?.flags?.[MOD_R]?.crewingStructureId === structActor.id && t?.flags?.[MOD_R]?.musterDeployment) ejectIds.add(t.id);
      }
    }
    if (ejectIds.size) {
      const structTok = structActor ? (scene.tokens?.contents || []).find(t => t.actorId === structActor.id) : null;
      const gs = _num(scene.grid?.size || scene.gridSize, 100);
      let baseX = null, baseY = null;
      if (structTok) { baseX = _num(structTok.x) + _num(structTok.width, 1) * gs / 2; baseY = _num(structTok.y) + _num(structTok.height, 1) * gs; }
      const ids = [...ejectIds]; let i = 0;
      for (const tid of ids) {
        const t = scene.tokens.get(tid);
        if (!t || !t.flags?.[MOD_R]?.musterDeployment) continue;
        const u = updateMap.get(tid) || { _id: tid };
        u.hidden = false;
        u[`flags.${MOD_R}.crewingStructureId`] = null;
        if (baseX != null) { u.x = Math.round(baseX + (i - (ids.length - 1) / 2) * gs * 1.2 - gs / 2); u.y = Math.round(baseY + gs * 0.5); }
        updateMap.set(tid, u);
        if (!hexUuid) hexUuid = t.flags?.[MOD_R]?.musterDeployment?.hexUuid || null;
        i++;
      }
    }

    // 3. Apply all token changes (cull + eject) in one batch; release ejected from crew.
    if (updateMap.size) {
      try { await scene.updateEmbeddedDocuments("Token", [...updateMap.values()]); }
      catch (e) { console.warn(TAG, "collapse→muster/eject update failed", e); }
    }
    if (structActor) {
      const crew = _api()?.structures?.crew;
      if (crew) { for (const tid of ejectIds) { try { await crew.release(structActor, tid); } catch (_e) {} } }
    }
    try { await _tableau()?.applyAll?.(); } catch (_e) {}

    // 3. Reconcile the defender muster = surviving defender strength on the scene.
    if (hexUuid) {
      try {
        const S = _siege(); const st = await S.getState(hexUuid);
        if (st) {
          const survivors = (scene.tokens?.contents || [])
            .filter(t => { const m = t?.flags?.[MOD_R]?.musterDeployment; return m && m.hexUuid === hexUuid && m.side === "defender"; })
            .reduce((a, t) => a + _tokStrength(t), 0);
          st.defenderMuster = survivors;
          st.clashCasualties = st.clashCasualties || { attacker: 0, defender: 0 };
          st.clashCasualties.defender += culled;
          S.appendNarrativeBeat(st, { turn: _turn(), kind: "garrison_culled", title: "The garrison falls with the wall", description: `Defenders caught in the collapse — −${culled}, defender muster down to ${survivors}.` });
          await S.setState(hexUuid, st);
        }
      } catch (e) { console.warn(TAG, "garrison muster reconcile failed", e); }
    }
    try { _siege()?.refreshHud?.(); } catch (_e) {}
  }

  // Convenience for the HUD: form up BOTH sides in one gesture. Attacker = field host;
  // defender = GARRISON the walls + field reserve (falls back to a plain field band when no
  // wall tokens are staged). Pass { defenderField: true } to force the old field-band defender.
  async function formUpBoth(opts = {}) {
    const a = await musterToScene(Object.assign({}, opts, { side: "attacker" }));
    const d = opts.defenderField
      ? await musterToScene(Object.assign({}, opts, { side: "defender" }))
      : await garrisonWalls(opts);
    return { ok: !!(a.ok || d.ok), attacker: a, defender: d };
  }

  // End-of-siege muster reconciliation (read-only): the butcher's bill for the saga / outcome card.
  async function musterReport(opts = {}) {
    const sib = await _resolveSiege(opts.hexUuid); if (!sib) return null;
    const st = sib.state || {};
    const cc = st.clashCasualties || { attacker: 0, defender: 0 };
    return {
      hexUuid: sib.hexUuid,
      attacker: { muster: _num(st.attackerMuster, null), clashDead: _num(cc.attacker, 0) },
      defender: { muster: _num(st.defenderMuster, null), clashDead: _num(cc.defender, 0) },
      clashes: Array.isArray(st.clashes) ? st.clashes.length : 0
    };
  }

  // ── Install ───────────────────────────────────────────────────────────────────
  function _install() {
    const S = _siege(); if (!S) return false;
    S.musterToScene = musterToScene;
    S.recallMuster  = recallMuster;
    S.musterSize    = musterSize;
    S.resolveClash  = resolveClash;
    S.garrisonWalls = garrisonWalls;
    S.formUpBoth    = formUpBoth;
    S.musterReport  = musterReport;
    return true;
  }
  Hooks.once("ready", () => {
    if (!_install()) {
      let n = 0;
      const iv = setInterval(() => { if (_install() || ++n > 40) clearInterval(iv); }, 250);
    }
    // Garrison casualties: when a wall breaches, fold the collapse cull into the muster.
    if (!globalThis.__bbttcc_siege_muster_collapse_hook) {
      Hooks.on("bbttcc:structure:collapse", _onStructureCollapse);
      globalThis.__bbttcc_siege_muster_collapse_hook = true;
    }
    // Drag-to-join: a contingent dropped/moved onto a fortification footprint mans it (and is
    // released when dragged off / deleted). garrisonWalls' own drops pre-tag crewingStructureId
    // so the create-hook no-ops on them (it assigns them itself, race-free).
    if (!globalThis.__bbttcc_siege_muster_crew_hooks) {
      Hooks.on("createToken", (doc) => { _reconcileCrew(doc).catch(() => {}); });
      Hooks.on("updateToken", (doc, changes) => { if (changes?.x !== undefined || changes?.y !== undefined) _reconcileCrew(doc).catch(() => {}); });
      Hooks.on("deleteToken", (doc) => { _releaseCrewOnDelete(doc).catch(() => {}); _refundPoolOnDelete(doc).catch(() => {}); });
      globalThis.__bbttcc_siege_muster_crew_hooks = true;
    }
    console.log(TAG, "ready — game.bbttcc.api.siege.{musterToScene,recallMuster,musterSize,resolveClash,garrisonWalls,formUpBoth,musterReport}");
  });

  console.log(TAG, "loaded");
})();

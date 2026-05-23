// bbttcc-raid/scripts/siege-layer-transition.js
// SIEGE_RAID_TYPE_SPEC.md §5 — Phase D.2: layer transition engine.
//
// Subscribes to bbttcc:structure:stateChanged (bbttcc-structures/damage-path.js:436,
// payload { actor, fromState, toState, ctx }). When the changed structure is the
// CURRENT layer of an active siege, evaluates that layer's transitionRule:
//
//   razed     → structure toState === "razed"
//               (load-bearing locks at "breached" until sephirotic material is chipped,
//                then loadBearing flips false and it can reach "razed" — so "razed" is the
//                universal terminal trigger; no load-bearing special-case needed)
//   threshold → plates.current / plates.max <= layer.thresholdPct
//   stockpile → layer.stockpileCurrent <= 0  (depleted by Renewal / Bulwark Siege Cost / Sortie)
//
// On breach: mark layer breached, advance currentLayerIdx, fire bbttcc:siege:layerBreached
// (+ siegeHook relay so D.3 VFX plays on every client). If the final layer falls →
// status "won_storm" + bbttcc:siege:outcome (full §8 write-back is Phase F). Otherwise →
// scene-swap to the next layer + light the convene pip.
//
// GM-only: siege state lives on shared hex docs and structure damage is applied GM-side
// via the canonical apply-damage path (see [[chat-apply-damage-canonical]]), so the hook
// fires GM-side. Mirrors siege-tick.js's GM guard.

(() => {
  globalThis.__bbttcc_siege_layer_transition_loaded_v1 = Date.now();

  const MOD_R = "bbttcc-raid";
  const MOD_S = "bbttcc-structures";
  const TAG = "[bbttcc/siege-layer]";

  function _currentTurn(){
    try { return Number(game.bbttcc?.api?.world?.getState?.()?.turn) || 0; }
    catch { return 0; }
  }

  function _readPlates(actor){
    const p = actor?.getFlag?.(MOD_S, "plates") || {};
    return { current: Number(p.current) || 0, max: Number(p.max) || 0 };
  }

  function _layerName(layer, idx){
    return game.actors?.get?.(layer?.structureActorId)?.name || layer?.layerId || `Layer ${idx + 1}`;
  }

  function _siegeSceneSwap(sceneId){
    if (!sceneId) return;
    const scene = game.scenes?.get?.(sceneId);
    if (!scene) return;
    try { scene.view(); } catch (e) { console.warn(TAG, "scene.view failed", e); }
    try { game.socket?.emit?.(`module.${MOD_R}`, { t: "siegeSceneSwap", sceneId }); } catch (_e) {}
  }

  /**
   * Does the current layer breach, given the structure's new state?
   * Pure given (layer, actor, toState). Exposed for the selftest.
   */
  function layerBreaches(layer, actor, toState){
    const rule = layer?.transitionRule || "razed";
    if (rule === "threshold") {
      const pct = Number(layer.thresholdPct);
      if (!Number.isFinite(pct)) return String(toState) === "razed"; // misconfigured → fall back to razed
      const { current, max } = _readPlates(actor);
      if (max <= 0) return false; // can't evaluate without a max
      return (current / max) <= pct;
    }
    if (rule === "stockpile") {
      return Number(layer.stockpileCurrent) <= 0;
    }
    // "razed" (default)
    return String(toState) === "razed";
  }

  async function _breachLayer(hexUuid, S){
    const cur = await S.getSiegeState(hexUuid);
    if (!cur || cur.status !== "active") return;
    const state = foundry.utils.duplicate(cur);
    const idx = state.currentLayerIdx ?? 0;
    const layer = (state.layers || [])[idx];
    if (!layer || layer.breached) return;
    const turn = _currentTurn();
    const layerName = _layerName(layer, idx);

    // 1. Mark breached.
    layer.breached = true;
    layer.breachedAtTurn = turn;
    layer.breachedBy = "damage";
    S.appendNarrativeBeat(state, {
      turn,
      kind: "layer_breached",
      title: `${layerName} falls`,
      description: `Layer ${idx + 1} of ${state.layers.length} breached (${layer.transitionRule || "razed"}) on turn ${turn}.`,
      payload: { layerIdx: idx, layerName, rule: layer.transitionRule || "razed" }
    });

    // 2. Advance.
    state.currentLayerIdx = idx + 1;
    const breachPayload = { siegeId: state.siegeId, hexUuid, layerIdx: idx, layerName, nextLayerIdx: state.currentLayerIdx };

    let stormed = false;
    if (state.currentLayerIdx >= state.layers.length) {
      // 3. Final layer → carried by storm. Status only; full §8 write-back is Phase F.
      stormed = true;
      state.status = "won_storm";
      state.endedTurn = turn;
      state._suggestConvene = false;
      S.appendNarrativeBeat(state, {
        turn,
        kind: "siege_storm",
        title: "The last layer falls — the place is carried by storm",
        description: `All ${state.layers.length} layer(s) breached. Outcome: won_storm (ownership / morale / war-log write-back lands in Phase F).`
      });
    } else {
      // 4. Press the next layer: swap scene if bound, light the convene pip.
      const next = state.layers[state.currentLayerIdx];
      if (next?.sceneId) _siegeSceneSwap(next.sceneId);
      state._suggestConvene = true;
    }

    await S.setSiegeState(hexUuid, state);

    // 5. Breach hook + relay (D.3 Catastrophic Entry VFX subscribes here).
    Hooks.callAll("bbttcc:siege:layerBreached", breachPayload);
    try { game.socket?.emit?.(`module.${MOD_R}`, { t: "siegeHook", hook: "bbttcc:siege:layerBreached", payload: breachPayload }); } catch (_e) {}

    if (stormed) {
      const outPayload = { siegeId: state.siegeId, hexUuid, status: "won_storm" };
      Hooks.callAll("bbttcc:siege:outcome", outPayload);
      try { game.socket?.emit?.(`module.${MOD_R}`, { t: "siegeHook", hook: "bbttcc:siege:outcome", payload: outPayload }); } catch (_e) {}
    }
  }

  async function _onStateChanged(payload){
    const { actor, toState } = payload || {};
    if (!game.user?.isGM) return;       // GM owns siege-state mutations
    if (!actor?.id) return;
    const S = globalThis.__bbttccSiegeState;
    if (!S?.listActiveSieges) return;

    for (const entry of S.listActiveSieges()) {
      const s = entry.siege;
      if (!s || s.status !== "active") continue;
      const idx = s.currentLayerIdx ?? 0;
      const layer = (s.layers || [])[idx];
      // Only the CURRENT layer of this siege, matched to the changed structure actor.
      if (!layer || layer.breached || layer.structureActorId !== actor.id) continue;
      if (!layerBreaches(layer, actor, toState)) continue;
      try { await _breachLayer(entry.hexUuid, S); }
      catch (err) { console.error(TAG, `breach failed for siege ${s.siegeId}`, err); }
    }
  }

  function _install(){
    Hooks.on("bbttcc:structure:stateChanged", _onStateChanged);
    game.bbttcc = game.bbttcc || { api: {} };
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.siege = game.bbttcc.api.siege || {};
    // Debug / manual: force-breach the current layer; pure rule predicate for the selftest.
    game.bbttcc.api.siege.breachCurrentLayer = async (hexUuid) => {
      const S = globalThis.__bbttccSiegeState;
      if (!S) return { ok: false, reason: "siege-state not loaded" };
      await _breachLayer(hexUuid, S);
      return { ok: true };
    };
    game.bbttcc.api.siege.layerBreaches = layerBreaches;
    console.log(TAG, "layer transition engine subscribed to bbttcc:structure:stateChanged (D.2).");
  }

  Hooks.once("ready", _install);
  if (game?.ready) _install();

  console.log(TAG, "loaded");
})();

// bbttcc-raid/scripts/siege-relief.js
// SIEGE_RAID_TYPE_SPEC.md §4 (Relief Force) — Phase E.3: the Relief Force scene.
//
// A relief wave (pushed by call_relief / "Send Relief Force") rides a 2-turn clock. When
// it lands, siege-tick.js step 7 marks wave.arrived + lights state._suggestReliefConvene +
// fires bbttcc:siege:reliefArrives (relayed for VFX). This module surfaces the resolution:
//
//   conveneRelief({ hexUuid, waveId? })  — GM gesture (Siege HUD "🛡 Relieve" button):
//      1. Swap to the open-field relief scene (wave.sceneId / state.reliefSceneId), if bound.
//      2. Open the raid console with relief context.
//      3. Fire bbttcc:siege:reliefConvene (+ relay) and open the resolution dialog.
//
//   resolveRelief({ hexUuid, waveId?, outcome }) — apply the result:
//      • attacker_won  → wave resolved; Buffer −15; defender −1 morale (pendingMoraleDeltas,
//                        drained by Phase F); fires bbttcc:siege:reliefRepulsed. Siege grinds on.
//      • attacker_lost → status "lost_relieved" + endedTurn; fires bbttcc:siege:outcome
//                        (D.3 VFX already has the lost_relieved palette). §8 morale
//                        (attacker −2 / relieving faction +1 / relationship) is Phase F's
//                        outcome write-back — NOT recorded here, to avoid double-counting.
//
// Mirrors the convene pattern (siege-hud.js) + the duel dialog (siege-champion-duel.js).
// Open-field relief scenes carry NO Structure layers (spec §4).

(() => {
  globalThis.__bbttcc_siege_relief_loaded_v1 = Date.now();

  const MOD_R = "bbttcc-raid";
  const TAG = "[bbttcc/siege-relief]";

  const _siege = () => game.bbttcc?.api?.siege || null;
  const _nm = (id) => game.actors?.get?.(id)?.name || id || "an ally";
  const _currentTurn = () => { try { return Number(game.bbttcc?.api?.world?.getState?.()?.turn) || 0; } catch { return 0; } };
  const _esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

  function _relayHook(hook, payload){
    Hooks.callAll(hook, payload);
    try { game.socket?.emit?.(`module.${MOD_R}`, { t: "siegeHook", hook, payload }); } catch (_e) {}
  }

  function _resolveSiegeEntry({ hexUuid, siegeId } = {}){
    const S = globalThis.__bbttccSiegeState;
    if (!S?.listActiveSieges) return null;
    const sieges = S.listActiveSieges();
    if (hexUuid) return sieges.find(e => e.hexUuid === hexUuid) || null;
    if (siegeId) return sieges.find(e => e.siege?.siegeId === siegeId) || null;
    if (sieges.length === 1) return sieges[0];
    return null; // ambiguous — caller decides
  }

  // Pick the relief wave to act on: explicit waveId, else the first arrived + unresolved.
  function _pickWave(state, waveId){
    const waves = Array.isArray(state?.reliefWaves) ? state.reliefWaves : [];
    if (waveId) return waves.find(w => w.waveId === waveId && !w.resolved) || null;
    return waves.find(w => w.arrived && !w.resolved) || waves.find(w => !w.resolved) || null;
  }

  // After resolving one wave, re-point the HUD suggest pip at the next pending arrival (if any).
  function _renextSuggest(state){
    const next = (state.reliefWaves || []).find(w => w.arrived && !w.resolved);
    state._suggestReliefConvene = next ? next.waveId : null;
  }

  // The besieged faction = the besieged hex's owner (whose morale a repulse dents).
  async function _defenderFactionId(hexUuid){
    const S = globalThis.__bbttccSiegeState;
    try {
      const ref = await fromUuid(hexUuid);
      const doc = ref?.document ?? ref ?? null;
      return (doc && S?.hexOwner) ? (S.hexOwner(doc) || null) : null;
    } catch { return null; }
  }

  // ─── Resolution ──────────────────────────────────────────────────────────

  async function _applyRelief(entry, wave, outcome, rolls){
    const api = _siege();
    const S = globalThis.__bbttccSiegeState;
    const hexUuid = entry.hexUuid;
    const turn = _currentTurn();

    const fresh = await api.getState(hexUuid);
    if (!fresh) return ui.notifications?.warn?.("No active siege on that hex.");
    const w = _pickWave(fresh, wave.waveId);
    if (!w) return ui.notifications?.warn?.("That relief wave is already resolved.");

    const reliever = w.callingFactionId;
    let bufferShaved = 0;

    w.resolved = true;
    w.outcome = outcome;
    w.resolvedTurn = turn;
    if (rolls) w.rolls = rolls;

    if (outcome === "attacker_won") {
      // Relief repulsed — the besieger holds the field. Buffer −15; defender −1 morale.
      const sh = S.shaveBuffer(fresh.buffer, 15);
      bufferShaved = sh.shaved;
      const defenderId = await _defenderFactionId(hexUuid);
      if (defenderId) S.recordMoraleDelta(fresh, { factionId: defenderId, delta: -1, reason: "relief_repulsed", turn });
      _renextSuggest(fresh);
      S.appendNarrativeBeat(fresh, {
        turn,
        kind: "relief_repulsed",
        title: `Relief from ${_nm(reliever)} is thrown back`,
        description: `The besieging army holds the open field. Buffer −${bufferShaved} OP; defender −1 morale (applied in Phase F).`,
        payload: { waveId: w.waveId, callingFactionId: reliever, bufferShaved, rolls }
      });
      await api.setState(hexUuid, fresh);

      const payload = { siegeId: fresh.siegeId, hexUuid, waveId: w.waveId, callingFactionId: reliever, bufferShaved, rolls };
      _relayHook("bbttcc:siege:reliefRepulsed", payload);

    } else {
      // Relief breaks through — the siege auto-collapses.
      fresh.status = "lost_relieved";
      fresh.endedTurn = turn;
      _renextSuggest(fresh);
      S.appendNarrativeBeat(fresh, {
        turn,
        kind: "siege_relieved",
        title: `Relief from ${_nm(reliever)} breaks the siege`,
        description: "The relieving army shatters the besiegers in the field — the siege collapses (lost_relieved). Morale + relationship write-back land in Phase F's outcome matrix.",
        payload: { waveId: w.waveId, callingFactionId: reliever, rolls }
      });
      await api.setState(hexUuid, fresh);

      // §8 lost_relieved morale (attacker −2 / relieving +1 / relationship) is Phase F's
      // outcome write-back, keyed off this terminal status — do NOT record it here.
      _relayHook("bbttcc:siege:outcome", { siegeId: fresh.siegeId, hexUuid, status: "lost_relieved", callingFactionId: reliever });
    }

    // Chat card.
    const rollLine = rolls
      ? `<div style="font-size:0.85em;color:#aaa;">Besiegers rolled <b>${rolls.attacker}</b> · relief force rolled <b>${rolls.relief}</b></div>`
      : "";
    const won = outcome === "attacker_won";
    await ChatMessage.create({
      content: `<div class="bbttcc-siege-relief" style="border:1px solid ${won ? "#d9a441" : "#88bbff"};border-radius:6px;padding:.5rem .7rem;">
        <h3 style="margin:0 0 .25rem;color:${won ? "#d9a441" : "#88bbff"};">🛡 Relief Force — ${_esc(entry.hexName || "Siege")}</h3>
        <div>${won
          ? `Relief from <b>${_esc(_nm(reliever))}</b> is <b style="color:#d9a441;">REPULSED</b>. Buffer −${bufferShaved} OP; defender −1 morale.`
          : `Relief from <b>${_esc(_nm(reliever))}</b> <b style="color:#88bbff;">BREAKS THE SIEGE</b>. The besiegers withdraw (<i>lost_relieved</i>).`}</div>
        ${rollLine}
      </div>`
    });

    ui.notifications?.info?.(won ? `Relief repulsed (Buffer −${bufferShaved}).` : "Relief breaks the siege — lost_relieved.");
    api.refreshHud?.();
  }

  // ─── Resolution dialog ──────────────────────────────────────────────────

  async function _openReliefDialog(entry, wave){
    const reliever = _nm(wave.callingFactionId);
    const content = `
      <div style="display:flex;flex-direction:column;gap:.5rem;font-size:0.9rem;">
        <div style="color:#88bbff;">Siege: <b>${_esc(entry.hexName || "—")}</b></div>
        <div>Relief force sent by <b>${_esc(reliever)}</b> meets the besieging army in the open field.</div>
        <fieldset style="border:1px solid #555;border-radius:4px;padding:.3rem .5rem;">
          <legend>Field battle</legend>
          <label style="display:block;"><input type="radio" name="mode" value="roll" checked> Roll it (besiegers 1d20 vs relief 1d20; besiegers hold ties)</label>
          <label style="display:block;"><input type="radio" name="mode" value="attacker"> Besiegers hold the field (declared)</label>
          <label style="display:block;"><input type="radio" name="mode" value="relief"> Relief breaks through (declared) — siege collapses</label>
        </fieldset>
        <div style="font-size:0.78rem;color:#999;">Hold → Buffer −15 + defender −1 morale, siege continues. Break → <i>lost_relieved</i>.</div>
      </div>`;

    new Dialog({
      title: "🛡 Relief Force",
      content,
      buttons: {
        resolve: {
          icon: '<i class="fas fa-shield-halved"></i>',
          label: "Resolve Relief",
          callback: async (html) => {
            const root = html[0] ?? html;
            const mode = root.querySelector('[name="mode"]:checked')?.value || "roll";
            let outcome, rolls = null;
            if (mode === "attacker") {
              outcome = "attacker_won";
            } else if (mode === "relief") {
              outcome = "attacker_lost";
            } else {
              const a = (await new Roll("1d20").evaluate()).total;
              const d = (await new Roll("1d20").evaluate()).total;
              rolls = { attacker: a, relief: d };
              outcome = a >= d ? "attacker_won" : "attacker_lost"; // besiegers hold ties
            }
            try { await _applyRelief(entry, wave, outcome, rolls); }
            catch (e) { console.error(TAG, "resolve failed", e); ui.notifications?.error?.("Relief resolution failed — see console."); }
          }
        },
        cancel: { label: "Cancel" }
      },
      default: "resolve"
    }).render(true);
  }

  // ─── Convene ──────────────────────────────────────────────────────────────

  async function conveneRelief(opts = {}){
    if (!game.user?.isGM) return ui.notifications?.warn?.("Only the GM can convene a Relief Scene.");
    const api = _siege();
    if (!api) return ui.notifications?.warn?.("Siege API not available.");

    const S = globalThis.__bbttccSiegeState;
    const sieges = S?.listActiveSieges?.() || [];
    if (!sieges.length) return ui.notifications?.warn?.("No active siege.");

    let entry = _resolveSiegeEntry(opts);
    if (!entry) { entry = sieges[0]; if (sieges.length > 1) ui.notifications?.info?.(`Multiple sieges active — using ${entry.hexName}. Pass {hexUuid} to target another.`); }

    const state = await api.getState(entry.hexUuid);
    if (!state) return ui.notifications?.warn?.("No active siege on that hex.");
    const wave = _pickWave(state, opts.waveId);
    if (!wave) return ui.notifications?.warn?.("No relief wave is waiting on this siege.");
    if (!wave.arrived) ui.notifications?.info?.("That relief wave hasn't arrived yet — convening early.");

    // 1. Open-field scene swap (relief scenes carry no Structure layers).
    const sceneId = wave.sceneId || state.reliefSceneId || null;
    if (sceneId) {
      const scene = game.scenes?.get?.(sceneId);
      if (scene) {
        try { await scene.view(); } catch (e) { console.warn(TAG, "scene.view failed", e); }
        try { game.socket?.emit?.(`module.${MOD_R}`, { t: "siegeSceneSwap", sceneId }); } catch (_e) {}
      } else {
        ui.notifications?.warn?.(`Relief scene ${sceneId} not found — opening console without scene swap.`);
      }
    } else {
      ui.notifications?.info?.("No relief scene bound (open-field tableau optional). Opening raid console only.");
    }

    // 2. Open the raid console with relief context.
    try {
      await game.bbttcc?.api?.raid?.openConsole?.({ factionId: state.attackerFactionId, siegeId: state.siegeId, reliefWaveId: wave.waveId });
    } catch (e) { console.warn(TAG, "openConsole failed", e); }

    // 3. Narrative beat + hook + relay.
    try {
      api.appendNarrativeBeat(state, {
        turn: _currentTurn(),
        kind: "relief_convene",
        title: `Relief Scene convened — wave from ${_nm(wave.callingFactionId)}`,
        description: "GM convened the open-field relief battle.",
        payload: { waveId: wave.waveId, callingFactionId: wave.callingFactionId, sceneId }
      });
      await api.setState(entry.hexUuid, state);
    } catch (e) { console.warn(TAG, "convene beat persist failed", e); }

    _relayHook("bbttcc:siege:reliefConvene", { siegeId: state.siegeId, hexUuid: entry.hexUuid, waveId: wave.waveId, sceneId });

    // 4. Open the resolution dialog.
    await _openReliefDialog(entry, wave);
  }

  // Direct (dialog-less) resolution — for the API + selftest.
  async function resolveRelief({ hexUuid, siegeId, waveId, outcome } = {}){
    if (!game.user?.isGM) return ui.notifications?.warn?.("Only the GM can resolve a Relief Scene.");
    const api = _siege();
    if (!api) return { ok: false, reason: "siege API unavailable" };
    const entry = _resolveSiegeEntry({ hexUuid, siegeId });
    if (!entry) return { ok: false, reason: "siege not found (pass {hexUuid} or {siegeId})" };
    const state = await api.getState(entry.hexUuid);
    const wave = _pickWave(state, waveId);
    if (!wave) return { ok: false, reason: "no unresolved relief wave on that siege" };
    if (outcome !== "attacker_won" && outcome !== "attacker_lost") {
      return { ok: false, reason: 'outcome must be "attacker_won" or "attacker_lost"' };
    }
    await _applyRelief(entry, wave, outcome, null);
    return { ok: true, outcome };
  }

  // ─── API exposure ───────────────────────────────────────────────────────

  function _install(){
    game.bbttcc = game.bbttcc || { api: {} };
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.siege = game.bbttcc.api.siege || {};
    game.bbttcc.api.siege.conveneRelief = conveneRelief;
    game.bbttcc.api.siege.resolveRelief = resolveRelief;
  }
  Hooks.once("ready", () => { _install(); console.log(TAG, "Relief Force scene ready (E.3)."); });
  if (game?.ready) _install();

  console.log(TAG, "loaded");
})();

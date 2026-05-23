// bbttcc-raid/scripts/siege-tick.js
// SIEGE_RAID_TYPE_SPEC.md Phase B — strategic tick: per-campaign-turn handler.
//
// Subscribes to `bbttcc:advanceTurn:end`. For each active siege:
//   1. Recompute supply BFS via real bfsSupplyPath (installed by siege-supply-bfs.js)
//   2. Update supplyStatus (supplied / harassed / severed)
//   3. Manage grace clock (severed → countdown; expired → drain ×3)
//   4. Compute perTurnDrain from conditions matrix (size × terrain × distance × harassment − champion deficit)
//   5. Deduct from Buffer (round-robin across committed OP categories)
//   6. Check Buffer exhaustion → lost_supply_crisis OR lost_hold outcome
//   7. Resolve relief waves arriving this turn (Phase E hands off to Convene Relief Scene)
//   8. Roll Event Deck (2d10 ≥ 14; full deck content in Phase F)
//   9. Append narrativeBeats; persist updated state
//
// Phase F adds: Champion Death Cascade, full Event Deck roster, scene-swap on layer breach.

(() => {
  const TAG = "[bbttcc/siege-tick]";
  const MOD_T = "bbttcc-territory";
  const MOD_F = "bbttcc-factions";

  globalThis.__bbttcc_siege_tick_loaded_v1 = Date.now();

  function _currentTurn(){
    try { return Number(game.bbttcc?.api?.world?.getState?.()?.turn) || 0; }
    catch { return 0; }
  }

  async function _hexDocFromUuid(uuid){
    if (!uuid) return null;
    const ref = await fromUuid(uuid);
    return ref?.document ?? ref ?? null;
  }

  function _allowedFactionIdsFor(state){
    // Attacker + raid supporters + (peacetime allies — Phase G when alliance flag is in)
    return [state.attackerFactionId, ...(state.supportingFactionIds || [])].filter(Boolean);
  }

  /**
   * Compute the per-turn drain from the conditions matrix.
   * Returns { totalDrain, breakdown: { base, terrain, distance, harassment, navalDiscount, championDeficit, graceMult } }
   */
  function _computeDrain({ state, targetHexDoc, S }){
    const profile = S.SIZE_PROFILES[state.sizeProfile] || S.SIZE_PROFILES.standard;
    const base = profile.baseDrain;

    const terrainKey = S.hexTerrainKey ? S.hexTerrainKey(targetHexDoc) : "plains";
    const tMod = S.terrainModifier(terrainKey);

    const distanceCost = 0.5 * Math.max(0, (state.supplyPathHexIds?.length || 1) - 1);
    const harassmentCost = 2 * (state.interdictionsThisTurn || 0);

    let championDeficit = 0;
    const activeChampions = (state.attackerChampions || []).filter(c => c.status === "active").length;
    if (activeChampions === 0 && (state.attackerChampions || []).length > 0) {
      championDeficit = 0.30;  // +30%
    }

    const navalDiscount = state.isNavalSupply ? 0.7 : 1.0;

    // Grace clock: if severed AND past grace, ×3 drain
    let graceMult = 1.0;
    if (state.supplyStatus === "severed") {
      const sinceSevered = (state.supplySeveredAtTurn != null)
        ? Math.max(0, _currentTurn() - state.supplySeveredAtTurn)
        : 0;
      if (sinceSevered > (state.gracePeriodTurns ?? 2)) graceMult = 3.0;
    }

    // Total drain = (base × terrain.drain × (1 + championDeficit) × navalDiscount) + distance + harassment, then × graceMult
    const coreMult = base * tMod.drain * (1 + championDeficit) * navalDiscount;
    const totalDrain = (coreMult + distanceCost + harassmentCost) * graceMult;

    return {
      totalDrain: Math.max(1, Math.round(totalDrain * 10) / 10),
      breakdown: {
        base,
        terrain: tMod.drain,
        distance: distanceCost,
        harassment: harassmentCost,
        navalDiscount,
        championDeficit,
        graceMult,
        graceTurns: state.gracePeriodTurns
      }
    };
  }

  /**
   * Deduct `total` OP from the buffer, round-robin across committed categories.
   * Returns { remaining, deducted: {violence, logistics, ...} }
   */
  function _drainBuffer(buffer, total){
    const deducted = { violence: 0, logistics: 0, economy: 0, softPower: 0, diplomacy: 0, faith: 0, intrigue: 0 };
    let remaining = total;
    const categories = Object.keys(buffer).filter(k => buffer[k] > 0);
    if (!categories.length) return { remaining: total, deducted };

    // Simple round-robin: take 1 from each non-empty category until exhausted or remaining = 0.
    while (remaining > 0) {
      let drewAny = false;
      for (const cat of categories) {
        if (buffer[cat] <= 0) continue;
        const take = Math.min(remaining, 1);
        buffer[cat] -= take;
        deducted[cat] += take;
        remaining -= take;
        drewAny = true;
        if (remaining <= 0) break;
      }
      if (!drewAny) break;
    }

    return { remaining, deducted };
  }

  function _bufferTotal(buffer){
    return Object.values(buffer || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  }

  /**
   * Roll 2d10 against deck threshold (default 14 = ~28% per turn).
   * Returns { fired: bool, roll, threshold }
   */
  function _rollEventDeck(deckId = "generic"){
    // Phase F authors the full deck content (decks JSON + per-event effects).
    // Phase B: roll the gate and record narrative placeholder only.
    const d1 = Math.floor(Math.random() * 10) + 1;
    const d2 = Math.floor(Math.random() * 10) + 1;
    const roll = d1 + d2;
    const threshold = 14;
    return { fired: roll >= threshold, roll, threshold, dice: [d1, d2], deckId };
  }

  /**
   * The main per-siege tick.
   */
  async function _tickSiege(siegeEntry, ctx){
    const S = globalThis.__bbttccSiegeState;
    if (!S) { console.warn(TAG, "siege-state not loaded; skipping tick"); return; }

    const { hexUuid } = siegeEntry;
    const state = foundry.utils.duplicate(siegeEntry.siege);
    if (state.status !== "active") return;

    const targetHexDoc = await _hexDocFromUuid(hexUuid);
    if (!targetHexDoc) {
      console.warn(TAG, `target hex doc missing for siege ${state.siegeId}`);
      return;
    }

    const turn = _currentTurn();

    // ---- 0. Phase C: net escort pips against interdiction pulses ----
    // Each escort pip cancels one interdiction harassment pulse this tick.
    // (Persistent severance is handled separately via stripped Supply Line modifiers / interdictedHexIds.)
    const rawInterdictions = state.interdictionsThisTurn || 0;
    const escortPips = state.escortPipsThisTurn || 0;
    const cancelled = Math.min(rawInterdictions, escortPips);
    if (cancelled > 0) {
      S.appendNarrativeBeat(state, {
        turn,
        kind: "escort_cancel",
        title: `${cancelled} interdiction(s) repelled by escort`,
        description: `Escort screens turned back ${cancelled} of ${rawInterdictions} interdiction pulse(s) this turn.`
      });
    }
    // Drive harassment drain + harassed status off the NET value for this tick.
    state.interdictionsThisTurn = Math.max(0, rawInterdictions - escortPips);

    // ---- 1+2. Recompute supply ----
    const allowedFactionIds = _allowedFactionIdsFor(state);
    const bfs = await S.bfsSupplyPath({
      siegeTargetHexUuid: hexUuid,
      depotHexUuid: state.supplyOriginHexId,
      allowedFactionIds,
      navalAllowed: !!state.isNavalSupply
    });

    let supplyStatus = "supplied";
    if (!bfs.ok) {
      supplyStatus = "severed";
    } else if ((state.interdictionsThisTurn || 0) > 0) {
      supplyStatus = "harassed";
    } else {
      supplyStatus = "supplied";
    }

    if (state.supplyStatus !== supplyStatus) {
      S.appendNarrativeBeat(state, {
        turn,
        kind: "supply_status",
        title: `Supply ${state.supplyStatus} → ${supplyStatus}`,
        description: bfs.reason || ""
      });
    }
    state.supplyStatus = supplyStatus;
    state.supplyPathHexIds = bfs.ok ? bfs.path : [];

    // ---- 3. Grace clock ----
    if (supplyStatus === "severed" && state.supplySeveredAtTurn == null) {
      state.supplySeveredAtTurn = turn;
      S.appendNarrativeBeat(state, {
        turn,
        kind: "supply_severed",
        title: "Supply line severed",
        description: `Grace period: ${state.gracePeriodTurns ?? 2} turn(s) before attrition spikes.`
      });
    } else if (supplyStatus !== "severed") {
      state.supplySeveredAtTurn = null;
    }

    // ---- 4. Compute drain ----
    const drainCalc = _computeDrain({ state, targetHexDoc, S });
    state.perTurnDrain = { total: drainCalc.totalDrain };
    state.conditionsBreakdown = drainCalc.breakdown;

    // ---- 5. Deduct from buffer ----
    const drainResult = _drainBuffer(state.buffer, drainCalc.totalDrain);
    const totalRemaining = _bufferTotal(state.buffer);

    S.appendNarrativeBeat(state, {
      turn,
      kind: "tick_drain",
      title: `Tick ${turn}: −${drainCalc.totalDrain} OP from Buffer`,
      description: `Drain breakdown: base ${drainCalc.breakdown.base} × terrain ${drainCalc.breakdown.terrain} × championDeficit ${drainCalc.breakdown.championDeficit} × naval ${drainCalc.breakdown.navalDiscount} + distance ${drainCalc.breakdown.distance} + harassment ${drainCalc.breakdown.harassment}, ×grace ${drainCalc.breakdown.graceMult}. Buffer now ${totalRemaining} OP total.`,
      payload: { drain: drainCalc.totalDrain, deducted: drainResult.deducted, remaining: totalRemaining }
    });

    // ---- 6. Buffer exhaustion → end-of-siege ----
    if (totalRemaining <= 0) {
      const sinceSevered = (state.supplySeveredAtTurn != null) ? (turn - state.supplySeveredAtTurn) : 0;
      const gracedOut = supplyStatus === "severed" && sinceSevered > (state.gracePeriodTurns ?? 2);
      state.status = gracedOut ? "lost_supply_crisis" : "lost_hold";
      state.endedTurn = turn;
      S.appendNarrativeBeat(state, {
        turn,
        kind: gracedOut ? "siege_supply_crisis" : "siege_hold",
        title: gracedOut ? "Supply Crisis — attacker withdraws in disarray" : "Buffer exhausted — attacker breaks the siege",
        description: gracedOut
          ? "Grace period expired with no supply recovery. Attacker forced to retreat with catastrophic casualties."
          : "Attacker's commitment depleted. Orderly withdrawal."
      });
      // Phase F handles the full outcome write-back (hex ownership, faction morale, war log saga entry).
      // For Phase B we just mark status; the bookkeeping fires on next handler.
    }

    // ---- 7. Resolve relief waves arriving this turn ----
    let triggeredRelief = false;
    for (const wave of (state.reliefWaves || [])) {
      if (wave.resolved) continue;
      if (wave.arrivesTurn === turn) {
        // Phase E: GM convene relief scene. Phase B: just narrative beat + Hook.
        S.appendNarrativeBeat(state, {
          turn,
          kind: "relief_arrival",
          title: `Relief wave arrives from ${wave.callingFactionId || "ally"}`,
          description: "GM should Convene Relief Scene (Phase E will surface the prompt)."
        });
        Hooks.callAll("bbttcc:siege:reliefArrives", { siegeId: state.siegeId, hexUuid, wave });
        triggeredRelief = true;
      }
    }

    // ---- 8. Event Deck roll ----
    const deckId = state.eventDeckId || "generic";
    const ev = _rollEventDeck(deckId);
    state.eventsFired = Array.isArray(state.eventsFired) ? state.eventsFired : [];
    if (ev.fired) {
      const placeholderName = "An unnamed event"; // Phase F replaces with real draw
      state.eventsFired.push({
        turn,
        eventId: `placeholder-${turn}`,
        payload: { roll: ev.roll, dice: ev.dice, deckId: ev.deckId }
      });
      S.appendNarrativeBeat(state, {
        turn,
        kind: "event_deck",
        title: `Event Deck fires (2d10=${ev.roll}, threshold ${ev.threshold})`,
        description: `Deck "${ev.deckId}": ${placeholderName} (mechanical content authored in Phase F).`,
        payload: ev
      });
    }

    // ---- Phase C: reset per-turn pulse counters for the next turn ----
    // Interdiction/escort pulses are spent this tick; persistent severance lives in
    // interdictedHexIds + the stripped Supply Line modifiers (which the BFS re-reads).
    state.interdictionsThisTurn = 0;
    state.escortPipsThisTurn = 0;

    // ---- 9. Persist + broadcast ----
    await S.setSiegeState(hexUuid, state);
    Hooks.callAll("bbttcc:siege:ticked", { siegeId: state.siegeId, hexUuid, state, drain: drainCalc });

    // D.3: if this tick ended the siege (Buffer exhaustion → lost_hold / lost_supply_crisis),
    // fire the outcome hook + relay so siege-vfx.js plays the banner on every client.
    // Full §8 outcome write-back (ownership / morale / war-log saga) still lands in Phase F.
    if (state.status !== "active") {
      const outPayload = { siegeId: state.siegeId, hexUuid, status: state.status };
      Hooks.callAll("bbttcc:siege:outcome", outPayload);
      try { game.socket?.emit?.(`module.bbttcc-raid`, { t: "siegeHook", hook: "bbttcc:siege:outcome", payload: outPayload }); } catch (_e) {}
    }

    // Phase F: broadcast socket message for player-side HUD update.
    // For now, GM-only state mutation; clients re-fetch on their next render.

    // ---- Re-queue: state.status==="active" persistence is the implicit re-queue.
    // The tick loop is driven by `bbttcc:advanceTurn:end`, so no explicit
    // re-queue write to faction warLogs is needed in Phase B. (Phase A's
    // begin_siege handler wrote a placeholder; we no longer rely on it.)
  }

  // ============================================================
  // Hook subscription
  // ============================================================

  async function _onAdvanceTurnEnd(ctx){
    const S = globalThis.__bbttccSiegeState;
    if (!S?.list) return;

    const active = S.listActiveSieges();
    if (!active.length) return;

    // Only GM should run the tick (state mutations on shared hex docs)
    if (!game.user?.isGM) return;

    console.log(TAG, `ticking ${active.length} active siege(s) for turn ${_currentTurn()}`);

    for (const entry of active) {
      try {
        await _tickSiege(entry, ctx);
      } catch (err) {
        console.error(TAG, `tick failed for siege ${entry.siege?.siegeId}`, err);
      }
    }
  }

  function _install(){
    // Idempotent re-registration
    if (globalThis.__bbttcc_siege_tick_hook_installed) return;
    Hooks.on("bbttcc:advanceTurn:end", _onAdvanceTurnEnd);
    globalThis.__bbttcc_siege_tick_hook_installed = true;
    console.log(TAG, "subscribed to bbttcc:advanceTurn:end");

    // Also expose for manual testing: game.bbttcc.api.siege.tickAll()
    game.bbttcc = game.bbttcc || { api: {} };
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.siege = game.bbttcc.api.siege || {};
    game.bbttcc.api.siege.tickAll = () => _onAdvanceTurnEnd({});
    game.bbttcc.api.siege.tickOne = async (hexUuid) => {
      const S = globalThis.__bbttccSiegeState;
      if (!S?.list) return { ok: false, reason: "siege-state not loaded" };
      const all = S.listActiveSieges();
      const hit = all.find(s => s.hexUuid === hexUuid);
      if (!hit) return { ok: false, reason: `no active siege at ${hexUuid}` };
      await _tickSiege(hit);
      return { ok: true };
    };
    game.bbttcc.api.siege.computeDrain = async (hexUuid) => {
      const S = globalThis.__bbttccSiegeState;
      if (!S?.list) return null;
      const hit = S.listActiveSieges().find(s => s.hexUuid === hexUuid);
      if (!hit) return null;
      const doc = await _hexDocFromUuid(hexUuid);
      return _computeDrain({ state: hit.siege, targetHexDoc: doc, S });
    };
  }

  Hooks.once("init", _install);
  Hooks.once("ready", _install);
  if (game?.ready) _install();

  console.log(TAG, "loaded");
})();

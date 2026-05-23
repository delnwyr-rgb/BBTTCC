// bbttcc-raid/scripts/siege-counter-activities.js
// SIEGE_RAID_TYPE_SPEC.md §7 — Phase E.1: defender + attacker counter-activities.
//
// 9 strategic activities, dual-registered (STRATEGIC_THROUGHPUT + EFFECTS) like the
// Phase C threat vectors. All target the BESIEGED hex (where the siege state lives).
//
//   Defender:  reinforce_garrison [T1] · call_relief [T2] · sue_for_terms [T2]
//              champion_defends_wall [T1] · pray_for_omen [T1]
//   Attacker:  demand_surrender [T2] · champion_withdraws [T2] · champion_returns [T1]
//              storm_final_assault [T3]
//
// Champion-targeting activities take an optional note JSON {championId}; absent that they
// resolve the first eligible champion (deterministic + narrated). Sue for Terms / Demand
// Surrender RECORD an offer (state.pendingTerms) + fire a hook; the loop is completed by
// game.bbttcc.api.siege.resolveTerms / resolveSurrender (which set won_sack / won_surrender
// → fires bbttcc:siege:outcome → D.3 VFX). Full attacker-prompt UI is a Phase E refinement.

(() => {
  globalThis.__bbttcc_siege_counter_activities_loaded_v1 = Date.now();

  const MOD_R = "bbttcc-raid";
  const MOD_F = "bbttcc-factions";
  const TAG = "[bbttcc/siege-counter]";

  function whenRaidReady(cb, tries = 0){
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS && api?.STRATEGIC_THROUGHPUT) return cb(api);
      if (tries > 80) return console.warn(TAG, "raid API not ready");
      setTimeout(() => whenRaidReady(cb, tries + 1), 250);
    };
    if (globalThis.Hooks) Hooks.once("ready", go); else go();
  }
  function whenSiegeStateReady(cb, tries = 0){
    if (globalThis.__bbttccSiegeState) return cb(globalThis.__bbttccSiegeState);
    if (tries > 80) return console.warn(TAG, "siege-state internals not exposed");
    setTimeout(() => whenSiegeStateReady(cb, tries + 1), 250);
  }

  const _nm = (id) => game.actors?.get?.(id)?.name || id || "a champion";
  const _turn = () => { try { return Number(game.bbttcc?.api?.world?.getState?.()?.turn) || 0; } catch { return 0; } };

  function _parseNote(note){
    const s = String(note || "").trim();
    if (!s.startsWith("{")) return {};
    try { return JSON.parse(s); } catch { return {}; }
  }

  async function _pushWarLog(actor, summary, extra = {}){
    if (!actor) return;
    const wl = Array.isArray(actor.getFlag(MOD_F, "warLogs")) ? actor.getFlag(MOD_F, "warLogs").slice() : [];
    wl.push({ ts: Date.now(), date: (new Date()).toLocaleString(), type: "siege", activity: extra.activityKey || "siege_counter", summary, ...extra });
    await actor.update({ [`flags.${MOD_F}.warLogs`]: wl });
  }

  function _relayHook(hook, payload){
    Hooks.callAll(hook, payload);
    try { game.socket?.emit?.(`module.${MOD_R}`, { t: "siegeHook", hook, payload }); } catch (_e) {}
  }

  // Read-mutate-persist a siege by its besieged hex. mutator(state, ctx) may be async.
  async function _withSiege(S, hexUuid, mutator){
    const cur = await S.getSiegeState(hexUuid);
    if (!cur) return { ok: false, reason: "no siege on that hex" };
    if (cur.status !== "active") return { ok: false, reason: `siege is ${cur.status}, not active` };
    const state = foundry.utils.duplicate(cur);
    const out = await mutator(state) || {};
    await S.setSiegeState(hexUuid, state);
    return Object.assign({ ok: true, state }, out);
  }

  function _pickChampion(arr, { championId, wantStatus } = {}){
    const list = Array.isArray(arr) ? arr : [];
    if (championId) return list.find(c => c.actorId === championId) || null;
    if (wantStatus) return list.find(c => c.status === wantStatus) || null;
    return list[0] || null;
  }

  // ============================================================
  // Handlers — each returns { ok, summary }
  // ============================================================

  async function reinforce_garrison({ factionId, targetUuid, S }){
    const actor = game.actors.get(factionId);
    const r = await _withSiege(S, targetUuid, (state) => {
      state.defenderAnytimeBudget = (state.defenderAnytimeBudget || 0) + 1;
      state.renewalPool = (state.renewalPool || 0) + 1;
      S.appendNarrativeBeat(state, { turn: _turn(), kind: "reinforce_garrison", title: "Garrison reinforced", description: "+1 defender Anytime budget per round and +1 Renewal pool." });
    });
    if (!r.ok) return r;
    await _pushWarLog(actor, `Reinforce Garrison: +1 Anytime, +1 Renewal.`, { activityKey: "reinforce_garrison", hexUuid: targetUuid });
    return { ok: true, summary: "Garrison reinforced (+1 Anytime, +1 Renewal)." };
  }

  async function call_relief({ factionId, targetUuid, S }){
    const actor = game.actors.get(factionId);
    const turn = _turn();
    const r = await _withSiege(S, targetUuid, (state) => {
      state.reliefWaves = Array.isArray(state.reliefWaves) ? state.reliefWaves : [];
      const wave = { waveId: `wave-${Date.now().toString(36)}`, callingFactionId: factionId, arrivesTurn: turn + 2, resolved: false };
      state.reliefWaves.push(wave);
      S.appendNarrativeBeat(state, { turn, kind: "relief_called", title: "Relief summoned", description: `${actor?.name || "An ally"} calls a relief force — arrives turn ${wave.arrivesTurn}.`, payload: wave });
    });
    if (!r.ok) return r;
    _relayHook("bbttcc:siege:reliefCalled", { hexUuid: targetUuid, siegeId: r.state.siegeId, byFactionId: factionId });
    await _pushWarLog(actor, `Call Relief: wave arrives turn ${turn + 2}.`, { activityKey: "call_relief", hexUuid: targetUuid });
    return { ok: true, summary: `Relief wave called (arrives turn ${turn + 2}).` };
  }

  async function sue_for_terms({ factionId, targetUuid, S }){
    const actor = game.actors.get(factionId);
    const turn = _turn();
    const r = await _withSiege(S, targetUuid, (state) => {
      state.pendingTerms = { type: "sue", turn, byFactionId: factionId, resolved: false };
      S.appendNarrativeBeat(state, { turn, kind: "terms_offered", title: "Defender sues for terms", description: "A negotiated surrender is offered — the attacker accepts (won_sack) or refuses. Resolve via siege.resolveTerms." });
    });
    if (!r.ok) return r;
    _relayHook("bbttcc:siege:termsOffered", { hexUuid: targetUuid, siegeId: r.state.siegeId, type: "sue" });
    await _pushWarLog(actor, `Sue for Terms: offer recorded; awaiting attacker decision.`, { activityKey: "sue_for_terms", hexUuid: targetUuid });
    return { ok: true, summary: "Terms offered — attacker decides (siege.resolveTerms)." };
  }

  async function pray_for_omen({ factionId, targetUuid, S }){
    const actor = game.actors.get(factionId);
    const r = await _withSiege(S, targetUuid, (state) => {
      state.omenReroll = true;
      S.appendNarrativeBeat(state, { turn: _turn(), kind: "omen", title: "Prayers for an omen", description: "The next Event Deck draw re-rolls in the defender's favor (consumed in Phase F)." });
    });
    if (!r.ok) return r;
    await _pushWarLog(actor, `Pray for Omen: next Event Deck draw favors the defender.`, { activityKey: "pray_for_omen", hexUuid: targetUuid });
    return { ok: true, summary: "Omen sought — next Event Deck draw re-rolls favorably." };
  }

  async function champion_defends_wall({ factionId, targetUuid, note, S }){
    const actor = game.actors.get(factionId);
    const cfg = _parseNote(note);
    const turn = _turn();
    let chosen = null;
    const r = await _withSiege(S, targetUuid, (state) => {
      const champ = _pickChampion(state.defenderChampions, { championId: cfg.championId })
                 || _pickChampion(state.defenderChampions, { wantStatus: "wounded" })
                 || (state.defenderChampions || [])[0];
      if (!champ) return { _noChamp: true };
      chosen = champ.actorId;
      champ.status = "active";
      champ.reason = "champion_defends_wall";
      state.championLocks = state.championLocks || {};
      state.championLocks[champ.actorId] = turn + 2;
      state.defenderAnytimeBudget = (state.defenderAnytimeBudget || 0) + 1;
      S.appendNarrativeBeat(state, { turn, kind: "champion_defends_wall", title: `${_nm(champ.actorId)} holds the wall`, description: `Locked active for 2 turns (until turn ${turn + 2}); +1 defender Anytime budget.`, actorIds: [champ.actorId] });
    });
    if (!r.ok) return r;
    if (!chosen) return { ok: false, reason: "no defender champion to defend the wall (roster empty)" };
    _relayHook("bbttcc:siege:championStatus", { siegeId: r.state.siegeId, championId: chosen, status: "active", source: "champion_defends_wall", side: "defender" });
    await _pushWarLog(actor, `Champion Defends Wall: ${_nm(chosen)} locked active 2 turns (+1 Anytime).`, { activityKey: "champion_defends_wall", hexUuid: targetUuid });
    return { ok: true, summary: `${_nm(chosen)} holds the wall (locked 2 turns).` };
  }

  async function demand_surrender({ factionId, targetUuid, S }){
    const actor = game.actors.get(factionId);
    const turn = _turn();
    const r = await _withSiege(S, targetUuid, (state) => {
      state.pendingTerms = { type: "surrender", turn, byFactionId: factionId, resolved: false };
      S.appendNarrativeBeat(state, { turn, kind: "surrender_demanded", title: "Surrender demanded", description: "The defender must respond: yield (won_surrender) · parley (Buffer +10) · refuse (−1 morale). Resolve via siege.resolveSurrender." });
    });
    if (!r.ok) return r;
    _relayHook("bbttcc:siege:surrenderDemanded", { hexUuid: targetUuid, siegeId: r.state.siegeId });
    await _pushWarLog(actor, `Demand Surrender: ultimatum issued; awaiting defender response.`, { activityKey: "demand_surrender", hexUuid: targetUuid });
    return { ok: true, summary: "Surrender demanded — defender responds (siege.resolveSurrender)." };
  }

  async function storm_final_assault({ factionId, targetUuid, S }){
    const actor = game.actors.get(factionId);
    const turn = _turn();
    let shaved = 0;
    const r = await _withSiege(S, targetUuid, (state) => {
      state.stormAssault = { budgetMult: 2, turn };
      const sh = S.shaveBuffer(state.buffer, 30);
      shaved = sh.shaved;
      state._suggestConvene = true;
      S.appendNarrativeBeat(state, { turn, kind: "storm_assault", title: "Final assault ordered", description: `Next Breach Scene's maneuver budget is doubled. Buffer −${shaved} OP regardless of outcome.` });
    });
    if (!r.ok) return r;
    await _pushWarLog(actor, `Storm Final Assault: next Breach Scene budget ×2; Buffer −${shaved}.`, { activityKey: "storm_final_assault", hexUuid: targetUuid });
    return { ok: true, summary: `Final assault ordered (budget ×2; Buffer −${shaved}).` };
  }

  // Champion Withdraws / Returns — attacker-side status levers (use the shipped API).
  async function _championStatusActivity({ factionId, targetUuid, note, S }, { newStatus, wantStatus, activityKey, label }){
    const actor = game.actors.get(factionId);
    const cfg = _parseNote(note);
    const cur = await S.getSiegeState(targetUuid);
    if (!cur) return { ok: false, reason: "no siege on that hex" };
    if (cur.status !== "active") return { ok: false, reason: `siege is ${cur.status}` };
    const champ = _pickChampion(cur.attackerChampions, { championId: cfg.championId })
               || _pickChampion(cur.attackerChampions, { wantStatus });
    if (!champ) return { ok: false, reason: `no ${wantStatus} attacker champion to ${label.toLowerCase()}` };
    const ok = await game.bbttcc.api.siege.applyChampionStatusChange({ siegeId: cur.siegeId, championId: champ.actorId, newStatus, source: activityKey, side: "attacker" });
    if (!ok) return { ok: false, reason: "champion status change failed" };
    await _pushWarLog(actor, `${label}: ${_nm(champ.actorId)} → ${newStatus}.`, { activityKey, hexUuid: targetUuid });
    return { ok: true, summary: `${label}: ${_nm(champ.actorId)} is now ${newStatus}.` };
  }
  const champion_withdraws = (ctx) => _championStatusActivity(ctx, { newStatus: "absent", wantStatus: "active", activityKey: "champion_withdraws", label: "Champion Withdraws" });
  const champion_returns   = (ctx) => _championStatusActivity(ctx, { newStatus: "active", wantStatus: "absent", activityKey: "champion_returns",   label: "Champion Returns" });

  // ============================================================
  // Terms / surrender resolvers (complete the sue/demand loops)
  // ============================================================

  async function resolveTerms(hexUuid, { accept = false } = {}){
    const S = globalThis.__bbttccSiegeState;
    const r = await _withSiege(S, hexUuid, (state) => {
      const pt = state.pendingTerms;
      if (!pt || pt.type !== "sue" || pt.resolved) return { _bad: true };
      pt.resolved = true;
      const turn = _turn();
      if (accept) {
        state.status = "won_sack";
        state.endedTurn = turn;
        state.pendingTerms = null;
        S.appendNarrativeBeat(state, { turn, kind: "siege_sack", title: "Terms accepted — the place is sacked", description: "The attacker accepts the negotiated surrender (won_sack). Full write-back in Phase F." });
      } else {
        state.pendingTerms = null;
        S.appendNarrativeBeat(state, { turn, kind: "terms_refused", title: "Terms refused — the siege grinds on", description: "The attacker rejects the offer." });
      }
    });
    if (!r.ok) return r;
    if (r.state.status === "won_sack") _relayHook("bbttcc:siege:outcome", { siegeId: r.state.siegeId, hexUuid, status: "won_sack" });
    game.bbttcc?.api?.siege?.refreshHud?.();
    return { ok: true, accepted: accept };
  }

  async function resolveSurrender(hexUuid, { response = "refuse" } = {}){
    const S = globalThis.__bbttccSiegeState;
    const r = await _withSiege(S, hexUuid, (state) => {
      const pt = state.pendingTerms;
      if (!pt || pt.type !== "surrender" || pt.resolved) return { _bad: true };
      pt.resolved = true;
      const turn = _turn();
      if (response === "yield") {
        state.status = "won_surrender";
        state.endedTurn = turn;
        state.pendingTerms = null;
        S.appendNarrativeBeat(state, { turn, kind: "siege_surrender", title: "The garrison yields", description: "Defender accepts the demand (won_surrender). Holdings preserved; full write-back Phase F." });
      } else if (response === "parley") {
        state.pendingTerms = null;
        state.buffer = state.buffer || {};
        state.buffer.logistics = (state.buffer.logistics || 0) + 10; // attacker re-commits supply
        S.appendNarrativeBeat(state, { turn, kind: "parley", title: "Parley — negotiations stall", description: "No surrender; the besieger renews its commitment (+10 Buffer)." });
      } else {
        state.pendingTerms = null;
        S.appendNarrativeBeat(state, { turn, kind: "surrender_refused", title: "Defiance — surrender refused", description: "The defender refuses (−1 morale; applied in Phase F)." });
      }
    });
    if (!r.ok) return r;
    if (r.state.status === "won_surrender") _relayHook("bbttcc:siege:outcome", { siegeId: r.state.siegeId, hexUuid, status: "won_surrender" });
    game.bbttcc?.api?.siege?.refreshHud?.();
    return { ok: true, response };
  }

  // ============================================================
  // Registration
  // ============================================================

  const HANDLERS = {
    reinforce_garrison:    { fn: reinforce_garrison,    label: "Reinforce Garrison",  cost: { violence: 15, logistics: 10 },              band: "standard" },
    call_relief:           { fn: call_relief,           label: "Call Relief",          cost: { diplomacy: 20, softPower: 20 },             band: "rare" },
    sue_for_terms:         { fn: sue_for_terms,         label: "Sue for Terms",        cost: { diplomacy: 20, softPower: 15 },             band: "rare" },
    champion_defends_wall: { fn: champion_defends_wall, label: "Champion Defends Wall",cost: { violence: 10 },                             band: "standard" },
    pray_for_omen:         { fn: pray_for_omen,         label: "Pray for Omen",        cost: { faith: 10 },                                band: "standard" },
    demand_surrender:      { fn: demand_surrender,      label: "Demand Surrender",     cost: { diplomacy: 20, violence: 10, softPower: 10 }, band: "rare" },
    champion_withdraws:    { fn: champion_withdraws,    label: "Champion Withdraws",   cost: { softPower: 15, diplomacy: 10 },             band: "rare" },
    champion_returns:      { fn: champion_returns,      label: "Champion Returns",     cost: { diplomacy: 20, softPower: 10 },             band: "standard" },
    storm_final_assault:   { fn: storm_final_assault,   label: "Storm Final Assault",  cost: { violence: 40, logistics: 20 },              band: "rare" }
  };

  whenRaidReady((api) => whenSiegeStateReady((S) => {
    const ST = api.STRATEGIC_THROUGHPUT;
    const EFFECTS = api.EFFECTS = api.EFFECTS || {};
    for (const [key, def] of Object.entries(HANDLERS)) {
      const shared = async ({ factionId, targetUuid, note }) => {
        try { return await def.fn({ factionId, targetUuid, note, S }); }
        catch (err) {
          console.error(TAG, `${key} failed`, err);
          await _pushWarLog(game.actors.get(factionId), `${def.label} ERROR: ${err.message}`, { activityKey: key });
          return { ok: false, reason: err.message };
        }
      };
      ST[key] = async (ctx) => shared({ factionId: ctx.factionId || ctx.attackerId, targetUuid: ctx.targetUuid, note: ctx.notes || ctx.note || "" });
      EFFECTS[key] = Object.assign({}, EFFECTS[key], {
        kind: "strategic", band: def.band, label: def.label, cost: def.cost, siegeCounterActivity: true,
        async apply({ entry }){
          const r = await shared({ factionId: entry?.attackerId || entry?.factionId, targetUuid: entry?.targetUuid, note: entry?.note || "" });
          return r.ok ? `${def.label}: ${r.summary || "done"}.` : `${def.label} failed: ${r.reason}`;
        }
      });
    }

    // Expose the terms/surrender resolvers.
    game.bbttcc.api.siege.resolveTerms = resolveTerms;
    game.bbttcc.api.siege.resolveSurrender = resolveSurrender;

    console.log(TAG, `registered ${Object.keys(HANDLERS).length} counter-activities (STRATEGIC_THROUGHPUT + EFFECTS) + resolveTerms/resolveSurrender.`);
  }));

  console.log(TAG, "loaded (awaiting raid API)");
})();

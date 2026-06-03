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
    let wallId = null;
    const r = await _withSiege(S, targetUuid, (state) => {
      state.stormAssault = { budgetMult: 2, turn };
      const sh = S.shaveBuffer(state.buffer, 30);
      shaved = sh.shaved;
      state._suggestConvene = true;
      wallId = (state.layers || [])[state.currentLayerIdx ?? 0]?.structureActorId || null;
      S.appendNarrativeBeat(state, { turn, kind: "storm_assault", title: "Final assault ordered", description: `Next Breach Scene's maneuver budget is doubled. Buffer −${shaved} OP regardless of outcome.` });
    });
    if (!r.ok) return r;

    // §6 VFX — the all-out throw: a heavy 6-boulder barrage on the wall (reuses the proven
    // projectile primitive via the generic bbttcc:siege:projectile beat).
    _relayHook("bbttcc:siege:projectile", {
      structureActorId: wallId, family: "boulder", count: 6, scale: 2.0, stagger: 170,
      banner: "⚔ Storm the Walls", color: "#ff5555"
    });

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
  // In-the-moment ("clash tempo") invoker
  // ============================================================
  // Siege activities default to the STRATEGIC clock — planned, then resolved on Advance Turn.
  // That's right for off-camera attrition (interdiction, relief, terms). But a convened clash
  // is a TACTICAL clock — one pitched battle, fired in the moment. Maneuvers tagged
  // `tempo:"clash"` get a second entry point: fireManeuver runs the SAME handler NOW.
  //
  // Cost model A (owner's call 2026-06-01): pay the maneuver's OP cost out of the siege Buffer
  // immediately (the Buffer IS the besieger's committed OP pool; mirrors storm_final_assault's
  // own shaveBuffer). Attacker-side only for v1 — the Buffer is the attacker's; defender clash
  // actions would need a defender-OP path. Bombard is the clean case (no internal self-charge);
  // storm_final_assault stays strategic because it ALSO shaves the Buffer inside its handler
  // (firing it here would double-bill) and its effect (next breach-scene budget ×2) is strategic.
  async function fireManeuver(key, { hexUuid, note } = {}) {
    if (!game.user?.isGM) return { ok: false, reason: "GM only" };
    const def = HANDLERS[key];
    if (!def) return { ok: false, reason: `unknown maneuver "${key}"` };
    if (def.tempo !== "clash") return { ok: false, reason: `"${def.label}" is a strategic activity — plan it and Advance Turn` };

    const S = globalThis.__bbttccSiegeState;
    if (!S) return { ok: false, reason: "siege-state internals unavailable" };

    // Resolve the besieged hex (works on the hexless tableau via the bound scene → sole siege).
    let uuid = hexUuid || null;
    if (!uuid) { try { uuid = game.bbttcc?.api?.siege?.resolveActiveHexUuid?.() || null; } catch (_e) {} }
    if (!uuid) { const list = S.listActiveSieges?.() || []; if (list.length === 1) uuid = list[0].hexUuid; }
    if (!uuid) return { ok: false, reason: "no active siege resolved (pass { hexUuid })" };

    const st = await S.getSiegeState(uuid);
    if (!st || st.status !== "active") return { ok: false, reason: "no active siege on that hex" };
    const factionId = st.attackerFactionId;

    // Cost model A — deduct the maneuver's OP cost from the Buffer right now. Clash tempo costs
    // a FRACTION of the strategic queued form (def.clashCost): one volley ≠ a week's commitment.
    const costTotal = Number.isFinite(def.clashCost)
      ? def.clashCost
      : Object.values(def.cost || {}).reduce((a, b) => a + (Number(b) || 0), 0);
    if (costTotal > 0) {
      const have = S.bufferTotal(st.buffer);
      if (have < costTotal) return { ok: false, reason: `not enough Buffer to fire ${def.label} now (need ${costTotal/10} OP, have ${have/10})` };
      const dup = foundry.utils.duplicate(st);
      S.shaveBuffer(dup.buffer, costTotal);
      S.appendNarrativeBeat(dup, { turn: _turn(), kind: "clash_maneuver", title: `${def.label} — in the moment`, description: `Fired during the clash (tactical tempo). Buffer −${costTotal/10} OP.` });
      await S.setSiegeState(uuid, dup);
    }

    // Run the SAME handler that the strategic clock uses — it does the real work + its own beat/VFX.
    let r;
    try { r = await def.fn({ factionId, targetUuid: uuid, note: note || "", S }); }
    catch (err) { console.error(TAG, `fireManeuver ${key} failed`, err); return { ok: false, reason: err.message }; }

    try { game.bbttcc?.api?.siege?.refreshHud?.(); } catch (_e) {}
    if (r?.ok !== false) ui.notifications?.info?.(`${def.label} (in the moment)${costTotal ? ` — Buffer −${costTotal/10} OP` : ""}: ${r?.summary || "done"}.`);
    else ui.notifications?.warn?.(`${def.label}: ${r?.reason || "failed"}.`);
    return Object.assign({ ok: r?.ok !== false, key, cost: costTotal }, r || {});
  }

  // ── Bombard (attacker) — STRATEGIC wall damage ──
  // Fills the seam between the strategic layer (planner/turns) and the tactical
  // breach: each Bombard chips the CURRENT layer's Structure Plates. Damage routes
  // through the fourththing wedge → applyStructureDamage → bbttcc:structure:stateChanged,
  // so siege-layer-transition advances/breaches the layer automatically when it razes.
  async function bombard({ factionId, targetUuid, S }){
    const actor = game.actors.get(factionId);
    const st = await S.getSiegeState(targetUuid);
    if (!st || st.status !== "active") return { ok: false, reason: "no active siege on this hex" };
    const idx = st.currentLayerIdx ?? 0;
    const layer = (st.layers || [])[idx] || null;
    const wall = layer ? game.actors.get(layer.structureActorId) : null;
    if (!wall) return { ok: false, reason: "current layer has no Structure actor to bombard" };

    let dmg = 25;
    try { const roll = new Roll("2d10+15"); await roll.evaluate(); dmg = Math.max(1, Math.floor(Number(roll.total) || 0)); } catch (_e) {}

    // Record the beat first (persisted) so the breach transition fired by the damage sees it.
    await _withSiege(S, targetUuid, (state) => {
      S.appendNarrativeBeat(state, { turn: _turn(), kind: "bombard", title: "Bombardment",
        description: `${actor?.name || "The besiegers"} bombard ${wall.name} for ${dmg} structure damage.`,
        payload: { layerIdx: idx, dmg } });
    });

    const apply = game.fourththing?.rolls?._applyDamageToActor;
    if (typeof apply !== "function") return { ok: false, reason: "structure damage path unavailable (fourththing not loaded)" };
    await apply(wall, dmg, { op: "damage", track: "integrity", damageType: "concussive", damageFlavor: "bombardment" });

    const after = game.bbttcc?.api?.structures?.readState?.(wall);
    const plates = after?.plates ? `${after.plates.current}/${after.plates.max}` : "?";

    // §6 VFX — fire the bombardment beat so the boulder volley arcs siege-line → wall on
    // every client (siege-vfx.js _onBombardment). Spectacle only; the Plate damage already
    // landed above. Volley size nods at intensity (bigger hit → one more boulder); later this
    // scales off the muster (§5). Relayed via the siegeHook socket branch.
    const volley = (dmg >= 30) ? 3 : 2;
    _relayHook("bbttcc:siege:bombardment", {
      siegeId: st.siegeId, hexUuid: targetUuid, layerIdx: idx,
      structureActorId: wall.id, wallName: wall.name,
      factionName: actor?.name || "The besiegers", dmg, volley
    });

    await _pushWarLog(actor, `Bombard: ${dmg} structure damage to ${wall.name} (Plates ${plates}, ${after?.state || "?"}).`, { activityKey: "bombard", hexUuid: targetUuid });
    return { ok: true, summary: `Bombarded ${wall.name} for ${dmg} (Plates ${plates}).` };
  }

  // ============================================================
  // Registration
  // ============================================================

  // All 9 are SIEGE strategic activities (siege:true) → they slot into the planner's
  // dedicated Siege section, split Attacker/Defender by siegeSide. siegeOrder gives the
  // intra-section ordering (signature/opener activities first); the planner falls back to
  // band + alpha when it's absent. See RAID_ABILITY_SURVEY.md §4 / §8 step 2.
  const HANDLERS = {
    bombard:               { fn: bombard,               label: "Bombard",             cost: { violence: 20, logistics: 20 }, clashCost: 15,      band: "standard", siege: true, siegeSide: "attacker", siegeOrder: 1, tempo: "clash", icon: "⛰" },
    storm_final_assault:   { fn: storm_final_assault,   label: "Storm Final Assault",  cost: { violence: 40, logistics: 20 },              band: "rare",     siege: true, siegeSide: "attacker", siegeOrder: 2 },
    demand_surrender:      { fn: demand_surrender,      label: "Demand Surrender",     cost: { diplomacy: 20, violence: 10, softPower: 10 }, band: "rare",   siege: true, siegeSide: "attacker", siegeOrder: 3 },
    champion_returns:      { fn: champion_returns,      label: "Champion Returns",     cost: { diplomacy: 20, softPower: 10 },             band: "standard", siege: true, siegeSide: "attacker", siegeOrder: 4 },
    champion_withdraws:    { fn: champion_withdraws,    label: "Champion Withdraws",   cost: { softPower: 15, diplomacy: 10 },             band: "rare",     siege: true, siegeSide: "attacker", siegeOrder: 5 },
    reinforce_garrison:    { fn: reinforce_garrison,    label: "Reinforce Garrison",  cost: { violence: 15, logistics: 10 },              band: "standard", siege: true, siegeSide: "defender", siegeOrder: 1 },
    champion_defends_wall: { fn: champion_defends_wall, label: "Champion Defends Wall",cost: { violence: 10 },                             band: "standard", siege: true, siegeSide: "defender", siegeOrder: 2 },
    call_relief:           { fn: call_relief,           label: "Call Relief",          cost: { diplomacy: 20, softPower: 20 },             band: "rare",     siege: true, siegeSide: "defender", siegeOrder: 3 },
    pray_for_omen:         { fn: pray_for_omen,         label: "Pray for Omen",        cost: { faith: 10 },                                band: "standard", siege: true, siegeSide: "defender", siegeOrder: 4 },
    sue_for_terms:         { fn: sue_for_terms,         label: "Sue for Terms",        cost: { diplomacy: 20, softPower: 15 },             band: "rare",     siege: true, siegeSide: "defender", siegeOrder: 5 }
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
        ...(def.siege ? { siege: true, siegeSide: def.siegeSide || "attacker", siegeOrder: def.siegeOrder ?? null } : {}),
        async apply({ entry }){
          const r = await shared({ factionId: entry?.attackerId || entry?.factionId, targetUuid: entry?.targetUuid, note: entry?.note || "" });
          return r.ok ? `${def.label}: ${r.summary || "done"}.` : `${def.label} failed: ${r.reason}`;
        }
      });
    }

    // Expose the terms/surrender resolvers.
    game.bbttcc.api.siege.resolveTerms = resolveTerms;
    game.bbttcc.api.siege.resolveSurrender = resolveSurrender;

    // In-the-moment clash invoker + a descriptor of the clash-tempo maneuvers (for the HUD).
    game.bbttcc.api.siege.fireManeuver = fireManeuver;
    game.bbttcc.api.siege.clashManeuvers = Object.entries(HANDLERS)
      .filter(([, d]) => d.tempo === "clash")
      .map(([key, d]) => ({
        key, label: d.label, side: d.siegeSide || "attacker", icon: d.icon || "⚔",
        cost: d.cost || {},
        costTotal: Number.isFinite(d.clashCost) ? d.clashCost : Object.values(d.cost || {}).reduce((a, b) => a + (Number(b) || 0), 0)
      }));

    console.log(TAG, `registered ${Object.keys(HANDLERS).length} counter-activities + resolveTerms/resolveSurrender + fireManeuver (${game.bbttcc.api.siege.clashManeuvers.length} clash-tempo).`);
  }));

  console.log(TAG, "loaded (awaiting raid API)");
})();

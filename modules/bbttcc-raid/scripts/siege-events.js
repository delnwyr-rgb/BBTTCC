// bbttcc-raid/scripts/siege-events.js
// SIEGE_RAID_TYPE_SPEC.md §9 — Phase F.3: the Siege Event Deck draw→apply engine.
//
// The strategic tick (siege-tick.js step 8) already rolls 2d10 ≥ threshold each turn. Until F.3
// it only wrote a placeholder beat. This engine replaces that: it loads data/siege-events.json,
// filters the chosen deck's events by their conditions, weighted-picks one (honoring the
// defender's `omenReroll` lever — draw two, keep the more defender-favourable), applies its
// effects, appends a narrative beat, pushes to state.eventsFired, and relays bbttcc:siege:event.
//
// SEPARATION OF WRITES: state-field effects (buffer / champions / supply / budget / truce) mutate
// the `state` object the TICK persists once at its step 9 — this engine does NOT persist siege
// state. External effects (morale via factions.bumpMorale, defection via actor.update, ledger via
// territory.recordHexImprovement) are written directly here, guarded + degrading if absent.
//
// MODEL NOTE: the siege "Buffer" is the attacker's supply pool (the only buffer in the model).
// A `buffer` effect with side "defender"/"random→defender" routes to defenderAnytimeBudget
// (scaled ÷10) since the defender has no Buffer; "both" hits attacker Buffer + defender budget.

(() => {
  globalThis.__bbttcc_siege_events_loaded_v1 = Date.now();

  const MOD_R = "bbttcc-raid";
  const TAG = "[bbttcc/siege-events]";

  let DECKS = null;   // { version, events:{id:def}, decks:{id:{threshold,eventIds}} }

  const _nm = (id) => game.actors?.get?.(id)?.name || id || "a champion";
  const _rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const _rollDice = (v) => {
    if (typeof v === "number") return v;
    const m = String(v).match(/^(\d+)d(\d+)$/);
    if (!m) return Number(v) || 1;
    let t = 0; const n = +m[1], f = +m[2];
    for (let i = 0; i < n; i++) t += Math.floor(Math.random() * f) + 1;
    return t;
  };

  function _relayHook(hook, payload){
    Hooks.callAll(hook, payload);
    try { game.socket?.emit?.(`module.${MOD_R}`, { t: "siegeHook", hook, payload }); } catch (_e) {}
  }

  async function _loadDecks(){
    if (DECKS) return DECKS;
    try {
      const mod = game.modules?.get?.(MOD_R);
      const base = (mod?.url || mod?.path || `/modules/${MOD_R}`).replace(/\/+$/, "");
      DECKS = await (await fetch(`${base}/data/siege-events.json`, { cache: "no-store" })).json();
    } catch (e) {
      console.warn(TAG, "deck JSON load failed; using empty deck", e);
      DECKS = { events: {}, decks: {} };
    }
    return DECKS;
  }

  // ── eligibility ────────────────────────────────────────────────────────────
  function _activeCount(state){
    const a = (state.attackerChampions || []).filter(c => c.status === "active").length;
    const d = (state.defenderChampions || []).filter(c => c.status === "active").length;
    return a + d;
  }
  function _anyDead(state){
    return [...(state.attackerChampions || []), ...(state.defenderChampions || [])].some(c => c.status === "dead");
  }
  function _eligible(ev, { state, turn }){
    const c = ev.conditions || {};
    if (c.minDuration != null && (turn - (state.startedTurn ?? turn)) < c.minDuration) return false;
    if (c.requiresNaval && !state.isNavalSupply) return false;
    if (c.requiresRecentChampionDeath && !_anyDead(state)) return false;
    if (c.minActiveChampions != null && _activeCount(state) < c.minActiveChampions) return false;
    return true;
  }

  function _weightedPick(events){
    const total = events.reduce((s, e) => s + (Number(e.weight) || 1), 0);
    let r = Math.random() * total;
    for (const e of events) { r -= (Number(e.weight) || 1); if (r <= 0) return e; }
    return events[events.length - 1];
  }

  // Heuristic: > 0 means the event favours the DEFENDER (used by omenReroll to pick the kinder draw).
  function _defenderFavor(ev){
    let s = 0;
    for (const eff of (ev.effects || [])) {
      const amt = Number(eff.amount) || 0;
      if (eff.type === "morale") { if (eff.side === "defender") s += amt; else if (eff.side === "attacker") s -= amt; }
      else if (eff.type === "buffer") { if (eff.side === "attacker") s += -amt / 10; }   // attacker buffer loss helps defender
      else if (eff.type === "championWound") { if (eff.side === "attacker") s += 1; else if (eff.side === "defender") s -= 1; }
      else if (eff.type === "supplySever") s += 2;
      else if (eff.type === "defenderBudget") s += amt / 2;
    }
    return s;
  }

  // ── effect application ──────────────────────────────────────────────────────
  function _factionForSide(side, ctx){
    if (side === "attacker") return ctx.attackerFactionId;
    if (side === "defender") return ctx.defenderFactionId;
    if (side === "random") return Math.random() < 0.5 ? ctx.attackerFactionId : ctx.defenderFactionId;
    return null;
  }

  async function _bumpMorale(factionId, delta){
    if (!factionId || !delta) return;
    try { const fn = game.bbttcc?.api?.factions?.bumpMorale; if (typeof fn === "function") await fn({ factionId, delta }); }
    catch (e) { console.warn(TAG, "bumpMorale failed", e); }
  }

  function _woundFrom(roster, n){
    const active = roster.filter(c => c.status === "active");
    const hit = [];
    for (let i = 0; i < n && active.length; i++) {
      const idx = Math.floor(Math.random() * active.length);
      const c = active.splice(idx, 1)[0];
      c.status = "wounded"; c.reason = "event"; hit.push(c.actorId);
    }
    return hit;
  }
  function _recoverFrom(roster, n){
    const wounded = roster.filter(c => c.status === "wounded");
    const back = [];
    for (let i = 0; i < n && wounded.length; i++) {
      const idx = Math.floor(Math.random() * wounded.length);
      const c = wounded.splice(idx, 1)[0];
      c.status = "active"; c.reason = "event_recover"; back.push(c.actorId);
    }
    return back;
  }

  // Returns a short human note for the narrative summary. Mutates `state` for state-effects;
  // performs external writes (morale/defection/ledger) directly.
  async function _applyEffect(eff, ctx){
    const { state, S } = ctx;
    switch (eff.type) {
      case "buffer": {
        const side = eff.side || "attacker";
        const resolved = side === "random" ? (Math.random() < 0.5 ? "attacker" : "defender") : side;
        const notes = [];
        if (resolved === "attacker" || resolved === "both") {
          const amt = Number(eff.amount) || 0;
          if (amt < 0) { const sh = S.shaveBuffer(state.buffer, -amt); notes.push(`Buffer −${sh.shaved}`); }
          else { state.buffer.logistics = (state.buffer.logistics || 0) + amt; notes.push(`Buffer +${amt}`); }
        }
        if (resolved === "defender" || resolved === "both") {
          const d = Math.round((Number(eff.amount) || 0) / 10);
          state.defenderAnytimeBudget = Math.max(0, (state.defenderAnytimeBudget || 0) + d);
          notes.push(`defender budget ${d >= 0 ? "+" : ""}${d}`);
        }
        return notes.join(", ");
      }
      case "defenderBudget": {
        const d = Number(eff.amount) || 0;
        state.defenderAnytimeBudget = Math.max(0, (state.defenderAnytimeBudget || 0) + d);
        return `defender Anytime ${d >= 0 ? "+" : ""}${d}`;
      }
      case "morale": {
        if (eff.side === "both") { await _bumpMorale(ctx.attackerFactionId, eff.amount); await _bumpMorale(ctx.defenderFactionId, eff.amount); return `both morale ${eff.amount >= 0 ? "+" : ""}${eff.amount}`; }
        const fid = _factionForSide(eff.side, ctx);
        await _bumpMorale(fid, eff.amount);
        return `${eff.side} morale ${eff.amount >= 0 ? "+" : ""}${eff.amount}`;
      }
      case "moraleSwing": {
        const amt = Number(eff.amount) || 1;
        const up = Math.random() < 0.5 ? "attacker" : "defender";
        const down = up === "attacker" ? "defender" : "attacker";
        await _bumpMorale(_factionForSide(up, ctx), amt);
        await _bumpMorale(_factionForSide(down, ctx), -amt);
        return `${up} morale +${amt}, ${down} −${amt}`;
      }
      case "championWound": {
        const n = _rollDice(eff.count ?? 1);
        let hit = [];
        if (eff.side === "attacker") hit = _woundFrom(state.attackerChampions || [], n);
        else if (eff.side === "defender") hit = _woundFrom(state.defenderChampions || [], n);
        else { // random across both
          const pool = [...(state.attackerChampions || []), ...(state.defenderChampions || [])];
          hit = _woundFrom(pool, n);
        }
        return hit.length ? `${hit.map(_nm).join(", ")} wounded` : "no champion to wound";
      }
      case "championRecover": {
        const n = eff.count ?? 1;
        const back = [];
        if (eff.side === "both") { back.push(..._recoverFrom(state.attackerChampions || [], n), ..._recoverFrom(state.defenderChampions || [], n)); }
        else if (eff.side === "defender") back.push(..._recoverFrom(state.defenderChampions || [], n));
        else back.push(..._recoverFrom(state.attackerChampions || [], n));
        return back.length ? `${back.map(_nm).join(", ")} recovered` : "none to recover";
      }
      case "supplySever": {
        state.supplyStatus = "severed";
        if (state.supplySeveredAtTurn == null) state.supplySeveredAtTurn = ctx.turn;
        return "supply severed";
      }
      case "truce": {
        state.eventTruceTurn = ctx.turn;   // advisory flag (no maneuvers this round)
        return "truce — no maneuvers this round";
      }
      case "defection": {
        try {
          const h = (S.hexHoldings?.(ctx.hexDoc)) || { rigIds: [], bossIds: [] };
          const ids = [...(h.rigIds || []), ...(h.bossIds || [])];
          if (!ids.length) return "no holding to defect";
          const id = _rand(ids);
          const actor = game.actors?.get?.(id);
          if (!actor) return "defector not found";
          const cur = foundry.utils.getProperty(actor, "system.identity.factionOwnerId");
          const next = String(cur) === String(ctx.attackerFactionId) ? ctx.defenderFactionId : ctx.attackerFactionId;
          await actor.update({ "system.identity.factionOwnerId": next || null, [`flags.${MOD_R}.siegeFate`]: { fate: "defected", to: next, turn: ctx.turn } });
          return `${_nm(id)} defects to ${_nm(next)}`;
        } catch (e) { console.warn(TAG, "defection failed", e); return "defection fizzled"; }
      }
      case "ledgerBeat": {
        try {
          const fn = game.bbttcc?.api?.territory?.recordHexImprovement;
          if (typeof fn === "function" && ctx.hexDoc) await fn(ctx.hexDoc, { kind: "siege_event", label: ctx.eventName || "Siege event", description: ctx.narrativeText || "", source: { siegeId: state.siegeId }, reversible: false });
        } catch (e) { console.warn(TAG, "ledgerBeat failed", e); }
        return "recorded to the saga";
      }
      default:
        console.warn(TAG, "unknown effect type", eff.type);
        return "";
    }
  }

  // ── the public draw→apply (called by siege-tick.js step 8) ───────────────────
  async function drawAndApplyEvent({ state, hexUuid, hexDoc, turn, deckId, gateRoll }){
    const S = globalThis.__bbttccSiegeState;
    if (!S) return null;
    const data = await _loadDecks();
    const deck = data.decks?.[deckId] || data.decks?.generic;
    if (!deck) return null;

    const all = (deck.eventIds || []).map(id => Object.assign({ id }, data.events?.[id])).filter(e => e.name);
    const eligible = all.filter(e => _eligible(e, { state, turn }));
    state.eventsFired = Array.isArray(state.eventsFired) ? state.eventsFired : [];
    if (!eligible.length) return null;   // gate fired but nothing qualifies this turn

    // omenReroll (defender's "Pray for Omen"): draw two, keep the more defender-favourable.
    let chosen = _weightedPick(eligible), omenUsed = false;
    if (state.omenReroll) {
      const alt = _weightedPick(eligible);
      chosen = _defenderFavor(alt) > _defenderFavor(chosen) ? alt : chosen;
      state.omenReroll = false;
      omenUsed = true;
    }

    const ctx = {
      state, S, turn, hexDoc,
      attackerFactionId: state.attackerFactionId || null,
      defenderFactionId: (hexDoc && S.hexOwner) ? (S.hexOwner(hexDoc) || null) : null,
      eventName: chosen.name, narrativeText: chosen.narrativeText
    };

    const notes = [];
    for (const eff of (chosen.effects || [])) {
      const note = await _applyEffect(eff, ctx);
      if (note) notes.push(note);
    }

    const summary = notes.join("; ");
    S.appendNarrativeBeat(state, {
      turn,
      kind: "event_deck",
      title: `Event: ${chosen.name}`,
      description: `${chosen.narrativeText}${omenUsed ? " (omen re-rolled in the defender's favour)" : ""}${summary ? ` — ${summary}.` : "."}`,
      payload: { eventId: chosen.id, deckId, gateRoll, omenUsed }
    });
    state.eventsFired.push({ turn, eventId: chosen.id, payload: { deckId, roll: gateRoll?.roll, summary, omenUsed } });

    const evtPayload = { siegeId: state.siegeId, hexUuid, eventId: chosen.id, name: chosen.name, deckId, narrativeText: chosen.narrativeText, summary };
    _relayHook("bbttcc:siege:event", evtPayload);
    console.log(TAG, `drew "${chosen.name}" (${deckId}): ${summary || "narrative only"}`);
    return { eventId: chosen.id, name: chosen.name, summary };
  }

  // ── install ──────────────────────────────────────────────────────────────────
  function _install(){
    globalThis.__bbttccSiegeEvents = { drawAndApplyEvent, _loadDecks, _eligible, _weightedPick, _defenderFavor };
    game.bbttcc = game.bbttcc || { api: {} };
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.siege = game.bbttcc.api.siege || {};
    game.bbttcc.api.siege.events = { drawAndApplyEvent, reloadDecks: () => { DECKS = null; return _loadDecks(); } };
  }
  Hooks.once("ready", () => { _install(); _loadDecks(); console.log(TAG, "Event Deck engine ready (F.3)."); });
  if (game?.ready) { _install(); _loadDecks(); }

  console.log(TAG, "loaded");
})();

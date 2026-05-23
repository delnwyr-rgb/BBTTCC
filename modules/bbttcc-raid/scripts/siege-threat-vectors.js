// bbttcc-raid/scripts/siege-threat-vectors.js
// SIEGE_RAID_TYPE_SPEC.md §4 — Phase C: Threat Vectors.
//
// Four strategic activities that make the supply layer a contest rather than a
// one-way decay clock:
//   - interdict_supply_line  [T1, Int15+V10]  any non-attacker faction — cut a supply-path hex
//   - escort_supply_line     [T1, V10+L10]    attacker/ally — +1 escort pip (cancels an interdiction next tick)
//   - counter_interdict      [T1, V10+Int10]  attacker — restore a previously-interdicted hex
//   - sortie                 [T1, V20]        defender — strike a supply hex (sever + Buffer −15 + casualties)
//
// All four target a SUPPLY-PATH hex via the planner's standard hex picker and resolve
// at strategic-throughput consumption time, mirroring begin_siege (siege-throughput.js).
//
// Two-layered interdiction model:
//   - Immediate harassment pulse (`interdictionsThisTurn`) + Buffer shave — bites this tick.
//   - Persistent severance: the hex's "Supply Line" modifier is stripped via turn.pending.repairs
//     (honored by territory resolution-engine.js), and the hex is recorded in `interdictedHexIds`.
//     The BFS sees the missing modifier on a later tick and may sever the path entirely,
//     until a Counter-Interdict restores it.

(() => {
  globalThis.__bbttcc_siege_threat_vectors_loaded_v1 = Date.now();

  const MOD_R = "bbttcc-raid";
  const MOD_T = "bbttcc-territory";
  const MOD_F = "bbttcc-factions";
  const TAG = "[bbttcc/siege-threat]";

  function whenRaidReady(cb, tries = 0){
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS && api?.STRATEGIC_THROUGHPUT) return cb(api);
      if (tries > 80) return console.warn(TAG, "raid API not ready after timeout");
      setTimeout(() => whenRaidReady(cb, tries + 1), 250);
    };
    if (globalThis.Hooks) Hooks.once("ready", go); else go();
  }

  function whenSiegeStateReady(cb, tries = 0){
    if (globalThis.__bbttccSiegeState) return cb(globalThis.__bbttccSiegeState);
    if (tries > 80) return console.warn(TAG, "siege-state internals not exposed");
    setTimeout(() => whenSiegeStateReady(cb, tries + 1), 250);
  }

  function _currentTurn(){
    try { return Number(game.bbttcc?.api?.world?.getState?.()?.turn) || 0; }
    catch { return 0; }
  }

  async function _hexDocFromUuid(hexUuid){
    if (!hexUuid) return null;
    const ref = await fromUuid(hexUuid);
    return ref?.document ?? ref ?? null;
  }

  function _hexName(hexDoc){
    return hexDoc?.flags?.[MOD_T]?.name || hexDoc?.text || hexDoc?.id || "a supply hex";
  }

  async function _pushWarLog(actor, summary, extra = {}){
    if (!actor) return;
    const wl = Array.isArray(actor.getFlag(MOD_F, "warLogs"))
      ? actor.getFlag(MOD_F, "warLogs").slice()
      : [];
    wl.push({
      ts: Date.now(),
      date: (new Date()).toLocaleString(),
      type: "siege",
      activity: extra.activityKey || "siege_threat",
      summary,
      ...extra
    });
    await actor.update({ [`flags.${MOD_F}.warLogs`]: wl });
  }

  // ---- turn.pending Supply Line strip / restore (territory resolution-engine convention) ----

  async function _queueStripSupplyLine(hexDoc){
    if (!hexDoc) return;
    const tf = foundry.utils.duplicate(hexDoc.flags?.[MOD_T] || {});
    const pend = foundry.utils.getProperty(tf, "turn.pending") || {};
    pend.repairs = pend.repairs || {};
    pend.repairs.removeModifiers = Array.isArray(pend.repairs.removeModifiers) ? pend.repairs.removeModifiers.slice() : [];
    pend.repairs.addModifiers = Array.isArray(pend.repairs.addModifiers) ? pend.repairs.addModifiers.slice() : [];
    // Strip wins over a same-turn restore: drop any queued re-add, then queue removal.
    pend.repairs.addModifiers = pend.repairs.addModifiers.filter(m => m !== "Supply Line");
    if (!pend.repairs.removeModifiers.includes("Supply Line")) pend.repairs.removeModifiers.push("Supply Line");
    await hexDoc.update({ [`flags.${MOD_T}.turn.pending`]: pend }, { parent: hexDoc.parent });
  }

  async function _queueRestoreSupplyLine(hexDoc){
    if (!hexDoc) return;
    const tf = foundry.utils.duplicate(hexDoc.flags?.[MOD_T] || {});
    const pend = foundry.utils.getProperty(tf, "turn.pending") || {};
    pend.repairs = pend.repairs || {};
    pend.repairs.removeModifiers = Array.isArray(pend.repairs.removeModifiers) ? pend.repairs.removeModifiers.slice() : [];
    pend.repairs.addModifiers = Array.isArray(pend.repairs.addModifiers) ? pend.repairs.addModifiers.slice() : [];
    // Restore wins over a same-turn strip: drop any queued removal, then queue re-add.
    pend.repairs.removeModifiers = pend.repairs.removeModifiers.filter(m => m !== "Supply Line");
    if (!pend.repairs.addModifiers.includes("Supply Line")) pend.repairs.addModifiers.push("Supply Line");
    await hexDoc.update({ [`flags.${MOD_T}.turn.pending`]: pend }, { parent: hexDoc.parent });
  }

  function _isAttackerSide(state, factionId){
    return factionId === state.attackerFactionId
      || (state.supportingFactionIds || []).includes(factionId);
  }

  // ============================================================
  // 1. Interdict Supply Line  (any non-attacker faction)
  // ============================================================

  async function handleInterdict({ factionId, targetUuid, S }){
    const actor = game.actors.get(factionId);
    const hexDoc = await _hexDocFromUuid(targetUuid);
    if (!hexDoc) return { ok: false, reason: "Interdict: target hex not found." };

    const all = S.findSiegesUsingHex(targetUuid);
    // You can't interdict your own siege's supply.
    const sieges = all.filter(e => e.siege.attackerFactionId !== factionId);
    if (!sieges.length) {
      const why = all.length
        ? "Interdict: that hex only feeds your own siege(s) — can't interdict your own supply."
        : "Interdict: no active siege uses this hex as a supply-path hex.";
      await _pushWarLog(actor, why, { activityKey: "interdict_supply_line", hexUuid: targetUuid });
      return { ok: false, reason: why };
    }

    // Strip the Supply Line modifier once (the hex may feed multiple sieges).
    await _queueStripSupplyLine(hexDoc);

    const turn = _currentTurn();
    const hexName = _hexName(hexDoc);
    let totalShaved = 0;
    for (const entry of sieges) {
      const state = foundry.utils.duplicate(entry.siege);
      state.interdictionsThisTurn = (state.interdictionsThisTurn || 0) + 1;
      state.interdictedHexIds = Array.from(new Set([...(state.interdictedHexIds || []), targetUuid]));
      const shave = S.shaveBuffer(state.buffer, 10);
      totalShaved += shave.shaved;
      S.appendNarrativeBeat(state, {
        turn,
        kind: "interdiction",
        title: `Supply line interdicted at ${hexName}`,
        description: `${actor?.name || "A faction"} severs the road. Buffer −${shave.shaved} OP; harassment +1 this turn. The route stays cut until restored.`,
        payload: { byFactionId: factionId, hexUuid: targetUuid, shaved: shave.shaved }
      });
      await S.setSiegeState(entry.hexUuid, state);
      Hooks.callAll("bbttcc:siege:interdicted", { siegeId: state.siegeId, hexUuid: entry.hexUuid, pathHexUuid: targetUuid, byFactionId: factionId });
    }

    await _pushWarLog(actor,
      `Interdict Supply Line at ${hexName}: ${sieges.length} siege(s) harassed, Buffer −${totalShaved} OP total. Supply Line strip queued (severs the path until Counter-Interdicted).`,
      { activityKey: "interdict_supply_line", hexUuid: targetUuid, siegeCount: sieges.length });

    return { ok: true, sieges: sieges.length, shaved: totalShaved };
  }

  // ============================================================
  // 2. Escort Supply Line  (attacker / ally — protect own supply)
  // ============================================================

  async function handleEscort({ factionId, targetUuid, S }){
    const actor = game.actors.get(factionId);
    const hexDoc = await _hexDocFromUuid(targetUuid);
    if (!hexDoc) return { ok: false, reason: "Escort: target hex not found." };

    // Accept either a supply-path hex or the besieged hex itself as the siege selector.
    const byPath = S.findSiegesUsingHex(targetUuid, { includeTarget: true });
    const direct = S.listActiveSieges().filter(e => e.hexUuid === targetUuid);
    const seen = new Set();
    const candidates = [...byPath, ...direct].filter(e => {
      const id = e.siege?.siegeId;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    // Escort protects YOUR supply — restrict to attacker-side sieges.
    const sieges = candidates.filter(e => _isAttackerSide(e.siege, factionId));
    if (!sieges.length) {
      const why = candidates.length
        ? "Escort: you are not the attacker or a supporter on the siege(s) using this hex."
        : "Escort: no active siege is tied to this hex.";
      await _pushWarLog(actor, why, { activityKey: "escort_supply_line", hexUuid: targetUuid });
      return { ok: false, reason: why };
    }

    const turn = _currentTurn();
    const hexName = _hexName(hexDoc);
    for (const entry of sieges) {
      const state = foundry.utils.duplicate(entry.siege);
      state.escortPipsThisTurn = (state.escortPipsThisTurn || 0) + 1;
      S.appendNarrativeBeat(state, {
        turn,
        kind: "escort",
        title: `Supply escort posted near ${hexName}`,
        description: `${actor?.name || "A faction"} screens the convoy: +1 escort pip (cancels one interdiction at the next tick; deters defender sorties).`,
        payload: { byFactionId: factionId, hexUuid: targetUuid }
      });
      await S.setSiegeState(entry.hexUuid, state);
      Hooks.callAll("bbttcc:siege:escortPosted", { siegeId: state.siegeId, hexUuid: entry.hexUuid, byFactionId: factionId });
    }

    await _pushWarLog(actor,
      `Escort Supply Line near ${hexName}: +1 escort pip on ${sieges.length} siege(s).`,
      { activityKey: "escort_supply_line", hexUuid: targetUuid, siegeCount: sieges.length });

    return { ok: true, sieges: sieges.length };
  }

  // ============================================================
  // 3. Counter-Interdict  (attacker — restore a cut hex)
  // ============================================================

  async function handleCounterInterdict({ factionId, targetUuid, S }){
    const actor = game.actors.get(factionId);
    const hexDoc = await _hexDocFromUuid(targetUuid);
    if (!hexDoc) return { ok: false, reason: "Counter-Interdict: target hex not found." };

    const interdicted = S.findSiegesUsingHex(targetUuid, { includeTarget: true, interdictedOnly: true });
    // Only the attacker-side restores their own supply.
    const sieges = interdicted.filter(e => _isAttackerSide(e.siege, factionId));
    if (!sieges.length) {
      const why = interdicted.length
        ? "Counter-Interdict: you are not the attacker/supporter on the interdicted siege(s)."
        : "Counter-Interdict: no active interdiction recorded on this hex.";
      await _pushWarLog(actor, why, { activityKey: "counter_interdict", hexUuid: targetUuid });
      return { ok: false, reason: why };
    }

    // Restore the Supply Line modifier (cancels any queued same-turn strip).
    await _queueRestoreSupplyLine(hexDoc);

    const turn = _currentTurn();
    const hexName = _hexName(hexDoc);
    for (const entry of sieges) {
      const state = foundry.utils.duplicate(entry.siege);
      state.interdictedHexIds = (state.interdictedHexIds || []).filter(h => h !== targetUuid);
      state.interdictionsThisTurn = Math.max(0, (state.interdictionsThisTurn || 0) - 1);
      S.appendNarrativeBeat(state, {
        turn,
        kind: "counter_interdict",
        title: `Supply line reopened at ${hexName}`,
        description: `${actor?.name || "A faction"} clears the interdiction and restores the road. Harassment −1 this turn.`,
        payload: { byFactionId: factionId, hexUuid: targetUuid }
      });
      await S.setSiegeState(entry.hexUuid, state);
      Hooks.callAll("bbttcc:siege:counterInterdicted", { siegeId: state.siegeId, hexUuid: entry.hexUuid, pathHexUuid: targetUuid, byFactionId: factionId });
    }

    await _pushWarLog(actor,
      `Counter-Interdict at ${hexName}: interdiction cleared on ${sieges.length} siege(s); Supply Line restoration queued.`,
      { activityKey: "counter_interdict", hexUuid: targetUuid, siegeCount: sieges.length });

    return { ok: true, sieges: sieges.length };
  }

  // ============================================================
  // 4. Sortie  (defender — strike an attacker supply hex)
  // ============================================================

  async function handleSortie({ factionId, targetUuid, S }){
    const actor = game.actors.get(factionId);
    const hexDoc = await _hexDocFromUuid(targetUuid);
    if (!hexDoc) return { ok: false, reason: "Sortie: target hex not found." };

    const all = S.findSiegesUsingHex(targetUuid);
    // A sortie is launched AGAINST a besieger — never against your own siege.
    const sieges = all.filter(e => e.siege.attackerFactionId !== factionId);
    if (!sieges.length) {
      const why = all.length
        ? "Sortie: that supply hex only feeds your own siege(s)."
        : "Sortie: no enemy siege draws supply through this hex.";
      await _pushWarLog(actor, why, { activityKey: "sortie", hexUuid: targetUuid });
      return { ok: false, reason: why };
    }

    // Sever the supply line at the struck hex.
    await _queueStripSupplyLine(hexDoc);

    const turn = _currentTurn();
    const hexName = _hexName(hexDoc);
    let totalShaved = 0;
    let totalCasualties = 0;
    for (const entry of sieges) {
      const state = foundry.utils.duplicate(entry.siege);
      state.interdictedHexIds = Array.from(new Set([...(state.interdictedHexIds || []), targetUuid]));
      const shave = S.shaveBuffer(state.buffer, 15);
      totalShaved += shave.shaved;

      // Risk: 1d4 holdings lost; +2 if the supply hex is escort-protected this turn.
      const escorted = (state.escortPipsThisTurn || 0) > 0;
      const die = Math.floor(Math.random() * 4) + 1;
      const casualties = die + (escorted ? 2 : 0);
      state.sortieCasualtiesTotal = (state.sortieCasualtiesTotal || 0) + casualties;
      totalCasualties += casualties;

      S.appendNarrativeBeat(state, {
        turn,
        kind: "sortie",
        title: `Sortie strikes the supply line at ${hexName}`,
        description: `${actor?.name || "The garrison"} sallies out: Supply Line cut, Buffer −${shave.shaved} OP. Defender losses ${die}${escorted ? " +2 (escorted hex)" : ""} = ${casualties} holding(s). (Roster write-back deferred to Phase E.)`,
        payload: { byFactionId: factionId, hexUuid: targetUuid, shaved: shave.shaved, casualties, escorted }
      });
      await S.setSiegeState(entry.hexUuid, state);
      Hooks.callAll("bbttcc:siege:sortie", { siegeId: state.siegeId, hexUuid: entry.hexUuid, pathHexUuid: targetUuid, byFactionId: factionId, casualties });
    }

    await _pushWarLog(actor,
      `Sortie at ${hexName}: ${sieges.length} enemy siege(s) hit — Buffer −${totalShaved} OP, Supply Line severed. Own losses: ${totalCasualties} holding(s).`,
      { activityKey: "sortie", hexUuid: targetUuid, siegeCount: sieges.length, casualties: totalCasualties });

    return { ok: true, sieges: sieges.length, shaved: totalShaved, casualties: totalCasualties };
  }

  // ============================================================
  // Registration into both registries (mirrors begin_siege)
  // ============================================================

  const HANDLERS = {
    interdict_supply_line: { fn: handleInterdict,        label: "Interdict Supply Line", cost: { intrigue: 15, violence: 10 }, band: "standard" },
    escort_supply_line:    { fn: handleEscort,           label: "Escort Supply Line",    cost: { violence: 10, logistics: 10 }, band: "standard" },
    counter_interdict:     { fn: handleCounterInterdict, label: "Counter-Interdict",     cost: { violence: 10, intrigue: 10 },  band: "standard" },
    sortie:                { fn: handleSortie,           label: "Sortie",                cost: { violence: 20 },                band: "standard" }
  };

  whenRaidReady((api) => whenSiegeStateReady((S) => {
    const ST = api.STRATEGIC_THROUGHPUT;
    const EFFECTS = api.EFFECTS = api.EFFECTS || {};

    for (const [key, def] of Object.entries(HANDLERS)) {
      const shared = async ({ factionId, targetUuid, note }) => {
        try {
          return await def.fn({ factionId, targetUuid, note, S });
        } catch (err) {
          console.error(TAG, `${key} failed`, err);
          await _pushWarLog(game.actors.get(factionId), `${def.label} ERROR: ${err.message}`, { activityKey: key });
          return { ok: false, reason: err.message };
        }
      };

      ST[key] = async (ctx) => shared({
        factionId: ctx.factionId || ctx.attackerId,
        targetUuid: ctx.targetUuid,
        note: ctx.notes || ctx.note || ""
      });

      EFFECTS[key] = Object.assign({}, EFFECTS[key], {
        kind: "strategic",
        band: def.band,
        label: def.label,
        cost: def.cost,
        siegeThreatVector: true,
        async apply({ entry }){
          const r = await shared({
            factionId: entry?.attackerId || entry?.factionId,
            targetUuid: entry?.targetUuid,
            note: entry?.note || ""
          });
          return r.ok
            ? `${def.label}: ${r.sieges} siege(s) affected${r.shaved ? `, Buffer −${r.shaved}` : ""}${r.casualties ? `, ${r.casualties} casualties` : ""}.`
            : `${def.label} failed: ${r.reason}`;
        }
      });
    }

    console.log(TAG, `registered ${Object.keys(HANDLERS).length} threat-vector handlers (STRATEGIC_THROUGHPUT + EFFECTS)`);
  }));

  console.log(TAG, "loaded (awaiting raid API)");
})();

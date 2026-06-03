// bbttcc-raid/scripts/siege-throughput.js
// SIEGE_RAID_TYPE_SPEC.md §3 — Begin Siege + Establish Siege Camp handlers.
// Phase A: register in both STRATEGIC_THROUGHPUT and EFFECTS registries.
// Phase B authors siegeTurnTick + re-queue logic.

(() => {
  globalThis.__bbttcc_siege_throughput_loaded_v1 = Date.now();

  const MOD_R = "bbttcc-raid";
  const MOD_T = "bbttcc-territory";
  const MOD_F = "bbttcc-factions";
  const MOD_S = "bbttcc-structures";
  const TAG = "[bbttcc/siege-throughput]";

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

  function _parseSiegeNote(noteStr){
    // Planner stores extra config in the note field as JSON when activity needs it.
    // Phase A: { sizeProfile?, depotHexUuid?, layerOverride?: [{structureActorId, sceneId, transitionRule, thresholdPct?, stockpileMax?}], intent?, bufferCommit?: {violence,logistics,economy,...} }
    if (!noteStr) return {};
    const s = String(noteStr).trim();
    if (!s.startsWith("{")) return { _raw: s };
    try { return JSON.parse(s); }
    catch { return { _raw: s }; }
  }

  async function _hexDocFromUuid(hexUuid){
    if (!hexUuid) return null;
    const ref = await fromUuid(hexUuid);
    return ref?.document ?? ref ?? null;
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
      activity: extra.activityKey || "siege",
      summary,
      ...extra
    });
    await actor.update({ [`flags.${MOD_F}.warLogs`]: wl });
  }

  async function _appendImprovement(hexDoc, entry){
    if (!hexDoc) return;
    const tf = foundry.utils.duplicate(hexDoc.flags?.[MOD_T] || {});
    tf.improvements = Array.isArray(tf.improvements) ? tf.improvements.slice() : [];
    tf.improvements.push({
      id: `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      ts: Date.now(),
      turn: entry.turn ?? _currentTurn(),
      kind: entry.kind,
      label: entry.label || "",
      description: entry.description || "",
      source: entry.source || {},
      reversible: !!entry.reversible
    });
    // Cap at 250 like territory module convention
    if (tf.improvements.length > 250) tf.improvements = tf.improvements.slice(-250);
    await hexDoc.update({ [`flags.${MOD_T}.improvements`]: tf.improvements }, { parent: hexDoc.parent });
  }

  async function _consumeBulwarkSiegeDiscount(attackerFactionActor){
    if (!attackerFactionActor) return { applied: false };
    const flag = attackerFactionActor.getFlag(MOD_S, "siegeCostDiscount");
    if (!flag?.armed) return { applied: false };
    // Consume TTL
    await attackerFactionActor.update({ [`flags.${MOD_S}.-=siegeCostDiscount`]: null });
    return { applied: true, grantedBy: flag.grantedBy, ts: flag.ts };
  }

  function _computeBufferCommit({ sizeProfile, override }){
    // Default upfront commit derived from activity cost; player override per spec Q3 (open w/ defaults).
    const base = { violence: 30, logistics: 20, economy: 10 };
    const out = { violence: 0, logistics: 0, economy: 0, softPower: 0, diplomacy: 0, faith: 0, intrigue: 0 };
    Object.assign(out, base, override || {});
    // Total = sum of all committed OP categories
    const total = Object.values(out).reduce((a, b) => a + (Number(b) || 0), 0);
    return { buffer: out, bufferStartingTotal: total };
  }

  function _resolveLayersFromHex({ hexDoc, layerOverride }){
    // Override wins if provided; otherwise pull from hex.flags.bbttcc-territory.structureActorIds
    if (Array.isArray(layerOverride) && layerOverride.length) {
      return layerOverride.map((l, idx) => ({
        layerId: l.layerId || `layer-${idx}`,
        structureActorId: l.structureActorId,
        sceneId: l.sceneId || null,
        transitionRule: l.transitionRule || "razed",
        thresholdPct: l.thresholdPct ?? null,
        stockpileMax: l.stockpileMax ?? null
      }));
    }
    const ids = hexDoc?.flags?.[MOD_T]?.structureActorIds || [];
    // Optional per-hex layer config: flags.bbttcc-territory.layerRules = { [actorId]: { transitionRule, thresholdPct } }.
    // Lets a hex declare threshold breaches (e.g. breach at ≤50% plates) instead of the full-raze default.
    const rules = hexDoc?.flags?.[MOD_T]?.layerRules;
    return (Array.isArray(ids) ? ids : []).map((structureActorId, idx) => {
      const r = (rules && typeof rules === "object") ? (rules[structureActorId] || {}) : {};
      return {
        layerId: `layer-${idx}`,
        structureActorId,
        sceneId: null,
        transitionRule: r.transitionRule || "razed",
        thresholdPct: Number.isFinite(Number(r.thresholdPct)) ? Number(r.thresholdPct) : null,
        stockpileMax: null
      };
    });
  }

  // ============================================================
  // Begin Siege handler
  // ============================================================

  async function handleBeginSiege({ attackerFactionActor, hexDoc, hexUuid, noteCfg, S }){
    if (!attackerFactionActor) throw new Error("Begin Siege: attacker faction not found");
    if (!hexDoc) throw new Error("Begin Siege: target hex not found");

    const attackerId = attackerFactionActor.id;

    // Enforce: attacker MUST be a real Faction actor (not a Steward/PC).
    // Discriminator per module.raid-planner.js:400-401.
    if (!S.isFactionActor(attackerFactionActor)) {
      const msg = `Begin Siege rejected: attacker "${attackerFactionActor.name}" is not a Faction (sieges must be launched by Factions, not Stewards/PCs). Check flags.bbttcc-factions.isFaction OR system.details.type.value="faction".`;
      await _pushWarLog(attackerFactionActor, msg, { activityKey: "begin_siege", hexUuid });
      return { ok: false, reason: msg };
    }

    // Validate target — must have layers (either from hex or override)
    const layers = _resolveLayersFromHex({ hexDoc, layerOverride: noteCfg.layerOverride });
    if (!layers.length) {
      const msg = "Begin Siege: target hex has no structureActorIds and no layerOverride provided.";
      await _pushWarLog(attackerFactionActor, msg, { activityKey: "begin_siege", hexUuid });
      return { ok: false, reason: msg };
    }

    // Depot validation
    const depotHexUuid = noteCfg.depotHexUuid;
    if (!depotHexUuid) {
      const msg = "Begin Siege: no depotHexUuid in note config. Planner UI must surface a depot picker (Phase A.5).";
      await _pushWarLog(attackerFactionActor, msg, { activityKey: "begin_siege", hexUuid });
      return { ok: false, reason: msg };
    }
    const depotDoc = await _hexDocFromUuid(depotHexUuid);
    const depotCheck = S.validateDepot(depotDoc, attackerId);
    if (!depotCheck.ok) {
      const msg = `Begin Siege: depot rejected — ${depotCheck.reason}`;
      await _pushWarLog(attackerFactionActor, msg, { activityKey: "begin_siege", hexUuid });
      return { ok: false, reason: msg };
    }

    // BFS supply path (Phase A stub)
    const supportingFactionIds = Array.isArray(noteCfg.supportingFactionIds) ? noteCfg.supportingFactionIds : [];
    const allowedFactionIds = [attackerId, ...supportingFactionIds];
    const pathResult = await S.bfsSupplyPath({
      siegeTargetHexUuid: hexUuid,
      depotHexUuid,
      allowedFactionIds
    });
    if (!pathResult.ok) {
      const msg = `Begin Siege: supply path failed — ${pathResult.reason}`;
      await _pushWarLog(attackerFactionActor, msg, { activityKey: "begin_siege", hexUuid });
      return { ok: false, reason: msg };
    }

    // Consume Bulwark discount (dormant TTL flag from bbttcc-structures)
    const bulwark = await _consumeBulwarkSiegeDiscount(attackerFactionActor);

    // Snapshot champions
    const attackerChampions = S.snapshotChampions(attackerFactionActor);
    // Defender champions snapshotted from hex owner faction (if any)
    let defenderChampions = [];
    const defenderFactionId = S.hexOwner(hexDoc);
    if (defenderFactionId) {
      const defender = game.actors.get(defenderFactionId);
      if (defender) defenderChampions = S.snapshotChampions(defender);
    }

    // Event Deck
    const eventDeckId = S.pickEventDeck(hexDoc);

    // Terrain → grace period default (GM can override via noteCfg.gracePeriodTurns)
    const terrainKey = S.hexTerrainKey(hexDoc);
    const terrainMod = S.terrainModifier(terrainKey);
    const gracePeriodTurns = Number.isFinite(noteCfg.gracePeriodTurns)
      ? Number(noteCfg.gracePeriodTurns)
      : terrainMod.grace;

    // Naval supply detection
    const isNavalSupply = (terrainKey === "sea" || terrainKey === "coast")
      || (depotDoc && (S.hexTerrainKey(depotDoc) === "sea" || S.hexTerrainKey(depotDoc) === "coast" || (S.hexModifiers(depotDoc) || []).includes("Beached Camp")));

    // Buffer commit
    const { buffer, bufferStartingTotal } = _computeBufferCommit({
      sizeProfile: noteCfg.sizeProfile || "standard",
      override: noteCfg.bufferCommit
    });

    // FUND THE BUFFER from the attacker's OP bank (per-category, in marks). The refund half of
    // this loop already existed (the outcome write-back credits OP back on a win) — this is the
    // debit that closes it: a siege now COSTS what it commits. The Bulwark discount (×0.75) lowers
    // the bill. Affordability is enforced by op.commit (refuses underflow), so you can't begin a
    // siege you can't fund — and a bigger commit is a real "marshal the war chest" decision.
    {
      const opApi = game.bbttcc?.api?.op;
      if (opApi?.commit) {
        const OP_TO_MARKS = Number(opApi.OP_TO_MARKS) || 10;
        const disc = bulwark.applied ? 0.75 : 1;
        const deltas = {};
        let paidOP = 0;
        for (const [k, v] of Object.entries(buffer)) {
          const op = Math.round((Number(v) || 0) * disc);
          if (op > 0) { deltas[String(k).toLowerCase()] = -(op * OP_TO_MARKS); paidOP += op; }
        }
        if (paidOP > 0) {
          const res = await opApi.commit(attackerId, deltas, {
            source: "siege",
            label: `Begin Siege — buffer commit${bulwark.applied ? " (Bulwark ×0.75)" : ""}`,
            allowOvercap: true
          });
          if (!res || res.committed === false || res.ok === false) {
            const need = Object.entries(buffer).filter(([, v]) => (Number(v) || 0) > 0)
              .map(([k, v]) => `${k} ${Math.round((Number(v) || 0) * disc)}`).join(", ");
            const msg = `Begin Siege rejected — not enough OP to marshal the buffer (need ${need}${bulwark.applied ? "; Bulwark −25% applied" : ""}).`;
            await _pushWarLog(attackerFactionActor, msg, { activityKey: "begin_siege", hexUuid });
            return { ok: false, reason: msg };
          }
        }
      } else {
        console.warn("[bbttcc/siege-throughput] OP API unavailable — buffer committed WITHOUT debiting the bank (faucet).");
      }
    }

    // Build state
    const state = S.makeSiegeState({
      attackerFactionId: attackerId,
      supportingFactionIds,
      startedTurn: _currentTurn(),
      layers,
      sizeProfile: noteCfg.sizeProfile || "standard",
      buffer,
      bufferStartingTotal,
      supplyOriginHexId: depotHexUuid,
      supplyOriginType: (S.hexModifiers(depotDoc) || []).includes("Beached Camp") ? "beached_camp" : "owned_hex",
      supplyPathHexIds: pathResult.path || [],
      gracePeriodTurns,
      isNavalSupply,
      eventDeckId,
      attackerChampions,
      defenderChampions,
      intent: noteCfg.intent || "sack"
    });

    // Initial narrative beat
    S.appendNarrativeBeat(state, {
      turn: state.startedTurn,
      kind: "siege_declared",
      title: `Siege declared on ${hexDoc?.flags?.[MOD_T]?.name || hexDoc?.id || "hex"}`,
      description: `${attackerFactionActor.name} commits ${bufferStartingTotal} OP to siege. Size: ${state.sizeProfile}. Depot: ${depotHexUuid}. Bulwark discount: ${bulwark.applied ? "applied (×0.75)" : "none"}.`,
      payload: { bulwarkDiscount: bulwark.applied }
    });

    // Write to hex
    await S.setSiegeState(hexUuid, state);

    // Track on attacker faction (back-ref)
    const activeSieges = Array.from(new Set([
      ...((attackerFactionActor.getFlag(MOD_F, "activeSieges") || []).slice()),
      hexUuid
    ]));
    await attackerFactionActor.update({ [`flags.${MOD_F}.activeSieges`]: activeSieges });

    // Track on defender faction (back-ref)
    if (defenderFactionId) {
      const defender = game.actors.get(defenderFactionId);
      if (defender) {
        const defendingSieges = Array.from(new Set([
          ...((defender.getFlag(MOD_F, "defendingSieges") || []).slice()),
          hexUuid
        ]));
        await defender.update({ [`flags.${MOD_F}.defendingSieges`]: defendingSieges });
      }
    }

    // Improvement ledger
    await _appendImprovement(hexDoc, {
      turn: state.startedTurn,
      kind: "siege_started",
      label: `Siege started by ${attackerFactionActor.name}`,
      description: `Size: ${state.sizeProfile}. Layers: ${layers.length}. Depot: ${depotHexUuid}.`,
      source: { siegeId: state.siegeId, factionId: attackerId, activity: "begin_siege" },
      reversible: false
    });

    // War log
    await _pushWarLog(attackerFactionActor,
      `Begin Siege: ${state.siegeId} on target. Buffer ${bufferStartingTotal} OP committed. Size=${state.sizeProfile}. ${layers.length} layer(s). ${bulwark.applied ? "Bulwark discount applied. " : ""}(Phase B will tick.)`,
      { activityKey: "begin_siege", siegeId: state.siegeId, hexUuid, depotHexUuid }
    );

    // Phase B will register the bbttcc:advanceTurn:end subscriber that re-queues siegeTurnTick.
    Hooks.callAll("bbttcc:siege:begin", { siegeId: state.siegeId, hexUuid, attackerId });

    return { ok: true, siegeId: state.siegeId, state };
  }

  // ============================================================
  // Establish Siege Camp handler
  // ============================================================

  async function handleEstablishSiegeCamp({ attackerFactionActor, hexDoc, hexUuid, noteCfg, S }){
    if (!hexDoc) throw new Error("Establish Siege Camp: target hex not found");

    // Queue "Beached Camp" modifier on the target hex via turn.pending (existing pattern).
    const tf = foundry.utils.duplicate(hexDoc.flags?.[MOD_T] || {});
    const pend = foundry.utils.getProperty(tf, "turn.pending") || {};
    pend.repairs = pend.repairs || {};
    pend.repairs.addModifiers = Array.isArray(pend.repairs.addModifiers) ? pend.repairs.addModifiers.slice() : [];
    if (!pend.repairs.addModifiers.includes("Beached Camp")) {
      pend.repairs.addModifiers.push("Beached Camp");
    }
    await hexDoc.update({ [`flags.${MOD_T}.turn.pending`]: pend }, { parent: hexDoc.parent });

    // Track TTL — this modifier auto-clears on siege resolution (Phase F handler).
    // For Phase A, we record the source attacker so cleanup can find it.
    const camp = {
      establishedBy: attackerFactionActor?.id || null,
      establishedTurn: _currentTurn(),
      ts: Date.now()
    };
    await hexDoc.update({ [`flags.${MOD_T}.beachedCamp`]: camp }, { parent: hexDoc.parent });

    await _pushWarLog(attackerFactionActor,
      `Established Siege Camp on ${hexDoc?.flags?.[MOD_T]?.name || hexDoc?.id}. Hex qualifies as depot for the duration of an active siege.`,
      { activityKey: "establish_siege_camp", hexUuid }
    );

    await _appendImprovement(hexDoc, {
      turn: camp.establishedTurn,
      kind: "siege_camp_established",
      label: `Siege Camp established by ${attackerFactionActor?.name || "attacker"}`,
      description: `+Beached Camp modifier (auto-clears on siege resolution).`,
      source: { factionId: attackerFactionActor?.id, activity: "establish_siege_camp" },
      reversible: true
    });

    return { ok: true };
  }

  // ============================================================
  // Registration into both registries
  // ============================================================

  whenRaidReady((api) => whenSiegeStateReady((S) => {
    const ST = api.STRATEGIC_THROUGHPUT;
    const EFFECTS = api.EFFECTS = api.EFFECTS || {};

    // ---- begin_siege ----
    async function _beginSiegeShared({ factionId, targetUuid, note }){
      const attackerFactionActor = game.actors.get(factionId);
      const hexDoc = await _hexDocFromUuid(targetUuid);
      const noteCfg = _parseSiegeNote(note);
      try {
        return await handleBeginSiege({
          attackerFactionActor, hexDoc, hexUuid: targetUuid, noteCfg, S
        });
      } catch (err) {
        console.error(TAG, "begin_siege failed", err);
        await _pushWarLog(attackerFactionActor, `Begin Siege ERROR: ${err.message}`, { activityKey: "begin_siege" });
        return { ok: false, reason: err.message };
      }
    }

    ST.begin_siege = async function(ctx){
      return _beginSiegeShared({
        factionId: ctx.factionId,
        targetUuid: ctx.targetUuid,
        note: ctx.notes || ctx.note || ""
      });
    };

    EFFECTS.begin_siege = Object.assign({}, EFFECTS.begin_siege, {
      kind: "strategic",
      band: "rare",
      label: "Begin Siege",
      cost: { violence: 30, logistics: 20, economy: 10 },
      siegeRequiresTarget: true,
      siegeSizePicker: true,
      async apply({ entry }){
        const r = await _beginSiegeShared({
          factionId: entry?.attackerId,
          targetUuid: entry?.targetUuid,
          note: entry?.note || ""
        });
        return r.ok
          ? `Begin Siege: ${r.siegeId} established.`
          : `Begin Siege failed: ${r.reason}`;
      }
    });

    // ---- establish_siege_camp ----
    async function _establishCampShared({ factionId, targetUuid, note }){
      const attackerFactionActor = game.actors.get(factionId);
      const hexDoc = await _hexDocFromUuid(targetUuid);
      const noteCfg = _parseSiegeNote(note);
      try {
        return await handleEstablishSiegeCamp({
          attackerFactionActor, hexDoc, hexUuid: targetUuid, noteCfg, S
        });
      } catch (err) {
        console.error(TAG, "establish_siege_camp failed", err);
        await _pushWarLog(attackerFactionActor, `Establish Siege Camp ERROR: ${err.message}`, { activityKey: "establish_siege_camp" });
        return { ok: false, reason: err.message };
      }
    }

    ST.establish_siege_camp = async function(ctx){
      return _establishCampShared({
        factionId: ctx.factionId,
        targetUuid: ctx.targetUuid,
        note: ctx.notes || ctx.note || ""
      });
    };

    EFFECTS.establish_siege_camp = Object.assign({}, EFFECTS.establish_siege_camp, {
      kind: "strategic",
      band: "standard",
      label: "Establish Siege Camp",
      cost: { violence: 10, logistics: 20 },
      async apply({ entry }){
        const r = await _establishCampShared({
          factionId: entry?.attackerId,
          targetUuid: entry?.targetUuid,
          note: entry?.note || ""
        });
        return r.ok
          ? "Siege Camp established (Beached Camp queued)."
          : `Establish Siege Camp failed: ${r.reason}`;
      }
    });

    console.log(TAG, "begin_siege + establish_siege_camp handlers registered (STRATEGIC_THROUGHPUT + EFFECTS)");
  }));

  console.log(TAG, "loaded (awaiting raid API)");
})();

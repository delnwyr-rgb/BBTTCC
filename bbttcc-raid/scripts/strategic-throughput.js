// BBTTCC — Strategic Throughput Registry (Alpha Consolidated, beacon + watchdog, deduped)

(() => {
  // ---- BEACON: proves this file executed at least once ----
  globalThis.__bbttcc_strategic_throughput_loaded_v6 = Date.now();
  console.log("[bbttcc-strategic] strategic-throughput.js loaded (v6)", globalThis.__bbttcc_strategic_throughput_loaded_v6);

  const MODF = "bbttcc-factions";
  const MODT = "bbttcc-territory";
  const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];

  function normalizeOPKey(k){
    if(!k) return null;
    const low = String(k).toLowerCase().trim();
    if(low === "softpower" || low === "soft_power") return "softpower";
    if(low === "nonlethal" || low === "non_lethal") return "nonlethal";
    if(OP_KEYS.includes(low)) return low;
    return null;
  }

  function normalizeCost(cost){
    const out = {};
    for(const [k,v] of Object.entries(cost||{})){
      const nk = normalizeOPKey(k);
      if(!nk) continue;
      out[nk] = Math.max(0, Number(v||0));
    }
    return out;
  }

  function pushWarLog(A, summary){
    if (!A) return;
    const wl = Array.isArray(A.getFlag(MODF,"warLogs"))
      ? A.getFlag(MODF,"warLogs").slice()
      : [];
    wl.push({
      ts: Date.now(),
      date: (new Date()).toLocaleString(),
      type: "turn",
      activity: "strategic",
      summary
    });
    return A.update({ [`flags.${MODF}.warLogs`]: wl });
  }

  async function adjustFactionTrack(A,key,delta){
    if (!A) return { before: 0, after: 0 };
    const before = Number(A.getFlag(MODF,key)||0);
    const after  = Math.max(0,Math.min(100,before+delta));
    await A.update({ [`flags.${MODF}.${key}`]: after });
    return {before,after};
  }

  async function adjustHexTrack(hexUuid, track, delta){
    if (!hexUuid) return;
    const ref = await fromUuid(hexUuid);
    const doc = ref?.document ?? ref;
    if(!doc) return;
    const tf = foundry.utils.duplicate(doc.flags?.[MODT]||{});
    const before = Number(tf[track]||0);
    const after = Math.max(0, before + Number(delta||0));
    tf[track] = after;
    await doc.update({ [`flags.${MODT}`]: tf }, { parent: doc.parent });
  }

  async function spendOP(factionId, cost, reason){
    const op = game.bbttcc && game.bbttcc.api && game.bbttcc.api.op;
    if(!op || typeof op.commit !== "function") return false;

    const norm = normalizeCost(cost);
    const deltas = {};
    for(const [k,v] of Object.entries(norm)){
      deltas[k] = -Math.abs(v);
    }
    try { return await op.commit(factionId, deltas, reason||"strategic"); }
    catch (e) { console.warn("[bbttcc-strategic] OP commit failed", e); return false; }
  }

  // For effects that were previously stored under pending.repairs.{add/remove}Modifiers
  async function enqueuePendingRepairs(hexUuid, addMods, removeMods){
    addMods = Array.isArray(addMods) ? addMods : (addMods ? [addMods] : []);
    removeMods = Array.isArray(removeMods) ? removeMods : (removeMods ? [removeMods] : []);

    const ref = await fromUuid(hexUuid);
    const doc = ref?.document ?? ref;
    if(!doc) return;

    const f = foundry.utils.duplicate(doc.flags?.[MODT] || {});
    const pend = foundry.utils.getProperty(f, "turn.pending") || {};

    pend.repairs = pend.repairs || {};
    pend.repairs.addModifiers = Array.isArray(pend.repairs.addModifiers) ? pend.repairs.addModifiers.slice() : [];
    pend.repairs.removeModifiers = Array.isArray(pend.repairs.removeModifiers) ? pend.repairs.removeModifiers.slice() : [];

    for (const m of addMods) if (m && !pend.repairs.addModifiers.includes(m)) pend.repairs.addModifiers.push(m);
    for (const m of removeMods) if (m && !pend.repairs.removeModifiers.includes(m)) pend.repairs.removeModifiers.push(m);

    await doc.update({ [`flags.${MODT}.turn.pending`]: pend });
  }

  function enqueueRequest(req){
    const turnApi = game.bbttcc && game.bbttcc.api && game.bbttcc.api.turn;
    if (!turnApi || typeof turnApi.enqueueRequest !== "function") {
      console.warn("[bbttcc-strategic] enqueueRequest unavailable; turn API missing");
      return null;
    }
    return turnApi.enqueueRequest(req);
  }

  function scheduleFactionOP(A, opDelta, turns){
    if (!A) return;
    turns = Number(turns || 1) || 1;
    const bonuses = foundry.utils.duplicate(A.getFlag(MODF,"bonuses")||{});
    bonuses.scheduled = Array.isArray(bonuses.scheduled) ? bonuses.scheduled : [];
    bonuses.scheduled.push({ turnOffset: turns, opDelta: opDelta || {} });
    return A.update({ [`flags.${MODF}.bonuses`]: bonuses });
  }

  function setNextTurnFlag(A, patch){
    if (!A) return;
    const bonuses = foundry.utils.duplicate(A.getFlag(MODF,"bonuses")||{});
    bonuses.nextTurn = bonuses.nextTurn || {};
    Object.assign(bonuses.nextTurn, patch || {});
    return A.update({ [`flags.${MODF}.bonuses`]: bonuses });
  }

  function incNextTurn(A, key, by){
    by = Number(by || 1) || 1;
    if (!A) return 0;
    const cur = Number(A?.getFlag(MODF,"bonuses")?.nextTurn?.[key] || 0);
    return cur + by;
  }

  // ----------------------------
  // Strategic Throughput (deduped)
  // ----------------------------
  const STRATEGIC_THROUGHPUT = {

    // ===== Canon T1: Harvest Season =====
    async harvest_season(ctx){
      const A = game.actors.get(ctx.factionId);
      await scheduleFactionOP(A, { economy: 1 }, 1);
      await pushWarLog(A,"Harvest Season: +1 Economy next turn.");
    },

    // ===== Canon T1: Ration Distribution =====
    async ration_distribution(ctx){
      const A = game.actors.get(ctx.factionId);
      if(ctx.targetUuid){
        await adjustHexTrack(ctx.targetUuid,"loyalty",+1);
        await pushWarLog(A,"Ration Distribution: Loyalty +1 (target hex).");
      }
    },

    // ===== Canon T1: Minor Repair =====
    async minor_repair(ctx){
      const A = game.actors.get(ctx.factionId);
      await enqueueRequest({
        key:"repairs",
        factionId: A?.id || ctx.factionId,
        value:{ hexUuid:ctx.targetUuid, tag:"Damaged Infrastructure" }
      });
      await pushWarLog(A,"Minor Repair: Repair queued (remove Damaged Infrastructure).");
    },

    // ===== Canon T1: Charity Drive =====
    async charity_drive(ctx){
      const A = game.actors.get(ctx.factionId);
      const r = await adjustFactionTrack(A,"darkness",-1);
      await pushWarLog(A,`Charity Drive: Darkness ${r.before} → ${r.after}.`);
    },

    // ===== Canon T1: Civic Audit =====
    async civic_audit(ctx){
      const A = game.actors.get(ctx.factionId);
      const r = await adjustFactionTrack(A,"loyalty",+1);
      await pushWarLog(A,`Civic Audit: Loyalty ${r.before} → ${r.after}.`);
    },

    // ===== Canon T1: Recon Sweep =====
    async recon_sweep(ctx){
      const A = game.actors.get(ctx.factionId);
      await setNextTurnFlag(A, { reconSweep: incNextTurn(A, "reconSweep", 1) });
      await pushWarLog(A,"Recon Sweep: Intel boon queued (reveal 1 adjacent hex alignment — GM adjudicates until territory reveal API is wired).");
    },

    // ===== Canon T1: Border Patrol =====
    async border_patrol(ctx){
      const A = game.actors.get(ctx.factionId);
      await setNextTurnFlag(A, { borderPatrol: incNextTurn(A, "borderPatrol", 1) });
      await pushWarLog(A,"Border Patrol: Infiltration-prevention boon queued for next turn.");
    },

    // ===== Canon T1: Local Festival =====
    async local_festival(ctx){
      const A = game.actors.get(ctx.factionId);
      const r = await adjustFactionTrack(A,"unity",+1);
      await pushWarLog(A,`Local Festival: Unity (Empathy) ${r.before} → ${r.after}.`);
    },

    // ===== Canon T1: Training Parade =====
    async training_parade(ctx){
      const A = game.actors.get(ctx.factionId);
      const cur = Number(A?.getFlag(MODF,"bonuses")?.nextTurn?.moraleBonus || 0);
      await setNextTurnFlag(A, { moraleBonus: cur + 1 });
      await pushWarLog(A,"Training Parade: +1 Morale next raid.");
    },

    // ===== Canon T1: Pilgrimage Route =====
    async pilgrimage_route(ctx){
      const A = game.actors.get(ctx.factionId);
      await scheduleFactionOP(A, { faith: 1 }, 1);
      if (ctx.targetUuid) await adjustHexTrack(ctx.targetUuid,"loyalty",+1);
      await pushWarLog(A,"Pilgrimage Route: +1 Faith next turn; +1 Loyalty to target hex.");
    },

    // ===== Canon T2: Mass Mobilization =====
    async mass_mobilization(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      const flags = foundry.utils.duplicate(A.flags?.[MODF] || {});
      const pend  = flags.turn?.pending || {};
      pend.nextTurn = Object.assign({}, pend.nextTurn, {
        initiativeAdv: true,
        freeManeuver:  true
      });

      await A.update({ [`flags.${MODF}.turn.pending`]: pend }, { diff:true, recursive:true });
      await pushWarLog(A, "Mass Mobilization: Queued next-turn initiative advantage and a free maneuver.");
    },

    // ===== Canon T2: Propaganda Tour =====
    async propaganda_tour(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!ctx.targetUuid) {
        await pushWarLog(A, "Propaganda Tour: No target hex.");
        return;
      }

      await enqueuePendingRepairs(ctx.targetUuid, ["Propaganda"], []);
      await adjustHexTrack(ctx.targetUuid, "morale", +2);
      await adjustHexTrack(ctx.targetUuid, "loyalty", +1);

      await pushWarLog(A, 'Propaganda Tour: +Propaganda; +2 Morale, +1 Loyalty (target hex).');
    },

    // Optional legacy alias
    async propaganda_campaign(ctx){ return this.propaganda_tour(ctx); },

    // ===== Canon T2: Psych Ops Broadcast =====
    async psych_ops_broadcast(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!ctx.targetUuid) {
        await pushWarLog(A, "Psych Ops Broadcast: No target hex.");
        return;
      }

      await enqueuePendingRepairs(ctx.targetUuid, ["Propaganda"], []);
      await adjustHexTrack(ctx.targetUuid, "morale", +2);
      await adjustHexTrack(ctx.targetUuid, "loyalty", +1);

      await pushWarLog(A, 'Psych Ops Broadcast: +Propaganda; +2 Morale, +1 Loyalty (target hex).');
    },

    // ===== Canon T2: Peace Accords =====
    async peace_accords(ctx){
      const A = game.actors.get(ctx.factionId);

      if (ctx.targetUuid) {
        await adjustHexTrack(ctx.targetUuid, "morale", +1);
        await adjustHexTrack(ctx.targetUuid, "loyalty", +1);
      }

      const r = await adjustFactionTrack(A, "unity", +1);
      await pushWarLog(A, `Peace Accords: Unity ${r.before} → ${r.after}${ctx.targetUuid ? "; +1 Morale/+1 Loyalty to target hex." : "."}`);
    },

    // ===== Canon T2: Resource Expropriation =====
    async resource_expropriation(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await scheduleFactionOP(A, { economy: 1 }, 1);
      if (ctx.targetUuid) await adjustHexTrack(ctx.targetUuid, "loyalty", -1);

      await pushWarLog(A, `Resource Expropriation: +1 Economy next turn${ctx.targetUuid ? "; Loyalty -1 to target hex." : "."}`);
    },

    // ===== Canon T2: Reconstruction Drive =====
    async reconstruction_drive(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!ctx.targetUuid) {
        await pushWarLog(A, "Reconstruction Drive: No target hex.");
        return;
      }

      await enqueuePendingRepairs(ctx.targetUuid, ["Well-Maintained"], ["Damaged Infrastructure"]);
      await adjustHexTrack(ctx.targetUuid, "defense", +2);
      await adjustHexTrack(ctx.targetUuid, "tradeYield", +5);

      await pushWarLog(A, "Reconstruction Drive: -Damaged Infrastructure, +Well-Maintained; +2 Defense, +5 Trade Yield.");
    },

    // ===== Canon: Training Drills =====
    async training_drills(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await setNextTurnFlag(A, { moraleBonus: incNextTurn(A, "moraleBonus", 1) });
      await pushWarLog(A, "Training Drills: +1 Morale next raid.");
    },

    // ============================================================
    // Default migrations already in place
    // ============================================================

    async smuggling_network(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await scheduleFactionOP(A, { economy: 1, intrigue: 1 }, 1);
      const r = await adjustFactionTrack(A, "darkness", +1);

      await pushWarLog(A, `Smuggling Network: +1 Economy and +1 Intrigue next turn; Darkness ${r.before} → ${r.after}.`);
    },

    async siege_logistics_overhaul(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await scheduleFactionOP(A, { logistics: 2, economy: 1 }, 1);
      await pushWarLog(A, "Siege Logistics Overhaul: +2 Logistics and +1 Economy next turn.");
    },

    async industrial_revolution(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await scheduleFactionOP(A, { economy: 2, logistics: 1 }, 1);
      if (ctx.targetUuid) await adjustHexTrack(ctx.targetUuid, "loyalty", -1);

      await pushWarLog(A, `Industrial Revolution: +2 Economy and +1 Logistics next turn${ctx.targetUuid ? "; Loyalty -1 to target hex (disruption)." : "."}`);
    },

    // ============================================================
    // BUCKET A — Diplomacy / Council
    // ============================================================

    async alliance_summit(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await setNextTurnFlag(A, {
        allianceSummit: incNextTurn(A, "allianceSummit", 1),
        mergeResources: true
      });

      const r = await adjustFactionTrack(A, "unity", +1);
      await pushWarLog(A, `Alliance Summit: Resource-merge boon queued for next strategic turn; Unity ${r.before} → ${r.after}.`);
    },

    async crisis_summit(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      const r1 = await adjustFactionTrack(A, "unity", +1);
      const r2 = await adjustFactionTrack(A, "morale", +1);

      await setNextTurnFlag(A, { crisisSummit: incNextTurn(A, "crisisSummit", 1) });

      await pushWarLog(A, `Crisis Summit: Unity ${r1.before} → ${r1.after}; Morale ${r2.before} → ${r2.after}.`);
    },

    async cultural_exchange(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await setNextTurnFlag(A, {
        culturalExchange: incNextTurn(A, "culturalExchange", 1),
        culturalExchangeHex: ctx.targetUuid || null
      });

      const r = await adjustFactionTrack(A, "unity", +1);
      await pushWarLog(A, `Cultural Exchange: Shared-alignment boon queued${ctx.targetUuid ? " (anchor hex set)" : ""}; Unity ${r.before} → ${r.after}.`);
    },

    async justice_tribunal(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      const d = await adjustFactionTrack(A, "darkness", -1);
      const u = await adjustFactionTrack(A, "unity", +1);

      await pushWarLog(A, `Justice Tribunal: Darkness ${d.before} → ${d.after}; Unity (Empathy) ${u.before} → ${u.after}.`);
    },

    async world_reformation_council(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      const u = await adjustFactionTrack(A, "unity", +2);
      const d = await adjustFactionTrack(A, "darkness", -1);

      await setNextTurnFlag(A, { worldReformationCouncil: incNextTurn(A, "worldReformationCouncil", 1) });

      await pushWarLog(A, `World Reformation Council: Unity ${u.before} → ${u.after}; Darkness ${d.before} → ${d.after}.`);
    },

    async enlightenment_congress(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await setNextTurnFlag(A, { enlightenmentCongress: incNextTurn(A, "enlightenmentCongress", 1) });
      const u = await adjustFactionTrack(A, "unity", +1);

      await pushWarLog(A, `Enlightenment Congress: Enlightenment+1 boon queued for roster; Unity ${u.before} → ${u.after}.`);
    },

    // ============================================================
    // PASS 1 DEFAULTS — Remaining 14 (to hit 40/40)
    // ============================================================

    // --- Shadow Ops defaults ---

    async spy_insertion(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await setNextTurnFlag(A, {
        spyInsertion: incNextTurn(A, "spyInsertion", 1),
        infiltrationAdv: incNextTurn(A, "infiltrationAdv", 1)
      });

      await pushWarLog(A, "Spy Insertion: nextTurn.spyInsertion=1, nextTurn.infiltrationAdv=1. (STUB: pending engine consult)");
    },

    async oblivion_protocol(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await setNextTurnFlag(A, { oblivionProtocol: incNextTurn(A, "oblivionProtocol", 1) });
      const d = await adjustFactionTrack(A, "darkness", +1);

      await pushWarLog(A, `Oblivion Protocol: nextTurn.oblivionProtocol=1; Darkness ${d.before} → ${d.after}. (STUB: pending engine consult)`);
    },

    async inquisition_mandate(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await setNextTurnFlag(A, { inquisitionMandate: incNextTurn(A, "inquisitionMandate", 1) });

      const u = await adjustFactionTrack(A, "unity", +1);
      const d = await adjustFactionTrack(A, "darkness", +1);

      await pushWarLog(A, `Inquisition Mandate: nextTurn.inquisitionMandate=1; Unity ${u.before} → ${u.after}; Darkness ${d.before} → ${d.after}. (STUB: pending GM/WME resolution)`);
    },

    async dark_harvest(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await scheduleFactionOP(A, { economy: 1, faith: 1 }, 1);
      const d = await adjustFactionTrack(A, "darkness", +1);

      await pushWarLog(A, `Dark Harvest: +1 Economy and +1 Faith next turn; Darkness ${d.before} → ${d.after}. (STUB: pending GM/WME resolution)`);
    },

    // --- Big Magic defaults (stubs) ---

    async great_work_ritual(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await setNextTurnFlag(A, { greatWorkRitual: incNextTurn(A, "greatWorkRitual", 1) });
      const u = await adjustFactionTrack(A, "unity", +1);

      await pushWarLog(A, `Great Work Ritual: nextTurn.greatWorkRitual=1; Unity ${u.before} → ${u.after}. (STUB: pending GM/WME resolution)`);
    },

    async judgment_of_light(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await `0`; // no-op to keep parser happy in older runtimes (safe)
      await setNextTurnFlag(A, { judgmentOfLight: incNextTurn(A, "judgmentOfLight", 1) });
      const d = await adjustFactionTrack(A, "darkness", -1);

      await pushWarLog(A, `Judgment of Light: nextTurn.judgmentOfLight=1; Darkness ${d.before} → ${d.after}. (STUB: pending GM/WME resolution)`);
    },

    async purification_rite(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await setNextTurnFlag(A, { purificationRite: incNextTurn(A, "purificationRite", 1) });
      const d = await adjustFactionTrack(A, "darkness", -1);

      await pushWarLog(A, `Purification Rite: nextTurn.purificationRite=1; Darkness ${d.before} → ${d.after}. (STUB: pending GM/WME resolution)`);
    },

    async project_eden(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await setNextTurnFlag(A, { projectEden: incNextTurn(A, "projectEden", 1) });
      const m = await adjustFactionTrack(A, "morale", +1);

      await pushWarLog(A, `Project Eden: nextTurn.projectEden=1; Morale ${m.before} → ${m.after}. (STUB: pending GM/WME resolution)`);
    },

    async terraforming_project(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await setNextTurnFlag(A, { terraformingProject: incNextTurn(A, "terraformingProject", 1) });

      if (ctx.targetUuid) {
        await adjustHexTrack(ctx.targetUuid, "tradeYield", +5);
      }

      await pushWarLog(A, `Terraforming Project: nextTurn.terraformingProject=1${ctx.targetUuid ? "; target hex TradeYield +5." : "."} (STUB: pending GM/WME resolution)`);
    },

    async the_final_weave(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await setNextTurnFlag(A, { finalWeave: incNextTurn(A, "finalWeave", 1) });
      const u = await adjustFactionTrack(A, "unity", +1);
      const d = await adjustFactionTrack(A, "darkness", -1);

      await pushWarLog(A, `The Final Weave: nextTurn.finalWeave=1; Unity ${u.before} → ${u.after}; Darkness ${d.before} → ${d.after}. (STUB: pending GM/WME resolution)`);
    },

    async apocalyptic_weapon_test(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await setNextTurnFlag(A, { apocalypticWeaponTest: incNextTurn(A, "apocalypticWeaponTest", 1) });

      const d = await adjustFactionTrack(A, "darkness", +2);
      const m = await adjustFactionTrack(A, "morale", -1);

      await pushWarLog(A, `Apocalyptic Weapon Test: nextTurn.apocalypticWeaponTest=1; Darkness ${d.before} → ${d.after}; Morale ${m.before} → ${m.after}. (STUB: pending GM/WME resolution)`);
    },

    async dragons_parley(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await setNextTurnFlag(A, { dragonsParley: incNextTurn(A, "dragonsParley", 1) });
      const u = await adjustFactionTrack(A, "unity", +1);

      await pushWarLog(A, `Dragon's Parley: nextTurn.dragonsParley=1; Unity ${u.before} → ${u.after}. (STUB: pending GM/WME resolution)`);
    },

    async sanctum_expansion(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await setNextTurnFlag(A, { sanctumExpansion: incNextTurn(A, "sanctumExpansion", 1) });
      await scheduleFactionOP(A, { faith: 1 }, 1);

      await pushWarLog(A, "Sanctum Expansion: nextTurn.sanctumExpansion=1; +1 Faith next turn. (STUB: pending GM/WME resolution)");
    },

    // courtly_intrigue_council — hook into Courtly engine later; for now just flag + receipt
    async courtly_intrigue_council(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!A) return;

      await setNextTurnFlag(A, { courtlyIntrigueCouncil: incNextTurn(A, "courtlyIntrigueCouncil", 1) });

      await pushWarLog(A, "Courtly Intrigue Council: nextTurn.courtlyIntrigueCouncil=1. (STUB: pending Courtly engine integration)");
    }

    // NOTE: Remaining canon keys like "purification_rite", "project_eden", etc. are above.
  };

  // ----------------------------
  // Audit (supports Foundry Item JSON shape)
  // ----------------------------
  async function auditThroughputWiring(){
    let json = [];
    try {
      const mod = game.modules.get("bbttcc-raid");
      const base =
        (mod && typeof mod.url === "string" && mod.url) ? mod.url :
        (mod && typeof mod.path === "string" && mod.path) ? mod.path :
        "/modules/bbttcc-raid";

      const url = `${String(base).replace(/\/+$/,"")}/data/bbttcc_activities_v1_4.json`;
      const r = await fetch(url, { cache:"no-store" });
      if (r.ok) json = await r.json();
    } catch (e) {
      console.warn("[bbttcc-strategic] audit: failed to load activities JSON", e);
      json = [];
    }

    function deriveKeyFromName(name){
      let s = String(name || "").toLowerCase();
      s = s.replace(/\[[^\]]+\]/g, "");
      s = s.replace(/[’']/g, "");
      s = s.replace(/[^a-z0-9]+/g, "_");
      s = s.replace(/^_+|_+$/g, "");
      return s;
    }

    const keys = Object.keys(STRATEGIC_THROUGHPUT);
    const wired = [];
    const unwired = [];

    for (const it of (Array.isArray(json) ? json : [])) {
      const k =
        it?.activityKey ||
        it?.flags?.bbttcc?.activityKey ||
        it?.flags?.bbttcc?.unlockKey ||
        deriveKeyFromName(it?.name);
      if (!k) continue;
      (keys.includes(k) ? wired : unwired).push(k);
    }

    wired.sort(); unwired.sort();
    return { ts: Date.now(), total: (Array.isArray(json) ? json.length : 0), wired: wired.length, unwired: unwired.length, wiredKeys: wired, unwiredKeys: unwired };
  }

  // Global fallback (cannot be wiped by bbttcc API rebuilds)
  globalThis.__bbttcc_auditStrategicThroughput = auditThroughputWiring;

  function attach(){
    game.bbttcc = game.bbttcc || { api:{} };
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.turn = game.bbttcc.api.turn || {};
    game.bbttcc.api.raid = game.bbttcc.api.raid || {};

    game.bbttcc.api.raid.STRATEGIC_THROUGHPUT = STRATEGIC_THROUGHPUT;
    game.bbttcc.api.raid.auditStrategicThroughput = auditThroughputWiring;

    game.bbttcc.api.auditStrategicThroughput = auditThroughputWiring;
    game.bbttcc.api.turn.auditStrategicThroughput = auditThroughputWiring;
  }

  function boot(){
    attach();

    // Watchdog: if some other file overwrites bbttcc/api later, reattach until stable.
    let stable = 0;
    const maxStable = 8;
    const maxMs = 60_000;
    const start = Date.now();

    const t = setInterval(() => {
      try {
        const ok =
          !!(game.bbttcc && game.bbttcc.api &&
             typeof game.bbttcc.api.auditStrategicThroughput === "function" &&
             game.bbttcc.api.raid &&
             typeof game.bbttcc.api.raid.auditStrategicThroughput === "function");

        if (!ok) { stable = 0; attach(); }
        else stable++;

        if (stable >= maxStable) {
          clearInterval(t);
          console.log("[bbttcc-strategic] audit is stable; watchdog stopped.");
        }

        if ((Date.now() - start) > maxMs) {
          clearInterval(t);
          console.warn("[bbttcc-strategic] watchdog timeout; leaving global fallback __bbttcc_auditStrategicThroughput available.");
        }
      } catch (e) {
        stable = 0;
        try { attach(); } catch (_) {}
      }
    }, 1000);
  }

  Hooks.once("init", boot);
  Hooks.once("ready", boot);
  if (game.ready) boot();

})();

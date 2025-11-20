// v1.0.0 — Wilderness Development (Establish / Stabilize / Upgrade Outposts & Sites)
//
// Strategic activities for building new hexes in Bad Eden:
//
//   establish_outpost
//     - Create or claim an Outpost hex in an unclaimed/wilderness area.
//     - Seeds integration block so garrison/upkeep & integration engine can work.
//   develop_outpost_stability
//     - Stabilize an outpost: remove Hostile/Unrest, add Patrolled/Infrastructure+,
//       small Loyalty/Morale bumps, +1 integration.progress.
//   upgrade_outpost_settlement
//     - Outpost -> Village (Claimed), adds Well-Maintained, bumps resources,
//       +1 integration.progress.
//   found_site_<type>
//     - Set hex.type & add thematic modifiers (farm/mine/port/temple/research/fortress).
//       +1 integration.progress.
//
// Safe to load after compat-bridge.js. Extends raid.EFFECTS.

(() => {
  const MOD_R = "bbttcc-raid";
  const MOD_T = "bbttcc-territory";
  const MOD_F = "bbttcc-factions";
  const TAG   = "[bbttcc/wilderness]";

  function whenRaidReady(cb, tries=0){
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api;
      if (api?.EFFECTS) return cb(api);
      if (tries > 60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb, tries+1), 250);
    };
    if (game?.ready) go(); else Hooks.on("ready", go);
  }

  function ensure(obj, path, defVal){
    if (!obj) return defVal;
    const parts = path.split(".");
    let cur = obj;
    for (let i=0;i<parts.length;i++){
      const k = parts[i];
      if (!(k in cur) || cur[k] === undefined || cur[k] === null) cur[k] = {};
      if (i === parts.length-1 && defVal !== undefined && typeof cur[k] !== "object") {
        cur[k] = defVal;
      }
      cur = cur[k];
    }
    return cur;
  }
  const copy = (o)=>foundry.utils.duplicate(o||{});

  async function getHexDocumentFromEntry(entry){
    if (!entry?.targetUuid) return null;
    const ref = await fromUuid(entry.targetUuid).catch(()=>null);
    if (!ref) return null;
    return ref.document ?? ref;
  }

  function getTerrainCostForHex(doc){
    const tf = doc.flags?.[MOD_T];
    if (!tf) return {};
    const terrain = (tf.terrain?.key || tf.terrain || "").toLowerCase();
    const travelApi = game.bbttcc?.api?.travel;
    if (!travelApi || !travelApi.__terrain) return {};
    const spec = travelApi.__terrain[terrain] || {};
    return copy(spec.cost || {});
  }

  function integrationFor(hexFlags){
    const f = copy(hexFlags || {});
    const integ = f.integration || {};
    if (!integ.outcomeKey) integ.outcomeKey = "wilderness_foundation";
    if (!integ.tier)       integ.tier       = "founding";
    if (!integ.appliedAt)  integ.appliedAt  = Date.now();
    if (!("spec" in integ)) integ.spec = {};
    if (!("garrisonEase" in integ.spec))    integ.spec.garrisonEase = "easy";
    if (!("integrationCostMult" in integ.spec)) integ.spec.integrationCostMult = 0.8;
    if (typeof integ.progress !== "number") integ.progress = 0;
    if (!("lastTurnProcessed" in integ))    integ.lastProcessedAt = null;
    f.integration = integ;
    return f;
  }

  async function queueHexUpdate(doc, mutFn){
    const f = copy(doc.flags?.[MOD_T] || {});
    const before = copy(f);
    const changed = await Promise.resolve(mutFn(f, before));
    if (changed === false) return "No changes.";
    await doc.update({ [`flags.${MOD_T}`]: f });
    return "Updated hex.";
  }

  function bumpIntegrationProgress(f, amt=1){
    const integ = integrationFor(f).integration;
    integ.progress = Number(integ.progress || 0) + Number(amt || 0);
    f.integration = integ;
  }

  whenRaidReady((api)=>{
    const EFFECTS = api.EFFECTS || {};
    // -----------------------------------------------------------------------
    // 1) Establish Outpost
    // -----------------------------------------------------------------------
    EFFECTS.establish_outpost = Object.assign({}, EFFECTS.establish_outpost, {
      kind:  "strategic",
      band:  "standard",
      label: EFFECTS.establish_outpost?.label || "Establish Outpost",
      cost:  EFFECTS.establish_outpost?.cost  || { economy:2, logistics:1 }, // terrain cost added dynamically
      description: EFFECTS.establish_outpost?.description || "Plant a flag and found a new outpost in an unclaimed hex.",
      async apply({ actor, entry }){
        const A = actor;
        if (!A) return "No faction actor.";
        if (!entry?.targetUuid) return "No target selected — pick a wilderness hex.";

        let doc = await getHexDocumentFromEntry(entry);
        if (!doc){
          return "Target is not a valid Drawing/Tile/Token.";
        }
        const parent = doc.parent ?? canvas?.scene;

        let f = copy(doc.flags?.[MOD_T] || {});
        const alreadyOwned = !!(f.factionId || f.ownerId);
        if (alreadyOwned) {
          return "Target hex is already owned.";
        }

        // seed basic territory flags
        f.isHex      = true;
        f.kind       = "territory-hex";
        f.status     = "occupied";
        f.size       = f.size || "outpost";
        f.type       = f.type || "wilderness";
        f.modifiers  = Array.isArray(f.modifiers) ? f.modifiers.slice() : [];
        f.conditions = Array.isArray(f.conditions) ? f.conditions.slice() : [];
        f.population = f.population || "small";
        f.factionId  = String(A.id);

        bumpIntegrationProgress(f, 1);

        await doc.update({ [`flags.${MOD_T}`]: f }, parent ? { parent } : {});
        const travelCost = getTerrainCostForHex(doc);
        const extraEcon = Number(travelCost.economy || 0);
        const extraNonL = Number(travelCost.nonlethal || 0);
        const spent = [];
        const raidApi = game.bbttcc?.api?.raid || game.modules.get(MOD_R)?.api;
        if (raidApi?.spendOP){
          if (extraEcon) { await raidApi.spendOP({ actor: A, type:"economy", amount: extraEcon }); spent.push(`+${extraEcon} ⓔ terrain`); }
          if (extraNonL){ await raidApi.spendOP({ actor: A, type:"nonlethal", amount: extraNonL }); spent.push(`+${extraNonL} ☮ terrain`); }
        }

        const msgParts = [
          "Outpost founded (status: Occupied, size: Outpost).",
          extraEcon || extraNonL ? `Terrain cost applied (${spent.join(", ")})` : "",
          "Integration progress +1 (wilderness foundation)."
        ].filter(Boolean);

        console.log(TAG, "establish_outpost", { faction: A.name, hex: doc.name||doc.id, flags:f });
        return msgParts.join(" • ");
      }
    });

    // -----------------------------------------------------------------------
    // 2) Develop Outpost Stability
    // -----------------------------------------------------------------------
    EFFECTS.develop_outpost_stability = Object.assign({}, EFFECTS.develop_outpost_stability, {
      kind:  "strategic",
      band:  "standard",
      label: EFFECTS.develop_outpost_stability?.label || "Develop Outpost (Stability)",
      cost:  EFFECTS.develop_outpost_stability?.cost  || { softpower:2, nonlethal:1 },
      description: EFFECTS.develop_outpost_stability?.description || "Stabilize a young outpost: clear hazards, patrol, and build trust.",
      async apply({ actor, entry }){
        if (!entry?.targetUuid) return "No target selected.";
        const doc = await getHexDocumentFromEntry(entry);
        if (!doc) return "Target is not a valid hex Drawing/Tile.";

        let msg = "";
        await queueHexUpdate(doc, (f)=>{
          const mods = Array.isArray(f.modifiers) ? f.modifiers.slice() : [];
          const conds = Array.isArray(f.conditions) ? f.conditions.slice() : [];

          const beforeMods = mods.slice();
          const beforeConds = conds.slice();
          const pend = ensure(f, "turn.pending", {});
          pend.repairs = pend.repairs || {};

          // remove hostile/unrest-style flags
          pend.repairs.removeModifiers = Array.isArray(pend.repairs.removeModifiers)
            ? pend.repairs.removeModifiers.slice()
            : [];
          ["Hostile Population","Propaganda","Damaged Infrastructure"].forEach(tag=>{
            if (!pend.repairs.removeModifiers.includes(tag)) pend.repairs.removeModifiers.push(tag);
          });

          // add stability tags
          pend.repairs.addModifiers = Array.isArray(pend.repairs.addModifiers)
            ? pend.repairs.addModifiers.slice()
            : [];
          ["Patrolled","Infrastructure+"].forEach(tag=>{
            if (!pend.repairs.addModifiers.includes(tag)) pend.repairs.addModifiers.push(tag);
          });

          // bump goodwill
          pend.loyaltyDelta = Number(pend.loyaltyDelta || 0) + 1;
          pend.moraleDelta  = Number(pend.moraleDelta  || 0) + 1;

          bumpIntegrationProgress(f, 1);

          f.turn = f.turn || {};
          f.turn.pending = pend;
          return true;
        });

        msg = 'Stability program queued: -Hostile/Propaganda/Damage • +Patrolled/Infrastructure+ • +1 Loyalty, +1 Morale • Integration +1';
        console.log(TAG, "develop_outpost_stability", { actor: actor?.name, target: entry?.targetUuid });
        return msg;
      }
    });

    // -----------------------------------------------------------------------
    // 3) Upgrade Outpost → Settlement
    // -----------------------------------------------------------------------
    EFFECTS.upgrade_outpost_settlement = Object.assign({}, EFFECTS.upgrade_outpost_settlement, {
      kind:  "strategic",
      band:  "standard",
      label: EFFECTS.upgrade_outpost_settlement?.label || "Upgrade Outpost → Settlement",
      cost:  EFFECTS.upgrade_outpost_settlement?.cost  || { economy:3, softpower:2, logistics:2 },
      description: EFFECTS.upgrade_outpost_settlement?.description || "Invest heavily to turn an outpost into a village-scale settlement.",
      async apply({ actor, entry }){
        if (!entry?.targetUuid) return "No target selected.";
        const doc = await getHexDocumentFromEntry(entry);
        if (!doc) return "Target is not a valid hex Drawing/Tile.";

        await queueHexUpdate(doc, (f)=>{
          const status = String(f.status || "").toLowerCase();
          const size   = String(f.size   || "outpost").toLowerCase();

          // Only meaningful if it's an outpost / early-stage hex
          if (size !== "outpost" && size !== "hamlet" && size !== "camp") {
            // still allow progression but don't force revert
          }
          f.size   = "village";
          f.status = "claimed";

          // apply a bit of prosperity
          f.modifiers = Array.isArray(f.modifiers) ? f.modifiers.slice() : [];
          if (!f.modifiers.includes("Well-Maintained")) f.modifiers.push("Well-Maintained");

          f.resources = f.resources || {};
          f.resources.food      = Number(f.resources.food      || 0) + 1;
          f.resources.materials = Number(f.resources.materials || 0) + 1;
          f.resources.trade     = Number(f.resources.trade     || 0) + 1;

          bumpIntegrationProgress(f, 1);

          const pend = ensure(f,"turn.pending",{});
          f.turn = f.turn || {};
          f.turn.pending = pend;
          return true;
        });

        console.log(TAG, "upgrade_outpost_settlement", { actor: actor?.name, target: entry?.targetUuid });
        return "Settlement upgrade queued: size → Village, status → Claimed, +Well-Maintained, +1 Food/Materials/Trade • Integration +1";
      }
    });

    // -----------------------------------------------------------------------
    // 4) Found Site Types (Farm/Mine/Port/Temple/Research/Fortress)
    // -----------------------------------------------------------------------

    const SITE_TYPES = {
      farm: {
        label: "Found Farm",
        cost:  { economy:2, logistics:1 },
        type:  "farm",
        addMods: ["Fertile Land"],
        resDelta: { food:+2 }
      },
      mine: {
        label: "Found Mine",
        cost:  { economy:3, nonlethal:1, logistics:1 },
        type:  "mine",
        addMods: ["Resource Vein"],
        resDelta: { materials:+2 }
      },
      port: {
        label: "Found Port",
        cost:  { economy:3, logistics:1, diplomacy:1 },
        type:  "port",
        addMods: ["Trade Hub"],
        resDelta: { trade:+2 }
      },
      temple: {
        label: "Found Temple",
        cost:  { faith:2, softpower:2, culture:1 },
        type:  "temple",
        addMods: ["Holy Ground"],
        resDelta: { knowledge:+1, culture:+1 }
      },
      research: {
        label: "Found Research Site",
        cost:  { intrigue:2, softpower:2, economy:1 },
        type:  "research",
        addMods: ["Arcane Node"],
        resDelta: { knowledge:+2 }
      },
      fortress: {
        label: "Found Fortress",
        cost:  { violence:2, logistics:2, economy:1 },
        type:  "fortress",
        addMods: ["Fortified"],
        resDelta: { military:+2 }
      }
    };

    for (const [key, spec] of Object.entries(SITE_TYPES)) {
      const effKey = `found_site_${key}`;
      EFFECTS[effKey] = Object.assign({}, EFFECTS[effKey], {
        kind:  "strategic",
        band:  "standard",
        label: EFFECTS[effKey]?.label || spec.label,
        cost:  EFFECTS[effKey]?.cost  || copy(spec.cost),
        description: EFFECTS[effKey]?.description || `Found a new ${key} site at a developed settlement.`,
        async apply({ actor, entry }){
          if (!entry?.targetUuid) return "No target selected.";
          const doc = await getHexDocumentFromEntry(entry);
          if (!doc) return "Target is not a valid hex Drawing/Tile.";

          await queueHexUpdate(doc, (f)=>{
            const status = String(f.status || "").toLowerCase();
            if (status !== "claimed" && status !== "occupied" && status !== "contested") {
              // allow but warn in message
            }

            f.type = spec.type;
            f.modifiers = Array.isArray(f.modifiers) ? f.modifiers.slice() : [];
            for (const m of spec.addMods || []) {
              if (!f.modifiers.includes(m)) f.modifiers.push(m);
            }

            f.resources = f.resources || {};
            for (const [rk,val] of Object.entries(spec.resDelta || {})) {
              f[rk] = Number(f[rk] || f.resources[rk] || 0) + Number(val||0);
              f.resources[rk] = f[rk];
            }

            bumpIntegrationProgress(f, 1);

            const pend = ensure(f,"turn.pending",{});
            f.turn = f.turn || {};
            f.turn.pending = pend;
            return true;
          });

          console.log(TAG, effKey, { actor: actor?.name, target: entry?.targetUuid, type: spec.type });
          return `${spec.label} queued: type → ${spec.type}, modifiers: ${spec.addMods.join(", ")} • resources adjusted • Integration +1`;
        }
      });
    }

    console.log(TAG, "Wilderness development effects installed:", Object.keys(SITE_TYPES));
  });
})();

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
    // Integration is a 0–6 track everywhere else (territory-integration,
    // effects-integration-activities, epic repair all clamp). This was the one
    // writer that didn't — Allesh-Gilliam read 7/6 after a second founding
    // activity (live-caught 2026-09-08).
    integ.progress = Math.max(0, Math.min(6, Number(integ.progress || 0) + Number(amt || 0)));
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
      cost:  EFFECTS.establish_outpost?.cost  || { economy:20, logistics:10 }, // terrain cost added dynamically
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
      // SIM-BADEDEN tuning 2026-06-05 (owner call): softpower/nonlethal have NO
      // income source anywhere (regen map covers 5 of 9 buckets) — pricing the
      // settle-the-frontier action in dead currencies made integration
      // mathematically impossible (74/74 refusals in Run I). "Build trust" is
      // diplomats' work: re-denominated into the buckets factions actually earn.
      cost:  EFFECTS.develop_outpost_stability?.cost  || { diplomacy:20, economy:10 },
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
      cost:  EFFECTS.upgrade_outpost_settlement?.cost  || { economy:30, softpower:20, logistics:20 },
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
        cost:  { economy:20, logistics:10 },
        type:  "farm",
        addMods: ["Fertile Land"],
        resDelta: { food:+2 }
      },
      mine: {
        label: "Found Mine",
        cost:  { economy:30, nonlethal:10, logistics:10 },
        type:  "mine",
        addMods: ["Resource Vein"],
        resDelta: { materials:+2 }
      },
      port: {
        label: "Found Port",
        cost:  { economy:30, logistics:10, diplomacy:10 },
        type:  "port",
        addMods: ["Trade Hub"],
        resDelta: { trade:+2 }
      },
      temple: {
        label: "Found Temple",
        cost:  { faith:20, softpower:20, culture:10 },
        type:  "temple",
        addMods: ["Holy Ground"],
        resDelta: { knowledge:+1, culture:+1 }
      },
      research: {
        label: "Found Research Site",
        cost:  { intrigue:20, softpower:20, economy:10 },
        type:  "research",
        addMods: ["Arcane Node"],
        resDelta: { knowledge:+2 }
      },
      fortress: {
        label: "Found Fortress",
        cost:  { violence:20, logistics:20, economy:10 },
        type:  "fortress",
        addMods: ["Fortified"],
        resDelta: { military:+2 }
      }
    };

    // Found Site gives a FRESH hex its identity — an outpost or village that is
    // still generic. A hex has exactly one `type` (Townbuilder ruling 2026-07-15:
    // ~25 call sites; a second establishment ships as a DISTRICT at City size,
    // never as a type change). Run against Allesh-Gilliam on 2026-09-08 this
    // overwrote the town's type with "farm" — the town's yields, menu and
    // upkeep table all switched. Refuse established settlements and point at
    // Townbuilder → Found District instead.
    const ESTABLISHED_SIZES = new Set(["town", "city", "metropolis", "megalopolis"]);
    const SITE_TYPE_KEYS = new Set([...Object.keys(SITE_TYPES), "factory"]);
    function foundSiteBlock(f, spec, hexName){
      const type = String(f?.type || "").toLowerCase();
      const size = String(f?.size || "").toLowerCase();
      const built = Array.isArray(f?.settlement?.assets) && f.settlement.assets.length > 0;
      const name = hexName || f?.name || "This hex";
      const hint = `To add a ${spec.type} here, open the Hex Sheet → Townbuilder → 🏛️ Found District (district slots unlock at City size).`;
      if (type === spec.type) return `${name} already is a ${spec.type}.`;
      if (ESTABLISHED_SIZES.has(size)) return `${name} is already an established ${size}${type ? ` (${type})` : ""}. ${spec.label} gives a fresh outpost or village its identity. ${hint}`;
      if (SITE_TYPE_KEYS.has(type)) return `${name} is already a ${type} — a hex has one identity. ${hint}`;
      if (built) return `${name} already has buildings raised on it — its identity is set. ${hint}`;
      return null;
    }

    for (const [key, spec] of Object.entries(SITE_TYPES)) {
      const effKey = `found_site_${key}`;
      EFFECTS[effKey] = Object.assign({}, EFFECTS[effKey], {
        kind:  "strategic",
        band:  "standard",
        label: EFFECTS[effKey]?.label || spec.label,
        cost:  EFFECTS[effKey]?.cost  || copy(spec.cost),
        description: EFFECTS[effKey]?.description || `Give a fresh outpost or village its identity as a ${key}: sets the hex type, adds ${(spec.addMods || []).join(", ")}, and shifts its yields. Established towns keep their type — add a ${key} DISTRICT through the Townbuilder instead.`,
        // Plan-time refusal (raid-planner planActivity honours canPlan) — no OP moves.
        async canPlan({ targetFlags, targetDoc }){
          const why = foundSiteBlock(targetFlags || targetDoc?.flags?.[MOD_T] || {}, spec, targetFlags?.name);
          return why ? { ok:false, reason: why } : { ok:true };
        },
        async apply({ actor, entry }){
          if (!entry?.targetUuid) return "No target selected.";
          const doc = await getHexDocumentFromEntry(entry);
          if (!doc) return "Target is not a valid hex Drawing/Tile.";

          // Belt and braces for entries planned before the canPlan gate existed.
          // OP was paid at resolution — the Strategic Activity Ledger's ↩ Back out refunds it.
          const blockWhy = foundSiteBlock(doc.flags?.[MOD_T] || {}, spec, entry.targetName);
          if (blockWhy) {
            console.warn(TAG, effKey, "refused:", blockWhy);
            return `${spec.label} REFUSED — ${blockWhy} (OP already paid this turn: use ↩ Back out in Hex Config → Strategic Activity History to refund.)`;
          }

          await queueHexUpdate(doc, (f)=>{
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

    // -----------------------------------------------------------------------
    // 5) Found District (owner ruling 2026-09-09 — closes the "no strategic
    //    activity grows a town" gap). One row per district type, delegating to
    //    the Townbuilder (api.territory.townbuilder.foundDistrict), which is the
    //    ONE authority: City+ size, free slot, no duplicate type, and it charges
    //    BUILD UNITS — so these rows carry NO OP cost (never double-bill).
    // -----------------------------------------------------------------------
    const DISTRICT_LABELS = {
      settlement: "Found Settlement District", fortress: "Found Fortress District", mine: "Found Mining District",
      farm: "Found Farming District", port: "Found Port District", factory: "Found Factory District",
      research: "Found Research District", temple: "Found Temple District"
    };
    const DISTRICT_PRIMARY = { settlement:"softpower", fortress:"violence", mine:"economy", farm:"economy", port:"economy", factory:"logistics", research:"intrigue", temple:"faith" };
    const tb = () => game.bbttcc?.api?.territory?.townbuilder || null;
    function districtBlock(doc, f, type, actor){
      const api = tb();
      if (!api) return "Townbuilder is not loaded on this client.";
      const name = f?.name || "This hex";
      const fid = String(f?.factionId || f?.ownerId || "");
      if (actor && fid && fid !== String(actor.id)) return `${name} is not held by ${actor.name}.`;
      const settlement = api.getSettlement(doc);
      if (!settlement) return `${name} has no buildings yet — districts grow out of a living town. Raise something through the Hex Sheet → Townbuilder first.`;
      const { size, tier } = api.ladderFor(doc);
      const isGM = !!game.user?.isGM;
      if (!tier?.districts && !isGM) return `${name} is a ${size} — district slots unlock at City size (Upgrade the settlement first).`;
      if ((settlement.districts?.length || 0) >= (tier?.districts ?? 0) && !isGM) return `${name} has used all ${tier?.districts ?? 0} district slot(s) at ${size} size.`;
      const hexType = String(f?.type || "").toLowerCase();
      if (type === hexType) return `${name} already IS a ${type} — found a district that adds something new.`;
      if ((settlement.districts || []).some(d => String(d.type).toLowerCase() === type)) return `${name} already has a ${type} district.`;
      return null;
    }
    for (const type of ["settlement","fortress","mine","farm","port","factory","research","temple"]) {
      const effKey = `found_district_${type}`;
      EFFECTS[effKey] = Object.assign({}, EFFECTS[effKey], {
        kind: "strategic",
        band: "standard",
        label: DISTRICT_LABELS[type],
        primaryKey: DISTRICT_PRIMARY[type],
        cost: {}, opCosts: {},
        groupKey: "town_growth", groupLabel: "Town Growth", groupOrder: 6,
        description: `Grow a City-sized settlement you hold with a ${type} district: half of a ${type}'s base yield is added on top of the town's own, and the ${type} building menu opens there. Paid in BUILD UNITS through the Townbuilder (no OP). Needs a free district slot (City 1 · Metropolis 2 · Megalopolis 3) and a different type from the hex itself.`,
        async canPlan({ actor, targetDoc, targetFlags }){
          const why = districtBlock(targetDoc, targetFlags || targetDoc?.flags?.[MOD_T] || {}, type, actor);
          return why ? { ok:false, reason: why } : { ok:true };
        },
        async apply({ actor, entry }){
          if (!entry?.targetUuid) return "No target selected.";
          const doc = await getHexDocumentFromEntry(entry);
          if (!doc) return "Target is not a valid hex Drawing/Tile.";
          const f = doc.flags?.[MOD_T] || {};
          const why = districtBlock(doc, f, type, actor);
          if (why) return `${DISTRICT_LABELS[type]} REFUSED — ${why}`;
          const name = String(entry?.note || "").trim().slice(0, 60) || "";   // the planner's GM note doubles as the district's name
          const res = await tb().foundDistrict({ hexDoc: doc, type, name });
          if (!res?.ok) return `${DISTRICT_LABELS[type]} failed — ${res?.error || "Townbuilder refused"}`;
          const d = res.settlement?.districts?.at?.(-1);
          console.log(TAG, effKey, { actor: actor?.name, target: entry?.targetUuid, district: d });
          return `${DISTRICT_LABELS[type]}: "${d?.name || type}" founded in ${f.name || "the hex"} — the ${type} menu is open there and its yield share starts next turn.`;
        }
      });
    }

    console.log(TAG, "Wilderness development effects installed:", Object.keys(SITE_TYPES), "+ districts");
  });
})();

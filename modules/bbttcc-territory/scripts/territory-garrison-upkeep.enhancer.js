// modules/bbttcc-territory/scripts/territory-garrison-upkeep.enhancer.js
// Bad Eden — Garrison & Upkeep Engine (Phase-based, type-aware)
//
// FULL REPLACEMENT — patched to normalize legacy/resource-style upkeep buckets
// into canonical faction OP bank keys before spending.
//
// Key fix:
//   military -> violence
//   knowledge -> intrigue
//   trade -> diplomacy
//   food -> logistics
//   materials -> economy
//
// This keeps the upkeep tables expressive while ensuring live runtime spends from
// the real opBank schema used by bbttcc-factions/op-engine.js.

(() => {
  const TAG  = "[bbttcc-territory/garrison-upkeep]";
  const MODT = "bbttcc-territory";
  const MODF = "bbttcc-factions";

  // Holdings Phase D (2026-05-14) — Garrison-Holdings coupling.
  // After this many consecutive unpaid-upkeep turns on a hex that has
  // stationed Holdings, the Holdings abandon the hex (rigIds + bossIds
  // cleared). Counter lives at flags.bbttcc-territory.holdingsNeglect.turns
  // and resets to 0 when a fully-paid upkeep is processed. Sibling flag
  // (not under `holdings`) so Phase A's Station/Remove whole-object
  // writes can't accidentally clobber it.
  const _HLD_NEGLECT_THRESHOLD = 3;

  // ------------------------------
  // Canonical upkeep tables
  // ------------------------------

  // Base upkeep vectors per hex "type", in MARKS (1 OP = 10 marks).
  // These are BEFORE phase/outcome/hostility/size multipliers.
  // Half-OP values become 5 marks to preserve granular semantics.
  const BASE_BY_TYPE = {
    fortress:   { military: 10, logistics: 10 },
    port:       { logistics: 10, diplomacy: 5 },
    temple:     { faith: 10, diplomacy: 5 },
    farm:       { logistics: 5, economy: 5 },
    mine:       { economy: 10 },
    research:   { economy: 5, intrigue: 5 },
    settlement: { logistics: 5, diplomacy: 5, economy: 5 },
    city:       { logistics: 10, diplomacy: 10, economy: 10 },
    ruins:      { intrigue: 10, nonlethal: 5, economy: 5 },
    // SIM-BADEDEN tuning 2026-06-05 (owner call): nonlethal has NO income source —
    // the old {economy:5, nonlethal:5} default made every wilderness claim a
    // permanently unpayable bleed (Run I: perma-arrears, claiming frozen).
    // Re-denominated toward diplomacy (the bucket trade keeps filling); a token
    // nonlethal cost remains while unintegrated — pacification still draws on
    // the peace-keepers, but it's survivable until the hex settles.
    default:    { economy: 5, diplomacy: 3, nonlethal: 2 } // fallback
  };

  // Size multipliers.
  const SIZE_MULT = {
    outpost:     0.5,
    village:     0.75,
    town:        1.0,
    city:        1.5,
    metropolis:  2.0,
    megalopolis: 3.0
  };

  const STATUS_MULT = {
    unclaimed: 0,
    contested: 0.75,
    occupied:  1.0,
    claimed:   1.0,
    scorched:  1.0,
    triumphant:1.1
  };

  // Outcome multipliers. Salt-the-earth = 0 upkeep.
  const OUTCOME_MULT = {
    justice_reformation:       0.7,
    liberation:                0.8,
    best_friends_integration:  0.5,
    retribution_subjugation:   1.3,
    salt_the_earth:            0.0
  };

  // Ease multipliers from integration.spec.garrisonEase
  const EASE_MULT = {
    very_easy: 0.7,
    easy:      0.85,
    normal:    1.0,
    hard:      1.2
  };

  // Modifiers → upkeep multipliers
  const MOD_MULT = {
    "Well-Maintained":        0.9,
    "Well Maintained":        0.9,   // tolerate both spellings
    "Fortified":              1.1,
    "Trade Hub":              1.05,
    "Damaged Infrastructure": 1.2,
    "Radiation Zone":         1.3,
    "Cultural Festival":      0.9,
    "Supply Line":            0.95,
    "Logistics Hub":          1.05,
    "Diplomatic Ties":        0.95
  };

  // Conditions → upkeep multipliers
  const COND_MULT = {
    "Radiated":    1.3,
    "Purified":    0.9,
    "Unstable":    1.1,
    "Sanctified":  0.9
  };

  const HOSTILITY_MULT = 1.25;
  const LOYALTY_MULT   = 0.85;

  // Legacy/resource-style buckets → canonical faction OP bank keys
  const OP_BUCKET_ALIAS = {
    military:  "violence",
    violence:  "violence",
    nonlethal: "nonlethal",
    non_lethal:"nonlethal",
    intrigue:  "intrigue",
    knowledge: "intrigue",
    economy:   "economy",
    materials: "economy",
    softpower: "softpower",
    soft_power:"softpower",
    diplomacy: "diplomacy",
    trade:     "diplomacy",
    logistics: "logistics",
    food:      "logistics",
    culture:   "culture",
    faith:     "faith"
  };

  const CANONICAL_OP_KEYS = new Set([
    "violence",
    "nonlethal",
    "intrigue",
    "economy",
    "softpower",
    "diplomacy",
    "logistics",
    "culture",
    "faith"
  ]);

  // ------------------------------
  // Small helpers
  // ------------------------------
  const N     = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const clone = obj => foundry.utils.duplicate(obj ?? {});
  const arr   = v => Array.isArray(v) ? v : (v ? [v] : []);
  const has   = (list, val) => Array.isArray(list) && list.includes(val);

  function gmIds() {
    return game.users?.filter(u => u.isGM).map(u => u.id) ?? [];
  }

  function mergePending(base, delta) {
    const out = clone(base);
    for (const [k, v] of Object.entries(delta || {})) {
      if (typeof v !== "number") continue;
      out[k] = N(out[k] || 0) + N(v);
    }
    return out;
  }

  function normalizeBucketName(bucket) {
    const k = String(bucket || "").trim().toLowerCase();
    return OP_BUCKET_ALIAS[k] || k;
  }

  function normalizeCostVector(vec) {
    const out = {};
    for (const [rawKey, rawVal] of Object.entries(vec || {})) {
      const v = N(rawVal);
      if (v <= 0) continue;
      const key = normalizeBucketName(rawKey);
      out[key] = N(out[key] || 0) + v;
    }
    return out;
  }

  function bankHasKnownShape(bank) {
    const keys = Object.keys(bank || {});
    if (!keys.length) return true;
    return keys.some(k => CANONICAL_OP_KEYS.has(String(k).toLowerCase()));
  }

  // ------------------------------
  // Vector math & base selection
  // ------------------------------

  function baseVectorForType(type) {
    const key = String(type || "settlement").toLowerCase();
    if (BASE_BY_TYPE[key]) return clone(BASE_BY_TYPE[key]);
    // try fuzzy matches
    if (key.includes("fort"))    return clone(BASE_BY_TYPE.fortress);
    if (key.includes("port"))    return clone(BASE_BY_TYPE.port);
    if (key.includes("temple") || key.includes("shrine")) return clone(BASE_BY_TYPE.temple);
    if (key.includes("farm") || key.includes("rural"))    return clone(BASE_BY_TYPE.farm);
    if (key.includes("mine") || key.includes("factory"))  return clone(BASE_BY_TYPE.mine);
    if (key.includes("research") || key.includes("lab"))  return clone(BASE_BY_TYPE.research);
    if (key.includes("ruin"))                             return clone(BASE_BY_TYPE.ruins);
    if (key.includes("city") || key.includes("settle"))   return clone(BASE_BY_TYPE.city);
    return clone(BASE_BY_TYPE.default);
  }

  function scaleVector(vec, mult) {
    const out = {};
    const m = N(mult || 1);
    for (const [k, v] of Object.entries(vec || {})) {
      out[k] = N(v) * m;
    }
    return out;
  }

  function mulVector(vec, mult) {
    return scaleVector(vec, mult);
  }

  function roundVector(vec) {
    const out = {};
    for (const [k, v] of Object.entries(vec || {})) {
      const n = N(v);
      if (Math.abs(n) >= 0.25) out[k] = Math.round(n);
    }
    return out;
  }

  // ------------------------------
  // Phase inference from integration
  // ------------------------------

  function inferPhaseFromIntegration(integ) {
    // integ.phase may already exist (from advance-turn.tracks.js). If so, trust it.
    const phase = String(integ?.phase || "").toLowerCase();
    if (phase === "occupation" || phase === "short_integration" || phase === "full_integration") {
      return phase;
    }
    const prog = N(integ?.progress || 0);
    if (prog >= 6) return "full_integration";
    if (prog >= 3) return "short_integration";
    return "occupation";
  }

  function computeHexUpkeep(tf, integ) {
    // tf = hex.flags[MODT], integ = tf.integration
    const type   = tf.type || tf.kind || "settlement";
    const size   = String(tf.size || "town").toLowerCase();
    const status = String(tf.status || "claimed").toLowerCase();
    const mods   = arr(tf.modifiers);
    const conds  = arr(tf.conditions);

    // 1) Base vector by type
    let vec = baseVectorForType(type);

    // 2) Phase multiplier
    const phase = inferPhaseFromIntegration(integ);
    let phaseMult = 1.0;
    if (phase === "occupation")             phaseMult = 1.5;
    else if (phase === "short_integration") phaseMult = 1.0;
    else if (phase === "full_integration")  phaseMult = 0.3; // baseline; outcome will zero for "good" results

    vec = scaleVector(vec, phaseMult);

    // 3) Outcome multiplier
    const outcomeKey = integ.outcomeKey || integ.outcome || tf.outcomeKey || "";
    const outMult    = OUTCOME_MULT[outcomeKey] ?? 1.0;

    // If salt-the-earth → zero upkeep
    if (outMult === 0) {
      return { vec: {}, phase, outcomeKey };
    }

    // 4) integration.spec multipliers
    const spec      = integ.spec || {};
    const easeMult  = EASE_MULT[String(spec.garrisonEase || "normal")] ?? 1.0;
    const extraMult = N(spec.integrationCostMult || 1.0);

    // 5) Size + status multipliers
    const sizeMult   = SIZE_MULT[size]     ?? 1.0;
    const statusMult = STATUS_MULT[status] ?? 1.0;

    // 6) Modifiers & conditions
    let modMult  = 1.0;
    for (const m of mods) {
      if (MOD_MULT[m]) modMult *= MOD_MULT[m];
    }
    let condMult = 1.0;
    for (const c of conds) {
      if (COND_MULT[c]) condMult *= COND_MULT[c];
    }

    // 7) Hostile/Loyal Pop
    if (has(mods, "Hostile Population")) modMult *= HOSTILITY_MULT;
    if (has(mods, "Loyal Population"))   modMult *= LOYALTY_MULT;

    // 8) Final multipliers (order: phase → outcome → ease/spec → size/status → mods/conds/hostility)
    let totalMult = outMult * easeMult * extraMult * sizeMult * statusMult * modMult * condMult;
    vec = mulVector(vec, totalMult);

    // Edge case: if outcome is "good" but vec is ~0 after all math, don't bother
    if (!Object.keys(roundVector(vec)).length &&
        (outcomeKey === "justice_reformation" ||
         outcomeKey === "liberation" ||
         outcomeKey === "best_friends_integration")) {
      // We still call it, but zero costs.
      return { vec: {}, phase, outcomeKey };
    }

    return { vec, phase, outcomeKey };
  }

  // ------------------------------
  // Spending from opBank (per-faction, per-hex)
  // ------------------------------

  async function runGarrisonUpkeepForFaction(factionActor, hexes) {
    if (!hexes.length) return;

    const A       = factionActor;
    const fFlags  = clone(A.flags?.[MODF] || {});
    let bank      = clone(fFlags.opBank || {});
    let fTurnPending = clone(fFlags.turn?.pending || {});

    if (!bankHasKnownShape(bank)) {
      console.warn(TAG, `Faction ${A.name} has unexpected opBank shape; upkeep normalization may be incomplete.`, bank);
    }

    const warLogs = fFlags.warLogs ?? [];
    const logLines = [];
    let anyUnpaidGlobal = false;

    // morale & loyalty bonus counters from *fully paid* integrated hexes
    let moraleShortCount  = 0;
    let moraleFullCount   = 0;
    let loyaltyShortCount = 0;
    let loyaltyFullCount  = 0;

    // Phase D — aggregate counters so the GM chat card can show a top-line
    // Holdings-attrition status next to the existing morale/loyalty pills.
    let neglectedHexCount = 0;
    let abandonedHexCount = 0;
    let abandonedUnitsTotal = 0;

    // helper to record a hex update
    const hexUpdates = [];

    for (const d of hexes) {
      const tfAll = clone(d.flags?.[MODT] || {});
      const tf    = clone(tfAll);
      const integ = tf.integration;
      if (!integ) continue;

      const { vec, phase, outcomeKey } = computeHexUpkeep(tf, integ);
      const rawCost = roundVector(vec);
      const cost = normalizeCostVector(rawCost);

      const hexName = d.text ?? d.name ?? tf.name ?? d.id;
      if (!Object.keys(cost).length) {
        // Nothing to pay this turn
        continue;
      }

      let unpaidBuckets = {};
      let hasUnpaid = false;

      // pay per normalized bucket from opBank
      for (const [bucket, needRaw] of Object.entries(cost)) {
        let need = N(needRaw);
        if (need <= 0) continue;

        const have = N(bank[bucket] || 0);
        if (have >= need) {
          bank[bucket] = have - need;
        } else {
          bank[bucket] = 0;
          const deficit = need - have;
          unpaidBuckets[bucket] = (unpaidBuckets[bucket] || 0) + deficit;
          hasUnpaid = true;
        }
      }

      // Record war log line + morale/loyalty counters
      const costStr = Object.entries(cost).map(([k,v]) => `${k}:${v}`).join(", ");
      if (!hasUnpaid) {
        logLines.push(`• ${hexName}: Paid garrison upkeep (${phase}) [${costStr}]`);

        // Count for integration morale + loyalty bonus if we're past occupation
        if (phase === "short_integration") {
          moraleShortCount++;
          loyaltyShortCount++;
        } else if (phase === "full_integration") {
          moraleFullCount++;
          loyaltyFullCount++;
        }
      } else {
        const unpaidStr = Object.entries(unpaidBuckets).map(([k,v]) => `${k}:${v}`).join(", ");
        logLines.push(`• ${hexName}: PARTIAL upkeep (${phase}) [paid ${costStr}; unpaid ${unpaidStr}]`);
      }

      if (hasUnpaid) {
        anyUnpaidGlobal = true;

        // Hex-level penalties → queue into turn.pending
        const hexPendBase = clone(tf.turn?.pending || {});
        const hexPendDelta = {
          loyaltyDelta: N(hexPendBase.loyaltyDelta || 0) - 1
        };

        // If outcome is particularly harsh, nudge darkness
        if (outcomeKey === "retribution_subjugation") {
          hexPendDelta.darknessDelta = N(hexPendBase.darknessDelta || 0) + 1;
        }

        const newHexPend = mergePending(hexPendBase, hexPendDelta);
        const newTf = clone(tfAll);
        newTf.turn = newTf.turn || {};
        newTf.turn.pending = newHexPend;

        hexUpdates.push({
          id:   d.id,
          data: { [`flags.${MODT}`]: newTf }
        });

        // Faction-level penalties (morale)
        fTurnPending.moraleDelta = N(fTurnPending.moraleDelta || 0) - 1;
      }

      // Holdings Phase D — neglect tracking + abandonment.
      // Uses targeted update paths so it composes with the penalty write
      // above (Foundry merges adjacent dot-paths into the same Document
      // update). Sibling flag `holdingsNeglect` survives any future Phase A
      // whole-object holdings writes.
      try {
        const holdingsFlag = (tf.holdings && typeof tf.holdings === "object") ? tf.holdings : {};
        const rigIds  = Array.isArray(holdingsFlag.rigIds)  ? holdingsFlag.rigIds  : [];
        const bossIds = Array.isArray(holdingsFlag.bossIds) ? holdingsFlag.bossIds : [];
        const hasHoldings = (rigIds.length + bossIds.length) > 0;
        const neglectFlag = (tf.holdingsNeglect && typeof tf.holdingsNeglect === "object") ? tf.holdingsNeglect : {};
        const prevTurns = N(neglectFlag.turns || 0);

        let neglectPatch = null;
        let holdingsPatch = null;

        if (hasUnpaid && hasHoldings) {
          const nextTurns = prevTurns + 1;
          if (nextTurns >= _HLD_NEGLECT_THRESHOLD) {
            // Abandonment — clear the rosters, retire the neglect counter,
            // stamp abandonedAt so the hex sheet badge can show recency.
            const totalLost = rigIds.length + bossIds.length;
            neglectPatch = {
              turns: 0,
              lastUnpaidAt: Date.now(),
              abandonedAt: Date.now(),
              lastAbandonedCount: totalLost
            };
            holdingsPatch = Object.assign({}, holdingsFlag, {
              rigIds: [],
              bossIds: [],
              lastUpdated: Date.now()
            });
            logLines.push(`• ${hexName}: 💔 HOLDINGS ABANDONED — ${totalLost} unit${totalLost===1?"":"s"} defected after ${_HLD_NEGLECT_THRESHOLD} unpaid upkeep turn${_HLD_NEGLECT_THRESHOLD===1?"":"s"}.`);
            abandonedHexCount++;
            abandonedUnitsTotal += totalLost;
            // Knock morale once more for the loss
            fTurnPending.moraleDelta = N(fTurnPending.moraleDelta || 0) - 1;
          } else {
            neglectPatch = {
              turns: nextTurns,
              lastUnpaidAt: Date.now()
            };
            logLines.push(`• ${hexName}: ⚠ Holdings neglected (${nextTurns}/${_HLD_NEGLECT_THRESHOLD}) — pay next turn or units defect.`);
            neglectedHexCount++;
          }
        } else if (!hasUnpaid && prevTurns > 0) {
          // Upkeep is paid: reset the neglect streak. Preserve abandonedAt
          // for audit history; only zero the counter.
          neglectPatch = { turns: 0 };
          logLines.push(`• ${hexName}: Holdings neglect cleared (was ${prevTurns}).`);
        }

        if (neglectPatch || holdingsPatch) {
          // Merge strategy: if a penalty-branch entry already exists for
          // this hex it carries `data["flags.${MODT}"] = newTf` (whole
          // namespace). Mutate newTf directly so the document.update sees
          // one coherent block. Otherwise add a fresh entry using targeted
          // dot-paths so we don't stomp other Phase A/B keys.
          let entry = hexUpdates.find(u => u.id === d.id);
          const wholeKey = `flags.${MODT}`;
          if (entry && entry.data && entry.data[wholeKey] && typeof entry.data[wholeKey] === "object") {
            const nt = entry.data[wholeKey];
            if (neglectPatch)  nt.holdingsNeglect = Object.assign({}, nt.holdingsNeglect || neglectFlag || {}, neglectPatch);
            if (holdingsPatch) nt.holdings        = holdingsPatch;
          } else {
            if (!entry) { entry = { id: d.id, data: {} }; hexUpdates.push(entry); }
            if (neglectPatch)  entry.data[`flags.${MODT}.holdingsNeglect`] = Object.assign({}, neglectFlag || {}, neglectPatch);
            if (holdingsPatch) entry.data[`flags.${MODT}.holdings`]        = holdingsPatch;
          }
        }
      } catch (eHD) { console.warn(TAG, "Holdings Phase D pass failed for hex", hexName, eHD); }
    }

    // Integration-based morale bonus:
    // each short_integration hex with paid upkeep: +1 morale
    // each full_integration hex with paid upkeep: +2 morale
    const moraleBonus = (moraleShortCount * 1) + (moraleFullCount * 2);
    if (moraleBonus > 0) {
      fTurnPending.moraleDelta = N(fTurnPending.moraleDelta || 0) + moraleBonus;
      logLines.push(
        `• Integration morale bonus: +${moraleBonus} Morale ` +
        `(${moraleShortCount} short-integration, ${moraleFullCount} full-integration hexes with paid upkeep)`
      );
    }

    // Integration-based loyalty stabilization:
    // each short_integration hex with paid upkeep: +1 loyalty
    // each full_integration hex with paid upkeep: +2 loyalty
    const loyaltyBonus = (loyaltyShortCount * 1) + (loyaltyFullCount * 2);
    if (loyaltyBonus > 0) {
      fTurnPending.loyaltyDelta = N(fTurnPending.loyaltyDelta || 0) + loyaltyBonus;
      logLines.push(
        `• Integration loyalty bonus: +${loyaltyBonus} Loyalty ` +
        `(${loyaltyShortCount} short-integration, ${loyaltyFullCount} full-integration hexes with paid upkeep)`
      );
    }

    // Apply faction updates
    const updates = {};
    updates[`flags.${MODF}.opBank`] = bank;
    if (Object.keys(fTurnPending).length) {
      updates[`flags.${MODF}.turn.pending`] = fTurnPending;
    }

    if (Object.keys(updates).length) {
      await A.update(updates);
    }

    // Apply hex updates
    const scene = hexes[0]?.parent;
    if (scene && hexUpdates.length) {
      const drawingUpdates = hexUpdates.map(u => ({
        _id: u.id,
        ...u.data
      }));
      await scene.updateEmbeddedDocuments("Drawing", drawingUpdates);
    }

    // War log + GM card
    if (logLines.length) {
      const entry = {
        ts: Date.now(),
        type: "turn",
        activity: "garrison_upkeep",
        summary: logLines.join(" | "),
        unpaid: anyUnpaidGlobal,
        moraleBonus,
        loyaltyBonus,
        holdingsNeglected: neglectedHexCount,
        holdingsAbandonedHexes: abandonedHexCount,
        holdingsAbandonedUnits: abandonedUnitsTotal
      };
      warLogs.push(entry);
      await A.setFlag(MODF, "warLogs", warLogs);

      const gm = gmIds();
      if (gm.length) {
        const content = `
          <p><b>Garrison Upkeep — ${foundry.utils.escapeHTML(A.name)}</b></p>
          <p>${logLines.join("<br/>")}</p>
          ${anyUnpaidGlobal ? `<p style="color:#b91c1c;"><b>Unpaid upkeep detected.</b> Morale/Loyalty penalties queued.</p>` : ""}
          ${neglectedHexCount > 0 ? `<p style="color:#d97706;"><b>⚠ Holdings neglected:</b> ${neglectedHexCount} hex${neglectedHexCount===1?"":"es"} — pay upkeep next turn or units defect.</p>` : ""}
          ${abandonedHexCount > 0 ? `<p style="color:#b91c1c;"><b>💔 Holdings abandoned:</b> ${abandonedUnitsTotal} unit${abandonedUnitsTotal===1?"":"s"} defected from ${abandonedHexCount} hex${abandonedHexCount===1?"":"es"}.</p>` : ""}
          ${moraleBonus > 0 ? `<p style="color:#15803d;"><b>Integration morale bonus:</b> +${moraleBonus} Morale</p>` : ""}
          ${loyaltyBonus > 0 ? `<p style="color:#15803d;"><b>Integration loyalty bonus:</b> +${loyaltyBonus} Loyalty</p>` : ""}
        `;
        await ChatMessage.create({
          content,
          whisper: gm,
          speaker: { alias: "Bad Eden Garrison" }
        }).catch(() => {});
      }
    }

    console.log(TAG, `Upkeep processed for faction ${A.name}`, {
      opBank: bank,
      anyUnpaidGlobal,
      moraleBonus,
      loyaltyBonus
    });
  }

  async function runGarrisonUpkeep(args = {}) {
    try {
      const byFaction = {};

      for (const sc of game.scenes ?? []) {
        for (const d of sc.drawings ?? []) {
          const tf = d.flags?.[MODT];
          if (!tf) continue;
          if (!tf.isHex && tf.kind !== "territory-hex") continue;

          const owner = tf.factionId || tf.ownerId;
          if (!owner) continue;

          const hasIntegration = !!tf.integration;
          const st = String(tf.status || "").toLowerCase();
          const isConquestState = hasIntegration || st === "contested" || st === "occupied";

          if (!isConquestState) continue;

          byFaction[owner] = byFaction[owner] || [];
          byFaction[owner].push(d);
        }
      }

      const actors = game.actors;
      if (!actors) return;

      for (const [fid, hexes] of Object.entries(byFaction)) {
        const A = actors.get(fid);
        if (!A) continue;
        await runGarrisonUpkeepForFaction(A, hexes);
      }
    } catch (e) {
      console.warn(TAG, "runGarrisonUpkeep failed:", e);
    }
  }

  // ------------------------------
  // Wrap territory.advanceTurn
  // ------------------------------

  Hooks.once("ready", () => {
    const terr = game.bbttcc?.api?.territory;
    if (!terr || typeof terr.advanceTurn !== "function") {
      console.warn(TAG, "territory.advanceTurn not found; garrison upkeep not installed.");
      return;
    }
    if (terr.__bbttccGarrisonWrapped) {
      console.log(TAG, "Garrison & Upkeep wrapper already installed; skipping.");
      return;
    }

    const origAdvanceTurn = terr.advanceTurn.bind(terr);

    terr.advanceTurn = async function wrappedGarrisonAdvanceTurn(args = {}) {
      const res = await origAdvanceTurn(args);

      // Only run upkeep on applied turns
      if (args?.apply) {
        await runGarrisonUpkeep(args);
      }

      return res;
    };

    terr.__bbttccGarrisonWrapped = true;
    console.log(TAG, "Garrison & Upkeep wrapper installed.");
  });

})();

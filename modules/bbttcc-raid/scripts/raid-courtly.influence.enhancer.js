// modules/bbttcc-raid/scripts/raid-courtly.influence.enhancer.js
// BBTTCC — Courtly Intrigue Scenario Engine (Social Combat)
//
// Based on Gap Analysis §5c "Courtly Intrigue (Social Combat)":
// - Each side has Influence HP = 10 + committed Diplomacy OP + (Soft Power OP / 2).
// - Each exchange, each side chooses an action:
//     • Persuade (Diplomacy): 1d20 + Persuasion + (spent Diplomacy OP / 2)
//     • Inspire (Soft Power): 1d20 + Performance + (spent Soft Power OP / 2)
//     • Expose (Intrigue): 1d20 + Deception/Insight + (spent Intrigue OP / 2)
//         - On hit by 6+, apply Scandal (–2 to target rolls next exchange).
//     • Intimidate (Violence aura):
//         1d20 + Intimidation + (Violence OP presence bonus: +1 per 5 current Violence OP, cap +4)
//         - On fail by 5+, backlash: lose 2 Influence HP.
// - Damage: winner deals (margin / 2, round up) to the loser’s Influence HP. HP ≤ 0 = social victory.
//
// API surface (attached to game.bbttcc.api.raid):
//   const court = await game.bbttcc.api.raid.courtly({
//     attackerId,
//     defenderId,
//     atkInitDip, atkInitSoft,
//     defInitDip, defInitSoft,
//     label
//   });
//
//   // Each exchange:
//   await court.step({
//     atkAction, defAction,   // "persuade" | "inspire" | "expose" | "intimidate"
//     atkSpend,  defSpend,    // OP spent from the relevant category
//     atkSkillBonus,          // e.g. Persuasion mod
//     defSkillBonus,
//     note
//   });
//
//   const state = court.getState();
//
// The most recent scenario is also exposed as:
//   game.bbttcc.api.raid._lastCourtly
//
// Safe to load alongside other raid enhancers.

(() => {
  const MOD_R = "bbttcc-raid";
  const MODF  = "bbttcc-factions";
  const TAG   = "[bbttcc-raid/courtly]";

  const clamp = (v,min,max)=>Math.max(min,Math.min(max,Number(v||0)));
  const dup   = (x)=>foundry.utils.duplicate(x||{});
  const gmIds = () => game.users?.filter(u=>u.isGM).map(u=>u.id) ?? [];

  function getFX() {
    return game?.bbttcc?.api?.fx || null;
  }

  // Phase F — Multiplayer VFX relay. Fires the bbttcc:courtly:vfx hook
  // locally + broadcasts the same event to other clients via socket so
  // the VFX renderer (raid-courtly.vfx.js) plays the same effect on every
  // connected player. Mirrors _emitInfilHookRelay from raid-infiltration.
  // Manifest socket flag already set per [[foundry-v13-socket-manifest]].
  function _emitCourtlyVfx(kind, payload = {}) {
    const evt = { kind, ts: Date.now(), ...payload };
    try { Hooks.callAll("bbttcc:courtly:vfx", evt); } catch (_e) {}
    try {
      if (game?.socket?.emit) {
        game.socket.emit(`module.${MOD_R}`, { t: "courtlyHook", hook: "bbttcc:courtly:vfx", payload: evt });
      }
    } catch (_e) {}
  }

  async function playRollFX(ctx = {}) {
    try {
      const fx = getFX();
      if (!fx || typeof fx.playRolls !== "function") return;
      await fx.playRolls({
        raidType: "courtly",
        label: "Courtly Exchange",
        attackerName: ctx.attackerName,
        defenderName: ctx.defenderName,
        attackerTotal: ctx.attackerTotal,
        defenderTotal: ctx.defenderTotal,
        margin: ctx.margin
      });
    } catch (_e) {}
  }

  async function playInfluenceFX(ctx = {}) {
    try {
      const fx = getFX();
      if (!fx || typeof fx.playScenarioShift !== "function") return;
      await fx.playScenarioShift("courtly_exchange", {
        raidType: "courtly",
        outcome: `Influence ${ctx.beforeA}/${ctx.beforeD} → ${ctx.afterA}/${ctx.afterD}`
      }, { raidType: "courtly" });
    } catch (_e) {}
  }


  async function adjustOpBank(actor, key, delta, scenarioLabel="Courtly Intrigue") {
    if (!actor || !key || !delta) return;
    const flags = dup(actor.flags?.[MODF] || {});
    const bank  = dup(flags.opBank || {});
    const k = String(key).toLowerCase();
    bank[k] = clamp((bank[k]||0) + delta, 0, 999);
    flags.opBank = bank;

    const war = Array.isArray(flags.warLogs) ? flags.warLogs.slice() : [];
    const sign = delta > 0 ? "+" : "";
    war.push({
      ts: Date.now(),
      type: "scenario",
      scenario: "courtly",
      summary: `${scenarioLabel}: ${k} ${sign}${delta}`
    });
    flags.warLogs = war;

    await actor.update({ [`flags.${MODF}`]: flags });
  }

  async function sendChat(lines, {title="Courtly Intrigue"}={}) {
    if (!lines.length) return;
    await ChatMessage.create({
      content: `<p><b>${title}</b></p>${lines.join("<br/>")}`,
      whisper: gmIds(),
      speaker: { alias: "BBTTCC Courtly Intrigue" }
    }).catch(()=>{});
  }

  function whenRaidReady(cb, tries=0) {
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api) return cb(api);
      if (tries > 60) return console.warn(TAG, "raid API not ready after timeout");
      setTimeout(() => whenRaidReady(cb, tries+1), 250);
    };
    if (game?.ready) go(); else Hooks.once("ready", go);
  }

  // Survey audit — Diplomatic Envoys (the Social specialist CREW). An ACTIVE Diplomatic Envoys
  // crew on a side softens the court: that side's Expose/Intimidate cost −1 Suspicion (the
  // Covert-Ops-Cell analog — raising tolerance for the obstacle). Name match slash/space-insensitive.
  function _sideHasActiveCrew(actor, crewName) {
    try {
      const ac = actor?.flags?.fourththing?.echoAssets?.activeCrew;
      if (!Array.isArray(ac)) return false;
      const norm = (s) => String(s || "").toLowerCase().replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ").trim();
      const want = norm(crewName);
      return ac.some(n => norm(n) === want);
    } catch { return false; }
  }

  function computeInfluenceHP({ baseCommitDip=0, baseCommitSoft=0 }) {
    return Math.max(
      1,
      10 + Math.floor(Number(baseCommitDip||0)) + Math.floor(Number(baseCommitSoft||0)/2)
    );
  }

  function actionToOpKey(action) {
    switch (String(action||"").toLowerCase()) {
      case "persuade":   return "diplomacy";
      case "inspire":    return "softpower";
      case "expose":     return "intrigue";
      case "intimidate": return "violence";
      default:           return null;
    }
  }

  // Phase C — Court Bonus: sum of favors of courtiers aligned with `factionId`
  // (those whose courtFavor[factionId] >= 1), capped to ±5 per spec §4.2.
  // Reads canvas tokens flagged tableauActor; safe if canvas isn't loaded yet.
  function computeCourtBonus(factionId) {
    try {
      if (!factionId || !canvas?.tokens?.placeables) return 0;
      let total = 0;
      for (const tk of canvas.tokens.placeables) {
        if (tk?.document?.flags?.[MOD_R]?.tableauActor !== true) continue;
        const fav = Number(tk?.actor?.flags?.[MOD_R]?.courtFavor?.[factionId] ?? 0);
        if (fav >= 1) total += fav;
      }
      return clamp(total, -5, 5);
    } catch (e) {
      console.warn(TAG, "computeCourtBonus failed", e);
      return 0;
    }
  }

  // Phase C — rel-delta on outcome. Shifts the directional relations tier
  // by `delta` steps using the existing factions.relations API. Negative
  // = toward hostility, positive = toward friendship. Clamped to ladder.
  async function shiftRelTier(fromActor, toActor, delta, reason) {
    if (!delta || !fromActor || !toActor) return;
    try {
      const relations = game?.bbttcc?.api?.factions?.relations;
      if (!relations) return;
      const keys = relations.TIER_KEYS || [];
      const curTier = relations.get(fromActor, toActor);
      const curIdx = keys.indexOf(curTier);
      if (curIdx < 0) return;
      const newIdx = Math.max(0, Math.min(keys.length - 1, curIdx + delta));
      const newTier = keys[newIdx];
      if (newTier === curTier) return;
      await relations.set(fromActor, toActor, newTier, { reason });
    } catch (e) {
      console.warn(TAG, "shiftRelTier failed", e);
    }
  }

  // Spec §4.4 — outcome-driven rel-delta magnitudes. Keyed by outcomeKind +
  // winner side. Phase E replaces Phase C's 3-outcome simplification.
  // For asymmetric outcomes (cleanTriumph / tarnishedVictory / publicHumiliation),
  // "attacker"/"defender" suffix indicates which side IS the winner; the
  // table entry's att2def / def2att stay attacker-centric so callers don't
  // need to flip arguments based on who won.
  const REL_DELTA_TABLE = Object.freeze({
    // attacker wins
    cleanTriumph_attacker:       { att2def: -1, def2att: -2 },
    tarnishedVictory_attacker:   { att2def: -1, def2att: -1 },
    publicHumiliation_attacker:  { att2def: -1, def2att: -3 }, // attacker won, defender publicly humiliated
    // defender wins (mirrored)
    cleanTriumph_defender:       { att2def: -2, def2att: -1 },
    tarnishedVictory_defender:   { att2def: -1, def2att: -1 },
    publicHumiliation_defender:  { att2def: +1, def2att: -2 }, // attacker publicly humiliated
    // symmetric
    stalemate:                   { att2def:  0, def2att:  0 },
    mutualRuin:                  { att2def: -2, def2att: -2 }
  });

  async function applyRelDeltas(A, D, outcomeKind, winner, label) {
    if (!outcomeKind) return;
    const key = outcomeKind === "stalemate" || outcomeKind === "mutualRuin"
      ? outcomeKind
      : `${outcomeKind}_${winner === "A" ? "attacker" : "defender"}`;
    const d = REL_DELTA_TABLE[key];
    if (!d) return;
    const reason = `${label || "Courtly Intrigue"}: ${outcomeKind}`;
    await shiftRelTier(A, D, d.att2def, reason);
    await shiftRelTier(D, A, d.def2att, reason);
  }

  // Phase E — outcome flavor detector. Maps damage-based win + suspicion +
  // scandal state to one of the 5 outcomes per spec §6. Returns null if
  // still ongoing.
  function detectOutcomeKind(state) {
    if (state.outcome === "ongoing") return null;
    if (state.outcome === "stalemate") return "stalemate";
    if (state.outcome === "mutualRuin") return "mutualRuin";
    const winner = state.outcome === "attackerWin" ? "A" : "D";
    const loser  = winner === "A" ? "D" : "A";
    const loserScandal  = loser === "A" ? state.scandalOnA : state.scandalOnD;
    const winnerScandal = winner === "A" ? state.scandalOnA : state.scandalOnD;
    // Suspicion 10 collapse OR loser had scandal at end → Public Humiliation.
    if (state.courtCollapsed || loserScandal) return "publicHumiliation";
    // Winner had scandal at end OR suspicion ≥5 OR winner's influence ≤50% → Tarnished.
    const winnerInf = winner === "A" ? state.influenceA : state.influenceD;
    const winnerMax = winner === "A" ? state.maxA       : state.maxD;
    const pct = winnerMax > 0 ? winnerInf / winnerMax : 0;
    if (winnerScandal || state.suspicion >= 5 || pct <= 0.5) return "tarnishedVictory";
    return "cleanTriumph";
  }

  function outcomeWinner(state) {
    if (state.outcome === "attackerWin") return "A";
    if (state.outcome === "defenderWin") return "D";
    return null;
  }

  // Phase E — Scandal Scar writer. Pushes a scar entry to the actor's flag.
  // Severity: "light" (-2 first roll next courtly raid; cleared by Clean
  // Triumph) or "heavy" (-3 first + -1 second; persists until laundering or
  // 3-session timeout — laundering is out of S.2 scope per spec §10).
  async function writeScandalScar(actor, severity, sourceRaidId) {
    if (!actor) return null;
    const sev = (severity === "heavy") ? "heavy" : "light";
    const scars = foundry.utils.duplicate(actor.flags?.["bbttcc-raid"]?.scandalScars || []);
    scars.push({
      severity: sev,
      ts: Date.now(),
      sourceRaidId: String(sourceRaidId || ""),
      status: "pending"
    });
    await actor.update({ "flags.bbttcc-raid.scandalScars": scars });
    return scars[scars.length - 1];
  }

  // Clear all light scars on the actor (Clean Triumph reward per spec §6).
  async function clearLightScars(actor) {
    if (!actor) return 0;
    const scars = actor.flags?.["bbttcc-raid"]?.scandalScars || [];
    const kept = scars.filter(s => s.severity !== "light");
    if (kept.length === scars.length) return 0;
    await actor.update({ "flags.bbttcc-raid.scandalScars": kept });
    return scars.length - kept.length;
  }

  whenRaidReady((raidApi) => {
    raidApi.courtly = async function createCourtlyScenario({
      attackerId,
      defenderId,
      atkInitDip = 0,
      atkInitSoft = 0,
      defInitDip = 0,
      defInitSoft = 0,
      label = "Courtly Intrigue"
    } = {}) {
      const A = game.actors.get(String(attackerId||"").replace(/^Actor\./,""));
      const D = game.actors.get(String(defenderId||"").replace(/^Actor\./,""));
      if (!A || !D) throw new Error(`${TAG} attacker or defender not found`);

      // Spend initial commitment OPs & compute starting Influence HP
      atkInitDip   = Math.max(0, Math.floor(Number(atkInitDip||0)));
      atkInitSoft  = Math.max(0, Math.floor(Number(atkInitSoft||0)));
      defInitDip   = Math.max(0, Math.floor(Number(defInitDip||0)));
      defInitSoft  = Math.max(0, Math.floor(Number(defInitSoft||0)));

      if (atkInitDip)  await adjustOpBank(A, "diplomacy", -atkInitDip, label);
      if (atkInitSoft) await adjustOpBank(A, "softpower", -atkInitSoft, label);
      if (defInitDip)  await adjustOpBank(D, "diplomacy", -defInitDip, label);
      if (defInitSoft) await adjustOpBank(D, "softpower", -defInitSoft, label);

      let initInfluenceA = computeInfluenceHP({ baseCommitDip: atkInitDip, baseCommitSoft: atkInitSoft });
      let initInfluenceD = computeInfluenceHP({ baseCommitDip: defInitDip, baseCommitSoft: defInitSoft });
      // Phase E — Consume pending "Influence cap −N next courtly raid" mark
      // (left by a prior Clean Triumph against this faction). Flag deleted
      // after consume per [[foundry-setflag-recursive-merge]].
      const aCapDelta = Number(A.flags?.["bbttcc-raid"]?.nextCourtlyInfluenceCapDelta || 0);
      const dCapDelta = Number(D.flags?.["bbttcc-raid"]?.nextCourtlyInfluenceCapDelta || 0);
      if (aCapDelta) {
        initInfluenceA = Math.max(1, initInfluenceA + aCapDelta);
        await A.update({ "flags.bbttcc-raid.-=nextCourtlyInfluenceCapDelta": null });
      }
      if (dCapDelta) {
        initInfluenceD = Math.max(1, initInfluenceD + dCapDelta);
        await D.update({ "flags.bbttcc-raid.-=nextCourtlyInfluenceCapDelta": null });
      }
      const state = {
        attackerId: A.id,
        defenderId: D.id,
        label,
        round: 0,
        roundCap: 6,                   // Phase E — spec §8 resolution 5
        outcome: "ongoing", // "ongoing" | "attackerWin" | "defenderWin" | "mutualRuin" | "stalemate"
        outcomeKind: null,             // Phase E — one of "cleanTriumph"|"tarnishedVictory"|"stalemate"|"publicHumiliation"|"mutualRuin"
        influenceA: initInfluenceA,
        influenceD: initInfluenceD,
        maxA: initInfluenceA,          // Phase E — captured for % calc in outcome detector
        maxD: initInfluenceD,
        scandalOnA: false,
        scandalOnD: false,
        // Phase C — Suspicion / Court Bonus / collapse flag
        suspicion: 0,                  // 0..10 per spec §4.1
        suspicionQuietStreak: 0,       // consecutive rounds with no expose/intimidate
        courtBonusA: 0,                // computed at step() entry from courtier favor
        courtBonusD: 0,
        courtCollapsed: false,         // set when suspicion hits 10
        // Social obstacle-KEY (survey audit) — "The Last Word" (Cosmic Linguist signature):
        // the armed side's NEXT Expose/Intimidate raises NO Suspicion (bypassing the meter that
        // punishes the social hammer — the courtly analog of Catastrophic Entry vs a wall's
        // Threshold). Once per side per scenario.
        lastWordA: false, lastWordD: false, lastWordUsedA: false, lastWordUsedD: false,
        // Diplomatic Envoys (Social specialist crew) — that side's aggressive plays cost −1 Suspicion.
        envoysA: _sideHasActiveCrew(A, "Diplomatic Envoys"),
        envoysD: _sideHasActiveCrew(D, "Diplomatic Envoys"),
        // Phase C/D — Pending mods queue.
        // Schema: { side, type: "bonus"|"forceReroll"|"actionBonus", value?, source,
        //          actionFilter? (D), fireOnRound? (E — gate to specific round) }
        pendingMods: [],
        history: []
      };

      // Phase E — Consume pending Scandal Scars on both factions. Each scar
      // queues a one-shot penalty mod that fires at a specific round, then
      // gets marked status:"applied" on the actor. Light = -2 on round 1;
      // heavy = -3 on round 1 + -1 on round 2.
      async function _consumeScarsForSide(actor, side) {
        const scars = foundry.utils.duplicate(actor.flags?.["bbttcc-raid"]?.scandalScars || []);
        let mutated = false;
        for (const scar of scars) {
          if (scar.status !== "pending") continue;
          if (scar.severity === "light") {
            state.pendingMods.push({
              side, type: "bonus", value: -2, source: `scar:light(${scar.sourceRaidId || "prior"})`,
              fireOnRound: 1
            });
          } else if (scar.severity === "heavy") {
            state.pendingMods.push({
              side, type: "bonus", value: -3, source: `scar:heavy(${scar.sourceRaidId || "prior"})`,
              fireOnRound: 1
            });
            state.pendingMods.push({
              side, type: "bonus", value: -1, source: `scar:heavy(${scar.sourceRaidId || "prior"})`,
              fireOnRound: 2
            });
          }
          scar.status = "applied";
          mutated = true;
        }
        if (mutated) await actor.update({ "flags.bbttcc-raid.scandalScars": scars });
      }
      await _consumeScarsForSide(A, "A");
      await _consumeScarsForSide(D, "D");

      function presenceBonus(actor) {
        const flags = actor.flags?.[MODF] || {};
        const bank  = flags.opBank || {};
        const v = Number(bank.violence || 0);
        return Math.min(4, Math.floor(v / 5));
      }

      async function step({
        atkAction = "persuade",
        defAction = "persuade",
        atkSpend = 0,
        defSpend = 0,
        atkSkillBonus = 0,
        defSkillBonus = 0,
        atkOpBonus = 0,
        defOpBonus = 0,
        note = ""
      } = {}) {
        if (state.outcome !== "ongoing") {
          return { ...state, note: "scenario already resolved" };
        }

        state.round += 1;

        const atkAct = String(atkAction||"").toLowerCase();
        const defAct = String(defAction||"").toLowerCase();
        const atkKey = actionToOpKey(atkAct);
        const defKey = actionToOpKey(defAct);

        let atkSpendInt = Math.max(0, Math.floor(Number(atkSpend||0)));
        let defSpendInt = Math.max(0, Math.floor(Number(defSpend||0)));

        // Phase D — Call the Question: cap spending for `roundsRemaining` round(s).
        if (state.spendLock?.roundsRemaining > 0) {
          const cap = Number(state.spendLock.maxSpend ?? 0);
          if (atkSpendInt > cap || defSpendInt > cap) {
            await sendChat([`Spending lock active: capped at ${cap} OP per side this round.`], { title: `${label}: Spending Lock` });
          }
          atkSpendInt = Math.min(atkSpendInt, cap);
          defSpendInt = Math.min(defSpendInt, cap);
          state.spendLock.roundsRemaining -= 1;
          if (state.spendLock.roundsRemaining <= 0) delete state.spendLock;
        }

        // Spend OP from relevant pools
        if (atkKey && atkSpendInt) await adjustOpBank(A, atkKey, -atkSpendInt, label);
        if (defKey && defSpendInt) await adjustOpBank(D, defKey, -defSpendInt, label);

        // Compute bonuses
        let atkBonus = Number(atkSkillBonus || 0);
        let defBonus = Number(defSkillBonus || 0);

        // Lead + Support coalition OP bonus (for the chosen action's category).
        // Caller computes via _rcCoalitionBonus on action's matched key (persuade→diplomacy,
        // inspire→softpower, expose→intrigue, intimidate→violence) and passes the totals here.
        const atkOpBonusInt = Math.max(0, Math.floor(Number(atkOpBonus || 0)));
        const defOpBonusInt = Math.max(0, Math.floor(Number(defOpBonus || 0)));
        atkBonus += atkOpBonusInt;
        defBonus += defOpBonusInt;

        if (atkAct === "persuade")  atkBonus += Math.ceil(atkSpendInt / 2);
        if (defAct === "persuade")  defBonus += Math.ceil(defSpendInt / 2);

        if (atkAct === "inspire")   atkBonus += Math.ceil(atkSpendInt / 2);
        if (defAct === "inspire")   defBonus += Math.ceil(defSpendInt / 2);

        if (atkAct === "expose")    atkBonus += Math.ceil(atkSpendInt / 2);
        if (defAct === "expose")    defBonus += Math.ceil(defSpendInt / 2);

        if (atkAct === "intimidate") {
          atkBonus += Math.ceil(atkSpendInt / 2);
          atkBonus += presenceBonus(A);
        }
        if (defAct === "intimidate") {
          defBonus += Math.ceil(defSpendInt / 2);
          defBonus += presenceBonus(D);
        }

        // Phase C — Court Bonus from courtier favor. Computed AT step entry
        // so the value the HUD displays is consistent with what the roll uses.
        const courtBonusA = computeCourtBonus(state.attackerId);
        const courtBonusD = computeCourtBonus(state.defenderId);
        state.courtBonusA = courtBonusA;
        state.courtBonusD = courtBonusD;
        atkBonus += courtBonusA;
        defBonus += courtBonusD;

        // Phase C — Suspicion threshold-5 effects ("Court is uneasy" per
        // spec §4.1). Reads suspicion BEFORE this round's updates.
        const uneasy = state.suspicion >= 5;
        if (uneasy) {
          if (atkAct === "expose")   atkBonus += 1;
          if (defAct === "expose")   defBonus += 1;
          if (atkAct === "persuade") atkBonus -= 1;
          if (defAct === "persuade") defBonus -= 1;
        }

        // Apply scandal penalties (–2 next exchange)
        if (state.scandalOnA) atkBonus -= 2;
        if (state.scandalOnD) defBonus -= 2;

        // Phase C — Consume pendingMods queue (one-shot bonuses + reroll flags
        // queued by secret plays / Phase D anytimes).
        // Phase D — `actionBonus` entries match-or-carry.
        // Phase E — `fireOnRound` gates Scar penalties to a specific round
        //           (heavy = round 1 + round 2 split). Mods with fireOnRound
        //           set are skipped on non-matching rounds; carried forward.
        let forceAReroll = false, forceDReroll = false;
        const consumedMods = [];
        const carriedMods = [];
        for (const mod of (state.pendingMods || [])) {
          // Round-gated mods (Scar penalties): skip + carry if not this round.
          if (mod.fireOnRound != null && Number(mod.fireOnRound) !== state.round) {
            // Once past the target round, drop it.
            if (Number(mod.fireOnRound) < state.round) { /* expired — drop */ }
            else carriedMods.push(mod);
            continue;
          }
          if (mod.type === "bonus" && mod.side === "A") { atkBonus += Number(mod.value || 0); consumedMods.push(`atk ${mod.value > 0 ? "+" : ""}${mod.value} (${mod.source || "secret"})`); }
          else if (mod.type === "bonus" && mod.side === "D") { defBonus += Number(mod.value || 0); consumedMods.push(`def ${mod.value > 0 ? "+" : ""}${mod.value} (${mod.source || "secret"})`); }
          else if (mod.type === "forceReroll" && mod.side === "A") { forceAReroll = true; consumedMods.push(`atk forced reroll (${mod.source || "secret"})`); }
          else if (mod.type === "forceReroll" && mod.side === "D") { forceDReroll = true; consumedMods.push(`def forced reroll (${mod.source || "secret"})`); }
          else if (mod.type === "actionBonus") {
            const sideAct = mod.side === "A" ? atkAct : defAct;
            const filter = Array.isArray(mod.actionFilter) ? mod.actionFilter : [];
            if (filter.includes(sideAct)) {
              if (mod.side === "A") atkBonus += Number(mod.value || 0);
              else defBonus += Number(mod.value || 0);
              consumedMods.push(`${mod.side} ${sideAct} ${mod.value > 0 ? "+" : ""}${mod.value} (${mod.source || "anytime"})`);
            } else {
              carriedMods.push(mod);  // wait for a matching action next round
            }
          }
          else carriedMods.push(mod);
        }
        state.pendingMods = carriedMods;

        // Clear scandal markers; new ones may be set based on this round
        let nextScandalOnA = false;
        let nextScandalOnD = false;

        let atkRoll = await (new Roll("2d10 + @b", { b: atkBonus })).evaluate();
        let defRoll = await (new Roll("2d10 + @b", { b: defBonus })).evaluate();
        if (forceAReroll) atkRoll = await (new Roll("2d10 + @b", { b: atkBonus })).evaluate();
        if (forceDReroll) defRoll = await (new Roll("2d10 + @b", { b: defBonus })).evaluate();

        const atkTotal = atkRoll.total ?? 0;
        const defTotal = defRoll.total ?? 0;
        const margin   = atkTotal - defTotal;

        let result;
        if (atkTotal === defTotal) {
          result = "tie";
        } else if (atkTotal > defTotal) {
          result = "attacker";
        } else {
          result = "defender";
        }

        // Influence damage
        let damageToD = 0;
        let damageToA = 0;
        let extraNotes = [];

        if (result === "attacker") {
          const dmg = Math.max(1, Math.ceil(Math.abs(margin) / 2));
          damageToD += dmg;

          // Expose → Scandal if big hit
          if (atkAct === "expose" && margin >= 6) {
            nextScandalOnD = true;
            extraNotes.push("Expose: Scandal applied to defender (–2 next exchange).");
          }

          // Defender intimidated and failed badly → backlash
          if (defAct === "intimidate" && margin <= -5) {
            damageToD += 2;
            extraNotes.push("Intimidate backlash: defender loses 2 extra Influence.");
          }
        } else if (result === "defender") {
          const dmg = Math.max(1, Math.ceil(Math.abs(margin) / 2));
          damageToA += dmg;

          if (defAct === "expose" && -margin >= 6) {
            nextScandalOnA = true;
            extraNotes.push("Expose: Scandal applied to attacker (–2 next exchange).");
          }
          if (atkAct === "intimidate" && margin >= 5) {
            damageToA += 2;
            extraNotes.push("Intimidate backlash: attacker loses 2 extra Influence.");
          }
        }

        // Apply damage
        const beforeA = state.influenceA;
        const beforeD = state.influenceD;
        state.influenceA = Math.max(0, state.influenceA - damageToA);
        state.influenceD = Math.max(0, state.influenceD - damageToD);

        // Phase C — Suspicion updates from this round's actions (spec §4.1).
        const suspBefore = state.suspicion;
        let suspDelta = 0;
        const susReasons = [];
        if (atkAct === "expose")    { suspDelta += 1; susReasons.push("attacker expose +1"); }
        if (defAct === "expose")    { suspDelta += 1; susReasons.push("defender expose +1"); }
        if (atkAct === "intimidate"){ suspDelta += 1; susReasons.push("attacker intimidate +1"); }
        if (defAct === "intimidate"){ suspDelta += 1; susReasons.push("defender intimidate +1"); }
        // Failed expose by 5+ — both sides checked
        if (atkAct === "expose" && result === "defender" && (-margin) >= 5) {
          suspDelta += 2; susReasons.push("attacker expose failed by 5+ → +2");
        }
        if (defAct === "expose" && result === "attacker" && margin >= 5) {
          suspDelta += 2; susReasons.push("defender expose failed by 5+ → +2");
        }
        // Quiet streak: neither side did expose or intimidate this round.
        const wasQuiet = !["expose", "intimidate"].includes(atkAct)
                      && !["expose", "intimidate"].includes(defAct);
        if (wasQuiet) {
          state.suspicionQuietStreak += 1;
          // Per spec §4.1: "maintaining 2 consecutive rounds with no
          // expose/intimidate (–1 per quiet round)" — drop starts on 3rd
          // consecutive quiet round so the 2-round maintenance is the
          // earned gate.
          if (state.suspicionQuietStreak > 2) {
            suspDelta -= 1; susReasons.push(`quiet round ${state.suspicionQuietStreak} → −1`);
          }
        } else {
          state.suspicionQuietStreak = 0;
        }

        // ── Social obstacle-KEY effects ──────────────────────────────────────
        // "The Last Word" (Cosmic Linguist): the armed side's aggressive play this round raises
        // NO Suspicion. Diplomatic Envoys (crew): −1 Suspicion on that side's aggressive play.
        // Per-side — computed from this round's OWN contributions so only the acting side is hit.
        const _sideSuspContribution = (act, isAtk) => {
          let s = 0;
          if (act === "expose") s += 1;
          if (act === "intimidate") s += 1;
          if (act === "expose" && ((isAtk && result === "defender" && (-margin) >= 5) || (!isAtk && result === "attacker" && margin >= 5))) s += 2;
          return s;
        };
        if (state.lastWordA) { const s = _sideSuspContribution(atkAct, true); if (s > 0) { suspDelta -= s; susReasons.push("⚜ The Last Word — attacker raises no Suspicion"); } state.lastWordA = false; }
        if (state.lastWordD) { const s = _sideSuspContribution(defAct, false); if (s > 0) { suspDelta -= s; susReasons.push("⚜ The Last Word — defender raises no Suspicion"); } state.lastWordD = false; }
        if (state.envoysA) { if (_sideSuspContribution(atkAct, true) > 0) { suspDelta -= 1; susReasons.push("Diplomatic Envoys — attacker Suspicion −1"); } }
        if (state.envoysD) { if (_sideSuspContribution(defAct, false) > 0) { suspDelta -= 1; susReasons.push("Diplomatic Envoys — defender Suspicion −1"); } }

        state.suspicion = clamp(suspBefore + suspDelta, 0, 10);

        // Phase F — VFX hooks for suspicion threshold crosses (broadcast to all clients).
        if (state.suspicion >= 5 && suspBefore < 5) {
          _emitCourtlyVfx("suspicion-threshold", { level: 5, before: suspBefore, after: state.suspicion });
        }
        if (state.suspicion >= 8 && suspBefore < 8) {
          _emitCourtlyVfx("suspicion-threshold", { level: 8, before: suspBefore, after: state.suspicion });
        }
        if (state.suspicion >= 10 && suspBefore < 10) {
          _emitCourtlyVfx("court-collapse", { suspicion: state.suspicion });
        }

        // Phase C — Suspicion threshold reactions (spec §4.1).
        // Threshold 8 — neutral courtier defects to higher-influence side.
        if (state.suspicion >= 8 && suspBefore < 8) {
          try {
            const higherSideId = (state.influenceA >= state.influenceD) ? state.attackerId : state.defenderId;
            const neutralToken = (canvas?.tokens?.placeables || []).find(tk => {
              if (tk?.document?.flags?.[MOD_R]?.tableauActor !== true) return null;
              const cf = tk.actor?.flags?.[MOD_R]?.courtFavor || {};
              return Number(cf[state.attackerId] || 0) === 0 && Number(cf[state.defenderId] || 0) === 0;
            });
            if (neutralToken?.actor) {
              const cf = foundry.utils.duplicate(neutralToken.actor.flags?.[MOD_R]?.courtFavor || {});
              cf[higherSideId] = 1;
              await neutralToken.actor.update({ [`flags.${MOD_R}.courtFavor`]: cf });
              extraNotes.push(`Crisis (suspicion ≥ 8): ${neutralToken.actor.name} defects to the ${higherSideId === state.attackerId ? "attacker" : "defender"}'s side (favor +1).`);
            } else {
              extraNotes.push(`Crisis (suspicion ≥ 8): no neutral courtier available to defect.`);
            }
          } catch (e) { console.warn(TAG, "threshold-8 defect failed", e); }
        }
        // Threshold 10 — court collapses; force outcome by lower influence.
        // Phase E will replace with the full Public Humiliation 5-outcome.
        if (state.suspicion >= 10 && !state.courtCollapsed) {
          state.courtCollapsed = true;
          extraNotes.push(`Collapse (suspicion = 10): the court turns on the noisier side.`);
        }

        // Determine outcome (collapse may force; otherwise damage-based)
        if (state.courtCollapsed && state.outcome === "ongoing") {
          if (state.influenceA < state.influenceD) state.outcome = "defenderWin";
          else if (state.influenceD < state.influenceA) state.outcome = "attackerWin";
          else state.outcome = "mutualRuin";
        } else if (state.influenceA <= 0 && state.influenceD <= 0) {
          state.outcome = "mutualRuin";
        } else if (state.influenceD <= 0) {
          state.outcome = "attackerWin";
        } else if (state.influenceA <= 0) {
          state.outcome = "defenderWin";
        }
        // Phase E — Round cap (spec §8 resolution 5). If we hit the cap with
        // no decisive outcome and both sides above 25% max, declare stalemate.
        else if (state.round >= state.roundCap) {
          const aPct = state.maxA > 0 ? state.influenceA / state.maxA : 0;
          const dPct = state.maxD > 0 ? state.influenceD / state.maxD : 0;
          if (aPct > 0.25 && dPct > 0.25) state.outcome = "stalemate";
          else if (aPct < dPct) state.outcome = "defenderWin";
          else if (dPct < aPct) state.outcome = "attackerWin";
          else state.outcome = "stalemate";
        }
        // Phase E — Map damage-based outcome to flavored kind for marks.
        if (state.outcome !== "ongoing" && !state.outcomeKind) {
          state.outcomeKind = detectOutcomeKind(state);
        }

        // Record new scandal flags
        state.scandalOnA = nextScandalOnA;
        state.scandalOnD = nextScandalOnD;

        const histEntry = {
          round: state.round,
          atkAction: atkAct,
          defAction: defAct,
          atkSpend: atkSpendInt,
          defSpend: defSpendInt,
          atkTotal,
          defTotal,
          margin,
          result,
          damageToA,
          damageToD,
          influenceA_before: beforeA,
          influenceD_before: beforeD,
          influenceA_after: state.influenceA,
          influenceD_after: state.influenceD,
          scandalOnA: state.scandalOnA,
          scandalOnD: state.scandalOnD,
          suspicion_before: suspBefore,
          suspicion_after: state.suspicion,
          suspicion_delta: suspDelta,
          suspicion_reasons: susReasons,
          courtBonusA,
          courtBonusD,
          uneasy,
          courtCollapsed: state.courtCollapsed,
          note
        };
        state.history.push(histEntry);

        await playRollFX({
          attackerName: A.name,
          defenderName: D.name,
          attackerTotal: atkTotal,
          defenderTotal: defTotal,
          margin
        });
        await playInfluenceFX({ beforeA, beforeD, afterA: state.influenceA, afterD: state.influenceD });

        const _opLine = (lbl, k, opb) => {
          const parts = [];
          if (opb > 0) parts.push(`coalition ${k} +${opb}`);
          return parts.length ? ` <small style="opacity:.7;">(${parts.join(", ")})</small>` : "";
        };
        const _cbLine = (cb) => cb !== 0 ? ` <small style="opacity:.7;">(court ${cb > 0 ? "+" : ""}${cb})</small>` : "";
        const lines = [
          `Round ${state.round}: <b>${foundry.utils.escapeHTML(A.name)}</b> vs <b>${foundry.utils.escapeHTML(D.name)}</b>`,
          `Actions: Attacker <i>${atkAct}</i> (spend ${atkSpendInt})${_opLine("atk", atkKey || "", atkOpBonusInt)}${_cbLine(courtBonusA)} vs Defender <i>${defAct}</i> (spend ${defSpendInt})${_opLine("def", defKey || "", defOpBonusInt)}${_cbLine(courtBonusD)}`,
          `Rolls: Attacker ${atkTotal} vs Defender ${defTotal} (margin ${margin >= 0 ? "+"+margin : margin})`,
          `Result: ${result.toUpperCase()} — Influence ${beforeA}/${beforeD} → ${state.influenceA}/${state.influenceD}`
        ];
        if (suspDelta !== 0 || uneasy) {
          lines.push(`Suspicion ${suspBefore} → ${state.suspicion}${uneasy ? " <small style=\"opacity:.7;\">(court uneasy)</small>" : ""}${susReasons.length ? ` <small style=\"opacity:.7;\">(${susReasons.join("; ")})</small>` : ""}`);
        }
        if (extraNotes.length) lines.push(...extraNotes.map(n => foundry.utils.escapeHTML(n)));
        if (note) lines.push(foundry.utils.escapeHTML(note));

        let title = `${label}: Round ${state.round}`;
        if (state.outcome === "attackerWin") title += " — Attacker Wins";
        else if (state.outcome === "defenderWin") title += " — Defender Wins";
        else if (state.outcome === "mutualRuin") title += " — Mutual Ruin";

        await sendChat(lines, { title });

        // Phase C/E — Rel-delta on outcome transition. Step() early-returns
        // when state.outcome !== "ongoing" at entry, so any non-ongoing
        // outcome we see here IS this round's transition. Fires once.
        if (state.outcome !== "ongoing") {
          try { await applyRelDeltas(A, D, state.outcomeKind, outcomeWinner(state), label); }
          catch (e) { console.warn(TAG, "applyRelDeltas failed", e); }
          // Phase E — apply per-outcome marks (scars, favor gifts, secrets,
          // suspicion reset, courtier loss). Fires once.
          try { await _applyOutcomeMarks(); }
          catch (e) { console.warn(TAG, "_applyOutcomeMarks failed", e); }
          // Phase F — broadcast outcome VFX to all clients.
          _emitCourtlyVfx("outcome", {
            outcome: state.outcome,
            outcomeKind: state.outcomeKind,
            winnerSide: outcomeWinner(state),
            attackerName: A.name,
            defenderName: D.name
          });
        }

        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}

        return { ...state };
      }

      function getState() {
        try { return structuredClone(state); }
        catch { return JSON.parse(JSON.stringify(state)); }
      }

      // Phase C — API surface for Phase D anytimes + GM/macro callers.
      async function raiseSuspicion(n = 1, why = "") {
        const before = state.suspicion;
        state.suspicion = clamp(before + Math.max(0, Math.floor(Number(n) || 0)), 0, 10);
        // External rises break the quiet streak.
        state.suspicionQuietStreak = 0;
        if (state.suspicion > before) {
          await sendChat([`Suspicion ${before} → ${state.suspicion}${why ? ` <small style="opacity:.7;">(${foundry.utils.escapeHTML(why)})</small>` : ""}`], { title: `${label}: Suspicion +${state.suspicion - before}` });
          try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        }
        return state.suspicion;
      }
      async function lowerSuspicion(n = 1, why = "") {
        const before = state.suspicion;
        state.suspicion = clamp(before - Math.max(0, Math.floor(Number(n) || 0)), 0, 10);
        if (state.suspicion < before) {
          await sendChat([`Suspicion ${before} → ${state.suspicion}${why ? ` <small style="opacity:.7;">(${foundry.utils.escapeHTML(why)})</small>` : ""}`], { title: `${label}: Suspicion −${before - state.suspicion}` });
          try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        }
        return state.suspicion;
      }
      async function adjustFavor(actorId, factionId, delta) {
        const actor = game.actors?.get(String(actorId || "").replace(/^Actor\./, ""));
        if (!actor || !factionId || !delta) return null;
        const cur = foundry.utils.duplicate(actor.flags?.[MOD_R]?.courtFavor || {});
        const before = Number(cur[factionId] ?? 0);
        const after = clamp(before + Math.floor(Number(delta) || 0), -3, 3);
        if (after === before) return before;
        cur[factionId] = after;
        await actor.update({ [`flags.${MOD_R}.courtFavor`]: cur });
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        // Phase F — broadcast favor VFX (floating +N/-N near courtier token)
        _emitCourtlyVfx("favor", { actorId: actor.id, factionId, before, after, delta: after - before });
        return after;
      }

      // Phase C — Pending-mod queuers for secret-card / anytime effects.
      // `side` is "attacker" or "defender" (normalized to "A"/"D" internally).
      function _normSide(side) {
        const s = String(side || "").toLowerCase();
        if (s === "a" || s === "attacker" || s === "att" || s === state.attackerId) return "A";
        if (s === "d" || s === "defender" || s === "def" || s === state.defenderId) return "D";
        return null;
      }
      function queueRollMod(side, value, source = "secret") {
        const s = _normSide(side);
        if (!s || !Number.isFinite(Number(value))) return false;
        state.pendingMods.push({ side: s, type: "bonus", value: Math.floor(Number(value)), source });
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return true;
      }
      function queueReroll(side, source = "secret") {
        const s = _normSide(side);
        if (!s) return false;
        state.pendingMods.push({ side: s, type: "forceReroll", source });
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return true;
      }
      async function dealInfluenceDamage(side, n, source = "secret") {
        const s = _normSide(side);
        const amount = Math.max(0, Math.floor(Number(n) || 0));
        if (!s || !amount) return null;
        const key = s === "A" ? "influenceA" : "influenceD";
        const before = state[key];
        state[key] = Math.max(0, before - amount);
        await sendChat([`Influence damage outside exchange: ${s === "A" ? A.name : D.name} loses ${amount} (${before} → ${state[key]}) <small style="opacity:.7;">(${foundry.utils.escapeHTML(source)})</small>`], { title: `${label}: Influence Damage` });
        // Check for outcome — if a side hits 0 mid-step, mark it.
        if (state.outcome === "ongoing") {
          if (state.influenceA <= 0 && state.influenceD <= 0) state.outcome = "mutualRuin";
          else if (state.influenceD <= 0) state.outcome = "attackerWin";
          else if (state.influenceA <= 0) state.outcome = "defenderWin";
          if (state.outcome !== "ongoing") {
            try { await applyRelDeltas(A, D, state.outcome, label); } catch (e) { console.warn(TAG, e); }
          }
        }
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return state[key];
      }
      async function clearScandal(side, source = "secret") {
        const s = _normSide(side);
        if (!s) return false;
        const key = s === "A" ? "scandalOnA" : "scandalOnD";
        if (!state[key]) return false;
        state[key] = false;
        await sendChat([`Scandal cleared on ${s === "A" ? A.name : D.name} <small style="opacity:.7;">(${foundry.utils.escapeHTML(source)})</small>`], { title: `${label}: Scandal Cleared` });
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return true;
      }

      // Phase D — extended effect queuers + content-driven dispatchers.
      // queueActionBonus: bonus that lands ONLY if the side's next action
      // matches one of `actionFilter`. Used by Public Toast (persuade only),
      // Sidle Closer (persuade|inspire), Patron's Word (anything but
      // intimidate). Consumed at step() bonus calc after action read.
      function queueActionBonus(side, actionFilter, value, source = "anytime") {
        const s = _normSide(side);
        if (!s || !Number.isFinite(Number(value))) return false;
        const filter = Array.isArray(actionFilter) ? actionFilter.slice() : [String(actionFilter || "")];
        state.pendingMods.push({
          side: s, type: "actionBonus",
          actionFilter: filter, value: Math.floor(Number(value)),
          source
        });
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return true;
      }

      // Phase D — Stage a Distraction: opp discards a stolen secret if held.
      async function discardSecret(side, filter = {}) {
        const s = _normSide(side);
        if (!s) return null;
        const targetActor = s === "A" ? A : D;
        const items = (targetActor.items?.contents || []).filter(i => {
          const sec = i.flags?.[MOD_R]?.secret;
          if (!sec) return false;
          if (filter.acquisition && sec.acquisition !== filter.acquisition) return false;
          return true;
        });
        if (items.length === 0) {
          await sendChat([`${esc(targetActor.name)} holds no matching secret to discard.`], { title: `${label}: Discard` });
          return null;
        }
        const target = items[Math.floor(Math.random() * items.length)];
        await targetActor.deleteEmbeddedDocuments("Item", [target.id]);
        await sendChat([`${esc(targetActor.name)} discards a secret: <b>${esc(target.name)}</b>`], { title: `${label}: Discard` });
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return target.name;
      }

      // Phase D — Call the Question: cap spending on next exchange.
      function lockSpend(rounds = 1, maxSpend = 0) {
        state.spendLock = { roundsRemaining: Math.max(1, Math.floor(Number(rounds) || 1)), maxSpend: Math.max(0, Math.floor(Number(maxSpend) || 0)) };
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return state.spendLock;
      }

      // Social obstacle-KEY — "The Last Word" (Cosmic Linguist signature). Arms the side's NEXT
      // Expose/Intimidate to raise NO Suspicion — bypassing the meter that punishes the social
      // hammer (the courtly analog of Catastrophic Entry ignoring a wall's Threshold). Once per
      // side per scenario. (Class-affinity gate to a Cosmic Linguist on the roster = a follow-on
      // when the class-grant layer lands; v1 is invoke-gated by once-per-scenario.)
      async function armLastWord(side, source = "The Last Word") {
        const s = _normSide(side);
        if (!s) return false;
        const usedKey = s === "A" ? "lastWordUsedA" : "lastWordUsedD";
        const who = s === "A" ? A.name : D.name;
        // Class gate (class-grant layer): The Last Word is the Cosmic Linguist's signature — it
        // requires a Cosmic Linguist on that side's roster. GM may always invoke for adjudication.
        const fac = s === "A" ? A : D;
        const hasCL = !!game.bbttcc?.api?.raid?.factionHasClass?.(fac, "Cosmic Linguist");
        if (!hasCL && !game.user?.isGM) {
          await sendChat([`The Last Word requires a <b>Cosmic Linguist</b> on ${esc(who)}'s roster.`], { title: `${label}: The Last Word` });
          return false;
        }
        if (state[usedKey]) {
          await sendChat([`The Last Word has already been spoken by ${esc(who)} this scenario.`], { title: `${label}: The Last Word` });
          return false;
        }
        state[s === "A" ? "lastWordA" : "lastWordD"] = true;
        state[usedKey] = true;
        await sendChat([`<b>⚜ The Last Word</b> — ${esc(who)} prepares the unanswerable argument. Their next <b>Expose/Intimidate raises no Suspicion</b>. <small style="opacity:.7;">(${esc(source)})</small>`], { title: `${label}: The Last Word` });
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return true;
      }

      // Phase D — Draw a random secret from the bbttcc-master-content.courtly-secrets
      // compendium and add it to the target actor (self/opp) via addSecret.
      async function drawSecret(side, acquisition = "earned") {
        const s = _normSide(side);
        if (!s) return null;
        const targetActor = s === "A" ? A : D;
        const PACK_ID = "bbttcc-master-content.courtly-secrets";
        const pack = game.packs?.get(PACK_ID);
        if (!pack) { await sendChat([`Courtly secrets compendium not found (${PACK_ID}).`], { title: `${label}: Draw` }); return null; }
        const docs = await pack.getDocuments();
        if (!docs.length) { await sendChat([`Courtly secrets compendium is empty — run the seeder macro first.`], { title: `${label}: Draw` }); return null; }
        const pick = docs[Math.floor(Math.random() * docs.length)];
        const api = game.bbttcc?.api?.raid?.courtlySecrets;
        if (!api?.addSecret) { await sendChat([`Secrets API missing.`], { title: `${label}: Draw` }); return null; }
        const created = await api.addSecret(targetActor.id, pick, { acquisition });
        if (created) {
          await sendChat([`${esc(targetActor.name)} draws a ${esc(acquisition)} secret: <b>${esc(created.name)}</b>`], { title: `${label}: Draw` });
        }
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return created;
      }

      // Phase D — Patron's Word: spend −1 favor on a courtier with favor >= 2
      // toward self side, then queue a +3 bonus on next non-Intimidate action.
      async function spendFavorAndBoost(side, opts = {}) {
        const s = _normSide(side);
        if (!s) return null;
        const factionId = s === "A" ? state.attackerId : state.defenderId;
        const minFavor = Number(opts.minFavor ?? 2);
        // Find candidate courtiers with favor >= minFavor toward this side.
        const candidates = (canvas?.tokens?.placeables || [])
          .filter(t => t.document?.flags?.[MOD_R]?.tableauActor === true && t.actor)
          .filter(t => Number(t.actor.flags?.[MOD_R]?.courtFavor?.[factionId] ?? 0) >= minFavor);
        if (!candidates.length) {
          ui.notifications?.warn?.(`No courtier has favor ≥ ${minFavor} toward you. Cannot invoke Patron's Word.`);
          return null;
        }
        const opts2 = candidates.map(t => `<option value="${esc(t.actor.id)}">${esc(t.actor.name)} (favor ${_favorOf(t.actor, factionId)})</option>`).join("");
        const pick = await new Promise(resolve => {
          new Dialog({
            title: "Patron's Word",
            content: `<form><p>Spend −1 favor with a patron (favor ≥ ${minFavor}) to call in their boon.</p><div class="form-group"><label>Patron</label><select name="cid">${opts2}</select></div></form>`,
            buttons: {
              ok: { label: "Invoke", callback: html => resolve(game.actors.get(html[0].querySelector("[name=cid]").value) || null) },
              cancel: { label: "Cancel", callback: () => resolve(null) }
            },
            default: "ok",
            close: () => resolve(null)
          }, { width: 360 }).render(true);
        });
        if (!pick) return null;
        await adjustFavor(pick.id, factionId, -1);
        queueActionBonus(s, ["persuade", "inspire", "expose"], 3, `Patron's Word (${pick.name})`);
        return pick;
      }

      function _favorOf(actor, factionId) {
        return Number(actor?.flags?.[MOD_R]?.courtFavor?.[factionId] ?? 0);
      }
      function esc(x) { return foundry.utils.escapeHTML(String(x ?? "")); }

      // Phase D — Generic scenarioEffects dispatcher called by the raid
      // console after a maneuver fires. Default `side: "A"` matches the
      // attacker-runs-the-console pattern; callers can override.
      async function applyEffects(scenarioEffects, opts = {}) {
        const selfSide = String(opts.side || "A").toUpperCase();
        const oppSide  = selfSide === "A" ? "D" : "A";
        const selfFactionId = selfSide === "A" ? state.attackerId : state.defenderId;
        const oppFactionId  = selfSide === "A" ? state.defenderId : state.attackerId;
        const resolveSide = (s) => {
          const v = String(s || "self").toLowerCase();
          if (v === "self" || v === "a" && selfSide === "A" || v === "d" && selfSide === "D") return selfSide;
          if (v === "opp" || v === "opponent" || v === "a" && selfSide === "D" || v === "d" && selfSide === "A") return oppSide;
          if (v === "either") return null; // caller handles picker
          return _normSide(s) || selfSide;
        };
        const resolveFaction = (s) => resolveSide(s) === "A" ? state.attackerId : state.defenderId;
        for (const eff of (Array.isArray(scenarioEffects) ? scenarioEffects : [])) {
          const t = String(eff?.type || "");
          try {
            switch (t) {
              case "suspicionRise":
                await raiseSuspicion(eff.delta || 1, eff.reason || "anytime"); break;
              case "suspicionFall":
                await lowerSuspicion(eff.delta || 1, eff.reason || "anytime"); break;
              case "queueRollMod":
                queueRollMod(resolveSide(eff.side), eff.value, eff.source || "anytime"); break;
              case "queueReroll":
                queueReroll(resolveSide(eff.side), eff.source || "anytime"); break;
              case "queueActionBonus":
                queueActionBonus(resolveSide(eff.side), eff.actionFilter, eff.value, eff.source || "anytime"); break;
              case "clearScandal":
                await clearScandal(resolveSide(eff.side), eff.source || "anytime"); break;
              case "favorShift": {
                // Picker for chosen courtier; favor toward resolved faction.
                const fid = resolveFaction(eff.side);
                const tokens = (canvas?.tokens?.placeables || [])
                  .filter(t => t.document?.flags?.[MOD_R]?.tableauActor === true && t.actor);
                if (!tokens.length) { ui.notifications?.warn?.("No tableau courtiers on this scene."); break; }
                const opts2 = tokens.map(t => `<option value="${esc(t.actor.id)}">${esc(t.actor.name)} (favor ${_favorOf(t.actor, fid)})</option>`).join("");
                const pick = await new Promise(resolve => {
                  new Dialog({
                    title: eff.title || "Adjust Favor",
                    content: `<form><p>${esc(eff.prompt || `Choose courtier (favor ${eff.delta > 0 ? "+" : ""}${eff.delta} toward ${selfSide === "A" ? A.name : D.name})`)}.</p><div class="form-group"><label>Courtier</label><select name="cid">${opts2}</select></div></form>`,
                    buttons: {
                      ok: { label: "Choose", callback: html => resolve(game.actors.get(html[0].querySelector("[name=cid]").value) || null) },
                      cancel: { label: "Cancel", callback: () => resolve(null) }
                    },
                    default: "ok",
                    close: () => resolve(null)
                  }, { width: 360 }).render(true);
                });
                if (pick) await adjustFavor(pick.id, fid, eff.delta || 1);
                break;
              }
              case "discardSecret":
                await discardSecret(resolveSide(eff.side), eff.filter || {}); break;
              case "lockSpend":
                lockSpend(eff.rounds || 1, eff.maxSpend ?? 0);
                await sendChat([`Spending capped to ${eff.maxSpend ?? 0} OP per side for ${eff.rounds || 1} round(s) (Call the Question).`], { title: `${label}: Spending Lock` });
                break;
              case "armLastWord":
                await armLastWord(resolveSide(eff.side), eff.source || "The Last Word"); break;
              case "drawSecret":
                await drawSecret(resolveSide(eff.side), eff.acquisition || "earned"); break;
              case "spendFavor":
                await spendFavorAndBoost(selfSide, { minFavor: eff.minFavor ?? 2 }); break;
              case "noteForGM":
                await ChatMessage.create({ content: `<p><em>${esc(eff.text || "")}</em></p>`, whisper: gmIds(), speaker: { alias: "BBTTCC Courtly Intrigue" } }).catch(()=>{});
                break;
              case "burnScandalScar": {
                const ok = await burnScandalScar(resolveSide(eff.side));
                // If burn failed (no scar), suppress subsequent effects on this entry.
                if (!ok) break;
                break;
              }
              case "phaseEStub":
                ui.notifications?.warn?.(`${eff.maneuver || "This maneuver"} requires Phase E (Scandal Scars). Stubbed for now.`);
                break;
              default:
                console.warn(TAG, "unknown scenarioEffect type:", t, eff);
            }
          } catch (e) { console.warn(TAG, "applyEffects handler failed", t, e); }
        }
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
      }

      // Phase E — Mask Off API. Burns a pending light scar on `side` and
      // returns true if one was burned (lets the dispatcher decide whether
      // to follow up with the bonus + suspicion rise).
      async function burnScandalScar(side) {
        const s = _normSide(side);
        if (!s) return false;
        const actor = s === "A" ? A : D;
        const scars = foundry.utils.duplicate(actor.flags?.["bbttcc-raid"]?.scandalScars || []);
        const lightIdx = scars.findIndex(x => x.severity === "light");
        if (lightIdx < 0) {
          ui.notifications?.warn?.(`${actor.name} has no Scandal Scar to burn.`);
          return false;
        }
        scars.splice(lightIdx, 1);
        await actor.update({ "flags.bbttcc-raid.scandalScars": scars });
        await sendChat([`${esc(actor.name)} burns a Scandal Scar — Mask Off.`], { title: `${label}: Mask Off` });
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return true;
      }

      // Phase E — Per-outcome marks per spec §6. Called once after the
      // outcome is determined; idempotent guard via state.marksApplied.
      async function _applyOutcomeMarks() {
        if (state.marksApplied) return;
        state.marksApplied = true;
        const winner = outcomeWinner(state); // "A"|"D"|null
        const kind = state.outcomeKind;
        const winActor = winner === "A" ? A : winner === "D" ? D : null;
        const losActor = winner === "A" ? D : winner === "D" ? A : null;
        const winFid   = winner === "A" ? state.attackerId : winner === "D" ? state.defenderId : null;
        const raidId   = `${state.attackerId}::${state.defenderId}::${Date.now()}`;
        const lines = [];

        const courtierTokens = () => (canvas?.tokens?.placeables || [])
          .filter(t => t.document?.flags?.["bbttcc-raid"]?.tableauActor === true && t.actor);

        async function bumpFavor(targetActor, factionId, delta, cap = 3) {
          const cur = foundry.utils.duplicate(targetActor.flags?.["bbttcc-raid"]?.courtFavor || {});
          const before = Number(cur[factionId] ?? 0);
          const after = Math.max(-3, Math.min(cap, before + delta));
          if (after === before) return false;
          cur[factionId] = after;
          await targetActor.update({ "flags.bbttcc-raid.courtFavor": cur });
          return true;
        }

        if (kind === "cleanTriumph" && winActor && winFid) {
          // +1 favor with all on-tableau courtiers (cap +3 per courtier)
          let bumped = 0;
          for (const tk of courtierTokens()) {
            if (await bumpFavor(tk.actor, winFid, +1, 3)) bumped++;
          }
          lines.push(`Clean Triumph — ${esc(winActor.name)} gains +1 favor with ${bumped} courtier(s).`);
          // Loser: -1 Influence cap on next courtly raid (flag on the faction)
          if (losActor) {
            const flags = foundry.utils.duplicate(losActor.flags?.["bbttcc-raid"] || {});
            flags.nextCourtlyInfluenceCapDelta = Math.min(-1, Number(flags.nextCourtlyInfluenceCapDelta || 0) - 1);
            await losActor.update({ "flags.bbttcc-raid": flags });
            lines.push(`${esc(losActor.name)} suffers −1 Influence cap on their next courtly raid.`);
          }
          // Clear winner's light scars (spec §4.1 lifecycle)
          const cleared = await clearLightScars(winActor);
          if (cleared > 0) lines.push(`${esc(winActor.name)} clears ${cleared} light Scandal Scar(s).`);
        }
        else if (kind === "tarnishedVictory" && winActor && winFid && losActor) {
          // Winner: 1 Earned Secret + 1 Favor with 1 courtier (highest current favor)
          await drawSecret(winner, "earned");
          const cands = courtierTokens()
            .map(t => ({ t, fav: Number(t.actor.flags?.["bbttcc-raid"]?.courtFavor?.[winFid] ?? 0) }))
            .sort((a, b) => b.fav - a.fav);
          if (cands.length > 0) {
            await bumpFavor(cands[0].t.actor, winFid, +1, 3);
            lines.push(`${esc(winActor.name)} earns the loyalty of <b>${esc(cands[0].t.actor.name)}</b> (+1 favor).`);
          }
          // Loser: light Scandal Scar
          await writeScandalScar(losActor, "light", raidId);
          lines.push(`${esc(losActor.name)} earns a Scandal Scar (light).`);
        }
        else if (kind === "stalemate") {
          // Both: 1 Earned Secret each; suspicion resets to 3
          await drawSecret("A", "earned");
          await drawSecret("D", "earned");
          state.suspicion = 3;
          state.suspicionQuietStreak = 0;
          lines.push("Stalemate — both factions draw an Earned secret. Suspicion resets to 3.");
        }
        else if (kind === "publicHumiliation" && winActor && winFid && losActor) {
          // Loser: Scandal Scar (heavy) + Disgraced pip
          await writeScandalScar(losActor, "heavy", raidId);
          const flags = foundry.utils.duplicate(losActor.flags?.["bbttcc-raid"] || {});
          flags.disgracedUntil = Date.now() + (3 * 7 * 24 * 60 * 60 * 1000); // ~3 weekly sessions
          await losActor.update({ "flags.bbttcc-raid": flags });
          lines.push(`${esc(losActor.name)} earns a Scandal Scar (HEAVY) — Disgraced.`);
          // Winner: +1 favor on top 2 courtiers
          const cands = courtierTokens()
            .map(t => ({ t, fav: Number(t.actor.flags?.["bbttcc-raid"]?.courtFavor?.[winFid] ?? 0) }))
            .sort((a, b) => b.fav - a.fav)
            .slice(0, 2);
          for (const { t } of cands) {
            await bumpFavor(t.actor, winFid, +1, 3);
          }
          if (cands.length) lines.push(`${esc(winActor.name)} consolidates support among <b>${cands.map(c => esc(c.t.actor.name)).join(", ")}</b> (+1 favor each).`);
        }
        else if (kind === "mutualRuin") {
          // Both: Scandal Scar (light); 2 courtiers retire (unflag)
          await writeScandalScar(A, "light", raidId);
          await writeScandalScar(D, "light", raidId);
          const all = courtierTokens();
          const shuf = all.slice().sort(() => Math.random() - 0.5).slice(0, 2);
          for (const tk of shuf) {
            await tk.document.update({ "flags.bbttcc-raid.tableauActor": false });
          }
          if (shuf.length) lines.push(`Mutual Ruin — <b>${shuf.map(t => esc(t.actor.name)).join(", ")}</b> retire from court in disgust.`);
          lines.push("Both factions earn a Scandal Scar (light).");
        }

        if (lines.length) await sendChat(lines, { title: `${label}: ${kind || "Outcome"}` });
      }

      const apiObj = { step, getState, raiseSuspicion, lowerSuspicion, adjustFavor, queueRollMod, queueReroll, dealInfluenceDamage, clearScandal, queueActionBonus, discardSecret, lockSpend, drawSecret, spendFavorAndBoost, applyEffects, burnScandalScar, armLastWord };

      // Convenience for GM
      raidApi._lastCourtly = apiObj;

      console.log(TAG, "Courtly Intrigue scenario created:", {
        attacker: A.name, defender: D.name,
        influenceA: state.influenceA,
        influenceD: state.influenceD
      });

      try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}

      return apiObj;
    };

    console.log(TAG, "Courtly Intrigue engine attached to raid API.");
  });
})();

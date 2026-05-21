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

  // Spec §4.4 — outcome-driven rel-delta magnitudes mapped to the current
  // 3-outcome Phase C simplification. Phase E will replace with the 5-outcome
  // table when it ships Clean Triumph / Tarnished Victory / etc.
  const REL_DELTA_TABLE = Object.freeze({
    attackerWin: { att2def: -1, def2att: -2 }, // ≈ Clean Triumph
    defenderWin: { att2def: +1, def2att: -2 }, // ≈ Public Humiliation of attacker
    mutualRuin:  { att2def: -2, def2att: -2 }
  });

  async function applyRelDeltas(A, D, outcome, label) {
    const d = REL_DELTA_TABLE[outcome];
    if (!d) return;
    const reason = `${label || "Courtly Intrigue"}: ${outcome}`;
    await shiftRelTier(A, D, d.att2def, reason);
    await shiftRelTier(D, A, d.def2att, reason);
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

      const state = {
        attackerId: A.id,
        defenderId: D.id,
        label,
        round: 0,
        outcome: "ongoing", // "ongoing" | "attackerWin" | "defenderWin" | "mutualRuin"
        influenceA: computeInfluenceHP({ baseCommitDip: atkInitDip, baseCommitSoft: atkInitSoft }),
        influenceD: computeInfluenceHP({ baseCommitDip: defInitDip, baseCommitSoft: defInitSoft }),
        scandalOnA: false,
        scandalOnD: false,
        // Phase C — Suspicion / Court Bonus / collapse flag
        suspicion: 0,                  // 0..10 per spec §4.1
        suspicionQuietStreak: 0,       // consecutive rounds with no expose/intimidate
        courtBonusA: 0,                // computed at step() entry from courtier favor
        courtBonusD: 0,
        courtCollapsed: false,         // set when suspicion hits 10; Phase E refines outcome
        // Phase C — Pending mods queue (consumed at next step() entry).
        // Each entry: { side: "A"|"D", type: "bonus"|"forceReroll", value?, source }
        pendingMods: [],
        history: []
      };

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
        // Phase D — Also consume `actionBonus` entries that match this
        // round's chosen action; carry forward those whose filter didn't match.
        let forceAReroll = false, forceDReroll = false;
        const consumedMods = [];
        const carriedMods = [];
        for (const mod of (state.pendingMods || [])) {
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
        state.suspicion = clamp(suspBefore + suspDelta, 0, 10);

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

        // Phase C — Rel-delta on outcome transition. Step() early-returns
        // when state.outcome !== "ongoing" at entry, so any non-ongoing
        // outcome we see here IS this round's transition. Fires once.
        if (state.outcome !== "ongoing") {
          try { await applyRelDeltas(A, D, state.outcome, label); }
          catch (e) { console.warn(TAG, "applyRelDeltas failed", e); }
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
              case "drawSecret":
                await drawSecret(resolveSide(eff.side), eff.acquisition || "earned"); break;
              case "spendFavor":
                await spendFavorAndBoost(selfSide, { minFavor: eff.minFavor ?? 2 }); break;
              case "noteForGM":
                await ChatMessage.create({ content: `<p><em>${esc(eff.text || "")}</em></p>`, whisper: gmIds(), speaker: { alias: "BBTTCC Courtly Intrigue" } }).catch(()=>{});
                break;
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

      const apiObj = { step, getState, raiseSuspicion, lowerSuspicion, adjustFavor, queueRollMod, queueReroll, dealInfluenceDamage, clearScandal, queueActionBonus, discardSecret, lockSpend, drawSecret, spendFavorAndBoost, applyEffects };

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

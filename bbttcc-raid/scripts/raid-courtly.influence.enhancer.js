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

        // Spend OP from relevant pools
        if (atkKey && atkSpendInt) await adjustOpBank(A, atkKey, -atkSpendInt, label);
        if (defKey && defSpendInt) await adjustOpBank(D, defKey, -defSpendInt, label);

        // Compute bonuses
        let atkBonus = Number(atkSkillBonus || 0);
        let defBonus = Number(defSkillBonus || 0);

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

        // Apply scandal penalties (–2 next exchange)
        if (state.scandalOnA) atkBonus -= 2;
        if (state.scandalOnD) defBonus -= 2;

        // Clear scandal markers; new ones may be set based on this round
        let nextScandalOnA = false;
        let nextScandalOnD = false;

        const atkRoll = await (new Roll("1d20 + @b", { b: atkBonus })).evaluate();
        const defRoll = await (new Roll("1d20 + @b", { b: defBonus })).evaluate();

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

        // Determine outcome
        if (state.influenceA <= 0 && state.influenceD <= 0) {
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
          note
        };
        state.history.push(histEntry);

        const lines = [
          `Round ${state.round}: <b>${foundry.utils.escapeHTML(A.name)}</b> vs <b>${foundry.utils.escapeHTML(D.name)}</b>`,
          `Actions: Attacker <i>${atkAct}</i> (spend ${atkSpendInt}) vs Defender <i>${defAct}</i> (spend ${defSpendInt})`,
          `Rolls: Attacker ${atkTotal} vs Defender ${defTotal} (margin ${margin >= 0 ? "+"+margin : margin})`,
          `Result: ${result.toUpperCase()} — Influence ${beforeA}/${beforeD} → ${state.influenceA}/${state.influenceD}`
        ];
        if (extraNotes.length) lines.push(...extraNotes.map(n => foundry.utils.escapeHTML(n)));
        if (note) lines.push(foundry.utils.escapeHTML(note));

        let title = `${label}: Round ${state.round}`;
        if (state.outcome === "attackerWin") title += " — Attacker Wins";
        else if (state.outcome === "defenderWin") title += " — Defender Wins";
        else if (state.outcome === "mutualRuin") title += " — Mutual Ruin";

        await sendChat(lines, { title });

        return { ...state };
      }

      function getState() {
        try { return structuredClone(state); }
        catch { return JSON.parse(JSON.stringify(state)); }
      }

      const apiObj = { step, getState };

      // Convenience for GM
      raidApi._lastCourtly = apiObj;

      console.log(TAG, "Courtly Intrigue scenario created:", {
        attacker: A.name, defender: D.name,
        influenceA: state.influenceA,
        influenceD: state.influenceD
      });

      return apiObj;
    };

    console.log(TAG, "Courtly Intrigue engine attached to raid API.");
  });
})();

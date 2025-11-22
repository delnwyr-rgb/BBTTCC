// modules/bbttcc-raid/scripts/raid-infiltration.alarm.enhancer.js
// BBTTCC — Infiltration Scenario Engine (Alarm-Banded)
//
// Features (per Gap Analysis Infiltration kernel):
// - Alarm track 0..alarmMax with bands: Quiet / Suspicious / Alerted / Lockdown
// - Opposed Intrigue vs Non-Lethal rolls driven by OP spend
// - Failures raise Alarm by 1–2 based on margin
// - Optional "flashback" to reduce Alarm by 1 at Intrigue OP cost (once per round)
// - Writes War Log entries and GM whispers for visibility
//
// API surface (attached to game.bbttcc.api.raid):
//   const infil = await game.bbttcc.api.raid.infiltration({
//     attackerId,
//     defenderId,
//     difficulty,   // defender bonus, default 0
//     alarmMax,     // default 5; raise to 6 for Covert Ops Tier 2, etc.
//     label         // scenario label for chat messages
//   });
//
//   await infil.step({ spendIntrigue, spendNonlethal, note });
//   await infil.flashback({ costIntrigue, note });
//   const state = infil.getState();
//
// Last created scenario is also exposed as game.bbttcc.api.raid._lastInfiltration.

(() => {
  const MOD_R = "bbttcc-raid";
  const MODF  = "bbttcc-factions";
  const TAG   = "[bbttcc-raid/infiltration]";

  const clamp = (v,min,max)=>Math.max(min,Math.min(max,Number(v||0)));
  const dup   = (x)=>foundry.utils.duplicate(x||{});
  const gmIds = () => game.users?.filter(u=>u.isGM).map(u=>u.id) ?? [];

  function bandFromAlarm(alarm) {
    const a = Number(alarm||0);
    if (a <= 1) return "quiet";
    if (a <= 3) return "suspicious";
    if (a === 4) return "alerted";
    return "lockdown";
  }

  async function adjustOpBank(actor, key, delta) {
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
      scenario: "infiltration",
      summary: `OP ${k} ${sign}${delta} (Infiltration)`
    });
    flags.warLogs = war;

    await actor.update({ [`flags.${MODF}`]: flags });
  }

  async function sendChat(lines, {title="Infiltration Update"}={}) {
    if (!lines.length) return;
    await ChatMessage.create({
      content: `<p><b>${title}</b></p>${lines.join("<br/>")}`,
      whisper: gmIds(),
      speaker: { alias: "BBTTCC Infiltration" }
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

  whenRaidReady((raidApi) => {
    raidApi.infiltration = async function createInfiltrationScenario({
      attackerId,
      defenderId,
      difficulty = 0,
      alarmMax = 5,
      label = "Infiltration"
    } = {}) {
      const A = game.actors.get(String(attackerId||"").replace(/^Actor\./,""));
      const D = game.actors.get(String(defenderId||"").replace(/^Actor\./,""));
      if (!A || !D) throw new Error(`${TAG} attacker or defender not found`);

      const state = {
        attackerId: A.id,
        defenderId: D.id,
        label,
        difficulty: Number(difficulty||0),
        alarm: 0,
        alarmMax: Number(alarmMax||5),
        round: 0,
        outcome: "ongoing", // "ongoing" | "lockdown" | (future: "success")
        history: [],
        _flashbackUsedThisRound: false
      };

      async function step({ spendIntrigue = 2, spendNonlethal = 2, note = "" } = {}) {
        if (state.outcome !== "ongoing") return { ...state, note: "scenario already resolved" };

        state.round += 1;
        state._flashbackUsedThisRound = false;

        const atkSpend = Math.max(0, Math.floor(Number(spendIntrigue||0)));
        const defSpend = Math.max(0, Math.floor(Number(spendNonlethal||0)));

        // Spend OPs (negative delta)
        if (atkSpend) await adjustOpBank(A, "intrigue", -atkSpend);
        if (defSpend) await adjustOpBank(D, "nonlethal", -defSpend);

        const atkBonus = Math.ceil(atkSpend / 2);
        const defBonus = Math.ceil(defSpend / 2) + Math.max(0, Math.floor(state.difficulty));

        const atkRoll = await (new Roll("1d20 + @b", { b: atkBonus })).evaluate({ async: true });
        const defRoll = await (new Roll("1d20 + @b", { b: defBonus })).evaluate({ async: true });

        const atkTotal = atkRoll.total ?? 0;
        const defTotal = defRoll.total ?? 0;
        const margin   = atkTotal - defTotal;

        let result;
        if (atkTotal === defTotal) result = "tie";
        else if (atkTotal > defTotal) result = "attacker";
        else result = "defender";

        const beforeAlarm = state.alarm;
        let afterAlarm = beforeAlarm;

        if (result === "defender") {
          // Failure → raise alarm by 1 or 2 based on severity
          const lossMargin = defTotal - atkTotal;
          afterAlarm += (lossMargin >= 6 ? 2 : 1);
        }

        // Clamp to max
        afterAlarm = Math.min(afterAlarm, state.alarmMax);
        state.alarm = afterAlarm;

        // Outcome transition
        if (afterAlarm >= state.alarmMax) {
          state.outcome = "lockdown";
        }

        const entry = {
          round: state.round,
          atkSpend,
          defSpend,
          atkTotal,
          defTotal,
          margin,
          result,
          alarmBefore: beforeAlarm,
          alarmAfter: afterAlarm,
          band: bandFromAlarm(afterAlarm),
          note
        };
        state.history.push(entry);

        const lines = [
          `Round ${state.round}: <b>${foundry.utils.escapeHTML(A.name)}</b> vs <b>${foundry.utils.escapeHTML(D.name)}</b>`,
          `Rolls: Attacker ${atkTotal} vs Defender ${defTotal} (margin ${margin >=0 ? "+"+margin : margin})`,
          `Result: ${result.toUpperCase()} — Alarm ${beforeAlarm} → ${afterAlarm} (${bandFromAlarm(afterAlarm)})`
        ];
        if (note) lines.push(foundry.utils.escapeHTML(note));

        await sendChat(lines, { title: `${label}: Round ${state.round}` });

        return { ...state };
      }

      async function flashback({ costIntrigue = 2, note = "" } = {}) {
        if (state.outcome !== "ongoing") return { ...state, note: "scenario already resolved" };
        if (state._flashbackUsedThisRound) {
          return { ...state, note: "flashback already used this round" };
        }
        if (state.alarm <= 0) {
          return { ...state, note: "alarm already at 0" };
        }

        const spend = Math.max(0, Math.floor(Number(costIntrigue||0)));
        if (spend <= 0) return { ...state, note: "no cost specified" };

        await adjustOpBank(A, "intrigue", -spend);
        const before = state.alarm;
        state.alarm = Math.max(0, state.alarm - 1);
        state._flashbackUsedThisRound = true;

        const lines = [
          `<b>Flashback:</b> ${foundry.utils.escapeHTML(A.name)} spends ${spend} Intrigue OP to reduce Alarm ${before} → ${state.alarm}.`,
        ];
        if (note) lines.push(foundry.utils.escapeHTML(note));
        await sendChat(lines, { title: `${label}: Flashback` });

        return { ...state };
      }

      function getState() {
        try {
          // modern browsers
          return structuredClone(state);
        } catch {
          return JSON.parse(JSON.stringify(state));
        }
      }

      const apiObj = { step, flashback, getState };

      // Convenience handle for GM: last infiltration scenario
      raidApi._lastInfiltration = apiObj;

      console.log(TAG, "Infiltration scenario created:", {
        attacker: A.name,
        defender: D.name,
        alarmMax: state.alarmMax
      });

      return apiObj;
    };

    console.log(TAG, "Infiltration engine attached to raid API.");
  });
})();

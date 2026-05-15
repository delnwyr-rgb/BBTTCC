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

  function getFX() {
    return game?.bbttcc?.api?.fx || null;
  }

  async function playRollFX(ctx = {}) {
    try {
      const fx = getFX();
      if (!fx || typeof fx.playRolls !== "function") return;
      await fx.playRolls({
        raidType: "infiltration",
        label: "Infiltration Clash",
        attackerName: ctx.attackerName,
        defenderName: ctx.defenderName,
        attackerTotal: ctx.attackerTotal,
        defenderTotal: ctx.defenderTotal,
        margin: ctx.margin
      });
    } catch (_e) {}
  }

  async function playAlarmFX(ctx = {}) {
    try {
      const fx = getFX();
      if (!fx || typeof fx.playScenarioShift !== "function") return;
      await fx.playScenarioShift("infiltration_alarm", {
        raidType: "infiltration",
        outcome: `Alarm ${ctx.before} → ${ctx.after} — ${ctx.band}`
      }, { raidType: "infiltration" });
    } catch (_e) {}
  }


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
      progressMax = 5,
      messyThreshold,
      label = "Infiltration"
    } = {}) {
      const A = game.actors.get(String(attackerId||"").replace(/^Actor\./,""));
      const D = game.actors.get(String(defenderId||"").replace(/^Actor\./,""));
      if (!A || !D) throw new Error(`${TAG} attacker or defender not found`);

      const _alarmMax = Number(alarmMax || 5);
      const _progressMax = Number(progressMax || 5);
      const _messyThreshold = Number.isFinite(Number(messyThreshold))
        ? clamp(Number(messyThreshold), 0, _alarmMax)
        : Math.max(1, _alarmMax - 2);

      const state = {
        attackerId: A.id,
        defenderId: D.id,
        label,
        difficulty: Number(difficulty||0),
        alarm: 0,
        alarmMax: _alarmMax,
        progress: 0,
        progressMax: _progressMax,
        messyThreshold: _messyThreshold,
        round: 0,
        outcome: "ongoing", // "ongoing" | "clean" | "messy" | "detected"
        flipResolution: null, // null | "violence" | "escape" | "negotiate" (S3a.1)
        history: [],
        _flashbackUsedThisRound: false
      };

      // ---- S3a.1: outcome resolver + chat card + GM-prompted flip dialog ----
      function _resolveOutcome() {
        if (state.outcome !== "ongoing") return state.outcome;
        // Detection caps first — highest priority (the flip path)
        if (state.alarm >= state.alarmMax) { state.outcome = "detected"; return "detected"; }
        // Objective hit → clean if alarm low, messy if alarm at/above threshold
        if (state.progress >= state.progressMax) {
          state.outcome = (state.alarm >= state.messyThreshold) ? "messy" : "clean";
        }
        return state.outcome;
      }

      async function sendOutcomeCard(outcome) {
        const aName = foundry.utils.escapeHTML(A.name);
        const dName = foundry.utils.escapeHTML(D.name);
        const meterLine = `Final state — Progress ${state.progress}/${state.progressMax} · Alarm ${state.alarm}/${state.alarmMax} (${bandFromAlarm(state.alarm)})`;
        let title, lines;
        if (outcome === "clean") {
          title = `${label}: Clean Extraction`;
          lines = [`<b>🥷 ${aName} achieved the objective without raising the alarm.</b>`, meterLine, `No alerted-defender penalty carries forward.`];
        } else if (outcome === "messy") {
          title = `${label}: Messy Extraction`;
          lines = [`<b>⚠ ${aName} achieved the objective, but ${dName} is on alert.</b>`, meterLine, `Next raid against ${dName} inherits a defender-alerted bonus.`];
        } else if (outcome === "detected") {
          title = `${label}: 🚨 Alarm Cap Reached`;
          lines = [`<b>${aName} has been detected at ${dName}.</b>`, meterLine, `GM: choose how this ends — convert to Violence Raid, escape now, or negotiate.`];
        } else { return; }
        await sendChat(lines, { title });
      }

      async function promptFlipDialog() {
        if (!game.user?.isGM) return null;
        let choice = null;
        try {
          const dlg = new foundry.applications.api.DialogV2({
            window: { title: `${label}: Detected — Choose Outcome`, resizable: false },
            position: { width: 520 },
            content: `<form><div style="padding:8px 6px;">
              <p><b>🚨 Alarm capped at ${state.alarm}/${state.alarmMax}.</b></p>
              <p>${foundry.utils.escapeHTML(A.name)} infiltrated ${foundry.utils.escapeHTML(D.name)} but tripped the alarm at progress ${state.progress}/${state.progressMax}.</p>
              <p style="margin-top:.6rem;"><b>How does this end?</b></p>
              <ul style="margin: .25rem 0 .25rem 1.2rem; font-size:12px;">
                <li><b>Convert to Violence:</b> mid-round flip to a Violence Raid with current state preserved.</li>
                <li><b>Escape Now:</b> attackers flee with what they got. No defender retaliation.</li>
                <li><b>Negotiate:</b> hold the table — GM resolves narratively (capture, parlay, costly escape).</li>
              </ul>
            </div></form>`,
            buttons: [
              { action: "violence",  label: "⚔ Convert to Violence", default: true, callback: () => { choice = "violence";  } },
              { action: "escape",    label: "🏃 Escape Now",                          callback: () => { choice = "escape";    } },
              { action: "negotiate", label: "🤝 Negotiate",                           callback: () => { choice = "negotiate"; } }
            ],
            rejectClose: false
          });
          await dlg.render(true);
          if (typeof dlg.wait === "function") await dlg.wait().catch(() => null);
        } catch (e) { console.warn(TAG, "promptFlipDialog failed", e); }
        state.flipResolution = choice;
        if (choice) {
          const blurb = ({
            violence:  `GM resolves: <b>convert to Violence Raid</b> — current state preserved, no reset.`,
            escape:    `GM resolves: <b>attackers escape</b> — no defender retaliation.`,
            negotiate: `GM resolves: <b>negotiate</b> — held at the table for narrative resolution.`
          })[choice];
          await sendChat([blurb], { title: `${label}: GM Resolution` });
        }
        return choice;
      }

      async function _onOutcomeResolved(outcome) {
        await sendOutcomeCard(outcome);
        if (outcome === "detected") await promptFlipDialog();
      }
      // ---------------------------------------------------------------------

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

        const atkRoll = await (new Roll("2d10 + @b", { b: atkBonus })).evaluate();
        const defRoll = await (new Roll("2d10 + @b", { b: defBonus })).evaluate();

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

        await playRollFX({
          attackerName: A.name,
          defenderName: D.name,
          attackerTotal: atkTotal,
          defenderTotal: defTotal,
          margin
        });
        await playAlarmFX({ before: beforeAlarm, after: afterAlarm, band: bandFromAlarm(afterAlarm) });

        const lines = [
          `Round ${state.round}: <b>${foundry.utils.escapeHTML(A.name)}</b> vs <b>${foundry.utils.escapeHTML(D.name)}</b>`,
          `Rolls: Attacker ${atkTotal} vs Defender ${defTotal} (margin ${margin >=0 ? "+"+margin : margin})`,
          `Result: ${result.toUpperCase()} — Alarm ${beforeAlarm} → ${afterAlarm} (${bandFromAlarm(afterAlarm)})`
        ];
        if (note) lines.push(foundry.utils.escapeHTML(note));

        await sendChat(lines, { title: `${label}: Round ${state.round}` });

        // S3a.1: resolve outcome after round commits, fire card + flip dialog as needed
        _resolveOutcome();
        if (state.outcome !== "ongoing") await _onOutcomeResolved(state.outcome);

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

        await playAlarmFX({ before, after: state.alarm, band: bandFromAlarm(state.alarm) });

        const lines = [
          `<b>Flashback:</b> ${foundry.utils.escapeHTML(A.name)} spends ${spend} Intrigue OP to reduce Alarm ${before} → ${state.alarm}.`,
        ];
        if (note) lines.push(foundry.utils.escapeHTML(note));
        await sendChat(lines, { title: `${label}: Flashback` });

        return { ...state };
      }

      async function applyEffects(effects = []) {
        effects = Array.isArray(effects) ? effects : [];
        if (!effects.length) return getState();
        const beforeAlarm = state.alarm;
        const beforeProgress = state.progress;
        let alarmChanged = false;
        let progressChanged = false;
        for (const e of effects) {
          const t = String(e?.type || "").trim();
          if (t === "alarmDelta") {
            const d = Number(e?.delta || 0) || 0;
            if (!d) continue;
            const next = clamp(state.alarm + d, 0, state.alarmMax);
            if (next !== state.alarm) { state.alarm = next; alarmChanged = true; }
          } else if (t === "progressDelta") {
            const d = Number(e?.delta || 0) || 0;
            if (!d) continue;
            const next = clamp(state.progress + d, 0, state.progressMax);
            if (next !== state.progress) { state.progress = next; progressChanged = true; }
          }
        }
        if (alarmChanged || progressChanged) {
          const parts = [`<b>Maneuver Effects:</b>`];
          if (alarmChanged)    parts.push(`Alarm ${beforeAlarm} → ${state.alarm} (${bandFromAlarm(state.alarm)})`);
          if (progressChanged) parts.push(`Progress ${beforeProgress} → ${state.progress}/${state.progressMax}`);
          await sendChat([parts.join("<br/>")], { title: `${label}: Effects` });
          // S3a.1: resolve outcome if any meter moved
          if (state.outcome === "ongoing") {
            _resolveOutcome();
            if (state.outcome !== "ongoing") await _onOutcomeResolved(state.outcome);
          }
        }
        return getState();
      }

      async function reset({ alarm = 0, progress = 0 } = {}) {
        state.alarm = clamp(Number(alarm || 0), 0, state.alarmMax);
        state.progress = clamp(Number(progress || 0), 0, state.progressMax);
        state.outcome = "ongoing";
        state.flipResolution = null;
        state._flashbackUsedThisRound = false;
        _resolveOutcome(); // re-derive if reset values are already at cap
        return getState();
      }

      function getState() {
        try {
          // modern browsers
          return structuredClone(state);
        } catch {
          return JSON.parse(JSON.stringify(state));
        }
      }

      const apiObj = { step, flashback, applyEffects, reset, getState };

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
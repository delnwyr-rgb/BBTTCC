// modules/bbttcc-raid/scripts/raid-infiltration.alarm.enhancer.js
// Bad Eden — Infiltration Scenario Engine (Alarm-Banded)
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

  // Mirror the GM-side bbttcc:infiltration:* hook to remote clients so the
  // canvas-VFX bridge fires for every player, not only the GM running step().
  // The full scenario snapshot is dropped — canvas-vfx only reads scalar
  // fields, and we don't want to balloon every socket frame.
  function _emitInfilHookRelay(hookName, p) {
    try {
      if (!game?.socket?.emit) return;
      const slim = {
        before: p?.before, after: p?.after, delta: p?.delta,
        outcome: p?.outcome,
        attackerId: p?.attackerId, defenderId: p?.defenderId
      };
      game.socket.emit(`module.${MOD_R}`, { t: "infilHook", hook: hookName, payload: slim });
    } catch (_e) { /* socket optional */ }
  }

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

  async function sendChat(lines, {title="Infiltration Update", rolls=null, whisper="gm"}={}) {
    if (!lines.length) return;
    const data = {
      content: `<p><b>${title}</b></p>${lines.join("<br/>")}`,
      speaker: { alias: "Bad Eden Infiltration" }
    };
    // S3a.5.2: GM-only by default for narrative cards; "public" for round
    // summaries so players see the math + dice. Passing Roll objects in
    // `rolls` triggers Dice So Nice automatically (no DSN = no-op).
    if (whisper === "gm") data.whisper = gmIds();
    if (Array.isArray(rolls) && rolls.length) data.rolls = rolls;
    await ChatMessage.create(data).catch(()=>{});
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
        pendingDiscoveries: [], // S3a.2: [{turnsRemaining, alarmGain, note}]
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
        // S3a.4: emit outcome hook BEFORE the flip dialog so VFX is in flight
        try { Hooks.callAll("bbttcc:infiltration:outcomeResolved", { scenario: getState(), outcome, attackerId: A.id, defenderId: D.id }); } catch (_) {}
        _emitInfilHookRelay("bbttcc:infiltration:outcomeResolved", { outcome, attackerId: A.id, defenderId: D.id });
        if (outcome === "detected") await promptFlipDialog();
      }
      // ---------------------------------------------------------------------

      async function step({ spendIntrigue = 2, spendNonlethal = 2, note = "", stewardBonus = 0, exposedCount = 0, atkOpBonus = 0, defOpBonus = 0 } = {}) {
        if (state.outcome !== "ongoing") return { ...state, note: "scenario already resolved" };

        const _stepBeforeAlarm = state.alarm; // S3a.4: VFX hook baseline

        state.round += 1;
        state._flashbackUsedThisRound = false;

        // S3a.2: tick pending body-discovery timers BEFORE the round's opposed roll.
        // Bodies left behind from earlier rounds may be found at round start;
        // their alarm spike feeds into this round's resolution.
        if (state.pendingDiscoveries.length) {
          const stillPending = [];
          for (const pd of state.pendingDiscoveries) {
            pd.turnsRemaining -= 1;
            if (pd.turnsRemaining <= 0) {
              const before = state.alarm;
              state.alarm = clamp(state.alarm + Number(pd.alarmGain || 1), 0, state.alarmMax);
              const noteHtml = foundry.utils.escapeHTML(String(pd.note || "concealed body"));
              await sendChat([`🕯 <b>Body discovered:</b> ${noteHtml} — Alarm ${before} → ${state.alarm} (${bandFromAlarm(state.alarm)})`], { title: `${label}: Body Discovery` });
            } else {
              stillPending.push(pd);
            }
          }
          state.pendingDiscoveries = stillPending;
          // If discovery alarm-capped us, resolve + return before the round even runs
          _resolveOutcome();
          if (state.outcome !== "ongoing") {
            await _onOutcomeResolved(state.outcome);
            return { ...state };
          }
        }

        const atkSpend = Math.max(0, Math.floor(Number(spendIntrigue||0)));
        const defSpend = Math.max(0, Math.floor(Number(spendNonlethal||0)));

        // Spend OPs (negative delta)
        if (atkSpend) await adjustOpBank(A, "intrigue", -atkSpend);
        if (defSpend) await adjustOpBank(D, "nonlethal", -defSpend);

        // S3a.5: Steward chip declarations bias the attacker roll.
        const stewBonus = Math.max(0, Math.floor(Number(stewardBonus || 0)));
        // Lead + Support coalition OP bonus (intrigue for attacker, nonlethal for defender);
        // caller computes via _rcCoalitionBonus and passes the totals here.
        const atkCoalition = Math.max(0, Math.floor(Number(atkOpBonus || 0)));
        const defCoalition = Math.max(0, Math.floor(Number(defOpBonus || 0)));
        const atkBonus = Math.ceil(atkSpend / 2) + stewBonus + atkCoalition;
        const defBonus = Math.ceil(defSpend / 2) + Math.max(0, Math.floor(state.difficulty)) + defCoalition;

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

        // S3a.5: Exposed stewards (declared "passed" or undeclared) amplify
        // the alarm rise on defender win. ceil(exposed/2) capped at +2.
        const exposureExtra = Math.min(2, Math.ceil(Math.max(0, Number(exposedCount || 0)) / 2));
        if (result === "defender") {
          // Failure → raise alarm by 1 or 2 based on severity, + exposure penalty
          const lossMargin = defTotal - atkTotal;
          afterAlarm += (lossMargin >= 6 ? 2 : 1) + exposureExtra;
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

        // S3a.5.2 — breakdown components, so players can verify every input
        // actually applied. Dice sums extracted from the Roll objects directly;
        // OP/steward/difficulty bonuses are the same numbers fed to the roll.
        const atkSpendBonus = Math.ceil(atkSpend / 2);
        const defSpendBonus = Math.ceil(defSpend / 2);
        const atkDiceSum = atkRoll?.dice?.[0]?.results?.reduce((s, r) => s + Number(r.result || 0), 0) ?? (atkTotal - atkBonus);
        const defDiceSum = defRoll?.dice?.[0]?.results?.reduce((s, r) => s + Number(r.result || 0), 0) ?? (defTotal - defBonus);
        const atkParts = [`${atkDiceSum} <small style="opacity:.7;">(2d10)</small>`];
        if (atkSpendBonus > 0) atkParts.push(`+ ${atkSpendBonus} <small style="opacity:.7;">(Intrigue OP × ${atkSpend})</small>`);
        if (stewBonus     > 0) atkParts.push(`+ ${stewBonus} <small style="opacity:.7;">(stewards × ${stewBonus})</small>`);
        if (atkCoalition  > 0) atkParts.push(`+ ${atkCoalition} <small style="opacity:.7;">(coalition Intrigue OP)</small>`);

        const defParts = [`${defDiceSum} <small style="opacity:.7;">(2d10)</small>`];
        if (defSpendBonus > 0) defParts.push(`+ ${defSpendBonus} <small style="opacity:.7;">(Nonlethal OP × ${defSpend})</small>`);
        if (Number(state.difficulty) > 0) defParts.push(`+ ${state.difficulty} <small style="opacity:.7;">(difficulty)</small>`);
        if (defCoalition  > 0) defParts.push(`+ ${defCoalition} <small style="opacity:.7;">(coalition Nonlethal OP)</small>`);

        const lines = [
          `Round ${state.round}: <b>${foundry.utils.escapeHTML(A.name)}</b> vs <b>${foundry.utils.escapeHTML(D.name)}</b>`,
          `🎲 Attacker: ${atkParts.join(" ")} = <b>${atkTotal}</b>`,
          `🎲 Defender: ${defParts.join(" ")} = <b>${defTotal}</b>`,
          `Margin: <b>${margin >= 0 ? "+" : ""}${margin}</b> — Result: <b>${result.toUpperCase()}</b>`,
          `Alarm <b>${beforeAlarm}</b> → <b>${afterAlarm}</b> (${bandFromAlarm(afterAlarm)})`
        ];
        if (result === "defender" && exposureExtra > 0) lines.push(`<span style="opacity:.7;color:#fbbf24;">⚠ Exposed stewards (${exposedCount}) added +${exposureExtra} to the alarm rise.</span>`);
        if (note) lines.push(foundry.utils.escapeHTML(note));

        // S3a.5.2 — pass Roll objects so Dice So Nice animates the 3D dice,
        // and make the round summary PUBLIC so players see the math + dice.
        await sendChat(lines, { title: `${label}: Round ${state.round}`, rolls: [atkRoll, defRoll], whisper: "public" });

        // S3a.4: emit alarm-change hook if step (incl. discovery tick) moved the meter
        try {
          if (state.alarm !== _stepBeforeAlarm) {
            const payload = { before: _stepBeforeAlarm, after: state.alarm, delta: state.alarm - _stepBeforeAlarm, attackerId: A.id, defenderId: D.id };
            Hooks.callAll("bbttcc:infiltration:alarmChanged", { scenario: getState(), ...payload });
            _emitInfilHookRelay("bbttcc:infiltration:alarmChanged", payload);
          }
        } catch (_) {}

        // S3a.1: resolve outcome after round commits, fire card + flip dialog as needed
        _resolveOutcome();
        if (state.outcome !== "ongoing") await _onOutcomeResolved(state.outcome);

        await persistState();
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

        await persistState();
        return { ...state };
      }

      async function applyEffects(effects = []) {
        effects = Array.isArray(effects) ? effects : [];
        if (!effects.length) return getState();
        const beforeAlarm = state.alarm;
        const beforeProgress = state.progress;
        let alarmChanged = false;
        let progressChanged = false;
        const verbLines = [];          // S3a.2: per-verb chat lines (reasoned)
        let forceDetected = false;     // S3a.2: escalateToViolence trigger
        const esc = (s) => foundry.utils.escapeHTML(String(s || ""));
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
          } else if (t === "alarmRise") {
            // S3a.2: positive alarm change with reason context
            const d = Math.abs(Number(e?.delta || 1)) || 1;
            const next = clamp(state.alarm + d, 0, state.alarmMax);
            if (next !== state.alarm) {
              verbLines.push(`📈 Alarm <b>+${d}</b>${e?.reason ? ` — ${esc(e.reason)}` : ""}`);
              state.alarm = next; alarmChanged = true;
            }
          } else if (t === "alarmDecay") {
            // S3a.2: negative alarm change with reason context
            const d = Math.abs(Number(e?.delta || 1)) || 1;
            const next = clamp(state.alarm - d, 0, state.alarmMax);
            if (next !== state.alarm) {
              verbLines.push(`📉 Alarm <b>-${d}</b>${e?.reason ? ` — ${esc(e.reason)}` : ""}`);
              state.alarm = next; alarmChanged = true;
            }
          } else if (t === "patrolTick") {
            // S3a.2: round-start scan — exposed = max(0, patrols - hidden) → +alarm
            const patrols = Math.max(0, Math.floor(Number(e?.patrols || 0)));
            const hidden  = Math.max(0, Math.floor(Number(e?.hidden  || 0)));
            const exposed = Math.max(0, patrols - hidden);
            if (exposed > 0) {
              const next = clamp(state.alarm + exposed, 0, state.alarmMax);
              const actualGain = next - state.alarm;
              if (actualGain > 0) {
                verbLines.push(`👁 Patrol scan: ${patrols} patrol(s) · ${hidden} hidden · <b>+${actualGain} alarm</b>`);
                state.alarm = next; alarmChanged = true;
              }
            } else if (patrols > 0) {
              verbLines.push(`👁 Patrol scan: ${patrols} patrol(s) · ${hidden} hidden · <i>no exposure</i>`);
            }
          } else if (t === "bodyDiscovery") {
            // S3a.2: register a deferred alarm spike (timer ticks in step())
            const turns      = Math.max(1, Math.floor(Number(e?.turns      || 2)));
            const alarmGain  = Math.max(1, Math.floor(Number(e?.alarmGain  || 2)));
            const note       = String(e?.note || "concealed body");
            state.pendingDiscoveries.push({ turnsRemaining: turns, alarmGain, note });
            verbLines.push(`🕯 Discovery timer set: <b>${esc(note)}</b> — +${alarmGain} alarm in ${turns} round(s)`);
          } else if (t === "extendDiscovery") {
            // S3a.3: mutate the most-recent pendingDiscovery — extend the timer,
            // reduce the alarm spike. Powers the conceal_body → subdue chain.
            const extraTurns      = Math.max(0, Math.floor(Number(e?.extraTurns      || 0)));
            const alarmReduction  = Math.max(0, Math.floor(Number(e?.alarmReduction  || 0)));
            if (state.pendingDiscoveries.length) {
              const pd = state.pendingDiscoveries[state.pendingDiscoveries.length - 1];
              pd.turnsRemaining += extraTurns;
              pd.alarmGain = Math.max(0, pd.alarmGain - alarmReduction);
              verbLines.push(`🕯 Concealed <b>${esc(pd.note)}</b> — +${extraTurns} turns, alarm spike -${alarmReduction} (now +${pd.alarmGain} in ${pd.turnsRemaining})`);
            } else {
              verbLines.push(`🕯 Concealment skipped: <i>no pending discovery to extend</i>`);
            }
          } else if (t === "escalateToViolence") {
            // S3a.2: GM-fiat detection trigger (bypasses meter)
            verbLines.push(`⚠ <b>GM escalates to detected:</b> ${e?.reason ? esc(e.reason) : "GM escalation"}`);
            forceDetected = true;
          }
        }
        const anyChange = alarmChanged || progressChanged || verbLines.length || forceDetected;
        if (anyChange) {
          const parts = [`<b>Maneuver Effects:</b>`];
          if (verbLines.length) {
            parts.push(...verbLines);
            // Compact meter summary after per-verb lines so readers see final state
            parts.push(`<small>Now — Alarm ${state.alarm}/${state.alarmMax} (${bandFromAlarm(state.alarm)}) · Progress ${state.progress}/${state.progressMax}</small>`);
          } else {
            if (alarmChanged)    parts.push(`Alarm ${beforeAlarm} → ${state.alarm} (${bandFromAlarm(state.alarm)})`);
            if (progressChanged) parts.push(`Progress ${beforeProgress} → ${state.progress}/${state.progressMax}`);
          }
          await sendChat([parts.join("<br/>")], { title: `${label}: Effects` });
          // S3a.4: emit canvas-VFX hooks for meter changes
          try {
            if (alarmChanged) {
              const ap = { before: beforeAlarm, after: state.alarm, delta: state.alarm - beforeAlarm, attackerId: A.id, defenderId: D.id };
              Hooks.callAll("bbttcc:infiltration:alarmChanged", { scenario: getState(), ...ap });
              _emitInfilHookRelay("bbttcc:infiltration:alarmChanged", ap);
            }
            if (progressChanged) {
              const pp = { before: beforeProgress, after: state.progress, delta: state.progress - beforeProgress, attackerId: A.id, defenderId: D.id };
              Hooks.callAll("bbttcc:infiltration:progressChanged", { scenario: getState(), ...pp });
              _emitInfilHookRelay("bbttcc:infiltration:progressChanged", pp);
            }
          } catch (_) {}
          // Resolve outcome (force "detected" wins over meter-driven resolution)
          if (state.outcome === "ongoing") {
            if (forceDetected) state.outcome = "detected";
            else _resolveOutcome();
            if (state.outcome !== "ongoing") await _onOutcomeResolved(state.outcome);
          }
        }
        await persistState();
        return getState();
      }

      async function reset({ alarm = 0, progress = 0 } = {}) {
        state.alarm = clamp(Number(alarm || 0), 0, state.alarmMax);
        state.progress = clamp(Number(progress || 0), 0, state.progressMax);
        state.outcome = "ongoing";
        state.flipResolution = null;
        state.pendingDiscoveries = []; // S3a.2: clear any deferred discovery timers
        state._flashbackUsedThisRound = false;
        _resolveOutcome(); // re-derive if reset values are already at cap
        await persistState();
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

      // S3a HUD parity (2026-05-26) — mirror the live snapshot onto the defender
      // actor so player HUDs (which lack the GM-only __infilScenario closure) can
      // read alarm/progress/outcome. GM-side write; propagates via updateActor.
      // _ftBuildRaidHudHtml reads flags.bbttcc-raid.infilState when no scenario.
      async function persistState() {
        try {
          if (!game.user?.isGM || !D) return;
          await D.setFlag("bbttcc-raid", "infilState", getState());
        } catch (e) { console.warn(TAG, "persistState (HUD mirror) failed", e); }
      }
      // Initial mirror so the meters appear the instant the scenario is created.
      persistState();

      const apiObj = { step, flashback, applyEffects, reset, getState };

      // Convenience handle for GM: last infiltration scenario
      raidApi._lastInfiltration = apiObj;

      console.log(TAG, "Infiltration scenario created:", {
        attacker: A.name,
        defender: D.name,
        alarmMax: state.alarmMax,
        progressMax: state.progressMax,
        difficulty: state.difficulty
      });

      // S3a.5.2 — Init card so the table sees the GM's chosen thresholds
      // (Difficulty especially — otherwise it's silently baked into every
      // defender roll with no visual confirmation).
      try {
        const diffPart = (Number(state.difficulty) > 0)
          ? `<b>+${state.difficulty}</b> to every defender roll`
          : `<i>none</i>`;
        await sendChat([
          `<b>${foundry.utils.escapeHTML(A.name)}</b> vs <b>${foundry.utils.escapeHTML(D.name)}</b>`,
          `Alarm Max: <b>${state.alarmMax}</b> · Progress Max: <b>${state.progressMax}</b> · Messy Threshold: <b>${state.messyThreshold}</b>`,
          `Difficulty: ${diffPart}`
        ], { title: `${label}: Scenario Initialized`, whisper: "public" });
      } catch (_) { /* tolerate failure — init card is cosmetic */ }

      return apiObj;
    };

    console.log(TAG, "Infiltration engine attached to raid API.");
  });
})();
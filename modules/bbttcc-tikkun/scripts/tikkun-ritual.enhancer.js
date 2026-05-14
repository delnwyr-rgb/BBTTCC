// modules/bbttcc-tikkun/scripts/tikkun-ritual.enhancer.js
// BBTTCC — Final Ritual Scenario Engine (Great Work)
//
// A lightweight scenario engine for resolving The Great Work as a ritual.
// Inspired by the same pattern as Infiltration & Courtly Intrigue.
//
// API surface (attached to game.bbttcc.api.tikkun):
//   const ritual = await game.bbttcc.api.tikkun.beginRitual({
//     factionId,
//     label       // optional, defaults "Final Ritual"
//   });
//
//   // Each call advances one round and returns updated state
//   const state = await ritual.step({
//     spendFaith,    // OP to spend from Faith
//     spendCulture,  // OP to spend from Soft Power / Culture channel
//     spendDiplomacy,// OP to spend from Diplomacy
//     skillBonus,    // flat bonus from PCs leading the ritual
//     note           // GM-facing note
//   });
//
//   ritual.getState() returns the full state snapshot.
//
// The latest ritual is also exposed as: game.bbttcc.api.tikkun._lastRitual
//
// Round structure (simplified from Gap Analysis Tikkun phases):
//  - Round 1: Invocation (Faith-heavy)
//  - Round 2: Contact (Culture/Diplomacy)
//  - Round 3: Integration (harder DC, darkness pressure)
//
// Each round:
//  - d20 + ritualBonus vs DC
//  - Success increments ritualScore
//  - Failure may add corruption & darkness surge
//  - After 3 rounds, outcome becomes "success" or "failure" based on ritualScore.
//
// On success (ritualScore >= 3):
//  - victory.vp += 10
//  - victory.unity += 10
//  - darkness.global -= 2 (min 0)
//  - flags.bbttcc-factions.tikkun.greatWorkComplete = true
//
// On failure:
//  - darkness.global += 2
//  - flags.bbttcc-factions.tikkun.corrupted.finalRitual = true
//  - Sparks are left intact but GM can choose to narrate sulking / setbacks.
//
// All effects are logged to the faction's warLogs and emitted as GM whispers.

(() => {
  const TAG  = "[bbttcc-tikkun/ritual]";
  const MODF = "bbttcc-factions";

  const clamp = (v,min,max)=>Math.max(min,Math.min(max,Number(v||0)));
  const dup   = (x)=>foundry.utils.duplicate(x||{});
  const gmIds = () => game.users?.filter(u=>u.isGM).map(u=>u.id) ?? [];

  function ensureNS() {
    game.bbttcc ??= { api:{} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.tikkun ??= {};
  }

  function getFaction(factionId) {
    const A = game.actors.get(String(factionId || "").replace(/^Actor\./,""));
    if (!A) throw new Error(`${TAG} Faction actor not found: ${factionId}`);
    return A;
  }

  async function sendChat(lines, { title="Final Ritual" } = {}) {
    if (!lines.length) return;
    await ChatMessage.create({
      content: `<p><b>${title}</b></p>${lines.join("<br/>")}`,
      whisper: gmIds(),
      speaker: { alias: "BBTTCC Tikkun" }
    }).catch(()=>{});
  }

  async function adjustOpBank(A, key, delta, label="Final Ritual") {
    if (!A || !key || !delta) return;
    const flags = dup(A.flags?.[MODF] || {});
    const bank  = dup(flags.opBank || {});
    const k = String(key).toLowerCase();
    bank[k] = clamp((bank[k]||0) + delta, 0, 999);
    flags.opBank = bank;

    const war = Array.isArray(flags.warLogs) ? flags.warLogs.slice() : [];
    const sign = delta > 0 ? "+" : "";
    war.push({
      ts: Date.now(),
      type: "scenario",
      scenario: "finalRitual",
      summary: `${label}: ${k} ${sign}${delta}`
    });
    flags.warLogs = war;

    await A.update({ [`flags.${MODF}`]: flags });
  }

  function readDarkness(A) {
    const box = A.getFlag(MODF, "darkness") || {};
    return typeof box.global === "number" ? box.global : 0;
  }

  async function writeDarkness(A, newVal) {
    const box = dup(A.getFlag(MODF, "darkness") || {});
    box.global = clamp(newVal, 0, 10);
    await A.update({ [`flags.${MODF}.darkness`]: box });
  }

  function readVictory(A) {
    return dup(A.getFlag(MODF, "victory") || {});
  }

  async function writeVictory(A, V) {
    await A.update({ [`flags.${MODF}.victory`]: V });
  }

  async function markGreatWorkResult(A, { success, ritualScore, darknessBefore, darknessAfter }) {
    const flags = dup(A.flags?.[MODF] || {});
    flags.tikkun = flags.tikkun || {};
    flags.tikkun.greatWorkComplete = !!success;
    flags.tikkun.greatWorkResult = {
      success: !!success,
      score: ritualScore,
      darknessBefore,
      darknessAfter,
      at: Date.now()
    };

    if (!flags.tikkun.corrupted) flags.tikkun.corrupted = {};
    if (!success) {
      flags.tikkun.corrupted.finalRitual = true;
    }

    const war = Array.isArray(flags.warLogs) ? flags.warLogs.slice() : [];
    war.push({
      ts: Date.now(),
      type: "scenario",
      scenario: "finalRitual",
      summary: success
        ? `Great Work COMPLETED (score ${ritualScore})`
        : `Great Work failed (score ${ritualScore}, Darkness ${darknessBefore}→${darknessAfter})`
    });

    flags.warLogs = war;
    await A.update({ [`flags.${MODF}`]: flags });
  }

  function roundSpec(round) {
    switch (round) {
      case 1:
        return {
          key: "invocation",
          label: "Invocation",
          dcBase: 15,
          weightFaith: 2,
          weightCulture: 1,
          weightDiplomacy: 0,
          darknessImpactOnFail: 1
        };
      case 2:
        return {
          key: "contact",
          label: "Contact",
          dcBase: 15,
          weightFaith: 1,
          weightCulture: 1,
          weightDiplomacy: 1,
          darknessImpactOnFail: 1
        };
      case 3:
      default:
        return {
          key: "integration",
          label: "Integration",
          dcBase: 17,
          weightFaith: 2,
          weightCulture: 1,
          weightDiplomacy: 1,
          darknessImpactOnFail: 2
        };
    }
  }

  function computeRoundDC(spec, darkness) {
    // Darkness makes ritual harder
    const darkPenalty = Math.floor(Math.max(0, darkness - 3) / 2); // every 2 above 3 → +1 DC
    return spec.dcBase + darkPenalty;
  }

  function computeBonus({ spec, spendFaith, spendCulture, spendDiplomacy, skillBonus }) {
    const f = Math.max(0, Number(spendFaith||0));
    const c = Math.max(0, Number(spendCulture||0));
    const d = Math.max(0, Number(spendDiplomacy||0));
    const base =
      spec.weightFaith    * Math.ceil(f / 2) +
      spec.weightCulture  * Math.ceil(c / 2) +
      spec.weightDiplomacy* Math.ceil(d / 2);
    return base + Number(skillBonus||0);
  }

  // -------------------------------------------------------------------------
  // Install Ritual API
  // -------------------------------------------------------------------------
  function install() {
    ensureNS();
    const API = game.bbttcc.api.tikkun;

    API.beginRitual = async function beginRitual({
      factionId,
      label = "Final Ritual"
    } = {}) {
      const A = getFaction(factionId);

      // Optional: gate via Great Work state (can be softened later)
      const gw = (API.getGreatWorkState && API.getGreatWorkState(A.id)) || null;
      if (gw && !gw.ready) {
        ui.notifications?.warn?.(`${A.name} is not yet ready for the Great Work.`);
      }

      const darkness = readDarkness(A);
      const V = readVictory(A);

      const state = {
        factionId: A.id,
        label,
        round: 0,
        ritualScore: 0,
        corruption: 0,
        darknessStart: darkness,
        darknessNow: darkness,
        vpBefore: Number(V.vp || 0),
        unityBefore: Number(V.unity || 0),
        outcome: "ongoing", // "ongoing" | "success" | "failure"
        history: []
      };

      async function step({
        spendFaith = 0,
        spendCulture = 0,
        spendDiplomacy = 0,
        skillBonus = 0,
        note = ""
      } = {}) {
        if (state.outcome !== "ongoing") {
          return { ...state, note: "ritual already resolved" };
        }

        state.round += 1;
        const spec = roundSpec(state.round);

        // Spend OPs (negative deltas)
        const fSpend = Math.max(0, Math.floor(Number(spendFaith||0)));
        const cSpend = Math.max(0, Math.floor(Number(spendCulture||0)));
        const dSpend = Math.max(0, Math.floor(Number(spendDiplomacy||0)));

        if (fSpend) await adjustOpBank(A, "faith", -fSpend, label);
        if (cSpend) await adjustOpBank(A, "softpower", -cSpend, label);
        if (dSpend) await adjustOpBank(A, "diplomacy", -dSpend, label);

        const bonus = computeBonus({
          spec,
          spendFaith: fSpend,
          spendCulture: cSpend,
          spendDiplomacy: dSpend,
          skillBonus
        });

        const dc = computeRoundDC(spec, state.darknessNow);
        const roll = await (new Roll("1d20 + @b", { b: bonus })).evaluate();
        const total = roll.total ?? 0;
        const margin = total - dc;

        let success = margin >= 0;
        if (success) {
          state.ritualScore += 1;
        } else {
          // Failure: corruption risk + darkness surge
          state.corruption += 1;
          state.darknessNow = clamp(state.darknessNow + spec.darknessImpactOnFail, 0, 10);
          await writeDarkness(A, state.darknessNow);
        }

        const entry = {
          round: state.round,
          phaseKey: spec.key,
          phaseLabel: spec.label,
          dc,
          total,
          margin,
          success,
          spendFaith: fSpend,
          spendCulture: cSpend,
          spendDiplomacy: dSpend,
          bonus,
          corruptionAfter: state.corruption,
          darknessAfter: state.darknessNow,
          note
        };
        state.history.push(entry);

        const lines = [
          `Round ${state.round} — <b>${foundry.utils.escapeHTML(spec.label)}</b>`,
          `Roll: ${total} vs DC ${dc} (margin ${margin >= 0 ? "+"+margin : margin})`,
          success
            ? `Result: <b>Success</b> (Ritual Score now ${state.ritualScore})`
            : `Result: <b>Complication</b> (Corruption ${state.corruption}, Darkness ${state.darknessStart}→${state.darknessNow})`
        ];
        if (note) lines.push(foundry.utils.escapeHTML(note));

        await sendChat(lines, { title: `${label}: Round ${state.round}` });

        // Auto-resolve after 3 rounds
        if (state.round >= 3) {
          const successFinal = state.ritualScore >= 3;
          state.outcome = successFinal ? "success" : "failure";

          const Vcur = readVictory(A);
          const beforeDark = state.darknessNow;

          if (successFinal) {
            Vcur.vp    = Number(Vcur.vp    || 0) + 10;
            Vcur.unity = Number(Vcur.unity || 0) + 10;
            await writeVictory(A, Vcur);

            const newDark = clamp(beforeDark - 2, 0, 10);
            state.darknessNow = newDark;
            await writeDarkness(A, newDark);

            await markGreatWorkResult(A, {
              success:true,
              ritualScore: state.ritualScore,
              darknessBefore: beforeDark,
              darknessAfter: newDark
            });

            await sendChat([
              `<b>${foundry.utils.escapeHTML(A.name)}</b> has completed the Great Work!`,
              `Ritual Score: ${state.ritualScore}`,
              `Victory VP: ${state.vpBefore} → ${Vcur.vp}`,
              `Unity: ${state.unityBefore}% → ${Vcur.unity}%`,
              `Darkness: ${beforeDark} → ${state.darknessNow}`
            ], { title: `${label}: Great Work Complete` });
          } else {
            const newDark = clamp(beforeDark + 2, 0, 10);
            state.darknessNow = newDark;
            await writeDarkness(A, newDark);

            await markGreatWorkResult(A, {
              success:false,
              ritualScore: state.ritualScore,
              darknessBefore: beforeDark,
              darknessAfter: newDark
            });

            await sendChat([
              `<b>${foundry.utils.escapeHTML(A.name)}</b> failed to complete the Great Work.`,
              `Ritual Score: ${state.ritualScore}`,
              `Darkness surges: ${beforeDark} → ${state.darknessNow}`,
              `The Sparks recoil; corruption deepens.`
            ], { title: `${label}: Great Work Falters` });
          }
        }

        return { ...state };
      }

      function getState() {
        try { return structuredClone(state); }
        catch { return JSON.parse(JSON.stringify(state)); }
      }

      const apiObj = { step, getState };
      API._lastRitual = apiObj;

      console.log(TAG, "Ritual scenario created for", A.name, {
        darkness: state.darknessStart,
        vp: state.vpBefore,
        unity: state.unityBefore
      });

      return apiObj;
    };

    console.log(TAG, "Final Ritual engine attached to Tikkun API.");
  }

  Hooks.once("ready", install);
  if (game?.ready) install();
})();

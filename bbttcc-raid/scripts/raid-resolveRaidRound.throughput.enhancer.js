// scripts/raid-resolveRaidRound.throughput.enhancer.js
// Adds game.bbttcc.api.raid.resolveRaidRound (late-load safe, overwrite-resistant)
// Purpose: mechanize a small set of throughput maneuvers via World Mutation Engine (WME).
// Alpha-safe: does nothing if outcome is not a Success/Great Success.

(function () {
  const TAG = "[bbttcc-raid:resolveRaidRound]";

  function lc(s){ return String(s||"").toLowerCase().trim(); }


  function getFX() {
    return game?.bbttcc?.api?.fx || null;
  }

  async function playResolutionFX(payload = {}) {
    try {
      const fx = getFX();
      if (!fx) return;
      const atkTotal = Number(payload.attackerTotal ?? payload.atkTotal ?? payload.attackTotal);
      const defTotal = Number(payload.defenderTotal ?? payload.defTotal ?? payload.defenseTotal);
      const margin = Number(payload.margin || 0);
      if (typeof fx.playRolls === "function" && Number.isFinite(atkTotal) && Number.isFinite(defTotal)) {
        await fx.playRolls({
          raidType: payload.raidType || "assault",
          label: `${String(payload.raidType || "Raid").replace(/_/g, " ")} Clash`,
          attackerName: payload.attackerName || "Attacker",
          defenderName: payload.defenderName || "Defender",
          attackerTotal: atkTotal,
          defenderTotal: defTotal,
          margin
        }, { raidType: payload.raidType || "assault" });
      }
      if (typeof fx.playKey === "function") {
        await fx.playKey("raid_outcome", {
          raidType: payload.raidType || "assault",
          outcome: payload.outcomeTier || payload.outcome || `Margin ${margin >= 0 ? "+" : ""}${margin}`
        }, { phase: "resolve", raidType: payload.raidType || "assault", spacingMs: 1350 });
      }
    } catch (_e) {}
  }

  function isSuccess(outcomeTier, margin){
    const s = lc(outcomeTier);
    if (s.includes("fail")) return false;
    if (s.includes("success")) return true;
    return Number(margin||0) >= 0;
  }

  async function resolveRaidRound(payload){
    payload = payload || {};
    const attackerFactionId = payload.attackerFactionId || null;
    const raidType = lc(payload.raidType || "");
    const outcomeTier = String(payload.outcomeTier || "");
    const margin = Number(payload.margin || 0);

    if (!isSuccess(outcomeTier, margin)) {
      await playResolutionFX(payload);
      return { applied:false, note:"no-success" };
    }

    await playResolutionFX(payload);

    const wm = game.bbttcc?.api?.worldMutation;
    if (!wm || typeof wm.applyWorldEffects !== "function") return { applied:false, note:"no-wme" };

    const attMans = Array.isArray(payload.attackerManeuvers) ? payload.attackerManeuvers.map(lc) : [];

    const factionEffects = [];

    // Radiant Rally — attacker throughput
    if (attMans.includes("radiant_rally") && attackerFactionId) {
      factionEffects.push({
        factionId: attackerFactionId,
        moraleDelta: 2,
        darknessDelta: -1,
        note: "Radiant Rally"
      });
    }

    if (!factionEffects.length) return { applied:false, note:"no-known-maneuvers" };

    const we = { factionEffects };
    const ctx = {
      factionId: attackerFactionId || null,
      beatId: payload.round || "raid_round",
      beatType: "raid_maneuver",
      beatLabel: `Raid Maneuver (${raidType || "raid"})`,
      source: "resolveRaidRound"
    };

    try {
      const res = await wm.applyWorldEffects(we, ctx);
      return { applied:true, result: res, note:"ok" };
    } catch (e) {
      console.warn(TAG, "WME apply failed", e);
      return { applied:false, note:"exception", error: String(e) };
    }
  }

  function attach(){
    try {
      game.bbttcc ??= { api: {} };
      game.bbttcc.api ??= {};
      game.bbttcc.api.raid ??= {};

      if (typeof game.bbttcc.api.raid.resolveRaidRound !== "function") {
        game.bbttcc.api.raid.resolveRaidRound = resolveRaidRound;
      }

      try {
        const mod = game.modules?.get?.("bbttcc-raid");
        if (mod) {
          mod.api ??= {};
          mod.api.resolveRaidRound = resolveRaidRound;
        }
      } catch (_e) {}

      console.log(TAG, "attached:", typeof game.bbttcc.api.raid.resolveRaidRound);
    } catch (e) {
      console.warn(TAG, "attach failed", e);
    }
  }

  Hooks.once("ready", attach);
  if (game.ready) attach();

  setTimeout(attach, 250);
  setTimeout(attach, 1500);

})();

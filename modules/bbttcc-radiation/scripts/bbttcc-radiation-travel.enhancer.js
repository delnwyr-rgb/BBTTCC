// ============================================================================
// BBTTCC — Radiation-on-Travel Enhancer (Phase A)
// Adds Radiation exposure to actors when traveling into radiated terrain.
//
// Integrates with:
//   • api.travel.js  (bbttcc:afterTravel hook)  ✔
//   • hex-travel.js  (same hook)               ✔
//   • travel console & planner                 ✔
//   • Wasteland/Radiation terrain keys         ✔
//   • Hex conditions: "Radiated", "Contaminated"
//   • Hex mods.radiation                       ✔
//
// Applies radiation to the traveling *faction actor* for now.
// (Phase B will expand this to PC/NPC party tokens.)
// ============================================================================

(() => {
  const TAG = "[bbttcc-radiation/travel]";
  const MOD_T = "bbttcc-territory";

  function getTerrainKey(ctx) {
    try {
      // api.travel.js path: ctx.to.flags.terrain.key
      const f = ctx.to?.flags?.terrain?.key;
      if (f) return String(f).toLowerCase();

      // hex-travel.js path: ctx.terrainKey
      if (ctx.terrainKey) return String(ctx.terrainKey).toLowerCase();

      // fallback via drawing flags
      const tf = ctx.to?.doc?.flags?.[MOD_T] || ctx.to?.document?.flags?.[MOD_T];
      const k = tf?.terrain?.key || tf?.terrainType || tf?.terrain;
      return k ? String(k).toLowerCase() : null;
    } catch(e) {
      console.warn(TAG, "getTerrainKey failed", e);
      return null;
    }
  }

  function getHexFlags(ctx) {
    return ctx.to?.flags?.[MOD_T]
        || ctx.to?.doc?.flags?.[MOD_T]
        || ctx.to?.document?.flags?.[MOD_T]
        || {};
  }

  function computeExposure(ctx) {
    const terrain = getTerrainKey(ctx);
    const hf = getHexFlags(ctx);

    let rp = 0;
    const reasons = [];

    // Terrain-based radiation (Wasteland / Radiation)
    if (terrain === "wasteland" || terrain === "radiation") {
      rp += 1;
      reasons.push("Wasteland terrain");
    }

    // Condition: Radiated
    const conds = hf.conditions || [];
    if (conds.includes("Radiated")) {
      rp += 1;
      reasons.push("Hex is Radiated");
    }

    // Condition: Contaminated
    if (conds.includes("Contaminated")) {
      rp += 1;
      reasons.push("Hex is Contaminated");
    }

    // Numeric mods.radiation
    const mods = hf.mods || {};
    const val = Number(mods.radiation || 0);
    if (val > 0) {
      rp += val;
      reasons.push(`Environmental fallout (+${val})`);
    }

    return { amount: rp, reasons };
  }

  async function applyExposure(ctx) {
    const actor = ctx.actor; // traveling faction actor
    if (!actor) return;

    const radApi = game.bbttcc?.api?.radiation;
    if (!radApi || typeof radApi.add !== "function") return;

    const { amount, reasons } = computeExposure(ctx);
    if (amount <= 0) return;

    try {
      await radApi.add(actor.id, amount);

      // GM whisper
      const lines = [
        `<b>Radiation Exposure</b> — ${foundry.utils.escapeHTML(actor.name)}`,
        `Travel into hex: <i>${ctx.toHexName || ctx.to?.doc?.name || ctx.to?.document?.name || ctx.to?.id}</i>`,
        `Gained <b>${amount} RP</b>`,
        `<small>${reasons.join(", ")}</small>`
      ].join("<br/>");

      await ChatMessage.create({
        content: `<p>${lines}</p>`,
        whisper: game.users.filter(u => u.isGM).map(u => u.id),
        speaker: { alias: "BBTTCC Radiation" }
      });

      console.log(TAG, `Applied +${amount} RP →`, actor.name, reasons);

    } catch (err) {
      console.warn(TAG, "Failed to apply radiation:", err);
    }
  }

  // -------------------------------------------------------------------------
  // Hook installation
  // -------------------------------------------------------------------------
  Hooks.on("bbttcc:afterTravel", async (ctx) => {
    try { await applyExposure(ctx); }
    catch(e) { console.warn(TAG, "afterTravel handler failed", e); }
  });

  console.log(TAG, "Radiation-on-Travel Enhancer installed.");
})();

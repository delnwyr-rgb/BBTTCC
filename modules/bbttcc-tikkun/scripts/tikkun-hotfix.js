// modules/bbttcc-tikkun/scripts/tikkun-hotfix.js
// BBTTCC — Tikkun API hotfix (permanent)
//
// Restores hasSpark / gatherSpark / getAllSparks on game.bbttcc.api.tikkun,
// so Unity gating can work (Spark of Mercy + aligned hexes).

(() => {
  const MOD = "bbttcc-tikkun";
  const TAG = "[tikkun-hotfix]";

  const safeGet = (o, path, d) => {
    try { return foundry.utils.getProperty(o, path) ?? d; }
    catch { return d; }
  };

  Hooks.once("ready", () => {
    try {
      // Ensure bbttcc namespace exists without overwriting it
      game.bbttcc = game.bbttcc || {};
      game.bbttcc.api = game.bbttcc.api || {};

      const api = (game.bbttcc.api.tikkun = game.bbttcc.api.tikkun || {});

      // hasSpark(actor, key) → true if actor.flags['bbttcc-tikkun'].sparks[key].status === "gathered"
      if (typeof api.hasSpark !== "function") {
        api.hasSpark = async function hasSpark(actor, key) {
          if (!actor || !key) return false;
          const map = safeGet(actor, `flags.${MOD}.sparks`, {});
          const rec = map?.[key];
          return !!(rec && String(rec.status).toLowerCase() === "gathered");
        };
      }

      // gatherSpark(actor, sparkConfig) → marks that spark as gathered on the actor
      if (typeof api.gatherSpark !== "function") {
        api.gatherSpark = async function gatherSpark(actor, spark) {
          if (!actor || !spark?.id) throw new Error("gatherSpark: missing actor or spark.id");
          const sparks = foundry.utils.duplicate(
            safeGet(actor, `flags.${MOD}.sparks`, {})
          );
          sparks[spark.id] = {
            id:   spark.id,
            name: spark.name      ?? spark.id,
            sephirah: spark.sephirah ?? null,
            status: "gathered",
            description: spark.description ?? "",
            gatheredTimestamp: new Date().toISOString()
          };
          await actor.update({ [`flags.${MOD}.sparks`]: sparks });
          ui.notifications?.info?.(`${actor.name}: gathered ${sparks[spark.id].name}`);
          return sparks[spark.id];
        };
      }

      // getAllSparks(actor) → returns the raw sparks map
      if (typeof api.getAllSparks !== "function") {
        api.getAllSparks = function getAllSparks(actor) {
          return safeGet(actor, `flags.${MOD}.sparks`, {});
        };
      }

      console.log(TAG, "attached to game.bbttcc.api.tikkun");
    } catch (e) {
      console.warn(TAG, "failed to attach:", e);
    }
  });
})();

// modules/bbttcc-radiation/scripts/api.radiation.js
// BBTTCC — Radiation Core API (R1)
// *** FIXED VERSION: install() now guaranteed to fire ***

(() => {
  const MOD = "bbttcc-radiation";
  const TAG = "[bbttcc-radiation/api]";

  const LEVELS = [
    { name:"Safe",     key:"safe",     min:0,  max:10 },
    { name:"Low",      key:"low",      min:11, max:25 },
    { name:"Moderate", key:"moderate", min:26, max:50 },
    { name:"High",     key:"high",     min:51, max:75 },
    { name:"Extreme",  key:"extreme",  min:76, max:95 },
    { name:"Lethal",   key:"lethal",   min:96, max:9999 }
  ];

  function _asActor(aOrId) {
    if (!aOrId) return null;
    if (aOrId instanceof Actor) return aOrId;
    return game.actors?.get(String(aOrId).replace(/^Actor\./,"")) ?? null;
  }

  function levelFor(value) {
    const v = Number(value || 0);
    return LEVELS.find(L => v >= L.min && v <= L.max) || LEVELS[LEVELS.length - 1];
  }

  class RadiationAPI {
    static get(actorOrId) {
      const A = _asActor(actorOrId);
      if (!A) return 0;
      return Number(A.getFlag(MOD, "rp") || 0);
    }

    static async set(actorId, value) {
      const A = _asActor(actorId);
      if (!A) throw new Error("Radiation.set: actor not found");
      const prev = this.get(A);
      const next = Math.max(0, Number(value || 0));

      await A.setFlag(MOD, "rp", next);

      const prevLev = levelFor(prev);
      const nextLev = levelFor(next);

      if (prevLev.key !== nextLev.key) {
        ui.notifications?.info?.(
          `${A.name}: Radiation level changed from ${prevLev.name} (${prev}) to ${nextLev.name} (${next}).`
        );
      }

      if (prev < 50 && next >= 50) {
        Hooks.callAll("bbttcc.mutationRoll", A, next);
      }

      return next;
    }

    static async add(actorId, amount) {
      const prev = this.get(actorId);
      return this.set(actorId, prev + Number(amount || 0));
    }
  }

  function install() {
    try {
      // Attach namespace
      game.bbttcc ??= { api:{} };
      game.bbttcc.api ??= {};
      game.bbttcc.api.radiation ??= {};

      const api = game.bbttcc.api.radiation;
      api.get      = RadiationAPI.get.bind(RadiationAPI);
      api.set      = RadiationAPI.set.bind(RadiationAPI);
      api.add      = RadiationAPI.add.bind(RadiationAPI);
      api.levelFor = levelFor;

      // Attach to module API
      const mod = game.modules.get(MOD);
      if (mod) {
        mod.api = mod.api || {};
        mod.api.RadiationAPI = RadiationAPI;
      }

      console.log(TAG, "API ready:", Object.keys(api));

    } catch (e) {
      console.warn(TAG, "install failed:", e);
    }
  }

  // *** FIX: guarantee install fires no matter when module loads ***
  Hooks.once("init", install);
  Hooks.once("setup", install);
  Hooks.once("ready", install);
  if (game?.ready) install();
})();

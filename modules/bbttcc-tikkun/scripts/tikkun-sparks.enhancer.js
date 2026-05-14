// bbttcc-tikkun/enhancers/tikkun-sparks.enhancer.js
// Faction-level Spark integration helpers for Tikkun / Great Work.
//
// This enhancer is now *additive* and non-destructive:
// - It only defines listSparks / integrateSpark / revokeSpark if those functions
//   are not already present on game.bbttcc.api.tikkun.
// - It relies on the core Tikkun API (api.tikkun.js) for actor-level logic.
//
// Storage shapes supported (to match Unity enhancer and docs):
// - flags['bbttcc-factions'].tikkun.integrated = { netzach:true, ... }
// - flags['bbttcc-factions'].victory.sparks    = [{ key:'netzach', count:1 }, ... ]
// - flags['bbttcc-factions'].sparks            = { netzach:1, ... }
//
// It writes War Log entries and whispers to GMs when sparks are integrated/revoked.

(() => {
  const TAG = "[bbttcc-tikkun/sparks]";
  const MOD_FACTIONS = "bbttcc-factions";

  const get   = (obj, path, dflt) => { try { return foundry.utils.getProperty(obj, path) ?? dflt; } catch { return dflt; } };
  const clone = (x) => foundry.utils.deepClone(x);
  const setFlag = async (A, path, val) => A.update({ [`flags.${path}`]: val });

  function installOnce() {
    game.bbttcc ??= { api: {} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.tikkun ??= {};
    const API = game.bbttcc.api.tikkun;

    // -----------------------------------------------------------------------
    // listSparks(factionId) — safe read of all faction spark shapes
    // -----------------------------------------------------------------------
    if (typeof API.listSparks !== "function") {
      API.listSparks = function listSparks(factionId) {
        const A = game.actors.get(String(factionId));
        if (!A) return null;
        const integrated = get(A, `flags.${MOD_FACTIONS}.tikkun.integrated`, {}) || {};
        const arr        = get(A, `flags.${MOD_FACTIONS}.victory.sparks`, []) || [];
        const map        = get(A, `flags.${MOD_FACTIONS}.sparks`, {}) || {};
        return { integrated, array: arr, map };
      };
    }

    // -----------------------------------------------------------------------
    // integrateSpark({ factionId, key, count, writeArray, writeMap })
    // - Marks a spark as integrated on the faction and increments counts.
    // -----------------------------------------------------------------------
    if (typeof API.integrateSpark !== "function") {
      API.integrateSpark = async function integrateSpark({
        factionId,
        key,
        count = 1,
        writeArray = true,
        writeMap   = true
      } = {}) {
        const A = game.actors.get(String(factionId));
        if (!A || !key) throw new Error("integrateSpark: Missing factionId or key");
        const k = String(key).toLowerCase();

        // integrated object
        const integ = clone(get(A, `flags.${MOD_FACTIONS}.tikkun.integrated`, {})) || {};
        integ[k] = true;
        await setFlag(A, `${MOD_FACTIONS}.tikkun.integrated`, integ);

        // array form
        if (writeArray) {
          const arr = clone(get(A, `flags.${MOD_FACTIONS}.victory.sparks`, [])) || [];
          const at  = arr.findIndex(e => String(e?.key || "").toLowerCase() === k);
          if (at >= 0) {
            arr[at].count = (Number(arr[at].count || 0) + Number(count || 1));
          } else {
            arr.push({ key: k, count: Number(count || 1) });
          }
          await setFlag(A, `${MOD_FACTIONS}.victory.sparks`, arr);
        }

        // map form
        if (writeMap) {
          const map = clone(get(A, `flags.${MOD_FACTIONS}.sparks`, {})) || {};
          map[k] = Number(map[k] || 0) + Number(count || 1);
          await setFlag(A, `${MOD_FACTIONS}.sparks`, map);
        }

        // war log + whisper
        const war = clone(get(A, `flags.${MOD_FACTIONS}.warLogs`, [])) || [];
        war.push({
          type:   "turn",
          date:   (new Date()).toLocaleString(),
          summary:`Spark integrated: ${k} (+${count})`
        });
        await setFlag(A, `${MOD_FACTIONS}.warLogs`, war);

        await ChatMessage.create({
          content: `<p><b>${foundry.utils.escapeHTML(A.name)}</b> — <i>Spark integrated:</i> ${k} (+${count})</p>`,
          whisper: game.users?.filter(u => u.isGM).map(u => u.id) ?? [],
          speaker: { alias: "BBTTCC Tikkun" }
        });

        return API.listSparks(A.id);
      };
    }

    // -----------------------------------------------------------------------
    // revokeSpark({ factionId, key, count })
    // - Decrements/removes a spark from faction-level storage.
    // -----------------------------------------------------------------------
    if (typeof API.revokeSpark !== "function") {
      API.revokeSpark = async function revokeSpark({ factionId, key, count = 1 } = {}) {
        const A = game.actors.get(String(factionId));
        if (!A || !key) throw new Error("revokeSpark: Missing factionId or key");
        const k = String(key).toLowerCase();

        // array form decrement
        const arr = clone(get(A, `flags.${MOD_FACTIONS}.victory.sparks`, [])) || [];
        const at  = arr.findIndex(e => String(e?.key || "").toLowerCase() === k);
        if (at >= 0) {
          arr[at].count = Math.max(0, Number(arr[at].count || 0) - Number(count || 1));
          if (arr[at].count === 0) arr.splice(at, 1);
          await setFlag(A, `${MOD_FACTIONS}.victory.sparks`, arr);
        }

        // map form decrement
        const map = clone(get(A, `flags.${MOD_FACTIONS}.sparks`, {})) || {};
        if (map[k]) {
          map[k] = Math.max(0, Number(map[k]) - Number(count || 1));
          if (map[k] === 0) delete map[k];
          await setFlag(A, `${MOD_FACTIONS}.sparks`, map);
        }

        // integrated stays true until explicitly removed; if we want to clear it when
        // completely removed from both array + map, we can do that here:
        const integ = clone(get(A, `flags.${MOD_FACTIONS}.tikkun.integrated`, {})) || {};
        const stillInArray = (get(A, `flags.${MOD_FACTIONS}.victory.sparks`, []) || [])
          .some(e => String(e?.key || "").toLowerCase() === k);
        const stillInMap = Object.prototype.hasOwnProperty.call(map, k);

        if (!stillInArray && !stillInMap && integ[k]) {
          delete integ[k];
          await setFlag(A, `${MOD_FACTIONS}.tikkun.integrated`, integ);
        }

        const war = clone(get(A, `flags.${MOD_FACTIONS}.warLogs`, [])) || [];
        war.push({
          type:   "turn",
          date:   (new Date()).toLocaleString(),
          summary:`Spark revoked: ${k} (-${count})`
        });
        await setFlag(A, `${MOD_FACTIONS}.warLogs`, war);

        await ChatMessage.create({
          content: `<p><b>${foundry.utils.escapeHTML(A.name)}</b> — <i>Spark revoked:</i> ${k} (-${count})</p>`,
          whisper: game.users?.filter(u => u.isGM).map(u => u.id) ?? [],
          speaker: { alias: "BBTTCC Tikkun" }
        });

        return API.listSparks(A.id);
      };
    }

    console.log(TAG, "Spark enhancer ready. API keys now:", Object.keys(API));
  }

  Hooks.once("ready", installOnce);
  if (game?.ready) installOnce();
  Hooks.on("canvasReady", installOnce);
})();

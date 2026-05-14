/* bbttcc-travel/scripts/encounters.js
 * Fiat Encounter Engine (RETIRED)
 *
 * BBTTCC now selects travel encounters exclusively from Campaign Builder travel tables
 * stored in the bbttcc-campaign encounterTables world setting.
 *
 * This file is a compatibility shim so legacy callers do not crash.
 */

(() => {
  const TAG = "[bbttcc-travel/fiat-retired]";
  const warn = (...a) => console.warn(TAG, ...a);

  function publish() {
    game.bbttcc = game.bbttcc || { api: {} };
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.travel = game.bbttcc.api.travel || {};

    game.bbttcc.api.travel.__encounters = {
      retired: true,
      tables: { hazard: [], monster: [], rare: [], worldboss: [] },
      rollEncounter: function(_tier, _opts) {
        warn("Fiat encounter engine is retired. Travel encounters must be selected from campaign travel tables.");
        return null;
      }
    };
  }

  Hooks.once("ready", publish);
  try { if (game && game.ready) publish(); } catch (_e) {}
})();

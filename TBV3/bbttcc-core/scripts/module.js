// bbttcc-core/module.js
const CORE_ID = "bbttcc-core";

Hooks.once("init", () => {
  // Global registry where other modules register their APIs during "ready"
  game.bbttcc = game.bbttcc || {};
  game.bbttcc.api = {
    core: { version: "1.0.0" },
    factions: null,
    territory: null,
    characterOptions: null
  };
  console.log(`[${CORE_ID}] init`);
});

Hooks.once("ready", () => {
  console.log(`[${CORE_ID}] ready`);
});

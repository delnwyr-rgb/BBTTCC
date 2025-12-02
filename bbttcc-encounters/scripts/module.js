// bbttcc-encounters/scripts/module.js
// Entry point: just imports the other scripts so Foundry loads them.

import "./api.encounters.js";
import "./scene.launcher.js";
import "./trigger.manager.js";
import "./encounter.archetypes.js";
import "./spawner.interface.js";
import "./encounter.outcomes.js";   // NEW: outcome registry + helpers

const TAG = "[bbttcc-encounters/module]";

Hooks.once("init", () => {
  console.log(TAG, "Initializing BBTTCC Encounter Engine module");
});

Hooks.once("ready", () => {
  console.log(TAG, "BBTTCC Encounter Engine ready");
});

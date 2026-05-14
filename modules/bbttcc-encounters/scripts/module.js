// bbttcc-encounters/scripts/module.js
// Entry point: imports all Encounter Engine scripts so Foundry loads them.

import "./scene.launcher.js";
import "./api.encounters.js";
import "./trigger.manager.js";
import "./encounter.archetypes.js";
import "./spawner.interface.js";
import "./encounter.outcomes.js";   // outcome registry + helpers

const TAG = "[bbttcc-encounters/module]";

/**
 * PARITY / ALPHA NOTE (2025-12-19+):
 * Scout Signs travel modifiers (flags.bbttcc-factions.travelMods.next)
 * are now applied natively inside bbttcc travel's hex-travel.js.
 *
 * Therefore we DO NOT wrap game.bbttcc.api.travel.travelHex here anymore.
 *
 * Why:
 * - The previous bridge consumed travelMods.next before travelHex's real math ran,
 *   so tier/DC/roll stayed unchanged (observed in logs).
 * - travelHex is the canonical owner of terrainTier, DC, roll, and encounter tier/label.
 *
 * This module remains responsible for:
 * - Encounter key → scenario mapping
 * - Scene launching
 * - Outcome dialogs + war log outcome entries
 * - Trigger manager / spawner interface
 */
function installTravelModBridge() {
  // Disabled by design to preserve travel parity.
  console.log(TAG, "Scout Signs Travel Bridge: DISABLED (native travel handles travelMods.next).");
}

Hooks.once("init", () => {
  console.log(TAG, "Initializing BBTTCC Encounter Engine module");
});

Hooks.once("ready", () => {
  console.log(TAG, "BBTTCC Encounter Engine ready");
  installTravelModBridge();
});

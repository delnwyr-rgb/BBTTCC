// modules/bbttcc-auto-link/scripts/sidepanel.js
// v1.0.0 — Legacy BBTTCC sidepanel retired.
// All BBTTCC identity editing now lives in the BBTTCC tab on the character sheet.

const MOD = "bbttcc-auto-link";
const LOG = (...a) => console.log(`[${MOD}]`, ...a);

Hooks.once("ready", () => {
  LOG("Legacy BBTTCC sidepanel is retired. Use the BBTTCC Identity tab instead.");
});

// modules/bbttcc-auto-link/scripts/sidepanel.js
// v1.0.0 — Legacy Bad Eden sidepanel retired.
// All Bad Eden identity editing now lives in the Bad Eden tab on the character sheet.

const MOD = "bbttcc-auto-link";
const LOG = (...a) => console.log(`[${MOD}]`, ...a);

Hooks.once("ready", () => {
  LOG("Legacy Bad Eden sidepanel is retired. Use the Bad Eden Identity tab instead.");
});

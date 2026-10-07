// Bad Eden 5E — entry point. D&D-only: RFI never loads this module.
import { MOD, TRADITIONS, registerConfig, activateCasting, castingFor, setPoints, restore, costAt, traditionOf, abilityFor } from "./casting.js";

Hooks.once("init", () => {
  if (game.system.id !== "dnd5e") return;
  registerConfig();
  // Feature subtypes our content uses (a Theurge's Shapes are picked from a pool by subtype).
  const sub = CONFIG.DND5E.featureTypes?.class?.subtypes;
  if (sub) sub.be5eShape = "Shape (Theurge)";
});

Hooks.once("ready", () => {
  if (game.system.id !== "dnd5e") return;
  activateCasting();
  game.badEden5e = { MOD, TRADITIONS, castingFor, setPoints, restore, costAt, traditionOf, abilityFor };
  console.log(`${MOD} | ready: the Flow and Artifice`);
});

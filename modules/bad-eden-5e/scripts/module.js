// Bad Eden 5E — entry point. D&D-only: RFI never loads this module.
import { MOD, TRADITIONS, registerConfig, activateCasting, castingFor, setPoints, restore, costAt, traditionOf, abilityFor } from "./casting.js";

Hooks.once("init", () => {
  if (game.system.id !== "dnd5e") return;
  registerConfig();
});

Hooks.once("ready", () => {
  if (game.system.id !== "dnd5e") return;
  activateCasting();
  game.badEden5e = { MOD, TRADITIONS, castingFor, setPoints, restore, costAt, traditionOf, abilityFor };
  console.log(`${MOD} | ready: the Flow and Artifice`);
});

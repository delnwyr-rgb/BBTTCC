// Bad Eden 5E — entry point. D&D-only: RFI never loads this module.
import { MOD, TRADITIONS, registerConfig, activateCasting, castingFor, setPoints, restore, restorePoints, costAt, costFor, traditionOf, nativeTraditionOf, isCrossCast, abilityFor, castThrough, crossCastsFor, autoCastThrough } from "./casting.js";
import { activateDisciplines, disciplines } from "./disciplines.js";
import { activateMastery } from "./mastery.js";
import { redshirts } from "./redshirts.js";
import { activateRiders, registerRiderStatus, riders } from "./riders.js";
import { activateReminders } from "./reminders.js";
import { registerSheet, linkedDomain, domainContext } from "./sheet.js";
import { registerRules, activateRules, grantFirearms, FIREARM_CLASSES } from "./rules.js";

Hooks.once("init", () => {
  if (game.system.id !== "dnd5e") return;
  registerConfig();
  registerRules();   // Piloting skill + Firearms weapon category (2026-10-31)
  // Feature subtypes our content uses (a Theurge's Shapes are picked from a pool by subtype).
  const sub = CONFIG.DND5E.featureTypes?.class?.subtypes;
  if (sub) Object.assign(sub, { be5eShape: "Shape (Theurge)", be5eAura: "Aura (Warden)", be5eTenet: "Tenet (Vigilant)" });
  // Bad Eden's two metaphysical damage types, so resistances and damage parts can name them.
  const dt = CONFIG.DND5E.damageTypes;
  if (dt && !dt.sephirotic) {
    dt.sephirotic = { label: "Sephirotic", icon: "icons/magic/holy/projectiles-blades-salvo-yellow.webp", color: new foundry.utils.Color(0xE8C84A) };
    dt.qliphothic = { label: "Qliphothic", icon: "icons/magic/unholy/orb-glowing-purple.webp", color: new foundry.utils.Color(0x7A3FB0) };
  }
});

// The sheet: Domain tab + the Archetype in the background slot (2026-10-30). setup = dnd5e's sheet classes exist, nothing rendered yet.
Hooks.once("setup", () => {
  if (game.system.id !== "dnd5e") return;
  try { registerSheet(); } catch (e) { console.error(`${MOD} | sheet registration failed`, e); }
});

Hooks.once("ready", () => {
  if (game.system.id !== "dnd5e") return;
  activateCasting();
  activateMastery();
  registerRiderStatus();   // after dnd5e has rebuilt CONFIG.statusEffects from its own conditions
  activateRiders();
  activateReminders();
  activateDisciplines();
  activateRules();
  game.badEden5e = { MOD, TRADITIONS, castingFor, setPoints, restore, restorePoints, costAt, costFor, traditionOf, nativeTraditionOf, isCrossCast, abilityFor, castThrough, crossCastsFor, autoCastThrough, redshirts, riders, disciplines, linkedDomain, domainContext, rules: { grantFirearms, FIREARM_CLASSES } };
  console.log(`${MOD} | ready: the Flow and Artifice`);
});

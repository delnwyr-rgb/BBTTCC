// modules/bbttcc-territory/scripts/combat-dock.enhancer.js
// 2026-11-12: the Combat Dock moved to its own module (modules/combat-dock) so plain D&D worlds
// (the Third Kaeron War) can run it without Bad Eden. This shim keeps it loading in every Bad Eden
// world with no manifest change: the same URL is evaluated once even when the combat-dock module is
// also enabled (and combat-dock.js guards against a double start anyway).
import "./super-mode.js";   // SUPER MODE (2026-11-07): Draw button + the pledge card — Bad Eden only
import "../../combat-dock/scripts/combat-dock.js";

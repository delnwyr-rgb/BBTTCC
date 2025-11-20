// modules/bbttcc-raid/scripts/raid-maneuvers.js
// Minimal, safe registry: adds all Raid TYPES and lightweight getters.
// No UI code, no side effects. If other extenders exist, this merges with them.

(function () {
  const NS = "[bbttcc-raid:ext-types]";

  // --- tiny helper (frozen, non-destructive merge) ---
  const freeze = Object.freeze;
  const merge = (dst, add) => freeze(Object.assign({}, dst || {}, add || {}));

  // --- Canonical Raid Types (primaryKey drives which OP bucket is used) ---
  const TYPES = freeze({
    assault:      { key: "assault",      label: "Assault",           primaryKey: "violence",   summary: "Direct force to seize/neutralize a target." },
    infiltration: { key: "infiltration", label: "Infiltration",      primaryKey: "intrigue",   summary: "Stealth/guile to penetrate or extract." },
    espionage:    { key: "espionage",    label: "Espionage",         primaryKey: "intrigue",   summary: "Intel gathering; sabotage; preparation." },
    blockade:     { key: "blockade",     label: "Blockade",          primaryKey: "logistics",  summary: "Restrict movement; starve supply lines." },
    occupation:   { key: "occupation",   label: "Occupation",        primaryKey: "violence",   summary: "Hold captured territory; suppress unrest." },
    liberation:   { key: "liberation",   label: "Liberation",        primaryKey: "diplomacy",  summary: "Flip or stabilize control via public support." },
    propaganda:   { key: "propaganda",   label: "Propaganda",        primaryKey: "softpower",  summary: "Shape narratives; shift loyalty/attitudes." },
    ritual:       { key: "ritual",       label: "Ritual / Tikkun",   primaryKey: "faith",      summary: "Undertake a Tikkun/ritual linked to a Site." }
  });

  // --- Maneuvers (keys must match compat-bridge EFFECTS keys) ---
  // Applies-to mapping mirrors your sheet. "any" means all modes.
  const MANEUVERS = freeze({
    flank_attack: {
      key: "flank_attack",
      label: "Flank Attack",
      appliesTo: ["assault"],
      summary: "+2 roll bonus; +1 Defense loss to target if success."
    },
    supply_surge: {
      key: "supply_surge",
      label: "Supply Surge",
      appliesTo: ["any"],
      summary: "Ignore first 'clamped' penalty this round."
    },
    spy_network: {
      key: "spy_network",
      label: "Spy Network",
      appliesTo: ["infiltration", "espionage"],
      summary: "Reroll once; keep better result."
    },
    propaganda_push: {
      key: "propaganda_push",
      label: "Propaganda Push",
      appliesTo: ["propaganda", "liberation"],
      summary: "+2 morale to friendly hexes if success."
    },
    divine_favor: {
      key: "divine_favor",
      label: "Divine Favor",
      appliesTo: ["any"],
      summary: "+3 to roll; if failure, +1 Radiation risk to hex."
    },
    technocrat_override: {
      key: "technocrat_override",
      label: "Technocrat Override",
      appliesTo: ["espionage"], // sheet says Research/Espionage; we map to espionage mode here
      summary: "+10% OP gain next Strategic Turn."
    },
    defensive_entrenchment: {
      key: "defensive_entrenchment",
      label: "Defensive Entrenchment",
      // Until a dedicated 'defense' mode exists, surface this everywhere with a note:
      appliesTo: ["any"],
      summary: "+3 to DC this round. (Intended for Defensive Round.)"
    }
  });

  // Simple filter utility
  function maneuversForMode(mode) {
    const m = {};
    const mm = MANEUVERS;
    const wanted = String(mode || "").toLowerCase();
    for (const [k, v] of Object.entries(mm)) {
      const list = (v.appliesTo || []);
      if (list.includes("any") || list.includes(wanted)) m[k] = v;
    }
    return m;
  }

  Hooks.once("ready", () => {
    try {
      // Ensure namespace
      const root = (game.bbttcc ??= { api: {} });
      const api  = (root.api ??= {});
      const raid = (api.raid ??= {});

      // Merge TYPES so other modules can extend/override if present
      raid.TYPES = merge(raid.TYPES, TYPES);

      // Provide stable getters
      if (typeof raid.getTypes !== "function") {
        raid.getTypes = function getTypes() { return raid.TYPES || {}; };
      }
      // IMPORTANT: return maneuvers for the current mode (used by the Raid Console)
      raid.getManeuvers = function getManeuvers(mode) {
        return maneuversForMode(mode);
      };

      console.log(NS, "ready with types:", Object.keys(raid.TYPES || {}), "maneuvers:", Object.keys(MANEUVERS));
    } catch (e) {
      console.warn(NS, "init failed", e);
    }
  });
})();

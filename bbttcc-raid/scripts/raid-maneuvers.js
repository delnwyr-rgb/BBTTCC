// modules/bbttcc-raid/scripts/raid-maneuvers.js
// TYPES-ONLY registry (alpha-safe)
// - Keeps Raid TYPES + getTypes()
// - Disables demo MANEUVERS injection so the Raid Console derives maneuvers solely from
//   game.bbttcc.api.raid.EFFECTS (compat-bridge), which is the authoritative catalog.

(function () {
  const NS = "[bbttcc-raid:ext-types]";

  const freeze = Object.freeze;
  const merge = (dst, add) => freeze(Object.assign({}, dst || {}, add || {}));

  const TYPES = freeze({
    assault:      { key: "assault",      label: "Assault",           primaryKey: "violence",   summary: "Direct force to seize/neutralize a target." },
    infiltration: { key: "infiltration", label: "Infiltration",      primaryKey: "intrigue",   summary: "Stealth/guile to penetrate or extract." },
    espionage:    { key: "espionage",    label: "Espionage",         primaryKey: "intrigue",   summary: "Intel gathering; sabotage; preparation." },
    blockade:     { key: "blockade",     label: "Blockade",          primaryKey: "logistics",  summary: "Restrict movement; starve supply lines." },
    siege:        { key: "siege",        label: "Siege",             primaryKey: "violence",   summary: "Sustained assault against fortified targets; pressure, attrition, and morale." },
    occupation:   { key: "occupation",   label: "Occupation",        primaryKey: "violence",   summary: "Hold captured territory; suppress unrest." },
    liberation:   { key: "liberation",   label: "Liberation",        primaryKey: "diplomacy",  summary: "Flip or stabilize control via public support." },
    propaganda:   { key: "propaganda",   label: "Propaganda",        primaryKey: "softpower",  summary: "Shape narratives; shift loyalty/attitudes." },
    ritual:       { key: "ritual",       label: "Ritual / Tikkun",   primaryKey: "faith",      summary: "Undertake a Tikkun/ritual linked to a Site." },

    // Scenario raid modes (wired in Raid Console as special modes)
    courtly:            { key: "courtly",            label: "Courtly Intrigue",      primaryKey: "diplomacy", kind: "scenario" },
    infiltration_alarm: { key: "infiltration_alarm", label: "Infiltration (Alarm)",  primaryKey: "intrigue",  kind: "scenario" }
  });

  Hooks.once("ready", () => {
    try {
      const root = (game.bbttcc ??= { api: {} });
      const api  = (root.api ??= {});
      const raid = (api.raid ??= {});

      raid.TYPES = merge(raid.TYPES, TYPES);

      if (typeof raid.getTypes !== "function") {
        raid.getTypes = function getTypes() { return raid.TYPES || {}; };
      }

      // IMPORTANT:
      // Return {} so Raid Console does NOT receive extra maneuvers from this helper file.
      // Maneuver catalog must come from compat-bridge EFFECTS.
      raid.getManeuvers = function getManeuvers(_mode) { return {}; };

      console.log(NS, "ready with types-only:", Object.keys(raid.TYPES || {}), "(maneuvers disabled)");
    } catch (e) {
      console.warn(NS, "init failed", e);
    }
  });
})();

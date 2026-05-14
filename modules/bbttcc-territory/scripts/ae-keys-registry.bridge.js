/* modules/bbttcc-territory/scripts/ae-keys-registry.bridge.js
 * Registers hex / strategic / faction-resource AE keys with the system-side
 * fourththing AE registry. Lets the AE typeahead surface bbttcc-territory
 * mechanics (hex resource nodes, fog state, faction-tier knobs, etc.) on
 * the same Active Effect editor as the system-native keys.
 *
 * No-op if the system isn't fourththing or the API isn't loaded.
 */

(() => {
  const TAG = "[bbttcc-territory ae-bridge]";

  const KEYS = [
    // ── Hex Resource Nodes ────────────────────────────────────────────────
    {
      key: "flags.bbttcc-territory.resourceNodes",
      label: "Hex — Resource Nodes (array)",
      category: "Hex / Strategic",
      desc: "Array of {id, materialKey, charges, …}. Override to inject custom nodes; add semantics not engine-defined.",
      modes: ["override"],
      valueHint: "JSON array",
      readBy: ["seed-hex-resource-nodes.macro", "harvestHexNode"]
    },
    {
      key: "flags.bbttcc-territory.terrain.key",
      label: "Hex — Terrain Key",
      category: "Hex / Strategic",
      desc: "Canonical terrain key (plains/forest/mountains/canyons/swamp/desert/river/ocean/ruins/wasteland).",
      valueHint: "string",
      modes: ["override"]
    },
    {
      key: "flags.bbttcc-territory.type",
      label: "Hex — Type",
      category: "Hex / Strategic",
      desc: "Hex type (wilderness/settlement/fortress/mine/farm/port/factory/research/temple/ruins).",
      valueHint: "string",
      modes: ["override"]
    },
    {
      key: "flags.bbttcc-territory.status",
      label: "Hex — Status",
      category: "Hex / Strategic",
      desc: "Claim status (unclaimed/claimed/contested/occupied).",
      valueHint: "string",
      modes: ["override"]
    },
    {
      key: "flags.bbttcc-territory.factionId",
      label: "Hex — Owning Faction ID",
      category: "Hex / Strategic",
      desc: "Faction actor id that claims this hex.",
      valueHint: "string"
    },
    {
      key: "flags.bbttcc-territory.modifiers",
      label: "Hex — Modifiers (array)",
      category: "Hex / Strategic",
      desc: "Active hex modifiers (well-maintained, fortified, contaminated, …).",
      valueHint: "JSON array",
      modes: ["override"]
    },
    {
      key: "flags.bbttcc-territory.integration.progress",
      label: "Hex — Integration Progress",
      category: "Hex / Strategic",
      desc: "0–6 ladder from Untouched Wilderness → Integrated Heartland."
    },
    {
      key: "flags.bbttcc-territory.alarm.value",
      label: "Hex — Alarm",
      category: "Hex / Strategic",
      desc: "Alarm tracker (0–99). Higher = more conflict pressure."
    },
    {
      key: "flags.bbttcc-territory.travel.unitsOverride",
      label: "Hex — Travel Units Override",
      category: "Hex / Strategic",
      desc: "GM override for travel cost in OP units."
    },
    {
      key: "flags.bbttcc-territory.development.stage",
      label: "Hex — Development Stage",
      category: "Hex / Strategic",
      desc: "Settlement build-out stage (0–6)."
    },

    // ── Leylines ──────────────────────────────────────────────────────────
    {
      key: "flags.bbttcc-territory.leylines.primaryResonance",
      label: "Leyline — Primary Resonance",
      category: "Hex / Strategic",
      desc: "Resonance key (none/keter/chokhmah/…).",
      valueHint: "string"
    },
    {
      key: "flags.bbttcc-territory.leylines.flowState",
      label: "Leyline — Flow State",
      category: "Hex / Strategic",
      desc: "normal / inverted / surging / stalled.",
      valueHint: "string"
    },
    {
      key: "flags.bbttcc-territory.leylines.purity",
      label: "Leyline — Purity",
      category: "Hex / Strategic",
      desc: "−5 to +5 purity rating."
    },
    {
      key: "flags.bbttcc-territory.leylines.gate.enabled",
      label: "Leyline Gate — Enabled",
      category: "Hex / Strategic",
      desc: "Boolean — gate active.",
      valueHint: "true|false",
      modes: ["override"]
    },

    // ── Faction-tier knobs (when AE applied to a faction actor) ───────────
    {
      key: "flags.bbttcc-factions.bannerColor",
      label: "Faction — Banner Color",
      category: "Faction",
      desc: "CSS hex string used for hex tinting and UI accents.",
      valueHint: "#rrggbb"
    }
  ];

  Hooks.once("ready", () => {
    try {
      const ae = game.fourththing?.ae;
      if (!ae?.registerMany) {
        // System isn't fourththing or picker didn't load — quietly skip.
        return;
      }
      ae.registerMany(KEYS);
      console.log(TAG, `registered ${KEYS.length} hex/strategic AE keys.`);
    } catch (e) {
      console.warn(TAG, "registry bridge failed", e);
    }
  });
})();

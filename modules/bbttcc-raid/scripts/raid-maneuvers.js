// modules/bbttcc-raid/scripts/raid-maneuvers.js
// TYPES-ONLY registry (alpha-safe)
// - Keeps Raid TYPES + getTypes()
// - Disables demo MANEUVERS injection so the Raid Console derives maneuvers solely from
//   game.bbttcc.api.raid.EFFECTS (compat-bridge), which is the authoritative catalog.
//
// 2026-05-12 — Three-faculty simplification. Collapses 11 raid types to 3
// canonical types tied to TCC active faculties (Violence/Intrigue/Presence).
// Legacy types are preserved for BC resolution (in-flight raids + tagged
// maneuvers still resolve cleanly) but flagged `deprecated:true` and hidden
// from `getTypes()` by default. Occupation/Liberation/Ritual are removed
// from raid scope entirely: the first two become raid OUTCOMES (hex state
// flips), the third lives in the B3 Tikkun system. See
// memory: project_raid_system_simplification_three_faculty_design_2026_05_12.md

(function () {
  const NS = "[bbttcc-raid:ext-types]";

  const freeze = Object.freeze;
  const merge = (dst, add) => freeze(Object.assign({}, dst || {}, add || {}));

  // CANONICAL — 3 raid types by active TCC faculty. The dropdown shows
  // these. Each carries an icon for HUD consumption.
  const TYPES_CANONICAL = freeze({
    violence: { key: "violence", label: "Battle", primaryKey: "violence", icon: "⚔",
                hint: "Fought on the battlemap, in combat rounds.",
                summary: "Direct combat across battle scenes. Subsumes Assault, Siege, Blockade." },
    intrigue: { key: "intrigue", label: "Heist", primaryKey: "intrigue", icon: "🥷",
                hint: "Fought on the battlemap, in combat rounds. Quiet until the alarm trips.",
                summary: "Stealth, intel, sabotage — uses the Alarm engine. Subsumes Infiltration, Espionage.",
                kind: "scenario" },
    presence: { key: "presence", label: "Parley", primaryKey: "softpower", icon: "♕",
                hint: "Talked out at the table. Influence, not dice.",
                summary: "Social and narrative pressure — uses the Influence engine. Subsumes Propaganda, Courtly Intrigue.",
                kind: "scenario" }
    // NOTE: presence's primaryKey is "softpower" (the canonical OP pool for social/narrative
    // pressure). "presence" is the *raid type* (faculty), not a real OP pool. Courtly-style
    // raids that lean on diplomacy can stage diplomacy maneuvers via cross-pool spend.
  });

  // LEGACY — kept for BC. Each maps to a canonical via `raidType`. Marked
  // `deprecated:true` so `getTypes()` filters them out by default. The three
  // entries with `removed:` are out of raid scope entirely:
  //   - occupation/liberation → hex state outcomes (set by raid resolution)
  //   - ritual → B3 Tikkun system
  const TYPES_LEGACY = freeze({
    assault:            { key: "assault",            label: "Assault",              primaryKey: "violence",   raidType: "violence", deprecated: true, summary: "Direct force to seize/neutralize a target." },
    siege:              { key: "siege",              label: "Siege",                primaryKey: "violence",   raidType: "violence", deprecated: true, summary: "Sustained assault against fortified targets." },
    blockade:           { key: "blockade",           label: "Blockade",             primaryKey: "logistics",  raidType: "violence", deprecated: true, summary: "Restrict movement; starve supply lines." },
    infiltration:       { key: "infiltration",       label: "Infiltration",         primaryKey: "intrigue",   raidType: "intrigue", deprecated: true, summary: "Stealth/guile to penetrate or extract." },
    espionage:          { key: "espionage",          label: "Espionage",            primaryKey: "intrigue",   raidType: "intrigue", deprecated: true, summary: "Intel gathering; sabotage; preparation." },
    infiltration_alarm: { key: "infiltration_alarm", label: "Infiltration (Alarm)", primaryKey: "intrigue",   raidType: "intrigue", deprecated: true, kind: "scenario" },
    propaganda:         { key: "propaganda",         label: "Propaganda",           primaryKey: "softpower",  raidType: "presence", deprecated: true, summary: "Shape narratives; shift loyalty/attitudes." },
    courtly:            { key: "courtly",            label: "Parley",               primaryKey: "diplomacy",  raidType: "presence", deprecated: true, kind: "scenario" },
    // Out of raid scope:
    occupation:         { key: "occupation",         label: "Occupation",           primaryKey: "violence",   raidType: null, deprecated: true, removed: "outcome",        summary: "[moved] Now a raid outcome — hex state flip." },
    liberation:         { key: "liberation",         label: "Liberation",           primaryKey: "diplomacy",  raidType: null, deprecated: true, removed: "outcome",        summary: "[moved] Now a raid outcome — hex state flip." },
    ritual:             { key: "ritual",             label: "Ritual / Tikkun",      primaryKey: "faith",      raidType: null, deprecated: true, removed: "tikkun-system",  summary: "[moved] Now part of the B3 Tikkun sparks system." }
  });

  // Full union — used for BC lookup by legacy `activityKey`.
  const TYPES = freeze({ ...TYPES_CANONICAL, ...TYPES_LEGACY });

  // ALPHA CUT ruling 2 (Dave, blessed 2026-10-18): the table says Battle / Heist / Parley. Keys stay
  // violence / intrigue / presence. Rounds saved under the old labels are read through LEGACY_LABELS.
  const LEGACY_LABELS = freeze({
    "Violence Raid": "Battle", "Violence": "Battle", "Assault": "Battle", "Siege": "Battle",
    "Intrigue Raid": "Heist", "Intrigue": "Heist", "Infiltration": "Heist", "Infiltration (Alarm)": "Heist",
    "Presence Raid": "Parley", "Presence": "Parley", "Courtly Intrigue": "Parley", "Courtly": "Parley", "Propaganda": "Parley"
  });
  /** Player-facing label for any raid-type key or any stored label (old or new). Falls back to the input. */
  function typeLabel(keyOrLabel) {
    const s = String(keyOrLabel || "").trim();
    if (!s) return "";
    const k = s.toLowerCase();
    if (TYPES_CANONICAL[k]) return TYPES_CANONICAL[k].label;
    const canon = resolveCanonical(k);
    if (canon && TYPES_CANONICAL[canon]) return TYPES_CANONICAL[canon].label;
    return LEGACY_LABELS[s] || s;
  }
  /** One-line on-screen hint for a raid-type key ("Fought on the battlemap…"). */
  function typeHint(key) {
    const k = String(key || "").toLowerCase();
    const canon = TYPES_CANONICAL[k] ? k : resolveCanonical(k);
    return (canon && TYPES_CANONICAL[canon]?.hint) || "";
  }

  // Map any key (canonical or legacy) to its canonical raidType key. Returns
  // null for keys that are out of raid scope (occupation/liberation/ritual).
  function resolveCanonical(key) {
    const k = String(key || "").toLowerCase();
    if (TYPES_CANONICAL[k]) return k;
    const legacy = TYPES_LEGACY[k];
    return legacy?.raidType ?? null;
  }

  Hooks.once("ready", () => {
    try {
      const root = (game.bbttcc ??= { api: {} });
      const api  = (root.api ??= {});
      const raid = (api.raid ??= {});

      // Full registry stays at raid.TYPES for BC lookups by old activityKey.
      raid.TYPES = merge(raid.TYPES, TYPES);

      // `getTypes()` returns canonical only — drives the Pick Raid Type
      // dropdown + downstream UI. Callers wanting the legacy entries
      // (history, in-flight session resolution) can read raid.TYPES.
      raid.getTypes = function getTypes(opts) {
        if (opts && opts.includeLegacy) return raid.TYPES || {};
        return TYPES_CANONICAL;
      };

      // New helpers:
      raid.getCanonicalTypes = function getCanonicalTypes() { return TYPES_CANONICAL; };
      raid.getLegacyTypes    = function getLegacyTypes()    { return TYPES_LEGACY; };
      raid.resolveCanonical  = resolveCanonical;
      raid.typeLabel         = typeLabel;
      raid.typeHint          = typeHint;
      raid.LEGACY_TYPE_LABELS = LEGACY_LABELS;

      // IMPORTANT:
      // Return {} so Raid Console does NOT receive extra maneuvers from this helper file.
      // Maneuver catalog must come from compat-bridge EFFECTS.
      raid.getManeuvers = function getManeuvers(_mode) { return {}; };

      console.log(NS, "ready — canonical:", Object.keys(TYPES_CANONICAL), "+ legacy aliased:", Object.keys(TYPES_LEGACY).length, "entries");
    } catch (e) {
      console.warn(NS, "init failed", e);
    }
  });
})();

function baseSpec(api, key) {
  return { family: api.familyForKey(key) };
}

function defaultVisualsForFamily(family, key) {
  const f = String(family || "martial");
  const base = {
    cinematicPhase: "resolve",
    effectMs: 2400,
    canvasRadius: 132,
    canvasMs: 1000,
    resolveOverlayMs: 950,
    impactOverlayMs: 700,
    resolveShake: "",
    impactShake: ""
  };

  if (f === "faith") return { ...base, canvasColor: 0x67d4ff, resolveOverlay: "ritual-rays", impactOverlay: "ritual-rays", canvasRadius: 140 };
  if (f === "void") return { ...base, canvasColor: 0x7a5cff, resolveOverlay: "void-fracture", impactOverlay: "void-fracture", canvasRadius: 150, impactShake: "subtle", resolveShake: "subtle" };
  if (f === "temporal") return { ...base, canvasColor: 0x6fa8ff, resolveOverlay: "temporal-ripple", impactOverlay: "temporal-ripple", canvasRadius: 146 };
  if (f === "industrial") return { ...base, canvasColor: 0xff8c42, resolveOverlay: "tactical-sweep", impactOverlay: "tactical-sweep", canvasRadius: 145 };
  if (f === "political") return { ...base, canvasColor: 0xd4af37, resolveOverlay: "mirror-flash", impactOverlay: "mirror-flash", canvasRadius: 136 };
  if (f === "boss") return { ...base, canvasColor: 0x8b1e3f, resolveOverlay: "void-fracture", impactOverlay: "void-fracture", canvasRadius: 185, resolveShake: "heavy" };
  return { ...base, canvasColor: 0xff6b4a, resolveOverlay: "assault", impactOverlay: "assault", canvasRadius: 138 };
}

function cinematicSpecs(api) {
  return {
    chrono_loop_command: {
      ...baseSpec(api, "chrono_loop_command"),
      canvasColor: 0x6fa8ff,
      canvasRadius: 150,
      impactOverlay: "temporal-ripple",
      resolveOverlay: "temporal-ripple"
    },
    sephirotic_intervention: {
      ...baseSpec(api, "sephirotic_intervention"),
      canvasColor: 0x67d4ff,
      canvasRadius: 140,
      impactOverlay: "ritual-rays",
      resolveOverlay: "ritual-rays"
    },
    void_signal_collapse: {
      ...baseSpec(api, "void_signal_collapse"),
      canvasColor: 0x7a5cff,
      canvasRadius: 155,
      impactOverlay: "void-fracture",
      resolveOverlay: "void-fracture",
      impactShake: "subtle",
      resolveShake: "subtle"
    },
    defenders_reversal: {
      ...baseSpec(api, "defenders_reversal"),
      canvasColor: 0xffc857,
      canvasRadius: 145,
      resolveOverlay: "mirror-flash",
      impactOverlay: "mirror-flash"
    },
    reality_hack: {
      ...baseSpec(api, "reality_hack"),
      canvasColor: 0x67d4ff,
      canvasRadius: 140,
      resolveOverlay: "temporal-ripple",
      impactOverlay: "temporal-ripple"
    },
    raid_outcome: {
      ...baseSpec(api, "raid_outcome"),
      canvasColor: 0xff6b4a,
      canvasRadius: 150,
      canvasMs: 760,
      resolveOverlay: "assault"
    },
    facility_damage: {
      ...baseSpec(api, "facility_damage"),
      canvasColor: 0xff8c42,
      canvasRadius: 160,
      canvasMs: 780,
      resolveOverlay: "tactical-sweep"
    },
    rig_damage: {
      ...baseSpec(api, "rig_damage"),
      canvasColor: 0xff8c42,
      canvasRadius: 155,
      canvasMs: 760,
      resolveOverlay: "tactical-sweep"
    },
    boss_phase_change: {
      ...baseSpec(api, "boss_phase_change"),
      canvasColor: 0x8b1e3f,
      canvasRadius: 195,
      canvasMs: 960,
      resolveOverlay: "void-fracture",
      resolveShake: "heavy"
    },
    infiltration_alarm: {
      ...baseSpec(api, "infiltration_alarm"),
      canvasColor: 0x7a5cff,
      canvasRadius: 130,
      impactOverlay: "infiltration",
      resolveOverlay: "infiltration"
    },
    courtly_exchange: {
      ...baseSpec(api, "courtly_exchange"),
      canvasColor: 0xd4af37,
      canvasRadius: 125,
      impactOverlay: "mirror-flash",
      resolveOverlay: "mirror-flash"
    }
  };
}

function canonicalizeKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function aliasKeyMap() {
  return {
    defender_s_reversal: "defenders_reversal"
  };
}

function buildGenericManeuverSpecs(api) {
  const out = {};
  const aliases = aliasKeyMap();

  const registerKey = (rawKey) => {
    const key = canonicalizeKey(rawKey);
    if (!key || out[key]) return;
    const family = api.familyForKey(key);
    const visuals = defaultVisualsForFamily(family, key);
    out[key] = {
      family,
      ...visuals
    };
    const alias = aliases[key];
    if (alias && !out[alias]) {
      out[alias] = {
        ...out[key],
        key: alias
      };
    }
  };

  try {
    const agent = game.bbttcc?.api?.agent;
    const throughput = agent?.__THROUGHPUT || {};
    for (const key of Object.keys(throughput || {})) registerKey(key);
  } catch {}

  try {
    const raid = game.bbttcc?.api?.raid;
    const effects = raid?.EFFECTS || {};
    for (const [key, eff] of Object.entries(effects)) {
      if (String(eff?.kind || "") !== "maneuver") continue;
      registerKey(key);
      registerKey(eff?.unlockKey);
      registerKey(eff?.label);
    }
  } catch {}

  return out;
}

export async function installRegistry(api) {
  const agent = game.bbttcc?.api?.agent;
  let throughput = {};
  try {
    throughput = agent?.__THROUGHPUT || {};
  } catch {}

  for (const key of Object.keys(throughput || {})) {
    api.register(key, baseSpec(api, key));
  }

  [
    "raid_outcome",
    "facility_damage",
    "rig_damage",
    "boss_phase_change",
    "turn_start",
    "turn_end",
    "turn_weather",
    "turn_loyalty",
    "turn_morale",
    "turn_darkness",
    "turn_build_units",
    "turn_trade_routes",
    "turn_logistics_pressure",
    "infiltration_alarm",
    "courtly_exchange"
  ].forEach((key) => api.register(key, baseSpec(api, key)));

  const generic = buildGenericManeuverSpecs(api);
  for (const [key, spec] of Object.entries(generic)) api.register(key, spec);

  const specs = cinematicSpecs(api);
  for (const [key, spec] of Object.entries(specs)) api.register(key, spec);
}

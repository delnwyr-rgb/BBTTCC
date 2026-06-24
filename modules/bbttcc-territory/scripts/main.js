/* ---------- bbttcc-territory / scripts/main.js (Auto-calc restored + Manual Override) ---------- */

// BBTTCC_TERR_DASH_CLEANUP
// AppV2 safety: clear legacy Territory Dashboard singleton reference.
// The opener should use game.bbttcc.apps.territoryDashboard (or BBTTCC_OpenTerritoryDashboard).
Hooks.once("ready", () => {
  try {
    const desc = Object.getOwnPropertyDescriptor(globalThis, "__bbttcc_dashboard");
    if (desc && ("value" in desc)) delete globalThis.__bbttcc_dashboard;
  } catch (e) {
    console.warn("[bbttcc-territory] dashboard cleanup failed", e);
  }
});

const MOD = "bbttcc-territory";
const TOOLBAR_ID = "bbttcc-toolbar";
const renderTpl = foundry.applications?.handlebars?.renderTemplate || renderTemplate;
const TPL_HEX_CONFIG = `modules/${MOD}/templates/hex-config.hbs`;

/* ---------------- Hex Dossier — Improvement Ledger ----------------
 * Append-only ledger that records every player-visible mutation a hex goes
 * through (build, modifier add/remove, type/size/sephirot change, integration
 * step, owner action, garrison event, raid outcome). Powers the "How we got
 * here" timeline on the player Hex Sheet dossier panel.
 *
 * Two payloads on each hex Drawing:
 *   flags.bbttcc-territory.improvements:    HexImprovement[]   (last 250)
 *   flags.bbttcc-territory.modifierHistory: { [modifier]: { addedTs, addedBy, source, removedTs? } }
 *
 * HexImprovement shape:
 *   { id, ts, turn, kind, label, description, source:{activity?,factionId?,beatId?,raidId?},
 *     before?, after?, reversible, dedupeKey? }
 */
const HEX_IMPROVEMENT_CAP = 250;

// Plain-English descriptions for every modifier the system knows about.
// Two naming conventions live on `flags.bbttcc-territory.modifiers[]`:
//   Title Case names from bbttcc-factions/scripts/module.js MODS dict
//   snake_case names from bbttcc-territory/scripts/resolutions.js outcomes
// Lookup is case-insensitive and tolerant of underscores/spaces, so callers
// can pass either form.
const MOD_DESCRIPTIONS = {
  // Title-case canon (faction MODS dict)
  "well-maintained":         "+25% production, +1 defense, +1 loyalty",
  "fortified":               "+3 defense",
  "strategic position":      "+10% production; counts as adjacency anchor",
  "hidden resources":        "Stable per-hex bonus to a single resource (deterministic by hex id)",
  "loyal population":        "+15% production, +2 loyalty",
  "trade hub":               "+50% trade output, +2 diplomacy",
  "contaminated":            "−50% production; radiation flag set",
  "damaged infrastructure":  "−25% production",
  "hostile population":      "−25% production, −2 loyalty",
  "supply line vulnerable":  "−10% production; supply chain at risk",
  "difficult terrain":       "−10% production, +1 defense",
  "radiation zone":          "−75% production; radiation hazard zone",
  // snake_case canon (resolution outcomes)
  "loyal_population":        "+15% production, +2 loyalty (post-resolution)",
  "hostile_population":      "−25% production, −2 loyalty (post-resolution)",
  "liberated":               "Population freed from prior regime; loyalty rebuilt over time",
  "integration_pact":        "Formal alliance with the population; integration accelerated",
  "best_friends":            "Deep cultural integration; strongest loyalty floor",
  "subjugated":              "Population ruled by force; resentment grows over time",
  "devastated":              "Hex wrecked beyond normal recovery",
  "scorched_earth":          "Land salted; production reset; rebuild required"
};

function _normalizeModName(name) {
  return String(name ?? "").trim().toLowerCase().replace(/[_\s]+/g, " ").replace(/^\s+|\s+$/g, "");
}

function describeHexModifier(name) {
  const k = _normalizeModName(name);
  if (!k) return "";
  // Try direct, then with underscores normalized to spaces.
  return MOD_DESCRIPTIONS[k]
      ?? MOD_DESCRIPTIONS[k.replace(/\s+/g, "_")]
      ?? "";
}

function _hexImprovementId() {
  try { return foundry.utils?.randomID?.(16) || randomID?.(16) || `imp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
  catch { return `imp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
}

function _currentWorldTurn() {
  try {
    const w = game?.bbttcc?.api?.world;
    const s = w?.getState ? w.getState() : null;
    const n = Number(s?.turn ?? s?.time?.turn ?? null);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

/**
 * Append a HexImprovement entry to the hex's ledger.
 *
 * @param {Drawing|DrawingDocument} hexDoc - The hex Drawing document
 * @param {object} payload - Partial entry; id/ts/turn auto-filled
 * @param {string} payload.kind - One of: build, modifier_added, modifier_removed,
 *   size_up, size_down, sephirot_set, sephirot_changed, type_change,
 *   integration_step, owner_action, garrison, raid_outcome, legacy_seed
 * @param {string} payload.label - Headline (e.g. "Trade Hub added")
 * @param {string} [payload.description] - One-line effect summary
 * @param {object} [payload.source] - { activity?, factionId?, beatId?, raidId? }
 * @param {object} [payload.before] - Snapshot of changed fields pre-mutation
 * @param {object} [payload.after]  - Snapshot post-mutation
 * @param {boolean} [payload.reversible=false]
 * @param {string} [payload.dedupeKey] - If present, skip if last entry has same key
 *   (used by raid umbrella entries to suppress duplicate child writes)
 */
async function recordHexImprovement(hexDoc, payload = {}) {
  try {
    const doc = hexDoc?.document ?? hexDoc;
    if (!doc?.setFlag) return null;
    if (!payload || !payload.kind) return null;

    const existing = (await doc.getFlag(MOD, "improvements")) || [];
    const list = Array.isArray(existing) ? existing.slice() : [];

    // Dedupe: if the most recent entry has the same dedupeKey, skip.
    if (payload.dedupeKey) {
      const last = list[list.length - 1];
      if (last && last.dedupeKey === payload.dedupeKey) return last;
    }

    const entry = {
      id: _hexImprovementId(),
      ts: Date.now(),
      turn: _currentWorldTurn(),
      kind: String(payload.kind),
      label: String(payload.label || payload.kind),
      description: String(payload.description || ""),
      source: payload.source || {},
      before: payload.before ?? null,
      after: payload.after ?? null,
      reversible: !!payload.reversible,
      dedupeKey: payload.dedupeKey || null
    };

    list.push(entry);
    // Trim to the most-recent N to keep flag size bounded.
    const trimmed = list.length > HEX_IMPROVEMENT_CAP
      ? list.slice(-HEX_IMPROVEMENT_CAP)
      : list;

    await doc.setFlag(MOD, "improvements", trimmed);

    // Notify any open Hex Dossier so it refreshes live.
    try { Hooks.callAll("bbttcc:hexImprovement", { hexUuid: doc.uuid, entry }); } catch (_e) {}

    return entry;
  } catch (e) {
    console.warn("[bbttcc-territory] recordHexImprovement failed", e);
    return null;
  }
}

/**
 * Update modifierHistory map and append a paired modifier_added/modifier_removed
 * entry to the improvements ledger. Use this for every modifier diff.
 *
 * @param {Drawing|DrawingDocument} hexDoc
 * @param {string} modifier - Modifier name (Title Case or snake_case)
 * @param {"added"|"removed"} transition
 * @param {object} [source] - { activity?, factionId?, beatId?, raidId? }
 * @param {string} [dedupeKey]
 */
async function recordHexModifierTransition(hexDoc, modifier, transition, source = {}, dedupeKey = null) {
  try {
    const doc = hexDoc?.document ?? hexDoc;
    if (!doc?.setFlag) return null;
    const name = String(modifier || "").trim();
    if (!name) return null;

    const map = (await doc.getFlag(MOD, "modifierHistory")) || {};
    const histKey = name; // preserve original casing for display
    const entry = (map && typeof map === "object" && map[histKey]) || null;

    const ts = Date.now();
    const turn = _currentWorldTurn();

    if (transition === "added") {
      map[histKey] = { addedTs: ts, addedTurn: turn, addedBy: source?.factionId || source?.activity || "", source, removedTs: null };
    } else if (transition === "removed") {
      map[histKey] = entry
        ? Object.assign({}, entry, { removedTs: ts, removedTurn: turn, removedBy: source?.factionId || source?.activity || "" })
        : { addedTs: null, addedTurn: null, addedBy: null, source, removedTs: ts, removedTurn: turn, removedBy: source?.factionId || source?.activity || "" };
    }

    await doc.setFlag(MOD, "modifierHistory", map);

    const desc = describeHexModifier(name);
    const label = transition === "added" ? `Modifier added: ${name}` : `Modifier removed: ${name}`;
    const description = transition === "added"
      ? (desc ? `${name} — ${desc}` : `${name} applied.`)
      : (desc ? `${name} no longer active (was: ${desc})` : `${name} removed.`);

    return await recordHexImprovement(doc, {
      kind: transition === "added" ? "modifier_added" : "modifier_removed",
      label,
      description,
      source,
      reversible: true,
      dedupeKey
    });
  } catch (e) {
    console.warn("[bbttcc-territory] recordHexModifierTransition failed", e);
    return null;
  }
}
/* ---------------- /Hex Dossier — Improvement Ledger ----------------- */

/* ---------------- Hex Dossier — Next-Step Coach (Phase 4) ----------------
 * Pure function. Reads only `flags.bbttcc-territory.*` plus the static MODS /
 * INTEGRATION_STAGE_MULT / TYPE_BASE tables it understands, and returns a
 * structured list of suggestion groups for the dossier "What's next" panel.
 * No flag writes, no side effects. */

const DOSSIER_TYPE_BASE = {
  // mirrors bbttcc-factions calcBaseByType — kept local so the dossier can
  // reason about hex production without depending on the factions module.
  farm:       { food:20, trade:5,  materials:0,  military:0,  knowledge:0  },
  mine:       { food:0,  trade:5,  materials:20, military:0,  knowledge:0  },
  settlement: { food:0,  trade:10, materials:0,  military:5,  knowledge:0  },
  fortress:   { food:0,  trade:0,  materials:0,  military:20, knowledge:0  },
  port:       { food:5,  trade:15, materials:0,  military:0,  knowledge:0  },
  factory:    { food:0,  trade:0,  materials:15, military:5,  knowledge:0  },
  research:   { food:0,  trade:0,  materials:0,  military:0,  knowledge:20 },
  temple:     { food:0,  trade:5,  materials:0,  military:0,  knowledge:10 },
  ruins:      { food:0,  trade:0,  materials:5,  military:0,  knowledge:0  },
  wilderness: { food:0,  trade:0,  materials:0,  military:0,  knowledge:0  }
};

const DOSSIER_SIZE_LADDER = ["none", "outpost", "village", "town", "city", "metropolis", "megalopolis"];
const DOSSIER_SIZE_MULT = {
  none: 0, outpost: 0.5, village: 0.75, town: 1.0, city: 1.5, metropolis: 2.0, megalopolis: 3.0
};

const DOSSIER_SEPHIROT_HINTS = [
  { key:"keter",    label:"Keter",    bonus:"+1 to all resources" },
  { key:"chokmah",  label:"Chokmah",  bonus:"+2 Knowledge, +2 Trade" },
  { key:"binah",    label:"Binah",    bonus:"+2 Knowledge, +2 Trade" },
  { key:"chesed",   label:"Chesed",   bonus:"+3 Diplomacy, +3 Loyalty" },
  { key:"gevurah",  label:"Gevurah",  bonus:"+3 Military, +1 Defense" },
  { key:"tiferet",  label:"Tiferet",  bonus:"+2 Diplomacy, +2 Loyalty" },
  { key:"netzach",  label:"Netzach",  bonus:"+2 Military, +2 Loyalty" },
  { key:"hod",      label:"Hod",      bonus:"+2 Knowledge, +2 Trade" },
  { key:"yesod",    label:"Yesod",    bonus:"+2 Trade, +2 Diplomacy" },
  { key:"malkuth",  label:"Malkuth",  bonus:"+4 Trade" }
];

// Modifiers the player could realistically pursue. Excludes hostile/contaminated
///damaged etc. (those are penalties applied TO them, not opportunities).
//
// `activityKeys` references strategic-activity keys in game.bbttcc.api.raid.EFFECTS;
// the dossier UI looks each one up at render time to pull the live label + cost
// and compute affordability against the owning faction's OP bank.
const DOSSIER_AVAILABLE_MODIFIERS = [
  { name:"Well-Maintained",     effect:"+25% production, +1 defense, +1 loyalty",      hint:"Run an infrastructure-focused strategic activity, or spend Build Units on upkeep.", activityKeys:["develop_infrastructure_std","infrastructure_expansion","patrol_routes"] },
  { name:"Strategic Position",  effect:"+10% production; counts as adjacency anchor", hint:"Secure the perimeter to anchor adjacency.",                                          activityKeys:["secure_perimeter"] },
  { name:"Loyal Population",    effect:"+15% production, +2 loyalty",                  hint:"Run a loyalty / defuse activity, or push integration to Settled (5).",              activityKeys:["loyalty_program","defuse_tensions"] },
  { name:"Trade Hub",           effect:"+50% trade output, +2 diplomacy",              hint:"Establish supply lines or trade routes between owned hexes.",                       activityKeys:["establish_supply_line","establish_trade_route","infrastructure_expansion"] },
  { name:"Hidden Resources",    effect:"Stable per-hex bonus to one resource",         hint:"Discovered via exploration / scouting events.",                                     activityKeys:[] },
  { name:"Fortified",           effect:"+3 defense",                                   hint:"Run Fortify Hex (OP cost) OR spend Build Units on the Hex Sheet → Overview tab (faster, no OP).", activityKeys:["fortify_hex"], buPath:{ action:"fortify", description:"Open the Hex Sheet → Overview → Build Units (Engineering) → Fortify Hex. Costs Build Units instead of OP." } }
];

function computeHexNextSteps(dr) {
  const out = { integration: [], typeSize: [], sephirot: [], modifiers: [], ownerActions: [] };
  try {
    if (!dr) return out;
    const f = dr.flags?.[MOD] ?? {};
    const progress = Math.max(0, Math.min(6, Math.round(Number(f.integration?.progress ?? 0) || 0)));
    const stageKey = progress >= 6 ? "integrated" : progress === 5 ? "settled" : progress >= 3 ? "developing" : progress >= 1 ? "outpost" : "wild";

    // ------ Integration progress ------
    if (progress < 6) {
      const target = progress < 3 ? 3 : progress < 5 ? 5 : 6;
      const targetLabel = target === 3 ? "Developing (×1.05)" : target === 5 ? "Settled (×1.10)" : "Integrated (×1.20)";
      const stepsLeft = target - progress;
      // Strategic activities that move integration: outpost establishment when
      // wild, then development / reconstruction at higher stages.
      const integActivities = progress < 1
        ? ["establish_outpost"]
        : progress < 5
          ? ["upgrade_outpost_settlement","develop_infrastructure_std","reconstruction_drive_std"]
          : ["reconstruction_drive_std"];
      out.integration.push({
        priority: 1,
        label: `${stepsLeft} more +1 outcome${stepsLeft === 1 ? "" : "s"} → ${targetLabel}`,
        detail: `Currently ${stageKey} (${progress}/6). Each Justice/Reformation, Liberation, or Retribution outcome = +1. Best Friends Integration jumps straight to Settled (5).`,
        activityKeys: integActivities
      });
    } else {
      out.integration.push({ priority: 5, label: "Fully integrated (6/6).", detail: "Production multiplier maxed at ×1.20.", activityKeys: [] });
    }

    // ------ Type / size / sephirot ------
    const type = String(f.type || "").toLowerCase();
    const size = String(f.size || "none").toLowerCase();
    const sephKey = String(f.sephirotKey || "").toLowerCase();

    if (!type || type === "wilderness") {
      out.typeSize.push({
        priority: 1,
        label: "Type is wilderness — converting unlocks production.",
        detail: "Suggested: farm (Food 20), mine (Materials 20), fortress (Military 20), settlement (Trade 10 + Mil 5), research (Knowledge 20).",
        activityKeys: ["establish_outpost"]
      });
    }

    const sizeIdx = DOSSIER_SIZE_LADDER.indexOf(size);
    if (sizeIdx >= 0 && sizeIdx < DOSSIER_SIZE_LADDER.length - 1) {
      const cur = DOSSIER_SIZE_MULT[size];
      const next = DOSSIER_SIZE_LADDER[sizeIdx + 1];
      const nextMult = DOSSIER_SIZE_MULT[next];
      if (cur < nextMult) {
        out.typeSize.push({
          priority: 2,
          label: `Upgrade size: ${size} (×${cur}) → ${next} (×${nextMult})`,
          detail: `Production multiplier rises by ${(nextMult - cur).toFixed(2)}× when size is upgraded.`,
          activityKeys: ["upgrade_outpost_settlement","infrastructure_expansion","develop_infrastructure_std"]
        });
      }
    }

    if (!sephKey) {
      const typeFavoredSephirot = {
        farm: "chesed", mine: "malkuth", settlement: "tiferet",
        fortress: "gevurah", port: "yesod", factory: "hod",
        research: "chokmah", temple: "keter", ruins: "binah"
      };
      const fav = typeFavoredSephirot[type];
      const recs = fav
        ? DOSSIER_SEPHIROT_HINTS.filter(s => s.key === fav).concat(DOSSIER_SEPHIROT_HINTS.filter(s => s.key !== fav).slice(0, 2))
        : DOSSIER_SEPHIROT_HINTS.slice(0, 3);
      out.sephirot.push({
        priority: 2,
        label: "No sephirothic alignment — assigning one adds resource bonuses",
        detail: recs.map(r => `${r.label}: ${r.bonus}`).join(" • "),
        activityKeys: [],
        configHint: "Set in Hex Config (no strategic activity needed)."
      });
    }

    // ------ Modifier opportunities ------
    const activeMods = new Set((Array.isArray(f.modifiers) ? f.modifiers : []).map(m => String(m).trim().toLowerCase()));
    for (const cand of DOSSIER_AVAILABLE_MODIFIERS) {
      const k = cand.name.toLowerCase();
      if (activeMods.has(k)) continue;
      out.modifiers.push({
        priority: 3,
        label: `Eligible: ${cand.name}`,
        detail: `${cand.effect} — ${cand.hint}`,
        activityKeys: Array.isArray(cand.activityKeys) ? cand.activityKeys.slice() : [],
        buPath: cand.buPath || null
      });
    }

    // ------ Owner actions ------
    if (progress > 0 && stageKey !== "wild") {
      out.ownerActions.push({
        priority: 4,
        label: "Salt the Earth (owner action)",
        detail: "Resets integration to 0 and devastates the hex. Use as a last resort when you can no longer hold.",
        activityKeys: []
      });
    }

    return out;
  } catch (e) {
    console.warn("[bbttcc-territory] computeHexNextSteps failed", e);
    return out;
  }
}

/**
 * Render a per-resource production trace for the dossier "What's here" panel.
 * Mirrors the math in bbttcc-factions/scripts/module.js effHexWithAll without
 * importing it (single-source-of-truth lives there; this is a read-only echo).
 */
function traceHexProduction(dr) {
  try {
    const f = dr?.flags?.[MOD] ?? {};
    const type = String(f.type || "").toLowerCase();
    const size = String(f.size || "none").toLowerCase();
    const sizeMult = DOSSIER_SIZE_MULT[size] ?? 0;
    const base = DOSSIER_TYPE_BASE[type] ?? DOSSIER_TYPE_BASE.wilderness;
    const sized = {
      food:      Math.round(Number(base.food      || 0) * sizeMult),
      materials: Math.round(Number(base.materials || 0) * sizeMult),
      trade:     Math.round(Number(base.trade     || 0) * sizeMult),
      military:  Math.round(Number(base.military  || 0) * sizeMult),
      knowledge: Math.round(Number(base.knowledge || 0) * sizeMult)
    };
    const progress = Math.max(0, Math.min(6, Math.round(Number(f.integration?.progress ?? 0) || 0)));
    const integMult = progress >= 6 ? 1.20 : progress === 5 ? 1.10 : progress >= 3 ? 1.05 : 1.00;
    const final = {};
    for (const k of Object.keys(sized)) final[k] = Math.round(sized[k] * integMult);
    return {
      type, size, sizeMult,
      base,
      sized,
      integMult,
      final,
      manualOverride: !!f.manualOverride,
      stored: f.resources || null
    };
  } catch (e) {
    return null;
  }
}
/* ---------------- /Hex Dossier — Next-Step Coach ----------------- */

/* ---------------- Terrain Canon (Normalization) ----------------
 * Canonical terrain storage (single source of truth):
 *   flags.bbttcc-territory.terrain = { key, label }
 *
 * Compatibility (legacy readers):
 *   flags.bbttcc-territory.terrainType = key
 *   flags.bbttcc-territory.terrainKey  = key
 *
 * We normalize on every Hex Config save (writer-of-record) and provide a GM
 * helper to migrate existing hexes on the *current scene*.
 */
const BBTTCC_TERRAIN_LABELS = {
  plains:        "Plains / Grasslands",
  grasslands:    "Grasslands",
  forest:        "Forest / Jungle",
  jungle:        "Jungle",
  mountains:     "Mountains / Highlands",
  highlands:     "Highlands",
  canyons:       "Canyons / Badlands",
  badlands:      "Badlands",
  swamp:         "Swamp / Mire",
  mire:          "Mire",
  desert:        "Desert / Ash Wastes",
  ashWastes:     "Ash Wastes",
  river:         "River / Lake",
  lake:          "Lake",
  sea:           "Sea",
  ocean:         "Sea / Ocean",
  reef:          "Reef (underwater)",
  depths:        "Depths (underwater)",
  abyss:         "Abyss (underwater)",
  sky:           "Sky (aerial)",
  stratosphere:  "Stratosphere (aerial)",
  orbit:         "Orbit (space)",
  ruins:         "Ruins / Urban",
  urbanWreckage: "Urban Wreckage",
  wasteland:     "Wasteland / Radiation",
  radiation:     "Radiation Zone"
};

function bbttccTerrainFromType(type) {
  const t = String(type || "").toLowerCase().trim();
  const map = {
    wilderness: "plains",
    wasteland: "wasteland",
    ruins: "ruins",
    settlement: "plains",
    fortress: "plains",
    mine: "mountains",
    farm: "plains",
    port: "river",
    factory: "urbanWreckage",
    research: "urbanWreckage",
    temple: "plains"
  };
  return map[t] || "plains";
}

function bbttccNormalizeTerrainKey(raw) {
  const s = String(raw || "").trim();
  const low = s.toLowerCase();

  let mapped =
    (low.includes("mountain") || low.includes("highland")) ? "mountains" :
    (low.includes("canyon") || low.includes("badland")) ? "canyons" :
    (low.includes("swamp") || low.includes("mire") || low.includes("marsh")) ? "swamp" :
    (low.includes("forest") || low.includes("jungle")) ? "forest" :
    (low.includes("desert") || low.includes("ash")) ? "desert" :
    (low.includes("river") || low.includes("lake")) ? "river" :
    (low.includes("sea") || low.includes("ocean")) ? "ocean" :
    (low.includes("abyss")) ? "abyss" :
    (low.includes("reef")) ? "reef" :
    (low.includes("depth") || low === "deep" || low.includes("deeps")) ? "depths" :
    (low.includes("orbit") || low.includes("space")) ? "orbit" :
    (low.includes("strato") || low.includes("high-alt") || low.includes("highalt")) ? "stratosphere" :
    (low.includes("sky") || low.includes("aerial") || low.includes("aloft")) ? "sky" :
    (low.includes("ruin") || low.includes("urban")) ? "ruins" :
    (low.includes("wasteland") || low.includes("radiation")) ? "wasteland" :
    (low.includes("plain") || low.includes("grass")) ? "plains" :
    s;

  if (mapped === "ashwastes") mapped = "ashWastes";
  if (mapped === "urbanwreckage") mapped = "urbanWreckage";
  return mapped || "plains";
}

function bbttccReadTerrainKeyFromFlags(tf) {
  try {
    if (!tf || typeof tf !== "object") return null;
    const terr = tf.terrain;
    const fromObj = (terr && typeof terr === "object") ? (terr.key || terr.label) : null;
    const raw =
      fromObj ||
      tf.terrainKey ||
      tf.terrainType ||
      terr ||
      null;
    if (!raw) return null;
    return bbttccNormalizeTerrainKey(raw);
  } catch (_e) { return null; }
}

function bbttccBuildTerrainObj(key) {
  const k = bbttccNormalizeTerrainKey(key);
  return { key: k, label: BBTTCC_TERRAIN_LABELS[k] || k };
}

async function bbttccMigrateTerrainFlagsCurrentScene({ dryRun=false } = {}) {
  const draws = canvas?.drawings?.placeables || [];
  let scanned=0, updated=0, unchanged=0, unknown=0;
  const changed = [];

  for (const p of draws) {
    const doc = p?.document;
    const tf = doc?.flags?.[MOD];
    if (!tf || typeof tf !== "object") continue;
    scanned++;

    let key = bbttccReadTerrainKeyFromFlags(tf);
    if (!key) key = bbttccTerrainFromType(tf.type);
    if (!key) { unknown++; continue; }

    const terrObj = bbttccBuildTerrainObj(key);

    const cur = tf.terrain;
    const curKey = (cur && typeof cur === "object") ? String(cur.key || "") : String(tf.terrainKey || tf.terrainType || "");
    const curLabel = (cur && typeof cur === "object") ? String(cur.label || "") : "";

    const already =
      (cur && typeof cur === "object" && curKey === terrObj.key && curLabel === terrObj.label) &&
      String(tf.terrainType || "") === terrObj.key &&
      String(tf.terrainKey  || "") === terrObj.key;

    if (already) { unchanged++; continue; }

    updated++;
    changed.push({ id: doc.id, name: doc.text || tf.name || "(hex)", key: terrObj.key, label: terrObj.label });

    if (!dryRun) {
      await doc.update({
        [`flags.${MOD}.terrain`]: terrObj,
        [`flags.${MOD}.terrainType`]: terrObj.key,
        [`flags.${MOD}.terrainKey`]: terrObj.key
      }, { parent: doc.parent });
    }
  }

  console.log("[bbttcc-territory][terrain-migrate] Done", { scanned, updated, unchanged, unknown, dryRun, changed });
  try {
    if (changed.length) console.table(changed);
    ui?.notifications?.info?.(`Terrain normalize (${dryRun ? "dry run" : "applied"}): updated ${updated}/${scanned} (unknown: ${unknown}).`);
  } catch (_e) {}
  return { ok:true, scanned, updated, unchanged, unknown, dryRun, changed };
}

/* ---------------- War Log normalization (Alpha infra) ----------------
 * Some writers emit warLog entries with ts but no date, or date but no ts.
 * This hook normalizes any bbttcc-factions warLogs being written in an Actor update:
 * - ensures every entry has ts (number, ms)
 * - ensures every entry has date (locale string derived from ts)
 * Safe: only touches the update payload when warLogs are present.
 */
function bbttccNormalizeWarLogsInUpdate(updateData) {
  const MOD = "bbttcc-factions";
  const flags = updateData?.flags?.[MOD];
  if (!flags) return;

  // warLogs is the canonical key in this build; some older writers used warLog(s)
  const key = Array.isArray(flags.warLogs) ? "warLogs"
            : Array.isArray(flags.warLog)  ? "warLog"
            : null;
  if (!key) return;

  const now = Date.now();
  const arr = flags[key];
  if (!Array.isArray(arr)) return;

  flags[key] = arr.map((e) => {
    if (!e || typeof e !== "object") return e;
    const out = { ...e };

    // Prefer explicit ts; if absent, try to parse date; else use now.
    let ts = (typeof out.ts === "number" && Number.isFinite(out.ts)) ? out.ts : null;
    if (ts == null && typeof out.date === "string" && out.date.trim()) {
      const parsed = Date.parse(out.date);
      if (Number.isFinite(parsed)) ts = parsed;
    }
    if (ts == null) ts = now;
    out.ts = ts;

    // Ensure date is present and derived from ts (matching other subsystems' formatting)
    if (typeof out.date !== "string" || !out.date.trim()) {
      try { out.date = new Date(ts).toLocaleString(); }
      catch { out.date = new Date(now).toLocaleString(); }
    }

    return out;
  });
}

/* ---------------- Handlebars helpers ---------------- */
Hooks.once("init", () => {
// Normalize bbttcc-factions warLogs so every entry has both ts and date.
Hooks.on("preUpdateActor", (actor, updateData) => {
  try { bbttccNormalizeWarLogsInUpdate(updateData); } catch (e) {}
});


  if (!Handlebars.helpers.bbttcc_eq)
    Handlebars.registerHelper("bbttcc_eq", (a,b)=>String(a)===String(b));
  if (!Handlebars.helpers.bbttcc_contains)
    Handlebars.registerHelper("bbttcc_contains", (arr,v)=>{
      if (!arr) return false;
      if (Array.isArray(arr)) return arr.includes(v);
      return String(arr).split(",").map(s=>s.trim()).includes(v);
    });
});

/* ---------------- Visuals ---------------- */
const BBTTCC_STATUS_STYLE = {
  unclaimed: { fillColor:"#24313f", strokeColor:"#d9e6f2", fillAlpha:0.14, strokeAlpha:1.00, strokeWidth:6, textColor:"#f8fbff" },
  claimed:   { fillColor:"#0e2b3b", strokeColor:"#39d5ff", fillAlpha:0.18, strokeAlpha:1.00, strokeWidth:7, textColor:"#f3fbff" },
  contested: { fillColor:"#332508", strokeColor:"#ffd166", fillAlpha:0.19, strokeAlpha:1.00, strokeWidth:7, textColor:"#fff8df" },
  occupied:  { fillColor:"#321338", strokeColor:"#ff5ac8", fillAlpha:0.20, strokeAlpha:1.00, strokeWidth:7, textColor:"#fff4fc" }
};

const BBTTCC_TYPE_STYLE = {
  wilderness: { fillTint:"#8193a3", fillWeight:0.10 },
  settlement: { strokeTint:"#6ee7ff", strokeWeight:0.18, fillTint:"#17334a", fillWeight:0.12 },
  fortress:   { strokeTint:"#ff8f5a", strokeWeight:0.30, fillTint:"#472012", fillWeight:0.20, strokeWidthBonus:1 },
  mine:       { strokeTint:"#ffd38a", strokeWeight:0.26, fillTint:"#4a3720", fillWeight:0.18 },
  farm:       { strokeTint:"#fff0a8", strokeWeight:0.20, fillTint:"#2f3512", fillWeight:0.16 },
  port:       { strokeTint:"#7be7ff", strokeWeight:0.28, fillTint:"#0f2943", fillWeight:0.18 },
  factory:    { strokeTint:"#ff9f7a", strokeWeight:0.25, fillTint:"#41231c", fillWeight:0.18 },
  research:   { strokeTint:"#9c8cff", strokeWeight:0.28, fillTint:"#201c49", fillWeight:0.20 },
  temple:     { strokeTint:"#ffe58a", strokeWeight:0.30, fillTint:"#4a4314", fillWeight:0.18 },
  ruins:      { strokeTint:"#c6b7ff", strokeWeight:0.22, fillTint:"#353047", fillWeight:0.18 },
  wasteland:  { strokeTint:"#ff7f7f", strokeWeight:0.20, fillTint:"#4b1f2b", fillWeight:0.18 }
};

const BBTTCC_TERRAIN_STYLE = {
  plains:         { fillTint:"#7b8f64", fillWeight:0.08 },
  grasslands:     { fillTint:"#88a36c", fillWeight:0.08 },
  forest:         { fillTint:"#375b49", fillWeight:0.10 },
  jungle:         { fillTint:"#28624d", fillWeight:0.12 },
  mountains:      { strokeTint:"#ffffff", strokeWeight:0.08, fillTint:"#5b6573", fillWeight:0.08 },
  highlands:      { strokeTint:"#ffffff", strokeWeight:0.08, fillTint:"#5b6573", fillWeight:0.08 },
  canyons:        { fillTint:"#76513a", fillWeight:0.10 },
  badlands:       { fillTint:"#76513a", fillWeight:0.10 },
  swamp:          { fillTint:"#395046", fillWeight:0.12 },
  mire:           { fillTint:"#395046", fillWeight:0.12 },
  desert:         { fillTint:"#7d6841", fillWeight:0.10 },
  ashWastes:      { fillTint:"#655560", fillWeight:0.12 },
  river:          { strokeTint:"#9ae7ff", strokeWeight:0.16, fillTint:"#1c4860", fillWeight:0.14 },
  lake:           { strokeTint:"#9ae7ff", strokeWeight:0.16, fillTint:"#1c4860", fillWeight:0.14 },
  sea:            { strokeTint:"#9ae7ff", strokeWeight:0.16, fillTint:"#1c4860", fillWeight:0.14 },
  ocean:          { strokeTint:"#9ae7ff", strokeWeight:0.16, fillTint:"#1c4860", fillWeight:0.14 },
  ruins:          { fillTint:"#4a4255", fillWeight:0.12 },
  urbanWreckage:  { fillTint:"#4a4255", fillWeight:0.12 },
  wasteland:      { fillTint:"#5a3946", fillWeight:0.12 },
  radiation:      { strokeTint:"#d0ff66", strokeWeight:0.18, fillTint:"#355012", fillWeight:0.16 }
};

function bbttccClamp01(n) {
  n = Number(n);
  if (!Number.isFinite(n)) n = 0;
  return Math.max(0, Math.min(1, n));
}

function bbttccHexToRgb(hex) {
  const raw = String(hex || "").replace(/[^0-9a-f]/gi, "");
  const h = raw.length === 3
    ? raw.replace(/(.)/g, "$1$1")
    : (raw + "000000").slice(0, 6);
  return {
    r: parseInt(h.slice(0,2), 16) || 0,
    g: parseInt(h.slice(2,4), 16) || 0,
    b: parseInt(h.slice(4,6), 16) || 0
  };
}

function bbttccRgbToHex(rgb) {
  function c(v) {
    const n = Math.max(0, Math.min(255, Math.round(Number(v) || 0)));
    return n.toString(16).padStart(2, "0");
  }
  return "#" + c(rgb.r) + c(rgb.g) + c(rgb.b);
}

function bbttccMixHex(a, b, weightB) {
  const w = bbttccClamp01(weightB);
  const A = bbttccHexToRgb(a);
  const B = bbttccHexToRgb(b);
  return bbttccRgbToHex({
    r: A.r + (B.r - A.r) * w,
    g: A.g + (B.g - A.g) * w,
    b: A.b + (B.b - A.b) * w
  });
}

function bbttccVisualTypeKey(raw) {
  return String(raw || "wilderness").trim().toLowerCase();
}

function bbttccVisualTerrainKey(flags) {
  const terrObj = flags && flags.terrain && typeof flags.terrain === "object" ? flags.terrain : null;
  const terrRaw = terrObj ? (terrObj.key || terrObj.label || "") : (flags && (flags.terrainKey || flags.terrainType || ""));
  return bbttccNormalizeTerrainKey(terrRaw || bbttccTerrainFromType(flags && flags.type));
}

function bbttccHasLeyGate(flags) {
  try {
    return !!(flags && flags.leylines && flags.leylines.gate && flags.leylines.gate.enabled === true && String(flags.leylines.gate.linkHexUuid || "").trim());
  } catch (e) {
    return false;
  }
}

function bbttccApplyAccent(style, accent) {
  if (!accent || typeof accent !== "object") return style;
  if (accent.strokeTint) style.strokeColor = bbttccMixHex(style.strokeColor, accent.strokeTint, accent.strokeWeight || 0.2);
  if (accent.fillTint) style.fillColor = bbttccMixHex(style.fillColor, accent.fillTint, accent.fillWeight || 0.1);
  if (accent.textTint) style.textColor = bbttccMixHex(style.textColor, accent.textTint, accent.textWeight || 0.15);
  if (accent.strokeWidthBonus) style.strokeWidth += Number(accent.strokeWidthBonus) || 0;
  if (accent.fillAlphaBonus) style.fillAlpha += Number(accent.fillAlphaBonus) || 0;
  return style;
}

function bbttccCapitalDisplayText(rawText) {
  const base = String(rawText || "Hex").replace(/^\s*[✦◆◈★]+\s*/u, "").trim();
  return "✦ " + (base || "Capital");
}

function styleForStatus(status, opts) {
  opts = opts || {};
  let st = String(status || "unclaimed").toLowerCase();
  if (st === "scorched") st = "occupied"; // legacy rename

  const base = Object.assign({}, BBTTCC_STATUS_STYLE[st] || BBTTCC_STATUS_STYLE.unclaimed);
  const typeKey = bbttccVisualTypeKey(opts.type);
  const terrainKey = bbttccNormalizeTerrainKey(opts.terrainKey || bbttccTerrainFromType(typeKey));

  bbttccApplyAccent(base, BBTTCC_TYPE_STYLE[typeKey]);
  bbttccApplyAccent(base, BBTTCC_TERRAIN_STYLE[terrainKey]);

  if (opts.hasLeyGate) {
    base.strokeColor = bbttccMixHex(base.strokeColor, "#8f7cff", 0.42);
    base.fillColor = bbttccMixHex(base.fillColor, "#22195a", 0.18);
    base.strokeWidth += 1;
  }

  if (opts.capital) {
    base.strokeColor = bbttccMixHex(base.strokeColor, "#fff2a8", 0.82);
    base.fillColor = bbttccMixHex(base.fillColor, "#5a4310", 0.24);
    base.textColor = "#fff6cf";
    base.strokeWidth += 6;
    base.fillAlpha += 0.06;
    base.fontSize = 15;
    base.textStroke = "#1b1406";
  }

  if (typeKey === "fortress" || typeKey === "factory" || typeKey === "research") {
    base.strokeWidth += 1;
  }

  base.strokeWidth = Math.max(5, Math.round(base.strokeWidth));
  base.fillAlpha = Math.max(0.10, Math.min(0.34, base.fillAlpha));
  base.strokeAlpha = Math.max(0.96, Math.min(1.00, base.strokeAlpha));
  return base;
}
/* Hex name → drawing label.
 * Collapses runs of whitespace and replaces spaces with non-breaking spaces
 * so Foundry's Drawing text renderer doesn't wrap multi-word names into a
 * tall multi-line block that overflows the hex. Long single-word names are
 * still going to be weird (no smart shrinking yet), but a name like
 * "Bedlam Barrens" stays one line instead of stacking with white-space gaps.
 */
function bbttccSafeNameInput(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/\[object Object\]/i.test(s)) return "";
  return s;
}
function bbttccNameLabelForHex(rawName) {
  const s = bbttccSafeNameInput(rawName);
  if (!s) return "Hex";
  return s.replace(/\s+/g, " ");
}

/* Resolve a faction tint color for an owned hex. Reads the faction's
 * configured banner color; if missing, lazy-seeds from the first user with
 * OWNER permission on the faction actor (their `user.color`), persisting it
 * onto `flags.bbttcc-factions.bannerColor` so the seed is stable across
 * future renders. Returns a CSS hex string (#rrggbb) or null when there is
 * no resolvable owner. GM override: just setFlag a different color.
 */
async function bbttccResolveFactionTint(dr) {
  try {
    const f = dr?.flags?.[MOD] ?? {};
    const factionId = String(f.factionId || f.ownerId || "").trim();
    if (!factionId) return null;
    const actor = game?.actors?.get?.(factionId);
    if (!actor) return null;

    // Already cached on the faction actor → use it.
    let banner = actor.getFlag?.("bbttcc-factions", "bannerColor");
    if (typeof banner === "string" && /^#[0-9a-f]{6}$/i.test(banner.trim())) {
      return banner.trim();
    }

    // Seed from first owner-user. testUserPermission with "OWNER" mirrors
    // the faction-sheet visibility model.
    const users = (game?.users?.contents ?? []).filter(u => !!u && !u.isGM);
    const ownerUser = users.find(u => actor.testUserPermission?.(u, "OWNER"))
      || (game?.users?.contents ?? []).find(u => actor.testUserPermission?.(u, "OWNER"));
    const seed = ownerUser?.color;
    const seedStr = (typeof seed === "string") ? seed : (seed?.css || seed?.toString?.());
    if (typeof seedStr !== "string" || !/^#[0-9a-f]{6}$/i.test(seedStr.trim())) return null;

    const hex = seedStr.trim().toLowerCase();
    try { await actor.setFlag("bbttcc-factions", "bannerColor", hex); } catch (_e) { /* non-fatal */ }
    return hex;
  } catch (e) {
    console.warn("[bbttcc-territory] resolveFactionTint failed", e);
    return null;
  }
}

async function applyStyle(dr) {
  if (!dr) return;
  const f = dr.flags && dr.flags[MOD] ? dr.flags[MOD] : {};
  const isCapital = !!f.capital;
  const st = styleForStatus(f.status, {
    capital: isCapital,
    type: f.type,
    terrainKey: bbttccVisualTerrainKey(f),
    hasLeyGate: bbttccHasLeyGate(f)
  });
  // Defended against a previously-corrupt "[object Object]" persisted text.
  const baseLabel = bbttccSafeNameInput(f.name) || bbttccSafeNameInput(dr.text) || "Hex";
  const cleanedLabel = baseLabel.replace(/^\s*[✦◆◈★]+\s*/u, "").trim();
  const nextRaw = isCapital ? bbttccCapitalDisplayText(cleanedLabel) : cleanedLabel;
  const nextText = bbttccNameLabelForHex(nextRaw);

  // Faction tint — overrides status fill/stroke colors when an owner is set.
  // Wilderness / unclaimed hexes keep the styleForStatus colors untouched.
  const factionTint = await bbttccResolveFactionTint(dr);
  let fillColor = st.fillColor;
  let fillAlpha = st.fillAlpha;
  let strokeColor = st.strokeColor;
  let strokeAlpha = st.strokeAlpha;
  let strokeWidth = st.strokeWidth;
  if (factionTint) {
    strokeColor = factionTint;
    fillColor = factionTint;
    // Strong stroke so faction is readable at a glance; low-alpha fill so
    // the terrain background still shows through.
    strokeAlpha = Math.max(Number(strokeAlpha || 0), 0.85);
    fillAlpha = Math.min(Number(fillAlpha || 0), 0.12) || 0.12;
    strokeWidth = Math.max(Number(strokeWidth || 0), 3);
  }

  // Auto-shrink fontSize for longer names so multi-word text fits in the
  // hex without blowing out vertically. PIXI v7's wordWrap splits on every
  // \s-class char (including NBSP) so we can't guarantee single-line, but
  // we can make the wrapped text smaller so it doesn't overflow.
  const baseFontSize = isCapital
    ? Math.max(Number(dr.fontSize || 12), Number(st.fontSize || 15))
    : Math.max(12, Number(dr.fontSize || 12));
  const charCount = (nextText || "").length;
  const longNameScale = charCount > 12 ? Math.max(0.55, 12 / charCount) : 1;
  const fontSize = Math.max(8, Math.round(baseFontSize * longNameScale));

  const patch = {
    fillColor,
    fillAlpha,
    strokeColor,
    strokeAlpha,
    strokeWidth,
    textColor: st.textColor || "#f8fafc",
    fontSize,
    text: nextText || "Hex"
  };
  if (st.textStroke) patch.textStroke = st.textStroke;
  await dr.update(patch).catch(()=>{});
  try { await bbttccRefreshCapitalOverlayForDrawing(dr); } catch (_e) {}
}

/* ---------------- Capital Overlay Chrome (runtime-only, zero extra documents) ---------------- */
let BBTTCC_CAPITAL_OVERLAY_LAYER = null;

function bbttccGetCapitalOverlayHost() {
  try {
    if (!canvas || !canvas.primary) return null;
    // Scene swap rebuilds canvas.primary; the cached container then sits
    // orphaned (parent=null or destroyed) and addChild calls into it never
    // render. Drop the stale reference and build a fresh one.
    const stale = BBTTCC_CAPITAL_OVERLAY_LAYER && (
      BBTTCC_CAPITAL_OVERLAY_LAYER.destroyed ||
      BBTTCC_CAPITAL_OVERLAY_LAYER.parent !== canvas.primary
    );
    if (stale) {
      try { BBTTCC_CAPITAL_OVERLAY_LAYER.destroy({ children: true }); } catch (_e) {}
      BBTTCC_CAPITAL_OVERLAY_LAYER = null;
    }
    if (!BBTTCC_CAPITAL_OVERLAY_LAYER) {
      BBTTCC_CAPITAL_OVERLAY_LAYER = new PIXI.Container();
      BBTTCC_CAPITAL_OVERLAY_LAYER.sortableChildren = true;
      BBTTCC_CAPITAL_OVERLAY_LAYER.eventMode = "none";
      BBTTCC_CAPITAL_OVERLAY_LAYER.label = "bbttcc-capital-overlays";
      canvas.primary.addChild(BBTTCC_CAPITAL_OVERLAY_LAYER);
    }
    return BBTTCC_CAPITAL_OVERLAY_LAYER;
  } catch (e) {
    console.warn("[bbttcc-territory] capital overlay host failed", e);
    return null;
  }
}

function bbttccClearCapitalOverlays() {
  try {
    if (!BBTTCC_CAPITAL_OVERLAY_LAYER) return;
    const kids = BBTTCC_CAPITAL_OVERLAY_LAYER.removeChildren();
    for (const k of kids) {
      try { k.destroy({ children:true }); } catch (_e) {}
    }
  } catch (e) {
    console.warn("[bbttcc-territory] capital overlay clear failed", e);
  }
}

function bbttccDrawingBounds(doc) {
  try {
    const x = Number(doc.x || 0);
    const y = Number(doc.y || 0);
    const shape = doc.shape || {};
    const pts = Array.isArray(shape.points) ? shape.points : [];
    if (pts.length >= 12) {
      const xs = [];
      const ys = [];
      for (let i = 0; i < pts.length; i += 2) {
        xs.push(x + Number(pts[i] || 0));
        ys.push(y + Number(pts[i + 1] || 0));
      }
      return {
        minX: Math.min.apply(null, xs),
        minY: Math.min.apply(null, ys),
        maxX: Math.max.apply(null, xs),
        maxY: Math.max.apply(null, ys)
      };
    }
    const w = Number(doc.shape && doc.shape.width || doc.width || 0);
    const h = Number(doc.shape && doc.shape.height || doc.height || 0);
    return { minX:x, minY:y, maxX:x+w, maxY:y+h };
  } catch (e) {
    return { minX:0, minY:0, maxX:0, maxY:0 };
  }
}

function bbttccHexAbsPoints(doc) {
  const x = Number(doc.x || 0);
  const y = Number(doc.y || 0);
  const pts = (doc.shape && Array.isArray(doc.shape.points)) ? doc.shape.points : [];
  const out = [];
  for (let i = 0; i < pts.length; i += 2) out.push({ x: x + Number(pts[i] || 0), y: y + Number(pts[i + 1] || 0) });
  return out;
}

// Capital overlay uses PIXI.Graphics. Foundry v13/v14 ships PIXI v7, which
// exposes stroke/fill via `lineStyle` + `beginFill`/`endFill` + `drawPolygon`.
// The previous implementation called the PIXI v8 methods (`.poly()`,
// `.stroke({...})`, `.fill({...})`) which threw "glow.poly is not a function"
// on every scene draw. If/when Foundry moves to PIXI v8, this helper can be
// simplified back to the v8 fluent API.
/* Marker registry — type icons (custom PNG art) with FA glyph fallback.
 * Entries with `icon:` use PIXI.Sprite from the GOTTGAIT art set.
 * Entries with `glyph:` use FontAwesome 6 Free (weight 900) PIXI.Text.
 * `color` styles the disc ring + glyph fill; sprites render full color. */
const HEX_ICON_BASE = "art/bbttcc/GOTTGAIT/ArtForBBTTCCModule/GOTTGAIT%20Art/";
function bbttccHexIconUrl(filename) {
  return HEX_ICON_BASE + encodeURIComponent(filename);
}
const HEX_TYPE_GLYPHS = {
  port:       { icon:"bad_eden_map_overlay_port.png",              color:0x06b6d4, label:"Port" },
  fortress:   { icon:"bad_eden_map_overlay_fortress.png",          color:0xef4444, label:"Fortress" },
  farm:       { icon:"bad_eden_map_overlay_farm.png",              color:0x16a34a, label:"Farm" },
  mine:       { icon:"bad_eden_map_overlay_mine.png",              color:0xb45309, label:"Mine" },
  settlement: { icon:"bad_eden_map_overlay_settlement.png",        color:0x60a5fa, label:"Settlement" },
  research:   { icon:"bad_eden_map_overlay_research_facility.png", color:0xc084fc, label:"Research" },
  factory:    { icon:"bad_eden_map_overlay_factory_v2.png",        color:0x94a3b8, label:"Factory" },
  temple:     { icon:"bad_eden_map_overlay_temple.png",            color:0xfde047, label:"Temple" },
  wasteland:  { icon:"bad_eden_map_overlay_wasteland.png",         color:0xf87171, label:"Wasteland" },
  ruins:      { icon:"bad_eden_map_overlay_ruins.png",             color:0xa8a29e, label:"Ruins" },
  wilderness: { icon:"bad_eden_map_overlay_wilderness.png",        color:0x86efac, label:"Wilderness" }
};

const HEX_STAGE_PIP = {
  wild:       { color:0x52525b, alpha:0.0  }, // hidden
  outpost:    { color:0xfbbf24, alpha:0.55 },
  developing: { color:0xfbbf24, alpha:0.80 },
  settled:    { color:0xfde047, alpha:0.95 },
  integrated: { color:0xfacc15, alpha:1.0  }
};

const HEX_POSITIVE_MODS = new Set([
  "trade hub","loyal population","fortified","well-maintained","strategic position","hidden resources","supply line","supply cache","logistics hub","best_friends","integration_pact","loyal_population","liberated"
]);
const HEX_NEGATIVE_MODS = new Set([
  "hostile population","damaged infrastructure","contaminated","radiation zone","supply line vulnerable","difficult terrain","hostile_population","subjugated","devastated","scorched_earth"
]);

function bbttccHexStageKey(progress) {
  const p = Math.max(0, Math.min(6, Math.round(Number(progress ?? 0) || 0)));
  if (p >= 6) return "integrated";
  if (p === 5) return "settled";
  if (p >= 3) return "developing";
  if (p >= 1) return "outpost";
  return "wild";
}

// Returns the list of quests on this hex visible to the current viewer.
// GMs see all linked quests; players see only those marked `hinted` or on
// non-hidden (un-fogged) hexes. Lives here (not in the API module) so the
// PIXI overlay path doesn't need a Hooks.once("ready") gate.
function bbttccVisibleQuestsForHex(doc) {
  const f = doc && doc.flags && doc.flags[MOD] ? doc.flags[MOD] : {};
  const map = (f.quests && typeof f.quests === "object") ? f.quests : {};
  const ids = Object.keys(map);
  if (!ids.length) return [];
  if (game?.user?.isGM) return ids.map(qid => ({ qid, hinted: !!map[qid]?.hinted }));
  if (doc.hidden === false) return ids.map(qid => ({ qid, hinted: !!map[qid]?.hinted }));
  return ids.filter(qid => !!map[qid]?.hinted).map(qid => ({ qid, hinted: true }));
}

// TL-corner scroll marker — parchment disc with 📜 glyph, +N badge for stacks.
function bbttccBuildQuestScrollMarker(doc, bounds, size) {
  const visible = bbttccVisibleQuestsForHex(doc);
  if (!visible.length) return null;

  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const TL_x = (bounds.minX + cx) / 2;
  const TL_y = (bounds.minY + cy) / 2;
  const r = Math.max(11, Math.round(size * 0.10));

  const node = new PIXI.Container();
  node.eventMode = "none";
  node.zIndex = 9200;

  const halo = new PIXI.Graphics();
  halo.beginFill(0x000000, 0.35);
  halo.drawCircle(TL_x, TL_y, r + 3);
  halo.endFill();
  node.addChild(halo);

  const disc = new PIXI.Graphics();
  disc.lineStyle({ width: 2.5, color: 0x4a2f10, alpha: 0.95 });
  disc.beginFill(0xf5deb3, 0.97);
  disc.drawCircle(TL_x, TL_y, r);
  disc.endFill();
  node.addChild(disc);

  try {
    const glyph = new PIXI.Text("📜", {
      fontFamily: "system-ui, \"Apple Color Emoji\", \"Segoe UI Emoji\", sans-serif",
      fontSize: Math.max(14, Math.round(r * 1.35)),
      align: "center"
    });
    glyph.anchor.set(0.5, 0.5);
    glyph.x = TL_x;
    glyph.y = TL_y;
    node.addChild(glyph);
  } catch (e) { /* emoji renderer missing — disc alone reads as a marker */ }

  if (visible.length > 1) {
    const badgeR = Math.max(7, Math.round(r * 0.55));
    const bx = TL_x + r * 0.85;
    const by = TL_y + r * 0.85;
    const bg = new PIXI.Graphics();
    bg.lineStyle({ width: 1.5, color: 0xffffff, alpha: 1.0 });
    bg.beginFill(0x7c2d12, 1.0);
    bg.drawCircle(bx, by, badgeR);
    bg.endFill();
    node.addChild(bg);
    try {
      const n = new PIXI.Text("+" + (visible.length - 1), {
        fontFamily: "system-ui, sans-serif",
        fontSize: Math.max(10, Math.round(badgeR * 1.3)),
        fontWeight: "900",
        fill: 0xffffff,
        align: "center"
      });
      n.anchor.set(0.5, 0.5);
      n.x = bx; n.y = by;
      node.addChild(n);
    } catch {}
  }

  return node;
}

function bbttccBuildHexMarkerOverlay(doc, bounds, size) {
  const f = doc && doc.flags && doc.flags[MOD] ? doc.flags[MOD] : {};
  const ownerId = String(f.factionId || f.ownerId || "").trim();
  if (!ownerId) return null;  // Unclaimed: stay blank (quest scroll handled separately).

  const type = String(f.type || "").toLowerCase();
  const stageKey = bbttccHexStageKey(f.integration?.progress);
  const modList = Array.isArray(f.modifiers) ? f.modifiers : [];

  const root = new PIXI.Container();
  root.eventMode = "none";
  root.zIndex = 9100; // sits above the capital crest

  // Hex-edge midpoint helpers — most markers anchor ON the polygon border so
  // they read as part of the frame rather than floating inside the hex.
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const TR_x = (cx + bounds.maxX) / 2, TR_y = (bounds.minY + cy) / 2;

  // Center-bottom: type icon, horizontally centered and placed below the
  // hex name so it stacks cleanly under the label inside the hex interior.
  // Supports custom PNG art (typeMeta.icon) OR FontAwesome glyph fallback
  // (typeMeta.glyph). Disc + halo backdrop kept for now (drop later).
  const typeMeta = HEX_TYPE_GLYPHS[type];
  if (typeMeta && (typeMeta.icon || typeMeta.glyph)) {
    const r = Math.max(22, Math.round(size * 0.18));
    const ix = cx;
    const iy = cy + Math.round(size * 0.22); // below the name, in the lower-middle of the hex
    // Soft halo for contrast against busy map art.
    const halo = new PIXI.Graphics();
    halo.beginFill(0x000000, 0.35);
    halo.drawCircle(ix, iy, r + 3);
    halo.endFill();
    root.addChild(halo);
    const disc = new PIXI.Graphics();
    disc.beginFill(0x0f172a, 0.95);
    disc.lineStyle({ width: 3, color: typeMeta.color, alpha: 1.0 });
    disc.drawCircle(ix, iy, r);
    disc.endFill();
    root.addChild(disc);
    if (typeMeta.icon) {
      try {
        const tex = PIXI.Texture.from(bbttccHexIconUrl(typeMeta.icon));
        const sprite = new PIXI.Sprite(tex);
        sprite.anchor.set(0.5, 0.5);
        sprite.x = ix; sprite.y = iy;
        sprite.width = r * 1.85;  // fits inside the disc with a small margin
        sprite.height = r * 1.85;
        root.addChild(sprite);
      } catch (eIcon) { console.warn("[bbttcc-territory] type sprite failed", typeMeta.icon, eIcon); }
    } else if (typeMeta.glyph) {
      try {
        const text = new PIXI.Text(String(typeMeta.glyph), {
          fontFamily: "\"Font Awesome 6 Free\", \"FontAwesome\"",
          fontSize: Math.max(20, Math.round(r * 1.25)),
          fontWeight: "900",
          fill: typeMeta.color,
          align: "center"
        });
        text.anchor.set(0.5, 0.5);
        text.x = ix; text.y = iy;
        root.addChild(text);
      } catch (eIcon) { console.warn("[bbttcc-territory] type-icon text failed", eIcon); }
    }
  }

  // Top-right: integration pip (stage-tinted disc) with the raw progress
  // number 1–6 inside. Hidden entirely while wild (progress 0).
  const pip = HEX_STAGE_PIP[stageKey];
  const progressNum = Math.max(0, Math.min(6, Math.round(Number(f.integration?.progress ?? 0) || 0)));
  if (pip && pip.alpha > 0) {
    const r = Math.max(10, Math.round(size * 0.10));
    const pipG = new PIXI.Graphics();
    pipG.lineStyle({ width: 2.5, color: 0x0f172a, alpha: 0.9 });
    pipG.beginFill(pip.color, pip.alpha);
    pipG.drawCircle(TR_x, TR_y, r);
    pipG.endFill();
    root.addChild(pipG);
    if (progressNum > 0) {
      try {
        const num = new PIXI.Text(String(progressNum), {
          fontFamily: "system-ui, sans-serif",
          fontSize: Math.max(12, Math.round(r * 1.2)),
          fontWeight: "900",
          fill: 0x0f172a,
          align: "center"
        });
        num.anchor.set(0.5, 0.5);
        num.x = TR_x; num.y = TR_y;
        root.addChild(num);
      } catch (eN) { console.warn("[bbttcc-territory] integration-number text failed", eN); }
    }
  }

  // Bottom edge: up to 5 modifier dots, positives first then negatives.
  const goodMods = [];
  const badMods = [];
  for (const m of modList) {
    const k = String(m || "").trim().toLowerCase();
    if (!k) continue;
    if (HEX_POSITIVE_MODS.has(k)) goodMods.push(k);
    else if (HEX_NEGATIVE_MODS.has(k)) badMods.push(k);
  }
  const dots = goodMods.slice(0, 3).map(() => 0x86efac).concat(badMods.slice(0, 3).map(() => 0xf87171)).slice(0, 5);
  if (dots.length) {
    const dotR = Math.max(6, Math.round(size * 0.055));
    const gap = dotR * 2.4;
    const totalW = (dots.length - 1) * gap;
    const dy = bounds.maxY - dotR;
    const startX = cx - totalW / 2;
    for (let i = 0; i < dots.length; i++) {
      const dx = startX + i * gap;
      const g = new PIXI.Graphics();
      g.lineStyle({ width: 1.5, color: 0x0f172a, alpha: 0.9 });
      g.beginFill(dots[i], 0.95);
      g.drawCircle(dx, dy, dotR);
      g.endFill();
      root.addChild(g);
    }
  }

  // Owned-step-0 dot retired 2026-04-26 — the faction bannerColor tint on
  // the hex itself is enough to read "this is mine" without an extra dot.

  // TL-corner quest scroll — gated by viewer visibility (GM / unfogged / hinted).
  try {
    const scroll = bbttccBuildQuestScrollMarker(doc, bounds, size);
    if (scroll) root.addChild(scroll);
  } catch (eS) { console.warn("[bbttcc-territory] quest scroll marker failed", eS); }

  return root;
}

function bbttccBuildCapitalOverlayForDrawing(doc) {
  const f = doc && doc.flags && doc.flags[MOD] ? doc.flags[MOD] : {};
  // Quest hints are allowed to leak through the player-hidden gate AND the
  // unclaimed-hex gate — that's the "you've heard whispers" workflow. So we
  // detect "scroll-only" mode here and short-circuit the rest of the chrome.
  const visibleQuests = bbttccVisibleQuestsForHex(doc);
  const hiddenForViewer = !!(doc?.hidden && !game.user?.isGM);
  const ownedOrCapital = !!(f && (f.capital || (f.factionId || f.ownerId)));

  // Hide chrome from non-GMs on hidden hexes — except: if any quest is
  // hinted (or GM), still draw a stripped-down overlay containing only
  // the scroll marker so players can see the rumor pin.
  if (hiddenForViewer) {
    if (!visibleQuests.length) return null;
    const pts0 = bbttccHexAbsPoints(doc);
    if (!pts0.length) return null;
    const bounds0 = bbttccDrawingBounds(doc);
    const size0 = Math.max(bounds0.maxX - bounds0.minX, bounds0.maxY - bounds0.minY);
    const scroll0 = bbttccBuildQuestScrollMarker(doc, bounds0, size0);
    if (!scroll0) return null;
    const root0 = new PIXI.Container();
    root0.label = "bbttcc-capital-overlay:" + String(doc.id || "");
    root0.name  = root0.label;
    root0.eventMode = "none";
    root0.zIndex = 9000;
    root0.addChild(scroll0);
    return root0;
  }

  // Unclaimed hex with at least one visible quest — draw scroll-only too.
  if (!ownedOrCapital) {
    if (!visibleQuests.length) return null;
    const pts1 = bbttccHexAbsPoints(doc);
    if (!pts1.length) return null;
    const bounds1 = bbttccDrawingBounds(doc);
    const size1 = Math.max(bounds1.maxX - bounds1.minX, bounds1.maxY - bounds1.minY);
    const scroll1 = bbttccBuildQuestScrollMarker(doc, bounds1, size1);
    if (!scroll1) return null;
    const root1 = new PIXI.Container();
    root1.label = "bbttcc-capital-overlay:" + String(doc.id || "");
    root1.name  = root1.label;
    root1.eventMode = "none";
    root1.zIndex = 9000;
    root1.addChild(scroll1);
    return root1;
  }

  const pts = bbttccHexAbsPoints(doc);
  if (!pts.length) return null;

  const bounds = bbttccDrawingBounds(doc);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const size = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

  const flatPts  = pts.map(p => [p.x, p.y]).flat();
  const innerPts = pts.map(p => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return [cx + dx * 0.84, cy + dy * 0.84];
  }).flat();

  const root = new PIXI.Container();
  root.label = "bbttcc-capital-overlay:" + String(doc.id || "");
  root.name  = root.label;
  root.eventMode = "none";
  root.zIndex = 9000;
  root.alpha = 0.96;

  // Capital crest chrome — only when this hex is actually a capital.
  if (f.capital) {
    const glow = new PIXI.Graphics();
    glow.lineStyle({ width: Math.max(10, Math.round(size * 0.07)), color: 0xffd76a, alpha: 0.16, join: "round" });
    glow.drawPolygon(flatPts);
    root.addChild(glow);

    const frame = new PIXI.Graphics();
    frame.lineStyle({ width: Math.max(4, Math.round(size * 0.028)), color: 0xffefb0, alpha: 0.95, join: "round" });
    frame.drawPolygon(flatPts);
    root.addChild(frame);

    const inner = new PIXI.Graphics();
    inner.lineStyle({ width: Math.max(2, Math.round(size * 0.012)), color: 0x7be7ff, alpha: 0.70, join: "round" });
    inner.drawPolygon(innerPts);
    root.addChild(inner);

    const crest = new PIXI.Graphics();
    const crestY = cy - size * 0.34;
    const crestW = Math.max(12, size * 0.10);
    const crestH = Math.max(16, size * 0.12);
    crest.lineStyle({ width: Math.max(2, Math.round(size * 0.012)), color: 0xfff6cf, alpha: 0.95, join: "round" });
    crest.beginFill(0xffd76a, 0.92);
    crest.moveTo(cx, crestY - crestH * 0.55);
    crest.lineTo(cx + crestW * 0.82, crestY - crestH * 0.10);
    crest.lineTo(cx + crestW * 0.48, crestY + crestH * 0.62);
    crest.lineTo(cx, crestY + crestH * 0.28);
    crest.lineTo(cx - crestW * 0.48, crestY + crestH * 0.62);
    crest.lineTo(cx - crestW * 0.82, crestY - crestH * 0.10);
    crest.closePath();
    crest.endFill();
    root.addChild(crest);

    const brackets = new PIXI.Graphics();
    const seg = Math.max(10, size * 0.12);
    const inset = Math.max(6, size * 0.05);
    brackets.lineStyle({ width: Math.max(2, Math.round(size * 0.014)), color: 0xfff1a8, alpha: 0.90, join: "round" });
    brackets.moveTo(bounds.minX + inset, bounds.minY + inset + seg).lineTo(bounds.minX + inset, bounds.minY + inset).lineTo(bounds.minX + inset + seg, bounds.minY + inset);
    brackets.moveTo(bounds.maxX - inset - seg, bounds.minY + inset).lineTo(bounds.maxX - inset, bounds.minY + inset).lineTo(bounds.maxX - inset, bounds.minY + inset + seg);
    brackets.moveTo(bounds.minX + inset, bounds.maxY - inset - seg).lineTo(bounds.minX + inset, bounds.maxY - inset).lineTo(bounds.minX + inset + seg, bounds.maxY - inset);
    brackets.moveTo(bounds.maxX - inset - seg, bounds.maxY - inset).lineTo(bounds.maxX - inset, bounds.maxY - inset).lineTo(bounds.maxX - inset, bounds.maxY - inset - seg);
    root.addChild(brackets);
  }

  // Marker overlay — type icon + integration pip + modifier dots.
  // Renders for any owned hex (capital crest layers above when present).
  try {
    const markers = bbttccBuildHexMarkerOverlay(doc, bounds, size);
    if (markers) root.addChild(markers);
  } catch (eM) { console.warn("[bbttcc-territory] marker overlay build failed", eM); }

  return root;
}

async function bbttccRefreshCapitalOverlayForDrawing(doc) {
  try {
    const host = bbttccGetCapitalOverlayHost();
    if (!host || !doc) return;
    const label = "bbttcc-capital-overlay:" + String(doc.id || "");
    const existing = host.children.find(c => c && c.label === label);
    if (existing) {
      host.removeChild(existing);
      try { existing.destroy({ children:true }); } catch (_e) {}
    }
    const built = bbttccBuildCapitalOverlayForDrawing(doc);
    if (built) host.addChild(built);
  } catch (e) {
    console.warn("[bbttcc-territory] capital overlay refresh failed", e);
  }
}

// A scene is the territory HEX MAP unless it's a SIEGE BATTLE diorama — a forced-perspective
// tableau scene or a scene bound to a siege (flags set by bbttcc-raid), or explicitly opted out.
// Hex chrome (capital overlays, the hex drawings themselves) must NOT render on battle scenes,
// which can carry stray hex drawings (e.g. duplicated from the map) that otherwise bleed through.
function bbttccIsHexMapScene(scene) {
  const s = scene ?? canvas?.scene;
  if (!s) return true;                                    // permissive when unknown
  if (s.getFlag?.(MOD, "isNotHexMapScene") === true) return false;
  const raid = s.flags?.["bbttcc-raid"];
  if (raid?.tableau?.enabled === true) return false;      // forced-perspective battle diorama
  if (raid?.siegeHexUuid) return false;                   // a scene bound to an active siege
  return true;
}
function bbttccIsHexDrawingDoc(doc) {
  const f = doc?.flags?.[MOD]; if (!f) return false;
  return (f.isHex === true) || (f.kind === "territory-hex")
    || (doc.shape?.type === "p" && Array.isArray(doc.shape?.points) && doc.shape.points.length === 12);
}
// Client-side, non-destructive: hide any stray territory-hex drawings on a battle scene (no doc
// mutation — just suppress the placeable's render, per client so players see it clean too).
function bbttccSuppressHexesOnBattleScene() {
  try {
    if (bbttccIsHexMapScene(canvas?.scene)) return;
    for (const p of (canvas?.drawings?.placeables || [])) {
      if (bbttccIsHexDrawingDoc(p?.document)) { try { p.renderable = false; p.visible = false; } catch (_e) {} }
    }
  } catch (_e) {}
}

async function bbttccRefreshAllCapitalOverlays() {
  try {
    const host = bbttccGetCapitalOverlayHost();
    if (!host) return;
    bbttccClearCapitalOverlays();
    if (!bbttccIsHexMapScene(canvas?.scene)) return;      // no hex chrome on battle/diorama scenes
    const draws = canvas && canvas.drawings && canvas.drawings.placeables ? canvas.drawings.placeables : [];
    for (const p of draws) {
      const doc = p && p.document ? p.document : null;
      const f = doc && doc.flags ? doc.flags[MOD] : null;
      if (!doc || !f) continue;
      // Hex sentinel: must be a hex drawing (isHex flag, kind label, or a
      // 6-vertex polygon shape).
      const isHex = (f.isHex === true)
        || (f.kind === "territory-hex")
        || (doc.shape?.type === "p" && Array.isArray(doc.shape?.points) && doc.shape.points.length === 12);
      if (!isHex) continue;
      // Build for capitals OR owned hexes — the capital overlay function
      // also paints the type/integration/modifier/owned-step-0 markers,
      // and those need to survive a canvas refresh on every owned hex,
      // not only capitals (which was the legacy filter that caused the
      // markers to vanish on refresh for non-capital hexes).
      const owned = !!(f.factionId || f.ownerId);
      const hasQuestLinks = !!(f.quests && typeof f.quests === "object" && Object.keys(f.quests).length);
      if (!f.capital && !owned && !hasQuestLinks) continue;
      const built = bbttccBuildCapitalOverlayForDrawing(doc);
      if (built) host.addChild(built);
    }
  } catch (e) {
    console.warn("[bbttcc-territory] capital overlay rebuild failed", e);
  }
}

/* ---------------- Grid helpers ---------------- */
function detectStartAngle(){ const isHex=!!canvas?.grid?.isHexagonal; const flatTop=isHex ? !!canvas.grid.columns : true; return flatTop?0:-Math.PI/6; }
function hexVerts(cx,cy,r,start){ const pts=[]; for(let i=0;i<6;i++){ const a=start+i*Math.PI/3; pts.push(cx+r*Math.cos(a), cy+r*Math.sin(a)); } return pts; }
function toRelativePoints(abs){ const xs=[],ys=[]; for(let i=0;i<abs.length;i+=2){ xs.push(abs[i]); ys.push(abs[i+1]); } const minX=Math.min(...xs),minY=Math.min(...ys); const rel=[]; for(let i=0;i<abs.length;i+=2) rel.push(abs[i]-minX, abs[i+1]-minY); return {rel, origin:{x:minX,y:minY}}; }
function snapCenter(x,y){ try{ if (canvas?.grid?.getCenterPoint) return canvas.grid.getCenterPoint({x,y}); if (canvas?.grid?.getSnappedPoint) return canvas.grid.getSnappedPoint({x,y},1); }catch{} const g=canvas.scene?.grid?.size??100; return {x:Math.round(x/g)*g, y:Math.round(y/g)*g}; }
function worldFromEvent(ev){ try{ if (ev?.data?.getLocalPosition) return ev.data.getLocalPosition(canvas.app.stage); if (ev?.global) return canvas.stage.worldTransform.applyInverse(ev.global);}catch{} const cx=(canvas.scene?.width??0)/2, cy=(canvas.scene?.height??0)/2; return {x:cx,y:cy}; }

/* ---------------- Owners / Sephirot ---------------- */
function buildOwnerList(){
  const list=[];
  for (const a of game.actors?.contents ?? []) {
    const _k = game.bbttcc?.api?.actorKind?.(a);
    const isFaction = _k ? _k === "faction"
      : (a.getFlag?.("bbttcc-factions","isFaction")===true ||
         String(a.system?.details?.type?.value ?? "").toLowerCase()==="faction");
    if (isFaction) list.push({id:a.id, name:a.name});
  }
  return list.sort((A,B)=>A.name.localeCompare(B.name));
}
const keyFromName = (n)=> String(n||"").toLowerCase().trim().replace(/[^\p{L}]+/gu,"");
async function buildSephirotList(){
  const foundByName = new Map();
  for (const it of game.items?.contents ?? []) {
    const name = it?.name ?? "";
    if (/^(Keter|Chokhmah|Binah|Chesed|Gevurah|Tiferet|Netzach|Hod|Yesod|Malkuth)$/i.test(name))
      foundByName.set(name, { uuid: it.uuid, name });
  }
  for (const nm of ["Keter","Chokhmah","Binah","Chesed","Gevurah","Tiferet","Netzach","Hod","Yesod","Malkuth"])
    if (!foundByName.has(nm)) foundByName.set(nm, { uuid: keyFromName(nm), name: nm });
  return Array.from(foundByName.values()).sort((A,B)=>A.name.localeCompare(B.name));
}
async function nameFromUuid(uuid){
  if (!uuid) return "";
  if (!uuid.includes(".")) return uuid; // stored canonical key
  try { const doc = await fromUuid(uuid); return doc?.name || ""; } catch { return ""; }
}


/* ---------------- Leylines: Gates (Remote Adjacency) ----------------
 * Sprint B.2 Step 2 — Resolver only
 *
 * Gates are authored per-hex under:
 *   flags.bbttcc-territory.leylines.gate
 *
 * This step does NOT change travel/pathing automatically yet.
 * It provides a stable resolver API so Travel/Trade/Logistics can opt-in safely.
 *
 * Gate usability rules:
 * - enabled === true
 * - linkHexUuid is a non-empty UUID
 * - faction tier meets minFactionTier. Tiers are T1..T4 (numeric, matching
 *   flags.bbttcc-factions.tier). Legacy A/B/C values are accepted and mapped
 *   to T1/T2/T3 transparently.
 * - (optional future) purity/memoryCharge constraints
 */

function _bbttccNormalizeTierKey(raw){
  const k = String(raw == null ? "T1" : raw).trim().toUpperCase();
  if (k === "A") return "T1";
  if (k === "B") return "T2";
  if (k === "C") return "T3";
  const m = /^T?([1-4])$/.exec(k);
  if (m) return `T${m[1]}`;
  return "T1";
}

function _bbttccTierRank(t){
  const k = _bbttccNormalizeTierKey(t);
  return Number(k.slice(1)) || 1;
}

function _bbttccGetFactionTierKey(factionId){
  try {
    if (!factionId) return "T1";
    const A = game.actors?.get?.(factionId) || null;
    if (!A) return "T1";

    // Canonical: flags.bbttcc-factions.tier is a numeric 1..4
    const numTier = Number(A.getFlag?.("bbttcc-factions","tier"));
    if (Number.isFinite(numTier) && numTier >= 1 && numTier <= 4) return `T${numTier}`;

    // Legacy fallback variants
    const v2 = A.getFlag?.("bbttcc-factions","tierKey");
    const v3 = A.getFlag?.("bbttcc-factions","tierBand");
    const v4 = A.getFlag?.("bbttcc-factions","factionTier");
    const raw = v2 ?? v3 ?? v4;

    if (raw && typeof raw === "object") {
      const kk = raw.key ?? raw.band ?? raw.tier ?? raw.value;
      if (kk != null) return _bbttccNormalizeTierKey(kk);
      return "T1";
    }

    return _bbttccNormalizeTierKey(raw);
  } catch (e) {
    return "T1";
  }
}

function _bbttccReadLeylines(tf){
  const ley = tf && tf.leylines && (typeof tf.leylines === "object") ? tf.leylines : null;
  if (ley) return ley;
  if (tf && typeof tf === "object" && tf.primaryResonance !== undefined && tf.flowState !== undefined) return tf;
  return null;
}

function _bbttccNormalizeGate(gate){
  const g = (gate && typeof gate === "object") ? gate : {};
  const merged = Object.assign(
    { enabled:false, linkHexUuid:"", strength:0.5, minFactionTier:"T2", locked:false },
    g
  );
  merged.minFactionTier = _bbttccNormalizeTierKey(merged.minFactionTier);
  return merged;
}

function _bbttccGateUsable(args){
  try {
    args = args || {};
    const hexTf = args.hexTf;
    const factionId = args.factionId;

    if (!hexTf) return { ok:false, reason:"no-hex" };
    const ley = _bbttccReadLeylines(hexTf);
    if (!ley) return { ok:false, reason:"no-leylines" };

    const gate = _bbttccNormalizeGate(ley.gate);
    if (!gate.enabled) return { ok:false, reason:"disabled" };

    const targetUuid = String(gate.linkHexUuid || "").trim();
    if (!targetUuid) return { ok:false, reason:"no-target" };

    const minTier = _bbttccNormalizeTierKey(gate.minFactionTier);
    const facTier = _bbttccGetFactionTierKey(factionId);
    if (_bbttccTierRank(facTier) < _bbttccTierRank(minTier)) {
      return { ok:false, reason:"tier", facTier: facTier, minTier: minTier };
    }

    const strength = Number(gate.strength ?? 0.5);
    const str = Number.isFinite(strength) ? Math.max(0, Math.min(1, strength)) : 0.5;

    return { ok:true, targetUuid: targetUuid, strength: str, minTier: minTier, facTier: facTier, gate: gate };
  } catch (e) {
    return { ok:false, reason:"error" };
  }
}

/**
 * Resolve remote adjacency for a given hex UUID and faction.
 * Returns an object so future systems can use strength safely.
 *
 * Result:
 * {
 *   ok, hexUuid, factionId,
 *   links: [{ toUuid, strength, kind:"gate", minTier, facTier }],
 *   reason? // if ok=false
 * }
 */
async function bbttccResolveRemoteAdjacency(args){
  try {
    args = args || {};
    const hexUuid = String(args.hexUuid || "").trim();
    const factionId = String(args.factionId || "").trim();

    const out = { ok:false, hexUuid: hexUuid, factionId: factionId, links: [] };
    if (!hexUuid) { out.reason = "no-hexUuid"; return out; }

    const dr = await fromUuid(hexUuid);
    if (!dr) { out.reason = "hex-not-found"; return out; }

    const tf = dr.flags?.[MOD] || {};
    const gateCheck = _bbttccGateUsable({ hexTf: tf, factionId: factionId });

    if (!gateCheck.ok) {
      out.reason = gateCheck.reason || "no-gate";
      out.facTier = gateCheck.facTier;
      out.minTier = gateCheck.minTier;
      return out;
    }

    let targetDoc = null;
    try { targetDoc = await fromUuid(gateCheck.targetUuid); } catch (e) {}
    if (!targetDoc) {
      out.reason = "target-not-found";
      out.targetUuid = gateCheck.targetUuid;
      return out;
    }

    out.ok = true;
    out.links.push({
      toUuid: gateCheck.targetUuid,
      strength: gateCheck.strength,
      kind: "gate",
      minTier: gateCheck.minTier,
      facTier: gateCheck.facTier
    });

    return out;
  } catch (e) {
    return { ok:false, hexUuid: String(args?.hexUuid||""), factionId: String(args?.factionId||""), links: [], reason:"error" };
  }
}

/* ---------------- Old (working) math restored ---------------- */
/** Sephirot flat resource adds (before multipliers) */
function sephirotResourceBonus(name){
  const k = String(name||"").toLowerCase();
  switch (k) {
    case "keter":   return { food:1, materials:1, trade:1, military:1, knowledge:1 };
    case "chokhmah":return { food:0, materials:0, trade:0, military:0, knowledge:3 };
    case "binah":   return { food:0, materials:1, trade:0, military:0, knowledge:2 };
    case "chesed":  return { food:1, materials:0, trade:2, military:0, knowledge:0 };
    case "gevurah": return { food:0, materials:0, trade:0, military:3, knowledge:0 };
    case "tiferet": return { food:0, materials:0, trade:1, military:1, knowledge:1 };
    case "netzach": return { food:0, materials:0, trade:1, military:2, knowledge:0 };
    case "hod":     return { food:0, materials:2, trade:1, military:0, knowledge:0 };
    case "yesod":   return { food:0, materials:0, trade:1, military:0, knowledge:1 };
    case "malkuth": return { food:0, materials:3, trade:0, military:0, knowledge:0 };
    default:        return { food:0, materials:0, trade:0, military:0, knowledge:0 };
  }
}
/** Modifiers → global/trade multipliers (unchanged from working build) */
function getModifierEffects(modifiers=[]){
  const set = new Set((modifiers||[]).map(m=>String(m).trim().toLowerCase()));
  let mAll=1.0, mTrade=1.0;
  const bump=(pct)=>{ mAll *= (1+pct); };
  const bumpTrade=(pct)=>{ mTrade *= (1+pct); };

  if (set.has("well-maintained"))        bump(+0.25);
  if (set.has("fortified"))              { /* 0% prod */ }
  if (set.has("strategic position"))     bump(+0.10);
  if (set.has("loyal population"))       bump(+0.15);
  if (set.has("trade hub"))              bumpTrade(+0.50);
  if (set.has("contaminated"))           bump(-0.50);
  if (set.has("damaged infrastructure")) bump(-0.25);
  if (set.has("hostile population"))     bump(-0.25);
  if (set.has("difficult terrain"))      bump(-0.10);
  if (set.has("radiation zone"))         bump(-0.75);
  if (set.has("supply line vulnerable")) bump(-0.15); // keep the original value
  return { mAll, mTrade };
}
/** Type→base pips */
const TYPE_BASE = {
  settlement:{food:2, materials:1, trade:3, military:0, knowledge:0},
  fortress:  {food:0, materials:3, trade:1, military:4, knowledge:0},
  mine:      {food:0, materials:5, trade:2, military:0, knowledge:0},
  farm:      {food:5, materials:1, trade:2, military:0, knowledge:0},
  port:      {food:2, materials:2, trade:4, military:0, knowledge:0},
  factory:   {food:0, materials:4, trade:3, military:0, knowledge:0},
  research:  {food:0, materials:1, trade:1, military:0, knowledge:4},
  temple:    {food:1, materials:1, trade:1, military:0, knowledge:2},
  wasteland: {food:0, materials:1, trade:0, military:0, knowledge:0},
  ruins:     {food:0, materials:2, trade:0, military:0, knowledge:1}
};
/** Size multipliers */
const SIZE_MULT = {
  none: 0,

  outpost: 0.5,
  village: 0.75,
  town: 1,
  city: 1.5,
  metropolis: 2,
  megalopolis: 3
};

/** Compute EFFECTIVE resources: base → +sephirot → ×modifiers */
function computeEffectiveResources(base, sephirotName, modifiers){
  const add = sephirotResourceBonus(sephirotName);
  const { mAll, mTrade } = getModifierEffects(modifiers);

  const afterAdd = {
    food:      Number(base.food||0)      + add.food,
    materials: Number(base.materials||0) + add.materials,
    trade:     Number(base.trade||0)     + add.trade,
    military:  Number(base.military||0)  + add.military,
    knowledge: Number(base.knowledge||0) + add.knowledge
  };

  const mul = (v,m)=> Math.max(0, Math.round(v*m));
  const effective = {
    food:      mul(afterAdd.food,      mAll),
    materials: mul(afterAdd.materials, mAll),
    trade:     mul(afterAdd.trade,     mAll * mTrade),
    military:  mul(afterAdd.military,  mAll),
    knowledge: mul(afterAdd.knowledge, mAll)
  };

  return { effective, added:add, multipliers:{mAll,mTrade} };
}

/* Optional: OP cache from resources (unchanged; harmless for UI) */
const RES_TO_OP = {
  economy:{food:0.5, materials:0.8, trade:1.0, military:0.1, knowledge:0.25},
  violence:{food:0.1, materials:0.2, trade:0.2, military:0.8, knowledge:0.0},
  nonLethal:{food:0.2, materials:0.1, trade:0.2, military:0.5, knowledge:0.3},
  intrigue:{food:0.0, materials:0.1, trade:0.5, military:0.1, knowledge:1.0},
  diplomacy:{food:0.2, materials:0.0, trade:0.6, military:0.0, knowledge:0.4},
  softPower:{food:0.2, materials:0.0, trade:0.5, military:0.0, knowledge:0.3}
};
/* ---------------- Leyline Flow Modifiers ---------------- */
const LEY_FLOW_MULT = {
  normal:     1.0,
  turbulence: 0.9,
  surge:      1.3,
  stagnation: 0.6,
  inversion:  1.0, // multiplier is applied after swaps
  fracture:   0.8,
  seal:       0.0
};

function resourcesToOP(res, flowState = "normal"){
  const out = { economy:0, violence:0, nonLethal:0, intrigue:0, diplomacy:0, softPower:0 };

  for (const [op,weights] of Object.entries(RES_TO_OP)) {
    let v = 0;
    for (const [rk,w] of Object.entries(weights)) v += (res[rk]||0)*w;
    out[op] = Math.max(0, Math.round(v));
  }

  // Inversion swaps (narrative: the grid lies)
  if (flowState === "inversion") {
    [out.violence, out.softPower] = [out.softPower, out.violence];
    [out.diplomacy, out.intrigue] = [out.intrigue, out.diplomacy];
  }

  // Flow multiplier
  const mult = LEY_FLOW_MULT[flowState] ?? 1.0;
  for (const k of Object.keys(out)) {
    out[k] = Math.max(0, Math.round(out[k] * mult));
  }

  return out;
}


/* ---------------- Hex Editor ---------------- */
const OPEN = new Map();


/* ---------------- GM Manual Edit Panel (Phase 2) ----------------
 * Hex Config is opened via a V1 Dialog. Render hooks are timing-fragile.
 * We inject the GM panel directly from openHexEditorByUuid after dlg.render(true),
 * using a short retry loop to wait for Dialog content attachment.
 *
 * Gated by:
 *  - GM user
 *  - bbttcc-core world setting "gmEditMode" enabled
 *
 * Uses Core GM API: game.bbttcc.api.gm.setHex(...)
 */
function bbttccGMEditEnabled(){
  try { return !!(game && game.user && game.user.isGM) && !!game.settings.get("bbttcc-core","gmEditMode"); }
  catch (e) { return false; }
}
function bbttccHtmlEscape(s){
  return String(s==null?"":s)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}
function bbttccNumOrBlank(v){
  if (v === null || typeof v === "undefined") return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
}

function bbttccInjectGMPanelIntoHexConfigDialog(dlg, dr){
  try {
    if (!bbttccGMEditEnabled()) return;
    if (!dlg || !dr) return;

    const MAX_TRIES = 40;     // ~1s at 25ms
    const DELAY_MS  = 25;

    let tries = 0;

    function attempt(){
      tries += 1;
      try {
        const host = (dlg.element && dlg.element[0]) ? dlg.element[0] : null;
        const form = host ? host.querySelector("form.bbttcc-hex-config") : null;

        if (!form) {
          if (tries < MAX_TRIES) return setTimeout(attempt, DELAY_MS);
          console.warn("[bbttcc-territory] GM panel: form not found after retries", { tries, uuid: dr.uuid });
          return;
        }

        if (form.querySelector("[data-bbttcc='gm-edit-panel']")) return; // already there

        const tf = (dr.flags && dr.flags[MOD]) ? dr.flags[MOD] : {};
        const travel = tf.travel || {};
        const dev = tf.development || {};
        const integ = tf.integration || {};
        const alarm = tf.alarm || {};
        const camp = tf.campaign || {};

        const wrap = document.createElement("fieldset");
        wrap.setAttribute("data-bbttcc","gm-edit-panel");
        wrap.style.marginTop = "0.75rem";
        wrap.style.border = "1px solid rgba(100,116,139,0.55)";
        wrap.style.borderRadius = "0.75rem";
        wrap.style.padding = "0.6rem 0.7rem 0.65rem";
        wrap.style.background = "linear-gradient(160deg, rgba(15,23,42,0.98), rgba(15,23,42,1))";

        wrap.innerHTML = `
          <legend style="padding:0 0.25rem; opacity:0.9; font-size:11px; text-transform:uppercase; letter-spacing:0.12em; color:#cbd5f5;">
            GM: Manual Edit
          </legend>

          <div class="form-group">
            <label>Hex UUID</label>
            <div style="display:flex; gap:0.5rem; align-items:center;">
              <input type="text" readonly value="${bbttccHtmlEscape(dr.uuid)}" style="flex:1;">
              <button type="button" class="bbttcc-btn" data-gm-action="copy-uuid">Copy</button>
            </div>
            <p class="hint">GM-only. Requires bbttcc-core → GM Edit Mode.</p>
          </div>

          <div class="form-group">
            <label>Travel Units Override</label>
            <input type="number" min="0" max="99" step="1" name="gm.travel.unitsOverride" value="${bbttccHtmlEscape(bbttccNumOrBlank(travel.unitsOverride))}">
            <p class="hint">Blank = no change. Clear removes override.</p>
          </div>

          <div class="form-group">
            <label>Development Stage</label>
            <input type="number" min="0" max="6" step="1" name="gm.development.stage" value="${bbttccHtmlEscape(bbttccNumOrBlank((dev.stage != null) ? dev.stage : integ.progress))}">
            <p class="hint">Writes development.stage + integration.progress (0–6).</p>
          </div>

          <div class="form-group row" style="align-items:center;">
            <label style="margin:0;">Development Locked</label>
            <input type="checkbox" name="gm.development.locked" ${(dev.locked === true || integ.locked === true) ? "checked" : ""}>
          </div>

          <div class="form-group">
            <label>Alarm</label>
            <div style="display:flex; gap:0.5rem; align-items:center;">
              <input type="number" min="0" max="99" step="1" name="gm.alarm.value" value="${bbttccHtmlEscape(bbttccNumOrBlank(alarm.value))}" style="flex:1;">
              <label class="checkbox" style="display:flex; gap:0.35rem; align-items:center; margin:0;">
                <input type="checkbox" name="gm.alarm.locked" ${(alarm.locked === true) ? "checked" : ""}>
                <span>Lock</span>
              </label>
            </div>
            <p class="hint">Blank = no change.</p>
          </div>

          <div class="form-group">
            <label>On-Enter Beat ID</label>
            <input type="text" name="gm.campaign.onEnterBeatId" value="${bbttccHtmlEscape(camp.onEnterBeatId || "")}" placeholder="e.g. enc_hidden_ruins">
          </div>

          <div class="form-group">
            <label>GM Note (audit)</label>
            <input type="text" name="gm.note" value="" placeholder="Why are we changing reality?">
          </div>

          <div class="form-group" style="display:flex; gap:0.5rem; justify-content:flex-end;">
            <button type="button" class="bbttcc-btn" data-gm-action="clear">Clear Overrides</button>
            <button type="button" class="bbttcc-btn" data-gm-action="apply">Apply</button>
          </div>
        `;

        form.appendChild(wrap);

        function q(sel){ return wrap.querySelector(sel); }
        function val(name){ const el = q('[name="' + name + '"]'); return el ? (el.value || "") : ""; }
        function checked(name){ const el = q('[name="' + name + '"]'); return !!(el && el.checked); }

        wrap.addEventListener("click", async function(ev){
          const btn = (ev.target && ev.target.closest) ? ev.target.closest("button[data-gm-action]") : null;
          if (!btn) return;
          ev.preventDefault(); ev.stopPropagation();

          const action = btn.getAttribute("data-gm-action");

          if (action === "copy-uuid") {
            try {
              navigator.clipboard.writeText(dr.uuid);
              ui && ui.notifications && ui.notifications.info && ui.notifications.info("Copied Hex UUID to clipboard.");
            } catch (e) {
              ui && ui.notifications && ui.notifications.warn && ui.notifications.warn("Could not copy UUID (see console).");
              console.warn("[bbttcc-territory] copy uuid failed", e);
            }
            return;
          }

          // Prefer territory-side GM hex setter (0-safe); fall back to core GM API.
          const terrApi = game.bbttcc && game.bbttcc.api && game.bbttcc.api.territory;
          const setHexFn =
            (terrApi && typeof terrApi.gmSetHex === "function") ? terrApi.gmSetHex :
            (game.bbttcc && game.bbttcc.api && game.bbttcc.api.gm && typeof game.bbttcc.api.gm.setHex === "function") ? game.bbttcc.api.gm.setHex :
            null;

          if (!setHexFn) {
            ui && ui.notifications && ui.notifications.error && ui.notifications.error("GM Hex API not available (bbttcc-territory or bbttcc-core missing).");
            return;
          }

          const note = String(val("gm.note") || "").trim();

          if (action === "clear") {
            try {
  await setHexFn({
    hexUuid: dr.uuid,
    patch: {
      // 🔑 Hand authority back to the system
      manualOverride: false,

      // Clear all manual override values
      travel: { unitsOverride: null },
      development: { stage: null, locked: null },
      integration: { progress: null, locked: null },
      alarm: { value: null, locked: null },
      campaign: { onEnterBeatId: null }
    },
    note: note || "Clear hex overrides"
  });


  // Verify + log (high-signal when other UIs don’t update)
  try {
    const fresh = await fromUuid(dr.uuid);
    const tf2 = fresh?.flags?.[MOD] || {};
    console.log("[bbttcc-territory] GM clear verify", {
      uuid: dr.uuid,
      travel: tf2.travel,
      development: tf2.development,
      integration: tf2.integration,
      alarm: tf2.alarm,
      campaign: tf2.campaign
    });
  } catch (_) {}

  try { Hooks.callAll && Hooks.callAll("bbttcc:territory:hexUpdated", { hexUuid: dr.uuid }); } catch(e) {}

  // IMPORTANT: OPEN map can wedge reopening if the close callback doesn’t fire in time.
  try { OPEN.delete(dr.id); } catch(e) {}

  try { await dlg.close(); } catch(e) {}
  try { setTimeout(function(){ openHexEditorByUuid(dr.uuid); }, 75); } catch(e) {}
} catch (e) {
  console.warn("[bbttcc-territory] GM clear failed", e);
  ui?.notifications?.error?.("GM Clear failed — see console.");
}

            return;
          }

          if (action === "apply") {
            const patch = {};

            patch.manualOverride = true;

            const uo = String(val("gm.travel.unitsOverride") || "").trim();
            if (uo !== "") patch.travel = Object.assign(patch.travel || {}, { unitsOverride: Number(uo) });

            const st = String(val("gm.development.stage") || "").trim();
            patch.development = patch.development || {};
            if (st !== "") patch.development.stage = Number(st);
            patch.development.locked = checked("gm.development.locked");

            const av = String(val("gm.alarm.value") || "").trim();
            patch.alarm = patch.alarm || {};
            if (av !== "") patch.alarm.value = Number(av);
            patch.alarm.locked = checked("gm.alarm.locked");

            const beat = String(val("gm.campaign.onEnterBeatId") || "").trim();
            if (beat !== "") patch.campaign = Object.assign(patch.campaign || {}, { onEnterBeatId: beat });

            try {
  await setHexFn({ hexUuid: dr.uuid, patch: patch, note: note || "GM edit hex" });

  try {
    const fresh = await fromUuid(dr.uuid);
    const tf2 = fresh?.flags?.[MOD] || {};
    console.log("[bbttcc-territory] GM apply verify", {
      uuid: dr.uuid,
      travel: tf2.travel,
      development: tf2.development,
      integration: tf2.integration,
      alarm: tf2.alarm,
      campaign: tf2.campaign
    });
  } catch (_) {}

  try { Hooks.callAll && Hooks.callAll("bbttcc:territory:hexUpdated", { hexUuid: dr.uuid }); } catch(e) {}

  try { OPEN.delete(dr.id); } catch(e) {}
  try { await dlg.close(); } catch(e) {}
  try { setTimeout(function(){ openHexEditorByUuid(dr.uuid); }, 75); } catch(e) {}
} catch (e) {
  console.warn("[bbttcc-territory] GM apply failed", e);
  ui?.notifications?.error?.("GM Apply failed — see console.");
}

            return;
          }
        });

        console.log("[bbttcc-territory] GM panel injected into Hex Config", { uuid: dr.uuid });
      } catch (e2) {
        console.warn("[bbttcc-territory] GM panel inject failed", e2);
      }
    }

    setTimeout(attempt, 0);
  } catch (e) {
    console.warn("[bbttcc-territory] GM panel inject outer failed", e);
  }
}

async function openHexEditorByUuid(uuid){
  if (!uuid) return ui.notifications?.warn?.("Hex not found.");
  const dr = await fromUuid(uuid);
  if (!dr)  return ui.notifications?.warn?.("Hex not found.");

  const existing = OPEN.get(dr.id);
  if (existing) { try { existing.bringToTop(); } catch{} return; }

  const f = foundry.utils.getProperty(dr, `flags.${MOD}`) ?? {};

  // Integration track (0–6) with derived stage
  const integ = f.integration ?? {};
  const rawProgress = Number.isFinite(integ.progress) ? integ.progress : 0;
  const integrationProgress = Math.max(0, Math.min(6, Math.round(rawProgress)));

  let integrationStageKey = "wild";
  if (integrationProgress >= 6) integrationStageKey = "integrated";
  else if (integrationProgress === 5) integrationStageKey = "settled";
  else if (integrationProgress >= 3) integrationStageKey = "developing";
  else if (integrationProgress >= 1) integrationStageKey = "outpost";

  const integrationStageLabels = {
    wild: "Untouched Wilderness",
    outpost: "Foothold / Outpost",
    developing: "Developing Territory",
    settled: "Settled Province",
    integrated: "Integrated Heartland"
  };
  const integrationStageLabel = integrationStageLabels[integrationStageKey] || "—";

  const context = {
    name: f.name ?? dr.text ?? "",
    ownerId: f.factionId ?? "",
    ownerList: buildOwnerList(),
    status: f.status ?? "unclaimed",
    type: f.type ?? "wilderness",
    size: f.size ?? "none",
    population: f.population ?? "uninhabited",
    capital: !!f.capital,
    resources: {
      food:      Number(f.resources?.food ?? 0),
      materials: Number(f.resources?.materials ?? 0),
      trade:     Number(f.resources?.trade ?? 0),
      military:  Number(f.resources?.military ?? 0),
      knowledge: Number(f.resources?.knowledge ?? 0)
    },
    // Integration display
    integrationProgress,
    integrationMax: 6,
    integrationStageKey,
    integrationStageLabel,

    sephirotUuid: f.sephirotUuid || "",
    sephirotList: await buildSephirotList(),
    modifiers: Array.isArray(f.modifiers) ? f.modifiers : [],
    notes: f.notes ?? "",
    createdAt: f.createdAt ? new Date(f.createdAt).toLocaleString() : "",

    leylines: (() => {
      const raw = (f.leylines && typeof f.leylines === "object") ? f.leylines : {};
      const out = Object.assign({
        primaryResonance: "none",
        flowState: "normal",
        purity: 0,
        memoryCharge: 0,
        gate: { enabled:false, linkHexUuid:"", strength:0.5, minFactionTier:"T2", locked:false }
      }, raw);

      out.gate = Object.assign(
        { enabled:false, linkHexUuid:"", strength:0.5, minFactionTier:"T2", locked:false },
        (out.gate && typeof out.gate === "object") ? out.gate : {}
      );

      return foundry.utils.deepClone(out);
    })(),

    // Build a Scene→Hex picker for the leyline gate target so the GM picks by
    // name rather than typing a UUID. Sorts the current scene first, then the
    // rest alphabetically. Each hex's stored display name (flags…name) wins
    // over the Drawing's text. The current hex itself is excluded.
    leylineHexOptions: (() => {
      try {
        const currentSceneId = dr?.parent?.id || null;
        const currentDrawingId = dr?.id || null;
        const groups = [];
        for (const sc of (game.scenes ?? [])) {
          const hexes = [];
          for (const drDoc of (sc.drawings ?? [])) {
            const flg = drDoc.flags?.["bbttcc-territory"];
            if (!flg?.isHex) continue;
            if (sc.id === currentSceneId && drDoc.id === currentDrawingId) continue;
            const nm = String(flg.name || drDoc.text || "Hex").trim() || "Hex";
            hexes.push({ uuid: `Scene.${sc.id}.Drawing.${drDoc.id}`, name: nm });
          }
          if (!hexes.length) continue;
          hexes.sort((a, b) => a.name.localeCompare(b.name));
          groups.push({
            sceneId: sc.id,
            sceneName: sc.name || sc.id,
            isCurrent: sc.id === currentSceneId,
            hexes
          });
        }
        groups.sort((a, b) => {
          if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
          return a.sceneName.localeCompare(b.sceneName);
        });
        return groups;
      } catch (e) {
        return [];
      }
    })(),
  };

  // Orphan-preserve: if the current gate links to a UUID we did NOT enumerate
  // above (deleted scene, cross-world reference, etc.), render a sentinel
  // option so the value isn't silently dropped by the select on save.
  context.leylineGateOrphanUuid = (() => {
    try {
      const cur = String(context.leylines?.gate?.linkHexUuid || "").trim();
      if (!cur) return "";
      for (const g of context.leylineHexOptions) {
        for (const h of g.hexes) if (h.uuid === cur) return "";
      }
      return cur;
    } catch (e) { return ""; }
  })();

  let html = "";
  try {
    html = await renderTpl(TPL_HEX_CONFIG, context);
  } catch (err) {
    console.error(`[${MOD}] hex-config template render failed`, { template: TPL_HEX_CONFIG, uuid, err });
    const esc = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    html = `
      <div class="bbttcc-hex-config-fallback" style="display:grid; gap:.5rem;">
        <p><strong>Bad Eden Hex Config fallback</strong></p>
        <p style="opacity:.8;">Primary template failed to render. You can still inspect the hex and verify the click opener is working.</p>
        <div class="form-group"><label>Name</label><input type="text" name="name" value="${esc(context.name || "Hex")}"></div>
        <div class="form-group"><label>Status</label><input type="text" name="status" value="${esc(context.status || "unclaimed")}"></div>
        <div class="form-group"><label>Type</label><input type="text" name="type" value="${esc(context.type || "wilderness")}"></div>
        <div class="form-group"><label>Notes</label><textarea name="notes">${esc(context.notes || "")}</textarea></div>
      </div>`;
  }

  // Manual override toggle (injected, non-invasive)
  const overrideBlock = `
    <fieldset style="margin-top:.5rem; border:1px solid #666; border-radius:6px; padding:.5rem;">
      <legend style="padding:0 .25rem; opacity:.9;">Save Behavior</legend>
      <label class="checkbox">
        <input type="checkbox" name="manualOverride" ${((f.manualOverride === true) && Object.values((f.resources||{})).some(n=>Number(n||0)>0)) ? "checked" : ""}>
        <span>Manual resource override</span>
      </label>
      <p class="hint">Unchecked → save <em>auto-calculated</em> resources from Type × Size × Alignment + Modifiers (recommended).</p>
    </fieldset>
  `;

  const dlg = new Dialog(
  {
    title: "Bad Eden: Hex Configuration",
    content: `<form class="bbttcc-hex-config">${html}${overrideBlock}</form>`,
    buttons: {
      save: {
        icon:`<i class="far fa-save"></i>`,
        label:"Save",
        callback: async (jq) => {
          try {
            const form = jq[0].querySelector("form");
            const fd = new FormData(form);
            const data = {};

            // NOTE: we DO NOT bucket leylines.* generically anymore,
            // because we need to support nested leylines.gate.* fields.
            for (const [k,v] of fd.entries()) {
              if (k==="modifiers") (data.modifiers ??= []).push(v);
              else if (k.startsWith("resources.")) {
                const key = k.split(".")[1];
                (data.resources ??= {})[key] = Number(v||0);
              } else {
                data[k]=v;
              }
            }
            if (!fd.has("capital")) data.capital = false;
            // Resource manual override checkbox (affects resource persistence only)
            const manualResourceOverride = (fd.get("manualOverride") === "on");

            // Preserve any existing GM authority override (set by GM panel)
            const existingGMOverride = !!f.manualOverride;

            // Resolve Sephirot name + canonical key
            const selUuid = data.sephirotUuid || "";
            const selName = await nameFromUuid(selUuid);
            const selKey  = keyFromName(selName);

            // BASE (what user typed; may be all 0)
            const base = {
              food:      Number(data.resources?.food || 0),
              materials: Number(data.resources?.materials || 0),
              trade:     Number(data.resources?.trade || 0),
              military:  Number(data.resources?.military || 0),
              knowledge: Number(data.resources?.knowledge || 0)
            };

            // Build the auto base from Type×Size ladder, then apply +sephirot & ×modifiers
            const typeKey = String(data.type||"settlement").toLowerCase();
            const sizeKey = String(data.size||"none").toLowerCase();
            const typedBase = TYPE_BASE[typeKey] || TYPE_BASE.settlement;
            const sizeMult = SIZE_MULT[sizeKey] ?? 0;
            const sizedBase = {
              food:      Math.round((typedBase.food||0)     * sizeMult),
              materials: Math.round((typedBase.materials||0)* sizeMult),
              trade:     Math.round((typedBase.trade||0)    * sizeMult),
              military:  Math.round((typedBase.military||0) * sizeMult),
              knowledge: Math.round((typedBase.knowledge||0)* sizeMult)
            };

            // Compute effective from whichever vector will be used for UI
            const mods = Array.isArray(data.modifiers) ? data.modifiers : [];
            const vectorForDisplay =
              (manualResourceOverride && Object.values(base).some(n=>n>0))
                ? base
                : sizedBase;

            const calc = computeEffectiveResources(vectorForDisplay, selName, mods);

            // Visible resources on hex:
            //  - Manual override: save the typed base unchanged
            //  - Auto mode:       save the EFFECTIVE totals (old working behavior)
            const resourcesToPersist =
              (manualResourceOverride && Object.values(base).some(n=>n>0))
                ? base
                : calc.effective;

            // ------------------------------------------------------------
            // Leylines (Sprint B.2 Step 1): parse nested fields + persist
            // ------------------------------------------------------------

            const clamp = (n, lo, hi) => {
              n = Number(n);
              if (!Number.isFinite(n)) n = lo;
              return Math.max(lo, Math.min(hi, n));
            };

            // existing leylines (prefer doc; fallback to f) — normalized to include gate defaults
            const existingLey = dr.getFlag(MOD, "leylines");
            const rawLey = (existingLey && typeof existingLey === "object")
              ? existingLey
              : ((f.leylines && typeof f.leylines === "object") ? f.leylines : {});

            const baseLey = Object.assign({
              primaryResonance: "none",
              flowState: "normal",
              purity: 0,
              memoryCharge: 0,
              gate: { enabled:false, linkHexUuid:"", strength:0.5, minFactionTier:"T2", locked:false }
            }, (rawLey && typeof rawLey === "object") ? rawLey : {});

            // Ensure gate exists even if a legacy leylines object overwrote it
            baseLey.gate = Object.assign(
              { enabled:false, linkHexUuid:"", strength:0.5, minFactionTier:"T2", locked:false },
              (baseLey.gate && typeof baseLey.gate === "object") ? baseLey.gate : {}
            );


            const leylinesToPersist = Object.assign({
              primaryResonance: "none",
              flowState: "normal",
              purity: 0,
              memoryCharge: 0,
              gate: {
                enabled: false,
                linkHexUuid: "",
                strength: 0.5,
                minFactionTier: "T2",
                locked: false
              }
            }, baseLey || {});

            // Top-level leylines
            leylinesToPersist.primaryResonance = String(fd.get("leylines.primaryResonance") || leylinesToPersist.primaryResonance || "none");
            leylinesToPersist.flowState        = String(fd.get("leylines.flowState") || leylinesToPersist.flowState || "normal");
            leylinesToPersist.purity           = clamp(fd.get("leylines.purity") ?? leylinesToPersist.purity ?? 0, -5, 5);
            leylinesToPersist.memoryCharge     = clamp(fd.get("leylines.memoryCharge") ?? leylinesToPersist.memoryCharge ?? 0, 0, 999);

            // Gate (nested)
            const g = Object.assign({
              enabled: false,
              linkHexUuid: "",
              strength: 0.5,
              minFactionTier: "T2",
              locked: false
            }, (leylinesToPersist.gate && typeof leylinesToPersist.gate === "object") ? leylinesToPersist.gate : {});

            g.enabled = (fd.get("leylines.gate.enabled") === "on");

            // accept either field name from HBS
            const gateTarget =
              fd.get("leylines.gate.linkHexUuid") ??
              fd.get("leylines.gate.targetHexUuid") ??
              null;

            g.linkHexUuid = String(gateTarget || g.linkHexUuid || "").trim();

            g.strength = clamp(fd.get("leylines.gate.strength") ?? g.strength ?? 0.5, 0, 1);

            // accept either field name from HBS
            const gateMinTier =
              fd.get("leylines.gate.minFactionTier") ??
              fd.get("leylines.gate.minTier") ??
              null;

            g.minFactionTier = _bbttccNormalizeTierKey(gateMinTier || g.minFactionTier || "T2");

            g.locked = (fd.get("leylines.gate.locked") === "on");


            leylinesToPersist.gate = g;

            // Optional OP cache derived from the same visible vector, modulated by flowState
            const flowState = String(leylinesToPersist.flowState || "normal");
            const effectiveOPs = resourcesToOP(resourcesToPersist, flowState);

            const name = (data.name ?? "").trim() || dr.text || "Hex";
            const now = Date.now();

            // Terrain Canon (writer-of-record):
            //   1. Form-authored value (terrain selector dropdown) — wins if
            //      the user actually touched the dropdown (data-ft-terrain-touched="1")
            //   2. Existing flag (already persisted, e.g. from prior change-handler save)
            //   3. Derived from Type
            //   4. Fallback to "plains"
            // History: 2026-04-29 fix made the form value win over the snapshot.
            // 2026-05-02 fix added the touched-guard: when the dropdown's
            // preselect can't find a matching option (e.g. the saved canon key
            // isn't in the dropdown's menu), the browser defaults to the first
            // option ("plains") and a Save with no terrain change silently
            // overwrites the real value. The touched-guard prevents that.
            const formTerrainKey = String(fd.get(`flags.${MOD}.terrain.key`) || "").trim();
            const formTerrainTouched = (() => {
              try {
                const sel = form.querySelector(`select[name="flags.${MOD}.terrain.key"]`);
                return sel ? sel.getAttribute("data-ft-terrain-touched") === "1" : false;
              } catch { return false; }
            })();
            const liveExistingTerrainKey = bbttccReadTerrainKeyFromFlags(f) || null;
            const resolvedTerrainKey = bbttccNormalizeTerrainKey(
              (formTerrainTouched && formTerrainKey) ||
              liveExistingTerrainKey ||
              formTerrainKey ||
              bbttccTerrainFromType(data.type || "wilderness") ||
              "plains"
            );

            // Flags patch — we’ll set per-key for robustness
            const flagsPatch = {
              isHex:true, kind:"territory-hex", name,
              factionId:data.factionId || "",
              status:data.status || "unclaimed",
              type:data.type || "wilderness",
              terrain:     bbttccBuildTerrainObj(resolvedTerrainKey),
              terrainType: resolvedTerrainKey,
              terrainKey:  resolvedTerrainKey,

              size:data.size || "none",
              population:data.population || "uninhabited",
              capital: !!data.capital,

              // Visible numbers (either manual base, or auto effective)
              resources: resourcesToPersist,

              // Leylines (with Gate)
              leylines: leylinesToPersist,

              // Transparency / preview
              sephirotBonus: calc.added,
              calc: {
                base: vectorForDisplay,
                sephirotName: selName,
                multipliers: calc.multipliers,
                modifiers: mods,
                effective: calc.effective
              },

              // Alignment (all forms for fast lookups)
              sephirotUuid: selUuid,
              sephirotName: selName,
              sephirotKey:  selKey,

              // Manual switch (for readers who care). The checkbox in the
              // hex editor is authoritative — unchecking it must clear the
              // flag. The previous OR with `existingGMOverride` made the
              // flag sticky so unchecks were silently ignored.
              manualOverride: !!(manualResourceOverride && Object.values(base).some(n=>n>0)),

              // Optional: OP cache for sheets/turn math
              effectiveCached: effectiveOPs,
              effectiveAt: now,

              // Notes / mods
              modifiers: mods,
              notes: data.notes ?? ""
            };

            // Write per-key to avoid any scene/permission quirk
            for (const [k,v] of Object.entries(flagsPatch)) {
              // eslint-disable-next-line no-await-in-loop
              await dr.setFlag(MOD, k, v);
            }
            await dr.update({ text:name }).catch(()=>{});

            // Hex Dossier — diff old `f` against new `flagsPatch` and emit
            // one ledger entry per meaningful change. The save handler is the
            // canonical player-driven mutation surface (type, size, sephirot,
            // modifiers, capital, leylines), so this is the single biggest
            // signal source for the dossier timeline.
            try {
              const recorder = game?.bbttcc?.api?.territory?.recordHexImprovement;
              const modRecorder = game?.bbttcc?.api?.territory?.recordHexModifierTransition;
              const editorSource = { activity: "hex_editor_save", factionId: game?.user?.id || "" };

              if (typeof recorder === "function") {
                const before = f || {};
                const after = flagsPatch;

                // Type change
                if (String(before.type || "") !== String(after.type || "")) {
                  await recorder(dr, {
                    kind: "type_change",
                    label: `Type: ${before.type || "(none)"} → ${after.type}`,
                    description: `Hex re-typed via editor.`,
                    source: editorSource,
                    before: { type: before.type || null }, after: { type: after.type || null },
                    reversible: true
                  });
                }

                // Size change
                const beforeSize = String(before.size || "none").toLowerCase();
                const afterSize  = String(after.size  || "none").toLowerCase();
                if (beforeSize !== afterSize) {
                  const order = ["none","outpost","village","town","city","metropolis","megalopolis"];
                  const wentUp = order.indexOf(afterSize) > order.indexOf(beforeSize);
                  await recorder(dr, {
                    kind: wentUp ? "size_up" : "size_down",
                    label: `Size: ${beforeSize} → ${afterSize}`,
                    description: `Settlement size changed via editor (production multiplier shifts).`,
                    source: editorSource,
                    before: { size: beforeSize }, after: { size: afterSize },
                    reversible: true
                  });
                }

                // Population change
                if (String(before.population || "") !== String(after.population || "")) {
                  await recorder(dr, {
                    kind: "owner_action",
                    label: `Population: ${before.population || "(none)"} → ${after.population}`,
                    description: `Population class set via editor.`,
                    source: editorSource,
                    before: { population: before.population || null }, after: { population: after.population || null },
                    reversible: true
                  });
                }

                // Capital toggle
                if (!!before.capital !== !!after.capital) {
                  await recorder(dr, {
                    kind: "owner_action",
                    label: after.capital ? "Designated capital" : "Capital flag removed",
                    description: after.capital ? "This hex is now the faction capital." : "Capital flag cleared.",
                    source: editorSource,
                    before: { capital: !!before.capital }, after: { capital: !!after.capital },
                    reversible: true
                  });
                }

                // Sephirot change (key is the canonical form)
                const beforeSeph = String(before.sephirotKey || "").toLowerCase();
                const afterSeph  = String(after.sephirotKey  || "").toLowerCase();
                if (beforeSeph !== afterSeph) {
                  await recorder(dr, {
                    kind: beforeSeph ? "sephirot_changed" : "sephirot_set",
                    label: afterSeph ? `Sephirot: ${beforeSeph || "(none)"} → ${afterSeph}` : `Sephirot cleared (was ${beforeSeph})`,
                    description: afterSeph ? `Sephirothic alignment ${afterSeph} applied; resource bonuses recomputed.` : `Sephirothic alignment removed.`,
                    source: editorSource,
                    before: { sephirotKey: beforeSeph || null, sephirotName: before.sephirotName || null },
                    after:  { sephirotKey: afterSeph || null,  sephirotName: after.sephirotName || null },
                    reversible: true
                  });
                }

                // Leyline configuration change (deep compare on the structured object)
                try {
                  const beforeLey = before.leylines ? JSON.stringify(before.leylines) : "";
                  const afterLey  = after.leylines  ? JSON.stringify(after.leylines)  : "";
                  if (beforeLey !== afterLey) {
                    await recorder(dr, {
                      kind: "owner_action",
                      label: "Leyline configuration updated",
                      description: `Leyline resonance / flow / gate updated via editor.`,
                      source: editorSource,
                      before: { leylines: before.leylines || null },
                      after:  { leylines: after.leylines  || null },
                      reversible: true
                    });
                  }
                } catch (_eLey) {}

                // Manual resource override toggle
                if (!!before.manualOverride !== !!after.manualOverride) {
                  await recorder(dr, {
                    kind: "owner_action",
                    label: after.manualOverride ? "Manual resource override enabled" : "Manual resource override disabled",
                    description: after.manualOverride ? "Stored resource numbers now win over auto-calc." : "Auto-calc resumed (type × size × alignment + modifiers).",
                    source: editorSource,
                    before: { manualOverride: !!before.manualOverride }, after: { manualOverride: !!after.manualOverride },
                    reversible: true
                  });
                }
              }

              // Modifier diff via the dedicated transition recorder so
              // modifierHistory stays in sync with improvements[].
              if (typeof modRecorder === "function") {
                const beforeMods = Array.isArray(f?.modifiers) ? f.modifiers.map(String) : [];
                const afterMods  = Array.isArray(flagsPatch.modifiers) ? flagsPatch.modifiers.map(String) : [];
                const beforeSet = new Set(beforeMods);
                const afterSet  = new Set(afterMods);
                const dedupePrefix = `editor:${dr.id}:${Date.now()}`;
                for (const m of afterMods) {
                  if (!beforeSet.has(m)) {
                    await modRecorder(dr, m, "added", { activity: "hex_editor_save", factionId: game?.user?.id || "" }, `${dedupePrefix}:add:${m}`);
                  }
                }
                for (const m of beforeMods) {
                  if (!afterSet.has(m)) {
                    await modRecorder(dr, m, "removed", { activity: "hex_editor_save", factionId: game?.user?.id || "" }, `${dedupePrefix}:rm:${m}`);
                  }
                }
              }
            } catch (eL) { console.warn("[bbttcc-territory] Hex editor dossier ledger failed", eL); }

            // Verify; compact log
            const fresh = await fromUuid(dr.uuid);
            const gf = (k)=> fresh.getFlag(MOD, k);
            console.log("[bbttcc-territory] Save verify:", {
              name: gf("name"),
              type: gf("type"),
              size: gf("size"),
              resources: gf("resources"),
              leylines: gf("leylines"),
              manualOverride: gf("manualOverride"),
              effectiveCached: gf("effectiveCached"),
              effectiveAt: gf("effectiveAt")
            });

            await applyStyle(fresh);
            ui.notifications?.info?.("Hex saved.");
          } catch (err) {
            console.error("[bbttcc-territory] Save failed:", err);
            ui.notifications?.error?.("Hex save failed — see console.");
          }
        }
      },
      cancel:{ label:"Cancel" }
    },
    default:"save",
    close:()=>OPEN.delete(dr.id)
  },
  {
    id: "bbttcc-hex-config",
    width: 820,
    height: 820,
    resizable: true,
    // 2026-04-29: pass the DrawingDocument uuid through so the terrain
    // selector enhancer's resolveHexDocument(app) can find the doc via
    // app.options.uuid on reopen. Without this, the dropdown couldn't
    // preselect the saved terrain and looked like a revert.
    uuid: dr.uuid
  }
);

  OPEN.set(dr.id, dlg);
  dlg.render(true);
  // Phase 2: GM Manual Edit panel injection (Dialog content is V1)
  bbttccInjectGMPanelIntoHexConfigDialog(dlg, dr);
}

/* ---------------- Create Hex ---------------- */
function buildHexData({ x,y }){
  const g=canvas.scene?.grid?.size ?? 100;
  const r=Math.max(12, Math.round(g*0.5));
  const abs=hexVerts(x,y,r,detectStartAngle());
  const {rel,origin}=toRelativePoints(abs);
  const v=styleForStatus("unclaimed");
  return {
    shape:{type:"p", points:rel},
    x:origin.x, y:origin.y,
    fillAlpha:v.fillAlpha, fillColor:v.fillColor, strokeColor:v.strokeColor, strokeAlpha:v.strokeAlpha, strokeWidth:v.strokeWidth,
    text:"Hex",
    fontSize: 12,
    flags:{ [MOD]:{
      isHex:true, kind:"territory-hex", name:"Hex",
      status:"unclaimed", type:"wilderness", size:"none",
      population:"uninhabited", capital:false,
      resources:{ food:0, materials:0, trade:0, military:0, knowledge:0 },
      leylines:{
        primaryResonance:"none",
        flowState:"normal",
        purity:0,
        memoryCharge:0,
        gate:{ enabled:false, linkHexUuid:"", strength:0.5, minFactionTier:"T2", locked:false }
      },
      createdAt: Date.now()
    }}
  };
}
async function _createHexAt(x,y){
  const c=snapCenter(x,y);
  const data=buildHexData(c);
  const [doc] = await canvas.scene.createEmbeddedDocuments("Drawing",[data]);
  await applyStyle(doc);
  return doc;
}

/* ---------------- Toolbar ---------------- */
function toolbarHTML(){
  return `
  <div id="${TOOLBAR_ID}" class="bbttcc-control-bar-wrap" data-bbttcc-toolbar="true" aria-label="Bad Eden Control Bar">
    <div class="bbttcc-toolbar bbttcc-control-bar">
      
      <div class="bbttcc-toolbar-left">
        <div class="bbttcc-toolbar-brand">
          <i class="fas fa-bars"></i>
          <strong>Bad Eden</strong>
        </div>
      </div>

      <div class="bbttcc-toolbar-center">
        <!-- MAIN ROW (ALL BUTTONS GO HERE) -->
        <div class="row bbttcc-toolbar-main"></div>
      </div>

      <div class="bbttcc-toolbar-right">
        <div class="row bbttcc-toolbar-utility">
          <button type="button" class="bbttcc-btn bbttcc-btn-icon" data-action="reset-pos" title="Re-center control bar">
            <i class="fas fa-undo"></i>
          </button>
        </div>
      </div>

    </div>
  </div>`;
}

function ensureToolbar(){
  let el = document.getElementById(TOOLBAR_ID);

  if (!el) {
    document.body.insertAdjacentHTML("beforeend", toolbarHTML());
    el = document.getElementById(TOOLBAR_ID);

    // central click handler
    el.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      onAction(btn.dataset.action);
    });
  }

  // normalize structure (safety if other scripts touched it)
  el.classList.add("bbttcc-control-bar-wrap");
  el.setAttribute("data-bbttcc-toolbar", "true");

  const shell = el.querySelector(".bbttcc-toolbar");
  if (shell) shell.classList.add("bbttcc-control-bar");

  /* -----------------------------
     BASE BUTTON INJECTION (NEW)
  ----------------------------- */

  const row = el.querySelector(".bbttcc-toolbar-main");

  if (row && !row.querySelector('[data-action="territory-dashboard"]')) {
    const mk = (action, icon, label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bbttcc-btn";
      btn.dataset.action = action;
      btn.innerHTML = `<i class="fas fa-${icon}"></i><span>${label}</span>`;
      return btn;
    };

    row.appendChild(mk("territory-dashboard", "th-large", "Dashboard"));
    row.appendChild(mk("create-hex", "draw-polygon", "Create Hex"));
    row.appendChild(mk("campaign-overview", "list", "Overview"));
  }

  // 2026-05-19 — Wire up drag + collapse via the shared HUD helper from
  // systems/fourththing. The existing reset-pos button (Re-center) stays
  // in place; skipReset:true so we don't double up.
  try {
    const mkDrag = globalThis._ftMakeHudDraggable;
    if (typeof mkDrag === "function") {
      mkDrag(el, { storageKey: "bbttcc-toolbar", collapsedLabel: "Bad Eden", skipReset: true });
    }
  } catch (e) { console.warn("[bbttcc-territory] toolbar drag wire-up failed", e); }

  return el;
}

/* ---------------- Placement flow ---------------- */
let placing=false;
function endPlacement(){ placing=false; try{ canvas.stage.off?.("pointerdown", onDown);}catch{} window.removeEventListener("keydown", onEsc, {capture:true}); ui.notifications?.info?.("Hex placement ended."); }
function onEsc(e){ if (e.key==="Escape") endPlacement(); }
async function onDown(ev){
  if (!placing) return; endPlacement();
  try {
    const w=worldFromEvent(ev);
    const doc=await game.bbttcc.api.territory._createHexInternal(w.x,w.y);
    if (doc?.uuid) await openHexEditorByUuid(doc.uuid);
    ui.notifications?.info?.("Hex created.");
  } catch(err){
    console.error(`[${MOD}] hex create failed`, err);
    ui.notifications?.error?.("Failed to create hex.");
  }
}
function beginPlaceHex(){ if (placing) return; placing=true; ui.notifications?.info?.("Click anywhere to place a hex (Esc to cancel)."); window.addEventListener("keydown", onEsc, {capture:true}); canvas.stage.on?.("pointerdown", onDown, {once:true}); }

/* ---------------- Toolbar actions ---------------- */
async function onAction(action){
  const api = game?.bbttcc?.api?.territory ?? {};

  if (action==="reset-pos") {
    const el = document.getElementById(TOOLBAR_ID);
    if (el) {
      el.style.left = "";
      el.style.top = "";
      el.style.right = "";
      el.style.bottom = "";
      el.style.transform = "";
    }
    // 2026-05-19 — Also wipe the saved drag position. Without this the
    // next render re-applies the stored coordinates and re-center is a no-op.
    try {
      const uid = game?.user?.id || "anon";
      localStorage.removeItem(`ft-hud-pos:${uid}:bbttcc-toolbar`);
    } catch (_) {}
    return ui.notifications?.info?.("Control bar re-centered.");
  }

  if (action==="territory-dashboard") {
    // ✅ Prefer the safe opener installed by overview-button.js (AppV2-safe)
    if (typeof globalThis.BBTTCC_OpenTerritoryDashboard === "function") {
      return globalThis.BBTTCC_OpenTerritoryDashboard();
    }

    // ✅ Fallback: AppV2-safe open without legacy singleton
    const ctor = globalThis.BBTTCC_TerritoryDashboardCtor || api._dashboardCtor;
    if (typeof ctor !== "function") return ui.notifications?.warn?.("Dashboard unavailable.");

    game.bbttcc = game.bbttcc || {};
    game.bbttcc.apps = game.bbttcc.apps || {};

    let inst = game.bbttcc.apps.territoryDashboard;
    const dead = !inst || typeof inst.render !== "function" || inst._state === 0;

    if (dead) {
      inst = new ctor();
      game.bbttcc.apps.territoryDashboard = inst;
    }

    inst.render({ force: true, focus: true });
    return inst;
  }

  if (action==="campaign-overview") {
    if (typeof api.openCampaignOverview==="function") return api.openCampaignOverview();
    return ui.notifications?.warn?.("Campaign Overview unavailable.");
  }

  if (action==="create-hex") {
    if (typeof api.createHexAt!=="function") return ui.notifications?.warn?.("createHexAt API unavailable.");
    beginPlaceHex();
  }
}


/* ---------------- GM Adapter: gmSetHex (Phase 1.5) ----------------
 * Core GM write-layer calls game.bbttcc.api.territory.gmSetHex({ hexUuid, patch, note }).
 * We store values in flags.bbttcc-territory.* to match existing hex config patterns.
 *
 * Supported patch paths (structured objects):
 *   travel.unitsOverride               -> flags.travel.unitsOverride
 *   development.stage                  -> flags.integration.progress (alias) + flags.development.stage
 *   development.locked                 -> flags.integration.locked   (alias) + flags.development.locked
 *   alarm.value / alarm.locked         -> flags.alarm.value / flags.alarm.locked
 *   campaign.onEnterBeatId             -> flags.campaign.onEnterBeatId
 *
 * Notes:
 * - GM-only; Core already enforces GM-only + allowlist, but we re-check for safety.
 * - Values are clamped/sanitized where sensible (e.g., integration progress 0–6).
 */
function _bbttccIsGM(){ try { return !!(game && game.user && game.user.isGM); } catch (e) { return false; } }

function _bbttccClamp(n, lo, hi){
  n = Number(n);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

async function gmSetHex(args){
  args = args || {};
  if (!_bbttccIsGM()) throw new Error("[bbttcc-territory] GM-only: gmSetHex");
  const hexUuid = args.hexUuid;
  const patch = args.patch || {};
  const note = String(args.note || "").trim();
  if (!hexUuid) throw new Error("[bbttcc-territory] gmSetHex requires hexUuid");
  const dr = await fromUuid(hexUuid);
  if (!dr) throw new Error("[bbttcc-territory] Hex not found: " + hexUuid);

  const f = foundry.utils.getProperty(dr, `flags.${MOD}`) ?? {};

  // Dossier ledger: collect entries here as the patch applies, write at the end
  // so the timeline shows a coherent batch ("GM Manual Edit") rather than a
  // burst of unrelated rows. Each writer below pushes a partial improvement
  // payload describing its own change.
  const _ledgerBatch = [];
  const _ledgerSource = { activity: "gm_manual_edit", factionId: game?.user?.id || "", note };

  // Merge nested objects safely without spread
  const mergeObj = (a, b) => Object.assign({}, (a && typeof a === "object") ? a : {}, (b && typeof b === "object") ? b : {});

  // 0) manualOverride (authority switch)
  // - true  => GM overrides are authoritative; engine should not recompute
  // - false => resume system control / recompute
  // - null  => clear the flag entirely
  if (Object.prototype.hasOwnProperty.call(patch, "manualOverride")) {
    const mv = patch.manualOverride;
    const before = !!f.manualOverride;
    if (mv === null) {
      await dr.unsetFlag(MOD, "manualOverride");
      if (before) _ledgerBatch.push({ kind:"owner_action", label:"Manual Override cleared", description:"GM authority released; engine recomputes resume.", before:{manualOverride:before}, after:{manualOverride:false} });
    } else {
      const after = !!mv;
      await dr.setFlag(MOD, "manualOverride", after);
      if (before !== after) _ledgerBatch.push({ kind:"owner_action", label: after ? "Manual Override enabled" : "Manual Override disabled", description: after ? "GM-stored values now authoritative." : "Engine recomputes resume.", before:{manualOverride:before}, after:{manualOverride:after} });
    }
  }

  // 1) travel.unitsOverride
  if (patch.travel && Object.prototype.hasOwnProperty.call(patch.travel, "unitsOverride")) {
    const v = patch.travel.unitsOverride;
    const beforeUnits = (f.travel && Number.isFinite(f.travel.unitsOverride)) ? Number(f.travel.unitsOverride) : null;
    if (v === null) {
      await dr.unsetFlag(MOD, "travel");
      if (beforeUnits != null) _ledgerBatch.push({ kind:"owner_action", label:"Travel-cost override cleared", description:`Restored to default (was ${beforeUnits} units).`, before:{travelUnitsOverride:beforeUnits}, after:{travelUnitsOverride:null} });
    } else {
      const units = _bbttccClamp(v, 0, 99);
      await dr.setFlag(MOD, "travel", mergeObj(f.travel, { unitsOverride: units }));
      if (beforeUnits !== units) _ledgerBatch.push({ kind:"owner_action", label:`Travel-cost override → ${units}`, description:`Travel units overridden to ${units}${beforeUnits!=null?` (was ${beforeUnits})`:""}.`, before:{travelUnitsOverride:beforeUnits}, after:{travelUnitsOverride:units} });
    }
  }

  // 2) development.stage / development.locked (alias integration.progress/locked)
  if (patch.development && Object.prototype.hasOwnProperty.call(patch.development, "stage")) {
    const v = patch.development.stage;
    const beforeStage = Number(((f.development && f.development.stage != null) ? f.development.stage : (f.integration && f.integration.progress)) ?? 0) || 0;
    if (v === null) {
    await dr.unsetFlag(MOD, "development");
      if (beforeStage > 0) _ledgerBatch.push({ kind:"owner_action", label:"Development cleared", description:`Development stage reset (was ${beforeStage}).`, before:{stage:beforeStage}, after:{stage:0} });
    } else {
      const stage = _bbttccClamp(v, 0, 6);

      // IMPORTANT: merge from CURRENT flags, not stale snapshot
      const curDev = (await dr.getFlag(MOD, "development")) || {};
      const curIn  = (await dr.getFlag(MOD, "integration")) || {};

      await dr.setFlag(MOD, "development", mergeObj(curDev, { stage }));
      await dr.setFlag(MOD, "integration", mergeObj(curIn, { progress: stage }));

      // Legacy readers sometimes expect a flat integrationProgress number
      try { await dr.setFlag(MOD, "integrationProgress", stage); } catch (e) {}

      if (beforeStage !== stage) {
        const stageLabel = stage >= 6 ? "integrated" : stage === 5 ? "settled" : stage >= 3 ? "developing" : stage >= 1 ? "outpost" : "wild";
        _ledgerBatch.push({
          kind: "integration_step",
          label: `Development ${beforeStage} → ${stage} (${stageLabel})`,
          description: `Integration progress set by GM (note: ${note || "—"}).`,
          before: { stage: beforeStage }, after: { stage, stageLabel }
        });
      }
    }
  }

  if (patch.development && Object.prototype.hasOwnProperty.call(patch.development, "locked")) {
    const v = patch.development.locked;
    const beforeLocked = !!((f.development && f.development.locked) || (f.integration && f.integration.locked));
    if (v === null) {
      // Clear ONLY the lock, keep stage/progress intact
      const curDev = (await dr.getFlag(MOD, "development")) || {};
      const curIn  = (await dr.getFlag(MOD, "integration")) || {};

      delete curDev.locked;
      delete curIn.locked;

      await dr.setFlag(MOD, "development", curDev);
      await dr.setFlag(MOD, "integration", curIn);
      try { await dr.unsetFlag(MOD, "integrationLocked"); } catch (e) {}
      if (beforeLocked) _ledgerBatch.push({ kind:"owner_action", label:"Development unlocked", description:"Development progress no longer locked.", before:{locked:true}, after:{locked:false} });
    } else {
      const locked = !!v;

      // IMPORTANT: merge from CURRENT flags, not stale snapshot
      const curDev = (await dr.getFlag(MOD, "development")) || {};
      const curIn  = (await dr.getFlag(MOD, "integration")) || {};

      await dr.setFlag(MOD, "development", mergeObj(curDev, { locked }));
      await dr.setFlag(MOD, "integration", mergeObj(curIn, { locked }));
      try { await dr.setFlag(MOD, "integrationLocked", locked); } catch (e) {}
      if (beforeLocked !== locked) _ledgerBatch.push({ kind:"owner_action", label: locked ? "Development locked" : "Development unlocked", description: locked ? "Stage progression locked by GM." : "Stage progression unlocked.", before:{locked:beforeLocked}, after:{locked} });
    }
  }

  // 3) alarm
  if (patch.alarm && Object.prototype.hasOwnProperty.call(patch.alarm, "value")) {
    const v = patch.alarm.value;
    const beforeAlarm = (f.alarm && Number.isFinite(f.alarm.value)) ? Number(f.alarm.value) : null;
    if (v === null) {
      await dr.unsetFlag(MOD, "alarm");
      if (beforeAlarm != null) _ledgerBatch.push({ kind:"owner_action", label:"Alarm cleared", description:`Alarm reset (was ${beforeAlarm}).`, before:{alarm:beforeAlarm}, after:{alarm:null} });
    } else {
      const av = _bbttccClamp(v, 0, 99);
      await dr.setFlag(MOD, "alarm", mergeObj(f.alarm, { value: av }));
      if (beforeAlarm !== av) _ledgerBatch.push({ kind:"owner_action", label:`Alarm → ${av}`, description:`Alarm level set to ${av}${beforeAlarm!=null?` (was ${beforeAlarm})`:""}.`, before:{alarm:beforeAlarm}, after:{alarm:av} });
    }
  }
  if (patch.alarm && Object.prototype.hasOwnProperty.call(patch.alarm, "locked")) {
    const v = patch.alarm.locked;
    const beforeAlarmLocked = !!(f.alarm && f.alarm.locked);
    if (v === null) {
      await dr.unsetFlag(MOD, "alarm");
      if (beforeAlarmLocked) _ledgerBatch.push({ kind:"owner_action", label:"Alarm unlocked (cleared)", before:{alarmLocked:true}, after:{alarmLocked:false} });
    } else {
      const locked = !!v;
      await dr.setFlag(MOD, "alarm", mergeObj(f.alarm, { locked: locked }));
      if (beforeAlarmLocked !== locked) _ledgerBatch.push({ kind:"owner_action", label: locked ? "Alarm locked" : "Alarm unlocked", before:{alarmLocked:beforeAlarmLocked}, after:{alarmLocked:locked} });
    }
  }

  // 4) campaign.onEnterBeatId
  if (patch.campaign && Object.prototype.hasOwnProperty.call(patch.campaign, "onEnterBeatId")) {
    const v = patch.campaign.onEnterBeatId;
    const beforeBeat = String(f.campaign?.onEnterBeatId || "").trim();
    if (v === null) {
      await dr.unsetFlag(MOD, "campaign");
      if (beforeBeat) _ledgerBatch.push({ kind:"owner_action", label:"On-enter beat cleared", description:`Beat trigger removed (was: ${beforeBeat}).`, before:{onEnterBeatId:beforeBeat}, after:{onEnterBeatId:""} });
    } else {
      const beatId = String(v || "").trim();
      await dr.setFlag(MOD, "campaign", mergeObj(f.campaign, { onEnterBeatId: beatId }));
      if (beforeBeat !== beatId) _ledgerBatch.push({ kind:"owner_action", label: beatId ? `On-enter beat → ${beatId}` : "On-enter beat cleared", description: beatId ? `Beat will fire when a faction enters this hex.` : "Beat trigger removed.", before:{onEnterBeatId:beforeBeat}, after:{onEnterBeatId:beatId} });
    }
  }

  try { await applyStyle(dr); } catch (e) {}

  // Flush the dossier ledger for this GM Manual Edit batch.
  for (const partial of _ledgerBatch) {
    try { await recordHexImprovement(dr, Object.assign({ source: _ledgerSource }, partial)); }
    catch (e) { console.warn("[bbttcc-territory] gmSetHex ledger flush failed", e); }
  }

  return { ok: true, hexUuid: dr.uuid, name: (dr.text || f.name || "Hex") };
}


/* ---------------- Ready ---------------- */
Hooks.once("ready", ()=>{
// One-time migration: normalize existing bbttcc-factions warLogs entries so they all have ts+date.
// Safe for Alpha: runs once on ready; only writes if changes are detected.
(async () => {
  try {
    const MOD = "bbttcc-factions";
    const actors = game?.actors?.contents || [];
    for (const a of actors) {
      if (!a?.getFlag?.(MOD, "isFaction")) continue;
      const wl = a.getFlag(MOD, "warLogs");
      if (!Array.isArray(wl) || wl.length === 0) continue;

      const before = wl;
      const updateData = { flags: { [MOD]: { warLogs: before } } };
      bbttccNormalizeWarLogsInUpdate(updateData);
      const after = updateData.flags[MOD].warLogs;

      // detect change
      const changed =
        before.length !== after.length ||
        before.some((e, i) => (e?.ts !== after[i]?.ts) || (e?.date !== after[i]?.date));

      if (changed) {
        await a.setFlag(MOD, "warLogs", after);
      }
    }
  } catch (e) {
    console.warn("[bbttcc] warLog normalization migration failed", e);
  }
})();


  ensureToolbar();
  game.bbttcc ??= { api:{} };
  game.bbttcc.api ??= {};
  game.bbttcc.api.territory ??= {};
  // Terrain Canon: expose current-scene migrator (GM macro can call this)
  game.bbttcc.api.territory.migrateTerrainFlagsCurrentScene = bbttccMigrateTerrainFlagsCurrentScene;
  game.bbttcc.api.territory.normalizeTerrainKey = bbttccNormalizeTerrainKey;
  game.bbttcc.api.territory.buildTerrainObj = bbttccBuildTerrainObj;


  // Leylines — Gates (Remote Adjacency) resolver API (Sprint B.2 Step 2)
  game.bbttcc.api.territory.leylines = game.bbttcc.api.territory.leylines || {};
  game.bbttcc.api.territory.leylines.tierRank = _bbttccTierRank;
  game.bbttcc.api.territory.leylines.getFactionTierKey = _bbttccGetFactionTierKey;
  game.bbttcc.api.territory.leylines.gateUsable = function(args){ return _bbttccGateUsable(args || {}); };
  game.bbttcc.api.territory.leylines.resolveRemoteAdjacency = function(args){ return bbttccResolveRemoteAdjacency(args || {}); };


  // Leylines: expose conversion helper for debugging / macros
  game.bbttcc.api.territory.resourcesToOP = (res, flowState)=> resourcesToOP(res, flowState);
  game.bbttcc.api.territory.LEY_FLOW_MULT = LEY_FLOW_MULT;

  // Phase 1.5: GM write adapter for hex direct edits
  game.bbttcc.api.territory.gmSetHex = gmSetHex;

  // Hex Dossier — Improvement Ledger (Phase 2). Other modules instrument
  // their hex mutations by calling these helpers; the dossier UI reads from
  // flags.bbttcc-territory.improvements / .modifierHistory directly.
  game.bbttcc.api.territory.recordHexImprovement = recordHexImprovement;
  game.bbttcc.api.territory.recordHexModifierTransition = recordHexModifierTransition;
  game.bbttcc.api.territory.describeHexModifier = describeHexModifier;
  game.bbttcc.api.territory.MOD_DESCRIPTIONS = MOD_DESCRIPTIONS;
  game.bbttcc.api.territory.computeHexNextSteps = computeHexNextSteps;
  game.bbttcc.api.territory.traceHexProduction = traceHexProduction;

  game.bbttcc.api.territory._createHexInternal = _createHexAt;
  game.bbttcc.api.territory.createHexAt = async (a,b)=>{
    let x,y; if (typeof a==="object") ({x,y}=a); else { x=a; y=b; }
    const doc=await _createHexAt(x,y); if (doc?.uuid) await openHexEditorByUuid(doc.uuid); return doc;
  };
  game.bbttcc.api.territory.openHexConfig = (uuid)=> openHexEditorByUuid(uuid);
  game.bbttcc.api.territory.claim        = (uuid)=> openHexEditorByUuid(uuid);
  game.bbttcc.api.territory.refreshCapitalOverlays = ()=> bbttccRefreshAllCapitalOverlays();

  /* Bulk re-stamp applyStyle for every hex on the current scene. Used to
   * roll faction-tint + NBSP-name-label updates onto existing hexes that
   * were saved before those features shipped, without requiring a manual
   * re-save of each hex. Call from F12 console:
   *   await game.bbttcc.api.territory.refreshAllHexStyles()
   */
  game.bbttcc.api.territory.refreshAllHexStyles = async function refreshAllHexStyles({ allScenes = false } = {}) {
    if (!_bbttccIsGM()) {
      ui.notifications?.warn?.("refreshAllHexStyles: GM only.");
      return { ok:false, reason:"gm-only" };
    }
    const scenes = allScenes ? (game.scenes?.contents ?? []) : [canvas?.scene].filter(Boolean);
    let touched = 0;
    for (const sc of scenes) {
      const draws = sc?.drawings?.contents ?? sc?.drawings ?? [];
      for (const doc of draws) {
        const tf = doc?.flags?.[MOD];
        if (!tf) continue;
        const isHex = (tf.isHex === true) || (tf.kind === "territory-hex") ||
          (doc.shape?.type === "p" && Array.isArray(doc.shape?.points) && doc.shape.points.length === 12);
        if (!isHex) continue;
        try { await applyStyle(doc); touched += 1; } catch (e) { console.warn("[bbttcc-territory] restyle failed for", doc.uuid, e); }
      }
    }
    try { await bbttccRefreshAllCapitalOverlays(); } catch (_e) {}
    ui.notifications?.info?.(`Re-styled ${touched} hex${touched === 1 ? "" : "es"}.`);
    return { ok:true, touched, allScenes };
  };
});

Hooks.on("canvasReady", () => {
  // Re-ensure the Bad Eden toolbar exists whenever a new scene is drawn.
  // If it's already there, ensureToolbar() does nothing.
  try {
    ensureToolbar();
  } catch (e) {
    console.warn("[bbttcc-territory] ensureToolbar on canvasReady failed", e);
  }
  try {
    bbttccRefreshAllCapitalOverlays();
  } catch (e) {
    console.warn("[bbttcc-territory] capital overlay rebuild on canvasReady failed", e);
  }
  try { bbttccSuppressHexesOnBattleScene(); } catch (_e) {}
});

// Stray hex drawings on a battle/diorama scene: suppress each as it draws (covers refreshes
// after the canvasReady sweep). No-op on real hex-map scenes.
Hooks.on("drawDrawing", (drawing) => {
  try {
    if (bbttccIsHexMapScene(canvas?.scene)) return;
    if (bbttccIsHexDrawingDoc(drawing?.document)) { drawing.renderable = false; drawing.visible = false; }
  } catch (_e) {}
});

// canvas.primary is torn down on scene swap; the next canvasReady will get
// a fresh primary group, so forget the previous container reference.
Hooks.on("canvasTearDown", () => {
  BBTTCC_CAPITAL_OVERLAY_LAYER = null;
});

Hooks.on("updateDrawing", (doc) => {
  try {
    const f = doc && doc.flags ? doc.flags[MOD] : null;
    if (!f || (!f.isHex && f.kind !== "territory-hex")) return;
    bbttccRefreshCapitalOverlayForDrawing(doc);
  } catch (e) {
    console.warn("[bbttcc-territory] capital overlay updateDrawing failed", e);
  }
});

Hooks.on("deleteDrawing", (doc) => {
  try {
    const host = bbttccGetCapitalOverlayHost();
    if (!host) return;
    const label = "bbttcc-capital-overlay:" + String(doc && doc.id || "");
    const existing = host.children.find(c => c && c.label === label);
    if (existing) {
      host.removeChild(existing);
      try { existing.destroy({ children:true }); } catch (_e) {}
    }
  } catch (e) {
    console.warn("[bbttcc-territory] capital overlay deleteDrawing failed", e);
  }
});

// Player-facing Hex Sheet opener (AppV2-safe)
//
// This replaces the older Dialog-only shell. It renders the full Hex Sheet template
// (modules/bbttcc-territory/templates/hex-sheet.hbs) with actual hex data.
// Accepts either:
//   openHexSheet("DrawingUUID...")
//   openHexSheet({ hexUuid: "DrawingUUID..." })
//   openHexSheet({ uuid: "DrawingUUID..." })
(() => {
  const TPL_HEX_SHEET = `modules/${MOD}/templates/hex-sheet.hbs`;
  const _HEX_SHEET_OPEN = new Map(); // hexUuid -> app instance

  function _clamp(n, lo, hi) {
    n = Number(n);
    if (!Number.isFinite(n)) n = lo;
    return Math.max(lo, Math.min(hi, n));
  }

  function _toInt(n, fb = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.round(x) : fb;
  }

  function _pips(current, max) {
    const cur = _clamp(_toInt(current, 0), 0, max);
    const out = [];
    for (let i = 1; i <= max; i++) out.push({ on: i <= cur });
    return out;
  }

  function _radTier(rad) {
    const r = Math.max(0, _toInt(rad, 0));
    if (r <= 0) return "—";
    if (r <= 2) return "I";
    if (r <= 5) return "II";
    if (r <= 9) return "III";
    return "IV";
  }

  function _resolveHexUuid(arg) {
    // Tolerant signature handler: string or object payload.
    // Supports nested payloads (e.g. { hexUuid: { uuid:"..." } }).
    if (!arg) return "";

    // Direct string UUID
    if (typeof arg === "string") return String(arg).trim();

    // Some callers pass a Document-like thing directly
    if (arg && typeof arg === "object" && typeof arg.uuid === "string") return String(arg.uuid).trim();

    if (typeof arg === "object") {
      let h = arg.hexUuid ?? arg.uuid ?? arg.drawingUuid ?? arg.id ?? "";

      // Nested object cases: {hexUuid:{uuid:"..."}} or {hexUuid:{id:"..."}} etc.
      if (h && typeof h === "object") {
        if (typeof h.uuid === "string") h = h.uuid;
        else if (typeof h.id === "string" && typeof h.documentName === "string") {
          // Best-effort: if it's a Document-ish payload (rare), keep id only.
          h = h.id;
        } else if (typeof h.id === "string") h = h.id;
        else h = "";
      }

      // Sometimes callers pass dataset objects by mistake: { currentTarget: { dataset:{ hexUuid:"..." } } }
      if (!h && arg.currentTarget && arg.currentTarget.dataset) {
        h = arg.currentTarget.dataset.hexUuid || arg.currentTarget.dataset.hexUUID || arg.currentTarget.dataset.uuid || "";
      }

      return String(h || "").trim();
    }

    return String(arg || "").trim();
  }

  class BBTTCC_HexSheetApp extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "bbttcc-hex-sheet",
      window: { title: "Bad Eden — Hex Sheet", icon: "fas fa-hexagon" },
      position: { width: 920, height: 720 },
      classes: ["bbttcc", "bbttcc-hex-sheet", "sheet"],
      resizable: true
    };

    static PARTS = { body: { template: TPL_HEX_SHEET } };

    constructor({ hexUuid }, options = {}) {
      super(options);
      this.hexUuid = String(hexUuid || "").trim();
      this.__activeDossierTab = "overview";
      this.__hexImprovementHookId = null;
    }

    // Drop the per-hex registration so the next openHexSheet for the same
    // hex always builds a fresh app. Without this, the map keeps a stale
    // closed-app reference and bringToTop() on it is a silent no-op,
    // making the faction-sheet "Open" button appear dead.
    async _onClose(options) {
      try {
        const cur = _HEX_SHEET_OPEN.get(this.hexUuid);
        if (cur === this) _HEX_SHEET_OPEN.delete(this.hexUuid);
      } catch (_e) { /* ignore */ }
      try {
        if (this.__hexImprovementHookId != null) {
          Hooks.off("bbttcc:hexImprovement", this.__hexImprovementHookId);
          this.__hexImprovementHookId = null;
        }
      } catch (_e) {}
      return super._onClose?.(options);
    }

    async _resolveDrawing() {
      try {
        if (!this.hexUuid) return null;
        const doc = await fromUuid(this.hexUuid);
        return doc || null;
      } catch (_e) { return null; }
    }

    async _preparePartContext(partId, ctx) {
      if (partId !== "body") return ctx;

      const isGM = !!game.user?.isGM;
      const hexUuid = this.hexUuid;

      const dr = await this._resolveDrawing();
      if (!dr) {
        return {
          ...ctx,
          isGM,
          hexUuid,
          name: "(MISSING HEX)",
          size: "—",
          type: "—",
          status: "missing",
          ownerName: "—",
          facilitySummary: "None",
          integrationProgress: 0,
          integrationPips: _pips(0, 6),
          radiation: 0,
          radiationPips: _pips(0, 6),
          darkness: 0,
          darknessPips: _pips(0, 6),
          radiationTier: "—",
          conditionsCount: "0",
          hasConditions: false,
          conditions: [],
          hasResources: false,
          resourcesList: [],
          notes: `Could not resolve hex for UUID: ${String(hexUuid)}`
        };
      }

      const tf = dr.flags?.[MOD] ?? {};

      // Permission: GM always OK; non-GM must own the faction that owns the hex
      // (or the hex is ownerless).
      const factionId = String(tf.factionId || tf.ownerId || "").trim();
      const faction = factionId ? game.actors?.get?.(factionId) : null;

      if (!isGM) {
        // Per visibility model: any player with OBSERVER-or-better on the
        // owning faction may see hex details + dossier. Hexes with no owner
        // are visible to all.
        const ok = !faction
          ? true
          : !!faction?.testUserPermission?.(game.user, "OBSERVER");
        if (!ok) {
          return {
            ...ctx,
            isGM,
            hexUuid,
            name: tf.name || dr.text || dr.name || "(Hex)",
            size: String(tf.size || "—"),
            type: String(tf.type || "—"),
            status: String(tf.status || "—"),
            ownerName: faction?.name || "—",
            facilitySummary: "—",
            integrationProgress: _clamp(tf.integration?.progress ?? 0, 0, 6),
            integrationPips: _pips(tf.integration?.progress ?? 0, 6),
            radiation: 0,
            radiationPips: _pips(0, 6),
            darkness: 0,
            darknessPips: _pips(0, 6),
            radiationTier: "—",
            conditionsCount: "—",
            hasConditions: false,
            conditions: [],
            hasResources: false,
            resourcesList: [],
            notes: "You don't have permission to view detailed hex data."
          };
        }
      }

      // Tracks (alpha-safe)
      const integration = _clamp(tf.integration?.progress ?? tf.integrationProgress ?? 0, 0, 6);
      const radiation = Math.max(0, _toInt(tf.radiation?.value ?? tf.radiation ?? 0, 0));
      const darkness = Math.max(0, _toInt(tf.darkness?.local ?? tf.localDarkness ?? tf.darkness ?? 0, 0));

      // Facilities (alpha-safe)
      const facs = Array.isArray(tf.facilities) ? tf.facilities : [];
      const facilitySummary = facs.length ? `${facs.length}` : "None";

      // Conditions (alpha-safe)
      const conditions = Array.isArray(tf.conditions) ? tf.conditions.map(c => String(c).trim()).filter(Boolean) : [];
      const hasConditions = conditions.length > 0;

      // Resources/Yields (what's recorded on the hex flags)
      const r = tf.resources || {};
      const resourcesList = [
        { label: "Food", value: _toInt(r.food ?? 0, 0) },
        { label: "Materials", value: _toInt(r.materials ?? 0, 0) },
        { label: "Trade", value: _toInt(r.trade ?? 0, 0) },
        { label: "Military", value: _toInt(r.military ?? 0, 0) },
        { label: "Knowledge", value: _toInt(r.knowledge ?? 0, 0) }
      ];
      const hasResources = resourcesList.some(x => Number(x.value || 0) !== 0);

      // -----------------------------------------------------------------
      // Hex Dossier — context payload (Phase 4)
      // -----------------------------------------------------------------
      const dossier = (() => {
        const stageLabels = { wild:"Untouched Wilderness", outpost:"Foothold / Outpost", developing:"Developing Territory", settled:"Settled Province", integrated:"Integrated Heartland" };
        const stageKey = integration >= 6 ? "integrated" : integration === 5 ? "settled" : integration >= 3 ? "developing" : integration >= 1 ? "outpost" : "wild";

        // Modifiers — current list with descriptions and history if known.
        const mh = (tf.modifierHistory && typeof tf.modifierHistory === "object") ? tf.modifierHistory : {};
        const activeModifiers = (Array.isArray(tf.modifiers) ? tf.modifiers : [])
          .map(m => String(m).trim())
          .filter(Boolean)
          .map(m => {
            const desc = describeHexModifier(m) || "(no description on record)";
            const histRec = mh[m] || mh[m.toLowerCase?.()] || null;
            const addedTs = histRec?.addedTs ? new Date(histRec.addedTs).toLocaleString() : null;
            const addedTurn = histRec?.addedTurn ?? null;
            const sourceActivity = histRec?.source?.activity || histRec?.addedBy || null;
            return { name: m, description: desc, addedTs, addedTurn, sourceActivity };
          });

        // Production trace.
        const trace = traceHexProduction(dr);
        const productionRows = trace ? [
          { label:"Food",      base: trace.base.food,      sized: trace.sized.food,      final: trace.final.food },
          { label:"Materials", base: trace.base.materials, sized: trace.sized.materials, final: trace.final.materials },
          { label:"Trade",     base: trace.base.trade,     sized: trace.sized.trade,     final: trace.final.trade },
          { label:"Military",  base: trace.base.military,  sized: trace.sized.military,  final: trace.final.military },
          { label:"Knowledge", base: trace.base.knowledge, sized: trace.sized.knowledge, final: trace.final.knowledge }
        ] : [];

        // Timeline — reverse chronological, last 60 entries to keep it sane.
        const improvements = Array.isArray(tf.improvements) ? tf.improvements : [];
        const timeline = improvements.slice(-60).reverse().map(e => {
          const kindIcon = ({
            build: "fas fa-hammer", modifier_added: "fas fa-plus-circle", modifier_removed: "fas fa-minus-circle",
            size_up: "fas fa-arrow-up", size_down: "fas fa-arrow-down",
            sephirot_set: "fas fa-star", sephirot_changed: "fas fa-star-of-david",
            type_change: "fas fa-shapes", integration_step: "fas fa-mountain",
            owner_action: "fas fa-user-shield", garrison: "fas fa-shield-alt",
            raid_outcome: "fas fa-crosshairs", legacy_seed: "fas fa-seedling"
          })[e?.kind] || "fas fa-history";
          return {
            id: e?.id || "",
            ts: e?.ts || 0,
            when: e?.ts ? new Date(e.ts).toLocaleString() : "",
            turn: e?.turn != null ? `T${e.turn}` : "",
            kind: e?.kind || "",
            kindIcon,
            label: e?.label || e?.kind || "",
            description: e?.description || "",
            activity: e?.source?.activity || "",
            factionId: e?.source?.factionId || ""
          };
        });

        // Next steps from the pure function.
        const nextRaw = computeHexNextSteps(dr);
        const flatten = (arr) => Array.isArray(arr) ? arr : [];
        const nextSteps = {
          integration: flatten(nextRaw.integration),
          typeSize: flatten(nextRaw.typeSize),
          sephirot: flatten(nextRaw.sephirot),
          modifiers: flatten(nextRaw.modifiers),
          ownerActions: flatten(nextRaw.ownerActions)
        };
        const nextStepsHasAny = Object.values(nextSteps).some(arr => arr.length > 0);

        return {
          stageKey,
          stageLabel: stageLabels[stageKey] || "—",
          activeModifiers,
          hasActiveModifiers: activeModifiers.length > 0,
          productionRows,
          productionShown: !!trace && productionRows.some(r => r.final !== 0 || r.base !== 0),
          manualOverride: !!trace?.manualOverride,
          integMult: trace?.integMult ?? 1.0,
          sizeMult: trace?.sizeMult ?? 0,
          sephirotKey: String(tf.sephirotKey || "").toLowerCase() || null,
          sephirotName: tf.sephirotName || null,
          timeline,
          hasTimeline: timeline.length > 0,
          nextSteps,
          nextStepsHasAny,
          activeTab: this.__activeDossierTab || "overview"
        };
      })();

      return {
        ...ctx,
        isGM,
        hexUuid,
        name: tf.name || dr.text || dr.name || "(Hex)",
        size: String(tf.size || "—"),
        type: String(tf.type || "—"),
        status: String(tf.status || "—"),
        ownerName: faction?.name || (tf.ownerName || "—"),
        facilitySummary,
        integrationProgress: integration,
        integrationPips: _pips(integration, 6),
        radiation,
        radiationPips: _pips(Math.min(6, radiation), 6),
        darkness,
        darknessPips: _pips(Math.min(6, darkness), 6),
        radiationTier: _radTier(radiation),
        conditionsCount: String(conditions.length),
        hasConditions,
        conditions,
        hasResources,
        resourcesList,
        notes: String(tf.notes || "").trim() || "",
        dossier
      };
    }

    async _onRender(ctx, opts) {
      await super._onRender(ctx, opts);

      // Optional: GM controls (safe no-ops for now). We keep the buttons in the
      // template, but we don't hard-require gmSetHex to exist.
      const root = this.element?.[0] ?? this.element;
      if (!root || !(root instanceof HTMLElement)) return;

      // Tab strip — bind directly to each button on every render. Per-button
      // dataset guard prevents double-binding when buttons are reused across
      // renders, but a freshly-rendered button (V2 replaces inner DOM on each
      // render) gets its handler attached cleanly.
      const applyTabState = () => {
        const active = this.__activeDossierTab || "overview";
        root.querySelectorAll("[data-bbttcc-hex-tab]").forEach(btn => {
          btn.classList.toggle("active", btn.getAttribute("data-bbttcc-hex-tab") === active);
        });
        root.querySelectorAll("[data-bbttcc-hex-pane]").forEach(pane => {
          pane.style.display = (pane.getAttribute("data-bbttcc-hex-pane") === active) ? "" : "none";
        });
      };

      try {
        applyTabState();
        root.querySelectorAll("[data-bbttcc-hex-tab]").forEach(btn => {
          if (btn.dataset.bbttccTabBound === "1") return;
          btn.dataset.bbttccTabBound = "1";
          btn.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const next = String(btn.getAttribute("data-bbttcc-hex-tab") || "overview");
            if (next === this.__activeDossierTab) return;
            this.__activeDossierTab = next;
            applyTabState();
          });
        });
      } catch (eTab) { console.warn("[bbttcc-territory] hex sheet tab bind failed", eTab); }

      if (root.dataset.bbttccHexSheetBound === "1") return;
      root.dataset.bbttccHexSheetBound = "1";

      // Live refresh: subscribe to bbttcc:hexImprovement so the dossier
      // updates without a manual reload when something writes to its
      // improvements ledger. Hook id is cleaned up in _onClose.
      if (this.__hexImprovementHookId == null) {
        const myUuid = this.hexUuid;
        this.__hexImprovementHookId = Hooks.on("bbttcc:hexImprovement", ({ hexUuid } = {}) => {
          if (!myUuid || hexUuid !== myUuid) return;
          try { this.render(false); } catch (_e) {}
        });
      }

      root.addEventListener("click", async (ev) => {
        const btn = ev.target?.closest?.("button[data-action]");
        if (!btn) return;
        const act = String(btn.getAttribute("data-action") || "");
        if (!act) return;

        // Tab switching — handled BEFORE the GM gate so players can also
        // flip between Overview and Dossier. The data-action pattern is
        // what V2 already dispatches reliably in this sheet (proven by the
        // working radiation/darkness buttons), so we hook in here rather
        // than fighting V2's frame-level click handling.
        if (act === "hex-tab") {
          ev.preventDefault();
          ev.stopPropagation();
          const next = String(btn.getAttribute("data-tab") || "overview");
          if (next !== this.__activeDossierTab) {
            this.__activeDossierTab = next;
            const r = this.element?.[0] ?? this.element;
            if (r && r instanceof HTMLElement) {
              r.querySelectorAll("[data-bbttcc-hex-tab]").forEach(b => {
                b.classList.toggle("active", b.getAttribute("data-bbttcc-hex-tab") === next);
              });
              r.querySelectorAll("[data-bbttcc-hex-pane]").forEach(p => {
                p.style.display = (p.getAttribute("data-bbttcc-hex-pane") === next) ? "" : "none";
              });
            }
          }
          return;
        }

        if (!game.user?.isGM) return;

        // Only wire the two high-signal controls for now:
        // - hex-config (open GM Hex Config)
        // - open-builder (future hook; currently opens config)
        if (act === "hex-config" || act === "open-builder") {
          ev.preventDefault(); ev.stopPropagation();
          const api = game.bbttcc?.api?.territory;
          const open = api?.openHexConfig || api?.claim || null;
          if (typeof open !== "function") return ui.notifications?.warn?.("Hex Config not available.");
          await open(this.hexUuid);
          return;
        }

        // GM adjust radiation (writes to flags.bbttcc-territory.radiation.value)
        if (act === "hex-rad") {
          ev.preventDefault(); ev.stopPropagation();
          const delta = Number(btn.getAttribute("data-delta") || 0) || 0;
          const dr = await this._resolveDrawing();
          if (!dr) return;
          const tf = dr.flags?.[MOD] ?? {};
          const cur = Math.max(0, _toInt(tf.radiation?.value ?? tf.radiation ?? 0, 0));
          const next = Math.max(0, cur + delta);
          await dr.setFlag(MOD, "radiation", Object.assign({}, (tf.radiation && typeof tf.radiation === "object") ? tf.radiation : {}, { value: next }));
          this.render({ force: true });
          return;
        }
      }, true);
    }
  }

  // Public opener
  game.bbttcc = game.bbttcc || {};
  game.bbttcc.api = game.bbttcc.api || {};
  game.bbttcc.api.territory = game.bbttcc.api.territory || {};

  game.bbttcc.api.territory.openHexSheet = async (arg) => {
    const hexUuid = _resolveHexUuid(arg);
    if (!hexUuid || hexUuid === "[object Object]") {
      console.warn("[bbttcc-territory] openHexSheet: bad hexUuid payload", { arg, hexUuid });
      return ui.notifications?.warn?.("Hex Sheet: could not read hex UUID (see console).");
    }
    if (!hexUuid) return ui.notifications?.warn?.("Hex Sheet: missing hex UUID.");

    // De-dupe per-hex. A stale entry with a detached DOM element will silently
    // swallow the click (bringToTop becomes a no-op), so we treat any sheet
    // whose element is no longer in the live document as dead and replace it.
    const existing = _HEX_SHEET_OPEN.get(hexUuid);
    const stillLive = !!existing
      && existing.rendered === true
      && !!existing.element
      && existing.element.isConnected === true;
    if (stillLive) {
      try { existing.bringToTop?.(); } catch(_e) {}
      try { existing.element.focus?.(); } catch(_e) {}
      return existing;
    }
    if (existing) {
      _HEX_SHEET_OPEN.delete(hexUuid);
      try { existing.close?.({ force: true }); } catch(_e) {}
    }

    const app = new BBTTCC_HexSheetApp({ hexUuid });
    _HEX_SHEET_OPEN.set(hexUuid, app);
    app.render({ force: true, focus: true });
    return app;
  };
})();


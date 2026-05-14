// modules/bbttcc-raid/scripts/bbttcc-raid-effects-loader.enhancer.js
// BBTTCC — FINAL EFFECTS LOADER (Planner 3.0)
//
// 1) Loads strategic activities from bbttcc_activities_v1_4.json into raid.EFFECTS.
// 2) Normalizes OP costs from both JSON (flags.bbttcc.opCosts) and standard enhancers (EFFECTS.*.cost).
// 3) Computes spec.opCosts + spec.primaryKey for ALL strategic activities.
// 4) Applies a few name-based fallbacks (found_*, outpost, supply_* etc.) to clean up remaining "misc" cases.

(() => {
  const TAG = "[bbttcc-raid/effects-loader]";
  const JSON_URL = "modules/bbttcc-raid/data/bbttcc_activities_v1_4.json";

  // Canonical OP keys used by the planner
  const OP_PRIORITIES = [
    "violence",
    "nonLethal",
    "intrigue",
    "economy",
    "softPower",
    "diplomacy",
    "faith",
    "logistics",
    "culture"
  ];

  // Normalization map from various cost keys → canonical keys
  const OP_NORMALIZE = {
    violence:   "violence",
    nonlethal:  "nonLethal",
    nonLethal:  "nonLethal",
    intrigue:   "intrigue",
    economy:    "economy",
    softpower:  "softPower",
    softPower:  "softPower",
    diplomacy:  "diplomacy",
    faith:      "faith",
    logistics:  "logistics",
    culture:    "culture",
    materials:  "economy"   // treat Materials costs as Econ for categorization
  };

  function slugifyName(name) {
    return String(name || "")
      .replace(/\[[^\]]*\]/g, "")       // drop [T1], [T2], etc.
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function normalizeCost(cost) {
    const out = {};
    if (!cost || typeof cost !== "object") return out;
    for (const [k, v] of Object.entries(cost)) {
      const norm = OP_NORMALIZE[k] || null;
      if (!norm) continue;
      const val = Number(v || 0);
      if (!val) continue;
      out[norm] = (out[norm] || 0) + val;
    }
    return out;
  }

  function pickPrimaryOp(opCosts) {
    if (!opCosts || typeof opCosts !== "object") return "misc";
    let bestKey = null;
    let bestVal = -Infinity;
    for (const [k, v] of Object.entries(opCosts)) {
      if (!OP_PRIORITIES.includes(k)) continue;
      const val = Number(v || 0);
      if (val > bestVal) { bestVal = val; bestKey = k; }
    }
    return bestKey || "misc";
  }

  async function loadActivitiesFromJson() {
    const raid = game.bbttcc?.api?.raid;
    if (!raid) {
      console.warn(TAG, "raid API not available; EFFECTS loader idle.");
      return;
    }

    raid.EFFECTS ??= {};
    let data;

    try {
      const resp = await fetch(JSON_URL);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      data = await resp.json();
    } catch (e) {
      console.warn(TAG, "Failed to load JSON from", JSON_URL, e);
      return;
    }

    let added = 0;
    let merged = 0;

    for (const item of data || []) {
      const f = item.flags?.bbttcc || {};
      if (f.kind !== "strategic") continue;  // only strategic entries live in the planner

      const label = String(item.name || "").replace(/\[[^\]]*\]/g, "").trim();
      const key   = slugifyName(item.name || label);
      const tier  = f.tier ?? null;
      const rarity = f.rarity || null;
      const opCosts = normalizeCost(f.opCosts || {});   // JSON → normalized opCosts
      const text  = f.effects?.text || "";

      const primaryKey = pickPrimaryOp(opCosts);

      const spec = {
        kind: "strategic",
        label,
        primaryKey,
        opCosts,
        tier,
        rarity,
        text
      };

      if (!raid.EFFECTS[key]) {
        raid.EFFECTS[key] = spec;
        added++;
      } else {
        const existing = raid.EFFECTS[key];
        existing.kind       = existing.kind       || spec.kind;
        existing.label      = existing.label      || spec.label;
        existing.primaryKey = existing.primaryKey || spec.primaryKey;
        existing.opCosts    = Object.assign({}, spec.opCosts, existing.opCosts || {});
        if (spec.tier   != null && existing.tier   == null) existing.tier   = spec.tier;
        if (spec.rarity != null && !existing.rarity) existing.rarity = spec.rarity;
        if (spec.text   && !existing.text)         existing.text   = spec.text;
        merged++;
      }
    }

    console.log(TAG, `Strategic activities loaded from JSON: added ${added}, merged ${merged}.`);
  }

  function normalizeExistingStrategicEffects() {
    const raid = game.bbttcc?.api?.raid;
    if (!raid?.EFFECTS) return;

    let normalized = 0;

    for (const [key, spec] of Object.entries(raid.EFFECTS)) {
      if (!spec || spec.kind !== "strategic") continue;

      // --- Step 1: derive opCosts from spec.cost if missing ---
      const hasOpCosts = spec.opCosts && Object.keys(spec.opCosts).length;
      if (!hasOpCosts && spec.cost) {
        const opCosts = normalizeCost(spec.cost);
        if (Object.keys(opCosts).length) {
          spec.opCosts = opCosts;
          spec.primaryKey = spec.primaryKey || pickPrimaryOp(opCosts);
          normalized++;
        }
      }

      // Ensure opCosts at least present as object
      spec.opCosts = spec.opCosts && typeof spec.opCosts === "object" ? spec.opCosts : {};

      // --- Step 2: primaryKey fallback heuristics by name if still misc ---
      const pk = spec.primaryKey || "misc";
      if (pk === "misc" || !pk) {
        let newPK = null;

        // Founding / Outpost / site-type activities → Economy / Infrastructure
        if (/^found_site_/.test(key) || /^found_/.test(key) || /outpost/.test(key)) {
          newPK = "economy";
        }

        // Alignment Shift → Faith / Spiritual
        if (key === "alignment_shift") newPK = "faith";

        // Supply line / cache / depot / patrol routes / secure perimeter → Logistics-centric
        if (/supply_line|supply_cache|supply_depot|patrol_routes|secure_perimeter/i.test(key)) {
          newPK = "logistics";
        }

        if (newPK) {
          spec.primaryKey = newPK;
          normalized++;
        }
      }
    }

    if (normalized) {
      console.log(TAG, `Normalized ${normalized} strategic activities (derived opCosts/primaryKey).`);
    }
  }

  async function runLoader() {
    await loadActivitiesFromJson();
    normalizeExistingStrategicEffects();
  }

  Hooks.once("ready", () => {
    // Give compat-bridge + enhancers time to register EFFECTS, then enrich everything.
    setTimeout(runLoader, 150);
  });
})();

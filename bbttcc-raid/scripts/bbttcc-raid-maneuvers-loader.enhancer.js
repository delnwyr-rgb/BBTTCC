// modules/bbttcc-raid/scripts/bbttcc-raid-maneuvers-loader.enhancer.js
// BBTTCC — Maneuver EFFECTS loader for Raid Console 2.0
//
// Loads all maneuvers from bbttcc_maneuvers_v1_4.json into raid.EFFECTS,
// attaching: label, tier, rarity, opCosts, primaryKey, text, raidTypes, defenderAccess.

(() => {
  const TAG = "[bbttcc-raid/maneuvers-loader]";
  const JSON_URL = "modules/bbttcc-raid/data/bbttcc_maneuvers_v1_4.json";

  // Canonical OP keys used across the engine
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

  // Normalize from various spellings → canonical keys
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
    culture:    "culture"
  };

  function slugifyName(name) {
    return String(name || "")
      .replace(/\[[^\]]*\]/g, "")       // drop [T1], [T2], etc.
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function normalizeCost(opCosts) {
    const out = {};
    if (!opCosts || typeof opCosts !== "object") return out;
    for (const [k, v] of Object.entries(opCosts)) {
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

  async function loadManeuversFromJson() {
    const raid = game.bbttcc?.api?.raid;
    if (!raid) {
      console.warn(TAG, "raid API not available; maneuvers loader idle.");
      return;
    }

    raid.EFFECTS ??= {};
    let data;

    try {
      const resp = await fetch(JSON_URL);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      data = await resp.json();
    } catch (e) {
      console.warn(TAG, "Failed to load maneuvers JSON from", JSON_URL, e);
      return;
    }

    let added = 0;
    let merged = 0;

    for (const item of data || []) {
      const f = item.flags?.bbttcc || {};
      if (f.kind !== "maneuver") continue; // only maneuvers from this file

      const rawName = String(item.name || "");
      const label = rawName.replace(/\[[^\]]*\]/g, "").trim(); // "Suppressive Fire [T1]" → "Suppressive Fire"
      const key   = slugifyName(rawName || label);            // → "suppressive_fire"
      const tier  = f.tier ?? null;
      const rarity = f.rarity || null;
      const opCosts = normalizeCost(f.opCosts || {});
      const text  = f.effects?.text || "";
      const raidTypes = Array.isArray(f.raidTypes) ? f.raidTypes.slice() : [];
      const defenderAccess = f.defenderAccess || "No";

      const primaryKey = pickPrimaryOp(opCosts);

      const spec = {
        kind: "maneuver",
        label,
        primaryKey,
        opCosts,
        tier,
        rarity,
        text,
        raidTypes,
        defenderAccess
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
        if (!existing.raidTypes || !existing.raidTypes.length) existing.raidTypes = raidTypes;
        if (!existing.defenderAccess) existing.defenderAccess = defenderAccess;
        merged++;
      }
    }

    console.log(TAG, `Maneuvers loaded: added ${added}, merged ${merged}.`);
  }

  Hooks.once("ready", () => {
    // Wait just a bit in case raid.EFFECTS is populated during ready/init
    setTimeout(loadManeuversFromJson, 150);
  });
})();

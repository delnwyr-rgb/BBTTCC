/**
 * backfill-bestiary-lineage.macro.js — GM script macro (2026-09-04)
 *
 * One pass over the "Bad Eden Monsters" folder (and subfolders) of the
 * Bad Eden: NPC Pack v1 compendium (bbttcc-master-content.npcs) that stamps
 * everything the BESTIARY_AUDIT_2026_09_03.md punch list asked for:
 *
 *   • flags.fourththing.rfi.actor.lineage / subLineage  (the eight blessed lineages)
 *   • flags.fourththing.creatureType                     (mapped from lineage; array for swarms)
 *   • flags.fourththing.rfi.actor.tier / bracket         (fills gaps on the 5e ports;
 *                                                          "elite" → "boss")
 *   • flags.fourththing.rfi.actor.price                  (creature rubric — §6 of the audit)
 *   • system.defenses.* damage vocabulary                (radiant→sephirotic, fire→thermal:hot,
 *                                                          physical→kinetic, "thermal:hot" strings →
 *                                                          {type,flavor}, energy→electrical+thermal+chemical)
 *   • item damage types                                  (energy→by flavor, radiant→sephirotic; track recomputed)
 *   • system.conditionImmunities                         (drops "poisoned" — not a system condition)
 *   • system.magic.sephirah                              (gevurah → geburah, ruled 2026-09-04)
 *
 * DRY_RUN = true prints the full plan to the console and changes nothing.
 * Flip to false to write. The pack is unlocked for the write and re-locked
 * after. Idempotent: re-running produces an empty plan.
 *
 * Requires the system build that exports game.fourththing.pricing.computeCreaturePricing
 * (rfi-pricing.js, 2026-09-04). Refuses to run without it.
 */
const DRY_RUN = false;
const PACK_ID = "bbttcc-master-content.npcs";
const ROOT_FOLDER = "Bad Eden Monsters";

// ── Lineage roster (authoritative; heuristics only fill what this misses) ──
// lineage → creatureType mapping keeps the Manifestation Engine's "+Xd6 vs type" working.
const CREATURE_TYPE_BY_LINEAGE = {
  wild: "beast", mortal: "humanoid", "hex-touched": "aberration", "pre-fall": "construct",
  sephirotic: "elemental", qliphothic: "fiend", dream: "undead", revenant: "undead"
};
const L = (lineage, subLineage = "", extra = {}) => ({ lineage, subLineage, ...extra });
const ROSTER = {
  // Wild
  "Ash Wolf": L("wild", "pack"),
  "Cinder-Hawk Mother": L("wild", "aerial"),
  "Reed-Skin Stalker": L("wild", "amphibian"),
  "Bog-Skitter Swarm": L("wild", "insect", { swarm: true }),
  "Yesodium Tick-Hound": L("wild", "rad-beast"),
  "Tier 1 Predator (Scavenger Beast)": L("wild", "predator"),
  "Scavenger Beast": L("wild", "predator"),
  "Tier 2 Predator (Wastes Stalker)": L("wild", "predator"),
  "Wastes Stalker": L("wild", "predator"),
  "Apex Predator": L("wild", "predator"),
  "Jommetry Serpent": L("wild", "geometric"),
  "Varrenthyx, the Laser Dragon": L("wild", "dragon"),
  // Mortal — by banner
  "Road Bandit": L("mortal", "raider"),
  "Commander Road Bandit": L("mortal", "raider"),
  "Razor Raider": L("mortal", "raider"),
  "Raider Marauder": L("mortal", "raider"),
  "Dust Scavenger": L("mortal", "raider"),
  "Sept Acolyte": L("mortal", "sept"),
  "Septless Wanderer": L("mortal", "sept"),
  "Witness Initiate": L("mortal", "witness"),
  "Witness-Warden Lieutenant": L("mortal", "witness"),
  "Witness Apotheon": L("mortal", "witness"),
  "Valhaulan Spark Adept": L("mortal", "valhaulan"),
  "Battle-Bassinet Berserker": L("mortal", "valhaulan"),
  "Hex-Iron Berserker": L("mortal", "cultist"),
  "Yesodium Cultist Adept": L("mortal", "cultist"),
  "Bone Patriarch": L("mortal", "cultist"),
  "Vow-Bound Thrall": L("mortal", "oath-bound"),
  "Hex-Warlord's Honored Guard": L("mortal", "oath-bound"),
  "Jackalope Tinker-Scout": L("mortal", "jackalope"),
  // Hex-Touched
  "Crystal Lurker": L("hex-touched", "crystal"),
  "Hex-Touched Stray": L("hex-touched", "feral"),
  "Hex-Touched Champion": L("hex-touched", "pact"),
  "Marsh-Tongue Hex": L("hex-touched", "eldritch"),
  // Pre-Fall
  "Pre-Fall Drone": L("pre-fall", "servitor"),
  "Pre-Fall Sentinel": L("pre-fall", "guardian"),
  "Pre-Fall Battlemind": L("pre-fall", "ai"),
  "Pre-Fall Apex Construct": L("pre-fall", "war-machine"),
  "Crossing Guard (Lapsed Protocol)": L("pre-fall", "civic"),
  "S'narchy Burger Mascot (Reanimated)": L("pre-fall", "animate-signage"),
  // Sephirotic
  "Aggressive Sapling Kiddo": L("sephirotic", "tiferet"),
  "Aggressive Tiferet Tree Person": L("sephirotic", "tiferet"),
  "Lisa Frank Elemental": L("sephirotic", "netzach"),
  "Avatar of the Veil": L("sephirotic", "veil"),
  // Qliphothic — the twenty carry qliphah tags; subLineage is read from them
  "Qlipothic Shambler": L("qliphothic", "hollow"),
  "Qliphothic Shambler": L("qliphothic", "hollow"),
  "Gerald, Assistant Regional Manager of the Apocalypse": L("qliphothic", "bureaucracy"),
  "Please-Stop-Hitting-Yourself (Qliphothic Loop)": L("qliphothic", "loop"),
  "Wendigo Maître-D'": L("qliphothic", "wendigo"),
  "Gilbert, Eternally Cleaning Not Leaning Theater Attendant": L("qliphothic", "hospitality"),
  // Dream
  "Soma-Reaper": L("dream", "harvester"),
  "Slippage Wraith": L("dream", "reality-drift"),
  // Revenant
  "Salt Wraith": L("revenant", "grief")
};

// Integrity envelope (matches seed-bestiary + monster-builder) — used only to
// infer a bracket for actors that never got one (the 5e ports).
const INTEGRITY = {
  light:  { 1: 25, 2: 32, 3: 39, 4: 46 },
  medium: { 1: 40, 2: 50, 3: 60, 4: 70 },
  heavy:  { 1: 60, 2: 75, 3: 90, 4: 105 }
};
const ROMAN = { 1: "I", 2: "II", 3: "III", 4: "IV" };
const TIER_INT = { I: 1, II: 2, III: 3, IV: 4 };
const DAMAGE_TYPES = ["kinetic", "electrical", "thermal", "chemical", "poison", "psychic", "sephirotic", "qliphothic", "radiation"];
const TRACK_BY_TYPE = { psychic: "stress", qliphothic: "stress", radiation: "radiation" };
// The FT table is exposed as game.fourththing.constants; read lazily so the macro loads anywhere.
const systemConditions = () => new Set(Object.keys(game.fourththing?.constants?.CONDITIONS ?? {}));

function energyByFlavor(flavor) {
  const f = String(flavor ?? "").toLowerCase();
  if (/cold|ice|frost/.test(f)) return { type: "thermal", flavor: "cold" };
  if (/fire|hot|flame|heat|burn|cinder|ember|smolder|laser|solar|plasma/.test(f)) return { type: "thermal", flavor: "hot" };
  if (/acid/.test(f)) return { type: "chemical", flavor: "acid" };
  if (/base|alkal|caustic/.test(f)) return { type: "chemical", flavor: "base" };
  return { type: "electrical", flavor: "" };
}

// Normalize one defense entry → array of canonical entries (string or {type,flavor}).
function normDefense(e) {
  if (e && typeof e === "object") {
    const t = String(e.type ?? "").toLowerCase(); const f = String(e.flavor ?? "").toLowerCase();
    if (t === "radiant") return ["sephirotic"];
    if (t === "physical") return ["kinetic"];
    if (t === "fire") return [{ type: "thermal", flavor: "hot" }];
    if (t === "energy") return f ? [energyByFlavor(f)] : ["electrical", "thermal", "chemical"];
    if (!DAMAGE_TYPES.includes(t)) return [e];               // unknown — leave for the GM
    return f ? [{ type: t, flavor: f }] : [t];
  }
  const raw = String(e ?? "").toLowerCase().trim();
  if (!raw) return [];
  if (raw.includes(":")) { const [t, f] = raw.split(":"); return normDefense({ type: t, flavor: f }); }
  if (raw === "radiant") return ["sephirotic"];
  if (raw === "physical") return ["kinetic"];
  if (raw === "fire") return [{ type: "thermal", flavor: "hot" }];
  if (raw === "energy") return ["electrical", "thermal", "chemical"];
  return [raw];
}
function normDefenseList(list) {
  const out = []; const seen = new Set();
  for (const e of (Array.isArray(list) ? list : [])) {
    for (const n of normDefense(e)) {
      const key = typeof n === "string" ? n : `${n.type}:${n.flavor}`;
      if (!seen.has(key)) { seen.add(key); out.push(n); }
    }
  }
  return out;
}
function sameJson(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function inferBracket(tierInt, integ) {
  if (!Number.isFinite(integ) || integ <= 0) return "light";
  const heavy = INTEGRITY.heavy[tierInt];
  if (integ > heavy * 1.15) return "boss";
  let best = "light", bestD = Infinity;
  for (const b of ["light", "medium", "heavy"]) {
    const d = Math.abs(INTEGRITY[b][tierInt] - integ);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

function planActor(a, pricing) {
  const update = {}; const notes = [];
  const fl = a.flags?.fourththing ?? {};
  const rfi = fl.rfi?.actor ?? {};
  const sys = a.system ?? {};
  // Some 5e ports carry tags as a comma string rather than an array.
  const asList = (v) => Array.isArray(v) ? v : (typeof v === "string" ? v.split(",") : []);
  const tags = asList(sys.tags).map(t => String(t).trim().toLowerCase()).filter(Boolean);
  const themes = asList(rfi.bestiary?.themes).map(t => String(t).trim().toLowerCase()).filter(Boolean);

  // Lineage
  let entry = ROSTER[a.name];
  if (!entry) {
    const q = tags.find(t => t.startsWith("qliphah-"));
    if (q || themes.includes("qliphothic") || sys.magic?.sephirah === "qliphoth") entry = L("qliphothic", q ? q.slice(8) : "");
    else if (themes.includes("pre-fall") || themes.includes("construct")) entry = L("pre-fall", "");
    else if (themes.includes("hex-touched")) entry = L("hex-touched", "");
    else if (themes.includes("wildlife") || themes.includes("beast")) entry = L("wild", "", { swarm: themes.includes("swarm") });
    else if (themes.includes("humanoid")) entry = L("mortal", "");
    else if (themes.includes("undead")) entry = L("revenant", "");
    else if (themes.includes("fiend") || themes.includes("dream")) entry = L("dream", "");
    if (entry) notes.push(`lineage inferred from tags/themes`); else notes.push(`⚠ NO LINEAGE — add to ROSTER`);
  }
  if (entry) {
    const q = tags.find(t => t.startsWith("qliphah-"));
    const sub = entry.subLineage || (q ? q.slice(8) : "");
    if (rfi.lineage !== entry.lineage) update["flags.fourththing.rfi.actor.lineage"] = entry.lineage;
    if (sub && rfi.subLineage !== sub) update["flags.fourththing.rfi.actor.subLineage"] = sub;
    const base = CREATURE_TYPE_BY_LINEAGE[entry.lineage];
    const isSwarm = !!entry.swarm || themes.includes("swarm");
    const ct = isSwarm ? [base, "swarm"] : base;
    if (!sameJson(fl.creatureType, ct)) update["flags.fourththing.creatureType"] = ct;
  }

  // Tier / bracket
  let tierInt = TIER_INT[rfi.tier] ?? Number(sys.tier) ?? 1;
  if (!Number.isFinite(tierInt) || tierInt < 1) tierInt = 1;
  const tierRoman = ROMAN[Math.min(4, tierInt)];
  if (rfi.tier !== tierRoman) { update["flags.fourththing.rfi.actor.tier"] = tierRoman; notes.push(`tier ← ${tierRoman} (from system.tier)`); }
  let bracket = String(rfi.bracket ?? "").toLowerCase();
  if (bracket === "elite") { bracket = "boss"; update["flags.fourththing.rfi.actor.bracket"] = "boss"; notes.push("bracket elite → boss"); }
  if (!bracket) {
    bracket = inferBracket(tierInt, Number(sys.derived?.integrity?.max));
    update["flags.fourththing.rfi.actor.bracket"] = bracket;
    notes.push(`bracket inferred ${bracket} (integrity ${sys.derived?.integrity?.max})`);
  }

  // Price (creature rubric)
  const p = pricing.computeCreaturePricing({ tier: tierRoman, bracket, lineage: entry?.lineage });
  const currency = rfi.price?.currency || p.currency;
  const price = {
    marks: p.bounty, bounty: p.bounty, hire: p.hire, ransom: p.ransom,
    currency, gmOverride: false,
    notes: `T${tierRoman} ${bracket} ${entry?.lineage ?? ""} — bounty ${p.bounty}${p.hire != null ? ` / hire ${p.hire}` : ""} marks; credited to the pool matching the method (default ${currency})`
  };
  const cur = rfi.price ?? null;
  if (!cur || cur.bounty !== price.bounty || cur.hire !== price.hire || cur.currency !== price.currency) {
    update["flags.fourththing.rfi.actor.price"] = price;
    notes.push(`price ${cur?.bounty ?? "—"} → ${price.bounty}`);
  }

  // Defense vocabulary
  const def = sys.defenses ?? {};
  for (const k of ["resistances", "immunities", "vulnerabilities"]) {
    const n = normDefenseList(def[k]);
    if (!sameJson(n, def[k] ?? [])) update[`system.defenses.${k}`] = n;
  }
  const SYSTEM_CONDITIONS = systemConditions();
  const ci = (Array.isArray(sys.conditionImmunities) ? sys.conditionImmunities : []).filter(c => SYSTEM_CONDITIONS.size ? SYSTEM_CONDITIONS.has(c) : c !== "poisoned");
  const ciDedup = [...new Set(ci)];
  if (!sameJson(ciDedup, sys.conditionImmunities ?? [])) update["system.conditionImmunities"] = ciDedup;

  // Sephirah spelling
  if (sys.magic?.sephirah === "gevurah") update["system.magic.sephirah"] = "geburah";

  // Items: damage types
  const itemUpdates = [];
  for (const it of a.items) {
    const isys = it.system ?? {};
    if (it.type === "weapon" && isys.damage && typeof isys.damage === "object") {
      const t = String(isys.damage.type ?? "").toLowerCase(); let nt = t;
      // Flavor alone is often blank on hand-authored strikes — let the name and tags vote too.
      const hint = [isys.damage.damageFlavor, it.name, ...(Array.isArray(isys.tags) ? isys.tags : [])].filter(Boolean).join(" ");
      if (t === "energy") nt = energyByFlavor(hint).type;
      else if (t === "radiant") nt = "sephirotic";
      else if (t === "fire") nt = "thermal";
      else if (t === "physical") nt = "kinetic";
      const track = TRACK_BY_TYPE[nt] ?? "integrity";
      if (nt !== t || isys.damage.track !== track) itemUpdates.push({ _id: it.id, "system.damage.type": nt, "system.damage.track": track });
    } else if (it.type === "power" && typeof isys.damageType === "string") {
      const t = isys.damageType.toLowerCase(); let nt = t;
      if (t === "energy") nt = energyByFlavor([isys.flavor, it.name, ...(Array.isArray(isys.tags) ? isys.tags : [])].filter(Boolean).join(" ")).type;
      else if (t === "radiant") nt = "sephirotic";
      if (nt !== t) itemUpdates.push({ _id: it.id, "system.damageType": nt });
    }
  }
  return { update, itemUpdates, notes, lineage: entry?.lineage ?? "?", tier: tierRoman, bracket, bounty: price.bounty };
}

(async () => {
  if (!game.user.isGM) return ui.notifications.warn("Backfill bestiary: GM only.");
  const pricing = game.fourththing?.pricing;
  if (typeof pricing?.computeCreaturePricing !== "function") {
    return ui.notifications.error("Backfill bestiary: game.fourththing.pricing.computeCreaturePricing missing — deploy the 2026-09-04 system build and restart first.");
  }
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications.error(`Backfill bestiary: pack ${PACK_ID} not found.`);

  const folders = pack.folders;
  const under = (fid) => { let f = folders.get(fid); while (f) { if (f.name === ROOT_FOLDER) return true; f = f.folder; } return false; };
  const docs = (await pack.getDocuments()).filter(d => d.type === "npc" && under(d.folder?.id));

  const plans = [];
  for (const a of docs) {
    const pl = planActor(a, pricing);
    if (Object.keys(pl.update).length || pl.itemUpdates.length) plans.push({ a, ...pl });
  }
  const lines = plans.map(p => `  • ${p.a.name}  [${p.lineage} T${p.tier} ${p.bracket} → ${p.bounty}m]  ${Object.keys(p.update).length} field(s), ${p.itemUpdates.length} item(s)${p.notes.length ? "  — " + p.notes.join("; ") : ""}`);
  console.log(`[backfill-bestiary] ${DRY_RUN ? "DRY RUN — would update" : "UPDATING"} ${plans.length}/${docs.length} actor(s) in ${PACK_ID} / ${ROOT_FOLDER}:\n${lines.join("\n")}`);
  console.log("[backfill-bestiary] full plans:", plans.map(p => ({ name: p.a.name, update: p.update, itemUpdates: p.itemUpdates })));
  const unmapped = docs.filter(d => !ROSTER[d.name]).map(d => d.name);
  if (unmapped.length) console.warn("[backfill-bestiary] not in ROSTER (inferred or skipped):", unmapped);

  if (DRY_RUN) {
    ui.notifications.warn(`Backfill bestiary: DRY RUN — ${plans.length} of ${docs.length} actor(s) would change. See console (F12). Set DRY_RUN=false to apply.`);
    return;
  }
  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });
  let ok = 0, failed = 0;
  try {
    for (const p of plans) {
      try {
        if (Object.keys(p.update).length) await p.a.update(p.update);
        if (p.itemUpdates.length) await p.a.updateEmbeddedDocuments("Item", p.itemUpdates);
        ok++;
      } catch (e) { failed++; console.warn("[backfill-bestiary] failed", p.a.name, e); }
    }
  } finally {
    if (wasLocked) await pack.configure({ locked: true });
  }
  ui.notifications.info(`Backfill bestiary: updated ${ok}/${plans.length} actor(s)${failed ? ` (${failed} failed — see console)` : ""}.`);
})();

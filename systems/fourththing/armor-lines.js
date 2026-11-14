/**
 * ARMOR LINES — Dave's armor model (locked 2026-11-12; sim evidence ARMOR_R4/R5, run R5d).
 * --------------------------------------------------------------------------------------------------------------------
 * PURE functions only (no Foundry globals) so the math is testable offline. module.js builds plain piece descriptors
 * from an actor's items and calls computeLinesArmor(); it runs only while the world setting `fourththing.armorModel`
 * is "lines" (default "weights" = the old light/medium/heavy + Plating/Bracing/Fitting model, untouched).
 *
 *  1. Four LINES: guard-body, guard-intrigue (Guard armor), resolve-soul, resolve-mind (Resolve armor). A body armor
 *     gives ONLY its line's defense.
 *  2. Rank in a line = gate faculty − 2, clamped 0..5 (faculty ≤ 2 → untrained, gives nothing). No aptitude points.
 *     The body armor's value = round(raw × FT.ARMOR_RANK_SCALE[rank].mult) + flat (+1/+2/+3 at rank 3/4/5) — the flat
 *     lands ONCE, on the body armor's defense.
 *  3. One body armor counts (best value).
 *  4. Shield: own slot, every Path proficient, FLAT (no rank scale), Guard and/or Resolve as authored; nothing while a
 *     two-handed weapon is equipped (that rule also runs under "weights" — see isTwoHandedWeapon).
 *  5. Accessories (helm, boots, necklace, 4 rings, + worn gear + vestments): flat +N each; per-defense accessory TOTAL
 *     ≤ ceil(bestRank(defense) / 2), bestRank = highest line rank among that defense's two lines. Never rank-scaled.
 *  6. No armor penalties under "lines" (the worn −1 Intrigue checkBonus rows are ignored — ft-progression).
 */

export const ARMOR_LINES = Object.freeze({
  "guard-body":     Object.freeze({ defense: "guard",   faculty: "body",     label: "Guard-Body" }),
  "guard-intrigue": Object.freeze({ defense: "guard",   faculty: "intrigue", label: "Guard-Intrigue" }),
  "resolve-soul":   Object.freeze({ defense: "resolve", faculty: "soul",     label: "Resolve-Soul" }),
  "resolve-mind":   Object.freeze({ defense: "resolve", faculty: "mind",     label: "Resolve-Mind" })
});
export const ARMOR_LINE_SLOTS = Object.freeze(["body", "shield", "helm", "boots", "necklace", "ring"]);
/** How many pieces of each accessory slot count (best first). "worn" = other worn gear (pins, masks, lenses…): no count limit, still under the cap. */
export const ACCESSORY_SLOT_LIMITS = Object.freeze({ helm: 1, boots: 1, necklace: 1, ring: 4, worn: Infinity });
export const LINE_RANK_NAMES = Object.freeze(["Untrained", "Trained", "Proficient", "Expert", "Master", "Legendary"]);
/** Mirror of FT.ARMOR_RANK_SCALE (module.js) for offline callers; module.js passes its own table. */
export const DEFAULT_RANK_SCALE = Object.freeze({
  0: { mult: 0, flat: 0 }, 1: { mult: 0.5, flat: 0 }, 2: { mult: 1, flat: 0 },
  3: { mult: 1, flat: 1 }, 4: { mult: 1, flat: 2 }, 5: { mult: 1, flat: 3 }
});

/** Rule 2: rank = faculty − 2, clamped 0..5. */
export function lineRankFromFaculty(faculty) {
  const n = Math.floor(Number(faculty) || 0);
  return Math.max(0, Math.min(5, n - 2));
}
/** faculties = { body, intrigue, soul, mind, … } → { "guard-body": rank, … } */
export function armorLineRanks(faculties = {}) {
  const out = {};
  for (const [line, def] of Object.entries(ARMOR_LINES)) out[line] = lineRankFromFaculty(faculties?.[def.faculty]);
  return out;
}
export function bestDefenseRank(ranks, defense) {
  let best = 0;
  for (const [line, def] of Object.entries(ARMOR_LINES)) if (def.defense === defense) best = Math.max(best, Number(ranks?.[line]) || 0);
  return best;
}
/** Rule 5: per-defense accessory total cap = ceil(bestRank / 2). */
export function accessoryCap(ranks, defense) {
  return Math.ceil(bestDefenseRank(ranks, defense) / 2);
}

// ── two-handed weapons (rule 4; standing ruling, BOTH models) ──
// Tag "two-handed" / "two handed" / "twohanded" / "2h", or a weapon whose NAME is one of the two-handed families the
// sim models (sim-combat.mjs TWO_H_RE: maul, greatsword, felling axe, rifles, carbines, machine guns, the quantum staff,
// singing hammer, hammer of the first word, shotguns — but not sawed-off / egg-carton shotguns).
const TWO_H_TAG_RE = /^(two[\s_-]?handed|2h|2-h)$/i;
const TWO_H_NAME_RE = /\b(maul|greatsword|felling axe|rifle|carbine|machine gun|quantum staff|singing hammer|hammer of the first word)\b|(?<!sawed-off |egg-carton )shotgun/i;
export function isTwoHandedWeapon(w = {}) {
  const tags = Array.isArray(w.tags) ? w.tags : [];
  if (tags.some(t => TWO_H_TAG_RE.test(String(t).trim()))) return true;
  if (TWO_H_TAG_RE.test(String(w.category ?? "").trim())) return true;
  const name = String(w.name ?? "");
  return TWO_H_NAME_RE.test(name) && !/sawed-off|egg-carton/i.test(name);
}

// ── fallback inference for items not yet re-seeded with system.armorSlot / system.armorLine ──
const _lc = (a) => (Array.isArray(a) ? a : []).map(t => String(t).toLowerCase().trim());
/**
 * Slot: a declared `armorSlot` wins. Else: shield frame/tag → shield · helm/helmet/hat/hood tag → helm · footwear frame /
 * footwear|boots tag → boots · ring tag → ring · necklace/amulet/pendant tag → necklace · vestment frame/tag → necklace
 * (an accessory) · anything else → body.
 */
export function inferArmorSlot({ slot, tags, frame } = {}) {
  const s = String(slot ?? "").toLowerCase();
  if (ARMOR_LINE_SLOTS.includes(s)) return s;
  const t = _lc(tags), f = String(frame ?? "").toLowerCase();
  if (f === "shield" || t.includes("shield")) return "shield";
  if (f === "helm" || t.some(x => ["helm", "helmet", "hat", "hood", "head"].includes(x))) return "helm";
  if (f === "footwear" || t.some(x => ["footwear", "boots", "boot", "feet"].includes(x))) return "boots";
  if (f === "ring" || t.includes("ring")) return "ring";
  if (f === "necklace" || t.some(x => ["necklace", "amulet", "pendant"].includes(x))) return "necklace";
  if (f === "vestment" || t.includes("vestment")) return "necklace";
  return "body";
}
/** Worn GEAR (FT.WORN_GEAR_SLOTS) → accessory slot: ring → ring · amulet → necklace · boots → boots · mask → helm · rest → worn. */
export function gearAccessorySlot(gearSlot) {
  const s = String(gearSlot ?? "").toLowerCase();
  return ({ ring: "ring", amulet: "necklace", boots: "boots", mask: "helm" })[s] ?? "worn";
}
/**
 * Line for BODY armor: a declared `armorLine` wins. Else resolve > guard → resolve-mind when the name/tags read as a
 * scholar's garment (robe, scholar, academic, mind), otherwise resolve-soul; else Guard: heavy/medium tag → guard-body,
 * light tag → guard-intrigue, untagged → guard-body.
 */
export function inferArmorLine({ line, tags, guard = 0, resolve = 0, name = "" } = {}) {
  const l = String(line ?? "").toLowerCase();
  if (ARMOR_LINES[l]) return l;
  const t = _lc(tags);
  if ((Number(resolve) || 0) > (Number(guard) || 0)) {
    const hay = `${String(name).toLowerCase()} ${t.join(" ")}`;
    return /\b(robe|robes|scholar|academic|mind|mental)\b/.test(hay) ? "resolve-mind" : "resolve-soul";
  }
  if (t.includes("light")) return "guard-intrigue";
  return "guard-body";
}

/** The body armor's value on its line's defense (rules 2 + 3). */
export function bodyArmorValue(raw, rank, scale = DEFAULT_RANK_SCALE) {
  const r = Number(raw) || 0, k = Math.max(0, Math.min(5, Number(rank) || 0));
  if (k <= 0 || r <= 0) return 0;
  const sc = scale?.[k] ?? DEFAULT_RANK_SCALE[k];
  return Math.round(r * sc.mult) + sc.flat;
}

/**
 * The whole "lines" computation.
 *  pieces: [{ id, name, kind: "armor"|"gear", slot, line?, guard, resolve }] — EQUIPPED pieces only, slot already
 *          resolved (inferArmorSlot / gearAccessorySlot), line resolved for body pieces (inferArmorLine).
 *  ranks:  armorLineRanks(faculties). twoHanded: an equipped two-handed weapon (shield gives nothing).
 * Returns { guard, resolve, legacyEvasion: 0, breakdown[], countedIds:Set, ranks, caps, accessory:{guard,resolve} }.
 */
export function computeLinesArmor({ pieces = [], ranks = {}, twoHanded = false, scale = DEFAULT_RANK_SCALE } = {}) {
  const out = { guard: 0, resolve: 0, legacyEvasion: 0, breakdown: [], countedIds: new Set(), ranks: { ...ranks },
    caps: { guard: accessoryCap(ranks, "guard"), resolve: accessoryCap(ranks, "resolve") }, accessory: { guard: 0, resolve: 0 } };
  const notCounted = (p, why) => out.breakdown.push({ item: `${p.name} (not counted: ${why})`, skill: null, rank: 0, guard: 0, resolve: 0, slot: p.slot });

  // Rule 3 — one body armor: the best value on its own line.
  // FLAT body armor (Dave 2026-11-13, the Control Suit): `flat` pieces give their listed Guard AND Resolve as-is — no line,
  // no rank gate. Super-rare story armor only; it is still the one body armor (best total wins the slot).
  const bodies = pieces.filter(p => p.slot === "body").map(p => {
    if (p.flat) { const g = Number(p.guard) || 0, r = Number(p.resolve) || 0; return { p, line: "flat", def: null, rank: null, v: g + r, g, r, flat: true }; }
    const line = ARMOR_LINES[p.line] ? p.line : inferArmorLine(p);
    const def = ARMOR_LINES[line].defense, rank = Number(ranks[line]) || 0;
    const v = bodyArmorValue(def === "guard" ? p.guard : p.resolve, rank, scale);
    return { p, line, def, rank, v };
  }).sort((a, b) => b.v - a.v);
  bodies.forEach((b, i) => {
    if (i > 0) return notCounted(b.p, "one body armor");
    out.countedIds.add(b.p.id);
    if (b.flat) { out.guard += b.g; out.resolve += b.r; out.breakdown.push({ item: b.p.name, skill: null, rank: null, slot: "body", line: "flat", guard: b.g, resolve: b.r }); return; }
    out[b.def] += b.v;
    out.breakdown.push({ item: b.p.name, skill: b.line, rank: b.rank, slot: "body", line: b.line,
      guard: b.def === "guard" ? b.v : 0, resolve: b.def === "resolve" ? b.v : 0 });
  });

  // Rule 4 — shield: flat, best one; nothing under a two-handed weapon.
  const shields = pieces.filter(p => p.slot === "shield")
    .sort((a, b) => ((Number(b.guard) || 0) + (Number(b.resolve) || 0)) - ((Number(a.guard) || 0) + (Number(a.resolve) || 0)));
  shields.forEach((s, i) => {
    if (i > 0) return notCounted(s, "one shield");
    if (twoHanded) return out.breakdown.push({ item: `${s.name} (no benefit: two-handed weapon)`, skill: null, rank: null, slot: "shield", guard: 0, resolve: 0, twoHanded: true });
    out.countedIds.add(s.id);
    const g = Number(s.guard) || 0, r = Number(s.resolve) || 0;
    out.guard += g; out.resolve += r;
    out.breakdown.push({ item: s.name, skill: null, rank: null, slot: "shield", guard: g, resolve: r });
  });

  // Rule 5 — accessories: per-slot counts (rings best four), then the per-defense half-rank cap on the TOTAL.
  const acc = { guard: 0, resolve: 0 };
  const accRows = [];
  for (const [slot, limit] of Object.entries(ACCESSORY_SLOT_LIMITS)) {
    const inSlot = pieces.filter(p => p.slot === slot)
      .sort((a, b) => ((Number(b.guard) || 0) + (Number(b.resolve) || 0)) - ((Number(a.guard) || 0) + (Number(a.resolve) || 0)));
    inSlot.forEach((a, i) => {
      if (i >= limit) return notCounted(a, slot === "ring" ? "four rings" : `one ${slot}`);
      out.countedIds.add(a.id);
      const g = Number(a.guard) || 0, r = Number(a.resolve) || 0;
      acc.guard += g; acc.resolve += r;
      accRows.push({ item: a.name, skill: null, rank: null, slot, accessory: true, worn: a.kind === "gear", guard: g, resolve: r });
    });
  }
  out.breakdown.push(...accRows);
  for (const d of ["guard", "resolve"]) {
    const capped = acc[d] > out.caps[d] ? out.caps[d] : acc[d];
    out.accessory[d] = capped;
    out[d] += capped;
    if (capped !== acc[d]) out.breakdown.push({ item: `accessory cap (${d}: ${acc[d]} → ${capped}, half your best ${d === "guard" ? "Guard" : "Resolve"} line rank)`,
      skill: null, rank: null, slot: "cap", guard: d === "guard" ? capped - acc[d] : 0, resolve: d === "resolve" ? capped - acc[d] : 0 });
  }
  return out;
}

/** One line of text per line ("Guard-Body Expert (Body 5)") — the sheet tooltip + chargen copy. */
export function describeLineRanks(ranks, faculties = {}, { trainedOnly = false } = {}) {
  return Object.entries(ARMOR_LINES)
    .filter(([line]) => !trainedOnly || (Number(ranks?.[line]) || 0) >= 1)
    .map(([line, def]) => {
      const k = Number(ranks?.[line]) || 0;
      const fac = def.faculty.charAt(0).toUpperCase() + def.faculty.slice(1);
      return `${def.label} ${LINE_RANK_NAMES[k]} (${fac} ${Number(faculties?.[def.faculty]) || 0})`;
    });
}

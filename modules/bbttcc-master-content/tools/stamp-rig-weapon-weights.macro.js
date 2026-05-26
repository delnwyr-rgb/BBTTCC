// BBTTCC — Stamp rig-weapon WEIGHT tags (light / medium / heavy)
// ─────────────────────────────────────────────────────────────────────────────
// 2026-05-24. The rig heat system now scales heat-per-shot by weapon weight:
//   light / untagged → +1   ·   medium → +2   ·   heavy → +3
// (See fourththing module.js ftOpenEngageDialog heat bump.) Weight lives in the
// item's `system.tags` array. This macro stamps the canonical weight onto every
// rig-weapon, in BOTH places it can live:
//   1. the source compendium  (bbttcc-master-content.items)  — future builds
//   2. embedded copies already on world rig actors           — current play
// because pack edits do NOT propagate to existing actor copies.
//
// A rig-weapon is any Item with flags.fourththing.rigGear.subtype === "rig-weapon"
// (or an exact name in WEIGHT_MAP, as a backstop if the flag is missing).
//
// Idempotent: re-running replaces any existing weight tag and leaves other tags
// untouched; items already correct are reported as "already OK". Set DRY_RUN to
// preview without writing. Paste into a Foundry Script Macro, execute as GM.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }
const DRY_RUN = false;

// Canonical weight per named rig-weapon. Edit here to retune — one word each.
const WEIGHT_MAP = {
  "Twin Autocannons": "light",   // baseline gun — also the Hexmobile / Light Skiff weapon
  "Resonance Howler":  "medium",
  "Phase Disruptor":   "medium",
  "Plasma Lance":      "heavy",  // heavy / flagship only
  "Mortar Battery":    "heavy"   // siege artillery
};

const WEIGHTS = ["light", "medium", "heavy"];

// ── helpers ────────────────────────────────────────────────────────────────
const isRigWeapon = (item) =>
  item?.flags?.fourththing?.rigGear?.subtype === "rig-weapon" ||
  Object.prototype.hasOwnProperty.call(WEIGHT_MAP, item?.name ?? "");

// tags can be a real array (template default) or a stray comma-string (imports).
const readTags = (item) => {
  const t = item?.system?.tags;
  if (Array.isArray(t)) return t.slice();
  if (typeof t === "string") return t.split(",").map(s => s.trim()).filter(Boolean);
  return [];
};

// Dice-average damage, used only to bucket rig-weapons NOT in WEIGHT_MAP.
const avgDamage = (item) => {
  const sys = item?.system ?? {};
  let formula = sys.damage?.formula || "";
  if (!formula && sys.damageRoll?.op === "damage") {
    const n = Number(sys.damageRoll.number) || 0, d = String(sys.damageRoll.die || "");
    if (n && d) formula = `${n}${d}`;
  }
  if (!formula) return null;
  let total = 0, matched = false;
  for (const m of String(formula).matchAll(/(\d+)\s*d\s*(\d+)/gi)) {
    total += Number(m[1]) * (Number(m[2]) + 1) / 2; matched = true;
  }
  return matched ? total : null;
};

// Decide weight: explicit map → damage heuristic → safe default (light).
const decideWeight = (item) => {
  if (Object.prototype.hasOwnProperty.call(WEIGHT_MAP, item.name)) {
    return { weight: WEIGHT_MAP[item.name], how: "map" };
  }
  const avg = avgDamage(item);
  if (avg != null) {
    const weight = avg <= 7 ? "light" : avg <= 13 ? "medium" : "heavy";
    return { weight, how: `heuristic(avg≈${avg.toFixed(1)})` };
  }
  return { weight: "light", how: "default" };
};

// Returns { changed, weight, how, before, after } — pure, no writes.
const planTags = (item) => {
  const { weight, how } = decideWeight(item);
  const before = readTags(item);
  const kept = before.filter(t => !WEIGHTS.includes(String(t).toLowerCase()));
  const after = [...kept, weight];
  // changed if the weight tag is new/different, or we normalized a string field
  const hadCorrect = before.some(t => String(t).toLowerCase() === weight)
                  && before.filter(t => WEIGHTS.includes(String(t).toLowerCase())).length === 1
                  && Array.isArray(item?.system?.tags);
  return { changed: !hadCorrect, weight, how, before, after };
};

const report = {
  pack:  { stamped: [], alreadyOk: 0, errors: [] },
  actor: { stamped: [], alreadyOk: 0, errors: [] },
  unlocked: new Set()
};

// ── 1. compendium pass ───────────────────────────────────────────────────────
for (const pack of game.packs.values()) {
  if (pack.documentName !== "Item") continue;
  let docs;
  try { docs = await pack.getDocuments(); }
  catch (e) { console.warn("[rig-weight] could not read pack", pack.collection, e); continue; }
  for (const doc of docs) {
    if (!isRigWeapon(doc)) continue;
    const plan = planTags(doc);
    if (!plan.changed) { report.pack.alreadyOk++; continue; }
    const tag = `${doc.name} [${plan.weight}] ${pack.collection} (${plan.how})`;
    if (DRY_RUN) { report.pack.stamped.push(`[dry] ${tag}`); continue; }
    try {
      if (pack.locked) { await pack.configure({ locked: false }); report.unlocked.add(pack); }
      await doc.update({ "system.tags": plan.after });
      report.pack.stamped.push(tag);
    } catch (e) { report.pack.errors.push(`${doc.name} (${pack.collection}): ${e.message}`); }
  }
}

// ── 2. world-actor pass (embedded copies) ────────────────────────────────────
for (const actor of game.actors ?? []) {
  for (const item of actor.items ?? []) {
    if (!isRigWeapon(item)) continue;
    const plan = planTags(item);
    if (!plan.changed) { report.actor.alreadyOk++; continue; }
    const tag = `${actor.name} ▸ ${item.name} [${plan.weight}] (${plan.how})`;
    if (DRY_RUN) { report.actor.stamped.push(`[dry] ${tag}`); continue; }
    try {
      await item.update({ "system.tags": plan.after });
      report.actor.stamped.push(tag);
    } catch (e) { report.actor.errors.push(`${actor.name} ▸ ${item.name}: ${e.message}`); }
  }
}

// re-lock packs we opened
for (const pack of report.unlocked) {
  try { await pack.configure({ locked: true }); } catch (_e) { /* leave open */ }
}

// ── summary ──────────────────────────────────────────────────────────────────
const lines = [
  `=== Stamp Rig-Weapon Weights (${DRY_RUN ? "DRY-RUN" : "APPLIED"}) ===`,
  `Compendium:  ${report.pack.stamped.length} stamped · ${report.pack.alreadyOk} already OK · ${report.pack.errors.length} error(s)`,
  `World rigs:  ${report.actor.stamped.length} stamped · ${report.actor.alreadyOk} already OK · ${report.actor.errors.length} error(s)`,
  ...(report.pack.stamped.length  ? ["", "Compendium stamped:", ...report.pack.stamped.map(s => `  ✓ ${s}`)] : []),
  ...(report.actor.stamped.length ? ["", "World-rig copies stamped:", ...report.actor.stamped.map(s => `  ✓ ${s}`)] : []),
  ...((report.pack.errors.length || report.actor.errors.length)
      ? ["", "Errors:", ...[...report.pack.errors, ...report.actor.errors].map(s => `  ✗ ${s}`)] : [])
];
console.log(lines.join("\n"));
ChatMessage.create({
  user: game.user.id,
  whisper: [game.user.id],
  content: `<pre style="font-size:0.76rem;white-space:pre-wrap">${lines.join("\n")}</pre>`
});
ui.notifications.info(`Rig-weapon weights: ${report.pack.stamped.length} pack + ${report.actor.stamped.length} rig copies stamped. See console/chat.`);
})();

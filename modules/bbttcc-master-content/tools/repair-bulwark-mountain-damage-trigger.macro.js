/**
 * Ensure the Bulwark Mountain L1 "Inverted Foundation" feat on every
 * Bulwark/Mountain actor carries the on-damage-taken → +1 Ruin Charge
 * trigger.
 *
 * 2026-05-20. Same pattern as repair-shadow-courier-pace-trigger:
 * stamp-triggers-pilot.macro.js writes the trigger to the compendium
 * pack, but actor copies created before that stamp don't have it.
 * Symptom: a Mountain Bulwark gets hit for 6+ damage and no Ruin
 * Charge accrues because collectTriggers finds no on-damage-taken
 * entry on the embedded item.
 *
 * Canonical trigger (from stamp-triggers-pilot.macro.js):
 *   event: "on-damage-taken"
 *   predicate: { amountMin: 5 }
 *   limit: { window: "scene", uses: 3 }
 *   effect: grant-resource → +1 ruin-charge to self
 *
 * Idempotent. Safe to re-run.
 *
 * Usage: paste into a Foundry Script Macro and execute as GM.
 */
(async () => {
if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

const CANONICAL_TRIGGER = {
  event: "on-damage-taken",
  predicate: { amountMin: 5 },
  limit:     { window: "scene", uses: 3 },
  effect:    { kind: "grant-resource", args: { resource: "ruin-charge", amount: 1, target: "self" } }
};

// Match the canonical T1 feat name. Common variants accepted.
const INV_FOUND_NAME_RE = /Inverted\s*Foundation/i;
const BULWARK_CLASS_RE  = /^bulwark$/i;
const MOUNTAIN_SUB_RE   = /^bbttcc-bulwark-mountain/i;

const report = { actorsScanned: 0, stamped: 0, alreadyOk: 0, notMountain: [], notFound: [], errors: [] };

function hasOnDamageTakenRuinTrigger(item) {
  const triggers = item?.flags?.fourththing?.triggers;
  if (!Array.isArray(triggers)) return false;
  return triggers.some(t =>
    t?.event === "on-damage-taken" &&
    t?.effect?.kind === "grant-resource" &&
    t?.effect?.args?.resource === "ruin-charge"
  );
}

for (const actor of game.actors ?? []) {
  if (actor?.type !== "character" && actor?.type !== "npc") continue;
  const classItem = actor.items?.find?.(i =>
    i.type === "class" && BULWARK_CLASS_RE.test(i.system?.identifier ?? "")
  );
  if (!classItem) continue;  // not a Bulwark
  report.actorsScanned++;

  const subclassItem = actor.items?.find?.(i =>
    i.type === "subclass" && MOUNTAIN_SUB_RE.test(i.system?.identifier ?? "")
  );
  if (!subclassItem) {
    report.notMountain.push(actor.name);
    continue;  // Bulwark but not Mountain doctrine — skip
  }

  const invFound = actor.items?.find?.(i => INV_FOUND_NAME_RE.test(i.name ?? ""));
  if (!invFound) { report.notFound.push(actor.name); continue; }

  if (hasOnDamageTakenRuinTrigger(invFound)) {
    report.alreadyOk++;
    continue;
  }

  try {
    const existing = invFound.flags?.fourththing?.triggers;
    const next = Array.isArray(existing) ? [...existing, CANONICAL_TRIGGER] : [CANONICAL_TRIGGER];
    await invFound.setFlag("fourththing", "triggers", next);
    report.stamped++;
    console.log(`[Mountain damage trigger repair] ${actor.name} → stamped on "${invFound.name}"`);
  } catch (e) {
    report.errors.push({ actor: actor.name, error: e.message });
  }
}

const summary = [
  `Bulwark / Mountain — Inverted Foundation trigger repair`,
  `Scanned:        ${report.actorsScanned} Bulwark actor(s)`,
  `Stamped:        ${report.stamped}`,
  `Already OK:     ${report.alreadyOk}`,
  `Not Mountain:   ${report.notMountain.length}${report.notMountain.length ? ` (${report.notMountain.join(", ")})` : ""}`,
  `Missing Inverted Foundation: ${report.notFound.length}${report.notFound.length ? ` (${report.notFound.join(", ")})` : ""}`,
  `Errors:         ${report.errors.length}`
];
console.log(summary.join("\n"));
if (report.errors.length) console.warn(report.errors);
ui.notifications.info(`Mountain damage-trigger repair: ${report.stamped} stamped, ${report.alreadyOk} already OK. See console.`);
})();

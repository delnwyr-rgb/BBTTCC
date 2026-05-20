/**
 * Ensure the Shadow Courier "Liminal Operator" T1 feat on every SC actor
 * carries the on-move → +1 Pace trigger.
 *
 * 2026-05-20. stamp-triggers-pilot.macro.js writes the trigger to the
 * compendium pack. But actor copies created BEFORE that stamp don't get
 * the trigger — their embedded items are stale snapshots. Symptom: moving
 * 30+ ft does nothing because collectTriggers finds no on-move entry.
 *
 * This macro walks every world actor with the Shadow Courier class,
 * finds the Liminal Operator item on their sheet (by name OR by
 * system.identifier prefix), and stamps the trigger directly on the
 * actor's copy. Idempotent — re-running is safe.
 *
 * Usage: paste into a Foundry Script Macro and execute as GM.
 */
(async () => {
if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

const CANONICAL_TRIGGER = {
  event: "on-move",
  predicate: { amountMin: 30 },
  limit:     { window: "turn", uses: 1 },
  effect:    { kind: "grant-resource", args: { resource: "pace", amount: 1, target: "self" } }
};

// Match either the canonical T1 name or any variant of "Liminal Operator".
const LIMINAL_NAME_RE = /Liminal\s*Operator/i;
const SC_CLASS_ID_RE  = /^shadow.courier$/i;

const report = { actorsScanned: 0, stamped: 0, alreadyOk: 0, notFound: [], errors: [] };

function hasOnMovePaceTrigger(item) {
  const triggers = item?.flags?.fourththing?.triggers;
  if (!Array.isArray(triggers)) return false;
  return triggers.some(t =>
    t?.event === "on-move" &&
    t?.effect?.kind === "grant-resource" &&
    t?.effect?.args?.resource === "pace"
  );
}

for (const actor of game.actors ?? []) {
  if (actor?.type !== "character" && actor?.type !== "npc") continue;
  const classItem = actor.items?.find?.(i =>
    i.type === "class" && SC_CLASS_ID_RE.test(i.system?.identifier ?? "")
  );
  if (!classItem) continue;  // not a Shadow Courier
  report.actorsScanned++;

  const limOp = actor.items?.find?.(i => LIMINAL_NAME_RE.test(i.name ?? ""));
  if (!limOp) { report.notFound.push(actor.name); continue; }

  if (hasOnMovePaceTrigger(limOp)) {
    report.alreadyOk++;
    continue;
  }

  try {
    const existing = limOp.flags?.fourththing?.triggers;
    const next = Array.isArray(existing) ? [...existing, CANONICAL_TRIGGER] : [CANONICAL_TRIGGER];
    await limOp.setFlag("fourththing", "triggers", next);
    report.stamped++;
    console.log(`[SC pace trigger repair] ${actor.name} → stamped on "${limOp.name}"`);
  } catch (e) {
    report.errors.push({ actor: actor.name, error: e.message });
  }
}

const summary = [
  `Shadow Courier — Pace trigger repair`,
  `Scanned:    ${report.actorsScanned} SC actor(s)`,
  `Stamped:    ${report.stamped}`,
  `Already OK: ${report.alreadyOk}`,
  `Missing Liminal Operator: ${report.notFound.length} ${report.notFound.length ? `(${report.notFound.join(", ")})` : ""}`,
  `Errors:     ${report.errors.length}`
];
console.log(summary.join("\n"));
if (report.errors.length) console.warn(report.errors);
ui.notifications.info(`SC Pace trigger repair: ${report.stamped} stamped, ${report.alreadyOk} already OK. See console.`);
})();

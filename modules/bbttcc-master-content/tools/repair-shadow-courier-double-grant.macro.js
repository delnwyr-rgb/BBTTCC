/**
 * Repair Shadow Courier route double-grant on existing actors.
 *
 * 2026-05-20. Before today's fix in bbttcc-auto-link/character-wizard.js,
 * collectLevelOneGrants walked the SC class item's level-1 ItemGrant
 * advancement and stamped ALL three route L1 abilities (Wayfarer / Black
 * Stair / Last Mile) on every new SC character regardless of doctrine
 * pick. This macro walks every actor in the world and removes route L1
 * items that don't match the actor's picked doctrine (subclass).
 *
 * Idempotent — safe to re-run. Reports what it removed.
 *
 * Usage: paste into a Foundry Script Macro and execute as GM.
 */
if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

const SC_CLASS_ID_RE   = /^shadow.courier$/i;
const SC_SUBCLASS_RE   = /^bbttcc-shadow-courier/i;
const ROUTE_PREFIXES = ["Wayfarer", "Black Stair", "Last Mile"];

function routeForSubclassId(id) {
  const s = String(id || "");
  if (/wayfarer-tongue/.test(s)) return "Wayfarer";
  if (/black-stair/.test(s))     return "Black Stair";
  if (/last-mile/.test(s))       return "Last Mile";
  return null;
}

function isRouteSpecificItem(name) {
  const n = String(name || "");
  return ROUTE_PREFIXES.some(p => n.startsWith(p + " "));
}

const report = { actorsScanned: 0, actorsRepaired: 0, perActor: [], skipped: [] };

for (const actor of game.actors ?? []) {
  if (actor?.type !== "character" && actor?.type !== "npc") continue;
  report.actorsScanned++;

  const classItem = actor.items?.find?.(i =>
    i.type === "class" && SC_CLASS_ID_RE.test(i.system?.identifier ?? "")
  );
  if (!classItem) continue;  // not a Shadow Courier

  const subclassItem = actor.items?.find?.(i =>
    i.type === "subclass" && SC_SUBCLASS_RE.test(i.system?.identifier ?? "")
  );
  const route = routeForSubclassId(subclassItem?.system?.identifier);
  if (!route) {
    report.skipped.push({ actor: actor.name, reason: "no doctrine picked" });
    continue;
  }

  // Find items whose names start with a different route's prefix.
  const wrongRouteItems = (actor.items?.contents || actor.items || []).filter(it => {
    if (!isRouteSpecificItem(it.name)) return false;
    return !String(it.name).startsWith(route + " ");
  });
  if (!wrongRouteItems.length) continue;

  try {
    const idsToDelete = wrongRouteItems.map(i => i.id);
    await actor.deleteEmbeddedDocuments("Item", idsToDelete);
    report.actorsRepaired++;
    report.perActor.push({
      actor: actor.name,
      route,
      removed: wrongRouteItems.map(i => i.name)
    });
  } catch (e) {
    report.skipped.push({ actor: actor.name, reason: e.message });
  }
}

console.group("Shadow Courier — Route double-grant repair");
console.table(report.perActor.map(r => ({
  Actor: r.actor,
  Route: r.route,
  Removed: r.removed.join(", ")
})));
if (report.skipped.length) console.warn("Skipped:", report.skipped);
console.log(`Scanned ${report.actorsScanned} actors · Repaired ${report.actorsRepaired} · Skipped ${report.skipped.length}`);
console.groupEnd();

ui.notifications.info(`SC route repair: scanned ${report.actorsScanned}, repaired ${report.actorsRepaired}. See console.`);

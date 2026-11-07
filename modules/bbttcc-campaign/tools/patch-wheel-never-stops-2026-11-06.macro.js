/*
 * patch-wheel-never-stops-2026-11-06.macro.js — Round 4: The Wheel Never Stops promised a bonus attack or Dash and only banked a reroll. Moves its trigger to the
 * bonus-strike-or-dash kind, with extra uses at 1 Surge (limit.overflowSurge), on every world actor that owns it and on the ancestries pack item.
 * Ember Bad Eden. globalThis.__wheelDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__wheelDry !== false, report = { DRY_RUN, actors: [], pack: null };
  const EFFECT = { kind: "bonus-strike-or-dash", args: { reroll: true, minMoveFt: 10, note: "The Wheel Never Stops" } };
  const patched = (item) => {
    const triggers = foundry.utils.deepClone(item.flags?.fourththing?.triggers ?? []); let hit = false;
    for (const t of triggers) if (t.event === "on-move" && /Wheel Never Stops/.test(t.effect?.args?.note ?? "") && (t.effect?.kind === "bank-reroll" || t.limit?.overflowSurge !== 1)) { t.effect = foundry.utils.deepClone(EFFECT); t.limit = { ...(t.limit ?? {}), overflowSurge: 1 }; hit = true; }
    return hit ? triggers : null;
  };
  for (const a of game.actors) for (const it of a.items) {
    if (it.flags?.bbttcc?.feature !== "the_wheel_never_stops") continue;
    const t = patched(it); if (!t) continue;
    report.actors.push(a.name);
    if (!DRY_RUN) await it.update({ "flags.fourththing.triggers": t });
  }
  const pack = game.packs.get("bbttcc-master-content.ancestries");
  const doc = await pack?.getDocument("jpagUy0moeZlFgkX");
  const t = doc && patched(doc);
  report.pack = t ? "needs patch" : (doc ? "already patched" : "not found");
  if (!DRY_RUN && t) {
    const locked = pack.locked;
    if (locked) await pack.configure({ locked: false });
    await doc.update({ "flags.fourththing.triggers": t });
    if (locked) await pack.configure({ locked: true });
    report.pack = "patched";
  }
  console.log("WHEELPATCH " + JSON.stringify(report));
  ui.notifications.info(`Wheel patch: ${DRY_RUN ? "dry run" : "applied"}, ${report.actors.length} actor(s), pack ${report.pack}.`);
})();

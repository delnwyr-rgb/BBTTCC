/*
 * patch-kt-drax-text-2026-11-06.macro.js — Dave's beat polish, 2026-11-06: Drax Calder's welcome is rewritten; the Gruff Men With Coffee close stays at the end.
 * Ember Bad Eden. globalThis.__ktDraxDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__ktDraxDry !== false;
  const C = game.bbttcc.api.campaign; const id = C.getActiveCampaignId(); const c = C.getCampaign(id);
  const beats = foundry.utils.deepClone(c.beats); const b = beats.find(x => x.id === "khezek_tor_drax_welcome");
  const KEEP = "Gruff Men With Coffee.";
  const NEW = [
    "Drax Calder doesn't shake hands. That would require him to put something down, and also stop moving.",
    "Drax is a very busy person.",
    "\"New watch huh,\" he grunts. It's a statement, not a question.",
    "You watch him as he pores over detailed information on every aspect of the mine, its personnel, its shipments, its schedules.",
    "It seems, almost, like a ritual. Designed to make sure the world works the way it needs to.",
    "Chalk marks streak the wall behind him - the Khezek-Tor ledger scratched into living rock.",
    "Somewhere, something settles. In a satisfied way.",
    "\"The Mine's getting to know you. Good.\"",
    "Suddenly, in your hands is a mug of tar that Drax seems to think is coffee.",
    "\"Glad you stopped by. It's quiet now. Good time for a visit. Still new though. Stay off the lifts. Because some of them incorrectly do the opposite at the moment.\""
  ].join("\n\n");
  const at = b.description.indexOf(KEEP);
  if (at < 0) throw new Error("close not found");
  const next = `${NEW}\n\n${b.description.slice(at)}`;
  const changed = next !== b.description;
  if (changed) b.description = next;
  if (!DRY_RUN && changed) await C.saveCampaign(id, { ...c, beats });
  console.log("KTDRAX " + JSON.stringify({ DRY_RUN, changed }));
})();

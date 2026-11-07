/*
 * patch-kt-drax-text-2026-11-06.macro.js — Dave's beat polish, 2026-11-06: Drax Calder's welcome is rewritten; the Gruff Men With Coffee close stays at the end. The Tar's second paragraph ends on Dave's line.
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
  let changed = next !== b.description;
  if (changed) b.description = next;
  const tar = beats.find(x => x.id === "rc_drax_tar");
  const TAR_OLD = "That's the tar. Or it's the mine deciding to know you a little early.", TAR_NEW = "That's the tar. It has to be. Yeah.";
  if (tar?.description?.includes(TAR_OLD)) { tar.description = tar.description.replace(TAR_OLD, TAR_NEW); changed = true; }
  // The Tar's "Ask about the chalk marks" dropped the table back at the cookline without the answer.
  const chalk = (tar?.choices || []).find(x => /^Ask about the chalk marks/.test(String(x?.label || "")));
  if (chalk && chalk.next !== "kt_drax_answer_chalk") { chalk.next = "kt_drax_answer_chalk"; changed = true; }
  if (!DRY_RUN && changed) await C.saveCampaign(id, { ...c, beats });
  console.log("KTDRAX " + JSON.stringify({ DRY_RUN, changed }));
})();

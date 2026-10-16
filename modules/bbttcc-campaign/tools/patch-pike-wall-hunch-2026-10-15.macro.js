/* patch-pike-wall-hunch-2026-10-15.macro.js — Pike's East Wall outcome lines become his HUNCH, not a finding.
 *  Dave (2026-10-15): "the Wall results, even the failure, seem to indicate the players know the blast came
 *  from KT — how, if they failed at the wall, haven't talked to Plumb?" The Cough's origin is common knowledge
 *  (Greeley, Tamsin, Etta); the WALL's lean being the mountain's doing is proven only by the Wall's secret,
 *  Read It (ok) or Plumb's relay. Three Pike lines asserted it as fact; now they say "my money says".
 *  Idempotent (text guards); DRY_RUN default true; backs up `campaigns`. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;
  const swap = (id, from, to) => {
    const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: NOT FOUND`);
    const cur = String(b.description || "");
    if (cur.includes(to)) return report.push(`· ok ${id}: already a hunch`);
    if (!cur.includes(from)) return report.push(`⚠ ${id}: expected text not found — left alone`);
    b.description = cur.replace(from, to); changes++; report.push(`✚ ${id}: Pike's line → hunch`);
  };
  swap("allesh_gilliam_east_wall_success",
    "But fixing a symptom is not the same as meeting the cause, and the cause lives under a mountain that's been tired lately. Someday, someone should go ask it what it's tired of.",
    "But fixing a symptom is not the same as meeting the cause, and my money says the cause is under a mountain that's been tired lately. That's a hunch, not a finding. Someday, someone should go ask it what it's tired of — and bring me something I can write down.");
  swap("allesh_gilliam_east_wall_failure",
    "For what it's worth: the wall didn't beat you. Whatever leaned on it first did. That thing's still out there, under Khezek Tor, being someone's future problem. Possibly yours.",
    "For what it's worth: the wall didn't beat you. Whatever leaned on it first did. My money says that thing's under Khezek Tor, being someone's future problem. Possibly yours. Prove me wrong; I'd enjoy it.");
  swap("ag_east_wall_holds",
    "The wall holds. The lean stays. The cause is still under a mountain that's been tired lately.",
    "The wall holds. The lean stays. Pike's money is still on the mountain, and Pike's money is not proof.");
  console.log(`[patch-pike-wall-hunch] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Pike hunch patch DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Pike hunch patch: nothing to do.");
  try {
    (foundry.utils.saveDataToFile ?? saveDataToFile)(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-pike-hunch-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Pike hunch patch APPLIED: ${changes} change(s). Pike's money is not proof.`);
})();

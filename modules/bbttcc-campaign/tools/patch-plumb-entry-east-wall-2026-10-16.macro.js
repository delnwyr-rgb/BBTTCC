/* patch-plumb-entry-east-wall-2026-10-16.macro.js — "GO GET PLUMB" lives on the EAST WALL menu (Dave, 2026-10-16):
 *  "We don't have our 'go get Plumb' choice from the East Wall menu, which is the time at which the players get the
 *   letter with the wax seal telling Plumb not to do anything — and then they bring him out and he solves the East
 *   Gate issue."
 *
 *  patch-aldous-plumb-argument (10-15) hung the entry row off Pike's hub (allesh_gilliam_introduction_to_hq). Wrong
 *  door: the argument belongs to the wall. This macro
 *    - removes "Go talk to Aldous Plumb" from the hub,
 *    - adds "Go get Plumb — the Architect should see this" to allesh_gilliam_the_east_wall_intro (before the tally),
 *      hidden once ag_plumb_to_the_wall has played,
 *    - points the chain's walk-away exits (argument / drawings / bluster / cracks / not_yet) back at the East Wall
 *      menu instead of the hub. ag_plumb_to_the_wall keeps "Back to Pike" — once the wall has spoken, Pike is next.
 *  Idempotent; DRY_RUN default true; backs up `campaigns`. GM only.
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
  const HUB = "allesh_gilliam_introduction_to_hq", WALL = "allesh_gilliam_the_east_wall_intro", ARG = "ag_plumb_argument";

  // 1. off the hub
  {
    const b = byId.get(HUB);
    if (!b) report.push(`⚠ ${HUB}: NOT FOUND`);
    else {
      const i = (b.choices || []).findIndex(c => c?.next === ARG);
      if (i >= 0) { b.choices.splice(i, 1); changes++; report.push("✚ hub: 'Go talk to Aldous Plumb' removed"); }
      else report.push("· ok hub: no Plumb row");
    }
  }
  // 2. onto the East Wall menu
  {
    const b = byId.get(WALL);
    if (!b) report.push(`⚠ ${WALL}: NOT FOUND`);
    else {
      b.choices = Array.isArray(b.choices) ? b.choices : [];
      if (!b.choices.some(c => c?.next === ARG)) {
        const row = { label: "Go get Plumb — the Architect should see this", next: ARG,
          description: "The town's Structural Authority (from Canada) calls this cosmetic. His office is across town. Walk over and bring him out here.",
          checkStat: "", checkDC: 0, failNext: "", requires: [{ beatMark: "ag_plumb_to_the_wall", not: true }] };
        const i = b.choices.findIndex(c => /tally the swings/i.test(String(c?.label || "")));
        b.choices.splice(i >= 0 ? i : b.choices.length, 0, row); changes++; report.push("✚ East Wall: '+Go get Plumb — the Architect should see this' (before the tally; hidden once he has been to the wall)");
      } else report.push("· ok East Wall: Plumb row already there");
    }
  }
  // 3. walk-away exits return to the wall, not the hub
  for (const [id, labelRe] of [[ARG, /^leave him to it( — back to the wall)?$/i], ["ag_plumb_drawings", /^(leave|back to the wall)$/i], ["ag_plumb_bluster", /^leave him to it( — back to the wall)?$/i], ["ag_plumb_cracks", /^we'll come back\.?( back to the wall\.)?$/i], ["ag_plumb_not_yet", /^(leave|back to the wall)$/i]]) {
    const b = byId.get(id);
    if (!b) { report.push(`⚠ ${id}: NOT FOUND`); continue; }
    const c = (b.choices || []).find(c => labelRe.test(String(c?.label || "").trim()));
    if (!c) { report.push(`⚠ ${id}: exit row not found`); continue; }
    if (c.next === HUB) { c.next = WALL; c.label = c.label.replace(/^Leave$/i, "Back to the wall").replace(/^Leave him to it$/i, "Leave him to it — back to the wall").replace(/^We'll come back\.?$/i, "We'll come back. Back to the wall."); changes++; report.push(`✚ ${id}: exit → East Wall menu`); }
    else report.push(`· ok ${id}: exit already → ${c.next}`);
  }

  console.log(`[patch-plumb-entry-east-wall] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Plumb entry patch DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Plumb entry patch: nothing to do.");
  try {
    (foundry.utils.saveDataToFile ?? saveDataToFile)(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-plumb-entry-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Plumb entry patch APPLIED: ${changes} change(s). The Architect is fetched from the wall now.`);
})();

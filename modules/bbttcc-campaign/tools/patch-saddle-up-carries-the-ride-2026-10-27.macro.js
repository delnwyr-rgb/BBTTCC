/* patch-saddle-up-carries-the-ride-2026-10-27.macro.js — "Saddle up" opens the Travel Console (Dave, 2026-10-27).
 *  Why: "Can you remind me the value of the saddle up beat? As I miss that about 50% of the time when running this, and
 *   since not clicking it doesn't prevent travel, it doesn't keep me from messing things up." The ride beats carried
 *   worldEffects.openTravel, which opens the console WITH the window (module.js stage direction), so the Saddle-up choice
 *   (next: "") only closed the window — and a window left open sat on screen for the whole ride.
 *  For every beat with worldEffects.openTravel AND a choice labelled "…Saddle up…": the openTravel block moves onto that
 *   choice (choice.openTravel — module.js _choiceOpenTravel opens the console when THAT choice is picked) and leaves the
 *   beat's worldEffects. "Actually — back…" exits no longer start a ride. Beats with openTravel and no Saddle-up choice
 *   are left alone (reported).
 *  Needs bbttcc-campaign module.js with _choiceOpenTravel (2026-10-27) deployed FIRST. Idempotent; DRY_RUN default true;
 *  `campaigns` as a true JSON copy. GM only. Back up world settings first.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : JSON.parse(JSON.stringify(raw));
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error(`Active campaign '${cid}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const report = []; let changes = 0;

  for (const b of camp.beats) {
    const saddle = (b.choices || []).find(c => /saddle up/i.test(String(c?.label || "")));
    const ot = b.worldEffects?.openTravel;
    if (saddle?.openTravel && !ot) { report.push(`· ok ${b.id}: "${saddle.label}" carries the ride`); continue; }
    if (!ot) continue;
    if (!saddle) { report.push(`ℹ ${b.id}: openTravel but no Saddle-up choice — left alone`); continue; }
    saddle.openTravel = JSON.parse(JSON.stringify(ot));
    delete b.worldEffects.openTravel;
    changes++;
    report.push(`✎ ${b.id}: "${saddle.label}" now opens the Travel Console${ot.hexName ? ` (→ ${ot.hexName})` : ""}`);
  }

  console.log(`[saddle up 2026-10-27] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — Saddle up already carries the ride.");
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Saddle up opens the Travel Console.`);
})();

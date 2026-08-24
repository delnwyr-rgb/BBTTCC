/**
 * patch-act0-opening-flow.macro.js — GM macro/console. DRY_RUN default true.
 *
 * Owner's Act-0 order-of-operations (2026-08-23):
 *   Offices of Fates and Destinies (sayings → Wake Up) → Onboarding Flow →
 *   Offices again (Teaching Slides 1–10, the "orientation film") →
 *   Thatwards Ho Cold Open → Opening → Allesh-Gilliam Welcome.
 *
 * What this patches in the live campaign store:
 *  1. campaign.openingBeatId = the TRUE opening ("…Saying, As Above") — the
 *     Visualizer's "Run the opening beat" hero now honors it.
 *  2. The ACT 1 phaseAdvance moves OFF "Wake up" (it fired the moment the
 *     dream ended and blasted every "wants a word" invite before the town
 *     even existed) and ONTO the Avuncular Joans Sendoff Speech — the
 *     auto-invites now open when Joans releases the group into town.
 *  3. Teaching Slide 10 chains → Thatwards Ho Cold Open (it used to loop
 *     back into Wake Up from the suite's pre-onboarding ordering).
 *
 * Backup download before write, idempotent, GM only.
 */
(async () => {
  const DRY_RUN = false;
  const NS = "bbttcc-campaign";
  if (!game.user.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : campsRaw;
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = []; let changes = 0;

  // 1. True opening.
  if (camp.openingBeatId !== "fates_and_destinies_saying_as_above") {
    report.push(`· openingBeatId "${camp.openingBeatId ?? "—"}" → "fates_and_destinies_saying_as_above"`);
    camp.openingBeatId = "fates_and_destinies_saying_as_above"; changes++;
  } else report.push("· ok openingBeatId (already)");

  // 2. Move the ACT 1 advance: Wake Up → Joans Sendoff.
  const wake = byId.get("fates_and_destinies_incarnate");
  const joans = byId.get("avuncular_joans_speech");
  if (!wake || !joans) report.push("✗ wake/joans beat missing — no phase move");
  else {
    if (wake.worldEffects?.phaseAdvance) {
      delete wake.worldEffects.phaseAdvance; changes++;
      report.push("· Wake Up: phaseAdvance REMOVED");
    } else report.push("· ok Wake Up (no phaseAdvance already)");
    joans.worldEffects = joans.worldEffects || {};
    if (!joans.worldEffects.phaseAdvance || joans.worldEffects.phaseAdvance.set !== 1) {
      joans.worldEffects.phaseAdvance = { set: 1 }; changes++;
      report.push("· Joans Sendoff: phaseAdvance {set:1} ADDED — invites open after the speech");
    } else report.push("· ok Joans (phaseAdvance already)");
  }

  // 3. Slide 10 → Cold Open.
  const s10 = byId.get("fates_and_destinies_10");
  const c0 = (s10?.choices || [])[0];
  if (!s10 || !c0) report.push("✗ Teaching Slide 10 / its choice missing");
  else if (c0.next !== "thatwards_ho_cold_open") {
    report.push(`· Slide 10 next "${c0.next}" → "thatwards_ho_cold_open"`);
    c0.next = "thatwards_ho_cold_open"; changes++;
  } else report.push("· ok Slide 10 (already chains to Cold Open)");

  console.log(`[patch-act0-opening-flow] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Act-0 flow DRY RUN: ${changes} change(s) (console). Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name; a.click();
  };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-act0-flow-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Act-0 opening flow APPLIED: ${changes} change(s). Backup downloaded.`);
})();

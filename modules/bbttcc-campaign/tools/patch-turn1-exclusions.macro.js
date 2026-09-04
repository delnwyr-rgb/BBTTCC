/* patch-turn1-exclusions.macro.js — Turn 1 "meet everyone" exclusions
 * (2026-09-03, owner canon rulings from the artwork pass).
 *
 * 1) THE MUSTER doesn't exist yet. Canonically it only becomes a recruitment
 *    facility once the bandit encounter chains into the AG Militia's founding.
 *    The beat `allesh_gilliam_muster_intro` is ALREADY gated on
 *    quest_ag_town_militia being active (founded by enc_bandit_ambush_win_free)
 *    — the leak is the Welcome Round hub's direct "The Muster" choice, since
 *    routed choices ignore gates. Remove the choice; the gate does the rest.
 *    (NOTE, unchanged by design: only the "Set them free" outcome founds the
 *    militia — Kill/Jail never open the Muster as authored.)
 *
 * 2) FURRIER'S FIXIT FARM stays an Act 2 first visit (out of the way; the
 *    party already met the faction — the Jackalopes delivered them; Pike's
 *    send-off plants the hook). Remove the Crossroads' "Stop at the Fixit
 *    Farm" choice and raise the six phase-1 FFF beats to storyPhase >= 2
 *    (ride-in, first-visit cinematics, browsing hub, gullywasher welcome —
 *    the welcome raise also stops its phase-1 conversation INVITE).
 *
 * Idempotent; DRY_RUN default true; backs up campaigns. Run as GM.
 * Marker: [TURN1-EXCLUSIONS-2026-09-03]
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  const dropChoice = (beatId, rx, why) => {
    const b = byId.get(beatId);
    if (!b) { report.push(`⚠ ${beatId}: NOT FOUND — skipped`); return; }
    const chs = Array.isArray(b.choices) ? b.choices : [];
    const hits = chs.filter(c => rx.test(String(c?.label || "")));
    if (!hits.length) { report.push(`· ok ${beatId}: no ${why} choice (already removed)`); return; }
    b.choices = chs.filter(c => !rx.test(String(c?.label || "")));
    changes++;
    report.push(`✚ ${beatId}: removed ${hits.map(c => JSON.stringify(c.label)).join(", ")} (${b.choices.length} choices remain)`);
  };

  // ── 1. The Muster off the Welcome Round ───────────────────────────────────
  dropChoice("allesh_gilliam_town_walk", /the muster/i, "Muster");
  {
    // Informational: confirm the gate that now carries the canon.
    const m = byId.get("allesh_gilliam_muster_intro");
    const req = JSON.stringify(m?.inject?.requires ?? null);
    report.push(req?.includes("quest_ag_town_militia")
      ? `· ok allesh_gilliam_muster_intro gate intact: ${req}`
      : `⚠ allesh_gilliam_muster_intro gate MISSING quest_ag_town_militia — check by hand: ${req}`);
  }

  // ── 2. FFF off the Turn-1 board ───────────────────────────────────────────
  dropChoice("ag_crossroads_first_rides", /fixit farm/i, "Fixit Farm");

  const RAISE = [
    "ag_ride_fixit",            // The Road to the Fixit Farm (was the crossroads route)
    "fixit_cinematic_intro",    // first-visit cinematics
    "fixit_intro_scene",
    "fixit_saloon_cinematic",
    "fixit_town_walk",          // Open for Browsing hub
    "fixit_gullywasher_welcome" // First Round's Cultural (also silences the phase-1 invite)
  ];
  for (const id of RAISE) {
    const b = byId.get(id);
    if (!b) { report.push(`⚠ ${id}: NOT FOUND — skipped`); continue; }
    b.inject = b.inject || {};
    const reqs = Array.isArray(b.inject.requires) ? b.inject.requires : (b.inject.requires = []);
    const sp = reqs.find(r => r && String(r.flag) === "storyPhase");
    if (sp && Number(sp.gte) >= 2) { report.push(`· ok ${id}: already storyPhase >= ${sp.gte}`); continue; }
    if (sp) { sp.gte = 2; } else { reqs.push({ flag: "storyPhase", gte: 2 }); }
    changes++;
    report.push(`✚ ${id}: requires storyPhase >= 2`);
  }

  console.log(`[patch-turn1-exclusions] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` +
    report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Turn-1 exclusions DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Turn-1 exclusions: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
      `backup-campaigns-before-turn1-exclusions-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Turn-1 exclusions APPLIED: ${changes} change(s). The Muster waits for its militia; the Farm waits for Act 2.`);
})();

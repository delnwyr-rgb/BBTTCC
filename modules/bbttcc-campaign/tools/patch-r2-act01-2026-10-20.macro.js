/* patch-r2-act01-2026-10-20.macro.js — Story Review Ledger ROUND 2, "Act 0–1" rows 1–4 (all Accept, Dave 2026-10-20).
 *
 *  Row 1  THE CAMP SEAM (ten beats across four tabs): one camp, up the Khezek-Tor switchbacks; the LANDING is on the coast.
 *         khezek_upper_galleries  the ridge view no longer calls it a "forward" camp or sends the route on to a second one:
 *                                 past the camp the switchback goes down the far side toward the coast, where the packs come from
 *         wt_caravan_ride / _fail / wt_kudzu_saloon  the Port Kudzu wagon runs "inland, up the switchbacks", the ledger says inland
 *         odie_wick_proud / _wobble_hit / _the_hour  sand → scree / the slope (three Wick lines + one memory line)
 *         mall_heading_matched    the heading agrees with the landing: the road the wagons take past the camp to the water
 *         (ag_pipeline_backward + ag_caravan_route already read "up the mountain" — patch-pipeline-backward, same day)
 *  Row 2  allesh_gilliam_marshall_yarrow_echo "Pike doesn't answer immediately." · enc_bandit_ambush_win_jail "Marshal Pike",
 *         "Food and shelter are powerful attractors" (the label typo "Win (Jail))" is the Encounters macro's row 4)
 *  Row 3  allesh_gilliam_plumb_office_intro "the Avuncular Order brought him" (canon name — khezek_tor_quest_acceptance says so)
 *  Row 4  allesh_gilliam_st_gilliams_cinematics "St Gilliam's."
 *
 *  Every edit guarded by the live baseline; idempotent; DRY_RUN default true; backs up `campaigns`. GM only.
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

  const rep = (id, from, to, note, field = "description") => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; }
    const d = String(b[field] || "");
    if (d.includes(to)) { report.push(`· ok ${id}: ${note}`); return; }
    if (!d.includes(from)) { report.push(`⚠ ${id}: baseline text not found for "${note}"`); return; }
    b[field] = d.replace(from, to); changes++; report.push(`✚ ${id}: ${note}`);
  };

  /* ── row 1 · the camp seam ─────────────────────────────────────────────── */
  rep("khezek_upper_galleries", "and there it is — the cult's forward camp, seen from a ridge", "and there it is — the cult's camp, seen from a ridge", "not a forward camp");
  rep("khezek_upper_galleries",
    "And past the camp, where the shaft bends coastward, the route continues — down the same heading the survey stations shake about, toward the stretch of nothing that gets visited far too regularly to be nothing. The whisper has a destination. You are looking at the first waypoint, and the road does not end here.",
    "Past the camp the switchback goes on down the far side of the mountain, toward the coast, which is where the packs come from. The whisper has a destination, and you are looking at it.",
    "the ridge view: one camp, the coast beyond it");
  rep("wt_caravan_ride", "Two days coastward. The road stops being a road", "Two days inland, up the switchbacks. The road stops being a road", "the Kudzu wagon runs inland");
  rep("wt_caravan_ride_fail", "and the wagon goes on coastward without slowing", "and the wagon goes on inland without slowing", "the wagon goes on inland");
  rep("wt_kudzu_saloon", "salt and wax and no meat, coastward.", "salt and wax and no meat, inland.", "Dot's ledger says inland");
  rep("odie_wick_proud", "because of the glare off the sand.", "because of the glare off the scree.", "glare off the scree");
  rep("odie_wick_wobble_hit", "“I walk the sand at the hour. People don't, mostly.”", "“I walk the slope at the hour. People don't, mostly.”", "Wick walks the slope");
  rep("odie_wick_the_hour", "He walks the sand at the hour and you walk it with him", "He walks the slope at the hour and you walk it with him", "the hour, on the slope");
  rep("odie_wick_the_hour", "He says the next part to the sand.", "He says the next part to the scree.", "the next part to the scree");
  rep("odie_wick_the_hour", "At the hour, on the sand, Wick told the Stewards", "At the hour, on the slope, Wick told the Stewards", "memory: on the slope", "memoryText");
  rep("mall_heading_matched",
    "Two days coastward by wagon from the Long Market, and the bearing off a camcorder in a mall lot, drawn on the same food-court napkin, agree to within the width of the pen.",
    "The road the wagons take past the camp to the water, and the bearing off a camcorder in a mall lot, drawn on the same food-court napkin, agree to within the width of the pen.",
    "the heading agrees with the landing");

  /* ── row 2 · Pike, not Yarrow ───────────────────────────────────────────── */
  rep("allesh_gilliam_marshall_yarrow_echo", "Yarrow doesn’t answer immediately.", "Pike doesn’t answer immediately.", "Pike doesn't answer immediately");
  rep("enc_bandit_ambush_win_jail", "to be dealt with by Marshal Yarrow.", "to be dealt with by Marshal Pike.", "dealt with by Marshal Pike");
  rep("enc_bandit_ambush_win_jail", "Food and shelter and powerful attractors.", "Food and shelter are powerful attractors.", "are powerful attractors");

  /* ── row 3 · the Avuncular Order ───────────────────────────────────────── */
  rep("allesh_gilliam_plumb_office_intro", "In theory, the Avuncular Coalition brought him to Allesh-Gilliam", "In theory, the Avuncular Order brought him to Allesh-Gilliam", "the Avuncular Order brought him");

  /* ── row 4 · St Gilliam's ──────────────────────────────────────────────── */
  rep("allesh_gilliam_st_gilliams_cinematics", "St Gilliams. A church that is actually a B&B", "St Gilliam's. A church that is actually a B&B", "St Gilliam's");

  /* ── Dave, mid-turn 2026-10-20: "The name of Avuncular Joans' band is now Avuncular Joans and The Idle Compaction" —
   *    the band had no name anywhere in the text; the send-off speech (the only beat that plays her music) now says it once ── */
  rep("avuncular_joans_speech", "She quoted one of her own songs at you. She knows you're a fan.", "She quoted one of her own songs at you — Avuncular Joans and The Idle Compaction, the one everybody can hum. She knows you're a fan.", "the band has a name: Avuncular Joans and The Idle Compaction");

  console.log(`[r2 act01 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-r2-act01-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — round 2, Act 0–1.`);
})();

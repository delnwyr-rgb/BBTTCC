/**
 * patch-pike-hub-return-2026-11-01.macro.js — Dave, 11-01, back at Allesh-Gilliam with the crate: Pike's Act 2 hub
 * (allesh_gilliam_introduction_to_hq) re-ran its first-visit speech — the runner, "Variables… Trouble", the three errands —
 * and still offered "Ride for Furrier's Fixit Farm — with the Tetrarch Spanner" with the stabilizer already in the crate.
 *   • The ride hides once the Leyline Stabilizer chapter is complete ({questBucket quest_bSwOIWzxqNBwJ5NM, isNot completed}).
 *   • The opening knows four states (nested story spans — the expander is nesting-aware as of this deploy):
 *       installed (ag_leygate_installed)  → the boards are the right colors; "Steward." is a promotion in his mouth
 *       crate in hand (any stabilizer deal played, not installed) → he looks at the crate first; Garren's at the gate
 *       been here before (the Leygate visit, the Wall, or Pike's Q&A played) → he doesn't look up; counts the errands you've handled
 *       else → the original first-visit speech, untouched
 * Draft-1 prose. Idempotent (rerun = 0). Pure `apply(camp)` (node lint proof) + Foundry runner. DRY_RUN first.
 * Backup → Data/bbttcc-exports/. GM only.
 */
const PIKE_HUB_PATCH = (() => {
  const ID = "allesh_gilliam_introduction_to_hq", Q_STAB = "quest_bSwOIWzxqNBwJ5NM";
  const MARKER = "{{#played ag_leygate_installed}}";
  const DEALS = "fixit_leyline_stabilizer_trade_success|fixit_leyline_stabilizer_shared_oversight_success|fixit_leyline_stabilizer_hard_ask";
  const VISITED = "ag_leygate_visit|allesh_gilliam_the_east_wall_intro|allesh_gilliam_marshall_yarrow_convo|allesh_gilliam_muster_intro";
  const POST = "The boards behind Pike are the right colors now, which he is pretending not to notice. He notices.\n\n“Steward.” In his mouth that is a promotion. He goes back to the map, which is the other thing he does instead of saying thank you.";
  const CRATE = "Pike looks at the crate before he looks at you, which is fair. The boards behind him are still the wrong colors, and he has clearly been looking at them the whole time you were gone.\n\n“Garren’s at the gate. Has been since the runner said you were on the road.” He points at the grease stain that is also, apparently, the Leygate. “Go.”\n\nNo “please” this time. He has decided you don’t need it, which is its own kind of compliment.";
  const RETURN = "Pike doesn’t look up. The boards are still the wrong colors.\n\n“Wall. Gate. Farm.” He counts them off on his fingers and skips the ones you’ve handled, which tells you he’s been keeping score. Then he points at the door, the way he does.";
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const b = beats.find(x => x && x.id === ID);
    const report = [], conflicts = []; let changes = 0;
    if (!b) return { changes, report, conflicts: [`${ID}: beat not found`] };
    const ride = (b.choices || []).find(c => c && String(c.next) === "ag_ride_fixit");
    if (!ride) conflicts.push(`${ID}: no choice → ag_ride_fixit`);
    else {
      const rows = Array.isArray(ride.requires) ? ride.requires : (ride.requires ? [ride.requires] : []);
      if (rows.some(r => r && r.questBucket === Q_STAB && r.isNot === "completed")) report.push(`· ok "${ride.label}" hides once the stabilizer is won`);
      else { ride.requires = [...rows, { questBucket: Q_STAB, isNot: "completed" }]; changes++; report.push(`✚ "${ride.label}": hidden once the Leyline Stabilizer chapter is completed`); }
    }
    const d = String(b.description || "");
    if (d.startsWith(MARKER)) report.push(`· ok ${ID} opening knows its four states`);
    else {
      b.description = `${MARKER}${POST}{{else}}{{#played ${DEALS}}}${CRATE}{{else}}{{#played ${VISITED}}}${RETURN}{{else}}${d}{{/played}}{{/played}}{{/played}}`;
      changes++; report.push(`✚ ${ID}: opening knows installed / crate in hand / been here before / first visit`);
    }
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = PIKE_HUB_PATCH;                                     // node: offline lint proof
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));   // true copy (deepClone made a write no-op once)
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = PIKE_HUB_PATCH.apply(camp);
  console.log(`[pike hub return 2026-11-01] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__pikeHubReturn = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-pike-hub-return-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Pike knows you've been here.`);
})();

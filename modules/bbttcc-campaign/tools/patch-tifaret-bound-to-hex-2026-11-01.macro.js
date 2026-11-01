/**
 * patch-tifaret-bound-to-hex-2026-11-01.macro.js — Dave, 11-01: "My pref would be to go ahead and bind that encounter to that
 * hex. We can remove the anywhere please. So if the players leave with the quest unfinished, it stays active, with info on
 * where to go to continue. And when they enter the hex again it picks up where it left off if the players choose to engage."
 *
 * Reverses patch-tifaret-anywhere-2026-10-30 + the 09-18 P2 rule for THIS quest: every Forest of Early Tifaret beat drops its
 * hand-set `where: "anywhere"`, so placeOf() lands them on the quest's hex (PolygonForest.d) — the NOW card ranks the Forest
 * as "a ride away" from a town, the quest log shows where to go, and the location guard refuses the Ring from a yard.
 * Mid-ride play keeps working through the engine change shipped with this macro (module.js: a hex-entry chain carries the
 * entered hex, and the guard accepts beats placed AT that hex).
 *   • forest_of_tifaret_approach (the hex's on-enter beat): REPEATABLE while the quest is unfinished (its gate already says
 *     tifaret isNot completed) so re-entering PolygonForest.d re-opens the Forest; its opening knows a return
 *     ({{#played …}} on the Ring / the Tree's Session / the Tree Person / the fight); a plain "Ride on. Not today." exit keeps
 *     the quest active (the engine's own rule: exits are never greyed).
 *   • the script's steps carry where: "PolygonForest.d" (quest-log Where line).
 * Pure `apply(camp)` (node lint proof) + Foundry runner. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const TIFARET_HEX_PATCH = (() => {
  const HEX = "PolygonForest.d", APPROACH = "forest_of_tifaret_approach";
  const isForest = b => b && (b.story?.quest === "tifaret" || /^(tifaret_|ans_tifaret_|forest_of_tifaret_)/.test(String(b.id || "")));
  const RETURN = "The forest opens again, the way a door you once left ajar opens: without surprise. The light still falls in deliberate beams. The ring is where you left it, and so is the question.";
  const MARKER = "{{#played tifaret_the_ring}}";
  const RIDE_ON = { label: "Ride on. Not today.", next: "", description: "The forest keeps. It will open again when you come back through this hex.", checkStat: "", checkDC: 0, failNext: "" };
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    let unbound = 0;
    for (const b of beats) if (isForest(b) && "where" in b) { delete b.where; unbound++; }
    if (unbound) { changes += unbound; report.push(`✚ ${unbound} Forest beat(s) drop where:"anywhere" → placed at ${HEX} by the quest`); } else report.push("· ok Forest beats carry no hand-set where");
    const a = beats.find(b => b && b.id === APPROACH);
    if (!a) conflicts.push(`${APPROACH}: beat not found`);
    else {
      // the 09-18 pinned leg (fires on ANY leg whose destination is the Farm, whichever hexes it crosses) is the opposite of
      // "bound to the hex" — and repeatable + pinLeg would open the Forest on every ride to Fixit. The hex's on-enter
      // (phase charter: PolygonForest.d → forest_of_tifaret_approach) is the one way in now.
      if (a.pinLeg != null) { delete a.pinLeg; changes++; report.push(`✚ ${APPROACH}: pinLeg (to Furrier's Fixit-Farm) removed — the Forest opens on entering ${HEX}, not on every ride to the Farm`); } else report.push(`· ok ${APPROACH} no pinLeg`);
      a.inject = a.inject || {};
      if (a.inject.repeatable !== true) { a.inject.repeatable = true; changes++; report.push(`✚ ${APPROACH}: repeatable while the quest is unfinished (re-entering ${HEX} re-opens the Forest)`); } else report.push(`· ok ${APPROACH} repeatable`);
      const d = String(a.description || "");
      if (!d.startsWith(MARKER)) {
        a.description = `${MARKER}${RETURN}{{else}}{{#played forest_of_tifaret_merge}}${RETURN}{{else}}{{#played tifaret_tree_person}}${RETURN}{{else}}{{#played forest_of_tifaret_fight}}${RETURN}{{else}}${d}{{/played}}{{/played}}{{/played}}{{/played}}`;
        changes++; report.push(`✚ ${APPROACH}: opening knows a return`);
      } else report.push(`· ok ${APPROACH} opening knows a return`);
      a.choices = Array.isArray(a.choices) ? a.choices : [];
      if (!a.choices.some(c => c && c.label === RIDE_ON.label)) { a.choices.push({ ...RIDE_ON }); changes++; report.push(`✚ ${APPROACH}: "${RIDE_ON.label}" exit (quest stays active)`); } else report.push(`· ok ${APPROACH} ride-on exit`);
    }
    const sc = camp.story?.scripts?.tifaret;
    if (!sc) report.push("⚠ story script tifaret not in campaign.story — quest-log Where rides on placeOf alone");
    else for (const st of (sc.steps || [])) { if (st.where !== HEX) { st.where = HEX; changes++; report.push(`✚ script step ${st.id}: where ${HEX}`); } }
    return { changes, report, conflicts };
  }
  return { apply, HEX };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = TIFARET_HEX_PATCH;                                 // node: offline lint proof
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));   // true copy (deepClone made a write no-op once)
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = TIFARET_HEX_PATCH.apply(camp);
  const hexKnown = (() => { try { for (const sc of game.scenes) for (const d of sc.drawings) { const n = d.flags?.["bbttcc-territory"]?.name; if (n && String(n).replace(/[\s ]+/g, " ").trim() === TIFARET_HEX_PATCH.HEX) return sc.name; } } catch (_e) {} return null; })();
  if (!hexKnown) conflicts.push(`hex "${TIFARET_HEX_PATCH.HEX}" not found on any scene in this world`); else report.push(`· hex ${TIFARET_HEX_PATCH.HEX} found on scene "${hexKnown}"`);
  console.log(`[tifaret bound to hex 2026-11-01] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__tifaretBoundToHex = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-tifaret-bound-to-hex-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the Forest of Early Tifaret lives at ${TIFARET_HEX_PATCH.HEX}.`);
})();

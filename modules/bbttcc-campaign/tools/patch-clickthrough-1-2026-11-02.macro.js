/**
 * patch-clickthrough-1-2026-11-02.macro.js — snags from the full GM click-through (Dave, 11-02: "do a full game click through …
 * when you hit an incorrect behavior, pause, fix it, and resume").
 *   1. Khezek-Tor hub had no door to Below Four (kt_cage_shaft was reachable only through Sable Nine's conversation) while the
 *      hub already offered "give the Official Word" → hub door "Below Four — Sable's cage shaft", same gate as Sable's line.
 *   2. kt_dropped_manifest "Bring it up." ended the chain with nothing reopened → back to the Khezek-Tor hub.
 *   3. Lyrenn's hub "Ride on — the road waits" opened nothing (next "", no openTravel) → the Road Home beat.
 * (Engine, same deploy: _EXIT_LABEL now treats "Climb back up. Another time." / "Not yet" / "Not today" as exits — never greyed.)
 * Pure apply(camp) + Foundry runner. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const CT1_PATCH = (() => {
  const ch = (label, next, description, extra = {}) => ({ label, next, description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const byId = new Map(beats.map(b => [String(b?.id), b]));
    const report = [], conflicts = []; let changes = 0;
    for (const id of ["khezek_tor_quest_scene", "kt_cage_shaft", "kt_dropped_manifest", "lyrenn_quest_scene", "ride_back_home"]) if (!byId.has(id)) conflicts.push(`${id}: beat not found`);
    if (conflicts.length) return { changes, report, conflicts };
    const hub = byId.get("khezek_tor_quest_scene"); hub.choices = Array.isArray(hub.choices) ? hub.choices : [];
    if (hub.choices.some(c => c && c.next === "kt_cage_shaft")) report.push("· ok KT hub → Below Four");
    else {
      const door = ch("Below Four — Sable's cage shaft", "kt_cage_shaft", "Sable keeps the rope. The manifest has been down there the whole time.",
        { requires: [{ questBucket: "quest_kt_official_word", is: "active" }, { beatMark: "kt_brennig_desk" }, { beatMark: "kt_dropped_manifest", not: true }] });
      const at = hub.choices.findIndex(c => c && /^call it a day/i.test(String(c.label || "")));
      if (at >= 0) hub.choices.splice(at, 0, door); else hub.choices.push(door);
      changes++; report.push("✚ KT hub: door → Below Four (kt_cage_shaft)");
    }
    for (const c of (byId.get("kt_dropped_manifest").choices || [])) if (c && /^bring it up/i.test(c.label || "") && !c.next) { c.next = "khezek_tor_quest_scene"; changes++; report.push("✚ kt_dropped_manifest 'Bring it up.' → the KT hub"); }
    for (const c of (byId.get("lyrenn_quest_scene").choices || [])) if (c && /^ride on/i.test(c.label || "") && !c.next && !c.openTravel) { c.next = "ride_back_home"; changes++; report.push("✚ Lyrenn hub 'Ride on' → ride_back_home (the Travel Console)"); }
    if (!changes) report.push("· nothing to change");
    return { changes, report, conflicts };
  }
  return { apply };
})();
if (typeof game === "undefined" && typeof module !== "undefined") { module.exports = CT1_PATCH; }
else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = CT1_PATCH.apply(camp);
  console.log(`[clickthrough-1 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__ct1 = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes || conflicts.length) return ui.notifications.info(conflicts.length ? "Conflicts — nothing written." : "Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-clickthrough-1-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s).`);
})();

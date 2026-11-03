/**
 * patch-gloomgill-final-fact-daath-2026-11-02.macro.js — THE CLIFFHANGER (Dave 2026-11-02: "The Daath Opening should be the cliffhanger"
 * · "After Gloomgill"). The epic layer no longer opens Daath on the tenth lamp alone (bbttcc-epic daath.js: gate mark
 * `daathGateMark`, default gloomgill_passed). Gloomgill's verdict ("Gloomgill grants you one final fact — the one you didn't ask for")
 * now leads to that fact: the EXISTING gloomgill_final_fact (ruled 2026-09-27 — he names the paymaster, Mr Monocle of Monodynamic
 * Industries, the only place the story says it), which nothing routed to. Its exit "Same time next century." = worldEffects.daathCheck
 * → THE TEN LAMPS BURN — DAATH OPENS, then the part-one card (part_one_end). The second half picks up at the knock and the road west.
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const FINAL_FACT_PATCH = (() => {
  const ch = (label, next, description = "", extra = {}) => ({ label, next, description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const beat = (id, label, description, choices, o = {}) => ({
    id, label, type: "dialog", timeScale: "scene", timePoints: 0, questId: "quest_gloomgill", tags: "quest.gloomgill,daath,cliffhanger", politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires: o.requires || [{ beatMark: "gloomgill_passed" }], evergreen: true },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: "", priority: "background", story: { quest: "gloomgill" }, choices, worldEffects: o.worldEffects || {}, sceneId: "", where: o.where || "Lake Suspicious"
  });
  const BEATS = [
    beat("part_one_end", "THATWARDS HO! — End of Part One",
      "The projector clicks over one last time.\n\nTen lamps burn over the Frontier Formerly Known As Texas. Between them, where the Tree draws nothing, something is open that has never been open before. Out west, past the last map anyone trusts, Monodynamic Industries keeps its books, and Mr Monocle has just been told your name.\n\nT O   B E   C O N T I N U E D\n\n⚙ GM: the second half picks up at Daath's door (game.fourththing.epic.daath.knock()) and the road west.",
      [ch("Roll credits.", "")], { requires: [{ beatMark: "gloomgill_final_fact" }], where: "anywhere" })
  ];
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    for (const nb of BEATS) { if (beats.some(b => b && b.id === nb.id)) { report.push(`· ok ${nb.id}`); continue; } beats.push(nb); changes++; report.push(`✚ ${nb.id}`); }
    // part_one_end may have shipped with an earlier text — bring it to the current one
    const pe = beats.find(b => b && b.id === "part_one_end"); const peNew = BEATS.find(b => b.id === "part_one_end");
    if (pe && peNew && pe.description !== peNew.description) { pe.description = peNew.description; changes++; report.push("✚ part_one_end: text names Monodynamic Industries"); }
    // the existing final fact's exit opens Daath and ends Part One
    const ff = beats.find(b => b && b.id === "gloomgill_final_fact");
    if (!ff) conflicts.push("gloomgill_final_fact not found");
    else { const ex = (ff.choices || []).find(x => x && /same time next century/i.test(String(x.label || "")));
      if (!ex) conflicts.push("gloomgill_final_fact: no \"Same time next century.\" exit");
      else if (ex.next === "part_one_end" && ex.worldEffects?.daathCheck === true) report.push("· ok final fact exit");
      else if (ex.next && ex.next !== "part_one_end") conflicts.push(`final fact exit already routes to ${ex.next}`);
      else { ex.next = "part_one_end"; ex.worldEffects = { ...(ex.worldEffects || {}), daathCheck: true }; changes++; report.push("✚ gloomgill_final_fact \"Same time next century.\" → Daath check → part_one_end"); } }
    const p = beats.find(b => b && b.id === "gloomgill_passed"); if (!p) { conflicts.push("gloomgill_passed not found"); return { changes, report, conflicts }; }
    const c = (p.choices || []).find(x => x && /^continue$/i.test(String(x.label || "").trim()));
    if (!c) conflicts.push("gloomgill_passed: no Continue");
    else if (c.next === "gloomgill_final_fact") report.push("· ok gloomgill_passed route");
    else if (c.next) conflicts.push(`gloomgill_passed Continue already routes to ${c.next}`);
    else { c.next = "gloomgill_final_fact"; changes++; report.push("✚ gloomgill_passed \"Continue\" → gloomgill_final_fact"); }
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = FINAL_FACT_PATCH;
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw)); const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = FINAL_FACT_PATCH.apply(camp);
  console.log(`[gloomgill final fact + daath 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__finalFact = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-final-fact-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Gloomgill's last fact opens the door.`);
})();

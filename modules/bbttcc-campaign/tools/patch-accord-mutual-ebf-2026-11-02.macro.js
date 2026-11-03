/**
 * patch-accord-mutual-ebf-2026-11-02.macro.js — click-through (2026-11-02): signing the Bandit Accord set @coalition → the Evil Bad
 * Faction (Ralph Maccio's Domain — Dave 11-02: "Her domain is the Evil Bad Faction") ALLIED, but relations are directional: the Evil
 * Bad Faction still rated the coalition neutral, so nothing that needs MUTUAL allies (Allied Send, support alignment) worked. The
 * Accord now sets both directions, and its GM note ("mint Ralph Maccio's faction actor now") names the Domain that already exists.
 * And after the alliance the banner changes its name (Dave 11-02): worldEffects.renameFaction → "Evil Good Faction".
 * RUN_NOW (this world): lands the missing direction once. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/.
 */
const ACCORD_PATCH = (() => {
  const ID = "bandit_summit_accord", EBF = "oK7VitQikQ6FN3PI";
  const ROW = () => ({ sourceFactionId: EBF, targetFactionId: "@coalition", setStatus: "allied" });
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    const b = beats.find(x => x && x.id === ID); if (!b) { conflicts.push(`${ID} not found`); return { changes, report, conflicts }; }
    b.worldEffects = b.worldEffects || {}; const rows = Array.isArray(b.worldEffects.relationshipEffects) ? b.worldEffects.relationshipEffects : [];
    if (!rows.some(r => r && r.sourceFactionId === EBF && r.targetFactionId === "@coalition")) { rows.push(ROW()); b.worldEffects.relationshipEffects = rows; changes++; report.push(`✚ ${ID}: the Evil Bad Faction rates the coalition allied too (mutual)`); }
    else report.push(`· ok ${ID} reverse row`);
    if (!(b.worldEffects.renameFaction && b.worldEffects.renameFaction.name === "Evil Good Faction")) { b.worldEffects.renameFaction = { factionId: EBF, name: "Evil Good Faction" }; changes++; report.push(`✚ ${ID}: the banner is renamed the Evil Good Faction`); }
    else report.push(`· ok ${ID} rename`);
    const d = String(b.description || "");
    const note = /⚠ GM: mint Ralph Maccio's faction actor now[^<]*/;
    if (note.test(d)) { b.description = d.replace(note, "⚙ GM: the banner is Ralph Maccio's Domain — the Evil Bad Faction, renamed the Evil Good Faction on signing — allied both ways; Allied Send works from here."); changes++; report.push(`✚ ${ID}: GM note names the Evil Bad Faction`); }
    return { changes, report, conflicts };
  }
  return { apply, ROW };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = ACCORD_PATCH;
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const RUN_NOW = false;                // <-- true: also land the reverse relation once here
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.(); const camp = camps?.[cid]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = ACCORD_PATCH.apply(camp);
  console.log(`[accord mutual ebf 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__accord = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (changes) {
    try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-accord-mutual-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
    await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  }
  if (RUN_NOW) { await game.bbttcc.api.worldMutation.applyWorldEffects({ id: "accord-mutual-replay", label: "The Accord (reverse relation)", worldEffects: { relationshipEffects: [ACCORD_PATCH.ROW()], renameFaction: { factionId: "oK7VitQikQ6FN3PI", name: "Evil Good Faction" } } }, { source: "bbttcc-campaign", campaignId: cid, beatId: "accord-mutual-replay" }); globalThis.__accord.ranNow = true; }
  ui.notifications.info(`Applied ${changes} change(s)${RUN_NOW ? " + landed the reverse relation" : ""}.`);
})();

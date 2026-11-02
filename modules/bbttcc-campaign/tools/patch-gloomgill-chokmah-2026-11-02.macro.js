/**
 * patch-gloomgill-chokmah-2026-11-02.macro.js — click-through (2026-11-02): Gloomgill's verdict (gloomgill_passed, "Examined and Found
 * Adequate") integrates the spark at Lake Suspicious — "⚠ integrate refused at Lake Suspicious: no spark seated here": none was ever
 * seated. Owner ruling (Dave 11-02): "Chokmah indeed!" — Oannes, who taught the first cities. Chokmah's Animate and Conceptual are seated
 * elsewhere; the lake takes the VESTIGIAL ("examined by a god's leftover"). gloomgill_passed's hexSpark becomes
 *   [{seat, key: spark_chokmah_vestigial, hexName: Lake Suspicious}, {integrate, hexName: Lake Suspicious}]
 * RUN_NOW (optional, this world): re-lands the block once for a table that already passed. Idempotent (rerun = 0). DRY_RUN first.
 */
const CHOKMAH_PATCH = (() => {
  const ID = "gloomgill_passed", HEX = "Lake Suspicious", KEY = "spark_chokmah_vestigial";
  const BLOCK = () => [{ action: "seat", key: KEY, hexName: HEX, state: "dormant" }, { action: "integrate", hexName: HEX }];
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    const b = beats.find(x => x && x.id === ID); if (!b) { conflicts.push(`${ID} not found`); return { changes, report, conflicts }; }
    b.worldEffects = b.worldEffects || {};
    const cur = Array.isArray(b.worldEffects.hexSpark) ? b.worldEffects.hexSpark : (b.worldEffects.hexSpark ? [b.worldEffects.hexSpark] : []);
    if (cur.some(h => h && h.action === "seat" && h.key === KEY)) { report.push(`· ok ${ID}`); return { changes, report, conflicts }; }
    b.worldEffects.hexSpark = [...BLOCK(), ...cur.filter(h => !(h && h.action === "integrate" && h.hexName === HEX))]; changes++;
    report.push(`✚ ${ID}: seats + lights ${KEY} at ${HEX}`);
    return { changes, report, conflicts };
  }
  return { apply, BLOCK };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = CHOKMAH_PATCH;
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const RUN_NOW = false;                // <-- true: also re-land the spark block once here
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.(); const camp = camps?.[cid]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = CHOKMAH_PATCH.apply(camp);
  console.log(`[gloomgill chokmah 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__chokmah = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (changes) {
    try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-gloomgill-chokmah-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
    await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  }
  if (RUN_NOW) { await game.bbttcc.api.worldMutation.applyWorldEffects({ id: "gloomgill-chokmah-replay", label: "Gloomgill's Chokmah (re-landed)", worldEffects: { hexSpark: CHOKMAH_PATCH.BLOCK() } }, { source: "bbttcc-campaign", campaignId: cid, beatId: "gloomgill-chokmah-replay" }); globalThis.__chokmah.ranNow = true; }
  ui.notifications.info(`Applied ${changes} change(s)${RUN_NOW ? " + lit Chokmah here" : ""}.`);
})();

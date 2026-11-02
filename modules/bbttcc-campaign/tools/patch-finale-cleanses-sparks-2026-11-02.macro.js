/**
 * patch-finale-cleanses-sparks-2026-11-02.macro.js — click-through (2026-11-02): the finale (Parley → Unexpectedly Friendly Terms)
 * tried to seat the Yesod Spark at Allesh-Gilliam and got "integrate refused at Allesh-Gilliam: corrupted — repair first" — the Gaze
 * had corrupted Allesh-Gilliam's Foundation spark in Month 8, so a monthly roll voided the climax and nothing waited.
 * Owner ruling (Dave 11-02): "A — kill the main bad guy and the rest of them fall." Every finale ending that seats Yesod
 * (raid_thatwards_outcome_friends, raid_thatwards_outcome_neutral_spark) now carries
 *   hexSpark: [{action:"integrate", hexName:"Allesh-Gilliam", cleanse:true}, {action:"repairAll"}]
 * — the Spark is the repair, and every other corrupted spark in the world is lifted with it (engine: world-mutation-engine 2g).
 * RUN_NOW (this world only, optional): re-lands the corrected spark block once for a table whose finale already played and was refused.
 * Pure apply(camp) + Foundry runner. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const FINALE_SPARK_PATCH = (() => {
  const IDS = ["raid_thatwards_outcome_friends", "raid_thatwards_outcome_neutral_spark"];
  const BLOCK = () => [{ action: "integrate", hexName: "Allesh-Gilliam", cleanse: true }, { action: "repairAll" }];
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    for (const id of IDS) {
      const b = beats.find(x => x && x.id === id); if (!b) { conflicts.push(`${id} not found`); continue; }
      b.worldEffects = b.worldEffects || {};
      const cur = Array.isArray(b.worldEffects.hexSpark) ? b.worldEffects.hexSpark : (b.worldEffects.hexSpark ? [b.worldEffects.hexSpark] : []);
      const done = cur.some(h => h && h.action === "integrate" && h.cleanse === true) && cur.some(h => h && String(h.action).toLowerCase() === "repairall");
      if (done) { report.push(`· ok ${id}`); continue; }
      const others = cur.filter(h => h && !(h.action === "integrate" && /allesh/i.test(String(h.hexName || ""))) && String(h.action).toLowerCase() !== "repairall");
      b.worldEffects.hexSpark = [...BLOCK(), ...others]; changes++;
      report.push(`✚ ${id}: the Yesod Spark cleanses Allesh-Gilliam and seats; every corrupted spark falls`);
    }
    return { changes, report, conflicts };
  }
  return { apply, IDS, BLOCK };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = FINALE_SPARK_PATCH;
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const RUN_NOW = false;                // <-- true: also re-land the spark block once here (finale already played, integrate refused)
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.(); const camp = camps?.[cid]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = FINALE_SPARK_PATCH.apply(camp);
  console.log(`[finale cleanses sparks 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__finaleSparks = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (changes) {
    try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-finale-cleanses-sparks-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
    await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  }
  if (RUN_NOW) {
    const wm = game.bbttcc?.api?.worldMutation;
    await wm.applyWorldEffects({ id: "finale-cleanse-replay", label: "The Yesod Spark (finale, re-landed)", worldEffects: { hexSpark: FINALE_SPARK_PATCH.BLOCK() } }, { source: "bbttcc-campaign", campaignId: cid, beatId: "finale-cleanse-replay" });
    globalThis.__finaleSparks.ranNow = true;
  }
  ui.notifications.info(`Applied ${changes} change(s)${RUN_NOW ? " + re-landed the Spark here" : ""}.`);
})();

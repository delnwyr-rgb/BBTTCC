/**
 * patch-leyline-stabilizer-gate.macro.js — GM console/macro. DRY_RUN=true by default.
 *
 * Owner ruling 2026-09-10 (Act 2 playtest): the Leyline Stabilizer chain must stay
 * dormant until Marshal Yarrow Pike sends the Stewards to Furrier's Fixit — i.e.
 * until "Allesh-Gilliam - Visit Your New HQ" (allesh_gilliam_introduction_to_hq)
 * has fired, because THAT beat is what accepts the Leyline Stabilizer quest.
 *
 * Steps 20+ already require the quest to be active. Step 10 — the quest's START
 * beat "Furrier's Fixit Farm - The Leyline Stabilizer" (fixit_leyline_stabilizer)
 * — only required storyPhase ≥ 2, so it sat READY at Fixit Farm from the moment
 * Act 2 opened and would prompt quest acceptance for a problem nobody had heard
 * of. This adds the same gate the rest of the chain uses:
 *     { questBucket: "quest_bSwOIWzxqNBwJ5NM", is: "active" }
 * (A beatMark gate on the HQ beat was considered and rejected: beat marks are only
 * written by questEffects that carry a beatId, and the HQ beat's don't — the gate
 * would never open.)
 *
 * Idempotent: skips if the condition is already present. Backs up the `campaigns`
 * setting to a download before writing. Also reports the beat's sceneId and
 * whether it resolves (owner re-pointed it in the Beat Editor the same day).
 */
(async () => {
  const DRY_RUN = true;                          // ← set false to apply
  const NS = "bbttcc-campaign";
  const BEAT_ID = "fixit_leyline_stabilizer";
  const QUEST_ID = "quest_bSwOIWzxqNBwJ5NM";     // Furrier's Fixit Farm - The Leyline Stabilizer
  const COND = { questBucket: QUEST_ID, is: "active" };

  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign;
  const cid = api?.getActiveCampaignId?.();
  let rawC = game.settings.get(NS, "campaigns"); const cStr = typeof rawC === "string";
  const camps = cStr ? JSON.parse(rawC) : foundry.utils.deepClone(rawC);
  const camp = camps?.[cid];
  if (!camp) return ui.notifications.error("No active campaign.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  if (!Array.isArray(camp.beats)) camp.beats = beats;
  const beat = beats.find(b => b?.id === BEAT_ID);
  if (!beat) return ui.notifications.error(`Beat '${BEAT_ID}' not found in the active campaign.`);

  beat.inject = (beat.inject && typeof beat.inject === "object") ? beat.inject : {};
  const reqs = Array.isArray(beat.inject.requires) ? beat.inject.requires : [];
  const already = reqs.some(c => c && String(c.questBucket) === QUEST_ID && String(c.is || "") === "active");

  const scId = String(beat.sceneId || "").replace(/^Scene\./, "");
  const scene = scId ? game.scenes.get(scId) : null;
  console.group(`[leyline-gate] ${DRY_RUN ? "DRY RUN — " : ""}${beat.label}`);
  console.log("requires before:", JSON.stringify(reqs));
  console.log("requires after: ", JSON.stringify(already ? reqs : [...reqs, COND]));
  console.log(`sceneId: ${scId || "(none)"} → ${scene ? `OK "${scene.name}"` : (scId ? "DANGLING — set it in the Beat Editor" : "no scene bound")}`);
  console.groupEnd();

  if (already) return ui.notifications.info(`'${BEAT_ID}' already carries the quest-active gate — nothing to do.`);
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — would add the quest-active gate to '${BEAT_ID}'. Set DRY_RUN=false to apply.`);

  beat.inject.requires = [...reqs, COND];
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  (foundry.utils.saveDataToFile || saveDataToFile)(JSON.stringify(cStr ? JSON.parse(rawC) : rawC), "application/json", `backup-before-leyline-gate-${stamp}.json`);
  await game.settings.set(NS, "campaigns", cStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`'${BEAT_ID}' now requires the Leyline Stabilizer quest to be active (Yarrow's HQ beat accepts it).`);
})();

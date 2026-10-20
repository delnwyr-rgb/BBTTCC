/* patch-pipeline-backward-2026-10-20.macro.js — RUN THE CHANNEL BACKWARD: Garren reads the sequence (Dave, 2026-10-20):
 *  "Players don't know about the mall, or kickflip lazarus, at this point. The Garren Should See It answer is
 *   labeled as Stays - so they don't show anything to Garren currently. What are we expecting for Garren to reveal?"
 *
 *  Before: ag_pipeline_backward had three headings and only the caravan had a road. "Note the Mall" named Crown Mall's
 *  archive and Kickflip two acts before the table meets either; "Garren should see it" put Garren's whole read in a
 *  choice after-text that vanishes when the beat ends, and wrote no mark. Every Act 3 payoff (Legansus sequence,
 *  the Chapel, the cult camp, the Mall footage) keys on the beat mark `ag_pipeline_backward`, so nothing downstream
 *  needs re-keying — those gates are left exactly as they are.
 *
 *   NEW   ag_pipeline_garren_reads   at the Leygate, Garren speaking: an activation order, seven positions, not for
 *                                    his gate; it lands sideways. Receipt "The Sequence" (information, rollPlus2).
 *                                    Injectable on its own at the Leygate while the pipeline quest is active, and
 *                                    reachable from the pipeline menu.
 *   MENU  ag_pipeline_backward       "The lights. Note the Mall." after-text → a heading without names;
 *                                    "The sequence. Garren should see it." → next = the Garren beat, short after-text.
 *   SEAM  ag_pipeline_backward + ag_caravan_route: the Jackalope wagon runs "two days up the mountain" (one camp, on
 *         the Khezek-Tor switchbacks — Dave's 10-19 ruling; the rest of that seam stays on its round-2 chip).
 *
 *  Idempotent (id / text guards); DRY_RUN default true; backs up `campaigns`. GM only.
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

  const PIPE = "ag_pipeline_backward", GARREN = "ag_pipeline_garren_reads", ROUTE = "ag_caravan_route";
  const LEYGATE_SCENE = "KCYBaBbPmXHLzEsz", GARREN_ACTOR = "uIwflNioGXwdCfVw";
  const rep = (id, from, to, note) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; }
    const d = String(b.description || "");
    if (d.includes(to)) { report.push(`· ok ${id}: ${note}`); return; }
    if (!d.includes(from)) { report.push(`⚠ ${id}: baseline text not found for "${note}"`); return; }
    b.description = d.replace(from, to); changes++; report.push(`✚ ${id}: ${note}`);
  };

  /* ── 1. the pipeline beat: no names the table hasn't met, Garren gets a door, the wagon goes up the mountain ── */
  const pipe = byId.get(PIPE);
  if (!pipe) return ui.notifications.error(`${PIPE} not found.`);
  rep(PIPE, "two days coastward and two back", "two days up the mountain and two back", "the wagon runs to the one camp (Khezek-Tor switchbacks)");
  rep(ROUTE, "Two days coastward, two days back.", "Two days up the mountain, two days back.", "the wagon runs to the one camp (Khezek-Tor switchbacks)");
  {
    pipe.choices = Array.isArray(pipe.choices) ? pipe.choices : [];
    const mall = pipe.choices.find(c => /note the mall/i.test(String(c?.label || "")));
    const MALL_AFTER = "A heading, not a road. Somewhere down the coast there is a mall, and somebody in it filmed the lights. You will know the place when you find it.";
    if (!mall) report.push("⚠ pipeline: 'Note the Mall' choice not found");
    else if (mall.description !== MALL_AFTER) { mall.description = MALL_AFTER; changes++; report.push("✚ pipeline: Mall after-text no longer names Crown Mall or Kickflip"); }
    else report.push("· ok pipeline: Mall after-text");
    const seq = pipe.choices.find(c => /garren should see it/i.test(String(c?.label || "")));
    const SEQ_AFTER = "The man who keeps a gate alive is the man who reads a gate order. He is where he always is.";
    if (!seq) report.push("⚠ pipeline: 'Garren should see it' choice not found");
    else if (seq.next !== GARREN || seq.description !== SEQ_AFTER) { seq.next = GARREN; seq.description = SEQ_AFTER; changes++; report.push(`✚ pipeline: "Garren should see it" → ${GARREN}`); }
    else report.push("· ok pipeline: Garren door");
  }

  /* ── 2. Garren reads the sequence ──────────────────────────────────────── */
  const GARREN_DESC = "Garren is where he always is, half inside the access panel. He comes out for the fold, wipes his hands, and reads it twice without touching it, the way he reads a serial number.\n\n\"That's an activation order. Seven positions.\" He holds it up against the console, where the gate's own seven are stencilled in paint older than the sign. \"Not for this gate. Mine opens. This one lands.\" He turns the fold sideways and tilts it up toward the mountain, the way nothing in this town ever moves. \"Somebody up there has a gate that isn't a gate yet, and they are teaching it to come down. Six of these I could set with a spanner. The seventh is a heading, and it isn't ours.\"\n\nHe hands it back. \"Keep that. Anyone who runs a gate will want to see it, and the ones who don't will want it more.\"";
  const GARREN_MEMORY = "Garren read the seven-position fold at the Leygate: an activation order with a heading, not for his gate. Something up the mountain is being taught to land.";
  if (!byId.get(GARREN)) {
    const nb = {
      id: GARREN, label: "Allesh-Gilliam — Garren Reads the Sequence", type: "dialog", timeScale: "scene", timePoints: 0,
      questId: "quest_ag_pipeline", tags: "allesh_gilliam pipeline story", politicalTags: "",
      description: GARREN_DESC, memoryText: GARREN_MEMORY,
      outcomes: { success: null, failure: null },
      inject: {
        cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit",
        requires: [{ flag: "storyPhase", gte: 2 }, { questBucket: "quest_ag_pipeline", is: "active" }]
      },
      actors: [], refs: {},
      playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
      storyChain: "allesh_gilliam", priority: "background",
      sceneId: LEYGATE_SCENE, speakerActorId: GARREN_ACTOR,
      story: { quest: "allesh_gilliam", chapter: "the_pipeline" },
      choices: [
        { label: "Keep it.", next: "", description: "Seven positions, folded small. One of them is a heading.", checkStat: "", checkDC: 0, failNext: "" }
      ],
      worldEffects: {
        receipts: [{
          label: "The Sequence", effectKey: "rollPlus2", acquisition: "earned", source: { name: "Garren, at the Leygate" },
          truth: "A seven-position activation order for a Leygate that is not the Allesh-Gilliam gate. Six positions Garren could set with a spanner. The seventh is a heading, and the gate it opens lands sideways, up the mountain."
        }]
      }
    };
    const at = camp.beats.indexOf(pipe);
    camp.beats.splice(at + 1, 0, nb); byId.set(GARREN, nb); changes++; report.push(`✚ beat ${GARREN} — ${nb.label} (after ${PIPE})`);
  } else {
    const g = byId.get(GARREN);
    if (g.description !== GARREN_DESC) { g.description = GARREN_DESC; changes++; report.push(`✚ ${GARREN}: description`); }
    if (g.memoryText !== GARREN_MEMORY) { g.memoryText = GARREN_MEMORY; changes++; report.push(`✚ ${GARREN}: memory line`); }
    if (!changes) report.push(`· ok ${GARREN}: already present`);
  }

  /* ── report / write ───────────────────────────────────────────────────── */
  console.log(`[pipeline-backward 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-pipeline-backward-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Garren reads the sequence.`);
})();

/* patch-wick-dead-ends-2026-10-26.macro.js — Wick's Vacancy questions no longer end the conversation (Dave, 2026-10-26 playtest).
 *  Why: four replies in the Guest Who Keeps Vigil tree had next = "" — picking one ENDED the routed chain, which dropped the
 *  Stewards out of the town walk, and the answer only ever showed as the button's subtitle (read before you ask, then nothing).
 *  Each one now routes to its own small answer beat (the old subtitle is the beat's text) that offers "Ask something else." / "Leave him to his vigil.":
 *   ag_wick_the_flame    "Where is your order from?"                                → NEW ag_wick_the_order
 *   ag_wick_the_flame    "Can I watch you trim?" (Act 2)                            → NEW ag_wick_trim_dusk (Act 2)
 *   ag_wick_the_shrines  "Look for them next time…" (a non-answer) → "Where's the first one?" → NEW ag_wick_shrines_later (the directions the Act-2 road shrine pays off)
 *   ag_wick_the_bed      "What's on the slate?"                                     → NEW ag_wick_the_slate
 *  Idempotent; DRY_RUN default true; backs up `campaigns`; true copy via JSON (deepClone once made a write silently no-op). GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : JSON.parse(JSON.stringify(campsRaw));
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;
  const need = (id) => { const b = byId.get(id); if (!b) report.push(`⚠ ${id}: not found`); return b; };
  const ch = (label, next, over = {}) => Object.assign({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "" }, over);
  const BACK = () => [ch("Ask something else.", "ag_vacancy_pilgrim_wick"), ch("Leave him to his vigil.", "allesh_gilliam_vacancy_intro")];

  // parent beat + choice label → a new answer beat cloned from the parent (speaker, scene, quest, gate), its text = the old subtitle
  const answer = (parentId, choiceLabel, id, label, description, act = 1) => {
    const p = need(parentId); if (!p) return;
    const c = (p.choices || []).find(x => x && x.label === choiceLabel);
    if (!c) return report.push(`⚠ ${parentId}: choice ${choiceLabel} not found`);
    if (!byId.get(id)) {
      const nb = JSON.parse(JSON.stringify(p));
      Object.assign(nb, { id, label, description, choices: BACK() });
      delete nb.memoryText;
      nb.inject = { repeatable: true, oncePerHex: false, requires: [{ flag: "storyPhase", gte: act }] };
      camp.beats.splice(camp.beats.indexOf(p) + 1, 0, nb); byId.set(id, nb);
      changes++; report.push(`✚ ${id}: new answer beat (${label})`);
    } else report.push(`· ok ${id} exists`);
    if (c.next === id && !c.description) return report.push(`· ok ${parentId}: ${choiceLabel} → ${id}`);
    c.next = id; c.description = ""; changes++; report.push(`✚ ${parentId}: ${choiceLabel} → ${id} (no more dead end)`);
  };

  answer("ag_wick_the_flame", "\"Where is your order from?\"", "ag_wick_the_order", "Allesh-Gilliam — The Order of the Old Routes",
    "\"The old routes,\" he says, which is not a place. \"We go where the flame is thin.\"\n\nHe says it the way other people give a street address, and waits, politely, to see if you need directions.");
  answer("ag_wick_the_flame", "\"Can I watch you trim?\"", "ag_wick_trim_dusk", "Allesh-Gilliam — The Stubborn Candle",
    "\"At dusk. The third candle from the door is the stubborn one.\"\n\nHe says it lightly. It is a strange thing to tell a stranger, and he tells it anyway.", 2);
  // "Look for them next time…" was a non-answer (Dave 10-26) → a real question; his directions are what ag_wick_shrine pays off on the Act-2 ride up
  { const b = need("ag_wick_the_shrines"), c = (b?.choices || []).find(x => x && x.label === "Look for them next time you're headed up the mountain.");
    if (c) { c.label = "\"Where's the first one?\""; changes++; report.push("✚ ag_wick_the_shrines: \"Look for them next time…\" → \"Where's the first one?\""); } }
  answer("ag_wick_the_shrines", "\"Where's the first one?\"", "ag_wick_shrines_later", "Allesh-Gilliam — Where the Road Bends",
    "He looks genuinely pleased that you asked. \"An hour above the last farm on the Khezek road, where it bends hard enough to make a mule think. A niche in the rock, a flat stone, a wax candle. You'll know it. Nobody else trims them like I do.\"\n\nHe holds up a finger, gently. \"Leave it as you find it.\"\n\nSomething to watch for, next time the road takes you up the mountain.");
  answer("ag_wick_the_bed", "\"What's on the slate?\"", "ag_wick_the_slate", "Allesh-Gilliam — The Slate",
    "\"Times,\" he says. \"I like to know when things are.\"\n\nHe doesn't take it out to show you. He doesn't seem to need to look.");

  console.log(`[wick dead ends 2026-10-26] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-wick-dead-ends-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Wick's questions lead back to him now.`);
})();

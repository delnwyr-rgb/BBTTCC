/* patch-unquested-beats-2026-10-21.macro.js — 8 beats the Beat Builder showed with no quest (A1·B51, A1·B57, …).
 *
 * The ruling-22 seeding (2026-10-18) added the Vacancy Heist + the Absolutely Reliable lease Parley without a
 * `questId`, so the Builder dropped them in its "unquested" pile even though the story engine (beat.story.quest)
 * files them correctly. Owner asked (2026-10-21) to also move the Forest of Early Tifaret "Back Out" exit.
 *
 *  - The 7 ruling-22 beats take the questId their story siblings use most (Allesh-Gilliam / Furrier's Fixit Farm).
 *  - forest_of_tifaret_back_out takes the questId every other Forest beat uses (The Forest of Early Tifaret).
 *  - questStep: parent's step + 0.1 when the entry beat has a numeric step (Forest: 40 → 40.1); otherwise left unset,
 *    so the Builder keeps ordering them by shelf position (giving them a number would jump them to the top).
 *  Road encounters (42) and system beats (Day's End, Watcher, Rite of Atonement) stay unquested by design.
 *  Idempotent; DRY_RUN default true; downloads a backup of `campaigns` first. GM only.
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
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const byId = new Map(beats.map(b => [b.id, b]));
  const qraw = game.settings.get(NS, "quests"); const qs = typeof qraw === "string" ? JSON.parse(qraw) : qraw;
  const qName = (id) => qs?.[id]?.name || qs?.[id]?.label || id;

  // questId most used by beats whose story.quest matches / whose id matches a pattern
  const commonQuest = (pred) => { const n = {}; for (const b of beats) if (b.questId && pred(b)) n[b.questId] = (n[b.questId] || 0) + 1; return Object.entries(n).sort((a, c) => c[1] - a[1])[0]?.[0] || null; };
  const PLAN = [
    { ids: ["ag_wick_room_heist_offer", "ag_wick_room_caught"], quest: () => commonQuest(b => b.story?.quest === "allesh_gilliam") },
    { ids: ["reliable_lease_parley", "reliable_parley_renewed", "reliable_parley_keys", "reliable_parley_stalemate", "reliable_parley_lost"], quest: () => commonQuest(b => b.story?.quest === "fixit_farm") },
    { ids: ["forest_of_tifaret_back_out"], quest: () => commonQuest(b => /tifaret|tiphareth/i.test(b.id) && b.id !== "forest_of_tifaret_back_out") }
  ];
  const parentOf = (id) => beats.find(b => (b.choices || []).some(c => c?.next === id || c?.failNext === id)) || null;

  const report = []; let changes = 0;
  for (const p of PLAN) {
    const q = p.quest();
    if (!q) { report.push(`⚠ no sibling quest found for ${p.ids.join(", ")}`); continue; }
    for (const id of p.ids) {
      const b = byId.get(id);
      if (!b) { report.push(`⚠ ${id}: not found`); continue; }
      const par = parentOf(id);
      const pStep = Number(par?.questStep);
      const step = (par && par.questId === q && par.questStep != null && Number.isFinite(pStep)) ? Math.round((pStep + 0.1) * 100) / 100 : null;
      const curQ = String(b.questId || ""), curS = b.questStep ?? null;
      if (curQ === q && (step === null || curS === step)) { report.push(`· ok ${id}: ${qName(q)}${curS != null ? " #" + curS : ""}`); continue; }
      b.questId = q;
      if (step !== null) b.questStep = step;
      changes++;
      report.push(`✚ ${id} (${b.label || ""}) → ${qName(q)}${step !== null ? ` #${step} (after ${par.id})` : " (order by shelf)"}`);
    }
  }

  const summary = `unquested beats — ${changes} change(s)${DRY_RUN ? " (DRY RUN — nothing written)" : ""}`;
  console.log("[patch-unquested-beats]", summary); console.log(report.join("\n"));
  await ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id), speaker: { alias: "Bad Eden" },
    content: `<div style="border-left:3px solid #c9a227;padding:.35em .6em;"><b>${foundry.utils.escapeHTML(summary)}</b><pre style="white-space:pre-wrap;font-size:.8em;max-height:420px;overflow:auto;margin:.3em 0 0;">${foundry.utils.escapeHTML(report.join("\n"))}</pre></div>` });
  if (DRY_RUN || !changes) return;
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-unquested-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(summary);
})();

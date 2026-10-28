/**
 * patch-quest-log-pilot-errata-2026-10-28.macro.js
 * Quest Log pass, PILOT (Dave 2026-10-28: "the quest description would accumulate brief descriptions of what the
 * players have already learned/done in the previous beat(s), and then give explicit instructions on the next step").
 *
 * Rewrites the story-script words behind the Errata Society's active quests (campaign.story.scripts):
 *   · description → what the players know when they accept (no later reveals)
 *   · step.logged → one past-tense line the Log lists under "So far:" once the step is done (new field)
 *   · step.line / hereLine → a plain instruction (who, where, the verb) for "Next:"
 *   · step.where → the destination hex of a letter / ride step, for the Log's "Where:" line (new field)
 *   · chapter.line, and Pike's invitation text (beat inviteText)
 * Data: quest-log-pilot-errata-2026-10-28.json. Safe by construction: a field is written only when its live value
 * still equals the recorded old one — anything edited since is reported, never overwritten. Idempotent; MODE
 * "restore" puts every old value back. Backup of `campaigns` goes to Data/bbttcc-exports/ before any write. GM only.
 * (That One Night — valhaulan_spine — is a CODE script, story-scripts.js; it ships with the module, not this macro.)
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const MODE = "apply";                 // "apply" | "restore"
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const data = await fetch("modules/bbttcc-campaign/tools/quest-log-pilot-errata-2026-10-28.json", { cache: "no-store" }).then(r => r.json());
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));   // a TRUE copy (deepClone made a write silently no-op, 2026-10-22)
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const report = { changed: [], already: 0, conflicts: [] };
  const [FROM, TO] = MODE === "restore" ? ["new", "old"] : ["old", "new"];
  const apply = (obj, field, row, where) => {
    const cur = obj[field] == null ? "" : String(obj[field]);
    if (cur === String(row[TO] ?? "")) { report.already++; return; }
    if (cur !== String(row[FROM] ?? "")) { report.conflicts.push(`${where}.${field}: live text differs from the expected — skipped`); return; }
    if (row[TO] === "" || row[TO] == null) delete obj[field]; else obj[field] = row[TO];
    report.changed.push(`${where}.${field}`);
  };
  for (const [key, sp] of Object.entries(data.scripts || {})) {
    const sc = camp.story?.scripts?.[key];
    if (!sc) { report.conflicts.push(`${key}: no such script in campaign.story.scripts`); continue; }
    if (sp.description) apply(sc, "description", sp.description, key);
    const steps = [...(Array.isArray(sc.arrival?.steps) ? sc.arrival.steps : []), ...(Array.isArray(sc.steps) ? sc.steps : [])];
    for (const [sid, fields] of Object.entries(sp.steps || {})) {
      const st = steps.find(x => x && x.id === sid);
      if (!st) { report.conflicts.push(`${key}·${sid}: step not found`); continue; }
      for (const [f, row] of Object.entries(fields)) apply(st, f, row, `${key}·${sid}`);
    }
    for (const [ck, fields] of Object.entries(sp.chapters || {})) {
      const ch = sc.chapters?.[ck];
      if (!ch) { report.conflicts.push(`${key}·chapter ${ck}: not found`); continue; }
      for (const [f, row] of Object.entries(fields)) apply(ch, f, row, `${key}·${ck}`);
    }
  }
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  for (const [bid, fields] of Object.entries(data.beats || {})) {
    const b = beats.find(x => x && String(x.id) === bid);
    if (!b) { report.conflicts.push(`beat ${bid}: not found`); continue; }
    for (const [f, row] of Object.entries(fields)) apply(b, f, row, `beat ${bid}`);
  }
  console.log(`[quest-log pilot · ${MODE}] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${report.changed.length} change(s), ${report.already} already, ${report.conflicts.length} conflict(s)`, report);
  window.__questLogPilotReport = { dry: DRY_RUN, mode: MODE, changed: report.changed.length, already: report.already, conflicts: report.conflicts };
  if (DRY_RUN) return ui.notifications.info(`Quest Log pilot (dry run): ${report.changed.length} change(s), ${report.conflicts.length} conflict(s) — see console.`);
  if (!report.changed.length) return ui.notifications.info("Quest Log pilot: nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-quest-log-pilot-${MODE}-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  try { await game.bbttcc?.api?.campaign?.story?.data?.reapply?.(); } catch (_e) {}
  ui.notifications.info(`Quest Log pilot ${MODE === "restore" ? "restored" : "applied"}: ${report.changed.length} change(s).`);
})();

/**
 * patch-quest-log-drafts-2026-10-28.macro.js
 * Quest Log pass, ROLL-OUT (Dave 2026-10-28: "make the draft changes — they are so much better than what is there
 * now. Writer will wordsmith from there"). Applies the writer-sheet drafts for the 20 scripts after the Errata pilot
 * (description, step line / logged / hereLine / where, chapter lines), Dave's answers on the sheet (Where hexes,
 * the finale on the Saltwake Coast, the Ninth Guest accepted on arrival, Dunmore Kell named in the Sexton scene,
 * the Bjornholt spelling), and — when its data file is present — the "Also open" door lines.
 * Data files (DATA, applied in order): quest-log-drafts-apply-2026-10-28.json, quest-log-doors-apply-2026-10-28.json.
 * Safe by construction: every field / beat path is written only when its live value still equals the recorded old
 * one; anything edited since is reported, never overwritten. Idempotent; MODE "restore" puts every old value back.
 * Backup of `campaigns` goes to Data/bbttcc-exports/ before any write. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const MODE = "apply";                 // "apply" | "restore"
  const DATA = [
    "modules/bbttcc-campaign/tools/quest-log-drafts-apply-2026-10-28.json",
    "modules/bbttcc-campaign/tools/quest-log-doors-apply-2026-10-28.json"
  ];
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));   // a TRUE copy (deepClone made a write silently no-op, 2026-10-22)
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const report = { changed: [], already: 0, conflicts: [], files: [] };
  const [FROM, TO] = MODE === "restore" ? ["new", "old"] : ["old", "new"];
  const S = (v) => v == null ? "" : String(v);
  const apply = (obj, field, row, where) => {
    if (S(obj[field]) === S(row[TO])) { report.already++; return; }
    if (S(obj[field]) !== S(row[FROM])) { report.conflicts.push(`${where}.${field}: live text differs from the expected — skipped`); return; }
    if (row[TO] === "" || row[TO] == null) delete obj[field]; else obj[field] = row[TO];
    report.changed.push(`${where}.${field}`);
  };
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  for (const url of DATA) {
    let data = null;
    try { const r = await fetch(url, { cache: "no-store" }); if (r.ok) data = await r.json(); } catch (_e) {}
    if (!data) { report.files.push(`${url.split("/").pop()}: not present — skipped`); continue; }
    report.files.push(url.split("/").pop());
    for (const [key, sp] of Object.entries(data.scripts || {})) {
      const sc = camp.story?.scripts?.[key];
      if (!sc) { report.conflicts.push(`${key}: no such script`); continue; }
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
      for (const [did, fields] of Object.entries(sp.doors || {})) {
        const d = (Array.isArray(sc.doors) ? sc.doors : []).find(x => x && x.id === did);
        if (!d) { report.conflicts.push(`${key}·door ${did}: not found`); continue; }
        for (const [f, row] of Object.entries(fields)) apply(d, f, row, `${key}·door ${did}`);
      }
    }
    for (const bp of (data.beatPaths || [])) {
      const b = beats.find(x => x && String(x.id) === bp.beat);
      if (!b) { report.conflicts.push(`beat ${bp.beat}: not found`); continue; }
      const parts = String(bp.path).split("."); const last = parts.pop();
      let o = b; for (const p of parts) o = (o == null) ? null : o[Array.isArray(o) ? Number(p) : p];
      if (!o || typeof o !== "object") { report.conflicts.push(`beat ${bp.beat}.${bp.path}: path not found`); continue; }
      apply(o, last, bp, `beat ${bp.beat}.${parts.join(".")}`);
    }
  }
  console.log(`[quest-log drafts · ${MODE}] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${report.changed.length} change(s), ${report.already} already, ${report.conflicts.length} conflict(s)`, report);
  window.__questLogDraftsReport = { dry: DRY_RUN, mode: MODE, changed: report.changed.length, already: report.already, conflicts: report.conflicts, files: report.files };
  if (DRY_RUN) return ui.notifications.info(`Quest Log drafts (dry run): ${report.changed.length} change(s), ${report.conflicts.length} conflict(s) — see console.`);
  if (!report.changed.length) return ui.notifications.info("Quest Log drafts: nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-quest-log-drafts-${MODE}-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  try { await game.bbttcc?.api?.campaign?.story?.data?.reapply?.(); } catch (_e) {}
  ui.notifications.info(`Quest Log drafts ${MODE === "restore" ? "restored" : "applied"}: ${report.changed.length} change(s).`);
})();

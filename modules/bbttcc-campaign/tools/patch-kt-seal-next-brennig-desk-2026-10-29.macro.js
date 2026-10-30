/**
 * patch-kt-seal-next-brennig-desk-2026-10-29.macro.js — Dave, 10-29:
 *  1) the Quest Log "Next" for the seal told players there was no point going ("you won't be able to read the carvings
 *     on your own") and that they'd be attacked ("the gallery isn't empty"). "Let's just say go with Sable."
 *       story khezek_tor.seal  line → "Go with Sable Nine to the sealed shaft."
 *  2) Brennig's Desk (he's counting crates): "Brennig's answer doesn't make any sense, on any of these 3 lines." The three
 *     answer beats now say the canon plainly (bible §3 + cast table): the humming crate = a bad batch since the Cough; the
 *     ore is proud of the family that dug it (his own, and he doesn't know it); the middle brother is HIS brother, still
 *     holding the manifest below Four; ask Sable. Dave's line ends the brother answer: "Guess it was his manifest destiny. Heh."
 *       ans_kt_brennig_desk_count · ans_kt_brennig_desk_middle_brother · ans_kt_brennig_desk_where_manifest  (description)
 * (patch-tor-wrath-seal-gate-2026-10-28 set the old line; it only rewrites a line that differs from its own text,
 *  so a rerun of that macro WOULD put the old line back — rerun this one after it if that ever happens.)
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const report = []; const conflicts = []; let changes = 0;
  const say = (m) => { changes++; report.push(m); };

  const S = camp.story?.scripts || {};
  const step = (sid, stid) => (S[sid]?.steps || []).find(x => x.id === stid);
  const setLine = (sid, stid, line) => {
    const s = step(sid, stid); if (!s) return conflicts.push(`story ${sid}.${stid}: not found`);
    if (s.line !== line) { report.push(`   was: ${s.line ?? "(none)"}`); s.line = line; say(`✎ story ${sid}.${stid}: Quest Log line → ${line}`); }
  };
  setLine("khezek_tor", "seal", "Go with Sable Nine to the sealed shaft.");

  // Brennig's Desk answers (the answer beats made by patch-kt-official-word-answers-2026-10-28).
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const setText = (id, text) => {
    const b = beats.find(x => x && String(x.id) === id); if (!b) return conflicts.push(`${id}: beat not found`);
    if (b.description !== text) { report.push(`   was: ${b.description ?? "(none)"}`); b.description = text; say(`✎ ${id}: answer text`); }
  };
  setText("ans_kt_brennig_desk_count",
    "You count with him. At the second crate he stops and lays his hand flat on the lid. It's humming. \"Bad batch. They've all hummed since the Cough.\" He says the ore is proud of the family that dug it, and tells you about them: brothers, a seam, a lot of hard years. He doesn't seem to know he's describing his own family. \"Three,\" he says, and keeps counting.");
  setText("ans_kt_brennig_desk_middle_brother",
    "He tells it once, as a joke, the way you tell something you can't tell any other way. His brother went down the cage shaft the night the mountain coughed, after a manifest somebody dropped, and didn't come back up. \"Guess it was his manifest destiny. Heh.\"");
  setText("ans_kt_brennig_desk_where_manifest",
    "\"Below Four. Still in my brother's hand, I'd guess.\" He doesn't look up from the crates. \"Sable's the only one who goes below Four. Ask Sable.\"");

  console.log(`[kt seal next + brennig desk 2026-10-29] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__ktSealBrennig = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-kt-seal-brennig-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the seal's Next says go with Sable; Brennig's desk answers rewritten.`);
})();

/**
 * patch-kt-official-word-after-desk-2026-10-28.macro.js — Dave, 10-28: "Open the door after Brennig's desk, keep the thin
 * ending please."
 * The Official Word door (switchback hub + the cookline door) waited for the manifest AND the bench, so "Say it with what
 * you have" (the thin ending — hidden while the manifest is in hand) could never be reached. Both doors, and the beat's own
 * inject.requires (what the Director / Visualizer read), now open once Brennig's desk has played:
 *   nothing in hand → thin · the manifest → the half-said word · manifest + roster → the full ending.
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
  const beats = Array.isArray(camp.beats) ? camp.beats : (camp.beats = Object.values(camp.beats || {}));
  const byId = (id) => beats.find(b => b && String(b.id) === id);
  const J = (x) => JSON.stringify(x);
  const report = []; const conflicts = []; let changes = 0;
  const OW = "quest_kt_official_word", WORD = "kt_official_word", DESK = "kt_brennig_desk";
  const DOOR_REQ = [{ questBucket: OW, is: "active" }, { beatMark: DESK }, { beatMark: WORD, not: true }];
  for (const hid of ["khezek_tor_quest_scene", "khezek_tor_camp_door_exterior"]) {
    const ch = (byId(hid)?.choices || []).find(c => c?.next === WORD);
    if (!ch) { conflicts.push(`${hid}: Official Word door not found`); continue; }
    if (J(ch.requires || null) === J(DOOR_REQ)) continue;
    ch.requires = DOOR_REQ; changes++; report.push(`✎ ${hid}: "${ch.label}" opens after Brennig's desk`);
  }
  const w = byId(WORD);
  if (!w) conflicts.push(`${WORD}: not found`);
  else {
    const req = Array.isArray(w.inject?.requires) ? w.inject.requires : [];
    if (req.some(r => r?.beatMark === "kt_place_setting")) {
      w.inject.requires = req.map(r => (r?.beatMark === "kt_place_setting" && !r.not) ? { beatMark: DESK } : r);
      changes++; report.push(`✎ ${WORD}: its own requires wait for the desk, not the bench`);
    }
  }
  console.log(`[kt official word after desk 2026-10-28] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__ktOwDesk = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-kt-ow-desk-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the Official Word opens after Brennig's desk.`);
})();

/**
 * patch-wendigo-fails-2026-10-30.macro.js — Dave, 10-29/30: keep the Wendigo "go around" fail options, but make the
 * check matter. The rude Wendigo still count (the rung climbs on the fail beat — WENDIGO_TRAVEL_BEAT_IDS, unchanged),
 * but you don't get your detour: the fail beat now offers the encounter's OTHER options (same checks, same routes),
 * never the one you just failed. Fixes the Acid Bog fail dead end ("maybe try something else" with no choices).
 *   acid_bog_logistics_failure            ← enc_acid_bog minus "Look for another way around"
 *   enc_broken_bridge_go_around_fail      ← enc_broken_bridge minus "Find another route"
 *   enc_minor_radiation_pocket_go_around_fail ← enc_minor_radiation_pocket minus "Go Around"
 * Fail text gets one closing line pointing back at the road. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
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
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const B = (id) => beats.find(x => x && String(x.id) === id);
  const report = []; const conflicts = []; let changes = 0;
  const J = (x) => JSON.stringify(x);

  const ROWS = [
    { fail: "acid_bog_logistics_failure", parent: "enc_acid_bog", failedNext: "acid_bog_logistics_success",
      tail: "So it's the bog, then. Pick another way through." },
    { fail: "enc_broken_bridge_go_around_fail", parent: "enc_broken_bridge", failedNext: "enc_broken_bridge_go_around_success",
      tail: "No detour, then. The bridge is still there, still broken. Pick another way across." },
    { fail: "enc_minor_radiation_pocket_go_around_fail", parent: "enc_minor_radiation_pocket", failedNext: "enc_minor_radiation_pocket_go_around",
      tail: "No way around, then. You're still standing in it. Pick another way out." }
  ];
  for (const r of ROWS) {
    const f = B(r.fail), p = B(r.parent);
    if (!f) { conflicts.push(`${r.fail}: beat not found`); continue; }
    if (!p) { conflicts.push(`${r.parent}: beat not found`); continue; }
    const others = (p.choices || []).filter(c => String(c?.next || "") !== r.failedNext);
    if (others.length === (p.choices || []).length) { conflicts.push(`${r.parent}: no choice routes to ${r.failedNext}`); continue; }
    const want = others.map(c => { const o = { label: c.label, next: c.next || "", description: c.description || "", checkStat: c.checkStat || "", checkDC: Number(c.checkDC) || 0, failNext: c.failNext || "" }; if (c.requires) o.requires = JSON.parse(J(c.requires)); if (c.openTravel) o.openTravel = JSON.parse(J(c.openTravel)); return o; });
    if (J(f.choices || []) !== J(want)) { report.push(`   was: ${(f.choices || []).map(c => c.label).join(" / ") || "(no choices)"}`); f.choices = want; changes++; report.push(`✎ ${r.fail}: choices → ${want.map(c => c.label).join(" / ")}`); }
    const d = String(f.description || "");
    if (!d.includes(r.tail)) { f.description = d.replace(/\s*Uh, maybe try something else\.\s*$/i, "").trimEnd() + "\n\n" + r.tail; changes++; report.push(`✎ ${r.fail}: closing line`); }
  }

  console.log(`[wendigo fails 2026-10-30] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__wendigoFails = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-wendigo-fails-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — a failed Wendigo detour sends you back to the other ways through.`);
})();

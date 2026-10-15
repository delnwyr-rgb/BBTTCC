/* patch-broken-bridge-2026-10-15.macro.js — the Broken Bridge gets a real
 * ending (owner report 2026-10-15: "no true conclusion beat accessible, and
 * the buttons don't point to the right places").
 *
 * What was wrong (backup-campaigns-before-golden15-queue, 2026-10-13):
 *  · "Convince the bridge" on enc_broken_bridge routed success → the WADE
 *    success beat and fail → the GO-AROUND fail beat (the 2026-08-22 stopgap),
 *    while its own two beats — enc_broken_bridge_convince_success /
 *    _convince_fail — sat orphaned, never reachable. The log read
 *    "Diplomacy FAIL → Broken Bridge (Go Around - Fail)", which also bumped
 *    the Wendigo rung for a roll that never met a Wendigo.
 *  · All six outcome beats carried a copy-pasted trio of the parent's choices
 *    (Find another route / Wade on through / Convince…) with next:"" — three
 *    dead buttons and no close. Same disease as the bandit vestige strip
 *    (patch-bandit-vestigial-choices, 2026-08-29).
 *  · Label typo "Broken Bridge (Convince, Fail))".
 *  · convince_success carried `casualties.atrocity` — the Darkness escalator
 *    tag — on a beat where a bridge agrees to be a bridge again.
 *
 * Fix: Convince → its own success / fail beats; every outcome beat ends on a
 * single "Onward" (the engine's retry-in-chain re-offers the bridge after a
 * failed check, so fail beats need no loop-back button). Idempotent; DRY_RUN
 * default true; backs up `campaigns` before the write. Run as GM.
 */
(async () => {
  const DRY_RUN = false;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw); // never mutate the live cache on a dry run
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const byId = new Map(beats.map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  const ONWARD = () => ({ label: "Onward", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" });
  const isVestige = (c) => /find another route|wade on through|convince the bridge/i.test(String(c?.label || ""));

  // 1. Convince routes to its own beats.
  {
    const b = byId.get("enc_broken_bridge");
    if (!b) report.push("⚠ enc_broken_bridge: NOT FOUND");
    else {
      const c = (b.choices || []).find(x => /convince the bridge/i.test(String(x?.label || "")));
      if (!c) report.push("⚠ enc_broken_bridge: no Convince choice");
      else {
        const want = { next: "enc_broken_bridge_convince_success", failNext: "enc_broken_bridge_convince_fail" };
        for (const k of Object.keys(want)) if (!byId.get(want[k])) report.push(`⚠ target ${want[k]} missing`);
        if (c.next !== want.next || c.failNext !== want.failNext) {
          report.push(`✚ enc_broken_bridge "Convince": next ${c.next} → ${want.next}; failNext ${c.failNext} → ${want.failNext}`);
          Object.assign(c, want); changes++;
        } else report.push("· ok enc_broken_bridge Convince routing");
      }
    }
  }

  // 2. Outcome beats: strip the vestigial trio → one Onward.
  const OUTCOMES = [
    "enc_broken_bridge_go_around_success", "enc_broken_bridge_go_around_fail",
    "enc_broken_bridge_wade_success", "enc_broken_bridge_wade_fail",
    "enc_broken_bridge_convince_success", "enc_broken_bridge_convince_fail"
  ];
  for (const id of OUTCOMES) {
    const b = byId.get(id);
    if (!b) { report.push(`⚠ ${id}: NOT FOUND — skipped`); continue; }
    const chs = Array.isArray(b.choices) ? b.choices : [];
    const vestiges = chs.filter(isVestige);
    const kept = chs.filter(c => !isVestige(c));
    if (vestiges.length || !chs.length) {
      b.choices = kept.length ? kept : [ONWARD()];
      changes++;
      report.push(`✚ ${id}: stripped ${vestiges.length} vestigial choice(s)${kept.length ? `, kept ${kept.length}` : " → Onward"}`);
    } else report.push(`· ok ${id}: ${chs.length} choice(s), no vestiges`);
  }

  // 3. Label typo.
  {
    const b = byId.get("enc_broken_bridge_convince_fail");
    if (b && b.label === "Broken Bridge (Convince, Fail))") { b.label = "Broken Bridge (Convince, Fail)"; changes++; report.push("✚ convince_fail label: dropped the stray paren"); }
  }

  // 4. Stray Darkness-escalator tag on a success beat.
  {
    const b = byId.get("enc_broken_bridge_convince_success");
    if (b && /casualties\.atrocity|\batrocity\b/.test(String(b.tags || ""))) {
      b.tags = String(b.tags).split(/\s+/).filter(t => t && !/^(casualties\.)?atrocity$/.test(t)).join(" ");
      changes++; report.push("✚ convince_success: removed casualties.atrocity tag");
    }
  }

  console.log(`[patch-broken-bridge] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Broken Bridge patch DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Broken Bridge patch: nothing to do.");
  try {
    (foundry.utils.saveDataToFile ?? saveDataToFile)(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
      `backup-campaigns-before-broken-bridge-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Broken Bridge patch APPLIED: ${changes} change(s). The bridge now ends.`);
})();

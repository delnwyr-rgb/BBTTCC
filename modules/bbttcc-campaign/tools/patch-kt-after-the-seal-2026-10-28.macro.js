/**
 * patch-kt-after-the-seal-2026-10-28.macro.js
 * Dave's 10-28 run (turn 2 in Khezek-Tor, Seal restored, Spark of Yesod earned) hit three content problems:
 *   1. The Lift Hall kept offering "Ask Sable Nine to take you down to the sealed gallery" after the Seal was decided —
 *      it walks the table back through the Seal it already settled. Gated: hidden once restore / redirect / break played.
 *   2. "Talking to Drax doesn't get you anywhere." The Quest Log says "Go below with Calder" (The Mine That Answered Back)
 *      and next "Talk to Calder while he works" (The Official Word), but both openers were director-only — no door.
 *      Calder's conversation gains a door to each (before Leave), hidden once that quest is completed; the Official Word
 *      door hides once its opener has played.
 *   3. The Restore outcome said "there was a Valhaulan Sympathizer group in town … got collared" — the line that first
 *      named the cult, which now arrives later in the story. Paragraph removed; the rest of the outcome is unchanged.
 * Idempotent (rerun = 0). DRY_RUN first. Backup of `campaigns` → Data/bbttcc-exports/. GM only.
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
  const report = []; const conflicts = []; let changes = 0;

  // 1 — the Lift Hall's sealed-gallery door closes once the Seal is decided
  const SEAL_DONE = ["khezek_tor_the_vaulhaulan_seal_restore", "khezek_tor_the_vaulhaulan_seal_redirect", "khezek_tor_the_vaulhaulan_seal_break"];
  const lift = byId("khezek_tor_the_lift_hall");
  const liftCh = (lift?.choices || []).find(c => c?.next === "khezek_tor_valhaulan_seal_quest_acceptance");
  if (!liftCh) conflicts.push("khezek_tor_the_lift_hall: sealed-gallery choice not found");
  else {
    liftCh.gate = Array.isArray(liftCh.gate) ? liftCh.gate : [];
    for (const id of SEAL_DONE) {
      if (liftCh.gate.some(g => g?.beatMark === id && g.not === true)) continue;
      liftCh.gate.push({ beatMark: id, not: true }); changes++;
      report.push(`✎ Lift Hall "${liftCh.label}": hidden once ${id} played`);
    }
  }

  // 2 — Calder's doors
  const DOORS = [
    { label: "Go below with you — the new shaft on Level Four.", next: "khezek_tor_mine_that_answered_back_quest_acceptance",
      gate: [{ flag: "storyPhase", gte: 2 }, { questBucket: "quest_A050y4VtoZFzOfGz", isNot: "completed" }] },
    { label: "\"What do the crews need to hear?\"", next: "kt_official_word_open",
      gate: [{ flag: "storyPhase", gte: 2 }, { questBucket: "quest_kt_official_word", isNot: "completed" }, { beatMark: "kt_official_word_open", not: true }] }
  ];
  const drax = byId("khezek_tor_drax_calder_convo");
  if (!drax) conflicts.push("khezek_tor_drax_calder_convo: not found");
  else {
    drax.choices = Array.isArray(drax.choices) ? drax.choices : [];
    for (const d of DOORS) {
      if (!byId(d.next)) { conflicts.push(`${d.next}: target beat missing`); continue; }
      if (drax.choices.some(c => c?.next === d.next)) continue;
      const leave = drax.choices.findIndex(c => /^leave$/i.test(String(c?.label || "").trim()));
      const ch = { label: d.label, next: d.next, description: "", checkStat: "", checkDC: 0, failNext: "", gate: d.gate };
      if (leave >= 0) drax.choices.splice(leave, 0, ch); else drax.choices.push(ch);
      changes++; report.push(`+ Calder: "${d.label}" → ${d.next}`);
    }
  }

  // 3 — the Restore outcome stops naming the cult
  const restore = byId("khezek_tor_the_vaulhaulan_seal_restore");
  const CULT = /\n*Turns out there was a Valhaulan Sympathizer group in town\.[^\n]*\n?/;
  if (!restore) conflicts.push("khezek_tor_the_vaulhaulan_seal_restore: not found");
  else if (CULT.test(String(restore.description || ""))) {
    restore.description = String(restore.description).replace(CULT, "\n\n").replace(/\n{3,}/g, "\n\n").trim();
    changes++; report.push("✎ Restore outcome: Sympathizer paragraph removed");
  }

  console.log(`[kt after the seal 2026-10-28] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-kt-after-seal-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Khezek-Tor after the Seal.`);
})();

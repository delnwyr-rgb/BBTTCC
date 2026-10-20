/* patch-r2-acts46-2026-10-20.macro.js — Story Review Ledger ROUND 2, "Acts 4–6" rows 1–4 (all Accept, Dave 2026-10-20).
 *   1  finale_wick_at_the_gate   the drop line becomes a {{#played odie_wick_drops_it}} span (the beat also fires when Sklar turned and Wick never did)
 *   2  maneuver_vault_echo_archive_success "brand new" · maneuver_vault_the_containment_loop_let_pip_learn_more "stretched taut"
 *   3  enc_forgotten_yesterdays_donny_respect / _mixed / _good   punctuation only; Donny's words stay
 *   4  sixteen quest-closing outcome shells get a Continue row (Dave: "Continue on each."):
 *      enc_forgotten_yesterdays_resolution_good/_neutral/_bad · maneuver_vault_pip_shaken/_pip_changed/_pip_absored ·
 *      raid_thatwards_outcome_neutral_fail/_outcome_hostile_fail/_rewards_major/_rewards_standard/_rewards_intel_only ·
 *      gloomgill_passed/_failed/_fought/_fled · enc_hidden_vault_resolution_hostile/_neutral
 *  Guarded by the live baseline; idempotent; DRY_RUN default true; backs up `campaigns`. GM only.
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
  const rep = (id, from, to, note) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; }
    const d = String(b.description || "");
    if (d.includes(to)) { report.push(`· ok ${id}: ${note}`); return; }
    if (!d.includes(from)) { report.push(`⚠ ${id}: baseline text not found for "${note}"`); return; }
    b.description = d.replace(from, to); changes++; report.push(`✚ ${id}: ${note}`);
  };

  /* 1 · the drop, only if Wick dropped it */
  rep("finale_wick_at_the_gate",
    "The drop is on a floor in the Hex Room where he put it. The habit outlived the job;",
    "{{#played odie_wick_drops_it}}The drop is on a floor in the Hex Room where he put it.{{else}}The last drop went up the mountain on time; nobody has sent another.{{/played}} The habit outlived the job;",
    "the drop line is a played span");
  /* 2 · Vault typos */
  rep("maneuver_vault_echo_archive_success", "It's like a band new martial arts skill", "It's like a brand new martial arts skill", "brand new");
  rep("maneuver_vault_the_containment_loop_let_pip_learn_more", "His limbs are stretched taught with strain.", "His limbs are stretched taut with strain.", "stretched taut");
  /* 3 · Donny's punctuation */
  rep("enc_forgotten_yesterdays_donny_respect", "Donny nods slowly,and blinks even more slowly.", "Donny nods slowly, and blinks even more slowly.", "slowly, and");
  rep("enc_forgotten_yesterdays_donny_mixed", "instead of a cautionary tale.\n\nAnd as we say among us dragons", "instead of a cautionary tale.\"\n\nAnd as we say among us dragons", "Donny's quote closes before the dragons' saying");
  rep("enc_forgotten_yesterdays_donny_good", "Then, probably, lots of skateboarding\" He pauses.", "Then, probably, lots of skateboarding.\" He pauses.", "full stop after skateboarding");
  /* 4 · Continue on each */
  const SHELLS = ["enc_forgotten_yesterdays_resolution_good", "enc_forgotten_yesterdays_resolution_neutral", "enc_forgotten_yesterdays_resolution_bad",
    "maneuver_vault_pip_shaken", "maneuver_vault_pip_changed", "maneuver_vault_pip_absored",
    "raid_thatwards_outcome_neutral_fail", "raid_thatwards_outcome_hostile_fail", "raid_thatwards_rewards_major", "raid_thatwards_rewards_standard", "raid_thatwards_rewards_intel_only",
    "gloomgill_passed", "gloomgill_failed", "gloomgill_fought", "gloomgill_fled",
    "enc_hidden_vault_resolution_hostile", "enc_hidden_vault_resolution_neutral"];
  for (const id of SHELLS) {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); continue; }
    const has = Array.isArray(b.choices) && b.choices.some(c => c && String(c.label || "").trim());
    if (has) { report.push(`· ok ${id}: already has a choice row`); continue; }
    b.choices = [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }];
    changes++; report.push(`✚ ${id}: Continue`);
  }

  console.log(`[r2 acts46 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-r2-acts46-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — round 2, Acts 4–6.`);
})();

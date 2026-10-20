/* patch-r2-act3-2026-10-20.macro.js — Story Review Ledger ROUND 2, "Act 3" rows 1–5 (all Accept, Dave 2026-10-20).
 *   1  balcones_faulting_you_line_choices   the repeat menu's "Impose your will" op.culture 30 → op.violence 16 (same as the opening menu)
 *   2  hum_quiet_ledger                     storyPhase ≥ 4 → ≥ 2 (its twin hum_quiet_decline is 2; Two Kinds of Tent says you have read this face before)
 *   3  balcones_faulting_you_appease_spirit_fail   the sentence gets its verb
 *   4  enc_hidden_vault_council_friendly / _locals_friendly   "popcorn has a great carb-to-fiber ratio"; "centuries-long vigil"
 *   5  hod_the_vote                         memory line: "the week the light came", as Ines says
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
  const rep = (id, from, to, note, field = "description") => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; }
    const d = String(b[field] || "");
    if (d.includes(to)) { report.push(`· ok ${id}: ${note}`); return; }
    if (!d.includes(from)) { report.push(`⚠ ${id}: baseline text not found for "${note}"`); return; }
    b[field] = d.replace(from, to); changes++; report.push(`✚ ${id}: ${note}`);
  };

  /* 1 · the repeat menu's Impose */
  {
    const b = byId.get("balcones_faulting_you_line_choices");
    const c = b && (b.choices || []).find(x => /impose your will/i.test(String(x?.label || "")));
    if (!c) report.push("⚠ balcones repeat menu: Impose choice not found");
    else if (c.checkStat === "op.violence" && Number(c.checkDC) === 16) report.push("· ok balcones repeat menu: Impose is op.violence 16");
    else { c.checkStat = "op.violence"; c.checkDC = 16; changes++; report.push("✚ balcones repeat menu: Impose your will → op.violence DC 16"); }
  }
  /* 2 · the tally post opens in Act 2 */
  {
    const b = byId.get("hum_quiet_ledger");
    const rq = b && Array.isArray(b.inject?.requires) ? b.inject.requires : null;
    const g = rq && rq.find(r => r && r.flag === "storyPhase" && r.gte != null);
    if (!g) report.push("⚠ hum_quiet_ledger: storyPhase gate not found");
    else if (Number(g.gte) === 2) report.push("· ok hum_quiet_ledger: storyPhase ≥ 2");
    else { g.gte = 2; changes++; report.push("✚ hum_quiet_ledger: storyPhase ≥ 4 → ≥ 2"); }
  }
  /* 3 · the ceremony gets a verb */
  rep("balcones_faulting_you_appease_spirit_fail",
    "Your attempt at a soothing Soma style ceremony, designed to occupy the spirit with delicious delicious spiritual nourishment. Apparently, the Faultline is allergic.",
    "Your attempt at a soothing Soma-style ceremony was designed to occupy the spirit with delicious, delicious spiritual nourishment. Apparently the Faultline is allergic.",
    "the ceremony sentence gets its verb");
  /* 4 · Vault typos */
  rep("enc_hidden_vault_council_friendly", "popcorn as a great carb to fiber ratio", "popcorn has a great carb-to-fiber ratio", "carb-to-fiber");
  rep("enc_hidden_vault_locals_friendly", "their families' centuries long vigil", "their families' centuries-long vigil", "centuries-long");
  /* 5 · the vote's memory line */
  rep("hod_the_vote", "forty-one to nine, on That One Night.", "forty-one to nine, the week the light came.", "memory: the week the light came", "memoryText");

  console.log(`[r2 act3 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-r2-act3-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — round 2, Act 3.`);
})();

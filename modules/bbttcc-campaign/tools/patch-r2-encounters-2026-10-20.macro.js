/* patch-r2-encounters-2026-10-20.macro.js — Story Review Ledger ROUND 2, "Encounters and strays" rows 1, 3, 4 (Accept, Dave 2026-10-20).
 *   1  reliable_price      Gearbox's tag and the buy choice say ONE treasury (ruling 16): "30 MARKS. SO NOBODY OWNS MORE OF HER THAN THE REST." /
 *                          "Thirty marks from the treasury. She's yours: home, boat, and a hull you can finally bolt things onto." · the Parley after-text
 *                          says "Thirty marks is an opening, not a price."
 *   3  allesh_gilliam_north_gate_exterior   Dave: "North Gate Exterior is where the Avuncular Joans send off happens" → a Go in door to the
 *                          send-off speech (hidden once the speech has played) + Leave to the town walk, like every other exterior;
 *                          khezek_tor_warehouse_exterior stays view-only (Dave).
 *   4  typos: enc_bandit_ambush_win_jail label "Win (Jail)" · enc_minor_radiation_pocket_cleanse_the_darkness "its idea" ·
 *             enc_geometry_serpent_outcomes_win "off your clothes" · enc_weather_front_find_shelter "especially"
 *   (row 2, lint C02, is a lint-campaign.js change — no beat edits)
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
  const repChoice = (id, labelRe, to, note) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; }
    const c = (b.choices || []).find(x => labelRe.test(String(x?.label || "")));
    if (!c) { report.push(`⚠ ${id}: choice ${labelRe} not found`); return; }
    if (c.description === to) { report.push(`· ok ${id}: ${note}`); return; }
    c.description = to; changes++; report.push(`✚ ${id}: ${note}`);
  };

  /* 1 · one treasury */
  rep("reliable_price", "holds it up: 30 ECONOMY. EACH. Under that, smaller: SO NOBODY OWNS MORE OF HER. Under that", "holds it up: 30 MARKS. Under that, smaller: SO NOBODY OWNS MORE OF HER THAN THE REST. Under that", "Gearbox's tag: 30 marks, one treasury");
  repChoice("reliable_price", /everybody chips in/i, "Thirty marks from the treasury. She's yours: home, boat, and a hull you can finally bolt things onto.", "buy choice: from the treasury");
  repChoice("reliable_price", /talk him down/i, "Thirty marks is an opening, not a price.", "parley after-text: thirty marks");

  /* 3 · the North Gate has a door */
  {
    const b = byId.get("allesh_gilliam_north_gate_exterior");
    if (!b) report.push("⚠ north gate exterior: not found");
    else {
      const want = [
        { label: "Go in — the send-off at the gate", next: "avuncular_joans_speech", description: "", checkStat: "", checkDC: 0, failNext: "", requires: [{ beatMark: "avuncular_joans_speech", not: true }] },
        { label: "Leave", next: "allesh_gilliam_town_walk", description: "", checkStat: "", checkDC: 0, failNext: "" }
      ];
      if (JSON.stringify(b.choices || []) === JSON.stringify(want)) report.push("· ok north gate exterior: door set");
      else { b.choices = want; changes++; report.push("✚ north gate exterior: Go in → the Avuncular Joans' send-off (until it has played) · Leave → the town walk"); }
    }
  }

  /* 4 · typos */
  {
    const b = byId.get("enc_bandit_ambush_win_jail");
    if (!b) report.push("⚠ enc_bandit_ambush_win_jail: not found");
    else if (b.label === "Bandit Ambush - Win (Jail)") report.push("· ok jail label");
    else if (b.label === "Bandit Ambush - Win (Jail))") { b.label = "Bandit Ambush - Win (Jail)"; changes++; report.push("✚ jail label: one bracket"); }
    else report.push(`⚠ jail label unexpected: ${b.label}`);
  }
  rep("enc_minor_radiation_pocket_cleanse_the_darkness", "make like it was it's idea", "make like it was its idea", "its idea");
  rep("enc_geometry_serpent_outcomes_win", "half solved equations off you clothes", "half solved equations off your clothes", "off your clothes");
  rep("enc_weather_front_find_shelter", "espcially goblin based ones", "especially goblin based ones", "especially");

  console.log(`[r2 encounters 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-r2-encounters-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — round 2, Encounters and strays.`);
})();

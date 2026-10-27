/* patch-convoy-paper-economy-marks-2026-10-27.macro.js — the Stormborn papers name their pool (Dave, 2026-10-27).
 *  Why: "when I am buying receipts for 5 marks from the trade convoy, it just says marks. Is that economy marks? We should
 *   specify please!" — both papers take opDeltas {economy: -5}; a campaign sweep found no other bare "N marks" price.
 *   EDIT  enc_trade_convoy_paper  choices: "(5 marks)" → "(5 Economy marks)" ×2
 *   EDIT  enc_trade_convoy_paper_friend / _warning  "Five marks go into the tin." → "Five Economy marks go into the tin."
 *  Idempotent; DRY_RUN default true; `campaigns` as a true JSON copy. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : JSON.parse(JSON.stringify(raw));
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error(`Active campaign '${cid}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = []; let changes = 0;
  const rep = (where, obj, field, from, to) => { if (!obj) return report.push(`⚠ ${where}: not found`); const v = String(obj[field] || "");
    if (v.includes(to)) return report.push(`· ok ${where}`);
    if (v.includes(from)) { obj[field] = v.replace(from, to); changes++; return report.push(`✎ ${where}`); }
    report.push(`⚠ ${where}: "${from}" not found — left alone`); };

  const paper = byId.get("enc_trade_convoy_paper");
  for (const c of (paper?.choices || []).filter(c => /\(5 (Economy )?marks\)/.test(String(c?.label || ""))))
    rep(`enc_trade_convoy_paper choice "${c.label}"`, c, "label", "(5 marks)", "(5 Economy marks)");
  for (const id of ["enc_trade_convoy_paper_friend", "enc_trade_convoy_paper_warning"])
    rep(id, byId.get(id), "description", "Five marks go into the tin.", "Five Economy marks go into the tin.");

  console.log(`[convoy paper economy marks 2026-10-27] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the Stormborn papers cost Economy marks, and say so.`);
})();

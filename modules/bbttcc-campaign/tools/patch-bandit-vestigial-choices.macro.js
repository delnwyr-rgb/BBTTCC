/* patch-bandit-vestigial-choices.macro.js — strip the copy-pasted Kill/Jail/
 * Free menus from the bandit DISPOSITION OUTCOME beats (2026-08-29).
 *
 * The old authoring pass pasted the same three choices onto every beat in the
 * family. The mercy patch wired enc_bandit_ambush_win's trio (correct — that
 * IS the disposition menu); its CHILDREN kept vestigial copies routing
 * nowhere, so "Set them free" served the same-looking menu again and read as
 * a loop at the table. Terminal outcome beats get a single Continue.
 *
 * Idempotent; DRY_RUN default true; backs up campaigns. Run as GM.
 */
(async () => {
  const DRY_RUN = false;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  // Terminal disposition/outcome beats that must NOT re-serve the trio.
  // enc_bandit_ambush_win is deliberately absent — its trio IS the menu.
  const TARGETS = [
    "enc_bandit_ambush_win_free", "enc_bandit_ambush_win_jail",
    "enc_bandit_ambush_win_kill", "enc_bandit_ambush_bandits_run",
    "enc_bandit_ambush_run", "enc_bandit_ambush_lose"
  ];
  const isVestige = (c) => /kill 'em all|send them to jail|set them free/i.test(String(c?.label || ""));

  for (const id of TARGETS) {
    const b = byId.get(id);
    if (!b) { report.push(`⚠ ${id}: NOT FOUND — skipped`); continue; }
    const chs = Array.isArray(b.choices) ? b.choices : [];
    const vestiges = chs.filter(isVestige);
    if (!vestiges.length) { report.push(`· ok ${id}: no vestigial trio`); continue; }
    // Keep any non-vestige choices (routing survives); if nothing remains,
    // a plain Continue.
    const kept = chs.filter(c => !isVestige(c));
    b.choices = kept.length ? kept
      : [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }];
    changes++;
    report.push(`✚ ${id}: stripped ${vestiges.length} vestigial choice(s)${kept.length ? `, kept ${kept.length}` : " → Continue"}`);
  }

  console.log(`[patch-bandit-vestigial-choices] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` +
    report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Bandit vestige strip DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Bandit vestige strip: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
      `backup-campaigns-before-bandit-vestige-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Bandit vestige strip APPLIED: ${changes} change(s). One menu, one verdict.`);
})();

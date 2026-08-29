/* patch-bandit-ambush-mercy.macro.js — wire the old Bandit Ambush win beat
 * into the Bandit Accord mercy ledger (2026-08-27).
 *
 * The mercy engine in campaign module.js counts by BEAT ID pattern:
 *   /^enc_bandit/ + /(free|jail)/ → mercy +1 · /^enc_bandit/ + /kill|execute/ → fear +1
 * The outcome beats (enc_bandit_ambush_win_free / _win_jail / _win_kill) exist,
 * carry Mal VO + faction effects — but the Kill/Jail/Free choices on
 * enc_bandit_ambush_win have EMPTY `next`, so choosing them never fires the
 * outcome beat and the reeds never count. This patch wires the three nexts.
 *
 * Idempotent (skips already-wired choices); DRY_RUN default true; backs up the
 * campaigns setting before writing. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  // label-pattern → outcome beat id (the ids feed the mercy/fear regexes)
  const WIRING = [
    { re: /kill/i, next: "enc_bandit_ambush_win_kill" },
    { re: /jail/i, next: "enc_bandit_ambush_win_jail" },
    { re: /free/i, next: "enc_bandit_ambush_win_free" }
  ];

  const win = byId.get("enc_bandit_ambush_win");
  if (!win) return ui.notifications.error("Beat 'enc_bandit_ambush_win' not found in active campaign.");
  const choices = Array.isArray(win.choices) ? win.choices : [];

  for (const w of WIRING) {
    const target = byId.get(w.next);
    if (!target) { report.push(`⚠ outcome beat MISSING: ${w.next} — choice left unwired`); continue; }
    const ch = choices.find(c => w.re.test(String(c?.label || "")));
    if (!ch) { report.push(`⚠ no choice on enc_bandit_ambush_win matching ${w.re}`); continue; }
    const cur = String(ch.next || "").trim();
    if (cur === w.next) { report.push(`· ok (already) "${ch.label}" → ${w.next}`); continue; }
    if (cur) { report.push(`⚠ "${ch.label}" already routes to '${cur}' — NOT overwriting`); continue; }
    ch.next = w.next;
    changes++; report.push(`✚ wired "${ch.label}" → ${w.next}`);
  }

  console.log(`[patch-bandit-ambush-mercy] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` +
    report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Bandit mercy wiring DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Bandit mercy wiring: nothing to do — already wired.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
      `backup-campaigns-before-bandit-mercy-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Bandit mercy wiring APPLIED: ${changes} change(s). The reeds can count now.`);
})();

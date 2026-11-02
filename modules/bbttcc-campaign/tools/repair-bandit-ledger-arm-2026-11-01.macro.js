/**
 * repair-bandit-ledger-arm-2026-11-01.macro.js — Dave, 11-01: the first bandit crew was set free (enc_bandit_ambush_win_free
 * played) but banditMercy read 0 and the Bandit Accord sat "waiting" — the ledger only counted once bandit_accord_opening had
 * armed it, and that opening is gated on banditMercy ≥ 1 (deadlock). Engine fix shipped with this macro (module.js
 * _onBeatResolvedBanditLedger: the first act of mercy or fear arms the ledger itself). This macro repairs the world:
 *   • banditLedgerArmed → true
 *   • banditMercy  → the count of mercy outcomes already played (win_free / win_jail, by played.n), if higher than now
 *   • banditFear   → the count of fear outcomes already played (win_kill), if higher than now
 * Idempotent (rerun = 0). DRY_RUN first. GM only. World settings only — no campaign write, no backup needed.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const capi = game.bbttcc?.api?.campaign; const cid = capi?.getActiveCampaignId?.();
  const played = (cid && capi.story?.state?.(cid)?.played) || {};
  const n = (re) => Object.entries(played).filter(([k]) => /^enc_bandit/i.test(k) && re.test(k)).reduce((s, [, v]) => s + (Number(v?.n) || 1), 0);
  const wantMercy = n(/(free|jail)/i), wantFear = n(/kill|execute/i);
  const armed = !!game.settings.get(NS, "banditLedgerArmed");
  const mercy = Number(game.settings.get(NS, "banditMercy")) || 0, fear = Number(game.settings.get(NS, "banditFear")) || 0;
  const report = []; let changes = 0;
  if (!armed && (wantMercy || wantFear)) { changes++; report.push("✚ banditLedgerArmed → true (a crew was already spared or killed)"); } else report.push(`· ok armed=${armed}`);
  if (wantMercy > mercy) { changes++; report.push(`✚ banditMercy ${mercy} → ${wantMercy}`); } else report.push(`· ok banditMercy ${mercy} (played mercy outcomes: ${wantMercy})`);
  if (wantFear > fear) { changes++; report.push(`✚ banditFear ${fear} → ${wantFear}`); } else report.push(`· ok banditFear ${fear} (played fear outcomes: ${wantFear})`);
  console.log(`[repair bandit ledger 2026-11-01] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__repairBanditLedger = { dry: DRY_RUN, changes, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — the ledger already counts.");
  if (!armed && (wantMercy || wantFear)) await game.settings.set(NS, "banditLedgerArmed", true);
  if (wantMercy > mercy) await game.settings.set(NS, "banditMercy", wantMercy);
  if (wantFear > fear) await game.settings.set(NS, "banditFear", wantFear);
  ui.notifications.info(`Applied ${changes} change(s) — the reeds are counting.`);
})();

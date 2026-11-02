/**
 * patch-bandit-ambush-again-2026-11-01.macro.js — Dave, 11-01 (riding Fixit → Allesh-Gilliam): "the bandit encounter is
 * still the same form factor as the first bandit encounter. Given that's repeatable, we probably need a secondary version."
 *
 * enc_bandit_ambush is the tier-1 road draw on every terrain (weight 3) and repeatable, with one fixed opening. It now knows a
 * RETURN: once any earlier ambush has resolved ({{#played}} on the outcome router / the parley fail / the surrender beat — the
 * ambush's own mark is stamped at entry, so it cannot key on itself), the opening is the second crew who have HEARD of you.
 * Two ledger-aware choices join the menu on a repeat (choice.requires on the engine's banditMercy / banditFear meters):
 *   • "Say the name of the crew you let walk" (banditMercy ≥ 1) — Soft Power DC 10 → the usual win menu (kill / jail / free,
 *     so the ledger keeps counting), fail → the parley fail
 *   • "Let them remember what happened to the last crew" (banditFear ≥ 1) — Intimidation DC 12 → the bandits run,
 *     fail → the fight
 * The mercy rung ≥ 3 arms-down variant the engine already swaps in is untouched (it keys on the enc_bandit id regex).
 * Draft-1 prose, Dave's edit. Pure `apply(camp)` (node lint proof) + Foundry runner. Idempotent (rerun = 0). DRY_RUN first.
 * Backup → Data/bbttcc-exports/. GM only.
 */
const BANDIT_AGAIN_PATCH = (() => {
  const ID = "enc_bandit_ambush";
  const MARKER = "{{#played bandit_ambush_outcome_results}}";
  const RETURN = "Different towers. Same glow, same bad hiding, and the panicked voice behind them says \"it's THEM\" this time instead of \"who told them?\"\n\nWord gets around out here faster than food does. Nobody behind the towers has decided yet whether you are good news.";
  const MERCY = { label: "Say the name of the crew you let walk", next: "enc_bandit_ambush_win", failNext: "enc_bandit_ambush_parley_fail", checkStat: "op.softpower", checkDC: 10,
    description: "Mercy travels on the reeds faster than fear. Let it do the talking — and decide again what to do with them once they come out.",
    requires: [{ flag: "banditMercy", gte: 1 }] };
  const FEAR = { label: "Let them remember what happened to the last crew", next: "enc_bandit_ambush_bandits_run", failNext: "bandit_ambush_outcome_results", checkStat: "intimidation", checkDC: 12,
    description: "Fear travels too. Stand up where they can see you, and find out whether this crew heard.",
    requires: [{ flag: "banditFear", gte: 1 }] };
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const byId = new Map(beats.map(b => [String(b?.id), b]));
    const report = [], conflicts = []; let changes = 0;
    const b = byId.get(ID);
    if (!b) return { changes, report, conflicts: [`${ID}: beat not found`] };
    for (const need of ["bandit_ambush_outcome_results", "enc_bandit_ambush_win", "enc_bandit_ambush_parley_fail", "enc_bandit_ambush_bandits_run", "bandit_ambush_arms_down"]) if (!byId.has(need)) conflicts.push(`${need}: beat not found`);
    if (conflicts.length) return { changes, report, conflicts };
    const d = String(b.description || "");
    if (!d.startsWith(MARKER)) {
      b.description = `${MARKER}${RETURN}{{else}}{{#played enc_bandit_ambush_parley_fail}}${RETURN}{{else}}{{#played bandit_ambush_arms_down}}${RETURN}{{else}}${d}{{/played}}{{/played}}{{/played}}`;
      changes++; report.push(`✚ ${ID}: the opening knows a second crew (after any earlier ambush resolved)`);
    } else report.push(`· ok ${ID} opening knows a return`);
    b.choices = Array.isArray(b.choices) ? b.choices : [];
    const steelAt = () => b.choices.findIndex(c => c && /^steel it is/i.test(String(c.label || "")));
    for (const ch of [MERCY, FEAR]) {
      if (b.choices.some(c => c && c.label === ch.label)) { report.push(`· ok ${ID} "${ch.label}"`); continue; }
      const at = steelAt(); if (at >= 0) b.choices.splice(at, 0, { ...ch }); else b.choices.push({ ...ch });
      changes++; report.push(`✚ ${ID}: "${ch.label}" (${ch.requires[0].flag} ≥ ${ch.requires[0].gte}; ${ch.checkStat} DC ${ch.checkDC})`);
    }
    return { changes, report, conflicts };
  }
  return { apply, ID };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = BANDIT_AGAIN_PATCH;                                 // node: offline lint proof
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));   // true copy (deepClone made a write no-op once)
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = BANDIT_AGAIN_PATCH.apply(camp);
  console.log(`[bandit ambush again 2026-11-01] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__banditAmbushAgain = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-bandit-ambush-again-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the second bandit crew has heard of you.`);
})();

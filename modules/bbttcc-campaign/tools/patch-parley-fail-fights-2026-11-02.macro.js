/**
 * patch-parley-fail-fights-2026-11-02.macro.js — A FAILED PARLEY IS A FIGHT, NOT A FREE RETRY (failure pass 2026-11-02, live-caught: the
 * Wastes Stalker's "No threat, no prey" missed (Empathy 7 vs 12) → "Wildlife — Wrong Smell" → "So be it" CLOSED the chain; the road
 * encounter never resolved, so it re-offered the same parley — and the second roll passed and paid the talk-down bounty).
 * Every hostile road parley's fail card ends on a turn to violence ("So much for diplomacy", "The angles come up sharp") but its only
 * choice had next "". Each `*_parley_fail` whose choices all close now routes them to the root's FIGHT path (the root's non-check
 * choice — the same place "Weapons up" / "Meet it" / "Brute-force" goes). The Broken Bridge's wade/convince fails are left alone
 * (closing back to the bridge to try another way is intended), and so are the end-door families (Desenitarius Maarg, Qliphotic Whorl,
 * Qlipothic Shambler, Raider raze team, Slippage Wraith): their own fight choice also closes — the battle starts when the menu does — so
 * "So be it" closing there already means a fight. APPLIED ember: 5, rerun 0. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/.
 */
const PARLEY_FAIL_FIGHTS = (() => {
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const byId = new Map(beats.map(b => [b.id, b]));
    const report = [], conflicts = []; let changes = 0;
    for (const root of beats) {
      if (!/^enc_/.test(String(root?.id || ""))) continue;
      const ch = root.choices || [];
      const check = ch.find(c => c && c.checkStat && /_parley_fail$/.test(String(c.failNext || "")));
      if (!check) continue;
      const fight = ch.find(c => c && !c.checkStat && c.next && c !== check);
      const fail = byId.get(check.failNext);
      if (!fail) { conflicts.push(`${root.id}: fail beat ${check.failNext} missing`); continue; }
      if (!fight) { conflicts.push(`${root.id}: no fight path to route ${fail.id} to`); continue; }
      for (const c of (fail.choices || [])) {
        if (c && !c.next) { c.next = fight.next; changes++; report.push(`✚ ${fail.id}: "${c.label}" → ${fight.next}`); }
      }
    }
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = PARLEY_FAIL_FIGHTS;
} else (async () => {
  const DRY_RUN = (globalThis.__pffDry ?? true);
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = PARLEY_FAIL_FIGHTS.apply(camp);
  console.log(`[parley fail fights 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__pff = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-parley-fail-fights-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied — a failed parley is a fight (${changes}).`);
})();

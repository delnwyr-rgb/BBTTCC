/* repair-rank-inflation.macro.js — fix promote-compounded aptitude ranks
 * (2026-07-13; pairs with the root-cause fix in systems/fourththing/
 *  ft-progression.js — promoteStampedAptitudeAEs/clampSkillRanksToCap now
 *  read SOURCE ranks and keep a once-only promotion ledger)
 *
 * THE BUG (recurring, now squashed at root): a character with dots in an
 * aptitude that ALSO carries a stamped rank bonus (ancestry/heritage/class
 * "+1 <skill>" AEs) had the bonus PROMOTED into source rank by code that read
 * the DERIVED value (source + all live AEs) — and heritage/ancestry swaps
 * re-import fresh enabled stamps — so each pass compounded until rank 5.
 *
 * WHAT THIS MACRO DOES:
 *  1. SCAN (always): every world actor carrying aptitudeStamp AEs — reports
 *     source rank, stamp deltas, enabled/disabled, and promotion-ledger
 *     status per affected skill. Use it to spot more victims; suspicious =
 *     source way above the dots you intended.
 *  2. LEDGER BACKFILL (on apply): every DISABLED stamp AE gets a ledger
 *     entry (disabled = it was already promoted once) so the fixed engine
 *     can never re-promote it after a future re-import. Enabled stamps are
 *     left for the engine — it now promotes them correctly, exactly once.
 *  3. EXPLICIT FIXES (on apply): the FIXES map below sets corrected SOURCE
 *     ranks, disables any still-enabled stamps for those skills, and ledgers
 *     them (the corrected value already includes the grant).
 *
 * Correction rule of thumb: intended dots + one promotion per distinct grant.
 * (Gasket: 1 dot Investigation + Rustland Scavenger +1 → rank 2. Perch:
 * 1 dot Athletics + Furrykin +1 → rank 2. The always-on passive "+1" AE
 * stays live on top — that one is display-correct.)
 *
 * DRY_RUN default true. Idempotent. Run as GM, per world.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  // actor name → { skillKey: correctedSourceRank }
  const FIXES = {
    "Gasket":           { investigation: 2 },
    "Lieutenant Perch": { athletics: 2 },
    // Rank Test: 1 rank spent on Athletics; the pre-fix spend-points path
    // folded the live Furrykin +1 AE into source (→ 3). Correct source to the
    // one spent rank; the +1 AE keeps displaying in the AE column.
    "Rank Test":        { athletics: 1 }
  };
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const ledgerKey = (itemName, skillKey) => `${norm(itemName)}|${skillKey}`;
  const report = [];
  let changes = 0;

  for (const actor of game.actors.contents) {
    // Collect this actor's stamp AEs → per-skill picture
    const stamps = []; // { item, effect, skillKey, delta }
    for (const item of actor.items ?? []) {
      for (const effect of item.effects ?? []) {
        if (!effect.flags?.fourththing?.aptitudeStamp) continue;
        for (const change of effect.changes ?? []) {
          const isAdd = change?.type === "add" || change?.mode === 2;
          if (!isAdd) continue;
          const m = String(change.key ?? "").match(/^system\.skills\.([a-zA-Z0-9_]+)\.value$/);
          if (!m) continue;
          const delta = Number(change.value) || 0;
          if (!delta) continue;
          stamps.push({ item, effect, skillKey: m[1], delta });
        }
      }
    }
    const fixEntry = Object.entries(FIXES).find(([n]) => norm(n) === norm(actor.name))?.[1] ?? null;
    if (!stamps.length && !fixEntry) continue;

    const srcRoot = actor.toObject().system;
    const skills  = srcRoot?.system?.skills ?? srcRoot?.skills ?? {};
    const ledger  = foundry.utils.deepClone(actor.getFlag("fourththing", "aptitudePromotions") ?? {});
    let ledgerDirty = false;
    const updates = {};
    const disableOps = [];

    // 1. scan report
    const bySkill = {};
    for (const s of stamps) (bySkill[s.skillKey] ??= []).push(s);
    for (const [sk, list] of Object.entries(bySkill)) {
      const src = Number(skills[sk]?.value ?? 0);
      const parts = list.map(s => `${s.item.name} ${s.delta > 0 ? "+" : ""}${s.delta}${s.effect.disabled ? " (disabled)" : " (ENABLED)"}${ledger[ledgerKey(s.item.name, sk)] ? " [ledgered]" : ""}`);
      report.push(`🔎 ${actor.name} · ${sk}: source ${src} — stamps: ${parts.join(", ")}`);
    }

    // 2. ledger backfill for disabled stamps
    for (const s of stamps) {
      const lk = ledgerKey(s.item.name, s.skillKey);
      if (s.effect.disabled && !ledger[lk]) {
        ledger[lk] = { delta: s.delta, item: s.item.name, at: Date.now(), backfilled: true };
        ledgerDirty = true; changes++;
        report.push(`  ✚ ledger backfill: ${actor.name} · ${lk}`);
      }
    }

    // 3. explicit fixes
    if (fixEntry) {
      for (const [sk, target] of Object.entries(fixEntry)) {
        const cur = Number(skills[sk]?.value ?? 0);
        if (cur !== target) {
          updates[`system.skills.${sk}.value`] = target;
          changes++;
          report.push(`  ⚡ FIX: ${actor.name} · ${sk}: source ${cur} → ${target}`);
        } else report.push(`  · ok ${actor.name} · ${sk} already ${target}`);
        for (const s of stamps.filter(x => x.skillKey === sk)) {
          const lk = ledgerKey(s.item.name, sk);
          if (!ledger[lk]) { ledger[lk] = { delta: s.delta, item: s.item.name, at: Date.now(), backfilled: true }; ledgerDirty = true; changes++; }
          if (!s.effect.disabled) { disableOps.push(s); changes++; report.push(`  ⏻ disable stamp: ${s.item.name} (${sk})`); }
        }
      }
    }

    if (!DRY_RUN) {
      if (Object.keys(updates).length || ledgerDirty) {
        await actor.update({ ...updates, ...(ledgerDirty ? { "flags.fourththing.aptitudePromotions": ledger } : {}) });
      }
      for (const s of disableOps) {
        try { await s.item.updateEmbeddedDocuments("ActiveEffect", [{ _id: s.effect.id, disabled: true }]); }
        catch (e) { report.push(`  ⚠ disable failed on ${actor.name}/${s.item.name}: ${e?.message || e}`); }
      }
    }
  }

  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply." : "APPLIED.";
  console.log(`[repair-rank-inflation] ${banner} — ${changes} change(s)\n` + report.map(r => "  " + r).join("\n"));
  ui.notifications.info(`Rank inflation repair: ${banner} ${changes} change(s) (see console).`);
})();

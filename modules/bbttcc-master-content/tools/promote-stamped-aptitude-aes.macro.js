// Bad Eden — Promote stamped class-L1 aptitude AEs into source skill ranks (2026-05-08)
// ─────────────────────────────────────────────────────────────────────────────
// One-shot migration. The 2026-05-04 stamp macro (stamp-class-l1-aptitudes)
// dropped combat+armor aptitude grants onto each class T1 anchor as transfer-
// AEs (key: system.skills.<x>.value, mode 2 / +1). Those AEs were invisible
// to the steward sheet's rank-pip UI (which reads source via toObject) and to
// the armor-skill gate in the defense engine, so armor proficiency stayed
// dormant — the user-visible bug "armor proficiencies not coming through
// from wizard" (2026-05-08 bug bash, item A1).
//
// The chargen pipeline now calls game.fourththing._progression
// .promoteStampedAptitudeAEs() on every new actor. This macro retroactively
// runs the same promotion on every existing character actor in the world so
// pre-fix operatives (like Beeb) catch up.
//
// What it does, per actor, per stamped AE:
//   • Read AE.changes[] for entries with key system.skills.<key>.value and an
//     add semantic (change.type === "add" OR legacy change.mode === 2).
//   • Set system.skills.<key>.value = clamp(0..5, current + delta).
//   • Disable the AE on the embedded item copy so it cannot double-apply on
//     subsequent prepareData runs.
//
// Idempotent. Re-runs are no-ops because converted AEs are left disabled.
//
// DRY_RUN = true to preview without writing.
// ─────────────────────────────────────────────────────────────────────────────

const DRY_RUN = false;

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");

  const promote = game.fourththing?._progression?.promoteStampedAptitudeAEs;
  if (typeof promote !== "function") {
    return ui.notifications?.error(
      "promoteStampedAptitudeAEs not available — fourththing system needs to be the build that ships A1 fix (2026-05-08+)."
    );
  }

  const actors = game.actors.filter(a => a.type === "character");
  const report = [];
  let touched = 0, untouched = 0;

  for (const actor of actors) {
    if (DRY_RUN) {
      // Manual dry-run: walk items + AEs ourselves, count would-be updates.
      let wouldUpdate = 0;
      for (const item of Array.from(actor.items ?? [])) {
        for (const effect of Array.from(item.effects ?? [])) {
          if (effect.disabled) continue;
          if (!effect.flags?.fourththing?.aptitudeStamp) continue;
          for (const change of effect.changes ?? []) {
            const isAdd = change?.type === "add" || change?.mode === 2;
            if (!isAdd) continue;
            if (!/^system\.skills\.[a-zA-Z0-9_]+\.value$/.test(String(change.key ?? ""))) continue;
            const delta = Number(change.value) || 0;
            if (delta) wouldUpdate++;
          }
        }
      }
      if (wouldUpdate) {
        report.push(`= ${actor.name.padEnd(28)} would promote ${wouldUpdate} AE change(s)`);
        touched++;
      } else {
        untouched++;
      }
      continue;
    }

    try {
      const promoted = await promote(actor);
      if (Array.isArray(promoted) && promoted.length) {
        report.push(
          `✓ ${actor.name.padEnd(28)} ${promoted.map(p => `${p.skill} ${p.from}→${p.to} (${p.source})`).join(", ")}`
        );
        touched++;
      } else {
        untouched++;
      }
    } catch (e) {
      report.push(`✗ ${actor.name.padEnd(28)} ERROR: ${e.message}`);
    }
  }

  console.group("[promote-stamped-aptitude-aes]");
  report.forEach(r => console.log(r));
  console.groupEnd();

  ui.notifications.info(
    `Aptitude AE promotion${DRY_RUN ? " (DRY RUN)" : ""}: touched ${touched}, untouched ${untouched}, total ${actors.length}.`
  );
})();

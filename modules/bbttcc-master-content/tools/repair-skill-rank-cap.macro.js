/**
 * Defensive sweep: clamp every actor's `system.skills.X.value` to ≤5.
 *
 * 2026-05-20. Multiple wizard playtest characters (A3G5 et al.) came out
 * with skill ranks above the canonical max — one report at 22. The
 * writers in fourththing/ft-progression.js never write above 5 (and were
 * hardened today with a clampSkillRanksToCap pass after every grant), so
 * the source of the over-cap value is still unidentified — but existing
 * actors are stuck with rotten ranks. This macro is the cleanup.
 *
 * Walks every character + npc actor, finds any `system.skills.X.value > 5`,
 * clamps to 5 (Legendary cap), and reports what was clamped per actor.
 *
 * Idempotent. Safe to re-run.
 *
 * Usage: paste into a Foundry Script Macro and execute as GM.
 */
(async () => {
if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

const CAP = 5;
const report = { actorsScanned: 0, actorsRepaired: 0, perActor: [], errors: [] };

for (const actor of game.actors ?? []) {
  if (actor?.type !== "character" && actor?.type !== "npc") continue;
  report.actorsScanned++;
  const sys = actor.system?.system ?? actor.system;
  const skills = sys?.skills ?? {};
  const updates = {};
  const clamped = [];
  for (const [key, skill] of Object.entries(skills)) {
    const cur = Number(skill?.value ?? 0);
    if (Number.isFinite(cur) && cur > CAP) {
      updates[`system.skills.${key}.value`] = CAP;
      clamped.push({ skill: key, from: cur, to: CAP });
    }
  }
  if (!clamped.length) continue;
  try {
    await actor.update(updates);
    report.actorsRepaired++;
    report.perActor.push({ actor: actor.name, clamped });
  } catch (e) {
    report.errors.push({ actor: actor.name, error: e.message });
  }
}

console.group("Skill rank cap — clamp sweep");
for (const r of report.perActor) {
  console.log(`${r.actor}:`);
  console.table(r.clamped);
}
if (report.errors.length) console.warn("Errors:", report.errors);
console.log(`Scanned ${report.actorsScanned} actors · Repaired ${report.actorsRepaired} · Errors ${report.errors.length}`);
console.groupEnd();

ui.notifications.info(`Skill-rank clamp: scanned ${report.actorsScanned}, repaired ${report.actorsRepaired}. See console.`);
})();

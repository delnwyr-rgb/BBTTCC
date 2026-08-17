/* gate-founders-garden.macro.js — 2026-08-15
 *
 * THE BUG: all four Founders' Garden beats were authored with `inject: null` —
 * no gate of any kind — and `pacing: {ambient: true}`. Ambient puts them in the
 * phase-free pool, so nothing in the funnel was holding them: "The Founders'
 * Garden — Approach" read READY in ACT 0 · TURN 1 and stood in the play
 * console's offerable list. The hex autofire was doing all the work, and hex
 * autofire only decides WHERE a beat fires, never WHEN it becomes eligible.
 *
 * THE FIX (owner ruling 2026-08-15): gate the Garden to ACT 4 — THE VAULT & THE
 * SKY. Early enough that the party can find it, count the hundred, and sit with
 * the discrepancy for a full act before Gloomgill explains anything; late enough
 * that it is not on the table while they are still learning the Offices.
 *
 * `pacing.ambient` is deliberately LEFT ALONE. Open-world doctrine holds — gates
 * carry order, never geography — so the Garden stays place-driven ambient
 * content that fires when the party walks in. The act gate only decides when
 * walking in can start meaning something. (Ambient also wins the Visualizer's
 * Act filter, so these keep showing under "Ambient pool", not the Act 4 lane.)
 *
 * Idempotent: re-running finds nothing. Prose, choices and pacing are untouched
 * — only `inject.requires` is written, so anything you have edited in the Beats
 * tab stands. DRY by default; writes a campaigns backup before applying.
 */
(async () => {
  const DRY_RUN = false;                  // <-- set false to apply
  const NS = "bbttcc-campaign";
  const PHASE = 4;                       // ACT 4 — THE VAULT & THE SKY
  const BEAT_IDS = [
    "founders_garden_approach",
    "founders_garden_wonder",
    "founders_garden_the_count",
    "founders_garden_the_plinth"
  ];

  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));

  const want = [{ flag: "storyPhase", gte: PHASE }];
  const report = [];
  let changes = 0;

  for (const id of BEAT_IDS) {
    const b = byId.get(id);
    if (!b) { report.push(`⚠ missing beat: ${id} (skipped)`); continue; }
    const cur = b.inject?.requires ?? null;
    if (JSON.stringify(cur) === JSON.stringify(want)) { report.push(`· ok (already gated) ${id}`); continue; }
    if (cur) { report.push(`⚠ ${id} already carries a different gate ${JSON.stringify(cur)} — REPLACING with storyPhase ≥ ${PHASE}`); }
    b.inject = Object.assign({}, b.inject || {}, { requires: want });
    changes++;
    report.push(`↻ gated: ${id} → storyPhase ≥ ${PHASE}  ("${b.label || id}")`);
  }

  console.log(`[gate-founders-garden] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Founders' Garden gate DRY RUN: ${changes} change(s) — see console.`);
  if (!changes) return ui.notifications.info("Founders' Garden: nothing to do — already gated.");

  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-garden-gate-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Founders' Garden gated to Act ${PHASE}: ${changes} beat(s).`);
})();

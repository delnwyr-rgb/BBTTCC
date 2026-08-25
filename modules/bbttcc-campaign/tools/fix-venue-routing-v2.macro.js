/**
 * fix-venue-routing-v2.macro.js — GM macro/console. DRY_RUN default true.
 *
 * The skewer STILL dead-ended after patch-round-leaks (2026-08-24 night,
 * dialog freshly re-run). Routing code is sound on every surface — so the
 * LIVE DATA still holds an empty route. Two suspects this macro both
 * diagnoses and fixes:
 *   a) the choice was never reached by the v1 graph-walk (prints whether
 *      the Tea beat is reachable from the Round, and seeds it explicitly);
 *   b) the choice carries a CHECK and the roll failed — v1 only filled
 *      `next`, so a failed check fell through empty `failNext` into ∅.
 *      Every checked choice in the venue subgraph now gets failNext → HOME.
 *
 * Prints the Tea beat's full live choice table (label/next/failNext/check)
 * BEFORE changing anything — that's the diagnosis, read it in the console.
 */
(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw)
    : foundry.utils.deepClone(campsRaw); // clone: object-typed settings return the LIVE cache
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = []; let changes = 0;

  /* ── Diagnosis: the Tea beat's live routes, exactly as stored ── */
  const TEA = "allesh_gilliam_etta_welcome";
  const tea = byId.get(TEA);
  if (tea) {
    report.push(`◈ DIAGNOSIS — ${TEA} live choices:`);
    (tea.choices || []).forEach((c, i) => report.push(
      `   [${i}] "${String(c?.label || "").slice(0, 40)}"  next=${c?.next || "∅"}  failNext=${c?.failNext || "∅"}` +
      (String(c?.checkStat || "").trim() ? `  CHECK ${c.checkStat} DC ${c.checkDC}` : "")
    ));
  } else report.push(`✗ ${TEA} not found in this campaign!`);

  /* ── Walk the venue subgraph from the Round; seed the Tea beat explicitly ── */
  const EXCLUDE = new Set(["ag_crossroads_first_rides", "ag_days_end", "ag_title_card"]);
  const HOME = "allesh_gilliam_town_walk";
  const tw = byId.get(HOME);
  if (!tw) return ui.notifications.error("town_walk missing — wrong campaign?");
  const seen = new Set();
  const queue = (tw.choices || []).map(c => c.next).filter(Boolean).filter(id => !EXCLUDE.has(id));
  if (tea) queue.push(TEA);   // reachable or not, the Tea beat gets fixed
  let teaReachable = false;
  while (queue.length) {
    const bid = queue.shift();
    if (!bid || seen.has(bid) || bid === HOME || EXCLUDE.has(bid)) continue;
    seen.add(bid);
    if (bid === TEA) teaReachable = true;
    const b = byId.get(bid);
    if (!b) continue;
    for (const c of (b.choices || [])) {
      if (!String(c?.label || "").trim()) continue;
      const hasNext = c?.next && String(c.next).trim();
      const hasFail = c?.failNext && String(c.failNext).trim();
      const hasCheck = String(c?.checkStat || "").trim() !== "";
      if (!hasNext) {
        c.next = HOME; changes++;
        report.push(`· ${bid}: "${String(c.label).slice(0, 34)}" next ∅ → the Round`);
      }
      // A checked choice with no failure route dead-ends on a bad roll.
      if (hasCheck && !hasFail) {
        c.failNext = HOME; changes++;
        report.push(`· ${bid}: "${String(c.label).slice(0, 34)}" failNext ∅ → the Round (checked choice)`);
      }
      for (const t of [c?.next, c?.failNext]) {
        if (t && !seen.has(t) && !EXCLUDE.has(t)) queue.push(t);
      }
    }
  }
  report.splice(tea ? (tea.choices || []).length + 1 : 1, 0,
    `◈ Tea beat reachable from the Round's own choice graph: ${teaReachable ? "YES" : "NO — v1 walk never touched it (that's the leak)"}`);

  console.log(`[fix-venue-routing-v2] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s) (walked ${seen.size} beats)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Venue routing v2 DRY RUN: ${changes} change(s) across ${seen.size} beats — DIAGNOSIS in console. Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name; a.click();
  };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-venue-v2-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Venue routing v2 APPLIED: ${changes} change(s). Backup downloaded. Failed rolls come home too now.`);
})();

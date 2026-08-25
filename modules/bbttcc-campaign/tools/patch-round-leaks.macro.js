/**
 * patch-round-leaks.macro.js — GM macro/console. DRY_RUN default true.
 *
 * Clean-run findings (2026-08-24 evening): The Welcome Round leaked.
 *  · "Tea at the Long Market": Eat the skewer / Ask what's on it both
 *    routed to ∅ — eating the skewer ended the town. Both now return to
 *    the Round (the skewer was never a trap).
 *  · Yarrow's welcome carried two empty-next choices; "Something else"
 *    options on the market intro and the hubs also dead-ended. All Allesh
 *    venue-chain choices with NO next and NO failNext now return to the
 *    Round, and the macro reports every one it touched.
 *  · Scene launch fix: the Long Market intro stored sceneId as
 *    "Scene.q9zMsGlxPRjewuhw" — the document PREFIX breaks resolution
 *    (working venues store the bare id). All beats' sceneId values are
 *    normalized to bare ids campaign-wide.
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

  /* ── 1. Empty-next choices in the Allesh venue subgraph → the Round ──
   * Walk the graph from the Round's own choices; any reachable beat whose
   * choice has neither next nor failNext gets routed home. New spine beats
   * (crossroads / days_end / title_card) are excluded — their empty choices
   * are deliberate exits. */
  const EXCLUDE = new Set(["ag_crossroads_first_rides", "ag_days_end", "ag_title_card"]);
  const HOME = "allesh_gilliam_town_walk";
  const tw = byId.get(HOME);
  if (!tw) return ui.notifications.error("town_walk missing — wrong campaign?");
  const seen = new Set();
  const queue = (tw.choices || []).map(c => c.next).filter(Boolean).filter(id => !EXCLUDE.has(id));
  while (queue.length) {
    const bid = queue.shift();
    if (!bid || seen.has(bid) || bid === HOME || EXCLUDE.has(bid)) continue;
    seen.add(bid);
    const b = byId.get(bid);
    if (!b) continue;
    for (const c of (b.choices || [])) {
      const hasRoute = (c?.next && String(c.next).trim()) || (c?.failNext && String(c.failNext).trim());
      if (!hasRoute && c?.label) {
        c.next = HOME; changes++;
        report.push(`· ${bid}: "${String(c.label).slice(0, 34)}" ∅ → the Round`);
      }
      for (const t of [c?.next, c?.failNext]) {
        if (t && !seen.has(t) && !EXCLUDE.has(t)) queue.push(t);
      }
    }
  }

  /* ── 2. sceneId normalization: strip document prefixes campaign-wide ── */
  let scenesFixed = 0;
  for (const b of camp.beats || []) {
    const sid = String(b?.sceneId || "");
    if (/^Scene\./.test(sid)) {
      b.sceneId = sid.replace(/^Scene\./, "");
      scenesFixed++; report.push(`· ${b.id}: sceneId "${sid}" → "${b.sceneId}"`);
    }
  }
  changes += scenesFixed;

  console.log(`[patch-round-leaks] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s) (walked ${seen.size} venue beats)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Round-leaks DRY RUN: ${changes} change(s) across ${seen.size} walked beats (console). Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name; a.click();
  };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-round-leaks-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Round leaks APPLIED: ${changes} change(s). The skewer is safe to eat.`);
})();

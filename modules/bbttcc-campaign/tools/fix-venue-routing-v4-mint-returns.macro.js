/**
 * fix-venue-routing-v4-mint-returns.macro.js — GM macro/console. DRY_RUN default true.
 *
 * v3 enforced "venue choices must route or return" — but only on beats WITH
 * choices. Lyrenn's Green Ring (2026-08-29) exposed the missing clause: a
 * venue beat with ZERO choices renders the choice-less OK dialog and dead-ends
 * the walk. v4 = the full law:
 *   · empty labeled choice (no next, no failNext)   → the town's hub
 *   · checked choice with no failNext (bad roll ∅)  → the town's hub
 *   · NEW: zero-choice venue beat                   → mint "Rejoin the walk" → hub
 * Cinematic beats (type "cinematic" / cinematic.enabled) are exempt from the
 * mint — their flow is scene-timed, not menu-driven.
 *
 * Boundaries: hubs + spine beats never walked into, never edited.
 * Idempotent; re-running reports 0 changes once clean.
 */
(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = []; let changes = 0;

  const HUB_IDS = [
    "allesh_gilliam_town_walk",
    "khezek_tor_main_scene",
    "lyrenn_opening_scene", "lyrenn_main_scene",
    "fixit_intro_scene"
  ].filter(id => byId.has(id));
  const SPINE = new Set(["ag_crossroads_first_rides", "ag_days_end", "ag_title_card"]);
  const BOUNDARY = new Set([...HUB_IDS, ...SPINE]);
  const claimed = new Set();

  const isCinematic = (b) => String(b?.type || "") === "cinematic" || !!(b?.cinematic && b.cinematic.enabled);

  for (const HOME of HUB_IDS) {
    const hub = byId.get(HOME);
    const queue = (hub.choices || []).map(c => c?.next).filter(Boolean).filter(id => !BOUNDARY.has(id));
    let walked = 0, fixed = 0, minted = 0;
    while (queue.length) {
      const bid = queue.shift();
      if (!bid || claimed.has(bid) || BOUNDARY.has(bid)) continue;
      claimed.add(bid); walked++;
      const b = byId.get(bid);
      if (!b) continue;

      const labeled = (b.choices || []).filter(c => String(c?.label || "").trim());

      // NEW clause: zero-choice venue beat → mint the return.
      if (!labeled.length && !isCinematic(b)) {
        b.choices = Array.isArray(b.choices) ? b.choices : [];
        b.choices.push({ label: "Rejoin the walk", next: HOME, description: "", checkStat: "", checkDC: 0, failNext: "" });
        changes++; fixed++; minted++;
        report.push(`· [${HOME}] ${bid}: ZERO choices → minted "Rejoin the walk"`);
        continue;
      }

      for (const c of labeled) {
        const hasNext = c?.next && String(c.next).trim();
        const hasFail = c?.failNext && String(c.failNext).trim();
        const hasCheck = String(c?.checkStat || "").trim() !== "";
        if (!hasNext) {
          c.next = HOME; changes++; fixed++;
          report.push(`· [${HOME}] ${bid}: "${String(c.label).slice(0, 34)}" next ∅ → home`);
        }
        if (hasCheck && !hasFail) {
          c.failNext = HOME; changes++; fixed++;
          report.push(`· [${HOME}] ${bid}: "${String(c.label).slice(0, 34)}" failNext ∅ → home (checked)`);
        }
        for (const t of [c?.next, c?.failNext]) {
          if (t && !claimed.has(t) && !BOUNDARY.has(t)) queue.push(t);
        }
      }
    }
    report.push(`◈ ${HOME}: walked ${walked} beat(s), ${fixed} route(s) filled (${minted} minted)`);
  }

  console.log(`[fix-venue-routing-v4] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s) across ${HUB_IDS.length} hub(s)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Venue routing v4 DRY RUN: ${changes} change(s) (console). Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name; a.click();
  };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-venue-v4-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Venue routing v4 APPLIED: ${changes} change(s). Every road in every town leads home.`);
})();

/**
 * fix-venue-routing-v3-all-towns.macro.js — GM macro/console. DRY_RUN default true.
 *
 * Khezek-Tor leaked the same way Allesh did (2026-08-24: "I ate what Bez
 * gave me" → ∅ instead of back to the KT choices). v2 only walked the
 * Allesh subgraph with the Round as home. v3 walks EVERY settlement hub's
 * venue subgraph and routes leaks back to THAT town's own hub:
 *   · empty labeled choice (no next, no failNext)  → the town's hub
 *   · checked choice with no failNext (bad roll ∅) → the town's hub
 * Authoring law (owner-endorsed): venue-chain choices must route or return.
 *
 * Boundaries: hubs and the spine beats (crossroads / days_end / title_card)
 * are never walked INTO and never edited — their exits are deliberate.
 * Idempotent; re-running reports "0 changes" once clean.
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

  // Hub candidates (both lyrenn ids — the spine used opening_scene for rides
  // and main_scene for returns; whichever exists gets walked).
  const HUB_IDS = [
    "allesh_gilliam_town_walk",
    "khezek_tor_main_scene",
    "lyrenn_opening_scene", "lyrenn_main_scene",
    "fixit_intro_scene"
  ].filter(id => byId.has(id));
  const SPINE = new Set(["ag_crossroads_first_rides", "ag_days_end", "ag_title_card"]);
  const BOUNDARY = new Set([...HUB_IDS, ...SPINE]);
  const claimed = new Set();   // a beat belongs to the first hub that reaches it

  for (const HOME of HUB_IDS) {
    const hub = byId.get(HOME);
    const queue = (hub.choices || []).map(c => c?.next).filter(Boolean).filter(id => !BOUNDARY.has(id));
    let walked = 0, fixed = 0;
    while (queue.length) {
      const bid = queue.shift();
      if (!bid || claimed.has(bid) || BOUNDARY.has(bid)) continue;
      claimed.add(bid); walked++;
      const b = byId.get(bid);
      if (!b) continue;
      for (const c of (b.choices || [])) {
        if (!String(c?.label || "").trim()) continue;
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
    report.push(`◈ ${HOME}: walked ${walked} beat(s), ${fixed} route(s) filled`);
  }

  console.log(`[fix-venue-routing-v3] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s) across ${HUB_IDS.length} hub(s)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Venue routing v3 DRY RUN: ${changes} change(s), hubs: ${HUB_IDS.join(", ")} (console). Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name; a.click();
  };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-venue-v3-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Venue routing v3 APPLIED: ${changes} change(s). Every town's snacks now lead home.`);
})();

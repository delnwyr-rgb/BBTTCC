/**
 * patch-settlement-walk-loops.macro.js — GM macro/console. DRY_RUN default true.
 *
 * Make every settlement walk loop like the Allesh Round (owner, 2026-08-24):
 * finish a venue → the walk menu re-presents itself → click every option you
 * like → an explicit LEAVE door cycles you out to the Crossroads.
 *
 *  1. RE-HOME: v3 homed each town's leaks at the town's ARRIVAL beat
 *     (main/intro scene) because the walk hubs weren't known then. Every
 *     venue-subgraph route pointing at the arrival beat now points at the
 *     town's WALK hub instead (arrival cinematics are for arriving). Stray
 *     ∅ routes get the same home.
 *  2. LEAVE DOOR: each walk hub gains "Take your leave — the road's
 *     waiting" → the Crossroads (skipped if a crossroads exit already
 *     exists; Allesh's "Call it a day" already qualifies).
 *  3. ARRIVAL → WALK: each arrival beat gets a "Head into town" choice into
 *     the walk hub if it doesn't already route there.
 *
 * Towns whose walk hub doesn't exist yet are reported and left alone
 * (their arrival beat keeps doubling as the hub until one is authored).
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

  const CROSSROADS = "ag_crossroads_first_rides";
  const SPINE = new Set([CROSSROADS, "ag_days_end", "ag_title_card"]);
  const RIDES = new Set(["ag_ride_khezek_tor", "ag_ride_lyrenn", "ag_ride_fixit"]);

  const TOWNS = [
    { key: "Khezek-Tor", walkId: "khezek_tor_town_walk", arrivalIds: ["khezek_tor_main_scene"] },
    { key: "Lyrenn", walkId: "lyrenn_town_walk", arrivalIds: ["lyrenn_opening_scene", "lyrenn_main_scene"] },
    { key: "Fixit Farm", walkId: "fixit_town_walk", arrivalIds: ["fixit_intro_scene"] },
    // Allesh: walk exists, arrival is the Welcome — included so the leave-door
    // check runs; its "Call it a day" already exits to the Crossroads.
    { key: "Allesh-Gilliam", walkId: "allesh_gilliam_town_walk", arrivalIds: [] }
  ];

  const allHubIds = new Set(TOWNS.flatMap(t => [t.walkId, ...t.arrivalIds]).filter(id => byId.has(id)));
  const BOUNDARY = new Set([...allHubIds, ...SPINE, ...RIDES]);

  for (const t of TOWNS) {
    const walk = byId.get(t.walkId);
    if (!walk) { report.push(`✗ ${t.key}: walk hub ${t.walkId} ABSENT — arrival keeps doubling as hub, nothing changed`); continue; }
    const arrivals = t.arrivalIds.filter(id => byId.has(id));

    /* ── 1. Re-home the walk's subgraph ── */
    const claimed = new Set();
    const queue = (walk.choices || []).map(c => c?.next).filter(Boolean).filter(id => !BOUNDARY.has(id));
    let rehomed = 0;
    while (queue.length) {
      const bid = queue.shift();
      if (!bid || claimed.has(bid) || BOUNDARY.has(bid)) continue;
      claimed.add(bid);
      const b = byId.get(bid);
      if (!b) continue;
      for (const c of (b.choices || [])) {
        if (!String(c?.label || "").trim()) continue;
        for (const field of ["next", "failNext"]) {
          const cur = String(c?.[field] || "").trim();
          if (arrivals.includes(cur)) { c[field] = t.walkId; changes++; rehomed++;
            report.push(`· ${t.key} ${bid}: "${String(c.label).slice(0, 30)}" ${field} arrival → walk`); }
        }
        const hasNext = c?.next && String(c.next).trim();
        const hasFail = c?.failNext && String(c.failNext).trim();
        const hasCheck = String(c?.checkStat || "").trim() !== "";
        if (!hasNext) { c.next = t.walkId; changes++; rehomed++;
          report.push(`· ${t.key} ${bid}: "${String(c.label).slice(0, 30)}" next ∅ → walk`); }
        if (hasCheck && !hasFail) { c.failNext = t.walkId; changes++; rehomed++;
          report.push(`· ${t.key} ${bid}: "${String(c.label).slice(0, 30)}" failNext ∅ → walk (checked)`); }
        for (const tgt of [c?.next, c?.failNext]) {
          if (tgt && !claimed.has(tgt) && !BOUNDARY.has(tgt)) queue.push(tgt);
        }
      }
    }
    report.push(`◈ ${t.key}: walked ${claimed.size} venue beat(s), ${rehomed} route(s) re-homed to the walk`);

    /* ── 2. Groom the walk hub's OWN choices ──
     * Flavor picks ("Eat what Bez gives you", "Drink the well-water") were
     * authored ∅ — and v3 filled KT's with the ARRIVAL beat, which is the
     * dumped-at-the-gates bug. Flavor now SELF-LOOPS (re-presents the menu);
     * "Call it a day"-style exits route to the Crossroads. */
    walk.choices = Array.isArray(walk.choices) ? walk.choices : [];
    const isExitLabel = c => /call it a day|take your leave|leave\b.*road|head (out|back to the road)/i.test(String(c?.label || ""));
    for (const c of walk.choices) {
      if (!String(c?.label || "").trim()) continue;
      const cur = String(c?.next || "").trim();
      const misrouted = !cur || arrivals.includes(cur);
      if (!misrouted) continue;
      if (isExitLabel(c) && byId.has(CROSSROADS)) {
        c.next = CROSSROADS; changes++;
        report.push(`· ${t.key} walk: "${String(c.label).slice(0, 30)}" → Crossroads (exit)`);
      } else {
        c.next = t.walkId; changes++;
        report.push(`· ${t.key} walk: "${String(c.label).slice(0, 30)}" → self-loop (menu re-presents)`);
      }
    }
    /* ── 2b. The leave door (only if no crossroads exit exists after grooming) ── */
    if (byId.has(CROSSROADS)) {
      if (walk.choices.some(c => String(c?.next) === CROSSROADS)) {
        report.push(`· ok ${t.key}: walk exits to the Crossroads`);
      } else {
        walk.choices.push({ label: "Take your leave — the road's waiting", next: CROSSROADS,
          description: "Done here for now. Back to the fork and the hand-painted signs.",
          checkStat: "", checkDC: 0, failNext: "" });
        changes++; report.push(`✚ ${t.key}: leave door → Crossroads`);
      }
    }

    /* ── 3. Arrival routes into the walk ── */
    for (const aid of arrivals) {
      const arr = byId.get(aid);
      arr.choices = Array.isArray(arr.choices) ? arr.choices : [];
      if (arr.choices.some(c => String(c?.next) === t.walkId)) { report.push(`· ok ${t.key}: ${aid} already walks in`); continue; }
      arr.choices.unshift({ label: "Head into town", next: t.walkId,
        description: "", checkStat: "", checkDC: 0, failNext: "" });
      changes++; report.push(`✚ ${t.key}: ${aid} → "Head into town" → walk`);
    }
  }

  console.log(`[patch-settlement-walk-loops] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Walk-loops DRY RUN: ${changes} change(s) (console). Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name; a.click();
  };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-walk-loops-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Walk-loops APPLIED: ${changes} change(s). Every town loops like the Round now.`);
})();

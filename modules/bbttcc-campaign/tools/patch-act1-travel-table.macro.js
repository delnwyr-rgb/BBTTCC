/* patch-act1-travel-table.macro.js — Act 1 "Opening Roads" travel curation
 * (2026-09-03, owner playtest ruling).
 *
 * Owner spec: Act 1/Turn 0 travel should offer ONLY — Bandit Ambush
 * (repeatable), Apex Predator + Mutant Wildlife T2/T3 (repeatable), and
 * SINGLE FIRES of Weather Front and Trade Convoy. Grief-ladder arcs
 * (Chuckle Creek · Stillwater · Soft Landing) wait for Act 2. Everything
 * reopens once the factions are moving — i.e. at storyPhase >= 2.
 *
 * Mechanism (no table swapping — engine support added same day in
 * bbttcc-travel/api.travel.js):
 *  1. Grief-ladder ARRIVAL beats get requires storyPhase >= 2 (rungs already
 *     gate on their own progression flags; the arrival is the door).
 *  2. Every travel_* table entry NOT on the Act-1 allowlist gets
 *     conditions.phaseGte = 2 — invisible to the roll until Act 2, then the
 *     full terrain tables reopen BY THEMSELVES.
 *  3. Weather Front + Trade Convoy entries get once:true — the roll skips
 *     them after their beat has fired (declines don't count as fired).
 *
 * NOT done here (owner content TODOs, flagged in the report): a generic
 * replayable Bandit Ambush variant (current one founds the militia on the
 * "free" outcome); multi-monster variety for the wildlife slots; the Trade
 * Convoy MARKET inventory of sellable goods.
 *
 * Idempotent; DRY_RUN default true; backs up BOTH settings it writes
 * (campaigns + encounterTables). Run as GM.
 * Marker: [ACT1-ROADS-2026-09-03]
 */
(async () => {
  const DRY_RUN = false;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const ALLOW = new Set([
    "enc_bandit_ambush",
    "enc_apex_predator",
    "enc_mutant_wildlife_t2",
    "enc_mutant_wildlife_t3",
    "enc_weather_front",
    "enc_trade_convoy"
  ]);
  const ONCE = new Set(["enc_weather_front", "enc_trade_convoy"]);
  const GRIEF_ARRIVALS = ["chuckle_arrival", "soft_landing_arrival", "stillwater_arrival"];

  const report = [];
  let changes = 0;

  // ── campaigns: gate the grief-ladder arrivals ─────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));

  for (const id of GRIEF_ARRIVALS) {
    const b = byId.get(id);
    if (!b) { report.push(`⚠ ${id}: NOT FOUND — skipped`); continue; }
    b.inject = b.inject || {};
    let reqs = b.inject.requires;
    reqs = Array.isArray(reqs) ? reqs : (reqs ? [reqs] : []);
    b.inject.requires = reqs;
    const sp = reqs.find(r => r && String(r.flag) === "storyPhase");
    if (sp && Number(sp.gte) >= 2) { report.push(`· ok ${id}: already storyPhase >= ${sp.gte}`); continue; }
    if (sp) sp.gte = 2; else reqs.push({ flag: "storyPhase", gte: 2 });
    changes++;
    report.push(`✚ ${id}: requires storyPhase >= 2 (grief ladder waits for Act 2)`);
  }

  // ── encounterTables: phase-mark + once-mark the entries ──────────────────
  let tablesRaw = game.settings.get(NS, "encounterTables");
  const tablesWasStr = typeof tablesRaw === "string";
  const tables = tablesWasStr ? JSON.parse(tablesRaw) : foundry.utils.deepClone(tablesRaw || {});
  let tableChanges = 0;

  for (const [tid, table] of Object.entries(tables || {})) {
    if (!/^travel_/.test(String(tid))) continue;
    for (const ent of (table?.entries || [])) {
      const bid = String(ent?.beatId || "");
      if (!bid) continue;
      // conditions may be authored as a JSON string — normalize to object.
      let cond = ent.conditions;
      if (typeof cond === "string") { try { cond = JSON.parse(cond); } catch (_e) { cond = {}; } }
      cond = (cond && typeof cond === "object") ? cond : {};

      if (!ALLOW.has(bid)) {
        if (Number(cond.phaseGte) >= 2) { report.push(`· ok ${tid}/${bid}: already phaseGte ${cond.phaseGte}`); }
        else {
          cond.phaseGte = 2;
          ent.conditions = cond;
          changes++; tableChanges++;
          report.push(`✚ ${tid}/${bid}: phaseGte 2 (hidden until Act 2)`);
        }
      } else if (ONCE.has(bid)) {
        if (ent.once === true) { report.push(`· ok ${tid}/${bid}: already once`); }
        else {
          ent.once = true;
          ent.conditions = cond;
          changes++; tableChanges++;
          report.push(`✚ ${tid}/${bid}: once = true (single fire; declines don't spend it)`);
        }
      } else {
        report.push(`· ok ${tid}/${bid}: Act-1 staple, untouched (w=${ent.weight ?? 1})`);
      }
    }
  }

  console.log(`[patch-act1-travel-table] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` +
    report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Act-1 roads DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Act-1 roads: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
      `backup-campaigns-before-act1-roads-${Date.now()}.json`);
    save(tablesWasStr ? tablesRaw : JSON.stringify(tablesRaw ?? {}), "text/json",
      `backup-encounterTables-before-act1-roads-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (tableChanges) await game.settings.set(NS, "encounterTables", tablesWasStr ? JSON.stringify(tables) : tables);
  ui.notifications.info(`Act-1 roads APPLIED: ${changes} change(s). Six encounters on the opening roads; the arcs wait for Act 2.`);
})();

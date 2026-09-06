/* patch-act2-punchlist.macro.js — the Act 2 pre-flight punch list (2026-09-06)
 *
 * Fixes every ERROR and the actionable WARNs from bin/ft-lint-campaign on the
 * 2026-09-06 bundle (see ACT2_LINT_2026_09_05.md). Owner-run, GM only.
 *
 *   1. `op.cult` → `op.culture` on 3 choices (Balcones ×2, Gilbert). The label
 *      map knows "op.cult" but the faction bank has no such channel — the check
 *      was refused or debited a phantom pool.
 *   2. `vs_overture` gate `{questBucket, isNot:"unstarted"}` → the engine's buckets
 *      are active|completed|archived; "unstarted" = unmet forever. Rewritten as
 *      isNot active AND isNot completed AND isNot archived.
 *   3. `travel_ashwastes_t1` had ZERO entries (runRandomTable fires nothing).
 *      Seeded from the plains T1 pool with terrain → "ashwastes".
 *   4. Fail routes that could never fire: 12 choices carry a `failNext` but no
 *      `checkStat` (the engine only takes the fail route after a check). Each gets
 *      a stat + DC from the CHECKS table below — REVIEW THOSE, they are proposals
 *      drawn from the label and sibling choices. Two of the fail targets are the
 *      engine-held wendigo-rung ids, which were unreachable until now.
 *   5. 22 beats carry duplicated IDENTICAL factionEffects rows (editor re-saves);
 *      the engine applies every row, so "morale −1" landed as −8. Collapsed to
 *      one row each (DEDUPE_FACTION_ROWS). The Act 2 walk verified stacking.
 *
 * DRY_RUN default true — prints every change and writes nothing. Backs up the
 * `campaigns` and `encounterTables` settings to a download before writing.
 * Idempotent: re-running after apply reports 0 changes.
 */
(async () => {
  const DRY_RUN = true;                        // <-- set false to apply
  const DEDUPE_FACTION_ROWS = true;
  const NS = "bbttcc-campaign";
  // Proposed check stats for the fail-route choices (edit freely). beatId → { choiceIndex: [checkStat, checkDC] }
  const CHECKS = {
    forest_of_tifaret_leave:            { 0: ["op.logistics", 14], 1: ["op.intrigue", 14] },
    lyrenn_the_gentle_pest:             { 2: ["op.violence", 12] },
    maneuver_vault_infiltration:        { 0: ["op.intrigue", 14] },
    balcones_faulting_you_line_choices: { 4: ["arc", 16] },
    balcones_faulting_you_line_opening: { 4: ["arc", 16] },
    enc_minor_radiation_pocket:         { 0: ["op.logistics", 12], 1: ["op.faith", 14], 2: ["op.violence", 12] },
    enc_weather_front:                  { 0: ["sur", 12], 1: ["op.logistics", 12], 2: ["con", 12] }
  };
  const CULT_FIX = { balcones_faulting_you_line_choices: [3], balcones_faulting_you_line_opening: [3], gilbert_theater_parley: [1] };

  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign;
  const cid = api?.getActiveCampaignId?.();
  let rawC = game.settings.get(NS, "campaigns"); const cStr = typeof rawC === "string";
  const camps = cStr ? JSON.parse(rawC) : foundry.utils.deepClone(rawC);
  const camp = camps?.[cid];
  if (!camp) return ui.notifications.error("No active campaign.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const by = (id) => beats.find(b => b?.id === id);
  let rawT = game.settings.get(NS, "encounterTables"); const tStr = typeof rawT === "string";
  const tables = tStr ? JSON.parse(rawT) : foundry.utils.deepClone(rawT || {});
  const changes = [];
  const log = (kind, id, msg) => changes.push({ kind, id, msg });

  // 1. op.cult → op.culture
  for (const [bid, idxs] of Object.entries(CULT_FIX)) {
    const b = by(bid); if (!b) { log("SKIP", bid, "beat not found"); continue; }
    for (const i of idxs) { const ch = b.choices?.[i]; if (ch && String(ch.checkStat).toLowerCase() === "op.cult") { ch.checkStat = "op.culture"; log("cult→culture", bid, `choice[${i}] "${ch.label}"`); } }
  }
  // 2. vs_overture gate
  { const b = by("vs_overture");
    if (b) { const req = Array.isArray(b.inject?.requires) ? b.inject.requires : (b.inject?.requires ? [b.inject.requires] : []);
      const k = req.findIndex(c => c?.questBucket && c.isNot === "unstarted");
      if (k >= 0) { const q = req[k].questBucket; req.splice(k, 1, { questBucket: q, isNot: "active" }, { questBucket: q, isNot: "completed" }, { questBucket: q, isNot: "archived" }); b.inject.requires = req; log("gate", "vs_overture", `isNot:"unstarted" → isNot active/completed/archived (${q})`); } } }
  // 3. ashwastes table
  { const t = tables.travel_ashwastes_t1, src = tables.travel_plains_t1;
    if (t && src && !(t.entries || []).length && (src.entries || []).length) {
      t.entries = foundry.utils.deepClone(src.entries).map(e => ({ ...e, conditions: { ...(e.conditions || {}), terrain: "ashwastes" } }));
      log("table", "travel_ashwastes_t1", `seeded ${t.entries.length} entries from travel_plains_t1 (terrain → ashwastes)`); } }
  // 4. fail-route checks
  for (const [bid, map] of Object.entries(CHECKS)) {
    const b = by(bid); if (!b) { log("SKIP", bid, "beat not found"); continue; }
    for (const [i, [stat, dc]] of Object.entries(map)) { const ch = b.choices?.[Number(i)];
      if (!ch) { log("SKIP", bid, `choice[${i}] missing`); continue; }
      if (String(ch.checkStat || "").trim()) continue;                       // already has a check
      if (!String(ch.failNext || "").trim()) { log("SKIP", bid, `choice[${i}] has no failNext`); continue; }
      ch.checkStat = stat; ch.checkDC = dc; log("check", bid, `choice[${i}] "${ch.label}" → ${stat} DC ${dc} (fail → ${ch.failNext})`); } }
  // 5. dedupe identical factionEffects rows
  if (DEDUPE_FACTION_ROWS) for (const b of beats) {
    const rows = b?.worldEffects?.factionEffects; if (!Array.isArray(rows) || rows.length < 2) continue;
    const seen = new Set(), out = []; for (const r of rows) { const k = JSON.stringify(r); if (seen.has(k)) continue; seen.add(k); out.push(r); }
    if (out.length !== rows.length) { b.worldEffects.factionEffects = out; log("dedupe", b.id, `${rows.length} rows → ${out.length}`); } }

  console.group(`[punchlist] ${DRY_RUN ? "DRY RUN — " : ""}${changes.length} change(s)`); console.table(changes); console.groupEnd();
  if (!changes.length) return ui.notifications.info("Punch list: nothing to change (already applied).");
  if (DRY_RUN) return ui.notifications.info(`Punch list DRY RUN: ${changes.length} change(s) listed in console. Set DRY_RUN=false to apply.`);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  (foundry.utils.saveDataToFile || saveDataToFile)(JSON.stringify({ campaigns: cStr ? JSON.parse(rawC) : rawC, encounterTables: tStr ? JSON.parse(rawT) : rawT }), "application/json", `backup-before-punchlist-${stamp}.json`);
  await game.settings.set(NS, "campaigns", cStr ? JSON.stringify(camps) : camps);
  await game.settings.set(NS, "encounterTables", tStr ? JSON.stringify(tables) : tables);
  ChatMessage.create({ whisper: [game.user.id], content: `<b>Act 2 punch list applied</b> — ${changes.length} change(s).<ul style="font-size:12px">${changes.map(c => `<li><code>${c.id}</code> ${c.kind}: ${c.msg}</li>`).join("")}</ul><p>Backup downloaded. Re-export the bundle and run <code>bin/ft-lint-campaign</code> to confirm 0 ERROR.</p>` });
  ui.notifications.info(`Punch list applied: ${changes.length} change(s). Backup downloaded.`);
})();

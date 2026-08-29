/* audit-beat-links.macro.js — DANGLING LINKS + NO-EXIT MENUS (2026-08-28)
 * READ-ONLY. Run as GM. The generalized version of the Apex Predator break:
 * a menu whose only choices are checked loops on failure with no way out, and
 * a choice/outcome that names a beat id that doesn't exist routes to nothing.
 *
 * Reports, across EVERY beat in the active campaign:
 *  1. BROKEN LINKS — choice.next / choice.failNext / outcomes.success /
 *     outcomes.failure naming a nonexistent beat id.
 *  2. NO-EXIT MENUS — beats with ≥1 choice where EVERY choice carries a check
 *     (a failed roll re-offers the same trap; there is no unchecked route out).
 *  3. WORDS-DOOR FAMILIES — the live menu of each seeded intro + whether the
 *     family's outcome beats (win/lose/run/outcome hubs by id prefix) are
 *     reachable from ANY choice anywhere, or GM-fire-only.
 */
(async () => {
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const camps = (typeof campsRaw === "string") ? JSON.parse(campsRaw) : campsRaw;
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(beats.map(b => [b.id, b]));

  // Reverse link map: beatId → [sources that route to it]
  const inbound = new Map();
  const addIn = (target, src) => {
    if (!target) return;
    if (!inbound.has(target)) inbound.set(target, []);
    inbound.get(target).push(src);
  };

  const broken = [];
  const noExit = [];
  for (const b of beats) {
    const chs = Array.isArray(b.choices) ? b.choices : [];
    let checked = 0;
    for (let i = 0; i < chs.length; i++) {
      const c = chs[i] || {};
      for (const [field, v] of [["next", c.next], ["failNext", c.failNext]]) {
        const id = String(v || "").trim();
        if (id) {
          addIn(id, `${b.id} · choice[${i}] "${c.label}" .${field}`);
          if (!byId.has(id)) broken.push(`${b.id} → choice "${c.label}" .${field} = '${id}' (MISSING)`);
        }
      }
      if (String(c.checkStat || "").trim()) checked++;
    }
    for (const [field, v] of [["outcomes.success", b.outcomes?.success], ["outcomes.failure", b.outcomes?.failure]]) {
      const id = String(v || "").trim();
      // outcomes.* sometimes hold resolution keys, not beat ids — only flag
      // values that LOOK like beat ids (snake_case with a known-prefix sibling).
      if (id && !byId.has(id) && /^[a-z0-9_]+$/.test(id) && beats.some(x => id.startsWith(String(x.id).slice(0, 8)))) {
        broken.push(`${b.id} → ${field} = '${id}' (no such beat — resolution key?)`);
      } else if (id && byId.has(id)) addIn(id, `${b.id} · ${field}`);
    }
    if (chs.length && checked === chs.length) {
      noExit.push(`${b.id} "${b.label}" — ${chs.length} choice(s), ALL checked → a failed roll loops with no unchecked exit`);
    }
  }

  // Words-door families
  const FAMILIES = ["enc_bandit_ambush", "enc_raider_raze_team", "enc_mutant_wildlife_t2",
    "enc_mutant_wildlife_t3", "enc_apex_predator", "enc_qlipothic_shambler",
    "enc_slippage_wraith", "enc_geometry_serpent", "enc_qliphotic_whorl", "enc_desenitarius_maarg"];
  const famReport = [];
  for (const fid of FAMILIES) {
    const intro = byId.get(fid);
    if (!intro) { famReport.push(`⚠ ${fid}: intro NOT FOUND`); continue; }
    const chs = Array.isArray(intro.choices) ? intro.choices : [];
    famReport.push(`◈ ${fid} (${intro.type}${intro.sceneId ? ", own scene" : ""}) — ${chs.length} choice(s):`);
    chs.forEach(c => famReport.push(`    · "${c.label}" ${c.checkStat ? `[${c.checkStat} DC ${c.checkDC}]` : "[no check]"} → ${c.next || "(end)"}${c.failNext ? ` / fail → ${c.failNext}` : ""}`));
    // Family outcome beats: same stem, id contains win|lose|run|outcome
    const stem = fid.replace(/^enc_/, "");
    const fam = beats.filter(x => x.id !== fid &&
      (String(x.id).includes(stem) || String(x.id).includes(fid)) &&
      /win|lose|run|outcome|parley/i.test(String(x.id)));
    for (const f of fam) {
      const ins = inbound.get(f.id) || [];
      famReport.push(`    ${ins.length ? "🔗" : "🏝️"} ${f.id} — ${ins.length ? `reached from: ${ins.slice(0, 3).join(" | ")}${ins.length > 3 ? " …" : ""}` : "NO inbound links (GM-fire-only)"}`);
    }
  }

  // 4️⃣ TRAVEL CHAIN TERMINALS — walk every beat the travel tables can fire,
  // follow next/failNext to the chain's ends, and show where each ride can
  // stop. Terminal beats are FINE by design (the engine's auto-return + nudge
  // takes over) — this is the eyeball map for "did this chain end where the
  // author meant it to?"
  const termReport = [];
  try {
    let tablesRaw = game.settings.get(NS, "encounterTables") || {};
    const tables = (typeof tablesRaw === "string") ? JSON.parse(tablesRaw) : tablesRaw;
    const roots = new Set();
    for (const [tid, t] of Object.entries(tables || {})) {
      if (!/^travel_/i.test(tid)) continue;
      for (const ent of (Array.isArray(t?.entries) ? t.entries : [])) {
        const bid = String(ent?.beatId || "").trim();
        if (bid) roots.add(bid);
      }
    }
    for (const rootId of [...roots].sort()) {
      const root = byId.get(rootId);
      if (!root) { termReport.push(`✗ table entry → MISSING beat '${rootId}'`); continue; }
      // BFS over next/failNext
      const seen = new Set([rootId]);
      const queue = [rootId];
      const terminals = [];
      while (queue.length) {
        const b = byId.get(queue.shift());
        if (!b) continue;
        const outs = [];
        for (const c of (Array.isArray(b.choices) ? b.choices : [])) {
          for (const v of [c?.next, c?.failNext]) {
            const id = String(v || "").trim();
            if (id && byId.has(id)) outs.push(id);
          }
        }
        if (!outs.length && b.id !== rootId) terminals.push(b);
        if (!outs.length && b.id === rootId && !(b.choices || []).length) terminals.push(b);
        for (const id of outs) if (!seen.has(id)) { seen.add(id); queue.push(id); }
      }
      const termStr = terminals.length
        ? terminals.map(t => `${t.id}${Number(t.timePoints) ? ` (+${t.timePoints}d)` : ""}`).join(" · ")
        : "(no terminals — all choices loop/route)";
      termReport.push(`◈ ${rootId} [${seen.size} beat chain] ⇢ ends at: ${termStr}`);
    }
    if (!roots.size) termReport.push("(no travel_* tables found)");
  } catch (eT) { termReport.push("⚠ terminal sweep failed: " + (eT?.message || eT)); }

  const out = [
    `BEAT LINK AUDIT — ${beats.length} beats in '${campaignId}'`,
    `\n1️⃣ BROKEN LINKS (${broken.length}):`, ...(broken.length ? broken.map(s => "  ✗ " + s) : ["  ✓ none"]),
    `\n2️⃣ NO-EXIT MENUS — every choice checked (${noExit.length}):`, ...(noExit.length ? noExit.map(s => "  ⚠ " + s) : ["  ✓ none"]),
    `\n3️⃣ WORDS-DOOR FAMILIES:`, ...famReport,
    `\n4️⃣ TRAVEL CHAIN TERMINALS (every table-firable ride, walked to its ends):`, ...termReport.map(s => "  " + s)
  ];
  console.log("[audit-beat-links]\n" + out.join("\n"));
  ui.notifications.info(`Link audit: ${broken.length} broken link(s), ${noExit.length} no-exit menu(s) — full report in console.`);
})();

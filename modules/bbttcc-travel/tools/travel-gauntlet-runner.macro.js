// travel-gauntlet-runner.macro.js — RUN IN-WORLD (GM), AFTER the Forge.
// ─────────────────────────────────────────────────────────────────────────────
// TRAVEL GAUNTLET · Phase 3 — THE RUNNER. Reads the Forge manifest ("TRAVELGAUNTLET ·
// Manifest" journal), waits for the cloned scene's canvas to actually render (the
// drawings layer must be live or resolveDrawingRef returns null → plains fallback),
// then drives travel as PLACEABLES and asserts the deterministic mechanics:
//   A. TERRAIN — each role hex's cost matches TERRAIN_TABLE and DC = 15 + tier·2.
//   B. LEY GATE — gateSrc→gateDst discounts every cost line by mult=1−0.4·strength
//      (0.5⇒×0.8, 1.0⇒×0.6) vs the ungated baseline.
//   C. DARKNESS — faction darkness 7 bumps the leg DC by +2; 6 by +0. Prints the stored
//      darkness flag so a +0 result with storedGlobal=7 is a PROVEN engine bug.
//   D. RADIATION — Radiated/Contaminated hex raises faction RP (via bbttcc:afterTravel).
//   E. WEATHER — active weather (turns>0) is reused; expired (0) rerolls + persists.
// Emits console tables + a JSON fail-list (auto-downloaded) + a GM chat card.
// ⚠ GM client only. Operates ONLY on the forged clone. Re-run the Forge to reset.
(async () => {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const t0 = performance.now();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const TERR = "bbttcc-territory", FCT = "bbttcc-factions";
  const api = game.bbttcc?.api;
  const travelHex = api?.travelHex || api?.travel?.travelHex;
  if (!travelHex) return ui.notifications.error("game.bbttcc.api.travelHex missing — is bbttcc-travel active?");

  // ── Manifest ──
  const journal = game.journal.getName("TRAVELGAUNTLET · Manifest");
  const M = journal?.getFlag(TERR, "gauntletManifest");
  if (!M) return ui.notifications.error("Manifest not found — run the Forge (travel-gauntlet-foundry) first.");
  const faction = game.actors.get(M.factionId);
  const scene = game.scenes.get(M.sceneId);
  if (!faction || !scene) return ui.notifications.error("Sandbox missing — re-run the Forge.");

  // ── Activate clone + WAIT for the drawings layer to actually render ──
  if (!scene.active) { try { await scene.activate(); } catch (_e) {} }
  let canvasReady = false;
  for (let i = 0; i < 60; i++) { // up to ~15s
    if (canvas?.ready && canvas.scene?.id === scene.id && (canvas.drawings?.placeables?.length || 0) > 0) { canvasReady = true; break; }
    await sleep(250);
  }

  const TT = api?._hexTravel?.TERRAIN_TABLE || {};
  const results = [];
  const rec = (section, name, ok, detail = "") => { results.push({ section, name, ok, detail, level: ok ? "ok" : "BUG" }); console.log(`[travel-runner] ${ok ? "✓" : "✗"} [${section}] ${name}${detail ? " — " + detail : ""}`); };
  const costStr = (c) => Object.entries(c || {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => `${k}:${v}`).sort().join(",");
  const place = (role) => canvas.drawings?.get(M.roles[role]?.id) || null;     // PLACEABLE (has .document + .center)
  const travel = (fromRole, toRole) => travelHex({ factionId: faction.id, hexFrom: place(fromRole), hexTo: place(toRole), encounterPolicy: "skip", source: "travel-gauntlet" });
  const setDarkness = (g) => faction.update({ [`flags.${FCT}.darkness`]: { global: g } });

  rec("·", "canvas rendered (drawings layer live)", canvasReady, `placeables=${canvas?.drawings?.placeables?.length ?? 0} scene=${canvas?.scene?.name}`);

  try {
    // ══════════════════ A · TERRAIN cost + DC ══════════════════
    await setDarkness(0);
    for (const role of ["plains", "forest", "mountains", "ocean", "swamp"]) {
      const terrain = M.roles[role]?.terrain;
      try {
        if (!place(role)) { rec("A", `${role} placeable`, false, `canvas.drawings.get(${M.roles[role]?.id}) is null`); continue; }
        const r = await travel("home", role);
        const tier = r?.context?.terrainTier;
        const expCost = costStr(TT[terrain]?.cost);
        rec("A", `${terrain} cost matches TERRAIN_TABLE`, costStr(r.cost) === expCost, `cost={${costStr(r.cost)}} expected={${expCost}}`);
        rec("A", `${terrain} DC = 15 + tier·2`, r.dc === 15 + tier * 2, `dc=${r.dc} tier=${tier} (darkness 0)`);
        if (TT[terrain]?.tier != null) rec("A", `${terrain} tier unsurprising`, tier === TT[terrain].tier, `runtime tier=${tier} table tier=${TT[terrain].tier}${tier === TT[terrain].tier ? "" : " (campaign tier override?)"}`);
      } catch (e) { rec("A", `${terrain || role} travel`, false, `threw: ${e.message}`); }
    }

    // ══════════════════ B · LEY GATE discount ══════════════════
    try {
      const baseline = await travel("home", "gateDst");           // no gate from home
      const g05 = await travel("gateSrc", "gateDst");             // gate strength 0.5 → ×0.8
      rec("B", "gate present on gateSrc→gateDst", g05?.context?.gate?.kind === "ley-gate", `ctx.gate=${JSON.stringify(g05?.context?.gate ?? null)}`);
      const ok05 = Object.keys(baseline.cost || {}).every(k => Number(g05.cost?.[k]) === Math.max(0, Math.round(Number(baseline.cost[k]) * 0.8)));
      rec("B", "strength 0.5 → ×0.8", ok05, `ungated={${costStr(baseline.cost)}} gated={${costStr(g05.cost)}}`);
      const src = await fromUuid(M.roles.gateSrc.uuid);
      await src.update({ [`flags.${TERR}.leylines.gate.strength`]: 1.0 });
      const g10 = await travel("gateSrc", "gateDst");
      const ok10 = Object.keys(baseline.cost || {}).every(k => Number(g10.cost?.[k]) === Math.max(0, Math.round(Number(baseline.cost[k]) * 0.6)));
      rec("B", "strength 1.0 → ×0.6", ok10, `gated={${costStr(g10.cost)}} from ungated={${costStr(baseline.cost)}}`);
      await src.update({ [`flags.${TERR}.leylines.gate.strength`]: 0.5 }); // restore
    } catch (e) { rec("B", "ley gate", false, `threw: ${e.message}`); }

    // ══════════════════ C · DARKNESS DC boost (≥7 → +2) ══════════════════
    try {
      await setDarkness(0); const d0 = (await travel("home", "plains")).dc;
      await setDarkness(6); const s6 = foundry.utils.getProperty(faction, `flags.${FCT}.darkness.global`); const d6 = (await travel("home", "plains")).dc;
      await setDarkness(7); const s7 = foundry.utils.getProperty(faction, `flags.${FCT}.darkness.global`); const d7 = (await travel("home", "plains")).dc;
      await setDarkness(0);
      rec("C", "darkness 6 → +0 (below threshold)", d6 - d0 === 0, `dc0=${d0} dc6=${d6} delta=${d6 - d0} storedGlobal=${s6}`);
      rec("C", "darkness 7 → +2 (at threshold)", d7 - d0 === 2, `dc0=${d0} dc7=${d7} delta=${d7 - d0} storedGlobal=${s7}${(s7 === 7 && d7 - d0 === 0) ? " ⇐ stored=7 but no bump = ENGINE BUG" : ""}`);
    } catch (e) { rec("C", "darkness boost", false, `threw: ${e.message}`); }

    // ══════════════════ D · RADIATION accrual ══════════════════
    const rad = api?.radiation;
    if (rad?.get && rad?.add) {
      try {
        await setDarkness(0);
        const b1 = Number(rad.get(faction.id) || 0);
        await travel("home", "radiated"); await sleep(500);
        const a1 = Number(rad.get(faction.id) || 0);
        rec("D", "Radiated hex → +RP", a1 - b1 === M.radiation.radiated, `ΔRP=${a1 - b1} expected=${M.radiation.radiated} (Radiated +1 + mods.radiation 2)`);
        const b2 = a1;
        await travel("home", "contaminated"); await sleep(500);
        const a2 = Number(rad.get(faction.id) || 0);
        rec("D", "Contaminated hex → +RP", a2 - b2 === M.radiation.contaminated, `ΔRP=${a2 - b2} expected=${M.radiation.contaminated}`);
      } catch (e) { rec("D", "radiation accrual", false, `threw: ${e.message}`); }
    } else rec("D", "(section)", false, "game.bbttcc.api.radiation.{get,add} not exposed — is bbttcc-radiation active?");

    // ══════════════════ E · WEATHER no-reroll vs reroll ══════════════════
    const arc = api?.travel?.arc?.rollStep;
    const archetypes = api?.travel?.weather?.archetypes || {};
    if (typeof arc === "function") {
      try {
        const s1 = await arc({ hexUuid: M.roles.weather.uuid, terrain: "plains" });
        rec("E", "active weather is reused (no reroll)", s1?.stepCtx?.weather === M.weatherSeed, `weather=${s1?.stepCtx?.weather} expected=${M.weatherSeed}`);
        const wdoc = await fromUuid(M.roles.weather.uuid);
        await wdoc.update({ [`flags.${TERR}.weather.remainingTurns`]: 0 });
        const s2 = await arc({ hexUuid: M.roles.weather.uuid, terrain: "plains" });
        const w2 = wdoc.getFlag(TERR, "weather") || {};
        const validKey = !!w2.key && Object.prototype.hasOwnProperty.call(archetypes, w2.key);
        rec("E", "expired weather rerolls + persists", validKey && Number(w2.remainingTurns) > 0 && !!s2?.stepCtx?.weather,
          `newKey=${w2.key} remainingTurns=${w2.remainingTurns} ctx.weather=${s2?.stepCtx?.weather}`);
      } catch (e) { rec("E", "weather", false, `threw: ${e.message}`); }
    } else rec("E", "(section)", false, "game.bbttcc.api.travel.arc.rollStep not exposed.");

    // ══════════════════ F · PLAYER ADVANTAGES (rig / scout-signs / dev-6 / crew / forecast parity) ══════════════════
    // Seeded TRANSIENTLY here (not the forge) so they don't pollute §A–§E.
    await setDarkness(0);
    const RIG = { rigId: "tg-rig", name: "Gauntlet Travel Rig", type: "rig", damageState: "intact",
      passiveBonuses: [{ kind: "travel", key: "tg", label: "Test Travel Bonus", op: { economy: -4 }, hazardChance: -1, travelDefense: 2, encounterTierBias: { down: 1 } }] };
    const seedRig = (rigs) => faction.update({ [`flags.${FCT}.rigs`]: rigs });

    // F1 · RIG travel bonuses (travel home→mountains: base {economy:20,logistics:10}, tier 3)
    try {
      await seedRig([RIG]);
      const r = await travel("home", "mountains");
      const cx = r.context || {};
      rec("F", "rig cost reduction (op economy −4)", cx.rigCostDelta?.economy === -4 && Number(r.cost?.economy) === 16, `economy=${r.cost?.economy} delta=${cx.rigCostDelta?.economy}`);
      rec("F", "rig DC reduction (travelDefense 2 → dcMod −2)", cx.rigDcModAfter === -2, `dcModAfter=${cx.rigDcModAfter}`);
      rec("F", "rig tier downshift (−1)", cx.rigTerrainTierAfter === cx.rigTerrainTierBefore - 1, `${cx.rigTerrainTierBefore}→${cx.rigTerrainTierAfter}`);
      rec("F", "rig hazard prevent-chance (0.95 cap)", cx.rigHazardPreventChance === 0.95, `chance=${cx.rigHazardPreventChance}`);
    } catch (e) { rec("F", "rig bonuses", false, `threw: ${e.message}`); }

    // F2 · FORECAST ↔ ACTUAL parity — the beforeTravel hook drives BOTH; assert no divergence.
    try {
      const fctx = { factionId: faction.id, actor: faction, terrainKey: "mountains", terrainTier: 3, dcMod: 0, cost: { economy: 20, logistics: 10 } };
      Hooks.callAll("bbttcc:beforeTravel", fctx);   // forecast path (simulateBeforeTravelHooks does exactly this)
      const r = await travel("home", "mountains");   // actual
      const parity = JSON.stringify(fctx.cost) === JSON.stringify(r.context?.rigCostAfter) && fctx.dcMod === r.context?.rigDcModAfter && fctx.terrainTier === r.context?.rigTerrainTierAfter;
      rec("F", "forecast ctx == actual ctx (rig)", parity, `forecast cost=${JSON.stringify(fctx.cost)} dcMod=${fctx.dcMod} tier=${fctx.terrainTier} · actual after=${JSON.stringify(r.context?.rigCostAfter)} dcMod=${r.context?.rigDcModAfter} tier=${r.context?.rigTerrainTierAfter}`);
      await seedRig([]); // clear rig before remaining probes
    } catch (e) { rec("F", "forecast parity", false, `threw: ${e.message}`); await seedRig([]); }

    // F3 · SCOUT-SIGNS one-shot travelMods (preventHazard + tier shift, consumed after use)
    try {
      await faction.update({ [`flags.${FCT}.travelMods`]: { next: { preventHazard: true, encounterTierDelta: -1, encounterChanceDelta: 5 } } });
      const r = await travel("home", "mountains");
      const next = foundry.utils.getProperty(faction, `flags.${FCT}.travelMods.next`);
      rec("F", "scout-signs preventHazard applied", r.context?.preventHazard === true, `preventHazard=${r.context?.preventHazard}`);
      rec("F", "scout-signs tier shift applied", r.context?.terrainTier === 2, `terrainTier=${r.context?.terrainTier} (mountains 3 −1)`);
      rec("F", "scout-signs one-shot consumed", next == null, `travelMods.next=${JSON.stringify(next)}`);
    } catch (e) { rec("F", "scout-signs", false, `threw: ${e.message}`); }

    // F4 · DEV-6 free passage (fully-developed hex owned by the faction → cost 0)
    try {
      const r = await travel("home", "dev6");
      const d6doc = await fromUuid(M.roles.dev6.uuid);
      const d6tf = d6doc?.flags?.[TERR] || {};
      const allZero = Object.values(r.cost || {}).every(v => Number(v) === 0);
      rec("F", "dev-6 free passage zeroes cost", allZero && !!r.context?.devSixFreePassage,
        `cost=${JSON.stringify(r.cost)} pass=${r.context?.devSixFreePassage} · hexDevStage=${d6tf.development?.stage} hexFID=${d6tf.factionId} travelerFID=${r.context?.factionId}`);
    } catch (e) { rec("F", "dev-6 passage", false, `threw: ${e.message}`); }

    // F5 · CREW FLAG (flags.bbttcc-factions.crew) — distinct from roster ABILITY ITEMS (which now
    // work via the mitigation bridge, see F6/F7). The crew flag is read into ctx.crew + echoed as
    // crewUsed but never consumed for any bonus. Likely vestigial. Documented as a known no-op.
    try {
      await faction.update({ [`flags.${FCT}.crew`]: [{ name: "Test Crew", travel: true, op: { economy: -5 }, travelDefense: 3 }] });
      const r = await travel("home", "plains");   // plains base {economy:10} dc 17
      const crewApplied = Number(r.cost?.economy) < 10 || r.dc < 17;
      rec("F", "crew FLAG grants no bonus (known no-op)", !crewApplied, `crew flag is read into ctx.crew but never applied (use roster ability ITEMS instead — F6/F7); cost economy=${r.cost?.economy} dc=${r.dc}`);
      await faction.update({ [`flags.${FCT}.crew`]: [] });
    } catch (e) { rec("F", "crew flag", false, `threw: ${e.message}`); }

    // F6 · MITIGATION RESOLVER — the shared API the forecast + engine both use
    const mit = api?.travel?.mitigation;
    if (mit?.coverageFor) {
      // Cadence-aware test hygiene: prior §F travels consume per-turn uses via the (async) afterTravel
      // hook. Drain those in-flight consumes, THEN reset the ledger, so each probe starts with fresh uses.
      // Delete the flag (not write {used:{}}) — update() merges, so an empty `used` won't clear stale keys.
      const clearLedger = () => faction.update({ [`flags.bbttcc-travel.-=mitigationUses`]: null });
      const drainAndClear = async () => { await sleep(600); await clearLedger(); };
      try { await drainAndClear(); } catch (_e) {}   // §F starts clean (ledger persists across runs within a world turn)
      try {
        const reg = game?.fourththing?._classAutomation?.CHAR_OPT_ABILITIES;
        const warden = game.actors.get(M.wardenId);
        const wItems = (warden?.items?.contents || []).map(it => `${it.type}:${it.system?.identifier ?? "(no-id)"}`);
        const ra = mit.rosterAbilities(faction.id);
        const cov = mit.coverageFor(faction.id, { weatherKey: "dustfront" });
        rec("F", "coverageFor resolves weather mitigation from roster", (cov?.weather?.length || 0) > 0,
          `weatherCovered=[${(cov?.weather || []).map(a => a.label).join(", ")}] · reg=${!!reg} hasKey=${!!reg?.[M.weatherMitigationAbility]} wardenFID=${warden?.flags?.[FCT]?.factionId} wardenItems=[${wItems.join("; ")}] rosterAbilities=${ra.length}`);
      } catch (e) { rec("F", "mitigation resolver", false, `threw: ${e.message}`); }

      // F7 · WEATHER MITIGATION actually reduces the DC complication (the headline gap, now wired)
      try {
        const wdoc = await fromUuid(M.roles.weather.uuid);
        await wdoc.update({ [`flags.${TERR}.weather`]: { key: "dustfront", label: "Dustfront", remainingTurns: 2, ts: 0 } });   // re-seed (§E mutated it)
        const warden = game.actors.get(M.wardenId);
        // (a) WITH the ability on roster
        const withR = (await travel("home", "weather")).context?.weatherMitigationReport || {};
        // (b) WITHOUT — unlink the warden from the faction, then restore
        await warden?.update({ [`flags.${FCT}.factionId`]: "" });
        await wdoc.update({ [`flags.${TERR}.weather`]: { key: "dustfront", label: "Dustfront", remainingTurns: 2, ts: 0 } });
        const withoutR = (await travel("home", "weather")).context?.weatherMitigationReport || {};
        await warden?.update({ [`flags.${FCT}.factionId`]: faction.id });
        rec("F", "weather bites unmitigated (dustfront +2 DC)", withoutR.weatherDcApplied === 2, `unmitigated weatherDcApplied=${withoutR.weatherDcApplied}`);
        rec("F", "weather ability reduces the penalty", Number(withR.weatherDcApplied) < Number(withoutR.weatherDcApplied) && (withR.weatherCovered?.length || 0) > 0,
          `mitigated=${withR.weatherDcApplied} (covered=[${(withR.weatherCovered || []).join(", ")}]) vs unmitigated=${withoutR.weatherDcApplied}`);
      } catch (e) { rec("F", "weather mitigation apply", false, `threw: ${e.message}`); }

      // F8/F9 · ENCOUNTER-REROLL (Phase 2A) — Wheel of Fortune T4 `mitigates:["encounter"]`.
      try {
        const cov = mit.coverageFor(faction.id, {});
        rec("F", "coverageFor resolves encounter mitigation", (cov?.encounter?.length || 0) > 0, `encounterCovered=[${(cov?.encounter || []).map(a => a.label).join(", ")}]`);
        await drainAndClear();   // fresh encounter use (earlier missed §F travels may have spent it)
        // Ocean (tier 4 → DC 23) is unbeatable by 1d20+0 → guaranteed miss → reroll must fire.
        const r = await travel("home", "ocean");
        const em = r.context?.encounterMitigation, rr = r.context?.encounterReroll;
        rec("F", "encounter-reroll fires on a missed check", em?.covered === true && rr && Number.isFinite(rr.first) && Number.isFinite(rr.second),
          `covered=${em?.covered} reroll=${rr ? `first ${rr.first}→second ${rr.second} by [${(rr.by || []).join(", ")}]` : "none"} (dc23 ocean, guaranteed miss)`);
      } catch (e) { rec("F", "encounter-reroll", false, `threw: ${e.message}`); }

      // F10-F12 · CADENCE / USE-TRACKING (Phase 2B): 1 use/ability/strategic turn, lazy reset.
      try {
        const wdoc = await fromUuid(M.roles.weather.uuid);
        const reseed = () => wdoc.update({ [`flags.${TERR}.weather`]: { key: "dustfront", label: "Dustfront", remainingTurns: 2, ts: 0 } });
        await drainAndClear(); await reseed();   // drain in-flight consumes from F7/F9, then reset
        const t1 = (await travel("home", "weather")).context?.weatherMitigationReport || {};   // fresh → mitigated
        await sleep(500);                                                                       // let afterTravel consume
        const u = mit.usesFor?.(faction.id);
        await reseed();
        const t2 = (await travel("home", "weather")).context?.weatherMitigationReport || {};   // same turn → exhausted
        await faction.update({ [`flags.bbttcc-travel.mitigationUses.turn`]: -999 });            // stale anchor = "next turn" w/o touching world engine
        await reseed();
        const t3 = (await travel("home", "weather")).context?.weatherMitigationReport || {};   // reset → mitigated again
        rec("F", "use consumed: 2nd same-turn travel is unmitigated", t1.weatherDcApplied === 1 && t2.weatherDcApplied === 2,
          `travel1 dcApplied=${t1.weatherDcApplied} (covered=[${(t1.weatherCovered || []).join(", ")}]) → travel2 dcApplied=${t2.weatherDcApplied} (exhausted=${t2.weatherExhausted})`);
        rec("F", "usesFor reports the spent use", (Number(u?.used?.[M.weatherMitigationAbility]) || 0) >= 1, `used=${JSON.stringify(u?.used)} perTurn=${u?.perTurn}`);
        rec("F", "use resets next strategic turn", t3.weatherDcApplied === 1, `travel3 dcApplied=${t3.weatherDcApplied} (covered=[${(t3.weatherCovered || []).join(", ")}])`);
        await clearLedger();
      } catch (e) { rec("F", "cadence/use-tracking", false, `threw: ${e.message}`); }
    } else rec("F", "(mitigation section)", false, "game.bbttcc.api.travel.mitigation not installed — deploy travel-mitigation.bridge.js + module.json");

  } finally {
    try { await setDarkness(0); await faction.update({ [`flags.${FCT}.rigs`]: [], [`flags.${FCT}.crew`]: [] }); } catch (_e) {}
  }

  // ── Report ──
  const findings = results.filter(r => !r.ok);
  const bySection = {};
  for (const r of results) { (bySection[r.section] ??= { n: 0, bug: 0 }); bySection[r.section].n++; if (!r.ok) bySection[r.section].bug++; }
  console.log(`\n══════ TRAVEL GAUNTLET · RUNNER ══════`);
  console.log(`${results.length} assertions · ${findings.length} findings · ${Math.round((performance.now() - t0) / 1000)}s`);
  console.table(Object.entries(bySection).map(([k, v]) => ({ section: k, assertions: v.n, findings: v.bug })));
  if (findings.length) { console.log("── FINDINGS"); console.table(findings); }

  try {
    saveDataToFile(JSON.stringify({ world: game.world?.id, when: new Date().toISOString(), assertions: results.length, findings: findings.length, bySection, all: results }, null, 2),
      "application/json", `travel-gauntlet-run-${game.world?.id ?? "world"}.json`);
  } catch (_e) {}

  ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients?.("GM")?.map(u => u.id) ?? [],
    content: `<div class="fourththing-roll" style="border-color:#7ab8e8"><div class="ft-roll-header"><span class="ft-roll-name">🛤️ Travel Gauntlet — Runner</span></div>
      <p style="margin:0.2rem 0;font-size:0.8rem"><b>${results.length}</b> assertions · <b style="color:${findings.length ? "#ff8a8a" : "#a0d8a0"}">${findings.length} findings</b>.</p>
      ${findings.length ? `<ul style="margin:0.2rem 0;padding-left:1.2rem;font-size:0.72rem">${findings.map(f => `<li><b>[${f.section}]</b> ${foundry.utils.escapeHTML(f.name)} — ${foundry.utils.escapeHTML(f.detail)}</li>`).join("")}</ul>` : `<p style="margin:0.2rem 0;font-size:0.74rem;color:#a0d8a0">All assertions held.</p>`}
      <p style="margin:0.2rem 0;font-size:0.72rem;opacity:0.6;font-style:italic">Full tables in console · JSON downloaded. Re-run the Forge to reset.</p></div>`
  });
})();

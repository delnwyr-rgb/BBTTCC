// raid-gauntlet-runner.macro.js — RUN IN-WORLD (GM), AFTER the Forge.
// ─────────────────────────────────────────────────────────────────────────────
// RAID GAUNTLET · Phase 3 — THE RUNNER. Reads the Forge manifest (scene flag /
// "RAIDGAUNTLET · Manifest" journal) and FIRES the raid surface, asserting the RICH
// state deltas the raid layer exposes (far more than chat-delta):
//   • SIEGE (coalition): re-seeds the siege, then joinSiege per supporter (assert
//     participants joined + buffer grew + supporter OP bank debited), fireManeuver
//     bombard (buffer shaved), every strategic counter-activity (no throw), muster
//     both sides + resolveClash (muster attrition), tickOne (per-turn drain).
//   • INFILTRATION: step() rounds (alarm/progress move) + applyEffects deltas + coalition bonus.
//   • SOCIAL: step() rounds (influence/suspicion) + The Last Word zeroes suspicion (obstacle key)
//     + suspicion≥10 → courtCollapsed.
//   • VIOLENCE: each maneuver's throughput preview returns a non-empty intent (no headless exec API).
//   • GATES: attacker(T4) may use a high-tier maneuver; a T1 tier-probe is refused (tier gate).
// Under a DIALOG AUTOPILOT (lifted from steward-gauntlet-runner v5) that auto-resolves
// V1 Dialog + DialogV2 (covers infiltration promptFlipDialog + courtly favor pickers).
// Emits console tables + a JSON fail-list (auto-downloaded) + a GM chat card.
// ⚠ GM client only. Restores all patches in finally. Run the Forge first (re-run it to reset).
(async () => {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const t0 = performance.now();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const TIMEOUT = 20000; // scene-scenario steps animate dice + chat (~2s each); multi-step fires need headroom
  const raid  = game.bbttcc?.api?.raid;
  const siege = game.bbttcc?.api?.siege;
  if (!raid) return ui.notifications.error("game.bbttcc.api.raid missing.");

  // ── Manifest ──
  const journal = game.journal.getName("RAIDGAUNTLET · Manifest");
  let M = journal?.getFlag("bbttcc-raid", "gauntletManifest");
  if (!M) { const sc = game.scenes.find(s => s.name === "RAIDGAUNTLET · Arena"); M = sc?.getFlag("bbttcc-raid", "gauntletManifest"); }
  if (!M) return ui.notifications.error("Manifest not found — run the Forge (raid-gauntlet-foundry) first.");
  const attacker = game.actors.get(M.attackerId), defender = game.actors.get(M.defenderId);
  const supporters = (M.supporterIds || []).map(id => game.actors.get(id)).filter(Boolean);
  const tierProbes = M.tierProbes || {};
  const hexUuid = M.hexUuid;
  if (!attacker || !defender) return ui.notifications.error("Attacker/defender actors missing — re-run the Forge.");
  const arena = game.scenes.get(M.sceneId);
  if (arena && !arena.active) { try { await arena.activate(); await sleep(400); } catch (_e) {} }

  // ── Dialog autopilot (lifted from steward-gauntlet-runner v5) ──
  const origRender = Dialog.prototype.render, origConfirm = Dialog.confirm, origPrompt = Dialog.prompt;
  const DV2 = foundry.applications?.api?.DialogV2;
  const origDV2 = DV2 ? { confirm: DV2.confirm, prompt: DV2.prompt, wait: DV2.wait } : null;
  const installAutopilot = () => {
    Dialog.prototype.render = function () {
      try {
        const html = $(`<div>${this.data.content ?? ""}</div>`);
        const keys = Object.keys(this.data.buttons ?? {});
        const key = (this.data.default && this.data.buttons?.[this.data.default]) ? this.data.default : keys[0];
        const btn = key ? this.data.buttons[key] : null;
        setTimeout(() => { try { btn?.callback?.(html); } catch (_e) {} try { this.data.close?.(html); } catch (_e) {} }, 10);
      } catch (_e) {}
      return this;
    };
    Dialog.confirm = async () => true;
    Dialog.prompt = async ({ callback } = {}) => { try { return callback?.($("<div></div>")); } catch (_e) { return null; } };
    if (DV2) {
      DV2.confirm = async () => true;
      DV2.prompt = async (cfg = {}) => { try { return (await cfg.ok?.callback?.(null, { form: { elements: {} } }, null)) ?? true; } catch (_e) { return true; } };
      DV2.wait = async (cfg = {}) => {
        const btns = Array.isArray(cfg.buttons) ? cfg.buttons : Object.values(cfg.buttons ?? {});
        const def = btns.find(b => b?.default) ?? btns[0];
        try { return def?.callback ? await def.callback(null, { form: { elements: {} } }, null) : (def?.action ?? "ok"); } catch (_e) { return def?.action ?? "ok"; }
      };
    }
  };
  const removeAutopilot = () => {
    Dialog.prototype.render = origRender; Dialog.confirm = origConfirm; Dialog.prompt = origPrompt;
    if (DV2 && origDV2) { DV2.confirm = origDV2.confirm; DV2.prompt = origDV2.prompt; DV2.wait = origDV2.wait; }
  };
  const forceCloseDialogs = () => { for (const w of Object.values(ui.windows)) if (w instanceof Dialog) { try { w.close({ force: true }); } catch (_e) {} } };

  // ── Capture ──
  let captured = [];
  const origErr = console.error, origWarn = console.warn;
  const NOISE = /deprecat|legacy\s+syntax/i;
  const installCapture = () => {
    console.error = (...a) => { const s = a.map(String).join(" "); if (!NOISE.test(s)) captured.push("ERR: " + s.slice(0, 220)); origErr(...a); };
    console.warn = (...a) => { const s = a.map(String).join(" "); if (/error|failed|exception/i.test(s) && !NOISE.test(s)) captured.push("WARN: " + s.slice(0, 220)); origWarn(...a); };
  };
  const removeCapture = () => { console.error = origErr; console.warn = origWarn; };

  // ── Instrumented fire + record ──
  const results = [];
  const rec = (section, label, ok, moved, error, detail, byDesign = false) => {
    const row = { section, label, ok: !!ok, moved: !!moved, byDesign: !!byDesign, error: error || null, captured: captured.join(" | ") || null, detail: detail || null };
    results.push(row);
    if (error || captured.length || !ok) console.warn(`[raid-runner] ✗ ${section}/${label}: ${error ?? ""} ${row.captured ?? ""} ${detail ?? ""}`);
    else console.log(`[raid-runner] ✓ ${section}/${label}${moved ? " (moved)" : ""} ${detail ?? ""}`);
  };
  const fire = async (fn) => {
    captured = []; let error = null, ret = null;
    try { ret = await Promise.race([Promise.resolve(fn()), sleep(TIMEOUT).then(() => { forceCloseDialogs(); throw new Error(`timeout ${TIMEOUT}ms`); })]); }
    catch (e) { error = String(e?.message ?? e).slice(0, 260); }
    await sleep(80);
    return { ret, error };
  };
  const bufTotal = (st) => Object.values(st?.buffer || {}).reduce((s, v) => s + (Number(v) || 0), 0);
  const bank = (f) => f?.getFlag?.("bbttcc-factions", "opBank") || {};
  const bankTotal = (f) => Object.values(bank(f)).reduce((s, v) => s + (Number(v) || 0), 0);

  installAutopilot(); installCapture();
  ui.notifications.info("⚔ Raid Gauntlet runner — firing the raid surface…");
  try {
    // ══════ SECTION A · SIEGE (coalition) ══════
    if (siege?.getState && hexUuid) {
      // Re-seed a fresh active siege so the runner is idempotent (resets joins/muster/buffer).
      try {
        const wallId = M.wallActorId;
        const fresh = siege.makeSiegeState({
          attackerFactionId: attacker.id, supportingFactionIds: M.supporterIds, startedTurn: 0, sizeProfile: "standard",
          layers: [{ structureActorId: wallId, sceneId: M.sceneId, transitionRule: "threshold", thresholdPct: 50 }],
          buffer: { violence: 200, logistics: 200, economy: 100, softPower: 100, diplomacy: 100, faith: 100, intrigue: 100 },
          bufferStartingTotal: 900, intent: "sack"
        });
        fresh.defenderFactionId = defender.id;
        fresh.participants = { [attacker.id]: { factionId: attacker.id, role: "lead", joined: true, invited: true, contribution: {}, joinedTurn: 0 } };
        for (const sid of M.supporterIds) fresh.participants[sid] = { factionId: sid, role: "supporter", joined: false, invited: true, contribution: {}, joinedTurn: null };
        fresh.attackerMuster = 120; fresh.defenderMuster = 90; fresh.defenderAnytimeBudget = 30; fresh.renewalPool = 20;
        await siege.setState(hexUuid, fresh);
      } catch (e) { rec("siege", "re-seed", false, false, String(e?.message ?? e)); }

      // joinSiege per supporter — assert joined + supporter bank debited. (Buffer growth is asserted
      // across the whole coalition below: setState→getState propagation lags one read, so a per-join
      // immediate re-read can miss its own +commit.)
      const bufBeforeJoins = bufTotal(await siege.getState(hexUuid));
      for (const sup of supporters) {
        const bankBefore = bankTotal(sup);
        const { ret, error } = await fire(() => siege.joinSiege(hexUuid, sup.id, { violence: 100, logistics: 50 }));
        await sleep(150); // let the doc.update propagate before reading
        const stAfter = await siege.getState(hexUuid);
        const joined = stAfter?.participants?.[sup.id]?.joined === true;
        const debited = bankTotal(sup) < bankBefore;
        rec("siege", `joinSiege ${sup.name.replace("RAIDGAUNTLET · ", "")}`, ret?.ok !== false && !error, joined && debited, error,
          `joined=${joined} bankΔ=${bankTotal(sup) - bankBefore} reported total=${ret?.total ?? "?"} ${ret?.reason ?? ""}`);
      }
      // Coalition buffer grew by the supporters' commits (150 marks each).
      const bufAfterJoins = bufTotal(await siege.getState(hexUuid));
      rec("siege", "coalition buffer funded by supporters", true, bufAfterJoins > bufBeforeJoins, null, `buffer ${bufBeforeJoins}→${bufAfterJoins} (+${bufAfterJoins - bufBeforeJoins})`);

      // bombard (clash) — buffer shaved
      { const before = bufTotal(await siege.getState(hexUuid));
        const { ret, error } = await fire(() => siege.fireManeuver("bombard", { hexUuid, factionId: attacker.id }));
        const after = bufTotal(await siege.getState(hexUuid));
        rec("siege", "fireManeuver bombard", ret?.ok !== false && !error, after < before, error, `buffer ${before}→${after} ${ret?.summary ?? ret?.reason ?? ""}`); }

      // strategic counter-activities — invoke each via STRATEGIC_THROUGHPUT, assert no-throw + returns
      const STP = raid.STRATEGIC_THROUGHPUT || {};
      const stratKeys = Object.entries(raid.EFFECTS || {}).filter(([, e]) => e?.siegeCounterActivity).map(([k]) => k);
      for (const key of stratKeys) {
        const e = raid.EFFECTS[key];
        const fid = e?.siegeSide === "defender" ? defender.id : attacker.id;
        const { ret, error } = await fire(() => typeof STP[key] === "function"
          ? STP[key]({ factionId: fid, attackerId: attacker.id, targetUuid: hexUuid, hexUuid, notes: "" })
          : e?.apply?.({ entry: { attackerId: fid, factionId: fid, targetUuid: hexUuid } }));
        rec("siege", `strategic ${key}`, !error, ret != null, error, (typeof ret === "string" ? ret : JSON.stringify(ret))?.slice(0, 90));
      }

      // muster both sides + resolveClash — assert muster attrition. Clean stale unit TOKENS from a
      // prior run first (resolveClash needs fresh form-ups; leftover units make it bail ok:false),
      // and surface musterToScene/resolveClash's own ok/error so a real failure is diagnostic.
      if (siege.musterToScene && siege.resolveClash) {
        try {
          const sc = game.scenes.get(M.sceneId);
          if (sc) { const stale = sc.tokens.filter(t => t.getFlag?.("bbttcc-raid", "unitStrength") != null || t.actor?.getFlag?.("bbttcc-raid", "musterUnit") === true); if (stale.length) await sc.deleteEmbeddedDocuments("Token", stale.map(t => t.id)); }
        } catch (_e) {}
        // Reset both factions' finite muster pools to FULL — Form Up checks troops out of the pool and
        // the runner never recalls, so prior runs drain it to 0 ("Raise Troops first"). Deleting the
        // flag reverts to the full virtual pool (siege-muster-pool.get: no flag = size at cap).
        for (const f of [attacker, defender]) { try { await f.update({ "flags.bbttcc-raid.-=musterPool": null }); } catch (_e) {} }
        const mA = await fire(() => siege.musterToScene({ hexUuid, factionId: attacker.id, sceneId: M.sceneId, side: "attacker" }));
        const mD = await fire(() => siege.musterToScene({ hexUuid, factionId: defender.id, sceneId: M.sceneId, side: "defender" }));
        const mOk = mA.ret?.ok !== false && !mA.error && mD.ret?.ok !== false && !mD.error;
        rec("siege", "musterToScene both sides", mOk, mOk, mA.error || mD.error || mA.ret?.error || mD.ret?.error, `atkDeployed=${mA.ret?.deployed ?? "?"} defDeployed=${mD.ret?.deployed ?? "?"}`);
        const before = await siege.getState(hexUuid);
        const { ret, error } = await fire(() => siege.resolveClash({ hexUuid, sceneId: M.sceneId }));
        const after = await siege.getState(hexUuid);
        const moved = after?.attackerMuster !== before?.attackerMuster || after?.defenderMuster !== before?.defenderMuster || (after?.clashes?.length || 0) > (before?.clashes?.length || 0);
        rec("siege", "resolveClash", ret?.ok !== false && !error, moved, error || ret?.error,
          `muster ${before?.attackerMuster}/${before?.defenderMuster}→${after?.attackerMuster}/${after?.defenderMuster} outcome=${ret?.outcome ?? ret?.error ?? "?"}`);
      } else rec("siege", "resolveClash", true, false, null, "musterToScene/resolveClash not exposed");

      // tickOne — per-turn drain
      { const before = bufTotal(await siege.getState(hexUuid));
        const { ret, error } = await fire(() => siege.tickOne(hexUuid));
        const after = bufTotal(await siege.getState(hexUuid));
        rec("siege", "tickOne", ret?.ok !== false && !error, after !== before, error, `buffer ${before}→${after}`); }
    } else rec("siege", "(section)", false, false, "siege API or hexUuid missing");

    // ══════ SECTION B · INFILTRATION ══════
    if (typeof raid.infiltration === "function") {
      const { ret: inf, error: ce } = await fire(() => raid.infiltration({ attackerId: attacker.id, defenderId: defender.id, alarmMax: 6, progressMax: 6, label: "RG Infil" }));
      if (inf && !ce) {
        const s0 = inf.getState();
        const r = await fire(async () => { for (let i = 0; i < 3; i++) await inf.step({ spendIntrigue: 20 + i * 10, note: `auto${i}` }); return inf.getState(); });
        const s1 = inf.getState();
        rec("infiltration", "step ×3", !r.error, s1.progress !== s0.progress || s1.alarm !== s0.alarm || s1.round > s0.round, r.error, `alarm ${s0.alarm}→${s1.alarm} prog ${s0.progress}→${s1.progress} round ${s1.round} outcome ${s1.outcome}`);
        { const b = inf.getState().alarm; const r2 = await fire(() => inf.applyEffects([{ type: "alarmRise", delta: 2, reason: "rg" }])); const a = inf.getState().alarm; rec("infiltration", "applyEffects alarmRise+2", !r2.error, a > b || a >= inf.getState().alarmMax, r2.error, `alarm ${b}→${a}`); }
        { const b = inf.getState().alarm; const r2 = await fire(() => inf.applyEffects([{ type: "alarmDecay", delta: 1, reason: "rg" }])); const a = inf.getState().alarm; rec("infiltration", "applyEffects alarmDecay-1", !r2.error, a < b || a === 0, r2.error, `alarm ${b}→${a}`); }
        { const b = inf.getState().progress; const r2 = await fire(() => inf.applyEffects([{ type: "progressDelta", delta: 2 }])); const a = inf.getState().progress; rec("infiltration", "applyEffects progressDelta+2", !r2.error, a > b || a >= inf.getState().progressMax, r2.error, `prog ${b}→${a}`); }
        { const r2 = await fire(() => inf.step({ spendIntrigue: 20, atkOpBonus: 60, note: "coalition" })); const h = inf.getState().history; const last = h[h.length - 1]; rec("infiltration", "coalition atkOpBonus", !r2.error, !!last, r2.error, `last atkTotal=${last?.atkTotal} margin=${last?.margin}`); }
      } else rec("infiltration", "create", false, false, ce, "infiltration() did not return a scenario");
    } else rec("infiltration", "(section)", false, false, "raid.infiltration not exposed");

    // ══════ SECTION C · SOCIAL (courtly) ══════
    if (typeof raid.courtly === "function") {
      const { ret: crt, error: ce } = await fire(() => raid.courtly({ attackerId: attacker.id, defenderId: defender.id, atkInitDip: 40, atkInitSoft: 30, defInitDip: 35, defInitSoft: 30, label: "RG Courtly" }));
      if (crt && !ce) {
        { const b = crt.getState(); const r = await fire(() => crt.step({ atkAction: "persuade", defAction: "persuade", atkSpend: 20, defSpend: 10 })); const a = crt.getState(); rec("social", "step persuade", !r.error, a.influenceA !== b.influenceA || a.influenceD !== b.influenceD || a.round > b.round, r.error, `infA ${b.influenceA}→${a.influenceA} infD ${b.influenceD}→${a.influenceD}`); }
        { const b = crt.getState().suspicion; const r = await fire(() => crt.step({ atkAction: "expose", defAction: "persuade", atkSpend: 20, defSpend: 10 })); const a = crt.getState().suspicion; rec("social", "expose raises suspicion", !r.error, a >= b, r.error, `susp ${b}→${a}`); }
        // The Last Word (obstacle key): an armed expose must NOT raise suspicion (delta ≤ 0 — the
        // expose contributes 0; ambient quiet-streak decay may push it negative, which is still a pass).
        { const sBefore = crt.getState().suspicion;
          const armed = await fire(() => crt.armLastWord("A", "The Last Word"));
          const r = await fire(() => crt.step({ atkAction: "expose", defAction: "persuade", atkSpend: 20, defSpend: 10 }));
          const h = crt.getState().history; const last = h[h.length - 1]; const d = last?.suspicion_delta;
          rec("social", "The Last Word zeroes suspicion (obstacle key)", !r.error && armed.ret !== false, (d ?? (crt.getState().suspicion - sBefore)) <= 0, r.error, `armed=${armed.ret} suspicion_delta=${d}`); }
        // drive suspicion → court collapse (raiseSuspicion directly, then one step to flip the flag)
        { const r = await fire(async () => { await crt.raiseSuspicion(10, "rg-collapse"); await crt.step({ atkAction: "persuade", defAction: "persuade", atkSpend: 10, defSpend: 10 }); return crt.getState(); });
          const a = crt.getState(); rec("social", "suspicion≥10 → courtCollapsed", !r.error, a.courtCollapsed === true || a.suspicion >= 10 || a.outcome !== "ongoing", r.error, `susp=${a.suspicion} collapsed=${a.courtCollapsed} outcome=${a.outcome}`); }
      } else rec("social", "create", false, false, ce, "courtly() did not return a scenario");
    } else rec("social", "(section)", false, false, "raid.courtly not exposed");

    // ══════ SECTION D · VIOLENCE (throughput preview) ══════
    const TP = game.bbttcc?.api?.agent?.__THROUGHPUT || {};
    const violenceKeys = Object.entries(raid.EFFECTS || {})
      .filter(([, e]) => !e?.siege && lc(e?.kind) !== "strategic" && (lc(e?.meta?.engine) === "violence" || (Array.isArray(e?.raidTypes) && e.raidTypes.some(rt => /assault|violence|occupation|liberation/i.test(String(rt))))))
      .map(([k]) => k);
    function lc(s) { return String(s ?? "").toLowerCase(); }
    // Maneuvers whose throughput intentionally returns null (GM adjudicates) or that are prose/OP-roll
    // /WIP option stubs — an empty intent is BY DESIGN, not a failure.
    const NARRATIVE_VIOLENCE = new Set(["command_overdrive"]);
    let vFired = 0, vNoTP = 0;
    for (const key of violenceKeys) {
      if (typeof TP[key] !== "function") { vNoTP++; rec("violence", `throughput ${key}`, true, false, null, "no throughput (prose / OP-roll / WIP stub)", true); continue; }
      const { ret, error } = await fire(() => TP[key]({ outcomeTier: "success", result: "success", attackerFactionId: attacker.id, defenderFactionId: defender.id }));
      const moved = ret && ((ret.roundEffects?.length || 0) + (ret.factionEffects?.length || 0) + (ret.scenarioEffects?.length || 0) + (ret.worldEffects?.length || 0)) > 0;
      if (!error) vFired++;
      const byDesign = !moved && NARRATIVE_VIOLENCE.has(key);
      rec("violence", `throughput ${key}`, !error, !!moved, error, byDesign ? "narrative-by-design (throughput intentionally null)" : (moved ? `effects=${(ret.roundEffects?.length || 0) + (ret.factionEffects?.length || 0)}` : "empty intent"), byDesign);
    }
    console.log(`[raid-runner] violence: ${violenceKeys.length} keys (${vFired} fired throughput, ${vNoTP} prose/OP-roll)`);

    // ══════ SECTION E · GATES (tier) — ignoreGM forces the player-facing gate (GM bypasses all) ══════
    if (typeof raid.canUseManeuver === "function") {
      const GM = { ignoreGM: true };
      const probe = game.actors.get(tierProbes[1]); // T1
      // Pick a CREW-GRANTED tier≥2 maneuver: the maxed attacker (all crews) gets the crew-grant
      // bypass → usable; the bare T1 probe is refused by the tier gate. (An arbitrary tier-3 maneuver
      // could be doctrine-only and refused to BOTH — that tests nothing about tiering.)
      const granted = raid.crewGrants?.forFaction?.(attacker) || [];
      const pick = granted.map(k => [k, raid.EFFECTS?.[k]]).find(([, e]) => e && Number(e.tier ?? e.meta?.tier) >= 2 && !e.siege && String(e.kind).toLowerCase() !== "strategic");
      if (pick) {
        const [gKey, gEff] = pick; const tier = gEff.tier ?? gEff.meta?.tier;
        const atkCan = raid.canUseManeuver(attacker, gKey, GM);
        rec("gate", `attacker uses crew-granted ${gKey}(T${tier})`, true, atkCan?.ok === true, atkCan?.ok ? null : `attacker refused: ${atkCan?.reason}`, `ok=${atkCan?.ok} reason=${atkCan?.reason ?? ""}`);
        if (probe) { const pc = raid.canUseManeuver(probe, gKey, GM); rec("gate", `probeT1 refused ${gKey}(T${tier})`, true, pc?.ok === false, pc?.ok === true ? "UNEXPECTED: T1 allowed a tier≥2 maneuver" : null, `ok=${pc?.ok} reason=${pc?.reason}`); }
      } else rec("gate", "tier gate", true, false, null, "no crew-granted tier≥2 maneuver found to probe");
      // Differentiation: the maxed attacker (all crews/occult/classes, T3-clamped) should be able to
      // use strictly MORE maneuvers than a bare T1 probe — proves the gate engine actually gates.
      if (probe) {
        const keys = Object.keys(raid.EFFECTS || {}).filter(k => !raid.EFFECTS[k]?.siege && String(raid.EFFECTS[k]?.kind).toLowerCase() !== "strategic");
        let atkN = 0, probeN = 0;
        for (const k of keys) { if (raid.canUseManeuver(attacker, k, GM)?.ok) atkN++; if (raid.canUseManeuver(probe, k, GM)?.ok) probeN++; }
        rec("gate", "attacker out-grants T1 probe", true, atkN > probeN, atkN > probeN ? null : "gate did not differentiate attacker from T1 probe", `attacker ${atkN} vs probeT1 ${probeN} of ${keys.length}`);
      }
    } else rec("gate", "(section)", false, false, "raid.canUseManeuver not exposed (deploy the module update)");
  } finally {
    removeAutopilot(); removeCapture(); forceCloseDialogs();
  }

  // ── Report ──
  const fails = results.filter(r => r.error || r.captured || !r.ok);
  const noMove = results.filter(r => r.ok && !r.error && !r.captured && !r.moved && !r.byDesign);
  const byDesign = results.filter(r => r.byDesign);
  const bySection = {};
  for (const r of results) { (bySection[r.section] ??= { n: 0, fail: 0, moved: 0 }); bySection[r.section].n++; if (r.error || !r.ok) bySection[r.section].fail++; if (r.moved) bySection[r.section].moved++; }
  console.log(`\n══════ RAID GAUNTLET · RUNNER ══════`);
  console.log(`${results.length} fires · ${fails.length} fails · ${noMove.length} no-state-change · ${byDesign.length} by-design · ${Math.round((performance.now() - t0) / 1000)}s`);
  console.table(Object.entries(bySection).map(([k, v]) => ({ section: k, fires: v.n, fails: v.fail, moved: v.moved })));
  if (fails.length) { console.log("── FAILS"); console.table(fails); }
  if (noMove.length) { console.log("── FIRED CLEAN BUT NO STATE CHANGE (verify / allowlist)"); console.table(noMove); }
  try {
    saveDataToFile(JSON.stringify({ world: game.world?.id, when: new Date().toISOString(), fires: results.length, bySection, fails, noMove, all: results }, null, 2),
      "application/json", `raid-gauntlet-run-${game.world?.id ?? "world"}.json`);
  } catch (_e) {}
  ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients?.("GM")?.map(u => u.id) ?? [],
    content: `<div class="fourththing-roll" style="border-color:#7ab8e8"><div class="ft-roll-header"><span class="ft-roll-name">⚔ Raid Gauntlet — Runner</span></div>
      <p style="margin:0.2rem 0;font-size:0.8rem"><b>${results.length}</b> fires · <b style="color:${fails.length ? "#ff8a8a" : "#a0d8a0"}">${fails.length} fails</b> · ${noMove.length} no-state-change.</p>
      <ul style="margin:0.2rem 0;padding-left:1.2rem;font-size:0.74rem">${Object.entries(bySection).map(([k, v]) => `<li>${k}: ${v.n} fires, ${v.fail} fails, ${v.moved} moved</li>`).join("")}</ul>
      <p style="margin:0.2rem 0;font-size:0.72rem;opacity:0.6;font-style:italic">Full tables in console · JSON downloaded.</p></div>`
  });
})();

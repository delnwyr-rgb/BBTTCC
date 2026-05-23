/* siege-phase-e-selftest.macro.js
 *
 * Foundry macro — paste into a macro slot and execute (as GM).
 * Verifies Phase E.1 wiring (defender + attacker counter-activities):
 *   1. counter-activities module loaded
 *   2. all 9 handlers registered in STRATEGIC_THROUGHPUT
 *   3. all 9 registered in EFFECTS (with apply + siegeCounterActivity flag)
 *   4. all 9 catalog entries discoverable in the activities JSON (with opCosts)
 *   5. resolveTerms / resolveSurrender API present
 *   6. makeSiegeState schema additions (defenderAnytimeBudget / renewalPool /
 *      championLocks / omenReroll / stormAssault / pendingTerms)
 *   7. E.2 champion authoring + state machine: module, API, processChampionsTurn
 *      (lock expiry + locked-wounded skip), championCandidates ranking
 *   8. E.3 Relief Force scene: module, conveneRelief/resolveRelief API, recordMoraleDelta
 *      helper + pendingMoraleDeltas schema, Buffer−15 shave, wave-pick logic, VFX present
 *   9. E.4 Trojan Horse + Sinon: module, openTrojanHorseDialog API, EFFECTS/ST + catalog
 *      registration (T4 legendary Int40+D20+SP20), fail-branch math, success layer mirror
 *
 * Live execution (Reinforce, Call Relief, champion levers, terms/surrender, relief & trojan
 * scenes) needs a real besieged hex — exercise those in a playtest. This confirms the wiring.
 *
 * Spec: modules/bbttcc-raid/SIEGE_RAID_TYPE_SPEC.md §7
 */

(async () => {
  const TAG = "[siege-phaseE-selftest]";
  const results = [];
  const pass = (name, detail = "") => results.push({ name, ok: true, detail });
  const fail = (name, detail) => results.push({ name, ok: false, detail });

  const siege = game.bbttcc?.api?.siege;
  const raid = game.bbttcc?.api?.raid;
  if (!siege || !raid) { ui.notifications.error(`${TAG} siege/raid API missing. Reload world.`); return; }

  console.group(`${TAG} starting`);

  const KEYS = [
    "reinforce_garrison", "call_relief", "sue_for_terms", "champion_defends_wall", "pray_for_omen",
    "demand_surrender", "champion_withdraws", "champion_returns", "storm_final_assault"
  ];

  // 1. Module loaded ----------------------------------------------------------
  if (globalThis.__bbttcc_siege_counter_activities_loaded_v1) pass("module-loaded");
  else fail("module-loaded", "siege-counter-activities.js not loaded");

  // 2. STRATEGIC_THROUGHPUT ---------------------------------------------------
  const stMissing = KEYS.filter(k => typeof raid?.STRATEGIC_THROUGHPUT?.[k] !== "function");
  if (!stMissing.length) pass("strategic-throughput", `${KEYS.length} handlers`);
  else fail("strategic-throughput", `missing: ${stMissing.join(", ")}`);

  // 3. EFFECTS ----------------------------------------------------------------
  const efMissing = KEYS.filter(k => typeof raid?.EFFECTS?.[k]?.apply !== "function");
  if (!efMissing.length) pass("effects-registry", `${KEYS.length} handlers`);
  else fail("effects-registry", `missing: ${efMissing.join(", ")}`);
  const flagged = KEYS.filter(k => raid?.EFFECTS?.[k]?.siegeCounterActivity === true);
  if (flagged.length === KEYS.length) pass("effects-counter-flag", "all 9 flagged");
  else fail("effects-counter-flag", `only ${flagged.length}/9 flagged`);

  // 4. Catalog ----------------------------------------------------------------
  try {
    const mod = game.modules.get("bbttcc-raid");
    const base = (mod?.url || mod?.path || "/modules/bbttcc-raid").replace(/\/+$/, "");
    const json = await (await fetch(`${base}/data/bbttcc_activities_v1_4.json`, { cache: "no-store" })).json();
    const byKey = Object.fromEntries(json.map(e => [e.flags?.bbttcc?.activityKey, e]));
    const catMissing = KEYS.filter(k => !byKey[k]);
    if (!catMissing.length) pass("catalog", `${KEYS.length} entries (JSON total ${json.length})`);
    else fail("catalog", `missing: ${catMissing.join(", ")}`);
    // spot-check a couple of costs
    const rg = byKey["reinforce_garrison"]?.flags?.bbttcc?.opCosts;
    const ds = byKey["demand_surrender"]?.flags?.bbttcc?.opCosts;
    const okCosts = rg?.violence === 15 && rg?.logistics === 10 && ds?.diplomacy === 20 && ds?.violence === 10 && ds?.softPower === 10;
    if (okCosts) pass("catalog-costs", "reinforce + demand_surrender costs match spec");
    else fail("catalog-costs", `rg=${JSON.stringify(rg)} ds=${JSON.stringify(ds)}`);
  } catch (err) {
    fail("catalog", err.message);
  }

  // 5. Resolver API -----------------------------------------------------------
  if (typeof siege?.resolveTerms === "function") pass("api-resolveTerms");
  else fail("api-resolveTerms", "siege.resolveTerms missing");
  if (typeof siege?.resolveSurrender === "function") pass("api-resolveSurrender");
  else fail("api-resolveSurrender", "siege.resolveSurrender missing");

  // 6. Schema additions -------------------------------------------------------
  try {
    const s = siege.makeSiegeState({ attackerFactionId: "x", layers: [{ structureActorId: "a" }] });
    const checks = {
      defenderAnytimeBudget: s.defenderAnytimeBudget === 0,
      renewalPool: s.renewalPool === 0,
      championLocks: s.championLocks && typeof s.championLocks === "object",
      omenReroll: s.omenReroll === false,
      stormAssault: s.stormAssault === null,
      pendingTerms: s.pendingTerms === null,
      pendingMoraleDeltas: Array.isArray(s.pendingMoraleDeltas) && s.pendingMoraleDeltas.length === 0
    };
    const bad = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    if (!bad.length) pass("schema-additions", "6 counter-activity fields + pendingMoraleDeltas present");
    else fail("schema-additions", `wrong/missing: ${bad.join(", ")}`);
  } catch (err) {
    fail("schema-additions", err.message);
  }

  // 7. E.2 — champion authoring + state machine ------------------------------
  if (globalThis.__bbttcc_siege_champions_loaded_v1) pass("e2-loaded");
  else fail("e2-loaded", "siege-champions.js not loaded");
  const e2fns = ["openChampionRosterDialog", "computeDefenderBudget", "championCandidates"];
  const e2missing = e2fns.filter(fn => typeof siege?.[fn] !== "function");
  if (!e2missing.length) pass("e2-api", `${e2fns.length} functions`);
  else fail("e2-api", `missing: ${e2missing.join(", ")}`);

  const champ = globalThis.__bbttccSiegeChampions;
  if (typeof champ?.processChampionsTurn === "function") pass("e2-processTurn-present");
  else fail("e2-processTurn-present", "__bbttccSiegeChampions.processChampionsTurn missing");

  // Deterministic slice of the state machine: lock expiry + locked-wounded stays wounded.
  try {
    const st = {
      championLocks: { a: 3, b: 8 },
      attackerChampions: [{ actorId: "b", status: "wounded" }], // 'b' is locked → must NOT recover
      defenderChampions: []
    };
    champ.processChampionsTurn(st, 5); // turn 5: lock a (until 3) expires, b (until 8) holds
    const ok = !("a" in st.championLocks) && ("b" in st.championLocks) && st.attackerChampions[0].status === "wounded";
    if (ok) pass("e2-state-machine", "lock a expired · b held · locked-wounded stayed wounded");
    else fail("e2-state-machine", `locks=${JSON.stringify(st.championLocks)} b=${st.attackerChampions[0].status}`);
  } catch (err) {
    fail("e2-state-machine", err.message);
  }

  // championCandidates returns a ranked array (uses real world actors).
  try {
    const c = siege.championCandidates?.("__none__");
    if (Array.isArray(c)) pass("e2-candidates", `${c.length} candidate actor(s) ranked`);
    else fail("e2-candidates", "did not return an array");
  } catch (err) {
    fail("e2-candidates", err.message);
  }

  // 8. E.3 — Relief Force scene ----------------------------------------------
  if (globalThis.__bbttcc_siege_relief_loaded_v1) pass("e3-loaded");
  else fail("e3-loaded", "siege-relief.js not loaded");

  const e3fns = ["conveneRelief", "resolveRelief"];
  const e3missing = e3fns.filter(fn => typeof siege?.[fn] !== "function");
  if (!e3missing.length) pass("e3-api", `${e3fns.length} functions`);
  else fail("e3-api", `missing: ${e3missing.join(", ")}`);

  // recordMoraleDelta helper — present + accumulates signed deltas, ignores no-ops.
  if (typeof siege?.recordMoraleDelta === "function") {
    try {
      const st = siege.makeSiegeState({ attackerFactionId: "x", layers: [{ structureActorId: "a" }] });
      siege.recordMoraleDelta(st, { factionId: "def", delta: -1, reason: "relief_repulsed", turn: 4 });
      siege.recordMoraleDelta(st, { factionId: "def", delta: 0 });        // ignored (zero)
      siege.recordMoraleDelta(st, { delta: -2 });                         // ignored (no factionId)
      const okM = st.pendingMoraleDeltas.length === 1
        && st.pendingMoraleDeltas[0].factionId === "def"
        && st.pendingMoraleDeltas[0].delta === -1;
      if (okM) pass("e3-recordMoraleDelta", "1 delta recorded; zero/no-faction ignored");
      else fail("e3-recordMoraleDelta", `deltas=${JSON.stringify(st.pendingMoraleDeltas)}`);
    } catch (err) { fail("e3-recordMoraleDelta", err.message); }
  } else {
    fail("e3-recordMoraleDelta", "siege.recordMoraleDelta missing");
  }

  // Buffer −15 building block (the attacker_won effect uses shaveBuffer).
  try {
    const buffer = { violence: 12, logistics: 8, economy: 0, softPower: 0, diplomacy: 0, faith: 0, intrigue: 0 };
    const r = siege.shaveBuffer(buffer, 15);
    const total = siege.bufferTotal(buffer);
    if (r.shaved === 15 && total === 5) pass("e3-buffer-shave", "20 OP − 15 = 5 remaining");
    else fail("e3-buffer-shave", `shaved=${r.shaved} remaining=${total}`);
  } catch (err) { fail("e3-buffer-shave", err.message); }

  // Wave selection logic mirror: arrived+unresolved is preferred; resolved is skipped.
  try {
    const waves = [
      { waveId: "w1", arrived: true, resolved: true },
      { waveId: "w2", arrived: true, resolved: false },
      { waveId: "w3", arrived: false, resolved: false }
    ];
    const arrivedUnresolved = waves.find(w => w.arrived && !w.resolved);
    if (arrivedUnresolved?.waveId === "w2") pass("e3-wave-pick", "picks arrived+unresolved (w2), skips resolved w1");
    else fail("e3-wave-pick", `picked ${arrivedUnresolved?.waveId}`);
  } catch (err) { fail("e3-wave-pick", err.message); }

  // VFX renderer present + relief preview kinds wired (D.3 module extended in E.3).
  if (globalThis.__bbttcc_siege_vfx_loaded_v1 && typeof siege?.previewVfx === "function") pass("e3-vfx-present");
  else fail("e3-vfx-present", "siege-vfx.js / previewVfx missing");

  // 9. E.4 — Trojan Horse + Sinon Mode ---------------------------------------
  if (globalThis.__bbttcc_siege_trojan_horse_loaded_v1) pass("e4-loaded");
  else fail("e4-loaded", "siege-trojan-horse.js not loaded");

  if (typeof siege?.openTrojanHorseDialog === "function") pass("e4-api");
  else fail("e4-api", "siege.openTrojanHorseDialog missing");

  // Catalog + EFFECTS/ST registration (T4, legendary, Intrigue cost).
  const th = raid?.EFFECTS?.trojan_horse;
  if (th && typeof th.apply === "function" && th.tier === 4 && th.siegeTrojanHorse === true
      && th.cost?.intrigue === 40 && th.cost?.diplomacy === 20 && th.cost?.softPower === 20) pass("e4-effects", "T4 legendary, Int40+D20+SP20");
  else fail("e4-effects", `effects=${JSON.stringify(th && { tier: th.tier, cost: th.cost, flag: th.siegeTrojanHorse })}`);
  if (typeof raid?.STRATEGIC_THROUGHPUT?.trojan_horse === "function") pass("e4-throughput");
  else fail("e4-throughput", "STRATEGIC_THROUGHPUT.trojan_horse missing");

  try {
    const mod = game.modules.get("bbttcc-raid");
    const base = (mod?.url || mod?.path || "/modules/bbttcc-raid").replace(/\/+$/, "");
    const json = await (await fetch(`${base}/data/bbttcc_activities_v1_4.json`, { cache: "no-store" })).json();
    const e = json.find(x => x.flags?.bbttcc?.activityKey === "trojan_horse");
    const oc = e?.flags?.bbttcc?.opCosts;
    if (e && oc?.intrigue === 40 && oc?.diplomacy === 20 && oc?.softPower === 20 && e.flags.bbttcc.tier === 4) pass("e4-catalog", `JSON total ${json.length}`);
    else fail("e4-catalog", `entry=${JSON.stringify(oc)}`);
  } catch (err) { fail("e4-catalog", err.message); }

  // Fail-branch math mirror: Buffer −40 then halve remainder (−50% forces) + attacker −2 morale.
  try {
    const st = siege.makeSiegeState({ attackerFactionId: "atk", layers: [{ structureActorId: "a" }] });
    st.buffer.violence = 60;
    const shaved = siege.shaveBuffer(st.buffer, 40).shaved; // 60 → 20
    let halved = 0;
    for (const k of Object.keys(st.buffer)) { const cut = Math.floor((st.buffer[k] || 0) / 2); st.buffer[k] -= cut; halved += cut; }
    siege.recordMoraleDelta(st, { factionId: "atk", delta: -2, reason: "trojan_horse_failed", turn: 3 });
    const total = siege.bufferTotal(st.buffer);
    const okFail = shaved === 40 && halved === 10 && total === 10 && st.pendingMoraleDeltas.some(d => d.delta === -2 && d.factionId === "atk");
    if (okFail) pass("e4-fail-math", "60 −40 = 20, halved → 10; attacker −2 morale recorded");
    else fail("e4-fail-math", `shaved=${shaved} halved=${halved} total=${total}`);
  } catch (err) { fail("e4-fail-math", err.message); }

  // Success-branch mirror: all layers breached, currentLayerIdx → last, status won_trojan_horse.
  try {
    const layers = [{ breached: false }, { breached: false }, { breached: false }];
    layers.forEach(l => { if (!l.breached) { l.breached = true; l.breachedBy = "trojan_horse"; } });
    const idx = Math.max(0, layers.length - 1);
    const okWin = layers.every(l => l.breached && l.breachedBy === "trojan_horse") && idx === 2;
    if (okWin) pass("e4-success-layers", "3 layers → all breached (trojan_horse), idx 2");
    else fail("e4-success-layers", `idx=${idx}`);
  } catch (err) { fail("e4-success-layers", err.message); }

  // ---- Report ----
  console.table(results.map(r => ({ name: r.name, ok: r.ok ? "PASS" : "FAIL", detail: r.detail })));
  const total = results.length, passed = results.filter(r => r.ok).length, failed = total - passed;
  console.groupEnd();
  const summary = `${TAG} ${passed}/${total} PASS${failed ? ` · ${failed} FAIL` : ""}`;
  if (failed) { ui.notifications.error(summary); console.warn(TAG, "failures:", results.filter(r => !r.ok)); }
  else ui.notifications.info(summary);
  ChatMessage.create({
    user: game.user.id,
    whisper: [game.user.id],
    content: `<div class="bbttcc-selftest"><h3>${summary}</h3><pre style="font-size:11px;max-height:400px;overflow:auto">${results.map(r => `${r.ok ? "✓" : "✗"} ${r.name}${r.detail ? " — " + r.detail : ""}`).join("\n")}</pre></div>`
  });
})();

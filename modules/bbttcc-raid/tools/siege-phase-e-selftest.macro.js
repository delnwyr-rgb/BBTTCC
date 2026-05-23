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
 *
 * Live execution (Reinforce, Call Relief, champion levers, terms/surrender) needs a real
 * besieged hex — exercise those in a playtest. This macro confirms the wiring contract.
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
      pendingTerms: s.pendingTerms === null
    };
    const bad = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    if (!bad.length) pass("schema-additions", "6 counter-activity fields present");
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

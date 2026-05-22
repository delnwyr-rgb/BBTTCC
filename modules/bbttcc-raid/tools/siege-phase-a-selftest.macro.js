/* siege-phase-a-selftest.macro.js
 *
 * Foundry macro — paste contents into a macro slot and execute (as GM).
 * Verifies Phase A wiring of the Siege Raid Type:
 *   1. API surface (game.bbttcc.api.siege.*)
 *   2. STRATEGIC_THROUGHPUT + EFFECTS registry entries for begin_siege + establish_siege_camp
 *   3. JSON catalog activities discoverable
 *   4. validateDepot gates (no-owner, no-marquee-modifier, no-holdings, already-besieged, fail-state)
 *   5. makeSiegeState schema completeness
 *   6. terrainModifier lookup (proposed expanded table)
 *   7. snapshotChampions empty-roster path
 *   8. pickEventDeck terrain routing
 *   9. listActiveSieges enumeration
 *
 * Run after hot-reloading bbttcc-raid. Expected: all 9 sections PASS.
 *
 * Spec: modules/bbttcc-raid/SIEGE_RAID_TYPE_SPEC.md §2–§3
 */

(async () => {
  const TAG = "[siege-selftest]";
  const results = [];
  const pass = (name, detail = "") => results.push({ name, ok: true, detail });
  const fail = (name, detail) => results.push({ name, ok: false, detail });

  const siege = game.bbttcc?.api?.siege;
  if (!siege) {
    ui.notifications.error(`${TAG} API not installed. Hot-reload bbttcc-raid.`);
    return;
  }

  console.group(`${TAG} starting`);

  // 1. API surface ------------------------------------------------------------
  const expectedFns = [
    "makeSiegeState", "appendNarrativeBeat", "terrainModifier",
    "getState", "setState", "clearState", "list",
    "validateDepot", "bfsSupplyPath",
    "snapshotChampions", "applyChampionStatusChange",
    "pickEventDeck"
  ];
  const missing = expectedFns.filter(fn => typeof siege[fn] !== "function");
  if (missing.length) fail("api-surface", `missing: ${missing.join(", ")}`);
  else pass("api-surface", `${expectedFns.length} functions present`);

  // 2. Registries -------------------------------------------------------------
  const raid = game.bbttcc?.api?.raid;
  const stOk = typeof raid?.STRATEGIC_THROUGHPUT?.begin_siege === "function"
            && typeof raid?.STRATEGIC_THROUGHPUT?.establish_siege_camp === "function";
  const efOk = typeof raid?.EFFECTS?.begin_siege?.apply === "function"
            && typeof raid?.EFFECTS?.establish_siege_camp?.apply === "function";
  if (!stOk) fail("strategic-throughput-registry", "begin_siege or establish_siege_camp missing from STRATEGIC_THROUGHPUT");
  else pass("strategic-throughput-registry");
  if (!efOk) fail("effects-registry", "begin_siege or establish_siege_camp missing from EFFECTS");
  else pass("effects-registry");

  // 3. JSON catalog -----------------------------------------------------------
  try {
    const mod = game.modules.get("bbttcc-raid");
    const base = (mod?.url || mod?.path || "/modules/bbttcc-raid").replace(/\/+$/, "");
    const r = await fetch(`${base}/data/bbttcc_activities_v1_4.json`, { cache: "no-store" });
    const json = await r.json();
    const begin = json.find(e => /Begin Siege/i.test(e.name));
    const camp  = json.find(e => /Establish Siege Camp/i.test(e.name));
    if (!begin) fail("catalog-begin-siege", "entry not found");
    else pass("catalog-begin-siege", `T${begin.flags?.bbttcc?.tier} • costs ${JSON.stringify(begin.flags?.bbttcc?.opCosts)}`);
    if (!camp) fail("catalog-establish-camp", "entry not found");
    else pass("catalog-establish-camp", `T${camp.flags?.bbttcc?.tier} • costs ${JSON.stringify(camp.flags?.bbttcc?.opCosts)}`);
  } catch (err) {
    fail("catalog-fetch", err.message);
  }

  // 4. validateDepot gates ----------------------------------------------------
  const FAC = "test-faction-A";
  // Canonical field is `factionId` (confirmed via in-game probe 2026-05-22).
  const makeHex = (extra = {}) => ({
    flags: {
      "bbttcc-territory": Object.assign({
        factionId: FAC,
        modifiers: ["Fortified"],
        holdings: { rigIds: ["rig-1"], bossIds: [] },
        terrain: { key: "plains" }
      }, extra)
    }
  });
  const gate = (label, hex, expectedOk) => {
    const r = siege.validateDepot(hex, FAC);
    if (r.ok === expectedOk) pass(`validateDepot:${label}`, expectedOk ? "ok" : `rejected (${r.reason})`);
    else fail(`validateDepot:${label}`, `expected ok=${expectedOk}, got ok=${r.ok} reason=${r.reason}`);
  };
  gate("happy-path", makeHex(), true);
  gate("wrong-owner", makeHex({ factionId: "test-faction-B" }), false);
  gate("unclaimed-empty-string", makeHex({ factionId: "" }), false);
  gate("no-marquee", makeHex({ modifiers: [] }), false);
  gate("no-holdings", makeHex({ holdings: { rigIds: [], bossIds: [] } }), false);
  gate("already-besieged", makeHex({ siege: { siegeId: "x", status: "active" } }), false);
  gate("fail-state-razed", makeHex({ modifiers: ["Fortified", "Razed"] }), false);
  gate("beached-camp-counts", makeHex({ modifiers: ["Beached Camp"] }), true);
  gate("major-settlement-counts", makeHex({ modifiers: ["Major Settlement"] }), true);
  // Compat: legacy ownerFactionId is still accepted as fallback
  gate("legacy-ownerFactionId-fallback", { flags: { "bbttcc-territory": { ownerFactionId: FAC, modifiers: ["Fortified"], holdings: { rigIds: ["rig-1"], bossIds: [] }, terrain: { key: "plains" } } } }, true);

  // 5. makeSiegeState schema --------------------------------------------------
  const s = siege.makeSiegeState({
    attackerFactionId: FAC,
    startedTurn: 1,
    layers: [{ structureActorId: "actor-1" }, { structureActorId: "actor-2", transitionRule: "threshold", thresholdPct: 0.6 }],
    sizeProfile: "protracted",
    supplyOriginHexId: "hex-uuid-depot"
  });
  const expectedKeys = [
    "siegeId", "attackerFactionId", "supportingFactionIds", "startedTurn",
    "layers", "currentLayerIdx", "sizeProfile", "targetTurns",
    "buffer", "bufferStartingTotal",
    "supplyOriginHexId", "supplyOriginType", "supplyPathHexIds",
    "supplyStatus", "supplySeveredAtTurn", "gracePeriodTurns", "isNavalSupply",
    "perTurnDrain", "conditionsBreakdown",
    "interdictionsThisTurn", "escortPipsThisTurn", "reliefWaves",
    "attackerChampions", "defenderChampions",
    "eventDeckId", "eventsFired", "narrativeBeats",
    "intent", "status", "endedTurn"
  ];
  const missingKeys = expectedKeys.filter(k => !(k in s));
  if (missingKeys.length) fail("schema-keys", `missing: ${missingKeys.join(", ")}`);
  else pass("schema-keys", `${expectedKeys.length} keys present`);
  if (s.sizeProfile === "protracted" && s.targetTurns === 12) pass("schema-size-profile", "protracted → 12 target turns");
  else fail("schema-size-profile", `sizeProfile=${s.sizeProfile} targetTurns=${s.targetTurns}`);
  if (s.layers.length === 2 && s.layers[1].transitionRule === "threshold") pass("schema-layers", "2 layers, second has threshold rule");
  else fail("schema-layers", JSON.stringify(s.layers));

  // 6. terrainModifier lookups (plural + singular forms both work) -----------
  const TM = [
    ["radiated",    1.8, 0],
    ["mountains",   1.5, 1],   // canonical plural (real data form)
    ["mountain",    1.5, 1],   // singular alias
    ["swamps",      1.4, 1],
    ["swamp",       1.4, 1],
    ["forests",     1.2, 2],
    ["forest",      1.2, 2],
    ["plains",      1.0, 2],
    ["hills",       1.0, 2],
    ["sea",         0.7, 1],
    ["wilderness",  1.2, 1],   // new fallback for unclaimed/wild hexes
    ["unknown-key", 1.0, 2]    // falls back to plains
  ];
  for (const [key, expDrain, expGrace] of TM) {
    const r = siege.terrainModifier(key);
    if (r.drain === expDrain && r.grace === expGrace) pass(`terrain:${key}`, `${r.drain}× / ${r.grace}t`);
    else fail(`terrain:${key}`, `expected ${expDrain}/${expGrace}, got ${r.drain}/${r.grace}`);
  }

  // 7. snapshotChampions empty / present --------------------------------------
  const emptyFaction = { getFlag: () => null };
  const ec = siege.snapshotChampions(emptyFaction);
  if (Array.isArray(ec) && ec.length === 0) pass("champions-empty", "no roster → []");
  else fail("champions-empty", JSON.stringify(ec));
  const rosterFaction = { getFlag: (m, k) => k === "championRoster" ? ["actor-A", "actor-B"] : null };
  const rc = siege.snapshotChampions(rosterFaction);
  if (rc.length === 2 && rc.every(c => c.status === "active")) pass("champions-roster", `2 champions snapshotted as active`);
  else fail("champions-roster", JSON.stringify(rc));

  // 8. pickEventDeck routing --------------------------------------------------
  const deckChecks = [
    [{ flags: { "bbttcc-territory": { terrain: "sea" } } }, "naval"],
    [{ flags: { "bbttcc-territory": { terrain: { key: "desert" } } } }, "desert"],
    [{ flags: { "bbttcc-territory": { terrain: "plains", modifiers: ["Sacred"] } } }, "sacred"],
    [{ flags: { "bbttcc-territory": { terrain: "plains" } } }, "generic"]
  ];
  for (const [hex, expected] of deckChecks) {
    const got = siege.pickEventDeck(hex);
    if (got === expected) pass(`deck-pick:${expected}`);
    else fail(`deck-pick:${expected}`, `got ${got}`);
  }

  // 9. listActiveSieges enumeration ------------------------------------------
  const active = siege.list();
  if (Array.isArray(active)) pass("list-active-sieges", `enumerated ${active.length} active siege(s) across all scenes`);
  else fail("list-active-sieges", `not an array: ${typeof active}`);

  // 10. Phase B: tick API surface --------------------------------------------
  const phaseBFns = ["tickAll", "tickOne", "computeDrain"];
  const missingPhaseB = phaseBFns.filter(fn => typeof siege[fn] !== "function");
  if (missingPhaseB.length) fail("phase-b-api", `missing: ${missingPhaseB.join(", ")}`);
  else pass("phase-b-api", "tickAll/tickOne/computeDrain present");

  // 11. Phase B: real BFS replaced the stub ---------------------------------
  // Stub returned ok:true for any inputs; real BFS rejects unknown UUIDs.
  try {
    const r = await siege.bfsSupplyPath({
      siegeTargetHexUuid: "Scene.MISSING.Drawing.MISSING",
      depotHexUuid: "Scene.MISSING.Drawing.ALSO_MISSING",
      allowedFactionIds: ["fake"]
    });
    if (r.ok === false && /not found/i.test(r.reason || "")) {
      pass("phase-b-bfs-real", `real BFS rejects unknown UUIDs (${r.reason})`);
    } else {
      fail("phase-b-bfs-real", `BFS still appears to be Phase A stub: ${JSON.stringify(r)}`);
    }
  } catch (err) {
    fail("phase-b-bfs-real", err.message);
  }

  // 12. Phase B: advance-turn hook subscribed --------------------------------
  if (globalThis.__bbttcc_siege_tick_hook_installed) {
    pass("phase-b-hook-installed", "bbttcc:advanceTurn:end subscriber registered");
  } else {
    fail("phase-b-hook-installed", "tick hook not subscribed (siege-tick.js failed to install)");
  }

  // 13. isFaction discriminator (Steward vs Faction) ------------------------
  // Mocks the two canonical Faction signals + a negative case.
  if (typeof siege.isFaction === "function") {
    const mockFactionByFlag = {
      getFlag: (mod, key) => (mod === "bbttcc-factions" && key === "isFaction") ? true : null,
      system: {}
    };
    const mockFactionBySystem = {
      getFlag: () => null,
      system: { details: { type: { value: "faction" } } }
    };
    const mockSteward = {
      getFlag: () => null,
      system: { details: { type: { value: "" } } },
      name: "Etta Bloom"
    };
    if (siege.isFaction(mockFactionByFlag)) pass("isFaction:flag-positive");
    else fail("isFaction:flag-positive", "actor with isFaction flag should pass");
    if (siege.isFaction(mockFactionBySystem)) pass("isFaction:system-positive");
    else fail("isFaction:system-positive", "actor with system.details.type.value=faction should pass");
    if (!siege.isFaction(mockSteward)) pass("isFaction:steward-rejected");
    else fail("isFaction:steward-rejected", "Steward should NOT be classified as Faction");
    if (!siege.isFaction(null)) pass("isFaction:null-rejected");
    else fail("isFaction:null-rejected", "null should return false");
  } else {
    fail("isFaction:api-missing", "game.bbttcc.api.siege.isFaction not exposed (siege-state.js not reloaded?)");
  }

  // ---- Report ----
  console.table(results.map(r => ({ name: r.name, ok: r.ok ? "PASS" : "FAIL", detail: r.detail })));
  const total = results.length;
  const passed = results.filter(r => r.ok).length;
  const failed = total - passed;

  console.groupEnd();
  const summary = `${TAG} ${passed}/${total} PASS${failed ? ` · ${failed} FAIL` : ""}`;
  if (failed) {
    ui.notifications.error(summary);
    console.warn(TAG, "failures:", results.filter(r => !r.ok));
  } else {
    ui.notifications.info(summary);
  }
  ChatMessage.create({
    user: game.user.id,
    whisper: [game.user.id],
    content: `<div class="bbttcc-selftest"><h3>${summary}</h3><pre style="font-size:11px;max-height:400px;overflow:auto">${results.map(r => `${r.ok ? "✓" : "✗"} ${r.name}${r.detail ? " — " + r.detail : ""}`).join("\n")}</pre></div>`
  });
})();

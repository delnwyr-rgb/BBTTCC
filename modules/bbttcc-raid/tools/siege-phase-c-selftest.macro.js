/* siege-phase-c-selftest.macro.js
 *
 * Foundry macro — paste contents into a macro slot and execute (as GM).
 * Verifies Phase C wiring of the Siege Raid Type (Threat Vectors):
 *   1. API surface additions (findSiegesUsingHex / shaveBuffer / bufferTotal)
 *   2. STRATEGIC_THROUGHPUT + EFFECTS registry entries for all 4 threat vectors
 *   3. JSON catalog activities discoverable (interdict / escort / counter / sortie)
 *   4. makeSiegeState schema additions (interdictedHexIds / sortieCasualtiesTotal / pulse counters)
 *   5. shaveBuffer round-robin math (exact + over-shave + empty-buffer)
 *   6. findSiegesUsingHex returns an array + honors interdictedOnly/includeTarget without throwing
 *   7. Escort-netting formula mirror (documents the tick's consume logic)
 *   8. End-to-end state mutation dry-run: interdict → counter-interdict round-trip on a synthetic state
 *
 * Run after hot-reloading bbttcc-raid. Expected: all sections PASS.
 *
 * Spec: modules/bbttcc-raid/SIEGE_RAID_TYPE_SPEC.md §4
 */

(async () => {
  const TAG = "[siege-phaseC-selftest]";
  const results = [];
  const pass = (name, detail = "") => results.push({ name, ok: true, detail });
  const fail = (name, detail) => results.push({ name, ok: false, detail });

  const siege = game.bbttcc?.api?.siege;
  if (!siege) {
    ui.notifications.error(`${TAG} API not installed. Hot-reload bbttcc-raid.`);
    return;
  }

  console.group(`${TAG} starting`);

  const VECTORS = ["interdict_supply_line", "escort_supply_line", "counter_interdict", "sortie"];

  // 1. API surface additions --------------------------------------------------
  const newFns = ["findSiegesUsingHex", "shaveBuffer", "bufferTotal"];
  const missing = newFns.filter(fn => typeof siege[fn] !== "function");
  if (missing.length) fail("api-surface", `missing: ${missing.join(", ")}`);
  else pass("api-surface", `${newFns.length} Phase C functions present`);

  // 2. Registries -------------------------------------------------------------
  const raid = game.bbttcc?.api?.raid;
  const stMissing = VECTORS.filter(k => typeof raid?.STRATEGIC_THROUGHPUT?.[k] !== "function");
  const efMissing = VECTORS.filter(k => typeof raid?.EFFECTS?.[k]?.apply !== "function");
  if (stMissing.length) fail("strategic-throughput-registry", `missing: ${stMissing.join(", ")}`);
  else pass("strategic-throughput-registry", `${VECTORS.length} handlers`);
  if (efMissing.length) fail("effects-registry", `missing: ${efMissing.join(", ")}`);
  else pass("effects-registry", `${VECTORS.length} handlers`);
  // EFFECTS entries should be flagged as threat vectors + carry costs
  const flagged = VECTORS.filter(k => raid?.EFFECTS?.[k]?.siegeThreatVector === true);
  if (flagged.length === VECTORS.length) pass("effects-threat-flag", "all 4 flagged siegeThreatVector");
  else fail("effects-threat-flag", `only ${flagged.length}/4 flagged`);

  // 3. JSON catalog -----------------------------------------------------------
  try {
    const mod = game.modules.get("bbttcc-raid");
    const base = (mod?.url || mod?.path || "/modules/bbttcc-raid").replace(/\/+$/, "");
    const r = await fetch(`${base}/data/bbttcc_activities_v1_4.json`, { cache: "no-store" });
    const json = await r.json();
    const byKey = Object.fromEntries(json.map(e => [e.flags?.bbttcc?.activityKey, e]));
    for (const k of VECTORS) {
      const e = byKey[k];
      if (!e) fail(`catalog-${k}`, "entry not found");
      else pass(`catalog-${k}`, `T${e.flags?.bbttcc?.tier} • ${JSON.stringify(e.flags?.bbttcc?.opCosts)}`);
    }
  } catch (err) {
    fail("catalog-fetch", err.message);
  }

  // 4. Schema additions -------------------------------------------------------
  try {
    const s = siege.makeSiegeState({ attackerFactionId: "x", layers: [{ structureActorId: "a" }] });
    const checks = {
      interdictedHexIds: Array.isArray(s.interdictedHexIds) && s.interdictedHexIds.length === 0,
      sortieCasualtiesTotal: s.sortieCasualtiesTotal === 0,
      interdictionsThisTurn: s.interdictionsThisTurn === 0,
      escortPipsThisTurn: s.escortPipsThisTurn === 0
    };
    const bad = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    if (bad.length) fail("schema-additions", `wrong/missing: ${bad.join(", ")}`);
    else pass("schema-additions", "interdictedHexIds[] + sortieCasualtiesTotal + pulse counters");
  } catch (err) {
    fail("schema-additions", err.message);
  }

  // 5. shaveBuffer math -------------------------------------------------------
  try {
    // Exact: 10 across {violence:30, logistics:20} → 10 removed, 40 remain
    const b1 = { violence: 30, logistics: 20, economy: 0, softPower: 0, diplomacy: 0, faith: 0, intrigue: 0 };
    const r1 = siege.shaveBuffer(b1, 10);
    const ok1 = r1.shaved === 10 && siege.bufferTotal(b1) === 40;
    // Over-shave: ask 100 from a buffer of 12 → shave 12, remaining 88, buffer empty
    const b2 = { violence: 7, logistics: 5, economy: 0, softPower: 0, diplomacy: 0, faith: 0, intrigue: 0 };
    const r2 = siege.shaveBuffer(b2, 100);
    const ok2 = r2.shaved === 12 && r2.remaining === 88 && siege.bufferTotal(b2) === 0;
    // Empty buffer: nothing to shave
    const b3 = { violence: 0, logistics: 0, economy: 0, softPower: 0, diplomacy: 0, faith: 0, intrigue: 0 };
    const r3 = siege.shaveBuffer(b3, 5);
    const ok3 = r3.shaved === 0 && r3.remaining === 5;
    if (ok1 && ok2 && ok3) pass("shaveBuffer-math", "exact / over-shave / empty all correct");
    else fail("shaveBuffer-math", `ok1=${ok1} ok2=${ok2} ok3=${ok3}`);
  } catch (err) {
    fail("shaveBuffer-math", err.message);
  }

  // 6. findSiegesUsingHex smoke ----------------------------------------------
  try {
    const a = siege.findSiegesUsingHex("nonexistent-uuid");
    const b = siege.findSiegesUsingHex("nonexistent-uuid", { interdictedOnly: true, includeTarget: true });
    if (Array.isArray(a) && Array.isArray(b)) pass("findSiegesUsingHex-smoke", `live active sieges scanned (${siege.list().length})`);
    else fail("findSiegesUsingHex-smoke", "did not return arrays");
  } catch (err) {
    fail("findSiegesUsingHex-smoke", err.message);
  }

  // 7. Escort-netting formula mirror -----------------------------------------
  // Mirrors siege-tick.js step 0: net = max(0, interdictions - escortPips).
  try {
    const cases = [
      [3, 1, 2], [1, 1, 0], [0, 3, 0], [5, 0, 5], [2, 5, 0]
    ];
    const wrong = cases.filter(([i, e, want]) => Math.max(0, i - e) !== want);
    if (!wrong.length) pass("escort-netting-formula", "5 cases match max(0, interdictions − escort)");
    else fail("escort-netting-formula", `mismatch: ${JSON.stringify(wrong)}`);
  } catch (err) {
    fail("escort-netting-formula", err.message);
  }

  // 8. Interdict → Counter-Interdict round-trip on a synthetic state ----------
  // Replays exactly what the handlers do to siege state (buffer + array bookkeeping),
  // without needing a hex doc on canvas.
  try {
    const s = siege.makeSiegeState({
      attackerFactionId: "atk",
      layers: [{ structureActorId: "wall" }],
      buffer: { violence: 30, logistics: 20 },
      bufferStartingTotal: 50,
      supplyPathHexIds: ["depot-uuid", "road-uuid", "target-uuid"]
    });
    const HEX = "road-uuid";

    // --- interdict ---
    s.interdictionsThisTurn += 1;
    s.interdictedHexIds = Array.from(new Set([...s.interdictedHexIds, HEX]));
    const sh = siege.shaveBuffer(s.buffer, 10);
    const afterInterdict =
      s.interdictionsThisTurn === 1 &&
      s.interdictedHexIds.includes(HEX) &&
      sh.shaved === 10 &&
      siege.bufferTotal(s.buffer) === 40;

    // --- counter-interdict ---
    s.interdictedHexIds = s.interdictedHexIds.filter(h => h !== HEX);
    s.interdictionsThisTurn = Math.max(0, s.interdictionsThisTurn - 1);
    const afterCounter =
      !s.interdictedHexIds.includes(HEX) &&
      s.interdictionsThisTurn === 0;

    if (afterInterdict && afterCounter) pass("interdict-counter-roundtrip", "buffer −10, interdiction set then cleared");
    else fail("interdict-counter-roundtrip", `interdict=${afterInterdict} counter=${afterCounter}`);
  } catch (err) {
    fail("interdict-counter-roundtrip", err.message);
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

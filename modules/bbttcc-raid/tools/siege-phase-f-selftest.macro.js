/* siege-phase-f-selftest.macro.js
 *
 * Foundry macro — paste into a macro slot and execute (as GM).
 * Verifies Phase F.1 wiring (the §8 outcome WRITE-BACK engine):
 *   1. siege-outcome-writeback.js loaded + bbttcc:siege:outcome hook installed
 *   2. game.bbttcc.api.siege.applyOutcomeWriteback + OUTCOME_MATRIX exposed
 *   3. matrix completeness — all 9 §8 statuses present, spot-checked
 *   4. sibling write APIs reachable (factions.bumpMorale / op.commit /
 *      territory.recordHexImprovement / factions.stockpile) — the write-back
 *      degrades gracefully if any are missing, but full function needs them
 *   5. refund conversion mirror (OP→marks ×10, softPower→softpower remap)
 *   6. intent→holdings mode mirror (sack→capture / raze→destroy / capture→capture)
 *   7. F.2 Champion Death Cascade: module + hook + API; cascade-core mirror
 *      (attacker buffer−20 + rally absent allies; defender threshold−10% clamp, no buffer)
 *
 * Live execution (a real siege resolving → hex flips owner, morale moves, saga written;
 * a champion falling → allies rally) needs a real besieged hex — exercise in a playtest.
 *
 * Spec: modules/bbttcc-raid/SIEGE_RAID_TYPE_SPEC.md §8
 */

(async () => {
  const TAG = "[siege-phaseF-selftest]";
  const results = [];
  const pass = (name, detail = "") => results.push({ name, ok: true, detail });
  const fail = (name, detail) => results.push({ name, ok: false, detail });

  const siege = game.bbttcc?.api?.siege;
  if (!siege) { ui.notifications.error(`${TAG} siege API missing. Reload world.`); return; }

  console.group(`${TAG} starting`);

  // 1. Module + hook -----------------------------------------------------------
  if (globalThis.__bbttcc_siege_outcome_writeback_loaded_v1) pass("f1-loaded");
  else fail("f1-loaded", "siege-outcome-writeback.js not loaded");
  if (globalThis.__bbttcc_siege_writeback_hook_installed) pass("f1-hook", "subscribed to bbttcc:siege:outcome");
  else fail("f1-hook", "outcome hook not installed");

  // 2. API ---------------------------------------------------------------------
  if (typeof siege.applyOutcomeWriteback === "function") pass("f1-api");
  else fail("f1-api", "siege.applyOutcomeWriteback missing");

  const M = siege.OUTCOME_MATRIX;
  // 3. Matrix completeness + spot-checks --------------------------------------
  const STATUSES = ["won_storm", "won_sack", "won_surrender", "won_trojan_horse", "lost_hold", "lost_supply_crisis", "lost_pyrrhic", "lost_relieved", "abandoned"];
  if (M && STATUSES.every(s => M[s])) pass("f1-matrix-9", "all 9 §8 statuses present");
  else fail("f1-matrix-9", `missing: ${STATUSES.filter(s => !M?.[s]).join(", ")}`);
  try {
    const okSpot = M.won_storm.transferHex === true && M.won_storm.modifiers.includes("Sacked") && M.won_storm.defMorale === -3
      && M.won_trojan_horse.modifiers.includes("Treachery") && M.won_trojan_horse.holdings === "byIntentHalf"
      && M.won_sack.stealStockpilePct === 0.5 && M.won_sack.transferHex === false
      && M.lost_relieved.relieverMorale === 1 && M.lost_hold.defStockpileDelta === -15;
    if (okSpot) pass("f1-matrix-spot", "storm/trojan/sack/relieved/hold rows match spec §8");
    else fail("f1-matrix-spot", "a matrix row diverges from spec");
  } catch (err) { fail("f1-matrix-spot", err.message); }

  // 4. Sibling write APIs ------------------------------------------------------
  const deps = {
    "factions.bumpMorale": game.bbttcc?.api?.factions?.bumpMorale,
    "op.commit": game.bbttcc?.api?.op?.commit,
    "territory.recordHexImprovement": game.bbttcc?.api?.territory?.recordHexImprovement,
    "factions.stockpile": game.bbttcc?.api?.factions?.stockpile
  };
  const depMissing = Object.entries(deps).filter(([, v]) => !v).map(([k]) => k);
  if (!depMissing.length) pass("f1-deps", "all 4 sibling write APIs reachable");
  else fail("f1-deps", `MISSING (write-back will degrade): ${depMissing.join(", ")}`);

  // 5. Refund conversion mirror (OP→marks ×10, softPower→softpower) ------------
  try {
    const BTO = { violence: "violence", logistics: "logistics", economy: "economy", softPower: "softpower", diplomacy: "diplomacy", faith: "faith", intrigue: "intrigue" };
    const buffer = { violence: 30, logistics: 20, economy: 10, softPower: 5, diplomacy: 0, faith: 0, intrigue: 0 };
    const deltas = {}; let refunded = 0;
    for (const [bk, ok] of Object.entries(BTO)) { const op = Math.round((buffer[bk] || 0) * 1.0); if (op > 0) { deltas[ok] = op * 10; refunded += op; } }
    const okR = refunded === 65 && deltas.violence === 300 && deltas.softpower === 50 && !("softPower" in deltas);
    if (okR) pass("f1-refund-mirror", "60+5 OP → 650 marks; softPower→softpower");
    else fail("f1-refund-mirror", `refunded=${refunded} deltas=${JSON.stringify(deltas)}`);
  } catch (err) { fail("f1-refund-mirror", err.message); }

  // 6. Intent→holdings mode mirror --------------------------------------------
  try {
    const mode = (i) => ({ sack: "capture", raze: "destroy", capture: "capture" }[i] || "capture");
    if (mode("sack") === "capture" && mode("raze") === "destroy" && mode("capture") === "capture" && mode(undefined) === "capture") pass("f1-intent-mirror");
    else fail("f1-intent-mirror", "intent map diverged");
  } catch (err) { fail("f1-intent-mirror", err.message); }

  // 7. F.2 — Champion Death Cascade -------------------------------------------
  if (globalThis.__bbttcc_siege_champion_cascade_loaded_v1) pass("f2-loaded");
  else fail("f2-loaded", "siege-champion-cascade.js not loaded");
  if (globalThis.__bbttcc_siege_cascade_hook_installed) pass("f2-hook", "subscribed to bbttcc:siege:championDeath");
  else fail("f2-hook", "cascade hook not installed");
  if (typeof siege.runChampionCascade === "function") pass("f2-api");
  else fail("f2-api", "siege.runChampionCascade missing");

  // Deterministic cascade-core mirror: attacker death rallies absent allies (rng→0), skips
  // dead + active; Buffer.violence −20 clamped; no threshold change on attacker side.
  try {
    const CH = 0.30, WK = 0.10, HIT = 20;
    const core = (state, side, championId, rng) => {
      const roster = side === "attacker" ? state.attackerChampions : state.defenderChampions;
      const rallied = []; let bufferHit = 0, thr = false;
      if (side === "attacker") { const b = state.buffer.violence || 0; state.buffer.violence = Math.max(0, b - HIT); bufferHit = b - state.buffer.violence; }
      for (const c of roster) { if (c.actorId === championId) continue; if (c.status === "absent" && rng() < CH) { c.status = "active"; rallied.push(c.actorId); } }
      if (side === "defender") { const L = state.layers[state.currentLayerIdx ?? 0]; if (L && L.thresholdPct != null) { L.thresholdPct = Math.min(0.95, L.thresholdPct + WK); thr = true; } }
      return { rallied, bufferHit, thr };
    };
    const s = { buffer: { violence: 30 }, currentLayerIdx: 0, layers: [{ thresholdPct: 0.3 }],
      attackerChampions: [{ actorId: "p", status: "dead" }, { actorId: "a", status: "absent" }, { actorId: "d", status: "active" }], defenderChampions: [] };
    const r = core(s, "attacker", "p", () => 0);
    const okA = r.bufferHit === 20 && s.buffer.violence === 10 && r.rallied.join() === "a"
      && s.attackerChampions.find(c => c.actorId === "d").status === "active" && r.thr === false;
    // defender side: threshold weakens, no buffer hit
    const s2 = { buffer: { violence: 30 }, currentLayerIdx: 0, layers: [{ thresholdPct: 0.9 }], attackerChampions: [], defenderChampions: [{ actorId: "h", status: "dead" }] };
    const r2 = core(s2, "defender", "h", () => 0);
    const okD = r2.bufferHit === 0 && s2.layers[0].thresholdPct === 0.95 && r2.thr === true;
    if (okA && okD) pass("f2-cascade-mirror", "atk: buffer−20 + rally absent only; def: threshold+10% clamp 0.95, no buffer");
    else fail("f2-cascade-mirror", `okA=${okA} okD=${okD}`);
  } catch (err) { fail("f2-cascade-mirror", err.message); }

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

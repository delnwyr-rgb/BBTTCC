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
 *
 * Live execution (a real siege resolving → hex flips owner, morale moves, saga
 * written) needs a real besieged hex — exercise in a playtest. This confirms wiring.
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

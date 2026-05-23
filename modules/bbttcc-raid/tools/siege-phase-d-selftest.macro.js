/* siege-phase-d-selftest.macro.js
 *
 * Foundry macro — paste into a macro slot and execute (as GM).
 * Verifies Phase D wiring (D.1 Siege HUD + Convene spine; D.2 layer transition):
 *   1. HUD module loaded (globalThis marker)
 *   2. API surface: game.bbttcc.api.siege.convene / refreshHud are functions
 *   3. Shared HUD draggable helper present
 *   4. Render smoke: refreshHud() does not throw; reports active-siege count
 *   5. Panel mount: if ≥1 active siege, #ft-siege-hud appears in the DOM
 *   6. Convene guard: convene() on a bogus hex warns gracefully (no throw)
 *   7. D.2 layer-transition engine loaded + API (layerBreaches / breachCurrentLayer)
 *   8. D.2 transition-rule predicate: razed / threshold / stockpile cases
 *   9. D.3 Catastrophic Entry VFX: renderer loaded, previewVfx mounts banner + styles
 *  10. D.4 Champion Duel: module + API + catalog entry + duel VFX preview
 *
 * D.1 is mostly visual/interactive — confirm the HUD visually after this passes:
 * a panel should appear at top-right whenever a siege is active, with a
 * "⚔ Convene Breach Scene" button (GM only) per siege.
 *
 * Spec: modules/bbttcc-raid/SIEGE_RAID_TYPE_SPEC.md §5
 */

(async () => {
  const TAG = "[siege-phaseD-selftest]";
  const results = [];
  const pass = (name, detail = "") => results.push({ name, ok: true, detail });
  const fail = (name, detail) => results.push({ name, ok: false, detail });

  console.group(`${TAG} starting`);

  // 1. Module loaded ----------------------------------------------------------
  if (globalThis.__bbttcc_siege_hud_loaded_v1) pass("hud-loaded", "siege-hud.js executed");
  else fail("hud-loaded", "globalThis.__bbttcc_siege_hud_loaded_v1 missing — siege-hud.js not loaded?");

  // 2. API surface ------------------------------------------------------------
  const siege = game.bbttcc?.api?.siege;
  if (typeof siege?.convene === "function") pass("api-convene");
  else fail("api-convene", "game.bbttcc.api.siege.convene not a function");
  if (typeof siege?.refreshHud === "function") pass("api-refreshHud");
  else fail("api-refreshHud", "game.bbttcc.api.siege.refreshHud not a function");

  // 3. Draggable helper -------------------------------------------------------
  if (typeof globalThis._ftMakeHudDraggable === "function") pass("hud-draggable-helper");
  else fail("hud-draggable-helper", "_ftMakeHudDraggable missing (HUD won't be movable)");

  // 4. Render smoke -----------------------------------------------------------
  let activeCount = 0;
  try {
    activeCount = (siege?.list?.() || []).length;
    siege?.refreshHud?.();
    await new Promise(r => setTimeout(r, 120)); // let the debounced render run
    pass("render-smoke", `refreshHud ok · ${activeCount} active siege(s)`);
  } catch (err) {
    fail("render-smoke", err.message);
  }

  // 5. Panel mount ------------------------------------------------------------
  const panel = document.getElementById("ft-siege-hud");
  if (activeCount > 0) {
    if (panel) pass("panel-mount", "#ft-siege-hud present in DOM");
    else fail("panel-mount", "active siege(s) exist but #ft-siege-hud not mounted");
  } else {
    if (!panel) pass("panel-mount-empty", "no active sieges → no panel (correct)");
    else fail("panel-mount-empty", "panel present with zero active sieges (should teardown)");
  }

  // 6. Convene guard ----------------------------------------------------------
  try {
    await siege?.convene?.("Scene.bogus.Drawing.bogus");
    pass("convene-guard", "bogus hex handled without throwing");
  } catch (err) {
    fail("convene-guard", `convene threw on bogus hex: ${err.message}`);
  }

  // 7. D.2 — layer transition engine loaded + API ----------------------------
  if (globalThis.__bbttcc_siege_layer_transition_loaded_v1) pass("d2-loaded", "siege-layer-transition.js executed");
  else fail("d2-loaded", "globalThis.__bbttcc_siege_layer_transition_loaded_v1 missing");
  if (typeof siege?.layerBreaches === "function") pass("d2-api-layerBreaches");
  else fail("d2-api-layerBreaches", "game.bbttcc.api.siege.layerBreaches not a function");
  if (typeof siege?.breachCurrentLayer === "function") pass("d2-api-breachCurrentLayer");
  else fail("d2-api-breachCurrentLayer", "game.bbttcc.api.siege.breachCurrentLayer not a function");

  // 8. D.2 — transition rule predicate (razed / threshold / stockpile) -------
  try {
    const lb = siege.layerBreaches;
    const mkActor = (cur, max) => ({ getFlag: (s, k) => (s === "bbttcc-structures" && k === "plates") ? { current: cur, max } : null });
    const cases = [
      ["razed @ razed",        lb({ transitionRule: "razed" }, null, "razed") === true],
      ["razed @ breached",     lb({ transitionRule: "razed" }, null, "breached") === false],
      ["threshold 40/100≤.5",  lb({ transitionRule: "threshold", thresholdPct: 0.5 }, mkActor(40, 100), "damaged") === true],
      ["threshold 60/100≤.5",  lb({ transitionRule: "threshold", thresholdPct: 0.5 }, mkActor(60, 100), "damaged") === false],
      ["threshold max0→false", lb({ transitionRule: "threshold", thresholdPct: 0.5 }, mkActor(0, 0), "damaged") === false],
      ["stockpile 0≤0",        lb({ transitionRule: "stockpile", stockpileCurrent: 0 }, null, "damaged") === true],
      ["stockpile 3≤0",        lb({ transitionRule: "stockpile", stockpileCurrent: 3 }, null, "damaged") === false]
    ];
    const bad = cases.filter(([, ok]) => !ok).map(([n]) => n);
    if (!bad.length) pass("d2-rule-predicate", `${cases.length} rule cases correct`);
    else fail("d2-rule-predicate", `wrong: ${bad.join(", ")}`);
  } catch (err) {
    fail("d2-rule-predicate", err.message);
  }

  // 9. D.3 — Catastrophic Entry VFX renderer ---------------------------------
  if (globalThis.__bbttcc_siege_vfx_loaded_v1) pass("d3-loaded", "siege-vfx.js executed");
  else fail("d3-loaded", "globalThis.__bbttcc_siege_vfx_loaded_v1 missing");
  if (typeof siege?.previewVfx === "function") pass("d3-api-previewVfx");
  else fail("d3-api-previewVfx", "game.bbttcc.api.siege.previewVfx not a function");
  try {
    // Fire each kind — should inject styles + mount a banner, never throw.
    siege?.previewVfx?.("layerBreached", { layerName: "Selftest Wall" });
    siege?.previewVfx?.("convene", { layerIdx: 0 });
    siege?.previewVfx?.("outcome", { status: "won_storm" });
    await new Promise(r => setTimeout(r, 60));
    const styled = !!document.getElementById("ft-siege-vfx-styles");
    const banner = !!document.querySelector(".ft-siege-banner");
    if (styled && banner) pass("d3-render", "styles injected + banner mounted");
    else fail("d3-render", `styles=${styled} banner=${banner}`);
  } catch (err) {
    fail("d3-render", err.message);
  }

  // 10. D.4 — Champion Duel ---------------------------------------------------
  if (globalThis.__bbttcc_siege_champion_duel_loaded_v1) pass("d4-loaded", "siege-champion-duel.js executed");
  else fail("d4-loaded", "globalThis.__bbttcc_siege_champion_duel_loaded_v1 missing");
  if (typeof siege?.openChampionDuelDialog === "function") pass("d4-api-dialog");
  else fail("d4-api-dialog", "game.bbttcc.api.siege.openChampionDuelDialog not a function");
  const duelEff = game.bbttcc?.api?.raid?.EFFECTS?.siege_champion_duel;
  if (duelEff && duelEff.kind === "maneuver") pass("d4-catalog", `tier ${duelEff.tier} · ${JSON.stringify(duelEff.cost)}`);
  else fail("d4-catalog", "siege_champion_duel not registered as a maneuver in EFFECTS");
  try {
    siege?.previewVfx?.("championDuel", { winnerId: "x", loserId: "y", fate: "wounded" });
    await new Promise(r => setTimeout(r, 40));
    pass("d4-duel-vfx", "championDuel preview fired without throwing");
  } catch (err) {
    fail("d4-duel-vfx", err.message);
  }

  // ---- Report ----
  console.table(results.map(r => ({ name: r.name, ok: r.ok ? "PASS" : "FAIL", detail: r.detail })));
  const total = results.length;
  const passed = results.filter(r => r.ok).length;
  const failed = total - passed;
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

/* ============================================================================
 * Bad Eden — World Darkness System: Stress Test  (GM macro)
 * ----------------------------------------------------------------------------
 * Exercises the per-turn Darkness engine in advance-turn.tracks.js end-to-end
 * by driving the REAL pipeline: game.bbttcc.api.turn.advanceTurn({apply:true}).
 *
 * Verifies:
 *   1. Own >=1 Radiated hex  -> Darkness +1/turn
 *   2. Climb accumulates
 *   3. Darkness caps at 10
 *   4. Own 0 Radiated hexes   -> Darkness -1/turn
 *   5. Darkness floors at 0, then Morale recovers +1/turn toward 50
 *   6. Purified hex bleeds faction Radiation Points (-1 per owned Purified/turn)
 *   7. Threshold pings fire (4-6 / 7-9 / 10) — emitted to chat (manual eye-check)
 *
 * SAFE: creates its own scene-Drawing "hexes" + uses ONE existing faction actor,
 * snapshots that faction's darkness/morale/RP, and RESTORES them + deletes the
 * temp drawings in a finally{} block.
 *
 * RUN THIS IN THE `world-turn-sim-test` SANDBOX. advanceTurn({apply:true}) runs
 * the full turn pipeline across ALL factions/hexes — do not run on live Ember
 * unless you accept a real world turn firing. Set FORCE=true to override guard.
 * ==========================================================================*/
(async () => {
  const CONFIG = {
    SANDBOX_WORLD_ID: "world-turn-sim-test",
    FORCE: false,            // set true to run outside the sandbox world
    FACTION_NAME: null,      // null = first isFaction actor; or set an exact name
  };
  const MODF = "bbttcc-factions";
  const MODT = "bbttcc-territory";

  const results = [];
  const assert = (name, ok, detail) => { results.push({ name, ok: !!ok, detail });
    console.log(`%c[DARK-TEST] ${ok ? "PASS" : "FAIL"} — ${name}${detail ? " :: " + detail : ""}`,
      `color:${ok ? "#2e7d32" : "#c62828"};font-weight:bold`); };

  // ---- guards ---------------------------------------------------------------
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  if (game.world.id !== CONFIG.SANDBOX_WORLD_ID && !CONFIG.FORCE)
    return ui.notifications.error(`Refusing to run: world is '${game.world.id}', not the sandbox '${CONFIG.SANDBOX_WORLD_ID}'. Set CONFIG.FORCE=true to override.`);

  const turn = game.bbttcc?.api?.turn;
  if (typeof turn?.advanceTurn !== "function")
    return ui.notifications.error("game.bbttcc.api.turn.advanceTurn not found.");
  const rad = game.bbttcc?.api?.radiation;

  // ---- pick a faction -------------------------------------------------------
  const factions = (game.actors?.contents ?? []).filter(a => a.getFlag?.(MODF, "isFaction"));
  const fac = CONFIG.FACTION_NAME ? factions.find(a => a.name === CONFIG.FACTION_NAME) : factions[0];
  if (!fac) return ui.notifications.error("No faction actor (flags.bbttcc-factions.isFaction) found in this world.");

  const scene = game.scenes.active ?? game.scenes.contents[0];
  if (!scene) return ui.notifications.error("No scene available to place test hexes.");

  // ---- helpers --------------------------------------------------------------
  const getDark = () => Number((fac.getFlag(MODF, "darkness") || {}).global ?? 0);
  const getMor  = () => Number(fac.getFlag(MODF, "morale") ?? 50);
  const setDark = (g) => fac.update({ [`flags.${MODF}.darkness`]: { ...(fac.getFlag(MODF,"darkness")||{}), global: g } });
  const setMor  = (m) => fac.update({ [`flags.${MODF}.morale`]: m });
  const adv     = () => turn.advanceTurn({ apply: true });

  const mkHex = async (conds) => {
    const [d] = await scene.createEmbeddedDocuments("Drawing", [{
      x: 100, y: 100, shape: { type: "r", width: 120, height: 120 },
      strokeColor: "#ff3030", strokeWidth: 2, fillType: 0,
      flags: { [MODT]: { factionId: fac.id, conditions: conds.slice(), mods: { radiation: 0 } } }
    }]);
    return d;
  };
  const setConds = (d, conds) => d.update({ [`flags.${MODT}.conditions`]: conds.slice() });

  // ---- snapshot for restore -------------------------------------------------
  const snap = {
    darkness:   foundry.utils.duplicate(fac.getFlag(MODF, "darkness") || {}),
    morale:     getMor(),
    moraleHome: fac.getFlag(MODF, "moraleHome") ?? null,
    rp:         rad?.get ? rad.get(fac) : null,
  };
  const tempDrawingIds = [];

  try {
    ui.notifications.info(`Darkness stress test on faction "${fac.name}" (scene "${scene.name}")…`);

    // baseline — pin moraleHome=50 so Darkness's −1/turn is exact (no extra Trend drift)
    await setDark(0); await setMor(50);
    await fac.update({ [`flags.${MODF}.moraleHome`]: 50 });

    // R1+R2: arm a Radiated hex, climb
    const radHex = await mkHex(["Radiated"]);  tempDrawingIds.push(radHex.id);

    await adv();
    assert("R1: +1/turn while owning a Radiated hex", getDark() === 1, `darkness=${getDark()} (exp 1)`);
    assert("R4-morale: −1/turn while Darkness≥1", getMor() === 49, `morale=${getMor()} (exp 49)`);

    for (let i = 0; i < 5; i++) await adv();              // 5 more -> 6
    assert("R2: climb to 6 over 6 turns", getDark() === 6, `darkness=${getDark()} (exp 6)`);
    // Post-fix expectation: Trend buoyancy is suppressed UPWARD while Darkness≥1, so
    // doDarknessMorale's −1/turn now actually accumulates. From 50 over 6 dark turns → 44.
    // (Pre-fix this parked at 49 because homeostasis cancelled the penalty — the bug.)
    assert("R2-morale: Darkness drains morale −1/turn (no homeostasis indemnity)",
      getMor() === 44, `morale=${getMor()} (exp 44 — REQUIRES the turn-extensions buoyancy-gate fix deployed)`);

    for (let i = 0; i < 5; i++) await adv();              // 5 more attempts past 10
    assert("R3: caps at 10 (not 11)", getDark() === 10, `darkness=${getDark()} (exp 10)`);

    // R4: disarm -> decline
    await setConds(radHex, []);                            // no longer Radiated
    for (let i = 0; i < 3; i++) await adv();               // 10 -> 7
    assert("R4: −1/turn with 0 Radiated hexes", getDark() === 7, `darkness=${getDark()} (exp 7)`);

    // R5: floor at 0
    for (let i = 0; i < 9; i++) await adv();               // 7 -> 0, then stays
    assert("R5: floors at 0", getDark() === 0, `darkness=${getDark()} (exp 0)`);
    const morAtFloor = getMor();
    await adv();
    assert("R5-morale: buoyancy returns & morale recovers once Darkness=0",
      getMor() > morAtFloor && getMor() <= 50, `morale ${morAtFloor} -> ${getMor()} (exp increase toward 50)`);

    // R6: Purified hex bleeds faction RP
    //  NOTE: place the Purified hex FAR from the Radiated hex — doCleanupAura cleanses
    //  the 6 nearest drawings by center-distance, so a co-located Purified hex would
    //  strip the Radiated condition before Darkness is evaluated (this bit the v1 test).
    let purHex = null;
    if (rad?.get && rad?.set) {
      const [p] = await scene.createEmbeddedDocuments("Drawing", [{
        x: 4000, y: 4000, shape: { type: "r", width: 120, height: 120 }, strokeColor: "#30ff30",
        strokeWidth: 2, fillType: 0,
        flags: { [MODT]: { factionId: fac.id, conditions: ["Purified"], mods: { radiation: 0 } } }
      }]);
      purHex = p; tempDrawingIds.push(p.id);
      await rad.set(fac.id, 20);
      const rpBefore = rad.get(fac);
      await adv();
      const rpAfter = rad.get(fac);
      assert("R6: Purified hex bleeds faction RP (−1/owned Purified)",
        rpAfter === rpBefore - 1, `RP ${rpBefore} -> ${rpAfter} (exp ${rpBefore - 1})`);
    } else {
      assert("R6: Purified RP bleed (SKIPPED — radiation API absent)", true, "radiation module not active");
    }

    // R7: thresholds — remove the Purified scrubber first, then re-arm and climb
    if (purHex) {
      await scene.deleteEmbeddedDocuments("Drawing", [purHex.id]).catch(()=>{});
      const i = tempDrawingIds.indexOf(purHex.id); if (i >= 0) tempDrawingIds.splice(i, 1);
    }
    await setDark(0);
    await setConds(radHex, ["Radiated"]);
    for (let i = 0; i < 10; i++) await adv();
    assert("R7: thresholds reachable (check chat for 4-6 / 7-9 / 10 pings)", getDark() === 10,
      `darkness=${getDark()} — verify 'Bad Eden Darkness' chat pings fired`);

  } catch (e) {
    console.error("[DARK-TEST] threw:", e);
    assert("Suite completed without throwing", false, String(e?.message || e));
  } finally {
    // teardown
    if (tempDrawingIds.length) await scene.deleteEmbeddedDocuments("Drawing", tempDrawingIds).catch(()=>{});
    await fac.update({ [`flags.${MODF}.darkness`]: snap.darkness, [`flags.${MODF}.morale`]: snap.morale });
    if (snap.moraleHome == null) await fac.unsetFlag(MODF, "moraleHome").catch(()=>{});
    else await fac.setFlag(MODF, "moraleHome", snap.moraleHome).catch(()=>{});
    if (rad?.set && snap.rp != null) await rad.set(fac.id, snap.rp).catch(()=>{});
  }

  // ---- report ---------------------------------------------------------------
  const pass = results.filter(r => r.ok).length, total = results.length;
  const rows = results.map(r => `<tr><td>${r.ok ? "✅" : "❌"}</td><td>${r.name}</td><td><small>${r.detail||""}</small></td></tr>`).join("");
  const html = `<h3>Darkness Stress Test — ${pass}/${total} passed</h3>`
    + `<p><small>faction: <b>${fac.name}</b> · scene: <b>${scene.name}</b> · state restored.</small></p>`
    + `<table style="font-size:11px">${rows}</table>`;
  await ChatMessage.create({ content: html, whisper: ChatMessage.getWhisperRecipients("GM").map(u=>u.id), speaker:{alias:"Darkness Stress Test"} });
  console.table(results.map(r => ({ test: r.name, pass: r.ok, detail: r.detail })));
  ui.notifications[pass === total ? "info" : "warn"](`Darkness stress test: ${pass}/${total} passed (see chat/console).`);
})();

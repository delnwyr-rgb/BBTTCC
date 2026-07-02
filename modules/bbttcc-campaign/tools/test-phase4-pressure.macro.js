/* ============================================================================
 * Bad Eden — TEST: Story Director Phase 4 (pressure + seams + foreshadow)
 * ----------------------------------------------------------------------------
 * Self-contained + self-cleaning GM macro:
 *
 *   P1  addPressure accrues; state() reports it
 *   P2  seam events accrue through the REAL hooks (bbttcc:afterTravel +8,
 *       bbttcc:raid:roundCommit +10, bbttcc:beat:resolved +3 via a non-story
 *       throwaway beat) — fired below threshold, so the director stays quiet
 *   P3  below threshold -> no story beat offered at a seam (budget untouched)
 *   P4  pressure pushed over threshold -> the next seam look FIRES the
 *       throwaway story beat (silent tick via forced look path) and pressure
 *       resets to 0
 *   P5  story-beat resolution does NOT accrue pressure (feedback guard)
 *   P6  foreshadow: a vignette tagged foreshadow.<chain> outscores its twin
 *       once the chain is in motion (checked via two identical injector beats)
 *
 * Uses a THROWAWAY campaign (temporarily set active) + snapshots/restores
 * directorState + activeCampaignId + threshold. Expect ~4 inert "Close" dialogs.
 * ==========================================================================*/
(async () => {
  const NS = "bbttcc-campaign";
  const TEST_CAMPAIGN = "p4_pressure_test_campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign;
  if (!api?.director?.addPressure) return ui.notifications.error("Phase 4 director API not found — deploy + F5 first.");

  const startedAt = Date.now();
  const results = [];
  const check = (name, pass, detail) => { results.push({ test: name, result: pass ? "PASS ✓" : "FAIL ✗", detail: String(detail ?? "") }); return pass; };

  // Snapshots
  const snapState = foundry.utils.deepClone(game.settings.get(NS, "directorState") || {});
  const snapActiveId = game.settings.get(NS, "activeCampaignId");
  const snapThreshold = game.settings.get(NS, "director.pressureThreshold");
  let raw = game.settings.get(NS, "campaigns");
  const wasString = typeof raw === "string";
  let data = wasString ? JSON.parse(raw) : raw;
  if (!data || typeof data !== "object" || Array.isArray(data))
    return ui.notifications.error("campaigns setting missing/wrong shape — aborting (nothing written).");
  const writeCampaigns = () => game.settings.set(NS, "campaigns", wasString ? JSON.stringify(data) : data);

  const mkBeat = (id, label, extra = {}) => ({
    id, label, type: "dialog", timeScale: "scene",
    tags: extra.tags ?? "p4test", politicalTags: "",
    description: "(P4 pressure test beat — inert. Just close it.)",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: !!extra.repeatable, oncePerHex: false, promptGM: "inherit",
              fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit" },
    actors: [],
    choices: [{ label: "Close", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    refs: {}, playerFacingDialog: false, dialogPlayerFacing: false, playerFacingContent: false, showToPlayers: false,
    ...(extra.storyChain ? { storyChain: extra.storyChain } : {})
  });

  data[TEST_CAMPAIGN] = {
    id: TEST_CAMPAIGN, label: "[TEST] P4 pressure (safe to delete)",
    factionId: null, factionIds: [],
    beats: [
      mkBeat("p4_plain_beat", "[TEST] plain (non-story) beat", { repeatable: true }),
      mkBeat("p4_story_beat", "[TEST] story beat", { storyChain: "p4_test_chain" }),
      // Foreshadow pair: identical injector beats, one tagged for the test chain.
      mkBeat("p4_vignette_plain", "[TEST] vignette plain", { tags: "inject.travel_threshold p4vig" }),
      mkBeat("p4_vignette_foreshadow", "[TEST] vignette foreshadow", { tags: "inject.travel_threshold p4vig foreshadow.p4_test_chain" })
    ]
  };
  await writeCampaigns();
  await api.setActiveCampaignId(TEST_CAMPAIGN);
  await game.settings.set(NS, "directorState", {});
  await game.settings.set(NS, "director.pressureThreshold", 60);

  const pressure = () => Number(api.director.state().pressure || 0);
  const settle = (ms = 400) => new Promise(r => setTimeout(r, ms));

  try {
    // P1 — direct accrual
    await api.director.addPressure(5, "test");
    check("P1 addPressure", pressure() === 5, `pressure=${pressure()}`);

    // P2 — real seam hooks accrue (all below threshold: 5+8+10+3 = 26)
    Hooks.callAll("bbttcc:afterTravel", { success: true });
    await settle();
    const afterLeg = pressure();
    Hooks.callAll("bbttcc:raid:roundCommit", { round: 1, outcome: "test" });
    await settle();
    const afterRaid = pressure();
    await api.runBeat(TEST_CAMPAIGN, "p4_plain_beat");   // resolves -> beat seam +3
    await settle();
    const afterBeat = pressure();
    check("P2 seam accrual", afterLeg === 13 && afterRaid === 23 && afterBeat === 26,
      `leg=${afterLeg} (want 13) raid=${afterRaid} (want 23) beat=${afterBeat} (want 26)`);

    // P3 — below threshold: no story beat fired (story beat still unfired)
    const stBelow = api.director.state();
    check("P3 quiet below threshold", !stBelow.firedStoryBeats["p4_story_beat"], `pressure=${stBelow.pressure}`);

    // P4 — push over threshold and tick (silent — a real seam would pop the GM
    // veto prompt, which a macro can't click; P2 already proved seam->accrual
    // through the real hooks, and the threshold check is the same code path).
    await api.director.addPressure(100, "test");
    const r4 = await api.director.tick({ silent: true, force: true });
    await settle(400);
    const st4 = api.director.state();
    check("P4 fire resets pressure", r4?.fired === "p4_story_beat" && st4.pressure === 0,
      `fired=${r4?.fired ?? r4?.reason} pressure=${st4.pressure}`);

    // P5 — the story beat's own resolution must NOT have re-accrued beat pressure.
    // (It resolved during P4; pressure must still be exactly 0 plus any P4 seam-leg noise.)
    // Isolate: zero it, resolve the story beat again directly, confirm no +3.
    await game.settings.set(NS, "directorState", Object.assign(api.director.state(), { pressure: 0 }));
    await api.runBeat(TEST_CAMPAIGN, "p4_story_beat");
    await settle();
    check("P5 story-beat feedback guard", pressure() === 0, `pressure=${pressure()} (want 0)`);

    // P6 — foreshadow scoring: chain p4_test_chain is now IN MOTION (fired in P4).
    // Both vignettes match tag p4vig; the foreshadow one should win the injector pick.
    const r6 = await api.injector.fire({ campaignId: TEST_CAMPAIGN, tags: "p4vig", autoDebt: false, promptDebt: false });
    const fired6 = (r6?.fired || []).map(f => f.beatId);
    check("P6 foreshadow outscores", fired6.includes("p4_vignette_foreshadow"), `fired=${fired6.join(",") || r6?.reason}`);
  } finally {
    try { await api.setActiveCampaignId(snapActiveId || ""); } catch (e) { console.error("[p4-test] active restore failed:", e); }
    try { delete data[TEST_CAMPAIGN]; await writeCampaigns(); } catch (e) { console.error("[p4-test] campaign cleanup failed:", e); }
    try { await game.settings.set(NS, "directorState", snapState); } catch (e) { console.error("[p4-test] state restore failed:", e); }
    try { await game.settings.set(NS, "director.pressureThreshold", snapThreshold ?? 60); } catch (e) { console.error("[p4-test] threshold restore failed:", e); }
    try {
      const junk = game.messages.contents.filter(m => m.timestamp >= startedAt && m.speaker?.alias === "Story Director");
      for (const m of junk) await m.delete();
    } catch (e) { console.error("[p4-test] chat cleanup failed:", e); }
  }

  const allPass = results.length >= 6 && results.every(r => r.result.startsWith("PASS"));
  console.group("%c[Phase-4 pressure test]", "font-weight:bold");
  console.table(results);
  console.groupEnd();
  const rows = results.map(r => `<tr><td>${r.test}</td><td>${r.result}</td><td>${r.detail}</td></tr>`).join("");
  ChatMessage.create({
    whisper: [game.user.id],
    content: `<b>Phase-4 pressure test — ${allPass ? "ALL PASS ✓" : "FAILURES ✗"}</b>` +
      `<table><tr><th>Test</th><th></th><th>Detail</th></tr>${rows}</table>` +
      `<p>Throwaway campaign, director state, and threshold all restored.</p>`
  });
  ui.notifications[allPass ? "info" : "error"]("Phase-4 pressure test: " + (allPass ? "all tests passed." : "FAILURES — see chat/console."));
})();

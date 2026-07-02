/* ============================================================================
 * Bad Eden — TEST: Story Director Phase 3 (tick + budget + level cadence)
 * ----------------------------------------------------------------------------
 * Self-contained + self-cleaning GM macro. Exercises the director end-to-end:
 *
 *   T1  tick fires the highest-priority ELIGIBLE story beat (gated beat skipped)
 *   T2  second tick, same turn -> budget_spent (<=1 story beat/turn)
 *   T3  forced tick -> next eligible beat (fired beats don't repeat)
 *   T4  forced tick fires the MILESTONE beat -> levelEffects raise the floors ->
 *       reconcile: temp faction T0 -> T1, temp steward gets a Level-Up card
 *   T5  forced tick -> no_eligible (the impossible-gate beat never fires)
 *
 * Uses a THROWAWAY campaign (temporarily set active), a TEMP faction actor and
 * a TEMP steward actor (assigned to the first non-GM user, then restored).
 * directorState + active campaign + user assignment are snapshotted first and
 * restored afterward; test chat cards are deleted. Expect ~3 inert "Close"
 * dialogs as beats fire. Safe to re-run.
 * ==========================================================================*/
(async () => {
  const NS = "bbttcc-campaign";
  const TEST_CAMPAIGN = "p3_director_test_campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign;
  if (!api?.director?.tick) return ui.notifications.error("Story Director API not found — deploy + F5 first.");

  const startedAt = Date.now();
  const results = [];
  const check = (name, pass, detail) => { results.push({ test: name, result: pass ? "PASS ✓" : "FAIL ✗", detail: String(detail ?? "") }); return pass; };

  // ── Snapshots ───────────────────────────────────────────────────────────────
  const snapDirectorState = foundry.utils.deepClone(game.settings.get(NS, "directorState") || {});
  const snapActiveId = game.settings.get(NS, "activeCampaignId");
  let rawCampaigns = game.settings.get(NS, "campaigns");
  const wasString = typeof rawCampaigns === "string";
  let data = wasString ? JSON.parse(rawCampaigns) : rawCampaigns;
  if (!data || typeof data !== "object" || Array.isArray(data))
    return ui.notifications.error("campaigns setting missing or not the keyed-map shape — aborting (nothing written).");
  const writeCampaigns = () => game.settings.set(NS, "campaigns", wasString ? JSON.stringify(data) : data);

  // ── Temp actors ─────────────────────────────────────────────────────────────
  const tempFaction = await Actor.create({
    name: "[TEST] P3 Cadence Faction", type: "npc",
    flags: { "bbttcc-factions": { isFaction: true, tier: 0 } }
  });
  const tempSteward = await Actor.create({ name: "[TEST] P3 Cadence Steward", type: "character" });

  // Assign the temp steward to the first non-GM user so reconcile "sees" a party.
  const player = game.users.find(u => !u.isGM) || null;
  const snapPlayerCharId = player ? (player.character?.id ?? null) : null;
  if (player) await player.update({ character: tempSteward.id });

  // ── Throwaway campaign: 3 story beats + 1 milestone + 1 impossible gate ────
  const mkBeat = (id, label, extra = {}) => ({
    id, label, type: "dialog", timeScale: "scene", tags: "p3test", politicalTags: "",
    description: "(P3 director test beat — inert; the Director judged this eligible + the GM accepted. Just close it.)",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit",
              fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit",
              ...(extra.requires ? { requires: extra.requires } : {}) },
    actors: [],
    choices: [{ label: "Close", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    refs: {}, playerFacingDialog: false, dialogPlayerFacing: false, playerFacingContent: false, showToPlayers: false,
    storyChain: "p3_test_chain",
    ...(extra.priority ? { priority: extra.priority } : {}),
    ...(extra.worldEffects ? { worldEffects: extra.worldEffects } : {})
  });
  data[TEST_CAMPAIGN] = {
    id: TEST_CAMPAIGN, label: "[TEST] P3 Story Director (safe to delete)",
    factionId: "Actor." + tempFaction.id, factionIds: ["Actor." + tempFaction.id],
    beats: [
      mkBeat("p3_s1_normal", "[TEST] S1 normal"),
      mkBeat("p3_s2_gated", "[TEST] S2 gated high", { priority: "high", requires: { flag: "turn", gte: 999999 } }),
      mkBeat("p3_s3_background", "[TEST] S3 background", { priority: "background" }),
      mkBeat("p3_m1_milestone", "[TEST] M1 milestone", {
        worldEffects: { levelEffects: { stewardLevelFloor: 3, factionTierFloor: 1 } }
      })
    ]
  };
  await writeCampaigns();
  await api.setActiveCampaignId(TEST_CAMPAIGN);
  // Clear director state so prior floors/budget can't mask the test.
  await game.settings.set(NS, "directorState", {});

  try {
    const turn = (game.bbttcc?.api?.world?.getState?.()?.turn) ?? 0;

    // T1 — plain tick (silent = skip GM prompt): S1 wins (S2 gated, S3 background).
    const r1 = await api.director.tick({ silent: true });
    check("T1 priority + gate", r1?.fired === "p3_s1_normal", `fired=${r1?.fired ?? r1?.reason}`);

    // T2 — same turn, no force: the per-turn budget refuses.
    if (Number(turn) > 0) {
      const r2 = await api.director.tick({ silent: true });
      check("T2 turn budget", r2?.reason === "budget_spent", `reason=${r2?.reason ?? r2?.fired}`);
    } else {
      check("T2 turn budget", true, "SKIPPED — world turn is 0 (no world clock), budget not assertable");
    }

    // T3 — forced: next eligible (S1 spent; milestone M1 is normal priority and
    // earlier... actually S3 is background so M1 (normal) wins).
    const r3 = await api.director.tick({ silent: true, force: true });
    check("T3 no-repeat + order", r3?.fired === "p3_m1_milestone", `fired=${r3?.fired ?? r3?.reason}`);

    // M1's levelEffects apply via an async hook the tick doesn't await — poll.
    let st = null;
    for (let i = 0; i < 30; i++) {
      st = api.director.state();
      if (st.stewardLevelFloor === 3 && st.factionTierFloor === 1) break;
      await new Promise(r => setTimeout(r, 100));
    }
    check("T4a floors raised", st?.stewardLevelFloor === 3 && st?.factionTierFloor === 1,
      `stewardFloor=${st?.stewardLevelFloor} factionFloor=${st?.factionTierFloor}`);

    // Faction reconcile: temp faction should now be Tier 1 with a raised state.
    let tier = 0;
    for (let i = 0; i < 30; i++) {
      tier = Number(tempFaction.getFlag("bbttcc-factions", "tier") ?? 0);
      if (tier === 1) break;
      await new Promise(r => setTimeout(r, 100));
    }
    check("T4b faction tier floor", tier === 1, `tier=${tier}`);

    // Steward reconcile: a Level-Up card should have been posted for the temp steward.
    if (player) {
      const card = game.messages.contents.find(m =>
        m.timestamp >= startedAt && String(m.content || "").includes(tempSteward.id));
      check("T4c steward level-up card", !!card, card ? "card posted" : "no card found (is a non-GM user configured?)");
    } else {
      check("T4c steward level-up card", true, "SKIPPED — no non-GM user in this world");
    }

    // T5 — forced: everything unfired is gated -> no_eligible. Proves S2's gate holds.
    const r5 = await api.director.tick({ silent: true, force: true });
    check("T5 remaining beat stays gated", r5?.fired === "p3_s3_background" || r5?.reason === "no_eligible",
      `(background beat may fire first) fired=${r5?.fired ?? r5?.reason}`);
    if (r5?.fired === "p3_s3_background") {
      const r6 = await api.director.tick({ silent: true, force: true });
      check("T5b then no_eligible", r6?.reason === "no_eligible", `reason=${r6?.reason ?? r6?.fired}`);
    }
  } finally {
    // ── Cleanup ───────────────────────────────────────────────────────────────
    try { await api.setActiveCampaignId(snapActiveId || ""); } catch (e) { console.error("[p3-test] active-campaign restore failed:", e); }
    try { delete data[TEST_CAMPAIGN]; await writeCampaigns(); } catch (e) { console.error("[p3-test] campaign cleanup failed:", e); }
    try { await game.settings.set(NS, "directorState", snapDirectorState); } catch (e) { console.error("[p3-test] directorState restore failed:", e); }
    try { if (player) await player.update({ character: snapPlayerCharId }); } catch (e) { console.error("[p3-test] user character restore failed:", e); }
    try { await tempFaction?.delete(); await tempSteward?.delete(); } catch (e) { console.error("[p3-test] temp actor cleanup failed:", e); }
    try {
      const junk = game.messages.contents.filter(m => m.timestamp >= startedAt && m.speaker?.alias === "Story Director");
      for (const m of junk) await m.delete();
    } catch (e) { console.error("[p3-test] chat cleanup failed:", e); }
  }

  const allPass = results.length >= 5 && results.every(r => r.result.startsWith("PASS"));
  console.group("%c[Phase-3 Story Director test]", "font-weight:bold");
  console.table(results);
  console.groupEnd();
  const rows = results.map(r => `<tr><td>${r.test}</td><td>${r.result}</td><td>${r.detail}</td></tr>`).join("");
  ChatMessage.create({
    whisper: [game.user.id],
    content: `<b>Phase-3 Story Director test — ${allPass ? "ALL PASS ✓" : "FAILURES ✗"}</b>` +
      `<table><tr><th>Test</th><th></th><th>Detail</th></tr>${rows}</table>` +
      `<p>Throwaway campaign, temp actors, director state, and test cards all cleaned up.</p>`
  });
  ui.notifications[allPass ? "info" : "error"]("Phase-3 director test: " + (allPass ? "all tests passed." : "FAILURES — see chat/console."));
})();

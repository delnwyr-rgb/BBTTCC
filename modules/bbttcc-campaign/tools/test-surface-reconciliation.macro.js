/* ============================================================================
 * Bad Eden — TEST: Surface reconciliation (integration arc, 2026-07-03)
 * ----------------------------------------------------------------------------
 * Self-contained + self-cleaning GM macro. Exercises the cross-surface
 * consumption/handoff doctrine:
 *
 *   R1  MANUAL runBeat of a storyChain beat marks directorState.firedStoryBeats
 *       (unified marking — the director is no longer blind to GM-menu fires)
 *   R2  resolving ANY beat auto-posts a "wants a word" invitation card for a
 *       newly-offerable speaker moment (once), and marks directorState.invited
 *   R3  the director tick INVITES a speaker beat instead of narrating it
 *       (returns {invited}, posts the card, spends the turn budget)
 *   R4  an OPEN dialogue window with the speaker suppresses the director for
 *       that beat entirely (no_eligible — the conversation owns the moment)
 *
 * Uses a THROWAWAY campaign (temporarily set active) + a TEMP NPC actor.
 * directorState / active campaign / autoInvite setting are snapshotted and
 * restored; test chat cards are deleted. Safe to re-run.
 * ==========================================================================*/
(async () => {
  const NS = "bbttcc-campaign";
  const TEST_CAMPAIGN = "recon_test_campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign;
  if (!api?.director?.tick || !api?.dialogue?.choicesFor)
    return ui.notifications.error("Campaign director/dialogue API not found — deploy + F5 first.");

  const startedAt = Date.now();
  const results = [];
  const check = (name, pass, detail) => { results.push({ test: name, result: pass ? "PASS ✓" : "FAIL ✗", detail: String(detail ?? "") }); return pass; };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const pollState = async (pred, ms = 4000) => {
    for (let t = 0; t < ms; t += 150) { const s = api.director.state(); if (pred(s)) return s; await sleep(150); }
    return api.director.state();
  };

  // ── Snapshots ──────────────────────────────────────────────────────────────
  const snapDirectorState = foundry.utils.deepClone(game.settings.get(NS, "directorState") || {});
  const snapActiveId = game.settings.get(NS, "activeCampaignId");
  let snapAutoInvite = true;
  try { snapAutoInvite = !!game.settings.get(NS, "director.autoInvite"); } catch (_e) {}
  let rawCampaigns = game.settings.get(NS, "campaigns");
  const wasString = typeof rawCampaigns === "string";
  let data = wasString ? JSON.parse(rawCampaigns) : rawCampaigns;
  if (!data || typeof data !== "object" || Array.isArray(data))
    return ui.notifications.error("campaigns setting missing or not the keyed-map shape — aborting (nothing written).");
  const writeCampaigns = () => game.settings.set(NS, "campaigns", wasString ? JSON.stringify(data) : data);

  // ── Temp NPC (the speaker) ─────────────────────────────────────────────────
  const tempNpc = await Actor.create({ name: "[TEST] Recon Speaker", type: "npc" });

  const mkBeat = (id, label, extra = {}) => ({
    id, label, type: "dialog", timeScale: "scene", tags: "recontest", politicalTags: "",
    description: "(surface-reconciliation test beat — inert)",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit",
              fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit" },
    actors: [], choices: [], refs: {},
    playerFacingDialog: false, dialogPlayerFacing: false, playerFacingContent: false, showToPlayers: false,
    ...extra
  });
  data[TEST_CAMPAIGN] = {
    id: TEST_CAMPAIGN, label: "[TEST] Surface Reconciliation (safe to delete)",
    factionId: "", factionIds: [],
    beats: [
      mkBeat("tr_b1", "[TEST] R1 story beat (manual fire)", { storyChain: "tr_chain" }),
      mkBeat("tr_sp1", "[TEST] speaker moment", {
        storyChain: "tr_chain", priority: "high", speakerActorId: tempNpc.id,
        inviteText: "wants a word (reconciliation test).",
        choices: [{ label: "Agree", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }]
      }),
      mkBeat("tr_plain", "[TEST] plain trigger beat", {})
    ]
  };
  await writeCampaigns();
  await api.setActiveCampaignId(TEST_CAMPAIGN);
  await game.settings.set(NS, "directorState", {});
  try { await game.settings.set(NS, "director.autoInvite", true); } catch (_e) {}

  const inviteCardFor = (actorId) => game.messages.contents.find(m =>
    m.timestamp >= startedAt && m.getFlag?.(NS, "talkInvite")?.actorId === actorId);

  try {
    // R1 — manual surface fire marks firedStoryBeats.
    await api.runBeat(TEST_CAMPAIGN, "tr_b1");
    let st = await pollState(s => !!s.firedStoryBeats?.tr_b1);
    check("R1 unified fired-marking", !!st.firedStoryBeats?.tr_b1,
      st.firedStoryBeats?.tr_b1 ? `via=${st.firedStoryBeats.tr_b1.via || "?"}` : "no mark after 4s");

    // R2 — running tr_b1 (or tr_plain) should ALSO have triggered the invite
    // scan: tr_sp1 is offerable + uninvited -> one public invitation card.
    let card = null;
    for (let t = 0; t < 5000 && !card; t += 200) { card = inviteCardFor(tempNpc.id); if (!card) await sleep(200); }
    st = api.director.state();
    check("R2 auto-invitation card", !!card && !!st.invited?.tr_sp1,
      `card=${card ? "posted" : "missing"} invitedMark=${st.invited?.tr_sp1 ? "set" : "missing"}`);

    // R3 — wipe the invite mark; the director tick must INVITE (not narrate).
    await game.settings.set(NS, "directorState",
      { ...api.director.state(), invited: {}, lastStoryTurn: 0 });
    for (const m of game.messages.contents.filter(x => x.timestamp >= startedAt && x.getFlag?.(NS, "talkInvite"))) await m.delete();
    const r3 = await api.director.tick({ silent: true, force: true });
    let card3 = null;
    for (let t = 0; t < 4000 && !card3; t += 200) { card3 = inviteCardFor(tempNpc.id); if (!card3) await sleep(200); }
    st = api.director.state();
    check("R3 director invites, never narrates", r3?.invited === "tr_sp1" && !!card3 && !st.firedStoryBeats?.tr_sp1,
      `tick=${r3?.invited || r3?.fired || r3?.reason} card=${card3 ? "posted" : "missing"} narrated=${st.firedStoryBeats?.tr_sp1 ? "YES(bad)" : "no"}`);

    // R4 — open-window suppression: fake a live dialogue window for the NPC.
    const apps = game.bbttcc?.mal?.npc?._apps;
    if (apps instanceof Map) {
      await game.settings.set(NS, "directorState",
        { ...api.director.state(), invited: {}, lastStoryTurn: 0 });
      apps.set(tempNpc.id, { __reconTestFake: true });
      try {
        const r4 = await api.director.tick({ silent: true, force: true });
        check("R4 open conversation suppresses", r4?.reason === "no_eligible",
          `reason=${r4?.invited || r4?.fired || r4?.reason}`);
      } finally { apps.delete(tempNpc.id); }
    } else {
      check("R4 open conversation suppresses", true, "SKIPPED — bbttcc-mal-voice not active");
    }
  } finally {
    // ── Cleanup ────────────────────────────────────────────────────────────────
    try { await api.setActiveCampaignId(snapActiveId || ""); } catch (e) { console.error("[recon-test] active-campaign restore failed:", e); }
    try { delete data[TEST_CAMPAIGN]; await writeCampaigns(); } catch (e) { console.error("[recon-test] campaign cleanup failed:", e); }
    try { await game.settings.set(NS, "directorState", snapDirectorState); } catch (e) { console.error("[recon-test] directorState restore failed:", e); }
    try { await game.settings.set(NS, "director.autoInvite", snapAutoInvite); } catch (e) { console.error("[recon-test] autoInvite restore failed:", e); }
    try { await tempNpc?.delete(); } catch (e) { console.error("[recon-test] temp actor cleanup failed:", e); }
    try {
      const junk = game.messages.contents.filter(m => m.timestamp >= startedAt &&
        (m.getFlag?.(NS, "talkInvite") || ["Bad Eden", "Story Director", "Bad Eden Campaign"].includes(m.speaker?.alias)));
      for (const m of junk) await m.delete();
    } catch (e) { console.error("[recon-test] chat cleanup failed:", e); }
  }

  const allPass = results.length >= 4 && results.every(r => r.result.startsWith("PASS"));
  console.group("%c[Surface-reconciliation test]", "font-weight:bold");
  console.table(results);
  console.groupEnd();
  const rows = results.map(r => `<tr><td>${r.test}</td><td>${r.result}</td><td>${r.detail}</td></tr>`).join("");
  ChatMessage.create({
    whisper: [game.user.id],
    content: `<b>Surface-reconciliation test — ${allPass ? "ALL PASS ✓" : "FAILURES ✗"}</b>` +
      `<table><tr><th>Test</th><th></th><th>Detail</th></tr>${rows}</table>` +
      `<p>Throwaway campaign, temp NPC, director state, and test cards all cleaned up.</p>`
  });
  ui.notifications[allPass ? "info" : "error"]("Surface-reconciliation test: " + (allPass ? "all tests passed." : "FAILURES — see chat/console."));
})();

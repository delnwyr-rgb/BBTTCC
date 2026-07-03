/* ============================================================================
 * Bad Eden — TEST: Dialogue-driven beats engine (mal-voice contract, campaign side)
 * ----------------------------------------------------------------------------
 * Self-contained + self-cleaning GM macro:
 *
 *   D1  choicesFor returns the speaker's offerable choices (choiceKey format),
 *       gated beat excluded
 *   D2  enact runs the real pipeline: choice routes to the next beat,
 *       returns ok + a summary naming the routed beat, hook fires
 *   D3  NPC memories written on BOTH resolved speaker beats (generated text
 *       with the chosen label on the hub; authored memoryText on the outcome)
 *   D4  consumption: the enacted one-shot hub disappears from choicesFor and
 *       a second enact is refused
 *   D5  repeatable beats stay offerable after enacting
 *   D6  the new {questBucket, isNot} gate: moment offered while the quest is
 *       absent, withdrawn once the quest goes active
 *   D7  storyStateFor (spec addendum): active quest listed, referenced-but-
 *       unstarted quest in the suppression list, fired beats reported
 *
 * Throwaway campaign (temporarily active) + temp speaker actor + temp faction.
 * Everything snapshotted and restored. Expect ~3 inert "Close" dialogs.
 * ==========================================================================*/
(async () => {
  const NS = "bbttcc-campaign";
  const TEST_CAMPAIGN = "dlg_test_campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign;
  if (!api?.dialogue?.enact) return ui.notifications.error("Dialogue API not found — deploy + F5 first.");

  const startedAt = Date.now();
  const results = [];
  const check = (name, pass, detail) => { results.push({ test: name, result: pass ? "PASS ✓" : "FAIL ✗", detail: String(detail ?? "") }); return pass; };
  const settle = (ms = 400) => new Promise(r => setTimeout(r, ms));

  // Snapshots
  const snapState = foundry.utils.deepClone(game.settings.get(NS, "directorState") || {});
  const snapActiveId = game.settings.get(NS, "activeCampaignId");
  let raw = game.settings.get(NS, "campaigns");
  const wasString = typeof raw === "string";
  let data = wasString ? JSON.parse(raw) : raw;
  if (!data || typeof data !== "object" || Array.isArray(data))
    return ui.notifications.error("campaigns setting missing/wrong shape — aborting (nothing written).");
  const writeCampaigns = () => game.settings.set(NS, "campaigns", wasString ? JSON.stringify(data) : data);

  // Temp actors: the speaker NPC + a faction for the coalition quest track
  const speaker = await Actor.create({ name: "[TEST] Dlg Speaker", type: "npc" });
  const faction = await Actor.create({ name: "[TEST] Dlg Faction", type: "npc", flags: { "bbttcc-factions": { isFaction: true, tier: 0 } } });

  const mkBeat = (id, label, extra = {}) => ({
    id, label, type: "dialog", timeScale: "scene", tags: "dlgtest", politicalTags: "",
    description: extra.description ?? "(dialogue-engine test beat — inert; just close any dialog)",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: !!extra.repeatable, oncePerHex: false, promptGM: "inherit",
              fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit",
              ...(extra.requires ? { requires: extra.requires } : {}) },
    actors: [],
    choices: extra.choices ?? [],
    refs: {}, playerFacingDialog: false, dialogPlayerFacing: false, playerFacingContent: false, showToPlayers: false,
    ...(extra.speakerActorId ? { speakerActorId: extra.speakerActorId } : {}),
    ...(extra.memoryText ? { memoryText: extra.memoryText } : {})
  });
  const closeChoice = (label, next) => ({ label, next: next || "", description: "", checkStat: "", checkDC: 0, failNext: "" });

  data[TEST_CAMPAIGN] = {
    id: TEST_CAMPAIGN, label: "[TEST] Dialogue beats (safe to delete)",
    factionId: "Actor." + faction.id, factionIds: ["Actor." + faction.id],
    beats: [
      mkBeat("dlg_hub", "[TEST] hub moment", { speakerActorId: speaker.id,
        choices: [closeChoice("Commit to the test", "dlg_outcome"), closeChoice("Walk away", "")] }),
      mkBeat("dlg_outcome", "[TEST] outcome", { speakerActorId: speaker.id,
        memoryText: "The Stewards committed to the test moment. It went fine. Suspiciously fine." }),
      mkBeat("dlg_gated", "[TEST] gated moment", { speakerActorId: speaker.id,
        requires: { flag: "turn", gte: 999999 }, choices: [closeChoice("Never", "")] }),
      // references a quest that never starts — storyStateFor suppression-list fodder
      Object.assign(mkBeat("dlg_ref_only", "[TEST] references unstarted quest", {}),
        { worldEffects: { questEffects: [{ action: "complete", questId: "dlg_unstarted_quest", state: "completed", text: "" }] } }),
      mkBeat("dlg_repeat", "[TEST] repeatable moment", { speakerActorId: speaker.id, repeatable: true,
        choices: [closeChoice("Again", "")] }),
      mkBeat("dlg_isnot", "[TEST] isNot-gated moment", { speakerActorId: speaker.id,
        requires: { questBucket: "dlg_test_quest", isNot: "active" }, choices: [closeChoice("While it lasts", "")] })
    ]
  };
  await writeCampaigns();
  await api.setActiveCampaignId(TEST_CAMPAIGN);
  await game.settings.set(NS, "directorState", {});

  let hookPayload = null;
  const hookId = Hooks.on("bbttcc:dialogue:choiceEnacted", p => { hookPayload = p; });

  try {
    // D1 — offerable choices: hub(2) + repeat(1) + isnot(1); gated excluded.
    const rows1 = await api.dialogue.choicesFor(speaker.id);
    const keys1 = rows1.map(r => r.choiceKey).sort();
    check("D1 choicesFor + gate", keys1.join("|") === ["dlg_hub:0","dlg_hub:1","dlg_isnot:0","dlg_repeat:0"].join("|"),
      keys1.join(", ") || "(none)");

    // D2 — enact the hub's commit choice: routes to dlg_outcome, hook fires.
    const r2 = await api.dialogue.enact({ beatId: "dlg_hub", choiceIndex: 0, speakerActorId: speaker.id, userId: game.user.id, transcript: ["Speaker: will you?", "Steward: we commit."] });
    check("D2 enact routes + summary", r2?.ok === true && /leads on to/.test(r2?.summary || "") && hookPayload?.beatId === "dlg_hub",
      `ok=${r2?.ok} summary="${r2?.summary}" hook=${hookPayload?.beatId}:${hookPayload?.choiceIndex}`);

    // D3 — memories on the speaker actor: hub (generated, includes choice label)
    // + outcome (authored memoryText). Serialized writes — poll.
    let mems = [];
    for (let i = 0; i < 30; i++) {
      mems = foundry.utils.getProperty(speaker, "flags.bbttcc-mal-voice.memories") || [];
      if (mems.length >= 2) break;
      await settle(150);
    }
    const texts = mems.map(m => String(m?.text || ""));
    check("D3 NPC memories", mems.length === 2 &&
      texts.some(t => t.includes("Commit to the test")) &&
      texts.some(t => t.includes("Suspiciously fine")),
      texts.join(" | ") || "(none)");

    // D4 — the one-shot hub is consumed: gone from choicesFor, enact refused.
    const rows4 = await api.dialogue.choicesFor(speaker.id);
    const hasHub = rows4.some(r => r.beatId === "dlg_hub");
    const r4 = await api.dialogue.enact({ beatId: "dlg_hub", choiceIndex: 1, speakerActorId: speaker.id });
    check("D4 one-shot consumed", !hasHub && r4?.ok === false && /no longer available/.test(r4?.error || ""),
      `stillOffered=${hasHub} enact2=${r4?.ok}/${r4?.error}`);

    // D5 — repeatable moment survives enactment.
    const r5 = await api.dialogue.enact({ beatId: "dlg_repeat", choiceIndex: 0, speakerActorId: speaker.id });
    await settle();
    const rows5 = await api.dialogue.choicesFor(speaker.id);
    check("D5 repeatable stays", r5?.ok === true && rows5.some(r => r.beatId === "dlg_repeat"),
      `enact=${r5?.ok} offered=${rows5.some(r => r.beatId === "dlg_repeat")}`);

    // D6 — isNot gate: offered while the quest is absent; withdrawn once active.
    const before = rows5.some(r => r.beatId === "dlg_isnot");
    await faction.update({ "flags.bbttcc-factions.quests": { active: { dlg_test_quest: { progress: { beats: {} } } }, completed: {}, archived: {} } });
    const rows6 = await api.dialogue.choicesFor(speaker.id);
    check("D6 isNot gate", before && !rows6.some(r => r.beatId === "dlg_isnot"),
      `before=${before} after=${rows6.some(r => r.beatId === "dlg_isnot")}`);

    // D7 — storyStateFor: dlg_test_quest active (from D6), dlg_unstarted_quest
    // in the suppression list (referenced by dlg_ref_only, never started),
    // fired beats include the enacted hub + repeat.
    const ss = await api.dialogue.storyStateFor(speaker.id);
    const activeOk = (ss?.quests?.active || []).some(q => q.id === "dlg_test_quest");
    const unstartedOk = (ss?.quests?.unstarted || []).some(q => q.id === "dlg_unstarted_quest");
    // dlg_outcome included: its consumption mark must survive the concurrent
    // pressure write (the lost-update race fixed 2026-07-02 via _mutateDirectorState).
    const firedOk = ["dlg_hub", "dlg_outcome", "dlg_repeat"].every(id => (ss?.firedBeatIds || []).includes(id));
    check("D7 storyStateFor", activeOk && unstartedOk && firedOk,
      `active=${activeOk} unstarted=${unstartedOk} fired=[${(ss?.firedBeatIds || []).join(",")}] turn=${ss?.turn}`);
  } finally {
    try { Hooks.off("bbttcc:dialogue:choiceEnacted", hookId); } catch (_e) {}
    try { await api.setActiveCampaignId(snapActiveId || ""); } catch (e) { console.error("[dlg-test] active restore failed:", e); }
    try { delete data[TEST_CAMPAIGN]; await writeCampaigns(); } catch (e) { console.error("[dlg-test] campaign cleanup failed:", e); }
    try { await game.settings.set(NS, "directorState", snapState); } catch (e) { console.error("[dlg-test] state restore failed:", e); }
    try { await speaker?.delete(); await faction?.delete(); } catch (e) { console.error("[dlg-test] temp actor cleanup failed:", e); }
    try {
      const junk = game.messages.contents.filter(m => m.timestamp >= startedAt && /Dialogue-driven beat enacted|dialogue-engine test/.test(String(m.content || "")));
      for (const m of junk) await m.delete();
    } catch (e) { console.error("[dlg-test] chat cleanup failed:", e); }
  }

  const allPass = results.length >= 7 && results.every(r => r.result.startsWith("PASS"));
  console.group("%c[Dialogue-driven beats test]", "font-weight:bold");
  console.table(results);
  console.groupEnd();
  const rows = results.map(r => `<tr><td>${r.test}</td><td>${r.result}</td><td>${r.detail}</td></tr>`).join("");
  ChatMessage.create({
    whisper: [game.user.id],
    content: `<b>Dialogue-driven beats test — ${allPass ? "ALL PASS ✓" : "FAILURES ✗"}</b>` +
      `<table><tr><th>Test</th><th></th><th>Detail</th></tr>${rows}</table>` +
      `<p>Throwaway campaign, temp actors, and director state all restored.</p>`
  });
  ui.notifications[allPass ? "info" : "error"]("Dialogue beats test: " + (allPass ? "all tests passed." : "FAILURES — see chat/console."));
})();

/* ============================================================================
 * Bad Eden — TEST: Phase 2 quest-aware `inject.requires` gate  (GM macro)
 * ----------------------------------------------------------------------------
 * Fully self-contained + self-cleaning. Verifies the Story Director gate's new
 * quest condition shapes end-to-end through the REAL injector:
 *
 *   Phase A  no quest state           -> neither test beat eligible
 *   Phase B  quest in `active`        -> {questBucket,is:"active"} beat fires
 *   Phase C  probe beat marked done   -> {beatMark,state:"completed"} beat also fires
 *   Phase D  quest moved to completed -> bucket beat drops out; mark beat still
 *                                        fires (mark lookup spans all buckets)
 *
 * How it stays safe:
 *   - Candidates are scoped to a THROWAWAY campaign (p2_gate_test_campaign),
 *     so no real beat can be surfaced or fired by this test.
 *   - Quest state uses a THROWAWAY quest id on the real primary faction's
 *     quests flag; the flag is snapshotted first and restored afterward.
 *   - Test beats are inert GM-only dialogs (no worldEffects/questEffects).
 *
 * Run in the live world as GM. Click "Close" on each test dialog as it pops
 * (expect 4 across the run). A PASS/FAIL table lands in console + a whispered
 * chat summary. Safe to re-run.
 * ==========================================================================*/
(async () => {
  const NS = "bbttcc-campaign", KEY = "campaigns", FNS = "bbttcc-factions";
  const TEST_CAMPAIGN = "p2_gate_test_campaign";
  const TEST_QUEST = "p2_gate_test_quest";
  const BUCKET_BEAT = "p2_test_bucket_gate";
  const MARK_BEAT = "p2_test_mark_gate";
  const PROBE = "p2_probe_beat";

  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const injector = game.bbttcc?.api?.campaign?.injector;
  if (!injector?.fire) return ui.notifications.error("bbttcc-campaign injector API not found.");

  // ── Locate the real active campaign; copy its faction roster ──────────────
  let raw = game.settings.get(NS, KEY);
  const wasString = typeof raw === "string";
  let data = wasString ? JSON.parse(raw) : raw;
  if (!data || typeof data !== "object") return ui.notifications.error("No campaigns setting found.");
  const activeId = game.settings.get(NS, "activeCampaignId");
  const active =
      Array.isArray(data)            ? (data.find(c => c?.id === activeId) || data[0])
    : Array.isArray(data?.campaigns) ? (data.campaigns.find(c => c?.id === activeId) || data.campaigns[0])
    :                                  (data[activeId] || Object.values(data)[0]);
  if (!active) return ui.notifications.error("Could not locate the active campaign.");
  if (Array.isArray(data)) return ui.notifications.error("campaigns setting is an ARRAY container — this test macro only supports the keyed-map shape. Aborting (nothing written).");

  const roster = (Array.isArray(active.factionIds) && active.factionIds.length)
    ? active.factionIds.slice()
    : (active.factionId ? [active.factionId] : []);
  if (!roster.length) return ui.notifications.error("Active campaign has no factionId/factionIds — set participating factions in the Campaign Builder first.");

  const resolveRef = async (ref) => {
    const s = String(ref || "");
    if (s.startsWith("Actor.")) return game.actors.get(s.slice(6)) || (await fromUuid(s));
    return game.actors.get(s) || (await fromUuid("Actor." + s));
  };
  const primary = await resolveRef(roster[0]);
  if (!primary) return ui.notifications.error("Could not resolve the primary faction actor (" + roster[0] + ").");

  // ── Snapshot the primary faction's quests flag for restoration ────────────
  const originalQuests = primary.getFlag(FNS, "quests");
  const hadQuestsFlag = originalQuests !== undefined && originalQuests !== null;
  const snapshot = hadQuestsFlag ? foundry.utils.deepClone(originalQuests) : null;

  // Overwrite the whole flag each phase (setFlag merges, so bucket MOVES need a
  // clean unset-then-set to actually delete the old bucket's entry).
  const writeQuests = async (q) => {
    await primary.unsetFlag(FNS, "quests");
    await primary.setFlag(FNS, "quests", q);
  };

  // ── Build the throwaway campaign with the two gated test beats ────────────
  const mkBeat = (id, label, requires) => ({
    id, label,
    type: "dialog",
    timeScale: "scene",
    tags: "inject.travel_threshold p2gatetest",
    politicalTags: "",
    description: "(Phase-2 gate test beat — inert. Seeing this dialog means the gate judged this beat ELIGIBLE. Just close it.)",
    outcomes: { success: null, failure: null },
    inject: {
      cooldownTurns: 0, repeatable: true, oncePerHex: false,
      promptGM: "inherit", fallbackOnDecline: "inherit",
      allowMulti: "inherit", oncePerHexGlobal: "inherit",
      requires
    },
    actors: [],
    choices: [{ label: "Close", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    refs: {},
    playerFacingDialog: false, dialogPlayerFacing: false,
    playerFacingContent: false, showToPlayers: false
  });

  const testCampaign = {
    id: TEST_CAMPAIGN,
    label: "[TEST] Phase-2 quest gate (safe to delete)",
    factionId: roster[0],
    factionIds: roster.slice(),
    beats: [
      mkBeat(BUCKET_BEAT, "[TEST] questBucket gate", { questBucket: TEST_QUEST, is: "active" }),
      mkBeat(MARK_BEAT, "[TEST] beatMark gate", { beatMark: PROBE, quest: TEST_QUEST, state: "completed" })
    ]
  };

  const writeCampaigns = async () => game.settings.set(NS, KEY, wasString ? JSON.stringify(data) : data);
  data[TEST_CAMPAIGN] = testCampaign;
  await writeCampaigns();

  // ── Test driver ────────────────────────────────────────────────────────────
  const fire = async () => {
    const r = await injector.fire({
      campaignId: TEST_CAMPAIGN, tags: "p2gatetest",
      autoDebt: false, promptDebt: false,
      allowMulti: true, maxFire: 5
    });
    return (r?.fired || []).map(f => f.beatId).sort();
  };
  const results = [];
  const check = (phase, got, expected) => {
    const want = expected.slice().sort();
    const pass = JSON.stringify(got) === JSON.stringify(want);
    results.push({ phase, expected: want.join(", ") || "(none)", got: got.join(", ") || "(none)", pass: pass ? "PASS ✓" : "FAIL ✗" });
    return pass;
  };

  try {
    // A — no quest state at all: both quest gates unmet.
    await writeQuests({ active: {}, completed: {}, archived: {} });
    check("A: no quest state", await fire(), []);

    // B — quest active, no marks: bucket gate met, mark gate not.
    await writeQuests({ active: { [TEST_QUEST]: { progress: { beats: {} } } }, completed: {}, archived: {} });
    check("B: quest active", await fire(), [BUCKET_BEAT]);

    // C — probe beat marked completed: both gates met.
    await writeQuests({ active: { [TEST_QUEST]: { progress: { beats: { [PROBE]: { state: "completed" } } } } }, completed: {}, archived: {} });
    check("C: + beat mark", await fire(), [BUCKET_BEAT, MARK_BEAT]);

    // D — quest moved to completed: bucket gate (wants active) drops; mark gate
    //     still met because mark lookup spans active/completed/archived.
    await writeQuests({ active: {}, completed: { [TEST_QUEST]: { progress: { beats: { [PROBE]: { state: "completed" } } } } }, archived: {} });
    check("D: quest completed", await fire(), [MARK_BEAT]);
  } finally {
    // ── Cleanup: remove the throwaway campaign + restore the quests flag ────
    try {
      delete data[TEST_CAMPAIGN];
      await writeCampaigns();
    } catch (e) { console.error("[p2-gate-test] campaign cleanup failed:", e); }
    try {
      await primary.unsetFlag(FNS, "quests");
      if (hadQuestsFlag) await primary.setFlag(FNS, "quests", snapshot);
    } catch (e) { console.error("[p2-gate-test] quests-flag restore failed:", e); }
  }

  const allPass = results.length === 4 && results.every(r => r.pass.startsWith("PASS"));
  console.group("%c[Phase-2 quest gate test]", "font-weight:bold");
  console.table(results);
  console.log(allPass ? "ALL 4 PHASES PASSED — the quest-aware gate works end-to-end." : "One or more phases FAILED — see table.");
  console.groupEnd();

  const rows = results.map(r => "<tr><td>" + r.phase + "</td><td>" + r.expected + "</td><td>" + r.got + "</td><td>" + r.pass + "</td></tr>").join("");
  ChatMessage.create({
    whisper: [game.user.id],
    content: "<b>Phase-2 quest gate test — " + (allPass ? "ALL PASS ✓" : "FAILURES ✗") + "</b>" +
      "<table><tr><th>Phase</th><th>Expected</th><th>Fired</th><th></th></tr>" + rows + "</table>" +
      "<p>Test campaign + quest state cleaned up; faction quests flag restored.</p>"
  });
  ui.notifications[allPass ? "info" : "error"]("Phase-2 gate test: " + (allPass ? "all 4 phases passed." : "FAILURES — see chat/console."));
})();

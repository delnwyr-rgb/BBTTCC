/* patch-tallow-connection-2026-10-15.macro.js — THE TALLOW CONNECTION becomes a discovery (Dave, 2026-10-15):
 *  "I want the players to have to NOTICE it, not have it spelled out multiple times in multiple different
 *   conversations… they need to have successfully uncovered that fact before they can ask about it with Tamsin,
 *   or make the connection to the letter seal… I want the sleuthing to actually be skills based."
 *
 *  The fact: Allesh-Gilliam burns TALLOW; Pilgrim Wick (and the note under Plumb's door) are WAX.
 *  Before: narration said it outright in four places. Now each of those places offers a SECRET check
 *  (choice `secret: true` — engine 2026-10-15: blind roll, 🤫 GM-only toast, no retry re-offer); the hit and
 *  the miss read alike and return to the same menu; only the hit sets a mark.
 *
 *   SITES (Perception 11 / Insight 12, secret)        hit mark
 *    ag_vacancy_pilgrim_wick_routes  "Breathe in…"    ag_tallow_wick_routes_hit
 *    ag_wick_the_flame               "Look at his hands."  ag_tallow_flame_hit
 *    ag_confessor_pilgrim            "Take the measure of him."  ag_tallow_pilgrim_hit
 *    kt_courier_has_a_face           "Something about him, as he passes."  ag_tallow_courier_hit
 *    ag_plumb_cracks                 "Look at the seal." (only while unnoticed)  ag_tallow_seal_hit
 *   GATED ON ANY HIT: Tamsin "Why only the wax candles?" · Etta "Who buys candle wax in tallow country?" ·
 *    Plumb "Look at the seal" → ag_plumb_seal (the connection, needs a WICK hit) · "Give us the note" →
 *    ag_plumb_note_taken (wax Receipt) vs ag_plumb_note_taken_plain (no wax) ·
 *   Wick's room (41 beeswax candles) and the shrines stay as they are — evidence, not inference.
 *
 *  Idempotent (id / text / label guards); DRY_RUN default true; backs up `campaigns`. Run as GM AFTER
 *  patch-aldous-plumb-argument (it edits ag_plumb_cracks).
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;

  const AG = "quest_Cq1v3hJpXarX5rXJ", KT = "quest_LJAmlim7oUtlMPiC", CD = "quest_ag_confessors_debt";
  const VACANCY = "YVDerfXKLjIciku1", OFFICE = "gYuClWDbCpP4RR79";
  const HITS = ["ag_tallow_wick_routes_hit", "ag_tallow_flame_hit", "ag_tallow_pilgrim_hit", "ag_tallow_courier_hit", "ag_tallow_seal_hit"];
  const WICK_HITS = HITS.slice(0, 4);
  const TALLOW = { anyOf: HITS.map(id => ({ beatMark: id })) };                       // noticed, anywhere
  const NOT_TALLOW = HITS.map(id => ({ beatMark: id, not: true }));                    // not yet noticed (AND-list)
  const MEMORY_HIT = "THE TALLOW CONNECTION (noticed): Allesh-Gilliam burns tallow; the pilgrim — and whatever he carries — is wax.";

  const ch = (label, description, extra = {}) => ({ label, next: "", description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const WE = (extra = {}) => ({ territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [], ...extra });
  const mk = (id, questId, questStep, label, description, { type = "narration", sceneId = null, storyQuest = "allesh_gilliam", phase = { gte: 1 }, choices = [], worldEffects = WE(), memoryText = "", repeatable = true, tags = "allesh-gilliam tallow" } = {}) => ({
    id, label, type, timeScale: "scene", tags, politicalTags: "",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires: [{ flag: "storyPhase", gte: phase.gte }] },
    actors: [], choices, encounter: { key: "", tier: null, actorName: "" }, worldEffects, description, memoryText,
    questId, questStep, questRole: null, targetHexUuid: null, turnNumber: null,
    cinematic: { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null },
    journal: { enabled: false, entryId: null, force: false }, unlocks: { maneuvers: [], strategics: [] },
    timePoints: 0, dialogueOffer: false, sceneId, story: { quest: storyQuest },
    refs: {}, playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true
  });
  const addBeat = (nb) => { if (byId.get(nb.id)) { report.push(`· ok beat (already) ${nb.id}`); return; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; report.push(`✚ beat ${nb.id} — ${nb.label}`); };

  const backWick = [ch("Ask something else", "", { next: "ag_vacancy_pilgrim_wick" }), ch("Leave him to his vigil", "", { next: "allesh_gilliam_vacancy_intro" })];
  const courierExits = [
    ch("You know this man — the pilgrim keeping vigil at the Vacancy", "The guest in the corner. The bed he never slept in.", { next: "khezek_tor_quest_scene", requires: [{ beatMark: "ag_vacancy_pilgrim_wick" }] }),
    ch("You don't know him. Verna might.", "A pilgrim has been keeping a room at the Vacancy for weeks, Verna says. Pays exact. Never sleeps.", { next: "khezek_tor_quest_scene", requires: [{ beatMark: "ag_vacancy_pilgrim_wick", not: true }] })
  ];

  const NEW_BEATS = [
    // 1. the Vacancy — the old routes
    mk("ag_tallow_wick_routes_hit", AG, 382, "Allesh-Gilliam — Something About Him",
      "Candle wax. Faint, clean, a little sweet — on his hands, in the weave of the coat. You have been in Allesh-Gilliam long enough to know what it burns in every lamp and sconce, and it isn't that.\n\nThis is a tallow town. He is a wax man.",
      { sceneId: VACANCY, memoryText: MEMORY_HIT, choices: backWick }),
    mk("ag_tallow_wick_routes_miss", AG, 383, "Allesh-Gilliam — Something About Him",
      "Road, cold, stone, a day's walking, and something underneath it you can't put a name to and stop trying. He smiles like a man describing a garden.",
      { sceneId: VACANCY, memoryText: "The party looked hard at the pilgrim and did not catch what was off about him.", choices: backWick }),
    // 2. the Vacancy — the flame
    mk("ag_tallow_flame_hit", AG, 384, "Allesh-Gilliam — His Hands",
      "Wax. Not the yellow grease this town burns in every lamp — wax, pale and clean, the kind nobody in Allesh-Gilliam can afford to burn by the handful.\n\nWhatever his order feeds the flame, it isn't what this town feeds it.",
      { sceneId: VACANCY, memoryText: MEMORY_HIT, choices: backWick }),
    mk("ag_tallow_flame_miss", AG, 385, "Allesh-Gilliam — His Hands",
      "Working hands. Something under the nails, as there is under everyone's in this town. He folds them away and goes on about the flame.",
      { sceneId: VACANCY, memoryText: "The party looked at the pilgrim's hands and saw hands.", choices: backWick }),
    // 3. the Confessor's Debt — the guest who pays exact
    mk("ag_tallow_pilgrim_hit", CD, 11, "Allesh-Gilliam — The Measure of Him",
      "Boots square. Hands folded. And under the church-stillness, faint and clean: candle wax. Verna's lamps are tallow. The whole street is tallow. He is not.",
      { sceneId: VACANCY, phase: { gte: 2 }, memoryText: MEMORY_HIT, choices: [ch("Back to the pilgrim", "", { next: "ag_confessor_pilgrim" })] }),
    mk("ag_tallow_pilgrim_miss", CD, 12, "Allesh-Gilliam — The Measure of Him",
      "Boots square, hands folded, the stillness of a man who has practised being looked at. Whatever else there is to him, it is not on the surface tonight.",
      { sceneId: VACANCY, phase: { gte: 2 }, memoryText: "The party took the pilgrim's measure and came up with a devout man.", choices: [ch("Back to the pilgrim", "", { next: "ag_confessor_pilgrim" })] }),
    // 4. Khezek Tor — the courier has a face
    mk("ag_tallow_courier_hit", KT, 167, "Khezek Tor — As He Passes",
      "Candle wax, on the wind as he passes — clean and sweet and out of place. This is a tallow mountain, and the towns below it are tallow towns.\n\nSomebody is keeping a road with the wrong kind of light.",
      { storyQuest: "khezek_tor", phase: { gte: 2 }, memoryText: MEMORY_HIT, choices: courierExits, tags: "khezek_tor tallow" }),
    mk("ag_tallow_courier_miss", KT, 168, "Khezek Tor — As He Passes",
      "Dust, cold, the switchbacks on him. He is past you before you have finished looking.",
      { storyQuest: "khezek_tor", phase: { gte: 2 }, memoryText: "The courier passed the party on the toll road; they marked his face and nothing else.", choices: courierExits, tags: "khezek_tor tallow" }),
    // 5. the Plumb office — the seal, for parties who have NOT noticed yet
    mk("ag_tallow_seal_hit", AG, 386, "Allesh-Gilliam — The Seal",
      "Wax. Not tallow — WAX, pressed small and neat, in a town that seals a letter with a thumb and a smear of fat when it seals one at all.\n\nNobody in Allesh-Gilliam burns wax. Nobody in Allesh-Gilliam can afford to.",
      { sceneId: OFFICE, phase: { gte: 2 }, memoryText: "THE TALLOW CONNECTION (noticed, at the seal): the Architect's note is sealed in wax, in a tallow town.", choices: [ch("Back to the note", "", { next: "ag_plumb_cracks" })] }),
    mk("ag_tallow_seal_miss", AG, 387, "Allesh-Gilliam — The Seal",
      "A seal. Neat, small, unsigned. It tells you what the note already told you: somebody careful wrote this.",
      { sceneId: OFFICE, phase: { gte: 2 }, memoryText: "The party looked at the seal on the Architect's note and saw a seal.", choices: [ch("Back to the note", "", { next: "ag_plumb_cracks" })] }),
    // the connection — for parties who ALREADY carry a Wick hit
    mk("ag_plumb_seal", AG, 388, "Allesh-Gilliam — Where the Pilgrim Buys His Candles",
      "Wax. You knew it before you were close enough to be sure — the same clean, out-of-place sweetness you have already met once in this town, on a man who trims candles at dusk and keeps a bed he never sleeps in.\n\nNobody in Allesh-Gilliam seals in wax. One man in Allesh-Gilliam carries it under his nails. Whoever wrote this note buys their candles where the pilgrim does.",
      { sceneId: OFFICE, phase: { gte: 2 }, memoryText: "THE SEAL, CONNECTED: the wax on the Architect's note matches the pilgrim's — whoever wrote it buys candles where Wick does.", choices: [ch("Back to the note", "", { next: "ag_plumb_cracks" })] }),
    mk("ag_plumb_note_taken_plain", AG, 389, "Allesh-Gilliam — The Note, Taken",
      "<p>You fold it back along its own creases and put it away, and the room gets lighter by exactly one piece of paper.</p><p>\"Good.\" He breathes out. \"Good. Yes. Your problem. Please.\" A pause. \"If you find them — could you not mention I drew the granary with a face? It's sensitive about it.\"</p>",
      { type: "outcome_trigger", sceneId: OFFICE, phase: { gte: 2 }, repeatable: false, tags: "allesh-gilliam plumb",
        memoryText: "The party took the threatening note from Aldous Plumb's desk: unsigned, good paper, a careful seal.",
        worldEffects: WE({ receipts: [{ label: "The Architect's Note", effectKey: "stirThePot", acquisition: "earned",
          source: { name: "under Aldous Plumb's door, the morning after That One Night", ...(game.actors?.getName?.("Aldous Plumb")?.id ? { npcActorId: game.actors.getName("Aldous Plumb").id } : {}) },
          truth: "\"Any attempt to investigate damage to the wall will be met with consequences.\" Unsigned. Good paper, a neat hand, a careful seal. Whoever wrote it wanted it to look official and did not want to be known." }] }),
        choices: [ch("Now — about the wall", "", { next: "ag_plumb_cracks" })] })
  ];
  for (const nb of NEW_BEATS) addBeat(nb);

  /* ── the four narrations stop saying it; each gains its secret check ───── */
  const strip = (id, from, to = "") => {
    const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: NOT FOUND`);
    const cur = String(b.description || "");
    if (!cur.includes(from)) return report.push(cur.includes(to) && to ? `· ok ${id}: already quiet` : `· ok ${id}: tell not present`);
    b.description = cur.replace(from, to); changes++; report.push(`✚ ${id}: the tell is gone from the narration`);
  };
  const addCheck = (id, choice, at = 0) => {
    const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: NOT FOUND`);
    b.choices = Array.isArray(b.choices) ? b.choices : [];
    if (b.choices.some(c => String(c?.next || "") === choice.next)) return report.push(`· ok ${id}: secret check present`);
    b.choices.splice(Math.min(at, b.choices.length), 0, choice); changes++; report.push(`✚ ${id}: + secret ${choice.checkStat} ${choice.checkDC} "${choice.label}"`);
  };
  strip("ag_vacancy_pilgrim_wick_routes", " He smells, faintly, of candle wax.\n\nThis is a tallow town.");
  addCheck("ag_vacancy_pilgrim_wick_routes", ch("Breathe in. Something about him is off.", "", { checkStat: "prc", checkDC: 11, secret: true, next: "ag_tallow_wick_routes_hit", failNext: "ag_tallow_wick_routes_miss" }));
  strip("ag_wick_the_flame", "wax under the nails, none of it tallow.", "something pale under the nails.");
  addCheck("ag_wick_the_flame", ch("Look at his hands.", "", { checkStat: "prc", checkDC: 11, secret: true, next: "ag_tallow_flame_hit", failNext: "ag_tallow_flame_miss" }));
  strip("ag_confessor_pilgrim", " He smells faintly of candle wax in a town that burns tallow.");
  addCheck("ag_confessor_pilgrim", ch("Take the measure of him.", "", { checkStat: "ins", checkDC: 12, secret: true, next: "ag_tallow_pilgrim_hit", failNext: "ag_tallow_pilgrim_miss" }));
  strip("kt_courier_has_a_face", "\n\nHe smells of candle wax. This is a tallow mountain.");
  addCheck("kt_courier_has_a_face", ch("Something about him, as he passes.", "", { checkStat: "prc", checkDC: 11, secret: true, next: "ag_tallow_courier_hit", failNext: "ag_tallow_courier_miss" }));

  /* ── the questions that need the fact first ───────────────────────────── */
  const gate = (id, labelRe, requires) => {
    const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: NOT FOUND`);
    const c = (b.choices || []).find(x => labelRe.test(String(x?.label || "")));
    if (!c) return report.push(`⚠ ${id}: choice ${labelRe} not found`);
    if (JSON.stringify(c.requires || null) === JSON.stringify(requires)) return report.push(`· ok ${id}: "${c.label}" already gated`);
    c.requires = requires; changes++; report.push(`✚ ${id}: "${c.label}" now needs the Tallow Connection`);
  };
  gate("ag_tamsin_on_wick", /why only the wax candles/i, [TALLOW]);
  gate("ag_market_caravan_route", /candle wax in tallow country/i, [TALLOW]);

  /* ── Plumb's note: the seal is a discovery, not a caption ─────────────── */
  {
    const b = byId.get("ag_plumb_cracks");
    if (!b) report.push("⚠ ag_plumb_cracks: NOT FOUND — run patch-aldous-plumb-argument first");
    else {
      const from = "The seal is wax — not tallow, WAX, in a town that burns tallow — and it says, in full:";
      const to = "The seal is small and neat and pressed by somebody who has pressed a seal before, and it says, in full:";
      if (b.description.includes(from)) { b.description = b.description.replace(from, to); changes++; report.push("✚ ag_plumb_cracks: the seal no longer captions itself"); }
      else report.push(b.description.includes(to) ? "· ok ag_plumb_cracks: seal already quiet" : "⚠ ag_plumb_cracks: seal sentence not found");
      const gmFrom = "Taking the note hands over a Receipt that points quietly at the wax seam — do NOT name Wick here.";
      const gmTo = "\"Look at the seal\" is a secret Perception 12 until the party has the Tallow Connection; with a Wick hit it is the connection outright. The Receipt only mentions wax if they have noticed. Do NOT name Wick here.";
      if (b.description.includes(gmFrom)) { b.description = b.description.replace(gmFrom, gmTo); changes++; report.push("✚ ag_plumb_cracks: GM note updated"); }
      b.choices = Array.isArray(b.choices) ? b.choices : [];
      const idx = b.choices.findIndex(c => /give us the note/i.test(String(c?.label || "")) && !c.requires?.some?.(r => r.anyOf));
      if (idx >= 0) {
        const taken = [{ beatMark: "ag_plumb_note_taken", not: true }, { beatMark: "ag_plumb_note_taken_plain", not: true }];
        const rows = [
          ch("Look at the seal.", "You have seen that colour of wax before.", { next: "ag_plumb_seal", requires: [{ anyOf: WICK_HITS.map(id => ({ beatMark: id })) }] }),
          ch("Look at the seal.", "", { checkStat: "prc", checkDC: 12, secret: true, next: "ag_tallow_seal_hit", failNext: "ag_tallow_seal_miss", requires: NOT_TALLOW }),
          ch("Give us the note. Whoever wrote it just became our problem.", "He lets go of it like it was hot.", { next: "ag_plumb_note_taken", requires: [...taken, TALLOW] }),
          ch("Give us the note. Whoever wrote it just became our problem.", "He lets go of it like it was hot.", { next: "ag_plumb_note_taken_plain", requires: [...taken, ...NOT_TALLOW] })
        ];
        b.choices.splice(idx, 1, ...rows); changes++; report.push("✚ ag_plumb_cracks: seal rows + note split (wax Receipt only once noticed)");
      } else report.push("· ok ag_plumb_cracks: seal rows already in place");
    }
  }

  console.log(`[patch-tallow-connection] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Tallow Connection patch DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Tallow Connection patch: nothing to do.");
  try {
    (foundry.utils.saveDataToFile ?? saveDataToFile)(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-tallow-connection-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Tallow Connection patch APPLIED: ${changes} change(s). Nobody says tallow out loud any more.`);
})();

/* patch-lyrenn-turn1-clean.macro.js — TURN 1 IS HANDSHAKES, NOT HOMEWORK
 * (2026-08-29, owner ruling): Lyrenn's first visit should play like Khezek
 * Tor's — walk the town, meet Rowan, meet Elsin, call it a day. The troubles
 * (bugs in the channels, the moving treeline) arrive as WORD after the first
 * strategic turn commits, not as gates squatting in the welcome tour.
 *
 * What this does:
 *  1. REROUTE the arrival: any opening-scene choice that routed into
 *     lyrenn_quest_acceptance now goes straight to the walk hub
 *     (lyrenn_main_scene). No arc quest auto-accepted mid-handshake.
 *  2. REMOVE the quest doors from Turn-1 surfaces (the hub's "Ask about the
 *     torn-up east channels" + Elsin's convo version) — routed choices ignore
 *     gates, so the doors themselves had to go; word delivery replaces them.
 *  3. TURN-GATE ({flag:"turn", gte:2}) the quest acceptances and quest intros:
 *     arc acceptance, Gentle Pest, Forest Will Not Be Fought, the Field,
 *     and the Tifaret approach.
 *  4. NEW WORD BEATS (turn ≥ 2, invited, in-voice): Elsin's word about the
 *     channels and Rowan's word about the treeline — each routes into the
 *     existing acceptance beat. Accepting a thread also activates the Lyrenn
 *     arc quest (questEffect appended to both acceptance beats).
 *
 * DRY_RUN default true; idempotent; backup before write. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const Q = {
    lyrenn: "quest_JqCdOo0l6X8K2EcE",
    forest: "quest_feX6WHsBXuVbtjMM",
    pest: "quest_uMKbX648SllKTpEH"
  };

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const findActor = (cands) => {
    const want = cands.map(norm);
    return game.actors.find(a => want.includes(norm(a.name))) || null;
  };
  const elsin = findActor(["Elsin Quade"]);
  const rowan = findActor(["Rowan of the Loam", "Rowan-of-the-Loam"]);

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = []; let changes = 0;

  report.push(elsin ? `👤 Elsin → "${elsin.name}"` : "⚠ Elsin NOT FOUND (word beat ships speakerless — wire later)");
  report.push(rowan ? `👤 Rowan → "${rowan.name}"` : "⚠ Rowan NOT FOUND (word beat ships speakerless — wire later)");

  // ── 1. arrival reroute ─────────────────────────────────────────────────────
  {
    const b = byId.get("lyrenn_opening_scene");
    if (!b) report.push("✗ MISSING lyrenn_opening_scene");
    else {
      let did = 0;
      for (const c of (b.choices || [])) {
        if (String(c?.next || "") === "lyrenn_quest_acceptance") { c.next = "lyrenn_main_scene"; did++; }
        if (String(c?.failNext || "") === "lyrenn_quest_acceptance") { c.failNext = "lyrenn_main_scene"; did++; }
      }
      if (did) { changes += did; report.push(`⤳ opening scene rerouted → walk hub (${did} route(s))`); }
      else report.push("· ok opening scene: no route into quest acceptance (already clean)");
    }
  }

  // ── 2. remove Turn-1 quest doors ───────────────────────────────────────────
  const DOORS = [
    { beatId: "lyrenn_main_scene", label: "Ask about the torn-up east channels" },
    { beatId: "lyrenn_elsin_quade_convo", label: "What's tearing up the east channels?" }
  ];
  for (const d of DOORS) {
    const b = byId.get(d.beatId);
    if (!b) { report.push(`✗ MISSING ${d.beatId}`); continue; }
    const before = (b.choices || []).length;
    b.choices = (b.choices || []).filter(c => String(c?.label || "").trim() !== d.label);
    if (b.choices.length < before) { changes++; report.push(`✂ door removed: "${d.label}" @ ${d.beatId}`); }
    else report.push(`· ok (absent) "${d.label}" @ ${d.beatId}`);
  }

  // ── 3. turn gates ──────────────────────────────────────────────────────────
  const TURN_GATE = { flag: "turn", gte: 2 };
  const GATE_IDS = [
    "lyrenn_quest_acceptance",
    "lyrenn_the_gentle_pest_acceptance",
    "lyrenn_forest_will_not_be_fought_quest_acceptance",
    "lyrenn_the_field_that_remembers_you",
    "forest_of_tifaret_approach"
  ];
  for (const id of GATE_IDS) {
    const b = byId.get(id);
    if (!b) { report.push(`✗ MISSING ${id}`); continue; }
    b.inject = b.inject || {};
    const arr = Array.isArray(b.inject.requires) ? b.inject.requires : (b.inject.requires ? [b.inject.requires] : []);
    if (arr.some(r => r && r.flag === "turn")) { report.push(`· ok (already) turn gate @ ${id}`); continue; }
    arr.push({ ...TURN_GATE });
    b.inject.requires = arr;
    changes++; report.push(`🔒 turn ≥ 2 gate @ ${id}`);
  }

  // ── 4a. arc quest activates when a thread is accepted ──────────────────────
  for (const id of ["lyrenn_the_gentle_pest_acceptance", "lyrenn_forest_will_not_be_fought_quest_acceptance"]) {
    const b = byId.get(id);
    if (!b) continue;
    b.worldEffects = b.worldEffects || {};
    b.worldEffects.questEffects = Array.isArray(b.worldEffects.questEffects) ? b.worldEffects.questEffects : [];
    if (b.worldEffects.questEffects.some(e => e && e.questId === Q.lyrenn && e.action === "accept")) {
      report.push(`· ok (already) arc-accept @ ${id}`); continue;
    }
    b.worldEffects.questEffects.push({ action: "accept", questId: Q.lyrenn, beatId: "", state: "active", text: "Lyrenn asked, and the Stewards answered. The farm hex's ledger is open." });
    changes++; report.push(`✚ arc-accept questEffect @ ${id}`);
  }

  // ── 4b. the word beats ─────────────────────────────────────────────────────
  const wordBeat = (o) => ({
    id: o.id, label: o.label, type: "dialog", timeScale: "scene", timePoints: 0,
    tags: "lyrenn word", politicalTags: "",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false,
      promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit",
      oncePerHexGlobal: "inherit", requires: [{ flag: "turn", gte: 2 }] },
    actors: [], refs: {},
    choices: o.choices,
    description: o.description,
    questId: Q.lyrenn, questRole: null,
    playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true,
    playerFacingContent: true, showToPlayers: true,
    storyChain: "lyrenn_calls", priority: "high",
    ...(o.speaker ? { speakerActorId: o.speaker.id } : {}),
    ...(o.inviteText ? { inviteText: o.inviteText } : {})
  });

  const NEW_BEATS = [
    wordBeat({
      id: "lyrenn_word_channels", label: "Word from Lyrenn — The East Channels",
      speaker: elsin,
      inviteText: "Word up the road from Lyrenn: something is tearing up the east irrigation channels, and Elsin Quade is asking for the Stewards by name.",
      description: "The turn's business is barely committed when the word arrives from Lyrenn, in Elsin Quade's handwriting, which reads exactly like her handshake: something has been tearing up the east irrigation channels. Not weather. Not tools. Something with appetite and, she suspects, OPINIONS. She is asking for the Stewards by name, and her one condition travels ahead of you like a fence: bring patience. Ideally, never the shovel.",
      choices: [
        { label: "Ride for Lyrenn — see the channels", next: "lyrenn_the_gentle_pest_acceptance", description: "", checkStat: "", checkDC: 0, failNext: "" },
        { label: "It keeps — Lyrenn knows how to wait", next: "", description: "The word stands. Elsin does not send twice; she assumes you heard her the first time.", checkStat: "", checkDC: 0, failNext: "" }
      ]
    }),
    wordBeat({
      id: "lyrenn_word_treeline", label: "Word from Lyrenn — The Treeline Moves",
      speaker: rowan,
      inviteText: "A scrap of bark arrives from Rowan of the Loam, three words pressed into it: 'Trees. Moving. Come.'",
      description: "Rowan of the Loam sends word the way Rowan does everything — sparely, and with the weight of someone who listened first. A scrap of bark, three words pressed into it: 'Trees. Moving. Come.' The treeline outside Lyrenn has started editing the fence line overnight, curving paths back on themselves, standing a stride closer each morning. Local doctrine is already written into the name of the problem, and it is not a suggestion: the forest will not be fought.",
      choices: [
        { label: "Ride for Lyrenn — walk the fence line", next: "lyrenn_forest_will_not_be_fought_quest_acceptance", description: "", checkStat: "", checkDC: 0, failNext: "" },
        { label: "It keeps — trees are patient", next: "", description: "Rowan will be there, palm to the soil, whenever you come. The trees, presumably, also.", checkStat: "", checkDC: 0, failNext: "" }
      ]
    })
  ];
  for (const nb of NEW_BEATS) {
    if (byId.get(nb.id)) { report.push(`· ok (already) beat ${nb.id}`); continue; }
    camp.beats.push(nb); byId.set(nb.id, nb);
    changes++; report.push(`✚ word beat: ${nb.id}${nb.speakerActorId ? "" : " (speakerless — wire when actor exists)"}`);
  }

  // ── report + write ─────────────────────────────────────────────────────────
  console.log(`[patch-lyrenn-turn1-clean] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` +
    report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Lyrenn Turn-1 clean DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Lyrenn Turn-1 clean: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
      `backup-campaigns-before-lyrenn-turn1-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Lyrenn Turn-1 clean APPLIED: ${changes} change(s). Turn 1 is handshakes; the trouble writes letters.`);
})();

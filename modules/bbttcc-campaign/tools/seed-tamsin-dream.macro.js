// Bad Eden — Father Tamsin's Dream: the cut cold open, wired back in (2026-09-13) — DRY_RUN
// ─────────────────────────────────────────────────────────────────────────────
// The 24-second GOTTGAIT cold open (a ringed mountain settlement, ley-veins cracking outward,
// the detonation, the whole works dropping into a lit crater, dark) ended on the line
// "I had that dream again." Dave cut it. Tonight's ruling made it canon: it is the night the
// mine closed its own mouth, seen from above, and the dream-warning the locals were given
// before it did. Father Tamsin had that dream in another life and did nothing with it.
//
// This macro:
//   1. Creates the Scene "Father Tamsin — The Dream" (4K, background = the baked webm), cloned
//      from the St Gilliam's interior POV scene so grid/vision/padding match the other POVs.
//   2. Adds two beats to the active campaign:
//        ag_tamsin_the_dream        cinematic 24.5 s, narration mp3 broadcast to players,
//                                   then cuts to St Gilliam's interior
//        ag_tamsin_the_dream_after  Father Tamsin speaks: "I had that dream again."
//   3. Routes it: a new choice on the Father's Echo beat (allesh_gilliam_father_tamsin_conversation)
//      "The dream. Tell me about the dream." → ag_tamsin_the_dream, inserted before "Leave".
// Idempotent; backs up `campaigns` before writing. GM only. Assets must already be deployed:
//   art/bbttcc/GOTTGAIT/GOTTGAIT Scene files/gottait_cold_open.webm
//   art/bbttcc/GOTTGAIT/GOTTGAIT Scene files/gottait_cold_open_narration.mp3

(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications?.error("GM only");
  const report = [];

  const SCENE_NAME = "Father Tamsin — The Dream";
  const VIDEO = "art/bbttcc/GOTTGAIT/GOTTGAIT%20Scene%20files/gottait_cold_open.webm";
  const NARRATION = "art/bbttcc/GOTTGAIT/GOTTGAIT%20Scene%20files/gottait_cold_open_narration.mp3";
  const TEMPLATE_SCENE = "SNenbFtoUm9jv5uE";      // st_gilliams_interior_pov
  const AFTER_SCENE = "Scene.SNenbFtoUm9jv5uE";   // where the dream cuts back to
  const TAMSIN = "I0Gieq4FAol5mklQ";
  const AG_QUEST = "quest_Cq1v3hJpXarX5rXJ";
  const ECHO_BEAT = "allesh_gilliam_father_tamsin_conversation";
  const DREAM = "ag_tamsin_the_dream";
  const AFTER = "ag_tamsin_the_dream_after";

  // ── 1. the scene ──────────────────────────────────────────────────────────
  let scene = game.scenes.getName(SCENE_NAME) || game.scenes.contents.find(s => s.name === SCENE_NAME);
  if (scene) report.push(`· ok (already) scene "${SCENE_NAME}" (${scene.id})`);
  else {
    const tpl = game.scenes.get(TEMPLATE_SCENE);
    const base = tpl ? tpl.toObject() : { width: 3840, height: 2160, padding: 0, grid: { type: 0, size: 100 } };
    for (const k of ["_id", "drawings", "tokens", "walls", "lights", "sounds", "notes", "tiles", "templates", "regions", "playlist", "playlistSound", "journal", "journalEntryPage", "thumb", "navigation", "active", "folder", "ownership", "flags"]) delete base[k];
    base.name = SCENE_NAME;
    base.background = Object.assign({}, base.background || {}, { src: VIDEO });
    base.foreground = null;
    base.width = 3840; base.height = 2160;
    base.tokenVision = false; base.fog = Object.assign({}, base.fog || {}, { exploration: false });
    base.ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER };   // players may view the POV
    report.push(`✚ CREATE scene "${SCENE_NAME}" (from ${tpl ? tpl.name : "defaults"}) bg=${VIDEO}`);
    if (!DRY_RUN) scene = await Scene.create(base);
  }
  const sceneUuid = scene ? `Scene.${scene.id}` : "Scene.<created on apply>";

  // ── 2. the beats ──────────────────────────────────────────────────────────
  let campaigns = game.settings.get(NS, "campaigns");
  if (typeof campaigns === "string") { try { campaigns = JSON.parse(campaigns); } catch (_e) {} }
  campaigns = foundry.utils.deepClone(campaigns || {});
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = cid && campaigns[cid];
  if (!camp?.beats) return ui.notifications?.error("No active campaign with beats");
  const byId = new Map(camp.beats.map(b => [String(b.id), b]));
  let changed = 0;

  const echo = byId.get(ECHO_BEAT);
  if (!echo) return ui.notifications?.error(`beat ${ECHO_BEAT} not found`);
  const idxEcho = camp.beats.indexOf(echo);

  const dreamBeat = {
    id: DREAM, label: "Allesh-Gilliam — Father Tamsin's Dream", type: "cinematic", timeScale: "moment", timePoints: 0,
    description: "He does not describe it. He sets the kettle down, and the room goes somewhere else.\n\n⚙ GM: plays the cold open (24 s) — the ringed settlement on the mountain, the ley-veins cracking outward, the detonation, the whole works dropping into a lit crater, dark. This is the night the mine closed its own mouth, as the valley dreamed it. Never name the mountain here; the Father does that himself, or never.",
    questId: AG_QUEST, questStep: 165, questRole: null, targetHexUuid: null,
    speakerActorId: TAMSIN, dialogueOffer: false,
    cinematic: { enabled: true, startSceneId: sceneUuid, durationMs: 24500, nextSceneId: AFTER_SCENE },
    audio: { enabled: true, src: NARRATION, volume: 0.85, loop: false, autoplay: false, broadcastPlayers: true, playlistSoundUuid: "" },
    journal: { enabled: false, entryId: null, force: false },
    playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true,
    inject: { requires: [{ flag: "storyPhase", gte: 2 }], repeatable: true, oncePerHex: false, cooldownTurns: 0 },
    choices: [{ label: "…", next: AFTER, description: "" }],
    worldEffects: {}, tags: "tamsin dream cold_open khezek", politicalTags: ""
  };
  const afterBeat = {
    id: AFTER, label: "Allesh-Gilliam — “I had that dream again.”", type: "dialog", timeScale: "moment", timePoints: 0,
    description: "The kettle is still where he set it down.\n\n“I had that dream again.”\n\nHe says it the way you would report weather. “I had it before I was this man. Everyone in that valley had it, for a season — the ground telling us, politely, that it was about to stop putting up with us. I was a healer then. The gate had a name over it. I did nothing with the warning except sleep worse.”\n\nA long breath.\n\n“A hundred people I never met did something with it. I have only lately understood what.” He looks at his hands. “The mountain is open again. I dream it more often now.”",
    memoryText: "Father Tamsin showed the Stewards the dream — the mountain closing its own mouth — and told them he had it before he was this man, and did nothing with the warning.",
    questId: AG_QUEST, questStep: 166, questRole: null, targetHexUuid: null,
    speakerActorId: TAMSIN, dialogueOffer: false,
    sceneId: null, journal: { enabled: false, entryId: null, force: false },
    audio: { enabled: false, src: "", volume: 0.85, loop: false, autoplay: false, broadcastPlayers: false },
    playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true,
    inject: { requires: [{ flag: "storyPhase", gte: 2 }], repeatable: true, oncePerHex: false, cooldownTurns: 0 },
    choices: [
      { label: "Who were the hundred?", next: `${AFTER}_hundred`, description: "" },
      { label: "Ask something else", next: ECHO_BEAT, description: "" },
      { label: "Leave", next: "allesh_gilliam_introduction_to_hq", description: "" }
    ],
    worldEffects: {}, tags: "tamsin dream cold_open khezek", politicalTags: ""
  };
  const hundredBeat = {
    id: `${AFTER}_hundred`, label: "Allesh-Gilliam — “Ask the coast.”", type: "dialog", timeScale: "moment", timePoints: 0,
    description: "“I don’t know their names. I don’t think anyone does.” He folds his hands. “Somewhere on the coast there is a garden the old world advertised as an attraction. Go and count. Then come back and tell me if the number is still right — I have never had the courage to check.”",
    memoryText: "Father Tamsin pointed the Stewards at the coast: a garden the old world called an attraction. He asked them to count.",
    questId: AG_QUEST, questStep: 167, questRole: null, targetHexUuid: null,
    speakerActorId: TAMSIN, dialogueOffer: false,
    sceneId: null, journal: { enabled: false, entryId: null, force: false },
    audio: { enabled: false, src: "", volume: 0.85, loop: false, autoplay: false, broadcastPlayers: false },
    playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true,
    inject: { requires: [{ flag: "storyPhase", gte: 2 }], repeatable: true, oncePerHex: false, cooldownTurns: 0 },
    choices: [
      { label: "Ask something else", next: ECHO_BEAT, description: "" },
      { label: "Leave", next: "allesh_gilliam_introduction_to_hq", description: "" }
    ],
    worldEffects: {}, tags: "tamsin dream cold_open khezek founders_garden foreshadow.lost_statues", politicalTags: ""
  };

  for (const nb of [dreamBeat, afterBeat, hundredBeat]) {
    const cur = byId.get(nb.id);
    if (cur) {
      let touched = false;
      // keep a created scene id current if the scene was made after the beat
      if (nb.cinematic && cur.cinematic && cur.cinematic.startSceneId !== sceneUuid && scene) { cur.cinematic.startSceneId = sceneUuid; touched = true; report.push(`~ ${nb.id}: startSceneId → ${sceneUuid}`); }
      // the Echo is an Act 2 beat — the dream must share its act or the act seal refuses it (fixed 2026-09-13)
      if (JSON.stringify(cur.inject?.requires) !== JSON.stringify(nb.inject.requires)) { cur.inject = Object.assign({}, cur.inject || {}, { requires: nb.inject.requires }); touched = true; report.push(`~ ${nb.id}: gate → ${JSON.stringify(nb.inject.requires)}`); }
      if (touched) changed++; else report.push(`· ok (already) beat ${nb.id}`);
      continue;
    }
    camp.beats.splice(idxEcho + 1 + changed, 0, nb); byId.set(nb.id, nb); changed++;
    report.push(`✚ beat ${nb.id} (${nb.type})`);
  }

  // ── 3. the route ──────────────────────────────────────────────────────────
  echo.choices = Array.isArray(echo.choices) ? echo.choices : [];
  if (echo.choices.some(c => String(c?.next) === DREAM)) report.push(`· ok (already) route ${ECHO_BEAT} → ${DREAM}`);
  else {
    const leaveIdx = echo.choices.findIndex(c => /^leave$/i.test(String(c?.label || "").trim()));
    const choice = { label: "The dream. Tell me about the dream.", next: DREAM, description: "He mentioned another life. He did not mention the dream. You have a feeling it is the same story." };
    if (leaveIdx >= 0) echo.choices.splice(leaveIdx, 0, choice); else echo.choices.push(choice);
    changed++; report.push(`✚ route ${ECHO_BEAT} → ${DREAM} (before Leave)`);
  }

  // ── write ─────────────────────────────────────────────────────────────────
  if (!DRY_RUN && changed) {
    const raw = game.settings.get(NS, "campaigns");
    (foundry.utils.saveDataToFile || saveDataToFile)(typeof raw === "string" ? raw : JSON.stringify(raw), "application/json", `backup-campaigns-before-tamsin-dream-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await game.settings.set(NS, "campaigns", campaigns);
  }
  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply." : "APPLIED.";
  console.log(`[seed-tamsin-dream] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  await ChatMessage.create({ content: `<div style="font-size:12px"><b>seed-tamsin-dream — ${banner}</b><br>${report.map(r => "&nbsp;" + r.replace(/</g, "&lt;")).join("<br>")}</div>`, whisper: game.users.filter(u => u.isGM).map(u => u.id) });
  ui.notifications?.info(`Tamsin's dream: ${banner}`);
})();

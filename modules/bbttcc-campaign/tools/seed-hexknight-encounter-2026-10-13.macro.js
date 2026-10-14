// seed-hexknight-encounter-2026-10-13.macro.js — THE HEXKNIGHT travel encounter (owner ruling 2026-10-13:
// "make Commander Road Bandit a Hexknight which can be on the higher tier encounter tables").
// Adds the beat chain (enc_hexknight → toll / fight → win / lose / run) to the active campaign and one row per
// terrain table (weight 1, phaseGte 3 — the "higher tier" of the one-table-per-terrain ladder is the act gate).
// The foe is named on the beat (encounter.actorName = "Hexknight"); bbttcc-encounters drops it on the beat's
// battlemap via the `bbttcc:beat:stageReady` hook. F12 console paste-able, GM only. DRY_RUN=true previews. Idempotent.
const DRY_RUN = true;
const NS = "bbttcc-campaign";
const SCENE_ID = "kVBYeEgVGDxJvifz";          // mountain_shrines_hexchrome_battlemap (ember)
const QUEST = "quest_travel_encounters";

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const say = (m) => console.log("[seed-hexknight]", m);
  const campaignId = game.settings.get(NS, "activeCampaignId");
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw || "{}") : (campsRaw || {});
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications?.error(`No active campaign (${campaignId}).`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  let changes = 0;

  const mkBeat = (o) => ({
    id: o.id, label: o.label, type: o.type || "dialog", timeScale: o.timeScale || "leg", tags: o.tags || "", politicalTags: "",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: true, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit" },
    actors: [], choices: (o.choices || []).map(c => Object.assign({ description: "", checkStat: "", checkDC: 0, failNext: "" }, c)),
    encounter: o.encounter || { key: "", tier: null, actorName: "" },
    worldEffects: { territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [] },
    description: o.description, questId: QUEST, questStep: o.questStep ?? null, questRole: null,
    targetHexUuid: null, turnNumber: null, timePoints: 0,
    cinematic: { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null },
    journal: { enabled: false, entryId: null, force: false },
    unlocks: { maneuvers: [], strategics: [] },
    audio: { enabled: false, src: "", volume: 0.85, loop: false, autoplay: false, broadcastPlayers: true },
    refs: {},
    playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    ...(o.sceneId ? { sceneId: o.sceneId } : {}),
    ...(o.award ? { award: o.award } : {}),
    ...(o.memoryText ? { memoryText: o.memoryText } : {}),
    ...(o.pacing ? { pacing: o.pacing } : {})
  });
  const addBeat = (nb) => {
    if (byId.has(nb.id)) { say(`· ok (exists) beat ${nb.id}`); return; }
    camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id} — ${nb.label}`);
  };

  addBeat(mkBeat({ id: "enc_hexknight", label: "The Hexknight", type: "dialog", tags: "travel hexknight", questStep: 400, sceneId: SCENE_ID,
    encounter: { key: "hexknight", tier: 3, actorName: "Hexknight" },
    description: `<p>There is a figure in the road. Plate, lance, a visor shut on whatever it decided to become. The hex sings through the armor in a thin high note you can feel in your fillings.</p><p>It does not ask who you are. It asks what you will PAY to pass — and it means that literally, and it means it the other way too.</p>`,
    choices: [
      { label: "Pay the road-price — coin, and leave the pride in the saddlebag", next: "enc_hexknight_toll", checkStat: "op.economy", checkDC: 14, failNext: "enc_hexknight_toll_fail", checkMode: "auto",
        description: "A Hexknight keeps an oath, and the oath has a toll. Make it worth more than the fight. (The faction's purse does the talking.)" },
      { label: "Meet the lance — nobody owns this road", next: "hexknight_outcome",
        description: "Single combat is a courtesy it offers. It will not insist. Fight it out on the map — the GM calls the aftermath here when it's done." }
    ] }));
  addBeat(mkBeat({ id: "hexknight_outcome", label: "The Hexknight - Encounter Outcome", type: "encounter", timeScale: "scene", questStep: 401, pacing: { ambient: true },
    description: "", choices: [{ label: "Win", next: "enc_hexknight_win" }, { label: "Lose", next: "enc_hexknight_lose" }, { label: "Run", next: "enc_hexknight_run" }] }));
  addBeat(mkBeat({ id: "enc_hexknight_win", label: "The Hexknight - Win", type: "outcome_trigger", questStep: 402, pacing: { ambient: true },
    award: { method: "kill", creature: "hexknight", creatureId: null },
    memoryText: "The coalition put down a Hexknight in the road and took its plate.",
    description: `<p>The visor comes up. Under it: somebody who was a hero once and took a hex-pact to stay one. The pact is loud and the knight is quiet, and you did the quiet one a favor.</p><p>Hex-glyph plate, heart-iron, and a road that belongs to nobody again.</p>`,
    choices: [{ label: "Continue", next: "" }] }));
  addBeat(mkBeat({ id: "enc_hexknight_lose", label: "The Hexknight - Lose", type: "outcome_trigger", questStep: 403, pacing: { ambient: true },
    description: `<p>The lance did what lances do. Please make your way to your designated reincarnation station to resume your adventures in Bad Eden. The road will still be there. So will it.</p>`,
    choices: [{ label: "Continue", next: "" }] }));
  addBeat(mkBeat({ id: "enc_hexknight_run", label: "The Hexknight - Run", type: "outcome_trigger", questStep: 404, pacing: { ambient: true },
    description: `<p>No shame. It is a knight with a hex in its chest; you are people with places to be. It does not chase — the oath is the road, not you — and you leave a little pride in the ditch, where it will not be missed.</p>`,
    choices: [{ label: "Continue", next: "" }] }));
  addBeat(mkBeat({ id: "enc_hexknight_toll", label: "The Hexknight — The Road-Price", type: "outcome_trigger", tags: "travel words_door", questStep: 405,
    award: { method: "talkdown", creature: "hexknight", creatureId: null },
    memoryText: "The coalition paid a Hexknight's toll and kept the road without a fight.",
    description: `<p>Coin changes hands. The visor dips a quarter inch, which from a Hexknight is a parade. The road is yours for the day, and somewhere under the plate something that used to be a person is briefly, dangerously relieved.</p>`,
    choices: [{ label: "Continue", next: "" }] }));
  addBeat(mkBeat({ id: "enc_hexknight_toll_fail", label: "The Hexknight — Insufficient", type: "outcome_trigger", tags: "travel words_door", questStep: 406,
    description: `<p>You offer. It counts. It is not enough — and worse, it was INSULTING, and a Hexknight's oath has a clause about that. The lance comes down.</p>`,
    choices: [{ label: "So be it", next: "hexknight_outcome" }] }));

  // ── tables: one row per terrain table (weight 1, Act 3+) ──
  let tablesRaw = game.settings.get(NS, "encounterTables");
  const tablesWasStr = typeof tablesRaw === "string";
  const tables = tablesWasStr ? JSON.parse(tablesRaw || "{}") : (tablesRaw || {});
  let rows = 0;
  for (const [id, t] of Object.entries(tables)) {
    const m = String(id).match(/^travel_([a-z]+)_t1$/); if (!m || !t || typeof t !== "object") continue;
    t.entries = Array.isArray(t.entries) ? t.entries : [];
    if (t.entries.some(e => e?.beatId === "enc_hexknight")) { say(`· ok ${id} has enc_hexknight`); continue; }
    t.entries.push({ campaignId, beatId: "enc_hexknight", weight: 1, conditions: { terrain: m[1], tier: "3", phaseGte: 3 } });
    rows++; changes++; say(`✚ ${id}: enc_hexknight ×1 @phase≥3`);
  }

  if (!changes) { ui.notifications?.info("[seed-hexknight] nothing to do — already seeded."); return; }
  if (DRY_RUN) { ui.notifications?.info(`[seed-hexknight] DRY RUN — ${changes} change(s) (${rows} table rows); see console.`); return; }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  await game.settings.set(NS, "encounterTables", tablesWasStr ? JSON.stringify(tables) : tables);
  ui.notifications?.info(`[seed-hexknight] APPLIED — ${changes} change(s), ${rows} table rows.`);
})();

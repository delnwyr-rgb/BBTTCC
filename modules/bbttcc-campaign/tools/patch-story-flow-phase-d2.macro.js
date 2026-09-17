/**
 * patch-story-flow-phase-d2.macro.js — GM macro/console. DRY_RUN default true.
 *
 * STORY FLOW ENCODE · PHASE D content, second batch (2026-09-17):
 *
 *  East Wall — THREE CHECKS, GRADED (owner ruling 2026-09-15): the inspection offers Survey it (Logistics), Crew it
 *    (Violence), Read it (Intrigue) — any order, each once — then a Tally the GM adjudicates:
 *      3/3 The Wall Stands Proper  → the existing success beat, + Damaged Infrastructure lifted, Well-Maintained added,
 *                                     faction morale +1 / loyalty +1
 *      2/3 Holds, Bowing on Record → new beat, Damaged Infrastructure lifted
 *      1/3 Patched Twice           → new beat, nothing lifted (a work-crew note)
 *      0/3 The Section Lets Go     → the existing failure beat, + Damaged Infrastructure added, morale −1
 *    (the defense-DC bonuses of the ruling ride on the modifiers: Well-Maintained / Damaged Infrastructure are read
 *     by the yield engine and the loyalty score; the raid DC follows loyalty)
 *  "We haven't met" (D-8): Pike's, Tamsin's and Etta's Act 2 openers lead with a line when their Arrival door was skipped.
 *  Out-Danced (D-5): the Cadence's refusal puts the Out-Danced modifier on the coalition's lead hex; a win on the floor
 *    lifts it.
 *
 * Idempotent; backup download before write; GM only.
 */
(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = []; let changes = 0; const say = (s) => report.push(s);
  const get = (id) => { const b = byId.get(id); if (!b) say(`✗ MISSING beat ${id}`); return b || null; };
  const setField = (id, k, v) => { const b = get(id); if (!b) return; if (JSON.stringify(b[k]) === JSON.stringify(v)) return say(`· ok ${id} ${k}`); b[k] = v; changes++; say(`⚙ ${id}: ${k} set`); };
  const setWE = (id, k, v) => { const b = get(id); if (!b) return; b.worldEffects = (b.worldEffects && typeof b.worldEffects === "object") ? b.worldEffects : {}; if (JSON.stringify(b.worldEffects[k]) === JSON.stringify(v)) return say(`· ok ${id} worldEffects.${k}`); b.worldEffects[k] = v; changes++; say(`⚙ ${id}: worldEffects.${k} = ${JSON.stringify(v).slice(0, 90)}`); };
  const addChoice = (id, choice, at = null) => { const b = get(id); if (!b) return; b.choices = Array.isArray(b.choices) ? b.choices : []; if (b.choices.some(c => c && String(c.next) === String(choice.next) && String(c.label) === String(choice.label))) return say(`· ok ${id} (choice "${choice.label}")`); const row = Object.assign({ description: "", checkStat: "", checkDC: 0, failNext: "" }, choice); if (at === "beforeLeave") { const i = b.choices.findIndex(c => /^(leave|back|something else|not yet)/i.test(String(c?.label || ""))); if (i >= 0) b.choices.splice(i, 0, row); else b.choices.push(row); } else b.choices.push(row); changes++; say(`▸ ${id}: +choice "${choice.label}" → ${choice.next || "—"}`); };
  const dropChoice = (id, pred, label) => { const b = get(id); if (!b) return; const cs = Array.isArray(b.choices) ? b.choices : []; const keep = cs.filter(c => !pred(c)); if (keep.length === cs.length) return say(`· ok ${id} (no choice ${label})`); b.choices = keep; changes++; say(`▸ ${id}: −choice ${label}`); };
  const mkBeat = (o) => ({
    id: o.id, label: o.label, type: o.type || "dialog", timeScale: "scene", tags: o.tags || "", politicalTags: "",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: !!o.repeatable, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires: o.requires || [] },
    actors: [], choices: (o.choices || []).map(c => Object.assign({ description: "", checkStat: "", checkDC: 0, failNext: "" }, c)),
    encounter: { key: "", tier: null, actorName: "" },
    worldEffects: Object.assign({ territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [] }, o.worldEffects || {}),
    description: o.description, questId: o.questId || null, questStep: o.questStep ?? null, questRole: null,
    targetHexUuid: null, turnNumber: 1,
    cinematic: { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null },
    journal: { enabled: false, entryId: null, force: false },
    unlocks: { maneuvers: [], strategics: [] }, timePoints: null,
    playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    ...(o.speakerActorId ? { speakerActorId: o.speakerActorId } : {}), ...(o.story ? { story: o.story } : {}), ...(o.sceneId ? { sceneId: o.sceneId } : {})
  });
  const addBeat = (nb) => { if (byId.has(nb.id)) { say(`· ok (exists) beat ${nb.id}`); return byId.get(nb.id); } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id} — ${nb.label}`); return nb; };

  // ── East Wall: three checks ────────────────────────────────────────────────
  const AG = byId.get("allesh_gilliam_the_east_wall_intro")?.questId || "quest_Cq1v3hJpXarX5rXJ";
  const pike = (game.actors?.contents || []).find(a => /yarrow pike/i.test(a.name))?.id || undefined;
  const wallScene = byId.get("allesh_gilliam_the_east_wall_intro")?.sceneId || undefined;
  const coalition = (byId.get("allesh_gilliam_east_wall_success")?.worldEffects?.factionEffects || [])[0]?.factionId || null;
  const chk = (id, label, question, prose, ok, miss, stat, statLabel) => {
    addBeat(mkBeat({ id, label, tags: "east-wall check", questId: AG, story: { quest: "allesh_gilliam" }, questStep: 122, sceneId: wallScene, requires: [{ flag: "storyPhase", gte: 2 }],
      description: `<p><b>${question}</b></p><p>${prose}</p>`,
      choices: [{ label: `${statLabel}`, checkStat: stat, checkDC: 0, next: id + "_ok", failNext: id + "_miss" }, { label: "Not this one — back to the wall", next: "allesh_gilliam_the_east_wall_intro" }] }));
    addBeat(mkBeat({ id: id + "_ok", label: label + " — Done Right", tags: "east-wall check", questId: AG, story: { quest: "allesh_gilliam" }, questStep: 123, sceneId: wallScene, requires: [{ flag: "storyPhase", gte: 2 }],
      description: `<p>${ok}</p><p><i>⚙ GM: one success toward the tally.</i></p>`, choices: [{ label: "Back to the wall", next: "allesh_gilliam_the_east_wall_intro" }] }));
    addBeat(mkBeat({ id: id + "_miss", label: label + " — Missed", tags: "east-wall check", questId: AG, story: { quest: "allesh_gilliam" }, questStep: 123, sceneId: wallScene, requires: [{ flag: "storyPhase", gte: 2 }],
      description: `<p>${miss}</p>`, choices: [{ label: "Back to the wall", next: "allesh_gilliam_the_east_wall_intro" }] }));
  };
  chk("ag_east_wall_survey", "The East Wall — Survey It", "Survey it.",
    "Plumb's numbers are on a clipboard nailed to a post, dated once. The lean is not on the clipboard. Walk the span with a line and a level and find out where the paper and the plate disagree.",
    "The line tells the story the clipboard won't: the bow starts three plates in from the north footing and runs the whole welded stretch, and it grew after the survey, not before it. On record now, in your hand, with a date. Plumb can argue with a lot of things. He cannot argue with a date.",
    "You get numbers. They are your numbers, and they are close enough to Plumb's that the argument is about method, not fact. The wall keeps its lean and its opinion.",
    "op.logistics", "Run the line (Logistics)");
  chk("ag_east_wall_crew", "The East Wall — Crew It", "Crew it.",
    "Somebody patched this section twice and nobody knows whose shift it was. Rally the wall crew and the patrol rotation to the bowed span and put weight behind the weld — properly, no theater.",
    "The crew turns up, and stays, and the section gets the kind of attention that comes from people who sleep behind it. Braces true. Welds fresh. The scouts stop pointing scanners at the bow and start walking it like a wall again.",
    "The crew turns up. Half of them turn back up an hour later somewhere else. The patch holds the way the last two held — for now — and the rotation goes back to pretending.",
    "op.violence", "Rally the crew (Violence)");
  chk("ag_east_wall_read", "The East Wall — Read It", "Read it.",
    "The scouts rotate constantly and the pressure lands where they aren't. Reassign the patrols, predict where the next push comes, and find out what leans on this wall when nobody's looking.",
    "You put the watch where the wall is thinnest and the pressure shows itself: not weather, not raiders — a slow, patient lean from the east, toward the mountain, the way a rope goes taut when someone far away picks up the other end. The rotation stays fixed. Pike will want to hear the word 'toward.'",
    "The rotation shifts, the pressure shifts with it, and after two nights the scouts are back where they started with a new theory and no wall to test it on.",
    "op.intrigue", "Reassign the watch (Intrigue)");
  addBeat(mkBeat({ id: "ag_east_wall_tally", label: "The East Wall — The Tally", tags: "east-wall", questId: AG, story: { quest: "allesh_gilliam" }, questStep: 124, sceneId: wallScene, speakerActorId: pike, requires: [{ flag: "storyPhase", gte: 2 }],
    description: `<p>Pike doesn't come to the wall. He waits at the boards, and when you come in he doesn't ask how it went — he can read it on you. He pours two cups of something that is legally coffee.</p><p><i>⚙ GM: count the successes (Survey / Crew / Read, one each). Three → The Wall Stands Proper. Two → Holds, Bowing on Record. One → Patched Twice. None → The Section Lets Go.</i></p>`,
    choices: [{ label: "Three — the wall stands proper", next: "allesh_gilliam_east_wall_success" }, { label: "Two — it holds, bowing on record", next: "ag_east_wall_holds" }, { label: "One — patched twice", next: "ag_east_wall_patched" }, { label: "None — the section lets go", next: "allesh_gilliam_east_wall_failure" }] }));
  addBeat(mkBeat({ id: "ag_east_wall_holds", label: "Allesh-Gilliam — Holds, Bowing on Record", tags: "east-wall outcome", questId: AG, story: { quest: "allesh_gilliam" }, questStep: 131, speakerActorId: pike, requires: [{ flag: "storyPhase", gte: 2 }],
    worldEffects: { hexModifiers: [{ remove: ["Damaged Infrastructure"], hexName: "Allesh-Gilliam" }] },
    description: `<p>"It's still bowing," Pike says, "but it's bowing on record, and the crew stopped pretending, and somebody finally wrote down when it started." He taps the map where the section is. "That's not nothing. Around here that's most of the job." The wall holds. The lean stays. The cause is still under a mountain that's been tired lately.</p>`,
    choices: [{ label: "Leave", next: "allesh_gilliam_introduction_to_hq" }] }));
  addBeat(mkBeat({ id: "ag_east_wall_patched", label: "Allesh-Gilliam — Patched Twice", tags: "east-wall outcome", questId: AG, story: { quest: "allesh_gilliam" }, questStep: 132, speakerActorId: pike, requires: [{ flag: "storyPhase", gte: 2 }],
    description: `<p>"So it's patched," Pike says. "Again." He doesn't sound angry; he sounds like a man adding a line to a list. "Third time somebody welds that span I'm going to want a work crew on it for a turn, and a work crew costs what a work crew costs." The wall holds because it has been told to. Plumb's clipboard stays nailed to its post, undated.</p>`,
    choices: [{ label: "Leave", next: "allesh_gilliam_introduction_to_hq" }] }));
  // the two existing outcomes gain their teeth
  setWE("allesh_gilliam_east_wall_success", "hexModifiers", [{ remove: ["Damaged Infrastructure"], add: ["Well-Maintained"], hexName: "Allesh-Gilliam" }]);
  if (coalition) setWE("allesh_gilliam_east_wall_success", "factionEffects", [{ factionId: coalition, moraleDelta: 1, loyaltyDelta: 1, unityDelta: 0, darknessDelta: 0, opDeltas: {}, allowOvercap: false }]);
  setWE("allesh_gilliam_east_wall_failure", "hexModifiers", [{ add: ["Damaged Infrastructure"], hexName: "Allesh-Gilliam" }]);
  if (coalition) setWE("allesh_gilliam_east_wall_failure", "factionEffects", [{ factionId: coalition, moraleDelta: -1, loyaltyDelta: 0, unityDelta: 0, darknessDelta: 0, opDeltas: {}, allowOvercap: false }]);
  // the inspection: the four one-swing choices become the three checks + the tally
  dropChoice("allesh_gilliam_the_east_wall_intro", c => c && ["Reinforce structure properly", "Rally workers and patrols", "Reassign patrols, predict pressure points", "Overbuild and intimidate the problem"].includes(String(c.label || "")), "the four one-swing choices");
  addChoice("allesh_gilliam_the_east_wall_intro", { label: "Survey it", next: "ag_east_wall_survey" }, "beforeLeave");
  addChoice("allesh_gilliam_the_east_wall_intro", { label: "Crew it", next: "ag_east_wall_crew" }, "beforeLeave");
  addChoice("allesh_gilliam_the_east_wall_intro", { label: "Read it", next: "ag_east_wall_read" }, "beforeLeave");
  addChoice("allesh_gilliam_the_east_wall_intro", { label: "Tell Pike — tally the swings", next: "ag_east_wall_tally" }, "beforeLeave");
  { const b = get("allesh_gilliam_the_east_wall_intro"); if (b && b.inject && b.inject.repeatable !== true) { b.inject.repeatable = true; changes++; say("⚙ allesh_gilliam_the_east_wall_intro: repeatable (it is the hub of the three checks)"); } }

  // ── "We haven't met" (D-8) ────────────────────────────────────────────────
  setField("allesh_gilliam_introduction_to_hq", "unmet", { beatId: "allesh_gilliam_yarrow_welcome", html: `<p><i>Pike looks at you the way he looks at a report he was never handed. "You walked past this door on your first night," he says. "I noticed. I notice things. That's the job." He lets it sit exactly one second longer than is comfortable.</i></p>` });
  setField("allesh_gilliam_father_tamsin_conversation", "unmet", { beatId: "allesh_gilliam_tamsin_welcome", html: `<p><i>"We haven't met," Father Tamsin says, and it isn't a reproach, which somehow makes it one. "The bread was an hour old that night, too. It keeps." He sets out cups without asking how many you are.</i></p>` });
  setField("allesh_gilliam_the_long_market_intro", "unmet", { beatId: "allesh_gilliam_etta_welcome", html: `<p><i>Etta doesn't say she noticed you skipped the Market on your first night. She hands you a skewer, and the skewer says it.</i></p>` });

  // ── Out-Danced (D-5) ──────────────────────────────────────────────────────
  setWE("cadence_refuse", "hexModifiers", [{ add: ["Out-Danced"] }]);            // lands on the run-context / beat hex (the Cadence's target)
  setWE("cadence_win_style", "hexModifiers", [{ remove: ["Out-Danced"] }]);
  setWE("cadence_win_ugly", "hexModifiers", [{ remove: ["Out-Danced"] }]);

  console.log(`[patch-story-flow-phase-d2] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Phase D2 patch DRY RUN: ${changes} change(s) (console). Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-phase-d2-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Phase D2 patch APPLIED: ${changes} change(s). Backup downloaded.`);
})();

/* patch-aldous-plumb-argument-2026-10-15.macro.js — ALDOUS PLUMB, REWRITTEN (Dave, Beat Polish doc 2026-10-15).
 *
 *  Aldous Plumb is no longer a pompous surveyor hiding a bad survey. He is a FRAUD who is AFRAID: no
 *  engineering at all, but he can TALK TO BUILDINGS (back in the Harmonized Inner they answer politely;
 *  in Bad Eden they don't). The morning after That One Night a note came under his door — "any attempt
 *  to investigate damage to the wall will be met with consequences" — unsigned, WAX-sealed (Wick's; he
 *  doesn't know that). He has not been to the East Wall since. "Cosmetic" was fear, not a lie about math.
 *
 *  ACT 2 — the argument (from Pike's hub, allesh_gilliam_introduction_to_hq):
 *    ag_plumb_argument   Presence 12 / Insight 11 → ag_plumb_cracks, fail → ag_plumb_bluster (free retry);
 *                        "What are these drawings?" → ag_plumb_drawings (the tell: he talks to buildings)
 *    ag_plumb_cracks     the note. He needs to FEEL SAFE: Diplomacy 12 → ag_plumb_to_the_wall (fail → ag_plumb_not_yet),
 *                        or the Muster escort = NO ROLL once allesh_gilliam_muster_intro has played;
 *                        "Give us the note" → ag_plumb_note_taken (Receipt: The Architect's Note — wax, not tallow)
 *    ag_plumb_to_the_wall  outcome at the East Wall: Plumb relays BOTH of the wall's armed secrets as Receipts
 *                        (The Lean Began That One Night · The Twice-Patched Section), Allesh-Gilliam gains the
 *                        named state "The Architect Is Paying Attention" (modifier Well-Maintained = +1 defense),
 *                        coalition morale +1 / loyalty +1.
 *  ACT 0–1 — Dave's new line on the first visit:
 *    intro description → Dave's rewrite; + "How's the town holding up?" → allesh_gilliam_plumb_office_state_of_town
 *    ("Steady as a rock Stewards! Guaranteed by ME") → "Guaranteed by whom?" → allesh_gilliam_plumb_office_guarantee.
 *
 *  Speakers resolve by name at run time (Aldous Plumb, The East Wall). Idempotent (id / label / text guards);
 *  DRY_RUN default true; backs up `campaigns` before the write. Run as GM on the live world.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw); // never mutate the live cache on a dry run
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  const QUEST = "quest_Cq1v3hJpXarX5rXJ";          // Allesh-Gilliam (story.quest "allesh_gilliam")
  const HUB = "allesh_gilliam_introduction_to_hq";  // Pike Sends for You (Act 2 hub)
  const INTRO = "allesh_gilliam_plumb_office_intro";
  const TOWN_WALK = "allesh_gilliam_town_walk";
  const SCENE_OFFICE = "gYuClWDbCpP4RR79";          // Plumb's Tower
  const SCENE_WALL = "Elyx1ovCul7ImfNS";            // the East Wall
  const PLUMB = game.actors?.getName?.("Aldous Plumb")?.id || byId.get(INTRO)?.speakerActorId || null;
  const WALL = game.actors?.getName?.("The East Wall")?.id || byId.get("allesh_gilliam_east_wall_listen")?.speakerActorId || null;
  if (!PLUMB) report.push("⚠ no world actor named 'Aldous Plumb' — dialog beats will have no speaker portrait");
  if (!WALL) report.push("⚠ no world actor named 'The East Wall' — receipts carry the name only");

  const ch = (label, description, extra = {}) => ({ label, next: "", description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const WE = (extra = {}) => ({ territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [], ...extra });
  const mk = (id, questStep, label, description, { type = "dialog", sceneId = SCENE_OFFICE, speaker = PLUMB, phase = { gte: 2 }, choices = [], worldEffects = WE(), memoryText = "", repeatable = true, tags = "allesh-gilliam plumb", dialogueOffer = true } = {}) => ({
    id, label, type, timeScale: "scene", tags, politicalTags: "",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit",
      requires: [{ flag: "storyPhase", gte: phase.gte }, ...(phase.lte != null ? [{ flag: "storyPhase", lte: phase.lte }] : [])] },
    actors: [], choices, encounter: { key: "", tier: null, actorName: "" }, worldEffects, description, memoryText,
    questId: QUEST, questStep, questRole: null, targetHexUuid: null, turnNumber: null,
    cinematic: { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null },
    journal: { enabled: false, entryId: null, force: false }, unlocks: { maneuvers: [], strategics: [] },
    timePoints: 0, dialogueOffer, sceneId, story: { quest: "allesh_gilliam" },
    ...(speaker ? { speakerActorId: speaker } : {}),
    refs: {}, playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true
  });
  const addBeat = (nb) => {
    if (byId.get(nb.id)) { report.push(`· ok beat (already) ${nb.id}`); return; }
    camp.beats.push(nb); byId.set(nb.id, nb); changes++; report.push(`✚ beat ${nb.id} — ${nb.label}`);
  };

  /* ── ACT 2 · THE ARGUMENT ─────────────────────────────────────────────────── */
  const NEW_BEATS = [
    mk("ag_plumb_argument", 371, "Allesh-Gilliam — The Structural Authority Would Rather Not",
      "<p>The cistern office has acquired a second chair since you were last here. It is facing the wall. Nobody is sitting in it.</p>" +
      "<p>Aldous Plumb is at his desk with his back to the window, drawing a building that does not exist, with the concentration of a man who heard you on the stairs and has decided that if he draws hard enough you will turn out to be a rumour. \"Stewards!\" He does not look up. \"Steady as a rock. All of it. Every stone. Guaranteed by ME—\" and here the pencil goes through the paper \"—Aldous Plumb, Structural Authority, from CANADA, and if Marshal Pike has sent you about the wall, then the wall is cosmetic, and I have said so in writing, and writing is PERMANENT.\"</p>" +
      "<p>Through the window behind him the East Wall leans a little further toward Khezek-Tor, like it is trying to hear this.</p>" +
      "<p><i>⚙ GM: Pike wants Plumb at the wall; Plumb wants to be anywhere else. Either check gets the truth out of him (ag_plumb_cracks); a miss is a free retry. \"The drawings\" is the tell — he has no engineering, he talks to buildings.</i></p>",
      { choices: [
        ch("Pike sent us. The wall needs its Structural Authority — and the Structural Authority is coming with us.",
           "Lean on the title. He gave it to himself; he can hardly argue with it.",
           { checkStat: "presence", checkDC: 12, next: "ag_plumb_cracks", failNext: "ag_plumb_bluster" }),
        ch("You're not pompous. You're scared. What happened?",
           "The pencil stops. That is either a very good sign or the paper has finally won.",
           { checkStat: "ins", checkDC: 11, next: "ag_plumb_cracks", failNext: "ag_plumb_bluster" }),
        ch("What ARE these drawings, actually?", "Every surface. Precise, confident, and each one slightly wrong in a way you still can't name.", { next: "ag_plumb_drawings" }),
        ch("Leave him to it", "The pencil resumes. The second chair goes on facing the wall.", { next: HUB })
      ] }),

    mk("ag_plumb_drawings", 372, "Allesh-Gilliam — The Drawings Are Not Drawings",
      "<p>He brightens the way people brighten when you ask about the one thing they are actually good at.</p>" +
      "<p>\"Portraits.\" He turns the nearest one toward you. It is the Waiting Room, except the roofline is wrong, and the door is in the wrong place, and the whole building is very slightly smiling. \"Buildings have a way they'd LIKE to be. You just have to ask nicely and hold the pencil loosely. Back home—\" a hand-wave in the direction of Canada, which is apparently north-ish \"—a building would tell you where it hurt, and you'd write it down, and everyone would say <i>thank you, Aldous</i>, and there'd be a little lunch.\"</p>" +
      "<p>He looks at the window without looking at the wall. \"Things here do not want a little lunch. Things here want to fall on you, specifically, out of spite, and then be asked about it. The granary called me a word last week. I don't know what it means. I drew it anyway.\"</p>" +
      "<p>Every drawing on these walls, you realise, is a building drawn the way it wishes it were. None of them is the East Wall.</p>",
      { choices: [
        ch("Back to the matter of the wall", "", { next: "ag_plumb_argument" }),
        ch("Leave", "One of the drawings watches you go. You decide not to check which.", { next: HUB })
      ] }),

    mk("ag_plumb_bluster", 373, "Allesh-Gilliam — Steady As A Rock",
      "<p>He stands up, which is a mistake, because the chair has an opinion about it and the opinion is LOUD.</p>" +
      "<p>\"STEADY,\" he says, over the chair, \"as a ROCK. Guaranteed. I have the certificate. The certificate is framed. If you would like to take it up with the certificate, the certificate is on the wall, which is ALSO steady, and—\" he looks at the wall the certificate is on, and the certificate is hanging a little crookeder than you remember \"—that is the wall's fault.\"</p>" +
      "<p>He sits. The chair says nothing. \"I have a great deal of drawing to do.\"</p>" +
      "<p><i>⚙ GM: no cost to retry — he isn't angry, he's cornered. Try the other approach.</i></p>",
      { choices: [
        ch("Try a different angle", "", { next: "ag_plumb_argument" }),
        ch("Leave him to it", "", { next: HUB })
      ] }),

    mk("ag_plumb_cracks", 374, "Allesh-Gilliam — The Note",
      "<p>It comes out of him the way a wall comes down: all at once, after a long time of not.</p>" +
      "<p>\"I can't go to the wall.\" He is very quiet now, which is worse than the shouting. \"Somebody doesn't want me to. Somebody put this under the door the morning after That One Night, and I have read it ONE HUNDRED TIMES and it has not become a different note.\"</p>" +
      "<p>He slides a folded square across the desk without looking at it, the way you'd slide a spider. The paper is good. The hand is neat. The seal is wax — not tallow, WAX, in a town that burns tallow — and it says, in full: <i>Any attempt to investigate damage to the wall will be met with consequences.</i></p>" +
      "<p>\"I don't know who. I don't know what consequences. I am not a brave man. I am a man who is good at ONE thing, and the one thing is getting a building to tell me where it hurts, and the one building in this town I can't go and ask is the one that's falling over.\" He puts his head in his hands. \"It called to me, you know. The wall. Through the window. All last winter. I shut the curtains.\"</p>" +
      "<p>What he needs is not an argument. He has had the argument, with himself, every night since. What he needs is to be walked there by someone the note can't frighten.</p>" +
      "<p><i>⚙ GM: \"he needs to feel safe\" is the win. The Muster escort skips the roll once the militia exists (allesh_gilliam_muster_intro played); otherwise Diplomacy 12. Taking the note hands over a Receipt that points quietly at the wax seam — do NOT name Wick here.</i></p>",
      { choices: [
        ch("Nobody touches you. We stand between you and the wall the whole way, and the whole time.",
           "It isn't a promise you can prove. He watches your face to see whether you believe it.",
           { checkStat: "op.diplomacy", checkDC: 12, next: "ag_plumb_to_the_wall", failNext: "ag_plumb_not_yet" }),
        ch("Captain Brakk's militia walks you there. A dozen people and a bell.",
           "The Muster has been looking for a reason to march somewhere. This is a reason.",
           { next: "ag_plumb_to_the_wall", requires: [{ beatMark: "allesh_gilliam_muster_intro" }] }),
        ch("Give us the note. Whoever wrote it just became our problem.",
           "He lets go of it like it was hot.",
           { next: "ag_plumb_note_taken", requires: [{ beatMark: "ag_plumb_note_taken", not: true }] }),
        ch("We'll come back.", "He nods, relieved and ashamed in equal parts, and the curtains stay shut.", { next: HUB })
      ] }),

    mk("ag_plumb_note_taken", 375, "Allesh-Gilliam — Wax, Not Tallow",
      "<p>You fold it back along its own creases and put it away, and the room gets lighter by exactly one piece of paper.</p>" +
      "<p>\"Good.\" He breathes out. \"Good. Yes. Your problem. Please.\" A pause. \"If you find them — could you not mention I drew the granary with a face? It's sensitive about it.\"</p>" +
      "<p>The wax is the thing. Nobody in Allesh-Gilliam seals anything in wax. Nobody in Allesh-Gilliam can afford to.</p>",
      { type: "outcome_trigger", repeatable: false,
        memoryText: "The party took the threatening note from Aldous Plumb's desk: unsigned, good paper, a WAX seal in a tallow town.",
        worldEffects: WE({ receipts: [{ label: "The Architect's Note", effectKey: "stirThePot", acquisition: "earned",
          source: { name: "under Aldous Plumb's door, the morning after That One Night", ...(PLUMB ? { npcActorId: PLUMB } : {}) },
          truth: "\"Any attempt to investigate damage to the wall will be met with consequences.\" Unsigned. Good paper, a neat hand, and a WAX seal — in a town that burns tallow. Whoever wrote it buys their candles somewhere this town doesn't." }] }),
        choices: [ ch("Now — about the wall", "", { next: "ag_plumb_cracks" }) ] }),

    mk("ag_plumb_not_yet", 376, "Allesh-Gilliam — Not Yet",
      "<p>\"You'd stand between me and the wall,\" he repeats. \"The wall is forty feet high, and the note didn't come from the wall.\"</p>" +
      "<p>He is not wrong, which is annoying. \"Come back with something that can't be frightened. A crowd. A bell. A very large person. I'm not proud. I'm from CANADA.\"</p>" +
      "<p><i>⚙ GM: the Muster route on ag_plumb_cracks is the no-roll answer; or talk him round again (Diplomacy 12).</i></p>",
      { choices: [
        ch("Try again", "", { next: "ag_plumb_cracks" }),
        ch("Leave", "", { next: HUB })
      ] }),

    mk("ag_plumb_to_the_wall", 377, "Allesh-Gilliam — The Architect Talks to the Wall",
      "<p>He walks there like a man walking to his own trial — slowly, with a lot of people around him, and with a bell.</p>" +
      "<p>At the wall he stops. He puts a hand flat on the plate where the bow is worst — the same place yours went — and closes his eyes, and his whole posture changes: shoulders down, head cocked, the face of a man on a long call with a difficult relative.</p>" +
      "<p>\"Yes,\" he says. \"Yes. I know. I KNOW. I'm here now, aren't I.\" A pause. \"There is no need for THAT kind of language.\"</p>" +
      "<p>What follows takes eleven minutes and you only get his half of it. The wall, it turns out, has been waiting a season for somebody to ask it the right question, and now that somebody has, it is not going to be brief. Plumb nods. Plumb winces. At one point Plumb says \"well, that's between you and the crew\" in the voice of a man dragged into a family argument he did not come for.</p>" +
      "<p>When he opens his eyes he looks ten years older and about four stone lighter.</p>" +
      "<p>\"Two things,\" he says — to you, to Pike, to the Muster, to the morning. \"One. The lean did not start with a weld. It started THAT NIGHT. Something under Khezek-Tor pulled, and the wall has been leaning toward it ever since, like a dog toward a kitchen. It is not cosmetic. It was never cosmetic. I said cosmetic because I was frightened, and I'd like that minuted.\"</p>" +
      "<p>\"Two. The same span has been patched twice, by the same crew, and they chalked their opinion on the inside face where I would never look. It says NOT US. The second patch was laid crooked on purpose. So the lean would show. So somebody would COME.\" He looks at the wall like it is the first honest thing he has met in this town. \"It wanted to be caught.\"</p>" +
      "<p>Pike, somewhere behind you, says nothing at great length.</p>" +
      "<p>Aldous Plumb does not go back to the office. He sets the second chair down right there in the lee of the wall, facing it, and sits, and takes out the pencil, and starts — for the first time since he got here — drawing a building the way it actually is.</p>" +
      "<p><i>⚙ GM: the wall's two armed secrets are now the party's as Receipts (no Talk window needed; mark them used on The East Wall if you like). Allesh-Gilliam gains \"The Architect Is Paying Attention\" (Well-Maintained, +1 defense). Coalition morale +1, loyalty +1.</i></p>",
      { type: "outcome_trigger", sceneId: SCENE_WALL, repeatable: false,
        memoryText: "Escorted to the East Wall, Aldous Plumb talked to it: the lean began That One Night (something under Khezek-Tor pulled) and the crew who patched the span twice chalked NOT US and laid the second patch crooked so someone would come. Two Receipts from the wall. Plumb now keeps watch on it; Allesh-Gilliam is Well-Maintained.",
        worldEffects: WE({
          receipts: [
            { label: "The Lean Began That One Night", effectKey: "oppRollMinus2", acquisition: "earned",
              source: { name: "The East Wall, through Aldous Plumb", ...(WALL ? { npcActorId: WALL } : {}) },
              truth: "The bow did not begin with the Architect's survey or a bad weld. It began the night everyone felt kinda weird: something under Khezek-Tor pulled, and the wall has leaned toward that pull ever since. Produced in court, 'cosmetic' is indefensible and Pike has his root cause." },
            { label: "The Twice-Patched Section", effectKey: "rollPlus2", acquisition: "earned",
              source: { name: "The East Wall, through Aldous Plumb", ...(WALL ? { npcActorId: WALL } : {}) },
              truth: "The same span was patched twice by the same crew, who chalked their worry on the inside face where the Architect never looked: NOT US. The wall knows which crew, which night, and that the second patch was laid crooked on purpose so the lean would show." }
          ],
          worldModifiers: [{ key: "architect_on_watch", label: "The Architect Is Paying Attention", op: "add", enabled: true, hexName: "Allesh-Gilliam", durationTurns: 0, modifiers: ["Well-Maintained"] }],
          factionEffects: [{ factionId: "@coalition", moraleDelta: 1, loyaltyDelta: 1, unityDelta: 0, darknessDelta: 0, opDeltas: {}, allowOvercap: false }],
          warLog: "Aldous Plumb went to the East Wall, talked to it, and came back with the truth. He has not left it since."
        }),
        choices: [ ch("Back to Pike", "Pike will want this in writing. Plumb, for once, agrees.", { next: HUB }) ] }),

    /* ── ACT 0–1 · Dave's first-visit line ───────────────────────────────── */
    mk("allesh_gilliam_plumb_office_state_of_town", 378, "Allesh-Gilliam — The Plumb Office, State of the Town",
      "<p>Plumb starts to say something, then stops, cocks his head to the side, his eyes glaze over. \"Steady as a rock, Stewards! Guaranteed by ME, Aldous Plumb, Structural Authority.\" His voice has a slightly manic edge to it.</p>",
      { type: "skill_scene", phase: { gte: 1, lte: 1 }, repeatable: false, dialogueOffer: false, choices: [
        ch("Guaranteed by whom, exactly?", "", { next: "allesh_gilliam_plumb_office_guarantee" }),
        ch("Good to know.", "You leave him to his drawings. One of them is watching you leave.", { next: INTRO }),
        ch("Leave", "", { next: TOWN_WALK })
      ] }),

    mk("allesh_gilliam_plumb_office_guarantee", 379, "Allesh-Gilliam — The Certificate",
      "<p>He points, without looking, at the frame on the wall. It is a certificate. It is in a language that is mostly English. It has a maple leaf on it, drawn in by hand, in a different pen.</p>" +
      "<p>\"Structural Authority,\" he says. \"Accredited. From CANADA. They have a LOT of buildings in Canada. Stacked, some of them.\"</p>" +
      "<p>The frame is hanging crooked. He notices you noticing. \"The wall's fault.\" The wall it is hanging on is the one that isn't leaning.</p>",
      { type: "skill_scene", phase: { gte: 1, lte: 1 }, repeatable: false, dialogueOffer: false, choices: [
        ch("Fair enough.", "", { next: INTRO }),
        ch("Leave", "", { next: TOWN_WALK })
      ] })
  ];
  for (const nb of NEW_BEATS) addBeat(nb);

  /* ── intro: Dave's rewrite + the new door ─────────────────────────────── */
  {
    const b = byId.get(INTRO);
    if (!b) report.push(`⚠ ${INTRO}: NOT FOUND`);
    else {
      const NEW_DESC = "The cistern of the old water tower is an office now, and in the office is Aldous Plumb, Structural Authority (\"from Canada\", framed, hung slightly crooked, which he will tell you is the wall's fault). Every surface is drawings of the town — precise, confident, and each one slightly wrong in a way you can't immediately name. He surveyed the entire town, once, and is still trying to figure out what to do with the information. He has a slightly panicked look on his face as you enter.";
      if (!/cistern/i.test(String(b.description || ""))) { b.description = NEW_DESC; changes++; report.push(`✚ ${INTRO}: description → Dave's rewrite (cistern / from Canada / panicked)`); }
      else report.push(`· ok ${INTRO}: description already rewritten`);
      b.choices = Array.isArray(b.choices) ? b.choices : [];
      if (!b.choices.some(c => String(c?.next || "") === "allesh_gilliam_plumb_office_state_of_town")) {
        b.choices.unshift(ch("How's the town holding up?", "", { next: "allesh_gilliam_plumb_office_state_of_town" }));
        changes++; report.push(`✚ ${INTRO}: + "How's the town holding up?" → state_of_town`);
      } else report.push(`· ok ${INTRO}: state_of_town door present`);
    }
  }

  /* ── hub: "Go talk to Aldous Plumb" (hidden once he's been to the wall) ── */
  {
    const b = byId.get(HUB);
    if (!b) report.push(`⚠ ${HUB}: NOT FOUND`);
    else {
      b.choices = Array.isArray(b.choices) ? b.choices : [];
      let row = b.choices.find(c => /aldous plumb/i.test(String(c?.label || "")));
      const want = { label: "Go talk to Aldous Plumb", next: "ag_plumb_argument",
        description: "Pike's exact words were \"bring me that CANADIAN.\" Pike's words are usually shorter than that.",
        requires: [{ beatMark: "ag_plumb_to_the_wall", not: true }] };
      if (!row) {
        const at = b.choices.findIndex(c => /ask about something else/i.test(String(c?.label || "")));
        b.choices.splice(at >= 0 ? at : b.choices.length, 0, ch(want.label, want.description, { next: want.next, requires: want.requires }));
        changes++; report.push(`✚ ${HUB}: + "Go talk to Aldous Plumb" → ag_plumb_argument`);
      } else if (String(row.next || "") !== want.next) {
        Object.assign(row, want, { checkStat: row.checkStat || "", checkDC: row.checkDC || 0, failNext: row.failNext || "" });
        changes++; report.push(`✚ ${HUB}: "Go talk to Aldous Plumb" wired → ag_plumb_argument`);
      } else report.push(`· ok ${HUB}: Plumb row wired`);
    }
  }

  console.log(`[patch-aldous-plumb] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Aldous Plumb patch DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Aldous Plumb patch: nothing to do.");
  try {
    (foundry.utils.saveDataToFile ?? saveDataToFile)(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
      `backup-campaigns-before-aldous-plumb-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Aldous Plumb patch APPLIED: ${changes} change(s). The Architect is from CANADA.`);
})();

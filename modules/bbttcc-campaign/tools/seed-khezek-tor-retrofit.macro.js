/* seed-khezek-tor-retrofit.macro.js — KHEZEK-TOR to the Chuckle Creek template (2026-09-27). RUN IN-WORLD (GM). DRY_RUN default true.
 *
 * Source: ~/KHEZEK_TOR_RETROFIT_2026_09_27.md; bible §9 ("be the official word" as a step; Doc's back room opens; the dropped
 * manifest recovered; Night One as history told by the third brother). Tone: Brennig's desk, Calder talks while he works, the
 * stone is proud; the turn = the third brother's place setting.
 *
 *  1. ARMED SECRETS: Calder, Brennig (+ ruled retcon: the middle brother died on the Cough night), Sable Nine; NEW actor Bez (the cook).
 *  2. Speakers on the speakerless KT beats (Lift Hall = Brennig, Brace = Calder, Maw = Sable, cookline = Bez, cough = Doc …).
 *  3. NEW CHAPTER "The Official Word" (registry quest_kt_official_word): 6 steps / 15 beats, receipts THE DROPPED MANIFEST and
 *     THE BACK-ROOM ROSTER, endings given / thin, epilogue THE COMEUPPANCE TAPE after the finale.
 *  4. Full KT script (code + the new steps before "squares", polished doors, tape in `after`) → campaign.story; quest def + chapter.
 *
 * Idempotent; backs up the campaigns setting. F5 after.
 *
 * REVIEW FIXES 2026-10-01 (GAME_REVIEW_2026_09_30, HIGH ×2):
 *  • the climax step was `id: "word"`, which is ALSO the code script's "Word from the Mountain" step, so the filter dropped it and the
 *    chapter had no ending on the NOW card. It is `oword` now, and the filter matches by id OR by beats.
 *  • the two endings (given / thin) carried Calder as speaker and no gate — a conversation with Calder could play them cold. They are
 *    gated on the chapter + kt_official_word (given also on both receipts) and marked dialogueOffer:false; the four fail landings are
 *    dialogueOffer:false too (routing-only nodes). executeBeat never consults inject.requires on a route, so the endings stay reachable
 *    from kt_official_word's choices. A re-run over an already-seeded world reconciles the existing beats (adds what is missing only).
 *    Already-seeded worlds: tools/patch-template-review-fixes-2026-10-01.macro.js does the same repair in one run.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const KEY = "khezek_tor", Q_MAIN = "quest_LJAmlim7oUtlMPiC", Q_WORD = "quest_kt_official_word", Q_FINALE = "quest_thatwards_ho_finale";
  const MARKER = "[KT-RETROFIT-2026-09-27]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  // ── 1. personas ────────────────────────────────────────────────────────────
  const SECRETS = {
    "Drax Calder": [
      "The Quiet Ones :: oppRollMinus2 :: a Steward asks WHO pays the tolls in the upper galleries, not what they worship :: Good coin, no ore, singing at the wrong hours; theirs go up full and come down empty. He takes the money because the Brace needs it, and he does not like it, and he will say so exactly once.",
      "The Shift List :: rollPlus2 :: a Steward asks to SEE the shift list from the Cough, not what happened that night :: Three names are missing from it and the paper has been folded around the gap so many times the gap has a shine. He has said nothing official since. He wants somebody from the outfit to say it out loud so he doesn't have to."
    ],
    "Brennig Tamsin": [
      "Proud Ore :: rollPlus2 :: a Steward helps him count a SECOND crate, all the way, out loud :: Yesodium is proud. It sat a hundred years under owners who sold it to one client and let the valley starve, and it has not forgotten. \"You don't have to like the stone. You have to notice it.\" He does not know the owners were his brother's family in another life.",
      "The Middle Brother :: stirThePot :: a Steward asks about his brother ONCE, and does not ask twice :: He tells it as a joke, once: the middle one leaned into the cage shaft after a dropped manifest on the night the mountain coughed, and is technically still on the manifest. He does not tell it again. He counts crates aloud instead. The plate he sets at the cookline is that man's."
    ],
    "Sable Nine": [
      "The Six Points :: rollPlus2 :: a Steward stands a deep watch with them, or brings them something the chart can't explain :: Everything on the deep chart drifts except six points that have never moved once. Sable believes they are not rock. Sable has never said the word 'statues' out loud, because saying it would make it a claim, and Sable only makes claims twice-verified.",
      "Ninety-Nine :: oppRollMinus2 :: after the Garden has been counted, a Steward asks what the chart tradition says the number is :: One hundred. The honest count says ninety-nine. They say it the way other people say a dead friend's name. \"The walking speed of stone. I only have one data point.\""
    ],
    "Bez": [
      "No Requests :: rollPlus2 :: a Steward eats what Bez gives them three shifts running without asking for anything :: Bez talks. Once. About the middle brother's appetite (two plates, every shift, and thanked the stove), and about the plate Brennig sets, which Bez fills every shift and clears full, because a man on the manifest gets fed."
    ]
  };
  const BREnnig_RETCON = `${MARKER} RETCON (bible draft 2, ruled 2026-09-22): the middle brother went into the cage shaft ON the Night the Mountain Coughed, after a dropped manifest that names the agents inside the crew and the forbidden chamber they steered it to. It was not an ordinary shift. Brennig is the THIRD brother, alive; he sets a place at the cookline every shift and will not say for whom. If a Steward puts the dropped manifest on that plate he says his brother's name once and then tells Night One as history — the family that ran the mine in the bunker years, the name over the gate, the one client, the valley turned away when there was plenty, the mountain shutting its own mouth, the hundred who caught what it let go — without ever saying the family's name is his.`;
  const BEZ = { name: "Bez", type: "npc",
    topics: "the cookline, drum-stoves, portions, tin plates, the fiddle, shift change, the miners, Brennig, Calder, Sable, the plate, seconds, the tape",
    notes: `${MARKER} PRIVATE TRUTH — Bez runs the cookline at the mouth of Khezek Tor: a welded row of drum-stoves, granite arms, no requests taken and none ever needed. VOICE: almost none. Bez serves; Bez does not narrate. A place gets made for you on the bench by somebody shoving down, not by Bez saying so. Bez is the town's metronome the way Hollis Bandy is Chuckle Creek's: the shift changes, the plates come, the fiddle is played badly and loved. GUARDED: Bez fills the plate Brennig sets every shift and clears it full, and has never once asked whose it is, because Bez knows. Bez stops serving exactly once in the whole story — when the outfit finally says the official word at the cookline — and when the comeuppance tape comes back from Coraliindra it is Bez who rigs the deck to the floodlight generator. Funny first: Bez's portions are a threat and a promise; a Steward who asks for a substitution gets the same plate, slower.`,
    secrets: SECRETS.Bez };
  const actorIds = {};
  let bez = (game.actors?.contents || []).find(a => a.name === BEZ.name);
  if (!bez) { say(`✚ CREATE actor "Bez"`); changes++; if (!DRY_RUN) bez = await Actor.create({ name: BEZ.name, type: BEZ.type }); }
  if (bez) {
    actorIds.Bez = bez.id;
    const cur = bez.getFlag(MAL, "persona") || {};
    if (!String(cur.notes || "").includes(MARKER)) {
      const next = { ...cur, topics: [String(cur.topics || "").trim(), BEZ.topics].filter(Boolean).join(", "), notes: [String(cur.notes || "").trim(), BEZ.notes].filter(Boolean).join("\n\n"), secretsRaw: [String(cur.secretsRaw || "").trim(), ...BEZ.secrets].filter(Boolean).join("\n") };
      changes++; say("✚ persona Bez +1 secret"); if (!DRY_RUN) await bez.setFlag(MAL, "persona", next);
    } else say("· ok persona Bez");
  }
  for (const [name, lines] of Object.entries(SECRETS)) {
    if (name === "Bez") continue;
    const actor = (game.actors?.contents || []).find(a => a.name === name);
    if (!actor) { say(`✗ actor "${name}" not found — secrets skipped`); continue; }
    actorIds[name] = actor.id;
    const cur = actor.getFlag(MAL, "persona") || {};
    const raw = String(cur.secretsRaw || "");
    const fresh = lines.filter(l => !raw.includes(l.split("::")[0].trim()));
    const next = { ...cur }; let touched = false;
    if (fresh.length) { next.secretsRaw = [raw.trim(), ...fresh].filter(Boolean).join("\n"); touched = true; }
    if (name === "Brennig Tamsin" && !String(cur.notes || "").includes(MARKER)) { next.notes = [String(cur.notes || "").trim(), BREnnig_RETCON].filter(Boolean).join("\n\n"); touched = true; }
    if (!touched) { say(`· ok persona ${name}`); continue; }
    changes++; say(`✚ persona ${name} +${fresh.length} secret(s)${name === "Brennig Tamsin" ? " + retcon" : ""}`);
    if (!DRY_RUN) await actor.setFlag(MAL, "persona", next);
  }
  for (const n of ["Doc Vess Greeley"]) { const a = (game.actors?.contents || []).find(x => x.name === n); if (a) actorIds[n] = a.id; }
  const sp = (n) => actorIds[n] || null;

  // ── 2. registry ────────────────────────────────────────────────────────────
  let questsRaw = game.settings.get(NS, "quests"); const questsWasStr = typeof questsRaw === "string";
  const quests = questsWasStr ? JSON.parse(questsRaw) : foundry.utils.deepClone(questsRaw || {});
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  let questsChanged = false;
  if (!quests[Q_WORD]) {
    quests[Q_WORD] = { id: Q_WORD, v: 1, name: "Khezek-Tor — The Official Word", status: "active", campaignId,
      description: "Nobody from the outfit has said a word about the Night the Mountain Coughed. Not then, not since. The crews stopped waiting a year ago, which is worse than waiting. You are the outfit. Find the manifest the middle brother went down for, open the room Doc Greeley keeps clean, ask Brennig whose plate that is, and then say it out loud at the cookline.",
      tags: [], createdTs: Date.now(), updatedTs: Date.now() };
    questsChanged = true; changes++; say("✚ quest registered: Khezek-Tor — The Official Word");
  } else say("· ok quest (already) The Official Word");

  // ── 3. beats ───────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of ["khezek_tor_quest_scene", "khezek_tor_the_lift_hall", "khezek_tor_the_brace", "khezek_tor_the_maw", "khezek_tor_town_walk", "khezek_hex_settles"]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — Khezek-Tor was never seeded here.`);
  const sceneOf = (...ids) => { for (const id of ids) { const b = byId.get(id); const s = b?.sceneId || b?.cinematic?.startSceneId; if (s) return String(s).replace(/^Scene\./, ""); } return null; };
  const SC = { brace: sceneOf("khezek_tor_the_brace", "khezek_tor_drax_calder_convo"), lift: sceneOf("khezek_tor_the_lift_hall"), maw: sceneOf("khezek_tor_the_maw"), cookline: sceneOf("khezek_tor_town_walk", "khezek_tor_quest_scene"), waiting: sceneOf("allesh_gilliam_waiting_room_intro") };

  const TAGS = "khezek_tor official_word story";
  const CH = { quest: KEY, chapter: "the_official_word" };
  const beat = (id, label, description, { type = "dialog", speaker = null, choices = null, receipts = null, story = null, requires = null, timePoints = 0, priority = "background", memoryText = null, questEffects = null, factionEffects = null, scene = null, offer = true } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId: Q_WORD, tags: TAGS, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority,
    ...(scene ? { sceneId: scene } : {}),
    ...(speaker ? { speakerActorId: speaker } : {}),
    ...(offer === false ? { dialogueOffer: false } : {}),   // a routing-only node: never a conversation moment
    story: story || CH,
    ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(receipts ? { receipts } : {}), ...(questEffects ? { questEffects } : {}), ...(factionEffects ? { factionEffects } : {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });
  const P2 = { flag: "storyPhase", gte: 2 };
  const ACTIVE = [P2, { questBucket: Q_WORD, is: "active" }];
  // the endings are reached ONLY by kt_official_word's choices (a route never consults inject.requires); these gates keep the Director
  // and the conversation surface from offering them before the cookline scene has happened
  const GATE_THIN = [...ACTIVE, { beatMark: "kt_official_word" }];
  const GATE_GIVEN = [...GATE_THIN, { beatMark: "kt_dropped_manifest" }, { beatMark: "kt_back_room_roster" }];
  const NO_OFFER = ["kt_official_word_open_fail", "kt_brennig_desk_fail", "kt_cage_shaft_fail", "kt_good_room_fail", "kt_official_word_given", "kt_official_word_thin"];
  const AG_HEX = "Allesh-Gilliam", KT_GOOD_ROOM = ["kt_good_room", "kt_good_room_fail", "kt_back_room_roster"];
  const COALITION = ["6H5Grt3HybAs1rSq", "eIXghZ73hKSXmP3x"];
  const fx = (morale = 0, loyalty = 0) => COALITION.map(factionId => ({ factionId, moraleDelta: morale, loyaltyDelta: loyalty, unityDelta: 0, darknessDelta: 0, opDeltas: {}, allowOvercap: false }));

  const NEW = [
    beat("kt_official_word_open", "Khezek-Tor — Nobody Said Anything",
      "Calder doesn't look up. \"Nobody from the outfit said a word. Not after the Cough, not since. The crews stopped waiting a year ago, which is worse than waiting.\" He hands you the shift list from that night without being asked. Three names are missing from it, and the paper has been folded around the gap so many times the gap has a shine.",
      { speaker: sp("Drax Calder"), scene: SC.brace, priority: "high", story: { ...CH, role: "start" },
        requires: [P2, { beatMark: "khezek_tor_quest_scene" }, { questBucket: Q_WORD, isNot: "completed" }],
        questEffects: [{ action: "accept", questId: Q_WORD, beatId: "", state: "active", text: "Nobody from the outfit has said a word since the Cough. You are the outfit." }],
        choices: [
          ch("\"What do the crews need to hear first?\"", "", { description: "\"That somebody knows. Start there.\"" }),
          ch("Ask about the three missing names.", "", { checkStat: "mind", checkDC: 12, failNext: "kt_official_word_open_fail", description: "He names none of them. He names where the paper was folded: around the men who weren't on the shift and were in the gallery anyway." }),
          ch("Sit down.", "", { description: "He stops working. He stops talking. The two are the same thing. You stand back up." })
        ] }),
    beat("kt_official_word_open_fail", "Khezek-Tor — A Number on the Board",
      "Calder writes a number on the board. It is not an answer. It is tonnage. He goes back to work, and so does the mountain, and the shift list goes back into his pocket folded around its gap.",
      { type: "narration", speaker: sp("Drax Calder"), scene: SC.brace, requires: ACTIVE, offer: false, choices: [ch("Watch him work.", "", { description: "He talks again, about the Brace. Not about the list." })] }),
    beat("kt_brennig_desk", "Khezek-Tor — Brennig's Desk",
      "Two pallets and a door, and on it the whole mountain's paperwork in a hand that gets neater the worse the news is. Brennig is counting crates aloud, which is what he does instead of the subject. \"Nine. Ten. Don't mind me. Eleven.\"",
      { speaker: sp("Brennig Tamsin"), scene: SC.lift, requires: ACTIVE, choices: [
        ch("Help him count.", "", { checkStat: "mind", checkDC: 12, failNext: "kt_brennig_desk_fail", description: "The second crate hums. He tells you the ore is proud, and why, and does not know whose family he is talking about." }),
        ch("Ask about the middle brother.", "", { description: "Once, as a joke: the cage shaft, the dropped manifest, the night the mountain coughed. \"Technically still on the manifest.\" He does not tell it again." }),
        ch("Ask where the manifest is.", "", { description: "\"Below Four. Where he left it. Sable's the only one who goes below Four.\"" })
      ] }),
    beat("kt_brennig_desk_fail", "Khezek-Tor — Starting Again at One",
      "You lose count at nine. He starts again at one, out loud, without a flicker of impatience, and it is the most patient thing you have seen anyone do in this world, and you understand that he has had practice.",
      { type: "narration", speaker: sp("Brennig Tamsin"), scene: SC.lift, requires: ACTIVE, offer: false, choices: [ch("Count with him.", "", { description: "Eleven. You get there." })] }),
    beat("kt_cage_shaft", "Khezek-Tor — Below Four",
      "Sable brings two chairs, which is how you know they've decided to like you. The cage shaft is a square of dark with a rope down it and a chart pinned beside it with one mark that has never moved. \"It's down there,\" Sable says. \"It has been down there the whole time. Nobody goes below Four except me, and I don't touch things. Charting isn't touching.\"",
      { speaker: sp("Sable Nine"), scene: SC.maw, requires: [...ACTIVE, { beatMark: "kt_brennig_desk" }], choices: [
        ch("Climb down with the rope.", "kt_dropped_manifest", { checkStat: "body", checkDC: 12, failNext: "kt_cage_shaft_fail", description: "Four rungs below Four the rope goes slack in your hands and there is a hand, and in the hand, paper." }),
        ch("Read the chart first.", "kt_dropped_manifest", { checkStat: "mind", checkDC: 12, failNext: "kt_cage_shaft_fail", description: "The chart says where the cage stopped that night, to the rung. Sable has never told anyone that they know." }),
        ch("Send the cage down empty.", "kt_dropped_manifest", { description: "It comes back up with the manifest on its floor. Nobody put it there. Sable goes very still and writes down the time." })
      ] }),
    beat("kt_cage_shaft_fail", "Khezek-Tor — Better Rope",
      "\"We come back with better rope,\" Sable says, coiling it. \"The mountain isn't going anywhere, which is the one thing I can promise about it.\" They fold the second chair. They leave the first one, for next time.",
      { type: "narration", speaker: sp("Sable Nine"), scene: SC.maw, requires: ACTIVE, offer: false, choices: [ch("Come back with better rope.", "kt_cage_shaft")] }),
    beat("kt_dropped_manifest", "Khezek-Tor — The Dropped Manifest",
      "Ore counts, in Brennig's hand, for a shift two years gone. Under them, a second list in a different hand: names, and beside the names a chamber number, and beside the chamber number, in a third hand that pressed hard, FORBIDDEN. The middle Tamsin brother went down for this. He is, technically, still holding it.",
      { type: "narration", scene: SC.maw, priority: "high", requires: ACTIVE,
        receipts: [{ label: "The Dropped Manifest", effectKey: "rollPlus2", acquisition: "earned", source: { name: "the cage shaft below Four, in a dead hand" },
          truth: "The manifest the middle Tamsin brother went down for on the Night the Mountain Coughed. Under the ore counts, a second list in a different hand: the agents inside the crew, and the chamber they steered it to, marked FORBIDDEN in someone else's. Produce it at the cookline and the outfit has something to say; send it east through the gate and Coraliindra owes the mountain a video." }],
        choices: [ch("Bring it up.", "")] }),
    beat("kt_good_room", "Khezek-Tor — The Good Room",
      "The Waiting Room's back room has been shut since the Cough, and it is the cleanest room in three hexes, and Doc Greeley does not look at the door. She never has to. The bar comes to her, and so do you.",
      { speaker: sp("Doc Vess Greeley"), scene: SC.waiting, requires: [...ACTIVE, { beatMark: "kt_dropped_manifest" }], choices: [
        ch("Ask what the room is FOR now.", "kt_back_room_roster", { checkStat: "presence", checkDC: 12, failNext: "kt_good_room_fail", description: "\"A rematch.\" She takes the key off the hook under the good whiskey." }),
        ch("Put the manifest on the bar.", "kt_back_room_roster", { description: "She reads it twice. Then she opens the room herself, and you understand that she has been waiting for someone to bring her a reason." }),
        ch("Joke about the room.", "kt_good_room_fail", { description: "She ejects you. Politely. Once." })
      ] }),
    beat("kt_good_room_fail", "Khezek-Tor — The Room Stays Shut",
      "She pours. Whatever it is, it is exactly the right thing for whoever you are, which is her whole trick. The room stays shut. \"Ask better,\" she says, not unkindly, \"or bring me something to read.\"",
      { type: "narration", speaker: sp("Doc Vess Greeley"), scene: SC.waiting, requires: ACTIVE, offer: false, choices: [ch("Drink what she poured.", "", { description: "It's a sprain, not a break." })] }),
    beat("kt_back_room_roster", "Khezek-Tor — The Back-Room Roster",
      "In the drawer under the suture kit, in her prescription hand: who was hurt on the Night the Mountain Coughed, in order, with what she did for each. And one man she treated who was not on the shift list at all. Cross it against the dropped manifest and the same name is on both, in different hands.",
      { type: "narration", scene: SC.waiting, priority: "high", requires: ACTIVE,
        receipts: [{ label: "The Back-Room Roster", effectKey: "rollPlus2", acquisition: "earned", source: { name: "Doc Greeley, from the drawer under the suture kit" },
          truth: "Who was hurt on the Night the Mountain Coughed, in Doc Greeley's prescription hand, and one man who was not on the shift list at all. Cross it against the dropped manifest and the same name is on both. Convinces Calder that the chamber was steered; pays the folder marked OWED." }],
        choices: [ch("Fold it into the manifest.", "")] }),
    beat("kt_place_setting", "Khezek-Tor — The Place Setting",
      "Shift change. Bez serves without looking up. Brennig sets a place on the bench — a tin plate and a cup — and Bez fills it, and nobody sits there, and nobody comments, and this has clearly been happening every shift for a long time. \"A man on the manifest gets fed,\" Brennig says, when he sees you looking. That is all he will say about it.",
      { speaker: sp("Brennig Tamsin"), scene: SC.cookline, priority: "high", timePoints: 1, requires: [...ACTIVE, { beatMark: "kt_brennig_desk" }], choices: [
        ch("Ask whose place it is.", "", { description: "\"A man on the manifest gets fed.\" He won't say more. Bez clears the plate, full." }),
        ch("Put the dropped manifest on the plate.", "", { requires: { beatMark: "kt_dropped_manifest" }, description: "He reads his brother's name off it and says it once, the way Sable says ninety-nine. Then he tells Night One as history: the family that ran the mine in the bunker years, the name over the gate, the one client, the valley turned away when there was plenty, the mountain shutting its own mouth, the hundred who agreed to catch what it let go. He does not say the family's name is his. He doesn't have to." }),
        ch("Say nothing and eat.", "", { description: "Bez gives you seconds. Brennig eats too. The plate stays." })
      ] }),
    beat("kt_official_word", "Khezek-Tor — The Official Word",
      "Bez stops serving, which has never happened. Calder puts down the chalk. The cookline is full and quiet, and the mountain, which hears everything said at its mouth, is quiet too.",
      { speaker: sp("Drax Calder"), scene: SC.cookline, priority: "high", timePoints: 1, requires: [...ACTIVE, { beatMark: "kt_place_setting" }], choices: [
        ch("Say it, with the manifest and the roster in your hands.", "kt_official_word_given", { requires: [{ beatMark: "kt_dropped_manifest" }, { beatMark: "kt_back_room_roster" }] }),
        ch("Say it with what you have.", "kt_official_word_thin"),
        ch("Let Calder say it.", "", { description: "\"Not my job. Never was.\" He waits. So does everyone." })
      ] }),
    beat("kt_official_word_given", "Khezek-Tor — The Word, Given",
      "The outfit says it. The chamber was forbidden and somebody knew. The crew was steered, and the men who steered it are named, here, out loud, off a manifest a dead man carried and a roster a doctor kept. The receipts go east through the gate tonight. Nobody cheers. Calder picks the chalk back up and underlines the date on the board, once, and around here that is a medal. Bez serves.",
      { type: "narration", speaker: sp("Drax Calder"), scene: SC.cookline, priority: "high", timePoints: 1, story: { ...CH, role: "ending", ending: "given" }, requires: GATE_GIVEN, offer: false,
        memoryText: "The Stewards said the official word at the cookline of Khezek-Tor with the dropped manifest and the back-room roster in their hands. The crews heard it. Calder underlined it. The receipts went east.",
        questEffects: [{ action: "complete", questId: Q_WORD, beatId: "", state: "completed", text: "The official word, given — with receipts. The Cough has a cause and names." }],
        factionEffects: fx(1, 1), choices: [ch("Eat what Bez gives you.", "")] }),
    beat("kt_official_word_thin", "Khezek-Tor — The Word, Thin",
      "The outfit says it knows. It does not say what it knows, because it doesn't, not yet, not with anything in its hands. The crews nod the way you nod at weather. Calder writes nothing on the board. Bez starts serving again, which is a kindness, and everyone takes it as one.",
      { type: "narration", speaker: sp("Drax Calder"), scene: SC.cookline, timePoints: 1, story: { ...CH, role: "ending", ending: "thin" }, requires: GATE_THIN, offer: false,
        memoryText: "The Stewards said the outfit knew, at the cookline, with nothing in their hands. The crews nodded like weather.",
        questEffects: [{ action: "complete", questId: Q_WORD, beatId: "", state: "completed", text: "The official word, thin — said without receipts." }],
        factionEffects: fx(-1, 0), choices: [ch("Eat anyway.", "")] }),
    beat("kt_comeuppance_tape", "Khezek-Tor — The Comeuppance Tape",
      "It comes back by return gate in a padded envelope with a Coraliindra postmark, and it is, of course, a tape. Bez rigs a deck to the floodlight generator and the whole mountain watches at the cookline, in shifts, twice. Nobody cheers. Somebody laughs, once, at the part with the stairs. Calder underlines the date on the board. The Cough is closed.",
      { type: "narration", speaker: sp("Bez"), scene: SC.cookline, priority: "high",
        requires: [P2, { questBucket: Q_FINALE, is: "completed" }, { beatMark: "kt_official_word_given" }],
        receipts: [{ label: "The Comeuppance Tape", effectKey: "rollPlus2", acquisition: "earned", source: { name: "Coraliindra, by return gate" }, truth: "The official word, answered. The men who steered the crew to the forbidden chamber, on tape, getting what they had coming, watched by the whole mountain at the cookline. The outfit is forgiven. The Cough is closed." }],
        memoryText: "The comeuppance tape came back from Coraliindra and Khezek-Tor watched it together at the cookline.",
        factionEffects: fx(2, 0), choices: [ch("Watch it again.", "", { description: "The part with the stairs is better the second time." })] })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  // speakers on the speakerless
  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  // reconcile beats seeded before the 2026-10-01 review fixes: add the missing gate conditions (never remove any) + the offer opt-out
  const ensureReq = (b, conds) => { b.inject = b.inject || {}; const cur = Array.isArray(b.inject.requires) ? b.inject.requires.slice() : (b.inject.requires && typeof b.inject.requires === "object" ? [b.inject.requires] : []); const have = new Set(cur.map(c => JSON.stringify(c))); for (const c of conds) if (!have.has(JSON.stringify(c))) { cur.push(c); have.add(JSON.stringify(c)); } b.inject.requires = cur; };
  edit("kt_official_word_given", b => ensureReq(b, GATE_GIVEN), "gated on the cookline scene + both receipts");
  edit("kt_official_word_thin", b => ensureReq(b, GATE_THIN), "gated on the cookline scene");
  for (const id of NO_OFFER) edit(id, b => { if (b.dialogueOffer !== false) b.dialogueOffer = false; }, "dialogueOffer:false (routing-only)");
  // REVIEW 2026-10-01 (MEDIUM): the Good Room is Doc Greeley's Waiting Room in ALLESH-GILLIAM — with no `where`, placeOf put these three on the
  // KT quest hex, so NOW said "at Khezek-Tor" and the location guard refused them in AG. (patch-template-review-fixes-b-2026-10-01 does the same live.)
  for (const id of KT_GOOD_ROOM) edit(id, b => { if (!b.where) b.where = AG_HEX; }, `where: ${AG_HEX}`);
  const voice = (ids, name) => { for (const id of ids) edit(id, b => { if (!b.speakerActorId && sp(name)) b.speakerActorId = sp(name); }, `speaker ${name}`); };
  voice(["khezek_tor_the_lift_hall", "khezek_tor_darkness_shipment_quest_acceptance"], "Brennig Tamsin");
  voice(["khezek_tor_the_brace", "khezek_tor_drax_calder_convo_1", "khezek_tor_drax_calder_convo_2", "khezek_tor_drax_calder_convo_3", "khezek_tor_drax_calder_convo_echo", "khezek_tor_mine_that_answered_back_quest_acceptance", "khezek_brace_groans"], "Drax Calder");
  voice(["khezek_tor_the_maw", "khezek_tor_sable_nine_convo_1", "khezek_tor_sable_nine_convo_2", "khezek_tor_sable_nine_convo_3", "khezek_tor_sable_nine_convo_echo", "khezek_sink_widens"], "Sable Nine");
  voice(["khezek_tor_town_walk"], "Bez");
  voice(["khezek_compound_cough"], "Doc Vess Greeley");

  // ── 4. story script ────────────────────────────────────────────────────────
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {}, scripts: {} };
  const codeQuest = code.quests?.[KEY], codeScript = code.scripts?.[KEY];
  if (!codeQuest || !codeScript) say("✗ code story for khezek_tor not readable — story script NOT written (hard-reload and re-run)");
  const QUEST = codeQuest ? { ...codeQuest, chapters: { ...(codeQuest.chapters || {}), the_official_word: { name: "The Official Word", registryId: Q_WORD } } } : null;
  const SCRIPT = codeScript ? JSON.parse(JSON.stringify(codeScript)) : null;
  if (SCRIPT) {
    const W = "the_official_word";
    const add = [
      { id: "nobody", label: "Nobody Said Anything", group: "word", chapter: W, line: "Nobody from the outfit has said a word since the Cough. You are the outfit. Calder will talk while he works; do not sit down.", beats: ["kt_official_word_open"] },
      { id: "desk", label: "Brennig's Desk", group: "word", chapter: W, line: "Two pallets and a door. Count the crates with him. Ask about the middle brother once, and only once.", beats: ["kt_brennig_desk"] },
      { id: "shaft", label: "Below Four", group: "word", chapter: W, line: "The manifest is in the cage shaft where the middle brother left it. Sable has rope. Bring your own chair.", beats: ["kt_cage_shaft"], done: { mark: "kt_dropped_manifest" } },
      { id: "room", label: "The Good Room", group: "word", chapter: W, line: "Doc Greeley's back room has been shut since the Cough. Ask what it's FOR. Don't joke in there.", beats: ["kt_good_room"], done: { mark: "kt_back_room_roster" } },
      { id: "place", label: "The Place Setting", group: "word", chapter: W, line: "There are more plates at the cookline than brothers. Ask Brennig whose. Then put the manifest on it.", beats: ["kt_place_setting"] },
      // id `oword`, NOT `word`: the code script already has a step `word` ("Word from the Mountain") and the clash dropped this one (review 2026-09-30)
      { id: "oword", label: "The Official Word", group: "word", chapter: W, line: "Say it out loud at the cookline, with the receipts in your hands. The mountain gets to hear it too.", beats: ["kt_official_word"], done: { anyOf: ["kt_official_word_given", "kt_official_word_thin"] } }
    ];
    // already there = same id OR already plays one of the step's beats (an id clash must never silently drop a step again)
    const has = (st) => SCRIPT.steps.some(s => s.id === st.id || (s.beats || []).some(b => (st.beats || []).includes(b))); const fresh = add.filter(st => !has(st));
    const at = SCRIPT.steps.findIndex(s => s.id === "squares"); if (at >= 0) SCRIPT.steps.splice(at, 0, ...fresh); else SCRIPT.steps.push(...fresh);
    SCRIPT.chapters = { ...(SCRIPT.chapters || {}), [W]: { giver: "Foreman Calder, who has said nothing official since the Cough", line: "Nobody from the outfit has said a word since the Cough. You are the outfit. Go and be the word." } };
    SCRIPT.after = Array.from(new Set([...(SCRIPT.after || []), "kt_comeuppance_tape"]));
    // the Seal step is a pure hand-off with no beats (lint Y03) — it borrows the Seal quest's opener so the Log has somewhere to point
    const seal = SCRIPT.steps.find(s => s.id === "seal"); if (seal && !(seal.beats || []).length && byId.get("khezek_tor_valhaulan_seal_quest_acceptance")) { seal.beats = ["khezek_tor_valhaulan_seal_quest_acceptance"]; seal.borrow = true; }
    const doorLine = { calder: "Calder talks while he works. Ask how deep it goes. If you sit down he stops, so don't.", lift: "Brennig runs the crates from a desk built out of two pallets and a door. Count the places at the cookline on your way in." };
    for (const d of (SCRIPT.doors || [])) if (doorLine[d.id]) d.line = doorLine[d.id];
  }
  const haveData = storyApi?.get?.(campaignId) || {};
  // keep `after` entries other seeders appended to the live data script (Maneuver Vault adds kt_pulled_files_filed) — re-runs must not drop them
  if (SCRIPT && Array.isArray(haveData.scripts?.[KEY]?.after)) SCRIPT.after = Array.from(new Set([...(SCRIPT.after || []), ...haveData.scripts[KEY].after]));
  const questChanged = QUEST && JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST);
  let scriptChanged = SCRIPT && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || questChanged);
  // REVIEW 2026-10-01: never clobber live story data edited after seeding (✦ Script editor, a wordsmithing pass, a dated patch macro). Write only
  // when the live quest+script are missing, still the plain code copy, or already this output; anything else is reported and left alone.
  { const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null), lS = haveData.scripts?.[KEY], lQ = haveData.quests?.[KEY];
    if (scriptChanged && !((!lS || same(lS, codeScript) || same(lS, SCRIPT)) && (!lQ || same(lQ, codeQuest) || same(lQ, QUEST)))) { scriptChanged = false; say(`⚠ story script ${KEY}: live campaign.story was edited after seeding — NOT overwritten (repair seeded worlds with the dated patch-*-review-fixes macros)`); } }
  if (scriptChanged) { changes++; say(`✦ story script khezek_tor → campaign.story (${SCRIPT.steps.length} steps, chapters: ${Object.keys(QUEST.chapters).join("/")}, after +tape)`); } else if (SCRIPT) say("· ok story script (already)");

  console.log(`[seed-khezek-tor-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Khezek-Tor retrofit DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Khezek-Tor retrofit: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-kt-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (questsChanged) await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(quests) : quests);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  ui.notifications.info(`Khezek-Tor retrofit APPLIED: ${changes} change(s). A man on the manifest gets fed. F5.`);
})();

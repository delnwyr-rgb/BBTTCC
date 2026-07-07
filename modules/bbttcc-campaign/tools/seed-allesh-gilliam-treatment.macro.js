/* seed-allesh-gilliam-treatment.macro.js — the front door gets the treatment (2026-07-04)
 *
 * Owner-locked design (allesh-gilliam-treatment-2026-07-04.md):
 *  • THE MISFIRE — "the Night the Mountain Coughed": gate flicker + East Wall bow
 *    + Khezek Tor seal misfire are ONE remembered event. Text patches carry it;
 *    the Seal arc explains it; new beat `allesh_gilliam_wall_stands_straight`
 *    (chain misfire_echoes, gated Seal completed) pays it off.
 *  • NEW PLACES — The Waiting Room (bar, Doc Vess Greeley), The Vacancy (inn,
 *    Verna Tulliver), The Plumb Office (Aldous Plumb), The Muster (militia post,
 *    Captain Ondine Brakk — populates when the militia is founded).
 *  • Joan stays a one-shot cinematic. East Wall = clean win + later payoff.
 *
 * WHAT IT DOES: speaker/invite/memory wiring on the four hubs · dialogueOffer:false
 * on routing + Q&A leaves (text retires into dossier — companion seeder) · accepts
 * (AG at the hub, Fixit+Stabilizer at Pike) + gates (fixit acceptance {AG active})
 * · Etta DC20 fail-route beat · misfire text patches · autoplay strips + the
 * tamsin_3 wrong-file fix · 8 new beats · militia quest registered + founded by
 * the bandit-ambush "set them free" beat.
 *
 * DRY_RUN default true; idempotent (markers/fill-if-empty); backs up settings
 * before writing. Speakers/actors resolve BY NAME at run time — re-run after
 * minting Greeley/Verna/Plumb/Brakk to wire them. Scene ids for the new places
 * are left null — fill after the DA maps are built (SCENE_IDS map below).
 * Companion: bbttcc-mal-voice/tools/seed-allesh-gilliam-dossier.macro.js
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const Q = {
    ag: "quest_Cq1v3hJpXarX5rXJ", fixitMain: "quest_nrkJabUwZOLAJFYn",
    stabilizer: "quest_bSwOIWzxqNBwJ5NM", seal: "quest_AL1aIXiljxPUBH2e",
    militia: "quest_ag_town_militia"
  };
  // Fill these after the DA maps are built, then re-run (fill-if-empty).
  const SCENE_IDS = {
    allesh_gilliam_waiting_room_intro: "WchFqHWIovECCDxO",   // the_waiting_room_interior (exterior: VPMfSzU6gXHJRHYU)
    allesh_gilliam_vacancy_intro: "5hxWnWm1sawwC3Ch",        // the_vacancy_interior (exterior: KPLUoTAwkztyVbsH)
    allesh_gilliam_plumb_office_intro: "gYuClWDbCpP4RR79",   // plumbs_tower
    allesh_gilliam_muster_intro: "SisPLxE9OQBY4H4E"        // the_muster
  };

  const SPEAKERS = {
    pike: ["Yarrow Pike", "Marshall Yarrow", "Marshall Pike"],
    tamsin: ["Father Tamsin", "Tamsin"],
    etta: ["Etta Bloom"],
    greeley: ["Doc Vess Greeley", "Vess Greeley", "Doc Greeley"],
    verna: ["Verna Tulliver"],
    plumb: ["Aldous Plumb"],
    brakk: ["Ondine Brakk", "Captain Ondine Brakk"]
  };
  const findActor = (cands) => {
    for (const n of cands) {
      const a = game.actors.find(x => String(x.name).trim().toLowerCase() === n.toLowerCase());
      if (a) return a;
    }
    return null;
  };
  const A = Object.fromEntries(Object.entries(SPEAKERS).map(([k, v]) => [k, findActor(v)]));

  const mkBeat = (o) => ({
    id: o.id, label: o.label, type: o.type || "skill_scene", timeScale: "scene",
    tags: o.tags || "", politicalTags: "",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: !!o.repeatable, oncePerHex: false, promptGM: "inherit",
      fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit",
      requires: o.requires || [] },
    actors: [], choices: o.choices || [],
    encounter: { key: "", tier: null, actorName: "" },
    worldEffects: { territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null,
      turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [],
      questEffects: o.questEffects || [] },
    description: o.description, questId: o.questId || Q.ag, questStep: null,
    questRole: o.questRole ?? null,
    targetHexUuid: null, turnNumber: 1,
    cinematic: { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null },
    journal: { enabled: false, entryId: null, force: false },
    unlocks: { maneuvers: [], strategics: [] }, timePoints: null,
    ...(o.sceneId ? { sceneId: o.sceneId } : {}),
    ...(o.storyChain ? { storyChain: o.storyChain } : {}),
    ...(o.speakerActorId ? { speakerActorId: o.speakerActorId } : {}),
    ...(o.inviteText ? { inviteText: o.inviteText } : {}),
    ...(o.memoryText ? { memoryText: o.memoryText } : {}),
    ...(o.dialogueOffer === false ? { dialogueOffer: false } : {})
  });

  // ── declarative plan ────────────────────────────────────────────────────────
  // speaker + inviteText + memoryText on EXISTING beats (fill-if-empty)
  const WIRE = [
    { id: "allesh_gilliam_introduction_to_hq", speaker: A.pike,
      inviteText: "Marshal Pike is at the map table, and wants the new variable to look at the board." },
    { id: "allesh_gilliam_father_tamsin_conversation", speaker: A.tamsin,
      inviteText: "Father Tamsin keeps a chair where no one is measured, and the kettle warm." },
    { id: "allesh_gilliam_etta_bloom_conversation", speaker: A.etta,
      inviteText: "Etta Bloom has stopped pretending you're here for grain prices." },
    { id: "allesh_gilliam_east_wall_success", speaker: A.pike,
      memoryText: "The new Stewards took the East Wall bow seriously and fixed it clean. One visible promise, finished. People noticed." },
    { id: "allesh_gilliam_east_wall_failure", speaker: A.pike,
      memoryText: "The Stewards' first swing at the East Wall went wide. The section still bows. Filed under 'unproven — still neutral, barely.'" },
    { id: "allesh_gilliam_etta_bloom_convo_exit", speaker: A.etta,
      memoryText: "Told the Stewards the whole shape of it — Valhaulans inside the sink, seal turned outward — and put the sigil in their hands. Restore, redirect, or break: now it's their ledger." }
  ];

  // routing-only + retired Q&A leaves → dialogueOffer:false
  const NO_OFFER = [
    "allesh_gilliam_quest_hub_1", "allesh_gilliam_marshall_yarrow_convo",
    "allesh_gilliam_st_gilliams_intro",
    "allesh_gilliam_marshall_yarrow_convo_1", "allesh_gilliam_marshall_yarrow_convo_2",
    "allesh_gilliam_marshall_yarrow_convo_3", "allesh_gilliam_marshall_yarrow_convo_4",
    "allesh_gilliam_marshall_yarrow_echo",
    "allesh_gilliam_father_tamsin_conversation_1", "allesh_gilliam_father_tamsin_conversation_2",
    "allesh_gilliam_father_tamsin_conversation_3", "allesh_gilliam_father_tamsin_conversation_4",
    "allesh_gilliam_etta_bloom_conversation_what_doing", "allesh_gilliam_etta_bloom_conversation_protecting",
    "allesh_gilliam_etta_bloom_conversation_hesitate", "allesh_gilliam_etta_bloom_conversation_echo"
  ];

  // accepts on existing beats
  const ACCEPTS = [
    { beatId: "allesh_gilliam_quest_hub_1", questId: Q.ag, text: "Three hexes. A fortress, a farm, and a hole in the ground. Start by keeping one promise." },
    { beatId: "allesh_gilliam_introduction_to_hq", questId: Q.fixitMain, text: "Pike sent you to Furrier's Fixit — probably good you know them." },
    { beatId: "allesh_gilliam_introduction_to_hq", questId: Q.stabilizer, text: "The Leygate needs a replacement stabilizer, and the Fixit Farm has the only one Pike knows of." },
    { beatId: "enc_bandit_ambush_win_free", questId: Q.militia, text: "Freed bandits, founded a militia. That's Allesh-Gilliam arithmetic." }
  ];

  // gates added to existing beats
  const GATES = [
    { beatId: "fixit_quest_acceptance", add: { questBucket: Q.ag, is: "active" } }
  ];

  // fail-route: Etta's DC20 market approach must not dead-end the Vault reveal
  const FAIL_ROUTES = [
    { beatId: "allesh_gilliam_the_long_market_intro", label: "Follow up", failNext: "allesh_gilliam_etta_brushoff" }
  ];

  // misfire text patches (marker-guarded appends; convo_exit is a REPLACE)
  const APPENDS = [
    { beatId: "allesh_gilliam_the_east_wall_intro", marker: "Night the Mountain Coughed", text:
      "\n\nAsk anyone when the bow started and you get the same answer with the same look: the Night the Mountain Coughed. Nobody's found daylight between the two. The Architect has an office and an opinion; the wall has a lean and a schedule. One of them is honest." },
    { beatId: "allesh_gilliam_east_wall_success", marker: "meeting the cause", text:
      "\n\nThe wall stands straight — properly, no theater. But fixing a symptom is not the same as meeting the cause, and the cause lives under a mountain that's been tired lately. Someday, someone should go ask it why it coughed." },
    { beatId: "allesh_gilliam_east_wall_failure", marker: "future problem", text:
      "\n\nFor what it's worth: the wall didn't beat you. Whatever leaned on it first did. That thing's still out there, under Khezek Tor, being someone's future problem. Possibly yours." }
  ];
  // as-built sign canon (owner's maps, 2026-07-06)
  APPENDS.push(
    { beatId: "allesh_gilliam_waiting_room_intro", marker: "EMERGENCY GALLEY", text:
      "\n\nThe door outside still says EMERGENCY — somebody bolted GALLEY beneath it and called the argument settled. The WAITING ROOM sign hangs inside, over the bar, where it's accurate." },
    { beatId: "allesh_gilliam_vacancy_intro", marker: "ESCAPE PODS", text:
      "\n\nThe courtyard has a pool table nobody remembers acquiring and a spray-painted assurance that THEY R OPEN. Inside, past the front desk, a sign points the way to ESCAPE PODS with the annotation: DON'T OPEN — DEAD INSIDE. Verna says it means the pods. Verna does not elaborate." },
    { beatId: "allesh_gilliam_muster_intro", marker: "GOOD VIBES ONLY", text:
      "\n\nOver the arch somebody has painted GOOD VIBES ONLY!, and beneath it, in at least three other hands: but also GUNS and SWORDS and SHOUTING. At some point bunting appeared. Nobody admits to the bunting, and Brakk has stopped asking." }
  );

  const ETTA_EXIT_MARKER = "She didn't soften it";
  const ETTA_EXIT_TEXT = "She didn't soften it. Valhaulans — not rumor, not ghost markings — inside the sink, and they've sealed it, and whatever that thing was built to hold has started to hum. The sigil is in your hand now, and so is the arithmetic she left with it: restore it and Khezek Tor keeps the burden; redirect it and you choose who pays; break it and no one owes anyone anything ever again. Markets love clarity, she said. Societies rarely survive it.";

  // audio: strip autoplay on mid-convo leaf VO (files stay as performance banks);
  // kill the wrong-file mapping on tamsin_3 (plays convo_4's mp3)
  const STRIP_AUTOPLAY = [
    "allesh_gilliam_marshall_yarrow_convo_2", "allesh_gilliam_marshall_yarrow_convo_3",
    "allesh_gilliam_marshall_yarrow_convo_4", "allesh_gilliam_marshall_yarrow_echo",
    "allesh_gilliam_father_tamsin_conversation_1", "allesh_gilliam_father_tamsin_conversation_2"
  ];
  const DISABLE_AUDIO = ["allesh_gilliam_father_tamsin_conversation_3"]; // wrong file — record convo_3 later

  // ── new beats ───────────────────────────────────────────────────────────────
  const NEW_BEATS = [
    mkBeat({
      id: "allesh_gilliam_etta_brushoff", label: "Allesh-Gilliam — Etta Decides You're Not Ready",
      dialogueOffer: false,
      choices: [{ label: "Leave", next: "allesh_gilliam_quest_hub_1", description: "", checkStat: "", checkDC: 0, failNext: "" }],
      description: "Etta looks you over one more time, and whatever she was about to say goes back on the shelf. Instead you receive: a very nice jar of preserves, a fair price, and a smile with the door left open behind it. \"Come back,\" she says pleasantly, \"when you're done pretending you're here for grain prices.\" You have been declined by a market woman and it somehow stings worse than the wall."
    }),
    mkBeat({
      id: "allesh_gilliam_wall_stands_straight", label: "Allesh-Gilliam — The Wall Stands Straight",
      storyChain: "misfire_echoes", questRole: "resolution",
      requires: [{ questBucket: Q.seal, is: "completed" }],
      description: "The town notices before the engineers do. Sometime in the night, whatever was left of the East Wall's lean just — let go. No groan, no settling, no drama. The wall stands the way walls are supposed to stand, like it never had an opinion. Down at the Waiting Room they're already saying it out loud: the wall wasn't wrong, and neither were we. It started the Night the Mountain Coughed, and it ended when somebody finally went and answered the mountain. The Architect has not commented. The Architect's office light was on very late."
    }),
    mkBeat({
      id: "allesh_gilliam_waiting_room_intro", label: "Allesh-Gilliam — The Waiting Room",
      sceneId: SCENE_IDS.allesh_gilliam_waiting_room_intro,
      choices: [{ label: "Leave", next: "allesh_gilliam_quest_hub_1", description: "", checkStat: "", checkDC: 0, failNext: "" }],
      dialogueOffer: false,
      description: "The town's old medical clinic still has its sign, and nobody has ever needed to change it: WAITING ROOM. It's the bar now. Triage chairs at the counter, the intake window where you order, and behind the good whiskey, a suture kit that still sees professional use — the light's better in here than anywhere else in town. Scratched into the counter, in several different decades of handwriting: EVERYONE ENDS UP IN THE WAITING ROOM EVENTUALLY. Doc Greeley pours like she's writing prescriptions, and the room is loud in the specific way of people who survived something together and have agreed to discuss anything else. In the back there's one room kept spotless and shut. Nobody jokes in there. Ask about anything — this is where the town's rumors come to metabolize."
    }),
    mkBeat({
      id: "allesh_gilliam_waiting_room_rumor_board", label: "Allesh-Gilliam — What the Bar Knows Tonight",
      repeatable: true, dialogueOffer: false,
      choices: [{ label: "Leave", next: "allesh_gilliam_quest_hub_1", description: "", checkStat: "", checkDC: 0, failNext: "" }],
      description: "The Waiting Room doesn't have a notice board; it has Greeley, and a clientele that pays in gossip when marks run short. Tonight's exchange rate covers: what's moving on the roads, what the caravans won't say out loud, and at least one story that starts with 'my cousin saw' and should be taken exactly that seriously. Sit long enough and the town tells you what it's worried about. (GM: fire this as the rumor surface — foreshadow chains, sightings, and side-arc hooks land here; ask Greeley in conversation and she'll deal them out in her own order.)"
    }),
    mkBeat({
      id: "allesh_gilliam_vacancy_intro", label: "Allesh-Gilliam — The Vacancy",
      sceneId: SCENE_IDS.allesh_gilliam_vacancy_intro,
      choices: [{ label: "Leave", next: "allesh_gilliam_quest_hub_1", description: "", checkStat: "", checkDC: 0, failNext: "" }],
      dialogueOffer: false,
      description: "The old highway motel sits inside the wall's elbow, one story, L-shaped, and its sign has said VACANCY since before anyone alive can contradict it. Nobody fixes the sign because the sign has never once been wrong. The rooms have names instead of numbers — THE GOOD ONE, THE OTHER GOOD ONE, THE HONEYMOON SUITE (two beds pushed together), and THE ONE WE DON'T ASK ABOUT. Verna Tulliver runs it with a guest ledger thick enough to stop small-arms fire, and she counts everything: guests in, guests out, spoons, lies. Caravans stay here. Jackalope runners stay here. Anyone the town wants watched-but-welcomed stays here, and by morning Verna knows where they're headed, usually before they do."
    }),
    mkBeat({
      id: "allesh_gilliam_vacancy_ledger", label: "Allesh-Gilliam — Verna's Ledger",
      repeatable: true, dialogueOffer: false,
      choices: [{ label: "Leave", next: "allesh_gilliam_quest_hub_1", description: "", checkStat: "", checkDC: 0, failNext: "" }],
      description: "The ledger opens with a creak that sounds intentional. Names, dates, room, direction of travel, and a private margin-code of stars and dashes Verna declines to explain. Everyone who's passed through Allesh-Gilliam with a bed and a story is in here — including the fake names, ESPECIALLY the fake names, those get a little star. (GM: this is the who-passed-through intel surface — consult Verna in conversation for travelers, caravans, Riders, and anyone the plot walked past town.)"
    }),
    mkBeat({
      id: "allesh_gilliam_plumb_office_intro", label: "Allesh-Gilliam — The Plumb Office",
      sceneId: SCENE_IDS.allesh_gilliam_plumb_office_intro,
      choices: [{ label: "Leave", next: "allesh_gilliam_quest_hub_1", description: "", checkStat: "", checkDC: 0, failNext: "" }],
      dialogueOffer: false,
      description: "The base of the old water tower is an office now, and the office is Aldous Plumb, Structural Authority (self-certified, framed, hung slightly crooked, which he will tell you is the wall's fault). Every surface is drawings of the town — precise, confident, and each one slightly wrong in a way you can't immediately name. He surveyed the East Wall three days before the Night the Mountain Coughed, and he will not re-survey it, because a second survey would imply something about the first one. \"The wall,\" he says, before you've asked anything, \"is cosmetic.\" The wall is visible through his window. It is leaning."
    }),
    mkBeat({
      id: "allesh_gilliam_muster_intro", label: "Allesh-Gilliam — The Muster",
      sceneId: SCENE_IDS.allesh_gilliam_muster_intro,
      requires: [{ questBucket: Q.militia, is: "active" }],
      choices: [{ label: "Leave", next: "allesh_gilliam_quest_hub_1", description: "", checkStat: "", checkDC: 0, failNext: "" }],
      dialogueOffer: false,
      description: "The gutted fire station by the North Gate has a new sign (a boot, nailed to the door, toe pointing at the horizon) and an old bell that works better than anything else in the building. This is the Muster — home of the Allesh-Gilliam Town Militia, founded the day the Stewards let those bandits walk and somebody decided the town should be ready for the sequel. Captain Ondine Brakk runs it: the only professional soldier in a town of enthusiastic amateurs, drilling wall rotations out of farmers, teamsters, and one extremely committed teenager. The truck doesn't run. The bell does. Brakk says that's the correct order of priorities."
    })
  ];

  // ── load + apply ────────────────────────────────────────────────────────────
  const api = game.bbttcc?.api?.campaign;
  const campaignId = api?.getActiveCampaignId?.();
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  let questsRaw = game.settings.get(NS, "quests");
  const questsWasStr = typeof questsRaw === "string";
  const quests = questsWasStr ? JSON.parse(questsRaw) : foundry.utils.deepClone(questsRaw);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  for (const k of Object.keys(A))
    report.push(A[k] ? `👤 ${k} → "${A[k].name}" (${A[k].id})` : `⚠ ${k} NOT FOUND — beats seed without speaker; re-run after minting`);

  // militia quest registration
  if (!quests[Q.militia]) {
    quests[Q.militia] = { id: Q.militia, v: 1, name: "Allesh-Gilliam — The Town Militia",
      description: "Freed bandits plus a nervous town equals a militia. The Muster is open, Captain Brakk is drilling farmers, and Allesh-Gilliam is learning the difference between a wall and the people on it.",
      tags: [], createdTs: 0, updatedTs: 0 };
    changes++; report.push(`✚ quest registered: ${Q.militia}`);
  } else report.push(`· ok (already) quest ${Q.militia}`);

  // wiring
  for (const w of WIRE) {
    const b = byId.get(w.id);
    if (!b) { report.push(`✗ MISSING BEAT ${w.id}`); continue; }
    if (w.speaker && !b.speakerActorId) { b.speakerActorId = w.speaker.id; changes++; report.push(`👤 speaker ${w.speaker.name} @ ${w.id}`); }
    if (w.inviteText && !b.inviteText) { b.inviteText = w.inviteText; changes++; report.push(`💬 inviteText @ ${w.id}`); }
    if (w.memoryText && !b.memoryText) { b.memoryText = w.memoryText; changes++; report.push(`🧠 memoryText @ ${w.id}`); }
  }
  for (const id of NO_OFFER) {
    const b = byId.get(id);
    if (!b) { report.push(`✗ MISSING BEAT ${id}`); continue; }
    if (b.dialogueOffer !== false) { b.dialogueOffer = false; changes++; report.push(`🚪 dialogueOffer:false @ ${id}`); }
  }
  for (const a of ACCEPTS) {
    const b = byId.get(a.beatId);
    if (!b) { report.push(`✗ MISSING BEAT ${a.beatId}`); continue; }
    b.worldEffects = b.worldEffects || {}; b.worldEffects.questEffects = b.worldEffects.questEffects || [];
    if (b.worldEffects.questEffects.some(e => e && e.questId === a.questId && e.action === "accept")) { report.push(`· ok (already) accept ${a.questId} @ ${a.beatId}`); continue; }
    b.worldEffects.questEffects.push({ action: "accept", questId: a.questId, beatId: "", state: "active", text: a.text });
    changes++; report.push(`✚ accept ${a.questId} @ ${a.beatId}`);
  }
  for (const g of GATES) {
    const b = byId.get(g.beatId);
    if (!b) { report.push(`✗ MISSING BEAT ${g.beatId}`); continue; }
    b.inject = b.inject || {};
    const arr = Array.isArray(b.inject.requires) ? b.inject.requires : (b.inject.requires ? [b.inject.requires] : []);
    if (arr.some(r => r && r.questBucket === g.add.questBucket && r.is === g.add.is)) { report.push(`· ok (already) gate @ ${g.beatId}`); continue; }
    arr.push(g.add); b.inject.requires = arr; changes++; report.push(`🔒 gate ${JSON.stringify(g.add)} @ ${g.beatId}`);
  }
  for (const f of FAIL_ROUTES) {
    const b = byId.get(f.beatId);
    const ch = b && (b.choices || []).find(c => String(c.label || "").trim() === f.label);
    if (!ch) { report.push(`✗ MISSING CHOICE "${f.label}" @ ${f.beatId}`); continue; }
    if ((ch.failNext || "").trim()) { report.push(`· ok (already) failNext @ ${f.beatId}`); continue; }
    ch.failNext = f.failNext; changes++; report.push(`⤳ failNext "${f.label}" → ${f.failNext} @ ${f.beatId}`);
  }
  for (const p of APPENDS) {
    const b = byId.get(p.beatId);
    if (!b) { report.push(`✗ MISSING BEAT ${p.beatId}`); continue; }
    if (String(b.description || "").includes(p.marker)) { report.push(`· ok (already) patch @ ${p.beatId}`); continue; }
    b.description = String(b.description || "") + p.text; changes++; report.push(`✎ misfire patch @ ${p.beatId}`);
  }
  { const b = byId.get("allesh_gilliam_etta_bloom_convo_exit");
    if (!b) report.push(`✗ MISSING BEAT etta convo_exit`);
    else if (String(b.description || "").includes(ETTA_EXIT_MARKER)) report.push(`· ok (already) etta exit rewrite`);
    else { b.description = ETTA_EXIT_TEXT; changes++; report.push(`✎ aftermath rewrite @ etta_bloom_convo_exit`); } }
  for (const id of STRIP_AUTOPLAY) {
    const b = byId.get(id);
    if (!b?.audio) { report.push(`✗ no audio @ ${id}`); continue; }
    if (!b.audio.autoplay) { report.push(`· ok (already) no-autoplay @ ${id}`); continue; }
    b.audio.autoplay = false; changes++; report.push(`🔇 autoplay stripped @ ${id}`);
  }
  for (const id of DISABLE_AUDIO) {
    const b = byId.get(id);
    if (!b?.audio) { report.push(`✗ no audio @ ${id}`); continue; }
    if (!b.audio.enabled) { report.push(`· ok (already) audio off @ ${id}`); continue; }
    b.audio.enabled = false; changes++; report.push(`🔇 audio DISABLED @ ${id} (wrong file — record convo_3)`);
  }
  for (const nb of NEW_BEATS) {
    const cur = byId.get(nb.id);
    if (cur) {
      if (!cur.sceneId && nb.sceneId) { cur.sceneId = nb.sceneId; changes++; report.push(`🗺 sceneId filled @ ${nb.id}`); }
      else report.push(`· ok (already) beat ${nb.id}`);
      continue;
    }
    camp.beats.push(nb); byId.set(nb.id, nb); changes++; report.push(`✚ beat ${nb.id}`);
  }

  console.log(`[seed-ag-treatment] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.warn(`DRY RUN — ${changes} change(s) staged. See console. Set DRY_RUN=false to apply.`);
  if (!changes) return ui.notifications.info("Nothing to do.");
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    saveDataToFile(JSON.stringify({ quests, campaigns: camps }, null, 2), "application/json", `ag-treatment-backup-${stamp}.json`);
  } catch (e) { console.error(e); return ui.notifications.error("Backup failed — aborting without writing."); }
  await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(quests) : quests);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s). Backup downloaded. NOTE: on this live world, run the AG quest hub once so 'accept: Allesh-Gilliam' fires (the fixit acceptance gate reads it).`);
})();

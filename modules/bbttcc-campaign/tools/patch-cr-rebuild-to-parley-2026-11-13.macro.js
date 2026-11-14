/*
 * patch-cr-rebuild-to-parley-2026-11-13.macro.js — Dave (2026-11-13): "I would like to completely rebuild the beats leading up to
 * the parley, and then yea, let's have the 3 questions be the 3 rounds for the parley." Script pasted by Dave the same day.
 *
 * THE ROAD — enc_circuit_riders_parley_approach (text unchanged) offers Approach or Leave (Observe retired). The camp keeps showing
 * up on the road until the Parley is done or the party rides past on purpose 3 times (meter crPassBy); the third pass retires the
 * quest (questEffects archive). Approaching again after the first visit goes straight to the camp.
 * MEASURED — enc_circuit_riders_parley_opening (Dave's intro) → "Allow yourselves to be measured" → enc_circuit_riders_measured
 *   (the five-voice yell; seeds each Rider's starting favor — courtFavor `set`, the dial for "disfavorable from the get go").
 * THE CAMP — enc_circuit_riders_camp (hub, evergreen): talk to Arviind / Simone / Dennis / Howard / Legansus Tal / Captain Robot,
 *   or ride on. Each person's card is their menu ("Ask something else" returns there); checks are DC 18 (Simone's mall 20), one
 *   try; a fail costs favor with that Rider (courtFavor) and ends the conversation (back to the camp). Receipts named in Dave's
 *   script are aimed at their Rider (receipt row `target`), "Punching Hard Is Kind Of Our Deal" is +1 with every observer.
 *   The "Captain Robot is a human…" question hides once the party has found the Captain.
 * THE PARLEY — Captain Robot's "We want to know why too…" → enc_circuit_riders_captain_gather → "Make your case" launches a story
 *   Parley vs the Circuit Riders on the camp POV: observers Captain Robot, Simone, Arviind, Howard, Dennis; three named rounds
 *   (Doctrine / Darkness / Witness, Dave's prompts); routes win → alliance, stalemate → neutral, loss → flagged (endings unchanged).
 * RETIRED — the old verification chain (observe, respect/humor/skepticism, pressure_*, doctrine/darkness/witness outcomes,
 *   witness request, resolution, the old crew hub + numbered talks, not_yet): inject storyPhase ≥ 99 + inject.retired; any live
 *   choice that pointed into them now exits (listed in the report).
 * The actor "Arvind" is renamed "Arviind" (Dave's spelling throughout the script — it is the observer's name in the Parley).
 * Typos fixed from the script: "the taxonomy is use" → "I use"; "if you with to know more" ×4 → "wish"; "gather then together" →
 *   "them"; "Says Simone/Arviind/Dennis/Howard" → "says"; "BLEEP BLORP BLOOP”" → "BLEEP BLORP BLOOP.”"; Simone's
 *   "Her HOOP HOOOO … ? Trails off" → "Her “HOOP HOOOO …?” trails off"; "Maybe don’t tell me
 *   how to do my job?.”" → "…my job?”"; Dennis's "So … “ he trails off" → "So …” He trails off"; "to to influence" (dropped).
 * Ember Bad Eden. globalThis.__crRebuildDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__crRebuildDry !== false;
  const report = { DRY_RUN, changed: [], repointed: [], notes: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const byId = new Map(beats.map(b => [b.id, b]));
  const P = "enc_circuit_riders_";
  const tpl = byId.get(P + "parley_opening"); if (!tpl) throw new Error("parley_opening missing");
  const CR_ID = "RgpV6bx2Olk9Z4qW";
  if (!game.actors.get(CR_ID)) throw new Error("Circuit Riders faction missing");
  const POV = "Scene.fZB6KRmOcxepxEO4";
  const FLAGS = ["playerFacing", "playerFacingDialog", "dialogPlayerFacing", "playerFacingContent", "showToPlayers"];
  const T = (...p) => p.join("\n\n");
  const RIDERS = ["Captain Robot", "Simone", "Arviind", "Howard", "Dennis"];

  // ── 0. Arvind → Arviind ───────────────────────────────────────────────────────────────────────
  const arv = game.actors.getName("Arvind");
  if (arv && !game.actors.getName("Arviind")) { report.changed.push("actor Arvind → Arviind"); if (!DRY_RUN) await arv.update({ name: "Arviind", "prototypeToken.name": "Arviind" }); }
  for (const n of RIDERS) if (!game.actors.getName(n) && !(n === "Arviind" && arv)) throw new Error(`Rider actor "${n}" missing`);

  // ── helpers ───────────────────────────────────────────────────────────────────────────────────
  const ch = (label, next, extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });
  const chk = (label, stat, dc, next, failNext, extra = {}) => ch(label, next, { checkStat: stat, checkDC: dc, failNext, requires: [{ beatMark: P + next.slice(P.length), not: true }, { beatMark: failNext, not: true }], ...extra });
  const NOT = (id) => ({ beatMark: id, not: true });
  const HAS = (id) => ({ beatMark: id });
  const fav = (npc, delta) => ({ npc, delta });
  const favAll = (delta) => RIDERS.map(n => ({ npc: n, delta }));
  const ASK = (who) => ch("Ask something else", P + who);
  const BACK = () => ch("Back to the camp", P + "camp");
  const want = new Map();
  const beat = (id, label, description, choices, { worldEffects = {}, hub = false } = {}) => {
    want.set(id, { id, label, description, choices, worldEffects, hub });
  };

  // ── 1. the road ─────────────────────────────────────────────────────────────────────────────
  const ENDS = [P + "parley_alliance", P + "parley_neutral", P + "parley_flagged"];
  const ap = byId.get(P + "parley_approach"); if (!ap) throw new Error("parley_approach missing");
  const apChoices = [
    ch("Approach", P + "parley_opening", { requires: [NOT(P + "measured")] }),
    ch("Approach", P + "camp", { requires: [HAS(P + "measured")] }),
    ch("Leave", P + "pass_by", { requires: [{ flag: "crPassBy", lte: 1 }] }),
    ch("Leave", P + "pass_by_last", { requires: [{ flag: "crPassBy", gte: 2 }] })
  ];
  const apInject = { ...(ap.inject || {}), repeatable: true, requires: [{ flag: "storyPhase", gte: 2 }, { flag: "turn", gte: 2 }, { flag: "crPassBy", lte: 2 }, ...ENDS.map(NOT)] };
  if (JSON.stringify(ap.choices) !== JSON.stringify(apChoices) || JSON.stringify(ap.inject) !== JSON.stringify(apInject)) {
    ap.choices = apChoices; ap.inject = apInject; report.changed.push("approach: Approach / Leave, repeats until done or 3 pass-bys");
  }
  beat(P + "pass_by", "Riding On",
    T("You ride on.", "Behind you, something enormous stops pretending to be under control for a moment, then remembers itself."),
    [ch("Ride on", "")], { worldEffects: { meters: [{ key: "crPassBy", delta: 1, min: 0, max: 3 }] } });
  beat(P + "pass_by_last", "Riding On, Again",
    T("You ride past the camp a third time.", "This time nobody looks up. The Circuit Riders have measured you as people who keep riding on, and they have written it down."),
    [ch("Ride on", "")], { worldEffects: { meters: [{ key: "crPassBy", delta: 1, min: 0, max: 3 }], questEffects: [{ action: "archive", questId: "quest_circuit_riders_parley", beatId: "", state: "archived", text: "You rode past the Circuit Riders one time too many." }] } });

  // ── 2. measured ─────────────────────────────────────────────────────────────────────────────
  const op = byId.get(P + "parley_opening");
  const opChoices = [ch("Allow yourselves to be measured", P + "measured")];
  if (JSON.stringify(op.choices) !== JSON.stringify(opChoices)) { op.choices = opChoices; report.changed.push("opening: one choice — Allow yourselves to be measured"); }
  beat(P + "measured", "Measured",
    T("All five of the Circuit Riders turn to you as one, open their mouths, and emit a high pitched electronic yell.",
      "Captain Robot’s yell is not electronic, but no one seems to care.",
      "“Thank you!” says Simone.", "“You are real!” says Arviind.", "“You are, in fact, EXTRA real!” says Dennis.", "“So real, man.” says Howard.",
      "They return to what they are doing."),
    [ch("Look around the camp", P + "camp")],
    // Starting favor — the dial for "disfavorable from the get go" (Dave 2026-11-13). Dennis is busy with a toe.
    { worldEffects: { courtFavor: [{ npc: "Captain Robot", set: 0 }, { npc: "Simone", set: 0 }, { npc: "Arviind", set: 0 }, { npc: "Howard", set: 0 }, { npc: "Dennis", set: -1 }] } });

  // ── 3. the camp ─────────────────────────────────────────────────────────────────────────────
  beat(P + "camp", "The Circuit Rider Camp",
    T("The Circuit Riders have gone back to measuring.",
      "Arviind is arguing with a blade of grass. Simone is HOOPing at the treeline. Dennis is hitting a giant toe with a hammer. Howard is looking at his hands. Over all of it looms Legansus Tal, enormous and anxious.",
      "Captain Robot is nowhere in sight."),
    [ch("Talk to Arviind", P + "arviind"), ch("Talk to Simone", P + "simone"), ch("Talk to Dennis", P + "dennis"), ch("Talk to Howard", P + "howard"),
     ch("Talk to Legansus Tal", P + "legansus"), ch("Look for Captain Robot", P + "captain"), ch("Ride on", "")], { hub: true });
  beat(P + "legansus", "Legansus Tal", "Legansus Tal does not want to talk to you.", [BACK()], { hub: true });

  const CAPTAIN_Q = "Captain Robot is a human, not a Circuitborn, right partner? He’s not a robot?";
  const capQ = (who, failDelta) => {
    beat(P + who + "_control", "Our Control", "“Our leader is our Control. Speak with him if you wish to know more.”", [ASK(who), BACK()]);
    beat(P + who + "_control_fail", "Our Leader Speaks for Himself", "“Have you even spoken with him? Our leader speaks for himself.”", [BACK()],
      { worldEffects: failDelta ? { courtFavor: [fav(who === "arviind" ? "Arviind" : who[0].toUpperCase() + who.slice(1), failDelta)] } : {} });
    return { ...chk(CAPTAIN_Q, "op.culture", 18, P + who + "_control", P + who + "_control_fail"), requires: [NOT(P + "captain"), NOT(P + who + "_control"), NOT(P + who + "_control_fail")] };
  };
  const WHY = "Why are you measuring the reality of Reality?";

  // Arviind
  beat(P + "arviind", "Arviind",
    T("Arviind appears hard at work using hypercalipers to count the number of uncollapsed wave forms in a blade of grass, but the number keeps changing just as he’s about to write it down. He then yells at them, they apologize, and the cycle begins again.",
      "Quantum. It’s a pain in everyone’s ass."),
    [ch("How is the investigation going?", P + "arviind_investigation"),
     chk(WHY, "op.logistics", 18, P + "arviind_why", P + "arviind_why_fail"),
     capQ("arviind", -1), BACK()], { hub: true });
  beat(P + "arviind_investigation", "Alpha Green Napalm Richard",
    T("“This blade of grass, which I have labeled Alpha Green Napalm Richard, as that’s the taxonomy I use in all of my investigations, is proving to be refractory.”",
      "“It refuses to get real with me.”"),
    [chk("Maybe don’t yell at it?", "op.diplomacy", 18, P + "arviind_kindness", P + "arviind_kindness_fail"), ASK("arviind"), BACK()]);
  beat(P + "arviind_kindness", "Trick It With Kindness", "He smiles. “Trick it with kindness. I like this approach. Hello wonderful grass friend!”",
    [ASK("arviind"), BACK()], { worldEffects: { receipts: [{ label: "They Taught Me a Trick", effectKey: "favorPlus2", target: "Arviind", truth: "“Trick it with kindness.” Arviind liked that. +2 favor with Arviind when you play it at the Circuit Riders’ table.", source: { name: "Arviind" } }] } });
  beat(P + "arviind_kindness_fail", "How to Do My Job",
    "He puts down the calipers, stands up, turns to look directly at you, and says “Maybe don’t tell me how to do my job?” Then crouches back down, and promptly ignores you.",
    [BACK()], { worldEffects: { courtFavor: [fav("Arviind", -2)] } });
  beat(P + "arviind_why", "Structural Integrity", "“We question its structural integrity. It appears to be wearing thin. We are afraid that it is happening in an unnatural way.”", [ASK("arviind"), BACK()]);
  beat(P + "arviind_why_fail", "A Very Important Question", "He seems baffled and slightly offended. “I mean I feel that this is a very important question to have a solid answer to, yes?”",
    [BACK()], { worldEffects: { courtFavor: [fav("Arviind", -1)] } });

  // Simone
  beat(P + "simone", "Simone",
    "Simone is walking the perimeter of the camp, making “HOOP HOOP” noises loudly, then recording notes on a glowing screen floating in the air in front of her. She appears to be stopping at specific places.",
    [chk("What are you doing?", "op.diplomacy", 18, P + "simone_doing", P + "simone_doing_fail"),
     chk(WHY, "op.logistics", 18, P + "simone_why", P + "simone_why_fail"),
     capQ("simone", -1), BACK()], { hub: true });
  beat(P + "simone_doing", "Anomalous Novelty",
    "“I am coming up with anomalous novelty experiences to project outwards from the camp towards others not in the camp. I then record their reactions. My hypothesis is that the less real a place is, the more that novel behavior will be considered acceptable and not startling.”",
    [chk("But there are, like, just birds and stuff out here, which pretty much all fly away if you make loud noises at them. You should be at a mall or something.", "op.logistics", 20, P + "simone_mall", P + "simone_mall_fail"), ASK("simone"), BACK()]);
  beat(P + "simone_doing_fail", "HOOP HOOP", "“HOOP HOOP!!!!” She screams in your face, to ensure that you are extremely aware of the nature of her activity. She then walks away to continue her perambulation.",
    [BACK()], { worldEffects: { courtFavor: [fav("Simone", -2)] } });
  beat(P + "simone_mall", "A Mall Is In Order",
    T("Her “HOOP HOOOO …?” trails off and she stops. She glances at her glowing clipboard where you can see entries like “butterfly - flew away,” “deer - ate grass,” “hummingbird - flew in mouth, took gum,” “rock - laughed at me.”",
      "“You know, I think I have thoroughly documented the typical wildlife reaction to novelty. I shall tell the Captain that I believe a Mall is in Order.”"),
    [ASK("simone"), BACK()], { worldEffects: { receipts: [{ label: "A Mall Is In Order", effectKey: "favorPlus2", target: "Simone", truth: "Simone has thoroughly documented the wildlife. +2 favor with Simone when you play it at the Circuit Riders’ table.", source: { name: "Simone" } }] } });
  beat(P + "simone_mall_fail", "Yelling at the Woods", "“Look, yelling at the woods is kind of intense, and I need to focus, so maybe talk to another NPC now.”",
    [BACK()], { worldEffects: { courtFavor: [fav("Simone", -2)] } });
  beat(P + "simone_why", "Sick Here", "“Because it is sick here in a way we have not seen before. We require information.”", [ASK("simone"), BACK()]);
  beat(P + "simone_why_fail", "More Yelling to Do", "“I have more yelling to do. Please leave me alone. My yelling precludes small talk.”",
    [BACK()], { worldEffects: { courtFavor: [fav("Simone", -2)] } });

  // Dennis
  beat(P + "dennis", "Dennis",
    T("Dennis is not measuring anything. Dennis is banging a hammer on the toe of the giant, anxious robot, which is roughly the size of a Volkswagen, and swearing. A panel sits open on its front, and it is currently displaying two five fingered, humanoid hands, with their middle fingers extended.",
      "“I don’t CARE, Leggy, that it hurts. Circuitborn stub their toes all the time. We don’t complain. We also APOLOGIZE to the villages we accidentally turn into our footprint. Or at least we definitely would.”"),
    [chk("Is it safe to talk to a toe that size in that way?", "op.diplomacy", 18, P + "dennis_toe", P + "dennis_toe_fail"),
     chk(WHY, "op.logistics", 18, P + "dennis_why", P + "dennis_why_fail"),
     capQ("dennis", 0), BACK()], { hub: true });
  beat(P + "dennis_toe", "Leggy and Me", "“Aw, me and Leggy joke back and forth. I tend to drive the feet anyway, so just as much my fault.”",
    [chk("How did he get hurt?", "inv", 18, P + "dennis_hurt", P + "dennis_hurt_fail"), ASK("dennis"), BACK()]);
  beat(P + "dennis_toe_fail", "Find Out", "“Why don’t you not stick around and find out? Sheesh.”", [BACK()], { worldEffects: { courtFavor: [fav("Dennis", -2)] } });
  beat(P + "dennis_hurt", "It’s the Thought That Counts", "“Aww, thanks y’all, appreciate your concerns. But old Leggy the Lug just needs to watch his step better.”",
    [ASK("dennis"), BACK()], { worldEffects: { receipts: [{ label: "It’s the Thought That Counts", effectKey: "favorPlus2", target: "Dennis", truth: "You asked after Leggy’s toe. +2 favor with Dennis when you play it at the Circuit Riders’ table.", source: { name: "Dennis" } }] } });
  beat(P + "dennis_hurt_fail", "Not Authorized", "“That is a sensitive, tactical question, which I am not authorized to talk about. This conversation is over.”",
    [BACK()], { worldEffects: { courtFavor: [fav("Dennis", -2)] } });
  beat(P + "dennis_why", "Punching Hard", "“Reality here is flimsy as shit. I’m sure you’ve seen it. You punch something too hard, you break the world too. What gives? Punching hard is kind of our deal.”",
    [ASK("dennis"), BACK()], { worldEffects: { receipts: [{ label: "Punching Hard Is Kind Of Our Deal", effectKey: "favorAllPlus1", truth: "Dennis says the world breaks when you punch too hard. +1 favor with every observer when you play it.", source: { name: "Dennis" } }] } });
  beat(P + "dennis_why_fail", "A Giant Toe", "“I’m not. I’m fixing a giant toe. And I need to get back to that. So …” He trails off and turns back to his work.",
    [BACK()], { worldEffects: { courtFavor: [fav("Dennis", -1)] } });

  // Howard
  beat(P + "howard", "Howard", "Howard is sitting on the ground criss-cross applesauce. He is staring at his hands.",
    [chk("You must have interesting hands!", "op.faith", 18, P + "howard_hands", P + "howard_hands_fail"),
     chk(WHY, "op.logistics", 18, P + "howard_why", P + "howard_why_fail"),
     capQ("howard", 0), BACK()], { hub: true });
  beat(P + "howard_hands", "There Are No Hands", "“I and my hands are one. There are no hands, there is no me. And yes, the nail polish I use is epic.”",
    [ASK("howard"), BACK()], { worldEffects: { receipts: [{ label: "There Are No Hands", effectKey: "favorPlus2", target: "Howard", truth: "There are no hands, there is no Howard. The nail polish is epic. +2 favor with Howard when you play it at the Circuit Riders’ table.", source: { name: "Howard" } }] } });
  beat(P + "howard_hands_fail", "NOW They Are", "“NOW they are. FUCK.”", [BACK()], { worldEffects: { courtFavor: [fav("Howard", -2)] } });
  beat(P + "howard_why", "Not My Hands", "“If I’m not my hands, we need to change a lot of assumptions about the basic nature of reality here. Once I am not on so many drugs.”", [ASK("howard"), BACK()]);
  beat(P + "howard_why_fail", "Go Be Loud", "“YOU’RE a reality. Go be loud somewhere else.”", [BACK()], { worldEffects: { courtFavor: [fav("Howard", -1)] } });

  // Captain Robot
  beat(P + "captain", "Captain Robot",
    T("Captain Robot is sitting by himself behind a large draped tarp, shielding him from the view of the others. You almost missed him.",
      "His voice when he speaks here no longer carries the affectation it did during your arrival."),
    [chk("We sense that you are not like the other Circuit Riders", "op.diplomacy", 18, P + "captain_control", P + "captain_control_fail"),
     chk(WHY, "op.logistics", 18, P + "captain_why", P + "captain_why_fail"),
     ch("Back to the camp", P + "camp")], { hub: true });
  beat(P + "captain_control", "Their Control", "“This is true. We don’t talk about it. There is a reason why. I’m their control.”",
    [ch("As in the control in the experiment. To measure what is real, and what is not.", P + "captain_experiment"),
     ch("Where did you get the suit?", P + "captain_suit"), ASK("captain"), BACK()]);
  beat(P + "captain_control_fail", "Reading the Room", "“You are very smart, but don’t know how to read a room, do you?”", [ASK("captain"), BACK()], { worldEffects: { courtFavor: favAll(-1) } });
  beat(P + "captain_experiment", "Does It Matter?",
    "“Correct. I am clearly not what I seem. And yet, this suit makes much of that discussion moot. So I am what I propose to be, or am I what I am? And does it matter? They measure the world, and also measure me and the world as it reacts.”",
    [ASK("captain"), BACK()]);
  beat(P + "captain_suit", "The Suit and Legansus Tal",
    "“The suit came with Legansus Tal. Or maybe the other way around. I found the suit first, scrounging through a ruin. I found Leg buried up to his waist and almost falling apart an hour later. These four came along to help me uncover him. He’s now our home, until we can figure out what he’s actually for.”",
    [ASK("captain"), BACK()]);
  beat(P + "captain_why", "Someone Is Messing With It", "“Someone is messing with it. Weakening it. And it has increased steadily. We want to know why.”",
    [ch("We want to know why too. Maybe we can help. We need friends.", P + "captain_gather"), ASK("captain"), BACK()]);
  beat(P + "captain_why_fail", "Not There Yet", "“I don’t think we’re there yet friends.”", [BACK()], { worldEffects: { courtFavor: favAll(-1) } });

  // The Parley
  const M = "bbttcc-territory";
  let crHex = ""; for (const s of game.scenes) for (const d of s.drawings) { const tf = d.flags?.[M]; if (!crHex && tf && String(tf.factionId || "") === CR_ID) crHex = String(tf.name || ""); }
  const RAID = {
    type: "parley", hexName: crHex || "Lyrenn", defenderId: CR_ID, objectiveOnly: true, courtScene: "fZB6KRmOcxepxEO4",
    goal: "persuade", audience: "observers", label: "The Circuit Riders",
    stake: "Make your case for why the Circuit Riders should toss their lot in with you.",
    courtiers: RIDERS,
    rounds: [
      { topic: "Doctrine", prompt: "Convince the Circuit Riders that you are trustworthy, that your methods are logical, and that you are worthy of continued, mutual study." },
      { topic: "Darkness", prompt: "Persuade the Riders that you are not part of the darkness that is causing reality to need measured." },
      { topic: "Witness", prompt: "Demonstrate your willingness and ability to measure reality for what it is, and not what one hopes it to be." }
    ],
    routes: { win: P + "parley_alliance", stalemate: P + "parley_neutral", loss: P + "parley_flagged" }
  };
  beat(P + "captain_gather", "Let’s Gather Them Together",
    T("“I can’t make that decision on my own. And the rest of the Riders will have to help me decide. Let’s gather them together. You prepare to make your case as to why we should toss our lot in with you. BLEEP BLORP BLOOP.”",
      "And the Captain is back."),
    [ch("Make your case", "", { worldEffects: { raid: RAID } }), ch("Not yet", P + "camp")]);

  // ── 4. write the new beats (clone of the opening's shape) ─────────────────────────────────────
  for (const w of want.values()) {
    let b = byId.get(w.id);
    const fresh = !b;
    if (fresh) {
      b = foundry.utils.deepClone(tpl);
      b.id = w.id; b.worldEffects = {}; b.story = { quest: "circuit_riders" }; b.type = "dialog";
      for (const k of ["questRole", "questStep", "targetHexUuid", "cinematic"]) if (k in b) delete b[k];
      beats.push(b); byId.set(b.id, b);
    }
    const inject = { ...(b.inject || {}), repeatable: !!w.hub, ...(w.hub ? { evergreen: true } : {}), requires: [{ flag: "storyPhase", gte: 2 }] };
    const next = { label: w.label, description: w.description, choices: w.choices, worldEffects: w.worldEffects, sceneId: POV, inject };
    for (const k of FLAGS) next[k] = true;
    const cur = Object.fromEntries(Object.keys(next).map(k => [k, b[k]]));
    if (JSON.stringify(cur) !== JSON.stringify(next)) { Object.assign(b, next); report.changed.push((fresh ? "new " : "updated ") + w.id.replace(P, "")); }
  }

  // ── 5. retire the old chain ───────────────────────────────────────────────────────────────────
  const OLD = /^enc_circuit_riders_(parley_observe|parley_respect|parley_humor|parley_skepticism|parley_resolution|pressure_(doctrine|darkness|witness)|(doctrine|darkness|witness)_(good|mixed|bad)|witness_(request|success|fail)|captain_robot_(intro|\d|echo)|(simone|arvind|howard|dennis)_(intro|\d|echo)|not_yet)$/;
  const retired = new Set(beats.filter(b => OLD.test(b.id)).map(b => b.id));
  for (const id of retired) {
    const b = byId.get(id);
    const inj = { ...(b.inject || {}), requires: [{ flag: "storyPhase", gte: 99 }], retired: "Dave 2026-11-13 — Circuit Riders rebuilt to a Parley" };
    if (JSON.stringify(b.inject) !== JSON.stringify(inj)) { b.inject = inj; report.changed.push("retired " + id.replace(P, "")); }
  }
  for (const b of beats) {
    if (retired.has(b.id)) continue;
    for (const c0 of b.choices || []) for (const k of ["next", "failNext"]) if (c0[k] && retired.has(c0[k])) { report.repointed.push(`${b.id} · "${c0.label}" ${k} ${c0[k]} → exit`); c0[k] = ""; }
  }
  if (report.repointed.length) report.changed.push(`${report.repointed.length} choice(s) into the retired chain now exit`);

  // ── 6. sanity: every new choice target exists ───────────────────────────────────────────────
  for (const w of want.values()) for (const c0 of w.choices) for (const k of ["next", "failNext"]) if (c0[k] && !byId.has(c0[k])) throw new Error(`${w.id}: "${c0.label}" → missing ${c0[k]}`);

  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("CRREBUILD " + JSON.stringify({ DRY_RUN, changed: report.changed.length, repointed: report.repointed.length }));
  return report;
})();

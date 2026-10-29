/**
 * patch-tor-wrath-seal-gate-2026-10-28.macro.js — Dave, 10-28 (rulings in memory project_tor_wrath_seal_gate):
 *   "Stewards encounter what is basically a qliphothic elemental, an entity composed of the darkness and rage within
 *    Khezek Tor, at the East Wall when they go to heal it. Several at the Valhaulan Seal scene. … it was their movement
 *    Rowan is hearing. … KT is the lynchpin of the whole act 2 arc … the seal remains unusable, and unreadable, until the
 *    AG beats have happened. … the plants from Lyrenn to lean, and then the Field That Remembers … tell the players the
 *    consequences … Sable Nine … a skill scene, a challenge, a monster — while down the rope."
 * Rulings: energy = Yesod gone dark · name = Tor-Wrath · the Field is REQUIRED · the rope = climb, then fight.
 *
 *  0) World actor "Tor-Wrath" (tier I brute, Gamaliel — Hull of Yesod), built from the NPC Pack's Ghagielite Blinder item
 *     shapes; art = qliphoth/inferno-of-cruelty.webp (placeholder). Story fights spawn it by name (bbttcc-encounters
 *     stageReady; encounter.count + encounter.party are new in spawner.interface.js).
 *  1) THE EAST WALL — "Finish the job" (after any Survey/Crew/Read result) → the Tor-Wrath tears out of the plate (×1).
 *     Won / lost both NAME THE ENERGY (Yesod gone dark, from the east, from the mountain). Pike's tally now follows it.
 *  2) THE OLD SEAL — the gallery holds three; "Up close." waits for them. A lost fight sends you up; a Lift Hall door
 *     brings you back until the seal is decided. Restore / Redirect / Break need ALL of: Etta (she reads the script),
 *     the East Wall (what it's pushing on), the Field (what each costs). "Study the carving" says what's missing.
 *  3) SABLE'S ROPE — the rope answer is now the second half of the climb (Soul 12 to keep going while the lean pulls),
 *     then the Tor-Wrath nested at the second scratch on Four (×1). Won: Sable's map holds still — Sable's resolution —
 *     and THEN the hand and the paper. Lost: better rope. The empty cage stays the last resort, unchanged.
 *  4) LYRENN — Rowan: "What's walking under there?" (the pests and the treeline are running ahead of them). The low field
 *     REMEMBERS FORWARD once the red thread leans: kneel by the stone figure → the three postures of the seal, with plain
 *     costs. Doors on the field and on the rows.
 *  5) Quest Log lines (story scripts: allesh_gilliam.wall, khezek_tor.seal/shaft, lyrenn + new "forward" step).
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const beats = Array.isArray(camp.beats) ? camp.beats : (camp.beats = Object.values(camp.beats || {}));
  const byId = (id) => beats.find(b => b && String(b.id) === id);
  const report = []; const conflicts = []; let changes = 0;
  const say = (m) => { changes++; report.push(m); };

  const FOE = "Tor-Wrath";
  const ETTA = { anyOf: [{ beatMark: "allesh_gilliam_etta_bloom_conversation" }, { beatMark: "ag_etta_bought_in" }] };
  const ETTA_T = "allesh_gilliam_etta_bloom_conversation|ag_etta_bought_in";
  const WALL = { anyOf: [{ beatMark: "ag_east_wall_tor_wrath_won" }, { beatMark: "ag_east_wall_tor_wrath_lost" }] };
  const WALL_T = "ag_east_wall_tor_wrath_won|ag_east_wall_tor_wrath_lost";
  const FIELD = { beatMark: "lyrenn_field_remembers_forward" };
  const SEAL_DONE = ["khezek_tor_the_vaulhaulan_seal_restore", "khezek_tor_the_vaulhaulan_seal_redirect", "khezek_tor_the_vaulhaulan_seal_break"];
  const P2 = { flag: "storyPhase", gte: 2 };
  const ch = (label, next, extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });

  // ── 0) the actor ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const ART = "art/bbttcc/qliphoth/inferno-of-cruelty.webp";
  let actorPlan = null;
  if (!game.actors.find(a => a.name === FOE)) {
    const pack = game.packs.get("bbttcc-master-content.npcs");
    const idx = pack && (await pack.getIndex()).find(e => e.name === "Ghagielite Blinder");
    const tmpl = idx ? (await pack.getDocument(idx._id))?.toObject() : null;
    if (!tmpl) conflicts.push("NPC Pack: Ghagielite Blinder not found (item template for the Tor-Wrath)");
    else {
      const it = (type) => foundry.utils.deepClone(tmpl.items.find(i => i.type === type));
      const bio = "<p>The darkness and the rage inside Khezek-Tor, standing up. A Tor-Wrath is what the mountain does with a feeling it can't put down: ore-grit and old dark packed into the rough shape of a fist that remembers being a man. They come up through the rock as easily as you'd come through a door, and they go back into it the same way.</p><p>They are not hungry. They are furious about something that was done to them, and they have no idea any more what it was.</p><p><strong>Qliphah:</strong> Gamaliel, the Obscene Ones — the Hull of Yesod. The Foundation turned over: what should hold the shape of things holds a grudge instead.</p><p><em>Calder's crews named them. Calder's crews do not elaborate.</em></p>";
      const feat = (name, html, src) => { const x = it("feature"); x.name = name; delete x._id; x.system.description.value = html; x.system.category = "principle"; x.system.tags = src || []; return x; };
      const weap = (name, f) => { const x = it("weapon"); x.name = name; delete x._id; Object.assign(x.system, f); return x; };
      const tant = it("feat"); tant.name = "Tantrum (1/scene)"; delete tant._id;
      tant.system.description.value = "<p>The Tor-Wrath tears loose whatever is built near it — plate, brace, rail, bus — and throws it. Each creature in a 3-square line rolls Body vs DC 12: on a failure it takes 2d6 kinetic damage to Integrity and is knocked Prone; on a success, half and stays standing.</p>";
      const a = foundry.utils.deepClone(tmpl);
      delete a._id; delete a.folder; delete a._stats;
      a.name = FOE; a.img = ART;
      Object.assign(a.system, { role: "brute", tier: 1, notes: bio });
      Object.assign(a.system.details, { level: 1, tier: 1 });
      a.system.attributes = { violence: { value: 3 }, intrigue: { value: 1 }, presence: { value: 2 }, body: { value: 3 }, mind: { value: 1 }, soul: { value: 2 } };
      Object.assign(a.system.derived, { integrity: { value: 30, max: 30, temp: 0 }, stress: { value: 12, max: 12 }, guard: { value: 12 }, evasion: { value: 11 }, resolve: { value: 12 } });
      a.system.defenses = { resistances: ["qliphothic", "kinetic"], immunities: [], vulnerabilities: ["sephirotic"] };
      a.system.conditionImmunities = ["charmed", "compelled"];
      a.system.tags = ["qliphothic", "qliphah-gamaliel", "hull-of-yesod", "lesser", "tor-wrath", "khezek-tor"];
      if (a.system.biography) Object.assign(a.system.biography, { concept: "Qliphothic Elemental (Gamaliel — Lesser)", notes: bio });
      const rfi = a.flags?.fourththing?.rfi?.actor;
      if (rfi) Object.assign(rfi, { archetype: "tor-wrath", bestiary: { ...(rfi.bestiary || {}), themes: ["qliphothic", "gamaliel", "elemental", "khezek-tor"], role: "Qliphothic Elemental (Gamaliel — Lesser)", lootTable: [{ name: "Furious Yesodium Grit", qty: "1d4", weight: 5 }, { name: "A Knuckle of Ore That Is Still Angry", qty: "1", weight: 2 }] } });
      a.items = [
        feat("Yesod Gone Dark", "<p>The 3 squares around the Tor-Wrath feel like that one night. A creature that starts its turn there rolls twice and keeps the worse result on Soul and Resolve checks until the start of its next turn. Sephirotic damage and Yesod manifestations against it roll twice and keep the better.</p><p><em>Gamaliel — hull of Yesod.</em></p>", ["lineage-trait", "qliphothic", "gamaliel"]),
        feat("Comes Through the Rock", "<p>The Tor-Wrath moves through earth, stone and rubble as if through open ground and can end its move inside it. When it drops to 0 Integrity it does not fall — it comes apart into the nearest rock, and the pressure goes back to the mountain.</p>"),
        weap("Ore-Fist", { category: "melee", intent: "violence", skill: "melee", damage: { formula: "1d8", attribute: "violence", type: "kinetic", damageFlavor: "", track: "integrity" }, damageParts: [], range: { short: 1, long: 1 }, tags: [], effect: "On a hit, Body vs DC 12 or pushed 1 square and knocked Prone.", flavor: "A fist of ore that has been clenched since that night." }),
        weap("Grief Undertow", { category: "melee", intent: "violence", skill: "melee", damage: { formula: "1d6", attribute: "soul", type: "qliphothic", damageFlavor: "", track: "stress" }, damageParts: [], range: { short: 2, long: 2 }, tags: ["lineage-strike", "qliphothic"], effect: "Damage goes to Stress. On a hit, Resolve vs DC 12 or Shaken until the end of the target's next turn: for a moment it is that one night again, and you are the one who did it.", flavor: "It doesn't hit you. It pulls." }),
        tant
      ];
      a.prototypeToken = { ...(a.prototypeToken || {}), name: FOE, actorLink: false, disposition: -1, texture: { ...(a.prototypeToken?.texture || {}), src: ART } };
      actorPlan = a;
      say(`✚ world actor "${FOE}" (tier I brute, Gamaliel; Ore-Fist / Grief Undertow / Tantrum; art ${ART})`);
    }
  }

  // ── beat helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const base = (id, from, o) => ({
    id, type: "dialog", tags: "", politicalTags: "", speakerActorId: from?.speakerActorId ?? null, sceneId: from?.sceneId ?? null,
    hexName: null, targetHexUuid: null, outcomes: { success: null, failure: null }, actors: [], encounter: { key: "", tier: null, actorName: "" },
    refs: {}, playerFacing: false, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    choices: [], inject: { repeatable: true, evergreen: true, requires: [P2] }, dialogueOffer: false, timeScale: "moment", timePoints: 0, worldEffects: {},
    ...(from?.questId && !String(id).startsWith("ans_") ? { questId: from.questId } : {}), ...o
  });   // answer beats (ans_*) carry no questId — the dead-end sweep's shape rule
  const addBeat = (b) => { if (byId(b.id)) return; beats.push(b); say(`✚ ${b.id} — ${b.label}`); };
  const fight = (id, from, label, count, desc, choices) => base(id, from, {
    type: "encounter", label, tags: "story fight tor_wrath", description: desc, choices,
    encounter: { key: null, tier: 1, actorName: FOE, ...(count > 1 ? { count } : {}), party: true },
    inject: { repeatable: true, evergreen: true, requires: [P2] }, timeScale: "scene", timePoints: 1
  });
  const addChoice = (bid, c, before) => {
    const b = byId(bid); if (!b) return conflicts.push(`${bid}: not found`);
    b.choices ||= [];
    if (b.choices.some(x => x.next === c.next && x.label === c.label)) return;
    const i = before ? b.choices.findIndex(x => before(x)) : -1;
    if (i >= 0) b.choices.splice(i, 0, c); else b.choices.push(c);
    say(`✎ ${bid}: + "${c.label}" → ${c.next}`);
  };
  const reqChoice = (bid, pick, reqs, note) => {
    const c = byId(bid)?.choices?.find(pick); if (!c) return conflicts.push(`${bid}: choice for ${note} not found`);
    const cur = Array.isArray(c.requires) ? c.requires : (c.requires ? [c.requires] : []);
    const add = reqs.filter(r => !cur.some(x => JSON.stringify(x) === JSON.stringify(r)));
    if (!add.length) return;
    c.requires = [...cur, ...add]; say(`✎ ${bid}: "${c.label}" now requires ${note}`);
  };
  const editText = (bid, from, to, note) => {
    const b = byId(bid); if (!b) return conflicts.push(`${bid}: not found`);
    const cur = String(b.description || ""); if (cur.includes(to)) return;
    if (!cur.includes(from)) return conflicts.push(`${bid}: anchor not found — "${from.slice(0, 50)}…"`);
    b.description = cur.replace(from, to); say(`✎ ${bid}: ${note}`);
  };

  // ── 1) THE EAST WALL ─────────────────────────────────────────────────────────────────────────────────────────────────
  const WALLI = byId("allesh_gilliam_the_east_wall_intro");
  if (!WALLI) conflicts.push("East Wall intro not found");
  else {
    const NAME_THE_ENERGY = "It isn't rage. Rage is only the weather on it. Underneath, where your hand is still flat on the plate, you can feel what it was made from: <b>Yesod</b> — the Foundation, the moon-sphere, the part of the world that holds the shape of dreams and seeds and promises — turned over, gone dark, and furious about being turned. It came from the east. It came up out of the ground, and the ground it came out of runs all the way back to the mountain.";
    addBeat(fight("ag_east_wall_tor_wrath", { ...WALLI, sceneId: "3uuTDbAt9NgbqK6S" /* East Wall battlemap (Dave 10-29) */ }, "The East Wall — The Thing in the Plate", 1,
      "You set the last brace and the bow in the plate stands up.\n\nNot the wall — the bow. The bulge you've been measuring all day peels off the steel like a shadow coming off a sheet, and it keeps its shape when it's off. Ore-grit and old dark packed into the rough outline of something with fists. The bus parts the wall has been throwing at everyone's heads come from somewhere, and now you know where. The scouts on the walkway stop pretending this is a structural issue.\n\nIt doesn't want the town. It wants the wall to stop holding, and you are the latest thing holding it.\n\n⚙ GM: a fight on the wall. The Tor-Wrath (one) comes out of the plate; the Stewards are placed. Call it when it's done.",
      [ch("It's down — it comes apart against the plate", "ag_east_wall_tor_wrath_won"), ch("It tears loose and goes into the ground, east", "ag_east_wall_tor_wrath_lost")]));
    addBeat(base("ag_east_wall_tor_wrath_won", WALLI, { label: "The East Wall — What Leaned on It", tags: "story tor_wrath east_wall",
      description: "When it comes apart, it doesn't die. It goes back to being what it was before it stood up: a pressure. You feel it go — down through the footing, into the dirt, east.\n\n" + NAME_THE_ENERGY + "\n\nThe plate under your hand goes still for the first time since that night. The crew notice before you do; you can hear the welding change.\n\n⚙ GM: the wall stops fighting the crew — count one missed task (Survey / Crew / Read) as done, to a most of three.",
      choices: [ch("Tell Pike — tally the swings", "ag_east_wall_tally")] }));
    addBeat(base("ag_east_wall_tor_wrath_lost", WALLI, { label: "The East Wall — It Went Home", tags: "story tor_wrath east_wall",
      description: "It doesn't run. It sinks, like a man lowering himself into a bath, and the dirt at the footing closes over it, and something heavy goes away under your boots, east, at walking pace.\n\nIt touched you on the way down. That was enough to know it.\n\n" + NAME_THE_ENERGY + "\n\nThe bow is still in the plate. It'll be back, or another one will.\n\n⚙ GM: the tally stands as it is.",
      choices: [ch("Tell Pike — tally the swings", "ag_east_wall_tally")] }));
    const DID_ONE = { anyOf: ["ag_east_wall_survey_ok", "ag_east_wall_survey_miss", "ag_east_wall_crew_ok", "ag_east_wall_crew_miss", "ag_east_wall_read_ok", "ag_east_wall_read_miss"].map(x => ({ beatMark: x })) };
    addChoice("allesh_gilliam_the_east_wall_intro",
      ch("Finish the job — make the section stop throwing things", "ag_east_wall_tor_wrath", { description: "Set the last brace. Whatever's in the bow won't like it.", requires: [P2, DID_ONE, { beatMark: "ag_east_wall_tor_wrath", not: true }] }),
      (x) => x.next === "ag_east_wall_tally");
    reqChoice("allesh_gilliam_the_east_wall_intro", (x) => x.next === "ag_east_wall_tally", [WALL], "the wall fight (won or lost)");
  }

  // ── 2) THE OLD SEAL ──────────────────────────────────────────────────────────────────────────────────────────────────
  const SEAL = byId("khezek_tor_the_vaulhaulan_seal");
  const CINE = byId("khezek_tor_valhaulan_seal_cinematic");
  if (!SEAL || !CINE) conflicts.push("Old Seal / its cinematic not found");
  else {
    addBeat(fight("kt_seal_tor_wrath", { ...SEAL, sceneId: "ewhnzejDEXX69yOl" /* valhaulan seal hexchrome battlemap (Dave 10-29) */ }, "Khezek-Tor — The Gallery Is Not Empty", 3,
      "The gallery Calder's crews won't work is not empty. That's the reason; it was always the reason; nobody wanted to be the one to say it out loud in front of the foreman.\n\nThe walls move first. Three shapes shoulder out of the rock between you and the seal — ore-grit and old dark, fists like slag, standing up out of the stone the way a man stands up out of a chair he's been sitting in too long. The miners have a name for these. Sable says it under their breath, like a correction: <b>Tor-Wrath</b>.\n\nThey are not guarding the seal. They are leaking out of it.\n\n⚙ GM: a fight in the gallery — three Tor-Wrath; the Stewards are placed. Call it when it's done.",
      [ch("They're down — they come apart into the rock", "kt_seal_tor_wrath_won"), ch("Too many — back up the cage", "kt_seal_tor_wrath_lost")]));
    addBeat(base("kt_seal_tor_wrath_won", SEAL, { label: "Khezek-Tor — The Gallery, Quiet", tags: "story tor_wrath seal",
      description: "The last one comes apart into the wall and the gallery goes quiet, a whole-mountain quiet, the kind that has weight. Then, very faintly, behind the seal, something begins to press again. Not yet. But soon.\n\nSable is already writing down the time.",
      choices: [ch("Up close.", "khezek_tor_the_vaulhaulan_seal")] }));
    addBeat(base("kt_seal_tor_wrath_lost", SEAL, { label: "Khezek-Tor — Back Up the Cage", tags: "story tor_wrath seal",
      description: "You get to the cage because Sable gets to the cage first and holds the gate. The Tor-Wrath don't follow past the numbered levels. They don't have to. They were there before you, and they'll be there when you come back.\n\n\"Now you know why the crews won't work it,\" Sable says, \"and why Calder doesn't spook. You don't spook at a thing you've already decided not to go near.\"",
      choices: [ch("Back up to the switchback", "khezek_tor_quest_scene")] }));
    // the cinematic: "Up close." waits for the gallery
    const up = CINE.choices?.find(x => x.next === "khezek_tor_the_vaulhaulan_seal");
    if (up) reqChoice("khezek_tor_valhaulan_seal_cinematic", (x) => x === up, [{ beatMark: "kt_seal_tor_wrath_won" }], "the gallery cleared");
    addChoice("khezek_tor_valhaulan_seal_cinematic", ch("Into the gallery.", "kt_seal_tor_wrath", { requires: [{ beatMark: "kt_seal_tor_wrath_won", not: true }] }), (x) => x === up);
    // the Lift Hall brings you back until the seal is decided
    addChoice("khezek_tor_the_lift_hall",
      ch("Go back down to the sealed gallery with Sable", "khezek_tor_valhaulan_seal_cinematic", { description: "The seal is still waiting.", requires: [P2, { beatMark: "khezek_tor_valhaulan_seal_quest_acceptance" }, ...SEAL_DONE.map(x => ({ beatMark: x, not: true }))] }),
      (x) => x.next === "khezek_tor_quest_scene");
    // the tools need Etta + the Wall + the Field
    for (const id of SEAL_DONE) reqChoice("khezek_tor_the_vaulhaulan_seal", (x) => x.next === id, [ETTA, WALL, FIELD], "Etta + the East Wall + the Field");
    editText("khezek_tor_the_vaulhaulan_seal", "Three tools are on the table: mend it, aim it, or open it — and the mountain is listening to the discussion.",
      `{{#played ${ETTA_T}}}Etta's reading sits in your head like a key in a pocket: it can be mended, aimed, or opened.{{else}}You can't read a line of it. It isn't decoration; it is instructions, and they are not addressed to you.{{/played}} {{#played ${WALL_T}}}And you know what's pushing on it from the other side now — Yesod, turned over and furious.{{else}}A seal is a lock cut to fit something, and you don't know yet what this one is fitted to.{{/played}} {{#played lyrenn_field_remembers_forward}}You have seen, in a field, what each way costs.{{else}}Whatever you do here, somebody will pay for it, and you don't know who yet.{{/played}} The mountain is listening to the discussion.`,
      "the seal says what you know and what you don't");
    const STUDY = "ans_kt_seal_study";
    addBeat(base(STUDY, SEAL, { label: "Khezek-Tor — Study the Carving", tags: "khezek_tor seal story",
      description: `You stand in front of it long enough for Sable to sit down.\n\n{{#played ${ETTA_T}}}<b>How it's worked:</b> Etta read you the hand. Mend it and the mountain keeps what it holds. Aim it and you choose where it goes. Open it and nothing holds anything.{{else}}<b>How it's worked:</b> you can't read it. Somebody who has done business with the people who write like this could — and traders travel. Somebody at a market, maybe.{{/played}}\n\n{{#played ${WALL_T}}}<b>What it holds:</b> Yesod gone dark — you felt it come out of the East Wall in Allesh-Gilliam. The seal is cut to fit that.{{else}}<b>What it holds:</b> you don't know. Pike's East Wall in Allesh-Gilliam has been leaning since that night, toward this mountain. Whatever leans on it might tell you.{{/played}}\n\n{{#played lyrenn_field_remembers_forward}}<b>What it costs:</b> the field in Lyrenn showed you, posture by posture.{{else}}<b>What it costs:</b> you don't know, and you'd be guessing with other people's lives. Lyrenn's low field remembers things — and since that night, Lyrenn's plants have been leaning this way too.{{/played}}`,
      choices: SEAL.choices.filter(x => x.next !== STUDY).map(x => foundry.utils.deepClone(x)) }));
    addChoice("khezek_tor_the_vaulhaulan_seal", ch("Study the carving", STUDY, { description: "What do you know, and what don't you?" }), (x) => x.next === "khezek_tor_quest_scene");
    const st = byId(STUDY);   // keep the answer's tools in step with the parent's (gates may have landed after it was made)
    if (st) for (const id of SEAL_DONE) reqChoice(STUDY, (x) => x.next === id, [ETTA, WALL, FIELD], "Etta + the East Wall + the Field");
  }

  // ── 3) SABLE'S ROPE ──────────────────────────────────────────────────────────────────────────────────────────────────
  const ROPE = byId("ans_kt_cage_shaft_rope");
  if (!ROPE) conflicts.push("ans_kt_cage_shaft_rope not found");
  else {
    const NEW_ROPE = "Hand over hand, past Four. The rope is good rope; Sable checked it twice and then a third time while pretending not to. The air changes at the first scratch on the shaft wall, cooler and heavier, and at the second scratch you feel it: the pull. Not gravity. Sideways. The whole shaft LEANS, a few degrees, toward something under the coast, and your body wants to lean with it, and let go of the rope to do it.\n\nThis is what Sable has been charting. This is why the map won't hold still.";
    if (String(ROPE.description || "") !== NEW_ROPE) { ROPE.description = NEW_ROPE; ROPE.label = "Khezek-Tor — The Cage Shaft — The Climb"; say("✎ ans_kt_cage_shaft_rope: now the second half of the climb (the lean pulls)"); }
    const keep = ch("Hold on and keep climbing.", "kt_shaft_tor_wrath", { description: "Keep your nerve while the shaft leans.", checkStat: "soul", checkDC: 12, failNext: "kt_cage_shaft_fail" });
    if (!(ROPE.choices || []).some(x => x.next === "kt_shaft_tor_wrath")) { ROPE.choices = [keep]; say(`✎ ans_kt_cage_shaft_rope: "${keep.label}" (Soul 12) → kt_shaft_tor_wrath`); }
    addChoice("ans_kt_cage_shaft_rope", ch("Climb back up. Another time.", "kt_cage_shaft"));   // an unchecked exit (lint C09)
    addBeat(fight("kt_shaft_tor_wrath", ROPE, "Khezek-Tor — What Leans in the Shaft", 1,
      "At the second scratch on Four the shaft wall bulges, and the bulge has knuckles.\n\nIt's been in here the whole time. Wedged into the rock like a cork, leaning — it is the lean, the thing Sable's chart has been trying to describe in ink for a year — and now it unfolds out of the wall into the dark between you and the bottom of the rope, ore-grit and old fury, and it is not going to let you past.\n\nAbove you, Sable says something very quiet and very rude.\n\n⚙ GM: a fight on the rope — one Tor-Wrath; the Stewards are placed. Anyone who's knocked Prone is hanging by one hand. Call it when it's done.",
      [ch("It's down — the wall takes it back", "kt_shaft_tor_wrath_won"), ch("It drives you back up the rope", "kt_shaft_tor_wrath_lost")]));
    addBeat(base("kt_shaft_tor_wrath_won", ROPE, { label: "Khezek-Tor — The Map Holds Still", tags: "story tor_wrath sable official_word",
      description: "It comes apart into the shaft wall, and the shaft stops leaning.\n\nYou feel it in your arms first, the rope hanging true for the first time. Then Sable's lamp, up top, stops swinging. Then Sable makes a sound you will never hear again: a laugh, short, surprised out of them.\n\n\"It's holding still,\" they call down. The chart. The map that wouldn't hold still has held still. \"It's holding STILL. Do you know how long I've—\" and then nothing, because Sable is writing, fast, before it changes its mind.\n\nFour rungs below Four, the rope goes slack in your hands, and there is a hand, and in the hand, paper.",
      choices: [ch("Bring it up.", "kt_dropped_manifest")] }));
    addBeat(base("kt_shaft_tor_wrath_lost", ROPE, { label: "Khezek-Tor — Back Up the Rope", tags: "story tor_wrath sable official_word",
      description: "You come up the rope faster than you went down it, with the thing's grief still in your teeth. It doesn't follow. It goes back into the wall and settles, and the shaft starts leaning again, and Sable's lamp starts swinging again, and Sable, very carefully, does not say anything about it.",
      choices: [ch("Come back with better rope.", "kt_cage_shaft")] }));
  }

  // ── 4) LYRENN ────────────────────────────────────────────────────────────────────────────────────────────────────────
  const ROWAN = byId("lyrenn_rowan_of_the_loam_convo");
  if (!ROWAN) conflicts.push("Rowan's conversation not found");
  else {
    editText("lyrenn_rowan_of_the_loam_convo", "a wrong note under everything, like a bell struck and left ringing.",
      "a wrong note under everything, like a bell struck and left ringing — and under the note, lately, footsteps.", "Rowan hears footsteps under the note");
    const MOVE = "ans_lyrenn_rowan_moving";
    addBeat(base(MOVE, ROWAN, { label: "Lyrenn — What's Walking Under There", tags: "lyrenn rowan story tor_wrath",
      description: "Rowan doesn't answer for a long time. When they do, they answer with their palm flat on the soil, the way you'd answer with a hand on a sleeping dog.\n\n\"Walking,\" they say. \"Since that night. Heavy and slow and in no hurry, like weather that learned to want something. From the east. From under the mountain.\"\n\nThey press harder, listening.\n\n\"That's what people keep getting wrong about the east channels. The things tearing them up weren't raiding us. They were running. And the treeline isn't coming at Lyrenn. It's backing up. Toward us, away from them.\" A pause. \"Everything that can move is moving this way. The things that can't move are leaning.\"",
      choices: (ROWAN.choices || []).map(x => foundry.utils.deepClone(x)) }));
    addChoice("lyrenn_rowan_of_the_loam_convo", ch("What's walking under there?", MOVE), (x) => /^Leave$/i.test(String(x.label || "").trim()));
  }
  const FINTRO = byId("lyrenn_the_field_that_remembers_you_intro");
  if (!FINTRO) conflicts.push("Field intro not found");
  else {
    const FWD = "lyrenn_field_remembers_forward";
    addBeat(base(FWD, FINTRO, { label: "Lyrenn — The Field Remembers Forward", tags: "lyrenn field story seal", questId: FINTRO.questId,
      inject: { repeatable: true, requires: [P2, { beatMark: "lyrenn_red_thread_sprouted" }] }, timeScale: "scene", timePoints: 1,
      description: `The red thread runs straight through the stone figure now, every stem leaning the same way, past it and out toward the hexes nobody counts. When you kneel beside the figure, the field goes quiet in a ring around you, and then — slowly, the way a crowd turns to look at something — every plant in the low field leans the same way the red thread does.\n\nToward the mountain.\n\nThis field remembers. It has been remembering backward since that night. Kneeling here, with the red thread pulling through the stone, it remembers <i>forward</i>, and it shows you {{#played ${ETTA_T}|khezek_tor_the_vaulhaulan_seal}}the seal under Khezek-Tor{{else}}something under the mountain, shut with an old seal{{/played}} three ways, in posture, the only language it has.\n\n<b>Mended.</b> A stalk drawing every leaf back into itself, heavy, bowed under the weight, upright. The mountain keeps what it holds. Khezek-Tor burns with it for a while — the ground goes hot for a turn — and the people there carry it, and say less about it every year. The dark under Khezek-Tor eases, though it never fully goes. Whatever was being sent away comes home to be dealt with, and so does the work of dealing with it.\n\n<b>Aimed.</b> A stalk bent hard toward somebody else's row. The weight goes where you point it, and it lands on somebody. Every town in the region learns that you can do that, and looks at you a little differently, and wonders if the next one is them. The dark in you deepens.\n\n<b>Opened.</b> The whole field going flat at once, as if a wind came through that no one will ever see the end of. Nothing holds anything. What was held runs down the line toward the coast, and every needle that can shake shakes, and the mountain is left darker than it was, and so are you — much darker — and you will be invoiced for it for years.\n\nThen the field lets go of you, and it's only a field again, leaning.`,
      choices: [ch("Back to the rows", "lyrenn_quest_scene")] }));
    const door = (bid, before) => addChoice(bid,
      ch("Kneel by the stone figure — the red thread leans through it", FWD, { description: "The field remembers forward.", requires: [P2, { beatMark: "lyrenn_red_thread_sprouted" }, { beatMark: FWD, not: true }] }), before);
    door("lyrenn_the_field_that_remembers_you_intro", (x) => /^Leave$/i.test(String(x.label || "").trim()));
    door("lyrenn_quest_scene", (x) => x.next === "lyrenn_water_choir");
  }

  // ── 5) Quest Log lines ───────────────────────────────────────────────────────────────────────────────────────────────
  const S = camp.story?.scripts || {};
  const step = (sid, stid) => (S[sid]?.steps || []).find(x => x.id === stid);
  const setLine = (sid, stid, line, addBeats = []) => {
    const s = step(sid, stid); if (!s) return conflicts.push(`story ${sid}.${stid}: not found`);
    let did = false;
    if (line && s.line !== line) { s.line = line; did = true; }
    for (const b of addBeats) if (!(s.beats || []).includes(b)) { (s.beats ||= []).push(b); did = true; }
    if (did) say(`✎ story ${sid}.${stid}: Quest Log line`);
  };
  setLine("allesh_gilliam", "wall", "Walk the East Wall. Survey it, crew it and read it, in any order. Then finish the job, whatever comes out of the wall, and tell Pike what you found.", ["ag_east_wall_tor_wrath"]);
  setLine("khezek_tor", "seal", "Go with Sable Nine to the sealed shaft. You won't be able to read the carvings on your own, and the gallery isn't empty.", ["kt_seal_tor_wrath", "ans_kt_seal_study"]);
  setLine("khezek_tor", "shaft", "Go down the cage shaft below Level Four with Sable Nine and find the dropped manifest. Something in the shaft is making Sable's map lean.", ["kt_shaft_tor_wrath"]);
  if (S.lyrenn && !step("lyrenn", "forward")) {
    const at = S.lyrenn.steps.findIndex(x => x.id === "label");
    S.lyrenn.steps.splice(at >= 0 ? at + 1 : S.lyrenn.steps.length, 0, {
      id: "forward", label: "The Field Remembers Forward", line: "When the red thread comes up leaning, go back to the low field and kneel by the stone figure.",
      beats: ["lyrenn_field_remembers_forward"], done: { mark: "lyrenn_field_remembers_forward" },
      logged: "In the low field, kneeling by the stone figure, you saw the three ways the seal could go, and what each would cost."
    });
    say("✚ story lyrenn.forward: The Field Remembers Forward");
  }

  console.log(`[tor-wrath + seal gate 2026-10-28] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__torWrath = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-tor-wrath-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  if (actorPlan) {
    const folder = game.folders.find(f => f.type === "Actor" && /bad eden monsters|monsters|bestiary/i.test(f.name));
    if (folder) actorPlan.folder = folder.id;
    await Actor.create(actorPlan);
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Tor-Wrath, the seal waits for Etta + the Wall + the Field.`);
})();

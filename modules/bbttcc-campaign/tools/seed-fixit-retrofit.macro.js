/* seed-fixit-retrofit.macro.js — FURRIER'S FIXIT FARM to the Chuckle Creek template (2026-09-27). RUN IN-WORLD (GM). DRY_RUN default true.
 *
 * Source: ~/FIXIT_RETROFIT_2026_09_27.md. Fixit was the funniest town on the map and the least playable: 36/46 beats had no speaker,
 * the stabilizer beat was unreachable by choice, no turn, no receipt.
 *  1. Speakers on every beat (Dougan / Young Gearbox / Old Gearbox / Mara / Patter).
 *  2. Armed secrets for Mara, Pip, Patter, Miliard; personas for Young Gearbox, Old Gearbox, Furrier.
 *  3. Wiring: Arc Bay → the stabilizer; the yard → the Gullywasher welcome; Delay → come back; Back Stairs → the Route Board.
 *  4. New beats: the MYSTERY Bin (gag + clue), the Route Board (THE TURN; two versions, before/after the Maneuver Vault),
 *     Load the Crate (hand-off home) + receipt THE CERTIFICATION.
 *  5. Full script → campaign.story (9 steps; the Route Board is not a step — see 2026-10-02).
 * OWNER RULING 2026-10-02: the Route Board is a REWARD FOR ALIGNMENT — both versions carry the Back Stairs' allied hard gate
 * (standing with the Jackalopes ALLIED, set by patch-vault-allies), and it is no longer a NOW-card step; the Back Stairs door reaches it.
 * Seeded worlds: patch-template-review-fixes-c-2026-10-02.macro.js makes the same edits in place.
 * Idempotent; backs up the campaigns setting. F5 after.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const KEY = "fixit_farm", Q_MAIN = "quest_nrkJabUwZOLAJFYn", Q_STAB = "quest_bSwOIWzxqNBwJ5NM", Q_PRIS = "quest_uDuNp2yQxbuKkHx7", Q_VAULT = "quest_NwiADv8ZDoklqwEJ";
  const MARKER = "[FIXIT-RETROFIT-2026-09-27]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  // ── 1. personas ────────────────────────────────────────────────────────────
  const SECRETS = {
    "Mara Quickhands": [
      "The Ledger Behind Her Eyes :: stirThePot :: a Steward asks what the Ledger says about THEM, not about the thief :: The weeping prisoner is a test she staged. Miliard is performing; Dougan owes him five beers; the family decides what the Ledger says about newcomers by how they hand out justice, mercy, punishment or indifference. She will deny this to your face and buy you a drink.",
      "Start Grieving or Start Sharpening :: rollPlus2 :: a Steward asks what she does when a runner goes dark :: Both, at once, permanently. Debts the size of a runner she pays personally, and it embarrasses her, and she backs Patter's open-route board with the full weight of her silence."
    ],
    "Pip": ["The Route Fit :: rollPlus2 :: a Steward asks what the Loop FELT like, not what it did :: It fit, like a route he'd been running his whole life without knowing the destination. Something in his chest pulsed green, once. He has decided not to mention it, and just did. He takes the long way around any building that hums."],
    "Patter": ["The Chalked Route :: oppRollMinus2 :: a Steward asks why the board has a route nobody is running :: It's Pip's, kept current, times updated this morning, 'for when he finishes the lesson.' Mara made erasing it a firing offense. Patter will not say the word 'dead'. There is always a route back; that's what routes ARE. She says 'we' for everything Pip-related, tense be damned."],
    "Miliard": ["Five Beers :: rollPlus2 :: after a verdict has been rendered, a Steward asks what Dougan owes him :: Five beers, for the rite. \"I have been told that I am a LOT.\" He will do the crying again if asked nicely, and he will do it better."]
  };
  const NEW_PERSONAS = [
    { name: "Young Gearbox", topics: "the Arc Bay, rigs, the stabilizer, the tarp, the crate, Tetrarch fittings, spanners, doorstops, certifications, Mara, Joans, prices, payment TBD",
      notes: `${MARKER} PRIVATE TRUTH — Young Gearbox runs the Arc Bay: amazing machines of war and discounted air filters, for some values of all. VOICE: cheerful, fast, mercantile, looks you in the eye; "You break it, you buy it. It breaks you, you buy it. Manner of payment TBD." He has the Leyline Stabilizer under a tarp and his boot on it and will not name a price — that's Mara. THE DOORSTOPS: the last three stabilizers that left this yard came back as doorstops because nobody proved the fitting, which is why he asks for the spanner before he asks for anything else, and why he now signs certifications with the fitting DRAWN in the margin. He thinks Garren's signature should weigh something and will say so. Funny first; ashamed of exactly one thing (the doorstops) and honest about it if asked right.`,
      secrets: ["Three Doorstops :: oppRollMinus2 :: a Steward asks what the last three stabilizers became :: Doorstops. Wrong fitting, every one, and nobody brought a spanner to prove it. He signs certifications now with the fitting drawn in the margin, which nobody asked for and everybody should have. One of the three is in the MYSTERY bin."] },
    { name: "Old Gearbox", topics: "the Generator Hall, the generators, load, surge, shielding, redundancy, that one night, the mountain, allies, escort, vibration",
      notes: `${MARKER} PRIVATE TRUTH — Old Gearbox keeps the Generator Hall, a cathedral of vibration, and talks to the generators like a priest because, in his experience, they answer. VOICE: slow, low, reverent, one sentence at a time; "Generators don't care who's in charge. I respect that." He does not stop working to talk; allies get the tour, nobody else gets in. THE SHIELDING: since that one night he has been adding redundant shielding nobody asked for, because the generators felt something from the direction of the mountain and he has been over-building for a surge, or an impact, or both. He does not say 'the Seal' because he doesn't know the word; he says 'weather from the east.'`,
      secrets: ["Redundant Shielding :: rollPlus2 :: allies only; a Steward asks why the NEW shielding, not what's failing :: Someone is preparing for a surge. The generators felt something that one night, from the direction of the mountain, and he has been over-building for it since. 'Weather from the east.' He is right, and he will be right again."] },
    { name: "Furrier", topics: "the back, the cows, the payroll, the Farm, the name on the sign",
      notes: `${MARKER} PRIVATE TRUTH — Furrier is the Furrykin the Farm is named for, and Furrier still won't come out of the back. Canon (bible §2, ruled): at the moment of the Shattering one team-building outing at a petting zoo became three peoples — the ones who said go slow (Jackalopes), the ones who said just grab it (Chupacabra), and the ones who wandered off to look at the cows (Furrykin). Furrier is the one who never stopped looking. VOICE: none on stage. Furrier signs the payroll, has not been seen in two hundred years, and the Farm has his name on the sign because somebody has to. If Mal ever voices Furrier it is one line through a door, about cows, and then the door closes. Never break the bit.`,
      secrets: ["The Cows :: stirThePot :: a Steward asks Mara (or the Counter) what Furrier is DOING back there :: Looking at the cows. Still. The Furrykin wandered off to look at the cows at the moment of the Shattering and Furrier is the one who never stopped. He signs the payroll. Nobody has seen him in two hundred years and the Farm is named for him because somebody has to be."] }
  ];
  const actorIds = {};
  for (const [name, lines] of Object.entries(SECRETS)) {
    const actor = (game.actors?.contents || []).find(a => a.name === name);
    if (!actor) { say(`✗ actor "${name}" not found — secrets skipped`); continue; }
    actorIds[name] = actor.id;
    const cur = actor.getFlag(MAL, "persona") || {}; const raw = String(cur.secretsRaw || "");
    const fresh = lines.filter(l => !raw.includes(l.split("::")[0].trim()));
    if (!fresh.length) { say(`· ok persona ${name}`); continue; }
    changes++; say(`✚ persona ${name} +${fresh.length} secret(s)`);
    if (!DRY_RUN) await actor.setFlag(MAL, "persona", { ...cur, secretsRaw: [raw.trim(), ...fresh].filter(Boolean).join("\n") });
  }
  for (const p of NEW_PERSONAS) {
    let actor = (game.actors?.contents || []).find(a => a.name === p.name);
    if (!actor) { say(`✚ CREATE actor "${p.name}"`); changes++; if (!DRY_RUN) actor = await Actor.create({ name: p.name, type: "npc" }); }
    if (!actor) continue;
    actorIds[p.name] = actor.id;
    const cur = actor.getFlag(MAL, "persona") || {};
    if (String(cur.notes || "").includes(MARKER)) { say(`· ok persona ${p.name}`); continue; }
    const next = { ...cur, topics: [String(cur.topics || "").trim(), p.topics].filter(Boolean).join(", "), notes: [String(cur.notes || "").trim(), p.notes].filter(Boolean).join("\n\n"), secretsRaw: [String(cur.secretsRaw || "").trim(), ...p.secrets].filter(Boolean).join("\n") };
    changes++; say(`✚ persona ${p.name} +${p.secrets.length} secret(s)`); if (!DRY_RUN) await actor.setFlag(MAL, "persona", next);
  }
  for (const n of ["Dougan", "Pip", "Patter", "Mara Quickhands"]) { const a = (game.actors?.contents || []).find(x => x.name === n); if (a) actorIds[n] = a.id; }
  const sp = (n) => actorIds[n] || null;

  // ── 2. beats ───────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of ["fixit_town_walk", "fixit_intro_scene", "fixit_arc_bay_conversation_2", "fixit_leyline_stabilizer", "fixit_backstairs_exterior", "fixit_hex_settles", "fixit_gullywasher_welcome"]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — Fixit was never seeded here.`);
  const sceneOf = (...ids) => { for (const id of ids) { const s = byId.get(id)?.sceneId; if (s) return String(s).replace(/^Scene\./, ""); } return null; };
  const SC = { yard: sceneOf("fixit_town_walk"), stairs: sceneOf("fixit_backstairs_exterior"), arcbay: sceneOf("fixit_arc_bay_conversation", "fixit_arc_bay_conversation_2") };

  const TAGS = "fixit_farm story";
  const beat = (id, label, description, { type = "dialog", speaker = null, choices = null, receipts = null, story = null, requires = null, timePoints = 0, priority = "background", memoryText = null, scene = null } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId: Q_MAIN, tags: TAGS, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority, ...(scene ? { sceneId: scene } : {}), ...(speaker ? { speakerActorId: speaker } : {}),
    story: story || { quest: KEY }, ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(receipts ? { receipts } : {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });
  const P2 = { flag: "storyPhase", gte: 2 };

  const NEW = [
    beat("fixit_mystery_bin", "Furrier's Fixit Farm — The MYSTERY Bin",
      "A drum barrel by the Counter, hand-lettered in three different paints: MYSTERY. AS IS. NO REFUNDS. STOP ASKING. Every Jackalope who passes it pats it like a dog. You are not asking. You are reaching.",
      { scene: SC.yard, requires: [P2], choices: [
        ch("Reach in.", "", { checkStat: "body", checkDC: 10, failNext: "fixit_mystery_bin_fail", description: "A heavy cylinder with a fitting on one end. It is a doorstop. It is, on inspection, a leyline stabilizer with the wrong fitting, and Young Gearbox, from across the yard, says \"one of three.\"" }),
        ch("Pat it.", "", { description: "It is, somehow, warm." }),
        ch("Ask what's in it.", "", { description: "STOP ASKING, says Pip, or Patter, from nowhere." })
      ] }),
    beat("fixit_mystery_bin_fail", "Furrier's Fixit Farm — A Sock",
      "You get a sock. It's a good sock. Wool, no holes, somebody's initials on the cuff in thread. The bin is not warm any more, or it never was, and a Jackalope pats it on the way past and gives you a look that says you should have patted it first.",
      { type: "narration", scene: SC.yard, requires: [P2], choices: [ch("Keep the sock.", "", { description: "It's a good sock." })] }),
    beat("fixit_route_board", "Furrier's Fixit Farm — The Route Board",
      "Up the back stairs the wall is pegs and chalk: every message, light cargo and rumor that crosses the coast gets a peg before it gets a road. One route is chalked in a different hand and kept current — times updated this morning — for a runner who is late. Runners are never late. Patter is juggling three bolts and not looking at it.",
      { speaker: sp("Patter"), scene: SC.stairs, priority: "high", requires: [P2, { questBucket: Q_VAULT, isNot: "completed" }], choices: [
        ch("\"Whose route is that?\"", "", { description: "\"Pip's. For when he finishes the lesson.\" She says WE." }),
        ch("Ask why nobody's erased it.", "", { checkStat: "soul", checkDC: 12, failNext: "fixit_route_board_fail", description: "Mara made it a firing offense. Patter has not said the word 'dead' once, and is not going to, and you stop waiting for her to." }),
        ch("Offer to run it with her.", "", { checkStat: "presence", checkDC: 12, failNext: "fixit_route_board_fail", description: "She stops juggling. \"We go at dusk.\" She means it. So do you." })
      ] }),
    beat("fixit_route_board_fail", "Furrier's Fixit Farm — Four Bolts",
      "She juggles four. Then five. The subject, whatever it was, is somewhere up there with the bolts and she is not going to drop any of them for you. \"Routes are full,\" she says, brightly. \"Come back when one opens.\"",
      { type: "narration", speaker: sp("Patter"), scene: SC.stairs, requires: [P2], choices: [ch("Watch her not drop them.", "", { description: "She doesn't." })] }),
    beat("fixit_route_board_after", "Furrier's Fixit Farm — The Route, Re-chalked",
      "Two routes on the board now, in two hands, side by side and current. Pip's has a new peg on it that says LESSON: DONE in Patter's writing and a smaller peg under it in Pip's that says ISH. Nobody erased anything. That was never how routes work.",
      { speaker: sp("Patter"), scene: SC.stairs, requires: [P2, { questBucket: Q_VAULT, is: "completed" }], choices: [
        ch("Ask what \"ish\" means.", "", { description: "Pip, from the third step: \"Extra credit.\"" }),
        ch("Ask Pip what the Loop felt like.", "", { description: "He rubs his sternum and says it fit. Then he says he's decided not to mention that, and has." })
      ] }),
    beat("fixit_load_the_crate", "Furrier's Fixit Farm — Load the Crate",
      "The crate is roped on the sledge and Young Gearbox is writing on a card in block capitals with a fitting drawn in the margin: TETRARCH. \"First certification since the Cough that says what it fits,\" he says, and blows on the ink. \"Tell your man Garren to sign his slowly. Signatures should weigh something.\"",
      { speaker: sp("Young Gearbox"), scene: SC.arcbay, priority: "high", requires: [P2, { questBucket: Q_STAB, is: "completed" }],
        receipts: [{ label: "The Certification", effectKey: "rollPlus2", acquisition: "earned", source: { name: "Young Gearbox, in block capitals" },
          truth: "Signed by Young Gearbox, fitting drawn in the margin: TETRARCH. The first stabilizer certification since the Cough that says what it fits. Show it to Pike and he will finally ask who signed the last one. Show it to Garren and his hands will shake, after." }],
        choices: [
          ch("Ride home to Garren.", "ride_back_home"),
          ch("Ask about the three doorstops.", "", { description: "\"Wrong fitting. Every one. Nobody brought a spanner.\" He taps the drawing in the margin. \"Nobody's forgetting again.\"" })
        ] })
  ];
  const FIXIT_NEW = NEW.map(b => b.id);
  const BOARD_BEATS = ["fixit_route_board", "fixit_route_board_after"];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  const addChoice = (id, c, what) => edit(id, b => { if (!(b.choices || []).some(x => x.next === c.next && x.label === c.label)) b.choices = [...(b.choices || []), c]; }, what);
  // wiring
  addChoice("fixit_town_walk", ch("The bar. First round's cultural.", "fixit_gullywasher_welcome"), "yard → the Gullywasher welcome");
  addChoice("fixit_intro_scene", ch("The bar. First round's cultural.", "fixit_gullywasher_welcome"), "hub → the Gullywasher welcome");
  addChoice("fixit_arc_bay_conversation_2", ch("Get Mara. Talk.", "fixit_leyline_stabilizer"), "routes to the stabilizer");
  addChoice("fixit_leyline_stabilizer_delay", ch("Come back tomorrow.", "fixit_leyline_stabilizer", { description: "Mara's price has not changed. Neither has Mara." }), "delay can come back");
  edit("fixit_backstairs_exterior", b => { for (const c of b.choices || []) if (c.label === "Go up" && !c.next) { c.next = "fixit_route_board"; c.description = "The runner loft. The board is the first thing you see and the last thing you look at."; } if (!(b.choices || []).some(c => c.next === "fixit_route_board_after")) b.choices.push(ch("Go up (after the Vault)", "fixit_route_board_after", { requires: { questBucket: Q_VAULT, is: "completed" } })); }, "Go up → the Route Board");
  // REVIEW 2026-10-01 (LOW ×2): (1) the new beats were built repeatable — Young Gearbox re-offered Load the Crate in every talk and it re-granted
  // THE CERTIFICATION; none of them is a hub, so all are once-only (a route still plays them again). (2) the plain "Go up" led to the PRE-Vault
  // board after the Vault — it hides once the Vault is done (the after-Vault choice takes over).
  for (const id of FIXIT_NEW) edit(id, b => { b.inject = b.inject || {}; if (b.inject.repeatable !== false) b.inject.repeatable = false; }, "once-only (repeatable:false)");
  edit("fixit_backstairs_exterior", b => { const up = (b.choices || []).find(c => c.label === "Go up" && c.next === "fixit_route_board"); if (!up) return; const r = Array.isArray(up.requires) ? up.requires : (up.requires ? [up.requires] : []); if (!r.some(x => x && x.questBucket === Q_VAULT)) up.requires = [...r, { questBucket: Q_VAULT, isNot: "completed" }]; }, "\"Go up\" hides after the Vault");
  edit("fixit_gullywasher_welcome", b => { for (const c of b.choices || []) if (/amber thing/i.test(c.label) && !c.description) c.description = "Carbonated, aggressively. It is, on balance, a drink. The second one costs where you're from."; }, "the amber thing gets a line");
  edit("fixit_intro_scene", b => { if (!String(b.description || "").trim()) b.description = "The yard, from the middle of it: generators, chimes, the OPEN!!! sign, a Chupacabra visible through a bar window washing a glass and looking at you the way you are looking at him. Everything here is for sale, for some values of sale, and everybody here is deciding what you are."; }, "hub gets a description");
  edit("fixit_arc_bay_conversation", b => { if (!String(b.description || "").trim()) b.description = "Amazing machines of war and discounted air filters, and Young Gearbox in the middle of it with his boot on a tarp that has a shape under it. He is delighted to see you. He is delighted to see anyone. \"Browse,\" he says. \"Touch nothing. Ask anything.\""; }, "Arc Bay gets a description");
  // an ungated internal fail beat that gains a voice becomes "offerable" — give it the act gate its neighbours have (lint P07)
  edit("fixit_leyline_trade_fail", b => { b.inject = b.inject || {}; if (!b.inject.requires) b.inject.requires = [P2]; }, "act gate");
  // OWNER RULING 2026-10-02: the Route Board (both versions) is a reward for alignment — the same allied hard gate the Back Stairs carry
  // (patch-vault-allies: `{ relation: <Jackalopes>, is: "allied" }`, hardGate = checked on every path). Read off the stairs so both stay one gate.
  { const reqsOf = (x) => Array.isArray(x) ? x : (x && typeof x === "object" ? [x] : []);
    const ALLY = reqsOf(byId.get("fixit_backstairs_exterior")?.inject?.requires).find(r => r && r.relation && r.is === "allied") || null;
    if (!ALLY) say("✗ fixit_backstairs_exterior has no allied gate (run patch-vault-allies first) — the Route Board is NOT gated; re-run after");
    else for (const id of BOARD_BEATS) edit(id, b => { b.inject = b.inject || {}; const r = reqsOf(b.inject.requires).slice(); if (!r.some(x => JSON.stringify(x) === JSON.stringify(ALLY))) b.inject.requires = [...r, { ...ALLY }]; if (b.inject.hardGate !== true) b.inject.hardGate = true; }, "allies only (the Back Stairs' hard gate)"); }
  // speakers
  const voice = (ids, name) => { for (const id of ids) edit(id, b => { if (!b.speakerActorId && sp(name)) b.speakerActorId = sp(name); }, `speaker ${name}`); };
  voice(["fixit_gullywasher_interior_convo", "fixit_gullywasher_choice_1", "fixit_gullywasher_choice_2", "fixit_gullywasher_choice_3", "fixit_gullywasher_choice_4", "fixit_gullywasher_choice_1_fail", "fixit_gullywasher_choice_2_fail", "fixit_gullywasher_choice_3_fail", "fixit_gullywasher_choice_4_fail", "fixit_gullywasher_welcome", "fixit_gully_answer_name"], "Dougan");
  voice(["fixit_arc_bay_conversation", "fixit_arc_bay_conversation_1", "fixit_arc_bay_conversation_2", "fixit_arc_bay_conversation_3", "fixit_leyline_stabilizer", "fixit_no_spanner"], "Young Gearbox");
  voice(["fixit_power_station_conversation", "fixit_power_station_conversation_2"], "Old Gearbox");
  voice(["fixit_general_store_coversation", "fixit_general_store_coversation_1", "fixit_general_store_coversation_2", "fixit_general_store_coversation_3", "fixit_leyline_trade_fail"], "Mara Quickhands");
  voice(["fixit_pip_and_patter_convo", "fixit_pip_and_patter_convo_1", "fixit_pip_and_patter_convo_2", "fixit_backstairs_exterior"], "Patter");

  // ── 3. story script ────────────────────────────────────────────────────────
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {}, scripts: {} };
  const codeQuest = code.quests?.[KEY], codeScript = code.scripts?.[KEY];
  if (!codeQuest || !codeScript) say("✗ code story for fixit_farm not readable — story script NOT written (hard-reload and re-run)");
  const QUEST = codeQuest ? JSON.parse(JSON.stringify(codeQuest)) : null;
  const SCRIPT = codeScript ? JSON.parse(JSON.stringify(codeScript)) : null;
  let PREV_SCRIPT = null;
  if (SCRIPT) {
    const old = Object.fromEntries(SCRIPT.steps.map(s => [s.id, s]));
    // (2026-10-02: the board step is built, then dropped — PREV_SCRIPT, the pre-ruling output, lets the overwrite guard below recognise it)
    const BOARD_STEP = { id: "board", label: "The Route Board", line: "Patter keeps a route chalked on the board for a runner who is late. Runners are never late. Ask why nobody's erased it.", beats: ["fixit_route_board", "fixit_route_board_after"], done: { anyOf: ["fixit_route_board", "fixit_route_board_after"] } };
    SCRIPT.steps = [
      { ...old.browsing, line: "Take the lap. Pip or Patter will show you the yard, once, fast. The MYSTERY bin says STOP ASKING." },
      { id: "gully", label: "First Round's Cultural", line: "There's a Chupacabra behind the bar. He's the bartender. First one's on the Farm; the second costs where you're from.", beats: ["fixit_gullywasher_welcome"] },
      { id: "counter", label: "The Counter Quotes Weight", line: "The Counter has no price list, only pause. Ask Mara what her biggest headache is. It's you. Ask anyway.", beats: ["fixit_general_store_coversation"] },
      { ...old.arcbay, line: "The Arc Bay is full of things you cannot afford and one thing you came for. Young Gearbox has it under a tarp and Mara has it under a price." },
      old.stabilizer,
      { id: "bin", label: "The MYSTERY Bin", line: "AS IS. NO REFUNDS. STOP ASKING. Reach in anyway.", beats: ["fixit_mystery_bin"] },
      BOARD_STEP,
      old.prisoner,
      { id: "load", label: "Load the Crate", line: "Gearbox signs the certification with the fitting drawn in the margin. Tell Garren to sign his slowly.", beats: ["fixit_load_the_crate"] },
      { ...old.settles, line: "The Farm has stopped auditioning you. Ride home to Garren before the paint on the sign dries." }
    ].filter(Boolean);
    const doorLine = { pip: "Pip and Patter move in synch with everything that moves. Ask what's moving near Allesh. Both will answer, at once." };
    for (const d of (SCRIPT.doors || [])) if (doorLine[d.id]) d.line = doorLine[d.id];
    if (!(SCRIPT.doors || []).some(d => d.id === "bin")) SCRIPT.doors = [...(SCRIPT.doors || []), { id: "bin", label: "The MYSTERY Bin", line: "AS IS. NO REFUNDS. STOP ASKING. Pat it first.", beats: ["fixit_mystery_bin"] }];
    PREV_SCRIPT = JSON.parse(JSON.stringify(SCRIPT));
    // OWNER RULING 2026-10-02: the Route Board is an allies' reward, not a NOW-card step (the Back Stairs door reaches it)
    SCRIPT.steps = SCRIPT.steps.filter(s => s.id !== "board");
  }
  const haveData = storyApi?.get?.(campaignId) || {};
  const questChanged = QUEST && JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST);
  let scriptChanged = SCRIPT && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || questChanged);
  // REVIEW 2026-10-01: never clobber live story data edited after seeding (✦ Script editor, a wordsmithing pass, a dated patch macro). Write only
  // when the live quest+script are missing, still the plain code copy, or already this output; anything else is reported and left alone.
  { const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null), lS = haveData.scripts?.[KEY], lQ = haveData.quests?.[KEY];
    if (scriptChanged && !((!lS || same(lS, codeScript) || same(lS, SCRIPT) || same(lS, PREV_SCRIPT)) && (!lQ || same(lQ, codeQuest) || same(lQ, QUEST)))) { scriptChanged = false; say(`⚠ story script ${KEY}: live campaign.story was edited after seeding — NOT overwritten (repair seeded worlds with the dated patch-*-review-fixes macros)`); } }
  if (scriptChanged) { changes++; say(`✦ story script fixit_farm → campaign.story (${SCRIPT.steps.length} steps, ${SCRIPT.doors.length} doors)`); } else if (SCRIPT) say("· ok story script (already)");

  console.log(`[seed-fixit-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Fixit retrofit DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Fixit retrofit: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-fixit-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  ui.notifications.info(`Fixit retrofit APPLIED: ${changes} change(s). STOP ASKING. F5.`);
})();

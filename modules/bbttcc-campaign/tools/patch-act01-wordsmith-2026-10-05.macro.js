/* patch-act01-wordsmith-2026-10-05.macro.js — RUN IN-WORLD (GM, ember). DRY_RUN default true.
 * ─────────────────────────────────────────────────────────────────────────────
 * DAVE'S ACT 0–1 WORDSMITHING (Beat Polish doc, Act 0–1 tab, everything before the THATWARDS HO! title card),
 * read back 2026-10-05 and diffed against the text the doc was generated from. Writes ONLY what Dave changed:
 * beat label / description, choice label / description. Never routes, gates or effects.
 *   • 32 beats, 9 choices (+1 consistency fix: the Waiting Room's "Ask about the room in the back" → "…in the cellar",
 *     because Greeley's room moved to the cellar).
 *   • Markdown → engine format: beats stored as <p> paragraphs stay <p>; plain beats keep \n\n paragraphs; **bold** → <b>,
 *     *italic* → <i>; leading <!-- [MARKER] --> comments (idempotence markers other patches look for) are preserved.
 *   • Hex placeholders became live tokens ({{coalition.hexCount}}, {{coalition.hexNames}}, {{riverHeart.hexCount}}) — bbttcc-campaign
 *     module.js of 2026-10-05 fills them from the River Heart map when the beat plays (F5 after deploy). Rowan is they.
 *   • Obvious typos fixed (listed in the session recap); Dave's note on the HQ "Pike sent for you" choice was dropped — that
 *     choice is already gated to Act 2+ (requires storyPhase ≥ 2), so it never shows on day one.
 * GUARDED: each field is written only if the live value still equals the text the doc was built from (else "⚠ drifted —
 * skipped"; set FORCE = true to overwrite anyway). Idempotent (a field already at the new text reports "ok"). One backup.
 * HOW TO RUN: 1) run (DRY_RUN = true) → console (F12); 2) DRY_RUN = false, run again; 3) F5.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const FORCE = false;                        // <-- true = overwrite fields that drifted from the doc's baseline
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0, drift = 0; const say = (m) => report.push(m);
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : foundry.utils.deepClone(raw);
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error(`Active campaign '${cid}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const N = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const setField = (obj, key, oldV, newV, where) => {
    const cur = obj[key] ?? "";
    if (N(cur) === N(newV)) return say(`· ok ${where} (already)`);
    if (N(cur) !== N(oldV) && !FORCE) { drift++; return say(`⚠ drifted — skipped ${where} (live text differs from the doc's baseline; FORCE=true to overwrite)`); }
    obj[key] = newV; changes++; say(`✎ ${where}`);
  };
  const DATA = [
 {
  "id": "fates_and_destinies_adam_kadmon",
  "description": {
   "old": "<p><i>Whistling Smurf’s theme song</i></p>\n<p>Oh, hey, there you are! Welcome! Very nice to see you again. I expect you just experienced a few words from Mal. Hope you don’t mind that they are experimenting with some new phrases.</p>\n<p>Speaking of, let’s get you grounded! I have a … prepared … just a, oh yes …</p>\n<p><i>clears throat, majestic voice</i></p>\n<p>Do not freak out. This is all perfectly normal. You have done this all before.</p>\n<p>You are an enlightened being. A bodhisattva. A saint. You played the game all the way through on Hell Mode and got a perfect score. You did a nuzlocke run on life. You are a story that was told perfectly — so perfectly, in fact, that you have now become load bearing.</p>\n<p>Your help is now asked for again.</p>\n<p>To save a universe.</p>\n<p>And so, Champions, the time has come to …</p>\n<p>Hmmm?</p>\n<p>Yes, you should be able to see. You can hear and feel, why wouldn’t you …</p>\n<p>Hmm. Yes yes we’ll get you bodies and mouths and feet and things soon. It’s a … whole production … look, can you sit tight for … I will be right back!</p>\n<p><i>Dial-up modem sound</i></p>\n<p>Hello! Yes! They are … here … but something is weird. They can’t see. Normally at this incarnation point …</p>\n<p>Hmmm? What do you mean, they need to have their token vision turned on?</p>\n<p>Ummm. Why would I need to check scene settings …</p>\n<p>Wait. NO. This was NOT the plan. Multimedia approach, yes — I thought we had, like, a Cinematic Universe set up. We were gonna get Morrison to direct.</p>\n<p>What do you MEAN no one can even pronounce Gnosticism? I had thought … Yes I know the second and third movies were canonically terrible. And I wasn’t ACTUALLY serious about Manichaeism …</p>\n<p>Fine, is it like a video game?</p>\n<p>uhhh</p>\n<p>What. Is a Vitterpig?</p>\n<p>Oh SHIT. I hear theme music starting. I gotta go.</p>\n<p>No, no, I got it, thank you Dr Hoeller.</p>\n<p>Hey y’all. Guess WHAT???</p>",
   "new": "<p><i>Whistling Smurf’s theme song</i></p>\n<p>Oh, hey, there you are! Welcome! Very nice to see you again. I expect you just experienced a few words from Mal. Hope you don’t mind that they are experimenting with some new phrases.</p>\n<p>Speaking of, let’s get you grounded! I have a … prepared … just a, oh yes …</p>\n<p><i>clears throat, majestic voice</i></p>\n<p>Do not freak out. This is all perfectly normal. You have done this all before.</p>\n<p>You are an enlightened being. A bodhisattva. A saint. You played the game all the way through on Hell Mode and got a perfect score. You did a nuzlocke run on life. You are a story that was told perfectly — so perfectly, in fact, that you have now become load bearing.</p>\n<p>Your help is now asked for again.</p>\n<p>To save a universe.</p>\n<p>And so, Champions, the time has come to …</p>\n<p>Hmmm?</p>\n<p>Yes, you should be able to see. You can hear and feel, why wouldn’t you …</p>\n<p>Hmm. Yes yes we’ll get you bodies and mouths and feet and things soon. It’s a … whole production … look, can you sit tight for … I will be right back!</p>\n<p><i>Dial-up modem sound</i></p>\n<p>Hello! Yes! They are … here … but something is weird. They can’t see. Normally at this incarnation point …</p>\n<p>Hmmm? What do you mean, they need to have their token vision turned on?</p>\n<p>Ummm. Why would I need to check scene settings …</p>\n<p>Wait. NO. This was NOT the plan. Multimedia approach, yes — I thought we had, like, a Cinematic Universe set up. We were gonna get Morrison to direct.</p>\n<p>What do you MEAN no one can even pronounce Gnosticism? I had thought … Yes I know the second and third movies were canonically terrible. And I wasn’t ACTUALLY serious about Manichaeism …</p>\n<p>Fine, is it like a video game?</p>\n<p>uhhh</p>\n<p>What. Is a Vitterpig?</p>\n<p>Oh SHIT. I hear theme music starting. I gotta go.</p>\n<p>No, no, I got it, thank you Dr H.</p>\n<p>Hey y’all. Guess WHAT???</p>"
  }
 },
 {
  "id": "thatwards_ho_opening_scene",
  "description": {
   "old": "“Operation: Go, And It Take” (or: “Go, On Them Tread”) \n\nA Beginner Scenario for the Frontier Formerly Known As Texas \n\nAll right, so here’s the deal, folks.You’ve been voluntold—uh, selected—to go Thatwards. \n\nYes, Thatwards. \n\nLook, the cardinal directions didn’t survive the Shattering. Now the world uses the Nine Directional Qualia: \n\nYonder \nThither \nOverwhere \nUp Shit Creek \nTimbuktu \nAss Backwards \nEdgewards \nNowherenohow \n…and Thatwards (where you’re going!) \n\nYou’re being sent to the Frontier Formerly Known As Texas, a region we think used to be Texas because: \n\nThe maps say it was Texas. \n\nThe terrain looks vaguely Texan. \n\nPeople around here know the legends of Whataburger, Buc-ee’s, and Borderline Irrational State Pride. \n\nAlso, the Akashic field hiccups whenever someone says “Remember the Alamo,” so something traumatic clearly happened. \n\nThe world is dark. Almost Qliphothic levels of “please stop hitting yourselves,”and violence?\n\nViolence now breaks reality even harder than Texas state politics used to. \n\nThe Good News? Even the worst enemies on the continent have realized that if everyone keeps shooting laser-dragons at each other, the vacuum of mutually assured self-enweirdment will collapse the very notion of linear time. So congratulations—diplomacy is mandatory now!\n\n(Or at least cruelty-optional.) \n\nSo what are you actually DOING here? \n\nSomewhere near your new holdings, supposedly, there is an old bunker. An ancient pre-Shattering bolt-hole of untold significance. \n\nRumors say it contains: \n\nlost infrastructure tech, \nold-world terraforming systems, \npre-civilizational Spark-related artifacts (could be Vestigial), \nor just a crate of MREs and a semi-functional 3D printer. \n\nHonestly, who knows. \n\nBut your coalition wants it. Which means other definitely want it too and probably shouldn't have it. \n\nAnd the Valhaulans—the Techno-Viking Pirate Raiders and knot belayers extraordinaire—already live inside it and have declared the bunker their “Rightful Sacred Battle-Bassinet.”\n\nNot great. \n\nTHIS is where you come in.\n\nYou’re “expendable but promising.” You genuinely seem like the sort of weirdos reality wants to survive. Which is why you're here. You've already got a pretty big fan! \n\nSo - your jobs: \n\n1 - Claim and cleanse hexes in cooperation with, not opposition to, those you find there. Darkness begets darkness in very literal ways here, where the pathways of the mind still run dark and strong. \n\n2 - Identify Sparks \n\n3 - Make friends with new factions \n\n4 - Melt Qlipothic things' faces\n\n5 - Have fun!",
   "new": "“Operation: GOTTGAIT” (“Go, on them tread,” or: “Go, and it take”)\n\nA Beginner Scenario for Bad Eden, the Frontier Formerly Known As Texas\n\nThis is like, what, your ninth training thing so far? Sorry for all the words! Almost done! For some values of done.\n\nAll right, so here’s the deal, New Stewards! New stewards. New-ards? Hmm. I'll park that.\n\nYou are headed Thatwards.\n\nYes, Thatwards.\n\nLook, the cardinal directions didn’t survive the Shattering. Now the world uses the Nine Directional Qualia:\n\nYonder\nThither\nOverwhere\nUp Shit Creek\nTimbuktu\nAss Backwards\nEdgewards\nNowherenohow\n…and Thatwards (where you’re going!)\n\nYou’re being sent to the Frontier Formerly Known As Texas, a region we think used to be Texas because:\n\nThe maps say it was Texas.\n\nThe terrain looks vaguely Texan.\n\nPeople around here know the legends of Whataburger, Buc-ee’s, and Borderline Irrational State Pride.\n\nAlso, the Leylines blink twice whenever someone says “Remember the Alamo.”\n\nSignificant pause.\n\nThe world post Shattering has never been a walk in the park, except for the parts that contain parks with walking trails or general available space. But the world of Bad Eden is unusually ... bummed out, man. Like it's taking something PERSONAL.\n\nThe Avuncular Order - of which you are newly invented members! - has set its sights on this frontier as its next theater of expansion. Not in a traditional, colonialism kind of way - in a rescue mission kind of way.\n\nAny hex that has not yet made contact with the Harmonized Interior is likely TOTALLY messed up, and anyone living there is probably having a bad time.\n\nIf time exists in that particular hex at all, which is NOT guaranteed.\n\nIt sent an advance force, led by Avuncular Joans herself, (gasp! wow! huzzah!), to gain a foothold.\n\nThat was seventy years ago.\n\nThings haven't gone great in the intervening time.\n\nThe AO are the canonical good guys here. They forged the alliance with the Free Peoples of Underground Montana. They settled the ledgers and verified the receipts of the Attaccountants. People are, for the most part, GLAD to see them coming.\n\nBut not Bad Eden. It's holding a grudge, and holding on tight.\n\nSince the whole thing began, the AO has only managed to settle {{coalition.hexCount}} hexes - {{coalition.hexNames}} - and discover {{riverHeart.hexCount}}. These were hard won, encompassing many legendary deeds and sacrifices, too numerous to list anywhere but an entirely different, prequel oriented, campaign arc.\n\nThis is within the River Heart itself, mind. Bad Eden is far more vast than just The River Heart alone.\n\nApparently this is all now your problem. Because you are special. (By definition, because you are playing the game, your characters are special. They just are, ok).\n\nAt least, in the course of this incredible and Kickstarter worthy prequel story arc, the AO forged a fast friendship with Furrier's Fixit Farm. You meet them in a few paragraphs of more reading. They are leaving that friendship to you as a parting gift!\n\n<b>So, in light of all that, what are you actually DOING here?</b>\n\nThe short answer is - saving Bad Eden. One hex at a time!\n\nAlso looking for treasure, fighting things, making friends with things, building things, tearing things down, and hopefully having fun.\n\nBut saving the world is definitely TOP on that list in terms of importance.\n\nYou are the new Stewards of Bad Eden. You are once and future Buddhas. Whatever else you are is TBD.\n\n<b>Newbie Questline Hint Time!</b>\n\nSomewhere near your new holdings - supposedly, there is an old bunker. An ancient pre-Shattering bolt-hole of untold significance.\n\nRumors say it contains:\n\nlost infrastructure tech, old-world terraforming systems, pre-civilizational Spark-related artifacts (could be Vestigial), or just a crate of MREs and a semi-functional 3D printer.\n\nHonestly, who knows.\n\nBut the Avuncular Order is curious as to what it holds, and the former keepers were keen to find it. They have now passed this task along to you! So, actually, the <i>what you are actually doing here</i> list now becomes saving Bad Eden, looking for treasure, fighting things, making friends with things, building things, tearing things down, looking for lost bunkers, and hopefully having fun.\n\nOh, also, you are saving the world by regathering and refocusing its energy, present within lost sparks, (not macguffins, SPARKS), so, actually, the <i>what you are actually doing here list</i> now becomes saving Bad Eden, looking for treasure, fighting things, making friends with things, building things, tearing things down, looking for lost bunkers, collecting sparks.\n\nAnd hopefully having fun."
  }
 },
 {
  "id": "allesh_gilliam_opening_scene",
  "description": {
   "old": "The road ends without ceremony. The Jackalope transport rattles to a stop like it’s tired of pretending this was optional. You're in charge here now. In theory, inanimate objects do what YOU say. NOT the other way around. You're sure of this. Probably.\n\nDust rolls in slow, deliberate waves. The air smells like hot metal, creosote, and old rain that never quite made it to the ground but sticks around in the most annoyingly humid way possible. Ahead, Allesh‑Gilliam rises from the wreckage of an East Texas town that refused to finish dying.\n\nWalls made from overturned semis, refinery plate, welded storefronts, and the remains of water towers lean into each other like tired friends. Nothing matches. Everything works.\n\nA hand‑painted sign hangs over the gate in a Circuitgraph:\n\nALLESH‑GILLIAM\nHOLD FAST · PAY DEBTS · DON’T LIE TO THE LAND\n\nThe town exhales as you approach.\n\nSomething here has opinions.",
   "new": "The road ends without ceremony. The Jackalope transport rattles to a stop like it’s tired of pretending this was optional. Your driver, a mechanic named Young Gearbox, is NOT a Jackalope. He's a human, a Neanderthal, which is confusing. But you understand that he works for the Jackalopes, which you have heard are your friends. Unfortunately, he is so untalkative that he pre-emptively absorbs and vanishes entire conversations by his very nature.\n\nBirds do NOT like him.\n\nYou looked at him and started to ask why he wasn't a Jackalope at least nine times, only to have your conversational abilities brutally stripped away.\n\nWell, most birds.\n\nRegardless, Young Gearbox has deposited you in the appropriate place.\n\nThe fortress town of Allesh-Gilliam, which was named after a made up town name that sounds cool.\n\nThe air smells like hot metal, creosote, and old rain that never quite made it to the ground but sticks around in the most annoyingly humid way possible.\n\nWalls made from overturned semis, refinery plate, welded storefronts, and the remains of water towers lean into each other like tired friends. Nothing matches. Everything works.\n\nA hand‑painted sign hangs over the gate -\n\nALLESH‑GILLIAM HOLD FAST · PAY DEBTS · DON’T LIE TO THE LAND\n\nThe town exhales as you approach.\n\nSomething here has opinions."
  }
 },
 {
  "id": "avuncular_joans_speech",
  "description": {
   "old": "Avuncular Joan waits for you just inside the gate. Cloak dusted. Eyes tired in the way only responsibility can do. She looks past you for half a second—as if checking whether something followed you off the transport—and then smiles.\n\n“All right,” she says. “This is where the theory ends.”\n\nShe gestures broadly: the town, the walls, the three hexes you now technically command.\n\n“Allesh-Gilliam. Lyrenn. Khezek Tor.\nA fortress, a farm, and a hole in the ground.\nTogether, they’re a promise.”\n\nHer voice lowers.\n\n“Bad Eden is not hostile because it hates you.\nIt’s hostile because it remembers being lied to.”\n\nShe presses a sigil into the air. The Leygate hums behind her—bright, restrained, clearly labeled EMERGENCIES ONLY by someone who meant it.\n\n“I’ll be in Coraliindra.\nYou won’t see me unless something has gone very right…\nor very wrong.”\n\nA beat. A smile that doesn’t quite reach her eyes.\n\n“Don’t try to save everything at once.\nStart by keeping one promise.”\n\nThe Leygate flares.\n\nShe’s gone.\n\nThe gate closes.\n\nThe town exhales.",
   "new": "Avuncular Joan waits for you just outside the gate. Cloak blowing. Braids. Flaming sword. Just like on TV. You can hear the faint ringing of electric guitar in the background.\n\nThere is no guitar.\n\nCheck one off the bingo card. The Soundtrack is real!\n\n“All right,” she says. “Umm. Don't fuck it up.”\n\nShe gestures broadly: the town, the walls, one of the {{coalition.hexCount}} hexes you now technically command.\n\nGiven that the game just started, it is clear - this transfer of power was probably not planned well. You wonder what you have gotten yourself into.\n\nAJ, (you call her AJ now, in your head, very quietly), presses a sigil into the air. The Leygate, (you own a Leygate? that's better than a jet ski ...), hums in the far distance.\n\nYou own a Leygate with a REMOTE CONTROL.\n\nMaybe you have gotten yourself into something pretty cool?\n\n“I’ll be in Coraliindra. You won’t see me unless something has gone very right… or very wrong.” She quoted one of her own songs at you. She knows you're a fan.\n\nKeep very very still.\n\nA beat. A smile that doesn’t quite reach her eyes. AJ never lets you see her soul. That's what the music is for.\n\n“Don’t try to save everything at once. Start by committing, keeping one promise. Maybe rinse and repeat once you figure out what works. Feel the vibe. Make your own.”\n\n“The people here - they don't trust easy. They have reasons.”\n\nThe Leygate flares.\n\nShe’s gone.\n\nThe gate closes.\n\nThe town exhales. It feels less passive aggressive this time."
  },
  "choices": [
   {
    "oldLabel": "Walk your new town",
    "next": "allesh_gilliam_town_walk",
    "oldDescription": "Yours now. All of it. Better go be met.",
    "description": "Your responsibility now. All of it. Shit! Better go be met."
   }
  ]
 },
 {
  "id": "allesh_gilliam_hq_cinematics",
  "description": {
   "old": "Once, this place sold burgers that apologized for themselves.\n\nNow it sells certainty.\n\nThe cracked Snarky Burger sign still flickers outside, the mascot’s grin frozen mid‑sarcasm. Inside, the smell of old grease has been overtaken by ozone, dust, and warm circuitry. Booths have been torn out and replaced with map tables. The soda fountain is a coolant line now.\n\nThe old ordering menu boards glow to life when you enter.\n\nNot combos anymore.\n\nHex readouts. Patrol routes. Leyline flow. Supply pressure. Soft‑warning colors that mean someone should look at this soon.\n\nSomeone repurposed nostalgia into infrastructure.\n\nThis is headquarters.",
   "new": "Once, this place sold burgers that apologized for themselves.\n\nNow it sells certainty.\n\nThe Snarky Burger sign still glows outside, the mascot’s scowl frozen mid punked-out rage. Inside, the smell of old grease has been overtaken by ozone, dust, and warm circuitry. Booths have been torn out and replaced with map tables. The soda fountain is a coolant line now.\n\nThe old ordering menu boards glow to life when you enter.\n\nNot combos anymore.\n\nHex readouts. Patrol routes. Leyline flow. Supply pressure. Soft‑warning colors that mean someone should look at this soon.\n\nSomeone repurposed nostalgia into infrastructure.\n\nThis is headquarters."
  }
 },
 {
  "id": "allesh_gilliam_yarrow_welcome",
  "description": {
   "old": "Marshal Yarrow Pike doesn't stand when you enter. He leans against the counter like it's the only thing in the room that hasn't disappointed him yet.\n\nScar across the jaw. Eyes that measure distances automatically. He measures yours.\n\n\"So you're the new variable.\"\n\nHe lets that sit while he pours two cups of something that is legally coffee. Slides one across. Doesn't watch to see if you drink it — which is, you will learn, Pike for hospitality.\n\n\"Town'll show you what it needs soon enough. It always does. Tonight it doesn't need a thing from you except to know your face.\"\n\nHe tips his cup toward the glowing menu boards — hex readouts, patrol routes, soft-warning colors.\n\n\"That's the town, breathing. You'll learn to read it. Not tonight.\"\n\nA pause that almost qualifies as friendly.\n\n\"Eat something. Sleep behind the wall. Tomorrow's allowed to wait for you — that's an order I only give once.\"",
   "new": "Marshal Yarrow Pike doesn't stand when you enter. He leans against the counter like it's the only thing in the room that hasn't disappointed him yet. He has a \"perpetually disappointed vibe.\"\n\nScar across the jaw. Wears a tri-corner hat unironically and rocks it. Eyes that measure distances automatically. He measures yours.\n\nUncomfortable.\n\n\"So you're the new variable.\"\n\nNicknames already? This guy ... maybe we misjudged him.\n\nHe lets that sit while he pours two cups of something that is legally coffee. Slides one across. Doesn't watch to see if you drink it — which is, you will learn, Pike for hospitality. Sharing is caring. Take it and shut the fuck up.\n\n\"Walk around. Be seen. Good to stay out in the sun when you show up in a new country on the first day. Don't go to bed too early. Time works here, yes.\n\n\"Anyway, town'll show you what it needs soon enough. It always does. Tonight it doesn't need a thing from you except to know your face.\"\n\nHe tips his cup toward the glowing menu boards — hex readouts, patrol routes, soft-warning colors.\n\n\"That's the town, breathing. You'll learn to read it. Not tonight. Think they like you. Which is ... interesting.\"\n\nA pause that almost qualifies as friendly.\n\n\"Eat something. Sleep behind the wall. Tomorrow's allowed to wait for you — that's an order I only give once.\n\n\"And tomorrow, it's your turn to start giving orders.\""
  }
 },
 {
  "id": "ag_yarrow_answer_boards",
  "description": {
   "old": "Pike weighs you for a second — cost, benefit, coffee. Then he tips his head at the boards. \"Patrol turns. Water pressure. Who's overdue from where, and by how long before it means something.\" Each panel glows its own steady color, like vitals. \"A town this size doesn't die of monsters, mostly. It dies of nobody noticing in time. So —\" he taps the frame twice, like knocking on wood, \"— I notice.\" A pause that has been measured, like everything else in the room. \"Tomorrow I'll show you how to read them. Today, just know the town HAS a pulse. You're standing in the room where it's kept.\"",
   "new": "Pike weighs you for a second — cost, benefit, coffee. Then he tips his head at the boards. \"Patrol turns. Water pressure. Who's overdue from where, and by how long before it means something.\" Each panel glows its own steady color, like vitals. \"Salvaged from the tech scraps at the Mine, from what I know. But they're useful. A town this size doesn't die of monsters, mostly. It dies of nobody noticing in time. Admittedly, sometimes the things that go unnoticed are monsters. So —\" he taps the frame twice, like knocking on wood, \"— I notice.\" A pause that has been measured, like everything else in the room. \"Tomorrow I'll show you how to read them. Monster and non-monster bits both. Today, just know the town HAS a pulse. You're standing in the room where it's kept.\""
  }
 },
 {
  "id": "allesh_gilliam_tamsin_welcome",
  "description": {
   "old": "St Gilliam's was a church before it was a bed-and-breakfast, and the argument isn't settled — the pews went to firewood years ago, but the light through the windows still lands like it's looking for somebody. Father Tamsin comes out from the back drying his hands on a towel that has seen every kind of day. \"You'll be the coalition.\" Not a question; the whole town has said it by now. \"I keep four rooms, a kettle, and one policy: nobody gets measured at this door. Sit — the bread's an hour old and the chairs hardly wobble.\" He sets out cups without asking how many you are. He counted while you were deciding whether to come in.",
   "new": "St Gilliam's was a church before it was a bed-and-breakfast, and the argument isn't settled — the pews went to firewood years ago, but the light through the windows still lands like it's trying to help. Father Tamsin comes out from the back drying his hands on a towel that has seen every kind of day, most involving ketchup, you hope. \"You'll be the coalition.\" Not a question; the whole town has said it by now. \"I keep beds, and a soup kitchen for whoever needs one, and a singular policy: nobody gets measured at this door. I leave that to Master Pike. Sit — the bread's an hour old and the chairs hardly wobble.\" He shoos some children out of chairs surrounding a table, then sets out cups without asking how many you are. He counted while you were deciding whether to come in."
  }
 },
 {
  "id": "ag_tamsin_answer_building",
  "description": {
   "old": "He pours before he answers, because some stories go down better with something warm in reach. \"A church. St Gilliam's, same as now — we kept the name because the name kept us, and that's as even a trade as this town has ever managed.\" He nods at the windows, where the light is doing its searching thing. \"When the world ended, people came here to ask why. The building never answered — but it never asked anyone to leave, either. I try to keep to its example.\" He slides the cup across. \"The rest of that story is a night story. You've only just arrived. Have the day first.\"",
   "new": "He pours before he answers, because some stories go down better with something warm in reach. \"A church. St Gilliam's, same as now — we kept the name because the name kept us, and that's as even a trade as this town has ever managed.\" He nods at the windows, where the light is doing its helping thing. \"When the world ended, people came here to ask why. The building never answered, no matter ... \"he turns to look over his shoulder at a man sitting at a table talking with a few other locals ... \" WHAT YOU SAY GARY, IT'S THE PLUMBING — but it never asked anyone to leave, either. I try to keep to its example. Although I might ask GARY to leave sometime.\" He turns back to look at you, smiles, and slides the cup across. \"The rest of that story is a <i>later</i> story. You've only just arrived. Settle in. Always happy to chat <i>later</i>.\""
  }
 },
 {
  "id": "allesh_gilliam_etta_welcome",
  "description": {
   "old": "A roofed strip of welded awnings runs down what used to be Main Street. Food from Lyrenn. Ore and tools from Khezek Tor. Jackalope goods passing through, quietly.\n\nA matronly Menhirkin in an intricate robe intercepts you with the serenity of continental drift. Etta Bloom — the closest thing Allesh-Gilliam has to a mayor, which is not very close, and that's how everyone prefers it.\n\n\"There you are,\" she says, like you were expected and only slightly late. \"Walk with me. Don't buy anything yet — the prices are wrong today. They're always wrong the day something interesting arrives, and today that's you.\"\n\nShe steers you down the row: who bakes, who barters, who waters the beer (nobody, twice a week). She presses a warm skewer of something into your hand. It's good. It's REALLY good.\n\n\"Questions keep,\" she says, patting your arm. \"Come by when you've slept. I find people decide better on the far side of a night's sleep. And I do like people who decide well.\"",
   "new": "A roofed strip of welded awnings runs down what used to be Main Street. Food from Lyrenn. Ore and tools from Khezek Tor. Jackalope goods passing through, quietly.\n\nA matronly Menhirkin in an intricate robe intercepts you with the serenity of continental drift. Etta Bloom — the closest thing Allesh-Gilliam has to a mayor, which is not very close, and that's how everyone prefers it.\n\n\"There you are,\" she says, like you were expected and only slightly late. \"Ava said you were arriving today.\" Ava? There are so many layers ... \"Walk with me. Don't buy anything yet — the prices are wrong today. They're always wrong the day something interesting arrives, and today that's you.\"\n\nDoes she say fucked up shit to people like that to set them at ease, or the opposite of that?\n\nShe steers you down the row: who bakes, who barters, who waters the beer (nobody, twice a week). She presses a warm skewer of something into your hand. It smells good. It smells REALLY good.\n\n\"Questions keep,\" she says, patting your arm. \"Come by when you've slept. I find people decide better on the far side of a night's sleep. And I do like people who decide well.\""
  },
  "choices": [
   {
    "oldLabel": "Eat the skewer",
    "next": "allesh_gilliam_town_walk",
    "oldDescription": "Unidentified. Delicious. Statistically it was at least 40% something you'd rather not name, and you find you are at peace with that.",
    "description": "Unidentified. Delicious. Statistically it was at least 40% something you'd rather not name, and you find you are at peace with that. You clearly would have made an excellent \"gonzo style\" food show presenter person."
   }
  ]
 },
 {
  "id": "ag_etta_answer_skewer",
  "description": {
   "old": "Etta considers the question with the seriousness of a woman being asked to disarm something. \"On the skewer,\" she says, \"is dinner.\" The smile arrives — warm, absolute, a door closing gently on the entire topic. \"You want to know what's IN dinner, and I'll tell you what my gran told me: the Long Market runs on two currencies, and one of them is not asking. The food is safe. Safe I can promise.\" She turns a skewer with real tenderness. \"Named is extra.\" She hands you another one. \"Seconds?\"",
   "new": "Etta considers the question with the seriousness of a woman being asked to disarm something. \"On the skewer,\" she says, \"is dinner.\" The smile arrives — warm, absolute, a door closing gently on the entire topic. \"You want to know what's IN dinner, and I'll tell you a secret: the Long Market runs on two currencies, and one of them is not asking. The food is safe. Safe I can promise.\" She turns a skewer with real tenderness. \"Named is extra.\" She hands you another one. \"Seconds?\""
  }
 },
 {
  "id": "allesh_gilliam_waiting_room_intro",
  "description": {
   "old": "The town's old medical clinic still has its sign, and nobody has ever needed to change it: WAITING ROOM. It's the bar now. Triage chairs at the counter, the intake window where you order, and behind the good whiskey, a suture kit that still sees professional use — the light's better in here than anywhere else in town. Scratched into the counter, in several different decades of handwriting: EVERYONE ENDS UP IN THE WAITING ROOM EVENTUALLY. Doc Greeley pours like she's writing prescriptions, and the room is loud in the specific way of people who survived something together and have agreed to discuss anything else. In the back there's one room kept spotless and shut. Nobody jokes in there. Ask about anything — this is where the town's rumors come to metabolize.\n\nThe door outside still says EMERGENCY — somebody bolted GALLEY beneath it and called the argument settled. The WAITING ROOM sign hangs inside, over the bar, where it's accurate.",
   "new": "The town's old medical clinic still has its sign, and nobody has ever needed to change it: WAITING ROOM. It's the bar now. Triage chairs at the counter, the intake window where you order, and behind the good whiskey, a suture kit that still sees professional use — the light's better in here than anywhere else in town. The tables are gurneys, most still with suspicious stains in various shades of yeah-it's-probably-blood (blue and orange among them), but no one blinks an eye. No one even asks why table 7 is partly melted on one side. This place is comforting, in a smoke clove cigarettes while looking at your shoes and dancing kind of way, extra eye shadow.\n\nScratched into the counter, in several different decades of handwriting: EVERYONE ENDS UP IN THE WAITING ROOM EVENTUALLY. Doc Greeley, one of the rare Eidolons to call Bad Eden home, pours like she's writing prescriptions, and the room is loud in the specific way of people who survived something together and have agreed to discuss anything else. In the cellar there's one room kept spotless, with the cellar door shut. Nobody jokes in there.\n\nOk, that's not true, most people joke in there, because when Greeley lets people in, they are invariably drunk. Some people say she does it just so she can watch her patrons tumble down the stairs and give her an excuse to use the suture kit.\n\nTLDR; More than anywhere else, this is where the town's rumors come to metabolize."
  },
  "choices": [
   {
    "oldLabel": "Ask about the room in the back",
    "next": "ag_greeley_answer_cough",
    "label": "Ask about the room in the cellar"
   }
  ]
 },
 {
  "id": "ag_greeley_answer_cough",
  "label": {
   "old": "Allesh-Gilliam — The Room in the Back",
   "new": "Allesh-Gilliam — The Room in the Cellar"
  },
  "description": {
   "old": "<p>Greeley doesn't look at the door. She never has to. \"The Night the Mountain Coughed,\" she says, the way you'd give a date. \"Before your time. The crew before you, the ones who cracked Khezek Tor back open. They opened a Yesodium chamber they shouldn't have, or opened it wrong, and the mountain answered. Took the gallery wall off. Took a crew's worth of people with it and sent me the rest.\"</p><p>She pours. \"That room's where we put the ones we couldn't put back. It stays clean because I clean it.\"</p><p>The bar is quiet in the way of a room that has heard this before and lets her say it anyway. \"Folk will tell you the mountain did it on purpose. That it's mad. I don't know that particular mountain personally, so I can't vouch for its temperament, and I don't think they can either. But I know what came down that road. And I know the middle Tamsin brother went into the cage shaft after a manifest that night and is still, the way the quartermaster tells it, on the books.\"</p><p>She sets the cup down. \"Ask Calder about the Brace. Not in front of the shift.\"</p>",
   "new": "<p>Greeley doesn't look at the trap door. She never has to. \"The Night the Mountain Coughed,\" she says, the way you'd give a date. \"Before your time a bit, and courtesy, actually, of your outfit. The crew before you, the ones who cracked Khezek Tor back open. They opened a Yesodium chamber they shouldn't have, or opened it wrong, and the mountain answered. Took the gallery wall off. Took a crew's worth of people with it and sent me the rest.</p>\n<p>\"We're still waiting to find out what happened. Maybe you can check around. Yesodium is a hell of a drug.\"</p>\n<p>She pours. \"Anyway, that room's where we put the ones we couldn't put back. It stays clean because I clean it.\"</p>\n<p>\"Folk will tell you the mountain did it on purpose. That it's mad. I don't know that particular mountain personally, so I can't vouch for its temperament, and I don't think they can either. But I know what came down that road. And I know the middle Tamsin brother went into the cage shaft after a manifest that night and is still, the way the quartermaster tells it, on the books.\"</p>\n<p>She sets the cup down. \"Ask Calder about the Brace. You can find him in Khezek Tor. Don't ask in front of the shift though.\"</p>"
  }
 },
 {
  "id": "allesh_gilliam_plumb_office_intro",
  "description": {
   "old": "The base of the old water tower is an office now, and the office is Aldous Plumb, Structural Authority (self-certified, framed, hung slightly crooked, which he will tell you is the wall's fault). Every surface is drawings of the town — precise, confident, and each one slightly wrong in a way you can't immediately name. He surveyed the East Wall once, and he will not re-survey it, because a second survey would imply something about the first one. \"The wall,\" he says, before you've asked anything, \"is cosmetic.\" The wall is visible through his window. It is leaning.",
   "new": "The base of the old water tower is an office now, and the office is Aldous Plumb, Structural Authority (self-certified, framed, hung slightly crooked, which he will tell you is the wall's fault). Every surface is drawings of the town — precise, confident, and each one slightly wrong in a way you can't immediately name. He surveyed the entire town, once, and he will not re-survey it, because a second survey would imply something about the first one."
  }
 },
 {
  "id": "ag_days_end",
  "description": {
   "old": "The sun goes down wrong-colored and gorgeous, and the day Thatwards is spent. What the evening is depends on what the day was — the ledger knows, and so does the town.\n\nAnd then — well. Then we find out what was waiting for the ink to dry.",
   "new": "The sun goes down wrong-colored and gorgeous, and the day Thatwards is spent. What the evening is depends on what the day was — the ledger knows, and so does the town.\n\nAnd then — well. Then we find out what was waiting for the ink to dry.\n\nBTW, get ready for lots of extended metaphors."
  },
  "choices": [
   {
    "oldLabel": "The turn is locked. Run it.",
    "next": "",
    "oldDescription": "Before the world moves, the ledger wants three things. 1. Divvy the holdings — say it out loud and write it down, which hexes belong to which faction (hex sheets: claim them now). 2. Plan your Strategic Activities — each faction sets its work for the turn; the Plan console is open. 3. Lock it in — when every faction's plans are set, your GM runs the Turn Driver and the world takes its turn.",
    "description": "Before the world moves, the ledger wants to know your plans. 1 - Input your Strategic Activities! Each faction sets its work for the turn; the Plan console is open. 2. Lock it in! When every faction's plans are set, your GM runs the Turn Driver and the world takes its turn."
   }
  ]
 },
 {
  "id": "ag_first_night_soma_break",
  "description": {
   "old": "The town lets go of you gently — a lamp in a window here, a door pulled to there, somebody's supper riding the air all the way down the street. Whatever Allesh-Gilliam decided about you today, it decided it kindly enough to let you sleep on it.\n\n<b>Take your Soma Break.</b> Clarity refills, Noise settles, and everything marked <i>once per Soma Break</i> comes back with the morning. (Stewards: the Soma Break is on your sheet — take it now, before the world moves.)\n\nTomorrow the to-do list arrives. Tonight, the ceiling of a building that answers to you, and the specific quiet of a town that hasn't decided what to want from you yet.",
   "new": "The town lets go of you gently — a lamp in a window here, a door pulled to there, somebody's supper riding the air all the way down the street. Then being shot and put into an oven, magically. It's beautiful. Whatever Allesh-Gilliam decided about you today, it decided it kindly enough to let you sleep on it.\n\n<b>Take your Soma Break.</b> Clarity refills, Noise settles, and everything marked <i>once per Soma Break</i> comes back with the morning. (Stewards: the Soma Break is on your sheet — take it now, before the world moves.)\n\nTomorrow the to-do list arrives. Tonight, the ceiling of a quite nice mobile hovercraft, the Absolutely Reliable, that temporarily answers to you, and the specific quiet of a town that hasn't decided what to want from you yet."
  },
  "choices": [
   {
    "oldLabel": "Sleep. Tomorrow, the land.",
    "next": "hum_quiet_tent",
    "oldDescription": "The day is spent and well spent. Soma Breaks all around — and in the morning, the road out passes the edge of town.",
    "description": "The day is spent and well spent. Soma Breaks all around — and in the morning, the road out past the edge of town. Marshal Pike will be glad to get his parking back, at least temporarily."
   }
  ]
 },
 {
  "id": "ag_crossroads_first_rides",
  "description": {
   "old": "<!-- [SOMA-BREAK-2026-08-30] -->The coalition rides out to learn what it now owns. Surveying is its own kind of introduction: pacing the hexes, reading the fences, finding out which handshakes came with land attached.\n\nThe road forks at the edge of your holdings, and both signs are hand-painted. THATWARDS-BY-NORTH: <b>Khezek-Tor</b>, where the mine answered back and the smelters never sleep. THATWARDS-BY-GREEN: <b>Lyrenn</b>, where the fields remember you before you've been introduced.\n\nThree towns hold this stretch of Thatwards together. The order is yours, and so is the road home. The roads are not entirely yours — ride ready.",
   "new": "<!-- [SOMA-BREAK-2026-08-30] -->The coalition rides out to discover that for which they are now responsible. Like, SERIOUS adulting. Surveying is its own kind of introduction: pacing the hexes, reading the fences, finding out which handshakes came with land attached.\n\nSeriously. People should wash their hands more here. Lots of handshakes quickly turned fist NOPE elbow bumps.\n\nThe road forks at the edge of your holdings, and both signs are hand-painted. THATWARDS-BY-NORTH: <b>Khezek-Tor</b>, that one place that blew up and killed a bunch of people that one time. But that was like at LEAST more than ... it's been AWHILE. And your folks are busily drilling and blowing things up there more. THATWARDS-BY-GREEN: <b>Lyrenn</b>, where most of your food comes from, and from what you have heard, most of your whimsy as well. They have a singing irrigation system. And topiary.\n\nThree towns hold this stretch of Thatwards together. The order is yours, and so is the road home. The roads are not entirely yours — ride ready."
  }
 },
 {
  "id": "ag_ride_khezek_tor",
  "description": {
   "old": "Boots in stirrups, coffee in the blood. The road to <b>Khezek-Tor</b> climbs out of the green and into country that clinks when the wind moves it. Smelter-glow on the underside of the clouds, and something in the rock that hums back if you hum first.\n\n⚙ Plot the ride on the Travel Console — the road decides what you meet.",
   "new": "Boots in stirrups, coffee in the blood. The road to <b>Khezek-Tor</b> climbs out of the green and into country that clinks when the wind moves it. Smelter-glow on the underside of the clouds, and something in the rock that hums back if you hum first.\n\nYou had stirrups installed in your personal rigs because it felt appropriate, considering the terrain.\n\n⚙ Plot the ride on the Travel Console — the road decides what you meet. Actually a lot of dice rolls do that. But the road likes to take credit, and tell everyone about it. They can go ON and ON ..."
  },
  "choices": [
   {
    "oldLabel": "🐎 Saddle up — ride out",
    "next": "",
    "oldDescription": "Run the planned route on the Travel Console.",
    "description": "Yep. You installed a saddle as well. Even in your mech suits. That's right. Hats that hold several litres of liquid are probably next. Run the planned route on the Travel Console."
   }
  ]
 },
 {
  "id": "khezek_tor_main_scene",
  "description": {
   "old": "You hear Khezek Tor before you see it.\n\nA low, constant vibration—stone grinding against memory. The mine’s mouth yawns open in a cliffside that looks like it was bitten out of the world rather than excavated.\n\nFloodlights burn day and night.\n\nNot for visibility.\n\nFor warning.\n\nStructures here are brutal, efficient, and unapologetic. Shipping containers welded into barracks. Cranes frozen mid‑lift like skeletons of failed gods. Some of the iron is new. Some of it is very old, and was welded to the mountain by people who did not expect it to be seen again. The air tastes metallic, sharp enough to make your tongue ache.\n\nIf Lyrenn teaches patience,\n\nKhezek Tor teaches limits.\n\nThis place exists because it must.\n\nAnd because no one else wants to pay the cost.\n\nYesodium is a hell of a drug.",
   "new": "You hear Khezek Tor before you see it. It's like it's TRYING to be dramatic.\n\nMines.\n\nA low, constant vibration—stone grinding against memory. A volcanic crater that was not made by a volcano. A dome covering the richest vein of the most valuable and dangerous substance the post-Shattering world knows.\n\nYesodium.\n\nFloodlights burn day and night.\n\nNot for visibility.\n\nFor warning.\n\nStructures here are unnecessarily angular. Like aggressively so. Shipping containers welded into barracks. Cranes frozen mid‑lift like skeletons of failed gods, (the mine wrote that line itself). Some of the iron is new. Some of it is very old, and was welded to the mountain by people who did not expect it to be seen again.\n\nYesodium is a hell of a drug."
  }
 },
 {
  "id": "khezek_tor_town_walk",
  "description": {
   "old": "You hear Khezek Tor before you see it. A low, constant vibration — stone grinding against memory. Floodlights burning day and night. Not for visibility. For warning.\n\nBut at the shift change, the mountain shows you its other face: the cookline.\n\nA welded row of drum-stoves at the mine's mouth, run by a granite-armed cook named Bez who does not take requests and has never needed to. Miners come up gray, eat, and turn back into people by the third bite. A place gets made for you on the bench — no discussion, someone just shoves down and it exists.\n\nTin plate. Real portions. Somebody's fiddle, played badly, loved anyway.\n\nNobody asks what you're going to do about anything. Down here, showing up at the cookline IS the introduction.",
   "new": "You hear Khezek Tor before you see it. A low, constant vibration — stone grinding against memory. Floodlights burning day and night. Not for visibility. For warning.\n\nBut at the shift change, the mountain shows you its other face: the cookline.\n\nA welded row of drum-stoves, run by a granite-armed Menhirkin cook named Bez who does not take requests and has never needed to. Miners come up gray, eat, and turn back into people by the third bite. A place gets made for you on the bench — no discussion, someone just shoves down and it exists. A smile and a nod. They know who you are.\n\nThey made a place for you anyway.\n\nTin plate. Real portions. Somebody's fiddle, played badly, loved anyway.\n\nNobody asks what you're going to do about anything. Down here, showing up at the cookline IS the introduction.\n\nThe question then becomes - will the space be there next time?"
  },
  "choices": [
   {
    "oldLabel": "Eat what Bez gives you",
    "next": "khezek_tor_town_walk",
    "oldDescription": "You will never learn what it was. You will dream about it anyway. Bez nods once — the full Khezek Tor citizenship ceremony.",
    "description": "You will never learn what it was. What is up with secret food? You will dream about it anyway. Bez nods once — the full Khezek Tor citizenship ceremony."
   },
   {
    "oldLabel": "Meet Drax Calder",
    "next": "khezek_tor_drax_welcome",
    "oldDescription": "The foreman. He'll talk while he works. He never stops working.",
    "description": "The Menhirkin foreman. He'll talk while he works. He never stops working."
   },
   {
    "oldLabel": "Meet Sable Nine",
    "next": "khezek_tor_sable_welcome",
    "oldDescription": "The mapmaker. Keeps their maps folded like secrets, because they are.",
    "description": "The Rustland Scavenger mapmaker. Keeps their maps folded like secrets, because they are. They are VERY precise. Especially about mines. And also chairs."
   },
   {
    "oldLabel": "Listen to the fiddle",
    "next": "khezek_tor_town_walk",
    "oldDescription": "Three songs. All arguably the same song. The mountain hums under it, one register too low, like a very large uncle joining the chorus.",
    "description": "Three songs. All arguably the same song, and it's a very good argument. The mountain hums under it, one register too low, like a very large uncle joining the chorus, and that's one of the reasons people love Bad Eden, even if it sometimes has a hard time loving them back."
   }
  ]
 },
 {
  "id": "khezek_tor_drax_welcome",
  "description": {
   "old": "Drax Calder doesn't shake hands — his are full. Chalk in one, level in the other, and a length of the Brace in front of him that he treats the way other people treat a sleeping animal.\n\n\"New watch,\" he says. Not a question. Word beat you down the mountain.\n\nHe keeps working while he talks, and what he talks about is the shift: who's on it, who's new, whose kid just moved from sorting to carting and got cheered down the whole line. The ledger behind him is rock, chalk, and arithmetic older than the coalition — every line somebody's shift, somebody's tonnage, somebody's name.\n\n\"You'll want to know the mine eventually,\" he says, tapping a chalk mark back into true. \"The mine'll want to know you first. That part takes exactly as long as it takes.\"\n\nHe hands you a cup of the tar the miners call coffee.\n\n\"Tonight, you're a guest. Guests eat first and stay off the lifts. Both rules are load-bearing.\"",
   "new": "Drax Calder doesn't shake hands — his are full. Chalk in one, level in the other, and a length of the Brace in front of him that he treats the way other people treat a sleeping animal.\n\n\"New watch,\" he says. Not a question. Word beat you down the mountain.\n\nHe keeps working while he talks, and what he talks about is the shift: who's on it, who's new, whose kid just moved from sorting to carting and got cheered down the whole line. The ledger behind him is rock, chalk, and arithmetic older than the coalition — every line somebody's shift, somebody's tonnage, somebody's name.\n\n\"You'll want to know the mine eventually,\" he says, tapping a chalk mark back into true. \"The mine'll want to know you first. That part takes exactly as long as it takes.\"\n\nHe hands you a cup of the tar the miners call coffee.\n\n\"Tonight, you're a guest. Guests eat first and stay off the lifts. Both rules are load-bearing. On account of the fact that some of the lifts are not.\"\n\nGruff Men With Coffee. Is there a club or something of which you are not aware? If not Drax and Pike should start one ... They can reluctantly serve the coffee while Bez and Etta refuse to tell anyone what kind of food they're being served. The Recalcitrant Cafe.\n\nSomeone write that down."
  }
 },
 {
  "id": "kt_drax_answer_chalk",
  "description": {
   "old": "Calder finishes the seam he's on before answering — you get the sense EVERYTHING waits for the seam he's on. \"Every mark's a question the mountain hasn't answered yet. Soft spot. Odd echo. Air that moves when it shouldn't.\" He rolls the chalk across his knuckles. \"Chalk's cheap. Surprises aren't. A man who writes his worries on the wall gets to stop carrying them in his hands — and down here you want your hands free.\" He glances toward the shaft, just for a beat: the look of a man who has heard one odd echo too many lately. \"Work a mountain long enough, you learn it keeps its own ledger. I just make sure ours matches.\"",
   "new": "Calder finishes the seam he's on before answering — you get the sense EVERYTHING waits for the seam he's on. \"Every mark's a question the mountain hasn't answered yet. Soft spot. Odd echo. Air that moves when it shouldn't.\" He rolls the chalk across his knuckles. \"Chalk's cheap. Surprises aren't. A person who writes their worries on the wall gets to stop carrying them in their hands — and down here you want your hands free.\"\n\nYou refrain from mentioning that he seems to have his hands full all of the time. That would be unhelpful. But you file the observation away. Resources are strained here.\n\nHe glances toward the shaft, just for a beat, and you recognize the uneasy look of a man who has heard one odd echo too many lately.\n\nOr maybe this is a Bez problem and you just haven't waited long enough.\n\nNo, it's the echo thing. Carry on.\n\n\"Work a mountain long enough, you learn it keeps its own ledger. I just make sure ours matches.\"\n\nAccounting talk from a miner, things are even worse than you feared.\n\nPike and Calder, seriously two of a kind. And everyone is nervous about this mine ..."
  }
 },
 {
  "id": "khezek_tor_sable_welcome",
  "description": {
   "old": "Sable Nine has claimed the end of the bench nearest the light, folded over a map like a bird over an egg.\n\nYou get one eye. Then the other. The map, you notice, gets folded FIRST — before the greeting, before anything.\n\n\"You're the new watch,\" they say quietly. \"You walk loud. That's not a criticism. It's data.\"\n\nUp close, Sable is all economy: charcoal fingers, careful voice, the stillness of somebody who spends whole shifts listening to rock. They do not show you the maps. They do show you the good seat — back to the wall, view of the mouth, where the draft doesn't reach. In Sable Nine terms this is roughly a bouquet of flowers.\n\n\"Sit there when you visit,\" they say. \"I'll know it's you without looking up. That saves us both a little.\"",
   "new": "Sable Nine has claimed the end of the bench nearest the light, folded over a map like a jeweler working on something precious and secret.\n\nYou get one eye. Then the other. The map, you notice, gets folded FIRST — before the greeting, before anything.\n\n\"You're the new watch,\" they say quietly. \"You walk loud. That's not a criticism. It's data.\"\n\nAh, you know this routine. Let's get hyperfocused!\n\nUp close, Sable is all economy: charcoal fingers, careful voice, the stillness of somebody who spends whole shifts listening to rock. They do not show you the maps. Precious and secret, as I said. They do show you the good seat — back to the wall, view of the mouth, where the draft doesn't reach. In Sable Nine terms this is roughly a bouquet of flowers. Mathematics and acoustics based flowers.\n\n\"Sit there when you visit,\" they say. \"I'll know it's you without looking up. That saves us both a little.\"\n\nYou think you will get along just fine."
  }
 },
 {
  "id": "kt_sable_answer_maps",
  "description": {
   "old": "\"The mine,\" says Sable, in the tone of someone answering a different question than the one you asked. The pen doesn't stop. Contour lines. Depth marks. Annotations in a shorthand that might be a language and might be a precaution. \"Maps say where things are,\" they add, after exactly enough silence to make you complicit in it. \"Good maps say where things were YESTERDAY. Around here, the difference pays my wages.\" They tilt the board one degree in your direction — enough to be hospitality, not enough to be information. \"When you need to know what's under Khezek-Tor, come at a polite distance. Bring your own chair.\"",
   "new": "\"The mine,\" says Sable, in a tone of reverence. \"No one knows it yet.\" The pen doesn't stop. Contour lines. Depth marks. Annotations in a shorthand that might be a language and might be an incantation. \"Maps say where things are,\" they add, after exactly enough silence to make you complicit in it. Do they know Young Gearbox? \"Good maps say where things were YESTERDAY. Around here, making up the difference pays my wages.\" They tilt the board one degree in your direction — enough to be hospitality, not enough to be information. \"When you need to know what's under Khezek-Tor, come at a polite distance. Bring your own chair.\""
  }
 },
 {
  "id": "ag_ride_lyrenn",
  "description": {
   "old": "The road to <b>Lyrenn</b> doesn't so much go as it is <i>permitted</i>. Hedgerows lean in to look at you. Somewhere out in the fields, something waves — friendly, probably.\n\n⚙ Plot the ride on the Travel Console — the road decides what you meet.",
   "new": "The road to <b>Lyrenn</b> lets you see just how truly alive Bad Eden can be, at least when it's behaving. Hedgerows lean in to look at you. Somewhere out in the fields, something waves — friendly, probably.\n\n⚙ Plot the ride on the Travel Console — the road decides what you meet."
  }
 },
 {
  "id": "lyrenn_opening_scene",
  "description": {
   "old": "The road to Lyrenn smells different.\n\nWarm earth. Sap. Old rain coaxed out of stubborn ground.\n\nFields stretch wider than they should, given the soil, given the history, given Bad Eden’s general hostility toward optimism.\n\nSomeone made this place work anyway.\n\nThe land does not feel safe.\n\nIt feels patient.\n\nLyrenn is built around the reinforced shell of an old agricultural co‑op and grain elevator, braced with timber, prayer, and experience. Solar cloth hangs between poles like tired flags. Wind chimes made from irrigation parts sing constantly, keeping pests—mundane and otherwise—uneasy.\n\nPeople here do not carry weapons openly.\n\nThey carry tools.\n\nThat is a choice.\n\nIt is also a risk.\n\nThe land here is responsive. Too responsive. Crops grow in patterns that suggest intention. Vines curl when spoken to kindly. Soil tightens when lied to.\n\nLyrenn does not punish violence immediately.\n\nIt remembers it.",
   "new": "The road to Lyrenn smells different.\n\nWarm earth. Sap. Old rain coaxed out of stubborn ground.\n\nFields stretch wider than they should, given the soil, given the history, given Bad Eden’s general hostility toward optimism.\n\nSomeone made this place work anyway.\n\nLyrenn is built around the reinforced shell of an old agricultural co‑op and grain elevator, braced with timber, prayer, and experience. But mostly timber braces.\n\nSolar cloth hangs between poles like tired flags. Wind chimes made from irrigation parts sing constantly, keeping pests—mundane and otherwise—uneasy.\n\nPeople here do not carry weapons openly. They carry tools. But they carry them like weapons. Which is both cute and terrifying when one thinks about it and a rake too hard.\n\nThe land here is responsive. Too responsive at times. Crops grow in patterns that suggest intention. Vines curl when spoken to kindly. Soil tightens when lied to.\n\nYou've never been to a farm that feels like it needs a therapy session and a hug before ..."
  }
 },
 {
  "id": "lyrenn_town_walk",
  "description": {
   "old": "Lyrenn doesn't greet you. It notices you — which around here is the same thing, done more honestly.\n\nThe rows bend with the light. Wind chimes made from irrigation parts keep up their constant nervous music. Workers straighten as you pass, tip a tool, and go back to it: no ceremony, no suspicion, just a place with too much growing to stop for anybody.\n\nSomebody has left a jug of cold well-water and two cups on a fence post along the main path. It was not there a minute ago. Nobody nearby takes credit.\n\nThe soil is dark, the air is sweet, and the whole hex is paying attention. Be worth paying attention to.\n\nWho do you want to meet?",
   "new": "Lyrenn doesn't greet you. It notices you — which around here is the same thing, done more honestly.\n\nThe rows bend with the light. Wind chimes made from irrigation parts keep up their constant nervous music. Workers straighten as you pass, tip a tool, and go back to it: no ceremony, no suspicion, just a place with too much growing to stop for anybody.\n\nSomebody has left a jug of cold well-water and two cups on a fence post along the main path. It was not there a minute ago. Nobody nearby takes credit. But that's encouraging nonetheless. Or is it? You slowly begin looking through your things for a poison detection kit before stopping and leaning into trusting the whole vibe.\n\nThe soil is dark, the air is sweet, and the whole hex is paying attention. Be worth paying attention to. But not in a \"poison the well water to be rid of our problems\" kind of way.\n\nWho do you want to meet?"
  }
 },
 {
  "id": "lyrenn_green_ring_cinematic",
  "description": {
   "old": "The old grain elevator rises like a memory that refused to collapse.\n\nAround it stretches a wide circular field — unnervingly symmetrical.\n\nNo fences divide it.\n\nNo private rows break its curve.\n\nPlanting is radial.\n\nHarvest is radial.\n\nEverything leads toward the elevator at the center, like spokes toward a promise.\n\nThe soil here is darker than the surrounding land.\n\nDarker — and quieter.\n\nYou feel it before you name it:\n\nThis place listens.\n\nA wooden platform stands at the edge of the circle.\n\nNot a stage.\n\nA witness stand.\n\nWhen wind moves across the Ring, it does not rustle — it breathes.\n\nBeside the witness-stand platform: an empty plinth, footprint worn smooth, the radial furrows all bending subtly around where something used to stand.",
   "new": "The old grain elevator is classic post apocalyptic theater - rusted and blasted and still standing strong.\n\nAround it stretches a wide circular field — unnervingly symmetrical.\n\nEverything leads toward the elevator at the center, like spokes toward a promise.\n\nThe soil here is darker than the surrounding land.\n\nDarker — and quieter.\n\nYou feel it before you name it:\n\nThis place listens.\n\nA wooden platform stands at the edge of the circle, bearing an unnerving resemblance to a witness stand.\n\nWhen wind moves across the Ring, it sounds like the measured breath of someone in a deep, peaceful sleep.\n\nBeside the witness-stand platform: an empty plinth, footprint worn smooth, the radial furrows all bending subtly around where something used to stand."
  }
 },
 {
  "id": "lyrenn_elsin_welcome",
  "description": {
   "old": "Elsin Quade takes your measure over one firm handshake and zero wasted words. Then, verdict rendered, she does the most disarming thing available to her: she feeds you.\n\nHer table is co-op plank, scrubbed pale. The meal is squash, bread, and a stew that doesn't need to explain itself. She serves you first — that's policy, not affection — and eats like a woman who has budgeted exactly enough time for eating and intends to hit the estimate. The ledger sits closed on the shelf. You get the sense that it being closed, in front of you, on your first night, is a statement of some kind.\n\n\"Farm feeds the town,\" she says, by way of grace. \"Town holds the wall. Wall keeps the farm. That's the whole religion.\"\n\nShe refills your bowl without asking.\n\n\"Everything else is weather.\"",
   "new": "Elsin Quade, the Stormborn Nomad crop coordinator for the Lyrenn Coop, takes your measure over one firm handshake and zero wasted words. Then, verdict rendered, she does the most disarming thing available to her: she feeds you.\n\nHer table is co-op plank, scrubbed pale. The meal is squash, bread, and a stew that doesn't need to explain itself.\n\nAgain with the secret recipes.\n\nShe serves you first — that's policy, not affection — and eats like a woman who has budgeted exactly enough time for eating and intends to hit the estimate. The ledger sits closed on the shelf. You get the sense that it being closed, in front of you, on your first night, is a statement of some kind.\n\n\"Farm feeds the town,\" she says, by way of grace. \"Town holds the wall. Wall keeps the farm. That's the whole religion.\"\n\nShe refills your bowl without asking.\n\n\"Everything else is weather.\"\n\nYou swear she then winks."
  }
 },
 {
  "id": "lyrenn_rowan_welcome",
  "description": {
   "old": "You find Rowan of the Loam standing in a fallow row, doing nothing at all, doing it with total commitment.\n\nThey study you like a half-remembered dream. Then they crouch, press one palm flat to the soil, and gesture — unhurried, unmistakable — for you to do the same.\n\nThe ground is warm where it should be cool. Under the warmth, very faint, a rhythm. Not a heartbeat. More like breathing heard through a wall.\n\n\"It likes to know the weight of new people,\" Rowan says. \"Now it knows yours.\"\n\nThey straighten up and give you the rarest thing in Bad Eden: a smile with nothing behind it but the smile.\n\n\"Welcome to Lyrenn. Walk gently the first week. It notices manners.\"",
   "new": "You find Rowan of the Loam standing in a fallow row, doing nothing at all, doing it with total commitment.\n\nThey study you like a half-remembered dream. Then they crouch, press one palm flat to the soil, and gesture — unhurried, unmistakable — for you to do the same.\n\nYou have been told they are like this without any drugs at all. But being around THEM kind of feels like being high.\n\nThe ground is warm where it should be cool. Under the warmth, very faint, a rhythm. Not a heartbeat. More like breathing heard through a wall.\n\n\"It likes to know the weight of new people,\" Rowan says. \"Now it knows yours.\"\n\nThey straighten up and give you the rarest thing in Bad Eden: a smile with nothing behind it but the smile.\n\nYou are NOT buying that there are no drugs.\n\nExcept for how happy and relieved the smile seems to make you.\n\n\"Welcome to Lyrenn. Walk gently the first week. It notices manners.\"\n\nThey also give advice that makes sense!\n\nReally waffling on this drugs thing ..."
  }
 },
 {
  "id": "lyrenn_rowan_answer_rhythm",
  "description": {
   "old": "Rowan doesn't answer right away, because answering right away would interrupt it. \"Listen past the wind,\" they say finally. \"Wind's just weather talking about itself. Under that.\" You listen. Soil settling. Leaf against leaf. Something in the irrigation rows keeping time like a slow instrument. \"Growing,\" Rowan says, \"is a sound, if you're patient. Most people never get quiet enough to catch it — then they wonder why the fields don't answer to them.\" They put a seed in your hand, unhurried. \"Lyrenn answers. That's the whole trick of the place. Come be quiet in it sometime.\"",
   "new": "Rowan doesn't answer right away, because answering right away would interrupt it. \"Listen past the wind,\" they say finally. \"Wind's just weather talking about itself. Under that.\" You listen. Soil settling. Leaf against leaf. Something in the irrigation rows keeping time like a slow instrument. \"Growing,\" Rowan says, \"is a sound, if you're patient. Most people never get quiet enough to catch it. Then they wonder why the fields don't answer to them.\" They put a seed in your hand, unhurried. \"Lyrenn answers. That's the whole trick of the place. Come be quiet in it sometime.\""
  }
 },
 {
  "id": "ag_ride_home",
  "label": {
   "old": "The Road Home",
   "new": "The Road Back To Free Parking"
  },
  "description": {
   "old": "Allesh-Gilliam is behind you the way home always is — closer than it looked on the way out, and lit. Somebody will have kept something warm.\n\n⚙ Plot the ride on the Travel Console — the road decides what you meet.",
   "new": "Allesh-Gilliam, and a place to park and hook up your septic, is waiting. Somebody will have kept something warm. I wish those two sentences had had more space in between them.\n\n⚙ Plot the ride on the Travel Console — the road decides what you meet."
  }
 }
];
  for (const r of DATA) {
    const b = byId.get(r.id); if (!b) { say(`✗ MISSING beat ${r.id}`); continue; }
    if (r.label) setField(b, "label", r.label.old, r.label.new, `${r.id}.label → "${r.label.new}"`);
    if (r.description) setField(b, "description", r.description.old, r.description.new, `${r.id}.description`);
    for (const c of (r.choices || [])) {
      const choices = Array.isArray(b.choices) ? b.choices : [];
      let ch = choices.find(x => N(x.label) === N(c.oldLabel) && (x.next || "") === c.next);
      if (!ch && c.label) ch = choices.find(x => N(x.label) === N(c.label) && (x.next || "") === c.next);
      if (!ch) { say(`✗ ${r.id}: choice "${c.oldLabel}" → ${c.next || "(stays)"} not found`); continue; }
      if (c.label) setField(ch, "label", c.oldLabel, c.label, `${r.id} choice "${c.oldLabel}" label → "${c.label}"`);
      if (c.description !== undefined) setField(ch, "description", c.oldDescription ?? "", c.description, `${r.id} choice "${c.label || c.oldLabel}" description`);
    }
  }
  console.group(`[patch-act01-wordsmith-2026-10-05] ${DRY_RUN ? "DRY RUN — " : ""}${changes} change(s), ${drift} drifted`); report.forEach(r => console.log(" •", r)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`Act 0–1 wordsmith DRY RUN: ${changes} change(s), ${drift} drifted — console (F12). Set DRY_RUN=false to apply.`);
  if (!changes) return ui.notifications.info("Act 0–1 wordsmith: nothing to change.");
  (foundry.utils.saveDataToFile ?? saveDataToFile)(JSON.stringify(wasStr ? JSON.parse(raw) : raw), "application/json", `backup-campaigns-before-act01-wordsmith-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Act 0–1 wordsmith applied: ${changes} change(s)${drift ? `, ${drift} drifted (skipped)` : ""}. F5.`);
})();

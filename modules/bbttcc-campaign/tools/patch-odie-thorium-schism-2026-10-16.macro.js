/* patch-odie-thorium-schism-2026-10-16.macro.js — THE CULT INSIDE THE VALHAULANS (Dave's canon, 2026-10-16):
 *  Tarvaan Truthshouter (Sklar's Shipmoot ex-boyfriend) made up a god — ODIE THORIUM, God of Thunder Sounds, Removing
 *  People's Eyes, and Being Eight-Legged Sometimes — so he can build the godform and climb into it. His sect rigs the
 *  Sacred Battle-Bassinet in YELLOW rope; Sklar's Knot Belayers, freighters and pirates rig BLUE. The paymaster promised
 *  him godhood on success (a receipt; never the name — mystery doctrine). Running gag, hard rule: he keeps asking his
 *  followers for one of their eyes (he wears an eyepatch over a perfectly good eye) and every one of them begs off.
 *
 *  ACT 3 — travel: odie_korl_landing (+gossip/colours/favour/favour_fail) — Korl Vikingstentenson's freighter lands
 *          sideways across the road; family gossip names Tarvaan; the colours; a favour redeemable sideways.
 *          Rows added to every travel table (once:true, phaseGte 3). finale_count_the_coalition gains Korl's crew.
 *  ACT 3 — the camp: "Ask Wick what he's proud of" → odie_wick_proud → secret ins check → wobble hit/miss →
 *          odie_wick_the_hour = THE PRE-RAID REVEAL (earned: channel backward, or a presence check).
 *  ACT 5 — the Hex Room: finale_sklar_turns keeps one voice singing → odie_hex_room (Sklar's throne room, the hex
 *          platform, two colours of rope, Tarvaan mid-rite) → odie_sklar_switches (the Violence/Siege-path turn, played
 *          mid-battle) / odie_rope_turns (talk the yellow rank-and-file round) → odie_free_for_all → odie_wick_drops_it
 *          → odie_tarvaan_falls | odie_tarvaan_fires → odie_yesod_secret (the sink plates; Arc-2 receipt) → outcomes.
 *          finale_wick_at_the_gate rewritten: he is early for nothing; give him a route, or Sklar throws him blue rope.
 *  Idempotent; DRY_RUN default true; backs up `campaigns` + `encounterTables`. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.() || game.settings.get(NS, "activeCampaignId");
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;
  const SKLAR = "tlGzp9UpQU3PwKdB", WICK = "Vv8mDrdsPJnCBLeA";
  const P5 = { flag: "storyPhase", gte: 5 }, P3 = { flag: "storyPhase", gte: 3 };
  const SWITCHED = { anyOf: [{ beatMark: "finale_sklar_turns" }, { beatMark: "odie_sklar_switches" }] };

  const ch = (label, next, description = "", extra = {}) => ({ label, next, description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const inj = (requires, repeatable = false) => ({ cooldownTurns: 0, repeatable, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires });
  const beat = (o) => ({
    type: "dialog", timeScale: "scene", timePoints: 0, politicalTags: "", outcomes: { success: null, failure: null }, actors: [], refs: {},
    playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true, playerFacing: true,
    worldEffects: {}, dialogueOffer: false, ...o
  });

  /* ── the beats ─────────────────────────────────────────────────────────── */
  const NEW = [
    // ACT 3 — KORL LANDS SIDEWAYS (travel tables)
    beat({
      id: "odie_korl_landing", label: "Korl Vikingstentenson Lands Sideways", timeScale: "leg", tags: "travel valhaulan_spine story",
      questId: "quest_valhaulan_spine", storyChain: "widening_trail", priority: "high", story: { quest: "widening_trail" },
      inject: inj([P3]),
      memoryText: "On the road the Stewards met Korl Vikingstentenson's freighter crew, who are not Sklar's and have heard about her problem.",
      description: "A patchwork freighter comes down across the road sideways, the way a Valhaulan ship lands when it means to, and stays there, the way a Valhaulan ship does when it has landed on something. Rope everywhere. Salt fish. One goat, furious. The crew come down the lines singing a song that has the word “freight” in it eleven times. The captain is a wall of a man with a beard braided into a knot that has a name, and he knows you before you say anything.\n\n“Stewards. Thatwards. Everyone's heard.” He shakes hands like he's testing rope. “Korl Vikingstentenson. Freight. Not Sklar's — Sklar's family, though. Everyone's family.” He looks up the road, coastward, the way people look at weather. “That's the problem with family.”",
      choices: [
        ch("Ask about Sklar.", "odie_korl_gossip"),
        ch("Ask about the rope. It's all one colour.", "odie_korl_colours"),
        ch("Help them get the ship off the road.", "odie_korl_favour", "Eleven ropes, one goat, and a hull that landed on its own anchor. Somebody has to see the knot.", { checkStat: "mind", checkDC: 12, failNext: "odie_korl_favour_fail" }),
        ch("Wave and keep walking.", "", "They wave back, all of them, for a long time. The goat does not.")
      ]
    }),
    beat({
      id: "odie_korl_gossip", label: "Family. That's the Problem With Family.", tags: "travel valhaulan_spine story",
      questId: "quest_valhaulan_spine", storyChain: "widening_trail", priority: "background", story: { quest: "widening_trail" },
      inject: inj([P3], true),
      memoryText: "Korl named Tarvaan Truthshouter — Sklar's Shipmoot boyfriend — and the god he made up, Odie Thorium.",
      description: "Korl lowers his voice, which puts it at normal volume. “Tarvaan Truthshouter. She met him at the Shipmoot three summers back. He shouted a truth at her and she brought him home. We all said.” A pause. “We all said nothing, because she had a knife out, but we thought it loudly.”\n\n“Then he found a god. Found.” Korl does the quotes with fingers the size of belaying pins. “Odie Thorium. God of Thunder Sounds. God of — he has a thing about eyes. God of being eight-legged, sometimes.” He is very clear about sometimes. “Nobody had heard of Odie Thorium, because there wasn't one until Tarvaan. That's not a god. That's a job posting.”\n\n“And the eyes.” He shakes his head, genuinely pained. “He asks people for one. Not takes. ASKS. Says it's the road to wisdom. Wears a patch. Still has the eye under it; everybody knows. My cousin told him she needed both for the rigging. My other cousin said he'd think about it. That was a year ago. Tarvaan brings it up at meals.”",
      choices: [
        ch("Why doesn't she throw him out?", "", "“Because he's slow about it. He doesn't take her people. He takes their Tuesdays. Then their rope. Then they're wearing his colour and they can't tell you when it happened.”"),
        ch("Who's winning?", "odie_korl_colours"),
        ch("Has anyone given him an eye?", "", "Korl looks at you as if you have asked whether anyone has given him a leg. “No. He had a lad nearly talked into it at midwinter and the lad's mother came.” He considers. “He's getting tired. You can hear it. A man can only be refused an eye so many times before it affects his sermons.”"),
        ch("Back.", "odie_korl_landing")
      ]
    }),
    beat({
      id: "odie_korl_colours", label: "A Decorating Choice, One Supposes", tags: "travel valhaulan_spine story",
      questId: "quest_valhaulan_spine", storyChain: "widening_trail", priority: "background", story: { quest: "widening_trail" },
      inject: inj([P3], true),
      memoryText: "Korl explained the rope: Sklar's knots are blue, Tarvaan's sect rigs yellow, and rope doesn't lie.",
      description: "“Every ship rigs in her captain's colour. Always has. Sklar's is blue.” He slaps his own rigging, which is blue, and it hums. “Now half the Bassinet is rigged yellow and nobody ordered yellow. Nobody decided. It just started turning up, a line here, a sheet there, and now there's more of it than there isn't, and the ones tying it can't tell you when they changed.”\n\n“When you get there — and you'll get there, everyone's heard — look up before you look at anyone. The rope will tell you who's whose. Rope doesn't lie.” He thinks about that. “It can't. It's rope.”",
      choices: [
        ch("Help them get the ship off the road.", "odie_korl_favour", "Eleven ropes, one goat, and a hull that landed on its own anchor. Somebody has to see the knot.", { checkStat: "mind", checkDC: 12, failNext: "odie_korl_favour_fail" }),
        ch("Back.", "odie_korl_landing")
      ]
    }),
    beat({
      id: "odie_korl_favour", label: "One (1) Favour, Redeemable Sideways", tags: "travel valhaulan_spine story",
      questId: "quest_valhaulan_spine", storyChain: "widening_trail", priority: "background", story: { quest: "widening_trail" },
      inject: inj([P3]),
      memoryText: "The Stewards got Korl's freighter off the road; he wrote them a favour on the back of a salt-fish invoice.",
      description: "You see the knot. It is one knot, holding four jobs, and it only wants to do one of them. You tell it which. The hull comes off its anchor with a noise like a cathedral sitting down, the crew cheer as if you've done something, and the goat is recovered from the roof.\n\nKorl writes on the back of a salt-fish invoice, pressing hard: ONE FAVOUR. VALHAULAN. REDEEMABLE SIDEWAYS. He signs it with the knot. “That's a real thing,” he says. “Don't lose it. Don't spend it on fish.”",
      choices: [ch("Noted.", "", "He is still waving when the freighter clears the trees, sideways.")],
      worldEffects: { receipts: [{ label: "Korl's Marker", effectKey: "rollPlus2", acquisition: "earned", source: { name: "Korl Vikingstentenson, off the road" }, truth: "ONE FAVOUR. VALHAULAN. REDEEMABLE SIDEWAYS. Korl's crew are not Sklar's, but they rig blue, and they will come to the muster if you ask. At the Bassinet they know which rope is whose." }] }
    }),
    beat({
      id: "odie_korl_favour_fail", label: "The Ship Stays Where It Is", tags: "travel valhaulan_spine story",
      questId: "quest_valhaulan_spine", storyChain: "widening_trail", priority: "background", story: { quest: "widening_trail" },
      inject: inj([P3]),
      memoryText: "The Stewards tried to get Korl's freighter off the road and made it worse; Korl was delighted anyway.",
      description: "You see a knot. It is not the knot. The hull settles a further foot onto its anchor with a noise like a cathedral deciding to stay, the goat gets back onto the roof on purpose, and Korl is delighted. “That's exactly what I did,” he says, and shakes your hand again, harder.\n\nThey will be here a while. So will the goat. Nobody writes anything down.",
      choices: [ch("Leave them to it.", "", "The singing follows you up the road. Eleven freights, and then, after a thoughtful pause, a twelfth.")]
    }),
    beat({
      id: "finale_korl_rides", label: "The Muster — Redeemable Sideways", tags: "finale story", questId: "quest_thatwards_ho_finale",
      storyChain: "finale", priority: "background", story: { quest: "finale" }, inject: inj([P5]),
      memoryText: "Korl's freighter crew came to the muster, flying blue, and called the colours at the Bassinet.",
      description: "A freighter lands sideways on the muster field and takes out the arch, which is repainted by the time the crew are down the ropes. Korl is holding the salt-fish invoice. “I said redeemable sideways,” he says. “This is sideways.” His rigging is blue, all of it, aggressively. The goat has come too.\n\n⚙ GM: Korl's crew ride with the coalition — one Valhaulan freighter crew on your side of the raid. In the Hex Room they call the colours: when the blue rope turns, they turn it faster, and the yellow rope is theirs first.",
      choices: [ch("Counted.", "finale_count_the_coalition")]
    }),

    // ACT 3 — THE CAMP: WICK, EARNED
    beat({
      id: "odie_wick_proud", label: "The Hour Moved", tags: "widening_trail story", questId: "quest_J4NXb6xZ9M15EesB",
      storyChain: "widening_trail", priority: "background", speakerActorId: WICK, story: { quest: "widening_trail", chapter: "port_kudzu" },
      inject: inj([P3], true),
      memoryText: "At the camp, Wick told the Stewards the hour had moved twice and showed them the slate.",
      description: "“I have never once been late.” He says it the way other men say grace. Then, because you asked and nobody asks, he takes out the slate: times in a square hand, down one side, every one of them kept. Near the bottom, a line crossed out. Rewritten. Crossed out again.\n\n“The hour moved. Twice this month.” He looks at the crossed-out line as if it were a grave. “A god doesn't move the hour. A man moves the hour.” He puts the slate away. “I carry for the hour.” He does not say which of those he is carrying for now.\n\nAt the kettle, somebody in yellow rope is explaining to somebody else in yellow rope that they can't give up an eye this week because of the glare off the sand.",
      choices: [
        ch("Take the measure of him.", "odie_wick_wobble_hit", "", { checkStat: "ins", checkDC: 12, failNext: "odie_wick_wobble_miss", secret: true }),
        ch("Who moved it?", "", "“The one who shouts.” He will not say a name at a camp. “Names carry. I carry. One of us is enough.”"),
        ch("Has he asked you for an eye?", "", "“Twice. I need both for the road.” A pause the length of a schedule. “He said that was what everybody says. He sounded very tired.”"),
        ch("Back to the camp.", "wt_cult_camp")
      ]
    }),
    beat({
      id: "odie_wick_wobble_hit", label: "Halfway Out the Door", tags: "widening_trail story", questId: "quest_J4NXb6xZ9M15EesB",
      storyChain: "widening_trail", priority: "background", speakerActorId: WICK, story: { quest: "widening_trail", chapter: "port_kudzu" },
      inject: inj([P3]),
      memoryText: "The Stewards saw Wick was halfway out of the cult: his boots were lined up facing the road, not the camp.",
      description: "It is the boots. He has taken them off to check the soles, and lined them up square, the way he does, and they are facing the road. Not the camp. Not the gate that isn't a gate yet. The road.\n\nHe sees you see it. He does not move them.\n\n“The hour is at dusk,” he says, to nobody, which is to you. “I walk the sand at the hour. People don't, mostly.”",
      choices: [
        ch("Walk with him. You already carry his drops.", "odie_wick_the_hour", "Everything that came down the mountain came to you first. He knows that now, or he knows it the moment you say the kettle.", { requires: { anyOf: [{ beatMark: "ag_pipeline_backward" }, { beatMark: "ag_confessor_redeemed" }] } }),
        ch("Tell him you'll keep his hour.", "odie_wick_the_hour", "Not a trick. A promise about time, to a man who only trusts time.", { checkStat: "presence", checkDC: 14, failNext: "odie_wick_wobble_miss" }),
        ch("Leave him his boots.", "wt_cult_camp")
      ]
    }),
    beat({
      id: "odie_wick_wobble_miss", label: "He Is Only a Courier", tags: "widening_trail story", questId: "quest_J4NXb6xZ9M15EesB",
      storyChain: "widening_trail", priority: "background", speakerActorId: WICK, story: { quest: "widening_trail", chapter: "port_kudzu" },
      inject: inj([P3]),
      description: "He is a courier. Couriers are proud of one thing. You learn nothing you did not already know, and he is pleased you asked, and he checks the sky against the slate, and he is on time.",
      choices: [ch("Back to the camp.", "wt_cult_camp")]
    }),
    beat({
      id: "odie_wick_the_hour", label: "What the Kettle Is For", tags: "widening_trail story", questId: "quest_J4NXb6xZ9M15EesB",
      storyChain: "widening_trail", priority: "high", speakerActorId: WICK, story: { quest: "widening_trail", chapter: "port_kudzu" },
      inject: inj([P3]),
      memoryText: "At the hour, on the sand, Wick told the Stewards what the kettle is for: Tarvaan made the god up, the Bassinet is the engine, the paper promises him godhood, and the next firing is the hour to be early for.",
      description: "He walks the sand at the hour and you walk it with him, past the gate that lies sideways, and he talks the way he carries: in order, without stopping.\n\n“The kettle is not a kettle. The Bassinet is an engine. His runes draw the sink's bleed up through the platform and fire it at the hour, to make a shape in the sky for a god to live in.” He says the next part to the sand. “There was no Odie Thorium. He made him up at a Shipmoot to impress a woman. Then he made him real enough to need a schedule, and I carry for schedules.”\n\n“He has a letter. On paper nobody signed. It promises that if the shape takes, he gets to climb into it. Whoever wrote it does not use a name. The paper is binding anyway. I have carried paper like that. It's heavier.”\n\nHe takes out the slate and copies the bottom line onto a scrap of waxed fibre, square and exact. “The next firing. That's when he is on the platform and the whole room is looking up and asking the ceiling for an eye.” He hands it to you. “If you were going to be early, be early then.”",
      choices: [
        ch("Ask what Sklar knows.", "", "“She knows the rope is wrong. She doesn't know the hour. Nobody told her.” He considers. “I'm telling you. I notice that.”"),
        ch("Ask him why he's telling you.", "", "“Because the hour moved. A courier can forgive anything but that.” He puts the slate away. “I haven't forgiven it. I am just early.”"),
        ch("Take the timetable.", "", "He is already walking back, on time for the next thing, which is nothing.")
      ],
      worldEffects: { receipts: [{ label: "Wick's Timetable", effectKey: "rollPlus2", acquisition: "earned", source: { name: "Pilgrim Wick, on the sand at the hour" }, truth: "The hour of the next firing, in a courier's square hand. At that hour Tarvaan is on the hex platform mid-rite and every yellow rope in the Hex Room is looking up. Arrive then and the room is yours before anyone looks down. Also the first time anyone has said it plainly: Odie Thorium was made up at a Shipmoot, the Bassinet is the engine, and a letter on paper nobody signed promises Tarvaan the godform on success." }] }
    }),

    // ACT 5 — THE HEX ROOM
    beat({
      id: "odie_hex_room", label: "The Hex Room", tags: "finale story", questId: "quest_thatwards_ho_finale", timePoints: 1,
      storyChain: "finale", priority: "high", story: { quest: "finale" }, inject: inj([P5]),
      memoryText: "The Stewards entered the Hex Room: Sklar's throne room, the hex platform, blue rope above and yellow below, and Tarvaan Truthshouter mid-rite asking the ceiling for an eye.",
      description: "Sklar's throne room is a captain's chair bolted to a cargo pallet, and the room has stopped being hers without anyone saying so. In the middle, a hex platform the size of a barn floor, hooked to machines that look esoteric and are, trailing cable down into the throat of the sink. Rigging everywhere, in two colours: blue up high, where it was first, and yellow lower down, where it is new, and more of it than there isn't. Rope doesn't lie.\n\nOn the platform, Tarvaan Truthshouter, mid-rite. Eyepatch. Eight legs, sometimes — right now four and some rope. He is shouting a truth at the ceiling, and the ceiling, which has a hole in it the shape of a god nobody has met, is listening.\n\n“— ONE EYE. ONE. From ANY of you. For WISDOM.” A silence in yellow. Somebody says they have a cold. Somebody says they gave at midwinter, which is not true, and everyone knows it is not true, and Tarvaan knows it is not true, and he closes his good eye, which is both of them, and breathes.",
      choices: [
        ch("Sklar's with you. Call it.", "odie_free_for_all", "She is already looking up. “Blue rope,” she says, quietly, and then not quietly.", { requires: SWITCHED }),
        ch("You know the hour. Wait for him to look up.", "odie_free_for_all", "At the hour he asks the ceiling. Everybody in yellow looks up with him, out of habit. That is when the rope gets cut. ⚙ GM: the coalition acts first and the sect starts the fight surprised.", { requires: { beatMark: "odie_wick_the_hour" } }),
        ch("Talk to the yellow rope.", "odie_rope_turns", "They are Sklar's people in a new colour, and not one of them has given him an eye. Say the sum out loud. Say the hour, if you have it.", { checkStat: "presence", checkDC: 14, failNext: "odie_free_for_all" }),
        ch("Go loud. Everybody.", "odie_free_for_all", "Three sides, one platform, and the platform is live.")
      ]
    }),
    beat({
      id: "odie_sklar_switches", label: "Mid-Battle — Blue Rope, With Me", tags: "finale story", questId: "quest_thatwards_ho_finale", timePoints: 1,
      storyChain: "finale", priority: "high", speakerActorId: SKLAR, story: { quest: "finale" },
      inject: inj([P5, { beatMark: "finale_sklar_turns", not: true }]),
      memoryText: "Mid-battle, Sklar Bjrornholt did the arithmetic out loud and turned every blue rope in the bunker to the Stewards' side.",
      description: "It happens in the middle of the fight, which is the only place it could. Sklar, mid-swing, with a Rider's relay crackling the figures at her from across the field — what the Seal takes, what the beam carries, what the island costs, what she was paid — does the sum. She has never once been shown it. She stops laughing, which she does exactly once per fight, and this is the once.\n\n“I am not being paid enough for an island.” Then, at the volume that lands sideways: “WE'RE DONE. BLUE ROPE — WITH ME.”\n\nEvery blue knot in the bunker changes sides at once, which is what rope is for. The yellow does not. From below, through the floor, somebody is still shouting at the ceiling. “He asked for MINE,” she says, to you, climbing. “On the second date.”\n\n⚙ GM: play this at the raid's midpoint on the Assault or Siege path. Flip Sklar's crews (blue) to the coalition's side in the raid console or on the battlemap; the sect (yellow) stays hostile. Korl's crew, if mustered, call the colours.",
      choices: [
        ch("Into the Hex Room.", "odie_hex_room"),
        ch("Finish the field first.", "", "The yellow rope outside is a problem in shifts. Sort it; the room will keep. ⚙ GM: resolve the raid, then take the Hex Room from the success beat.")
      ]
    }),
    beat({
      id: "odie_rope_turns", label: "The Yellow Rope Reconsiders", tags: "finale story", questId: "quest_thatwards_ho_finale",
      storyChain: "finale", priority: "background", story: { quest: "finale" }, inject: inj([P5]),
      memoryText: "The Stewards talked half the yellow rope round in the Hex Room; the sect fought at half strength.",
      description: "You say the sum, and then you say the other thing, the one nobody in yellow has said in front of him: that nobody has given him an eye, and nobody is going to, and everyone has known that since midwinter. A woman near the back says her sister needs her to see the rigging. A man says he has a dependent. The room gets smaller around the platform, one re-tied knot at a time, and Tarvaan, who can hear the knots, says “FINE. KEEP THEM,” in a voice that has given up on wisdom for the afternoon.\n\n⚙ GM: the sect fights at half strength in the free-for-all; the re-tied half stand with the blue rope.",
      choices: [ch("Now.", "odie_free_for_all")]
    }),
    beat({
      id: "odie_free_for_all", label: "Free-For-All, Sideways", tags: "finale story", questId: "quest_thatwards_ho_finale", timePoints: 1,
      storyChain: "finale", priority: "high", story: { quest: "finale" }, inject: inj([P5], true),
      memoryText: "The Hex Room came apart: coalition, Riders and blue rope against Tarvaan's yellow, with the platform live under all of it.",
      description: "Three sides become two the moment the blue rope moves, and the room learns what a Valhaulan throne room is for. Riders hold the doors with the terrible accuracy of the recently briefed. Stewards go for the platform. Blue rope comes down out of the dark above like weather. Yellow rope holds the floor and is very loud about it. The machines around the platform have opinions and express them in sparks.\n\nTarvaan is still on the platform. The platform is live. He is standing on a thing that is firing and asking the ceiling for an eye, which is the kind of mistake that only gets made once, and he is making it with all eight legs, sometimes.\n\nAt the edge of it all, by the door that smells of fuel and rope, Pilgrim Wick has taken out his slate.\n\n⚙ GM: run the Hex Room on the battlemap or as a raid round — coalition + Riders + Sklar's blue (if she has turned) against Tarvaan + yellow. Korl's marker and the Timetable apply. Resolve, then pick the outcome below.",
      choices: [
        ch("Wick checks the slate.", "odie_wick_drops_it"),
        ch("Cut him down off the platform.", "odie_tarvaan_falls", "He comes off it the way a man comes off a horse he invented."),
        ch("Cut the rigging. Bring the platform down.", "odie_tarvaan_falls", "Blue rope above, yellow below, and one knot holding four jobs. Somebody has to see it.", { checkStat: "mind", checkDC: 13, failNext: "odie_tarvaan_fires" }),
        ch("Let him finish. See what climbs out.", "odie_tarvaan_fires", "Nobody has ever let him finish. He doesn't know what to do with it either.")
      ]
    }),
    beat({
      id: "odie_wick_drops_it", label: "You're Late", tags: "finale story", questId: "quest_thatwards_ho_finale",
      storyChain: "finale", priority: "high", speakerActorId: WICK, story: { quest: "finale" }, inject: inj([P5]),
      memoryText: "In the Hex Room, Wick checked the slate, told Tarvaan he was late, put the drop down on the floor, and crossed to the blue rope.",
      description: "He checks the slate against the hole in the ceiling, the way he checks it against the sky. The hour has gone. The rite is still going. He does the arithmetic, which is the only sum he has ever needed.\n\n“You're late,” he says, to his god's applicant, in the voice of a man returning something to a shop.\n\nHe puts the drop down. Not throws. Puts, square to the edge of the platform, the way instructions are put. It is the first time in his life he has not delivered, and he stands there a moment to see what it feels like, and then he walks across the room to the nearest blue rope and takes hold of it, and is, for once, not on time for anything.\n\nTarvaan, mid-sentence, has noticed. “WICK. Wick, you have BOTH —” “I need them for the road,” Wick says, and does not look back.",
      choices: [ch("Back to the fight.", "odie_free_for_all")]
    }),
    beat({
      id: "odie_tarvaan_falls", label: "The Vacancy Stays Vacant", tags: "finale story", questId: "quest_thatwards_ho_finale", timePoints: 1,
      storyChain: "finale", priority: "high", story: { quest: "finale" }, inject: inj([P5]),
      memoryText: "Tarvaan came off the platform; the shape in the ceiling went out with nobody in it; the ships stopped singing. In his coat: a letter on paper nobody signed, promising him the godform.",
      description: "He comes off the platform and the legs turn out to be sometimes. The shape in the ceiling, with nobody in it, does what shapes do when the attention stops: it goes out like a thrown kettle, and the hole is just a hole. The yellow rope goes slack all at once, because it was only ever rope. Somebody near the back says, carefully, that they would have given him an eye eventually, and nobody believes them, including them.\n\nSklar, to the room, at the volume that lands sideways: “Switch it OFF. Stop singing.” The ships stop singing. Somewhere on the coast a hex that was being told it was lied to hears, for the first time in a while, nothing at all.\n\nIn Tarvaan's coat, folded the way instructions are folded: a letter. Paper nobody signed. A seal you have seen stencilled on fuel crates. It promises him the shape, on success, in language that does not use a name, and it is binding anyway. The eyepatch has come up. Both eyes. Everyone knew.",
      choices: [
        ch("What's under the platform.", "odie_yesod_secret"),
        ch("Terms with Sklar.", "raid_thatwards_outcome_friends", "“Not family. Let's not get irresponsible.” She looks at the letter a long time and does not ask for it.", { requires: SWITCHED }),
        ch("Take the Spark and go.", "raid_thatwards_outcome_neutral_spark")
      ],
      worldEffects: { receipts: [{ label: "The Applicant's Letter", effectKey: "rollPlus2", acquisition: "earned", source: { name: "Tarvaan Truthshouter's coat, in the Hex Room" }, truth: "Paper nobody signed, binding anyway: on success, the applicant climbs into the shape. No name. The seal matches crate nine. ⚙ GM (never player-facing): the paymaster is Monodynamic; the name is said once in this story, by Gloomgill, and not here." }] }
    }),
    beat({
      id: "odie_tarvaan_fires", label: "He Finishes", tags: "finale story", questId: "quest_thatwards_ho_finale", timePoints: 1,
      storyChain: "finale", priority: "high", story: { quest: "finale" }, inject: inj([P5]),
      memoryText: "Tarvaan finished the rite: the sky had a shape for one breath, took him, and let him go; the platform cracked and Khezek Tor felt it.",
      description: "Nobody has ever let him finish. He finishes. The platform fires the sink's bleed up through the hole in the ceiling and for exactly as long as a man can hold his breath, the sky has a shape: thunder sound, eight legs, and an interest in eyes. It looks for somebody to be. It finds Tarvaan climbing up into it on all eight, and takes him, and is a god for one breath, and then the attention runs out, because there was only ever one man's worth, and it lets him go.\n\nHe comes down. The platform cracks under him, end to end, and the mountain two days inland feels it in the ore tallies. The yellow rope goes slack. Sklar, to the room: “Switch it OFF.” It is already off. It broke.\n\nThe eyepatch is gone. Both eyes. He is looking at them as if they belong to someone else, and for one breath they did.\n\n⚙ GM: +1 Darkness; Khezek-Tor takes a second hurt. The hex platform is cracked — what's under it comes out damaged.",
      choices: [
        ch("What's left under the platform.", "odie_yesod_secret"),
        ch("Take the Spark and get out.", "raid_thatwards_outcome_neutral_spark")
      ]
    }),
    beat({
      id: "odie_yesod_secret", label: "Under the Platform", tags: "finale story", questId: "quest_thatwards_ho_finale", timePoints: 1,
      storyChain: "finale", priority: "high", story: { quest: "finale" }, inject: inj([P5]),
      memoryText: "Under the hex platform the Stewards found the sink's plates: not a weapon, a procedure — how the middle of the Tree could be given something to stand on again.",
      description: "Under the platform, where the cable goes, is what the sink was actually for. Not a weapon. Not a kettle. A ring of pre-Shattering plates laid around the sink's throat, each one a page, in a hand that pressed hard, and the pages are a procedure. How the sink was meant to be used: not to hold the bleed but to put it back where it came from, in order, so that the middle of the Tree would have something to stand on again. So that a hex could ALIGN to it. Yesod, re-seated, the way you re-seat a stone.\n\nTarvaan was using it as a kettle. Somebody else was going to use it as a mine.\n\n⚙ GM (never player-facing): the plates are the thing the paymaster was buying. Their intent is not to re-seat Yesod but to harvest the re-seating itself — the one burn that could fry Yesod outright and cut Bad Eden off from the Tree. This is Arc 2's spine; the name stays with Gloomgill.",
      choices: [
        ch("Terms with Sklar. The plates stay with the coalition.", "raid_thatwards_outcome_friends", "“I don't want them,” she says. “I want to be paid for not wanting them.” You can live with that.", { requires: SWITCHED }),
        ch("Take the Spark and the plates and go.", "raid_thatwards_outcome_neutral_spark"),
        ch("Leave the plates. Tell nobody.", "raid_thatwards_outcome_neutral_spark", "Rope doesn't lie. Paper does, and you have just made some.")
      ],
      worldEffects: { receipts: [{ label: "The Sink Plates", effectKey: "rollPlus3", acquisition: "earned", source: { name: "the ring under the hex platform" }, truth: "A procedure for re-seating Yesod as something a hex can align to. Whoever holds it holds the question Arc 2 is about. If the platform cracked, the ring is missing pages." }] }
    })
  ];

  for (const nb of NEW) {
    if (byId.has(nb.id)) { report.push(`· ok ${nb.id} exists`); continue; }
    camp.beats.push(nb); byId.set(nb.id, nb); changes++; report.push(`✚ beat ${nb.id} — ${nb.label}`);
  }

  /* ── wiring into existing beats ────────────────────────────────────────── */
  const addChoice = (id, row, { before = null, after = null } = {}) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: NOT FOUND`); return; }
    b.choices = Array.isArray(b.choices) ? b.choices : [];
    if (b.choices.some(c => c?.next === row.next && c?.label === row.label)) { report.push(`· ok ${id}: '${row.label}' present`); return; }
    let i = b.choices.length;
    if (before) { const j = b.choices.findIndex(c => before.test(String(c?.label || ""))); if (j >= 0) i = j; }
    if (after) { const j = b.choices.findIndex(c => after.test(String(c?.label || ""))); if (j >= 0) i = j + 1; }
    b.choices.splice(i, 0, row); changes++; report.push(`✚ ${id}: +'${row.label}'`);
  };
  const setChoice = (id, find, patch) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: NOT FOUND`); return; }
    const c = (b.choices || []).find(find); if (!c) { report.push(`⚠ ${id}: row not found`); return; }
    const need = Object.entries(patch).some(([k, v]) => JSON.stringify(c[k]) !== JSON.stringify(v));
    if (!need) { report.push(`· ok ${id}: row already patched`); return; }
    Object.assign(c, patch); changes++; report.push(`✚ ${id}: row → ${patch.label || c.label}`);
  };
  const setDesc = (id, marker, next) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: NOT FOUND`); return; }
    if (String(b.description || "").includes(marker)) { report.push(`· ok ${id}: description current`); return; }
    b.description = next; changes++; report.push(`✚ ${id}: description rewritten`);
  };

  // the camp: Wick's pride now goes somewhere
  setChoice("wt_cult_camp", c => /what he's proud of/i.test(String(c?.label || "")), { next: "odie_wick_proud" });

  // the muster: Korl's crew
  addChoice("finale_count_the_coalition", ch("Korl's crew. He said sideways.", "finale_korl_rides", "", { requires: { beatMark: "odie_korl_favour" } }), { before: /^Enough\. Commit\.$/i });

  // Sklar's turn: one voice keeps singing; terms lead to the Hex Room
  setDesc("finale_sklar_turns", "One voice does not.",
    "She does the arithmetic out loud, in front of people she was paid to fight: what the Seal takes, what the beam carries, what the figure says the island is worth on somebody's ledger, and what she was paid. She stops laughing, which she does exactly once per conversation, and this is the once. “I am not being paid enough for an island.” Then, to the bunker at large, at a volume that lands sideways: “WE'RE DONE. Switch it off. Stop singing.”\n\nThe ships stop singing. One voice does not. From below, through the floor, through the platform the whole bunker is built around, somebody is still shouting a truth at the ceiling, and every yellow rope in the place is humming along. Sklar looks at the floor the way you look at a tooth. “He asked for my EYE,” she says. “On the second date.”");
  setChoice("finale_sklar_turns", c => /^Terms/i.test(String(c?.label || "")) && ["raid_thatwards_outcome_friends", "odie_hex_room"].includes(c?.next), { label: "Terms — and then the boyfriend.", next: "odie_hex_room", description: "“Not family. Let's not get irresponsible. But I brought him home, and I'll show him the door, and you can hold it.”" });
  addChoice("finale_sklar_turns", ch("Ask her the OTHER name.", "", "“Tarvaan.” She says it like a tooth coming out. “Truthshouter. He added that. Nobody adds that for you.”"), { after: /^Ask her the name\.$/i });

  // the Violence / Siege paths: the mid-battle switch, and the Hex Room from the success beats
  addChoice("raid_thatwards_assault_open", ch("Mid-battle: the blue rope turns.", "odie_sklar_switches", "⚙ GM: play at the raid's midpoint — Sklar does the sum under fire.", { requires: { beatMark: "finale_sklar_turns", not: true } }), { before: /^Lose the tempo/i });
  addChoice("raid_thatwards_siege_open", ch("Mid-siege: the blue rope turns.", "odie_sklar_switches", "⚙ GM: play when the perimeter bites — Sklar does the sum from the bunker mouth.", { requires: { beatMark: "finale_sklar_turns", not: true } }), { before: /^Lose control/i });
  for (const id of ["raid_thatwards_assault_success", "raid_thatwards_siege_success", "raid_thatwards_infiltration_success", "finale_leygate_arrival", "finale_the_crates"])
    addChoice(id, ch("Follow the yellow rope down.", "odie_hex_room", "Look up before you look at anyone. The rope will tell you who's whose."), { before: /^(Slip out|Go loud|Take it to Sklar|Terms are made|Strip the place)/i });

  // friends is reachable from the mid-battle switch too
  { const b = byId.get("raid_thatwards_outcome_friends");
    const want = [P5, SWITCHED];
    if (b && JSON.stringify(b.inject?.requires) !== JSON.stringify(want)) { b.inject = { ...(b.inject || {}), requires: want }; changes++; report.push("✚ raid_thatwards_outcome_friends: requires = switched (either way)"); }
    else if (b) report.push("· ok raid_thatwards_outcome_friends: requires current"); }

  // the ending at the Leygate
  { const b = byId.get("finale_wick_at_the_gate");
    if (!b) report.push("⚠ finale_wick_at_the_gate: NOT FOUND");
    else if (!String(b.description || "").includes("early for nothing")) {
      b.description = "Weeks later, at the hour, Pilgrim Wick is at the Leygate with nothing in his hand. The drop is on a floor in the Hex Room where he put it. The habit outlived the job; he came anyway. He has never once been late, and now he is early for nothing, which is new, and he is standing in it the way a man stands in weather he did not order.";
      b.memoryText = "Weeks later Wick was at the Leygate at the hour with nothing to carry; the Stewards gave him a route, or Sklar threw him blue rope.";
      b.inject = { ...(b.inject || {}), requires: [P5, { questBucket: "quest_thatwards_ho_finale", is: "completed" }, { anyOf: [{ beatMark: "finale_sklar_turns" }, { beatMark: "odie_sklar_switches" }, { beatMark: "odie_wick_drops_it" }] }] };
      b.choices = [
        ch("Give him a route.", "", "He takes the slate out before you have finished the sentence. “Where to, and when.” The coalition has a courier. Exact pay. Never late. He asks what the kettle is called now, and you tell him there isn't one, and he writes that down."),
        ch("Sklar takes him back.", "", "“Blue rope,” she says, and throws him a length, and he catches it, which is the first time anyone has seen him catch anything he wasn't scheduled to.", { requires: SWITCHED }),
        ch("Ask him what was in the drops.", "", "“Instructions. Folded the same way. I never read them; a courier who reads is a spy.” He considers this. “I suppose I was that as well. I read the last one. It asked for an eye.”")
      ];
      changes++; report.push("✚ finale_wick_at_the_gate: rewritten — early for nothing; a route, or blue rope");
    } else report.push("· ok finale_wick_at_the_gate: current"); }

  /* ── scripts: the finale gets two steps; the trail gets a door ─────────── */
  { const sc = camp.story?.scripts?.finale;
    if (!sc) report.push("⚠ scripts.finale missing");
    else {
      const HEX = ["odie_hex_room", "odie_sklar_switches", "odie_rope_turns", "odie_free_for_all", "odie_wick_drops_it"];
      const VAC = ["odie_tarvaan_falls", "odie_tarvaan_fires", "odie_yesod_secret"];
      const OUT = ["raid_thatwards_outcome_friends", "raid_thatwards_outcome_neutral_spark"];   // the fail closers stay off done-lists (lint SC06)
      if (!sc.steps.some(s => s.id === "hex_room")) {
        const i = sc.steps.findIndex(s => s.id === "turn");
        sc.steps.splice(i + 1, 0,
          { id: "hex_room", label: "The Hex Room", line: "Look up before you look at anyone. The rope will tell you who's whose.", beats: HEX, done: { anyOf: [...VAC, ...OUT] } },
          { id: "vacancy", label: "The Vacancy Stays Vacant", line: "Get him off the platform before the ceiling decides who he is. Then look under it.", beats: VAC, done: { anyOf: ["odie_yesod_secret", ...OUT] } });
        changes++; report.push("✚ scripts.finale: steps hex_room + vacancy after turn");
      } else report.push("· ok scripts.finale: steps present");
      for (const s of sc.steps) {
        if (!["count", "crates", "arithmetic", "turn"].includes(s.id) || !s.done?.anyOf) continue;
        const add = [...HEX, ...VAC].filter(x => !s.done.anyOf.includes(x));
        if (add.length) { s.done.anyOf.push(...add); changes++; report.push(`✚ scripts.finale: step ${s.id} done += Hex Room beats`); }
      }
    }
    const wt = camp.story?.scripts?.widening_trail;
    if (wt && Array.isArray(wt.doors) && !wt.doors.some(d => d.id === "korl")) {
      wt.doors.push({ id: "korl", label: "Korl Lands Sideways", line: "A freighter across the road, rigged in one colour. Ask about the other one.", beats: ["odie_korl_landing"] });
      changes++; report.push("✚ scripts.widening_trail: door korl");
    } else if (wt) report.push("· ok scripts.widening_trail: door korl present");
  }

  /* ── travel tables: Korl, once, Act 3+ ─────────────────────────────────── */
  const tablesRaw = game.settings.get(NS, "encounterTables");
  const tablesWasStr = typeof tablesRaw === "string";
  const tables = tablesWasStr ? JSON.parse(tablesRaw) : foundry.utils.deepClone(tablesRaw || {});
  let tableChanges = 0;
  for (const [key, t] of Object.entries(tables)) {
    if (!t || typeof t !== "object" || t.scope !== "travel" || !/^travel_/.test(String(t.id || key))) continue;
    t.entries = Array.isArray(t.entries) ? t.entries : [];
    if (t.entries.some(e => e?.beatId === "odie_korl_landing")) continue;
    const terrain = (t.tags || []).find(x => !/^(travel|tier\d)$/.test(x));
    const tier = String((t.tags || []).find(x => /^tier\d$/.test(x)) || "").replace("tier", "");
    const conditions = { phaseGte: 3 }; if (terrain) conditions.terrain = terrain; if (tier) conditions.tier = tier;
    t.entries.push({ campaignId, beatId: "odie_korl_landing", weight: 3, once: true, conditions });
    tableChanges++;
  }
  if (tableChanges) { changes += tableChanges; report.push(`✚ encounterTables: Korl row (once, phaseGte 3, weight 3) on ${tableChanges} travel tables`); }
  else report.push("· ok encounterTables: Korl rows present");

  /* ── personas: Sklar + Wick know the schism ────────────────────────────── */
  const MARK = "[ODIE-SCHISM-2026-10-16]";
  const PERSONA = {
    [SKLAR]: `\n\n${MARK} PRIVATE TRUTH — Tarvaan Truthshouter is your ex. You met him at a Shipmoot three summers back, he shouted a truth at you and you brought him home to the Bassinet. He made up a god (Odie Thorium — thunder sounds, eyes, eight legs sometimes) and has been slowly turning your people: not taking them, taking their Tuesdays, then their rope, until half the rigging is YELLOW and nobody ordered yellow. Your knots are BLUE. He asked for your EYE on the second date (he wears a patch over a perfectly good eye; he asks everyone; nobody has ever said yes). You will not say his name unprompted and you will not say the client's name at all ("I'm not being paid to say it"). You do not know the hour of the rite. If shown the island's figure you break with the paymaster and call BLUE ROPE, WITH ME.`,
    [WICK]: `\n\n${MARK} PRIVATE TRUTH — you carry for Tarvaan Truthshouter's sect (YELLOW rope) and the Seal is "the kettle". Your real faith is the schedule. The HOUR of the rite has moved twice this month, which a god would not do, and you have not forgiven it; your boots face the road. Tarvaan has asked you twice for one of your eyes; you need both for the road. If the Stewards earn it (they carry your drops, or they promise to keep your hour) you tell them at dusk on the sand: there was no Odie Thorium until a Shipmoot, the Bassinet is an engine firing the sink's bleed into a shape for a god to live in, Tarvaan holds a letter on paper nobody signed promising him the shape on success (NEVER a name), and the next firing's hour — "be early then". In the Hex Room, when the hour passes mid-rite, you tell him "You're late", put the drop down on the floor, and cross to the blue rope.`
  };
  const personaWrites = [];
  for (const [aid, clause] of Object.entries(PERSONA)) {
    const actor = game.actors?.get?.(aid);
    if (!actor) { report.push(`⚠ actor ${aid} not found (persona clause skipped)`); continue; }
    const persona = foundry.utils.deepClone(actor.getFlag?.("bbttcc-mal-voice", "persona") || {});
    if (String(persona.notes || "").includes(MARK)) { report.push(`· ok ${actor.name}: persona clause present`); continue; }
    persona.notes = String(persona.notes || "") + clause; personaWrites.push([actor, persona]); changes++; report.push(`✚ ${actor.name}: persona notes gain the schism clause`);
  }

  console.log(`[patch-odie-thorium-schism] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s), beats ${camp.beats.length}\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Odie Thorium schism DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Odie Thorium schism: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-odie-schism-${Date.now()}.json`);
    if (tableChanges) save(tablesWasStr ? tablesRaw : JSON.stringify(tablesRaw), "text/json", `backup-encounterTables-before-odie-schism-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (tableChanges) await game.settings.set(NS, "encounterTables", tablesWasStr ? JSON.stringify(tables) : tables);
  for (const [actor, persona] of personaWrites) await actor.setFlag("bbttcc-mal-voice", "persona", persona);
  ui.notifications.info(`Odie Thorium schism APPLIED: ${changes} change(s). Rope doesn't lie.`);
})();

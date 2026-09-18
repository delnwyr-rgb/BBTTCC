// Bad Eden — STORY SCRIPTS, Acts 0–2 (Phase B of the STORY FLOW encode, 2026-09-17)
// ─────────────────────────────────────────────────────────────────────────────
// Every ruling here was made by the owner, quest by quest, on 2026-09-15/16 (worksheet: ~/STORY_FLOW_2026_09_15.md;
// plan: ~/STORY_FLOW_ENCODE_PLAN_2026_09_16.md). A script DECLARES a quest's order: giver, player-facing description,
// ordered steps (the beats that play each step + the Log's next-step line), doors (open all act, never "next"),
// epilogues, and an Arrival chapter (act 1) that seals when the act turns. The story model reads these through
// registerScripts() — see story-model.js "SCRIPTS". Shape, gates and done-rules are documented there.
//
// Beat ids are the LIVE ids (save dz3ojlzxid5f, 2026-09-17). Where a ruling needs a beat that does not exist yet,
// the step names the nearest existing beat and carries a `// TODO(seeder)` note — Phase C creates the beat and
// the id is swapped here. Lint S01 reports any id that is not in the campaign.
//
// Register: story-model.js imports STORY_SCRIPTS and registers it at load. No manifest change (story-model is imported,
// not listed).
// ─────────────────────────────────────────────────────────────────────────────

export const STORY_SCRIPTS = {

  // ═══ ACT 0 ══════════════════════════════════════════════════════════════════
  offices: {
    giver: "Mal (narrator); Adam Kadmon, played by your GM, runs the slides",
    description: "Before you had a body, somebody explained the universe to you. Mal said the words. Adam Kadmon ran the projector. The Lens shattered, the World shattered itself back on purpose, and a handful of hexes Thatwards now belong to whoever shows up willing. That's you. Listen, then go.",
    steps: [
      { id: "sayings", label: "The Sayings", line: "Listen. Mal is speaking.",
        beats: ["fates_and_destinies_saying_as_above", "fates_and_destinies_saying_form_consciousness", "fates_and_destinies_map_territory", "fates_and_destinies_attention_energy", "fates_and_destinies_bus_explodes", "fates_and_destinies_attention_remember", "fates_and_destinies_incarnate"],
        done: { mark: "fates_and_destinies_incarnate" } },
      { id: "guess", label: "Guess What", line: "Adam Kadmon has something prepared. Let him get through it.", beats: ["fates_and_destinies_adam_kadmon"] },
      { id: "slides", label: "The Ten Slides", line: "Ten slides. Progress the deck.",
        beats: ["fates_and_destinies_1", "fates_and_destinies_2", "fates_and_destinies_3", "fates_and_destinies_4", "fates_and_destinies_5", "fates_and_destinies_6", "fates_and_destinies_7", "fates_and_destinies_8", "fates_and_destinies_9", "fates_and_destinies_10"],
        done: { mark: "fates_and_destinies_10" } },
      { id: "cold", label: "Cold Open", line: "Watch.", beats: ["thatwards_ho_cold_open"], chapter: "opening" },
      { id: "ho", label: "Thatwards Ho!", line: "Read the briefing. Then the Jackalope leaves for Allesh-Gilliam.", beats: ["thatwards_ho_opening_scene"], chapter: "opening" }
    ],
    doors: [], after: [],
    chapters: { opening: { giver: "Mal", line: "Read the briefing. Then the Jackalope leaves for Allesh-Gilliam." } }
  },

  // sarmoung_hum: UNSCRIPTED by ruling (ambient rungs; the tent is pinned into Allesh-Gilliam · Arrival)

  // ═══ ACT 1 + 2 · ALLESH-GILLIAM ══════════════════════════════════════════════
  allesh_gilliam: {
    giver: "Marshal Yarrow Pike",
    description: "Pike gave you two errands and in a vaguely threatening, grandfatherly way. The Leygate is remembering wrong, and the only replacement stabilizer he knows of sits in the Arc Bay at Furrier's Fixit. The East Wall is bowing, and the Architect, Plumb, calls it cosmetic. Keep one promise and the town might stop measuring you for a box.",
    arrival: { act: 1, giver: "Avuncular Joan",
      description: "Joan handed you a fortress, a farm, and a hole in the ground, told you to keep one promise, and left. Allesh-Gilliam wants to be met before it wants to be fixed. Eat here, sleep here, learn names. In the morning, ride out and see what you own.",
      steps: [
        { id: "welcome", label: "Welcome!", line: "The Jackalope has stopped. Get off.", beats: ["allesh_gilliam_opening_scene"] },
        { id: "joan", label: "Joan's Sendoff", line: "Joan is waiting just inside the gate. Hear her out.", beats: ["avuncular_joans_speech"] },
        { id: "round", label: "The Welcome Round", line: "Walk the town. Six doors, any order. Call it a day once you've been met.",
          beats: ["allesh_gilliam_town_walk"],
          done: { anyOf: ["allesh_gilliam_yarrow_welcome", "allesh_gilliam_tamsin_welcome", "allesh_gilliam_etta_welcome", "allesh_gilliam_waiting_room_intro", "allesh_gilliam_vacancy_intro", "allesh_gilliam_plumb_office_intro", "ag_first_night_soma_break"] } },
        { id: "night", label: "First Night", line: "Take your Soma Break. Sleep behind the wall.", beats: ["ag_first_night_soma_break"] },
        { id: "tent", label: "The Tent at the Edge of Town", line: "There's a tent at the edge of town that wasn't there yesterday. Look in on your way out.", beats: ["hum_quiet_tent"], borrow: true },   // the Hum's rung 1, pinned here by ruling
        { id: "crossroads", label: "The Crossroads", line: "Ride out and see that over which you now have Stewardship, which sounds awesome and definitely something to brag about in postcards home.",
          beats: ["ag_crossroads_first_rides"], done: { mark: "ag_days_end" } },   // the hub stays current until the day ends (playtest 2026-09-18)
        { id: "daysend", label: "Day's End", line: "Divvy the hexes, set each faction's plans, then the GM runs the turn.", beats: ["ag_days_end"] },
        { id: "title", label: "Title Card", line: "The first turn is in the books. Roll problems.", beats: ["ag_title_card"] }
      ] },
    steps: [
      { id: "trouble", label: "The Trouble Starts", line: "Pike is waiting at the HQ. Hear the errands.", beats: ["allesh_gilliam_introduction_to_hq"] },
      { id: "wall", label: "The East Wall", group: "errands", line: "Walk the East Wall. Survey it, crew it, read it — three swings, any order — then tell Pike what we're doing wrong.",
        beats: ["allesh_gilliam_the_east_wall_intro", "allesh_gilliam_east_wall_listen", "ag_east_wall_survey", "ag_east_wall_crew", "ag_east_wall_read", "ag_east_wall_tally"],
        done: { anyOf: ["allesh_gilliam_east_wall_success", "ag_east_wall_holds", "ag_east_wall_patched", "allesh_gilliam_east_wall_failure"] } },   // three checks + graded outcomes (Phase D content patch d2)
      { id: "gate", label: "The Gate That Remembers Wrong", group: "errands", line: "Go and see the Leygate. Garren knows what it needs, and he has something for you to carry.", beats: ["ag_leygate_visit"] },
      { id: "fixit", label: "Ride for Furrier's Fixit", line: "Ride for Furrier's Fixit Farm with the spanner and bring back the stabilizer.",
        beats: ["ag_ride_fixit"], handoff: { quest: "fixit_farm", chapter: "the_leyline_stabilizer" }, done: { chapter: ["fixit_farm", "the_leyline_stabilizer"] } },
      { id: "install", label: "The Gate Remembers Right", line: "Bring the crate to Garren at the Leygate and let him work.", beats: ["ag_leygate_delivery", "ag_leygate_installed"], done: { mark: "ag_leygate_installed" } },
      { id: "close", label: "Pike Updates the Map", line: "Pike is updating the map. Go and see your names on it.", beats: ["allesh_gilliam_pike_closure"] }
    ],
    doors: [
      { id: "tamsin", label: "Father Tamsin", line: "Father Tamsin has a night story. Ask about the dream.", beats: ["allesh_gilliam_father_tamsin_conversation", "ag_tamsin_the_dream", "ag_tamsin_the_dream_after", "ag_tamsin_the_dream_after_hundred"] },
      { id: "etta", label: "Etta at the Long Market", line: "Etta said questions keep. They've kept. Go to the Long Market.", beats: ["allesh_gilliam_the_long_market_intro", "allesh_gilliam_etta_bloom_conversation", "allesh_gilliam_etta_bloom_convo_exit"] },
      { id: "muster", label: "The Muster", line: "The Muster is open by the North Gate. Captain Brakk is drilling farmers.", beats: ["allesh_gilliam_muster_intro"] }
    ],
    after: ["allesh_gilliam_wall_stands_straight"],
    chapters: {
      the_town_militia: { giver: "the bandits you let walk", line: "Freed bandits plus a nervous town equals a militia. The Muster is open; see what Brakk is building." },   // TODO(seeder): the three rungs
      the_confessor_s_debt: { giver: "the third candle", line: "The tea is already poured. Go and see Father Tamsin, and decide what justice looks like." }
    }
  },

  // ═══ ACT 1 + 2 · LYRENN ══════════════════════════════════════════════════════
  lyrenn: {
    giver: "Elsin Quade and Rowan of the Loam, by letter",
    description: "Two letters came from Lyrenn the morning after that one night. Elsin Quade's says something is tearing up the east channels, bring patience, never the shovel. Rowan's says the trees are moving, toward you. The farm feeds the coalition, the land is reading you, and Lyrenn does not punish violence. It remembers it.",
    arrival: { act: 1, giver: "the rows",
      description: "Lyrenn doesn't greet you. It notices you, which around here is the same thing, done more honestly.",
      steps: [
        { id: "road", label: "The Road to Lyrenn", line: "The road to Lyrenn doesn't so much go as it is permitted. Head into town.", beats: ["lyrenn_opening_scene"] },
        { id: "rows", label: "Walking the Rows", line: "Meet Elsin, meet Rowan, see the Green Ring. Call it a day when the rows have noticed you.",
          beats: ["lyrenn_town_walk"], done: { anyOf: ["lyrenn_elsin_welcome", "lyrenn_rowan_welcome", "lyrenn_green_ring_cinematic"] } }
      ] },
    steps: [
      { id: "word", label: "Word from Lyrenn", line: "Word from Lyrenn. Elsin and Rowan both wrote. Ride Thatwards-by-Green.", hereLine: "Word from Lyrenn. Elsin and Rowan both wrote. You're already here. Go and see.",
        beats: ["lyrenn_word_channels", "lyrenn_word_treeline", "lyrenn_word_ride"], done: { anyOf: ["lyrenn_word_ride", "lyrenn_quest_acceptance", "lyrenn_quest_scene"] } },
      { id: "second", label: "The Rows, Second Season", line: "Lyrenn is expecting you. Take the rows' measure from the co-op steps.", beats: ["lyrenn_quest_acceptance", "lyrenn_quest_scene"], done: { mark: "lyrenn_quest_scene" } },
      { id: "pest", label: "The Gentle Pest", group: "threads", chapter: "the_gentle_pest", line: "The east channels. Elsin said patience first. Go and look.",
        beats: ["lyrenn_the_gentle_pest_acceptance", "lyrenn_the_gentle_pest"], done: { chapter: ["lyrenn", "the_gentle_pest"] } },
      { id: "forest", label: "The Forest Will Not Be Fought", group: "threads", chapter: "the_forest_will_not_be_fought", line: "The fence line. The forest will not be fought. Rowan is waiting.",
        beats: ["lyrenn_forest_will_not_be_fought_quest_acceptance", "lyrenn_forest_will_not_be_fought"], done: { chapter: ["lyrenn", "the_forest_will_not_be_fought"] } },
      { id: "field", label: "The Field That Remembers You", group: "threads", chapter: "the_field_that_remembers_you", line: "The low field, the one nobody harvests. Bring nothing sharp.",
        beats: ["lyrenn_the_field_that_remembers_you", "lyrenn_the_field_that_remembers_you_intro"], done: { chapter: ["lyrenn", "the_field_that_remembers_you"] } },
      { id: "vault", label: "The Seed Vault", line: "Elsin will open the vault now. Stand next to her when she finds out what's down there.",
        beats: ["lyrenn_seed_vault", "lyrenn_red_thread_planting"], done: { mark: "lyrenn_red_thread_planting" } },
      { id: "aligns", label: "The Hex Aligns", line: "Lyrenn is deciding whether you can stay. Let it.", beats: ["lyrenn_hex_settles"] }
    ],
    doors: [
      { id: "choir", label: "The Water Choir", line: "The Water Choir is tuning to you. Stand in it and listen.", beats: ["lyrenn_water_choir", "lyrenn_water_choir_reading"] },
      { id: "elsin", label: "Elsin Quade", line: "Elsin will answer what you ask. She'd rather answer it once.", beats: ["lyrenn_elsin_quade_convo"] },
      { id: "rowan", label: "Rowan of the Loam", line: "Rowan is listening to the ground. Ask what's loud.", beats: ["lyrenn_rowan_of_the_loam_convo"] },
      { id: "ring", label: "The Green Ring", line: "The Green Ring listens. Walk it.", beats: ["lyrenn_green_ring"] }
    ],
    after: ["lyrenn_red_thread_sprouted", "lyrenn_soil_keeps_books"],
    chapters: {
      the_gentle_pest: { giver: "Elsin Quade", line: "Patience first, shovel later. Ideally never the shovel." },
      the_forest_will_not_be_fought: { giver: "Rowan of the Loam", line: "Redirect it, negotiate with it, or find out why it will not be fought." },
      the_field_that_remembers_you: { giver: "the low field", line: "Burn it, harvest it, or talk to it. It notices." },
      the_red_thread: { giver: "the seeds", line: "They came up overnight, leaning. Lyrenn's soil just volunteered to take you somewhere." },
      the_land_remembers: { giver: "the soil", line: "Lyrenn does not punish violence immediately. It remembers it." }
    }
  },

  // ═══ ACT 1 + 2 · KHEZEK-TOR ══════════════════════════════════════════════════
  khezek_tor: {
    giver: "Foreman Drax Calder, via the evening ore tallies",
    description: "Word came up with the evening ore tallies: the old sealed shaft has new handwriting, and Calder's crews won't work the gallery beside it. Khezek Tor is the coalition's Yesodium, the mountain that feeds everyone and asks for more than it admits. The last crew opened a chamber wrong and the mountain coughed; half the town thinks it did it on purpose. If Lyrenn teaches patience, Khezek Tor teaches limits. Somebody has to decide what the mountain says next.",
    arrival: { act: 1, giver: "the cookline",
      description: "You hear Khezek Tor before you see it. At the shift change, the mountain shows you its other face: the cookline.",
      steps: [
        { id: "road", label: "The Road Thatwards-by-North", line: "Smelter-glow on the clouds. Head into town.", beats: ["khezek_tor_main_scene"] },
        { id: "cookline", label: "A Seat at the Cookline", line: "Eat what Bez gives you. Meet Calder, meet Sable. Showing up at the cookline is the introduction.",
          beats: ["khezek_tor_town_walk"], done: { anyOf: ["khezek_tor_drax_welcome", "khezek_tor_sable_welcome"] } }
      ] },
    steps: [
      { id: "word", label: "Word from the Mountain", line: "Word from Khezek Tor came up with the ore tallies. The old shaft has new handwriting. Ride Thatwards-by-North.", hereLine: "Word from Khezek Tor came up with the ore tallies. You're already on the mountain. Go and see.",
        beats: ["vs_overture", "khezek_word_ride"], borrow: true, done: { anyOf: ["khezek_word_ride", "khezek_tor_quest_acceptance", "khezek_tor_quest_scene"] } },   // the spine's overture IS Khezek-Tor's word (ruling); khezek_word_ride = Phase C
      { id: "switchback", label: "The Switchback", line: "Calder doesn't spook, and his crews won't work the gallery. Take the mountain's measure from the switchback.", beats: ["khezek_tor_quest_acceptance", "khezek_tor_quest_scene"], done: { mark: "khezek_tor_quest_scene" } },
      { id: "mine", label: "The Mine That Answered Back", group: "shafts", chapter: "the_mine_that_answered_back", line: "Calder wants you below. The new shaft broke into something he won't call a cavern.",
        beats: ["khezek_tor_mine_that_answered_back_quest_acceptance", "khezek_tor_mine_that_answered_back"], done: { chapter: ["khezek_tor", "the_mine_that_answered_back"] } },
      { id: "shipment", label: "The Shipment of Utter Darkness Sometimes", group: "shafts", chapter: "the_shipment_of_utter_darkness_sometimes", line: "Brennig has a crate on the bench that won't stop humming. Go and notice the stone.",
        beats: ["khezek_tor_darkness_shipment_quest_acceptance", "khezek_tor_darkness_shipment"], done: { chapter: ["khezek_tor", "the_shipment_of_utter_darkness_sometimes"] } },
      { id: "seal", label: "The Valhaulan Seal", line: "The sealed shaft. Fresh sigils, pointed somewhere. Read it properly before you touch it.",
        beats: [], handoff: { quest: "valhaulan_seal" }, done: { quest: "valhaulan_seal" } },   // the Seal is its own quest; this step hands off to it
      { id: "squares", label: "The Mountain Squares Up", line: "STEWARDS, SEE ME, in chalk, underlined once. Go and see Calder.", beats: ["khezek_hex_settles"] }
    ],
    doors: [
      { id: "calder", label: "Calder at the Brace", line: "Calder talks while he works. Ask how deep it goes.", beats: ["khezek_tor_the_brace", "khezek_tor_drax_calder_convo"] },
      { id: "sable", label: "Sable Nine at the Maw", line: "Sable Nine has a point on the map that won't hold still. Bring your own chair.", beats: ["khezek_tor_the_maw", "khezek_tor_sable_nine_convo"] },
      { id: "lift", label: "The Lift Hall", line: "Brennig runs the crates from a desk built out of two pallets and a door.", beats: ["khezek_tor_the_lift_hall"] },
      { id: "galleries", label: "The Upper Galleries", line: "The courier's route goes up past the numbered levels. Follow it, at a respectful distance.", beats: ["khezek_upper_galleries"] }   // TODO(seeder): re-declare into khezek_tor, gate on the Seal active
    ],
    after: ["khezek_sink_widens", "khezek_compound_cough", "khezek_brace_groans"],
    chapters: {
      the_mine_that_answered_back: { giver: "Foreman Calder", line: "Exploit it, seal the breach, or open it up fully. Someone has to decide what Khezek Tor says next." },
      the_shipment_of_utter_darkness_sometimes: { giver: "Quartermaster Brennig", line: "Standardize the handling, perform a rite, or ignore it. The stone is proud." },
      the_sink_watch: { giver: "Sable Nine's charts", line: "The opened sink below Level Four is wider. Sable checks every night." },
      the_compound_cough: { giver: "the bunkhouses", line: "The cough has a name, a bed count, and a road to Greeley's folder marked OWED." },
      the_brace_strain: { giver: "third shift", line: "The Brace groaned like a hull remembering the sea. It holds. Nothing says forever." }
    }
  },

  valhaulan_seal: {
    giver: "Foreman Calder's crews, who won't work the gallery",
    description: "A sealed shaft bears Valhaulan sigils. Recent. Precise. Directional. The seal doesn't bind inward. It points outward, like a pipe, like a siphon. Three tools are on the table: mend it, aim it, or open it, and the mountain is listening to the discussion.",
    steps: [
      { id: "curious", label: "Formally Curious", line: "The markings are fresh and somebody has been maintaining them. Go and look.", beats: ["khezek_tor_valhaulan_seal_quest_acceptance"] },
      { id: "cinematic", label: "The Seal", line: "It doesn't bind inward. Watch where it points.", beats: ["khezek_tor_valhaulan_seal_cinematic"] },
      { id: "decide", label: "Mend, Aim, or Open", line: "Restore the seal, redirect its energies, or break it. Read it properly before you touch it.",
        beats: ["khezek_tor_the_vaulhaulan_seal", "khezek_tor_seal_fail"], done: { anyOf: ["khezek_tor_the_vaulhaulan_seal_restore", "khezek_tor_the_vaulhaulan_seal_redirect", "khezek_tor_the_vaulhaulan_seal_break"] } }
    ],
    doors: [], after: [], chapters: {}
  },

  // ═══ ACT 2 · FURRIER'S FIXIT FARM ════════════════════════════════════════════
  fixit_farm: {
    giver: "Pike sends you; on site, Young Gearbox names the price-setter, Mara Quickhands",
    description: "Pike sent you for the stabilizer and Garren gave you the spanner to prove it fits. Furrier's Fixit is the Jackalopes' yard. Mara Quickhands decides what things cost. The Jackalopes are deciding what you are.",
    steps: [
      { id: "browsing", label: "Open for Browsing", line: "Take the lap. Pip or Patter will show you the yard, once, fast.",
        beats: ["fixit_cinematic_intro", "fixit_town_walk", "fixit_intro_scene"], done: { anyOf: ["fixit_town_walk", "fixit_intro_scene"] } },
      { id: "arcbay", label: "The Arc Bay", line: "The Arc Bay is filled with shit you 100% cannot afford. But it is pretty and shiny and looking at it gives you dopamine. Luckily, Young Gearbox DOES have something you're in the market for.",
        beats: ["fixit_arc_bay_exterior", "fixit_arc_bay_conversation", "fixit_arc_bay_conversation_2"], done: { mark: "fixit_arc_bay_conversation_2" } },
      { id: "stabilizer", label: "The Leyline Stabilizer", chapter: "the_leyline_stabilizer", line: "Mara sets the price. Bring the spanner to the table and don't name the wrong number.",
        beats: ["fixit_leyline_stabilizer", "fixit_leyline_stabilizer_negotiation"], done: { chapter: ["fixit_farm", "the_leyline_stabilizer"] } },   // TODO(seeder): fixit_leyline_stabilizer rewritten as the crate + spanner check
      { id: "prisoner", label: "The Weeping Prisoner", chapter: "the_weeping_prisoner", line: "There's a crying Fey in the back room and it's your territory. Hopefully those two things are not directly, LEGALLY connected. Given that Mara wants to know what you decide to do about the thing that's making a full grown adult with gossamer wings sit in the back of a Rig factory and bawl his eyes out, you are probably about to be enlightened.",
        beats: ["fixit_arc_bay_conversation_3", "fixit_weeping_prisoner"], done: { chapter: ["fixit_farm", "the_weeping_prisoner"] } },
      { id: "settles", label: "The Farm Settles", line: "The Farm has stopped auditioning you. Load the crate and ride home to Garren.", beats: ["fixit_hex_settles"] }
    ],
    doors: [
      { id: "gullywasher", label: "The Gullywasher", line: "There's a Chupacabra behind the bar. Oh shit. He's the bartender. Order something before you interrogate him.", beats: ["fixit_saloon_cinematic", "fixit_gullywasher_welcome", "fixit_gullywasher_interior_convo"] },
      { id: "counter", label: "The Counter", line: "The Counter quotes weight, not price. Ask Mara what her biggest headache is.", beats: ["fixit_general_store_exterior", "fixit_general_store_coversation"] },
      { id: "pip", label: "Pip and Patter", line: "Pip and Patter move in synch with everything that moves - it's a feature! Ask what's moving near Allesh.", beats: ["fixit_pip_and_patter_convo"] },
      { id: "backstairs", label: "The Back Stairs (allies)", line: "OFF LIMITS. SCRAM. Except Stewards, once the Jackalopes call you allies.", beats: ["fixit_backstairs_exterior"] },
      { id: "generator", label: "The Generator Hall (allies)", line: "Escort only. It's not personal. Allies get the tour.", beats: ["fixit_power_station_exterior", "fixit_power_station_conversation"] }
    ],
    after: [],
    chapters: {
      the_leyline_stabilizer: { giver: "Young Gearbox, then Mara Quickhands", line: "Trade, shared oversight, or the hard ask. Delay means come back." },
      the_weeping_prisoner: { giver: "Mara Quickhands", line: "Justice, punish, mercy, or defer. This is your territory. What does justice look like?" }
    }
  },

  // ═══ ACT 2 · CIRCUIT RIDER PARLEY ═══════════════════════════════════════════
  circuit_riders: {
    giver: "nobody. The road. The Riders find you",
    description: "Static crawls across exposed metal before you see anyone. Then a man in a patched, lovingly maintained robot suit steps forward and tells you, in a CLASSIC monotone robot voice, not to be alarmed. The Circuit Riders verify first, befriend second, rescue third. Survive their verification, and one day a clean call might bring them hard, fast, and without theatrical delay.",
    steps: [
      { id: "riders", label: "The Circuit Riders", line: "Static on the metal. Something enormous is pretending to be under control. Approach, or watch first.",
        beats: ["enc_circuit_riders_parley_approach", "enc_circuit_riders_parley_observe"], done: { anyOf: ["enc_circuit_riders_parley_approach"] } },
      { id: "parley", label: "Parley", line: "DO NOT BE ALARMED, CITIZENS. Pick how you meet a man in a robot suit.",
        beats: ["enc_circuit_riders_parley_opening"], done: { anyOf: ["enc_circuit_riders_parley_respect", "enc_circuit_riders_parley_humor", "enc_circuit_riders_parley_skepticism"] } },
      { id: "doctrine", label: "Verification: Doctrine", group: "verify", line: "Verification first. Do you understand your own methods, or are you mistaking momentum for wisdom?",
        beats: ["enc_circuit_riders_pressure_doctrine"], done: { anyOf: ["enc_circuit_riders_doctrine_good", "enc_circuit_riders_doctrine_mixed", "enc_circuit_riders_doctrine_bad"] } },
      { id: "darkness", label: "Verification: Darkness Mimicry", group: "verify", line: "They warn that Darkness has learned to imitate optimization. Take it seriously, or don't.",
        beats: ["enc_circuit_riders_pressure_darkness"], done: { anyOf: ["enc_circuit_riders_darkness_good", "enc_circuit_riders_darkness_mixed", "enc_circuit_riders_darkness_bad"] } },
      { id: "witness", label: "Verification: The Witness", group: "verify", line: "They want someone to see what they see and survive it. Will you look?",
        beats: ["enc_circuit_riders_pressure_witness"], done: { anyOf: ["enc_circuit_riders_witness_good", "enc_circuit_riders_witness_mixed", "enc_circuit_riders_witness_bad"] } },
      { id: "terms", label: "Terms of Contact", line: "Terms of contact. Alliance is earned, not picked.",
        beats: ["enc_circuit_riders_parley_resolution"], done: { anyOf: ["enc_circuit_riders_parley_alliance", "enc_circuit_riders_parley_neutral", "enc_circuit_riders_parley_flagged"] } }
    ],
    doors: [
      { id: "robot", label: "Captain Robot", line: "Captain Robot has a crew, and each of them has a question for you. Ask them theirs.", beats: ["enc_circuit_riders_captain_robot_intro"] },
      { id: "crew", label: "Simone, Arvind, Howard, Dennis", line: "Simone checks whether you lag. Arvind hears patterns. Howard recovers things. Dennis is the regrettable hypothesis.", beats: ["enc_circuit_riders_simone_intro", "enc_circuit_riders_arvind_intro", "enc_circuit_riders_howard_intro", "enc_circuit_riders_dennis_intro"] },
      { id: "see", label: "Show us what you see", line: "You do not get to witness their burden casually. Stay for the whole pattern.", beats: ["enc_circuit_riders_witness_request"] }
    ],
    after: ["circuit_riders_classification_review", "circuit_riders_review_stood", "circuit_riders_chase_run", "circuit_riders_chase_caught", "circuit_riders_chase_escaped"],
    chapters: {}
  },

  // ═══ ACT 2 · THE FOREST OF EARLY TIFARET ═════════════════════════════════════
  tifaret: {
    giver: "the forest. It opens for you like it was expecting you",
    description: "The forest on the Fixit road opens for you like it was expecting you. It is beautiful the way a knife is beautiful, and it believes harmony is achievable. Correctly. It does not want you dead. It wants you better. That is not the same thing as wanting you safe.",
    steps: [
      { id: "opens", label: "The Forest Opens", line: "The forest on the Fixit road has opened for you. It wants you better. Decide what that's worth.", beats: ["forest_of_tifaret_approach"] },
      { id: "merge", label: "Merge and Learn — The Tree's Session", group: "answer", line: "It wants to be seen. Three questions, any order; after the second the channel draws something. Show it something true, or show it the Lyrenn treaty.",
        beats: ["forest_of_tifaret_merge", "forest_of_tifaret_session_carry", "forest_of_tifaret_session_become", "forest_of_tifaret_session_do", "forest_of_tifaret_obstructor", "forest_of_tifaret_session_tally"], done: { anyOf: ["forest_of_tifaret_harmonious_ending", "forest_of_tifaret_harmonious_lite", "forest_of_tifaret_neutral_ending"] } },
      { id: "fight", label: "Cleanse the Forest", group: "answer", line: "You asked for a fight. The forest is disappointed, at scale.",
        beats: ["forest_of_tifaret_fight"], done: { anyOf: ["forest_of_tifaret_aggression_ending"] } },
      { id: "leave", label: "Leave", group: "answer", line: "The forest is co-dependent. Talk your way out, or back out and lose the day.",
        beats: ["forest_of_tifaret_leave"], done: { anyOf: ["forest_of_tifaret_neutral_ending", "forest_of_tifaret_aggression_ending", "forest_of_tifaret_harmonious_ending", "forest_of_tifaret_harmonious_lite"] } }
    ],
    doors: [], after: [], chapters: {}
  },

  // ═══ ACT 2 · THE FORGOTTEN CAUSE ═════════════════════════════════════════════
  forgotten_cause: {
    giver: "Dougan, at the bar, once the Wendigo have been met twice",
    description: "The Wendigo on the leyline roads are polite, orderly, helpful, and every account of them is missing the same piece. Dougan says someone is doing this region's grieving for it, and doing it badly. Where the leylines knot they keep a long table with a name-card for everyone the region forgot. One of the cards has your name on it. Sit, decide what happens to all of it, then come back and tell Dougan whether you were ever truly enemies.",
    steps: [
      { id: "off", label: "Something a Little Off", line: "The Wendigo on the roads are kind, and something is off. Meet them twice and say the shape out loud at the Gullywasher.", beats: ["fc_bridge_off"] },
      { id: "dougan", label: "Dougan Points the Way", line: "Dougan has stopped polishing the glass. Go to the bar.", beats: ["gullywasher_dougan_points_to_confluence"] },
      { id: "table", label: "The Long Table", chapter: "the_long_table", line: "Where the leylines knot, a table is set and your name is on a card. Read the cards before you decide.",
        beats: ["fc_bridge_confluence", "wendigo_confluence_the_long_table", "wendigo_confluence_name_cards"], done: { chapter: ["forgotten_cause", "the_long_table"] } },   // Phase C re-declares repair/redirect/break as this chapter's endings; the summit success is the closer
      { id: "reason", label: "An Empty Reason-Column", line: "You're carrying the reason. Dougan is setting a room. Rooms like that don't stay set.", beats: ["fc_bridge_summit"] },
      { id: "ledger", label: "Close the Ledger", chapter: "close_the_ledger", line: "A Chupacabra at one end, a Jackalope at the other, the Ledger open between them. Enter the cause and close the line.",
        beats: ["gullywasher_cultural_summit"], done: { chapter: ["forgotten_cause", "close_the_ledger"] } }
    ],
    doors: [], after: [],
    chapters: { the_long_table: { giver: "the Wendigo", line: "Restore the node, take the trust onto yourselves, or sever the network. Read the cards first." }, close_the_ledger: { giver: "Dougan", line: "Read the recovered cause aloud and enter it in the Ledger. Without the cause the line cannot truly close." } }
  },

  // ═══ ACT 2 · THE BANDIT ACCORD ═══════════════════════════════════════════════
  bandit_accord: {
    giver: "the reeds. Nobody sends word. The Drowned South counts",
    description: "You let bandits walk, and the Drowned South is counting. Word travels through the reeds: surrender to the Stewards and you get a warning, maybe pointers, occasionally soup. Keep it up and the spared start orbiting the Muster, ambushes surrender before the roll, and somewhere out past the stilt-camps a Bandit Lord with BOOKS starts drafting a letter.",
    steps: [
      { id: "count", label: "The Drowned South Keeps Count", line: "You let them walk. The reeds are listening. What you do next gets counted.", beats: ["bandit_accord_opening"] },
      { id: "alive", label: "Alive Ones", line: "Two spared bandits are orbiting the Muster. One left a cleaned fish on a waypost. That's a formal document.", beats: ["bandit_word_spreads"] },
      { id: "queue", label: "The Muster Gets a Queue", line: "There's a queue outside the Muster at dawn. Brakk made a sign. Go and see the REFORMED column.", beats: ["bandit_volunteers"] },
      { id: "arms", label: "Arms Down in the Reeds", line: "An ambush just surrendered before the roll. The program is open, or it isn't. Decide with their hands up.",
        beats: ["bandit_ambush_arms_down"], done: { anyOf: ["bandit_arms_down_accept", "bandit_arms_down_violence"] } },
      { id: "envoy", label: "The Envoy", line: "A punt under a white rag. Ralph Maccio requests a summit. Answer the lieutenant. He brought his own rations.", beats: ["bandit_envoy"] },
      { id: "summit", label: "The Summit at the Stilt-Hall", line: "The stilt-hall where three channels argue. She has BOOKS. Sign, absorb, humiliate, or refuse.",
        beats: ["bandit_summit"], done: { anyOf: ["bandit_summit_accord", "bandit_summit_absorption", "bandit_summit_humiliation"] } }   // TODO(seeder): refuse is no longer a closer — the envoy returns
    ],
    doors: [], after: [], chapters: {}
  },

  // ═══ ACT 2 · THE CADENCE ═════════════════════════════════════════════════════
  cadence: {
    giver: "a courier in sequins, at golden hour",
    description: "A card of genuinely excellent stock, scented with confidence: a Declaration of Rhythm from a crew called the Cadence, who your scouts describe as heavily armed with speakers. Meet them on the floor or the floor comes to you. Nobody has ever seen them throw a punch. They have never needed to. Losing costs face, and face travels to every neighboring hex.",
    steps: [
      { id: "card", label: "A Formal Declaration of Rhythm", line: "A courier in sequins is at the gate with a card. The scent is confidence. Meet them on the floor, or don't.",
        beats: ["cadence_declaration"], done: { anyOf: ["cadence_battle", "cadence_refuse"] } },
      { id: "floor", label: "The Floor", line: "They build the floor in an hour and arrive exactly on time. Culture and Soft Power only. Find the pocket of the beat.",
        beats: ["cadence_battle"], done: { anyOf: ["cadence_win_style", "cadence_win_ugly", "cadence_lose"] } },
      { id: "rematch", label: "The Rematch", group: "again", line: "Cardstock with the turn, like weather. The tribute stands until you dance.",
        beats: ["cadence_rematch"], done: { anyOf: ["cadence_win_style", "cadence_win_ugly"] } },
      { id: "border", label: "The Border Performance", group: "again", line: "They're performing at breakfast now. A viewing mound has infrastructure. Answer the floor.",
        beats: ["cadence_border_show"], done: { anyOf: ["cadence_win_style", "cadence_win_ugly"] } }
    ],
    doors: [
      { id: "cameo", label: "The Cadence Honors the Floor", line: "The Cadence owes you a raid. Name the target when you need morale like a weather system.", beats: ["cadence_cameo", "cadence_cameo_spent"] }
    ],
    after: [], chapters: {}
  },

  // ═══ ACT 2 · THE GRIEF HEXES ═════════════════════════════════════════════════
  chuckle_creek: {
    giver: "nobody. A road that ends in a painted backdrop",
    description: "The sky is a painted backdrop and the sun has a face. A man takes an anvil to the skull, flattens to the thickness of a playing card, springs back, and tips his hat. Nothing here can hurt anyone, the pie is mostly steam and enthusiasm, and the creek actually chuckles. Enjoy it. Then ask somebody what last winter was like.",
    steps: [
      { id: "arrive", label: "Everything Is a Bit", line: "Let yourself enjoy it. The delight is the evidence. Ask the diner owner about last winter.", beats: ["chuckle_arrival"] },
      { id: "r1", label: "There Is No Last Winter", line: "Nobody here has a past tense. There's an extra place set at the corner table.", beats: ["chuckle_rung_1"] },
      { id: "r2", label: "The Chair at the Table", line: "Her daughter is off-screen. Try to leave town with somebody.", beats: ["chuckle_rung_2"] },
      { id: "r3", label: "You Try to Leave With Someone", line: "Nobody leaves Chuckle Creek. Watch the seam where a scene changes.", beats: ["chuckle_rung_3"] },
      { id: "r4", label: "The Title Card", line: "The title card is a memorial plaque. Find whoever is running this.", beats: ["chuckle_rung_4"] },
      { id: "showrunner", label: "The Showrunner", line: "Series finale, new episode, or cancelled. Sit with how badly someone had to want this.",
        beats: ["chuckle_showrunner"], done: { anyOf: ["chuckle_finale", "chuckle_new_episode", "chuckle_cancelled"] } }
    ],
    doors: [], after: [], chapters: {}
  },

  soft_landing: {
    giver: "nobody. An inflatable arch and two guards with pool noodles",
    description: "The gate is an inflatable arch and the guards challenge you with pool noodles and immense seriousness. The streets give underfoot, a state function is being conducted on a moon-bounce, and a thrown punch lands in foam that apologises. Nobody can be hurt here. Ask someone where they're from and watch what happens to the question.",
    steps: [
      { id: "arrive", label: "Challenged by Pool Noodles", line: "Boing. Let yourself. Then ask somebody where they came from.", beats: ["soft_landing_arrival"] },
      { id: "g1", label: "The Conversation Bounces", line: "The question bounces, every time, from everyone. Go looking for a grave.", beats: ["soft_landing_give_1"] },
      { id: "g2", label: "No Graves, No Photographs", line: "There are no graves, no photographs, no archive. Find the one who isn't bouncing.", beats: ["soft_landing_give_2"] },
      { id: "g3", label: "The Elder Who Isn't Bouncing", line: "The padding is thin around one tired woman. Get someone to say what happened, out loud.", beats: ["soft_landing_give_3"] },
      { id: "g4", label: "One Held Breath", line: "They built it so they'd never hit the ground. Somebody has to go first.", beats: ["soft_landing_give_4"] },
      { id: "choice", label: "The Only Weapon Left", line: "Grieve with them, build them a landing ground, or strip the padding. Vulnerability is the only weapon that works here.",
        beats: ["soft_landing_choice"], done: { anyOf: ["soft_landing_go_first", "soft_landing_practice", "soft_landing_harden"] } }
    ],
    doors: [], after: [], chapters: {}
  },

  stillwater: {
    giver: "nobody. A Sunday that doesn't end",
    description: "Cut grass, percolator coffee, a kid selling lemonade at a card table. People wave, not warily, just waving. It is the most unsettling thing you have felt in a long time, because nothing here is wounded or watching. Somebody hands you today's paper. Check the date.",
    steps: [
      { id: "arrive", label: "A Sunday That Doesn't End", line: "Exhale first. Then mention the world outside and watch the faces.", beats: ["stillwater_arrival"] },
      { id: "c1", label: "The Topic Slides Off", line: "It slides off every time. There's a woman on the platform bench waiting for the 4:10.", beats: ["stillwater_crack_1"] },
      { id: "c2", label: "The Woman at the Station", line: "There hasn't been a train in decades. Show someone a piece of the after.", beats: ["stillwater_crack_2"] },
      { id: "c3", label: "One of Them Sees It", line: "One of them saw it, and aged. Walk to the edge of town where the road runs out.", beats: ["stillwater_crack_3"] },
      { id: "c4", label: "The Wall Is Thinning", line: "The bubble is failing on its own schedule. Decide whether anybody gets told first.", beats: ["stillwater_crack_4"] },
      { id: "choice", label: "What You Do With the News", line: "Ring the bell, keep the covenant, or harvest it. You're carrying the news, and the news is the apocalypse.",
        beats: ["stillwater_choice"], done: { anyOf: ["stillwater_ring_the_bell", "stillwater_covenant", "stillwater_harvest"] } }
    ],
    doors: [], after: [], chapters: {}
  }

  // valhaulan_spine (That One Night): UNSCRIPTED by ruling — a reader quest; its bridge cards fire as the towns resolve.
};

/* patch-story-review-road-2026-10-19.macro.js — STORY REVIEW LEDGER, "Act 2 findings: the road" rows 1–27, ALL Accept (Dave, 2026-10-19)
 *  Row 1 RULING REVERSED by Dave: the "Oh, darling" Gully is the proper one (based on a friend); the laconic ranch-country Gully of
 *  the 10-16 welcome tree is the drift — so the NEW beats are rewritten into the theatrical voice and the old nine + the Forgotten
 *  Cause beats stay. Row 5 uses the new {{#played …}} story token (module.js). Row 8 was already live. Every text edit is guarded
 *  by the live baseline. DRY_RUN default true; GM only; backs up `campaigns`.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [String(b.id), b]));
  const report = []; let changes = 0;
  const ok = (m) => report.push("· ok " + m);
  const add = (m) => { changes++; report.push("✚ " + m); };
  const warn = (m) => report.push("⚠ " + m);
  const B = (id) => { const b = byId.get(id); if (!b) warn(`${id}: beat missing`); return b; };
  const rep = (id, from, to, field = "description") => {
    const b = B(id); if (!b) return;
    const cur = String(b[field] || "");
    if (to ? cur.includes(to) : !cur.includes(from)) return ok(`${id}.${field} already reads the new text`);
    if (!cur.includes(from)) return warn(`${id}.${field}: baseline not found — skipped`);
    b[field] = cur.replace(from, to); add(`${id}.${field}: text`);
  };
  const setDesc = (id, from, to) => {
    const b = B(id); if (!b) return;
    const cur = String(b.description || "");
    if (cur === to) return ok(`${id}: description already set`);
    if (from != null && cur !== from) return warn(`${id}: description moved since the review — skipped`);
    b.description = to; add(`${id}: description`);
  };
  const choice = (b, label) => (b.choices || []).find(c => c && c.label === label);
  const setChoiceField = (id, label, field, to) => {
    const b = B(id); if (!b) return; const c = choice(b, label);
    if (!c) return warn(`${id}: choice '${label}' not found`);
    if (c[field] === to) return ok(`${id} › '${label}'.${field} already set`);
    c[field] = to; add(`${id} › '${label}'.${field}`);
  };
  const repChoiceDesc = (id, label, from, to) => {
    const b = B(id); if (!b) return; const c = choice(b, label);
    if (!c) return warn(`${id}: choice '${label}' not found`);
    const cur = String(c.description || "");
    if (to ? cur.includes(to) : !cur.includes(from)) return ok(`${id} › '${label}' already reads the new text`);
    if (!cur.includes(from)) return warn(`${id} › '${label}': baseline not found — skipped`);
    c.description = cur.replace(from, to); add(`${id} › '${label}'.description: text`);
  };
  const addChoice = (id, ch, where = "end", afterLabel = null) => {
    const b = B(id); if (!b) return; b.choices = b.choices || [];
    if (b.choices.some(c => c && c.label === ch.label && c.next === ch.next)) return ok(`${id}: choice '${ch.label}' exists`);
    if (where === "start") b.choices.unshift(ch);
    else if (where === "after") { const i = b.choices.findIndex(c => c && c.label === afterLabel); b.choices.splice(i < 0 ? b.choices.length : i + 1, 0, ch); }
    else b.choices.push(ch);
    add(`${id}: choice '${ch.label}' → ${ch.next}`);
  };
  const addRequire = (id, label, cond) => {
    const b = B(id); if (!b) return; const c = choice(b, label); if (!c) return warn(`${id}: choice '${label}' not found`);
    let reqs = c.requires; if (!Array.isArray(reqs)) reqs = reqs ? [reqs] : [];
    const key = JSON.stringify(cond); if (reqs.some(r => JSON.stringify(r) === key)) return ok(`${id} › '${label}': gate present`);
    c.requires = reqs.concat([cond]); add(`${id} › '${label}': gate ${key}`);
  };
  const Q = "“", q = "”";

  // ── Row 1: Gully's proper voice (Oh, darling) on the 10-16 beats ──
  setDesc("fixit_gullywasher_welcome", null,
    "There is a Chupacabra standing behind the bar, washing glasses. Oh shit — he's the bartender.\n\nThat was not on your post-apocalyptic 5D bingo card this morning.\n\nHe clocks your face doing the thing every new face does, grants it precisely two seconds of patience, and slides a glass down the bar with a flourish the glass did not strictly require. Something amber. Something carbonated, aggressively.\n\n“House rule, darlings,” he says. “The first one is on the Farm, as a gesture of optimism. The second one, you tell me where you're from. The third one, I tell you where I'M from, and you buy THAT round, because mine is a better story and I curate accordingly.”\n\nAround you: Jackalopes off shift, a teamster asleep sitting up with a full glass in hand (nobody touches it), ley sigils glowing in the tabletops, a chalkboard advertising poetry on Wednesdays, and a dartboard where the bullseye has been relabeled ANYWHERE. The Gullywasher, it turns out, is exactly what it looks like: the one room in the wasteland where everybody's from somewhere else, and the ambiance is curated to make certain you notice.");
  setDesc("fixit_gully_answer_name", null,
    "“Behind the bar? Gully.” The glass in his hands achieves a shine that borders on editorial. “Short for the Gullywasher, which is short for what the first batch of the amber thing did to a gentleman's opinion of his own limits. We don't speak of him. He's fine. He's a deacon now.” He sets the glass down exactly on its ring mark. “Everywhere else I have another name, and we'll see if you earn it. Names, my dear, are like the good bottles — one does not open them for strangers, and one feels a perfect fool for having saved them too long.” A nod at your drink. “Drink up. You're doing beautifully so far.”");
  setDesc("rc_gully_amber", null,
    "You drink the amber thing. Your eyebrows file their report. It tastes like peaches that did something unforgivable and got away with it, and the carbonation has opinions about your sinuses.\n\nGully slides the second one down the bar without being asked, and waits, with the serene patience of a man who hosts poetry readings. He does not say the rule again. He said it once; repeating oneself is for menus. The dartboard says ANYWHERE. The teamster asleep sitting up does not spill.\n\n“Everybody in this room paid for that glass with the same coin, darling. Your turn.”\n\n<i>The amber thing: +1 on Intrigue checks until the turn ends. Everybody in this room is from somewhere else. Now so are you.</i>");
  setDesc("rc_gully_second_round", null,
    "You tell him where you're from. All of it, or enough of it — the place, or the day you left the place, which out here is the same answer told honestly.\n\nHe listens the way the very best bartenders listen, which is with the glass and not the eyes, and with one eyebrow doing all the work of a studio audience. Somewhere in the middle the teamster asleep sitting up says “mm” without waking, which in this room counts as applause. When you finish, Gully sets the glass down as if closing a programme.\n\n“Oh, that'll do. That'll do nicely.” The empty goes; the ring mark gets wiped. “Everybody leads with the town. Nobody is from a town, darling. They're from the day they left it, and you got there quicker than most, which I shall be mentioning to people.” He glances at the third glass he has not poured. “Mine's a better story. You're buying.”\n\nThe dartboard says ANYWHERE. You've just told the room which anywhere, and the room, without looking up, moved over an inch to make space.");
  setDesc("rc_gully_getting_there", null,
    "“Behind the bar? Gully.” A glass gets polished to within an inch of its life. “Everywhere else — oh, you're getting there. You're getting there. Don't rush it; anticipation is half the ambiance.”\n\nHe tips the glass toward the third one he hasn't poured yet. The house rule has a third line, and it has your name on it, and his.");
  setDesc("rc_gully_soured", null,
    "You drink the amber thing. Gully slides the second one down the bar and waits. You drink that too, and when he asks, you say: nowhere in particular.\n\nThe Gullywasher is the one room in the wasteland where everybody's from somewhere else. You've just told the room you're from nowhere, which is the one place nobody in it respects.\n\nGully takes the second glass. Takes it mid-sip, with great delicacy. “The first one is on the Farm, darling,” he says, polishing, pleasant as a closed door. “The second one has a price. You didn't pay it. I don't sell gossip and I don't give away seconds; I curate.” The teamster asleep sitting up with the full glass does not wake, but the glass somehow seems further from you than it was.\n\n<i>Morale −2; the Farm's standing slips a step. The first one's always on the Farm. Come back with an answer.</i>");
  setDesc("rc_gully_third_round", null,
    "You buy the third round. He pours it himself, which he hasn't done all night, and pours one for himself, which the room notices and pretends not to.\n\n“Scrubland. South. Goat country — the kind of south where the map runs out of names and starts using adjectives.” He tastes the amber thing like a man checking it's still true. “Everybody down there knows a Chupacabra story, darling. Nobody down there had met one, because we were raised polite and we were raised to leave before the shouting. I left so early the shouting hadn't started. It had to send word on after me. Three towns in a row put up a sign: CHUPACABRA SEEN. I wasn't seen. I was serving.”\n\nHe lets that sit, with excellent timing.\n\n“Tended bar in a town that voted, twice, to run me out. Both times the vote lost, because the only roof in town that didn't leak was mine. That's where I'm from. A place that hated me on principle and tipped me on the way out.” He sets the glass down, exactly on its ring. “Now that's a better story than yours. It usually is. Don't take it personally; take it as a standard to aspire to.”\n\nThen, and it costs him nothing you can see, which is how you know what it costs:\n\n“Dougan. Dougan Marsh. Behind the bar it's still Gully — but you're not behind the bar, are you.” He adjusts a cufflink that did not need adjusting. “Use it sparingly, darling. It's not a bottle one opens for the room.”\n\nEverybody in this room is from somewhere else. One of them just told you where.");
  rep("gullywasher_gully_points_to_confluence",
    "\"Dougan. Dougan Marsh. That's the one that isn't behind the bar. You didn't earn it at the bar, so take it as an advance.\"",
    "“Dougan. Dougan Marsh. That's the one that isn't behind the bar, darling. You didn't earn it at the bar, so consider it an advance — against a story I fully expect you to come back and tell me.”");

  // ── Row 2: one @coalition row per beat ──
  const oneRow = (id, keepIndex, why) => {
    const b = B(id); if (!b) return; const fx = b.worldEffects?.factionEffects;
    if (!Array.isArray(fx)) return warn(`${id}: no factionEffects`);
    const co = fx.filter(r => r && /^@coalition$/i.test(String(r.factionId || "")));
    if (co.length <= 1) return ok(`${id}: one @coalition row`);
    const keep = co[keepIndex] || co[0];
    b.worldEffects.factionEffects = fx.filter(r => !(r && /^@coalition$/i.test(String(r.factionId || ""))) || r === keep);
    add(`${id}: ${co.length} @coalition rows → 1 (${why})`);
  };
  oneRow("khezek_tor_the_vaulhaulan_seal_break", 0, "−10/−10/+10 once");
  oneRow("fixit_leyline_stabilizer_delay", 0, "−1 morale, −1 loyalty");
  oneRow("fixit_weeping_prisoner_mercy", 0, "+1 loyalty once");
  oneRow("enc_bandit_ambush_win_jail", 0, "+1/+1/+1 darkness once");

  // ── Rows 3 + 16: marks, not OP; the numbers leave the prose; pre-marks deltas ×10 ──
  repChoiceDesc("khezek_tor_mine_that_answered_back", "Seal the Breach", "\n\nOptions - \n\n2 OP (any type)\n\nValuable material\n\nPublic vow", "\n\nIt'll cost you: 20 marks of any kind, something valuable, or a public vow.");
  repChoiceDesc("khezek_tor_mine_that_answered_back", "Open it up fully", "\n\n4 Violence OPs", "\n\n40 marks of Violence, up front.");
  rep("khezek_tor_darkness_shipment_standardize", "\n\nThis costs 3 Economy OP.\n\nAnd raises morale by 2.", "\n\nIt costs, in Economy. It buys back some calm.");
  rep("khezek_tor_darkness_shipment_rite", "\n\n+2 to Morale and Loyalty, -1 to Darkness, +2 to non lethal, soft power, culture, and faith OP banks.", "");
  rep("khezek_tor_darkness_shipment_ignore", "\n\n+2 Economy OPs. -1 morale, +1 darkness", "");
  rep("khezek_tor_mine_that_answered_back_open", "\n\n+2 darkness ... and maybe rising.", "\n\nThe dark rises here. It may keep rising.");
  rep("khezek_tor_the_vaulhaulan_seal_restore", "\n\n-2 to darkness. -1 to morale.", "");
  rep("khezek_tor_the_vaulhaulan_seal_redirect", "\n\n-2 morale, loyalty, +2 darkness\n\n-1 step to relationship with all Faction with whom one is not already Friendly.", "");
  repChoiceDesc("fixit_leyline_stabilizer_negotiation", "Trade", "\n\nMake a persuasion check or spend 2 Soft Power OP.", "\n\nMake a Persuasion check. Marks can back it.");
  rep("enc_hidden_vault_replicator", "add +1 economy OP per turn to that faction's production", "add +10 economy marks per turn to that faction's production");
  const scaleOp = (id, factor) => {
    const b = B(id); if (!b) return; let n = 0;
    for (const r of (b.worldEffects?.factionEffects || [])) for (const k of Object.keys(r?.opDeltas || {})) { const v = Number(r.opDeltas[k]); if (Number.isFinite(v) && v !== 0 && Math.abs(v) < 10) { r.opDeltas[k] = v * factor; n++; } }
    if (n) add(`${id}: ${n} opDelta(s) ×${factor} (marks)`); else ok(`${id}: opDeltas already in marks`);
  };
  for (const id of ["forest_of_tifaret_harmonious_ending", "forest_of_tifaret_aggression_ending", "gilbert_theater_resolution", "wendigo_confluence_repair", "gullywasher_cultural_summit_success"]) scaleOp(id, 10);

  // ── Row 4: Sable Nine is they ──
  rep("allesh_gilliam_etta_bloom_conversation", "Nine sent it to me. He found it.", "Nine sent it to me. They found it.");

  // ── Row 5: the second sign knows when it was nailed up ──
  rep("fixit_backstairs_exterior", "and, since the Vault, a second sign nailed under it in Mara's hand:", "and, {{#played fixit_late_run_success}}since Thistle's wake{{else}}since the Vault{{/played}}, a second sign nailed under it in Mara's hand:");
  rep("fixit_backstairs_exterior", "set when the Stewards brought Pip home from the Vault.", "set when the Stewards earned it: Uncle Thistle's wake (the Late Run) in Act 2, or bringing Pip home from the Vault later.");

  // ── Row 6: Garren seats it; the Jackalopes certify ──
  rep("fixit_leyline_stabilizer_trade_success", "will send someone along with the stabilizer who will install it.", "will send someone along with the stabilizer to stand by Garren while he seats it, and to certify the fit.");
  rep("fixit_leyline_stabilizer_shared_oversight_success", "will send someone along with the stabilizer who will install it, and help your engineering team get it up and running and calibrated.", "will send someone along with the stabilizer to stand by Garren while he seats it, certify the fit, and help your engineering team get it calibrated.");

  // ── Row 7: a way off the outcome card ──
  for (const id of ["fixit_leyline_stabilizer_trade_success", "fixit_leyline_stabilizer_shared_oversight_success", "fixit_leyline_stabilizer_hard_ask"])
    addChoice(id, { label: "Load the crate.", next: "fixit_load_the_crate", description: "Young Gearbox is already writing the card.", checkStat: "", checkDC: 0, failNext: "" });

  // ── Row 9: the advance-name pointer sits on the step too ──
  {
    const st = camp.story?.scripts?.forgotten_cause?.steps?.find(s => s && s.id === "dougan");
    if (!st) warn("script forgotten_cause: step dougan missing");
    else {
      if (!(st.beats || []).includes("gullywasher_gully_points_to_confluence")) { st.beats = (st.beats || []).concat(["gullywasher_gully_points_to_confluence"]); add("forgotten_cause step dougan: + gullywasher_gully_points_to_confluence"); } else ok("step dougan beats complete");
      const want = { anyOf: ["gullywasher_dougan_points_to_confluence", "gullywasher_gully_points_to_confluence"] };
      if (JSON.stringify(st.done || null) !== JSON.stringify(want)) { st.done = want; add("forgotten_cause step dougan: done anyOf both pointers"); } else ok("step dougan done set");
    }
  }

  // ── Rows 10, 19, 23, 27: the Seed Vault, once ──
  rep("lyrenn_seed_vault",
    "The reinforced hatch groans like it resents being opened. Almost as much as Elsin Quade resents being asked to open it, I guess. But she reluctantly agreed to your request and now stands watching you with somewhat expectant eyes at you, not inside the vault.\n\nCold air exhales upward.\n\nBelow, shelves descend in careful rows.\n\nGlass jars. Steel cases. Cloth-wrapped bundles.\n\nEach labeled in meticulous script.\n\nPre-Fall corn.\n\nSalt-tolerant rye.\n\nDrought-sung barley.\n\nA section cordoned off with simple red thread.\n\nInside those jars:\n\nSeeds that hum.\n\nNot loudly.\n\nNot constantly.\n\nBut enough that silence feels incomplete without them.\n\nNo one has planted those in years.\n\nNo one has agreed not to.\n\nOne shelf holds the red-thread jars — seeds wound in crimson filament, humming very slightly, labeled in the same meticulous script as everything else: \"gathered where the standing stones went quiet.\" No one has planted them in years. No one has agreed not to.",
    "The reinforced hatch groans like it resents being opened. Almost as much as Elsin Quade resents being asked to open it, I guess. But she reluctantly agreed to your request and now stands watching you with somewhat expectant eyes, not inside the vault.\n\nCold air exhales upward. Below, shelves descend in careful rows: glass jars, steel cases, cloth-wrapped bundles, each labeled in meticulous script. Pre-Fall corn. Salt-tolerant rye. Drought-sung barley.\n\nOne shelf is cordoned off with simple red thread — seeds wound in crimson filament, labeled in the same meticulous script as everything else: \"gathered where the standing stones went quiet.\" Seeds that hum, just enough that silence feels unfinished without them. No one has planted them in years. No one has agreed not to.");
  {
    const b = B("lyrenn_seed_vault");
    if (b) for (const c of b.choices || []) {
      if (c.label === "Inspect the seeds" && c.checkStat === "arc") { c.label = "Inspect the seeds (Arcana)"; add("lyrenn_seed_vault: choice label (Arcana)"); }
      else if (c.label === "Inspect the seeds" && c.checkStat === "nat") { c.label = "Inspect the seeds (Nature)"; add("lyrenn_seed_vault: choice label (Nature)"); }
    }
  }
  // the Water Choir, once; the flat basin keeps the newer claim
  rep("lyrenn_water_choir",
    "One basin never tunes to anyone. In its channel bed sits a stone hand, palm up, and the water sings the same note over it no matter who approaches. The children skip that basin. Politely.<p>Since that night it has been playing one basin flat, on purpose, like a held finger on a string. When you step close it stops — relieved, or worried, or both.</p>",
    "Since that night it has been playing one basin flat, on purpose, like a held finger on a string. In that basin's channel bed sits a stone hand, palm up. The children skip it. Politely. When you step close, the flat note stops — relieved, or worried, or both.");

  // ── Row 11: the Choir says its three things ──
  setDesc("lyrenn_water_choir_reading",
    "<p>You stop trying to understand it and let it tune to you. It takes a while. Then, in the only language it has — pitch, patience, and which basin goes quiet when — the Choir tells you three things.</p>",
    "<p>You stop trying to understand it and let it tune to you. It takes a while. Then, in the only language it has — pitch, patience, and which basin goes quiet when — the Choir tells you three things.</p><p>One. The flat basin went flat that one night. Not before. It is holding the note it was holding when the ground pulled, and nobody has told it that it can stop.</p><p>Two. The whole hex is tuned coastward — every channel leaning a half-tone toward where the standing stones went quiet, the way a congregation leans toward a door somebody left open.</p><p>Three. The Ring's empty plinth is the note the Choir is missing. It plays around the gap. It has played around the gap so long that the gap has become the tune.</p>");
  {
    const b = B("lyrenn_water_choir_reading");
    const loop = b && choice(b, "Listen again");
    if (loop) { loop.label = "Back to the Choir"; loop.next = "lyrenn_water_choir"; add("lyrenn_water_choir_reading: 'Listen again' loop → 'Back to the Choir'"); } else ok("water_choir_reading: no self-loop");
  }

  // ── Row 12: outcome-neutral closers ──
  rep("lyrenn_hex_settles", "the field remembers you fondly (it says so, out loud, which takes getting used to)", "the field has said its piece (out loud, which takes getting used to)");
  rep("khezek_hex_settles", "the DARKNESS ships on schedule (sometimes; as agreed)", "the crates are whatever you decided they are");

  // ── Row 13: the courier's route waits for the Seal ──
  addRequire("khezek_tor_quest_scene", "The Upper Galleries — follow the courier's route", { beatMark: "vs_bridge_seal" });

  // ── Row 14: no wax on the bandits' letter ──
  rep("bandit_envoy", "sealed with candle-stub wax:", "sealed with a postage stamp commemorating the 20th anniversary of The Karate Kid Part II:");

  // ── Row 15: the question trees, in character ──
  setDesc("fixit_general_store_coversation_1", "She flips coin.\n\n“People starting things.”\n\nCoin stops.\n\n“Not finishing them.”\n\nDirect eye contact.",
    "She flips a coin and catches it without looking, which is how you know she's thinking. “People who start things.” The coin goes back in her pocket unspent. “Oh, don't make that face — I love a starter. Starters are the best part. It's just that out here finishing is where the money is, and I'm the one who has to look at the half-built things every morning.”\n\nShe brightens, visibly, like a shop sign. “Prove me wrong. I'd genuinely enjoy it. I'd tell everyone.”");
  setDesc("fixit_general_store_coversation_2", "She doesn’t hesitate.\n\n“Two crates stuck in a dispute.”\n\n“Settle it clean.”",
    "Her thumb clicks twice, fast, delighted. “Oh, I was hoping you'd say that.” She leans on the Counter. “Two crates stuck in a dispute — Jackalope freight, two claimants, one invoice, nobody budging. Settle it clean and I'll know everything I need to know about you.”\n\nA tilt of the head. “Settle it messy and I'll know that too, which is almost as useful, honestly.”");
  setDesc("fixit_general_store_coversation_3", "“I like invoices paid.”",
    "“Heroes?” She laughs, surprised into it. “I like heroes fine. I like them the way I like weather. Fascinating. Hard to invoice.” The thumb clicks once. “I like invoices paid. I like the person who comes back in a month and says, remember that thing, it's done. Heroes are a lovely afternoon. That person is a lovely decade.”\n\nShe slides you a peppermint from under the Counter. “You could be either. I'm curious which.”");
  setDesc("fixit_power_station_conversation_2", "“Generators don’t care who’s in charge.”\n\nBeat.\n\n“I respect that.”",
    "He doesn't stop walking the housings, one hand on each as he passes, like taking a pulse. “What's failing? Nothing. That's the part people can't hear.” He taps a dampener that wasn't there last season. “She's holding. I'm making her ready to hold more. Something's coming down the line — load, surge, impact, I don't know the word yet — and when it comes I want her bored.”\n\nA turbine changes pitch and he waits for it the way you'd wait for a cough to pass. “Why stay? Generators don't care who's in charge. I respect that. It means the only thing she asks of me is to be right, and I can do that in here. Out there, you have to be liked.”");
  setDesc("lyrenn_elsin_quade_convo_1", "<p>She gestures at the rows — stalks head-high in a month, half of it seed and chaff. [annoyed] “Wild growth isn't yield. Push three harvests out of this now and you lose thirty later.” [exhales sharply] “If you need short-term yields — then say that plainly. I respect honesty over idealism.”</p>",
    "<p>She gestures at the rows — stalks head-high in a month, half of it seed and chaff. “Wild growth isn't yield. Push three harvests out of this now and you lose thirty later.” She looks at you the way she looked at the soil. “If you need short-term yields, say so plainly. I respect honesty over idealism. I don't respect idealism that eats next year.”</p>");
  setDesc("lyrenn_elsin_quade_convo_2", "<p>She doesn't answer immediately. “Look at the channels — something's in them. Then look at the vault with me.” A beat. “Fewer sudden mandates.” She will clearly not say “help” twice.</p>",
    "<p>“Look at the channels. Something's in them.” She counts on two fingers, and stops at two. “Then look at the vault with me. That's the list.” A beat. “And fewer sudden mandates from up the road. I'd put that on the list, but it isn't mine to put.” She will clearly not say help twice.</p>");
  setDesc("lyrenn_elsin_quade_convo_3", "She glances toward Tor.\n\n“I trust cycles.”\n\n“Not ambition.”",
    "She glances toward the Tor, once, the way you'd check a fence line. “I trust cycles. Rain, root, rot, rain. The mountain's running on ambition, and ambition doesn't rot on schedule. It just keeps.”");
  setDesc("lyrenn_elsin_quade_convo_echo", "She doesn’t like this question.\n\nBut she answers.\n\n“I used to farm where soil cracked if you breathed wrong.”\n\n“I forced yields.”\n\nA tight nod.\n\n“Met quota.”\n\nHer jaw sets.\n\n“Then the ground died.”\n\nShe looks toward Lyrenn’s fields.\n\n“I think I’m here to learn how to ask instead.”\n\nA beat.\n\n“And to see if land remembers gentleness.”",
    "She doesn't like the question. She answers it anyway, because not answering would waste more words than answering. “I used to farm where the soil cracked if you breathed on it wrong. I forced yields. Met quota. Then the ground died, and quota didn't come to the funeral.”\n\nShe looks at Lyrenn's rows, which are wild, which is not the same as dead. “I think I'm here to learn how to ask instead. And to see if land remembers gentleness.” A beat. “It remembers everything else.”");
  setDesc("lyrenn_rowan_of_the_loam_convo_1", "<p>Rowan winces. “You are.” They press soil. “You're… organizing the roots.” A small breath. “And the roots are grateful to have somewhere to go.”</p>",
    "<p>Rowan winces, and takes a moment to find the shape of it. “You are. Not your voices. Your deciding.” They press two fingers into the soil. “You're organizing the roots without meaning to. They've been loose since that night, and they're grateful to have somewhere to go.” A long pause. “Be careful where you take them.”</p>");
  setDesc("lyrenn_rowan_of_the_loam_convo_2", "Rowan studies you.\n\n“You’re deciding.”\n\nThis is literal.\n\nThey feel a Domain's drift in real time.",
    "Rowan studies you for longer than is comfortable, and then longer than that. “You're deciding,” they say at last. “Right now. I can feel which way it's going before you can.” They look at the ground, apologetic. “It isn't a trick. The soil tells me what your Domain is leaning toward, the way it tells me where the water is.”");
  setDesc("lyrenn_rowan_of_the_loam_convo_3", "They grip their head.\n\n“The soil tries to forget what it grew.”",
    "They grip their head, briefly, with both hands, like holding a lid on something. “The soil tries to forget what it grew.” A breath. “It's the worst thing I've ever felt a field do. Fields are for remembering.”");
  setDesc("lyrenn_rowan_of_the_loam_convo_echo", "Rowan frowns.\n\n“I don’t think I was someone.”\n\nThey press fingers into the dirt.\n\n“I think I was pressure.”\n\nA small, uncertain shrug.\n\n“Something the soil needed to say.”\n\nTheir eyes flick to you.\n\n“You’re loud in the roots.”\n\nA wince.\n\n“I’m here because something is trying to decide if you’re safe.”",
    "Rowan frowns at the question the way you'd frown at a word you used to know. “I don't think I was someone. I think I was pressure. Something the soil needed to say, and said, and here I am, still being said.”\n\nA small, uncertain shrug. Their eyes flick to you. “You're loud in the roots. I think I'm here because something is trying to decide if you're safe, and it wanted hands.”");
  setDesc("khezek_tor_drax_calder_convo_1", "He doesn’t answer directly.\n\n“Deep enough that maps stop mattering.”\n\nHe watches your reaction to uncertainty.",
    "“Deep enough that maps stop mattering.” He says it to the chalk, and finishes the line he's on before he looks up to see what uncertainty does to your face. He makes a mark. You don't get to see which column.");
  setDesc("khezek_tor_drax_calder_convo_2", "\"No.”\n\nA beat.\n\n“I’m wary.”\n\n“Fear panics. Wariness measures.”\n\nHe respects that distinction.",
    "“Afraid?” He finishes the seam. “No. Wary. Fear runs. Wary measures.” He holds the chalk up. “This is wary.”");
  setDesc("khezek_tor_drax_calder_convo_3", "Silence.\n\n“That’s the question.”\n\nHe’s never heard someone ask it.",
    "Silence, long enough that you hear the lift cables tick. “That's the question,” he says. He puts the chalk down, which he has not done since you arrived. “Nobody's asked it. Not the company, not the town, not the men under it. I've been keeping the answer in case anybody did.” He picks the chalk back up. “Keep asking.”");
  setDesc("khezek_tor_drax_calder_convo_echo", "He answers bluntly.\n\n“I chased a vein once.”\n\n“No safety. No surveys.”\n\n“It collapsed.”\n\nA silence.\n\n“Men under it.”\n\nHe doesn’t look away.\n\n“I’m here to finish digging the right way.”\n\nA beat.\n\n“Or to know when to stop.”",
    "He answers bluntly, because the other way takes longer. “I chased a vein once. No safety, no surveys, no patience. It collapsed.” A silence. “Men under it.” He doesn't look away from you while he says it, which is the whole apology. “I'm here to finish digging the right way. Or to know when to stop. I'm told those are the same skill.”");
  setDesc("khezek_tor_sable_nine_convo_1", "“Something that noticed the noticing.”\n\nYour clear confusion seems to relax them.",
    "“Something that noticed the noticing.” They watch your face do the thing, and it seems to relax them. “Good. You're confused. Confused is accurate. The people who nod at that sentence are the ones I worry about.”");
  setDesc("khezek_tor_sable_nine_convo_2", "Because pretending they’re normal is lethal.”\n\nThey glance toward the gate.\n\n“You can survive unpredictability. Not denial.",
    "“Because pretending they're normal is lethal.” They glance toward the gate, and fold the map one more time than it needs. “You can survive unpredictability. You can plan around it, even — that's what I do. What you can't survive is denial. Denial is the only thing down here that has killed everyone it touched.”");
  setDesc("khezek_tor_sable_nine_convo_3", "A long look.\n\n“Yes.”\n\nBut not accusatory.",
    "A long look, measured, the kind they give a chair before sitting in it. “Yes.” It isn't an accusation. “Everything that moves is part of the anomaly. You moved here. That's all I'm saying.” A pause. “That's all I'm saying yet.”");
  setDesc("khezek_tor_sable_nine_convo_echo", "Sable studies the map while speaking.\n\n“I used to predict things.”\n\n“Markets. Storms. Shifts.”\n\nA faint tension in their voice.\n\n“I missed one.”\n\nThey tap the map where it shifts.\n\n“It cost people.”\n\nA breath.\n\n“I think I’m here to catch what moves before it pretends it’s still.”\n\nThey glance up.\n\n“And to say ‘I don’t know’ before someone dies.”",
    "Sable studies the map while they speak, which is how they study everything. “I used to predict things. Markets. Storms. Shifts. I was good, which is the dangerous amount.” They tap the place on the map that won't stay still. “I missed one. It cost people.”\n\nA breath. “I think I'm here to catch what moves before it pretends it's still. And to say I don't know, out loud, before somebody dies of me not saying it.”");

  // ── Row 17: Captain Robot's one rule; the crew never shouts ──
  rep("enc_circuit_riders_captain_robot_intro", "His voice comes through a grill that should make him sound absurd. It does not.", "His voice comes through a grill that should make him sound absurd. It does not. In front of the Riders it is a monotone, every word an announcement. Across a table, to you, it is just a voice.");
  repChoiceDesc("enc_circuit_riders_file_it", "File the parade permit.", "Dennis: \"THAT IS A DATE. A REAL DATE.\"", "Dennis: \"That is a date. A real date.\"");
  repChoiceDesc("enc_circuit_riders_file_it", "File the caravan route.", "\"NO LAG,\" she says, which from Simone is a hug.", "\"No lag,\" she says, which from Simone is a hug.");
  repChoiceDesc("enc_circuit_riders_file_it", "File the official word from Khezek-Tor.", "Arvind: \"SOMEONE DID THE WORK OF BECOMING BELIEVABLE.\"", "Arvind: \"Someone did the work of becoming believable.\"");
  repChoiceDesc("enc_circuit_riders_file_it", "File the Minutes.", "Arvind reads the count. \"FORTY-ONE TO NINE. A TOWN VOTED.\"", "Arvind reads the count. \"Forty-one to nine. A town voted.\"");

  // ── Row 18: one camp, on the mountain ──
  rep("wt_cult_camp", "lying sideways in the sand the way a Valhaulan ship lands when it means to.", "lying sideways on the scree of the Khezek-Tor switchbacks the way a Valhaulan ship lands when it means to.");
  rep("wt_cult_camp", "to the cult's camp on the coast and saw the gate lying sideways in the sand.", "up the Khezek-Tor switchbacks to the cult's camp and saw the gate lying sideways on the scree.", "memoryText");

  // ── Row 19: cadence ──
  rep("lyrenn_forest_will_not_be_fought", "The forest is not aggressive.\n\nIt is correcting.<p>It is not correcting you. It is correcting for something behind it.</p>", "The forest is correcting something, and it is behind you, not you.");
  rep("lyrenn_the_field_that_remembers_you_intro", "Names move through it. Softly. Not accusations. Not pleas. Just names.", "Names move through it, softly, the way you'd say them at a bedside.");
  rep("lyrenn_word_channels", "Not weather. Not tools. Something with appetite and, she suspects, OPINIONS.", "Something with appetite and, she suspects, opinions.");
  rep("lyrenn_water_choir_inspect_insight", "It isn't the water reading you. It's the water reading what you're feeling, and playing it back", "The water is reading what you're feeling, and playing it back");

  // ── Row 20: the part sat fine ──
  rep("fixit_leyline_stabilizer_hard_ask", " It sat wrong anyway.", "", "memoryText");

  // ── Row 21: two unreachable legacy beats retire (lyrenn_main_scene stays — the visualizer holds it as an engine hub id) ──
  for (const id of ["enc_circuit_riders_filed", "enc_hidden_vault_resolution_good"]) {
    const i = camp.beats.findIndex(b => b && b.id === id);
    if (i < 0) { ok(`${id}: already retired`); continue; }
    camp.beats.splice(i, 1); byId.delete(id); add(`${id}: retired (no route in)`);
  }

  // ── Row 22: Calder is at the mine ──
  repChoiceDesc("fixit_arc_bay_conversation", "Drink the coffee.", "Somewhere in Allesh-Gilliam, Pike and Calder feel a disturbance in the club.", "Somewhere, Pike and Calder feel a disturbance in the club.");

  // ── Row 24: one completion ──
  {
    const b = B("enc_circuit_riders_parley_flagged"); const q = b?.worldEffects?.questEffects;
    if (Array.isArray(q) && q.filter(x => x && x.action === "complete" && x.questId === "quest_circuit_riders_parley").length > 1) {
      let seen = false; b.worldEffects.questEffects = q.filter(x => { if (x && x.action === "complete" && x.questId === "quest_circuit_riders_parley") { if (seen) return false; seen = true; } return true; });
      add("enc_circuit_riders_parley_flagged: duplicate quest completion dropped");
    } else ok("parley_flagged: one completion");
  }

  // ── Row 25: it's the Farm ──
  rep("fc_bridge_off", "Somebody at the Jackalope Exchange keeps a bar where roads and rumors cross;", "Somebody at Furrier's Fixit Farm keeps a bar where roads and rumors cross;");
  {
    const b = B("gullywasher_cultural_summit_success");
    if (b && b.worldEffects && typeof b.worldEffects.warLog === "string" && b.worldEffects.warLog.includes("Exchange Unity rose")) { b.worldEffects.warLog = b.worldEffects.warLog.replace("Exchange Unity rose", "The Farm's Unity rose"); add("cultural_summit_success: war log says the Farm"); } else ok("summit war log fine");
  }

  // ── Row 26: why swamp names were on the Cough roster ──
  repChoiceDesc("bandit_books", "Show her the Back-Room Roster.", "Names. Her people, in a mine's good room, on a list nobody was meant to read.", "Names. Three of them are swamp names — her people, hired up the mountain, in a mine's good room, on a list nobody was meant to read.");

  // ── Row 27: typos ──
  rep("fixit_leyline_stabilizer_negotiation", "What you got as we might want?", "What you got that we might want?");
  rep("fixit_leyline_stabilizer_shared_oversight_success", "fucks you up stright and proper.", "fucks you up straight and proper.");
  rep("enc_circuit_riders_parley_opening", "The a murmur among the crowd.", "A murmur among the crowd.");
  repChoiceDesc("enc_circuit_riders_parley_opening", "Challenge their assumptions immediately", "You are not super heros. And whag makes you think", "You are not superheroes. And what makes you think");
  rep("enc_circuit_riders_witness_request", "Relay drift. predictive overlays. route revisions. casualty maps", "Relay drift. Predictive overlays. Route revisions. Casualty maps");
  rep("enc_circuit_riders_dennis_1", "Fast routes. weird fixes. stupid ideas with excellent time-to-impact.", "Fast routes. Weird fixes. Stupid ideas with excellent time-to-impact.");

  console.log(`[patch-story-review-road] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`The road DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("The road: nothing to do.");
  try {
    (foundry.utils.saveDataToFile ?? saveDataToFile)(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-story-review-road-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`The road APPLIED: ${changes} change(s). Oh, darling.`);
})();

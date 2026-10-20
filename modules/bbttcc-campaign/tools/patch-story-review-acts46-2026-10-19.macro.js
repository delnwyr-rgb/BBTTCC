/* patch-story-review-acts46-2026-10-19.macro.js — STORY REVIEW LEDGER, "Acts 4–6 findings, encounters and strays" rows 1–20, ALL Accept (Dave, 2026-10-19)
 *  Row 1 is the engine (_stripGmNotes, now also bare "GM:" lines). Row 4: Odie stays eight-legged (fact sheet). Rows 19/20: confirmed, no change.
 *  Row 2: the Crown Mall quest and every Mall of Forgotten Yesterdays beat move to Act 3 (the Trail delivers the table there in Act 3).
 *  Row 7: the fifteen thin Mall beats get a paragraph each in the Donny register. Row 15: the twenty walk-in exteriors get a line.
 *  Every text edit is guarded by the live baseline. DRY_RUN default true; GM only; backs up `campaigns`.
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
    const b = B(id); if (!b) return; const cur = String(b[field] || "");
    if (to ? cur.includes(to) : !cur.includes(from)) return ok(`${id}.${field} already reads the new text`);
    if (!cur.includes(from)) return warn(`${id}.${field}: baseline not found — skipped`);
    b[field] = cur.replace(from, to); add(`${id}.${field}: text`);
  };
  const setDesc = (id, from, to) => {
    const b = B(id); if (!b) return; const cur = String(b.description || "");
    if (cur === to) return ok(`${id}: description already set`);
    if (from != null && cur !== from) return warn(`${id}: description moved since the review — skipped`);
    b.description = to; add(`${id}: description`);
  };
  const choice = (b, label) => (b.choices || []).find(c => c && c.label === label);
  const setChoice = (id, label, patch) => {
    const b = B(id); if (!b) return; const c = choice(b, label); if (!c) return warn(`${id}: choice '${label}' not found`);
    let n = 0; for (const [k, v] of Object.entries(patch)) { if (JSON.stringify(c[k]) !== JSON.stringify(v)) { c[k] = v; n++; } }
    if (n) add(`${id} › '${label}': ${Object.keys(patch).join("/")}`); else ok(`${id} › '${label}' already set`);
  };
  const setChoiceAt = (id, idx, patch) => {
    const b = B(id); if (!b) return; const c = (b.choices || [])[idx]; if (!c) return warn(`${id}: choice #${idx} missing`);
    let n = 0; for (const [k, v] of Object.entries(patch)) { if (JSON.stringify(c[k]) !== JSON.stringify(v)) { c[k] = v; n++; } }
    if (n) add(`${id} › #${idx} '${c.label}': ${Object.keys(patch).join("/")}`); else ok(`${id} › #${idx} already set`);
  };

  // ── Row 2: the Crown Mall is Act 3 content ──
  {
    const q = camp.story?.quests?.crown_mall;
    if (!q) warn("story.quests.crown_mall missing"); else if (q.act === 3) ok("crown_mall act 3"); else { q.act = 3; add("story.quests.crown_mall.act 4 → 3"); }
    let n = 0;
    for (const b of camp.beats) if (b.questId === "quest_forgotten_yesterdays") for (const r of (b.inject?.requires || [])) if (r && r.flag === "storyPhase" && r.gte === 4) { r.gte = 3; n++; }
    if (n) add(`forgotten_yesterdays: ${n} beat gate(s) Act 4 → Act 3`); else ok("forgotten_yesterdays gates already Act 3");
  }

  // ── Row 3: ninety-six ──
  rep("founders_garden_the_count", "the arithmetic nobody wanted: ninety-nine.", "the arithmetic nobody wanted: ninety-six, and four plinths.", "memoryText");
  // ── Row 5: two hundred ──
  rep("enc_forgotten_yesterdays_miss_june_intro", "a store vest from three hundred years ago", "a store vest from two hundred years ago");
  // ── Row 6: no design-doc language in a player's mouth ──
  setChoice("map_crown_mall_corroboration", "Done. This cluster is now real and dangerous.", { label: "Filed under weather.", description: "Kickflip files the napkin. Confirmed." });

  // ── Row 7: the thin Mall beats, in the Donny register ──
  const M = {
    enc_forgotten_yesterdays_tanneritos: "The food court is still a food court, which is the first miracle. Formica tables, a fountain that runs on principle, a Sbarro sign that has outlived the concept of Italy. The Tanneritos woke up here and never really left: thirty-odd people in windbreakers and borrowed decades, playing hacky sack under a skylight, arguing about a tape, chalking a run on the halfpipe where the pretzel stand used to be. Radical chill radiates off them like a territorial warning. Nobody looks up. Everybody has clocked you.",
    enc_forgotten_yesterdays_tanneritos_friendly: "You come in like guests, which the room notices before you've finished doing it. Somebody slides a tray of fries across — real potatoes, impossible, don't ask — and somebody else moves a backpack off a chair without being asked. The Tanneritos are welcoming, but only provisionally. You are not enemies. You are also not cool yet, and cool, here, is the whole currency.",
    enc_forgotten_yesterdays_tanneritos_intrigue: "You trade gossip the way the mall trades everything: fragments for fragments, a half-true thing about the coast for a weirdly sincere thing about a girl named Amanda. Somebody plays you four seconds of a tape and watches your face instead of the screen. The mall notices. Somewhere a ghost rewinds to hear what you said.",
    enc_forgotten_yesterdays_tanneritos_hostile: "Violence works briefly. A chair goes over, a tray goes up, and for about nine seconds you are the most important thing in the food court. Then the music comes back on, louder, and everybody turns their chairs a quarter turn away from you, all at once, like a flock. It ruins the whole mood permanently. The Tanneritos don't fight. They remember.",
    enc_forgotten_yesterdays_skate: "This is not a joke. The Tanneritos use skateboarding the way other factions use duels, audits, or trials by combat — it is the one test here nobody can fake. The halfpipe is where the pretzel stand used to be, built out of signage and bus-stop benches, and the rail along the top has been ground so long it shines. Somebody hands you a board. It has seen things.",
    enc_forgotten_yesterdays_skate_success: "You land it, and the landing lands. The crowd along the rail cheers the way a crowd cheers when it has decided something about you. Style counted. Somebody writes your name on the napkin that is also the treaty. The Tanneritos unlock rare VHS inventory and start telling you, unprompted, which factions have been moving along the coast and how badly.",
    enc_forgotten_yesterdays_skate_mixed: "You eat pavement. You eat it with some grace, though, and you get up before anyone has to decide whether to help, and that, it turns out, is most of the test. You are in. Kind of. They'll sell to you, but they're watching, and the napkin has your name on it in pencil.",
    enc_forgotten_yesterdays_skate_failure: "No combat. No bloodshed. Just judgment, which is worse. You stood at the top of the pipe like somebody reading the terms and conditions, and the Tanneritos labeled you Mall Cops before your feet left the deck. The music does not stop. It just stops being for you.",
    enc_forgotten_yesterdays_hub: "The food court keeps happening. Formica, fountain, the skylight doing its best with a sky that isn't cooperating. The smell is sugar and ozone and something fried a long time ago that never fully left. Escalators argue with gravity in both directions. Commercials play in midair to an audience that no longer exists, and the audience, out of habit, laughs anyway. From here the mall opens three ways and closes none of them.",
    enc_forgotten_yesterdays_vhs_ghosts: "Commercials play in midair. Laugh tracks echo without punchlines. A figure in a letterman jacket sells you a car that was recalled two centuries ago, sincerely. Then one of them turns, locks eyes with you — and rewinds. Not the tape. Itself. Its mouth closes around a sentence it already said, and it is looking at you while it does it, waiting to see what you remember.",
    enc_forgotten_yesterdays_vhs_lean_in: "You let the memory hit. It is somebody else's summer, somebody else's porch, a phone call that did not go well, and for a second it is yours in every detail that matters. It hurts. It also teaches: this is what the mall is made of, and why nobody here can quite leave.",
    enc_forgotten_yesterdays_vhs_fail: "You take it on the chin and keep walking, and the ghost lets you, and somewhere between the fountain and the escalator you realize you have been crying for a while. No physical damage. Just the emotional equivalent of having the wind knocked out of your soul, in a food court, in front of teenagers.",
    enc_forgotten_yesterdays_vhs_mock: "You make a joke. The ghost takes offense, which should not be possible, and yet here you are, being glared at by a man made of static and regret while a jingle for a discontinued cereal loops behind him like a threat. Every tape in the building has just been told your name.",
    enc_forgotten_yesterdays_escalator: "The escalator moves against you. Faster than walking. Slower than running. Forever. It is the only thing in the mall that still runs at full power, and it spends that power on spite. Mall music plays — the kind with a saxophone in it. People have grown old on this escalator. There is a chair halfway up, bolted to the step, with a cushion.",
    enc_forgotten_yesterdays_escalator_success: "Against all apparent logic, the escalator decides you have a destination worth respecting. It slows. It stops. It reverses, with a shudder like an apology, and carries you up to a floor that was not there when you started. The saxophone resolves.",
    enc_forgotten_yesterdays_escalator_mixed: "You reach the top eventually. Nobody can explain what is different — the light, maybe, or the order you are standing in, or which of you remembers getting on. Everyone agrees something is. The chair halfway up is empty now. It was not empty before.",
    enc_forgotten_yesterdays_escalator_fail: "The mall makes a point. You fight the stairs and the stairs are patient, and after a while the fighting is the whole day, and after that you understand you were not ready for what stairs used to mean. You end up where you started, older, with the saxophone in your head for good.",
    enc_forgotten_yesterdays_elefem: "A weaponized burst of color, joy, and extremely aggressive whimsy comes down the concourse like weather. It sparkles. It screams. It wants attention the way a fire wants oxygen, and every kiosk it passes starts playing its own jingle at once. The Tanneritos have a name for it. The name is a sigh.",
    enc_forgotten_yesterdays_elefem_success: "You avoid feeding the thing. You do not look at it, or you tell it, with total sincerity, that its sparkle is doing something brave with the light, and either way it passes you like a storm that found somebody more interesting. This is the closest anyone comes to victory here.",
    enc_forgotten_yesterdays_elefem_mixed: "You hold up something new — a colour it hasn't seen, a word it hasn't heard — and it chases the fresher emotional palette down the concourse and out of your afternoon. It leaves you only mildly cursed. Things in your pockets are, briefly, glitter.",
    enc_forgotten_yesterdays_elefem_fail: "Violence feeds it. Naturally. Every swing is applause and every hit is a costume change, and when it finally gets bored of you it leaves the way a party leaves. You now have glitter in places memory should not be able to access. It will still be there in Act 6.",
    enc_forgotten_yesterdays_resolution: "Sooner or later somebody asks what you want from the place, and the question lands on the food court like a dropped tray. Meaning persists here without purpose. That is either a warning or a business model, and the Tanneritos, who live in the gap between the two, would like to know which one you are.",
    enc_forgotten_yesterdays_resolution_good: "The Tanneritos open rare inventory, share rumors, and let the coalition become part of the mall's living economy without killing its spirit. Your names go up on the marquee, spelled almost right. Miss June files a tape about you under KEEPERS. Donny, on the wall, does not look up, but the smoke rings get rounder.",
    enc_forgotten_yesterdays_resolution_neutral: "Nothing breaks. Nothing deepens. The mall continues being itself at you, the way a cat continues being itself at a guest. You can trade here. You cannot be from here. Miss June keeps a tape about you, unlabeled, which is not the same as unwatched.",
    enc_forgotten_yesterdays_resolution_bad: "You got what looked like control and lost everything that made the place valuable. The halfpipe goes quiet. The ghosts stop rewinding for you. The Tanneritos do not leave; they simply stop being where you are, and the food court becomes a food court, and that is the worst thing that has happened to it since 2077."
  };
  for (const [id, to] of Object.entries(M)) setDesc(id, null, to);

  // ── Row 8: who musters ──
  setChoice("finale_count_the_coalition", "Lady Maccio's four hundred souls.", { requires: { anyOf: [{ beatMark: "bandit_summit_absorption" }, { beatMark: "bandit_summit_accord" }] } });
  setChoice("finale_count_the_coalition", "The Cadence owes you a raid.", { requires: [{ beatMark: "cadence_win_style" }, { flag: "cadenceRespect", eq: 1 }] });
  setChoice("finale_count_the_coalition", "The Cadence owes you a raid — the Maestra's terms.", { requires: [{ beatMark: "cadence_parade" }, { flag: "cadenceRespect", eq: 1 }] });

  // ── Row 9: Oannes, at half the length ──
  setDesc("gloomgill_intro", null,
    "Before cities thought they were clever, something came out of the sea and taught. Writing. Counting. How not to starve in predictable ways. How to argue without immediately killing one another. How to remember yesterday long enough to improve tomorrow. Every sunset it went back in. No temples. No sacrifices. Pay attention, that was the whole price. People paid it for a while.\n\nThey wrote some of it down. They kept the convenient parts, weaponized the rest, built cities, and decided they were done learning. Oannes waited. Empires rose, fell, and rebranded. The oceans ate the coastlines. The lessons became myths, then metaphors, then trivia.\n\nEventually he came back up, checked the math, and understood, with a quiet, ancient horror, that almost nobody had learned the important parts.\n\nSo he stopped teaching. Now he is Gloomgill, because if you are going to spend eternity checking the homework of history you might as well pick a name that sounds like a problem. He does not lecture. He quizzes. He turns up where people are confident and wrong and asks questions that should have answers: balance, consequence, cooperation, restraint. Right answers earn grudging approval. Wrong ones earn follow-up questions. Repeated failure earns attention.\n\nHe has tried destroying civilizations. It doesn't stick. So he harasses them instead, patiently, with the exhaustion of a being who once believed education was enough. He is not here to be worshipped. He is here to find out whether anyone, anywhere, finally understood the lesson.\n\nAnd if not — well. He has all the time in the world to ask again.");

  // ── Row 10: each option rolls what it says; the Vault's DCs come down to earth ──
  setChoiceAt("maneuver_vault_echo_archive", 0, { checkStat: "arc", checkDC: 16 });
  setChoiceAt("maneuver_vault_echo_archive", 1, { checkStat: "his", checkDC: 16 });
  setChoiceAt("maneuver_vault_echo_archive", 2, { checkStat: "ins", checkDC: 16 });
  setChoiceAt("maneuver_vault_slippage_chamber", 0, { checkStat: "ath", checkDC: 16 });
  setChoiceAt("maneuver_vault_slippage_chamber", 1, { checkStat: "sur", checkDC: 16 });
  setChoiceAt("maneuver_vault_slippage_chamber", 2, { checkStat: "arc", checkDC: 16 });
  setChoiceAt("maneuver_vault_slippage_chamber", 3, { checkStat: "prf", checkDC: 16 });
  setChoice("maneuver_vault_foyer_of_procedure", "Be sneaky!", { checkDC: 16 });
  setChoice("maneuver_vault_foyer_of_procedure", "Be friendly", { checkDC: 16 });
  setChoice("maneuver_vault_foyer_of_procedure", "Punch the Vault in the sensors", { checkDC: 18 });

  // ── Row 11: merge and fix ──
  rep("maneuver_vault_echo_archive", "Half the archive whispers nonsense.\n\nThe other half whispers directly to you. Half the archive whispers nonsense; one clip doesn't: a safety briefing filmed in a plaza ringed by statues that appear in no surviving city's records. That clip whispers coordinates.",
    "Half the archive whispers nonsense. The other half whispers directly to you, and one clip doesn't whisper at all: a safety briefing filmed in a plaza ringed by statues that appear in no surviving city's records. That clip speaks coordinates.");
  { const b = B("maneuver_vault_echo_archive"); const c = b && b.choices[1]; if (c && String(c.description).includes("recieved")) { c.description = c.description.replace("recieved", "received"); add("echo_archive › #1: recieved → received"); } else ok("echo_archive: received"); }
  rep("maneuver_vault_infiltration", "shouild you fail", "should you fail");
  rep("maneuver_vault_slippage_chamber", "like time, and dragona, time dragons of course", "like time, and dragons, time dragons of course");
  for (const id of ["maneuver_vault_echo_archive", "maneuver_vault_infiltration", "maneuver_vault_slippage_chamber"]) { const b = B(id); if (b && String(b.description).includes("band new")) { b.description = b.description.replace("band new", "brand new"); add(`${id}: band new → brand new`); } }

  // ── Row 12: the find-and-replace scar ──
  for (const [id, from, to] of [["raid_thatwards_infiltration_success", "uncovers partial the paymaster records", "uncovers partial paymaster records"], ["raid_thatwards_courtly_playful", "receives strong the paymaster intel", "receives strong paymaster intel"], ["raid_thatwards_outcome_neutral_spark", "and partial the paymaster intel", "and partial paymaster intel"]]) {
    const b = B(id); if (!b) continue; const w = b.worldEffects?.warLog;
    if (typeof w === "string" && w.includes(from)) { b.worldEffects.warLog = w.replace(from, to); add(`${id}: war log`); } else ok(`${id}: war log fine`);
  }

  // ── Row 13: the template with the blanks ──
  setDesc("acid_bog_intrigue_success", "What an AMAZING idea you had! I really like the part where <...>! And then when <...> TOTALLY <...>\n\nClassic <...>\n\nOnwards and upwards!",
    "What an AMAZING idea. I liked the part with the tarp. And then the bit with the bellows. And the marmalade. CLASSIC.\n\nOnwards and upwards!");
  rep("acid_bog_run_through_fail", "calluses on the parts that are repeatedly hack off or melted", "calluses on the parts that get repeatedly hacked off or melted");

  // ── Row 14: the outcome shells say something while the GM picks ──
  const SHELL = {
    apex_predator_outcome: "Well. THAT was the top of the food chain, and for a minute you were on the menu. The dust settles. Count heads, then let's get the record straight:",
    enc_geometry_serpent_outcomes: "The angles stop moving. Whatever you just fought was mostly mathematics with an appetite. Check that everyone still has the usual number of sides, and call it:",
    enc_mutant_wildlife_t2_outcomes: "That was wildlife the way a bus crash is traffic. Breathe. Count limbs — yours AND the crew's — and let's get the official record straight:",
    hexknight_outcome: "The Hexknight lowers whatever that was. It is not over for him. It may be over for you. Call it while your hands still work:",
    bandit_ambush_outcome_results: "The road goes quiet in the particular way roads do after bandits. Somebody is bleeding and somebody is counting. Which way did it go?",
    first_road_ambush_results: "Your first fight on the road, and the road noticed. Before anyone says anything clever, call it:"
  };
  for (const [id, to] of Object.entries(SHELL)) setDesc(id, "", to);

  // ── Row 15: the walk-in exteriors ──
  const EXT = {
    chuckle_diner_exterior: "The diner's neon says EAT in a font that has never once been worried. Through the window, a fourth plate is already set.",
    chuckle_grange_exterior: "The grange hall keeps its doors open and its projector warm. Somebody is laughing inside, on cue.",
    chuckle_booth_exterior: "A door marked PROJECTION, with real shadows under it. The only door in town the cartoon never redrew.",
    soft_landing_gate_exterior: "A checkpoint made of pool noodles, staffed in triplicate. The stamp goes boing.",
    soft_landing_hall_exterior: "The town hall is a moon-bounce with a flagpole. Session is in progress. Item one is cake.",
    soft_landing_castle_exterior: "The castle is still up. The blower has not stopped since the party. NO SHOES, says a sign in a child's hand.",
    stillwater_bandstand_exterior: "The band is mid-bar and the conductor's arm is up. It has been up since 2077.",
    stillwater_sentinel_exterior: "The Sentinel office, ink to the windows. One edition, still wet, in the rack outside.",
    stillwater_station_exterior: "One bench, one clock at 4:08, one woman with her hands in her lap. The 4:10 is always almost here.",
    crown_mall_frontage_exterior: "Dead neon, live commerce, and a silver dragon across the broken frontage having a good afternoon.",
    crown_mall_june_exterior: "The VHS Exchange, fluorescent and immaculate. A sign in the window: PLEASE REWIND YOUR FEELINGS.",
    crown_mall_bev_exterior: "A sunglasses kiosk with a legal pad on the counter. The glitter pen means business.",
    crown_mall_foodcourt_exterior: "The food court, still happening. Sugar, ozone, and a fountain that runs on principle.",
    crown_mall_halfpipe_exterior: "The halfpipe where the pretzel stand used to be. The rail shines. The napkin is the treaty.",
    maneuver_vault_foyer_exterior: "The entry hall smells like dust and old confidence. A speaker would like you to state your business.",
    maneuver_vault_archive_exterior: "Hex-screens drift behind the door like jellyfish made of light. One of them is whispering coordinates.",
    maneuver_vault_slippage_exterior: "The floor beyond the threshold is hexes, and the hexes are not interlocking. Mind the gap. The gap minds back.",
    port_kudzu_saloon_exterior: "The saloon leans on the harbour and the harbour leans back. Captain Blask keeps paper at the corner table.",
    port_kudzu_harbour_exterior: "The harbour where the water went sideways on a schedule. The tide still comes in apologetic."
  };
  for (const [id, to] of Object.entries(EXT)) setDesc(id, "", to);

  // ── Row 16: the ten tag scaffolds retire ──
  for (const b of [...camp.beats]) if (/^tags_/.test(String(b.id))) { camp.beats.splice(camp.beats.indexOf(b), 1); byId.delete(b.id); add(`${b.id}: retired (director scaffold, never written)`); }

  // ── Row 17: a sentence more of weather; the convoy sells paper too ──
  setDesc("enc_weather_front", "Storm's a comin'", "Storm's a comin'.\n\nThe sky Thatwards goes the colour of a bruise that hasn't decided where to be yet, and the wind starts asking personal questions.");
  rep("enc_trade_convoy", "If years still existed.", "If years still existed.\n\nThey sell parts and preserves and, if you ask the right nomad the right way, paper: who passed this way, what they were carrying, and which road they were afraid of. Nomads don't keep secrets. They keep prices.");

  // ── Row 18: Stillwater keeps its line ──
  setChoice("gloomgill_applause", "Bow once more.", { description: "Back to speed. Whatever it was, it's gone." });

  console.log(`[patch-story-review-acts46] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Acts 4–6 DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Acts 4–6: nothing to do.");
  try {
    (foundry.utils.saveDataToFile ?? saveDataToFile)(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-story-review-acts46-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Acts 4–6 APPLIED: ${changes} change(s). The mall keeps happening.`);
})();

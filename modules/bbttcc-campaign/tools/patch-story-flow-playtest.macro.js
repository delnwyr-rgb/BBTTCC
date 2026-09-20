/**
 * patch-story-flow-playtest.macro.js — GM macro/console. DRY_RUN default true.
 *
 * STORY FLOW · PLAYTEST FIXES (2026-09-18, live-caught by the owner in Act 1). Accumulates the content-side fixes from the
 * tire-kick; every section is idempotent, so re-running after a new section is added applies only the new one.
 *
 *  P1. The Crossroads and Day's End are placeless. Day one's hub sits "at the edge of your holdings" and the ledger closes
 *      wherever the party stands — but both beats inherited Allesh-Gilliam as their place from the quest, so "Call it a day"
 *      from Khezek-Tor's cookline routed into a beat the location guard refused as "at Allesh-Gilliam". `where: "anywhere"`.
 *
 *  P2. The Tree's Session is a ROAD encounter. The Forest of Early Tifaret fires on the first ride to Furrier's Fixit-Farm
 *      (pinned leg), and every beat of the session — approach, merge, the three questions, the Obstructor, the tally, the
 *      endings — plays right there on the road. All nineteen inherited PolygonForest.d from the quest, so NOW would have sent
 *      the Travel Console to the forest hex and the guard would have refused any beat fired by hand. `where: "anywhere"`.
 *
 *  P3. DAY'S END IS THE MASTER TERMINAL (owner ruling 2026-09-18: "derive certitude, no guessing"). Every town walk's
 *      "Call it a day" routes to `ag_days_end`, and the terminal reads the story store to know what the evening is:
 *        · First Night not yet played → "First, the night" (the day-one rail: Soma break → the Tent → the Crossroads)
 *        · First Night played → "Back to the crossroads — daylight left"
 *        · a ride behind you → "The turn is locked. Run it." (the three ledger items live in that choice)
 *      "Back to town" at the Crossroads is a real ride (`ag_ride_home`, openTravel Allesh-Gilliam); Allesh-Gilliam's
 *      arrival list gains the town walk behind the Act 2 HQ intro, so riding home in Act 1 reopens the walk (the walk
 *      is a hub: oncePerHex false). The Crossroads text goes GENERIC (no "morning of the second day", no "two of them
 *      haven't met you yet") — a repeatable beat's vocabulary must survive its second play.
 *
 *  P4. PIKE SENDS FOR YOU (2026-09-18, live-caught on the first Act 2 morning). The HQ door on the town map runs the HQ
 *      cinematic, whose only choice was "Find the Marshal" → the day-one welcome ("Pike Doesn't Get Up") → the Act 1 walk;
 *      in Act 2 that replaced the players' view of the real HQ beat and looped them. The cinematic is now an Act 2 door
 *      too: "Find the Marshal" shows in Act 1 only, "Pike sent for you" shows from Act 2 and opens the HQ beat. The HQ
 *      beat is renamed "Pike Sends for You" and its opening reads as a summons after That One Night (the wall, the gate);
 *      Pike's errand lines are unchanged.
 *
 *  P5. FIXIT, after the first full pass (2026-09-18). The Weeping Prisoner plays in the Arc Bay's BACK ROOM (scene
 *      `arc_bay_back_room_pov`) — its five beats pointed at the bay floor. The Arc Bay's "crying Fey" question and the
 *      "get Mara" offer hide once the chapter has an ending (the model now also seals an ended chapter's start/endings).
 *      Mara's negotiation: "Trade" and "Shared Oversight" hold a TURN after they are pitched (choice.cooldownTurns 1) — a
 *      failed pitch is not re-rolled by walking back in; the Hard Ask and Delay stay on the table.
 *
 *  P6. The Gentle Pest's "Teach a Local" ENDING carried a second Persuasion check on its "Leave" (fail → "The Lesson Doesn't
 *      Land") plus a stray "Not today — wave and move on" — leftovers from when the lesson was rolled on the ending itself.
 *      The teach roll happens on the parent's choice; the ending just exits: "Leave" → the quest scene, no check.
 *
 *  P7. The Water Choir's three "Inspect the set up" choices are named by what they use — Perception / Insight / Arcana
 *      (the GM's buttons now also carry the check, engine-side).
 *
 *  P8. THE GROVE LANDS (2026-09-18, live-caught after the Tree's Session: PolygonForest.d carried no "Harmonized Grove").
 *      The Harmonized ending only had an editor World Modifier row (display), never the hexModifiers primitive the readers
 *      key on (travel +2, Influence +1, Out-Danced lift). The ending now adds "Harmonized Grove" to PolygonForest.d; and if
 *      this world already closed Tifaret harmoniously without it, the macro applies the modifier once, live (GM only).
 *
 *  P9. THE CULT, IN ORDER (2026-09-19, owner at Khezek-Tor: no entrance to the Seal; the Galleries assumed the players
 *      already knew). The ladder is now: the Seal (Sable Nine takes you down from the Lift Hall) → Etta at the Long Market
 *      (the sigil, the bunker) → THE REALIZATION (`vs_bridge_seal`, "The Seal Was a Signature": the threads tie, a cult is
 *      named) → the Upper Galleries (hard-gated on the realization) → the Third Candle. Texts are drafts for the owner.
 *
 *  P10. PILGRIM WICK ENTERS (2026-09-19). The cult's courier existed only as a talk persona. Two meetings: Act 1, the
 *      Vacancy on the Welcome Round — a polite pilgrim keeping vigil in a bed he never sleeps in (foreshadowing); Act 2,
 *      coming down from the Upper Galleries — the courier at the toll post has a face, recognized if the party met him
 *      (choice gates), and the party earns the Receipt "The Courier's Route". Texts are drafts for the owner.
 *
 *  P11. ACT 3 WAITS FOR ACT 2 (owner ruling 2026-09-19). The three Seal endings no longer advance the act. A new Act 3
 *      title card (`a3_title_card`, the spine's) carries the advance and waits on Act 2's critical marks: Pike updates the
 *      map (AG closed), Lyrenn settles, Khezek-Tor settles, the realization played. The calendar (turn 6) stays the safety
 *      valve. Repair: a world sitting in Act 3 with no Act-3 beat played is set back to Act 2 (live, apply mode only).
 *
 *  P12. DAY'S END FOR ACT 2 ONWARD (owner ruling 2026-09-19: "we're not advancing turns often enough"). Act 1 had a terminal
 *      and locked a turn per day; Act 2 had none and three towns went by on one turn. `days_end_thatwards` is a placeless,
 *      evergreen terminal with generic text, reached from every Act 2+ town hub's "Call it a day"; "Run it" is always there.
 *
 * Backup download before write; GM only.
 */
(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = []; let changes = 0; const say = (s) => report.push(s);
  const setField = (id, k, v) => { const b = byId.get(id); if (!b) return say(`✗ MISSING beat ${id}`); if (JSON.stringify(b[k]) === JSON.stringify(v)) return say(`· ok ${id} ${k}`); b[k] = v; changes++; say(`⚙ ${id}: ${k} = ${JSON.stringify(v)}`); };

  // P1
  setField("ag_crossroads_first_rides", "where", "anywhere");
  setField("ag_days_end", "where", "anywhere");
  setField("ag_ride_khezek_tor", "where", "anywhere");
  setField("ag_ride_lyrenn", "where", "anywhere");

  // P2
  for (const b of camp.beats || []) if (b?.story?.quest === "tifaret" || /^forest_of_tifaret_/.test(String(b?.id || ""))) setField(b.id, "where", "anywhere");

  // P3 ── the terminal
  const ch = (label, next, extra = {}) => Object.assign({ label, next: next || "", description: "", checkStat: "", checkDC: 0, failNext: "" }, extra);
  const setChoices = (id, rows) => { const b = byId.get(id); if (!b) return say(`✗ MISSING beat ${id}`); if (JSON.stringify(b.choices) === JSON.stringify(rows)) return say(`· ok ${id} choices`); b.choices = rows; changes++; say(`▸ ${id}: ${rows.length} choice(s) — ${rows.map(r => r.label).join(" · ")}`); };
  const retargetChoice = (id, labelRe, next) => { const b = byId.get(id); if (!b) return say(`✗ MISSING beat ${id}`); const c = (b.choices || []).find(c => c && labelRe.test(String(c.label || ""))); if (!c) return say(`✗ ${id}: no choice ${labelRe}`); if (c.next === next) return say(`· ok ${id} "${c.label}" → ${next}`); c.next = next; changes++; say(`▸ ${id}: "${c.label}" → ${next}`); };
  setField("ag_days_end", "description", "The sun goes down wrong-colored and gorgeous, and the day Thatwards is spent. What the evening is depends on what the day was — the ledger knows, and so does the town.\n\nAnd then — well. Then we find out what was waiting for the ink to dry.");
  setChoices("ag_days_end", [
    ch("First, the night — the town lets go of you", "ag_first_night_soma_break", { description: "Day one's evening: the Soma break, the tent at the edge of town, and the fork in the road come morning.", requires: [{ beatMark: "ag_first_night_soma_break", not: true }] }),
    ch("Back to the crossroads — daylight left", "ag_crossroads_first_rides", { requires: [{ beatMark: "ag_first_night_soma_break" }] }),
    ch("The turn is locked. Run it.", "", { description: "Before the world moves, the ledger wants three things. 1. Divvy the holdings — say it out loud and write it down, which hexes belong to which faction (hex sheets: claim them now). 2. Plan your Strategic Activities — each faction sets its work for the turn; the Plan console is open. 3. Lock it in — when every faction's plans are set, your GM runs the Turn Driver and the world takes its turn.", requires: [{ anyOf: [{ beatMark: "ag_ride_khezek_tor" }, { beatMark: "ag_ride_lyrenn" }] }] })
  ]);
  for (const id of ["allesh_gilliam_town_walk", "lyrenn_town_walk", "khezek_tor_town_walk"]) retargetChoice(id, /^call it a day$/i, "ag_days_end");   // the ACT 1 walks only — Day's End is Act 1's terminal; Act 2 towns keep their own evening
  // P3 ── the ride home + a generic Crossroads
  if (!byId.get("ag_ride_home")) {
    const tmpl = byId.get("ag_ride_lyrenn"); const at = (camp.beats || []).findIndex(b => b?.id === "ag_ride_lyrenn");
    const nb = Object.assign(foundry.utils.deepClone(tmpl || {}), { id: "ag_ride_home", label: "The Road Home", questStep: 452, where: "anywhere",
      description: "Allesh-Gilliam is behind you the way home always is — closer than it looked on the way out, and lit. Somebody will have kept something warm.\n\n⚙ Plot the ride on the Travel Console — the road decides what you meet.",
      choices: [ch("🐎 Saddle up — ride home", "", { description: "Run the planned route on the Travel Console." }), ch("Actually — back to the Crossroads", "ag_crossroads_first_rides")],
      inject: { repeatable: true, requires: [{ flag: "storyPhase", gte: 1 }, { flag: "storyPhase", lte: 1 }] },
      worldEffects: Object.assign(foundry.utils.deepClone(tmpl?.worldEffects || {}), { openTravel: { hexName: "Allesh-Gilliam" } }) });
    if (at >= 0) camp.beats.splice(at + 1, 0, nb); else camp.beats.push(nb); byId.set(nb.id, nb); changes++; say("＋ ag_ride_home (The Road Home — openTravel Allesh-Gilliam)");
  } else say("· ok ag_ride_home exists");
  retargetChoice("ag_crossroads_first_rides", /^back to town$/i, "ag_ride_home");
  setField("ag_crossroads_first_rides", "description", "<!-- [SOMA-BREAK-2026-08-30] -->The coalition rides out to learn what it now owns. Surveying is its own kind of introduction: pacing the hexes, reading the fences, finding out which handshakes came with land attached.\n\nThe road forks at the edge of your holdings, and both signs are hand-painted. THATWARDS-BY-NORTH: <b>Khezek-Tor</b>, where the mine answered back and the smelters never sleep. THATWARDS-BY-GREEN: <b>Lyrenn</b>, where the fields remember you before you've been introduced.\n\nThree towns hold this stretch of Thatwards together. The order is yours, and so is the road home. The roads are not entirely yours — ride ready.");
  // P3 ── riding home in Act 1 reopens the walk
  { const walk = byId.get("allesh_gilliam_town_walk"); if (walk) { walk.inject = walk.inject || {}; if (walk.inject.oncePerHex !== false) { walk.inject.oncePerHex = false; changes++; say("⚙ allesh_gilliam_town_walk: inject.oncePerHex = false (hub)"); } else say("· ok walk oncePerHex"); } else say("✗ MISSING allesh_gilliam_town_walk"); }
  // P4 ── the HQ door knows the act
  setField("allesh_gilliam_hq_cinematics", "inject", Object.assign({}, byId.get("allesh_gilliam_hq_cinematics")?.inject || {}, { requires: [{ flag: "storyPhase", gte: 1 }] }));
  setChoices("allesh_gilliam_hq_cinematics", [
    ch("Find the Marshal", "allesh_gilliam_yarrow_welcome", { requires: [{ flag: "storyPhase", lte: 1 }] }),
    ch("Pike sent for you", "allesh_gilliam_introduction_to_hq", { description: "The runner said: bring whoever reads maps.", requires: [{ flag: "storyPhase", gte: 2 }] })
  ]);
  setField("allesh_gilliam_introduction_to_hq", "label", "Allesh-Gilliam — Pike Sends for You");
  setField("allesh_gilliam_introduction_to_hq", "description", "Pike sent a runner before the coffee was hot: come to the HQ, bring whoever reads maps. He doesn’t stand when you enter — you’ve seen that trick — but the boards behind him are lit the wrong colors this morning, and he’s looking at them, not you.\n\n“Night like that, and the town’s still standing. So. You’re the new variable.”\n\nHe gestures at the glowing menu boards.\n\n“That wall holds if people believe it will. That land feeds us if we don’t lie to it. And that gate?”\n\nHe taps a flickering leyline readout.\n\n“That thing is remembering wrong. Since last night, worse.”\n\nHe finally looks directly at you.\n\n“Fix one promise first. Then we’ll see how long you last. Fix two, well, maybe people might follow instead of holding their breath. Or measuring you for a box.\n\nWe need a replacement Leygate Stabilizer, and the only place I know that has one is Furrier's Fixit. Probably good you know them.\n\nAlso,\" he gestures at the maps again, and one section of city wall that stands out as … wrong.\n\nSee if you can tell us what we're doing wrong.\"");
  // P5 ── Fixit
  { const back = (game.scenes?.find?.(sc => sc.name === "arc_bay_back_room_pov") || null)?.id || "PrbMpTQEIrkedGHa";
    for (const id of ["fixit_weeping_prisoner", "fixit_weeping_prisoner_justice", "fixit_weeping_prisoner_punishment", "fixit_weeping_prisoner_mercy", "fixit_weeping_prisoner_not_our_problem"]) setField(id, "sceneId", back); }
  { const ended = ["fixit_weeping_prisoner_justice", "fixit_weeping_prisoner_punishment", "fixit_weeping_prisoner_mercy", "fixit_weeping_prisoner_not_our_problem"].map(id => ({ beatMark: id, not: true }));
    const setReq = (id, labelRe, req) => { const b = byId.get(id); if (!b) return say(`✗ MISSING beat ${id}`); const c = (b.choices || []).find(c => c && labelRe.test(String(c.label || ""))); if (!c) return say(`✗ ${id}: no choice ${labelRe}`); if (JSON.stringify(c.requires) === JSON.stringify(req)) return say(`· ok ${id} "${c.label}" requires`); c.requires = req; changes++; say(`▸ ${id}: "${c.label}" requires ${JSON.stringify(req)}`); };
    setReq("fixit_arc_bay_conversation", /crying fey/i, ended);
    setReq("fixit_arc_bay_conversation_3", /get mara/i, ended);
    const setCd = (id, labelRe, cd) => { const b = byId.get(id); if (!b) return say(`✗ MISSING beat ${id}`); const c = (b.choices || []).find(c => c && labelRe.test(String(c.label || ""))); if (!c) return say(`✗ ${id}: no choice ${labelRe}`); if (c.cooldownTurns === cd) return say(`· ok ${id} "${c.label}" cooldown`); c.cooldownTurns = cd; changes++; say(`▸ ${id}: "${c.label}" cooldownTurns = ${cd}`); };
    setCd("fixit_leyline_stabilizer_negotiation", /^trade$/i, 1);
    setCd("fixit_leyline_stabilizer_negotiation", /^shared oversight$/i, 1); }
  // P6 ── the Gentle Pest ending exits
  setChoices("lyrenn_the_gentle_pest_teach", [ch("Leave", "lyrenn_quest_scene")]);
  // P7 ── the Water Choir's inspects say what they use
  { const b = byId.get("lyrenn_water_choir"); if (!b) say("✗ MISSING lyrenn_water_choir"); else for (const c of (b.choices || [])) { const want = c.next === "lyrenn_water_choir_inspect_perception" ? "Inspect the set up — watch it (Perception)" : c.next === "lyrenn_water_choir_inspect_insight" ? "Inspect the set up — feel it out (Insight)" : c.next === "lyrenn_water_choir_inspect_arcana" ? "Inspect the set up — read the tuning (Arcana)" : null; if (want && c.label !== want) { say(`▸ lyrenn_water_choir: "${c.label}" → "${want}"`); c.label = want; changes++; } else if (want) say(`· ok lyrenn_water_choir "${want}"`); } }
  // P8 ── the Grove lands
  { const b = byId.get("forest_of_tifaret_harmonious_ending"); if (!b) say("✗ MISSING forest_of_tifaret_harmonious_ending"); else {
      b.worldEffects = (b.worldEffects && typeof b.worldEffects === "object") ? b.worldEffects : {};
      const want = [{ add: ["Harmonized Grove"], hexName: "PolygonForest.d" }];
      if (JSON.stringify(b.worldEffects.hexModifiers) !== JSON.stringify(want)) { b.worldEffects.hexModifiers = want; changes++; say("⚙ forest_of_tifaret_harmonious_ending: hexModifiers +Harmonized Grove @ PolygonForest.d"); } else say("· ok harmonious ending hexModifiers"); } }
  // P8 ── retro-repair for a world that already closed Tifaret harmoniously (touches the hex flag, live only)
  try {
    const st = game.settings.get(NS, "storyState"); const store = st?.played ? st : (st && typeof st === "object" ? Object.values(st).find(x => x && x.played) : null);
    const closedH = store?.closed?.tifaret?.name === "harmonious_ending";
    let hex = null; for (const sc of (game.scenes || [])) for (const d of (sc.drawings || [])) { const tf = d.flags?.["bbttcc-territory"]; if (tf && (tf.isHex === true || tf.kind === "territory-hex") && String(tf.name || "").replace(/[\s\u00a0]+/g, " ").trim() === "PolygonForest.d") hex = d; }
    const has = !!hex && (Array.isArray(hex.flags["bbttcc-territory"].modifiers) ? hex.flags["bbttcc-territory"].modifiers : []).includes("Harmonized Grove");
    if (closedH && hex && !has) { say("🌳 PolygonForest.d lacks Harmonized Grove though Tifaret closed harmoniously — will apply live"); if (!DRY_RUN) { const wm = game.bbttcc?.api?.worldMutation; if (wm?.applyWorldEffects) await wm.applyWorldEffects({ id: "repair_grove", label: "The Grove lands (repair)", worldEffects: { hexModifiers: [{ add: ["Harmonized Grove"], hexName: "PolygonForest.d" }] } }, { source: "bbttcc-campaign", beatId: "repair_grove" }); } }
    else say(closedH ? (hex ? "· ok PolygonForest.d carries the Grove" : "· PolygonForest.d hex not found on the map (offline?)") : "· Tifaret not closed harmoniously here — no repair");
  } catch (eG) { say("✗ grove repair check failed: " + (eG?.message || eG)); }
  // P9 ── the Seal's entrance: Sable Nine, from the Lift Hall
  { const b = byId.get("khezek_tor_the_lift_hall"); if (!b) say("✗ MISSING khezek_tor_the_lift_hall"); else {
      const want = [ch("Ask Sable Nine to take you down to the sealed gallery", "khezek_tor_valhaulan_seal_quest_acceptance", { description: "The gallery Calder's crews won't work. Sable knows the way and the etiquette.", requires: [{ flag: "storyPhase", gte: 2 }, { beatMark: "khezek_tor_valhaulan_seal_quest_acceptance", not: true }] }), ch("Leave", "khezek_tor_quest_scene")];
      if (JSON.stringify(b.choices) !== JSON.stringify(want)) { b.choices = want; changes++; say("▸ khezek_tor_the_lift_hall: + Sable takes you down (→ the Seal) · Leave"); } else say("· ok lift hall choices"); } }
  setField("khezek_tor_valhaulan_seal_quest_acceptance", "description", "Sable Nine meets you at the Lift Hall with the map that won't hold still, folded to one corner. \"The gallery Calder's crews won't work. I'll take you. Don't touch anything that looks recently loved.\" The cage drops past the numbered levels, past the second scratch on Four, and stops where the air changes.\n\nCalder's crews won't work the gallery by the old seal, and Calder doesn't spook. The markings are fresh, precise, and pointed — somebody has been maintaining this thing, recently, and nobody at Khezek Tor is on that shift roster. The coalition is now formally curious.");
  // P9 ── the realization: The Seal Was a Signature
  { const b = byId.get("vs_bridge_seal"); if (!b) say("✗ MISSING vs_bridge_seal"); else {
      setField("vs_bridge_seal", "where", "anywhere");
      setField("vs_bridge_seal", "inject", Object.assign({}, b.inject || {}, { repeatable: false, requires: [{ flag: "storyPhase", gte: 2 }, { anyOf: [{ beatMark: "khezek_tor_the_vaulhaulan_seal_restore" }, { beatMark: "khezek_tor_the_vaulhaulan_seal_redirect" }, { beatMark: "khezek_tor_the_vaulhaulan_seal_break" }] }, { beatMark: "allesh_gilliam_etta_bloom_convo_exit" }] }));
      for (const k of ["playerFacing", "playerFacingDialog", "dialogPlayerFacing", "playerFacingContent", "showToPlayers"]) if (b[k] !== true) { b[k] = true; changes++; say(`⚙ vs_bridge_seal: ${k} = true`); }
      setField("vs_bridge_seal", "description", "However you left the shaft, one fact came out with you: the seal never bound inward. It pointed OUT — a pipe, a siphon, a decision about where somebody else's debt should land. And whoever carved it signed their work the way you sign something you're proud of.\n\nPut it next to what Etta pressed into your hand at the Long Market — the same knotwork, the same directional glow — and next to what she said about the bunker: not treasure. Rebinding. Add the courier at the toll post who pays exact and doesn't stay, and the packs that go up the mountain full.\n\nIt stops being a rumor with a name attached. It becomes a thing with a shift roster.\n\nThere is a cult on this mountain. It is not hiding. It is working. And the work points coastward — toward a chapel travelers say turns to face things nobody else can see.");
      setChoices("vs_bridge_seal", [ch("Follow the courier's route up — the Upper Galleries", "khezek_upper_galleries", { description: "See the work for yourselves, from a respectful distance." }), ch("Noted. Keep it quiet for now.", "")]); } }
  // P9 ── the Galleries wait for the realization, on EVERY path (hub doors included)
  { const b = byId.get("khezek_upper_galleries"); if (!b) say("✗ MISSING khezek_upper_galleries"); else setField("khezek_upper_galleries", "inject", Object.assign({}, b.inject || {}, { hardGate: true, requires: [{ flag: "storyPhase", gte: 2 }, { beatMark: "vs_bridge_seal" }] })); }
  // P10 ── Pilgrim Wick
  { const wick = (game.actors?.contents || []).find(a => a.name === "Pilgrim Wick")?.id || "Vv8mDrdsPJnCBLeA";
    const vacScene = (game.scenes?.find?.(sc => sc.name === "the_vacancy_interior") || null)?.id || "5hxWnWm1sawwC3Ch";
    const base = (over) => Object.assign({ type: "dialog", timeScale: "scene", tags: "allesh_gilliam", politicalTags: "", outcomes: { success: null, failure: null }, actors: [], encounter: { key: "", tier: null, actorName: "" },
      worldEffects: { territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [] },
      playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true, playerFacing: true, refs: {} }, over);
    const addAfter = (anchorId, nb) => { if (byId.get(nb.id)) return say(`· ok ${nb.id} exists`); const at = (camp.beats || []).findIndex(b => b?.id === anchorId); if (at >= 0) camp.beats.splice(at + 1, 0, nb); else camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`＋ ${nb.id} (${nb.label})`); };
    addAfter("allesh_gilliam_vacancy_intro", base({ id: "ag_vacancy_pilgrim_wick", label: "Allesh-Gilliam — The Guest Who Keeps Vigil", questId: byId.get("allesh_gilliam_vacancy_intro")?.questId || null, questStep: (Number(byId.get("allesh_gilliam_vacancy_intro")?.questStep) || 0) + 1,
      story: { quest: "allesh_gilliam" }, speakerActorId: wick, sceneId: vacScene, inject: { repeatable: true, requires: [{ flag: "storyPhase", gte: 1 }] },
      description: "Verna's ledger has one name in it she can't read and one guest she can't place. He's in the corner with his boots off and lined up square — a road-worn man in a walker's coat — and he stands when you come in the way people stand in church.\n\n\"Pilgrim Wick,\" he says. \"Of the old routes.\" He asks nothing about you. He tells you where he's been: St Gilliam's for the candles, the high shrines above Khezek Tor, and here, for the bed.\n\nHe pays exact, Verna says later. To the mark. And he has never once slept in it.",
      choices: [ch("Where do the old routes go?", "ag_vacancy_pilgrim_wick_routes"), ch("Leave him to his vigil", "allesh_gilliam_vacancy_intro")] }));
    addAfter("ag_vacancy_pilgrim_wick", base({ id: "ag_vacancy_pilgrim_wick_routes", label: "Allesh-Gilliam — The Old Routes", questId: byId.get("allesh_gilliam_vacancy_intro")?.questId || null, questStep: (Number(byId.get("allesh_gilliam_vacancy_intro")?.questStep) || 0) + 2,
      story: { quest: "allesh_gilliam" }, speakerActorId: wick, sceneId: vacScene, inject: { repeatable: true, requires: [{ flag: "storyPhase", gte: 1 }] },
      description: "He answers with an itinerary. St Gilliam's at dusk, when the candles are trimmed. The Khezek switchbacks by the second morning — \"the high shrines keep their own hours.\" Back here by the week's end, for a bed he'll keep vigil in instead.\n\nHe smiles like a man describing a garden. He smells, faintly, of candle wax.\n\nThis is a tallow town.",
      choices: [ch("Ask something else", "ag_vacancy_pilgrim_wick"), ch("Leave him to his vigil", "allesh_gilliam_vacancy_intro")] }));
    { const v = byId.get("allesh_gilliam_vacancy_intro"); if (v) { const want = [ch("The guest in the corner", "ag_vacancy_pilgrim_wick", { description: "A pilgrim, Verna says. Pays exact. Never sleeps." }), ch("Leave", "allesh_gilliam_town_walk")]; if (JSON.stringify(v.choices) !== JSON.stringify(want)) { v.choices = want; changes++; say("▸ allesh_gilliam_vacancy_intro: + The guest in the corner · Leave"); } else say("· ok vacancy intro choices"); } }
    addAfter("khezek_upper_galleries", base({ id: "kt_courier_has_a_face", label: "Khezek Tor — The Courier Has a Face", questId: byId.get("khezek_upper_galleries")?.questId || null, questStep: (Number(byId.get("khezek_upper_galleries")?.questStep) || 0) + 1, tags: "khezek_tor",
      story: { quest: "khezek_tor" }, where: "anywhere", inject: { repeatable: false, requires: [{ flag: "storyPhase", gte: 2 }, { beatMark: "khezek_upper_galleries" }] },
      description: "On the way down, at the toll post, the courier passes you going up. Road-worn coat. Boots that know the switchbacks. He pays exact to the mark and doesn't stay, and he nods to you the way pilgrims nod — polite, unhurried, already elsewhere.\n\nHe smells of candle wax. This is a tallow mountain.",
      worldEffects: { territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [],
        receipts: [{ label: "The Courier's Route", effectKey: "rollPlus2", acquisition: "earned", source: { name: "the toll post", npcActorId: wick }, truth: "St Gilliam's drip tray, third candle from the door — moved a finger-width when there's something to collect. Up the Khezek switchbacks to the upper tunnels. Back down with instructions folded the same way. The candle talks, not the men. Pilgrim Wick walks it, and believes it holy the way tired people believe things." }] },
      choices: [ch("You know this man — the pilgrim keeping vigil at the Vacancy", "khezek_tor_quest_scene", { description: "The guest in the corner. The bed he never slept in.", requires: [{ beatMark: "ag_vacancy_pilgrim_wick" }] }),
                ch("You don't know him. Verna might.", "khezek_tor_quest_scene", { description: "A pilgrim has been keeping a room at the Vacancy for weeks, Verna says. Pays exact. Never sleeps.", requires: [{ beatMark: "ag_vacancy_pilgrim_wick", not: true }] })] }));
    { const g = byId.get("khezek_upper_galleries"); if (g) { const c0 = (g.choices || []).find(c => /withdraw quietly/i.test(String(c.label || ""))); if (c0 && c0.next !== "kt_courier_has_a_face") { c0.next = "kt_courier_has_a_face"; changes++; say("▸ khezek_upper_galleries: \"Withdraw quietly\" → kt_courier_has_a_face"); } else say("· ok galleries exit"); } } }
  // P11 ── Act 3 waits for Act 2
  for (const id of ["khezek_tor_the_vaulhaulan_seal_restore", "khezek_tor_the_vaulhaulan_seal_redirect", "khezek_tor_the_vaulhaulan_seal_break"]) { const b = byId.get(id); if (!b) { say(`✗ MISSING ${id}`); continue; } if (b.worldEffects && b.worldEffects.phaseAdvance) { delete b.worldEffects.phaseAdvance; changes++; say(`⚙ ${id}: phaseAdvance removed (the Seal ends the Seal, not Act 2)`); } else say(`· ok ${id} no phaseAdvance`); }
  if (!byId.get("a3_title_card")) {
    const nb = { id: "a3_title_card", label: "THATWARDS HO! — Act Three", type: "dialog", questId: "quest_valhaulan_spine", questStep: 15, timeScale: "scene", tags: "spine title", politicalTags: "", outcomes: { success: null, failure: null }, actors: [], encounter: { key: "", tier: null, actorName: "" },
      story: { quest: "valhaulan_spine" }, where: "anywhere",
      inject: { repeatable: false, requires: [{ flag: "storyPhase", gte: 2 }, { beatMark: "allesh_gilliam_pike_closure" }, { beatMark: "lyrenn_hex_settles" }, { beatMark: "khezek_hex_settles" }, { beatMark: "vs_bridge_seal" }] },
      worldEffects: { territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [], phaseAdvance: { set: 3 } },
      playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true, playerFacing: true, refs: {},
      description: "Three towns settled. A gate that remembers right. A name for the thing on the mountain, and a heading for where its work is pointed.\n\nThe projector hums again over the Frontier Formerly Known As Texas, and the letters come down two stories tall:\n\n<b>A C T &nbsp; T H R E E &nbsp; — &nbsp; T H E &nbsp; H E A D I N G</b>\n\nThe coast. The statues. A chapel that turns to look at things nobody else can see. Three points, one heading — and every road you own now bends toward it.\n\n⚙ GM: this beat raises the story to <b>Act 3</b>. The trail widens, the vault opens, the coast starts asking questions.",
      choices: [ch("Onward", "")] };
    const at = (camp.beats || []).findIndex(b => b?.id === "vs_bridge_seal"); if (at >= 0) camp.beats.splice(at + 1, 0, nb); else camp.beats.push(nb); byId.set(nb.id, nb); changes++; say("＋ a3_title_card (THATWARDS HO! — Act Three; phaseAdvance 3, waits on AG/Lyrenn/KT closed + the realization)");
  } else say("· ok a3_title_card exists");
  try {   // repair: back to Act 2 if Act 3 opened early and nothing of Act 3 has played
    const phase = Number(game.settings.get(NS, "storyPhase")); const st = game.settings.get(NS, "storyState"); const store = st?.played ? st : (st && typeof st === "object" ? Object.values(st).find(x => x && x.played) : null);
    if (phase === 3 && store) { const act3Played = (camp.beats || []).some(b => store.played?.[b.id] && (b.inject?.requires || []).some(r => r?.flag === "storyPhase" && Number(r.gte) >= 3)); if (!act3Played) { say("⏪ story sits in Act 3 with no Act-3 beat played — will set storyPhase back to 2 (apply mode)"); if (!DRY_RUN) await game.settings.set(NS, "storyPhase", 2); } else say("· Act 3 content already played — leaving the act alone"); }
  } catch (eA) { say("✗ act repair check failed: " + (eA?.message || eA)); }
  // P12 ── Day's End, Act 2 onward
  if (!byId.get("days_end_thatwards")) {
    const nb = { id: "days_end_thatwards", label: "Day's End", type: "dialog", questId: null, questStep: 0, timeScale: "scene", tags: "spine terminal", politicalTags: "", outcomes: { success: null, failure: null }, actors: [], encounter: { key: "", tier: null, actorName: "" },
      where: "anywhere", inject: { repeatable: true, evergreen: true, oncePerHex: false, requires: [{ flag: "storyPhase", gte: 2 }] },
      worldEffects: { territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [] },
      playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true, playerFacing: true, refs: {},
      description: "The sun goes down wrong-colored and gorgeous, wherever you are standing when it does, and the day Thatwards is spent.\n\nWhatever you settled today is settled. Whatever you didn't will keep — the frontier is patient in the way of things that have already waited a long time. Before the world moves, the ledger wants its three things.\n\nAnd then we find out what was waiting for the ink to dry.",
      choices: [ch("The turn is locked. Run it.", "", { description: "1. Divvy anything new — which hexes belong to which faction. 2. Plan your Strategic Activities — each faction sets its work for the turn. 3. Lock it in — your GM runs the Turn Driver and the world takes its turn." }), ch("Daylight left — back to it", "", { description: "The day isn't done. Nothing is locked." })] };
    const at = (camp.beats || []).findIndex(b => b?.id === "ag_days_end"); if (at >= 0) camp.beats.splice(at + 1, 0, nb); else camp.beats.push(nb); byId.set(nb.id, nb); changes++; say("＋ days_end_thatwards (Day's End — Act 2 onward, placeless, evergreen)");
  } else say("· ok days_end_thatwards exists");
  { const addCall = (id, before) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const cs = Array.isArray(b.choices) ? b.choices : (b.choices = []); const have = cs.find(c => c && /^call it a day$/i.test(String(c.label || "").trim())); if (have) { if (have.next !== "days_end_thatwards") { have.next = "days_end_thatwards"; changes++; say(`▸ ${id}: "Call it a day" → days_end_thatwards`); } else say(`· ok ${id} call it a day`); return; } const row = ch("Call it a day", "days_end_thatwards", { description: "The day is spent. Lock the turn, or decide there's daylight left." }); const at = before ? cs.findIndex(c => c && before.test(String(c.label || ""))) : -1; if (at >= 0) cs.splice(at, 0, row); else cs.push(row); changes++; say(`▸ ${id}: + "Call it a day" → days_end_thatwards`); };
    addCall("allesh_gilliam_introduction_to_hq", /^leave$/i); addCall("lyrenn_quest_scene", /^ride on/i); addCall("khezek_tor_quest_scene", /^something else/i); addCall("fixit_intro_scene", /^ride back/i); addCall("fixit_town_walk", null); }
  { const ho = camp.hexOverrides || {}; const key = Object.keys(ho).find(k => (ho[k]?.onEnterBeatIds || []).includes("allesh_gilliam_introduction_to_hq") || ho[k]?.onEnterBeatId === "allesh_gilliam_introduction_to_hq");
    if (!key) say("✗ no hexOverride lists allesh_gilliam_introduction_to_hq — set Allesh-Gilliam's on-enter beats by hand: [HQ intro, allesh_gilliam_town_walk]");
    else { const want = ["allesh_gilliam_introduction_to_hq", "allesh_gilliam_town_walk"]; if (JSON.stringify(ho[key].onEnterBeatIds) !== JSON.stringify(want)) { ho[key].onEnterBeatIds = want; changes++; say(`⚙ hexOverrides ${key}: onEnterBeatIds = [HQ intro, town walk]`); } else say("· ok Allesh-Gilliam on-enter list"); } }

  console.log(`[patch-story-flow-playtest] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Playtest patch DRY RUN: ${changes} change(s) (console). Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-playtest-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Playtest patch APPLIED: ${changes} change(s). Backup downloaded.`);
})();

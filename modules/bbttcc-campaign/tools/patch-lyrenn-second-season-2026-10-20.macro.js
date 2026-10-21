/* patch-lyrenn-second-season-2026-10-20.macro.js — LYRENN, SECOND SEASON (Dave, 2026-10-20 night):
 *
 *  1 "Will they still appear if the stewards went to Lyrenn in Act 1 like they're supposed to?" — yes: every row on The Rows,
 *    Second Season is an Act-2 beat with its own id; the Act-1 welcomes (`lyrenn_elsin_welcome`, `lyrenn_rowan_welcome`,
 *    `lyrenn_green_ring_cinematic`) are sealed at phase ≤1. But three of the Act-2 doors RE-TOLD the first meeting word for word
 *    ("took your measure over one firm handshake", "studied you like a half-remembered dream", the Ring described from scratch),
 *    and the Second Season opener assumed a first visit that may not have happened. Now they know:
 *      lyrenn_quest_scene            {{#played lyrenn_town_walk}} returning stewards {{else}} first time here, two letters in a pocket
 *      lyrenn_elsin_quade_convo      {{#played lyrenn_elsin_welcome}} she does not take your measure twice
 *      lyrenn_rowan_of_the_loam_convo {{#played lyrenn_rowan_welcome}} the ground told them you were coming
 *      lyrenn_green_ring             plinth returned / Ring as you left it / first look (one nested level: played → mark)
 *    Act-1 doors that pointed at the sealed town walk: `lyrenn_opening_scene` gets an Act-2 "Head into town" → Second Season;
 *    `lyrenn_green_ring_cinematic` sealed at ≤1 like its siblings; the visualizer hub `lyrenn_main_scene` re-aimed at Act-2 beats.
 *
 *  2 "how is the Water Choir supposed to flow" — the chain was scattered through the live array (hub + inspects at 67–71, the
 *    reading at 720, the children at 832, the whisper at 835) so the doc showed it in three places. The play order is:
 *    exterior → hub → inspect (prc/ins/arc) → reading (three things) → the children grade you (once) → after the red-thread
 *    planting, the flat basin has words (whisper). Now the hub has doors to the children and to the whisper, both beats come
 *    back to the hub, the hub text knows what has already happened, and the six later beats are MOVED to sit after the inspects.
 *
 *  3 "a lot of these quests are still in some old voice rhythms" (the rapid one-line "not this, this" lists; the snark stays):
 *    the Water Choir hub, the Forest hub and the Gentle Pest hub rewritten as paragraphs, every fact kept; the harvest outcome too.
 *
 *  4 THE PLINTH PAYS OFF (ruled 10-20): the Ring's statue was never one of the hundred. It walked to the low field's edge on
 *    that one night and knelt. NEW `lyrenn_plinth_returns` (once, the next time the stewards are in Lyrenn after BOTH the Garden vigil
 *    `ninth_guest_not_in_this_age` AND `spark_geburah_reconstituted` have played — Act 4 at the earliest): the kneeler is back on its plinth, the furrows run straight, the Choir plays the note it
 *    has been playing around, Rowan says the soil is talking again. Door on the Second Season menu; the Ring, the low field's
 *    exterior and the Choir reading know afterwards.
 *
 *  Idempotent; DRY_RUN default true; backs up `campaigns`. GM only.
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
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;
  const ch = (label, next, description, extra = {}) => ({ label, next, description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const setDesc = (id, startsWith, to, note) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; }
    const d = String(b.description || "");
    if (d === to) { report.push(`· ok ${id}: ${note}`); return; }
    if (!d.startsWith(startsWith)) { report.push(`⚠ ${id}: baseline start not found for "${note}"`); return; }
    b.description = to; changes++; report.push(`✚ ${id}: ${note}`);
  };
  const rep = (id, from, to, note) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; }
    const d = String(b.description || "");
    if (to && !from.includes(to) && d.includes(to)) { report.push(`· ok ${id}: ${note}`); return; }
    if (d.includes(from)) { b.description = d.replace(from, to); changes++; report.push(`✚ ${id}: ${note}`); return; }
    if (to === "" || d.includes(to)) { report.push(`· ok ${id}: ${note}`); return; }
    report.push(`⚠ ${id}: baseline text not found for "${note}"`);
  };
  const addRow = (id, row, before, note) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; }
    b.choices = Array.isArray(b.choices) ? b.choices : [];
    if (b.choices.some(c => c?.next === row.next && c?.label === row.label)) { report.push(`· ok ${id}: row "${row.label}"`); return; }
    const at = before ? b.choices.findIndex(c => before.test(String(c?.label || ""))) : -1;
    if (at >= 0) b.choices.splice(at, 0, row); else b.choices.push(row);
    changes++; report.push(`✚ ${id}: ${note}`);
  };
  const setReq = (id, requires, note) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; }
    b.inject = b.inject || {};
    if (JSON.stringify(b.inject.requires || []) === JSON.stringify(requires)) { report.push(`· ok ${id}: ${note}`); return; }
    b.inject.requires = requires; changes++; report.push(`✚ ${id}: ${note}`);
  };
  const ROWAN = "4kWF2skvyviuaWX8", GREEN_RING = "aj6YaOO950T3D7uE", LYRENN_Q = "quest_JqCdOo0l6X8K2EcE", CLOSER = "lyrenn_plinth_returns";

  /* 1 · the Second Season knows Act 1 ──────────────────────────────────────── */
  setDesc("lyrenn_quest_scene", "<p>Lyrenn has stopped noticing you",
    "{{#played lyrenn_town_walk}}<p>Lyrenn has stopped noticing you, which is the highest compliment the rows give. The chimes still argue in the irrigation ditches; the workers still tip a tool as you pass, but now they go straight back to work, because you are furniture here, and furniture gets told things.</p>\n<p>Somebody has been at the east channels with a spade and no manners. Somebody else says the treeline moved in the night and is prepared to swear to it. The field that remembers you has not stopped remembering. Elsin has the ledgers open. Rowan is listening to the ground.</p>\n<p>The Stewards are expected. That is a different thing from being welcome, and better.</p>{{else}}<p>Lyrenn does not greet you. It notices you, which around here is the same thing, done more honestly. The chimes argue in the irrigation ditches; the workers tip a tool as you pass and watch where you put your feet, because you are new here, and new things get measured.</p>\n<p>Somebody has been at the east channels with a spade and no manners. Somebody else says the treeline moved in the night and is prepared to swear to it. The low field that nobody harvests has started saying names. Elsin has the ledgers open. Rowan is listening to the ground.</p>\n<p>You were written to, twice. Nobody here is surprised it took you a while.</p>{{/played}}",
    "returning stewards / first time here");
  rep("lyrenn_elsin_quade_convo", "<p>Elsin Quade took your measure over one firm handshake and zero wasted words. Her position",
    "<p>{{#played lyrenn_elsin_welcome}}Elsin Quade does not take your measure twice. She took it over a handshake and a bowl of stew the first time you came through, and the number has not changed, which from her is a kindness. {{else}}Elsin Quade took your measure over one firm handshake and zero wasted words. {{/played}}Her position",
    "Elsin: not twice");
  rep("lyrenn_rowan_of_the_loam_convo", "<p>Rowan of the Loam studied you like a half-remembered dream and then went back to listening to the ground. The crops",
    "<p>{{#played lyrenn_rowan_welcome}}Rowan of the Loam does not look up when you come into the row. The ground told them you were coming; it knows your weight now, and keeps saying so. {{else}}Rowan of the Loam studied you like a half-remembered dream and then went back to listening to the ground. {{/played}}The crops",
    "Rowan: the ground told them");
  setDesc("lyrenn_green_ring", "The Green Ring is a radial field around the old grain elevator, furrows running out",
    `{{#played ${CLOSER}}}The Green Ring is a radial field around the old grain elevator, and the furrows run straight now, out from the centre like a clock that has finally agreed on the time. On the plinth where the footprint was worn smooth, the Ring's own statue stands with its hands open at its sides, facing the sea. Rowan is beside it, standing, which still looks wrong on them.{{else}}{{#mark lyrenn_green_ring_cinematic}}The Ring is as you left it the first time through: furrows running out from the old elevator like a clock with too many hands, every one of them still bending, very slightly, around the empty plinth at the centre where something stood. Nobody has said what in the meantime. What has changed is Rowan, who is on one knee at the plinth with a palm flat on the ground, and does not look up.{{else}}The Green Ring is a radial field around the old grain elevator, furrows running out from it like a clock with too many hands, and every furrow bends, very slightly, around an empty plinth at the centre where something stood. Nobody says what. The bend is in the soil, not the planting; whoever ploughs here ploughs around it without deciding to. Rowan is on one knee at the plinth with a palm flat on the ground, and does not look up.{{/mark}}{{/played}}`,
    "plinth returned / as you left it / first look");
  {
    const b = byId.get("lyrenn_opening_scene");
    if (!b) report.push("⚠ lyrenn_opening_scene: not found");
    else {
      const first = (b.choices || []).find(c => c?.next === "lyrenn_town_walk");
      if (first && !Array.isArray(first.requires)) { first.requires = [{ flag: "storyPhase", lte: 1 }]; changes++; report.push("✚ lyrenn_opening_scene: the Act-1 door is Act-1 only"); }
      addRow("lyrenn_opening_scene", ch("Head into town", "lyrenn_quest_scene", "", { requires: [{ flag: "storyPhase", gte: 2 }] }), null, "Act-2 arrivals go to the Second Season");
    }
  }
  setReq("lyrenn_green_ring_cinematic", [{ flag: "storyPhase", gte: 1 }, { flag: "storyPhase", lte: 1 }], "the Act-1 cinematic is sealed with its siblings");
  {
    const b = byId.get("lyrenn_main_scene"); let n = 0;
    for (const c of (b?.choices || [])) {
      if (c.next === "lyrenn_town_walk") { c.next = "lyrenn_quest_scene"; n++; }
      if (c.next === "lyrenn_green_ring_cinematic") { c.next = "lyrenn_green_ring"; n++; }
    }
    if (!b) report.push("⚠ lyrenn_main_scene: not found"); else if (n) { changes += n; report.push(`✚ lyrenn_main_scene: ${n} door(s) re-aimed at Act-2 beats`); } else report.push("· ok lyrenn_main_scene: doors");
  }

  /* 2 · the Water Choir flows ───────────────────────────────────────────────── */
  setDesc("lyrenn_water_choir", "The irrigation channels run on gravity alone.",
    `The irrigation channels run on gravity alone, stone-lined and hand-carved, and when the water moves through them it sings. Not metaphorically. Notes rise where the channels narrow and low tones hum in the wide basins, and the whole thing is music with patience where the rhythm should be. People work slower here. Arguments soften before they finish. Animals come down to drink and then leave without being asked.\n\nStep close and the tone shifts, just slightly, as if something is tuning itself around you. A child nearby, eyes shut, whispers: “It's trying to figure you out.”\n\n{{#played lyrenn_whisper}}The basin that went flat that one night has words in it now, and the stone hand in its channel bed, palm up, is what it says them with. The children stand very still for it. So, you notice, do you.{{else}}Since that night it has been playing one basin flat, on purpose, like a held finger on a string. In that basin's channel bed sits a stone hand, palm up. The children skip it, politely. When you step close, the flat note stops, relieved, or worried, or both.{{/played}}{{#played lyrenn_choir_children}} The children know your listening now; the tall one with the clipboard does not open her eyes when you arrive, which is a grade.{{/played}}{{#played ${CLOSER}}} Lately the Choir has been playing the whole tune, start to finish, a little surprised at itself.{{/played}}`,
    "the Choir hub, in paragraphs, knows the children / the whisper / the plinth");
  addRow("lyrenn_water_choir", ch("Ask the children which basin is flat.", "lyrenn_choir_children", "Eleven of them, eyes shut, conducting by listening harder.", { requires: [{ beatMark: "lyrenn_choir_children", not: true }] }), /^Leave$/, "door → the children grade you");
  addRow("lyrenn_water_choir", ch("Stand still at the basin that was flat.", "lyrenn_whisper", "Since the planting it has had something to say.", { requires: [{ beatMark: "lyrenn_red_thread_planting" }, { beatMark: "lyrenn_whisper", not: true }] }), /^Leave$/, "door → what the land was told (after the planting)");
  addRow("lyrenn_choir_children", ch("Back to the channels.", "lyrenn_water_choir", ""), null, "the children send you back to the Choir");
  addRow("lyrenn_whisper", ch("Back to the channels.", "lyrenn_water_choir", ""), null, "the whisper sends you back to the Choir");
  {
    const CHAIN = ["lyrenn_water_choir_reading", "lyrenn_choir_children", "lyrenn_choir_children_fail", "lyrenn_whisper", "lyrenn_whisper_fail"];
    const anchor = byId.get("lyrenn_water_choir_try_again");
    const idx = i => camp.beats.indexOf(byId.get(i));
    const already = anchor && CHAIN.every((id, k) => idx(id) === idx("lyrenn_water_choir_try_again") + 1 + k);
    if (!anchor) report.push("⚠ chain move: anchor not found");
    else if (already) report.push("· ok Choir chain sits after the inspects");
    else {
      const moving = CHAIN.map(id => byId.get(id)).filter(Boolean);
      camp.beats = camp.beats.filter(b => !moving.includes(b));
      camp.beats.splice(camp.beats.indexOf(anchor) + 1, 0, ...moving);
      changes++; report.push(`✚ Choir chain: ${moving.length} beats moved to sit after the inspects (reading → children → whisper)`);
    }
  }

  /* 3 · the old one-line register, Lyrenn's three hubs + the harvest ────────── */
  setDesc("lyrenn_forest_will_not_be_fought", "The treeline does not advance.",
    "The treeline does not advance. It rearranges. Paths you walked yesterday bend somewhere else today, and clearings open up behind you like an apology. Branches lean in while you talk. The wind carries tone but never words. When somebody raises their voice the birds go up all at once, and when somebody softens, the roots uncoil a little, which you can feel through your boots.\n\nThe forest is correcting something. Whatever it is, it is behind you, not you, and the fence line is just where the two of you happen to overlap.",
    "the Forest hub, in paragraphs");
  setDesc("lyrenn_the_gentle_pest", "The soil trembles in ripples.",
    "The soil trembles in ripples, and under the ripples are the root-burrowers: pale, soft-bodied things the length of a forearm, tearing the irrigation channels apart from underneath. When tools come near they scatter. When somebody shouts at them they multiply, which is a design flaw in the shouter. When somebody speaks to them gently they pause. Just once, and just for a moment, but they pause.<p>They are not digging in. They are digging <i>through</i> — every channel points the same way: toward the Green Ring, toward the town, toward the fence with your banner on it.</p>",
    "the Gentle Pest hub, in paragraphs");
  setDesc("lyrenn_the_field_that_remembers_you_harvest_the_plants", "The sap tastes like memory.",
    "The sap tastes like memory, bitter and familiar, the way a word you used to say every day tastes when you find it again. Rowan watches you cut it and says nothing, which is a sentence. You can distill it into “Distilled Guilt”, which is useful in a Parley and terrible in a kitchen.",
    "the harvest, in a paragraph");

  /* 4 · the plinth pays off ─────────────────────────────────────────────────── */
  if (!byId.get(CLOSER)) {
    const nb = {
      id: CLOSER, label: "Lyrenn — The Plinth Is Not Empty", type: "dialog", timeScale: "scene", timePoints: 0,
      questId: LYRENN_Q, tags: "lyrenn green_ring plinth ninth_guest lost_statues story", politicalTags: "",
      description: "Word gets to Lyrenn the way word gets anywhere, late and by water. The Choir had it first. The children came up from the basins before breakfast to say the flat one had stopped being flat, and Rowan went down to the low field without finishing their tea, which nobody in Lyrenn has seen them do.\n\nThe kneeler is gone from the field's edge. Not broken, not taken: the furrows that bent around it for as long as anyone has ploughed here run straight to the hedge now, and the plants in the low field have put their arms down.\n\nIt is in the Ring. On the plinth, where the footprint was worn smooth to fit it, a stone figure stands with its hands open at its sides, facing the sea. It was never one of the hundred. It was the Ring's own, and on the night the land was hurt it walked to the edge of the field that remembers and knelt there, and waited for somebody to keep the Garden and make the strong thing answerable again. You did both. It heard.\n\nRowan is on one knee anyway, out of habit, palm flat on the ground. After a long while they look up, which they do not do.\n\n\"It's talking again,\" they say. \"The soil. Not loud. Just talking.\" They stand, and brush off their knee, and the wind across the Ring sounds like someone turning over in their sleep and settling. Down in the channels, faint, the Choir plays the note it has been playing around since that night, and then plays the rest of the tune as if it had never stopped.",
      memoryText: "The Ring's statue came back to its plinth once the Garden was kept and Geburah made whole: the kneeler left the low field, the furrows run straight, the Choir plays its missing note, and Rowan says the soil is talking again.",
      outcomes: { success: null, failure: null },
      inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit",
        requires: [{ flag: "storyPhase", gte: 2 }, { beatMark: "ninth_guest_not_in_this_age" }, { beatMark: "spark_geburah_reconstituted" }] },   // the two marks ARE the timing (Act 4 at the earliest); a phase ≥5 gate only tripped lint S01 on the Leave door
      actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
      sceneId: GREEN_RING, speakerActorId: ROWAN, priority: "high", storyChain: "lyrenn", story: { quest: "lyrenn" },
      choices: [
        ch("Put a palm on the ground.", "", "Warm where it should be cool. Under the warmth, a rhythm. Not a heartbeat. Breathing heard through a wall, by someone who has stopped worrying about who is on the other side."),
        ch("Ask Rowan what it was waiting for.", "", "\"Somebody to do the two things,\" Rowan says. \"Keep the ones who stayed. Make the strong one answer.\" They shrug, which from Rowan is a speech. \"It never said it was waiting for you. It just stood up when you'd done it.\""),
        ch("Say nothing. Let the Ring breathe.", "", "You stay until the Choir has finished the tune twice. Nobody in Lyrenn interrupts you, which is how Lyrenn says thank you."),
        ch("Leave", "lyrenn_quest_scene", "")
      ],
      worldEffects: {}
    };
    const anchor = byId.get("lyrenn_green_ring"); const at = anchor ? camp.beats.indexOf(anchor) + 1 : camp.beats.length;
    camp.beats.splice(at, 0, nb); byId.set(CLOSER, nb); changes++; report.push(`✚ beat ${CLOSER} — ${nb.label}`);
  } else report.push(`· ok ${CLOSER}: present`);
  addRow("lyrenn_quest_scene", ch("The Green Ring — the furrows have straightened", CLOSER, "The children came up from the basins before breakfast.",
    { requires: [{ beatMark: "ninth_guest_not_in_this_age" }, { beatMark: "spark_geburah_reconstituted" }, { beatMark: CLOSER, not: true }] }), /^Green Ring$/, "Second Season door → the plinth is not empty");
  rep("lyrenn_low_field_exterior", "At the field's edge, half-buried where the furrows stop, a stone figure kneels. The furrows bend around it. They always have.",
    `{{#played ${CLOSER}}}At the field's edge, where the furrows stop, there is a shallow dent in the shape of two knees and nothing in it. The furrows run straight to the hedge now.{{else}}At the field's edge, half-buried where the furrows stop, a stone figure kneels. The furrows bend around it. They always have.{{/played}}`,
    "the low field knows the kneeler left");
  rep("lyrenn_water_choir_reading", "<p>Three. The Ring's empty plinth is the note the Choir is missing. It plays around the gap. It has played around the gap so long that the gap has become the tune.</p>",
    `<p>Three. {{#played ${CLOSER}}}The Ring's plinth is not empty any more, and the Choir has its note back. It plays the tune through now, start to finish, and is a little surprised at itself every time.{{else}}The Ring's empty plinth is the note the Choir is missing. It plays around the gap. It has played around the gap so long that the gap has become the tune.{{/played}}</p>`,
    "the reading knows the note came back");

  console.log(`[lyrenn-second-season 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-lyrenn-second-season-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Lyrenn, second season.`);
})();

/* seed-widening-trail-retrofit.macro.js — THE WIDENING TRAIL to the Chuckle Creek template (2026-09-27). RUN IN-WORLD (GM). DRY_RUN default true.
 * Source: ~/WIDENING_TRAIL_RETROFIT_2026_09_27.md. Voices (Captain Robot, Sable Nine, three NEW actors), fail landings, the two skips become
 * endings, receipt THE SIDEWAYS MANIFEST, and the bible's "fourth way in" as DOORS (Ride the Wagon → the cult camp; the Keeper; Legansus filings +
 * the seven positions). Front door unchanged. Idempotent; backs up the campaigns setting. F5 after.
 *
 * REVIEW FIXES 2026-10-01 (GAME_REVIEW_2026_09_30, HIGH ×2):
 *  • ROUTING-ONLY ENDINGS: the voice() pass stamped Captain Robot / Sable 9 / Brother Ansel / Dot Pellew (and the testimony's Blask) onto
 *    chapter ENDING beats that carry labelled choices and gate only on storyPhase ≥ 3 — so a talk with that NPC could enact the ending cold,
 *    from anywhere, repeatedly (Legansus `verified` also alsoEnds the whole Trail). Every voiced Trail ending (chapel ×3, Anchor Reach ×3
 *    incl. `marked`, Port Kudzu testimony/partial, the cult camp, Legansus verified/flagged) is now dialogueOffer:false and gated on the beat
 *    that routes to it + its chapter bucket not yet completed (ROUTE_ONLY below). A route never consults inject.requires, so every authored
 *    choice still reaches its ending; the NPC still remembers it (speaker kept).
 *  • NEW ENDINGS JOIN THE NEXT GATE: map_anchor_reach_marked and wt_cult_camp ended their chapters but the next chapter's start gate still
 *    listed only the old endings (NOW waited forever). map_port_kudzu_intro's anyOf gains `marked`; map_legansus_waystation_intro's gains
 *    wt_cult_camp (NEXT_START_ALTS — additive, never removes an alternative). The camp door is gated on the wagon / the caravan route.
 *  Already-seeded worlds: tools/patch-template-review-fixes-2026-10-01.macro.js does the same repair in one run.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const KEY = "widening_trail", Q_MAIN = "quest_x8T2VkPUjhvp2vDM", Q_CHAPEL = "quest_pI4LaZTvh9QmuRaE", Q_FLATS = "quest_burnt_flats", Q_MIRE = "quest_ZTiNTjhJGtRz7iDu", Q_REACH = "quest_OpvVkGwzBTM2Px13", Q_KUDZU = "quest_J4NXb6xZ9M15EesB", Q_LEG = "quest_xBw8cGSC88wX2UeT";
  const MARKER = "[TRAIL-RETROFIT-2026-09-27]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  const NEW_PERSONAS = [
    { name: "Brother Ansel Vey", topics: "the chapel, the rotations, the pews, the broom, the coast road, the night the Seal came on, sweeping, facing, the cell, the high shrines",
      notes: `${MARKER} PRIVATE TRUTH — Brother Ansel Vey keeps the Rotating Chapel: the cult cell's day-man, who sweeps a building that turns to face things nobody else can see, and sweeps the pews back round after. VOICE: mild, dutiful, faintly proud of his floors; answers questions about the CHAPEL freely (where it faces, how often, what it looks at) and about the CELL never; he calls them "the congregation" and himself "the help." He does not know the Seal by that name; he knows "the night it faced the sea for eleven minutes" and swept up afterwards. Funny first: a man with a broom losing an argument with a floor plan every morning. If a Steward carrying the seven positions reads them off the rotations, he watches them do it and says nothing, and then sweeps.`,
      secrets: ["Which Way It Faced :: rollPlus2 :: a Steward asks which way the chapel faced on the night the Seal came on, not why it turns :: Coastward, sideways, for eleven minutes, and he swept the pews back round himself. He has the broom marks to prove it and has never told anyone that."] },
    { name: "Captain Orrin Blask", topics: "the river, the water, sideways, the surge, the route inland, cargo, manifests, chapel-marked crates, handling codes, Port Kudzu, the captains, paper",
      notes: `${MARKER} PRIVATE TRUTH — Captain Orrin Blask, river captain out of Port Kudzu, the one who saw the water go sideways. VOICE: slow, exact, a man who has told this story to people who paid and people who didn't and tells it the same way to both; "a captain keeps paper." He saw the surge move INLAND, uphill, along a route somebody had prepared, taking its time, and the cargo that went with it wore a chapel mark and inland handling codes he had never seen on river paper. He kept the manifest. He will sell it, or be charmed out of it, or have it stolen, and in all three cases he will say "it went sideways" first, because that is the part he cannot get over.`,
      secrets: ["The Water Went Sideways :: oppRollMinus2 :: a Steward asks what the water DID, not what he saw :: It went inland. Uphill. Along a route somebody had prepared, and it took its time about it, like it had a schedule. He kept the manifest for the cargo that went with it because a captain keeps paper, and the paper has a chapel on it."] },
    { name: "Harbourmaster Dot Pellew", topics: "the port, the saloon, Fewer Dead Fish Smell, berths, wagons, every third market, salt, wax, the Long Market, the Jackalopes, Mara, bookings, dead fish, fewer of them",
      notes: `${MARKER} PRIVATE TRUTH — Harbourmaster Dot Pellew, Jackalope, runs Port Kudzu's berths and the Fewer Dead Fish Smell Saloon (the name is a promise and, she will tell you, a kept one). VOICE: brisk, funny, hospitable, keeps a booking ledger the way Verna keeps a guest ledger; everything that leaves the port is in it. THE WAGON: every third market a wagon loads at the Long Market's rope stall and leaves through her port, salt and wax and flour and no meat, coastward, and comes back empty two days later, and she books it, and nobody has ever told her what for, and she has stopped asking and has not stopped noticing. She would like somebody to ask HER. Funny first: the saloon smells of exactly as many dead fish as advertised.`,
      secrets: ["Every Third Market :: rollPlus2 :: a Steward asks what leaves the port that never comes back full :: A wagon, every third market, salt and wax and no meat, coastward, two days out and two back. She books it. She has never once been told what for, and she has stopped asking, and she has not stopped noticing. She will tell you which berth."] }
  ];
  const actorIds = {};
  for (const p of NEW_PERSONAS) {
    let actor = (game.actors?.contents || []).find(a => a.name === p.name);
    if (!actor) { say(`✚ CREATE actor "${p.name}"`); changes++; if (!DRY_RUN) actor = await Actor.create({ name: p.name, type: "npc" }); }
    if (!actor) continue;
    actorIds[p.name] = actor.id;
    const cur = actor.getFlag(MAL, "persona") || {};
    if (String(cur.notes || "").includes(MARKER)) { say(`· ok persona ${p.name}`); continue; }
    changes++; say(`✚ persona ${p.name} +${p.secrets.length} secret(s)`);
    if (!DRY_RUN) await actor.setFlag(MAL, "persona", { ...cur, topics: [String(cur.topics || "").trim(), p.topics].filter(Boolean).join(", "), notes: [String(cur.notes || "").trim(), p.notes].filter(Boolean).join("\n\n"), secretsRaw: [String(cur.secretsRaw || "").trim(), ...p.secrets].filter(Boolean).join("\n") });
  }
  for (const n of ["Captain Robot", "Sable 9", "Pilgrim Wick"]) { const a = (game.actors?.contents || []).find(x => x.name === n); if (a) actorIds[n] = a.id; }
  const sp = (n) => actorIds[n] || null;

  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of ["map_rotating_chapel_approach", "map_burnt_flats_intro", "map_singing_mire_intro", "map_anchor_reach_intro", "map_port_kudzu_intro", "map_legansus_waystation_intro", "map_port_kudzu_testimony", "map_legansus_waystation_verified"]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — the Trail was never seeded here.`);

  const TAGS = "widening_trail story";
  const P3 = { flag: "storyPhase", gte: 3 };
  const beat = (id, label, description, { type = "dialog", speaker = null, choices = null, receipts = null, story = null, requires = null, timePoints = 0, priority = "background", memoryText = null, questEffects = null, questId = Q_MAIN, hexName = null, offer = true } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId, tags: TAGS, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: true, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority, ...(hexName ? { hexName } : {}), ...(speaker ? { speakerActorId: speaker } : {}),
    ...(offer === false ? { dialogueOffer: false } : {}),   // a routing-only node: never a conversation moment
    story: story || { quest: KEY }, ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(receipts ? { receipts } : {}), ...(questEffects ? { questEffects } : {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });
  // ── routing-only endings (REVIEW FIXES 2026-10-01) — keep in sync with tools/patch-template-review-fixes-2026-10-01.macro.js ──
  // gate = the beat(s) that route to the ending + the chapter's bucket not yet completed (every ending completes it), so neither a
  // conversation nor the Director can enact an ending cold or a second time; the authored routes ignore inject.requires and still land
  const NOT_DONE = (q) => ({ questBucket: q, isNot: "completed" });
  const GATE_CHAPEL_END = [P3, { beatMark: "map_rotating_chapel_approach" }, NOT_DONE(Q_CHAPEL)];
  const GATE_REACH_END = [P3, { beatMark: "map_anchor_reach_intro" }, NOT_DONE(Q_REACH)];
  const GATE_KUDZU_TESTIMONY = [P3, { beatMark: "map_port_kudzu_intro" }, NOT_DONE(Q_KUDZU)];
  const GATE_KUDZU_PARTIAL = [P3, { anyOf: [{ beatMark: "map_port_kudzu_intro" }, { beatMark: "wt_kudzu_rebuff" }] }, NOT_DONE(Q_KUDZU)];
  const GATE_CAMP = [P3, { anyOf: [{ beatMark: "wt_caravan_ride" }, { beatMark: "ag_caravan_route" }] }, NOT_DONE(Q_KUDZU)];
  const GATE_LEG_VERIFIED = [P3, { anyOf: [{ beatMark: "map_legansus_waystation_intro" }, { beatMark: "wt_legansus_sequence" }] }, NOT_DONE(Q_LEG)];
  const GATE_LEG_FLAGGED = [P3, { beatMark: "map_legansus_waystation_intro" }, NOT_DONE(Q_LEG)];
  const ROUTE_ONLY = {
    map_rotating_chapel_map: GATE_CHAPEL_END, map_rotating_chapel_force: GATE_CHAPEL_END, map_rotating_chapel_harmonize: GATE_CHAPEL_END,
    map_anchor_reach_stabilize: GATE_REACH_END, map_anchor_reach_break: GATE_REACH_END, map_anchor_reach_marked: GATE_REACH_END,
    map_port_kudzu_testimony: GATE_KUDZU_TESTIMONY, map_port_kudzu_partial: GATE_KUDZU_PARTIAL, wt_cult_camp: GATE_CAMP,
    map_legansus_waystation_verified: GATE_LEG_VERIFIED, map_legansus_waystation_flagged: GATE_LEG_FLAGGED
  };
  // the retrofit's new chapter endings join the NEXT chapter's start gate (an anyOf alternative next to the old endings)
  const NEXT_START_ALTS = [
    { id: "map_port_kudzu_intro", among: ["map_anchor_reach_stabilize", "map_anchor_reach_break"], add: ["map_anchor_reach_marked"] },
    { id: "map_legansus_waystation_intro", among: ["map_port_kudzu_testimony", "map_port_kudzu_partial"], add: ["wt_cult_camp"] }
  ];
  const CHAPEL = { quest: KEY, chapter: "the_rotating_chapel" }, FLATS = { quest: KEY, chapter: "the_burnt_flats" }, MIRE = { quest: KEY, chapter: "the_singing_mire" }, REACH = { quest: KEY, chapter: "anchor_reach" }, KUDZU = { quest: KEY, chapter: "port_kudzu" }, LEG = { quest: KEY, chapter: "legansus_waystation" };

  const NEW = [
    beat("wt_chapel_keeper", "The Rotating Chapel — The Keeper",
      "There is a man with a broom losing an argument with the floor plan. Every time the chapel turns he sweeps the pews back round to face the altar, and every time he finishes, it turns again, and he starts again, and he has clearly been doing this for years with the patience of a man who thinks the building will tire first. \"Brother Ansel,\" he says. \"I'm the help. The congregation's out.\" He does not say where.",
      { speaker: sp("Brother Ansel Vey"), story: CHAPEL, questId: Q_CHAPEL, requires: [P3], hexName: "The Rotating Chapel", choices: [
        ch("Ask which way it faced the night the Seal came on.", "", { checkStat: "presence", checkDC: 12, failNext: "wt_chapel_keeper_fail", description: "Coastward. Sideways. Eleven minutes. He swept it back round himself. He shows you the broom marks." }),
        ch("Read the rotations as the seven positions.", "", { requires: { beatMark: "ag_pipeline_backward" }, description: "The chapel has been turning through the sequence, one position a night, and tonight is the sixth. Ansel watches you count and says nothing, and then sweeps." }),
        ch("Help him sweep.", "", { description: "It turns while you're mid-pew. He doesn't even sigh any more." })
      ] }),
    beat("wt_chapel_keeper_fail", "The Rotating Chapel — The Help",
      "\"The congregation would know,\" he says. \"I'm the help.\" He sweeps. The chapel turns a degree, politely, toward the sea, and he sweeps that too.",
      { type: "narration", speaker: sp("Brother Ansel Vey"), story: CHAPEL, questId: Q_CHAPEL, requires: [P3], choices: [ch("Ask again, about the floors this time.", "wt_chapel_keeper")] }),
    beat("wt_flats_mud", "The Burnt Flats — The Mud Answers Back",
      "The seam you were reading exhales in your face, warm and geometric, and the pattern you had is gone under a new one. The Flats are not a wildfire. They are not a receipt either, yet. They are a page somebody keeps turning while you read.",
      { type: "narration", story: FLATS, questId: Q_FLATS, requires: [P3], choices: [ch("Read it again, faster.", "map_burnt_flats_intro"), ch("Press on with what you have.", "map_burnt_flats_partial")] }),
    beat("wt_mire_static", "The Singing Mire — Static",
      "The song curdles for a bar and comes back a quarter-tone off, and the line you hear now is not the one you heard before, and it is truer, and you did not want it to be. The reeds settle. The marsh waits for you to try again, which it will let you do forever.",
      { type: "narration", story: MIRE, questId: Q_MIRE, requires: [P3], choices: [ch("Sing back.", "map_singing_mire_intro"), ch("Push through the static.", "map_singing_mire_partial")] }),
    beat("wt_reach_slip", "Anchor Reach — The Pattern Slips",
      "The tide comes in a hand's breadth and the diagram goes under. Sable, from the chair, does not look up from the chart. \"It comes back out,\" they say. \"That's what tides are for. Sit.\" There is, you notice, a second chair.",
      { type: "narration", speaker: sp("Sable 9"), story: REACH, questId: Q_REACH, requires: [P3], choices: [ch("Wait for the tide.", "map_anchor_reach_intro"), ch("Break an anchor point instead.", "map_anchor_reach_break")] }),
    beat("map_anchor_reach_marked", "Anchor Reach — Marked and Left",
      "You mark the site, three pilings and the one with shoulders, and you leave the diagram in the water where it can keep holding still for whoever needs it to. Sable folds the chair. The human logistics trail runs inland from here, and somebody is at the other end of it, floating on invoices.",
      { type: "narration", speaker: sp("Sable 9"), story: { ...REACH, role: "ending", ending: "marked" }, questId: Q_REACH, requires: GATE_REACH_END, offer: false,
        questEffects: [{ action: "complete", questId: Q_REACH, beatId: "", state: "completed", text: "Anchor Reach marked and left in the water." }],
        choices: [ch("Follow the trail to Port Kudzu.", "map_port_kudzu_intro")] }),
    beat("wt_kudzu_rebuff", "Port Kudzu — Rented by the Breath",
      "The captain smiles and the price goes up, or the broker smiles and the patience runs out, or the manifest is where it was and your hand isn't. Port Kudzu rents everything by the breath and you have just spent one.",
      { type: "narration", story: KUDZU, questId: Q_KUDZU, requires: [P3], choices: [ch("Try another captain.", "map_port_kudzu_intro"), ch("Take what you've got to Legansus.", "map_port_kudzu_partial"), ch("The saloon first.", "wt_kudzu_saloon")] }),
    beat("wt_kudzu_saloon", "Port Kudzu — Fewer Dead Fish Smell",
      "The saloon is named for a kept promise: it smells of fewer dead fish than you'd think, and Harbourmaster Dot Pellew will tell you the exact number if you ask, because she keeps a ledger of everything that leaves this port and most of what arrives. A wagon is in it, every third market, salt and wax and no meat, coastward. \"Nobody's ever told me what for,\" she says. \"I stopped asking. I didn't stop writing it down.\"",
      { speaker: sp("Harbourmaster Dot Pellew"), story: KUDZU, questId: Q_KUDZU, requires: [P3], hexName: "Port Kudzu", choices: [
        ch("Ask what leaves and never comes back full.", "", { checkStat: "presence", checkDC: 12, failNext: "wt_kudzu_rebuff", description: "The wagon. She tells you which berth, and when, and that it has never once been late." }),
        ch("Ask about the captain who saw the water go sideways.", "", { description: "\"Blask. He'll tell you for money, patience, or nothing if you let him say 'sideways' first.\"" }),
        ch("Order the fish.", "", { description: "It is, against all odds, good." })
      ] }),
    beat("wt_caravan_ride", "Port Kudzu — Ride the Wagon",
      "You know when the wagon leaves, because Etta sold you preserves first and then told you. Salt, wax, flour, no meat, and a Jackalope driver who does not ask questions because nobody has ever asked him one. Two days coastward. The road stops being a road about an hour out, and the wagon does not slow down.",
      { story: KUDZU, questId: Q_KUDZU, requires: [P3, { beatMark: "ag_caravan_route" }], hexName: "Port Kudzu", priority: "high", choices: [
        ch("Ride as cargo.", "wt_cult_camp", { checkStat: "intrigue", checkDC: 12, failNext: "wt_caravan_ride_fail", description: "You are salt. You are very convincing salt." }),
        ch("Ride up front and talk.", "wt_cult_camp", { checkStat: "presence", checkDC: 12, failNext: "wt_caravan_ride_fail", description: "The driver has never once been talked to on this run. He has a LOT to say about wax." }),
        ch("Follow it on foot.", "wt_cult_camp", { description: "Two days. You arrive after the wagon and before anyone looks up." })
      ] }),
    beat("wt_caravan_ride_fail", "Port Kudzu — Not Salt",
      "You are not, on inspection, salt. The driver puts you down a mile out with real courtesy and a bag of flour for your trouble, and the wagon goes on coastward without slowing, and you walk back to a port that smells of fewer dead fish than it should.",
      { type: "narration", story: KUDZU, questId: Q_KUDZU, requires: [P3], choices: [ch("Back to the port. Next third market.", "map_port_kudzu_intro")] }),
    beat("wt_cult_camp", "The Camp on No Map",
      "It is a stretch of nothing that gets visited far too regularly to be nothing: tents in rows, a kettle, and a gate that is not a gate yet, lying sideways in the sand the way a Valhaulan ship lands when it means to. The wagon unloads. Nobody counts the salt. A road-worn man in a walker's coat is checking the sky against a schedule, and he is exactly on time, and he is proud of nothing else.",
      { speaker: sp("Pilgrim Wick"), story: { ...KUDZU, role: "ending", ending: "caravan" }, questId: Q_KUDZU, requires: GATE_CAMP, offer: false, priority: "high", timePoints: 1,
        memoryText: "The Stewards rode the Jackalope supply wagon to the cult's camp on the coast and saw the gate lying sideways in the sand.",
        questEffects: [{ action: "complete", questId: Q_KUDZU, beatId: "", state: "completed", text: "Port Kudzu — the back way: the Stewards rode the wagon to the camp." }],
        choices: [
          ch("\"The kettle.\"", "", { requires: { beatMark: "ag_pipeline_backward" }, description: "He answers as if to Tamsin: the schedule, the heading, the next collection. Then he recites scripture and asks to be allowed to continue on foot." }),
          ch("Watch the camp.", "", { checkStat: "mind", checkDC: 12, failNext: "wt_caravan_ride_fail", description: "The gate lies sideways because it lands sideways. Seven positions on its ring. Six of them are lit." }),
          ch("Ask Wick what he's proud of.", "", { description: "\"I have never once been late.\" Ask what the camp is proud of and he does not understand the question." }),
          ch("Get out before the count.", "map_legansus_waystation_intro", { description: "Legansus will want all of this. Bring everything." })
        ] }),
    beat("wt_legansus_sequence", "Legansus Waystation — Seven Positions",
      "You show them the fold. Captain Robot does not touch it; a Rider photographs it and the relay tower thinks about it for eleven seconds, which for the relay is a long time. \"THIS IS A GATE ORDER,\" he says. \"NOT A MESSAGE. AN ORDER. IT HAS A HEADING.\" He gives you the heading. He does not wink. \"DO NOT BE ALARMED. BE ACCURATE.\"",
      { speaker: sp("Captain Robot"), story: LEG, questId: Q_LEG, requires: [P3, { beatMark: "ag_pipeline_backward" }], priority: "high",
        memoryText: "The Circuit Riders at Legansus verified the seven positions as a Leygate activation order and gave the Stewards its heading.",
        choices: [ch("Take the heading. Verified.", "map_legansus_waystation_verified", { description: "A fourth way in. You could arrive there instead of walking." })] })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  const addChoice = (id, c, what) => edit(id, b => { if (!(b.choices || []).some(x => x.label === c.label)) b.choices = [...(b.choices || []), c]; }, what);
  const refail = (id, from, to) => edit(id, b => { for (const c of b.choices || []) if (c.failNext === from) c.failNext = to; }, `fails → ${to}`);
  refail("map_burnt_flats_intro", "map_burnt_flats_partial", "wt_flats_mud");
  refail("map_singing_mire_intro", "map_singing_mire_partial", "wt_mire_static");
  refail("map_anchor_reach_intro", "map_anchor_reach_break", "wt_reach_slip");
  refail("map_port_kudzu_intro", "map_port_kudzu_partial", "wt_kudzu_rebuff");
  // the two skips become endings; the dead "look around" gets a door
  edit("map_burnt_flats_intro", b => { for (const c of b.choices || []) if (/^leave/i.test(c.label) && c.next === "map_singing_mire_intro") { c.next = "map_burnt_flats_partial"; c.description = "You leave with the smell and one clue you didn't earn."; } }, "Leave → partial ending");
  edit("map_anchor_reach_intro", b => { for (const c of b.choices || []) if (/mark the site/i.test(c.label)) c.next = "map_anchor_reach_marked"; }, "Mark the site → its own ending");
  edit("map_port_kudzu_intro", b => { for (const c of b.choices || []) if (/look around/i.test(c.label) && !c.next) { c.next = "wt_kudzu_saloon"; c.description = "The saloon. It smells of fewer dead fish than you'd think."; } }, "look around → the saloon");
  // Burnt Flats beats belong to their own chapter bucket
  for (const id of ["map_burnt_flats_intro", "map_burnt_flats_pattern", "map_burnt_flats_partial"]) edit(id, b => { if (b.questId === Q_MAIN) b.questId = Q_FLATS; for (const q of (b.worldEffects?.questEffects || [])) if (q.questId === Q_MAIN) q.questId = Q_FLATS; }, "questId → quest_burnt_flats");
  // the receipt at the testimony
  edit("map_port_kudzu_testimony", b => { b.speakerActorId = b.speakerActorId || sp("Captain Orrin Blask") || null; b.worldEffects = b.worldEffects || {}; if (!(b.worldEffects.receipts || []).some(r => r.label === "The Sideways Manifest")) b.worldEffects.receipts = [...(b.worldEffects.receipts || []), { label: "The Sideways Manifest", effectKey: "rollPlus2", acquisition: "earned", source: { name: "Captain Orrin Blask, who keeps paper" }, truth: "Chapel-marked cargo with inland handling codes on river paper: the water went sideways on a schedule, and somebody billed for it. Corroboration for the Circuit Riders at Legansus; a match for Kickflip's camcorder clip at Crown Mall." }]; }, "receipt THE SIDEWAYS MANIFEST + Blask speaks");
  // Legansus: verification as a receipt exchange
  const file = (label, mark, desc) => ch(label, "map_legansus_waystation_verified", { requires: { beatMark: mark }, description: desc });
  edit("map_legansus_waystation_intro", b => {
    b.speakerActorId = b.speakerActorId || sp("Captain Robot") || null;
    const adds = [
      file("File the caravan route.", "ag_caravan_route", "Arvind reads it. Simone times it. A Rider writes VERIFIED on a slate and does not underline it, because underlining is theatrics."),
      file("File the sideways manifest.", "map_port_kudzu_testimony", "\"A CAPTAIN KEEPS PAPER,\" says Captain Robot. \"WE RESPECT PAPER.\""),
      file("File the camcorder clip.", "mall_watch_clip", "The relay tower watches the whole thing, twice, and the second time it watches the four seconds underneath."),
      file("File the dropped manifest.", "kt_dropped_manifest", "Howard reads the names. Howard says nothing. That is how you know they are verified."),
      file("File the parade permit.", "stillwater_parade_permit", "A dated municipal document. Dennis is delighted. \"THAT IS A DATE. THAT IS A REAL DATE.\""),
      ch("Show them the seven positions.", "wt_legansus_sequence", { requires: { beatMark: "ag_pipeline_backward" } })
    ];
    for (const c of adds) if (!(b.choices || []).some(x => x.label === c.label)) b.choices.push(c);
  }, "filings + the seven positions");
  // voices
  const voice = (ids, name) => { for (const id of ids) edit(id, b => { if (!b.speakerActorId && sp(name)) b.speakerActorId = sp(name); }, `speaker ${name}`); };
  voice(["map_legansus_waystation_verified", "map_legansus_waystation_flagged"], "Captain Robot");
  voice(["map_anchor_reach_intro", "map_anchor_reach_stabilize", "map_anchor_reach_break"], "Sable 9");
  voice(["map_rotating_chapel_approach", "map_rotating_chapel_map", "map_rotating_chapel_force", "map_rotating_chapel_harmonize"], "Brother Ansel Vey");
  voice(["map_port_kudzu_intro", "map_port_kudzu_partial"], "Harbourmaster Dot Pellew");
  // the wagon door hangs off the Reach's endings and the port
  for (const id of ["map_anchor_reach_stabilize", "map_anchor_reach_break", "map_anchor_reach_marked", "map_port_kudzu_intro"]) addChoice(id, ch("You know when the wagon leaves. Be on it.", "wt_caravan_ride", { requires: { beatMark: "ag_caravan_route" } }), "the wagon (hidden)");
  // REVIEW FIXES 2026-10-01 — reconcile (additive: adds missing conditions / alternatives, never removes one)
  const ensureReq = (b, conds) => { b.inject = b.inject || {}; const cur = Array.isArray(b.inject.requires) ? b.inject.requires.slice() : (b.inject.requires && typeof b.inject.requires === "object" ? [b.inject.requires] : []); const have = new Set(cur.map(c => JSON.stringify(c))); for (const c of conds) if (!have.has(JSON.stringify(c))) { cur.push(c); have.add(JSON.stringify(c)); } b.inject.requires = cur; };
  const ensureAlt = (b, among, add) => { const rs = Array.isArray(b.inject?.requires) ? b.inject.requires : []; const grp = rs.find(x => Array.isArray(x?.anyOf) && x.anyOf.some(y => among.includes(y?.beatMark))); if (!grp) return false; for (const m of add) if (!grp.anyOf.some(y => y?.beatMark === m)) grp.anyOf.push({ beatMark: m }); return true; };
  for (const [id, gate] of Object.entries(ROUTE_ONLY)) edit(id, b => { ensureReq(b, gate); if (b.dialogueOffer !== false) b.dialogueOffer = false; }, "routing-only ending: gated on its route + chapter open; dialogueOffer:false");
  for (const a of NEXT_START_ALTS) edit(a.id, b => { if (!ensureAlt(b, a.among, a.add)) say(`✗ ${a.id}: no anyOf over ${a.among.join("/")} — gate NOT widened (check by hand)`); }, `start gate also opens on ${a.add.join(", ")}`);

  // story script
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {}, scripts: {} };
  const codeQuest = code.quests?.[KEY], codeScript = code.scripts?.[KEY];
  if (!codeQuest || !codeScript) say("✗ code story for widening_trail not readable — story script NOT written (hard-reload and re-run)");
  const QUEST = codeQuest ? JSON.parse(JSON.stringify(codeQuest)) : null;
  const SCRIPT = codeScript ? JSON.parse(JSON.stringify(codeScript)) : null;
  if (SCRIPT) {
    const lines = { chapel: "A chapel on the coast road turns to face what it's looking at. Go stand where it's looking. Mind the man with the broom.", flats: "The Flats should be cold. They aren't. Read the heat before you read the map, and don't stand still.", mire: "The marsh sings when somebody lies. Each of you will hear a different line. Decide who's telling the truth before you go in.", anchor: "At low tide the harbor floor is a diagram and one of the pilings has shoulders. Sable is bringing a chair. Close the triangle.", kudzu: "Port Kudzu floats on invoices. The saloon smells of fewer dead fish than you'd think. Buy, charm, or steal the story.", legansus: "The Circuit Riders at Legansus will verify you or file you. Bring everything. Everything counts." };
    for (const s of SCRIPT.steps) if (lines[s.id]) s.line = lines[s.id];
    const doors = [
      { id: "keeper", label: "The Keeper", line: "A man with a broom is losing an argument with a floor plan. Ask him which way it faced that night.", beats: ["wt_chapel_keeper"] },
      { id: "saloon", label: "Fewer Dead Fish Smell", line: "The harbourmaster keeps a ledger of everything that leaves. Ask what never comes back full.", beats: ["wt_kudzu_saloon"] },
      { id: "wagon", label: "Ride the Wagon", line: "If you know when the wagon leaves, be on it. You are salt. Be convincing salt.", beats: ["wt_caravan_ride"] },
      { id: "camp", label: "The Camp on No Map", line: "Where the wagon goes. Wick will be on time. Say the kettle.", beats: ["wt_cult_camp"] }
    ];
    for (const d of doors) if (!(SCRIPT.doors || []).some(x => x.id === d.id)) SCRIPT.doors = [...(SCRIPT.doors || []), d];
    if (SCRIPT.chapters?.port_kudzu) SCRIPT.chapters.port_kudzu.line = "Testimony costs money, patience, or a stolen manifest. Or ride the wagon and skip the receipt.";
  }
  const haveData = storyApi?.get?.(campaignId) || {};
  const questChanged = QUEST && JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST);
  let scriptChanged = SCRIPT && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || questChanged);
  // REVIEW 2026-10-01: never clobber live story data edited after seeding (✦ Script editor, a wordsmithing pass, a dated patch macro). Write only
  // when the live quest+script are missing, still the plain code copy, or already this output; anything else is reported and left alone.
  { const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null), lS = haveData.scripts?.[KEY], lQ = haveData.quests?.[KEY];
    if (scriptChanged && !((!lS || same(lS, codeScript) || same(lS, SCRIPT)) && (!lQ || same(lQ, codeQuest) || same(lQ, QUEST)))) { scriptChanged = false; say(`⚠ story script ${KEY}: live campaign.story was edited after seeding — NOT overwritten (repair seeded worlds with the dated patch-*-review-fixes macros)`); } }
  if (scriptChanged) { changes++; say(`✦ story script widening_trail → campaign.story (${SCRIPT.steps.length} steps, ${SCRIPT.doors.length} doors)`); } else if (SCRIPT) say("· ok story script (already)");

  console.log(`[seed-widening-trail-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Widening Trail retrofit DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Widening Trail retrofit: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-trail-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  ui.notifications.info(`Widening Trail retrofit APPLIED: ${changes} change(s). You are salt. F5.`);
})();

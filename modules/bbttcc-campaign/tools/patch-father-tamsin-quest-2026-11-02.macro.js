/**
 * patch-father-tamsin-quest-2026-11-02.macro.js — Dave, 11-02, at the end of the click-through's Act 2:
 *   "FT Quest - yes … Let's have Wick slip away, yes! … Tailing works!" · "the camp bust should be the Big Climax for act 2, so yes on
 *   gating" · "let's not collar him - but why do we just let him go without a challenge?" · spy dial "is the right shape".
 *
 * Live-caught: Tamsin's whole spy arc (the third candle → the confessor's debt → the pipeline → Pactkeeper) was BUILT but unreachable —
 * it lived in two chapters of the Allesh-Gilliam quest, which closes with Pike, so the NOW card never showed it; the third candle had no
 * route in; the Act 2 camp did not exist (the cult camp was an Act 3 Widening Trail look-and-leave).
 *
 * 1. FATHER TAMSIN — his own quest (`father_tamsin`, registry quest_father_tamsin). The Confessor's Debt and The Pipeline move out of
 *    Allesh-Gilliam with their registry ids (every gate keeps working); a new chapter The Camp on the Switchbacks (quest_ft_camp).
 *    His Act 2 beats (conversation, dreams, Wick questions, the pour) are re-filed to it; the Act 1 welcome stays Allesh-Gilliam's.
 *    Script: candle → confront → pipeline (optional) → camp → terms (optional). No quest-level closer: nothing in it ever seals.
 * 2. DOORS IN — St Gilliam's door offers "The third candle from the door has moved" (the dead drop's own gates) and "Sit down. The tea
 *    is already poured." (after the drop, until an ending); the Lift Hall door offers the camp once the galleries have shown it.
 * 3. THE TAIL (why the table lets Wick go) — the courier beats gain "Let him pass, and follow him up" (intrigue 13). The choice says why:
 *    he has never once been late, and a courier who misses a drop is louder than any alarm. Hit = his schedule (the camp unwarned);
 *    miss = he looks back (the camp is warned).
 * 4. THE SPY DIAL, read at the camp — exposed → the camp half-scattered · fed careful truths (counterfeit) → surprise · tail spotted, or
 *    Tamsin never confronted (left in place) → warned · redeemed / handed to Pike → quiet. One "Go up." choice per state (exclusive
 *    requires) routes to that state's beat; each offers Violence (a story fight on the Valhaulan Barracks map) / Intrigue / Parley at
 *    the state's DCs. Taking the camp → What to do with them: Jail (Calder's lockup) / Recruit the willing (Brakk) / Break the camp.
 *    WICK SLIPS AWAY every time (he left at 6:40; he always leaves at 6:40). The reckoning carries the outward pointer: The Gate
 *    Sequence + The Caravan Ledger receipts.
 * 5. ACT 3 GATE — a3_title_card also needs the camp dealt with. Pactkeeper / the route-only ending come after the camp.
 * 6. EXPOSED still finds the route — from Etta, at a price (15 economy marks, ag_market_caravan_paid).
 * 7. WHO KNOWS WHAT — the Upper Galleries no longer say "the camp of Tamsin's employer" (nothing has told the table Tamsin has one).
 *    The Act 3 camp (wt_cult_camp) knows the bust happened: Wick has put it back up on the old pegs.
 * Draft-1 prose; encounter actor "Raider Marauder 1" is a PLACEHOLDER (no Valhaulan cell actor exists).
 * No quest-level closer on purpose: closing would skip the terms step (Pactkeeper comes AFTER the camp); every beat is evergreen.
 * Pure apply(camp) + Foundry runner. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const FATHER_TAMSIN_PATCH = (() => {
  const Q = "father_tamsin", QREG = "quest_father_tamsin", CAMP_REG = "quest_ft_camp";
  const AG_REG = "quest_Cq1v3hJpXarX5rXJ";
  const ENDINGS = ["ag_confessor_redeemed", "ag_confessor_exposed", "ag_confessor_pike", "ag_confessor_counterfeit"];
  const DONE = ["ft_camp_jailed", "ft_camp_recruited", "ft_camp_broken"];
  const BARRACKS = "K1bI4KnNBwKALHN6";
  const TALLOW_HITS = ["ag_tallow_wick_routes_hit", "ag_tallow_flame_hit", "ag_tallow_pilgrim_hit", "ag_tallow_courier_hit", "ag_tallow_seal_hit", "ag_tamsin_wick_slip_hit", "ag_wick_seen"];
  const mark = (id) => ({ beatMark: id }), not = (id) => ({ beatMark: id, not: true }), anyMark = (ids) => ({ anyOf: ids.map(mark) });
  const P2 = { flag: "storyPhase", gte: 2 };
  const ch = (label, next, description = "", extra = {}) => ({ label, next, description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const chk = (label, stat, dc, next, failNext, description = "", extra = {}) => ch(label, next, description, { checkStat: stat, checkDC: dc, failNext, ...extra });
  const fe = (o) => ({ factionId: "@coalition", moraleDelta: 0, loyaltyDelta: 0, unityDelta: 0, darknessDelta: 0, opDeltas: {}, allowOvercap: false, ...o });
  const beat = (id, label, description, choices, o = {}) => ({
    id, label, type: o.type || "dialog", timeScale: "scene", timePoints: 0, questId: o.questId ?? QREG, tags: o.tags || "", politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: o.repeatable === true, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires: o.requires || [P2], evergreen: true },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: "", priority: "background", story: o.story || { quest: Q }, choices, worldEffects: o.worldEffects || {}, sceneId: o.sceneId || "",
    ...(o.where ? { where: o.where } : {}), ...(o.encounter ? { encounter: o.encounter } : {})
  });
  const WICK_SLIPS = " Wick is not in the count. Somebody checks twice. He left at 6:40, which is when he always leaves, by the path he always takes, and nobody thought to stop a man for being on time.";

  // ── the tail ──
  const TAIL_WHY = "He has never once been late. Grab him and the camp counts the minutes he doesn't arrive — a courier who misses a drop is louder than any alarm. Follow him instead.";
  const TAIL_HIT = "Four switchbacks behind him, then three. He never looks back; looking back would cost him four seconds, and the seconds are spoken for. At the toll post he pays exact and the coin changes hands without a word. At the top he checks the sky against a schedule, and the camp's watch changes the minute he walks in — not before, not after. You have his clock now. A camp that runs on one man's punctuality is a camp that can be walked into between two of his minutes.";
  const TAIL_MISS = "At the third switchback he stops, takes out a pocket watch, and — for the first time in anyone's memory — looks back. Straight down the path, straight at you. He lifts one hand, politely, the way you acknowledge a stranger on a narrow stair, and walks on a little faster. He is still on time. The camp will hear about you before you've finished climbing down.";

  // ── the camp ──
  const CAMP_BASE = "Up past the numbered levels, past the toll post, to the stretch of scree the courier's route ends at: tents in neat rows, shielded plating mounted in courses along the old access shaft, tools racked, wards glowing the same directional glow as the seal. They sing at the wrong hours, quietly, in a working rhythm. ";
  const CAMP_DIAL = "{{#played ag_confessor_exposed}}Half the tents are empty and the kettle is cold. Allesh-Gilliam said it out loud, so the mountain heard it too — the ones who could leave have left, and the ones who stayed are the ones who'd rather die believing.{{else}}{{#played ag_confessor_counterfeit}}The camp is relaxed in the particular way of people who were told, by their most trusted source, that the Stewards are busy until Thursday. It is Tuesday.{{else}}{{#played ft_tail_miss}}The wards are up and lit, the watch is doubled, and someone has strung bells on a wire across the path. They are expecting a person who walks like you.{{else}}{{#played ag_confessor_redeemed|ag_confessor_pike}}The confessor's reports stopped a week ago, and nobody up here has decided yet whether that is worrying. The watch changes when the courier walks in, and not before.{{else}}The wards are up and the watch is doubled. Somebody in Allesh-Gilliam is still writing letters — every errand you ran in town arrived here a day before you did.{{/played}}{{/played}}{{/played}}{{/played}}";
  const QUIET = "The camp, on an ordinary working night. The watch changes when the courier walks in. The wards hum. Somebody is singing at the wrong hour.";
  const SURPRISE = "Nobody is watching the path. The bells on the wire have been taken down for cleaning. The camp believes, on the best authority it has, that you are somewhere else entirely.";
  const WARNED = "Bells on a wire across the path. Wards lit and turned outward. Twice the watch, all of them looking down the mountain at exactly where you're standing — or near enough.";
  const SCATTERED = "Half a camp. The ones who stayed are banking the fires and checking the wards with the slow care of people who have decided this is the hill.";
  const TAKEN_FORCE = "It's loud, and then it isn't. The wards gutter out one by one as the hands that kept them stop keeping them. The ones still standing put their tools down in neat rows, because even now they can't put a tool down any other way." + WICK_SLIPS;
  const TAKEN_QUIET = "The wards go dark in the wrong order and nobody can say why. The salt has gone bad in a way salt cannot go bad. By the time the camp works out it has been undone from the inside, there is nothing left to defend but a kettle, and they are not, it turns out, kettle people." + WICK_SLIPS;
  const TURNED = "You tell them where the seal points. Not that it is wrong — that it is AIMED. You show them what you found under the mountain, and they listen the way engineers listen to a bad number: politely, then very quietly, then all at once. Some of them sit down where they stand. One of them starts taking a ward apart with her own hands, carefully, the way she was taught to put it together." + WICK_SLIPS;
  const CAUGHT = "A ward wakes under your hand like a dog that was only pretending to sleep. Bells. Lanterns. A great deal of very organised shouting.";
  const PARLEY_FAIL = "They hear you out. They are, to a person, courteous about it. Then the woman at the kettle rings a bell, once, without any hurry at all, and the camp stands up.";
  const FIGHT_LOST = "Too many, too well-drilled, on ground they've measured to the inch. You get down the switchbacks with everyone you came up with, which tonight counts as winning. The camp is still there. So is the path.";
  const RECKONING = "The camp is yours. What's left of it sits in rows on the scree — technicians, mostly, and a cook, and two people who were only here for the singing. In the courier's tent: a ledger in a hand nobody up here writes, every caravan day for a year and where it went after the camp — and, folded into the back, a sequence of numbers that is not a schedule. It's the kind of thing you'd use to tell a gate where you want it to open.";
  const JAILED = "Calder takes them with a face like a man accepting a delivery he did not order and will absolutely be invoicing. The lockup at Khezek-Tor has room. It has been waiting for a reason to have room.";
  const RECRUITED = "Brakk walks the line twice, picks the ones who can carry a pack and keep a secret, and doesn't ask what they believed last week. \"Belief's cheap,\" he says. \"Punctual is rare.\" The rest go down to Calder's lockup.";
  const BROKEN = "You break the camp: plating off the shaft, wards in the scree, tents in the fire. Then you send them down the mountain with nothing, which is what they had before they met the people who paid for all of this. Some of them will go home. Some of them will go looking for the courier.";
  const PAID = "Etta has heard what happened at St Gilliam's, because everyone has. \"I liked him,\" she says, and sells you the preserves first anyway, and then names a price for the rest — not an unkind one, and not a small one.";
  const GALLERIES_OLD = "the camp of Tamsin's employer", GALLERIES_NEW = "the camp at the end of the courier's route";
  const WT_ALT = "The camp is back, which is the strange part: new tents on the old pegs, the same kettle, and a gate lying sideways on the scree that was not here the night you emptied the place. The wagon unloads. Nobody counts the salt. A road-worn man in a walker's coat is checking the sky against a schedule, and he is exactly on time.";

  const MOVE = (b) => {
    const id = String(b.id || ""); const st = b.story || {};
    if (st.chapter === "the_confessor_s_debt" || st.chapter === "the_pipeline") return true;
    if (/^allesh_gilliam_father_tamsin_conversation/.test(id) || /^ag_tamsin_the_dream/.test(id)) return true;
    if (/^ag_tamsin_(on_wick|wick_)/.test(id) || /^ans_ag_confessor_/.test(id) || /^ans_ag_pipeline_/.test(id)) return true;
    return false;
  };

  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const byId = new Map(beats.map(b => [String(b?.id), b]));
    const report = [], conflicts = []; let changes = 0;
    const need = ["ag_confessor_dead_drop", "ag_tamsin_confrontation", "ag_pipeline_backward", "ag_market_caravan_route", "ag_caravan_route", "ag_tamsin_pactkeeper", "ag_pipeline_route_only", "ag_confessor_exposed", "kt_courier_has_a_face", "ag_tallow_courier_hit", "khezek_upper_galleries", "khezek_tor_the_lift_hall", "allesh_gilliam_st_gilliams_cinematics", "a3_title_card", "wt_cult_camp"];
    for (const id of need) if (!byId.has(id)) conflicts.push(`${id}: beat not found`);
    const story = camp.story = camp.story || {}; story.quests = story.quests || {}; story.scripts = story.scripts || {};
    const agQ = story.quests.allesh_gilliam, agS = story.scripts.allesh_gilliam;
    if (!agQ || !agS) conflicts.push("campaign.story allesh_gilliam quest/script not found");
    if (conflicts.length) return { changes, report, conflicts };
    const did = (msg) => { changes++; report.push("✚ " + msg); };
    const addBeat = (nb) => { if (byId.has(nb.id)) { report.push(`· ok beat ${nb.id}`); return byId.get(nb.id); } beats.push(nb); byId.set(nb.id, nb); did(`beat ${nb.id}`); return nb; };
    const addChoice = (b, c, beforeRe = null) => { b.choices = Array.isArray(b.choices) ? b.choices : []; if (b.choices.some(x => x && x.label === c.label && x.next === c.next && JSON.stringify(x.requires || null) === JSON.stringify(c.requires || null))) { report.push(`· ok ${b.id} "${c.label}"`); return; } const at = beforeRe ? b.choices.findIndex(x => x && beforeRe.test(String(x.label || ""))) : -1; if (at >= 0) b.choices.splice(at, 0, c); else b.choices.push(c); did(`${b.id}: "${c.label}"`); };
    const addReq = (b, r, tag) => { b.inject = b.inject || {}; const rs = Array.isArray(b.inject.requires) ? b.inject.requires : (b.inject.requires = []); if (rs.some(x => JSON.stringify(x) === JSON.stringify(r))) { report.push(`· ok ${b.id} ${tag}`); return; } rs.push(r); did(`${b.id}: requires ${tag}`); };

    // 1 — the quest
    const debtCh = agQ.chapters?.the_confessor_s_debt || { name: "The Confessor's Debt", registryId: "quest_ag_confessors_debt" };
    const pipeCh = agQ.chapters?.the_pipeline || { name: "The Pipeline", registryId: "quest_ag_pipeline" };
    if (!story.quests[Q]) { story.quests[Q] = { name: "Father Tamsin", act: 2, keystone: false, hex: "Allesh-Gilliam", registryId: QREG, chapters: { the_confessor_s_debt: debtCh, the_pipeline: pipeCh, the_camp: { name: "The Camp on the Switchbacks", registryId: CAMP_REG } } }; did(`quest ${Q}`); } else report.push(`· ok quest ${Q}`);
    for (const k of ["the_confessor_s_debt", "the_pipeline"]) { if (agQ.chapters?.[k]) { delete agQ.chapters[k]; did(`allesh_gilliam quest: chapter ${k} moved to ${Q}`); } }
    const agChLines = agS.chapters || {};
    if (!story.scripts[Q]) {
      const tamsinDoor = (agS.doors || []).find(d => d && d.id === "tamsin");
      const debtDoor = (agS.doors || []).find(d => d && d.id === "debt"); const rung = (id) => (debtDoor?.rungs || []).find(r => r.id === id)?.line;
      story.scripts[Q] = {
        giver: "Father Tamsin, who pours the tea before you ask",
        description: "Father Tamsin keeps St Gilliam's, rations nothing, and is bad at metaphor. The tea is always poured before you ask. He looks, these days, like a man who is sleeping badly and pouring well, and the third candle from the door is never quite where you left it.",
        steps: [
          { id: "candle", label: "The Third Candle", chapter: "the_confessor_s_debt", where: "Allesh-Gilliam", line: rung("candle") || "The third candle from the door has moved a finger-width. Check the drip tray. Try not to enjoy this.", beats: ["ag_confessor_dead_drop"] },
          { id: "confront", label: "The Confessor's Debt", chapter: "the_confessor_s_debt", where: "Allesh-Gilliam", line: agChLines.the_confessor_s_debt?.line || "The tea is already poured. That's how you know. Go and see Father Tamsin, and decide what justice looks like.", beats: ["ag_tamsin_confrontation"], done: { anyOf: ENDINGS } },
          { id: "pipeline", label: "Run the Channel Backward", chapter: "the_pipeline", where: "Allesh-Gilliam", optional: true, line: agChLines.the_pipeline?.line || "Three headings came down the mountain: a caravan, a camcorder, a sequence. Start with the one Etta already knows about.", beats: ["ag_pipeline_backward", "ag_market_caravan_route"], done: { mark: "ag_caravan_route" } },
          { id: "camp", label: "The Camp on the Switchbacks", chapter: "the_camp", where: "Khezek-Tor", line: "Up past the numbered levels, where the courier's route ends. Take the camp: by force, from the inside, or by telling them where the seal really points.", beats: ["ft_camp_approach"], done: { anyOf: DONE } },
          { id: "terms", label: "The Man Who Reads the Terms", chapter: "the_pipeline", where: "Allesh-Gilliam", optional: true, line: "The camp is down. Go back to St Gilliam's. Father Tamsin wants to read the terms.", beats: ["ag_tamsin_pactkeeper", "ag_pipeline_route_only"], done: { anyOf: ["ag_tamsin_pactkeeper", "ag_pipeline_route_only", "ag_confessor_exposed"] } }
        ],
        doors: tamsinDoor ? [tamsinDoor] : [],
        after: [],
        chapters: { the_confessor_s_debt: agChLines.the_confessor_s_debt || { giver: "the third candle" }, the_pipeline: agChLines.the_pipeline || { giver: "Father Tamsin" }, the_camp: { giver: "the courier's route", line: "Up past the numbered levels, where the courier's route ends. Take the camp." } }
      };
      did(`script ${Q} (candle → confront → pipeline → camp → terms)`);
    } else report.push(`· ok script ${Q}`);
    const beforeDoors = (agS.doors || []).length; agS.doors = (agS.doors || []).filter(d => !(d && ["tamsin", "debt", "pipeline"].includes(d.id)));
    if (agS.doors.length !== beforeDoors) did(`allesh_gilliam script: ${beforeDoors - agS.doors.length} Tamsin door(s) moved to ${Q}`);
    for (const k of ["the_confessor_s_debt", "the_pipeline"]) if (agS.chapters?.[k]) { delete agS.chapters[k]; did(`allesh_gilliam script: chapter line ${k} moved`); }
    let moved = 0;
    for (const b of beats) { if (!b || !MOVE(b)) continue; const st = b.story || {}; if (st.quest === Q) continue; b.story = { ...st, quest: Q }; if (!b.questId || b.questId === AG_REG) b.questId = QREG; b.inject = b.inject || {}; b.inject.evergreen = true; moved++; }
    if (moved) did(`${moved} Tamsin beat(s) re-filed to ${Q} (evergreen)`); else report.push("· ok Tamsin beats filed");

    // 3 — the tail
    addBeat(beat("ft_tail_hit", "Khezek Tor — Four Switchbacks Behind Him", TAIL_HIT, [ch("Back down before the count.", "")], { story: { quest: Q, chapter: "the_camp" }, where: "Khezek-Tor" }));
    addBeat(beat("ft_tail_miss", "Khezek Tor — He Looks Back", TAIL_MISS, [ch("Back down.", "")], { story: { quest: Q, chapter: "the_camp" }, where: "Khezek-Tor" }));
    const tail = chk("Let him pass, and follow him up.", "intrigue", 13, "ft_tail_hit", "ft_tail_miss", TAIL_WHY, { requires: [not("ft_tail_hit"), not("ft_tail_miss")] });
    for (const id of ["kt_courier_has_a_face", "ag_tallow_courier_hit"]) addChoice(byId.get(id), { ...tail }, /^you know this man|^you don't know him/i);

    // 4 — the camp
    const S_EXPOSED = [mark("ag_confessor_exposed")];
    const S_SURPRISE = [mark("ag_confessor_counterfeit"), not("ag_confessor_exposed")];
    const S_QUIET = [not("ag_confessor_exposed"), not("ag_confessor_counterfeit"), not("ft_tail_miss"), anyMark(["ag_confessor_redeemed", "ag_confessor_pike"])];
    const S_WARN_TAIL = [not("ag_confessor_exposed"), not("ag_confessor_counterfeit"), mark("ft_tail_miss")];
    const S_WARN_LEFT = [not("ag_confessor_exposed"), not("ag_confessor_counterfeit"), not("ft_tail_miss"), not("ag_confessor_redeemed"), not("ag_confessor_pike")];
    const notDone = DONE.map(not);
    const campStory = { quest: Q, chapter: "the_camp" };
    const OPEN = { questBucket: CAMP_REG, isNot: "completed" };   // the camp's working beats close with the chapter (lint X04)
    addBeat(beat("ft_camp_approach", "Khezek Tor — The Camp on the Switchbacks", CAMP_BASE + CAMP_DIAL, [
      ch("Go up.", "ft_camp_scattered", "", { requires: S_EXPOSED }),
      ch("Go up.", "ft_camp_surprise", "", { requires: S_SURPRISE }),
      ch("Go up.", "ft_camp_quiet", "", { requires: S_QUIET }),
      ch("Go up.", "ft_camp_warned", "", { requires: S_WARN_TAIL }),
      ch("Go up.", "ft_camp_warned", "", { requires: S_WARN_LEFT }),
      ch("Not yet. Back down.", "")
    ], { story: { quest: Q, chapter: "the_camp", role: "start" }, repeatable: true, where: "Khezek-Tor", sceneId: BARRACKS, requires: [P2, mark("khezek_upper_galleries"), ...notDone], worldEffects: { questEffects: [{ action: "accept", questId: CAMP_REG, beatId: "", state: "active", text: "The camp on the switchbacks." }] } }));
    const approaches = (dcI, dcP, fight = "ft_camp_fight") => [
      ch("Hit the camp.", fight, "Violence. They're technicians, not soldiers — but they've drilled, and they're on their own ground."),
      chk("Cut the wards and spoil the salt.", "intrigue", dcI, "ft_camp_taken_quiet", "ft_camp_caught", "Undo it from the inside. A camp that runs on schedules breaks on a missed one."),
      chk("Walk in with your hands open and show them where the seal points.", "presence", dcP, "ft_camp_turned", "ft_camp_parley_fail", "They're engineers. Show them the number.")
    ];
    addBeat(beat("ft_camp_quiet", "Khezek Tor — The Camp, Working", QUIET, [...approaches(12, 13), ch("Not yet. Back down.", "")], { story: campStory, repeatable: true, sceneId: BARRACKS, requires: [P2, OPEN] }));
    addBeat(beat("ft_camp_surprise", "Khezek Tor — The Camp, Expecting Thursday", SURPRISE, [ch("They expect you Thursday. It is Tuesday.", "ft_camp_taken_quiet", "Walk in. The confessor told them you were busy."), ...approaches(10, 11), ch("Not yet. Back down.", "")], { story: campStory, repeatable: true, sceneId: BARRACKS, requires: [P2, OPEN] }));
    addBeat(beat("ft_camp_warned", "Khezek Tor — The Camp, Waiting for You", WARNED, [...approaches(15, 15, "ft_camp_fight_warned"), ch("Not yet. Back down.", "")], { story: campStory, repeatable: true, sceneId: BARRACKS, requires: [P2, OPEN] }));
    addBeat(beat("ft_camp_scattered", "Khezek Tor — Half a Camp", SCATTERED, [...approaches(11, 12), ch("Not yet. Back down.", "")], { story: campStory, repeatable: true, sceneId: BARRACKS, requires: [P2, OPEN] }));
    const enc = (count) => ({ key: null, tier: 2, actorName: "Raider Marauder 1", count, party: true });
    addBeat(beat("ft_camp_fight", "Khezek Tor — The Camp Stands Up", "The camp stands up. Tools become something else in practised hands.", [ch("They're down.", "ft_camp_taken_force"), ch("Too many — back down the switchbacks.", "ft_camp_fight_lost")], { type: "encounter", story: campStory, repeatable: true, sceneId: BARRACKS, encounter: enc(4), requires: [P2, OPEN] }));
    addBeat(beat("ft_camp_fight_warned", "Khezek Tor — The Camp Was Ready", "They were ready for you. Bells, lanterns, and twice the hands.", [ch("They're down.", "ft_camp_taken_force"), ch("Too many — back down the switchbacks.", "ft_camp_fight_lost")], { type: "encounter", story: campStory, repeatable: true, sceneId: BARRACKS, encounter: enc(6), requires: [P2, OPEN] }));
    addBeat(beat("ft_camp_fight_lost", "Khezek Tor — Down the Switchbacks", FIGHT_LOST, [ch("Back down.", "")], { story: campStory, repeatable: true, requires: [P2, OPEN] }));
    addBeat(beat("ft_camp_caught", "Khezek Tor — A Ward Wakes", CAUGHT, [ch("Then it's a fight.", "ft_camp_fight"), ch("Back off, fast.", "")], { story: campStory, repeatable: true, sceneId: BARRACKS, requires: [P2, OPEN] }));
    addBeat(beat("ft_camp_parley_fail", "Khezek Tor — One Bell", PARLEY_FAIL, [ch("Then it's a fight.", "ft_camp_fight"), ch("Back off, slowly.", "")], { story: campStory, repeatable: true, sceneId: BARRACKS, requires: [P2, OPEN] }));
    for (const [id, label, text] of [["ft_camp_taken_force", "Khezek Tor — The Camp Falls", TAKEN_FORCE], ["ft_camp_taken_quiet", "Khezek Tor — The Camp Comes Undone", TAKEN_QUIET], ["ft_camp_turned", "Khezek Tor — The Camp Reads the Number", TURNED]])
      addBeat(beat(id, label, text, [ch("Count them. Search the courier's tent.", "ft_camp_reckoning")], { story: campStory, sceneId: BARRACKS }));
    addBeat(beat("ft_camp_reckoning", "Khezek Tor — What to Do With Them", RECKONING, [
      ch("Jail them. Calder has a lockup and opinions.", "ft_camp_jailed"),
      ch("Take the willing. Brakk needs hands.", "ft_camp_recruited"),
      ch("Break the camp and send them down the mountain with nothing.", "ft_camp_broken")
    ], { story: campStory, sceneId: BARRACKS, worldEffects: { receipts: [
      { label: "The Gate Sequence", effectKey: "rollPlus2", acquisition: "earned", source: { name: "the courier's tent, the camp on the switchbacks" }, truth: "A sequence of numbers that is not a schedule: the activation order for a gate the cult has been keeping a heading for. With it, a table could arrive where the gate opens instead of walking there — and surprise whoever is waiting." },
      { label: "The Caravan Ledger", effectKey: "rollPlus2", acquisition: "earned", source: { name: "the courier's tent, the camp on the switchbacks" }, truth: "Every caravan day for a year, in the paymaster's copperplate: salt, wax, flour, no meat, two days up from the Long Market — and where the wagon went AFTER the camp. Coastward." }
    ] } }));
    const out = (id, label, text, fx, ending) => addBeat(beat(id, label, text, [ch("Back down the mountain.", "")], { story: { quest: Q, chapter: "the_camp", role: "ending", ending }, sceneId: BARRACKS, worldEffects: { factionEffects: [fe(fx)], questEffects: [{ action: "complete", questId: CAMP_REG, beatId: "", state: "completed", text: label.replace(/^Khezek Tor — /, "") }] } }));
    out("ft_camp_jailed", "Khezek Tor — Calder's Lockup", JAILED, { loyaltyDelta: 1 }, "jailed");
    out("ft_camp_recruited", "Khezek Tor — Brakk Walks the Line", RECRUITED, { darknessDelta: -1 }, "recruited");
    out("ft_camp_broken", "Khezek Tor — Down the Mountain With Nothing", BROKEN, { darknessDelta: 1 }, "broken");

    // the chain's own gates (live-caught: the Act 3 card's gate door offered the reckoning — its outcomes gated only on the act)
    const chainGate = (id, r, tag) => addReq(byId.get(id), r, tag);
    for (const id of DONE) chainGate(id, mark("ft_camp_reckoning"), "after the reckoning");
    chainGate("ft_camp_reckoning", anyMark(["ft_camp_taken_force", "ft_camp_taken_quiet", "ft_camp_turned"]), "after the camp falls");
    chainGate("ft_camp_taken_force", anyMark(["ft_camp_fight", "ft_camp_fight_warned"]), "after a fight");
    for (const id of ["ft_camp_taken_quiet", "ft_camp_turned", "ft_camp_caught", "ft_camp_parley_fail"]) chainGate(id, anyMark(["ft_camp_quiet", "ft_camp_surprise", "ft_camp_warned", "ft_camp_scattered"]), "after going up");
    for (const id of ["ft_camp_quiet", "ft_camp_surprise", "ft_camp_warned", "ft_camp_scattered"]) chainGate(id, mark("ft_camp_approach"), "after the approach");
    chainGate("ft_camp_fight", anyMark(["ft_camp_quiet", "ft_camp_surprise", "ft_camp_scattered", "ft_camp_caught", "ft_camp_parley_fail"]), "after going up");
    chainGate("ft_camp_fight_warned", mark("ft_camp_warned"), "after going up");
    chainGate("ft_camp_fight_lost", anyMark(["ft_camp_fight", "ft_camp_fight_warned"]), "after a fight");
    chainGate("ft_tail_hit", anyMark(["kt_courier_has_a_face", "ag_tallow_courier_hit"]), "after the courier");
    chainGate("ft_tail_miss", anyMark(["kt_courier_has_a_face", "ag_tallow_courier_hit"]), "after the courier");

    // 2 — doors in
    addChoice(byId.get("allesh_gilliam_st_gilliams_cinematics"), ch("The third candle from the door has moved.", "ag_confessor_dead_drop", "A finger-width to the left. Always after the same kind of visitor.", { requires: [P2, mark("khezek_upper_galleries"), mark("allesh_gilliam_etta_bloom_convo_exit"), anyMark(TALLOW_HITS), not("ag_confessor_dead_drop")] }));
    addChoice(byId.get("allesh_gilliam_st_gilliams_cinematics"), ch("Sit down. The tea is already poured.", "ag_tamsin_confrontation", "He knows why you're here. He poured for you anyway.", { requires: [P2, mark("ag_confessor_dead_drop"), ...ENDINGS.map(not)] }));
    addChoice(byId.get("khezek_tor_the_lift_hall"), ch("Up past the numbered levels — the camp on the switchbacks.", "ft_camp_approach", "Where the courier's route ends.", { requires: [P2, mark("khezek_upper_galleries"), ...notDone] }), /^leave$/i);

    // 5 — the Act 3 gate, and the terms come after the camp
    addReq(byId.get("a3_title_card"), anyMark(DONE), "the camp dealt with");
    addReq(byId.get("ag_tamsin_pactkeeper"), anyMark(DONE), "after the camp");
    addReq(byId.get("ag_pipeline_route_only"), anyMark(DONE), "after the camp");

    // 6 — exposed still finds the route, at a price
    const pb = byId.get("ag_pipeline_backward"); const any = (pb.inject?.requires || []).find(r => r && Array.isArray(r.anyOf) && r.anyOf.some(x => x?.beatMark === "ag_confessor_redeemed"));
    if (any && !any.anyOf.some(x => x?.beatMark === "ag_confessor_exposed")) { any.anyOf.push(mark("ag_confessor_exposed")); did("ag_pipeline_backward: opens after an exposure too"); } else report.push("· ok ag_pipeline_backward exposed");
    addChoice(byId.get("ag_confessor_exposed"), ch("Run it backward without him. Etta will want paying.", "ag_pipeline_backward", "The channel is burned. The caravan isn't."), /^leave$/i);
    addBeat(beat("ag_market_caravan_paid", "Allesh-Gilliam — Etta Names a Price", PAID, [ch("Pay it.", "ag_caravan_route")], { story: { quest: Q, chapter: "the_pipeline" }, worldEffects: { factionEffects: [fe({ opDeltas: { economy: -15 } })] } }));
    addReq(byId.get("ag_market_caravan_paid"), mark("ag_confessor_exposed"), "after an exposure");
    const mk = byId.get("ag_market_caravan_route");
    for (const c of mk.choices || []) if (c && /^just ask her/i.test(String(c.label || "")) && !(c.requires || []).some(r => r?.beatMark === "ag_confessor_exposed")) { c.requires = [...(c.requires || []), not("ag_confessor_exposed")]; did(`ag_market_caravan_route "${c.label}": not after an exposure`); }
    addChoice(mk, ch("Ask her what it costs.", "ag_market_caravan_paid", "After St Gilliam's, nothing in this market is free.", { requires: [mark("ag_confessor_exposed")] }));
    addChoice(byId.get("ag_caravan_route"), ch("Keep the route.", "", "", { requires: [mark("ag_confessor_exposed")] }));

    // the quest starts when the table first sits with him in Act 2, finds the candle, or walks up to the camp (lint Q06)
    for (const id of ["allesh_gilliam_father_tamsin_conversation", "ag_confessor_dead_drop", "ft_camp_approach"]) {
      const b = byId.get(id); b.worldEffects = b.worldEffects || {}; const qe = Array.isArray(b.worldEffects.questEffects) ? b.worldEffects.questEffects : (b.worldEffects.questEffects = []);
      if (qe.some(e => e && e.action === "accept" && e.questId === QREG)) { report.push(`· ok ${id} accepts ${QREG}`); continue; }
      qe.push({ action: "accept", questId: QREG, beatId: "", state: "active", text: "Father Tamsin." }); did(`${id}: accepts ${QREG}`);
    }

    // 7 — who knows what
    const g = byId.get("khezek_upper_galleries");
    if (String(g.description || "").includes(GALLERIES_OLD)) { g.description = g.description.replace(GALLERIES_OLD, GALLERIES_NEW); did("khezek_upper_galleries: \"the camp at the end of the courier's route\""); } else report.push("· ok galleries text");
    const wt = byId.get("wt_cult_camp"); const wtMark = "{{#played ft_camp_jailed|ft_camp_recruited|ft_camp_broken}}";
    if (!String(wt.description || "").startsWith(wtMark)) { wt.description = `${wtMark}${WT_ALT}{{else}}${wt.description || ""}{{/played}}`; did("wt_cult_camp: knows the camp was busted (Wick put it back up)"); } else report.push("· ok wt_cult_camp");
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = FATHER_TAMSIN_PATCH;                                // node: offline proof
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));   // true copy
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = FATHER_TAMSIN_PATCH.apply(camp);
  console.log(`[father tamsin quest 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__fatherTamsin = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-father-tamsin-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Father Tamsin has his own quest; the camp is the Act 2 climax.`);
})();

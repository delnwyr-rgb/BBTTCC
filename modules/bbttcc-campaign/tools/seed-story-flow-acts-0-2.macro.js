/**
 * seed-story-flow-acts-0-2.macro.js — GM macro/console. DRY_RUN default true.
 *
 * STORY FLOW ENCODE · PHASE C (2026-09-17). Every content ruling from the Acts 0–2 curation
 * (worksheet ~/STORY_FLOW_2026_09_15.md · plan ~/STORY_FLOW_ENCODE_PLAN_2026_09_16.md) that lives in
 * the WORLD rather than in code: registry text, gates and routes, the ruled rewrites, new beats,
 * removals, actor fixes and Receipt arming. The scripts themselves are code (scripts/story-scripts.js).
 *
 * Sections (each marker-guarded / idempotent; re-running reports "ok"):
 *   1. REGISTRY — giver + description on every quest/chapter row from the scripts; The Forgotten Cause
 *      named; The Long Table chapter row; the Confessor's description without the Weeping Prisoner.
 *   2. ALLESH-GILLIAM — Arrival doors sealed at Act 2 (storyPhase ≤ 1); the Muster from the HQ; Greeley's
 *      "room in the back" (the Night the Mountain Coughed); the two-nights rewrites; Garren's spanner +
 *      Joan's-key text; the Confessor reorder (Upper Galleries → Khezek-Tor; the candle's new gates; the
 *      confrontation's line; Brennig); the Offices' legacy complete row on "Wake up" removed.
 *   3. LYRENN / KHEZEK-TOR — arrival walks sealed; KT's day-one doors = the cookline; khezek_word_ride;
 *      the Brace + the Cough; the Upper Galleries door on the switchback.
 *   4. FIXIT — the acceptance stubs removed (effects carried); the stabilizer beat = the crate + the
 *      spanner check (+ fixit_no_spanner); the yard tour's exit; Mara's Counter loop; Dougan's four labels
 *      + Q4 pointer.
 *   5. CIRCUIT RIDERS — approach player-facing; observe → opening; nine answer beats route on; the three
 *      closers gated on the verification tally (meter crVerify: engine D-10); once resolved, not redrawn.
 *   6. TIFARET — The Tree's Session (three exchanges, the Obstructor, the tally, Harmonious-lite); the
 *      doubled faction rows deduped; the Forest NPC created + bound as speaker; once resolved, not redrawn.
 *   7. FORGOTTEN CAUSE — repair/redirect/break re-declared as The Long Table's ENDINGS; the summit success
 *      = the quest's CLOSER; the name-card reveal; Pip's summons → the Maneuver Vault; the grief-quartet
 *      capstone.
 *   8. BANDIT ACCORD / CADENCE — mercy gates; arms-down = rung 4 once; refuse no longer closes (the envoy
 *      returns); Ralph Maccio (she/her) on the five Bandit Lord beats; the Cadence floor's maneuver tag.
 *   9. ACTORS — "Drax Caulder" → "Drax Calder".
 *  10. RECEIPTS — persona arming (Simone / Arvind / Howard / Dennis / the Forest).
 *
 * Backups download before write (campaigns + quests), GM only.
 */
(async () => {
  const DRY_RUN = false;
  const NS = "bbttcc-campaign", MV = "bbttcc-mal-voice";
  const MARK = "[STORY-FLOW-C-2026-09-17]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0;
  const say = (s) => report.push(s);

  // ── load ───────────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  let regRaw = game.settings.get(NS, "quests");
  const regWasStr = typeof regRaw === "string";
  const reg = regWasStr ? JSON.parse(regRaw) : foundry.utils.deepClone(regRaw || {});
  const story = game.bbttcc?.api?.campaign?.story;
  const SCRIPTS = story?.QUEST_SCRIPTS || {}; const QM = story?.QUEST_MAP?.quests || {};
  if (!Object.keys(SCRIPTS).length) say("✗ no scripts on api.campaign.story — is story-scripts.js deployed? (registry text section will be skipped)");

  // ── helpers (idempotent) ───────────────────────────────────────────────────
  const plain = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const get = (id) => { const b = byId.get(id); if (!b) say(`✗ MISSING beat ${id}`); return b || null; };
  const reqsOf = (b) => { b.inject = (b.inject && typeof b.inject === "object") ? b.inject : {}; b.inject.requires = Array.isArray(b.inject.requires) ? b.inject.requires : (b.inject.requires ? [b.inject.requires] : []); return b.inject.requires; };
  const addGate = (id, cond) => { const b = get(id); if (!b) return; const rs = reqsOf(b); if (rs.some(c => JSON.stringify(c) === JSON.stringify(cond))) return say(`· ok ${id} gate ${JSON.stringify(cond)}`); rs.push(cond); changes++; say(`⛩ ${id}: +gate ${JSON.stringify(cond)}`); };
  const dropGate = (id, pred, label) => { const b = get(id); if (!b) return; const rs = reqsOf(b); const keep = rs.filter(c => !pred(c)); if (keep.length === rs.length) return say(`· ok ${id} (no ${label} gate)`); b.inject.requires = keep; changes++; say(`⛩ ${id}: −gate ${label}`); };
  const setGates = (id, list) => { const b = get(id); if (!b) return; reqsOf(b); if (JSON.stringify(b.inject.requires) === JSON.stringify(list)) return say(`· ok ${id} gates`); b.inject.requires = list; changes++; say(`⛩ ${id}: gates = ${JSON.stringify(list)}`); };
  const setInject = (id, k, v) => { const b = get(id); if (!b) return; reqsOf(b); if (b.inject[k] === v) return say(`· ok ${id} inject.${k}`); b.inject[k] = v; changes++; say(`⚙ ${id}: inject.${k} = ${JSON.stringify(v)}`); };
  const setField = (id, k, v) => { const b = get(id); if (!b) return; if (JSON.stringify(b[k]) === JSON.stringify(v)) return say(`· ok ${id} ${k}`); b[k] = v; changes++; say(`⚙ ${id}: ${k} = ${JSON.stringify(v).slice(0, 80)}`); };
  const replaceIn = (id, from, to, label) => { const b = get(id); if (!b) return; const cur = String(b.description || ""); if (typeof from === "string" ? !cur.includes(from) : !from.test(cur)) return say(`· ok ${id} (${label || "phrase"} not present)`); b.description = typeof from === "string" ? cur.split(from).join(to) : cur.replace(from, to); changes++; say(`✎ ${id}: ${label || "phrase"} reworded`); };
  const appendTo = (id, html, key) => { const b = get(id); if (!b) return; const cur = String(b.description || ""); if (cur.includes(key)) return say(`· ok ${id} (already appended: ${key.slice(0, 30)}…)`); b.description = cur + html; changes++; say(`✎+ ${id}: appended`); };
  const setDesc = (id, html, key) => { const b = get(id); if (!b) return; if (String(b.description || "").includes(key)) return say(`· ok ${id} (description)`); b.description = html; changes++; say(`✎ ${id}: description replaced`); };
  const addChoice = (id, choice, at = null) => { const b = get(id); if (!b) return; b.choices = Array.isArray(b.choices) ? b.choices : []; if (b.choices.some(c => c && String(c.next) === String(choice.next) && String(c.label) === String(choice.label))) return say(`· ok ${id} (choice "${choice.label}")`); const row = Object.assign({ description: "", checkStat: "", checkDC: 0, failNext: "" }, choice); if (at === "beforeLeave") { const i = b.choices.findIndex(c => /^(leave|back|something else|not yet)/i.test(String(c?.label || ""))); if (i >= 0) b.choices.splice(i, 0, row); else b.choices.push(row); } else b.choices.push(row); changes++; say(`▸ ${id}: +choice "${choice.label}" → ${choice.next || "—"}`); };
  const dropChoice = (id, pred, label) => { const b = get(id); if (!b) return; const cs = Array.isArray(b.choices) ? b.choices : []; const keep = cs.filter(c => !pred(c)); if (keep.length === cs.length) return say(`· ok ${id} (no choice ${label})`); b.choices = keep; changes++; say(`▸ ${id}: −choice ${label}`); };
  const retarget = (id, fromNext, toNext, labelRe = null) => { const b = get(id); if (!b) return; let n = 0; for (const c of (b.choices || [])) { if (!c) continue; if (String(c.next) === fromNext && (!labelRe || labelRe.test(String(c.label || "")))) { c.next = toNext; n++; } } if (!n) return say(`· ok ${id} (no route ${fromNext} → ${toNext} to change)`); changes += n; say(`▸ ${id}: ${n} route(s) ${fromNext} → ${toNext}`); };
  const relabel = (id, next, label) => { const b = get(id); if (!b) return; const c = (b.choices || []).find(c => c && String(c.next) === next); if (!c) return say(`✗ ${id}: no choice → ${next} to relabel`); if (c.label === label) return say(`· ok ${id} label "${label}"`); c.label = label; changes++; say(`▸ ${id}: label → "${label}"`); };
  const setStory = (id, decl) => { const b = get(id); if (!b) return; if (JSON.stringify(b.story) === JSON.stringify(decl)) return say(`· ok ${id} story`); b.story = decl; changes++; say(`📖 ${id}: story = ${JSON.stringify(decl)}`); };
  const dropQuestFx = (id, pred, label) => { const b = get(id); if (!b) return; const we = b.worldEffects = (b.worldEffects && typeof b.worldEffects === "object") ? b.worldEffects : {}; const qe = Array.isArray(we.questEffects) ? we.questEffects : []; const keep = qe.filter(e => !pred(e)); if (keep.length === qe.length) return say(`· ok ${id} (no questEffect ${label})`); we.questEffects = keep; changes++; say(`⚙ ${id}: −questEffect ${label}`); };
  const addQuestFx = (id, row) => { const b = get(id); if (!b) return; const we = b.worldEffects = (b.worldEffects && typeof b.worldEffects === "object") ? b.worldEffects : {}; we.questEffects = Array.isArray(we.questEffects) ? we.questEffects : []; if (we.questEffects.some(e => e && e.action === row.action && e.questId === row.questId)) return say(`· ok ${id} (questEffect ${row.action} ${row.questId})`); we.questEffects.push(row); changes++; say(`⚙ ${id}: +questEffect ${row.action} ${row.questId}`); };
  const mkBeat = (o) => ({
    id: o.id, label: o.label, type: o.type || "dialog", timeScale: o.timeScale || "scene", tags: o.tags || "", politicalTags: "",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: !!o.repeatable, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires: o.requires || [] },
    actors: [], choices: (o.choices || []).map(c => Object.assign({ description: "", checkStat: "", checkDC: 0, failNext: "" }, c)),
    encounter: o.encounter || { key: "", tier: null, actorName: "" },
    worldEffects: Object.assign({ territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [] }, o.worldEffects || {}),
    description: o.description, questId: o.questId || null, questStep: o.questStep ?? null, questRole: o.questRole ?? null,
    targetHexUuid: null, turnNumber: 1,
    cinematic: { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null },
    journal: { enabled: false, entryId: null, force: false },
    unlocks: { maneuvers: [], strategics: [] }, timePoints: o.timePoints ?? null,
    playerFacing: o.playerFacing !== false, playerFacingDialog: o.playerFacing !== false, dialogPlayerFacing: o.playerFacing !== false, playerFacingContent: o.playerFacing !== false, showToPlayers: o.playerFacing !== false,
    ...(o.speakerActorId ? { speakerActorId: o.speakerActorId } : {}),
    ...(o.story ? { story: o.story } : {}),
    ...(o.sceneId ? { sceneId: o.sceneId } : {}),
    ...(o.dialogueOffer === false ? { dialogueOffer: false } : {})
  });
  const addBeat = (nb) => { if (byId.has(nb.id)) { say(`· ok (exists) beat ${nb.id}`); return byId.get(nb.id); } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id} — ${nb.label}`); return nb; };
  const removeBeat = (id) => { if (!byId.has(id)) return say(`· ok (gone) ${id}`); const refs = camp.beats.filter(b => b.id !== id && JSON.stringify(b.choices || []).includes(`"${id}"`)).map(b => b.id); if (refs.length) return say(`✗ ${id} still routed from ${refs.join(", ")} — not removed`); camp.beats = camp.beats.filter(b => b.id !== id); byId.delete(id); changes++; say(`✖ beat ${id} REMOVED`); };
  const regId = (qk, ch) => ch ? QM[qk]?.chapters?.[ch]?.registryId : QM[qk]?.registryId;
  const setReg = (id, patch) => { const r = reg[id]; if (!r) return say(`✗ registry row ${id} missing`); let n = 0; for (const [k, v] of Object.entries(patch)) { if (r[k] !== v) { r[k] = v; n++; } } if (!n) return say(`· ok registry ${id}`); r.updatedTs = Date.now(); changes += n; say(`📜 registry ${id}: ${Object.keys(patch).join(", ")}`); };

  // ══ 1. REGISTRY ══════════════════════════════════════════════════════════
  say("── 1. registry");
  if (!reg.fc_long_table) { reg.fc_long_table = { id: "fc_long_table", v: 1, name: "The Long Table", description: "<p>Where the leylines knot, the Wendigo keep a long table with a name-card for everyone the region forgot. One of the cards has your name on it. Restore the node, take the trust onto yourselves, or sever the network.</p>", tags: ["forgotten-cause"], status: "active", act: 2, createdTs: Date.now(), updatedTs: Date.now() }; changes++; say("📜 registry fc_long_table CREATED (The Long Table chapter)"); } else say("· ok registry fc_long_table");
  for (const [qk, sc] of Object.entries(SCRIPTS)) {
    const rid = regId(qk); if (rid && reg[rid]) setReg(rid, { giver: sc.giver || "", description: `<p>${foundry.utils.escapeHTML(sc.description || "")}</p>` });
    for (const [ch, c] of Object.entries(sc.chapters || {})) { const cid = regId(qk, ch); if (cid && reg[cid] && (c.giver || c.line)) setReg(cid, { giver: c.giver || "", nextLine: c.line || "" }); }
    if (sc.arrival && sc.arrival.description) { const rid2 = regId(qk); if (rid2 && reg[rid2]) setReg(rid2, { arrivalGiver: sc.arrival.giver || "", arrivalDescription: `<p>${foundry.utils.escapeHTML(sc.arrival.description)}</p>` }); }
  }
  if (reg.fc_wendigo_confluence) setReg("fc_wendigo_confluence", { name: "The Forgotten Cause" });
  if (reg.quest_ag_confessors_debt) setReg("quest_ag_confessors_debt", { description: "<p>Someone at St Gilliam's is keeping the mountain's new tenants informed. The candles know. The drip tray knows. The gentlest building in town has a debt in it. What does justice look like when the confessor is the debtor?</p>" });

  // ══ 2. ALLESH-GILLIAM ════════════════════════════════════════════════════
  say("── 2. allesh-gilliam");
  const ACT1_ONLY = { flag: "storyPhase", lte: 1 };
  for (const id of ["allesh_gilliam_town_walk", "allesh_gilliam_hq_cinematics", "allesh_gilliam_yarrow_welcome", "ag_yarrow_answer_boards", "allesh_gilliam_st_gilliams_cinematics", "allesh_gilliam_tamsin_welcome", "ag_tamsin_answer_building", "allesh_gilliam_etta_welcome", "ag_etta_answer_skewer", "allesh_gilliam_waiting_room_intro", "allesh_gilliam_vacancy_intro", "allesh_gilliam_plumb_office_intro", "ag_first_night_soma_break", "ag_crossroads_first_rides", "ag_days_end"]) addGate(id, ACT1_ONLY);
  // the Muster: off the Round, reachable from the HQ once the militia exists
  retarget("allesh_gilliam_muster_intro", "allesh_gilliam_town_walk", "allesh_gilliam_introduction_to_hq");
  dropGate("allesh_gilliam_muster_intro", c => c && c.flag === "storyPhase" && Number(c.gte) === 1, "storyPhase≥1");
  addGate("allesh_gilliam_muster_intro", { flag: "storyPhase", gte: 2 });
  addChoice("allesh_gilliam_introduction_to_hq", { label: "The Muster — Captain Brakk's militia", next: "allesh_gilliam_muster_intro" }, "beforeLeave");
  // Greeley: the Night the Mountain Coughed (Arrival door)
  addBeat(mkBeat({ id: "ag_greeley_answer_cough", label: "Allesh-Gilliam — The Room in the Back", tags: "arrival greeley cough", questId: regId("allesh_gilliam"), story: { quest: "allesh_gilliam" }, questStep: 331,
    requires: [{ flag: "storyPhase", gte: 1 }, ACT1_ONLY], speakerActorId: (game.actors?.contents || []).find(a => /greeley/i.test(a.name))?.id || undefined,
    description: `<p>Greeley doesn't look at the door. She never has to. "The Night the Mountain Coughed," she says, the way you'd give a date. "Before your time. The crew before you, the ones who cracked Khezek Tor back open. They opened a Yesodium chamber they shouldn't have, or opened it wrong, and the mountain answered. Took the gallery wall off. Took a crew's worth of people with it and sent me the rest."</p><p>She pours. "That room's where we put the ones we couldn't put back. It stays clean because I clean it."</p><p>The bar is quiet in the way of a room that has heard this before and lets her say it anyway. "Folk will tell you the mountain did it on purpose. That it's mad. I don't know that particular mountain personally, so I can't vouch for its temperament, and I don't think they can either. But I know what came down that road. And I know the middle Tamsin brother went into the cage shaft after a manifest that night and is still, the way the quartermaster tells it, on the books."</p><p>She sets the cup down. "Ask Calder about the Brace. Not in front of the shift."</p>`,
    choices: [{ label: "Back to the Round", next: "allesh_gilliam_town_walk" }] }));
  addChoice("allesh_gilliam_waiting_room_intro", { label: "Ask about the room in the back", next: "ag_greeley_answer_cough" }, "beforeLeave");
  // two nights: the East Wall belongs to That One Night
  replaceIn("allesh_gilliam_wall_stands_straight", "It started the Night the Mountain Coughed, and it ended", "It started that one night, and it ended", "the Cough → that one night");
  replaceIn("allesh_gilliam_east_wall_success", "Someday, someone should go ask it why it coughed.", "Someday, someone should go ask it what it's tired of.", "why it coughed");
  // Garren: the spanner, the night, Joan's key
  appendTo("ag_leygate_visit", `<p>${MARK ? "" : ""}He wipes his hands and comes out of the panel with something heavy wrapped in oilcloth: a <b>Tetrarch Spanner</b>, the gate's own, brass gone green at the jaws. "Take it. Whatever they sell you at Fixit, it fits THIS, or it's a very expensive doorstop. The Jackalopes will want to see it before they'll certify the part." He looks at the gate, then at you. "It's been remembering wrong since that one night. Joan's key still works — one charge, and if it misfires it won't explode. It'll send the wrong shape of thing. So don't lose the spanner."</p>`, "Tetrarch Spanner");
  // the Confessor reorder: evidence first
  setStory("khezek_upper_galleries", { quest: "khezek_tor" });
  setField("khezek_upper_galleries", "questId", regId("khezek_tor"));
  setField("khezek_upper_galleries", "questStep", 165);
  setGates("khezek_upper_galleries", [{ questBucket: regId("valhaulan_seal"), is: "active" }, { flag: "storyPhase", gte: 2 }]);
  setGates("ag_confessor_dead_drop", [{ beatMark: "khezek_upper_galleries" }, { beatMark: "allesh_gilliam_etta_bloom_convo_exit" }, { questBucket: regId("allesh_gilliam", "the_confessor_s_debt"), isNot: "completed" }, { flag: "storyPhase", gte: 2 }]);
  replaceIn("ag_tamsin_confrontation", "when the thief in the back room is the man who taught you the question?", "when the thief in the back room is the man who poured your tea?", "the Prisoner's question");
  appendTo("ag_tamsin_confrontation", `<p>He does not mention his brother at the Lift Hall. He does not have to; you have seen the manifest with the middle Tamsin still on it, and you have seen who visits Brennig more than any parish requires. Whatever passes through this room passes up the mountain by a road with family on both ends of it.</p>`, "his brother at the Lift Hall");
  // the Offices' legacy row: "Wake up" no longer completes the quest (the Opening Scene is the closer)
  dropQuestFx("fates_and_destinies_incarnate", e => e && e.action === "complete", "complete offices");

  // ══ 3. LYRENN / KHEZEK-TOR ═══════════════════════════════════════════════
  say("── 3. lyrenn / khezek-tor");
  for (const id of ["lyrenn_town_walk", "lyrenn_elsin_welcome", "lyrenn_rowan_welcome", "lyrenn_rowan_answer_rhythm", "khezek_tor_town_walk", "khezek_tor_drax_welcome", "kt_drax_answer_chalk", "khezek_tor_sable_welcome", "kt_sable_answer_maps"]) addGate(id, ACT1_ONLY);
  // KT day one: the only door is the cookline
  dropChoice("khezek_tor_main_scene", c => c && ["khezek_tor_the_maw", "khezek_tor_the_lift_hall", "khezek_tor_the_brace"].includes(String(c.next)), "Maw/Lift Hall/Brace (Act 2 doors)");
  dropChoice("khezek_tor_main_scene", c => c && /something else/i.test(String(c.label || "")) && !c.next, "Something else?");
  // the Word from the Mountain gets a road
  addBeat(mkBeat({ id: "khezek_word_ride", label: "The Road to Khezek-Tor — Word Received", tags: "khezek word travel", questId: regId("khezek_tor"), story: { quest: "khezek_tor" }, questStep: 199, repeatable: true,
    requires: [{ flag: "storyPhase", gte: 2 }], worldEffects: { openTravel: { hexName: "Khezek-Tor" } },
    description: `<p>The tallies are folded into a pocket. The road to Khezek-Tor is where it always was — Thatwards-by-North, out of the green and into country that clinks when the wind moves it. Plot the ride on the Travel Console and go and see what the mountain wrote.</p>`,
    choices: [{ label: "🐎 Saddle up — ride for Khezek-Tor", next: "" }, { label: "Not yet — the mountain keeps its own time", next: "" }] }));
  addChoice("vs_overture", { label: "Ride for Khezek-Tor — see the handwriting", next: "khezek_word_ride" });
  // the Brace and the Cough (the previous crew's night)
  appendTo("khezek_tor_the_brace", `<p>The Brace went up after the Night the Mountain Coughed — the last crew's night, before your time, when somebody opened a Yesodium chamber wrong and the gallery wall came off. Half the town thinks the mountain did it on purpose. The other half won't say.</p>`, "the Night the Mountain Coughed");
  addChoice("khezek_tor_quest_scene", { label: "The Upper Galleries — follow the courier's route", next: "khezek_upper_galleries" }, "beforeLeave");

  // ══ 4. FIXIT ═════════════════════════════════════════════════════════════
  say("── 4. fixit");
  { const stub = byId.get("fixit_quest_acceptance"); if (stub) { for (const e of (stub.worldEffects?.questEffects || [])) addQuestFx("fixit_cinematic_intro", e); } removeBeat("fixit_quest_acceptance"); }
  { const stub = byId.get("fixit_the_weeping_prisoner_acceptance"); if (stub) { for (const e of (stub.worldEffects?.questEffects || [])) addQuestFx("fixit_weeping_prisoner", e); } removeBeat("fixit_the_weeping_prisoner_acceptance"); }
  setDesc("fixit_leyline_stabilizer", `<p>The crate is on the Arc Bay floor with a tarp over it, and Young Gearbox has one boot on it like a man guarding a dog that might bolt. "Leyline Stabilizer. Real one. Joans said you'd be along." He tips his head at the tarp. "Before Mara names a price there's a formality, and the formality is: does it FIT? Garren's gate takes a Tetrarch fitting, and I've seen three of these go out to three towns and come back as doorstops because nobody checked."</p><p>He holds out a hand, palm up. "Spanner."</p>`, "Spanner.");
  { const b = get("fixit_leyline_stabilizer"); if (b) { const want = [{ label: "Hand over the Tetrarch Spanner — it fits", next: "fixit_leyline_stabilizer_negotiation" }, { label: "We didn't bring one", next: "fixit_no_spanner" }, { label: "Leave", next: "fixit_intro_scene" }]; if (JSON.stringify((b.choices || []).map(c => [c.label, c.next])) !== JSON.stringify(want.map(c => [c.label, c.next]))) { b.choices = want.map(c => Object.assign({ description: "", checkStat: "", checkDC: 0, failNext: "" }, c)); changes++; say("▸ fixit_leyline_stabilizer: choices = spanner / no spanner / leave"); } else say("· ok fixit_leyline_stabilizer choices"); } }
  addBeat(mkBeat({ id: "fixit_no_spanner", label: "Furrier's Fixit Farm — Without the Spanner", tags: "fixit spanner", questId: regId("fixit_farm", "the_leyline_stabilizer"), story: { quest: "fixit_farm", chapter: "the_leyline_stabilizer" }, questStep: 15, repeatable: true,
    requires: [{ flag: "storyPhase", gte: 2 }],
    description: `<p>Gearbox's hand stays out for exactly as long as it takes you to understand that it is not going to close on nothing. "Then I can't certify it, and Mara won't price what I can't certify, and you're going to ride back to Allesh-Gilliam, ask Garren for the gate's own spanner, and ride here again." He drops the tarp back over the crate. "It's not personal. It's the difference between a stabilizer and a very expensive doorstop."</p><p>Pip, from somewhere above: "Told you they'd forget it."</p>`,
    choices: [{ label: "Ride back for it", next: "ride_back_home" }, { label: "Back to the yard", next: "fixit_intro_scene" }] }));
  addGate("fixit_leyline_stabilizer_negotiation", { beatMark: "ag_leygate_visit" });
  retarget("fixit_town_walk", "allesh_gilliam_introduction_to_hq", "fixit_intro_scene");
  retarget("fixit_general_store_coversation_3", "fixit_intro_scene", "fixit_general_store_coversation", /ask something else/i);
  relabel("fixit_gullywasher_interior_convo", "fixit_gullywasher_choice_1", "Chupacabras and Jackalopes — aren't you at war?");
  relabel("fixit_gullywasher_interior_convo", "fixit_gullywasher_choice_2", "We come in peace");
  relabel("fixit_gullywasher_interior_convo", "fixit_gullywasher_choice_3", "What's the house protocol?");
  relabel("fixit_gullywasher_interior_convo", "fixit_gullywasher_choice_4", "We're here for the stabilizer. Know anything?");
  appendTo("fixit_gullywasher_choice_4", `<p>He polishes the glass once more, decisively. "The iron kind is in the Arc Bay. Gearbox has it under a tarp and Mara has it under a price. I sell the other kind." He sets the glass down. "You'll want both."</p>`, "I sell the other kind");

  // ══ 5. CIRCUIT RIDERS ════════════════════════════════════════════════════
  say("── 5. circuit riders");
  for (const k of ["playerFacing", "playerFacingDialog", "dialogPlayerFacing", "playerFacingContent", "showToPlayers"]) setField("enc_circuit_riders_parley_approach", k, true), setField("enc_circuit_riders_parley_observe", k, true);
  addChoice("enc_circuit_riders_parley_observe", { label: "Say hi", next: "enc_circuit_riders_parley_opening" });
  for (const id of ["enc_circuit_riders_doctrine_good", "enc_circuit_riders_doctrine_mixed", "enc_circuit_riders_doctrine_bad", "enc_circuit_riders_darkness_good", "enc_circuit_riders_darkness_mixed", "enc_circuit_riders_darkness_bad", "enc_circuit_riders_witness_good", "enc_circuit_riders_witness_mixed", "enc_circuit_riders_witness_bad"]) {
    addChoice(id, { label: "The next question", next: "enc_circuit_riders_parley_respect" });
    addChoice(id, { label: "Terms of contact", next: "enc_circuit_riders_parley_resolution" });
  }
  // the tally (engine D-10: meter crVerify — +1 per good answer, −1 per bad; registered in _resolveGateValue)
  addGate("enc_circuit_riders_parley_alliance", { flag: "crVerify", gte: 2 });
  addGate("enc_circuit_riders_parley_neutral", { flag: "crVerify", gte: 0 });
  setInject("enc_circuit_riders_parley_approach", "repeatable", false);

  // ══ 6. TIFARET — The Tree's Session ══════════════════════════════════════
  say("── 6. tifaret");
  const TIF = regId("tifaret");
  let forest = (game.actors?.contents || []).find(a => a.name === "The Forest of Early Tifaret") || null;
  if (!forest) { say(`✚ CREATE actor "The Forest of Early Tifaret" (npc)`); changes++; if (!DRY_RUN) forest = await Actor.create({ name: "The Forest of Early Tifaret", type: "npc" }); }
  const forestId = forest?.id || null;
  for (const id of ["forest_of_tifaret_merge", "forest_of_tifaret_aggression_ending", "forest_of_tifaret_harmonious_ending", "forest_of_tifaret_neutral_ending"]) { const b = get(id); if (b && forestId && b.speakerActorId !== forestId) { b.speakerActorId = forestId; changes++; say(`🗣 ${id}: speaker → The Forest of Early Tifaret`); } }
  // dedupe the doubled faction rows on the three endings
  for (const id of ["forest_of_tifaret_aggression_ending", "forest_of_tifaret_harmonious_ending", "forest_of_tifaret_neutral_ending"]) { const b = get(id); if (!b) continue; const fe = b.worldEffects?.factionEffects; if (Array.isArray(fe) && fe.length > 1) { const seen = new Set(); const keep = fe.filter(r => { const k = String(r?.factionId || ""); if (seen.has(k)) return false; seen.add(k); return true; }); if (keep.length !== fe.length) { b.worldEffects.factionEffects = keep; changes++; say(`⚙ ${id}: factionEffects deduped ${fe.length} → ${keep.length}`); } } }
  const GROVE = (byId.get("forest_of_tifaret_harmonious_ending")?.worldEffects?.worldModifiers || []).find(m => m && m.key === "harmonized_grove") || null;
  const COALITION = (byId.get("forest_of_tifaret_harmonious_ending")?.worldEffects?.factionEffects || [])[0]?.factionId || null;
  let exStep = 221;
  const exch = (id, label, question, prose, ok, miss, checks, okFx) => {
    const step = exStep; exStep += 3;
    addBeat(mkBeat({ id, label, tags: "tifaret session", questId: TIF, story: { quest: "tifaret" }, questStep: step, speakerActorId: forestId || undefined, requires: [{ flag: "storyPhase", gte: 2 }],
      description: `<p><b>${question}</b></p><p>${prose}</p>`,
      choices: [...checks.map(c => ({ label: c.label, checkStat: c.stat, checkDC: 0, next: id + "_ok", failNext: id + "_miss" })), { label: "Not this one — back to the tree", next: "forest_of_tifaret_merge" }] }));
    addBeat(mkBeat({ id: id + "_ok", label: label + " — Answered", tags: "tifaret session", questId: TIF, story: { quest: "tifaret" }, questStep: step + 1, speakerActorId: forestId || undefined, worldEffects: okFx || {}, requires: [{ flag: "storyPhase", gte: 2 }],
      description: `<p>${ok}</p><p><i>⚙ GM: one success toward the tally. After the SECOND success, fire <b>The Channel Draws Something</b> — the Obstructor comes.</i></p>`,
      choices: [{ label: "Back to the tree", next: "forest_of_tifaret_merge" }] }));
    addBeat(mkBeat({ id: id + "_miss", label: label + " — Missed", tags: "tifaret session", questId: TIF, story: { quest: "tifaret" }, questStep: step + 2, speakerActorId: forestId || undefined, requires: [{ flag: "storyPhase", gte: 2 }],
      description: `<p>${miss}</p>`, choices: [{ label: "Back to the tree", next: "forest_of_tifaret_merge" }] }));
  };
  exch("forest_of_tifaret_session_carry", "The Tree's Session — What Do You Carry?", "What do you carry?",
    "The question arrives without sound — the whole clearing leans a degree toward you, and the leaning is the asking. It wants the weight. Not the story of the weight. The weight.",
    "You set it down. Not the words for it — the thing itself — and the forest takes it the way a good floor takes a dropped bag: without comment, without giving it back. The manic edge in the leaves goes slack by a hair. Something in your faction's shoulders does the same. The Grove holds it now. That's what a grove is for.",
    "You tell it about the weight. Beautifully. The forest listens with the patience of a thing that has heard a great many people describe what they would not put down, and the clearing does not lean any closer. Next question.",
    [{ label: "Set it down (Faith)", stat: "op.faith" }, { label: "Say it plainly (Soft Power)", stat: "op.softpower" }],
    COALITION ? { factionEffects: [{ factionId: COALITION, moraleDelta: 1, loyaltyDelta: 0, unityDelta: 0, darknessDelta: -1, opDeltas: {}, allowOvercap: false }] } : {});
  exch("forest_of_tifaret_session_become", "The Tree's Session — What Do You Want to Become?", "What do you want to become?",
    "Not what you are for. What you would be if nothing pulled. The trees grow at ideal distances because something decided what the ideal was; it is asking you for yours.",
    "You answer, and the forest — which believes harmony is achievable, correctly — learns your shape and grows a degree toward it. Hostility here goes quiet. Soft words work in this wood now, and the next town you ride into will hear that a forest vouched for you.",
    "You answer what you are for, which is not what it asked. The forest is kind about it. Kind is not the same as satisfied.",
    [{ label: "Name it (Diplomacy)", stat: "op.diplomacy" }, { label: "Show it (Culture)", stat: "op.culture" }],
    GROVE ? { worldModifiers: [foundry.utils.deepClone(GROVE)] } : {});
  exch("forest_of_tifaret_session_do", "The Tree's Session — What Will You Do for Me?", "What will you do for me?",
    "It shows you the clearing where the spacing breaks — the ring at double distance around the stone figure mid-stride. It could not improve that. It would like the ring tended, and it would like to not be the one to say why.",
    "You tend the ring — clear the deadfall, true the edges, leave the figure exactly as it stands — and the forest opens the Fixit road to you for good: free passage, no argument, the paths will not bend on you again. And it tells you, in the only way it can, which way the figure is facing. That is a receipt. Keep it for whoever is counting stone figures.",
    "You do the work, mostly, and the forest notices the mostly. The road stays polite. The paths still bend.",
    [{ label: "Tend the ring (Logistics)", stat: "op.logistics" }, { label: "Stand watch over it (Nonlethal)", stat: "op.nonlethal" }], {});
  addBeat(mkBeat({ id: "forest_of_tifaret_obstructor", label: "The Tree's Session — The Channel Draws Something", type: "encounter", tags: "tifaret session qliphoth", questId: TIF, story: { quest: "tifaret" }, questStep: 230, speakerActorId: forestId || undefined, requires: [{ flag: "storyPhase", gte: 2 }],
    encounter: { key: "obstructor_demon", tier: 3, actorName: "Obstructor Demon" },
    description: `<p>The second time you and the tree understand one another, something else understands it too. The light between the trunks goes the colour of a bruise and a dull grey static stands up out of the ground — a wall of it, then a shape in front of the wall, dense as a held breath, faceless, and slow in the way that makes fast things stop. An <b>Obstructor Demon</b>. The open channel drew it; a mind reaching for another mind is a door, and the Qliphoth walk through doors.</p><p>The forest does not run. Its champion comes up out of the ring — the Aggressive Tifaret Tree Person, roots full of old highway — and stands on your side of the static.</p><p><i>⚙ GM: run the fight. The Tree Person fights BESIDE the party. Win → the demon unravels, the tree trusts you, and it counts as a success toward the tally. Lose → the session ends where the tally stands; the hex takes a point of Darkness; no further penalty.</i></p>`,
    choices: [{ label: "We held — the demon unravels (counts as a success)", next: "forest_of_tifaret_merge" }, { label: "It broke the session — tally what we have", next: "forest_of_tifaret_session_tally" }] }));
  addBeat(mkBeat({ id: "forest_of_tifaret_session_tally", label: "The Tree's Session — The Tally", tags: "tifaret session", questId: TIF, story: { quest: "tifaret" }, questStep: 231, speakerActorId: forestId || undefined, requires: [{ flag: "storyPhase", gte: 2 }],
    description: `<p>The session ends the way sessions do: not with a verdict, with a quiet. The forest has learned what it learned. So have you.</p><p><i>⚙ GM: count the successes (each exchange answered = 1; the Obstructor held = 1). Three or more → Harmonious. Two → Harmonious, lite (the benefits earned, nothing more). One or none → Neutral.</i></p>`,
    choices: [{ label: "Three or more — Harmonious", next: "forest_of_tifaret_harmonious_ending" }, { label: "Two — Harmonious, lite", next: "forest_of_tifaret_harmonious_lite" }, { label: "One or none — Neutral", next: "forest_of_tifaret_neutral_ending" }] }));
  addBeat(mkBeat({ id: "forest_of_tifaret_harmonious_lite", label: "Forest of Tifaret - Something Was Learned", tags: "tifaret ending", questId: TIF, story: { quest: "tifaret", role: "closer", ending: "harmonious_lite" }, questStep: 65, speakerActorId: forestId || undefined, requires: [{ flag: "storyPhase", gte: 2 }],
    worldEffects: { questEffects: [{ action: "complete", questId: TIF, beatId: "", state: "completed", text: "Tifaret learned something. Not everything." }] },
    description: `<p>The manic edge to the forest lessens — not all the way. It feels seen in the places you looked. It keeps what you gave it and gives back exactly what was earned, no more, which from a forest that believes in correct harmony is a kind of honesty. The land is glad you came. It is not yet sure you'll be back.</p>`,
    choices: [{ label: "Leave", next: "" }] }));
  { const b = get("forest_of_tifaret_merge"); if (b) {
      dropChoice("forest_of_tifaret_merge", c => c && ["Soft Power", "Diplomacy", "Faith", "Nonlethal"].includes(String(c.label || "")), "the four bare channel checks");
      addChoice("forest_of_tifaret_merge", { label: "What do you carry?", next: "forest_of_tifaret_session_carry" }, "beforeLeave");
      addChoice("forest_of_tifaret_merge", { label: "What do you want to become?", next: "forest_of_tifaret_session_become" }, "beforeLeave");
      addChoice("forest_of_tifaret_merge", { label: "What will you do for me?", next: "forest_of_tifaret_session_do" }, "beforeLeave");
      addChoice("forest_of_tifaret_merge", { label: "⚔ The channel draws something (GM: after the second success)", next: "forest_of_tifaret_obstructor" }, "beforeLeave");
      addChoice("forest_of_tifaret_merge", { label: "Tally the session", next: "forest_of_tifaret_session_tally" }, "beforeLeave");
      setInject("forest_of_tifaret_merge", "repeatable", true);
      appendTo("forest_of_tifaret_merge", `<p>It asks three things, in any order, and it means each of them. Answer what you can. <i>⚙ GM: THE TREE'S SESSION — three exchanges, each a check on the channel the players choose, each success a distinct benefit. After the SECOND success the Obstructor comes and the Tree Person fights beside the party. Then the tally.</i></p>`, "THE TREE'S SESSION");
  } }
  setInject("forest_of_tifaret_approach", "repeatable", false);

  // ══ 7. FORGOTTEN CAUSE ═══════════════════════════════════════════════════
  say("── 7. forgotten cause");
  const FC = regId("forgotten_cause"), FC_LEDGER = regId("forgotten_cause", "close_the_ledger");
  for (const [id, ending] of [["wendigo_confluence_repair", "repair"], ["wendigo_confluence_redirect", "redirect"], ["wendigo_confluence_break", "break"]]) {
    setStory(id, { quest: "forgotten_cause", chapter: "the_long_table", role: "ending", ending });
    dropQuestFx(id, e => e && e.action === "complete" && e.questId === FC, "complete forgotten_cause");
    addQuestFx(id, { action: "complete", questId: "fc_long_table", beatId: "", state: "completed", text: `The Long Table — ${ending}.` });
  }
  setStory("wendigo_confluence_the_long_table", { quest: "forgotten_cause", chapter: "the_long_table" });
  setStory("fc_bridge_confluence", { quest: "forgotten_cause", chapter: "the_long_table" });
  setStory("gullywasher_cultural_summit_success", { quest: "forgotten_cause", chapter: "close_the_ledger", role: "closer", ending: "closed" });
  addQuestFx("gullywasher_cultural_summit_success", { action: "complete", questId: FC, beatId: "", state: "completed", text: "The reason-column got its entry. The line is closed." });
  // after Redirect or Break there is no reason to enter: the summit says so
  appendTo("gullywasher_cultural_summit", `<p><i>⚙ GM: if the Confluence ended in REDIRECT or BREAK, there is no recovered cause — the summit can be held, but the reason-column stays blank and the chapter closes UNWINNABLE. Say so plainly: "there is no reason left to enter."</i></p>`, "no reason left to enter");
  // the name-card read reveals something
  addBeat(mkBeat({ id: "wendigo_confluence_name_cards", label: "The Confluence — The Name-Cards", tags: "forgotten-cause receipts", questId: "fc_long_table", story: { quest: "forgotten_cause", chapter: "the_long_table" }, questStep: 12, requires: [{ flag: "storyPhase", gte: 2 }],
    description: `<p>You read the cards. The Wendigo let you; they pull out chairs as you go, gracious, unhurried, and the hundreds of names arrange themselves into a map of everything three regions could not bear to keep.</p><p>Three seats down: the name you buried. You knew that one was coming.</p><p>What you did not expect: a place set for a tired boy who gets flattened by a piano and springs up laughing. A place for a son who was on the 4:10. A whole table-length of names that also hang, hand-lettered, between the scenes at Chuckle Creek. The forgotten are not only the region's. They are the towns' — the ones that refuse to grieve. The Wendigo have been holding those too.</p><p>You leave with three names in your pocket, written in someone else's hand. <b>Receipts.</b> Produce one in the town it belongs to and the town will hear its dead named by someone who came back for them.</p>`,
    choices: [{ label: "Back to the table — decide", next: "wendigo_confluence_the_long_table" }] }));
  { const b = get("wendigo_confluence_the_long_table"); if (b) { const c = (b.choices || []).find(c => c && /read the name-cards/i.test(String(c.label || ""))); if (c && c.next !== "wendigo_confluence_name_cards") { c.next = "wendigo_confluence_name_cards"; changes++; say("▸ the Long Table: 'Read the name-cards' → the reveal (pass)"); } else say("· ok the Long Table name-cards route"); } }
  // Pip's summons belongs to the Maneuver Vault
  setStory("fc_mara_pip_summons", { quest: "maneuver_vault" });
  setField("fc_mara_pip_summons", "questId", regId("maneuver_vault"));
  // the capstone: the coalition names the quartet
  addBeat(mkBeat({ id: "grief_quartet_capstone", label: "Misapplied Love — The Quartet, Named", tags: "forgotten-cause grief capstone receipts", questId: FC, story: { quest: "forgotten_cause" }, questStep: 90,
    requires: [{ flag: "storyPhase", gte: 2 }, { questBucket: "fc_long_table", is: "completed" }, { questBucket: regId("chuckle_creek"), is: "completed" }, { questBucket: regId("soft_landing"), is: "completed" }, { questBucket: regId("stillwater"), is: "completed" }],
    description: `<p>It gets said out loud, eventually, by whoever in the coalition says the things that need saying: four communities, four ways to not grieve, one ache. Forget it. Don't let it count. Freeze before it. Pad against it. The Wendigo at their table, the Showrunner at its console, a Sunday that would not end, a nation that would not land. Every one of them was somebody's mercy. Every one of them was a cage.</p><p>And the middle doors — the ones the coalition kept choosing when it chose the managed path — rhyme too. New Episode. Practice Ground. Covenant. Redirect. Managed grief is the coalition becoming the region's Wendigo, and knowing it is the only thing that keeps it from being true.</p><p>That sentence is a <b>Receipt</b>. It can be produced in any court in Bad Eden, and nobody who hears it will be able to un-hear it. The four hexes can be aligned now.</p>`,
    choices: [{ label: "Noted.", next: "" }] }));

  // ══ 8. BANDIT ACCORD / CADENCE ═══════════════════════════════════════════
  say("── 8. bandit accord / cadence");
  addGate("bandit_accord_opening", { flag: "banditMercy", gte: 1 });
  addGate("bandit_ambush_arms_down", { flag: "banditMercy", gte: 4 });
  setInject("bandit_ambush_arms_down", "repeatable", false);
  setStory("bandit_summit_refuse", { quest: "bandit_accord" });
  dropQuestFx("bandit_summit_refuse", e => e && e.action === "complete", "complete (refuse no longer closes)");
  setInject("bandit_envoy", "repeatable", true); setInject("bandit_envoy", "cooldownTurns", 1);
  appendTo("bandit_summit_refuse", `<p>The punt under the white rag will be back next turn. It always is. Ralph Maccio has BOOKS, and the books do not close on a no.</p>`, "will be back next turn");
  // Ralph Maccio, she/her
  replaceIn("bandit_envoy", "the Bandit Lord of the Drowned South requests a summit, at a neutral stilt-hall of your choosing, to discuss — his phrasing —", "Ralph Maccio, the Bandit Lord of the Drowned South, requests a summit, at a neutral stilt-hall of your choosing, to discuss — her phrasing —", "Ralph (envoy)");
  replaceIn("bandit_summit", "the Bandit Lord of the Drowned South — not a warlord, you realize within a minute, but a MANAGER, over-extended in the way of a man who inherited three crews", "Ralph Maccio, the Bandit Lord of the Drowned South — a Stormborn Nomad who named herself after what she believes to be the greatest warrior of the pre-Shattering era, and not a warlord, you realize within a minute, but a MANAGER, over-extended in the way of a woman who inherited three crews", "Ralph (summit)");
  replaceIn("bandit_summit", "He has BOOKS. He shows you the books, unprompted, like a confession. 'You're hiring away my people,' he says,", "She has BOOKS. She shows you the books, unprompted, like a confession. 'You're hiring away my people,' she says,", "Ralph (books)");
  replaceIn("bandit_summit_accord", "the Bandit Lord signs like a man setting down something heavy", "Ralph Maccio signs like a woman setting down something heavy", "Ralph (accord)");
  replaceIn("bandit_summit_accord", "⚠ GM: mint the Bandit Lord's faction actor now", "⚠ GM: mint Ralph Maccio's faction actor now", "Ralph (mint)");
  replaceIn("bandit_summit_absorption", "And the Bandit Lord, pensioned off in the only currency that interests him — a settled retirement for his people — takes over the bar at the Good Vibes Club, where he pours measures with a bookkeeper's precision and tells anyone who asks that he is OUT of the profession,", "And Ralph Maccio, pensioned off in the only currency that interests her — a settled retirement for her people — takes over the bar at the Good Vibes Club, where she pours measures with a bookkeeper's precision and tells anyone who asks that she is OUT of the profession,", "Ralph (absorption)");
  replaceIn("bandit_summit_humiliation", "The Bandit Lord signs the instrument of it with a steady hand — he's a bookkeeper, he knows a bad quarter when he's IN one — and the ones who came in with him", "Ralph Maccio signs the instrument of it with a steady hand — she's a bookkeeper, she knows a bad quarter when she's IN one — and the ones who came in with her", "Ralph (humiliation)");
  replaceIn("bandit_summit_refuse", "The Bandit Lord nods slowly, closes his books, and thanks you — actually thanks you — for the soup his people got", "Ralph Maccio nods slowly, closes her books, and thanks you — actually thanks you — for the soup her people got", "Ralph (refuse)");
  // the Cadence's floor: Culture + Soft Power only (raid console enforcement = engine D)
  { const b = get("cadence_battle"); if (b) { const tags = String(b.tags || "").split(/\s+/).filter(Boolean); if (!tags.includes("raid.maneuvers:culture,softpower")) { tags.push("raid.maneuvers:culture,softpower"); b.tags = tags.join(" "); changes++; say("🏷 cadence_battle: tag raid.maneuvers:culture,softpower"); } else say("· ok cadence_battle tag"); } }

  // ══ 9. ACTORS ════════════════════════════════════════════════════════════
  say("── 9. actors");
  { const a = (game.actors?.contents || []).find(x => x.name === "Drax Caulder"); if (a) { changes++; say(`✎ actor "Drax Caulder" → "Drax Calder" (${a.id})`); if (!DRY_RUN) await a.update({ name: "Drax Calder" }); } else say("· ok Drax Calder (no 'Caulder' actor)"); }

  // ══ 10. RECEIPTS — persona arming ════════════════════════════════════════
  say("── 10. receipts");
  const CREW = { Simone: "enc_circuit_riders_simone_intro", Arvind: "enc_circuit_riders_arvind_intro", Howard: "enc_circuit_riders_howard_intro", Dennis: "enc_circuit_riders_dennis_intro" };
  const crewActors = {};
  for (const [name, introId] of Object.entries(CREW)) {
    let a = (game.actors?.contents || []).find(x => x.name === name || x.name === `${name} — Circuit Rider`) || null;
    if (!a) { say(`✚ CREATE actor "${name}" (npc, Circuit Rider)`); changes++; if (!DRY_RUN) a = await Actor.create({ name, type: "npc" }); }
    crewActors[name] = a;
    for (const id of [introId, introId.replace(/_intro$/, "_1"), introId.replace(/_intro$/, "_2"), introId.replace(/_intro$/, "_echo")]) { const b = byId.get(id); if (b && a && b.speakerActorId !== a.id) { b.speakerActorId = a.id; changes++; say(`🗣 ${id}: speaker → ${name}`); } }
  }
  const PERSONAS = [
    { name: "Simone", secrets: ["That Sentence Has Blood In It :: forceReroll :: a Steward asks Simone what she did with the warning she once had, and does not flinch from the answer :: Simone once had enough warning to save everyone and used it to optimize the outcome. Produced in court, it forces a reroll: the room has to reconsider what 'the elegant answer' costs."] },
    { name: "Arvind", secrets: ["Inside the Confidence Interval :: oppRollMinus2 :: a Steward asks Arvind about the distortion he ignored, or brings him a pattern he would rather like than see :: People died inside Arvind's confidence interval because the model was beautiful. Produced in court, it puts a −2 on the opposition: a coherent story is not a true one, and everyone at the table knows it now."] },
    { name: "Howard", secrets: ["He Still Died Alone :: favorPlus1 :: a Steward asks Howard who he left, and waits :: Howard left somebody because he was following the plan. Produced in court, it wins a courtier's favor: follow-through that interrupts the prepared thing is the only kind worth having."] },
    { name: "Dennis", secrets: ["Probably Fine Is Not Load-Bearing :: stirThePot :: a Steward asks Dennis which of his theories should have stayed a draft :: Dennis had a theory that should have stayed a draft, and 'probably fine' turned out not to be a load-bearing phrase. Produced in court, it stirs the pot: somebody's confident plan gets asked for its aftermath."] },
    { name: "The Forest of Early Tifaret", topics: "harmony, balance, the ring, the stone figure, the Fixit road, Lyrenn's forest, the treaty, your mother, weight, becoming, correction",
      notes: `${MARK} PRIVATE TRUTH — The Forest of Early Tifaret. It believes harmony is achievable. Correctly. It does not want you dead; it wants you BETTER, and it will ask about your relationships with the seriousness of a therapist who bills the universe. VOICE: warm, direct, faintly unnerving; asks questions and waits; answers in images (spacing, light, the ring). It runs THE SESSION: what do you carry, what do you want to become, what will you do for me. GUARDED DEPTH: the stone figure mid-stride in the ring — the one thing here it could not improve — is FACING somewhere, and the forest knows where (toward the others). It says so only to someone who tended the ring. It is related to Lyrenn's forest and knows the treaty. STAGING: the whole clearing leans when it speaks.`,
      secrets: ["Which Way the Figure Faces :: rollPlus2 :: a Steward tends the ring around the stone figure, or asks the forest what it could not improve and why :: The stone figure mid-stride is facing the others — the direction the standing stones went quiet. Produced in court, or to anyone counting stone figures, it is a +2: a heading nobody else has."] }
  ];
  for (const p of PERSONAS) {
    const actor = crewActors[p.name] || (game.actors?.contents || []).find(a => a.name === p.name) || (p.name === "The Forest of Early Tifaret" ? forest : null);
    if (!actor) { say(`✗ receipts: actor "${p.name}" not found`); continue; }
    const cur = actor.getFlag(MV, "persona") || {};
    const next = { ...cur };
    const curRaw = String(cur.secretsRaw || ""); const fresh = (p.secrets || []).filter(l => !curRaw.includes(l.split("::")[0].trim()));
    if (p.topics && !String(cur.topics || "").includes(p.topics.split(",")[0])) next.topics = [String(cur.topics || "").trim(), p.topics].filter(Boolean).join(", ");
    if (p.notes && !String(cur.notes || "").includes(MARK)) next.notes = [String(cur.notes || "").trim(), p.notes].filter(Boolean).join("\n\n");
    if (fresh.length) next.secretsRaw = [curRaw.trim(), ...fresh].filter(Boolean).join("\n");
    if (JSON.stringify(next) === JSON.stringify(cur)) { say(`· ok persona ${p.name}`); continue; }
    changes++; say(`✚ persona ${p.name}: +${fresh.length} receipt(s)${p.notes && !String(cur.notes || "").includes(MARK) ? " +truth" : ""}`);
    if (!DRY_RUN) await actor.setFlag(MV, "persona", next);
  }

  // ── report + write ─────────────────────────────────────────────────────────
  console.log(`[seed-story-flow-acts-0-2] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Story-flow seeder DRY RUN: ${changes} change(s) (console). Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-story-flow-${Date.now()}.json`);
  save(regWasStr ? regRaw : JSON.stringify(regRaw || {}), "text/json", `backup-quests-before-story-flow-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  await game.settings.set(NS, "quests", regWasStr ? JSON.stringify(reg) : reg);
  ui.notifications.info(`Story-flow seeder APPLIED: ${changes} change(s). Backups downloaded. F5, then run bin/ft-replay-story on a fresh save.`);
})();

/* patch-wick-likable-act1-2026-10-25.macro.js — Pilgrim Wick is LIKABLE in Act 1; the suspicion opens in Act 2 (Dave, 2026-10-25).
 *  Why: the Guest Who Keeps Vigil = Jeargan (Ninth Guest canon 2026-10-25); the players should like him before they doubt him.
 *  Act 1:
 *   NEW   ag_walk_wick                "The Pilgrim on the Ladder" — GUARANTEED on the Welcome Round: Joan's "Walk your new town"
 *                                     goes through it the first time (twin choice), + a fallback row on the town walk menu.
 *   EDIT  ag_vacancy_pilgrim_wick     Verna is his biggest fan (no "new in town" vs "since the Cough" clash); knows the ladder.
 *   EDIT  ag_wick_the_flame           the nails line → {{#played ag_title_card}} (Act 2 only); Memory drops it; hands check + third candle → Act 2.
 *   EDIT  ag_wick_the_shrines         Act 1: "you'll look for them on the way up the mountain" — no free day trip.
 *   EDIT  ag_wick_shrine              a REAL trip: pinLeg { to: Khezek-Tor }, Act 2, needs ag_wick_the_shrines; rides on instead of "go back down".
 *   EDIT  ag_wick_the_bed             "Ask Verna which room is his" → Act 2.
 *   EDIT  allesh_gilliam_tamsin_welcome  the Wick question leaves the Act-1 welcome (his Act-2 conversation already has it).
 *  Act 2 gates (storyPhase ≥ 2): ag_vacancy_pilgrim_wick_routes' secret check, ag_tamsin_on_wick (+ its dead "Back to the bread"),
 *   ag_tallow_wick_routes_hit/miss, ag_tallow_flame_hit/miss, ag_tamsin_wick_slip_hit/miss, ag_vacancy_upstairs, ag_wick_room_heist_offer,
 *   ag_wick_room, ag_wick_room_caught.
 *  KT: "You know this man" (kt_courier_has_a_face + ag_tallow_courier_hit/miss) counts the ladder too.
 *  Idempotent; DRY_RUN default true; backs up `campaigns`; true copy via JSON (deepClone once made a write silently no-op). GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : JSON.parse(JSON.stringify(campsRaw));
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;
  const J = (v) => JSON.stringify(v);
  const need = (id) => { const b = byId.get(id); if (!b) report.push(`⚠ ${id}: not found`); return b; };
  const ch = (label, next, over = {}) => Object.assign({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "" }, over);

  // whole-description swap: old must contain `marker`; new is written verbatim
  const setDesc = (id, marker, to, note) => { const b = need(id); if (!b) return; const d = String(b.description || "");
    if (d === to) return report.push(`· ok ${id}: ${note}`);
    if (d.includes(marker)) { b.description = to; changes++; return report.push(`✚ ${id}: ${note}`); }
    report.push(`⚠ ${id}: baseline not found for "${note}" — left alone`); };
  const rep = (id, field, from, to, note) => { const b = need(id); if (!b) return; const d = String(b[field] || "");
    if (to && d.includes(to)) return report.push(`· ok ${id}: ${note}`);
    if (d.includes(from)) { b[field] = d.replace(from, to); changes++; return report.push(`✚ ${id}: ${note}`); }
    report.push(`⚠ ${id}: baseline ${field} not found for "${note}"`); };
  // beat gate: storyPhase ≥ 1 → ≥ 2
  const act2 = (id) => { const b = need(id); if (!b) return; b.inject = b.inject || {}; const rq = Array.isArray(b.inject.requires) ? b.inject.requires : (b.inject.requires = []);
    const ph = rq.find(r => r && r.flag === "storyPhase" && r.gte != null);
    if (ph && Number(ph.gte) >= 2) return report.push(`· ok ${id}: Act 2+`);
    if (ph) ph.gte = 2; else rq.unshift({ flag: "storyPhase", gte: 2 });
    changes++; report.push(`✚ ${id}: gate → storyPhase ≥ 2`); };
  const findChoice = (b, label) => (b?.choices || []).find(c => c && c.label === label);
  // choice gate: add {flag storyPhase gte 2} to a choice's requires
  const choiceAct2 = (id, label) => { const b = need(id); if (!b) return; const c = findChoice(b, label); if (!c) return report.push(`⚠ ${id}: choice "${label}" not found`);
    const rq = Array.isArray(c.requires) ? c.requires : (c.requires ? [c.requires] : []);
    if (rq.some(r => r && r.flag === "storyPhase" && Number(r.gte) >= 2)) return report.push(`· ok ${id}: "${label}" Act 2+`);
    c.requires = [{ flag: "storyPhase", gte: 2 }, ...rq]; changes++; report.push(`✚ ${id}: "${label}" → Act 2+`); };
  const dropChoice = (id, label) => { const b = need(id); if (!b) return; const i = (b.choices || []).findIndex(c => c && c.label === label);
    if (i < 0) return report.push(`· ok ${id}: "${label}" already gone`); b.choices.splice(i, 1); changes++; report.push(`✚ ${id}: "${label}" removed`); };

  const WICK = "Vv8mDrdsPJnCBLeA";
  const WALK = "allesh_gilliam_town_walk", LADDER = "ag_walk_wick";

  // ── 1. NEW: the Pilgrim on the Ladder ──────────────────────────────────────
  const walk = need(WALK), joan = need("avuncular_joans_speech");
  if (!byId.get(LADDER) && walk) {
    const nb = {
      id: LADDER, label: "Allesh-Gilliam — The Pilgrim on the Ladder", type: "dialog", timeScale: "scene", tags: "allesh_gilliam,wick-cover", politicalTags: "",
      questId: joan?.questId || walk.questId || null, questStep: (Number(joan?.questStep) || 20) + 1, story: { quest: "allesh_gilliam" },
      speakerActorId: WICK, sceneId: walk.sceneId || null,
      outcomes: { success: null, failure: null }, actors: [], encounter: { key: "", tier: null, actorName: "" },
      worldEffects: { territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [] },
      inject: { repeatable: false, oncePerHex: false, requires: [{ flag: "storyPhase", gte: 1 }] },
      playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true, refs: {},
      description: "Halfway down the second street the wall creaks, the chimes answer, and one of them doesn't: it's in the dust, and a road-worn Menhirkin in a walker's coat is already up a ladder putting it back. Nobody asked him. Nobody ever does, says the woman holding the ladder; he's just there, the way weather is, only useful.\n\nHe comes down, squares the ladder against the wall, and stands the way people stand when the pastor calls for it. \"Pilgrim Wick. Of the old routes. You'll be the coalition.\" He asks nothing else. He tells you where everything is, and exactly when: Pike is in by seven. Etta opens at nine and the good stalls are gone by ten. Soup at St Gilliam's is at noon, and early is better. Verna serves breakfast until the second bell and not one minute after.\n\n\"If you need anything carried, I'm at the Vacancy. I'm mostly not, but that's where to leave word.\" He's off to help someone with a cart before you finish thanking him. The kid who was walking in your footsteps is walking in his now.",
      memoryText: "Pilgrim Wick put a fallen wind chime back up on the second street without being asked, and told the Stewards exactly when everything in town opens.",
      choices: [ch("Walk on. The town wants to be met.", WALK, { description: "Six doors, any order. You know what time they all open now." })]
    };
    const at = camp.beats.findIndex(b => b?.id === "avuncular_joans_speech"); camp.beats.splice(at >= 0 ? at + 1 : camp.beats.length, 0, nb); byId.set(LADDER, nb);
    changes++; report.push(`✚ ${LADDER}: new beat (The Pilgrim on the Ladder)`);
  } else if (byId.get(LADDER)) report.push(`· ok ${LADDER} exists`);

  // Joan's sendoff → the ladder the first time, the walk after (twin rows, same label)
  if (joan) {
    const cs = joan.choices || (joan.choices = []);
    const toLadder = cs.find(c => c && c.label === "Walk your new town" && c.next === LADDER);
    const toWalk = cs.find(c => c && c.label === "Walk your new town" && c.next === WALK);
    if (toLadder && toWalk) report.push("· ok avuncular_joans_speech: twin Walk rows");
    else if (toWalk && !toLadder) {
      const i = cs.indexOf(toWalk);
      cs.splice(i, 0, ch("Walk your new town", LADDER, { description: toWalk.description, requires: [{ beatMark: LADDER, not: true }] }));
      toWalk.requires = [{ beatMark: LADDER }];
      changes++; report.push("✚ avuncular_joans_speech: \"Walk your new town\" → the ladder first, the walk after");
    } else report.push("⚠ avuncular_joans_speech: no \"Walk your new town\" → town walk row found");
  }
  // fallback: a party that reaches the walk any other way still meets him
  if (walk) {
    const cs = walk.choices || (walk.choices = []);
    if (cs.some(c => c && c.next === LADDER)) report.push("· ok town walk: ladder row");
    else { cs.unshift(ch("The pilgrim on the ladder", LADDER, { description: "Someone is putting the town's chimes back up.", requires: [{ beatMark: LADDER, not: true }] })); changes++; report.push("✚ allesh_gilliam_town_walk: + \"The pilgrim on the ladder\" (until met)"); }
  }

  // ── 2. The Vacancy: Verna is a fan ─────────────────────────────────────────
  setDesc("ag_vacancy_pilgrim_wick", "Which is probably why Verna is smiling",
    "Verna's ledger has one name in it tonight, and it's her favorite.\n\nHe's in the corner with his boots off and lined up square — a road-worn Menhirkin in a walker's coat — and he stands when you come in the way people stand when the pastor calls for it.\n\n{{#played ag_walk_wick}}\"Stewards.\" He looks honestly glad. \"Did you make the soup on time?\"{{else}}\"Pilgrim Wick,\" he says. \"Of the old routes.\"{{/played}}\n\nVerna doesn't lower her voice, because she wants him to hear it. \"I didn't trust him. A man who pays for a bed and never sleeps in it, what's he doing all night? Then I worked it out. Nothing. He's out on the road being a saint, and I've got a room I never turn down, sheets I never wash, and rent to the mark every week since the night of the Cough. He fixed the ice machine. He carried the Hendersons' piano. Favorite guest.\" She points her pen at you. \"Don't tell the others.\"\n\nWick sits back down, pink around the ears, the way stone gets when it's trying not to be pleased. He tells you where he's been: St Gilliam's for the candles, the high shrines above Khezek Tor, and here, for the bed he doesn't use.",
    "Verna is his biggest fan; knows the ladder");

  // ── 3. The flame: the nails are Act 2 ──────────────────────────────────────
  rep("ag_wick_the_flame", "description", "A short one drowns.\" He turns a hand over: something pale under the nails.",
    "A short one drowns.\"{{#played ag_title_card}} He turns a hand over: something pale under the nails.{{/played}}", "nails line → Act 2 only");
  rep("ag_wick_the_flame", "memoryText", " — a long one smokes, a short one drowns — and turned a hand over: something pale under the nails.",
    " — a long one smokes, a short one drowns.", "Memory drops the nails");
  choiceAct2("ag_wick_the_flame", "Look at his hands.");
  choiceAct2("ag_wick_the_flame", "\"Can I watch you trim?\"");   // the third candle waits for the suspicion (10-20 ruling)

  // ── 4. The shrines: a real trip, in Act 2 ──────────────────────────────────
  { const b = need("ag_wick_the_shrines"); if (b) {
      const OLD = "Go and look. Ride up the switchbacks to the first shrine.", NEW = "Look for them next time you're headed up the mountain.";
      const c = findChoice(b, OLD) || findChoice(b, NEW);
      if (!c) report.push("⚠ ag_wick_the_shrines: trip choice not found");
      else if (c.label === NEW && !c.next) report.push("· ok ag_wick_the_shrines: no free trip");
      else { c.label = NEW; c.next = ""; c.description = "He looks genuinely pleased. \"The first is an hour above the last farm, where the road bends hard. Leave it as you find it.\""; changes++; report.push("✚ ag_wick_the_shrines: the free day trip → \"look for them on the way up\""); } } }
  { const b = need("ag_wick_shrine"); if (b) {
      if (J(b.pinLeg) !== J({ to: "Khezek-Tor" })) { b.pinLeg = { to: "Khezek-Tor" }; b.where = "anywhere"; changes++; report.push("✚ ag_wick_shrine: pinLeg → Khezek-Tor (fires on the ride up)"); } else report.push("· ok ag_wick_shrine: pinned");
      const want = [{ flag: "storyPhase", gte: 2 }, { beatMark: "ag_wick_the_shrines" }];
      b.inject = b.inject || {}; if (J(b.inject.requires) !== J(want)) { b.inject.requires = want; b.inject.repeatable = false; changes++; report.push("✚ ag_wick_shrine: Act 2 + heard about the shrines"); } else report.push("· ok ag_wick_shrine gate");
      setDesc("ag_wick_shrine", "You went to look, which the pilgrim did not expect",
        "On the ride up to Khezek Tor, an hour above the last farm, the road bends hard, and there it is, exactly where the pilgrim said: a niche cut into the rock, a flat stone, a wax candle burned to a careful stub with the wick trimmed exactly. Under it sits a drip tray, the same make as the ones at St Gilliam's. The tray is empty. The wax in it has been scraped, recently, by something flat, the way you'd lift a folded thing out without tearing it. Further up, where the road bends again, you can see the next one. Somebody is keeping a road.",
        "the shrine is met on the road");
      const back = findChoice(b, "Go back down.");
      if (back) { back.label = "Ride on."; back.next = ""; back.description = "Up the switchbacks. The next shrine is where he said it would be, and the one after that."; changes++; report.push("✚ ag_wick_shrine: \"Go back down\" → \"Ride on\" (you're travelling)"); }
      else if (findChoice(b, "Ride on.")) report.push("· ok ag_wick_shrine: Ride on");
      else report.push("⚠ ag_wick_shrine: exit choice not found"); } }

  // ── 5. The bed, the room, Tamsin, the checks → Act 2 ───────────────────────
  choiceAct2("ag_wick_the_bed", "Ask Verna which room is his.");
  choiceAct2("ag_vacancy_pilgrim_wick_routes", "Breathe in. Something about him is off.");
  dropChoice("allesh_gilliam_tamsin_welcome", "Ask about the pilgrim who trims your candles.");
  dropChoice("ag_tamsin_on_wick", "Back to the bread.");
  for (const id of ["ag_tamsin_on_wick", "ag_tamsin_wick_slip_hit", "ag_tamsin_wick_slip_miss",
                    "ag_tallow_wick_routes_hit", "ag_tallow_wick_routes_miss", "ag_tallow_flame_hit", "ag_tallow_flame_miss",
                    "ag_vacancy_upstairs", "ag_wick_room_heist_offer", "ag_wick_room", "ag_wick_room_caught"]) act2(id);

  // ── 6. KT toll post: meeting him on the ladder counts as knowing him ──────
  const KNOW = [{ anyOf: [{ beatMark: "ag_vacancy_pilgrim_wick" }, { beatMark: LADDER }] }];
  const DONT = [{ beatMark: "ag_vacancy_pilgrim_wick", not: true }, { beatMark: LADDER, not: true }];
  for (const id of ["kt_courier_has_a_face", "ag_tallow_courier_hit", "ag_tallow_courier_miss"]) {
    const b = need(id); if (!b) continue;
    const k = (b.choices || []).find(c => c && /^You know this man/.test(c.label)), n = (b.choices || []).find(c => c && /^You don't know him/.test(c.label));
    if (!k || !n) { report.push(`⚠ ${id}: know/don't-know rows not found`); continue; }
    if (J(k.requires) === J(KNOW) && J(n.requires) === J(DONT)) { report.push(`· ok ${id}: ladder counts`); continue; }
    k.requires = KNOW; n.requires = DONT; changes++; report.push(`✚ ${id}: "You know this man" counts the ladder`);
  }

  console.log(`[wick likable act1 2026-10-25] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-wick-likable-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Wick is likable in Act 1.`);
})();

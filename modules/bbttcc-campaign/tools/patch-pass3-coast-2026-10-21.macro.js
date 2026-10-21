/* patch-pass3-coast-2026-10-21.macro.js — Story Review Ledger PASS 3, Coast towns table (P3-A1…A32), all 32 ACCEPTED by Dave 2026-10-21.
 *  Text rows as proposed, with Dave's notes honoured:
 *   A8  the first shrine is an EXPLICIT trip: "Go and look. Ride up the switchbacks to the first shrine." → the shrine beat opens "You went to look…";
 *       "Go back down." now returns to the Vacancy.
 *   A17 Dave's wording ("mega hit everybody can hum/mosh to"); A18 "(among other things)" added to both blurbs (script arrival + quest registry).
 *   A19 NO CHANGE — "Master Pike" is Tamsin's jibe (Dave). A27 NO CHANGE — "economy marks" labels the kind of mark on offer (Dave).
 *   A28 no "ifs": {{#played allesh_gilliam_muster_intro}} militia / Stewards escort, and a HANDBELL (the Muster bell is mounted).
 *  Gates: A1/A15 drop {flag storyPhase lte 1} on allesh_gilliam_waiting_room_intro, ag_greeley_answer_cough, allesh_gilliam_vacancy_intro.
 *  Routes: A16 ag_confessor_exposed gains Leave → allesh_gilliam_introduction_to_hq. Memory lines: A7 / A9 / A10 / A29.
 *  Idempotent; DRY_RUN default true; backs up `campaigns` (and writes `quests` for A18). GM only.
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
  const report = []; let changes = 0; let questsDirty = false;
  const fieldRep = (field) => (id, from, to, note) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; }
    const d = String(b[field] || "");
    if (to && !from.includes(to) && d.includes(to)) { report.push(`· ok ${id}: ${note}`); return; }
    if (d.includes(from)) { b[field] = d.replace(from, to); changes++; report.push(`✚ ${id}: ${note}`); return; }
    if (to === "" || (to && d.includes(to))) { report.push(`· ok ${id}: ${note}`); return; }
    report.push(`⚠ ${id}: baseline ${field} not found for "${note}"`);
  };
  const rep = fieldRep("description"), repMem = fieldRep("memoryText");
  const prefix = (id, from, to, note) => { const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; } const d = String(b.description || "");
    if (d.startsWith(to)) { report.push(`· ok ${id}: ${note}`); return; } if (d.startsWith(from)) { b.description = to + d.slice(from.length); changes++; report.push(`✚ ${id}: ${note}`); return; } report.push(`⚠ ${id}: baseline not found for "${note}"`); };
  const relabel = (id, from, to, note) => { const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; } if (b.label === to) { report.push(`· ok ${id}: ${note}`); return; } if (b.label === from) { b.label = to; changes++; report.push(`✚ ${id}: ${note}`); return; } report.push(`⚠ ${id}: label is not the expected baseline — skipped`); };
  const choice = (id, label, field, from, to, note) => { const b = byId.get(id); const c = b?.choices?.find(x => x.label === label) || b?.choices?.find(x => String(x[field] ?? "") === to); if (!c) { report.push(`⚠ ${id}: choice "${label}" not found`); return; }
    const cur = String(c[field] ?? ""); if (cur === to || (field !== "label" && to && !from.includes(to) && cur.includes(to))) { report.push(`· ok ${id}: ${note}`); return; }
    if (cur === from) { c[field] = to; changes++; report.push(`✚ ${id}: ${note}`); return; } if (from && cur.includes(from)) { c[field] = cur.replace(from, to); changes++; report.push(`✚ ${id}: ${note}`); return; } report.push(`⚠ ${id}: choice "${label}" ${field} is not the expected baseline — skipped`); };
  const dropGate = (id) => { const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; } const rq = b.inject?.requires; if (!Array.isArray(rq)) { report.push(`· ok ${id}: no gate list`); return; }
    const n = rq.length; b.inject.requires = rq.filter(r => !(r && r.flag === "storyPhase" && r.lte === 1)); if (b.inject.requires.length < n) { changes++; report.push(`✚ ${id}: storyPhase ≤ 1 gate dropped (A1/A15)`); } else report.push(`· ok ${id}: no upper gate`); };

  rep("ag_confessor_counterfeit", "You say nothing. You smile, accept the tea, and lie. Repeatedly. Creatively.", "You say nothing of what you'll do with it. You tell him to keep the candle moving — the mountain's mercy needs him exactly where he is — and he believes you, because he wants to. Then you lie to him. Repeatedly. Creatively.", "A2 counterfeit after the confession");
  rep("fates_and_destinies_6", "In fact, because He kept trying to fix Reality,", "In fact, He kept trying to fix Reality,", "A3 slide 6 sentence completes");
  rep("ag_tamsin_answer_building", "no matter ... \"he turns to look over his shoulder at a man sitting at a table talking with a few other locals ... \" WHAT YOU SAY GARY", "no matter ...\" he turns to look over his shoulder at a man sitting at a table talking with a few other locals \"... WHAT YOU SAY GARY", "A4 Gary's quotation marks");
  rep("ag_vacancy_upstairs", "a hall of numbered doors and a runner rug", "a hall of named doors and a runner rug", "A5 named doors");
  rep("ag_vacancy_pilgrim_wick", "Verna's ledger has one name in it, and he's new in town.", "Verna's ledger has one name in it tonight, and he's new in town.", "A6 one name tonight");
  repMem("ag_wick_the_flame", "Pilgrim Wick keeps 'the eternal flame of civilization' and trims only wax candles: 'my order won't feed the flame on fat.'", "Pilgrim Wick talked about wicks — a long one smokes, a short one drowns — and turned a hand over: something pale under the nails.", "A7 Memory says only what the card says");
  choice("ag_wick_the_shrines", "Climb to the first one.", "description", "", "A day there and back, up into the wind. Verna will keep the room.", "A8 trip after-text");
  choice("ag_wick_the_shrines", "Climb to the first one.", "label", "Climb to the first one.", "Go and look. Ride up the switchbacks to the first shrine.", "A8 an explicit trip");
  rep("ag_wick_shrine", "An hour above the last farm the road bends hard, and there it is:", "You went to look, which the pilgrim did not expect and did not mind. It is a day's ride there and back, up the switchbacks and into the wind, and an hour above the last farm the road bends hard, and there it is:", "A8 the shrine knows you chose to come");
  choice("ag_wick_shrine", "Go back down.", "next", "", "allesh_gilliam_vacancy_intro", "A8 back down to the Vacancy");
  choice("ag_wick_shrine", "Go back down.", "description", "", "Down the switchbacks before dark. The Vacancy keeps a lamp on.", "A8 back down after-text");
  repMem("ag_wick_room_heist_offer", "Slipped into the pilgrim's room at the Vacancy. Your first Heist.", "Found the starred door at the Vacancy. A Heist was offered.", "A9 the offer is not the break-in");
  repMem("ag_wick_room", "Wick's room at the Vacancy:", "Slipped into the pilgrim's room at the Vacancy — your first Heist. Wick's room:", "A9 the break-in Memory moves to the room");
  rep("ag_tallow_wick_routes_miss", "\n\n*Memory: The party looked hard at the pilgrim and did not catch what was off about him.*", "", "A10 the Memory line was in the card twice");
  choice("ag_ride_fixit", "Actually — back to the Crossroads", "label", "Actually — back to the Crossroads", "Actually — back to the HQ", "A11 label matches the destination");
  choice("ag_leygate_delivery", "Ask what really happened, the night it flickered", "description", "He'll answer while he works — the technical account first, precise as a certification. Whether you get the human account depends on who's been carrying what.", "He answers while he works, precise as a certification: \"Stabilizer lied. Gate believed it. Gate's been apologising ever since.\" The human account he keeps for after the install, and the install comes first.", "A12 the account is delivered in the after-text");
  rep("ag_first_turn_why", "The road to Khezek-Tor showed its teeth today, and the smelter trade runs along it.", "{{#played ag_ride_khezek_tor}}The road to Khezek-Tor showed its teeth today{{else}}The road to Khezek-Tor has teeth — ask anyone who hauls ore{{/played}}, and the smelter trade runs along it.", "A13 knows which road was ridden");
  rep("allesh_gilliam_etta_bloom_conversation_protecting", "“No. The fucking cowards did their business and vanished, the poor miserable dears. But we would love to find them and have a talk.”", "“No. Protecting is what you do for a thing you understand. They're squatting on it — and the ones who DID understand it did their business and vanished, the poor miserable dears. We would love to find them and have a talk.”", "A14 the cowards are the seal-makers");
  rep("avuncular_joans_speech", "She quoted one of her own songs at you, Avuncular Joans and The Idle Compaction, the one everybody can hum.", "She's quoting one of her own songs at you — the Avuncular Joans and The Idle Compaction mega hit everybody can hum/mosh to.", "A17 Dave's wording");
  relabel("allesh_gilliam_marshall_yarrow_convo", "Allesh-Gilliam - Marshall Yarrow Convo", "Allesh-Gilliam - Marshal Yarrow Convo", "A20 Marshal, one l");
  relabel("allesh_gilliam_marshall_yarrow_convo_1", "Allesh-Gilliam - Marshall Yarrow Convo, 1", "Allesh-Gilliam - Marshal Yarrow Convo, 1", "A20 Marshal, one l");
  relabel("allesh_gilliam_marshall_yarrow_convo_2", "Allesh-Gilliam - Marshall Yarrow Convo, 2", "Allesh-Gilliam - Marshal Yarrow Convo, 2", "A20 Marshal, one l");
  relabel("allesh_gilliam_marshall_yarrow_convo_3", "Allesh-Gilliam - Marshall Yarrow Convo, 3", "Allesh-Gilliam - Marshal Yarrow Convo, 3", "A20 Marshal, one l");
  relabel("allesh_gilliam_marshall_yarrow_convo_4", "Allesh-Gilliam - Marshall Yarrow Convo, 4", "Allesh-Gilliam - Marshal Yarrow Convo, 4", "A20 Marshal, one l");
  relabel("allesh_gilliam_marshall_yarrow_echo", "Allesh-Gilliam - Marshall Yarrow, Echo", "Allesh-Gilliam - Marshal Yarrow, Echo", "A20 Marshal, one l");
  rep("allesh_gilliam_introduction_to_hq", "we need a replacement Leygate Stabilizer", "we need a replacement Leyline Stabilizer", "A21 Leyline Stabilizer");
  choice("allesh_gilliam_introduction_to_hq", "Ride for Furrier's Fixit Farm", "description", "A third sign, nailed on later: WE FIX IT (MOSTLY). It sits on the road either way.", "At the Crossroads a third sign, nailed on later, reads WE FIX IT (MOSTLY). It sits on the road either way.", "A22 the sign is at the Crossroads");
  rep("thatwards_ho_opening_scene", "receipts of the Attaccountants", "receipts of the Attackountants", "A23 Attackountants");
  rep("reliable_the_lease", "in a neat, crisp, hand:", "in a neat, crisp hand:", "A24 stray comma");
  choice("reliable_the_lease", "Brew Young Gearbox's forgotten coffee", "description", "And all the coffee you have so far, narratively, have been canonically AWFUL.", "And all the coffee you've had so far, narratively, has been canonically AWFUL.", "A25 coffee grammar");
  rep("reliable_lease_terms", "Thirty marks from the coalition treasury", "Thirty marks from your Domain's treasury", "A26 Domain's treasury (terms)");
  rep("ag_first_pay", "paid into the coalition treasury", "paid into your Domain's treasury", "A26 Domain's treasury (first pay)");
  rep("ag_plumb_to_the_wall", "slowly, with a lot of people around him, and with a bell.", "slowly, {{#played allesh_gilliam_muster_intro}}with a dozen of Captain Brakk's militia around him{{else}}with the Stewards on either side of him{{/played}}, and with a handbell going the whole way.", "A28 the escort the system knows about, and a handbell");
  repMem("ag_plumb_to_the_wall", "and jumped That One Night and the crew who patched", "and jumped That One Night; the crew who patched", "A29 Memory run-on");
  rep("allesh_gilliam_etta_bloom_conversation", "a carved sigil, clean lines, fresh.", "a sigil, clean lines, fresh.", "A30 a sketch, not carved");
  rep("ag_leygate_visit", "Furrier's Fixit.<p>He wipes", "Furrier's Fixit.</p><p>He wipes", "A31 paragraph break (close)");
  prefix("ag_leygate_visit", "The Leygate hums the way a man hums", "<p>The Leygate hums the way a man hums", "A31 paragraph break (open)");
  choice("ag_days_end", "The turn is locked. Run it.", "label", "The turn is locked. Run it.", "Lock the turn. Run it.", "A32 label asks for the plans first");

  // A1 / A15 — the Act-1 doors stay open in Act 2
  dropGate("allesh_gilliam_waiting_room_intro"); dropGate("ag_greeley_answer_cough"); dropGate("allesh_gilliam_vacancy_intro");
  // A16 — Daylight gets an exit
  { const b = byId.get("ag_confessor_exposed"); if (!b) report.push("⚠ ag_confessor_exposed: not found"); else if ((b.choices || []).some(c => c.next === "allesh_gilliam_introduction_to_hq")) report.push("· ok ag_confessor_exposed: Leave exists");
    else { b.choices = b.choices || []; b.choices.push({ label: "Leave", next: "allesh_gilliam_introduction_to_hq", description: "", checkStat: "", checkDC: 0, failNext: "" }); changes++; report.push("✚ ag_confessor_exposed: Leave → HQ (A16)"); } }
  // A18 — AJ, not Joan, in both blurbs
  const BLURB_FROM = "Joan handed you a fortress, a farm, and a hole in the ground, told you", BLURB_TO = "AJ handed you a fortress, a farm, and a hole in the ground (among other things), told you";
  { const arr = camp.story?.scripts?.allesh_gilliam?.arrival; if (arr && typeof arr.description === "string") { if (arr.description.includes(BLURB_TO)) report.push("· ok script arrival blurb"); else if (arr.description.includes(BLURB_FROM)) { arr.description = arr.description.replace(BLURB_FROM, BLURB_TO); changes++; report.push("✚ allesh_gilliam script arrival blurb: AJ (A18)"); } else report.push("⚠ script arrival blurb: baseline not found"); } else report.push("· (no script arrival description to edit)"); }
  let quests = null, questsWasStr = false;
  try { const qRaw = game.settings.get(NS, "quests"); if (qRaw) { questsWasStr = typeof qRaw === "string"; quests = questsWasStr ? JSON.parse(qRaw) : foundry.utils.deepClone(qRaw); } } catch (_e) {}
  if (quests && typeof quests === "object") { for (const [k, q] of Object.entries(quests)) { if (q && typeof q.arrivalDescription === "string") { if (q.arrivalDescription.includes(BLURB_TO)) report.push(`· ok quests[${k}] arrival blurb`); else if (q.arrivalDescription.includes(BLURB_FROM)) { q.arrivalDescription = q.arrivalDescription.replace(BLURB_FROM, BLURB_TO); changes++; questsDirty = true; report.push(`✚ quests[${k}] (${q.name}) arrival blurb: AJ (A18)`); } } } }
  else report.push("· (quests registry not available here — the registry blurb is written on the live seat)");

  console.log(`[pass3 coast 2026-10-21] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-pass3-coast-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (questsDirty) await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(quests) : quests);
  ui.notifications.info(`Applied ${changes} change(s) — Pass 3, Coast towns.`);
})();

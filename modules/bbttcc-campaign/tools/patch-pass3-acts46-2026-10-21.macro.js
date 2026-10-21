/* patch-pass3-acts46-2026-10-21.macro.js — Story Review Ledger PASS 3, Acts 4–6 table (P3-4-1…4-41), all 41 ACCEPTED by Dave 2026-10-21.
 *  Dave's wording on 4-11 (Mara came for you herself, excitable as always, but clearly tense), 4-20 ("Those consequences though ..."), 4-36, 4-37.
 *  4-1 is the beat's hexName field (the text never said "two days inland" — nothing else to change). 4-2 = choice label + beat title + finale step label.
 *  4-7 extends the any-of gate; 4-8 swaps the Maccio gate for an any-of. 4-29 NO-OP (two different isNot conditions were rendered alike). 4-32: Dave
 *  asked for the Steward who rolled lowest BY NAME — no such story token exists; written as "whichever Steward" for now (engine follow-up).
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
    if (cur === from) { c[field] = to; changes++; report.push(`✚ ${id}: ${note}`); return; } if (from && cur.includes(from)) { c[field] = cur.replace(from, to); changes++; report.push(`✚ ${id}: ${note}`); return; } if (to && cur.includes(to)) { report.push(`· ok ${id}: ${note}`); return; } report.push(`⚠ ${id}: choice "${label}" ${field} is not the expected baseline — skipped`); };
  const dropGate = (id) => { const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; } const rq = b.inject?.requires; if (!Array.isArray(rq)) { report.push(`· ok ${id}: no gate list`); return; }
    const n = rq.length; b.inject.requires = rq.filter(r => !(r && r.flag === "storyPhase" && r.lte === 1)); if (b.inject.requires.length < n) { changes++; report.push(`✚ ${id}: storyPhase ≤ 1 gate dropped (A1/A15)`); } else report.push(`· ok ${id}: no upper gate`); };


  const full = (id, from, to, note) => { const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; } const d = String(b.description || "");
    if (d === to) { report.push(`· ok ${id}: ${note}`); return; } if (d === from) { b.description = to; changes++; report.push(`✚ ${id}: ${note}`); return; } report.push(`⚠ ${id}: live description is not the expected baseline — skipped`); };
  const addChoice = (id, label, description, next, requires, note) => { const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; } b.choices = b.choices || [];
    if (b.choices.some(c => c.label === label)) { report.push(`· ok ${id}: ${note}`); return; } const row = { label, next, description, checkStat: "", checkDC: 0, failNext: "" }; if (requires) row.requires = requires; b.choices.push(row); changes++; report.push(`✚ ${id}: ${note}`); };
  const setField = (id, field, from, to, note) => { const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; } if (b[field] === to) { report.push(`· ok ${id}: ${note}`); return; } if (b[field] === from) { b[field] = to; changes++; report.push(`✚ ${id}: ${note}`); return; } report.push(`⚠ ${id}: ${field} is not the expected baseline — skipped`); };
  const stepLabel = (scriptKey, stepId, from, to, note) => { const sc = camp.story?.scripts?.[scriptKey]; const st = (sc?.steps || []).find(s => s.id === stepId); if (!st) { report.push(`⚠ step ${scriptKey}.${stepId}: not found`); return; }
    if (st.label === to) { report.push(`· ok step ${scriptKey}.${stepId}: ${note}`); return; } if (st.label === from) { st.label = to; changes++; report.push(`✚ step ${scriptKey}.${stepId}: ${note}`); return; } report.push(`⚠ step ${scriptKey}.${stepId}: label baseline not found`); };
  const extendAnyOf = (id, ids, note) => { const b = byId.get(id); const rq = b?.inject?.requires; const any = Array.isArray(rq) ? rq.find(r => r && Array.isArray(r.anyOf)) : null; if (!any) { report.push(`⚠ ${id}: no anyOf gate`); return; }
    const have = new Set(any.anyOf.map(x => x.beatMark)); const missing = ids.filter(x => !have.has(x)); if (!missing.length) { report.push(`· ok ${id}: ${note}`); return; } for (const m of missing) any.anyOf.push({ beatMark: m }); changes++; report.push(`✚ ${id}: ${note} (+${missing.length})`); };
  const swapGate = (id, from, to, note) => { const b = byId.get(id); const rq = b?.inject?.requires; if (!Array.isArray(rq)) { report.push(`⚠ ${id}: no gate list`); return; } const F = JSON.stringify(from), T = JSON.stringify(to);
    if (rq.some(r => JSON.stringify(r) === T)) { report.push(`· ok ${id}: ${note}`); return; } const i = rq.findIndex(r => JSON.stringify(r) === F); if (i < 0) { report.push(`⚠ ${id}: gate baseline not found`); return; } rq[i] = to; changes++; report.push(`✚ ${id}: ${note}`); };
  const dropGateCond = (id, cond, note) => { const b = byId.get(id); const rq = b?.inject?.requires; if (!Array.isArray(rq)) { report.push(`⚠ ${id}: no gate list`); return; } const C = JSON.stringify(cond); const n = rq.length; b.inject.requires = rq.filter(r => JSON.stringify(r) !== C);
    if (b.inject.requires.length < n) { changes++; report.push(`✚ ${id}: ${note}`); } else report.push(`· ok ${id}: ${note}`); };
  const questTextAll = (id, from, to, note) => { const b = byId.get(id); const qs = b?.worldEffects?.questEffects || []; let n = 0; for (const q of qs) { if (typeof q.text === "string" && q.text.includes(from)) { q.text = q.text.split(from).join(to); n++; } }
    if (n) { changes++; report.push(`✚ ${id}: ${note}`); } else report.push(qs.some(q => String(q.text || "").includes(to)) ? `· ok ${id}: ${note}` : `⚠ ${id}: quest text baseline not found`); };

  setField("raid_thatwards_ho_finale_entry", "hexName", "Inconvenient Mountains.h", "Hexen Myre.o", "4-1 the finale beat sits on Hexen Myre.o");
  choice("raid_thatwards_ho_finale_entry", "Count your Operations first.", "label", "Count your Operations first.", "Count who came first.", "4-2 count who came (choice)");
  relabel("finale_count_the_coalition", "The Muster — Count Your Operations", "The Muster — Count Who Came", "4-2 count who came (beat title)");
  stepLabel("finale", "count", "Count Your Operations", "Count Who Came", "4-2 count who came (step)");
  choice("raid_thatwards_ho_finale_entry", "Slip in quiet (Infiltration)", "label", "Slip in quiet (Infiltration)", "Slip in quiet (Heist)", "4-3 Heist");
  choice("raid_thatwards_ho_finale_entry", "Hit them hard (Assault)", "label", "Hit them hard (Assault)", "Hit them hard (Battle)", "4-3 Battle");
  choice("raid_thatwards_assault_open", "Mid-battle: the blue rope turns.", "label", "Mid-battle: the blue rope turns.", "A Rider's relay crackles figures across the field.", "4-4 no spoiler in the label");
  choice("raid_thatwards_siege_open", "Mid-siege: the blue rope turns.", "label", "Mid-siege: the blue rope turns.", "From the bunker mouth, somebody is doing arithmetic.", "4-5 no spoiler in the label");
  rep("raid_thatwards_courtly_honest", "They know now that the place was injured, not merely tapped.", "They know now that the place was injured, not merely tapped. She slides the Spark across the table without looking at it. \"Take it. I was never told what it does. Now I know why.\"", "4-6 the honest Parley yields the Spark");
  extendAnyOf("raid_thatwards_outcome_neutral_spark", ["raid_thatwards_assault_success", "raid_thatwards_siege_success", "finale_leygate_arrival", "odie_tarvaan_falls", "odie_tarvaan_fires", "odie_yesod_secret"], "4-7 every path that hands over the Spark reaches neutral_spark");
  swapGate("finale_maccio_rides", {"beatMark": "bandit_summit_absorption"}, {"anyOf": [{"beatMark": "bandit_summit_absorption"}, {"beatMark": "bandit_summit_accord"}]}, "4-8 Accord tables get Maccio too");
  rep("raid_thatwards_infiltration_success", "Not a name — an account number, a shipping seal, and a signature nobody initials twice.", "Not a name — an account number, a shipping seal, and a signature nobody will own, initialled twice.", "4-9 matches the crates");
  full("maneuver_vault_the_containment_loop", "This room is quieter.\n\nToo quiet for a training facility.\n\nLights pulse slowly. A containment field hums — not as a threat, but as a lesson paused mid‑sentence.\n\nSomeone is inside.", "This room is quieter — too quiet for a training facility. Lights pulse slowly, and a containment field hums, not as a threat but as a lesson paused mid-sentence. Someone is inside it, cross-legged and concentrating. It is Pip. Of course it is Pip.", "4-10 the room names Pip before the buttons do");
  rep("maneuver_vault_missing_runner", "Mara sent for you, terse as always.", "Mara came for you herself, excitable as always, but clearly tense.", "4-11 Dave's wording");
  rep("maneuver_vault_honor_roll", "If Pip is on the honor roll, the Vault tells Patter the visiting hours without being asked twice. Family days were always the best days.", "{{#played maneuver_vault_pip_absored}}Pip is on the honor roll. The Vault tells Patter the visiting hours without being asked twice. Family days were always the best days.{{/played}}", "4-12 the honor roll knows");
  rep("enc_forgotten_yesterdays_donny_mixed", "And as we say among us dragons - \"May a shard of the light of the egg of the cosmos get stuck in yer craw good and hard so you get your shit together.\"", "\"And as we say among us dragons: may a shard of the light of the egg of the cosmos get stuck in yer craw good and hard so you get your shit together.\"", "4-13 Donny's proverb is Donny's");
  rep("gloomgill_question_1", "Who wins if you’re right? Who benefits if you're right?”", "Who wins if you’re right?”", "4-14..19 the question once");
  rep("gloomgill_question_2", "What did you break that wasn’t even playing? What did you destroy that did not oppose you?\"", "What did you break that wasn’t even playing?”", "4-14..19 the question once");
  rep("gloomgill_question_3", "If everyone did exactly what you did… what snaps first? If everyone copied you, what breaks first?\"", "If everyone did exactly what you did… what snaps first?”", "4-14..19 the question once");
  rep("gloomgill_question_5", "What problem did you skip instead of solving? Or, what problem did you AVOID solving?\"", "What problem did you skip instead of solving?”", "4-14..19 the question once");
  rep("gloomgill_question_6", "Who gets to decide when this stops? When it ends?”", "Who gets to decide when this stops?”", "4-14..19 the question once");
  rep("gloomgill_question_10", "If you vanish tomorrow, what’s still standing? If you disappear tomorrow, what remains?”", "If you vanish tomorrow, what’s still standing?”", "4-14..19 the question once");
  rep("gloomgill_fight", "**Gloomgill:** “No eliminations today. Just consequences.”", "“No eliminations today,” says Gloomgill. “Those consequences though ...”", "4-20 Dave's wording");
  choice("gloomgill_scoreboard", "Read it anyway.", "description", "⚙ GM: the ledger panel is yours", "Light on reed. Everything you did, in the order you did it, and the receipts beside it. ⚙ GM: the ledger panel is yours", "4-21 players see a line before the GM note");
  rep("maneuver_vault_slippage_chamber_success", "Enter pupil number to join training queue.", "Enter pupil number to join training queue. It does not wait for one. It never has.", "4-22 no number is ever asked for");
  rep("maneuver_vault_foyer_diplomacy_success", "Proceed to the Echo Vault.", "Proceed to the Echo Archive.", "4-23 Echo Archive");
  rep("maneuver_vault_infiltration_fail", "They bounce of you harmlessly", "They bounce off you harmlessly", "4-24 typo");
  rep("maneuver_vault_foyer_infiltration_failure", "I did not say \"Maneuver Vault Infiltration Mechanism 52603 Says.\"", "I did not say 'Maneuver Vault Infiltration Mechanism 52603 Says.'\"", "4-25 nested quotes");
  rep("maneuver_vault_foyer_violence_failure", "somewhere saying \"Don't\"\"", "somewhere saying 'Don't.'\"", "4-26 triple quote");
  rep("maneuver_vault_slippage_chamber", "places now lost to, well all sorts of things", "places now lost to, well, all sorts of things", "4-27 comma");
  rep("maneuver_vault_the_containment_loop_let_pip_learn", "The person inside, is, of course, Pip.", "The person inside is, of course, Pip.", "4-28 comma splice");
  rep("enc_forgotten_yesterdays_laser_bev_1", "Leaks. Feuds. tape disputes. heartbreak. concession routing. ghost inventory drift.", "Leaks. Feuds. Tape disputes. Heartbreak. Concession routing. Ghost inventory drift.", "4-30 capitals");
  rep("enc_forgotten_yesterdays_kickflip_lazarus_3", "“Style is not elegance. Style is not difficulty. Style is not looking expensive. Style is whether your body and your choice arrive in the same place at the same time. Style is honesty at speed.”", "“Style isn't elegance, or difficulty, or looking expensive. Style is whether your body and your choice arrive in the same place at the same time. Honesty at speed.”", "4-31 out of the not-not cadence");
  rep("enc_forgotten_yesterdays_kickflip_lazarus_runback", "rolls alongside the PC who wiped out hardest", "rolls alongside whichever Steward wiped out hardest", "4-32 no table jargon (a named-Steward token is an engine follow-up)");
  choice("raid_thatwards_infiltration_fail", "Be entertaining.", "description", "They are not angry. They are excited. Sklar wants to meet whoever touched the wrong knot.", "Sklar wants to meet whoever touched the wrong knot.", "4-33 no repeat of the card");
  rep("raid_thatwards_infiltration_success", "They did not mean to hurt Khezek-Tor.", "They did not mean to hurt Khezek Tor.", "4-34 Khezek Tor");
  questTextAll("raid_thatwards_rewards_major", "Thatward's Ho!", "Thatwards Ho!", "4-35 quest title (major)");
  questTextAll("raid_thatwards_rewards_standard", "Thatward's Ho!", "Thatwards Ho!", "4-35 quest title (standard)");
  rep("raid_thatwards_outcome_neutral_spark", "You got what you came for. Not elegantly. Not gloriously. But successfully enough that history will round in your favor.", "You got what you came for, successfully enough that history will round in your favor.", "4-36 Dave's wording");
  rep("raid_thatwards_rewards_standard", "Not friendship. Not exactly. But respect leaves useful wreckage.", "Respect leaves useful wreckage.", "4-37 Dave's wording");
  rep("raid_thatwards_assault_open", "If the Circuit Riders are with you, the field gets much louder and significantly more correct.", "{{#played finale_riders_ride}}With the Circuit Riders on the field it gets much louder and significantly more correct.{{/played}}", "4-38 the field knows who rode");
  rep("raid_thatwards_siege_open", "If the Circuit Riders assist, the perimeter becomes cleaner, more oppressive, and much harder to break.", "{{#played finale_riders_ride}}With the Circuit Riders on it, the perimeter is cleaner, more oppressive, and much harder to break.{{/played}}", "4-39 the perimeter knows who rode");
  rep("a6_title_card", "A mile before the river the birds stop.", "A mile before the lake the birds stop.", "4-40 Lake Suspicious");
  choice("gloomgill_final_fact", "Ask why he stopped teaching.", "description", "\"It was my math.\" He does not elaborate. The marsh, gently, applauds.", "\"I said. It was my math.\" He does not elaborate. The marsh, gently, applauds.", "4-41 he said already");

  console.log(`[pass3 acts46 2026-10-21] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-pass3-acts46-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Pass 3, Acts 4–6.`);
})();

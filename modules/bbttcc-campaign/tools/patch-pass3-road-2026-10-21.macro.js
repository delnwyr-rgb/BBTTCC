/* patch-pass3-road-2026-10-21.macro.js — Story Review Ledger PASS 3, "Act 2 · the road" table (P3-R1…R26): 25 ACCEPTED by Dave 2026-10-21, R24 = Discuss (Clarity is real — left alone).
 *  Text rows as proposed; R16 standardises on "Qliphothic" (Dave), R17 "Mara, was this PipnPatter's idea?" (Dave).
 *  R5: the card AND the Cadence door line (story.scripts.cadence.doors.cameo). R10: only the relabel (the "duplicate requirement" was two different
 *  isNot conditions rendered alike). R11: two GM-call rows on circuit_riders_chase_run. R12: "Up close." on the Seal cinematic (cinematics carry
 *  choices — the HQ cinematic does). R13: Green Ring whole-description, plinth paragraph kept. R25: the saloon cinematic rows relabelled, not removed.
 *  R26: NO-OP — live already uses <i>…</i>; the review dump rendered it as asterisks. R24: NOT applied (Discuss).
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
  const doorLine = (scriptKey, doorId, from, to, note) => { const sc = camp.story?.scripts?.[scriptKey]; const dr = (sc?.doors || []).find(x => x.id === doorId); if (!dr) { report.push(`⚠ door ${scriptKey}.${doorId}: not found`); return; }
    const l = String(dr.line || ""); if (l.includes(to)) { report.push(`· ok door ${scriptKey}.${doorId}: ${note}`); return; } if (l.includes(from)) { dr.line = l.replace(from, to); changes++; report.push(`✚ door ${scriptKey}.${doorId}: ${note}`); return; } report.push(`⚠ door ${scriptKey}.${doorId}: baseline not found`); };

  rep("vs_bridge_muster", "So: muster the coalition. Count your Operations. Ask the Circuit Riders", "So: muster the coalition. Count who came. Ask the Circuit Riders", "R1 count who came");
  rep("cadence_battle", "loud enough to feel in the teeth — and the raid begins.", "loud enough to feel in the teeth — and the Battle begins.", "R2 the Battle begins");
  rep("cadence_win_style", "It is a STANDING OBLIGATION: one raid, of your choosing, with the Cadence on your side of the floor.", "It is a STANDING OBLIGATION: one Battle, of your choosing, with the Cadence on your side of the floor.", "R3 one Battle");
  rep("cadence_parade", "presents the crew's respect, which is not a metaphor: one raid, of your choosing, with the Cadence on your side.", "presents the crew's respect, which is not a metaphor: one Battle, of your choosing, with the Cadence on your side.", "R4 one Battle");
  rep("cadence_cameo", "The owed raid can be called in: name the target", "The owed Battle can be called in: name the target", "R5 the owed Battle (card)");
  doorLine("cadence", "cameo", "The Cadence owes you a raid. Name the target", "The Cadence owes you a Battle. Name the target", "R5 the owed Battle (door)");
  relabel("cadence_cameo_spent", "One Raid, With Sequins", "One Battle, With Sequins", "R6 One Battle, With Sequins");
  rep("rc_gully_third_round", "“Dougan. Dougan Marsh. Behind the bar it's still Gully — but you're not behind the bar, are you.”", "{{#played gullywasher_gully_points_to_confluence}}“Dougan. You have that one already, darling — on account. Consider the advance paid off.”{{else}}“Dougan. Dougan Marsh. Behind the bar it's still Gully — but you're not behind the bar, are you.”{{/played}}", "R7 the name is not news twice");
  rep("khezek_tor_the_vaulhaulan_seal_break", "down the same line the survey stations have been shaking about, and every needle on the Triangle wakes up screaming at once.", "down the line the seal was pointed, and somewhere a long way off every needle that can shake, shakes at once.", "R8 no Act-3 names yet");
  choice("fixit_route_board", "\"Whose route is that?\"", "description", "\"Pip's. For when he finishes the lesson.\" She says WE.", "\"Pip's. For when we finish the lesson.\" She says WE.", "R9 she says WE");
  choice("fixit_backstairs_exterior", "Go up", "label", "Go up", "Go up — the route still chalked for Pip", "R10 the two Go-ups differ");
  addChoice("circuit_riders_chase_run", "(GM call) Caught — they arrive where you were always going to be", "", "circuit_riders_chase_caught", null, "R11 the chase can end caught");
  addChoice("circuit_riders_chase_run", "(GM call) Escaped — faster than the apology", "", "circuit_riders_chase_escaped", null, "R11 the chase can end escaped");
  addChoice("khezek_tor_valhaulan_seal_cinematic", "Up close.", "", "khezek_tor_the_vaulhaulan_seal", null, "R12 the Seal chapter is reachable");
  full("lyrenn_green_ring_cinematic", "The old grain elevator is classic post apocalyptic theater - rusted and blasted and still standing strong.\n\nAround it stretches a wide circular field — unnervingly symmetrical.\n\nEverything leads toward the elevator at the center, like spokes toward a promise.\n\nThe soil here is darker than the surrounding land.\n\nDarker — and quieter.\n\nYou feel it before you name it:\n\nThis place listens.\n\nA wooden platform stands at the edge of the circle, bearing an unnerving resemblance to a witness stand.\n\nWhen wind moves across the Ring, it sounds like the measured breath of someone in a deep, peaceful sleep.\n\nBeside the witness-stand platform: an empty plinth, footprint worn smooth, the radial furrows all bending subtly around where something used to stand.", "The old grain elevator is classic post-apocalyptic theater — rusted and blasted and still standing strong — and around it stretches a wide circular field, unnervingly symmetrical, everything leading toward the elevator at the center like spokes toward a promise. The soil here is darker than the surrounding land. Darker, and quieter; you feel it before you name it. This place listens. A wooden platform stands at the edge of the circle, bearing an unnerving resemblance to a witness stand, and when wind moves across the Ring it sounds like the measured breath of someone in a deep, peaceful sleep.\n\nBeside the witness-stand platform: an empty plinth, footprint worn smooth, the radial furrows all bending subtly around where something used to stand.", "R13 the Green Ring out of the stab register");
  choice("khezek_tor_mine_that_answered_back", "Open it up fully", "description", "It is all be yours!", "It'll all be yours!", "R14 typo");
  choice("khezek_tor_darkness_shipment", "Standardize", "description", "There workflow is suboptimal.", "Their workflow is suboptimal.", "R15 typo");
  rep("khezek_tor_mine_that_answered_back_open", "an open Qlipothic energy sink", "an open Qliphothic energy sink", "R16 Qliphothic (Dave's spelling)");
  rep("fixit_weeping_prisoner_punishment", "Mara, was the PipnPatter's idea?", "Mara, was this PipnPatter's idea?", "R17 Dave's wording");
  rep("fixit_weeping_prisoner_mercy", "Mara grins broadly says", "Mara grins broadly and says", "R18 missing conjunction");
  rep("lyrenn_forest_will_not_be_fought_force_fight", "the same every again.", "the same ever again.", "R19 typo");
  choice("forest_of_tifaret_leave", "Intrigue", "description", "IN HIS JUMPSUIT PHASE THIS TIME!!\"", "IN HIS JUMPSUIT PHASE THIS TIME!!", "R20 stray quote");
  choice("forest_of_tifaret_leave", "Logistics", "description", "with reach of the fewest grasping branches", "within reach of the fewest grasping branches", "R21 within reach");
  rep("vs_overture", "Overseer Calder's crews won't work", "Foreman Calder's crews won't work", "R22 Foreman Calder");
  rep("gullywasher_dougan_points_to_confluence", "I told you the Gate remembers something incorrectly. I was being polite.", "Anyone who ordered the flight heard me say the Gate remembers something incorrectly. I was being polite.", "R23 no 'I told you' to someone who never asked");
  rep("gullywasher_gully_points_to_confluence", "I told you the Gate remembers something incorrectly. I was being polite.", "Anyone who ordered the flight heard me say the Gate remembers something incorrectly. I was being polite.", "R23 no 'I told you' to someone who never asked");
  choice("fixit_intro_scene", "The Gullywasher", "label", "The Gullywasher", "The Gullywasher — just look at the outside", "R25 two doors, two labels");
  choice("fixit_town_walk", "The Gullywasher", "label", "The Gullywasher", "The Gullywasher — just look at the outside", "R25 two doors, two labels");

  console.log(`[pass3 road 2026-10-21] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-pass3-road-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Pass 3, the road.`);
})();

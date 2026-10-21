/* patch-pass3-act3-2026-10-21.macro.js — Story Review Ledger PASS 3, Act 3 table (P3-3-1…3-16): 14 ACCEPTED by Dave 2026-10-21; 3-11 and 3-13 REJECTED as worded ("no ifs — the system should know").
 *  3-11 done Dave's way: a {{#played siege_culvert_gate}} span instead of "if you have sat at the tea". 3-13 LEFT ALONE: quest-log step lines are not
 *  passed through _expandStoryTokens, so the Guardian line cannot branch yet (engine follow-up). 3-1: gate gains {beatMark siege_break, not}.
 *  3-2: the camp's Mind fail stays at the camp (failNext cleared). 3-3: NEW beat balcones_acknowledged cloned from the persuasion closer
 *  (Darkness −1, its own quest line) and the no-roll row routes to it. 3-14: Continue row. 3-16: one level of nesting (the expander runs two passes).
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


  const addChoice = (id, label, description, next, requires, note) => { const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; } b.choices = b.choices || [];
    if (b.choices.some(c => c.label === label)) { report.push(`· ok ${id}: ${note}`); return; } const row = { label, next, description, checkStat: "", checkDC: 0, failNext: "" }; if (requires) row.requires = requires; b.choices.push(row); changes++; report.push(`✚ ${id}: ${note}`); };
  const addGate = (id, cond, note) => { const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; } b.inject = b.inject || {}; const rq = Array.isArray(b.inject.requires) ? b.inject.requires : (b.inject.requires = b.inject.requires ? [b.inject.requires] : []);
    if (rq.some(r => JSON.stringify(r) === JSON.stringify(cond))) { report.push(`· ok ${id}: ${note}`); return; } rq.push(cond); changes++; report.push(`✚ ${id}: ${note}`); };
  const newBeatFrom = (tplId, id, label, description, questText, note) => { if (byId.has(id)) { report.push(`· ok ${id}: ${note}`); return; } const tpl = byId.get(tplId); if (!tpl) { report.push(`⚠ ${tplId}: template not found`); return; }
    const nb = foundry.utils.deepClone(tpl); nb.id = id; nb.label = label; nb.description = description; nb.choices = [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }];
    nb.questStep = (Number(tpl.questStep) || 50) + 1; nb.story = Object.assign({}, tpl.story || {}, { ending: "acknowledged" }); nb.refs = undefined; delete nb.refs;
    nb.worldEffects = nb.worldEffects || {}; for (const fe of (nb.worldEffects.factionEffects || [])) fe.darknessDelta = -1; for (const q of (nb.worldEffects.questEffects || [])) q.text = questText;
    if (nb.audio) { nb.audio.enabled = false; nb.audio.src = ""; } camp.beats.push(nb); byId.set(id, nb); changes++; report.push(`✚ ${id}: ${note}`); };

  addGate("siege_first_public_thursday", {"beatMark": "siege_break", "not": true}, "3-1 not after siege_break");
  choice("wt_cult_camp", "Watch the camp.", "failNext", "wt_caravan_ride_fail", "", "3-2 a failed look stays at the camp");
  newBeatFrom("balcones_faulting_you_persuasion", "balcones_acknowledged", "The Balcones Faulting You Line - Acknowledged", "You read it back. Item one, item two, item three, in order, out loud, to a fault line, in front of a geologist who has stopped pretending to write. The trace on the bicycle wheel goes still for the first time in two turns and then writes, slowly: NOTED. The ground under your boots stops arguing with itself. Nkemelu re-levels the chair out of habit and finds it already level. \"Acknowledgement,\" he says. \"That's all it wanted. The creek's a separate matter.\" It is. The creek is still over there.", "Acknowledged, itemized, out loud. The fault holds still. The creek is a separate matter.", "3-3 the acknowledgement lands on its own beat");
  choice("balcones_faulting_you_line_choices", "Read its own complaint back to it, itemized.", "next", "balcones_faulting_you_persuasion", "balcones_acknowledged", "3-3 acknowledgement routes to its own beat");
  rep("hod_the_vote", "Ines has followed you to the second district because the second district is where the minutes are, and she is the Clerk of all three towns now, probably.", "{{#played hod_clerk_window}}Ines has followed you to the second district{{else}}A woman with a wet, faintly glowing stamp has followed you into the second district — Ines Calloway, the Clerk, and she stamps your hand before she says so{{/played}}, because the second district is where the minutes are, and she is the Clerk of all three towns now, probably.", "3-4 Ines is introduced if unmet");
  choice("hod_dispatcher_booth", "Give it the seven positions as a heading.", "description", "You read the fold out loud, position by position, the way Captain Robot did.", "You read the fold out loud, position by position{{#played wt_legansus_sequence}}, the way Captain Robot did{{/played}}.", "3-5 Captain Robot only if met");
  rep("hod_route_posted", "and it says the heading, the one from the fold, the one Captain Robot verified at Legansus, and for the first time", "and it says the heading, the one from the fold{{#played wt_legansus_sequence}}, the one Captain Robot verified at Legansus{{/played}}, and for the first time", "3-6 Captain Robot only if met");
  rep("trojan_refuse", "and the paperwork (which you never opened, which everyone now knows you never opened) means the insult is on RECORD somewhere", "and the paperwork ({{#played trojan_paperwork}}which you read, and refused anyway, which everyone now knows{{else}}which you never opened, which everyone now knows you never opened{{/played}}) means the insult is on RECORD somewhere", "3-7 the paperwork knows if it was read");
  rep("trojan_regift", "you do not open it, you do not refuse it — you ATTACH YOUR OWN CARD", "{{#played trojan_paperwork}}you close it again{{else}}you do not open it{{/played}}, you do not refuse it — you ATTACH YOUR OWN CARD", "3-8 the crate knows if it was opened");
  rep("trojan_paperwork", "the sender's identity is an owner canon slot.)", "the sender is the hand on the Long Table's name-cards — see the \"name-cards\" row on The Same Hand.)", "3-9 GM note names the sender");
  rep("map_anchor_reach_intro", "At low tide, the diagram shows its pilings. One of the drowned pilings has shoulders.", "One of the drowned pilings has shoulders.", "3-10 pilings once");
  rep("siege_doors", "Four ways through present themselves — and understand, before choosing:", "Four ways through present themselves{{#played siege_culvert_gate}} — five, now that you have sat at the tea{{/played}} — and understand, before choosing:", "3-11 five ways, when the tea was taken (token, no ifs)");
  choice("siege_commander_camp", "Say the word Thursday and watch what happens to the teacup.", "description", "The cup stops. \"Market close,\" is all that is said, and it is said to the cup.", "The cup stops. His hands, for once, leave the desk alone. \"Market close,\" is all that is said, and it is said to the cup.", "3-12 Pell's own tell");
  addChoice("balcones_faulting_you_line_final_fail", "Continue", "", "", null, "3-14 Continue");
  rep("enc_hidden_vault_gilbert", "He can be fought, controlled, or released.", "He can be fought, talked down, or left to it.", "3-15 matches the card's options");
  rep("trojan_betting_pool", "{{#played ag_confessor_exposed}}Verna has the slate now — a stub of chalk and odds on what is inside the gift, updated every time somebody walks past it with an opinion. SOLDIERS is even money. PAPERWORK is three to one. EMPTY is forty to one and has exactly one bet on it, in a hand that is not hers. Verna says the guest left it before he left.{{else}}Pilgrim Wick has a slate, a stub of chalk, and odds on what is inside the gift that he updates every time somebody walks past it with an opinion. SOLDIERS is even money. PAPERWORK is three to one. EMPTY is forty to one and has exactly one bet on it, in Wick's own hand, and when you ask he looks pleased in a way that makes you want to check your pockets.{{/played}}", "{{#played ag_confessor_exposed}}Verna has the slate now — a stub of chalk and odds on what is inside the gift, updated every time somebody walks past it with an opinion. SOLDIERS is even money. PAPERWORK is three to one. EMPTY is forty to one and has exactly one bet on it, in a hand that is not hers. Verna says the guest left it before he left.{{else}}{{#played wt_cult_camp}}Verna has the slate now — a stub of chalk and odds on what is inside the gift, updated every time somebody walks past it with an opinion. SOLDIERS is even money. PAPERWORK is three to one. EMPTY is forty to one and has exactly one bet on it, in a hand that is not hers. The guest left it before he left; she does not say where he went, and you know.{{else}}Pilgrim Wick has a slate, a stub of chalk, and odds on what is inside the gift that he updates every time somebody walks past it with an opinion. SOLDIERS is even money. PAPERWORK is three to one. EMPTY is forty to one and has exactly one bet on it, in Wick's own hand, and when you ask he looks pleased in a way that makes you want to check your pockets.{{/played}}{{/played}}", "3-16 Verna has the slate once Wick was met on the switchbacks (nested token, two passes)");

  console.log(`[pass3 act3 2026-10-21] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-pass3-act3-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Pass 3, Act 3.`);
})();

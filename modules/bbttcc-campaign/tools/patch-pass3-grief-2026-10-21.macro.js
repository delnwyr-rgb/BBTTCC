/* patch-pass3-grief-2026-10-21.macro.js — Story Review Ledger PASS 3, grief towns + The Forgotten Cause table (P3-G1…G26), all 26 ACCEPTED by Dave 2026-10-21.
 *  Text rows as proposed; G21 in Dave's wording ("Rather, they are an invoice, and the line had one client.").
 *  G2: three NEW gated rows (requires beatMark wendigo_confluence_name_cards) — chuckle_credits → chuckle_finale, soft_landing_choice → soft_landing_go_first,
 *      stillwater_choice → stillwater_ring_the_bell — so the "A Name From the Table" receipts finally land somewhere.
 *  G3: summit ⚙ GM line rewritten for BREAK / REDIRECT + REDIRECT's Close the Ledger accept text. G14: the long-table read loses its DC 14 (the host seats you for free anyway).
 *  G18: warLog Unity → Loyalty. G21: script step forgotten_cause.guests line.
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
    if (b.choices.some(c => c.label === label)) { report.push(`· ok ${id}: ${note}`); return; } b.choices.push({ label, next, description, checkStat: "", checkDC: 0, failNext: "", requires }); changes++; report.push(`✚ ${id}: ${note}`); };
  const dropCheck = (id, label, note) => { const b = byId.get(id); const c = b?.choices?.find(x => x.label === label); if (!c) { report.push(`⚠ ${id}: choice "${label}" not found`); return; }
    if (!c.checkStat && !c.checkDC && !c.failNext) { report.push(`· ok ${id}: ${note}`); return; } c.checkStat = ""; c.checkDC = 0; c.failNext = ""; changes++; report.push(`✚ ${id}: ${note}`); };
  const questEffectText = (id, questId, from, to, note) => { const b = byId.get(id); const q = (b?.worldEffects?.questEffects || []).find(x => x.questId === questId && x.action === "accept"); if (!q) { report.push(`⚠ ${id}: accept effect for ${questId} not found`); return; }
    if (q.text === to) { report.push(`· ok ${id}: ${note}`); return; } if (q.text === from) { q.text = to; changes++; report.push(`✚ ${id}: ${note}`); return; } report.push(`⚠ ${id}: accept text is not the expected baseline — skipped`); };
  const warLog = (id, from, to, note) => { const b = byId.get(id); if (!b?.worldEffects) { report.push(`⚠ ${id}: no worldEffects`); return; } const w = String(b.worldEffects.warLog || "");
    if (w.includes(to)) { report.push(`· ok ${id}: ${note}`); return; } if (w.includes(from)) { b.worldEffects.warLog = w.replace(from, to); changes++; report.push(`✚ ${id}: ${note}`); return; } report.push(`⚠ ${id}: warLog baseline not found`); };
  const stepLine = (scriptKey, stepId, from, to, note) => { const sc = camp.story?.scripts?.[scriptKey]; const st = (sc?.steps || []).find(s => s.id === stepId); if (!st) { report.push(`⚠ script ${scriptKey}.${stepId}: not found`); return; }
    const l = String(st.line || ""); if (l.includes(to)) { report.push(`· ok step ${scriptKey}.${stepId}: ${note}`); return; } if (l.includes(from)) { st.line = l.replace(from, to); changes++; report.push(`✚ step ${scriptKey}.${stepId}: ${note}`); return; } report.push(`⚠ step ${scriptKey}.${stepId}: baseline not found`); };

  rep("stillwater_choice", "and walk away with the one intact piece of the old world kept safe behind their ignorance.", "and walk away with the one intact piece of the old world kept safe behind their ignorance: a seal of unbroken Yesod, Foundation that never shattered because here the Shattering never arrived. Every faction that hears the word 'intact' will want it.", "G1 the Yesod is introduced before it is offered");
  addChoice("chuckle_credits", "Say the boy's name off the card.", "Dewey stops mid-joke. Pearl sets the fourth plate down and does not pour.", "chuckle_finale", [{"beatMark": "wendigo_confluence_name_cards"}], "G2 Chuckle Creek hears its name");
  addChoice("soft_landing_choice", "Read the name off the Wendigo's card.", "It lands. The bench holds. Adaeze says \"yes.\"", "soft_landing_go_first", [{"beatMark": "wendigo_confluence_name_cards"}], "G2 Soft Landing hears its name");
  addChoice("stillwater_choice", "Hand May the card with Denny's name.", "She reads it twice. \"Oh,\" she says, and stands up.", "stillwater_ring_the_bell", [{"beatMark": "wendigo_confluence_name_cards"}], "G2 Stillwater hears its name");
  rep("gullywasher_cultural_summit", "⚙ GM: if the Confluence ended in REDIRECT or BREAK, there is no recovered cause — the summit can be held, but the reason-column stays blank and the chapter closes UNWINNABLE. Say so plainly: \"there is no reason left to enter.\"", "⚙ GM: after BREAK the quest is already closed and this room never opens. After REDIRECT the cause is in the stewards' keeping but un-filed — there is no receipt, so only the DC 14 read can enter it; if that fails, say so plainly: \"there is no reason left to enter.\"", "G3 the GM line matches the routes");
  questEffectText("wendigo_confluence_redirect", "fc_cultural_summit", "Carry the recovered cause to the Cultural Summit.", "You carry the names now. Find the reason among them and enter it at the Cultural Summit.", "G3 REDIRECT accept text");
  rep("fc_bridge_summit", "The cause has been carried out of the Confluence — a reason, recovered whole, for a feud that has been all interest and no principal for a generation.", "{{#played wendigo_confluence_repair}}The cause has been carried out of the Confluence — a reason, recovered whole, for a feud that has been all interest and no principal for two hundred years.{{else}}The names have been carried out of the Confluence, and somewhere under them, un-filed, is the reason for a feud that has been all interest and no principal for two hundred years.{{/played}}", "G4 two hundred years, and the route it came by");
  rep("soft_landing_choice", "There is no enemy to defeat, no Showrunner to switch off, no seal to break.", "There is no enemy to defeat, {{#played chuckle_showrunner}}no Showrunner to switch off, {{/played}}no seal to break.", "G5 Showrunner only if met");
  rep("stillwater_choice", "There is no monster, no Showrunner, nobody who did this on purpose.", "There is no monster, {{#played chuckle_showrunner}}no Showrunner, {{/played}}nobody who did this on purpose.", "G6 Showrunner only if met");
  rep("wendigo_confluence_name_cards", "A whole table-length of names that also hang, hand-lettered, between the scenes at Chuckle Creek.", "{{#played chuckle_rung_4}}A whole table-length of names that also hang, hand-lettered, between the scenes at Chuckle Creek.{{else}}A whole table-length of names in one warm, hand-lettered hand, copied off something that hangs somewhere you have not been yet.{{/played}}", "G7 the title card stays a secret until found");
  rep("wendigo_confluence_name_cards", "A place for a son who was on the 4:10.", "A place for a son who never made the 4:10.", "G8 Denny never boarded");
  choice("chuckle_tape_shelf", "Put the missing tape back in the deck.", "label", "Put the missing tape back in the deck.", "Let the tape in the deck run to the end.", "G9 the tape is already playing");
  choice("chuckle_credits", "Play the tape to the end.", "description", "it is the best day Chuckle Creek has had since 2077.", "it is the first real day Chuckle Creek has had since 2077.", "G10 first real day");
  rep("soft_landing_give_2", "These people made remembering structurally impossible, on purpose, as civic policy — and then padded the policy so it wouldn't hurt to touch.", "These people never forgot a thing. They took away every surface a memory could land on, on purpose, as civic policy — and then padded the policy so it wouldn't hurt to touch.", "G11 Soft Landing pads, the Wendigo forget");
  rep("soft_landing_give_4", "Not by forgetting it. Not by deciding it doesn't count. Not by freezing before it. They padded every surface of their lives so that no feeling could ever hit bottom — and it WORKED,", "They didn't forget it, or decide it didn't count, or freeze the clock before it. They padded every surface of their lives so that no feeling could ever hit bottom — and it WORKED,", "G12 out of the not-not-but cadence");
  rep("stillwater_platform", "and it has been about to be 4:10 since the horizon lit.", "and it has been about to be 4:10 since the last afternoon the world had.", "G13 the Shattering stays a night");
  choice("wendigo_confluence_the_long_table", "Read the name-cards before you decide", "description", "Sit. Read every card. Let it cost you. (Success surfaces the recovered cause you can carry to the Cultural Summit; failure, you read too many and lose your footing in the thick time — but you still learn the shape of it.)", "Sit. Read every card. Let it cost you.", "G14 after-text without the rules-talk");
  dropCheck("wendigo_confluence_the_long_table", "Read the name-cards before you decide", "G14 the DC 14 goes (the host seats you for free anyway)");
  rep("gullywasher_cultural_summit", "\n\n(Requires the recovered cause from the Confluence. Without it, the summit can be attempted but cannot truly close the line.)", "", "G15 rules note out of the player text");
  choice("gullywasher_cultural_summit", "Read the Petting-Zoo Receipt into the reason-column, by name.", "description", "No roll. A Steward's voice,", "A Steward's voice,", "G16 'No roll.' out of the player card");
  rep("gullywasher_cultural_summit_failure", "(The feud's Grievance meter rises. Recover the cause from the Confluence, or reduce the heat, before re-hosting.)", "⚙ GM: the feud's Grievance meter rises. Recover the cause from the Confluence, or reduce the heat, before re-hosting.", "G17 Grievance note becomes a GM note");
  warLog("gullywasher_cultural_summit_success", "The Farm's Unity rose", "The Farm's Loyalty rose", "G18 Loyalty, not Unity");
  rep("gullywasher_gully_points_to_confluence", "He puts the glass down. Then, because you are about to go somewhere for him that he cannot go himself:", "Then, because you are about to go somewhere for him that he cannot go himself:", "G19 the glass goes down once");
  choice("fc_night_one", "Show them the Guest List.", "description", "Their own names, read back to them. They thank you. They mean it. Nobody has ever read them the list.", "The names they have been holding, read back to them in your voice. They thank you. They mean it. Nobody has ever read them the list.", "G20 the Wendigo are the holders");
  stepLine("forgotten_cause", "guests", "They are not a memorial. They are a client list, and the client is one mine.", "They are not a memorial. Rather, they are an invoice, and the line had one client.", "G21 an invoice, one client (Dave's wording)");
  rep("fc_night_one", "was the reason for a feud about a goat. They do not remember the goat. They remember filing it.", "was the reason for a feud. Something small. They do not remember what. They remember filing it.", "G22 the goat waits for its punchline");
  rep("soft_landing_harden", "The air stops humming as the blowers die.", "The air stops humming as the blower dies.", "G23 one blower");
  rep("soft_landing_choice", "in a city which disarmed every other one.", "in a nation which disarmed every other one.", "G24 a nation");
  rep("soft_landing_give_4", "because they have never once said it out loud", "because she has never once said it out loud", "G25 Adaeze is speaking");
  rep("wendigo_confluence_name_cards", "a map of everything three regions could not bear to keep.", "a map of everything one region could not bear to keep.", "G26 one region");

  console.log(`[pass3 grief 2026-10-21] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-pass3-grief-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Pass 3, grief towns + The Forgotten Cause.`);
})();

/* patch-pass3-encounters-2026-10-21.macro.js — Story Review Ledger PASS 3, Encounters table (P3-E1…E19): 18 ACCEPTED by Dave 2026-10-21, E7 REJECTED (the smiley faces are glowing apparitions established in the page art).
 *  E2 in Dave's wording (Strain / marks / Clarity). E4: "Go in" → khezek_tor_town_walk (the card speaks of quartermasters in the plural; the town walk
 *  is the honest landing). E5: three rows that stay on the card, GM calls it. E6: the aftermath card had no effects, so its storyPhase ≥ 2 gate goes.
 *  E8 and E10 are NO-OPs — Dave's edits kept the live spelling "Qlipothic" here (⚠ road R16 chose "Qliphothic" for the KT beat; Dave to pick one).
 *  E9 only capitalises. E7 not applied.
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

  rep("adversary_reality_tear_watcher_notices", "(This beat fired because a roll tore reality open by +40 or more. Decide, together, how the party carries the Adversary's attention out of this scene.)", "⚙ GM: This beat fired because a roll tore reality open by +40 or more. Decide, together, how the party carries the Adversary's attention out of this scene.", "E1 the trigger note is a GM note");
  choice("adversary_reality_tear_watcher_notices", "Cover the tear — spend a beat masking what you did", "description", "(GM: extract a light cost — 1 Clarity, an OP, or a secret now owed.)", "(GM: extract a light cost — a point of Strain, a few marks, or a point of Clarity.)", "E2 Dave's wording, marks not OP");
  choice("tikkun_atonement_not_yet", "Let the shards lie for now.", "description", "A failed check re-offers the Rite's menu; close it to let the miss stand. The activity can be staged again next turn.", "The shards stay where they fell. The door stays open; it was made before the world, and it is not going anywhere. ⚙ GM: a failed check re-offers the Rite's menu; close it to let the miss stand. The activity can be staged again next turn.", "E3 a line for the players, the engine note for the GM");
  addChoice("khezek_tor_warehouse_exterior", "Go in", "", "khezek_tor_town_walk", null, "E4 the warehouses have a door");
  addChoice("enc_border_incident_remote", "Ride on", "You keep your line and your speed. Whatever that was, it was somebody else's afternoon.", "", null, "E5 the card's three picks exist");
  addChoice("enc_border_incident_remote", "Ride wide", "You give it the whole horizon. Slower. Nobody's spotter gets a clean look at you either.", "", null, "E5 the card's three picks exist");
  addChoice("enc_border_incident_remote", "Ride toward", "You turn into it. The GM will tell you what the spotter saw.", "", null, "E5 the card's three picks exist");
  dropGateCond("bandit_ambush_outcome_results", {"flag": "storyPhase", "gte": 2}, "E6 the aftermath card follows the ambush in any phase");
  repMem("enc_qlipothic_shambler_parley_success", "a qlipothic shambler lost them in the quiet", "a Qlipothic shambler lost them in the quiet", "E9 capital Q (Dave's spelling here)");
  rep("enc_broken_bridge_wade_success", "you are quickly through and ready to process.", "you are quickly through and ready to proceed.", "E11 proceed");
  rep("enc_weather_front_keep_moving", "An apparently, since you haven't studied acid rain", "And apparently, since you haven't studied acid rain", "E12 typo");
  rep("enc_weather_front_find_shelter", "to hide from in the storm", "to hide in from the storm", "E13 hide in from the storm");
  rep("enc_weather_front_find_shelter_fail", "to hide from in the storm", "to hide in from the storm", "E13 hide in from the storm");
  rep("enc_weather_front_make_shelter", "to hide from in the storm", "to hide in from the storm", "E13 hide in from the storm");
  rep("enc_desenitarius_maarg_cinematic_intro", "It's Dysentary.", "It's Dysentery.", "E14 spelling");
  rep("enc_mutant_wildlife_t2_outcomes_run", "Give them precious moments eyes?", "Give them Precious Moments eyes?", "E15 brand name");
  choice("enc_acid_bog", "Make a run for it", "description", "cover your face with a magazine and something", "cover your face with a magazine or something", "E16 or");
  rep("acid_bog_logistics_success", "That was  awful nice of them.", "That was awful nice of them.", "E17 double space");
  rep("enc_bandit_ambush_win_free", "could use some help defending your city.", "could use some help defending your town.", "E18 town");
  rep("enc_qlipothic_shambler", "Weapons out. Aim for the habit.", "Weapons out — or very, very still. Aim for the habit.", "E19 stillness is an option");

  console.log(`[pass3 encounters 2026-10-21] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-pass3-encounters-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Pass 3, Encounters.`);
})();

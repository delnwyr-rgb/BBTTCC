/* patch-first-morning-tent-at-crossroads-2026-10-27.macro.js — a morning before the road, and the tent waits at the
 *  Crossroads (Dave, 2026-10-27).
 *  Why: "add an 'anything else before you head out' choice that happens after the first night sleep in the AR. Having it
 *   immediately drop in to a semi-random beat like that is jarring. Maybe we have the tent actually be near the
 *   crossroads, so the first time they show up until they actually engage with it, there is a choice to go check out
 *   the tent?"
 *   NEW   ag_first_morning — "Allesh-Gilliam — The Morning After" (cloned from ag_first_night_soma_break: same quest +
 *         story declaration, Act 1 only, repeatable hub). Anything else before you head out? Back into town · the lease
 *         paperwork (until read) · your Signature (until done) · Head out — the Crossroads.
 *   EDIT  "Sleep. Tomorrow, the land." (First Night, the three lease beats, Your Signature) → ag_first_morning instead of
 *         the tent. On the lease/Signature beats it hides once the morning has come, and "Back to the morning." shows
 *         instead; the lease's "Back to the evening." hides once the morning has come (it used to wait on the tent).
 *   EDIT  ag_crossroads_first_rides — first choice "The white tent where the road forks" → hum_quiet_tent, shown until the
 *         tent has been visited.
 *   EDIT  hum_quiet_tent — stands where the road forks (not "at the edge of the settlement"); "Leave them to it" goes
 *         back to the Crossroads; the dead-end "On to wherever the road goes." is dropped (its goodbye line moves onto "Leave them to it"). hum_quiet_tent_ask's exit reads
 *         "Back to the Crossroads".
 *  Idempotent; DRY_RUN default true; `campaigns` as a true JSON copy. GM only. Back up world settings first.
 *  Mirror into the Beat Polish doc (Coast towns · Acts 0–2).
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const MORNING = "ag_first_morning", NIGHT = "ag_first_night_soma_break", TENT = "hum_quiet_tent", CROSS = "ag_crossroads_first_rides";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : JSON.parse(JSON.stringify(raw));
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error(`Active campaign '${cid}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0; const say = (m) => report.push(m);
  const ch = (label, next, description = "", requires = null) => ({ label, description, next, failNext: "", checkStat: "", checkDC: 0, ...(requires ? { requires } : {}) });
  const NOT_MORNING = { beatMark: MORNING, not: true }, MORNING_DONE = { beatMark: MORNING };
  const hasReq = (c, r) => (c.requires || []).some(x => x && x.beatMark === r.beatMark && !!x.not === !!r.not);
  for (const id of [NIGHT, TENT, CROSS, "hum_quiet_tent_ask", "reliable_the_lease", "reliable_lease_terms", "reliable_lease_home", "ag_first_signature"])
    if (!byId.has(id)) return ui.notifications.error(`${id} missing — nothing changed.`);

  // 1) the morning
  if (byId.has(MORNING)) say(`· ok ${MORNING} exists`);
  else {
    const night = byId.get(NIGHT);
    const b = JSON.parse(JSON.stringify(night));
    const lease = night.choices.find(c => c.next === "reliable_the_lease"), sig = night.choices.find(c => c.next === "ag_first_signature");
    Object.assign(b, {
      id: MORNING, label: "Allesh-Gilliam — The Morning After",
      description: "Morning comes in through the Absolutely Reliable's portholes, already busy. Somebody is hammering. Somebody else is arguing about the hammering. The coffee is terrible, and you drink it anyway, because it's yours.\n\nDown at the end of the street, past the last fence, the road out to the Crossroads is waiting.\n\nAnything else before you head out?",
      memoryText: "", inviteText: "",
      choices: [
        ch("Back into town — something left undone", "allesh_gilliam_town_walk", "One more door before the road. The Welcome Round reopens."),
        ...(lease ? [JSON.parse(JSON.stringify(lease))] : []),
        ...(sig ? [JSON.parse(JSON.stringify(sig))] : []),
        ch("Head out — the Crossroads", CROSS, "Marshal Pike gets his parking back, at least temporarily.")
      ]
    });
    delete b.audio; delete b.speakerActorId;
    b.inject = { ...(b.inject || {}), repeatable: true, evergreen: true };
    b.worldEffects = { factionEffects: [], questEffects: [], radiationDelta: 0, relationshipEffects: [], sparkKey: null, territoryOutcome: null, turnRequests: [], warLog: "", worldModifiers: [] };
    b.seed = { by: "patch-first-morning-tent-at-crossroads-2026-10-27" };
    const at = camp.beats.indexOf(night);
    camp.beats.splice(at + 1, 0, b); byId.set(MORNING, b); changes++;
    say(`✚ ${MORNING}: The Morning After — town · lease · signature · Head out → the Crossroads`);
  }

  // 2) "Sleep. Tomorrow, the land." → the morning
  const sleepers = [NIGHT, "reliable_the_lease", "reliable_lease_terms", "reliable_lease_home", "ag_first_signature"];
  for (const id of sleepers) {
    const b = byId.get(id);
    const sleep = b.choices.find(c => /^Sleep\. Tomorrow, the land\./.test(c.label || ""));
    if (!sleep) { say(`⚠ ${id}: no "Sleep. Tomorrow, the land." choice`); continue; }
    if (sleep.next !== MORNING) { sleep.next = MORNING; changes++; say(`✎ ${id}: Sleep → ${MORNING}`); }
    else say(`· ok ${id}: Sleep → the morning`);
    if (id === NIGHT) continue;
    if (!hasReq(sleep, NOT_MORNING)) { sleep.requires = [...(sleep.requires || []), { ...NOT_MORNING }]; changes++; say(`✎ ${id}: Sleep hides once the morning has come`); }
    if (!b.choices.some(c => c.next === MORNING && hasReq(c, MORNING_DONE))) {
      b.choices.splice(b.choices.indexOf(sleep) + 1, 0, ch("Back to the morning.", MORNING, "", [{ ...MORNING_DONE }])); changes++;
      say(`✎ ${id}: + "Back to the morning." (after the morning)`);
    }
  }
  const evening = byId.get("reliable_the_lease").choices.find(c => c.next === NIGHT);
  if (evening) {
    const before = JSON.stringify(evening.requires || []);
    evening.requires = (evening.requires || []).filter(r => !(r && r.beatMark === TENT && r.not));
    if (!hasReq(evening, NOT_MORNING)) evening.requires.push({ ...NOT_MORNING });
    if (JSON.stringify(evening.requires) !== before) { changes++; say("✎ reliable_the_lease: \"Back to the evening.\" hides once the morning has come"); }
    else say("· ok reliable_the_lease: Back to the evening");
  }

  // 3) the Crossroads offers the tent until it's been visited
  const cross = byId.get(CROSS);
  if (cross.choices.some(c => c.next === TENT)) say(`· ok ${CROSS}: the tent choice exists`);
  else {
    cross.choices.unshift(ch("The white tent where the road forks", TENT, "It wasn't there yesterday. Two travelers are sitting outside it with their boots off.", [{ beatMark: TENT, not: true }]));
    changes++; say(`✎ ${CROSS}: + "The white tent where the road forks" (until visited)`);
  }

  // 4) the tent stands at the fork and leads back to it
  const tent = byId.get(TENT);
  const OLD_OPEN = "Someone has put up a tent at the edge of the settlement —", NEW_OPEN = "Someone has put up a tent where the road forks, just past the last fence —";
  if (String(tent.description).startsWith(NEW_OPEN)) say(`· ok ${TENT}: stands at the fork`);
  else if (String(tent.description).startsWith(OLD_OPEN)) { tent.description = NEW_OPEN + tent.description.slice(OLD_OPEN.length); changes++; say(`✎ ${TENT}: stands where the road forks`); }
  else say(`⚠ ${TENT}: opening line not as expected — left alone`);
  const leave = tent.choices.find(c => c.next === CROSS);
  if (leave && leave.label !== "Leave them to it — back to the Crossroads") { leave.label = "Leave them to it — back to the Crossroads"; changes++; say(`✎ ${TENT}: "Leave them to it — back to the Crossroads"`); }
  const GOODBYE = "The woman changes the water in the basin nobody uses. Bit puts his boots back on. Nobody says goodbye; it's a tent.";
  if (leave && !leave.description) { leave.description = GOODBYE; changes++; say(`✎ ${TENT}: "Leave them to it" carries the dropped exit's goodbye line`); }
  const deadEnd = tent.choices.findIndex(c => !c.next && /wherever the road goes/i.test(c.label || ""));
  if (deadEnd >= 0) { tent.choices.splice(deadEnd, 1); changes++; say(`✎ ${TENT}: dropped the dead-end "On to wherever the road goes."`); }
  const ask = byId.get("hum_quiet_tent_ask").choices.find(c => c.next === CROSS);
  if (ask && ask.label !== "Back to the Crossroads") { ask.label = "Back to the Crossroads"; changes++; say("✎ hum_quiet_tent_ask: \"Back to the Crossroads\""); }

  // anything else that still routes straight into the tent (report only)
  const others = camp.beats.filter(b => b.id !== CROSS && (b.choices || []).some(c => c.next === TENT)).map(b => b.id);
  if (others.length) say(`ℹ still routes into the tent: ${others.join(", ")}`);
  for (const t of (game.tables?.contents || [])) for (const r of t.results) if (JSON.stringify(r.flags || {}).includes(TENT) || String(r.text || r.description || "").includes(TENT)) say(`ℹ table "${t.name}" draws ${TENT}`);

  console.log(`[first morning + tent 2026-10-27] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — a morning before the road, and the tent waits at the Crossroads.`);
})();

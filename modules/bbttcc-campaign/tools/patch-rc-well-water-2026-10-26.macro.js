/* patch-rc-well-water-2026-10-26.macro.js — the Recalcitrant Cafe's eighth course is Lyrenn's well-water (Dave, 2026-10-26).
 *  Why: "add drinking the well water to the list of things you have to have consumed to get the hex benefit after drinking
 *   Young Gearbox's coffee. And some sort of kewl bonus from it like the other consumption items do."
 *   NEW   rc_lyrenn_well_water — the jug on the fence post as a MEAL beat (cloned from rc_elsin_supper: Lyrenn quest, player-
 *         facing, not repeatable). partyEffects "Lyrenn Well-Water": +2 Perception, +1 Empathy, eases 1 Strain, lasts 2 TURNS
 *         (water keeps; every meal lasts 1). "Back to the rows" → lyrenn_town_walk.
 *   EDIT  lyrenn_town_walk  "Drink the well-water" → rc_lyrenn_well_water, hidden once drunk (it used to loop to the walk).
 *   EDIT  rc_gearbox_coffee inject.requires + the three Brew choices (reliable_the_lease, ag_days_end, days_end_thatwards):
 *         + {beatMark: rc_lyrenn_well_water} — eight courses before the pot.
 *   EDIT  the tin (Young Gearbox's Forgotten Coffee, in The Absolutely Reliable's hold): its rules line names the well-water.
 *  Idempotent; DRY_RUN default true; `campaigns` as a true JSON copy. GM only. Back up world settings + actors first.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const ID = "rc_lyrenn_well_water";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : JSON.parse(JSON.stringify(raw));
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error(`Active campaign '${cid}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0; const say = (m) => report.push(m);
  const WELL_MARK = { beatMark: ID };
  const hasWell = (req) => Array.isArray(req) && req.some(r => r && r.beatMark === ID && !r.not);
  const addWell = (req) => { const out = Array.isArray(req) ? req.slice() : []; const i = out.findIndex(r => r && r.beatMark === "reliable_lease_lapsed"); out.splice(i >= 0 ? i : out.length, 0, { ...WELL_MARK }); return out; };

  // 1) the meal beat
  if (byId.has(ID)) say(`· ok ${ID} exists`);
  else {
    const tpl = byId.get("rc_elsin_supper");
    if (!tpl) return ui.notifications.error("rc_elsin_supper missing — run patch-recalcitrant-cafe first.");
    const b = JSON.parse(JSON.stringify(tpl));
    Object.assign(b, {
      id: ID, label: "Lyrenn — The Jug on the Fence Post",
      description: "Cold. Clean. Faintly mineral. The fence post creaks in a way you'd swear was \"you're welcome.\"\n\nSomewhere under the rows, something takes a sip of you back. For a while afterwards you notice what the fields notice.",
      memoryText: "Drank the well-water somebody left on a fence post in Lyrenn. Nobody took credit. The fields did.",
      inviteText: "", tags: "recalcitrant-cafe", timePoints: 0,
      choices: [{ label: "Back to the rows", description: "", next: "lyrenn_town_walk", failNext: "", checkStat: "", checkDC: 0 }],
      worldEffects: { partyEffects: [{
        name: "Lyrenn Well-Water", note: "Cold, clean, faintly mineral. The land took a sip of you back; for two turns you notice what the rows notice.",
        duration: "turn", turns: 2, strainRelief: 1, img: "icons/consumables/drinks/water-jug-clay-brown.webp",
        checkBonus: [
          { context: "check", skill: "perception", bonus: 2, note: "Lyrenn Well-Water" },
          { context: "check", skill: "empathy", bonus: 1, note: "Lyrenn Well-Water" }
        ] }] }
    });
    delete b.speakerActorId;   // nobody nearby takes credit
    b.inject = { ...(b.inject || {}), repeatable: false, evergreen: true };
    camp.beats.push(b); byId.set(ID, b); changes++;
    say(`✚ ${ID}: the jug on the fence post — Lyrenn Well-Water (+2 Perception, +1 Empathy, −1 Strain, 2 turns)`);
  }

  // 2) the walk's choice
  const walk = byId.get("lyrenn_town_walk");
  const wc = (walk?.choices || []).find(c => /well-water/i.test(String(c?.label || "")));
  if (!wc) say("⚠ lyrenn_town_walk: no \"Drink the well-water\" choice — left alone");
  else if (wc.next === ID) say("· ok lyrenn_town_walk: the well-water choice already leads to the jug");
  else { wc.next = ID; wc.description = ""; wc.requires = [...(Array.isArray(wc.requires) ? wc.requires : []), { beatMark: ID, not: true }]; changes++; say("✎ lyrenn_town_walk: Drink the well-water → the jug (hidden once drunk)"); }

  // 3) the coffee's gates
  const coffee = byId.get("rc_gearbox_coffee");
  if (!coffee) say("⚠ rc_gearbox_coffee missing — gates left alone");
  else if (hasWell(coffee.inject?.requires)) say("· ok rc_gearbox_coffee already needs the well-water");
  else { coffee.inject = { ...(coffee.inject || {}), requires: addWell(coffee.inject?.requires) }; changes++; say("✎ rc_gearbox_coffee: + the well-water (eight courses)"); }
  for (const hid of ["reliable_the_lease", "ag_days_end", "days_end_thatwards"]) {
    const brew = (byId.get(hid)?.choices || []).find(c => c?.next === "rc_gearbox_coffee");
    if (!brew) { say(`⚠ ${hid}: no Brew choice`); continue; }
    if (hasWell(brew.requires)) { say(`· ok ${hid}: Brew already needs the well-water`); continue; }
    brew.requires = addWell(brew.requires); changes++; say(`✎ ${hid}: Brew + the well-water`);
  }

  // 4) the tin
  const OLD = "Pike, Etta, Tamsin, Elsin, Bez, Drax, Gully — then brew it aboard.";
  const NEW = "Pike, Etta, Tamsin, Elsin, Bez, Drax, Gully — and drink the well-water somebody leaves on a fence post in Lyrenn, then brew it aboard.";
  const tins = game.actors.contents.flatMap(a => a.items.filter(i => /forgotten coffee/i.test(String(i.name || ""))));
  const tinEdits = [];
  for (const t of tins) {
    const d = String(t.system?.description?.value || "");
    if (d.includes(NEW)) say(`· ok tin on ${t.parent?.name}`);
    else if (d.includes(OLD)) { tinEdits.push({ t, d: d.replace(OLD, NEW) }); changes++; say(`✎ tin on ${t.parent?.name}: names the well-water`); }
    else say(`⚠ tin on ${t.parent?.name}: rules line not found — left alone`);
  }
  if (!tins.length) say("⚠ no Forgotten Coffee tin found on any actor");

  console.log(`[rc well-water 2026-10-26] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  for (const e of tinEdits) await e.t.update({ "system.description.value": e.d });
  ui.notifications.info(`Applied ${changes} change(s) — the well-water is the eighth course.`);
})();

/*
 * patch-reliable-place-2026-11-06.macro.js — Dave 2026-11-06: The Absolutely Reliable becomes a place. Creates the stand-in scene (swap Dave's map in as its background),
 * the Aboard hub with galley, control station and bunk room, moves her beats aboard, moves Lock the Turn to the bunks, gives every player owner on her actor, and turns the
 * three sleeping town exits into Back to the road.
 * Ember Bad Eden. globalThis.__reliableDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__reliableDry !== false, MOD = "bbttcc-campaign", report = { DRY_RUN, text: [] };
  const C = game.bbttcc.api.campaign; const id = C.getActiveCampaignId(); const c = C.getCampaign(id);
  let scene = game.scenes.find(s => s.getFlag(MOD, "reliableScene"));
  if (!scene) {
    report.text.push("stand-in scene");
    if (!DRY_RUN) {
      scene = await Scene.create({ name: "TEMP — The Absolutely Reliable", navigation: true, width: 2400, height: 1400, padding: 0, backgroundColor: "#141a22", grid: { type: 1, size: 100 }, ownership: { default: 2 }, flags: { [MOD]: { reliableScene: true } } });
      const label = (x, text) => ({ author: game.user.id, x, y: 620, shape: { type: "r", width: 700, height: 160 }, text, fontSize: 64, textColor: "#e8d9a0", strokeWidth: 4, strokeColor: "#e8d9a0" });
      await scene.createEmbeddedDocuments("Drawing", [label(50, "GALLEY"), label(850, "CONTROL STATION"), label(1650, "BUNK ROOM")]);
    }
  }
  const sceneId = scene?.id ?? "(new)";
  const beats = foundry.utils.deepClone(c.beats);
  const byId = (x) => beats.find(b => b.id === x);
  const template = byId("reliable_lease_home");
  const coffeeReq = (byId("reliable_the_lease").choices || []).find(x => x.next === "rc_gearbox_coffee")?.requires ?? [];
  const NOT_OWNED = [{ beatMark: "reliable_bought", not: true }, { beatMark: "reliable_gearbox_signs", not: true }];
  const choice = (label, next, extra = {}) => ({ label, description: "", next, failNext: "", checkStat: "", checkDC: 0, ...extra });
  const NEW = {
    reliable_aboard: { label: "The Absolutely Reliable — Aboard", text: "She's where you left her, humming to herself. Your vault's stowed aboard, and opens from your Domain tab while you're here.",
      choices: [choice("The galley", "reliable_galley"), choice("The control station", "reliable_helm"), choice("The bunk room", "reliable_bunks"), choice("Back to the road", "")] },
    reliable_galley: { label: "The Absolutely Reliable — The Galley", text: "The table, the hyperspanner, the smell of someone else's cooking.",
      choices: [choice("Brew Young Gearbox's forgotten coffee", "rc_gearbox_coffee", { requires: foundry.utils.deepClone(coffeeReq) }), choice("Read the terms.", "reliable_lease_terms", { requires: NOT_OWNED }), choice("Craft your Signature Manifestation, if you haven't yet done so.", "ag_first_signature"), choice("Back through the ship", "reliable_aboard")] },
    reliable_helm: { label: "The Absolutely Reliable — The Control Station", text: "A wheel worn smooth by other people's hands. She goes where you point her. Plot your course with the Travel button.",
      choices: [choice("Plot a course", ""), choice("Back through the ship", "reliable_aboard")] },
    reliable_bunks: { label: "The Absolutely Reliable — The Bunk Room", text: "Bunks for more people than you are. Nothing here is yours yet, and you notice everything you'd change.",
      choices: [choice("Turn in. Lock the turn.", "ag_days_end", { requires: [{ flag: "storyPhase", lte: 1 }, { anyOf: [{ beatMark: "ag_ride_khezek_tor" }, { beatMark: "ag_ride_lyrenn" }] }] }), choice("Back through the ship", "reliable_aboard")] }
  };
  for (const [bid, def] of Object.entries(NEW)) {
    if (byId(bid)) continue;
    const b = foundry.utils.deepClone(template);
    Object.assign(b, { id: bid, label: def.label, description: def.text, choices: def.choices, sceneId, questId: null, questStep: null, questRole: null, inviteText: undefined });
    b.inject = { ...(b.inject || {}), repeatable: true, requires: [] };
    beats.push(b); report.text.push(`beat ${bid}`);
  }
  for (const bid of ["reliable_the_lease", "reliable_lease_home", "reliable_lease_terms", "rc_gearbox_coffee", "ag_first_signature", "ag_days_end"]) {
    const b = byId(bid); if (!b || b.sceneId === sceneId) continue;
    b._deferred = { ...(b._deferred || {}), sceneId: b.sceneId ?? null }; b.sceneId = sceneId; report.text.push(`aboard: ${bid}`);
  }
  const coffee = byId("rc_gearbox_coffee");
  const pour = (coffee?.choices || []).find(x => /^Pour/.test(x.label) && !x.next);
  if (pour) { pour.next = "reliable_galley"; report.text.push("coffee returns to the galley"); }
  const lock = byId("ag_days_end");
  if (lock && lock.label !== "The Absolutely Reliable — Lock the Turn") { lock.label = "The Absolutely Reliable — Lock the Turn"; report.text.push("Lock the Turn label"); }
  const notYet = (lock?.choices || []).find(x => x.next === "ag_crossroads_first_rides");
  if (notYet) { notYet.label = "Not yet — back through the ship"; notYet.next = "reliable_aboard"; report.text.push("Lock the Turn way out"); }
  const cross = (byId("ag_crossroads_first_rides")?.choices || []).find(x => x.next === "ag_days_end");
  if (cross) { cross.label = "Back aboard the Reliable"; cross.next = "reliable_aboard"; delete cross.requires; report.text.push("Crossroads door"); }
  for (const bid of ["khezek_tor_town_walk", "lyrenn_town_walk", "fixit_town_walk"]) {
    const ready = (byId(bid)?.choices || []).find(x => /^Ready to move on/.test(String(x.label)));
    if (ready) { ready.label = "Back to the road"; ready.description = ""; ready.next = ""; report.text.push(`${bid}: Back to the road`); }
  }
  const ar = game.actors.get("kQl5Nvi32YMUMdfj");
  if (ar && ar.ownership.default !== 3) { report.text.push("players own the Reliable"); if (!DRY_RUN) await ar.update({ "ownership.default": 3 }); }
  if (!DRY_RUN && report.text.length) await C.saveCampaign(id, { ...c, beats });
  report.sceneId = sceneId;
  console.log("RELIABLE " + JSON.stringify(report));
})();

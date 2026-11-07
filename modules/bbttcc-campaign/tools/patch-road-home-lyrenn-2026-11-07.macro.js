/*
 * patch-road-home-lyrenn-2026-11-07.macro.js — Dave 2026-11-07.
 * The Road Home opens in Act 1 (Ride back on the Act 1 town cards was refused as Act 2 content and closed in silence), and Saddle up opens the console with no fixed destination.
 * Lyrenn's town walk gets Dave's new opening, and the well-water button gets his YOLO line.
 * Ember Bad Eden. globalThis.__roadHomeDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__roadHomeDry !== false, report = { DRY_RUN, text: [] };
  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id), beats = foundry.utils.deepClone(c.beats);
  const get = i => { const b = beats.find(x => x.id === i); if (!b) throw new Error(`${i} not found`); return b; };
  const road = get("ride_back_home");
  const gate = (road.inject?.requires || []).find(r => r?.flag === "storyPhase");
  if (gate && gate.gte !== 1) { gate.gte = 1; report.text.push("Road Home gate -> Act 1"); }
  if (/\bact2\b/.test(road.tags || "")) { road.tags = road.tags.replace(/\s*\bact2\b/, "").trim(); report.text.push("Road Home tag"); }
  const saddle = (road.choices || []).find(x => x.openTravel);
  if (saddle?.openTravel?.hexName) { saddle.openTravel = {}; report.text.push("Saddle up: no fixed destination"); }
  const walk = get("lyrenn_town_walk");
  const OLD = "Lyrenn doesn't greet you. It notices you — which around here is the same thing, done more honestly.\n\nThe rows bend with the light. Wind chimes made from irrigation parts keep up their constant nervous music. Workers straighten as you pass, tip a tool, and go back to it: no fuss no muss. You can respect that. You're pretty sure your food is going to taste better now somehow.";
  const NEW = "Lyrenn is a big, lovable, dirty hippie of a town.\n\nFar out man. Finger snaps.\n\nThere are wind chimes (because of course there are), and they are handmade out of old irrigation parts.\n\nSome of the wind chimes appear to be tie-dyed.\n\nThat's the kind of town this is.";
  if (walk.description.includes(OLD)) { walk.description = walk.description.replace(OLD, NEW); report.text.push("Lyrenn opening"); }
  const well = (walk.choices || []).find(x => x.next === "rc_lyrenn_well_water");
  const LABEL = "Drink the well-water. YOLO! (Technically not true, please see the game rules on dying, death, and reincarnation)";
  if (well && well.label !== LABEL) { well.label = LABEL; report.text.push("well-water button"); }
  if (!DRY_RUN && report.text.length) await C.saveCampaign(id, { ...c, beats });
  console.log("ROADHOME " + JSON.stringify(report));
})();

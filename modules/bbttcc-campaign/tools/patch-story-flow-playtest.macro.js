/**
 * patch-story-flow-playtest.macro.js — GM macro/console. DRY_RUN default true.
 *
 * STORY FLOW · PLAYTEST FIXES (2026-09-18, live-caught by the owner in Act 1). Accumulates the content-side fixes from the
 * tire-kick; every section is idempotent, so re-running after a new section is added applies only the new one.
 *
 *  P1. The Crossroads and Day's End are placeless. Day one's hub sits "at the edge of your holdings" and the ledger closes
 *      wherever the party stands — but both beats inherited Allesh-Gilliam as their place from the quest, so "Call it a day"
 *      from Khezek-Tor's cookline routed into a beat the location guard refused as "at Allesh-Gilliam". `where: "anywhere"`.
 *
 *  P2. The Tree's Session is a ROAD encounter. The Forest of Early Tifaret fires on the first ride to Furrier's Fixit-Farm
 *      (pinned leg), and every beat of the session — approach, merge, the three questions, the Obstructor, the tally, the
 *      endings — plays right there on the road. All nineteen inherited PolygonForest.d from the quest, so NOW would have sent
 *      the Travel Console to the forest hex and the guard would have refused any beat fired by hand. `where: "anywhere"`.
 *
 *  P3. DAY'S END IS THE MASTER TERMINAL (owner ruling 2026-09-18: "derive certitude, no guessing"). Every town walk's
 *      "Call it a day" routes to `ag_days_end`, and the terminal reads the story store to know what the evening is:
 *        · First Night not yet played → "First, the night" (the day-one rail: Soma break → the Tent → the Crossroads)
 *        · First Night played → "Back to the crossroads — daylight left"
 *        · a ride behind you → "The turn is locked. Run it." (the three ledger items live in that choice)
 *      "Back to town" at the Crossroads is a real ride (`ag_ride_home`, openTravel Allesh-Gilliam); Allesh-Gilliam's
 *      arrival list gains the town walk behind the Act 2 HQ intro, so riding home in Act 1 reopens the walk (the walk
 *      is a hub: oncePerHex false). The Crossroads text goes GENERIC (no "morning of the second day", no "two of them
 *      haven't met you yet") — a repeatable beat's vocabulary must survive its second play.
 *
 *  P4. PIKE SENDS FOR YOU (2026-09-18, live-caught on the first Act 2 morning). The HQ door on the town map runs the HQ
 *      cinematic, whose only choice was "Find the Marshal" → the day-one welcome ("Pike Doesn't Get Up") → the Act 1 walk;
 *      in Act 2 that replaced the players' view of the real HQ beat and looped them. The cinematic is now an Act 2 door
 *      too: "Find the Marshal" shows in Act 1 only, "Pike sent for you" shows from Act 2 and opens the HQ beat. The HQ
 *      beat is renamed "Pike Sends for You" and its opening reads as a summons after That One Night (the wall, the gate);
 *      Pike's errand lines are unchanged.
 *
 * Backup download before write; GM only.
 */
(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = []; let changes = 0; const say = (s) => report.push(s);
  const setField = (id, k, v) => { const b = byId.get(id); if (!b) return say(`✗ MISSING beat ${id}`); if (JSON.stringify(b[k]) === JSON.stringify(v)) return say(`· ok ${id} ${k}`); b[k] = v; changes++; say(`⚙ ${id}: ${k} = ${JSON.stringify(v)}`); };

  // P1
  setField("ag_crossroads_first_rides", "where", "anywhere");
  setField("ag_days_end", "where", "anywhere");
  setField("ag_ride_khezek_tor", "where", "anywhere");
  setField("ag_ride_lyrenn", "where", "anywhere");

  // P2
  for (const b of camp.beats || []) if (b?.story?.quest === "tifaret" || /^forest_of_tifaret_/.test(String(b?.id || ""))) setField(b.id, "where", "anywhere");

  // P3 ── the terminal
  const ch = (label, next, extra = {}) => Object.assign({ label, next: next || "", description: "", checkStat: "", checkDC: 0, failNext: "" }, extra);
  const setChoices = (id, rows) => { const b = byId.get(id); if (!b) return say(`✗ MISSING beat ${id}`); if (JSON.stringify(b.choices) === JSON.stringify(rows)) return say(`· ok ${id} choices`); b.choices = rows; changes++; say(`▸ ${id}: ${rows.length} choice(s) — ${rows.map(r => r.label).join(" · ")}`); };
  const retargetChoice = (id, labelRe, next) => { const b = byId.get(id); if (!b) return say(`✗ MISSING beat ${id}`); const c = (b.choices || []).find(c => c && labelRe.test(String(c.label || ""))); if (!c) return say(`✗ ${id}: no choice ${labelRe}`); if (c.next === next) return say(`· ok ${id} "${c.label}" → ${next}`); c.next = next; changes++; say(`▸ ${id}: "${c.label}" → ${next}`); };
  setField("ag_days_end", "description", "The sun goes down wrong-colored and gorgeous, and the day Thatwards is spent. What the evening is depends on what the day was — the ledger knows, and so does the town.\n\nAnd then — well. Then we find out what was waiting for the ink to dry.");
  setChoices("ag_days_end", [
    ch("First, the night — the town lets go of you", "ag_first_night_soma_break", { description: "Day one's evening: the Soma break, the tent at the edge of town, and the fork in the road come morning.", requires: [{ beatMark: "ag_first_night_soma_break", not: true }] }),
    ch("Back to the crossroads — daylight left", "ag_crossroads_first_rides", { requires: [{ beatMark: "ag_first_night_soma_break" }] }),
    ch("The turn is locked. Run it.", "", { description: "Before the world moves, the ledger wants three things. 1. Divvy the holdings — say it out loud and write it down, which hexes belong to which faction (hex sheets: claim them now). 2. Plan your Strategic Activities — each faction sets its work for the turn; the Plan console is open. 3. Lock it in — when every faction's plans are set, your GM runs the Turn Driver and the world takes its turn.", requires: [{ anyOf: [{ beatMark: "ag_ride_khezek_tor" }, { beatMark: "ag_ride_lyrenn" }] }] })
  ]);
  for (const id of ["allesh_gilliam_town_walk", "lyrenn_town_walk", "khezek_tor_town_walk"]) retargetChoice(id, /^call it a day$/i, "ag_days_end");   // the ACT 1 walks only — Day's End is Act 1's terminal; Act 2 towns keep their own evening
  // P3 ── the ride home + a generic Crossroads
  if (!byId.get("ag_ride_home")) {
    const tmpl = byId.get("ag_ride_lyrenn"); const at = (camp.beats || []).findIndex(b => b?.id === "ag_ride_lyrenn");
    const nb = Object.assign(foundry.utils.deepClone(tmpl || {}), { id: "ag_ride_home", label: "The Road Home", questStep: 452, where: "anywhere",
      description: "Allesh-Gilliam is behind you the way home always is — closer than it looked on the way out, and lit. Somebody will have kept something warm.\n\n⚙ Plot the ride on the Travel Console — the road decides what you meet.",
      choices: [ch("🐎 Saddle up — ride home", "", { description: "Run the planned route on the Travel Console." }), ch("Actually — back to the Crossroads", "ag_crossroads_first_rides")],
      inject: { repeatable: true, requires: [{ flag: "storyPhase", gte: 1 }, { flag: "storyPhase", lte: 1 }] },
      worldEffects: Object.assign(foundry.utils.deepClone(tmpl?.worldEffects || {}), { openTravel: { hexName: "Allesh-Gilliam" } }) });
    if (at >= 0) camp.beats.splice(at + 1, 0, nb); else camp.beats.push(nb); byId.set(nb.id, nb); changes++; say("＋ ag_ride_home (The Road Home — openTravel Allesh-Gilliam)");
  } else say("· ok ag_ride_home exists");
  retargetChoice("ag_crossroads_first_rides", /^back to town$/i, "ag_ride_home");
  setField("ag_crossroads_first_rides", "description", "<!-- [SOMA-BREAK-2026-08-30] -->The coalition rides out to learn what it now owns. Surveying is its own kind of introduction: pacing the hexes, reading the fences, finding out which handshakes came with land attached.\n\nThe road forks at the edge of your holdings, and both signs are hand-painted. THATWARDS-BY-NORTH: <b>Khezek-Tor</b>, where the mine answered back and the smelters never sleep. THATWARDS-BY-GREEN: <b>Lyrenn</b>, where the fields remember you before you've been introduced.\n\nThree towns hold this stretch of Thatwards together. The order is yours, and so is the road home. The roads are not entirely yours — ride ready.");
  // P3 ── riding home in Act 1 reopens the walk
  { const walk = byId.get("allesh_gilliam_town_walk"); if (walk) { walk.inject = walk.inject || {}; if (walk.inject.oncePerHex !== false) { walk.inject.oncePerHex = false; changes++; say("⚙ allesh_gilliam_town_walk: inject.oncePerHex = false (hub)"); } else say("· ok walk oncePerHex"); } else say("✗ MISSING allesh_gilliam_town_walk"); }
  // P4 ── the HQ door knows the act
  setField("allesh_gilliam_hq_cinematics", "inject", Object.assign({}, byId.get("allesh_gilliam_hq_cinematics")?.inject || {}, { requires: [{ flag: "storyPhase", gte: 1 }] }));
  setChoices("allesh_gilliam_hq_cinematics", [
    ch("Find the Marshal", "allesh_gilliam_yarrow_welcome", { requires: [{ flag: "storyPhase", lte: 1 }] }),
    ch("Pike sent for you", "allesh_gilliam_introduction_to_hq", { description: "The runner said: bring whoever reads maps.", requires: [{ flag: "storyPhase", gte: 2 }] })
  ]);
  setField("allesh_gilliam_introduction_to_hq", "label", "Allesh-Gilliam — Pike Sends for You");
  setField("allesh_gilliam_introduction_to_hq", "description", "Pike sent a runner before the coffee was hot: come to the HQ, bring whoever reads maps. He doesn’t stand when you enter — you’ve seen that trick — but the boards behind him are lit the wrong colors this morning, and he’s looking at them, not you.\n\n“Night like that, and the town’s still standing. So. You’re the new variable.”\n\nHe gestures at the glowing menu boards.\n\n“That wall holds if people believe it will. That land feeds us if we don’t lie to it. And that gate?”\n\nHe taps a flickering leyline readout.\n\n“That thing is remembering wrong. Since last night, worse.”\n\nHe finally looks directly at you.\n\n“Fix one promise first. Then we’ll see how long you last. Fix two, well, maybe people might follow instead of holding their breath. Or measuring you for a box.\n\nWe need a replacement Leygate Stabilizer, and the only place I know that has one is Furrier's Fixit. Probably good you know them.\n\nAlso,\" he gestures at the maps again, and one section of city wall that stands out as … wrong.\n\nSee if you can tell us what we're doing wrong.\"");
  { const ho = camp.hexOverrides || {}; const key = Object.keys(ho).find(k => (ho[k]?.onEnterBeatIds || []).includes("allesh_gilliam_introduction_to_hq") || ho[k]?.onEnterBeatId === "allesh_gilliam_introduction_to_hq");
    if (!key) say("✗ no hexOverride lists allesh_gilliam_introduction_to_hq — set Allesh-Gilliam's on-enter beats by hand: [HQ intro, allesh_gilliam_town_walk]");
    else { const want = ["allesh_gilliam_introduction_to_hq", "allesh_gilliam_town_walk"]; if (JSON.stringify(ho[key].onEnterBeatIds) !== JSON.stringify(want)) { ho[key].onEnterBeatIds = want; changes++; say(`⚙ hexOverrides ${key}: onEnterBeatIds = [HQ intro, town walk]`); } else say("· ok Allesh-Gilliam on-enter list"); } }

  console.log(`[patch-story-flow-playtest] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Playtest patch DRY RUN: ${changes} change(s) (console). Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-playtest-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Playtest patch APPLIED: ${changes} change(s). Backup downloaded.`);
})();

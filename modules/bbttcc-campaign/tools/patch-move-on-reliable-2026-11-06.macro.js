/*
 * patch-move-on-reliable-2026-11-06.macro.js — Dave 2026-11-06: no first night, no Soma break, no explicit end of day in Act 1.
 * Allesh-Gilliam's "Ready to move on" goes to the Absolutely Reliable, which is how the party reaches Khezek-Tor and Lyrenn, and from there to the Crossroads.
 * Lock the Turn stays for when the rides are done. ag_first_night_soma_break and ag_first_morning are removed, with a backup in bbttcc-exports.
 * Ember Bad Eden. globalThis.__moveOnDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__moveOnDry !== false;
  const C = game.bbttcc.api.campaign; const id = C.getActiveCampaignId(); const c = C.getCampaign(id);
  const report = { DRY_RUN, text: [], missed: [] };
  const beats = foundry.utils.deepClone(c.beats);
  const find = (x) => beats.find(b => b.id === x);
  const ch = (label, next, description = "", extra = {}) => ({ label, next, description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const HUB = "reliable_the_lease", CROSS = "ag_crossroads_first_rides", ROUND = "allesh_gilliam_town_walk", SIG = "ag_first_signature";
  const GONE = new Set(["ag_first_night_soma_break", "ag_first_morning"]);
  const NIGHTLY = /^(Sleep\. Tomorrow, the land\.|Back to the morning\.|Back to the evening\.|First, the night)/;

  // The Round: first time to the hovercraft, then straight out to the Crossroads.
  const round = find(ROUND);
  const ready = (round.choices || []).find(x => x.label === "Ready to move on" && x.next === "ag_days_end");
  if (ready) {
    const at = round.choices.indexOf(ready);
    round.choices.splice(at, 1,
      ch("Ready to move on", HUB, "Time to look over the hovercraft. She's how you'll reach Khezek-Tor and Lyrenn.", { requires: [{ beatMark: HUB, not: true }] }),
      ch("Ready to move on", CROSS, "The road out to the Crossroads.", { requires: [{ beatMark: HUB }] }));
    report.text.push("Round: Ready to move on goes to the Reliable, then the Crossroads");
  }

  // The Reliable is the hub.
  const hub = find(HUB);
  if (hub.choices.some(x => NIGHTLY.test(x.label)) || !hub.choices.some(x => x.next === CROSS)) {
    hub.choices = hub.choices.filter(x => !NIGHTLY.test(x.label) && x.next !== SIG && x.next !== ROUND && x.next !== CROSS);
    hub.choices.push(
      ch("Sit with the thing only you can do.", SIG, "Your hands, the quiet, and the one effect that is yours alone."),
      ch("Back into town — something left undone", ROUND, "One more door before the road. The Welcome Round reopens."),
      ch("Head out — the Crossroads", CROSS, "Marshal Pike gets his parking back, at least temporarily."));
    report.text.push("Reliable: hub choices");
  }
  // Dave's text for the card.
  const LEASE_TEXT = "Young Gearbox left the paperwork on the galley table, weighted with a hyperspanner. He must have liked you after all.\n\nHe also left a card, with shaky handwriting in block letters. \u201CTHE ABSOLUTELY RELIABLE. 3 TURN LEASE. CERTIFIED BY ME. SHE LIKES BEING TALKED TO.\u201D\n\nUnder that, in a smaller, much neater hand - \u201CLease her or buy her. - Mara Quickhands\u201D";
  if (hub.description !== LEASE_TEXT) { hub.description = LEASE_TEXT; report.text.push("Reliable: lease card text"); }
  // Dave: Earn stays in the Terms, as friendship with the Farm rather than a certified part. Allies can simply ask Mara or Gearbox for her.
  const terms = find("reliable_lease_terms");
  const EARN = "\n<b>Earn</b> \u2014 FFF is generous with those they call friends. Earn their trust.";
  terms.description = terms.description.replace("<b>Two ways to keep her:</b>", "<b>Three ways to keep her:</b>");
  if (!terms.description.includes(EARN)) {
    const buyLine = /(\n<b>Buy<\/b>[^\n]*)/;
    if (!buyLine.test(terms.description)) report.missed.push("Terms: Buy line");
    else { terms.description = terms.description.replace(/\n<b>Earn<\/b>[^\n]*/, "").replace(buyLine, "$1" + EARN); report.text.push("Terms: Earn by friendship"); }
  }
  const earnHint = find("ans_reliable_lease_last_turn_plan_to_earn_it");
  const EARN_HINT = "FFF is generous with those they call friends. Earn their trust.";
  if (earnHint && earnHint.description !== EARN_HINT) { earnHint.description = EARN_HINT; report.text.push("Last turn: earn hint"); }
  const FFF = "U5YaO2p189LBMvVq";
  const askArc = find("fixit_arc_bay_conversation")?.choices?.find(x => x.next === "reliable_gearbox_signs");
  const ASK = "Ask Mara or Gearbox if you can just have her.";
  if (askArc && (askArc.label !== ASK || JSON.stringify(askArc.requires).includes("fixit_load_the_crate"))) {
    askArc.label = ASK;
    askArc.requires = [{ beatMark: "reliable_bought", not: true }, { beatMark: "reliable_gearbox_signs", not: true }, { relation: FFF, atLeast: "allied" }];
    report.text.push("Arc Bay: ask for her at Allied");
  }
  const signed = find("reliable_gearbox_signs");
  if (signed?.inject?.requires) {
    const reqs = signed.inject.requires.filter(r => r.beatMark !== "fixit_load_the_crate" && r.flag !== "storyPhase");
    if (!reqs.some(r => r.relation === FFF)) { reqs.push({ relation: FFF, atLeast: "allied" }); signed.inject.requires = reqs; report.text.push("Signed Over: gate is Allied"); }
  }

  // Dave: the old "Sit with..." label was confusing.
  const craft = hub.choices.find(x => x.next === SIG);
  if (craft && craft.label !== "Craft your Signature Manifestation, if you haven't yet done so.") { craft.label = "Craft your Signature Manifestation, if you haven't yet done so."; report.text.push("Reliable: Signature label"); }
  for (const x of ["reliable_lease_terms", "reliable_lease_home", SIG]) {
    const b = find(x);
    if (!b.choices.some(y => y.next === "ag_first_morning" || (x === SIG && y.next === HUB && y.requires))) continue;
    b.choices = b.choices.filter(y => y.next !== "ag_first_morning" && y.next !== HUB);
    b.choices.push(ch("Back to the galley table.", HUB));
    report.text.push(`${x}: back to the galley`);
  }
  const sig = find(SIG);
  // Dave's text; the sheet instructions at the bottom stay as they are.
  const SIG_TEXT = "Before venturing out into the Less New Newbie Zone, take this moment to craft your Signature Manifestation if you have not yet done so. It will grow in power with you and your power and, (inevitably) fame - so it\u2019s always in your press clippings.\n\n<i>On your sheet, Core tab, under Manifestations: the \u2726 slot. Take your time with it. The land will still be there when you're done.</i>";
  if (sig.description !== SIG_TEXT) { sig.description = SIG_TEXT; report.text.push("Signature: Dave's text"); }

  // Dave: Crossroads text. The seal is Act 2 knowledge.
  const crossBeat = find(CROSS);
  const OLD_BUMP = "Lots of handshakes quickly turned fist NOPE elbow bumps.";
  if (crossBeat.description.includes(OLD_BUMP)) { crossBeat.description = crossBeat.description.replace(OLD_BUMP, "Lots of handshakes have quickly turned into fi - NOPE elbow bumps.\n\nHygiene people!"); report.text.push("Crossroads: elbow bumps"); }
  const ktRide = crossBeat.choices.find(x => x.next === "ag_ride_khezek_tor");
  const KT_LINE = "The Mountain Town, where riches compete with explosions and other problems for attention.";
  if (ktRide && ktRide.description !== KT_LINE) { ktRide.description = KT_LINE; report.text.push("Crossroads: Khezek-Tor line"); }

  // Dave: the road north. The Travel Console line at the bottom stays.
  const rideKT = find("ag_ride_khezek_tor");
  const RIDE_KT = "Boots in stirrups, and away you go to the prize of the Avuncular Order\u2019s Bad Eden holdings.\n\nKhezek-Tor. The only known Yesodium mine in existence. It has already exploded once, as you have now heard multiple times.\n\nIf you haven\u2019t, shame on you for skipping conversations.\n\nYou had stirrups installed in your personal rigs because it felt appropriate, considering the rocky terrain.";
  const consoleAt = rideKT.description.indexOf("\u2699 Plot the ride");
  if (consoleAt < 0) report.missed.push("Khezek-Tor ride: console line");
  else if (!rideKT.description.startsWith(RIDE_KT)) { rideKT.description = `${RIDE_KT}\n\n${rideKT.description.slice(consoleAt)}`; report.text.push("Khezek-Tor ride: Dave's text"); }

  // Lock the Turn is for when the rides are done.
  const days = find("ag_days_end");
  if (days.choices.some(x => NIGHTLY.test(x.label))) { days.choices = days.choices.filter(x => !NIGHTLY.test(x.label)); report.text.push("Lock the Turn: first night choice gone"); }
  const notYet = days.choices.find(x => x.next === CROSS);
  if (notYet?.requires) { delete notYet.requires; report.text.push("Lock the Turn: back to the Crossroads always open"); }
  const camp = find(CROSS).choices.find(x => x.next === "ag_days_end");
  if (camp && camp.label !== "Enough riding — lock the turn") { camp.label = "Enough riding — lock the turn"; report.text.push("Crossroads: lock the turn label"); }

  // The quest log.
  const story = foundry.utils.deepClone(c.story);
  const arrival = story.scripts?.allesh_gilliam?.arrival;
  if (arrival) {
    const d = "Eat here, sleep here, learn names. In the morning, ride out and see what you own.";
    if (arrival.description.includes(d)) { arrival.description = arrival.description.replace(d, "Eat here, learn names. Then ride out and see what you own."); report.text.push("quest: description"); }
    const roundStep = arrival.steps.find(s => s.id === "round");
    if (roundStep?.done?.anyOf?.some(x => GONE.has(x))) { roundStep.done.anyOf = roundStep.done.anyOf.filter(x => !GONE.has(x)); report.text.push("quest: Round step"); }
    const at = arrival.steps.findIndex(s => s.id === "night");
    if (at >= 0) { arrival.steps.splice(at, 1, { id: "reliable", label: "The Absolutely Reliable", line: "Look over the hovercraft. She's how you'll reach Khezek-Tor and Lyrenn.", beats: [HUB] }); report.text.push("quest: First Night step is the Reliable"); }
    const tent = arrival.steps.find(s => s.id === "tent");
    const line = "Head out to the Crossroads. There's a white tent where the road forks.";
    if (tent && tent.line !== line) { Object.assign(tent, { label: "The White Tent", line }); report.text.push("quest: tent step"); }
  }

  // Nothing may still point at the two beats.
  const keep = beats.filter(b => !GONE.has(b.id)), gone = beats.filter(b => GONE.has(b.id));
  const hits = (o) => [...GONE].some(g => JSON.stringify(o || "").includes(g));
  const dangling = [...keep.filter(hits).map(b => b.id), ...(hits(story) ? ["story"] : [])];
  report.remove = gone.map(b => b.id); report.dangling = dangling;
  const marks = Object.keys(C.story.state(id)?.played || {}).filter(x => GONE.has(x) || x === "ag_days_end");
  report.forget = marks;
  if (dangling.length || report.missed.length) { console.log("MOVEON " + JSON.stringify(report)); return ui.notifications.error("Move-on patch: something still points at the removed beats, or a text edit missed. Nothing changed."); }
  if (!DRY_RUN) {
    if (gone.length) {
      const file = new File([JSON.stringify({ campaignId: id, beats: gone }, null, 1)], "removed-first-night-beats-2026-11-06.json", { type: "application/json" });
      const up = await foundry.applications.apps.FilePicker.implementation.upload("data", "bbttcc-exports", file, {}, { notify: false });
      if (!up?.path) throw new Error("backup upload failed; nothing changed");
      report.backup = up.path;
    }
    if (report.text.length || gone.length) await C.saveCampaign(id, { ...c, beats: keep, story });
    if (marks.length) await C.story.forget(marks, id);
  }
  console.log("MOVEON " + JSON.stringify(report));
  ui.notifications.info(`Move-on patch: ${DRY_RUN ? "dry run" : "applied"}, ${report.text.length} change(s).`);
})();

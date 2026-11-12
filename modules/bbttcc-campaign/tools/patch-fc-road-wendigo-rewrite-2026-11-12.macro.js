/*
 * patch-fc-road-wendigo-rewrite-2026-11-12.macro.js — Dave (2026-11-12): "Updated beat." The Wendigo road meeting (fc_road_wendigo)
 * takes Dave's text and three questions, each with a one-word answer:
 *   "Where did you get my canteen?"                                 → “Exactly.”
 *   "We have not given YOU directions … Please explain."            → “Precisely.”
 *   "You are Wendigo. You are bad people. Why is there no 'fight them' button?" → “Adieu!” (they go; the answer only leaves)
 * New answer beats ans_fc_road_wendigo_canteen / _directions / _fight (the ans_* shape: dialog, repeatable, evergreen, storyPhase ≥ 2).
 * The two first answers offer the remaining questions + Leave. The old answer beats (give / ask for directions / ask where they're
 * going) are unreachable now and kept. Typos fixed: "out here.” It says" → "out here,” it says"; "Amazing!” Says" → "Amazing!” says".
 * Ember Bad Eden. globalThis.__fcRoadDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__fcRoadDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const road = beats.find(b => b.id === "fc_road_wendigo");
  const tmpl = beats.find(b => b.id === "ans_fc_road_wendigo_ask_for_directions");
  if (!road || !tmpl) throw new Error("fc_road_wendigo or its answer template missing");
  const ch = (label, next) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "" });

  const TEXT = [
    "There are three Wendigo on the road ahead.",
    "They are smiling and nodding, and waving at you.",
    "They are also wearing striking smart casual evening wear.",
    "Absolutely made of the flayed skin of children who don’t make their beds.",
    "No, wait, they’re uniforms for some sort of catering company …",
    "One presents a canteen — your canteen, which you do not remember dropping. “Found this, friend! Might need it out here,” it says with a chuckle.",
    "“By the way, your directions were spot on. Amazing!” says another."
  ].join("\n\n");

  const Q = {
    canteen: { id: "ans_fc_road_wendigo_canteen", q: "Where did you get my canteen?", a: "“Exactly.”" },
    directions: { id: "ans_fc_road_wendigo_directions", q: "We have not given YOU directions … Please explain.", a: "“Precisely.”" },
    fight: { id: "ans_fc_road_wendigo_fight", q: "You are Wendigo. You are bad people. Why is there no “fight them” button?", a: "“Adieu!”" }
  };
  const LEAVE = ch("Leave.", "");
  const others = (k) => Object.entries(Q).filter(([kk]) => kk !== k).map(([, v]) => ch(v.q, v.id));

  if (road.description !== TEXT) { road.description = TEXT; report.changed.push("road: Dave's text"); }
  const WANT = [...Object.values(Q).map(v => ch(v.q, v.id)), LEAVE];
  if (JSON.stringify((road.choices || []).map(x => [x.label, x.next])) !== JSON.stringify(WANT.map(x => [x.label, x.next]))) {
    road.choices = WANT; report.changed.push("road: three questions + Leave");
  }

  for (const [k, v] of Object.entries(Q)) {
    const choices = k === "fight" ? [LEAVE] : [...others(k), LEAVE];
    let b = beats.find(x => x.id === v.id);
    if (!b) {
      b = foundry.utils.deepClone(tmpl);
      Object.assign(b, { id: v.id, label: `The Road — The Politest Monsters in the World — ${v.q}` });
      beats.push(b); report.changed.push("answer added: " + v.id);
    }
    if (b.description !== v.a) { b.description = v.a; report.changed.push(v.id + ": text"); }
    if (JSON.stringify((b.choices || []).map(x => [x.label, x.next])) !== JSON.stringify(choices.map(x => [x.label, x.next]))) { b.choices = choices; report.changed.push(v.id + ": choices"); }
  }

  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("FCROAD " + JSON.stringify(report));
  return report;
})();

/* patch-grief-stillwater-2026-10-21.macro.js — GRIEF TOWNS REWORK, Stillwater (Story Review Ledger rows SW1–SW13, all ACCEPTED by Dave 2026-10-21;
 *  SW3 as Dave edited it — no Monodynamic clause; SW4 "The Battles" per the Battle/Heist/Parley ruling).
 *
 *  Shape: the arrival is a nameless HUB with doors (lemonade · bandstand · paper · station · kerb); the four cracks stop being
 *  meter-gated cards (`stillwaterCrack` retired — Dave: "retire them") and become OUTCOMES of played scenes:
 *    crack_1  ← sw_outside   (tell Bucky about the roads / the Battles / the Shattering, then "watch his face")
 *    crack_2  ← sw_may       (sit on the platform bench, ask how long she's been waiting)
 *    crack_3  ← sw_show      (show Amos something from the after — three relics, Mal warns once, no roll)
 *    crack_4  ← the hub's "Walk out to where the road runs out" (hidden until ANY of crack 1/2/3 is played)
 *  What You Do With the News now requires crack_4 played (Dave: "unlock on the last rung alone").
 *  The physics test is a CHOICE: "Drop your glass. Just to see." → sw_glass (hidden once played).
 *  Permit: the old meter gate (≥3) becomes `beatMark stillwater_crack_3`, reached from the bandstand ("Read the permit on the post.").
 *  Every door gets a "Back to the street" row. Meta asides (bingo card, the author on Bucky) in the fun phase; Mal stops doing bits at crack_1.
 *  Every paragraph of Dave's that moved is kept verbatim at the moment it is now earned.
 *
 *  Idempotent; DRY_RUN default true; backs up `campaigns`. GM only. The script ladder lines live in scripts/story-scripts.js (same commit).
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
  const report = []; let changes = 0;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const row = (label, next, description = "", requires = null, extra = {}) => Object.assign({ label, next, description, checkStat: "", checkDC: 0, failNext: "" }, requires ? { requires } : {}, extra);

  // ---- helpers (all idempotent) ----
  const setDesc = (id, to, note) => { const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: not found`); if (b.description === to) return report.push(`· ok ${id}: ${note}`); b.description = to; changes++; report.push(`✚ ${id}: ${note}`); };
  const rep = (id, from, to, note) => { const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: not found`); const d = String(b.description || "");
    if (to && d.includes(to) && !d.includes(from)) return report.push(`· ok ${id}: ${note}`); if (d.includes(from)) { b.description = d.replace(from, to); changes++; return report.push(`✚ ${id}: ${note}`); } report.push(`⚠ ${id}: baseline not found for "${note}"`); };
  const appendPara = (id, para, note) => { const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: not found`); const d = String(b.description || ""); if (d.includes(para)) return report.push(`· ok ${id}: ${note}`); b.description = d.replace(/\s+$/, "") + "\n\n" + para; changes++; report.push(`✚ ${id}: ${note}`); };
  const setMem = (id, to, note) => { const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: not found`); if (b.memoryText === to) return report.push(`· ok ${id}: ${note}`); b.memoryText = to; changes++; report.push(`✚ ${id}: ${note}`); };
  const setChoices = (id, list, note) => { const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: not found`); if (same(b.choices, list)) return report.push(`· ok ${id}: ${note}`); b.choices = foundry.utils.deepClone(list); changes++; report.push(`✚ ${id}: ${note}`); };
  const addRow = (id, r, note) => { const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: not found`); b.choices = Array.isArray(b.choices) ? b.choices : [];
    const ex = b.choices.find(c => c.label === r.label); if (ex) { if (same(ex, r)) return report.push(`· ok ${id}: ${note}`); Object.assign(ex, foundry.utils.deepClone(r)); changes++; return report.push(`✚ ${id}: ${note} (row updated)`); }
    b.choices.push(foundry.utils.deepClone(r)); changes++; report.push(`✚ ${id}: ${note}`); };
  const choiceNext = (id, label, to, note) => { const b = byId.get(id); const c = b?.choices?.find(x => x.label === label); if (!c) return report.push(`⚠ ${id}: choice "${label}" not found`); if (c.next === to) return report.push(`· ok ${id}: ${note}`); c.next = to; changes++; report.push(`✚ ${id}: ${note}`); };
  const dropRequires = (id, note) => { const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: not found`); let rq = b.inject?.requires; if (rq == null) return report.push(`· ok ${id}: ${note}`);
    rq = Array.isArray(rq) ? rq : [rq]; const kept = rq.filter(r => !(r && r.flag === "stillwaterCrack")); if (kept.length === rq.length) return report.push(`· ok ${id}: ${note}`);
    if (kept.length) b.inject.requires = kept; else delete b.inject.requires; changes++; report.push(`✚ ${id}: ${note}`); };
  const setRequires = (id, rq, note) => { const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: not found`); b.inject = b.inject || {}; if (same(b.inject.requires, rq)) return report.push(`· ok ${id}: ${note}`); b.inject.requires = foundry.utils.deepClone(rq); changes++; report.push(`✚ ${id}: ${note}`); };
  const dropMeter = (id, key, note) => { const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: not found`); const m = b.worldEffects?.meters; if (!Array.isArray(m)) return report.push(`· ok ${id}: ${note}`);
    const n = m.length; b.worldEffects.meters = m.filter(x => x?.key !== key); if (!b.worldEffects.meters.length) delete b.worldEffects.meters; if (b.worldEffects.meters?.length !== n) { changes++; report.push(`✚ ${id}: ${note}`); } else report.push(`· ok ${id}: ${note}`); };
  const newBeat = (tplId, id, label, description, choices, opts = {}, note) => { if (byId.has(id)) return report.push(`· ok ${id}: ${note}`); const tpl = byId.get(tplId); if (!tpl) return report.push(`⚠ ${tplId}: template not found`);
    const nb = foundry.utils.deepClone(tpl); nb.id = id; nb.label = label; nb.description = description; nb.choices = foundry.utils.deepClone(choices);
    delete nb.questStep; delete nb.refs; if (nb.inject) delete nb.inject.requires; if (nb.worldEffects) { delete nb.worldEffects.meters; delete nb.worldEffects.receipts; delete nb.worldEffects.questEffects; }
    if (nb.audio) { nb.audio.enabled = false; nb.audio.src = ""; } nb.type = opts.type || nb.type; nb.priority = "background"; nb.story = { quest: "stillwater" };
    if ("speaker" in opts) { if (opts.speaker) nb.speakerActorId = opts.speaker; else delete nb.speakerActorId; }
    if (opts.memoryText) nb.memoryText = opts.memoryText; else delete nb.memoryText;
    camp.beats.push(nb); byId.set(id, nb); changes++; report.push(`✚ ${id}: ${note}`); };

  const HUB = "stillwater_arrival", BACK = row("Back to the street", HUB);
  const ACT2 = { flag: "storyPhase", gte: 2 };
  const BUCKY = "X0PanInGmYx1ZP5L", MAY = "0Ug5vRUWbnwnbmP7", AMOS = "WFI85zndIHHScjVK";

  // ---- SW1 the hub ----
  setDesc(HUB,
    "After a hundred miles of land that bites and remembers and holds opinions, Stillwater is SOFT. Cut grass. Percolator coffee. A kid selling lemonade at a card table with a hand-lettered sign. The diner has pie that is simply pie, made by a person, for money. People wave — not warily, not for advantage. Just waving. Everyone on the kerb is in costume — mechs, elves, two ghostbusters, a bandleader's coat — and nobody, anywhere, is treating it as a costume. Three people tell you they love yours. Nobody asks what you're supposed to be; they're sure you know.\n\n" +
    "(Cut grass and percolator coffee. If you have been keeping the bingo card, this is the row where the card gets nervous.)\n\n" +
    "And it is the most unsettling thing you have felt in a very long time, precisely because nothing here is wounded or watching. The land is only land. Up Main Street the band is mid-bar. A man with ink to the elbows is handing out a newspaper. Down at the station somebody is sitting on the platform bench.\n\n" +
    "⚙ GM: let them exhale first. The horror is entirely in the arithmetic and it works better if the table has already relaxed. Rung 0 is the newspaper.",
    "SW1 hub text — no names, no paper handed over, the doors");
  setChoices(HUB, [
    row("The lemonade stand", "stillwater_lemonade"),
    row("The bandstand", "stillwater_bandstand"),
    row("The man with the paper", "stillwater_paper"),
    row("The station", "stillwater_platform"),
    row("The kerb", "stillwater_waving"),
    row("\"Drop your glass. Just to see.\"", "sw_glass", "", [{ beatMark: "sw_glass", not: true }]),
    row("Walk out to where the road runs out.", "stillwater_crack_4", "", [{ anyOf: [{ beatMark: "stillwater_crack_1" }, { beatMark: "stillwater_crack_2" }, { beatMark: "stillwater_crack_3" }] }])
  ], "SW1 hub doors (+ glass test hidden once played, + the walk out hidden until any crack)");
  dropMeter(HUB, "stillwaterCrack", "SW1 stillwaterCrack meter retired on the hub");

  // ---- SW2 the glass ----
  newBeat("stillwater_waving", "sw_glass", "Stillwater — Just to See",
    "You drop the glass. It breaks. That's all it does. It doesn't chuckle, it doesn't bounce, it doesn't mean anything; a woman in an elf hat says \"Oh, honey,\" and sweeps it up, and apologises for the floor. You stand there with your hand still open, waiting for the world to do something about it, and the world has a parade to get to.\n\n" +
    "**Mal:** *\"First place in a hundred miles where a thing is just a thing. Enjoy it. You're about to find out why.\"*",
    [BACK], { memoryText: "A dropped glass in Stillwater just broke. Someone swept it up." }, "SW2 sw_glass — the physics test, as a choice");

  // ---- SW3 lemonade: aside + rows, meter retired ----
  appendPara("stillwater_lemonade", "(A nine-year-old with an exclusive concession and a one-page ledger. The author wishes to state that Bucky Sorrel is the most realistic economic actor in this campaign.)", "SW3 Bucky aside (Dave's edit)");
  addRow("stillwater_lemonade", row("\"Tell him about the roads.\"", "sw_outside"), "SW3 → sw_outside");
  addRow("stillwater_lemonade", BACK, "SW3 back row");
  dropMeter("stillwater_lemonade", "stillwaterCrack", "SW3 meter retired");

  // ---- SW4 sw_outside ----
  newBeat("stillwater_lemonade", "sw_outside", "Stillwater — The World Outside",
    "You tell him. Not dramatically — you just refer to it, the way anyone would.",
    [
      row("\"The roads.\"", "", "\"Roads!\" He nods, businesslike. \"Parade route's Main Street. Lemonade's here.\" Whatever you said about the roads has become a question about the parade route and been answered."),
      row("\"The Battles.\"", "", "His face goes politely, pleasantly blank, the way a face does when someone speaks a language it doesn't have. Then: \"You want a refill? No refunds.\""),
      row("\"The Shattering.\"", "", "Nothing. Not a flinch, not a frown. The word goes past him like weather past a window, and he asks if the ghostbuster's come back yet for his change."),
      row("\"Try it a fourth way, and watch his face.\"", "stillwater_crack_1"),
      row("Back to the stand", "stillwater_lemonade")
    ], { speaker: BUCKY }, "SW4 sw_outside — three mentions, then the read");

  // ---- SW5 crack_1 as outcome ----
  setDesc("stillwater_crack_1",
    "You try it a fourth way and watch. It slides off. They are not refusing the subject. They cannot PERCEIVE it. There is no after, here, for the words to land in.\n\n" +
    "**Mal:** *\"Right. No more bits. Not in this one.\"*", "SW5 crack_1 text (the four tries happened in sw_outside; Mal stops doing bits)");
  setMem("stillwater_crack_1", "Stillwater cannot perceive the world outside. The words slide off.", "SW5 memory");
  setChoices("stillwater_crack_1", [BACK], "SW5 back row");
  dropRequires("stillwater_crack_1", "SW5 meter gate dropped");

  // ---- SW6 platform → the bench ----
  choiceNext("stillwater_platform", "Sit on the bench.", "sw_may", "SW6 the bench leads to May");
  addRow("stillwater_platform", BACK, "SW6 back row");
  dropMeter("stillwater_platform", "stillwaterCrack", "SW6 meter retired");

  // ---- SW7 sw_may ----
  newBeat("stillwater_crack_2", "sw_may", "Stillwater — The Bench",
    "She shifts over to make room without being asked, coat buttoned, entirely content. Her boy's just gone across for a lemonade before the 4:10. He'll be right back. She has his ticket. She tells you about him with the specific unhurried warmth of someone who expects to be interrupted by an arrival at any moment.",
    [
      row("\"Ask to see the ticket.\"", "", "Unpunched. Soft at the corners from being held. STILLWATER — UP THE LINE — 4:10. She takes it back gently, the way you'd take back a hand."),
      row("\"Ask what he's like.\"", "", "Tall for twelve. Hates the elf ears, wears them for her. Takes his lemonade with too much sugar. She has him entirely and he is nowhere."),
      row("Look up the line.", "", "Rails for a hundred yards. Then grass that has had two hundred years. The clock says 4:08."),
      row("\"Ask how long she's been waiting.\"", "stillwater_crack_2"),
      row("Leave her to it", HUB)
    ], { speaker: MAY }, "SW7 sw_may — she tells you about Denny");

  // ---- SW8 crack_2 as outcome ----
  setDesc("stillwater_crack_2",
    "\"Oh — not long.\" She smiles up the line. Her name is May Farrow, and her son is Denny, and he'll be right back.\n\n" +
    "There has not been a train on this line in two hundred years. There has not been a line. You work out, doing arithmetic you wish you hadn't started, roughly how long she has been sitting on that bench being happy, and the number does something to you that the town cannot do to itself.\n\n" +
    "They are all waiting, in one way or another, for a tomorrow that already didn't come.", "SW8 crack_2 text (the introduction happened on the bench)");
  setMem("stillwater_crack_2", "May Farrow has been on the platform bench for two hundred years, waiting for Denny's 4:10.", "SW8 memory");
  setChoices("stillwater_crack_2", [BACK], "SW8 back row");
  dropRequires("stillwater_crack_2", "SW8 meter gate dropped");

  // ---- SW9 paper: the way to Amos ----
  addRow("stillwater_paper", row("\"Show him something from the after.\"", "sw_show"), "SW9 → sw_show");
  addRow("stillwater_paper", BACK, "SW9 back row");
  dropMeter("stillwater_paper", "stillwaterCrack", "SW9 meter retired");

  // ---- SW10 sw_show ----
  newBeat("stillwater_paper", "sw_show", "Stillwater — Something From the After",
    "He's folding the next copy for the next person. You have something in your pocket with the after all over it.\n\n" +
    "**Mal:** *\"There's no roll for this. You're about to hand a man the news. I'll shut up.\"*",
    [
      row("\"His own paper, next to a dry one from the road.\"", "stillwater_crack_3"),
      row("\"Your weapon. The scars on it.\"", "stillwater_crack_3"),
      row("\"The Wendigo's name-card.\"", "stillwater_crack_3", "", [{ beatMark: "wendigo_confluence_name_cards" }]),
      row("Put it away", "stillwater_paper", "He hands you a paper instead. The ink is wet.")
    ], { speaker: AMOS }, "SW10 sw_show — what do you show him");

  // ---- SW11 crack_3 as outcome ----
  rep("stillwater_crack_3", "You show them proof. A relic of the ruined world — something with the after all over it, unmistakable, undeniable.", "You show him. Something with the after all over it, unmistakable, undeniable.", "SW11 opening (they chose it)");
  rep("stillwater_crack_3", "and you have just handed one out to see what would happen.", "and you have just handed one out.", "SW11 no \"to see what would happen\"");
  setMem("stillwater_crack_3", "Amos Teague saw the after. He aged two hundred years on the kerb in a minute, and he is the only one in Stillwater who knows.", "SW11 memory");
  setChoices("stillwater_crack_3", [
    row("\"Sit with him.\"", "", "He doesn't say anything for a long time. Then: \"One edition.\" He laughs, and it's an old man's laugh. \"Never needed a second.\""),
    BACK
  ], "SW11 rows");
  dropRequires("stillwater_crack_3", "SW11 meter gate dropped");

  // ---- SW12 crack_4 re-gated by the hub walk; the News requires it ----
  dropRequires("stillwater_crack_4", "SW12 meter gate dropped (reached from the hub walk)");
  setRequires("stillwater_choice", [ACT2, { beatMark: "stillwater_crack_4" }], "SW12 What You Do With the News requires The Wall Is Thinning");

  // ---- SW13 ladder: back rows on bandstand / permit / waving; permit re-gated; parade_permit meter retired ----
  addRow("stillwater_bandstand", row("Read the permit on the post.", "stillwater_permit", "", [{ beatMark: "stillwater_crack_3" }]), "SW13 bandstand → permit (once Amos has seen it, as the old ≥3 gate meant)");
  addRow("stillwater_bandstand", BACK, "SW13 bandstand back row");
  dropMeter("stillwater_bandstand", "stillwaterCrack", "SW13 bandstand meter retired");
  setRequires("stillwater_permit", [ACT2, { beatMark: "stillwater_crack_3" }], "SW13 permit gate: meter ≥3 → crack_3 played");
  addRow("stillwater_permit", row("Back to the bandstand", "stillwater_bandstand"), "SW13 permit back row");
  addRow("stillwater_waving", BACK, "SW13 waving back row");
  dropMeter("stillwater_waving", "stillwaterCrack", "SW13 waving meter retired");
  dropMeter("stillwater_parade_permit", "stillwaterCrack", "SW13 parade permit meter retired (receipt kept)");

  // ---- Act gate: Stillwater is Act 2. The doors/cracks/new beats were ungated (their only way in is the gated hub), which makes the
  //      campaign lint infer Act 0 for them and flag every "Back to the street" row (P07). Give each the hub's storyPhase ≥ 2 gate.
  for (const id of ["stillwater_lemonade", "stillwater_bandstand", "stillwater_paper", "stillwater_platform", "stillwater_waving", "stillwater_lemonade_fail", "stillwater_bandstand_fail",
                    "stillwater_permit", "stillwater_parade_permit", "stillwater_crack_1", "stillwater_crack_2", "stillwater_crack_3", "stillwater_crack_4", "stillwater_choice",
                    "sw_glass", "sw_outside", "sw_may", "sw_show"]) {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); continue; }
    b.inject = b.inject || {}; let rq = b.inject.requires; rq = rq == null ? [] : (Array.isArray(rq) ? rq : [rq]);
    if (rq.some(r => r && r.flag === "storyPhase")) { report.push(`· ok ${id}: act gate`); continue; }
    b.inject.requires = [ACT2, ...rq]; changes++; report.push(`✚ ${id}: storyPhase ≥ 2 act gate`);
  }

  console.log(`[grief stillwater 2026-10-21] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-grief-stillwater-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Grief Towns rework, Stillwater.`);
})();

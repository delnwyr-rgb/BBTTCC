/* patch-gullywasher-merge-2026-10-20.macro.js — ONE GULLYWASHER CONVERSATION (Dave, 2026-10-20 evening):
 *  "The second convo with Dougan, not about his name, but about the chupacabras and jackalopes, reads like an intro. And talks
 *   about the stabilizer. I would like to combine these two interactions. The second Dougan convo is still in old apophatic voice."
 *
 *   MERGE  fixit_gullywasher_welcome      gains the four questions (war? / peace / house protocol / the stabilizer — same checks, same
 *                                         fail routes) between "The third round" and "Back to the yard"; becomes REPEATABLE (it is the
 *                                         bar's one hub now); its opening uses the story tokens so a return visit reads "Gully is behind
 *                                         the bar, washing a glass that was already clean…" instead of the first-meeting intro
 *                                         (gated on the first round, drunk or refused — a beat's own played mark is set BEFORE its
 *                                         text renders, so it cannot gate on itself).
 *   RETIRE fixit_gullywasher_interior_convo  spliced out; everything that routed to it ("Ask something else" on the eight answers,
 *                                         "Back to the bar" on the two Confluence pointers, the fixit_farm script door) now routes to
 *                                         the welcome. The Dougan-pointer engine hook (module.js) listens on the welcome now.
 *   VOICE  the eight answer beats rewritten in Gully's register ("Oh, darling"), facts kept: encouraged hatreds and who profits;
 *          poetry Wednesdays, visibility; the tasting flight, the Gate's mood, "remembers something incorrectly"; custodians of an
 *          unfinished chapter, host something, the iron kind under a tarp in the Arc Bay, "you'll want both". Labels get names.
 *          "Leave" on each → "Back to the yard" (the town walk), like the rest of the bar.
 *
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
  const report = []; let changes = 0;
  const WELCOME = "fixit_gullywasher_welcome", OLD = "fixit_gullywasher_interior_convo", YARD = "fixit_town_walk";
  const ch = (label, next, description, extra = {}) => ({ label, next, description, checkStat: "", checkDC: 0, failNext: "", ...extra });

  /* 1 · the welcome is the bar ─────────────────────────────────────────────── */
  const w = byId.get(WELCOME);
  if (!w) return ui.notifications.error(`${WELCOME} not found.`);
  const INTRO = "There is a Chupacabra standing behind the bar, washing glasses. Oh shit — he's the bartender.\n\nThat was not on your post-apocalyptic 5D bingo card this morning.\n\nHe clocks your face doing the thing every new face does, grants it precisely two seconds of patience, and slides a glass down the bar with a flourish the glass did not strictly require. Something amber. Something carbonated, aggressively.\n\n“House rule, darlings,” he says. “The first one is on the Farm, as a gesture of optimism. The second one, you tell me where you're from. The third one, I tell you where I'M from, and you buy THAT round, because mine is a better story and I curate accordingly.”\n\nAround you: Jackalopes off shift, a teamster asleep sitting up with a full glass in hand (nobody touches it), ley sigils glowing in the tabletops, a chalkboard advertising poetry on Wednesdays, and a dartboard where the bullseye has been relabeled ANYWHERE. The Gullywasher, it turns out, is exactly what it looks like: the one room in the wasteland where everybody's from somewhere else, and the ambiance is curated to make certain you notice.";
  const RETURN = "Gully is behind the bar, washing a glass that was already clean, which is where Gully is. He raises one eyebrow by way of a menu.";
  const DESC = `{{#mark rc_gully_amber}}${RETURN}{{else}}{{#played rc_gully_soured}}${RETURN}{{else}}${INTRO}{{/played}}{{/mark}}`;
  if (w.description !== DESC) { w.description = DESC; changes++; report.push("✚ welcome: opening knows whether you have been here (first round drunk or refused → the eyebrow menu)"); }
  else report.push("· ok welcome: opening");
  w.inject = w.inject || {};
  if (w.inject.repeatable !== true) { w.inject.repeatable = true; changes++; report.push("✚ welcome: repeatable (the bar's hub)"); } else report.push("· ok welcome: repeatable");
  {
    const want = [
      ch("Chupacabras and Jackalopes — aren't you at war?", "fixit_gullywasher_choice_1", "\"Chupacabras have always been at war with Jackalopes.\" It is known. This is the way.\n\nHuh. That must have been a lie?", { checkStat: "inv", checkDC: 12, failNext: "fixit_gullywasher_choice_1_fail" }),
      ch("We come in peace", "fixit_gullywasher_choice_2", "\"We're not Jackalopes, we come in peace!\" But seriously haha what gives here?", { checkStat: "per", checkDC: 12, failNext: "fixit_gullywasher_choice_2_fail" }),
      ch("What's the house protocol?", "fixit_gullywasher_choice_3", "If we buy stuff can we also ask you questions? That's what being a bartender is all about, right?", { checkStat: "op.economy", checkDC: 14, failNext: "fixit_gullywasher_choice_3_fail" }),
      ch("We're here for the stabilizer. Know anything?", "fixit_gullywasher_choice_4", "We're the new folk from up the road a spell. Took over Allesh-Gilliam and the adjacents from the last Order contingent. We're trying to learn what we've gotten ourselves into.", { checkStat: "op.softpower", checkDC: 14, failNext: "fixit_gullywasher_choice_4_fail" })
    ];
    const cs = Array.isArray(w.choices) ? w.choices : (w.choices = []);
    const has = cs.some(c => c && c.next === "fixit_gullywasher_choice_1");
    if (has) report.push("· ok welcome: the four questions are on the menu");
    else {
      const yard = cs.findIndex(c => /back to the yard/i.test(String(c?.label || "")));
      if (yard >= 0) cs.splice(yard, 0, ...want); else cs.push(...want);
      changes++; report.push("✚ welcome: the four questions join the menu before Back to the yard");
    }
  }

  /* 2 · the eight answers, in his voice ────────────────────────────────────── */
  const ANSWERS = {
    fixit_gullywasher_choice_1: ["Furrier's Fixit Farm — The Gullywasher, Encouraged",
      "Gully pauses mid-polish, which for Gully is a full stop.\n\n“Oh, you're reading from the old script, darling. Claws, horns, blood on the scrub. Very operatic. Very marketable.” He sets the glass down the way you'd set down a thing you are done pretending to need. “Here is the trouble with a feud that sells tickets: somebody has to keep staging it. I have tasted Jackalope wine. It is mediocre and it is earnest, and nobody goes to war over earnest. We were not enemies. We were encouraged.”\n\nHe smiles, sharp but not unkind. “If you want a hobby while you're here, ask who profits from an inherited hatred. The answer is never the people doing the hating.”"],
    fixit_gullywasher_choice_1_fail: ["Furrier's Fixit Farm — The Gullywasher, Not Under My Roof",
      "Gully laughs, musically, and not quite at you.\n\n“Oh, darling. If we were truly at war, you would not be drinking under my roof. You would be the roof.” He gestures at the ley sigils glowing in the tabletops. “War leaves scars. Culture leaves seating arrangements.”\n\nThen, lightly: “If you intend to interrogate me, at least order something first. The rosemary radish gin is a conversation all on its own.”"],
    fixit_gullywasher_choice_2: ["Furrier's Fixit Farm — The Gullywasher, Scandalous",
      "Gully clasps his hands like a man receiving a gift he intends to re-wrap.\n\n“Peace? In this town? How scandalous. Don't say it too loudly, somebody will want to charge for it.” He comes round the bar and straightens one of your collars without asking, which is the most Chupacabra thing that has happened to you so far. “Most people walk in here to confirm a story. You walked in hoping to revise one. I host poetry on Wednesdays, cross-species attendance encouraged, and if you truly come in peace you'll stay long enough to be SEEN doing it.”\n\nHe lowers his voice. “Visibility, darling, is the first ingredient of diplomacy. The second is a tab.”"],
    fixit_gullywasher_choice_2_fail: ["Furrier's Fixit Farm — The Gullywasher, Like a Defendant",
      "Gully studies you for a long moment, the way he'd study a glass somebody swore was clean.\n\n“My dear. If you announce peace before anyone has accused you of anything, you sound like a defendant.” He pours you something anyway, because the house rule is the house rule. “Relax. No one here intends to eat you. Not today, and not on a Wednesday. Wednesdays are poetry.”"],
    fixit_gullywasher_choice_3: ["Furrier's Fixit Farm — The Gullywasher, The Transaction of Atmosphere",
      "Gully's eyes light up like a till.\n\n“A patron who understands the transaction of atmosphere. Sit down, you beautiful thing.” He taps the chalkboard, where under POETRY WEDS somebody has written TASTING FLIGHT · THREE QUESTIONS. “The flight buys you three. The first is free, as a gesture of optimism, and you have just spent it, so listen.”\n\nHe slides a small glass across. “House protocol is simple: we live by the Gate's mood, and the Gate's mood has been… unsettled. It remembers something incorrectly. Everyone in this bar can feel it, and everyone in this bar is drinking about it instead of saying so. Hence the ambiance.”"],
    fixit_gullywasher_choice_3_fail: ["Furrier's Fixit Farm — The Gullywasher, I Curate Ambiance",
      "Gully narrows his eyes, theatrically, so that you know it is theatre.\n\n“I do not sell gossip, darling. I curate ambiance.” A beat, and then the eyebrow. “Ambiance does include rumours. Rumours do occasionally fall into glasses.”\n\nHe pours you something cheap and pushes it across. “You may begin. Slowly. I'm working.”"],
    fixit_gullywasher_choice_4: ["Furrier's Fixit Farm — The Gullywasher, You'll Want Both",
      "Gully lets you finish, which is its own kind of compliment. When you're done he nods, once, slowly.\n\n“So. Not conquerors. Custodians of an unfinished chapter.” He adjusts his cufflinks, which you had not noticed until he wanted you to. “This saloon exists because I believe even myths deserve a revision. A stabilizer, you said. Ambitious. Culture anchors a flow as well as iron does, darling, so host something. Invite somebody who should not feel welcome, and watch what the room does.”\n\nHe polishes the glass once more, decisively. “The iron kind is in the Arc Bay. Gearbox has it under a tarp and Mara has it under a price. I sell the other kind.” He sets the glass down exactly on its ring mark. “You'll want both.”"],
    fixit_gullywasher_choice_4_fail: ["Furrier's Fixit Farm — The Gullywasher, Slower",
      "Gully raises one brow to a height that would be rude on anyone else.\n\n“You have taken over a territory, and your first instinct is to announce it in a bar.” He sighs, dramatically, for the room's benefit. “Power without elegance is merely noise, darling, and noise I have plenty of.”\n\nHe hands you a menu. “Try again. Slower. Order something while you think.”"]
  };
  for (const [id, [label, desc]] of Object.entries(ANSWERS)) {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); continue; }
    let n = 0;
    if (b.description !== desc) { b.description = desc; n++; }
    if (b.label !== label) { b.label = label; n++; }
    const want = [ch("Ask something else", WELCOME, ""), ch("Back to the yard", YARD, "")];
    if (JSON.stringify(b.choices || []) !== JSON.stringify(want)) { b.choices = want; n++; }
    if (n) { changes += n; report.push(`✚ ${id}: ${label.split("— ")[1]} — voice${n > 1 ? ", routes" : ""}`); } else report.push(`· ok ${id}`);
  }

  /* 3 · everything else that pointed at the old hub ─────────────────────────── */
  for (const id of ["gullywasher_dougan_points_to_confluence", "gullywasher_gully_points_to_confluence"]) {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); continue; }
    let n = 0; for (const c of (b.choices || [])) { if (c?.next === OLD) { c.next = WELCOME; n++; } if (c?.failNext === OLD) { c.failNext = WELCOME; n++; } }
    if (n) { changes++; report.push(`✚ ${id}: Back to the bar → the welcome`); } else report.push(`· ok ${id}`);
  }
  {
    const sc = camp.story?.scripts?.fixit_farm; const d = sc && (sc.doors || []).find(x => x.id === "gullywasher");
    if (!d) report.push("⚠ fixit_farm script door 'gullywasher' not found");
    else if (!(d.beats || []).includes(OLD)) report.push("· ok script door");
    else { d.beats = d.beats.filter(x => x !== OLD); changes++; report.push("✚ fixit_farm script door: the old hub is off the door"); }
  }
  {
    const i = camp.beats.findIndex(b => b.id === OLD);
    if (i < 0) report.push(`· ok ${OLD}: already gone`);
    else { camp.beats.splice(i, 1); byId.delete(OLD); changes++; report.push(`✚ ${OLD} RETIRED (spliced out)`); }
    const left = camp.beats.filter(b => (b.choices || []).some(c => c?.next === OLD || c?.failNext === OLD)).map(b => b.id);
    if (left.length) report.push(`⚠ still routing to the old hub: ${left.join(", ")}`);
  }

  console.log(`[gullywasher-merge 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-gullywasher-merge-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — one Gullywasher.`);
})();

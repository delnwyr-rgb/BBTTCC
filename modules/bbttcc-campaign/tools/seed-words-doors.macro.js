/* seed-words-doors.macro.js — WORDS-DOORS on the travel encounter families
 * (2026-08-27, owner ruling: "words are a victory condition" — every agented
 * encounter gets a parley/commune choice so a conversation always has a
 * mechanical exit ramp).
 *
 * Design doctrine (this session):
 *  · The mechanical interfaces resolve POWER; conversation discovers LEVERAGE.
 *  · The door is a CHOICE on the family's intro beat: checked, priced, and
 *    routed — success → talked-down outcome beat (fires no battle scenario;
 *    engine change 2026-08-27 skips the launch on a routed successful check),
 *    failure → collapse beat, then the menu re-offers (retry engine, same day).
 *  · Check lanes are chosen deliberately:
 *      human crews  → op.softpower / op.diplomacy (the faction's voice)
 *      beasts       → empathy (be read as not-prey, not-threat)
 *      qliphothic   → the ESOTERIC SHELF, gating something at last:
 *                     meditation · insight · occult · ritual
 *      the dragon   → op.faith (reverence, offered at faction scale)
 *  · Bandit door success routes into the EXISTING enc_bandit_ambush_win
 *    disposition menu (kill/jail/free) so the mercy ledger counts talk-downs.
 *
 * Idempotent (skips doors already present + existing beats); DRY_RUN default
 * true; backs up the campaigns setting before writing. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  // Outcome-beat scaffold (family idiom: outcome_trigger, leg-scale, player-facing)
  const outcome = (id, label, description, { memoryText = null, continueLabel = "Continue" } = {}) => ({
    id, label,
    type: "outcome_trigger",
    timeScale: "leg", timePoints: 0,
    tags: "travel words_door",
    politicalTags: "",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: true, oncePerHex: false,
              promptGM: "inherit", fallbackOnDecline: "inherit",
              allowMulti: "inherit", oncePerHexGlobal: "inherit" },
    actors: [], refs: {},
    choices: [{ label: continueLabel, next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    description,
    ...(memoryText ? { memoryText } : {}),
    playerFacing: true
  });

  // ── the ten doors ──────────────────────────────────────────────────────────
  // { intro, door: {label, description, checkStat, checkDC, next, failNext},
  //   success: outcome beat or null (bandit reuses the _win disposition menu),
  //   fail: outcome beat }
  const DOORS = [
    {
      family: "Bandit Ambush",
      intro: "enc_bandit_ambush",
      door: {
        label: "Words before weapons — hail the towers",
        description: "Somebody out there already blew their cover and everybody heard it. Talk to the panic, not the spears. (The faction's reputation does the heavy lifting here.)",
        checkStat: "op.softpower", checkDC: 12,
        next: "enc_bandit_ambush_win",
        failNext: "enc_bandit_ambush_parley_fail"
      },
      success: null, // routes into the existing disposition menu (kill/jail/free → mercy ledger)
      fail: outcome("enc_bandit_ambush_parley_fail", "Bandit Ambush — Talks Collapse",
        "You hail the glowing towers with your best road manners, and for one whole second there is a silence that might be listening. Then somebody's nerve goes — a bolt skips off the tarmac a foot from your wheel, and the silence is OVER. They're more scared of whoever sent them than of you. That's a solvable problem. Just not with your mouth, and not today.",
        { continueLabel: "So be it" })
    },
    {
      family: "Raider Raze Team",
      intro: "enc_raider_raze_team",
      door: {
        label: "Talk contracts — whose money is this?",
        description: "A raze team isn't angry, it's EMPLOYED. Employment is negotiable. Find the foreman, talk terms, and find out who's paying for this route to burn.",
        checkStat: "op.diplomacy", checkDC: 16,
        next: "enc_raider_raze_team_parley_success",
        failNext: "enc_raider_raze_team_parley_fail"
      },
      success: outcome("enc_raider_raze_team_parley_success", "Raze Team — The Contract Bends",
        "The torches idle down, professional to the last. The foreman meets you halfway on the cracked centerline, listens, and does foreman arithmetic out loud: the job was PAID, and nobody un-pays a job — but the contract says raze the ROUTE, it doesn't say WHEN. They'll be back in some other season, or they won't. As they roll out, you're left holding the more interesting prize: somebody with real money wanted this road gone, and now you know it. That name is a conversation waiting to happen.",
        { memoryText: "The raze team stood down — bought clock, not loyalty. Someone paid for this route to burn, and the party knows it now." }),
      fail: outcome("enc_raider_raze_team_parley_fail", "Raze Team — The Cancellation Clause",
        "The foreman hears you out — genuinely hears you out, nodding along, torch idling at parade rest — and then, politely, quotes you the cancellation clause. There isn't one. There is, however, a completion bonus. The torches come back up on the same breath.",
        { continueLabel: "So be it" })
    },
    {
      family: "Mutant Wildlife (Tier 2)",
      intro: "enc_mutant_wildlife_t2",
      door: {
        label: "No threat, no prey — let them read you",
        description: "Everything out here reads intent before it reads anything else. Stand easy, keep your hands soft, and let the pack take your measure. (Roster member rolls Empathy.)",
        checkStat: "empathy", checkDC: 12, checkMode: "auto",
        next: "enc_mutant_wildlife_t2_parley_success",
        failNext: "enc_mutant_wildlife_t2_parley_fail"
      },
      success: outcome("enc_mutant_wildlife_t2_parley_success", "Wildlife — Read and Released",
        "The pack circles once, twice — and then the big one huffs something that is almost, but not quite, contempt, and the whole formation loses interest in you at the exact same moment, the way a crowd does. You were legible. Not food, not rival, not threat. Out here that's the entire social contract, and you just signed it correctly.",
        { memoryText: "The party talked a mutant pack down without a shot — read as no-threat and let through." }),
      fail: outcome("enc_mutant_wildlife_t2_parley_fail", "Wildlife — Wrong Smell",
        "You do everything right. Soft hands, easy stance, no eye contact with the big one. And the pack reads you anyway and finds something it doesn't like — the rig, the road-dust, the faint wrong note under your calm. The ears go BACK. So much for diplomacy.",
        { continueLabel: "So be it" })
    },
    {
      family: "Mutant Wildlife (Tier 3)",
      intro: "enc_mutant_wildlife_t3",
      door: {
        label: "No threat, no prey — let them read you",
        description: "These ones are older, smarter, and much less inclined to guess. Being legible to something this dangerous is a real skill. (Roster member rolls Empathy.)",
        checkStat: "empathy", checkDC: 17, checkMode: "auto",
        next: "enc_mutant_wildlife_t3_parley_success",
        failNext: "enc_mutant_wildlife_t3_parley_fail"
      },
      success: outcome("enc_mutant_wildlife_t3_parley_success", "Wildlife — An Understanding",
        "It takes longer this time, because they're smarter, and smart things double-check. But the read completes: you are a large, strange, well-armed NOTHING, headed elsewhere, worth neither the calories nor the casualties. The pack peels off with the unhurried confidence of something that has never once needed to run, and lets you keep the road.",
        { memoryText: "The party was read and released by an apex-adjacent pack — legible as no-threat at close range." }),
      fail: outcome("enc_mutant_wildlife_t3_parley_fail", "Wildlife — Double-Checked",
        "They read you. They understood you. That's the problem — they understood the rig is full of protein and the confidence is mostly posture. Smart is not the same as merciful.",
        { continueLabel: "So be it" })
    },
    {
      family: "Apex Predator",
      intro: "enc_apex_predator",
      door: {
        label: "Stand tall — be a thing it shouldn't eat",
        description: "You don't outfight a legend and you certainly don't out-sneak one. But apex things obey the wasteland's oldest treaty: cost. Look expensive. (Roster member rolls Intimidation.)",
        checkStat: "intimidation", checkDC: 20, checkMode: "auto",
        next: "enc_apex_predator_parley_success",
        failNext: "enc_apex_predator_parley_fail"
      },
      success: outcome("enc_apex_predator_parley_success", "Apex — The Oldest Treaty",
        "It looks at you for a long, geological moment — and you look BACK, and you do not blink, and something in the set of your crew's shoulders finishes the sentence for you: this meal fights. The apex does the only math its kind has ever respected — calories against scar tissue — and grants you the road with a slow turn of its head that is almost, insultingly, a courtesy. You will tell this story forever. You will leave out how your knees felt.",
        { memoryText: "The party stared down an apex predator and was granted passage under the wasteland's oldest treaty: too expensive to eat." }),
      fail: outcome("enc_apex_predator_parley_fail", "Apex — Curiosity",
        "You stand tall. You look expensive. And the apex tilts its head with what you slowly realize is not respect but CURIOSITY — it has simply never eaten anything this confident before, and it wonders if you taste different. Science proceeds.",
        { continueLabel: "So be it" })
    },
    {
      family: "Qlipothic Shambler",
      intro: "enc_qlipothic_shambler",
      door: {
        label: "Be still — address the hollow of it",
        description: "It isn't hungry, it's EMPTY, and it moves toward noise the way water moves downhill. Stillness is a language. Speak it. (Roster member rolls Meditation.)",
        checkStat: "meditation", checkDC: 14, checkMode: "auto",
        next: "enc_qlipothic_shambler_parley_success",
        failNext: "enc_qlipothic_shambler_parley_fail"
      },
      success: outcome("enc_qlipothic_shambler_parley_success", "Shambler — Stillness Answered",
        "You stop. All of you, all the way down — breath, thought, the little engine of wanting that never quite idles. And the shambler slows, and wavers, and aligns with your stillness like a struck string finding the note next to it. For a held minute there are two silences on the road, and then there is one, and then there is only the road. It didn't leave. It just stopped being able to tell you apart from the quiet.",
        { memoryText: "The party stilled themselves so completely a qlipothic shambler lost them in the quiet and passed through." }),
      fail: outcome("enc_qlipothic_shambler_parley_fail", "Shambler — Cracks in the Quiet",
        "You reach for stillness and ALMOST have it — but almost is a crack, and empty things are patient about cracks. It pours toward the flutter of your held breath like it's been invited. In fairness: it was.",
        { continueLabel: "So be it" })
    },
    {
      family: "Slippage Wraith",
      intro: "enc_slippage_wraith",
      door: {
        label: "Feel for what it lost — and say so",
        description: "A wraith is a grief that outlived its owner. It doesn't want your integrity, it wants to be UNDERSTOOD, and nothing out here has managed it yet. (Roster member rolls Insight.)",
        checkStat: "insight", checkDC: 16, checkMode: "auto",
        next: "enc_slippage_wraith_parley_success",
        failNext: "enc_slippage_wraith_parley_fail"
      },
      success: outcome("enc_slippage_wraith_parley_success", "Wraith — Named and Quieted",
        "You open yourself the width of a keyhole and FEEL for it — and there it is, under the static and the slippage: the shape of the thing it lost. You say it out loud. Simply, without flinching, the way you'd tell a stranger their coat is on fire. The wraith goes still. The air stops sliding. And then it folds itself away like a letter finally read, and the road remembers how to be a road. Somewhere behind your sternum, something you didn't lose aches anyway.",
        { memoryText: "The party understood what the slippage wraith had lost and said so — it folded away like a letter finally read." }),
      fail: outcome("enc_slippage_wraith_parley_fail", "Wraith — Almost Right",
        "You feel for its grief and you get CLOSE — close enough to name the wrong loss with total confidence. There is no anger in the universe quite like being almost understood. The temperature drops. The slippage sharpens. You've made it worse, which, for the record, took empathy. Just not enough.",
        { continueLabel: "So be it" })
    },
    {
      family: "Geometry Serpent",
      intro: "enc_geometry_serpent",
      door: {
        label: "Speak to the angles — in the only grammar it knows",
        description: "It isn't blocking the road. It IS the road, conjugated wrong. Address it in its own grammar — proofs, symmetries, the manners of mathematics. (Roster member rolls Occult.)",
        checkStat: "occult", checkDC: 17, checkMode: "auto",
        next: "enc_geometry_serpent_parley_success",
        failNext: "enc_geometry_serpent_parley_fail"
      },
      success: outcome("enc_geometry_serpent_parley_success", "Serpent — A Polite Proof",
        "You sketch the courtesy in the dust — an old symmetry, offered the way you'd offer a handshake — and the serpent READS it, and something vast and orthogonal is pleased. It rewrites itself around you with the exaggerated care of a scholar stepping over a colleague's notes: the road unbends, the angles apologize, and for a hundred yards behind you the tarmac is briefly, perfectly, insufferably Euclidean.",
        { memoryText: "The party addressed the geometry serpent in its own grammar and was politely rewritten around — safe passage as a courtesy between colleagues." }),
      fail: outcome("enc_geometry_serpent_parley_fail", "Serpent — Declined With Prejudice",
        "You offer the proof. It checks your work. Somewhere in the third symmetry you conjugated something WRONG — and being addressed badly in its own grammar is, to a geometry serpent, roughly what a slap is to everyone else. The angles come up sharp.",
        { continueLabel: "So be it" })
    },
    {
      family: "Qliphotic Whorl",
      intro: "enc_qliphotic_whorl",
      door: {
        label: "Formal address — hail the pattern with rite",
        description: "It predates language, but it does not predate PROTOCOL. A rite is a knock on a very old door. Knock correctly. (Roster member rolls Ritual.)",
        checkStat: "ritual", checkDC: 20, checkMode: "auto",
        next: "enc_qliphotic_whorl_parley_success",
        failNext: "enc_qliphotic_whorl_parley_fail"
      },
      success: outcome("enc_qliphotic_whorl_parley_success", "Whorl — Protocol Observed",
        "You perform the rite with your whole chest — every syllable in its slot, every gesture squared — and the whorl SLOWS, the way vast bureaucracies slow when handed a correctly filled form. A lane opens through the pattern, precise as a corridor, exactly one rig wide. You are not forgiven and you are not welcomed. You are PROCESSED. Take it. From a thing like this, processed is a love language.",
        { memoryText: "The party hailed the qliphotic whorl with correct rite and was processed through — a one-rig lane through the pattern." }),
      fail: outcome("enc_qliphotic_whorl_parley_fail", "Whorl — The Rite Half-Held",
        "The rite is ALMOST right, and almost right is worse than silence: a half-completed protocol reads, to the pattern, as an invitation to complete it. It reaches out to finish the ceremony with you inside it.",
        { continueLabel: "So be it" })
    },
    {
      family: "Desenitarius Maarg",
      intro: "enc_desenitarius_maarg",
      door: {
        label: "The old courtesies — reverence, offered at scale",
        description: "You do not fight this. You barely SURVIVE this. But dragons remember when the world had manners, and a whole faction's faith, spent in one held breath, is the only coin old enough to matter.",
        checkStat: "op.faith", checkDC: 20,
        next: "enc_desenitarius_maarg_parley_success",
        failNext: "enc_desenitarius_maarg_parley_fail"
      },
      success: outcome("enc_desenitarius_maarg_parley_success", "Maarg — Myth Acknowledges Myth",
        "You give it the old courtesies — all of them, the whole faction's reverence spent in one held breath, every head bowed at once along the column — and Desenitarius Maarg PAUSES. Regards you the way a cathedral might regard a candle: small, correct, briefly interesting. Then the sky-heavy shape moves off along its own inscrutable errand, and the road is merely a road again. Understand what happened here. You were not spared. You were ACKNOWLEDGED. Myth nodded at myth, and today the toll was manners.",
        { memoryText: "The faction offered Desenitarius Maarg the old courtesies at full scale and was acknowledged — passage granted, toll paid in reverence." }),
      fail: outcome("enc_desenitarius_maarg_parley_fail", "Maarg — The Candle Gutters",
        "The courtesies were correct. The reverence was real. And the dragon simply does not care today — the way weather doesn't, the way mountains don't. Some tolls aren't payable in manners.",
        { continueLabel: "So be it" })
    }
  ];

  // ── apply ──────────────────────────────────────────────────────────────────
  for (const d of DOORS) {
    const intro = byId.get(d.intro);
    if (!intro) { report.push(`⚠ ${d.family}: intro beat '${d.intro}' NOT FOUND — skipped (author it first)`); continue; }

    intro.choices = Array.isArray(intro.choices) ? intro.choices : [];
    const already = intro.choices.some(c =>
      String(c?.next || "") === d.door.next || String(c?.failNext || "") === d.door.failNext);

    // Outcome beats first (so a wired door never dangles)
    for (const ob of [d.success, d.fail].filter(Boolean)) {
      if (byId.get(ob.id)) { report.push(`· ok beat (already) ${ob.id}`); continue; }
      camp.beats.push(ob); byId.set(ob.id, ob);
      changes++; report.push(`✚ beat: ${ob.id}`);
    }

    if (already) { report.push(`· ok door (already) on ${d.intro}`); continue; }

    // Sanity: bandit door routes into the existing disposition menu
    if (!byId.get(d.door.next)) { report.push(`⚠ ${d.family}: success target '${d.door.next}' missing — door NOT wired`); continue; }

    intro.choices.push({
      label: d.door.label,
      next: d.door.next,
      description: d.door.description,
      checkStat: d.door.checkStat,
      checkDC: d.door.checkDC,
      failNext: d.door.failNext,
      ...(d.door.checkMode ? { checkMode: d.door.checkMode } : {})
    });
    changes++; report.push(`✚ door on ${d.intro}: "${d.door.label}" (${d.door.checkStat} DC ${d.door.checkDC})`);
  }

  // ── report + write ─────────────────────────────────────────────────────────
  console.log(`[seed-words-doors] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` +
    report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Words-doors DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Words-doors: nothing to do — already seeded.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
      `backup-campaigns-before-words-doors-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Words-doors APPLIED: ${changes} change(s). Every road now has a door made of words.`);
})();

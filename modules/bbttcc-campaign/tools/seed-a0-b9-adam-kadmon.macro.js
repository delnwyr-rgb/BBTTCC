/* seed-a0-b9-adam-kadmon.macro.js — Act 0 beat A0-B9 "Guess What" (2026-09-07)
 *
 * Inserts the Adam Kadmon welcome between "Wake up" (fates_and_destinies_incarnate,
 * step 70) and "Teaching Slide 1" (fates_and_destinies_1, step 80): step 75, same
 * shape as its siblings (player-facing dialog, storyPhase ≥ 0, repeatable, VO track
 * on the beat's audio). The recorded take lives at
 *   art/bbttcc/GOTTGAIT/Tunes/Mal Voice Acting/bbttcc_gottgait_voice_track_fates_destinies_adam_kadmon.mp3
 * (present local + both live, 2026-09-07).
 *
 * This beat becomes the onboarding WAKE beat: when it resolves, bbttcc-onboarding
 * posts the "Report for training" card, blasts the theme (Section D) to every
 * client, and the players drop into the Incarnation beat → Proving Ground. The
 * macro sets bbttcc-onboarding.campaignWakeBeatId accordingly (was the Wake-up
 * beat itself).
 *
 * DRY_RUN default true. Idempotent (skips if the beat exists). Backs up `campaigns`.
 */
(async () => {
  const DRY_RUN = false;                       // <-- set false to apply
  const NS = "bbttcc-campaign", ONB = "bbttcc-onboarding";
  const ID = "fates_and_destinies_adam_kadmon", AFTER = "fates_and_destinies_incarnate";
  const VO = "art/bbttcc/GOTTGAIT/Tunes/Mal%20Voice%20Acting/bbttcc_gottgait_voice_track_fates_destinies_adam_kadmon.mp3";
  const d = (s) => `<p><i>${s}</i></p>`, p = (s) => `<p>${s}</p>`;
  const DESCRIPTION = [
    d("Whistling Smurf’s theme song"),
    p("Oh, hey, there you are! Welcome! Very nice to see you again. I expect you just experienced a few words from Mal. Hope you don’t mind that they are experimenting with some new phrases."),
    p("Speaking of, let’s get you grounded! I have a … prepared … just a, oh yes …"),
    d("clears throat, majestic voice"),
    p("Do not freak out. This is all perfectly normal. You have done this all before."),
    p("You are an enlightened being. A bodhisattva. A saint. You played the game all the way through on Hell Mode and got a perfect score. You did a nuzlocke run on life. You are a story that was told perfectly — so perfectly, in fact, that you have now become load bearing."),
    p("Your help is now asked for again."),
    p("To save a universe."),
    p("And so, Champions, the time has come to …"),
    p("Hmmm?"),
    p("Yes, you should be able to see. You can hear and feel, why wouldn’t you …"),
    p("Hmm. Yes yes we’ll get you bodies and mouths and feet and things soon. It’s a … whole production … look, can you sit tight for … I will be right back!"),
    d("Dial-up modem sound"),
    p("Hello! Yes! They are … here … but something is weird. They can’t see. Normally at this incarnation point …"),
    p("Hmmm? What do you mean, they need to have their token vision turned on?"),
    p("Ummm. Why would I need to check scene settings …"),
    p("Wait. NO. This was NOT the plan. Multimedia approach, yes — I thought we had, like, a Cinematic Universe set up. We were gonna get Morrison to direct."),
    p("What do you MEAN no one can even pronounce Gnosticism? I had thought … Yes I know the second and third movies were canonically terrible. And I wasn’t ACTUALLY serious about Manichaeism …"),
    p("Fine, is it like a video game?"),
    p("uhhh"),
    p("What. Is a Vitterpig?"),
    p("Oh SHIT. I hear theme music starting. I gotta go."),
    p("No, no, I got it, thank you Dr Hoeller."),
    p("Hey y’all. Guess WHAT???")
  ].join("\n");

  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign; const cid = api?.getActiveCampaignId?.();
  let raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : foundry.utils.deepClone(raw);
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error("No active campaign.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const changes = [];
  if (beats.some(b => b?.id === ID)) changes.push(`beat ${ID} already present — skipped`);
  else {
    const i = beats.findIndex(b => b?.id === AFTER);
    const tpl = beats[i];
    if (!tpl) return ui.notifications.error(`Anchor beat ${AFTER} not found.`);
    const beat = foundry.utils.deepClone(tpl);
    Object.assign(beat, {
      id: ID, label: "Offices of Fates and Destinies, Guess What (A0-B9)", type: "dialog",
      questStep: 75, questRole: null, choices: [], next: undefined,
      description: DESCRIPTION,
      audio: { enabled: true, src: VO, volume: 0.85, loop: false, autoplay: false, broadcastPlayers: true },
      worldEffects: { ...tpl.worldEffects, questEffects: [], factionEffects: [] },
      timePoints: 0, sceneId: null
    });
    delete beat.next;
    beats.splice(i + 1, 0, beat);
    if (!Array.isArray(camp.beats)) camp.beats = beats;
    changes.push(`inserted ${ID} after ${AFTER} at questStep 75 (VO: ${VO})`);
  }
  let wakeNow = null; try { wakeNow = game.settings.get(ONB, "campaignWakeBeatId"); } catch (_) {}
  if (wakeNow !== ID) changes.push(`bbttcc-onboarding.campaignWakeBeatId: "${wakeNow}" → "${ID}"`);
  console.group(`[A0-B9] ${DRY_RUN ? "DRY RUN — " : ""}${changes.length} change(s)`); changes.forEach(c => console.log(" •", c)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`A0-B9 DRY RUN: ${changes.length} change(s) in console. Set DRY_RUN=false to apply.`);
  (foundry.utils.saveDataToFile || saveDataToFile)(JSON.stringify(wasStr ? JSON.parse(raw) : raw), "application/json", `backup-campaigns-before-a0b9-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  if (wakeNow !== ID) { try { await game.settings.set(ONB, "campaignWakeBeatId", ID); } catch (e) { console.warn("[A0-B9] could not set wake beat", e); } }
  ChatMessage.create({ whisper: [game.user.id], content: `<b>A0-B9 “Guess What” seeded.</b><ul style="font-size:12px">${changes.map(c => `<li>${c}</li>`).join("")}</ul><p>Run <code>fates_and_destinies_incarnate</code> → <code>${ID}</code>; when it resolves, onboarding wakes with the theme.</p>` });
  ui.notifications.info("A0-B9 seeded. Backup downloaded.");
})();

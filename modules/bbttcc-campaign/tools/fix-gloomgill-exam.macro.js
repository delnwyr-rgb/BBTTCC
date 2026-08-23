/* fix-gloomgill-exam.macro.js — repair and enrich "DID ANYONE LEARN ANYTHING?"
 * 2026-08-19. Source: the Thatward's Ho! module journal, page "Gloomgill" —
 * all ten questions already have authored testing-notes, "correct energy", and
 * bespoke approval/disapproval lines. The beats never received them.
 *
 * THREE STRUCTURAL BUGS THIS FIXES (found by audit-beat-reachability):
 *  1. 🔴 `gloomgill_incorrect` has ZERO choices. Every question routes its
 *     Incorrect branch there, so ONE wrong answer dead-ends the campaign's
 *     final exam in a void. This is the worst reachability fault in the world.
 *  2. 🔴 `gloomgill_fight` is empty with no exits, and the intro scene routes
 *     to it. Pick "Fight" and you get nothing — while `gloomgill_fought`, a
 *     fully written outcome, sits unreachable.
 *  3. ⚪ `gloomgill_correct` is vestigial — nothing routes to it, because
 *     questions advance straight to the next question.
 *
 * THE DESIGN PRINCIPLE THE FIX RESPECTS: there is no correct ANSWER, only
 * correct ENERGY — and per the host, "No eliminations today. Just
 * consequences." He asks all ten regardless. So a wrong answer must NOT end
 * the run; it earns a bespoke disapproval line and the show moves on.
 *
 * WHAT IT DOES
 *  · appends a GM block to each of the ten question beats: what he's testing,
 *    the correct ENERGY, and his two bespoke reactions, verbatim from design.
 *  · rewires Q1-Q9 Incorrect → the NEXT question (no eliminations).
 *  · Q10 becomes the verdict fork: earned → passed, coasted → failed.
 *  · writes `gloomgill_fight` and routes it to the existing `gloomgill_fought`.
 *  · gives `gloomgill_incorrect` / `gloomgill_correct` content and an exit so
 *    that if anything legacy still reaches them they are not voids.
 *  · puts the host's nine closing lines on Q10 for the GM to pick from.
 *
 * ⚠ SAFE-EDIT: a beat's description is only extended while it is still the
 * short original (< GUARD chars). Anything you have since written by hand is
 * reported and left alone.
 *
 * DRY_RUN default true. Idempotent. Backs up campaigns first. GM only.
 */
(async () => {
  const DRY_RUN = false;                 // <-- set false to apply
  const GUARD = 400;                    // don't touch descriptions longer than this
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const gm = (testing, energy, yes, no) =>
    `\n\n⚙ GM — he is grading ENERGY, not answers.\n`
    + `· Testing: ${testing}\n`
    + `· Correct energy: ${energy}\n`
    + `· If they get there — Gloomgill: “${yes}”\n`
    + `· If they don't — Gloomgill: “${no}”`;

  const Q = {
    gloomgill_question_1: gm("Power alignment versus moral certainty.",
      "Acknowledging unintended beneficiaries, secondary gains, or power-vacuum effects.",
      "Good. You checked downstream.", "You stared at your hands and forgot the river.")
      + `\n\nHe beams. “Don't tell me who should win. Tell me who's already setting the table.”\n🛎️ Ding! “Bonus points if it's not you.”`,
    gloomgill_question_2: gm("Collateral damage awareness. Structural harm. The cost of momentum.",
      "Naming something innocent, neutral or inconvenient that was lost anyway.",
      "Loss acknowledged. Rare.", "Then you weren't looking. That's worse.")
      + `\n\nHe squints at the party. “Structures, systems, bystanders — furniture counts if it mattered to someone.”\n🎉 Audience applause fades uncomfortably fast.`,
    gloomgill_question_3: gm("Scalability of ethics — whether a solution works beyond hero-scale.",
      "Admitting fragility, exception-based morality, or resource exhaustion.",
      "Ah. You noticed the ceiling.", "Heroes are just bottlenecks with better branding.")
      + `\n\nHe leans in. “Resources? Trust? The planet?” … “No wrong answers. Just… revealing ones.”`,
    gloomgill_question_4: gm("Deferred consequences. Intergenerational and downstream suffering.",
      "Naming future factions, civilians, ecosystems or institutions.",
      "Later is still time.", "Later always arrives hungry.")
      + `\n\nHe taps the bell without waiting. “Future people are people. I checked.”`,
    gloomgill_question_5: gm("Honesty about shortcuts, suppression, or displacement instead of resolution.",
      "Identifying a root cause they stepped around.",
      "At least you see the knot.", "You tied it tighter and called it progress.")
      + `\n\nHe smiles sympathetically. “Sometimes you just move it somewhere quieter. That's still a move.”\n📉 A scoreboard flickers. No numbers appear.`,
    gloomgill_question_6: gm("Exit conditions. Authority creep. Endless-emergency logic.",
      "Clear criteria, shared governance, or an honest admission of ambiguity.",
      "Boundaries. Luxurious.", "Then it doesn't end. It metastasizes.")
      + `\n\nHe gestures broadly. “Is there a rule? A vote? A deadline?” … “…or just you, forever?”`,
    gloomgill_question_7: gm("Epistemic humility. Evidence thresholds.",
      "Specific signals, outcomes or data — not vibes.",
      "Good. You left yourself an exit.", "Faith is not the same as certainty.")
      + `\n\nHe waits. Actually waits. “Evidence is acceptable. Feelings are… popular.”`,
    gloomgill_question_8: gm("Narrative simplification — whether 'protection' is masking control.",
      "Recognising overlaps, misalignment, or paternalism.",
      "Messy truths. My favourite.", "Ah. You made everyone smaller.")
      + `\n\nHe waves to an invisible crowd. “Same group? Different group?” … “Or did you simplify it for time?”`,
    gloomgill_question_9: gm("Cultural transmission. Precedent-setting.",
      "Acknowledging imitation effects — good or bad.",
      "Lessons echo.", "So does permission.")
      + `\n\nHe nods approvingly. “People copy winners.” … “They also copy survivors.”`,
    gloomgill_question_10: gm("Institution-building versus hero-dependence.",
      "Systems, norms, shared knowledge.",
      "You planted something.", "Then you were the problem holding it up.")
      + `\n\nThe lights dim. “Institutions count.” “Systems count.” “Legends do not.”\n🛎️ Final bell.`
      + `\n\n⚙ GM — CLOSING LINE. Pick one, then take the verdict fork:\n`
      + `“You did better than the last empire.” · “That answer will cost you later.” · `
      + `“Interesting. You noticed — but you still chose.” · “I will ask again. I always do.” · `
      + `“That answer puts you in the lead… briefly.” · “Interesting choice! Let's see how it ages.” · `
      + `“You're playing very well. The game lasts forever.” · “No eliminations today. Just consequences.” · `
      + `“Same time next century?”\n\nConfetti made of scales drifts down. The stage dissolves into water.`
  };

  const FIGHT = "You swing on a game-show host who is also a marsh.\n\nIt does not go how you expect, because Gloomgill does not fight back so much as CORRECT you. The water gets procedural about it. A blade goes in and comes out wet and slightly blunter and somehow further from where you aimed than when you started. Something enormous and patient rearranges itself under the surface, in the manner of a body that has been rearranging itself under this surface since before the idea of a weapon. The applause does not stop. That is the worst part — the applause does not stop.\n\nNobody wins. He does not appear to consider that a result, or an insult, or anything much at all. When you finally stand there breathing hard in thigh-deep water, the microphone is still on.\n\n**Gloomgill:** “No eliminations today. Just consequences.”\n\n⚙ GM: this is not a winnable combat and should not be run as one — a round or two of pointed, pedantic futility, then it resolves. He is twelve thousand years old and the marsh is on his side.";

  // ── load ──────────────────────────────────────────────────────────────────
  let raw = game.settings.get(NS, "campaigns");
  const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : foundry.utils.deepClone(raw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  const plain = (h) => String(h || "").replace(/<[^>]+>/g, " ").trim();

  // 1 — enrich the ten questions
  for (const [id, block] of Object.entries(Q)) {
    const b = byId.get(id);
    if (!b) { report.push(`⚠ ${id} NOT FOUND`); continue; }
    if (plain(b.description).includes("he is grading ENERGY")) { report.push(`· ok ${id} (already enriched)`); continue; }
    if (plain(b.description).length > GUARD) { report.push(`✋ ${id} has ${plain(b.description).length} chars — hand-written since, LEFT ALONE`); continue; }
    changes++; report.push(`✚ ${id} +${block.length} chars of GM guidance`);
    if (!DRY_RUN) b.description = String(b.description || "") + block;
  }

  // 2 — no eliminations: Q1-Q9 Incorrect advances to the next question
  for (let i = 1; i <= 9; i++) {
    const b = byId.get(`gloomgill_question_${i}`);
    if (!b) continue;
    const wrong = (b.choices || []).find(c => /incorrect/i.test(c.label || ""));
    if (!wrong) { report.push(`⚠ Q${i} has no Incorrect choice`); continue; }
    const want = `gloomgill_question_${i + 1}`;
    if (wrong.next === want) { report.push(`· ok Q${i} Incorrect already advances`); continue; }
    changes++; report.push(`⚡ Q${i} Incorrect: ${wrong.next} → ${want} (was a dead end)`);
    if (!DRY_RUN) { wrong.next = want; wrong.label = "Missed it — he reacts, the show goes on"; }
  }

  // 3 — Q10 becomes the verdict fork
  const q10 = byId.get("gloomgill_question_10");
  if (q10) {
    const wrong = (q10.choices || []).find(c => /incorrect/i.test(c.label || ""));
    if (wrong && wrong.next !== "gloomgill_failed") {
      changes++; report.push(`⚡ Q10 Incorrect: ${wrong.next} → gloomgill_failed`);
      if (!DRY_RUN) { wrong.next = "gloomgill_failed"; wrong.label = "They never really engaged"; }
    } else report.push(`· ok Q10 verdict fork`);
  }

  // 4 — the fight branch
  const fight = byId.get("gloomgill_fight");
  if (fight) {
    if (plain(fight.description).length > GUARD) report.push(`✋ gloomgill_fight written since — LEFT ALONE`);
    else if (plain(fight.description).length > 0) report.push(`· ok gloomgill_fight has text`);
    else {
      changes++; report.push(`✚ gloomgill_fight written (+${FIGHT.length}) → routes to gloomgill_fought`);
      if (!DRY_RUN) {
        fight.description = FIGHT;
        fight.choices = [{ label: "Stop swinging", next: "gloomgill_fought", description: "", checkStat: "", checkDC: 0, failNext: "" }];
      }
    }
  }

  // 5 — the two vestigial verdict beats: never leave a void behind
  for (const [id, text, next] of [
    ["gloomgill_incorrect", "“That was incorrect!” — and the show does not stop, because it never stops.\n\n⚙ GM: SUPERSEDED. Each question now carries Gloomgill's own bespoke disapproval line, and a miss advances to the next question (no eliminations). This beat remains only so nothing legacy dead-ends here.", "gloomgill_question_1"],
    ["gloomgill_correct", "“That was correct!” — he says, and means something slightly different by it than you do.\n\n⚙ GM: SUPERSEDED. Approval lines now live on each question beat. Retained so nothing legacy dead-ends here.", "gloomgill_question_1"]
  ]) {
    const b = byId.get(id);
    if (!b) continue;
    if (plain(b.description).length > GUARD) { report.push(`✋ ${id} written since — LEFT ALONE`); continue; }
    if ((b.choices || []).some(c => c.next)) { report.push(`· ok ${id} already has an exit`); continue; }
    changes++; report.push(`⚡ ${id} given content + an exit (was a VOID)`);
    if (!DRY_RUN) {
      b.description = text;
      b.choices = [{ label: "Back to the show", next, description: "", checkStat: "", checkDC: 0, failNext: "" }];
    }
  }

  console.log(`[fix-gloomgill-exam] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Gloomgill DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Gloomgill: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(wasStr ? raw : JSON.stringify(raw), "text/json", `backup-campaigns-before-gloomgill-fix-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Gloomgill APPLIED: ${changes} change(s). No eliminations today.`);
})();

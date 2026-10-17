/* patch-gully-second-round-2026-10-16.macro.js — THE SECOND ROUND (Dave, 2026-10-16):
 *  "Looks like we need a Second Round beat. We only have the one where we refuse to talk, instead of telling him
 *   from where we are." + "The stewards don't find the Gearbox coffee until they have eaten everywhere. Then it
 *   becomes noticeable. So let's not have Dougan mention it."
 *
 *  Before: rc_gully_amber did the first AND second rounds in one breath (drink, tell him, third glass appears) and
 *  Gully tipped the players to the coffee tin in the Reliable's galley — a tin they are not supposed to notice until
 *  the last course of the Recalcitrant Cafe is eaten (the brew rows are already gated on all seven meals).
 *
 *   NEW   rc_gully_second_round   you tell him where you're from; he checks the box; "Mine's a better story."
 *   AMBER rc_gully_amber          = the FIRST round only: the amber thing, the eyebrows, the second glass slides down
 *                                   and he waits. No telling, no coffee tin. Keeps the Amber Thing effect (the meal
 *                                   mark the coffee gate counts).
 *   WIRED welcome "+Second round. Tell him where you're from." (needs the amber round; hidden once paid)
 *         welcome "The third round" now needs the SECOND round, not the amber
 *         amber  "Tell him where you're from." → second round · "Ask his name" → the first answer (not getting_there)
 *                · "Buy the third round" needs the second round
 *         second round "Ask his name" → rc_gully_getting_there · "+Buy the third round" (hidden once earned)
 *
 *  Idempotent (id / text / label guards); DRY_RUN default true; backs up `campaigns`. GM only.
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

  const AMBER = "rc_gully_amber", SECOND = "rc_gully_second_round", THIRD = "rc_gully_third_round";
  const NOT_EARNED = { beatMark: THIRD, not: true };
  const ch = (label, description, extra = {}) => ({ label, next: "", description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const WE = (extra = {}) => ({ territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [], ...extra });
  const lbl = (c) => String(c?.label || "").trim().toLowerCase();
  const sameReq = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);

  /* ── 1. the first round is only the first round ────────────────────────── */
  const amber = byId.get(AMBER);
  if (!amber) return ui.notifications.error("rc_gully_amber not found — the Recalcitrant Cafe patch must be applied first.");
  const AMBER_DESC = "You drink the amber thing. Your eyebrows file their report. It tastes like peaches that did something unforgivable and got away with it, and the carbonation has opinions about your sinuses.\n\nGully slides the second one down the bar without being asked, and waits. He does not say the rule again. He said it once. The dartboard says ANYWHERE. The teamster asleep sitting up does not spill.\n\nEverybody in this room paid for that glass with the same coin. Your turn.\n\n<i>The amber thing: +1 on Intrigue checks until the turn ends. Everybody in this room is from somewhere else. Now so are you.</i>";
  const AMBER_LABEL = "Furrier's Fixit Farm — The Amber Thing";
  const AMBER_MEMORY = "Drank the amber thing at the Gullywasher. The second glass is on the bar, and it has a price.";
  if (String(amber.description || "").includes("coffee tin") || !String(amber.description || "").includes("He does not say the rule again")) { amber.description = AMBER_DESC; changes++; report.push("✚ amber: first round only — the telling and the coffee tin are gone"); }
  else report.push("· ok amber: description already the first round");
  if (amber.label !== AMBER_LABEL) { amber.label = AMBER_LABEL; changes++; report.push(`✚ amber: label → ${AMBER_LABEL}`); } else report.push("· ok amber: label");
  if (amber.memoryText !== AMBER_MEMORY) { amber.memoryText = AMBER_MEMORY; changes++; report.push("✚ amber: memory line no longer mentions the tin"); } else report.push("· ok amber: memory line");
  {
    amber.choices = Array.isArray(amber.choices) ? amber.choices : [];
    const want = [
      ch("Tell him where you're from.", "The second one is already on the bar. The house rule has a price. Pay it.", { next: SECOND, requires: [{ beatMark: SECOND, not: true }] }),
      ch("Ask his name", "\"Behind the bar? Gully.\" The glass in his hands achieves a shine that borders on editorial.", { next: "fixit_gully_answer_name", requires: [NOT_EARNED] }),
      ch("Buy the third round. His story.", "\"Mine's a better story. You're buying.\"", { next: THIRD, requires: [{ beatMark: SECOND }, NOT_EARNED] }),
      ch("Back to the yard", "", { next: "fixit_town_walk" })
    ];
    if (JSON.stringify(amber.choices) !== JSON.stringify(want)) { amber.choices = want; changes++; report.push("✚ amber: menu = tell him / ask his name (first answer) / third round (needs the second) / yard"); }
    else report.push("· ok amber: menu");
  }

  /* ── 2. the second round ───────────────────────────────────────────────── */
  if (!byId.get(SECOND)) {
    const nb = foundry.utils.deepClone(amber);
    Object.assign(nb, {
      id: SECOND, label: "Furrier's Fixit Farm — The Second Round", questStep: 342, timePoints: 0,
      description: "You tell him where you're from. All of it, or enough of it — the place, or the day you left the place, which out here is the same answer told honestly.\n\nHe listens the way bartenders listen, which is with the glass and not the eyes. Somewhere in the middle the teamster asleep sitting up says \"mm\" without waking, which in this room counts as applause. When you finish, Gully nods like a man checking a box.\n\n\"That'll do.\" The empty goes, the ring mark gets wiped. \"Everybody leads with the town. Nobody's from a town. They're from the day they left it, and you got there quicker than most.\" He glances at the third glass he hasn't poured. \"Mine's a better story. You're buying.\"\n\nThe dartboard says ANYWHERE. You've just told the room which anywhere, and the room, without looking up, moved over an inch to make space.",
      memoryText: "Paid the second round at the Gullywasher with where you're from. Gully checked the box. The third round is his story, and you're buying.",
      worldEffects: WE(),
      choices: [
        ch("Ask his name", "\"Behind the bar? Gully.\" A glass gets polished. \"Everywhere else — you're getting there.\"", { next: "rc_gully_getting_there", requires: [NOT_EARNED] }),
        ch("Buy the third round. His story.", "\"Mine's a better story. You're buying.\"", { next: THIRD, requires: [NOT_EARNED] }),
        ch("Back to the yard", "", { next: "fixit_town_walk" })
      ]
    });
    nb.inject = { ...(nb.inject || {}), repeatable: true };
    camp.beats.push(nb); byId.set(SECOND, nb); changes++; report.push(`✚ beat ${SECOND} — ${nb.label}`);
  } else report.push(`· ok beat (already) ${SECOND}`);

  /* ── 3. the welcome menu ───────────────────────────────────────────────── */
  {
    const b = byId.get("fixit_gullywasher_welcome");
    if (!b) report.push("⚠ fixit_gullywasher_welcome: NOT FOUND");
    else {
      b.choices = Array.isArray(b.choices) ? b.choices : [];
      const secondRow = ch("Second round. Tell him where you're from.", "He slid the second one down the bar and he is still waiting. That's the house rule. Pay it.", { next: SECOND, requires: [{ beatMark: AMBER }, { beatMark: SECOND, not: true }] });
      const have = b.choices.find(c => c?.next === SECOND);
      if (!have) {
        const i = b.choices.findIndex(c => c?.next === AMBER);
        b.choices.splice(i >= 0 ? i + 1 : 0, 0, secondRow);
        changes++; report.push("✚ welcome: '+Second round. Tell him where you're from.' after the amber row (needs the amber round; hidden once paid)");
      } else if (JSON.stringify(have) !== JSON.stringify(secondRow)) { Object.assign(have, secondRow); changes++; report.push("✚ welcome: second-round row text/gates refreshed"); }
      else report.push("· ok welcome: second-round row");
      const third = b.choices.find(c => c?.next === THIRD);
      const thirdReq = [{ beatMark: SECOND }, NOT_EARNED];
      if (!third) report.push("⚠ welcome: third-round row not found (run patch-gully-earned-name first)");
      else if (!sameReq(third.requires, thirdReq)) { third.requires = thirdReq; changes++; report.push("✚ welcome: third round now needs the SECOND round (was the amber)"); }
      else report.push("· ok welcome: third round gated on the second round");
    }
  }

  /* ── 4. sanity: nobody else tips the tin early ─────────────────────────── */
  for (const b of camp.beats) {
    if (b.id === "rc_gearbox_coffee") continue;
    const s = String(b.description || "");
    if (/coffee tin|DON'T OPEN TILL/i.test(s)) report.push(`⚠ ${b.id}: description still mentions the tin — look at it`);
  }

  console.log(`[patch-gully-second-round] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Gully second round DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Gully second round: nothing to do.");
  try {
    (foundry.utils.saveDataToFile ?? saveDataToFile)(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-gully-second-round-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Gully second round APPLIED: ${changes} change(s). Second one, you tell him where you're from.`);
})();

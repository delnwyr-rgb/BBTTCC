/* patch-gully-earned-name-2026-10-16.macro.js — GULLY EARNS HIS NAME (Dave, 2026-10-16):
 *  "We've got a subplot going on with Dougan where he's going by Gully and making the players earn his name.
 *   I am missing the beat where they actually learn he's called Dougan… Dougan is name-checked as Dougan in
 *   beats that I think are reachable without having gotten the name from him."
 *
 *  Before: fixit_gully_answer_name promised "we'll see if you earn it" and nothing ever paid it off; the house
 *  rule's THIRD ROUND (he tells you where HE's from, you buy) was never written; "Ask his name" on the amber
 *  beat went back to the yard; eight interrogation beats, Miliard's rite lines and the Wendigo-arc pointer all
 *  said "Dougan" on a first visit. The NPC actor itself is named Dougan Marsh on every card.
 *
 *   NEW   rc_gully_getting_there   "Behind the bar? Gully." … "Everywhere else — you're getting there." (Dave's line)
 *         rc_gully_third_round     the third round: where he's from, then the name. PLAYED = the name is earned.
 *         gullywasher_gully_points_to_confluence  twin of the Wendigo pointer for a party that never bought the
 *                                  third round — same beat, he gives the name as an advance. (Original pointer
 *                                  now requires the third round; the twin requires NOT.)
 *   WIRED  welcome "Ask his name" hidden once earned · welcome "+The third round. His story." (needs the amber
 *          round, hidden once earned) · amber "Ask his name" → getting_there · amber "+Buy the third round."
 *   SWAPS  8 interrogation beats "Dougan …" → "Gully …" · Miliard ×3 "Dougan now owes me five beers" → "Gully owes…"
 *   ACTOR  Dougan Marsh (7Lee6ROPnc4gWYJh): flags.bbttcc-campaign.alias = { name:"Gully", untilMark:[the two
 *          earning beats] } — engine 2026-10-16 prints the alias on invite cards, quest names, enact cards and
 *          the Talk window until one of those beats is played; persona notes gain the house-rule clause.
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

  const DOUGAN = "7Lee6ROPnc4gWYJh";
  const EARNED = "rc_gully_third_round";
  const ADVANCE = "gullywasher_gully_points_to_confluence";
  const NOT_EARNED = { beatMark: EARNED, not: true };

  const ch = (label, description, extra = {}) => ({ label, next: "", description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const WE = (extra = {}) => ({ territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [], ...extra });
  const addBeat = (nb) => { if (byId.get(nb.id)) { report.push(`· ok beat (already) ${nb.id}`); return byId.get(nb.id); } camp.beats.push(nb); byId.set(nb.id, nb); changes++; report.push(`✚ beat ${nb.id} — ${nb.label}`); return nb; };
  // New bar beats wear the amber beat's envelope (scene, speaker, hex, quest, story) so they sit where it sits.
  const fromAmber = (id, questStep, label, description, { choices = [], memoryText = "", worldEffects = WE() } = {}) => {
    const tpl = byId.get("rc_gully_amber");
    if (!tpl) throw new Error("rc_gully_amber not found — the Recalcitrant Cafe patch must be applied first");
    const nb = foundry.utils.deepClone(tpl);
    Object.assign(nb, { id, label, description, choices, memoryText, worldEffects, questStep, timePoints: 0 });
    nb.inject = { ...(nb.inject || {}), repeatable: true };
    return nb;
  };
  const swap = (id, from, to, note) => {
    const b = byId.get(id);
    if (!b) return report.push(`⚠ ${id}: NOT FOUND`);
    if (String(b.description || "").includes(from)) { b.description = b.description.replace(from, to); changes++; report.push(`✚ ${id}: ${note || from.slice(0, 40)}`); }
    else report.push(String(b.description || "").includes(to) ? `· ok ${id}: already "${to.slice(0, 32)}…"` : `⚠ ${id}: text not found — "${from.slice(0, 40)}"`);
  };

  /* ── 1. the two new bar beats ──────────────────────────────────────────── */
  addBeat(fromAmber("rc_gully_getting_there", 344, "Furrier's Fixit Farm — You're Getting There",
    "\"Behind the bar? Gully.\" A glass gets polished. \"Everywhere else — you're getting there.\"\n\nHe tips the glass toward the third one he hasn't poured yet. The house rule has a third line, and it has your name on it, and his.",
    { choices: [
        ch("Buy the third round. His story.", "Third one, he tells you where HE's from, and you buy it.", { next: EARNED }),
        ch("Back to the yard", "", { next: "fixit_town_walk" })
      ],
      memoryText: "Asked Gully his name again after the second round. \"Everywhere else — you're getting there.\"" }));

  addBeat(fromAmber(EARNED, 345, "Furrier's Fixit Farm — The Third Round",
    "You buy the third round. He pours it himself, which he hasn't done all night, and pours one for himself, which the room notices.\n\n\"Scrubland. South, goat country, the kind of south where the map runs out of names and starts using adjectives.\" He tastes the amber thing like a man checking it's still true. \"Everybody down there knows a Chupacabra story. Nobody down there had met one, because we were raised polite and we were raised to leave before the shouting. I left so early the shouting hadn't started yet. It had to send word on after me. Three towns in a row put up a sign. CHUPACABRA SEEN. I wasn't seen. I was serving.\"\n\nHe lets that sit.\n\n\"Tended bar in a town that voted, twice, to run me out. Both times the vote lost, because the only roof in town that didn't leak was mine. That's where I'm from. A place that hated me on principle and tipped me on the way out.\" He sets the glass down, exactly on its ring. \"Now that's a better story than yours. It usually is. Don't take it personal.\"\n\nThen, and it costs him nothing you can see, which is how you know what it costs:\n\n\"Dougan. Dougan Marsh. Behind the bar it's still Gully — but you're not behind the bar.\" A nod. \"Use it sparingly. It's not a bottle you open for the room.\"\n\nEverybody in this room is from somewhere else. One of them just told you where.",
    { choices: [ ch("Raise the glass. To Dougan Marsh.", "", { next: "fixit_town_walk" }), ch("Back to the yard", "", { next: "fixit_town_walk" }) ],
      memoryText: "Bought the third round. Gully told the Stewards where he's from — scrubland, goat country, a town that voted twice to run him out and tipped him on the way — and gave them his name: Dougan Marsh. Earned, not overheard.",
      worldEffects: WE({ factionEffects: [{ factionId: "@coalition", moraleDelta: 1, loyaltyDelta: 0 }] }) }));

  /* ── 2. wire the house rule ────────────────────────────────────────────── */
  {
    const b = byId.get("fixit_gullywasher_welcome");
    if (!b) report.push("⚠ fixit_gullywasher_welcome: NOT FOUND");
    else {
      b.choices = Array.isArray(b.choices) ? b.choices : [];
      const ask = b.choices.find(c => /^ask his name$/i.test(String(c?.label || "").trim()));
      if (ask && !(ask.requires || []).some(r => r?.beatMark === EARNED)) { ask.requires = [...(ask.requires || []), NOT_EARNED]; changes++; report.push("✚ welcome: 'Ask his name' hidden once the name is earned"); }
      else report.push("· ok welcome: 'Ask his name' already gated");
      if (!b.choices.some(c => c?.next === EARNED)) {
        const i = b.choices.findIndex(c => /^ask his name$/i.test(String(c?.label || "").trim()));
        b.choices.splice(i >= 0 ? i + 1 : b.choices.length, 0,
          ch("The third round. His story.", "You paid the second round with where you're from. The third is his, and you're buying.", { next: EARNED, requires: [{ beatMark: "rc_gully_amber" }, NOT_EARNED] }));
        changes++; report.push("✚ welcome: '+The third round. His story.' (needs the amber round; hidden once earned)");
      } else report.push("· ok welcome: third-round row already there");
    }
  }
  {
    const b = byId.get("rc_gully_amber");
    if (!b) report.push("⚠ rc_gully_amber: NOT FOUND");
    else {
      b.choices = Array.isArray(b.choices) ? b.choices : [];
      const ask = b.choices.find(c => /^ask his name$/i.test(String(c?.label || "").trim()));
      if (ask && ask.next !== "rc_gully_getting_there") { ask.next = "rc_gully_getting_there"; changes++; report.push("✚ amber: 'Ask his name' → rc_gully_getting_there (was the yard)"); }
      else report.push("· ok amber: 'Ask his name' already aimed");
      if (!b.choices.some(c => c?.next === EARNED)) {
        const i = b.choices.findIndex(c => /^back to the yard$/i.test(String(c?.label || "").trim()));
        b.choices.splice(i >= 0 ? i : b.choices.length, 0, ch("Buy the third round. His story.", "\"Mine's a better story. You're buying.\"", { next: EARNED, requires: [NOT_EARNED] }));
        changes++; report.push("✚ amber: '+Buy the third round. His story.'");
      } else report.push("· ok amber: third-round row already there");
    }
  }

  /* ── 3. nobody says Dougan on a first visit ────────────────────────────── */
  const INTERROGATION = {
    fixit_gullywasher_choice_1: ["Dougan pauses mid-polish.", "Gully pauses mid-polish."],
    fixit_gullywasher_choice_2: ["Dougan clasps his hands delightedly.", "Gully clasps his hands delightedly."],
    fixit_gullywasher_choice_3: ["Dougan’s eyes light up.", "Gully’s eyes light up."],
    fixit_gullywasher_choice_4: ["Dougan listens without interruption.", "Gully listens without interruption."],
    fixit_gullywasher_choice_1_fail: ["Dougan laughs — not mockingly, but musically.", "Gully laughs — not mockingly, but musically."],
    fixit_gullywasher_choice_2_fail: ["Dougan studies you for a long moment.", "Gully studies you for a long moment."],
    fixit_gullywasher_choice_3_fail: ["Dougan narrows his eyes theatrically.", "Gully narrows his eyes theatrically."],
    fixit_gullywasher_choice_4_fail: ["Dougan raises one brow.", "Gully raises one brow."]
  };
  for (const [id, [from, to]] of Object.entries(INTERROGATION)) swap(id, from, to, "Dougan → Gully");
  for (const id of ["fixit_weeping_prisoner_punishment", "fixit_weeping_prisoner_justice", "fixit_weeping_prisoner_mercy"])
    swap(id, "Dougan now owes me five beers", "Gully owes me five beers", "Miliard: Dougan → Gully");

  /* ── 4. the Wendigo pointer: earned name, or the name as an advance ────── */
  {
    const b = byId.get("gullywasher_dougan_points_to_confluence");
    if (!b) report.push("⚠ gullywasher_dougan_points_to_confluence: NOT FOUND");
    else {
      b.inject = b.inject || {};
      b.inject.requires = Array.isArray(b.inject.requires) ? b.inject.requires : (b.inject.requires ? [b.inject.requires] : []);
      if (!b.inject.requires.some(r => r?.beatMark === EARNED && !r.not)) { b.inject.requires.push({ beatMark: EARNED }); changes++; report.push("✚ pointer (Dougan): requires the third round"); }
      else report.push("· ok pointer (Dougan): already requires the third round");
      if (!byId.get(ADVANCE)) {
        const t = foundry.utils.deepClone(b);
        t.id = ADVANCE; t.label = "The Gullywasher — Gully Points the Way"; t.questStep = 51;   // beside the original's 50 (lint: no duplicate step)
        t.inject.requires = t.inject.requires.filter(r => !(r?.beatMark === EARNED)).concat([NOT_EARNED]);
        const head = "Dougan stops polishing the glass. For once, he is not performing.";
        if (!String(t.description || "").includes(head)) report.push("⚠ pointer twin: opening line not found — twin text left as copied");
        t.description = String(t.description || "").replace(head, "Gully stops polishing the glass. For once, he is not performing.")
          + "\n\nHe puts the glass down. Then, because you are about to go somewhere for him that he cannot go himself: \"Dougan. Dougan Marsh. That's the one that isn't behind the bar. You didn't earn it at the bar, so take it as an advance.\"";
        t.memoryText = String(t.memoryText || "") + " Gave them the name — Dougan Marsh — as an advance, since they were going upstream for him.";
        addBeat(t);
      } else report.push(`· ok beat (already) ${ADVANCE}`);
    }
  }

  /* ── 5. the actor: alias until earned + persona clause ─────────────────── */
  const actor = game.actors.get(DOUGAN);
  const aliasWant = { name: "Gully", untilMark: [EARNED, ADVANCE] };
  const aliasHave = actor?.getFlag?.(NS, "alias") || null;
  const aliasNeeded = !!actor && JSON.stringify(aliasHave) !== JSON.stringify(aliasWant);
  if (!actor) report.push("⚠ actor Dougan Marsh not found — alias not set");
  else if (aliasNeeded) { changes++; report.push("✚ actor: alias Gully until the third round / the advance"); }
  else report.push("· ok actor: alias already set");
  const MARK = "[GULLY-NAME-2026-10-16]";
  const CLAUSE = `\n\n${MARK} THE NAME: behind the bar you are GULLY — short for the Gullywasher, which is short for what the first batch of the amber thing did to a man's opinion of his own limits. Everywhere else you have another name, and people EARN it: the house rule — first one's on the Farm; second, they tell you where they're from; third, you tell them where YOU'RE from (scrubland, goat country, a town that voted twice to run you out and tipped you on the way) and they buy that round — and the name comes at the end of the third one: Dougan Marsh. Until a Steward has paid all three, you are Gully, and asked for the other name you say they'll see if they earn it. The one exception: a Steward you are sending upstream to the Confluence for you gets it as an advance.`;
  const persona = foundry.utils.deepClone(actor?.getFlag?.("bbttcc-mal-voice", "persona") || {});
  const personaNeeded = !!actor && !String(persona.notes || "").includes(MARK);
  if (personaNeeded) { persona.notes = String(persona.notes || "") + CLAUSE; changes++; report.push("✚ actor: persona notes gain the house-rule clause"); }
  else if (actor) report.push("· ok actor: persona clause already present");

  console.log(`[patch-gully-earned-name] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Gully patch DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Gully patch: nothing to do.");
  try {
    (foundry.utils.saveDataToFile ?? saveDataToFile)(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-gully-name-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (aliasNeeded) await actor.update({ [`flags.${NS}.alias`]: aliasWant });
  if (personaNeeded) await actor.setFlag("bbttcc-mal-voice", "persona", persona);
  ui.notifications.info(`Gully patch APPLIED: ${changes} change(s). Names out here are like the good bottles.`);
})();

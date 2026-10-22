/* patch-timeline-copperplate-2026-10-21.macro.js — three plot rulings from Dave (2026-10-21, after the happy-path story read):
 *
 *  1. THE COUGH IS ALMOST A YEAR AGO. The Night the Mountain Coughed moves from "two years / a year and a half" to just under a
 *     year; Act 2 runs up to its first anniversary. The wall's lean now starts the night of the Cough (was "last winter").
 *     Halloween 2077 stays the Shattering and the First Yesod Explosion.
 *  2. THE COPPERPLATE IS UNTANGLED. The Wendigo write their name-cards in their own warm hand and send no gifts (supersedes the
 *     2026-10-02 "sender is the Wendigo" ruling). The patient copperplate is the paymaster's house hand: the head card at the
 *     Long Table, the Siege's year-zero paper, the Gift's clause, the sideways lading, crate nine's chits, Tarvaan's letter.
 *     Gloomgill still says the name first; the hand is the only breadcrumb.
 *  3. TARVAAN SAYS WHAT HE WAS PROMISED. New beat odie_tarvaan_terms (off odie_tarvaan_falls): he was hired to prime a shape to
 *     catch the release when the paymaster burns Yesod and every leyline in Bad Eden out, land and all. He never asked the name.
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

  // replace `from` with `to` inside a string field; idempotent when `to` is already present
  const edit = (id, getter, setter, from, to, note) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; }
    const cur = String(getter(b) ?? "");
    if (to && cur.includes(to) && (!from.includes(to) || !cur.includes(from))) { report.push(`· ok ${id}: ${note}`); return; }
    if (cur.includes(from)) { setter(b, cur.replace(from, to)); changes++; report.push(`✚ ${id}: ${note}`); return; }
    report.push(`⚠ ${id}: baseline not found for "${note}"`);
  };
  const rep = (id, from, to, note) => edit(id, b => b.description, (b, v) => { b.description = v; }, from, to, note);
  const repMem = (id, from, to, note) => edit(id, b => b.memoryText, (b, v) => { b.memoryText = v; }, from, to, note);
  const repTruth = (id, label, from, to, note) => edit(id,
    b => (b.worldEffects?.receipts || []).find(r => r.label === label)?.truth,
    (b, v) => { (b.worldEffects.receipts.find(r => r.label === label)).truth = v; }, from, to, note);
  const repChoice = (id, label, from, to, note) => edit(id,
    b => (b.choices || []).find(c => c.label === label)?.description,
    (b, v) => { (b.choices.find(c => c.label === label)).description = v; }, from, to, note);

  // ─── 1. The Cough: almost a year ago ─────────────────────────────────────────────────────────────────────────────
  rep("ag_greeley_answer_cough", "Before your time a bit, and courtesy", "Coming up on a year, and courtesy", "Cough ≈ a year (Greeley)");
  rep("kt_official_word_open", "The crews stopped waiting a year ago, which is worse than waiting.\"",
      "The crews stopped waiting by midsummer, which is worse than waiting. It'll be a year on the night.\"", "Cough ≈ a year; the anniversary is coming (Calder)");
  rep("kt_dropped_manifest", "for a shift two years gone", "for a shift a year gone, near enough to the night", "Cough ≈ a year (manifest)");
  rep("kt_pulled_files_filed", "which he has been saying for two years", "which he has been saying for most of a year", "Cough ≈ a year (Calder)");
  rep("ag_confessor_relief", "rehearsing for a year and a half", "rehearsing since the Cough, near enough a year", "Tamsin's service starts at the Cough");
  rep("ag_tamsin_pactkeeper", "serving something for a year and a half,", "serving something since the Cough, most of a year,", "Tamsin's service starts at the Cough");
  rep("ag_plumb_to_the_wall", "It started last winter, when something under Khezek-Tor first pulled",
      "It started the night of the Cough, when something under Khezek-Tor first pulled", "the lean starts the night of the Cough");
  repTruth("ag_plumb_to_the_wall", (byId.get("ag_plumb_to_the_wall")?.worldEffects?.receipts?.[0]?.label) || "",
      "It began last winter, when something under Khezek-Tor first pulled", "It began the night of the Cough, when something under Khezek-Tor first pulled", "the lean starts the night of the Cough (Receipt)");
  repMem("ag_plumb_to_the_wall", "the lean began last winter when", "the lean began the night of the Cough when", "the lean starts the night of the Cough (memory)");
  rep("kt_official_word_given", "underlines the date on the board, once, and around here that is a medal.",
      "underlines the date on the board, once, and around here that is a medal. A year, near enough, to the night.", "the word is given near the anniversary");
  rep("kt_comeuppance_tape", "Calder underlines the date on the board. The Cough is closed.",
      "Calder underlines the date on the board. It is a year to the week. The Cough is closed.", "the tape lands on the anniversary");
  rep("maneuver_vault_pulled_files", "copied here first, because the Vault keeps everything.",
      "copied here first, because the client's paper still files itself here, and the Vault keeps everything.", "why a pre-Shattering vault holds last year's folder");

  // ─── 2. The copperplate: the paymaster's house hand, not the Wendigo's ─────────────────────────────────────────────
  rep("wendigo_confluence_name_cards",
      "Read again, they are not a memorial. They are a list, in one hand, and at the head of the table is a card that isn't a name: TAMSIN MINE POWER — PRIVATE LINE — ONE CLIENT.",
      "Read again, they are not a memorial. They are a list, in the Wendigo's one warm hand — all but the card at the head of the table, which isn't a name and isn't theirs. It is written in a patient copperplate, the hand of a clerk who has never once hurried: TAMSIN MINE POWER — PRIVATE LINE — ONE CLIENT. The Wendigo did not write that one. It came with them.",
      "the head card is the one card in copperplate");
  repTruth("wendigo_confluence_name_cards", "The Guest List",
      "and the one client above them: TAMSIN MINE POWER, PRIVATE LINE.",
      "and the one client above them in somebody else's patient copperplate: TAMSIN MINE POWER, PRIVATE LINE.", "Guest List names the copperplate");
  repChoice("trojan_same_hand", "\"The name-cards.\"",
      "You have seen this hand before: at the Long Table, on a card for everyone the region forgot, in the same patient copperplate. Pernelle Oday takes her hands off the table. The Wendigo send gifts. They have always sent gifts. They knock first, and they are very sorry about the berth.",
      "Not the Wendigo's hand. Theirs is warm and hand-lettered, and this is not. But you have seen this one once at the Long Table, on the only card the Wendigo did not write, the one at the head: TAMSIN MINE POWER — PRIVATE LINE — ONE CLIENT. The same patient copperplate. Pernelle Oday takes her hands off the table. Whoever bought the bunker in 2077 has been sending gifts ever since.",
      "the Same Hand is the client's, not the Wendigo's");
  rep("trojan_paperwork",
      "the sender is the hand on the Long Table's name-cards — see the \"name-cards\" row on The Same Hand.)",
      "the sender is the paymaster's house — the patient copperplate on the Long Table's head card, the Siege's year-zero paper, crate nine and Tarvaan's letter; see the \"name-cards\" row on The Same Hand.)",
      "GM note: sender = the paymaster's house");
  repTruth("trojan_paperwork", "The Clause",
      "(GM: the sender is the Wendigo, owner ruling 2026-10-02; the same hand wrote the Siege's year-zero entry and the Long Table's name-cards.)",
      "(GM: the sender is the paymaster's house — Monodynamic, never named before Gloomgill. Its patient copperplate also wrote the Siege's year-zero paper, the head card at the Long Table, the lading on the sideways cargo, crate nine's chits and Tarvaan's letter. Owner ruling 2026-10-21, superseding 2026-10-02: the Wendigo write their cards in their own warm hand and send no gifts.)",
      "Clause GM note: sender = the paymaster's house");
  rep("finale_the_crates", "the chits are signed by nobody, initialled twice.", "the chits are signed by nobody, initialled twice, in a patient copperplate.", "crate nine in the copperplate");
  rep("odie_tarvaan_falls", "a letter. Paper nobody signed.", "a letter. Paper nobody signed, in a patient copperplate.", "Tarvaan's letter in the copperplate");
  rep("gloomgill_final_fact", "the one name nobody in this story has said out loud, in the one place it can be said.",
      "the one name nobody in this story has said out loud, in the one place it can be said.{{#played wendigo_confluence_name_cards}} It is the hand behind the patient copperplate you have been carrying since the Long Table.{{/played}}",
      "Gloomgill ties the name to the copperplate");
  rep("gloomgill_final_fact", "this beat is the only place in the story it is said; nothing earlier hints at it.",
      "this beat is the only place in the story it is said; nothing earlier names it. The one breadcrumb (ruling 2026-10-21) is his house's patient copperplate: the Long Table's head card, the Siege's year zero, the Gift, crate nine, Tarvaan's letter.",
      "GM note: the copperplate is the breadcrumb");

  // ─── 3. Tarvaan says what he was promised ───────────────────────────────────────────────────────────────────────
  const NEW_ID = "odie_tarvaan_terms";
  if (byId.has(NEW_ID)) report.push(`· ok ${NEW_ID}: new beat exists`);
  else {
    const tpl = byId.get("odie_tarvaan_falls");
    if (!tpl) report.push("⚠ odie_tarvaan_falls: template not found");
    else {
      const nb = foundry.utils.deepClone(tpl);
      nb.id = NEW_ID; nb.label = "What Tarvaan Was Promised"; delete nb.refs; nb.timePoints = 0;
      nb.description = "Tarvaan Truthshouter sits on the floor of the Hex Room with both eyes open and no platform under him, and for the first time since anyone here has known him, he does not shout. He tells it to Sklar, mostly. She lets him.\n\nThe letters came folded the way Wick folds things, in a patient copperplate, and they never once asked for a god. They asked for a cup. Fire the platform at the hour. Keep the Seal pointed out. Draw the sink's bleed up, night after night, and pour it into the shape until the shape was primed and holding. That was the whole job. He was never meant to become anything yet.\n\n“They're going to burn it,” he says. “The Foundation. Not crack it, not tap it. Burn it out. Yesod first, and then every leyline in Bad Eden goes with it, all at once, like a fuse, and the land goes with the lines. Everything that hums. A burn like that lets go of more than this world has spent since the night it ended, and almost all of it goes nowhere. Nowhere is wasteful.” He looks up at the hole where the shape was. “A primed shape catches some. That was the offer. When they light it, I'm the cup. I get to be what's left over.”\n\nSklar asks him who. “I never asked. You don't ask weather its name.” He laughs once, which is not a sound anyone wanted. “The eyes were my idea. I thought a god should be able to see.”\n\nNobody in yellow says anything. Somewhere above, a blue rope creaks, because rope is honest and it was listening.";
      nb.memoryText = "Tarvaan told the Stewards what the letters asked of him: prime the shape so that, when the paymaster burns Yesod and every leyline in Bad Eden out, land and all, he could catch what the burn let go.";
      nb.worldEffects = { receipts: [{ label: "What Tarvaan Was Promised", effectKey: "rollPlus2", acquisition: "earned", source: { name: "Tarvaan Truthshouter, on the floor of the Hex Room" },
        truth: "The plan, in the applicant's own mouth: prime a shape to catch the release when the paymaster burns Yesod and every leyline in Bad Eden out, land and all. No name; he never asked. ⚙ GM: the paymaster is Monodynamic; the name stays with Gloomgill." }] };
      nb.choices = [
        { label: "What's under the platform.", next: "odie_yesod_secret", description: "", checkStat: "", checkDC: 0, failNext: "" },
        { label: "Terms with Sklar.", next: "raid_thatwards_outcome_friends", description: "“Not family. Let's not get irresponsible.” She looks at Tarvaan for a long time and says nothing to him at all, which is the cruellest thing anyone in this room has ever seen her do.", checkStat: "", checkDC: 0, failNext: "",
          requires: { anyOf: [{ beatMark: "finale_sklar_turns" }, { beatMark: "odie_sklar_switches" }] } },
        { label: "Take the Spark and go.", next: "raid_thatwards_outcome_neutral_spark", description: "", checkStat: "", checkDC: 0, failNext: "" }
      ];
      if (nb.audio) { nb.audio.enabled = false; nb.audio.src = ""; }
      camp.beats.push(nb); byId.set(NEW_ID, nb); changes++; report.push(`✚ ${NEW_ID}: new beat — Tarvaan's terms`);
    }
  }
  { const b = byId.get("odie_tarvaan_falls"); const label = "Ask him what the shape was for.";
    if (!b) report.push("⚠ odie_tarvaan_falls: not found");
    else if ((b.choices || []).some(c => c.label === label)) report.push("· ok odie_tarvaan_falls: route to Tarvaan's terms");
    else { b.choices = b.choices || []; b.choices.unshift({ label, next: NEW_ID, description: "He has both eyes. He can look at you while he says it.", checkStat: "", checkDC: 0, failNext: "" }); changes++; report.push("✚ odie_tarvaan_falls: route to Tarvaan's terms"); } }
  rep("odie_yesod_secret", "Tarvaan was using it as a kettle. Somebody else was going to use it as a mine.",
      "{{#played odie_tarvaan_terms}}Tarvaan was going to be the cup. Somebody else was going to light the match.{{else}}Tarvaan was using it as a kettle. Somebody else was going to use it as a mine.{{/played}}",
      "the plates read against Tarvaan's terms");
  rep("odie_yesod_secret", "⚙ GM (never player-facing): the plates are the thing the paymaster was buying. Their intent is not to re-seat Yesod but to harvest the re-seating itself — the one burn that could fry Yesod outright and cut Bad Eden off from the Tree.",
      "⚙ GM: the plates are the thing the paymaster was buying. Their intent is not to re-seat Yesod but to burn it: the one burn that fries Yesod and every leyline in Bad Eden, burns the land out, and cuts it off from the Tree. Tarvaan was hired to catch the release (odie_tarvaan_terms says so out loud, without a name).",
      "GM note: the burn is now player-facing via Tarvaan");

  console.log(`[timeline + copperplate + Tarvaan 2026-10-21] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-timeline-copperplate-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the Cough is a year old, the copperplate is the paymaster's, and Tarvaan has said his piece.`);
})();

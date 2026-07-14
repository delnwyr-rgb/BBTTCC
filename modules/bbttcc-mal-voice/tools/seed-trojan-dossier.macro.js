/* seed-trojan-dossier.macro.js — the Trojan Gift: personas + knowledge
 * (2026-07-13, spec: HEX-VIGNETTES-2026-07-08.md §4 + §6 doctrine; pairs with
 *  seed-trojan-gift.macro.js in bbttcc-campaign — run that one FIRST)
 *
 * Personas:
 *   · Verna (append) — the Vacancy runs the betting book, of course; and the
 *     deep scene: if anyone ever shows her the berth's unreadable note, she
 *     fetches the ledger and sets the two names side by side. Evidence only —
 *     the ninth guest's owner slots stay shut (do-not-improvise doctrine).
 *   · Sergeant Brindle (new, skip-warn) — leader of the eleven decoy
 *     soldiers; being discovered was the job; now awkwardly, permanently local.
 * Dossier: commons + one page per door + the touring legend (@after the
 * beat that actually fired — branched knowledge, house pattern).
 *
 * DRY_RUN default true; personas marker-guarded; pages skip-existing. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const ALLOW_OVERWRITE = false;
  const MODULE_ID = "bbttcc-mal-voice";
  const MARKER = "[TROJAN-2026-07-13]";
  const JOURNAL_NAME = "World Dossier";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const findActor = (cands) => {
    const want = cands.map(norm);
    return game.actors.find(a => want.includes(norm(a.name))) || null;
  };
  const verna   = findActor(["Verna Tulliver", "Verna"]);
  const brindle = findActor(["Sergeant Brindle", "Brindle"]);

  const PERSONAS = [
    { actor: verna, who: "Verna (append)",
      topics: "the betting book, the gift, the odds, the berth's note (deep), the unreadable hand",
      notes: `${MARKER} THE BOOK AND THE NOTE — Verna Tulliver, on the gift (speak of the book freely once the gift has arrived; the note is another matter). THE BOOK: of course the Vacancy runs it — a betting pool needs three things, a slate, a stakeholder everyone trusts, and a proprietor who hears everything, and Verna is two of those and owns the third. Current odds, chalked and maintained with actuarial severity: soldiers 2:1 (the classics are classics for a reason) · paperwork 5:1 (her own money, quietly, is here) · 'something worse' 9:2 · 'it is actually just fruit' 40:1, a line she keeps open 'for the romantics.' She pays out fast and gloats never. THE NOTE (deep — only if someone actually shows her the berth's unreadable thank-you note, or describes the hand exactly): she goes still in the way of a woman hearing a bell she'd stopped listening for. Then she closes the office door — one full minute, the regulars will tell you that's twice ever — and comes back with the Vacancy's ledger, open to the page she never shows anyone who asks to SEE it. She sets the two side by side on the counter and does not say anything, because there is nothing to say that the two of them don't already say to each other: the same hand. The same refusal to be read. She will not speculate about who, or why, or where they walk (GUARD — that drawer is not hers to open, and she knows whose it is). What she will do is write 'occupied' in the ledger that night with a steadier hand than usual, and leave the ninth room's curtains at the sea-facing angle, same as always. TELLS: when the gift's berth comes up she counts — quietly, to ninety-nine — and stops; if you notice her stopping, she meets your eye and doesn't pretend you didn't.` },
    { actor: brindle, who: "Sergeant Brindle (new)",
      topics: "the crate, the card game, being discovered, the manifest, the profession, settling in",
      notes: `${MARKER} PRIVATE TRUTH — Sergeant Brindle, formerly of the crate. Voice: parade-polish sanded down by years of sitting in boxes; delivers absurd facts in a tone of quiet professional pride. THE PROFESSION: he leads (led) the eleven — career decoy soldiers, a genuine and ancient trade. Their job is to BE FOUND: convincingly, graciously, at the correct moment, so that nobody keeps searching. Seventeen deployments, seventeen discoveries, zero casualties, one laminated instruction sheet ('BE DISCOVERED GRACIOUSLY' is step one and he wrote it). He is quietly magnificent at cards, because the wait is the job and the game is the wait. WHAT HE KNOWS (yields to genuine kindness or a good hand of cards, honestly won): the crate's manifest was always one line short — every decoy sergeant learns to count what he's decoy FOR, and this time the count included a berth he was ordered never to knock on, provisions he never saw anyone collect, and a passenger he never once heard MOVE, in a compartment where he could hear the soldiers' cards shuffle through the wall. Whoever rode with them was quieter than wood. He left the berth's corner of the crate alone the way you leave a church alone. GUARDS: will not describe the sender's agents beyond 'punctual' (professional courtesy between trades); genuinely does not know who or what the passenger was and becomes uncharacteristically brief if pressed. SETTLING IN: the eleven are integrating awkwardly and permanently — they hold a formal card night, they queue beautifully, and they are collectively terrible at leaving. TELLS: shuffles cards one-handed when thinking; stands, without noticing, wherever the room's best sightline to the door is; says 'the cargo' never 'the gift.'` }
  ];

  const A = {
    arrival:     "beat:trojan_arrival",
    paperwork:   "beat:trojan_paperwork",
    compartment: "beat:trojan_compartment",
    refuse:      "beat:trojan_refuse",
    regift:      "beat:trojan_regift",
    tour:        "beat:trojan_tour"
  };

  const PAGES = [
    { name: "A Gift. (Not a Trojan.)", knownBy: "all", after: A.arrival, body:
      `It arrived on a specialized wagon behind six oxen and it is exactly what it looks like, which is the whole problem: an enormous, magnificent, unmistakably trojan-shaped gift, stenciled A GIFT. (NOT A TROJAN.), card reading WITH REGARDS in an immaculate, unattributable hand. Everyone knows the story. The sender knows everyone knows. The town has organized viewing shifts and a betting pool — the Vacancy runs the book, and the odds board is updated with actuarial severity: soldiers 2:1, paperwork 5:1, "something worse" 9:2, and "it's actually just fruit" at 40:1, a line kept open for the romantics. The one thing every school of thought agrees on: whatever you expect inside is the decoy.` },
    { name: "The Soldiers Were the Decoy", knownBy: "all", after: A.paperwork, body:
      `Layer one: eleven soldiers, discovered mid-card-game with snacks and a laminated instruction sheet — career decoys whose entire trade is being found graciously so nobody keeps looking. The betting pool paid the 2:1 favorites. Layer two is why the clerk needed to sit down: under the ribbon, a GIFT-DEBT instrument of the old kind, binding 'the undersigned, their heirs, their houses, and their harvests.' Paper like that has appeared exactly once before in the coast's living memory — year zero of the Fifteen-Year Siege, under the ribbon of a fruit basket, refused at the gate by a warden who read it first. The archivists have stopped calling that a coincidence and started calling it a FILING CATEGORY.` },
    { name: "The Berth Was Already Empty", knownBy: "all", after: A.compartment, body:
      `Behind a panel behind a panel: a berth, fitted like a ship's cabin, already empty in the way of a room someone has just finished being in carefully. Bed made, hospital corners. Payment on the pillow, counted exact, in coin old enough to need looking up. A thank-you note in a hand that will not be read — you can see that it is writing; it declines to be words; the signature declines hardest. And a stone floor — a stone floor, in a wooden crate — worn deep in the shape of two feet, the way a doorstep wears. The way a plinth might. Whoever rode in all that beautiful noise walked out unseen, paid exactly, and said thank you in a name nobody keeps. The Vacancy's proprietor was shown the note, they say. They say she fetched her ledger. They say she didn't say anything at all.` },
    { name: "The Insult at the Border", knownBy: "all", after: A.refuse, body:
      `The gift was refused — formally, with witnesses — and the drovers never came back for it, so it sits at the exact legal edge of the hex, gathering weather and legend. There are two competing tour guides now, a sketch vendor, and a food cart; the viewing mound is developing opinions about parking. Under the comedy, the archivists are quieter: refusing paper of the old kind is an insult ON RECORD, accruing wherever such things accrue, and the last documented refusal is currently fifteen years old and has flowerbeds. Also — the tour guides mention this less — a low panel was found hanging open one morning. From the inside.` },
    { name: "The Gift Moves On", knownBy: "all", after: A.regift, body:
      `In the great tradition of this coast, the gift was neither opened nor refused: it was RE-GIFTED — forwarded whole, with courier honors and a new card attached ('WITH REGARDS. AND ONWARD.'), to another faction entirely. The drovers who collected it displayed, for a tenth of a second, what witnesses swear was professional respect. The coast approves enormously. The coast is also very glad it isn't holding it. Reports from down the road say the inventory at its first stop listed one more layer than the manifest admitted, which everyone agrees is a problem for whoever's holding it, which is the entire point of the tradition.` },
    { name: "The Touring Gift", knownBy: "all", after: A.tour, body:
      `The reports arrive with the turns now, in the ritual cadence of weather news: the gift has moved again. Every stop finds everything the manifest promises plus exactly one layer nobody shipped — the accounts vary: clockwork birds already wound; a smaller, perfect replica of the gift itself; a pantry stocked with somebody's favorites, specifically; a ledger of every hand that ever touched the crate, one line longer than it should be. The hidden berth, when anyone thinks to check, is always empty and always made up — and in the versions people lower their voices for, sometimes warm. The tour ends, the saying goes, when somebody finally KEEPS it. Nobody has been brave enough to try.` }
  ];

  const report = [];
  for (const p of PERSONAS) {
    if (!p.actor) { report.push(`⚠ persona skipped — ${p.who} not found (mint the actor, re-run)`); continue; }
    const cur = p.actor.getFlag(MODULE_ID, "persona") || {};
    if (String(cur.notes || "").includes(MARKER)) { report.push(`· ok (already) ${p.actor.name}`); continue; }
    const topics = [String(cur.topics || "").trim(), p.topics].filter(Boolean).join(", ");
    const notes = [String(cur.notes || "").trim(), p.notes].filter(Boolean).join("\n\n");
    report.push(`✚ persona ${cur.notes ? "append" : "seed"} → ${p.actor.name}`);
    if (!DRY_RUN) await p.actor.setFlag(MODULE_ID, "persona", { topics, notes });
  }

  let journal = game.journal.getName(JOURNAL_NAME) || game.journal.contents.find(j => j.name === JOURNAL_NAME);
  if (!journal) { report.push(`journal "${JOURNAL_NAME}": CREATE`); if (!DRY_RUN) journal = await JournalEntry.create({ name: JOURNAL_NAME }); }
  for (const p of PAGES) {
    const existing = journal?.pages?.contents?.find(pg => pg.name === p.name);
    const head = [`<p>@knownBy: ${p.knownBy}</p>`, `<p>@after: ${p.after}</p>`];
    const content = head.join("\n") + `\n<p>${p.body}</p>`;
    if (existing && !ALLOW_OVERWRITE) { report.push(`page "${p.name}": exists — SKIPPED`); continue; }
    if (existing) { report.push(`page "${p.name}": UPDATE`); if (!DRY_RUN) await existing.update({ "text.content": content, "text.format": 1 }); }
    else { report.push(`page "${p.name}": CREATE`); if (!DRY_RUN && journal) await journal.createEmbeddedDocuments("JournalEntryPage", [{ name: p.name, type: "text", text: { content, format: 1 } }]); }
  }

  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply." : "APPLIED.";
  console.log(`[seed-trojan-dossier] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`Trojan dossier: ${banner} (see console)`);
})();

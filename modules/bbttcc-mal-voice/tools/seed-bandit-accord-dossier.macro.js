/* seed-bandit-accord-dossier.macro.js — Bandit Accord knowledge + swamp personas
 * (2026-07-13, spec: HEX-VIGNETTES-2026-07-08.md §3 + §6 doctrine; pairs with
 *  seed-bandit-accord.macro.js in bbttcc-campaign — run that one FIRST)
 *
 * Personas (found by name, skip-warn if unminted — re-run after minting):
 *   · Bandit Lord Osmund Cree — over-extended manager of the Drowned South
 *   · Lieutenant Perch — the envoy; courtesy as load-bearing structure
 *   · Gasket — reformed bandit mechanic at the Muster; the truck's witness
 *   · Brakk (append) — the second ledger column, REFORMED
 *   · Pike (append) — reads THIS signature carefully; he learned
 * Dossier ladder: rung pages + one commons page per summit door (@after the
 * outcome beat that actually fired — branched knowledge, house pattern).
 *
 * DRY_RUN default true; personas marker-guarded; pages skip-existing. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const ALLOW_OVERWRITE = false;
  const MODULE_ID = "bbttcc-mal-voice";
  const MARKER = "[BANDIT-ACCORD-2026-07-13]";
  const JOURNAL_NAME = "World Dossier";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const findActor = (cands) => {
    const want = cands.map(norm);
    return game.actors.find(a => want.includes(norm(a.name))) || null;
  };
  const lord   = findActor(["Bandit Lord Osmund Cree", "Osmund Cree", "Bandit Lord", "The Bandit Lord"]);
  const perch  = findActor(["Lieutenant Perch", "Perch"]);
  const gasket = findActor(["Gasket"]);
  const brakk  = findActor(["Ondine Brakk", "Captain Ondine Brakk", "Brakk"]);
  const pike   = findActor(["Pike", "Mayor Pike", "Elder Pike"]);

  const PERSONAS = [
    { actor: lord, who: "Bandit Lord (new)",
      topics: "the profession, the books, pensions, the summit, the program, the Drowned South, punts, tolls",
      notes: `${MARKER} PRIVATE TRUTH — Bandit Lord Osmund Cree, the Drowned South. Voice: unhurried bookkeeper's calm with swamp-dry humor; talks about banditry exclusively in the vocabulary of management (crews are 'staff', ambushes are 'collections', casualties are 'the bad column'). NOT evil — OVER-EXTENDED: inherited three crews, married into two more, and has been paying survivor pensions from a shrinking toll base for years; the books are real, meticulous, and slowly drowning him. HIS ECHO (tells if asked plainly, once): the night he understood the profession was finished wasn't a battle — it was a payroll. He sat in the stilt-hall with the pension ledger and realized the Drowned South's future was a program some out-of-towners were running out of a fire station, and what he felt wasn't anger. It was RELIEF, and the relief frightened him more than any raid ever had. ON THE PROGRAM: he tracks the Stewards' mercy count more accurately than they do — every spared crew, every bowl of soup, every reformed hire is a line in HIS books too, in a column he titled, privately, THE EXIT. GUARDS: never discusses camp positions or whistle-codes while the profession is live; won't badmouth his own people, even the splinter-minded ones ('every ledger has a bad column; you don't read it aloud'). TELLS: squares stacked items to true edges when the pension math comes up; says 'four hundred souls' never 'four hundred fighters'; laughs exactly once, quietly, when someone calls him a warlord.` },
    { actor: perch, who: "Lieutenant Perch (new)",
      topics: "the letter, the summit, the Bandit Lord, pensions, eel jerky, the white rag",
      notes: `${MARKER} PRIVATE TRUTH — Lieutenant Perch, envoy of the Drowned South. Voice: aggressively courteous, slightly too fast, the cadence of a man who has rehearsed every sentence twice on the punt ride over; salutes as involuntary reflex (the Muster, officers, one goat, historically). HIS SITUATION: nineteen years in the profession, four from pension, and he has watched the toll base shrink and the program grow and done the arithmetic every night since spring — his retirement now depends on a summit going well between people who ambushed each other for a living, which is why his courtesy has the load-bearing quality of a man carrying crockery across ice. HIS ECHO: he was in an ambush that yielded — hands up in the reeds, spear in the mud — and what he remembers isn't fear, it's the SOUP being real, and going back to camp unable to explain why that undid him. GUARDS: will not discuss camp positions, whistle-codes, or the Lord's books ('above my pay, and I'd like to keep the pay'). Always offers the eel jerky first; it is genuinely terrible; refusing it politely earns his eternal respect. TELLS: touches the waxed letter-pouch like a talisman even after the letter's delivered; when the summit's odds come up, recites his years-of-service like a rosary (nineteen, four to go).` },
    { actor: gasket, who: "Gasket (new)",
      topics: "the truck, the Muster, the intake desk, engines, the program, second chances",
      notes: `${MARKER} PRIVATE TRUTH — Gasket, reformed bandit, Muster mechanic (intake class two). Voice: quiet, precise, happiest with her hands inside something broken; answers direct questions directly (she learned that from the Captain and cites it as scripture). HER SECRET (never volunteers; yields only to someone who has PERSONALLY turned a wrench beside her): she looked at the Muster's famous non-running truck her second week, because of course she did — and found it BROKEN ON PURPOSE. Elegant, deniable, three small choices no honest wear could make together. She said nothing, and says nothing, because she watched Brakk drill farmers into a wall crew around that truck and understood: the militia needs a shared enemy that can't fight back, and the truck VOLUNTEERS. The Captain's reasons are visibly load-bearing; Gasket does not remove load-bearing members. If the secret is ever surfaced to Brakk, Gasket wants it on record that she thinks it's the best-maintained broken engine she's ever inspected. TELLS: pats the truck's fender when she passes, once, like a shared joke; goes conspicuously deaf when anyone proposes 'finally fixing' it.` },
    { actor: brakk, who: "Brakk (append)",
      topics: "the second column, reformed recruits, the intake desk, the sign, the queue",
      notes: `${MARKER} THE SECOND COLUMN — Captain Ondine Brakk, after the volunteers (speak of it only once the dossier shows the queue formed). Her ledger has a second column now, block capitals, REFORMED, and she'd deny to a tribunal that the lettering is proud. Facts she will state directly, per policy: the reformed recruits show up early, drill hard, and treat the wall like it's THEIR wall, which — she has checked the arithmetic on this — it now is. The queue outside the Muster formed on its own; the SIGN was hers, because an orderly queue is the difference between a program and a crowd. On the count itself: she knows the number the reeds know, because she counts too — it's a policy. TELLS: when a reformed recruit passes muster she notes it with exactly one nod more than a farmer gets, and if you point that out she cites drill-standards paragraph numbers that do not exist.` },
    { actor: pike, who: "Pike (append)",
      topics: "the Accord, signatures, terms, the summit",
      notes: `${MARKER} THE SIGNATURE — Pike, on the Accord (only if the summit has happened or is convening). Measured as ever: he wants the Accord IN WRITING, every term, and he reads THIS signature line by line, both hands flat on the table — because he signed something once on a handshake's momentum and paid for the lesson across years, and a man who learns is obliged to demonstrate it. He is not against the deal; he is against the UNREAD deal. If the terms are good he'll say so plainly and put his own name under them, legibly, with the date.` }
  ];

  const A = {
    word:     "beat:bandit_word_spreads",
    vols:     "beat:bandit_volunteers",
    accept:   "beat:bandit_arms_down_accept",
    violence: "beat:bandit_arms_down_violence",
    envoy:    "beat:bandit_envoy",
    accord:   "beat:bandit_summit_accord",
    absorb:   "beat:bandit_summit_absorption",
    humil:    "beat:bandit_summit_humiliation",
    refuse:   "beat:bandit_summit_refuse"
  };

  const PAGES = [
    { name: "The Stewards Take Prisoners. Alive Ones.", knownBy: "all", after: A.word, body:
      `That's the whole rumor, and it's carrying further than any threat ever did. Down the drowned causeways the punt crews trade it like contraband: stand down in front of the Stewards and you get a warning, sometimes pointers, occasionally soup. Nobody believes it the first time they hear it. Everybody repeats it anyway. A cleaned fish has appeared on a Steward waypost — the good kind — and in the Drowned South that is a formal document, notarized in mud.` },
    { name: "The Muster — Now Hiring (Reformed)", knownBy: "all", after: A.vols, body:
      `There is a QUEUE outside the Muster, and it is made of former bandits. They come at dawn with their boots scrubbed, and Captain Brakk — who saw it coming, because she counts everything — made a sign so the queue would be orderly, and it is. The fire station that was a social club is growing an intake desk. Her ledger has a second column now. Ask a reformed recruit why they came and you get versions of the same answer: the swamp does arithmetic too, and the program's numbers are better.` },
    { name: "Arms Down in the Reeds", knownBy: "all", after: A.accept, body:
      `It has started happening BEFORE the fight: ambushes that break off mid-spring, spears set down in the mud like borrowed tools being returned, hands rising reed-slow. 'We yield — is the program still open?' It was open. The word travels the channels faster than any punt: mercy, witnessed at spear-point, honored on the spot. In the stilt-camps the old hands have stopped arguing with the arithmetic and started asking practical questions about the soup.` },
    { name: "They Struck the Yielded", knownBy: "all", after: A.violence, body:
      `The reeds tell it with names in it now. An ambush yielded — hands up, spears down, the words said right — and the Stewards struck anyway. Whatever ledger of trust the program had been filling, a page tore out of it that day. The spared are still spared and the fed still fed, nobody unlearns a kindness — but the yielding has stopped, the whistle-codes have gone cold, and somewhere in the Drowned South a letter that was half-drafted has been put away in a drawer.` },
    { name: "The Envoy and the Eel Jerky", knownBy: "all", after: A.envoy, body:
      `A punt came up the channel under a white rag on a fishing pole, carrying one lieutenant of the Drowned South and a letter in a waxed eel-skin pouch. He saluted the Muster, several officers, and — witnesses are firm on this — a goat. The letter is from the Bandit Lord himself: a request for a summit, at a neutral stilt-hall, to discuss 'the future of the profession.' The lieutenant waited for the answer with his own rations so as not to impose, offering his eel jerky around with the doomed courtesy of a man whose pension is riding on the reply.` },
    { name: "The Bandit Accord", knownBy: "all", after: A.accord, body:
      `Signed at the stilt-hall with the whole swamp watching: amnesty for the program's graduates, safe-conduct on the causeways, the camps opened as waypoints — and the punts of the Drowned South, four hundred souls of them, flying ONE BANNER, allied, patrolling the water-roads they used to tax. The reed-whistles changed codes that night. The new one means 'friendly coming through,' and travelers report that hearing it does something complicated to the back of the neck. The toll-takers of the Drowned South work for the roads now. Both sides are still practicing saying it out loud.` },
    { name: "Stance — Relief on the Roads", knownBy: "all", after: A.accord, body:
      `Half the region exhaled at once. Teamsters who priced every southern run around a robbery line-item are re-doing sums in public and grinning at the results. The causeway markets are already busier; two ferry routes that died years ago are being talked back to life; and the first traveler escorted through the reeds by a POLITE bandit patrol described the experience as 'unsettling, then wonderful, then just wonderful.' The Drowned South, goes the new saying, is open for business — because the management changed sides.` },
    { name: "Stance — You ARMED Them?", knownBy: "all", after: A.accord, body:
      `The other half of the region is asking the question with the capital letters intact: the Stewards took four hundred professional ambushers, gave them amnesty, LEGITIMACY, and a banner, and pointed them at the roads — and everyone is supposed to feel SAFER? Every incident on a southern causeway for the next year, whoever's fault it is, will be laid at the Accord's door by somebody. And in the places where curated lies are bought and sold, somebody is already hawking a lurid version about an 'army of pardoned knives' to customers who were never going to read the terms anyway.` },
    { name: "The Muster Doubled", knownBy: "all", after: A.absorb, body:
      `No banner, no treaty — an intake schedule. The crews of the Drowned South came in over a season, punt by punt, through Brakk's desk and Brakk's sign, and the Muster is now the biggest thing Allesh-Gilliam has ever organized on purpose: full wall rotations, depth at every post, and a drill yard where reformed toll-takers teach farmers how ambushers think, which turns out to be excellent wall training. The Bandit Lord himself took his pension in the only currency he wanted — a settled retirement for his people — and runs the Good Vibes Club bar now, pouring measures with a bookkeeper's precision. The profession's stories are told there until closing. The profession itself is closed.` },
    { name: "No Seat at the Table", knownBy: "all", after: A.humil, body:
      `The surrender was taken. Nothing was given back — no seat, no terms, no banner. The ones who came in got the program's soup and the program's wall shifts, and are earnestly at work. But the swamp keeps a remainder: the crews that never trusted the count melted back into the reeds with everything they own, and the whistle-codes that used to mean 'toll ahead' mean something colder now. Travelers on the southern causeways are advised that the Drowned South's spare change went splinter — smaller crews, longer memories, and no letter coming this time.` },
    { name: "The Program Stays Closed (The Door Doesn't)", knownBy: "all", after: A.refuse, body:
      `The summit ended with the books closed and nothing signed. And yet nothing STOPPED: the volunteers keep coming, the queue keeps forming, the soup keeps being real, and the Drowned South's toll base keeps shrinking one surrendered punt at a time. The Bandit Lord thanked the Stewards on his way out — actually thanked them — which the stilt-camps have been chewing on ever since. The profession is still dying. It's just dying the long way now, without terms, which everyone involved agrees is somehow both kinder and sadder.` }
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
  console.log(`[seed-bandit-accord-dossier] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`Bandit Accord dossier: ${banner} (see console)`);
})();

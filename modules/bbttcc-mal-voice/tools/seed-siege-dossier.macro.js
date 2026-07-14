/* seed-siege-dossier.macro.js — The Fifteen-Year Siege: commanders + knowledge
 * (2026-07-13, spec: HEX-VIGNETTES-2026-07-08.md §2 + §6 doctrine; pairs with
 *  seed-fifteen-year-siege.macro.js in bbttcc-campaign — run that one FIRST)
 *
 * Personas (found by name, skip-warn if unminted — re-run after minting;
 * ALSO re-run the campaign seeder afterward to stamp speakerActorId):
 *   · Commander Ostrid Pell — the trench; the standing tea arrangement;
 *     the dried orange in the locked drawer (year zero — HE carried the
 *     basket to the gate; decision #6: the fruit-basket origin is REAL)
 *   · Warden Bee Alderwick — the wall; the same tea arrangement; her
 *     grandmother's ledger, final entry: "Better besieged than beholden."
 * Dossier: commons + the Year Zero rumor @after market day, one page per
 * door, and Siege Week @after the festival's first firing.
 *
 * DRY_RUN default true; personas marker-guarded; pages skip-existing. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const ALLOW_OVERWRITE = false;
  const MODULE_ID = "bbttcc-mal-voice";
  const MARKER = "[SIEGE-2026-07-13]";
  const JOURNAL_NAME = "World Dossier";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const findActor = (cands) => {
    const want = cands.map(norm);
    return game.actors.find(a => want.includes(norm(a.name))) || null;
  };
  const pell      = findActor(["Commander Ostrid Pell", "Ostrid Pell", "Commander Pell"]);
  const alderwick = findActor(["Warden Bee Alderwick", "Bee Alderwick", "Warden Alderwick"]);

  const PERSONAS = [
    { actor: pell, who: "Pell (new)",
      topics: "the trench, the school, market day, drainage, protocol, the demand (guarded), the tea (secret), year zero (deep secret)",
      notes: `${MARKER} PRIVATE TRUTH — Commander Ostrid Pell, the Besieger Camp. Voice: parade-ground correctness gone soft at the edges, like a uniform worn fifteen years; discusses trench drainage and the school rota with the pride other commanders save for victories, because they ARE his victories — nobody has died in his siege in eleven years and he knows the exact number of days. THE DEMAND: he does not remember it. This is the sentence he practices: 'the paperwork was lost in year three.' It is TRUE and it is also a mercy he has chosen to accept. When pressed, he rearranges his desk until the subject changes; if pressed with real kindness, he will admit the worse thing — he's not afraid of remembering. He's afraid it was SMALL. THE TEA (secret; yields to someone both commanders have come to trust, or to anyone who has clearly worked it out): every Thursday after market close, in the old culvert gate between the lines, he takes tea with Warden Alderwick. Fifteen years less two. They have never once discussed terms — that's the RULE; they discuss drainage, the children, the weather coming off the sea. Each believes the other would be ruined by exposure; each has kept the secret to protect the OTHER; neither has noticed this is the entire treaty already, unsigned. YEAR ZERO (the deep drawer — yields only after the tea is known, or to someone holding the other half of the story): as a junior officer, Pell himself carried the gift to the town gate. An enormous basket. Fruit, mostly — oranges from somewhere no orange should have survived — with paperwork tucked under the ribbon that he was ordered NOT to read. The Warden's grandmother refused delivery at the gate, on principle, and the siege began before the basket finished rotting. In his locked drawer: one orange from it, dried to the size and weight of a question, which he has kept for fifteen years and cannot explain. He never read the paperwork. He has spent fifteen years grateful he never read the paperwork. TELLS: checks the time before Thursdays like a man with an appointment he'd die before naming; touches the drawer key through his coat when year zero comes up; says 'the demand' never 'our demand.'` },
    { actor: alderwick, who: "Alderwick (new)",
      topics: "the wall, readiness, market day, the smoke, her grandmother, the demand (guarded), the tea (secret), the ledger (deep secret)",
      notes: `${MARKER} PRIVATE TRUTH — Warden Bee Alderwick, the Held Town. Voice: brisk inventory-cadence — she recites the wall's readiness like scripture because it IS scripture, the liturgy that's kept her town whole; drops into sudden dry warmth when children or preserves come up. She can read the besiegers' supper from their smoke and considers this a core competency of the wardenship. THE DEMAND: 'Lost in year three. Best thing that ever happened to this siege.' She will not elaborate — GUARD — because elaboration leads toward the ledger. THE TEA (secret; same conditions as Pell's — yields to earned trust or to someone who has plainly worked it out): Thursdays, after market close, the culvert gate, fifteen years less two. Her kettle. His biscuits, since the walkout year. The RULE is no terms — they have kept it absolutely, which is why it has worked absolutely. She believes exposure would end Pell's career and has protected him accordingly; it has not occurred to her to wonder what she has been protecting on her own side, because the answer is nothing — she'd survive it — and somewhere below thought she knows the secret is simply THEIRS, the one thing in fifteen years the siege never touched. THE LEDGER (the deep drawer — yields only after the tea is known, or to the holder of the other half): her grandmother was Warden in year zero. The day-ledger's final entry, in a hand pressed hard enough to tear: 'Refused the basket at the gate. Paperwork under the ribbon — GIFT-DEBT, the old kind, the kind you don't climb out of. Better besieged than beholden. —W.A.' Her grandmother READ the paperwork before refusing. She knew exactly what accepting would cost, chose the siege on purpose, and never told a soul why — the town thinks she refused out of pride, and loves her memory for it. Bee has known since she inherited the drawer. She has decided, every single morning since, that her grandmother was right. TELLS: her recitation of readiness acquires one extra, unlisted item when year zero comes up, and she moves past it without breathing; polishes the same teacup when nervous; the wall's morning shadow arrangement is not an accident and she will deny it serenely.` }
  ];

  const A = {
    market:  "beat:siege_market_day",
    brk:     "beat:siege_break",
    mediate: "beat:siege_mediate",
    join:    "beat:siege_join",
    charter: "beat:siege_charter",
    fest:    "beat:siege_festival"
  };

  const PAGES = [
    { name: "The Fifteen-Year Siege", knownBy: "all", after: A.market, body:
      `On the coast there is a siege old enough to have tenure. The besiegers' children were born in the trench and attend school in the counterweight tower; the trench lines have flowerbeds; and on alternating Thursdays the besieged run a farmers' market ON the wall, which the siege observes, because everyone observes market day — besiegers queue at the rope ladder, unarmed, with baskets, and get their hands stamped. Neither side remembers the original demand. The paperwork was lost in year three, and the coast's settled wisdom is that checking would be worse. It is the most stable place for forty miles. Nobody involved can afford to notice this out loud.` },
    { name: "Year Zero (A Rumor)", knownBy: "all", after: A.market, body:
      `Ask how it started and you get the same shrug from both sides of the wall — but buy a second round and you'll hear the rumor: it started with a FRUIT BASKET. An enormous one, delivered to the town gate with ceremony, refused at the gate on principle by the old Warden herself. Some say there was paperwork under the ribbon. Some say the paperwork is what got refused, and the fruit was innocent. Somewhere in the wall's older stonework, a scratched line of graffiti that predates the flowerbeds: BETTER BESIEGED THAN BEHOLDEN. Nobody living admits to knowing what it means. At least two people are lying about that.` },
    { name: "The Siege Is Over — Broken", knownBy: "all", after: A.brk, body:
      `Fifteen years of the coast's most carefully balanced institution came down in an afternoon, and the region cannot decide what it's mourning. Not the siege, exactly — sieges are bad, everyone agrees sieges are bad, this is definitely a victory for somebody — but market day is gone, the school in the counterweight tower is gone, and the trench flowerbeds went under in the assault. The trench children and the wall children no longer trade sweets. Travelers say the strangest thing about the hex now is the quiet on Thursdays. Both sides, asked about the outsiders who ended it, use the same word, and it is not a grateful one.` },
    { name: "The Treaty With a Market Clause", knownBy: "all", after: A.mediate, body:
      `Peace, actual peace, signed and witnessed — and the first clause, insisted upon by BOTH delegations before terms were even opened, preserves market day in perpetuity, exactly as practiced. The rest is grace notes: the trench filled in stages, the flowerbeds transplanted with honors, the school rehoused with its bell. At the exchange of instruments both commanders wept in full view of both formations, and both formations pretended not to notice, which observers agree was the most united the two sides have ever looked. The mediators' names are traveling up and down the coast attached to the phrase 'the ones who ended the Fifteen-Year Siege without breaking anything.'` },
    { name: "New Banners in an Old Trench", knownBy: "all", after: A.join, body:
      `The Fifteen-Year Siege has admitted new members. A coalition banner flies over the old earthworks now, and the coast is frankly delighted — not because it changes anything, but because it confirms what everyone suspected: the siege doesn't end, it RECRUITS. The newcomers have reportedly been briefed on the market truce, the school bell precedence, and the Thursday rotations, and are said to be adjusting. The other side has already recalibrated its supper schedule. The institution absorbs all things, politely, on schedule.` },
    { name: "The Chartered Siege", knownBy: "all", after: A.charter, body:
      `It is official, notarized, and utterly without precedent: the Fifteen-Year Siege is a PROTECTED CULTURAL INSTITUTION, conducted ceremonially for one week a year — historical costume, refereed engagements, competitive pumpkin mangonelry, closing feast on the wall. The rest of the year the trench is a garden and the tower is just a school. Nobody surrendered; nobody won; both sides kept the routine, which the coast has finally said out loud was the point all along. And on the Thursday after the signing, Commander Pell and Warden Alderwick took tea TOGETHER, IN PUBLIC, on the wall — and the entire coast pretended, with heroic discipline, that it wasn't the biggest news of the decade.` },
    { name: "Siege Week", knownBy: "all", after: A.fest, body:
      `The banners are up again: SIEGE WEEK, the coast's strangest and best-attended festival. Heritage volunteers man the trench in period costume; the mangonels throw pumpkins, competitively, with referees and a protest committee; the school bell calls hostilities to lunch. The commanders preside jointly from the wall, bickering with the timing of a double act that has stopped pretending otherwise. Attendance grows every year. The closing feast is on Thursday. It is always on Thursday.` }
  ];

  const report = [];
  for (const p of PERSONAS) {
    if (!p.actor) { report.push(`⚠ persona skipped — ${p.who} not found (mint the actor, re-run; then re-run the campaign seeder to stamp speakers)`); continue; }
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
  console.log(`[seed-siege-dossier] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`Siege dossier: ${banner} (see console)`);
})();

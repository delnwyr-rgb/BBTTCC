/* seed-cadence-dossier.macro.js — The Cadence: personas + knowledge ladder
 * (2026-07-13, spec: HEX-VIGNETTES-2026-07-08.md §1 + §6 doctrine; pairs with
 *  seed-cadence.macro.js in bbttcc-campaign — run that one FIRST)
 *
 * Personas (found by name, skip-warn if unminted — re-run after minting):
 *   · Maestra Velvetine Marr — the Cadence's leader; rhythm as jurisprudence
 *   · Tempo — the herald; delivers the declarations, speaks in 4/4
 * Dossier: commons intro @after the declaration + one page per outcome
 * (@after the beat that actually fired — branched knowledge, house pattern).
 *
 * DRY_RUN default true; personas marker-guarded; pages skip-existing. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const ALLOW_OVERWRITE = false;
  const MODULE_ID = "bbttcc-mal-voice";
  const MARKER = "[CADENCE-2026-07-13]";
  const JOURNAL_NAME = "World Dossier";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const findActor = (cands) => {
    const want = cands.map(norm);
    return game.actors.find(a => want.includes(norm(a.name))) || null;
  };
  const maestra = findActor(["Maestra Velvetine Marr", "Velvetine Marr", "The Maestra", "Maestra"]);
  const tempo   = findActor(["Tempo"]);

  const PERSONAS = [
    { actor: maestra, who: "Maestra (new)",
      topics: "the floor, the declaration, rhythm, face, the crew, the four figures, respect, the next target (guarded)",
      notes: `${MARKER} PRIVATE TRUTH — Maestra Velvetine Marr, of the Cadence. Voice: warm, unhurried command; discusses dance exclusively in the vocabulary of siegecraft (a routine is 'an assault', a good crowd is 'favorable terrain', applause is 'terms'). Her crew has never thrown a punch, and she enforces this the way other commanders enforce discipline under fire — because it IS the discipline: the moment steel appears, the Cadence has lost, whatever happens next. HER ECHO (tells it plainly if asked with genuine curiosity, once): she was a war-drummer, years back, keeping time for a column of soldiers — good ones, brave ones — and somewhere on the third day of a siege she noticed that EVERYONE, both walls, was moving to her drum. The blades were incidental. The drum was the army. She walked out of that war with the drum and has been winning territory that rebuilds overnight — face, regard, the story a hex tells about itself — ever since. ON WINNING UGLY (if anyone ever strikes her dancers): she does not retaliate; she WITHDRAWS, in formation, in silence, and lets the region do the rest — 'the silence is the encore.' GUARDS: never names the next target ('the card arrives when the card arrives'); never mocks a graceful loser — grace is the currency her whole economy runs on, and debasing it is the one sin she recognizes. ON THE CAMEO (if respect is owed): she treats the owed raid as a debt of honor, priced exactly: one engagement, full crew, their side of the floor — and she hopes, sincerely, that someone earns it twice. TELLS: counts anything she's assessing in fours under her breath; when moved, she stops keeping time entirely, which her crew regards with the alarm other units reserve for incoming fire.` },
    { actor: tempo, who: "Tempo (new)",
      topics: "the declaration, the card, the count, the program, the viewing mound, refreshments",
      notes: `${MARKER} PRIVATE TRUTH — Tempo, herald of the Cadence. Voice: everything in even four-beat phrases — announcements, answers, condolences; if a sentence comes out in three, they append a small 'hm' to square the bar, and they do not know they do this. Delivers the declarations personally, on foot, unarmed, in full sequin — has walked into hexes mid-alarm, handed the card to the person holding the biggest weapon, complimented the fortifications, and left. HAS NEVER BEEN HARMED doing this, a statistic they attribute to 'good tailoring.' THE CARDS: Tempo letters every one by hand and considers a refused card the saddest object in the world — they leave it anyway ('the invitation stands; paper is patient'). HIS PRIDE: the border performances. Programming for an audience that is pretending not to watch is, per Tempo, 'the purest form in the repertoire.' GUARDS: will not discuss the Maestra's drummer years (that story is hers, told once, at her tempo); will not reveal the next figure before it premieres. TELLS: applauds — genuinely, warmly, twice — when someone lands a good comeback in conversation; keeps unconscious 4/4 time on the nearest surface when nervous, which functionally means Tempo is a metronome you can interrogate.` }
  ];

  const A = {
    decl:   "beat:cadence_declaration",
    style:  "beat:cadence_win_style",
    ugly:   "beat:cadence_win_ugly",
    lose:   "beat:cadence_lose",
    refuse: "beat:cadence_refuse",
    cameo:  "beat:cadence_cameo_spent"
  };

  const PAGES = [
    { name: "The Cadence", knownBy: "all", after: A.decl, body:
      `A crew that raids hexes CULTURALLY: they roll up with speakers, sequins, and a formal declaration of rhythm on excellent cardstock, and the fight — their word is 'program' — happens on a dance floor they build in an hour. Losing to them costs face, not walls: a story that travels to every neighboring hex, told at your expense, in perfect time. Every account agrees on the load-bearing fact: they have never thrown a punch. They have never needed to. The card is always scented. The scent is confidence.` },
    { name: "Out-Danced, With Style", knownBy: "all", after: A.style, body:
      `It went around the region faster than any battle report: somebody met the Cadence on the floor and OUT-DANCED them — with style, which is the only axis they score. The Maestra called the floor herself, which her own crew says has happened four times in living memory, and presented the crew's respect on cardstock like terms of surrender. The respect is not a figure of speech. It is a standing instrument: one raid, whenever it's called, with the Cadence dancing on the winners' side. Neighboring hexes have begun, quietly, practicing.` },
    { name: "They Shot the Dancers", knownBy: "all", after: A.ugly, body:
      `The story reached every adjacent hex before the bruises rose, and it has exactly one shape no matter who tells it: the Cadence came with speakers, and someone answered with steel. The crew withdrew in formation, wounded carried, without one word — and that silence is doing more damage than any counter-raid could. Deals in the neighborhood have gotten stiffer; doors that used to open on a knock now open on a chain. Nobody disputes who holds the hex. Everybody remembers who held the floor.` },
    { name: "Tribute on Cardstock", knownBy: "all", after: A.lose, body:
      `The terms arrived the morning after, hand-lettered: tribute in culture marks — modest, ceremonial, and somehow still stinging — and a standing rematch, renewed each turn with a fresh card, because the Cadence considers a graceful loser unfinished business of the best kind. The region's verdict on the losers has been unexpectedly warm: they finished the set, held the routine, and bowed. The Maestra bowed BACK, deeper than she had to. People who saw it keep mentioning it. That bow is doing quiet work.` },
    { name: "The Performance at the Border", knownBy: "all", after: A.refuse, body:
      `The challenge was refused, so the Cadence set up EXACTLY one pace outside the border — measured, surveyed, indisputable — and began to perform. They perform at shift change, at dusk, and (devastatingly) at breakfast. Attendance from surrounding hexes grows weekly; there are refreshments now; the viewing mound has developed infrastructure. Until somebody answers on the floor, the hex is what every road in the region calls it: Out-Danced, Uncontested. The sentries have started tapping their feet. It is a siege, and the ammunition is embarrassment.` },
    { name: "One Raid, With Sequins", knownBy: "all", after: A.cameo, body:
      `The favor was called in, and the region is still talking about it: the Cadence, on SOMEBODY'S SIDE for once, arriving on the flank in formation with the speakers already warm. Veterans of the engagement describe an assault conducted at 124 beats per minute — morale arriving like weather, an enemy line that could not decide whether it was being attacked or invited, and a finale nobody present will agree to describe the same way twice. The respect is spent now; the books are square. The Maestra was heard to say she hopes somebody earns it again. She sounded like she meant it.` }
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
  console.log(`[seed-cadence-dossier] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`Cadence dossier: ${banner} (see console)`);
})();

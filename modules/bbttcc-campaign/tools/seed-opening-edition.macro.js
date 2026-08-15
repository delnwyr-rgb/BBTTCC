/* seed-opening-edition.macro.js — the day-one word going round (2026-08-14)
 *
 * Writes "Word Going Round — Opening" into The Turn Press journal: what folk
 * were saying in the River Heart BEFORE the Stewards did anything. This is
 * the tabula-rasa baseline for world-aware NPCs — the ordinary season the
 * campaign interrupts.
 *
 * The page sits OUTSIDE the press's "Word Going Round — Turn N" pattern, so
 * neither the per-turn prune nor the Reset Console's un-print can remove it,
 * and it sorts after every turn edition so NPCs read it as the oldest talk
 * in the room.
 *
 * WRITING RULES baked into these lines (keep them if you edit):
 *   · Folk register — what a neighbor repeats, not what a GM knows.
 *   · No numbers, no game constructs, no beat/quest names.
 *   · No plot. This is mood and geography, the state of an ordinary season.
 *   · Monodynamic / Mr. Monocle are NEVER named in current content.
 *   · The north-woods line is deliberately forgettable — rung-zero Wendigo.
 *
 * ALLOW_OVERWRITE=false skips an existing page (safe re-run). Set it true
 * after editing the prose below to push your rewrite. Run as GM.
 */
(async () => {
  const ALLOW_OVERWRITE = false;

  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const digest = game.bbttcc?.api?.campaign?.digest;
  const JOURNAL = (() => {
    try { return digest?.journalName?.() || String(game.settings.get("bbttcc-mal-voice", "npcWorldDigestJournal") || "").trim() || "The Turn Press"; }
    catch (_e) { return "The Turn Press"; }
  })();
  const PAGE = digest?.opening?.name ?? "Word Going Round — Opening";
  const SORT = digest?.opening?.sort ?? 1000000;

  const LINES = [
    `The Order's newcomers finally came down the river road — four banners' worth, vouched for by Avuncular Joans her own self. Everybody's got an opinion about them already and nobody's got a fact yet.`,

    `Word is they've come for the Great Work, same as the last lot who said so. The Heart's heard promises before. It'll believe hands.`,

    `The Odaroloc's running to its own mind again this season. The folk who claim to read the river disagree loud about what that means, which is how you know none of them can.`,

    `Allesh-Gilliam's market is thin but honest — you'll find what you need and pay a little more than you meant to. Everything in the Heart routes through there eventually, gossip included.`,

    `Khezek Tor is complaining about its freight again. Something always waits too long in those warehouses, and somebody always writes it down and shows you the page.`,

    `The ore's still coming up out of the Tor, and the smiths take it grateful and watch it careful. Nobody's forgotten what yesodium does when it gets tired of being a blade.`,

    `Jackalope routes are running fine, and Furrier's Fixit Farm keeps its Ledger the way it always has. Deal fair at the Counter and the family remembers. Deal poorly and the family remembers that too.`,

    `West past the good grass the Barrens start, and out there nothing's yours for long. The toll gangs aren't cruel exactly — they're just certain, and lately they're certain about your wagon.`,

    `The Cadence rides its own circuit and collects what it reckons it's owed. You're free to argue the point. People have.`,

    `Don't take the Polygon Forests for a shortcut. Maps go to guesses in there, and folk come out agreeing on nothing, including how long they were gone.`,

    `Probably Beaumont still looks like a city from every road in. It isn't one, and the ones who went anyway don't care to be asked about it.`,

    `Lyrenn stays quiet, and an argument carried there tends to come out softer than it went in. Some folk find that restful. Some find it unnerving.`,

    `A hunter up north lost a dog and swore it was something bigger than a cat. Folk bought him a drink and let it go. That's the north woods for you — always a story, never a thing.`,

    `Taken all together: hard country having an ordinary season, waiting to see what four new banners actually do about it.`
  ];

  const content = LINES.map(l => `<p>${l}</p>`).join("\n");

  let journal = game.journal.getName(JOURNAL) || game.journal.contents.find(j => j.name === JOURNAL);
  if (!journal) {
    journal = await JournalEntry.create({ name: JOURNAL });
    console.log(`[seed-opening-edition] created journal "${JOURNAL}"`);
  }

  const existing = journal.pages?.contents?.find(p => p.name === PAGE);
  if (existing && !ALLOW_OVERWRITE) {
    ui.notifications.warn(`"${PAGE}" already exists — set ALLOW_OVERWRITE = true to replace it.`);
    return;
  }

  if (existing) {
    await existing.update({ "text.content": content, "text.format": 1, sort: SORT });
    console.log(`[seed-opening-edition] UPDATED "${PAGE}" (${LINES.length} lines, ${content.length} chars)`);
    ui.notifications.info(`Opening edition rewritten (${LINES.length} lines). Next NPC line picks it up.`);
  } else {
    await journal.createEmbeddedDocuments("JournalEntryPage", [
      { name: PAGE, type: "text", sort: SORT, text: { content, format: 1 } }
    ]);
    console.log(`[seed-opening-edition] CREATED "${PAGE}" in "${JOURNAL}" (${LINES.length} lines, ${content.length} chars)`);
    ui.notifications.info(`Opening edition seeded into "${JOURNAL}". Greet any NPC and ask what's the news.`);
  }
})();

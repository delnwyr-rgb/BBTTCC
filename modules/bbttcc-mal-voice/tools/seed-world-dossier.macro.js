/* seed-world-dossier.macro.js — World Dossier bootstrap (Mara→Dougan prototype)
 *
 * Creates the "World Dossier" journal and its first entity pages. A dossier
 * page is any journal text page whose FIRST line(s) carry:
 *
 *   @knownBy: <who>, <who>, …   who knows this page (actor name, actor id,
 *                               faction:<name-or-id>, or all)
 *   @after: <questId>[:completed]   optional — the fact only enters an NPC's
 *                                   knowledge once the story arrives
 *
 * Listed NPCs receive the page WHOLE in their dialogue prompt (section
 * "PEOPLE & PLACES YOU KNOW") — deterministic curated knowledge, no keyword
 * luck. The page's subject knows their own page implicitly (page name ==
 * actor name). Pages are drafts: edit freely in the journal editor, reopen
 * any open dialogue windows to pick changes up.
 *
 * DRY_RUN default true. Idempotent: existing pages are left untouched.
 * Run as GM (paste into a script macro or the console).
 */
(async () => {
  const DRY_RUN = false;   // set false to write

  const JOURNAL_NAME = "World Dossier";

  // NOTE the "\n" between paragraphs — it guarantees the tag line parses as
  // its own line after HTML stripping, whatever the editor does later.
  const PAGES = [
    {
      name: "Dougan Marsh",
      content:
        "<p>@knownBy: Mara Quickhands, faction:Jackalopes</p>\n" +
        "<p>Dougan Marsh runs the Gullywasher. He is a Chupacabra — and an outlier among his kind: " +
        "a genuinely decent sort who gets along with just about everybody, which is not what most " +
        "folks brace for when a Chupacabra walks in. Fair company, fair dealing, slow to anger.</p>"
    },
    {
      name: "The Gullywasher",
      content:
        "<p>@knownBy: all</p>\n" +
        "<p>The Gullywasher is the establishment Dougan Marsh runs.</p>\n" +
        "<p><em>(GM: enrich me — what it is, where it sits, what it's known for.)</em></p>"
    }
  ];

  if (!game.user.isGM) return ui.notifications.error("GM only.");

  let journal = game.journal.getName(JOURNAL_NAME)
    || game.journal.contents.find(j => j.name === JOURNAL_NAME);

  const report = [];
  if (!journal) {
    report.push(`journal "${JOURNAL_NAME}": CREATE`);
    if (!DRY_RUN) journal = await JournalEntry.create({ name: JOURNAL_NAME });
  } else {
    report.push(`journal "${JOURNAL_NAME}": exists`);
  }

  for (const p of PAGES) {
    const existing = journal?.pages?.contents?.find(pg => pg.name === p.name);
    if (existing) { report.push(`page "${p.name}": exists — SKIPPED (edit it in the journal)`); continue; }
    report.push(`page "${p.name}": CREATE`);
    if (!DRY_RUN && journal) {
      await journal.createEmbeddedDocuments("JournalEntryPage", [{
        name: p.name,
        type: "text",
        text: { content: p.content, format: 1 }   // 1 = HTML
      }]);
    }
  }

  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply." : "APPLIED.";
  console.log(`[seed-world-dossier] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`World Dossier seeder: ${banner} (${report.length} items — see console)`);

  if (!DRY_RUN) {
    console.log("[seed-world-dossier] Validate: hover Mara's token → Y → ask \"Who's Dougan?\" — " +
      "console should log a non-zero dossier char count for her window.");
  }
})();

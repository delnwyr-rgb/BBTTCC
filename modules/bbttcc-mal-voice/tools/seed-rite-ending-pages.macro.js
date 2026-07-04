/* seed-rite-ending-pages.macro.js — branched community knowledge via beat gates
 *
 * Uses the quest-beat scaffolding as the RECORD: when a Weeping Prisoner
 * outcome beat fires (any surface), it lands in storyStateFor.firedBeatIds —
 * and these World Dossier pages gate on exactly that (`@after: beat:<id>`,
 * engine support deployed 2026-07-03). Author one page per ending; ONLY the
 * ending that actually happened lights up, for the WHOLE family, unprompted.
 * This is the general pattern for programming NPC responses to branched
 * outcomes — no new state stores, just beats + pages.
 *
 * DRY_RUN default true; existing pages skipped unless ALLOW_OVERWRITE.
 * Run as GM. Reopen NPC dialogue windows after the outcome fires.
 */
(async () => {
  const DRY_RUN = false;
  const ALLOW_OVERWRITE = false;
  const JOURNAL_NAME = "World Dossier";

  const PAGES = [
    { name: "The Rite of the Weeping Prisoner — Mercy",
      knownBy: "faction:The Jackalopes", after: "beat:fixit_weeping_prisoner_mercy", body:
      `The newcomers passed the rite. Put to the question over the "thief" in the back room, they chose mercy with the debt still owed — no walking free, but no breaking him either; he works it off and it goes in the Ledger. Miliard slipped his bonds grinning and collected five beers off Dougan for the performance. Word went round the family the same night: these ones can hold justice and mercy in the same hand without dropping either. Furrier will hear of it, and the Ledger says they're worth trusting.` },
    { name: "The Rite of the Weeping Prisoner — Justice",
      knownBy: "faction:The Jackalopes", after: "beat:fixit_weeping_prisoner_justice", body:
      `The newcomers passed the rite. Put to the question over the "thief" in the back room, they drew a clean line: the debt named, judged fair, and paid in full measure — no cruelty in it, and no softness either. Miliard slipped his bonds grinning and collected five beers off Dougan for the performance. Word went round the family the same night: these ones judge straight and don't flinch. The family respects a clean line, and the Ledger says so.` },
    { name: "The Rite of the Weeping Prisoner — Punishment",
      knownBy: "faction:The Jackalopes", after: "beat:fixit_weeping_prisoner_punishment", body:
      `The newcomers went through the rite. Put to the question over the "thief" in the back room, they came down hard — punishment past the weight of the debt. Miliard slipped his bonds (a touch less cheerfully than usual) and still collected his five beers off Dougan. Word went round the family the same night: these ones reach for the rod first. The family deals with them politely, carefully, and with the count kept — that goes in the Ledger too.` },
    { name: "The Rite of the Weeping Prisoner — Not Our Problem",
      knownBy: "faction:The Jackalopes", after: "beat:fixit_weeping_prisoner_not_our_problem", body:
      `The newcomers went through the rite. Put to the question over the "thief" in the back room, they declined to judge at all — not their people, not their problem. Miliard slipped his bonds and collected his five beers off Dougan, though the performance went unreviewed. Word went round the family the same night: these ones keep their hands clean and their distance. Fair enough — but trust runs shallower for it, and the Ledger notes what wasn't done as surely as what was.` }
  ];

  if (!game.user.isGM) return ui.notifications.error("GM only.");
  let journal = game.journal.getName(JOURNAL_NAME) || game.journal.contents.find(j => j.name === JOURNAL_NAME);
  const report = [];
  if (!journal) {
    report.push(`journal "${JOURNAL_NAME}": CREATE`);
    if (!DRY_RUN) journal = await JournalEntry.create({ name: JOURNAL_NAME });
  } else report.push(`journal "${JOURNAL_NAME}": exists`);

  for (const p of PAGES) {
    const existing = journal?.pages?.contents?.find(pg => pg.name === p.name);
    const content = `<p>@knownBy: ${p.knownBy}</p>\n<p>@after: ${p.after}</p>\n<p>${p.body}</p>`;
    if (existing && !ALLOW_OVERWRITE) { report.push(`page "${p.name}": exists — SKIPPED`); continue; }
    if (existing) { report.push(`page "${p.name}": UPDATE`); if (!DRY_RUN) await existing.update({ "text.content": content, "text.format": 1 }); }
    else { report.push(`page "${p.name}": CREATE`); if (!DRY_RUN && journal) await journal.createEmbeddedDocuments("JournalEntryPage", [{ name: p.name, type: "text", text: { content, format: 1 } }]); }
  }

  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply." : "APPLIED.";
  console.log(`[seed-rite-ending-pages] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`Rite ending pages: ${banner} (see console)`);
})();

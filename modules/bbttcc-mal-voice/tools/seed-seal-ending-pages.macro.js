/* seed-seal-ending-pages.macro.js — the Valhaulan Seal's ending goes public (2026-07-04)
 *
 * Seal ↔ Triangle tie-in (owner-locked): the Seal's three endings are branched
 * community knowledge — one World Dossier page per ending, gated `@after:
 * beat:<outcome id>`, `@knownBy: all` (region-wide; the coast talks). Only the
 * ending that actually fired lights up, for every NPC, unprompted. Companion to
 * bbttcc-campaign/tools/seed-category-b.macro.js (chapel gate + seal_break
 * rewrite live there).
 *
 * DRY_RUN default true; existing pages skipped unless ALLOW_OVERWRITE. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const ALLOW_OVERWRITE = false;
  const JOURNAL_NAME = "World Dossier";

  const PAGES = [
    { name: "The Valhaulan Seal — Khezek Keeps the Burden",
      knownBy: "all", after: "beat:khezek_tor_the_vaulhaulan_seal_restore", body:
      `The Stewards went down to the old Valhaulan seal at Khezek Tor and came back up having FIXED it, which nobody does. Khezek Tor keeps carrying the weight, on purpose, with witnesses this time. Folk along the coast sleep better knowing the old thing is held by choice instead of habit. The mountain doesn't sleep better, but it wasn't going to anyway.` },
    { name: "The Valhaulan Seal — Somebody Pays",
      knownBy: "all", after: "beat:khezek_tor_the_vaulhaulan_seal_redirect", body:
      `The Stewards rerouted the old Valhaulan seal's burden at Khezek Tor. It goes SOMEWHERE now. Everyone on the coast did the same arithmetic at the same time: somewhere has an address. The whole region is watching the horizon and being very polite to strangers, in case it's them next. Khezek Tor, for its part, stands noticeably straighter.` },
    { name: "The Valhaulan Seal — The Heading Is Lit",
      knownBy: "all", after: "beat:khezek_tor_the_vaulhaulan_seal_break", body:
      `The seal at Khezek Tor is BROKEN and whatever it held is moving coastward. The survey stations — chapel, flats, mire, anchor — all shake in agreement, pointing down the same line. Folk who run the old roads have suddenly become religious about schedules, and the word "Valhaulan" has stopped being a history word. Khezek Tor held, barely, loudly, and is keeping the invoice.` }
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
  console.log(`[seed-seal-ending-pages] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`Seal ending pages: ${banner} (see console)`);
})();

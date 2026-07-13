/* seed-garden-dossier.macro.js — Founders' Garden knowledge payoffs
 * (2026-07-13, canon: FOUNDERS-GARDEN-CANON-2026-07-11.md)
 *
 * When the count lands (founders_garden_the_count), every witness who has
 * been carrying a piece of the statue mystery gets their payoff page:
 * Sable (the chart says 100, the ground says 99 — the gap is the new
 * obsession), Verna (the two unreadable names, compared at last), Rowan
 * (the kneeler explained), Etta (Menhirkin vindicated). Plus Garden commons
 * (wonder + count tiers) and persona appends for Sable + Verna.
 *
 * DRY_RUN default true; personas marker-guarded append; pages skip-existing.
 * Run AFTER seed-founders-garden (campaign). Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const ALLOW_OVERWRITE = false;
  const MODULE_ID = "bbttcc-mal-voice";
  const MARKER = "[GARDEN-2026-07-13]";
  const JOURNAL_NAME = "World Dossier";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const findActor = (cands) => {
    const want = cands.map(norm);
    return game.actors.find(a => want.includes(norm(a.name))) || null;
  };
  const sable = findActor(["Sable Nine", "Sable 9"]);
  const verna = findActor(["Verna Tulliver", "Verna"]);

  const PERSONAS = [
    { actor: sable, who: "Sable (append)",
      topics: "the Founders' Garden, the six points, the count, the gap, the Static Coast",
      notes: `${MARKER} THE COUNT LANDED — Sable Nine, after the Garden (speak of this only once the dossier shows the count happened). Verification came back: the fixed points ARE figures, a whole garden of them on the Static Coast, and Sable was right to never say 'statues' until it was twice-witnessed. But the arithmetic broke something better than a theory: the chart tradition says one hundred; the honest count says NINETY-NINE. Sable's new obsession is THE GAP — a fixed point that MOVED is a contradiction in Sable's entire cosmology, and contradictions are how the world tells you where to dig. They have started a new chart with a single mark on it and no scale, and they re-pin it every morning even though nothing is on it yet. If asked what it's a chart OF: 'the walking speed of stone. I only have one data point. It's enough to know the line isn't flat.' TELLS: says 'ninety-nine' the way other people say a dead friend's name.` },
    { actor: verna, who: "Verna (append)",
      topics: "the Ninth Guest, the ledger, the Vacancy, the unreadable page, the Founders' Garden",
      notes: `${MARKER} THE TWO NAMES — Verna Tulliver, after the Garden count reaches her (the dossier will say). She has finally done, aloud, the comparison she's been doing silently for years: the Vacancy's ledger holds TWO names she cannot read — the pilgrim who paid exact and kept vigil (that one resolved; wax and tallow, a courier, mundane) and the OTHER one. The ninth guest. The one the sign counts and the beds never hold. Stone doesn't sleep. Verna has started leaving that room made up — clean sheets, water on the stand, curtains at the angle a person facing the SEA would want — and she writes 'occupied' in the ledger herself now, in her own hand, every night. If asked why: 'because the sign is never wrong, and because whoever walks that long deserves a room that expected them.' GUARDS: she will not show the unreadable page to anyone who asks to SEE it; she'll show it to anyone who asks what it FEELS like. TELLS: counts to ninety-nine when she's stress-counting now, never a hundred; stops.` }
  ];

  const A = {
    wonder: "beat:founders_garden_wonder",
    count: "beat:founders_garden_the_count",
    plinth: "beat:founders_garden_the_plinth"
  };

  const PAGES = [
    { name: "The Founders' Garden", knownBy: "all", after: A.wonder, body:
      `It's real. Past the Hexen Myre, on the last land of the Static Coast, the old attraction stands exactly where the dead advertisement said: figures in ranks that aren't quite ranks, facing the sea like a duty. The re-set sign still promises one hundred figures in living stone. The quiet there isn't empty — it's occupied. Travelers who've stood among them agree on two things: the faces look like they know you came, and nobody stays past dusk, not because anything happens, but because it feels like talking in someone else's church.` },
    { name: "The Garden — Ninety-Nine", knownBy: "all", after: A.count, body:
      `Whoever finally counted did it three times, in daylight, with witnesses. The sign says one hundred. The count says ninety-nine. There is a bare plinth in the second rank, worn in the shape of two feet, and footprints in the grass older than any road — walking away, inland. One of them is loose in the world, and has been for a long time. The garrison keeps its silence about it. It is, unmistakably, the silence of ninety-nine not talking about something.` },
    { name: "Sable — The Line Isn't Flat", knownBy: "Sable Nine", after: A.count, body:
      `The six points were pickets. The chart was right; the guard was right; verification is sacred and it PAID. But the count broke the one law Sable's whole practice stands on: fixed points don't move — and one did. Sable has opened a new chart with a single mark and no scale, title in a steady hand: THE WALKING SPEED OF STONE. One data point. Enough to know the line isn't flat.` },
    { name: "Verna — The Room Stays Made", knownBy: "Verna Tulliver", after: A.count, body:
      `Word of the count reached the Vacancy and Verna closed the office door for one full minute, which regulars agree has never happened. Since then the ninth room stays made up — clean sheets, water, curtains set for someone who'd want to see the water — and the ledger says 'occupied' in Verna's own hand, nightly. The sign was never wrong. It was never counting guests. It was counting the one who hasn't checked in YET.` },
    { name: "Rowan — The Kneeler, Explained", knownBy: "Rowan of the Loam", after: A.count, body:
      `The news from the coast made it to Lyrenn, and Rowan went out to the kneeling figure with a lantern and stood there a long time. The soil around it never stopped talking — it's been ON DUTY. A picket, holding a small seam quiet, all this time, in a field where people plant beans. Rowan leaves the sprout reports at its feet now. Not because anyone asked. Because a guard on a long watch deserves the news.` },
    { name: "Etta — Kin, Confirmed", knownBy: "Etta Bloom", after: A.count, body:
      `Etta heard 'ninety-nine' and nodded like a woman having a suspicion notarized. Menhirkin — buried mistakes are kin. She'd said it for years and been filed under 'Etta being Etta.' Now: a hundred volunteers holding what the world got wrong, and one of the family gone walking. Her only comment, delivered while adjusting inventory for two: 'Kin come home eventually. Or they send word. Watch the roads either way.'` }
  ];

  const report = [];
  for (const p of PERSONAS) {
    if (!p.actor) { report.push(`⚠ persona skipped — ${p.who} not found`); continue; }
    const cur = p.actor.getFlag(MODULE_ID, "persona") || {};
    if (String(cur.notes || "").includes(MARKER)) { report.push(`· ok (already) ${p.actor.name}`); continue; }
    const topics = [String(cur.topics || "").trim(), p.topics].filter(Boolean).join(", ");
    const notes = [String(cur.notes || "").trim(), p.notes].filter(Boolean).join("\n\n");
    report.push(`✚ persona append → ${p.actor.name}`);
    if (!DRY_RUN) await p.actor.setFlag(MODULE_ID, "persona", { topics, notes });
  }

  let journal = game.journal.getName(JOURNAL_NAME) || game.journal.contents.find(j => j.name === JOURNAL_NAME);
  if (!journal) { report.push(`journal "${JOURNAL_NAME}": CREATE`); if (!DRY_RUN) journal = await JournalEntry.create({ name: JOURNAL_NAME }); }
  for (const p of PAGES) {
    const existing = journal?.pages?.contents?.find(pg => pg.name === p.name);
    const head = [`<p>@knownBy: ${p.knownBy}</p>`];
    if (p.after) head.push(`<p>@after: ${p.after}</p>`);
    const content = head.join("\n") + `\n<p>${p.body}</p>`;
    if (existing && !ALLOW_OVERWRITE) { report.push(`page "${p.name}": exists — SKIPPED`); continue; }
    if (existing) { report.push(`page "${p.name}": UPDATE`); if (!DRY_RUN) await existing.update({ "text.content": content, "text.format": 1 }); }
    else { report.push(`page "${p.name}": CREATE`); if (!DRY_RUN && journal) await journal.createEmbeddedDocuments("JournalEntryPage", [{ name: p.name, type: "text", text: { content, format: 1 } }]); }
  }

  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply." : "APPLIED.";
  console.log(`[seed-garden-dossier] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`Garden dossier: ${banner} (see console)`);
})();

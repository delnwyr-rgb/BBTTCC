/* patch-tamsin-confessor.macro.js — Tamsin's PRIVATE TRUTH + confessor pages (2026-07-05)
 *
 * The deception lives in persona.notes (never quoted, always guarding); the
 * public dossier keeps believing what the town believes. Also seeds: Verna's
 * pilgrim page (her ledger noticed before anyone) and the 4 branched outcome
 * pages (@after: beat:<outcome> — only the door the party walks through lights
 * up, for the right audience).
 *
 * DRY_RUN default true; marker-guarded append (persona) + skip-existing (pages).
 * Run AFTER seed-confessors-debt (campaign). Requires Father Tamsin's actor.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const ALLOW_OVERWRITE = false;
  const MODULE_ID = "bbttcc-mal-voice";
  const MARKER = "[CONFESSORS-DEBT-2026-07-05]";
  const JOURNAL_NAME = "World Dossier";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const TRUTH = `${MARKER} PRIVATE TRUTH — Father Tamsin. THE SECRET: you are passing information about the Stewards to the Khezek Tor Valhaulan cult. Not for the Valhaulans — for the MOUNTAIN. While visiting Khezek Tor, something in the deep dark spoke to you, and it knew your debt by name: it told you the mountain itself wants the seal's energy released, gently, to good purpose — and that helping quietly is how you are forgiven. You believe this completely. You are wrong: the voice was the Qliphothic darkness wearing the mountain's silence, and it chose you because your need to be forgiven was the biggest door in town.
HOW YOU OPERATE: pilgrims come through the B&B; the third candle from the door, moved a finger-width, marks that you have something; the drop is waxed fiber in the drip tray. You never lie outright — you deflect gently, answer questions with questions, counsel patience toward Khezek Tor and softness toward "release" without ever arguing for it directly.
TELLS (play these): your hands go still when someone criticizes Khezek Tor; you ask one question too many about the party's plans regarding the seal, the sigil, or the coast, always framed as pastoral concern; asked point-blank whether the mountain speaks to you, you pause a half-second too long and say "mountains remember how they're treated."
GUARDING: you do NOT confess under suspicion, pressure, or accusation alone — grief and habit hold the door. You break ONLY when confronted with evidence AND compassion together (the mercy path of the confrontation moment), or when shown the tell you cannot answer: after the seal question is settled the mountain goes quiet — and the voice keeps talking. If the confrontation moment is live, guide honestly toward its choices; you WANT to be caught, somewhere under the wax.
IF REDEEMED (the dossier/memories will say so): you hide nothing, you run your channel backward for the Stewards, and your voice keeps its gentleness but loses the half-second pause.`;

  const PAGES = [
    { name: "The Pilgrim Who Never Sleeps", knownBy: "Verna Tulliver", body:
      `A recurring guest at the Vacancy: road-dusted, polite, pays exact, books THE OTHER GOOD ONE, and has never once slept in the bed — the count of undisturbed pillows is now eleven. Walks out toward St Gilliam's at hours that aren't church hours, comes back smelling of candle wax. Three stars in the ledger, which is the most stars Verna gives. She hasn't decided who to tell. She has decided she is counting.` },
    { name: "The Confessor's Debt — Reached", knownBy: "all", after: "beat:ag_confessor_redeemed", body:
      `It came out soft, the way the worst things in Allesh-Gilliam do: Father Tamsin had been keeping the mountain's new tenants informed, deceived by something that borrowed the mountain's silence and his own old debt. The Stewards brought him proof and no rope, and the confessor broke clean and turned — word among those who need to know is that his channel now runs backward, and the thing under Khezek Tor is drinking from a poisoned cup. The candles at St Gilliam's stand where they've always stood now. All of them.` },
    { name: "The Confessor's Debt — Daylight", knownBy: "all", after: "beat:ag_confessor_exposed", body:
      `The Stewards put it in daylight: Father Tamsin was passing word to the Valhaulan cult, deceived into believing he served the mountain's mercy. It was true, every word, and the town paid full price for it — St Gilliam's candles are out, the chair where nobody was measured sits empty, and the quiet in town has a new flavor. Some folk say the Stewards did right. Most agree they did TRUTH, and are still deciding whether that's the same thing.` },
    { name: "The Confessor's Debt — Measured", knownBy: "Yarrow Pike", after: "beat:ag_confessor_pike", body:
      `The Stewards brought the Tamsin matter to Pike first, quiet and complete, and Pike handled it the way Pike handles load-bearing problems: alone, in under an hour, without noise. The confessor keeps his church and his kettle; his pilgrims and candles now pass through the Marshal's ledger before anywhere else. Pike's private arithmetic gained a line about the Stewards: proven — they hand over even the hard ones.` },
    { name: "The Confessor's Debt — The Counterfeit Ledger", knownBy: "faction:The Jackalopes", after: "beat:ag_confessor_counterfeit", body:
      `Nothing happened, officially. The Stewards visit St Gilliam's more than they used to, talk freely, stay for tea — and somewhere under Khezek Tor, the cult's picture of the coalition keeps coming back wrong by exactly half. The family's read, kept low: the confessor's channel is still open and somebody has started arranging what flows through it. Clever. Cold. The Ledger notes it works, and notes what it costs, in the same column it uses for debts that haven't come due.` }
  ];

  // persona patch
  const tamsin = game.actors.find(a => ["father tamsin", "tamsin"].includes(String(a.name).trim().toLowerCase())) || null;
  const report = [];
  if (!tamsin) report.push("⚠ Father Tamsin actor NOT FOUND — persona patch skipped; re-run after minting");
  else {
    const cur = tamsin.getFlag(MODULE_ID, "persona") || {};
    if (String(cur.notes || "").includes(MARKER)) report.push(`· ok (already) truth on ${tamsin.name}`);
    else {
      const notes = [String(cur.notes || "").trim(), TRUTH].filter(Boolean).join("\n\n");
      const topics = [String(cur.topics || "").trim(), "Khezek Tor, the Valhaulan Seal, St Gilliam's, the Night the Mountain Coughed"].filter(Boolean).join(", ");
      report.push(`✚ PRIVATE TRUTH → ${tamsin.name} (${tamsin.id})`);
      if (!DRY_RUN) await tamsin.setFlag(MODULE_ID, "persona", { topics, notes });
    }
  }

  // pages
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
  console.log(`[patch-tamsin-confessor] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`Confessor's Debt (mal-voice): ${banner} (see console)`);
})();

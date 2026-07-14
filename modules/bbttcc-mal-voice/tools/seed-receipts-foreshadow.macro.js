/* seed-receipts-foreshadow.macro.js — the three receipts + the artifact
 * (2026-07-13, doctrine: BEYOND-RIVER-HEART-KICKOFF-2026-07-11.md §3b)
 *
 * The whole current-campaign foreshadow budget for the quiet coin, in one
 * idempotent macro. NEVER the name — receipts only:
 *   1. "The Burned Vendor Line"  — invoice stub in the Valhaulan supply
 *      crates, vendor line burned off.        @after the muster bridge.
 *   2. "The Clause Above the Clearance" — an NDA page in the Vault's sealed
 *      records, numbered past its own index.  @after the Vault quest completes
 *      (any Pip outcome).
 *   3. "Same Mint" — the cult's toll coins, too regular, too new, one die.
 *      @after Khezek's quiet-ones commons lands. + Calder persona append.
 * Plus the raid's one (1) artifact: "Signed by Nobody" — a courtly Secret
 * template in the courtly-secrets PACK (per-instance write — run on EACH
 * instance) and, if her actor exists, armed on Sklar Bjrornholt's persona as
 * an extractable secret (Label :: effectKey :: condition :: truth).
 *
 * DRY_RUN default true; pages skip-existing; persona appends marker-guarded;
 * pack item skipped if present. Run as GM in the live world.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const ALLOW_OVERWRITE = false;
  const MODULE_ID = "bbttcc-mal-voice";
  const MARKER = "[RECEIPTS-2026-07-13]";
  const JOURNAL_NAME = "World Dossier";
  const PACK_ID = "bbttcc-master-content.courtly-secrets";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  // ── gates (live registry ids — see seed-valhaulan-spine / seed-khezek-dossier) ──
  const G = {
    muster: "beat:vs_bridge_muster",                          // stage 4→5 bridge (crates inventoried)
    vault:  "quest_NwiADv8ZDoklqwEJ:completed",               // The Maneuver Vault — any Pip outcome
    quiet:  "beat:khezek_tor_mine_that_answered_back_open"    // same gate as "The Quiet That Isn't"
  };

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const findActor = (cands) => {
    const want = cands.map(norm);
    return game.actors.find(a => want.includes(norm(a.name))) || null;
  };
  const calder = findActor(["Drax Calder", "Foreman Calder", "Calder"]);
  const sklar  = findActor(["Sklar Bjrornholt", "Sklar Bjornholt", "Sklar"]);

  // ── 1–3. the receipts — World Dossier pages ────────────────────────────────
  const PAGES = [
    { name: "Receipt — The Burned Vendor Line", knownBy: "all", after: G.muster, body:
      `Found while the muster counted crates: an invoice stub, tucked flat under a cargo strap like it was meant to ride along. The quantities are exact — fuel, parts, two line items abbreviated past recognizing — and every price reads zero, which is not what free looks like. It's what paid elsewhere looks like. The vendor line is burned off. Not torn — burned, in one neat line, before the stub was packed, by somebody with steady hands and a reason. Delivery terms, printed small at the bottom: "as arranged." Whoever provisions this sky doesn't want thanking. Keep the stub. Receipts are how quiet coin makes noise.` },
    { name: "Receipt — The Clause Above the Clearance", knownBy: "all", after: G.vault, body:
      `In the Vault's sealed records, folded into a coolant-maintenance log where nobody sentimental would ever look: one page of an agreement that is not the agreement it came from. Clause Nineteen — of a document whose own index stops at twelve. It is a confidentiality clause. It binds "the undersigned, their successors, their assigns, and their survivors," and survivors is not a word accountants use. The counterparty line is not redacted and not torn. It is empty, the way a thing can be empty on purpose. In the margin, in a records clerk's careful hand, one note older than anyone stationed here: "Above my clearance. File closed." The Vault sealed it instead of burning it. Maybe the Vault knew better than to try.` },
    { name: "Receipt — Same Mint", knownBy: "all", after: G.quiet, body:
      `The quiet ones in Khezek's upper galleries pay their tolls in good coin, and Foreman Calder has finally said out loud what his pouch has known for months: it is all the same coin. Same weight, same year, same die — no mint mark anyone can place, and the edges are unworn, as if every piece went from the stamp to the toll table without passing through a single hand in between. Money is supposed to have a history. This money has a source. Calder keeps theirs in a separate pouch and hasn't spent one yet. Asked why, he says he's waiting to meet somebody who can tell him where they were minted — and buys the next round with honest, dirty, circulated coin.` }
  ];

  // ── persona appends (marker-guarded) ───────────────────────────────────────
  const PERSONAS = [
    { actor: calder, who: "Calder (append)",
      topics: "the toll coins, the same mint, the separate pouch, the quiet ones' money",
      notes: `${MARKER} THE POUCH — Foreman Drax Calder, on the quiet ones' coin (say only if asked about the tolls, the coins, or the pouch). He counts loads for a living, so of course he noticed: same weight, same year, same die, every single piece, and no mint mark he can place — he has asked haulers from three coasts. The edges are unworn. Coin is supposed to arrive with a history on it; this coin arrives with none, like it was struck yesterday somewhere that doesn't exist. He keeps theirs in a separate pouch, apart from the Brace's money the way Brennig keeps the humming crates apart from the food, and he has not spent one. He will hand a piece over to be LOOKED at — never to be kept. If pressed on what he thinks it means: 'means somebody's paying face value to be left alone, in money that's never been anywhere. You tell me which half of that worries you more.' TELLS: weighs the pouch in his palm when the quiet ones come up; sets it down gently, like it might be listening.` },
    { actor: sklar, who: "Sklar (arm secret)",
      topics: "the folder below, the luck, who pays, the paperwork she has never read",
      notes: `${MARKER} THE FOLDER SHE'S NEVER READ — Sklar Bjrornholt, private (never volunteered; extracted only). Somewhere below decks is a folder she has never read all the way through: fuel contracts that renew themselves, parts manifests for machines her crew hasn't broken yet, and on the last page a signature block — notarized, sealed, binding — with no name in it. She doesn't read it because a captain who reads the tiller's hand has to do something about the hand, and she is not ready to learn what that costs. She is not stupid; she is brave, which is different, and this is the one place she has chosen not to be. GUARDS: laughs off "who funds you" from strangers ('the sky provides, and I rob the sky'). The secret's condition is real trust or a receipt on the table — see armed secret.`,
      secret: `Signed by Nobody :: oppRollMinus2+stirThePot :: someone she would share a drink with asks her plainly, without an angle, who really pays for the Valhaulans' fuel and their luck — or lays one of the receipts (the burned invoice stub, the sealed clause, the too-new toll coins) on the table in front of her :: She goes below without a word and comes back with a folder she handles like live ordnance, and drops it on the table. 'Fuel that arrives before we order it. Parts that fit machines we haven't broken yet. And this.' The last page: a signature block, notarized, sealed, binding — and blank. 'I don't sign things. And that's my seal on it. I don't remember signing, but I know my own luck by now, and it's been paid for by somebody who keeps better books than me. Take it. Whoever owns the pen doesn't lose paper — so when they come looking for it, I'd rather they come looking to you.'` }
  ];

  // ── 4. the artifact — courtly Secret template in the pack ──────────────────
  const ARTIFACT = {
    name: "Signed by Nobody",
    img: "icons/sundries/documents/document-sealed-signatures-red.webp",
    effectKey: "oppRollMinus2+stirThePot",
    desc: `<p><strong>Signed by Nobody.</strong> A contract of impossible provenance: terms nobody remembers setting, in language a shade older than the paper it's printed on, ending in a notarized, sealed, entirely blank signature block — and binding anyway. It does not explain anything. It unsettles everyone.</p><p><em>Play:</em> queue −2 to your opponent's next courtly roll <strong>and</strong> +2 Suspicion — the court cannot stop wondering whose pen it was.</p>`
  };

  const report = [];

  // pages
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

  // personas
  for (const p of PERSONAS) {
    if (!p.actor) { report.push(`⚠ persona skipped — ${p.who} not found (arm by hand or re-run once the actor exists)`); continue; }
    const cur = p.actor.getFlag(MODULE_ID, "persona") || {};
    if (String(cur.notes || "").includes(MARKER)) { report.push(`· ok (already) ${p.actor.name}`); continue; }
    const topics = [String(cur.topics || "").trim(), p.topics].filter(Boolean).join(", ");
    const notes = [String(cur.notes || "").trim(), p.notes].filter(Boolean).join("\n\n");
    const patch = { topics, notes };
    if (p.secret) {
      const rawCur = String(cur.secretsRaw || "").trim();
      patch.secretsRaw = rawCur.includes("Signed by Nobody") ? rawCur : [rawCur, p.secret].filter(Boolean).join("\n");
    }
    report.push(`✚ persona append → ${p.actor.name}${p.secret ? " (+ armed secret)" : ""}`);
    if (!DRY_RUN) await p.actor.setFlag(MODULE_ID, "persona", patch);
  }

  // artifact template (pack write — per-instance)
  const pack = game.packs.get(PACK_ID);
  if (!pack) report.push(`⚠ pack ${PACK_ID} not found — artifact template NOT seeded`);
  else if (pack.locked) report.push(`⚠ pack ${PACK_ID} is LOCKED — unlock in Compendium settings, re-run for the artifact`);
  else {
    const docs = await pack.getDocuments();
    if (docs.some(d => d.name === ARTIFACT.name)) report.push(`pack item "${ARTIFACT.name}": exists — SKIPPED`);
    else {
      report.push(`pack item "${ARTIFACT.name}": CREATE in ${PACK_ID}`);
      if (!DRY_RUN) await Item.create({
        name: ARTIFACT.name, type: "feat", img: ARTIFACT.img,
        system: { description: { value: ARTIFACT.desc, chat: "", unidentified: "" } },
        flags: { "bbttcc-raid": { secret: { effectKey: ARTIFACT.effectKey, acquisition: "template", acquiredAt: 0, raidId: "" } } }
      }, { pack: PACK_ID });
    }
  }

  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply." : "APPLIED.";
  console.log(`[seed-receipts-foreshadow] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`Receipts foreshadow: ${banner} (see console)`);
})();

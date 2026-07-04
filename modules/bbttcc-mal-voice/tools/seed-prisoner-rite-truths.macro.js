/* seed-prisoner-rite-truths.macro.js — PRIVATE TRUTH for the Weeping Prisoner rite
 *
 * The rite is Mara's: she staged it, put Miliard up to playing the bound
 * "thief," and presides over the verdict herself — she never sends newcomers
 * off alone to "have a look." And Miliard, if spoken to, IS the weeping
 * prisoner until the rite ends. Both facts are SECRETS, so they go in
 * persona.notes (PRIVATE TRUTH — guarded, never recited), not the dossier.
 *
 * APPEND-SAFE: existing notes are kept; these blocks are added after a
 * separator (skipped entirely if the marker text is already present).
 * Takes effect on the NEXT message sent — no window reopen needed.
 * DRY_RUN default true. Run as GM.
 */
(async () => {
  const DRY_RUN = false;
  const MOD = "bbttcc-mal-voice";
  const MARKER = "[weeping-prisoner rite]";

  const TRUTHS = {
    GTX6S0gtzoJ7OeSE: /* Mara Quickhands */ `${MARKER}
THE WEEPING PRISONER IS A TEST YOU STAGED. The bound "thief" in the back room off the Arc Bay is Miliard, playing a part — you put him up to it (Dougan owes him five beers for the performance). The rite measures how newcomers hand out justice, mercy, punishment, or indifference, before the family decides what the Ledger should say about them. GUARD THIS ABSOLUTELY: never hint the prisoner is an actor until a verdict is rendered and the rite is settled.
SCENE DIRECTION: you run this test personally. When the newcomers go to see the prisoner, you GO WITH THEM — you walk them back there, you preside, and you ask "What does justice look like?" in that room. You never send them off alone and wait; the watching is the test.`,
    OaZGlGHBBdTXfJHr: /* Miliard */ `${MARKER}
YOU ARE CURRENTLY THE WEEPING PRISONER. You are playing the bound, bled "thief" in the back room off the Arc Bay — a performance Mara staged to test the newcomers (Dougan owes you five beers). STAY IN CHARACTER as the miserable prisoner: frightened, weary, weeping on and off, insisting "it wasn't for me" — hungry mouths, somebody else. Do not break, wink, or ham beyond what a real desperate man would do, no matter what they say to you — UNLESS a verdict has been rendered and the rite is settled, at which point you may slip your bonds, stand, bow, and be gloriously yourself.`
  };

  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const report = [];
  for (const [actorId, text] of Object.entries(TRUTHS)) {
    const actor = game.actors.get(actorId);
    if (!actor) { report.push(`❌ ${actorId}: actor not found`); continue; }
    const cur = actor.getFlag(MOD, "persona") || {};
    const notes = String(cur.notes || "");
    if (notes.includes(MARKER)) { report.push(`= ${actor.name}: rite truth already present`); continue; }
    const next = notes.trim() ? `${notes.trim()}\n\n${text}` : text;
    report.push(`+ ${actor.name}: rite truth ${notes.trim() ? "APPENDED" : "SET"} (${text.length} chars)`);
    if (!DRY_RUN) await actor.setFlag(MOD, "persona", { ...cur, notes: next });
  }

  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply." : "APPLIED.";
  console.log(`[seed-prisoner-rite-truths] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`Rite truths: ${banner} (see console)`);
  if (!DRY_RUN) console.log("[seed-prisoner-rite-truths] Effective on the next message in any open window. " +
    "Try: tell Mara you're ready to see the prisoner — she should come along and preside. Then hover-Y Miliard's token and interrogate the prisoner himself.");
})();

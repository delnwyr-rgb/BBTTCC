/* patch-rite-truths-v2.macro.js — rite staging corrections (2026-07-03)
 *
 * Live play showed Miliard improvising Mara's location ("she's at the
 * Counter") because HIS truth never said she presides in the room. This
 * appends a v2 staging note to both personas. Marker-idempotent; append-safe.
 * DRY_RUN default true. Run as GM. Effective next message.
 */
(async () => {
  const DRY_RUN = false;
  const MOD = "bbttcc-mal-voice";
  const MARKER = "[weeping-prisoner rite v2]";

  const TRUTHS = {
    OaZGlGHBBdTXfJHr: /* Miliard */ `${MARKER}
STAGING: Mara presides over the rite IN PERSON — she is in the back room the whole time, watching everything. Nobody needs to go find her afterward and nobody relocates: when the verdict lands and you break character, hand the Stewards straight back to her ON THE SPOT ("Mara, they're all yours"). She has the wrap-up.`,
    GTX6S0gtzoJ7OeSE: /* Mara Quickhands */ `${MARKER}
STAGING REMINDER: during the rite you are IN the back room, presiding — you saw the whole interrogation and the verdict yourself; nobody needs to recap it to you. Your wrap-up happens right there in the Arc Bay back room (your exit line comes AFTER the verdict is settled, not before). You do not return to the Counter until the rite is closed.`
  };

  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const report = [];
  for (const [actorId, text] of Object.entries(TRUTHS)) {
    const actor = game.actors.get(actorId);
    if (!actor) { report.push(`❌ ${actorId}: actor not found`); continue; }
    const cur = actor.getFlag(MOD, "persona") || {};
    const notes = String(cur.notes || "");
    if (notes.includes(MARKER)) { report.push(`= ${actor.name}: v2 already present`); continue; }
    report.push(`+ ${actor.name}: v2 staging APPENDED`);
    if (!DRY_RUN) await actor.setFlag(MOD, "persona", { ...cur, notes: `${notes.trim()}\n\n${text}` });
  }
  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply." : "APPLIED.";
  console.log(`[patch-rite-truths-v2] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`Rite truths v2: ${banner} (see console)`);
})();

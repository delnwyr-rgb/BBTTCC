/* press-digest.macro.js — re-run The Turn Press by hand (2026-08-12)
 *
 * The press runs automatically on every applied turn advance; use this macro
 * to re-press mid-turn after GM edits (relations changed, a headline-bearing
 * beat fired, a meter moved) or to preview without writing.
 *
 * PREVIEW default true: logs the rendered facts, writes nothing.
 * Set PREVIEW = false to press the current edition into the journal
 * (overwrites THIS turn's auto-pressed page; hand-written pages untouched).
 * Run as GM. Open NPC windows pick the new edition up on their next line.
 */
(async () => {
  const PREVIEW = true;

  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const digest = game.bbttcc?.api?.campaign?.digest;
  if (!digest) return ui.notifications.error("Turn Press API missing — is bbttcc-campaign loaded (and restarted since the world-digest deploy)?");

  if (PREVIEW) {
    const { turn, facts } = await digest.render({});
    console.log(`[press-digest] PREVIEW — Turn ${turn}, ${facts.length} fact(s):\n` + facts.map(f => "  • " + f).join("\n"));
    return ui.notifications.info(`Turn Press PREVIEW: ${facts.length} fact(s) for Turn ${turn} — see console. Set PREVIEW = false to press.`);
  }

  const res = await digest.press({});
  if (!res?.ok) return ui.notifications.warn(`Turn Press failed: ${res?.reason || "unknown"}`);
  console.log("[press-digest] pressed:", res);
  ui.notifications.info(`Turn Press: "${res.pageName}" ${res.created ? "created" : "updated"} in "${res.journalName}".`);
})();

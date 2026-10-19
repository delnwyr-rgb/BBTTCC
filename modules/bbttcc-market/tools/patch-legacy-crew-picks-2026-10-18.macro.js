/* patch-legacy-crew-picks-2026-10-18.macro.js — LEGACY CREW / ASSOCIATION PICKS → CONTRACTS (ruling 15, 2026-10-18)
 *
 *  Before ruling 15 a steward picked an Awesome Crew and an Occult Association on the sheet; the pick lives in
 *  flags["bbttcc-character-options"].identity.{crew,occult} and keeps granting maneuvers / feats for free. Live census
 *  10-18: 18 characters carry such a pick with no contract behind it. This macro grandfathers them:
 *
 *    MODE "contract" → each legacy pick becomes a normal contract (CONTRACT_TURNS turns, source "legacy") through
 *                      game.bbttcc.api.contracts.hire — same slot, same feats, but it now EXPIRES. Re-sign at the Muster.
 *    MODE "clear"    → each legacy pick is released (slot cleared, feats removed, Domain pool re-synced).
 *
 *  SCOPE "stewards" = only characters linked to a Domain (banks.domainOf) — campaign NPCs built as characters keep
 *  their flavour picks (they never enter the echo pool: the bootstrap counts steward-kind characters only).
 *  SCOPE "all" = every character actor.
 *  Idempotent (a character with an active contract in that family is skipped). DRY_RUN default true. GM only.
 *  Marker: [LEGACY-CREW-PICKS-2026-10-18]
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const MODE = "contract";              // "contract" | "clear"
  const SCOPE = "stewards";             // "stewards" | "all"
  const CONTRACT_TURNS = 3;
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const C = game.bbttcc?.api?.contracts; if (!C) return ui.notifications.error("Contracts API missing (bbttcc-market).");
  const domainOf = game.bbttcc?.api?.banks?.domainOf;
  const report = []; let changes = 0;
  for (const a of (game.actors?.contents ?? [])) {
    if (a.type !== "character") continue;
    if (SCOPE === "stewards") { let d = null; try { d = domainOf?.(a); } catch (_e) {} if (!d) continue; }
    const ident = a.flags?.["bbttcc-character-options"]?.identity || {};
    const active = C.list(a);
    for (const family of ["crew", "occult"]) {
      const slot = ident[family]; const docId = slot && (slot.id || slot.key);
      if (!docId) continue;
      if (active.some(c => c.family === family && C.isActive(c))) { report.push(`· ok ${a.name} ${family}: contract already active`); continue; }
      const name = slot.displayName || slot.name || docId;
      changes++;
      if (DRY_RUN) { report.push(`✚ ${a.name} ${family}: ${name} → ${MODE === "clear" ? "CLEAR" : `${CONTRACT_TURNS}-turn legacy contract`}`); continue; }
      try {
        if (MODE === "clear") await C.release(a, family, { reason: "released", quiet: true });
        else await C.hire(a, family, docId, { turns: CONTRACT_TURNS, source: "legacy", quiet: true });
        report.push(`✚ ${a.name} ${family}: ${name} → ${MODE === "clear" ? "cleared" : "legacy contract (" + CONTRACT_TURNS + " turns)"}`);
      } catch (e) { report.push(`⚠ ${a.name} ${family}: ${e?.message || e}`); }
    }
  }
  console.log(`[patch-legacy-crew-picks] ${DRY_RUN ? "DRY RUN" : "APPLY"} (${MODE}/${SCOPE}) — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`Legacy crew picks ${DRY_RUN ? "DRY RUN" : "APPLIED"}: ${changes} change(s) (see console).`);
})();

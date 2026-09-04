// Bad Eden — Mark the Canonical Board (2026-09-01)
// ─────────────────────────────────────────────────────────────────────────────
// Owner ruling 2026-09-01: the FIVE region scenes are the canonical Bad Eden
// board (141 hexes) for the World-Health win-track. This macro stamps
//   flags.bbttcc-epic.boardScene = true
// on exactly those five scenes and CLEARS the flag everywhere else, so
// bbttcc-epic/scripts/repair.js::boardScenes() stops counting the duplicate
// Starting-Map copies and the GOTTGAIT / arena / onboarding maps (which
// inflated worldHealth.total to 336 and made the 100% Malkuth seam
// unreachable).
//
// Safe + idempotent. Run as GM, then reopen the Campaign Overview to see the
// corrected World-Health chip. Name matching is NBSP-safe.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  if (!game.user.isGM) { ui.notifications?.error("GM only."); return; }
  const MOD = "bbttcc-epic";
  const CANON = [
    "Bad Eden — The Drowned South",
    "Bad Eden — The Iron Reaches",
    "Bad Eden — The Northern Marches",
    "Bad Eden — The River Heart",
    "Bad Eden — The Saltwake Coast"
  ];
  const norm = (s) => String(s || "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
  const canonSet = new Set(CANON.map(norm));

  let marked = 0, cleared = 0, hexTotal = 0;
  const rows = [];
  for (const sc of game.scenes?.contents ?? []) {
    const isCanon = canonSet.has(norm(sc.name));
    const has = sc.getFlag(MOD, "boardScene") === true;
    if (isCanon) {
      const hexes = (sc.drawings ?? []).filter(d => {
        const tf = d.flags?.["bbttcc-territory"];
        return tf?.isHex === true || tf?.kind === "territory-hex";
      }).length;
      hexTotal += hexes;
      rows.push(`✦ ${sc.name} — ${hexes} hexes`);
      if (!has) { await sc.setFlag(MOD, "boardScene", true); marked++; }
    } else if (has) {
      await sc.unsetFlag(MOD, "boardScene");
      cleared++;
    }
  }

  const found = rows.length;
  console.log(`[mark-canonical-board] canon scenes found ${found}/5 (${marked} newly marked, ${cleared} cleared):\n` + rows.join("\n"));
  if (found < 5) console.warn("[mark-canonical-board] MISSING canon scenes — check names:", CANON.filter(n => !rows.some(r => r.includes(n.slice(10)))));
  ui.notifications?.[found === 5 ? "info" : "warn"](
    `Canonical board: ${found}/5 region scenes marked, ${hexTotal} hexes on the win-track` +
    (cleared ? ` (${cleared} stale mark${cleared > 1 ? "s" : ""} cleared)` : "") +
    (found < 5 ? " — see console (F12) for missing names." : ".")
  );
})();

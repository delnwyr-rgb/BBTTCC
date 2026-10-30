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
  // 10-29: ONE-MAP aware — after the 10-26 merge the canon board is the scene flagged
  // flags.bbttcc-travel.oneMap ("Bad Eden — The Whole Map"); emptied "(merged — safe to delete)" regions
  // (flags.bbttcc-travel.mergedInto) are not canon. A rerun used to match 0/5 and strip the Whole Map's
  // mark. Now a short count ABORTS before any flag is touched.
  const TRV = "bbttcc-travel";
  const oneMap = (game.scenes?.contents ?? []).filter(sc => sc.flags?.[TRV]?.oneMap === true && !sc.flags?.[TRV]?.mergedInto);
  const isCanonScene = oneMap.length
    ? (sc) => oneMap.includes(sc)
    : (sc) => canonSet.has(norm(sc.name)) && !sc.flags?.[TRV]?.mergedInto;
  const expected = oneMap.length ? 1 : CANON.length;
  const what = oneMap.length ? "one-map scene" : "region scenes";
  const foundCanon = (game.scenes?.contents ?? []).filter(isCanonScene).length;
  if (foundCanon !== expected) {
    console.warn(`[mark-canonical-board] ABORTED — found ${foundCanon}/${expected} canon ${what}; no flags changed.`,
      oneMap.length ? oneMap.map(s => s.name) : CANON.filter(n => !(game.scenes?.contents ?? []).some(sc => isCanonScene(sc) && norm(sc.name) === norm(n))));
    ui.notifications?.warn(`Canonical board: found ${foundCanon}/${expected} canon ${what} — aborted, nothing changed. See console (F12).`);
    return;
  }

  let marked = 0, cleared = 0, hexTotal = 0;
  const rows = [];
  for (const sc of game.scenes?.contents ?? []) {
    const isCanon = isCanonScene(sc);
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
  console.log(`[mark-canonical-board] canon ${what} found ${found}/${expected} (${marked} newly marked, ${cleared} cleared):\n` + rows.join("\n"));
  ui.notifications?.info(
    `Canonical board: ${found}/${expected} ${what} marked, ${hexTotal} hexes on the win-track` +
    (cleared ? ` (${cleared} stale mark${cleared > 1 ? "s" : ""} cleared).` : ".")
  );
})();

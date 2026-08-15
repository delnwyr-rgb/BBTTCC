/* list-hexes.macro.js — inventory every hex in the world, by scene.
 * 2026-08-15. Read-only; changes nothing. GM only.
 *
 * Prints the EXACT display name of every territory hex (Drawings carrying
 * bbttcc-territory flags), grouped by scene, plus a copy-paste block.
 * Use it whenever a seeder reports "hex not found" — hex names use a
 * Name.letter convention and carry non-breaking spaces (U+00A0), so what
 * you see on the map is rarely what a string literal matches.
 *
 * FILTER: set FILTER to a fragment ("mire", "beaumont") to narrow the dump.
 * SHOW_FLAGS: true also prints campaign onEnter / sarmoungHouse markers.
 */
(async () => {
  const FILTER     = "";      // e.g. "mire" — "" prints everything
  const SHOW_FLAGS = true;
  const TERR = "bbttcc-territory";
  const NS   = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const want = norm(FILTER);

  const rows = [];
  let total = 0, shown = 0;

  for (const sc of game.scenes.contents) {
    const hexes = (sc.drawings?.contents || []).filter(dr => dr.flags?.[TERR]);
    if (!hexes.length) continue;
    total += hexes.length;

    const lines = [];
    for (const dr of hexes) {
      const label = dr.text || dr.flags[TERR]?.name || "(unnamed)";
      if (want && !norm(label).includes(want)) continue;
      shown++;
      const bits = [];
      if (SHOW_FLAGS) {
        const onEnter = dr.flags?.[TERR]?.campaign?.onEnterBeatId;
        const house   = dr.flags?.[NS]?.sarmoungHouse;
        if (onEnter) bits.push(`onEnter=${onEnter}`);
        if (house)   bits.push(`🏚 house ${house}`);
        // NBSP is invisible and breaks matching — call it out explicitly.
        if (/ /.test(dr.text || "")) bits.push("⚠ contains NBSP");
      }
      lines.push(`    ${label}${bits.length ? `   [${bits.join(" · ")}]` : ""}`);
    }
    if (lines.length) rows.push(`  ${sc.name}  (${hexes.length} hexes)\n` + lines.join("\n"));
  }

  const out =
    `[list-hexes] ${shown}/${total} hexes${FILTER ? ` matching "${FILTER}"` : ""}\n\n` +
    (rows.length ? rows.join("\n\n") : "  (nothing matched)") +
    `\n\n— paste-ready names —\n` +
    game.scenes.contents.flatMap(sc =>
      (sc.drawings?.contents || [])
        .filter(dr => dr.flags?.[TERR])
        .map(dr => dr.text || dr.flags[TERR]?.name || "")
        .filter(n => n && (!want || norm(n).includes(want)))
    ).map(n => `"${n}"`).join(", ");

  console.log(out);
  ui.notifications.info(`list-hexes: ${shown}/${total} hexes printed to console (F12).`);
})();

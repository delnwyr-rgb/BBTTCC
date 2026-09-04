// Bad Eden — Seed the 30 Sparks into the Board (DRY_RUN) (2026-09-01)
// ─────────────────────────────────────────────────────────────────────────────
// Seats the 30 authored Sparks of Light (10 sephirot × animate/conceptual/
// vestigial) into hexes on the CANONICAL board scenes, as DORMANT anchors:
//   flags.bbttcc-territory.spark = { key, state: "dormant", at }
// Placement table drafted 2026-09-01 — see SPARK_SEEDING_2026_09_01.md for
// the reasoning; ⚠ OWNER RULING PENDING: run with DRY_RUN = true first, read
// the report, amend PLACEMENTS to taste, then flip DRY_RUN = false.
//
// Prereq: run bbttcc-epic/tools/mark-canonical-board.macro.js first (this
// macro only searches scenes flagged bbttcc-epic.boardScene, so the legacy
// Starting-Map duplicates never get seated).
//
// Idempotent: a hex already holding the same key is skipped; a hex holding a
// DIFFERENT key is reported and left alone (unseat manually via
// game.bbttcc.api.tikkun.hex.unseat if you truly want to move one).
// Name matching is NBSP-safe, ✦-safe, case-insensitive.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  if (!game.user.isGM) { ui.notifications?.error("GM only."); return; }
  const DRY_RUN = false;                                  // ← flip to false to seat
  const TER = "bbttcc-territory";

  // key → hex name (region noted for the reader; matching is by hex name)
  const PLACEMENTS = [
    // ── The Drowned South (6)
    ["spark_binah_animate",      "Blackwater Verge a"],      // the deep mother-water, alive
    ["spark_gevurah_conceptual", "Evil Bad Fortress"],       // severity as doctrine
    ["spark_gevurah_vestigial",  "The Burnt Flats"],         // wrath's ash
    ["spark_tiferet_animate",    "The Singing Mire"],        // harmony that sings back
    ["spark_netzach_conceptual", "Drowned Kudzu Reach f"],   // growth even drowned
    ["spark_yesod_animate",      "The Anchor Reach"],        // the living anchor
    // ── The Iron Reaches (4)
    ["spark_keter_conceptual",   "Inconvenient Mountains.k"],// the crown of the world, inconveniently high
    ["spark_hod_conceptual",     "CanYAWN Amirite.d"],       // the joke that is secretly a codebook
    ["spark_hod_vestigial",      "Mount Excuse"],            // eloquence decayed into excuses
    ["spark_malkuth_conceptual", "Inconvenient Mountains.b"],// matter at its most matter-of-fact
    // ── The Northern Marches (6)
    ["spark_keter_animate",      "The Rotating Chapel"],     // the chapel turns to face what it worships
    ["spark_chokmah_conceptual", "Probably Beaumont"],       // the wiser guess
    ["spark_chokmah_vestigial",  "Maybe Beaumont?"],         // wisdom decayed to a shrug
    ["spark_binah_vestigial",    "Hexen Myre.c"],            // structure sunk in bog
    ["spark_netzach_vestigial",  "BarrenPlains.b"],          // endurance ground barren
    ["spark_hod_animate",        "Legansus Waystation"],     // the living relay
    // ── The River Heart (10 — it is the heart)
    ["spark_chokmah_animate",    "The Polygonal Grove"],     // geometry that grows
    ["spark_binah_conceptual",   "Odaroloc Depths"],         // understanding at depth
    ["spark_chesed_animate",     "Lyrenn"],                  // the farm that feeds strangers
    ["spark_chesed_vestigial",   "Bedlam Fancies"],          // charity curdled into whimsy
    ["spark_gevurah_animate",    "Khezek-Tor"],              // the seal that holds (Valhaulan arc)
    ["spark_tiferet_conceptual", "Bedlam Thirdword"],        // the third word that reconciles
    ["spark_netzach_animate",    "Port Kudzu"],              // kudzu endures beyond reason
    ["spark_yesod_conceptual",   "Allesh-Gilliam"],          // CANON: the Thatward's Ho! finale spark
    ["spark_yesod_vestigial",    "Ynnermire.b"],             // foundation sunk
    ["spark_malkuth_animate",    "Furrier's Fixit-Farm"],    // the kingdom mends itself
    // ── The Saltwake Coast (4)
    ["spark_keter_vestigial",    "Crown Mall"],              // the crown, retail edition
    ["spark_chesed_conceptual",  "Saltwake Reach e"],        // hospitality of the coast
    ["spark_tiferet_vestigial",  "Static Coast g"],          // harmony fallen to static
    ["spark_malkuth_vestigial",  "Hexen Myre.l"]             // the kingdom's mud
  ];

  const norm = (s) => String(s || "")
    .replace(/ /g, " ")            // NBSP → space (hex-name trap)
    .replace(/^[\s✦]+/, "")
    .replace(/\s+/g, " ")
    .trim().toLowerCase();

  const boardScenes = (game.scenes?.contents ?? []).filter(sc => sc.getFlag("bbttcc-epic", "boardScene") === true);
  if (!boardScenes.length) {
    ui.notifications?.error("No canonical board scenes flagged — run bbttcc-epic/tools/mark-canonical-board.macro.js first.");
    return;
  }

  // Index hexes by normalized name across the board scenes.
  const hexByName = new Map();
  for (const sc of boardScenes) {
    for (const d of sc.drawings ?? []) {
      const tf = d.flags?.[TER];
      if (!(tf?.isHex === true || tf?.kind === "territory-hex")) continue;
      const name = norm(d.text || tf?.name || "");
      if (name && !hexByName.has(name)) hexByName.set(name, d);
    }
  }

  let seated = 0, skippedSame = 0, occupied = 0, missing = 0;
  const lines = [];
  for (const [key, hexName] of PLACEMENTS) {
    const doc = hexByName.get(norm(hexName));
    if (!doc) { missing++; lines.push(`❓ ${key} → "${hexName}" NOT FOUND on board scenes`); continue; }
    const existing = doc.flags?.[TER]?.spark;
    if (existing?.key === key) { skippedSame++; lines.push(`• ${key} already at ${hexName}`); continue; }
    if (existing?.key) { occupied++; lines.push(`⚠ ${hexName} holds ${existing.key} — left alone (wanted ${key})`); continue; }
    lines.push(`✦ ${key} → ${hexName} (${doc.parent?.name})`);
    if (!DRY_RUN) await doc.update({ [`flags.${TER}.spark`]: { key, state: "dormant", at: Date.now() } });
    seated++;
  }

  console.log(`%c=== Seed Hex Sparks ${DRY_RUN ? "(DRY RUN — nothing written)" : "(APPLIED)"} ===`, "font-weight:bold");
  console.log(lines.join("\n"));
  console.log(`seated ${seated} · already ${skippedSame} · occupied ${occupied} · missing ${missing} / ${PLACEMENTS.length}`);
  ui.notifications?.[missing || occupied ? "warn" : "info"](
    `${DRY_RUN ? "DRY RUN: would seat" : "Seated"} ${seated} sparks (${skippedSame} already placed` +
    `${occupied ? `, ${occupied} occupied` : ""}${missing ? `, ${missing} hex names not found` : ""}). Console (F12) has the table.`
  );
})();

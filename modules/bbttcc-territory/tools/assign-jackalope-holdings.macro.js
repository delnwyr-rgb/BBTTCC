/* ============================================================================
 * Bad Eden — Assign the Jackalopes' 3 starting holdings  (GM macro)
 * ----------------------------------------------------------------------------
 * Sets flags["bbttcc-territory"].factionId + status = "occupied" on:
 *   • Port Kudzu   • Furrier's Fixit Farm   • The Polygonal Grove
 * → "The Jackalopes" (U5YaO2p189LBMvVq). Matches hexes by name (case-insensitive,
 * accepts spelling variants) across all scene drawings flagged isHex.
 *
 * DRY_RUN = true  -> preview only (no writes). Set false to apply.
 * Idempotent: skips any hex already owned by the Jackalopes. Run in the live world.
 * (Assigns OWNERSHIP only; does not change Integration/dev level.)
 * ==========================================================================*/
(async () => {
  const DRY_RUN = true;                 // <-- set to false to actually write
  const MODT = "bbttcc-territory";
  const FACTION_ID = "U5YaO2p189LBMvVq";

  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const faction = game.actors.get(FACTION_ID);
  if (!faction) return ui.notifications.error(`Jackalope faction ${FACTION_ID} not found in this world.`);

  const WANT = [
    { canon: "Port Kudzu",           aliases: ["port kudzu"] },
    { canon: "Furrier's Fixit Farm", aliases: ["furrier's fixit farm", "furrier's fixit-farm", "furriers fixit farm", "furriers fixit-farm"] },
    { canon: "The Polygonal Grove",  aliases: ["the polygonal grove", "polygonal grove"] },
  ];
  const norm = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const aliasToCanon = new Map();
  for (const w of WANT) for (const a of w.aliases) aliasToCanon.set(norm(a), w.canon);

  const rows = [];
  for (const sc of game.scenes ?? []) {
    for (const d of sc.drawings ?? []) {
      const tf = d.flags?.[MODT];
      if (!tf?.isHex) continue;
      const canon = aliasToCanon.get(norm(tf.name));
      if (!canon) continue;
      const curFaction = String(tf.factionId || "");
      rows.push({ canon, name: tf.name, scene: sc.name, d, curFaction, curStatus: tf.status || "", already: curFaction === FACTION_ID });
    }
  }

  console.group("%c[jackalope-holdings]", "font-weight:bold");
  for (const r of rows) console.log(`${r.already ? "OK (already)" : (DRY_RUN ? "WOULD SET" : "SET")}  ${r.canon}  [scene: ${r.scene}]  cur.faction=${r.curFaction || "∅"} status=${r.curStatus || "∅"}`);
  const missing = WANT.filter(w => !rows.some(r => r.canon === w.canon)).map(w => w.canon);
  if (missing.length) console.warn("NOT FOUND (check exact hex name in-world):", missing);
  console.groupEnd();

  const toSet = rows.filter(r => !r.already);
  if (!toSet.length && !missing.length) return ui.notifications.info("Jackalope holdings: all 3 already assigned — nothing to do.");
  if (!toSet.length) return ui.notifications.warn(`Jackalope holdings: matched hexes already assigned, but ${missing.length} not found: ${missing.join(", ")}`);

  if (DRY_RUN) {
    ui.notifications.warn(`DRY RUN — would assign ${toSet.length} hex(es) to ${faction.name}${missing.length ? ` · ${missing.length} NOT FOUND` : ""}. Set DRY_RUN=false to apply.`);
    return;
  }

  for (const r of toSet) {
    await r.d.setFlag(MODT, "factionId", FACTION_ID);
    await r.d.setFlag(MODT, "status", "occupied");
    console.log(`[jackalope-holdings] assigned ${r.canon} → ${faction.name}`);
  }
  ui.notifications.info(`Jackalope holdings: assigned ${toSet.length} hex(es) to ${faction.name}. Re-open the Hex Sheet to confirm Owner.${missing.length ? ` (${missing.length} not found: ${missing.join(", ")})` : ""}`);
})();

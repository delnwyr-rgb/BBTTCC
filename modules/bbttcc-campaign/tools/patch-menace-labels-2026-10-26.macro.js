/* patch-menace-labels-2026-10-26.macro.js — BS13 (Content Audit ruling, 2026-10-26): the locals' warning card names the
 * creature by its PACK name. The 10-21 menace seeder wrote three labels that drifted from the npcs pack —
 *   "Waste Stalkers"      → "Wastes Stalker"        (BYUSNIOicg4IZn6W)
 *   "Geometry Serpent"    → "Jommetry Serpent"      (xCHciB6b5HEF5926)
 *   "Qlipothic Shambler"  → "Qliphothic Shambler"   (dskzJNdpkiTFEbik — the actor was renamed live on 10-06)
 * Three homes: the beat's `menace.label` (campaign setting), any hex row already recorded on the map
 * (`flags.bbttcc-territory.menaces[].label`), and the warning-card chat flags are left alone (history).
 * Idempotent (rerun → 0 changes); copies settings with JSON.parse(JSON.stringify()); DRY_RUN default true; GM only.
 * ⚠ The 10-21 "one spelling: Qlipothic" sweep covered campaign prose; this row re-aims the LABEL at the pack name only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const LABELS = {
    enc_mutant_wildlife_t3: ["Waste Stalkers", "Wastes Stalker"],
    enc_geometry_serpent:   ["Geometry Serpent", "Jommetry Serpent"],
    enc_qlipothic_shambler: ["Qlipothic Shambler", "Qliphothic Shambler"]
  };
  const OLD_TO_NEW = Object.fromEntries(Object.values(LABELS));
  const report = []; let changes = 0;

  // 1. beat.menace.label in the active campaign
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw));
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const beatList = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  for (const b of beatList) {
    const m = b?.menace; if (!m || typeof m !== "object") continue;
    const want = LABELS[b.id]?.[1] ?? OLD_TO_NEW[m.label];
    if (!want || m.label === want) { if (want) report.push(`· ok ${b.id}: "${m.label}"`); continue; }
    report.push(`✚ ${b.id}: menace.label "${m.label}" → "${want}"`); m.label = want; changes++;
  }
  if (changes && !DRY_RUN) await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);

  // 2. hex rows already on the map (every scene's hex documents that carry menaces)
  let hexChanges = 0;
  const FLAG = "menaces", MODT = "bbttcc-territory";
  const docsWithRows = [];
  for (const scene of game.scenes) {
    for (const coll of [scene.drawings, scene.tiles, scene.tokens, scene.regions ?? []]) {
      for (const d of coll) { const rows = d.flags?.[MODT]?.[FLAG]; if (Array.isArray(rows) && rows.length) docsWithRows.push(d); }
    }
  }
  for (const d of docsWithRows) {
    const rows = JSON.parse(JSON.stringify(d.flags[MODT][FLAG]));
    let touched = 0;
    for (const r of rows) { const want = OLD_TO_NEW[r.label]; if (want && r.label !== want) { report.push(`✚ hex ${d.name ?? d.id}: "${r.label}" → "${want}"`); r.label = want; touched++; } }
    if (touched) { hexChanges += touched; if (!DRY_RUN) await d.update({ [`flags.${MODT}.${FLAG}`]: rows }, { parent: d.parent }); }
  }
  // the hex-sheet JournalEntry/Actor homes (bbttcc-territory stores hexes as documents in some worlds)
  for (const coll of [game.journal, game.actors, game.items]) {
    for (const d of coll) {
      const rows = d.flags?.[MODT]?.[FLAG]; if (!Array.isArray(rows) || !rows.length) continue;
      const next = JSON.parse(JSON.stringify(rows)); let touched = 0;
      for (const r of next) { const want = OLD_TO_NEW[r.label]; if (want && r.label !== want) { report.push(`✚ ${d.documentName} ${d.name}: "${r.label}" → "${want}"`); r.label = want; touched++; } }
      if (touched) { hexChanges += touched; if (!DRY_RUN) await d.update({ [`flags.${MODT}.${FLAG}`]: next }); }
    }
  }
  const total = changes + hexChanges;
  console.log(`[patch-menace-labels] ${DRY_RUN ? "DRY RUN" : "APPLIED"} — ${changes} beat label(s), ${hexChanges} hex row(s)\n` + report.join("\n"));
  ui.notifications.info(`patch-menace-labels ${DRY_RUN ? "dry run" : "applied"}: ${total} change(s) — see console (F12).`);
})();

/* groom-tikkun-dividend.macro.js — wire the Tikkun Dividend + the Valhaulan Spark
 * (2026-07-15, FINALE-WIN-COUPLING-2026-07-15.md v2, owner-approved "build it")
 *
 * WHAT IT DOES (idempotent; DRY_RUN default true; backs up campaigns to
 * downloads before writing; never overwrites an existing stamp):
 *  1. Dividend rungs — worldEffects.tikkunDelta = { add: 1 } on the three
 *     arc-1 moral gates:
 *       khezek_tor_the_vaulhaulan_seal_restore   (the Seal, reclaimed kindly)
 *       raid_thatwards_outcome_friends           (the Finale, on human terms)
 *       gloomgill_passed                         (the exam, actually answered)
 *  2. THE VALHAULAN SPARK MADE REAL — beat.sparkLink (Yesod spark, action
 *     "acquire") on the two Spark-securing finale outcomes. Until now the
 *     campaign's macguffin granted quests and levels but no actual spark;
 *     the tikkun beat-listener routes this into the spark lifecycle.
 *       raid_thatwards_outcome_friends       methodTag "diplomacy"
 *       raid_thatwards_outcome_neutral_spark methodTag "intrigue" (Yesod-aligned:
 *         dreams, illusion, gateways — the dirty-truth heist suits the Foundation)
 *  3. Anchor cascades — worldEffects.purifyHexes on the rung beats: the map
 *     visibly heals where the story touched it (Purified then spreads via the
 *     existing per-turn neighbor cleansing).
 *     ⚠ FILL THE HEX NAMES BELOW — placeholders in <angle brackets> are
 *     skipped with a warning, so an unfilled macro is still safe to apply.
 *
 * Run as GM on EACH instance. Validate: run the beat from the Beats tab →
 * expect the ✨ TIKKUN ×N GM card, the badge in the Visualizer meta bar,
 * and (for the finale outcomes) the spark lifecycle chat from bbttcc-tikkun.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  // ── owner-tunable ─────────────────────────────────────────────────────────
  // Which authored Yesod spark IS the Valhaulan Spark (pack bbttcc-tikkun.sparks):
  //   spark_yesod_animate | spark_yesod_conceptual | spark_yesod_vestigial
  const VALHAULAN_SPARK_KEY = "spark_yesod_conceptual";

  const RUNG_BEATS = [
    "khezek_tor_the_vaulhaulan_seal_restore",
    "raid_thatwards_outcome_friends",
    "gloomgill_passed",
  ];

  const SPARK_GRANTS = {
    raid_thatwards_outcome_friends:       { sparkKey: VALHAULAN_SPARK_KEY, action: "acquire", methodTag: "diplomacy" },
    raid_thatwards_outcome_neutral_spark: { sparkKey: VALHAULAN_SPARK_KEY, action: "acquire", methodTag: "intrigue" },
  };

  // Anchor hexes per rung beat — hex names as they appear on the map.
  // Matching (here and at fire time) is NBSP-safe AND strips leading
  // decorations, so "✦ Allesh-Gilliam" still matches "Allesh-Gilliam".
  // Placeholders in <angle brackets> are skipped with a warn.
  const ANCHORS = {
    khezek_tor_the_vaulhaulan_seal_restore: ["Khezek-Tor"],          // the Seal's own mountain
    raid_thatwards_outcome_friends:         ["Allesh-Gilliam"],      // friendship lands at home
    gloomgill_passed:                       ["Lake Suspicious"],    // He That Was Oannes waits in the lake (owner canon 2026-07-15)
  };

  // ── load ──────────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [String(b?.id), b]));

  const report = [];
  let changes = 0;

  // Informational: does the chosen spark exist in the pack?
  try {
    const pack = game.packs?.get("bbttcc-tikkun.sparks");
    const idx = pack ? await pack.getIndex({ fields: ["flags"] }) : null;
    const hit = idx && [...idx].some(e =>
      e?.flags?.["bbttcc-tikkun"]?.identifier === VALHAULAN_SPARK_KEY || e?._id === VALHAULAN_SPARK_KEY);
    report.push(hit
      ? `· ok spark "${VALHAULAN_SPARK_KEY}" found in bbttcc-tikkun.sparks`
      : `⚠ spark "${VALHAULAN_SPARK_KEY}" NOT found by identifier in bbttcc-tikkun.sparks — verify the key (grant still stamps; the beat-listener resolves at fire time)`);
  } catch (_e) { report.push("⚠ could not index bbttcc-tikkun.sparks (module off?)"); }

  // ── 1. dividend rungs ─────────────────────────────────────────────────────
  for (const bid of RUNG_BEATS) {
    const b = byId.get(bid);
    if (!b) { report.push(`⚠ rung beat not found: ${bid}`); continue; }
    b.worldEffects = b.worldEffects || {};
    if (b.worldEffects.tikkunDelta?.add >= 1) { report.push(`· ok (already) ${bid} tikkunDelta`); }
    else { b.worldEffects.tikkunDelta = { add: 1 }; changes++; report.push(`✨ rung stamped: ${bid} → tikkunDelta +1`); }
  }

  // ── 2. the Valhaulan Spark ────────────────────────────────────────────────
  for (const [bid, link] of Object.entries(SPARK_GRANTS)) {
    const b = byId.get(bid);
    if (!b) { report.push(`⚠ spark beat not found: ${bid}`); continue; }
    if (b.sparkLink?.sparkKey) { report.push(`· ok (already) ${bid} sparkLink = ${b.sparkLink.sparkKey}`); continue; }
    b.sparkLink = { ...link };
    changes++; report.push(`🕎 Valhaulan Spark wired: ${bid} → ${link.sparkKey} (${link.action}, ${link.methodTag})`);
  }

  // ── 3. anchor cascades ────────────────────────────────────────────────────
  const norm = s => String(s || "").replace(/\s+/g, " ").trim()
    .replace(/^[^\p{L}\p{N}]+/u, "").trim().toLowerCase();
  const hexNames = new Set();
  for (const sc of game.scenes) for (const dr of sc.drawings.contents) {
    const f = dr.flags?.["bbttcc-territory"];
    if (f && (f.isHex === true || f.kind === "territory-hex" || f.hexId)) hexNames.add(norm(dr.text || f.name));
  }
  for (const [bid, names] of Object.entries(ANCHORS)) {
    const b = byId.get(bid);
    if (!b) { report.push(`⚠ anchor beat not found: ${bid}`); continue; }
    const usable = [];
    for (const n of names) {
      if (/^</.test(String(n).trim())) { report.push(`⚠ SKIP anchor for ${bid}: placeholder "${n}" — fill the real hex name`); continue; }
      if (!hexNames.has(norm(n))) { report.push(`⚠ SKIP anchor for ${bid}: hex "${n}" not found on any scene`); continue; }
      usable.push(n);
    }
    if (!usable.length) continue;
    b.worldEffects = b.worldEffects || {};
    const cur = Array.isArray(b.worldEffects.purifyHexes) ? b.worldEffects.purifyHexes : [];
    const add = usable.filter(n => !cur.some(c => norm(c) === norm(n)));
    if (!add.length) { report.push(`· ok (already) ${bid} anchors`); continue; }
    b.worldEffects.purifyHexes = [...cur, ...add];
    changes++; report.push(`🕯 anchors: ${bid} → Purify [${add.join(", ")}]`);
  }

  // ── report + write ────────────────────────────────────────────────────────
  console.log(`[groom-tikkun-dividend] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` +
    report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Tikkun DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Tikkun: nothing to do — already groomed.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-tikkun-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Tikkun APPLIED: ${changes} change(s). The dividend is wired — the land will remember.`);
})();

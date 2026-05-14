/* stamp-leygate-quest-beats.macro.js
 *
 * Pre-wires the Bad Eden Leygate Network's quest-unlock beats. Walks every
 * campaign stored in the bbttcc-campaign world setting, finds the named
 * trigger beats, and stamps `beat.gateUnlocks = [{hexUuid, action:"enable"}]`
 * so the bbttcc-gate-beat-listener flips the right gate when that beat
 * resolves.
 *
 * Default beat → anchor map (one end per beat):
 *   fixit_leyline_stabilizer_trade_success           → Furrier's Fixit-Farm
 *   fixit_leyline_stabilizer_shared_oversight_success→ Furrier's Fixit-Farm
 *   map_port_kudzu_intro                              → Port Kudzu
 *   khezek_tor_quest_acceptance                       → Khezek-Tor
 *   lyrenn_quest_acceptance                           → Lyrenn
 *   map_legansus_waystation_intro                     → Legansus Waystation
 *   map_crown_mall_intro                              → Crown Mall
 *
 * Anchors live on scene "Bad Eden, Starting Map". The macro resolves hex
 * Drawing UUIDs at runtime — re-run any time the scene's content shifts.
 *
 * SAFE TO RE-RUN. Idempotent: each beat's gateUnlocks is overwritten with
 * the canonical entry; non-listed beats are left alone. Edit anchors+map
 * below to retarget; or use the Campaign Beat Editor's new Gate Unlocks
 * panel to author per-beat unlocks by hand.
 */
(async () => {
  const SCENE_NAME = "Bad Eden, Starting Map";

  const ANCHOR_NAMES = [
    "Furrier's Fixit-Farm",
    "Port Kudzu",
    "Khezek-Tor",
    "Lyrenn",
    "Legansus Waystation",
    "Crown Mall"
  ];

  const BEAT_MAP = [
    { beatId: "fixit_leyline_stabilizer_trade_success",            anchor: "Furrier's Fixit-Farm" },
    { beatId: "fixit_leyline_stabilizer_shared_oversight_success", anchor: "Furrier's Fixit-Farm" },
    { beatId: "map_port_kudzu_intro",                              anchor: "Port Kudzu" },
    { beatId: "khezek_tor_quest_acceptance",                       anchor: "Khezek-Tor" },
    { beatId: "lyrenn_quest_acceptance",                           anchor: "Lyrenn" },
    { beatId: "map_legansus_waystation_intro",                     anchor: "Legansus Waystation" },
    { beatId: "map_crown_mall_intro",                              anchor: "Crown Mall" }
  ];

  if (!game.user.isGM) { ui.notifications?.error("GM only."); return; }

  const scene = game.scenes.getName(SCENE_NAME);
  if (!scene) { ui.notifications?.error(`Scene "${SCENE_NAME}" not found.`); return; }

  // anchor name → Drawing UUID
  const anchorUuid = new Map();
  for (const dr of scene.drawings) {
    const flg = dr.flags?.["bbttcc-territory"];
    if (!flg?.isHex) continue;
    const nm = String(flg.name || "").trim();
    if (ANCHOR_NAMES.includes(nm)) {
      anchorUuid.set(nm, `Scene.${scene.id}.Drawing.${dr.id}`);
    }
  }
  const missing = ANCHOR_NAMES.filter(n => !anchorUuid.has(n));
  if (missing.length) {
    ui.notifications?.error(`Anchor hex(es) not found on scene: ${missing.join(", ")}`);
    return;
  }

  // Load campaign registry. Stored as { [campaignId]: campaign } object.
  let campaigns;
  try {
    campaigns = game.settings.get("bbttcc-campaign", "campaigns");
  } catch (e) {
    ui.notifications?.error("Could not read bbttcc-campaign world setting.");
    return;
  }
  if (!campaigns || typeof campaigns !== "object" || !Object.keys(campaigns).length) {
    ui.notifications?.warn("No campaigns found in bbttcc-campaign setting.");
    return;
  }

  const beatIndex = new Map();           // beatId → reference into the campaigns object
  for (const camp of Object.values(campaigns)) {
    if (!Array.isArray(camp?.beats)) continue;
    for (const beat of camp.beats) {
      if (!beat?.id) continue;
      beatIndex.set(beat.id, { camp, beat });
    }
  }

  const stamped = [];
  const skipped = [];
  for (const entry of BEAT_MAP) {
    const found = beatIndex.get(entry.beatId);
    if (!found) { skipped.push({ ...entry, reason: "beat-not-found" }); continue; }
    const uuid = anchorUuid.get(entry.anchor);
    found.beat.gateUnlocks = [{ hexUuid: uuid, action: "enable" }];
    stamped.push({ beatId: entry.beatId, anchor: entry.anchor, beatLabel: found.beat.label || entry.beatId, camp: found.camp.label || found.camp.id });
  }

  // Persist.
  try {
    await game.settings.set("bbttcc-campaign", "campaigns", campaigns);
  } catch (e) {
    ui.notifications?.error("Failed to save campaigns: " + e.message);
    return;
  }

  // Report.
  const stampedRows = stamped.map(s =>
    `  ✓ ${s.beatLabel}  →  ${s.anchor}   <span style="opacity:.6;">[${s.beatId} · ${s.camp}]</span>`
  ).join("\n");
  const skippedRows = skipped.length
    ? `<p style="color:#caa;">Skipped (beat not in any campaign — author it in the Campaign Builder, then re-run):</p><pre>${skipped.map(s => `  - ${s.beatId}  (would unlock ${s.anchor})`).join("\n")}</pre>`
    : "";
  await ChatMessage.create({
    content: `<h3>Leygate Quest Beats — stamped</h3>
              <p>Each beat below now flips its anchor's <code>leylines.gate.enabled = true</code> when resolved.</p>
              <pre style="white-space:pre-wrap; font-size:.9em;">${stampedRows}</pre>
              ${skippedRows}
              <p style="margin-top:.4rem;">Edit any beat in the Campaign Beat Editor's <em>Gate Unlocks</em> panel to retarget.</p>`,
    whisper: [game.user.id]
  });
  ui.notifications?.info(`Stamped ${stamped.length} beats with Leygate unlocks (${skipped.length} skipped).`);
})();

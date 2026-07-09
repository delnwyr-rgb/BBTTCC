/* ============================================================================
 * Bad Eden — Link named hexes → On-Enter Beat ID  (GM macro)
 * ----------------------------------------------------------------------------
 * Stamps flags["bbttcc-territory"].campaign.onEnterBeatId on each named hex so
 * entering the hex fires its beat (and the beat's scene rides along, once one
 * is attached). Same field as the Hex Configuration dialog's "ON-ENTER BEAT ID".
 *
 * DRY_RUN = true  → preview only (no writes). Set false to apply.
 * Idempotent: skips hexes already pointing at the right beat.
 * Edit MAP below to change any pick. Run in the live Bad Eden world (GM).
 * ==========================================================================*/
(async () => {
  const DRY_RUN = true;                 // <-- set to false to actually write
  const MODT = "bbttcc-territory";

  // Hex display name  →  beat id to fire on enter
  const MAP = {
    "Allesh-Gilliam":        "allesh_gilliam_introduction_to_hq",   // alt: allesh_gilliam_opening_scene
    "Khezek-Tor":            "khezek_tor_main_scene",
    "Lyrenn":                "lyrenn_main_scene",
    "Furrier's Fixit-Farm":  "fixit_cinematic_intro",               // alt: fixit_intro_scene
    "Port Kudzu":            "map_port_kudzu_intro",
    "Bedlam Barrens":        "hod_flooded_bedlam_barrens",
    "Probably Beaumont":     "hod_flooded_probably_beaumont",
    "Maybe Beaumont?":       "hod_flooded_maybe_beaumont",
    "The Anchor Reach":      "map_anchor_reach_intro",
    "The Burnt Flats":       "map_burnt_flats_intro",
    "The Singing Mire":      "map_singing_mire_intro",
    "The Rotating Chapel":   "map_rotating_chapel_approach",
    "Legansus Waystation":   "map_legansus_waystation_intro",
    "Crown Mall":            "map_crown_mall_intro",
  };

  if (!game.user.isGM) return ui.notifications.error("GM only.");

  // collect valid beat ids from the campaign store (to warn on typos / missing beats)
  let validBeats = new Set();
  try {
    const camps = game.settings.get("bbttcc-campaign", "campaigns") || {};
    for (const c of Object.values(camps)) for (const b of (c.beats || [])) if (b?.id) validBeats.add(b.id);
  } catch (e) { console.warn("[link-hex-beats] couldn't read campaigns:", e); }

  // index hexes by name across all scenes
  const found = new Map();   // name -> DrawingDocument
  for (const sc of game.scenes ?? []) {
    for (const d of sc.drawings ?? []) {
      const tf = d.flags?.[MODT]; if (!tf?.isHex) continue;
      if (MAP[tf.name] && !found.has(tf.name)) found.set(tf.name, { d, scene: sc.name });
    }
  }

  const rows = [];
  for (const [name, beatId] of Object.entries(MAP)) {
    const hit = found.get(name);
    if (!hit) { rows.push({ name, beatId, status: "HEX NOT FOUND", scene: "—" }); continue; }
    const cur = String((hit.d.getFlag(MODT, "campaign") || {}).onEnterBeatId || "");
    const beatOk = validBeats.size === 0 || validBeats.has(beatId);
    let status;
    if (cur === beatId) status = "already set ✓";
    else if (!beatOk) status = `BEAT ID NOT IN CAMPAIGN (${beatId})`;
    else status = DRY_RUN ? `would set (was: ${cur || "∅"})` : `SET (was: ${cur || "∅"})`;

    if (!DRY_RUN && cur !== beatId && beatOk) {
      const prev = hit.d.getFlag(MODT, "campaign") || {};
      await hit.d.setFlag(MODT, "campaign", { ...prev, onEnterBeatId: beatId });
    }
    rows.push({ name, beatId, status, scene: hit.scene });
  }

  // report
  const html = `<h3>Hex → On-Enter Beat ${DRY_RUN ? "(DRY RUN — no writes)" : "(APPLIED)"}</h3>`
    + `<table style="font-size:11px"><tr><th>Hex</th><th>Beat</th><th>Scene</th><th>Status</th></tr>`
    + rows.map(r => `<tr><td><b>${foundry.utils.escapeHTML(r.name)}</b></td><td><code>${r.beatId}</code></td><td>${r.scene}</td><td>${r.status}</td></tr>`).join("")
    + `</table>${DRY_RUN ? "<p><i>Set <b>DRY_RUN = false</b> and re-run to apply.</i></p>" : ""}`;
  await ChatMessage.create({ content: html, whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id), speaker: { alias: "Hex↔Beat Linker" } });
  console.table(rows);
  ui.notifications.info(`Hex→Beat ${DRY_RUN ? "preview" : "applied"}: ${rows.length} rows (see chat/console).`);
})();

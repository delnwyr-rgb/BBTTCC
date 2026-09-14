// Bad Eden — Sparks in the world: every quest's closing ending lights its hex's spark (2026-09-13)
// ─────────────────────────────────────────────────────────────────────────────
// Owner ruling 2026-09-13 ("I like the spark rule, let's ship it"): a quest's closing
// ending integrates the spark seated on its hex, so all ten sephirot are reachable by
// play and the Ten Lamps / Daath / the Dragon become something a table can arrive at.
// The two spark QUESTS become the two places where the spark is the subject:
//   • The Lost Stone Statues teaches JUDGMENT — the three Gevurah kinds sit on the three
//     judges; "worthy" integrates clean, "force" lands the fragment CORRUPTED.
//   • The Hex Flooded Towns teaches REPAIR — the Hod sparks sit on the three flooded
//     towns already CORRUPTED by the seal blast; the calm endings repair, "Echoes
//     Reconstituting" repairs and lights all three.
//
// What this macro does (idempotent, DRY_RUN first, backs up the campaigns setting):
//   1. PLACEMENTS — seats/moves sparks on hexes (via api.tikkun.hex; a kind may burn in
//      more than one place — Lamps count sephirot, yield is per hex).
//   2. STAMPS — writes worldEffects.hexSpark rows onto the ending beats listed below.
//   3. FIX — the Lost Stone Statues quest had TWO completers (Geburah Made Whole in act 3
//      AND the Garden's count in act 4); the count now only opens The Ninth Guest.
//
// ⚠ KT_SPARK: the mine is the Yesodium mine. The 09-01 placement seated Gevurah there;
//   this macro moves that Gevurah to statue III and seats Yesod (animate) at Khezek-Tor.
//   Flip KT_SPARK to "spark_gevurah_animate" and remove the statue-III row to keep the
//   old reading. Owner's call — the report says which it did.
//
// Run as GM in the canonical world with "Thatward's Ho!" active. DRY_RUN = true prints
// the plan and changes nothing. Flip to false in the pasted copy, never in the repo.

(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  const TER = "bbttcc-territory";
  const KT_SPARK = "spark_yesod_animate";

  const log = (...a) => console.log("[seed-spark-endings]", ...a);
  if (!game.user?.isGM) return ui.notifications?.error("GM only");
  const hexApi = game.bbttcc?.api?.tikkun?.hex;
  if (!hexApi?.seat) return ui.notifications?.error("bbttcc-tikkun hex API not found — reload after deploy");

  // ── hex lookup over board scenes (NBSP-safe) ──────────────────────────────
  const norm = (s) => String(s || "").replace(/[\s ]+/g, " ").trim().toLowerCase();
  const boardScenes = (game.scenes?.contents ?? []).filter(sc => sc.getFlag("bbttcc-epic", "boardScene") === true);
  const hexByName = (name) => {
    const want = norm(name);
    for (const sc of boardScenes) for (const d of (sc.drawings ?? [])) {
      const tf = d.flags?.[TER]; if (!tf || !(tf.isHex === true || tf.kind === "territory-hex")) continue;
      if (norm(tf.name || tf.hexName || d.text) === want) return d;
    }
    return null;
  };

  // ── 1. PLACEMENTS ─────────────────────────────────────────────────────────
  const PLACEMENTS = [
    { hex: "Northreach Expanse b",     key: "spark_gevurah_conceptual", state: "dormant",   why: "Lost Statue I — Measured Strength" },
    { hex: "Inconvenient Mountains.q", key: "spark_gevurah_vestigial",  state: "dormant",   why: "Lost Statue II — Endurance" },
    { hex: "Inconvenient Mountains.o", key: "spark_gevurah_animate",    state: "dormant",   why: "Lost Statue III — Protective Strength" },
    { hex: "Khezek-Tor",               key: KT_SPARK,                   state: "dormant",   why: "the Yesodium mine (KT_SPARK)" },
    { hex: "Probably Beaumont",        key: "spark_hod_conceptual",     state: "corrupted", why: "Hex Flooded Town — carved by the seal blast" },
    { hex: "Maybe Beaumont?",          key: "spark_hod_vestigial",      state: "corrupted", why: "Hex Flooded Town — carved by the seal blast" },
    { hex: "Bedlam Barrens",           key: "spark_hod_animate",        state: "corrupted", why: "Hex Flooded Town — carved by the seal blast" },
    { hex: "PolygonWood.a",            key: "spark_chokmah_conceptual", state: "dormant",   why: "The Hidden Vault — the wiser guess moves north" },
  ];

  // ── 2. STAMPS: beatId → hexSpark rows ─────────────────────────────────────
  const I = (hex) => ({ action: "integrate", hexName: hex });
  const C = (hex) => ({ action: "corrupt",   hexName: hex });
  const R = (hex) => ({ action: "repair",    hexName: hex });
  const STAMPS = {
    // towns
    lyrenn_hex_settles: [I("Lyrenn")],
    fixit_hex_settles: [I("Furrier's Fixit-Farm")],
    khezek_tor_the_vaulhaulan_seal_restore: [I("Khezek-Tor")],
    khezek_hex_settles: [I("Khezek-Tor")],
    raid_thatwards_outcome_friends: [I("Allesh-Gilliam")],
    raid_thatwards_outcome_neutral_spark: [I("Allesh-Gilliam")],
    // the widening trail
    map_rotating_chapel_map: [I("The Rotating Chapel")],
    map_rotating_chapel_harmonize: [I("The Rotating Chapel")],
    map_rotating_chapel_force: [C("The Rotating Chapel")],
    map_burnt_flats_pattern: [I("The Burnt Flats")],
    map_burnt_flats_partial: [I("The Burnt Flats")],
    map_singing_mire_truth: [I("The Singing Mire")],
    map_singing_mire_counter: [I("The Singing Mire")],
    map_singing_mire_partial: [I("The Singing Mire")],
    map_anchor_reach_stabilize: [I("The Anchor Reach")],
    map_anchor_reach_break: [C("The Anchor Reach")],
    map_port_kudzu_testimony: [I("Port Kudzu")],
    map_port_kudzu_partial: [I("Port Kudzu")],
    map_legansus_waystation_verified: [I("Legansus Waystation")],
    map_legansus_waystation_flagged: [I("Legansus Waystation")],
    map_crown_mall_corroboration: [I("Crown Mall")],
    map_crown_mall_partial: [I("Crown Mall")],
    // the hidden vault (PolygonWood.a) · gloomgill (Odaroloc Depths)
    enc_hidden_vault_resolution_good: [I("PolygonWood.a")],
    enc_hidden_vault_resolution_neutral: [I("PolygonWood.a")],
    enc_hidden_vault_resolution_hostile: [C("PolygonWood.a")],
    gloomgill_passed: [I("Odaroloc Depths")],
    // the lost stone statues — judgment
    spark_geburah_northreach_b_worthy: [I("Northreach Expanse b")],
    spark_geburah_northreach_b_force: [C("Northreach Expanse b")],
    spark_geburah_mountains_q_worthy: [I("Inconvenient Mountains.q")],
    spark_geburah_mountains_q_force: [C("Inconvenient Mountains.q")],
    spark_geburah_mountains_o_worthy: [I("Inconvenient Mountains.o")],
    spark_geburah_mountains_o_force: [C("Inconvenient Mountains.o")],
    // the hex flooded towns — repair
    hod_flooded_probably_beaumont_stabilize: [R("Probably Beaumont")],
    hod_flooded_maybe_beaumont_interrupt: [R("Maybe Beaumont?")],
    hod_flooded_bedlam_barrens_ground: [R("Bedlam Barrens")],
    spark_hod_echoes_reconstituting: [R("Probably Beaumont"), R("Maybe Beaumont?"), R("Bedlam Barrens"),
                                     I("Probably Beaumont"), I("Maybe Beaumont?"), I("Bedlam Barrens")],
  };

  // ── 3. FIX: the Garden's count no longer completes the Lost Stone Statues ─
  const STATUES_QUEST = "quest_jivVj3iGErW53Wxl";
  const COUNT_BEAT = "founders_garden_the_count";

  // ── load campaign ─────────────────────────────────────────────────────────
  let campaigns = game.settings.get(NS, "campaigns");
  if (typeof campaigns === "string") { try { campaigns = JSON.parse(campaigns); } catch (_e) {} }
  campaigns = foundry.utils.deepClone(campaigns || {});
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = cid && campaigns[cid];
  if (!camp || !Array.isArray(camp.beats)) return ui.notifications?.error("No active campaign with beats");
  const byId = new Map(camp.beats.map(b => [String(b.id), b]));

  const report = { placements: [], stamps: [], fix: [], missing: [] };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // placements plan
  for (const p of PLACEMENTS) {
    const d = hexByName(p.hex);
    if (!d) { report.missing.push(`hex not found: ${p.hex}`); continue; }
    const cur = d.flags?.[TER]?.spark || null;
    const wantKey = hexApi.canonicalKey ? hexApi.canonicalKey(p.key) : p.key;
    const curKey = cur?.key ? (hexApi.canonicalKey ? hexApi.canonicalKey(cur.key) : cur.key) : null;
    if (curKey === wantKey && (cur.state || "dormant") === p.state) { report.placements.push(`= ${p.hex}: ${wantKey} (${p.state}) already`); continue; }
    if (cur && cur.state === "integrated") { report.placements.push(`! ${p.hex}: holds INTEGRATED ${curKey} — left alone`); continue; }
    report.placements.push(`${curKey ? `~ ${p.hex}: ${curKey}:${cur.state} → ` : `+ ${p.hex}: `}${wantKey} (${p.state}) — ${p.why}`);
    if (!DRY_RUN) {
      if (curKey && curKey !== wantKey) await hexApi.unseat(d.uuid);
      if (curKey !== wantKey) await hexApi.seat(d.uuid, wantKey, { state: "dormant" });
      if (p.state === "corrupted") await hexApi.corrupt(d.uuid);
      if (p.state === "dormant" && cur && cur.state === "corrupted" && curKey === wantKey) await hexApi.repair(d.uuid);
    }
  }

  // stamps plan
  let stampChanged = 0;
  for (const [beatId, rows] of Object.entries(STAMPS)) {
    const b = byId.get(beatId);
    if (!b) { report.missing.push(`beat not found: ${beatId}`); continue; }
    for (const r of rows) if (!hexByName(r.hexName)) report.missing.push(`hex not found for ${beatId}: ${r.hexName}`);
    b.worldEffects = b.worldEffects || {};
    if (same(b.worldEffects.hexSpark, rows)) { report.stamps.push(`= ${beatId} already`); continue; }
    report.stamps.push(`+ ${beatId}: ${rows.map(r => `${r.action} ${r.hexName}`).join(" · ")}`);
    b.worldEffects.hexSpark = rows; stampChanged++;
  }

  // completer fix
  const countBeat = byId.get(COUNT_BEAT);
  if (countBeat) {
    const qe = countBeat.worldEffects?.questEffects || [];
    const keep = qe.filter(e => !(e && e.action === "complete" && String(e.questId) === STATUES_QUEST));
    if (keep.length !== qe.length) { report.fix.push(`− ${COUNT_BEAT}: dropped 'complete ${STATUES_QUEST}' (the count only opens The Ninth Guest)`); countBeat.worldEffects.questEffects = keep; stampChanged++; }
    else report.fix.push(`= ${COUNT_BEAT}: no statues completer present`);
  } else report.missing.push(`beat not found: ${COUNT_BEAT}`);

  // ── write ─────────────────────────────────────────────────────────────────
  if (!DRY_RUN && stampChanged) {
    const backup = game.settings.get(NS, "campaigns");
    const blob = typeof backup === "string" ? backup : JSON.stringify(backup);
    (foundry.utils.saveDataToFile || saveDataToFile)(blob, "application/json", `backup-campaigns-before-spark-endings-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await game.settings.set(NS, "campaigns", campaigns);
  }

  const lines = [
    `<b>seed-spark-endings — ${DRY_RUN ? "DRY RUN (nothing written)" : "APPLIED"}</b>`,
    `<b>Placements (${report.placements.length})</b><br>${report.placements.map(x => `&nbsp;${x}`).join("<br>")}`,
    `<b>Ending stamps (${report.stamps.length}, ${stampChanged} changed)</b><br>${report.stamps.map(x => `&nbsp;${x}`).join("<br>")}`,
    `<b>Completer fix</b><br>${report.fix.map(x => `&nbsp;${x}`).join("<br>")}`,
    report.missing.length ? `<b style="color:#c66">Missing (${report.missing.length})</b><br>${report.missing.map(x => `&nbsp;${x}`).join("<br>")}` : "<i>nothing missing</i>",
    `<i>KT_SPARK = ${KT_SPARK}</i>`
  ];
  log(report);
  await ChatMessage.create({ content: `<div class="bbttcc-seed-report" style="font-size:12px">${lines.join("<hr>")}</div>`, whisper: game.users.filter(u => u.isGM).map(u => u.id) });
  ui.notifications?.info(`seed-spark-endings: ${DRY_RUN ? "dry run posted" : "applied"} — ${report.missing.length} missing`);
})();

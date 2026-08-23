/* wire-lost-statue-cinematics.macro.js — POV approach shots for the Geburah trio
 * 2026-08-18. Ref: LOST-STATUES-ART-REFERENCE-2026-08-17.md
 *
 * Turns each Lost Stone Statue beat into a CINEMATIC: entering the hex plays
 * the 4K POV approach, then lands on the map, then runs the beat as normal.
 * Same primitive the Balcones and dive scenes use — a two-scene chain:
 *   activate startScene → wait durationMs → activate nextScene
 * (api.encounters: `beat.cinematic = { enabled, startSceneId, durationMs,
 * nextSceneId }`; `enabled` works on ANY beat type, so these stay skill_scenes
 * and keep their choices.)
 *
 * ✅ No new beats and no new hex wiring — the three statue beats are ALREADY
 * the hexes' onEnterBeatId (verified 2026-08-17 by wire-hex-onenter-from-tags):
 *   Northreach Expanse b      → spark_geburah_northreach_b
 *   Inconvenient Mountains.q  → spark_geburah_mountains_q
 *   Inconvenient Mountains.o  → spark_geburah_mountains_o
 * This macro only adds the cinematic block to those three.
 *
 * ⚠ NEVER OVERWRITES an existing cinematic config — reports and skips.
 * Scene matching is fuzzy and reported: the POV scene must contain "pov",
 * the map scene must NOT. If either is ambiguous or missing, that statue is
 * SKIPPED and every scene name is printed so you can correct the config.
 *
 * DRY_RUN default true. Idempotent. Backs up campaigns before writing. GM only.
 */
(async () => {
  const DRY_RUN = false;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  // `base` is matched against scene names (case/punctuation-insensitive).
  // ms = how long the POV plays before the map takes over; the bake trims to
  // 10s, so 10000 runs the clip to its end.
  const STATUES = [
    { n: 1, beat: "spark_geburah_northreach_b", base: "lost statue 1", ms: 10000, site: "Northreach Expanse b — Measured Strength" },
    { n: 2, beat: "spark_geburah_mountains_q",  base: "lost statue 2", ms: 10000, site: "Inconvenient Mountains.q — Endurance" },
    { n: 3, beat: "spark_geburah_mountains_o",  base: "lost statue 3", ms: 10000, site: "Inconvenient Mountains.o — Protective Strength" }
  ];

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const SCENES = game.scenes.contents.map(s => ({ doc: s, name: s.name, key: norm(s.name) }));
  const report = [];
  let changes = 0;

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));

  const listScenes = () => "  scenes in world: " + SCENES.map(s => `"${s.name}"`).join(" · ");

  for (const st of STATUES) {
    const want = norm(st.base);
    // POV = contains the base AND "pov". Map = contains the base and NOT "pov".
    const povs = SCENES.filter(s => s.key.includes(want) && s.key.includes("pov"));
    const maps = SCENES.filter(s => s.key.includes(want) && !s.key.includes("pov"));

    if (povs.length !== 1 || maps.length !== 1) {
      report.push(`⚠ statue ${st.n} — need exactly 1 POV + 1 map scene matching "${st.base}", found ${povs.length} POV / ${maps.length} map. SKIPPED.`);
      report.push(`    POV candidates: ${povs.map(s => s.name).join(" · ") || "(none)"}`);
      report.push(`    map candidates: ${maps.map(s => s.name).join(" · ") || "(none)"}`);
      continue;
    }
    const pov = povs[0], map = maps[0];

    const beat = byId.get(st.beat);
    if (!beat) { report.push(`⚠ statue ${st.n} — beat '${st.beat}' NOT FOUND in the live campaign, SKIPPED.`); continue; }

    if (beat.cinematic?.enabled) {
      report.push(`· ok statue ${st.n} — '${st.beat}' already cinematic (start=${beat.cinematic.startSceneId}, next=${beat.cinematic.nextSceneId}) — NOT overwritten`);
      continue;
    }

    changes++;
    report.push(`🎬 statue ${st.n} (${st.site})`);
    report.push(`    beat  ${st.beat}`);
    report.push(`    POV   "${pov.name}"  →  ${st.ms}ms  →  map "${map.name}"`);
    if (!DRY_RUN) {
      beat.cinematic = {
        enabled: true,
        startSceneId: pov.doc.id,
        durationMs: st.ms,
        nextSceneId: map.doc.id
      };
    }
  }

  if (!changes && !report.some(r => r.startsWith("·"))) report.push(listScenes());

  console.log(`[wire-lost-statue-cinematics] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Lost Statue cinematics DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Lost Statue cinematics: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-statue-cinematics-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Lost Statue cinematics APPLIED: ${changes} change(s). Walk in and the approach plays.`);
})();

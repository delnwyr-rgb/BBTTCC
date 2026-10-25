// seed-opening-titles-slides.macro.js — the Keynote opening titles ("As Above, So Below" crawl) become the
// Act 0 opening beats (2026-10-25, Dave: "slides 1-4 → A0-B1, 5-12 → A0-B2, 13-16 → A0-B3, 17-20 → A0-B4,
// 21-27 → A0-B5, 28 → A0-B6, 29-34 → A0-B7, 35-37 → A0-B8; play once, then stop until the GM forwards the beat").
//
// What it does (idempotent, GM only, DRY_RUN first, backs up `campaigns`):
//   1. Creates eight 1920×1080 black scenes "Offices — Opening Titles 1/8 …" (gridless, no vision, no fog,
//      players OBSERVER) each holding ONE full-frame video Tile: the segment cut from the deck export
//      (loop OFF, autoplay ON, muted) → plays once and freezes on its last frame until the next beat.
//   2. Patches the eight Saying beats: type "cinematic" + cinematic{startSceneId, durationMs} (the Tamsin-dream
//      pattern), audio = the matching VO cut from Dave's 10-10 take ("Opening Slides, Take 3"; stems without the
//      music — Section D stays the wake handler's job), autoplay + broadcast to players, the player text mirror OFF
//      (the words are on screen), and a single "…" choice chaining B1 → … → B7 → B8. B8 (Adam Kadmon) keeps no
//      choices: its resolve is what fires the onboarding "Report for training" card + Section D.
//   3. Clears `sceneId` on A0-B1 (the cinematic runner must not also activate it).
// Media (deployed by hand — outside the repo): art/bbttcc/GOTTGAIT/GOTTGAIT Scene files/opening_titles/<file>.mp4 + .mp3
// Offline check: node modules/bbttcc-campaign/tools/sim-patch.mjs <this> <campaigns-export.json> --out patched.json
//                (the shim has no game.scenes → scenes are reported, beats get "Scene.<created on apply>").

(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications?.error("GM only");
  const report = [];
  let changes = 0;

  const DIR = "art/bbttcc/GOTTGAIT/GOTTGAIT%20Scene%20files/opening_titles/";
  const W = 1920, H = 1080;
  const OBSERVER = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2;   // players may view the slides (shim-safe)
  const SCENE_PREFIX = "Offices — Opening Titles";
  // Segment boundaries come from ~/Movies/BadEdenTitles/v5/schedule5.json (the v5 front half); ms = held video length.
  const SEGS = [
    { n: 1, file: "a0_b1_as_above",           beat: "fates_and_destinies_saying_as_above",          label: "As Above, So Below",           ms: 10350 },
    { n: 2, file: "a0_b2_form_consciousness", beat: "fates_and_destinies_saying_form_consciousness", label: "Form and Consciousness",       ms: 17340 },
    { n: 3, file: "a0_b3_map_territory",      beat: "fates_and_destinies_map_territory",            label: "The Map Is Not The Territory", ms: 8870 },
    { n: 4, file: "a0_b4_attention_energy",   beat: "fates_and_destinies_attention_energy",         label: "Where Attention Goes",         ms: 7840 },
    { n: 5, file: "a0_b5_dont_stop_believing",beat: "fates_and_destinies_bus_explodes",             label: "Don't Stop Believing",         ms: 19010 },
    { n: 6, file: "a0_b6_remember_and_be",    beat: "fates_and_destinies_attention_remember",       label: "Remember, and Be",             ms: 4230 },
    { n: 7, file: "a0_b7_incarnate",          beat: "fates_and_destinies_incarnate",                label: "You're Incarnate",             ms: 15370 },
    { n: 8, file: "a0_b8_adam_kadmon",        beat: "fates_and_destinies_adam_kadmon",              label: "Guess What (Adam Kadmon)",     ms: 74430 }
  ];

  // ── 1. the scenes ─────────────────────────────────────────────────────────
  const scenesApi = game.scenes ?? null;      // absent in the sim-patch shim
  let folderId = null;
  if (scenesApi && game.folders) {
    let folder = game.folders.find(f => f.type === "Scene" && f.name === SCENE_PREFIX);
    if (!folder) {
      report.push(`✚ CREATE scene folder "${SCENE_PREFIX}"`);
      if (!DRY_RUN && globalThis.Folder?.create) folder = await Folder.create({ name: SCENE_PREFIX, type: "Scene", color: "#111111" });
    } else report.push(`· ok (already) scene folder "${SCENE_PREFIX}" (${folder.id})`);
    folderId = folder?.id ?? null;
  }
  const sceneUuidFor = {};
  for (const s of SEGS) {
    const name = `${SCENE_PREFIX} ${s.n}/8 — ${s.label}`;
    const video = DIR + s.file + ".mp4";
    let scene = scenesApi ? (scenesApi.getName?.(name) || scenesApi.contents?.find(x => x.name === name)) : null;
    const tileData = {
      x: 0, y: 0, width: W, height: H, rotation: 0, alpha: 1, hidden: false, locked: true, sort: 0, elevation: 0,
      texture: { src: video, fit: "fill", anchorX: 0, anchorY: 0, scaleX: 1, scaleY: 1, tint: "#ffffff", alphaThreshold: 0 },
      video: { loop: false, autoplay: true, volume: 0 },
      occlusion: { mode: 0, alpha: 0 }, restrictions: { light: false, weather: false }
    };
    if (scene) {
      report.push(`· ok (already) scene "${name}" (${scene.id})`);
      // keep the tile honest if someone touched it: exactly one tile, our video, loop off
      const tiles = scene.tiles?.contents ?? [];
      const t0 = tiles.find(t => String(t.texture?.src || "") === video);
      if (!t0) {
        report.push(`  ✚ ADD video tile to "${name}" (${video})`);
        if (!DRY_RUN) await scene.createEmbeddedDocuments("Tile", [tileData]);
      } else if (t0.video?.loop !== false || t0.video?.autoplay !== true) {
        report.push(`  ✎ FIX tile playback on "${name}" (loop off, autoplay on)`);
        if (!DRY_RUN) await scene.updateEmbeddedDocuments("Tile", [{ _id: t0.id, "video.loop": false, "video.autoplay": true, "video.volume": 0 }]);
      }
    } else {
      const base = {
        name, width: W, height: H, padding: 0, navigation: false, navName: "",
        background: { src: null }, backgroundColor: "#000000", foreground: null,
        grid: { type: 0, size: 100 }, tokenVision: false,
        fog: { exploration: false }, environment: { globalLight: { enabled: true }, darknessLevel: 0 },
        initial: { x: Math.round(W / 2), y: Math.round(H / 2), scale: 1 },
        ownership: { default: OBSERVER },
        folder: folderId, tiles: [tileData],
        flags: { [NS]: { openingTitles: { segment: s.n, beatId: s.beat, file: s.file, ms: s.ms } } }
      };
      report.push(`✚ CREATE scene "${name}" (${W}×${H}, black, 1 video tile loop=off autoplay=on: ${video})`);
      if (!DRY_RUN && globalThis.Scene?.create) scene = await Scene.create(base);
    }
    sceneUuidFor[s.beat] = scene ? `Scene.${scene.id}` : "Scene.<created on apply>";
    if (!scene) changes++;
  }

  // ── 2. the beats ──────────────────────────────────────────────────────────
  let campaigns = game.settings.get(NS, "campaigns");
  if (typeof campaigns === "string") { try { campaigns = JSON.parse(campaigns); } catch (_e) {} }
  campaigns = JSON.parse(JSON.stringify(campaigns || {}));   // true copy (feedback_settings_patch_true_copy)
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.() || Object.keys(campaigns)[0];
  const camp = cid && campaigns[cid];
  if (!camp?.beats) return ui.notifications?.error("No active campaign with beats");
  const byId = new Map(camp.beats.map(b => [String(b.id), b]));
  const missing = SEGS.filter(s => !byId.get(s.beat)).map(s => s.beat);
  if (missing.length) return ui.notifications?.error(`beats missing: ${missing.join(", ")}`);

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  SEGS.forEach((s, i) => {
    const b = byId.get(s.beat);
    const nextBeat = SEGS[i + 1]?.beat ?? null;
    const want = {
      type: "cinematic",
      sceneId: null,
      cinematic: { enabled: true, startSceneId: sceneUuidFor[s.beat], durationMs: s.ms, nextSceneId: null },
      audio: { enabled: true, src: DIR + s.file + ".mp3", volume: 0.85, loop: false, autoplay: true, broadcastPlayers: true, playlistSoundUuid: "" },
      playerFacing: false, playerFacingDialog: false, dialogPlayerFacing: false,
      choices: nextBeat ? [{ label: "…", next: nextBeat, description: "" }] : (Array.isArray(b.choices) ? b.choices : [])
    };
    const before = {};
    for (const k of Object.keys(want)) before[k] = b[k];
    if (same(before, want)) { report.push(`· ok (already) ${s.beat}`); return; }
    const diffs = Object.keys(want).filter(k => !same(b[k], want[k]));
    report.push(`✎ ${s.beat}: ${diffs.join(", ")}` + (nextBeat ? ` → "…" → ${nextBeat}` : " (no chain; resolve = wake card + Section D)"));
    Object.assign(b, want);
    changes++;
  });
  if (camp.openingBeatId !== SEGS[0].beat) { report.push(`· openingBeatId "${camp.openingBeatId}" → "${SEGS[0].beat}"`); camp.openingBeatId = SEGS[0].beat; changes++; }

  // ── 3. write ──────────────────────────────────────────────────────────────
  report.unshift(`${DRY_RUN ? "DRY RUN" : "APPLY"} — opening titles slides → Act 0 beats (campaign ${cid}, ${camp.beats.length} beats): ${changes} change(s)`);
  console.log(report.join("\n"));
  if (DRY_RUN) return ui.notifications?.info(`Opening titles: DRY RUN — ${changes} change(s); see console`);
  if (!changes) return ui.notifications?.info("Opening titles: nothing to change");
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const raw = game.settings.get(NS, "campaigns");
    saveDataToFile?.(typeof raw === "string" ? raw : JSON.stringify(raw), "application/json", `campaigns-backup-before-opening-titles-${stamp}.json`);
  } catch (_eB) {}
  await game.settings.set(NS, "campaigns", campaigns);
  ui.notifications?.info(`Opening titles applied — ${changes} change(s). Fire ${SEGS[0].beat} from the GM seat to run the crawl.`);
})();

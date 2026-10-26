// seed-teaching-slides.macro.js — the ten Teaching Slides become play-once line animations (2026-10-25, Dave's
// storyboard: point → line → cube → the Tree as projector → the lens shatters → jagged edges → the caretaker's
// crooked cube → it shoots the hostage → hexes → the wounded hex healed → the frontier). White field, black line,
// gold light, one red wound. Rendered by tools/teaching-slides/render_teaching_slides.py, timed to each slide's VO.
//
// Same pattern as seed-opening-titles-slides.macro.js: one black-less (white) 1920×1080 scene per beat holding ONE
// full-frame video Tile (loop off, autoplay on, muted → plays once, freezes on the last frame; play-once-tiles.js
// rewinds it on every seat), beat → type cinematic + cinematic{startSceneId, durationMs}, the EXISTING VO
// (teaching-slide-N.wav) switched on with autoplay + broadcast, the player text mirror off (the VO carries the
// words), and the existing "Progress Slide" choices left exactly as they are (1→2→…→10→Thatwards Ho).
// Idempotent, GM only, DRY_RUN first, backs up `campaigns`. The old "Offices of Fates and Destinies - Slide NN"
// scenes are left untouched (the beats simply no longer point at them).
// Media (deployed by hand — outside the repo): art/bbttcc/GOTTGAIT/GOTTGAIT Scene files/opening_titles/a0_tsNN.mp4 (v2 timings)
//        + art/bbttcc/GOTTGAIT/Tunes/Mal Voice Acting/teaching-slide-N.v2.wav

(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications?.error("GM only");
  const report = [];
  let changes = 0;

  const DIR = "art/bbttcc/GOTTGAIT/GOTTGAIT%20Scene%20files/opening_titles/";
  const VO_DIR = "art/bbttcc/GOTTGAIT/Tunes/Mal%20Voice%20Acting/";
  const W = 1920, H = 1080;
  const SCENE_PREFIX = "Offices — Teaching Slides";
  const OBSERVER = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2;
  // ms = VO length + 2 s tail (render_teaching_slides.py VO table). v2 = Dave's 2026-10-25 re-record
  // (one take, cut + cleaned by tools/teaching-slides/cut_teaching_vo.py → teaching-slide-N.v2.wav); the beats' audio
  // src is re-pointed at the v2 files (the v1 wavs stay on disk).
  const SEGS = [
    { n: 1,  beat: "fates_and_destinies_1",  label: "Perfection",            ms: 23700 },
    { n: 2,  beat: "fates_and_destinies_2",  label: "Form",                  ms: 26600 },
    { n: 3,  beat: "fates_and_destinies_3",  label: "Projector and Lens",    ms: 41700 },
    { n: 4,  beat: "fates_and_destinies_4",  label: "Bad Choices",           ms: 43400 },
    { n: 5,  beat: "fates_and_destinies_5",  label: "Jagged Edges",          ms: 27700 },
    { n: 6,  beat: "fates_and_destinies_6",  label: "He Alone Could Fix It", ms: 37620 },
    { n: 7,  beat: "fates_and_destinies_7",  label: "Shot the Hostage",      ms: 33600 },
    { n: 8,  beat: "fates_and_destinies_8",  label: "Hexes",                 ms: 56620 },
    { n: 9,  beat: "fates_and_destinies_9",  label: "Still Fucking It Up",   ms: 33550 },
    { n: 10, beat: "fates_and_destinies_10", label: "The Frontier",          ms: 19200 }
  ];

  // ── 1. the scenes ─────────────────────────────────────────────────────────
  const scenesApi = game.scenes ?? null;      // absent in the sim-patch shim
  let folderId = null;
  if (scenesApi && game.folders) {
    let folder = game.folders.find(f => f.type === "Scene" && f.name === SCENE_PREFIX);
    if (!folder) {
      report.push(`✚ CREATE scene folder "${SCENE_PREFIX}"`);
      if (!DRY_RUN && globalThis.Folder?.create) folder = await Folder.create({ name: SCENE_PREFIX, type: "Scene", color: "#f4f4f4" });
    } else report.push(`· ok (already) scene folder "${SCENE_PREFIX}" (${folder.id})`);
    folderId = folder?.id ?? null;
  }
  const sceneUuidFor = {};
  for (const s of SEGS) {
    const name = `${SCENE_PREFIX} ${s.n}/10 — ${s.label}`;
    const video = `${DIR}a0_ts${String(s.n).padStart(2, "0")}.mp4`;
    let scene = scenesApi ? (scenesApi.getName?.(name) || scenesApi.contents?.find(x => x.name === name)) : null;
    const tileData = {
      x: 0, y: 0, width: W, height: H, rotation: 0, alpha: 1, hidden: false, locked: true, sort: 0, elevation: 0,
      texture: { src: video, fit: "fill", anchorX: 0, anchorY: 0, scaleX: 1, scaleY: 1, tint: "#ffffff", alphaThreshold: 0 },
      video: { loop: false, autoplay: true, volume: 0 },
      occlusion: { mode: 0, alpha: 0 }, restrictions: { light: false, weather: false }
    };
    if (scene) {
      report.push(`· ok (already) scene "${name}" (${scene.id})`);
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
        background: { src: null }, backgroundColor: "#ffffff", foreground: null,
        grid: { type: 0, size: 100 }, tokenVision: false,
        fog: { exploration: false }, environment: { globalLight: { enabled: true }, darknessLevel: 0 },
        initial: { x: Math.round(W / 2), y: Math.round(H / 2), scale: 1 },
        ownership: { default: OBSERVER },
        folder: folderId, tiles: [tileData],
        flags: { [NS]: { teachingSlide: { n: s.n, beatId: s.beat, ms: s.ms } } }
      };
      report.push(`✚ CREATE scene "${name}" (${W}×${H}, white, 1 video tile loop=off autoplay=on: ${video})`);
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
  for (const s of SEGS) {
    const b = byId.get(s.beat);
    const a0 = b.audio || {};
    const want = {
      type: "cinematic",
      sceneId: null,
      cinematic: { enabled: true, startSceneId: sceneUuidFor[s.beat], durationMs: s.ms, nextSceneId: null },
      audio: { ...a0, src: `${VO_DIR}teaching-slide-${s.n}.v2.wav`, enabled: true, volume: Number(a0.volume ?? 0.85), loop: false, autoplay: true, broadcastPlayers: true },
      playerFacing: false, playerFacingDialog: false, dialogPlayerFacing: false
    };
    if (!String(want.audio.src || "").trim()) { report.push(`⚠ ${s.beat}: no audio src on the beat — left audio alone`); delete want.audio; }
    const before = {}; for (const k of Object.keys(want)) before[k] = b[k];
    if (same(before, want)) { report.push(`· ok (already) ${s.beat}`); continue; }
    const diffs = Object.keys(want).filter(k => !same(b[k], want[k]));
    report.push(`✎ ${s.beat}: ${diffs.join(", ")} (choices kept: ${(b.choices || []).map(c => `${c.label}→${c.next}`).join(", ") || "none"})`);
    Object.assign(b, want);
    changes++;
  }

  // ── 3. write ──────────────────────────────────────────────────────────────
  report.unshift(`${DRY_RUN ? "DRY RUN" : "APPLY"} — teaching slides → Act 0 beats (campaign ${cid}, ${camp.beats.length} beats): ${changes} change(s)`);
  console.log(report.join("\n"));
  if (DRY_RUN) return ui.notifications?.info(`Teaching slides: DRY RUN — ${changes} change(s); see console`);
  if (!changes) return ui.notifications?.info("Teaching slides: nothing to change");
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const raw = game.settings.get(NS, "campaigns");
    saveDataToFile?.(typeof raw === "string" ? raw : JSON.stringify(raw), "application/json", `campaigns-backup-before-teaching-slides-${stamp}.json`);
  } catch (_eB) {}
  await game.settings.set(NS, "campaigns", campaigns);
  ui.notifications?.info(`Teaching slides applied — ${changes} change(s). Fire ${SEGS[0].beat} from the GM seat to run the deck.`);
})();

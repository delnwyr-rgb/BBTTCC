/**
 * patch-art-wiring-2026-11-04.macro.js — Dave 2026-11-04: named characters and scenes point at the newest original art in "RFI Original At".
 * Actors: portrait + prototype token. Placed tokens of those actors follow. Scenes: the background only (size, grid and tokens stay).
 * Doc Greeley's separate bar pose (doc_greeley_bar_pov) is left alone: it isn't the same picture.
 * The art itself is uploaded by hand first (the files aren't in the repo). Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = (globalThis.__artWiringDry ?? true);
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const T = "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/", S = "art/bbttcc/GOTTGAIT/GOTTGAIT%20Scene%20files/";
  const ACTORS = {
    "Aldous Plumb": T + "alsi_aldous_plumb_hexhcrome_pov.webp",
    "Doc Vess Greeley": T + "alsi_doc_greeley_hexchrome_pov.webp",
    "Drax Calder": T + "asli_drax_caulder_hexhchrome_pov.webp",
    "Patter": T + "asli_patter_hexhchrome_pov.webp",
    "Pip": T + "asli_pip_hexchrome_pov.webp",
    "Young Gearbox": T + "asli_young_gearbox_hexhcrome_pov.webp",
    "Sable Nine": T + "sable9_front_pov_final_1400.webp",
    "Elsin Quade": T + "asli_elsin_quade.webp",
    "Miliard": T + "asli_milliard_pov_front.webp",
    "Apex Predator": T + "skelly_apex_predator_1.webp",
    "Varrenthyx, the Laser Dragon": "art/devin-knight/Monsters_October/amy_laser_dragon.webp"
  };
  const SCENES = {
    "allesh_gilliam_north_gate_day": S + "asli_allesh_gilliam_north_gate.webp",
    "gullywasher_interior_pov": S + "asli_gullywasher_int_hexhcrome_pov.webp",
    "snarky_burger_exterior": S + "snarky_burger_exterior_hexhchrome_pov.webp"
  };
  const same = (a, b) => decodeURI(String(a || "")) === decodeURI(String(b || ""));
  const missing = [];
  for (const p of [...new Set([...Object.values(ACTORS), ...Object.values(SCENES)])]) { const r = await fetch("/" + p, { method: "HEAD" }).catch(() => null); if (!r?.ok) missing.push(p); }
  const report = [], backup = { actors: [], tokens: [], scenes: [] }; const jobs = [];
  const wanted = new Map();
  for (const a of game.actors) { const src = ACTORS[a.name]; if (!src) continue; wanted.set(a.id, src);
    const upd = {}; if (!same(a.img, src)) upd.img = src; if (!same(a.prototypeToken?.texture?.src, src)) upd["prototypeToken.texture.src"] = src;
    if (Object.keys(upd).length) { backup.actors.push({ id: a.id, name: a.name, img: a.img, tok: a.prototypeToken?.texture?.src }); report.push(`✚ actor ${a.name}`); jobs.push(() => a.update(upd)); } }
  for (const s of game.scenes) {
    const ups = s.tokens.contents.filter(t => wanted.has(t.actorId) && !same(t.texture?.src, wanted.get(t.actorId)) && !/doc_greeley_bar_pov/.test(String(t.texture?.src)));
    if (ups.length) { for (const t of ups) { backup.tokens.push({ scene: s.id, id: t.id, name: t.name, src: t.texture?.src }); report.push(`✚ token ${t.name} on ${s.name}`); }
      jobs.push(() => s.updateEmbeddedDocuments("Token", ups.map(t => ({ _id: t.id, "texture.src": wanted.get(t.actorId) })))); }
    const bg = SCENES[s.name];
    if (bg && !same(s.background?.src, bg)) { backup.scenes.push({ id: s.id, name: s.name, bg: s.background?.src }); report.push(`✚ scene ${s.name} (${s.width}×${s.height})`); jobs.push(() => s.updateEmbeddedDocuments("Level", [{ _id: (s.initialLevel ?? s.firstLevel).id, "background.src": bg }])); }   // v14: a scene's background lives on its Level; writing scene.background is a silent no-op
  }
  globalThis.__artWiring = { dry: DRY_RUN, changes: jobs.length, report, missing };
  console.log(`[art wiring] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${jobs.length} change(s), ${missing.length} missing file(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${jobs.length} change(s); see console.`);
  if (missing.length) return ui.notifications.error("Art file missing, nothing written: " + missing.join(", "));
  if (!jobs.length) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    await FP.upload("data", "bbttcc-exports", new File([JSON.stringify(backup)], `backup-art-wiring-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed, nothing written. " + e.message); }
  for (const j of jobs) await j();
  ui.notifications.info(`Art wired (${jobs.length} change(s)).`);
})();

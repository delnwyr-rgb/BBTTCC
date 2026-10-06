/* patch-vacancy-rescene-2026-10-05.macro.js — RUN IN-WORLD (GM, ember). DRY_RUN default true.
 * ─────────────────────────────────────────────────────────────────────────────
 * THE VACANCY, RE-SHOT (Dave, 2026-10-05: new exterior / front desk / lounge / upstairs hall / second door / Wick's room
 * POVs + a two-level battlemap; "use the Leygate shot for the finale beat"). The old Vacancy scenes (KPLUoTAwkztyVbsH,
 * 5hxWnWm1sawwC3Ch, uc5z9OS4IqH5fUTV) are deleted on ember, so every beat that pointed at them dangles. This repoints them:
 *   exterior  u1Su9WE8fpJaGGuP → the exterior door cinematic (then the front desk)
 *   front desk 2KrZTKCKw92D32fD → Verna's intro; the Confessor's failed tail ("Verna has a cup of something waiting")
 *   lounge    YVDerfXKLjIciku1 → Wick in his corner: pilgrim, old routes, the flame, the shrines, the bed; the Confessor's pilgrim
 *   hall      tqOeMXwSxcCPM5Cw → NEW beat ag_vacancy_upstairs (cinematic: the hall, then the second door XhqOyJ9o9Onr0QKg)
 *   Wick's room WD2xaZwG1Eobh2GV → ag_wick_room
 *   switchback shrine POV 1CfhA2EFWZ2uZOZ5 → ag_wick_shrine; the Leygate POV dR3w3H2YOWQuCwrH → finale_wick_at_the_gate;
 *   St Gilliam's SNenbFtoUm9jv5uE → ag_tamsin_on_wick (its three siblings already play there).
 *   Verna's "Ask Verna which room is his." now leads up the stairs (ag_vacancy_upstairs) instead of straight into the room.
 * The battlemap (pz1wzjvHaFzhLuAg, two native levels) is wired by setup-town-hub TOWN_KEY "agvacancy" (stairs = changeLevel,
 * level-2 walk-in doors for the hall and Wick's room) and the Allesh-Gilliam map's Vacancy door by TOWN_KEY "ag".
 * GUARDED: a sceneId is only rewritten when it is empty, one of the old Vacancy ids, or a scene that no longer exists (FORCE to
 * override). Idempotent. One backup. In run-golden-13 before the town hubs.
 * HOW TO RUN: 1) run (DRY_RUN = true) → console (F12); 2) DRY_RUN = false, run again; 3) run setup-town-hub for "ag" and
 * "agvacancy" (dry, then apply); 4) F5.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const FORCE = false;
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0, drift = 0; const say = (m) => report.push(m);
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : foundry.utils.deepClone(raw);
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error(`Active campaign '${cid}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));

  const S = { ext: "u1Su9WE8fpJaGGuP", desk: "2KrZTKCKw92D32fD", lounge: "YVDerfXKLjIciku1", hall: "tqOeMXwSxcCPM5Cw", door: "XhqOyJ9o9Onr0QKg",
    room: "WD2xaZwG1Eobh2GV", shrine: "1CfhA2EFWZ2uZOZ5", leygate: "dR3w3H2YOWQuCwrH", stg: "SNenbFtoUm9jv5uE" };
  const OLD = new Set(["KPLUoTAwkztyVbsH", "5hxWnWm1sawwC3Ch", "uc5z9OS4IqH5fUTV"]);
  const bare = (v) => String(v || "").trim().replace(/^Scene\./, "");
  const missing = Object.entries(S).filter(([, id]) => !game.scenes?.get?.(id)).map(([k, id]) => `${k} ${id}`);
  if (missing.length) say(`⚠ scene(s) not in this world: ${missing.join(", ")} — the beats still get the ids (they resolve once the scenes exist)`);
  const replaceable = (cur) => !cur || OLD.has(cur) || !game.scenes?.get?.(cur);
  // patch-wick-cover clones its new beats from ag_vacancy_pilgrim_wick_routes, so when this patch ran BEFORE it (standalone,
  // then the uber — Golden Master 14, 2026-10-05) Wick's room and the shrine inherited the lounge shot. For those two beats the
  // Vacancy's own interior shots count as stand-ins, so the order of the two patches no longer matters.
  const STAND_IN = { ag_wick_room: new Set([S.lounge, S.desk]), ag_wick_shrine: new Set([S.lounge, S.desk]) };
  const setScene = (b, key, want, uuid = false) => {
    const obj = key.startsWith("cinematic.") ? (b.cinematic = b.cinematic || {}) : b; const f = key.replace(/^cinematic\./, "");
    const cur = bare(obj[f]); const val = uuid ? `Scene.${want}` : want;
    if (cur === want) return say(`· ok ${b.id}.${key} (already)`);
    if (!replaceable(cur) && !(key === "sceneId" && STAND_IN[b.id]?.has(cur)) && !FORCE) { drift++; return say(`⚠ ${b.id}.${key} is live "${game.scenes.get(cur)?.name || cur}" — left alone (FORCE=true to overwrite)`); }
    obj[f] = val; changes++; say(`✎ ${b.id}.${key} → ${game.scenes?.get?.(want)?.name || want}${cur ? ` (was ${cur})` : ""}`);
  };
  const MAP = [
    ["allesh_gilliam_vacancy_intro", S.desk], ["ag_confessor_pilgrim_fail", S.desk],
    ["ag_vacancy_pilgrim_wick", S.lounge], ["ag_vacancy_pilgrim_wick_routes", S.lounge], ["ag_wick_the_flame", S.lounge],
    ["ag_wick_the_shrines", S.lounge], ["ag_wick_the_bed", S.lounge], ["ag_confessor_pilgrim", S.lounge],
    ["ag_wick_room", S.room], ["ag_wick_shrine", S.shrine], ["finale_wick_at_the_gate", S.leygate], ["ag_tamsin_on_wick", S.stg]
  ];
  for (const [id, sc] of MAP) { const b = byId.get(id); if (!b) { say(`✗ MISSING beat ${id}`); continue; } setScene(b, "sceneId", sc); }
  const ex = byId.get("allesh_gilliam_vacancy_exterior");
  if (!ex) say("✗ MISSING beat allesh_gilliam_vacancy_exterior");
  else { setScene(ex, "sceneId", S.ext); if (ex.cinematic?.enabled) { setScene(ex, "cinematic.startSceneId", S.ext, true); setScene(ex, "cinematic.nextSceneId", S.desk, true); } }

  // the upstairs hall — a cinematic that opens on the hall and settles on the second door
  const UP = "ag_vacancy_upstairs";
  if (!byId.get(UP)) {
    const tpl = byId.get("ag_wick_room");
    if (!tpl) say(`✗ cannot build ${UP}: ag_wick_room missing (run patch-wick-cover first)`);
    else {
      const b = foundry.utils.deepClone(tpl);
      Object.assign(b, { id: UP, label: "The Vacancy — Upstairs", type: "cinematic", sceneId: S.hall, hexName: null, targetHexUuid: null,
        description: "Up the stairs, the Vacancy is quieter: a hall of numbered doors and a runner rug worn pale down the middle by a hundred years of guests who all walked exactly where the last one did. Verna's ledger puts a little star beside one of these rooms. You don't need the ledger. The second door has a star of its own, chalked small at knee height, where only someone counting doors would ever look.",
        cinematic: { enabled: true, startSceneId: `Scene.${S.hall}`, durationMs: 8000, nextSceneId: `Scene.${S.door}` },
        choices: [
          { label: "The second door, with the star.", next: "ag_wick_room", description: "", checkStat: "", checkDC: 0, failNext: "", requires: [{ beatMark: "ag_wick_room", not: true }] },
          { label: "Back down to the desk.", next: "allesh_gilliam_vacancy_intro", description: "", checkStat: "", checkDC: 0, failNext: "" }
        ] });
      b.inject = Object.assign({}, tpl.inject || {}, { repeatable: true, oncePerHex: false });
      delete b.story; delete b.memoryText; delete b.questStep; delete b.worldEffects; delete b.speaker; delete b.speakerActorId;
      camp.beats.push(b); byId.set(UP, b); changes++; say(`✚ beat ${UP} (cinematic: hall ${S.hall} → second door ${S.door}; "The second door, with the star." → ag_wick_room)`);
    }
  } else say(`· ok beat ${UP} (already)`);

  // Verna points you up the stairs, not straight through the door
  const bed = byId.get("ag_wick_the_bed");
  const vc = bed && (bed.choices || []).find(c => /which room is his/i.test(String(c.label || "")));
  if (!vc) say("✗ ag_wick_the_bed: Verna's \"which room is his\" choice not found");
  else if (vc.next === UP) say(`· ok ag_wick_the_bed → ${UP} (already)`);
  else if (vc.next === "ag_wick_room" || FORCE) { say(`✎ ag_wick_the_bed "${vc.label}" → ${UP} (was ${vc.next})`); vc.next = UP; changes++; }
  else { drift++; say(`⚠ ag_wick_the_bed "${vc.label}" routes to ${vc.next} — left alone`); }

  console.group(`[patch-vacancy-rescene-2026-10-05] ${DRY_RUN ? "DRY RUN — " : ""}${changes} change(s), ${drift} drifted`); report.forEach(r => console.log(" •", r)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`Vacancy re-scene DRY RUN: ${changes} change(s), ${drift} drifted — console (F12). Set DRY_RUN=false to apply.`);
  if (!changes) return ui.notifications.info("Vacancy re-scene: nothing to change.");
  (foundry.utils.saveDataToFile ?? saveDataToFile)(JSON.stringify(wasStr ? JSON.parse(raw) : raw), "application/json", `backup-campaigns-before-vacancy-rescene-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Vacancy re-scene applied: ${changes} change(s). Now run setup-town-hub for "ag" and "agvacancy". F5.`);
})();

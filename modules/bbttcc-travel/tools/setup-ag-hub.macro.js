/* Bad Eden — Set up the ALLESH-GILLIAM TOWN HUB (2026-09-15) — two hub scenes, ten doors, exterior cinematics
 * ─────────────────────────────────────────────────────────────────────────────
 * Allesh-Gilliam is two DA composites, imported by Dave as "Allesh Gilliam Map, South"
 * (the hold: main gate, Waiting Room, Long Market spine, Snarky Burger HQ, the Vacancy in
 * the wall's elbow) and "Allesh Gilliam Map, North" (St Gilliam's, Plumb's Tower, the Muster
 * by the North Gate, the East Wall). Both are town hubs; each carries a door to the other.
 *
 * WHAT IT WRITES (idempotent; DRY_RUN=true only reports):
 *   1. Flags both hub scenes: bbttcc-travel.isTownHub/townLabel/hexUuid.
 *   2. Door Drawings (ellipse per building, a bar at the map edge for the cross-town door),
 *      flagged bbttcc-travel.locationLink { key, label, targetSceneUuid: exterior POV,
 *      sceneUuids: [every scene that IS the location], beatId: the exterior cinematic }.
 *      Coordinates were verified by crop on the 18000/19200-wide renders; scaled to the scene + padding.
 *   3. EXTERIOR CINEMATIC BEATS for every location that lacks one (Dave's ask 2026-09-15), from the
 *      fixit_*_exterior template: cinematic.startSceneId = exterior POV, nextSceneId = interior POV
 *      (omitted when the location has no interior), 24 s, ONE choice "Go in" → the location's existing
 *      intro beat, questId + inject.requires copied from that intro beat. HQ and St Gilliam's already
 *      have live cinematics — reused, not duplicated.
 *   4. returnLink → its hub on every location scene; townHubSceneUuid on the Allesh-Gilliam hex → South.
 *   5. beat.sceneId / cinematic ids: only EMPTY or DANGLING ids are filled (exterior beats → exterior POV,
 *      the rest of a location → interior POV). Two deliberate overrides of LIVE ids, logged as such:
 *      the arrival beat lands on the South map (Dave's workflow: arrive → the map → quest log → click),
 *      and the placeholder `allesh_gilliam_map` emblem scene is replaced by the South hub wherever used.
 *
 * HOW TO RUN: Script macro, GM, on ember. Set DRY_RUN=false to apply. Downloads a campaigns backup first.
 * ─────────────────────────────────────────────────────────────────────────────
 */
(async () => {
  const DRY_RUN = false;                  // <-- set false to apply
  const SCOPE = "bbttcc-travel", NS = "bbttcc-campaign", TERR = "bbttcc-territory";
  const TOWN = "Allesh-Gilliam";
  const HEX_ALIASES = ["allesh-gilliam", "allesh gilliam", "allesh_gilliam"];

  const HUBS = {
    south: { sceneName: "Allesh Gilliam Map, South", label: `${TOWN} · South`, refWidth: 18000, refHeight: 9600 },
    north: { sceneName: "Allesh Gilliam Map, North", label: `${TOWN} · North`, refWidth: 19200, refHeight: 13500 }
  };
  // Door centres/sizes in RENDER pixels (verified 2026-09-15). exterior = door target + cinematic start;
  // interior = conversation scenes (null = open-air, exterior doubles); extra = also "this location".
  const DOORS = [
    { hub: "south", key: "vacancy",    label: "The Vacancy",       x: 2625,  y: 2625,  w: 4000, h: 3700, color: "#c9a0ff",
      exterior: "the_vacancy_exterior", interior: "the_vacancy_interior", extra: ["The Vacancy hexchrome battlemap"],
      beatId: "allesh_gilliam_vacancy_exterior", intro: "allesh_gilliam_vacancy_intro", blurb: "An L-shaped motel folded into the wall's elbow. VACANCY, says the sign, and it is not lying: it never is. Verna keeps the ledger; the ledger keeps everyone else." },
    { hub: "south", key: "waiting",    label: "The Waiting Room",  x: 3150,  y: 7050,  w: 3300, h: 2700, color: "#ffb347",
      exterior: "the_waiting_room_exterior", interior: "the_waiting_room_interior", extra: ["the_waiting_room_hexchrome_battlemap"],
      beatId: "allesh_gilliam_waiting_room_exterior", intro: "allesh_gilliam_waiting_room_intro", blurb: "The door still says EMERGENCY. Inside it says WAITING ROOM, over the bar, and the triage chairs face the counter now. Doc Greeley pours. Nobody here has ever been told to take a number and liked it." },
    { hub: "south", key: "market",     label: "The Long Market",   x: 8775,  y: 5325,  w: 4600, h: 8500, color: "#9dff8a",
      exterior: "long_market", interior: null, extra: ["The Long Market hexchrome battlemep", "The Long Market hexchrome battlemap"],
      beatId: "allesh_gilliam_long_market_exterior", intro: "allesh_gilliam_the_long_market_intro", blurb: "Old Main Street, roofed over in welded awnings and stubbornness. Everything is for sale down the row, including opinions. Etta Bloom is somewhere in the middle of it, which is where the middle is." },
    { hub: "south", key: "leygate",    label: "The Leygate",       x: 15600, y: 1500,  w: 3800, h: 2400, color: "#7fffd4",
      exterior: "allesh_gilliam_leygate_pov", interior: "allesh gilliam leygate battlemap hexchrome", extra: [],
      beatId: "allesh_gilliam_leygate_exterior", intro: "ag_leygate_visit", blurb: "EMERGENCIES ONLY, says the sign, and under it, in a different hand: AND EVEN THEN, ASK GARREN. The gate hums like someone pretending they aren't tired. Blue flickers yellow. Yellow flickers blue." },
    { hub: "south", key: "hq",         label: "HQ — Snarky Burger", x: 14625, y: 7725, w: 4300, h: 2300, color: "#7ff6ff",
      exterior: "snarky_burger_exterior", interior: "allesh_gilliam_hq_pov", extra: ["snarky burger hexchrome battlemap"],
      intro: null, beatId: "allesh_gilliam_hq_cinematics", blurb: null },
    { hub: "north", key: "stgilliams", label: "St Gilliam's",      x: 4875,  y: 10200, w: 8500, h: 5400, color: "#ffd166",
      exterior: "st_gilliams_exterior_pov", interior: "st_gilliams_interior_pov", extra: ["St Gilliam's Hexchrome", "Father Tamsin — The Dream"],
      intro: null, beatId: "allesh_gilliam_st_gilliams_cinematics", blurb: null },
    { hub: "north", key: "muster",     label: "The Muster",        x: 2625,  y: 3750,  w: 3400, h: 2400, color: "#ff8c8c",
      exterior: "the_muster", interior: null, extra: [],
      beatId: "allesh_gilliam_muster_exterior", intro: "allesh_gilliam_muster_intro", blurb: "The gutted fire station by the North Gate. A boot is nailed to the door. Over the arch somebody has painted GOOD VIBES ONLY! and somebody else has not painted over it, which tells you who runs the drills." },
    { hub: "north", key: "northgate",  label: "The North Gate",    x: 9075,  y: 2700,  w: 7900, h: 4800, color: "#e0e0e0",
      exterior: "allesh_gilliam_north_gate_day", interior: null, extra: [],
      beatId: "allesh_gilliam_north_gate_exterior", intro: null, blurb: "The North Gate: Thatwards-by-North starts here, and so does everything that comes down that road at night. Rotations are checked. Rotations are checked again. The crane is not decorative." },
    { hub: "north", key: "eastwall",   label: "The East Wall",     x: 16125, y: 2700,  w: 5800, h: 4800, color: "#ffa07a",
      exterior: "east_wall", interior: null, extra: ["East Wall hexchrome battlemap"],
      beatId: "allesh_gilliam_east_wall_exterior", intro: "allesh_gilliam_the_east_wall_intro", blurb: "One section of wall leans inward like it is listening for something under the ground. Beyond it: scrub, wind, and things that do not respect fences. On this side: people who would like to sleep tonight." },
    { hub: "north", key: "plumb",      label: "Plumb's Tower",     x: 16870, y: 10360, w: 4200, h: 4600, color: "#a0d8ff",
      exterior: "plumbs_tower", interior: null, extra: ["Plumbs Tower"],
      beatId: "allesh_gilliam_plumb_tower_exterior", intro: "allesh_gilliam_plumb_office_intro", blurb: "The base of the old water tower is an office now. The wall is visible through Aldous Plumb's window. It is leaning. He has arranged his desk so that his back is to it." }
  ];
  // Cross-town doors: a bar along the shared edge (y in render px of the SOURCE hub).
  const CROSS = [
    { hub: "south", key: "to_north", label: "⇧ North of town", to: "north", x: 9000, y: 350,   w: 7000, h: 700, color: "#ffffff" },
    { hub: "north", key: "to_south", label: "⇩ South of town", to: "south", x: 9600, y: 13150, w: 7000, h: 700, color: "#ffffff" }
  ];
  // beat id prefix → [door key, "exterior" | "interior"]   (exact cinematic ids first)
  const BEAT_MAP = [
    ["allesh_gilliam_hq_cinematics", "hq", "exterior"], ["allesh_gilliam_st_gilliams_cinematics", "stgilliams", "exterior"],
    ["allesh_gilliam_vacancy_exterior", "vacancy", "exterior"], ["allesh_gilliam_waiting_room_exterior", "waiting", "exterior"], ["allesh_gilliam_long_market_exterior", "market", "exterior"],
    ["allesh_gilliam_muster_exterior", "muster", "exterior"], ["allesh_gilliam_north_gate_exterior", "northgate", "exterior"], ["allesh_gilliam_east_wall_exterior", "eastwall", "exterior"], ["allesh_gilliam_plumb_tower_exterior", "plumb", "exterior"], ["allesh_gilliam_leygate_exterior", "leygate", "exterior"],
    ["ag_leygate_", "leygate", "interior"], ["allesh_gilliam_leyline_", "leygate", "interior"],
    ["allesh_gilliam_hq_", "hq", "interior"], ["allesh_gilliam_marshall_yarrow_", "hq", "interior"], ["allesh_gilliam_yarrow_welcome", "hq", "interior"], ["allesh_gilliam_pike_closure", "hq", "interior"],
    ["allesh_gilliam_st_gilliams_", "stgilliams", "interior"], ["allesh_gilliam_father_tamsin_", "stgilliams", "interior"], ["ag_confessor_", "stgilliams", "interior"], ["ag_tamsin_confrontation", "stgilliams", "interior"],
    ["allesh_gilliam_the_long_market_", "market", "interior"], ["allesh_gilliam_etta_", "market", "interior"],
    ["allesh_gilliam_waiting_room_", "waiting", "interior"], ["allesh_gilliam_vacancy_", "vacancy", "interior"],
    ["allesh_gilliam_plumb_", "plumb", "interior"], ["allesh_gilliam_muster_", "muster", "interior"],
    ["allesh_gilliam_the_east_wall_", "eastwall", "interior"], ["allesh_gilliam_east_wall_", "eastwall", "interior"], ["allesh_gilliam_wall_stands_straight", "eastwall", "interior"]
  ];
  const HUB_BEATS = { south: ["allesh_gilliam_town_walk", "allesh_gilliam_quest_hub_1", "allesh_gilliam_introduction_to_hq"] };
  // LIVE ids we deliberately replace (logged as "(was live …)"): the arrival beat → South map; the placeholder emblem scene.
  const OVERRIDE_LIVE_BEATS = new Set(["allesh_gilliam_introduction_to_hq"]);
  const REPLACE_SCENE_NAMES = new Set(["allesh_gilliam_map"]);
  const DUR_MS = 24000;

  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const changes = [], warns = [], todo = [];
  const norm = (s) => String(s || "").replace(/[\s ]+/g, " ").trim().toLowerCase();
  const sceneByName = (name) => name ? (game.scenes.find(s => norm(s.name) === norm(name)) || null) : null;
  const liveScene = (ref) => { const r = String(ref || "").trim(); if (!r) return null; return game.scenes.get(r.split(".").pop()) || null; };
  const replaceable = (sc) => !sc || REPLACE_SCENE_NAMES.has(sc.name);

  // ── hex ──────────────────────────────────────────────────────────────────
  let hex = null;
  for (const sc of game.scenes) { for (const d of sc.drawings) { const tf = d.flags?.[TERR]; if (!tf) continue; if ((tf.isHex || tf.kind === "territory-hex" || tf.name) && HEX_ALIASES.includes(norm(tf.name || d.text))) { hex = d; break; } } if (hex) break; }
  if (!hex) warns.push(`${TOWN} hex Drawing not found — hexUuid/arrival wiring skipped`);

  // ── hubs ─────────────────────────────────────────────────────────────────
  for (const [k, h] of Object.entries(HUBS)) {
    h.scene = sceneByName(h.sceneName);
    if (!h.scene) return ui.notifications.error(`Hub scene "${h.sceneName}" not found — import it first.`);
    const f = h.scene.flags?.[SCOPE] || {};
    if (!f.isTownHub || f.townLabel !== h.label || (hex && f.hexUuid !== hex.uuid)) {
      changes.push(`hub "${h.scene.name}": isTownHub / townLabel "${h.label}" / hexUuid`);
      if (!DRY_RUN) await h.scene.update({ [`flags.${SCOPE}.isTownHub`]: true, [`flags.${SCOPE}.townLabel`]: h.label, [`flags.${SCOPE}.hexUuid`]: hex?.uuid || "" });
    }
  }
  const south = HUBS.south.scene;

  // ── location scenes ──────────────────────────────────────────────────────
  for (const d of DOORS) {
    d.sc = { exterior: sceneByName(d.exterior), interior: sceneByName(d.interior), extra: d.extra.map(sceneByName).filter(Boolean) };
    if (!d.sc.exterior) warns.push(`${d.label}: exterior scene "${d.exterior}" not found — door skipped`);
    if (d.interior && !d.sc.interior) warns.push(`${d.label}: interior scene "${d.interior}" not found — exterior used instead`);
    if (!d.sc.interior) d.sc.interior = d.sc.exterior;
    d.extra.forEach((n, i) => { if (!d.sc.extra.some(s => norm(s.name) === norm(n))) warns.push(`${d.label}: extra scene "${n}" not found (ignored)`); });
    d.allScenes = [...new Map([d.sc.exterior, d.sc.interior, ...d.sc.extra].filter(Boolean).map(s => [s.id, s])).values()];
  }

  // ── campaign ─────────────────────────────────────────────────────────────
  const api = game.bbttcc?.api?.campaign; const cid = api?.getActiveCampaignId?.();
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : foundry.utils.deepClone(raw);
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error("No active campaign.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  if (!Array.isArray(camp.beats)) camp.beats = beats;
  const byId = Object.fromEntries(beats.map(b => [b.id, b]));
  let beatChanges = 0;
  const townQuest = byId.allesh_gilliam_introduction_to_hq?.questId || byId.allesh_gilliam_town_walk?.questId || null;

  // ── 3. exterior cinematics ───────────────────────────────────────────────
  const mkCinematic = (d) => {
    const intro = d.intro ? byId[d.intro] : null;
    if (d.intro && !intro) warns.push(`${d.label}: intro beat ${d.intro} not found — cinematic gets no "Go in" choice`);
    const requires = intro?.inject?.requires ? foundry.utils.deepClone(intro.inject.requires) : [{ flag: "storyPhase", gte: 1 }];
    const b = {
      id: d.beatId, label: `${TOWN} - ${d.label} Exterior`, type: "cinematic", timeScale: "scene", tags: "town-door exterior", politicalTags: "",
      outcomes: { success: null, failure: null },
      inject: { cooldownTurns: 0, repeatable: true, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires },
      actors: [], choices: intro ? [{ label: "Go in", next: intro.id, description: "", checkStat: "", checkDC: 0, failNext: "" }] : [],
      encounter: { key: "", tier: null, actorName: "" },
      worldEffects: { territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [] },
      description: d.blurb || "", questId: intro?.questId || townQuest, questStep: null, questRole: null, targetHexUuid: null, turnNumber: 1,
      cinematic: { enabled: true, startSceneId: d.sc.exterior.uuid, durationMs: DUR_MS, nextSceneId: (d.sc.interior && d.sc.interior.id !== d.sc.exterior.id) ? d.sc.interior.uuid : null },
      journal: { enabled: false, entryId: "", force: false }, unlocks: { maneuvers: [], strategics: [] }, timePoints: 0, sceneId: null, playerFacing: true, refs: {}
    };
    return b;
  };
  for (const d of DOORS) {
    if (!d.sc.exterior) continue;
    if (byId[d.beatId]) continue;                                   // HQ / St Gilliam's: live already
    const b = mkCinematic(d);
    changes.push(`beat NEW ${b.id}: cinematic "${d.sc.exterior.name}"${b.cinematic.nextSceneId ? ` → "${d.sc.interior.name}"` : ""}${b.choices.length ? ` · Go in → ${b.choices[0].next}` : " · no intro beat"} · q=${b.questId || "-"}`); beatChanges++;
    if (!DRY_RUN) { beats.push(b); byId[b.id] = b; }
  }

  // ── 2. doors + 4. return links ───────────────────────────────────────────
  const placeDoor = async (hubKey, key, label, color, x, y, w, h, link, shape = "e") => {
    const H = HUBS[hubKey]; const sc = H.scene; const k = sc.width / H.refWidth;
    const offX = sc.dimensions?.sceneX || 0, offY = sc.dimensions?.sceneY || 0;
    const W = Math.round(w * k), Hh = Math.round(h * k), X = Math.round(offX + x * k - W / 2), Y = Math.round(offY + y * k - Hh / 2);
    const data = { x: X, y: Y, shape: { type: shape, width: W, height: Hh },
      strokeColor: color, strokeWidth: Math.max(6, Math.round(14 * k)), strokeAlpha: 0.85, fillType: CONST.DRAWING_FILL_TYPES.SOLID, fillColor: color, fillAlpha: 0.08,
      text: label, fontSize: Math.max(36, Math.round(96 * k)), textColor: "#ffffff", textAlpha: 0.95, locked: true, interface: true, flags: { [SCOPE]: { locationLink: link } } };
    const cur = sc.drawings.contents.find(d => d.flags?.[SCOPE]?.locationLink?.key === key);
    const desc = `${H.label} · ${label} @ (${X + W / 2},${Y + Hh / 2}) ${W}×${Hh} → "${liveScene(link.targetSceneUuid)?.name}"${link.beatId ? ` · beat ${link.beatId}` : ""}`;
    if (!cur) { changes.push(`door ${desc}`); if (!DRY_RUN) await sc.createEmbeddedDocuments("Drawing", [data]); }
    else if (JSON.stringify(cur.flags[SCOPE].locationLink) !== JSON.stringify(link)) { changes.push(`door relink ${desc}`); if (!DRY_RUN) await cur.update({ [`flags.${SCOPE}.locationLink`]: link }); }
  };
  for (const d of DOORS) {
    if (!d.sc.exterior) continue;
    await placeDoor(d.hub, d.key, d.label, d.color, d.x, d.y, d.w, d.h, { key: d.key, label: d.label, targetSceneUuid: d.sc.exterior.uuid, sceneUuids: d.allScenes.map(s => s.uuid), beatId: d.beatId });
    const hubScene = HUBS[d.hub].scene;
    for (const sc of d.allScenes) {
      const rl = sc.flags?.[SCOPE]?.returnLink;
      if (!rl || rl.targetSceneUuid !== hubScene.uuid) { changes.push(`"${sc.name}": returnLink → ${HUBS[d.hub].label}${rl ? ` (was "${rl.label}")` : ""}`); if (!DRY_RUN) await sc.update({ [`flags.${SCOPE}.returnLink`]: { targetSceneUuid: hubScene.uuid, label: TOWN } }); }
    }
  }
  for (const c of CROSS) {
    await placeDoor(c.hub, c.key, c.label, c.color, c.x, c.y, c.w, c.h, { key: c.key, label: c.label, targetSceneUuid: HUBS[c.to].scene.uuid, sceneUuids: [], beatId: null }, "r");
  }
  if (hex && hex.flags?.[SCOPE]?.townHubSceneUuid !== south.uuid) { changes.push(`hex "${hex.flags[TERR].name}": townHubSceneUuid → ${HUBS.south.label}`); if (!DRY_RUN) await hex.update({ [`flags.${SCOPE}.townHubSceneUuid`]: south.uuid }); }

  // ── 5. beat scene ids ────────────────────────────────────────────────────
  const doorByKey = Object.fromEntries(DOORS.map(d => [d.key, d]));
  const hubBeat = (id) => { for (const [k, ids] of Object.entries(HUB_BEATS)) if (ids.includes(id)) return HUBS[k].scene; return null; };
  const want = (b) => {
    const hs = hubBeat(b.id); if (hs) return { scene: hs, why: "town map", next: hs };
    for (const [pre, key, side] of BEAT_MAP) if (b.id.startsWith(pre)) { const d = doorByKey[key]; const sc = d?.sc?.[side]; return sc ? { scene: sc, why: `${key} ${side}`, next: d.sc.interior } : { missing: `${key} ${side}` }; }
    return null;
  };
  for (const b of beats) {
    const w = want(b); if (!w) continue;
    if (w.missing) { warns.push(`beat ${b.id}: wanted ${w.missing} but that scene is missing`); continue; }
    const cur = String(b.sceneId || "").trim(); const live = liveScene(cur);
    const may = !cur || replaceable(live) || OVERRIDE_LIVE_BEATS.has(b.id);
    if (live && live.id === w.scene.id) { /* already right */ }
    else if (!may) warns.push(`beat ${b.id}: sceneId is live "${live.name}" (wanted "${w.scene.name}") — left alone`);
    else { changes.push(`beat ${b.id}: sceneId → "${w.scene.name}" [${w.why}]${cur ? (live ? ` (was LIVE "${live.name}" — deliberate override)` : ` (was dangling ${cur})`) : ""}`); beatChanges++; if (!DRY_RUN) b.sceneId = w.scene.id; }
    const cin = b.cinematic;
    if (cin && cin.enabled && String(b.type || "") === "cinematic") {
      const s1 = String(cin.startSceneId || "").trim(), l1 = liveScene(s1);
      if (!l1 || replaceable(l1)) { changes.push(`beat ${b.id}: cinematic.startSceneId → "${w.scene.name}"${s1 ? ` (was ${l1 ? "placeholder" : "dangling"} ${s1})` : ""}`); beatChanges++; if (!DRY_RUN) cin.startSceneId = w.scene.uuid; }
      else if (l1.id !== w.scene.id) warns.push(`beat ${b.id}: cinematic.startSceneId is live "${l1.name}" (door expects "${w.scene.name}") — left alone`);
      const s2 = String(cin.nextSceneId || "").trim(), l2 = liveScene(s2), nx = w.next;
      if (s2 && (!l2 || replaceable(l2)) && nx) { changes.push(`beat ${b.id}: cinematic.nextSceneId → "${nx.name}" (was ${l2 ? "placeholder" : "dangling"} ${s2})`); beatChanges++; if (!DRY_RUN) cin.nextSceneId = nx.uuid; }
    }
  }
  todo.push("The Crossroads has its own scene but no place on either map — reachable through Pike's HQ choices; add a door later if you site it.");

  console.group(`[ag-hub] ${DRY_RUN ? "DRY RUN — " : ""}${changes.length} change(s), ${warns.length} warning(s), ${todo.length} for you`);
  changes.forEach(c => console.log(" •", c)); warns.forEach(w => console.warn(" ⚠", w)); todo.forEach(t => console.log(" ⏳", t)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`AG hub DRY RUN: ${changes.length} change(s), ${warns.length} warning(s) in console (F12). Set DRY_RUN=false to apply.`);
  if (beatChanges) {
    (foundry.utils.saveDataToFile || saveDataToFile)(JSON.stringify(wasStr ? JSON.parse(raw) : raw), "application/json", `backup-campaigns-before-ag-hub-${Date.now()}.json`);
    await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  }
  const li = (a) => a.map(c => `<li>${foundry.utils.escapeHTML(c)}</li>`).join("");
  ChatMessage.create({ whisper: [game.user.id], content: `<b>Allesh-Gilliam hub wired.</b><ul style="font-size:12px">${li(changes)}</ul>${warns.length ? `<p><b>Warnings</b></p><ul style="font-size:12px">${li(warns)}</ul>` : ""}${todo.length ? `<p><b>For you</b></p><ul style="font-size:12px">${li(todo)}</ul>` : ""}` });
  ui.notifications.info(`AG hub applied: ${changes.length} change(s).${beatChanges ? " Campaign backup downloaded." : ""} Open "${south.name}" and click a building.`);
})();

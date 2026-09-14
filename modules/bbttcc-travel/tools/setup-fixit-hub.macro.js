/* Bad Eden — Set up the Furrier's Fixit Farm TOWN HUB (2026-09-14, v2 after the first dry run)
 * ─────────────────────────────────────────────────────────────────────────────
 * The hub = Dave's `fixit_map` scene (the DA composite still, 15300×13950) with
 * four DOORS. Click a building → the GM seat RUNS that location's exterior beat
 * with a pending cinematic dive, so the beat's own sceneId (exterior POV) and its
 * chain (→ interior POV conversation) carry the whole table inside. The Quest Log
 * shows "📍 The Gullywasher · Furrier's Fixit Farm" for any quest whose remaining
 * beats happen in ANY of that location's scenes.
 *
 * WHAT IT WRITES (idempotent; DRY_RUN=true only reports — and reports EVERYTHING):
 *   1. Flags the hub scene (found by name "fixit_map", or created from
 *      art/bbttcc/maps/fixit-hub.webp if absent): bbttcc-travel.isTownHub/townLabel/hexUuid.
 *   2. Four ellipse Drawings flagged bbttcc-travel.locationLink
 *      { key, label, targetSceneUuid: exterior POV, sceneUuids: [exterior, interior, battlemap…], beatId: opener }.
 *      Coordinates were verified on the 15300-wide render and are scaled to the scene + its padding.
 *   3. bbttcc-travel.returnLink → hub ("⬅ Fixit Farm") on every location scene.
 *   4. bbttcc-travel.townHubSceneUuid on the Fixit hex Drawing.
 *   5. Campaign beats: sceneId per beat — exterior beats → exterior POV, everything else in the
 *      location → interior POV, arrival/yard beats → the hub. Only EMPTY or DANGLING ids are
 *      written (six Fixit beats still pointed at scenes deleted in the mp4 purge); a live id that
 *      differs is reported and left alone.
 *   6. CINEMATIC beats dive to their OWN `cinematic.startSceneId` and later activate
 *      `cinematic.nextSceneId` (executeBeat) — three of the four door openers still pointed at
 *      purged scenes, so the door "did nothing". Dangling start → the beat's scene (exterior POV /
 *      hub); dangling next → the location's interior POV (hub for arrival beats). Live ids kept.
 *
 * HOW TO RUN: Script macro, GM, on ember. Set DRY_RUN=false to apply. Backs up the
 * campaigns setting to a download before writing beats.
 * ─────────────────────────────────────────────────────────────────────────────
 */
(async () => {
  const DRY_RUN = false;                  // <-- set false to apply
  const SCOPE = "bbttcc-travel", NS = "bbttcc-campaign", TERR = "bbttcc-territory";

  const HUB = { sceneName: "fixit_map", label: "Furrier's Fixit Farm", img: "art/bbttcc/maps/fixit-hub.webp", width: 10200, height: 9300, grid: 100, refWidth: 15300 };
  const HEX_ALIASES = ["furrier's fixit farm", "furrier's fixit-farm", "furriers fixit farm", "furriers fixit-farm", "farrier's fixit farm", "farrier's fixit-farm"];
  // Door centres/sizes in pixels of the 15300-wide render (verified by crop, 2026-09-14).
  // exterior = door target + exterior-beat scene; interior = conversation/choice scenes; extra = also "this location".
  const DOORS = [
    { key: "gullywasher", label: "The Gullywasher",    x: 3978,  y: 3948, w: 1950, h: 1950, color: "#ffb347", beatId: "fixit_saloon_cinematic",
      exterior: "gullywasher_exterior_pov", interior: "gullywasher_interior_pov", extra: ["fixit_gulleywasher_dougan_pov", "gulley_washer hexchrome battlemap"] },
    { key: "generator",   label: "The Generator Hall", x: 10442, y: 2883, w: 3150, h: 3150, color: "#7ff6ff", beatId: "fixit_power_station_exterior",
      exterior: "fixit_generator_exterior", interior: "fixit_generator_interior_pov", extra: ["generator hexchrome battlemap"] },
    { key: "counter",     label: "The Counter",        x: 3366,  y: 9786, w: 3450, h: 2475, color: "#c9a0ff", beatId: "fixit_general_store_exterior",
      exterior: "counter_exterior_pov", interior: "counter_interior_pov", extra: ["counter hexchrome battlemap"] },
    { key: "arcbay",      label: "The Arc Bay",        x: 8798,  y: 9333, w: 3825, h: 3675, color: "#9dff8a", beatId: "fixit_arc_bay_exterior",
      exterior: "arc_bay_exterior", interior: "arc_bay_interior_pov", extra: ["arc_bay_back_room_pov", "arc_bay_hexchrome"] }
  ];
  // beat id prefix → [door key, "exterior" | "interior"]
  const BEAT_MAP = [
    ["fixit_saloon_cinematic", "gullywasher", "exterior"], ["fixit_gullywasher_", "gullywasher", "interior"], ["fixit_gully_", "gullywasher", "interior"], ["gullywasher_", "gullywasher", "interior"],
    ["fixit_power_station_exterior", "generator", "exterior"], ["fixit_power_station_", "generator", "interior"],
    ["fixit_general_store_exterior", "counter", "exterior"], ["fixit_general_store_", "counter", "interior"],
    ["fixit_arc_bay_exterior", "arcbay", "exterior"], ["fixit_arc_bay_", "arcbay", "interior"],
    ["fixit_weeping_prisoner", "arcbay", "interior"], ["fixit_the_weeping_prisoner", "arcbay", "interior"],
    ["fixit_leyline_", "arcbay", "interior"]
  ];
  // Arrival / yard beats land on the hub map itself.
  const HUB_BEATS = ["fixit_cinematic_intro", "fixit_intro_scene", "fixit_town_walk", "fixit_quest_acceptance", "fixit_hex_settles", "fixit_pip_and_patter_convo", "fixit_pip_and_patter_convo_1", "fixit_pip_and_patter_convo_2"];
  // Beats we deliberately leave for Dave (candidate in the note).
  const LEAVE = { fixit_backstairs_exterior: "arc_bay_back_room_pov?" };

  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const changes = [], warns = [], todo = [];
  const norm = (s) => String(s || "").replace(/[\s ]+/g, " ").trim().toLowerCase();
  const sceneByName = (name) => game.scenes.find(s => norm(s.name) === norm(name)) || null;
  const liveScene = (ref) => { const r = String(ref || "").trim(); if (!r) return null; return game.scenes.get(r.split(".").pop()) || null; };

  // ── hex ──────────────────────────────────────────────────────────────────
  let hex = null;
  for (const sc of game.scenes) { for (const d of sc.drawings) { const tf = d.flags?.[TERR]; if (!tf) continue; if ((tf.isHex || tf.kind === "territory-hex" || tf.name) && HEX_ALIASES.includes(norm(tf.name || d.text))) { hex = d; break; } } if (hex) break; }
  if (!hex) warns.push("Fixit hex Drawing not found on any scene — hexUuid/arrival wiring skipped");

  // ── location scenes ──────────────────────────────────────────────────────
  for (const door of DOORS) {
    door.sc = { exterior: sceneByName(door.exterior), interior: sceneByName(door.interior), extra: door.extra.map(sceneByName).filter(Boolean) };
    if (!door.sc.exterior) warns.push(`${door.label}: exterior scene "${door.exterior}" not found — door skipped`);
    if (!door.sc.interior) warns.push(`${door.label}: interior scene "${door.interior}" not found — interior beats skipped`);
    for (let i = 0; i < door.extra.length; i++) if (!sceneByName(door.extra[i])) warns.push(`${door.label}: extra scene "${door.extra[i]}" not found (ignored)`);
    door.allScenes = [door.sc.exterior, door.sc.interior, ...door.sc.extra].filter(Boolean);
  }

  // ── 1. hub scene ─────────────────────────────────────────────────────────
  let hub = sceneByName(HUB.sceneName) || game.scenes.find(s => s.flags?.[SCOPE]?.isTownHub && norm(s.flags[SCOPE].townLabel) === norm(HUB.label)) || null;
  let hubIsPlanned = false;
  if (!hub) {
    changes.push(`create hub scene "${HUB.sceneName}" ← ${HUB.img} (${HUB.width}×${HUB.height}, grid ${HUB.grid})`);
    if (!DRY_RUN) hub = await Scene.create({
      name: HUB.sceneName, background: { src: HUB.img }, width: HUB.width, height: HUB.height,
      grid: { type: CONST.GRID_TYPES.SQUARE, size: HUB.grid, distance: 5, units: "ft", alpha: 0 },
      padding: 0.05, navigation: true, tokenVision: false, fog: { exploration: false }, environment: { globalLight: { enabled: true } },
      initial: { x: Math.round(HUB.width / 2), y: Math.round(HUB.height / 2), scale: 0.12 },
      flags: { [SCOPE]: { isTownHub: true, townLabel: HUB.label, hexUuid: hex?.uuid || "" } }
    });
    else { hubIsPlanned = true; hub = { id: "(new)", uuid: "(new hub)", name: HUB.sceneName, width: HUB.width, height: HUB.height, flags: {}, drawings: { contents: [] }, dimensions: { sceneX: 0, sceneY: 0 } }; }
  } else {
    const f = hub.flags?.[SCOPE] || {};
    if (!f.isTownHub || f.townLabel !== HUB.label || (hex && f.hexUuid !== hex.uuid)) {
      changes.push(`hub scene "${hub.name}": set isTownHub / townLabel "${HUB.label}" / hexUuid`);
      if (!DRY_RUN) await hub.update({ [`flags.${SCOPE}.isTownHub`]: true, [`flags.${SCOPE}.townLabel`]: HUB.label, [`flags.${SCOPE}.hexUuid`]: hex?.uuid || "" });
    }
  }

  // ── 2. doors ─────────────────────────────────────────────────────────────
  const k = (hub.width || HUB.width) / HUB.refWidth;                       // render px → scene px
  const offX = hub.dimensions?.sceneX || 0, offY = hub.dimensions?.sceneY || 0;  // padding offset
  const existing = (hub.drawings?.contents || []).filter(d => d.flags?.[SCOPE]?.locationLink);
  const byKey = Object.fromEntries(existing.map(d => [d.flags[SCOPE].locationLink.key, d]));
  for (const door of DOORS) {
    if (!door.sc.exterior) continue;
    const link = { key: door.key, label: door.label, targetSceneUuid: door.sc.exterior.uuid, sceneUuids: door.allScenes.map(s => s.uuid), beatId: door.beatId };
    const w = Math.round(door.w * k), h = Math.round(door.h * k);
    const x = Math.round(offX + door.x * k - w / 2), y = Math.round(offY + door.y * k - h / 2);
    const data = {
      x, y, shape: { type: "e", width: w, height: h },
      strokeColor: door.color, strokeWidth: Math.max(8, Math.round(14 * k)), strokeAlpha: 0.85, fillType: CONST.DRAWING_FILL_TYPES.SOLID, fillColor: door.color, fillAlpha: 0.08,
      text: door.label, fontSize: Math.max(48, Math.round(96 * k)), textColor: "#ffffff", textAlpha: 0.95, locked: true, interface: true,
      flags: { [SCOPE]: { locationLink: link } }
    };
    const cur = byKey[door.key];
    const desc = `${door.label} @ (${x + w / 2},${y + h / 2}) ${w}×${h} → "${door.sc.exterior.name}" · beat ${door.beatId} · scenes [${door.allScenes.map(s => s.name).join(", ")}]`;
    if (!cur) { changes.push(`door ${desc}`); if (!DRY_RUN) await hub.createEmbeddedDocuments("Drawing", [data]); }
    else if (JSON.stringify(cur.flags[SCOPE].locationLink) !== JSON.stringify(link)) { changes.push(`door ${door.label}: relink → ${desc}`); if (!DRY_RUN) await cur.update({ [`flags.${SCOPE}.locationLink`]: link }); }
    // ── 3. return links ─────────────────────────────────────────────────────
    for (const sc of door.allScenes) {
      const rl = sc.flags?.[SCOPE]?.returnLink;
      if (!rl || rl.targetSceneUuid !== hub.uuid) { changes.push(`"${sc.name}": returnLink → hub ("⬅ Fixit Farm")${rl ? ` (was "${rl.label}")` : ""}`); if (!DRY_RUN) await sc.update({ [`flags.${SCOPE}.returnLink`]: { targetSceneUuid: hub.uuid, label: "Fixit Farm" } }); }
    }
  }
  // ── 4. hex → hub ─────────────────────────────────────────────────────────
  if (hex && hex.flags?.[SCOPE]?.townHubSceneUuid !== hub.uuid) { changes.push(`hex "${hex.flags[TERR].name}": townHubSceneUuid → hub`); if (!DRY_RUN) await hex.update({ [`flags.${SCOPE}.townHubSceneUuid`]: hub.uuid }); }

  // ── 5. beats: sceneId ────────────────────────────────────────────────────
  const api = game.bbttcc?.api?.campaign; const cid = api?.getActiveCampaignId?.();
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : foundry.utils.deepClone(raw);
  const camp = camps?.[cid];
  let beatChanges = 0;
  if (!camp) warns.push("no active campaign — beat sceneId wiring skipped");
  else {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    if (!Array.isArray(camp.beats)) camp.beats = beats;
    const arrival = new Set(HUB_BEATS);
    const ov = camp.hexOverrides?.[hex?.uuid]; const ids = [].concat(ov?.onEnterBeatIds || [], ov?.onEnterBeatId || [], ov?.beatId || [], hex?.flags?.[TERR]?.campaign?.onEnterBeatId || []);
    for (const id of ids) for (const part of String(id).split("|")) if (part.trim()) arrival.add(part.trim());
    const byKeyDoor = Object.fromEntries(DOORS.map(d => [d.key, d]));
    const want = (b) => {
      if (LEAVE[b.id]) return { leave: LEAVE[b.id] };
      if (arrival.has(b.id)) return { scene: hub, why: "arrival/yard" };
      for (const [pre, key, side] of BEAT_MAP) if (b.id.startsWith(pre)) { const sc = byKeyDoor[key]?.sc?.[side]; return sc ? { scene: sc, why: `${key} ${side}` } : { missing: `${key} ${side}` }; }
      return null;
    };
    const nextFor = (b) => {                       // where a cinematic goes AFTER its timer
      if (arrival.has(b.id)) return hub;
      for (const [pre, key] of BEAT_MAP) if (b.id.startsWith(pre)) return byKeyDoor[key]?.sc?.interior || null;
      return null;
    };
    for (const b of beats) {
      const w = want(b); if (!w) continue;
      const cur = String(b.sceneId || "").trim(); const live = liveScene(cur);
      if (w.leave) { todo.push(`beat ${b.id}: sceneId ${cur ? `"${cur}"${live ? "" : " (DANGLING)"}` : "empty"} — left for you; candidate ${w.leave}`); continue; }
      if (w.missing) { warns.push(`beat ${b.id}: wanted ${w.missing} but that scene is missing`); continue; }
      if (cur && live) { if (live.id !== w.scene.id) warns.push(`beat ${b.id}: sceneId is live "${live.name}" (wanted "${w.scene.name}") — left alone`); }
      else { changes.push(`beat ${b.id}: sceneId → "${w.scene.name}" [${w.why}]${cur ? ` (was dangling ${cur})` : ""}`); beatChanges++; if (!DRY_RUN) b.sceneId = w.scene.id; }
      // 6. cinematic chain scenes
      const cin = b.cinematic;
      if (cin && cin.enabled && String(b.type || "") === "cinematic") {
        const s1 = String(cin.startSceneId || "").trim(), l1 = liveScene(s1);
        if (!l1) { changes.push(`beat ${b.id}: cinematic.startSceneId → "${w.scene.name}"${s1 ? ` (was dangling ${s1})` : ""}`); beatChanges++; if (!DRY_RUN) cin.startSceneId = w.scene.uuid; }
        else if (l1.id !== w.scene.id) warns.push(`beat ${b.id}: cinematic.startSceneId is live "${l1.name}" (door expects "${w.scene.name}") — left alone`);
        const s2 = String(cin.nextSceneId || "").trim(), l2 = liveScene(s2), nx = nextFor(b);
        if (s2 && !l2 && nx) { changes.push(`beat ${b.id}: cinematic.nextSceneId → "${nx.name}" (was dangling ${s2})`); beatChanges++; if (!DRY_RUN) cin.nextSceneId = nx.uuid; }
      }
    }
  }

  console.group(`[fixit-hub] ${DRY_RUN ? "DRY RUN — " : ""}${changes.length} change(s), ${warns.length} warning(s), ${todo.length} for you`);
  changes.forEach(c => console.log(" •", c)); warns.forEach(w => console.warn(" ⚠", w)); todo.forEach(t => console.log(" ⏳", t)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`Fixit hub DRY RUN: ${changes.length} change(s), ${warns.length} warning(s) in console (F12). Set DRY_RUN=false to apply.`);
  if (beatChanges) {
    (foundry.utils.saveDataToFile || saveDataToFile)(JSON.stringify(wasStr ? JSON.parse(raw) : raw), "application/json", `backup-campaigns-before-fixit-hub-${Date.now()}.json`);
    await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  }
  const li = (a) => a.map(c => `<li>${foundry.utils.escapeHTML(c)}</li>`).join("");
  ChatMessage.create({ whisper: [game.user.id], content: `<b>Fixit hub wired.</b><ul style="font-size:12px">${li(changes)}</ul>${warns.length ? `<p><b>Warnings</b></p><ul style="font-size:12px">${li(warns)}</ul>` : ""}${todo.length ? `<p><b>For you</b></p><ul style="font-size:12px">${li(todo)}</ul>` : ""}` });
  ui.notifications.info(`Fixit hub applied: ${changes.length} change(s).${beatChanges ? " Campaign backup downloaded." : ""} Open "${hub.name}" and click a building.`);
})();

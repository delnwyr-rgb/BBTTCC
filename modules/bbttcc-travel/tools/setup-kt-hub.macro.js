/* Bad Eden — Set up the KHEZEK-TOR TOWN HUB (2026-09-17) — one crater map, six doors, exterior cinematics
 * ─────────────────────────────────────────────────────────────────────────────
 * Khezek-Tor is one DA composite imported by Dave as "Khezek Tor Map": a mining camp in a crater,
 * the great metal dome in the middle (the Maw and the Lift Hall are UNDER it), the trax yard and its
 * anomaly on the west, the supply warehouse south-west, the Brace along the north cliff, the cult's
 * forward camp on the north-east ridge. Level Four, the sink and the Valhaulan Seal are underground:
 * no surface door, but their beats get scenes so the Quest Log can still point at the dome.
 *
 * WHAT IT WRITES (idempotent; DRY_RUN=true only reports):
 *   1. Flags the hub scene (bbttcc-travel.isTownHub/townLabel/hexUuid).
 *   2. Door Drawings flagged locationLink { key, label, targetSceneUuid, sceneUuids[], beatId }.
 *      Coordinates verified by crop on the 8191-wide import; scaled to the scene + padding.
 *   3. EXTERIOR CINEMATICS for the Brace, the yard, the warehouse and the forward camp (fixit template:
 *      start = exterior POV, next = battlemap/interior where one exists, 24 s, ONE choice "Go in" → the
 *      location's entry beat where one exists; questId + requires copied from it). The Lift Hall cinematic
 *      already exists; the Maw door and the cookline marker run their beats directly.
 *   4. returnLink → hub on every location scene; townHubSceneUuid on the Khezek-Tor hex.
 *   5. beat.sceneId / cinematic ids: only EMPTY or DANGLING ids filled (the old khezek_tor_map concept art is
 *      gone, so the hub beats are dangling → this map; the Seal cinematic's dangling start → the Seal POV).
 *
 * HOW TO RUN: Script macro, GM, on ember. Set DRY_RUN=false to apply. Downloads a campaigns backup first.
 * ─────────────────────────────────────────────────────────────────────────────
 */
(async () => {
  const DRY_RUN = false;                  // <-- set false to apply
  const SCOPE = "bbttcc-travel", NS = "bbttcc-campaign", TERR = "bbttcc-territory";
  const TOWN = "Khezek-Tor";
  const HEX_ALIASES = ["khezek-tor", "khezek tor", "khezek_tor"];

  const HUBS = { main: { sceneName: "Khezek Tor Map", label: TOWN, refWidth: 8191, refHeight: 6614 } };
  // Door centres/sizes in RENDER pixels of the 8191-wide import (verified 2026-09-17).
  const DOORS = [
    { hub: "main", key: "maw",       label: "The Maw",              x: 3900, y: 4038, w: 1800, h: 3000, color: "#ff8c8c",
      exterior: "maw_pov", interior: "the maw hexchrome battlemap", extra: [],
      beatId: "khezek_tor_the_maw", intro: null, blurb: null, direct: true },
    { hub: "main", key: "lifthall",  label: "The Lift Hall",        x: 5930, y: 4038, w: 1800, h: 3000, color: "#7ff6ff",
      exterior: "The Lift hexchrome", interior: "khezek_tor_bad_lift_hall_pov", extra: [],
      beatId: "khezek_tor_the_lift_hall", intro: null, blurb: null },
    { hub: "main", key: "brace",     label: "The Brace",            x: 4095, y: 878,  w: 3000, h: 1000, color: "#ffb347",
      exterior: "khezek_tor_brace_pov", interior: null, extra: [],
      beatId: "khezek_tor_brace_exterior", intro: "khezek_tor_the_brace", blurb: "The Brace holds back a section that already fell once. Timber, iron, and arithmetic older than the coalition, chalked straight onto the beams. Calder works underneath it. He does not look up when it groans, which tells you how often it groans." },
    { hub: "main", key: "yard",      label: "The Yard",             x: 1755, y: 2692, w: 1500, h: 1700, color: "#c9a0ff",
      exterior: "Scene.SQACQa2o9GEhOYHz", interior: "khezek_tor_tainted_shipment_pov", extra: [],
      beatId: "khezek_tor_yard_exterior", intro: "khezek_tor_darkness_shipment_quest_acceptance", blurb: "Ore carts in procession. Cranes frozen mid-lift like the skeletons of failed gods. Floodlights that burn all day, not for visibility. For warning. Something in the yard has a number, a label, and a destination, and it is not happy about any of the three." },
    { hub: "main", key: "warehouse", label: "The Warehouse",        x: 1697, y: 4447, w: 1500, h: 1400, color: "#e0e0e0",
      exterior: "khezek_tor_supply_shortage_pov_hexchrome", interior: "khezek_tor_supply_shortage_hexchrome_battlemap", extra: [],
      beatId: "khezek_tor_warehouse_exterior", intro: null, blurb: "Warehouses dominate the skyline. Everything here has a number, a label, or a destination, and the quartermasters would like it noted that the shelves are emptier than the ledgers say. Khezek-Tor keeps the warehouses and does the complaining." },
    { hub: "main", key: "camp",      label: "The Forward Camp — the Cookline", x: 6319, y: 1258, w: 1500, h: 1300, color: "#ffd166",
      exterior: "khezek_tor_arrival_scene", interior: null, extra: [],
      beatId: "khezek_tor_town_walk", intro: null, blurb: null, direct: true }
  ];
  const CROSS = [];
  const BEAT_MAP = [
    ["khezek_tor_the_lift_hall", "lifthall", "exterior"], ["khezek_tor_the_maw", "maw", "exterior"],
    ["khezek_tor_brace_exterior", "brace", "exterior"], ["khezek_tor_yard_exterior", "yard", "exterior"], ["khezek_tor_warehouse_exterior", "warehouse", "exterior"],
    ["khezek_tor_town_walk", "camp", "exterior"],
    ["khezek_tor_the_brace", "brace", "exterior"], ["khezek_tor_drax_", "brace", "exterior"], ["kt_drax_", "brace", "exterior"], ["khezek_brace_groans", "brace", "exterior"],
    ["khezek_tor_sable_", "lifthall", "interior"], ["kt_sable_", "lifthall", "interior"],
    ["khezek_tor_mine_that_answered_back", "maw", "exterior"], ["khezek_sink_widens", "maw", "exterior"],
    ["khezek_tor_darkness_shipment", "yard", "interior"], ["khezek_tor_shipment_fail", "yard", "interior"],
    ["khezek_upper_galleries", "@Valhaulan Barracks", ""],
    ["khezek_tor_valhaulan_seal", "@khezek_tor_valhaulan_seal_pov", ""], ["khezek_tor_the_vaulhaulan_seal", "@khezek_tor_valhaulan_seal_pov", ""], ["khezek_tor_seal_fail", "@khezek_tor_valhaulan_seal_pov", ""]
  ];
  const HUB_BEATS = { main: ["khezek_tor_main_scene", "khezek_tor_quest_scene", "khezek_tor_quest_acceptance", "khezek_hex_settles", "khezek_compound_cough"] };
  const REMOVE_BEATS = ["khezek_tor_camp_exterior"];      // created by an earlier run of this macro, no longer wanted
  const REMOVE_DOORS = ["cookline"];
  const OVERRIDE_LIVE_BEATS = new Set();
  const REPLACE_SCENE_NAMES = new Set(["khezek_tor_map"]);
  const DUR_MS = 24000;

  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const changes = [], warns = [], todo = [];
  const norm = (s) => String(s || "").replace(/[\s ]+/g, " ").trim().toLowerCase();
  const sceneByName = (name) => { if (!name) return null; if (/^Scene\./.test(name)) return game.scenes.get(name.split(".").pop()) || null; return game.scenes.find(s => norm(s.name) === norm(name)) || null; };
  const liveScene = (ref) => { const r = String(ref || "").trim(); if (!r) return null; return game.scenes.get(r.split(".").pop()) || null; };
  const replaceable = (sc) => !sc || REPLACE_SCENE_NAMES.has(sc.name);

  let hex = null;
  for (const sc of game.scenes) { for (const d of sc.drawings) { const tf = d.flags?.[TERR]; if (!tf) continue; if ((tf.isHex || tf.kind === "territory-hex" || tf.name) && HEX_ALIASES.includes(norm(tf.name || d.text))) { hex = d; break; } } if (hex) break; }
  if (!hex) warns.push(`${TOWN} hex Drawing not found — hexUuid/arrival wiring skipped`);

  for (const [k, h] of Object.entries(HUBS)) {
    h.scene = sceneByName(h.sceneName);
    if (!h.scene) return ui.notifications.error(`Hub scene "${h.sceneName}" not found — import it first.`);
    const f = h.scene.flags?.[SCOPE] || {};
    if (!f.isTownHub || f.townLabel !== h.label || (hex && f.hexUuid !== hex.uuid)) {
      changes.push(`hub "${h.scene.name}": isTownHub / townLabel "${h.label}" / hexUuid`);
      if (!DRY_RUN) await h.scene.update({ [`flags.${SCOPE}.isTownHub`]: true, [`flags.${SCOPE}.townLabel`]: h.label, [`flags.${SCOPE}.hexUuid`]: hex?.uuid || "" });
    }
  }
  const main = HUBS.main.scene;

  for (const d of DOORS) {
    d.sc = { exterior: sceneByName(d.exterior), interior: sceneByName(d.interior), extra: d.extra.map(sceneByName).filter(Boolean) };
    if (!d.sc.exterior) warns.push(`${d.label}: exterior scene "${d.exterior}" not found — door skipped`);
    if (d.interior && !d.sc.interior) warns.push(`${d.label}: interior scene "${d.interior}" not found — exterior used instead`);
    if (!d.sc.interior) d.sc.interior = d.sc.exterior;
    d.extra.forEach(n => { if (!d.sc.extra.some(s => norm(s.name) === norm(n))) warns.push(`${d.label}: extra scene "${n}" not found (ignored)`); });
    d.allScenes = [...new Map([d.sc.exterior, d.sc.interior, ...d.sc.extra].filter(Boolean).map(s => [s.id, s])).values()];
  }

  const api = game.bbttcc?.api?.campaign; const cid = api?.getActiveCampaignId?.();
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : foundry.utils.deepClone(raw);
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error("No active campaign.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  if (!Array.isArray(camp.beats)) camp.beats = beats;
  const byId = Object.fromEntries(beats.map(b => [b.id, b]));
  let beatChanges = 0;
  const townQuest = byId.khezek_tor_main_scene?.questId || null;

  const mkCinematic = (d) => {
    const intro = d.intro ? byId[d.intro] : null;
    if (d.intro && !intro) warns.push(`${d.label}: intro beat ${d.intro} not found — cinematic gets no "Go in" choice`);
    const requires = intro?.inject?.requires ? foundry.utils.deepClone(intro.inject.requires) : [{ flag: "storyPhase", gte: 1 }];
    return {
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
  };
  for (const id of REMOVE_BEATS) {
    const i = beats.findIndex(b => b.id === id);
    if (i >= 0 && /town-door/.test(String(beats[i].tags || ""))) { changes.push(`beat REMOVE ${id} (stale town-door cinematic)`); beatChanges++; if (!DRY_RUN) { beats.splice(i, 1); delete byId[id]; } }
  }
  for (const d of DOORS) {
    if (!d.sc.exterior || d.direct) continue;
    const cur = byId[d.beatId];
    if (cur) {
      // an earlier run of THIS macro created it (tagged): keep it in step with the config
      if (/town-door/.test(String(cur.tags || ""))) {
        const want = mkCinematic(d); const diffs = [];
        if (cur.cinematic?.startSceneId !== want.cinematic.startSceneId) diffs.push("start");
        if ((cur.cinematic?.nextSceneId || null) !== want.cinematic.nextSceneId) diffs.push("next");
        if (JSON.stringify(cur.choices || []) !== JSON.stringify(want.choices)) diffs.push("choices");
        if (diffs.length) { changes.push(`beat SYNC ${d.beatId}: ${diffs.join(", ")} → "${d.sc.exterior.name}"${want.cinematic.nextSceneId ? ` → "${d.sc.interior.name}"` : ""}`); beatChanges++; if (!DRY_RUN) { cur.cinematic = want.cinematic; cur.choices = want.choices; } }
      }
      continue;
    }
    const b = mkCinematic(d);
    changes.push(`beat NEW ${b.id}: cinematic "${d.sc.exterior.name}"${b.cinematic.nextSceneId ? ` → "${d.sc.interior.name}"` : ""}${b.choices.length ? ` · Go in → ${b.choices[0].next}` : " · no intro beat"} · q=${b.questId || "-"}`); beatChanges++;
    if (!DRY_RUN) { beats.push(b); byId[b.id] = b; }
  }
  for (const d of DOORS) if (d.direct && !byId[d.beatId]) warns.push(`${d.label}: door beat ${d.beatId} not found — door will plain-dive`);

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
  for (const key of REMOVE_DOORS) {
    const cur = main.drawings.contents.find(d => d.flags?.[SCOPE]?.locationLink?.key === key);
    if (cur) { changes.push(`door REMOVE ${key}`); if (!DRY_RUN) await cur.delete(); }
  }
  for (const c of CROSS) await placeDoor(c.hub, c.key, c.label, c.color, c.x, c.y, c.w, c.h, { key: c.key, label: c.label, targetSceneUuid: HUBS[c.to].scene.uuid, sceneUuids: [], beatId: null }, "r");
  if (hex && hex.flags?.[SCOPE]?.townHubSceneUuid !== main.uuid) { changes.push(`hex "${hex.flags[TERR].name}": townHubSceneUuid → ${TOWN}`); if (!DRY_RUN) await hex.update({ [`flags.${SCOPE}.townHubSceneUuid`]: main.uuid }); }

  const doorByKey = Object.fromEntries(DOORS.map(d => [d.key, d]));
  const hubBeat = (id) => { for (const [k, ids] of Object.entries(HUB_BEATS)) if (ids.includes(id)) return HUBS[k].scene; return null; };
  const want = (b) => {
    const hs = hubBeat(b.id); if (hs) return { scene: hs, why: "town map", next: hs };
    for (const [pre, key, side] of BEAT_MAP) if (b.id.startsWith(pre)) {
      if (key.startsWith("@")) { const sc = sceneByName(key.slice(1)); return sc ? { scene: sc, why: key.slice(1), next: sc } : { missing: key }; }
      const d = doorByKey[key]; const sc = d?.sc?.[side]; return sc ? { scene: sc, why: `${key} ${side}`, next: d.sc.interior } : { missing: `${key} ${side}` };
    }
    return null;
  };
  for (const b of beats) {
    const w = want(b); if (!w) continue;
    if (w.missing) { warns.push(`beat ${b.id}: wanted ${w.missing} but that scene is missing`); continue; }
    const cur = String(b.sceneId || "").trim(); const live = liveScene(cur);
    const may = !cur || replaceable(live) || OVERRIDE_LIVE_BEATS.has(b.id);
    if (live && live.id === w.scene.id) { }
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
  todo.push("The Seal, Level Four and the sink are underground — reached through the Lift Hall door, not a surface door. The Seal beats now point at the Seal POV so the Quest Log lights the dome.");

  console.group(`[kt-hub] ${DRY_RUN ? "DRY RUN — " : ""}${changes.length} change(s), ${warns.length} warning(s), ${todo.length} for you`);
  changes.forEach(c => console.log(" •", c)); warns.forEach(w => console.warn(" ⚠", w)); todo.forEach(t => console.log(" ⏳", t)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`KT hub DRY RUN: ${changes.length} change(s), ${warns.length} warning(s) in console (F12). Set DRY_RUN=false to apply.`);
  if (beatChanges) {
    (foundry.utils.saveDataToFile || saveDataToFile)(JSON.stringify(wasStr ? JSON.parse(raw) : raw), "application/json", `backup-campaigns-before-kt-hub-${Date.now()}.json`);
    await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  }
  const li = (a) => a.map(c => `<li>${foundry.utils.escapeHTML(c)}</li>`).join("");
  ChatMessage.create({ whisper: [game.user.id], content: `<b>Khezek-Tor hub wired.</b><ul style="font-size:12px">${li(changes)}</ul>${warns.length ? `<p><b>Warnings</b></p><ul style="font-size:12px">${li(warns)}</ul>` : ""}${todo.length ? `<p><b>For you</b></p><ul style="font-size:12px">${li(todo)}</ul>` : ""}` });
  ui.notifications.info(`KT hub applied: ${changes.length} change(s).${beatChanges ? " Campaign backup downloaded." : ""} Open "${main.name}" and click the dome.`);
})();

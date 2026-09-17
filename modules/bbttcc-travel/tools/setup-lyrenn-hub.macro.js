/* Bad Eden — Set up the LYRENN TOWN HUB (2026-09-16) — two hub scenes, seven doors, exterior cinematics
 * ─────────────────────────────────────────────────────────────────────────────
 * Lyrenn is two DA composites imported by Dave as "Lyrenn Ring Map" (the Green Ring: the
 * grain-elevator silo at the hub of the radial field, the Water Choir's basins south-west,
 * the Gentle Pest's garden on the east channels) and "Lyrenn Rows Map" (the co-op yard, the
 * low Field That Remembers You, the Forest That Will Not Be Fought on the west edge).
 * Lyrenn is unwalled — the circle is a crop field, so the doors are the places, not gates.
 *
 * WHAT IT WRITES (idempotent; DRY_RUN=true only reports):
 *   1. Flags both hub scenes (bbttcc-travel.isTownHub/townLabel/hexUuid).
 *   2. Door Drawings flagged locationLink { key, label, targetSceneUuid, sceneUuids[], beatId }; a bar on
 *      each map's shared edge crosses to the other map. Coordinates verified by crop on the 16800/9600-wide
 *      renders; scaled to the scene + padding.
 *   3. EXTERIOR CINEMATICS for the Choir, the Pest, the Forest, the co-op and the low Field (from the
 *      fixit template: start = exterior POV, next = the location's battlemap/interior where one exists,
 *      24 s, ONE choice "Go in" → the location's existing entry beat; questId + requires copied from it).
 *      The Green Ring cinematic already exists (its dangling nextSceneId is repaired → the ring battlemap).
 *      The Seed Vault door runs `lyrenn_seed_vault` directly (the vault is inside the silo; no exterior of its own).
 *   4. returnLink → its hub on every location scene; townHubSceneUuid on the Lyrenn hex → Ring map.
 *   5. beat.sceneId / cinematic ids: only EMPTY or DANGLING ids filled (Dave already deleted the old
 *      `lyrenn_map` emblem, so the three hub beats are dangling → the Ring map).
 *
 * HOW TO RUN: Script macro, GM, on ember. Set DRY_RUN=false to apply. Downloads a campaigns backup first.
 * ─────────────────────────────────────────────────────────────────────────────
 */
(async () => {
  const DRY_RUN = false;                  // <-- set false to apply
  const SCOPE = "bbttcc-travel", NS = "bbttcc-campaign", TERR = "bbttcc-territory";
  const TOWN = "Lyrenn";
  const HEX_ALIASES = ["lyrenn"];

  const HUBS = {
    ring: { sceneName: "Lyrenn Ring Map", label: `${TOWN} · The Green Ring`, refWidth: 16800, refHeight: 9900 },
    rows: { sceneName: "Lyrenn Rows Map", label: `${TOWN} · The Rows`, refWidth: 9600, refHeight: 9300 }
  };
  // Door centres/sizes in RENDER pixels (verified 2026-09-16).
  const DOORS = [
    { hub: "ring", key: "greenring", label: "The Green Ring",          x: 9235,  y: 5104, w: 3000, h: 3000, color: "#9dff8a",
      exterior: "lyrenn_green_ring_pov", interior: "green_ring_hexchrome_battlemap", extra: [],
      beatId: "lyrenn_green_ring_cinematic", intro: null, blurb: null },
    { hub: "ring", key: "seedvault", label: "The Seed Vault",          x: 9235,  y: 7000, w: 1600, h: 700,  color: "#ffd166",
      exterior: "lyrenn_seed_bank", interior: null, extra: [],
      beatId: "lyrenn_seed_vault", intro: null, blurb: null, direct: true },
    { hub: "ring", key: "choir",     label: "The Water Choir",         x: 3000,  y: 7430, w: 3200, h: 2600, color: "#7ff6ff",
      exterior: "lyrenn_water_choir", interior: null, extra: [],
      beatId: "lyrenn_water_choir_exterior", intro: "lyrenn_water_choir", blurb: "Stone-lined channels, hand-carved, gravity-fed. Notes rise where the channels narrow; low tones hum in the wide basins. The children who tune them are terrifying and correct. One basin never tunes. Nobody skips it by accident." },
    { hub: "ring", key: "pest",      label: "The East Channels",       x: 14040, y: 5150, w: 3000, h: 3000, color: "#ffb347",
      exterior: "lyrenn_gentle_pest_hexchrome_pov", interior: "lyren buggin hexhchrome battlemap", extra: [],
      beatId: "lyrenn_gentle_pest_exterior", intro: "lyrenn_the_gentle_pest_acceptance", blurb: "The east irrigation channels, where the scrub starts. Something has been tearing them up at night, and every channel it touches points the same way: toward the Green Ring. It is not subtle. It may not be malicious. Elsin would like a second opinion." },
    { hub: "rows", key: "forest",    label: "The Forest That Will Not Be Fought", x: 890, y: 5830, w: 1700, h: 5000, color: "#a0d8ff",
      exterior: "lyrenn_forest_not_fought", interior: null, extra: ["Forest of Early Tipahret hexhchrome battlemap"],
      beatId: "lyrenn_forest_exterior", intro: "lyrenn_forest_will_not_be_fought_quest_acceptance", blurb: "The treeline outside Lyrenn has started editing the fence line, a stride closer every morning. Nobody has seen a tree move. Everybody has seen where it was yesterday. Rowan says it is not angry. Rowan says that like it matters." },
    { hub: "rows", key: "coop",      label: "The Co-op",               x: 6200,  y: 2600, w: 6000, h: 4400, color: "#c9a0ff",
      exterior: "lyrenn_day_3_pov", interior: null, extra: ["lyrenn_farms hexchrome battlemap", "lyrenn_day_1_pov"],
      beatId: "lyrenn_coop_exterior", intro: "lyrenn_elsin_quade_convo", blurb: "The reinforced shell of the old agricultural co-op: tanks, a windmill, solar cloth strung between poles like tired flags. Elsin's table is co-op plank, scrubbed pale. You sleep in the loft above it, when you sleep." },
    { hub: "rows", key: "field",     label: "The Field That Remembers You", x: 6170, y: 7200, w: 4300, h: 3600, color: "#ff8c8c",
      exterior: "lyrenn_field_remembers", interior: "the field that remembers you hexchrome battlemap", extra: [],
      beatId: "lyrenn_low_field_exterior", intro: "lyrenn_the_field_that_remembers_you_intro", blurb: "The low field, where the rows end. Unharvested, and not by neglect: the plants stand in postures. At the field's edge, half-buried where the furrows stop, a stone figure kneels. The furrows bend around it. They always have." }
  ];
  const CROSS = [
    { hub: "ring", key: "to_rows", label: "⇦ The Rows",      to: "rows", x: 350,  y: 5000, w: 500, h: 6000, color: "#ffffff" },
    { hub: "rows", key: "to_ring", label: "The Green Ring ⇨", to: "ring", x: 9350, y: 4650, w: 400, h: 6000, color: "#ffffff" }
  ];
  const BEAT_MAP = [
    ["lyrenn_green_ring_cinematic", "greenring", "exterior"], ["lyrenn_water_choir_exterior", "choir", "exterior"], ["lyrenn_gentle_pest_exterior", "pest", "exterior"],
    ["lyrenn_forest_exterior", "forest", "exterior"], ["lyrenn_coop_exterior", "coop", "exterior"], ["lyrenn_low_field_exterior", "field", "exterior"],
    ["lyrenn_green_ring", "greenring", "interior"],
    ["lyrenn_seed_vault", "seedvault", "exterior"],
    ["lyrenn_water_choir", "choir", "exterior"],
    ["lyrenn_the_gentle_pest", "pest", "interior"], ["lyrenn_gentle_pest", "pest", "interior"],
    ["lyrenn_forest_will_not_be_fought", "forest", "exterior"],
    ["lyrenn_the_field_that_remembers_you", "field", "exterior"], ["lyrenn_red_thread", "field", "exterior"],
    ["lyrenn_elsin_", "coop", "exterior"], ["lyrenn_rowan_", "@lyrenn_day_1_pov", ""]   // "@scene": a direct scene, no door
  ];
  const HUB_BEATS = { ring: ["lyrenn_opening_scene", "lyrenn_main_scene", "lyrenn_quest_scene", "lyrenn_town_walk", "lyrenn_quest_acceptance", "lyrenn_hex_settles"] };
  const OVERRIDE_LIVE_BEATS = new Set();
  const REPLACE_SCENE_NAMES = new Set(["lyrenn_map"]);
  const DUR_MS = 24000;

  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const changes = [], warns = [], todo = [];
  const norm = (s) => String(s || "").replace(/[\s ]+/g, " ").trim().toLowerCase();
  const sceneByName = (name) => name ? (game.scenes.find(s => norm(s.name) === norm(name)) || null) : null;
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
  const main = HUBS.ring.scene;

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
  const townQuest = byId.lyrenn_main_scene?.questId || byId.lyrenn_opening_scene?.questId || null;

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
  for (const d of DOORS) {
    if (!d.sc.exterior || d.direct) continue;
    if (byId[d.beatId]) continue;
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
  for (const c of CROSS) await placeDoor(c.hub, c.key, c.label, c.color, c.x, c.y, c.w, c.h, { key: c.key, label: c.label, targetSceneUuid: HUBS[c.to].scene.uuid, sceneUuids: [], beatId: null }, "r");
  if (hex && hex.flags?.[SCOPE]?.townHubSceneUuid !== main.uuid) { changes.push(`hex "${hex.flags[TERR].name}": townHubSceneUuid → ${HUBS.ring.label}`); if (!DRY_RUN) await hex.update({ [`flags.${SCOPE}.townHubSceneUuid`]: main.uuid }); }

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
  todo.push("Rowan has no door of his own — he is met where the rows end (the low Field) and in the co-op's 'extra' scenes; add a Rowan door if you want him clickable.");

  console.group(`[lyrenn-hub] ${DRY_RUN ? "DRY RUN — " : ""}${changes.length} change(s), ${warns.length} warning(s), ${todo.length} for you`);
  changes.forEach(c => console.log(" •", c)); warns.forEach(w => console.warn(" ⚠", w)); todo.forEach(t => console.log(" ⏳", t)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`Lyrenn hub DRY RUN: ${changes.length} change(s), ${warns.length} warning(s) in console (F12). Set DRY_RUN=false to apply.`);
  if (beatChanges) {
    (foundry.utils.saveDataToFile || saveDataToFile)(JSON.stringify(wasStr ? JSON.parse(raw) : raw), "application/json", `backup-campaigns-before-lyrenn-hub-${Date.now()}.json`);
    await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  }
  const li = (a) => a.map(c => `<li>${foundry.utils.escapeHTML(c)}</li>`).join("");
  ChatMessage.create({ whisper: [game.user.id], content: `<b>Lyrenn hub wired.</b><ul style="font-size:12px">${li(changes)}</ul>${warns.length ? `<p><b>Warnings</b></p><ul style="font-size:12px">${li(warns)}</ul>` : ""}${todo.length ? `<p><b>For you</b></p><ul style="font-size:12px">${li(todo)}</ul>` : ""}` });
  ui.notifications.info(`Lyrenn hub applied: ${changes.length} change(s).${beatChanges ? " Campaign backup downloaded." : ""} Open "${main.name}" and click a building.`);
})();

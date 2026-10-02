/* Bad Eden — TOWN HUB RUNNER (2026-09-17) — one macro, every town; the towns live in towns.json
 * ─────────────────────────────────────────────────────────────────────────────
 * A town hub is a composited DA map (bin/da-merge) whose buildings are DOORS (location-doors.js).
 * This macro reads `modules/bbttcc-travel/tools/town-hubs/towns.json` and wires ONE town:
 *
 *   1. Flags each hub scene (bbttcc-travel.isTownHub / townLabel / hexUuid).
 *   2. Door Drawings flagged locationLink { key, label, targetSceneUuid, sceneUuids[], beatId } at the
 *      render-pixel coordinates in the config (scaled to the scene + its padding); cross-town bars.
 *   3. EXTERIOR CINEMATICS for doors that name one that doesn't exist yet (fixit template: start = exterior
 *      POV, next = interior/battlemap where one exists, 24 s, ONE choice "Go in" → the entry beat; questId +
 *      inject.requires copied from it). Cinematics this runner created (tag "town-door") are SYNCED to the
 *      config on re-runs; `removeBeats` / `removeDoors` delete stale ones.
 *   4. returnLink → its hub on every location scene; townHubSceneUuid on the town's hex Drawing.
 *   5. beat.sceneId / cinematic.startSceneId / nextSceneId: only EMPTY or DANGLING ids (or scenes named in
 *      `replaceSceneNames`, or beats in `overrideLiveBeats`) are written; a live id that differs is reported.
 *
 * Config shape (towns.json → towns[TOWN]):
 *   town, hexAliases[], hubs{key:{sceneName,label,refWidth,refHeight}}, doors[], cross[], beatMap[],
 *   hubBeats{hubKey:[beatIds]}, overrideLiveBeats[], replaceSceneNames[], removeBeats[], removeDoors[],
 *   leave{beatId:note}, notes[]. Door (x,y = the rectangle's CENTRE in ref px): {hub,key,label,x,y,w,h,color,exterior,interior,extra[],beatId,
 *   intro,blurb,direct,floor?,gate?}. Scenes are named by name or "Scene.<id>". beatMap rows: [prefix, doorKey,
 *   WALK-IN (2026-09-30): town `walkIn: true` also lays a Region over every door (token-move-in → doors.enter → the same
 *   opener; `gate` {beatMark|anyOf, fallback, message} plays the fallback beat until the mark is played). `floor` = a
 *   scene level NAME (or index) — the Drawing and Region live on that level only. `escalators`: [{hub,key,label,x,y,w,h,
 *   floors:[name,name]}] → a native changeLevel Region spanning both levels.
 *   "exterior"|"interior"] or [prefix, "@Scene name", ""] for a scene with no door.
 *
 * HOW TO RUN: Script macro, GM, on ember. Set TOWN, run (DRY_RUN=true reports), set DRY_RUN=false, run.
 * Downloads a campaigns backup before writing beats.
 * ─────────────────────────────────────────────────────────────────────────────
 */
(async () => {
  const TOWN_KEY = "chuckle";              // <-- fixit | ag | lyrenn | kt | chuckle | softlanding | stillwater | crownmall | maneuvervault | gloomgill  (keys of towns.json)
  const DRY_RUN = true;                   // <-- set false to apply
  const CONFIG_URL = "modules/bbttcc-travel/tools/town-hubs/towns.json";
  const SCOPE = "bbttcc-travel", NS = "bbttcc-campaign", TERR = "bbttcc-territory";
  const DUR_MS = 24000;

  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  let towns;
  try { towns = await (await fetch(`${CONFIG_URL}?t=${Date.now()}`)).json(); } catch (e) { return ui.notifications.error(`Could not load ${CONFIG_URL}: ${e.message}`); }
  const C = towns[TOWN_KEY]; if (!C) return ui.notifications.error(`No town "${TOWN_KEY}" in towns.json (have: ${Object.keys(towns).join(", ")})`);
  const TOWN = C.town;
  const HUBS = foundry.utils.deepClone(C.hubs); const DOORS = foundry.utils.deepClone(C.doors || []); const CROSS = C.cross || [];
  const BEAT_MAP = C.beatMap || []; const HUB_BEATS = C.hubBeats || {}; const LEAVE = C.leave || {};
  const OVERRIDE_LIVE_BEATS = new Set(C.overrideLiveBeats || []); const REPLACE_SCENE_NAMES = new Set(C.replaceSceneNames || []);
  const REMOVE_BEATS = C.removeBeats || []; const REMOVE_DOORS = C.removeDoors || [];
  const WALK_IN = C.walkIn === true; const ESCALATORS = C.escalators || [];

  const changes = [], warns = [], todo = [...(C.notes || [])];
  const norm = (s) => String(s || "").replace(/[\s ]+/g, " ").trim().toLowerCase();
  // Scene lookup (2026-09-25): exact (normalized) first; then a DRIFT match that ignores the decorative
  // parts of a HexChrome export name (view · hexchrome · pov · battlemap · a trailing v2/v3) and accepts a
  // unique prefix either way — so "grange_hall_exterio_view_hexchrome_pov" (a typo'd import) still binds
  // to the config's "grange_hall_exterior_hexchrome_pov_v2". Drift matches land in the change report.
  const loose = (n) => norm(n).replace(/[^a-z0-9]+/g, "").replace(/(view|hexchrome|pov)/g, "").replace(/v\d+$/, "");
  const sceneByName = (name) => {
    if (!name) return null;
    if (/^Scene\./.test(name)) return game.scenes.get(name.split(".").pop()) || null;
    const exact = game.scenes.find(s => norm(s.name) === norm(name)); if (exact) return exact;
    const want = loose(name); if (!want) return null;
    // a prefix only counts when the shorter name is most of the longer one — "chucklecreek" must not match every town scene
    const cands = game.scenes.filter(s => { const have = loose(s.name); if (have === want) return true; const [a, b] = have.length <= want.length ? [have, want] : [want, have]; return a.length >= 8 && b.startsWith(a) && a.length >= Math.ceil(b.length * 0.7); });
    if (cands.length === 1) { const note = `scene "${name}" matched by drift → "${cands[0].name}"`; if (!changes.includes(note)) changes.push(note); return cands[0]; }
    if (cands.length > 1) { const note = `scene "${name}": ${cands.length} drift candidates — name one exactly: ${cands.map(c => c.name).join(" | ")}`; if (!warns.includes(note)) warns.push(note); }
    return null;
  };
  const liveScene = (ref) => { const r = String(ref || "").trim(); if (!r) return null; return game.scenes.get(r.split(".").pop()) || null; };
  const replaceable = (sc) => !sc || REPLACE_SCENE_NAMES.has(sc.name);

  // ── hex ──────────────────────────────────────────────────────────────────
  let hex = null;
  for (const sc of game.scenes) { for (const d of sc.drawings) { const tf = d.flags?.[TERR]; if (!tf) continue; if ((tf.isHex || tf.kind === "territory-hex" || tf.name) && (C.hexAliases || []).map(norm).includes(norm(tf.name || d.text))) { hex = d; break; } } if (hex) break; }
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
  // scene levels (v14 native): a door's `floor` names a level (by name, loose) or indexes one; null = whole scene
  const levelsOf = (sc) => { const L = sc.levels; const arr = Array.isArray(L) ? L : (L?.contents || Array.from(L || [])); return [...arr].sort((a, b) => Number(a.elevation?.bottom ?? 0) - Number(b.elevation?.bottom ?? 0)); };  // index = floor order, lowest first
  const levelFor = (hubKey, floor) => {
    if (floor == null || floor === "") return null;
    const L = levelsOf(HUBS[hubKey].scene); if (!L.length) { warns.push(`floor "${floor}" asked but "${HUBS[hubKey].scene.name}" has no levels`); return null; }
    if (typeof floor === "number") return L[floor] || null;
    const want = norm(floor); const hit = L.find(l => norm(l.name) === want) || L.find(l => norm(l.name).includes(want));
    if (!hit) warns.push(`floor "${floor}" not found on "${HUBS[hubKey].scene.name}" (have: ${L.map(l => l.name).join(" | ")})`);
    return hit || null;
  };
  const mainHubKey = C.mainHub || Object.keys(HUBS)[0]; const main = HUBS[mainHubKey].scene;

  // ── location scenes ──────────────────────────────────────────────────────
  for (const d of DOORS) {
    d.extra = d.extra || [];
    d.sc = { exterior: sceneByName(d.exterior), interior: sceneByName(d.interior), extra: d.extra.map(sceneByName).filter(Boolean) };
    if (!d.sc.exterior) warns.push(`${d.label}: exterior scene "${d.exterior}" not found — door skipped`);
    if (d.interior && !d.sc.interior) warns.push(`${d.label}: interior scene "${d.interior}" not found — exterior used instead`);
    if (!d.sc.interior) d.sc.interior = d.sc.exterior;
    d.extra.forEach(n => { if (!sceneByName(n)) warns.push(`${d.label}: extra scene "${n}" not found (ignored)`); });
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
  const townQuest = (C.townQuestFrom || []).map(id => byId[id]?.questId).find(Boolean) || null;
  // EVERGREEN town (2026-09-25, live-caught: "Pearl's Diner Exterior stays closed — it belongs to Act 1"): a door
  // cinematic is undeclared, so its storyPhase≥1 gate reads as Act 1 content and the act seal shuts the door once
  // the story moves on. towns.json `evergreen: true` stamps inject.evergreen on every door opener — a grief town
  // (an evergreen quest) is reachable in any act. Existing door beats are SYNCed when the flag changes.
  const EVERGREEN = C.evergreen === true;

  // ── 3. exterior cinematics ───────────────────────────────────────────────
  const mkCinematic = (d) => {
    const intro = d.intro ? byId[d.intro] : null;
    if (d.intro && !intro) warns.push(`${d.label}: intro beat ${d.intro} not found — cinematic gets no "Go in" choice`);
    const requires = intro?.inject?.requires ? foundry.utils.deepClone(intro.inject.requires) : [{ flag: "storyPhase", gte: 1 }];
    return {
      id: d.beatId, label: `${TOWN} - ${d.label} Exterior`, type: "cinematic", timeScale: "scene", tags: "town-door exterior", politicalTags: "",
      outcomes: { success: null, failure: null },
      inject: { cooldownTurns: 0, repeatable: true, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires, ...(EVERGREEN ? { evergreen: true } : {}) },
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
    if (!d.sc.exterior || d.direct || !d.beatId) continue;
    const cur = byId[d.beatId];
    if (cur) {
      if (/town-door/.test(String(cur.tags || ""))) {
        const want = mkCinematic(d); const diffs = [];
        if (cur.cinematic?.startSceneId !== want.cinematic.startSceneId) diffs.push("start");
        if ((cur.cinematic?.nextSceneId || null) !== want.cinematic.nextSceneId) diffs.push("next");
        if (JSON.stringify(cur.choices || []) !== JSON.stringify(want.choices)) diffs.push("choices");
        if (!!cur.inject?.evergreen !== EVERGREEN) diffs.push("evergreen");
        if (diffs.length) { changes.push(`beat SYNC ${d.beatId}: ${diffs.join(", ")} → "${d.sc.exterior.name}"${want.cinematic.nextSceneId ? ` → "${d.sc.interior.name}"` : ""}`); beatChanges++; if (!DRY_RUN) { cur.cinematic = want.cinematic; cur.choices = want.choices; cur.inject = { ...(cur.inject || {}), ...(EVERGREEN ? { evergreen: true } : {}) }; if (!EVERGREEN && cur.inject) delete cur.inject.evergreen; } }
      }
      continue;
    }
    const b = mkCinematic(d);
    changes.push(`beat NEW ${b.id}: cinematic "${d.sc.exterior.name}"${b.cinematic.nextSceneId ? ` → "${d.sc.interior.name}"` : ""}${b.choices.length ? ` · Go in → ${b.choices[0].next}` : " · no intro beat"} · q=${b.questId || "-"}`); beatChanges++;
    if (!DRY_RUN) { beats.push(b); byId[b.id] = b; }
  }
  for (const d of DOORS) if (d.direct && d.beatId && !byId[d.beatId]) warns.push(`${d.label}: door beat ${d.beatId} not found — door will plain-dive`);

  // ── 2. doors + 4. return links ───────────────────────────────────────────
  const placeDoor = async (hubKey, key, label, color, x, y, w, h, link, shape = "e", { floor = null, gate = null, walkIn = WALK_IN } = {}) => {
    const H = HUBS[hubKey]; const sc = H.scene; const k = sc.width / H.refWidth; const ky = H.refHeight ? sc.height / H.refHeight : k;  // per-axis: backgrounds stretch to the scene rect
    const offX = sc.dimensions?.sceneX || 0, offY = sc.dimensions?.sceneY || 0;
    const W = Math.round(w * k), Hh = Math.round(h * ky), X = Math.round(offX + x * k - W / 2), Y = Math.round(offY + y * ky - Hh / 2);
    const lvl = levelFor(hubKey, floor); const onLevel = lvl ? { elevation: Number(lvl.elevation?.bottom ?? 0), levels: [lvl.id ?? lvl._id] } : {};
    const data = { x: X, y: Y, shape: { type: shape, width: W, height: Hh }, ...onLevel,
      strokeColor: color, strokeWidth: Math.max(6, Math.round(14 * k)), strokeAlpha: 0.85, fillType: CONST.DRAWING_FILL_TYPES.SOLID, fillColor: color, fillAlpha: 0.08,
      text: label, fontSize: Math.max(36, Math.round(96 * k)), textColor: "#ffffff", textAlpha: 0.95, locked: true, interface: true, flags: { [SCOPE]: { locationLink: link } } };
    const cur = sc.drawings.contents.find(d => d.flags?.[SCOPE]?.locationLink?.key === key);
    const where = lvl ? ` [${lvl.name}]` : "";
    const desc = `${H.label} · ${label}${where} @ (${X + W / 2},${Y + Hh / 2}) ${W}×${Hh} → "${liveScene(link.targetSceneUuid)?.name}"${link.beatId ? ` · beat ${link.beatId}` : ""}`;
    if (!cur) { changes.push(`door ${desc}`); if (!DRY_RUN) await sc.createEmbeddedDocuments("Drawing", [data]); }
    else {
      const upd = {};
      if (JSON.stringify(cur.flags[SCOPE].locationLink) !== JSON.stringify(link)) upd[`flags.${SCOPE}.locationLink`] = link;
      if (lvl && (JSON.stringify(Array.from(cur.levels || [])) !== JSON.stringify(onLevel.levels) || cur.elevation !== onLevel.elevation)) { upd.levels = onLevel.levels; upd.elevation = onLevel.elevation; }
      // the config is the source of truth for WHERE a door sits too (review 2026-10-01: the Soft Landing / Stillwater / Chuckle
      // rectangles were converted from top-left to centres — a re-run must move the live Drawings, not only their Regions)
      const moved = Math.round(cur.x) !== X || Math.round(cur.y) !== Y || Math.round(cur.shape?.width ?? 0) !== W || Math.round(cur.shape?.height ?? 0) !== Hh;
      if (moved) { upd.x = X; upd.y = Y; upd.shape = { width: W, height: Hh }; }
      if (Object.keys(upd).length) { changes.push(`door ${moved ? "move" : "relink"} ${desc}`); if (!DRY_RUN) await cur.update(upd); }
    }
    if (!walkIn) return;
    // the walk-in Region: same rectangle, same level band, executeScript → doors.enter on the mover's client
    const rlink = { ...link, doorKey: key, ...(gate ? { gate } : {}) };
    // a v14 Level's null bound means unbounded (an upper floor with no ceiling has top: null) — pass nulls through, never as 0
    const nb = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));   // ±Infinity reads as unbounded too
    const band = lvl ? { bottom: nb(lvl.elevation?.bottom), top: nb(lvl.elevation?.top) } : { bottom: null, top: null };
    const source = `// bbttcc walk-in door "${key}" — fires on the mover's client only\nif (!event.user.isSelf) return;\nawait game.bbttcc?.api?.travel?.doors?.enter?.(region.uuid, { tokenUuid: event.data?.token?.uuid });`;
    const rdata = { name: `Door · ${label}`, color, visibility: CONST.REGION_VISIBILITY?.GAMEMASTER ?? 1,
      shapes: [{ type: "rectangle", x: X, y: Y, width: W, height: Hh, rotation: 0, hole: false }], elevation: band, ...(lvl ? { levels: onLevel.levels } : {}),
      behaviors: [{ name: `walk-in ${key}`, type: "executeScript", system: { events: ["tokenMoveIn"], source } }],
      flags: { [SCOPE]: { locationLink: rlink } } };
    const rcur = (sc.regions?.contents || []).find(r => r.flags?.[SCOPE]?.locationLink?.doorKey === key);
    if (!rcur) { changes.push(`region ${H.label} · ${label}${where} (walk-in${gate ? ", gated on " + (gate.beatMark || (gate.anyOf || []).join("|")) : ""})`); if (!DRY_RUN) await sc.createEmbeddedDocuments("Region", [rdata]); }
    else {
      const sh = rcur.shapes?.[0] || {}; const moved = Math.round(sh.x) !== X || Math.round(sh.y) !== Y || Math.round(sh.width) !== W || Math.round(sh.height) !== Hh;
      const relinked = JSON.stringify(rcur.flags[SCOPE].locationLink) !== JSON.stringify(rlink);
      // a changed `floor` must move the Region too (level + elevation band), not only the Drawing (review 2026-10-01)
      const rb = { bottom: nb(rcur.elevation?.bottom), top: nb(rcur.elevation?.top) };
      const releveled = (lvl && JSON.stringify(Array.from(rcur.levels || [])) !== JSON.stringify(onLevel.levels)) || rb.bottom !== band.bottom || rb.top !== band.top;
      if (moved || relinked || releveled) { changes.push(`region resync ${H.label} · ${label}${releveled ? " (level/elevation)" : ""}`); if (!DRY_RUN) await rcur.update({ shapes: rdata.shapes, elevation: band, ...(lvl ? { levels: onLevel.levels } : {}), [`flags.${SCOPE}.locationLink`]: rlink }); }
    }
  };
  // escalators / stairs: a native changeLevel Region spanning two levels (the token is prompted to change floor)
  const placeEscalator = async (e) => {
    const H = HUBS[e.hub]; const sc = H.scene; const k = sc.width / H.refWidth; const ky = H.refHeight ? sc.height / H.refHeight : k;
    const offX = sc.dimensions?.sceneX || 0, offY = sc.dimensions?.sceneY || 0;
    const W = Math.round(e.w * k), Hh = Math.round(e.h * ky), X = Math.round(offX + e.x * k - W / 2), Y = Math.round(offY + e.y * ky - Hh / 2);
    const lv = (e.floors || []).map(f => levelFor(e.hub, f)).filter(Boolean); if (lv.length < 2) { warns.push(`escalator ${e.key}: needs two resolvable floors`); return; }
    // null = unbounded (v14): any floor with no ceiling/floor makes the span unbounded on that side
    const bs = lv.map(l => l.elevation?.bottom), ts = lv.map(l => l.elevation?.top);
    const unb = (v) => v == null || !Number.isFinite(Number(v)); const bottom = bs.some(unb) ? null : Math.min(...bs.map(Number)), top = ts.some(unb) ? null : Math.max(...ts.map(Number));
    const rdata = { name: `Escalator · ${e.label}`, color: e.color || "#ffd54f", visibility: CONST.REGION_VISIBILITY?.ALWAYS ?? 2,
      shapes: [{ type: "rectangle", x: X, y: Y, width: W, height: Hh, rotation: 0, hole: false }], elevation: { bottom, top }, levels: lv.map(l => l.id ?? l._id),
      behaviors: [{ name: `change level ${e.key}`, type: "changeLevel", system: {} }], flags: { [SCOPE]: { escalator: e.key } } };
    const cur = (sc.regions?.contents || []).find(r => r.flags?.[SCOPE]?.escalator === e.key);
    if (!cur) { changes.push(`escalator ${H.label} · ${e.label} [${lv.map(l => l.name).join(" ↔ ")}] @ (${X + W / 2},${Y + Hh / 2}) ${W}×${Hh}`); if (!DRY_RUN) await sc.createEmbeddedDocuments("Region", [rdata]); }
    else {
      const sh = cur.shapes?.[0] || {}; const moved = Math.round(sh.x) !== X || Math.round(sh.y) !== Y || Math.round(sh.width) !== W || Math.round(sh.height) !== Hh;
      const rebanded = (unb(cur.elevation?.bottom) ? null : Number(cur.elevation.bottom)) !== bottom || (unb(cur.elevation?.top) ? null : Number(cur.elevation.top)) !== top || JSON.stringify(Array.from(cur.levels || [])) !== JSON.stringify(rdata.levels);
      if (moved || rebanded) { changes.push(`escalator resync ${H.label} · ${e.label}`); if (!DRY_RUN) await cur.update({ shapes: rdata.shapes, elevation: rdata.elevation, levels: rdata.levels }); }
      else changes.push(`· ok escalator ${e.label}`);
    }
  };
  // two walk-in rectangles on one hub + level that intersect fire BOTH doors on a single step (review 2026-10-01) — warn, never guess
  { const box = (d) => [d.x - d.w / 2, d.y - d.h / 2, d.x + d.w / 2, d.y + d.h / 2]; const walk = DOORS.filter(d => (d.walkIn ?? WALK_IN));
    for (let i = 0; i < walk.length; i++) for (let j = i + 1; j < walk.length; j++) { const a = walk[i], b = walk[j]; if (a.hub !== b.hub || String(a.floor ?? "") !== String(b.floor ?? "")) continue;
      const [a0, a1, a2, a3] = box(a), [b0, b1, b2, b3] = box(b); const ox = Math.min(a2, b2) - Math.max(a0, b0), oy = Math.min(a3, b3) - Math.max(a1, b1);
      if (ox > 0 && oy > 0) warns.push(`walk-in doors "${a.key}" and "${b.key}" overlap by ${ox}×${oy} ref px on the same level — a token in the overlap opens both; shrink one in towns.json`); } }
  for (const d of DOORS) {
    if (!d.sc.exterior) continue;
    await placeDoor(d.hub, d.key, d.label, d.color || "#ffffff", d.x, d.y, d.w, d.h, { key: d.key, label: d.label, targetSceneUuid: d.sc.exterior.uuid, sceneUuids: d.allScenes.map(s => s.uuid), beatId: d.beatId || null }, "e", { floor: d.floor ?? null, gate: d.gate || null, walkIn: d.walkIn ?? WALK_IN });
    const hubScene = HUBS[d.hub].scene;
    for (const sc of d.allScenes) {
      const rl = sc.flags?.[SCOPE]?.returnLink;
      if (!rl || rl.targetSceneUuid !== hubScene.uuid) { changes.push(`"${sc.name}": returnLink → ${HUBS[d.hub].label}${rl ? ` (was "${rl.label}")` : ""}`); if (!DRY_RUN) await sc.update({ [`flags.${SCOPE}.returnLink`]: { targetSceneUuid: hubScene.uuid, label: TOWN } }); }
    }
  }
  for (const key of REMOVE_DOORS) for (const H of Object.values(HUBS)) {
    const cur = H.scene.drawings.contents.find(d => d.flags?.[SCOPE]?.locationLink?.key === key);
    if (cur) { changes.push(`door REMOVE ${key} on "${H.scene.name}"`); if (!DRY_RUN) await cur.delete(); }
    // …and its walk-in Region, which would otherwise keep firing (and playing the gate's fallback) for a door that is gone
    for (const r of (H.scene.regions?.contents || []).filter(r => r.flags?.[SCOPE]?.locationLink?.doorKey === key)) { changes.push(`region REMOVE ${key} on "${H.scene.name}"`); if (!DRY_RUN) await r.delete(); }
  }
  for (const c of CROSS) await placeDoor(c.hub, c.key, c.label, c.color || "#ffffff", c.x, c.y, c.w, c.h, { key: c.key, label: c.label, targetSceneUuid: HUBS[c.to].scene.uuid, sceneUuids: [], beatId: null }, "r");
  for (const e of ESCALATORS) await placeEscalator(e);
  if (hex && hex.flags?.[SCOPE]?.townHubSceneUuid !== main.uuid) { changes.push(`hex "${hex.flags[TERR].name}": townHubSceneUuid → "${main.name}"`); if (!DRY_RUN) await hex.update({ [`flags.${SCOPE}.townHubSceneUuid`]: main.uuid }); }

  // ── 5. beat scene ids ────────────────────────────────────────────────────
  const doorByKey = Object.fromEntries(DOORS.map(d => [d.key, d]));
  const arrival = new Set();   // the hex's configured arrival beats also land on the main hub
  if (hex) {
    const ov = camp.hexOverrides?.[hex.uuid];
    for (const id of [].concat(ov?.onEnterBeatIds || [], ov?.onEnterBeatId || [], ov?.beatId || [], hex.flags?.[TERR]?.campaign?.onEnterBeatId || [])) for (const part of String(id).split("|")) if (part.trim()) arrival.add(part.trim());
  }
  const hubBeat = (id) => { for (const [k, ids] of Object.entries(HUB_BEATS)) if (ids.includes(id)) return HUBS[k].scene; return (C.arrivalToHub !== false && arrival.has(id)) ? main : null; };
  const want = (b) => {
    if (LEAVE[b.id]) return { leave: LEAVE[b.id] };
    const hs = hubBeat(b.id); if (hs) return { scene: hs, why: "town map", next: hs };
    for (const [pre, key, side] of BEAT_MAP) if (b.id.startsWith(pre)) {
      if (String(key).startsWith("@")) { const sc = sceneByName(key.slice(1)); return sc ? { scene: sc, why: key.slice(1), next: sc } : { missing: key }; }
      const d = doorByKey[key]; const sc = d?.sc?.[side]; return sc ? { scene: sc, why: `${key} ${side}`, next: d.sc.interior } : { missing: `${key} ${side}` };
    }
    return null;
  };
  for (const b of beats) {
    const w = want(b); if (!w) continue;
    const cur = String(b.sceneId || "").trim(); const live = liveScene(cur);
    if (w.leave) { todo.push(`beat ${b.id}: sceneId ${cur ? `"${cur}"${live ? "" : " (DANGLING)"}` : "empty"} — left for you; ${w.leave}`); continue; }
    if (w.missing) { warns.push(`beat ${b.id}: wanted ${w.missing} but that scene is missing`); continue; }
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

  console.group(`[town-hub:${TOWN_KEY}] ${DRY_RUN ? "DRY RUN — " : ""}${changes.length} change(s), ${warns.length} warning(s), ${todo.length} for you`);
  changes.forEach(c => console.log(" •", c)); warns.forEach(w => console.warn(" ⚠", w)); todo.forEach(t => console.log(" ⏳", t)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`${TOWN} hub DRY RUN: ${changes.length} change(s), ${warns.length} warning(s) in console (F12). Set DRY_RUN=false to apply.`);
  if (beatChanges) {
    (foundry.utils.saveDataToFile || saveDataToFile)(JSON.stringify(wasStr ? JSON.parse(raw) : raw), "application/json", `backup-campaigns-before-${TOWN_KEY}-hub-${Date.now()}.json`);
    await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  }
  const li = (a) => a.map(c => `<li>${foundry.utils.escapeHTML(c)}</li>`).join("");
  ChatMessage.create({ whisper: [game.user.id], content: `<b>${foundry.utils.escapeHTML(TOWN)} hub wired.</b><ul style="font-size:12px">${li(changes)}</ul>${warns.length ? `<p><b>Warnings</b></p><ul style="font-size:12px">${li(warns)}</ul>` : ""}${todo.length ? `<p><b>For you</b></p><ul style="font-size:12px">${li(todo)}</ul>` : ""}` });
  ui.notifications.info(`${TOWN} hub applied: ${changes.length} change(s).${beatChanges ? " Campaign backup downloaded." : ""} Open "${main.name}" and click a building.`);
})();

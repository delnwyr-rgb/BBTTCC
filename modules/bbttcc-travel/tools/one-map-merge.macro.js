/* Bad Eden — ONE MAP MERGE (2026-10-26, owner: "Let's try one big map and see how it flies!")
 *
 * The reverse of world-overview-migrate.macro.js (June 2026). The five region scenes ("regionDetail") were cut
 * from one master map and kept its coordinate space, so every hex, token and tile can move back onto ONE scene
 * unchanged. Why now: the June split was an FPS fix, and the 10-26 lab measurement showed the cost was never hex
 * count — it was each hex's label interleaving with its outline (fixed by the batched labels in
 * bbttcc-territory.center-hex-labels.enhancer.js). 141 batched hexes on one map out-ran today's River Heart.
 *
 * What it does (GM, DRY_RUN first, idempotent):
 *   1. creates (or reuses) the big map — River Heart's scene settings (art, size, padding, grid, light, ownership),
 *      flags regionDetail + hubSceneUuid kept, flags.bbttcc-travel.oneMap = true;
 *   2. MOVES every embedded document of the five region scenes onto it with keepId (drawings = hexes, tokens,
 *      notes, lights, sounds, walls, templates, regions); tiles are de-duplicated (each region carried the same
 *      logo tiles); an id that already exists on the big map is skipped and reported;
 *   4. REMAPS every saved reference: each region scene id is a 16-char random id, so swapping the id string swaps
 *      both "Scene.<region>" and "Scene.<region>.Drawing.<hex>" (hex ids are kept) — in world settings of our
 *      modules + system, actors (flags, system, embedded items), world items, every scene's flags and its
 *      drawings/tokens/tiles/notes flags + region behaviors, journal flags + page text;
 *   3. gives each World Map region link a landAt {x, y, scale} = the middle of its region's hexes on the big
 *      map (world-overview.js pans there after the dive);
 *   5. renames the emptied region scenes "(merged — safe to delete)", takes them out of navigation, flags
 *      mergedInto — nothing is deleted; activates the big map if a region scene was active.
 *
 * ⚠ ORDER: ⟲ Reset story to golden FIRST, then run this, then SAVE A NEW GOLDEN. A golden taken before the merge
 *   still holds the old region scene ids and would restore hex state into scenes that no longer hold the hexes.
 * Rollback: the emptied region scenes keep their ids; an Exact restore of a pre-merge save puts every hex back
 *   (then delete the big map).
 */
(async () => {
  const DRY_RUN = true;                       // <-- false to merge
  const BIG_NAME = "Bad Eden — The Whole Map";
  const SCOPE = "bbttcc-travel", TERR = "bbttcc-territory";
  if (!game.user?.isGM) return ui.notifications?.error("GM only");
  const report = []; const counts = { moved: {}, skipped: 0, tilesDeduped: 0, settings: 0, actors: 0, items: 0, sceneDocs: 0, journal: 0, landAt: 0 };

  const regions = game.scenes.filter(s => s.getFlag(SCOPE, "regionDetail") && !s.getFlag(SCOPE, "oneMap") && !s.getFlag(SCOPE, "mergedInto"));
  const isHex = d => { const f = d.flags?.[TERR]; return !!f && (f.isHex === true || f.kind === "territory-hex" || !!f.name); };
  let big = game.scenes.find(s => s.getFlag(SCOPE, "oneMap"));
  const template = regions.find(s => /river\s*heart/i.test(s.name)) || regions[0] || big;
  if (!template) return ui.notifications?.error("No region scenes and no big map found.");
  const regionIds = regions.map(s => s.id);
  report.push(`${DRY_RUN ? "DRY RUN" : "APPLY"} — one map merge. Regions: ${regions.map(s => `${s.name} (${s.drawings.filter(isHex).length} hexes, ${s.tokens.size} tokens)`).join(" · ") || "none left"}`);

  // region key per region scene (from its hexes) — for the World Map landAt
  const keyOfRegion = {}; const centroidByKey = {};
  const hexCenter = d => { const p = d.shape?.points || []; let sx = 0, sy = 0, n = 0; for (let i = 0; i + 1 < p.length; i += 2) { sx += p[i]; sy += p[i + 1]; n++; } return n ? { x: d.x + sx / n, y: d.y + sy / n } : { x: d.x, y: d.y }; };
  for (const sc of [...regions, ...(big ? [big] : [])]) for (const d of sc.drawings) {
    if (!isHex(d)) continue; const k = d.flags?.[SCOPE]?.regionKey; if (!k) continue;
    if (regions.includes(sc)) keyOfRegion[sc.id] ??= k;
    const c = hexCenter(d); const a = (centroidByKey[k] ??= { x: 0, y: 0, n: 0 }); a.x += c.x; a.y += c.y; a.n++;
  }

  // 1. the big map
  if (!big) {
    const src = template.toObject();
    const data = { ...src }; delete data._id; delete data._stats;
    data.name = BIG_NAME; data.active = false; data.navigation = true; data.navOrder = src.navOrder;
    for (const k of ["drawings", "tokens", "tiles", "notes", "lights", "sounds", "walls", "templates", "regions"]) data[k] = [];
    data.flags = foundry.utils.deepClone(src.flags || {});
    data.flags[SCOPE] = { ...(data.flags[SCOPE] || {}), oneMap: true, mergedFrom: regions.map(s => s.uuid) };
    report.push(`✚ CREATE scene "${BIG_NAME}" from ${template.name}'s settings`);
    if (!DRY_RUN) big = await Scene.create(data);
  } else report.push(`· ok (already) big map "${big.name}" (${big.id})`);
  const B = big?.id || "<new>";

  // 2. move embedded documents
  const EMB = [["Drawing", "drawings"], ["Token", "tokens"], ["Note", "notes"], ["AmbientLight", "lights"], ["AmbientSound", "sounds"], ["Wall", "walls"], ["MeasuredTemplate", "templates"], ["Region", "regions"], ["Tile", "tiles"]];
  // tiles: one of each image (each region carried its own copy of the logos, placed for its own view) — the
  // template scene's copy wins; an image only another region had comes across HIDDEN (the Saltwake "map label"
  // art sits over River Heart's hexes on the shared coordinates) for the GM to place and show.
  const seenTiles = new Set((big?.tiles?.contents || []).map(t => String(t.texture?.src || "")));
  const ordered = [...regions].sort((a, b) => (b === template) - (a === template));
  for (const sc of ordered) {
    for (const [type, coll] of EMB) {
      const docs = sc[coll]?.contents || []; if (!docs.length) continue;
      const create = [], remove = [];
      for (const d of docs) {
        let hideIt = false;
        if (type === "Tile") { const k = String(d.texture?.src || ""); if (seenTiles.has(k)) { counts.tilesDeduped++; remove.push(d.id); continue; } seenTiles.add(k); hideIt = sc !== template; }
        if (big?.[coll]?.get?.(d.id)) { counts.skipped++; report.push(`  ⚠ ${type} ${d.id} already on the big map — left on ${sc.name}`); continue; }
        const o = d.toObject(); if (hideIt) { o.hidden = true; report.push(`  · tile ${String(o.texture?.src || "").split("/").pop()} from ${sc.name} moved HIDDEN — place and show it by hand`); }
        create.push(o); remove.push(d.id);
      }
      counts.moved[type] = (counts.moved[type] || 0) + create.length;
      if (!DRY_RUN && big) {
        if (create.length) await big.createEmbeddedDocuments(type, create, { keepId: true, bbttccRestore: true });
        if (remove.length) await sc.deleteEmbeddedDocuments(type, remove, { bbttccRestore: true });
      }
    }
  }
  report.push(`MOVE ${Object.entries(counts.moved).map(([k, v]) => `${v} ${k}`).join(", ") || "nothing"}; ${counts.tilesDeduped} duplicate tile(s) dropped; ${counts.skipped} id clash(es)`);

  // 3. World Map region links land on their region (BEFORE the remap: the link's old target names the region)
  const KEY_BY_NAME = [[/iron\s*reach/i, "r1"], [/northern\s*march/i, "r2"], [/saltwake/i, "r3"], [/river\s*heart/i, "r4"], [/drowned\s*south/i, "r5"]];   // the June carve
  const hub = game.scenes.find(s => s.getFlag(SCOPE, "isWorldHub"));
  if (hub) {
    const u = [];
    for (const d of hub.drawings) {
      const link = d.flags?.[SCOPE]?.regionLink; if (!link) continue;
      const rid = String(link.targetSceneUuid || "").replace(/^Scene\./, "");
      const key = keyOfRegion[rid] || link.regionKey || KEY_BY_NAME.find(([re]) => re.test(String(link.label || d.text || "")))?.[1] || null; const c = key ? centroidByKey[key] : null;
      if (!c?.n) continue;
      const landAt = { x: Math.round(c.x / c.n), y: Math.round(c.y / c.n), scale: 1.1 };
      if (link.landAt && link.landAt.x === landAt.x && link.landAt.y === landAt.y) continue;
      u.push({ _id: d.id, [`flags.${SCOPE}.regionLink.landAt`]: landAt, [`flags.${SCOPE}.regionLink.regionKey`]: key });
      report.push(`  ✎ World Map link "${link.label || d.text}" lands at ${landAt.x},${landAt.y} (${key})`);
    }
    counts.landAt = u.length;
    if (u.length && !DRY_RUN) await hub.updateEmbeddedDocuments("Drawing", u);
  }

  // 4. remap references (region scene id → big map id)
  // this run's regions + every scene an earlier run retired (their ids are the ones still to chase down)
  const allRegionIds = [...new Set([...regionIds, ...game.scenes.filter(s => s.getFlag(SCOPE, "mergedInto")).map(s => s.id)])].filter(id => id && id !== B);
  let hits = 0;
  const swapStr = (s) => { let o = s; for (const R of allRegionIds) if (o.includes(R)) { hits += o.split(R).length - 1; o = o.split(R).join(B); } return o; };
  const deep = (v) => {
    if (typeof v === "string") return swapStr(v);
    if (Array.isArray(v)) { let ch = false; const a = v.map(x => { const y = deep(x); if (y !== x) ch = true; return y; }); return ch ? a : v; }
    // KEYS too: the campaign's hexOverrides are keyed by hex uuid ("Scene.<region>.Drawing.<hex>", or nested
    // Scene → <region> → Drawing → <hex> once a journal export expanded it)
    if (v && typeof v === "object") { let ch = false; const o = {}; for (const [k, x] of Object.entries(v)) { const nk = swapStr(k); const y = deep(x); if (y !== x || nk !== k) ch = true; o[nk] = y; } return ch ? o : v; }
    return v;
  };
  const OUR = ns => /^bbttcc-/.test(ns) || ns === "fourththing" || ns === "surge-powers";
  if (allRegionIds.length) {
    // settings
    for (const [full, cfg] of game.settings.settings) {
      if (cfg.scope !== "world" || !OUR(cfg.namespace)) continue;
      let v; try { v = game.settings.get(cfg.namespace, cfg.key); } catch (_e) { continue; }
      const nv = deep(v); if (nv === v) continue;
      counts.settings++; report.push(`  ✎ setting ${full}`);
      if (!DRY_RUN) await game.settings.set(cfg.namespace, cfg.key, nv);
    }
    // actors (+ items)
    for (const a of game.actors) {
      const f = deep(a._source.flags), sy = deep(a._source.system);
      const upd = {}; if (f !== a._source.flags) upd.flags = f; if (sy !== a._source.system) upd.system = sy;
      if (Object.keys(upd).length) { counts.actors++; if (!DRY_RUN) await a.update(upd, { recursive: false }); }
      const iu = []; for (const it of a.items) { const fi = deep(it._source.flags), si = deep(it._source.system); if (fi !== it._source.flags || si !== it._source.system) iu.push({ _id: it.id, ...(fi !== it._source.flags ? { flags: fi } : {}), ...(si !== it._source.system ? { system: si } : {}) }); }
      if (iu.length) { counts.items += iu.length; if (!DRY_RUN) await a.updateEmbeddedDocuments("Item", iu, { recursive: false }); }
    }
    for (const it of game.items) { const fi = deep(it._source.flags), si = deep(it._source.system); if (fi !== it._source.flags || si !== it._source.system) { counts.items++; if (!DRY_RUN) await it.update({ ...(fi !== it._source.flags ? { flags: fi } : {}), ...(si !== it._source.system ? { system: si } : {}) }, { recursive: false }); } }
    // scenes + their placeables
    for (const sc of game.scenes) {
      const f = deep(sc._source.flags); if (f !== sc._source.flags) { counts.sceneDocs++; if (!DRY_RUN) await sc.update({ flags: f }, { recursive: false }); }
      for (const [type, coll] of [["Drawing", "drawings"], ["Token", "tokens"], ["Tile", "tiles"], ["Note", "notes"]]) {
        const u = []; for (const d of sc[coll]) { const fd = deep(d._source.flags); if (fd !== d._source.flags) u.push({ _id: d.id, flags: fd }); }
        if (u.length) { counts.sceneDocs += u.length; if (!DRY_RUN) await sc.updateEmbeddedDocuments(type, u, { bbttccRestore: true, recursive: false }); }
      }
      for (const rg of sc.regions ?? []) {
        const u = []; for (const bh of rg.behaviors ?? []) { const s2 = deep(bh._source.system); if (s2 !== bh._source.system) u.push({ _id: bh.id, system: s2 }); }
        if (u.length) { counts.sceneDocs += u.length; if (!DRY_RUN) await rg.updateEmbeddedDocuments("RegionBehavior", u, { recursive: false }); }
      }
    }
    // journal
    for (const j of game.journal) {
      const f = deep(j._source.flags); if (f !== j._source.flags) { counts.journal++; if (!DRY_RUN) await j.update({ flags: f }, { recursive: false }); }
      const u = []; for (const p of j.pages) { const c = deep(p._source.text?.content ?? ""); const fp = deep(p._source.flags); if (c !== (p._source.text?.content ?? "") || fp !== p._source.flags) u.push({ _id: p.id, ...(c !== (p._source.text?.content ?? "") ? { text: { ...p._source.text, content: c } } : {}), ...(fp !== p._source.flags ? { flags: fp } : {}) }); }
      if (u.length) { counts.journal += u.length; if (!DRY_RUN) await j.updateEmbeddedDocuments("JournalEntryPage", u, { recursive: false }); }
    }
  }
  report.push(`REMAP ${allRegionIds.length} region id(s) → ${B}: ${hits} string hit(s) — ${counts.settings} setting(s), ${counts.actors} actor(s), ${counts.items} item(s), ${counts.sceneDocs} scene doc(s), ${counts.journal} journal doc(s)`);

  // 5. retire the emptied region scenes (kept, not deleted)
  for (const sc of regions) {
    report.push(`  ✎ retire "${sc.name}" → "(merged — safe to delete)", off navigation`);
    if (!DRY_RUN && big) {
      const wasActive = sc.active;
      await sc.update({ name: `${sc.name} (merged — safe to delete)`, navigation: false, [`flags.${SCOPE}.mergedInto`]: big.uuid, [`flags.${SCOPE}.regionDetail`]: false });
      if (wasActive) await big.activate();
    }
  }

  report.unshift(`${DRY_RUN ? "DRY RUN" : "APPLIED"} — ${Object.values(counts.moved).reduce((a, b) => a + b, 0)} document(s) moved, ${hits} reference(s) remapped, ${counts.landAt} World Map landing(s)`);
  console.log(report.join("\n"));
  ui.notifications?.info(`One map merge: ${report[0]} — see console`);
  return { report, counts, bigId: big?.id || null };
})();

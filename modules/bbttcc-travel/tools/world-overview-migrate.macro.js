/* Bad Eden — World Overview · 2.2 MIGRATION (run as GM macro IN-WORLD)
 *
 * Splits the master hex scene into 5 regional detail scenes per the regionKey stamped
 * by 2.1. Moves each hex Drawing (keepId → _id preserved, so quest/Drawing-id refs
 * survive), then repairs the few persisted FULL-UUID hex references via an exact
 * old→new string remap (ley-gate linkHexUuid, siege.supplyOriginHexId on hexes;
 * hexBinding.hexUuid on facility actors).
 *
 *  ⚠️  DRY_RUN = true by default: reports everything it WOULD do, changes NOTHING.
 *      Review the report, then set DRY_RUN = false and re-run to execute.
 *
 * Safe/reversible: region scenes share the master's coordinate space (positions +
 * intra-region adjacency preserved); each moved hex keeps flags[bbttcc-travel].
 * originSceneUuid for rollback; master scene is retained (emptied) until you delete it.
 * Run with NO active siege in progress (siege depot/target are runtime, not migrated).
 */
(async () => {
  const SCOPE = "bbttcc-travel";
  const MOD_TERR = "bbttcc-territory";
  const DRY_RUN = true;            // <-- flip to false to actually migrate
  if (!game.user.isGM) return ui.notifications.error("Migration must be run by a GM.");

  const REGIONS = [
    { key: "r1", name: "The Iron Reaches" },
    { key: "r2", name: "The Northern Marches" },
    { key: "r3", name: "The Saltwake Coast" },
    { key: "r4", name: "The River Heart" },
    { key: "r5", name: "The Drowned South" },
  ];
  const REGION_KEYS = new Set(REGIONS.map(r => r.key));

  // ---- 1) Locate master scene (exclude hub + already-migrated region scenes) ----
  const isHex = (d) => d.flags?.[MOD_TERR] && Object.keys(d.flags[MOD_TERR]).length > 0;
  const countHexes = (s) => s.drawings.filter(isHex).length;
  const cands = game.scenes
    .filter(s => !s.getFlag(SCOPE, "isWorldHub") && !s.getFlag(SCOPE, "regionDetail"))
    .map(s => ({ s, n: countHexes(s) })).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
  const master = cands.find(x => /bad\s*eden/i.test(x.s.name))?.s || cands[0]?.s;
  if (!master) return ui.notifications.error("No un-migrated master hex scene found (already migrated?).");

  // ---- 2) Validate every hex has a regionKey (run 2.1 first) ----
  const hexes = master.drawings.filter(isHex);
  const unassigned = hexes.filter(d => !REGION_KEYS.has(d.flags?.[SCOPE]?.regionKey));
  if (unassigned.length) {
    return ui.notifications.error(`${unassigned.length} hex(es) have no regionKey — run the 2.1 assignment macro first.`);
  }
  const hub = game.scenes.find(s => s.getFlag(SCOPE, "isWorldHub")) || null;

  // group hexes by region
  const byRegion = Object.fromEntries(REGIONS.map(r => [r.key, []]));
  hexes.forEach(d => byRegion[d.flags[SCOPE].regionKey].push(d));

  // ---- 3) DRY RUN: report + preview which references would need repair ----
  const REPORT = [`<b>World Overview migration ${DRY_RUN ? "(DRY RUN — no changes)" : "(LIVE)"}</b>`,
    `<div>Master: <b>${foundry.utils.escapeHTML(master.name)}</b> (${hexes.length} hexes) → 5 region scenes</div>`];
  for (const r of REGIONS) REPORT.push(`<div>${r.name} <code>${r.key}</code>: ${byRegion[r.key].length} hexes</div>`);

  // Preview: how many holders currently reference a master-scene hex UUID?
  const oldUuids = new Set(hexes.map(d => d.uuid));
  const matchesOld = (val) => typeof val === "string" && oldUuids.has(val);
  const scanCount = (flags) => {
    let n = 0; const walk = (o) => { for (const k in o) { const v = o[k]; if (matchesOld(v)) n++; else if (v && typeof v === "object") walk(v); } }; walk(flags || {}); return n;
  };
  let gateRefs = 0, siegeRefs = 0, facilityRefs = 0;
  for (const d of hexes) {
    const t = d.flags?.[MOD_TERR] || {};
    if (matchesOld(t.leylines?.gate?.linkHexUuid)) gateRefs++;
    if (matchesOld(t.siege?.supplyOriginHexId)) siegeRefs++;
  }
  for (const a of game.actors) facilityRefs += scanCount(a.flags);
  REPORT.push(`<div style="margin-top:.3rem;">Refs to remap — ley-gates: <b>${gateRefs}</b>, siege origins: <b>${siegeRefs}</b>, actor-side (facility etc.): <b>${facilityRefs}</b></div>`);
  if (!hub) REPORT.push(`<div style="color:#e8b35a;">No overview hub scene found — back buttons won't link until you run the overview setup macro.</div>`);

  if (DRY_RUN) {
    REPORT.push(`<div style="margin-top:.4rem; color:#8fd;">DRY RUN complete — nothing changed. Set <code>DRY_RUN = false</code> and re-run to execute.</div>`);
    ChatMessage.create({ content: REPORT.join(""), whisper: [game.user.id] });
    return ui.notifications.info("Migration DRY RUN done — see chat.");
  }

  // ---- 4) LIVE: create region scenes (idempotent) ----
  const sceneTemplate = (name) => ({
    name,
    width: master.width, height: master.height, padding: master.padding ?? 0.25,
    background: foundry.utils.deepClone(master.background ?? { src: null }),
    backgroundColor: master.backgroundColor ?? null,
    grid: foundry.utils.deepClone(master.grid ?? { type: 0, size: 100 }),
    initial: foundry.utils.deepClone(master.initial ?? null),
    tokenVision: master.tokenVision ?? true,
    flags: { [SCOPE]: { regionDetail: null, hubSceneUuid: hub?.uuid ?? null } }
  });
  const regionScene = {};
  for (const r of REGIONS) {
    let sc = game.scenes.find(s => s.getFlag(SCOPE, "regionDetail") === r.key);
    if (!sc) {
      const data = sceneTemplate(`Bad Eden — ${r.name}`);
      data.flags[SCOPE].regionDetail = r.key;
      [sc] = await Scene.createDocuments([data]);
    } else {
      await sc.update({ [`flags.${SCOPE}.hubSceneUuid`]: hub?.uuid ?? null });
    }
    regionScene[r.key] = sc;
  }

  // ---- 5) Move hexes (create on region w/ keepId, then delete from master) + build remap ----
  const remap = {};
  for (const r of REGIONS) {
    const list = byRegion[r.key];
    if (!list.length) continue;
    const sc = regionScene[r.key];
    const payload = list.map(d => {
      const obj = d.toObject();                       // full data incl. flags
      foundry.utils.setProperty(obj, `flags.${SCOPE}.originSceneUuid`, master.uuid);
      return obj;                                      // keeps _id
    });
    await sc.createEmbeddedDocuments("Drawing", payload, { keepId: true });
    for (const d of list) remap[d.uuid] = `Scene.${sc.id}.Drawing.${d.id}`;
  }
  // delete originals from master only after all creates succeeded
  await master.deleteEmbeddedDocuments("Drawing", hexes.map(d => d.id));

  // ---- 6) Repair persisted FULL-UUID refs via exact-string deep replace ----
  const deepReplace = (obj) => {
    let changed = false;
    const walk = (o) => { for (const k in o) { const v = o[k]; if (typeof v === "string" && remap[v]) { o[k] = remap[v]; changed = true; } else if (v && typeof v === "object") walk(v); } };
    walk(obj); return changed;
  };
  let fixedHexes = 0, fixedActors = 0;
  for (const r of REGIONS) {
    const sc = regionScene[r.key];
    const ups = [];
    for (const d of sc.drawings.filter(isHex)) {
      const fl = foundry.utils.deepClone(d.flags);
      if (deepReplace(fl)) { ups.push({ _id: d.id, flags: fl }); fixedHexes++; }
    }
    if (ups.length) await sc.updateEmbeddedDocuments("Drawing", ups);
  }
  for (const a of game.actors) {
    const fl = foundry.utils.deepClone(a.flags);
    if (deepReplace(fl)) { await a.update({ flags: fl }); fixedActors++; }
  }

  REPORT.push(`<div style="margin-top:.4rem; color:#8fd;">LIVE migration complete. Moved ${hexes.length} hexes; repaired ${fixedHexes} hex ref(s), ${fixedActors} actor(s). Master "${foundry.utils.escapeHTML(master.name)}" retained (now empty) — delete it once validated.</div>`);
  REPORT.push(`<div style="color:#888;">Next: validate (resolveRemoteAdjacency on gate hexes, travel within a region), then run the overview setup to draw the 5 region links.</div>`);
  ChatMessage.create({ content: REPORT.join(""), whisper: [game.user.id] });
  ui.notifications.info(`Migration complete — ${hexes.length} hexes across 5 scenes. See chat.`);
  console.log("[bbttcc] migration done", { moved: hexes.length, remap: Object.keys(remap).length, fixedHexes, fixedActors });
})();

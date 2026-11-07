/*
 * patch-reliable-levels-2026-11-07.macro.js — Dave: the Reliable is one battlemap with two levels, Engine Room at the bottom and Living Quarters above, joined by a stairs region.
 * The host is the living quarters scene (hM1o5Wlfw5PrztCU), so its tokens, level id and elevation stay put. The engine room's art, walls and light come over from bi4IZQVrL3Ltuqd2,
 * which loses its Reliable flag and is left for Dave to delete. Token vision stays on. Stairs sit on open floor on both decks (neither map draws any).
 * Buttons read Engine Room and Living Quarters. Needs beat.sceneLevel in bbttcc-campaign module.js.
 * Ember Bad Eden. globalThis.__reliableLevelsDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__reliableLevelsDry !== false, MOD = "bbttcc-campaign", report = { DRY_RUN, text: [] };
  const HOST = "hM1o5Wlfw5PrztCU", OLD = "bi4IZQVrL3Ltuqd2", UP = "defaultLevel0000", DOWN = "reliableEngineRm";
  const host = game.scenes.get(HOST), old = game.scenes.get(OLD);
  if (!host) throw new Error("host scene not found");
  const note = t => report.text.push(t);

  if (host.levels.get(UP)?.name !== "Living Quarters") { note("name Living Quarters"); if (!DRY_RUN) await host.updateEmbeddedDocuments("Level", [{ _id: UP, name: "Living Quarters", sort: 100000 }]); }
  if (!host.levels.get(DOWN)) {
    if (!old) throw new Error("engine room scene not found");
    const src = old.initialLevel.toObject();
    note("create Engine Room level");
    if (!DRY_RUN) await host.createEmbeddedDocuments("Level", [{ ...src, _id: DOWN, name: "Engine Room", elevation: { bottom: -10, top: 0 }, visibility: { levels: [] }, sort: 0 }], { keepId: true });
  }
  if (host.toObject().initialLevel !== UP) { note("initial level = Living Quarters"); if (!DRY_RUN) await host.update({ initialLevel: UP }); }

  const hasDown = coll => coll.contents.some(d => d.levels.has(DOWN));
  const stamp = async (name, coll) => {
    const ups = coll.contents.filter(d => !d.levels.size).map(d => ({ _id: d.id, levels: [UP] }));
    if (ups.length) { note(`${ups.length} ${name} -> Living Quarters`); if (!DRY_RUN) await host.updateEmbeddedDocuments(name, ups); }
  };
  if (!hasDown(host.walls) && old) {
    const ws = old.walls.contents.map(w => { const o = w.toObject(); delete o._id; o.levels = [DOWN]; return o; });
    await stamp("Wall", host.walls);
    note(`${ws.length} walls -> Engine Room`); if (!DRY_RUN) await host.createEmbeddedDocuments("Wall", ws);
  }
  if (!hasDown(host.lights) && old) {
    const ls = old.lights.contents.map(l => { const o = l.toObject(); delete o._id; o.levels = [DOWN]; o.elevation = -10; return o; });
    await stamp("AmbientLight", host.lights);
    note(`${ls.length} lights -> Engine Room`); if (!DRY_RUN) await host.createEmbeddedDocuments("AmbientLight", ls);
  }
  if (!host.regions.contents.some(r => r.getFlag(MOD, "reliableStairs"))) {
    note("create Stairs region");
    if (!DRY_RUN) await host.createEmbeddedDocuments("Region", [{
      name: "Stairs", color: "#7fd14a", levels: [UP, DOWN], visibility: CONST.REGION_VISIBILITY.ALWAYS, highlightMode: "coverage",
      shapes: [{ type: "rectangle", x: 1350, y: 1200, width: 150, height: 150, rotation: 0, hole: false }],
      behaviors: [{ name: "Stairs", type: "changeLevel", system: { movementActions: [] } }],
      flags: { [MOD]: { reliableStairs: true } }
    }]);
  }
  if (old?.getFlag(MOD, "reliableScene")) { note("unflag old engine room scene"); if (!DRY_RUN) await old.unsetFlag(MOD, "reliableScene"); }

  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id), beats = foundry.utils.deepClone(c.beats);
  const place = { reliable_aboard: UP, reliable_galley: UP, reliable_bunks: UP, reliable_the_lease: UP, reliable_lease_home: UP, reliable_lease_terms: UP, rc_gearbox_coffee: UP, ag_first_signature: UP, ag_days_end: UP, reliable_helm: DOWN };
  let changed = false;
  for (const [bid, lvl] of Object.entries(place)) {
    const b = beats.find(x => x.id === bid); if (!b) continue;
    if (b.sceneId !== HOST || b.sceneLevel !== lvl) { b.sceneId = HOST; b.sceneLevel = lvl; changed = true; note(`${bid} -> ${lvl}`); }
  }
  const hub = beats.find(b => b.id === "reliable_aboard"), low = beats.find(b => b.id === "reliable_helm");
  const door = hub?.choices?.find(x => x.next === "reliable_helm"), back = low?.choices?.find(x => x.next === "reliable_aboard");
  if (!door || !back) throw new Error("Reliable buttons not found");
  if (door.label !== "Engine Room") { door.label = "Engine Room"; changed = true; note("hub button = Engine Room"); }
  if (back.label !== "Living Quarters") { back.label = "Living Quarters"; changed = true; note("way back = Living Quarters"); }
  if (!DRY_RUN && changed) await C.saveCampaign(id, { ...c, beats });
  console.log("RELIABLELEVELS " + JSON.stringify(report));
})();

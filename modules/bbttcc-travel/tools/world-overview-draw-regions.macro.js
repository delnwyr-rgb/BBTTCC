/* Bad Eden — World Overview · 2.3 DRAW REGION LINKS (run as GM macro IN-WORLD)
 *
 * Replaces the single spike region on the overview hub with FIVE clickable region
 * shapes — one per migrated region scene. Each is auto-placed by scaling its real
 * hex footprint onto the overview art, then you drag/reshape it onto the matching
 * drawn feature. The world-overview controller already dives on any drawing carrying
 * flags[bbttcc-travel].regionLink, so these are live the moment they're created.
 *
 * Idempotent: re-run to rebuild all five (it clears prior regionLink drawings first).
 * Run AFTER the 2.2 migration (needs the region detail scenes to exist).
 */
(async () => {
  const SCOPE = "bbttcc-travel";
  const MOD_TERR = "bbttcc-territory";
  if (!game.user.isGM) return ui.notifications.error("Run as GM.");

  const REGIONS = [
    { key: "r1", name: "The Iron Reaches",     fill: "#9c7b4d", stroke: "#e8cfa0" },
    { key: "r2", name: "The Northern Marches", fill: "#c9a23a", stroke: "#f3e0a0" },
    { key: "r3", name: "The Saltwake Coast",   fill: "#3aa0c9", stroke: "#bfe8f3" },
    { key: "r4", name: "The River Heart",      fill: "#4bbf6a", stroke: "#c8f3d4" },
    { key: "r5", name: "The Drowned South",    fill: "#3a5ec9", stroke: "#bfc8f3" },
  ];
  const HEX_W = 87, HEX_H = 100; // hex extent so boxes cover footprints, not just top-lefts
  const SHOW_BOXES = false;      // false = invisible hit-boxes, names only (use the visibility
                                 // toggle macro / set true here when you want to reposition)

  const hub = game.scenes.find(s => s.getFlag(SCOPE, "isWorldHub"));
  if (!hub) return ui.notifications.error("No overview hub scene — run the overview setup macro first.");

  const isHex = (d) => d.flags?.[MOD_TERR] && Object.keys(d.flags[MOD_TERR]).length > 0;

  // Master coordinate space = a region scene's dims (they were cloned from the master).
  let srcW = 0, srcH = 0;
  const built = [];
  for (const r of REGIONS) {
    const sc = game.scenes.find(s => s.getFlag(SCOPE, "regionDetail") === r.key);
    if (!sc) { console.warn(`[bbttcc] region scene missing for ${r.key}`); continue; }
    srcW = srcW || sc.width; srcH = srcH || sc.height;
    const hx = sc.drawings.filter(isHex);
    if (!hx.length) { console.warn(`[bbttcc] ${r.key} scene has no hexes`); continue; }
    const xs = hx.map(d => Number(d.x) || 0), ys = hx.map(d => Number(d.y) || 0);
    built.push({ ...r, sc,
      minX: Math.min(...xs), maxX: Math.max(...xs) + HEX_W,
      minY: Math.min(...ys), maxY: Math.max(...ys) + HEX_H });
  }
  if (!built.length) return ui.notifications.error("No region scenes with hexes found — run the migration first.");

  const sX = hub.width / (srcW || hub.width);
  const sY = hub.height / (srcH || hub.height);
  const INSET = 0.06; // shrink each box slightly so neighbours don't fully overlap

  // Clear any prior regionLink drawings (spike region + earlier runs).
  const old = hub.drawings.filter(d => d.flags?.[SCOPE]?.regionLink).map(d => d.id);
  if (old.length) await hub.deleteEmbeddedDocuments("Drawing", old);

  const payload = built.map(b => {
    let x = b.minX * sX, y = b.minY * sY;
    let w = (b.maxX - b.minX) * sX, h = (b.maxY - b.minY) * sY;
    x += w * INSET; y += h * INSET; w *= (1 - 2 * INSET); h *= (1 - 2 * INSET);
    return {
      author: game.user.id,
      x: Math.round(x), y: Math.round(y),
      shape: { type: CONST.DRAWING_TYPES?.RECTANGLE ?? "r", width: Math.round(w), height: Math.round(h) },
      fillType: CONST.DRAWING_FILL_TYPES.SOLID, fillColor: b.fill, fillAlpha: SHOW_BOXES ? 0.22 : 0,
      strokeWidth: 6, strokeColor: b.stroke, strokeAlpha: SHOW_BOXES ? 0.9 : 0,
      text: b.name, textColor: "#ffffff", fontSize: Math.max(48, Math.round(hub.height * 0.028)),
      flags: { [SCOPE]: { regionLink: { targetSceneUuid: b.sc.uuid, label: b.name } } }
    };
  });
  await hub.createEmbeddedDocuments("Drawing", payload);

  const rows = built.map(b => `<div>${b.name} <code>${b.key}</code> → ${foundry.utils.escapeHTML(b.sc.name)}</div>`).join("");
  ChatMessage.create({ content:
    `<b>Overview region links drawn (${built.length}).</b>${rows}` +
    `<div style="margin-top:.4rem; color:#888;">Open "${foundry.utils.escapeHTML(hub.name)}" and drag/reshape each box onto its matching feature on the map. Click one to dive in.</div>`,
    whisper: [game.user.id] });
  ui.notifications.info(`Drew ${built.length} region links on the overview — drag them onto the art, then click to dive.`);
})();

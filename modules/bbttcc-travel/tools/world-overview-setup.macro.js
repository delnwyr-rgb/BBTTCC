/* Bad Eden — World Overview SETUP (spike v0.1)  — run as a GM macro IN-WORLD
 *
 * Idempotent. Creates (or reuses) a low-drawing "World Overview" hub scene that
 * reuses your Bad Eden map's background art, drops ONE clickable region polygon on
 * it linked to the real Bad Eden hex scene, and wires the back-link both ways.
 *
 * After running: open the new "Bad Eden — World Overview" scene and click the region.
 * It should zoom-dive + flash and land on your real Bad Eden map (travel works there
 * unchanged). A "⬅ World Map" button appears on the Bad Eden scene to return.
 *
 * Re-run anytime — it reuses the hub scene and re-stamps the single spike region.
 * Nothing on your Bad Eden map is modified except one back-link flag.
 */
(async () => {
  const SCOPE = "bbttcc-travel";
  const MOD_TERR = "bbttcc-territory";
  if (!game.user.isGM) return ui.notifications.error("World Overview setup must be run by a GM.");

  // Pretty world-map art for the overview background (Data-relative path).
  // Set to "" to fall back to the detail map's background, then its thumbnail.
  const BACKGROUND_SRC = "art/bbttcc/GOTTGAIT/GOTTGAIT Scene files/bad_eden_hand_drawn_map_items_full_colorv3.png";

  // 1) Find the Bad Eden DETAIL scene = most territory-flagged drawings (prefer name match).
  const countHexes = (s) =>
    s.drawings.filter(d => d.flags?.[MOD_TERR] && Object.keys(d.flags[MOD_TERR]).length > 0).length;

  const candidates = game.scenes
    .filter(s => !s.getFlag(SCOPE, "isWorldHub"))
    .map(s => ({ s, hexes: countHexes(s) }))
    .filter(x => x.hexes > 0)
    .sort((a, b) => b.hexes - a.hexes);

  let detail =
    candidates.find(x => /bad\s*eden/i.test(x.s.name))?.s ||
    candidates[0]?.s;

  if (!detail) {
    return ui.notifications.error(
      "World Overview: couldn't find a scene with territory hexes. Open your Bad Eden map once, then re-run."
    );
  }
  const detailHexCount = countHexes(detail);

  // Foundry stores asset paths with spaces URL-encoded ("GOTTGAIT%20Scene%20files").
  // A raw-space path makes loadTexture() throw and the background renders blank — so
  // encode each path segment (slashes preserved). Already-stored srcs are left as-is.
  const encodePath = (p) => !p ? p : String(p).split("/").map(s => encodeURIComponent(s)).join("/");

  // Background source priority: bespoke world-map art → detail map's own art →
  // the detail scene's rendered THUMBNAIL (last resort so it's never black).
  let bgSrc = (BACKGROUND_SRC ? encodePath(BACKGROUND_SRC) : null)
    || detail.background?.src || detail.thumb || null;
  let usingArt = !!BACKGROUND_SRC;

  // Size the hub scene to the background image's native resolution (auto-detected),
  // so the pretty map isn't stretched. A load failure here must NOT blank the
  // background — we only fall back on the *dimensions*.
  let hubW = detail.width, hubH = detail.height;
  if (bgSrc) {
    try {
      const tex = await loadTexture(bgSrc);
      if (tex?.width && tex?.height) { hubW = tex.width; hubH = tex.height; }
      else console.warn("[bbttcc] World Overview: texture had no dimensions; using fallback size.");
    } catch (e) {
      console.warn("[bbttcc] World Overview: couldn't measure background; keeping it, using fallback size.", e);
    }
  }

  // 2) Find or create the OVERVIEW (hub) scene.
  let hub = game.scenes.find(s => s.getFlag(SCOPE, "isWorldHub"));
  if (!hub) {
    const [created] = await Scene.createDocuments([{
      name: "Bad Eden — World Overview",
      width: hubW,
      height: hubH,
      padding: detail.padding ?? 0.25,
      background: { src: bgSrc },
      backgroundColor: detail.backgroundColor ?? "#1a1a22",
      grid: { type: CONST.GRID_TYPES.GRIDLESS, size: Math.max(50, detail.grid?.size ?? 100) },
      initial: null,
      flags: { [SCOPE]: { isWorldHub: true } }
    }]);
    hub = created;
  } else {
    // keep art/size in sync on re-run
    await hub.update({
      width: hubW, height: hubH, padding: detail.padding ?? 0.25,
      background: { src: bgSrc }
    });
  }

  // 3) Cross-link the detail scene back to the hub.
  await detail.setFlag(SCOPE, "hubSceneUuid", hub.uuid);

  // 4) Clear any prior spike region(s), then drop ONE region covering the middle ~60%.
  const oldRegions = hub.drawings.filter(d => d.flags?.[SCOPE]?.regionLink).map(d => d.id);
  if (oldRegions.length) await hub.deleteEmbeddedDocuments("Drawing", oldRegions);

  const w = hub.width, h = hub.height;
  const rw = Math.round(w * 0.6), rh = Math.round(h * 0.6);
  const rx = Math.round((w - rw) / 2), ry = Math.round((h - rh) / 2);

  await hub.createEmbeddedDocuments("Drawing", [{
    author: game.user.id,
    x: rx, y: ry,
    shape: { type: CONST.DRAWING_TYPES?.RECTANGLE ?? "r", width: rw, height: rh },
    fillType: CONST.DRAWING_FILL_TYPES.SOLID, fillColor: "#3aa0ff", fillAlpha: 0.22,
    strokeWidth: 6, strokeColor: "#bfe3ff", strokeAlpha: 0.9,
    text: "▶ Bad Eden", textColor: "#ffffff", fontSize: Math.max(48, Math.round(h * 0.03)),
    flags: { [SCOPE]: { regionLink: { targetSceneUuid: detail.uuid, label: detail.name } } }
  }]);

  // 5) Report.
  const msg = [
    `<b>World Overview spike ready.</b>`,
    `<ul style="margin:.25rem 0 0 1rem; padding:0;">`,
    `<li>Hub scene: <b>${foundry.utils.escapeHTML(hub.name)}</b> @ ${hubW}×${hubH} (${usingArt ? "bespoke world-map art" : (bgSrc ? "map thumbnail" : "NO art")}, 1 region drawing)</li>`,
    `<li>Detail scene: <b>${foundry.utils.escapeHTML(detail.name)}</b> (${detailHexCount} hexes, unchanged)</li>`,
    `</ul>`,
    `<div style="margin-top:.4rem;">Open <b>${foundry.utils.escapeHTML(hub.name)}</b> and click the blue region to dive in.`,
    ` Use <b>⬅ World Map</b> on the Bad Eden scene to return.</div>`,
    `<div style="margin-top:.3rem; color:#888;">Tip: the hub copied Bad Eden's background — swap it for a prettier "world" image anytime via Scene config.</div>`
  ].join("");
  ChatMessage.create({ content: msg, whisper: [game.user.id] });
  ui.notifications.info(`World Overview ready — open "${hub.name}" and click the region.`);
  console.log("[bbttcc] World Overview setup:", { hub: hub.uuid, detail: detail.uuid, detailHexCount });
})();

/**
 * play-once-tiles.js — PLAY-ONCE VIDEO TILES (2026-10-25, the opening-titles slides).
 *
 * A video Tile with `video.loop:false, autoplay:true` is a "slide": it should play from its FIRST frame the
 * moment a client lands on the scene, run once, and freeze on its last frame until the GM forwards the beat.
 * Foundry gets the "once" and the "freeze" right on its own, but not the "from the first frame": the texture
 * loader starts the <video> as soon as the texture loads (scene activation / preload / the dive transition),
 * and Tile#_refreshVideo then resumes from wherever `currentTime` already is (VideoHelper.play: offset ??=
 * currentTime). Live-caught 2026-10-25: segment 3 (8.9 s) was first SEEN at 6.1 s — the table got the tail.
 *
 * Fix: on every canvasReady, each client rewinds its own play-once tiles to 0 and plays them. Per client, so
 * a player arriving late still sees the whole slide; re-viewing the scene later simply replays it.
 * Imported by module.js (no manifest change). Setting-free; a tile opts in by its own playback flags.
 */

const TAG = "[bbttcc-campaign:play-once]";

function _isPlayOnce(tile) {
  const v = tile?.document?.video;
  return !!(v && v.loop === false && v.autoplay === true);
}

async function _restartPlayOnceTiles() {
  try {
    const tiles = canvas?.tiles?.placeables ?? [];
    for (const t of tiles) {
      if (!_isPlayOnce(t) || !t.texture) continue;
      const video = game.video?.getVideoSource?.(t.texture);
      if (!video) continue;
      const vol = Number(t.document.video.volume ?? 0);
      // Wait for metadata so currentTime/duration are meaningful, then rewind + play once.
      if (!(video.readyState >= 1)) await new Promise(res => { const done = () => { video.removeEventListener("loadedmetadata", done); res(); }; video.addEventListener("loadedmetadata", done); setTimeout(done, 3000); });
      try { video.pause(); } catch (_e) {}
      try { video.currentTime = 0; } catch (_e) {}
      await game.video.play(video, { playing: true, loop: false, offset: 0, volume: vol });
    }
  } catch (e) { console.warn(TAG, "restart failed", e); }
}

// Exposed for macros / the beat runner (e.g. replay the current slide): game.bbttcc.api.campaign.playOnceTiles.restart()
// The campaign API is installed late in `ready`, after this module's own once-handler — so attach lazily, on
// every canvasReady until it sticks (idempotent).
function _installApi() {
  try {
    const api = globalThis.game?.bbttcc?.api?.campaign;
    if (api && !api.playOnceTiles) api.playOnceTiles = { restart: _restartPlayOnceTiles, isPlayOnce: _isPlayOnce };
  } catch (_e) {}
}
Hooks.on("canvasReady", () => { _installApi(); _restartPlayOnceTiles(); });
Hooks.once("ready", _installApi);

export { _restartPlayOnceTiles as restartPlayOnceTiles, _isPlayOnce as isPlayOnceTile };

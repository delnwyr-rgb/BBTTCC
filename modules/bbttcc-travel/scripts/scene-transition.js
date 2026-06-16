/* Bad Eden — Scene Transition primitive (reusable "dive into a thing")
 *
 * The cinematic "move into X → zoom-dive + flash → land inside X's scene" move,
 * extracted from the World Overview hub into a general API so ANY system can
 * reuse it: travel→hex, enter-a-settlement, breach-a-structure, descend-a-dungeon…
 *
 *   game.bbttcc.api.transition.dive(targetSceneUuid, {
 *     focus,        // {x,y} scene point to zoom toward on the current canvas
 *     flashColor,   // CSS color for the flash (default blue)
 *     hexUuid,      // optional: play a Sequencer portal swirl on this hex (fx-api)
 *     audience,     // "view" (GM-solo, non-destructive · default) | "activate" (pull table)
 *     label         // human label (notifications)
 *   })
 *   game.bbttcc.api.transition.back(targetSceneUuid, { label, flashColor })
 *
 * Return wiring (data, set by callers/macros on the TARGET scene flags["bbttcc-travel"]):
 *   - returnLink: { targetSceneUuid, label }  → adds a "⬅ <label>" button that dives back
 *   - hexScene:   true                        → (GM, while non-active) adds a "⇪ Pull table here"
 *
 * NOTE: the World Overview hub keeps its own private copy of this transition for
 * now (it's validated + shipped). New callers use THIS primitive; the hub can be
 * migrated onto it later. Back/pull-table buttons here are gated on `returnLink`
 * (hex scenes) so they never collide with the hub's legacy `hubSceneUuid` button.
 */
(() => {
  const SCOPE = "bbttcc-travel";
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  // ---------- self-contained "rad" transition (mirrors world-overview spike) ----------
  function ensureShakeStyle() {
    if (document.getElementById("bbttcc-tx-style")) return;
    const s = document.createElement("style");
    s.id = "bbttcc-tx-style";
    s.textContent = `
      @keyframes bbttcc-tx-shake {
        0%,100%{transform:translate(0,0)} 20%{transform:translate(-4px,2px)}
        40%{transform:translate(4px,-2px)} 60%{transform:translate(-3px,-2px)}
        80%{transform:translate(3px,2px)}
      }
      .bbttcc-tx-shaking{ animation: bbttcc-tx-shake 240ms ease-in-out; }`;
    document.head.appendChild(s);
  }

  function flash(color = "#bfe3ff") {
    const el = document.createElement("div");
    el.style.cssText = `
      position:fixed; inset:0; z-index:99999; pointer-events:none; opacity:0;
      transition:opacity 170ms ease-out;
      background: radial-gradient(circle at center, ${color} 0%, rgba(255,255,255,0) 72%);`;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = "0.9";
      setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 420); }, 150);
    });
  }

  function shake() {
    ensureShakeStyle();
    const board = document.getElementById("board") || canvas?.app?.view;
    if (!board) return;
    board.classList.add("bbttcc-tx-shaking");
    setTimeout(() => board.classList.remove("bbttcc-tx-shaking"), 260);
  }

  // Best-effort Sequencer portal swirl on a hex (additive flourish over the flash).
  // fx-api gracefully no-ops when Sequencer/JB2A is absent or fx is gated — the CSS
  // flash is always the reliable baseline, so this can only ever add polish.
  // Curated portal/vortex candidates, most-on-theme first. We probe the installed
  // Sequencer DB and play the first that EXISTS — so it works whether the world has
  // free JB2A (portals are FREE content) or jb2a_patreon. The magic_signs.circle.*
  // keys are Patreon-only (why the first cut fell back to the red canvas-pulse ring).
  // If nothing resolves (or no Sequencer), we do nothing and the CSS flash carries it.
  // Preferred portal look = jb2a_patreon vortex (resolves only when that pack is
  // active). If none resolve, the engine's fallbackPath drops to the family magic
  // circle — which is GUARANTEED to fire here (the raid/siege VFX use exactly that
  // path on this v14 install).
  const PORTAL_KEYS = [
    "jb2a.portals.vertical.vortex.purple",
    "jb2a.portals.horizontal.vortex.purple",
    "jb2a.portals.vertical.vortex.red",
    "jb2a.portals.vertical.vortex.black",
    "jb2a.portals.vertical.ring.bright_yellow"  // free pack, if it's enabled
  ];

  // Ride the PROVEN engine worker (game.bbttcc.api.fx.playSequencerEffect) instead
  // of hand-rolling a Sequence — same call the raid/siege maneuvers land on, so it
  // tracks whatever Foundry/Sequencer change v14 introduced. Resolves an explicit
  // {x,y} (avoids v14 placeable-resolution quirks) and hands the engine a portal key
  // with a magic-circle fallbackPath.
  async function portalSwirl(hexUuid, ms = 2600) {
    try {
      const fx = game.bbttcc?.api?.fx;
      if (!fx?.playSequencerEffect || !hexUuid) {
        console.warn("[bbttcc portal] fx.playSequencerEffect unavailable → flash only.");
        return null;
      }
      const doc = await fromUuid(String(hexUuid));
      if (!doc) { console.warn("[bbttcc portal] hex/region doc not found:", hexUuid); return null; }
      const w = Number(doc.shape?.width || doc.width || 0);
      const h = Number(doc.shape?.height || doc.height || 0);
      const c = doc.object?.center;
      const pos = (c && Number.isFinite(c.x))
        ? { x: c.x, y: c.y }
        : { x: Number(doc.x || 0) + w / 2, y: Number(doc.y || 0) + h / 2 };

      const portal = PORTAL_KEYS.find(k => fx.keyExists?.(k));
      const fallback = fx.effectForFamily?.("temporal");
      const path = portal || fallback;
      const gs = Number(canvas?.grid?.size || 100);
      const size = Math.min(Math.max(gs * 4, Math.min(w || gs * 4, h || gs * 4)), gs * 8);

      console.log("[bbttcc portal] playSequencerEffect:", path, portal ? "(portal)" : "(magic-circle fallback)");
      return fx.playSequencerEffect(path, {
        target: pos,
        fallbackPath: fallback,
        accentPath: fx.burstForFamily?.("temporal"),
        accentDelay: 120,
        size, ms, fadeIn: 250, fadeOut: 700, zIndex: 1
      });
    } catch (e) { console.warn("[bbttcc portal] error:", e); return null; }
  }

  // One-shot dive request: a trigger (hex-entry beat / travel encounter) stashes a
  // dive directive here right before running a beat; the campaign beat executor
  // consumes it at its scene-activation seam and dives instead of plain-activating.
  // consume-once so a sceneless or chained beat can't replay a stale request.
  let _pendingDive = null;
  function requestDive(opts = {}) { _pendingDive = { ...opts, _ts: (game.time?.serverTime ?? 0) }; }
  function consumeDive() { const d = _pendingDive; _pendingDive = null; return d; }

  // Remembers the most recent GM-solo dive so the far side can offer "⬅ back" and
  // "⇪ pull table" even when the target scene carries no returnLink/hexScene flags
  // (e.g. an encounter/beat scene reached via requestDive).
  let _lastDive = null;

  let _busy = false;
  async function dive(targetSceneUuid, opts = {}) {
    const { focus, flashColor = "#bfe3ff", hexUuid = null, audience = "view", label,
            originUuid = canvas?.scene?.uuid || null, portalLeadMs = 850 } = opts;
    if (_busy) return false;
    let scene;
    try { scene = await fromUuid(targetSceneUuid); } catch (e) { scene = null; }
    if (!(scene instanceof Scene)) {
      ui.notifications?.warn(`Scene transition: target scene not found${label ? ` for "${label}"` : ""}.`);
      return false;
    }
    _busy = true;
    try {
      // 0) Kick off asset preload ASAP (concurrent with the zoom) so the target
      //    background — especially a VIDEO bg — is decoded + cached before we land.
      //    Without it you see the scene's loading placeholder (the "bezeled circle")
      //    flash in before the art paints. preload() returns a Promise in v12+.
      const preloading = Promise.resolve(
        (() => { try { return game.scenes?.preload?.(scene.id); } catch (e) { return null; } })()
      ).catch(() => {});

      // 1) PORTAL FIRST — open the swirl on the current scene's hex/region and let
      //    it spin up BEFORE the camera commits. Reads as "a portal opens, then we
      //    fall through it", and buys the target bg (video!) time to finish loading.
      portalSwirl(hexUuid);     // fire-and-forget; plays on the CURRENT scene
      shake();                  // little ignition jolt as it ignites
      if (hexUuid) await wait(portalLeadMs);  // let the circle establish (only if a portal)

      // 2) zoom-dive toward the focus — now we fall through the open portal
      if (focus && canvas?.animatePan) {
        const maxZoom = (CONFIG?.Canvas?.maxZoom ?? 3);
        const target = Math.min(maxZoom, (canvas.stage.scale.x || 1) * 2.4);
        await canvas.animatePan({ x: focus.x, y: focus.y, scale: target, duration: 680 });
      }
      // 3) flash at the moment of passage
      flash(flashColor);
      await wait(180);
      // 4) make sure the preload has settled (bounded) before swapping, so the new
      //    bg is ready under the flash. Cap so a slow/huge asset can't hang the dive.
      await Promise.race([preloading, wait(1200)]);
      // 5) land. activate() pulls the whole table; view() is per-user/non-destructive.
      if (audience === "activate" && game.user.isGM) {
        await scene.activate();
        _lastDive = null;
      } else {
        await scene.view();
        // Remember this solo dive so the far side gets back/pull-table affordances.
        _lastDive = { targetId: scene.id, originUuid, label: label || scene.name };
      }
      await wait(120);
      flash(flashColor);
      return true;
    } catch (err) {
      console.error("[bbttcc transition] dive failed:", err);
      ui.notifications?.error?.(`Scene transition error: ${err?.message ?? err}`);
      return false;
    } finally {
      _busy = false;
    }
  }

  async function back(targetSceneUuid, opts = {}) {
    const { flashColor = "#d8c8ff" } = opts;
    let scene;
    try { scene = await fromUuid(targetSceneUuid); } catch (e) { scene = null; }
    if (!(scene instanceof Scene)) {
      ui.notifications?.warn("Scene transition: return scene not found.");
      return false;
    }
    if (_busy) return false;
    _busy = true;
    try {
      if (canvas?.animatePan) {
        const target = Math.max((CONFIG?.Canvas?.minZoom ?? 0.1), (canvas.stage.scale.x || 1) * 0.5);
        await canvas.animatePan({ scale: target, duration: 520 });
      }
      shake();
      flash(flashColor);
      await wait(200);
      await scene.view();
      return true;
    } finally {
      _busy = false;
    }
  }

  // ---------- return + pull-table buttons (driven by target-scene flags) ----------
  const tx = () => game.bbttcc?.api?.transition;
  function removeBackButton() { document.getElementById("bbttcc-scene-back")?.remove(); }
  function removePullTable()  { document.getElementById("bbttcc-scene-pull")?.remove(); }

  function addBackButton(targetUuid, label) {
    removeBackButton();
    const btn = document.createElement("div");
    btn.id = "bbttcc-scene-back";
    btn.style.cssText = `
      position:absolute; top:6px; right:320px; z-index:200;
      background:rgba(20,20,20,.9); color:#fff; padding:6px 10px; border-radius:8px;
      cursor:pointer; font:12px Helvetica; box-shadow:0 0 6px rgba(0,0,0,.35);`;
    btn.textContent = `⬅ ${label || "Back"}`;
    btn.title = `Return to ${label || "the previous scene"}`;
    btn.onclick = () => tx()?.back(targetUuid, { label });
    document.body.appendChild(btn);
  }

  function addPullTable(scene) {
    removePullTable();
    const btn = document.createElement("div");
    btn.id = "bbttcc-scene-pull";
    btn.style.cssText = `
      position:absolute; top:6px; right:470px; z-index:200;
      background:rgba(40,28,12,.92); color:#ffe6b0; padding:6px 10px; border-radius:8px;
      cursor:pointer; font:12px Helvetica; box-shadow:0 0 6px rgba(0,0,0,.35);`;
    btn.textContent = "⇪ Pull table here";
    btn.title = "Activate this scene for every connected player";
    btn.onclick = async () => { try { await scene.activate(); } catch (e) {} removePullTable(); };
    document.body.appendChild(btn);
  }

  function onCanvasReady() {
    removeBackButton();
    removePullTable();
    const sc = canvas?.scene;
    if (!sc) return;
    const f = sc.flags?.[SCOPE] || {};
    const dived = _lastDive && _lastDive.targetId === sc.id;  // we solo-dived into this scene

    // Back button: configured returnLink flag, else the scene we dived FROM.
    // (returnLink gating avoids doubling the hub's own legacy "World Map" button.)
    if (f.returnLink?.targetSceneUuid) addBackButton(f.returnLink.targetSceneUuid, f.returnLink.label);
    else if (dived && _lastDive.originUuid) addBackButton(_lastDive.originUuid, "Back");

    // Pull-table: GM, scene not yet activated, and it's either a flagged hex scene
    // or one we just dived into.
    if (game.user.isGM && game.scenes?.active?.id !== sc.id && (f.hexScene || dived)) addPullTable(sc);
  }

  Hooks.on("canvasReady", onCanvasReady);

  Hooks.once("ready", () => {
    game.bbttcc = game.bbttcc || { api: {} };
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.transition = { dive, back, flash, shake, portalSwirl, requestDive, consumeDive };
    console.log("[bbttcc] Scene Transition primitive ready (game.bbttcc.api.transition).");
  });
})();

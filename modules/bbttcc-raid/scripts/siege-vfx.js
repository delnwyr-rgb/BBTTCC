// bbttcc-raid/scripts/siege-vfx.js
// SIEGE_RAID_TYPE_SPEC.md §5 — Phase D.3: Catastrophic Entry VFX renderer.
//
// Mirrors raid-courtly.vfx.js. Subscribes on every client to the three socket-relayed
// siege beats:
//   bbttcc:siege:layerBreached { siegeId, hexUuid, layerIdx, layerName, nextLayerIdx }
//   bbttcc:siege:convene       { siegeId, hexUuid, layerIdx, sceneId }
//   bbttcc:siege:outcome       { siegeId, hexUuid, status }
//
// These hooks fire locally on the GM (breach engine / convene / tick) AND are relayed to
// other clients via the `siegeHook` socket branch (module.raid-console.js), which re-fires
// the hook locally — so the VFX plays on every connected client without double-firing
// (Foundry doesn't echo socket emits to the sender).

(() => {
  globalThis.__bbttcc_siege_vfx_loaded_v1 = Date.now();
  const TAG = "[bbttcc/siege-vfx]";

  const BRONZE = "#d9a441";
  const RED    = "#ff5555";
  const AMBER  = "#ffaa55";
  const GREEN  = "#88cc55";
  const BLUE   = "#88bbff";
  const VIOLET = "#a78bfa";
  const GRAY   = "#9a9a9a";

  // ─── Stylesheet (one-time) ─────────────────────────────────────────────────
  function _injectStylesOnce() {
    if (document.getElementById("ft-siege-vfx-styles")) return;
    const css = `
      @keyframes ftSiegePulse {
        0%   { box-shadow: 0 0 4px var(--ft-pulse-color, ${BRONZE}), 0 0 16px var(--ft-pulse-color, ${BRONZE}); transform: scale(1); }
        50%  { box-shadow: 0 0 18px var(--ft-pulse-color, ${BRONZE}), 0 0 36px var(--ft-pulse-color, ${BRONZE}); transform: scale(1.04); }
        100% { box-shadow: 0 0 4px var(--ft-pulse-color, ${BRONZE}), 0 0 16px var(--ft-pulse-color, ${BRONZE}); transform: scale(1); }
      }
      .ft-siege-pulse { animation: ftSiegePulse 600ms ease-out 2; }
      @keyframes ftSiegeShake {
        0%,100% { transform: translate(0,0); }
        20% { transform: translate(-6px, 3px); }
        40% { transform: translate(5px, -4px); }
        60% { transform: translate(-4px, -2px); }
        80% { transform: translate(3px, 4px); }
      }
      @keyframes ftSiegeFullFlash {
        0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; }
      }
      .ft-siege-fullflash {
        position: fixed; inset: 0; pointer-events: none; z-index: 9998;
        background: radial-gradient(circle at center, transparent 35%, var(--ft-flash-color, ${RED}) 98%);
        mix-blend-mode: screen; animation: ftSiegeFullFlash 1100ms ease-out forwards;
      }
      @keyframes ftSiegeBannerIn {
        0%   { transform: translate(-50%, -40px); opacity: 0; }
        18%  { transform: translate(-50%, 0); opacity: 1; }
        82%  { transform: translate(-50%, 0); opacity: 1; }
        100% { transform: translate(-50%, -20px); opacity: 0; }
      }
      .ft-siege-banner {
        position: fixed; top: 96px; left: 50%; transform: translate(-50%, 0);
        z-index: 10001; pointer-events: none;
        padding: .6rem 1.5rem; border-radius: 8px;
        background: rgba(22,19,12,0.95); backdrop-filter: blur(4px);
        font-family: 'Signika', sans-serif; font-size: 1.2rem; font-weight: 700;
        letter-spacing: .09em; text-transform: uppercase;
        box-shadow: 0 4px 24px rgba(0,0,0,0.6);
        animation: ftSiegeBannerIn 4500ms ease-out forwards;
      }
    `;
    const style = document.createElement("style");
    style.id = "ft-siege-vfx-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Renderers ──────────────────────────────────────────────────────────────
  function _pulse(el, color = BRONZE) {
    if (!el) return;
    el.style.setProperty("--ft-pulse-color", color);
    el.classList.remove("ft-siege-pulse");
    void el.offsetWidth;
    el.classList.add("ft-siege-pulse");
    setTimeout(() => el.classList.remove("ft-siege-pulse"), 1300);
  }

  function _fullScreenFlash(color = RED) {
    const el = document.createElement("div");
    el.className = "ft-siege-fullflash";
    el.style.setProperty("--ft-flash-color", color);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  function _banner(text, color = BRONZE) {
    const el = document.createElement("div");
    el.className = "ft-siege-banner";
    el.style.color = color;
    el.style.border = `1px solid ${color}`;
    el.style.boxShadow = `0 0 24px ${color}66, 0 4px 24px rgba(0,0,0,0.6)`;
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4700);
  }

  // Brief camera-ish shake on the canvas board element for the catastrophic moment.
  function _shakeBoard() {
    const board = document.getElementById("board");
    if (!board) return;
    board.style.animation = "ftSiegeShake 420ms ease-in-out";
    setTimeout(() => { try { board.style.animation = ""; } catch (_) {} }, 460);
  }

  function _hudPanel() { return document.getElementById("ft-siege-hud"); }

  // ─── Canvas projectile helpers (§6 — boulder bombardment) ────────────────────
  // Sequencer-direct (no spawned tokens, no actor/compendium): the boulder is a JB2A
  // ranged projectile stretched launch-point → wall, with an impact burst on landing.
  // GM plays once; Sequencer broadcasts to every client. Everything degrades to the
  // DOM banner + board shake when Sequencer/JB2A or a target are unavailable.
  function _sequencerReady() {
    try { return !!globalThis.Sequence && !!game.modules?.get?.("sequencer")?.active; }
    catch { return false; }
  }

  // The world-space centre of the current view (Foundry pans via stage.pivot).
  function _viewportCenter() {
    try {
      const p = canvas?.stage?.pivot;
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return { x: Number(p.x), y: Number(p.y) };
      const r = canvas?.dimensions?.sceneRect;
      if (r) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    } catch {}
    return null;
  }

  // Centre of the wall (Structure) actor's token on the current canvas, or null if it
  // isn't staged here (e.g. the GM is looking at a different scene).
  function _wallCenter(structureActorId) {
    try {
      if (!structureActorId || !canvas?.ready) return null;
      const actor = game.actors?.get?.(structureActorId);
      let tok = actor?.getActiveTokens?.()?.[0];
      if (!tok) tok = canvas.tokens?.placeables?.find(t => (t.actor?.id === structureActorId) || (t.document?.actorId === structureActorId));
      if (!tok) return null;
      const c = tok.center || { x: tok.x + (tok.w || 0) / 2, y: tok.y + (tok.h || 0) / 2 };
      return (Number.isFinite(c.x) && Number.isFinite(c.y)) ? { x: c.x, y: c.y } : null;
    } catch { return null; }
  }

  // Resolve the first JB2A key that actually exists: explicit candidates first, then a
  // database search (we don't hardcode-guess a path that would silently fall back).
  function _resolveJB2A(candidates = [], searchTerms = []) {
    try {
      const db = globalThis.Sequencer?.Database;
      if (!db) return null;
      for (const c of candidates) {
        try { if (typeof db.entryExists === "function" && db.entryExists(String(c))) return String(c); } catch {}
      }
      for (const term of searchTerms) {
        try {
          const hits = db.searchFor?.(String(term));
          const arr = Array.isArray(hits) ? hits : (hits ? Object.values(hits) : []);
          const pick = arr.find(p => typeof p === "string" && p.length);
          if (pick) return pick;
        } catch {}
      }
    } catch {}
    return null;
  }

  // Visual tuning — dial these to taste.
  const _BOULDER_SCALE  = 1.8;  // projectile sprite size multiplier (1.0 = native)
  const _IMPACT_SIZE_GS = 6.5;  // impact-burst diameter, in grid squares
  const _LAUNCH_DIST_GS = 13;   // launch origin distance "downstage" (toward camera), in grid squares
  // Hard cap on the launch arc in PIXELS. JB2A's longest ranged variant is ~4000px native;
  // stretching past it flips Sequencer into its TILING path (TilingSpriteMesh), which crashes
  // under Foundry v14 (SpriteMesh reads texture.defaultAnchor.x → undefined). A big-grid
  // diorama (gs 200+) blew 13 squares past that. Capping keeps every volley on the proven
  // plain-sprite path regardless of scene grid size. (2026-06-04)
  const _LAUNCH_MAX_PX  = 3000;

  // Asset families — the reusable vocabulary of "things a siege throws". Each is a JB2A
  // projectile + impact pair (resolved defensively at runtime: candidate keys first, then a
  // DB search, then graceful degrade). `boulder` reproduces the proven Bombard look exactly.
  // Projectile-less families (debris) play impact-only — for breach/collapse moments.
  const _FAMILIES = {
    boulder: { projKeys: ["jb2a.boulder.toss.01", "jb2a.boulder.toss", "jb2a.catapult.boulder"],          projSearch: ["boulder", "rolling_boulder", "catapult", "rock"], impactKeys: ["jb2a.explosion.01.orange", "jb2a.explosion.02.orange", "jb2a.eruption.orange.0", "jb2a.impact.ground_crack.orange.01"], impactSearch: ["explosion", "eruption", "ground_crack"], scale: _BOULDER_SCALE, impactSizeGs: _IMPACT_SIZE_GS },
    fire:    { projKeys: ["jb2a.flaming_boulder.throw.01", "jb2a.fire_bolt.orange", "jb2a.boulder.toss.01"], projSearch: ["flaming_boulder", "fire_bolt", "firebomb", "fireball"], impactKeys: ["jb2a.fireball.explosion.orange", "jb2a.explosion.01.orange", "jb2a.eruption.orange.0"], impactSearch: ["fireball", "explosion", "fire"], scale: 1.6, impactSizeGs: 6 },
    bolt:    { projKeys: ["jb2a.ballista.shot", "jb2a.spear.throw.01", "jb2a.arrow.physical.white.01"],     projSearch: ["ballista", "spear", "bolt", "arrow"], impactKeys: ["jb2a.impact.001.orange", "jb2a.explosion.01.orange"], impactSearch: ["impact", "explosion"], scale: 1.4, impactSizeGs: 3.5 },
    arrows:  { projKeys: ["jb2a.arrow.physical.white.01", "jb2a.arrow.physical"],                          projSearch: ["arrow"], impactKeys: ["jb2a.impact.ground_crack.white.01", "jb2a.impact.001"], impactSearch: ["impact", "ground_crack"], scale: 1.2, impactSizeGs: 2.5 },
    debris:  { projKeys: [],                                                                                projSearch: [], impactKeys: ["jb2a.explosion.08.orange", "jb2a.debris.bird", "jb2a.impact.ground_crack.orange.01"], impactSearch: ["debris", "ground_crack", "explosion"], scale: 1, impactSizeGs: 7 }
  };

  // GM-only: build + play a projectile volley. Sequencer broadcasts to all clients.
  // opts = { structureActorId, family, count, stagger, travel, scale, impactSizeGs,
  //          direction: "incoming" (camp→wall, default) | "outgoing" (wall→camp, counter-fire) }
  function _playProjectileVolley(opts = {}) {
    if (!_sequencerReady()) return false;
    const fam = _FAMILIES[opts.family] || _FAMILIES.boulder;
    const wall = _wallCenter(opts.structureActorId) || _viewportCenter();
    if (!wall) return false;
    const gs = Number(canvas?.grid?.size || 100);
    const count   = Math.max(1, Math.min(8, Number(opts.count) || 2));
    const stagger = Number(opts.stagger) || 260;
    const travel  = Number(opts.travel)  || 750;
    const scale   = Number(opts.scale)   || fam.scale || 1.4;
    const impSize = Number(opts.impactSizeGs) || fam.impactSizeGs || 5;
    const outgoing = opts.direction === "outgoing";       // wall → besieging line (counter-fire)
    const launch  = Math.min(gs * _LAUNCH_DIST_GS, _LAUNCH_MAX_PX);
    const camp    = { x: wall.x, y: wall.y + launch };     // downstage, toward the camera

    const projPath   = (fam.projKeys && fam.projKeys.length) ? _resolveJB2A(fam.projKeys, fam.projSearch) : null;
    const impactPath = _resolveJB2A(fam.impactKeys, fam.impactSearch);
    if (!projPath && !impactPath) return false;

    const seq = new globalThis.Sequence();
    for (let i = 0; i < count; i++) {
      const jx = (i - (count - 1) / 2) * gs * 1.6;         // spread the volley horizontally
      const wallPt = { x: wall.x + jx, y: wall.y };
      const campPt = { x: camp.x + jx, y: camp.y + Math.abs(jx) * 0.2 };
      const src = outgoing ? wallPt : campPt;
      const dst = outgoing ? campPt : wallPt;
      if (projPath) {
        try {
          seq.effect()
            .file(projPath)
            .atLocation(src)
            .stretchTo(dst)            // JB2A ranged asset arcs src → dst
            .scale(scale)
            .delay(i * stagger)
            .zIndex(3);
        } catch (e) { console.warn(TAG, "projectile effect skipped", e); }
      }
      if (impactPath) {
        try {
          seq.effect()
            .file(impactPath)
            .atLocation(dst)
            .size(gs * impSize)
            .delay((projPath ? travel : 0) + i * stagger)   // impact-only families land immediately
            .fadeOut(400)
            .zIndex(4);
        } catch (e) { console.warn(TAG, "impact effect skipped", e); }
      }
    }
    try { seq.play(); return true; } catch (e) { console.warn(TAG, "volley play failed", e); return false; }
  }

  // Back-compat wrapper for the proven Bombard path (boulder family, camp → wall).
  function _playBoulderVolley(payload, { count, stagger, travel }) {
    return _playProjectileVolley({ structureActorId: payload?.structureActorId, family: "boulder", count, stagger, travel });
  }

  // Local hook relay (mirror of siege-counter-activities._relayHook): fire locally + socket
  // so the volley plays on every client, GM-authoritative play, Sequencer broadcasts visuals.
  function _relaySiege(hook, payload) {
    try { Hooks.callAll(hook, payload); } catch (e) { console.warn(TAG, "relay callAll failed", e); }
    try { game.socket?.emit?.("module.bbttcc-raid", { t: "siegeHook", hook, payload }); } catch (_e) {}
  }

  // ─── Outcome palette (spec §8 status names) ─────────────────────────────────
  const OUTCOME = {
    won_storm:          { color: RED,    label: "Carried by Storm",            flash: true,  shake: true },
    won_sack:           { color: AMBER,  label: "The Place is Sacked",          flash: false, shake: false },
    won_surrender:      { color: GREEN,  label: "The Garrison Yields",          flash: false, shake: false },
    won_trojan_horse:   { color: VIOLET, label: "The Gates Open from Within",   flash: true,  shake: true },
    lost_hold:          { color: GRAY,   label: "The Siege is Broken",          flash: false, shake: false },
    lost_supply_crisis: { color: RED,    label: "Supply Crisis — Withdrawal in Disarray", flash: true, shake: true },
    lost_pyrrhic:       { color: AMBER,  label: "A Pyrrhic Victory",            flash: true,  shake: false },
    lost_relieved:      { color: BLUE,   label: "Relief Breaks the Siege",      flash: false, shake: false },
    abandoned:          { color: GRAY,   label: "The Siege is Abandoned",       flash: false, shake: false }
  };

  // ─── Hook handlers ───────────────────────────────────────────────────────────
  function _onLayerBreached(payload) {
    _injectStylesOnce();
    try {
      const name = payload?.layerName || "A wall";
      _fullScreenFlash(RED);     // Catastrophic Entry
      _shakeBoard();
      _banner(`${name} Breached`, BRONZE);
      _pulse(_hudPanel(), RED);
    } catch (e) { console.warn(TAG, "layerBreached vfx failed", e); }
  }

  function _onConvene(payload) {
    _injectStylesOnce();
    try {
      const n = Number(payload?.layerIdx ?? 0) + 1;
      _banner(`Breach Scene — Layer ${n}`, AMBER);
      _pulse(_hudPanel(), AMBER);
    } catch (e) { console.warn(TAG, "convene vfx failed", e); }
  }

  function _onOutcome(payload) {
    _injectStylesOnce();
    try {
      const status = String(payload?.status || "");
      const p = OUTCOME[status] || { color: BRONZE, label: status.replace(/_/g, " ").toUpperCase(), flash: false, shake: false };
      _banner(p.label, p.color);
      if (p.flash) _fullScreenFlash(p.color);
      if (p.shake) _shakeBoard();
      _pulse(_hudPanel(), p.color);
    } catch (e) { console.warn(TAG, "outcome vfx failed", e); }
  }

  function _onChampionDuel(payload) {
    _injectStylesOnce();
    try {
      const win = game.actors?.get?.(payload?.winnerId)?.name || "A champion";
      const lose = game.actors?.get?.(payload?.loserId)?.name || "their rival";
      const dead = payload?.fate === "dead";
      _banner(`${win} ${dead ? "slays" : "bests"} ${lose}`, dead ? RED : BRONZE);
      if (dead) { _fullScreenFlash(RED); _shakeBoard(); }
      _pulse(_hudPanel(), dead ? RED : BRONZE);
    } catch (e) { console.warn(TAG, "championDuel vfx failed", e); }
  }

  // Phase E.3 — Relief Force beats.
  function _onReliefArrives(payload) {
    _injectStylesOnce();
    try {
      const from = game.actors?.get?.(payload?.wave?.callingFactionId)?.name;
      _banner(from ? `Relief Approaches — ${from}` : "Relief Approaches", BLUE);
      _pulse(_hudPanel(), BLUE);
    } catch (e) { console.warn(TAG, "reliefArrives vfx failed", e); }
  }

  function _onReliefConvene(payload) {
    _injectStylesOnce();
    try {
      _banner("Relief Force — The Open Field", BLUE);
      _pulse(_hudPanel(), BLUE);
    } catch (e) { console.warn(TAG, "reliefConvene vfx failed", e); }
  }

  function _onReliefRepulsed(payload) {
    _injectStylesOnce();
    try {
      const from = game.actors?.get?.(payload?.callingFactionId)?.name;
      _banner(from ? `Relief Repulsed — ${from} Thrown Back` : "Relief Repulsed", BRONZE);
      _pulse(_hudPanel(), BRONZE);
    } catch (e) { console.warn(TAG, "reliefRepulsed vfx failed", e); }
  }

  // Phase E.4 — Trojan Horse. Success rides the won_trojan_horse outcome banner (violet);
  // here we mark the Sinon sacrifice + the discovered-ruse failure.
  function _onTrojanHorse(payload) {
    _injectStylesOnce();
    try {
      if (payload?.sinon) {
        const nm = game.actors?.get?.(payload?.championId)?.name || "A champion";
        _banner(`${nm} Enters the Gates`, VIOLET);
        _pulse(_hudPanel(), VIOLET);
      }
    } catch (e) { console.warn(TAG, "trojanHorse vfx failed", e); }
  }

  function _onTrojanFailed(payload) {
    _injectStylesOnce();
    try {
      _fullScreenFlash(RED);
      _shakeBoard();
      _banner("The Ruse is Undone", RED);
      _pulse(_hudPanel(), RED);
    } catch (e) { console.warn(TAG, "trojanFailed vfx failed", e); }
  }

  // Phase F.2 — Champion Death Cascade. The fall itself is bannered by the duel (championDuel
  // VFX); this marks the cascade CONSEQUENCE — the rally (absent allies return) or the mourning.
  function _onCascade(payload) {
    _injectStylesOnce();
    try {
      const side = payload?.side;
      const color = side === "attacker" ? "#ff9a9a" : BLUE;
      const rallied = Array.isArray(payload?.rallied) ? payload.rallied : [];
      if (rallied.length) {
        const nm = game.actors?.get?.(rallied[0])?.name || "An ally";
        _banner(rallied.length > 1 ? `${rallied.length} Rally to the Banner` : `${nm} Returns to the Fray`, color);
      } else {
        _banner(side === "defender" && payload?.thresholdWeakened ? "The Wall Mourns" : "The Camp Mourns", color);
      }
      _pulse(_hudPanel(), color);
    } catch (e) { console.warn(TAG, "cascade vfx failed", e); }
  }

  // Phase F.3 — Event Deck draw. Amber ticker banner with the event name.
  function _onEvent(payload) {
    _injectStylesOnce();
    try {
      _banner(`⚑ ${payload?.name || "A Siege Event"}`, AMBER);
      _pulse(_hudPanel(), AMBER);
    } catch (e) { console.warn(TAG, "event vfx failed", e); }
  }

  // §6 — Bombardment. The Plate damage already landed in the Bombard handler; this is the
  // spectacle: a 2–3 boulder volley arcing the siege line → wall, impact-burst + board shake.
  // Banner + shake run on every client; the Sequencer volley plays GM-side and broadcasts.
  function _onBombardment(payload) {
    _injectStylesOnce();
    try {
      _banner("⛰ Bombardment", BRONZE);
      _pulse(_hudPanel(), BRONZE);
    } catch (e) { console.warn(TAG, "bombardment banner failed", e); }

    const count   = Math.max(1, Math.min(3, Number(payload?.volley) || 2));
    const STAGGER = 260;  // ms between boulders in the volley
    const TRAVEL  = 750;  // ms ~ a boulder's flight (impact-burst sync)
    const impactAt = TRAVEL + (count - 1) * STAGGER;

    // Shake on impact, on every client. The hook fires near-simultaneously everywhere
    // (GM local + socket relay), so a local timer keeps it roughly in sync with the burst.
    try { setTimeout(() => { try { _shakeBoard(); } catch (_) {} }, impactAt); } catch (_) {}

    // Token/effect choreography is GM-authoritative; Sequencer relays the visuals to clients.
    if (!game.user?.isGM) return;
    try { _playBoulderVolley(payload, { count, stagger: STAGGER, travel: TRAVEL }); }
    catch (e) { console.warn(TAG, "bombardment volley failed", e); }
  }

  // Stage 2 — Resolve the Clash. The lines meet: a banner keyed to who broke (the boulder/
  // arrow volleys are fired separately by resolveClash via the projectile beat). Decisive
  // routs flash + shake; a grinding stalemate just banners.
  function _onClash(payload) {
    _injectStylesOnce();
    try {
      const outcome = String(payload?.outcome || "stalemate");
      const map = {
        defender_routed: { label: "The Wall is Swept",        color: "#ff7a5a", flash: true,  shake: true },
        attacker_routed: { label: "The Assault is Thrown Back", color: BLUE,    flash: false, shake: true },
        mutual_collapse: { label: "Both Hosts Break",          color: RED,      flash: true,  shake: true },
        stalemate:       { label: "The Lines Grind",           color: BRONZE,   flash: false, shake: false }
      };
      const p = map[outcome] || map.stalemate;
      _banner(`⚔ ${p.label}`, p.color);
      if (p.flash) _fullScreenFlash(p.color);
      if (p.shake) _shakeBoard();
      _pulse(_hudPanel(), p.color);
    } catch (e) { console.warn(TAG, "clash vfx failed", e); }
  }

  // Generic projectile beat — the reusable spectacle layer any siege event can fire.
  // payload = { structureActorId, family, count, scale, direction, stagger, travel,
  //             banner?, color?, shake?:false }. Banner + shake run on every client; the
  //             Sequencer volley plays GM-side and broadcasts. Degrades to banner+shake.
  function _onProjectile(payload) {
    _injectStylesOnce();
    if (payload?.banner) {
      try { _banner(String(payload.banner), payload.color || BRONZE); _pulse(_hudPanel(), payload.color || BRONZE); }
      catch (e) { console.warn(TAG, "projectile banner failed", e); }
    }
    const count   = Math.max(1, Math.min(8, Number(payload?.count) || 2));
    const stagger = Number(payload?.stagger) || 260;
    const travel  = Number(payload?.travel)  || 750;
    if (payload?.shake !== false) {
      const impactAt = travel + (count - 1) * stagger;
      try { setTimeout(() => { try { _shakeBoard(); } catch (_) {} }, impactAt); } catch (_) {}
    }
    if (!game.user?.isGM) return;
    try { _playProjectileVolley({ ...payload, count, stagger, travel }); }
    catch (e) { console.warn(TAG, "projectile volley failed", e); }
  }

  Hooks.on("bbttcc:siege:layerBreached", _onLayerBreached);
  Hooks.on("bbttcc:siege:convene", _onConvene);
  Hooks.on("bbttcc:siege:outcome", _onOutcome);
  Hooks.on("bbttcc:siege:championDuel", _onChampionDuel);
  Hooks.on("bbttcc:siege:reliefArrives", _onReliefArrives);
  Hooks.on("bbttcc:siege:reliefConvene", _onReliefConvene);
  Hooks.on("bbttcc:siege:reliefRepulsed", _onReliefRepulsed);
  Hooks.on("bbttcc:siege:trojanHorse", _onTrojanHorse);
  Hooks.on("bbttcc:siege:trojanFailed", _onTrojanFailed);
  Hooks.on("bbttcc:siege:cascade", _onCascade);
  Hooks.on("bbttcc:siege:event", _onEvent);
  Hooks.on("bbttcc:siege:bombardment", _onBombardment);
  Hooks.on("bbttcc:siege:projectile", _onProjectile);
  Hooks.on("bbttcc:siege:clash", _onClash);

  // Expose for the selftest / manual preview.
  function _install() {
    game.bbttcc = game.bbttcc || { api: {} };
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.siege = game.bbttcc.api.siege || {};
    game.bbttcc.api.siege.previewVfx = (kind, payload = {}) => {
      if (kind === "layerBreached") return _onLayerBreached(payload);
      if (kind === "convene") return _onConvene(payload);
      if (kind === "outcome") return _onOutcome(payload);
      if (kind === "championDuel") return _onChampionDuel(payload);
      if (kind === "reliefArrives") return _onReliefArrives(payload);
      if (kind === "reliefConvene") return _onReliefConvene(payload);
      if (kind === "reliefRepulsed") return _onReliefRepulsed(payload);
      if (kind === "trojanHorse") return _onTrojanHorse(payload);
      if (kind === "trojanFailed") return _onTrojanFailed(payload);
      if (kind === "cascade") return _onCascade(payload);
      if (kind === "event") return _onEvent(payload);
      if (kind === "bombardment") return _onBombardment(payload);
      if (kind === "projectile") return _onProjectile(payload);
      if (kind === "clash") return _onClash(payload);
      console.warn(TAG, "previewVfx: unknown kind", kind);
    };

    // Public, reusable: fire a projectile volley from anywhere (relayed to all clients).
    // e.g. game.bbttcc.api.siege.projectile({ structureActorId, family:"fire", count:5, banner:"🔥 Storm the Walls" })
    game.bbttcc.api.siege.projectile = (payload = {}) => _relaySiege("bbttcc:siege:projectile", payload);
    // Family names available to callers (for menus/tooling).
    game.bbttcc.api.siege.projectileFamilies = Object.keys(_FAMILIES);
  }

  Hooks.once("ready", () => { _injectStylesOnce(); _install(); console.log(TAG, "Siege VFX renderer ready (D.3)."); });
  if (game?.ready) { _injectStylesOnce(); _install(); }

  console.log(TAG, "loaded");
})();

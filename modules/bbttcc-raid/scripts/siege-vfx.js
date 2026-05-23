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
      console.warn(TAG, "previewVfx: unknown kind", kind);
    };
  }

  Hooks.once("ready", () => { _injectStylesOnce(); _install(); console.log(TAG, "Siege VFX renderer ready (D.3)."); });
  if (game?.ready) { _injectStylesOnce(); _install(); }

  console.log(TAG, "loaded");
})();

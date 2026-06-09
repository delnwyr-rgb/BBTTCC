// scripts/raid-courtly.vfx.js
//
// BBTTCC — Courtly Intrigue Phase F VFX renderer
// Spec: bbttcc-raid/COURTLY_INTRIGUE_SPEC.md §7 Phase F
//
// Listens to bbttcc:courtly:vfx hook on every client. Hook is fired by:
//   * GM-side engine (raid-courtly.influence.enhancer.js) at suspicion
//     threshold crosses, court collapse, outcome resolution, favor changes.
//   * Secrets API (raid-courtly.secrets.api.js) on secret play.
//   * Either source ALSO broadcasts via socket → raid-courtly socket
//     receiver in module.raid-console.js re-fires the hook locally on
//     other clients (mirrors the S3a infilHook pattern).
//
// Event schema: { kind: string, ts, ...payload }
// kinds:
//   "suspicion-threshold" { level: 5|8, before, after }
//   "court-collapse"      { suspicion: 10 }
//   "favor"               { actorId, factionId, before, after, delta }
//   "secret-play"         { actorId, actorName, itemName, acquisition, effectKey }
//   "outcome"             { outcome, outcomeKind, winnerSide, attackerName, defenderName }

(() => {
  const TAG = "[bbttcc-raid:courtly-vfx]";

  const CYAN   = "#5ce1e6";
  const VIOLET = "#a78bfa";
  const RED    = "#ff5555";
  const AMBER  = "#ffaa55";
  const esc    = (s) => foundry.utils.escapeHTML(String(s ?? ""));

  // ─── Stylesheet (one-time injection) ──────────────────────────────────────
  function _injectStylesOnce() {
    if (document.getElementById("ft-courtly-vfx-styles")) return;
    const css = `
      @keyframes ftCourtlyPulse {
        0%   { box-shadow: 0 0 4px var(--ft-pulse-color, ${CYAN}), 0 0 16px var(--ft-pulse-color, ${CYAN}); transform: scale(1); }
        50%  { box-shadow: 0 0 16px var(--ft-pulse-color, ${CYAN}), 0 0 32px var(--ft-pulse-color, ${CYAN}); transform: scale(1.04); }
        100% { box-shadow: 0 0 4px var(--ft-pulse-color, ${CYAN}), 0 0 16px var(--ft-pulse-color, ${CYAN}); transform: scale(1); }
      }
      .ft-courtly-pulse { animation: ftCourtlyPulse 600ms ease-out 2; }
      @keyframes ftCourtlyFloat {
        0%   { transform: translate(-50%, 0); opacity: 0; }
        15%  { opacity: 1; }
        100% { transform: translate(-50%, -64px); opacity: 0; }
      }
      .ft-courtly-floattext {
        position: fixed; pointer-events: none; z-index: 10000;
        font-family: 'Signika', sans-serif; font-weight: 700;
        font-size: 1.4rem; text-shadow: 0 0 6px currentColor, 0 0 12px rgba(0,0,0,0.85);
        animation: ftCourtlyFloat 1500ms ease-out forwards;
      }
      @keyframes ftCourtlyFullFlash {
        0%   { opacity: 0; }
        20%  { opacity: 1; }
        100% { opacity: 0; }
      }
      .ft-courtly-fullflash {
        position: fixed; inset: 0; pointer-events: none; z-index: 9998;
        background: radial-gradient(circle at center, transparent 40%, var(--ft-flash-color, ${RED}) 95%);
        mix-blend-mode: screen; animation: ftCourtlyFullFlash 1200ms ease-out forwards;
      }
      @keyframes ftCourtlyBannerIn {
        0%   { transform: translate(-50%, -40px); opacity: 0; }
        20%  { transform: translate(-50%, 0); opacity: 1; }
        80%  { transform: translate(-50%, 0); opacity: 1; }
        100% { transform: translate(-50%, -20px); opacity: 0; }
      }
      .ft-courtly-banner {
        position: fixed; top: 90px; left: 50%; transform: translate(-50%, 0);
        z-index: 10001; pointer-events: none;
        padding: .6rem 1.4rem; border-radius: 8px;
        background: rgba(20,20,28,0.95); backdrop-filter: blur(4px);
        font-family: 'Signika', sans-serif; font-size: 1.15rem; font-weight: 600;
        letter-spacing: .08em; text-transform: uppercase;
        box-shadow: 0 4px 24px rgba(0,0,0,0.6);
        animation: ftCourtlyBannerIn 4500ms ease-out forwards;
      }
      /* Phase F polish — brief flash when a HUD value changes (toggled
       * on by raid-courtly.hud.js). */
      @keyframes ftCourtlyValueFlash {
        0%   { background: rgba(255,210,138,0.45); }
        100% { background: transparent; }
      }
      .ft-courtly-valueflash { animation: ftCourtlyValueFlash 480ms ease-out; }
    `;
    const style = document.createElement("style");
    style.id = "ft-courtly-vfx-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Renderers ────────────────────────────────────────────────────────────
  function _floatTextAt(x, y, text, color) {
    const el = document.createElement("div");
    el.className = "ft-courtly-floattext";
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
    el.style.color = color;
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }

  function _floatOnToken(actorId, text, color) {
    const tk = (canvas?.tokens?.placeables || []).find(t => t.actor?.id === actorId);
    if (!tk) return;
    const screenCenter = tk.center ? canvas.stage.toGlobal({ x: tk.center.x, y: tk.center.y }) : null;
    if (!screenCenter) return;
    const rect = canvas.app?.view?.getBoundingClientRect?.() || { left: 0, top: 0 };
    _floatTextAt(rect.left + screenCenter.x, rect.top + screenCenter.y - 20, text, color);
  }

  function _pulseElement(el, color = CYAN) {
    if (!el) return;
    el.style.setProperty("--ft-pulse-color", color);
    el.classList.remove("ft-courtly-pulse");
    void el.offsetWidth; // restart animation
    el.classList.add("ft-courtly-pulse");
    setTimeout(() => el.classList.remove("ft-courtly-pulse"), 1300);
  }

  function _fullScreenFlash(color = RED) {
    const el = document.createElement("div");
    el.className = "ft-courtly-fullflash";
    el.style.setProperty("--ft-flash-color", color);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  function _banner(text, color = CYAN) {
    const el = document.createElement("div");
    el.className = "ft-courtly-banner";
    el.style.color = color;
    el.style.border = `1px solid ${color}`;
    el.style.boxShadow = `0 0 24px ${color}66, 0 4px 24px rgba(0,0,0,0.6)`;
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4700);
  }

  // ─── Hook handler ─────────────────────────────────────────────────────────
  function _onCourtlyVfx(evt) {
    if (!evt?.kind) return;
    _injectStylesOnce();
    try {
      switch (evt.kind) {
        case "suspicion-threshold": {
          const susBar = document.querySelector("#ft-courtly-influence");
          if (susBar) _pulseElement(susBar, evt.level >= 8 ? RED : AMBER);
          _banner(evt.level >= 8 ? "Court grows uneasy — crisis" : "Court grows uneasy", evt.level >= 8 ? RED : AMBER);
          break;
        }
        case "court-collapse": {
          _fullScreenFlash(RED);
          _banner("The Court Collapses", RED);
          break;
        }
        case "favor": {
          const delta = Number(evt.delta || 0);
          if (!delta) break;
          const text = (delta > 0 ? "+" : "") + delta + " favor";
          const color = delta > 0 ? CYAN : RED;
          _floatOnToken(evt.actorId, text, color);
          // Pulse the roster panel so HUD viewers see something too
          const roster = document.querySelector("#ft-courtly-roster");
          if (roster) _pulseElement(roster, color);
          break;
        }
        case "secret-play": {
          const color = evt.acquisition === "stolen" ? RED : VIOLET;
          _banner(`${evt.actorName || "A faction"} plays ${evt.itemName || "a secret"}`, color);
          const sec = document.querySelector("#ft-courtly-secrets");
          if (sec) _pulseElement(sec, color);
          // Canvas flourish (2026-06-09): fire a thematic Sequencer effect on the
          // player's token via the fx API, keyed by the secret's effectKey (courtly
          // gold base + per-secret flavor). GM-only so the broadcast fires once for
          // everyone (the hook itself runs on every client for the DOM banner above).
          try {
            if (game.user?.isGM) {
              const fx = game.bbttcc?.api?.fx;
              const tok = (canvas?.tokens?.placeables || []).find((t) => t.actor?.id === evt.actorId) || null;
              if (fx?.playKey) fx.playKey(evt.effectKey || "courtly_secret", { targetToken: tok, effectRequiresTarget: false }, { family: "political", phase: "resolve", banner: false });
            }
          } catch (e) { console.warn(TAG, "secret-play fx failed", e); }
          break;
        }
        case "outcome": {
          const kind = String(evt.outcomeKind || "outcome");
          const palette = {
            cleanTriumph:       { color: "#88cc55", label: "Clean Triumph" },
            tarnishedVictory:   { color: AMBER,    label: "Tarnished Victory" },
            stalemate:          { color: CYAN,     label: "Stalemate" },
            publicHumiliation:  { color: RED,      label: "Public Humiliation" },
            mutualRuin:         { color: VIOLET,   label: "Mutual Ruin" }
          }[kind] || { color: CYAN, label: kind.toUpperCase() };
          const winnerName = evt.winnerSide === "A" ? evt.attackerName : evt.winnerSide === "D" ? evt.defenderName : null;
          const txt = winnerName ? `${palette.label} — ${winnerName}` : palette.label;
          _banner(txt, palette.color);
          if (kind === "mutualRuin" || kind === "publicHumiliation") _fullScreenFlash(palette.color);
          break;
        }
        default:
          // unknown kind — silently ignore
      }
    } catch (e) { console.warn(TAG, "vfx handler failed", evt, e); }
  }

  Hooks.on("bbttcc:courtly:vfx", _onCourtlyVfx);

  // Inject styles on ready so the first event has them.
  Hooks.once("ready", () => {
    _injectStylesOnce();
    console.log(TAG, "Phase F VFX renderer ready.");
  });
})();

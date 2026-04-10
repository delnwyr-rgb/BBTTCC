import { installFXSettings } from "./core/fx-settings.js";
import { createFXAPI } from "./api/fx-api.js";
import { installRegistry } from "./core/fx-registry.js";
import { installRaidConsoleIntegration } from "./integrations/raid-console-integration.js";
import { installTurnIntegration } from "./integrations/turn-integration.js";

const TAG = "[bbttcc-fx]";
const STYLE_ID = "bbttcc-fx-runtime-styles";

function ensureFXRoot() {
  let root = document.getElementById("bbttcc-fx-root");
  if (root) return root;

  root = document.createElement("div");
  root.id = "bbttcc-fx-root";
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.pointerEvents = "none";
  root.style.zIndex = "100000";
  root.dataset.raidTone = "";
  document.body.appendChild(root);

  console.log(TAG, "FX root created.");
  return root;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
#bbttcc-fx-root {
  --fx-accent: #d1d5db;
  --fx-accent-soft: rgba(209, 213, 219, 0.18);
  --fx-accent-strong: rgba(209, 213, 219, 0.55);
}
#bbttcc-fx-root[data-raid-tone="assault"] { --fx-accent: #ff4b4b; --fx-accent-soft: rgba(255,75,75,.18); --fx-accent-strong: rgba(255,75,75,.50); }
#bbttcc-fx-root[data-raid-tone="infiltration"] { --fx-accent: #7a5cff; --fx-accent-soft: rgba(122,92,255,.18); --fx-accent-strong: rgba(122,92,255,.50); }
#bbttcc-fx-root[data-raid-tone="courtly"] { --fx-accent: #d4af37; --fx-accent-soft: rgba(212,175,55,.18); --fx-accent-strong: rgba(212,175,55,.50); }
#bbttcc-fx-root[data-raid-tone="ritual"] { --fx-accent: #45b6ff; --fx-accent-soft: rgba(69,182,255,.18); --fx-accent-strong: rgba(69,182,255,.50); }
#bbttcc-fx-root[data-raid-tone="siege"] { --fx-accent: #ff8c42; --fx-accent-soft: rgba(255,140,66,.18); --fx-accent-strong: rgba(255,140,66,.50); }
#bbttcc-fx-root[data-raid-tone="boss"] { --fx-accent: #8b1e3f; --fx-accent-soft: rgba(139,30,63,.20); --fx-accent-strong: rgba(139,30,63,.58); }

.bbttcc-fx-banner {
  border: 1px solid var(--fx-accent-strong);
  box-shadow: 0 0 22px var(--fx-accent-soft), inset 0 0 18px rgba(255,255,255,.05);
}
.bbttcc-fx-roll-chip {
  border: 1px solid var(--fx-accent-strong);
  box-shadow: 0 0 14px var(--fx-accent-soft);
}
.bbttcc-fx-float {
  text-shadow: 0 0 10px var(--fx-accent-strong);
}
.bbttcc-fx-cinematic {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  opacity: .78;
  z-index: 100001;
  filter: saturate(1.08) contrast(1.05);
}
.bbttcc-fx-overlay {
  position: fixed;
  inset: 0;
  opacity: 0;
  transition: opacity .18s ease;
  z-index: 100000;
  pointer-events: none;
  overflow: hidden;
}
.bbttcc-fx-overlay.show { opacity: 1; }
.bbttcc-fx-overlay-assault,
.bbttcc-fx-overlay-tactical-sweep,
.bbttcc-fx-overlay-siege { background: radial-gradient(circle at center, rgba(255,95,64,.08), rgba(30,0,0,.18)); }
.bbttcc-fx-overlay-temporal,
.bbttcc-fx-overlay-temporal-ripple { background: radial-gradient(circle at center, rgba(111,168,255,.10), rgba(0,20,60,.20)); }
.bbttcc-fx-overlay-ritual,
.bbttcc-fx-overlay-ritual-rays { background: radial-gradient(circle at center, rgba(103,212,255,.10), rgba(0,28,52,.18)); }
.bbttcc-fx-overlay-void,
.bbttcc-fx-overlay-boss,
.bbttcc-fx-overlay-void-fracture { background: radial-gradient(circle at center, rgba(122,92,255,.08), rgba(8,0,18,.38)); }
.bbttcc-fx-overlay-courtly,
.bbttcc-fx-overlay-mirror-flash { background: radial-gradient(circle at center, rgba(212,175,55,.08), rgba(80,60,0,.20)); }
.bbttcc-fx-overlay-infiltration { background: radial-gradient(circle at center, rgba(122,92,255,.08), rgba(20,10,45,.28)); }

.bbttcc-fx-overlay-core,
.bbttcc-fx-ray,
.bbttcc-fx-ripple,
.bbttcc-fx-glitch-bar,
.bbttcc-fx-diamond,
.bbttcc-fx-sweep,
.bbttcc-fx-slash {
  position: absolute;
  inset: auto;
  pointer-events: none;
}

.bbttcc-fx-overlay-core-assault,
.bbttcc-fx-overlay-core-siege,
.bbttcc-fx-overlay-core-ritual,
.bbttcc-fx-overlay-core-temporal,
.bbttcc-fx-overlay-core-void,
.bbttcc-fx-overlay-core-courtly {
  left: 50%;
  top: 50%;
  width: 44vmin;
  height: 44vmin;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  opacity: .6;
}

.bbttcc-fx-overlay-core-assault {
  background: radial-gradient(circle, rgba(255,92,76,.20), rgba(255,92,76,0) 70%);
}
.bbttcc-fx-overlay-core-siege {
  background: radial-gradient(circle, rgba(255,140,66,.18), rgba(255,140,66,0) 72%);
}
.bbttcc-fx-overlay-core-ritual {
  background: radial-gradient(circle, rgba(103,212,255,.18), rgba(103,212,255,0) 74%);
}
.bbttcc-fx-overlay-core-temporal {
  background: radial-gradient(circle, rgba(111,168,255,.18), rgba(111,168,255,0) 72%);
}
.bbttcc-fx-overlay-core-void {
  background: radial-gradient(circle, rgba(122,92,255,.16), rgba(20,0,24,0) 72%);
}
.bbttcc-fx-overlay-core-courtly {
  background: radial-gradient(circle, rgba(212,175,55,.16), rgba(212,175,55,0) 74%);
}

.bbttcc-fx-ray {
  left: 50%;
  top: 50%;
  width: 2px;
  height: 48vh;
  transform-origin: center bottom;
  transform: translate(-50%, -100%) rotate(calc(var(--i) * 26deg - 78deg));
  background: linear-gradient(to top, rgba(103,212,255,0), rgba(170,235,255,.85), rgba(103,212,255,0));
  animation: bbttcc-fx-ray 1.05s ease-out forwards;
}

.bbttcc-fx-ripple {
  left: 50%;
  top: 50%;
  width: calc(18vmin + var(--i) * 8vmin);
  height: calc(18vmin + var(--i) * 8vmin);
  transform: translate(-50%, -50%);
  border-radius: 999px;
  border: 2px solid rgba(111,168,255,.55);
  box-shadow: 0 0 16px rgba(111,168,255,.20);
  animation: bbttcc-fx-ripple 1.2s ease-out forwards;
  animation-delay: calc(var(--i) * .08s);
}

.bbttcc-fx-glitch-bar {
  left: -10%;
  top: calc(8% + var(--i) * 10%);
  width: 38%;
  height: 3.2%;
  background: linear-gradient(90deg, rgba(122,92,255,0), rgba(122,92,255,.42), rgba(255,255,255,.12), rgba(122,92,255,0));
  transform: skewX(-18deg);
  animation: bbttcc-fx-glitch 0.55s steps(2, end) forwards;
  animation-delay: calc(var(--i) * .04s);
}

.bbttcc-fx-diamond {
  left: calc(26% + var(--i) * 10%);
  top: calc(28% + (var(--i) % 2) * 16%);
  width: 7vmin;
  height: 7vmin;
  border: 1px solid rgba(255,225,128,.7);
  box-shadow: 0 0 10px rgba(255,225,128,.18);
  transform: rotate(45deg) scale(.4);
  animation: bbttcc-fx-diamond 1s ease-out forwards;
}

.bbttcc-fx-sweep {
  left: -18%;
  top: calc(30% + var(--i) * 18%);
  width: 140%;
  height: 7%;
  background: linear-gradient(90deg, rgba(255,140,66,0), rgba(255,140,66,.30), rgba(255,215,170,.18), rgba(255,140,66,0));
  border-top: 1px solid rgba(255,140,66,.30);
  border-bottom: 1px solid rgba(255,140,66,.18);
  transform: skewX(-12deg);
  animation: bbttcc-fx-sweep 1.1s ease-out forwards;
  animation-delay: calc(var(--i) * .08s);
}

.bbttcc-fx-slash {
  left: calc(20% + var(--i) * 16%);
  top: calc(24% + var(--i) * 10%);
  width: 2px;
  height: 44vh;
  background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,110,92,.9), rgba(255,255,255,0));
  box-shadow: 0 0 14px rgba(255,90,64,.35);
  transform: rotate(calc(-22deg + var(--i) * 8deg));
  animation: bbttcc-fx-slash 0.85s ease-out forwards;
}

@keyframes bbttcc-fx-ray {
  from { opacity: 0; filter: blur(6px); }
  25% { opacity: .95; }
  to { opacity: 0; filter: blur(1px); }
}
@keyframes bbttcc-fx-ripple {
  from { opacity: .82; transform: translate(-50%, -50%) scale(.65); }
  to { opacity: 0; transform: translate(-50%, -50%) scale(1.5); }
}
@keyframes bbttcc-fx-glitch {
  from { opacity: 0; transform: translateX(-14%) skewX(-18deg); }
  30% { opacity: .9; }
  to { opacity: 0; transform: translateX(124%) skewX(-18deg); }
}
@keyframes bbttcc-fx-diamond {
  from { opacity: 0; transform: rotate(45deg) scale(.35); }
  25% { opacity: .9; }
  to { opacity: 0; transform: rotate(45deg) scale(1.15); }
}
@keyframes bbttcc-fx-sweep {
  from { opacity: 0; transform: translateX(-18%) skewX(-12deg); }
  20% { opacity: .85; }
  to { opacity: 0; transform: translateX(18%) skewX(-12deg); }
}
@keyframes bbttcc-fx-slash {
  from { opacity: 0; filter: blur(4px); }
  20% { opacity: .95; }
  to { opacity: 0; filter: blur(0px); }
}

.bbttcc-fx-panel-martial, .bbttcc-fx-panel-faith, .bbttcc-fx-panel-void, .bbttcc-fx-panel-temporal, .bbttcc-fx-panel-industrial, .bbttcc-fx-panel-political {
  box-shadow: 0 0 0 1px var(--fx-accent-strong), 0 0 24px var(--fx-accent-soft);
}
`;
  document.head.appendChild(style);
}

Hooks.once("init", () => {
  installFXSettings();
});

Hooks.once("ready", async () => {
  try {
    game.bbttcc ??= { api: {} };
    game.bbttcc.api ??= {};
    game.bbttcc.fx ??= {};

    ensureFXRoot();
    ensureStyles();

    const api = createFXAPI();
    game.bbttcc.api.fx = api;
    game.bbttcc.fx.api = api;

    await installRegistry(api);
    installRaidConsoleIntegration(api);
    installTurnIntegration(api);

    console.log(TAG, "FX module ready.");
  } catch (err) {
    console.error(TAG, "ready failed", err);
  }
});

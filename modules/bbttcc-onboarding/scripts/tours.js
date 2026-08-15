/* bbttcc-onboarding/scripts/tours.js
 * Operator-guided interface tours — the "read the manual from inside the manual" layer.
 *
 * A tour opens a REAL app (the player's actual sheet/console, never a mock-up),
 * then spotlights it region by region: dim everything else, ring the target, and
 * float an Operator-styled step card next to it (Back / Next / End, ←/→/Esc).
 * The highlighted element stays CLICKABLE, so "try it now" steps work live.
 *
 * Step text pulls from the central help registry (game.bbttcc.help — bbttcc-core)
 * wherever a `help: [appKey, key]` ref is given, so tooltips and tours share one
 * source of truth. Operator speak()/riff() narrate start, end, and key steps.
 *
 * Tour definition:
 *   {
 *     id, title,
 *     audience: "player" | "gm",          // gm tours refuse to start for players
 *     intro?: string, outro?: string,      // Operator chat lines (whispered to self)
 *     open:  async (ctx) => root Element | Application | null,
 *     close?: async (ctx) => {},
 *     steps: [{
 *       id?, title, text?,                 // card body (HTML-escaped, \n → <br>)
 *       help?: [appKey, key],              // text fallback ← game.bbttcc.help
 *       selector,                          // sought inside tour root, then document
 *       pre?: selector,                    // clicked first (e.g. a tab) before locating
 *       onEnter?: async (ctx, root) => {}, // arbitrary setup for this step
 *       speak?: string,                    // optional Operator chat line for this step
 *       optional?: true                    // missing selector ⇒ skip silently
 *     }]
 *   }
 *
 * Public API (game.bbttcc.onboarding.tours): register, list, get, start(id), stop(), menu()
 */

const MODULE_ID = "bbttcc-onboarding";
const TAG = "[onboarding/tours]";

const _tours = new Map();
let _active = null; // { def, ctx, root, idx, hl, card, follow, keyHandler }

function _ns() { return globalThis.game?.bbttcc?.onboarding; }
function _help() { return globalThis.game?.bbttcc?.help; }

function register(def) {
  if (!def?.id || !Array.isArray(def.steps)) return console.warn(TAG, "bad tour def", def);
  _tours.set(def.id, def);
}
function list() {
  return [..._tours.values()].map(t => ({ id: t.id, title: t.title, audience: t.audience || "player" }));
}
function get(id) { return _tours.get(id) || null; }

/* ── DOM helpers ─────────────────────────────────────────────────────────── */

function _rootEl(opened) {
  if (!opened) return null;
  if (opened instanceof HTMLElement) return opened;
  const el = opened.element;                       // Application (V1 jQuery or V2 element)
  if (el instanceof HTMLElement) return el;
  if (el?.[0] instanceof HTMLElement) return el[0];
  return null;
}

async function _waitFor(selector, root, { timeout = 4000 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const el = root?.querySelector?.(selector) || document.querySelector(selector);
    if (el && el.offsetParent !== null) return el;  // present AND visible
    await new Promise(r => setTimeout(r, 120));
  }
  return null;
}

function _esc(s) { return foundry.utils.escapeHTML(String(s ?? "")); }
function _cardHTML(step, i, total, text) {
  const body = _esc(text).replace(/\n/g, "<br>");
  return (
    `<div class="ob-tour-tag">◇ OPERATOR · INTERFACE TOUR</div>` +
    `<div class="ob-tour-title">${_esc(step.title || "")}</div>` +
    `<div class="ob-tour-body">${body}</div>` +
    `<div class="ob-tour-nav">` +
      `<span class="ob-tour-count">${i + 1} / ${total}</span>` +
      `<span class="ob-tour-btns">` +
        `<button type="button" data-tour-nav="back" ${i === 0 ? "disabled" : ""}>‹ Back</button>` +
        `<button type="button" data-tour-nav="next">${i + 1 >= total ? "Finish ✓" : "Next ›"}</button>` +
        `<button type="button" data-tour-nav="end" class="ob-tour-end">✕</button>` +
      `</span>` +
    `</div>`
  );
}

function _placeAround(target, hl, card) {
  const r = target.getBoundingClientRect();
  const pad = 6;
  Object.assign(hl.style, {
    left: `${r.left - pad}px`, top: `${r.top - pad}px`,
    width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`
  });
  // card: prefer right of target, then left, then below, clamped to viewport
  const cw = card.offsetWidth || 340, ch = card.offsetHeight || 160;
  const vw = window.innerWidth, vh = window.innerHeight;
  let x = r.right + 18, y = r.top;
  if (x + cw > vw - 12) x = r.left - cw - 18;
  if (x < 12) { x = Math.min(Math.max(12, r.left), vw - cw - 12); y = r.bottom + 14; }
  if (y + ch > vh - 12) y = vh - ch - 12;
  if (y < 12) y = 12;
  Object.assign(card.style, { left: `${x}px`, top: `${y}px` });
}

/* ── runner ──────────────────────────────────────────────────────────────── */

async function _showStep() {
  const a = _active;
  if (!a) return;
  const total = a.def.steps.length;
  if (a.idx >= total) return _finish(true);
  if (a.idx < 0) a.idx = 0;
  const step = a.def.steps[a.idx];

  try { await step.onEnter?.(a.ctx, a.root); } catch (e) { console.warn(TAG, "onEnter failed", e); }
  if (step.pre) {
    const preEl = a.root?.querySelector?.(step.pre) || document.querySelector(step.pre);
    try { preEl?.click(); } catch (_) {}
    await new Promise(r => setTimeout(r, 200)); // let the tab/panel settle
  }

  const target = await _waitFor(step.selector, a.root, { timeout: step.optional ? 900 : 4000 });
  if (!target) {
    console.warn(TAG, `step "${step.id || step.title}" — selector not found: ${step.selector}${step.optional ? " (optional, skipping)" : ""}`);
    a.idx += a.dir >= 0 ? 1 : -1;                 // keep moving in the direction of travel
    return _showStep();
  }

  try { target.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (_) {}

  let text = step.text;
  if (!text && Array.isArray(step.help)) text = _help()?.tip?.(step.help[0], step.help[1]) || "";
  a.card.innerHTML = _cardHTML(step, a.idx, total, text || "");
  a.hl.style.display = a.card.style.display = "block";
  _placeAround(target, a.hl, a.card);
  a.target = target;

  if (step.speak && !a.spoken.has(a.idx)) {
    a.spoken.add(a.idx);
    try { await a.ctx.speak(step.speak, { audience: "self" }); } catch (_) {}
  }
}

function _finish(completed) {
  const a = _active;
  if (!a) return;
  _active = null;
  clearInterval(a.follow);
  window.removeEventListener("keydown", a.keyHandler, true);
  a.hl.remove(); a.card.remove();
  (async () => {
    try { await a.def.close?.(a.ctx); } catch (_) {}
    if (completed && a.def.outro) { try { await a.ctx.speak(a.def.outro, { audience: "self" }); } catch (_) {} }
    Hooks.callAll("bbttcc:tour:ended", { id: a.def.id, completed, atStep: a.idx });
  })();
}

async function start(id) {
  const def = _tours.get(id);
  if (!def) { ui.notifications?.warn?.(`No tour "${id}". Known: ${[..._tours.keys()].join(", ")}`); return; }
  if ((def.audience === "gm") && !game.user.isGM) {
    ui.notifications?.warn?.("That tour covers GM-only controls."); return;
  }
  if (_active) _finish(false);

  const ns = _ns();
  const user = game.user;
  const steward = ns?.resolve?.steward?.(user) || null;
  const ctx = {
    user, steward,
    faction: ns?.resolve?.faction?.(user, steward) || null,
    speak: (line, opts) => (ns?.speak ? ns.speak(line, opts) : Promise.resolve()),
    riff:  (args, opts) => (ns?.riff ? ns.riff(args, opts) : Promise.resolve(null))
  };

  let root = null;
  try { root = _rootEl(await def.open?.(ctx)); } catch (e) { console.warn(TAG, "tour open() failed", e); }
  await new Promise(r => setTimeout(r, 350)); // let the app finish rendering

  const hl = document.createElement("div");
  hl.className = "ob-tour-highlight";
  const card = document.createElement("div");
  card.className = "ob-tour-card";
  document.body.append(hl, card);

  card.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-tour-nav]");
    if (!btn) return;
    const a = _active; if (!a) return;
    if (btn.dataset.tourNav === "end") return _finish(false);
    a.dir = btn.dataset.tourNav === "back" ? -1 : 1;
    a.idx += a.dir;
    if (a.idx < 0) a.idx = 0;
    _showStep();
  });

  const keyHandler = (ev) => {
    const a = _active; if (!a) return;
    if (ev.key === "Escape") { ev.stopPropagation(); return _finish(false); }
    if (ev.key === "ArrowRight") { a.dir = 1; a.idx += 1; _showStep(); }
    if (ev.key === "ArrowLeft" && a.idx > 0) { a.dir = -1; a.idx -= 1; _showStep(); }
  };
  window.addEventListener("keydown", keyHandler, true);

  _active = {
    def, ctx, root, idx: 0, dir: 1, hl, card, keyHandler, target: null, spoken: new Set(),
    follow: setInterval(() => {                    // track moving/resizing windows
      const a = _active;
      if (a?.target?.isConnected) _placeAround(a.target, a.hl, a.card);
    }, 250)
  };

  if (def.intro) { try { await ctx.speak(def.intro, { audience: "self" }); } catch (_) {} }
  Hooks.callAll("bbttcc:tour:started", { id: def.id });
  await _showStep();
}

function stop() { _finish(false); }

/** Simple picker — lists tours this user can run. */
async function menu() {
  const rows = list()
    .filter(t => t.audience !== "gm" || game.user.isGM)
    .map(t => `<label class="ob-tour-pick"><input type="radio" name="tour" value="${_esc(t.id)}"> ${_esc(t.title)}${t.audience === "gm" ? " <em>(GM)</em>" : ""}</label>`)
    .join("");
  if (!rows) return ui.notifications?.info?.("No tours registered yet.");
  const content = `<div class="bbttcc-onboarding-prompt"><p>Pick an interface walkthrough:</p>${rows}</div>`;
  const DV2 = foundry?.applications?.api?.DialogV2;
  const runPicked = (html) => {
    const el = html instanceof HTMLElement ? html : html?.[0];
    const id = el?.querySelector?.('input[name="tour"]:checked')?.value;
    if (id) start(id);
  };
  if (DV2?.wait) {
    await DV2.wait({
      window: { title: "◇ Operator — Interface Tours" }, content,
      buttons: [{ action: "go", label: "Begin", default: true, callback: (_ev, btn) => runPicked(btn.form ?? btn) }],
      rejectClose: false, modal: false
    }).catch(() => null);
  } else {
    new Dialog({
      title: "◇ Operator — Interface Tours", content,
      buttons: { go: { label: "Begin", callback: runPicked } }, default: "go"
    }).render(true);
  }
}

Hooks.once("ready", () => {
  const ns = _ns();
  if (!ns) return console.warn(TAG, "onboarding namespace missing — tours not exposed.");
  ns.tours = { register, list, get, start, stop, menu, active: () => !!_active };
  console.log(TAG, `tour engine ready — ${_tours.size} tour(s) registered.`);
});

// bbttcc-core/module.js
// FULL REPLACEMENT — Core bootstrap hardened + GM Write Layer install hook
//
// Notes:
// - Does NOT overwrite existing game.bbttcc.api (merges instead).
// - Registers core world settings used by GM tools.
// - Loads gm API installer if present on globalThis (or via dynamic import fallback).
//
// Syntax-safe: no optional chaining, no object spread, no async/await.

const CORE_ID = "bbttcc-core";

function _log()  { console.log.apply(console, arguments); }
function _warn() { console.warn.apply(console, arguments); }

function _ensureRoot() {
  game.bbttcc = game.bbttcc || {};
  game.bbttcc.api = game.bbttcc.api || {};

  // Preserve anything already registered by other modules.
  const api = game.bbttcc.api;

  if (!api.core) api.core = { version: "1.0.0" };

  // Provide stable "slots" other modules can fill (do not null them if already set).
  if (typeof api.factions === "undefined")          api.factions = null;
  if (typeof api.territory === "undefined")         api.territory = null;
  if (typeof api.characterOptions === "undefined")  api.characterOptions = null;
  if (typeof api.campaign === "undefined")          api.campaign = null;
  if (typeof api.encounters === "undefined")        api.encounters = null;

  // Combat adapter seam (Phase 1) — system-agnostic damage/actor contract.
  // The active game system registers the impl methods (RFI: thin aliases to the
  // fourththing fulcrum; a native dnd5e impl lands in a later phase). Cross-
  // module callers go through game.bbttcc.combat.* instead of game.fourththing.*.
  //
  // Method slots default to null so a caller's existing `if (!fn)` guard
  // degrades gracefully when no system impl is present (behavior-identical to
  // the pre-seam guards). Filled field-by-field (NOT all-or-nothing) so the slot
  // survives whatever module/system order touches it first, and so a system that
  // pre-registered one method doesn't lose the others.
  //
  // _interceptors is the registered pre-damage extension point that replaces the
  // bbttcc-structures monkeypatch: each impl's applyDamage runs them at its top
  // and an interceptor may CLAIM a target (e.g. route a structure through the
  // integrity/plates model) and short-circuit. Interceptors stay system-agnostic
  // (they read amount/damageType/flags only), so they work on dnd5e too.
  if (!game.bbttcc.combat) game.bbttcc.combat = {};
  var _combat = game.bbttcc.combat;
  if (typeof _combat.applyDamage === "undefined")        _combat.applyDamage = null;
  if (typeof _combat.resistsForcedMove === "undefined")  _combat.resistsForcedMove = null;
  if (typeof _combat.applyCondition === "undefined")     _combat.applyCondition = null;
  if (typeof _combat.getHealth === "undefined")          _combat.getHealth = null;
  if (typeof _combat.heal === "undefined")               _combat.heal = null;   // heal(actor, amount) → {before, after} (2026-10-08)
  if (typeof _combat.hasCondition === "undefined")       _combat.hasCondition = null;
  if (!(_combat._interceptors instanceof Array))         _combat._interceptors = [];
  if (typeof _combat.registerDamageInterceptor !== "function") {
    _combat.registerDamageInterceptor = function (fn) {
      if (typeof fn === "function" && _combat._interceptors.indexOf(fn) === -1) {
        _combat._interceptors.push(fn);
      }
      return fn;
    };
  }
  if (typeof _combat.unregisterDamageInterceptor !== "function") {
    _combat.unregisterDamageInterceptor = function (fn) {
      var i = _combat._interceptors.indexOf(fn);
      if (i !== -1) _combat._interceptors.splice(i, 1);
      return i !== -1;
    };
  }

  return api;
}

function _registerSettings() {
  try {
    game.settings.register(CORE_ID, "gmEditMode", {
      name: "GM Edit Mode",
      hint: "Enables GM-only direct write tools (manual edits) across Bad Eden.",
      scope: "world",
      config: true,
      type: Boolean,
      default: false
    });

    game.settings.register(CORE_ID, "gmAuditLog", {
      name: "GM Audit Log",
      hint: "Internal log of GM manual edits (JSON array).",
      scope: "world",
      config: false,
      type: String,
      default: "[]"
    });
  } catch (e) {
    _warn(`[${CORE_ID}] settings register failed`, e);
  }
}

function _installGMApi() {
  const api = _ensureRoot();

  // Prefer already-loaded installer (if module.json loads scripts/api.gm.js)
  if (globalThis.BBTTCC_GM_API && typeof globalThis.BBTTCC_GM_API.install === "function") {
    try {
      globalThis.BBTTCC_GM_API.install(game.bbttcc);
      _log(`[${CORE_ID}] GM API installed (global installer)`);
      return;
    } catch (e) {
      _warn(`[${CORE_ID}] GM API install failed`, e);
      return;
    }
  }

  // Fallback: attempt dynamic import relative to this module (Foundry supports it).
  // This requires module.json to allow module scripts, but is harmless if it fails.
  try {
    // eslint-disable-next-line no-undef
    import(`./api.gm.js`).then(function () {
      if (globalThis.BBTTCC_GM_API && typeof globalThis.BBTTCC_GM_API.install === "function") {
        try {
          globalThis.BBTTCC_GM_API.install(game.bbttcc);
          _log(`[${CORE_ID}] GM API installed (dynamic import)`);
        } catch (e2) {
          _warn(`[${CORE_ID}] GM API install after import failed`, e2);
        }
      } else {
        _warn(`[${CORE_ID}] GM API import succeeded but installer missing`);
      }
    }).catch(function (e) {
      _warn(`[${CORE_ID}] GM API dynamic import failed (ok if not yet wired in module.json)`, e);
    });
  } catch (e) {
    _warn(`[${CORE_ID}] GM API dynamic import not available`, e);
  }
}

// ═══ LIFECYCLE CONTRACT (fix-the-boat item 4, 2026-09-12) ═══
// Replaces ready-polling and retry timers. A provider calls provide(cap, value) when a capability is
// FINAL for this session and rebuilt(cap) whenever it re-normalizes/replaces it; a consumer awaits
// need(cap) once and registers onRebuild(cap, fn) to re-apply its extension. Capabilities are plain
// strings ("raid.EFFECTS"). Nothing here depends on module load order.
function _installLifecycle() {
  const root = (game.bbttcc ??= {});
  if (root.lifecycle?.__v) return root.lifecycle;
  const provided = new Map(), waiters = new Map(), rebuilders = new Map();
  const lc = {
    __v: 1,
    has: (cap) => provided.has(String(cap)),
    get: (cap) => provided.get(String(cap)),
    provide(cap, value) { cap = String(cap); provided.set(cap, value); for (const r of (waiters.get(cap) || [])) { try { r(value); } catch (_e) {} } waiters.delete(cap); try { Hooks.callAll(`bbttcc:lifecycle:${cap}`, value); } catch (_e) {} return value; },
    need(cap) { cap = String(cap); if (provided.has(cap)) return Promise.resolve(provided.get(cap)); return new Promise((res) => { (waiters.get(cap) || waiters.set(cap, []).get(cap)).push(res); }); },
    onRebuild(cap, fn) { cap = String(cap); (rebuilders.get(cap) || rebuilders.set(cap, []).get(cap)).push(fn); },
    rebuilt(cap, value) { cap = String(cap); if (value !== undefined) provided.set(cap, value); for (const fn of (rebuilders.get(cap) || [])) { try { fn(provided.get(cap)); } catch (e) { console.warn("[bbttcc-core] lifecycle rebuild handler failed", cap, e); } } },
    caps: () => [...provided.keys()]
  };
  root.lifecycle = lc; return lc;
}
_installLifecycle();   // at script load, so any module's ready handler can use it regardless of order

Hooks.once("init", function () {
  _ensureRoot();
  _installLifecycle();
  _registerSettings();
  _log(`[${CORE_ID}] init`);
});

Hooks.once("ready", function () {
  _installGMApi();
  _log(`[${CORE_ID}] ready`);
});

// Round 4 (2026-11-05): a page load can lose files to ngrok 503s, and Foundry carries on without them, so features vanish. Check at init and reload by
// itself, up to 3 times. If it still fails, say so on that seat.
// Resource Timing can't do this alone: 132 of 327 tags had no entry (measured 2026-11-06).
// So ask the browser instead. Importing a module script that loaded does nothing. Importing a lost one downloads it again, and that download is the
// signal: when it works the import reports success and the script runs late (measured in Chrome), which is harmless because this page is about to reload.
const _LOAD_RETRY_KEY = "bbttcc-load-retries";
const _LOAD_CHECK_TIMEOUT_MS = 5000;
try { performance.setResourceTimingBufferSize(2000); } catch (_e) {}
const _shortFile = (u) => { try { return decodeURIComponent(new URL(u).pathname); } catch (_e) { return String(u); } };
// Diagnosis: one line per load in this browser's localStorage. Read it with: localStorage.getItem("bbttcc-load-log")
function _logLoad(r) {
  try {
    const log = JSON.parse(localStorage.getItem("bbttcc-load-log") || "[]");
    log.push({ at: new Date().toISOString(), checked: r.checked, heard: r.heard, ms: r.ms, timedOut: r.timedOut, failed: r.lost.map(f => f.split("/").pop()), gone: r.gone.length, threw: r.threw.length });
    localStorage.setItem("bbttcc-load-log", JSON.stringify(log.slice(-60)));
  } catch (_e) {}
}
// Scripts report failure in document order, so a listener from an early file hears the later ones, classic scripts too, which import() can't test.
// systems/fourththing/ft-translation.js starts it. On a world using another system, this file starts it, which hears fewer of them.
if (!globalThis.__bbttccLostTags) {
  const lostTags = globalThis.__bbttccLostTags = [];
  window.addEventListener("error", (e) => { if (e.target?.tagName === "SCRIPT" && e.target.src) lostTags.push(e.target.src); }, true);
}
async function _checkLoadedFiles() {
  const t0 = performance.now();
  const sameOrigin = (u) => { try { return new URL(u, location.href).origin === location.origin; } catch (_e) { return false; } };
  const lost = new Set(), gone = new Set(), threw = [];
  // Is a file we think failed really absent from the server, or was it just lost on this load?
  const verify = async (u, bodyMatters) => {
    const f = _shortFile(u);
    try {
      const res = await fetch(u, { cache: "no-store" });
      if (res.status === 404) gone.add(f);
      else if (!res.ok || !bodyMatters || (await res.text()).replace(/\/\*[\s\S]*?\*\//g, "").trim()) lost.add(f);
    } catch (_e) { lost.add(f); }
  };
  // Module CSS arrives by @import inside <style> tags. A stylesheet that failed can't be read (SecurityError, measured), so fetch any unreadable or empty one, as the file may really be empty.
  const suspectSheets = [];
  let sheetCount = 0;
  const walk = (sheet) => {
    let rules;
    try { rules = sheet.cssRules; } catch (_e) { return; }
    for (const r of rules) {
      if (r.type !== CSSRule.IMPORT_RULE) continue;
      sheetCount++;
      let n = -1;
      try { n = r.styleSheet?.cssRules?.length ?? -1; } catch (_e) {}
      const href = new URL(r.href, sheet.href || location.href).href;
      if (n <= 0 && sameOrigin(href)) suspectSheets.push(href);
      else if (n > 0) walk(r.styleSheet);
    }
  };
  for (const sheet of document.styleSheets) walk(sheet);
  for (const l of document.querySelectorAll('link[rel="stylesheet"][href]')) {
    if (l.disabled || !sameOrigin(l.href)) continue;
    sheetCount++;
    let n = -1;
    try { n = l.sheet?.cssRules?.length ?? -1; } catch (_e) {}
    if (n <= 0) suspectSheets.push(l.href);
  }
  const tags = [...document.querySelectorAll('script[type="module"][src]')].map(s => s.src).filter(sameOrigin);
  const classic = document.querySelectorAll('script[src]:not([type="module"])').length;
  let timedOut = false;
  const probes = tags.map(u => import(u).then(() => {}, (e) => {
    if (e?.name === "SyntaxError" || (e?.name === "TypeError" && /dynamically imported module|module script/i.test(e.message || ""))) lost.add(_shortFile(u));
    else threw.push(_shortFile(u));   // It loaded and its own code threw: a bug, not a lost file, and a reload wouldn't help.
  }));
  await Promise.race([
    Promise.allSettled(probes),
    new Promise(res => setTimeout(() => { timedOut = true; res(); }, _LOAD_CHECK_TIMEOUT_MS))
  ]);
  await new Promise(res => setTimeout(res, 50));   // Finished downloads reach the timeline a moment after the import settles.
  for (const e of performance.getEntriesByType("resource")) {
    if (e.startTime < t0 || !sameOrigin(e.name) || !/\.m?js(\?|$)/.test(e.name)) continue;
    const f = _shortFile(e.name);
    if (e.responseStatus === 404) gone.add(f);   // Really not on the server, so a reload wouldn't help.
    else lost.add(f);
  }
  const heard = [...new Set(globalThis.__bbttccLostTags || [])].filter(sameOrigin);
  await Promise.all([...heard.map(u => verify(u, false)), ...[...new Set(suspectSheets)].map(u => verify(u, true))]);
  for (const f of gone) lost.delete(f);
  return { checked: tags.length + classic + sheetCount, heard: heard.length, ms: Math.round(performance.now() - t0), timedOut, lost: [...lost], gone: [...gone], threw };
}
let _loadCheck = Promise.resolve(null);
Hooks.once("init", () => {
  _loadCheck = _checkLoadedFiles().then((r) => {
    _logLoad(r);
    const tries = Number(sessionStorage.getItem(_LOAD_RETRY_KEY)) || 0;
    if (r.gone.length || r.threw.length) console.warn("[bbttcc-core] page load check, not lost files:", { gone: r.gone, threw: r.threw });
    if (r.lost.length && tries < 3) {
      sessionStorage.setItem(_LOAD_RETRY_KEY, String(tries + 1));
      console.warn(`[bbttcc-core] page load missing ${r.lost.length} file(s), reloading (try ${tries + 1} of 3):`, r.lost);
      location.reload();
    } else if (!r.lost.length) sessionStorage.removeItem(_LOAD_RETRY_KEY);
    return r;
  }).catch((e) => { console.warn("[bbttcc-core] page load check failed", e); return null; });
});
Hooks.once("ready", async () => {
  try {
    const r = await _loadCheck;
    if (!r?.lost?.length) return;
    console.error("[bbttcc-core] this page load is missing files:", r.lost);
    ui.notifications?.error?.(`This page load is missing ${r.lost.length} file(s), so some features may not work. Press F5 to reload.`, { permanent: true });
  } catch (_e) {}
});

/* bbttcc-core/scripts/bbttcc-help.js
 * game.bbttcc.help — the ONE central registry for hover-help text across every
 * BBTTCC interface, and the shared text source for the Operator-guided tours
 * (bbttcc-onboarding). Write the explanation ONCE; tooltips and tour steps both
 * read it, so the two can never drift apart.
 *
 * Registering (any module, init or later — the registry is order-safe):
 *   game.bbttcc.help.register("market", {
 *     buy:   "Buy — spend faction Economy marks on the listed lot. 1 OP = 10 marks.",
 *     stock: { text: "Stock — remaining lots this Turn.", label: "Stock" },
 *   });
 *
 * Consuming:
 *   HBS templates:   data-tooltip="{{bbttccTip 'market' 'buy'}}"
 *   JS-built DOM:    el.dataset.tooltip = game.bbttcc.help.tip("market", "buy")
 *   Bulk (overlays): mark elements data-help="buy" then
 *                    game.bbttcc.help.applyTooltips(rootEl, "market")
 *   Tours:           game.bbttcc.help.entry("market", "buy") → {text, label}
 *
 * Foundry's core TooltipManager renders data-tooltip natively — no listeners here.
 */

const TAG = "[bbttcc-help]";

// Keyed appKey → { key → {text, label} }. Lives on globalThis too so modules whose
// init runs before ours can still register through the same object.
const _registry = (globalThis.__BBTTCC_HELP_REGISTRY = globalThis.__BBTTCC_HELP_REGISTRY || new Map());

function _normalize(key, raw) {
  if (raw == null) return null;
  if (typeof raw === "string") return { text: raw, label: key };
  const text = String(raw.text ?? "");
  return { ...raw, text, label: raw.label ?? key };
}

/** Merge a dictionary of {key: "text" | {text,label,...}} under an app namespace. */
function register(appKey, dict = {}) {
  if (!appKey || typeof dict !== "object") return;
  const app = _registry.get(appKey) || new Map();
  for (const [k, v] of Object.entries(dict)) {
    const e = _normalize(k, v);
    if (e) app.set(k, e);
  }
  _registry.set(appKey, app);
}

/** Full entry ({text,label,...}) or null. */
function entry(appKey, key) { return _registry.get(appKey)?.get(key) ?? null; }

/** Just the hover text ("" when unknown — safe to feed data-tooltip directly). */
function tip(appKey, key) { return entry(appKey, key)?.text ?? ""; }

/** All entries for one app as {key: entry} (tours iterate this). */
function dict(appKey) {
  const app = _registry.get(appKey);
  return app ? Object.fromEntries(app) : {};
}

/** Registered app namespaces. */
function apps() { return [...(_registry.keys())]; }

/**
 * Stamp data-tooltip onto every [data-help="<key>"] element under root from the
 * app's dictionary. For DOM-overlay UIs (siege HUD, world overview…) where
 * templating a helper isn't an option. Idempotent; unknown keys are left alone.
 */
function applyTooltips(root, appKey) {
  if (!root?.querySelectorAll) return 0;
  let n = 0;
  for (const el of root.querySelectorAll("[data-help]")) {
    const t = tip(appKey, el.dataset.help);
    if (t) { el.dataset.tooltip = t; n++; }
  }
  return n;
}

const api = { register, entry, tip, dict, apps, applyTooltips };

Hooks.once("init", () => {
  game.bbttcc = game.bbttcc || {};
  game.bbttcc.help = api;

  // {{bbttccTip "app" "key"}} — mirrors the per-sheet helpers (ftFacultyTip,
  // bbttcc_opTip…) but reads the central registry.
  try {
    if (!Handlebars.helpers.bbttccTip) {
      Handlebars.registerHelper("bbttccTip", (appKey, key) => tip(appKey, key));
    }
  } catch (e) { console.warn(TAG, "Handlebars helper registration failed", e); }

  console.log(TAG, "central help registry ready (game.bbttcc.help).");
});

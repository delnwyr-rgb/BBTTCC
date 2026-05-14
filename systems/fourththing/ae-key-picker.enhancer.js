// Roll for Initiation — Active Effect Key Picker (typeahead)
// ─────────────────────────────────────────────────────────────────────────────
// Hooks the Active Effect config (AppV2 in Foundry V14) and replaces the
// bare "Attribute Key" text input with a typeahead combobox fed by the
// AE_REGISTRY. Free-text input is preserved — typing any unregistered key
// still works (DAE-style). Hovering a registered key shows a tooltip with
// the engine description.
//
// Module integration: any module can call
//   game.fourththing.ae.register({ key, label, category, desc?, modes? })
// before the AE editor opens. The picker re-fetches the registry every
// render, so late-registered keys appear immediately.
// ─────────────────────────────────────────────────────────────────────────────

import { AE_REGISTRY } from "./ae-keys-registry.js";

const TAG = "[ft-ae-picker]";
const DATALIST_ID = "ft-ae-keys-datalist";
const log  = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

function buildDatalist(doc) {
  let dl = doc.getElementById(DATALIST_ID);
  if (dl) dl.remove();
  dl = doc.createElement("datalist");
  dl.id = DATALIST_ID;
  // Group via <option label> — most browsers ignore <optgroup> in datalist,
  // but the label suffix shows up as the secondary text in the dropdown.
  const all = AE_REGISTRY.all().slice().sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.label.localeCompare(b.label);
  });
  for (const e of all) {
    const opt = doc.createElement("option");
    opt.value = e.key;
    // The `label` attribute shows in the suggestion list as a secondary line.
    opt.label = `${e.category} — ${e.label}`;
    dl.appendChild(opt);
  }
  return dl;
}

function applyTooltip(input) {
  const v = String(input.value || "").trim();
  if (!v) {
    input.removeAttribute("data-tooltip");
    return;
  }
  const meta = AE_REGISTRY.get(v);
  if (!meta) {
    input.setAttribute("data-tooltip", "Custom key (not in fourththing registry)");
    return;
  }
  const parts = [`<strong>${meta.label}</strong>`, meta.desc || ""];
  if (meta.valueHint) parts.push(`<em>Value:</em> ${meta.valueHint}`);
  if (meta.modes?.length) parts.push(`<em>Modes:</em> ${meta.modes.join(", ")}`);
  if (meta.readBy?.length) parts.push(`<em>Read by:</em> ${meta.readBy.join(", ")}`);
  input.setAttribute("data-tooltip", parts.filter(Boolean).join("<br>"));
}

function enhanceRoot(root) {
  if (!root || !(root instanceof HTMLElement)) return;
  if (root._ftAEKeyPickerBound) return;
  root._ftAEKeyPickerBound = true;

  const doc = root.ownerDocument || document;
  // Inject (or refresh) the datalist into the same document.
  let dl = doc.getElementById(DATALIST_ID);
  if (dl) dl.remove();
  dl = buildDatalist(doc);
  root.appendChild(dl);

  // Attach to every change-key input. Foundry's AE config uses
  // name="changes.<n>.key" or name="changes[n].key". Match either.
  const inputs = root.querySelectorAll('input[name$=".key"], input[name$="].key"]');
  for (const input of inputs) {
    if (input._ftAEKeyPickerWired) continue;
    input._ftAEKeyPickerWired = true;
    input.setAttribute("list", DATALIST_ID);
    input.setAttribute("autocomplete", "off");
    applyTooltip(input);
    input.addEventListener("input",  () => applyTooltip(input));
    input.addEventListener("change", () => applyTooltip(input));
  }

  // Also rebind on dynamic re-renders (Foundry sometimes re-renders rows
  // when adding/removing changes). MutationObserver catches new inputs.
  if (!root._ftAEKeyPickerObserver) {
    const obs = new MutationObserver(() => {
      const more = root.querySelectorAll('input[name$=".key"]:not([data-ft-ae-picker])');
      for (const input of more) {
        if (input._ftAEKeyPickerWired) continue;
        input._ftAEKeyPickerWired = true;
        input.setAttribute("list", DATALIST_ID);
        input.setAttribute("autocomplete", "off");
        input.setAttribute("data-ft-ae-picker", "1");
        applyTooltip(input);
        input.addEventListener("input",  () => applyTooltip(input));
        input.addEventListener("change", () => applyTooltip(input));
      }
    });
    obs.observe(root, { childList: true, subtree: true });
    root._ftAEKeyPickerObserver = obs;
  }
}

function rootFromApp(app, html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (app?.element instanceof HTMLElement) return app.element;
  if (app?.element?.[0] instanceof HTMLElement) return app.element[0];
  return null;
}

Hooks.on("renderActiveEffectConfig", (app, html) => {
  try { enhanceRoot(rootFromApp(app, html)); }
  catch (e) { warn("renderActiveEffectConfig enhance failed", e); }
});

// V2 fallback — Foundry V14's ActiveEffectConfig is V2 and fires both
// renderActiveEffectConfig (V1 bridge hook) and renderApplicationV2.
Hooks.on("renderApplicationV2", (app, html) => {
  if (app?.constructor?.name !== "ActiveEffectConfig") return;
  try { enhanceRoot(rootFromApp(app, html)); }
  catch (e) { warn("renderApplicationV2 enhance failed", e); }
});

// Public API. Module like bbttcc-territory can register hex/strategic keys.
Hooks.once("ready", () => {
  try {
    game.fourththing = game.fourththing || {};
    game.fourththing.ae = {
      register:     (e)   => AE_REGISTRY.register(e),
      registerMany: (arr) => AE_REGISTRY.registerMany(arr),
      get:          (k)   => AE_REGISTRY.get(k),
      has:          (k)   => AE_REGISTRY.has(k),
      all:          ()    => AE_REGISTRY.all(),
      byCategory:   ()    => AE_REGISTRY.byCategory(),
      docs:         ()    => AE_REGISTRY.docs()
    };
    log(`API ready — ${AE_REGISTRY.all().length} keys registered. Call game.fourththing.ae.docs() for the full table.`);
  } catch (e) { warn("ready hook failed", e); }
});

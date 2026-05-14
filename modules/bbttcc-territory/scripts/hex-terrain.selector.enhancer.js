/* modules/bbttcc-territory/scripts/hex-terrain.selector.enhancer.js
 * v1.3 — Robust save-on-change for BBTTCC Hex Terrain
 * - Injects Terrain <select> into .bbttcc-hex-config
 * - Delegated listeners (change/input) so re-renders still work
 * - Resolves the correct DrawingDocument and persists flags immediately
 * - Uses travel API terrain dictionary when available (fallback provided)
 *
 * v1.3 (2026-04-29) — fix terrain not persisting on AppV2 hex sheet.
 *   BBTTCC_HexSheet extends ApplicationV2 → fires renderApplicationV2, NOT
 *   renderApplication. The previous hook only fired for AppV1, so listeners
 *   never bound (only the once-ready fallback's injection ran). Now hooks
 *   both render events with the same callback.
 */

(() => {
  const MOD = "bbttcc-territory";
  const TAG = "[bbttcc-terrain]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  // --- helpers ---------------------------------------------------
  function terrainDict(){
    const ext = game.bbttcc?.api?.travel?.__terrain || {};
    // Keys here MUST match the canon produced by bbttccNormalizeTerrainKey
    // in main.js. Mismatches (e.g. dropdown "canyon" → canon "canyons")
    // cause the post-Save reopen to fail preselect, default to first
    // option (plains), and silently overwrite the saved terrain.
    const fb = {
      plains:        {label:"Plains / Grasslands"},
      forest:        {label:"Forest / Jungle"},
      mountains:     {label:"Mountains / Highlands"},
      canyons:       {label:"Canyons / Badlands"},
      swamp:         {label:"Swamp / Mire"},
      desert:        {label:"Desert / Ash Wastes"},
      river:         {label:"River / Lake"},
      ocean:         {label:"Sea / Ocean"},
      ruins:         {label:"Ruins / Urban"},
      wasteland:     {label:"Wasteland / Radiation"}
    };
    const keys = new Set([...Object.keys(fb), ...Object.keys(ext)]);
    const dict = {};
    for (const k of keys) dict[k] = { label:(ext[k]?.label || fb[k]?.label || k) };
    return dict;
  }

  function optionsHTML(dict){
    return Object.entries(dict)
      .map(([k,v])=>`<option value="${k}">${v.label}</option>`)
      .join("");
  }

  // Try hard to get the DrawingDocument being edited
  async function resolveHexDocument(app){
    // 1) If the app is bound to a document or object already:
    const maybe = app?.document || app?.object || app?.actor || null;
    if (maybe?.document) return maybe.document;
    if (maybe?.update && maybe?.id) return maybe; // looks like a Document

    // 2) Try from UUID if present
    const uuid = app?.object?.uuid || app?.document?.uuid || app?.options?.uuid || null;
    if (uuid) {
      try {
        const d = await fromUuid(uuid);
        const doc = d?.document ?? d;
        if (doc?.update) return doc;
      } catch (e) {}
    }

    // 3) Last resort: detect by title/name in the open form, then find matching drawing
    try {
      const el = app?.element instanceof jQuery ? app.element[0] : app?.element;
      const root = el?.querySelector?.(".bbttcc-hex-config");
      const nameInput = root?.querySelector?.("input[name='name']");
      const nm = nameInput?.value?.trim();
      if (nm) {
        const hit = (canvas.drawings?.placeables||[]).find(p => {
          const n = p?.document?.text || p?.document?.name;
          return String(n||"").trim() === nm;
        });
        return hit?.document ?? null;
      }
    } catch (e) {}

    return null;
  }

  // Inject the row if not present
  async function injectRow(app){
    try {
      const el = app?.element instanceof jQuery ? app.element[0] : app?.element;
      const root = el?.querySelector?.(".bbttcc-hex-config");
      if (!root) return; // not our editor
      if (root.querySelector("[data-bbttcc='terrain-row']")) return; // already added

      const dict = terrainDict();
      const row = document.createElement("div");
      row.className = "form-group";
      row.setAttribute("data-bbttcc","terrain-row");
      row.innerHTML = `
        <label>Terrain</label>
        <select name="flags.${MOD}.terrain.key">${optionsHTML(dict)}</select>
        <input type="hidden" name="flags.${MOD}.terrain.label" value="">
        <p class="hint">Used for travel OP cost & encounter tier. Saves on change.</p>
      `;

      // Insert near the Type group if available
      const leftCol = root.querySelector(".grid .col");
      const before  = leftCol?.querySelector(".form-group select[name$='type']")?.closest(".form-group");
      if (before?.parentElement) before.parentElement.insertBefore(row, before);
      else if (leftCol) leftCol.prepend(row);
      else root.prepend(row);

      // Preselect from existing flag (if any)
      const doc  = await resolveHexDocument(app);
      let curKey = "";
      let curLabel = "";
      try {
        const t = doc?.getFlag?.(MOD, "terrain");
        curKey = t?.key || "";
        curLabel = t?.label || "";
      } catch {}
      const sel = row.querySelector(`select[name="flags.${MOD}.terrain.key"]`);
      const hid = row.querySelector(`input[name="flags.${MOD}.terrain.label"]`);
      if (sel && curKey) {
        let opt = [...sel.options].find(o => o.value === curKey);
        if (!opt) {
          // Existing key isn't in the standard menu (legacy keys like
          // grasslands/jungle/highlands/badlands/mire/ashWastes/lake/sea/
          // urbanWreckage/radiation, or any future canon drift). Inject
          // an option for it so preselect always matches and Save can't
          // silently default-overwrite to the first option.
          opt = document.createElement("option");
          opt.value = curKey;
          opt.textContent = curLabel || dict[curKey]?.label || curKey;
          sel.insertBefore(opt, sel.firstChild);
        }
        opt.selected = true;
        if (hid) hid.value = curLabel || dict[curKey]?.label || curKey;
      }
      // Mark untouched. handleChange flips this to "1" on user-initiated
      // change. Save callback uses this to avoid consuming a default-only
      // dropdown value when the user never touched terrain.
      if (sel) sel.setAttribute("data-ft-terrain-touched", "0");

      log("Terrain selector injected.");
    } catch (e) { warn("injectRow failed:", e); }
  }

  // Delegated save-on-change (covers re-renders)
  async function handleChange(app, ev){
    try {
      const target = ev?.target;
      if (!target) return;
      const isTerrain = target.matches?.(`select[name="flags.${MOD}.terrain.key"]`);
      if (!isTerrain) return;

      // Current dict + label
      const dict = terrainDict();
      const key  = target.value;
      const label = dict[key]?.label || key;

      // Stamp touched so the Save callback can trust this value.
      try { target.setAttribute("data-ft-terrain-touched", "1"); } catch {}

      // Get the real DrawingDocument for this editor
      const doc = await resolveHexDocument(app);
      if (!doc?.update) {
        warn("No document to update for terrain change.");
        return;
      }

      await doc.update({ [`flags.${MOD}.terrain`]: { key, label } });

      // Keep the hidden label in sync (optional)
      const root = (app?.element instanceof jQuery ? app.element[0] : app?.element)?.querySelector?.(".bbttcc-hex-config");
      const hid = root?.querySelector?.(`input[name="flags.${MOD}.terrain.label"]`);
      if (hid) hid.value = label;

      ui.notifications?.info?.(`Terrain set to ${label}.`);
      log("Terrain saved:", { id: doc.id, key, label });
    } catch (e) {
      warn("handleChange failed:", e);
      ui.notifications?.error?.("Failed to save Terrain (see console).");
    }
  }

  // Hook up — AppV1 fires renderApplication; AppV2 (BBTTCC_HexSheet extends
  // HandlebarsApplicationMixin(ApplicationV2)) fires renderApplicationV2.
  // Without the V2 hook, the once-ready fallback injects the row but never
  // binds the change listener, so terrain selections silently drop.
  const onRender = (app, html) => {
    // Inject (once per render)
    injectRow(app);

    // Bind delegated listeners on the editor root (works if inner HTML re-renders)
    try {
      const root = app?.element instanceof jQuery ? app.element[0] : app?.element;
      const host = root?.querySelector?.(".bbttcc-hex-config");
      if (!host) return;
      // Avoid double-binding
      if (!host._bbttccTerrainBound) {
        host.addEventListener("change", ev => handleChange(app, ev), true);
        host.addEventListener("input",  ev => handleChange(app, ev), true);
        host._bbttccTerrainBound = true;
      }
    } catch (e) { warn("bind listeners failed:", e); }
  };
  Hooks.on("renderApplication",   onRender);
  Hooks.on("renderApplicationV2", onRender);

  // Post-load pass (covers first open)
  Hooks.once("ready", () => setTimeout(() => {
    for (const id of Object.keys(ui.windows||{})) {
      const w = ui.windows[id];
      try { injectRow(w); } catch {}
    }
  }, 300));
})();

/* modules/bbttcc-territory/scripts/hex-terrain.selector.enhancer.js
 * v1.2 — Robust save-on-change for BBTTCC Hex Terrain
 * - Injects Terrain <select> into .bbttcc-hex-config
 * - Delegated listeners (change/input) so re-renders still work
 * - Resolves the correct DrawingDocument and persists flags immediately
 * - Uses travel API terrain dictionary when available (fallback provided)
 */

(() => {
  const MOD = "bbttcc-territory";
  const TAG = "[bbttcc-terrain]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  // --- helpers ---------------------------------------------------
  function terrainDict(){
    const ext = game.bbttcc?.api?.travel?.__terrain || {};
    const fb = {
      plains:{label:"Plains / Grasslands"},
      forest:{label:"Forest / Jungle"},
      mountains:{label:"Mountains / Highlands"},
      canyon:{label:"Canyons / Badlands"},
      swamp:{label:"Swamp / Mire"},
      desert:{label:"Desert / Ash Wastes"},
      river:{label:"River / Lake"},
      ocean:{label:"Sea / Ocean"},
      ruins:{label:"Ruins / Urban"},
      wasteland:{label:"Wasteland / Radiation"}
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
      try { curKey = doc?.getFlag?.(MOD, "terrain")?.key || ""; } catch {}
      const sel = row.querySelector(`select[name="flags.${MOD}.terrain.key"]`);
      const hid = row.querySelector(`input[name="flags.${MOD}.terrain.label"]`);
      if (sel && curKey) {
        const opt = [...sel.options].find(o => o.value === curKey);
        if (opt) opt.selected = true;
        if (hid) hid.value = dict[curKey]?.label || curKey;
      }

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

  // Hook up
  Hooks.on("renderApplication", (app, html) => {
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
  });

  // Post-load pass (covers first open)
  Hooks.once("ready", () => setTimeout(() => {
    for (const id of Object.keys(ui.windows||{})) {
      const w = ui.windows[id];
      try { injectRow(w); } catch {}
    }
  }, 300));
})();

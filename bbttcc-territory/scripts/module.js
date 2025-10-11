/******************************************************
 * BBTTCC TERRITORY — toolbar + Dashboard (AppV2)
 ******************************************************/
const MODULE_ID = "bbttcc-territory";

const L = {
  i: (...a) => console.log(`[${MODULE_ID}]`, ...a),
  w: (...a) => console.warn(`[${MODULE_ID}]`, ...a),
  e: (...a) => console.error(`[${MODULE_ID}]`, ...a)
};

/* ----------------------------------------------------
 * Dashboard (ApplicationV2, template-less)
 ---------------------------------------------------- */
class TerritoryDashboard extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-territory-dashboard",
    window: { title: "BBTTCC Territory", icon: "fa-solid fa-hexagon", resizable: true },
    position: { width: 580, height: "auto" },
    classes: ["bbttcc", "bbttcc-territory"],
    tag: "section"
  };

  constructor(...args) {
    super(...args);
    this._activeTab = "dashboard"; // or "claim"
  }

  // swap tabs externally
  setActiveTab(t) { this._activeTab = t || "dashboard"; }

  async _renderHTML() {
    const scene = canvas?.scene;
    const drawings = scene?.drawings ?? [];
    const hexes = drawings.filter(d => getProperty(d, `flags.${MODULE_ID}.isTerritory`));

    const esc = foundry.utils.escapeHTML;
    const rows = hexes.map(d => {
      const n = getProperty(d, `flags.${MODULE_ID}.name`) || `Hex ${d.id.slice(0,6)}`;
      return `
        <div class="row" data-id="${d.id}" style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border:1px solid #0001;border-radius:8px;margin-bottom:6px;">
          <span>${esc(n)}</span>
          <span style="display:flex;gap:6px;">
            <button type="button" class="btn" data-act="pan">Pan</button>
            <button type="button" class="btn" data-act="rename">Rename</button>
            <button type="button" class="btn" data-act="delete">Delete</button>
          </span>
        </div>`;
    }).join("");

    const tabDash = this._activeTab === "dashboard";
    const html = `
      <style>
        .bbttcc-territory .btn{padding:.35rem .6rem;border:1px solid var(--color-border-light-tertiary);border-radius:6px;background:var(--color-bg-btn);cursor:pointer}
        .bbttcc-territory .tabs a{cursor:pointer;padding:.25rem .5rem;border-radius:6px}
        .bbttcc-territory .tabs a.active{font-weight:600;text-decoration:underline}
        .bbttcc-territory .form-row{display:flex;gap:.5rem;align-items:center}
      </style>

      <nav class="tabs" style="display:flex;gap:.5rem;margin-bottom:.5rem;">
        <a data-tab="dashboard" class="${tabDash ? "active": ""}"><i class="fa-solid fa-gauge"></i> Dashboard</a>
        <a data-tab="claim" class="${!tabDash ? "active": ""}"><i class="fa-solid fa-flag"></i> Claim</a>
      </nav>

      ${tabDash ? `
        <div class="form-row" style="margin-bottom:.5rem;">
          <label style="width:120px;">Scene</label>
          <div>${esc(scene?.name ?? "—")}</div>
        </div>

        <div class="form-row" style="margin-bottom:.5rem;">
          <label style="width:120px;">Territory hexes</label>
          <div><b>${hexes.length}</b></div>
        </div>

        <hr/>

        <div class="form-row" style="margin:.5rem 0;">
          <label style="width:120px;">New hex radius</label>
          <input type="number" min="20" step="5" name="radius" value="140" style="width:100px;"/>
          <button class="btn" data-action="create-hex"><i class="fa-solid fa-draw-polygon"></i> Create</button>
        </div>

        <h3 style="margin:.75rem 0 .5rem;">Existing Territories</h3>
        <div id="hex-list">${rows || `<em style="opacity:.75">None yet.</em>`}</div>
      ` : `
        <p class="notes" style="opacity:.8;margin:.25rem 0 .75rem;">Starter claim UI (placeholder). Choose a radius and create a hex as part of claim.</p>
        <div class="form-row" style="margin:.5rem 0;">
          <label style="width:120px;">Claim radius</label>
          <input type="number" min="20" step="5" name="claimRadius" value="140" style="width:100px;"/>
          <button class="btn" data-action="claim"><i class="fa-solid fa-flag"></i> Claim</button>
        </div>
      `}
    `;
    const root = document.createElement("section");
    root.classList.add("bbttcc-territory");
    root.innerHTML = html;
    return root;
  }

  async _replaceHTML(result, content) {
    content.replaceChildren(result);
  }

  _onRender(_ctx, _opts) {
    const el = this.element;
    if (!el) return;

    // tabs
    el.querySelectorAll("[data-tab]").forEach(a => {
      a.addEventListener("click", () => { this._activeTab = a.dataset.tab; this.render(); });
    });

    // create from dashboard
    el.querySelector("[data-action='create-hex']")?.addEventListener("click", async () => {
      const r = Number(el.querySelector("input[name='radius']")?.value ?? 140);
      await game.modules.get(MODULE_ID)?.api?.createHex({ radius: r });
      this.render();
    });

    // claim stub (uses createHex for now)
    el.querySelector("[data-action='claim']")?.addEventListener("click", async () => {
      const r = Number(el.querySelector("input[name='claimRadius']")?.value ?? 140);
      await game.modules.get(MODULE_ID)?.api?.createHex({ radius: r });
      ui.notifications?.info("Claim: created a territory hex (placeholder).");
      this._activeTab = "dashboard";
      this.render();
    });

    // list actions: pan/rename/delete
    el.querySelectorAll("#hex-list .row .btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.closest(".row")?.dataset.id;
        const d = canvas?.scene?.drawings?.get(id);
        if (!d) return;
        const act = btn.dataset.act;
        if (act === "pan") {
          canvas.animatePan({ x: d.x + (d.shape?.width ?? 0)/2, y: d.y + (d.shape?.height ?? 0)/2, duration: 500, scale: canvas.stage?.scale?.x ?? 1 });
        } else if (act === "rename") {
          const val = await Dialog.prompt({
            title: "Rename Territory",
            content: `<p>New name:</p><input type="text" value="${foundry.utils.escapeHTML(getProperty(d, `flags.${MODULE_ID}.name`) ?? "")}"/>`,
            label: "Save",
            callback: html => html.querySelector("input")?.value ?? ""
          });
          if (val !== null) await d.update({ [`flags.${MODULE_ID}.name`]: val });
          this.render();
        } else if (act === "delete") {
          const ok = await Dialog.confirm({ title: "Delete Territory", content: "<p>Delete this territory hex?</p>" });
          if (ok) { await d.delete(); this.render(); }
        }
      });
    });
  }
}

/* ----------------------------------------------------
 * API
 ---------------------------------------------------- */
const API = {
  openDashboard(tab = "dashboard") {
    L.i("Dashboard clicked");
    if (!API._dash || API._dash.rendered === false) API._dash = new TerritoryDashboard();
    API._dash.setActiveTab(tab);
    API._dash.render(true);
  },

  async createHex(opts = {}) {
    const scene = canvas?.scene;
    if (!scene) return ui?.notifications?.warn("Open a scene first.");

    const radius = Number.isFinite(opts.radius) ? opts.radius : 140;
    const fillColor = opts.fillColor ?? "#00ffff";
    const strokeColor = opts.strokeColor ?? "#ff00ff";
    const strokeWidth = opts.strokeWidth ?? 4;
    const fillAlpha = Number.isFinite(opts.fillAlpha) ? opts.fillAlpha : 0.25;

    const h = Math.sqrt(3) * radius;
    const pts = [
      radius/2, 0, 1.5*radius, 0, 2*radius, h/2, 1.5*radius, h, radius/2, h, 0, h/2
    ];
    const cx = Math.round((scene.width ?? 0) / 2);
    const cy = Math.round((scene.height ?? 0) / 2);
    const x = cx - radius;
    const y = cy - h/2;

    try {
      const [created] = await scene.createEmbeddedDocuments("Drawing", [{
        x, y,
        shape: { type: "p", points: pts },
        fillType: 1,
        fillColor, fillAlpha,
        strokeColor, strokeAlpha: 1, strokeWidth,
        rotation: 0, locked: false, hidden: false, sort: 1001,
        flags: { [MODULE_ID]: { isTerritory: true, radius } }
      }]);
      if (created) { ui?.notifications?.info("Hex created."); L.i("Hex Drawing created:", created); }
    } catch (err) {
      L.e("Failed to create hex:", err);
      ui?.notifications?.error("Failed to create hex (see console).");
    }
  },

  async claim() {
    L.i("Claim clicked");
    API.openDashboard("claim");
  }
};

/* ----------------------------------------------------
 * Toolbar injection (object-map and array signatures)
 ---------------------------------------------------- */
function toolsArray() {
  return [
    { name: "bbttcc-dashboard",  title: "Territory Dashboard",  icon: "fa-solid fa-hexagon",     button: true, onChange: () => API.openDashboard("dashboard") },
    { name: "bbttcc-create-hex", title: "Create Territory Hex", icon: "fa-solid fa-draw-polygon", button: true, onChange: () => API.createHex({ radius: 140 }) },
    { name: "bbttcc-claim",      title: "Claim Territory",      icon: "fa-solid fa-flag",         button: true, onChange: () => API.claim() }
  ];
}
function toolsObject() {
  return {
    "bbttcc-dashboard":  { name: "bbttcc-dashboard",  title: "Territory Dashboard",  icon: "fa-solid fa-hexagon",     button: true, onChange: () => API.openDashboard("dashboard") },
    "bbttcc-create-hex": { name: "bbttcc-create-hex", title: "Create Territory Hex", icon: "fa-solid fa-draw-polygon", button: true, onChange: () => API.createHex({ radius: 140 }) },
    "bbttcc-claim":      { name: "bbttcc-claim",      title: "Claim Territory",      icon: "fa-solid fa-flag",         button: true, onChange: () => API.claim() }
  };
}

Hooks.on("getSceneControlButtons", (controls) => {
  try {
    // Newer object-map form
    if (controls && !Array.isArray(controls) && typeof controls === "object") {
      let drawings = controls.drawings || controls.Drawings || null;
      if (!drawings) {
        drawings = Object.values(controls).find(g =>
          g && typeof g === "object" &&
          (g.name === "drawings" || g.layer === "drawings" || /draw/i.test(g.title ?? ""))
        ) || null;
      }
      if (drawings) {
        if (Array.isArray(drawings.tools)) { drawings.tools.push(...toolsArray()); return; }
        if (drawings.tools && typeof drawings.tools === "object") { Object.assign(drawings.tools, toolsObject()); return; }
        drawings.tools = toolsArray(); return;
      }
      // Fallback: separate group
      controls.bbttccTerritory = { name: "bbttccTerritory", title: "Territory", icon: "fa-solid fa-hexagon", tools: toolsArray() };
      return;
    }
    // Classic array form
    if (Array.isArray(controls)) {
      if (controls.some(g => g?.name === "bbttccTerritory")) return;
      controls.push({ name: "bbttccTerritory", title: "Territory", icon: "fa-solid fa-hexagon", tools: toolsArray() });
      return;
    }
  } catch (err) { L.e("Toolbar injection failed:", err); }
});

/* ----------------------------------------------------
 * Hooks / API
 ---------------------------------------------------- */
Hooks.once("init", () => {
  L.i("init");
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = API;
});
Hooks.once("ready", () => { L.i("ready"); setTimeout(() => ui.controls?.render(true), 0); });

// Quick console access
globalThis[MODULE_ID] = { api: API };
// modules/bbttcc-territory/apps/dashboard-app.js
const MOD = "bbttcc-territory";
const NS  = "[bbttcc-territory]";
const log  = (...a) => console.log(NS, ...a);
const warn = (...a) => console.warn(NS, ...a);

/* ---------- helpers ---------- */
function isHexDrawing(dr) {
  const f = dr?.flags?.[MOD] ?? {};
  return f.isHex === true || f.kind === "territory-hex";
}

function buildOwnerList() {
  const out = [];
  for (const a of game.actors?.contents ?? []) {
    const isFaction =
      a.getFlag?.("bbttcc-factions", "isFaction") === true ||
      String(a.system?.details?.type?.value ?? "").toLowerCase() === "faction";
    if (!isFaction) continue;
    out.push({ id: a.id, name: a.name });
  }
  out.sort((A,B)=>A.name.localeCompare(B.name));
  return out;
}

function asDate(ts) {
  try { return ts ? new Date(ts).toLocaleString() : ""; } catch { return ""; }
}

function clampProgress(v) {
  v = Number.isFinite(v) ? Number(v) : 0;
  if (v < 0) v = 0;
  if (v > 6) v = 6;
  return Math.round(v);
}

function stageKeyFromProgress(progress) {
  const p = clampProgress(progress);
  if (p >= 6) return "integrated";
  if (p === 5) return "settled";
  if (p >= 3) return "developing";
  if (p >= 1) return "outpost";
  return "wild";
}

function stageLabelFromKey(key) {
  const map = {
    wild: "Untouched Wilderness",
    outpost: "Foothold / Outpost",
    developing: "Developing Territory",
    settled: "Settled Province",
    integrated: "Integrated Heartland"
  };
  return map[key] || "—";
}

/* ---------- toast + scroll utilities ---------- */
function ensureToastStyles() {
  if (document.getElementById("bbttcc-toast-style")) return;
  const css = `
  .bbttcc-saved-toast {
    position: absolute; inset: 12px auto auto 12px;
    z-index: 9999; padding: 6px 10px; border-radius: 8px;
    background: rgba(60,200,120,.92); color: #fff; font-weight: 700;
    box-shadow: 0 6px 14px rgba(0,0,0,.25); pointer-events: none;
    opacity: 0; transform: translateY(-4px); transition: opacity .15s ease, transform .15s ease;
  }
  .bbttcc-saved-toast.show { opacity: 1; transform: translateY(0); }
  `;
  const style = document.createElement("style");
  style.id = "bbttcc-toast-style";
  style.textContent = css;
  document.head.appendChild(style);
}

function findScroller(root) {
  return root?.querySelector?.(".window-content") || root;
}

/* ---------- AppV2 (Handlebars parts) ---------- */
export class BBTTCC_TerritoryDashboard extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {

  // IMPORTANT: do NOT mutate super.DEFAULT_OPTIONS (shared). mergeObject is in-place by default.
  // If we mutate the shared object, other ApplicationV2 subclasses can "inherit" the wrong id/title/template,
  // which presents as window chrome/content mismatches.
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(
    foundry.utils.deepClone(super.DEFAULT_OPTIONS || {}),
    {
    id: "bbttcc-territory-dashboard",
    classes: ["bbttcc","bbttcc-territory-dashboard"],
    position: { width: 1200, height: 600 },
    window: {
      title: "BBTTCC Territory Dashboard",
      resizable: true,
      // Your Foundry build expects these:
      controls: [],
      icon: ""
    }
    },
    { inplace: false }
  );

  static PARTS = {
    body: { template: `modules/${MOD}/templates/territory-dashboard.hbs` }
  };

  constructor(options={}) {
    super(options);

    // Normalize window options (protect against upstream mutations)
    try {
      this.options.window ??= {};
      if (!Array.isArray(this.options.window.controls)) this.options.window.controls = [];
      if (this.options.window.icon == null) this.options.window.icon = "";
    } catch (_) {}

    this._abort = null;
    this._bbttccScrollTop = 0;
  }

  async _preparePartContext(partId, context) {
    if (partId !== "body") return context;

    const scene = canvas?.scene;
    const ownerList = buildOwnerList();
    const rows = [];
    let adoptionCount = 0;

    for (const dr of scene?.drawings?.contents ?? []) {
      if (!isHexDrawing(dr) && dr.shape?.type === "p" && (dr.shape?.points?.length === 12)) adoptionCount++;
      if (!isHexDrawing(dr)) continue;

      const f = dr.flags?.[MOD] ?? {};

      const integ = f.integration ?? {};
      const rawProg = Number.isFinite(integ.progress) ? integ.progress : 0;
      const integrationProgress = clampProgress(rawProg);
      const integrationStageKey = stageKeyFromProgress(integrationProgress);
      const integrationStageLabel = stageLabelFromKey(integrationStageKey);

      let status = f.status ?? "unclaimed";
      if (status === "claimed") status = "occupied";

      rows.push({
        id: dr.id,
        uuid: dr.uuid,
        name: f.name ?? dr.text ?? "",
        ownerId: f.factionId ?? "",
        status,
        type: f.type ?? "wilderness",
        size: f.size ?? "outpost",
        population: f.population ?? "uninhabited",
        capital: !!f.capital,
        resources: {
          food:       Number(f.resources?.food ?? 0),
          materials:  Number(f.resources?.materials ?? 0),
          trade:      Number(f.resources?.trade ?? 0),
          military:   Number(f.resources?.military ?? 0),
          knowledge:  Number(f.resources?.knowledge ?? 0),
        },
        integrationProgress,
        integrationMax: 6,
        integrationStageKey,
        integrationStageLabel,
        x: Math.round(dr.x), y: Math.round(dr.y),
        createdAt: asDate(f.createdAt ?? 0)
      });
    }

    rows.sort((a,b)=> (a.name||"").localeCompare(b.name||""));
    return { sceneName: scene?.name ?? "—", ownerList, rows, adoptionCount };
  }

  _rememberScroll(root) {
    try { this._bbttccScrollTop = findScroller(root)?.scrollTop ?? 0; } catch {}
  }

  _restoreScroll(root) {
    try {
      const sc = findScroller(root);
      if (sc && typeof this._bbttccScrollTop === "number") sc.scrollTop = this._bbttccScrollTop;
    } catch {}
  }

  _showSavedToast(root) {
    try {
      ensureToastStyles();
      const host = root.querySelector?.(".window-content") || root;
      host.querySelector?.(".bbttcc-saved-toast")?.remove?.();
      const div = document.createElement("div");
      div.className = "bbttcc-saved-toast";
      div.textContent = "✓ Saved";
      host.appendChild(div);
      requestAnimationFrame(()=> div.classList.add("show"));
      setTimeout(()=> div.classList.remove("show"), 700);
      setTimeout(()=> div.remove(), 900);
    } catch {}
  }

  async _onRender(ctx, opts) {
    await super._onRender(ctx, opts);

    // AppV2 truth: bind to this.form
    const root = (this.form instanceof HTMLElement)
      ? this.form
      : document.querySelector("#bbttcc-territory-dashboard");
    if (!root) return;

    this._restoreScroll(root);

    if (this._abort) { try { this._abort.abort(); } catch {} }
    this._abort = new AbortController();
    const sig = this._abort.signal;

    const act = (ev, name) => ev.target?.closest?.(`[data-action="${name}"]`);

    root.addEventListener("click", (ev) => {
      const btn = act(ev, "refresh");
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();
      this._rememberScroll(root);
      this.render({ force:true, focus:false });
    }, { capture:true, signal:sig });

    root.addEventListener("click", async (ev) => {
      const btn = act(ev, "adopt-hexes");
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();

      this._rememberScroll(root);

      const scene = canvas?.scene;
      const updates = [];
      for (const dr of scene?.drawings?.contents ?? []) {
        if (isHexDrawing(dr)) continue;
        if (dr.shape?.type !== "p" || (dr.shape?.points?.length ?? 0) !== 12) continue;
        updates.push({
          _id: dr.id,
          [`flags.${MOD}.isHex`]: true,
          [`flags.${MOD}.kind`]: "territory-hex",
          [`flags.${MOD}.name`]: dr.text || "Hex",
          [`flags.${MOD}.status`]: "unclaimed",
          [`flags.${MOD}.type`]: "wilderness",
          [`flags.${MOD}.size`]: "outpost",
          [`flags.${MOD}.population`]: "uninhabited",
          [`flags.${MOD}.capital`]: false,
          [`flags.${MOD}.resources`]: { food:0, materials:0, trade:0, military:0, knowledge:0 },
          [`flags.${MOD}.createdAt`]: Date.now()
        });
      }
      if (updates.length) await scene.updateEmbeddedDocuments("Drawing", updates);
      this.render({ force:true, focus:false });
    }, { capture:true, signal:sig });

    root.addEventListener("click", async (ev) => {
      const btn = act(ev, "focus");
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();
      try {
        const dr = btn.dataset.uuid ? await fromUuid(btn.dataset.uuid) : canvas?.scene?.drawings?.get(btn.dataset.id);
        if (!dr) return;
        const { x, y, width, height } = dr;
        await canvas.animatePan({ x: x + Math.max(width,1)/2, y: y + Math.max(height,1)/2, scale: 1.25 });
      } catch (e) { warn("Focus failed", e); }
    }, { capture:true, signal:sig });

    root.addEventListener("click", async (ev) => {
      const btn = act(ev, "edit");
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();
      const uuid = btn.dataset.uuid;
  // GM helper: always log the UUID when opening the Hex Editor (restores older debugging convenience)
      try {
        log("edit hex uuid =", uuid);
        let gmEdit = false;
        try { gmEdit = !!game.settings.get("bbttcc-core", "gmEditMode"); } catch (e) { gmEdit = false; }
        if (game.user && game.user.isGM && gmEdit && ui && ui.notifications && ui.notifications.info) {
          ui.notifications.info("Hex UUID: " + uuid);
        }
      } catch (e) { /* ignore */ }

      try {
        const claim = game?.bbttcc?.api?.territory?.claim;
        if (typeof claim === "function") return void (await claim(uuid));
        const openCfg = game?.bbttcc?.api?.territory?.openHexConfig;
        if (typeof openCfg === "function") return void (await openCfg(uuid));
        ui.notifications?.warn?.("Hex Editor API is not available.");
      } catch (e) {
        warn("Edit failed", e);
        ui.notifications?.error?.("Failed to open Hex Editor.");
      }
    }, { capture:true, signal:sig });

    root.addEventListener("click", async (ev) => {
      const btn = act(ev, "delete");
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();

      const ok = await Dialog.confirm({
        title: "Delete Hex?",
        content: `<p>This will permanently remove this hex from the scene.</p>`,
        yes: () => true, no: () => false, defaultYes: false
      });
      if (!ok) return;

      this._rememberScroll(root);
      try {
        const uuid = btn.dataset.uuid;
        const dr = uuid ? await fromUuid(uuid) : canvas?.scene?.drawings?.get(btn.dataset.id);
        if (!dr) return;
        await dr.delete();
        this.render({ force:true, focus:false });
      } catch (e) { warn("Delete failed", e); }
    }, { capture:true, signal:sig });

    root.addEventListener("change", async (ev) => {
      const el = ev.target;
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return;

      const path = el.dataset.edit;
      const id = el.dataset.id;
      if (!path || !id) return;

      const scene = canvas?.scene;
      const dr = scene?.drawings?.get(id);
      const f = dr?.flags?.[MOD] ?? {};

      let value;
      if (el.type === "checkbox") value = el.checked;
      else if (el.type === "number") value = Number(el.value ?? 0);
      else value = el.value;

      const update = { _id: id, [`flags.${MOD}.${path}`]: value };

      if (path === "factionId") {
        const newOwner = String(value ?? "");
        const curStatus = f.status === "claimed" ? "occupied" : (f.status ?? "unclaimed");
        if (newOwner && curStatus === "unclaimed") update[`flags.${MOD}.status`] = "occupied";
      } else if (path === "status") {
        const newStatus = String(value ?? "unclaimed");
        const curOwner = f.factionId ?? "";
        if (newStatus === "unclaimed" && curOwner) update[`flags.${MOD}.factionId`] = "";
      }

      if (path.startsWith("resources.")) {
        const [_, key] = path.split(".");
        update[`flags.${MOD}.resources`] = {
          food:       Number(key === "food" ? value : f.resources?.food ?? 0),
          materials:  Number(key === "materials" ? value : f.resources?.materials ?? 0),
          trade:      Number(key === "trade" ? value : f.resources?.trade ?? 0),
          military:   Number(key === "military" ? value : f.resources?.military ?? 0),
          knowledge:  Number(key === "knowledge" ? value : f.resources?.knowledge ?? 0),
        };
        delete update[`flags.${MOD}.resources.${key}`];
      }

      try {
        await scene.updateEmbeddedDocuments("Drawing", [update]);
        this._showSavedToast(root);
      } catch (e) { warn("Inline edit failed", e); }
    }, { capture:true, signal:sig });
  }

  async close(options) {
    // If some legacy code cached us under __bbttcc_dashboard, clear it when we close.
    try {
      if (globalThis.__bbttcc_dashboard === this) delete globalThis.__bbttcc_dashboard;
    } catch (_) {}
    return super.close(options);
  }
}

// Export ctor globally
globalThis.BBTTCC_TerritoryDashboardCtor = BBTTCC_TerritoryDashboard;

/* ---------------------------------------------------------------------------
   Legacy-safe opener bridge (NO recursion)
   - Captures any existing globalThis.__bbttcc_dashboard ONCE before defining getter.
   - Getter never references itself; it only returns canonical app instance.
--------------------------------------------------------------------------- */
Hooks.once("ready", () => {
  game.bbttcc = game.bbttcc || {};
  game.bbttcc.apps = game.bbttcc.apps || {};

  // Live refresh: if a hex is edited via GM panel / API, re-render dashboard so values update.
  Hooks.on("bbttcc:territory:hexUpdated", (_payload) => {
    try {
      const app = game?.bbttcc?.apps?.territoryDashboard;
      if (app && typeof app.render === "function") app.render({ force: true, focus: false });
    } catch (e) {}
  });

  // Capture any legacy singleton BEFORE we install the getter.
  let legacyDash = null;
  try {
    // Only capture if it's a real value property (not our accessor).
    const desc = Object.getOwnPropertyDescriptor(globalThis, "__bbttcc_dashboard");
    if (desc && "value" in desc) {
      legacyDash = desc.value;
      // Remove it so our accessor can be installed cleanly.
      delete globalThis.__bbttcc_dashboard;
    }
  } catch (e) {
    console.warn(NS, "Legacy dashboard capture failed", e);
  }

  const isValidDash = (x) => x && x.constructor && x.constructor.name === "BBTTCC_TerritoryDashboard";

  const makeOrGet = () => {
    // Canonical cache first
    let app = game.bbttcc.apps.territoryDashboard;

    // If canonical missing, allow the one-time captured legacy instance
    if (!app && isValidDash(legacyDash)) {
      app = legacyDash;
      game.bbttcc.apps.territoryDashboard = app;
      legacyDash = null; // consume it
    }

    // If missing or closed, recreate
    if (!app || app._state === 0 || app.rendered === false) {
      app = new BBTTCC_TerritoryDashboard();
      game.bbttcc.apps.territoryDashboard = app;
    }

    return app;
  };

  globalThis.BBTTCC_OpenTerritoryDashboard = () => {
    const app = makeOrGet();
    app.render({ force: true, focus: true });
    return app;
  };

  // Install accessor that never self-recurses.
  try {
    Object.defineProperty(globalThis, "__bbttcc_dashboard", {
      configurable: true,
      get() { return makeOrGet(); },
      set(v) {
        if (isValidDash(v)) {
          game.bbttcc.apps.territoryDashboard = v;
          legacyDash = null;
        } else {
          // Ignore bad assigns instead of poisoning the cache
          legacyDash = null;
        }
      }
    });
  } catch (e) {
    console.warn(NS, "Could not define legacy __bbttcc_dashboard bridge", e);
  }
});

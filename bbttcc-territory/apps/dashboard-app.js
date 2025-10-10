// modules/bbttcc-territory/apps/dashboard-app.js
const MOD = "bbttcc-territory";
const log  = (...a) => console.log(`[${MOD}]`, ...a);
const warn = (...a) => console.warn(`[${MOD}]`, ...a);

class BBTTCC_TerritoryDashboard extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-territory-dashboard",
    title: "BBTTCC Territory",
    width: 1100,
    height: 700,
    resizable: true,
    classes: ["bbttcc", "bbttcc-territory"]
  };

  static PARTS = {
    body: { template: `modules/${MOD}/templates/territory-dashboard.hbs` }
  };

  async _preparePartContext(partId, context) {
    if (partId !== "body") return context;

    const scene = canvas?.scene;
    const drawings = scene?.drawings?.contents ?? [];

    // Factions owner list (display)
    const ownerList = (game.actors?.contents ?? [])
      .filter(a =>
        a.getFlag?.("bbttcc-factions","isFaction") === true ||
        String(a.system?.details?.type?.value ?? "").toLowerCase() === "faction"
      )
      .map(a => ({ id: a.id, name: a.name }))
      .sort((A,B)=>A.name.localeCompare(B.name));

    const rows = drawings
      .map(d => ({ d, f: d.flags?.[MOD] ?? {} }))
      .filter(({f}) => f.isHex === true || f.kind === "territory-hex")
      .map(({d,f}) => ({
        id: d.id, uuid: d.uuid,
        name: f.name || d.text || "",
        ownerId: f.factionId ?? "",
        status: f.status ?? "unclaimed",
        type: f.type ?? "settlement",
        size: f.size ?? "standard",
        population: f.population ?? "medium",
        capital: !!f.capital,
        resources: {
          food:       Number(f.resources?.food ?? 0),
          materials:  Number(f.resources?.materials ?? 0),
          trade:      Number(f.resources?.trade ?? 0),
          military:   Number(f.resources?.military ?? 0),
          knowledge:  Number(f.resources?.knowledge ?? 0)
        },
        x: Math.round(d.x),
        y: Math.round(d.y),
        createdAt: f.createdAt ? new Date(f.createdAt).toLocaleString() : "",
        ownerList
      }));

    try { const t = game?.i18n?.localize?.("BBTTCC.Dashboard.Title"); if (t) this.options.title = t; } catch {}
    return { sceneName: scene?.name ?? "(No Scene)", rows, ownerList, adoptionCount: 0 };
  }

  async _onRender(ctx, opts) {
    await super._onRender(ctx, opts);
    const root = this.element;
    if (!(root instanceof HTMLElement)) return;

    // Abort any previously-registered listeners so clicks don’t stack
    if (this._evAbort) {
      try { this._evAbort.abort(); } catch {}
    }
    this._evAbort = new AbortController();
    const sig = this._evAbort.signal;

    const suppressed = () => globalThis.bbttcc_territory_isSuppressed?.() === true;

    // Refresh
    root.addEventListener("mousedown", (ev) => {
      if (ev.target.closest?.('[data-action="refresh"]') && suppressed()) ev.stopPropagation();
    }, { capture: true, signal: sig });
    root.addEventListener("click", (ev) => {
      if (!ev.target.closest?.('[data-action="refresh"]')) return;
      if (suppressed()) return;
      ev.preventDefault(); this.render(true);
    }, { capture: true, signal: sig });

    // Focus
    root.addEventListener("mousedown", (ev) => {
      if (ev.target.closest?.('[data-action="focus"]') && suppressed()) ev.stopPropagation();
    }, { capture: true, signal: sig });
    root.addEventListener("click", async (ev) => {
      const btn = ev.target.closest?.('[data-action="focus"]'); if (!btn) return;
      if (suppressed()) return;
      ev.preventDefault();
      const id = btn.getAttribute("data-id");
      const dr = canvas?.drawings?.get(id);
      if (!dr) return ui.notifications?.warn?.("Hex drawing not found.");
      try { await game.bbttcc?.api?.territory?.focusHex?.(dr); }
      catch (e) { warn("focusHex failed", e); }
    }, { capture: true, signal: sig });

    // Edit (open Hex Config)
    root.addEventListener("mousedown", (ev) => {
      if (ev.target.closest?.('[data-action="edit"]') && suppressed()) ev.stopPropagation();
    }, { capture: true, signal: sig });
    root.addEventListener("click", async (ev) => {
      const btn = ev.target.closest?.('[data-action="edit"]'); if (!btn) return;
      if (suppressed()) return;                 // respect suppression from Save/Cancel
      ev.preventDefault();
      const uuid = btn.getAttribute("data-uuid"); if (!uuid) return;
      try { await game.bbttcc?.api?.territory?.openHexConfig?.(uuid); }
      catch (e) { warn("openHexConfig failed", e); }
    }, { capture: true, signal: sig });

    // Inline edits
    const onInline = (el) => this._onInlineEdit(el);
    root.addEventListener("change", (ev) => {
      const el = ev.target;
      if (!el.matches?.("[data-edit]")) return;
      onInline(el);
    }, { capture: true, signal: sig });
    root.addEventListener("click", (ev) => {
      const el = ev.target.closest?.('input[type="checkbox"][data-edit]');
      if (!el) return;
      onInline(el);
    }, { capture: true, signal: sig });

    this._bindLiveRefresh();
  }

  _bindLiveRefresh() {
    if (this._liveBound) return;
    this._liveBound = true;

    this._onCreate = () => this.render(true);
    this._onUpdate = () => this.render(true);
    this._onDelete = () => this.render(true);

    Hooks.on("createDrawing", this._onCreate);
    Hooks.on("updateDrawing", this._onUpdate);
    Hooks.on("deleteDrawing", this._onDelete);
  }

  async close(options) {
    // Abort listeners tied to this render cycle
    if (this._evAbort) {
      try { this._evAbort.abort(); } catch {}
      this._evAbort = null;
    }
    if (this._liveBound) {
      Hooks.off("createDrawing", this._onCreate);
      Hooks.off("updateDrawing", this._onUpdate);
      Hooks.off("deleteDrawing", this._onDelete);
      this._liveBound = false;
    }
    return super.close(options);
  }

  async _onInlineEdit(el) {
    const id  = el.getAttribute("data-id");
    const key = el.getAttribute("data-edit");
    if (!id || !key) return;

    let value;
    if (el.type === "checkbox") value = el.checked;
    else if (el.type === "number") value = Number(el.value ?? 0);
    else value = el.value;

    const patch = { _id: id };
    foundry.utils.mergeObject(
      patch,
      foundry.utils.expandObject({ [`flags.${MOD}.${key}`]: value }),
      { inplace: true }
    );

    if (key === "name") patch.text = String(value || "Hex");

    try {
      await canvas.scene.updateEmbeddedDocuments("Drawing", [patch]);
      if (key === "factionId") {
        const owner = game.actors?.get(value);
        await canvas.scene.updateEmbeddedDocuments("Drawing", [{
          _id: id, [`flags.${MOD}.faction`]: owner?.name ?? ""
        }]);
      }
      this.render(true);
    } catch (e) {
      warn("Inline edit failed", key, e);
      ui.notifications?.error?.("Could not save that change (see console).");
    }
  }
}

// publish ctor for openers
globalThis.BBTTCC_TerritoryDashboardCtor = BBTTCC_TerritoryDashboard;
export { BBTTCC_TerritoryDashboard };

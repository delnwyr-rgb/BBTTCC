// bbttcc-territory/apps/territory-dashboard.js
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class TerritoryDashboard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DASHBOARD_ID = "bbttcc-territory-dashboard";

  static DEFAULT_OPTIONS = {
    id: TerritoryDashboard.DASHBOARD_ID,
    window: {
      title: "BBTTCC Territory",
      icon: "fa-solid fa-hexagon",
      resizable: true
    },
    position: { width: 560, height: "auto" },
    classes: ["bbttcc", "bbttcc-territory-dashboard"],
    tag: "form" // so we can catch submit events easily if we want
  };

  /** Simple singleton window helper */
  static show({ tab = "dashboard" } = {}) {
    if (!this.#instance || this.#instance.rendered === false) {
      this.#instance = new this();
    }
    this.#instance._activeTab = tab;
    this.#instance.render(true);
    return this.#instance;
  }
  static #instance;

  get template() {
    return `modules/bbttcc-territory/templates/territory-dashboard.hbs`;
  }

  /** Data for template */
  async _prepareContext() {
    // Count existing territory hexes we’ve drawn (flagged)
    const scene = canvas?.scene;
    const hexes = scene?.drawings?.filter(d => getProperty(d, `flags.bbttcc-territory.kind`) === "territory-hex") ?? [];
    return {
      activeTab: this._activeTab ?? "dashboard",
      sceneName: scene?.name ?? "—",
      hexCount: hexes.length,
      sampleRadius: 140
    };
  }

  /** Wire UI events */
  _onRenderInner(_data, html) {
    // Tab switching
    html.querySelectorAll("[data-tab]").forEach(el => {
      el.addEventListener("click", ev => {
        ev.preventDefault();
        this._activeTab = el.dataset.tab;
        this.render(); // re-render with new activeTab
      });
    });

    // Create hex action
    const createBtn = html.querySelector("[data-action='create-hex']");
    if (createBtn) {
      createBtn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const radius = Number(html.querySelector("input[name='hexRadius']")?.value ?? 140);
        await game.modules.get("bbttcc-territory")?.api?.createHex({ radius });
        this.render(); // refresh counts
      });
    }

    // Claim action (placeholder hook for now)
    const claimBtn = html.querySelector("[data-action='claim']");
    if (claimBtn) {
      claimBtn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ui.notifications?.info("Claim flow will go here ✨");
      });
    }
  }
}
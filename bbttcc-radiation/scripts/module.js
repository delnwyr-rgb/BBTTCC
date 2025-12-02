// =========================================================================
// == BBTTCC Radiation - CONSOLIDATED MODULE (Overlay + Mutations Section)
// =========================================================================

console.log("🏁 BBTTCC Radiation | Module loading…");

// --- Tracker & Zone UI placeholders (can be fleshed out later) -------------
class RadiationTracker extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "bbttcc-radiation-tracker",
      title: "Radiation Tracker",
      width: 500
    });
  }
}

class RadiationZoneConfig extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "bbttcc-radiation-zone-config",
      title: "Radiation Zone Configuration",
      width: 600
    });
  }
}

// --- Main Module Logic ------------------------------------------------------
class BBTTCCRadiationModule {
  static MODULE_ID = "bbttcc-radiation";
  static TAB_ID    = "bbttcc-radiation";

  // init-phase setup
  static initialize() {
    console.log(`[${this.MODULE_ID}] | Initializing.`);
    this.registerSettings();
    this.exposeAPI();
  }

  // ready-phase setup (needs game + sheets)
  static ready() {
    this.registerActorSheetHooks();
  }

  static registerSettings() {
    game.settings.register(this.MODULE_ID, "enableAutomaticTracking", {
      name: "Enable Automatic Radiation Tracking",
      scope: "world",
      config: true,
      type: Boolean,
      default: true
    });
    console.log(`[${this.MODULE_ID}] | Settings registered.`);
  }

  static exposeAPI() {
    const api = {
      openRadiationTracker: (token) => new RadiationTracker(token).render(true)
    };
    const mod = game.modules.get(this.MODULE_ID);
    if (mod) {
      mod.api = api;
      console.log(`[${this.MODULE_ID}] | API exposed.`, api);
    } else {
      console.warn(`[${this.MODULE_ID}] | Module not found when exposing API.`);
    }
  }

  // -------------------------------------------------------------------------
  // Actor Sheet Integration (PCs + NPCs, non-faction)
  // -------------------------------------------------------------------------
  static registerActorSheetHooks() {
    const handler = (app, html, data) =>
      BBTTCCRadiationModule.onRenderActorSheet(app, html, data);

    Hooks.on("renderActorSheet", handler);
    Hooks.on("renderActorSheet5eCharacter", handler);
    Hooks.on("renderCharacterActorSheet", handler);

    console.log(
      `[${this.MODULE_ID}] | Actor sheet Radiation overlay hooks registered.`
    );
  }

  static _getRadAPI() {
    return game.bbttcc?.api?.radiation || null;
  }

  static _getMutAPI() {
    return game.bbttcc?.api?.radiation?.mutations || null;
  }

  static _buildOverlayHTML(actor, rp, lvl, mutations) {
    const lvlName  = lvl?.name ?? "Unknown";
    const lvlKey   = lvl?.key ?? "safe";
    const actorLbl = actor.type === "character" ? "Player Character" : "NPC";

    const mutItems = (mutations || []).map(m => {
      const tierLabel = m.tier
        ? m.tier.charAt(0).toUpperCase() + m.tier.slice(1)
        : "Unknown";
      const desc  = foundry.utils.escapeHTML(m.description || "");
      const name  = foundry.utils.escapeHTML(m.name || "Mutation");
      const src   = foundry.utils.escapeHTML(m.source || "radiation");
      const rpStr = m.rpAtTrigger != null ? ` (RP ${m.rpAtTrigger})` : "";
      return `
        <li class="effect-item">
          <i class="fas fa-biohazard"></i>
          <div>
            <strong>[${tierLabel}] ${name}</strong><br/>
            <span style="font-size:0.9em;">${desc}</span><br/>
            <span style="font-size:0.8em; opacity:0.8;">Source: ${src}${rpStr}</span>
          </div>
        </li>
      `;
    }).join("");

    const mutSection = mutations && mutations.length
      ? `
          <ul class="effect-list">
            ${mutItems}
          </ul>
        `
      : `
          <div class="effect-description">
            <p>
              No mutations recorded yet. When this character crosses dangerous
              radiation thresholds or travels through storm-wracked zones,
              mutation events will appear here as narrative tags.
            </p>
          </div>
        `;

    return `
      <div class="bbttcc-radiation-overlay" data-bbttcc-radiation-overlay style="display:none;">
        <section class="bbttcc-radiation-tracker">
          <header class="token-header">
            <div class="token-info">
              <h3>${foundry.utils.escapeHTML(actor.name)}</h3>
              <div class="actor-type">${actorLbl}</div>
            </div>
            <div class="radiation-status">
              <div class="level-indicator level-${lvlKey}">
                <i class="fas fa-radiation"></i>
                <span>${lvlName}</span>
              </div>
              <div class="level-percentage">
                Current RP: <strong>${rp}</strong>
              </div>
            </div>
          </header>

          <section class="status-section">
            <h4>Radiation Status</h4>
            <div class="status-grid">
              <div class="status-item">
                <label>Current RP</label>
                <div class="status-value ${lvlKey}">${rp}</div>
              </div>
              <div class="status-item">
                <label>Level</label>
                <div class="status-value ${lvlKey}">${lvlName}</div>
              </div>
            </div>
            <p class="hint">
              Radiation is both physical and spiritual fallout from the world's Darkness.
              It rises when this character travels through Radiated or Wasteland hexes,
              survives hazards, or handles corrupted artifacts. At higher levels,
              mutation checks are triggered.
            </p>
          </section>

          <section class="controls-section">
            <h4>Adjust Radiation</h4>
            <div class="control-group">
              <label>Quick Adjust</label>
              <div class="exposure-controls">
                <button type="button" class="exposure-adjust minor" data-rad-delta="-10">−10</button>
                <button type="button" class="exposure-adjust minor" data-rad-delta="-5">−5</button>
                <button type="button" class="exposure-adjust minor" data-rad-delta="-1">−1</button>
                <button type="button" class="exposure-adjust moderate" data-rad-delta="1">+1</button>
                <button type="button" class="exposure-adjust moderate" data-rad-delta="5">+5</button>
                <button type="button" class="exposure-adjust severe" data-rad-delta="10">+10</button>
              </div>
            </div>

            <div class="control-group">
              <label>Set Exact Value</label>
              <div class="exposure-controls">
                <input type="number" name="bbttcc-radiation-set" min="0" step="1" style="max-width:80px;">
                <button type="button" class="apply-button" data-rad-set>Set RP</button>
                <button type="button" class="reset-button" data-rad-clear>Clear (0 RP)</button>
              </div>
            </div>
          </section>

          <section class="info-section">
            <h4>Thresholds &amp; Effects</h4>
            <div class="info-content">
              <ul class="info-list">
                <li><strong>0–10 RP (Safe):</strong> Background exposure; no major effects.</li>
                <li><strong>11–25 RP (Low):</strong> Mild fatigue and spiritual static.</li>
                <li><strong>26–50 RP (Moderate):</strong> Noticeable strain; risky extended ops.</li>
                <li><strong>51+ RP (High+):</strong> Mutation events begin; Darkness presses in.</li>
              </ul>
              <p class="hint">
                Exact mutation tables and mechanical effects can be added later. For now,
                mutations are narrative tags that respond to how the faction engages with
                the world.
              </p>
            </div>
          </section>

          <section class="effects-section">
            <h4>Mutations</h4>
            ${mutSection}
          </section>
        </section>
      </div>
    `;
  }

  static onRenderActorSheet(app, html, data) {
    try {
      const actor = app.actor;
      if (!actor) return;

      const type = actor.type;
      if (!(type === "character" || type === "npc")) return;

      // Skip faction actors
      if (actor.getFlag && actor.getFlag("bbttcc-factions", "isFaction")) return;

      const radApi = this._getRadAPI();
      if (!radApi || typeof radApi.get !== "function") return;

      const $html = html instanceof jQuery ? html : $(html);

      // Find primary tab nav
      let nav = $html.find(".sheet-tabs[data-group='primary']").first();
      if (!nav.length) nav = $html.find(".tabs[data-group='primary']").first();
      if (!nav.length) return;

      // Find window-content, like Tikkun
      const content = $html.find(".window-content").first();
      if (!content.length) return;

      const domContent = content[0];
      const style = getComputedStyle(domContent);
      if (style.position === "static") domContent.style.position = "relative";

      // Remove existing overlay + nav item (idempotent)
      content.find("[data-bbttcc-radiation-overlay]").remove();
      nav.find(`a.item[data-tab='${this.TAB_ID}']`).remove();

      // Nav button (right after Tikkun if present)
      const label  = "Radiation";
      const radBtn = $(
        `<a class="item" data-tab="${this.TAB_ID}"><i class="fas fa-radiation"></i> ${label}</a>`
      );
      const tikBtn = nav.find("[data-tab='bbttcc-tikkun']").last();
      if (tikBtn.length) tikBtn.after(radBtn);
      else nav.append(radBtn);

      // Read current RP + level
      const rp  = radApi.get(actor);
      const lvl = typeof radApi.levelFor === "function"
        ? radApi.levelFor(rp)
        : { name: "Unknown", key: "safe" };

      // Mutations via API if available
      const mutApi = this._getMutAPI();
      const muts = mutApi && typeof mutApi.list === "function"
        ? mutApi.list(actor.id)
        : (actor.getFlag("bbttcc-radiation", "mutations") || []);

      const overlayHTML = this._buildOverlayHTML(actor, rp, lvl, muts);
      const overlay = $(overlayHTML);
      content.append(overlay);

      const actorId = actor.id;

      // Wire controls
      overlay.on("click", "[data-rad-delta]", async (ev) => {
        ev.preventDefault();
        const delta = Number(ev.currentTarget.dataset.radDelta || 0);
        try {
          await radApi.add(actorId, delta);
          app.render(false);
        } catch (e) {
          console.warn("[bbttcc-radiation] delta adjust failed:", e);
          ui.notifications?.error?.("Failed to adjust Radiation (see console).");
        }
      });

      overlay.on("click", "[data-rad-set]", async (ev) => {
        ev.preventDefault();
        const input = overlay.find("input[name='bbttcc-radiation-set']");
        const val = Number(input.val() || 0);
        if (!Number.isFinite(val) || val < 0) {
          ui.notifications?.warn?.("Enter a non-negative number for RP.");
          return;
        }
        try {
          await radApi.set(actorId, val);
          app.render(false);
        } catch (e) {
          console.warn("[bbttcc-radiation] set value failed:", e);
          ui.notifications?.error?.("Failed to set Radiation (see console).");
        }
      });

      overlay.on("click", "[data-rad-clear]", async (ev) => {
        ev.preventDefault();
        try {
          await radApi.set(actorId, 0);
          app.render(false);
        } catch (e) {
          console.warn("[bbttcc-radiation] clear failed:", e);
          ui.notifications?.error?.("Failed to clear Radiation (see console).");
        }
      });

      // Nav click handler: show/hide overlay like Tikkun
      nav.off("click.bbttcc-radiation");
      nav.on("click.bbttcc-radiation", "a.item[data-tab]", (ev) => {
        const clickedTab = ev.currentTarget.dataset.tab;
        const isRad = clickedTab === this.TAB_ID;
        if (isRad) overlay.show();
        else overlay.hide();
      });

      console.log(
        `[${this.MODULE_ID}] | Radiation overlay injected for`,
        actor.name,
        "via",
        app.constructor?.name
      );
    } catch (err) {
      console.warn("[bbttcc-radiation] onRenderActorSheet failed:", err);
    }
  }
}

// ---- Hook registration ------------------------------------------------------
Hooks.once("init", () => {
  BBTTCCRadiationModule.initialize();
});

Hooks.once("ready", () => {
  BBTTCCRadiationModule.ready();
});

export { BBTTCCRadiationModule };

// modules/bbttcc-tikkun/scripts/tikkun-sheet.enhancer.js
// BBTTCC — Tikkun Character Sheet Tab (C2, overlay mode)
//
// Adds a "Tikkun" / Great Work tab to character sheets as a full overlay.
// Uses game.bbttcc.api.tikkun.* to render the current constellation + spark statuses.
// Read-only for now; GM controls can be added later.

(() => {
  const TAG = "[bbttcc-tikkun/sheet]";
  const TAB_ID = "bbttcc-tikkun";

  function getAPI() {
    return game.bbttcc?.api?.tikkun || null;
  }

  function ensureCSS() {
    if (document.getElementById("bbttcc-tikkun-css")) return;
    const link = document.createElement("link");
    link.id = "bbttcc-tikkun-css";
    link.rel = "stylesheet";
    link.href = "modules/bbttcc-tikkun/styles/tikkun-styles.css";
    document.head.appendChild(link);
  }

  function classifySpark(s) {
    if (s.corrupted)  return { cls: "corrupted",       label: "Corrupted"   };
    if (s.integrated) return { cls: "gathered active", label: "Integrated"  };
    if (s.acquired)   return { cls: "gathered",        label: "Gathered"    };
    if (s.identified) return { cls: "identified",      label: "Identified"  };
    return              { cls: "required",            label: "Required"    };
  }

  function iconForKind(kind) {
    const k = String(kind || "").toLowerCase();
    if (k === "conceptual") return "🧠";
    if (k === "vestigial")  return "🕯️";
    if (k === "animate")    return "💫";
    return "✨";
  }

  function buildTikkunInnerHTML(actor) {
    const t = getAPI();
    const sparksMap = t?.getAllSparks?.(actor.id) || {};
    const sparksArr = Object.values(sparksMap);

    const total = sparksArr.length || 3;
    const integratedCount = sparksArr.filter(s => s.integrated).length;
    const percent = total > 0 ? Math.round((integratedCount / total) * 100) : 0;
    const statusText = `${integratedCount}/${total} Sparks Integrated`;

    let html = `
      <div class="bbttcc-tikkun-tab">
        <div class="constellation-header">
          <h2><i class="fas fa-star-of-david"></i> The Great Work</h2>
          <div class="constellation-subtitle">
            Sparks of Light, assembled across timelines and hearts.
          </div>
        </div>

        <div class="constellation-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width:${percent}%"></div>
            <div class="progress-text">${statusText}</div>
          </div>
          <div class="progress-stats">
            <div class="stat">
              <i class="fas fa-sun"></i>
              <span class="stat-value">${integratedCount}</span>
              <span class="stat-label">Integrated Sparks</span>
            </div>
            <div class="stat">
              <i class="fas fa-moon"></i>
              <span class="stat-value">${total}</span>
              <span class="stat-label">Total in Constellation</span>
            </div>
            <div class="stat">
              <i class="fas fa-balance-scale"></i>
              <span class="stat-value">${percent}%</span>
              <span class="stat-label">Completion</span>
            </div>
          </div>
        </div>

        <div class="constellation-map">
          <h3>Constellation</h3>
          <div class="spark-grid">
    `;

    if (!sparksArr.length) {
      html += `
        <div class="loading">
          No sparks recorded yet. When this character begins a Constellation,
          their Sparks of Light will appear here.
        </div>
      `;
    } else {
      for (const s of sparksArr) {
        const st = classifySpark(s);
        const kindIcon = iconForKind(s.kind);
        const statusLabel = st.label;
        const tooltip = `${s.name || s.key || "Spark"} — ${statusLabel}`;

        html += `
          <div class="spark-container">
            <div class="spark-icon ${st.cls}" data-tooltip="${tooltip}">
              <span class="spark-status-icon">
                ${statusLabel === "Integrated" ? "✅" :
                  statusLabel === "Corrupted" ? "⚠️" :
                  statusLabel === "Gathered" ? "✨" :
                  statusLabel === "Identified" ? "🔍" : "•"}
              </span>
              <span class="spark-type-icon">${kindIcon}</span>
            </div>
            <div class="spark-label">
              <strong>${foundry.utils.escapeHTML(s.name || s.key || "Spark")}</strong>
              <small>${statusLabel}</small>
            </div>
          </div>
        `;
      }
    }

    html += `
          </div>
        </div>
      </div>
    `;

    return html;
  }

  function injectTikkunTab(app, html) {
    const actor = app.actor;
    if (!actor || actor.type !== "character") return;
    const t = getAPI();
    if (!t) return;

    ensureCSS();

    const root = html[0];
    if (!root) return;

    const $html = html instanceof jQuery ? html : $(html);

    // Find tab nav
    let nav = $html.find(".sheet-tabs[data-group='primary']").first();
    if (!nav.length) nav = $html.find(".tabs[data-group='primary']").first();
    if (!nav.length) {
      console.warn(TAG, "No tab navigation found.", { ctor: app.constructor?.name });
      return;
    }

    // Find window content (wrapper we overlay)
    const content = $html.find(".window-content").first();
    if (!content.length) {
      console.warn(TAG, "No .window-content found on sheet.", { ctor: app.constructor?.name });
      return;
    }

    // Ensure window-content is positioned for absolute overlay
    const domContent = content[0];
    const style = getComputedStyle(domContent);
    if (style.position === "static") domContent.style.position = "relative";

    // Remove any existing Tikkun overlay + nav item for idempotence
    content.find("[data-bbttcc-tikkun-overlay]").remove();
    nav.find(`a.item[data-tab='${TAB_ID}']`).remove();

    const tabLabel = game.i18n?.localize?.("BBTTCC.TikkunTabLabel") || "Tikkun";

    // Add nav button (behaves like others visually; click will be handled by nav delegate)
    const tabBtn = $(`<a class="item" data-tab="${TAB_ID}">${tabLabel}</a>`);
    nav.append(tabBtn);

    // Add full overlay (hidden by default)
    const overlay = $(`
      <div class="bbttcc-tikkun-overlay" data-bbttcc-tikkun-overlay style="display:none;">
        ${buildTikkunInnerHTML(actor)}
      </div>
    `);
    content.append(overlay);

    // Nav delegated handler: show/hide overlay based on active tab
    nav.off("click.bbttcc-tikkun");
    nav.on("click.bbttcc-tikkun", "a.item[data-tab]", ev => {
      const clickedTab = ev.currentTarget.dataset.tab;
      const isTikkun   = clickedTab === TAB_ID;
      if (isTikkun) overlay.show();
      else overlay.hide();
      // Let the system's tab manager continue to do whatever it does.
    });

    console.log(TAG, "Injected Tikkun overlay tab for", actor.name, "via", app.constructor?.name);
  }

  function install() {
    const handler = (app, html, data) => {
      try { injectTikkunTab(app, html); }
      catch (e) { console.warn(TAG, "render hook failed for", app.constructor?.name, e); }
    };

    Hooks.on("renderActorSheet", handler);
    Hooks.on("renderActorSheet5eCharacter", handler);
    Hooks.on("renderCharacterActorSheet", handler);

    console.log(TAG, "Tikkun character sheet overlay enhancer installed.");
  }

  Hooks.once("ready", install);
  if (game?.ready) install();
})();

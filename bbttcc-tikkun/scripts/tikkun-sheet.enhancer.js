// modules/bbttcc-tikkun/scripts/tikkun-sheet.enhancer.js
// BBTTCC — Tikkun Character Sheet Tab (C2, overlay mode)
//
// FULL REPLACEMENT (2026-01-02, rev D)
// Fixes:
// - V2-ish BBTTCCCharacterSheet has no app._tabs; do not rely on it
// - Tikkun tab missing v13 tab semantics (data-action/tab, data-group/primary)
// - Hide handler too broad; listen only to actual tab clicks

(() => {
  const TAG = "[bbttcc-tikkun/sheet]";
  const TAB_ID = "bbttcc-tikkun";
  let _installed = false;

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
    if (s?.corrupted)  return { cls: "corrupted",       label: "Corrupted"   };
    if (s?.integrated) return { cls: "gathered active", label: "Integrated"  };
    if (s?.acquired)   return { cls: "gathered",        label: "Gathered"    };
    if (s?.identified) return { cls: "identified",      label: "Identified"  };
    return              { cls: "required",             label: "Required"    };
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
    const integratedCount = sparksArr.filter(s => s?.integrated).length;
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
        const kindIcon = iconForKind(s?.kind);
        const statusLabel = st.label;
        const tooltip = `${s?.name || s?.key || "Spark"} — ${statusLabel}`;

        html += `
          <div class="spark-container">
            <div class="spark-icon ${st.cls}" data-tooltip="${foundry.utils.escapeHTML(tooltip)}">
              <span class="spark-status-icon">
                ${statusLabel === "Integrated" ? "✅" :
                  statusLabel === "Corrupted" ? "⚠️" :
                  statusLabel === "Gathered" ? "✨" :
                  statusLabel === "Identified" ? "🔍" : "•"}
              </span>
              <span class="spark-type-icon">${kindIcon}</span>
            </div>
            <div class="spark-label">
              <strong>${foundry.utils.escapeHTML(s?.name || s?.key || "Spark")}</strong>
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

  function _findPrimaryTabNav($html) {
    let nav = $html.find(".sheet-tabs[data-group='primary']").first();
    if (!nav.length) nav = $html.find(".tabs[data-group='primary']").first();
    return nav;
  }

  function _getOverlay($html) {
    return $html.find("[data-bbttcc-tikkun-overlay]").first();
  }

  function _ensureOverlay($html, $insertAfterEl, actor) {
    $html.find("[data-bbttcc-tikkun-overlay]").remove();

    const $overlay = $(`
      <section class="bbttcc-tikkun-overlay" data-bbttcc-tikkun-overlay style="display:none;">
        ${buildTikkunInnerHTML(actor)}
      </section>
    `);

    $insertAfterEl.after($overlay);
    return $overlay;
  }

  function _ensureTabButton($nav) {
    $nav.find(`a.item[data-tab='${TAB_ID}']`).remove();

    let tabLabel = "Tikkun";
    try {
      const loc = game.i18n?.localize?.("BBTTCC.TikkunTabLabel");
      if (loc && loc !== "BBTTCC.TikkunTabLabel" && loc !== "label") tabLabel = loc;
    } catch {}

    // IMPORTANT: make this a real v13 tab anchor
    const $btn = $(
      `<a class="item"
          data-tab="${TAB_ID}"
          data-action="tab"
          data-group="primary"
          role="tab"
          tabindex="0">${tabLabel}</a>`
    );

    $nav.append($btn);
    return $btn;
  }

  function _setOverlayVisible($html, visible) {
    const $ov = _getOverlay($html);
    if (!$ov.length) return;
    if (visible) $ov.show();
    else $ov.hide();
  }

  function _activeTabFromDOM($nav) {
    // Foundry sets .active on the tab anchor
    const el = $nav.find("a.item.active[data-action='tab'][data-group='primary']").first();
    return String(el.data("tab") || "");
  }

  function _syncOverlayToActive($html, $nav) {
    const active = _activeTabFromDOM($nav);
    _setOverlayVisible($html, active === TAB_ID);
  }

  function _installTabObservers($html, $nav) {
    const $btn = $nav.find(`a.item[data-tab='${TAB_ID}']`).first();

    // Kill middle-click/new-tab behaviors across browsers
    $btn.off("auxclick.bbttcc-tikkun mousedown.bbttcc-tikkun");

    $btn.on("mousedown.bbttcc-tikkun", (ev) => {
      if (ev.button === 1) ev.preventDefault();
    });

    $btn.on("auxclick.bbttcc-tikkun", (ev) => {
      ev.preventDefault();
    });

    // DO NOT preventDefault on normal click; Foundry needs it for tab activation.
    // We only block ctrl/cmd click to prevent “open new window/tab” semantics.
    $btn.off("click.bbttcc-tikkun");
    $btn.on("click.bbttcc-tikkun", (ev) => {
      if (ev.ctrlKey || ev.metaKey) {
        ev.preventDefault();
        return;
      }
      // Let Foundry switch the tab, then sync overlay after the active class updates.
      setTimeout(() => _syncOverlayToActive($html, $nav), 0);
    });

    // Hide/show overlay when any real tab is clicked (v13 semantics only)
    $nav.off("click.bbttcc-tikkun-sync", "a.item[data-action='tab'][data-group='primary']");
    $nav.on("click.bbttcc-tikkun-sync", "a.item[data-action='tab'][data-group='primary']", () => {
      setTimeout(() => _syncOverlayToActive($html, $nav), 0);
    });
  }

  function injectTikkunTab(app, html) {
    const actor = app?.actor;
    if (!actor || actor.type !== "character") return;

    const t = getAPI();
    if (!t) return;

    ensureCSS();

    const $html = (html instanceof jQuery) ? html : $(html);
    const $nav = _findPrimaryTabNav($html);
    if (!$nav.length) {
      console.warn(TAG, "No primary tab nav found.", { ctor: app.constructor?.name });
      return;
    }

    _ensureTabButton($nav);
    _ensureOverlay($html, $nav, actor);
    _installTabObservers($html, $nav);

    // Initial sync
    _syncOverlayToActive($html, $nav);

    console.log(TAG, "Injected Tikkun overlay tab for", actor.name, "via", app.constructor?.name);
  }

  function install() {
    if (_installed) return;
    _installed = true;

    const handler = (app, html) => {
      try { injectTikkunTab(app, html); }
      catch (e) { console.warn(TAG, "render hook failed for", app?.constructor?.name, e); }
    };

    Hooks.on("renderActorSheet", handler);
    Hooks.on("renderActorSheet5eCharacter", handler);
    Hooks.on("renderCharacterActorSheet", handler);

    console.log(TAG, "Tikkun character sheet overlay enhancer installed.");
  }

  Hooks.once("ready", install);
})();

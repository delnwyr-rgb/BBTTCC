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

        // Phase E button — deposit when integrated, clean, and not yet
        // deposited. Phase D button — repair when corrupted. Both are
        // GM-actuated for v1; Phase F may open them to players.
        const canDeposit = !!s?.integrated && !s?.corrupted && !s?.deposited;
        const canRepair  = !!s?.corrupted;
        const isDeposited = !!s?.deposited;
        // Inline styles intentionally absent — class-driven look lives in
        // modules/bbttcc-tikkun/styles/tikkun-styles.css under the
        // .bbttcc-tk-spark-action / -spark-repair / -spark-deposit selectors.
        const actionBtn = canRepair
          ? `<button type="button" class="bbttcc-tk-spark-action bbttcc-tk-spark-repair" data-action="bbttcc-tk-repair" data-spark-key="${foundry.utils.escapeHTML(s.key || s.id)}">⚒ Repair</button>`
          : (canDeposit
            ? `<button type="button" class="bbttcc-tk-spark-action bbttcc-tk-spark-deposit" data-action="bbttcc-tk-deposit" data-spark-key="${foundry.utils.escapeHTML(s.key || s.id)}">→ Deposit</button>`
            : (isDeposited
              ? `<small class="bbttcc-tk-spark-deposited-tag" style="display:block;margin-top:0.25rem;font-size:0.68rem;opacity:0.7">Deposited ✓</small>`
              : ""));

        html += `
          <div class="spark-container">
            <div class="spark-icon ${st.cls}" data-tooltip="${foundry.utils.escapeHTML(tooltip)}">
              <span class="spark-status-icon">
                ${isDeposited                ? "🏛️" :
                  statusLabel === "Integrated" ? "✅" :
                  statusLabel === "Corrupted" ? "⚠️" :
                  statusLabel === "Gathered" ? "✨" :
                  statusLabel === "Identified" ? "🔍" : "•"}
              </span>
              <span class="spark-type-icon">${kindIcon}</span>
            </div>
            <div class="spark-label">
              <strong>${foundry.utils.escapeHTML(s?.name || s?.key || "Spark")}</strong>
              <small>${statusLabel}${isDeposited ? " · Deposited" : ""}</small>
              ${actionBtn}
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
    if (!nav.length) nav = $html.find("nav.ft-tabs[data-group='primary']").first();
    return nav;
  }

  // Detect the FT Steward sheet, which already ships a native "The Work" tab
  // at <div class="tab tikkun" data-tab="tikkun">. On those sheets we don't
  // want to add a duplicate Tikkun tab — we inject the constellation grid
  // directly into the existing native panel instead. Returns the panel
  // jQuery element if this is an FT sheet, or null.
  function _findFTNativeTikkunPanel($html) {
    const $panel = $html.find(".tab.tikkun[data-tab='tikkun']").first();
    return $panel.length ? $panel : null;
  }

  // Inject constellation grid into the FT Steward sheet's native Tikkun tab.
  // Uses a sentinel container so re-renders refresh in place. Click handlers
  // are attached at the panel level since Foundry re-renders on data updates.
  function _injectIntoFTNativeTab(app, $html, actor) {
    const $panel = _findFTNativeTikkunPanel($html);
    if (!$panel) return false;

    let $container = $panel.find("[data-bbttcc-constellation]").first();
    if (!$container.length) {
      $container = $(`<div data-bbttcc-constellation class="bbttcc-tikkun-ft-host" style="margin:0.6rem 0;border-top:1px solid rgba(255,255,255,0.08);padding-top:0.6rem"></div>`);
      // Place at top of the tikkun panel so it's the first thing seen.
      $panel.prepend($container);
    }
    $container[0].innerHTML = buildTikkunInnerHTML(actor);
    _wireSparkActions($html, actor, $container);
    return true;
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

    // Path A — FT Steward sheet has its own native "The Work" tab. Inject
    // the constellation grid INTO that existing panel so the spark UI lives
    // alongside the system's native Awakening / Sparks list. No duplicate
    // tab needed.
    if (_findFTNativeTikkunPanel($html)) {
      _injectIntoFTNativeTab(app, $html, actor);
      console.log(TAG, "Injected constellation into FT native Tikkun tab for", actor.name);
      return;
    }

    // Path B — dnd5e and other sheets without a pre-existing tikkun tab.
    // Add a Tikkun overlay tab that toggles via primary tab nav clicks.
    const $nav = _findPrimaryTabNav($html);
    if (!$nav.length) {
      console.warn(TAG, "No primary tab nav found.", { ctor: app.constructor?.name });
      return;
    }

    _ensureTabButton($nav);
    _ensureOverlay($html, $nav, actor);
    _installTabObservers($html, $nav);
    _wireSparkActions($html, actor);

    // Initial sync
    _syncOverlayToActive($html, $nav);

    console.log(TAG, "Injected Tikkun overlay tab for", actor.name, "via", app.constructor?.name);
  }

  // Phase D + E button wiring. Click → call API → re-render the host
  // container so Repair/Deposit/Deposited button state reflects the new
  // spark phase immediately. Host container defaults to the dnd5e overlay
  // but FT path passes its own.
  function _wireSparkActions($html, actor, $hostOverride = null) {
    const $host = $hostOverride ?? _getOverlay($html);
    if (!$host || !$host.length) return;
    $host.off("click.bbttcc-tikkun-actions");
    $host.on("click.bbttcc-tikkun-actions", "[data-action='bbttcc-tk-deposit'], [data-action='bbttcc-tk-repair']", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const btn = ev.currentTarget;
      const action = btn.dataset.action;
      const sparkKey = btn.dataset.sparkKey;
      const api = getAPI();
      if (!api) return;
      try {
        if (action === "bbttcc-tk-deposit") {
          await api.depositSpark({ actorId: actor.id, sparkKey });
        } else if (action === "bbttcc-tk-repair") {
          if (typeof api.openRepairRitual === "function") {
            await api.openRepairRitual({ ownerActor: actor, sparkKey });
          } else {
            ui.notifications?.warn?.("Repair Ritual not installed (Phase D missing?).");
            return;
          }
        }
      } catch (e) {
        ui.notifications?.warn?.(e?.message ?? String(e));
        return;
      }
      // Re-render the host HTML so Repair/Deposit buttons reflect new state.
      const inner = $host[0];
      if (inner) inner.innerHTML = buildTikkunInnerHTML(actor);
    });
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
    // FT Steward sheet (FourthThingCharacterSheet extends ActorSheetV2) and
    // any other AppV2-based actor sheet — without these the FT native "The
    // Work" tab never gets the constellation injected because the V1 hooks
    // don't fire for V2 apps. Class-specific names match common FT/dnd5e
    // sheets; the generic renderApplicationV2 catches anything else.
    Hooks.on("renderApplicationV2", handler);
    Hooks.on("renderFourthThingCharacterSheet", handler);
    Hooks.on("renderFourthThingNPCSheet", handler);

    console.log(TAG, "Tikkun character sheet overlay enhancer installed.");
  }

  Hooks.once("ready", install);
})();

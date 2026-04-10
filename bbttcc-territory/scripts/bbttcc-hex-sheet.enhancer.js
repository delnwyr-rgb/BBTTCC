// modules/bbttcc-territory/scripts/bbttcc-hex-sheet.enhancer.js
// BBTTCC — Hex Sheet 3.4 (syntax-safe AppV2; no optional chaining / nullish / spread)
//
// API: game.bbttcc.api.territory.openHexSheet(hexUuid)
//
// Notes:
// - Full replacement. Fixes prior bad-token insertion that caused parse failure.
// - GM edit UI for Hex Configuration lives in hex-config enhancers; this sheet remains a read/inspect surface.

(() => {
  const MOD_T = "bbttcc-territory";
  const TAG   = "[bbttcc-hex-sheet]";

  const api = (foundry && foundry.applications && foundry.applications.api) ? foundry.applications.api : null;
  const ApplicationV2 = api ? api.ApplicationV2 : null;
  const HandlebarsApplicationMixin = api ? api.HandlebarsApplicationMixin : null;

  function log()  { console.log.apply(console, [TAG].concat([].slice.call(arguments))); }
  function warn() { console.warn.apply(console, [TAG].concat([].slice.call(arguments))); }

  function ensureNS() {
    if (!game.bbttcc) game.bbttcc = { api: {} };
    if (!game.bbttcc.api) game.bbttcc.api = {};
    if (!game.bbttcc.api.territory) game.bbttcc.api.territory = {};
    if (!game.bbttcc.apps) game.bbttcc.apps = {};
    if (!game.bbttcc.apps.hexSheets) game.bbttcc.apps.hexSheets = {};
  }

  async function resolveHexDoc(uuid) {
    if (!uuid) return null;
    const raw = String(uuid);
    const parts = raw.split(".");

    if (parts[0] === "Scene" && parts.length >= 4) {
      const sc = (game.scenes && game.scenes.get) ? game.scenes.get(parts[1]) : null;
      if (sc) {
        if (parts[2] === "Drawing") return (sc.drawings && sc.drawings.get) ? (sc.drawings.get(parts[3]) || null) : null;
        if (parts[2] === "Tile")    return (sc.tiles && sc.tiles.get) ? (sc.tiles.get(parts[3]) || null) : null;
      }
    }

    const scenes = game.scenes ? Array.from(game.scenes) : [];
    for (let si = 0; si < scenes.length; si++) {
      const sc = scenes[si];
      const drawings = (sc && sc.drawings && sc.drawings.contents) ? sc.drawings.contents : [];
      for (let i=0;i<drawings.length;i++) if (drawings[i] && drawings[i].uuid === raw) return drawings[i];
      const tiles = (sc && sc.tiles && sc.tiles.contents) ? sc.tiles.contents : [];
      for (let j=0;j<tiles.length;j++) if (tiles[j] && tiles[j].uuid === raw) return tiles[j];
    }
    return null;
  }

  function pips(value, max) {
    const v = Math.max(0, Math.min(max, Number(value || 0)));
    let s = "";
    for (let i=0;i<max;i++) s += (i < v) ? "⬢" : "◌";
    return s;
  }

  function _safeHexSheetId(hexUuid){
    try {
      var raw = String(hexUuid || '');
      // Prefer the tail id (Drawing/Tile id) for shorter window ids.
      var parts = raw.split('.');
      var tail = parts.length ? parts[parts.length - 1] : raw;
      tail = String(tail).replace(/[^A-Za-z0-9_-]/g, '_');
      if (!tail) tail = raw.replace(/[^A-Za-z0-9_-]/g, '_');
      if (tail.length > 48) tail = tail.slice(0, 48);
      return 'bbttcc-hex-sheet-' + tail;
    } catch (_e) {
      return 'bbttcc-hex-sheet-' + String(Date.now());
    }
  }

  function _readWorldTurn() {
    try {
      const w = game && game.bbttcc && game.bbttcc.api ? game.bbttcc.api.world : null;
      if (w && typeof w.getState === "function") {
        const st = w.getState() || {};
        const t = Number(st.turn || 0);
        if (Number.isFinite(t) && t >= 0) return Math.floor(t);
      }
    } catch (e) {}
    return 0;
  }

  function _classifyModifier(mod, curTurn) {
    const enabled = (mod && mod.enabled !== false);
    const exp = Number(mod && mod.expiresTurn ? mod.expiresTurn : 0) || 0;
    const expired = (exp > 0 && curTurn > 0 && curTurn >= exp);
    return { enabled, expired, exp };
  }

  if (!ApplicationV2 || !HandlebarsApplicationMixin) {
    warn("Foundry ApplicationV2 APIs not available; Hex Sheet cannot install.");
    return;
  }

  class BBTTCC_HexSheet extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(
      foundry.utils.deepClone(super.DEFAULT_OPTIONS || {}),
      {
        id: "bbttcc-hex-sheet-base",
        classes: ["bbttcc","bbttcc-hex-sheet"],
        position: { width: 960, height: 600 },
        window: {
          title: "BBTTCC — Hex Sheet",
          resizable: true,
          controls: [],
          icon: ""
        }
      },
      { inplace: false }
    );

    static PARTS = {
      body: { template: "modules/" + MOD_T + "/templates/hex-sheet.hbs" }
    };

    constructor(hexUuid, options) {
      super(options || {});
      this.hexUuid = String(hexUuid || "");
      try {
        // Ensure this window never collides with Territory Dashboard or other apps.
        this.options.id = _safeHexSheetId(this.hexUuid);
        if (this.options.window && this.options.window.title) {
          // keep existing title
        } else {
          if (!this.options.window) this.options.window = {};
          this.options.window.title = 'BBTTCC — Hex Sheet';
        }
      } catch (_eId) {}
      this._hexDoc = null;
      this._abort = null;

      try {
        if (!this.options.window) this.options.window = {};
        if (!Array.isArray(this.options.window.controls)) this.options.window.controls = [];
        if (this.options.window.icon == null) this.options.window.icon = "";
      } catch (e) {}
    }

    async _preparePartContext(partId, context) {
      if (partId !== "body") return context;

      this._hexDoc = await resolveHexDoc(this.hexUuid);
      const doc = this._hexDoc;

      if (!doc) {
        return Object.assign({}, context, {
          name: "(missing hex)",
          size: "",
          type: "",
          status: "missing",
          ownerName: "—",
          facilitySummary: "None",
          hasResources: false,
          resourcesList: [],
          integrationProgress: 0,
          integrationPips: pips(0,6),
          radiation: 0,
          radiationPips: pips(0,6),
          darkness: 0,
          darknessPips: pips(0,6),
          notes: "Could not resolve hex for UUID: " + this.hexUuid
        });
      }

      const tf = (doc.flags && doc.flags[MOD_T]) ? doc.flags[MOD_T] : {};

      // World Modifiers (persistent GM-only effects)
      try {
        const arr = (tf && Array.isArray(tf.worldModifiers)) ? tf.worldModifiers : [];
        this._worldModifiers = arr.slice();
      } catch (e) {
        this._worldModifiers = [];
      }
      const ownerId = tf.factionId || "";
      const owner = ownerId ? ((game.actors && game.actors.get) ? game.actors.get(ownerId) : null) : null;

      const resources = tf.resources || {};
      const keys = Object.keys(resources || {});
      const resourcesList = keys.map(function (k) { return { label: k, value: resources[k] }; });

      const integ = tf.integration || {};
      const integProg = Number((typeof integ.progress !== "undefined") ? integ.progress : 0);

      const mods = tf.mods || {};
      const rad = Number(mods.radiation || 0);
      const dark = Number(mods.darkness || 0);

      const fac = (tf.facilities && tf.facilities.primary) ? tf.facilities.primary : {};
      const facType = (fac && fac.facilityType) ? fac.facilityType : "";
      const facilitySummary = facType ? (String(facType).charAt(0).toUpperCase() + String(facType).slice(1)) : "None";

      return Object.assign({}, context, {
        name: tf.name || doc.text || doc.name || "(unnamed hex)",
        size: tf.size || "outpost",
        type: tf.type || "wilderness",
        status: tf.status || "unclaimed",
        ownerName: (owner && owner.name) ? owner.name : "Unclaimed",
        facilitySummary: facilitySummary,
        hasResources: !!keys.length,
        resourcesList: resourcesList,
        integrationProgress: integProg,
        integrationPips: pips(integProg,6),
        radiation: rad,
        radiationPips: pips(rad,6),
        darkness: dark,
        darknessPips: pips(dark,6),
        notes: tf.notes || tf.note || "No notes stored on this hex."
      });
    }

    async _onRender(ctx, opts) {
      await super._onRender(ctx, opts);

      let root = null;
      // AppV2-safe: never querySelector by id (ids can collide across apps).
      if (this.form && this.form instanceof HTMLElement) root = this.form;
      if (!root) {
        try {
          // Foundry sometimes stores the root on this.element (jQuery-ish) or as HTMLElement.
          const el = this.element && this.element[0] ? this.element[0] : this.element;
          if (el && el instanceof HTMLElement) root = el;
        } catch (e) {}
      }
      if (!root) return;

      if (this._abort) { try { this._abort.abort(); } catch (e) {} }
      this._abort = new AbortController();
      const sig = this._abort.signal;

      root.addEventListener("click", (ev) => {
        let btn = null;
        try {
          btn = (ev.target && ev.target.closest) ? ev.target.closest('[data-action="open-facilities"]') : null;
        } catch (e) { btn = null; }
        if (!btn) return;
        ev.preventDefault(); ev.stopPropagation();

        const FacConsole = (game.bbttcc && game.bbttcc.apps) ? game.bbttcc.apps.FacilityConsole : null;
        if (!FacConsole) {
          if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("Facility Console not available.");
          return;
        }
        new FacConsole({ hexUuid: this.hexUuid }).render({ force: true, focus: true });
      }, { capture:true, signal: sig });

      // GM-only: Active Effects chips under Tracks & State
      try {
        if (!game.user || !game.user.isGM) {
          // skip (player view)
        } else {
        const doc = this._hexDoc;
        if (!doc) {
          // skip (no doc)
        } else {

        const curTurn = _readWorldTurn();
        const mods = Array.isArray(this._worldModifiers) ? this._worldModifiers : [];

        // Find the Tracks & State card by its header text
        const cards = root.querySelectorAll('.bbttcc-hex-card');
        let tracksCard = null;
        for (let i = 0; i < cards.length; i++) {
          const c = cards[i];
          const h = c ? c.querySelector('div') : null;
          const txt = h ? String(h.textContent || "").trim() : "";
          if (txt === "Tracks & State") { tracksCard = c; break; }
        }
        if (!tracksCard) {
          // No matching card (template changed). Skip chips.
          return;
        }

        // Remove prior injected block
        const prev = tracksCard.querySelector('[data-bbttcc-worldmods="1"]');
        if (prev) prev.remove();

        const box = document.createElement('div');
        box.setAttribute('data-bbttcc-worldmods', '1');
        box.style.marginTop = '10px';
        box.style.paddingTop = '8px';
        box.style.borderTop = '1px solid rgba(148,163,184,0.18)';

        const head = document.createElement('div');
        head.textContent = 'Active Effects';
        head.style.fontWeight = '800';
        head.style.marginBottom = '6px';
        box.appendChild(head);

        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.flexWrap = 'wrap';
        wrap.style.gap = '6px';
        box.appendChild(wrap);

        if (!mods.length) {
          const none = document.createElement('div');
          none.textContent = 'None.';
          none.style.opacity = '0.75';
          none.style.fontSize = '12px';
          wrap.appendChild(none);
        } else {
          for (let i = 0; i < mods.length; i++) {
            const m = mods[i];
            if (!m || typeof m !== 'object') continue;
            const key = String(m.key || '').trim();
            if (!key) continue;

            const st = _classifyModifier(m, curTurn);

            const chip = document.createElement('button');
            chip.type = 'button';
            chip.setAttribute('data-action', 'toggle-world-mod');
            chip.setAttribute('data-mod-key', key);
            chip.className = 'bbttcc-pill';
            chip.style.cursor = 'pointer';
            chip.style.borderColor = 'rgba(59,130,246,0.75)';
            chip.style.color = '#93c5fd';
            chip.style.background = 'rgba(2,6,23,0.25)';
            chip.style.userSelect = 'none';

            let label = String(m.label || key);
            if (st.expired) label += ' (expired)';
            else if (st.exp > 0) label += ' (to T' + String(st.exp) + ')';
            chip.textContent = label;

            if (!st.enabled) chip.style.opacity = '0.45';
            else if (st.expired) chip.style.opacity = '0.55';

            wrap.appendChild(chip);
          }
        }

        tracksCard.appendChild(box);

        // Toggle handler
        box.addEventListener('click', async (ev2) => {
          const btn = (ev2.target && ev2.target.closest) ? ev2.target.closest('[data-action="toggle-world-mod"][data-mod-key]') : null;
          if (!btn) return;
          ev2.preventDefault(); ev2.stopPropagation();

          const key = String(btn.getAttribute('data-mod-key') || '').trim();
          if (!key) return;

          try {
            const MOD_T2 = MOD_T;
            const tf2 = (doc.flags && doc.flags[MOD_T2]) ? foundry.utils.deepClone(doc.flags[MOD_T2]) : {};
            const arr2 = Array.isArray(tf2.worldModifiers) ? tf2.worldModifiers.slice() : [];
            let touched = false;
            for (let j = 0; j < arr2.length; j++) {
              const cur = arr2[j];
              if (!cur || typeof cur !== 'object') continue;
              if (String(cur.key || '') !== key) continue;
              cur.enabled = !(cur.enabled !== false);
              arr2[j] = cur;
              touched = true;
              break;
            }
            if (!touched) return;
            tf2.worldModifiers = arr2;
            await doc.update({ ['flags.' + MOD_T2]: tf2 }, { parent: doc.parent });
            this.render({ force: true });
          } catch (eToggle) {
            warn('toggle world modifier failed', eToggle);
          }
        }, { capture: true, signal: sig });
        }
        }
      } catch (eMods) {
        // non-fatal
      }
    }

    async close(options) {
      try {
        const key = this.hexUuid;
        if (game.bbttcc && game.bbttcc.apps && game.bbttcc.apps.hexSheets && game.bbttcc.apps.hexSheets[key] === this) {
          delete game.bbttcc.apps.hexSheets[key];
        }
      } catch (e) {}

      try {
        if (Object.getOwnPropertyDescriptor(globalThis, "__bbttcc_dashboard")) delete globalThis.__bbttcc_dashboard;
        if (Object.getOwnPropertyDescriptor(globalThis, "__bbttcc_dashboard_opening")) delete globalThis.__bbttcc_dashboard_opening;
        if (Object.getOwnPropertyDescriptor(globalThis, "__bbttcc_dashboardOpening")) delete globalThis.__bbttcc_dashboardOpening;
        if (Object.getOwnPropertyDescriptor(globalThis, "__bbttcc_dashboard_lock")) delete globalThis.__bbttcc_dashboard_lock;
        if (Object.getOwnPropertyDescriptor(globalThis, "__bbttcc_dashboardLock")) delete globalThis.__bbttcc_dashboardLock;
      } catch (e) {}

      return super.close(options);
    }
  }

  Hooks.once("ready", function () {
    ensureNS();

    game.bbttcc.api.territory.openHexSheet = function (hexUuid) {
      if (!hexUuid) {
        if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("openHexSheet: hexUuid required.");
        return null;
      }
      const key = String(hexUuid);

      const existing = game.bbttcc.apps.hexSheets[key];
      if (existing) {
        existing.render({ force: true, focus: true });
        return existing;
      }

      const app = new BBTTCC_HexSheet(key);
      game.bbttcc.apps.hexSheets[key] = app;
      app.render({ force: true, focus: true });
      return app;
    };

    log("Hex Sheet 3.4 installed (syntax-safe).");
  });
})();

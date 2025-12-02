// modules/bbttcc-tikkun/scripts/tikkun-ritual-console.js
// BBTTCC — Final Ritual Console (UI wrapper for the ritual engine)
//
// Wraps game.bbttcc.api.tikkun.beginRitual / step in an ApplicationV2 UI.
// Usage:
//   game.bbttcc.api.tikkun.openRitualConsole({ factionId: "<Actor.id or Actor.uuid>" });
//
// Requires tikkun-ritual.enhancer.js (ritual engine) to be loaded.

const MOD_TIKKUN = "bbttcc-tikkun";
const MOD_FCT    = "bbttcc-factions";
const TAG_RITCON = "[bbttcc-tikkun/ritual-console]";

const _appApi = foundry?.applications?.api || {};
const AppV2   = _appApi.ApplicationV2 || Application;
const HBM     = _appApi.HandlebarsApplicationMixin || ((Base) => class extends Base {});

function ensureTikkunNS() {
  game.bbttcc ??= { api:{} };
  game.bbttcc.api ??= {};
  game.bbttcc.api.tikkun ??= {};
  return game.bbttcc.api.tikkun;
}

function getFaction(fIdOrUuid) {
  const s = String(fIdOrUuid || "");
  if (!s) return null;
  try {
    if (s.startsWith("Actor.")) {
      if (typeof fromUuidSync === "function") return fromUuidSync(s);
      return null;
    }
    return game.actors.get(s) || null;
  } catch {
    return null;
  }
}

function roundSpec(idx) {
  switch (idx) {
    case 1: return { key:"invocation", label:"Invocation", dcBase:15 };
    case 2: return { key:"contact",    label:"Contact",    dcBase:15 };
    case 3:
    default: return { key:"integration", label:"Integration", dcBase:17 };
  }
}

function computeRitualDC(baseDc, darknessNow) {
  const d = Number(darknessNow || 0);
  const penalty = Math.floor(Math.max(0, d - 3) / 2); // every 2 above 3 adds +1 DC
  return Number(baseDc || 0) + penalty;
}

class BBTTCC_RitualConsole extends HBM(AppV2) {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-ritual-console",
    title: "BBTTCC — Final Ritual",
    classes: ["bbttcc", "bbttcc-ritual-console"],
    width: 960,
    height: 720,
    resizable: true,
    minimizable: true,
    positionOrtho: true
  };

  static PARTS = {
    body: { template: `modules/${MOD_TIKKUN}/templates/ritual-console.hbs` }
  };

  constructor(options={}) {
    super(options);
    this.factionId    = options.factionId || null;
    this.ritual       = null;   // handle returned from beginRitual
    this._ritualState = null;   // internal copy of state (avoid clashing with ApplicationV2.state)
    this.faction      = null;
    this.__centered   = false;
  }

  async _preparePartContext(partId, context) {
    if (partId !== "body") return context;

    const tApi = ensureTikkunNS();
    const faction = this.faction || (this.faction = getFaction(this.factionId));
    if (!faction) {
      context.error = "Faction not found. Close this window and try again.";
      return context;
    }

    // Start ritual if not yet started
    if (!this.ritual) {
      try {
        this.ritual = await tApi.beginRitual({
          factionId: faction.id,
          label: `Final Ritual — ${faction.name}`
        });
      } catch (e) {
        console.error(TAG_RITCON, "beginRitual failed:", e);
        context.error = "Unable to start ritual. See console for details.";
        return context;
      }
    }

    // Pull latest state from engine
    try {
      this._ritualState = this.ritual.getState();
    } catch (e) {
      console.error(TAG_RITCON, "getState failed:", e);
      context.error = "Unable to read ritual state. See console.";
      return context;
    }
    const state = this._ritualState || {};

    // Great Work readiness for display
    let gw = null;
    try {
      gw = (typeof tApi.getGreatWorkState === "function") ? tApi.getGreatWorkState(faction.id) : null;
    } catch (e) {
      console.warn(TAG_RITCON, "getGreatWorkState failed", e);
    }

    const sparkCount    = gw?.sparkCount ?? 0;
    const sparkThreshold = 3;
    const progressPct   = Math.min(100, Math.round((sparkCount / Math.max(1,sparkThreshold))*100));

    const metrics = {
      sparks:          sparkCount,
      sparkThreshold,
      progressPct,
      unity:           gw?.metrics?.unity    ?? (state.unityBefore ?? 0),
      vp:              gw?.metrics?.vp       ?? (state.vpBefore    ?? 0),
      darkness:        state.darknessNow ?? state.darknessStart ?? (gw?.metrics?.darkness ?? 0),
      darknessStart:   state.darknessStart ?? 0
    };

    const nextIdx = Math.min((state.round || 0) + 1, 3);
    const spec    = roundSpec(nextIdx);
    const nextDc  = computeRitualDC(spec.dcBase, metrics.darkness);

    context.faction = {
      id:   faction.id,
      name: faction.name
    };
    context.metrics   = metrics;
    context.ritual    = state;
    context.gw        = gw;
    context.nextRound = {
      index: nextIdx,
      label: spec.label,
      dc:    nextDc
    };
    context.isComplete = !!(state.outcome && state.outcome !== "ongoing");
    context.isSuccess  = state.outcome === "success";

    return context;
  }

  _onRender() {
    // Center on first open
    try {
      const el = this.element;
      if (!this.__centered && el) {
        el.style.left = "calc(50% - 480px)";
        el.style.top  = "72px";
        this.__centered = true;
      }
    } catch {}

    const root = $(this.element);
    root.off(".bbttccRit");

    // Advance round
    root.on("click.bbttccRit","[data-action='advance']", async (ev) => {
      ev.preventDefault();
      if (!this.ritual || !this._ritualState || this._ritualState.outcome !== "ongoing") return;

      const form = this.element.querySelector("[data-ritual-form]");
      if (!form) return;

      const val = (name) => Number(form.querySelector(`[name='${name}']`)?.value || 0);

      const spendFaith     = val("spendFaith");
      const spendCulture   = val("spendCulture");
      const spendDiplomacy = val("spendDiplomacy");
      const skillBonus     = val("skillBonus");
      const note           = form.querySelector("[name='note']")?.value || "";

      try {
        const tApi = ensureTikkunNS();
        const newState = await this.ritual.step({
          spendFaith,
          spendCulture,
          spendDiplomacy,
          skillBonus,
          note
        });
        this._ritualState = newState;
      } catch (e) {
        console.error(TAG_RITCON, "ritual.step failed", e);
        ui.notifications?.error?.("Ritual step failed — see console.");
      }

      // Clear numeric inputs for next round
      form.querySelectorAll("input[type='number']").forEach(i => { i.value = ""; });
      form.querySelector("[name='note']").value = "";

      this.render();
    });

    // Close
    root.on("click.bbttccRit","[data-action='close']", (ev) => {
      ev.preventDefault();
      this.close();
    });

    // New ritual (restarts with fresh state)
    root.on("click.bbttccRit","[data-action='restart']", async (ev) => {
      ev.preventDefault();
      if (!this.faction) return;
      if (!confirm("Begin a new ritual for this faction? This does not undo prior outcomes.")) return;
      this.ritual       = null;
      this._ritualState = null;
      await this.render();
    });
  }
}

// ---------------------------------------------------------------------------
// API / toolbar binding
// ---------------------------------------------------------------------------

function bindRitualConsoleAPI() {
  const mod = game.modules.get(MOD_TIKKUN);
  if (!mod) return;

  const RitualClass = BBTTCC_RitualConsole;

  mod.api = mod.api || {};
  mod.api.ritualConsole = mod.api.ritualConsole || {};
  mod.api.ritualConsole.RitualConsoleClass = RitualClass;

  const tApi = ensureTikkunNS();
  if (typeof tApi.openRitualConsole !== "function") {
    tApi.openRitualConsole = function openRitualConsole({ factionId, label } = {}) {
      const f = getFaction(factionId);
      if (!f) {
        ui.notifications?.warn?.("Final Ritual: Faction not found.");
        return null;
      }
      const inst = new RitualClass({ factionId: f.id, label });
      inst.render(true, { focus: true });
      return inst;
    };
  }

  console.log(TAG_RITCON, "Ritual Console API ready. Use game.bbttcc.api.tikkun.openRitualConsole({ factionId })");
}

function ensureNS() {
  game.bbttcc ??= { api:{} };
  game.bbttcc.api ??= {};
  game.bbttcc.api.tikkun ??= {};
  return game.bbttcc.api.tikkun;
}

Hooks.once("ready", bindRitualConsoleAPI);

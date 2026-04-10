/* REVIEW NOTE: Quest Log App is a standalone application and intentionally retained during faction-sheet layout cleanup. */
/* modules/bbttcc-factions/scripts/quest-log-app.js
 * BBTTCC Quest Log — AppV2 (Faction-facing)
 * - Progress: flags.bbttcc-factions.quests (active/completed/archived)
 * - Registry:  game.settings.get("bbttcc-campaign","quests")
 *
 * Drop-in script (no imports). Add to module.json "scripts" OR load it via dynamic import.
 */
(() => {
  const MOD_FAC = "bbttcc-factions";
  const MOD_CAM = "bbttcc-campaign";
  const CSS_HREF = `modules/${MOD_FAC}/styles/quest-log.css`;
  const TEMPLATE = `modules/${MOD_FAC}/templates/quest-log-app.hbs`;

  const log  = (...a) => console.log(`[${MOD_FAC}][quest-log]`, ...a);
  const warn = (...a) => console.warn(`[${MOD_FAC}][quest-log]`, ...a);

  function deepClone(obj) {
    try { return foundry.utils.duplicate(obj ?? {}); } catch { return JSON.parse(JSON.stringify(obj ?? {})); }
  }

  function ensureCss() {
    try {
      if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(l => (l.href || "").includes("quest-log.css"))) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.type = "text/css";
      link.href = CSS_HREF;
      document.head.appendChild(link);
    } catch (e) { warn("CSS load failed", e); }
  }

  function readRegistry() {
    try { return game.settings.get(MOD_CAM, "quests") || {}; } catch (_e) { return {}; }
  }

  function questDef(reg, qid) {
    const q = reg?.[qid];
    return (q && typeof q === "object") ? q : null;
  }

  function qName(reg, qid) {
    const q = questDef(reg, qid);
    return String(q?.name || q?.label || qid || "").trim() || String(qid || "");
  }

  function qDesc(reg, qid) {
    const q = questDef(reg, qid);
    return String(q?.description || q?.desc || "").trim();
  }

  function tsLabel(ts) {
    const n = Number(ts || 0);
    if (!n) return "—";
    try { return new Date(n).toLocaleString(); } catch { return String(n); }
  }

  function readTrack(actor) {
    const raw = actor?.getFlag?.(MOD_FAC, "quests");
    const t = (raw && typeof raw === "object") ? deepClone(raw) : {};
    t.schemaVersion = Number(t.schemaVersion ?? 1) || 1;
    t.active = (t.active && typeof t.active === "object") ? t.active : {};
    t.completed = (t.completed && typeof t.completed === "object") ? t.completed : {};
    t.archived = (t.archived && typeof t.archived === "object") ? t.archived : {};
    return t;
  }

  function beatProgress(tr) {
    const prog = tr?.progress?.beats && typeof tr.progress.beats === "object" ? tr.progress.beats : {};
    let seen = 0, done = 0;
    for (const b of Object.values(prog)) {
      const st = String(b?.state || "");
      if (st === "completed") done++;
      else if (st) seen++;
    }
    return { seenCount: seen, completedCount: done };
  }

  function rowsFromMap(reg, mapObj, status) {
    const rows = [];
    const keys = mapObj ? Object.keys(mapObj) : [];
    for (const qid of keys) {
      const tr = mapObj[qid] || {};
      const { seenCount, completedCount } = beatProgress(tr);
      const acceptedTs = tr.acceptedTs || tr.accepted || null;
      const completedTs = tr.completedTs || tr.completed || null;
      const archivedTs = tr.archivedTs || tr.archived || null;
      const lastTouchedTs = tr.lastTouchedTs || tr.lastTs || archivedTs || completedTs || acceptedTs || null;
      rows.push({
        questId: qid,
        status,
        name: qName(reg, qid),
        description: qDesc(reg, qid),
        notes: String(tr.notes || "").trim(),
        questStep: Number(tr.questStep ?? tr.step ?? 1) || 1,
        acceptedTs,
        completedTs,
        archivedTs,
        lastTouchedTs,
        seenCount,
        completedCount
      });
    }
    rows.sort((a,b)=> (Number(b.lastTouchedTs||0) - Number(a.lastTouchedTs||0)) || String(a.name).localeCompare(String(b.name)));
    return rows;
  }

  async function resolveActorRef(ref) {
    if (!ref) return null;
    if (ref?.documentName === "Actor") return ref;

    const s = String(ref).trim();
    if (!s) return null;

    // raw id
    let a = game.actors?.get?.(s) ?? null;
    if (a) return a;

    // Actor.<id>
    if (s.startsWith("Actor.")) {
      const id = s.slice("Actor.".length);
      a = game.actors?.get?.(id) ?? null;
      if (a) return a;
    }

    // UUID
    try {
      if (typeof fromUuid === "function" && s.includes(".")) {
        const doc = await fromUuid(s);
        if (doc?.documentName === "Actor") return doc;
      }
    } catch (_e) {}

    return null;
  }

  class BBTTCCQuestLogApp extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "bbttcc-quest-log",
      window: { title: "BBTTCC Quest Log", icon: "fas fa-scroll" },
      position: { width: 980, height: 720 },
      classes: ["bbttcc", "bbttcc-quest-log", "sheet"],
      resizable: true
    };

    static PARTS = {
      body: { template: TEMPLATE }
    };

    constructor({ factionId, factionActor } = {}, options = {}) {
      super(options);
      this.factionId = String(factionId || factionActor?.id || "").trim();
      this.__state = this.__state || { tab: "active", search: "", selected: "" };
      this._abort = null;
      this.__updateHook = null;
    }

    async _getFaction() {
      return resolveActorRef(this.factionId);
    }

    async _preparePartContext(partId, ctx) {
      if (partId !== "body") return ctx;

      const faction = await this._getFaction();
      const reg = readRegistry();
      const track = faction ? readTrack(faction) : { active:{}, completed:{}, archived:{} };

      const active = rowsFromMap(reg, track.active, "active");
      const completed = rowsFromMap(reg, track.completed, "completed");
      const archived = rowsFromMap(reg, track.archived, "archived");
      const all = [...active, ...completed, ...archived];

      const tab = this.__state.tab || "active";
      const search = String(this.__state.search || "").trim().toLowerCase();

      const tabRows =
        (tab === "active") ? active :
        (tab === "completed") ? completed :
        (tab === "archived") ? archived :
        all;

      const rows = !search ? tabRows : tabRows.filter(r => (`${r.name} ${r.questId}`.toLowerCase()).includes(search));

      let sel = this.__state.selected;
      if (sel && !rows.some(r => r.questId === sel)) sel = "";
      if (!sel && rows[0]) sel = rows[0].questId;
      this.__state.selected = sel;

      const selected = sel ? (all.find(r => r.questId === sel) || null) : null;

      return {
        ...ctx,
        isGM: !!game.user?.isGM,
        faction,
        tab,
        search,
        counts: { active: active.length, completed: completed.length, archived: archived.length, all: all.length },
        tabs: [
          { key:"active", label:`Active (${active.length})` },
          { key:"completed", label:`Completed (${completed.length})` },
          { key:"archived", label:`Archived (${archived.length})` },
          { key:"all", label:`All (${all.length})` }
        ],
        rows,
        selected,
        tsLabel
      };
    }

    async _onRender(ctx, opts) {
      await super._onRender(ctx, opts);
      ensureCss();

      const root = this.element?.[0] ?? this.element;
      if (!root) return;

      if (this._abort) { try { this._abort.abort(); } catch {} }
      this._abort = new AbortController();
      const sig = this._abort.signal;

      // Tabs
      root.addEventListener("click", (ev) => {
        const tab = ev.target?.closest?.("[data-ql-tab]")?.dataset?.qlTab;
        if (!tab) return;
        ev.preventDefault(); ev.stopPropagation();
        this.__state.tab = tab;
        this.render(false);
      }, { capture: true, signal: sig });

      // Search
      root.addEventListener("input", (ev) => {
        const inp = ev.target?.closest?.("[data-ql-search]");
        if (!inp) return;
        this.__state.search = String(inp.value || "");
        this.render(false);
      }, { capture: true, signal: sig });

      // Select
      root.addEventListener("click", (ev) => {
        const row = ev.target?.closest?.("[data-ql-select]");
        if (!row) return;
        ev.preventDefault(); ev.stopPropagation();
        this.__state.selected = String(row.dataset.qlSelect || "");
        this.render(false);
      }, { capture: true, signal: sig });

      // Actions
      root.addEventListener("click", async (ev) => {
        const btn = ev.target?.closest?.("[data-ql-act]");
        if (!btn) return;

        ev.preventDefault(); ev.stopPropagation();
        const act = String(btn.dataset.qlAct || "");
        const qid = String(btn.dataset.questId || this.__state.selected || "").trim();
        if (!qid) return;

        const faction = await this._getFaction();
        if (!faction) return ui.notifications?.error?.("Quest Log: faction not found.");

        const reg = readRegistry();
        const qname = qName(reg, qid);

        const track = readTrack(faction);

        const ensureRow = () => {
          if (track.active[qid]) return track.active[qid];
          if (track.completed[qid]) return track.completed[qid];
          if (track.archived[qid]) return track.archived[qid];
          track.active[qid] = {
            v: 1,
            questId: qid,
            status: "active",
            acceptedTs: Date.now(),
            completedTs: null,
            archivedTs: null,
            lastTouchedTs: Date.now(),
            notes: "",
            questStep: 1,
            progress: { beats: {} },
            history: []
          };
          return track.active[qid];
        };

        const persist = async () => {
          await faction.setFlag(MOD_FAC, "quests", track);
        };

        if (act === "note") {
          const row0 = ensureRow();
          const prev = String(row0.notes || "");
          const content = `
            <p class="bbttcc-muted">Quest: <b>${foundry.utils.escapeHTML(qname)}</b> <small><code>${foundry.utils.escapeHTML(qid)}</code></small></p>
            <textarea style="width:100%; min-height:220px;" name="qnote">${foundry.utils.escapeHTML(prev)}</textarea>
          `;
          new Dialog({
            title: "Quest Notes",
            content,
            classes: ["bbttcc-hexchrome-dialog"],
            buttons: {
              save: {
                label: "Save",
                callback: async (html2) => {
                  const val = String(html2.find("textarea[name='qnote']").val() || "").trim();
                  const row = ensureRow();
                  row.notes = val;
                  row.lastTouchedTs = Date.now();
                  await persist();
                  this.render(false);
                }
              },
              cancel: { label: "Cancel" }
            },
            default: "save"
          }).render(true);
          return;
        }

        // GM-only from here
        if (!game.user?.isGM) return ui.notifications?.warn?.("GM only.");

        if (act === "complete") {
          const row = ensureRow();
          row.status = "completed";
          row.completedTs = row.completedTs || Date.now();
          row.archivedTs = null;
          row.lastTouchedTs = Date.now();
          track.completed[qid] = row;
          delete track.active[qid];
          delete track.archived[qid];
          await persist();
          ui.notifications?.info?.(`Quest completed: ${qname}`);
          this.__state.tab = "completed";
          this.render(false);
          return;
        }

        if (act === "archive") {
          const row = ensureRow();
          row.status = "archived";
          row.archivedTs = row.archivedTs || Date.now();
          row.lastTouchedTs = Date.now();
          track.archived[qid] = row;
          delete track.active[qid];
          delete track.completed[qid];
          await persist();
          ui.notifications?.info?.(`Quest archived: ${qname}`);
          this.__state.tab = "archived";
          this.render(false);
          return;
        }

        if (act === "reactivate") {
          const row = ensureRow();
          row.status = "active";
          row.archivedTs = null;
          row.completedTs = null;
          row.lastTouchedTs = Date.now();
          track.active[qid] = row;
          delete track.completed[qid];
          delete track.archived[qid];
          await persist();
          ui.notifications?.info?.(`Quest reactivated: ${qname}`);
          this.__state.tab = "active";
          this.render(false);
          return;
        }

        if (act === "reset") {
          const ok = await Dialog.confirm({
            title: "Reset Quest Progress",
            content: `<p>Reset progress for <b>${foundry.utils.escapeHTML(qname)}</b>?</p><p>This clears tracked beat progress and marks it Active.</p>`
          });
          if (!ok) return;

          const row = ensureRow();
          row.status = "active";
          row.completedTs = null;
          row.archivedTs = null;
          row.lastTouchedTs = Date.now();
          row.questStep = 1;
          row.progress = { beats: {} };
          row.history = Array.isArray(row.history) ? row.history : [];
          row.history.push({ ts: Date.now(), type: "reset", by: game.user?.name || "GM" });

          track.active[qid] = row;
          delete track.completed[qid];
          delete track.archived[qid];

          await persist();
          ui.notifications?.info?.(`Quest reset: ${qname}`);
          this.__state.tab = "active";
          this.render(false);
          return;
        }
      }, { capture: true, signal: sig });

      // Live refresh on quest flag updates
      if (!this.__updateHook) {
        this.__updateHook = (actor, data) => {
          try {
            if (!actor || actor.id !== this.factionId) return;
            if (!foundry.utils.hasProperty(data, `flags.${MOD_FAC}.quests`)) return;
            this.render(false);
          } catch (_e) {}
        };
        Hooks.on("updateActor", this.__updateHook);
      }
    }

    async close(options) {
      try {
        if (this._abort) { try { this._abort.abort(); } catch {} }
        if (this.__updateHook) { try { Hooks.off("updateActor", this.__updateHook); } catch {} }
      } catch (_e) {}
      return super.close(options);
    }
  }

  function attachAPI() {
    game.bbttcc ??= {};
    game.bbttcc.api ??= {};
    game.bbttcc.api.quests ??= {};

    // Expose class for debugging
    game.bbttcc.apps ??= {};
    game.bbttcc.apps.QuestLog = BBTTCCQuestLogApp;

    game.bbttcc.api.quests.openQuestLog = async ({ factionId, factionActor } = {}) => {
      const a = await resolveActorRef(factionActor || factionId);
      if (!a) return ui.notifications?.error?.("Quest Log: faction not found.");
      const app = new BBTTCCQuestLogApp({ factionId: a.id });
      app.render(true, { focus: true });
      return app;
    };

    log("API attached: game.bbttcc.api.quests.openQuestLog({factionId})");
  }

  Hooks.once("ready", () => {
    ensureCss();
    attachAPI();
  });

  // late-load safe
  try { if (game?.ready) { ensureCss(); attachAPI(); } } catch (_e) {}
})();

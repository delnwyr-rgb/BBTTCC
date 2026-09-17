/* REVIEW NOTE: Quest Log App is a standalone application and intentionally retained during faction-sheet layout cleanup. */
/* modules/bbttcc-factions/scripts/quest-log-app.js
 * Bad Eden Quest Log — AppV2 (Faction-facing)
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

  function qImg(reg, qid) {
    const q = questDef(reg, qid);
    return String(q?.image || q?.img || q?.icon || "").trim();
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

  // Open "wants a word" invitations (2026-09-12, owner ask): the campaign module
  // enumerates them (api.campaign.invites.list); they render as rows in an
  // Invitations tab with an Accept button on any seat — no more accept → scroll
  // → accept through the turn-advance chat traffic.
  async function readInvites(factionId) {
    try {
      const api = game.bbttcc?.api?.campaign?.invites;
      const list = (api?.list ? await api.list({ factionId: String(factionId || "") }) : []) || [];
      const esc = foundry.utils.escapeHTML;
      return list.map(i => ({
        questId: `invite:${i.card || i.beatId}`, isInvite: true, beatId: String(i.beatId || ""), actorId: String(i.actorId || ""),
        actorName: String(i.actorName || ""), status: "invited",
        name: String(i.questName || `A Word from ${i.actorName || "Someone"}`),
        momentCount: Array.isArray(i.moments) ? i.moments.length : 1,
        description: `<p>${i.lineHtml || ""}</p>` + (i.where ? `<p><b>Where:</b> ${esc(i.where)}</p>` : "")
          + ((Array.isArray(i.moments) && i.moments.length > 1)
              ? `<p><b>On offer:</b></p><ul>${i.moments.map(m => `<li>${esc(m.label)}</li>`).join("")}</ul>`
              : (i.regarding ? `<p><b>Regarding:</b> ${esc(i.regarding)}</p>` : "")),
        image: String(i.actorImg || ""), notes: "", actLabel: (i.act != null) ? `Act ${i.act}` : "",
        acceptedTs: null, completedTs: null, archivedTs: null, invitedTs: Number(i.invitedTs) || 0, lastTouchedTs: Number(i.invitedTs) || 0,
        seenCount: 0, completedCount: 0
      }));
    } catch (_e) { return []; }
  }
  function canAcceptInvites() {
    try { return !!game.user?.isGM || !!game.bbttcc?.api?.campaign?.invites?.playerAcceptAllowed?.(); } catch (_e) { return !!game.user?.isGM; }
  }

  // SCRIPTED QUESTS (Phase A, 2026-09-17): when the story model carries a script for the quest this registry
  // row belongs to, the Log says what the quest is about, who gave it, and the next step — the authored words,
  // not the registry's leftovers. Reads the situation once per render through the campaign API; fails soft.
  async function readScriptInfo() {
    try {
      const api = game.bbttcc?.api?.campaign; if (!api?.director?.situation || !api?.story?.registryOf) return () => null;
      const story = await api.director.situation({ full: false }); if (!story?.byKey) return () => null;
      const esc = foundry.utils.escapeHTML;
      return (qid) => {
        const m = api.story.registryOf(qid); const q = m ? story.byKey[m.quest] : null; const sc = q?.script; if (!sc) return null;
        if (m.chapter) {
          const ch = sc.chapters?.[m.chapter] || {}; const cq = (q.chapters || []).find(c => c.key === m.chapter) || null;
          const line = ch.line || (cq?.next?.line || ""); const giver = ch.giver || "";
          return { giver, description: ch.description || "", stepLabel: cq ? (cq.state === "done" ? "done" : cq.state) : "", lines: line ? [line] : [], doors: [] };
        }
        const cur = (sc.steps || []).filter(st => st.status === "current");
        const lines = cur.map(st => st.line).filter(Boolean); if (!lines.length && q.next?.line) lines.push(q.next.line);
        const stepLabel = cur.map(st => st.label).filter(Boolean).join(" · ") || (q.state === "completed" ? "complete" : "");
        const doors = (sc.doors || []).filter(d => d.line).map(d => ({ label: d.label, line: d.line, ready: d.ready }));
        return { giver: sc.giver || "", description: sc.description || "", stepLabel, lines, doors,
          html: `${sc.giver ? `<p class="bbttcc-muted"><b>From:</b> ${esc(sc.giver)}</p>` : ""}${sc.description ? `<p>${esc(sc.description)}</p>` : ""}` +
            (lines.length ? `<p><b>Next:</b></p><ul>${lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul>` : "") +
            (doors.length ? `<p><b>Also open:</b></p><ul>${doors.map(d => `<li>${esc(d.line)}</li>`).join("")}</ul>` : "") };
      };
    } catch (_e) { return () => null; }
  }

  function rowsFromMap(reg, mapObj, status, scriptInfo = () => null) {
    const rows = [];
    const keys = mapObj ? Object.keys(mapObj) : [];
    for (const qid of keys) {
      const tr = mapObj[qid] || {};
      const si = scriptInfo(qid);
      const { seenCount, completedCount } = beatProgress(tr);
      const acceptedTs = tr.acceptedTs || tr.accepted || null;
      const completedTs = tr.completedTs || tr.completed || null;
      const archivedTs = tr.archivedTs || tr.archived || null;
      const lastTouchedTs = tr.lastTouchedTs || tr.lastTs || archivedTs || completedTs || acceptedTs || null;
      rows.push({
        questId: qid,
        status,
        name: qName(reg, qid),
        description: si?.html || (si && (si.giver || si.lines?.length) ? `${si.giver ? `<p class="bbttcc-muted"><b>From:</b> ${foundry.utils.escapeHTML(si.giver)}</p>` : ""}${qDesc(reg, qid)}${si.lines?.length ? `<p><b>Next:</b> ${foundry.utils.escapeHTML(si.lines[0])}</p>` : ""}` : qDesc(reg, qid)),
        image: qImg(reg, qid),
        notes: String(tr.notes || "").trim(),
        questStep: Number(tr.questStep ?? tr.step ?? 1) || 1,
        stepLabel: si?.stepLabel || "",
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
      window: { title: "Bad Eden Quest Log", icon: "fas fa-scroll" },
      position: { width: 980, height: 720 },
      classes: ["bbttcc", "bbttcc-quest-log", "sheet", "bbttcc-be", "bbttcc-theme-player"],
      resizable: true
    };

    static PARTS = {
      body: { template: TEMPLATE }
    };

    constructor({ factionId, factionActor } = {}, options = {}) {
      super(options);
      this.factionId = String(factionId || factionActor?.id || "").trim();
      this.__state = this.__state || { tab: null, search: "", selected: "" };   // tab null = Invitations when any are open, else Active
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

      const invites = await readInvites(this.factionId);
      const scriptInfo = await readScriptInfo();
      const active = rowsFromMap(reg, track.active, "active", scriptInfo);
      const completed = rowsFromMap(reg, track.completed, "completed", scriptInfo);
      const archived = rowsFromMap(reg, track.archived, "archived", scriptInfo);
      const all = [...invites, ...active, ...completed, ...archived];

      const tab = this.__state.tab || (invites.length ? "invites" : "active");
      const search = String(this.__state.search || "").trim().toLowerCase();

      const tabRows =
        (tab === "invites") ? invites :
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
      // 📍 Where (2026-09-14): town-hub doors this quest points at — derived from the
      // quest's un-completed beats' sceneId (api.travel.doors.forQuest). No new schema.
      if (selected && !selected.isInvite) {
        try {
          const doors = game.bbttcc?.api?.travel?.doors;
          const hits = doors?.forQuest ? doors.forQuest(selected.questId) : [];
          selected.locations = hits.map(h => ({
            drawingUuid: h.drawingUuid, label: h.label, hubLabel: h.hubLabel,
            here: !!(canvas?.scene?.uuid && canvas.scene.uuid === h.hubSceneUuid),
            beatLabels: h.beats.map(b => b.label).join(" · ")
          }));
        } catch (_e) { selected.locations = []; }
      }

      return {
        ...ctx,
        isGM: !!game.user?.isGM,
        faction,
        tab,
        search,
        counts: { invites: invites.length, active: active.length, completed: completed.length, archived: archived.length, all: all.length },
        canAcceptInvites: canAcceptInvites(),
        tabs: [
          { key:"invites", label:`Invitations (${invites.length})` },
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

        // Accept an invitation from ANY seat — the campaign module relays player clicks to the GM.
        if (act === "accept-invite") {
          const beatId = String(btn.dataset.beatId || ""); const actorId = String(btn.dataset.actorId || "");
          const api = game.bbttcc?.api?.campaign?.invites;
          if (!api?.accept) return ui.notifications?.warn?.("Quest Log: the campaign module is not loaded.");
          btn.disabled = true;
          try {
            const r = await api.accept({ actorId, beatId });
            if (r?.questId) { this.__state.tab = "active"; this.__state.selected = String(r.questId); }
          } catch (e) { warn("accept-invite failed", e); }
          this.render(false);
          return;
        }

        // 📍 Go to a location door on its town hub map (any seat — pans this client, pulses the door).
        if (act === "goto-door") {
          const doors = game.bbttcc?.api?.travel?.doors;
          const uuid = String(btn.dataset.drawingUuid || "");
          if (!doors?.goto || !uuid) return ui.notifications?.warn?.("Quest Log: the travel module's doors are not loaded.");
          try { await doors.goto(uuid); } catch (e) { warn("goto-door failed", e); }
          return;
        }

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
      // Invitations live in campaign world settings (directorState.invited + the quest
      // registry) — those updates reach every client, so the tab refreshes for players too.
      if (!this.__settingHook) {
        this.__settingHook = (setting) => {
          try {
            const k = String(setting?.key || "");
            if (k === `${MOD_CAM}.quests` || k === `${MOD_CAM}.directorState`) this.render(false);
          } catch (_e) {}
        };
        Hooks.on("updateSetting", this.__settingHook);
      }
    }

    async close(options) {
      try {
        if (this._abort) { try { this._abort.abort(); } catch {} }
        if (this.__updateHook) { try { Hooks.off("updateActor", this.__updateHook); } catch {} }
        if (this.__settingHook) { try { Hooks.off("updateSetting", this.__settingHook); } catch {} }
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

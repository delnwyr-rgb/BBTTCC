// campaign-script-editor.js — Bad Eden Campaign Builder · STORY SCRIPT EDITOR
// Layer 2 of GM authoring parity (owner ruling 2026-09-21): the quest script that used to live only in
// scripts/story-scripts.js (giver · player-facing description · ordered steps with the Quest Log's
// "Next:" line · doors · chapters · Arrival) is authored here and stored on campaign.story.
// Same shapes the story model reads (story-model.js "STORY DATA"); data wins over the shipped code
// tables per key. Application V1 for parity with the Beat Editor.
const TAG = "[bbttcc-campaign][ScriptEditor]";

const DONE_KINDS = [
  { key: "any",     label: "any listed beat played (default)" },
  { key: "mark",    label: "a specific beat played" },
  { key: "anyOf",   label: "any of these beats played" },
  { key: "allOf",   label: "all of these beats played" },
  { key: "chapter", label: "a chapter has ended (quest/chapter)" },
  { key: "quest",   label: "a quest has closed (key)" }
];
const TIPS = {
  key: "Story key — the internal id the engine files this quest under (letters, digits, underscores). Set once; it is how beats' story declarations and other scripts refer to it.",
  registryId: "Quests-tab quest this script speaks for. The players' Quest Log finds the script through this link — without it the script is invisible.",
  act: "Act the quest belongs to (0–6). Its content seals when a later act opens; Arrival steps seal when their own act turns.",
  hex: "Home hex (a hex NAME on the world map). Beats without their own `where` play here; the NOW card says 'X is at <hex>'.",
  keystone: "Keystone quests carry the act — the Director lists them first.",
  evergreen: "Evergreen quests never close with their act — a town, a place, an aside the party can reach in any later act. (They still seal once played through.)",
  giver: "Who hands the quest over — shows as 'From:' in the Quest Log.",
  description: "Player-facing summary — the paragraph under the quest's name in the Log. Write it in the world's voice.",
  steps: "Ordered steps. The first unfinished step whose gate is met is CURRENT; its Line is the Quest Log's 'Next:'. A step with a Group shares 'current' with every other unfinished step in that group (any order).",
  stepLine: "The 'Next:' sentence players read while this step is current.",
  stepBeats: "Beat ids that play this step (comma-separated). Pick from the campaign's beats — unknown ids are flagged on Validate.",
  stepDone: "When the step counts as done. Default: any listed beat has played. Use 'a specific beat' when the step ends with a choice that routes elsewhere.",
  stepChapter: "Chapter this step belongs to (declared below). Chapter steps get their own 'From:' and line in the Log.",
  doors: "Doors are open all act and never 'next' — side content the Log lists under 'Also open'.",
  chapters: "Chapters split a quest into Log-visible parts, each with its own registry quest so it can be accepted/completed on its own. Endings close chapters; a quest closes with a 'closer' beat.",
  arrival: "Arrival (act-1 opener): a short ladder of steps that seals when the act turns — the town meeting you before it asks anything.",
  after: "Epilogue beats — played after the quest closes; never 'next'.",
  json: "The whole record as JSON (quest + script). Paste to replace everything above — Validate before Save."
};

function ensureCSS() {
  if (document.getElementById("bbttcc-campaign-script-editor-css")) return;
  const link = document.createElement("link");
  link.id = "bbttcc-campaign-script-editor-css"; link.rel = "stylesheet";
  link.href = "modules/bbttcc-campaign/styles/campaign-script-editor.css";
  document.head.appendChild(link);
}

export class BBTTCCCampaignScriptEditorApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "bbttcc-campaign-script-editor",
      title: "Story Script",
      template: "modules/bbttcc-campaign/templates/campaign-script-editor.hbs",
      width: 1080, height: "auto", resizable: true, popOut: true,
      classes: ["bbttcc", "bbttcc-hexchrome", "bbttcc-campaign-script-editor"]
    });
  }
  // options: { campaignId, key?, registryQuest? }  — key = existing story key; registryQuest = Quests-tab quest {id,name,description}
  constructor(options = {}) {
    super(options);
    ensureCSS();
    this.campaignId = options.campaignId || game.bbttcc?.api?.campaign?.getActiveCampaignId?.() || null;
    const api = game.bbttcc?.api?.campaign;
    const data = api?.story?.data?.get?.(this.campaignId) || { quests: {}, scripts: {} };
    const code = api?.story?.data?.code?.() || { quests: {}, scripts: {} };
    let key = options.key ? String(options.key) : null;
    if (!key && options.registryQuest?.id) key = api?.story?.data?.keyFor?.(options.registryQuest.id) || null;
    this.isNew = false;
    if (key && (data.quests?.[key] || data.scripts?.[key])) {
      this.state = { key, quest: foundry.utils.deepClone(data.quests?.[key] || code.quests?.[key] || {}), script: foundry.utils.deepClone(data.scripts?.[key] || code.scripts?.[key] || { steps: [], doors: [], after: [], chapters: {} }) };
      this.source = "data";
    } else if (key && (code.quests?.[key] || code.scripts?.[key])) {
      // shipped (code) script — editing it forks a data copy that wins over the code table
      this.state = { key, quest: foundry.utils.deepClone(code.quests?.[key] || {}), script: foundry.utils.deepClone(code.scripts?.[key] || { steps: [], doors: [], after: [], chapters: {} }) };
      this.source = "code";
    } else {
      const sc = api?.story?.data?.scaffold?.(options.registryQuest || { id: "", name: "New Quest" }) || { key: "new_quest", quest: {}, script: { steps: [], doors: [], after: [], chapters: {} } };
      this.state = sc; this.source = "new"; this.isNew = true;
    }
    this._shape();
    this.findings = [];
    this.jsonError = "";
  }
  _shape() {
    const q = this.state.quest, s = this.state.script;
    q.name ??= ""; q.act ??= 1; q.keystone = !!q.keystone; q.evergreen = !!q.evergreen; q.hex ??= ""; q.registryId ??= ""; q.chapters ??= {};
    s.giver ??= ""; s.description ??= ""; s.steps = Array.isArray(s.steps) ? s.steps : []; s.doors = Array.isArray(s.doors) ? s.doors : [];
    s.after = Array.isArray(s.after) ? s.after : []; s.chapters ??= {};
    if (s.arrival) { s.arrival.act ??= 1; s.arrival.giver ??= ""; s.arrival.description ??= ""; s.arrival.steps = Array.isArray(s.arrival.steps) ? s.arrival.steps : []; }
    for (const st of [...s.steps, ...(s.arrival?.steps || [])]) { st.id ??= ""; st.label ??= ""; st.line ??= ""; st.beats = Array.isArray(st.beats) ? st.beats : []; }
    for (const d of s.doors) { d.id ??= ""; d.label ??= ""; d.line ??= ""; d.beats = Array.isArray(d.beats) ? d.beats : []; }
  }
  get title() { return `Story Script — ${this.state?.quest?.name || this.state?.key || "New"}`; }

  _campaign() { return game.bbttcc?.api?.campaign?.getCampaign?.(this.campaignId) || null; }
  _doneView(d) {
    if (!d || typeof d !== "object") return { kind: "any", value: "" };
    if (d.mark) return { kind: "mark", value: String(d.mark) };
    if (Array.isArray(d.anyOf)) return { kind: "anyOf", value: d.anyOf.join(", ") };
    if (Array.isArray(d.allOf)) return { kind: "allOf", value: d.allOf.join(", ") };
    if (Array.isArray(d.chapter)) return { kind: "chapter", value: d.chapter.join("/") };
    if (d.quest) return { kind: "quest", value: String(d.quest) };
    return { kind: "any", value: "" };
  }
  _doneFromView(kind, value) {
    const v = String(value || "").trim(); const list = v.split(/[,\s]+/).map(x => x.trim()).filter(Boolean);
    switch (kind) {
      case "mark":    return v ? { mark: v } : undefined;
      case "anyOf":   return list.length ? { anyOf: list } : undefined;
      case "allOf":   return list.length ? { allOf: list } : undefined;
      case "chapter": { const [q, c] = v.split("/").map(x => x.trim()); return (q && c) ? { chapter: [q, c] } : undefined; }
      case "quest":   return v ? { quest: v } : undefined;
      default:        return undefined;
    }
  }
  _stepRows(steps, path) {
    const chapters = Object.keys(this.state.quest.chapters || {});
    return steps.map((st, i) => { const dv = this._doneView(st.done); return {
      i, path: `${path}.${i}`, id: st.id, label: st.label, line: st.line, beats: (st.beats || []).join(", "), group: st.group || "", chapter: st.chapter || "", hereLine: st.hereLine || "",
      borrow: !!st.borrow, doneKind: dv.kind, doneValue: dv.value, chapters, first: i === 0, last: i === steps.length - 1
    }; });
  }
  getData() {
    const c = this._campaign();
    const beats = (c?.beats || []).map(b => ({ id: String(b.id || ""), label: String(b.label || b.id || "") })).filter(b => b.id).sort((a, b) => a.id.localeCompare(b.id));
    const regQuests = (() => { try { return (game.bbttcc.api.campaign.quests.listQuests?.({}) || []).map(q => ({ id: q.id, name: q.name })); } catch (_e) { return []; } })();
    const s = this.state.script, q = this.state.quest;
    const chapterRows = Object.entries(q.chapters || {}).map(([ck, ch]) => ({ key: ck, name: ch?.name || "", registryId: ch?.registryId || "", giver: s.chapters?.[ck]?.giver || "", line: s.chapters?.[ck]?.line || "" }));
    let json = ""; try { json = JSON.stringify({ key: this.state.key, quest: q, script: s }, null, 2); } catch (_e) {}
    return {
      TIPS, DONE_KINDS, campaignId: this.campaignId, campaignLabel: c?.label || this.campaignId, key: this.state.key, isNew: this.isNew, source: this.source,
      quest: q, script: s, hasArrival: !!s.arrival,
      steps: this._stepRows(s.steps, "script.steps"), arrivalSteps: s.arrival ? this._stepRows(s.arrival.steps, "script.arrival.steps") : [],
      doors: s.doors.map((d, i) => ({ i, path: `script.doors.${i}`, id: d.id, label: d.label, line: d.line, beats: (d.beats || []).join(", "), first: i === 0, last: i === s.doors.length - 1 })),
      after: (s.after || []).join(", "), chapterRows, beats, regQuests, json, findings: this.findings, jsonError: this.jsonError,
      registryName: regQuests.find(r => r.id === q.registryId)?.name || ""
    };
  }

  // ── binding: every [data-path] input writes into this.state; lists mutate + re-render ──
  activateListeners(html) {
    super.activateListeners(html);
    const $h = html instanceof jQuery ? html : $(html);
    const setP = (path, v) => foundry.utils.setProperty(this.state, path, v);
    $h.find("[data-path]").on("change", (ev) => {
      const el = ev.currentTarget, path = el.dataset.path, kind = el.dataset.kind || "text";
      let v = el.type === "checkbox" ? el.checked : el.value;
      if (kind === "int") v = Number.isFinite(Number(v)) ? Math.floor(Number(v)) : 0;
      if (kind === "ids") v = String(v).split(/[,\s]+/).map(x => x.trim()).filter(Boolean);
      if (kind === "key") v = String(v).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      if (path === "key") { this.state.key = v; return; }
      setP(path, v);
    });
    // done rule (two inputs → one object)
    $h.find("[data-done-kind],[data-done-value]").on("change", (ev) => {
      const row = ev.currentTarget.closest("[data-step-path]"); if (!row) return;
      const path = row.dataset.stepPath;
      const kind = row.querySelector("[data-done-kind]")?.value || "any", value = row.querySelector("[data-done-value]")?.value || "";
      const d = this._doneFromView(kind, value);
      const st = foundry.utils.getProperty(this.state, path); if (!st) return;
      if (d) st.done = d; else delete st.done;
      if (ev.currentTarget.hasAttribute("data-done-kind")) this.render(false);
    });
    // chapter rows (quest.chapters + script.chapters share the key)
    $h.find("[data-ch-field]").on("change", (ev) => {
      const el = ev.currentTarget, ck = el.dataset.chKey, f = el.dataset.chField;
      const q = this.state.quest, s = this.state.script;
      if (f === "key") {
        const nk = String(el.value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); if (!nk || nk === ck) return;
        q.chapters[nk] = q.chapters[ck]; delete q.chapters[ck];
        if (s.chapters?.[ck]) { s.chapters[nk] = s.chapters[ck]; delete s.chapters[ck]; }
        for (const st of [...s.steps, ...(s.arrival?.steps || [])]) if (st.chapter === ck) st.chapter = nk;
        this.render(false); return;
      }
      if (f === "name" || f === "registryId") { q.chapters[ck] ??= {}; if (el.value) q.chapters[ck][f] = el.value; else delete q.chapters[ck][f]; }
      else { s.chapters ??= {}; s.chapters[ck] ??= {}; if (el.value) s.chapters[ck][f] = el.value; else delete s.chapters[ck][f]; }
    });
    // list actions
    $h.find("[data-list-act]").on("click", (ev) => {
      ev.preventDefault();
      const el = ev.currentTarget, act = el.dataset.listAct, list = el.dataset.list, i = Number(el.dataset.index);
      const s = this.state.script, q = this.state.quest;
      const arr = list === "steps" ? s.steps : list === "arrival" ? (s.arrival ??= { act: 1, giver: "", description: "", steps: [] }).steps : list === "doors" ? s.doors : null;
      if (act === "add-chapter") { let n = 1; while (q.chapters[`chapter_${n}`]) n++; q.chapters[`chapter_${n}`] = { name: `Chapter ${n}` }; this.render(false); return; }
      if (act === "del-chapter") { const ck = el.dataset.chKey; delete q.chapters[ck]; if (s.chapters) delete s.chapters[ck]; for (const st of [...s.steps, ...(s.arrival?.steps || [])]) if (st.chapter === ck) delete st.chapter; this.render(false); return; }
      if (act === "add-arrival") { s.arrival ??= { act: 1, giver: "", description: "", steps: [] }; this.render(false); return; }
      if (act === "del-arrival") { delete s.arrival; this.render(false); return; }
      if (!arr) return;
      if (act === "add") { const n = arr.length + 1; arr.push(list === "doors" ? { id: `door_${n}`, label: "", line: "", beats: [] } : { id: `step_${n}`, label: "", line: "", beats: [] }); }
      else if (act === "del") arr.splice(i, 1);
      else if (act === "up" && i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; }
      else if (act === "down" && i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; }
      this.render(false);
    });
    // beat picker: datalist input appends an id to the row's beats
    $h.find("[data-pick-beat]").on("change", (ev) => {
      const el = ev.currentTarget, path = el.dataset.pickBeat, id = String(el.value || "").trim(); if (!id) return;
      const st = foundry.utils.getProperty(this.state, path); if (!st) return;
      st.beats = Array.isArray(st.beats) ? st.beats : []; if (!st.beats.includes(id)) st.beats.push(id);
      el.value = ""; this.render(false);
    });
    // JSON escape hatch
    $h.find("[data-action='json-load']").on("click", (ev) => {
      ev.preventDefault();
      try {
        const parsed = JSON.parse(String($h.find("textarea[name='json']").val() || ""));
        if (!parsed || typeof parsed !== "object") throw new Error("not an object");
        if (parsed.key) this.state.key = String(parsed.key);
        if (parsed.quest && typeof parsed.quest === "object") this.state.quest = parsed.quest;
        if (parsed.script && typeof parsed.script === "object") this.state.script = parsed.script;
        this._shape(); this.jsonError = ""; this.render(false);
      } catch (e) { this.jsonError = `JSON did not load: ${e?.message || e}`; this.render(false); }
    });
    $h.find("[data-action='validate']").on("click", (ev) => { ev.preventDefault(); this._validate(); this.render(false); });
    $h.find("[data-action='save']").on("click", async (ev) => { ev.preventDefault(); await this._save(); });
    $h.find("[data-action='remove']").on("click", async (ev) => {
      ev.preventDefault();
      const ok = await Dialog.confirm({ title: "Remove story data", content: `<p>Remove the authored quest + script for <b>${foundry.utils.escapeHTML(this.state.key)}</b> from this campaign? ${this.source === "code" || this.sourceWasCode ? "The shipped version returns." : "The Quest Log falls back to the registry description."}</p>` });
      if (!ok) return;
      try { await game.bbttcc.api.campaign.story.data.remove(this.campaignId, this.state.key); ui.notifications?.info?.("Story data removed."); this.close(); }
      catch (e) { console.error(TAG, e); ui.notifications?.error?.(e?.message || String(e)); }
    });
  }
  _validate() {
    const api = game.bbttcc?.api?.campaign;
    const key = String(this.state.key || "").trim();
    const F = [];
    if (!key) F.push({ rule: "Y00", sev: "ERROR", msg: "Story key is required." });
    if (!String(this.state.quest.name || "").trim()) F.push({ rule: "Y00", sev: "ERROR", msg: "Quest name is required." });
    const story = { quests: { [key]: this.state.quest }, scripts: { [key]: this.state.script } };
    try { F.push(...(api?.story?.data?.validate?.(this.campaignId, story) || [])); } catch (e) { F.push({ rule: "Y00", sev: "ERROR", msg: `validate failed: ${e?.message || e}` }); }
    this.findings = F.map(f => ({ ...f, isError: f.sev === "ERROR" }));
    return !this.findings.some(f => f.isError);
  }
  async _save() {
    if (!this._validate()) { this.render(false); return ui.notifications?.warn?.("Fix the errors first (warnings are fine)."); }
    const key = String(this.state.key || "").trim();
    // drop empty optional fields so the stored record stays clean
    const s = foundry.utils.deepClone(this.state.script);
    for (const st of [...s.steps, ...(s.arrival?.steps || [])]) for (const k of ["group", "chapter", "hereLine"]) if (!st[k]) delete st[k];
    if (!s.after?.length) delete s.after;
    if (s.arrival && !s.arrival.steps.length && !s.arrival.giver && !s.arrival.description) delete s.arrival;
    for (const ck of Object.keys(s.chapters || {})) if (!s.chapters[ck] || !Object.keys(s.chapters[ck]).length) delete s.chapters[ck];
    if (s.chapters && !Object.keys(s.chapters).length) delete s.chapters;
    if (!s.doors.length) delete s.doors;
    try {
      await game.bbttcc.api.campaign.story.data.saveQuest(this.campaignId, key, { quest: foundry.utils.deepClone(this.state.quest), script: s });
      this.isNew = false; this.sourceWasCode = this.source === "code"; this.source = "data";
      ui.notifications?.info?.(`Story script saved — ${this.state.quest.name}. The Quest Log reads it now.`);
      this.render(false);
    } catch (e) { console.error(TAG, "save failed", e); ui.notifications?.error?.(`Save failed: ${e?.message || e}`); }
  }
}
export default BBTTCCCampaignScriptEditorApp;

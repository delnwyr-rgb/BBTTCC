
// ---------------------------------------------------------------------------
// Auto-inject Unlock Rewards UI after Beat Editor render (AppV2-safe)
// - Late-load safe: runs on ready, and also immediately if game.ready is already true.
// - Replaces any prior hook id in globalThis so upgrades take effect.
// ---------------------------------------------------------------------------
function __bbttccInstallBeatEditorUnlockHook() {
  try {
    // If an older version installed a hook id, remove it so we can update behavior.
    try {
      const prev = globalThis.__bbttccUnlockRenderHookInstalled;
      if (prev != null) Hooks.off("renderBBTTCCCampaignBeatEditorApp", prev);
    } catch (e0) {}

    const hookId = Hooks.on("renderBBTTCCCampaignBeatEditorApp", (app, html) => {
      try {
        // Delay a tick so the tab DOM exists.
        setTimeout(() => {
          const arg = app?.element || html;
          try { if (typeof app._ensureUnlocksUI === "function") app._ensureUnlocksUI(arg); } catch (e1) { console.warn("[BBTTCC] unlock inject failed:", e1); }
          try { if (typeof app._ensureWorldModifiersUI === "function") app._ensureWorldModifiersUI(arg); } catch (e1b) { console.warn("[BBTTCC] world modifiers inject failed:", e1b); }
          try { if (typeof app._ensureRelationshipEffectsUI === "function") app._ensureRelationshipEffectsUI(arg); } catch (e1c) { console.warn("[BBTTCC] relationship effects inject failed:", e1c); }
          try { if (typeof app._ensureFactionGMEffectsUI === "function") app._ensureFactionGMEffectsUI(arg); } catch (e1d) { console.warn("[BBTTCC] faction GM effects inject failed:", e1d); }
          try { if (typeof app._ensureCasualtiesUI === "function") app._ensureCasualtiesUI(arg); } catch (e1e) { console.warn("[BBTTCC] casualties inject failed:", e1e); }
          try { if (typeof app._ensureTurnAssignUI === "function") app._ensureTurnAssignUI(arg); } catch (e2) { console.warn("[BBTTCC] turn assign inject failed:", e2); }
          try { if (typeof app._ensureAudioUI === "function") app._ensureAudioUI(arg); } catch (e2a) { console.warn("[BBTTCC] audio inject failed:", e2a); }
          try { __bbttccAutosizeAppWindow(app); } catch (e3) {}
        }, 50);
      } catch (e) {
        console.warn("[BBTTCC] render hook error:", e);
      }
    });

    globalThis.__bbttccUnlockRenderHookInstalled = hookId;
    console.log("[BBTTCC] Unlock Rewards render hook installed (late-load safe):", hookId);
  } catch (e) {
    console.warn("[BBTTCC] Failed to install unlock render hook:", e);
  }
}

Hooks.once("ready", __bbttccInstallBeatEditorUnlockHook);
try { if (game && game.ready) __bbttccInstallBeatEditorUnlockHook(); } catch (e) {}



// modules/bbttcc-campaign/apps/campaign-beat-editor.js

const TAG = "[bbttcc-campaign][BeatEditor]";


// Lazy loaders (avoid static imports to prevent parse issues in some Foundry launchers)
async function _loadScenePickerApp() {
  try {
    const mod = await import("./campaign-scene-picker.js");
    return mod?.BBTTCCCampaignScenePickerApp || mod?.default || null;
  } catch (e) {
    console.error(TAG, "Failed to load Scene Picker module:", e);
    return null;
  }
}
async function _loadActorPickerApp() {
  try {
    const mod = await import("./campaign-actor-picker.js");
    return mod?.BBTTCCCampaignActorPickerApp || mod?.default || null;
  } catch (e) {
    console.error(TAG, "Failed to load Actor Picker module:", e);
    return null;
  }
}
async function _loadTagPickerApp() {
  try {
    const mod = await import("./campaign-tag-picker.js");
    return mod?.BBTTCCCampaignTagPickerApp || mod?.default || null;
  } catch (e) {
    console.error(TAG, "Failed to load Tag Picker module:", e);
    return null;
  }
}


// ---------------------------------------------------------------------------
// Window autosize helper (AppV2 / Application)
// Fixes clipped footers when dynamic panels inject content after initial render.
// Safe, no modern syntax.
// ---------------------------------------------------------------------------
function __bbttccAutosizeAppWindow(app, opts) {
  try {
    opts = opts || {};
    var pad = (opts.pad == null) ? 28 : opts.pad;
    var minH = (opts.minH == null) ? 320 : opts.minH;
    var maxH = (opts.maxH == null) ? Math.floor(window.innerHeight * 0.92) : opts.maxH;

    var el =
      (app && app.element && app.element[0] instanceof HTMLElement) ? app.element[0] :
      (app && app.element instanceof HTMLElement) ? app.element :
      null;
    if (!el) return;

    // prefer .window-content for measurement
    var header = el.querySelector("header.window-header");
    var content = el.querySelector(".window-content") || el;

    if (content && content.style) content.style.overflowY = "auto";

    var hHeader = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    var hContent = content ? Math.ceil(content.scrollHeight) : 0;

    var target = hHeader + hContent + pad;
    if (target < minH) target = minH;
    if (target > maxH) target = maxH;

    if (typeof app.setPosition === "function") app.setPosition({ height: target });
  } catch (_e) {}
}

function _boolFromSelect(v, fallback = false) {
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}
function _triFromSelect(v) {
  if (v === "inherit" || v === "" || v == null) return "inherit";
  if (v === "true") return true;
  if (v === "false") return false;
  return "inherit";
}
function _tagArray(tagStr) {
  return String(tagStr || "").split(/\s+/g).map(s => s.trim()).filter(Boolean);
}
function _normalizeTags(tagStr) {
  const arr = _tagArray(tagStr);
  const seen = new Set();
  const out = [];
  for (const t of arr) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.join(" ");
}
function _canonAuthorTag(tag) {
  const t = String(tag || "").trim();
  if (!t) return "";
  const low = t.toLowerCase();
  const map = {
    "trigger.travel_threshold": "inject.travel_threshold",
    "travel_threshold": "inject.travel_threshold",
    "enforcement": "inject.enforcement",
    "debt": "inject.debt_pressure",
    "hv.hidden_vault": "theme.discovery",
    "gilbert": "theme.auditor",
    "auditor": "theme.auditor",
    "locals": "theme.locals",
    "denizens": "theme.denizens",
    "machine_logic": "theme.machine_logic",
    "exploitation": "theme.exploitation"
  };
  return map[low] || low;
}
function _canonPoliticalTag(tag) {
  const t = String(tag || "").trim().toLowerCase();
  if (!t) return "";
  return t.indexOf("politics.") === 0 ? t : ("politics." + t);
}
function _safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function _safeJson(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}
function _getFormField(el, selector) {
  try { return el?.find?.(selector)?.[0] ?? null; } catch (e) { return null; }
}
function _getTagsField(rootEl) {
  return _getFormField(rootEl, "textarea[name='tags'], input[name='tags']");
}
function _setTagsValue(app, next) {
  const normalized = _normalizeTags(_tagArray(next || "").map(_canonAuthorTag).filter(Boolean).join(" "));
  app.beat.tags = normalized;
  const field = _getTagsField(app.element);
  if (field) field.value = normalized;
}

function _first(rootEl, selector) {
  try { return rootEl?.find?.(selector)?.[0] ?? null; } catch (e) { return null; }
}

function _getPoliticalTagsField(rootEl) {
  // Supports either textarea or input, depending on template.
  return _first(rootEl, "textarea[name='politicalTags'], input[name='politicalTags']");
}
function _setPoliticalTagsValue(app, next) {
  const normalized = _normalizeTags(_tagArray(next || "").map(_canonPoliticalTag).filter(Boolean).join(" "));
  app.beat.politicalTags = normalized;
  const field = _getPoliticalTagsField(app.element);
  if (field) field.value = normalized;
}

// Journal helpers
function _normalizeJournalId(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (s.indexOf("JournalEntry.") === 0) return s.slice("JournalEntry.".length);
  return s;
}
function _normalizeJournalUuid(v) {
  const id = _normalizeJournalId(v);
  return id ? `JournalEntry.${id}` : "";
}
function _escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* -------------------------------------------------------------------------
 * Unlocks catalog helpers
 *  - Source of truth: game.bbttcc.api.raid.EFFECTS
 *  - We filter to maneuvers/strategics and keep a stable, sorted list.
 * ------------------------------------------------------------------------- */
function _effectsCatalog(kind) {
  kind = String(kind || "").trim().toLowerCase();
  const out = [];
  try {
    const raid = game && game.bbttcc && game.bbttcc.api ? game.bbttcc.api.raid : null;
    const EFFECTS = raid && raid.EFFECTS ? raid.EFFECTS : {};
    for (const [key, def] of Object.entries(EFFECTS)) {
      if (!def) continue;
      if (String(def.kind || "").toLowerCase() !== kind) continue;
      const label = String(def.label || key).trim() || String(key);
      out.push({
        key: String(key),
        label: label,
        source: String(def.source || def.band || "").trim() || "",
        rarity: String(def.rarity || "").trim() || "",
        tier: (def.tier != null ? Number(def.tier) : null),
        primaryKey: String(def.primaryKey || def.primaryOp || "").trim() || ""
      });
    }
  } catch (e) { /* ignore */ }
  out.sort((a, b) => (a.label || "").localeCompare(b.label || "") || (a.key || "").localeCompare(b.key || ""));
  return out;
}

function _normKeySet(arr) {
  const out = new Set();
  const src = Array.isArray(arr) ? arr : [];
  for (const v of src) {
    const k = String(v || "").trim();
    if (!k) continue;
    out.add(k);
  }
  return out;
}

function _setFromChecks(container, kindName) {
  const boxes = container ? container.querySelectorAll('input[type="checkbox"][data-unlock-kind="' + kindName + '"][data-unlock-key]') : [];
  const out = [];
  for (const cb of boxes) {
    if (!cb.checked) continue;
    const k = String(cb.getAttribute("data-unlock-key") || "").trim();
    if (k) out.push(k);
  }
  return out;
}

// -------------------------------------------------------------------------
// Hex picker helpers (current scene only)
// -------------------------------------------------------------------------
function _listCurrentSceneHexes() {
  const out = [];
  try {
    const MOD_T = "bbttcc-territory";
    const draws = (canvas && canvas.drawings && canvas.drawings.placeables) ? canvas.drawings.placeables : [];
    for (let i = 0; i < draws.length; i++) {
      const p = draws[i];
      const doc = p ? p.document : null;
      const tf = (doc && doc.flags && doc.flags[MOD_T]) ? doc.flags[MOD_T] : null;
      if (!tf || typeof tf !== "object") continue;

      const uuid = String(doc.uuid || "").trim();
      if (!uuid) continue;

      const name = String(tf.name || doc.text || doc.name || "(hex)").trim();
      const type = String(tf.type || "").trim();
      const terr = tf.terrain;
      const tKey = (terr && typeof terr === "object") ? String(terr.key || "") : "";

      const bits = [];
      if (type) bits.push(type);
      if (tKey) bits.push(tKey);
      const meta = bits.length ? (" — " + bits.join(" · ")) : "";

      out.push({ uuid, label: name + meta });
    }
  } catch (e) {
    // ignore
  }
  out.sort((a, b) => String(a.label || "").localeCompare(String(b.label || "")));
  return out;
}


/**
 * Political Tag Catalog (AAE)
 * We try to pull the latest catalog from the AAE API at runtime.
 * Fallback to a conservative built-in list if the API doesn't expose one.
 */
const POLITICAL_TAG_CATALOG_FALLBACK = [
  // Broad/neutral governance
  { key: "order",              label: "Order",              hint: "Prioritize stability and control." },
  { key: "security",           label: "Security",           hint: "Protect against threats; safety-first framing." },
  { key: "surveillance",       label: "Surveillance",       hint: "Monitoring, informants, tracking." },
  { key: "repression",         label: "Repression",         hint: "Crackdowns, censorship, suppression of dissent." },

  // Economic distribution
  { key: "redistribution",     label: "Redistribution",     hint: "Transfer wealth/resources to reduce inequality." },
  { key: "privatization",      label: "Privatization",      hint: "Shift assets/services to private control." },
  { key: "deregulation",       label: "Deregulation",       hint: "Reduce rules; increase market freedom." },
  { key: "welfare",            label: "Welfare",            hint: "Social support, safety nets, public aid." },

  // Labor / collective power
  { key: "union_power",        label: "Union Power",        hint: "Organized labor, collective bargaining." },
  { key: "collectivize",       label: "Collectivize",       hint: "Collective ownership/management." },

  // Rights / liberties
  { key: "civil_liberties",    label: "Civil Liberties",    hint: "Speech, assembly, due process protections." },
  { key: "property_rights",    label: "Property Rights",    hint: "Strong private ownership and enforcement." },

  // Religion / doctrine
  { key: "faith_law",          label: "Faith Law",          hint: "Religious doctrine shaping law and policy." },
  { key: "clerical_rule",      label: "Clerical Rule",      hint: "Priesthood/temple authority in governance." },

  // Nationalism / supremacy
  { key: "ethnonationalism",   label: "Ethnonationalism",   hint: "In-group supremacy; purity politics." },
  { key: "purge",              label: "Purge",              hint: "Removal of enemies; scapegoating; cleansing." },

  // Anti-state / decentralization
  { key: "mutual_aid",         label: "Mutual Aid",         hint: "Community self-support outside institutions." },
  { key: "decentralize",       label: "Decentralize",       hint: "Local control; dismantle central authority." }
];

function _getPoliticalTagCatalog() {
  try {
    const aae = game?.bbttcc?.api?.aae;
    if (aae?.getPoliticalTagCatalog) {
      const c = aae.getPoliticalTagCatalog();
      if (Array.isArray(c) && c.length) return c;
    }
    // Alternate shapes (if exposed as consts)
    const maybe =
      aae?.POLITICAL_TAG_CATALOG ||
      aae?.politicalTagCatalog ||
      aae?.tagCatalogPolitical ||
      null;
    if (Array.isArray(maybe) && maybe.length) return maybe;
  } catch (e) {
    // swallow; fallback below
  }
  return POLITICAL_TAG_CATALOG_FALLBACK;
}

const TAG_CATALOG = [
  { key: "trigger.travel_threshold", label: "Travel Threshold", hint: "Eligible for travel threshold injection." },
  { key: "hv.hidden_vault",          label: "Hidden Vault",     hint: "Vault thread content." },
  { key: "locals",                   label: "Locals",          hint: "Thread A grouping." },
  { key: "machine_logic",            label: "Machine Logic",   hint: "Thread B grouping." },
  { key: "denizens",                 label: "Denizens",        hint: "Thread C grouping." },
  { key: "exploitation",            label: "Exploitation",    hint: "Thread D grouping." },
  { key: "gilbert",                  label: "Gilbert",         hint: "Thread E / auditor grouping." },
  { key: "enforcement",              label: "Enforcement",     hint: "Escalation / enforcement beats." },
  { key: "debt",                     label: "Debt",            hint: "Debt pressure beats." },
  { key: "convergence",              label: "Convergence",     hint: "Convergence beats / stubs." }

// Casualties (Beat Outcome)
,{ key: "casualties.hex:minor",         label: "Casualties — Hex: Minor",         hint: "Apply minor collateral casualties to the target hex." }
,{ key: "casualties.hex:moderate",      label: "Casualties — Hex: Moderate",      hint: "Apply moderate casualties to the target hex." }
,{ key: "casualties.hex:major",         label: "Casualties — Hex: Major",         hint: "Apply major casualties (integration/dev impact) to the target hex." }
,{ key: "casualties.hex:catastrophic",  label: "Casualties — Hex: Catastrophic",  hint: "Apply catastrophic devastation to the target hex." }
,{ key: "casualties.attacker:minor",        label: "Casualties — Attacker: Minor",        hint: "Apply minor attacker losses (war weariness)." }
,{ key: "casualties.attacker:moderate",     label: "Casualties — Attacker: Moderate",     hint: "Apply moderate attacker losses (Morale -1)." }
,{ key: "casualties.attacker:major",        label: "Casualties — Attacker: Major",        hint: "Apply major attacker losses (Morale/Loyalty)." }
,{ key: "casualties.attacker:catastrophic", label: "Casualties — Attacker: Catastrophic", hint: "Apply catastrophic attacker losses (Morale/Loyalty/Victory)." }
,{ key: "casualties.defender:minor",        label: "Casualties — Defender: Minor",        hint: "Apply minor defender losses (optional symmetry)." }
,{ key: "casualties.defender:moderate",     label: "Casualties — Defender: Moderate",     hint: "Apply moderate defender losses." }
,{ key: "casualties.defender:major",        label: "Casualties — Defender: Major",        hint: "Apply major defender losses." }
,{ key: "casualties.defender:catastrophic", label: "Casualties — Defender: Catastrophic", hint: "Apply catastrophic defender losses." }
,{ key: "casualties.atrocity",              label: "Casualties — Atrocity",              hint: "Marks the act as cruelty/atrocity; can spike Darkness on Major+ outcomes." }
];

// Handlebars helpers (Beat Editor)
Hooks.once("init", () => {
  try {
    const H = globalThis.Handlebars;
    if (!H) return;
    if (!H.helpers.contains) H.registerHelper("contains", (arr, val) => Array.isArray(arr) && arr.includes(val));
  } catch (e) {}
});

export class BBTTCCCampaignBeatEditorApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "bbttcc-campaign-beat-editor",
      title: "Edit Beat",
      template: "modules/bbttcc-campaign/templates/campaign-beat-editor.hbs",
      width: 1180,
      height: "auto",
      resizable: true,
      popOut: true,
      classes: ["bbttcc", "bbttcc-hexchrome", "bbttcc-campaign-beat-editor"]
    });
  }

  constructor(options = {}) {
    super(options);
    this.campaignId = options.campaignId || null;
    this.beat = foundry.utils.deepClone(options.beat || {});
    // Player-facing dialog compatibility:
    // Normalize from legacy aliases and keep a single source of truth on beat.playerFacing.
    this.beat.playerFacing = !!(
      this.beat.playerFacing ||
      this.beat.playerFacingDialog ||
      this.beat.dialogPlayerFacing ||
      this.beat.playerFacingContent ||
      this.beat.showToPlayers
    );
    // Track the starting id so the builder can treat id-changes as renames (not inserts).
    this._originalBeatId = String(this.beat?.id || "").trim();
    this.beat.inject ??= {};
    this.beat.outcomes ??= { success: null, failure: null };
    this.beat.actors ??= [];
    this.beat.choices ??= [];
    this.beat.encounter ??= { key: "", tier: null, actorName: "" };

    // Quest linkage (Questlines)
    // Stored as: beat.questId (string), beat.questStep (int), beat.questRole (string)
    this.beat.questId = String(this.beat.questId || "").trim() || null;
    var qs = Number(this.beat.questStep ?? 0);
    if (!isFinite(qs) || qs < 0) qs = 0;
    this.beat.questStep = qs ? Math.floor(qs) : null;
    this.beat.questRole = String(this.beat.questRole || "").trim() || null;


    // Optional: target hex UUID (for world modifiers / territory effects)
    // Stored as: beat.targetHexUuid (Drawing/Tile UUID string) or null.
    this.beat.targetHexUuid = String(this.beat.targetHexUuid || "").trim() || null;

    // Campaign Turn Flow (Phase 1): beats can be assigned to a Strategic Turn number.
    // Stored as: beat.turnNumber (integer >= 1) or null/0 for "unassigned".
    // Used for Campaign Builder grouping/filtering and for turn-advance announcements.
    var tn = Number(this.beat.turnNumber ?? this.beat.turn ?? this.beat.availableTurn ?? 0);
    if (!isFinite(tn) || tn < 1) tn = 0;
    this.beat.turnNumber = tn ? Math.floor(tn) : null;

    // Cinematic beats (two-scene timed chain)
    // Stored as: beat.cinematic = { enabled, startSceneId, durationMs, nextSceneId }
    this.beat.cinematic ??= { enabled: false, startSceneId: null, durationMs: 8000, nextSceneId: null };
    this.beat.cinematic.enabled = !!this.beat.cinematic.enabled;
    this.beat.cinematic.startSceneId = String(this.beat.cinematic.startSceneId || "").trim() || null;
    this.beat.cinematic.nextSceneId = String(this.beat.cinematic.nextSceneId || "").trim() || null;
    this.beat.cinematic.durationMs = Math.max(0, Math.floor(Number(this.beat.cinematic.durationMs || 0))) || 0;

    // Legacy compat: older cinematic beats stored the start scene in beat.sceneId.
    // If we have a cinematic beat with no explicit startSceneId, migrate sceneId -> startSceneId,
    // then clear sceneId so the Linked Scene field stays blank for cinematics.
    try {
      const isCine = (String(this.beat.type || "").trim() === "cinematic") || !!(this.beat.cinematic && this.beat.cinematic.enabled);
      const legacyScene = String(this.beat.sceneId || "").trim();
      const hasStart = String(this.beat.cinematic.startSceneId || "").trim();
      if (isCine && legacyScene && !hasStart) this.beat.cinematic.startSceneId = legacyScene;
      if (isCine) this.beat.sceneId = null;
    } catch (_eCineLegacy) {}

    this.beat.worldEffects ??= {
      territoryOutcome: null,
      factionEffects: [],
      radiationDelta: 0,
      sparkKey: null,
      turnRequests: [],
      questEffects: [],
      warLog: ""
    };

    // Journal (auto-open on run)
    this.beat.journal ??= { enabled: false, entryId: null, force: false };
    this.beat.journal.enabled = !!this.beat.journal.enabled;
    this.beat.journal.force = !!this.beat.journal.force;
    this.beat.journal.entryId = String(this.beat.journal.entryId || "").trim() || null;

    this.activeTab = options.activeTab || "core";
    this.showAdvancedTags = false;
  }

  async getData() {
    const data = await super.getData();

    const beatTypes = ["scene_transition", "dialog", "skill_scene", "encounter", "travel", "outcome_trigger", "custom", "cinematic"];
    const timeScales = ["moment", "scene", "leg", "turn", "arc", "campaign"];

    // Turn number dropdown (best-effort): offer 1..maxTurn found in the campaign so far.
    // If no campaign data is available, fall back to 1..20.
    let turnOptions = [];
    try {
      const api = game.bbttcc?.api?.campaign;
      const c = (this.campaignId && api?.getCampaign) ? api.getCampaign(this.campaignId) : null;
      const beats = Array.isArray(c?.beats) ? c.beats : [];
      let maxT = 0;
      for (const b of beats) {
        const n = Number(b?.turnNumber ?? b?.turn ?? b?.availableTurn ?? 0);
        if (isFinite(n) && n > maxT) maxT = n;
      }
      // Ensure we always show at least up to the current world turn if available.
      try {
        const w = game.bbttcc?.api?.world;
        const curT = w?.getState ? Number((w.getState() || {}).turn || 0) : 0;
        if (isFinite(curT) && curT > maxT) maxT = curT;
      } catch (_e2) {}
      if (!maxT) maxT = 20;
      maxT = Math.min(Math.max(1, Math.floor(maxT)), 50);
      for (let i = 1; i <= maxT; i++) turnOptions.push(i);
    } catch (e) {
      for (let i = 1; i <= 20; i++) turnOptions.push(i);
    }

    let beatIdOptions = [];
    try {
      const api = game.bbttcc?.api?.campaign;
      const c = (this.campaignId && api?.getCampaign) ? api.getCampaign(this.campaignId) : null;
      beatIdOptions = Array.isArray(c?.beats)
        ? c.beats.map(b => ({ id: b.id, label: b.label || b.id })).sort((a, b) => a.label.localeCompare(b.label))
        : [];
    } catch (e) { }

    // Current-scene hex options
    let hexOptions = [];
    try {
      hexOptions = _listCurrentSceneHexes().map(h => ({
        id: String(h.uuid || "").trim(),
        label: String(h.label || h.uuid || "").trim()
      })).filter(h => !!h.id);
    } catch (e) {
      hexOptions = [];
    }

    // Faction options
    let factionOptions = [];
    try {
      const actors = Array.isArray(game?.actors?.contents) ? game.actors.contents : [];
      factionOptions = actors
        .filter(a => {
          try {
            if (!a) return false;
            if (a.type === "faction") return true;
            const f = a.flags && (a.flags["bbttcc-factions"] || a.flags.bbttccFactions);
            return !!f;
          } catch (_e) { return false; }
        })
        .map(a => ({ id: String(a.id || "").trim(), label: String(a.name || a.id || "").trim() }))
        .filter(a => !!a.id)
        .sort((a, b) => a.label.localeCompare(b.label));
    } catch (e) {
      factionOptions = [];
    }

    // Territory outcome options (Resolution Engine canon)
    const territoryOutcomeOptions = [
      { id: "", label: "(None)" },
      { id: "justice_reformation", label: "Justice Reformation" },
      { id: "liberation", label: "Liberation" },
      { id: "best_friends_integration", label: "Best Friends Integration" },
      { id: "retribution_subjugation", label: "Retribution / Subjugation" },
      { id: "salt_the_earth", label: "Salt the Earth" }
    ];

    // Spark options (best-effort; extend as your canon grows)
    const sparkKeyOptions = [
      { id: "", label: "(None)" },
      { id: "spark_shattered_chorus", label: "Shattered Chorus" }
    ];

    // Quest options (Campaign quest registry)
    let questOptions = [];
    try {
      const api = game.bbttcc?.api?.campaign;
      const qapi = api?.quests;
      questOptions = qapi?.listQuests ? qapi.listQuests({ campaignId: this.campaignId, status: "all" }) : [];
      if (!Array.isArray(questOptions)) questOptions = [];
      questOptions = questOptions.map(q => ({
        id: String(q.id || "").trim(),
        name: String(q.name || q.id || "").trim(),
        status: String(q.status || "active").trim()
      })).filter(q => !!q.id);
    } catch (e) {
      questOptions = [];
    }

    // Generic target options for structured turn requests
    const requestTargetOptions = []
      .concat([{ id: "", label: "(None)" }])
      .concat(hexOptions.map(x => ({ id: x.id, label: "Hex — " + x.label })))
      .concat(factionOptions.map(x => ({ id: x.id, label: "Faction — " + x.label })))
      .concat(questOptions.map(x => ({ id: x.id, label: "Quest — " + x.name })))
      .concat(beatIdOptions.map(x => ({ id: x.id, label: "Beat — " + x.label + " (" + x.id + ")" })));

// Choice checks: expose the full D&D 5E roll gamut (skills, abilities, saves) plus ALL BBTTCC OP tracks,
// and a GM-adjudication mode for table-resolved outcomes.
//
// Runtime expectations (bbttcc-campaign/scripts/module.js):
// - Skills: use canonical DND5E skill ids (e.g., "sur", "nat").
// - Abilities: use ability keys ("str", "dex", "con", "int", "wis", "cha").
// - Saves: use "save.<abil>" (e.g., "save.wis").
// - OP: use "op.<key>" (e.g., "op.logistics").
// - GM adjudication: use "gm" (no automated roll; GM chooses success/fail).

    // Prefer system config labels when available (keeps in sync with DND5E translations/customizations)
    let skillKeyed = null;
    try {
      const cfgSkills = CONFIG?.DND5E?.skills;
      if (cfgSkills && typeof cfgSkills === "object") {
        const entries = Object.entries(cfgSkills)
          .map(([k, v]) => {
            if (typeof v === "string") return [k, v];
            if (v && typeof v === "object") return [k, String(v.label || v.name || v.title || v.value || "").trim()];
            return [k, ""];
          })
          .filter(([, label]) => !!String(label || "").trim());

        if (entries.length >= 12) {
          skillKeyed = entries.map(([k, label]) => ({ key: String(k).trim(), label: String(label).trim() }));
        }
      }
    } catch (e) { /* ignore */ }

    // Fallback skills (if CONFIG isn't available for some reason)
    const baseSkills = [
      { key: "acr", label: "Acrobatics" },
      { key: "ani", label: "Animal Handling" },
      { key: "arc", label: "Arcana" },
      { key: "ath", label: "Athletics" },
      { key: "dec", label: "Deception" },
      { key: "his", label: "History" },
      { key: "ins", label: "Insight" },
      { key: "itm", label: "Intimidation" },
      { key: "inv", label: "Investigation" },
      { key: "med", label: "Medicine" },
      { key: "nat", label: "Nature" },
      { key: "prc", label: "Perception" },
      { key: "prf", label: "Performance" },
      { key: "per", label: "Persuasion" },
      { key: "rel", label: "Religion" },
      { key: "slt", label: "Sleight of Hand" },
      { key: "ste", label: "Stealth" },
      { key: "sur", label: "Survival" }
    ];

    const abilityOptions = [
      { key: "str", label: "Strength (Check)" },
      { key: "dex", label: "Dexterity (Check)" },
      { key: "con", label: "Constitution (Check)" },
      { key: "int", label: "Intelligence (Check)" },
      { key: "wis", label: "Wisdom (Check)" },
      { key: "cha", label: "Charisma (Check)" }
    ];

    const saveOptions = [
      { key: "save.str", label: "Strength Save" },
      { key: "save.dex", label: "Dexterity Save" },
      { key: "save.con", label: "Constitution Save" },
      { key: "save.int", label: "Intelligence Save" },
      { key: "save.wis", label: "Wisdom Save" },
      { key: "save.cha", label: "Charisma Save" }
    ];

    const opOptions = [
      { key: "op.violence",    label: "OP: Violence" },
      { key: "op.nonlethal",   label: "OP: Nonlethal" },
      { key: "op.intrigue",    label: "OP: Intrigue" },
      { key: "op.economy",     label: "OP: Economy" },
      { key: "op.softpower",   label: "OP: Soft Power" },
      { key: "op.diplomacy",   label: "OP: Diplomacy" },
      { key: "op.logistics",   label: "OP: Logistics" },
      { key: "op.cult",        label: "OP: Cult" },
      { key: "op.faith",       label: "OP: Faith" }
    ];

    const skills = (Array.isArray(skillKeyed) && skillKeyed.length)
      ? skillKeyed.slice().sort((a, b) => a.label.localeCompare(b.label))
      : baseSkills.slice().sort((a, b) => a.label.localeCompare(b.label));

    // Single list for the template dropdown.
    const skillStatOptions = [
      // GM adjudication (table resolved)
      { key: "gm", label: "GM Adjudication (pass/fail)" },

      // Abilities
      ...abilityOptions,

      // Saves
      ...saveOptions,

      // Skills
      ...skills,

      // OP tracks (BBTTCC)
      ...opOptions
    ];

    const tagChips = _tagArray(this.beat.tags || "").map(_canonAuthorTag);
    const politicalTagChips = _tagArray(this.beat.politicalTags || "").map(_canonPoliticalTag);

    const inject = this.beat.inject ?? {};
    inject.cooldownTurns ??= 0;
    inject.repeatable ??= true;
    inject.oncePerHex ??= false;
    inject.promptGM ??= "inherit";
    inject.fallbackOnDecline ??= "inherit";
    inject.allowMulti ??= "inherit";
    inject.oncePerHexGlobal ??= "inherit";

    
    let sceneName = null;
    try {
      const raw = String(this.beat.sceneId || "").trim();
      let scene = null;
      if (raw) {
        if (raw.includes(".")) scene = await fromUuid(raw);
        else scene = game.scenes?.get?.(raw) || null;
        if (!scene && !raw.includes(".")) {
          try { scene = await fromUuid(`Scene.${raw}`); } catch (e) { }
        }
      }
      sceneName = scene?.name || null;
    } catch (e) { }

    // Cinematic scenes (start/next) names for display
    let cinematicStartName = null;
    let cinematicNextName = null;
    try {
      const _resolveSceneName = async (raw) => {
        const s = String(raw || "").trim();
        if (!s) return null;
        let sc = null;
        if (s.includes(".")) sc = await fromUuid(s);
        else sc = game.scenes?.get?.(s) || null;
        if (!sc && !s.includes(".")) {
          try { sc = await fromUuid(`Scene.${s}`); } catch (e) { }
        }
        return sc?.name || null;
      };

      const cin = this.beat.cinematic || {};
      cinematicStartName = await _resolveSceneName(cin.startSceneId || "");
      cinematicNextName  = await _resolveSceneName(cin.nextSceneId || "");
    } catch (e) {
      /* ignore cinematic scene resolution errors */
    }


    // Journal name
    let journalName = null;
    try {
      const jRaw = String(this.beat?.journal?.entryId || "").trim();
      const jId = _normalizeJournalId(jRaw);
      const je = (jId && game.journal) ? (game.journal.get(jId) || null) : null;
      journalName = je?.name || null;
    } catch (e) { }

    const hasChoices = Array.isArray(this.beat.choices) && this.beat.choices.length > 0;

    const worldEffects = foundry.utils.deepClone(this.beat.worldEffects ?? {});

    // Unlock catalogs (sourced from raid.EFFECTS)
    const unlockCatalogManeuvers = _effectsCatalog("maneuver");
    const unlockCatalogStrategics = _effectsCatalog("strategic");
    worldEffects.factionEffects ??= [];
    worldEffects.turnRequests ??= [];
    worldEffects.radiationDelta ??= 0;
    worldEffects.warLog ??= "";

    return {
      ...data,
      campaignId: this.campaignId,
      beat: this.beat,
      beatPlayerFacing: !!this.beat.playerFacing,

      activeTab: this.activeTab,
      showAdvancedTags: this.showAdvancedTags,

      beatTypes,
      timeScales,
      turnOptions,
      beatIdOptions,
      questOptions,
      skillStatOptions,

      inject,
      tagChips,
      politicalTagChips,
      tagCatalog: TAG_CATALOG,

      sceneName,
      cinematicStartName,
      cinematicNextName,
      journalName,
      hasChoices,

      worldEffects,
      unlockCatalogManeuvers,
      unlockCatalogStrategics,
      hexOptions,
      factionOptions,
      territoryOutcomeOptions,
      sparkKeyOptions,
      requestTargetOptions
    };
  }

  // -----------------------------------------------------------------------
  // Unlocks UI (Checklists) — anchored in the World Effects tab
  // - Injected at render-time so we don't require template edits.
  // - Writes to hidden form fields: unlock-maneuvers / unlock-strategics
  // -----------------------------------------------------------------------
  _ensureUnlocksUI(html) {
    try {
      const root = (html && html[0]) ? html[0] : html;
      if (!root) return;

      // Avoid double-injection on re-render
      if (root.querySelector("[data-bbttcc-unlocks='1']")) return;

      const form = root.querySelector("form.bbttcc-beat-editor-form") || root.querySelector("form");
      if (!form) return;

      // Target: World Effects tab panel
      const effectsPanel =
        root.querySelector('.bbttcc-tab-panel[data-tab="effects"]') ||
        root.querySelector('section.bbttcc-tab-panel[data-tab="effects"]') ||
        root.querySelector('[data-tab="effects"]') ||
        null;

      // If panel exists, inject near the bottom, before War Log Note group if present.
      let insertBefore = null;
      if (effectsPanel) {
        const warlog = effectsPanel.querySelector('textarea[name="world-warlog"]') || null;
        insertBefore = warlog ? (warlog.closest(".form-group") || warlog.parentElement) : null;
      }

      const wrap = document.createElement("div");
      wrap.setAttribute("data-bbttcc-unlocks", "1");
      wrap.style.marginTop = "10px";
      wrap.style.padding = "10px";
      wrap.style.border = "1px solid rgba(148,163,184,0.25)";
      wrap.style.borderRadius = "12px";
      wrap.style.background = "rgba(2,6,23,0.25)";

      const title = document.createElement("div");
      title.textContent = "Unlock Rewards (Faction Outcome)";
      title.style.fontWeight = "800";
      title.style.marginBottom = "6px";
      title.style.letterSpacing = "0.02em";
      wrap.appendChild(title);

      const hint = document.createElement("div");
      hint.textContent = "Grant maneuvers and/or strategic activities when this beat resolves. Stored on the faction as narrative unlocks.";
      hint.style.fontSize = "12px";
      hint.style.opacity = "0.8";
      hint.style.marginBottom = "8px";
      wrap.appendChild(hint);

      // Hidden fields (source of truth for Save)
      const hidM = document.createElement("input");
      hidM.type = "hidden";
      hidM.name = "unlock-maneuvers";
      const hidS = document.createElement("input");
      hidS.type = "hidden";
      hidS.name = "unlock-strategics";
      form.appendChild(hidM);
      form.appendChild(hidS);

      // Current selections
      this.beat.unlocks = this.beat.unlocks || { maneuvers: [], strategics: [] };
      const curM = _normKeySet(this.beat.unlocks.maneuvers);
      const curS = _normKeySet(this.beat.unlocks.strategics);

      const grid = document.createElement("div");
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "1fr 1fr";
      grid.style.gap = "10px";
      wrap.appendChild(grid);

      const mkPane = (labelText, kind, catalog, curSet) => {
        const pane = document.createElement("div");
        pane.style.border = "1px solid rgba(148,163,184,0.18)";
        pane.style.borderRadius = "12px";
        pane.style.padding = "8px";
        pane.style.background = "rgba(15,23,42,0.35)";

        const lab = document.createElement("div");
        lab.textContent = labelText;
        lab.style.fontWeight = "700";
        lab.style.marginBottom = "6px";
        pane.appendChild(lab);

        const search = document.createElement("input");
        search.type = "text";
        search.placeholder = "Filter…";
        search.style.width = "100%";
        search.style.marginBottom = "6px";
        pane.appendChild(search);

        const list = document.createElement("div");
        list.style.maxHeight = "220px";
        list.style.overflow = "auto";
        list.style.paddingRight = "4px";
        pane.appendChild(list);

        const renderList = () => {
          const term = String(search.value || "").toLowerCase().trim();
          list.replaceChildren();

          const rows = (catalog || []).filter(r => {
            if (!term) return true;
            const hay = (String(r.label) + " " + String(r.key)).toLowerCase();
            return hay.includes(term);
          });

          if (!rows.length) {
            const none = document.createElement("div");
            none.textContent = "No matches.";
            none.style.opacity = "0.75";
            none.style.fontSize = "12px";
            list.appendChild(none);
            return;
          }

          for (const r of rows) {
            const row = document.createElement("label");
            row.style.display = "flex";
            row.style.alignItems = "center";
            row.style.gap = "8px";
            row.style.padding = "4px 2px";
            row.style.borderBottom = "1px solid rgba(148,163,184,0.08)";

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.setAttribute("data-unlock-kind", kind);
            cb.setAttribute("data-unlock-key", r.key);
            cb.name = (kind === "maneuvers") ? "unlock-maneuver" : "unlock-strategic";
            cb.value = r.key;
            cb.checked = curSet.has(r.key);

            const txt = document.createElement("div");
            txt.style.display = "flex";
            txt.style.flexDirection = "column";

            const top = document.createElement("div");
            top.textContent = r.label;
            top.style.fontWeight = "600";

            const meta = document.createElement("div");
            const bits = [];
            if (r.primaryKey) bits.push(r.primaryKey);
            if (r.tier != null && Number.isFinite(r.tier)) bits.push("T" + String(r.tier));
            if (r.rarity) bits.push(r.rarity);
            if (r.source) bits.push(r.source);
            meta.textContent = bits.join(" • ");
            meta.style.fontSize = "11px";
            meta.style.opacity = "0.75";

            txt.appendChild(top);
            if (meta.textContent) txt.appendChild(meta);

            row.appendChild(cb);
            row.appendChild(txt);
            list.appendChild(row);
          }
        };

        search.addEventListener("input", renderList);

        return { pane, renderList };
      };

      const mans = _effectsCatalog("maneuver");
      const strs = _effectsCatalog("strategic");

      const p1 = mkPane("Maneuvers (Raid Console)", "maneuvers", mans, curM);
      const p2 = mkPane("Strategic Activities (Planner)", "strategics", strs, curS);

      grid.appendChild(p1.pane);
      grid.appendChild(p2.pane);

      p1.renderList();
      p2.renderList();

      const syncHidden = () => {
        const nextM = _setFromChecks(wrap, "maneuvers");
        const nextS = _setFromChecks(wrap, "strategics");
        hidM.value = JSON.stringify(nextM);
        hidS.value = JSON.stringify(nextS);
        this.beat.unlocks = { maneuvers: nextM, strategics: nextS };
      };

      wrap.addEventListener("change", (ev) => {
        const t = ev.target;
        if (!t || t.tagName !== "INPUT") return;
        if (!t.matches('input[type="checkbox"][data-unlock-kind][data-unlock-key]')) return;
        syncHidden();
      });

      syncHidden();

      // Insert into World Effects panel if present; otherwise append to form.
      if (effectsPanel) {
        if (insertBefore) insertBefore.insertAdjacentElement("beforebegin", wrap);
        else effectsPanel.appendChild(wrap);
      } else {
        form.appendChild(wrap);
      }
    } catch (e) {
      console.warn(TAG, "ensureUnlocksUI failed:", e);
    }
  }


  // -----------------------------------------------------------------------
  // World Modifiers UI (Persistent Outcome) — anchored in World Effects tab
  // - Injected at render-time so we don't require template edits.
  // - Writes to hidden form field: world-modifiers
  // - Also allows selecting a Target Hex UUID (current scene only) so beats can
  //   apply modifiers without needing a run-context hex.
  // -----------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Relationship Effects (Status Step) UI
  // Stored at: beat.worldEffects.relationshipEffects = [{ aFactionId, bFactionId, steps, reciprocal, note }]
  // ---------------------------------------------------------------------------
  _ensureRelationshipEffectsUI(html) {
    try {
      // IMPORTANT: this must render INSIDE the World Effects/Eff... panel.
      // If we inject into the app root, Foundry's footer (Save button) can sit
      // above our panel, making it unreachable.
      const $root = html?.find ? html : this.element;
      if (!$root) return;

      // Beat Editor uses data-tab="effects" for the World Effects tab.
      // IMPORTANT: target the TAB PANEL (content), not the tab button.
      // Avoid generic [data-tab='effects'] because it can match non-panel
      // elements (and we'd land below the Save footer).
      let $tab = $root.find?.(
        ".bbttcc-tab-panel[data-tab='effects'], section.bbttcc-tab-panel[data-tab='effects']"
      );

      // If multiple match, prefer the first visible panel.
      if ($tab && $tab.length > 1) {
        const $vis = $tab.filter((_, el) => {
          try { return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects?.().length)); }
          catch { return false; }
        });
        if ($vis && $vis.length) $tab = $vis.first();
        else $tab = $tab.first();
      }

      if (!$tab || !$tab.length) $tab = $root;

      // Avoid double-inject
      if ($tab.find?.(".bbttcc-relfx").length) return;

      // Find an anchor inside the effects tab content.
      // Prefer to insert AFTER the World Modifiers block if present.
      // Otherwise, insert after the last bbttcc-card in the tab.
      let $anchor = $tab
        .find?.("textarea[name='world-modifiers'], input[name='world-modifiers'], [data-bbttcc-world-modifiers='1']")
        .closest?.(".bbttcc-card, .form-group, .bbttcc-panel");

      if (!$anchor || !$anchor.length) {
        $anchor = $tab.find?.(".bbttcc-card").last?.();
      }

      if (!$anchor || !$anchor.length) $anchor = $tab;

      // Faction actors can vary by system (some worlds use type:"faction",
      // others use standard dnd5e actor types with bbttcc faction flags).
      const _isFactionActor = (a) => {
        try {
          if (!a) return false;
          if (a.type === "faction") return true;
          const f = a.flags && (a.flags["bbttcc-factions"] || a.flags.bbttccFactions);
          if (!f) return false;
          // Heuristics: if it has any of the canonical faction keys, treat it as a faction.
          return (
            f.opBank != null ||
            f.tracks != null ||
            f.roster != null ||
            f.quests != null ||
            f.relations != null ||
            f.factionLevel != null ||
            f.tier != null
          );
        } catch { return false; }
      };

      const factions = (game?.actors?.contents || []).filter(_isFactionActor);
      factions.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));

      const _factionOptions = (selectedId) => {
        const sel = String(selectedId || "");
        return factions.map(a => {
          const id = String(a.id);
          const nm = foundry.utils.escapeHTML(a.name || a.id);
          const isSel = sel && id === sel;
          return `<option value="${id}" ${isSel ? "selected" : ""}>${nm}</option>`;
        }).join("");
      };

      const existing = Array.isArray(this.beat?.worldEffects?.relationshipEffects) ? this.beat.worldEffects.relationshipEffects : [];

      const rowHtml = (fx, idx) => {
        const a = String(fx?.aFactionId || "");
        const b = String(fx?.bFactionId || "");
        const steps = Number(fx?.steps || 0);
        const reciprocal = !!fx?.reciprocal;
        const note = String(fx?.note || "");
        const stepOpt = (v, label) => `<option value="${v}" ${steps===v ? "selected" : ""}>${label}</option>`;
        return `
          <div class="bbttcc-relfx-row" data-index="${idx}">
            <div class="bbttcc-relfx-grid">
              <label class="bbttcc-relfx-field">
                <div class="bbttcc-muted">Faction A</div>
                <select class="bbttcc-relfx-a">
                  <option value="" ${a? "" : "selected"}>—</option>
                  ${_factionOptions(a)}
                </select>
              </label>

              <label class="bbttcc-relfx-field">
                <div class="bbttcc-muted">Faction B</div>
                <select class="bbttcc-relfx-b">
                  <option value="" ${b? "" : "selected"}>—</option>
                  ${_factionOptions(b)}
                </select>
              </label>

              <label class="bbttcc-relfx-field">
                <div class="bbttcc-muted">Step</div>
                <select class="bbttcc-relfx-steps">
                  ${stepOpt(-2, "−2 (Hard shift)")}
                  ${stepOpt(-1, "−1 (Down)")}
                  ${stepOpt(0, "0 (No change)")}
                  ${stepOpt(1, "+1 (Up)")}
                  ${stepOpt(2, "+2 (Big up)")}
                </select>
              </label>

              <label class="bbttcc-relfx-field bbttcc-relfx-field--check">
                <div class="bbttcc-muted">Reciprocal</div>
                <input type="checkbox" class="bbttcc-relfx-recip" ${reciprocal ? "checked" : ""}/>
              </label>

              <label class="bbttcc-relfx-field bbttcc-relfx-field--wide">
                <div class="bbttcc-muted">Note (optional)</div>
                <input type="text" class="bbttcc-relfx-note" value="${foundry.utils.escapeHTML(note)}" placeholder="Why this happened (shows in logs)"/>
              </label>

              <div class="bbttcc-relfx-actions">
                <button type="button" class="bbttcc-button bbttcc-relfx-remove" title="Remove">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      };

      const htmlBlock = `
        <section class="bbttcc-relfx bbttcc-card" style="margin-top:.75rem;">
          <header class="bbttcc-card__head" style="display:flex; align-items:center; justify-content:space-between; gap:.5rem;">
            <div>
              <div class="bbttcc-card__title">Faction Relationship Effects (Status Step)</div>
              <div class="bbttcc-muted" style="opacity:.85; font-size:.9rem;">
                Adjust relationship status between two factions when this beat resolves. (−2 to +2)
              </div>
            </div>
            <button type="button" class="bbttcc-button bbttcc-relfx-add">
              <i class="fas fa-plus"></i> Add Effect
            </button>
          </header>
          <div class="bbttcc-card__body">
            <div class="bbttcc-relfx-rows">
              ${existing.map(rowHtml).join("") || `<div class="bbttcc-muted" style="opacity:.75;">No relationship effects yet.</div>`}
            </div>
          </div>
        </section>
      `;

      // Insert *inside the effects tab*.
      // If anchor is the tab itself, append. Otherwise insert after the anchor.
      try {
        const anchorIsTab = !!($anchor && $tab && $anchor[0] && $tab[0] && $anchor[0] === $tab[0]);
        if (!anchorIsTab && $anchor && $anchor.after) $anchor.after(htmlBlock);
        else $tab.append(htmlBlock);
      } catch (_eIns) {
        $tab.append(htmlBlock);
      }

      const $panel = $tab.find(".bbttcc-relfx").last();
      const $rows = $panel.find(".bbttcc-relfx-rows");

      const refreshEmpty = () => {
        if ($rows.find(".bbttcc-relfx-row").length) return;
        $rows.html(`<div class="bbttcc-muted" style="opacity:.75;">No relationship effects yet.</div>`);
      };

      const addRow = (seed = {}) => {
        const idx = Date.now();
        if (!$rows.find(".bbttcc-relfx-row").length) $rows.empty();
        $rows.append(rowHtml(seed, idx));
      };

      $panel.find(".bbttcc-relfx-add").on("click", ev => {
        ev.preventDefault();
        addRow({ steps: 1, reciprocal: false, note: "" });
      });

      $panel.on("click", ".bbttcc-relfx-remove", ev => {
        ev.preventDefault();
        const $row = $(ev.currentTarget).closest(".bbttcc-relfx-row");
        $row.remove();
        refreshEmpty();
      });
    } catch (e) {
      console.warn(TAG, "Relationship Effects UI injection failed:", e);
    }
  }


  // ---------------------------------------------------------------------------
  // Faction GM Effects UI (Extended Faction Effects) — anchored in World Effects tab
  // - Replaces the simple "Faction Effects" row editor with a GM-style editor that
  //   can also adjust OP Bank (deltas) and VP.
  // - Writes to standard form field arrays so Save parsing stays compatible:
  //     world-faction-id, world-faction-morale, world-faction-loyalty, world-faction-unity, world-faction-darkness
  //   Plus new arrays:
  //     world-faction-vp
  //     world-faction-op-<key> (9 OP keys)
  //     world-faction-op-allowOvercap (checkbox)
  // ---------------------------------------------------------------------------
  _ensureFactionGMEffectsUI(html) {
    try {
      const $root = html?.find ? html : this.element;
      if (!$root) return;

      // Target the World Effects tab panel content
      let $tab = $root.find?.(
        ".bbttcc-tab-panel[data-tab='effects'], section.bbttcc-tab-panel[data-tab='effects']"
      );
      if ($tab && $tab.length > 1) {
        const $vis = $tab.filter((_, el) => {
          try { return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects?.().length)); }
          catch { return false; }
        });
        if ($vis && $vis.length) $tab = $vis.first();
        else $tab = $tab.first();
      }
      if (!$tab || !$tab.length) $tab = $root;

      // Avoid double-inject
      if ($tab.find?.(".bbttcc-fxgm").length) return;

      // Hide the legacy Faction Effects editor block (keep it in DOM, but out of sight)
      try {
        const $legacyBtn = $tab.find?.("[data-action='add-faction-effect']").first?.();
        if ($legacyBtn && $legacyBtn.length) {
          const $legacyBox = $legacyBtn.closest?.(".bbttcc-card, .form-group, .bbttcc-panel, section, div") || null;
          if ($legacyBox && $legacyBox.length) $legacyBox.css("display", "none");
        }
      } catch (_eHide) {}

      // Faction list
      const _isFactionActor = (a) => {
        try {
          if (!a) return false;
          if (a.type === "faction") return true;
          const f = a.flags && (a.flags["bbttcc-factions"] || a.flags.bbttccFactions);
          if (!f) return false;
          return (
            f.opBank != null ||
            f.roster != null ||
            f.quests != null ||
            f.relations != null ||
            f.factionLevel != null ||
            f.tier != null
          );
        } catch { return false; }
      };
      const factions = (game?.actors?.contents || []).filter(_isFactionActor);
      factions.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));

      const _factionOptions = (selectedId) => {
        const sel = String(selectedId || "");
        return factions.map(a => {
          const id = String(a.id);
          const nm = foundry.utils.escapeHTML(a.name || a.id);
          const isSel = sel && id === sel;
          return `<option value="${id}" ${isSel ? "selected" : ""}>${nm}</option>`;
        }).join("");
      };

      // OP keys (canonical)
      const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
      const OP_LABEL = {
        violence:"Violence",
        nonlethal:"Non-Lethal",
        intrigue:"Intrigue",
        economy:"Economy",
        softpower:"Softpower",
        diplomacy:"Diplomacy",
        logistics:"Logistics",
        culture:"Culture",
        faith:"Faith"
      };

      // Ensure worldEffects.factionEffects exists
      this.beat.worldEffects ??= {};
      const we = this.beat.worldEffects;
      we.factionEffects = Array.isArray(we.factionEffects) ? we.factionEffects : [];

      // Normalize existing rows to include opDeltas/vpDelta
      const normRow = (r) => {
        const out = foundry.utils.deepClone(r || {});
        out.factionId = String(out.factionId || "").replace(/^Actor\./, "").trim();
        out.moraleDelta = _safeNum(out.moraleDelta, 0);
        out.loyaltyDelta = _safeNum(out.loyaltyDelta, 0);
        out.unityDelta = _safeNum(out.unityDelta, 0);
        out.darknessDelta = _safeNum(out.darknessDelta, 0);
        out.vpDelta = _safeNum(out.vpDelta, 0);

        // opDeltas: object of key->delta
        const od = (out.opDeltas && typeof out.opDeltas === "object") ? out.opDeltas : {};
        const next = {};
        for (const k of OP_KEYS) next[k] = _safeNum(od[k], 0);
        out.opDeltas = next;

        out.allowOvercap = !!out.allowOvercap;
        return out;
      };
      we.factionEffects = we.factionEffects.map(normRow);

      // Insert near bottom of effects tab, before War Log field if present
      let $insertBefore = null;
      try {
        const warlog = $tab.find?.("textarea[name='world-warlog']").first?.();
        if (warlog && warlog.length) $insertBefore = warlog.closest?.(".form-group, .bbttcc-card, .bbttcc-panel") || null;
      } catch (_eA) {}

      const rowHtml = (fx, idx) => {
        const fId = String(fx?.factionId || "");
        const m = _safeNum(fx?.moraleDelta, 0);
        const l = _safeNum(fx?.loyaltyDelta, 0);
        const u = _safeNum(fx?.unityDelta, 0);
        const d = _safeNum(fx?.darknessDelta, 0);
        const vp = _safeNum(fx?.vpDelta, 0);
        const allowOvercap = !!fx?.allowOvercap;

        const opInputs = OP_KEYS.map(k => {
          const v = _safeNum(fx?.opDeltas?.[k], 0);
          return `
            <div class="bbttcc-fxgm-oprow">
              <div class="bbttcc-fxgm-oplabel">${foundry.utils.escapeHTML(OP_LABEL[k] || k)}</div>
              <input type="number" step="1" name="world-faction-op-${k}" value="${v}" class="bbttcc-fxgm-opval"/>
            </div>
          `;
        }).join("");

        return `
          <div class="bbttcc-fxgm-row" data-index="${idx}">
            <div class="bbttcc-fxgm-head">
              <label class="bbttcc-fxgm-field">
                <div class="bbttcc-muted">Faction</div>
                <select name="world-faction-id" class="bbttcc-fxgm-faction">
                  <option value="" ${fId ? "" : "selected"}>—</option>
                  ${_factionOptions(fId)}
                </select>
              </label>

              <div class="bbttcc-fxgm-actions">
                <button type="button" class="bbttcc-button bbttcc-fxgm-remove" title="Remove">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>

            <div class="bbttcc-fxgm-grid">
              <label class="bbttcc-fxgm-field">
                <div class="bbttcc-muted">Morale Δ</div>
                <input type="number" step="1" name="world-faction-morale" value="${m}"/>
              </label>
              <label class="bbttcc-fxgm-field">
                <div class="bbttcc-muted">Loyalty Δ</div>
                <input type="number" step="1" name="world-faction-loyalty" value="${l}"/>
              </label>
              <label class="bbttcc-fxgm-field">
                <div class="bbttcc-muted">Unity Δ</div>
                <input type="number" step="1" name="world-faction-unity" value="${u}"/>
              </label>
              <label class="bbttcc-fxgm-field">
                <div class="bbttcc-muted">Darkness Δ</div>
                <input type="number" step="1" name="world-faction-darkness" value="${d}"/>
              </label>
              <label class="bbttcc-fxgm-field">
                <div class="bbttcc-muted">Victory (VP) Δ</div>
                <input type="number" step="1" name="world-faction-vp" value="${vp}"/>
              </label>

              <label class="bbttcc-fxgm-field bbttcc-fxgm-field--check">
                <div class="bbttcc-muted">Allow OP Overcap</div>
                <input type="checkbox" name="world-faction-op-allowOvercap" ${allowOvercap ? "checked" : ""}/>
              </label>
            </div>

            <details class="bbttcc-fxgm-op" ${OP_KEYS.some(k => _safeNum(fx?.opDeltas?.[k],0)!==0) ? "open" : ""}>
              <summary><b>OP Bank Δ</b> <span class="bbttcc-muted">(use positive/negative; respects caps unless Allow Overcap)</span></summary>
              <div class="bbttcc-fxgm-opgrid">
                ${opInputs}
              </div>
            </details>
          </div>
        `;
      };

      const block = `
        <section class="bbttcc-fxgm bbttcc-card" style="margin-top:.75rem;">
          <header class="bbttcc-card__head" style="display:flex; align-items:center; justify-content:space-between; gap:.5rem;">
            <div>
              <div class="bbttcc-card__title">Faction GM Effects (Beats)</div>
              <div class="bbttcc-muted" style="opacity:.85; font-size:.9rem;">
                Beat-driven faction adjustments, including OP Bank deltas. (Use sparingly. Great for “Faction Short Rest” beats.)
              </div>
            </div>
            <button type="button" class="bbttcc-button bbttcc-fxgm-add">
              <i class="fas fa-plus"></i> Add Faction GM Effect
            </button>
          </header>
          <div class="bbttcc-card__body">
            <div class="bbttcc-fxgm-rows">
              ${(we.factionEffects && we.factionEffects.length) ? we.factionEffects.map((fx,i)=>rowHtml(fx, i)).join("") : `<div class="bbttcc-muted" style="opacity:.75;">No faction effects yet.</div>`}
            </div>
            <div class="bbttcc-muted" style="margin-top:.5rem; font-size:.85rem; opacity:.75;">
              Note: OP changes use the OP Engine (underflow refused; overcap increases refused unless Allow Overcap is checked).
            </div>
          </div>
        </section>
        <style>
          .bbttcc-fxgm-row{ padding:.65rem .65rem; border:1px solid rgba(148,163,184,0.18); border-radius:12px; background:rgba(15,23,42,0.35); margin:.6rem 0; }
          .bbttcc-fxgm-head{ display:flex; gap:.6rem; align-items:flex-end; justify-content:space-between; margin-bottom:.5rem; }
          .bbttcc-fxgm-grid{ display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:.6rem; align-items:end; }
          .bbttcc-fxgm-field input, .bbttcc-fxgm-field select{ width:100%; }
          .bbttcc-fxgm-field--check{ display:flex; flex-direction:column; }
          .bbttcc-fxgm-actions{ display:flex; gap:.35rem; align-items:center; }
          .bbttcc-fxgm-op{ margin-top:.65rem; padding:.5rem .5rem; border:1px solid rgba(148,163,184,0.14); border-radius:12px; background:rgba(2,6,23,0.22); }
          .bbttcc-fxgm-op summary{ cursor:pointer; user-select:none; }
          .bbttcc-fxgm-opgrid{ display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:.45rem .75rem; margin-top:.5rem; }
          .bbttcc-fxgm-oprow{ display:flex; justify-content:space-between; gap:.5rem; align-items:center; }
          .bbttcc-fxgm-oplabel{ font-size:.85rem; opacity:.85; }
          .bbttcc-fxgm-opval{ width:90px; }
          @media (max-width: 980px){ .bbttcc-fxgm-grid{ grid-template-columns: repeat(2, minmax(0, 1fr)); } .bbttcc-fxgm-opgrid{ grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        </style>
      `;

      if ($insertBefore && $insertBefore.length) $insertBefore.before(block);
      else $tab.append(block);

      const $panel = $tab.find(".bbttcc-fxgm").last();
      const $rows = $panel.find(".bbttcc-fxgm-rows");

      const refreshEmpty = () => {
        if ($rows.find(".bbttcc-fxgm-row").length) return;
        $rows.html(`<div class="bbttcc-muted" style="opacity:.75;">No faction effects yet.</div>`);
      };

      const addRow = () => {
        const defaultFactionId = this._getCampaignDefaultFactionId() || "";
        const seed = {
          factionId: defaultFactionId,
          moraleDelta: 0,
          loyaltyDelta: 0,
          unityDelta: 0,
          darknessDelta: 0,
          vpDelta: 0,
          opDeltas: { violence:0, nonlethal:0, intrigue:0, economy:0, softpower:0, diplomacy:0, logistics:0, culture:0, faith:0 },
          allowOvercap: false
        };
        if (!$rows.find(".bbttcc-fxgm-row").length) $rows.empty();
        $rows.append(rowHtml(seed, Date.now()));
      };

      $panel.find(".bbttcc-fxgm-add").on("click", (ev) => {
        ev.preventDefault();
        addRow();
      });

      $panel.on("click", ".bbttcc-fxgm-remove", (ev) => {
        ev.preventDefault();
        const $row = $(ev.currentTarget).closest(".bbttcc-fxgm-row");
        $row.remove();
        refreshEmpty();
      });

    } catch (e) {
      console.warn(TAG, "Faction GM Effects UI injection failed:", e);
    }
  }


  
// -----------------------------------------------------------------------
// Casualties UI (Beat Outcome) — anchored in World Effects tab
// - Injected at render-time so we don't require template edits.
// - Writes standardized casualty tags into the Beat's tags field:
//     casualties.hex:<sev>
//     casualties.attacker:<sev>
//     casualties.defender:<sev>
//     casualties.atrocity
// -----------------------------------------------------------------------
_ensureCasualtiesUI(html) {
  try {
    const $root = html?.find ? html : this.element;
    if (!$root) return;

    // Target the World Effects tab panel content
    let $tab = $root.find?.(
      ".bbttcc-tab-panel[data-tab='effects'], section.bbttcc-tab-panel[data-tab='effects']"
    );
    if ($tab && $tab.length > 1) {
      const $vis = $tab.filter((_, el) => {
        try { return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects?.().length)); }
        catch { return false; }
      });
      if ($vis && $vis.length) $tab = $vis.first();
      else $tab = $tab.first();
    }
    if (!$tab || !$tab.length) $tab = $root;

    // Avoid double-inject
    if ($tab.find?.(".bbttcc-casfx").length) return;

    // Anchor: place near the bottom, before War Log Note if present.
    let $insertBefore = null;
    try {
      const warlog = $tab.find?.("textarea[name='world-warlog']").first?.();
      if (warlog && warlog.length) $insertBefore = warlog.closest?.(".form-group, .bbttcc-card, .bbttcc-panel") || null;
    } catch (_eA) {}

    // Helpers: get/set casualty tags
    const SEV = ["", "minor", "moderate", "major", "catastrophic"];
    const LABEL = { "": "None", minor: "Minor", moderate: "Moderate", major: "Major", catastrophic: "Catastrophic" };

    const _readTags = () => _tagArray(this.beat.tags || "");

    const _getSev = (which) => {
      const tags = _readTags();
      const pref = "casualties." + which + ":";
      for (let i = 0; i < tags.length; i++) {
        const t = String(tags[i] || "").trim();
        if (t.toLowerCase().indexOf(pref) === 0) {
          const raw = t.slice(pref.length).trim();
          const r = raw.toLowerCase();
          if (SEV.includes(r)) return r;
          // numeric forms (+1..+4) still treated as "advanced"; don't select.
          return "";
        }
      }
      return "";
    };

    const _hasAtrocity = () => {
      const tags = _readTags().map(t => String(t||"").toLowerCase());
      return tags.includes("casualties.atrocity");
    };

    const _setSev = (which, sev) => {
      sev = String(sev || "").toLowerCase().trim();
      if (!SEV.includes(sev)) sev = "";
      const tags = _readTags();
      const pref = "casualties." + which + ":";
      const next = [];
      for (let i = 0; i < tags.length; i++) {
        const t = String(tags[i] || "").trim();
        if (!t) continue;
        if (t.toLowerCase().indexOf(pref) === 0) continue; // remove existing sev tag for this target
        next.push(t);
      }
      if (sev) next.push("casualties." + which + ":" + sev);
      _setTagsValue(this, next.join(" "));
    };

    const _setAtrocity = (on) => {
      const tags = _readTags();
      const next = [];
      let had = false;
      for (let i = 0; i < tags.length; i++) {
        const t = String(tags[i] || "").trim();
        if (!t) continue;
        if (t.toLowerCase() === "casualties.atrocity") { had = true; continue; }
        next.push(t);
      }
      if (on) next.push("casualties.atrocity");
      _setTagsValue(this, next.join(" "));
    };

    const _opts = (cur) => {
      cur = String(cur || "").toLowerCase();
      return SEV.map(s => `<option value="${s}" ${cur===s ? "selected" : ""}>${LABEL[s] || s}</option>`).join("");
    };

    const curHex = _getSev("hex");
    const curA = _getSev("attacker");
    const curD = _getSev("defender");
    const curAt = _hasAtrocity();

    const block = `
      <section class="bbttcc-casfx bbttcc-card" style="margin-top:.75rem;">
        <header class="bbttcc-card__head" style="display:flex; align-items:center; justify-content:space-between; gap:.5rem;">
          <div>
            <div class="bbttcc-card__title">Casualties (Beat Outcome)</div>
            <div class="bbttcc-muted" style="opacity:.85; font-size:.9rem;">
              Select casualty severity to automatically write standardized casualty tags. The Casualty Engine applies effects on beat resolution.
            </div>
          </div>
        </header>
        <div class="bbttcc-card__body">
          <div class="bbttcc-casfx-grid">
            <label class="bbttcc-casfx-field">
              <div class="bbttcc-muted">Hex Casualties</div>
              <select class="bbttcc-casfx-hex">
                ${_opts(curHex)}
              </select>
            </label>
            <label class="bbttcc-casfx-field">
              <div class="bbttcc-muted">Attacker Casualties</div>
              <select class="bbttcc-casfx-att">
                ${_opts(curA)}
              </select>
            </label>
            <label class="bbttcc-casfx-field">
              <div class="bbttcc-muted">Defender Casualties</div>
              <select class="bbttcc-casfx-def">
                ${_opts(curD)}
              </select>
            </label>
            <label class="bbttcc-casfx-field bbttcc-casfx-field--check">
              <div class="bbttcc-muted">Atrocity</div>
              <input type="checkbox" class="bbttcc-casfx-atrocity" ${curAt ? "checked" : ""}/>
            </label>
          </div>

          <div class="bbttcc-muted" style="margin-top:.5rem; font-size:.85rem; opacity:.75;">
            Atrocity is for cruelty, massacre, terror tactics. It can spike Darkness on Major+ hex casualty outcomes.
          </div>
        </div>
      </section>
      <style>
        .bbttcc-casfx-grid{ display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:.6rem; align-items:end; }
        .bbttcc-casfx-field select{ width:100%; }
        .bbttcc-casfx-field--check{ display:flex; flex-direction:column; }
        @media (max-width: 980px){ .bbttcc-casfx-grid{ grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      </style>
    `;

    if ($insertBefore && $insertBefore.length) $insertBefore.before(block);
    else $tab.append(block);

    const $panel = $tab.find(".bbttcc-casfx").last();

    $panel.on("change", ".bbttcc-casfx-hex", (ev) => {
      ev.preventDefault();
      _setSev("hex", $(ev.currentTarget).val());
    });
    $panel.on("change", ".bbttcc-casfx-att", (ev) => {
      ev.preventDefault();
      _setSev("attacker", $(ev.currentTarget).val());
    });
    $panel.on("change", ".bbttcc-casfx-def", (ev) => {
      ev.preventDefault();
      _setSev("defender", $(ev.currentTarget).val());
    });
    $panel.on("change", ".bbttcc-casfx-atrocity", (ev) => {
      ev.preventDefault();
      _setAtrocity(!!$(ev.currentTarget).prop("checked"));
    });

  } catch (e) {
    console.warn(TAG, "Casualties UI injection failed:", e);
  }
}

_ensureWorldModifiersUI(html) {
    try {
      const root = (html && html[0]) ? html[0] : html;
      if (!root) return;

      // Avoid double-injection on re-render
      if (root.querySelector("[data-bbttcc-world-modifiers='1']")) return;

      const form = root.querySelector("form.bbttcc-beat-editor-form") || root.querySelector("form");
      if (!form) return;

      // Target: World Effects tab panel
      const effectsPanel =
        root.querySelector('.bbttcc-tab-panel[data-tab="effects"]') ||
        root.querySelector('section.bbttcc-tab-panel[data-tab="effects"]') ||
        root.querySelector('[data-tab="effects"]') ||
        null;
      if (!effectsPanel) return;

      // Anchor: insert after Unlock Rewards panel if present; else near bottom.
      const unlockWrap = effectsPanel.querySelector('[data-bbttcc-unlocks="1"]') || null;

      // No hidden JSON field.
      // World modifiers are now kept directly on this.beat.worldEffects.worldModifiers.

      // World modifiers current
      this.beat.worldEffects ??= {};
      const we = this.beat.worldEffects;
      const curMods = Array.isArray(we.worldModifiers) ? we.worldModifiers : [];

      // Wrapper
      const wrap = document.createElement("div");
      wrap.setAttribute("data-bbttcc-world-modifiers", "1");
      wrap.style.marginTop = "10px";
      wrap.style.padding = "10px";
      wrap.style.border = "1px solid rgba(148,163,184,0.25)";
      wrap.style.borderRadius = "12px";
      wrap.style.background = "rgba(2,6,23,0.25)";

      const title = document.createElement("div");
      title.textContent = "World Modifiers (Persistent Outcome)";
      title.style.fontWeight = "800";
      title.style.marginBottom = "6px";
      title.style.letterSpacing = "0.02em";
      wrap.appendChild(title);

      const hint = document.createElement("div");
      hint.textContent = "Apply persistent GM-only map effects when this beat resolves (e.g., Harmonized Grove). Stored on the hex and visible as chips.";
      hint.style.fontSize = "12px";
      hint.style.opacity = "0.8";
      hint.style.marginBottom = "10px";
      wrap.appendChild(hint);

      // Target Hex UUID dropdown (current scene only)
      const targetGroup = document.createElement("div");
      targetGroup.className = "form-group";
      targetGroup.style.marginBottom = "10px";

      const lab = document.createElement("label");
      lab.textContent = "Target Hex (optional)";
      lab.style.display = "block";
      lab.style.fontWeight = "700";
      lab.style.marginBottom = "4px";
      targetGroup.appendChild(lab);

      const sel = document.createElement("select");
      sel.name = "targetHexUuid";
      sel.style.width = "100%";
      sel.style.padding = "6px 8px";
      sel.style.borderRadius = "10px";
      sel.style.border = "1px solid rgba(148,163,184,0.22)";
      sel.style.background = "rgba(15,23,42,0.45)";
      sel.style.color = "#e5e7eb";

      const opt0 = document.createElement("option");
      opt0.value = "";
      opt0.textContent = "(Use run context / unassigned)";
      sel.appendChild(opt0);

      const hexes = _listCurrentSceneHexes();
      for (let i = 0; i < hexes.length; i++) {
        const o = document.createElement("option");
        o.value = hexes[i].uuid;
        o.textContent = hexes[i].label;
        sel.appendChild(o);
      }

      const curTarget = String(this.beat.targetHexUuid || "").trim();
      if (curTarget) sel.value = curTarget;

      targetGroup.appendChild(sel);

      const h2 = document.createElement("div");
      h2.textContent = "If set, world modifiers will apply to this hex even when you run the beat manually. (Current scene only.)";
      h2.style.fontSize = "11px";
      h2.style.opacity = "0.75";
      h2.style.marginTop = "4px";
      targetGroup.appendChild(h2);

      wrap.appendChild(targetGroup);

      // Only one starter modifier for now: Harmonized Grove
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "24px 1fr";
      row.style.gap = "10px";
      row.style.alignItems = "start";
      row.style.padding = "8px";
      row.style.border = "1px solid rgba(148,163,184,0.18)";
      row.style.borderRadius = "12px";
      row.style.background = "rgba(15,23,42,0.35)";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.setAttribute("data-wm-key", "harmonized_grove");
      cb.style.marginTop = "2px";

      const body = document.createElement("div");
      const name = document.createElement("div");
      name.textContent = "Harmonized Grove";
      name.style.fontWeight = "800";
      body.appendChild(name);

      const desc = document.createElement("div");
      desc.textContent = "Forest accepts you; hostility reduced in this hex; adjacency derived; Soft Power may pacify.";
      desc.style.fontSize = "12px";
      desc.style.opacity = "0.85";
      desc.style.marginTop = "2px";
      body.appendChild(desc);

      const controls = document.createElement("div");
      controls.style.display = "flex";
      controls.style.gap = "10px";
      controls.style.marginTop = "8px";
      controls.style.alignItems = "center";

      const durWrap = document.createElement("label");
      durWrap.style.display = "flex";
      durWrap.style.gap = "6px";
      durWrap.style.alignItems = "center";
      durWrap.style.fontSize = "12px";
      durWrap.style.opacity = "0.9";
      durWrap.textContent = "Duration (turns)";

      const dur = document.createElement("input");
      dur.type = "number";
      dur.min = "0";
      dur.step = "1";
      dur.name = "wm-harmonized-duration";
      dur.style.width = "84px";
      dur.style.borderRadius = "10px";
      dur.style.border = "1px solid rgba(148,163,184,0.22)";
      dur.style.background = "rgba(15,23,42,0.45)";
      dur.style.color = "#e5e7eb";

      // Enabled toggle
      const enLab = document.createElement("label");
      enLab.style.display = "flex";
      enLab.style.gap = "6px";
      enLab.style.alignItems = "center";
      enLab.style.fontSize = "12px";
      enLab.style.opacity = "0.9";

      const en = document.createElement("input");
      en.type = "checkbox";
      en.name = "wm-harmonized-enabled";
      en.checked = true;
      enLab.appendChild(en);
      const enTxt = document.createElement("span");
      enTxt.textContent = "Enabled";
      enLab.appendChild(enTxt);

      durWrap.appendChild(dur);
      controls.appendChild(durWrap);
      controls.appendChild(enLab);
      body.appendChild(controls);

      row.appendChild(cb);
      row.appendChild(body);
      wrap.appendChild(row);

      // Seed from existing stored modifiers
      let existing = null;
      for (let i = 0; i < curMods.length; i++) {
        const m = curMods[i];
        if (m && String(m.key || "") === "harmonized_grove") { existing = m; break; }
      }
      if (existing) {
        cb.checked = true;
        en.checked = (existing.enabled !== false);
        const d = Number(existing.durationTurns || 0);
        dur.value = String((Number.isFinite(d) && d >= 0) ? d : 0);
        // If existing specifies a target, prefer it
        if (!curTarget && existing.targetHexUuid) {
          try { sel.value = String(existing.targetHexUuid || ""); } catch (_eSel) {}
        }
      } else {
        cb.checked = false;
        dur.value = "0";
      }

      const syncWorldModifiers = () => {
        // keep target in this.beat live
        const t = String(sel.value || "").trim();
        this.beat.targetHexUuid = t || null;

        const mods = [];
        if (cb.checked) {
          const d = Math.max(0, _safeNum(dur.value, 0));
          mods.push({
            key: "harmonized_grove",
            label: "Harmonized Grove",
            enabled: !!en.checked,
            durationTurns: d,
            targetHexUuid: (t || null),
            channels: {
              "forest.hostilityBias": -1,
              "forest.allowSoftPowerPacify": true,
              "social.nextHexDiplomacyBonus": 1
            },
            derived: { adjacency: true }
          });
        }

        this.beat.worldEffects = this.beat.worldEffects || {};
        this.beat.worldEffects.worldModifiers = mods;
      };

      wrap.addEventListener("change", (ev) => {
        const t = ev.target;
        if (!t) return;
        if (t === cb || t === en || t === dur || t === sel) syncWorldModifiers();
      });
      sel.addEventListener("change", syncWorldModifiers);
      syncWorldModifiers();

      // Insert in DOM
      if (unlockWrap && unlockWrap.parentElement === effectsPanel) {
        unlockWrap.insertAdjacentElement("afterend", wrap);
      } else {
        effectsPanel.appendChild(wrap);
      }
    } catch (e) {
      console.warn(TAG, "ensureWorldModifiersUI failed:", e);
    }
  }


  // -----------------------------------------------------------------------
  // Campaign Turn Flow UI (Turn assignment) — anchored in Core tab
  // - Injected at render-time so we don't require template edits.
  // - Writes to a form field named: turnNumber
  // -----------------------------------------------------------------------
  _ensureTurnAssignUI(html) {
    try {
      const root = (html && html[0]) ? html[0] : html;
      if (!root) return;

      // Avoid double-injection on re-render
      if (root.querySelector("[data-bbttcc-turn-assign='1']")) return;

      const form = root.querySelector("form.bbttcc-beat-editor-form") || root.querySelector("form");
      if (!form) return;

      // Target: Core tab "Basic Info" grid
      const corePanel = root.querySelector(".bbttcc-tab-panel[data-tab='core']") || root.querySelector("[data-tab='core']");
      if (!corePanel) return;
      const basicSection = corePanel.querySelector(".bbttcc-beat-section") || corePanel;
      const grid = basicSection.querySelector(".bbttcc-form-grid");
      if (!grid) return;

      // Create a form-group that matches existing styling
      const wrap = document.createElement("div");
      wrap.className = "form-group";
      wrap.setAttribute("data-bbttcc-turn-assign", "1");

      const lab = document.createElement("label");
      lab.textContent = "Available Turn (optional)";
      wrap.appendChild(lab);

      const input = document.createElement("input");
      input.type = "number";
      input.name = "turnNumber";
      input.min = "1";
      input.step = "1";
      input.placeholder = "(blank = unassigned)";
      input.value = this.beat && this.beat.turnNumber ? String(this.beat.turnNumber) : "";
      wrap.appendChild(input);

      const hint = document.createElement("p");
      hint.className = "bbttcc-muted";
      hint.style.margin = ".25rem 0 0";
      hint.textContent = "Used for Campaign Builder filtering and for turn-advance availability callouts.";
      wrap.appendChild(hint);

      // Insert: after Time Scale if we can find it; else append to grid.
      const timeScaleSel = grid.querySelector("select[name='timeScale']");
      const anchor = timeScaleSel ? (timeScaleSel.closest(".form-group") || null) : null;
      if (anchor && anchor.parentElement === grid) {
        anchor.insertAdjacentElement("afterend", wrap);
      } else {
        grid.appendChild(wrap);
      }

      // Keep this.beat in sync live so Add Choice etc doesn't lose it
      input.addEventListener("change", () => {
        const raw = String(input.value || "").trim();
        const n = Number(raw);
        if (!raw) this.beat.turnNumber = null;
        else if (isFinite(n) && n >= 1) this.beat.turnNumber = Math.floor(n);
        else this.beat.turnNumber = null;
      });
    } catch (e) {
      console.warn(TAG, "ensureTurnAssignUI failed:", e);
    }
  }

  _ensureAudioUI(html) {
  try {
    const root = (html && html[0]) ? html[0] : html;
    if (!root) return;
  
    // Avoid double-injection on re-render
    if (root.querySelector("[data-bbttcc-audio='1']")) return;
  
    const form = root.querySelector("form.bbttcc-beat-editor-form") || root.querySelector("form");
    if (!form) return;
  
    // Target: Core tab panel
    const corePanel =
      root.querySelector(".bbttcc-tab-panel[data-tab='core']") ||
      root.querySelector("section.bbttcc-tab-panel[data-tab='core']") ||
      root.querySelector("[data-tab='core']") ||
      null;
    if (!corePanel) return;
  
    // Anchor: insert near Description field if present, else after Basic Info grid.
    let anchor = null;
    try {
      const desc = corePanel.querySelector("textarea[name='description']");
      if (desc) anchor = desc.closest(".form-group") || desc.parentElement;
    } catch (_eA) { anchor = null; }
  
    if (!anchor) {
      const grid = corePanel.querySelector(".bbttcc-form-grid");
      if (grid) anchor = grid;
    }
    if (!anchor) anchor = corePanel;
  
    // Ensure beat.audio exists
    this.beat.audio ??= { enabled: false, src: "", volume: 0.85, loop: false, autoplay: false, broadcastPlayers: false };
    const aud = this.beat.audio;
  
    const wrap = document.createElement("section");
    wrap.className = "bbttcc-card";
    wrap.setAttribute("data-bbttcc-audio", "1");
    wrap.style.marginTop = ".75rem";
  
    const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
  
    wrap.innerHTML = `
      <header class="bbttcc-card__head" style="display:flex; align-items:center; justify-content:space-between; gap:.5rem;">
        <div>
          <div class="bbttcc-card__title">Beat Audio (Narration)</div>
          <div class="bbttcc-muted" style="opacity:.85; font-size:.9rem;">
            Attach an audio file to this beat (GM-side). You can auto-play it on run, or click Play to preview here.
          </div>
        </div>
      </header>
      <div class="bbttcc-card__body">
        <label style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
          <input type="checkbox" name="audio-enabled" ${aud.enabled ? "checked" : ""}/>
          <span><b>Enable audio</b></span>
        </label>
  
        <div class="form-group">
          <label>Audio File (src)</label>
          <div style="display:flex; gap:.5rem; align-items:center; flex-wrap:wrap;">
            <input type="text" name="audio-src" value="${esc(aud.src || "")}" placeholder="sounds/narration/beat_intro.ogg" style="flex:1 1 420px; min-width:260px;"/>
            <button type="button" class="bbttcc-button" data-action="audio-pick"><i class="fas fa-folder-open"></i> Pick</button>
            <button type="button" class="bbttcc-button" data-action="audio-play"><i class="fas fa-play"></i> Play</button>
            <button type="button" class="bbttcc-button" data-action="audio-stop"><i class="fas fa-stop"></i> Stop</button>
          </div>
          <p class="bbttcc-muted" style="margin:.25rem 0 0; opacity:.75;">Tip: keep narration in your module folder (e.g. <code>modules/bbttcc-campaign/sounds/…</code>) so paths stay stable.</p>
        </div>
  
        <div class="bbttcc-form-grid" style="grid-template-columns: repeat(3, minmax(0, 1fr)); gap:.6rem; align-items:end;">
          <label class="form-group" style="margin:0;">
            <div class="bbttcc-muted">Volume</div>
            <input type="range" name="audio-volume" min="0" max="1" step="0.01" value="${Number.isFinite(Number(aud.volume)) ? String(aud.volume) : "0.85"}" />
            <div class="bbttcc-muted" data-role="audio-volume-readout" style="font-size:.85rem; opacity:.75; margin-top:4px;">${Number.isFinite(Number(aud.volume)) ? String(Math.round(Number(aud.volume)*100)) : "85"}%</div>
          </label>
  
          <label class="form-group" style="margin:0; display:flex; flex-direction:column; gap:6px;">
            <div class="bbttcc-muted">Options</div>
            <label style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" name="audio-autoplay" ${aud.autoplay ? "checked" : ""}/>
              <span>Auto-play when beat runs</span>
            </label>
            <label style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" name="audio-loop" ${aud.loop ? "checked" : ""}/>
              <span>Loop</span>
            </label>
            <label style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" name="audio-broadcast" ${aud.broadcastPlayers ? "checked" : ""}/>
              <span>Play for players (broadcast)</span>
            </label>
          </label>
  
          <div class="bbttcc-muted" style="opacity:.75; font-size:.85rem;">
            <div><b>Scope:</b> GM local by default.</div>
            <div>If <b>Play for players</b> is checked, the GM will broadcast playback to connected players when the beat runs.</div>
          </div>
        </div>
      </div>
    `;
  
    // Insert
    try {
      if (anchor && anchor.insertAdjacentElement) anchor.insertAdjacentElement("afterend", wrap);
      else corePanel.appendChild(wrap);
    } catch (_eIns) {
      corePanel.appendChild(wrap);
    }
  
    // Live wiring (preview sound)
    const enabledEl = wrap.querySelector("input[name='audio-enabled']");
    const srcEl = wrap.querySelector("input[name='audio-src']");
    const volEl = wrap.querySelector("input[name='audio-volume']");
    const loopEl = wrap.querySelector("input[name='audio-loop']");
    const autoEl = wrap.querySelector("input[name='audio-autoplay']");
    const bcEl  = wrap.querySelector("input[name='audio-broadcast']");
    const volTxt = wrap.querySelector("[data-role='audio-volume-readout']");
  
    const sync = () => {
      this.beat.audio ??= { enabled: false, src: "", volume: 0.85, loop: false, autoplay: false, broadcastPlayers: false };
      const a = this.beat.audio;
      a.enabled = !!(enabledEl && enabledEl.checked);
      a.src = String(srcEl ? (srcEl.value || "") : (a.src || "")).trim();
      const v = Number(volEl ? volEl.value : a.volume);
      a.volume = (isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.85);
      a.loop = !!(loopEl && loopEl.checked);
      a.autoplay = !!(autoEl && autoEl.checked);
      a.broadcastPlayers = !!(bcEl && bcEl.checked);
  
      try { if (volTxt) volTxt.textContent = String(Math.round(a.volume * 100)) + "%"; } catch (_eV) {}
    };
  
    // File picker
    const pickBtn = wrap.querySelector("[data-action='audio-pick']");
    if (pickBtn) {
      pickBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        try {
          const fp = new FilePicker({
            type: "audio",
            current: srcEl ? String(srcEl.value || "") : "",
            callback: (path) => {
              try { if (srcEl) srcEl.value = String(path || ""); } catch (_eS) {}
              sync();
            }
          });
          fp.browse();
        } catch (e) {
          console.warn(TAG, "Audio FilePicker failed:", e);
          ui.notifications?.warn?.("Could not open File Picker. See console.");
        }
      });
    }
  
    const stopPreview = () => {
      try {
        const snd = this._audioPreviewSound || null;
        if (snd && typeof snd.stop === "function") snd.stop();
        else if (snd && typeof snd.fade === "function") snd.fade(0, { duration: 250 });
      } catch (_eStop) {}
      this._audioPreviewSound = null;
    };
  
    const playBtn = wrap.querySelector("[data-action='audio-play']");
    if (playBtn) {
      playBtn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        sync();
        const a = this.beat.audio || {};
        const src = String(a.src || "").trim();
        if (!src) return ui.notifications?.warn?.("Pick an audio file first.");
        try {
          stopPreview();
          // AudioHelper.play returns a Sound (local playback)
          const s = await AudioHelper.play({ src: src, volume: a.volume ?? 0.85, loop: !!a.loop }, true);
          this._audioPreviewSound = s || null;
        } catch (e) {
          console.warn(TAG, "Audio preview failed:", e);
          ui.notifications?.warn?.("Audio preview failed. See console.");
        }
      });
    }
  
    const stopBtn = wrap.querySelector("[data-action='audio-stop']");
    if (stopBtn) {
      stopBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        // Stop preview (editor-local)
        stopPreview();
        // Also stop any currently-playing beat narration (and broadcast stop to players if configured)
        try {
          const fn = game?.bbttcc?.api?.campaign?.stopBeatNarration;
          if (typeof fn === "function") fn();
        } catch (_eStopAll) {}
      });
}
  
    // Sync on changes
    try { enabledEl && enabledEl.addEventListener("change", sync); } catch (_e0) {}
    try { srcEl && srcEl.addEventListener("change", sync); } catch (_e1) {}
    try { srcEl && srcEl.addEventListener("input", sync); } catch (_e1b) {}
    try { volEl && volEl.addEventListener("input", sync); } catch (_e2) {}
    try { loopEl && loopEl.addEventListener("change", sync); } catch (_e3) {}
    try { autoEl && autoEl.addEventListener("change", sync); } catch (_e4) {}
    try { bcEl  && bcEl.addEventListener("change", sync); } catch (_e5) {}
  
    // Initial sync
    sync();
  } catch (e) {
    console.warn(TAG, "ensureAudioUI failed:", e);
  }
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Inject Unlocks checklists (anchored in World Effects tab)
    this._ensureUnlocksUI(html);

    // Inject World Modifiers (anchored in World Effects tab)
    this._ensureWorldModifiersUI(html);
    this._ensureRelationshipEffectsUI(html);
    this._ensureFactionGMEffectsUI(html);
    this._ensureCasualtiesUI(html);


    // Inject Turn assignment (anchored in Core tab)
    this._ensureTurnAssignUI(html);

    // Inject Beat Audio (Narration) panel (anchored in Core tab)
    try { this._ensureAudioUI(html); } catch (eAudio) { console.warn(TAG, "ensureAudioUI failed:", eAudio); }

    // After all dynamic UI injection, autosize the window so footer buttons are never clipped.
    try { setTimeout(() => { __bbttccAutosizeAppWindow(this); }, 0); } catch (_eAuto) {}

    html.find("[data-action='cancel']").on("click", ev => { ev.preventDefault(); this.close(); });
    html.find("[data-action='save-beat']").on("click", ev => { ev.preventDefault(); this._saveFromForm(ev.currentTarget); });

    // Tabs
    html.find("[data-action='tab']").on("click", ev => {
      ev.preventDefault();
      const tab = ev.currentTarget?.dataset?.tab;
      if (!tab) return;

      // Preserve in-progress edits across tab switches.
      try { if (typeof this._syncCoreFromForm === "function") this._syncCoreFromForm(); } catch (e0) {}
      try { if (typeof this._syncChoicesFromForm === "function") this._syncChoicesFromForm(); } catch (e1) {}

      this.activeTab = tab;
      this.render(false);
    });

    html.find("[data-action='pick-tags']").on("click", async (ev) => {
      ev.preventDefault();
      const Picker = await _loadTagPickerApp();
      if (!Picker) { ui.notifications?.error?.("Tag Picker failed to load. See console."); return; }
      new Picker({
        selectedTags: _tagArray(this.beat.tags || ""),
        tagCatalog: TAG_CATALOG,
        onSelect: (tags) => {
          _setTagsValue(this, (tags || []).join(" "));
          this.render(false);
        }
      }).render(true);
    });

    html.find("[data-action='remove-tag']").on("click", ev => {
      ev.preventDefault();
      const tag = ev.currentTarget?.dataset?.tag;
      if (!tag) return;
      _setTagsValue(this, _tagArray(this.beat.tags || "").filter(t => t !== tag).join(" "));
      this.render(false);
    });

    // Political Tags (AAE) — checkbox picker (same picker UI as tags)
    html.find("[data-action='pick-political-tags']").on("click", async (ev) => {
      ev.preventDefault();
      const Picker = await _loadTagPickerApp();
      if (!Picker) { ui.notifications?.error?.("Tag Picker failed to load. See console."); return; }
      new Picker({
        selectedTags: _tagArray(this.beat.politicalTags || ""),
        tagCatalog: _getPoliticalTagCatalog(),
        onSelect: (tags) => {
          _setPoliticalTagsValue(this, (tags || []).join(" "));
          this.render(false);
        }
      }).render(true);
    });

    html.find("[data-action='remove-political-tag']").on("click", ev => {
      ev.preventDefault();
      const tag = ev.currentTarget?.dataset?.tag;
      if (!tag) return;
      _setPoliticalTagsValue(this, _tagArray(this.beat.politicalTags || "").filter(t => t !== tag).join(" "));
      this.render(false);
    });

    // Scene picker
    html.find("[data-action='pick-scene']").on("click", async (ev) => {
      ev.preventDefault();
      const Picker = await _loadScenePickerApp();
      if (!Picker) { ui.notifications?.error?.("Scene Picker failed to load. See console."); return; }
      new Picker({
        onSelect: (scene) => {
          this.beat.sceneId = scene?.uuid || (scene?.id ? `Scene.${scene.id}` : null);
          this.render();
        }
      }).render(true);
    });

    html.find("[data-action='activate-scene']").on("click", async ev => {
      ev.preventDefault();
      const raw = String(this.beat.sceneId || "").trim();
      if (!raw) return;
      try {
        let scene = raw.includes(".") ? await fromUuid(raw) : (game.scenes?.get?.(raw) || null);
        if (!scene && !raw.includes(".")) {
          try { scene = await fromUuid(`Scene.${raw}`); } catch (e) { }
        }
        if (scene?.activate) await scene.activate();
      } catch (e) {
        console.warn(TAG, "Activate scene failed:", e);
        ui.notifications?.warn?.("Could not activate scene. See console.");
      }
    });

    html.find("[data-action='clear-scene']").on("click", ev => {
      ev.preventDefault();
      this.beat.sceneId = null;
      this.render(false);
    });


    // Cinematic scene pickers (start / next)
    html.find("[data-action='pick-cinematic-start']").on("click", async (ev) => {
      ev.preventDefault();
      const Picker = await _loadScenePickerApp();
      if (!Picker) { ui.notifications?.error?.("Scene Picker failed to load. See console."); return; }
      new Picker({
        onSelect: (scene) => {
          this.beat.cinematic ??= { enabled: false, startSceneId: null, durationMs: 8000, nextSceneId: null };
          this.beat.cinematic.startSceneId = scene?.uuid || (scene?.id ? `Scene.${scene.id}` : null);
          this.render();
        }
      }).render(true);
    });

    html.find("[data-action='pick-cinematic-next']").on("click", async (ev) => {
      ev.preventDefault();
      const Picker = await _loadScenePickerApp();
      if (!Picker) { ui.notifications?.error?.("Scene Picker failed to load. See console."); return; }
      new Picker({
        onSelect: (scene) => {
          this.beat.cinematic ??= { enabled: false, startSceneId: null, durationMs: 8000, nextSceneId: null };
          this.beat.cinematic.nextSceneId = scene?.uuid || (scene?.id ? `Scene.${scene.id}` : null);
          this.render();
        }
      }).render(true);
    });

    html.find("[data-action='activate-cinematic-start']").on("click", async ev => {
      ev.preventDefault();
      const raw = String(this.beat?.cinematic?.startSceneId || "").trim();
      if (!raw) return;
      try {
        let scene = raw.includes(".") ? await fromUuid(raw) : (game.scenes?.get?.(raw) || null);
        if (!scene && !raw.includes(".")) {
          try { scene = await fromUuid(`Scene.${raw}`); } catch (e) { }
        }
        if (scene?.activate) await scene.activate();
      } catch (e) {
        console.warn(TAG, "Activate cinematic start scene failed:", e);
        ui.notifications?.warn?.("Could not activate cinematic start scene. See console.");
      }
    });

    html.find("[data-action='activate-cinematic-next']").on("click", async ev => {
      ev.preventDefault();
      const raw = String(this.beat?.cinematic?.nextSceneId || "").trim();
      if (!raw) return;
      try {
        let scene = raw.includes(".") ? await fromUuid(raw) : (game.scenes?.get?.(raw) || null);
        if (!scene && !raw.includes(".")) {
          try { scene = await fromUuid(`Scene.${raw}`); } catch (e) { }
        }
        if (scene?.activate) await scene.activate();
      } catch (e) {
        console.warn(TAG, "Activate cinematic next scene failed:", e);
        ui.notifications?.warn?.("Could not activate cinematic next scene. See console.");
      }
    });

    html.find("[data-action='clear-cinematic-start']").on("click", ev => {
      ev.preventDefault();
      this.beat.cinematic ??= { enabled: false, startSceneId: null, durationMs: 8000, nextSceneId: null };
      this.beat.cinematic.startSceneId = null;
      this.render(false);
    });

    html.find("[data-action='clear-cinematic-next']").on("click", ev => {
      ev.preventDefault();
      this.beat.cinematic ??= { enabled: false, startSceneId: null, durationMs: 8000, nextSceneId: null };
      this.beat.cinematic.nextSceneId = null;
      this.render(false);
    });


    // Journal picker (checkbox list, single-select)
    html.find("[data-action='pick-journal']").on("click", ev => {
      ev.preventDefault();
      this._openJournalPicker();
    });

    html.find("[data-action='clear-journal']").on("click", ev => {
      ev.preventDefault();
      this.beat.journal ??= { enabled: false, entryId: null, force: false };
      this.beat.journal.entryId = null;
      this.render(false);
    });

    html.find("[data-action='open-journal-now']").on("click", ev => {
      ev.preventDefault();
      try {
        const id = _normalizeJournalId(this.beat?.journal?.entryId);
        const je = (id && game.journal) ? game.journal.get(id) : null;
        if (je && je.sheet && typeof je.sheet.render === "function") je.sheet.render(true);
      } catch (e) {
        console.warn(TAG, "open journal now failed:", e);
      }
    });

    // Actors
    html.find("[data-action='add-actor']").on("click", async (ev) => {
      ev.preventDefault();
      const Picker = await _loadActorPickerApp();
      if (!Picker) { ui.notifications?.error?.("Actor Picker failed to load. See console."); return; }
      new Picker({
        onSelect: (actor) => {
          if (!actor?.uuid) return;
          this.beat.actors ??= [];
          if (!this.beat.actors.includes(actor.uuid)) this.beat.actors.push(actor.uuid);
          this.render(false);
        }
      }).render(true);
    });

    html.find("[data-action='remove-actor']").on("click", ev => {
      ev.preventDefault();
      const idx = Number(ev.currentTarget?.dataset?.index);
      if (!Number.isFinite(idx)) return;
      this.beat.actors.splice(idx, 1);
      this.render(false);
    });

    // Choices
    html.find("[data-action='add-choice']").on("click", ev => {
      ev.preventDefault();

      // Preserve any unsaved edits in existing choice rows before we append a new one.
      this._syncChoicesFromForm();

      this.beat.choices ??= [];
      this.beat.choices.push({
        label: "New Choice",
        description: "",
        next: "",
        checkStat: "",
        checkDC: 0,
        failNext: ""
      });
      this.render(false);
    });

    html.find("[data-action='remove-choice']").on("click", ev => {
      ev.preventDefault();
      const idx = Number(ev.currentTarget?.dataset?.index);
      if (!Number.isFinite(idx)) return;

      // Preserve unsaved edits before removing.
      try { if (typeof this._syncChoicesFromForm === "function") this._syncChoicesFromForm(); } catch (e0) {}

      // Confirmation toast (easy to misclick). Hold Shift to bypass.
      const bypass = !!ev.shiftKey;
      if (!bypass) {
        const now = Date.now();
        const pending = this._pendingChoiceDelete || null;
        if (!pending || pending.idx !== idx || (now - pending.ts) > 1500) {
          this._pendingChoiceDelete = { idx, ts: now };
          ui.notifications?.warn?.("Click Remove again to delete this Choice (or hold Shift).");
          return;
        }
      }
      this._pendingChoiceDelete = null;

      this.beat.choices.splice(idx, 1);
      this.render(false);
    });

    // World Effects
    html.find("[data-action='add-faction-effect']").on("click", ev => {
      ev.preventDefault();

      this.beat.worldEffects ??= {};
      this.beat.worldEffects.factionEffects ??= [];

      // Seed factionId from the campaign default faction (so you don't have to paste UUIDs).
      const defaultFactionId = this._getCampaignDefaultFactionId();

      this.beat.worldEffects.factionEffects.push({
        factionId: defaultFactionId || "",
        moraleDelta: 0,
        loyaltyDelta: 0,
        unityDelta: 0,
        darknessDelta: 0
      });

      this.render(false);
    });

    html.find("[data-action='remove-faction-effect']").on("click", ev => {
      ev.preventDefault();
      const idx = Number(ev.currentTarget?.dataset?.index);
      if (!Number.isFinite(idx)) return;
      this.beat.worldEffects.factionEffects.splice(idx, 1);
      this.render(false);
    });

    html.find("[data-action='add-turn-request']").on("click", ev => {
      ev.preventDefault();
      this.beat.worldEffects = this.beat.worldEffects || {};
      this.beat.worldEffects.turnRequests = this.beat.worldEffects.turnRequests || [];
      this.beat.worldEffects.turnRequests.push({
        key: "",
        mode: "",
        target: "",
        amount: 0,
        note: ""
      });
      this.render(false);
    });

    html.find("[data-action='remove-turn-request']").on("click", ev => {
      ev.preventDefault();
      const idx = Number(ev.currentTarget?.dataset?.index);
      if (!Number.isFinite(idx)) return;
      this.beat.worldEffects.turnRequests.splice(idx, 1);
      this.render(false);
    });

    html.find("[data-action='add-quest-effect']").on("click", ev => {
      ev.preventDefault();
      this.beat.worldEffects ??= {};
      this.beat.worldEffects.questEffects ??= [];
      this.beat.worldEffects.questEffects.push({
        action: "accept",
        questId: "",
        beatId: "",
        state: "",
        text: ""
      });
      this.render(false);
    });

    html.find("[data-action='remove-quest-effect']").on("click", ev => {
      ev.preventDefault();
      const idx = Number(ev.currentTarget?.dataset?.index);
      if (!Number.isFinite(idx)) return;
      this.beat.worldEffects ??= {};
      this.beat.worldEffects.questEffects ??= [];
      this.beat.worldEffects.questEffects.splice(idx, 1);
      this.render(false);
    });

  }

  _openJournalPicker() {
    try {
      const journals = (game.journal && Array.isArray(game.journal.contents)) ? game.journal.contents : [];
      if (!journals.length) {
        ui.notifications?.warn?.("No Journal Entries found in this world.");
        return;
      }

      const cur = _normalizeJournalId(this.beat?.journal?.entryId);
      const rows = journals
        .slice()
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
        .map(j => {
          const checked = (j.id === cur) ? "checked" : "";
          const folder = j.folder ? ` <span class="bbttcc-muted">(${_escapeHtml(j.folder.name)})</span>` : "";
          return `
            <label class="bbttcc-picker-item" style="display:flex; gap:.6rem; align-items:center; padding:.35rem .25rem;">
              <input type="checkbox" name="journalPick" value="${_escapeHtml(j.id)}" ${checked}>
              <span style="flex:1 1 auto;">${_escapeHtml(j.name)}${folder}</span>
              <code class="bbttcc-muted" style="opacity:.8;">JournalEntry.${_escapeHtml(j.id)}</code>
            </label>
          `;
        })
        .join("");

      const content = `
        <form class="bbttcc-journal-picker">
          <div class="bbttcc-muted" style="margin-bottom:.35rem;">
            Pick a Journal Entry to auto-open when this Beat runs.
          </div>
          <div class="bbttcc-picker-list" style="max-height:420px; overflow:auto; border:1px solid rgba(255,255,255,0.12); border-radius:10px; padding:.35rem .5rem;">
            ${rows}
          </div>
        </form>
      `;

      new Dialog({
        title: "Pick Journal Entry",
        content,
        buttons: {
          ok: {
            label: "Confirm",
            callback: (html) => {
              const picked = html.find("input[name='journalPick']:checked").val() || "";
              this.beat.journal ??= { enabled: false, entryId: null, force: false };
              this.beat.journal.entryId = picked ? _normalizeJournalUuid(picked) : null;
              this.render(false);
            }
          },
          cancel: { label: "Cancel" }
        },
        default: "ok",
        render: (html) => {
          // enforce single-select while preserving checkbox UI
          html.find("input[name='journalPick']").on("change", (ev) => {
            const t = ev.currentTarget;
            if (t && t.checked) {
              html.find("input[name='journalPick']").not(t).prop("checked", false);
            }
          });
        }
      }).render(true);
    } catch (e) {
      console.warn(TAG, "openJournalPicker failed:", e);
      ui.notifications?.warn?.("Could not open Journal picker. See console.");
    }
  }

  /**
   * Harvest ONLY the current Choices fields from the live form and update this.beat.choices.
   * This prevents the common UX bug where clicking "Add Choice" resets in-progress edits
   * in existing choice rows.
   */

/**
 * Harvest the current CORE fields from the live DOM and keep this.beat in sync
 * so tab switches don't wipe in-progress edits.
 *
 * NOTE: We read from DOM selectors (not FormData) because some core controls
 * are injected panels that may not be strict descendants of the <form>.
 */
_syncCoreFromForm() {
  try {
    const $el = this.element;
    if (!$el || !$el.find) return;

    const _val = (sel) => {
      try {
        const $n = $el.find(sel);
        if (!$n || !$n.length) return null;
        return $n.val ? $n.val() : ($n[0] ? $n[0].value : null);
      } catch (e) { return null; }
    };
    const _checked = (sel) => {
      try {
        const $n = $el.find(sel);
        if (!$n || !$n.length) return false;
        return !!$n.prop("checked");
      } catch (e) { return false; }
    };

    // Basic
    const id = _val("input[name='id']");
    if (id != null) this.beat.id = String(id || "").trim();

    const label = _val("input[name='label']");
    if (label != null) this.beat.label = String(label || "").trim();

    const type = _val("select[name='type']");
    if (type != null) this.beat.type = String(type || "").trim() || "custom";

    const timeScale = _val("select[name='timeScale']");
    if (timeScale != null) this.beat.timeScale = String(timeScale || "").trim() || "scene";

    // Player-facing mirror toggle
    // Checkbox named "playerFacing"
    this.beat.playerFacing = _checked("input[name='playerFacing']");
    this.beat.playerFacingDialog = this.beat.playerFacing;
    this.beat.dialogPlayerFacing = this.beat.playerFacing;
    this.beat.playerFacingContent = this.beat.playerFacing;
    this.beat.showToPlayers = this.beat.playerFacing;


    // Optional Time Points
    const tpRaw = _val("input[name='timePoints']");
    if (tpRaw != null) {
      const tp = Number(tpRaw);
      this.beat.timePoints = (tpRaw === "" || tpRaw == null) ? null : (isFinite(tp) ? Math.max(0, Math.floor(tp)) : null);
    }

    // Turn assignment (injected)
    const tnRaw = _val("input[name='turnNumber'], select[name='turnNumber']");
    if (tnRaw != null) {
      const tn = Number(tnRaw);
      this.beat.turnNumber = (!tnRaw) ? null : ((isFinite(tn) && tn >= 1) ? Math.floor(tn) : null);
    }

    // Description
    const desc = _val("textarea[name='description']");
    if (desc != null) this.beat.description = String(desc || "").trim();

    // Linked Scene
    const sceneId = _val("input[name='sceneId']");
    if (sceneId != null) this.beat.sceneId = String(sceneId || "").trim() || null;

    // Cinematic (injected)
    this.beat.cinematic = this.beat.cinematic || { enabled: false, startSceneId: null, durationMs: 8000, nextSceneId: null };
    this.beat.cinematic.enabled = !!_checked("input[name='cinematic-enabled']");

    const cinStart = _val("input[name='cinematic-start-scene-id']");
    if (cinStart != null) this.beat.cinematic.startSceneId = String(cinStart || "").trim() || null;

    const cinNext = _val("input[name='cinematic-next-scene-id']");
    if (cinNext != null) this.beat.cinematic.nextSceneId = String(cinNext || "").trim() || null;

    const cinDur = _val("input[name='cinematic-duration-ms']");
    if (cinDur != null) {
      const d = Number(cinDur);
      this.beat.cinematic.durationMs = isFinite(d) ? Math.max(0, Math.floor(d)) : (this.beat.cinematic.durationMs || 0);
    }

    // Cinematic beats should keep Linked Scene blank
    try {
      const isCine = (String(this.beat.type || "").trim() === "cinematic") || !!(this.beat.cinematic && this.beat.cinematic.enabled);
      if (isCine) this.beat.sceneId = null;
    } catch (eCine) {}

    // Quest linkage
    const qid = _val("select[name='questId']");
    if (qid != null) this.beat.questId = String(qid || "").trim() || null;

    const qStepRaw = _val("input[name='questStep']");
    if (qStepRaw != null) {
      const qs = Number(qStepRaw);
      this.beat.questStep = (!qStepRaw) ? null : (isFinite(qs) ? Math.max(0, Math.floor(qs)) : null);
    }

    const qRole = _val("input[name='questRole']");
    if (qRole != null) this.beat.questRole = String(qRole || "").trim() || null;

    // Tags
    const tags = _val("textarea[name='tags'], input[name='tags']");
    if (tags != null) this.beat.tags = _normalizeTags(_tagArray(String(tags || "")).map(_canonAuthorTag).filter(Boolean).join(" "));

    const pt = _val("textarea[name='politicalTags'], input[name='politicalTags']");
    if (pt != null) this.beat.politicalTags = _normalizeTags(_tagArray(String(pt || "")).map(_canonPoliticalTag).filter(Boolean).join(" "));
  } catch (e) {
    console.warn(TAG, "syncCoreFromForm failed:", e);
  }
}

  _syncChoicesFromForm() {
    try {
      // Locate the active form in the rendered app
      let form = this.element?.find?.("form.bbttcc-beat-editor-form")?.[0];
      if (!form) form = this.element?.find?.("form")?.[0];
      if (!form || !(form instanceof HTMLFormElement)) return;

      const fd = new FormData(form);

    // Beat Audio (Narration)
    try {
      this.beat.audio ??= { enabled: false, src: "", volume: 0.85, loop: false, autoplay: false, broadcastPlayers: false };
      const a = this.beat.audio;
      a.enabled = !!fd.get("audio-enabled");
      const src0 = fd.get("audio-src");
      if (src0 != null) a.src = String(src0 || "").trim();
      const v0 = fd.get("audio-volume");
      const v = Number(v0 != null ? v0 : a.volume);
      a.volume = (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.85);
      a.loop = !!fd.get("audio-loop");
      a.autoplay = !!fd.get("audio-autoplay");
    } catch (_eAudSave) {
      /* no-op */
    }

      const chLabels = fd.getAll("choice-label").map(v => String(v || "").trim());
      const chNexts = fd.getAll("choice-next").map(v => String(v || "").trim());
      const chDescs = fd.getAll("choice-desc").map(v => String(v || "").trim());
      const chCheckStats = fd.getAll("choice-check-stat").map(v => String(v || "").trim());
      const chCheckDCs = fd.getAll("choice-check-dc").map(v => _safeNum(v, 0));
      const chFailNexts = fd.getAll("choice-fail-next").map(v => String(v || "").trim());

      const choices = [];
      const n = Math.max(chLabels.length, chNexts.length, chDescs.length, chCheckStats.length, chCheckDCs.length, chFailNexts.length);
      for (let i = 0; i < n; i++) {
        const label = chLabels[i] || "";
        const next = chNexts[i] || "";
        const description = chDescs[i] || "";
        const checkStat = chCheckStats[i] || "";
        const checkDC = chCheckDCs[i] ?? 0;
        const failNext = chFailNexts[i] || "";
        if (!label && !next && !description && !checkStat && !failNext) continue;
        choices.push({ label: label || `Choice ${i + 1}`, next, description, checkStat, checkDC, failNext });
      }

      this.beat.choices = choices;
    } catch (e) {
      console.warn(TAG, "syncChoicesFromForm failed:", e);
    }
  }

  _getCampaignDefaultFactionId() {
    try {
      const api = game.bbttcc?.api?.campaign;
      const c = (this.campaignId && api?.getCampaign) ? api.getCampaign(this.campaignId) : null;
      return String(c?.factionId || "").trim() || null;
    } catch (e) {
      return null;
    }
  }

  _saveFromForm(clickedEl) {
    let form = clickedEl?.closest?.("form");
    if (!form) form = this.element?.find?.("form.bbttcc-beat-editor-form")?.[0];
    if (!form) form = this.element?.find?.("form")?.[0];

    if (!form || !(form instanceof HTMLFormElement)) {
      console.error(TAG, "Could not locate HTMLFormElement for beat editor save.", { form, clickedEl });
      ui.notifications?.error?.("Beat Editor: Could not locate form for Save.");
      return;
    }

    const fd = new FormData(form);

    // Basic
    this.beat.id = (fd.get("id") || this.beat.id || "").trim();
    this.beat.label = String(fd.get("label") || "").trim();
    this.beat.type = String(fd.get("type") || this.beat.type || "custom").trim();
    this.beat.timeScale = String(fd.get("timeScale") || this.beat.timeScale || "scene").trim();

    // Player-facing mirror toggle (read-only view for players)
    // Checkbox named "playerFacing" => FormData returns "on" when checked.
    this.beat.playerFacing = !!fd.get("playerFacing");
    // Compatibility mirrors for older / alternate runtime readers.
    this.beat.playerFacingDialog = this.beat.playerFacing;
    this.beat.dialogPlayerFacing = this.beat.playerFacing;
    this.beat.playerFacingContent = this.beat.playerFacing;
    this.beat.showToPlayers = this.beat.playerFacing;


    // Turn assignment (Campaign Turn Flow)
    // Template stores this as a select/input named "turnNumber".
    try {
      const rawTurn = fd.get("turnNumber");
      if (rawTurn === "" || rawTurn == null) {
        this.beat.turnNumber = null;
      } else {
        const tn = Math.floor(_safeNum(rawTurn, 0));
        this.beat.turnNumber = (Number.isFinite(tn) && tn >= 1) ? tn : null;
      }
    } catch (_eTurn) {
      // keep existing
    }
    // Time Points (optional override). Blank means "use timeScale default at runtime".
    const tpRaw = fd.get("timePoints");
    if (tpRaw === "" || tpRaw == null) this.beat.timePoints = null;
    else {
      const tp = Math.floor(_safeNum(tpRaw, 0));
      this.beat.timePoints = Number.isFinite(tp) ? Math.max(0, tp) : null;
    }

    // Quest linkage

    try {
      const qid = String(fd.get("questId") || "").trim();
      this.beat.questId = qid || null;

      const qStepRaw = fd.get("questStep");
      if (qStepRaw === "" || qStepRaw == null) this.beat.questStep = null;
      else {
        const qn = Math.max(0, Math.floor(_safeNum(qStepRaw, 0)));
        this.beat.questStep = Number.isFinite(qn) ? qn : null;
      }

      const qRole = String(fd.get("questRole") || "").trim();
      this.beat.questRole = qRole || null;
    } catch (_eQ) {}

    // Encounter (only applies when type=encounter)
    if (this.beat.type === "encounter") {
      const encKey = String(fd.get("encounter-key") || "").trim();
      const encTierRaw = fd.get("encounter-tier");
      const encTier = (encTierRaw === "" || encTierRaw == null) ? null : Math.max(0, Math.floor(_safeNum(encTierRaw, 0)));
      const encActorName = String(fd.get("encounter-actor-name") || "").trim();
      this.beat.encounter = {
        key: encKey || null,
        tier: encTier,
        actorName: encActorName || null
      };
    } else {
      // Preserve encounter payload if author temporarily switches type.
      this.beat.encounter ??= { key: "", tier: null, actorName: "" };
    }

    // Description
    this.beat.description = String(fd.get("description") || "").trim();

    // Scene
    this.beat.sceneId = String(fd.get("sceneId") || "").trim() || null;

    // Cinematic (timed scene chain)
    this.beat.cinematic ??= { enabled: false, startSceneId: null, durationMs: 8000, nextSceneId: null };
    this.beat.cinematic.enabled = !!fd.get("cinematic-enabled");
    this.beat.cinematic.startSceneId = String(fd.get("cinematic-start-scene-id") || this.beat.cinematic.startSceneId || "").trim() || null;
    this.beat.cinematic.nextSceneId  = String(fd.get("cinematic-next-scene-id")  || this.beat.cinematic.nextSceneId  || "").trim() || null;
    this.beat.cinematic.durationMs = Math.max(0, Math.floor(_safeNum(fd.get("cinematic-duration-ms"), this.beat.cinematic.durationMs || 0)));

    // Cinematic beats should NOT use beat.sceneId (Linked Scene). Leaving it populated causes
    // the beat description/dialog to appear before the cinematic chain launches.
    // We intentionally keep Linked Scene blank for cinematics.
    try {
      const isCine = (String(this.beat.type || "").trim() === "cinematic") || !!(this.beat.cinematic && this.beat.cinematic.enabled);
      if (isCine) this.beat.sceneId = null;
    } catch (_eCineClear) {}


    
    // Journal
    this.beat.journal ??= { enabled: false, entryId: null, force: false };
    this.beat.journal.enabled = !!fd.get("journal-enabled");
    this.beat.journal.force = !!fd.get("journal-force");
    const jEntry = String(fd.get("journal-entry-id") || "").trim();
    this.beat.journal.entryId = jEntry ? _normalizeJournalUuid(jEntry) : null;

    // Tags + Injection
    this.beat.tags = _normalizeTags(_tagArray(fd.get("tags") || this.beat.tags || "").map(_canonAuthorTag).filter(Boolean).join(" "));
    // Political Tags (AAE)
    this.beat.politicalTags = _normalizeTags(_tagArray(fd.get("politicalTags") || this.beat.politicalTags || "").map(_canonPoliticalTag).filter(Boolean).join(" "));

    // Unlock rewards (checklist fields)
    try {
      const mans = fd.getAll("unlock-maneuver").map(v => String(v||"").trim()).filter(Boolean);
      const strs = fd.getAll("unlock-strategic").map(v => String(v||"").trim()).filter(Boolean);
      this.beat.unlocks = { maneuvers: mans, strategics: strs };
    } catch (e) {
      this.beat.unlocks = this.beat.unlocks || { maneuvers: [], strategics: [] };
    }

    // Target Hex UUID (optional)
    try {
      const th = String(fd.get("targetHexUuid") || "").trim();
      this.beat.targetHexUuid = th || null;
    } catch (_eTH) {
      // keep existing
    }

    // World Modifiers (persistent outcomes)
    // These are maintained live by _ensureWorldModifiersUI, not round-tripped through hidden JSON.
    this.beat.worldEffects = this.beat.worldEffects || {};
    this.beat.worldEffects.worldModifiers = Array.isArray(this.beat.worldEffects.worldModifiers)
      ? this.beat.worldEffects.worldModifiers
      : [];
    this.beat.inject ??= {};
    const inj = this.beat.inject;
    inj.oncePerHex = _boolFromSelect(fd.get("inject-once-per-hex"), false);
    inj.cooldownTurns = Math.max(0, _safeNum(fd.get("inject-cooldown-turns"), 0));
    inj.repeatable = _boolFromSelect(fd.get("inject-repeatable"), true);
    inj.promptGM = _triFromSelect(fd.get("inject-prompt-gm"));
    inj.fallbackOnDecline = _triFromSelect(fd.get("inject-fallback-on-decline"));
    inj.allowMulti = _triFromSelect(fd.get("inject-allow-multi"));
    inj.oncePerHexGlobal = _triFromSelect(fd.get("inject-once-per-hex-global"));

    // Actors
    const actorUuids = fd.getAll("actor-uuid").map(v => String(v || "").trim()).filter(Boolean);
    this.beat.actors = actorUuids;

    // Choices
    const chLabels = fd.getAll("choice-label").map(v => String(v || "").trim());
    const chNexts = fd.getAll("choice-next").map(v => String(v || "").trim());
    const chDescs = fd.getAll("choice-desc").map(v => String(v || "").trim());
    const chCheckStats = fd.getAll("choice-check-stat").map(v => String(v || "").trim());
    const chCheckDCs = fd.getAll("choice-check-dc").map(v => _safeNum(v, 0));
    const chFailNexts = fd.getAll("choice-fail-next").map(v => String(v || "").trim());

    const choices = [];
    const n = Math.max(chLabels.length, chNexts.length, chDescs.length, chCheckStats.length, chCheckDCs.length, chFailNexts.length);
    for (let i = 0; i < n; i++) {
      const label = chLabels[i] || "";
      const next = chNexts[i] || "";
      const description = chDescs[i] || "";
      const checkStat = chCheckStats[i] || "";
      const checkDC = chCheckDCs[i] ?? 0;
      const failNext = chFailNexts[i] || "";
      if (!label && !next && !description && !checkStat && !failNext) continue;
      choices.push({ label: label || `Choice ${i + 1}`, next, description, checkStat, checkDC, failNext });
    }
    this.beat.choices = choices;

    // World Effects
    this.beat.worldEffects ??= {};
    const we = this.beat.worldEffects;

    we.territoryOutcome = String(fd.get("world-territory-outcome") || "").trim() || null;
    we.radiationDelta = _safeNum(fd.get("world-radiation-delta"), 0);
    we.sparkKey = String(fd.get("world-spark-key") || "").trim() || null;
    we.warLog = String(fd.get("world-warlog") || "").trim() || "";

    // Faction effects arrays
    const fxFaction = fd.getAll("world-faction-id").map(v => String(v || "").trim());
    const fxMorale = fd.getAll("world-faction-morale").map(v => _safeNum(v, 0));
    const fxLoyalty = fd.getAll("world-faction-loyalty").map(v => _safeNum(v, 0));
    const fxUnity = fd.getAll("world-faction-unity").map(v => _safeNum(v, 0));
    const fxDark = fd.getAll("world-faction-darkness").map(v => _safeNum(v, 0));

    const factionEffects = [];
    const fxN = Math.max(fxFaction.length, fxMorale.length, fxLoyalty.length, fxUnity.length, fxDark.length);
    for (let i = 0; i < fxN; i++) {
      if (!fxFaction[i]) continue;
      factionEffects.push({
        factionId: fxFaction[i],
        moraleDelta: fxMorale[i] ?? 0,
        loyaltyDelta: fxLoyalty[i] ?? 0,
        unityDelta: fxUnity[i] ?? 0,
        darknessDelta: fxDark[i] ?? 0
      });
    }
    we.factionEffects = factionEffects;

    // Extended Faction GM Effects: VP + OP Bank deltas (if authored)
    try {
      const fxVP = fd.getAll("world-faction-vp").map(v => _safeNum(v, 0));

      // OP delta arrays (aligned by index with world-faction-id)
      const opArr = {};
      const OP_KEYS2 = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
      for (const k of OP_KEYS2) {
        opArr[k] = fd.getAll("world-faction-op-" + k).map(v => _safeNum(v, 0));
      }
      const allowOC = fd.getAll("world-faction-op-allowOvercap").map(v => {
        // Checkboxes return "on" for checked; absent for unchecked (so getAll only includes checked boxes).
        // We need per-row alignment; safest is to read via DOM below. We'll default false here and fix in DOM pass.
        return true;
      });

      // DOM-based allowOvercap alignment (per row)
      let allowByRow = [];
      try {
        const rowEls = Array.from(this.element?.find?.(".bbttcc-fxgm-row") || []);
        allowByRow = rowEls.map(el => !!$(el).find("input[name='world-faction-op-allowOvercap']").prop("checked"));
      } catch (_eOC) { allowByRow = []; }

      const nFx = Math.max(we.factionEffects.length, fxVP.length, ...Object.values(opArr).map(a => a.length));
      for (let i = 0; i < nFx; i++) {
        const row = we.factionEffects[i];
        if (!row) continue;

        // VP
        const vp = fxVP[i] ?? 0;
        if (vp) row.vpDelta = vp;

        // OP deltas
        const deltas = {};
        for (const k of OP_KEYS2) {
          const dv = opArr[k][i] ?? 0;
          if (dv) deltas[k] = dv;
        }
        row.opDeltas = deltas;

        // Allow overcap
        row.allowOvercap = !!(allowByRow[i] ?? false);
      }
    } catch (_eFxExt) {
      // ignore
    }


    // Turn requests arrays (structured; no raw JSON authoring)
    const rqKeys   = fd.getAll("world-request-key").map(v => String(v || "").trim());
    const rqModes  = fd.getAll("world-request-mode").map(v => String(v || "").trim());
    const rqTargets= fd.getAll("world-request-target").map(v => String(v || "").trim());
    const rqAmts   = fd.getAll("world-request-amount").map(v => _safeNum(v, 0));
    const rqNotes  = fd.getAll("world-request-note").map(v => String(v || "").trim());

    const turnRequests = [];
    const rqN = Math.max(rqKeys.length, rqModes.length, rqTargets.length, rqAmts.length, rqNotes.length);

    for (let i = 0; i < rqN; i++) {
      const key = rqKeys[i] || "";
      if (!key) continue;

      const mode = rqModes[i] || "";
      const target = rqTargets[i] || "";
      const amount = rqAmts[i] || 0;
      const note = rqNotes[i] || "";

      const value = {};
      if (mode) value.mode = mode;
      if (target) value.target = target;
      if (amount) value.amount = amount;
      if (note) value.note = note;

      turnRequests.push({
        key: key,
        value: value
      });
    }

    we.turnRequests = turnRequests;

    // Relationship Effects (Status Step) — injected UI (not in HBS)
    try {
      const relRows = Array.from(this.element?.find?.(".bbttcc-relfx-row") || []);
      const rel = [];
      for (const el of relRows) {
        const $el = $(el);
        const a = String($el.find(".bbttcc-relfx-a").val() || "").trim();
        const b = String($el.find(".bbttcc-relfx-b").val() || "").trim();
        const steps = Math.floor(_safeNum($el.find(".bbttcc-relfx-steps").val(), 0));
        const reciprocal = !!$el.find(".bbttcc-relfx-recip").prop("checked");
        const note = String($el.find(".bbttcc-relfx-note").val() || "").trim();
        if (!a || !b || !steps) continue; // ignore incomplete rows and 0 steps
        rel.push({ aFactionId: a, bFactionId: b, steps, reciprocal, note });
      }
      we.relationshipEffects = rel;
    } catch (_eRel) {
      we.relationshipEffects = Array.isArray(we.relationshipEffects) ? we.relationshipEffects : [];
    }



// Quest effects arrays
const qxAct = fd.getAll("world-questfx-action").map(v => String(v || "").trim());
const qxQid = fd.getAll("world-questfx-questId").map(v => String(v || "").trim());
const qxBid = fd.getAll("world-questfx-beatId").map(v => String(v || "").trim());
const qxSt  = fd.getAll("world-questfx-state").map(v => String(v || "").trim());
const qxTx  = fd.getAll("world-questfx-text").map(v => String(v || "").trim());

const questEffects = [];
const qxN = Math.max(qxAct.length, qxQid.length, qxBid.length, qxSt.length, qxTx.length);
for (let i = 0; i < qxN; i++) {
  if (!qxAct[i] && !qxQid[i] && !qxBid[i] && !qxSt[i] && !qxTx[i]) continue;
  const action = qxAct[i] || "accept";
  const questId = qxQid[i] || "";
  if (!questId) continue;
  questEffects.push({
    action,
    questId,
    beatId: qxBid[i] || "",
    state: qxSt[i] || "",
    text: qxTx[i] || ""
  });
}
we.questEffects = questEffects;


    console.log(TAG, "Saving beat via hook:", { campaignId: this.campaignId, beat: this.beat });

    Hooks.call("bbttcc-campaign:updateBeat", {
      campaignId: this.campaignId,
      prevBeatId: this._originalBeatId,
      beat: foundry.utils.deepClone(this.beat)
    });

    ui.notifications?.info?.("Beat updated.");
    this.close();
  }
}

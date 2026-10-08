// facilitation.js — FACILITATION MODES for the Campaign Engine (2026-10-07, owner ask).
//
// The shipped story content comes with selectable TABLE EXPERIENCES. One world setting
// (`facilitation.mode`) names a preset; an eight-key POLICY object (`facilitation.policy`)
// is what the engine actually reads. Picking a preset WRITES the eight keys, so Manual
// starts from the last preset and the GM nudges from there.
//
// The policy sits ON TOP of the per-beat authoring fields. Every key has an `authored`
// value meaning "honour the beat exactly as its writer set it" — a GM authoring their own
// story still decides text / audio / order per beat; the mode decides what of that the
// table gets. Spec: ~/FACILITATION_MODES_SPEC.md. Rulings (Dave, 2026-10-07): Autopilot
// is the third automated mode; Projectionist = GM clicks; Tabletop rolls = players roll
// every check by hand and the GM records it; names Tabletop / Projectionist / Autopilot / Manual.
//
//   game.bbttcc.api.campaign.facilitation.get()        → effective policy (all 8 keys)
//   game.bbttcc.api.campaign.facilitation.mode()       → "tabletop"|"projectionist"|"autopilot"|"manual"
//   game.bbttcc.api.campaign.facilitation.set("tabletop")      → apply a preset (GM)
//   game.bbttcc.api.campaign.facilitation.set({ narration:"off" }) → Manual + patch (GM)
//   game.bbttcc.api.campaign.facilitation.open()       → the settings window
//   Hook: "bbttcc:campaign:facilitationChanged" { mode, policy, prev }

const MOD_ID = "bbttcc-campaign";
const TAG = "[bbttcc-campaign][facilitation]";
export const SETTING_FACILITATION_MODE = "facilitation.mode";
export const SETTING_FACILITATION_POLICY = "facilitation.policy";
export const GMEXEC_CHOICE_PICK = "bbttcc-campaign:choice.pick";   // Autopilot: a player's mirror click → the GM seat's open beat dialog
export const HOOK_CHANGED = "bbttcc:campaign:facilitationChanged";

const log = (...a) => { try { console.log(TAG, ...a); } catch (_e) {} };
const warn = (...a) => { try { console.warn(TAG, ...a); } catch (_e) {} };

// ── The eight policy keys ────────────────────────────────────────────────────────────────
export const POLICY_KEYS = [
  { key: "beatText",    label: "Beat text to players",
    values: { authored: "As authored (the beat's player-facing flag)", never: "Never — GM narrates", always: "Always mirror every beat" },
    hint: "What of a beat's narrative text reaches player screens." },
  { key: "choices",     label: "Choices on the player mirror",
    values: { authored: "As authored — shown, GM clicks", hidden: "Hidden — players hear them from the GM", mirror: "Shown, GM clicks", playerPick: "Shown, players click (relayed to the GM seat)" },
    hint: "Whether the choice list appears on the mirror, and who may pick. Players never see a choice the beat's text does not reach." },
  { key: "narration",   label: "Narration audio",
    values: { authored: "As authored (beat audio + broadcast flag)", gmLocal: "GM's machine only", off: "Off — the GM narrates aloud" },
    hint: "Beat voice-over tracks and the NPC conversation intro audio." },
  { key: "beatAdvance", label: "Story Director beats",
    values: { gmConfirm: "Ask the GM before each story beat", silent: "Fire without asking" },
    hint: "The world-turn Story Director's offer prompt." },
  { key: "hexAutofire", label: "Hex arrival beats",
    values: { authored: "As authored (onEnter beats fire on arrival)", off: "Off — the GM runs arrival beats by hand" },
    hint: "Beats wired to a hex fire when the coalition arrives." },
  { key: "travelExec",  label: "Who executes travel",
    values: { anyOwner: "Any faction owner (players ride themselves)", gmOnly: "GM only — players plot, then hand the route to the GM" },
    hint: "The Travel Console planner stays open to players either way." },
  { key: "npcAi",       label: "AI-voiced NPC conversations",
    values: { on: "On", off: "Off — NPCs are played at the table" },
    hint: "The mal-voice conversation window and the Director's 'wants a word' invitations." },
  { key: "rolls",       label: "Checks on beat choices",
    values: { rules: "Code rules — aptitude checks to the GM, OP checks auto-roll", gmAll: "Every check to the GM — the table rolls real dice, the GM records SUCCESS / FAIL", auto: "Every check auto-rolls" },
    hint: "OP is still spent for an OP check in every setting." }
];
const KEY_SET = new Set(POLICY_KEYS.map(k => k.key));

// ── Presets ──────────────────────────────────────────────────────────────────────────────
export const PRESETS = {
  tabletop:      { beatText: "never",    choices: "hidden",     narration: "off",      beatAdvance: "gmConfirm", hexAutofire: "authored", travelExec: "gmOnly",   npcAi: "off", rolls: "gmAll" },
  projectionist: { beatText: "authored", choices: "authored",   narration: "authored", beatAdvance: "gmConfirm", hexAutofire: "authored", travelExec: "anyOwner", npcAi: "on",  rolls: "rules" },
  autopilot:     { beatText: "always",   choices: "playerPick", narration: "authored", beatAdvance: "silent",    hexAutofire: "authored", travelExec: "anyOwner", npcAi: "on",  rolls: "auto"  }
};
// Projectionist IS today's behaviour — it is the default and the fallback for any missing key.
const DEFAULT_MODE = "projectionist";

export const MODE_META = {
  tabletop:      { icon: "🎲", label: "Tabletop",
    blurb: "As close to a standard table as the engine gets. Beats stay on the GM's screen — no text, choices or narration tracks reach players. The GM shows the scene and the NPC tokens and narrates. Players plot travel; the GM executes it. NPCs are played at the table, not by the AI. Every check is rolled with real dice and the GM records the result." },
  projectionist: { icon: "🎬", label: "Projectionist",
    blurb: "Full interactivity as the content was authored. Player-facing beats mirror to player screens with their choices; narration tracks play; the AI voices NPCs. The GM forwards beats, adjudicates checks, and role-plays whatever the authored choices and automation don't cover." },
  autopilot:     { icon: "🤖", label: "Autopilot",
    blurb: "The engine runs itself. Every beat mirrors to players, who click their own choices; the Story Director fires without asking; checks auto-roll. The GM seat still has to be present — it is the hands the engine uses — but it can sit back." },
  manual:        { icon: "🎛️", label: "Manual",
    blurb: "Set each behaviour yourself. Starts from whichever preset you last picked." }
};

// ── Readers ──────────────────────────────────────────────────────────────────────────────
function _readRaw(key, fallback) {
  try { return game.settings.get(MOD_ID, key); } catch (_e) { return fallback; }
}
export function facilitationMode() {
  const m = String(_readRaw(SETTING_FACILITATION_MODE, DEFAULT_MODE) || DEFAULT_MODE);
  return (m in PRESETS || m === "manual") ? m : DEFAULT_MODE;
}
/** Effective policy — every key present, unknown values coerced to the Projectionist default. */
export function facilitation() {
  const raw = _readRaw(SETTING_FACILITATION_POLICY, null);
  const base = PRESETS[DEFAULT_MODE];
  const out = { ...base };
  if (raw && typeof raw === "object") {
    for (const def of POLICY_KEYS) {
      const v = raw[def.key];
      if (v != null && Object.prototype.hasOwnProperty.call(def.values, String(v))) out[def.key] = String(v);
    }
  }
  return out;
}

// ── Writer ───────────────────────────────────────────────────────────────────────────────
/**
 * set("tabletop") applies a preset; set("manual") keeps the current policy; set({key:value})
 * patches the policy and switches the mode to Manual. GM seats only (world settings).
 */
export async function setFacilitation(modeOrPatch, { quiet = false } = {}) {
  if (!game.user?.isGM) throw new Error("facilitation.set: GM seats only (world setting)");
  const prev = { mode: facilitationMode(), policy: facilitation() };
  let mode, policy;
  if (typeof modeOrPatch === "string") {
    mode = modeOrPatch;
    if (mode in PRESETS) policy = { ...PRESETS[mode] };
    else if (mode === "manual") policy = { ...prev.policy };
    else throw new Error(`facilitation.set: unknown mode '${mode}'`);
  } else if (modeOrPatch && typeof modeOrPatch === "object") {
    mode = "manual";
    policy = { ...prev.policy };
    for (const [k, v] of Object.entries(modeOrPatch)) {
      if (!KEY_SET.has(k)) { warn(`set: ignoring unknown policy key '${k}'`); continue; }
      const def = POLICY_KEYS.find(d => d.key === k);
      if (!Object.prototype.hasOwnProperty.call(def.values, String(v))) { warn(`set: ignoring bad value '${v}' for '${k}'`); continue; }
      policy[k] = String(v);
    }
    // A manual policy that lands exactly on a preset IS that preset.
    for (const [name, p] of Object.entries(PRESETS)) if (POLICY_KEYS.every(d => p[d.key] === policy[d.key])) { mode = name; break; }
  } else throw new Error("facilitation.set: pass a mode name or a {key:value} patch");

  await game.settings.set(MOD_ID, SETTING_FACILITATION_POLICY, policy);
  await game.settings.set(MOD_ID, SETTING_FACILITATION_MODE, mode);
  const now = { mode, policy };
  try { Hooks.callAll(HOOK_CHANGED, { ...now, prev }); } catch (_eH) {}
  if (!quiet) {
    const meta = MODE_META[mode] || MODE_META.manual;
    try { ui.notifications?.info?.(`${meta.icon} Facilitation: ${meta.label}.`); } catch (_eN) {}
  }
  log("set →", now);
  return now;
}

// ── Settings registration (call inside the module's init block) ──────────────────────────
export function registerFacilitationSettings() {
  game.settings.register(MOD_ID, SETTING_FACILITATION_POLICY, {
    scope: "world", config: false, type: Object, default: { ...PRESETS[DEFAULT_MODE] }
  });
  game.settings.register(MOD_ID, SETTING_FACILITATION_MODE, {
    name: "Facilitation mode",
    hint: "How the table experiences the story content. Tabletop = GM narrates, nothing reaches player screens. Projectionist = full interactivity as authored. Autopilot = the engine runs itself. Manual = set each behaviour in the Facilitation window. Picking a preset here rewrites the eight behaviours.",
    scope: "world", config: true, type: String,
    choices: Object.fromEntries(Object.entries(MODE_META).map(([k, m]) => [k, `${m.icon} ${m.label}`])),
    default: DEFAULT_MODE,
    onChange: (v) => {
      // The config-sheet dropdown has no access to the policy writer; mirror a preset pick into the policy
      // (Manual leaves the policy alone). Only the GM seat that changed it writes.
      try {
        if (!game.user?.isGM) return;
        const m = String(v || "");
        if (!(m in PRESETS)) return;
        const cur = facilitation();
        if (POLICY_KEYS.every(d => PRESETS[m][d.key] === cur[d.key])) return;   // already in sync (set() wrote both)
        game.settings.set(MOD_ID, SETTING_FACILITATION_POLICY, { ...PRESETS[m] })
          .then(() => { try { Hooks.callAll(HOOK_CHANGED, { mode: m, policy: { ...PRESETS[m] }, prev: { mode: null, policy: cur } }); } catch (_e) {} });
      } catch (_e) {}
    }
  });
  try {
    const AppClass = _defineMenuApp();
    if (AppClass) {
      game.settings.registerMenu(MOD_ID, "facilitationMenu", {
        name: "Facilitation — table experience",
        label: "Open Facilitation",
        hint: "Tabletop / Projectionist / Autopilot presets, or set the eight behaviours one by one (Manual).",
        icon: "fas fa-sliders-h",
        type: AppClass,
        restricted: true
      });
    }
  } catch (e) { warn("registerMenu failed:", e); }
}

// ── The window (ApplicationV2, no template) ──────────────────────────────────────────────
let _MenuApp = null;
function _esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function _defineMenuApp() {
  if (_MenuApp) return _MenuApp;
  const AppV2 = foundry?.applications?.api?.ApplicationV2;
  if (!AppV2) return null;

  _MenuApp = class BBTTCCFacilitationApp extends AppV2 {
    static DEFAULT_OPTIONS = {
      id: "bbttcc-facilitation",
      classes: ["bbttcc", "hexchrome", "bbttcc-facilitation"],
      window: { title: "Facilitation — how the table plays the story", icon: "fas fa-sliders-h", resizable: true },
      position: { width: 720, height: "auto" }
    };

    async _renderHTML() {
      const mode = facilitationMode();
      const pol = facilitation();
      const manual = mode === "manual";
      const cards = Object.entries(MODE_META).map(([k, m]) => `
        <label class="fac-card ${k === mode ? "is-on" : ""}" data-mode="${k}">
          <input type="radio" name="fac-mode" value="${k}" ${k === mode ? "checked" : ""}/>
          <div class="fac-card__head"><span class="fac-card__icon">${m.icon}</span><span class="fac-card__name">${_esc(m.label)}</span>${k === mode ? '<span class="fac-card__now">◆ current</span>' : ""}</div>
          <div class="fac-card__blurb">${_esc(m.blurb)}</div>
        </label>`).join("");
      const rows = POLICY_KEYS.map(d => `
        <div class="fac-row">
          <div class="fac-row__label"><b>${_esc(d.label)}</b><div class="fac-row__hint">${_esc(d.hint)}</div></div>
          <select name="pol-${d.key}" data-key="${d.key}" ${manual ? "" : "disabled"}>
            ${Object.entries(d.values).map(([v, lab]) => `<option value="${v}" ${pol[d.key] === v ? "selected" : ""}>${_esc(lab)}</option>`).join("")}
          </select>
        </div>`).join("");
      return `
        <style>
          #bbttcc-facilitation .window-content { padding: 12px 14px; }
          #bbttcc-facilitation .fac-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
          #bbttcc-facilitation .fac-card { display: block; border: 1px solid rgba(255,255,255,.14); border-radius: 12px; padding: 10px 12px; cursor: pointer; }
          #bbttcc-facilitation .fac-card.is-on { border-color: rgba(120,190,255,.9); box-shadow: 0 0 0 1px rgba(120,190,255,.45) inset; }
          #bbttcc-facilitation .fac-card input { display: none; }
          #bbttcc-facilitation .fac-card__head { display: flex; align-items: baseline; gap: 8px; font-weight: 800; }
          #bbttcc-facilitation .fac-card__now { margin-left: auto; font-size: 11px; opacity: .9; color: #ffd86b; }
          #bbttcc-facilitation .fac-card__blurb { font-size: 12px; opacity: .85; margin-top: 6px; line-height: 1.35; }
          #bbttcc-facilitation .fac-rows { border-top: 1px solid rgba(255,255,255,.12); padding-top: 10px; }
          #bbttcc-facilitation .fac-row { display: grid; grid-template-columns: 1fr 1.2fr; gap: 10px; align-items: center; padding: 6px 0; border-bottom: 1px dashed rgba(255,255,255,.08); }
          #bbttcc-facilitation .fac-row__hint { font-size: 11px; opacity: .75; margin-top: 2px; }
          #bbttcc-facilitation select[disabled] { opacity: .55; }
          #bbttcc-facilitation .fac-note { font-size: 12px; opacity: .85; margin: 8px 0 0; }
          #bbttcc-facilitation .fac-foot { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
        </style>
        <section class="fac">
          <div class="fac-cards">${cards}</div>
          <div class="fac-rows">${rows}</div>
          <p class="fac-note">${manual
            ? "Manual: each behaviour applies as set here. A combination that matches a preset is shown as that preset."
            : "Pick <b>Manual</b> to edit the behaviours one by one. Presets rewrite all eight when applied."}</p>
          <div class="fac-foot">
            <button type="button" data-action="fac-apply" class="bbttcc-travel-button primary">Apply</button>
            <button type="button" data-action="fac-close">Close</button>
          </div>
        </section>`;
    }

    _replaceHTML(result, content) { content.innerHTML = result; this._bind(content); }

    _bind(root) {
      root.querySelectorAll('input[name="fac-mode"]').forEach(r => r.addEventListener("change", () => {
        const m = r.value;
        root.querySelectorAll(".fac-card").forEach(c => c.classList.toggle("is-on", c.dataset.mode === m));
        const manual = m === "manual";
        root.querySelectorAll("select[data-key]").forEach(s => {
          s.disabled = !manual;
          if (!manual && PRESETS[m]) s.value = PRESETS[m][s.dataset.key];
        });
      }));
      root.querySelector('[data-action="fac-apply"]')?.addEventListener("click", async () => {
        try {
          const m = root.querySelector('input[name="fac-mode"]:checked')?.value || DEFAULT_MODE;
          if (m === "manual") {
            const patch = {};
            root.querySelectorAll("select[data-key]").forEach(s => { patch[s.dataset.key] = s.value; });
            await setFacilitation(patch);
          } else await setFacilitation(m);
          this.render({ force: true });
        } catch (e) { warn("apply failed:", e); ui.notifications?.error?.(`Facilitation: ${e?.message || e}`); }
      });
      root.querySelector('[data-action="fac-close"]')?.addEventListener("click", () => this.close());
    }
  };
  return _MenuApp;
}

let _menuInstance = null;
export function openFacilitation() {
  const App = _defineMenuApp();
  if (!App) { ui.notifications?.warn?.("ApplicationV2 unavailable — use the module settings dropdown."); return null; }
  if (!game.user?.isGM) { ui.notifications?.warn?.("Facilitation is set by the GM."); return null; }
  if (_menuInstance && _menuInstance.rendered) return _menuInstance.render({ force: true });
  _menuInstance = new App();
  return _menuInstance.render({ force: true });
}

// ── API surface ──────────────────────────────────────────────────────────────────────────
export function installFacilitationAPI(target) {
  if (!target) return;
  target.facilitation = {
    get: facilitation,
    mode: facilitationMode,
    set: setFacilitation,
    open: openFacilitation,
    presets: PRESETS,
    keys: POLICY_KEYS,
    meta: MODE_META,
    HOOK: HOOK_CHANGED
  };
  // Live refresh of the open window on any seat when the GM changes mode.
  try {
    Hooks.on("updateSetting", (setting) => {
      try {
        const k = String(setting?.key || "");
        if (k !== `${MOD_ID}.${SETTING_FACILITATION_MODE}` && k !== `${MOD_ID}.${SETTING_FACILITATION_POLICY}`) return;
        if (_menuInstance?.rendered) _menuInstance.render({ force: true });
      } catch (_e) {}
    });
  } catch (_e) {}
}

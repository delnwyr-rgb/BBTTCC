// player-beat-mirror-app.js
// Read-only "Beat Mirror" window for players.
// - Shows beat title, descriptions, and choices
// - Players cannot interact; GM remains authoritative
// - Self-contained: inline template + CSS injection
//
// Usage (player side):
//   BBTTCCPlayerBeatMirrorApp.show(beatData)
//   BBTTCCPlayerBeatMirrorApp.close()

const MODULE_ID = "bbttcc-campaign";
const APP_ID = "bbttcc-player-beat-mirror";

let _mirrorInstance = null;

function injectMirrorCSSOnce() {
  const styleId = `${APP_ID}-styles`;
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
  /* Beat Mirror (Player) */
  #${APP_ID} .window-content { padding: 0; overflow: hidden; }
  #${APP_ID} .bbttcc-mirror {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    height: 100%;
    overflow: auto;
  }
  #${APP_ID} .bbttcc-mirror__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    border-bottom: 1px solid rgba(255,255,255,0.12);
    padding-bottom: 8px;
  }
  #${APP_ID} .bbttcc-mirror__title {
    font-size: 18px;
    font-weight: 700;
    line-height: 1.2;
    margin: 0;
  }
  #${APP_ID} .bbttcc-mirror__badge {
    font-size: 12px;
    opacity: 0.9;
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 999px;
    padding: 4px 10px;
    white-space: nowrap;
  }
  #${APP_ID} .bbttcc-mirror__section {
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 12px;
    padding: 10px 12px;
  }
  #${APP_ID} .bbttcc-mirror__section h3 {
    margin: 0 0 8px 0;
    font-size: 13px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    opacity: 0.85;
  }
  #${APP_ID} .bbttcc-mirror__html {
    line-height: 1.4;
  }
  #${APP_ID} .bbttcc-mirror__choices {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  #${APP_ID} .bbttcc-mirror__choice {
    width: 100%;
    text-align: left;
    opacity: 0.75;
    cursor: default !important;
    pointer-events: none !important;
    filter: grayscale(0.2);
  }
  #${APP_ID} .bbttcc-mirror__footer {
    margin-top: auto;
    opacity: 0.75;
    font-size: 12px;
    border-top: 1px solid rgba(255,255,255,0.12);
    padding-top: 8px;
  }
  `;
  document.head.appendChild(style);
}

function escapeHTML(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeBeatData(raw) {
  const beat = raw ?? {};

  // Common fields we might see in your beats
  const title =
    beat.title ??
    beat.name ??
    beat.label ??
    "Beat";

  const sceneDescription =
    beat.sceneDescription ??
    beat.scene?.description ??
    beat.scene_description ??
    "";

  const description =
    beat.description ??
    beat.text ??
    beat.desc ??
    "";

  // Choices can be many shapes; normalize to [{label, description}]
  const rawChoices = Array.isArray(beat.choices) ? beat.choices : [];
  const choices = rawChoices.map((c, idx) => ({
    label: c?.label ?? c?.text ?? c?.title ?? `Choice ${idx + 1}`,
    description: c?.description ?? c?.desc ?? "",
  }));

  return {
    title,
    sceneDescription,
    description,
    choices,
  };
}

function renderMirrorHTML(data) {
  const d = normalizeBeatData(data);

  const hasScene = !!(d.sceneDescription && String(d.sceneDescription).trim().length);
  const hasDesc = !!(d.description && String(d.description).trim().length);
  const hasChoices = Array.isArray(d.choices) && d.choices.length > 0;

  // NOTE: We assume your stored HTML is already safe-ish (you author it).
  // If you want stricter sanitization, we can run it through TextEditor.enrichHTML.
  const sceneHTML = d.sceneDescription || "";
  const descHTML = d.description || "";

  const choicesHTML = (d.choices || []).map((c) => {
    const label = escapeHTML(c.label);
    // Optional per-choice description shown as small text under label.
    const cDesc = (c.description && String(c.description).trim().length)
      ? `<div class="bbttcc-mirror__choice-desc" style="opacity:.8; font-size:12px; margin-top:4px;">${c.description}</div>`
      : "";
    return `
      <button class="bbttcc-mirror__choice">
        <div style="font-weight:600;">${label}</div>
        ${cDesc}
      </button>
    `;
  }).join("");

  return `
  <section class="bbttcc-mirror">
    <header class="bbttcc-mirror__header">
      <h2 class="bbttcc-mirror__title">${escapeHTML(d.title)}</h2>
      <div class="bbttcc-mirror__badge">🔒 GM Controlled</div>
    </header>

    ${hasScene ? `
      <div class="bbttcc-mirror__section">
        <h3>Scene Description</h3>
        <div class="bbttcc-mirror__html">${sceneHTML}</div>
      </div>
    ` : ""}

    ${hasDesc ? `
      <div class="bbttcc-mirror__section">
        <h3>Beat</h3>
        <div class="bbttcc-mirror__html">${descHTML}</div>
      </div>
    ` : ""}

    ${hasChoices ? `
      <div class="bbttcc-mirror__section">
        <h3>Choices</h3>
        <div class="bbttcc-mirror__choices">
          ${choicesHTML}
        </div>
      </div>
    ` : `
      <div class="bbttcc-mirror__section">
        <h3>Choices</h3>
        <div class="bbttcc-mirror__html" style="opacity:.85;">No choices presented.</div>
      </div>
    `}

    <footer class="bbttcc-mirror__footer">
      Awaiting GM resolution…
    </footer>
  </section>
  `;
}

/**
 * We prefer ApplicationV2 if available; fallback to Application.
 */
const BaseApp = globalThis.ApplicationV2 ?? globalThis.Application;

export class BBTTCCPlayerBeatMirrorApp extends BaseApp {
  constructor(beatData = {}, options = {}) {
    super(options);
    this._beatData = beatData ?? {};
  }

  static get defaultOptions() {
    // ApplicationV2 uses DEFAULT_OPTIONS; Application uses defaultOptions getter.
    const base = super.defaultOptions ?? {};
    return foundry.utils.mergeObject(base, {
      id: APP_ID,
      title: "Beat",
      width: 620,
      height: "auto",
      resizable: true,
      classes: ["bbttcc", "hexchrome", "bbttcc-player-mirror"],
    });
  }

  // ApplicationV2 compatibility: some builds use static DEFAULT_OPTIONS
  static DEFAULT_OPTIONS = BBTTCCPlayerBeatMirrorApp.defaultOptions;

  setBeatData(beatData) {
    this._beatData = beatData ?? {};
  }

  async getData(options = {}) {
    // Application (legacy) path
    return normalizeBeatData(this._beatData);
  }

  async _prepareContext(options = {}) {
    // ApplicationV2 path
    return normalizeBeatData(this._beatData);
  }

  async _renderHTML(context, options) {
    // ApplicationV2 render path
    injectMirrorCSSOnce();
    return renderMirrorHTML(context);
  }

  activateListeners(html) {
    super.activateListeners?.(html);

    // Hard-disable any interaction just in case.
    try {
      html.find("button, a, input, select, textarea").prop("disabled", true);
      html.css("pointer-events", "none");
      // But keep scrolling
      html.find(".bbttcc-mirror").css("pointer-events", "auto");
    } catch (e) {
      // ignore
    }
  }

  async _updateObject(event, formData) {
    // Read-only; no updates.
  }
}

/**
 * Convenience API (singleton behavior).
 */
export const PlayerBeatMirrorAPI = {
  show(beatData) {
    // GM should not use this; but harmless if they do.
    if (!game?.user) return;

    if (_mirrorInstance && _mirrorInstance.rendered) {
      _mirrorInstance.setBeatData(beatData);
      _mirrorInstance.render(true);
      return _mirrorInstance;
    }

    _mirrorInstance = new BBTTCCPlayerBeatMirrorApp(beatData);
    _mirrorInstance.render(true);
    return _mirrorInstance;
  },

  close() {
    if (_mirrorInstance) {
      try { _mirrorInstance.close(); } catch (e) {}
      _mirrorInstance = null;
    }
  },

  get instance() {
    return _mirrorInstance;
  }
};

// Optional: attach a stable global for debugging / socket handlers.
globalThis.BBTTCCPlayerBeatMirrorApp = PlayerBeatMirrorAPI;

/**
 * Optional: register under your module namespace if you want:
 * game.bbttcc.api.campaign.playerMirror.show(...)
 */
Hooks.once("ready", () => {
  try {
    game.bbttcc = game.bbttcc ?? {};
    game.bbttcc.api = game.bbttcc.api ?? {};
    game.bbttcc.api.campaign = game.bbttcc.api.campaign ?? {};
    game.bbttcc.api.campaign.playerMirror = PlayerBeatMirrorAPI;
  } catch (e) {
    // Safe no-op
  }
});
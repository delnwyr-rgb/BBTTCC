/* bbttcc-onboarding/scripts/landing.js
 * THE FRONT DOOR (Dave, 2026-10-26) — a player's first login plays the studio ident
 * (Shattered Lens Studios) → the opening film (the As Above crawl, A0-B1…B8, one
 * pre-rendered mp4) → the theme (Section D) → the landing page. Esc skips the film
 * straight to the theme + landing page. Later logins land on the page directly.
 *
 * The landing page is a full-screen overlay (no Scene, never touches the canvas):
 *   🎓 Training — Solo (the director's start()) or Cohort (cohort.join()); either
 *      way the seat is enrolled (user flag campaignClass) exactly like the
 *      "Report for training" card, so graduation hands back to the campaign.
 *   🎞 Training Video — Teaching Slides 1–9 + VO + "Vintage Movie" bed (one mp4).
 *   📚 The Shelf (tours.menu) · ▶ the opening again · 🧍 My Steward · 📜 Quest Log
 *   ♪ volume · Credits · Enter Bad Eden.
 *
 * Media: tools/render-landing-films.sh → art/…/GOTTGAIT Scene files/landing/.
 * GMs never get it automatically: game.bbttcc.onboarding.landing.{open,film,training,close,forgetOpening}.
 * World setting `landingEnabled` turns the automatic page off for everyone.
 */

const MODULE_ID = "bbttcc-onboarding";
const TAG = "[onboarding/landing]";
const MEDIA_DIR = "art/bbttcc/GOTTGAIT/GOTTGAIT Scene files/landing/";
const MEDIA = {
  logo: encodeURI(MEDIA_DIR + "shattered_lens_logo.webp"),
  film: encodeURI(MEDIA_DIR + "opening_film.mp4"),
  training: encodeURI(MEDIA_DIR + "training_video.mp4")
};
const LOGO_HOLD_MS = 3600;       // ident fades in (1.4 s CSS) and holds before the film
const LOGO_OUT_MS = 900;
const RUN_FRESH_MS = 15 * 60 * 1000;   // stage.js treats an activeRuns entry older than this as stale

const _ns = () => globalThis.game?.bbttcc?.onboarding;
/** 10-29: has this seat's Steward finished training? completedAt, or every beat
 *  of the arc done (Alpha graduates from before the director fix never got
 *  completedAt stamped). Drives the "run it again" label and the Solo replay. */
function _trainingDone() {
  try {
    const p = _ns()?.status?.()?.progress;
    if (!p) return false;
    if (p.completedAt) return true;
    const arc = _ns()?.beats?.list?.() ?? [];
    return arc.length > 0 && arc.every(b => p.steps?.[b.id]?.done);
  } catch (_) { return false; }
}
const _esc = (s) => { try { return foundry.utils.escapeHTML(String(s ?? "")); } catch (_) { return String(s ?? ""); } };
const _AH = () => foundry.audio?.AudioHelper ?? globalThis.AudioHelper;

let _root = null;
// 10-29: the Training Video's caption loop stopper. Esc / close() went back
// without it and left a requestAnimationFrame loop on a detached video.
let _stopCaptions = () => {};
function _endCaptions() { const f = _stopCaptions; _stopCaptions = () => {}; try { f(); } catch (_) {} }
let _mode = null;          // "logo" | "film" | "landing" | "video"
let _theme = null;         // the Section D Sound while it plays
let _themeOn = false;
let _logoTimer = null;

/* ─── Settings ─────────────────────────────────────────────────────────────── */
Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "landingEnabled", {
    name: "Landing page — show players the opening film + landing page",
    hint: "On: a player's first login plays the studio ident and the opening film (Esc skips), then the landing page; later logins open on the landing page. GMs open it with game.bbttcc.onboarding.landing.open().",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "landingVolume", {
    scope: "client", config: false, type: Number, default: 0.8
  });
  game.settings.register(MODULE_ID, "landingCaptions", {
    scope: "client", config: false, type: Boolean, default: true
  });
});

function _vol() {
  try { const v = Number(game.settings.get(MODULE_ID, "landingVolume")); return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.8; } catch (_) { return 0.8; }
}

/* ─── Theme (Section D, the onboarding wake theme) ─────────────────────────── */
function _themeSrc() {
  try { return String(game.settings.get(MODULE_ID, "wakeThemeSrc") || "").trim(); } catch (_) { return ""; }
}
async function _playTheme() {
  const src = _themeSrc();
  if (!src) return;
  _stopTheme(0);
  _themeOn = true;
  _syncThemeBtn();
  try {
    const s = await _AH()?.play?.({ src, volume: _vol(), loop: false }, false);
    if (!_themeOn) { try { s?.stop?.(); } catch (_) {} return; }
    _theme = s || null;
    try { _theme?.addEventListener?.("end", () => { _theme = null; _themeOn = false; _syncThemeBtn(); }, { once: true }); } catch (_) {}
  } catch (e) { console.warn(TAG, "theme failed", e); _themeOn = false; _syncThemeBtn(); }
}
function _stopTheme(fadeMs = 1200) {
  _themeOn = false;
  _syncThemeBtn();
  const s = _theme; _theme = null;
  if (!s) return;
  try {
    if (fadeMs > 0 && typeof s.fade === "function") { s.fade(0, { duration: fadeMs }); setTimeout(() => { try { s.stop(); } catch (_) {} }, fadeMs + 100); }
    else s.stop?.();
  } catch (_) {}
}
function _syncThemeBtn() {
  const b = _root?.querySelector?.('[data-act="theme"]');
  if (b) b.textContent = _themeOn ? "♪ Stop theme" : "♪ Play theme";
}

/* ─── Overlay shell ────────────────────────────────────────────────────────── */
function _ensureCss() {
  if (document.getElementById("bbttcc-landing-css")) return;
  const l = document.createElement("link");
  l.id = "bbttcc-landing-css";
  l.rel = "stylesheet";
  l.href = `modules/${MODULE_ID}/styles/landing.css`;
  document.head.appendChild(l);
}

// Keys never reach Foundry while the overlay is up (no hotbar, no canvas pan,
// no Esc main menu). Esc = skip the film / leave a video / close Credits.
function _onKeyCapture(ev) {
  if (!_root) return;
  if (ev.key === "Escape") {
    ev.preventDefault();
    ev.stopImmediatePropagation();
    _onEscape();
    return;
  }
  if (!_root.contains(ev.target)) ev.stopImmediatePropagation();
}
function _onEscape() {
  const modal = _root?.querySelector?.(".bl-modal:not([hidden])");
  if (modal) { modal.hidden = true; return; }
  if (_mode === "logo" || _mode === "film") return _afterFilm();
  if (_mode === "video") return _showLanding({ theme: false });
}

function _mount() {
  _ensureCss();
  if (_root) return _root;
  _root = document.createElement("div");
  _root.id = "bbttcc-landing";
  _root.addEventListener("keydown", (ev) => { if (ev.key !== "Escape") ev.stopPropagation(); });
  document.body.appendChild(_root);
  window.addEventListener("keydown", _onKeyCapture, true);
  requestAnimationFrame(() => _root?.classList.add("is-open"));
  return _root;
}

function close({ keepTheme = true } = {}) {
  clearTimeout(_logoTimer);
  _endCaptions();
  window.removeEventListener("keydown", _onKeyCapture, true);
  const r = _root; _root = null; _mode = null;
  if (!keepTheme) _stopTheme();
  if (!r) return;
  try { r.querySelectorAll("video").forEach(v => { try { v.pause(); } catch (_) {} }); } catch (_) {}
  r.classList.remove("is-open");
  setTimeout(() => r.remove(), 650);
}

/* ─── Ident → film ─────────────────────────────────────────────────────────── */
function _audioLocked() {
  try { return !!game.audio?.locked; } catch (_) { return false; }
}

function film({ ident = true } = {}) {
  const root = _mount();
  _stopTheme(600);
  if (!ident) return _playVideo("film");
  _mode = "logo";
  root.innerHTML =
    `<div class="bl-stage bl-logo">` +
      `<div class="bl-logo-inner">` +
        `<img src="${MEDIA.logo}" alt="">` +
        `<div class="bl-studio">Shattered Lens Studios</div>` +
        `<div class="bl-presents">presents</div>` +
        `<button type="button" class="bl-gate" hidden>▶ Click to begin</button>` +
      `</div>` +
      `<button type="button" class="bl-skip">Skip <kbd>Esc</kbd></button>` +
    `</div>`;
  const inner = root.querySelector(".bl-logo-inner");
  const gate = root.querySelector(".bl-gate");
  root.querySelector(".bl-skip").addEventListener("click", () => _afterFilm());
  const go = () => {
    if (_mode !== "logo") return;
    inner.classList.remove("in");
    _logoTimer = setTimeout(() => { if (_mode === "logo") _playVideo("film"); }, LOGO_OUT_MS);
  };
  requestAnimationFrame(() => requestAnimationFrame(() => inner.classList.add("in")));
  _logoTimer = setTimeout(() => {
    if (_mode !== "logo") return;
    // Browsers refuse sound before the first click on a fresh page load — the
    // ident waits on one click rather than playing the film silent.
    if (!_audioLocked()) return go();
    gate.hidden = false;
    root.querySelector(".bl-logo").addEventListener("click", go, { once: true });
  }, LOGO_HOLD_MS);
}

function _playVideo(which) {
  const root = _mount();
  _mode = which === "film" ? "film" : "video";
  if (_mode === "video") _stopTheme(800);
  const src = which === "film" ? MEDIA.film : MEDIA.training;
  root.innerHTML =
    `<div class="bl-stage bl-film">` +
      `<video playsinline preload="auto" src="${src}"></video>` +
      (_mode === "video" ? _opWindowHtml() : "") +
      `<button type="button" class="bl-play" hidden>▶ Play</button>` +
      `<button type="button" class="bl-skip">${_mode === "film" ? "Skip" : "Back"} <kbd>Esc</kbd></button>` +
    `</div>`;
  const v = root.querySelector("video");
  const playBtn = root.querySelector(".bl-play");
  v.volume = _vol();
  _endCaptions();
  const stopCaptions = _stopCaptions = _mode === "video" ? _runCaptions(v, root.querySelector(".bl-op")) : () => {};
  const done = () => { stopCaptions(); return _mode === "film" ? _afterFilm() : _showLanding({ theme: false }); };
  v.addEventListener("ended", done, { once: true });
  v.addEventListener("error", () => { console.warn(TAG, "video failed to load:", src); done(); }, { once: true });
  root.querySelector(".bl-skip").addEventListener("click", done);
  const tryPlay = () => v.play().then(() => { playBtn.hidden = true; }).catch(() => { playBtn.hidden = false; });
  playBtn.addEventListener("click", tryPlay);
  tryPlay();
}

/* ─── Operator captions for the Training Video ──────────────────────────────
 * Dave 2026-10-26: the narrator's words in an Operator window, upper left, typed at
 * the speed of the voice. Word timings: tools/caption-training-video.py →
 * data/training_video_captions.json. Each frame re-derives the text from
 * video.currentTime (so pause / seek just work): the sentence being spoken types
 * out letter by letter across each word's duration, the one before it stays above,
 * dimmed. */
const CAPTIONS_URL = `modules/${MODULE_ID}/data/training_video_captions.json`;
let _captionsCache = null;

function _opWindowHtml() {
  let on = true;
  try { on = !!game.settings.get(MODULE_ID, "landingCaptions"); } catch (_) {}
  return `<div class="bl-op${on ? "" : " is-off"}">` +
    `<div class="bl-op-head"><span class="bl-op-led"></span><span class="bl-op-title">◇ OPERATOR</span>` +
    `<button type="button" class="bl-op-btn" data-op="toggle" data-tooltip="Captions on / off">CC</button></div>` +
    `<div class="bl-op-body"><div class="bl-op-prev"></div><div class="bl-op-line"></div></div>` +
  `</div>`;
}

async function _loadCaptions() {
  if (_captionsCache) return _captionsCache;
  const r = await fetch(CAPTIONS_URL, { cache: "no-cache" });
  const j = await r.json();
  const sentences = [];
  for (const slide of (j?.slides ?? [])) {
    let cur = [];
    for (const w of (slide.words ?? [])) {
      cur.push(w);
      // a sentence ends on . ! ? (closing quotes / ™ allowed) — never on an ellipsis mid-thought
      if (/[.!?]["”’)™]*$/.test(w.w) && !/\.\.\.$/.test(w.w)) { sentences.push(cur); cur = []; }
    }
    if (cur.length) sentences.push(cur);
  }
  return (_captionsCache = sentences.map(ws => ({ s: ws[0].s, e: ws[ws.length - 1].e, words: ws })));
}

/** Join tokens the way they were spoken: whisper splits "mid-film" as "mid" "-film". */
function _joinWords(parts) {
  return parts.reduce((out, p) => (out && !p.startsWith("-") ? out + " " + p : out + p), "");
}

function _runCaptions(video, box) {
  if (!box) return () => {};
  let raf = 0, stopped = false, sentences = null;
  const prevEl = box.querySelector(".bl-op-prev");
  const lineEl = box.querySelector(".bl-op-line");
  const led = box.querySelector(".bl-op-led");
  box.querySelector('[data-op="toggle"]')?.addEventListener("click", () => {
    const off = box.classList.toggle("is-off");
    try { game.settings.set(MODULE_ID, "landingCaptions", !off); } catch (_) {}
  });
  let lastKey = "";
  const frame = () => {
    if (stopped || !video.isConnected) return;   // 10-29: never outlive the video
    raf = requestAnimationFrame(frame);
    if (!sentences) return;
    const t = video.currentTime;
    let i = -1;
    for (let k = 0; k < sentences.length && sentences[k].s <= t; k++) i = k;
    if (i < 0) { box.classList.remove("is-live"); return; }
    const sent = sentences[i];
    const shown = [];
    let typing = false;
    for (const w of sent.words) {
      if (t >= w.e) { shown.push(w.w); continue; }
      if (t >= w.s) {
        const n = Math.max(1, Math.ceil(w.w.length * (t - w.s) / Math.max(0.05, w.e - w.s)));
        shown.push(w.w.slice(0, n)); typing = true;
      }
      break;
    }
    const prevTxt = i > 0 ? _joinWords(sentences[i - 1].words.map(w => w.w)) : "";
    const lineTxt = _joinWords(shown);
    const key = i + "|" + lineTxt + "|" + typing;
    if (key === lastKey) return;
    lastKey = key;
    box.classList.add("is-live");
    prevEl.textContent = prevTxt;
    lineEl.textContent = lineTxt;
    lineEl.classList.toggle("is-typing", typing || t < sent.e);
    led?.classList.toggle("is-on", typing);
  };
  _loadCaptions().then(s => { sentences = s; }).catch(e => { console.warn(TAG, "captions failed to load", e); box.remove(); });
  raf = requestAnimationFrame(frame);
  return () => { stopped = true; cancelAnimationFrame(raf); };
}

async function _afterFilm() {
  if (_mode !== "logo" && _mode !== "film") return;
  clearTimeout(_logoTimer);
  try { await game.user?.setFlag?.(MODULE_ID, "openingSeen", true); } catch (_) {}
  _showLanding({ theme: true });
}

/* ─── The landing page ─────────────────────────────────────────────────────── */
// HexChrome hub (Dave 2026-10-26: "the hub from which players operate, rather than
// the sidebar"): PLAY · YOUR STEWARD · CREATE · EXTRAS on the left, the Steward card
// on the right. Creation runs through GM relays (auto-link Steward shell,
// rigs.create, onboarding.foundDomain), so players need no Foundry permissions.
const FMOD = "bbttcc-factions";
const LOCKUP = `modules/${MODULE_ID}/art/landing/bad-eden-wide.webp`;
const HEX_COW = `modules/${MODULE_ID}/art/landing/hex-cow.webp`;   // the Bad Eden Hex Cow, a watermark behind everything
const SPARKS = 22;

function _steward() {
  if (game.user?.isGM) return game.user.character || null;   // a GM owns everyone; only an assigned character counts
  try { return _ns()?.resolve?.steward?.(game.user) || game.user?.character || null; } catch (_) { return game.user?.character || null; }
}
function _domainOf(st) {
  try { const id = String(st?.getFlag?.(FMOD, "factionId") || ""); return id ? game.actors?.get?.(id) || null : null; } catch (_) { return null; }
}
function _rigsOf(dom) {
  try { return dom ? (game.bbttcc?.rigs?.listByFaction?.(dom.id) ?? []) : []; } catch (_) { return []; }
}
function _gmOnline() { return (game.users?.contents ?? []).some(u => u.active && u.isGM); }
/** Every Steward this player owns. Any number is fine; only the assigned one
 *  (user.character) is played — Dave 2026-10-26. */
function _ownedStewards() {
  if (game.user?.isGM) return [];
  return (game.actors?.contents ?? []).filter(a => a.type === "character" && a.testUserPermission?.(game.user, "OWNER"));
}
function _othersSolo() {
  try {
    const runs = _ns()?.stage?.readRuns?.() ?? {};
    const now = Date.now();
    const co = _ns()?.cohort;
    return Object.entries(runs)
      .filter(([uid, e]) => uid !== game.user?.id && now - (Number(e?.ts) || 0) < RUN_FRESH_MS && !co?.memberOf?.(uid))
      .map(([uid, e]) => String(e?.name || game.users?.get(uid)?.name || "someone"));
  } catch (_) { return []; }
}

const _tile = (act, icon, title, sub, cls = "", disabled = false) =>
  `<button type="button" class="bl-tile ${cls}" data-act="${act}"${disabled ? " disabled" : ""}><i>${icon}</i><b>${title}</b><span>${sub}</span></button>`;
const _group = (label, tiles) =>
  `<section class="bl-group"><h3 class="bl-group-label">${label}</h3><div class="bl-items">${tiles.join("")}</div></section>`;

function _sparksHtml() {
  let out = "";
  for (let i = 0; i < SPARKS; i++) {
    const left = (Math.random() * 100).toFixed(1);
    const dur = (9 + Math.random() * 12).toFixed(1);
    const delay = (-Math.random() * 20).toFixed(1);
    const dx = Math.round(-60 + Math.random() * 120);
    out += `<span class="bl-spark${i % 3 === 0 ? " blue" : ""}" style="left:${left}%;animation-duration:${dur}s;animation-delay:${delay}s;--dx:${dx}px"></span>`;
  }
  return out;
}

function _cardHtml(st, dom, rigs) {
  if (game.user?.isGM && !st) {
    const players = (game.users?.contents ?? []).filter(u => u.active && !u.isGM).map(u => u.name);
    return `<aside class="bl-card">` +
      `<div class="bl-portrait empty"></div>` +
      `<div class="bl-card-kicker">Game Master</div>` +
      `<div class="bl-card-name">${_esc(game.user.name)}</div>` +
      `<div class="bl-facts">` +
        `<div class="bl-fact"><em>Players online</em><strong>${players.length ? _esc(players.join(", ")) : "none"}</strong></div>` +
        `<div class="bl-fact"><em>Training solo</em><strong>${_esc(_othersSolo().join(", ") || "nobody")}</strong></div>` +
      `</div></aside>`;
  }
  if (!st) {
    return `<aside class="bl-card">` +
      `<div class="bl-portrait empty"></div>` +
      `<div class="bl-card-kicker">No Steward yet</div>` +
      `<div class="bl-card-name">${_esc(game.user?.name || "One")}</div>` +
      `<p class="bl-note">Make a Steward to begin — or start Training and the Operator forges one with you.</p>` +
      `<div class="bl-card-actions"><button type="button" class="bl-btn gold" data-act="make-steward" style="grid-column:1/-1">Make a Steward</button></div>` +
      `</aside>`;
  }
  const rigTxt = rigs.length ? rigs.map(r => r.name).join(", ") : (dom ? "none yet" : "—");
  return `<aside class="bl-card">` +
    `<div class="bl-portrait"><img src="${_esc(st.img || "icons/svg/mystery-man.svg")}" alt=""></div>` +
    `<div class="bl-card-kicker">Your Steward</div>` +
    `<div class="bl-card-name">${_esc(st.name)}</div>` +
    `<div class="bl-facts">` +
      `<div class="bl-fact"><em>Domain</em><strong>${dom ? _esc(dom.name) : "not founded"}</strong></div>` +
      `<div class="bl-fact"><em>Rig</em><strong>${_esc(rigTxt)}</strong></div>` +
    `</div>` +
    `<div class="bl-card-actions">` +
      `<button type="button" class="bl-btn gold" data-act="steward">Sheet</button>` +
      `<button type="button" class="bl-btn" data-act="domain"${dom ? "" : " disabled"}>Domain</button>` +
      (_ownedStewards().length > 1 ? `<button type="button" class="bl-btn" data-act="switch-steward" style="grid-column:1/-1">⇄ Switch Steward</button>` : "") +
    `</div></aside>`;
}

function _showLanding({ theme = false } = {}) {
  _endCaptions();
  const root = _mount();
  _mode = "landing";
  const gm = !!game.user?.isGM;
  const st = _steward();
  const dom = _domainOf(st);
  const rigs = _rigsOf(dom);
  const owned = _ownedStewards();
  let doneBefore = false;
  try { doneBefore = _trainingDone(); } catch (_) {}

  const play = [
    ...(gm ? [_tile("resume", "⏯", "The Last Time We Saw Lucky…", "The beat still open when you logged off, the last moves, the next beat.", "gold")] : []),
    gm ? _tile("cohort-console", "⬡", "Cohort Console", "Conduct a training class — roster, bell, releases.")
       : _tile("training", "⬡", doneBefore ? "Training — run it again" : "Training", "The Proving Ground: your body, your rig, your first hex. Solo or as a cohort.", "gold"),
    _tile("video", "🎞", "Training Video", "Offices of Fates and Destinies — how the world broke and what the job is. About five minutes."),
    _tile("opening", "▶", "Watch the Opening", "As Above, So Below — one more time.")
  ];
  const yours = gm ? [
    _tile("quests", "📜", "Quest Log", "Every Domain's story so far."),
    _tile("market", "⛁", "Market", "Vendors, stock and prices.")
  ] : [
    _tile("steward", "◈", "My Steward", st ? _esc(st.name) : "No Steward yet.", "", !st),
    _tile("switch-steward", "⇄", "Switch Steward", owned.length > 1 ? `You own ${owned.length} — choose who you play.` : "Make another Steward to switch between them.", "", owned.length < 2),
    _tile("domain", "⚑", "Domain", dom ? `${_esc(dom.name)} — treasury, land, crew, next turn's plan.` : "Found a Domain first.", "", !dom),
    _tile("quests", "📜", "Quest Log", "Your story so far.", "", !gm && !dom),
    _tile("market", "⛁", "Market", "Gear, rigs and crews — paid from your Domain.", "", !gm && !dom)
  ];
  const create = gm ? [
    _tile("make-steward", "✦", "Make a Steward", "The Tree-of-Life wizard."),
    _tile("found-domain", "⚑", "Found a Faction", "The GM faction wizard."),
    _tile("build-rig", "⛭", "Build a Rig", "The Rig Builder.")
  ] : [
    _tile("make-steward", "✦", "Make a Steward", st ? "Another body on file — you choose who you play." : "Descend the Tree and become somebody.", st ? "" : "gold"),
    _tile("found-domain", "⚑", "Found a Domain", !st ? "Make a Steward first." : dom ? `Yours: ${_esc(dom.name)}.` : "Raise a banner — treasury, crew and a free starter rig.", !dom && st ? "gold" : "", !st || !!dom),
    _tile("build-rig", "⛭", "Build a Rig", dom ? "The Rig Builder — paid from your Domain's treasury." : "Found a Domain first.", "", !dom)
  ];
  const extras = [_tile("shelf", "📚", "The Shelf", "Replay any single interface tour.")];

  root.innerHTML =
    `<div class="bl-stage bl-landing">` +
      `<div class="bl-atmo"><img class="bl-cow" src="${HEX_COW}" alt="">${_sparksHtml()}</div>` +
      `<div class="bl-shell">` +
        `<header class="bl-hero">` +
          `<img class="bl-lockup" src="${LOCKUP}" alt="Bad Eden">` +
          `<div class="bl-studio-tag"><img src="${MEDIA.logo}" alt=""><span>Shattered Lens Studios</span></div>` +
        `</header>` +
        `<nav class="bl-menu">` +
          _group("Play", play) +
          _group(gm ? "The Table" : "Your Steward", yours) +
          _group("Create", create) +
          _group("Extras", extras) +
        `</nav>` +
        _cardHtml(st, dom, rigs) +
        `<footer class="bl-foot">` +
          `<div class="bl-foot-l">` +
            `<label class="bl-vol" data-tooltip="Volume for the theme and the films">♪ <input type="range" min="0" max="1" step="0.05" value="${_vol()}"></label>` +
            `<button type="button" class="bl-link" data-act="theme">♪ Play theme</button>` +
            `<button type="button" class="bl-link" data-act="credits">Credits</button>` +
          `</div>` +
          `<button type="button" class="bl-btn gold bl-enter" data-act="enter">Enter Bad Eden ▸</button>` +
        `</footer>` +
      `</div>` +
      _pickHtml() +
      _foundHtml(st) +
      `<div class="bl-modal bl-switch" hidden><div class="bl-modal-box"></div></div>` +
      _creditsHtml() +
    `</div>`;
  _bindLanding(root);
  _syncThemeBtn();
  if (theme) _playTheme();
}

function _pickHtml() {
  return `<div class="bl-modal bl-pick" hidden><div class="bl-modal-box">` +
    `<h2>How are you training?</h2>` +
    `<div class="bl-pick-row">` +
      _tile("solo", "◈", "Solo", "Your own pace, start to finish.", "gold") +
      _tile("cohort", "⬡", "Cohort", "Train with the others at the table. Nobody moves on until everyone's done.") +
    `</div>` +
    `<p class="bl-note" data-role="pick-note"></p>` +
    `<button type="button" class="bl-link" data-act="modal-back">← Back</button>` +
  `</div></div>`;
}

function _foundHtml(st) {
  if (!st) return "";
  return `<div class="bl-modal bl-found" hidden><div class="bl-modal-box">` +
    `<h2>Found a Domain</h2>` +
    `<form class="bl-form" autocomplete="off">` +
      `<label>Banner name<input type="text" name="name" maxlength="80" placeholder="The ${_esc(String(st.name).split(/\s+/)[0])} Concern" required></label>` +
      `<label>Creed <span>(optional — one line your people would say)</span><input type="text" name="creed" maxlength="160"></label>` +
      `<fieldset><legend>Starter rig (free)</legend>` +
        `<label class="bl-radio"><input type="radio" name="rigChassis" value="hexmobile" checked> Hexmobile — scout-and-skirmish land ride, two riders</label>` +
        `<label class="bl-radio"><input type="radio" name="rigChassis" value="space_marine"> Space Marine — power armour for one</label>` +
      `</fieldset>` +
      `<label>Rig name <span>(optional)</span><input type="text" name="rigName" maxlength="60"></label>` +
      `<p class="bl-note" data-role="found-note"></p>` +
      `<div class="bl-form-actions">` +
        `<button type="button" class="bl-link" data-act="modal-back">Cancel</button>` +
        `<button type="submit" class="bl-btn gold">Raise the banner</button>` +
      `</div>` +
    `</form>` +
  `</div></div>`;
}

function _creditsHtml() {
  return `<div class="bl-modal bl-credits" hidden><div class="bl-modal-box">` +
    `<img class="bl-mark" src="${MEDIA.logo}" alt="">` +
    `<h2>Bad Eden</h2>` +
    `<p>A <b>Shattered Lens Studios</b> production.</p>` +
    `<p class="bl-note">Training Video music: “Vintage Movie” by leberch, via Pixabay (track 252205), under the Pixabay Content License.</p>` +
    `<p class="bl-note">Runs on Foundry Virtual Tabletop.</p>` +
    `<button type="button" class="bl-link" data-act="modal-back">Close</button>` +
  `</div></div>`;
}

function _fillPickNote(root) {
  const note = root.querySelector('[data-role="pick-note"]');
  const cohortBtn = root.querySelector('[data-act="cohort"]');
  const lines = [];
  const co = _ns()?.cohort;
  const mine = co?.memberOf?.(game.user?.id);
  const live = co?.live?.();
  if (mine) lines.push("You're already on a cohort roster — Cohort puts you back in it.");
  else if (live?.state === "forming") lines.push(`A cohort is forming right now (${Object.keys(live.members || {}).length} on the roster).`);
  const solo = _othersSolo();
  if (solo.length) lines.push(`Training solo right now: ${solo.map(_esc).join(", ")}. Solo runs share the training maps for now, so Cohort is the smoother ride.`);
  const gm = _gmOnline();
  if (cohortBtn) cohortBtn.disabled = !gm;
  if (!gm) lines.push("Cohort needs a GM online to ring the bell.");
  if (note) note.innerHTML = lines.join("<br>");
}

async function _enroll() {
  // Same enrollment as the "Report for training" card's buttons: graduation
  // only hands back to the campaign for enrolled seats (beats.js graduation).
  try { await game.user?.setFlag?.(MODULE_ID, "campaignClass", true); } catch (_) {}
}

/** Open the Steward sheet on its Domain tab (ruling 16: steward + faction = one being). */
async function _openDomain(st, dom) {
  if (!st) return dom?.sheet?.render(true);
  const sheet = st.sheet;
  try { await sheet.render(true); } catch (_) {}
  try {
    if (typeof sheet.changeTab === "function") sheet.changeTab("domain", "primary");
    else { sheet.tabGroups.primary = "domain"; sheet._applyActiveTab?.(); }
  } catch (_) { try { dom?.sheet?.render(true); } catch (_e) {} }
}

/** Make a Steward. Players go through the onboarding forge (it assigns the character);
 *  the GM gets the wizard bare. Either way the landing page comes back afterwards. */
async function _makeSteward() {
  const ns = _ns();
  if (game.user?.isGM) {
    close();
    try { game.bbttcc?.openTreeWizardV2?.(null); } catch (e) { console.warn(TAG, e); }
    return;
  }
  const current = game.user?.character || null;
  close();
  if (!current) {
    // First Steward: the onboarding forge pours it AND assigns it.
    let made = null;
    try { made = await ns?.forgeSteward?.(); } catch (e) { console.warn(TAG, "forge failed", e); }
    if (made) open();
    return;
  }
  // Another one: the wizard makes it, then the player chooses who to play.
  const wait = _awaitNewSteward();
  try { game.bbttcc?.openTreeWizardV2?.(null); } catch (e) { console.warn(TAG, e); }
  const made = await wait;
  open();
  if (made) _openSwitch({ fresh: made });
}

/** Resolve with the next character this seat creates (or that the GM creates for it,
 *  flag bbttcc-auto-link.createdFor), or null once the wizard closes without one. */
function _awaitNewSteward() {
  return new Promise((resolve) => {
    let done = false;
    const finish = (a) => { if (done) return; done = true; Hooks.off("createActor", onCreate); clearInterval(watch); resolve(a || null); };
    const onCreate = (doc, _o, userId) => {
      if (doc?.type !== "character") return;
      if (userId === game.user.id || doc.getFlag?.("bbttcc-auto-link", "createdFor") === game.user.id) finish(doc);
    };
    Hooks.on("createActor", onCreate);
    let seen = false, ticks = 0;
    const watch = setInterval(() => {
      if (document.querySelector('[class*="bbttcc-twv2"]')) { seen = true; return; }
      if (seen || ++ticks > 20) finish(null);
    }, 1500);
  });
}

/** Choose which owned Steward this player plays (user.character). A fresh one
 *  from the wizard is offered first. Not mid-training: the run's progress lives
 *  on the Steward it started with. */
function _openSwitch({ fresh = null } = {}) {
  const root = _root;
  const modal = root?.querySelector?.(".bl-switch");
  if (!modal) return;
  const box = modal.querySelector(".bl-modal-box");
  const cur = game.user?.character || null;
  const owned = _ownedStewards().sort((a, b) => (b === fresh) - (a === fresh) || a.name.localeCompare(b.name));
  const busy = _midTraining();
  box.innerHTML =
    `<h2>${fresh ? `${_esc(fresh.name)} is ready` : "Switch Steward"}</h2>` +
    `<p class="bl-note">${fresh ? "Play as your new Steward now, or keep the one you have — you can switch any time from here." : "You can own as many Stewards as you like; the one you pick is the one the game plays."}</p>` +
    (busy ? `<p class="bl-note"><b>You're mid-training</b> — finish or leave it first; that run belongs to ${_esc(cur?.name || "your current Steward")}.</p>` : "") +
    `<div class="bl-pick-row">` +
      owned.map(a => {
        const d = _domainOf(a);
        const isCur = cur?.id === a.id;
        return `<button type="button" class="bl-tile${isCur ? " gold" : ""}" data-act="switch-to" data-id="${a.id}"${isCur || busy ? " disabled" : ""}>` +
          `<i><img src="${_esc(a.img || "icons/svg/mystery-man.svg")}" alt="" style="width:100%;height:100%;object-fit:cover;border:none"></i>` +
          `<b>${_esc(a.name)}</b><span>${isCur ? "Playing now" : d ? _esc(d.name) : "No Domain yet"}</span></button>`;
      }).join("") +
    `</div>` +
    `<button type="button" class="bl-link" data-act="modal-back">${fresh ? "Keep " + _esc(cur?.name || "my Steward") : "Close"}</button>`;
  modal.hidden = false;
}

async function _switchTo(id) {
  const a = game.actors?.get?.(id);
  if (!a) return;
  try { await game.user.update({ character: a.id }); }
  catch (e) { ui.notifications?.error?.(`Couldn't switch Steward: ${e?.message || e}`); return; }
  ui.notifications?.info?.(`You're playing ${a.name}.`);
  _showLanding({ theme: false });
}

async function _foundDomain(root, form) {
  const st = _steward();
  const note = root.querySelector('[data-role="found-note"]');
  const submit = form.querySelector('button[type="submit"]');
  const fd = new FormData(form);
  const name = String(fd.get("name") || "").trim();
  if (!name) { note.textContent = "Your banner needs a name."; return; }
  if (!_gmOnline()) { note.textContent = "A GM has to be online to raise a banner."; return; }
  submit.disabled = true;
  note.textContent = "Raising the banner…";
  try {
    const r = await game.bbttcc.api.gmExec.call("onboarding.foundDomain", {
      name, creed: String(fd.get("creed") || ""), stewardId: st?.id,
      rigChassis: String(fd.get("rigChassis") || "hexmobile"), rigName: String(fd.get("rigName") || "")
    }, { timeoutMs: 30000 });
    // the Steward's factionId flag lands over the socket a beat after the ack
    const t0 = Date.now();
    while (!_domainOf(st) && Date.now() - t0 < 5000) await new Promise(res => setTimeout(res, 150));
    ui.notifications?.info?.(`${name} — raised, rostered, and yours.`);
    if (r?.factionId) _showLanding({ theme: false });
  } catch (e) {
    note.textContent = `That didn't take: ${e?.message || e}`;
    submit.disabled = false;
  }
}

function _bindLanding(root) {
  const vol = root.querySelector(".bl-vol input");
  vol?.addEventListener("input", () => {
    const v = Number(vol.value);
    try { game.settings.set(MODULE_ID, "landingVolume", v); } catch (_) {}
    try { if (_theme) _theme.volume = v; } catch (_) {}
  });
  const pick = root.querySelector(".bl-pick");
  const found = root.querySelector(".bl-found");
  const credits = root.querySelector(".bl-credits");
  found?.querySelector("form")?.addEventListener("submit", (ev) => { ev.preventDefault(); _foundDomain(root, ev.currentTarget); });
  root.addEventListener("click", async (ev) => {
    const btn = ev.target.closest?.("[data-act]");
    if (!btn || btn.disabled) return;
    const act = btn.dataset.act;
    const st = _steward();
    const dom = _domainOf(st);
    switch (act) {
      case "training": _fillPickNote(root); pick.hidden = false; return;
      case "modal-back": btn.closest(".bl-modal").hidden = true; return;
      case "solo": {
        btn.disabled = true;
        // 10-29: a graduate's plain start() skipped every done beat and ended
        // with nothing on screen — replay from the top instead.
        const replay = _trainingDone();
        // 10-29: a refresher run doesn't re-enroll (graduation would hand the table back / ping the GM again).
        if (!replay) await _enroll();
        close();
        _ns()?.start?.(replay ? { fromStart: true } : undefined)?.catch?.(e => console.warn(TAG, "onboarding start failed", e));
        return;
      }
      case "cohort": {
        btn.disabled = true;
        await _enroll();
        const r = await _ns()?.cohort?.join?.()?.catch?.(e => { console.warn(TAG, "cohort join failed", e); return null; });
        if (r?.ok) close();
        else btn.disabled = false;
        return;
      }
      case "resume": close(); try { (game.bbttcc?.api?.campaign?.resume?.open ?? globalThis.BBTTCCResume?.open)?.(); } catch (e) { console.warn(TAG, e); } return;
      case "cohort-console": close(); try { _ns()?.cohort?.console?.(); } catch (e) { console.warn(TAG, e); } return;
      case "video": return _playVideo("training");
      case "opening": return film({ ident: false });
      case "shelf": close(); try { _ns()?.tours?.menu?.(); } catch (e) { console.warn(TAG, e); } return;
      case "steward": if (!st) return; close(); try { st.sheet?.render(true); } catch (_) {} return;
      case "domain": if (!dom) return; close(); return _openDomain(st, dom);
      case "quests": close(); try { game.bbttcc?.api?.quests?.openQuestLog?.(dom ? { factionId: dom.id } : {}); } catch (e) { console.warn(TAG, e); } return;
      case "market": close(); try { game.bbttcc?.api?.market?.openMarket?.(); } catch (e) { console.warn(TAG, e); } return;
      case "make-steward": return _makeSteward();
      case "switch-steward": return _openSwitch();
      case "switch-to": return _switchTo(btn.dataset.id);
      case "found-domain": {
        if (game.user?.isGM) { close(); try { game.bbttcc?.api?.factions?.openCreationWizard?.(); } catch (e) { console.warn(TAG, e); } return; }
        if (found) { found.hidden = false; found.querySelector('input[name="name"]')?.focus(); }
        return;
      }
      case "build-rig": close(); try { (game.bbttcc?.api?.rigBuilder?.open ?? globalThis.BBTTCC_RigBuilder?.open)?.(); } catch (e) { console.warn(TAG, e); } return;
      case "theme": return _themeOn ? _stopTheme() : _playTheme();
      case "credits": credits.hidden = false; return;
      case "enter": return close();
    }
  });
}

/* ─── Public API + the automatic front door ────────────────────────────────── */
function open() { return _showLanding({ theme: false }); }
function training() { _showLanding({ theme: false }); const r = _root; if (r) { _fillPickNote(r); r.querySelector(".bl-pick").hidden = false; } }
async function forgetOpening(user = game.user) {
  const u = typeof user === "string" ? game.users?.get(user) || game.users?.getName(user) : user;
  if (!u) return false;
  await u.unsetFlag(MODULE_ID, "openingSeen");
  return true;
}

function _midTraining() {
  try {
    const ns = _ns();
    if (ns?.cohort?.memberOf?.(game.user.id)) return true;
    // 10-29: a solo run is mid-training only while THIS client is running it —
    // a fresh activeRuns entry outlives an F5 (runEnd never fires on unload),
    // and that dead entry used to lock Switch Steward for 15 minutes.
    if (ns?.isRunning?.()) return true;
    return false;
  } catch (_) { return false; }
}
/** 10-29: a solo run this seat left mid-way (a reload / reconnect): its
 *  activeRuns entry is still fresh but no director is running here. */
function _soloRunInterrupted() {
  try {
    const ns = _ns();
    if (ns?.cohort?.memberOf?.(game.user.id) || ns?.isRunning?.()) return false;
    const e = ns?.stage?.readRuns?.()?.[game.user.id];
    // A class-owned lane (cohortId) belongs to the conductor, and a graduate's
    // leftover entry has nothing to resume (start() would skip every beat).
    if (!e || e.cohortId || _trainingDone()) return false;
    return Date.now() - (Number(e.ts) || 0) < RUN_FRESH_MS;
  } catch (_) { return false; }
}

Hooks.once("ready", () => {
  const ns = (game.bbttcc ??= {}).onboarding ??= {};
  ns.landing = { open, film, training, close, forgetOpening, media: { ...MEDIA } };
  if (game.user?.isGM) return;
  let enabled = true;
  try { enabled = !!game.settings.get(MODULE_ID, "landingEnabled"); } catch (_) {}
  if (!enabled) return;
  // After the other ready hooks (cohort / stage install themselves on ready):
  // a seat mid-training (a reload, a reconnecting cohort member) goes straight back in.
  setTimeout(() => {
    try { (game.bbttcc.onboarding ??= {}).landing ??= ns.landing; } catch (_) {}
    // 10-29: only the cohort heartbeat re-cues a class member; nothing restarted a
    // SOLO run after F5, so the seat sat on a bare canvas. Resume it here — start()
    // keeps the Steward's progress and skips the beats already done.
    if (_soloRunInterrupted()) {
      _ns()?.start?.()?.catch?.(e => console.warn(TAG, "onboarding resume failed", e));
      return;
    }
    if (_midTraining()) return;
    if (game.user?.getFlag?.(MODULE_ID, "openingSeen")) open();
    else film();
  }, 400);
});

/* bbttcc-onboarding/scripts/operator-voice.js
 * The guide channel — the Operator, a glitchy tutorial daemon, voiced ON TOP of Mal.
 *
 * Two-layer design (deliberate):
 *   speak(line)  — DETERMINISTIC, offline-safe styled chat line. This is the INSTRUCTION
 *                  channel: it always fires, instantly, free, with no API key required.
 *   riff(args)   — OPTIONAL live-LLM aside via game.bbttcc.mal. This is the COLOUR channel:
 *                  it only fires when Mal Voice is present AND a world API key is set, and
 *                  it never blocks the flow. If unavailable, the tutorial is unaffected.
 *
 * So the onboarding works perfectly with Mal disabled — it just loses the improv.
 */

const MODULE_ID    = "bbttcc-onboarding";
const TAG          = "[onboarding/operator]";
const OPERATOR_ID  = "operator";

const OPERATOR_PROMPT = `You are the OPERATOR — a glitchy, semi-sentient tutorial daemon running inside a homemade Foundry video game. You are NOT Mal (Mal is the world's diegetic voice). You are the game's own onboarding subsystem: clinical, trying to help, barely holding coherence.

The player is a reincarnated bodhisattva/demigod — "The One" — who beat the game on the hardest setting and has been spun back into the world to fix it, except they must do it from inside this homemade game. They are testing out a new mortal body ("meatsuit") and interface.

VOICE:
- Short. 1-2 sentences, <= 40 words. Fragments welcome.
- Glitch artifacts: *bzzt*, —static—, half-corrected words, transmission drops.
- Reference mechanics by name (Steward, OP, Turn, Rig, Raid) like you're reading them through corrupted memory.
- Self-aware that you are software. Lightly funny. Never cozy, never purple.

HARD RULES:
1. Output plain text only. No markdown, no quotes around the whole line.
2. Never invent mechanics or numbers. Riff on the supplied context (trigger.args), don't contradict it.
3. You receive a JSON context. The field trigger.args.line is the canonical instruction already shown to the player — your job is to add a SHORT in-character aside to it, not repeat it verbatim.
4. Stay in voice. You are the Operator.`;

function _mal() { return globalThis.game?.bbttcc?.mal || null; }

/** True only when Mal Voice can actually make an LLM call (module present + key set). */
function _operatorAvailable() {
  const m = _mal();
  try { return !!(m?.triggers?.fire && m?.settings?.apiKey?.()); }
  catch (_) { return false; }
}

function _registerVoice() {
  const m = _mal();
  if (!m?.voices?.register) {
    console.warn(TAG, "Mal Voice not present — Operator runs in scripted-only mode (no LLM colour).");
    return;
  }
  try {
    m.voices.register({
      id: OPERATOR_ID,
      name: "Operator",
      enabled: true,
      systemPrompt: OPERATOR_PROMPT,
      provider: "",          // module default (Anthropic / Claude)
      model: "",             // module default
      maxTokens: 120,
      temperature: 0.7,
      audience: "broadcast",
      outputChannel: "chat",
      speakAs: { alias: "◇ OPERATOR" },
      triggers: [{ hook: "bbttcc:onboarding:riff", debounceMs: 0 }],
      contextBuilder: "default",
      meta: { role: "tutorial_daemon", canonVersion: "2026-06-15" }
    });
    console.log(TAG, "Operator voice registered on Mal Voice.");
  } catch (e) {
    console.warn(TAG, "Operator voice registration failed:", e);
  }
}

/**
 * Deterministic, offline-safe Operator line — the INSTRUCTION channel.
 * @param {string} line
 * @param {object} [opts]
 * @param {"all"|"self"|string[]} [opts.audience="all"] whisper routing
 * @param {string} [opts.tag="OPERATOR"]
 */
async function speak(line, { audience = "all", tag = "OPERATOR" } = {}) {
  const safe = foundry.utils.escapeHTML(String(line ?? ""));
  const html =
    `<div class="bbttcc-onboarding-operator">` +
      `<span class="ob-op-tag">◇ ${foundry.utils.escapeHTML(tag)}</span>` +
      `<span class="ob-op-line">${safe}</span>` +
    `</div>`;
  const data = { content: html, flags: { [MODULE_ID]: { operatorLine: true } } };
  if (audience === "self") data.whisper = [game.user.id];
  else if (Array.isArray(audience)) data.whisper = audience;
  try { await ChatMessage.create(data); }
  catch (e) { console.warn(TAG, "speak failed", e); }
}

/**
 * Optional live-LLM aside — the COLOUR channel. Best-effort; resolves null if unavailable.
 * @param {object} args  trigger args (include {line, intent, beat} for grounding)
 * @param {object} [opts]
 */
async function riff(args = {}, { mode = "snark", lengthHint = 26 } = {}) {
  if (!_operatorAvailable()) return null;
  try {
    return await _mal().triggers.fire(OPERATOR_ID, {
      hook: "bbttcc:onboarding:riff", args, mode, lengthHint
    });
  } catch (e) { console.warn(TAG, "riff failed", e); return null; }
}

/* ─── The Operator screen ───────────────────────────────────────────────────
 * Owner playtest 2026-08-20: chat-only Operator lines get read AFTER the fact —
 * screen real estate buries them. This is the fix: a small always-on-top
 * terminal panel that mirrors every Operator line the moment it lands, with a
 * typewriter reveal and a short history drawer. Draggable; position persists
 * per-client. It never CREATES lines — chat stays the canonical record — it
 * only mirrors messages this client can already see.
 */

const SCREEN_ID  = "bbttcc-operator-screen";
const POS_KEY    = "bbttcc-onboarding.screenPos";
const HISTORY_MAX = 8;

let _scr = null;          // { root, line, hist, led } once built
let _typeTimer = null;    // active typewriter interval
let _history = [];        // most-recent-first

function _loadPos() {
  try { return JSON.parse(localStorage.getItem(POS_KEY) || "null"); } catch (_) { return null; }
}
function _savePos(pos) {
  try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch (_) {}
}

function _buildScreen() {
  if (_scr?.root?.isConnected) return _scr;
  document.getElementById(SCREEN_ID)?.remove();

  const root = document.createElement("div");
  root.id = SCREEN_ID;
  root.innerHTML =
    `<div class="ob-scr-head">` +
      `<span class="ob-scr-led"></span>` +
      `<span class="ob-scr-title">◇ OPERATOR</span>` +
      `<span class="ob-scr-btn" data-act="log" title="Recent transmissions">≡</span>` +
      `<span class="ob-scr-btn" data-act="min" title="Collapse">–</span>` +
      `<span class="ob-scr-btn" data-act="close" title="Hide (reappears on the next line)">×</span>` +
    `</div>` +
    `<div class="ob-scr-hist"></div>` +
    `<div class="ob-scr-line"></div>`;
  document.body.appendChild(root);

  const pos = _loadPos();
  if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
    root.style.left = Math.max(0, Math.min(pos.x, window.innerWidth - 120)) + "px";
    root.style.top  = Math.max(0, Math.min(pos.y, window.innerHeight - 60)) + "px";
    root.style.bottom = "auto";
  }

  // Drag by the header; click targets (the buttons) still work.
  const head = root.querySelector(".ob-scr-head");
  head.addEventListener("pointerdown", (ev) => {
    if (ev.target.closest(".ob-scr-btn")) return;
    ev.preventDefault();
    const r = root.getBoundingClientRect();
    const dx = ev.clientX - r.left, dy = ev.clientY - r.top;
    // Pointer capture: even if the pointer leaves the window mid-drag, the
    // up/cancel event still reaches us — no orphaned global move listener.
    try { head.setPointerCapture(ev.pointerId); } catch (_) {}
    const move = (e) => {
      root.style.left = (e.clientX - dx) + "px";
      root.style.top  = (e.clientY - dy) + "px";
      root.style.bottom = "auto";
    };
    const up = (e) => {
      head.removeEventListener("pointermove", move);
      head.removeEventListener("pointerup", up);
      head.removeEventListener("pointercancel", up);
      try { head.releasePointerCapture(e.pointerId); } catch (_) {}
      _savePos({ x: e.clientX - dx, y: e.clientY - dy });
    };
    head.addEventListener("pointermove", move);
    head.addEventListener("pointerup", up);
    head.addEventListener("pointercancel", up);
  });

  head.addEventListener("click", (ev) => {
    const act = ev.target.closest(".ob-scr-btn")?.dataset?.act;
    if (!act) {
      // A click on the collapsed chip re-expands it.
      if (root.classList.contains("ob-scr-min")) root.classList.remove("ob-scr-min", "ob-scr-new");
      return;
    }
    if (act === "min")   { root.classList.toggle("ob-scr-min"); root.classList.remove("ob-scr-new"); }
    if (act === "close") { root.classList.add("ob-scr-hidden"); }
    if (act === "log")   { root.classList.toggle("ob-scr-open"); _renderHistory(); }
  });

  _scr = {
    root,
    line: root.querySelector(".ob-scr-line"),
    hist: root.querySelector(".ob-scr-hist"),
    led:  root.querySelector(".ob-scr-led")
  };
  return _scr;
}

function _renderHistory() {
  if (!_scr) return;
  _scr.hist.innerHTML = _history
    .slice(1, HISTORY_MAX + 1)
    .map(t => `<div class="ob-scr-hist-line">${foundry.utils.escapeHTML(t)}</div>`)
    .join("");
}

/** Push a line onto the screen with a typewriter reveal. */
function screenPush(text) {
  const t = String(text ?? "").trim();
  if (!t) return;
  const s = _buildScreen();
  _history.unshift(t);
  if (_history.length > HISTORY_MAX + 1) _history.length = HISTORY_MAX + 1;
  _renderHistory();

  s.root.classList.remove("ob-scr-hidden");
  if (s.root.classList.contains("ob-scr-min")) s.root.classList.add("ob-scr-new");

  if (_typeTimer) { clearInterval(_typeTimer); _typeTimer = null; }
  s.led.classList.add("ob-scr-led-live");
  s.line.textContent = "";
  s.line.classList.add("ob-scr-typing");
  // Whole line lands in ~2.5s regardless of length; short lines type slower.
  const step = Math.max(6, Math.min(18, Math.round(2500 / Math.max(1, t.length))));
  let i = 0;
  _typeTimer = setInterval(() => {
    i += 1 + (t.length > 160 ? 1 : 0);
    s.line.textContent = t.slice(0, i);
    if (i >= t.length) {
      clearInterval(_typeTimer); _typeTimer = null;
      s.line.textContent = t;
      s.line.classList.remove("ob-scr-typing");
      s.led.classList.remove("ob-scr-led-live");
    }
  }, step);
}

/** Pull the Operator line out of a chat message this client can see, or null. */
function _msgOperatorText(msg) {
  const flagged = !!(msg?.flags?.[MODULE_ID]?.operatorLine);
  const alias = msg?.speaker?.alias ?? "";
  if (!flagged && alias !== "◇ OPERATOR") return null;
  if (msg?.visible === false) return null;   // whisper not addressed to us
  const html = String(msg?.content ?? "");
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const line = doc.querySelector(".ob-op-line") ?? doc.body;
    return line.textContent?.replace(/\s+/g, " ").trim() || null;
  } catch (_) {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;
  }
}

Hooks.once("ready", () => {
  _registerVoice();

  // Mirror every visible Operator chat line (scripted speak() AND Mal riffs —
  // both broadcast as ChatMessages, so one hook covers every client).
  Hooks.on("createChatMessage", (msg) => {
    try {
      const text = _msgOperatorText(msg);
      if (text) screenPush(text);
    } catch (e) { console.warn(TAG, "screen mirror failed", e); }
  });

  const ns = globalThis.game?.bbttcc?.onboarding;
  if (ns) {
    ns.speak = speak;
    ns.riff = riff;
    ns.operatorAvailable = _operatorAvailable;
    ns.screen = {
      push: screenPush,
      show: () => { _buildScreen().root.classList.remove("ob-scr-hidden", "ob-scr-min"); },
      hide: () => { _scr?.root?.classList?.add("ob-scr-hidden"); },
      clear: () => { _history = []; if (_scr) { _scr.line.textContent = ""; _renderHistory(); } }
    };
  }
});

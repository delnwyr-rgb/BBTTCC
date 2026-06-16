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

Hooks.once("ready", () => {
  _registerVoice();
  const ns = globalThis.game?.bbttcc?.onboarding;
  if (ns) {
    ns.speak = speak;
    ns.riff = riff;
    ns.operatorAvailable = _operatorAvailable;
  }
});

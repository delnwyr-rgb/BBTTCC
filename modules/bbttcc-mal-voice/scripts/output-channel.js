/* bbttcc-mal-voice/scripts/output-channel.js
 * Phase 2A.5 — Chat output rendering.
 *
 * Takes a voice's reply text + audience config and renders it to Foundry chat
 * with the right speaker alias / portrait / whisper recipients.
 *
 * Audience routing:
 *   "broadcast"        — visible to all users
 *   "gm"               — whispered to all GM users only
 *   "faction:<id>"     — whispered to users who own/control that faction
 *   "player:<id>"      — whispered to that specific user
 *
 * Output channels (Phase 2A wires "chat"; others are stubs):
 *   "chat"               — ChatMessage.create with voice.speakAs alias
 *   "whisper"            — alias for audience-as-whisper
 *   "sheetPopup"         — TODO Phase 2B (popup near actor sheet)
 *   "tokenSpeechBubble"  — TODO Phase 2B (canvas chat bubble on token)
 *
 * Budget warning: if the call cost would push monthly spend past
 * monthlyBudgetUSD setting, render normally but log a warning to GM.
 *
 * Spec: modules/bbttcc-raid/AGENT_API_SPEC.md §8 Phase 2
 */

const MODULE_ID = "bbttcc-mal-voice";
const TAG = "[mal-voice:output]";
const log  = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

// ----- Audience → whisper user list -----
function _resolveAudience(audience) {
  const a = String(audience || "broadcast");
  if (a === "broadcast") return { whisper: null };  // null = visible to all

  if (a === "gm") {
    const gmIds = game.users.filter(u => u.isGM && u.active).map(u => u.id);
    return { whisper: gmIds };
  }

  if (a.startsWith("faction:")) {
    const factionId = a.split(":")[1];
    const factionActor = game.actors.get(factionId) || null;
    if (!factionActor) {
      warn(`audience faction id '${factionId}' not found; defaulting to GM`);
      return { whisper: game.users.filter(u => u.isGM).map(u => u.id) };
    }
    // Users with OWNER permission on the faction actor.
    const userIds = game.users
      .filter(u => factionActor.testUserPermission(u, "OWNER") && !u.isGM)
      .map(u => u.id);
    // Always include GMs so they see what advisors tell their factions.
    const gmIds = game.users.filter(u => u.isGM).map(u => u.id);
    return { whisper: [...new Set([...userIds, ...gmIds])] };
  }

  if (a.startsWith("player:")) {
    const playerId = a.split(":")[1];
    const user = game.users.get(playerId);
    if (!user) {
      warn(`audience player id '${playerId}' not found; defaulting to GM`);
      return { whisper: game.users.filter(u => u.isGM).map(u => u.id) };
    }
    return { whisper: [playerId, ...game.users.filter(u => u.isGM).map(u => u.id)] };
  }

  warn(`unknown audience '${a}' — defaulting to broadcast`);
  return { whisper: null };
}

// ----- Budget check (soft warning, never blocks) -----
function _budgetCheck(voice, costEstimateUSD) {
  if (!Number.isFinite(costEstimateUSD)) return;
  try {
    const budget = Number(game.settings.get(MODULE_ID, "monthlyBudgetUSD") || 0);
    if (budget <= 0) return;
    const callLog = game.settings.get(MODULE_ID, "callLog") || [];
    const monthMs = 30 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - monthMs;
    const monthSpend = callLog
      .filter(e => e.ts >= cutoff)
      .reduce((s, e) => s + (Number(e.costUSD) || 0), 0);
    const next = monthSpend + costEstimateUSD;
    if (next > budget && game.user.isGM) {
      ui.notifications?.warn(`[Mal Voice] Monthly spend $${next.toFixed(2)} exceeds budget $${budget.toFixed(2)}. Voice still active — adjust budget in module settings.`);
    }
  } catch (_) { /* non-fatal */ }
}

// ----- Build the chat message data -----
function _buildMessageData(voice, text, whisper) {
  const speakAs = voice.speakAs || {};
  const alias = speakAs.alias || voice.name || voice.id;

  // Use a styled wrapper so Mal's lines are visually distinct.
  const styled = `<div class="bbttcc-mal-voice" style="border-left:3px solid #c66;padding:.4em .6em;background:rgba(204,102,102,.06);font-style:italic">${_escape(text)}</div>`;

  const data = {
    content: styled,
    speaker: ChatMessage.getSpeaker({ alias })
  };

  // If voice.speakAs.actorId is configured, use that actor's portrait.
  if (speakAs.actorId) {
    const actor = game.actors.get(speakAs.actorId);
    if (actor) {
      data.speaker = ChatMessage.getSpeaker({ actor, alias });
    }
  }

  if (whisper && whisper.length) {
    data.whisper = whisper;
  }

  // Flag the message so we can identify Mal lines later (filtering, theming).
  data.flags = data.flags || {};
  data.flags[MODULE_ID] = {
    voiceId: voice.id,
    audience: voice.audience,
    canonVersion: voice.meta?.canonVersion || null
  };

  return data;
}

function _escape(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ----- Public: render({ voice, text, context }) -----
async function render({ voice, text, context } = {}) {
  if (!voice || !text) return { ok: false, error: "BAD_INPUT", message: "voice + text required" };
  const channel = voice.outputChannel || "chat";

  // Budget warning (non-blocking)
  _budgetCheck(voice, context?._costEstimateUSD);

  if (channel === "chat" || channel === "whisper") {
    // Dynamic audience: if the contextBuilder set _audienceOverride (e.g. Faction
    // Advisor resolving which faction's leader to whisper based on trigger args),
    // honor it. Otherwise use the voice's static audience.
    let effectiveAudience = (context?._audienceOverride) || voice.audience;
    if (voice.audience === "trigger-resolved" && !context?._audienceOverride) {
      warn(`voice '${voice.id}' declared audience 'trigger-resolved' but contextBuilder did not set context._audienceOverride; falling back to GM whisper`);
      effectiveAudience = "gm";
    }
    const { whisper } = _resolveAudience(effectiveAudience);
    const data = _buildMessageData(voice, text, whisper);
    // Stamp the effective audience on the message flag for traceability.
    data.flags = data.flags || {};
    data.flags[MODULE_ID] = Object.assign(data.flags[MODULE_ID] || {}, { effectiveAudience });
    try {
      const msg = await ChatMessage.create(data);
      return { ok: true, messageId: msg?.id || null, channel, audience: voice.audience };
    } catch (e) {
      warn("ChatMessage.create failed:", e?.message || e);
      return { ok: false, error: "CHAT_CREATE_FAILED", message: e?.message || String(e) };
    }
  }

  if (channel === "sheetPopup" || channel === "tokenSpeechBubble") {
    // Phase 2B stub — fall back to chat for now.
    warn(`output channel '${channel}' not yet implemented; falling back to chat`);
    return await render({ voice: { ...voice, outputChannel: "chat" }, text, context });
  }

  return { ok: false, error: "UNKNOWN_CHANNEL", message: `Output channel '${channel}' not recognized` };
}

// ----- Install -----
function _install() {
  try {
    globalThis.game.bbttcc     ??= { api: {} };
    globalThis.game.bbttcc.mal ??= {};
    globalThis.game.bbttcc.mal.output = Object.assign(globalThis.game.bbttcc.mal.output || {}, {
      render,
      _resolveAudience,
      _buildMessageData
    });
    log(`Output channel installed.`);
  } catch (e) {
    warn("install failed:", e?.message || e);
  }
}

Hooks.once("ready", _install);
if (globalThis.game?.ready) _install();

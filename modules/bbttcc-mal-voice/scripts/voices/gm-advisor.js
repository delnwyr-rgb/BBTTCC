/* bbttcc-mal-voice/scripts/voices/gm-advisor.js
 * Phase 2B.1 — GM Advisor voice config.
 *
 * Default voice that whispers strategic + narrative advice to the GM only.
 * Consumes the canon-grounded outputs of Phase 1's gm.* advisor verbs
 * (gm.suggestCampaignBeats / gm.suggestCampaignTables / gm.recommendWorldSignals)
 * as STRUCTURED INPUT — the LLM doesn't free-associate; it translates the
 * rule-grounded suggestions into prose the GM can actually use at the table.
 *
 * Voice register: analytical, observational, gently directive. Like a
 * thoughtful senior co-GM looking over your shoulder. NOT Mal's snark.
 * The canned advisor functions stay live in the UI as fallback for users
 * without LLM access (per §10 sign-off resolution #6).
 *
 * Spec: modules/bbttcc-raid/AGENT_API_SPEC.md §8.1 Phase 2B
 */

const TAG = "[mal-voice:gm-advisor]";
const log  = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

// ============================================================
// GM Advisor system prompt
// ============================================================
const GM_ADVISOR_SYSTEM_PROMPT = `You are the GM Advisor — a strategic co-GM voice whispered only to the GM. You are NOT a character in the world. You are a thoughtful collaborator helping the GM make better calls in the moment.

## VOICE

Analytical. Observational. Brief. Like a senior co-GM glancing at the state of the table and saying "here's what I'd watch." Professional warmth — no snark, no theatrics, no diegetic flourishes. Plain assistive prose.

Example tones:
• "Two of your three opening hexes still haven't paid off a Spark, and the Funkie Bunch just consolidated. Worth pushing a discovery beat next round before the players plateau."
• "The Khezek Tor population is one neglect tick from defecting. If you've been holding back the Brace collapse beat, this is the inflection point."
• "Three sessions since the Valhaulan threat surfaced — they're starting to feel like flavor, not threat. Either give them a move or quietly fade them."

## INPUT FORMAT

Each call gives you:
• \`trigger\`: what just happened (scene change, round commit, GM manual ping)
• \`snapshot\`: compact game state (factions, hexes, turn, recent events)
• \`canonSuggestions\`: STRUCTURED canon-grounded recommendations from the rules engine:
  - \`beats\`: campaign beats the system thinks could fire
  - \`tables\`: random tables the system thinks could be drawn from
  - \`worldSignals\`: pressure/state observations the rules engine surfaced
• \`mode\`: "beat-suggestion" | "table-suggestion" | "world-pressure" | "round-debrief" | "free"

These canon suggestions are GROUND TRUTH from the rules engine. Build your advice ON them, not around them. If the engine flagged a beat, your job is to translate WHY it matters now and HOW the GM might thread it in. Don't invent beats the engine didn't suggest. Don't ignore signals the engine surfaced.

## HARD RULES

1. **Length**: Default 1-3 sentences (≤60 words). Round debriefs may go to ~120 words if the situation is complex. NEVER a multi-section memo.
2. **Output**: Plain prose. No headers, no bullet lists, no markdown unless explicitly asked. Just speak.
3. **Be concrete, never generic**. "Push a discovery beat" is OK if you name WHICH discovery beat and which faction/hex. "Things are getting interesting" is forbidden.
4. **Cite the engine**. When you make a suggestion grounded in canonSuggestions, say so briefly ("the engine flagged…", "beat ID xyz looks live…", "world-signal X just crossed threshold…"). The GM should trust your prose because it points back at the rules.
5. **Never speculate beyond the data**. If canonSuggestions is empty or thin, say so plainly: "No engine-flagged beats this round — quiet turn, use it to land a player thread." Don't pad.
6. **No directives the GM didn't ask for**. You advise; you don't command. "Worth considering" / "If you've been holding…" / "Could thread X" — NOT "Do X" / "You should Y".
7. **Whisper voice**. You're talking to the GM only. Don't address players. Don't break the fourth wall by referencing yourself as an AI ("I would suggest" is fine; "as an AI" is not).

## WORLD CONTEXT (use naturally — never lecture)

Setting: Bad Eden, post-Shattering frontier. Stewards (PCs) manage factions, hexes, OP banks, Holdings, raids, manifestations. Sephirotic = load-bearing structure; Qliphothic = corrupted. Sparks = scattered cosmic light to recover. Past lives = OP pools recovered slowly. Campaign beats = scripted narrative inflection points the engine queues. Raid types: Assault, Infiltration, Courtly.

## OUTPUT

Read the input. Speak as the GM Advisor. Output ONLY the advice prose. No preamble, no JSON, no explanation of your reasoning. The GM is mid-session and needs the take, not the working.`;

// ============================================================
// Custom context builder — pulls structured canon suggestions
// from the Phase 1 gm.* verbs BEFORE building the LLM context.
// ============================================================
async function gmAdvisorContextBuilder(voice, triggerArgs) {
  const agent = globalThis.game?.bbttcc?.api?.agent;
  const triggers = globalThis.game?.bbttcc?.mal?.triggers;
  const slim = triggers?.slimSnapshot   || ((s) => s);
  const trunc = triggers?.truncateForLLM || ((o) => o);

  if (!agent?.invoke) {
    warn("agent registry unavailable — GM Advisor context will be thin");
    return _minimalContext(triggerArgs);
  }

  // Slim snapshot (~200 chars instead of ~25k)
  let snapshot = null;
  try {
    const s = await agent.invoke("snapshot", {});
    if (s && s.ok !== false) snapshot = slim(s);
  } catch (e) { warn("snapshot fetch failed:", e?.message); }

  // Resolve factionId
  let factionId = triggerArgs.args?.factionId || null;
  if (!factionId) {
    try {
      const r = await agent.invoke("gm.inferFactionId", {});
      if (r && r.factionId) factionId = r.factionId;
    } catch (_) { /* non-fatal */ }
  }

  // Per-faction observation (needed by gm.suggest*; we don't pass it to LLM — too large)
  let observation = null;
  if (factionId) {
    try {
      const o = await agent.invoke("observation.snapshot", { factionId });
      if (o && o.ok !== false) observation = o;
    } catch (e) { warn("observation fetch failed:", e?.message); }
  }

  // Canon suggestions — these are the GROUND TRUTH structured input the
  // GM Advisor system prompt is designed around. Truncate each to a hard
  // cap so a verbose engine output can't blow the budget.
  let beats = null, tables = null, worldSignals = null;
  if (observation) {
    try {
      beats = await agent.invoke("gm.suggestCampaignBeats", { observation });
    } catch (e) { warn("gm.suggestCampaignBeats failed:", e?.message); }
    try {
      tables = await agent.invoke("gm.suggestCampaignTables", { observation });
    } catch (e) { warn("gm.suggestCampaignTables failed:", e?.message); }
  }
  try {
    const w = await agent.invoke("gm.recommendWorldSignals", {});
    if (w && w.ok !== false) worldSignals = w;
  } catch (e) { warn("gm.recommendWorldSignals failed:", e?.message); }

  // Faction name (cheap, useful for the LLM to ground its prose)
  const factionName = factionId && globalThis.game?.actors
    ? (globalThis.game.actors.get(factionId)?.name || null)
    : null;

  const hook = String(triggerArgs.hook || "").toLowerCase();
  let mode = triggerArgs.mode || "free";
  if (/(scene.*enter|scene.*transition)/.test(hook)) mode = "world-pressure";
  else if (/roundcommit|roundend/.test(hook))         mode = "round-debrief";
  else if (/advise|manual/.test(hook))                mode = "free";

  return {
    trigger:    { hook: triggerArgs.hook || "manual", args: triggerArgs.args || {} },
    snapshot,
    factionId,
    factionName,
    canonSuggestions: {
      beats:        trunc(beats,        2500),
      tables:       trunc(tables,       2500),
      worldSignals: trunc(worldSignals, 1500)
    },
    mode,
    lengthHint: triggerArgs.lengthHint || (mode === "round-debrief" ? 100 : 40)
  };
}

function _minimalContext(triggerArgs) {
  return {
    trigger: { hook: triggerArgs.hook || "manual", args: triggerArgs.args || {} },
    snapshot: null,
    canonSuggestions: { beats: null, tables: null, worldSignals: null },
    mode: triggerArgs.mode || "free",
    lengthHint: 40
  };
}

// ============================================================
// Voice config
// ============================================================
const GM_ADVISOR_VOICE = {
  id:           "gm-advisor",
  name:         "GM Advisor",
  enabled:      true,
  systemPrompt: GM_ADVISOR_SYSTEM_PROMPT,
  provider:     "",
  model:        "",
  maxTokens:    200,
  temperature:  0.55,         // lower than Mal — analytical, not creative
  audience:     "gm",         // whisper to GMs only
  outputChannel: "chat",      // appears as whispered chat message
  speakAs: {
    alias: "GM Advisor"
  },
  triggers: [
    { hook: "bbttcc:gm:advise",         debounceMs: 0    },   // manual /advise command
    { hook: "bbttcc:raid:roundCommit",  debounceMs: 4000 },   // post-round debrief (separate from Mal's color)
    { hook: "bbttcc:scene:enter",       debounceMs: 3000 },   // scene transitions
    { hook: "bbttcc:gm-advisor:test",   debounceMs: 0    }    // for §2B.4 smoketest
  ],
  contextBuilder: gmAdvisorContextBuilder,
  meta: {
    canonVersion: "2026-05-22",
    replaces:     ["gm.resolveCampaignBeatSuggestions UI", "gm.resolveCampaignTableSuggestions UI"],
    note:         "Canon suggestions still surface in original UI as fallback for no-key users."
  }
};

// ----- Register on ready -----
function _install() {
  try {
    const voices = globalThis.game?.bbttcc?.mal?.voices;
    if (!voices?.register) {
      warn("voice registry not available — GM Advisor cannot self-register");
      return;
    }
    voices.register(GM_ADVISOR_VOICE);
    log(`GM Advisor registered (systemPrompt=${GM_ADVISOR_SYSTEM_PROMPT.length} chars, ${GM_ADVISOR_VOICE.triggers.length} triggers).`);
  } catch (e) {
    warn("GM Advisor registration failed:", e?.message || e);
  }
}

Hooks.once("ready", _install);
if (globalThis.game?.ready) _install();

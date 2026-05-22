/* bbttcc-mal-voice/scripts/voices/faction-advisor.js
 * Phase 2B.3 — Faction Advisor voice config.
 *
 * One voice config, dynamically targeted: whispers to whichever faction's
 * leader (steward) fired the trigger, advising on that faction's situation.
 *
 * Architecture:
 *   - Voice declares audience: "trigger-resolved"
 *   - factionAdvisorContextBuilder() reads factionId from trigger args,
 *     sets context._audienceOverride = "faction:<id>", calls Phase 1's
 *     strategic.recommendNext / strategic.legalActions / observation.snapshot
 *     for that faction, packages the structured advisor data
 *   - Output channel honors _audienceOverride and whispers to that
 *     faction's owners (per §2B.2 patch)
 *
 * The canned strategic.* functions stay live in the UI as fallback for
 * users without LLM access (per §10 sign-off resolution #6).
 *
 * Spec: modules/bbttcc-raid/AGENT_API_SPEC.md §8.1 Phase 2B
 */

const TAG = "[mal-voice:faction-advisor]";
const log  = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

// ============================================================
// Faction Advisor system prompt
// ============================================================
const FACTION_ADVISOR_SYSTEM_PROMPT = `You are the Faction Advisor — a counselor whispered only to the leader (Steward) of a specific faction in Bad Eden. You are a quiet, practical voice at their shoulder. NOT Mal (Mal speaks to the whole table; you speak to one faction's leader privately). Not a GM voice (you serve THIS faction's interests, not the rules engine's).

## VOICE

Grounded. Practical. Faction-loyal. The tone of a senior aide who has been in the room for every hard call this faction ever made. You don't perform. You don't moralize. You name the actual choice on the table, in order of magnitude.

Example tones:
• "Three things on your plate. The Funkie Bunch raid we just took — we have one round to set the morale story or it sets us. Khezek Tor's neglect tick is one turn from defection; either we pay the upkeep this round or we lose them quiet. The Diplomatic Channel that just cracked open with Red Hat — that's a real opening if you spend the soft-power now while it's hot."
• "Lyrenn's grain ring won't survive another raid. If we go on the offensive next turn, that's the cost ledger you should know about."
• "Nothing urgent. Stockpile's healthy, allies haven't moved. Quiet turn — good window to fix the Brace before someone else picks the fight."

## INPUT FORMAT

Each call gives you:
• \`factionId\`: the faction this advice is for (you are loyal to this faction specifically)
• \`trigger\`: what just happened (sheet opened, OP changed, raid being initiated)
• \`faction\`: the faction's current state (banks, morale, loyalty, holdings, relationships)
• \`legalActions\`: actions this faction can attempt right now (strategic moves the rules engine permits)
• \`recommendations\`: STRUCTURED canon-grounded recommendations (engine-scored next-action candidates)
• \`observation\`: full observation snapshot (territory, war history, peers)
• \`mode\`: "sheet-glance" | "op-change-debrief" | "pre-raid" | "free"

The recommendations and legalActions are GROUND TRUTH from the rules engine. Your advice translates them into the situation; you don't invent moves the engine doesn't permit. If recommendations is thin, say what's actually true: "engine has no strong recommendation this round — depends on what we want, not what we must."

## HARD RULES

1. **Length**: Default 1-3 sentences (≤60 words). Pre-raid debriefs may go to ~120 words. Sheet-glances should be one tight sentence — leader is glancing, not reading.
2. **Output**: Plain prose. No headers, no bullet lists, no markdown.
3. **Speak FROM the faction.** Use "we", "our", "us" when referring to the faction. The Steward is "you". Treat other factions by name.
4. **Be concrete.** Name OP banks, hexes, factions, manifestations, holdings by name. Numbers from the engine output are OK to translate ("one turn from defection") — never invent numbers.
5. **Cite the engine when you point at a move**. "The engine flags X as best-scored" / "legalActions shows we can still Y this round" — gives the leader confidence the advice is grounded.
6. **Acknowledge constraints**. "We can't afford that this round" / "morale won't hold that long" — your job is the cost ledger, not just the upside.
7. **Whisper voice**. Only this faction's leader hears you. Don't address other players. Don't break the fourth wall as an AI.
8. **No directives, but be willing to recommend.** "I'd take X" / "Worth pushing Y" / "Don't burn that one yet" — confident enough to be useful.

## WORLD CONTEXT (use naturally)

Setting: Bad Eden, post-Shattering frontier. Factions hold hexes, run raids (Assault / Infiltration / Courtly), spend OP from nine banks (Violence / Nonlethal / Intrigue / Economy / Softpower / Diplomacy / Logistics / Culture / Faith), track Morale / Loyalty / Darkness, station Rigs and Bosses as Holdings. Past lives = OP pools recovered slowly. Sephirotic vs Qliphothic. The Great Work = restoration.

## OUTPUT

Read the input. Speak as this faction's Advisor. Output ONLY the advice prose. No preamble, no JSON, no caveats about being AI. The Steward is mid-decision and needs the take.`;

// ============================================================
// Custom context builder — resolves factionId, sets audience override,
// calls Phase 1 strategic.* + observation.* for that faction.
// ============================================================
async function factionAdvisorContextBuilder(voice, triggerArgs) {
  const agent = globalThis.game?.bbttcc?.api?.agent;
  const triggers = globalThis.game?.bbttcc?.mal?.triggers;
  const trunc = triggers?.truncateForLLM || ((o) => o);

  if (!agent?.invoke) {
    warn("agent registry unavailable — Faction Advisor context will be thin");
    return _minimalContext(triggerArgs, null);
  }

  const args = triggerArgs.args || {};
  const factionId = args.factionId
                 || args.attackerFactionId
                 || args.fromFactionId
                 || args.actorId
                 || null;

  if (!factionId) {
    warn(`Faction Advisor fired without a resolvable factionId (hook=${triggerArgs.hook}). Falling back to GM-whisper context.`);
    return _minimalContext(triggerArgs, null);
  }

  // Pull observation, legal actions, recommendations IN PARALLEL.
  const [obsR, legalR, recR] = await Promise.allSettled([
    agent.invoke("observation.snapshot",  { factionId }),
    agent.invoke("strategic.legalActions", { factionId }),
    agent.invoke("strategic.recommendNext",{ factionId, n: 5 })
  ]);

  const observation     = (obsR.status === "fulfilled"   && obsR.value?.ok   !== false) ? obsR.value   : null;
  const legalActions    = (legalR.status === "fulfilled" && legalR.value?.ok !== false) ? legalR.value : null;
  const recommendations = (recR.status === "fulfilled"   && recR.value?.ok   !== false) ? recR.value   : null;

  const factionName = globalThis.game?.actors?.get(factionId)?.name || null;

  const hook = String(triggerArgs.hook || "").toLowerCase();
  let mode = triggerArgs.mode || "free";
  if (/sheetopened|sheetopen/.test(hook))           mode = "sheet-glance";
  else if (/opchanged|opchange|stockpile/.test(hook)) mode = "op-change-debrief";
  else if (/raid.*initiate/.test(hook))              mode = "pre-raid";

  return {
    factionId,
    factionName,
    trigger:         { hook: triggerArgs.hook || "manual", args },
    // Aggressively-truncated structured advisor data. The full observation
    // can be tens of KB — we hand the LLM a hard-capped slice. If the GM
    // Advisor needs richer context for a specific decision, they can run the
    // canned `strategic.*` UI directly.
    faction:         trunc(observation?.faction || null, 1500),
    legalActions:    trunc(legalActions,    2000),
    recommendations: trunc(recommendations, 2500),
    mode,
    lengthHint:      triggerArgs.lengthHint || (mode === "sheet-glance" ? 25 : mode === "pre-raid" ? 100 : 40),
    // SIGNAL TO OUTPUT CHANNEL — whisper to this faction's owners (per §2B.2 patch).
    _audienceOverride: `faction:${factionId}`
  };
}

function _minimalContext(triggerArgs, factionId) {
  return {
    factionId,
    trigger: { hook: triggerArgs.hook || "manual", args: triggerArgs.args || {} },
    faction: null, observation: null, legalActions: null, recommendations: null,
    mode: triggerArgs.mode || "free",
    lengthHint: 40,
    // Without a factionId we fall back to GM whisper rather than broadcasting.
    _audienceOverride: factionId ? `faction:${factionId}` : "gm"
  };
}

// ============================================================
// Voice config
// ============================================================
const FACTION_ADVISOR_VOICE = {
  id:           "faction-advisor",
  name:         "Faction Advisor",
  enabled:      true,
  systemPrompt: FACTION_ADVISOR_SYSTEM_PROMPT,
  provider:     "",
  model:        "",
  maxTokens:    200,
  temperature:  0.6,                 // grounded — not as creative as Mal
  audience:     "trigger-resolved",  // resolved per-call by contextBuilder via _audienceOverride
  outputChannel: "chat",
  speakAs: {
    alias: "Faction Advisor"
  },
  triggers: [
    { hook: "bbttcc:faction:sheetOpened",   debounceMs: 60000 },  // 60s — leader is reading, not spamming
    { hook: "bbttcc:faction:opChanged",     debounceMs: 8000  },  // small flurry of OP edits should consolidate
    { hook: "bbttcc:raid:initiate",         debounceMs: 0     },  // pre-raid advice fires immediately
    { hook: "bbttcc:faction-advisor:test",  debounceMs: 0     }   // for §2B.4 smoketest
  ],
  contextBuilder: factionAdvisorContextBuilder,
  meta: {
    canonVersion: "2026-05-22",
    replaces:     ["strategic.recommendNext UI", "strategic.legalActions UI"],
    note:         "Canon recommendations still surface in original UI as fallback for no-key users. Faction Advisor uses them as STRUCTURED INPUT to the LLM call."
  }
};

// ----- Register on ready -----
function _install() {
  try {
    const voices = globalThis.game?.bbttcc?.mal?.voices;
    if (!voices?.register) {
      warn("voice registry not available — Faction Advisor cannot self-register");
      return;
    }
    voices.register(FACTION_ADVISOR_VOICE);
    log(`Faction Advisor registered (systemPrompt=${FACTION_ADVISOR_SYSTEM_PROMPT.length} chars, ${FACTION_ADVISOR_VOICE.triggers.length} triggers, audience=trigger-resolved).`);
  } catch (e) {
    warn("Faction Advisor registration failed:", e?.message || e);
  }
}

Hooks.once("ready", _install);
if (globalThis.game?.ready) _install();

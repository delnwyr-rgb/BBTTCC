# Agent API Specification

**Status:** DRAFT — awaiting sign-off
**Date:** 2026-05-21
**Owner:** delnwyr
**Foundation:** `bbttcc-raid/scripts/bbttcc-agent-api.js` (existing, 3,604 LOC)

---

## 1. Premise

By Q3 2027 (Foundry release window + Kickstarter), every serious TTRPG group will have an AI co-pilot at the table — either GM-side (encounter design, NPC voice, rules adjudication) or player-side (character building, action suggestion). The systems that win the next Kickstarter cycle will be the ones whose intent-level verbs are **callable by an external agent**, not just clickable by a human.

BBTTCC is already 70% of the way there: `game.bbttcc.api.agent.*` exists, with snapshot/observation/simulate/validate already implemented for the raid/strategic layer. This spec defines how to **stabilize, schema-ify, and extend** that surface into a unified, agent-callable contract spanning every gameplay verb in the system.

**Kickstarter pitch this enables:** "BBTTCC works with your AI GM out of the box. Bring Claude, GPT, your local model — they can read your campaign state, simulate decisions, and execute actions through a stable schema-validated API. No competitor offers this."

**Concrete first consumer: Mal.** [[mal-voiced-manifestations]] already established Mal's canon voice on 2026-05-20. Phase 2 builds the `bbttcc-mal-voice` module on top of Phase 1's API — turning Mal into a real-time character who speaks at every table — AND folds the existing GM Advisor + Faction Advisor surfaces (`resolveCampaignBeatSuggestions`, `recommendNextActions`, etc.) into the same LLM-powered voice system. The agent API isn't just plumbing for someone-else-someday; it ships with a flagship consumer we can feel working. See §8.

---

## 2. Naming Decision

**Decision:** Extend the existing `game.bbttcc.api.agent.*` namespace. Do NOT create a parallel `game.fourththing.agent.*`.

**Reasoning:**
- The existing namespace already lives at the cross-module level (correct scope — raids, factions, territory, structures all need to be reachable).
- The existing verbs (`snapshot`, `simulate.maneuver`, `validate.maneuver`, `getObservationSnapshot`) already follow the right shape.
- Adding a system-level alias would invite drift; one namespace is the source of truth.

**Discoverability alias (optional):** `game.fourththing.agent` → reference to `game.bbttcc.api.agent`. Considered, deferred — not worth the maintenance overhead unless a concrete consumer asks for it.

---

## 3. Three-Layer Model

Every agent-callable verb falls into exactly one of three layers. The layer dictates safety guarantees, audit behavior, and how external agents should reason about calling it.

### Layer 1: Queries (read-only)

- **Contract:** No mutations. Safe to call repeatedly. Safe in parallel. No socket emissions. No audit log entry.
- **Existing examples:** `snapshot()`, `registry.maneuvers()`, `audit.coverage`, `getObservationSnapshot()`, `listLegalStrategicActions()`
- **Schema requirement:** Returns must be JSON-serializable (no live actor refs, no DOM nodes).

### Layer 2: Simulations (dry-run, no commit)

- **Contract:** Compute the *would-be* result of an action without applying it. No state mutations, no chat cards, no sockets.
- **Existing examples:** `simulate.maneuver()`, `validate.maneuver()`, `estimateRaid()`, `scoreCandidates()`, `recommendNextActions()`
- **Schema requirement:** Returns include `previewWorldEffects`, `previewFactionEffects`, and an explicit `warnings` array.

### Layer 3: Actions (mutating, audit-trailed)

- **Contract:** Apply real changes to game state. Audit log entry. Socket emission where appropriate. GM-only or owner-only.
- **Existing examples:** `game.bbttcc.api.gm.setWorld/setFaction/setActor/setHex` (already allowlist-validated and audited)
- **Schema requirement:** Args must be JSON-validated against the verb's schema BEFORE execution. Returns include `changed` (array of mutated paths) and `note` (audit string).

### Capabilities (introspection layer)

A meta-layer accessible at `game.bbttcc.api.agent.capabilities()` that returns the full schema-described surface — used by external agents to discover what they can call.

---

## 4. Schema Convention

Every verb declares a complete contract using **JSON Schema draft-2020-12** (chosen because it's what Anthropic's tool-use API and MCP consume natively, with no translation).

### Verb declaration shape

```js
agent.registerVerb({
  name: "raids.commitRound",
  layer: "action",                    // query | simulation | action
  description: "Commit a raid round, applying all queued maneuvers and emitting cinematic VFX.",
  args: {                              // JSON Schema for input
    type: "object",
    required: ["raidSessionId"],
    properties: {
      raidSessionId: { type: "string", format: "uuid" },
      outcomeOverride: { type: "string", enum: ["clean","messy","detected"], nullable: true }
    }
  },
  returns: {                           // JSON Schema for output
    type: "object",
    properties: {
      ok: { type: "boolean" },
      changed: { type: "array", items: { type: "string" } },
      cinematic: { type: "object" }
    }
  },
  permissions: ["gm"],                 // who can call it
  sideEffects: {                       // declared, not hidden
    sockets: ["raidCinematic", "raidPill"],
    hooks: ["bbttcc:raid:roundCommit"],
    audit: true
  },
  handler: async (args) => { /* ... */ }
});
```

### Why this shape

- **`name`** is dot-namespaced for hierarchical discovery (`raids.*`, `factions.*`, `territory.*`).
- **`args` schema** lets us reject malformed agent calls *before* they touch the engine — critical when the caller is an LLM that can hallucinate.
- **`sideEffects`** is declared, not hidden. An external agent reading the schema can decide "I don't want to commit yet" if it sees socket emissions.
- **`permissions`** lets us gate `gm`-only verbs centrally.
- **`handler`** is the existing implementation; the registry is a thin wrapper.

---

## 5. Capabilities Introspection

```js
game.bbttcc.api.agent.capabilities() → {
  ts: 1234567890,
  version: "0.7.0",
  verbs: [
    { name, layer, description, args, returns, permissions, sideEffects },
    ...
  ],
  // Grouped by layer for convenience
  queries: [...names],
  simulations: [...names],
  actions: [...names],
  // Foundry-side metadata an external agent should know
  enums: {
    damageTypes: FT.DAMAGE_TYPES,
    conditions: FT.CONDITIONS,
    manifestationForms: FT.MANIFESTATION_FORMS,
    raidTypes: ["assault","infiltration","courtly"],
    opCategories: ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"]
  }
}
```

This single call is enough for an external agent (or an MCP server, see §8) to bootstrap full awareness of the BBTTCC API.

---

## 6. Wrapping Policy

Not every existing function gets a `.agent.*` wrapper. The policy is:

| Verb type | Policy |
|---|---|
| Already pure-config (e.g. `_applyDamageToActor`, `resolveManifestationAttack`) | Wrap as-is with schema declaration. |
| UI-coupled but with clear pure-args path (e.g. `applyDamageFromButton`) | Add a sibling pure-args wrapper. Leave the UI handler intact. |
| Pure UI openers (e.g. `openRaidConsole`, `openManifestationWizard`) | **Do NOT wrap.** Out of scope — opening modals isn't an agent verb. |
| Scenario engine `step()` functions (Courtly, Infiltration) | Wrap with explicit state args, NOT console.vm coupling. |
| Socket message handlers | Define typed envelopes; wrap as actions with `sideEffects.sockets` declared. |
| `_classAutomation.openX*` (~60 handlers) | **Defer.** These are inherently UI-driven character abilities. Phase 3+ if at all. |

---

## 7. Phase 1 Scope — ship this week (~1,200 LOC est.)

Concrete deliverables, in order:

### 7.1 — Registry + schema infrastructure (~300 LOC)
- New file: `bbttcc-raid/scripts/agent-registry.js`
- Exports: `agent.registerVerb(spec)`, `agent.capabilities()`, `agent.invoke(name, args)` (with schema validation gate).
- Wired into `bbttcc-raid/module.json` and installed at `Hooks.once("ready")`.

### 7.2 — Migrate existing verbs to registry (~400 LOC)
The 15+ verbs already in `bbttcc-agent-api.js` get formal schema declarations:
- `snapshot`, `registry.maneuvers`, `audit.*`, `getObservationSnapshot`, `listLegalStrategicActions`, `estimateTravel`, `estimateRaid`, `scoreCandidates`, `buildStrategicCandidates`, `recommendNextActions`, `simulate.maneuver`, `validate.maneuver`.
- Behavior unchanged; this is pure schema annotation.

### 7.3 — Add 8 high-value Action verbs (~400 LOC)
Pure-config wrappers for the most-needed agent-mutating operations:
- `world.setState` (wraps `gm.setWorld`)
- `faction.setMorale` / `faction.bumpMorale`
- `faction.stockpile.deposit` / `withdraw` / `transfer`
- `manifestation.applyDamage` (wraps `_applyDamageToActor` with pure args)
- `territory.deployHolding` / `recallHolding`

### 7.4 — Document socket envelopes (~50 LOC + spec)
- Add a `sockets` section to this spec documenting `raidSession`, `raidCinematic`, `raidPill`, `courtlyHook`, `infilHook` payload shapes.
- Add JSON schemas for each in `agent-registry.js`.

### 7.5 — Self-test (~50 LOC)
- Macro: `tools/agent-api-selftest.macro.js` that calls every Layer 1 query verb and dumps the result. Used as a regression check after any schema change.

**Out of Phase 1:**
- Pure-config wrappers for Courtly/Infiltration `step()` (Phase 2)
- MCP server bridge (Phase 2)
- External documentation site (Phase 3)
- `_classAutomation.*` wrapping (deferred indefinitely)

---

## 8. Phase 2 — Mal Voice & Advisor System (Reference Consumer)

This is the artifact that proves the whole effort. A new module `bbttcc-mal-voice` consumes the Phase 1 agent API and turns it into a real-time, LLM-powered character/advisor system. **Mal already exists in canon** ([[mal-voiced-manifestations]] established the voice on 2026-05-20). This phase makes Mal *speak* — in real time, contextually, at every table — and folds the existing canned advisor surfaces into the same plumbing.

### 8.1 Three default voices, one engine

| Voice | Audience | Trigger | Replaces / extends |
|---|---|---|---|
| **Mal** | Broadcast (all players + GM) | Round start, manifestation cast (esp. misfire), scenario flip, Scandal Scar, raid commit | New — color, atmosphere, in-character snark |
| **GM Advisor** | GM whisper only | GM slash command, scene transition, encounter setup | Canon-grounded outputs of `resolveCampaignBeatSuggestions`, `resolveCampaignTableSuggestions`, `recommendWorldSignals` |
| **Faction Advisor** | Faction-leader whisper (per faction) | Faction sheet open, OP allocation, raid initiate, courtly outcome | Canon-grounded `recommendNextActions`, `scoreCandidates`, `buildStrategicCandidates` |

**Existing advisor functions are NOT deleted.** They become *structured inputs* to the LLM call. Each voice receives: raw state (via `agent.snapshot()`) + the canon-grounded advisor output (so the LLM is anchored in real rules, not free-associating) + the voice's system prompt. The LLM grounds in canon, then reasons flexibly and speaks in voice. This is the safest path to "AI advice" that doesn't confabulate.

### 8.2 Voice configuration schema

Each voice is a registered config block:

```js
game.bbttcc.api.mal.registerVoice({
  id: "mal",
  name: "Mal",
  systemPrompt: "<canon voice from mal-voiced-manifestations spec>. ≤40 words. Never break the fourth wall.",
  model: "claude-sonnet-4-7",                  // per-voice override; default = module setting
  audience: "broadcast",                        // broadcast | gm | faction:<id> | player:<id>
  triggers: [
    { hook: "bbttcc:raid:roundCommit",   debounceMs: 2000 },
    { hook: "bbttcc:manifestation:cast",  filter: (ctx) => ctx.misfire },
    { hook: "bbttcc:courtly:scarAccrued", debounceMs: 0 }
  ],
  contextBuilder: async (hookArgs) => ({
    snapshot:    await game.bbttcc.api.agent.snapshot(),
    advisorData: await game.bbttcc.api.agent.recommendNextActions({ factionId: hookArgs.factionId }),
    hookArgs,
    recentChat:  <last 5 chat messages, redacted>
  }),
  outputChannel: "chat",                        // chat | whisper | sheetPopup | tokenSpeechBubble
  speakAs: { actorId: "<mal-portrait-actor-uuid>" }
});
```

Backers and users can register additional voices — boss NPCs, regional gods, historical advisors, and (the obvious play) **the Steward's past lives** ([[past-lives-canon-2026-05-21]]: every recovered Awesome Crew / Occult Association becomes a consultable voice). The system ships with three; the community will ship hundreds. This is also a perfect Kickstarter stretch goal: **"Authored Voice"** tier — your backer character becomes a canonical consultable voice in the released system.

### 8.3 Bring-your-own-key (no backend, no risk)

Module settings expose:
- `apiProvider`: `anthropic` | `openai` | `ollama` (local) | `custom-endpoint`
- `apiKey`: user supplies their own
- `model`: per-provider selection
- `monthlyBudgetUSD`: soft cap with a warning before each call exceeding it
- `defaultPolicy`: `gm-key-powers-all-broadcast` (recommended) or `each-user-pays-for-their-own-whispers`

By default the GM's key powers all broadcast Mal lines; players can optionally configure their own keys for private advisor whispers. **No backend operated by us. No rate-limit risk. No legal exposure on provider ToS. No content moderation liability.** Critical for Kickstarter risk profile.

### 8.4 MCP bridge — the power-user / external path

Some users will want their AI co-pilot OUTSIDE Foundry — in Claude Code, Claude.ai, ChatGPT, Cursor. A tiny Node MCP server reads `agent.capabilities()` from a running Foundry world over a local socket and exposes every verb as an MCP tool. One command — `claude mcp add bbttcc` — and they're driving their campaign from any MCP-aware client. Mal-in-Foundry and Claude-outside-Foundry both consume the same Phase 1 API; one foundation, two consumer surfaces.

### 8.5 Phase 2 scope estimate

| Deliverable | LOC est. |
|---|---|
| `bbttcc-mal-voice` module shell + settings UI | 200 |
| Voice registry + config schema + persistence | 250 |
| Provider adapters (anthropic / openai / ollama) | 300 |
| Hook subscription + debouncing + context builder | 200 |
| Three default voice configs with canon system prompts | 150 |
| Chat output rendering (as actor portrait / whisper / etc.) | 100 |
| Budget tracking + warnings + audit log | 100 |
| MCP server bridge (separate npm package) | 400 |
| **Phase 2 total** | **~1,700 LOC** |

---

## 9. Phase 3+ Roadmap

- **Pure-config Courtly/Infiltration `step()` wrappers** — decouple from console.vm so agents can drive scenario engines directly.
- **Maneuver authoring API** — backers/agents propose new maneuvers via the API; GM-gated approval.
- **Schema-validated socket envelopes** — all socket emissions routed through the registry.
- **Public docs site** — auto-generated from `capabilities()`, hosted at e.g. `agent.rollforinitiation.com`.
- **OpenAPI / MCP package** published to npm + pip.
- **Voice marketplace** — community-authored voices installable from a curated registry. Kickstarter stretch-goal candidate.
- **Past-Lives consultation mechanic** — diegetic in-game UI: the Steward "consults" a recovered past life ([[past-lives-canon-2026-05-21]]); under the hood, a voice config with that past life's persona answers. The fiction *is* the feature.

---

## 10. Open Questions (need sign-off)

1. **Versioning.** Should `capabilities()` expose a `version` and should breaking changes follow semver? *Recommendation: yes, `0.7.0` now, lock to `1.0.0` at Foundry release.*

2. **Telemetry hook.** Should `agent.invoke()` emit a `bbttcc:agent:call` hook so we can capture usage analytics (anonymized)? *Recommendation: yes — feeds into the play-telemetry pillar.*

3. **Backer-authored content.** Should the registry support runtime verb registration from world-scope scripts (so backers can extend the API without touching module code)? *Recommendation: yes for Layer 1+2 (queries/sims), no for Layer 3 (actions) — security boundary.*

4. **Voice config storage.** Where do registered voices persist? *Recommendation: world-scope game setting (per-campaign), with import/export to JSON for sharing across tables.*

5. **Default model.** Ship pointing at a specific Claude/GPT model, or leave default empty and force user to configure? *Recommendation: empty default. Gives users autonomy and avoids any appearance of brand lock-in or affiliate steering.*

6. **Advisor function fate.** When Mal/Advisor voices speak, do the underlying canned `resolveCampaignBeatSuggestions` etc. still surface in their old UI locations, or do voices entirely subsume them? *Recommendation: keep both — voices are additive. Underlying canned outputs remain available as a fallback for users without LLM access, and as the structured input feeding the LLM. No regression for the no-key case.*

---

## 11. Sockets

Inter-client socket envelopes registered with the agent registry. External agents and Phase 2 consumers introspect via `game.bbttcc.api.agent.socketEnvelopes()`; emitters can pre-validate payloads via `agent.validateSocketEnvelope(type, payload)` before `game.socket.emit("module.bbttcc-raid", payload)` to catch shape drift at the source. All envelopes flow over the `module.bbttcc-raid` channel ([[foundry-v13-socket-manifest]] — manifest has `"socket": true`).

| Type | Direction | Purpose | Payload (required keys) |
|---|---|---|---|
| `raidSession`   | player → GM | Player Commit Staging — player writes, GM persists | `{ t, attackerId, payload }` |
| `raidCinematic` | GM → all    | Broadcast end-of-raid VFX | `{ t, outcome, raidType, attackerKeys?, defenderKeys? }` |
| `raidPill`      | any → all   | Lightweight status pill (e.g. "Round Added") | `{ t, text }` |
| `courtlyHook`   | GM → all    | Courtly Intrigue engine hook relay (VFX + state) | `{ t, hook, payload? }` |
| `infilHook`     | GM → all    | Infiltration engine hook relay (alarm, progress, outcome VFX) | `{ t, hook, payload? }` |

Every envelope carries `t` as discriminator. Schemas live in `bbttcc-raid/scripts/agent-socket-envelopes.js` and are registered at `Hooks.once("ready")`. Future socket types must add their schema there before the first emission — `agent.validateSocketEnvelope(type, payload)` returns `{ ok: false }` for unknown types.

---

## 12. Sign-off

This memo lands two phases:

- **Phase 1** (~1,200 LOC, this sprint): `agent-registry.js` + the 5 deliverables in §7. The foundation that everything else stands on.
- **Phase 2** (~1,700 LOC, 3-4 weeks after Phase 1): `bbttcc-mal-voice` module + MCP bridge. The artifact that proves the Kickstarter pitch and gives you a Mal you can hear at the table.

Total: ~2,900 LOC across both phases. Sign off and I'll start with §7.1 (registry + schema infrastructure).


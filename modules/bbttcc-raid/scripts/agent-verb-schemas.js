/* agent-verb-schemas.js
 * BBTTCC Agent API Migration — Phase 1 §7.2
 *
 * Declares formal JSON Schema arg+return contracts for the ~25 existing
 * agent verbs already attached to game.bbttcc.api.agent.* by
 * bbttcc-agent-api.js. Each verb gets a registry entry so that:
 *
 *   - agent.capabilities() returns its schema
 *   - agent.invoke("snapshot", args) gates calls behind schema validation
 *   - External agents (Phase 2 Mal voice, MCP bridge) can discover and call
 *     them via a single uniform contract
 *
 * Behavior is unchanged. Legacy direct-call form `agent.snapshot(args)`
 * continues to work; agents that want validation go through
 * `agent.invoke("snapshot", args)`.
 *
 * Naming: dot-namespaced topics (`snapshot`, `audit.coverage`,
 * `observation.snapshot`, `strategic.recommendNext`, `simulate.maneuver`,
 * `gm.*`). The original function names on `agent.*` are unchanged.
 *
 * Loads AFTER bbttcc-agent-api.js so the verb implementations exist when
 * we register them.
 *
 * Spec: modules/bbttcc-raid/AGENT_API_SPEC.md §7.2
 */

(function () {
  "use strict";

  const TAG  = "[bbttcc-agent-schemas]";
  const log  = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);

  // ----- Common sub-schemas -----
  const S_TS         = { type: "number", description: "Unix milliseconds timestamp" };
  const S_FACTION_ID = { type: "string", minLength: 1, description: "Faction actor UUID or short id" };
  const S_HEX_UUID   = { type: "string", minLength: 1, description: "Hex / scene UUID" };
  const S_OBJ        = { type: "object" };
  const S_BOOL       = { type: "boolean" };
  const S_STRINGS    = { type: "array", items: { type: "string" } };
  const S_INT        = { type: "integer" };
  const S_MANEUVER_KEY = { type: "string", minLength: 1, description: "Canonical snake_case maneuver key" };
  const S_RAID_TYPE  = { type: "string", description: "Normalized raid type (assault, infiltration, courtly, etc.)" };
  const S_OUTCOME_TIER = {
    type: "string",
    enum: ["success", "greatSuccess", "failure", "greatFailure", "clean", "messy", "detected", "unknown"]
  };

  // ----- Verb specs -----
  // The handler simply delegates to the existing implementation already attached
  // to game.bbttcc.api.agent.* by bbttcc-agent-api.js. Schemas document the
  // shape; the existing code holds the behavior.
  function _verbs(agent) {
    return [
      // ============================================================
      // QUERIES (Layer 1) — read-only, no side effects
      // ============================================================
      {
        name: "snapshot",
        layer: "query",
        description: "Read-only snapshot of system state for agent analysis.",
        args: { type: "object", properties: { includeRegistry: { ...S_BOOL, description: "Embed full maneuver registry" } } },
        returns: { type: "object", properties: { ts: S_TS, ready: S_BOOL, user: S_OBJ, raid: S_OBJ, agent: S_OBJ } },
        permissions: ["any"],
        sideEffects: { audit: false },
        handler: async (args) => agent.snapshot(args || {})
      },
      {
        name: "registry.listManeuvers",
        layer: "query",
        description: "List all maneuvers from the JSON design registry and runtime EFFECTS registry.",
        args: { type: "object", properties: { includeRegistry: S_BOOL } },
        returns: { type: "object", properties: { ok: S_BOOL, ts: S_TS, json: { type: "array" }, raid: { type: "array" } } },
        permissions: ["any"],
        sideEffects: { audit: false },
        handler: async (args) => agent.registry?.maneuvers?.(args || {})
      },
      {
        name: "audit.coverage",
        layer: "query",
        description: "Audit coverage gaps between JSON design registry and runtime maneuver registry.",
        args: { type: "object" },
        returns: { type: "object", properties: { ts: S_TS, raidTotal: S_INT, jsonTotal: S_INT, overlap: S_INT, onlyRaid: S_STRINGS, onlyJson: S_STRINGS } },
        permissions: ["any"],
        sideEffects: { audit: false },
        handler: async () => agent.audit?.coverage?.()
      },
      {
        name: "audit.throughputWiring",
        layer: "query",
        description: "Which maneuvers have intent-preview implementations wired vs stubs.",
        args: { type: "object" },
        returns: { type: "object", properties: { ts: S_TS, mergedTotal: S_INT, wired: S_INT, unwired: S_INT, wiredKeys: S_STRINGS, unwiredKeys: S_STRINGS } },
        permissions: ["any"],
        sideEffects: { audit: false },
        handler: async () => agent.audit?.throughputWiring?.()
      },
      {
        name: "audit.throughputWiringByTier",
        layer: "query",
        description: "Wiring coverage broken down by tier.",
        args: { type: "object" },
        returns: { type: "object", properties: { ts: S_TS, byTier: S_OBJ } },
        permissions: ["any"],
        sideEffects: { audit: false },
        handler: async () => agent.audit?.throughputWiringByTier?.()
      },
      {
        name: "audit.throughputWiringByAvailability",
        layer: "query",
        description: "Wiring coverage broken down by availability (round/scene/raid).",
        args: { type: "object" },
        returns: { type: "object", properties: { ts: S_TS, byAvail: S_OBJ } },
        permissions: ["any"],
        sideEffects: { audit: false },
        handler: async () => agent.audit?.throughputWiringByAvailability?.()
      },
      {
        name: "audit.throughputWiringByRaidType",
        layer: "query",
        description: "Wiring coverage broken down by raid type.",
        args: { type: "object" },
        returns: { type: "object", properties: { ts: S_TS, byRaidType: S_OBJ } },
        permissions: ["any"],
        sideEffects: { audit: false },
        handler: async () => agent.audit?.throughputWiringByRaidType?.()
      },
      {
        name: "audit.intentTypes",
        layer: "query",
        description: "Enumerate intent effect types observed across the maneuver registry.",
        args: { type: "object" },
        returns: S_OBJ,
        permissions: ["any"],
        sideEffects: { audit: false },
        handler: async () => agent.audit?.intentTypes?.()
      },
      {
        name: "observation.snapshot",
        layer: "query",
        description: "Full observation context for a faction — tracks, territory, war history, advisor info.",
        args: {
          type: "object",
          required: ["factionId"],
          properties: { factionId: S_FACTION_ID, includeWarLogs: S_BOOL }
        },
        returns: {
          type: "object",
          properties: {
            ok: S_BOOL, ts: S_TS,
            faction: S_OBJ, observedCapacity: S_OBJ,
            contextHexes: S_OBJ, contextFactions: S_OBJ,
            warHistory: S_OBJ, advisorInfo: S_OBJ
          }
        },
        permissions: ["any"],
        sideEffects: { audit: false },
        handler: async ({ factionId, ...opts }) => agent.getObservationSnapshot(factionId, opts)
      },
      {
        name: "strategic.legalActions",
        layer: "query",
        description: "List strategic actions a faction can attempt right now (raids, travels, infiltrations, courtly).",
        args: {
          type: "object",
          required: ["factionId"],
          properties: { factionId: S_FACTION_ID, obs: S_OBJ }
        },
        returns: {
          type: "object",
          properties: {
            ok: S_BOOL, ts: S_TS, factionId: S_FACTION_ID,
            actions: { type: "array", items: S_OBJ }
          }
        },
        permissions: ["any"],
        sideEffects: { audit: false },
        handler: async ({ factionId, obs }) => agent.listLegalStrategicActions(factionId, obs)
      },
      {
        name: "validate.maneuver",
        layer: "query",
        description: "Check maneuver legality (cost, availability, tier). Returns failure reasons if illegal.",
        args: {
          type: "object",
          required: ["maneuverKey"],
          properties: {
            maneuverKey: S_MANEUVER_KEY,
            attackerFactionId: S_FACTION_ID,
            defenderFactionId: S_FACTION_ID,
            outcomeTier: S_OUTCOME_TIER
          }
        },
        returns: {
          type: "object",
          properties: { ok: S_BOOL, ts: S_TS, maneuverKey: S_MANEUVER_KEY, failures: { type: "array" }, sim: S_OBJ }
        },
        permissions: ["any"],
        sideEffects: { audit: false },
        handler: async (args) => agent.validate?.maneuver?.(args)
      },

      // ============================================================
      // SIMULATIONS (Layer 2) — dry-run, no commit
      // ============================================================
      {
        name: "travel.estimate",
        layer: "simulation",
        description: "Estimate a faction travel from one hex to another (dry-run, no commit).",
        args: {
          type: "object",
          required: ["factionId"],
          properties: {
            factionId: S_FACTION_ID,
            hexFromUuid: S_HEX_UUID,
            hexToUuid: S_HEX_UUID
          }
        },
        returns: S_OBJ,
        permissions: ["any"],
        sideEffects: { audit: false },
        handler: async (args) => agent.estimateTravel(args)
      },
      {
        name: "raid.estimate",
        layer: "simulation",
        description: "Estimate a raid by attacker/defender (dry-run, no commit).",
        args: {
          type: "object",
          required: ["attackerFactionId"],
          properties: {
            attackerFactionId: S_FACTION_ID,
            defenderFactionId: S_FACTION_ID,
            defenderHexUuid: S_HEX_UUID,
            raidType: S_RAID_TYPE
          }
        },
        returns: S_OBJ,
        permissions: ["any"],
        sideEffects: { audit: false },
        handler: async (args) => agent.estimateRaid(args)
      },
      {
        name: "candidates.score",
        layer: "simulation",
        description: "Score an array of action candidates against a faction's situation.",
        args: {
          type: "object",
          required: ["candidates"],
          properties: {
            factionId: S_FACTION_ID,
            candidates: { type: "array", items: S_OBJ }
          }
        },
        returns: S_OBJ,
        permissions: ["any"],
        sideEffects: { audit: false },
        handler: async (args) => agent.scoreCandidates(args)
      },
      {
        name: "strategic.buildCandidates",
        layer: "simulation",
        description: "Build the full set of strategic action candidates a faction could attempt.",
        args: { type: "object", required: ["factionId"], properties: { factionId: S_FACTION_ID } },
        returns: S_OBJ,
        permissions: ["any"],
        sideEffects: { audit: false },
        handler: async (args) => agent.buildStrategicCandidates(args)
      },
      {
        name: "travel.buildCandidates",
        layer: "simulation",
        description: "Build candidate travel actions for a faction.",
        args: { type: "object", required: ["factionId"], properties: { factionId: S_FACTION_ID } },
        returns: S_OBJ,
        permissions: ["any"],
        sideEffects: { audit: false },
        handler: async (args) => agent.buildTravelCandidates(args)
      },
      {
        name: "raid.buildCandidates",
        layer: "simulation",
        description: "Build candidate raid actions for a faction.",
        args: { type: "object", required: ["factionId"], properties: { factionId: S_FACTION_ID } },
        returns: S_OBJ,
        permissions: ["any"],
        sideEffects: { audit: false },
        handler: async (args) => agent.buildRaidCandidates(args)
      },
      {
        name: "strategic.recommendNext",
        layer: "simulation",
        description: "Score + rank candidates and return recommended next actions for a faction. Phase 2 Mal/Advisor voices consume this as structured input.",
        args: {
          type: "object",
          required: ["factionId"],
          properties: {
            factionId: S_FACTION_ID,
            n: { type: "integer", minimum: 1, maximum: 50, description: "Top-N to return" }
          }
        },
        returns: S_OBJ,
        permissions: ["any"],
        sideEffects: { audit: false },
        handler: async (args) => agent.recommendNextActions(args)
      },
      {
        name: "simulate.maneuver",
        layer: "simulation",
        description: "Dry-run a single maneuver intent. No execution, no commit, no OP spend.",
        args: {
          type: "object",
          required: ["maneuverKey"],
          properties: {
            maneuverKey: S_MANEUVER_KEY,
            attackerFactionId: S_FACTION_ID,
            defenderFactionId: S_FACTION_ID,
            outcomeTier: S_OUTCOME_TIER,
            raidType: S_RAID_TYPE
          }
        },
        returns: {
          type: "object",
          properties: {
            ok: S_BOOL, ts: S_TS,
            request: S_OBJ, declared: S_OBJ,
            previewWorldEffects: S_OBJ, warnings: { type: "array" }
          }
        },
        permissions: ["any"],
        sideEffects: { audit: false },
        handler: async (args) => agent.simulate?.maneuver?.(args)
      },

      // ============================================================
      // GM-ONLY QUERIES — advisor surfaces (Phase 2 LLM inputs)
      // ============================================================
      {
        name: "gm.inferFactionId",
        layer: "query",
        description: "Infer a likely faction id from the current GM context.",
        args: { type: "object", properties: { userOrGMContext: S_OBJ } },
        returns: S_OBJ,
        permissions: ["gm"],
        sideEffects: { audit: false },
        handler: async (args) => agent.gm?.inferFactionId?.(args)
      },
      {
        name: "gm.getWorldSignals",
        layer: "query",
        description: "Collect canon-grounded world signals for GM advisor reasoning.",
        args: { type: "object" },
        returns: S_OBJ,
        permissions: ["gm"],
        sideEffects: { audit: false },
        handler: async () => agent.gm?.getWorldSignals?.()
      },
      {
        name: "gm.recommendWorldSignals",
        layer: "query",
        description: "Score world signals and return recommended GM-facing observations.",
        args: { type: "object" },
        returns: S_OBJ,
        permissions: ["gm"],
        sideEffects: { audit: false },
        handler: async () => agent.gm?.recommendWorldSignals?.()
      },
      {
        name: "gm.computeAdvisorTableTier",
        layer: "query",
        description: "Compute the appropriate advisor table tier for the current world state.",
        args: { type: "object", properties: { observation: S_OBJ } },
        returns: S_OBJ,
        permissions: ["gm"],
        sideEffects: { audit: false },
        handler: async (args) => agent.gm?.computeAdvisorTableTier?.(args)
      },
      {
        name: "gm.suggestCampaignBeats",
        layer: "query",
        description: "Suggest canon-grounded campaign beats for GM consideration, given an observation snapshot. Phase 2 Mal/Advisor voices consume as structured LLM input.",
        args: {
          type: "object",
          required: ["observation"],
          properties: {
            observation:     S_OBJ,
            detectors:       S_OBJ,
            recommendations: { type: "array", items: S_OBJ },
            opts:            S_OBJ
          }
        },
        returns: S_OBJ,
        permissions: ["gm"],
        sideEffects: { audit: false },
        handler: async ({ observation, detectors, recommendations, opts } = {}) =>
          agent.gm?.resolveCampaignBeatSuggestions?.(observation, detectors, recommendations, opts)
      },
      {
        name: "gm.suggestCampaignTables",
        layer: "query",
        description: "Suggest canon-grounded campaign tables for the GM, given an observation snapshot. Phase 2 voices consume as LLM input.",
        args: {
          type: "object",
          required: ["observation"],
          properties: {
            observation:     S_OBJ,
            detectors:       S_OBJ,
            recommendations: { type: "array", items: S_OBJ },
            opts:            S_OBJ
          }
        },
        returns: S_OBJ,
        permissions: ["gm"],
        sideEffects: { audit: false },
        handler: async ({ observation, detectors, recommendations, opts } = {}) =>
          agent.gm?.resolveCampaignTableSuggestions?.(observation, detectors, recommendations, opts)
      }
    ];
  }

  // ----- Register all verbs -----
  function _registerAll() {
    try {
      const agent = globalThis.game?.bbttcc?.api?.agent;
      if (!agent?.registerVerb) {
        warn("Registry not available — cannot register migration schemas.");
        return;
      }

      const specs = _verbs(agent);
      let ok = 0, fail = 0;
      for (const spec of specs) {
        try {
          agent.registerVerb(spec);
          ok++;
        } catch (e) {
          warn(`Failed to register '${spec?.name}':`, e?.message || e);
          fail++;
        }
      }
      log(`Registered ${ok} verb(s); ${fail} failure(s). Total in registry: ${agent._registrySize}.`);
    } catch (e) {
      warn("Migration failed:", e?.message || e);
    }
  }

  Hooks.once("ready", _registerAll);
  if (globalThis.game?.ready) _registerAll();
})();

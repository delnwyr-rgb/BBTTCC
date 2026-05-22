/* agent-action-verbs.js
 * BBTTCC Agent API — Phase 1 §7.3
 *
 * Nine pure-config Action (mutating, Layer 3) verbs wrapping
 * implementations scattered across bbttcc-core, bbttcc-factions,
 * bbttcc-territory, and the fourththing system. Each:
 *
 *   - Requires `gm` permission (default; tighten in caller-specific
 *     handlers where owner-level granularity is needed later)
 *   - Declares sideEffects accurately (sockets/hooks/audit)
 *   - Returns the standard `{ ok, changed?, ... }` envelope from the
 *     underlying audit-trailed implementation
 *   - Gates UNAVAILABLE underlying APIs with a structured error rather
 *     than throwing — so an external agent can recover cleanly
 *
 * Verbs:
 *   world.setState                         (wraps game.bbttcc.api.gm.setWorld)
 *   faction.setMorale, faction.bumpMorale  (wraps game.bbttcc.api.factions.*)
 *   faction.stockpile.deposit / withdraw / transfer
 *                                           (wraps game.bbttcc.api.factions.stockpile.*)
 *   manifestation.applyDamage              (wraps game.fourththing.rolls._applyDamageToActor)
 *   territory.deployHolding, territory.recallHolding
 *                                           (wraps game.bbttcc.api.territory.holdings.*)
 *
 * Loads AFTER agent-registry.js (so registerVerb exists). Handler
 * closures resolve their target API at INVOKE time, not register time —
 * so it's safe even when an underlying module is later in load order.
 *
 * Spec: modules/bbttcc-raid/AGENT_API_SPEC.md §7.3
 */

(function () {
  "use strict";

  const TAG  = "[bbttcc-agent-actions]";
  const log  = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);

  // ----- Sub-schemas -----
  const S_FACTION_ID = { type: "string", minLength: 1, description: "Faction actor UUID or short id" };
  const S_HEX_UUID   = { type: "string", minLength: 1, description: "Hex UUID" };
  const S_ACTOR_UUID = { type: "string", minLength: 1, description: "Foundry actor UUID (e.g. 'Actor.xxx' or scene-token form)" };
  const S_BOOL       = { type: "boolean" };
  const S_OBJ        = { type: "object" };
  const S_NUM        = { type: "number" };
  const S_STR        = { type: "string" };

  const S_STD_RETURN = {
    type: "object",
    properties: {
      ok: S_BOOL,
      changed: { type: "array", items: { type: "string" }, description: "Paths that were mutated" }
    }
  };

  // ----- Helpers -----
  function _resolveFn(dottedPath) {
    const parts = String(dottedPath || "").split(".");
    let obj = globalThis;
    for (const p of parts) {
      obj = obj?.[p];
      if (obj == null) return null;
    }
    return typeof obj === "function" ? obj : null;
  }

  function _unavailable(message) {
    return { ok: false, error: "API_UNAVAILABLE", message };
  }

  // ----- Verb specs -----
  function _verbs() {
    return [
      // ====================== world.* ======================
      {
        name: "world.setState",
        layer: "action",
        description: "Set world-level state (turn number, world.darkness, etc.) via the audit-trailed GM API. Allowlist-validated by bbttcc-core.",
        args: {
          type: "object",
          required: ["patch"],
          properties: {
            patch:  { type: "object", description: "Allowlisted shape: { turn: { number? }, world: { darkness? } }" },
            note:   { ...S_STR, description: "Audit log note" },
            silent: { ...S_BOOL, description: "Suppress chat broadcast" }
          }
        },
        returns: { type: "object", properties: { ok: S_BOOL, changed: { type: "array", items: S_STR }, state: S_OBJ } },
        permissions: ["gm"],
        sideEffects: { audit: true, hooks: ["bbttcc:world:stateChanged"] },
        handler: async (args) => {
          const fn = _resolveFn("game.bbttcc.api.gm.setWorld");
          if (!fn) return _unavailable("game.bbttcc.api.gm.setWorld not installed");
          return await fn(args);
        }
      },

      // ====================== faction meters ======================
      {
        name: "faction.setMorale",
        layer: "action",
        description: "Set a faction's morale track to an absolute value.",
        args: {
          type: "object",
          required: ["factionId", "value"],
          properties: { factionId: S_FACTION_ID, value: S_NUM }
        },
        returns: S_STD_RETURN,
        permissions: ["gm"],
        sideEffects: { audit: true, hooks: ["bbttcc:faction:moraleChanged"] },
        handler: async (args) => {
          const fn = _resolveFn("game.bbttcc.api.factions.setMorale");
          if (!fn) return _unavailable("game.bbttcc.api.factions.setMorale not installed");
          return await fn(args);
        }
      },
      {
        name: "faction.bumpMorale",
        layer: "action",
        description: "Adjust a faction's morale track by a signed delta.",
        args: {
          type: "object",
          required: ["factionId", "delta"],
          properties: { factionId: S_FACTION_ID, delta: S_NUM }
        },
        returns: S_STD_RETURN,
        permissions: ["gm"],
        sideEffects: { audit: true, hooks: ["bbttcc:faction:moraleChanged"] },
        handler: async (args) => {
          const fn = _resolveFn("game.bbttcc.api.factions.bumpMorale");
          if (!fn) return _unavailable("game.bbttcc.api.factions.bumpMorale not installed");
          return await fn(args);
        }
      },

      // ====================== faction stockpile ======================
      {
        name: "faction.stockpile.deposit",
        layer: "action",
        description: "Deposit qty of (category, key) into a faction's stockpile.",
        args: {
          type: "object",
          required: ["factionId", "category", "key", "qty"],
          properties: {
            factionId: S_FACTION_ID,
            category:  { type: "string", enum: ["materials", "currencies"] },
            key:       { ...S_STR, minLength: 1 },
            qty:       { type: "number", minimum: 0 }
          }
        },
        returns: S_STD_RETURN,
        permissions: ["gm"],
        sideEffects: { audit: true, hooks: ["bbttcc:faction:stockpileChanged"] },
        handler: async (args) => {
          const fn = _resolveFn("game.bbttcc.api.factions.stockpile.deposit");
          if (!fn) return _unavailable("game.bbttcc.api.factions.stockpile.deposit not installed");
          return await fn(args);
        }
      },
      {
        name: "faction.stockpile.withdraw",
        layer: "action",
        description: "Withdraw qty of (category, key) from a faction's stockpile.",
        args: {
          type: "object",
          required: ["factionId", "category", "key", "qty"],
          properties: {
            factionId: S_FACTION_ID,
            category:  { type: "string", enum: ["materials", "currencies"] },
            key:       { ...S_STR, minLength: 1 },
            qty:       { type: "number", minimum: 0 }
          }
        },
        returns: S_STD_RETURN,
        permissions: ["gm"],
        sideEffects: { audit: true, hooks: ["bbttcc:faction:stockpileChanged"] },
        handler: async (args) => {
          const fn = _resolveFn("game.bbttcc.api.factions.stockpile.withdraw");
          if (!fn) return _unavailable("game.bbttcc.api.factions.stockpile.withdraw not installed");
          return await fn(args);
        }
      },
      {
        name: "faction.stockpile.transfer",
        layer: "action",
        description: "Transfer qty of (category, key) from one faction's stockpile to another.",
        args: {
          type: "object",
          required: ["fromFactionId", "toFactionId", "category", "key", "qty"],
          properties: {
            fromFactionId: S_FACTION_ID,
            toFactionId:   S_FACTION_ID,
            category:      { type: "string", enum: ["materials", "currencies"] },
            key:           { ...S_STR, minLength: 1 },
            qty:           { type: "number", minimum: 0 }
          }
        },
        returns: S_STD_RETURN,
        permissions: ["gm"],
        sideEffects: { audit: true, hooks: ["bbttcc:faction:stockpileChanged"] },
        handler: async (args) => {
          const fn = _resolveFn("game.bbttcc.api.factions.stockpile.transfer");
          if (!fn) return _unavailable("game.bbttcc.api.factions.stockpile.transfer not installed");
          return await fn(args);
        }
      },

      // ====================== manifestation.applyDamage ======================
      {
        name: "manifestation.applyDamage",
        layer: "action",
        description: "Apply damage to a target actor via the canonical fourththing damage path (cascading, resistances, state triggers, GM-relay for non-owner targets).",
        args: {
          type: "object",
          required: ["targetActorUuid", "amount"],
          properties: {
            targetActorUuid: S_ACTOR_UUID,
            amount:     { type: ["number", "string"], description: "Numeric or formula string (e.g. '2d6+3')" },
            damageType: { ...S_STR, description: "Canonical FT.DAMAGE_TYPES key" },
            track:      { ...S_STR, description: "Damage track (defaults to integrity for rigs/bosses, hp otherwise)" },
            origin:     { ...S_STR, description: "Audit string describing source" },
            intent:     { ...S_STR, description: "Caller intent label (default 'agent')" }
          }
        },
        returns: {
          type: "object",
          properties: { ok: S_BOOL, desc: S_STR, oldVal: S_NUM, newVal: S_NUM, applied: S_NUM }
        },
        permissions: ["gm"],
        sideEffects: { audit: true, sockets: ["fourththingDamageRelay"], hooks: ["bbttcc:damage:applied"] },
        handler: async ({ targetActorUuid, amount, damageType, track, origin, intent }) => {
          const fn = _resolveFn("game.fourththing.rolls._applyDamageToActor");
          if (!fn) return _unavailable("game.fourththing.rolls._applyDamageToActor not installed");
          let actor;
          try {
            actor = (typeof globalThis.fromUuid === "function") ? await globalThis.fromUuid(targetActorUuid) : null;
          } catch (e) {
            return { ok: false, error: "ACTOR_NOT_FOUND", message: `Could not resolve uuid: ${e?.message || e}` };
          }
          if (!actor) return { ok: false, error: "ACTOR_NOT_FOUND", message: `No actor at uuid '${targetActorUuid}'` };
          return await fn(actor, amount, {
            damageType, track,
            origin: origin || "agent",
            intent: intent || "agent"
          });
        }
      },

      // ====================== territory.* ======================
      {
        name: "territory.deployHolding",
        layer: "action",
        description: "Deploy a stationed rig/boss/facility from a hex's Holdings onto the bound battle scene as an actorLink token.",
        args: {
          type: "object",
          required: ["hexUuid", "actorId", "kind"],
          properties: {
            hexUuid: S_HEX_UUID,
            actorId: { ...S_STR, minLength: 1, description: "Actor id to deploy" },
            kind:    { type: "string", enum: ["rig", "boss", "facility"] }
          }
        },
        returns: { type: "object", properties: { ok: S_BOOL, tokenId: S_STR } },
        permissions: ["gm"],
        sideEffects: { audit: true, hooks: ["bbttcc:territory:holdingDeployed"] },
        handler: async (args) => {
          const fn = _resolveFn("game.bbttcc.api.territory.holdings.deployToScene");
          if (!fn) return _unavailable("game.bbttcc.api.territory.holdings.deployToScene not installed");
          return await fn(args);
        }
      },
      {
        name: "territory.recallHolding",
        layer: "action",
        description: "Recall a deployed Holding token from the scene back to its hex.",
        args: {
          type: "object",
          required: ["hexUuid", "actorId", "kind"],
          properties: {
            hexUuid: S_HEX_UUID,
            actorId: { ...S_STR, minLength: 1, description: "Actor id to recall" },
            kind:    { type: "string", enum: ["rig", "boss", "facility"] }
          }
        },
        returns: S_STD_RETURN,
        permissions: ["gm"],
        sideEffects: { audit: true, hooks: ["bbttcc:territory:holdingRecalled"] },
        handler: async (args) => {
          const fn = _resolveFn("game.bbttcc.api.territory.holdings.recallFromScene");
          if (!fn) return _unavailable("game.bbttcc.api.territory.holdings.recallFromScene not installed");
          return await fn(args);
        }
      }
    ];
  }

  // ----- Register all -----
  function _registerAll() {
    try {
      const agent = globalThis.game?.bbttcc?.api?.agent;
      if (!agent?.registerVerb) {
        warn("Registry not available — cannot register action verbs.");
        return;
      }
      const specs = _verbs();
      let ok = 0, fail = 0;
      for (const spec of specs) {
        try { agent.registerVerb(spec); ok++; }
        catch (e) { warn(`Failed to register '${spec?.name}':`, e?.message || e); fail++; }
      }
      log(`Registered ${ok} action verb(s); ${fail} failure(s). Total in registry: ${agent._registrySize}.`);
    } catch (e) {
      warn("Action verb registration failed:", e?.message || e);
    }
  }

  Hooks.once("ready", _registerAll);
  if (globalThis.game?.ready) _registerAll();
})();

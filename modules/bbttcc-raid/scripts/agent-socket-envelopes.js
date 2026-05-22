/* agent-socket-envelopes.js
 * BBTTCC Agent API — Phase 1 §7.4
 *
 * Declarative schemas for the inter-client socket message types currently
 * in use across bbttcc-raid:
 *
 *   raidSession    — player→GM, Player Commit Staging persistence relay
 *   raidCinematic  — GM→all,    end-of-raid VFX broadcast
 *   raidPill       — any→all,   lightweight status pill (e.g. "Round Added")
 *   courtlyHook    — GM→all,    Courtly Intrigue engine hook relay
 *   infilHook      — GM→all,    Infiltration engine hook relay
 *
 * External agents and Phase 2 consumers introspect via
 * `game.bbttcc.api.agent.socketEnvelopes()`. Future emitters can pre-validate
 * via `agent.validateSocketEnvelope(type, payload)` before
 * `game.socket.emit("module.bbttcc-raid", payload)` to catch shape drift at
 * the source.
 *
 * Loads AFTER agent-registry.js.
 *
 * Spec: modules/bbttcc-raid/AGENT_API_SPEC.md §7.4, §11
 */

(function () {
  "use strict";

  const TAG  = "[bbttcc-agent-sockets]";
  const log  = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);

  const ENVELOPES = [
    {
      type: "raidSession",
      schema: {
        type: "object",
        required: ["t", "attackerId", "payload"],
        properties: {
          t:          { type: "string", enum: ["raidSession"] },
          attackerId: { type: "string", minLength: 1, description: "Attacker faction actor id" },
          payload:    { type: "object", description: "Actor flag update for bbttcc-raid/raidSession" }
        },
        description: "Player Commit Staging relay — players send writes; GM persists."
      }
    },
    {
      type: "raidCinematic",
      schema: {
        type: "object",
        required: ["t", "outcome", "raidType"],
        properties: {
          t:            { type: "string", enum: ["raidCinematic"] },
          outcome:      { type: "string", description: "End-of-raid outcome label" },
          raidType:     { type: "string", description: "Normalized raid type" },
          attackerKeys: { type: "array", items: { type: "string" }, description: "Maneuver keys used by attacker" },
          defenderKeys: { type: "array", items: { type: "string" }, description: "Maneuver keys used by defender" }
        },
        description: "Broadcast end-of-raid VFX to all clients. Relays to fx.playKey() per maneuver."
      }
    },
    {
      type: "raidPill",
      schema: {
        type: "object",
        required: ["t", "text"],
        properties: {
          t:    { type: "string", enum: ["raidPill"] },
          text: { type: "string", minLength: 1, description: "Pill display text (e.g. 'Round Added')" }
        },
        description: "Lightweight status pill broadcast to all clients."
      }
    },
    {
      type: "courtlyHook",
      schema: {
        type: "object",
        required: ["t", "hook"],
        properties: {
          t:       { type: "string", enum: ["courtlyHook"] },
          hook:    { type: "string", minLength: 1, description: "Hook name (e.g. 'bbttcc:courtly:scarAccrued')" },
          payload: { type: "object", description: "Hook payload — shape varies by hook" }
        },
        description: "Courtly Intrigue VFX/state relay branch — propagates engine hooks to non-GM clients."
      }
    },
    {
      type: "infilHook",
      schema: {
        type: "object",
        required: ["t", "hook"],
        properties: {
          t:       { type: "string", enum: ["infilHook"] },
          hook:    { type: "string", minLength: 1, description: "Hook name (e.g. 'bbttcc:infiltration:alarmChanged')" },
          payload: { type: "object", description: "Hook payload — shape varies by hook" }
        },
        description: "Infiltration engine VFX/state relay branch — propagates engine hooks to non-GM clients."
      }
    }
  ];

  function _registerAll() {
    try {
      const agent = globalThis.game?.bbttcc?.api?.agent;
      if (!agent?.registerSocketEnvelope) {
        warn("Registry's socket envelope API not available.");
        return;
      }
      let ok = 0, fail = 0;
      for (const { type, schema } of ENVELOPES) {
        try { agent.registerSocketEnvelope(type, schema); ok++; }
        catch (e) { warn(`Failed to register socket envelope '${type}':`, e?.message || e); fail++; }
      }
      log(`Registered ${ok} socket envelope(s); ${fail} failure(s).`);
    } catch (e) {
      warn("Socket envelope registration failed:", e?.message || e);
    }
  }

  Hooks.once("ready", _registerAll);
  if (globalThis.game?.ready) _registerAll();
})();

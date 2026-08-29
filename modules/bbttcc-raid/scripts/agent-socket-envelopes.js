/* agent-socket-envelopes.js
 * Bad Eden Agent API — Phase 1 §7.4
 *
 * Declarative schemas for the inter-client socket message types currently
 * in use across bbttcc-raid:
 *
 *   raidSession        — player→GM, Player Commit Staging persistence relay
 *   raidCinematic      — GM→all,    end-of-raid VFX broadcast
 *   raidPill           — any→all,   FX pill relay (fx.playKey by key/label)
 *   courtlyHook        — GM→all,    Courtly Intrigue engine hook relay
 *   infilHook          — GM→all,    Infiltration engine hook relay
 *   raidVfx            — any→all,   maneuver-fire VFX relay
 *   courtlyPlaySecret  — player→GM, courtly secret play relay (GM owns _lastCourtly)
 *   siegeRequest       — player→GM, siege action relay (join/muster/recall/…)
 *   siegeRequestResult — GM→player, ack/refusal for a siegeRequest
 *   siegeSceneSwap     — GM→all,    follow-the-GM scene view swap
 *   siegeHook          — GM→all,    siege engine hook relay
 *
 * (Full declaration coverage restored 2026-08-28 — atlas 🔴 #6: five handled
 * types were undeclared and raidPill's schema had drifted from its handler.)
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
        required: ["t"],
        properties: {
          t:        { type: "string", enum: ["raidPill"] },
          key:      { type: "string", description: "FX key for fx.playKey (default 'raid_outcome')" },
          label:    { type: "string", description: "Pill display label" },
          raidType: { type: "string", description: "Normalized raid type for FX toning" }
        },
        description: "FX pill relay — receiver calls fx.playKey(key, {label, raidType}). (Schema corrected 2026-08-28: handler never read 'text'.)"
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
    },
    {
      type: "raidVfx",
      schema: {
        type: "object",
        required: ["t"],
        properties: {
          t:          { type: "string", enum: ["raidVfx"] },
          key:        { type: "string", description: "FX key for _bbttccFxPlay" },
          side:       { type: "string", description: "attacker|defender — drives _rcPlayManFireVfx" },
          attackerId: { type: "string", description: "Attacker faction actor id" },
          defenderId: { type: "string", description: "Defender actor id" }
        },
        description: "Maneuver-fire VFX relay — receivers replay side/attacker/defender canvas FX."
      }
    },
    {
      type: "courtlyPlaySecret",
      schema: {
        type: "object",
        required: ["t", "actorId", "itemId"],
        properties: {
          t:       { type: "string", enum: ["courtlyPlaySecret"] },
          actorId: { type: "string", minLength: 1, description: "Holding faction actor id" },
          itemId:  { type: "string", minLength: 1, description: "Secret item id on that faction" },
          opts:    { type: "object", description: "Pass-through options for courtlySecrets.playSecret" }
        },
        description: "Player→GM secret-play relay — _lastCourtly lives only on the GM client; active-GM guard prevents multi-GM double-play."
      }
    },
    {
      type: "siegeRequest",
      schema: {
        type: "object",
        required: ["t", "action", "hexUuid", "factionId", "userId"],
        properties: {
          t:         { type: "string", enum: ["siegeRequest"] },
          action:    { type: "string", enum: ["join", "muster", "recall", "maneuver", "raise"], description: "Requested siege action" },
          hexUuid:   { type: "string", minLength: 1, description: "Besieged hex uuid" },
          factionId: { type: "string", minLength: 1, description: "Requesting faction actor id" },
          userId:    { type: "string", minLength: 1, description: "Requesting user id (routes the siegeRequestResult ack)" },
          payload:   { type: "object", description: "Action-specific extras (side, label, key, …)" }
        },
        description: "Player→GM siege action relay; GM executes against the siege API and acks with siegeRequestResult."
      }
    },
    {
      type: "siegeRequestResult",
      schema: {
        type: "object",
        required: ["t", "userId", "ok"],
        properties: {
          t:       { type: "string", enum: ["siegeRequestResult"] },
          userId:  { type: "string", minLength: 1, description: "Target user id — other clients ignore" },
          ok:      { type: "boolean", description: "Whether the request succeeded" },
          message: { type: "string", description: "Toast text (info on ok, warn on refusal)" }
        },
        description: "GM→player ack for a siegeRequest."
      }
    },
    {
      type: "siegeSceneSwap",
      schema: {
        type: "object",
        required: ["t", "sceneId"],
        properties: {
          t:       { type: "string", enum: ["siegeSceneSwap"] },
          sceneId: { type: "string", minLength: 1, description: "Scene id every client should view" }
        },
        description: "GM→all follow-me scene view swap (siege convene / breach scenes)."
      }
    },
    {
      type: "siegeHook",
      schema: {
        type: "object",
        required: ["t", "hook"],
        properties: {
          t:       { type: "string", enum: ["siegeHook"] },
          hook:    { type: "string", minLength: 1, description: "Hook name (e.g. 'bbttcc:siege:convene')" },
          payload: { type: "object", description: "Hook payload — shape varies by hook" }
        },
        description: "Siege engine VFX/state relay branch — propagates engine hooks to non-GM clients."
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

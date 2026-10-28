/* agent-action-verbs.js
 * Bad Eden Agent API — Phase 1 §7.3
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
 *   faction.setMorale, faction.bumpMorale  (wraps game.bbttcc.api.factions.* — RETIRED 2026-10-18 ruling 19: the API calls are tolerant no-ops)
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
        description: "RETIRED 2026-10-18 (ruling 19): faction Morale is no longer a game meter — this verb is a tolerant no-op.",
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
        description: "RETIRED 2026-10-18 (ruling 19): faction Morale is no longer a game meter — this verb is a tolerant no-op.",
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
        sideEffects: { audit: true, hooks: ["bbttcc:stockpile:changed"] },
        // There is no stockpile.deposit — the real API is stockpile.adjust(faction, matKey, delta).
        handler: async (args) => {
          const fn = _resolveFn("game.bbttcc.api.factions.stockpile.adjust");
          if (!fn) return _unavailable("game.bbttcc.api.factions.stockpile.adjust not installed");
          if (args.category !== "materials") return { ok: false, error: "UNSUPPORTED_CATEGORY", message: "only materials have a stockpile" };
          return await fn(args.factionId, String(args.key), +Math.floor(Number(args.qty) || 0));
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
        sideEffects: { audit: true, hooks: ["bbttcc:stockpile:changed"] },
        // There is no stockpile.withdraw — the real API is stockpile.adjust(faction, matKey, delta).
        handler: async (args) => {
          const fn = _resolveFn("game.bbttcc.api.factions.stockpile.adjust");
          if (!fn) return _unavailable("game.bbttcc.api.factions.stockpile.adjust not installed");
          if (args.category !== "materials") return { ok: false, error: "UNSUPPORTED_CATEGORY", message: "only materials have a stockpile" };
          return await fn(args.factionId, String(args.key), -Math.floor(Number(args.qty) || 0));
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
        sideEffects: { audit: true, hooks: ["bbttcc:stockpile:changed"] },
        // Transfer = withdraw what the sender actually holds, then deposit exactly that.
        handler: async (args) => {
          const sp = globalThis.game?.bbttcc?.api?.factions?.stockpile;
          if (typeof sp?.adjust !== "function" || typeof sp?.qty !== "function") return _unavailable("game.bbttcc.api.factions.stockpile.adjust not installed");
          if (args.category !== "materials") return { ok: false, error: "UNSUPPORTED_CATEGORY", message: "only materials have a stockpile" };
          const key = String(args.key);
          const from = game.actors?.get?.(String(args.fromFactionId).replace(/^Actor\./, ""));
          const to = game.actors?.get?.(String(args.toFactionId).replace(/^Actor\./, ""));
          if (!from || !to) return { ok: false, error: "FACTION_NOT_FOUND" };
          const n = Math.min(Math.floor(Number(args.qty) || 0), Number(sp.qty(from, key)) || 0);
          if (n <= 0) return { ok: false, error: "INSUFFICIENT_STOCK" };
          const out = await sp.adjust(from, key, -n);
          if (!out?.ok) return out;
          const inn = await sp.adjust(to, key, +n);
          return { ok: !!inn?.ok, moved: n, from: out, to: inn };
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
        sideEffects: { audit: true, sockets: [], hooks: ["bbttcc:rig:damaged", "bbttcc:boss:damaged"] },
        handler: async ({ targetActorUuid, amount, damageType, track, origin, intent }) => {
          const fn = _resolveFn("game.bbttcc.combat.applyDamage");
          if (!fn) return _unavailable("game.bbttcc.combat.applyDamage not installed");
          let actor;
          try {
            actor = (typeof globalThis.fromUuid === "function") ? await globalThis.fromUuid(targetActorUuid) : null;
          } catch (e) {
            return { ok: false, error: "ACTOR_NOT_FOUND", message: `Could not resolve uuid: ${e?.message || e}` };
          }
          if (!actor) return { ok: false, error: "ACTOR_NOT_FOUND", message: `No actor at uuid '${targetActorUuid}'` };
          // A formula string is rolled here — the damage path does Number(amount)||0, so "2d6+3" was 0 damage (2026-10-28)
          if (typeof amount === "string" && !Number.isFinite(Number(amount))) {
            try { amount = (await new Roll(amount).evaluate()).total; }
            catch (e) { return { ok: false, error: "BAD_FORMULA", message: `Could not roll '${amount}': ${e?.message || e}` }; }
            if (!Number.isFinite(Number(amount))) return { ok: false, error: "BAD_FORMULA", message: "Formula did not roll a number." };
          }
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
        description: "Deploy ALL of a hex's stationed Holdings (rigs/bosses/facilities) onto the bound battle scene as actorLink tokens. Already-deployed ones are skipped.",
        args: {
          type: "object",
          required: ["hexUuid"],   // #72 (2026-10-28): the holdings API deploys the whole hex — actorId/kind are optional checks, not filters
          properties: {
            hexUuid: S_HEX_UUID,
            actorId: { ...S_STR, minLength: 1, description: "Optional: refuse unless this actor is the hex's only Holding (deploy can't place one alone)" },
            kind:    { type: "string", enum: ["rig", "boss", "facility"], description: "Optional: refuse unless every Holding is this kind" }
          }
        },
        returns: { type: "object", properties: { ok: S_BOOL, tokenId: S_STR } },
        permissions: ["gm"],
        sideEffects: { audit: true, hooks: ["bbttcc:territory:holdingDeployed"] },
        handler: async (args) => {
          const fn = _resolveFn("game.bbttcc.api.territory.holdings.deployToScene");
          if (!fn) return _unavailable("game.bbttcc.api.territory.holdings.deployToScene not installed");
          // The holdings API takes the hex Drawing DOCUMENT and deploys ALL of its holdings — resolve the uuid first.
          const ref = await fromUuid(String(args.hexUuid || ""));
          const hexDoc = ref?.document ?? ref ?? null;
          if (!hexDoc) return { ok: false, error: "HEX_NOT_FOUND" };
          // #72 (2026-10-28): an actorId/kind the call can't honour is refused, not silently widened to every holding.
          if (args.actorId || args.kind) {
            const read = _resolveFn("game.bbttcc.api.territory.holdings.readHoldings");
            const rows = (read ? (read(hexDoc) || []) : []).filter(r => r && r.kind !== "missing" && r.actor);
            const aid = String(args.actorId || "").replace(/^Actor\./, "");
            const strays = rows.filter(r => (aid && String(r.actor.id) !== aid) || (args.kind && r.kind !== args.kind));
            if (!read || strays.length || (aid && !rows.some(r => String(r.actor.id) === aid))) {
              return { ok: false, error: "FILTER_UNSUPPORTED", message: `deployHolding places every Holding on the hex; it holds ${rows.map(r => r.actor.name).join(", ") || "none matching"}. Call without actorId/kind to deploy them all.` };
            }
          }
          return await fn(hexDoc, {});
        }
      },
      {
        name: "territory.recallHolding",
        layer: "action",
        description: "Recall deployed Holding tokens from the hex's battle scene. With actorId and/or kind, only those; without, all of the hex's.",
        args: {
          type: "object",
          required: ["hexUuid"],   // #72 (2026-10-28): actorId/kind now filter (they were ignored)
          properties: {
            hexUuid: S_HEX_UUID,
            actorId: { ...S_STR, minLength: 1, description: "Only this actor's token" },
            kind:    { type: "string", enum: ["rig", "boss", "facility"], description: "Only Holdings of this kind" }
          }
        },
        returns: S_STD_RETURN,
        permissions: ["gm"],
        sideEffects: { audit: true, hooks: ["bbttcc:territory:holdingRecalled"] },
        handler: async (args) => {
          const fn = _resolveFn("game.bbttcc.api.territory.holdings.recallFromScene");
          if (!fn) return _unavailable("game.bbttcc.api.territory.holdings.recallFromScene not installed");
          // The holdings API takes the hex Drawing DOCUMENT (and recalls ALL of its holdings) — resolve the uuid first.
          const ref = await fromUuid(String(args.hexUuid || ""));
          const hexDoc = ref?.document ?? ref ?? null;
          if (!hexDoc) return { ok: false, error: "HEX_NOT_FOUND" };
          if (!args.actorId && !args.kind) return await fn(hexDoc, {});
          // #72 (2026-10-28): filtered recall — same scene + deployment tag the holdings API uses.
          const resolveScene = _resolveFn("game.bbttcc.api.territory.holdings.resolveSceneForDeploy");
          const scene = resolveScene ? resolveScene(hexDoc) : null;
          if (!scene) return { ok: false, error: "no bound battle scene" };
          const aid = String(args.actorId || "").replace(/^Actor\./, "");
          const ids = (scene.tokens?.contents || []).filter(t => {
            const tag = t?.flags?.["bbttcc-territory"]?.holdingDeployment;
            return tag?.hexId === hexDoc.id && (!aid || String(tag.actorId) === aid) && (!args.kind || tag.kind === args.kind);
          }).map(t => t.id);
          if (!ids.length) return { ok: true, removed: 0 };
          try { await scene.deleteEmbeddedDocuments("Token", ids); }
          catch (e) { return { ok: false, error: "deleteEmbeddedDocuments failed", message: e?.message || String(e) }; }
          return { ok: true, removed: ids.length };
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

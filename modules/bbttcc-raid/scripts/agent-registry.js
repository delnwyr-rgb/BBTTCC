/* agent-registry.js
 * BBTTCC Agent API Registry — Phase 1 §7.1
 *
 * Schema-validated verb registry layered on top of game.bbttcc.api.agent.*.
 *
 * Public surface (installed at Hooks.once("ready") with install-twice pattern):
 *   game.bbttcc.api.agent.registerVerb(spec)   -> boolean
 *   game.bbttcc.api.agent.capabilities()       -> { ts, version, verbs, queries, simulations, actions, enums }
 *   game.bbttcc.api.agent.invoke(name, args)   -> Promise<result | { ok:false, error, ... }>
 *   game.bbttcc.api.agent.validateAgainstSchema(value, schema) -> { ok, errors }
 *
 * Verb spec shape:
 *   {
 *     name: "factions.setMorale",                           // dot-namespaced, unique
 *     layer: "query" | "simulation" | "action",             // safety/audit tier
 *     description: "Set a faction's morale value.",
 *     args:    JSONSchema object,                            // optional; validated on invoke
 *     returns: JSONSchema object,                            // optional; documentary
 *     permissions: ["gm"|"player"|"owner"|"any"],            // optional; default ["any"]
 *     sideEffects: { sockets: [...], hooks: [...], audit: bool },  // declared, not hidden
 *     handler: async (args) => result
 *   }
 *
 * Loads BEFORE bbttcc-agent-api.js in module.json so existing agent code
 * can registerVerb() against this registry as it migrates (§7.2).
 *
 * Telemetry: every invoke() emits a `bbttcc:agent:call` hook with
 *   { name, layer, ok, error?, durationMs, userId, userName, timestamp }.
 *
 * Spec: modules/bbttcc-raid/AGENT_API_SPEC.md §3-§5, §7.1
 */

(function () {
  "use strict";

  const TAG  = "[bbttcc-agent-registry]";
  const log  = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);

  const VERSION = "0.7.0";
  const LAYERS  = ["query", "simulation", "action"];
  const PERMS   = ["any", "player", "gm", "owner"];

  const REGISTRY = new Map();  // name -> normalized spec

  // ============================================================
  // Minimal JSON Schema (draft-2020-12 subset) validator.
  // Supports: type, required, properties, additionalProperties:false,
  //   enum, items, minimum, maximum, minLength, maxLength, minItems,
  //   maxItems, pattern, nullable (extension). `format` is informational.
  // Returns { ok, errors: [{ path, msg }] }.
  // ============================================================

  function _typeOf(v) {
    if (v === null) return "null";
    if (Array.isArray(v)) return "array";
    if (typeof v === "number" && Number.isInteger(v)) return "integer";
    return typeof v;
  }

  function _typeMatches(value, expected) {
    if (!expected) return true;
    const actual = _typeOf(value);
    if (expected === "number" && (actual === "number" || actual === "integer")) return true;
    return actual === expected;
  }

  function _validate(value, schema, path, errors) {
    if (!schema || typeof schema !== "object") return;
    if (value === null && schema.nullable === true) return;

    if (schema.type) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      if (!types.some(t => _typeMatches(value, t))) {
        errors.push({ path, msg: `expected type ${types.join("|")}, got ${_typeOf(value)}` });
        return; // further checks not meaningful
      }
    }

    if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
      errors.push({ path, msg: `value not in enum: ${JSON.stringify(schema.enum)}` });
    }

    const t = _typeOf(value);

    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (Array.isArray(schema.required)) {
        for (const k of schema.required) {
          if (!(k in value)) errors.push({ path: `${path}.${k}`, msg: "required property missing" });
        }
      }
      if (schema.properties) {
        for (const [k, sub] of Object.entries(schema.properties)) {
          if (k in value) _validate(value[k], sub, `${path}.${k}`, errors);
        }
        if (schema.additionalProperties === false) {
          for (const k of Object.keys(value)) {
            if (!(k in schema.properties)) {
              errors.push({ path: `${path}.${k}`, msg: "additional property not allowed" });
            }
          }
        }
      }
    }

    if (t === "array") {
      if (typeof schema.minItems === "number" && value.length < schema.minItems) {
        errors.push({ path, msg: `array length ${value.length} < minItems ${schema.minItems}` });
      }
      if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
        errors.push({ path, msg: `array length ${value.length} > maxItems ${schema.maxItems}` });
      }
      if (schema.items) {
        for (let i = 0; i < value.length; i++) {
          _validate(value[i], schema.items, `${path}[${i}]`, errors);
        }
      }
    }

    if (t === "string") {
      if (typeof schema.minLength === "number" && value.length < schema.minLength) {
        errors.push({ path, msg: `string length ${value.length} < minLength ${schema.minLength}` });
      }
      if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
        errors.push({ path, msg: `string length ${value.length} > maxLength ${schema.maxLength}` });
      }
      if (schema.pattern) {
        let re = null;
        try { re = new RegExp(schema.pattern); } catch (_) { /* lenient */ }
        if (re && !re.test(value)) {
          errors.push({ path, msg: `string does not match pattern ${schema.pattern}` });
        }
      }
    }

    if (t === "number" || t === "integer") {
      if (typeof schema.minimum === "number" && value < schema.minimum) {
        errors.push({ path, msg: `value ${value} < minimum ${schema.minimum}` });
      }
      if (typeof schema.maximum === "number" && value > schema.maximum) {
        errors.push({ path, msg: `value ${value} > maximum ${schema.maximum}` });
      }
    }
  }

  function validateAgainstSchema(value, schema) {
    const errors = [];
    _validate(value, schema, "$", errors);
    return { ok: errors.length === 0, errors };
  }

  // ============================================================
  // Verb meta-validation (the spec for verb specs)
  // ============================================================

  function _validateVerbSpec(spec) {
    const errs = [];
    if (!spec || typeof spec !== "object") { errs.push("spec must be an object"); return errs; }
    if (typeof spec.name !== "string" || !spec.name.length) errs.push("spec.name required (string)");
    if (typeof spec.description !== "string" || !spec.description.length) errs.push("spec.description required (string)");
    if (!LAYERS.includes(spec.layer)) errs.push(`spec.layer must be one of ${LAYERS.join("|")}`);
    if (typeof spec.handler !== "function") errs.push("spec.handler required (function)");
    if (spec.permissions != null) {
      if (!Array.isArray(spec.permissions)) {
        errs.push("spec.permissions must be an array");
      } else {
        for (const p of spec.permissions) {
          if (!PERMS.includes(p)) errs.push(`spec.permissions: unknown permission '${p}' (use one of ${PERMS.join("|")})`);
        }
      }
    }
    if (spec.args    != null && typeof spec.args    !== "object") errs.push("spec.args must be a JSON Schema object");
    if (spec.returns != null && typeof spec.returns !== "object") errs.push("spec.returns must be a JSON Schema object");
    if (spec.sideEffects != null && typeof spec.sideEffects !== "object") errs.push("spec.sideEffects must be an object");
    return errs;
  }

  // ============================================================
  // Permission check
  // GM and player are mutually exclusive (a user is one or the other).
  // "owner" is accepted at the registry level; handlers that need actor-
  // ownership context should enforce it themselves with the actor in args.
  // ============================================================

  function _checkPermissions(perms) {
    if (!perms || !perms.length || perms.includes("any")) return { ok: true };
    const isGM = !!(globalThis.game?.user?.isGM);
    if (perms.includes("gm")     &&  isGM) return { ok: true };
    if (perms.includes("player") && !isGM) return { ok: true };
    if (perms.includes("owner"))           return { ok: true };
    return { ok: false, error: `requires permission: ${perms.join("|")}` };
  }

  // ============================================================
  // Telemetry — every invoke emits `bbttcc:agent:call`.
  // Future Phase 2 consumers (Mal/Advisor voices, play-data capture) can
  // subscribe to this single hook without per-verb instrumentation.
  // ============================================================

  function _emitTelemetry(payload) {
    try {
      Hooks.callAll("bbttcc:agent:call", {
        ...payload,
        userId:    globalThis.game?.user?.id   || null,
        userName:  globalThis.game?.user?.name || null,
        timestamp: Date.now()
      });
    } catch (e) {
      warn("telemetry hook threw:", e?.message || e);
    }
  }

  // ============================================================
  // Public: registerVerb
  // ============================================================

  function registerVerb(spec) {
    const errs = _validateVerbSpec(spec);
    if (errs.length) {
      const msg = `Invalid verb spec '${spec?.name || "<anonymous>"}': ${errs.join("; ")}`;
      warn(msg);
      throw new Error(msg);
    }
    if (REGISTRY.has(spec.name)) {
      warn(`Verb '${spec.name}' already registered — overwriting.`);
    }
    REGISTRY.set(spec.name, {
      name:        spec.name,
      layer:       spec.layer,
      description: spec.description,
      args:        spec.args    || null,
      returns:     spec.returns || null,
      permissions: spec.permissions || ["any"],
      sideEffects: spec.sideEffects || {},
      handler:     spec.handler
    });
    return true;
  }

  // ============================================================
  // Public: capabilities — the introspection bootstrap.
  // ============================================================

  function capabilities() {
    const verbs       = [];
    const queries     = [];
    const simulations = [];
    const actions     = [];

    for (const spec of REGISTRY.values()) {
      verbs.push({
        name:        spec.name,
        layer:       spec.layer,
        description: spec.description,
        args:        spec.args,
        returns:     spec.returns,
        permissions: spec.permissions,
        sideEffects: spec.sideEffects
      });
      if      (spec.layer === "query")      queries.push(spec.name);
      else if (spec.layer === "simulation") simulations.push(spec.name);
      else if (spec.layer === "action")     actions.push(spec.name);
    }

    const FT = globalThis.FT || null;
    return {
      ts:      Date.now(),
      version: VERSION,
      verbs,
      queries,
      simulations,
      actions,
      sockets: Object.fromEntries(SOCKET_ENVELOPES),
      enums: {
        damageTypes:        FT?.DAMAGE_TYPES        || null,
        conditions:         FT?.CONDITIONS          || null,
        manifestationForms: FT?.MANIFESTATION_FORMS || null,
        raidTypes:    ["assault", "infiltration", "courtly"],
        opCategories: ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"]
      }
    };
  }

  // ============================================================
  // Public: invoke — the schema-validated gate.
  // ============================================================

  async function invoke(name, args = {}) {
    const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    const spec = REGISTRY.get(name);
    const dur  = () => ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - t0;

    if (!spec) {
      _emitTelemetry({ name, layer: null, ok: false, error: "UNKNOWN_VERB", durationMs: dur() });
      return { ok: false, error: "UNKNOWN_VERB", message: `No verb registered with name '${name}'` };
    }

    const perm = _checkPermissions(spec.permissions);
    if (!perm.ok) {
      _emitTelemetry({ name, layer: spec.layer, ok: false, error: "PERMISSION_DENIED", durationMs: dur() });
      return { ok: false, error: "PERMISSION_DENIED", message: perm.error };
    }

    if (spec.args) {
      const v = validateAgainstSchema(args, spec.args);
      if (!v.ok) {
        _emitTelemetry({ name, layer: spec.layer, ok: false, error: "INVALID_ARGS", durationMs: dur() });
        return { ok: false, error: "INVALID_ARGS", message: "Args failed schema validation", errors: v.errors };
      }
    }

    try {
      const result = await Promise.resolve(spec.handler(args));
      _emitTelemetry({ name, layer: spec.layer, ok: true, durationMs: dur() });
      return result;
    } catch (e) {
      _emitTelemetry({ name, layer: spec.layer, ok: false, error: "HANDLER_THREW", durationMs: dur() });
      return { ok: false, error: "HANDLER_THREW", message: e?.message || String(e) };
    }
  }

  // ============================================================
  // Public: Socket envelope registry (§7.4)
  //
  // Documents the typed shapes of inter-client socket messages so emitters
  // can pre-validate and consumers can introspect. Same JSON Schema subset
  // as verb args/returns. Schemas registered from agent-socket-envelopes.js.
  // ============================================================

  const SOCKET_ENVELOPES = new Map();  // type -> schema

  function registerSocketEnvelope(type, schema) {
    if (typeof type !== "string" || !type.length) {
      throw new Error("Socket envelope type required (string)");
    }
    if (!schema || typeof schema !== "object") {
      throw new Error(`Socket envelope schema required (JSON Schema object) for '${type}'`);
    }
    if (SOCKET_ENVELOPES.has(type)) {
      warn(`Socket envelope '${type}' already registered — overwriting.`);
    }
    SOCKET_ENVELOPES.set(type, schema);
    return true;
  }

  function socketEnvelopes() {
    return Object.fromEntries(SOCKET_ENVELOPES);
  }

  function validateSocketEnvelope(type, payload) {
    const schema = SOCKET_ENVELOPES.get(type);
    if (!schema) {
      return { ok: false, errors: [{ path: "$", msg: `Unknown socket envelope type '${type}'` }] };
    }
    return validateAgainstSchema(payload, schema);
  }

  // ============================================================
  // Install on game.bbttcc.api.agent.* (twice: ready hook + immediate
  // if game.ready, per the bbttcc-api-exposure-pattern feedback memory).
  // ============================================================

  function _install() {
    try {
      globalThis.game.bbttcc           ??= { api: {} };
      globalThis.game.bbttcc.api       ??= {};
      globalThis.game.bbttcc.api.agent ??= {};

      // Extend; do not clobber any existing verbs on the namespace.
      Object.assign(globalThis.game.bbttcc.api.agent, {
        registerVerb,
        capabilities,
        invoke,
        validateAgainstSchema,
        registerSocketEnvelope,
        socketEnvelopes,
        validateSocketEnvelope,
        get _registrySize()    { return REGISTRY.size; },
        get _registryVersion() { return VERSION; }
      });

      log(`Registry installed (v${VERSION}). Verbs registered: ${REGISTRY.size}.`);
    } catch (e) {
      warn("Failed to install registry:", e?.message || e);
    }
  }

  Hooks.once("ready", _install);
  if (globalThis.game?.ready) _install();
})();

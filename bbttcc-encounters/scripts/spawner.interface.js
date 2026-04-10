// bbttcc-encounters/scripts/spawner.interface.js
// Spawner interface for BBTTCC Encounter Engine.
// Provides:
//  - Concrete spawner(s) (currently: bandit_ambush_standard)
//  - Generic helpers for campaign-authored encounters (spawnAtCenter / spawnActors)
//
// NOTE: This file installs onto game.bbttcc.api.encounters._spawner on Foundry "ready".

(() => {
  const TAG = "[bbttcc-encounters/spawner]";
  const log  = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async function resolveActor(idOrUuid) {
    if (!idOrUuid) return null;
    try {
      if (typeof idOrUuid === "string" && (idOrUuid.startsWith("Actor.") || idOrUuid.startsWith("Compendium."))) {
        const doc = await fromUuid(idOrUuid);
        if (doc && doc instanceof Actor) return doc;
      }
      const byId = game.actors?.get?.(idOrUuid);
      if (byId) return byId;
      const byName = game.actors?.find?.(a => a.name === idOrUuid);
      if (byName) return byName;
    } catch (e) {
      warn("resolveActor error", idOrUuid, e);
    }
    return null;
  }

  function iterTokenDocs(scene) {
    // scene.tokens is a Collection<TokenDocument> in Foundry.
    const col = scene?.tokens;
    if (!col) return [];
    if (Array.isArray(col)) return col;
    if (Array.isArray(col.contents)) return col.contents;
    return Array.from(col.values?.() ?? []);
  }

  async function spawnTokens(scene, specs = []) {
    if (!scene || !specs.length) return [];

    const tokenData = [];

    for (const spec of specs) {
      const actor = await resolveActor(spec.actor);
      if (!actor) {
        warn("spawnTokens: actor not found", spec.actor);
        continue;
      }

      const x = Number(spec.x ?? 0);
      const y = Number(spec.y ?? 0);

      // Determine whether this actor exists as a World actor (preferred for actorId tokens)
      const worldActor = game.actors?.get?.(actor.id) || null;
      const isWorldActor = !!worldActor;

      // Build token base from prototype (inherits artwork/config)
      let tokenObj = null;

      try {
        if (typeof actor.getTokenDocument === "function") {
          const baseDoc = await actor.getTokenDocument({ x, y });
          if (baseDoc) tokenObj = baseDoc.toObject();
        }
      } catch (e) {
        warn("spawnTokens: getTokenDocument failed; falling back", e);
      }

      if (!tokenObj) {
        tokenObj = {
          name: actor.name,
          x, y,
          width: 1,
          height: 1
        };
      }

      // Strip ids/stats that can block creation
      try { delete tokenObj._id; } catch (_e) {}
      try { delete tokenObj._stats; } catch (_e) {}

      // If the actor is not a World actor (e.g., Compendium actor), we must embed actorData.
      if (isWorldActor) {
        tokenObj.actorId = actor.id;
      } else {
        // Do NOT set actorId; embed actorData instead.
        try { delete tokenObj.actorId; } catch (_e) {}
        try { delete tokenObj.actorLink; } catch (_e) {}
        tokenObj.actorLink = false;
        tokenObj.actorData = actor.toObject ? actor.toObject() : foundry.utils.deepClone(actor);
        // Ensure embedded actor has no _id so Foundry can generate synthetic ids safely.
        try { delete tokenObj.actorData._id; } catch (_e) {}
      }

      // Placement + overrides
      tokenObj.name = (spec.name ?? tokenObj.name ?? actor.name);
      tokenObj.x = x;
      tokenObj.y = y;
      tokenObj.width = Number(spec.width ?? tokenObj.width ?? 1);
      tokenObj.height = Number(spec.height ?? tokenObj.height ?? 1);
      tokenObj.hidden = (spec.hidden != null) ? !!spec.hidden : !!tokenObj.hidden;

      tokenObj.disposition = (spec.disposition != null)
        ? spec.disposition
        : (spec.role === "pc" ? CONST.TOKEN_DISPOSITIONS.FRIENDLY : CONST.TOKEN_DISPOSITIONS.HOSTILE);

      // Vision: v13 uses sight.enabled; older schemas used vision.
      if (spec.vision != null) {
        if (tokenObj.sight && typeof tokenObj.sight === "object") {
          tokenObj.sight.enabled = !!spec.vision;
        } else if ("vision" in tokenObj) {
          tokenObj.vision = !!spec.vision;
        }
      }

      tokenObj.rotation = Number(spec.rotation ?? tokenObj.rotation ?? 0);

      // Encounter flags
      tokenObj.flags = {
        ...(tokenObj.flags || {}),
        "bbttcc-encounters": {
          spawnedBy: spec.spawnedBy || "external",
          role: spec.role || "npc"
        }
      };

      tokenData.push(tokenObj);
    }

    if (!tokenData.length) return [];

    // Token creation requires sufficient permissions (GM on most worlds)
    try {
      const created = await scene.createEmbeddedDocuments("Token", tokenData);
      log("Spawned tokens", created);
      return created;
    } catch (e) {
      warn("spawnTokens error", e);
      // Extra debug: surface first payload keys so we can see schema mismatches quickly.
      try { warn("spawnTokens payload sample keys", Object.keys(tokenData[0] || {})); } catch (_e) {}
      return [];
    }
  }


  function hasSpawnedFlag(scene, spawnedByKey) {
    if (!scene || !spawnedByKey) return false;
    for (const doc of iterTokenDocs(scene)) {
      const flags = doc?.flags?.["bbttcc-encounters"];
      if (flags?.spawnedBy === spawnedByKey) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Generic spawners for campaign-authored encounters
  // ---------------------------------------------------------------------------

  /**
   * Spawn a list of actors in a ring near the scene center.
   * - Prevents duplicates by spawnedBy flag.
   */
  async function spawnAtCenter(scene, actorIdsOrUuids = [], opts = {}) {
    if (!scene) return [];
    const spawnedBy = opts.spawnedBy || "external";
    if (hasSpawnedFlag(scene, spawnedBy)) {
      log("spawnAtCenter: tokens already present; skipping respawn.", spawnedBy);
      return [];
    }

    const list = Array.isArray(actorIdsOrUuids) ? actorIdsOrUuids.filter(Boolean) : [];
    if (!list.length) return [];

    const width  = scene.width  || 4000;
    const height = scene.height || 3000;
    const grid   = scene.grid?.size || 100;

    const cx = Math.floor((width / 2) / grid) * grid;
    const cy = Math.floor((height / 2) / grid) * grid;

    const radius = (opts.radius ?? 1.5) * grid;

    const specs = list.map((id, idx) => {
      const angle = (Math.PI * 2 * idx) / Math.max(1, list.length);
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      return {
        actor: id,
        role: opts.role || "npc",
        spawnedBy,
        x: Math.floor(x / grid) * grid,
        y: Math.floor(y / grid) * grid,
        hidden: !!opts.hidden
      };
    });

    return await spawnTokens(scene, specs);
  }

  /**
   * Spawn tokens based on structured actor specs:
   * [{ actor, role, x, y, disposition, hidden, width, height, spawnedBy }, ...]
   * If x/y omitted, will fall back to center-ring placement.
   */
  async function spawnActors(scene, actorSpecs = [], opts = {}) {
    if (!scene) return [];
    const spawnedBy = opts.spawnedBy || "external";
    if (hasSpawnedFlag(scene, spawnedBy)) {
      log("spawnActors: tokens already present; skipping respawn.", spawnedBy);
      return [];
    }

    const list = Array.isArray(actorSpecs) ? actorSpecs.filter(Boolean) : [];
    if (!list.length) return [];

    // If caller provided raw strings, treat as actor IDs and use spawnAtCenter
    if (typeof list[0] === "string") {
      return spawnAtCenter(scene, list, { ...opts, spawnedBy });
    }

    // If any spec is missing x/y, we place them in a ring at center.
    const needPlacement = list.some(s => s?.x == null || s?.y == null);
    if (needPlacement) {
      const ids = list.map(s => s?.actor).filter(Boolean);
      const placed = await spawnAtCenter(scene, ids, { ...opts, spawnedBy, role: opts.role || "npc" });
      return placed;
    }

    const specs = list.map(s => ({ ...s, spawnedBy: s.spawnedBy || spawnedBy }));
    return spawnTokens(scene, specs);
  }

  // ---------------------------------------------------------------------------
  // Concrete spawner: Bandit Ambush
  // ---------------------------------------------------------------------------

  // Actor UUIDs (from your notes):
  // PCs:
  //   Avuncular Joans           - Actor.ILoYEVIIlwWhKgzr
  //   California Tennessee      - Actor.8e9SMQxmXEkkPUmb
  //   Ralph Maccio              - Actor.EYPbinzaIg2sVnWm
  //   Tannerito                 - Actor.v2wJelFtqNwldHyJ
  //
  // Bandits:
  //   Pherobandit               - Actor.sjXNLebcoITE0Zcr
  //   Theranya Volkstoten       - Actor.1oEJU5bQ6oO82iUw
  //   Sklar Bjornholt           - Actor.2Yr0IgjWiKmG1ZYg

  const PC_IDS = [
    "Actor.ILoYEVIIlwWhKgzr",
    "Actor.8e9SMQxmXEkkPUmb",
    "Actor.EYPbinzaIg2sVnWm",
    "Actor.v2wJelFtqNwldHyJ"
  ];

  const BANDIT_IDS = [
    "Actor.sjXNLebcoITE0Zcr",
    "Actor.1oEJU5bQ6oO82iUw",
    "Actor.2Yr0IgjWiKmG1ZYg"
  ];

  async function spawnBanditAmbush(ctx, scene, scenario, step) {
    if (!scene) return;

    const spawnedKey = "bandit_ambush_standard";

    // If we've already spawned this encounter on this scene, don't duplicate.
    if (hasSpawnedFlag(scene, spawnedKey)) {
      log("Bandit Ambush tokens already present; skipping respawn.");
      return;
    }

    const width  = scene.width  || 4000;
    const height = scene.height || 3000;
    const grid   = scene.grid?.size || 100;

    const centerX = width / 2;

    const pcY     = height - (3 * grid);
    const banditY = 2 * grid;

    const pcSpecs = PC_IDS.map((id, idx) => ({
      actor: id,
      role: "pc",
      spawnedBy: spawnedKey,
      disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
      x: centerX + (idx - (PC_IDS.length - 1) / 2) * (1.5 * grid),
      y: pcY
    }));

    const banditSpecs = BANDIT_IDS.map((id, idx) => ({
      actor: id,
      role: "npc",
      spawnedBy: spawnedKey,
      disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
      x: centerX + (idx - (BANDIT_IDS.length - 1) / 2) * (1.5 * grid),
      y: banditY
    }));

    await spawnTokens(scene, [...pcSpecs, ...banditSpecs]);
  }

  // ---------------------------------------------------------------------------
  // Registry + install
  // ---------------------------------------------------------------------------

  const SPAWNERS = {
    bandit_ambush_standard: spawnBanditAmbush
  };

  async function runSpawner(spawnerKey, payload) {
    const fn = SPAWNERS[spawnerKey];
    if (!fn) return null;
    try {
      return await fn(payload?.ctx || {}, payload?.scene, payload?.scenario, payload?.step);
    } catch (e) {
      warn("Spawner error", spawnerKey, e);
      return null;
    }
  }

  function install() {
    game.bbttcc ??= { api: {} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.encounters ??= game.bbttcc.api.encounters || {};

    const prev = game.bbttcc.api.encounters;

    game.bbttcc.api.encounters = {
      ...prev,
      _spawner: {
        ...(prev._spawner || {}),
        run: runSpawner,
        SPAWNERS,
        spawnAtCenter,
        spawnActors,
        spawnTokens
      }
    };

    log("Spawner interface installed");
  }

  Hooks.once("ready", install);
})();

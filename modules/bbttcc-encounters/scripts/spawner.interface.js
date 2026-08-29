// bbttcc-encounters/scripts/spawner.interface.js
// Spawner interface for Bad Eden Encounter Engine.
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
  // Participating-faction PC drop (2026-08-27)
  // Any PC (type "character") who belongs to the lead faction or a joining
  // faction gets a token on the encounter battlemap. Hostiles are expected to
  // be pre-positioned on authored scenes. PCs land in a row at bottom-center
  // of the scene rect; the GM slides them into position.
  // ---------------------------------------------------------------------------

  function _pcBelongsToFaction(char, faction) {
    // Mirrors bbttcc-factions _characterBelongsToFaction (flag id → system id →
    // flag name → system name), kept local so the encounters module has no
    // hard dependency on the factions module's internals.
    try {
      const byId = char.getFlag?.("bbttcc-factions", "factionId");
      if (byId) return byId === faction.id;
      const sys = char?.system?.system ?? char?.system ?? {};
      const sysFid = sys?.faction?.id;
      if (sysFid) return String(sysFid) === String(faction.id);
      const byName = char.getFlag?.("bbttcc-factions", "factionName");
      if (byName) return String(byName).trim() === String(faction.name).trim();
      const sysFname = sys?.faction?.name;
      if (sysFname) return String(sysFname).trim() === String(faction.name).trim();
    } catch (_e) {}
    return false;
  }

  function _participantFactionIds(ctx = {}) {
    const ids = [];
    const push = (v) => { const s = String(v || "").trim(); if (s && !ids.includes(s)) ids.push(s); };
    if (Array.isArray(ctx.participantFactionIds)) ctx.participantFactionIds.forEach(push);
    push(ctx.factionId);
    if (ctx.actor?.id) push(ctx.actor.id);
    if (Array.isArray(ctx.joiningFactionIds)) ctx.joiningFactionIds.forEach(push);
    return ids;
  }

  async function spawnFactionPCs(scene, ctx = {}, opts = {}) {
    if (!scene || !game.user?.isGM) return [];

    const factionIds = _participantFactionIds(ctx);
    if (!factionIds.length) {
      log("spawnFactionPCs: no participating factions in ctx; skipping PC drop.");
      return [];
    }

    const factions = factionIds.map(id => game.actors?.get?.(id)).filter(Boolean);
    if (!factions.length) return [];

    // PCs = character-type actors belonging to any participating faction.
    const pcs = [];
    for (const a of (game.actors?.contents || [])) {
      if (a?.type !== "character") continue;
      if (!factions.some(f => _pcBelongsToFaction(a, f))) continue;
      if (!pcs.includes(a)) pcs.push(a);
    }
    if (!pcs.length) {
      log("spawnFactionPCs: participating factions have no character-type members.", factionIds);
      return [];
    }

    // Skip PCs that already have a token on this scene (pre-placed or from an
    // earlier fight on the same battlemap).
    const present = new Set();
    for (const doc of iterTokenDocs(scene)) {
      if (doc?.actorId) present.add(doc.actorId);
    }
    const toPlace = pcs.filter(a => !present.has(a.id));
    if (!toPlace.length) {
      log("spawnFactionPCs: all participating PCs already on scene; nothing to drop.");
      return [];
    }

    // Row at bottom-center of the SCENE RECT (padding-aware via scene.dimensions).
    const dims = scene.dimensions || {};
    const grid = scene.grid?.size || 100;
    const sx = Number(dims.sceneX ?? 0);
    const sy = Number(dims.sceneY ?? 0);
    const sw = Number(dims.sceneWidth  ?? scene.width  ?? 4000);
    const sh = Number(dims.sceneHeight ?? scene.height ?? 3000);
    const cx = sx + sw / 2;
    const rowY = Math.floor((sy + sh - 3 * grid) / grid) * grid;

    const spawnedBy = opts.spawnedBy || "pc_party";
    const specs = toPlace.map((a, idx) => ({
      actor: a.id,
      role: "pc",
      spawnedBy,
      disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
      x: Math.floor((cx + (idx - (toPlace.length - 1) / 2) * (1.5 * grid)) / grid) * grid,
      y: rowY
    }));

    log("spawnFactionPCs: dropping party", { factionIds, pcs: toPlace.map(a => a.name) });
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

    // PCs: roster-driven from participating factions (2026-08-27 — the old
    // hardcoded PC_IDS list is retired to a testFire-only fallback below).
    const placedPCs = await spawnFactionPCs(scene, ctx, { spawnedBy: spawnedKey });

    const width  = scene.width  || 4000;
    const height = scene.height || 3000;
    const grid   = scene.grid?.size || 100;
    const centerX = width / 2;

    if (!placedPCs.length && !_participantFactionIds(ctx).length) {
      // No faction ctx (manual testFire) — legacy fallback so test fires still
      // show a party. Dead actor ids resolve to warn+skip harmlessly.
      const pcY = height - (3 * grid);
      const pcSpecs = PC_IDS.map((id, idx) => ({
        actor: id,
        role: "pc",
        spawnedBy: spawnedKey,
        disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        x: centerX + (idx - (PC_IDS.length - 1) / 2) * (1.5 * grid),
        y: pcY
      }));
      await spawnTokens(scene, pcSpecs);
    }

    // Bandits: only when the scene has no pre-positioned hostiles (authored
    // battlemaps carry their own bad guys).
    const hasHostiles = iterTokenDocs(scene).some(t =>
      Number(t?.disposition) === CONST.TOKEN_DISPOSITIONS.HOSTILE);
    if (!hasHostiles) {
      const banditY = 2 * grid;
      const banditSpecs = BANDIT_IDS.map((id, idx) => ({
        actor: id,
        role: "npc",
        spawnedBy: spawnedKey,
        disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
        x: centerX + (idx - (BANDIT_IDS.length - 1) / 2) * (1.5 * grid),
        y: banditY
      }));
      await spawnTokens(scene, banditSpecs);
    } else {
      log("Bandit Ambush: hostiles pre-positioned on scene; not spawning bandits.");
    }
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
        spawnTokens,
        spawnFactionPCs
      }
    };

    log("Spawner interface installed");
  }

  Hooks.once("ready", install);
})();

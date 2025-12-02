// bbttcc-encounters/scripts/spawner.interface.js
// Spawner interface for BBTTCC Encounter Engine.
// For now, we only implement a spawner for the Bandit Ambush scenario.

(() => {
  const TAG = "[bbttcc-encounters/spawner]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  // --- helpers --------------------------------------------------------------

  async function resolveActor(idOrUuid) {
    if (!idOrUuid) return null;
    try {
      if (typeof idOrUuid === "string" && idOrUuid.startsWith("Actor.")) {
        const doc = await fromUuid(idOrUuid);
        if (doc && doc instanceof Actor) return doc;
      }
      const byId = game.actors.get(idOrUuid);
      if (byId) return byId;
      const byName = game.actors.find(a => a.name === idOrUuid);
      if (byName) return byName;
    } catch (e) {
      warn("resolveActor error", idOrUuid, e);
    }
    return null;
  }

  async function spawnTokens(scene, specs = []) {
    if (!scene || !specs.length) return [];
    const gridSize = scene.grid?.size || 100;

    const tokenData = [];
    for (const spec of specs) {
      const actor = await resolveActor(spec.actor);
      if (!actor) continue;

      const x = Number(spec.x ?? 0);
      const y = Number(spec.y ?? 0);

      tokenData.push({
        name: actor.name,
        actorId: actor.id,
        x,
        y,
        width: 1,
        height: 1,
        hidden: !!spec.hidden,
        disposition: spec.disposition ?? (spec.role === "pc" ? CONST.TOKEN_DISPOSITIONS.FRIENDLY : CONST.TOKEN_DISPOSITIONS.HOSTILE),
        vision: true,
        rotation: 0,
        flags: {
          "bbttcc-encounters": {
            spawnedBy: spec.spawnedBy || "bandit_ambush_standard",
            role: spec.role || "npc"
          }
        }
      });
    }

    if (!tokenData.length) return [];

    try {
      const created = await scene.createEmbeddedDocuments("Token", tokenData);
      log("Spawned tokens", created);
      return created;
    } catch (e) {
      warn("spawnTokens error", e);
      return [];
    }
  }

  function hasSpawnedFlag(scene, spawnedByKey) {
    const tokens = scene.tokens ?? [];
    for (const t of tokens) {
      const doc = t.document ?? t;
      if (doc?.flags?.["bbttcc-encounters"]?.spawnedBy === spawnedByKey) return true;
    }
    return false;
  }

  // --- concrete spawner: Bandit Ambush -------------------------------------

  // Actor IDs (from your notes):
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
    "Actor.sjXNLebcoITE0Zcr", // Pherobandit
    "Actor.1oEJU5bQ6oO82iUw", // Theranya
    "Actor.2Yr0IgjWiKmG1ZYg"  // Sklar
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
      x: centerX + (idx - (PC_IDS.length - 1) / 2) * (1.5 * grid),
      y: pcY
    }));

    const banditSpecs = BANDIT_IDS.map((id, idx) => ({
      actor: id,
      role: "npc",
      spawnedBy: spawnedKey,
      x: centerX + (idx - (BANDIT_IDS.length - 1) / 2) * (1.5 * grid),
      y: banditY
    }));

    await spawnTokens(scene, [...pcSpecs, ...banditSpecs]);
  }

  // --- registry -------------------------------------------------------------

  const SPAWNERS = {
    bandit_ambush_standard: spawnBanditAmbush
  };

  async function runSpawner(spawnerKey, payload) {
    const fn = SPAWNERS[spawnerKey];
    if (!fn) return null;
    try {
      return await fn(payload.ctx || {}, payload.scene, payload.scenario, payload.step);
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
        SPAWNERS
      }
    };

    log("Spawner interface installed");
  }

  Hooks.once("ready", install);
})();

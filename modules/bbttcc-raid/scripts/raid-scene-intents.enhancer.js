// scripts/raid-scene-intents.enhancer.js
// ─────────────────────────────────────────────────────────────────────────────
// Sprint 1 substrate for MANEUVER_CATALOG_SPEC.md §4. Adds 6 new
// roundEffects.type verbs that touch the battle scene canvas, closing the
// substrate gap between agent THROUGHPUT preview intents and actual
// maneuver effect application.
//
// New verbs (`roundEffects[i].type`):
//
//   spawnSceneToken       — drop a token on the bound battle scene
//     { type, actorUuid, sceneId?, x?, y?, hidden?, factionId?, note? }
//
//   damageSceneTokens     — AOE damage via fourththing's _applyDamageToActor
//     { type, scope:"enemies"|"allies"|"all", factionId, damage,
//       damageType?, sceneId?, originTokenId?, radiusGrid?, note? }
//
//   buffSceneTokens       — apply an ActiveEffect to scoped tokens' actors
//     { type, scope, factionId, ae:{...}, durationRounds?, sceneId?, note? }
//
//   healSceneTokens       — restore integrity on scoped tokens' actors
//     { type, scope, factionId, amount, sceneId?, note? }
//
//   playCanvasVfx         — fire a canvas-wide / token VFX via Phase 2 bridge
//     { type, kind, sceneId?, originTokenId?, targetTokenId?, color?, note? }
//
//   tokenVisibility       — hide or reveal a token (anytime stealth/reveal)
//     { type, mode:"hide"|"reveal", tokenId, sceneId?, rounds?, note? }
//
// Wiring:
//   - Subscribes to "bbttcc:raid:maneuver:fired" — re-reads the just-stashed
//     bundle from round.meta.intents.applied.roundEffects and dispatches
//     the 6 scene verbs only. Strategic legacy verbs (rollBonus, alarmDelta,
//     etc.) are NOT touched; the existing B2/B3 pipelines own them.
//   - Exposes game.bbttcc.api.raid.sceneIntents.apply(roundEffects, ctx)
//     for direct invocation (commit-time hook to be added in a later sprint).
//
// GM-only execution: scene mutations are gated to GM clients. Strategic-map
// scenes (flag fourththing.strategicMap === true) are also skipped — these
// verbs are battle-scene-only by design.
//
// Per [[feedback_bbttcc_api_exposure_pattern]], API installs at BOTH script-
// load AND Hooks.once("ready") to defend against load-order races + cache.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  const TAG = "[bbttcc-raid:scene-intents]";
  const NEW_VERBS = new Set([
    "spawnSceneToken",
    "damageSceneTokens",
    "buffSceneTokens",
    "healSceneTokens",
    "playCanvasVfx",
    "tokenVisibility"
  ]);

  // ── helpers ────────────────────────────────────────────────────────────────

  function _isGM() {
    return !!(game?.user?.isGM);
  }

  function _isStrategicMap(scene) {
    try { return !!scene?.getFlag?.("fourththing", "strategicMap"); }
    catch (_e) { return false; }
  }

  // Resolve the battle scene: explicit sceneId → ctx-bound scene → canvas.scene.
  // Skips strategic maps (returns null).
  function _resolveScene(intent, ctx) {
    const id = intent?.sceneId || ctx?.sceneId || ctx?.round?.meta?.battleSceneId || null;
    let scene = id ? game.scenes?.get(id) : null;
    if (!scene) scene = canvas?.scene || null;
    if (!scene) return null;
    if (_isStrategicMap(scene)) return null;
    return scene;
  }

  async function _resolveActorByUuid(uuid) {
    if (!uuid) return null;
    try { return await fromUuid(uuid); } catch (_e) { return null; }
  }

  // Faction match heuristic. ctx supplies attackerFactionId / defenderFactionId.
  // We mirror Phase 4B's lightweight scan: actor flag bbttcc.factionId, or
  // ftAffiliation array on the actor. Conservative — no match returns null.
  function _actorFactionId(actor) {
    if (!actor) return null;
    try {
      const f = actor.flags?.bbttcc?.factionId || actor.system?.faction?.id || null;
      if (f) return String(f);
      const aff = actor.flags?.fourththing?.ftAffiliation || actor.system?.ftAffiliation || null;
      if (Array.isArray(aff) && aff.length) return String(aff[0]);
      if (typeof aff === "string") return aff;
    } catch (_e) {}
    return null;
  }

  function _matchScope(scope, intent, ctx, actorFactionId) {
    const friendlyId = String(intent?.factionId || ctx?.attackerFactionId || "");
    const enemyId    = String(ctx?.defenderFactionId || "");
    const af = String(actorFactionId || "");
    if (scope === "all" || !scope) return true;
    if (scope === "allies")  return af && (af === friendlyId);
    if (scope === "enemies") return af && (enemyId ? af === enemyId : af !== friendlyId);
    return true;
  }

  function _tokensOnScene(scene, { intent, ctx, scope } = {}) {
    const out = [];
    for (const tok of (scene?.tokens?.contents || [])) {
      const actor = tok.actor;
      if (!actor) continue;
      if (scope) {
        const af = _actorFactionId(actor);
        if (!_matchScope(scope, intent, ctx, af)) continue;
      }
      out.push(tok);
    }
    return out;
  }

  // Optional radius gate, in grid units, from an origin token.
  function _filterByRadius(tokens, scene, intent) {
    const radius = Number(intent?.radiusGrid || 0);
    const originId = intent?.originTokenId || null;
    if (!radius || !originId) return tokens;
    const origin = scene?.tokens?.get(originId);
    if (!origin) return tokens;
    const gx = origin.x, gy = origin.y;
    const gridSize = scene.grid?.size || canvas?.grid?.size || 100;
    const max = radius * gridSize;
    return tokens.filter((t) => {
      const dx = (t.x - gx), dy = (t.y - gy);
      return Math.hypot(dx, dy) <= max;
    });
  }

  // ── HANDLERS ───────────────────────────────────────────────────────────────

  async function _hSpawnSceneToken(intent, ctx) {
    const scene = _resolveScene(intent, ctx);
    if (!scene) return { applied: false, note: "no-scene" };
    const actor = await _resolveActorByUuid(intent.actorUuid);
    if (!actor) return { applied: false, note: "no-actor" };

    // Prefer Holdings deploy plumbing when the API is present — it handles
    // Phase C's actorLink + de-dup + flag bookkeeping for free.
    const holdings = game.bbttcc?.api?.territory?.holdings;
    if (typeof holdings?.deployToScene === "function") {
      try {
        const res = await holdings.deployToScene(actor, scene);
        return { applied: true, via: "holdings.deployToScene", res };
      } catch (e) { console.warn(TAG, "holdings.deployToScene failed; falling back", e); }
    }

    // Fallback: create a Token directly.
    try {
      const tokenData = (await actor.getTokenDocument({
        x: Number(intent.x ?? (scene.width / 2)),
        y: Number(intent.y ?? (scene.height / 2)),
        hidden: !!intent.hidden,
        actorLink: false
      })).toObject();
      const created = await scene.createEmbeddedDocuments("Token", [tokenData]);
      return { applied: true, via: "direct", tokenIds: created.map((t) => t.id) };
    } catch (e) {
      console.warn(TAG, "spawnSceneToken fallback failed", e);
      return { applied: false, note: "spawn-failed", error: String(e) };
    }
  }

  async function _hDamageSceneTokens(intent, ctx) {
    const scene = _resolveScene(intent, ctx);
    if (!scene) return { applied: false, note: "no-scene" };
    const damage = Number(intent.damage || 0);
    if (!damage) return { applied: false, note: "no-damage" };

    const scope = intent.scope || "enemies";
    let tokens = _tokensOnScene(scene, { intent, ctx, scope });
    tokens = _filterByRadius(tokens, scene, intent);

    const apply = game.fourththing?.rolls?._applyDamageToActor;
    if (typeof apply !== "function") return { applied: false, note: "no-damage-api" };

    const opts = {
      source: "raid-scene-intent",
      raidIntent: { type: "damageSceneTokens", note: intent.note || null },
      damageType: intent.damageType || "kinetic"
    };

    const results = [];
    for (const tok of tokens) {
      try {
        const res = await apply(tok.actor, damage, opts);
        results.push({ tokenId: tok.id, ok: true, res });
      } catch (e) {
        console.warn(TAG, "damage apply failed for token", tok.id, e);
        results.push({ tokenId: tok.id, ok: false, error: String(e) });
      }
    }
    return { applied: results.some((r) => r.ok), count: results.length, results };
  }

  async function _hBuffSceneTokens(intent, ctx) {
    const scene = _resolveScene(intent, ctx);
    if (!scene) return { applied: false, note: "no-scene" };
    if (!intent.ae || typeof intent.ae !== "object") return { applied: false, note: "no-ae" };

    const scope = intent.scope || "allies";
    const tokens = _tokensOnScene(scene, { intent, ctx, scope });

    const durationRounds = Number(intent.durationRounds || 1);
    const aeData = foundry.utils.deepClone(intent.ae);
    aeData.duration = aeData.duration || { rounds: durationRounds };
    aeData.flags = aeData.flags || {};
    aeData.flags["bbttcc-raid"] = { source: "scene-intent", note: intent.note || null };

    const results = [];
    for (const tok of tokens) {
      const actor = tok.actor;
      if (!actor) continue;
      try {
        const created = await actor.createEmbeddedDocuments("ActiveEffect", [aeData]);
        results.push({ tokenId: tok.id, ok: true, aeIds: created.map((a) => a.id) });
      } catch (e) {
        console.warn(TAG, "buff AE failed for token", tok.id, e);
        results.push({ tokenId: tok.id, ok: false, error: String(e) });
      }
    }
    return { applied: results.some((r) => r.ok), count: results.length, results };
  }

  async function _hHealSceneTokens(intent, ctx) {
    const scene = _resolveScene(intent, ctx);
    if (!scene) return { applied: false, note: "no-scene" };
    const amount = Number(intent.amount || 0);
    if (!amount) return { applied: false, note: "no-amount" };

    const scope = intent.scope || "allies";
    const tokens = _tokensOnScene(scene, { intent, ctx, scope });

    const results = [];
    for (const tok of tokens) {
      const actor = tok.actor;
      if (!actor) continue;
      try {
        const cur = Number(foundry.utils.getProperty(actor, "system.integrity.value") || 0);
        const max = Number(foundry.utils.getProperty(actor, "system.integrity.max") || 0) || cur + amount;
        const next = Math.max(0, Math.min(max, cur + amount));
        await actor.update({ "system.integrity.value": next });
        results.push({ tokenId: tok.id, ok: true, before: cur, after: next });
      } catch (e) {
        console.warn(TAG, "heal failed for token", tok.id, e);
        results.push({ tokenId: tok.id, ok: false, error: String(e) });
      }
    }
    return { applied: results.some((r) => r.ok), count: results.length, results };
  }

  async function _hPlayCanvasVfx(intent, ctx) {
    const scene = _resolveScene(intent, ctx);
    if (!scene) return { applied: false, note: "no-scene" };
    try {
      Hooks.callAll("bbttcc:raid:canvasVfx", {
        kind: intent.kind || "impact",
        sceneId: scene.id,
        originTokenId: intent.originTokenId || null,
        targetTokenId: intent.targetTokenId || null,
        color: intent.color || null,
        note: intent.note || null,
        ctx
      });
      return { applied: true, via: "hook:bbttcc:raid:canvasVfx" };
    } catch (e) {
      return { applied: false, note: "vfx-hook-failed", error: String(e) };
    }
  }

  async function _hTokenVisibility(intent, ctx) {
    const scene = _resolveScene(intent, ctx);
    if (!scene) return { applied: false, note: "no-scene" };
    const token = scene.tokens?.get(intent.tokenId);
    if (!token) return { applied: false, note: "no-token" };
    const hide = intent.mode === "hide";
    try {
      await token.update({ hidden: hide });
      // Rounds-based auto-revert: scheduled via a one-shot combat hook.
      const rounds = Number(intent.rounds || 0);
      if (rounds > 0) {
        const targetRound = Number(game.combat?.round || 0) + rounds;
        const cleanup = (combat, _changed) => {
          if (!combat || (combat?.round ?? 0) < targetRound) return;
          token.update({ hidden: !hide }).catch(() => {});
          Hooks.off("updateCombat", cleanup);
        };
        Hooks.on("updateCombat", cleanup);
      }
      return { applied: true, mode: intent.mode, tokenId: token.id, rounds };
    } catch (e) {
      return { applied: false, note: "visibility-failed", error: String(e) };
    }
  }

  const HANDLERS = Object.freeze({
    spawnSceneToken:   _hSpawnSceneToken,
    damageSceneTokens: _hDamageSceneTokens,
    buffSceneTokens:   _hBuffSceneTokens,
    healSceneTokens:   _hHealSceneTokens,
    playCanvasVfx:     _hPlayCanvasVfx,
    tokenVisibility:   _hTokenVisibility
  });

  // ── public consumer ────────────────────────────────────────────────────────

  async function applySceneIntents(roundEffects, ctx = {}) {
    if (!_isGM()) return { applied: false, note: "non-gm" };
    const list = Array.isArray(roundEffects) ? roundEffects : [];
    if (!list.length) return { applied: false, note: "empty" };

    const results = [];
    for (const eff of list) {
      const type = String(eff?.type || "");
      if (!NEW_VERBS.has(type)) continue;
      const handler = HANDLERS[type];
      if (!handler) continue;
      try {
        const res = await handler(eff, ctx);
        results.push({ type, ...res });
      } catch (e) {
        console.warn(TAG, "handler threw for", type, e);
        results.push({ type, applied: false, error: String(e) });
      }
    }
    return { applied: results.some((r) => r.applied), count: results.length, results };
  }

  // ── install ────────────────────────────────────────────────────────────────

  function _installApi() {
    try {
      game.bbttcc ??= { api: {} };
      game.bbttcc.api ??= {};
      game.bbttcc.api.raid ??= {};
      game.bbttcc.api.raid.sceneIntents = Object.freeze({
        apply: applySceneIntents,
        HANDLERS,
        NEW_VERBS: [...NEW_VERBS]
      });
    } catch (e) { console.warn(TAG, "api install failed", e); }
  }

  _installApi();
  Hooks.once("ready", _installApi);

  // ── fire-time auto-apply ───────────────────────────────────────────────────
  // After _rcApplyManeuverEffectsNow stashes the latest bundle's roundEffects
  // onto round.meta.intents.applied.roundEffects, this hook fires. We dispatch
  // ONLY the new scene-touching verbs, leaving strategic/legacy types to the
  // existing B2/B3 pipelines.
  Hooks.on("bbttcc:raid:maneuver:fired", async ({ round, side, key, fireMode, attacker, defender, app }) => {
    try {
      if (!_isGM()) return;
      if (fireMode !== "anytime") return; // pre-roll/post-commit apply at commit (future sprint)
      const stashed = round?.meta?.intents?.applied?.roundEffects || [];
      if (!stashed.length) return;
      // Filter to the new verbs (cheap pre-check).
      const sceneEffs = stashed.filter((e) => NEW_VERBS.has(String(e?.type || "")));
      if (!sceneEffs.length) return;
      const ctx = {
        attackerFactionId: attacker?.id || null,
        defenderFactionId: defender?.id || null,
        sceneId: round?.meta?.battleSceneId || canvas?.scene?.id || null,
        round, side, key, fireMode, app
      };
      await applySceneIntents(sceneEffs, ctx);
    } catch (e) {
      console.warn(TAG, "auto-apply on maneuver:fired failed", e);
    }
  });

  console.log(TAG, "loaded; verbs:", [...NEW_VERBS]);
})();

/* bbttcc-onboarding/scripts/stage.js
 * Staging helpers — spawn/clean up tutorial TARGETS and place tokens, always contained
 * to dedicated tutorial Scenes (never the live map). Everything spawned is flagged
 * flags["bbttcc-onboarding"].spawned so teardown can only ever delete its own scaffolding.
 *
 * All privileged create/delete work is registered as GM ops (relay.js) and invoked via
 * runAsGM — so GM callers run it locally and players relay to the GM. Ops return ids
 * (JSON-serialisable); the public helpers resolve those ids back to live Documents.
 *
 * The player's REAL Steward / rig are never created or deleted here — at most we place a
 * token for them on a tutorial Scene, and we only remove a token WE created.
 */

const MODULE_ID = "bbttcc-onboarding";
const TAG = "[onboarding/stage]";
const FOLDER_NAME = "Onboarding (tutorial)";

const _ns = () => globalThis.game?.bbttcc?.onboarding;
const _runAsGM = (op, payload, opts) => _ns()?.runAsGM?.(op, payload, opts);

async function _folder() {
  let f = game.folders?.find(x => x.type === "Actor" && x.name === FOLDER_NAME);
  if (!f) { try { f = await Folder.create({ name: FOLDER_NAME, type: "Actor" }); } catch (e) { console.warn(TAG, "folder create failed", e); } }
  return f || null;
}

/* ─── GM ops (run on the GM client; return ids) ─────────────────────────────── */
function _registerOps() {
  const reg = _ns()?.relay?.registerOp;
  if (!reg) { console.warn(TAG, "relay.registerOp unavailable — ops not registered."); return; }

  reg("spawnDummy", async ({ sceneId, x = 1300, y = 1000, name = "Training Dummy" }) => {
    const folder = await _folder();
    const actor = await Actor.create({
      name, type: "character", folder: folder?.id, img: "icons/svg/target.svg",
      prototypeToken: { actorLink: false, disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE, name },
      system: { details: { level: 1 }, attributes: { violence: 1, intrigue: 1, presence: 1, body: 10, mind: 10, soul: 10 } },
      flags: { [MODULE_ID]: { spawned: true, kind: "dummy" } }
    });
    try {
      const s = actor.system?.system ?? actor.system;
      await actor.update({
        "system.derived.integrity.value": s?.derived?.integrity?.max ?? 100,
        "system.derived.stress.value": s?.derived?.stress?.max ?? 50
      });
    } catch (_) {}
    let tokenId = null;
    const scene = game.scenes?.get?.(sceneId);
    if (scene) {
      try {
        const td = (await actor.getTokenDocument({ x, y })).toObject();
        td.flags = Object.assign({}, td.flags, { [MODULE_ID]: { spawned: true } });
        const [c] = await scene.createEmbeddedDocuments("Token", [td]);
        tokenId = c.id;
      } catch (e) { console.warn(TAG, "dummy token place failed", e); }
    }
    return { actorId: actor.id, tokenId, sceneId };
  });

  reg("ensureToken", async ({ actorId, sceneId, x = 1000, y = 1000 }) => {
    const actor = game.actors?.get?.(actorId);
    const scene = game.scenes?.get?.(sceneId);
    if (!actor || !scene) return { tokenId: null, created: false, sceneId };
    const existing = scene.tokens?.find(t => t.actorId === actor.id);
    if (existing) return { tokenId: existing.id, created: false, sceneId };
    const td = (await actor.getTokenDocument({ x, y })).toObject();
    const [c] = await scene.createEmbeddedDocuments("Token", [td]);
    return { tokenId: c.id, created: true, sceneId };
  });

  reg("mintRig", async ({ factionId, chassis = "hexmobile" }) => {
    const rb = globalThis.game?.bbttcc?.api?.rigBuilder;
    if (!rb?.mintFromChassis || !factionId) return { rigId: null };
    const rig = await rb.mintFromChassis(chassis, { factionOwnerId: factionId, free: true });
    return { rigId: rig?.id || null };
  });

  reg("ensureSandboxHex", async ({ sceneId, name = "Tutelary Hold" }) => {
    const scene = game.scenes?.get?.(sceneId);
    if (!scene) return null;
    // Reuse the existing sandbox hex (reset to unclaimed for clean replay) if present.
    let dr = scene.drawings?.find(d => d.getFlag?.(MODULE_ID, "sandboxHex"));
    if (dr) {
      try { await dr.update({ "flags.bbttcc-territory.factionId": "", "flags.bbttcc-territory.status": "unclaimed", "flags.bbttcc-territory.population": "uninhabited" }); } catch (_) {}
      return { hexUuid: dr.uuid, drawingId: dr.id, sceneId };
    }
    // Create a 12-point hexagon (the shape the Territory Dashboard recognises) at centre.
    const cx = Math.round(scene.width * 0.5), cy = Math.round(scene.height * 0.5);
    const r = 130, start = Math.PI / 6;
    const abs = [];
    for (let i = 0; i < 6; i++) { const a = start + i * Math.PI / 3; abs.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    const minX = Math.min(...abs.map(p => p[0])), minY = Math.min(...abs.map(p => p[1]));
    const points = []; for (const [x, y] of abs) points.push(Math.round(x - minX), Math.round(y - minY));
    const data = {
      shape: { type: "p", points },
      x: Math.round(minX), y: Math.round(minY),
      fillColor: "#3aa0ff", fillAlpha: 0.18, strokeColor: "#bfe3ff", strokeAlpha: 0.9, strokeWidth: 4,
      text: name, fontSize: 28, textColor: "#ffffff",
      flags: {
        "bbttcc-territory": {
          isHex: true, kind: "territory-hex", name, status: "unclaimed", type: "wilderness", size: "none",
          population: "uninhabited", capital: false,
          resources: { food: 0, materials: 0, trade: 0, military: 0, knowledge: 0 },
          createdAt: Date.now()
        },
        [MODULE_ID]: { spawned: true, sandboxHex: true }
      }
    };
    const [created] = await scene.createEmbeddedDocuments("Drawing", [data]);
    return { hexUuid: created.uuid, drawingId: created.id, sceneId };
  });

  reg("claimHex", async ({ hexUuid, factionId }) => {
    const doc = hexUuid ? await fromUuid(hexUuid) : null;
    if (!doc || !factionId) return { ok: false };
    try { await doc.update({ "flags.bbttcc-territory.factionId": factionId, "flags.bbttcc-territory.status": "occupied" }); return { ok: true }; }
    catch (e) { console.warn(TAG, "claimHex failed", e); return { ok: false }; }
  });

  reg("unclaimHex", async ({ hexUuid }) => {
    const doc = hexUuid ? await fromUuid(hexUuid) : null;
    if (!doc) return { ok: false };
    try { await doc.update({ "flags.bbttcc-territory.factionId": "", "flags.bbttcc-territory.status": "unclaimed", "flags.bbttcc-territory.population": "uninhabited" }); } catch (_) {}
    return { ok: true };
  });

  reg("disembark", async ({ stewardId, rigId }) => {
    const steward = game.actors?.get?.(stewardId);
    if (!steward) return { ok: false };
    // Boarding is an actor-flag connection (+ rig crew slots + cross-scene token hide).
    // Use the system's canonical disembark so it also un-hides the Steward's tokens and
    // restores sight on EVERY scene — hand-clearing flags would leave a real token (e.g.
    // on the live map) invisible.
    const fn = globalThis.game?.fourththing?.rig?.disembark;
    if (typeof fn === "function") {
      try { await fn(steward, rigId ? { rigId } : {}); return { ok: true }; }
      catch (e) { console.warn(TAG, "canonical disembark failed", e); }
    }
    // Fallback: clear the flag + the named rig's slots (no token un-hide available).
    try { if (steward.getFlag?.("fourththing", "boardedRig")) await steward.unsetFlag("fourththing", "boardedRig"); } catch (_) {}
    const rig = rigId ? game.actors?.get?.(rigId) : null;
    if (rig) {
      const slots = foundry.utils.deepClone(rig.system?.crew?.slots ?? []);
      let changed = false;
      for (const s of slots) if (s?.actorId === stewardId) { s.actorId = ""; changed = true; }
      if (changed) { try { await rig.update({ "system.crew.slots": slots }); } catch (_) {} }
    }
    return { ok: true };
  });

  reg("cleanup", async ({ tokens = [], actorIds = [] }) => {
    for (const t of tokens) {
      try { const sc = game.scenes?.get?.(t.sceneId); if (sc && t.tokenId) await sc.deleteEmbeddedDocuments("Token", [t.tokenId]); } catch (_) {}
    }
    for (const id of actorIds) {
      try { const a = game.actors?.get?.(id); if (a?.getFlag?.(MODULE_ID, "spawned")) await a.delete(); } catch (_) {}
    }
    return { ok: true };
  });

  console.log(TAG, "GM ops registered: spawnDummy, ensureToken, mintRig, cleanup.");
}

/* ─── Public helpers (called by beats; resolve ids -> Documents) ────────────── */

/** Ensure `actor` has a token on `scene`. Returns { doc, created }. */
async function ensureTokenOnScene(actor, scene, { x = 1000, y = 1000 } = {}) {
  if (!actor || !scene) return { doc: null, created: false };
  const res = await _runAsGM("ensureToken", { actorId: actor.id, sceneId: scene.id, x, y });
  const doc = res?.tokenId ? await _ns()?.relay?.resolveToken?.(res.sceneId, res.tokenId) : null;
  return { doc: doc || null, created: !!res?.created };
}

/** Spawn a disposable training dummy + token on `scene`. Returns { actor, token } or null. */
async function spawnDummy(scene, { x = 1300, y = 1000, name = "Training Dummy" } = {}) {
  const res = await _runAsGM("spawnDummy", { sceneId: scene?.id, x, y, name });
  if (!res?.actorId) return null;
  const actor = await _ns()?.relay?.resolveActor?.(res.actorId);
  const token = res.tokenId ? await _ns()?.relay?.resolveToken?.(res.sceneId, res.tokenId) : null;
  return { actor: actor || null, token: token || null };
}

/** Mint the faction's starter rig (free Hexmobile). Returns the rig Actor or null. */
async function mintRig(factionId, chassis = "hexmobile") {
  if (!factionId) return null;
  const res = await _runAsGM("mintRig", { factionId, chassis });
  return res?.rigId ? (await _ns()?.relay?.resolveActor?.(res.rigId)) || null : null;
}

/** Disembark a Steward from a rig (sever the boarding connection + un-hide tokens). */
async function disembark(stewardId, rigId) {
  if (!stewardId) return;
  await _runAsGM("disembark", { stewardId, rigId });
}

/** Ensure the sandbox tutorial hex exists on `scene` (reset to unclaimed). Returns {hexUuid,drawingId,sceneId}. */
async function ensureSandboxHex(scene, name) {
  if (!scene) return null;
  return await _runAsGM("ensureSandboxHex", { sceneId: scene.id, name });
}

/** Claim a hex for a faction (no player-facing claim GUI exists yet). */
async function claimHex(hexUuid, factionId) {
  if (!hexUuid || !factionId) return;
  await _runAsGM("claimHex", { hexUuid, factionId });
}

/** Reset a hex back to unclaimed (clean tutorial replay). */
async function unclaimHex(hexUuid) {
  if (!hexUuid) return;
  await _runAsGM("unclaimHex", { hexUuid });
}

/**
 * Tear down staged scaffolding. Each item may carry:
 *   .token / .doc — a TokenDocument to delete   .actor — an Actor (deleted only if spawned-flagged)
 */
async function cleanup(items = []) {
  const tokens = [], actorIds = [];
  for (const it of (items || [])) {
    if (!it) continue;
    const tok = it.token || it.doc;
    if (tok?.id) tokens.push({ sceneId: tok.parent?.id, tokenId: tok.id });
    if (it.actor?.id) actorIds.push(it.actor.id);
  }
  if (tokens.length || actorIds.length) await _runAsGM("cleanup", { tokens, actorIds });
}

Hooks.once("ready", () => {
  _registerOps();
  const ns = _ns();
  if (ns) ns.stage = { ensureTokenOnScene, spawnDummy, mintRig, disembark, ensureSandboxHex, claimHex, unclaimHex, cleanup, folder: _folder };
});

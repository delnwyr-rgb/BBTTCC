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
/* ─── Live-run registry (parallel-safe onboarding) ──────────────────────────
 * A run entry is { lane, ts, name }. Lanes are stable per user for the life of
 * a run and are what keep two concurrent players from spawning their tutorial
 * scaffolding on top of each other. Entries older than RUN_STALE_MS are pruned
 * (a browser crash mid-run must not hold a lane forever).                     */
const RUN_STALE_MS = 6 * 60 * 60 * 1000; // 6h
const LANE_STEP = 0.17;                  // vertical separation between concurrent runs

/** Shift a fractional y-position into this run's lane, kept inside the visible band. */
function _laneFrac(fy, lane = 0) {
  const shifted = (Number(fy) || 0.5) + ((Number(lane) || 0) % 5) * LANE_STEP;
  const wrapped = shifted > 0.94 ? shifted - 0.88 : shifted;   // wrap high lanes back up
  return Math.min(0.94, Math.max(0.06, wrapped));
}

function _readRuns() {
  const raw = game.settings?.get?.(MODULE_ID, "activeRuns") ?? {};
  const now = Date.now();
  const fresh = {};
  for (const [uid, e] of Object.entries(raw)) {
    if (e && (now - Number(e.ts || 0)) < RUN_STALE_MS) fresh[uid] = e;
  }
  return fresh;
}
function _lowestFreeLane(runs, exceptUserId) {
  const taken = new Set(Object.entries(runs)
    .filter(([uid]) => uid !== exceptUserId)
    .map(([, e]) => Number(e?.lane) || 0));
  let lane = 0;
  while (taken.has(lane)) lane++;
  return lane;
}

function _registerOps() {
  const reg = _ns()?.relay?.registerOp;
  if (!reg) { console.warn(TAG, "relay.registerOp unavailable — ops not registered."); return; }

  // Registry writes are serialized: two players starting within the same tick
  // would otherwise both read a pre-write snapshot and claim the same lane.
  let _regQueue = Promise.resolve();
  const _serialize = (fn) => (_regQueue = _regQueue.then(fn, fn));

  // Claim a lane + join the live-run registry. Idempotent: re-entering keeps
  // the same lane (so a resumed run's props line up with the ones it left).
  reg("runBegin", async ({ userId, name = "" }) => {
    if (!userId) return { lane: 0, others: 0 };
    return _serialize(async () => {
      const runs = _readRuns();
      const prior = Number(runs[userId]?.lane);
      const lane = Number.isFinite(prior) ? prior : _lowestFreeLane(runs, userId);
      runs[userId] = { lane, ts: Date.now(), name };
      await game.settings.set(MODULE_ID, "activeRuns", runs);
      return { lane, others: Object.keys(runs).filter(u => u !== userId).length };
    });
  });

  reg("runEnd", async ({ userId }) => {
    if (!userId) return { others: 0 };
    return _serialize(async () => {
      const runs = _readRuns();
      delete runs[userId];
      await game.settings.set(MODULE_ID, "activeRuns", runs);
      return { others: Object.keys(runs).length };
    });
  });

  // Who else is mid-tutorial right now (excluding the caller)?
  reg("runList", async ({ exceptUserId = "" } = {}) => {
    const runs = _readRuns();
    const others = Object.entries(runs)
      .filter(([uid]) => uid !== exceptUserId)
      .map(([uid, e]) => ({ userId: uid, name: e?.name || "", lane: e?.lane ?? 0 }));
    return { others, count: others.length };
  });

  // NPC-typed (2026-08-11): the Last Stand engine binds characters only — "NPCs
  // drop on zero without the dying cycle" — and tutorial scenery must never enter
  // the death spiral (owner playtest: shot-up wrecks started rolling Last Stand).
  reg("spawnDummy", async ({ sceneId, x = 1300, y = 1000, name = "Training Dummy", ownerUserId = "" }) => {
    const folder = await _folder();
    const actor = await Actor.create({
      name, type: "npc", folder: folder?.id, img: "icons/svg/target.svg",
      prototypeToken: { actorLink: false, disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE, name },
      system: { details: { level: 1 }, attributes: { violence: 1, intrigue: 1, presence: 1, body: 10, mind: 10, soul: 10 } },
      flags: { [MODULE_ID]: { spawned: true, kind: "dummy", ownerUserId } }
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
        td.flags = Object.assign({}, td.flags, { [MODULE_ID]: { spawned: true, ownerUserId } });
        const [c] = await scene.createEmbeddedDocuments("Token", [td]);
        tokenId = c.id;
      } catch (e) { console.warn(TAG, "dummy token place failed", e); }
    }
    return { actorId: actor.id, tokenId, sceneId };
  });

  reg("ensureToken", async ({ actorId, sceneId, x = 1000, y = 1000, ownerUserId = "" }) => {
    const actor = game.actors?.get?.(actorId);
    const scene = game.scenes?.get?.(sceneId);
    if (!actor || !scene) return { tokenId: null, created: false, sceneId };
    const existing = scene.tokens?.find(t => t.actorId === actor.id);
    if (existing) return { tokenId: existing.id, created: false, sceneId };
    const td = (await actor.getTokenDocument({ x, y })).toObject();
    // Tagged so a concurrent player's teardown can't reap this token.
    td.flags = Object.assign({}, td.flags, { [MODULE_ID]: { spawned: true, ownerUserId } });
    const [c] = await scene.createEmbeddedDocuments("Token", [td]);
    return { tokenId: c.id, created: true, sceneId };
  });

  // Starter-rig art per chassis (the builder mints with no img otherwise — bare
  // mystery-man token). Size in grid squares matches the chassis' physical scale.
  const STARTER_RIG_ART = {
    hexmobile:    { img: `modules/${MODULE_ID}/art/hexmobile-starter.webp`,    size: 2 },
    space_marine: { img: `modules/${MODULE_ID}/art/space-marine-starter.webp`, size: 1 }
  };

  reg("mintRig", async ({ factionId, chassis = "hexmobile", userId = "", name = "" }) => {
    const rb = globalThis.game?.bbttcc?.api?.rigBuilder;
    if (!rb?.mintFromChassis || !factionId) return { rigId: null };
    // Idempotent: a faction that already owns a rig gets that one back, never a twin.
    const existing = (game.actors?.contents ?? []).find(a => a.type === "rig" &&
      (a.getFlag?.("fourththing", "factionOwnerId") === factionId || a.system?.identity?.factionOwnerId === factionId));
    if (existing) return { rigId: existing.id, existed: true };

    const overrides = {};
    const cleanName = String(name || "").trim();
    if (cleanName) {
      overrides.name = cleanName;
      overrides.prototypeToken = { name: cleanName };
    }
    const art = STARTER_RIG_ART[chassis];
    if (art) {
      overrides.img = art.img;
      overrides.prototypeToken = Object.assign(overrides.prototypeToken ?? {}, {
        texture: { src: art.img }, width: art.size, height: art.size
      });
    }
    // The onboarding player OWNS their starter rig — sheet, tour, crew slots, the lot.
    if (userId) overrides.ownership = { default: 0, [userId]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER };

    const rig = await rb.mintFromChassis(chassis, { factionOwnerId: factionId, free: true, overrides });
    return { rigId: rig?.id || null };
  });

  // Training stipend — credit the faction's OP banks (allowOvercap) so tutorial
  // Travel / raid maneuvers are never money-locked. Costs live in the 0–130 marks
  // band, so a 130-mark credit per pool covers any single tutorial action.
  reg("grantOp", async ({ factionId, marks = {} }) => {
    const op = globalThis.game?.bbttcc?.api?.op;
    if (!op?.commit || !factionId) return { ok: false };
    try {
      const r = await op.commit(factionId, marks, { context: "onboarding-stipend", allowOvercap: true });
      return { ok: r?.ok !== false };
    } catch (e) { console.warn(TAG, "grantOp failed", e); return { ok: false }; }
  });

  // Destructible tutorial scenery (Test Track wrecks). default-OWNER so any player's
  // damage application lands; flagged spawned so teardown can only ever delete these.
  reg("spawnObstacle", async ({ sceneId, x = 1000, y = 1000, name = "Rusted Wreck", img = "", size = 2, integrity = 12, ownerUserId = "" }) => {
    const folder = await _folder();
    const actor = await Actor.create({
      name, type: "npc", folder: folder?.id, img: img || "icons/svg/hazard.svg",
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
      prototypeToken: Object.assign(
        { actorLink: false, disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE, name, width: size, height: size },
        img ? { texture: { src: img } } : {}
      ),
      system: { details: { level: 1 }, attributes: { violence: 0, intrigue: 0, presence: 0, body: 6, mind: 1, soul: 1 } },
      flags: { [MODULE_ID]: { spawned: true, kind: "obstacle", ownerUserId } }
    });
    if (!actor) return null;
    try {
      await actor.update({
        "system.derived.integrity.value": Math.max(1, Number(integrity) || 12),
        "system.derived.stress.value": 0
      });
    } catch (_) {}
    let tokenId = null;
    const scene = game.scenes?.get?.(sceneId);
    if (scene) {
      try {
        const td = (await actor.getTokenDocument({ x, y })).toObject();
        td.flags = Object.assign({}, td.flags, { [MODULE_ID]: { spawned: true, ownerUserId } });
        const [c] = await scene.createEmbeddedDocuments("Token", [td]);
        tokenId = c.id;
      } catch (e) { console.warn(TAG, "obstacle token place failed", e); }
    }
    return { actorId: actor.id, tokenId, sceneId };
  });

  // Per-run sandbox hex (2026-08-13): keyed by ownerUserId so concurrent players
  // each claim their OWN Tutelary Hold. One shared hex meant player B's arrival
  // reset player A's banner mid-beat, and A's claim gate could be satisfied by B.
  // Laned vertically so the holds don't overlap on the map.
  reg("ensureSandboxHex", async ({ sceneId, name = "Tutelary Hold", ownerUserId = "", lane = 0 }) => {
    const scene = game.scenes?.get?.(sceneId);
    if (!scene) return null;
    const mine = (d) => {
      const f = d.getFlag?.(MODULE_ID, "sandboxHex");
      if (!f) return false;
      // Legacy hexes (flag === true, pre-2026-08-13) belong to whoever asks first.
      return f === true || f === (ownerUserId || "solo");
    };
    // Reuse this run's sandbox hex (reset to unclaimed for clean replay) if present.
    let dr = scene.drawings?.find(mine);
    if (dr) {
      const patch = {
        "flags.bbttcc-territory.factionId": "",
        "flags.bbttcc-territory.status": "unclaimed",
        "flags.bbttcc-territory.population": "uninhabited"
      };
      // Adopting a legacy (flag === true) hex must STICK — otherwise the next
      // concurrent run matches `true` too and we're back to one shared hold.
      if (dr.getFlag?.(MODULE_ID, "sandboxHex") === true && ownerUserId) {
        patch[`flags.${MODULE_ID}.sandboxHex`] = ownerUserId;
        patch[`flags.${MODULE_ID}.ownerUserId`] = ownerUserId;
      }
      try { await dr.update(patch); } catch (_) {}
      return { hexUuid: dr.uuid, drawingId: dr.id, sceneId };
    }
    // Create a 12-point hexagon (the shape the Territory Dashboard recognises).
    // Padding-aware: canvas coords include scene padding — bare width*frac drifts off-map.
    const dims = scene.dimensions ?? {};
    const yFrac = _laneFrac(0.5, lane);
    const cx = Math.round((dims.sceneX ?? 0) + (dims.sceneWidth ?? scene.width) * 0.5);
    const cy = Math.round((dims.sceneY ?? 0) + (dims.sceneHeight ?? scene.height) * yFrac);
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
        [MODULE_ID]: { spawned: true, sandboxHex: ownerUserId || "solo", ownerUserId }
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

  // ─── Phase 4 (finale) ops ────────────────────────────────────────────────

  // A disposable hostile faction to raid. A valid raid target is just an actor
  // flagged bbttcc-factions.isFaction (cf. isFaction() in module.raid-console.js);
  // we also stamp it spawned so teardown only ever deletes its own scaffolding.
  reg("spawnHostileFaction", async ({ name = "The Rust Syndicate", ownerUserId = "" }) => {
    // default-OWNER (2026-08-11): raid round-commits write defender state onto this
    // actor from the PLAYER's client — without ownership the whole finale throws
    // "lacks permission to update Actor" walls (owner playtest). Tutorial scenery:
    // it exists to be raided and is deleted at graduation.
    const ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER };
    // Per-run (2026-08-13): each player raids their OWN Syndicate, so one player's
    // graduation teardown can't delete the target another is mid-raid against.
    // Legacy untagged spawns are adopted by whoever asks first.
    let actor = (game.actors?.contents ?? []).find(a => {
      if (!a.getFlag?.(MODULE_ID, "spawned") || a.getFlag?.(MODULE_ID, "kind") !== "hostileFaction") return false;
      const owner = a.getFlag?.(MODULE_ID, "ownerUserId") ?? "";
      return owner === (ownerUserId || "") || owner === "";
    });
    if (actor) {
      // Pre-fix spawns lack the ownership grant — retrofit it on reuse.
      if ((actor.ownership?.default ?? 0) < CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
        try { await actor.update({ ownership }); } catch (e) { console.warn(TAG, "hostile faction ownership retrofit failed", e); }
      }
      return { actorId: actor.id };
    }
    const folder = await _folder();
    try {
      actor = await Actor.create({
        name, type: "npc", folder: folder?.id, img: "icons/svg/tower.svg",
        ownership,
        prototypeToken: { actorLink: false, disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE, name },
        flags: {
          "bbttcc-factions": { isFaction: true, disposition: "hostile" },
          [MODULE_ID]: { spawned: true, kind: "hostileFaction", ownerUserId }
        }
      });
    } catch (e) { console.warn(TAG, "spawnHostileFaction create failed", e); return { actorId: null }; }
    return { actorId: actor?.id || null };
  });

  // Author (or reset) a territory hex on a tutorial scene, optionally claimed by a
  // faction. Same 12-point hexagon shape the Territory Dashboard recognises as
  // ensureSandboxHex, but keyed (origin / hostile) and placeable left/right so the
  // travel beat has a real two-hex crossing. Idempotent by flags[MODULE_ID].tutorialHex.
  reg("ensureHex", async ({ sceneId, key = "hostile", name = "Hostile Hold", factionId = "", status = "occupied", xFrac = 0.5, yFrac = 0.5, r = 130, fillColor = "#ff5a3a", strokeColor = "#ffd0c2", ownerUserId = "", lane = 0 } = {}) => {
    const scene = game.scenes?.get?.(sceneId);
    if (!scene) return null;
    // Per-run key (2026-08-13) so concurrent finales get their own hold pairs.
    const runKey = ownerUserId ? `${key}:${ownerUserId}` : key;
    let dr = scene.drawings?.find(d => {
      const k = d.getFlag?.(MODULE_ID, "tutorialHex");
      return k === runKey || (!ownerUserId && k === key);
    });
    if (dr) {
      try {
        await dr.update({
          "flags.bbttcc-territory.factionId": factionId || "",
          "flags.bbttcc-territory.status": factionId ? status : "unclaimed",
          "flags.bbttcc-territory.population": factionId ? "occupied" : "uninhabited"
        });
      } catch (_) {}
      return { hexUuid: dr.uuid, drawingId: dr.id, sceneId };
    }
    // Padding-aware, lane-aware placement (canvas coords include scene padding).
    const dims = scene.dimensions ?? {};
    const cx = Math.round((dims.sceneX ?? 0) + (dims.sceneWidth ?? scene.width) * xFrac);
    const cy = Math.round((dims.sceneY ?? 0) + (dims.sceneHeight ?? scene.height) * _laneFrac(yFrac, lane));
    const start = Math.PI / 6, abs = [];
    for (let i = 0; i < 6; i++) { const a = start + i * Math.PI / 3; abs.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    const minX = Math.min(...abs.map(p => p[0])), minY = Math.min(...abs.map(p => p[1]));
    const points = []; for (const [x, y] of abs) points.push(Math.round(x - minX), Math.round(y - minY));
    const data = {
      shape: { type: "p", points },
      x: Math.round(minX), y: Math.round(minY),
      fillColor, fillAlpha: 0.18, strokeColor, strokeAlpha: 0.9, strokeWidth: 4,
      text: name, fontSize: 28, textColor: "#ffffff",
      flags: {
        "bbttcc-territory": {
          isHex: true, kind: "territory-hex", name,
          status: factionId ? status : "unclaimed", type: "wilderness", size: "none",
          population: factionId ? "occupied" : "uninhabited", capital: false,
          factionId: factionId || "",
          resources: { food: 0, materials: 0, trade: 0, military: 0, knowledge: 0 },
          createdAt: Date.now()
        },
        [MODULE_ID]: { spawned: true, tutorialHex: runKey, ownerUserId }
      }
    };
    const [created] = await scene.createEmbeddedDocuments("Drawing", [data]);
    return { hexUuid: created.uuid, drawingId: created.id, sceneId };
  });

  // Pre-seed the Raid Console's persisted session on the player's REAL faction so the
  // console opens already pointed at a target + raid type (the console reads this flag on
  // first render via _applySessionIfNewer). This is the same flag the console itself writes.
  reg("setRaidSession", async ({ factionId, session }) => {
    const f = game.actors?.get?.(factionId);
    if (!f || !session) return { ok: false };
    try { await f.setFlag("bbttcc-raid", "raidSession", session); return { ok: true }; }
    catch (e) { console.warn(TAG, "setRaidSession failed", e); return { ok: false }; }
  });

  reg("clearRaidSession", async ({ factionId }) => {
    const f = game.actors?.get?.(factionId);
    if (!f) return { ok: false };
    try { await f.unsetFlag("bbttcc-raid", "raidSession"); } catch (_) {}
    return { ok: true };
  });

  // Graduation teardown, SCOPED to the graduating run (2026-08-13). With two
  // players mid-flow the old scene-wide sweep let one player's graduation delete
  // the other's raid target and tokens. Rule: always reap your own props; only
  // reap untagged/legacy props when no other run is live (which keeps the
  // solo experience self-cleaning as before).
  reg("teardownFinale", async ({ factionId = "", sceneId = "", ownerUserId = "" } = {}) => {
    if (factionId) { try { await game.actors?.get?.(factionId)?.unsetFlag?.("bbttcc-raid", "raidSession"); } catch (_) {} }
    const othersLive = Object.keys(_readRuns()).filter(u => u !== ownerUserId).length > 0;
    const isMine = (doc) => {
      const owner = doc.getFlag?.(MODULE_ID, "ownerUserId") ?? "";
      if (owner && ownerUserId) return owner === ownerUserId;
      return !othersLive;   // untagged/legacy: only safe to sweep when alone
    };
    const scene = sceneId ? game.scenes?.get?.(sceneId) : null;
    if (scene) {
      const drawIds = (scene.drawings?.contents ?? Array.from(scene.drawings ?? []))
        .filter(d => d.getFlag?.(MODULE_ID, "spawned") && d.getFlag?.(MODULE_ID, "tutorialHex") && isMine(d)).map(d => d.id);
      if (drawIds.length) { try { await scene.deleteEmbeddedDocuments("Drawing", drawIds); } catch (_) {} }
      const tokIds = (scene.tokens?.contents ?? Array.from(scene.tokens ?? []))
        .filter(t => t.getFlag?.(MODULE_ID, "spawned") && isMine(t)).map(t => t.id);
      if (tokIds.length) { try { await scene.deleteEmbeddedDocuments("Token", tokIds); } catch (_) {} }
    }
    for (const a of (game.actors?.contents ?? [])) {
      try {
        if (a.getFlag?.(MODULE_ID, "spawned") && a.getFlag?.(MODULE_ID, "kind") === "hostileFaction" && isMine(a)) await a.delete();
      } catch (_) {}
    }
    if (othersLive) console.log(TAG, "teardownFinale: other runs live — scoped to own props only.");
    return { ok: true, scoped: othersLive };
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

  console.log(TAG, "GM ops registered: spawnDummy, spawnObstacle, ensureToken, mintRig, ensureSandboxHex, claimHex, unclaimHex, disembark, spawnHostileFaction, ensureHex, setRaidSession, clearRaidSession, teardownFinale, cleanup.");
}

/* ─── Public helpers (called by beats; resolve ids -> Documents) ────────────── */

/* Run context — set once by the director at start(). Every helper stamps it onto
 * its op call so props are owner-tagged and lane-placed without each beat having
 * to thread it through. Solo runs keep working with an empty context. */
let _run = { userId: "", lane: 0 };
function setRunContext({ userId = "", lane = 0 } = {}) { _run = { userId, lane }; }
function runContext() { return { ..._run }; }
const _ownedBy = () => ({ ownerUserId: _run.userId, lane: _run.lane });

/** Join the live-run registry and claim a spawn lane. Returns { lane, others }. */
async function runBegin(userId, name = "") {
  return (await _runAsGM("runBegin", { userId, name })) ?? { lane: 0, others: 0 };
}
/** Leave the registry (frees the lane). */
async function runEnd(userId) {
  return (await _runAsGM("runEnd", { userId })) ?? { others: 0 };
}
/** Who else is mid-tutorial? Returns { others: [...], count }. */
async function runList(exceptUserId = "") {
  return (await _runAsGM("runList", { exceptUserId })) ?? { others: [], count: 0 };
}

/** Ensure `actor` has a token on `scene`. Returns { doc, created }. */
async function ensureTokenOnScene(actor, scene, { x = 1000, y = 1000 } = {}) {
  if (!actor || !scene) return { doc: null, created: false };
  const res = await _runAsGM("ensureToken", { actorId: actor.id, sceneId: scene.id, x, y, ..._ownedBy() });
  const doc = res?.tokenId ? await _ns()?.relay?.resolveToken?.(res.sceneId, res.tokenId) : null;
  return { doc: doc || null, created: !!res?.created };
}

/** Spawn a disposable training dummy + token on `scene`. Returns { actor, token } or null. */
async function spawnDummy(scene, { x = 1300, y = 1000, name = "Training Dummy" } = {}) {
  const res = await _runAsGM("spawnDummy", { sceneId: scene?.id, x, y, name, ..._ownedBy() });
  if (!res?.actorId) return null;
  const actor = await _ns()?.relay?.resolveActor?.(res.actorId);
  const token = res.tokenId ? await _ns()?.relay?.resolveToken?.(res.sceneId, res.tokenId) : null;
  return { actor: actor || null, token: token || null };
}

/** Mint the faction's starter rig (free Hexmobile). opts: { userId (granted OWNER), name }.
 *  Returns the rig Actor or null. Reuses the faction's existing rig if one exists. */
async function mintRig(factionId, chassis = "hexmobile", { userId = "", name = "" } = {}) {
  if (!factionId) return null;
  const res = await _runAsGM("mintRig", { factionId, chassis, userId, name });
  return res?.rigId ? (await _ns()?.relay?.resolveActor?.(res.rigId)) || null : null;
}

/** Credit the faction's OP banks (training stipend). marks: { economy: 130, ... } */
async function grantOp(factionId, marks = {}) {
  if (!factionId) return { ok: false };
  return (await _runAsGM("grantOp", { factionId, marks })) ?? { ok: false };
}

/** Spawn a destructible tutorial obstacle + token on `scene`. Returns { actor, token } or null. */
async function spawnObstacle(scene, opts = {}) {
  const res = await _runAsGM("spawnObstacle", { sceneId: scene?.id, ...opts, ..._ownedBy() });
  if (!res?.actorId) return null;
  const actor = await _ns()?.relay?.resolveActor?.(res.actorId);
  const token = res.tokenId ? await _ns()?.relay?.resolveToken?.(res.sceneId, res.tokenId) : null;
  return { actor: actor || null, token: token || null };
}

/** Disembark a Steward from a rig (sever the boarding connection + un-hide tokens). */
async function disembark(stewardId, rigId) {
  if (!stewardId) return;
  await _runAsGM("disembark", { stewardId, rigId });
}

/** Ensure the sandbox tutorial hex exists on `scene` (reset to unclaimed). Returns {hexUuid,drawingId,sceneId}. */
async function ensureSandboxHex(scene, name) {
  if (!scene) return null;
  return await _runAsGM("ensureSandboxHex", { sceneId: scene.id, name, ..._ownedBy() });
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

/** Spawn (or reuse) a disposable hostile faction to raid. Returns the Actor or null. */
async function spawnHostileFaction(name = "The Rust Syndicate") {
  const res = await _runAsGM("spawnHostileFaction", { name, ..._ownedBy() });
  return res?.actorId ? (await _ns()?.relay?.resolveActor?.(res.actorId)) || null : null;
}

/** Author/reset a tutorial territory hex. opts: {key,name,factionId,status,xFrac,yFrac,fillColor,strokeColor}. Returns {hexUuid,drawingId,sceneId}. */
async function ensureHex(scene, opts = {}) {
  if (!scene) return null;
  return await _runAsGM("ensureHex", { sceneId: scene.id, ...opts, ..._ownedBy() });
}

/** Pre-seed the Raid Console session on the player's real faction so it opens pre-targeted. */
async function setRaidSession(factionId, session) {
  if (!factionId || !session) return;
  await _runAsGM("setRaidSession", { factionId, session });
}

/** Clear the raid session pointer off the player's real faction. */
async function clearRaidSession(factionId) {
  if (!factionId) return;
  await _runAsGM("clearRaidSession", { factionId });
}

/** Graduation teardown — clear raid pointer + delete spawned finale props on a scene. */
async function teardownFinale(factionId, sceneId) {
  await _runAsGM("teardownFinale", { factionId, sceneId, ownerUserId: _run.userId });
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
  if (ns) ns.stage = {
    ensureTokenOnScene, spawnDummy, spawnObstacle, mintRig, grantOp, disembark,
    ensureSandboxHex, claimHex, unclaimHex, spawnHostileFaction, ensureHex,
    setRaidSession, clearRaidSession, teardownFinale, cleanup, folder: _folder,
    setRunContext, runContext, runBegin, runEnd, runList, laneFrac: _laneFrac
  };
});

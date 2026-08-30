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
// 15 min, heartbeat-backed: the director runPings every 5 while a run is live,
// so an entry that stops aging out means the client died mid-run. The old 6h
// window let a crashed run haunt the registry all evening — "another Steward
// is running the same program" from a login that had long since refreshed
// (2026-08-21 playtest).
const RUN_STALE_MS = 15 * 60 * 1000;
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

  // Heartbeat — keeps a live run's entry fresh. A client that dies mid-run
  // stops pinging and its entry ages out in RUN_STALE_MS instead of lingering.
  reg("runPing", async ({ userId }) => {
    if (!userId) return { ok: false };
    return _serialize(async () => {
      const runs = _readRuns();
      if (!runs[userId]) return { ok: false };
      runs[userId] = { ...runs[userId], ts: Date.now() };
      await game.settings.set(MODULE_ID, "activeRuns", runs);
      return { ok: true };
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

  /* ─── Combat simulator (Proving Ground) ─────────────────────────────────────
   * Foes are NPC-typed for the same reason the wrecks aren't characters: the
   * Last Stand engine binds `type === "character"` only, so an npc drops clean
   * on zero instead of opening the dying cycle mid-tutorial. default-OWNER
   * because damage application runs CLIENT-SIDE when the player owns the
   * target — an unowned foe silently eats the hit (the trap the wrecks hit on
   * 2026-08-17). HP is NOT set directly: `derived.integrity.max` is computed as
   * 10 + 3×body + level scaling, so we shape toughness through `body` and then
   * fill the track to whatever the engine derived. The beat reads the live max
   * for its surrender threshold, so it stays correct however that formula moves.
   */
  reg("spawnFoe", async ({ sceneId, x = 1000, y = 1000, elevation = 0, name = "Foe", img = "",
                          size = 1, foeClass = "qliphothic", body = 3, level = 1,
                          resistances = [], vulnerabilities = [], conditions = [], ownerUserId = "" }) => {
    const folder = await _folder();
    const actor = await Actor.create({
      name, type: "npc", folder: folder?.id, img: img || "icons/svg/mystery-man.svg",
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
      prototypeToken: Object.assign(
        { actorLink: false, disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE, name, width: size, height: size },
        img ? { texture: { src: img } } : {}
      ),
      system: {
        details: { level: Math.max(1, Number(level) || 1) },
        attributes: { body: { value: Math.max(1, Number(body) || 3) } },
        defenses: { resistances, immunities: [], vulnerabilities }
      },
      flags: { [MODULE_ID]: { spawned: true, kind: "foe", foeClass, ownerUserId } }
    });
    if (!actor) return null;
    // Fill the tracks AFTER create — max is derived, so it isn't known until the
    // document exists (same two-step spawnDummy uses).
    let integrityMax = 0;
    try {
      const sys = actor.system?.system ?? actor.system;
      integrityMax = Number(sys?.derived?.integrity?.max) || 0;
      await actor.update({
        "system.derived.integrity.value": integrityMax,
        "system.derived.stress.value": Number(sys?.derived?.stress?.max) || 0
      });
    } catch (e) { console.warn(TAG, "foe track fill failed", e); }

    // Arrive already carrying conditions — the stealth approach spawns its foes
    // Surprised, which the system's own "cannot act on the first round" rule
    // then enforces for free. Routed through toggleCondition so the AE + card
    // fire exactly as they would mid-fight.
    for (const key of (Array.isArray(conditions) ? conditions : [])) {
      try { await game.fourththing?.toggleCondition?.(actor, String(key)); }
      catch (e) { console.warn(TAG, `spawnFoe: condition "${key}" failed`, e); }
    }

    let tokenId = null;
    const scene = game.scenes?.get?.(sceneId);
    if (scene) {
      try {
        const td = (await actor.getTokenDocument({ x, y })).toObject();
        if (Number(elevation)) td.elevation = Number(elevation);
        td.flags = Object.assign({}, td.flags, { [MODULE_ID]: { spawned: true, ownerUserId } });
        const [c] = await scene.createEmbeddedDocuments("Token", [td]);
        tokenId = c.id;
      } catch (e) { console.warn(TAG, "foe token place failed", e); }
    }
    return { actorId: actor.id, tokenId, sceneId, integrityMax };
  });

  // ─── Native scene levels (2026-08-17) ──────────────────────────────────────
  // Foundry v14 scenes carry `levels[]`, each with its own background and an
  // elevation band. The Proving Ground has "Proving Ground" (0→40) and "Reefer
  // Dive" (−20→0), so diving is nothing more than writing the token's
  // elevation — precisely the "vertical via token.document.elevation, never the
  // Levels module" rule. Returns the previous elevation so the caller can
  // surface the player exactly where they left off.
  reg("setElevation", async ({ sceneId, actorId, elevation = 0, levelId = "" }) => {
    const scene = game.scenes?.get?.(String(sceneId || ""));
    if (!scene) return { ok: false, from: 0 };
    const docs = scene.tokens?.filter?.(t => t.actorId === String(actorId || "")) ?? [];
    if (!docs.length) return { ok: false, from: 0 };
    const from = Number(docs[0].elevation) || 0;
    // v14: a token BELONGS to a scene level by id — elevation alone never
    // re-homes it, it just sinks below its current floor (owner hit this live
    // 2026-08-24). Pass levelId to actually move it between levels.
    const fromLevel = docs[0]._source?.level ?? null;
    try {
      const patch = { elevation: Number(elevation) || 0 };
      if (levelId) patch.level = String(levelId);
      await scene.updateEmbeddedDocuments("Token", docs.map(t => ({ _id: t.id, ...patch })));
    } catch (e) { console.warn(TAG, "setElevation failed", e); return { ok: false, from, fromLevel }; }
    return { ok: true, from, to: Number(elevation) || 0, fromLevel, toLevel: levelId || fromLevel,
             tokenIds: docs.map(t => t.id) };
  });

  // Darkness is a MANUAL track (system.darkness.value, 0–10 on the sheet) — no
  // engine writes it, so the simulator has to. Killing a sentient is allowed;
  // this is what it costs. Clamped, and reports what actually landed so the
  // Operator never announces a point that didn't stick.
  reg("raiseDarkness", async ({ actorId, amount = 1, reason = "" }) => {
    const actor = game.actors?.get?.(String(actorId || ""));
    if (!actor) return { ok: false, before: 0, after: 0 };
    const sys = actor.system?.system ?? actor.system;
    const before = Number(sys?.darkness?.value) || 0;
    const after = Math.min(10, Math.max(0, before + (Number(amount) || 0)));
    if (after === before) return { ok: true, before, after, capped: true };
    try {
      await actor.update({ "system.darkness.value": after });
      console.log(TAG, `Darkness ${before} → ${after} on ${actor.name}${reason ? ` (${reason})` : ""}`);
    } catch (e) { console.warn(TAG, "raiseDarkness failed", e); return { ok: false, before, after: before }; }
    return { ok: true, before, after };
  });

  // A sentient foe folds instead of dying. Routed through the system's own
  // toggleCondition so the condition AE + chat card fire exactly as they would
  // in a real fight — but read first, because toggle would UNSET an already-set
  // Calmed on a replayed beat.
  reg("foeSurrender", async ({ actorId, holdAt = 1 }) => {
    const actor = game.actors?.get?.(String(actorId || ""));
    if (!actor) return { ok: false };
    const sys = actor.system?.system ?? actor.system;
    if (sys?.conditions?.calmed !== true) {
      try { await game.fourththing?.toggleCondition?.(actor, "calmed"); }
      catch (e) { console.warn(TAG, "foeSurrender toggleCondition failed", e); }
    }
    // Never leave a surrendered foe one stray splash from dying — floor the track.
    const cur = Number(sys?.derived?.integrity?.value) || 0;
    const floor = Math.max(1, Number(holdAt) || 1);
    if (cur < floor) {
      try { await actor.update({ "system.derived.integrity.value": floor }); } catch (_) {}
    }
    return { ok: true };
  });

  // Knock a foe off the gantry. The engine's aerial ladder is altitude-BAND
  // scale (sky / stratosphere / orbit) — there is no rooftop-scale forced
  // movement, and every push in the system says "GM resolves the knockback".
  // So the Proving Ground's rickety gantry resolves it here: drop the token to
  // ground, apply the sky-band impact tick, and leave them Prone.
  reg("shoveOffPerch", async ({ sceneId, tokenId, actorId, formula = "2d6" }) => {
    const scene = game.scenes?.get?.(String(sceneId || ""));
    const tokenDoc = scene?.tokens?.get?.(String(tokenId || ""));
    const actor = game.actors?.get?.(String(actorId || ""));
    if (!tokenDoc || !actor) return { ok: false, damage: 0 };
    try { await tokenDoc.update({ elevation: 0 }); }
    catch (e) { console.warn(TAG, "shoveOffPerch elevation drop failed", e); }
    let total = 0;
    try {
      const r = new Roll(String(formula || "2d6"));
      await r.evaluate();
      total = Number(r.total) || 0;
      await game.fourththing?.rolls?._applyDamageToActor?.(actor, total, { track: "integrity", ignoreResists: true });
    } catch (e) { console.warn(TAG, "shoveOffPerch impact failed", e); }
    try {
      const sys = actor.system?.system ?? actor.system;
      if (sys?.conditions?.prone !== true) await game.fourththing?.toggleCondition?.(actor, "prone");
    } catch (_) {}
    return { ok: true, damage: total };
  });

  /* ─── Proving Ground trials (2026-08-17) ───────────────────────────────────
   * A relic marker: an inert, unarmed prop the player walks onto. NPC-typed and
   * default-OWNER for the same reasons the foes are, but disposition NEUTRAL and
   * `kind:"marker"` so nothing mistakes it for something to shoot.
   */
  reg("spawnMarker", async ({ sceneId, x = 1000, y = 1000, elevation = 0, levelId = "", name = "Relic", img = "", size = 1, ownerUserId = "" }) => {
    const folder = await _folder();
    const actor = await Actor.create({
      name, type: "npc", folder: folder?.id, img: img || "icons/svg/mystery-man.svg",
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
      prototypeToken: Object.assign(
        { actorLink: false, disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL, name, width: size, height: size },
        img ? { texture: { src: img } } : {}
      ),
      flags: { [MODULE_ID]: { spawned: true, kind: "marker", ownerUserId } }
    });
    if (!actor) return null;
    let tokenId = null;
    const scene = game.scenes?.get?.(sceneId);
    if (scene) {
      try {
        const td = (await actor.getTokenDocument({ x, y })).toObject();
        if (Number(elevation)) td.elevation = Number(elevation);
        // Tokens default to the scene's INITIAL level — a marker meant for a
        // dive level must carry the level id or it lands on the ground floor.
        if (levelId) td.level = String(levelId);
        td.flags = Object.assign({}, td.flags, { [MODULE_ID]: { spawned: true, ownerUserId } });
        const [c] = await scene.createEmbeddedDocuments("Token", [td]);
        tokenId = c.id;
      } catch (e) { console.warn(TAG, "marker token place failed", e); }
    }
    return { actorId: actor.id, tokenId, sceneId };
  });

  // A PRE-GEN from the master-content NPC compendium — full authored statblock,
  // real abilities, real art — cloned into the world as tutorial scaffolding
  // (flagged for teardown like every other spawn). `mergeDefenses` UNIONS a
  // teaching profile onto the authored block (e.g. resist kinetic / vuln
  // sephirotic for the sim's damage-type lesson) without erasing what the
  // bestiary author gave the creature.
  reg("spawnFromPack", async ({ sceneId, actorName = "", packId = "bbttcc-master-content.npcs",
                                x = 1000, y = 1000, elevation = 0, size = 0, displayName = "",
                                mergeDefenses = null, conditions = [], ownerUserId = "" }) => {
    const scene = game.scenes?.get?.(String(sceneId || ""));
    const pack = game.packs?.get?.(String(packId));
    if (!scene || !pack || !actorName) return null;
    try {
      const idx = pack.index.find(e => e.name === actorName);
      const src = idx ? await pack.getDocument(idx._id) : null;
      if (!src) { console.warn(TAG, `spawnFromPack: "${actorName}" not found in ${packId}`); return null; }
      const folder = await _folder();
      const data = src.toObject();
      delete data._id;
      if (displayName) data.name = displayName;
      data.folder = folder?.id ?? null;
      data.ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER };   // damage applies client-side
      data.flags = Object.assign({}, data.flags,
        { [MODULE_ID]: { spawned: true, kind: "foe", fromPack: `${packId}:${actorName}`, ownerUserId } });
      if (mergeDefenses) {
        const cur = foundry.utils.getProperty(data, "system.defenses") ?? {};
        const uni = (a, b) => [...new Set([...(a ?? []), ...(b ?? [])])];
        foundry.utils.setProperty(data, "system.defenses", {
          resistances:     uni(cur.resistances,     mergeDefenses.resistances),
          immunities:      uni(cur.immunities,      mergeDefenses.immunities),
          vulnerabilities: uni(cur.vulnerabilities, mergeDefenses.vulnerabilities)
        });
      }
      const actor = await Actor.create(data);
      if (!actor) return null;
      // Fill the tracks AFTER create — max is derived (same two-step spawnFoe uses).
      let integrityMax = 0;
      try {
        const sys = actor.system?.system ?? actor.system;
        integrityMax = Number(sys?.derived?.integrity?.max) || 0;
        await actor.update({
          "system.derived.integrity.value": integrityMax,
          "system.derived.stress.value": Number(sys?.derived?.stress?.max) || 0
        });
      } catch (e) { console.warn(TAG, "pack foe track fill failed", e); }
      for (const key of (Array.isArray(conditions) ? conditions : [])) {
        try { await game.fourththing?.toggleCondition?.(actor, String(key)); }
        catch (e) { console.warn(TAG, `spawnFromPack: condition "${key}" failed`, e); }
      }
      let tokenId = null;
      try {
        const td = (await actor.getTokenDocument({ x, y })).toObject();
        if (Number(elevation)) td.elevation = Number(elevation);
        if (Number(size)) { td.width = Number(size); td.height = Number(size); }
        td.disposition = CONST.TOKEN_DISPOSITIONS.HOSTILE;
        td.flags = Object.assign({}, td.flags, { [MODULE_ID]: { spawned: true, ownerUserId } });
        const [c] = await scene.createEmbeddedDocuments("Token", [td]);
        tokenId = c.id;
      } catch (e) { console.warn(TAG, "pack foe token place failed", e); }
      return { actorId: actor.id, tokenId, sceneId: scene.id, integrityMax, name: actor.name };
    } catch (e) { console.warn(TAG, "spawnFromPack failed", e); return null; }
  });

  // The great circle SEALS: a ring of movement-blocking, sight-transparent
  // walls laid on the painted circle, every segment flagged for surgical
  // removal. Idempotent — re-sealing replaces any previous ring. The parley
  // (or the beat's exit) unseals; nothing else on the scene is touched.
  reg("sealCircle", async ({ sceneId, cx = 0, cy = 0, radius = 700, segments = 24, ownerUserId = "" }) => {
    const scene = game.scenes?.get?.(String(sceneId || ""));
    if (!scene) return { ok: false };
    try {
      const old = scene.walls?.filter?.(w => w.flags?.[MODULE_ID]?.kind === "circleWall") ?? [];
      if (old.length) await scene.deleteEmbeddedDocuments("Wall", old.map(w => w.id));
      const MOVE = CONST.WALL_MOVEMENT_TYPES?.NORMAL ?? 20;
      const NONE = CONST.WALL_SENSE_TYPES?.NONE ?? 0;
      const walls = [];
      for (let i = 0; i < segments; i++) {
        const a1 = (i / segments) * 2 * Math.PI, a2 = ((i + 1) / segments) * 2 * Math.PI;
        walls.push({
          c: [Math.round(cx + radius * Math.cos(a1)), Math.round(cy + radius * Math.sin(a1)),
              Math.round(cx + radius * Math.cos(a2)), Math.round(cy + radius * Math.sin(a2))],
          move: MOVE, sight: NONE, light: NONE, sound: NONE, dir: 0, door: 0, ds: 0,
          flags: { [MODULE_ID]: { spawned: true, kind: "circleWall", ownerUserId } }
        });
      }
      const created = await scene.createEmbeddedDocuments("Wall", walls);
      return { ok: true, count: created.length };
    } catch (e) { console.warn(TAG, "sealCircle failed", e); return { ok: false }; }
  });

  reg("unsealCircle", async ({ sceneId }) => {
    const scene = game.scenes?.get?.(String(sceneId || ""));
    if (!scene) return { ok: false, removed: 0 };
    try {
      const ring = scene.walls?.filter?.(w => w.flags?.[MODULE_ID]?.kind === "circleWall") ?? [];
      if (ring.length) await scene.deleteEmbeddedDocuments("Wall", ring.map(w => w.id));
      return { ok: true, removed: ring.length };
    } catch (e) { console.warn(TAG, "unsealCircle failed", e); return { ok: false, removed: 0 }; }
  });

  // Combat staging handoff: load the tracker (combat + combatants for the
  // steward and every spawned foe) and whisper the GM why. The GM still rolls
  // initiative and presses Begin — nothing fights itself.
  reg("beginShowdownCombat", async ({ sceneId, actorIds = [], playerName = "" }) => {
    const scene = game.scenes?.get?.(String(sceneId || ""));
    if (!scene) return { ok: false };
    try {
      const ids = new Set((actorIds || []).map(String));
      const tokens = scene.tokens?.filter?.(t => ids.has(String(t.actorId))) ?? [];
      if (!tokens.length) return { ok: false };
      let combat = game.combats?.find?.(c => c.scene?.id === scene.id && !c.started) || null;
      if (!combat) combat = await Combat.create({ scene: scene.id });
      const have = new Set(combat.combatants.map(c => c.tokenId));
      const add = tokens.filter(t => !have.has(t.id)).map(t => ({ tokenId: t.id, sceneId: scene.id, actorId: t.actorId }));
      if (add.length) await combat.createEmbeddedDocuments("Combatant", add);
      try { await combat.activate?.(); } catch (_) {}
      await ChatMessage.create({
        whisper: game.users.filter(u => u.isGM).map(u => u.id),
        speaker: { alias: "◇ OPERATOR" },
        content: `<p><b>The circle is live — you're the table.</b> ${playerName || "The student"} has stepped into the` +
                 ` great circle and the hostiles are spawned.</p>` +
                 `<p>I've loaded the tracker (${tokens.length} combatants). Roll initiative and press <b>Begin Combat</b> —` +
                 ` you run the foes. When the big one starts losing, a <b>messenger</b> will interrupt with a parley.</p>`
      });
      return { ok: true, combatants: tokens.length };
    } catch (e) { console.warn(TAG, "beginShowdownCombat failed", e); return { ok: false }; }
  });

  // A courtly delegation NPC: a tableau-flagged token with pre-seeded court
  // favor toward THIS run's attacking faction and (optionally) a Mal-voice
  // persona carrying an armed extractable secret — so the courtly HUD's
  // roster, the favor economy, and the secrets probe all light up without any
  // hand setup. Idempotent per scene+name: replays reuse the standing court.
  reg("spawnCourtier", async ({ sceneId, x = 1000, y = 1000, name = "Courtier", img = "", size = 1,
                                favor = 0, favorFactionId = "", persona = "", secretLine = "", ownerUserId = "" }) => {
    const scene = game.scenes?.get?.(String(sceneId || ""));
    if (!scene) return null;
    const existing = scene.tokens?.find?.(t =>
      t.actor?.flags?.[MODULE_ID]?.kind === "courtier" && t.actor?.name === name);
    if (existing) {
      // Re-seed the authored disposition for THIS run's faction — a fresh
      // replay faction starts from the design, not a previous run's residue.
      if (existing.actor && favorFactionId) {
        try { await existing.actor.setFlag("bbttcc-raid", `courtFavor.${favorFactionId}`, Number(favor) || 0); }
        catch (e) { console.warn(TAG, "courtier favor re-seed failed", e); }
      }
      // Authored art that arrived after the court was first raised: dress a
      // courtier still wearing the placeholder, but never clobber art a GM
      // set by hand on the standing court.
      if (existing.actor && img) {
        try {
          const bare = (s) => !s || s === "icons/svg/mystery-man.svg";
          const patch = {};
          if (bare(existing.actor.img)) Object.assign(patch, { img, "prototypeToken.texture.src": img });
          if (Object.keys(patch).length) await existing.actor.update(patch);
          if (bare(existing.texture?.src)) await existing.update({ "texture.src": img });
        } catch (e) { console.warn(TAG, "courtier art refresh failed", e); }
      }
      return { actorId: existing.actor?.id ?? null, tokenId: existing.id, sceneId: scene.id, reused: true };
    }
    const folder = await _folder();
    const flags = { [MODULE_ID]: { spawned: true, kind: "courtier", ownerUserId } };
    if (favorFactionId && Number(favor)) flags["bbttcc-raid"] = { courtFavor: { [favorFactionId]: Number(favor) } };
    if (persona || secretLine) {
      flags["bbttcc-mal-voice"] = { persona: Object.assign({},
        persona ? { notes: persona } : {}, secretLine ? { secretsRaw: secretLine } : {}) };
    }
    const actor = await Actor.create({
      name, type: "npc", folder: folder?.id, img: img || "icons/svg/mystery-man.svg",
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
      prototypeToken: Object.assign(
        { actorLink: false, disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL, name, width: size, height: size },
        img ? { texture: { src: img } } : {}
      ),
      flags
    });
    if (!actor) return null;
    let tokenId = null;
    try {
      const td = (await actor.getTokenDocument({ x, y })).toObject();
      // Belt-and-braces: the tableau auto-enrol hook covers live drops, but
      // the courtly HUD roster reads tableauActor directly — stamp it in the
      // create data so the courtier exists no matter which client spawned it.
      td.flags = Object.assign({}, td.flags,
        { [MODULE_ID]: { spawned: true, ownerUserId } },
        { "bbttcc-raid": { tableauActor: true } });
      const [c] = await scene.createEmbeddedDocuments("Token", [td]);
      tokenId = c.id;
    } catch (e) { console.warn(TAG, "courtier token place failed", e); }
    return { actorId: actor.id, tokenId, sceneId: scene.id };
  });

  // Reaching into a sigil costs something. Routed through the system's own
  // damage pipeline so resistances, the Noise/radiation penalties and every
  // on-damage-taken trigger all behave exactly as they would in a real fight.
  reg("hurt", async ({ actorId, formula = "1d6", type = "kinetic", flavor = "" }) => {
    const actor = game.actors?.get?.(String(actorId || ""));
    if (!actor) return { ok: false, amount: 0 };
    let total = 0;
    try {
      const r = new Roll(String(formula || "1d6"));
      await r.evaluate();
      total = Math.max(0, Number(r.total) || 0);
      await game.fourththing?.rolls?._applyDamageToActor?.(actor, total, {
        op: "damage", track: "integrity", damageType: type, damageFlavor: flavor
      });
    } catch (e) { console.warn(TAG, "hurt failed", e); return { ok: false, amount: 0 }; }
    return { ok: true, amount: total };
  });

  // The healing water. Clamped to max — a boon that overfills a track would
  // quietly break the sheet's arithmetic.
  reg("mend", async ({ actorId, formula = "2d6" }) => {
    const actor = game.actors?.get?.(String(actorId || ""));
    if (!actor) return { ok: false, amount: 0 };
    try {
      const r = new Roll(String(formula || "2d6"));
      await r.evaluate();
      const sys = actor.system?.system ?? actor.system;
      const cur = Number(sys?.derived?.integrity?.value) || 0;
      const max = Number(sys?.derived?.integrity?.max) || cur;
      const healed = Math.max(0, Math.min(max - cur, Number(r.total) || 0));
      if (healed > 0) await actor.update({ "system.derived.integrity.value": cur + healed });
      return { ok: true, amount: healed };
    } catch (e) { console.warn(TAG, "mend failed", e); return { ok: false, amount: 0 }; }
  });

  // Hand a Courtly Secret to a faction. The secrets API wants a real Document
  // for `source.toObject()`, so the template is minted IN MEMORY (`new Item`) —
  // no compendium authoring, nothing persisted but the granted copy. addSecret
  // reads effectKey from opts when the source carries none, and "earned"
  // (rather than "stolen") means playing it costs no suspicion.
  reg("grantSecret", async ({ factionId, name, effectKey, text = "", img = "icons/svg/secret.svg" }) => {
    const api = globalThis.game?.bbttcc?.api?.raid?.courtlySecrets;
    const faction = game.actors?.get?.(String(factionId || ""));
    if (!api?.addSecret || !faction || !name || !effectKey) return { ok: false };
    try {
      const template = new Item({ name, type: "feat", img, system: { description: { value: text } } });
      const created = await api.addSecret(faction.id, template, { acquisition: "earned", effectKey });
      return created ? { ok: true, name: created.name, itemId: created.id } : { ok: false };
    } catch (e) { console.warn(TAG, "grantSecret failed", e); return { ok: false }; }
  });

  reg("ensureToken", async ({ actorId, sceneId, x = 1000, y = 1000, move = false, ownerUserId = "" }) => {
    const actor = game.actors?.get?.(actorId);
    const scene = game.scenes?.get?.(sceneId);
    if (!actor || !scene) return { tokenId: null, created: false, sceneId };
    const existing = scene.tokens?.find(t => t.actorId === actor.id);
    if (existing) {
      // move:true = the beat means "AT this spot", not just "on this scene" —
      // the showdown's "step into the circle" was silently a no-op for a token
      // that already stood elsewhere on the map (owner playtest 2026-08-22).
      if (move) {
        try { await existing.update({ x: Number(x) || 0, y: Number(y) || 0 }); }
        catch (e) { console.warn(TAG, "ensureToken move failed", e); }
      }
      return { tokenId: existing.id, created: false, moved: !!move, sceneId };
    }
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
    const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    // Idempotent: a faction that already owns a rig gets that one back, never a twin.
    const existing = (game.actors?.contents ?? []).find(a => a.type === "rig" &&
      (a.getFlag?.("fourththing", "factionOwnerId") === factionId || a.system?.identity?.factionOwnerId === factionId));
    if (existing) {
      // 🔒 owner ruling 2026-08-17 — the starter rig is the player's REAL rig and
      // stays theirs after graduation, so a same-character replay hands the SAME
      // vehicle back. Re-assert the grant on the way through: a rig minted before
      // ownership was wired (or one whose grant got lost) would otherwise come
      // back un-drivable, and boarding now needs OWNER to move the rig's token.
      // Promote-only — never lowers a level the GM raised.
      if (userId && Number(existing.ownership?.[userId] ?? 0) < OWNER) {
        try { await existing.update({ ownership: { ...(existing.ownership ?? {}), [userId]: OWNER } }); }
        catch (e) { console.warn(TAG, "mintRig: re-grant OWNER on existing rig failed", e); }
      }
      // Pre-flight service (owner playtest 2026-08-29): the engine deliberately
      // never clears rig heat — only vent-heat reduces — so a replay hands the
      // student a rig still cooking from its last session's free-fire, at worst
      // wearing the Overheated weapon-lock from spawn. Tutorial rigs start
      // cold; the live-world heat doctrine is untouched.
      try {
        if ((Number(existing.flags?.fourththing?.combat?.heat) || 0) > 0) {
          await existing.update({ "flags.fourththing.combat.heat": 0 });
        }
        const oh = (existing.effects ?? []).find(e => e.getFlag?.("fourththing", "rigState") === "overheat");
        if (oh) await existing.deleteEmbeddedDocuments("ActiveEffect", [oh.id]);
      } catch (e) { console.warn(TAG, "mintRig: pre-flight heat vent failed", e); }
      return { rigId: existing.id, existed: true };
    }

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
    // The onboarding player OWNS their starter rig — sheet, tour, crew slots, and
    // (2026-08-17) the token itself, which boarding now hands them the controls of.
    if (userId) overrides.ownership = { default: 0, [userId]: OWNER };

    const rig = await rb.mintFromChassis(chassis, { factionOwnerId: factionId, free: true, overrides });
    return { rigId: rig?.id || null };
  });

  // Make sure the onboarding player actually OWNS the actors the tutorial drives.
  // Everything downstream — Market buyer list (players only see factions they own),
  // raid console writes, faction/rig sheet edits — silently fails without it, and
  // a faction founded before the ownership grant existed (or one whose grant was
  // lost) produces exactly the "lacks permission to update Actor" wall.
  reg("ensureOwned", async ({ actorIds = [], userId }) => {
    if (!userId) return { ok: false, granted: [] };
    const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    const granted = [];
    for (const id of actorIds) {
      const a = game.actors?.get?.(String(id || ""));
      if (!a) continue;
      if ((a.ownership?.[userId] ?? 0) >= OWNER) continue;
      try {
        await a.update({ ownership: { ...(a.ownership ?? {}), [userId]: OWNER } });
        granted.push(a.name);
      } catch (e) { console.warn(TAG, "ensureOwned failed for", a.name, e); }
    }
    if (granted.length) console.log(TAG, "ensureOwned granted OWNER on:", granted.join(", "));
    return { ok: true, granted };
  });

  // Training stipend — TOP UP the faction's OP banks so tutorial Travel / raid
  // maneuvers are never money-locked.
  //
  // 2026-08-15 — was `commit(marks, {allowOvercap:true})`, i.e. ADD this much,
  // ceiling be damned, every single run. Eleven playtest runs left a Tier-0
  // faction holding 143 OP against a 5 OP cap (owner: "op totals look strange").
  // Now: credit at most `marks[pool]`, and never past the faction's own per-bucket
  // cap — so it fills an empty bank, tops up a spent one, and is a no-op on a full
  // one. Replay-safe by construction, and it can't invent OP the tier can't hold.
  reg("grantOp", async ({ factionId, marks = {} }) => {
    const op = globalThis.game?.bbttcc?.api?.op;
    if (!op?.commit || !op?.preview || !factionId) return { ok: false, granted: {} };
    try {
      const state = await op.preview(factionId, {}, {});   // read current banks + caps
      const before = state?.before || {};
      const caps   = state?.caps   || {};
      const deltas = {};
      for (const [pool, want] of Object.entries(marks)) {
        const cap = Number(caps[pool]);
        const cur = Number(before[pool]) || 0;
        const room = Number.isFinite(cap) && cap > 0 ? cap - cur : Number(want) || 0;
        const give = Math.max(0, Math.min(Number(want) || 0, room));
        if (give > 0) deltas[pool] = give;
      }
      if (!Object.keys(deltas).length) return { ok: true, granted: {}, alreadyFull: true };
      const r = await op.commit(factionId, deltas, { context: "onboarding-stipend" });
      return { ok: r?.ok !== false, granted: deltas };
    } catch (e) { console.warn(TAG, "grantOp failed", e); return { ok: false, granted: {} }; }
  });

  // Destructible tutorial scenery (Test Track wrecks). default-OWNER so any player's
  // damage application lands; flagged spawned so teardown can only ever delete these.
  reg("spawnObstacle", async ({ sceneId, x = 1000, y = 1000, name = "Rusted Wreck", img = "", size = 2, integrity = 12, bracket = "light", loadout = null, ownerUserId = "" }) => {
    const folder = await _folder();
    // RIG-typed (2026-08-17): these are derelict vehicles, so they should BE rigs —
    // npc-typed wrecks got the steward sheet (faculties, Clarity, manifestations)
    // and a 10-point npc integrity track that shrugged off ramming. As rigs they
    // take ram/weapon damage on `system.integrity`, run the destruction cascade,
    // and fire `bbttcc:rig:destroyed` — which is what the driving beat now gates on.
    // (Last Stand is character-only, so rigs stay clear of the dying cycle too.)
    const hp = Math.max(1, Number(integrity) || 12);
    const actor = await Actor.create({
      name, type: "rig", folder: folder?.id, img: img || "icons/svg/hazard.svg",
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
      prototypeToken: Object.assign(
        { actorLink: false, disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE, name, width: size, height: size },
        img ? { texture: { src: img } } : {}
      ),
      system: {
        identity: { mobility: "stationary", state: "parked", factionOwnerId: "" },
        integrity: { value: hp, max: hp, tier: 1, bracket }
      },
      flags: { [MODULE_ID]: { spawned: true, kind: "obstacle", ownerUserId } }
    });
    if (!actor) return null;
    // Optional ARMAMENT (2026-08-27): the sim's gun-truck is fictionally an
    // armed vehicle the GM shoots back with, but a bare obstacle spawned with
    // no weapons or plating (owner's first wave-3 test). Seed named items from
    // the same master-content catalog the rigBuilder chassis loadouts use —
    // any name that misses the compendium is skipped, never fatal.
    if (loadout && (loadout.weapons?.length || loadout.systems?.length)) {
      try {
        const pack = game.packs?.get?.("bbttcc-master-content.items");
        const idx = pack ? await pack.getIndex() : null;
        const toCreate = [];
        for (const nm of [...(loadout.weapons ?? []), ...(loadout.systems ?? [])]) {
          const hit = idx?.find?.(e => e.name === nm);
          if (!hit) { console.warn(TAG, `obstacle loadout item not in compendium: ${nm}`); continue; }
          const doc = await pack.getDocument(hit._id);
          const data = doc?.toObject?.();
          if (data) { delete data._id; toCreate.push(data); }
        }
        if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
      } catch (e) { console.warn(TAG, "obstacle loadout seed failed", e); }
    }
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
          // Seeded bank (2026-08-22): a bankless defender can't stage, can't
          // spend in scenario dialogs, and never shows players the defender
          // side of raid math — the whole tutorial fought a ghost with empty
          // pockets. 5 OP (50 marks) in each raid-relevant key, tier-0 caps,
          // stamped marks-migrated so the sweep never inflates it.
          "bbttcc-factions": {
            isFaction: true, disposition: "hostile",
            opBank: { violence: 50, nonlethal: 50, intrigue: 50, softpower: 50, diplomacy: 50, economy: 20, logistics: 20, culture: 0, faith: 0 },
            opBankMarksMigrated: true
          },
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

  // Raids are GM-DRIVEN: the console's attacker picker, round commit and end-raid
  // controls all live behind {{#if isGM}}. A player can stage OP into their
  // commitments but cannot open or resolve a round. So the tutorial hands the GM
  // the console already pointed at the student's faction, and whispers why.
  reg("openRaidConsoleForGM", async ({ factionId, playerName = "", activityKey = "", sceneId = "" }) => {
    const raid = globalThis.game?.bbttcc?.api?.raid;
    const faction = game.actors?.get?.(String(factionId || ""));
    if (!raid?.openConsole || !faction) return { ok: false };
    try {
      // A courtly raid needs the GM VIEWING the tableau scene — the console's
      // _isCourtlyKey gate reads canvas.scene, so pull the GM onto the court
      // before opening and tell them to stay there while rounds run.
      let court = null;
      if (sceneId) {
        court = game.scenes?.get?.(String(sceneId)) ?? null;
        if (court && canvas?.scene?.id !== court.id) {
          try { await court.view(); } catch (e) { console.warn(TAG, "GM court view failed", e); }
        }
      }
      await raid.openConsole({ factionId: faction.id });
      await ChatMessage.create({
        whisper: game.users.filter(u => u.isGM).map(u => u.id),
        speaker: { alias: "◇ OPERATOR" },
        content: `<p><b>Onboarding raid — you're the table.</b> ${playerName || "A student"} has reached the` +
                 ` <b>${activityKey || "raid"}</b> stage against the Rust Syndicate, attacking as <b>${faction.name}</b>.</p>` +
                 `<p>Their console is staging-only; round setup and commits are GM-side. I've opened yours on their faction —` +
                 ` run a round or two, then they'll conclude the beat themselves.</p>` +
                 (court ? `<p><b>Stay on "${court.name}" while you run it</b> — the Courtly engine only engages while` +
                          ` the tableau scene is the one you're viewing.</p>` : "")
      });
      return { ok: true };
    } catch (e) { console.warn(TAG, "openRaidConsoleForGM failed", e); return { ok: false }; }
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

  // STALE-SCAFFOLDING SWEEP: the Proving Ground hosts four different beats
  // (meatsuit, combat_sim, proving_trials, final_showdown) plus replays, and a
  // crashed or interrupted run leaks its props — sigil markers, dead foes,
  // dive shards — onto the shared stage (owner's fresh 2026-08-27 run opened
  // on TWO "The Deep" markers from prior sessions). Called at the entry of
  // every Proving-Ground beat. Reaps tokens whose ACTOR is spawned-flagged
  // (markers, foes, obstacles, dummies — never a real Steward's or rig's
  // token) plus those actors, honoring teardownFinale's ownership rules:
  // own props always, untagged/legacy only when no other run is live.
  // Courtiers are exempt — the standing court persists by design.
  reg("sweepSceneScaffolding", async ({ sceneId = "", ownerUserId = "", keepActorIds = [] } = {}) => {
    const scene = game.scenes?.get?.(String(sceneId || ""));
    if (!scene) return { ok: false, tokens: 0, actors: 0 };
    const runs = _readRuns();
    const othersLive = Object.keys(runs).filter(u => u !== ownerUserId).length > 0;
    const keep = new Set((keepActorIds || []).map(String));
    // Sweepable = mine, OR tagged to a user with NO live run (a previous
    // tenant — owner 2026-08-27: Marginalia still standing on the Test Track
    // days after her run), OR untagged legacy when nobody else is mid-run.
    const sweepable = (owner) => {
      if (owner && ownerUserId && owner === ownerUserId) return true;
      if (owner) return !runs[owner];
      return !othersLive;
    };
    const tokDel = [];
    const actorIds = new Set();
    for (const t of (scene.tokens?.contents ?? Array.from(scene.tokens ?? []))) {
      if (keep.has(String(t.actorId))) continue;                          // current run's props stay
      const a = t.actor;
      const actorSpawned = a?.getFlag?.(MODULE_ID, "spawned") === true;
      const tokenSpawned = t.getFlag?.(MODULE_ID, "spawned") === true;
      const owner = a?.getFlag?.(MODULE_ID, "ownerUserId") || t.getFlag?.(MODULE_ID, "ownerUserId") || "";
      if (actorSpawned) {
        // Scaffolding prop (marker/foe/obstacle/dummy): token AND actor go.
        if (a.getFlag?.(MODULE_ID, "kind") === "courtier") continue;      // standing court persists
        if (!sweepable(owner)) continue;
        tokDel.push(t.id);
        if (t.actorId) actorIds.add(t.actorId);
      } else if (tokenSpawned) {
        // A REAL actor's token the tutorial placed (steward/rig): the TOKEN
        // goes — a previous tenant's stays gone, our own gets re-placed by
        // the beat right after this sweep (every sweeping beat re-ensures its
        // tokens; re-creating also refreshes a stale token NAME after a rig
        // rename). The actor itself is never touched.
        if (!sweepable(owner)) continue;
        tokDel.push(t.id);
      }
    }
    let nT = 0, nA = 0;
    if (tokDel.length) {
      try { await scene.deleteEmbeddedDocuments("Token", tokDel); nT = tokDel.length; }
      catch (e) { console.warn(TAG, "sweep token delete failed", e); }
    }
    for (const id of actorIds) {
      try {
        const a = game.actors?.get?.(id);
        // Hostile factions are finale infrastructure with their own teardown.
        if (a?.getFlag?.(MODULE_ID, "spawned") && a.getFlag?.(MODULE_ID, "kind") !== "hostileFaction") { await a.delete(); nA++; }
      } catch (_) {}
    }
    if (nT || nA) console.log(TAG, `sweepSceneScaffolding: reaped ${nT} stale token(s) / ${nA} actor(s) on "${scene.name}".`);
    return { ok: true, tokens: nT, actors: nA };
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

  console.log(TAG, "GM ops registered: spawnDummy, spawnObstacle, spawnFoe, raiseDarkness, foeSurrender, shoveOffPerch, spawnMarker, spawnCourtier, hurt, mend, grantSecret, setElevation, ensureToken, mintRig, ensureSandboxHex, claimHex, unclaimHex, disembark, spawnHostileFaction, ensureHex, setRaidSession, clearRaidSession, teardownFinale, cleanup.");
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

async function runPing(userId) {
  return (await _runAsGM("runPing", { userId })) ?? { ok: false };
}
/** Who else is mid-tutorial? Returns { others: [...], count }. */
async function runList(exceptUserId = "") {
  return (await _runAsGM("runList", { exceptUserId })) ?? { others: [], count: 0 };
}

/** Ensure `actor` has a token on `scene`. Returns { doc, created }. */
async function ensureTokenOnScene(actor, scene, { x = 1000, y = 1000, move = false } = {}) {
  if (!actor || !scene) return { doc: null, created: false };
  const res = await _runAsGM("ensureToken", { actorId: actor.id, sceneId: scene.id, x, y, move, ..._ownedBy() });
  const doc = res?.tokenId ? await _ns()?.relay?.resolveToken?.(res.sceneId, res.tokenId) : null;
  return { doc: doc || null, created: !!res?.created, moved: !!res?.moved };
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

/** Grant the player OWNER on the actors the tutorial drives (faction / rig / steward). */
async function ensureOwned(actorIds = [], userId = "") {
  const uid = userId || _run.userId || game.user?.id;
  const ids = (Array.isArray(actorIds) ? actorIds : [actorIds]).filter(Boolean);
  if (!ids.length || !uid) return { ok: false, granted: [] };
  return (await _runAsGM("ensureOwned", { actorIds: ids, userId: uid })) ?? { ok: false, granted: [] };
}

/** Top up the faction's OP banks toward cap (training stipend). marks = per-pool ceiling
 *  to credit, e.g. { economy: 130, ... }. Never exceeds the faction's per-bucket cap.
 *  Returns { ok, granted:{pool:marks}, alreadyFull? }. */
async function grantOp(factionId, marks = {}) {
  if (!factionId) return { ok: false, granted: {} };
  return (await _runAsGM("grantOp", { factionId, marks })) ?? { ok: false, granted: {} };
}

/** Spawn an inert relic marker + token on `scene`. Returns { actor, token } or null. */
async function spawnMarker(scene, opts = {}) {
  const res = await _runAsGM("spawnMarker", { sceneId: scene?.id, ...opts, ..._ownedBy() });
  if (!res?.actorId) return null;
  const actor = await _ns()?.relay?.resolveActor?.(res.actorId);
  const token = res.tokenId ? await _ns()?.relay?.resolveToken?.(res.sceneId, res.tokenId) : null;
  return { actor: actor || null, token: token || null };
}

/** Sweep STALE onboarding scaffolding off a scene (prior/crashed runs'
 *  markers, foes, dummies). Own props always; legacy only when alone. */
async function sweepScene(scene, { keepActorIds = [] } = {}) {
  if (!scene?.id) return { ok: false, tokens: 0, actors: 0 };
  return (await _runAsGM("sweepSceneScaffolding", { sceneId: scene.id, keepActorIds, ..._ownedBy() }))
    ?? { ok: false, tokens: 0, actors: 0 };
}

/** Clone a pre-gen NPC out of the master-content compendium onto a scene.
 *  opts: {actorName, packId?, x, y, elevation, size, displayName,
 *         mergeDefenses:{resistances,immunities,vulnerabilities}, conditions}. */
async function spawnFromPack(scene, opts = {}) {
  if (!scene?.id) return null;
  const res = await _runAsGM("spawnFromPack", { sceneId: scene.id, ...opts, ..._ownedBy() });
  if (!res?.actorId) return null;
  const actor = await _ns()?.relay?.resolveActor?.(res.actorId);
  const token = res.tokenId ? await _ns()?.relay?.resolveToken?.(res.sceneId, res.tokenId) : null;
  return { actor: actor || null, token: token || null, integrityMax: res.integrityMax ?? 0 };
}

/** Seal the great circle: a ring of movement-blocking walls at (cx,cy). */
async function sealCircle(scene, { cx = 0, cy = 0, radius = 700, segments = 24 } = {}) {
  if (!scene?.id) return { ok: false };
  return (await _runAsGM("sealCircle", { sceneId: scene.id, cx, cy, radius, segments, ..._ownedBy() })) ?? { ok: false };
}

/** Remove the sealed circle's wall ring (parley, beat exit). */
async function unsealCircle(scene) {
  if (!scene?.id) return { ok: false, removed: 0 };
  return (await _runAsGM("unsealCircle", { sceneId: scene.id })) ?? { ok: false, removed: 0 };
}

/** Load the GM's combat tracker with the showdown participants + whisper why. */
async function beginShowdownCombat(scene, actorIds = [], { playerName = "" } = {}) {
  if (!scene?.id || !actorIds?.length) return { ok: false };
  return (await _runAsGM("beginShowdownCombat", { sceneId: scene.id, actorIds, playerName })) ?? { ok: false };
}

/** Spawn (or reuse) a courtly delegation NPC on a tableau scene.
 *  opts: {x,y,name,img,favor,favorFactionId,persona,secretLine}. */
async function spawnCourtier(scene, opts = {}) {
  if (!scene?.id) return null;
  const res = await _runAsGM("spawnCourtier", { sceneId: scene.id, ...opts, ..._ownedBy() });
  if (!res?.actorId) return null;
  const actor = await _ns()?.relay?.resolveActor?.(res.actorId);
  const token = res.tokenId ? await _ns()?.relay?.resolveToken?.(res.sceneId, res.tokenId) : null;
  return { actor: actor || null, token: token || null, reused: !!res.reused };
}

/** Move an actor's token(s) to an elevation AND (v14) a scene level — elevation
 *  alone never re-homes a token; pass levelId to actually change floors.
 *  Returns { ok, from, to, fromLevel, toLevel, tokenIds } so the caller can
 *  restore both the height and the level, and follow the view down. */
async function setElevation(scene, actorId, elevation = 0, levelId = "") {
  if (!scene?.id || !actorId) return { ok: false, from: 0 };
  return (await _runAsGM("setElevation", { sceneId: scene.id, actorId, elevation, levelId })) ?? { ok: false, from: 0 };
}

/** Apply damage through the system's own pipeline. opts: {formula,type,flavor}. */
async function hurt(actorId, { formula = "1d6", type = "kinetic", flavor = "" } = {}) {
  if (!actorId) return { ok: false, amount: 0 };
  return (await _runAsGM("hurt", { actorId, formula, type, flavor })) ?? { ok: false, amount: 0 };
}

/** Heal integrity, clamped to max. */
async function mend(actorId, formula = "2d6") {
  if (!actorId) return { ok: false, amount: 0 };
  return (await _runAsGM("mend", { actorId, formula })) ?? { ok: false, amount: 0 };
}

/** Grant a Courtly Secret to a faction (minted in memory — no pack authoring). */
async function grantSecret(factionId, { name, effectKey, text = "", img } = {}) {
  if (!factionId || !name || !effectKey) return { ok: false };
  return (await _runAsGM("grantSecret", { factionId, name, effectKey, text, img })) ?? { ok: false };
}

/** Spawn a combat-simulator foe + token. opts: {x,y,elevation,name,img,size,foeClass,body,level,
 *  resistances,vulnerabilities}. Returns { actor, token, integrityMax } or null. */
async function spawnFoe(scene, opts = {}) {
  const res = await _runAsGM("spawnFoe", { sceneId: scene?.id, ...opts, ..._ownedBy() });
  if (!res?.actorId) return null;
  const actor = await _ns()?.relay?.resolveActor?.(res.actorId);
  const token = res.tokenId ? await _ns()?.relay?.resolveToken?.(res.sceneId, res.tokenId) : null;
  return { actor: actor || null, token: token || null, integrityMax: Number(res.integrityMax) || 0 };
}

/** Add to an actor's Darkness track (0–10, manual — nothing else writes it). Returns {ok,before,after}. */
async function raiseDarkness(actorId, amount = 1, reason = "") {
  if (!actorId) return { ok: false, before: 0, after: 0 };
  return (await _runAsGM("raiseDarkness", { actorId, amount, reason })) ?? { ok: false, before: 0, after: 0 };
}

/** A sentient foe folds: Calmed + integrity floored so a stray hit can't finish them. */
async function foeSurrender(actorId, holdAt = 1) {
  if (!actorId) return { ok: false };
  return (await _runAsGM("foeSurrender", { actorId, holdAt })) ?? { ok: false };
}

/** Knock an elevated foe off its perch: token to ground + impact damage + Prone. */
async function shoveOffPerch(scene, tokenId, actorId, formula = "2d6") {
  if (!scene?.id || !tokenId || !actorId) return { ok: false, damage: 0 };
  return (await _runAsGM("shoveOffPerch", { sceneId: scene.id, tokenId, actorId, formula })) ?? { ok: false, damage: 0 };
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

/** Open the GM's raid console on this faction + whisper them why (raids are GM-run). */
async function openRaidConsoleForGM(factionId, { playerName = "", activityKey = "", sceneId = "" } = {}) {
  if (!factionId) return { ok: false };
  return (await _runAsGM("openRaidConsoleForGM", { factionId, playerName, activityKey, sceneId })) ?? { ok: false };
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
    ensureTokenOnScene, spawnDummy, spawnObstacle, mintRig, grantOp, ensureOwned, disembark,
    spawnFoe, raiseDarkness, foeSurrender, shoveOffPerch,
    spawnMarker, spawnCourtier, spawnFromPack, hurt, mend, grantSecret, setElevation,
    sealCircle, unsealCircle, beginShowdownCombat, sweepScene,
    ensureSandboxHex, claimHex, unclaimHex, spawnHostileFaction, ensureHex,
    setRaidSession, clearRaidSession, openRaidConsoleForGM, teardownFinale, cleanup, folder: _folder,
    setRunContext, runContext, runBegin, runEnd, runPing, runList, laneFrac: _laneFrac
  };
});

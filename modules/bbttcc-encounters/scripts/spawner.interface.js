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
      let actor = await resolveActor(spec.actor);
      if (!actor) {
        warn("spawnTokens: actor not found", spec.actor);
        continue;
      }
      // A compendium actor cannot back a token (v14 has no actorData field — the token would have no actor):
      // import it into the world first and spawn from the world copy.
      if (actor.pack && !game.actors?.get?.(actor.id)) {
        try {
          // Reuse a copy imported earlier (no duplicate world actors per spawn).
          const prior = game.actors?.find?.(a => a?._stats?.compendiumSource === actor.uuid) || null;
          const pack = game.packs?.get(actor.pack);
          const imported = prior || (pack ? await game.actors.importFromCompendium(pack, actor.id) : null);
          if (imported) actor = imported;
        } catch (e) { warn("spawnTokens: compendium import failed", spec.actor, e); }
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

      // Tokens need a World actor (compendium actors were imported above).
      if (!isWorldActor) {
        warn("spawnTokens: no world actor to back the token; skipped", spec.actor);
        continue;
      }
      tokenObj.actorId = actor.id;

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

      // Encounter flags. `spawned` (2026-11-13) marks every token this spawner makes, so the fight's end can take it away
      // again (clearSpawned); pre-placed story tokens never carry it and are never removed.
      const _sb = spec.spawnedBy || "external";
      const _p = parseSpawnedBy(_sb);
      const _beatId = spec.beatId ?? _p.beatId ?? null;
      tokenObj.flags = {
        ...(tokenObj.flags || {}),
        "bbttcc-encounters": {
          spawnedBy: _sb,
          role: spec.role || "npc",
          spawned: {
            beatId: _beatId,
            encounterKey: spec.encounterKey ?? _p.encounterKey ?? _beatId ?? _sb,
            at: Date.now(),
            kind: spawnKind({ role: spec.role || "npc", spawnedBy: _sb, disposition: tokenObj.disposition })
          }
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


  // foesOnly (2026-11-13): the concrete spawners share one key between the party they drop and their foes. Once the foes are
  // cleared at the fight's end, Stewards still standing on the map must not read as "this encounter is already here".
  function hasSpawnedFlag(scene, spawnedByKey, { foesOnly = false } = {}) {
    if (!scene || !spawnedByKey) return false;
    for (const doc of iterTokenDocs(scene)) {
      const flags = doc?.flags?.["bbttcc-encounters"];
      if (flags?.spawnedBy !== spawnedByKey) continue;
      if (foesOnly && spawnInfo(doc)?.kind !== "foe") continue;
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // SPAWNED-TOKEN CLEANUP (Dave 2026-11-13: "Can we remove the tokens on encounter completion automatically?")
  // Road fights reuse story maps; foes the spawner dropped used to stay after the win/loss/run and join the next fight.
  // Every spawner token carries flags.bbttcc-encounters.spawned = { beatId, encounterKey, at, kind }; tokens from before
  // the flag are read from their old spawnedBy string. kind: "foe" (hostile NPC), "pc" (a Steward drop), "ally"
  // (non-hostile NPC), "actor" (a scene_transition beat's actors[]). Only foes are ever removed automatically.
  // Completion signals (all GM-side, the client that ran the beat or the active GM):
  //   - bbttcc:beat:stageReady on an OUTCOME beat (…_win/_lose/_run/_won/_lost, or a terminal outcome_trigger of the
  //     fight) → that encounter's foes go (the road Win/Lose/Run beats carry the fight's sceneId, so this lands on the
  //     press). A NON-fight beat staged on a map clears that map's spawned foes (the story moved on there).
  //   - bbttcc:beat:resolved: an outcome beat, or a fight beat whose choice was taken (the campaign engine awaits the
  //     whole chain under a pick, so its resolve comes after everything the fight led to).
  //   - deleteCombat on a scene (End Combat), a beat after a short delay so the system's own deleteCombat handlers read
  //     their combatants first.
  //   - bbttcc:encounterChainSettled (the travel ride resumes) and the Encounter Engine's Apply Outcome (scene.launcher).
  // A cleared encounter is not topped up again by a later beat of the same fight (its Outcomes menu re-staging after End
  // Combat); its own opening beat staging again is a new fight and spawns fresh.
  // ---------------------------------------------------------------------------
  const MOD_ID = "bbttcc-encounters";
  const OUTCOME_ID_RE = /_(win|lose|run|won|lost|parley_success)$/i;
  const CLEARED_MEMO_MS = 3 * 60 * 60 * 1000;
  const _cleared = new Map();   // `${sceneId}|${encounterKey}` → { ts, beatId }

  function parseSpawnedBy(sb) {
    const s = String(sb || "");
    let m;
    if ((m = /^enc:([^:]+)/.exec(s))) return { beatId: m[1], encounterKey: null, kind: null };
    if ((m = /^pc_party(?::(.*))?$/.exec(s))) return { beatId: m[1] || null, encounterKey: null, kind: "pc" };
    if ((m = /^campaign:[^:]*:(.+)$/.exec(s))) return { beatId: m[1], encounterKey: null, kind: "actor" };
    return { beatId: null, encounterKey: s || null, kind: null };
  }
  function spawnKind({ role, spawnedBy, disposition } = {}) {
    if (role === "pc") return "pc";
    const pk = parseSpawnedBy(spawnedBy).kind;
    if (pk) return pk;
    const HOST = globalThis.CONST?.TOKEN_DISPOSITIONS?.HOSTILE ?? -1;
    return (disposition == null || Number(disposition) === HOST) ? "foe" : "ally";
  }
  /** What the spawner knows about a token, or null for a token it never made. */
  function spawnInfo(t) {
    const f = t?.flags?.[MOD_ID];
    if (!f || (!f.spawnedBy && !f.spawned)) return null;
    const s = (f.spawned && typeof f.spawned === "object") ? f.spawned : {};
    const p = parseSpawnedBy(f.spawnedBy);
    const beatId = s.beatId ?? p.beatId ?? null;
    return {
      beatId,
      encounterKey: s.encounterKey ?? p.encounterKey ?? beatId ?? (f.spawnedBy || null),
      at: Number(s.at) || 0,
      kind: s.kind || spawnKind({ role: f.role, spawnedBy: f.spawnedBy, disposition: t?.disposition })
    };
  }
  function _related(info, { encounterKey = null, beatId = null, family = null } = {}) {
    if (encounterKey && info.encounterKey === encounterKey) return true;
    if (beatId && info.beatId === beatId) return true;
    if (family && info.beatId && (family === info.beatId || String(family).startsWith(info.beatId + "_") || String(info.beatId).startsWith(family + "_"))) return true;
    return false;
  }
  /** Pure: which tokens a clear takes. sel: { encounterKey, beatId, family, except:{…same}, includePcs, onlyDefeated(t) }. */
  function selectSpawned(tokens, sel = {}) {
    const filtered = !!(sel.encounterKey || sel.beatId || sel.family);
    const out = [];
    for (const t of tokens) {
      const info = spawnInfo(t); if (!info) continue;
      if (!(info.kind === "foe" || (sel.includePcs && info.kind === "pc"))) continue;
      if (filtered && !_related(info, sel)) continue;
      if (sel.except && _related(info, sel.except)) continue;
      if (typeof sel.onlyIf === "function" && !sel.onlyIf(t, info)) continue;
      out.push({ t, info });
    }
    return out;
  }

  // Beat shape helpers (pure)
  const _beatChoices = (b) => (Array.isArray(b?.choices) ? b.choices : []);
  const isFightBeat = (b) => !!String(b?.encounter?.actorName || "").trim();
  const isTerminalBeat = (b) => !_beatChoices(b).some(ch => String(ch?.next || "").trim() || String(ch?.failNext || "").trim());
  /** A beat that says how a fight ended: …_win/_lose/_run/_won/_lost/_parley_success, or the fight's own terminal outcome_trigger. */
  function isCompletionBeat(b) {
    if (!b?.id) return false;
    if (OUTCOME_ID_RE.test(String(b.id))) return true;
    return String(b.type || "") === "outcome_trigger" && isFightBeat(b) && isTerminalBeat(b);
  }
  const encKeyOf = (b) => String(b?.encounter?.key || "").trim() || String(b?.id || "");
  const _selForBeat = (b) => ({ encounterKey: String(b?.encounter?.key || "").trim() || null, beatId: String(b?.id || "") || null, family: String(b?.id || "") || null });

  /** Down for the count: dead/defeated status, a defeated combatant, Integrity 0 on a foe, or Incapacitated. */
  function isDownToken(t) {
    try {
      if (t?.hasStatusEffect?.("dead")) return true;
      const a = t?.actor;
      const st = a?.statuses;
      if (st?.has?.("dead") || st?.has?.("defeated") || st?.has?.("incapacitated")) return true;
      for (const c of (game.combats?.contents ?? [])) {
        for (const cb of (c?.combatants?.contents ?? c?.combatants ?? [])) if (cb?.tokenId === t.id && cb?.defeated) return true;
      }
      const sys = a?.system?.system ?? a?.system;
      const integ = sys?.derived?.integrity;
      if (a && a.type !== "character" && Number(integ?.max) > 0 && Number(integ?.value) <= 0) return true;
    } catch (_e) {}
    return false;
  }
  const _named = (t, nm) => String(t?.actor?.name || "") === nm || String(t?.name || "") === nm;
  /** Hostiles of that name still in the fight (top-up count, 2026-11-13: the dead and the downed don't count). */
  function liveHostilesNamed(scene, nm) {
    return iterTokenDocs(scene).filter(t => Number(t?.disposition) === HOSTILE() && _named(t, nm) && !isDownToken(t)).length;
  }

  const _sceneLocks = new Map();
  /**
   * Delete spawner-made foe tokens. GM only. arg: a scene id, "current" (the viewed scene), nothing (every scene), or
   * { sceneId | sceneIds, encounterKey, beatId, family, except, includePcs, reason, quiet }.
   * Returns { deleted, byScene: { [sceneId]: n } }.
   */
  async function clearSpawned(arg = null) {
    const sel = (arg && typeof arg === "object") ? { ...arg } : (arg ? { sceneId: String(arg) } : {});
    const out = { deleted: 0, byScene: {} };
    if (!game.user?.isGM) return out;
    if (sel.sceneId === "current") sel.sceneId = canvas?.scene?.id || null;
    const ids = Array.isArray(sel.sceneIds) ? sel.sceneIds : (sel.sceneId ? [sel.sceneId] : null);
    const scenes = ids ? ids.map(id => game.scenes?.get?.(id)).filter(Boolean) : (game.scenes?.contents ?? []);
    for (const scene of scenes) {
      const prev = _sceneLocks.get(scene.id) || Promise.resolve();
      const run = prev.then(async () => {
        const picks = selectSpawned(iterTokenDocs(scene), sel).filter(p => scene.tokens?.get?.(p.t.id));
        if (!picks.length) return 0;
        try { await scene.deleteEmbeddedDocuments("Token", picks.map(p => p.t.id)); }
        catch (e) { warn("clearSpawned: delete failed", scene.name, e); return 0; }
        const now = Date.now();
        for (const { info } of picks) if (info.encounterKey) _cleared.set(`${scene.id}|${info.encounterKey}`, { ts: now, beatId: info.beatId });
        log(`clearSpawned: ${picks.length} spawned foe(s) off ${scene.name}${sel.reason ? ` — ${sel.reason}` : ""}`);
        return picks.length;
      }).catch(e => { warn("clearSpawned failed", e); return 0; });
      _sceneLocks.set(scene.id, run.then(() => {}, () => {}));
      const n = await run;
      if (n) { out.deleted += n; out.byScene[scene.id] = n; }
    }
    if (out.deleted && !sel.quiet) ui.notifications?.info?.(`Cleared ${out.deleted} spawned foe token(s)${sel.reason ? ` (${sel.reason})` : ""}.`);
    return out;
  }

  function _beatById(id) {
    try {
      const capi = game.bbttcc?.api?.campaign;
      const c = capi?.getCampaign?.(capi?.getActiveCampaignId?.());
      return (c?.beats || []).find(b => b?.id === id) || null;
    } catch (_e) { return null; }
  }

  /**
   * Pure-ish (review 2026-11-13): does this pick hand the fight on to a later beat of the SAME fight — its Outcomes menu, a
   * parley_fail, a sceneless Win/Lose/Run menu (hexknight_outcome)? Then that beat's own completion clears the foes, and the
   * pick's resolve must not: a GM who X-closes the Outcomes card to run the combat unwinds the chain, and the opening beat's
   * resolve would otherwise delete the foes before the fight. Unknown beats count as a hand-off (never delete on a guess).
   */
  function pickHandsOff(beat, outcome, getBeat = _beatById) {
    const ch = outcome?.choice || {};
    const first = String((outcome?.check && outcome.check.ok === false) ? (ch.failNext || beat?.outcomes?.failure || "") : (ch.next || "")).trim();
    if (!first) return false;
    const sel = _selForBeat(beat), famPre = String(beat.id) + "_";
    const relatedFight = (b) => isFightBeat(b) && ((sel.encounterKey && String(b.encounter?.key || "").trim() === sel.encounterKey) || String(b.id).startsWith(famPre));
    const relatedDone = (b) => isCompletionBeat(b) && ((sel.encounterKey && String(b.encounter?.key || "").trim() === sel.encounterKey) || String(b.id).startsWith(famPre));
    const seen = new Set(); const queue = [[first, 0]];
    while (queue.length) {
      const [id, d] = queue.shift();
      if (!id || seen.has(id)) continue; seen.add(id);
      const b = getBeat(id);
      if (!b) { if (d === 0) return true; continue; }
      if (isCompletionBeat(b)) { if (d > 0 && relatedDone(b)) return true; continue; }   // straight to the ending: clear is fine
      if (relatedFight(b) || String(b.id).startsWith(famPre)) return true;
      if (d < 2) for (const c of _beatChoices(b)) for (const n of [c?.next, c?.failNext]) { const s = String(n || "").trim(); if (s) queue.push([s, d + 1]); }
    }
    return false;
  }

  function onBeatResolved({ beat, outcome } = {}) {
    if (!game.user?.isGM || !beat?.id) return;
    let why = null;
    if (isCompletionBeat(beat)) why = `${beat.id} resolved`;
    else if (isFightBeat(beat) && outcome?.acted && outcome?.choice && !pickHandsOff(beat, outcome)) why = `left the fight (${beat.id})`;
    if (!why) return;
    clearSpawned({ ..._selForBeat(beat), reason: why, quiet: true }).catch(e => warn("resolved clear failed", beat.id, e));
  }
  function onCombatDeleted(combat) {
    try {
      if (!game.user || game.users?.activeGM?.id !== game.user.id) return;   // single executor
      if (!(Number(combat?.round) > 0)) return;                              // a tracker that never started
      const sid = combat?.scene?.id || combat?._source?.scene || null;
      if (!sid) return;
      setTimeout(() => { clearSpawned({ sceneIds: [sid], reason: "combat ended" }).catch(e => warn("combat-end clear failed", e)); }, 2500);
    } catch (e) { warn("deleteCombat handler failed", e); }
  }
  function onChainSettled(ctx) {
    try {
      if (!game.user?.isGM) return;
      const bid = String(ctx?.encounter?.beatId || "").trim();
      if (!bid) return;
      const b = _beatById(bid);
      clearSpawned({ beatId: bid, family: bid, encounterKey: String(b?.encounter?.key || "").trim() || null, reason: "back on the road", quiet: true })
        .catch(e => warn("settle clear failed", e));
    } catch (e) { warn("chain-settled handler failed", e); }
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

    // Centre of the SCENE RECT (padding-aware via scene.dimensions), snapped to the grid.
    const dims   = scene.dimensions || {};
    const width  = Number(dims.sceneWidth  ?? scene.width  ?? 4000);
    const height = Number(dims.sceneHeight ?? scene.height ?? 3000);
    const grid   = scene.grid?.size || 100;

    const cx = Math.floor((Number(dims.sceneX ?? 0) + width / 2) / grid) * grid;
    const cy = Math.floor((Number(dims.sceneY ?? 0) + height / 2) / grid) * grid;

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
  // Participating-steward drop (2026-08-27, re-ruled 2026-08-30)
  // Owner ruling: encounter scenes place STEWARD tokens only — never
  // crew/association members — and place ALL participating stewards.
  // "Participating" = stewards belonging to the factions on the ACTIVE
  // CAMPAIGN's roster (campaign.factionIds + primary factionId); encounter ctx
  // faction ids are folded in as a fallback for campaign-less/manual fires.
  // Hostiles are expected to be pre-positioned on authored scenes. Stewards
  // land in a row at bottom-center of the scene rect; the GM slides them into
  // position.
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // TOKEN SPOTS (owner ruling 2026-11-04: "the location for token will actually be unique per map").
  // Each battlemap remembers where its Stewards and foes stand. Place the tokens, then press Save Token Spots
  // (Token controls) or call api.encounters.saveTokenSpots(). Setting `bbttcc-encounters.tokenSpots` =
  // { [sceneId]: { pcs: [{x,y}…], foes: { [actorName]: [{x,y}…] } } } — GAME layer, so a story reset keeps it.
  // A map with no spots falls back to the old rows.
  // ---------------------------------------------------------------------------
  const SPOTS_MOD = "bbttcc-encounters", SPOTS_KEY = "tokenSpots";
  Hooks.once("init", () => {
    game.settings.register(SPOTS_MOD, SPOTS_KEY, { scope: "world", config: false, type: Object, default: {}, bbttcc: { layer: "game" } });
  });
  function spotsFor(scene) {
    try { return (game.settings.get(SPOTS_MOD, SPOTS_KEY) || {})[scene?.id] || null; } catch (_e) { return null; }
  }
  const _nameOf = (t) => String(t?.actor?.name || t?.name || "").trim();
  async function saveTokenSpots(scene = canvas?.scene) {
    if (!scene || !game.user?.isGM) return null;
    const FRIENDLY = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
    const pos = (t) => ({ x: Number(t.x) || 0, y: Number(t.y) || 0 });
    const byXY = (a, b) => (a.x - b.x) || (a.y - b.y);
    const toks = iterTokenDocs(scene);
    // Round 4 (2026-11-05): a friendly NPC is not a Steward. Doc Greeley is a friendly character, and filing her under pcs would drop a Steward on top of her.
    const isPc = (t) => Number(t.disposition) === FRIENDLY && t.actor?.type === "character" && _isSteward(t.actor);
    const pcs = toks.filter(isPc).map(pos).sort(byXY);
    const npcs = {};
    // A story load puts scene flags and tokens back as saved, so the spot keeps what Dave set by hand: art, size and the map's Tableau Settings.
    for (const t of toks) { if (isPc(t) || Number(t.disposition) === HOSTILE()) continue; const n = _nameOf(t); if (n) (npcs[n] ??= []).push({ ...pos(t), width: t.width, height: t.height, src: t.texture?.src || null }); }
    for (const list of Object.values(npcs)) list.sort(byXY);
    const foes = {};
    for (const t of toks) { if (Number(t.disposition) !== HOSTILE()) continue; const n = _nameOf(t); if (n) (foes[n] ??= []).push(pos(t)); }
    for (const list of Object.values(foes)) list.sort(byXY);
    const all = foundry.utils.duplicate(game.settings.get(SPOTS_MOD, SPOTS_KEY) || {});
    const tableau = foundry.utils.getProperty(scene, "flags.bbttcc-raid.tableau") ?? null;
    // absent = NPCs removed from this map by hand. Placing one back and saving clears it.
    const absent = (all[scene.id]?.absent || []).filter(n => !npcs[n]);
    all[scene.id] = { name: scene.name, pcs, foes, npcs, absent, tableau: tableau ? foundry.utils.duplicate(tableau) : null, at: Date.now() };
    await game.settings.set(SPOTS_MOD, SPOTS_KEY, all);
    const foeN = Object.values(foes).reduce((s, l) => s + l.length, 0);
    const npcN = Object.values(npcs).reduce((s, l) => s + l.length, 0);
    ui.notifications?.info?.(`${scene.name}: saved ${pcs.length} Steward, ${foeN} foe and ${npcN} NPC spot(s).`);
    return all[scene.id];
  }
  async function clearTokenSpots(scene = canvas?.scene) {
    if (!scene || !game.user?.isGM) return;
    const all = foundry.utils.duplicate(game.settings.get(SPOTS_MOD, SPOTS_KEY) || {});
    delete all[scene.id];
    await game.settings.set(SPOTS_MOD, SPOTS_KEY, all);
    ui.notifications?.info?.(`${scene.name}: token spots cleared.`);
  }
  // Foes already on the map go to their saved spots when the stage is set; never during a running fight.
  async function applyFoeSpots(scene) {
    const spots = spotsFor(scene); if (!spots?.foes || !game.user?.isGM) return;
    if ((game.combats?.contents ?? []).some(c => c.started && c.scene?.id === scene.id)) return;
    const seen = {}; const ups = [];
    for (const t of iterTokenDocs(scene)) {
      if (Number(t.disposition) !== HOSTILE()) continue;
      const n = _nameOf(t); const i = (seen[n] = (seen[n] ?? -1) + 1); const s = spots.foes[n]?.[i];
      if (s && (t.x !== s.x || t.y !== s.y)) ups.push({ _id: t.id, x: s.x, y: s.y });
    }
    if (ups.length) await scene.updateEmbeddedDocuments("Token", ups, { animate: false });
  }
  // NPCs stand on their saved spots whenever the map loads or the placement system creates them. A story load restores scene
  // tokens from the save, so this is what keeps a placed NPC where it was put. Never during a running fight.
  async function applyNpcSpots(scene) {
    const spots = spotsFor(scene); if (!spots || game.user !== game.users?.activeGM) return;
    if ((game.combats?.contents ?? []).some(c => c.started && c.scene?.id === scene.id)) return;
    if (spots.tableau && JSON.stringify(foundry.utils.getProperty(scene, "flags.bbttcc-raid.tableau") ?? null) !== JSON.stringify(spots.tableau)) {
      await scene.update({ "flags.bbttcc-raid.tableau": foundry.utils.duplicate(spots.tableau) });
    }
    if (spots.absent?.length) {
      const gone = iterTokenDocs(scene).filter(t => spots.absent.includes(_nameOf(t))).map(t => t.id);
      if (gone.length) await scene.deleteEmbeddedDocuments("Token", gone);
    }
    if (!spots.npcs) return;
    const seen = {}; const ups = [];
    for (const t of iterTokenDocs(scene)) {
      const n = _nameOf(t); if (!spots.npcs[n]) continue;
      const i = (seen[n] = (seen[n] ?? -1) + 1); const s = spots.npcs[n][i]; if (!s) continue;
      const up = {};
      if (t.x !== s.x || t.y !== s.y) { up.x = s.x; up.y = s.y; }
      if (s.width && t.width !== s.width) up.width = s.width;
      if (s.height && t.height !== s.height) up.height = s.height;
      if (s.src && t.texture?.src !== s.src) up["texture.src"] = s.src;
      if (Object.keys(up).length) ups.push({ _id: t.id, ...up });
    }
    if (ups.length) await scene.updateEmbeddedDocuments("Token", ups, { animate: false });
  }
  Hooks.on("canvasReady", () => { try { if (canvas?.scene) applyNpcSpots(canvas.scene).catch(() => {}); } catch (_e) {} });
  Hooks.on("createToken", (doc) => { try { if (doc?.parent && spotsFor(doc.parent)?.npcs?.[_nameOf(doc)]) applyNpcSpots(doc.parent).catch(() => {}); } catch (_e) {} });
  Hooks.on("getSceneControlButtons", (controls) => {
    try {
      const tokens = controls?.tokens;
      if (!tokens?.tools || !game.user?.isGM) return;
      tokens.tools.bbttccSaveTokenSpots = { name: "bbttccSaveTokenSpots", title: "Save Token Spots (this map)", icon: "fa-solid fa-map-pin", order: 60, button: true, visible: true, onChange: () => saveTokenSpots(canvas?.scene) };
      tokens.tools.bbttccClearSpawned = { name: "bbttccClearSpawned", title: "Clear Spawned Foes (this map)", icon: "fa-solid fa-broom", order: 61, button: true, visible: true,
        onChange: () => clearSpawned({ sceneId: "current", reason: "by hand" }).then(r => { if (!r.deleted) ui.notifications?.info?.("No spawned foes on this map."); }) };
    } catch (_e) {}
  });

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

  // Factions participating in the CAMPAIGN — the Campaign Builder roster of the
  // active campaign. factionIds holds UUIDs ("Actor.xyz"); the primary
  // factionId is folded in for older campaigns authored before the roster.
  function _campaignFactionRefs() {
    try {
      const capi = game.bbttcc?.api?.campaign;
      if (typeof capi?.getActiveCampaignId !== "function" || typeof capi?.getCampaign !== "function") return [];
      const cid = capi.getActiveCampaignId();
      const camp = cid ? capi.getCampaign(cid) : null;
      if (!camp) return [];
      const refs = [];
      if (Array.isArray(camp.factionIds)) refs.push(...camp.factionIds);
      if (camp.factionId) refs.push(camp.factionId);
      return refs.map(r => String(r || "").trim()).filter(Boolean);
    } catch (_e) {
      return [];
    }
  }

  function _gatherParticipantFactionRefs(ctx = {}) {
    const refs = [];
    const push = (v) => { const s = String(v || "").trim(); if (s && !refs.includes(s)) refs.push(s); };
    _campaignFactionRefs().forEach(push);
    _participantFactionIds(ctx).forEach(push);
    return refs;
  }

  // Steward = a real PC (canonical actorKind "steward"), never a
  // crew/association member. Echo-minted crew can be type:"character" too, but
  // they carry the builders' entityKind stamp, which actorKind resolves to
  // "npc" — so the canonical resolver is the filter.
  function _isSteward(a) {
    try {
      const kindOf = game.bbttcc?.api?.actorKind;
      if (typeof kindOf === "function") return kindOf(a) === "steward";
    } catch (_e) { /* fall through */ }
    // Fallback (actorKind API absent): character-type without a builder stamp.
    if (a?.type !== "character") return false;
    return !String(a?.flags?.["bbttcc-auto-link"]?.entityKind ?? "").trim();
  }

  async function spawnFactionPCs(scene, ctx = {}, opts = {}) {
    if (!scene || !game.user?.isGM) return [];

    const factionRefs = _gatherParticipantFactionRefs(ctx);
    if (!factionRefs.length) {
      log("spawnFactionPCs: no participating factions (campaign roster or ctx); skipping steward drop.");
      return [];
    }

    const factions = [];
    const seenFactions = new Set();
    for (const ref of factionRefs) {
      const f = await resolveActor(ref);
      if (f?.id && !seenFactions.has(f.id)) { seenFactions.add(f.id); factions.push(f); }
    }
    if (!factions.length) return [];

    // Stewards ONLY — every PLAYED steward belonging to any participating
    // faction takes the field; crew/association members never get tokens here
    // (bringing them out is an in-combat call). A faction's member roster can
    // be all type:"character" (The Errata Society has 15), so "played" = some
    // user's assigned character or owned by a non-GM player (Dave, 10-29).
    const assigned = new Set((game.users?.contents || []).map(u => u.character?.id).filter(Boolean));
    const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
    const isPlayed = (a) => assigned.has(a.id) || Object.entries(a.ownership || {}).some(([uid, lvl]) =>
      uid !== "default" && Number(lvl) >= OWNER && game.users?.get(uid) && !game.users.get(uid).isGM);
    const pcs = [];
    for (const a of (game.actors?.contents || [])) {
      if (!_isSteward(a) || !isPlayed(a)) continue;
      if (!factions.some(f => _pcBelongsToFaction(a, f))) continue;
      if (!pcs.includes(a)) pcs.push(a);
    }
    if (!pcs.length) {
      log("spawnFactionPCs: participating factions have no stewards.", factionRefs);
      return [];
    }

    // Skip PCs that already have a token on this scene (pre-placed or from an
    // earlier fight on the same battlemap).
    const present = new Set();
    for (const doc of iterTokenDocs(scene)) {
      if (doc?.actorId) present.add(doc.actorId);
    }
    await applyFoeSpots(scene);
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
    const pcSpots = spotsFor(scene)?.pcs || [];
    const specs = toPlace.map((a, idx) => {
      const spot = pcSpots[pcs.indexOf(a)];
      return {
        actor: a.id,
        role: "pc",
        spawnedBy,
        disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        x: spot ? spot.x : Math.floor((cx + (idx - (toPlace.length - 1) / 2) * (1.5 * grid)) / grid) * grid,
        y: spot ? spot.y : rowY
      };
    });

    log("spawnFactionPCs: dropping stewards", { factionRefs, stewards: toPlace.map(a => a.name) });
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
    if (hasSpawnedFlag(scene, spawnedKey, { foesOnly: true })) {
      log("Bandit Ambush tokens already present; skipping respawn.");
      return;
    }

    // PCs: roster-driven from participating factions (2026-08-27 — the old
    // hardcoded PC_IDS list is retired to a testFire-only fallback below).
    const placedPCs = await spawnFactionPCs(scene, ctx, { spawnedBy: spawnedKey });

    // Padding-aware: canvas coordinates start at dimensions.sceneX/sceneY.
    const dims   = scene.dimensions || {};
    const sx     = Number(dims.sceneX ?? 0);
    const sy     = Number(dims.sceneY ?? 0);
    const width  = Number(dims.sceneWidth  ?? scene.width  ?? 4000);
    const height = Number(dims.sceneHeight ?? scene.height ?? 3000);
    const grid   = scene.grid?.size || 100;
    const centerX = sx + width / 2;

    if (!placedPCs.length && !_gatherParticipantFactionRefs(ctx).length) {
      // No faction ctx (manual testFire) — legacy fallback so test fires still
      // show a party. Dead actor ids resolve to warn+skip harmlessly.
      const pcY = sy + height - (3 * grid);
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
      const banditY = sy + 2 * grid;
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
  // Spawn-by-name + storyline crew variants (2026-10-13)
  //  - actorByName / spawnByName: world actor by exact name, else imported ONCE from the
  //    NPC pack. Lets a beat name its foe (beat.encounter.actorName) instead of a dead id.
  //  - Bandit Ambush crew variants: the Asli battlemap carries LINKED "Road Bandit 1..3"
  //    tokens. Once the Bandit Accord is underway (mercy ledger > 0, or the free/jail
  //    ending played) the ambushes that follow are the Drowned South's — the tokens are
  //    re-pointed at "Drowned South Bandit 1..3" world copies (imported from the pack).
  //    `setBanditAmbushCrew(scene, "first")` flips them back for a re-shoot.
  //  - Hook `bbttcc:beat:stageReady` (fired by bbttcc-campaign once a beat's own scene is
  //    up and the party is placed) drives both.
  // ---------------------------------------------------------------------------
  const NPC_PACK = "bbttcc-master-content.npcs";
  const HOSTILE = () => CONST.TOKEN_DISPOSITIONS.HOSTILE;

  async function actorByName(name) {
    const want = String(name || "").trim();
    if (!want) return null;
    const world = game.actors?.find?.(a => a?.name === want) || null;
    if (world) return world;
    // Through the pack seam: the RFI npcs pack isn't registered on dnd5e; its twin is bad-eden-5e.monsters (review C33).
    const pack = game.bbttcc?.packs?.get?.(NPC_PACK) ?? game.packs?.get(NPC_PACK);
    if (!pack) return null;
    try {
      const idx = (await pack.getIndex()).find(e => e.name === want);
      if (!idx) return null;
      return await game.actors.importFromCompendium(pack, idx._id);
    } catch (e) { warn("actorByName: import failed", want, e); return null; }
  }

  /** World copies "<name> 1..n" (linked-token duty: each token needs its own Integrity). */
  async function actorCopies(name, n) {
    const base = await actorByName(name);
    if (!base) return [];
    const out = [];
    for (let i = 1; i <= n; i++) {
      const nm = `${name} ${i}`;
      let a = game.actors?.find?.(x => x?.name === nm) || null;
      if (!a) {
        try { a = await base.clone({ name: nm, "prototypeToken.name": nm }, { save: true }); }
        catch (e) { warn("actorCopies: clone failed", nm, e); continue; }
      }
      out.push(a);
    }
    return out;
  }

  /** Pure: the fallback row x for slot k of `slots`, centred on cx, 1.5 squares apart, kept inside the scene rect. */
  function rowX(k, slots, { cx, grid, sx, sw }) {
    const x = Math.floor((cx + (k - (slots - 1) / 2) * (1.5 * grid)) / grid) * grid;
    const lo = Math.floor(sx / grid) * grid, hi = Math.floor((sx + sw - grid) / grid) * grid;
    return Math.max(lo, Math.min(hi, x));
  }

  // slot / slots (2026-11-13): where this batch sits on the shared fallback row. A boss and its hands (encounter.also) used
  // to each centre their own row on the same line, so the first "also" token landed on the main group's middle token.
  // Callers that pass neither get the old row (centred on `count`). beatId / encounterKey ride into the spawned flag.
  async function spawnByName(scene, name, { count = 1, spawnedBy = "by_name", role = "npc", offset = 0, slot = 0, slots = null, beatId = null, encounterKey = null } = {}) {
    if (!scene) return [];
    const base = await actorByName(name);
    if (!base) { warn("spawnByName: no actor named", name); return []; }
    const dims = scene.dimensions || {};
    const grid = scene.grid?.size || 100;
    const sx = Number(dims.sceneX ?? 0), sy = Number(dims.sceneY ?? 0);
    const sw = Number(dims.sceneWidth ?? scene.width ?? 4000);
    const cx = sx + sw / 2;
    const topY = Math.floor((sy + 3 * grid) / grid) * grid;
    const nSlots = Math.max(Number(slots) || 0, slot + count);
    const specs = [];
    const foeSpots = spotsFor(scene)?.foes?.[String(name).trim()] || [];
    for (let i = 0; i < count; i++) { const spot = foeSpots[i + offset]; specs.push({
      actor: base.id, role, spawnedBy, disposition: HOSTILE(),
      ...(beatId ? { beatId } : {}), ...(encounterKey ? { encounterKey } : {}),
      x: spot ? spot.x : rowX(slot + i, nSlots, { cx, grid, sx, sw }), y: spot ? spot.y : topY
    }); }
    return spawnTokens(scene, specs);
  }

  function _settingJson(key) {
    try {
      const v = game.settings.get("bbttcc-campaign", key);
      return (typeof v === "string") ? JSON.parse(v || "null") : v;
    } catch (_e) { return null; }
  }

  /** The Bandit Accord storyline has started: a bandit was let walk (ledger), or the free/jail ending played. */
  function banditAccordUnderway() {
    try { if ((Number(game.settings.get("bbttcc-campaign", "banditMercy")) || 0) > 0) return true; } catch (_e) {}
    try {
      const all = _settingJson("storyState") || {};
      const cid = game.settings.get("bbttcc-campaign", "activeCampaignId");
      const played = all?.[cid]?.played || all?.played || {};
      return !!(played["enc_bandit_ambush_win_free"] || played["enc_bandit_ambush_win_jail"] || played["bandit_accord_opening"]);
    } catch (_e) { return false; }
  }

  /**
   * Point the ambush map's hostile "Road Bandit" / "Drowned South Bandit" tokens at the
   * crew for this stage of the story. variant: "accord" → Drowned South Bandit 1..n,
   * "first" → Road Bandit 1..n. Linked tokens keep their own actor per token.
   */
  async function setBanditAmbushCrew(scene, variant = "accord") {
    if (!scene || !game.user?.isGM) return 0;
    const toName = variant === "first" ? "Road Bandit" : "Drowned South Bandit";
    const crewRe = /^(Road Bandit|Drowned South Bandit)/;
    const toks = iterTokenDocs(scene).filter(t =>
      Number(t?.disposition) === HOSTILE() && crewRe.test(String(t?.actor?.name || t?.name || "")));
    if (!toks.length) return 0;
    const already = toks.every(t => String(t?.actor?.name || "").startsWith(toName));
    if (already) return 0;
    const copies = await actorCopies(toName, toks.length);
    if (copies.length < toks.length) { warn("setBanditAmbushCrew: not enough world copies", toName, copies.length); return 0; }
    const updates = toks.map((t, i) => {
      const a = copies[i];
      const src = a.prototypeToken?.texture?.src || a.img;
      return { _id: t.id, actorId: a.id, actorLink: true, name: a.name, ...(src ? { "texture.src": src } : {}) };
    });
    await scene.updateEmbeddedDocuments("Token", updates);
    log(`Bandit Ambush crew → ${toName} ×${updates.length} (${variant})`);
    return updates.length;
  }

  /** Scenario spawner (engine/testFire path): party + one Hexknight when the scene has no hostiles. */
  async function spawnHexknight(ctx, scene, _scenario, _step) {
    if (!scene) return;
    const spawnedKey = "hexknight_standard";
    if (hasSpawnedFlag(scene, spawnedKey, { foesOnly: true })) { log("Hexknight already present; skipping respawn."); return; }
    await spawnFactionPCs(scene, ctx, { spawnedBy: spawnedKey });
    const hasHostiles = iterTokenDocs(scene).some(t => Number(t?.disposition) === HOSTILE());
    if (!hasHostiles) await spawnByName(scene, "Hexknight", { count: 1, spawnedBy: spawnedKey });
    else log("Hexknight: hostiles pre-positioned on scene; not spawning.");
  }

  function onStageReady({ beat, scene } = {}) {
    if (!game.user?.isGM || !scene || !beat) return;
    (async () => {
      // Cleanup first (2026-11-13): an outcome beat ends its fight; a non-fight beat staged here means the story moved on
      // on this map. Either way the spawner's foes go before anything else stands up.
      const fight = isFightBeat(beat), done = isCompletionBeat(beat);
      if (done) await clearSpawned({ ..._selForBeat(beat), reason: `${beat.id}`, quiet: true });
      else if (!fight) {
        await clearSpawned({ sceneIds: [scene.id], reason: `story moved on (${beat.id})`, quiet: true });
        await clearSpawned({ family: String(beat.id), reason: `${beat.id}`, quiet: true });
      }
      await applyFoeSpots(scene);
      if (String(beat.id) === "enc_bandit_ambush" && banditAccordUnderway()) await setBanditAmbushCrew(scene, "accord");
      if (!fight || done) return;
      await topUpEncounter(beat, scene);
    })().catch(e => warn("stageReady handler failed", beat?.id, e));
  }

  async function topUpEncounter(beat, scene) {
    const enc = beat.encounter || {};
    const want = String(enc.actorName || "").trim();
    if (!want) return;
    const key = encKeyOf(beat);
    // Never during a running fight: the fallen don't count as standing any more, so a beat re-staging mid-combat would
    // otherwise send in replacements.
    if ((game.combats?.contents ?? []).some(c => c?.started && c?.scene?.id === scene.id)) { log(`top-up skipped: a fight is running on ${scene.name}`); return; }
    // This fight already ended here (End Combat cleared it) and this is a later beat of the same fight — its Outcomes menu
    // re-staging — so nothing comes back. The fight's own opening beat staging again is a new fight.
    const memoKey = `${scene.id}|${key}`, memo = _cleared.get(memoKey);
    if (memo && (Date.now() - memo.ts) < CLEARED_MEMO_MS) {
      if (memo.beatId && memo.beatId !== beat.id) { log(`top-up skipped: ${key} already ended on ${scene.name}`); return; }
      _cleared.delete(memoKey);
    }
    // Leftovers from OTHER fights on this map never join this one; this fight's own dead from a previous run go when its
    // opening beat stages again.
    await clearSpawned({ sceneIds: [scene.id], except: { encounterKey: key, family: String(beat.id) }, reason: "left over from an earlier fight", quiet: true });
    await clearSpawned({ sceneIds: [scene.id], beatId: String(beat.id), onlyIf: (t) => isDownToken(t), reason: "fallen in an earlier run", quiet: true });

    // encounter.count (2026-10-28, Tor-Wrath at the Old Seal): a story fight may field several of the same foe — top the
    // scene up to `count` hostiles of that name. encounter.party: true also drops the Stewards (story scenes have no
    // travel stash, so the engine's own party drop never runs there).
    // encounter.also (2026-11-02, the camp on the switchbacks): a boss and its hands — [{ actorName, count }] tops up each
    // extra foe the same way. The whole fight shares one fallback row: each group takes the slots after the one before it.
    const clampN = (v) => Math.max(1, Math.min(8, Math.floor(Number(v) || 1)));
    const groups = [{ nm: want, n: clampN(enc.count), sb: `enc:${beat.id}` }];
    for (const x of (Array.isArray(enc.also) ? enc.also : [])) {
      const nm = String(x?.actorName || "").trim(); if (!nm) continue;
      groups.push({ nm, n: clampN(x?.count), sb: `enc:${beat.id}:${nm}` });
    }
    const slots = groups.reduce((s, g) => s + g.n, 0);
    if (enc.party === true) await spawnFactionPCs(scene, {}, { spawnedBy: `pc_party:${beat.id}` });
    let slot = 0;
    for (const g of groups) {
      // Only foes still standing count as "already here" (2026-11-13).
      const have = Math.min(g.n, liveHostilesNamed(scene, g.nm));
      if (have < g.n) await spawnByName(scene, g.nm, { count: g.n - have, spawnedBy: g.sb, offset: have, slot: slot + have, slots, beatId: String(beat.id), encounterKey: key });
      slot += g.n;
    }
  }

  // ---------------------------------------------------------------------------
  // Registry + install
  // ---------------------------------------------------------------------------

  const SPAWNERS = {
    bandit_ambush_standard: spawnBanditAmbush,
    hexknight_standard: spawnHexknight
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

    // 2026-10-13: name-driven spawns + storyline crew variants
    Object.assign(game.bbttcc.api.encounters._spawner, { actorByName, spawnByName, setBanditAmbushCrew, banditAccordUnderway });
    Object.assign(game.bbttcc.api.encounters, { saveTokenSpots, clearTokenSpots, tokenSpots: spotsFor });
    Hooks.on("bbttcc:beat:stageReady", onStageReady);

    // 2026-11-13: spawned tokens leave when their encounter ends
    Object.assign(game.bbttcc.api.encounters._spawner, {
      clearSpawned, spawnInfo, topUpEncounter,
      _pure: { parseSpawnedBy, spawnKind, selectSpawned, isFightBeat, isCompletionBeat, isTerminalBeat, encKeyOf, rowX, pickHandsOff }
    });
    game.bbttcc.api.encounters.clearSpawned = clearSpawned;
    Hooks.on("bbttcc:beat:resolved", onBeatResolved);
    Hooks.on("deleteCombat", onCombatDeleted);
    Hooks.on("bbttcc:encounterChainSettled", onChainSettled);

    log("Spawner interface installed");
  }

  Hooks.once("ready", install);
})();

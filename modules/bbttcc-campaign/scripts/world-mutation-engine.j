//
// FULL REPLACEMENT — BBTTCC World Mutation Engine v2.3 (Unlocks + Relationship Status)
// -------------------------------------------------------------
// Exposes: game.bbttcc.api.worldMutation.applyWorldEffects(input, ctx?)
//
(() => {
  const TAG          = "[bbttcc-campaign/world-mutation]";
  const MOD_FACTIONS = "bbttcc-factions";

  function get(o, p, d) {
    try { return foundry.utils.getProperty(o, p) ?? d; } catch { return d; }
  }
  function clone(x) {
    try { return foundry.utils.deepClone(x || {}); } catch { return JSON.parse(JSON.stringify(x || {})); }
  }
  function clampPct(v) { return Math.max(0, Math.min(100, Number(v || 0))); }

  function ensureNS() {
    if (!game.bbttcc) game.bbttcc = { api: {} };
    if (!game.bbttcc.api) game.bbttcc.api = {};
    if (!game.bbttcc.api.worldMutation) game.bbttcc.api.worldMutation = {};
    if (!game.bbttcc.api.factions) game.bbttcc.api.factions = {};
  }

  // ---------------------------------------------------------------------------
  // Territory doc resolver (Drawing/Tile UUID)
  // ---------------------------------------------------------------------------
  async function resolveHexDoc(uuid) {
    if (!uuid) return null;
    const raw = String(uuid);
    const parts = raw.split(".");
    try {
      if (parts[0] === "Scene" && parts.length >= 4) {
        const sc = (game.scenes && game.scenes.get) ? (game.scenes.get(parts[1]) || null) : null;
        if (sc) {
          if (parts[2] === "Drawing") return (sc.drawings && sc.drawings.get) ? (sc.drawings.get(parts[3]) || null) : null;
          if (parts[2] === "Tile")    return (sc.tiles && sc.tiles.get) ? (sc.tiles.get(parts[3]) || null) : null;
        }
      }
    } catch (_e1) {}
    try {
      if (typeof fromUuid === "function") {
        const doc = await fromUuid(raw);
        if (doc) return doc;
      }
    } catch (_e2) {}
    return null;
  }

  function _readWorldTurn() {
    try {
      const w = game && game.bbttcc && game.bbttcc.api ? game.bbttcc.api.world : null;
      if (w && typeof w.getState === "function") {
        const st = w.getState() || {};
        const t = Number(st.turn || 0);
        if (Number.isFinite(t) && t >= 0) return Math.floor(t);
      }
    } catch (_e) {}
    return 0;
  }

  function asActor(aOrId) {
    if (!aOrId) return null;
    try { if (aOrId instanceof Actor) return aOrId; } catch {}
    const id = String(aOrId).replace(/^Actor\./, "");
    return (game.actors && game.actors.get) ? (game.actors.get(id) || null) : null;
  }

  function asFactionActor(idOrActor) {
    const A = asActor(idOrActor);
    if (!A) return null;
    const isFaction =
      (A.getFlag && A.getFlag(MOD_FACTIONS, "isFaction") === true) ||
      String(get(A, "system.details.type.value", "")).toLowerCase() === "faction";
    return isFaction ? A : null;
  }

  async function _callAddWarLog(factionsApi, factionId, entry) {
    if (!factionsApi || typeof factionsApi.addWarLog !== "function") return false;
    try {
      await factionsApi.addWarLog({ factionId: factionId, entry: entry });
      return true;
    } catch (e1) {
      try {
        await factionsApi.addWarLog(factionId, entry);
        return true;
      } catch (e2) {
        try {
          const F = asFactionActor(factionId);
          if (F) {
            await factionsApi.addWarLog(F, entry);
            return true;
          }
        } catch (e3) {}
      }
    }
    return false;
  }

  async function _fallbackWriteDarkness(factionId, delta) {
    const F = asFactionActor(factionId);
    if (!F) return false;
    try {
      const flags = clone(F.flags && F.flags[MOD_FACTIONS] ? F.flags[MOD_FACTIONS] : {});
      const darkness = clone(flags.darkness || {});
      const cur = Number(darkness.global || 0);
      const next = Math.max(0, cur + Number(delta || 0));
      darkness.global = next;
      flags.darkness = darkness;
      await F.update({ ["flags."+MOD_FACTIONS]: flags });
      return true;
    } catch (e) {
      console.warn(TAG, "fallbackWriteDarkness failed", factionId, e);
      return false;
    }
  }

  async function _internalApplyDelta(opts) {
    opts = opts || {};
    const F = asFactionActor(opts.factionId);
    if (!F) return;

    const flags   = clone(F.flags && F.flags[MOD_FACTIONS] ? F.flags[MOD_FACTIONS] : {});
    const victory = clone(flags.victory || {});
    const rawDark = flags.darkness;

    // Morale/Loyalty are stored as simple numbers (0-100) in this world.
    const morale  = clampPct((Number(flags.morale  ?? 50)) + Number(opts.moraleDelta   || 0));
    const loyalty = clampPct((Number(flags.loyalty ?? 50)) + Number(opts.loyaltyDelta  || 0));

    // Unity/VP live under flags.victory in this world.
    const unity = clampPct((Number(victory.unity ?? 0)) + Number(opts.unityDelta || 0));
    const vp    = Math.max(0, (Number(victory.vp ?? 0)) + Number(opts.vpDelta || 0));

    // Darkness is historically either:
    // - a simple number (legacy alpha worlds): flags.darkness = 2
    // - an object: flags.darkness = { global: 2, ... }
    let darknessObj = null;
    let darkCur = 0;

    if (rawDark != null && typeof rawDark === "object") {
      darknessObj = clone(rawDark);
      darkCur = Number(darknessObj.global ?? 0);
      if (!Number.isFinite(darkCur)) darkCur = 0;
    } else {
      darkCur = Number(rawDark ?? 0);
      if (!Number.isFinite(darkCur)) darkCur = 0;
    }

    const darkNext = Math.max(0, darkCur + Number(opts.darknessDelta || 0));

    flags.morale  = morale;
    flags.loyalty = loyalty;

    victory.unity = unity;
    victory.vp    = vp;
    flags.victory = victory;

    // Preserve the existing darkness shape to avoid breaking sheet renderers.
    if (rawDark != null && typeof rawDark === "object") {
      darknessObj.global = darkNext;
      flags.darkness = darknessObj;
    } else {
      flags.darkness = darkNext;
    }

    await F.update({ ["flags."+MOD_FACTIONS]: flags });
  }

  function ensureFactionAPI() {
    const apiF = game.bbttcc.api.factions;
    if (!apiF.applyDelta) apiF.applyDelta = _internalApplyDelta;
  }

  // ---------------------------------------------------------------------------
  // Unlocks (Narrative progression)
  // beat.unlocks = { maneuvers:[keys], strategics:[keys] }
  // stored on faction: flags.bbttcc-factions.unlocks.{maneuvers|strategics}[key] = {unlocked,via,ts}
  // ---------------------------------------------------------------------------
  async function _applyFactionUnlocks(factionId, beat, ctx) {
    try {
      if (!factionId) return { applied: false, count: 0 };
      if (!beat || typeof beat !== "object") return { applied: false, count: 0 };

      const unlocks = beat.unlocks;
      if (!unlocks || typeof unlocks !== "object") return { applied: false, count: 0 };

      const mans = Array.isArray(unlocks.maneuvers) ? unlocks.maneuvers : [];
      const strs = Array.isArray(unlocks.strategics) ? unlocks.strategics : [];
      if (!mans.length && !strs.length) return { applied: false, count: 0 };

      const F = asFactionActor(factionId);
      if (!F) return { applied: false, count: 0 };

      const cur = clone(F.getFlag ? (F.getFlag(MOD_FACTIONS, "unlocks") || {}) : (F.flags?.[MOD_FACTIONS]?.unlocks || {}));
      cur.maneuvers  = (cur.maneuvers  && typeof cur.maneuvers  === "object") ? cur.maneuvers  : {};
      cur.strategics = (cur.strategics && typeof cur.strategics === "object") ? cur.strategics : {};

      const via = String(ctx?.beatId || beat.id || "beat").trim() || "beat";
      const ts = Date.now();

      let count = 0;

      for (let i=0;i<mans.length;i++){
        const raw = String(mans[i] || "").trim();
        if (!raw) continue;
        const key = raw.toLowerCase();
        const row = cur.maneuvers[key] && typeof cur.maneuvers[key] === "object" ? cur.maneuvers[key] : null;
        if (row && row.unlocked === true) continue;
        cur.maneuvers[key] = { unlocked: true, via: [via], ts: ts };
        count++;
      }

      for (let i=0;i<strs.length;i++){
        const raw = String(strs[i] || "").trim();
        if (!raw) continue;
        const key = raw.toLowerCase();
        const row = cur.strategics[key] && typeof cur.strategics[key] === "object" ? cur.strategics[key] : null;
        if (row && row.unlocked === true) continue;
        cur.strategics[key] = { unlocked: true, via: [via], ts: ts };
        count++;
      }

      if (!count) return { applied: false, count: 0 };

      await F.update({ ["flags."+MOD_FACTIONS+".unlocks"]: cur });

      // Best-effort war log
      try {
        const labels = [];
        for (const k of mans) labels.push("Maneuver: " + String(k));
        for (const k of strs) labels.push("Strategic: " + String(k));
        const entry = {
          type: "unlock",
          activity: "unlock",
          summary: "Unlocked rewards — " + labels.join(" • "),
          beatId: String(ctx?.beatId || beat.id || ""),
          campaignId: ctx?.campaignId || null
        };
        await _callAddWarLog(game.bbttcc?.api?.factions, factionId, entry);
      } catch (e2) {}

      
    // -------------------------------------------------------------
    // TIME POINTS — optional aggregation into bbttcc-world Strategic Turn clock
    // - Source priority: ctx.timePoints → beat.timePoints → beat.timeScale mapping
    // - Safe: only runs if bbttcc-world API is present and locks.turnAdvance is false
    // -------------------------------------------------------------
    try {
      const worldApi = game?.bbttcc?.api?.world;
      if (worldApi && typeof worldApi.addTime === "function") {
        let tp = null;

        if (ctx && typeof ctx.timePoints === "number" && Number.isFinite(ctx.timePoints)) {
          tp = Math.max(0, Math.floor(ctx.timePoints));
        } else if (beat && typeof beat.timePoints === "number" && Number.isFinite(beat.timePoints)) {
          tp = Math.max(0, Math.floor(beat.timePoints));
        } else {
          const st = (worldApi.getState && worldApi.getState()) || null;
          const turnLen = Math.max(1, Math.floor(Number(st?.time?.turnLength ?? 12) || 12));
          const ts = String(beat?.timeScale || "").trim().toLowerCase();
          // Default mapping (author can override with beat.timePoints)
          if (ts === "moment") tp = 0;
          else if (ts === "scene") tp = 1;
          else if (ts === "leg") tp = 1;
          else if (ts === "turn") tp = turnLen;
          else if (ts === "arc") tp = turnLen * 3;
          else tp = 0; // campaign/unknown
        }

        if (tp && tp > 0) {
          const src = String(ctx?.source || "beat");
          const note = `Beat ${String(beat?.id || ctx?.beatId || "unknown")} (${String(beat?.timeScale || "scene")})`;
          // fire-and-forget (do not block mutation success)
          Promise.resolve(worldApi.addTime(tp, { source: src, note })).catch(() => {});
        }
      }
    } catch (eTime) { /* non-fatal */ }

return { applied: true, count: count };
    } catch (e) {
      console.warn(TAG, "applyFactionUnlocks failed", e);
      return { applied: false, count: 0 };
    }
  }

  
  // ---------------------------------------------------------------------------
  // Relationship Effects (Status-based; GM-mimic)
  // worldEffects.relationshipEffects = [
  //   { sourceFactionId, targetFactionId, step:+1|-1|..., setStatus?:"friendly", reason? }
  // ]
  //
  // Canonical storage used by the Faction Sheet dropdown is:
  //   flags.bbttcc-factions.relations[targetFactionId] = "neutral" | "friendly" | ...
  //
  // We support both shapes:
  //   - string: "neutral"
  //   - object: { status:"neutral", ... } (we preserve extra fields)
  //
  // Order (low -> high):
  //   at_war < hostile < unfriendly < neutral < friendly < allied
  // ---------------------------------------------------------------------------

  const _REL_ORDER = ["at_war", "hostile", "unfriendly", "neutral", "friendly", "allied"];

  function _normRelStatus(v) {
    const s = String(v || "").trim().toLowerCase();
    if (!s) return "neutral";
    if (s === "at war") return "at_war";
    if (s === "atwar") return "at_war";
    if (s === "war") return "at_war";
    if (s === "ally") return "allied";
    return s.replace(/\s+/g, "_");
  }

  function _readRelStatus(entry) {
    if (!entry) return "neutral";
    if (typeof entry === "string") return _normRelStatus(entry);
    if (typeof entry === "object") {
      return _normRelStatus(entry.status ?? entry.state ?? entry.relation ?? entry.value ?? "neutral");
    }
    return "neutral";
  }

  function _writeRelStatus(entry, nextStatus) {
    nextStatus = _normRelStatus(nextStatus);
    if (!entry) return nextStatus;
    if (typeof entry === "string") return nextStatus;
    if (typeof entry === "object") {
      const out = clone(entry);
      out.status = nextStatus;
      return out;
    }
    return nextStatus;
  }

  function _clampRelIndex(i) {
    i = Number(i || 0);
    if (!Number.isFinite(i)) i = 0;
    return Math.max(0, Math.min(_REL_ORDER.length - 1, Math.floor(i)));
  }

  function _applyRelStep(curStatus, step) {
    const cur = _normRelStatus(curStatus);
    let idx = _REL_ORDER.indexOf(cur);
    if (idx < 0) idx = _REL_ORDER.indexOf("neutral");
    step = Number(step || 0);
    if (!Number.isFinite(step)) step = 0;
    if (!step) return _REL_ORDER[_clampRelIndex(idx)];
    const nextIdx = _clampRelIndex(idx + Math.round(step));
    return _REL_ORDER[nextIdx];
  }

  async function _applyFactionRelationshipEffects(relFx, beatCtx, factionsApi, warLogTargetFactionId) {
    try {
      if (!Array.isArray(relFx) || !relFx.length) return { applied: false, count: 0 };

      // Group by source faction so we do one setFlag per source.
      const bySource = new Map();
      const lines = [];

      for (let i = 0; i < relFx.length; i++) {
        const row = relFx[i];
        if (!row) continue;

        const srcIdRaw = String(row.sourceFactionId || "").trim();
        const tgtIdRaw = String(row.targetFactionId || "").trim();
        if (!srcIdRaw || !tgtIdRaw) continue;

        const src = asFactionActor(srcIdRaw);
        const tgt = asFactionActor(tgtIdRaw);
        if (!src || !tgt) continue;

        // Interpret: setStatus wins; else step/delta is a notch bump (GM mimic).
        const setStatus = row.setStatus != null ? _normRelStatus(row.setStatus) : null;
        const stepRaw = (row.step != null ? row.step : (row.delta != null ? row.delta : 0));
        const step = Math.round(Number(stepRaw || 0) || 0);
        if (!setStatus && !step) continue;

        const reason = String(row.reason || "").trim();

        if (!bySource.has(src.id)) bySource.set(src.id, { actor: src, rows: [] });
        bySource.get(src.id).rows.push({ target: tgt, setStatus, step, reason });

        // We fill the from/to later when we read the current status.
        lines.push({ srcName: src.name, tgtName: tgt.name, setStatus, step, reason, tgtId: tgt.id, srcId: src.id });
      }

      if (!bySource.size) return { applied: false, count: 0 };

      let count = 0;

      // Apply per source
      for (const entry of bySource.values()) {
        const src = entry.actor;

        const curRelations = clone(src.getFlag ? (src.getFlag(MOD_FACTIONS, "relations") || {}) : (src.flags?.[MOD_FACTIONS]?.relations || {}));
        const nextRelations = clone(curRelations);

        for (let j = 0; j < entry.rows.length; j++) {
          const r = entry.rows[j];
          const tid = String(r.target.id || "").trim();
          if (!tid) continue;

          const curEntry = nextRelations[tid];
          const curStatus = _readRelStatus(curEntry);

          const nextStatus = r.setStatus ? _normRelStatus(r.setStatus) : _applyRelStep(curStatus, r.step);
          nextRelations[tid] = _writeRelStatus(curEntry, nextStatus);

          count++;

          // Update the display line
          try {
            for (let k = 0; k < lines.length; k++) {
              const L = lines[k];
              if (L && L.srcId === src.id && L.tgtId === tid && (L._filled !== true)) {
                L.from = curStatus;
                L.to = nextStatus;
                L._filled = true;
              }
            }
          } catch (_eFill) {}
        }

        if (src.setFlag) await src.setFlag(MOD_FACTIONS, "relations", nextRelations);
        else {
          const flags = clone(src.flags?.[MOD_FACTIONS] || {});
          flags.relations = nextRelations;
          await src.update({ ["flags."+MOD_FACTIONS]: flags });
        }
      }

      // Best-effort consolidated war log (one entry)
      try {
        const targetFactionId = warLogTargetFactionId || null;
        if (targetFactionId && factionsApi) {
          const pretty = [];
          for (let i = 0; i < lines.length; i++) {
            const L = lines[i];
            if (!L) continue;
            const stepTxt = (L.setStatus ? "set" : (L.step > 0 ? `+${L.step}` : `${L.step}`));
            const from = L.from ? String(L.from) : "neutral";
            const to = L.to ? String(L.to) : (L.setStatus ? String(L.setStatus) : "neutral");
            pretty.push(`${L.srcName} → ${L.tgtName}: ${from} → ${to} (${stepTxt})${L.reason ? ` (${L.reason})` : ""}`);
          }

          const entry = {
            type: "relations",
            activity: "world_effect",
            summary: "Relations shifted — " + pretty.join(" • "),
            beatId: String(beatCtx?.beatId || ""),
            campaignId: beatCtx?.campaignId || null
          };
          await _callAddWarLog(factionsApi, targetFactionId, entry);
        }
      } catch (eWL) {
        console.warn(TAG, "relationship war log failed", eWL);
      }

      return { applied: true, count: count };
    } catch (e) {
      console.warn(TAG, "applyFactionRelationshipEffects failed", e);
      return { applied: false, count: 0 };
    }
  }

async function applyWorldEffects(input, ctx) {
    ensureNS();
    ensureFactionAPI();

    ctx = ctx || {};

    let beat = null;
    let we = null;

    if (input && input.worldEffects) {
      beat = input;
      we = input.worldEffects || {};
    } else {
      beat = {
        id: String(ctx.beatId || "boss_behavior"),
        type: String(ctx.beatType || "boss_behavior"),
        label: String(ctx.beatLabel || "Boss Behavior"),
        worldEffects: input || {}
      };
      we = beat.worldEffects || {};
    }

    if (!we || typeof we !== "object") return { applied: false, note: "no worldEffects" };

    const notes = [];
    let changed = false;

    const resolution = get(game, "bbttcc.api.resolution", null);
    const territory  = get(game, "bbttcc.api.territory", null);
    const rApi       = get(game, "bbttcc.api.radiation", null);
    const turnAPI    = get(game, "bbttcc.api.turn", null);
    const factions   = get(game, "bbttcc.api.factions", null);

    const beatCtx = {
      source        : (ctx.source !== undefined ? ctx.source : "bbttcc-campaign"),
      campaignId    : (ctx.campaignId !== undefined ? ctx.campaignId : null),
      campaignTitle : (ctx.campaignTitle !== undefined ? ctx.campaignTitle : null),
      beatId        : beat.id,
      beatType      : beat.type,
      beatLabel     : (beat.label || beat.id || "(unnamed)")
    };

    // 1) Territory outcome
    if (we.territoryOutcome) {
      const key = String(we.territoryOutcome).trim();
      if (key) {
        try {
          if (territory && typeof territory.applyOutcome === "function") {
            await territory.applyOutcome({ outcomeKey: key, beat: beat, ctx: beatCtx });
          } else if (resolution && typeof resolution.runResolution === "function") {
            await resolution.runResolution(key, beatCtx);
          }
          changed = true;
          notes.push("territoryOutcome:" + key);
        } catch (e) {
          console.warn(TAG, "territory/Resolution outcome failed", key, e);
        }
      }
    }

    // 2) Faction effects
    let fx = [];
    if (Array.isArray(we.factionEffects)) fx = we.factionEffects;
    const defaultFactionId = (ctx.factionId !== undefined ? ctx.factionId : null);

    for (let i=0;i<fx.length;i++) {
      const row = fx[i];
      if (!row) continue;

      let factionId = row.factionId;
      if ((!factionId || factionId === "") && defaultFactionId) factionId = defaultFactionId;

      const m  = Number(row.moraleDelta   ?? 0) || 0;
      const l  = Number(row.loyaltyDelta  ?? 0) || 0;
      const u  = Number(row.unityDelta    ?? 0) || 0;
      const dk = Number(row.darknessDelta ?? 0) || 0;
      const vp = Number(row.vpDelta ?? 0) || 0;
      const opD = (row.opDeltas && typeof row.opDeltas === "object") ? row.opDeltas : null;
      const allowOC = !!row.allowOvercap;

            const hasOp = !!(opD && Object.keys(opD).some(k => Number(opD[k] || 0) !== 0));
      if (!factionId || (!m && !l && !u && !dk && !vp && !hasOp)) continue;

      try {
        if (factions && typeof factions.applyDelta === "function") {
          await factions.applyDelta({
            factionId: factionId,
            moraleDelta   : m,
            loyaltyDelta  : l,
                        unityDelta    : u,
            vpDelta        : vp,
            darknessDelta : dk,
            reason        : "World Effect: " + beatCtx.beatLabel + " (" + beatCtx.beatType + ")",
            activity      : "world_effect"
          });
          changed = true;
          notes.push("faction:" + factionId);

          // OP Bank deltas (optional)
          try {
            if (opD && typeof opD === "object") {
              const deltas = {};
              for (const [k, v] of Object.entries(opD)) {
                const key = String(k || "").trim().toLowerCase();
                const dv = Number(v || 0);
                if (!key || !Number.isFinite(dv) || dv === 0) continue;
                deltas[key] = dv; // positive = grant, negative = spend
              }
              if (Object.keys(deltas).length) {
                const opApi = get(game, "bbttcc.api.op", null);
                if (opApi && typeof opApi.commit === "function") {
                  await opApi.commit(factionId, deltas, {
                    source: "world_effect",
                    allowOvercap: allowOC,
                    label: "Beat: " + beatCtx.beatLabel,
                    note: "Beat OP delta (" + beatCtx.beatType + ")"
                  });
                  notes.push("op:" + factionId);
                }
              }
            }
          } catch (eOP) {
            console.warn(TAG, "OP delta apply failed", factionId, eOP);
          }


          if (dk && !get(asFactionActor(factionId), "flags."+MOD_FACTIONS+".darkness", null)) {
            await _fallbackWriteDarkness(factionId, dk);
          }
        }
      } catch (e) {
        console.warn(TAG, "faction delta failed", factionId, e);
      }
    }

    // war log target faction
    let warFactionId = null;
    for (let i=0;i<fx.length;i++){
      if (fx[i] && fx[i].factionId) { warFactionId = fx[i].factionId; break; }
    }
    if (!warFactionId && defaultFactionId) warFactionId = defaultFactionId;

    // 2b) Unlock rewards
    try {
      if (beat && beat.unlocks && warFactionId) {
        const resU = await _applyFactionUnlocks(warFactionId, beat, beatCtx);
        if (resU && resU.applied) {
          changed = true;
          notes.push("unlocks:" + String(resU.count || 0));
        }
      }
    } catch (e) {
      console.warn(TAG, "unlock apply failed", e);
    }

    
    // 2c) Relationship effects (Status bump; NEW)
    try {
      const relFx = Array.isArray(we.relationshipEffects) ? we.relationshipEffects : [];
      if (relFx.length) {
        const resR = await _applyFactionRelationshipEffects(relFx, beatCtx, factions, warFactionId);
        if (resR && resR.applied) {
          changed = true;
          notes.push("relationships:" + String(resR.count || 0));
        }
      }
    } catch (eRel) {
      console.warn(TAG, "relationship apply failed", eRel);
    }

// 2c) World Modifiers (persistent hex effects)
    try {
      const mods = Array.isArray(we.worldModifiers) ? we.worldModifiers : [];
      if (mods.length) {
        // Resolve target: run-context first, then beat.targetHexUuid, then modifier.targetHexUuid
        const ctxHex = String((ctx && ctx.hexUuid) ? ctx.hexUuid : "").trim();
        const beatHex = String((beat && beat.targetHexUuid) ? beat.targetHexUuid : "").trim();
        const curTurn = _readWorldTurn();

        let appliedCount = 0;
        for (let i = 0; i < mods.length; i++) {
          const m = mods[i];
          if (!m || typeof m !== "object") continue;
          const key = String(m.key || "").trim();
          if (!key) continue;

          const mHex = String(m.targetHexUuid || "").trim();
          const targetHexUuid = ctxHex || beatHex || mHex;
          if (!targetHexUuid) {
            console.warn(TAG, "worldModifier has no target hex", { key: key, beatId: beatCtx.beatId });
            continue;
          }

          const doc = await resolveHexDoc(targetHexUuid);
          if (!doc || !doc.update) {
            console.warn(TAG, "worldModifier target hex could not be resolved", { key: key, targetHexUuid: targetHexUuid });
            continue;
          }

          const MOD_T = "bbttcc-territory";
          const tf = (doc.flags && doc.flags[MOD_T]) ? clone(doc.flags[MOD_T]) : {};
          const arr = Array.isArray(tf.worldModifiers) ? tf.worldModifiers.slice() : [];

          const now = Date.now();
          const durationTurns = Math.max(0, Math.floor(Number(m.durationTurns || 0) || 0));
          const createdTurn = (Number.isFinite(curTurn) && curTurn > 0) ? curTurn : 0;
          const expiresTurn = (durationTurns > 0 && createdTurn > 0) ? (createdTurn + durationTurns) : 0;

          // Build normalized row
          const row = {
            key: key,
            label: String(m.label || key).trim() || key,
            enabled: (m.enabled !== false),
            createdTurn: createdTurn,
            expiresTurn: expiresTurn,
            ts: now,
            via: String(beatCtx.beatId || beat.id || "beat"),
            channels: (m.channels && typeof m.channels === "object") ? m.channels : {},
            derived: (m.derived && typeof m.derived === "object") ? m.derived : null
          };

          // Upsert by key
          let replaced = false;
          for (let j = 0; j < arr.length; j++) {
            const cur = arr[j];
            if (!cur || typeof cur !== "object") continue;
            if (String(cur.key || "") !== key) continue;
            // Preserve original createdTurn if it exists
            if (cur.createdTurn && !row.createdTurn) row.createdTurn = cur.createdTurn;
            arr[j] = row;
            replaced = true;
            break;
          }
          if (!replaced) arr.push(row);

          tf.worldModifiers = arr;
          await doc.update({ ["flags." + MOD_T]: tf }, { parent: doc.parent });
          appliedCount++;
        }

        if (appliedCount) {
          changed = true;
          notes.push("worldModifiers:" + appliedCount);
        }
      }
    } catch (eWM) {
      console.warn(TAG, "worldModifiers apply failed", eWM);
    }

    // 3) Radiation
    if (we.radiationDelta && Number(we.radiationDelta) !== 0) {
      const delta = Number(we.radiationDelta || 0);
      try {
        if (rApi && typeof rApi.adjustAll === "function") {
          await rApi.adjustAll({
            delta: delta,
            source: beatCtx.source,
            campaignId: beatCtx.campaignId,
            beatId: beatCtx.beatId,
            sceneId: (beat.sceneId !== undefined ? beat.sceneId : null)
          });
        }
        changed = true;
        notes.push("radiationDelta:" + delta);
      } catch (e) {
        console.warn(TAG, "radiation adjustment failed", delta, e);
      }
    }

    // 4) Turn requests
    const turnReqs = Array.isArray(we.turnRequests) ? we.turnRequests : [];
    if (turnReqs.length && turnAPI && typeof turnAPI.enqueueRequest === "function") {
      for (let i=0;i<turnReqs.length;i++){
        const row = turnReqs[i];
        const k = String(row && row.key ? row.key : "").trim();
        const v = row ? row.value : null;
        if (!k) continue;
        try {
          await turnAPI.enqueueRequest({
            key: k,
            value: v,
            campaignId: beatCtx.campaignId,
            beatId: beatCtx.beatId,
            source: beatCtx.source
          });
          changed = true;
        } catch (e) {
          console.warn(TAG, "turn.enqueueRequest failed", k, e);
        }
      }
      if (changed) notes.push("turnRequests:" + turnReqs.length);
    }

    // 5) War log note
    if (we.warLog && typeof we.warLog === "string" && we.warLog.trim()) {
      const summary = we.warLog.trim();
      if (warFactionId && factions) {
        try {
          const entry = {
            type: (ctx.logType !== undefined ? ctx.logType : "world_effect"),
            activity: "world_effect",
            summary: summary,
            campaignId: beatCtx.campaignId,
            beatId: beatCtx.beatId
          };
          const ok = await _callAddWarLog(factions, warFactionId, entry);
          if (ok) {
            changed = true;
            notes.push("warLog");
          }
        } catch (e) {
          console.warn(TAG, "addWarLog failed", warFactionId, e);
        }
      }
    }

    if (changed) console.log(TAG, "Applied worldEffects", { beatId: beatCtx.beatId, beatType: beatCtx.beatType, notes: notes });
    else console.log(TAG, "No worldEffects applied (no-ops)", { beatId: beatCtx.beatId });

    return { applied: changed, notes: notes };
  }

  function installWorldMutationAPI() {
    try {
      ensureNS();
      ensureFactionAPI();
      game.bbttcc.api.worldMutation.applyWorldEffects = applyWorldEffects;
      console.log(TAG, "World Mutation API ready:", Object.keys(game.bbttcc.api.worldMutation));
    } catch (e) {
      console.warn(TAG, "installWorldMutationAPI failed:", e);
    }
  }

  Hooks.once("ready", installWorldMutationAPI);
  try { if (game && game.ready) installWorldMutationAPI(); } catch (e) {}
})();

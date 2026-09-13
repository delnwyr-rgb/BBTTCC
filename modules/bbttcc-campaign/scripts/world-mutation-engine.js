//
// FULL REPLACEMENT — Bad Eden World Mutation Engine v2.3 (Unlocks + Relationship Status)
// + FIX5 OP Schedules Policy/Correctness
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
  // OP Schedules (Deferred + Recurring OP effects)
  // Stored on faction actor:
  //   flags.bbttcc-factions.opSchedules = { v:1, items:[ ... ] }
  //
  // Items:
  //  - deferred: { kind:"deferred", executeOnTurn:N, opDeltas:{...} }
  //  - recurring:{ kind:"recurring", nextTurn:N, remaining:N, opDeltas:{...} }
  // ---------------------------------------------------------------------------

  function _normOpKey(k) {
    const s = String(k || "").trim().toLowerCase();
    if (!s) return "";
    // Common aliases / historical casing
    if (s === "soft_power") return "softpower";
    if (s === "softpower")  return "softpower";
    if (s === "non_lethal") return "nonlethal";
    if (s === "nonlethal")  return "nonlethal";
    return s.replace(/\s+/g, "");
  }

  function _cleanOpDeltas(opD) {
    const out = {};
    if (!opD || typeof opD !== "object") return out;
    for (const [k, v] of Object.entries(opD)) {
      const key = _normOpKey(k);
      const dv = Number(v || 0);
      if (!key || !Number.isFinite(dv) || dv === 0) continue;
      out[key] = dv;
    }
    return out;
  }

  function _ensureScheduleBox(flagsObj) {
    const cur = (flagsObj && typeof flagsObj === "object") ? flagsObj : {};
    const box = (cur.opSchedules && typeof cur.opSchedules === "object") ? clone(cur.opSchedules) : {};
    const items = Array.isArray(box.items) ? box.items.slice() : [];
    box.v = 1;
    box.items = items;
    cur.opSchedules = box;
    return { flags: cur, box: box, items: items };
  }

  function _makeScheduleId() {
    try {
      if (foundry?.utils?.randomID) return "sch_" + foundry.utils.randomID(10);
    } catch (_e) {}
    return "sch_" + Math.random().toString(36).slice(2, 10);
  }

  async function _pushScheduleItem(factionId, item) {
    const F = asFactionActor(factionId);
    if (!F) return { ok: false, error: "faction not found" };

    const flags = clone(F.flags && F.flags[MOD_FACTIONS] ? F.flags[MOD_FACTIONS] : {});
    const { box, items, flags: nextFlags } = _ensureScheduleBox(flags);

    items.push(item);
    box.items = items;
    nextFlags.opSchedules = box;

    await F.update({ ["flags."+MOD_FACTIONS]: nextFlags });
    return { ok: true, count: items.length, item: item };
  }

  function _fmtOpDeltas(opD) {
    const keys = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
    const parts = [];
    for (const k of keys) {
      const v = Number(opD && opD[k] != null ? opD[k] : 0);
      if (!Number.isFinite(v) || v === 0) continue;
      parts.push((v > 0 ? `+${v}` : `${v}`) + " " + k);
    }
    return parts.join(" • ") || "—";
  }

  async function _warLogScheduled(factionId, entry) {
    // We prefer factions.addWarLog (normalized), but fall back to direct append if missing.
    const factionsApi = get(game, "bbttcc.api.factions", null);
    const ok = await _callAddWarLog(factionsApi, factionId, entry);
    if (ok) return true;

    // fallback: append to flags
    try {
      const F = asFactionActor(factionId);
      if (!F) return false;
      const flags = clone(F.flags && F.flags[MOD_FACTIONS] ? F.flags[MOD_FACTIONS] : {});
      const wl = Array.isArray(flags.warLogs) ? flags.warLogs.slice() : [];
      const ts = Date.now();
      wl.push(Object.assign({ ts: ts, date: (new Date(ts)).toLocaleString() }, entry));
      flags.warLogs = wl;
      await F.update({ ["flags."+MOD_FACTIONS]: flags });
      return true;
    } catch (_e) {}
    return false;
  }

  // FIX5: deferred defaults allowOvercap:true (unless explicitly false)
  

// ---------------------------------------------------------------------------
// OP Schedule Audit (separate from warLogs to avoid clobber by other writers)
// Stored on faction actor:
//   flags.bbttcc-factions.opScheduleAudit = [{ ts, turn, action, kind, label, deltas, scheduleId, source }]
// ---------------------------------------------------------------------------
async function _auditScheduleEvent(factionId, ev) {
  try {
    const F = asFactionActor(factionId);
    if (!F) return false;
    const arr = Array.isArray(F.getFlag ? F.getFlag(MOD_FACTIONS, "opScheduleAudit") : (F.flags?.[MOD_FACTIONS]?.opScheduleAudit)) 
      ? (F.getFlag ? F.getFlag(MOD_FACTIONS, "opScheduleAudit") : (F.flags?.[MOD_FACTIONS]?.opScheduleAudit)).slice()
      : [];
    const ts = Date.now();
    const row = Object.assign({ ts: ts, date: (new Date(ts)).toLocaleString(), turn: _readWorldTurn() }, (ev||{}));
    arr.push(row);
    // Cap to last 200 entries to keep flags light
    while (arr.length > 200) arr.shift();
    if (F.setFlag) await F.setFlag(MOD_FACTIONS, "opScheduleAudit", arr);
    else {
      const flags = clone(F.flags && F.flags[MOD_FACTIONS] ? F.flags[MOD_FACTIONS] : {});
      flags.opScheduleAudit = arr;
      await F.update({ ["flags."+MOD_FACTIONS]: flags });
    }
    return true;
  } catch (_e) { return false; }
}
async function scheduleDeferredOP({ factionId, label, source, beatCtx, whenTurn, opDeltas, allowOvercap }) {
    const deltas = _cleanOpDeltas(opDeltas);
    if (!Object.keys(deltas).length) return { ok:false, skipped:true, reason:"no-op" };

    const curTurn = _readWorldTurn();
    const wtNum = Number(whenTurn);
    const executeOnTurn = (Number.isFinite(wtNum) && wtNum > 0)
      ? Math.floor(wtNum)
      : (curTurn + 1);

    const item = {
      id: _makeScheduleId(),
      kind: "deferred",
      executeOnTurn: executeOnTurn,
      opDeltas: deltas,
      allowOvercap: (allowOvercap !== false), // FIX5
      source: source || {},
      createdTurn: curTurn,
      createdAt: Date.now()
    };

    await _pushScheduleItem(factionId, item);

    await _warLogScheduled(factionId, {
      type: "turn",
      activity: "op_schedule",
      summary: `Scheduled OP: ${label || (source && source.label) || "deferred"} → ${_fmtOpDeltas(deltas)} on Turn ${executeOnTurn}.`,
      beatId: String(beatCtx?.beatId || ""),
      campaignId: beatCtx?.campaignId || null
    });

    try { await _auditScheduleEvent(factionId, { action:"scheduled", kind:"deferred", label:(label || source?.label || "deferred"), deltas:deltas, scheduleId:item.id, source: source||{} }); } catch(_e) {}

    return { ok:true, item:item };
  }

  async function scheduleRecurringOP({ factionId, label, source, beatCtx, turns, startTurn, opDeltas, allowOvercap }) {
    const deltas = _cleanOpDeltas(opDeltas);
    if (!Object.keys(deltas).length) return { ok:false, skipped:true, reason:"no-op" };

    const curTurn = _readWorldTurn();
    const total = Math.max(1, Math.floor(Number(turns || 1)));
    const stNum = Number(startTurn);
    const nextTurn = (Number.isFinite(stNum) && stNum > 0)
      ? Math.floor(stNum)
      : (curTurn + 1);

    const item = {
      id: _makeScheduleId(),
      kind: "recurring",
      nextTurn: nextTurn,
      remaining: total,
      interval: 1,
      opDeltas: deltas,
      allowOvercap: !!allowOvercap, // recurring stays strict by default
      source: source || {},
      createdTurn: curTurn,
      createdAt: Date.now()
    };

    await _pushScheduleItem(factionId, item);

    await _warLogScheduled(factionId, {
      type: "turn",
      activity: "op_schedule",
      summary: `Scheduled OP: ${label || (source && source.label) || "recurring"} → ${_fmtOpDeltas(deltas)} for ${total} turn(s) (starting Turn ${nextTurn}).`,
      beatId: String(beatCtx?.beatId || ""),
      campaignId: beatCtx?.campaignId || null
    });

    try { await _auditScheduleEvent(factionId, { action:"scheduled", kind:"recurring", label:(label || source?.label || "recurring"), deltas:deltas, scheduleId:item.id, source: source||{}, remaining: total, nextTurn: nextTurn }); } catch(_e) {}

    return { ok:true, item:item };
  }

  async function _applyOpDeltaViaOpAPI(factionId, deltas, meta) {
    const opApi = get(game, "bbttcc.api.op", null);
    if (!opApi || typeof opApi.commit !== "function") return { ok:false, error:"opApi.commit missing" };
    try {
      await opApi.commit(factionId, deltas, meta || {});
      return { ok:true };
    } catch (e) {
      return { ok:false, error:e };
    }
  }

  async function tickOpSchedulesForFaction(factionId, { turnOverride=null } = {}) {
    const F = asFactionActor(factionId);
    if (!F) return { ok:false, error:"faction not found" };

    const _hasOverride = (turnOverride !== null && typeof turnOverride !== "undefined");

    const curTurn = (_hasOverride && Number.isFinite(Number(turnOverride))) ? Math.max(0, Math.floor(Number(turnOverride))) : _readWorldTurn();

    const flags = clone(F.flags && F.flags[MOD_FACTIONS] ? F.flags[MOD_FACTIONS] : {});
    const box = (flags.opSchedules && typeof flags.opSchedules === "object") ? clone(flags.opSchedules) : { v:1, items:[] };
    const items = Array.isArray(box.items) ? box.items.slice() : [];

    if (!items.length) return { ok:true, changed:false, applied:0, remaining:0 };

    const nextItems = [];
    let applied = 0;

    for (let i=0; i<items.length; i++) {
      let it = items[i];
      if (!it || typeof it !== "object") continue;

      const kind = String(it.kind || "").toLowerCase();

      // FIX5:
      // - Deferred defaults allowOvercap:true unless explicitly false
      // - Recurring keeps its explicit boolean
      const allowOC = (kind === "deferred") ? (it.allowOvercap !== false) : !!it.allowOvercap;

      const source = (it.source && typeof it.source === "object") ? it.source : {};
      const deltas = _cleanOpDeltas(it.opDeltas);

      if (!Object.keys(deltas).length) {
        // Drop empty schedule rows silently
        continue;
      }

      if (kind === "deferred") {
        let due = Number(it.executeOnTurn);
        let repaired = false;
        if (!Number.isFinite(due) || due <= 0) {
          const ct = Number(it.createdTurn);
          due = (Number.isFinite(ct) && ct > 0) ? (Math.floor(ct) + 1) : 0;
          repaired = true;
        }
        if (!due || due <= 0) { due = curTurn; repaired = true; }

        // If we repaired the due turn, persist it so list() shows the corrected value.
        if (repaired) {
          const fixed = clone(it);
          fixed.executeOnTurn = due;
          it = fixed;
        }

        if (curTurn >= due) {
          const applyRes = await _applyOpDeltaViaOpAPI(factionId, deltas, {
            source: "scheduled_op",
            allowOvercap: allowOC,
            label: "Scheduled OP",
            note: (source.label ? String(source.label) : "Deferred OP")
          });

          // FIX5 correctness: only count applied on success (already true here)
          if (applyRes && applyRes.ok) {
            applied++;

            await _warLogScheduled(factionId, {
              type: "turn",
              activity: "scheduled_op",
              summary: `Turn ${curTurn} OP Grant: ${(source.label || "Deferred")} → ${_fmtOpDeltas(deltas)} (completed).`
            });
            try { await _auditScheduleEvent(factionId, { action:"applied", kind:"deferred", turn: curTurn, label:(source.label || "Deferred"), deltas:deltas, scheduleId: it.id, source: source||{} }); } catch(_e) {}

            // Completed: drop it
            continue;
          }

          // Could not apply (most commonly OP cap). Keep it and log.
          nextItems.push(it);

          await _warLogScheduled(factionId, {
            type: "turn",
            activity: "scheduled_op_blocked",
            summary: `Turn ${curTurn} OP Grant BLOCKED: ${(source.label || "Deferred")} → ${_fmtOpDeltas(deltas)} (will retry).`
          });
          try { await _auditScheduleEvent(factionId, { action:"blocked", kind:"deferred", turn: curTurn, label:(source.label || "Deferred"), deltas:deltas, scheduleId: it.id, source: source||{} }); } catch(_e) {}

          continue;
        }

        nextItems.push(it);
        continue;
      }

      if (kind === "recurring") {
        let nextTurn = Number(it.nextTurn);
        let remaining = Math.max(0, Math.floor(Number(it.remaining || 0)));
        let repaired = false;

        if (!Number.isFinite(nextTurn) || nextTurn <= 0) {
          const ct = Number(it.createdTurn);
          nextTurn = (Number.isFinite(ct) && ct > 0) ? (Math.floor(ct) + 1) : 0;
          repaired = true;
        }
        if (!nextTurn || nextTurn <= 0) { nextTurn = curTurn; repaired = true; }

        // Persist repaired nextTurn so list() shows the corrected value.
        if (repaired) {
          const fixed = clone(it);
          fixed.nextTurn = nextTurn;
          it = fixed;
        }

        if (remaining > 0 && nextTurn && curTurn >= nextTurn) {
          const applyRes = await _applyOpDeltaViaOpAPI(factionId, deltas, {
            source: "scheduled_op",
            allowOvercap: allowOC,
            label: "Scheduled OP",
            note: (source.label ? String(source.label) : "Recurring OP")
          });

          if (applyRes && applyRes.ok) {
            applied++;
            remaining = Math.max(0, remaining - 1);

            await _warLogScheduled(factionId, {
              type: "turn",
              activity: "scheduled_op",
              summary: `Turn ${curTurn} OP Tick: ${(source.label || "Recurring")} → ${_fmtOpDeltas(deltas)} (${remaining} remaining).`
            });
            try { await _auditScheduleEvent(factionId, { action:"tick", kind:"recurring", turn: curTurn, label:(source.label || "Recurring"), deltas:deltas, scheduleId: it.id, source: source||{}, remaining: remaining, nextTurn: nextTurn }); } catch(_e) {}

            if (remaining <= 0) {
              // Completed
              try { await _auditScheduleEvent(factionId, { action:"completed", kind:"recurring", turn: curTurn, label:(source.label || "Recurring"), deltas:deltas, scheduleId: it.id, source: source||{} }); } catch(_e) {}
              continue;
            }

            // Advance to next interval
            const bumped = clone(it);
            bumped.remaining = remaining;
            bumped.nextTurn = (Math.max(0, Math.floor(Number(nextTurn))) + 1);
            nextItems.push(bumped);
            continue;
          }

          // Could not apply (most commonly OP cap). Keep it and log; do not decrement.
          nextItems.push(it);

          await _warLogScheduled(factionId, {
            type: "turn",
            activity: "scheduled_op_blocked",
            summary: `Turn ${curTurn} OP Tick BLOCKED: ${(source.label || "Recurring")} → ${_fmtOpDeltas(deltas)} (${remaining} remaining; will retry).`
          });
          try { await _auditScheduleEvent(factionId, { action:"blocked", kind:"recurring", turn: curTurn, label:(source.label || "Recurring"), deltas:deltas, scheduleId: it.id, source: source||{}, remaining: remaining, nextTurn: nextTurn }); } catch(_e) {}

          continue;
        }

        nextItems.push(it);
        continue;
      }

      // Unknown kind: preserve
      nextItems.push(it);
    }

    // Write back if changed
    if (nextItems.length !== items.length) {
      flags.opSchedules = { v:1, items: nextItems };
      await F.update({ ["flags."+MOD_FACTIONS]: flags });
      return { ok:true, changed:true, applied: applied, remaining: nextItems.length };
    }

    // If we applied but lengths same (e.g., recurring bumped in-place) still rewrite for nextTurn changes
    if (applied > 0) {
      flags.opSchedules = { v:1, items: nextItems };
      await F.update({ ["flags."+MOD_FACTIONS]: flags });
      return { ok:true, changed:true, applied: applied, remaining: nextItems.length };
    }

    return { ok:true, changed:false, applied:0, remaining: nextItems.length };
  }

  async function tickOpSchedulesAllFactions({ turnOverride=null } = {}) {
    const rows = [];
    let applied = 0;
    for (const A of (game.actors?.contents ?? [])) {
      const F = asFactionActor(A);
      if (!F) continue;
      const res = await tickOpSchedulesForFaction(F.id, { turnOverride: turnOverride });
      rows.push({ factionId: F.id, factionName: F.name, ...res });
      applied += Number(res.applied || 0);
    }
    return { ok:true, applied: applied, rows: rows };
  }

  function installOpScheduleAPI() {
    try {
      ensureNS();
      game.bbttcc.api.opSchedules = game.bbttcc.api.opSchedules || {};
      const api = game.bbttcc.api.opSchedules;

      api.list = function(factionId){
        const F = asFactionActor(factionId);
        if (!F) return { ok:false, error:"faction not found" };
        const box = F.getFlag ? (F.getFlag(MOD_FACTIONS, "opSchedules") || {}) : (F.flags?.[MOD_FACTIONS]?.opSchedules || {});
        const items = Array.isArray(box.items) ? box.items.slice() : [];
        return { ok:true, v: (box.v || 1), items: items };
      };

      api.tickFaction = async function(factionId, opts){ return await tickOpSchedulesForFaction(factionId, opts || {}); };
      api.tickAll = async function(opts){ return await tickOpSchedulesAllFactions(opts || {}); };

      api.clear = async function(factionId){
        if (!game.user?.isGM) return { ok:false, error:"GM-only" };
        const F = asFactionActor(factionId);
        if (!F) return { ok:false, error:"faction not found" };
        const flags = clone(F.flags && F.flags[MOD_FACTIONS] ? F.flags[MOD_FACTIONS] : {});
        flags.opSchedules = { v:1, items: [] };
        await F.update({ ["flags."+MOD_FACTIONS]: flags });
        await _warLogScheduled(factionId, { type:"turn", activity:"op_schedule", summary:"Cleared OP schedules (GM)." });
        return { ok:true };
      };

      api.repair = async function(factionId){
        const F = asFactionActor(factionId);
        if (!F) return { ok:false, error:"faction not found" };
        const curTurn = _readWorldTurn();
        const flags = clone(F.flags && F.flags[MOD_FACTIONS] ? F.flags[MOD_FACTIONS] : {});
        const box = (flags.opSchedules && typeof flags.opSchedules === "object") ? clone(flags.opSchedules) : { v:1, items:[] };
        const items = Array.isArray(box.items) ? box.items.slice() : [];
        let changed = false;

        const fixed = [];
        for (const it0 of items){
          const it = (it0 && typeof it0 === "object") ? clone(it0) : null;
          if (!it) continue;
          const kind = String(it.kind || "").toLowerCase();

          if (kind === "deferred") {
            let due = Number(it.executeOnTurn);
            if (!Number.isFinite(due) || due <= 0) {
              const ct = Number(it.createdTurn);
              due = (Number.isFinite(ct) && ct > 0) ? (Math.floor(ct) + 1) : (curTurn + 1);
              it.executeOnTurn = due;
              changed = true;
            }
            // FIX5: ensure missing allowOvercap defaults to true for deferred
            if (it.allowOvercap === undefined) {
              it.allowOvercap = true;
              changed = true;
            }
          } else if (kind === "recurring") {
            let nt = Number(it.nextTurn);
            if (!Number.isFinite(nt) || nt <= 0) {
              const ct = Number(it.createdTurn);
              nt = (Number.isFinite(ct) && ct > 0) ? (Math.floor(ct) + 1) : (curTurn + 1);
              it.nextTurn = nt;
              changed = true;
            }
            if (it.remaining == null) {
              it.remaining = 1;
              changed = true;
            }
            // recurring keeps explicit allowOvercap boolean (default false)
          }

          fixed.push(it);
        }

        if (changed) {
          flags.opSchedules = { v:1, items: fixed };
          await F.update({ ["flags."+MOD_FACTIONS]: flags });
        }
        return { ok:true, changed: changed, count: fixed.length };
      };

      api.repairAll = async function(){
        const rows = [];
        let changed = 0;
        for (const A of (game.actors?.contents ?? [])) {
          const F = asFactionActor(A);
          if (!F) continue;
          const r = await api.repair(F.id);
          rows.push({ factionId: F.id, factionName: F.name, ...r });
          if (r && r.changed) changed++;
        }
        return { ok:true, changed: changed, rows: rows };
      };

      console.log(TAG, "OP Schedule API ready:", Object.keys(api));
    } catch (e) {
      console.warn(TAG, "installOpScheduleAPI failed:", e);
    }
  }

  function installOpScheduleTickHook() {
    try {
      // Robust idempotency: only install if we don't already have a handler function.
      if (globalThis.__bbttccOpScheduleTickHandler && typeof globalThis.__bbttccOpScheduleTickHandler === "function") return;

      globalThis.__bbttccOpScheduleTickHandler = function(ctx){
        if (!game.user?.isGM) return;   // world-state writes run once, on the GM
        if (ctx?.apply === false) return; // dry-run / preview — don't tick OP schedules
        // Fire-and-forget; do not block Turn Driver.
        tickOpSchedulesAllFactions({}).catch(e => console.warn(TAG, "tickOpSchedulesAllFactions failed", e));
      };

      Hooks.on("bbttcc:advanceTurn:end", globalThis.__bbttccOpScheduleTickHandler);

      console.log(TAG, "Installed bbttcc:advanceTurn:end hook for OP schedules.");
    } catch (e) {
      console.warn(TAG, "installOpScheduleTickHook failed:", e);
    }
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
            if (ts === "moment") tp = 0;
            else if (ts === "scene") tp = 1;
            else if (ts === "leg") tp = 1;
            else if (ts === "turn") tp = turnLen;
            else if (ts === "arc") tp = turnLen * 3;
            else tp = 0;
          }

          if (tp && tp > 0) {
            const src = String(ctx?.source || "beat");
            const note = `Beat ${String(beat?.id || ctx?.beatId || "unknown")} (${String(beat?.timeScale || "scene")})`;
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

        const setStatus = row.setStatus != null ? _normRelStatus(row.setStatus) : null;
        const stepRaw = (row.step != null ? row.step : (row.delta != null ? row.delta : 0));
        const step = Math.round(Number(stepRaw || 0) || 0);
        if (!setStatus && !step) continue;

        const reason = String(row.reason || "").trim();

        if (!bySource.has(src.id)) bySource.set(src.id, { actor: src, rows: [] });
        bySource.get(src.id).rows.push({ target: tgt, setStatus, step, reason });

        lines.push({ srcName: src.name, tgtName: tgt.name, setStatus, step, reason, tgtId: tgt.id, srcId: src.id });
      }

      if (!bySource.size) return { applied: false, count: 0 };

      let count = 0;

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

  // ── named hex states (2026-09-13) — the yield engine's list, tf.modifiers ─────────────────────
  // One writer for beats: add/remove names, recompute the yield cache, ledger, GM whisper.
  function _normName(x) { return String(x || "").replace(/[\s\u00A0]+/g, " ").trim().toLowerCase(); }
  function _findHexByName(name) {
    const want = _normName(name); if (!want) return null;
    for (const sc of (game.scenes || [])) for (const d of (sc.drawings || [])) {
      const tf = d.flags && d.flags["bbttcc-territory"]; if (!tf || !(tf.isHex === true || tf.kind === "territory-hex")) continue;
      if (_normName(tf.name || d.text) === want) return d;
    }
    return null;
  }
  async function _applyNamedModifiers(doc, add, remove, { beat = null, beatId = "", via = "beat" } = {}) {
    const MOD_T = "bbttcc-territory";
    const tf = (doc.flags && doc.flags[MOD_T]) ? clone(doc.flags[MOD_T]) : {};
    const cur = Array.isArray(tf.modifiers) ? tf.modifiers.slice() : [];
    const before = cur.slice();
    const has = (n) => cur.some(m => _normName(m) === _normName(n));
    const added = [], removed = [];
    for (const n of (Array.isArray(add) ? add : [])) { if (n && !has(n)) { cur.push(String(n).trim()); added.push(String(n).trim()); } }
    for (const n of (Array.isArray(remove) ? remove : [])) { const i = cur.findIndex(m => _normName(m) === _normName(n)); if (i >= 0) { removed.push(cur[i]); cur.splice(i, 1); } }
    if (!added.length && !removed.length) return { added, removed };
    await doc.update({ ["flags." + MOD_T + ".modifiers"]: cur }, { parent: doc.parent });
    try { const rc = get(game, "bbttcc.api.territory.recomputeHexResources", null); if (typeof rc === "function") await rc(doc, { source: via + ":" + (beatId || "?") }); } catch (eRc) { console.warn(TAG, "named modifiers recompute failed", eRc); }
    const label = added.map(a => "+" + a).concat(removed.map(r => "−" + r)).join(", ");
    try { const rec = get(game, "bbttcc.api.territory.recordHexImprovement", null); if (typeof rec === "function") await rec(doc, { kind: "modifiers_changed", label: `Modifiers: ${label}`, description: beat ? `By beat “${beat.label || beat.id}”.` : `By ${via}.`, source: via, before: { modifiers: before }, after: { modifiers: cur }, reversible: true }); } catch (_eRec) {}
    try {
      const esc = foundry.utils.escapeHTML;
      await ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id), speaker: { alias: "Bad Eden" },
        content: `<div style="border-left:3px solid #c9a227;padding:.35em .6em;background:rgba(201,162,39,.08);">🗺️ <b>${esc(String(tf.name || doc.id))}</b>: ${esc(label)} <span style="opacity:.7">(${beat ? `beat “${esc(String(beat.label || beat.id))}”` : esc(via)})</span></div>` });
    } catch (_eMsg) {}
    return { added, removed };
  }
  // Duration: World Modifier rows carry expiresTurn; at every applied Advance, expired rows come off
  // the hex together with the named states they brought (the old rows never expired — 2026-09-13).
  async function sweepExpiredWorldModifiers({ turn = null } = {}) {
    const out = { expired: 0 };
    try {
      if (!game.user?.isGM) return out;
      const now = Number.isFinite(Number(turn)) ? Number(turn) : _readWorldTurn();
      if (!(now > 0)) return out;
      const MOD_T = "bbttcc-territory";
      for (const sc of (game.scenes || [])) for (const d of (sc.drawings || [])) {
        const tf = d.flags && d.flags[MOD_T]; if (!tf || !Array.isArray(tf.worldModifiers) || !tf.worldModifiers.length) continue;
        const keep = [], gone = [];
        for (const row of tf.worldModifiers) { const exp = Number(row && row.expiresTurn || 0); if (exp > 0 && now >= exp) gone.push(row); else keep.push(row); }
        if (!gone.length) continue;
        await d.update({ ["flags." + MOD_T + ".worldModifiers"]: keep }, { parent: d.parent });
        const names = []; for (const row of gone) for (const n of (Array.isArray(row.modifiers) ? row.modifiers : _registryModifiers(row.key))) names.push(n);
        await _applyNamedModifiers(d, [], names, { via: "expired (turn " + now + ")" });
        out.expired += gone.length;
      }
    } catch (e) { console.warn(TAG, "sweepExpiredWorldModifiers failed", e); }
    return out;
  }
  function _registryModifiers(key) { try { const reg = get(game, "bbttcc.facts.hexStates.unique", null); const e = reg && reg[String(key || "")]; return e && Array.isArray(e.modifiers) ? e.modifiers.slice() : []; } catch (_e) { return []; } }

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

      // Deferred / Recurring OP scheduling (do NOT apply immediately)
      const deferred = (row.deferred && typeof row.deferred === "object") ? row.deferred : null;
      const recurring = (row.recurring && typeof row.recurring === "object") ? row.recurring : null;

      // If deferred/recurring exists, prefer its opDeltas; otherwise fall back to row.opDeltas.
      const schedOpD = deferred ? (deferred.opDeltas || opD) : (recurring ? (recurring.opDeltas || opD) : null);
      const schedDeltas = _cleanOpDeltas(schedOpD);

      const hasImmediateOp = !!(opD && Object.keys(opD).some(k => Number(opD[k] || 0) !== 0));
      const hasScheduledOp = !!((deferred || recurring) && Object.keys(schedDeltas).length);
      const hasOp = hasImmediateOp || hasScheduledOp;

      if (!factionId || (!m && !l && !u && !dk && !vp && !hasOp)) continue;

      try {
        if (factions && typeof factions.applyDelta === "function") {
          await factions.applyDelta({
            factionId: factionId,
            moraleDelta   : m,
            loyaltyDelta  : l,
            unityDelta    : u,
            vpDelta       : vp,
            darknessDelta : dk,
            reason        : "World Effect: " + beatCtx.beatLabel + " (" + beatCtx.beatType + ")",
            activity      : "world_effect"
          });
          changed = true;
          notes.push("faction:" + factionId);

          // OP Bank deltas (optional)
          try {
            // If this factionEffect specifies deferred/recurring OP, schedule it instead of applying now.
            if (hasScheduledOp) {
              const src = {
                system: "world_effect",
                label: String(row.label || row.maneuverLabel || beatCtx.beatLabel || "Scheduled OP").trim() || "Scheduled OP",
                maneuverKey: String(row.maneuverKey || row.key || row.activityKey || "").trim() || null,
                beatId: String(beatCtx.beatId || "")
              };

              // FIX5 policy:
              // - Deferred rewards default allowOvercap:true unless explicitly false
              // - Recurring remains strict by default
              const allowOC_deferred = (row.allowOvercap !== false);
              const allowOC_recurring = (row.allowOvercap === true);

              if (deferred) {
                const whenTurn = (deferred.executeOnTurn != null) ? deferred.executeOnTurn
                              : (deferred.turn != null) ? deferred.turn
                              : (deferred.whenTurn != null) ? deferred.whenTurn
                              : null; // default is next turn

                await scheduleDeferredOP({
                  factionId: factionId,
                  label: src.label,
                  source: src,
                  beatCtx: beatCtx,
                  whenTurn: whenTurn,
                  opDeltas: schedDeltas,
                  allowOvercap: allowOC_deferred // FIX5
                });
                notes.push("opScheduled:" + factionId);
              } else if (recurring) {
                const turns = (recurring.turns != null) ? recurring.turns
                           : (recurring.duration != null) ? recurring.duration
                           : (recurring.remaining != null) ? recurring.remaining
                           : 1;
                const startTurn = (recurring.startTurn != null) ? recurring.startTurn
                                : (recurring.nextTurn != null) ? recurring.nextTurn
                                : null; // default next turn

                await scheduleRecurringOP({
                  factionId: factionId,
                  label: src.label,
                  source: src,
                  beatCtx: beatCtx,
                  turns: turns,
                  startTurn: startTurn,
                  opDeltas: schedDeltas,
                  allowOvercap: allowOC_recurring // strict default
                });
                notes.push("opScheduled:" + factionId);
              }
            }

            // Immediate OP deltas (legacy)
            if (!hasScheduledOp && opD && typeof opD === "object") {
              const deltas = _cleanOpDeltas(opD);
              if (Object.keys(deltas).length) {
                const allowOC_immediate = (row.allowOvercap === true);
                await _applyOpDeltaViaOpAPI(factionId, deltas, {
                  source: "world_effect",
                  allowOvercap: allowOC_immediate,
                  label: "Beat: " + beatCtx.beatLabel,
                  note: "Beat OP delta (" + beatCtx.beatType + ")"
                });
                notes.push("op:" + factionId);
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

    // 2d) World Modifiers (persistent hex effects)
    try {
      const mods = Array.isArray(we.worldModifiers) ? we.worldModifiers : [];
      if (mods.length) {
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
          const op = String(m.op || "add").toLowerCase() === "remove" ? "remove" : "add";
          const names = Array.isArray(m.modifiers) && m.modifiers.length ? m.modifiers.slice() : _registryModifiers(key);   // the named states this row carries
          // target: an explicit hexName on the row wins (a door beat marks towns it is nowhere near), else the row's uuid, else the run context / beat hex
          let doc = m.hexName ? _findHexByName(m.hexName) : null;
          const targetHexUuid = doc ? "" : (mHex || ctxHex || beatHex);
          if (!doc && !targetHexUuid) {
            console.warn(TAG, "worldModifier has no target hex", { key: key, beatId: beatCtx.beatId });
            continue;
          }
          if (!doc) doc = await resolveHexDoc(targetHexUuid);
          if (!doc || !doc.update) {
            console.warn(TAG, "worldModifier target hex could not be resolved", { key: key, targetHexUuid: targetHexUuid });
            continue;
          }

          const MOD_T = "bbttcc-territory";
          const tf = (doc.flags && doc.flags[MOD_T]) ? clone(doc.flags[MOD_T]) : {};
          const arr = Array.isArray(tf.worldModifiers) ? tf.worldModifiers.slice() : [];

          if (op === "remove") {   // lift the chip and the named states it brought
            const rest = arr.filter(cur => !(cur && String(cur.key || "") === key));
            if (rest.length !== arr.length) { tf.worldModifiers = rest; await doc.update({ ["flags." + MOD_T]: tf }, { parent: doc.parent }); }
            await _applyNamedModifiers(doc, [], names, { beat, beatId: beatCtx.beatId || beat.id });
            appliedCount++;
            continue;
          }

          const now = Date.now();
          const durationTurns = Math.max(0, Math.floor(Number(m.durationTurns || 0) || 0));
          const createdTurn = (Number.isFinite(curTurn) && curTurn > 0) ? curTurn : 0;
          const expiresTurn = (durationTurns > 0 && createdTurn > 0) ? (createdTurn + durationTurns) : 0;

          const row = {
            key: key,
            label: String(m.label || key).trim() || key,
            enabled: (m.enabled !== false),
            createdTurn: createdTurn,
            expiresTurn: expiresTurn,
            ts: now,
            via: String(beatCtx.beatId || beat.id || "beat"),
            channels: (m.channels && typeof m.channels === "object") ? m.channels : {},
            derived: (m.derived && typeof m.derived === "object") ? m.derived : null,
            modifiers: names
          };

          let replaced = false;
          for (let j = 0; j < arr.length; j++) {
            const cur = arr[j];
            if (!cur || typeof cur !== "object") continue;
            if (String(cur.key || "") !== key) continue;
            if (cur.createdTurn && !row.createdTurn) row.createdTurn = cur.createdTurn;
            arr[j] = row;
            replaced = true;
            break;
          }
          if (!replaced) arr.push(row);

          tf.worldModifiers = arr;
          await doc.update({ ["flags." + MOD_T]: tf }, { parent: doc.parent });
          await _applyNamedModifiers(doc, names, [], { beat, beatId: beatCtx.beatId || beat.id });   // the chip's teeth (2026-09-13)
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

    // 2e) Hex MODIFIERS — the primitive (2026-09-13): worldEffects.hexModifiers = {add,remove,hexName?|targetHexUuid?}
    // or a list of such blocks. World Modifier rows above are the editor-facing way; this is the seeder/API way.
    try {
      const hmList = Array.isArray(we.hexModifiers) ? we.hexModifiers : (we.hexModifiers && typeof we.hexModifiers === "object" ? [we.hexModifiers] : []);
      for (const hm of hmList) {
        if (!hm || !((Array.isArray(hm.add) && hm.add.length) || (Array.isArray(hm.remove) && hm.remove.length))) continue;
        const ctxHex = String((ctx && ctx.hexUuid) ? ctx.hexUuid : "").trim();
        const beatHex = String((beat && beat.targetHexUuid) ? beat.targetHexUuid : "").trim();
        const doc = hm.hexName ? _findHexByName(hm.hexName) : (hm.targetHexUuid ? await resolveHexDoc(hm.targetHexUuid) : (ctxHex || beatHex ? await resolveHexDoc(ctxHex || beatHex) : null));
        if (!doc || !doc.update) { console.warn(TAG, "hexModifiers: target hex not found", { hexName: hm.hexName, targetHexUuid: hm.targetHexUuid, beatId: beatCtx.beatId }); continue; }
        const r = await _applyNamedModifiers(doc, hm.add, hm.remove, { beat, beatId: beatCtx.beatId || beat.id });
        if (r.added.length || r.removed.length) { changed = true; notes.push("hexModifiers:" + (r.added.length + r.removed.length)); }
      }
    } catch (eHM) {
      console.warn(TAG, "hexModifiers apply failed", eHM);
    }

    // 2f) Hex READING — the Water Choir as an instrument (owner ruling 2026-09-13, R5).
    // worldEffects.hexReading = { hexName, voice? } → a player-facing card in the Choir's language,
    // in BANDS never numbers, reading three things: the tenders' mood (coalition morale/loyalty),
    // the land's hurt (this hex's darkness + Fallout Bloom + how many coalition hexes carry a blast
    // mark), and the lean (leyline flow/purity, and the Red Thread once planted). The GM gets the same
    // card with the raw facts under it. Never names the source — the Choir knows toward, not what.
    try {
      const hr = we.hexReading && typeof we.hexReading === "object" ? we.hexReading : null;
      if (hr && hr.hexName) {
        const norm = (x) => String(x || "").replace(/[\s\u00A0]+/g, " ").trim().toLowerCase();
        let doc = null; const want = norm(hr.hexName);
        for (const sc of (game.scenes || [])) { for (const d of (sc.drawings || [])) { const tf = d.flags && d.flags["bbttcc-territory"]; if (tf && (tf.isHex === true || tf.kind === "territory-hex") && norm(tf.name || d.text) === want) { doc = d; break; } } if (doc) break; }
        if (!doc) console.warn(TAG, "hexReading: hex not found", hr.hexName);
        else {
          const tf = doc.flags["bbttcc-territory"] || {};
          const mods = (Array.isArray(tf.modifiers) ? tf.modifiers : []).map(norm);
          const darkness = Number(tf.mods && tf.mods.darkness || 0) || 0;
          const flow = String((tf.leylines && tf.leylines.flowState) || "normal").toLowerCase();
          const purity = Number((tf.leylines && tf.leylines.purity) || 0) || 0;
          const bloom = mods.includes("fallout bloom"), thread = mods.includes("red thread field");
          // coalition: the active campaign's roster, else the hex's owner
          let fids = [];
          try { const capi = get(game, "bbttcc.api.campaign", null); const cid = capi && capi.getActiveCampaignId ? capi.getActiveCampaignId() : null; const camp = cid && capi.getCampaign ? capi.getCampaign(cid) : null; fids = [].concat((camp && camp.factionIds) || [], (camp && camp.factionId) ? [camp.factionId] : []); } catch (_eC) {}
          if (!fids.length && tf.factionId) fids = [tf.factionId];
          const fset = new Set(fids.map(x => String(x || "").replace(/^Actor\./, "")));
          const facs = [...fset].map(id => game.actors.get(id)).filter(Boolean);
          const num = (v) => (v && typeof v === "object") ? Number(v.value || 0) : Number(v || 0);
          const morale = facs.length ? Math.round(facs.reduce((a, f) => a + num(get(f, "flags.bbttcc-factions.morale", 0)), 0) / facs.length) : null;
          const loyalty = facs.length ? Math.round(facs.reduce((a, f) => a + num(get(f, "flags.bbttcc-factions.loyalty", 0)), 0) / facs.length) : null;
          let footprint = 0;
          for (const sc of (game.scenes || [])) for (const d of (sc.drawings || [])) { const t2 = d.flags && d.flags["bbttcc-territory"]; if (!t2 || !fset.has(String(t2.factionId || ""))) continue; const m2 = (Array.isArray(t2.modifiers) ? t2.modifiers : []).map(norm); if (m2.includes("fallout bloom") || m2.includes("damaged infrastructure") || m2.includes("contaminated")) footprint++; }
          const band = (v, hi, mid) => v == null ? "unknown" : v >= hi ? "steady" : v >= mid ? "uneasy" : "strained";
          const moodM = band(morale, 60, 30), moodL = band(loyalty, 60, 30);
          const mood = (moodM === "steady" && moodL === "steady") ? "The wide basin settles when you stand in it. Whoever tends this water is sleeping through the night."
            : (moodM === "strained" || moodL === "strained") ? "It tunes and re-tunes and cannot find you. The people who tend this water are holding something in."
            : "It finds you, loses you, finds you again. The tenders are steady on the surface and not underneath.";
          const hurt = bloom ? `One basin is playing flat on purpose, a held finger on a string.${footprint > 1 ? ` The flat note has spread — ${footprint} of your places carry it now.` : ""}`
            : darkness >= 3 ? "Every basin has gone a quarter-tone dark, and none of them will say why."
            : darkness >= 1 ? "There is a low note under the song that was not there last season."
            : (footprint > 0 ? `This water is clean. ${footprint} of your places ${footprint === 1 ? "is" : "are"} not.` : "The water is clean. It says so, at length.");
          const lean = flow === "surge" ? "The water wants to run uphill. It is very sure about the direction and will not say the name."
            : flow === "stagnation" ? "It has stopped arguing. A basin that stops arguing is a basin that has given up on something."
            : flow === "turbulence" ? "It stutters in the narrow channels — something upstream is deciding."
            : flow === "inversion" ? "It runs the wrong way for one breath in ten, and pretends it didn't."
            : "It runs the way it always has. Whatever leaned on the land that night, this water has not leaned with it.";
          const threadLine = thread ? " The red-thread stand at the low field leans, all together, the same way the water wants to go." : "";
          const pur = purity >= 3 ? " There is a clarity in the low tones that reads as intent." : purity <= -3 ? " The low tones have silt in them." : "";
          const esc = foundry.utils.escapeHTML;
          const voice = esc(String(hr.voice || "The Water Choir"));
          const content = `<div class="bbttcc-hex-reading" style="border-left:3px solid #4db8b0;padding:.45em .7em;background:rgba(77,184,176,.08);">
            <div style="opacity:.75;font-size:.85em;margin-bottom:.25em;">🎶 ${voice} — ${esc(String(tf.name || hr.hexName))}</div>
            <p><b>The tenders.</b> ${esc(mood)}</p><p><b>The hurt.</b> ${esc(hurt)}</p><p><b>The lean.</b> ${esc(lean)}${esc(threadLine)}${esc(pur)}</p></div>`;
          await ChatMessage.create({ speaker: { alias: voice }, content });
          try { await ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id), speaker: { alias: "Bad Eden" }, content: `<div style="opacity:.85;font-size:.9em;">🎶 <b>Choir raw</b> — ${esc(String(tf.name || hr.hexName))}: morale ${morale ?? "—"} · loyalty ${loyalty ?? "—"} · darkness ${darkness} · flow ${esc(flow)} · purity ${purity} · bloom ${bloom ? "yes" : "no"} · red thread ${thread ? "yes" : "no"} · blast-marked hexes ${footprint}</div>` }); } catch (_eRaw) {}
          changed = true;
          notes.push("hexReading:" + String(tf.name || hr.hexName));
        }
      }
    } catch (eHR) {
      console.warn(TAG, "hexReading failed", eHR);
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

    // ── openTravel: hand the table to the travel engine (2026-08-24) ──
    // worldEffects.openTravel = { hexName?, note? } — pull the table to the hex
    // map, open the Travel Console on EVERY client, name the destination. The
    // ride itself (legs, encounters, weather) is the travel engine's business;
    // the PLAYER drives the console (encounter arbitration relays to the GM by
    // design) and arrival fires via campaign.hexOverrides[hexUuid].onEnterBeatId.
    // ctx.skipOpenTravel: executeBeat applies this op EARLY (a stage direction
    // arrives with the dialog, not behind it) and tells the tail not to repeat.
    let alreadyHere = false;
    if (we.openTravel && typeof we.openTravel === "object" && !ctx.skipOpenTravel) {
      try {
        const dest = String(we.openTravel.hexName || "").trim();
        const note = String(we.openTravel.note || "").trim();
        // Already standing on the destination (2026-09-09)? Don't ask the table
        // to ride there — arrive (per-act on-enter list) and say so.
        try {
          const trav = game.bbttcc?.api?.travel;
          const camp = ctx.campaignId ? game.bbttcc?.api?.campaign?.getCampaign?.(ctx.campaignId) : null;
          const fid = String(ctx.factionId || camp?.factionId || (camp?.factionIds || [])[0] || "").replace(/^Actor\./, "");
          const here = (dest && fid && typeof trav?.whereIs === "function") ? trav.whereIs(fid) : null;
          if (here && _normHexName(here.name) === _normHexName(dest)) {
            alreadyHere = true;
            if (typeof trav.arriveAt === "function") await trav.arriveAt(here.hexUuid, { factionId: fid });
            changed = true; notes.push(`openTravel:alreadyHere:${dest}`);
          }
        } catch (eH) { console.warn(TAG, "already-here check failed (opening travel as usual)", eH); }
      if (!alreadyHere) {
        // Prefer the scene that CONTAINS the destination hex (the hex map, e.g.
        // River Heart) — the Travel Console reads hexes off the viewed canvas,
        // so the world-hub overview is a dead end for route planning. Fallback:
        // the flagged world hub.
        const target = _sceneWithHexNamed(dest)
          || game.scenes?.find?.(s => s.getFlag?.("bbttcc-travel", "isWorldHub"))
          || null;
        // Activate, not just view: activation pulls every connected client to
        // the map — the ride is a table moment, and this runs on the GM client
        // which has the permission.
        if (target && game.scenes?.active?.id !== target.id) {
          try { await target.activate(); }
          catch (e) { try { await target.view(); } catch (_e) {} }
        }
        const payload = { dest, note, sceneId: target?.id || "" };
        try { game.socket?.emit?.("module.bbttcc-campaign", { type: "bbttccOpenTravel", payload }); } catch (_e) {}
        await _openTravelOnThisClient(payload); // sockets don't echo to the sender
        changed = true;
        notes.push("openTravel" + (dest ? `:${dest}` : ""));
      }
      } catch (e) {
        console.warn(TAG, "openTravel failed", e);
      }
    }

    if (changed) console.log(TAG, "Applied worldEffects", { beatId: beatCtx.beatId, beatType: beatCtx.beatType, notes: notes });
    else console.log(TAG, "No worldEffects applied (no-ops)", { beatId: beatCtx.beatId });

    return { applied: changed, notes: notes, alreadyHere };
  }

  // ── openTravel client-side plumbing ────────────────────────────────────────
  // Hex names carry NBSP (U+00A0) — collapse all whitespace before matching.
  const _normHexName = (s) => String(s || "").replace(/[\s ]+/g, " ").trim().toLowerCase();

  // The scene whose territory drawings contain a hex with this name — that's
  // the map the Travel Console can actually plan on. Active scene wins ties.
  function _sceneWithHexNamed(name) {
    const want = _normHexName(name);
    if (!want) return null;
    const scenes = Array.from(game.scenes ?? [])
      .sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0));
    for (const sc of scenes) {
      for (const d of (sc.drawings ?? [])) {
        const f = d?.flags?.["bbttcc-territory"];
        if (!f) continue;
        const label = f.name || d.text || "";
        if (label && _normHexName(label) === want) return sc;
      }
    }
    return null;
  }

  // Runs on EVERY client (GM locally, players via socket): land on the hex map
  // and open the Travel Console, pre-aimed at the destination. The console's
  // prefill resolves the start hex from the lead faction's token and auto-plans.
  async function _openTravelOnThisClient({ dest = "", note = "", sceneId = "" } = {}) {
    try {
      const sc = sceneId ? game.scenes?.get?.(sceneId) : null;
      // Activation usually pulls this client already; view() covers a client
      // parked on a non-active scene so the console reads the RIGHT canvas.
      if (sc && canvas?.scene?.id !== sc.id) { try { await sc.view(); } catch (_e) {} }
      // The activation pull may still be DRAWING when this socket lands —
      // canvas.scene already names the new scene but its drawings aren't
      // instantiated, so the console would read zero hexes (empty dropdowns,
      // dead Pick-on-Map — seen live 2026-08-26). Wait for canvasReady.
      if (sc && canvas?.scene?.id === sc.id && !canvas.ready) {
        await new Promise((res) => {
          const t = setTimeout(res, 8000);
          Hooks.once("canvasReady", () => { clearTimeout(t); res(); });
        });
      }
      const tc = get(game, "bbttcc.ui.travelConsole", null);
      if (tc?.render) {
        tc.prefill = dest ? { toName: dest } : null;
        tc.render(true);
      }
      ui.notifications?.info?.(note
        || (dest ? `🐎 Plot the ride to ${dest} — legs and encounters run through the Travel Console.`
                 : "🐎 Plot the ride — legs and encounters run through the Travel Console."));
    } catch (e) { console.warn(TAG, "openTravelOnThisClient failed", e); }
  }

  // Explicit table pull (2026-08-26): Foundry's implicit activation-pull skips
  // clients that were explicitly view()'d onto another scene (the Weather
  // Front stranded the player on the hex map). This is our own reliable pull:
  // every client views the scene, full stop.
  async function _pullSceneOnThisClient({ sceneId = "" } = {}) {
    try {
      const sc = sceneId ? game.scenes?.get?.(sceneId) : null;
      if (sc && canvas?.scene?.id !== sc.id) await sc.view();
    } catch (e) { console.warn(TAG, "pullSceneOnThisClient failed", e); }
  }

  function pullTableToScene(sceneId) {
    const payload = { sceneId: String(sceneId || "") };
    if (!payload.sceneId) return;
    try { game.socket?.emit?.("module.bbttcc-campaign", { type: "bbttccPullScene", payload }); } catch (_e) {}
    return _pullSceneOnThisClient(payload); // sockets don't echo to the sender
  }

  function _installOpenTravelSocket() {
    try {
      if (globalThis.__bbttccOpenTravelSocketBound) return;
      const sock = game?.socket;
      if (!sock?.on) return;
      globalThis.__bbttccOpenTravelSocketBound = true;
      sock.on("module.bbttcc-campaign", (msg) => {
        if (!msg) return;
        if (msg.type === "bbttccOpenTravel") return _openTravelOnThisClient(msg.payload || {});
        if (msg.type === "bbttccPullScene") return _pullSceneOnThisClient(msg.payload || {});
      });
    } catch (_e) {}
  }

  function installWorldMutationAPI() {
    try {
      ensureNS();
      ensureFactionAPI();
      game.bbttcc.api.worldMutation.applyWorldEffects = applyWorldEffects;
      game.bbttcc.api.worldMutation.pullTableToScene = pullTableToScene;
      game.bbttcc.api.worldMutation.sweepExpiredWorldModifiers = sweepExpiredWorldModifiers;
      game.bbttcc.api.worldMutation.applyNamedHexModifiers = (doc, add, remove, opts) => _applyNamedModifiers(doc, add, remove, opts || {});
      if (!globalThis.__bbttccWorldModExpiryHooked) {
        globalThis.__bbttccWorldModExpiryHooked = true;
        Hooks.on("bbttcc:advanceTurn:end", (tctx) => { try { if (!tctx || tctx.apply !== true || !game.user?.isGM) return; sweepExpiredWorldModifiers({}).then(r => { if (r.expired) console.log(TAG, "world modifiers expired:", r.expired); }).catch(() => {}); } catch (_e) {} });
      }
      installOpScheduleAPI();
      installOpScheduleTickHook();
      _installOpenTravelSocket();
      try { game.bbttcc.api.opSchedules?.repairAll?.().catch(()=>{}); } catch(_e) {}
      console.log(TAG, "World Mutation API ready:", Object.keys(game.bbttcc.api.worldMutation));
    } catch (e) {
      console.warn(TAG, "installWorldMutationAPI failed:", e);
    }
  }

  Hooks.once("ready", installWorldMutationAPI);
  try { if (game && game.ready) installWorldMutationAPI(); } catch (e) {}
})();

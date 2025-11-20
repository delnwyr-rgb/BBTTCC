/* modules/bbttcc-territory/scripts/api.turn.processRequests.js
 * BBTTCC — Request Processors (Repairs + Cleanse Corruption)
 * - Publishes game.bbttcc.api.turn.processRequests({ factionId, apply=true })
 * - Applies queued requests written by compat consumeQueuedTurnEffects and strategic effects
 * - Writes War Log entries for visibility
 *
 * Safe to load in bbttcc-territory. Foundry v13.348 / dnd5e 5.1.9
 */
(() => {
  const MOD_FACTIONS  = "bbttcc-factions";
  const MOD_TERRITORY = "bbttcc-territory";
  const TAG = "[bbttcc-turn/requests]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  const copy = (o)=>foundry.utils.duplicate(o || {});
  const nowISO = () => { try { return new Date().toLocaleString(); } catch { return "";} };

  function ensureNS(){
    game.bbttcc ??= { api:{} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.turn ??= {};
  }

  async function pushWarLog(actor, entry){
    try {
      const flags = copy(actor.flags?.[MOD_FACTIONS] ?? {});
      const wl = Array.isArray(flags.warLogs) ? flags.warLogs.slice() : [];
      wl.push({ ts: Date.now(), date: nowISO(), ...entry });
      await actor.update({ [`flags.${MOD_FACTIONS}.warLogs`]: wl });
    } catch (e) { warn("pushWarLog failed", e); }
  }

  async function fromAnyUuid(idOrUuid){
    if (!idOrUuid) return null;
    if (typeof idOrUuid === "string" && idOrUuid.startsWith("Scene.")) {
      try { return await fromUuid(idOrUuid); } catch { return null; }
    }
    if (typeof idOrUuid === "string" && idOrUuid.startsWith("Actor.")) {
      try { return await fromUuid(idOrUuid); } catch { return null; }
    }
    // Try Drawing id on current scene
    const d = canvas.drawings?.get(idOrUuid) || canvas.scene?.drawings?.get(idOrUuid);
    return d?.document || null;
  }

  function removeModifier(hflags, modName){
    const mods = Array.isArray(hflags?.modifiers) ? hflags.modifiers.slice() : [];
    const idx = mods.findIndex(s => String(s).toLowerCase() === String(modName).toLowerCase());
    if (idx >= 0) {
      mods.splice(idx, 1);
      hflags.modifiers = mods;
      return true;
    }
    return false;
  }

  async function processRepairs(A, FFlags){
    const req = FFlags?.requests?.repairs;
    if (!req?.requests || !Array.isArray(req.requests) || !req.requests.length) return { count:0 };
    let done = 0;

    const newFF = copy(FFlags);
    const remaining = [];

    for (const r of req.requests) {
      const target = r?.target || r?.hexId || null;
      const tag    = r?.tag || "Damaged Infrastructure";
      const doc = await fromAnyUuid(target);
      if (!doc) { remaining.push(r); continue; }

      const H = copy(doc.flags?.[MOD_TERRITORY] ?? {});
      const changed = removeModifier(H, tag);
      if (changed) {
        await doc.update({ [`flags.${MOD_TERRITORY}`]: H });
        await pushWarLog(A, { type:"turn", activity:"repairs", summary:`Removed '${tag}' on ${doc.name ?? "hex"}.` });
        done += 1;
      } else {
        // Already absent; treat as processed
        done += 1;
      }
    }

    // write back remaining
    newFF.requests = newFF.requests || {};
    newFF.requests.repairs = { ...(newFF.requests.repairs||{}), requests: remaining };
    await game.actors.get(A.id)?.update({ [`flags.${MOD_FACTIONS}`]: newFF });
    return { count: done };
  }

  async function processHexRequests(A){
    // Iterate every drawing with territory flags (fast enough for MVP)
    const updates = [];
    let changed = 0;

    for (const p of (canvas.drawings?.placeables || [])) {
      const doc = p.document;
      const H = copy(doc.flags?.[MOD_TERRITORY] ?? {});
      const req = H.requests || {};
      if (!Object.keys(req).length) continue;

      const mods = copy(H.mods || {});
      let did = false;

      if (req.cleanseCorruption) {
        // Reduce local darkness (create if not present), +1 loyalty
        mods.darkness = Math.max(0, Number(mods.darkness||0) - 2);
        mods.loyalty  = Number(mods.loyalty||0) + 1;
        delete req.cleanseCorruption;
        did = true;
        await pushWarLog(A, { type:"turn", activity:"cleanse_corruption", summary:`Cleansed corruption on ${doc.name ?? "hex"} (Darkness −2, Loyalty +1).` });
      }

      // statusSet request -> set H.status
      if (req.statusSet) {
        H.status = req.statusSet;
        delete req.statusSet;
        did = true;
        await pushWarLog(A, { type:"turn", activity:"status_set", summary:`Set status to '${H.status}' on ${doc.name ?? "hex"}.` });
      }

      // destroyHex -> mark a flag; actual deletion can be a GM step
      if (req.destroyHex) {
        H.destroyed = true;
        delete req.destroyHex;
        did = true;
        await pushWarLog(A, { type:"turn", activity:"destroy_hex", summary:`Marked ${doc.name ?? "hex"} as destroyed.` });
      }

      if (did) {
        H.mods = mods;
        H.requests = req;
        updates.push(doc.update({ [`flags.${MOD_TERRITORY}`]: H }));
        changed += 1;
      }
    }

    if (updates.length) await Promise.all(updates);
    return { count: changed };
  }

  async function processRequests({ factionId, apply=true } = {}){
    if (!apply) return { ok:true, changed:false, note:"dry run disabled in processor" };
    const A = game.actors.get(factionId) || game.actors.get(String(factionId).replace(/^Actor\./,""));
    if (!A) throw new Error("processRequests: faction not found");

    const FFlags = copy(A.flags?.[MOD_FACTIONS] ?? {});

    const r1 = await processRepairs(A, FFlags);
    const r2 = await processHexRequests(A);

    const total = (r1.count||0) + (r2.count||0);
    if (total === 0) {
      await pushWarLog(A, { type:"turn", activity:"process_requests", summary:"No queued requests to process." });
      return { ok:true, changed:false, count:0 };
    }
    await pushWarLog(A, { type:"turn", activity:"process_requests", summary:`Processed ${total} queued request(s).` });
    return { ok:true, changed:true, count: total, details: { repairs: r1.count, hex: r2.count } };
  }

  function publish(){
    ensureNS();
    game.bbttcc.api.turn.processRequests = processRequests;
    log("Published api.turn.processRequests");
  }

  if (globalThis?.Hooks?.once) Hooks.once("ready", publish);
  try { if (globalThis?.game?.ready === true) publish(); } catch {}
})();
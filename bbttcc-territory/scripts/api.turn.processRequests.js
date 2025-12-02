/* modules/bbttcc-territory/scripts/api.turn.processRequests.js
 * BBTTCC — Request Processors (Repairs + Hex Requests)
 * - Publishes game.bbttcc.api.turn.processRequests({ factionId?, apply=true })
 * - Applies queued requests written by compat consumeQueuedTurnEffects and strategic effects
 * - Writes War Log entries for visibility
 *
 * Modes:
 *   - Per-faction: processRequests({ factionId, apply:true })
 *   - Global:      processRequests({ apply:true })  -> all factions + all hexes
 */

(() => {
  const MOD_FACTIONS  = "bbttcc-factions";
  const MOD_TERRITORY = "bbttcc-territory";
  const TAG = "[bbttcc-turn/requests]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  const copy = (o)=>foundry.utils.duplicate(o || {});
  const nowISO = () => { try { return new Date().toLocaleString(); } catch { return ""; } };

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
    } catch (e) {
      warn("pushWarLog failed", e);
    }
  }

  async function fromAnyUuid(idOrUuid){
    if (!idOrUuid) return null;
    if (typeof idOrUuid === "string" && (idOrUuid.startsWith("Scene.") || idOrUuid.startsWith("Actor."))) {
      try { return await fromUuid(idOrUuid); } catch { return null; }
    }
    const d = canvas.drawings?.get(idOrUuid) || canvas.scene?.drawings?.get(idOrUuid);
    return d?.document || null;
  }

  function removeModifierArray(modifiers, modName){
    const mods = Array.isArray(modifiers) ? modifiers.slice() : [];
    const i = mods.findIndex(m => String(m).toLowerCase() === String(modName).toLowerCase());
    if (i >= 0) {
      mods.splice(i, 1);
      return { changed:true, mods };
    }
    return { changed:false, mods };
  }

  // ---------------------------------------------------------------------------
  // Faction-level repairs (stored on faction flags)
  // ---------------------------------------------------------------------------
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

      const modsCurrent = await doc.getFlag(MOD_TERRITORY, "modifiers");
      const { changed, mods } = removeModifierArray(modsCurrent, tag);

      if (changed) {
        await doc.setFlag(MOD_TERRITORY, "modifiers", mods);
        await pushWarLog(A, {
          type: "turn",
          activity: "repairs",
          summary: `Removed '${tag}' on ${doc.name ?? "hex"}.`
        });
      }
      done += 1;
    }

    newFF.requests = newFF.requests || {};
    newFF.requests.repairs = { ...(newFF.requests.repairs||{}), requests: remaining };
    await game.actors.get(A.id)?.update({ [`flags.${MOD_FACTIONS}`]: newFF });

    return { count: done };
  }

  // ---------------------------------------------------------------------------
  // Hex-level requests — GLOBAL pass
  // ---------------------------------------------------------------------------
  async function processHexRequestsGlobal(){
    const factionsById = new Map(
      (game.actors?.contents ?? [])
        .filter(a => a.flags?.[MOD_FACTIONS])
        .map(a => [a.id, a])
    );

    let changed = 0;

    for (const scene of game.scenes ?? []) {
      const drawings = scene.drawings?.contents ?? scene.drawings ?? [];
      for (const doc of drawings) {
        const tf = doc.flags?.[MOD_TERRITORY];
        if (!tf) continue;

        const ownerId = tf.factionId || tf.ownerId || null;
        const owner   = ownerId ? factionsById.get(ownerId) : null;

        const requests = await doc.getFlag(MOD_TERRITORY, "requests") || {};
        const reqKeys  = Object.keys(requests);
        if (!reqKeys.length) continue;

        // DEBUG: log any hex that actually has requests
        log("HEX REQUESTS: found pending requests on hex", {
          scene: scene.name,
          uuid: doc.uuid,
          name: doc.name,
          ownerId,
          requests: copy(requests)
        });

        let mods      = await doc.getFlag(MOD_TERRITORY, "mods")      || {};
        let modifiers = await doc.getFlag(MOD_TERRITORY, "modifiers") || [];

        let didSomething = false;

        // --- Cleanse Corruption ---------------------------------------------
        if (requests.cleanseCorruption) {
          mods.darkness = Math.max(0, Number(mods.darkness||0) - 2);
          mods.loyalty  = Number(mods.loyalty||0) + 1;
          delete requests.cleanseCorruption;
          didSomething = true;

          log("HEX REQUESTS: applied cleanseCorruption", {
            uuid: doc.uuid,
            name: doc.name,
            newMods: copy(mods),
            remainingRequests: copy(requests)
          });

          if (owner) {
            await pushWarLog(owner, {
              type: "turn",
              activity: "cleanse_corruption",
              summary: `Cleansed corruption on ${doc.name ?? "hex"} (Darkness −2, Loyalty +1).`
            });
          }
        }

        // --- Clear Rockslide / reopen pass ----------------------------------
        if (requests.clearRockslide) {
          let removedBits = [];

          let res = removeModifierArray(modifiers, "Difficult Terrain");
          if (res.changed) { modifiers = res.mods; removedBits.push("Difficult Terrain"); }

          res = removeModifierArray(modifiers, "Blocked Pass");
          if (res.changed) { modifiers = res.mods; removedBits.push("Blocked Pass"); }

          delete requests.clearRockslide;
          didSomething = true;

          log("HEX REQUESTS: applied clearRockslide", {
            uuid: doc.uuid,
            name: doc.name,
            removedBits,
            newModifiers: modifiers.slice(),
            remainingRequests: copy(requests)
          });

          if (owner) {
            const detailStr = removedBits.length
              ? `Removed ${removedBits.join(" + ")}.`
              : "Cleared queued rockslide request.";
            await pushWarLog(owner, {
              type: "turn",
              activity: "clear_rockslide",
              summary: `Cleared rockslide on ${doc.name ?? "hex"}. ${detailStr}`
            });
          }
        }

        // --- statusSet -------------------------------------------------------
        if (requests.statusSet) {
          const newStatus = requests.statusSet;
          delete requests.statusSet;
          didSomething = true;

          await doc.setFlag(MOD_TERRITORY, "status", newStatus);

          log("HEX REQUESTS: applied statusSet", {
            uuid: doc.uuid,
            name: doc.name,
            newStatus,
            remainingRequests: copy(requests)
          });

          if (owner) {
            await pushWarLog(owner, {
              type: "turn",
              activity: "status_set",
              summary: `Set status to '${newStatus}' on ${doc.name ?? "hex"}.`
            });
          }
        }

        // --- destroyHex ------------------------------------------------------
        if (requests.destroyHex) {
          delete requests.destroyHex;
          didSomething = true;

          await doc.setFlag(MOD_TERRITORY, "destroyed", true);

          log("HEX REQUESTS: applied destroyHex", {
            uuid: doc.uuid,
            name: doc.name,
            remainingRequests: copy(requests)
          });

          if (owner) {
            await pushWarLog(owner, {
              type: "turn",
              activity: "destroy_hex",
              summary: `Marked ${doc.name ?? "hex"} as destroyed.`
            });
          }
        }

        if (didSomething) {
          // write back requests, mods, modifiers via setFlag
          await doc.setFlag(MOD_TERRITORY, "requests",  requests);
          await doc.setFlag(MOD_TERRITORY, "mods",      mods);
          await doc.setFlag(MOD_TERRITORY, "modifiers", modifiers);
          changed += 1;

          log("HEX REQUESTS: final writeback for hex", {
            uuid: doc.uuid,
            name: doc.name,
            finalRequests: copy(requests),
            finalMods: copy(mods),
            finalModifiers: modifiers.slice()
          });
        }
      }
    }

    log("HEX REQUESTS: global processing complete", { changed });
    return { count: changed };
  }

  // ---------------------------------------------------------------------------
  // Public API: processRequests
  // ---------------------------------------------------------------------------
  async function processRequests({ factionId, apply=true } = {}){
    if (!apply) {
      return { ok:true, changed:false, note:"dry run disabled in processor" };
    }

    // --- Per-faction mode (repairs only, for now) ---------------------------
    if (factionId) {
      const A = game.actors.get(factionId) || game.actors.get(String(factionId).replace(/^Actor\./,""));
      if (!A) throw new Error("processRequests: faction not found");

      const FFlags = copy(A.flags?.[MOD_FACTIONS] ?? {});
      const r1 = await processRepairs(A, FFlags);
      const r2 = { count:0 };

      const total = (r1.count||0) + (r2.count||0);
      if (total === 0) {
        await pushWarLog(A, {
          type: "turn",
          activity: "process_requests",
          summary: "No queued requests to process."
        });
        return { ok:true, changed:false, count:0 };
      }

      await pushWarLog(A, {
        type: "turn",
          activity: "process_requests",
          summary: `Processed ${total} queued request(s).`
      });
      return {
        ok: true,
        changed: true,
        count: total,
        details: { repairs: r1.count, hex: r2.count }
      };
    }

    // --- Global mode: no factionId provided --------------------------------
    const factions = game.actors.filter(a => a.flags?.[MOD_FACTIONS]);
    const perFaction = [];
    let grandTotal = 0;

    // First, per-faction repairs
    for (const A of factions) {
      const FFlags = copy(A.flags?.[MOD_FACTIONS] ?? {});
      const r1 = await processRepairs(A, FFlags);
      const total = (r1.count||0);
      grandTotal += total;

      if (total === 0) {
        await pushWarLog(A, {
          type: "turn",
          activity: "process_requests",
          summary: "No queued repair requests to process."
        });
      } else {
        await pushWarLog(A, {
          type: "turn",
          activity: "process_requests",
          summary: `Processed ${total} queued repair request(s).`
        });
      }

      perFaction.push({
        factionId: A.id,
        count: total,
        details: { repairs: r1.count, hex: 0 }
      });
    }

    // Then, one global sweep for hex requests
    const hexResult = await processHexRequestsGlobal();
    grandTotal += hexResult.count;

    return {
      ok: true,
      changed: grandTotal > 0,
      count: grandTotal,
      perFaction,
      hexRequestsProcessed: hexResult.count
    };
  }

  function publish(){
    ensureNS();
    game.bbttcc.api.turn.processRequests = processRequests;
    log("Published api.turn.processRequests (with HEX REQUESTS debug instrumentation)");
  }

  if (globalThis?.Hooks?.once) Hooks.once("ready", publish);
  try { if (globalThis?.game?.ready === true) publish(); } catch {}
})();

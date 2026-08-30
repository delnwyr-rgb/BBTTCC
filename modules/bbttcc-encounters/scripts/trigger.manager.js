// bbttcc-encounters/scripts/trigger.manager.js
//
// FULL REPLACEMENT — 2026-02-25
//
// Purpose:
// - Listen for Hooks.callAll("bbttcc:afterTravel", ctx)
// - Enforce GM-only arbitration (launch/decline/reroll) via ctx.encounterPolicy
// - Prefer Campaign-authored encounter Beats when ctx.encounter.beatId is present
// - Fallback to legacy Encounter→Scenario registry only when no beatId exists
//
// Notes:
// - Canonical Campaign runner is runBeat(campaignId, beatId).
// - Some builds may accept an extra ctx param; we avoid relying on that.
// - We thread ctx through via a best-effort transient stash:
//     game.bbttcc.api.campaign._lastEncounterCtx
//
// Legacy retirement:
// - This file keeps a minimal fallback to encounters.launchFromEncounterCtx.
//   Once all travel encounters are campaign-authored, you can remove that fallback.

(() => {
  const TAG = "[bbttcc-encounters/triggers]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function getEncountersAPI() {
    return game.bbttcc?.api?.encounters || null;
  }

  function getCampaignAPI() {
    return game.bbttcc?.api?.campaign || game.bbttcc?.api?.campaigns || null;
  }

  function normalizePolicy(p) {
    p = String(p || "").trim().toLowerCase();
    if (!p) return "auto";
    if (p === "prompt" || p === "ask") return "prompt";
    if (p === "skip" || p === "decline" || p === "none") return "skip";
    return "auto";
  }

  function clampTier(t) {
    const n = Number(t ?? 1);
    return Number.isFinite(n) ? Math.max(1, Math.min(4, Math.floor(n))) : 1;
  }

  function _normKey(v, fallback) {
    const s = String(v || "").trim().toLowerCase();
    return s || (fallback ? String(fallback).trim().toLowerCase() : "");
  }

  function _safeGetEncounterTablesSetting() {
    try { return game.settings.get("bbttcc-campaign", "encounterTables") || {}; }
    catch (_e) { return {}; }
  }

  function _parseConditions(raw) {
    if (!raw) return null;
    if (typeof raw === "object") return raw;
    if (typeof raw !== "string") return null;
    const s = raw.trim();
    if (!s) return null;
    try { return JSON.parse(s); } catch (_e) { return null; }
  }

  function _passesTravelConditions(ent, { terrainKey }) {
    const cond = _parseConditions(ent?.conditions) || ent?.conditions || null;
    if (!cond) return true;

    // Supported: conditions.terrains (array) or conditions.terrain (single)
    const terr = _normKey(terrainKey, "");
    if (Array.isArray(cond.terrains) && cond.terrains.length) {
      const ok = cond.terrains.map(t => _normKey(t, "")).includes(terr);
      if (!ok) return false;
    }
    if (cond.terrain) {
      if (_normKey(cond.terrain, "") !== terr) return false;
    }

    return true;
  }

  function _weightedPick(entries) {
    const list = Array.isArray(entries) ? entries : [];
    let total = 0;
    const w = list.map(ent => {
      const ww = Number(ent?.weight);
      const val = (Number.isFinite(ww) && ww > 0) ? ww : 1;
      total += val;
      return val;
    });
    if (!list.length || total <= 0) return null;

    let r = Math.random() * total;
    for (let i = 0; i < list.length; i++) {
      r -= w[i];
      if (r <= 0) return list[i];
    }
    return list[list.length - 1] || null;
  }

  function _resolveTravelTableId({ terrainKey, tier, preferredTableId }) {
    const t = clampTier(tier);
    const terr = _normKey(terrainKey, "generic");
    const primary = `travel_${terr}_t${t}`;
    const generic = `travel_generic_t${t}`;
    const tables = _safeGetEncounterTablesSetting();

    if (preferredTableId && tables[preferredTableId]) return preferredTableId;
    if (tables[primary]) return primary;
    if (tables[generic]) return generic;

    // best-effort fallback: return preferred if provided, else the primary name
    return preferredTableId || primary;
  }

  // Roll-only travel table pick for GM reroll
  function pickEncounterFromCampaignTables({ activeCampaignId, terrainKey, tier, preferredTableId }) {
    const tableId = _resolveTravelTableId({ terrainKey, tier, preferredTableId });
    const tables = _safeGetEncounterTablesSetting();
    const table = tables ? tables[tableId] : null;
    if (!table) return { ok:false, reason:"table_not_found", tableId };

    const entries = Array.isArray(table.entries) ? table.entries : [];
    const eligible = entries.filter(ent => _passesTravelConditions(ent, { terrainKey }));
    if (!eligible.length) return { ok:false, reason:"no_entries", tableId };

    const pick = _weightedPick(eligible);
    if (!pick) return { ok:false, reason:"roll_failed", tableId };

    const campaignId = String(pick.campaignId || activeCampaignId || "").trim() || null;
    const beatId = String(pick.beatId || "").trim() || null;
    if (!campaignId || !beatId) return { ok:false, reason:"bad_entry", tableId };

    const encounterKey = String(beatId).startsWith("enc_") ? String(beatId).slice(4) : beatId;
    return { ok:true, tableId, campaignId, beatId, encounterKey };
  }

  function buildStepCtx(ctx) {
    const enc = ctx?.encounter || {};
    const meta = enc?.meta || enc?.result?.meta || {};
    const stepCtx = meta.stepCtx || ctx?.stepCtx || ctx?.context || {};
    return (stepCtx && typeof stepCtx === "object") ? stepCtx : {};
  }

  // ---------------------------------------------------------------------------
  // Dedupe (prevents double launch if both wrapper + console emit afterTravel)
  // ---------------------------------------------------------------------------

  const _recent = new Map();
  function _dkey(ctx) {
    const enc = ctx?.encounter || {};
    const hexUuid = ctx?.to?.uuid || ctx?.to?.hexUuid || ctx?.hexUuid || "";
    const campaignId = String(enc.campaignId || "").trim();
    const beatId = String(enc.beatId || "").trim();
    const key = String(enc.key || enc.result?.key || "").trim();
    const tier = String(enc.tier || enc.result?.tier || "");
    return [campaignId, beatId, key, tier, hexUuid].join("|");
  }
  function _seen(k, ms=5000) {
    const now = Date.now();
    const prev = _recent.get(k) || 0;
    if (prev && (now - prev) < ms) return true;
    _recent.set(k, now);
    for (const [kk, tt] of _recent.entries()) {
      if ((now - tt) > 20000) _recent.delete(kk);
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // GM prompt
  // ---------------------------------------------------------------------------

  async function promptGM(encKey, ctx) {
    return new Promise((resolve) => {
      const enc = ctx?.encounter || {};
      const label = enc?.label || enc?.result?.label || encKey || "Encounter";
      const tier  = clampTier(enc?.tier ?? enc?.result?.tier ?? 1);

      const content = `
        <div style="font:13px Helvetica; line-height:1.35;">
          <div style="margin-bottom:.35rem;">
            <b>${foundry.utils.escapeHTML(String(label))}</b>
            <span style="opacity:.75;">(Tier ${tier})</span>
          </div>
          <div style="opacity:.9;">
            A travel encounter was triggered. Launch it, decline it, or reroll it.
          </div>
        </div>`;

      const d = new Dialog({
        title: "Travel Encounter",
        content,
        buttons: {
          launch: { label: "Launch", callback: () => resolve({ action:"launch", ctx }) },
          decline:{ label: "Decline", callback: () => resolve({ action:"decline", ctx }) },
          reroll: { label: "Reroll", callback: () => resolve({ action:"reroll", ctx }) }
        },
        default: "launch",
        close: () => resolve({ action:"decline", ctx })
      });
      d.render(true);
    });
  }

  // ---------------------------------------------------------------------------
  // SETTLEMENT (Settlement Refactor, 2026-08-28). `await runBeat(...)` returns
  // only after the ENTIRE beat chain — every choice dialog, nested beat,
  // verdict hub, and in-chain retry — has resolved. Completion is therefore a
  // DECLARED fact, not something to infer from open windows: no title
  // matching, no dialog polling. The one legitimate wait left is table
  // combat: on (end)-door families the fight starts AFTER the menu closes, so
  // we grant a short grace for initiative to be rolled, then hold while a
  // combat is started — and say so out loud rather than waiting silently.
  // ---------------------------------------------------------------------------

  async function settleEncounter(ctx) {
    try {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      // Only THIS TABLE's fight blocks settlement: a started combat on the
      // scene we're standing on (or an unassigned/global one). A stale
      // tracker left started on some OTHER battlemap must not hold the road
      // (owner hit it: parley success blocked by an old fight's combat).
      const blockingCombats = () => {
        try {
          const curId = canvas?.scene?.id || null;
          return (game.combats?.contents || []).filter(c =>
            c?.started && (!c.scene || !curId || c.scene.id === curId));
        } catch (_e) { return []; }
      };
      const combatOn = () => blockingCombats().length > 0;

      // Grace: give an (end)-door fight a moment to reach the tracker.
      const graceEnd = Date.now() + 6000;
      while (Date.now() < graceEnd && !combatOn()) await sleep(500);

      if (combatOn()) {
        // Persistent, named notice — a toast fades before anyone reads it.
        try {
          const names = blockingCombats()
            .map(c => c.scene?.name || "unlinked combat").join(", ");
          await ChatMessage.create({
            content: `<div style="border-left:3px solid #7a8f6b;padding:.3em .6em;">` +
              `<b>🐎 The road waits on the fight.</b> A combat is still running (${foundry.utils.escapeHTML(names)}) — ` +
              `<i>End Combat</i> in the tracker and the ride moves on by itself.</div>`,
            speaker: { alias: "Mal" }
          });
        } catch (_eN) {}
        ui.notifications?.info?.("🐎 The road waits on the fight — End Combat to move on.");
        const hardStop = Date.now() + 2700000; // 45 min
        while (Date.now() < hardStop && combatOn()) await sleep(2000);
        if (combatOn()) {
          log("settle: combat still running at hard stop — deferring; GM finishes manually");
          return;
        }
      }

      // Resolve the return target: explicit ctx override, else the parent
      // scene of the destination hex drawing (the strategic/travel map).
      const retId = ctx?.returnSceneUuid || ctx?.returnToSceneUuid;
      let target = null;
      if (retId) {
        const sceneId = (typeof retId === "string" && retId.startsWith("Scene."))
          ? (retId.split(".")[1] || retId)
          : retId;
        target = game.scenes?.get?.(sceneId) || null;
      }
      if (!target) {
        const hexDoc = ctx?.to?.obj ?? ctx?.to?.document ?? ctx?.to ?? null;
        const parent = hexDoc?.parent;
        if (parent?.activate) target = parent;
      }
      if (!target) {
        log("settle: no target scene resolved; stamping settlement without a return");
        _announceSettled(ctx);
        return;
      }

      // Even when the chain never left the travel map (macro hazards with no
      // battlemap), the ride-on nudge below must still land. Only the
      // ACTIVATION is conditional.
      if (canvas?.scene?.id !== target.id) {
        await target.activate();
        // Activation's implicit pull skips clients explicitly view()'d elsewhere
        // (the Weather Front trap, 2026-08-26) — pull the whole table home.
        try { await game.bbttcc?.api?.worldMutation?.pullTableToScene?.(target.id); } catch (_ePull) {}
        log("settle: switched back to travel scene", target.name);
      } else {
        log("settle: already on travel scene — nudge only", target.name);
      }

      // The ride is paused, not dead — say so where everyone can see it.
      // UNLESS an arrival beat is pending for this leg's destination (final
      // leg): api.travel's deferred hex-enter sets _pendingHexEnter while it
      // waits, its arrival dive will speak for itself, and "Execute Route"
      // would be a lie.
      try {
        const pend = game.bbttcc?._pendingHexEnter;
        const arrivalPending = !!(pend && (Date.now() - Number(pend.ts || 0)) < 50 * 60 * 1000);
        if (arrivalPending) {
          log("settle: arrival beat pending — suppressing the ride-on nudge", pend);
        } else {
          const enc = ctx?.encounter || {};
          const encLabel = enc.label || enc.result?.label || enc.key || "The encounter";
          await ChatMessage.create({
            content: `<div style="border-left:3px solid #7a8f6b;padding:.3em .6em;">` +
              `<b>🐎 Back on the road.</b> ${foundry.utils.escapeHTML(String(encLabel))} is settled — ` +
              `the remaining legs are waiting in the Travel Console. <i>Execute Route</i> to ride on.</div>`,
            speaker: { alias: "Mal" }
          });
        }
      } catch (_eMsg) {}

      _announceSettled(ctx);
    } catch (e) {
      warn("settle: failed (non-blocking)", e);
    }
  }

  // The declared completion signal: stamp + hook + socket relay (on
  // player-driven rides the arrival timer runs on the driving player's
  // client; encounters has no socket flag, so ride the bbttcc-campaign
  // channel — its handler dispatches per-type and passes foreign types).
  function _announceSettled(ctx) {
    try {
      const ts = Date.now();
      game.bbttcc = game.bbttcc || {};
      game.bbttcc._encounterChainSettledTs = ts;
      Hooks.callAll("bbttcc:encounterChainSettled", ctx);
      try { game.socket?.emit?.("module.bbttcc-campaign", { t: "bbttccEncounterChainSettled", ts }); } catch (_eSock) {}
    } catch (_eSig) {}
  }

  // ---------------------------------------------------------------------------
  // Launching
  // ---------------------------------------------------------------------------

  async function launchViaCampaignBeat(campaignApi, campaignId, beatId, ctx) {
    // Canonical runner is runBeat(campaignId, beatId)
    // We also stash ctx for consumers who want richer context.
    try { campaignApi._lastEncounterCtx = ctx; } catch (_e) {}
    try { game.bbttcc.api.campaign._lastEncounterCtx = ctx; } catch (_e2) {}

    const runBeat =
      (campaignApi && typeof campaignApi.runBeat === "function") ? campaignApi.runBeat :
      (campaignApi && typeof campaignApi.run === "function") ? campaignApi.run :
      null;

    if (typeof runBeat !== "function") return { ok:false, why:"campaign runBeat not available" };

    // Settlement Refactor (2026-08-28): seed the chain's identity directly
    // into runBeat's ctx — SLIM on purpose (no to/from hex refs, which would
    // arm scene auto-returns inside the chain). The campaign engine threads
    // `__chain` + participants through every choice hop from here.
    const chainCtx = {
      __chain: {
        id: `travel:${String(ctx?.encounter?.beatId || beatId)}:${Date.now()}`,
        source: "travel-encounter",
        beatId,
        encounter: {
          beatId: ctx?.encounter?.beatId || beatId,
          key: ctx?.encounter?.key || ctx?.encounter?.result?.key || null,
          label: ctx?.encounter?.label || null,
          tier: ctx?.encounter?.tier ?? null,
          campaignId
        }
      },
      factionId: ctx?.factionId ?? ctx?.actor?.id ?? null,
      actor: ctx?.actor ?? null,
      joiningFactionIds: Array.isArray(ctx?.joiningFactionIds) ? ctx.joiningFactionIds.slice() : [],
      participantFactionIds: Array.isArray(ctx?.participantFactionIds) ? ctx.participantFactionIds.slice() : []
    };

    // Declare LAUNCH too (refactor addendum 2026-08-29): the arrival's only
    // remaining fallback lane exists for encounters that never launch a beat.
    // Without this stamp that lane had to GUESS — and its 120s quiet check
    // fired in the ~300ms gap between a collapse beat closing and the retry
    // menu rendering, diving the table to the destination mid-parley (owner
    // hit it on the T3 predator). Launched = declared fact; the fallback now
    // only serves genuinely beatless/declined encounters.
    try {
      const ts = Date.now();
      game.bbttcc = game.bbttcc || {};
      game.bbttcc._encounterChainLaunchedTs = ts;
      try { game.socket?.emit?.("module.bbttcc-campaign", { t: "bbttccEncounterChainLaunched", ts }); } catch (_eLS) {}
    } catch (_eL) {}

    try {
      await runBeat.call(campaignApi, campaignId, beatId, chainCtx);
      return { ok:true };
    } catch (e) {
      warn("campaign.runBeat failed", { campaignId, beatId, e });
      return { ok:false, why:String(e?.message || e) };
    }
  }

  async function handleEncounter(ctx) {
    const enc = ctx?.encounter || {};
    const encKey = enc?.result?.key || enc?.key;

    if (!enc?.triggered || !encKey) return;

    // GM-only arbitration
    if (!game.user?.isGM) return;

    const dk = _dkey(ctx);
    if (dk && _seen(dk, 4000)) {
      log("afterTravel: dedupe skip", dk);
      return;
    }

    const encountersApi = getEncountersAPI();
    const campaignApi = getCampaignAPI();

    const canRunBeat = !!(campaignApi && typeof campaignApi.runBeat === "function");
    const canLaunchEncounter = !!(encountersApi && typeof encountersApi.launchFromEncounterCtx === "function");

    if (!canRunBeat && !canLaunchEncounter) {
      warn("afterTravel: no Campaign runBeat or Encounter launcher available");
      return;
    }

    const policy = normalizePolicy(ctx?.encounterPolicy);

    if (policy === "skip") {
      ui.notifications?.info?.(`Encounter declined: ${enc.label || encKey}`);
      log("Encounter declined by policy=skip", encKey, ctx);
      return;
    }

    // GM prompt (Launch/Decline/Reroll)
    if (policy === "prompt") {
      const choice = await promptGM(encKey, ctx);

      if (choice?.action === "decline") {
        ui.notifications?.info?.(`Encounter declined: ${enc.label || encKey}`);
        log("Encounter declined via GM prompt", encKey, ctx);
        return;
      }

      if (choice?.action === "reroll") {
        const tier = clampTier(enc?.tier ?? enc?.result?.tier ?? 1);
        const stepCtx = buildStepCtx(ctx);
        const activeCampaignId = String(
          game.bbttcc?.api?.campaign?.getActiveCampaignId?.() ||
          ctx?.encounter?.campaignId ||
          ""
        ).trim() || null;

        const terrainKey = String(
          ctx?.encounter?.meta?.terrainKey ||
          stepCtx?.terrain ||
          stepCtx?.terrainKey ||
          ctx?.context?.terrainKey ||
          "generic"
        );

        const preferredTableId = String(ctx?.encounter?.meta?.tableId || "").trim() || null;

        if (!activeCampaignId) {
          ui.notifications?.warn?.("Reroll unavailable (no active campaign).");
          return;
        }

        const picked = pickEncounterFromCampaignTables({ activeCampaignId, terrainKey, tier, preferredTableId });
        if (picked?.ok) {
          ctx.encounter = {
            triggered: true,
            tier,
            key: picked.encounterKey,
            beatId: picked.beatId,
            campaignId: picked.campaignId,
            label: ctx?.encounter?.label || picked.encounterKey,
            meta: { ...(ctx?.encounter?.meta || {}), tableId: picked.tableId, terrainKey: _normKey(terrainKey, "generic") },
            result: { key: picked.encounterKey, label: (ctx?.encounter?.label || picked.encounterKey), tier }
          };
          log("Encounter rerolled (campaign tables) →", ctx.encounter);
        } else {
          ui.notifications?.warn?.("Reroll produced no result; leaving original encounter.");
        }
      }

      // fallthrough to launch
    }

    // -----------------------------------------------------------------------
    // Preferred path: Campaign-authored Beat
    // -----------------------------------------------------------------------
    const beatId = String(ctx?.encounter?.beatId || "").trim();
    const campaignId = String(
      ctx?.encounter?.campaignId ||
      game.bbttcc?.api?.campaign?.getActiveCampaignId?.() ||
      ""
    ).trim();

    if (canRunBeat && beatId && campaignId) {
      log("afterTravel: launching encounter via campaign.runBeat", { campaignId, beatId, encKey });

      // Cinematic dive: stash a one-shot dive request so the encounter beat's scene
      // launch zoom-dives to the encounter hex on the map, then into the beat scene
      // (GM-solo view, with a "⇪ pull table" on the far side). executeBeat consumes
      // it. When this is active we DON'T auto-return — the GM owns navigation via
      // the back / pull-table buttons (the missing "pre-launch" feature).
      const txn = game.bbttcc?.api?.transition;
      let dived = false;
      try {
        if (txn?.requestDive) {
          const to = ctx?.to;
          const place = to?.object || to;
          const center = place?.center;
          const tdoc = to?.document || to;
          const w = Number(tdoc?.shape?.width || tdoc?.width || 0);
          const h = Number(tdoc?.shape?.height || tdoc?.height || 0);
          const focus = (center && Number.isFinite(center.x))
            ? { x: center.x, y: center.y }
            : { x: Number(tdoc?.x || 0) + w / 2, y: Number(tdoc?.y || 0) + h / 2 };
          const hexUuid = tdoc?.uuid || to?.uuid || ctx?.hexUuid || null;
          txn.requestDive({
            // "activate": a road encounter is a TABLE moment — the storm takes
            // everybody (owner ruling 2026-08-26; was "view" = GM-solo preview).
            hexUuid, focus, audience: "activate",
            label: enc?.label || encKey || undefined,
            originUuid: canvas?.scene?.uuid || null
          });
          dived = true;
        }
      } catch (_eDive) { /* non-fatal: beat still runs, just plain-activates */ }

      const res = await launchViaCampaignBeat(campaignApi, campaignId, beatId, ctx);
      if (res?.ok) {
        // Settlement Refactor: the awaited runBeat above IS chain completion —
        // settle immediately (combat is the one wait settleEncounter honors).
        await settleEncounter(ctx);
        return;
      }
      warn("afterTravel: campaign.runBeat failed; falling back (best effort)", res);
      // continue to legacy fallback
    }

    // -----------------------------------------------------------------------
    // Legacy fallback: encounter → scenario registry (path already calls
    // autoReturnToParentScene internally — no extra wiring needed here)
    // -----------------------------------------------------------------------
    if (canLaunchEncounter) {
      warn("afterTravel: using LEGACY encounter scenario launcher (consider removing once travel is fully beat-authored)", encKey);
      await encountersApi.launchFromEncounterCtx(ctx);
      return;
    }

    warn("afterTravel: no valid launch path", { encKey, campaignId, beatId });
  }

  // ---------------------------------------------------------------------------
  // Hook
  // ---------------------------------------------------------------------------

  Hooks.on("bbttcc:afterTravel", async (ctx = {}) => {
    try {
      if (ctx.preview) return;
      await handleEncounter(ctx);
    } catch (err) {
      warn("Error in afterTravel trigger", err);
    }
  });

  Hooks.once("ready", () => {
    // Receive the settled handshake on every client (player-driven rides run
    // their arrival timer on the driving player's seat).
    try {
      game.socket?.on?.("module.bbttcc-campaign", (msg) => {
        const t = msg?.t;
        if (t !== "bbttccEncounterChainSettled" && t !== "bbttccEncounterChainLaunched") return;
        const key = (t === "bbttccEncounterChainSettled") ? "_encounterChainSettledTs" : "_encounterChainLaunchedTs";
        try {
          game.bbttcc = game.bbttcc || {};
          game.bbttcc[key] = Math.max(Number(game.bbttcc[key] || 0), Number(msg.ts) || Date.now());
        } catch (_e) {}
      });
    } catch (_eOn) {}
    log("Trigger manager ready (listening for bbttcc:afterTravel + chainSettled relay)");
  });
})();

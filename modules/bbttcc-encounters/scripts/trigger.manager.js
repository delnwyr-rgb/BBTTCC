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
  // Auto-return to the parent travel scene after the encounter beat (and any
  // chained outcome_trigger beats) resolve. Mirrors scene.launcher.js's
  // autoReturnToParentScene, which is only wired into the legacy scenario
  // path — when travel encounters flow through campaignApi.runBeat() they
  // never hit it, leaving the GM stranded on the encounter scene.
  //
  // Strategy: after runBeat resolves we wait briefly for any chained beat
  // (e.g. outcome_trigger) to start its own dialog, then poll until no
  // Foundry Dialog windows are open. Bounded by timeoutMs to avoid hanging
  // if a dialog stays open for legitimately long encounters.
  // ---------------------------------------------------------------------------

  async function waitForBeatChainIdle(timeoutMs = 90000) {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    // Brief grace period so a chained beat can begin opening its dialog
    // before we observe "idle." Without this we can race a chain start
    // and trigger the return between beat 1 and beat 2.
    await sleep(700);
    const start = Date.now();
    while ((Date.now() - start) < timeoutMs) {
      const wins = Object.values(ui.windows || {});
      const dialogOpen = wins.some(w => {
        const cls = String(w?.constructor?.name || "").toLowerCase();
        if (cls.includes("dialog")) return true;
        const title = String((w && (w.title || w.options?.title)) || "").toLowerCase();
        // Catch Bad Eden scenario / outcome modals too
        return title.includes("encounter") || title.includes("outcome") || title.includes("scenario");
      });
      if (!dialogOpen) return true;
      await sleep(300);
    }
    return false;
  }

  async function returnToTravelSceneAfterBeat(ctx) {
    try {
      // Prefer an explicit return target threaded through the travel ctx.
      const retId = ctx?.returnSceneUuid || ctx?.returnToSceneUuid;
      let target = null;
      if (retId) {
        const sceneId = (typeof retId === "string" && retId.startsWith("Scene."))
          ? (retId.split(".")[1] || retId)
          : retId;
        target = game.scenes?.get?.(sceneId) || null;
      }
      // Fallback: parent scene of the destination hex drawing — for travel
      // this is always the strategic / travel map.
      if (!target) {
        const hexDoc = ctx?.to?.obj ?? ctx?.to?.document ?? ctx?.to ?? null;
        const parent = hexDoc?.parent;
        if (parent?.activate) target = parent;
      }
      if (!target) {
        log("auto-return: no target scene resolved; skipping");
        return;
      }
      if (canvas?.scene?.id === target.id) {
        log("auto-return: already on target scene; skipping", target.name);
        return;
      }

      const idleOk = await waitForBeatChainIdle(90000);
      if (!idleOk) {
        log("auto-return: idle wait timed out; deferring return so the GM can finish manually");
        return;
      }
      // Recheck — user may have manually navigated during the wait.
      if (canvas?.scene?.id === target.id) return;

      await target.activate();
      log("auto-return: switched back to travel scene", target.name);
    } catch (e) {
      warn("auto-return: failed (non-blocking)", e);
    }
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

    try {
      await runBeat.call(campaignApi, campaignId, beatId);
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
        // Legacy model auto-returned to the travel scene after the beat. With the
        // cinematic dive the GM stays on the encounter scene and returns via the
        // back / pull-table buttons, so skip the auto-return when we dived.
        if (!dived) await returnToTravelSceneAfterBeat(ctx);
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
    log("Trigger manager ready (listening for bbttcc:afterTravel)");
  });
})();

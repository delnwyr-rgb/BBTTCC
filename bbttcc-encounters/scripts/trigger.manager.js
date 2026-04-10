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
      const res = await launchViaCampaignBeat(campaignApi, campaignId, beatId, ctx);
      if (res?.ok) return;
      warn("afterTravel: campaign.runBeat failed; falling back (best effort)", res);
      // continue to legacy fallback
    }

    // -----------------------------------------------------------------------
    // Legacy fallback: encounter → scenario registry
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

// modules/bbttcc-travel/scripts/api.travel.js
// Canonical travel wrapper + Hex Entry Beat (Option A)
//
// FIXED 2026-02-25:
// - Remove duplicated helper implementations that shadow each other
// - Use a single, deterministic Campaign Travel Table picker
// - Preserve "fail closed" Active Campaign (starred) behavior
// - Preserve Hex Enter Beat deferral + dedupe + console double-emit guard

(() => {
  const TAG  = "[bbttcc-travel/api]";
  const log  = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);

  // ---------------------------------------------------------------------------
  // Settings helpers
  // ---------------------------------------------------------------------------

  function safeGetSetting(ns, key, fallback) {
    try { return game.settings.get(ns, key); } catch (_e) { return fallback; }
  }

  async function safeSetSetting(ns, key, value) {
    try { return await game.settings.set(ns, key, value); } catch (_e) { return null; }
  }

  // ---------------------------------------------------------------------------
  // Campaign store
  // ---------------------------------------------------------------------------

  function normalizeCampaignStore(raw) {
    if (!raw) return { map: {}, list: [] };
    if (Array.isArray(raw)) {
      const list = raw.filter(Boolean);
      const map = Object.fromEntries(list.filter(c => c && c.id).map(c => [c.id, c]));
      return { map, list };
    }
    if (typeof raw === "object") {
      const map = raw;
      const list = Object.values(map).filter(Boolean);
      return { map, list };
    }
    return { map: {}, list: [] };
  }

  function getCampaignStore() {
    const raw = safeGetSetting("bbttcc-campaign", "campaigns", null);
    return normalizeCampaignStore(raw);
  }

  // ✅ Source of truth: bbttcc-campaign’s Active Campaign (the UI star)
  async function getActiveCampaignIdStarred() {
    const store = getCampaignStore();

    // Prefer API
    let id = null;
    try {
      const api = game.bbttcc && game.bbttcc.api ? game.bbttcc.api.campaign : null;
      if (api && typeof api.getActiveCampaignId === "function") {
        id = String(api.getActiveCampaignId() || "").trim() || null;
      }
    } catch (_e) {}

    // Fallback: direct setting
    if (!id) {
      id = String(safeGetSetting("bbttcc-campaign", "activeCampaignId", "") || "").trim() || null;
    }

    if (!id) return null;

    // Validate against this world’s campaign store (fail closed)
    if (!store.map || !store.map[id]) {
      warn("Active campaign id is set, but not found in store. (Fail closed)", {
        activeId: id,
        known: (store.list || []).map(c => c && c.id).filter(Boolean)
      });
      return null;
    }

    // Sync injector key so existing injector machinery stays aligned
    await safeSetSetting("bbttcc-core", "campaignInjectorActiveCampaignId", id);

    return id;
  }

  function getCampaignById(campaignId) {
    const store = getCampaignStore();
    return (store.map && store.map[campaignId]) ? store.map[campaignId] : null;
  }

  // ---------------------------------------------------------------------------
  // Encounter enrichment helpers
  // ---------------------------------------------------------------------------

  function clampTier(t) {
    const n = Number(t || 1);
    return Number.isFinite(n) ? Math.max(1, Math.min(4, n)) : 1;
  }

  function normKey(v, fallback) {
    const s = String(v || "").trim().toLowerCase();
    return s || (fallback ? String(fallback).trim().toLowerCase() : "");
  }

  function normalizeEncounterShape(enc) {
    if (!enc || typeof enc !== "object") return null;
    const tier = clampTier(enc.tier != null ? enc.tier : (enc.result && enc.result.tier) ? enc.result.tier : 1);
    const key = (enc.key != null ? enc.key : (enc.result ? enc.result.key : null)) || null;
    const label = (enc.label != null ? enc.label : (enc.result ? enc.result.label : null)) || key || null;

    // Preserve extended fields (beatId, campaignId, meta, category) used by downstream Trigger Manager.
    const out = Object.assign({}, enc);
    out.triggered = !!enc.triggered;
    out.tier = tier;
    out.key = key;
    out.label = label;
    out.result = { key, label, tier };
    return out;
  }

  function buildStepCtxFromTravelResult(result) {
    const terrain = String((result && (result.terrainKey || result.terrain)) || "plains");
    return {
      terrain,
      hasRoad: false,
      regionHeat: Number((result && result.regionHeat) || 0) || 0,
      darkness: Number((result && result.darkness) || 0) || 0,
      stepsOnRoute: Number((result && result.stepsOnRoute) || 1) || 1
    };
  }

  // ---------------------------------------------------------------------------
  // Campaign travel table selection (roll-only)
  // - Uses bbttcc-campaign encounterTables setting (Table Editor)
  // - Picks entry by weight WITHOUT executing a beat
  // - Supports travel_<terrain>_tN, travel_<terrain>_tierN, travel_generic_tN
  // ---------------------------------------------------------------------------

  function safeGetEncounterTablesSetting() {
    try { return game.settings.get("bbttcc-campaign", "encounterTables") || {}; }
    catch (_e) { return {}; }
  }

  function resolveTravelTableId(tables, terrainKey, tier) {
    const t = clampTier(tier);
    const terr = normKey(terrainKey, "generic");
    const candidates = [
      `travel_${terr}_t${t}`,
      `travel_${terr}_tier${t}`,
      `travel_generic_t${t}`
    ];
    for (let i = 0; i < candidates.length; i++) {
      const id = candidates[i];
      if (tables && tables[id]) return id;
    }
    return null;
  }

  function parseConditions(raw) {
    if (!raw) return null;
    if (typeof raw === "object") return raw;
    if (typeof raw !== "string") return null;
    const s = String(raw).trim();
    if (!s) return null;
    try { return JSON.parse(s); } catch (_e) { return null; }
  }

  function passesTravelConditions(ent, terrainKey) {
    const condRaw = ent ? ent.conditions : null;
    const cond = parseConditions(condRaw) || (typeof condRaw === "object" ? condRaw : null);
    if (!cond) return true;

    const terr = normKey(terrainKey, "");

    // Authoring supports:
    // - conditions.terrains = ["plains","ruins",...]
    // - conditions.terrain  = "plains"
    if (Array.isArray(cond.terrains) && cond.terrains.length) {
      const ok = cond.terrains.map(t => normKey(t, "")).includes(terr);
      if (!ok) return false;
    }
    if (cond.terrain) {
      const ok2 = normKey(cond.terrain, "") === terr;
      if (!ok2) return false;
    }

    return true;
  }

  function weightedPick(entries) {
    const list = Array.isArray(entries) ? entries : [];
    if (!list.length) return null;

    let total = 0;
    const weights = [];
    for (let i = 0; i < list.length; i++) {
      const w = Number(list[i] && list[i].weight);
      const ww = (Number.isFinite(w) && w > 0) ? w : 1;
      total += ww;
      weights.push(ww);
    }
    if (total <= 0) return null;

    let r = Math.random() * total;
    for (let i = 0; i < list.length; i++) {
      r -= weights[i];
      if (r <= 0) return list[i];
    }
    return list[list.length - 1] || null;
  }

  function getBeatFromCampaignStore(campaignId, beatId) {
    const c = getCampaignById(campaignId);
    if (!c) return null;

    const beatsRaw = c.beats;

    // object-map (current)
    if (beatsRaw && typeof beatsRaw === "object" && !Array.isArray(beatsRaw)) {
      return beatsRaw[beatId] || null;
    }

    // array (legacy)
    if (Array.isArray(beatsRaw)) {
      const bid = String(beatId || "");
      return beatsRaw.find(b => b && String(b.id || "") === bid) || null;
    }

    return null;
  }

  function pickEncounterFromCampaignTables({ campaignId, terrainKey, tier }) {
    const tables = safeGetEncounterTablesSetting();
    const tableId = resolveTravelTableId(tables, terrainKey, tier);
    if (!tableId) return { ok: false, reason: "table_not_found", candidates: { terrainKey, tier } };

    const table = tables ? tables[tableId] : null;
    if (!table) return { ok: false, reason: "table_not_found", tableId };

    const entries = Array.isArray(table.entries) ? table.entries : [];
    if (!entries.length) return { ok: false, reason: "no_entries", tableId };

    const eligible = entries.filter(ent => ent && passesTravelConditions(ent, terrainKey));
    if (!eligible.length) return { ok: false, reason: "no_eligible", tableId };

    const pick = weightedPick(eligible);
    if (!pick) return { ok: false, reason: "roll_failed", tableId };

    const cid = String(pick.campaignId || campaignId || "").trim() || null;
    const bid = String(pick.beatId || "").trim() || null;
    if (!cid || !bid) return { ok: false, reason: "bad_entry", tableId, pick };

    const beat = getBeatFromCampaignStore(cid, bid);
    if (!beat) return { ok: false, reason: "beat_not_found", tableId, campaignId: cid, beatId: bid };

    const encounterKey = (beat && beat.encounter && beat.encounter.key) ? beat.encounter.key :
      (bid.indexOf("enc_") === 0 ? bid.slice(4) : bid);

    const label = (beat && (beat.title || beat.label || beat.name)) || encounterKey || bid;

    return {
      ok: true,
      tableId,
      campaignId: cid,
      beatId: bid,
      encounterKey: encounterKey || bid,
      label
    };
  }

  // ---------------------------------------------------------------------------
  // Idle / terminal deferral helpers
  // ---------------------------------------------------------------------------

  function isCombatActive() { return !!(game.combat && game.combat.started); }

  function hasBBTTCCModalOpen() {
    try {
      const sel = [
        ".bbttcc-encounter",".bbttcc-encounter-dialog",
        ".bbttcc-scenario",".bbttcc-scenario-dialog",
        ".bbttcc-outcome",".bbttcc-outcome-dialog"
      ].join(",");
      if (document.querySelector(sel)) return true;

      const wins = Object.values(ui.windows || {});
      for (const w of wins) {
        const title = String((w && (w.title || (w.options && w.options.title))) || "").toLowerCase();
        const cls = String((w && w.constructor && w.constructor.name) || "").toLowerCase();
        if (title.includes("encounter") || title.includes("outcome") || title.includes("scenario")) return true;
        if (cls.includes("encounter") || cls.includes("outcome") || cls.includes("scenario")) return true;
      }
    } catch (_e) {}
    return false;
  }

  async function waitForIdle({ homeSceneUuid, timeoutMs = 45000 } = {}) {
    const started = Date.now();
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    while (true) {
      if ((Date.now() - started) > timeoutMs) return { ok: false, why: "timeout" };
      const onHome = !homeSceneUuid || (canvas && canvas.scene && canvas.scene.uuid === homeSceneUuid);
      if (onHome && !hasBBTTCCModalOpen() && !isCombatActive()) return { ok: true };
      await sleep(250);
    }
  }

  // ---------------------------------------------------------------------------
  // Hex Entry Beat
  // ---------------------------------------------------------------------------

  function readHexOnEnterBeatIdFromDrawing(toDrawing) {
    try {
      const doc = toDrawing && toDrawing.document ? toDrawing.document : toDrawing;
      const tf = (doc && doc.getFlag) ? (doc.getFlag("bbttcc-territory") || {}) : (doc && doc.flags ? (doc.flags["bbttcc-territory"] || {}) : {});
      const beatId = tf && tf.campaign ? (tf.campaign.onEnterBeatId || "") : "";
      return String(beatId || "").trim() || null;
    } catch (_e) { return null; }
  }

  function readCampaignOverrideOnEnterBeatId(campaign, hexUuid) {
    try {
      const ov = (campaign && (campaign.hexOverrides || (campaign.overrides && campaign.overrides.hex))) || null;
      const rec = ov ? (ov[hexUuid] || null) : null;
      const beatId = rec ? (rec.onEnterBeatId || rec.beatId || null) : null;
      return String(beatId || "").trim() || null;
    } catch (_e) { return null; }
  }

  const _recent = new Map();
  function dkey(campaignId, beatId, hexUuid, factionId) { return [campaignId || "", beatId || "", hexUuid || "", factionId || ""].join("|"); }
  function seen(key, ms) {
    const now = Date.now();
    const t = _recent.get(key) || 0;
    const windowMs = (ms != null) ? ms : 5000;
    if (t && (now - t) < windowMs) return true;
    _recent.set(key, now);
    for (const [k, v] of _recent.entries()) if ((now - v) > 20000) _recent.delete(k);
    return false;
  }

  async function runHexEnterBeatNow(result, opts) {
    const injector = game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaigns ? game.bbttcc.api.campaigns.injector : null;
    if (!injector) { warn("Hex enter skipped: injector missing"); return; }

    const ctx = (result && result.context) ? result.context : {};
    const to = ctx ? ctx.to : null;
    const hexUuid = (to && to.document && to.document.uuid) || (to && to.uuid) || (result && result.hexUuid) || null;
    if (!hexUuid) { warn("Hex enter skipped: no hexUuid"); return; }

    const campaignId = await getActiveCampaignIdStarred();
    if (!campaignId) { warn("Hex enter skipped: no STARRED active campaign"); return; }

    const campaign = getCampaignById(campaignId);
    if (!campaign) { warn("Hex enter skipped: campaign not found", campaignId); return; }

    const beatId =
      readCampaignOverrideOnEnterBeatId(campaign, hexUuid) ||
      readHexOnEnterBeatIdFromDrawing(to) ||
      null;

    if (!beatId) { log("Hex enter: no beat configured", { hexUuid, campaignId }); return; }

    const factionId = (ctx && ctx.factionId) || (opts && opts.factionId) || null;
    const key = dkey(campaignId, beatId, hexUuid, factionId);
    if (seen(key, 5000)) { log("Hex enter: dedupe skip", { beatId, hexUuid }); return; }

    const terrFlags = (to && to.document && to.document.getFlag) ? (to.document.getFlag("bbttcc-territory") || {}) :
      (to && to.document && to.document.flags) ? (to.document.flags["bbttcc-territory"] || {}) : {};

    const terrain = String((terrFlags && (terrFlags.terrainType || terrFlags.terrain)) || (ctx && ctx.terrainKey) || "wilderness").toLowerCase();

    const enterCtx = {
      source: "hex_entry",
      trigger: "hex_enter",
      factionId: factionId,
      hexUuid: hexUuid,
      terrain: terrain,
      encounter: (result && result.encounter && result.encounter.triggered) ? result.encounter : null
    };

    log("Hex enter: resolved beat", { campaignId, beatId, hexUuid, terrain });

    // Prefer injector path (gated)
    if (typeof injector.maybeRunBeatById === "function") {
      const res = await injector.maybeRunBeatById({
        campaignId: campaignId,
        beatId: beatId,
        triggerType: "hex_enter",
        ctx: enterCtx,
        defaults: { oncePerHex: true }
      });
      log("Hex enter: maybeRunBeatById →", res);
      return;
    }

    // Fallback direct runBeat
    const runBeat =
      (game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaign && game.bbttcc.api.campaign.runBeat) ||
      (game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaigns && game.bbttcc.api.campaigns.runBeat) ||
      null;

    if (typeof runBeat === "function") {
      await runBeat(campaignId, beatId);
      log("Hex enter: ran via direct runBeat", { campaignId, beatId });
      return;
    }

    warn("Hex enter skipped: no runBeat available");
  }

  async function maybeRunHexEnterBeatDeferred(result, opts) {
    const homeSceneUuid = (canvas && canvas.scene) ? canvas.scene.uuid : null;
    const hasEncounter = !!(result && result.encounter && result.encounter.triggered);

    if (!hasEncounter) {
      setTimeout(() => { runHexEnterBeatNow(result, opts).catch(e => warn("Hex enter failed:", e)); }, 0);
      return;
    }

    log("Hex enter: deferring until idle…", { homeSceneUuid, encounter: (result && result.encounter && (result.encounter.key || true)) });

    setTimeout(async () => {
      const idle = await waitForIdle({ homeSceneUuid, timeoutMs: 45000 });
      if (!idle.ok) warn("Hex enter: idle wait failed (best effort)", idle);
      try { await runHexEnterBeatNow(result, opts); } catch (e) { warn("Hex enter failed:", e); }
    }, 250);
  }

  // ---------------------------------------------------------------------------
  // Canonical wrapper: travelHex
  // ---------------------------------------------------------------------------

  async function travelHex(opts) {
    opts = opts || {};
    const api = game.bbttcc ? game.bbttcc.api : null;

    const coreFn =
      (api && api.travel && typeof api.travel.__coreTravel === "function" && api.travel.__coreTravel !== travelHex) ? api.travel.__coreTravel :
      (api && typeof api.__coreTravelHex === "function" && api.__coreTravelHex !== travelHex) ? api.__coreTravelHex :
      null;

    if (typeof coreFn !== "function") {
      warn("travelHex wrapper: core travelHex not ready");
      return { ok: false, error: "core-travel-not-ready", opts: opts };
    }

    let result;
    try {
      result = await coreFn(opts);
    } catch (e) {
      warn("travelHex wrapper: core threw", e);
      return { ok: false, error: "core-travel-error", exception: e, opts: opts };
    }

    // Thread caller intent through for downstream listeners / UI
    try {
      if (result && typeof result === "object") {
        if (opts && opts.source != null && result.source == null) result.source = opts.source;
        if (opts && opts.encounterPolicy != null) result.encounterPolicy = String(opts.encounterPolicy);
        if (opts && opts.costMult != null) result.costMult = Number(opts.costMult);
        if (opts && opts.costAdd != null) result.costAdd = opts.costAdd;
        if (opts && opts.costSet != null) result.costSet = opts.costSet;
      }
    } catch (_e) {}

    // Time Points (Strategic Turn meter)
    try {
      const world = api ? api.world : null;
      const ok = !!(result && result.ok);
      const tpRaw = (opts && (opts.timePoints != null ? opts.timePoints :
        (opts.timePointsPerLeg != null ? opts.timePointsPerLeg :
          (opts.travelUnits != null ? opts.travelUnits : opts.time)))) || 0;

      const tp = Number(tpRaw || 0);
      if (ok && world && typeof world.addTime === "function" && tp > 0) {
        const note = `Travel ${String(opts.hexFrom || "")}→${String(opts.hexTo || "")}`;
        await world.addTime(tp, { source: "travel", note: note });
      }
    } catch (e) {
      warn("Time add failed (non-blocking)", e);
    }

    // Encounter enrichment (campaign tables)
    // If core travel reports an encounter trigger, pick a specific encounter beat from the active campaign's travel tables.
    try {
      const enc = result ? result.encounter : null;
      if (enc && enc.triggered) {
        const hasKey = !!(enc.key || (enc.result && enc.result.key));
        const tier = clampTier((enc.tier != null ? enc.tier : (result ? result.terrainTier : null)) || 1);

        if (!hasKey) {
          const campaignId = await getActiveCampaignIdStarred();
          if (!campaignId) {
            warn("Encounter enrichment skipped: no STARRED active campaign");
          } else {
            const terrainKey = String(
              (result && result.context && result.context.terrainKey) ||
              (result && result.terrainKey) ||
              (result && result.context && result.context.terrain) ||
              (result && result.terrain) ||
              "plains"
            );

            const pick = pickEncounterFromCampaignTables({ campaignId, terrainKey, tier });

            if (pick && pick.ok) {
              result.encounter = {
                triggered: true,
                tier: tier,
                key: pick.encounterKey || pick.beatId,
                beatId: pick.beatId,
                campaignId: pick.campaignId,
                label: pick.label,
                beatId: pick.beatId,
                campaignId: pick.campaignId,
                meta: {
                  tableId: pick.tableId,
                  terrainKey: normKey(terrainKey, "plains"),
                  stepCtx: buildStepCtxFromTravelResult(result)
                },
                result: {
                  key: pick.encounterKey || pick.beatId,
                  label: pick.label,
                  tier: tier
                }
              };
              log("Enriched encounter (campaign tables):", result.encounter);
            } else {
              warn("Encounter enrichment failed (no campaign table pick)", {
                campaignId: campaignId,
                terrainKey: terrainKey,
                tier: tier,
                pick: pick
              });
            }
          }
        }

        result.encounter = normalizeEncounterShape(result.encounter) || result.encounter;
        // NOTE: Wrapper does not emit bbttcc:afterTravel. Travel Console is the single emitter.
      }
    } catch (e) {
      warn("Encounter enrichment failed (non-blocking)", e);
    }

    // Hex entry beat (terminal)
    await maybeRunHexEnterBeatDeferred(result, opts);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Publisher + drift guard
  // ---------------------------------------------------------------------------

  function publishAPI() {
    game.bbttcc = game.bbttcc || { api: {} };
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.travel = game.bbttcc.api.travel || {};

    const api = game.bbttcc.api;

    const existingCore =
      (api.travel && typeof api.travel.__coreTravel === "function" && api.travel.__coreTravel !== travelHex) ? api.travel.__coreTravel :
      (typeof api.travelHex === "function" && api.travelHex !== travelHex) ? api.travelHex :
      null;

    if (existingCore && typeof api.travel.__coreTravel !== "function") api.travel.__coreTravel = existingCore;
    api.__coreTravelHex = api.travel.__coreTravel || existingCore || api.__coreTravelHex || null;

    api.travelHex = travelHex;
    api.travel.travelHex = travelHex;

    log("Installed canonical travel wrapper.", {
      hasCore: (api.travel && typeof api.travel.__coreTravel === "function"),
      coreName: (api.travel && api.travel.__coreTravel) ? (api.travel.__coreTravel.name || "anonymous") : null
    });
  }

  function installDriftGuard() {
    let ticks = 0;
    const MAX = 40;
    const id = setInterval(() => {
      ticks++;
      try {
        const api = game.bbttcc ? game.bbttcc.api : null;
        if (!api) return;
        const curA = api.travelHex;
        const curB = api.travel ? api.travel.travelHex : null;
        if (curA !== travelHex || curB !== travelHex) {
          warn("Detected travelHex overwrite; reasserting wrapper.", {
            curA: curA ? (curA.name || "anonymous") : null,
            curB: curB ? (curB.name || "anonymous") : null
          });
          publishAPI();
        }
      } catch (_e) {}
      if (ticks >= MAX) clearInterval(id);
    }, 250);
  }

  Hooks.once("ready", () => { publishAPI(); installDriftGuard(); });
  try { if (game && game.ready) { publishAPI(); installDriftGuard(); } } catch (_e) {}
})();

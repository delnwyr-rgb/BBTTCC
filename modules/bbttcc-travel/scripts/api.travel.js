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

  // Show the Launch / Decline / Reroll dialog locally and resolve the choice.
  // Used directly when a GM client arbitrates, and also called by the GM-side
  // socket listener when arbitrating on behalf of a player.
  function _showLocalEncounterDialog(enc, headerExtra = "") {
    return new Promise((resolve) => {
      const label = String(enc?.label || enc?.key || "Encounter");
      const tier  = clampTier(enc?.tier || 1);
      const cascaded = !!(enc?.meta?.cascaded);
      const requested = clampTier(enc?.meta?.requestedTier || tier);
      const tierNote = cascaded
        ? `<span style="opacity:.7;">(Tier ${requested} → cascaded to Tier ${tier})</span>`
        : `<span style="opacity:.75;">(Tier ${tier})</span>`;
      const safe = String(label).replace(/[<>&]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]));
      const content = `
        <div style="font:13px Helvetica; line-height:1.4;">
          ${headerExtra}
          <div style="margin-bottom:.4rem;">
            <b>${safe}</b> ${tierNote}
          </div>
          <div style="opacity:.9;">
            A travel encounter was triggered. Launch it now, decline it (route continues),
            or reroll the table for a different beat at the same tier.
          </div>
        </div>`;
      new Dialog({
        title: "Travel Encounter",
        content,
        buttons: {
          launch:  { label: "Launch",  callback: () => resolve("launch")  },
          decline: { label: "Decline", callback: () => resolve("decline") },
          reroll:  { label: "Reroll",  callback: () => resolve("reroll")  }
        },
        default: "launch",
        close: () => resolve("decline")
      }).render(true);
    });
  }

  // Inline encounter arbitration prompt. GM clients see it locally; player
  // clients relay the request to a GM client via socket so the GM is the one
  // arbitrating Launch / Decline / Reroll for player-initiated travel.
  // Non-GM behavior used to be "auto-launch" but the user explicitly wanted
  // GM control over whether a player's travel triggers an encounter.
  function promptGMInlineForEncounter(enc) {
    if (game.user?.isGM) {
      return _showLocalEncounterDialog(enc);
    }

    // Non-GM: relay to the GM client via the bbttcc-travel module socket.
    // The GM-side listener (registered in setupEncounterArbitrationRelay below)
    // shows the same dialog locally and emits the choice back. We auto-decline
    // after 60s to avoid hanging the player's travel forever if no GM responds.
    return new Promise((resolve) => {
      const requestId = foundry.utils.randomID();
      const onResponse = (payload) => {
        if (!payload || payload.action !== "encounter-arbitrate-response") return;
        if (payload.requestId !== requestId) return;
        try { game.socket.off("module.bbttcc-travel", onResponse); } catch (_e) {}
        // GM client may have already fired bbttcc:afterTravel locally (so scene
        // activation runs with its permissions). Mark the enc so the player's
        // rp-exec doesn't double-fire the hook on its permission-poor client.
        if (payload.gmHandledLaunch) {
          try { enc.gmHandledLaunch = true; } catch (_e) {}
        }
        resolve(String(payload.choice || "decline"));
      };
      try { game.socket.on("module.bbttcc-travel", onResponse); } catch (_e) {}

      // Pull travel context from the closest enclosing variables so the GM-side
      // listener can fire bbttcc:afterTravel locally (where it has scene-activation
      // permissions). We stuff identifiers onto `enc.__ctx` defensively — the
      // caller in travelHex stamps these before invoking promptGMInlineForEncounter.
      const ctx = enc?.__ctx || {};

      try {
        game.socket.emit("module.bbttcc-travel", {
          action: "encounter-arbitrate-request",
          requestId,
          requestingUserId: game.user?.id || null,
          requestingUserName: game.user?.name || "Player",
          enc: {
            // `triggered: true` is what the trigger manager (bbttcc-encounters/
            // scripts/trigger.manager.js handleEncounter) requires to actually
            // launch the encounter beat on the GM client. Without this flag the
            // GM-side hook fires but the launcher bails.
            triggered: true,
            label: enc?.label || enc?.key || null,
            key:   enc?.key || null,
            tier:  enc?.tier || 1,
            meta:  enc?.meta || null,
            beatId: enc?.beatId || null,
            campaignId: enc?.campaignId || null,
            result: enc?.result || null
          },
          context: {
            factionId:   ctx.factionId   || null,
            fromHexUuid: ctx.fromHexUuid || null,
            toHexUuid:   ctx.toHexUuid   || null,
            tokenUuid:   ctx.tokenUuid   || null,
            sceneId:     ctx.sceneId     || null
          }
        });
      } catch (e) {
        warn("encounter-arbitrate emit failed", e);
        resolve("decline");
        return;
      }

      ui.notifications?.info?.("Encounter triggered — awaiting GM decision...");

      setTimeout(() => {
        try { game.socket.off("module.bbttcc-travel", onResponse); } catch (_e) {}
        resolve("decline");
      }, 60000);
    });
  }

  // GM-side listener: receives encounter-arbitrate-request from a player client,
  // shows the same Launch/Decline/Reroll dialog locally, and emits the choice
  // back. Only the GM's client acts on the request (other GMs/players ignore).
  // Registered once on `ready` so we don't accumulate listeners.
  function setupEncounterArbitrationRelay() {
    if (!game.socket || globalThis.__bbttccTravelArbitrationBound) return;
    globalThis.__bbttccTravelArbitrationBound = true;

    game.socket.on("module.bbttcc-travel", async (payload) => {
      try {
        if (!payload || payload.action !== "encounter-arbitrate-request") return;
        if (!game.user?.isGM) return;
        // Edge-case: if multiple GMs are online, only the FIRST connected GM
        // (lowest user._stats?.createdTime || id) handles, to avoid duplicate
        // dialogs. Simple proxy: first active GM in game.users.
        const activeGMs = Array.from(game.users || []).filter(u => u.active && u.isGM);
        const primaryGM = activeGMs.sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
        if (primaryGM && primaryGM.id !== game.user.id) return;

        const headerExtra = `
          <div style="margin-bottom:.4rem; padding:.3rem .5rem; border-radius:6px;
                      background:rgba(255,215,80,0.10); border:1px solid rgba(255,215,80,0.35);
                      color:#ffd24a; font-size:12px;">
            <b>${String(payload.requestingUserName || "Player").replace(/[<>&]/g, c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]))}</b>
            triggered this encounter while traveling.
          </div>`;
        const choice = await _showLocalEncounterDialog(payload.enc, headerExtra);

        // On Launch, fire bbttcc:afterTravel on THIS (GM) client so scene-activation
        // listeners run with GM permissions. Player skips its own emit when it sees
        // `gmHandledLaunch: true` in the response. See feedback memory.
        let gmHandledLaunch = false;
        if (choice === "launch") {
          try {
            const emit = game.bbttcc?.api?.travel?.emitAfterTravelWithEncounter;
            const ctx = payload.context || {};
            if (typeof emit === "function") {
              const factionId = ctx.factionId || null;
              const actor     = factionId ? game.actors.get(factionId) : null;
              let token = null;
              if (ctx.tokenUuid) {
                const td = await fromUuid(ctx.tokenUuid).catch(() => null);
                token = td?.object ?? td ?? null;
              }
              await emit(
                { factionId, actor, source: "travel-console-relay", sceneId: ctx.sceneId || null },
                payload.enc,
                ctx.fromHexUuid || null,
                ctx.toHexUuid   || null,
                token
              );
              gmHandledLaunch = true;
              log("Encounter Launch fired on GM client (bbttcc:afterTravel emitted with player context).");
            } else {
              warn("emitAfterTravelWithEncounter API missing on GM client; player will fall back to its own emit (may lack scene-activation perms).");
            }
          } catch (e) {
            warn("GM-side launch emit failed; falling back to player-side", e);
          }
        }

        try {
          game.socket.emit("module.bbttcc-travel", {
            action: "encounter-arbitrate-response",
            requestId: payload.requestId,
            choice,
            gmHandledLaunch
          });
        } catch (e) { warn("encounter-arbitrate ack failed", e); }
      } catch (e) { warn("encounter-arbitrate handler error", e); }
    });
    log("Encounter arbitration relay listener installed (GM-side).");
  }
  Hooks.once("ready", setupEncounterArbitrationRelay);

  // Cross-seat receivers (2026-08-29): the pending-arrival flag lands on
  // every seat, and relayed hex-enter requests run on the PRIMARY GM only.
  Hooks.once("ready", () => {
    try {
      game.socket?.on?.("module.bbttcc-campaign", async (msg) => {
        try {
          if (msg?.t === "bbttccPendingHexEnter") {
            game.bbttcc = game.bbttcc || {};
            if (msg.on) game.bbttcc._pendingHexEnter = { hexUuid: msg.hexUuid || null, beatId: msg.beatId || null, ts: Number(msg.ts) || Date.now() };
            else { try { delete game.bbttcc._pendingHexEnter; } catch (_e) {} }
            return;
          }
        } catch (e) { warn("cross-seat receiver failed:", e); }
      });
    } catch (_eOn) {}

    // Phase 1 (2026-08-29): arrival relay lives on the gmExec primitive now
    // (election, ack, and validation come with the primitive). Fire-and-forget:
    // the beat chain can run for minutes; the ack is a receipt.
    try {
      game.bbttcc?.api?.gmExec?.register?.("travel.hexEnter", async (p, meta) => {
        const doc = p?.hexUuid ? await fromUuid(p.hexUuid).catch(() => null) : null;
        if (!doc) throw new Error("hex not resolved: " + (p?.hexUuid || "(none)"));
        const result = {
          context: { to: { document: doc }, factionId: p.factionId || null },
          encounter: p.encounter || null,
          hexUuid: p.hexUuid
        };
        runHexEnterBeatNow(result, { factionId: p.factionId || null })
          .catch(e => warn("relayed hex enter failed:", e));
        return { started: true, hexUuid: p.hexUuid, via: meta?.fromUserName || "gm" };
      });
      // RideSession writes from player seats (Phase 2).
      game.bbttcc?.api?.gmExec?.register?.("travel.rideSession.save", async (p) =>
        _rideWriteLocal(String(p?.factionId || ""), p?.session ?? null));
    } catch (_eReg) {}
  });

  // Cascade fallback: attempt the requested tier first, then step down tier by
  // tier if the table is missing / empty / has no eligible entries / is
  // mis-authored. Returns the successful pick plus a full escalation trail so
  // the GM can see exactly what was tried. Prevents the "blank Tier N modal"
  // where the engine reported an encounter but carried no beat data.
  function pickEncounterWithFallback({ campaignId, terrainKey, tier }) {
    const startTier = clampTier(tier);
    const trail = [];
    for (let cur = startTier; cur >= 1; cur--) {
      const pick = pickEncounterFromCampaignTables({ campaignId, terrainKey, tier: cur });
      trail.push({
        tier: cur,
        ok: !!(pick && pick.ok),
        reason: (pick && pick.reason) || null,
        tableId: (pick && pick.tableId) || null
      });
      if (pick && pick.ok) {
        return {
          ok: true,
          pick,
          requestedTier: startTier,
          resolvedTier: cur,
          cascaded: cur < startTier,
          trail
        };
      }
    }
    return { ok: false, pick: null, requestedTier: startTier, resolvedTier: null, cascaded: false, trail };
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
      // Campaign beat dialogs are titled by their BEAT LABEL ("Weather Front"),
      // so the title heuristic above never sees them — detect by content class
      // instead (GM dialog + read-only player mirror both carry it). Seen live
      // 2026-08-26: arrival fired mid-storm because the dialog was "invisible".
      if (document.querySelector(".bbttcc-campaign-dialog, .bbttcc-player-facing-dialog")) return true;
    } catch (_e) {}
    return false;
  }

  // Wait for an encounter's dialog to APPEAR (best effort). The arbitration
  // gap — GM deciding Launch / Decline / Reroll — has nothing open anywhere,
  // and an idle check started inside it sails straight through.
  async function waitForModal({ timeoutMs = 15000 } = {}) {
    const started = Date.now();
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    while ((Date.now() - started) <= timeoutMs) {
      if (hasBBTTCCModalOpen() || isCombatActive()) return { ok: true };
      await sleep(250);
    }
    return { ok: false, why: "timeout" };
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
      // getFlag(scope) w/o a key returns undefined — read the flags object directly.
      const tf = (doc && doc.flags ? (doc.flags["bbttcc-territory"] || {}) : {});
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
    // Two seats, one brain (2026-08-29): beats are GM-run. On player-driven
    // rides this deferral lives on the DRIVER's client — running the arrival
    // here rendered the beat dialog player-side (real, clickable), failed
    // scene activation and setting writes on permissions, and left the GM
    // blind. Relay the essentials to the primary GM seat instead.
    if (!game.user?.isGM) {
      // Phase 1 (2026-08-29): migrated from the bespoke socket branch onto the
      // gmExec seat primitive. Handler kicks the beat fire-and-forget and acks
      // a receipt (a beat chain can run for minutes — never hold the ack).
      try {
        const ctx0 = (result && result.context) || {};
        const to0 = ctx0.to || null;
        const hexUuid = (to0 && to0.document && to0.document.uuid) || (to0 && to0.uuid) || (result && result.hexUuid) || null;
        const payload = {
          hexUuid,
          factionId: ctx0.factionId || (opts && opts.factionId) || null,
          encounter: (result && result.encounter && result.encounter.triggered)
            ? { triggered: true, key: result.encounter.key || null } : null
        };
        const gx = game.bbttcc?.api?.gmExec;
        if (gx?.call) {
          const receipt = await gx.call("travel.hexEnter", payload).catch(e => ({ ok: false, error: String(e?.message || e) }));
          log("Hex enter: relayed via gmExec →", receipt);
        } else {
          warn("Hex enter: gmExec unavailable — arrival not relayed (stale client?)");
        }
      } catch (e) { warn("Hex enter relay failed:", e); }
      return;
    }

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

    // getFlag(scope) w/o a key returns undefined — read the flags object directly.
    const terrFlags = (to && to.document && to.document.flags) ? (to.document.flags["bbttcc-territory"] || {}) : {};

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

    // Cinematic dive: stash a one-shot dive request so this beat's scene launch
    // becomes a GM-solo zoom-dive into the hex's scene (executeBeat consumes it).
    try {
      const txn = game.bbttcc && game.bbttcc.api && game.bbttcc.api.transition;
      if (txn && typeof txn.requestDive === "function") {
        const place = (to && to.object) ? to.object : to;
        const center = place && place.center;
        const tdoc = (to && to.document) ? to.document : to;
        const w = Number((tdoc && tdoc.shape && tdoc.shape.width) || (tdoc && tdoc.width) || 0);
        const h = Number((tdoc && tdoc.shape && tdoc.shape.height) || (tdoc && tdoc.height) || 0);
        const focus = (center && Number.isFinite(center.x))
          ? { x: center.x, y: center.y }
          : { x: Number((tdoc && tdoc.x) || 0) + w / 2, y: Number((tdoc && tdoc.y) || 0) + h / 2 };
        txn.requestDive({
          // "activate": arrival is a TABLE moment — the whole table walks into
          // town together (owner ruling 2026-08-26; was "view", which left the
          // GM standing in the weather while the player reached the Cookline).
          hexUuid, focus, audience: "activate",
          label: (terrFlags && terrFlags.name) || undefined,
          originUuid: (canvas && canvas.scene) ? canvas.scene.uuid : null
        });
      }
    } catch (_eDive) { /* non-fatal: beat still runs, just plain-activates */ }

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

    // Pending-arrival marker (2026-08-28): the encounter auto-return in
    // bbttcc-encounters reads this to suppress its "Execute Route to ride on"
    // nudge when an arrival beat is about to fire for this leg's destination —
    // the arrival speaks for itself. Set ONLY when an arrival beat actually
    // resolves for the hex (ordinary mid-route hexes keep the nudge).
    let pendingSet = false;
    try {
      const ctx0 = (result && result.context) || {};
      const to0 = ctx0.to || null;
      const hexUuid0 = (to0 && to0.document && to0.document.uuid) || (to0 && to0.uuid) || null;
      const campaignId0 = await getActiveCampaignIdStarred();
      const campaign0 = campaignId0 ? getCampaignById(campaignId0) : null;
      const beatId0 = (campaign0 && hexUuid0)
        ? (readCampaignOverrideOnEnterBeatId(campaign0, hexUuid0) || readHexOnEnterBeatIdFromDrawing(to0) || null)
        : null;
      if (beatId0) {
        game.bbttcc = game.bbttcc || {};
        const pend = { hexUuid: hexUuid0, beatId: beatId0, ts: Date.now() };
        game.bbttcc._pendingHexEnter = pend;
        pendingSet = true;
        // Relay: on player-driven rides this seat is the DRIVER's, but the
        // GM's settle reads the flag to suppress the ride-on nudge — every
        // seat gets the pending state (2026-08-29, wrong "Execute Route"
        // nudge on a final leg).
        try { game.socket?.emit?.("module.bbttcc-campaign", { t: "bbttccPendingHexEnter", on: true, ...pend }); } catch (_ePS) {}
      }
    } catch (_ePend) {}

    log("Hex enter: deferring until idle…", { homeSceneUuid, encounter: (result && result.encounter && (result.encounter.key || true)), arrivalBeatPending: pendingSet });

    const deferT0 = Date.now();
    setTimeout(async () => {
      // 1) Let the encounter's dialog actually OPEN (covers the GM's
      //    arbitration think-time; a declined encounter simply times this out).
      // 2) Then wait for the chain to settle. 2026-08-28 handshake: the
      //    encounter auto-return (bbttcc-encounters) stamps
      //    game.bbttcc._encounterChainSettledTs when the chain is truly done —
      //    that signal fires the arrival PROMPTLY, immune to leftover
      //    unrelated dialogs (a lingering saddle-up dialog used to hold the
      //    broad modal check hostage — Acid Bog dead-air, owner report).
      //    Fallback: the old broad idle check, 15-min window. Past the cap the
      //    last-resort fire blocks ONLY on actual combat (never a window),
      //    hard stop 45 min.
      // Settlement Refactor (2026-08-28): the encounter side DECLARES
      // completion (settled stamp, socket-relayed to every seat). The arrival
      // trusts that signal. One fallback lane remains: an encounter that never
      // launches a beat (declined at arbitration, beatless) never settles —
      // after 120s of genuine quiet (no Bad Eden modal, no combat) treat it as
      // never-launched. Hard stop 45 min. No scene sniffing, no 15-min polls.
      const waitForSettlement = async () => {
        const started = Date.now();
        while (true) {
          const settled = Number((game.bbttcc && game.bbttcc._encounterChainSettledTs) || 0) > deferT0;
          if (settled) return { ok: true, via: "settled" };
          const launched = Number((game.bbttcc && game.bbttcc._encounterChainLaunchedTs) || 0) > deferT0;
          if (launched) {
            // A LAUNCHED chain settles or times out — no inference lane at
            // all (2026-08-29: the old quiet fallback raced a mid-chain
            // dialog gap and dove the table to the destination mid-parley).
            if ((Date.now() - started) > 2700000) return { ok: false, why: "hard-stop" };
          } else {
            // Never launched (declined at arbitration / beatless): fire after
            // 120s of genuine quiet, or unconditionally at 5 min.
            if ((Date.now() - started) > 120000 && !hasBBTTCCModalOpen() && !isCombatActive()) {
              return { ok: true, via: "never-launched" };
            }
            if ((Date.now() - started) > 300000) return { ok: true, via: "never-launched-cap" };
          }
          await new Promise(r => setTimeout(r, 500));
        }
      };
      const idle = await waitForSettlement();
      if (idle.ok) log("Hex enter: chain resolved →", idle.via);
      else warn("Hex enter: settlement never arrived (firing best-effort)", idle);
      try { await runHexEnterBeatNow(result, opts); } catch (e) { warn("Hex enter failed:", e); }
      finally {
        if (pendingSet) {
          try { delete game.bbttcc._pendingHexEnter; } catch (_e) {}
          try { game.socket?.emit?.("module.bbttcc-campaign", { t: "bbttccPendingHexEnter", on: false }); } catch (_ePC) {}
        }
      }
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
    // If core travel reports an encounter trigger, pick a specific encounter
    // beat from the active campaign's travel tables. Observability: every
    // attempt is logged with the candidate table ids, the cascade trail, and
    // the final beat pick so GMs can see exactly why a given encounter fired.
    // Safety: if NO table resolves at any tier, demote `triggered` to false
    // so downstream modals do not render a blank encounter and the Travel
    // Console does not pause the route on a phantom hit.
    try {
      const enc = result ? result.encounter : null;
      if (enc && enc.triggered) {
        const hasKey = !!(enc.key || (enc.result && enc.result.key));
        const requestedTier = clampTier((enc.tier != null ? enc.tier : (result ? result.terrainTier : null)) || 1);

        if (!hasKey) {
          const terrainKey = String(
            (result && result.context && result.context.terrainKey) ||
            (result && result.terrainKey) ||
            (result && result.context && result.context.terrain) ||
            (result && result.terrain) ||
            "plains"
          );
          const terrNorm = normKey(terrainKey, "plains");

          const campaignId = await getActiveCampaignIdStarred();
          if (!campaignId) {
            warn("Encounter enrichment skipped: no STARRED active campaign — demoting to skip", {
              terrainKey: terrNorm, requestedTier
            });
            try { ui.notifications?.warn(`Travel encounter skipped: no active campaign starred. Star a campaign to enable travel encounters.`); } catch(_e){}
            result.encounter = {
              triggered: false,
              tier: requestedTier,
              reason: "no_active_campaign",
              meta: { terrainKey: terrNorm, requestedTier }
            };
          } else {
            // Log candidate table ids BEFORE the pick so GMs can see exactly
            // what the engine is reaching for, even when the pick fails.
            log("Travel encounter — resolving table", {
              campaignId,
              terrainKey: terrNorm,
              requestedTier,
              candidates: [
                `travel_${terrNorm}_t${requestedTier}`,
                `travel_${terrNorm}_tier${requestedTier}`,
                `travel_generic_t${requestedTier}`
              ]
            });

            const res = pickEncounterWithFallback({ campaignId, terrainKey: terrNorm, tier: requestedTier });

            if (res.ok) {
              const pick = res.pick;
              result.encounter = {
                triggered: true,
                tier: res.resolvedTier,
                key: pick.encounterKey || pick.beatId,
                beatId: pick.beatId,
                campaignId: pick.campaignId,
                label: pick.label,
                meta: {
                  tableId: pick.tableId,
                  terrainKey: terrNorm,
                  requestedTier,
                  resolvedTier: res.resolvedTier,
                  cascaded: res.cascaded,
                  trail: res.trail,
                  stepCtx: buildStepCtxFromTravelResult(result)
                },
                result: {
                  key: pick.encounterKey || pick.beatId,
                  label: pick.label,
                  tier: res.resolvedTier
                }
              };
              log("Travel encounter — picked beat", {
                tableId: pick.tableId,
                beatId: pick.beatId,
                label: pick.label,
                terrainKey: terrNorm,
                requestedTier,
                resolvedTier: res.resolvedTier,
                cascaded: res.cascaded,
                trail: res.trail
              });
              if (res.cascaded) {
                try {
                  ui.notifications?.info(
                    `Travel encounter cascaded Tier ${requestedTier} → Tier ${res.resolvedTier} ` +
                    `(no authored Tier ${requestedTier} table for ${terrNorm}).`
                  );
                } catch(_e){}
              }
            } else {
              // Total cascade failure — skip the encounter rather than leaving
              // it in a triggered-but-beatless limbo. Surface a precise GM
              // message so the missing author state is actionable.
              warn("Travel encounter — no table at any tier; skipping encounter", {
                campaignId, terrainKey: terrNorm, requestedTier, trail: res.trail
              });
              try {
                ui.notifications?.warn(
                  `Travel encounter skipped: no authored table for "${terrNorm}" at any tier ` +
                  `(tried ${res.trail.map(t => `t${t.tier}:${t.reason || "miss"}`).join(", ")}). ` +
                  `Author travel_${terrNorm}_t${requestedTier} in the Campaign Editor.`
                );
              } catch(_e){}
              result.encounter = {
                triggered: false,
                tier: requestedTier,
                reason: "no_table_cascade_failed",
                meta: { terrainKey: terrNorm, requestedTier, trail: res.trail }
              };
            }
          }
        }

        result.encounter = normalizeEncounterShape(result.encounter) || result.encounter;

        // -------------------------------------------------------------------
        // Policy arbitration (skip / prompt) — pre-empted here so the Travel
        // Console receives the final disposition. Previously the Console would
        // pause the route on `triggered: true`, then the trigger manager in
        // bbttcc-encounters would skip/decline silently — leaving the route
        // paused and forcing the GM to click Execute Route again. Handling
        // arbitration in the wrapper means:
        //   - "skip"          → demote `triggered: false`, route flows through.
        //   - "prompt:Decline" → demote `triggered: false`, route flows through.
        //   - "prompt:Launch"  → keep `triggered: true`, set policy to "auto" so
        //                        the trigger manager doesn't re-prompt.
        //   - "prompt:Reroll"  → re-pick from tables, re-prompt, loop (max 8).
        //   - "auto" (default) → unchanged; trigger manager launches as before.
        // -------------------------------------------------------------------
        if (result.encounter && result.encounter.triggered) {
          const rawPolicy = String((opts && opts.encounterPolicy) || "").trim().toLowerCase();
          const isSkip   = (rawPolicy === "skip" || rawPolicy === "decline" || rawPolicy === "none");
          const isPrompt = (rawPolicy === "prompt" || rawPolicy === "ask");

          if (isSkip) {
            log("Travel encounter — declined upstream (policy=skip)", {
              beatId: result.encounter.beatId,
              label:  result.encounter.label,
              tier:   result.encounter.tier
            });
            try { ui.notifications?.info?.(`Encounter declined (policy: skip): ${result.encounter.label || "Encounter"}`); } catch(_e){}
            result.encounter.triggered = false;
            result.encounter.declined = "policy:skip";
            result.encounterPolicy = "auto"; // signal — already arbitrated, downstream won't re-handle
          } else if (isPrompt) {
            // Stamp travel context onto the encounter so the GM-arbitration relay
            // (used when caller is a non-GM) can pass it across the socket; the
            // GM client then fires bbttcc:afterTravel locally on Launch (where
            // scene-activation listeners can run with GM permissions).
            try {
              result.encounter.__ctx = {
                factionId:   opts.factionId   || null,
                fromHexUuid: opts.hexFrom     || null,
                toHexUuid:   opts.hexTo       || null,
                tokenUuid:   (opts.tokenId && canvas?.tokens?.get?.(opts.tokenId)?.document?.uuid) || null,
                sceneId:     opts.sceneId     || canvas?.scene?.id || null
              };
            } catch (_e) {}

            let choice = "decline";
            for (let iter = 0; iter < 8; iter++) {
              choice = await promptGMInlineForEncounter(result.encounter);
              if (choice !== "reroll") break;

              // Reroll: re-pick at the SAME requested tier (cascade still allowed).
              const rerollCampaignId = result.encounter.campaignId || await getActiveCampaignIdStarred();
              const rerollTerrain   = result.encounter?.meta?.terrainKey || "plains";
              const rerollTier      = clampTier(result.encounter?.meta?.requestedTier || result.encounter.tier);
              if (!rerollCampaignId) {
                try { ui.notifications?.warn?.("Reroll unavailable: no active campaign starred."); } catch(_e){}
                break;
              }
              const reRes = pickEncounterWithFallback({
                campaignId: rerollCampaignId,
                terrainKey: rerollTerrain,
                tier: rerollTier
              });
              if (!reRes.ok) {
                try { ui.notifications?.warn?.("Reroll produced no result — keeping original encounter."); } catch(_e){}
                break;
              }
              const pick = reRes.pick;
              result.encounter.beatId      = pick.beatId;
              result.encounter.campaignId  = pick.campaignId;
              result.encounter.key         = pick.encounterKey || pick.beatId;
              result.encounter.label       = pick.label;
              result.encounter.tier        = reRes.resolvedTier;
              result.encounter.meta        = Object.assign({}, result.encounter.meta || {}, {
                tableId:      pick.tableId,
                resolvedTier: reRes.resolvedTier,
                cascaded:     reRes.cascaded,
                trail:        reRes.trail
              });
              result.encounter.result      = { key: result.encounter.key, label: pick.label, tier: reRes.resolvedTier };
              log("Travel encounter — rerolled", { tableId: pick.tableId, beatId: pick.beatId, label: pick.label });
              // continue loop → re-prompt with new pick
            }

            if (choice === "decline") {
              log("Travel encounter — declined via GM prompt", {
                beatId: result.encounter.beatId, label: result.encounter.label, tier: result.encounter.tier
              });
              try { ui.notifications?.info?.(`Encounter declined: ${result.encounter.label || "Encounter"}`); } catch(_e){}
              result.encounter.triggered = false;
              result.encounter.declined = "gm:prompt";
              result.encounterPolicy = "auto"; // already arbitrated
            } else {
              // launch
              log("Travel encounter — launched via GM prompt", {
                beatId: result.encounter.beatId, label: result.encounter.label, tier: result.encounter.tier
              });
              result.encounterPolicy = "auto"; // converted from "prompt" so trigger manager won't re-prompt
            }
          }
          // else policy is "auto" or empty → leave intact, trigger manager handles launch
        }

        // NOTE: Wrapper does not emit bbttcc:afterTravel. Travel Console is the single emitter.
      }
    } catch (e) {
      warn("Encounter enrichment failed (non-blocking)", e);
    }

    // Hex entry beat (terminal). Multi-leg ruling (owner, 2026-08-29, first
    // multi-leg ride): PASS-THROUGH ≠ ARRIVAL — an intermediate leg's
    // destination hex does NOT fire its hex-enter beat (KT→Lyrenn was firing
    // Allesh-Gilliam's Marshal Yarrow walk-in at the gates). Only the route's
    // final leg arrives. Callers that don't say (legacy single-hex moves,
    // direct API use) are treated as final.
    if (opts && opts.finalLeg === false) {
      log("Hex enter: intermediate leg — pass-through, arrival beat suppressed", { hexTo: opts.hexTo || null });
    } else {
      await maybeRunHexEnterBeatDeferred(result, opts);
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // RideSession (Phase 2 of the engine roadmap, 2026-08-29)
  // The ride is a first-class persisted object: the planned/remaining legs,
  // participants, and stage live in a world setting instead of the open
  // console window's closure (a reload mid-ride used to lose the route).
  // Writes are seat-safe via the gmExec primitive.
  // ---------------------------------------------------------------------------

  const RIDE_NS = "bbttcc-travel";
  const RIDE_KEY = "rideSessions";
  let _rideSettingRegistered = false;
  function _ensureRideSetting() {
    if (_rideSettingRegistered) return;
    try {
      game.settings.register(RIDE_NS, RIDE_KEY, { scope: "world", config: false, type: Object, default: {} });
      _rideSettingRegistered = true;
    } catch (_e) { _rideSettingRegistered = true; }
  }
  function rideGet(factionId) {
    _ensureRideSetting();
    try {
      const all = game.settings.get(RIDE_NS, RIDE_KEY) || {};
      return all[String(factionId || "")] || null;
    } catch (_e) { return null; }
  }
  function rideList() {
    _ensureRideSetting();
    try { return foundry.utils.deepClone(game.settings.get(RIDE_NS, RIDE_KEY) || {}); }
    catch (_e) { return {}; }
  }
  async function _rideWriteLocal(factionId, session) {
    _ensureRideSetting();
    const fid = String(factionId || "");
    if (!fid) return { ok: false, error: "factionId required" };
    const all = foundry.utils.deepClone(game.settings.get(RIDE_NS, RIDE_KEY) || {});
    if (session == null) delete all[fid];
    else all[fid] = session;
    await game.settings.set(RIDE_NS, RIDE_KEY, all);
    return { ok: true };
  }
  async function rideSave(factionId, session) {
    // World-setting writes are GM work — player seats relay via gmExec.
    if (game.user?.isGM) return _rideWriteLocal(factionId, session);
    const gx = game.bbttcc?.api?.gmExec;
    if (gx && typeof gx.call === "function") {
      try { return await gx.call("travel.rideSession.save", { factionId, session }); }
      catch (e) { return { ok: false, error: String(e?.message || e) }; }
    }
    return { ok: false, error: "gmExec unavailable" };
  }
  Hooks.once("init", _ensureRideSetting);

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

    // RideSession (Phase 2): the ride as a persisted, seat-safe object.
    api.travel.rideSession = {
      get: rideGet,
      list: rideList,
      save: rideSave,
      clear: (factionId) => rideSave(factionId, null)
    };

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

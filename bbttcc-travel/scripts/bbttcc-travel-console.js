// PATCHMARK: console-terrain-norm-and-encounter-visuals-20251215-041610
// PATCHMARK: weather-route-summary-chip-and-hex-association-20260105
// modules/bbttcc-travel/scripts/bbttcc-travel-console.js
// BBTTCC — Travel Console v1.5.11

(() => {
  const TAG      = "[bbttcc-travel-console v1.5.11]";
  const MOD_TERR = "bbttcc-territory";
  const MOD_FCT  = "bbttcc-factions";

  function enc(s) { return foundry.utils.escapeHTML(String(s ?? "")); }

  function opLabel(k) {
    return {
      violence:  "Violence",
      nonlethal: "Non-Lethal",
      intrigue:  "Intrigue",
      economy:   "Economy",
      softpower: "Soft Power",
      diplomacy: "Diplomacy",
      logistics: "Logistics",
      culture:   "Culture",
      faith:     "Faith"
    }[k] || k;
  }

  function opToStr(cost) {
    const keys = Object.keys(cost || {});
    if (!keys.length) return "";
    return keys
      .filter(k => Number(cost[k] || 0) > 0)
      .map(k => `${cost[k]} ${opLabel(k)}`)
      .join(", ");
  }

  const OP_KEYS = [
    "violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"
  ];

  function normTerrKey(k) {
    const s = String(k || "").trim();
    const low = s.toLowerCase();
    const alias = {
      canyon: "canyons",
      badland: "badlands",
      marsh: "swamp",
      ashwastes: "ashWastes",
      urbanwreckage: "urbanWreckage",
      sea: "sea",
      ocean: "ocean"
    };
    return alias[low] || s;
  }

  function normalizeDeltas(raw) {
    const out = {};
    const src = raw || {};
    for (const k of OP_KEYS) {
      const v = src[k];
      out[k] = Number.isFinite(Number(v)) ? Number(v) : 0;
    }
    return out;
  }

  function terrainDict() {
    const base = game.bbttcc?.api?._hexTravel?.TERRAIN_TABLE || {};
    const fb   = game.bbttcc?.api?.travel?.TERRAIN || {};
    const labelMap = {
      plains:        "Plains / Grasslands",
      grasslands:    "Grasslands",
      forest:        "Forest / Jungle",
      jungle:        "Jungle",
      mountains:     "Mountains / Highlands",
      highlands:     "Highlands",
      canyons:       "Canyons / Badlands",
      badlands:      "Badlands",
      swamp:         "Swamp / Mire",
      mire:          "Mire",
      desert:        "Desert / Ash Wastes",
      ashWastes:     "Ash Wastes",
      river:         "River / Lake",
      lake:          "Lake",
      sea:           "Sea",
      ocean:         "Sea / Ocean",
      ruins:         "Ruins / Urban",
      urbanWreckage: "Urban Wreckage",
      wasteland:     "Wasteland / Radiation",
      radiation:     "Radiation Zone"
    };

    const dict = {};
    for (const [key, spec] of Object.entries(base)) {
      dict[key] = {
        label: labelMap[key] || fb[key]?.label || key,
        cost:  foundry.utils.duplicate(spec.cost || fb[key]?.cost || {})
      };
    }

    for (const [key, label] of Object.entries(labelMap)) {
      if (!dict[key]) dict[key] = { label, cost: {} };
    }

    return dict;
  }

  function isTerritoryHexDoc(doc) {
    const f = doc?.flags?.[MOD_TERR] || {};
    return !!f && (f.isHex === true || f.kind === "territory-hex" || Object.keys(f).length > 0);
  }

  function mapHexTypeToTerrainKey(type) {
    const t = String(type || "").toLowerCase().trim();
    const map = {
      wilderness: "plains",
      wasteland: "wasteland",
      ruins: "ruins",
      settlement: "plains",
      fortress: "plains",
      mine: "mountains",
      farm: "plains",
      port: "river",
      factory: "urbanWreckage",
      research: "urbanWreckage",
      temple: "plains"
    };
    return map[t] || "plains";
  }

  function extractTerrainKeyFromFlags(flags) {
    const terr = flags?.terrain;
    let terrainKey =
      terr?.key ||
      flags?.terrainKey ||
      flags?.terrainType ||
      flags?.terrain ||
      null;

    if (terrainKey) {
      const raw = String(terrainKey).trim();
      const low = raw.toLowerCase();
      if (low.includes("mountain") || low.includes("highland")) return "mountains";
      if (low.includes("canyon") || low.includes("badland")) return "canyons";
      if (low.includes("swamp") || low.includes("mire")) return "swamp";
      if (low.includes("forest") || low.includes("jungle")) return "forest";
      if (low.includes("desert") || low.includes("ash")) return "desert";
      if (low.includes("river") || low.includes("lake")) return "river";
      if (low.includes("sea") || low.includes("ocean")) return "ocean";
      if (low.includes("ruin") || low.includes("urban")) return "ruins";
      if (low.includes("wasteland") || low.includes("radiation")) return "wasteland";
      if (low.includes("plain") || low.includes("grass")) return "plains";
      return raw;
    }

    return mapHexTypeToTerrainKey(flags?.type);
  }

  function getHexesOnScene() {
    const placeables = (canvas?.drawings?.placeables || []);
    return placeables
      .map(p => {
        const doc = p?.document;
        if (!doc) return null;

        const flags = doc.flags?.[MOD_TERR] || {};
        if (!isTerritoryHexDoc(doc)) return null;

        const label = flags.name || doc.text || doc.name || "(unnamed)";
        const key   = extractTerrainKeyFromFlags(flags);

        const conditions = doc.getFlag?.(MOD_TERR, "conditions") ?? flags.conditions ?? [];
        const mods       = doc.getFlag?.(MOD_TERR, "mods")       ?? flags.mods       ?? {};
        const weather    = doc.getFlag?.(MOD_TERR, "weather")    ?? flags.weather    ?? null;

        return {
          id:   p.id,
          uuid: doc.uuid,
          label,
          terrainKey: String(key),
          terrainType: flags.terrainType || (flags.terrain?.key ?? "") || "",
          travelUnits: Number(flags.travelUnits || 1),
          hexType: flags.type || "",
          status:  flags.status || "",
          owner:   flags.factionId || "",
          conditions,
          mods,
          weather
        };
      })
      .filter(Boolean);
  }

  async function getGateAdjacency(hex, factionId) {
    try {
      const api = game.bbttcc?.api?.territory?.leylines;
      if (!api?.resolveRemoteAdjacency) return [];
      const res = await api.resolveRemoteAdjacency({ hexUuid: hex.uuid, factionId });
      if (!res?.ok || !Array.isArray(res.links)) return [];
      return res.links.map(l => ({
        toUuid: l.toUuid,
        strength: Number(l.strength || 0.5),
        kind: "gate"
      }));
    } catch (e) {
      console.warn(TAG, "gate adjacency failed (non-fatal):", e);
      return [];
    }
  }


  function hazardForHex(hex) {
    if (!hex) return null;
    const key = String(hex.terrainKey || "").toLowerCase();
    const conds = (Array.isArray(hex.conditions) ? hex.conditions : []).map(c => String(c || "").toLowerCase());
    const mods  = hex.mods || {};
    const hasRadiationCond = conds.includes("radiated") || conds.includes("contaminated");
    const hasRadMod        = Number(mods.radiation || 0) > 0;

    if (key === "wasteland" || key === "radiation" || hasRadiationCond || hasRadMod) {
      return { type:"radiation", icon:"☢", label:"Radiation" };
    }
    if (["desert","ashwastes","ocean","sea","swamp","mire","mountains","highlands","canyons","badlands"].includes(key)) {
      return { type:"terrain", icon:"⚠", label:"Harsh Terrain" };
    }
    if (["ruins","urbanwreckage","river","lake"].includes(key)) {
      return { type:"unstable", icon:"🏚", label:"Unstable" };
    }
    return null;
  }

  function weatherForHex(hex) {
    const w = hex?.weather;
    if (!w || typeof w !== "object") return null;
    const key = w.key ? String(w.key) : null;
    const label = w.label ? String(w.label) : (key || "Weather");
    const remainingTurns = Number(w.remainingTurns ?? 0);
    return { key, label, remainingTurns };
  }

  async function setHoverHex(id) {
    const layer = canvas?.foreground ?? canvas?.stage;
    if (!layer) return;
    const NAME = "bbttcc-travel-hover";
    const existing = layer.getChildByName?.(NAME);
    if (!id) {
      if (existing) existing.destroy({ children:true });
      return;
    }
    try {
      const d = canvas.drawings.get(id);
      if (!d) return;
      if (existing) existing.destroy({ children:true });
      const c = new PIXI.Container();
      c.name = NAME;
      const g = new PIXI.Graphics();
      g.lineStyle(4, 0xf97316, 0.9);
      g.drawCircle(d.center.x, d.center.y, 40);
      c.addChild(g);
      layer.addChild(c);
    } catch (e) {
      console.warn(TAG, "setHoverHex failed:", e);
    }
  }

  function buildArcStepContext(destHex, legIndex) {
    if (!destHex) return null;

    const terrainKey = String(destHex.terrainKey || "").toLowerCase() || "plains";
    const conds = Array.isArray(destHex.conditions)
      ? destHex.conditions.map(c => String(c || "").toLowerCase())
      : [];
    const mods  = destHex.mods || {};

    const hasRoad =
      conds.includes("road") ||
      conds.includes("trail") ||
      conds.includes("highway") ||
      Boolean(mods.road || mods.trail);

    const scene = canvas?.scene;
    const regionHeat = Number(scene?.getFlag?.(MOD_TERR, "regionHeat") ?? 0) || 0;
    const darkness   = Number(scene?.getFlag?.(MOD_TERR, "darkness")   ?? 0) || 0;

    let hexDoc = null;
    try {
      const obj = canvas?.drawings?.get?.(destHex.id);
      hexDoc = obj?.document || null;
    } catch (_e) {}

    return {
      terrain: terrainKey,
      hasRoad,
      regionHeat,
      darkness,
      stepsOnRoute: legIndex + 1,
      hexId: destHex.id,
      hexUuid: destHex.uuid,
      hexDoc
    };
  }

  function pickTokenForFaction(factionId) {
    try {
      const controlled = canvas?.tokens?.controlled || [];
      if (controlled.length) {
        const t = controlled[0];
        if (t?.actor?.id === factionId) return t;
      }
      const all = canvas?.tokens?.placeables || [];
      return all.find(t => t?.actor?.id === factionId) || null;
    } catch (e) {
      console.warn(TAG, "pickTokenForFaction failed:", e);
      return null;
    }
  }

  function normalizeEncounter(encLike) {
    if (!encLike || typeof encLike !== "object") return null;

    const tier = Number(encLike.tier ?? encLike.result?.tier ?? 1) || 1;
    const key  = encLike.key ?? encLike.result?.key ?? null;
    const label = encLike.label ?? encLike.result?.label ?? key ?? null;

    // Preserve enrichment fields (beat-authored travel encounters)
    const beatId = encLike.beatId ?? encLike.result?.beatId ?? null;
    const campaignId = encLike.campaignId ?? encLike.result?.campaignId ?? null;
    const meta = encLike.meta ?? encLike.result?.meta ?? null;

    return {
      // keep any extra fields the launcher may need
      ...encLike,
      triggered: !!encLike.triggered,
      tier,
      key,
      label,
      beatId,
      campaignId,
      meta,
      result: { key, label, tier, beatId, campaignId }
    };
  }



  async function emitAfterTravelWithEncounter(baseCtx, encounter, fromHexUuid, toHexUuid, token) {
    try {
      const resolve = (globalThis.fromUuid && typeof globalThis.fromUuid === "function")
        ? globalThis.fromUuid
        : (foundry?.utils?.fromUuid && typeof foundry.utils.fromUuid === "function")
          ? foundry.utils.fromUuid
          : null;

      const actor = baseCtx?.actor || (baseCtx?.factionId ? game.actors.get(baseCtx.factionId) : null);
      const fromObj = (resolve && fromHexUuid) ? await resolve(fromHexUuid).catch(() => null) : null;
      const toObj   = (resolve && toHexUuid)   ? await resolve(toHexUuid).catch(() => null)   : null;

      const ctx = {
        ...(baseCtx || {}),
        source: baseCtx?.source || "travel-console",
        actor,
        from: { ...(baseCtx?.from || {}), uuid: fromHexUuid, obj: fromObj },
        to:   { ...(baseCtx?.to   || {}), uuid: toHexUuid,   obj: toObj },
        token: token?.document ?? token ?? null,
        encounter
      };

      Hooks.callAll("bbttcc:afterTravel", ctx);
      console.log(TAG, "Emitted bbttcc:afterTravel with encounter payload", encounter);
    } catch (e) {
      console.warn(TAG, "emitAfterTravelWithEncounter failed:", e);
    }
  }

  class BBTTCC_TravelConsole extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "bbttcc-travel-console",
        title: "BBTTCC: Travel Console",
        template: "templates/app-window.html",
        width: 780,
        height: 560,
        resizable: true,
        classes: ["bbttcc","bbttcc-travel-console","themed","theme-dark"]
      });
    }

    async getData() {
      return {
        appId: this.appId,
        classes: this.options.classes?.join(" ") ?? "",
        window: { title: this.title }
      };
    }

    activateListeners(html) {
      super.activateListeners(html);
      const root    = html?.[0];
      const content = root?.querySelector?.(".window-content");
      if (!content) return;

      const dict  = terrainDict();
      const hexes = getHexesOnScene();

      content.innerHTML = `
        <div class="bbttcc-travel-root">
          <style>
            .bbttcc-travel-console .window-content {
              padding: 0;
              color: #e5e7eb;
              background:
                radial-gradient(circle at 0 0, rgba(148,163,184,0.18), transparent 55%),
                radial-gradient(circle at 100% 0, rgba(56,189,248,0.18), transparent 55%),
                radial-gradient(circle at 0 100%, rgba(147,51,234,0.18), transparent 60%),
                linear-gradient(145deg, rgba(15,23,42,0.98), rgba(15,23,42,0.96));
            }
            .bbttcc-travel-root {
              padding: 0.75rem 0.9rem 1rem;
              font-family: Helvetica, Arial, sans-serif;
              color: #e5e7eb;
              max-width: 1120px;
              box-sizing: border-box;
              margin: 0 auto;
            }
            .bbttcc-travel-grid {
              display: grid;
              grid-template-columns: minmax(0, 1.8fr) minmax(0, 1.4fr);
              gap: 0.75rem;
              align-items: flex-start;
            }
            .tc-panel {
              background:
                radial-gradient(circle at 0 0, rgba(30,64,175,0.24), transparent 60%),
                radial-gradient(circle at 100% 100%, rgba(147,51,234,0.24), transparent 55%),
                linear-gradient(160deg, rgba(15,23,42,0.98), rgba(15,23,42,1));
              border-radius: 0.7rem;
              border: 1px solid rgba(30,64,175,0.9);
              box-shadow:
                0 0 0 1px rgba(15,23,42,0.9),
                0 8px 18px rgba(15,23,42,0.9);
              padding: 0.75rem 0.85rem 0.95rem;
            }
            .tc-panel-header {
              font-weight: 700;
              margin-bottom: 0.25rem;
              font-size: 0.9rem;
              letter-spacing: 0.12em;
              text-transform: uppercase;
            }
            .tc-sub { font-size: 0.78rem; opacity: 0.85; }
            .bbttcc-travel-field {
              margin-top: 0.6rem;
              display: flex;
              flex-direction: column;
              gap: 0.25rem;
            }
            .bbttcc-travel-field label {
              font-size: 0.78rem;
              font-weight: 600;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: #cbd5f5;
            }
            .bbttcc-travel-select,
            .bbttcc-travel-button {
              padding: 0.25rem 0.5rem;
              border-radius: 0.4rem;
              border: 1px solid rgba(31,41,55,0.8);
              font-size: 0.85rem;
              background: rgba(15,23,42,0.9);
              color: #e5e7eb;
            }
            .bbttcc-travel-select:focus,
            .bbttcc-travel-button:focus {
              outline: none;
              border-color: rgba(59,130,246,0.9);
              box-shadow: 0 0 0 1px rgba(59,130,246,0.7);
            }
            .bbttcc-travel-button {
              cursor: pointer;
              background:
                radial-gradient(circle at 0 0, rgba(148,163,184,0.4), transparent 55%),
                linear-gradient(135deg, rgba(30,64,175,0.96), rgba(15,23,42,0.96));
              border-color: rgba(148,163,184,0.9);
            }
            .bbttcc-travel-button:hover { filter: brightness(1.04); }
            .bbttcc-travel-actions {
              display: flex;
              gap: 0.4rem;
              flex-wrap: wrap;
              align-items: center;
            }
            .rp-legs {
              margin-top: 0.55rem;
              max-height: 240px;
              overflow: auto;
              border-radius: 0.5rem;
              border: 1px solid rgba(30,64,175,0.9);
              background: rgba(15,23,42,0.95);
            }
            .rp-leg-row {
              display: flex;
              gap: 0.45rem;
              align-items: center;
              padding: 0.25rem 0.55rem;
              border-bottom: 1px solid rgba(30,64,175,0.55);
              font-size: 0.8rem;
              cursor: pointer;
            }
            .rp-leg-row:last-child { border-bottom: none; }
            .rp-leg-row:hover { background: rgba(30,64,175,0.45); }
            .rp-leg-idx {
              font-size: 0.75rem;
              opacity: 0.7;
              width: 1.2rem;
              text-align: right;
            }
            .rp-leg-main { flex: 1; }
            .rp-leg-terrain { opacity: 0.85; font-size: 0.76rem; }
            .rp-leg-cost { font-size: 0.78rem; opacity: 0.9; white-space: nowrap; }
            .rp-leg-remove {
              padding: 0.1rem 0.4rem;
              border-radius: 999px;
              border: 1px solid rgba(148,163,184,0.9);
              background: rgba(15,23,42,0.95);
              cursor: pointer;
              font-size: 0.7rem;
              color: #e5e7eb;
            }
            .rp-leg-remove:hover {
              background: rgba(248,113,113,0.2);
              border-color: rgba(220,38,38,0.9);
            }
            .rp-hazard {
              margin-left: 0.35rem;
              font-size: 0.72rem;
              padding: 2px 6px;
              border-radius: 999px;
              border: 1px solid #f97316;
              color: #fed7aa;
              background: #111827;
              display: inline-flex;
              align-items: center;
              gap: 0.25rem;
            }
            .rp-hazard[data-type="radiation"] { border-color: #b91c1c; color: #fee2e2; background: #111827; }
            .rp-hazard[data-type="unstable"]  { border-color: #4b5563; color: #e5e7eb; background: #020617; }

            .rp-weather {
              margin-left: 0.35rem;
              font-size: 0.72rem;
              padding: 2px 6px;
              border-radius: 999px;
              border: 1px solid rgba(56,189,248,0.9);
              color: #bae6fd;
              background: #0b1220;
              display: inline-flex;
              align-items: center;
              gap: 0.25rem;
            }

            .tc-summary-chip {
              display: inline-flex;
              align-items: center;
              border-radius: 999px;
              padding: 2px 8px;
              font-size: 0.78rem;
              border: 1px solid rgba(148,163,184,0.9);
              background: rgba(15,23,42,0.96);
              color: #e5e7eb;
            }
            .tc-summary-row {
              display: flex;
              flex-wrap: wrap;
              gap: 0.4rem;
              align-items: center;
              margin-top: 0.4rem;
            }
            .tc-summary-label {
              font-size: 0.78rem;
              font-weight: 600;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              color: #cbd5f5;
            }
            .rp-out {
              font-size: 0.8rem;
              margin-top: 0.4rem;
              background: rgba(15,23,42,0.96);
              color: #f9fafb;
              border-radius: 0.4rem;
              padding: 0.3rem 0.5rem;
              border: 1px solid rgba(30,64,175,0.85);
              white-space: pre-line;
            }
            .bbttcc-travel-console .rad-tier-none   { background: rgba(15,23,42,0.96); border-color: rgba(148,163,184,0.9); color:#e5e7eb; }
            .bbttcc-travel-console .rad-tier-low    { background: rgba(22,163,74,0.12);  border-color: rgba(22,163,74,0.9);  color:#bbf7d0; }
            .bbttcc-travel-console .rad-tier-moderate{background: rgba(234,179,8,0.16);  border-color: rgba(202,138,4,0.95); color:#facc15; }
            .bbttcc-travel-console .rad-tier-high   { background: rgba(249,115,22,0.16); border-color: rgba(234,88,12,0.95); color:#fed7aa; }
            .bbttcc-travel-console .rad-tier-extreme{ background: rgba(220,38,38,0.18);  border-color: rgba(185,28,28,0.98); color:#fecaca; }
            .tc-right-buttons { display:flex; flex-wrap:wrap; gap:0.4rem; margin-top:0.6rem; }
            .tc-right-buttons .bbttcc-travel-button.primary {
              background:
                radial-gradient(circle at 0 0, rgba(56,189,248,0.5), transparent 55%),
                linear-gradient(135deg,#4f46e5,#0ea5e9);
              color:#f9fafb;
              border-color:rgba(59,130,246,0.95);
            }
            .tc-right-buttons .bbttcc-travel-button.primary:hover { filter:brightness(1.06); }
          </style>

          <div class="bbttcc-travel-grid">
            <section class="tc-panel tc-left">
              <div class="tc-panel-header">Travel Route Builder</div>
              <div class="tc-sub">Plan legs between hexes, then execute via the faction’s OP pool.</div>

              <div class="bbttcc-travel-field">
                <label>Faction</label>
                <select data-role="faction" class="bbttcc-travel-select"></select>
              </div>

              <div class="bbttcc-travel-field" style="margin-top:0.6rem;">
                <label>Route Planner</label>
                <div class="bbttcc-travel-actions">
                  <select data-role="rp-from" class="bbttcc-travel-select"></select>
                  <span>→</span>
                  <select data-role="rp-to" class="bbttcc-travel-select"></select>
                  <button type="button" data-action="rp-add" class="bbttcc-travel-button">Add Leg</button>
                  <button type="button" data-action="rp-clear" class="bbttcc-travel-button">Clear</button>
                </div>
              </div>

              <div class="rp-legs"></div>
            </section>

            <section class="tc-panel tc-right">
              <div class="tc-panel-header">Route Summary</div>
              <div class="tc-sub">OP costs, environmental hazards, projected radiation, and arc events.</div>

              <div class="bbttcc-travel-field">
                <div class="tc-summary-label">Organization Points</div>
                <div class="tc-summary-row">
                  <span class="tc-summary-chip rp-est">No legs</span>
                </div>
              </div>

              <div class="bbttcc-travel-field">
                <div class="tc-summary-label">Radiation Exposure</div>
                <div class="tc-summary-row">
                  <span class="tc-summary-chip rp-rad rad-tier-none">Radiation: —</span>
                </div>
              </div>

              <div class="bbttcc-travel-field">
                <div class="tc-summary-label">Weather</div>
                <div class="tc-summary-row">
                  <span class="tc-summary-chip rp-weather-sum">Weather: —</span>
                </div>
              </div>

              <div class="tc-right-buttons">
                <button type="button" data-action="rp-reverse" class="bbttcc-travel-button">⤵ Reverse Route</button>
                <button type="button" data-action="rp-exec" class="bbttcc-travel-button primary">▶ Execute Route</button>
              </div>

              <div class="rp-out"></div>
            </section>
          </div>
        </div>`;

      const factions = Array.from(game.actors ?? [])
        .filter(a => a?.getFlag?.(MOD_FCT,"isFaction") || a?.flags?.[MOD_FCT]?.isFaction)
        .map(a => ({ id:a.id, name:a.name }));

      const $fac  = content.querySelector('[data-role="faction"]');
      const $rf   = content.querySelector('[data-role="rp-from"]');
      const $rt   = content.querySelector('[data-role="rp-to"]');
      const $legs = content.querySelector(".rp-legs");
      const $est  = content.querySelector(".rp-est");
      const $rad  = content.querySelector(".rp-rad");
      const $wsum = content.querySelector(".rp-weather-sum");
      const $rout = content.querySelector(".rp-out");

      $fac.innerHTML = factions.map(f => `<option value="${f.id}">${enc(f.name)}</option>`).join("");

      const hexOpts = hexes.map(h => `<option value="${h.uuid}">${enc(h.label)}</option>`).join("");
      $rf.innerHTML = `<option value="">[From]</option>${hexOpts}`;
      $rt.innerHTML = `<option value="">[To]</option>${hexOpts}`;

      const legs = []; // {fromUuid, toUuid, fromId, toId, gate?}

      function refreshHexWeatherSnapshot(hexId) {
        try {
          const obj = canvas?.drawings?.get?.(hexId);
          const doc = obj?.document;
          if (!doc) return null;
          return doc.getFlag?.(MOD_TERR, "weather") ?? null;
        } catch (_e) {
          return null;
        }
      }

      function recomputeWeatherSummary() {
        if (!$wsum) return;
        if (!legs.length) {
          $wsum.textContent = "Weather: —";
          $wsum.title = "";
          return;
        }
        const nextLeg = legs[0];
        const t = hexes.find(h => h.id === nextLeg.toId);
        const w = weatherForHex(t);
        if (!w) {
          $wsum.textContent = "Weather: —";
          $wsum.title = "No active weather on next destination hex.";
          return;
        }
        const turns = Number.isFinite(w.remainingTurns) ? w.remainingTurns : null;
        $wsum.textContent = `☁ ${w.label}${turns!=null ? ` (${turns})` : ""}`;
        $wsum.title = `Next leg weather: ${w.label}${turns!=null ? ` • ${turns} turn(s) remaining` : ""}`;
      }

      function recomputeRadiation() {
        if (!$rad) return;
        if (!legs.length) {
          $rad.textContent = "Radiation: —";
          $rad.className = "tc-summary-chip rp-rad rad-tier-none";
          return;
        }

        let totalRad = 0;
        for (const L of legs) {
          const h = hexes.find(h => h.id === L.toId);
          if (!h) continue;
          const terr = String(h.terrainKey || "").toLowerCase();
          const conds = Array.isArray(h.conditions) ? h.conditions : [];
          const mods  = h.mods || {};
          if (terr === "wasteland" || terr === "radiation") totalRad += 1;
          if (conds.includes("Radiated"))     totalRad += 1;
          if (conds.includes("Contaminated")) totalRad += 1;
          const val = Number(mods.radiation || 0);
          if (val > 0) totalRad += val;
        }

        try {
          const radApi = game.bbttcc?.api?.radiation;
          const zone   = radApi?.zone?.getScene?.();
          if (zone && zone.intensity) {
            const key = String(zone.intensity).toLowerCase();
            let perLeg = 0;
            if (key === "low")      perLeg = 0.5;
            else if (key === "moderate") perLeg = 1;
            else if (key === "high")     perLeg = 2;
            else if (key === "storm")    perLeg = 3;
            if (perLeg > 0) totalRad += perLeg * legs.length;
          }
        } catch (e) {
          console.warn(TAG, "Radiation preview failed:", e);
        }

        const approx = totalRad;
        let tier = "none";
        if      (approx > 10) tier = "extreme";
        else if (approx > 5)  tier = "high";
        else if (approx > 2)  tier = "moderate";
        else if (approx > 0.5)tier = "low";

        $rad.textContent =
          `Radiation: ~+${approx.toFixed(1)} RP` +
          (tier !== "none" ? ` (${tier[0].toUpperCase()}${tier.slice(1)})` : "");
        $rad.className = `tc-summary-chip rp-rad rad-tier-${tier}`;
      }

      function render() {
        const rows = legs.map((L, i) => {
          const f = hexes.find(h => h.id === L.fromId);
          const t = hexes.find(h => h.id === L.toId);

          // Pull latest weather flags for the destination (planning-time visibility)
          const latest = refreshHexWeatherSnapshot(L.toId);
          if (t && latest) t.weather = latest;

          const terrKey = normTerrKey(t?.terrainKey || "");
          const terrInfo = dict[normTerrKey(terrKey)] || {};
          let cost = foundry.utils.duplicate(terrInfo.cost || {});
          let costLabel = opToStr(cost) || "—";

          if (L.gate && L.gate.strength != null) {
            const mult = Math.max(0, 1 - (0.4 * Number(L.gate.strength || 0.5)));
            for (const k of Object.keys(cost)) {
              cost[k] = Math.max(0, Math.round(Number(cost[k] || 0) * mult));
            }
            costLabel = `🜂 Ley Gate • ${opToStr(cost) || "—"}`;
          }
          const hazard   = hazardForHex(t);

          const hazardHtml = hazard
            ? `<span class="rp-hazard" data-type="${hazard.type}">
                 <span>${hazard.icon}</span><span>${enc(hazard.label)}</span>
               </span>`
            : "";

          const w = weatherForHex(t);
          const weatherHtml = w
            ? `<span class="rp-weather" title="Weather: ${enc(w.label)}${Number.isFinite(w.remainingTurns) ? ` • ${w.remainingTurns} turn(s)` : ""}">
                 <span>☁</span><span>${enc(w.label)}${Number.isFinite(w.remainingTurns) ? ` (${w.remainingTurns})` : ""}</span>
               </span>`
            : "";

          return `<div class="rp-leg-row" data-index="${i}" data-to-id="${enc(L.toId)}" data-to-uuid="${enc(L.toUuid)}">
            <span class="rp-leg-idx">${i + 1}.</span>
            <div class="rp-leg-main">
              <div>${enc(f?.label)} → ${enc(t?.label)}</div>
              <div class="rp-leg-terrain">
                [${enc(terrInfo.label || terrKey || "Unknown")}]
                ${hazardHtml}
                ${weatherHtml}
              </div>
            </div>
            <div class="rp-leg-cost">${enc(costLabel)}</div>
            <button type="button" class="rp-leg-remove" data-i="${i}">✕</button>
          </div>`;
        }).join("");

        $legs.innerHTML = rows ||
          `<div style="padding:.5rem;font-size:.82rem;opacity:.8;">No legs added yet. Pick From/To hexes and click <b>Add Leg</b>.</div>`;

        const totalOP = {};
        for (const L of legs) {
          const t = hexes.find(h => h.id === L.toId);
          const terrKey = normTerrKey(t?.terrainKey || "");
          const terrInfo = dict[normTerrKey(terrKey)] || {};
          const cost = foundry.utils.duplicate(terrInfo.cost || {});

          if (L.gate && L.gate.strength != null) {
            const mult = Math.max(0, 1 - (0.4 * Number(L.gate.strength || 0.5)));
            for (const k of Object.keys(cost)) {
              cost[k] = Math.max(0, Math.round(Number(cost[k] || 0) * mult));
            }
          }

          for (const [k, v] of Object.entries(cost)) {
            const kk = String(k).toLowerCase();
            totalOP[kk] = (totalOP[kk] || 0) + Number(v || 0);
          }
        }

        let totalUnits = 0;
        for (const L of legs) {
          const t = hexes.find(h => h.id === L.toId);
          totalUnits += Number(t?.travelUnits || 1);
        }
        const milesPerUnit = Number(canvas?.scene?.grid?.distance || 0);
        const milesUnits   = String(canvas?.scene?.grid?.units || "");
        const totalMiles   = milesPerUnit ? (totalUnits * milesPerUnit) : null;

        const baseLabel = legs.length
          ? `Legs: ${legs.length} • Units: ${totalUnits}${totalMiles!=null ? ` • Miles: ${totalMiles} ${milesUnits}` : ""} • Est. OP: ${opToStr(totalOP) || "—"}`
          : "No legs";

        $est.textContent = baseLabel;

        (async () => {
          try {
            if (!game.bbttcc?.api?.op?.preview) return;
            const factionId = $fac.value;
            if (!factionId || !legs.length) return;

            const deltasRaw = {};
            for (const k of OP_KEYS) {
              const v = Number(totalOP[k] || 0);
              if (!v) continue;
              deltasRaw[k] = -v;
            }
            const deltas = normalizeDeltas(deltasRaw);
            if (!Object.values(deltas).some(v => v)) return;

            const preview = await game.bbttcc.api.op.preview(factionId, deltas, "travel-route");
            if (!preview) return;

            if (preview.ok) {
              const afterStr = opToStr(preview.after);
              $est.textContent = `${baseLabel} • After: ${afterStr || "(all zero)"}`;
            } else {
              const missing = Object.entries(preview.underflow || {})
                .map(([k, info]) => `${opLabel(k)} ${Math.abs(info.after)}`)
                .join(", ");
              $est.textContent = `${baseLabel} • Not enough OP${missing ? ` (short: ${missing})` : ""}`;
            }
          } catch (e) {
            console.warn(TAG, "OP preview failed in Travel Console", e);
          }
        })();

        recomputeRadiation();
        recomputeWeatherSummary();

        $legs.querySelectorAll(".rp-leg-remove").forEach(btn => {
          btn.onclick = () => {
            const idx = Number(btn.dataset.i || "-1");
            if (idx >= 0 && idx < legs.length) {
              legs.splice(idx, 1);
              render();
            }
          };
        });

        $legs.querySelectorAll(".rp-leg-row").forEach(row => {
          const toId = row.dataset.toId || null;
          row.addEventListener("mouseenter", () => { if (toId) setHoverHex(toId); });
          row.addEventListener("mouseleave", () => { setHoverHex(null); });
        });
      }

      content.querySelector('[data-action="rp-add"]').onclick = async () => {
        const fUuid = $rf.value;
        const tUuid = $rt.value;
        if (!fUuid || !tUuid) { $rout.textContent = "Pick both hexes first."; return; }
        if (fUuid === tUuid)  { $rout.textContent = "From/To must differ."; return; }

        const fromHex = hexes.find(h => h.uuid === fUuid);
        const toHex   = hexes.find(h => h.uuid === tUuid);
        if (!fromHex || !toHex) { $rout.textContent = "Hex not found on this scene."; return; }

        const factionId = $fac.value || null;

        // Check for ley gate adjacency (origin → destination)
        let usedGate = false;
        let gateStrength = 0;

        if (factionId) {
          const gates = await getGateAdjacency(fromHex, factionId);
          const match = gates.find(g => String(g.toUuid) === String(toHex.uuid));
          if (match) {
            usedGate = true;
            gateStrength = Number(match.strength || 0.5);
          }
        }

        legs.push({
          fromUuid: fUuid,
          toUuid: tUuid,
          fromId: fromHex.id,
          toId: toHex.id,
          gate: usedGate ? { strength: gateStrength } : null
        });

        render();
      };

      content.querySelector('[data-action="rp-clear"]').onclick = () => {
        legs.length = 0;
        render();
        $rout.textContent = "";
      };

      content.querySelector('[data-action="rp-reverse"]').onclick = () => {
        if (legs.length < 1) return;
        const ids = [];
        ids.push(legs[0].fromId);
        for (const leg of legs) ids.push(leg.toId);
        ids.reverse();

        const newLegs = [];
        for (let i = 0; i < ids.length - 1; i++) {
          const fromId = ids[i];
          const toId   = ids[i + 1];
          const fromHex = hexes.find(h => h.id === fromId);
          const toHex   = hexes.find(h => h.id === toId);
          if (!fromHex || !toHex) continue;
          newLegs.push({ fromUuid: fromHex.uuid, toUuid: toHex.uuid, fromId, toId, gate: null });
        }
        legs.length = 0;
        legs.push(...newLegs);
        render();
      };

      content.querySelector('[data-action="rp-exec"]').onclick = async () => {
        try {
          const factionId = $fac.value;
          if (!factionId) { $rout.textContent = "Pick a faction first."; return; }
          if (!legs.length) { $rout.textContent = "Add at least one leg."; return; }

          // GM travel cost + encounter controls (manual overrides)
          // - costMult: multiply OP costs for each leg (after terrain/gate discounts)
          // - costAdd:  additive deltas per OP type (positive/negative)
          // - encounterPolicy: "auto" | "prompt" | "skip"
          let gmOverrides = { costMult: 1, costAdd: {}, encounterPolicy: "auto" };

          if (game.user?.isGM) {
            gmOverrides = await new Promise((resolve) => {
              const fields = OP_KEYS.map(k => {
                const lab = opLabel(k);
                return `<label style="display:flex;justify-content:space-between;gap:.5rem;align-items:center;margin:2px 0;">
                  <span style="opacity:.9;">${enc(lab)}</span>
                  <input type="number" data-op="${enc(k)}" value="0" step="1" style="width:80px;"/>
                </label>`;
              }).join("");

              const html = `
                <div style="font:13px Helvetica; line-height:1.35;">
                  <div style="margin-bottom:.4rem; opacity:.9;">
                    <b>GM Travel Overrides</b><br/>
                    Apply a discount/surcharge to OP costs, and decide how to handle encounters for this execution.
                  </div>

                  <label style="display:flex;justify-content:space-between;gap:.5rem;align-items:center;margin:6px 0;">
                    <span><b>Cost Multiplier</b> (1.00 = normal)</span>
                    <input type="number" step="0.05" min="0.10" value="1.00" data-role="costMult" style="width:90px;"/>
                  </label>

                  <details style="margin:6px 0;">
                    <summary style="cursor:pointer;">Add / Subtract OP (optional)</summary>
                    <div style="margin-top:6px; padding:6px; border:1px solid rgba(148,163,184,0.35); border-radius:8px;">
                      ${fields}
                      <div style="margin-top:6px; font-size:12px; opacity:.8;">Use negatives to reduce cost further (e.g. -1 Logistics).</div>
                    </div>
                  </details>

                  <label style="display:flex; gap:.5rem; align-items:center; margin:6px 0;">
                    <input type="radio" name="encPolicy" value="auto" checked/>
                    <span>Encounters: <b>Auto-launch</b> (default)</span>
                  </label>
                  <label style="display:flex; gap:.5rem; align-items:center; margin:6px 0;">
                    <input type="radio" name="encPolicy" value="prompt"/>
                    <span>Encounters: <b>Prompt GM</b> (Launch / Decline / Reroll)</span>
                  </label>
                  <label style="display:flex; gap:.5rem; align-items:center; margin:6px 0;">
                    <input type="radio" name="encPolicy" value="skip"/>
                    <span>Encounters: <b>Skip</b> (treat as declined)</span>
                  </label>
                </div>`;

              const d = new Dialog({
                title: "Travel Overrides",
                content: html,
                buttons: {
                  ok: {
                    label: "Apply",
                    callback: (htmlJQ) => {
                      const root = htmlJQ?.[0];
                      const cm = Number(root?.querySelector('[data-role="costMult"]')?.value || 1);
                      const costMult = (Number.isFinite(cm) && cm > 0) ? cm : 1;

                      const costAdd = {};
                      root?.querySelectorAll?.('input[data-op]')?.forEach?.((inp) => {
                        const k = String(inp.dataset.op || "").trim();
                        const v = Number(inp.value || 0);
                        if (!k) return;
                        if (!Number.isFinite(v) || v === 0) return;
                        costAdd[k] = Math.round(v);
                      });

                      const sel = root?.querySelector('input[name="encPolicy"]:checked');
                      const encounterPolicy = String(sel?.value || "auto");

                      resolve({ costMult, costAdd, encounterPolicy });
                    }
                  },
                  cancel: {
                    label: "No Override",
                    callback: () => resolve({ costMult: 1, costAdd: {}, encounterPolicy: "auto" })
                  }
                },
                default: "ok",
                close: () => resolve({ costMult: 1, costAdd: {}, encounterPolicy: "auto" })
              });
              d.render(true);
            });
          }


          const token = pickTokenForFaction(factionId);
          const tokenId = token?.id || null;
          const sceneId = canvas?.scene?.id || null;

          const arcApi = game.bbttcc?.api?.travel?.arc;
          const arcEvents = [];
          const out = [];

          for (let i = 0; i < legs.length; i++) {
            const L = legs[i];
            const destHex = hexes.find(h => h.id === L.toId);
            const destLabel = destHex?.label || "(unknown hex)";
            const stepCtx = buildArcStepContext(destHex, i);

            // Arc preview (await)
            try {
              if (arcApi?.rollStep && stepCtx) {
                const arcResult = await arcApi.rollStep(stepCtx);
                arcEvents.push({ index: i + 1, toLabel: destLabel, ctx: stepCtx, result: arcResult });
                // refresh weather immediately
                const latest = refreshHexWeatherSnapshot(L.toId);
                if (destHex && latest) destHex.weather = latest;
                render();
              }
            } catch (arcErr) {
              console.warn(TAG, "Travel Arc roll failed for leg", i + 1, arcErr);
            }

            const r = await game.bbttcc.api.travel.travelHex({ factionId, hexFrom: L.fromUuid, hexTo: L.toUuid, tokenId, sceneId, source: "travel-console", terrainKey: (destHex?.terrainKey || null), timePoints: Number(destHex?.travelUnits || 1), costMult: gmOverrides.costMult, costAdd: gmOverrides.costAdd, encounterPolicy: gmOverrides.encounterPolicy });

            out.push(`${i + 1}) ${r?.summary || (r?.ok ? "Travel OK" : "Travel failed")}`);
            if (!r?.ok) break;

            let enc = r?.encounter;
            if (enc?.triggered) {
              const executedUuids = legs.slice(0, i + 1).map(x => x.toUuid).filter(Boolean);
              const remaining = legs.slice(i + 1);
              legs.length = 0; legs.push(...remaining);
              render();

              let msg = out.join("\n");
              const encLabel = enc?.label || enc?.key || `Encounter (Tier ${Number(r?.terrainTier ?? 1) || 1})`;
              msg += `\n\nRoute paused after ${encLabel} at ${destLabel}.\nRemaining legs kept in the planner — edit them or click Execute Route again to resume.`;
              $rout.textContent = msg;

              const encNorm = normalizeEncounter(enc) || enc;
              // Encounters are emitted from the Travel Console (single source of truth).
              await emitAfterTravelWithEncounter(
                { ...r, factionId, actor: game.actors.get(factionId) || null, source: "travel-console" },
                encNorm, L.fromUuid, L.toUuid, token
              );
if (game.bbttcc?.runVisuals) {
                try {
                  await new Promise(r => setTimeout(r, 150));
                  await game.bbttcc.runVisuals(game.bbttcc.ui.travelConsole, { uuids: executedUuids, factionId, tokenId, sceneId });
                } catch (e) {
                  console.warn(TAG, "Visuals failed during encounter pause", e);
                }
              }
              return;
            }
          }

          if (game.bbttcc?.runVisuals) {
            await new Promise(r => setTimeout(r, 800));
            await game.bbttcc.runVisuals(game.bbttcc.ui.travelConsole);
          }

          legs.length = 0;
          render();

          let finalText = out[out.length - 1] || "Done.";
          $rout.textContent = finalText;
        } catch (e) {
          console.error(TAG, e);
          $rout.textContent = e?.message || "Error";
        }
      };

      render();
    }
  }

  globalThis.BBTTCC_TravelConsole = BBTTCC_TravelConsole;

  Hooks.once("ready", () => {
    game.bbttcc ??= { api: {} };
    game.bbttcc.ui ??= {};
    game.bbttcc.ui.travelConsole = new BBTTCC_TravelConsole();
    console.log(TAG, "ready.");
  });

  Hooks.on("canvasReady", () => {
    const id = "bbttcc-travel-console-btn";
    document.getElementById(id)?.remove();
    const btn = document.createElement("div");
    Object.assign(btn.style, {
      position: "absolute",
      top: "6px",
      right: "340px",
      zIndex: 200,
      background: "rgba(15,23,42,0.94)",
      color: "#f9fafb",
      padding: "6px 10px",
      borderRadius: "8px",
      cursor: "pointer",
      font: "12px Helvetica",
      boxShadow: "0 0 6px rgba(15,23,42,0.55)"
    });
    btn.id = id;
    btn.textContent = "Open Travel Console";
    btn.onclick = () => game.bbttcc.ui.travelConsole.render(true);
    document.body.appendChild(btn);
  });
})();

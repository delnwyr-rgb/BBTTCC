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

  // Costs are in MARKS (1 OP = 10 marks). Display as fractional OP.
  function _marksToOp(m) {
    const n = Number(m) || 0;
    const op = n / 10;
    return Number.isInteger(op) ? String(op) : op.toFixed(1);
  }
  function opToStr(cost) {
    const keys = Object.keys(cost || {});
    if (!keys.length) return "";
    return keys
      .filter(k => Number(cost[k] || 0) > 0)
      .map(k => `${_marksToOp(cost[k])} ${opLabel(k)}`)
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

  // Travel Engine v2 — Phase A: rich weather tooltip body.
  // Reads mechanical payload from the weather registry (exposed by
  // travel.weather.engine.js on ready) and formats it for the per-leg chip.
  // Returns plain text with newlines; Foundry's data-tooltip renders breaks.
  function _signed(n, suffix = "") {
    const v = Number(n) || 0;
    if (v === 0) return null;
    return `${v > 0 ? "+" : ""}${v}${suffix}`;
  }
  function weatherTooltip(weatherKey, label, remainingTurns) {
    const archetypes = game?.bbttcc?.api?.travel?.weather?.archetypes;
    const arch = archetypes && weatherKey ? archetypes[weatherKey] : null;
    const head = label || weatherKey || "Weather";

    if (!arch) {
      // Registry not loaded yet — fall back to the v1 thin tooltip.
      const turnLine = Number.isFinite(remainingTurns) && remainingTurns > 0
        ? ` • ${remainingTurns} turn(s) remaining` : "";
      return `${head}${turnLine}`;
    }

    const lines = [];
    // Headline
    let headline = head;
    if (Number.isFinite(remainingTurns) && remainingTurns > 0) {
      headline += ` — ${remainingTurns} turn(s) remaining`;
    }
    lines.push(headline);

    // Travel + radiation deltas
    const travelDelta = _signed(arch.travel?.opDelta, " OP");
    const radDelta = _signed(arch.radiation?.rpDelta, " RP");
    const onlyIfRadiated = !!arch.radiation?.onlyIfRadiated;
    const mechBits = [];
    if (travelDelta) mechBits.push(`Travel ${travelDelta}`);
    if (radDelta) mechBits.push(`Radiation ${radDelta}${onlyIfRadiated ? " (radiated hexes only)" : ""}`);
    if (mechBits.length) lines.push(mechBits.join(" · "));

    // Skill mods
    if (arch.skillMods && typeof arch.skillMods === "object") {
      const mods = Object.entries(arch.skillMods)
        .map(([k, v]) => {
          const s = _signed(v);
          return s ? `${k.charAt(0).toUpperCase() + k.slice(1)} ${s}` : null;
        })
        .filter(Boolean);
      if (mods.length) lines.push(`Skills: ${mods.join(", ")}`);
    }

    // Darkness check
    if (arch.darkness && arch.darkness.check) {
      const dc = Number(arch.darkness.dc) || 0;
      const onFail = _signed(arch.darkness.onFail);
      lines.push(`Darkness check DC ${dc}${onFail ? ` (fail: darkness ${onFail})` : ""}`);
    }

    // Encounter weight tilts
    if (arch.weights && typeof arch.weights === "object") {
      const tilts = Object.entries(arch.weights)
        .filter(([, v]) => Number.isFinite(Number(v)) && Number(v) !== 0)
        .map(([k, v]) => {
          const n = Number(v);
          const arrows = (n > 0 ? "↑" : "↓").repeat(Math.min(3, Math.abs(n)));
          return `${k} ${arrows}`;
        });
      if (tilts.length) lines.push(`Encounters: ${tilts.join(", ")}`);
    }

    // Tags as small footer
    if (Array.isArray(arch.tags) && arch.tags.length) {
      lines.push(`Tags: ${arch.tags.join(", ")}`);
    }

    return lines.join("\n");
  }

  // Travel Engine v2 — Phase B: vanguard roster + travel-bonus scan.
  // Today, "vanguard" === active faction's character roster. When Phase E
  // (multi-faction stacking) lands, getVanguardRoster() expands to the union
  // of stacked factions' rosters and the panel below extends without rework.
  function getVanguardRoster(factionIdOrIds) {
    // Phase B accepts a single id; Phase E1 expands to accept an array (lead +
    // joining passengers) so Vanguard Abilities + mitigation panels surface the
    // union of all member rosters without further plumbing.
    const ids = Array.isArray(factionIdOrIds)
      ? factionIdOrIds.filter(Boolean).map(String)
      : (factionIdOrIds ? [String(factionIdOrIds)] : []);
    if (!ids.length) return [];
    const idSet = new Set(ids);
    return Array.from(game.actors ?? []).filter(a => {
      if (!a) return false;
      // skip the faction actor itself; we only want character members
      if (a?.getFlag?.(MOD_FCT, "isFaction")) return false;
      const t = (foundry.utils.getProperty(a, "system.details.type.value") || "").toString().toLowerCase();
      if (t === "faction") return false;
      const flagId = a?.getFlag?.(MOD_FCT, "factionId") ?? a?.flags?.[MOD_FCT]?.factionId;
      return flagId && idSet.has(String(flagId));
    });
  }

  function scanTravelBonuses(roster) {
    const reg = game?.fourththing?._classAutomation?.CHAR_OPT_ABILITIES;
    if (!reg) return [];
    const out = [];
    for (const actor of roster || []) {
      for (const item of (actor.items?.contents ?? [])) {
        const id = item?.system?.identifier;
        if (!id) continue;
        const spec = reg[id];
        if (!spec) continue;
        // Single-ability shape with a top-level travel:true tag.
        if (spec.travel === true && !Array.isArray(spec.abilities)) {
          out.push({
            actor, item, key: id,
            label: spec.label || item.name,
            body: spec.body || "",
            mitigates: Array.isArray(spec.mitigates) ? spec.mitigates : [],
            vanguardMasks: Array.isArray(spec.vanguardMasks) ? spec.vanguardMasks : []
          });
        }
        // Multi-ability shape — surface only child rows tagged travel:true.
        if (Array.isArray(spec.abilities)) {
          for (const ab of spec.abilities) {
            if (ab?.travel === true) {
              out.push({
                actor, item, key: ab.key || id,
                label: ab.label || `${spec.label || item.name} — ${ab.key || ""}`,
                body: ab.body || spec.body || "",
                mitigates: Array.isArray(ab.mitigates) ? ab.mitigates : (Array.isArray(spec.mitigates) ? spec.mitigates : []),
                vanguardMasks: Array.isArray(ab.vanguardMasks) ? ab.vanguardMasks : (Array.isArray(spec.vanguardMasks) ? spec.vanguardMasks : [])
              });
            }
          }
        }
      }
    }
    return out;
  }

  // Travel Engine v2 — Phase C: weather mitigation matcher.
  // Returns the bonuses whose `mitigates` array intersects the weather
  // archetype's `tags`, plus any bonus that mitigates "weather" (catch-all).
  function findMitigationsForWeather(weatherKey, bonuses) {
    if (!weatherKey || !Array.isArray(bonuses) || !bonuses.length) return [];
    // Single source of truth: delegate the match to the engine's bridge so the forecast
    // display and the actual travel mitigation can never drift. Inline fallback below.
    const api = game?.bbttcc?.api?.travel?.mitigation;
    if (typeof api?.filterByWeather === "function") return api.filterByWeather(bonuses, weatherKey);
    const tags = Array.isArray(game?.bbttcc?.api?.travel?.weather?.archetypes?.[weatherKey]?.tags) ? game.bbttcc.api.travel.weather.archetypes[weatherKey].tags : [];
    return bonuses.filter(b => {
      const mit = b.mitigates || [];
      if (!mit.length) return false;
      if (mit.includes("weather")) return true;
      for (const t of tags) if (mit.includes(t)) return true;
      return false;
    });
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
      // Faction tokens in BBTTCC are commonly unlinked; for those, t.actor.id is
      // the SYNTHETIC actor id (per-token), while the world Actor id we want lives
      // at t.document.actorId. Check both so the resolver works for linked AND
      // unlinked faction tokens. See feedback_faction_gm_edit_world_actor.md.
      const matches = (t) => {
        if (!t || !factionId) return false;
        const linked = String(t?.actor?.id || "");
        const source = String(t?.document?.actorId || "");
        const fid    = String(factionId);
        return linked === fid || source === fid;
      };
      const controlled = canvas?.tokens?.controlled || [];
      if (controlled.length) {
        const t = controlled.find(matches);
        if (t) return t;
      }
      const all = canvas?.tokens?.placeables || [];
      return all.find(matches) || null;
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

  // ApplicationV2 + HandlebarsApplicationMixin — V14 canonical pattern.
  // Bare AppV1 (`extends Application`) doesn't get V14's drag/resize wiring;
  // V2 + HandlebarsApplicationMixin is what every working BBTTCC dialog
  // (BBTTCCRigConsole, Tree Wizard v2) uses, so we conform.
  const _ApplicationV2 = foundry.applications.api.ApplicationV2;
  const _HandlebarsApplicationMixin = foundry.applications.api.HandlebarsApplicationMixin;

  class BBTTCC_TravelConsole extends _HandlebarsApplicationMixin(_ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "bbttcc-travel-console",
      classes: ["bbttcc", "bbttcc-travel-console", "themed", "theme-dark"],
      window: {
        title: "BBTTCC: Travel Console",
        icon: "fas fa-route",
        resizable: true
      },
      position: { width: 920, height: 560 },
      // resizable mirrored at top level too — some V14 minor versions read it here.
      resizable: true
    };

    static PARTS = {
      body: { template: "modules/bbttcc-travel/templates/travel-console.hbs" }
    };

    async _prepareContext(options) {
      return {};
    }

    async _onRender(context, options) {
      await super._onRender(context, options);
      // The PARTS template renders <div class="bbttcc-travel-shell"></div> inside
      // .window-content. We treat that shell as the content container and inject
      // the same UI we used in the V1 path — keeps the rewrite minimal.
      const content = this.element?.querySelector?.(".bbttcc-travel-shell");
      if (!content) return;

      const dict  = terrainDict();
      const hexes = getHexesOnScene();

      content.innerHTML = `
        <div class="bbttcc-travel-root">
          <style>
            /* HexChrome / Wizard v2 palette: deep navy base, crystal-blue + gold accents.
               Layout copies the Faction Sheet's known-good pattern: minimal CSS on
               window-content, simple flex column on the root, no stretch-to-fill chains.
               If the user resizes the dialog much taller than content, that's standard
               Foundry sheet behavior — same as every other ActorSheet in the system. */
            .bbttcc-travel-console .window-content {
              color: #f4f0e0;
              background: linear-gradient(135deg, #0a1428 0%, #0d1e3a 50%, #0a1428 100%);
              /* Explicit overflow rules so resize+scroll works the moment the CSS lands,
                 not only after the global window-defaults enhancer fires its render hook. */
              overflow-y: auto;
              overflow-x: hidden;
              /* Zero out Foundry's default 8px so the inner root owns all spacing — keeps
                 the visible band between the title bar and the hero card tight. */
              padding: 0;
            }
            .bbttcc-travel-root {
              padding: 0.55rem 0.65rem 0.65rem;
              font-family: Helvetica, Arial, sans-serif;
              color: #f4f0e0;
              display: flex;
              flex-direction: column;
              gap: 0.65rem;
            }
            .bbttcc-travel-hero {
              border-radius: 12px;
              padding: 0.7rem 0.95rem;
              background: linear-gradient(90deg, rgba(255,215,80,0.12), rgba(95,168,255,0.10));
              border: 1px solid rgba(95,168,255,0.30);
              box-shadow: 0 0 0 1px rgba(10,20,40,0.6) inset;
            }
            .bbttcc-travel-hero-title {
              font-size: 1.05rem;
              font-weight: 700;
              letter-spacing: 0.10em;
              text-transform: uppercase;
              color: #ffd24a;
              margin: 0;
            }
            .bbttcc-travel-hero-sub {
              font-size: 0.82rem;
              color: rgba(244,240,224,0.72);
              margin-top: 0.2rem;
              line-height: 1.45;
            }
            .bbttcc-travel-grid {
              display: grid;
              grid-template-columns: minmax(0, 1.8fr) minmax(0, 1.4fr);
              gap: 0.85rem;
              align-items: flex-start;
            }
            .tc-panel {
              background: linear-gradient(180deg, rgba(20,35,65,0.55) 0%, rgba(20,35,65,0.30) 100%);
              border-radius: 12px;
              border: 1px solid rgba(95,168,255,0.28);
              box-shadow: 0 0 0 1px rgba(10,20,40,0.6) inset, 0 6px 16px rgba(5,10,25,0.45);
              padding: 0.85rem 1rem 1rem;
            }
            .tc-panel-header {
              font-weight: 700;
              margin-bottom: 0.15rem;
              font-size: 0.86rem;
              letter-spacing: 0.14em;
              text-transform: uppercase;
              color: #ffd24a;
            }
            .tc-sub { font-size: 0.78rem; color: rgba(244,240,224,0.65); margin-bottom: 0.5rem; }
            .bbttcc-travel-field {
              margin-top: 0.65rem;
              display: flex;
              flex-direction: column;
              gap: 0.3rem;
            }
            .bbttcc-travel-field label {
              font-size: 0.74rem;
              font-weight: 700;
              letter-spacing: 0.10em;
              text-transform: uppercase;
              color: rgba(95,168,255,0.85);
            }
            .bbttcc-travel-select,
            .bbttcc-travel-button {
              padding: 0.35rem 0.6rem;
              border-radius: 6px;
              border: 1px solid rgba(95,168,255,0.35);
              font-size: 0.85rem;
              background: rgba(20,35,65,0.5);
              color: #f4f0e0;
              transition: all 0.15s ease;
            }
            .bbttcc-travel-select:hover,
            .bbttcc-travel-button:hover {
              border-color: rgba(95,168,255,0.65);
              background: rgba(20,35,65,0.7);
            }
            .bbttcc-travel-select:focus,
            .bbttcc-travel-button:focus {
              outline: none;
              border-color: rgba(255,215,80,0.7);
              box-shadow: 0 0 0 2px rgba(255,215,80,0.18);
            }
            .bbttcc-travel-button {
              cursor: pointer;
              background: linear-gradient(135deg, rgba(95,168,255,0.14) 0%, rgba(20,35,65,0.65) 100%);
              padding: 0.4rem 0.85rem;
              border-radius: 999px;
              font-weight: 600;
              letter-spacing: 0.04em;
            }
            .bbttcc-travel-button:hover {
              background: linear-gradient(135deg, rgba(255,215,80,0.18) 0%, rgba(95,168,255,0.18) 100%);
            }
            .bbttcc-travel-actions {
              display: flex;
              gap: 0.45rem;
              flex-wrap: wrap;
              align-items: center;
            }
            /* Phase 2: pick-on-map + auto-plan controls */
            .bbttcc-travel-button.is-active {
              background: linear-gradient(135deg, rgba(255,215,80,0.42) 0%, rgba(95,168,255,0.36) 100%) !important;
              border-color: rgba(255,215,80,0.75) !important;
              color: #fff;
              box-shadow: 0 0 0 1px rgba(255,215,80,0.3), 0 0 12px rgba(255,215,80,0.18);
            }
            .rp-pick-status {
              display: none;
              margin-top: 0.45rem;
              padding: 0.4rem 0.6rem;
              border-radius: 6px;
              background: rgba(255,215,80,0.10);
              border: 1px solid rgba(255,215,80,0.35);
              color: #ffd24a;
              font-size: 0.78rem;
              line-height: 1.45;
            }
            .rp-pick-status.is-shown { display: block; }
            .rp-manual-entry {
              margin-top: 0.5rem;
              border-top: 1px dashed rgba(95,168,255,0.18);
              padding-top: 0.45rem;
            }
            .rp-manual-entry summary {
              cursor: pointer;
              font-size: 0.74rem;
              color: rgba(95,168,255,0.75);
              text-transform: uppercase;
              letter-spacing: 0.08em;
              user-select: none;
            }
            .rp-manual-entry summary:hover { color: rgba(95,168,255,1); }
            .rp-legs {
              margin-top: 0.6rem;
              max-height: 280px;
              overflow: auto;
              border-radius: 8px;
              border: 1px solid rgba(95,168,255,0.22);
              background: rgba(10,20,40,0.55);
            }
            .rp-leg-row {
              display: flex;
              gap: 0.5rem;
              align-items: center;
              padding: 0.35rem 0.65rem;
              border-bottom: 1px solid rgba(95,168,255,0.18);
              font-size: 0.82rem;
              cursor: pointer;
              transition: background 0.15s ease;
            }
            .rp-leg-row:last-child { border-bottom: none; }
            .rp-leg-row:hover { background: rgba(95,168,255,0.12); }
            .rp-leg-idx {
              font-size: 0.78rem;
              font-weight: 700;
              color: #ffd24a;
              width: 1.4rem;
              text-align: right;
            }
            .rp-leg-main { flex: 1; }
            .rp-leg-terrain { color: rgba(244,240,224,0.72); font-size: 0.76rem; margin-top: 0.1rem; }
            .rp-leg-cost { font-size: 0.78rem; color: rgba(95,168,255,0.92); white-space: nowrap; font-weight: 600; }
            .rp-leg-remove {
              padding: 0.15rem 0.5rem;
              border-radius: 999px;
              border: 1px solid rgba(95,168,255,0.35);
              background: rgba(20,35,65,0.5);
              cursor: pointer;
              font-size: 0.72rem;
              color: #f4f0e0;
              transition: all 0.15s ease;
            }
            .rp-leg-remove:hover {
              background: rgba(220,38,38,0.22);
              border-color: rgba(248,113,113,0.7);
              color: #fecaca;
            }
            .rp-hazard {
              margin-left: 0.4rem;
              font-size: 0.72rem;
              padding: 2px 7px;
              border-radius: 999px;
              border: 1px solid rgba(249,115,22,0.7);
              color: #fed7aa;
              background: rgba(15,23,42,0.7);
              display: inline-flex;
              align-items: center;
              gap: 0.3rem;
            }
            .rp-hazard[data-type="radiation"] { border-color: rgba(185,28,28,0.85); color: #fee2e2; }
            .rp-hazard[data-type="unstable"]  { border-color: rgba(75,85,99,0.95); color: #e5e7eb; }
            .rp-weather {
              margin-left: 0.4rem;
              font-size: 0.72rem;
              padding: 2px 7px;
              border-radius: 999px;
              border: 1px solid rgba(95,168,255,0.55);
              color: #bae6fd;
              background: rgba(10,20,40,0.55);
              display: inline-flex;
              align-items: center;
              gap: 0.3rem;
            }
            .rp-mitigated {
              margin-left: 0.4rem;
              font-size: 0.72rem;
              padding: 2px 7px;
              border-radius: 999px;
              border: 1px solid rgba(34,197,94,0.75);
              color: #bbf7d0;
              background: rgba(20,80,40,0.45);
              display: inline-flex;
              align-items: center;
              gap: 0.3rem;
              cursor: help;
            }
            .rp-ability-cover {
              flex: 0 0 auto;
              font-size: 0.66rem;
              padding: 0 6px;
              border-radius: 999px;
              border: 1px solid rgba(34,197,94,0.7);
              color: #bbf7d0;
              background: rgba(20,80,40,0.4);
              cursor: help;
            }
            .rp-ability-mask {
              flex: 0 0 auto;
              font-size: 0.66rem;
              padding: 0 6px;
              border-radius: 999px;
              border: 1px solid rgba(167,139,250,0.75);
              color: #e9d5ff;
              background: rgba(60,40,90,0.45);
              cursor: help;
            }
            .rp-stack-mask-summary {
              margin-top: 0.4rem;
              padding: 0.35rem 0.5rem;
              background: rgba(60,40,90,0.30);
              border: 1px solid rgba(167,139,250,0.55);
              border-radius: 6px;
              font-size: 0.74rem;
              color: #e9d5ff;
              display: none;
            }
            /* Travel Engine v2 — Phase E1: Vanguard stacking. */
            .rp-stack-block { display: flex; flex-direction: column; gap: 0.3rem; }
            .rp-stack-list {
              display: flex; flex-direction: column; gap: 0.25rem;
              margin-top: 0.3rem;
            }
            .rp-stack-chip {
              display: flex; align-items: center; gap: 0.35rem;
              padding: 0.2rem 0.4rem;
              background: rgba(255,215,80,0.08);
              border: 1px solid rgba(255,215,80,0.45);
              border-radius: 999px;
              font-size: 0.78rem;
            }
            .rp-stack-chip .rp-stack-name { flex: 1 1 auto; color: #fff7cc; }
            .rp-stack-chip input.rp-stack-mult {
              width: 3.2rem; font-size: 0.72rem;
              background: rgba(10,20,40,0.6);
              border: 1px solid rgba(95,168,255,0.35);
              color: #f4f0e0;
              border-radius: 4px;
              padding: 1px 4px;
              text-align: right;
            }
            .rp-stack-chip .rp-stack-freeloader {
              font-size: 0.65rem; opacity: .65; font-style: italic; color: #fbbf24;
            }
            .rp-stack-chip button {
              background: transparent;
              border: none;
              color: #fed7aa;
              cursor: pointer;
              font-size: 0.9rem;
              padding: 0 0.25rem;
              line-height: 1;
            }
            .rp-stack-chip button:hover { color: #fff; }
            .rp-stack-cost {
              display: flex; flex-direction: column; gap: 0.2rem;
              padding: 0.4rem 0.5rem;
              background: rgba(10,20,40,0.55);
              border: 1px solid rgba(95,168,255,0.30);
              border-radius: 6px;
              font-size: 0.78rem;
            }
            .rp-stack-cost .rp-stack-cost-row { display: flex; gap: 0.5rem; }
            .rp-stack-cost .rp-stack-cost-name { flex: 1 1 auto; color: #f4f0e0; }
            .rp-stack-cost .rp-stack-cost-val { font-family: monospace; color: #bae6fd; }
            .rp-stack-cost .rp-stack-cost-val.bad { color: #fecaca; }
            .rp-stack-cost .rp-stack-cost-foot { font-size: 0.7rem; opacity: 0.75; margin-top: 0.25rem; }
            .rp-stack-cost .rp-stack-cost-foot.bad { color: #fecaca; opacity: 1; }
            .rp-stack-cost .rp-stack-cost-foot.ok  { color: #bbf7d0; }

            .rp-abilities-block { margin-top: 0.5rem; }
            .rp-abilities {
              display: flex; flex-direction: column; gap: 0.4rem;
              max-height: 18rem; overflow-y: auto;
              padding: 0.4rem 0.5rem;
              background: rgba(10,20,40,0.5);
              border: 1px solid rgba(95,168,255,0.30);
              border-radius: 6px;
            }
            .rp-abilities-empty { font-size: 0.78rem; opacity: 0.7; font-style: italic; }
            .rp-ability-actor {
              border-left: 2px solid rgba(255,215,80,0.55);
              padding-left: 0.45rem;
            }
            .rp-ability-actor-head {
              display: flex; align-items: center; gap: 0.35rem;
              font-size: 0.78rem; font-weight: 700; color: #f4f0e0;
              margin-bottom: 0.25rem;
            }
            .rp-ability-actor-head img {
              width: 18px; height: 18px; border-radius: 3px; border: 1px solid rgba(255,215,80,0.4);
              object-fit: cover; flex: 0 0 auto;
            }
            .rp-ability-actor ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.2rem; }
            .rp-ability-actor li {
              display: flex; align-items: center; gap: 0.4rem;
              padding: 0.18rem 0.3rem;
              font-size: 0.74rem;
              border-radius: 4px;
              background: rgba(20,35,65,0.45);
            }
            .rp-ability-actor li:hover { background: rgba(95,168,255,0.18); }
            .rp-ability-label { flex: 1 1 auto; color: #bae6fd; cursor: help; }
            .rp-ability-use {
              flex: 0 0 auto;
              font-size: 0.7rem;
              padding: 1px 8px;
              background: linear-gradient(135deg, rgba(255,215,80,0.30) 0%, rgba(95,168,255,0.30) 100%);
              color: #fff;
              border: 1px solid rgba(255,215,80,0.55);
              border-radius: 999px;
              cursor: pointer;
            }
            .rp-ability-use:hover { filter: brightness(1.15); }
            .tc-summary-chip {
              display: inline-flex;
              align-items: center;
              border-radius: 999px;
              padding: 3px 10px;
              font-size: 0.78rem;
              border: 1px solid rgba(95,168,255,0.35);
              background: rgba(20,35,65,0.5);
              color: #f4f0e0;
            }
            .tc-summary-row {
              display: flex;
              flex-wrap: wrap;
              gap: 0.45rem;
              align-items: center;
              margin-top: 0.4rem;
            }
            .tc-summary-label {
              font-size: 0.74rem;
              font-weight: 700;
              letter-spacing: 0.10em;
              text-transform: uppercase;
              color: rgba(95,168,255,0.85);
            }
            .rp-out {
              font-size: 0.82rem;
              margin-top: 0.45rem;
              background: rgba(10,20,40,0.6);
              color: #f4f0e0;
              border-radius: 6px;
              padding: 0.4rem 0.6rem;
              border: 1px solid rgba(95,168,255,0.30);
              white-space: pre-line;
              line-height: 1.5;
            }
            .bbttcc-travel-console .rad-tier-none   { background: rgba(20,35,65,0.5); border-color: rgba(95,168,255,0.35); color:#f4f0e0; }
            .bbttcc-travel-console .rad-tier-low    { background: rgba(22,163,74,0.16);  border-color: rgba(22,163,74,0.85);  color:#bbf7d0; }
            .bbttcc-travel-console .rad-tier-moderate{background: rgba(234,179,8,0.20);  border-color: rgba(202,138,4,0.95); color:#facc15; }
            .bbttcc-travel-console .rad-tier-high   { background: rgba(249,115,22,0.20); border-color: rgba(234,88,12,0.95); color:#fed7aa; }
            .bbttcc-travel-console .rad-tier-extreme{ background: rgba(220,38,38,0.22);  border-color: rgba(185,28,28,0.98); color:#fecaca; }
            .tc-right-buttons { display:flex; flex-wrap:wrap; gap:0.45rem; margin-top:0.7rem; }
            .tc-right-buttons .bbttcc-travel-button.primary {
              background: linear-gradient(135deg, rgba(255,215,80,0.30) 0%, rgba(95,168,255,0.30) 100%);
              color: #fff;
              border-color: rgba(255,215,80,0.55);
              font-weight: 700;
              letter-spacing: 0.05em;
            }
            .tc-right-buttons .bbttcc-travel-button.primary:hover {
              background: linear-gradient(135deg, rgba(255,215,80,0.45) 0%, rgba(95,168,255,0.45) 100%);
              filter: brightness(1.05);
            }
          </style>

          <div class="bbttcc-travel-hero">
            <div class="bbttcc-travel-hero-title">Travel Console</div>
            <div class="bbttcc-travel-hero-sub">Plot a route across the hex map. Faction auto-detects from your selected token. Add legs, then execute through the faction's OP pool.</div>
          </div>

          <div class="bbttcc-travel-grid">
            <section class="tc-panel tc-left">
              <div class="tc-panel-header">Route Builder</div>
              <div class="tc-sub">Plan legs between hexes, then execute via the faction’s OP pool.</div>

              <div class="bbttcc-travel-field">
                <label>Faction</label>
                <select data-role="faction" class="bbttcc-travel-select"></select>
              </div>

              <div class="bbttcc-travel-field rp-stack-block" style="margin-top:0.5rem;">
                <label data-tooltip="Allied-only co-travelers. Each pays own OP debit, scaled by per-faction multiplier.">Joining Factions <small style="opacity:.6">(Allied only)</small></label>
                <div class="rp-stack-controls bbttcc-travel-actions">
                  <select data-role="rp-stack-picker" class="bbttcc-travel-select">
                    <option value="">— pick faction to add —</option>
                  </select>
                  <button type="button" data-action="rp-stack-add" class="bbttcc-travel-button">+ Add</button>
                </div>
                <div class="rp-stack-list" data-role="rp-stack-list"></div>
                <div class="rp-stack-hint" style="font-size:.72rem; opacity:.6; margin-top:.25rem;">Each passenger pays their own faction's OP cost × multiplier. Default 1.0× (full pay).</div>
              </div>

              <div class="bbttcc-travel-field" style="margin-top:0.6rem;">
                <label>Route Planner</label>
                <div class="bbttcc-travel-actions">
                  <button type="button" data-action="rp-pick" class="bbttcc-travel-button rp-pick-btn">📍 Pick on Map</button>
                  <button type="button" data-action="rp-auto" class="bbttcc-travel-button rp-pick-btn">🪄 Auto-Plan A→B</button>
                </div>
                <div class="rp-pick-status" data-role="rp-pick-status"></div>
                <details class="rp-manual-entry">
                  <summary>Manual entry (dropdowns)</summary>
                  <div class="bbttcc-travel-actions" style="margin-top:0.4rem;">
                    <select data-role="rp-from" class="bbttcc-travel-select"></select>
                    <span>→</span>
                    <select data-role="rp-to" class="bbttcc-travel-select"></select>
                    <button type="button" data-action="rp-add" class="bbttcc-travel-button">Add Leg</button>
                    <button type="button" data-action="rp-clear" class="bbttcc-travel-button">Clear</button>
                  </div>
                </details>
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

              <div class="bbttcc-travel-field rp-abilities-block">
                <div class="tc-summary-label">Vanguard Abilities</div>
                <div class="rp-abilities" data-role="rp-abilities">
                  <div class="rp-abilities-empty">Pick a faction to surface travel-relevant abilities.</div>
                </div>
              </div>

              <div class="bbttcc-travel-field rp-stack-cost-block" data-role="rp-stack-cost-block" style="display:none;">
                <div class="tc-summary-label">Stack Cost Preview</div>
                <div class="rp-stack-cost" data-role="rp-stack-cost"></div>
              </div>

              <div class="tc-right-buttons">
                <button type="button" data-action="rp-reverse" class="bbttcc-travel-button">⤵ Reverse Route</button>
                <button type="button" data-action="rp-exec" class="bbttcc-travel-button primary">▶ Execute Route</button>
              </div>

              <div class="rp-out"></div>
            </section>
          </div>
        </div>`;

      // Faction list — GMs see all factions; players see only factions they own
      // (Foundry Owner permission). Auto-detect from selected token still works,
      // but it'll only resolve to factions in the filtered list.
      const _isOwnedByUser = (a) => {
        if (game.user?.isGM) return true;
        try {
          if (typeof a.testUserPermission === "function") {
            return a.testUserPermission(game.user, "OWNER");
          }
          return !!a.isOwner;
        } catch (_e) { return false; }
      };
      const factions = Array.from(game.actors ?? [])
        .filter(a => a?.getFlag?.(MOD_FCT,"isFaction") || a?.flags?.[MOD_FCT]?.isFaction)
        .filter(_isOwnedByUser)
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

      // Auto-detect faction from the canvas selection. Two cases:
      //   1) Selected token's actor IS a faction (isFaction=true)        → use actor.id directly.
      //   2) Selected token's actor is a character with factionId flag   → use that.
      // Tracked with `_facManuallyChanged` so we don't keep yanking the dropdown
      // away from the GM if they pick a different faction by hand.
      let _facManuallyChanged = false;
      const _detectFactionIdFromCanvas = () => {
        try {
          const tok = canvas?.tokens?.controlled?.[0];
          const a = tok?.actor;
          if (!a) return null;
          if (a.getFlag?.(MOD_FCT, "isFaction")) return a.id;
          const linked = a.getFlag?.(MOD_FCT, "factionId");
          if (linked && factions.some(f => f.id === linked)) return linked;
          return null;
        } catch (_e) { return null; }
      };
      const _applyDetectedFaction = () => {
        if (_facManuallyChanged) return;
        const fid = _detectFactionIdFromCanvas();
        if (fid && $fac.value !== fid) {
          $fac.value = fid;
          $fac.dispatchEvent(new Event("change", { bubbles: true }));
        }
      };
      $fac.addEventListener("change", () => {
        _facManuallyChanged = true;
        // Phase E1: changing the lead invalidates the joining-faction stack
        // (relationships are pair-keyed). Clear + rebuild the picker.
        // Phase E2: rehydrate the new lead's persistent stack if one exists,
        // instead of always starting from empty.
        try {
          _rehydrateStackFromLead($fac.value || "");
          rebuildStackPicker();
          renderStackList();
          renderStackCost();
          renderAbilities();
        } catch (_e) {}
      });
      _applyDetectedFaction();

      // Re-apply when the GM selects a different token while the console is open.
      if (this._tokenSelectHookId) { try { Hooks.off("controlToken", this._tokenSelectHookId); } catch (_e) {} }
      this._tokenSelectHookId = Hooks.on("controlToken", (_token, _controlled) => {
        try { _applyDetectedFaction(); } catch (_e) {}
      });

      // ── Phase E1: Vanguard Stack state + helpers ────────────────────────────
      // Session-only stack. Lead = $fac.value. Passengers stamp here:
      const joiningFactionIds = [];
      const costMultipliers = {}; // factionId → number (default 1.0)
      const $stackPicker = content.querySelector('[data-role="rp-stack-picker"]');
      const $stackList   = content.querySelector('[data-role="rp-stack-list"]');
      const $stackCost   = content.querySelector('[data-role="rp-stack-cost"]');
      const $stackCostBlock = content.querySelector('[data-role="rp-stack-cost-block"]');

      function _getAlliedFactions(leadId) {
        // Returns factions where BOTH sides rate each other Allied. Bypasses
        // the gate for the GM so they can stack any pairing for narrative
        // reasons. Uses bbttcc-factions relations API; falls back to empty
        // list if relations API is not loaded.
        if (!leadId) return [];
        const lead = game.actors?.get(leadId);
        if (!lead) return [];
        const relApi = game?.bbttcc?.api?.factions?.relations;
        if (!relApi?.list || !relApi?.get) return [];
        const out = [];
        for (const entry of relApi.list(lead)) {
          if (entry.id === leadId) continue;
          if (joiningFactionIds.includes(entry.id)) continue;
          const isGM = !!game.user?.isGM;
          if (isGM) {
            // GM bypass: show everything except hostile/at_war by default,
            // but allow forcing via console if needed. For the picker we
            // still nudge them toward Allied as the canon path.
            out.push({ id: entry.id, name: entry.name, tier: entry.tier, allied: entry.tier === "allied" });
          } else {
            // Player path: mutual Allied required.
            const back = relApi.get(entry.id, lead);
            if (entry.tier === "allied" && back === "allied") {
              out.push({ id: entry.id, name: entry.name, tier: entry.tier, allied: true });
            }
          }
        }
        return out;
      }

      function rebuildStackPicker() {
        if (!$stackPicker) return;
        const leadId = $fac.value;
        const allies = _getAlliedFactions(leadId);
        const isGM = !!game.user?.isGM;
        const lines = [`<option value="">— pick faction to add —</option>`];
        for (const f of allies) {
          const tag = f.allied ? "Allied" : `${f.tier} (GM)`;
          lines.push(`<option value="${enc(f.id)}">${enc(f.name)} — ${enc(tag)}</option>`);
        }
        $stackPicker.innerHTML = lines.join("");
        $stackPicker.disabled = !leadId || (!isGM && allies.length === 0);
      }

      function renderStackList() {
        if (!$stackList) return;
        if (!joiningFactionIds.length) {
          $stackList.innerHTML = "";
          return;
        }
        const lines = [];
        for (const fid of joiningFactionIds) {
          const f = game.actors?.get(fid);
          if (!f) continue;
          const mult = Number(costMultipliers[fid] ?? 1);
          const free = mult < 1;
          lines.push(`
            <div class="rp-stack-chip" data-fid="${enc(fid)}">
              <span class="rp-stack-name">${enc(f.name)}</span>
              <input type="number" class="rp-stack-mult" data-fid="${enc(fid)}" min="0" max="2" step="0.1" value="${mult}"/>
              <span style="font-size:.7rem;opacity:.7;">×</span>
              ${free ? `<span class="rp-stack-freeloader" data-tooltip="Pays less than full freight.">freeloader</span>` : ""}
              <button type="button" data-action="rp-stack-remove" data-fid="${enc(fid)}" data-tooltip="Drop from stack">×</button>
            </div>
          `);
        }
        $stackList.innerHTML = lines.join("");
      }

      function _computePerLegMarksCost() {
        // Mirror the leg-cost arithmetic from render() so passenger debits
        // match what the lead pays. Returns one marks delta per leg per
        // OP-category (positive numbers; commit will negate).
        const per = [];
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
          per.push(cost);
        }
        return per;
      }

      function _sumLegCosts(perLeg, scale = 1) {
        const out = {};
        for (const cost of perLeg) {
          for (const [k, v] of Object.entries(cost)) {
            const kk = String(k).toLowerCase();
            out[kk] = (out[kk] || 0) + Math.max(0, Math.round(Number(v || 0) * scale));
          }
        }
        return out;
      }

      // ── Phase E2: persistent stack flags ────────────────────────────────────
      // Lead carries `flags.bbttcc-factions.travelStack = { passengers: [{id, multiplier}] }`;
      // each passenger carries `flags.bbttcc-factions.travelingWith = { leadId, multiplier }`
      // as a reverse pointer (lets the player HUD answer "is my faction riding"
      // in O(1) without scanning every actor). Both written only when the user
      // can update both actors (GM, or owner of both). If perms are partial,
      // we fall back to session-only state + notify.
      function _canWriteFactionFlag(actor) {
        if (!actor) return false;
        if (game.user?.isGM) return true;
        try { return !!actor.isOwner; } catch { return false; }
      }
      async function _persistStackAdd(leadId, passengerId, multiplier) {
        const lead = game.actors?.get(leadId);
        const pass = game.actors?.get(passengerId);
        if (!lead || !pass) return false;
        if (!_canWriteFactionFlag(lead) || !_canWriteFactionFlag(pass)) {
          ui.notifications?.info?.(`Stack persistence skipped — needs owner of both ${lead.name} and ${pass.name} (or GM). Session-only.`);
          return false;
        }
        try {
          const cur = lead.getFlag?.(MOD_FCT, "travelStack") || { passengers: [] };
          const passengers = Array.isArray(cur.passengers) ? cur.passengers.slice() : [];
          const idx = passengers.findIndex(p => p?.id === passengerId);
          if (idx >= 0) passengers[idx] = { id: passengerId, multiplier };
          else passengers.push({ id: passengerId, multiplier });
          await lead.setFlag(MOD_FCT, "travelStack", { passengers });
          await pass.setFlag(MOD_FCT, "travelingWith", { leadId, multiplier });
          return true;
        } catch (e) {
          console.warn(TAG, "stack flag write failed", e);
          return false;
        }
      }
      async function _persistStackRemove(leadId, passengerId) {
        const lead = game.actors?.get(leadId);
        const pass = game.actors?.get(passengerId);
        if (!lead) return false;
        try {
          if (_canWriteFactionFlag(lead)) {
            const cur = lead.getFlag?.(MOD_FCT, "travelStack") || { passengers: [] };
            const passengers = (Array.isArray(cur.passengers) ? cur.passengers : []).filter(p => p?.id !== passengerId);
            if (passengers.length) await lead.setFlag(MOD_FCT, "travelStack", { passengers });
            else                    await lead.unsetFlag(MOD_FCT, "travelStack");
          }
          if (pass && _canWriteFactionFlag(pass)) {
            await pass.unsetFlag(MOD_FCT, "travelingWith");
          }
          return true;
        } catch (e) {
          console.warn(TAG, "stack flag clear failed", e);
          return false;
        }
      }
      function _rehydrateStackFromLead(leadId) {
        joiningFactionIds.length = 0;
        for (const k of Object.keys(costMultipliers)) delete costMultipliers[k];
        if (!leadId) return;
        const lead = game.actors?.get(leadId);
        if (!lead) return;
        const stack = lead.getFlag?.(MOD_FCT, "travelStack");
        const passengers = Array.isArray(stack?.passengers) ? stack.passengers : [];
        for (const p of passengers) {
          if (!p?.id) continue;
          if (!game.actors?.get(p.id)) continue; // stale ref — skip
          joiningFactionIds.push(p.id);
          costMultipliers[p.id] = Number(p.multiplier ?? 1);
        }
      }

      // Initial paint — fire after _applyDetectedFaction in case no token was
      // controlled and the change event didn't fire. Phase E2: rehydrate from
      // lead's persistent flag if one exists.
      try {
        _rehydrateStackFromLead($fac?.value || "");
        rebuildStackPicker();
        renderStackList();
        renderStackCost();
      } catch (_e) {}

      // Stack add — appends the picker's selected faction to the stack with
      // default multiplier 1.0×.
      const $stackAddBtn = content.querySelector('[data-action="rp-stack-add"]');
      if ($stackAddBtn) {
        $stackAddBtn.onclick = async () => {
          const fid = $stackPicker?.value || "";
          if (!fid) return;
          if (joiningFactionIds.includes(fid)) return;
          joiningFactionIds.push(fid);
          costMultipliers[fid] = 1.0;
          // Phase E2: persist to both lead + passenger flags (best-effort).
          await _persistStackAdd($fac.value || "", fid, 1.0).catch(() => {});
          rebuildStackPicker();
          renderStackList();
          renderStackCost();
          renderAbilities();
        };
      }

      // Delegated chip handlers: remove button + multiplier input.
      if ($stackList && !$stackList.dataset.bbttccBound) {
        $stackList.dataset.bbttccBound = "1";
        $stackList.addEventListener("click", async (ev) => {
          const btn = ev.target?.closest?.('[data-action="rp-stack-remove"]');
          if (!btn) return;
          ev.preventDefault(); ev.stopPropagation();
          const fid = btn.dataset.fid;
          const idx = joiningFactionIds.indexOf(fid);
          if (idx >= 0) joiningFactionIds.splice(idx, 1);
          delete costMultipliers[fid];
          // Phase E2: clear persistent flags on both sides.
          await _persistStackRemove($fac.value || "", fid).catch(() => {});
          rebuildStackPicker();
          renderStackList();
          renderStackCost();
          renderAbilities();
        });
        $stackList.addEventListener("change", async (ev) => {
          const el = ev.target?.closest?.(".rp-stack-mult");
          if (!el) return;
          const fid = el.dataset.fid;
          const v = Math.max(0, Math.min(2, Number(el.value) || 0));
          costMultipliers[fid] = v;
          // Phase E2: update both flag entries with the new multiplier.
          await _persistStackAdd($fac.value || "", fid, v).catch(() => {});
          renderStackList(); // refresh freeloader badge
          renderStackCost();
        });
      }

      function renderStackCost() {
        if (!$stackCost || !$stackCostBlock) return;
        if (!joiningFactionIds.length || !legs.length) {
          $stackCostBlock.style.display = "none";
          $stackCost.innerHTML = "";
          return;
        }
        $stackCostBlock.style.display = "";
        const perLeg = _computePerLegMarksCost();
        const lines = [];
        let anyUnaffordable = false;
        for (const fid of joiningFactionIds) {
          const f = game.actors?.get(fid);
          if (!f) continue;
          const mult = Number(costMultipliers[fid] ?? 1);
          const totals = _sumLegCosts(perLeg, mult);
          const bank = f?.getFlag?.(MOD_FCT, "opBank") || {};
          const shortfalls = [];
          const parts = [];
          for (const [k, marks] of Object.entries(totals)) {
            if (marks <= 0) continue;
            const op = marks / 10;
            const have = Number(bank?.[k] ?? 0);
            if (have < marks) {
              shortfalls.push(`${opLabel(k)}: need ${op}, have ${(have/10).toFixed(1)}`);
              anyUnaffordable = true;
            }
            parts.push(`${(Number.isInteger(op) ? op : op.toFixed(1))} ${opLabel(k)}`);
          }
          const summary = parts.length ? parts.join(" · ") : "—";
          const cls = shortfalls.length ? "bad" : "";
          lines.push(`
            <div class="rp-stack-cost-row">
              <span class="rp-stack-cost-name">${enc(f.name)}</span>
              <span class="rp-stack-cost-val ${cls}" data-tooltip="${enc(shortfalls.join('\n'))}">${enc(summary)}</span>
            </div>
          `);
        }
        const foot = anyUnaffordable
          ? `<div class="rp-stack-cost-foot bad">⚠ One or more passengers can't afford. Execute will roll back those legs.</div>`
          : `<div class="rp-stack-cost-foot ok">✓ All passengers affordable.</div>`;
        $stackCost.innerHTML = lines.join("") + foot;
      }

      // Sort for the From/To pickers only — leaves the `hexes` array in its
      // original creation order so downstream hexes.find(...) lookups are
      // unaffected. localeCompare with numeric:true makes "Bedlam.b" come
      // before "Bedlam.10" if you ever number hexes.
      const hexesSorted = hexes.slice().sort((a, b) =>
        String(a.label || "").localeCompare(String(b.label || ""), undefined, { sensitivity: "base", numeric: true })
      );
      const hexOpts = hexesSorted.map(h => `<option value="${h.uuid}">${enc(h.label)}</option>`).join("");
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
          $wsum.removeAttribute("data-tooltip");
          $wsum.title = "";
          return;
        }
        const nextLeg = legs[0];
        const t = hexes.find(h => h.id === nextLeg.toId);
        const w = weatherForHex(t);
        if (!w) {
          $wsum.textContent = "Weather: —";
          $wsum.removeAttribute("data-tooltip");
          $wsum.title = "No active weather on next destination hex.";
          return;
        }
        const turns = Number.isFinite(w.remainingTurns) ? w.remainingTurns : null;
        $wsum.textContent = `☁ ${w.label}${turns!=null && turns > 0 ? ` (${turns})` : ""}`;
        $wsum.setAttribute("data-tooltip", weatherTooltip(w.key, w.label, w.remainingTurns));
        $wsum.setAttribute("data-tooltip-direction", "DOWN");
        $wsum.title = "";
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

      function renderAbilities() {
        const $box = content.querySelector('[data-role="rp-abilities"]');
        if (!$box) return;
        const factionId = $fac?.value || "";
        if (!factionId) {
          $box.innerHTML = `<div class="rp-abilities-empty">Pick a faction to surface travel-relevant abilities.</div>`;
          return;
        }
        // Phase E1: expand to lead + passengers so the panel surfaces every
        // member's travel-tagged abilities.
        const factionIds = [factionId, ...joiningFactionIds];
        const roster = getVanguardRoster(factionIds);
        const bonuses = scanTravelBonuses(roster);
        if (!bonuses.length) {
          $box.innerHTML = `<div class="rp-abilities-empty">No travel-tagged abilities on this faction's roster yet.</div>`;
          return;
        }
        // Phase 2B: reduce-or-advantage mode + per-turn use readout (engine: api.travel.mitigation).
        const mitApi = game.bbttcc?.api?.travel?.mitigation;
        const mitMode = (mitApi?.getMode?.(factionId)) || "reduce";
        const mitUses = (mitApi?.usesFor?.(factionId)) || { used: {}, perTurn: 1 };

        // Phase C: compute which legs each ability mitigates so the row can
        // surface "🛡 Covers leg N" badges. Match: ability.mitigates ∩ leg's
        // weather tags (with "weather" as catch-all).
        const archetypes = game?.bbttcc?.api?.travel?.weather?.archetypes;
        const legWeatherTags = legs.map((L, i) => {
          const t = hexes.find(h => h.id === L.toId);
          const w = weatherForHex(t);
          if (!w?.key) return { idx: i + 1, key: null, label: null, tags: [] };
          const arch = archetypes?.[w.key];
          return { idx: i + 1, key: w.key, label: w.label, tags: Array.isArray(arch?.tags) ? arch.tags : [] };
        }).filter(L => L.key);

        function _coverageFor(b) {
          const mit = b.mitigates || [];
          if (!mit.length || !legWeatherTags.length) return [];
          const hits = [];
          const catchAll = mit.includes("weather");
          for (const L of legWeatherTags) {
            if (catchAll) { hits.push(L); continue; }
            for (const t of L.tags) if (mit.includes(t)) { hits.push(L); break; }
          }
          return hits;
        }

        // Group by actor for readability.
        const groups = new Map();
        for (const b of bonuses) {
          const k = b.actor.id;
          if (!groups.has(k)) groups.set(k, { actor: b.actor, rows: [] });
          groups.get(k).rows.push(b);
        }
        const html = [];
        for (const { actor, rows } of groups.values()) {
          html.push(`
            <div class="rp-ability-actor">
              <div class="rp-ability-actor-head">
                ${actor.img ? `<img src="${enc(actor.img)}" alt="">` : ""}
                <span>${enc(actor.name)}</span>
              </div>
              <ul>
                ${rows.map(b => {
                  const hits = _coverageFor(b);
                  let coverHtml = "";
                  if (hits.length) {
                    const tip = hits.map(L => `Leg ${L.idx}: ${L.label}`).join("\n");
                    const txt = hits.length === 1 ? `🛡 Leg ${hits[0].idx}` : `🛡 ${hits.length} legs`;
                    coverHtml = `<span class="rp-ability-cover" data-tooltip="${enc(tip)}" data-tooltip-direction="LEFT">${enc(txt)}</span>`;
                  }
                  // Phase E3: vanguardMasks badge — narrative concealment tags.
                  let maskHtml = "";
                  if (Array.isArray(b.vanguardMasks) && b.vanguardMasks.length) {
                    const tip = `Masks vs: ${b.vanguardMasks.join(", ")}`;
                    maskHtml = `<span class="rp-ability-mask" data-tooltip="${enc(tip)}" data-tooltip-direction="LEFT">🎭 ${enc(b.vanguardMasks.length)}</span>`;
                  }
                  // Phase 2B: per-turn use readout (only for mitigation abilities).
                  const left = (mitUses.perTurn || 1) - Number(mitUses.used?.[b.key] || 0);
                  const usesHtml = (b.mitigates && b.mitigates.length)
                    ? `<span class="rp-ability-uses" data-tooltip="Mitigation uses left this strategic turn" data-tooltip-direction="LEFT" style="opacity:0.6;font-size:0.7rem;margin-left:4px;">${left > 0 ? `${left}/${mitUses.perTurn}` : "spent"}</span>`
                    : "";
                  return `
                    <li>
                      <span class="rp-ability-label" data-tooltip="${enc(b.body)}" data-tooltip-direction="LEFT">${enc(b.label)}</span>
                      ${coverHtml}
                      ${usesHtml}
                      ${maskHtml}
                      <button type="button" class="rp-ability-use" data-actor="${enc(actor.id)}" data-item="${enc(b.item.id)}">Use</button>
                    </li>
                  `;
                }).join("")}
              </ul>
            </div>
          `);
        }
        // Phase E3: stack-wide masked-aspect summary. Pools unique
        // vanguardMasks tags across every member ability so the table sees the
        // narrative concealment posture at a glance ("Masked vs: identity,
        // divination"). Mechanical detection is GM-arbitrated for now.
        const maskedSet = new Set();
        for (const b of bonuses) {
          for (const t of (b.vanguardMasks || [])) maskedSet.add(t);
        }
        const maskSummary = maskedSet.size
          ? `<div class="rp-stack-mask-summary" style="display:block;" data-tooltip="Combined masks across the vanguard's available abilities. Narrative — GM arbitrates mechanical detection.">🎭 Masked vs: ${enc(Array.from(maskedSet).join(", "))}</div>`
          : "";

        // Phase 2B header: reduce-or-advantage toggle (the card choice) + cadence note.
        const modeHeaderHtml = `<div class="rp-mit-header" style="display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:0.76rem;">
          <span style="opacity:0.7">Mitigation mode:</span>
          <button type="button" class="rp-mode-toggle" data-faction="${enc(factionId)}" data-mode="${enc(mitMode)}" style="padding:2px 9px;border-radius:4px;cursor:pointer;border:1px solid #88aaff;background:#1a2438;color:#cfe0ff;">${mitMode === "advantage" ? "🎲 Advantage" : "▽ Reduce"}</button>
          <span style="opacity:0.5;font-size:0.7rem">${mitMode === "advantage" ? "roll 2d20 keep-high; complication stays" : "blunt the complication one step"} · 1 use/ability/turn</span>
        </div>`;
        $box.innerHTML = modeHeaderHtml + html.join("") + maskSummary;
      }

      function render() {
        // Phase C+E1: compute vanguard bonuses across the full stack (lead +
        // joining passengers) once per render so the leg row can surface
        // mitigation badges drawn from every member's roster.
        const _stackIds = [$fac?.value || "", ...joiningFactionIds].filter(Boolean);
        const _bonuses = scanTravelBonuses(getVanguardRoster(_stackIds));

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
            ? `<span class="rp-weather" data-tooltip="${enc(weatherTooltip(w.key, w.label, w.remainingTurns))}" data-tooltip-direction="UP">
                 <span>☁</span><span>${enc(w.label)}${Number.isFinite(w.remainingTurns) && w.remainingTurns > 0 ? ` (${w.remainingTurns})` : ""}</span>
               </span>`
            : "";

          // Phase C: weather mitigation badge — list roster members whose
          // tagged abilities can blunt this leg's weather.
          let mitHtml = "";
          if (w && _bonuses.length) {
            const mits = findMitigationsForWeather(w.key, _bonuses);
            if (mits.length) {
              const tipLines = mits.map(m => `${m.actor.name}: ${m.label}`).join("\n");
              const countStr = mits.length === 1 ? "Mitigated" : `${mits.length} Mitigations`;
              mitHtml = `<span class="rp-mitigated" data-tooltip="${enc(tipLines)}" data-tooltip-direction="UP">
                <span>🛡</span><span>${enc(countStr)}</span>
              </span>`;
            }
          }

          return `<div class="rp-leg-row" data-index="${i}" data-to-id="${enc(L.toId)}" data-to-uuid="${enc(L.toUuid)}">
            <span class="rp-leg-idx">${i + 1}.</span>
            <div class="rp-leg-main">
              <div>${enc(f?.label)} → ${enc(t?.label)}</div>
              <div class="rp-leg-terrain">
                [${enc(terrInfo.label || terrKey || "Unknown")}]
                ${hazardHtml}
                ${weatherHtml}
                ${mitHtml}
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
                .map(([k, info]) => `${opLabel(k)} ${_marksToOp(Math.abs(info.after))}`)
                .join(", ");
              $est.textContent = `${baseLabel} • Not enough OP${missing ? ` (short: ${missing})` : ""}`;
            }
          } catch (e) {
            console.warn(TAG, "OP preview failed in Travel Console", e);
          }
        })();

        recomputeRadiation();
        recomputeWeatherSummary();
        // Phase C: keep ability-panel "🛡 Covers leg N" badges in sync as
        // legs are added / removed / reordered.
        // Phase E1: keep Stack Cost Preview in sync with leg edits.
        try { renderAbilities(); } catch (_e) {}
        try { renderStackCost(); } catch (_e) {}

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
        if (!legs.length) {
          $rout.textContent = "Add at least one leg before reversing.";
          return;
        }

        // Build the hex chain (from-of-first → to-of-each), then reverse it.
        const chain = [legs[0].fromId, ...legs.map(L => L.toId)];
        chain.reverse();

        // Re-resolve through the live `hexes` snapshot so labels/uuids stay consistent.
        const newLegs = [];
        for (let i = 0; i < chain.length - 1; i++) {
          const fromHex = hexes.find(h => h.id === chain[i]);
          const toHex   = hexes.find(h => h.id === chain[i + 1]);
          if (!fromHex || !toHex) continue;
          newLegs.push({
            fromUuid: fromHex.uuid,
            toUuid:   toHex.uuid,
            fromId:   fromHex.id,
            toId:     toHex.id,
            gate:     null  // gate adjacency is direction-sensitive; recompute on re-add if needed
          });
        }

        if (!newLegs.length) {
          $rout.textContent = "Reverse failed — one or more hexes are no longer on this scene.";
          return;
        }

        legs.length = 0;
        legs.push(...newLegs);

        // Sync the From/To dropdowns at the top to the new endpoints so the GM can keep building.
        try {
          if ($rf) $rf.value = newLegs[0].fromUuid;
          if ($rt) $rt.value = newLegs[newLegs.length - 1].toUuid;
        } catch (_e) {}

        render();
        recomputeRadiation();
        recomputeWeatherSummary();
        $rout.textContent = `Route reversed (${newLegs.length} leg${newLegs.length === 1 ? "" : "s"}).`;
        ui.notifications?.info?.(`Travel route reversed: ${newLegs.length} leg${newLegs.length === 1 ? "" : "s"}.`);
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
          // For non-GM travel we force "prompt" so any encounter routes through
          // the GM-arbitration relay (api.travel.js promptGMInlineForEncounter
          // emits a socket request → GM client shows Launch/Decline/Reroll →
          // emits back). This keeps GM in control of whether a player's travel
          // triggers an encounter.
          let gmOverrides = {
            costMult: 1,
            costAdd: {},
            encounterPolicy: game.user?.isGM ? "auto" : "prompt"
          };

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

            // ── Phase E1: passenger OP debits ────────────────────────────────
            // Per-leg passenger debits. After the lead pays through travelHex,
            // each joining faction pays its own debit equal to (leg's terrain+
            // gate marks cost) × per-faction multiplier.
            //
            // Atomic rollback (2026-05-12 carry-over): if ANY passenger
            // underflows, refund every passenger who DID pay this leg AND
            // refund the lead the leg's marks cost. Token movement / encounter
            // triggers / war log are not rewound (token already moved). The
            // rollback covers marks economy only.
            if (joiningFactionIds.length) {
              const opApi = game?.bbttcc?.api?.op;
              if (!opApi?.commit) {
                console.warn(TAG, "op.commit not loaded; skipping passenger debit for leg", i + 1);
              } else {
                const terrKey = normTerrKey(destHex?.terrainKey || "");
                const terrInfo = dict[normTerrKey(terrKey)] || {};
                let legCost = foundry.utils.duplicate(terrInfo.cost || {});
                if (L.gate && L.gate.strength != null) {
                  const mult = Math.max(0, 1 - (0.4 * Number(L.gate.strength || 0.5)));
                  for (const k of Object.keys(legCost)) {
                    legCost[k] = Math.max(0, Math.round(Number(legCost[k] || 0) * mult));
                  }
                }
                // Apply GM overrides (costMult + costAdd) so passengers track
                // the same discounts/surcharges the lead got via travelHex.
                if (gmOverrides?.costMult && gmOverrides.costMult !== 1) {
                  for (const k of Object.keys(legCost)) {
                    legCost[k] = Math.max(0, Math.round(Number(legCost[k] || 0) * Number(gmOverrides.costMult || 1)));
                  }
                }
                if (gmOverrides?.costAdd && typeof gmOverrides.costAdd === "object") {
                  for (const [k, v] of Object.entries(gmOverrides.costAdd)) {
                    legCost[k] = Math.max(0, Math.round(Number(legCost[k] || 0) + Number(v || 0)));
                  }
                }

                // Two-pass: collect commits + failures, then apply atomic
                // rollback if any failure occurred.
                const successfulDebits = []; // { fid, name, deltas }
                const failures = [];          // { fid, name, reason }
                for (const fid of joiningFactionIds) {
                  const passenger = game.actors?.get(fid);
                  if (!passenger) continue;
                  const mult = Number(costMultipliers[fid] ?? 1);
                  const deltas = {};
                  let anyDelta = false;
                  for (const [k, v] of Object.entries(legCost)) {
                    const n = Math.max(0, Math.round(Number(v || 0) * mult));
                    if (n > 0) { deltas[String(k).toLowerCase()] = -n; anyDelta = true; }
                  }
                  if (!anyDelta) continue;
                  try {
                    const res = await opApi.commit(passenger.id, deltas, { source: "travel-stack", label: `Leg ${i + 1}: rode with ${game.actors?.get(factionId)?.name || "lead"}` });
                    if (res?.ok) {
                      successfulDebits.push({ fid, name: passenger.name, deltas });
                    } else {
                      failures.push({ fid, name: passenger.name, reason: "underflow" });
                    }
                  } catch (e) {
                    console.warn(TAG, `passenger debit failed for ${passenger.name} on leg ${i + 1}`, e);
                    failures.push({ fid, name: passenger.name, reason: "error" });
                  }
                }

                if (failures.length) {
                  // Refund successful passengers — flip each delta sign.
                  for (const s of successfulDebits) {
                    const refund = {};
                    for (const [k, v] of Object.entries(s.deltas)) refund[k] = -Number(v);
                    try {
                      await opApi.commit(s.fid, refund, { source: "travel-stack-rollback", label: `Leg ${i + 1}: rollback (passenger underflow)` });
                    } catch (e) { console.warn(TAG, `passenger refund failed for ${s.name}`, e); }
                  }
                  // Refund lead the per-leg cost (lead's debit happened inside
                  // travelHex; cost shape mirrors legCost before multipliers).
                  const leadRefund = {};
                  for (const [k, v] of Object.entries(legCost)) {
                    const n = Math.max(0, Math.round(Number(v || 0)));
                    if (n > 0) leadRefund[String(k).toLowerCase()] = n;
                  }
                  if (Object.keys(leadRefund).length) {
                    try {
                      await opApi.commit(factionId, leadRefund, { source: "travel-stack-rollback", label: `Leg ${i + 1}: lead refund (passenger underflow)` });
                    } catch (e) { console.warn(TAG, `lead refund failed`, e); }
                  }
                  const who = failures.map(f => f.name).join(", ");
                  out.push(`    ↩ Leg ${i + 1} rolled back — ${who} could not afford the cut. Lead${successfulDebits.length ? ` + ${successfulDebits.length} paid passenger${successfulDebits.length === 1 ? "" : "s"}` : ""} refunded (token + war log unchanged).`);
                }
              }
            }

            let enc = r?.encounter;
            if (enc?.triggered) {
              const executedUuids = legs.slice(0, i + 1).map(x => x.toUuid).filter(Boolean);
              // Phase D: capture leg metadata BEFORE the legs[] mutation below.
              const executedLegMeta = legs.slice(0, i + 1).map(L => ({ gate: L?.gate ?? null }));
              const remaining = legs.slice(i + 1);
              legs.length = 0; legs.push(...remaining);
              render();

              let msg = out.join("\n");
              const encLabel = enc?.label || enc?.key || `Encounter (Tier ${Number(r?.terrainTier ?? 1) || 1})`;
              msg += `\n\nRoute paused after ${encLabel} at ${destLabel}.\nRemaining legs kept in the planner — edit them or click Execute Route again to resume.`;
              $rout.textContent = msg;

              const encNorm = normalizeEncounter(enc) || enc;
              // Encounters are emitted from the Travel Console (single source of truth) —
              // EXCEPT when the GM-arbitration relay already fired bbttcc:afterTravel
              // on the GM client (player travels). In that case enc.gmHandledLaunch is
              // set; we skip the local emit so we don't double-fire scene activation.
              if (!enc?.gmHandledLaunch) {
                await emitAfterTravelWithEncounter(
                  { ...r, factionId, actor: game.actors.get(factionId) || null, source: "travel-console" },
                  encNorm, L.fromUuid, L.toUuid, token
                );
              } else {
                console.log(TAG, "Skipped local bbttcc:afterTravel emit — GM client already fired it via arbitration relay.");
              }
if (game.bbttcc?.runVisuals) {
                try {
                  await new Promise(r => setTimeout(r, 150));
                  await game.bbttcc.runVisuals(game.bbttcc.ui.travelConsole, { uuids: executedUuids, legMeta: executedLegMeta, factionId, tokenId, sceneId, token, passengerCount: joiningFactionIds.length });
                } catch (e) {
                  console.warn(TAG, "Visuals failed during encounter pause", e);
                }
              }
              return;
            }
          }

          if (game.bbttcc?.runVisuals) {
            await new Promise(r => setTimeout(r, 800));
            // Pass the explicit token + uuids so the visuals don't have to re-resolve
            // through V1 jQuery selectors that don't work for V2 ApplicationV2.
            const allUuids = legs.map(x => x.toUuid).filter(Boolean);
            // Phase D: parallel leg metadata so gate legs get gold styling + portal pulses.
            const allLegMeta = legs.map(L => ({ gate: L?.gate ?? null }));
            await game.bbttcc.runVisuals(game.bbttcc.ui.travelConsole, { uuids: allUuids, legMeta: allLegMeta, factionId, tokenId, sceneId, token, passengerCount: joiningFactionIds.length });
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

      // ---------------------------------------------------------------------
      // Phase 2: Pick-on-Map + Auto-Plan A→B
      // - Manual pick: each click on the canvas adds a leg from the last endpoint
      //   (or sets the start on the first click of an empty plan).
      // - Auto plan: two clicks (start, end) → Dijkstra over hex axial adjacency,
      //   weighted by sum of terrain OP cost. Cheapest-OP route fills the legs.
      // - ESC cancels pick mode at any time.
      // ---------------------------------------------------------------------
      let pickMode = null;          // null | 'manual' | 'auto-start' | 'auto-end'
      let pickPendingStart = null;  // hex set on first manual click of an empty plan
      let pickAutoStart = null;     // start hex for auto-route

      const $pickStatus = content.querySelector('[data-role="rp-pick-status"]');
      const $pickBtn    = content.querySelector('[data-action="rp-pick"]');
      const $autoBtn    = content.querySelector('[data-action="rp-auto"]');

      const setPickStatus = (msg) => {
        if (!$pickStatus) return;
        if (msg) {
          $pickStatus.textContent = msg;
          $pickStatus.classList.add("is-shown");
        } else {
          $pickStatus.textContent = "";
          $pickStatus.classList.remove("is-shown");
        }
      };

      const exitPickMode = (clearStatus = true) => {
        pickMode = null;
        pickPendingStart = null;
        pickAutoStart = null;
        $pickBtn?.classList?.remove("is-active");
        $autoBtn?.classList?.remove("is-active");
        if (clearStatus) setPickStatus(null);
        try { this._removeCanvasClickListener?.(); } catch (_e) {}
        this._removeCanvasClickListener = null;
      };

      const findHexAtPoint = (worldPos) => {
        if (!worldPos) return null;
        const placeables = canvas?.drawings?.placeables || [];
        for (const d of placeables) {
          const f = d?.document?.flags?.[MOD_TERR] || {};
          if (!(f.isHex === true || f.kind === "territory-hex")) continue;
          const lx = worldPos.x - (d.document.x || 0);
          const ly = worldPos.y - (d.document.y || 0);
          if (d.shape?.contains?.(lx, ly)) return d;
          // Bounds fallback (tiled hexes don't usually overlap meaningfully).
          const b = d.bounds;
          if (b && worldPos.x >= b.x && worldPos.x <= b.x + b.width &&
                  worldPos.y >= b.y && worldPos.y <= b.y + b.height) {
            return d;
          }
        }
        return null;
      };

      const handleManualPick = (hex) => {
        if (!legs.length && !pickPendingStart) {
          pickPendingStart = hex;
          setPickStatus(`Start: ${hex.label}. Click the next hex to add a leg.`);
          return;
        }
        let fromHex;
        if (pickPendingStart) {
          fromHex = pickPendingStart;
          pickPendingStart = null;
        } else {
          fromHex = hexes.find(h => h.id === legs[legs.length - 1].toId);
        }
        if (!fromHex) { setPickStatus("Couldn't resolve last endpoint."); return; }
        if (fromHex.id === hex.id) { setPickStatus("Same hex; pick a different one."); return; }
        legs.push({
          fromUuid: fromHex.uuid,
          toUuid:   hex.uuid,
          fromId:   fromHex.id,
          toId:     hex.id,
          gate:     null
        });
        render();
        setPickStatus(`Leg ${legs.length}: ${fromHex.label} → ${hex.label}. Click the next hex to continue.`);
      };

      const _sumOPCost = (cost) => {
        let s = 0;
        for (const v of Object.values(cost || {})) s += Number(v || 0);
        return s;
      };

      // Distance-based adjacency — robust regardless of whether hex drawings have
      // stored axial coords. We measure each hex's canvas-space center, find the
      // typical neighbor spacing (smallest non-zero center-to-center distance),
      // and use a 1.20× threshold to mark neighbors. Works for both pointy-top
      // and flat-top grids and any hex orientation.
      const _hexCenter = (hexId) => {
        const p = canvas?.drawings?.get?.(hexId);
        if (!p) return null;
        const b = p.bounds;
        if (b && Number.isFinite(b.x) && Number.isFinite(b.width)) {
          return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        }
        const d = p.document;
        if (d && Number.isFinite(d.x)) {
          // Approximate center from doc x/y + shape width/height if available.
          const w = d.shape?.width ?? d.width ?? 0;
          const h = d.shape?.height ?? d.height ?? 0;
          return { x: d.x + w / 2, y: d.y + h / 2 };
        }
        return null;
      };

      const computeShortestPath = (startHex, endHex) => {
        // Map id → center; skip hexes without a resolvable center.
        const centers = new Map();
        for (const h of hexes) {
          const c = _hexCenter(h.id);
          if (c) centers.set(h.id, c);
        }
        if (!centers.has(startHex.id) || !centers.has(endHex.id)) return null;

        // Find the typical neighbor distance by sampling: smallest non-zero
        // center-to-center distance from a few seed hexes. Median-ish via min().
        let baseDist = Infinity;
        const sampleCount = Math.min(centers.size, 8);
        const ids = Array.from(centers.keys()).slice(0, sampleCount);
        for (const id of ids) {
          const c = centers.get(id);
          for (const [oid, oc] of centers) {
            if (oid === id) continue;
            const dx = oc.x - c.x, dy = oc.y - c.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > 0 && d < baseDist) baseDist = d;
          }
        }
        if (!Number.isFinite(baseDist)) {
          baseDist = (canvas?.grid?.size || 100); // fallback
        }
        const adjThreshold = baseDist * 1.20;

        // Pre-compute neighbor lists (within threshold).
        const neighborsOf = new Map();
        for (const [id, c] of centers) {
          const nbrs = [];
          for (const [oid, oc] of centers) {
            if (oid === id) continue;
            const dx = oc.x - c.x, dy = oc.y - c.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d <= adjThreshold) nbrs.push(oid);
          }
          neighborsOf.set(id, nbrs);
        }

        // Dijkstra; cost into a hex = sum of its terrain's OP cost (min 1).
        const dist = new Map([[startHex.id, 0]]);
        const prev = new Map();
        const visited = new Set();
        const queue = [{ id: startHex.id, cost: 0 }];

        while (queue.length) {
          queue.sort((a, b) => a.cost - b.cost);
          const { id, cost } = queue.shift();
          if (visited.has(id)) continue;
          visited.add(id);
          if (id === endHex.id) break;

          const nbrs = neighborsOf.get(id) || [];
          for (const nid of nbrs) {
            if (visited.has(nid)) continue;
            const neighbor = hexes.find(h => h.id === nid);
            if (!neighbor) continue;

            const terrKey  = normTerrKey(neighbor.terrainKey || "");
            const terrInfo = dict[terrKey] || {};
            const moveCost = Math.max(1, _sumOPCost(terrInfo.cost || {}));
            const newCost  = cost + moveCost;

            if (newCost < (dist.get(nid) ?? Infinity)) {
              dist.set(nid, newCost);
              prev.set(nid, id);
              queue.push({ id: nid, cost: newCost });
            }
          }
        }

        if (!visited.has(endHex.id)) return null;

        // Reconstruct path startHex → … → endHex.
        const path = [];
        let curId = endHex.id;
        while (curId !== undefined) {
          const h = hexes.find(x => x.id === curId);
          if (h) path.unshift(h);
          if (curId === startHex.id) break;
          curId = prev.get(curId);
        }
        return path.length >= 2 ? path : null;
      };

      const autoPlanRoute = (startHex, endHex) => {
        const path = computeShortestPath(startHex, endHex);
        if (!path) {
          setPickStatus(`No path found between ${startHex.label} and ${endHex.label}.`);
          return;
        }
        legs.length = 0;
        for (let i = 0; i < path.length - 1; i++) {
          const f = path[i], t = path[i + 1];
          legs.push({ fromUuid: f.uuid, toUuid: t.uuid, fromId: f.id, toId: t.id, gate: null });
        }
        render();
        const totalCost = path.slice(1).reduce((s, h) => {
          const terrInfo = dict[normTerrKey(h.terrainKey || "")] || {};
          return s + _sumOPCost(terrInfo.cost || {});
        }, 0);
        setPickStatus(`Route planned: ${legs.length} leg${legs.length === 1 ? "" : "s"} (${startHex.label} → ${endHex.label}, ~${totalCost} OP).`);
        ui.notifications?.info?.(`Travel route planned: ${legs.length} leg(s).`);
      };

      const onCanvasClick = (event) => {
        if (!pickMode) return;
        if (event.button !== undefined && event.button !== 0) return;

        const worldPos = canvas?.mousePosition;
        const hexPlaceable = findHexAtPoint(worldPos);
        if (!hexPlaceable) return;

        const hex = hexes.find(h => h.id === hexPlaceable.id);
        if (!hex) return;

        // Beat Foundry's drag-select / drawing-select logic.
        try { event.preventDefault?.(); event.stopPropagation?.(); event.stopImmediatePropagation?.(); } catch (_e) {}

        if (pickMode === "manual") {
          handleManualPick(hex);
        } else if (pickMode === "auto-start") {
          pickAutoStart = hex;
          pickMode = "auto-end";
          setPickStatus(`Start: ${hex.label}. Click DESTINATION hex.`);
        } else if (pickMode === "auto-end") {
          autoPlanRoute(pickAutoStart, hex);
          exitPickMode(false);  // keep status banner with route summary
        }
      };

      const attachCanvasClickListener = () => {
        try { this._removeCanvasClickListener?.(); } catch (_e) {}
        const canvasEl = canvas?.app?.view ?? canvas?.app?.canvas ?? null;
        if (!canvasEl) {
          ui.notifications?.warn?.("Canvas not ready — pick mode unavailable.");
          return false;
        }
        canvasEl.addEventListener("pointerdown", onCanvasClick, true);
        this._removeCanvasClickListener = () => {
          try { canvasEl.removeEventListener("pointerdown", onCanvasClick, true); } catch (_e) {}
        };
        return true;
      };

      $pickBtn?.addEventListener("click", () => {
        if (pickMode === "manual") { exitPickMode(); return; }
        exitPickMode(false);
        pickMode = "manual";
        $pickBtn.classList.add("is-active");
        if (!attachCanvasClickListener()) { exitPickMode(); return; }
        const tail = legs.length
          ? hexes.find(h => h.id === legs[legs.length - 1].toId)?.label
          : null;
        setPickStatus(tail
          ? `Click hexes on the map to add legs from ${tail}. ESC or click button again to stop.`
          : "Click first hex (start), then each subsequent hex to add legs. ESC or click button again to stop.");
      });

      $autoBtn?.addEventListener("click", () => {
        if (pickMode === "auto-start" || pickMode === "auto-end") { exitPickMode(); return; }
        exitPickMode(false);
        pickMode = "auto-start";
        $autoBtn.classList.add("is-active");
        if (!attachCanvasClickListener()) { exitPickMode(); return; }
        setPickStatus("Click START hex on the map.");
      });

      // ESC cancels pick mode globally; only intercepted when pickMode is active.
      const onKeyDown = (event) => {
        if (event.key === "Escape" && pickMode) {
          exitPickMode(false);
          setPickStatus("Pick mode cancelled.");
          setTimeout(() => { if (!pickMode) setPickStatus(null); }, 1800);
        }
      };
      try { this._removeKeyDownListener?.(); } catch (_e) {}
      window.addEventListener("keydown", onKeyDown);
      this._removeKeyDownListener = () => {
        try { window.removeEventListener("keydown", onKeyDown); } catch (_e) {}
      };

      render();

      // Re-run the OP preview when the selected faction's bank changes underneath
      // us (GM Manual Edit Apply, raid spend, Advance Turn replenish, etc.). Without
      // this, the est-line ("Not enough OP (short: …)") goes stale until something
      // else triggers render() — most often biting GMs who fix the bank via the
      // faction sheet and then can't see the preview update.
      if (this._opBankHookId) { try { Hooks.off("updateActor", this._opBankHookId); } catch (_e) {} }
      this._opBankHookId = Hooks.on("updateActor", (actor, data) => {
        try {
          if (!actor?.id || actor.id !== $fac.value) return;
          if (!foundry.utils.hasProperty(data, `flags.${MOD_FCT}.opBank`)) return;
          render();
        } catch (e) { console.warn(TAG, "opBank refresh hook failed", e); }
      });

      // Travel Engine v2 — Phase B: Vanguard Abilities panel wiring.
      // Delegated click handler for the "Use" buttons (innerHTML rebuilds, so
      // event delegation on the stable container avoids per-render rebinding).
      const $abilitiesBox = content.querySelector('[data-role="rp-abilities"]');
      if ($abilitiesBox && !$abilitiesBox.dataset.bbttccBound) {
        $abilitiesBox.dataset.bbttccBound = "1";
        $abilitiesBox.addEventListener("click", async (ev) => {
          const modeBtn = ev.target?.closest?.(".rp-mode-toggle");
          if (modeBtn) {
            ev.preventDefault(); ev.stopPropagation();
            const mitApi = game.bbttcc?.api?.travel?.mitigation;
            const cur = modeBtn.dataset.mode || "reduce";
            await mitApi?.setMode?.(modeBtn.dataset.faction, cur === "advantage" ? "reduce" : "advantage");
            renderAbilities();
            return;
          }
          const btn = ev.target?.closest?.(".rp-ability-use");
          if (!btn) return;
          ev.preventDefault();
          ev.stopPropagation();
          const actor = game.actors?.get(btn.dataset.actor);
          const item  = actor?.items?.get(btn.dataset.item);
          if (!actor || !item) {
            ui.notifications?.warn?.("Could not resolve ability — actor or item missing.");
            return;
          }
          const dispatch = game?.fourththing?._classAutomation?.dispatchFeatureAction;
          if (typeof dispatch !== "function") {
            ui.notifications?.error?.("Per-use dispatcher not loaded (game.fourththing._classAutomation.dispatchFeatureAction).");
            return;
          }
          try { dispatch(actor, item); }
          catch (e) { console.warn(TAG, "dispatch failed", e); ui.notifications?.error?.("Could not open ability."); }
        });
      }

      // Refresh abilities panel when a roster member's flags change (use
      // tracking) or when items are added/removed (new ability acquired).
      if (this._rosterHookIds?.length) {
        try { for (const h of this._rosterHookIds) Hooks.off(h.event, h.id); } catch (_e) {}
      }
      this._rosterHookIds = [];
      const _maybeRefreshAbilities = (a) => {
        try {
          const fid = $fac?.value;
          if (!fid || !a) return;
          const inRoster = String(a?.getFlag?.(MOD_FCT, "factionId") ?? "") === String(fid);
          if (!inRoster) return;
          renderAbilities();
        } catch (_e) {}
      };
      this._rosterHookIds.push({ event: "updateActor", id: Hooks.on("updateActor", (a, d) => {
        // refresh if fourththing flags changed (use tracking) OR faction membership changed
        if (foundry.utils.hasProperty(d, "flags.fourththing") || foundry.utils.hasProperty(d, `flags.${MOD_FCT}.factionId`)) _maybeRefreshAbilities(a);
      }) });
      this._rosterHookIds.push({ event: "createItem", id: Hooks.on("createItem", (item) => _maybeRefreshAbilities(item?.parent)) });
      this._rosterHookIds.push({ event: "deleteItem", id: Hooks.on("deleteItem", (item) => _maybeRefreshAbilities(item?.parent)) });

      // Initial paint.
      try { renderAbilities(); } catch (_e) {}
    }

    async close(opts) {
      try {
        if (this._opBankHookId) Hooks.off("updateActor", this._opBankHookId);
        if (this._tokenSelectHookId) Hooks.off("controlToken", this._tokenSelectHookId);
        if (Array.isArray(this._rosterHookIds)) {
          for (const h of this._rosterHookIds) { try { Hooks.off(h.event, h.id); } catch (_e) {} }
        }
        this._removeCanvasClickListener?.();
        this._removeKeyDownListener?.();
      } catch (_e) {}
      this._opBankHookId = null;
      this._tokenSelectHookId = null;
      this._rosterHookIds = null;
      this._removeCanvasClickListener = null;
      this._removeKeyDownListener = null;
      return super.close(opts);
    }
  }

  globalThis.BBTTCC_TravelConsole = BBTTCC_TravelConsole;

  Hooks.once("ready", () => {
    game.bbttcc ??= { api: {} };
    game.bbttcc.ui ??= {};
    game.bbttcc.ui.travelConsole = new BBTTCC_TravelConsole();
    // Expose emitAfterTravelWithEncounter so the GM-side encounter-arbitration
    // relay (in api.travel.js) can fire the bbttcc:afterTravel hook on the GM
    // client when the GM clicks Launch — that's where scene-activation listeners
    // can actually run with GM permissions. See feedback memory.
    game.bbttcc.api ??= {};
    game.bbttcc.api.travel ??= {};
    game.bbttcc.api.travel.emitAfterTravelWithEncounter = emitAfterTravelWithEncounter;
    // Carry-over (2026-05-12) — expose weatherTooltip so the hex sheet (and
    // any future consumer like a canvas hover overlay) can render the rich
    // multi-line tooltip identical to the Travel Console legs/route chips.
    game.bbttcc.api.travel.weather ??= {};
    game.bbttcc.api.travel.weather.tooltip = weatherTooltip;
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

// modules/bbttcc-travel/scripts/bbttcc-travel-console.js
// BBTTCC — Travel Console v1.5.6 (Hex Chrome + OP Engine + Arc Engine preview)
// Classic Application (V1) with:
//  - Two-panel layout
//  - Correct OP estimate (from _hexTravel.TERRAIN_TABLE)
//  - Radiation projection + tier colors
//  - Per-leg hazard chips
//  - Reverse Route
//  - Hover leg -> highlight destination hex
//  - OP preview using game.bbttcc.api.op.preview (no commit here yet)
//  - Travel Arc Engine rolls per executed leg (wired to movement)
//  - Narrower default width + hex UUIDs for travelHex (fixes Unknown From/To logs)
//  - Max-width on inner Hex Chrome panel so content doesn’t sprawl full-screen

(() => {
  const TAG      = "[bbttcc-travel-console v1.5.6]";
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
    "violence",
    "nonlethal",
    "intrigue",
    "economy",
    "softpower",
    "diplomacy",
    "logistics",
    "culture",
    "faith"
  ];

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

  function getHexesOnScene() {
    return (canvas?.drawings?.placeables || [])
      .map(p => {
        const flags       = p.document.flags?.[MOD_TERR] || {};
        const terrain     = p.document.getFlag?.(MOD_TERR, "terrain") ?? flags.terrain;
        const terrainType = p.document.getFlag?.(MOD_TERR, "terrainType") ?? flags.terrainType;
        const key         = terrain?.key || terrainType;
        if (!key) return null;

        const conditions = p.document.getFlag?.(MOD_TERR, "conditions") ?? flags.conditions ?? [];
        const mods       = p.document.getFlag?.(MOD_TERR, "mods")       ?? flags.mods       ?? {};
        return {
          id:   p.id,
          uuid: p.document.uuid,
          label: p.document.text || p.document.name || "(unnamed)",
          terrainKey: String(key),
          terrainType: terrainType || terrain?.key || "",
          conditions,
          mods
        };
      })
      .filter(Boolean);
  }

  function hazardForHex(hex) {
    if (!hex) return null;
    const key = String(hex.terrainKey || "").toLowerCase();
    const conds = (Array.isArray(hex.conditions) ? hex.conditions : []).map(c =>
      String(c || "").toLowerCase()
    );
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

    return {
      terrain: terrainKey,
      hasRoad,
      regionHeat,
      darkness,
      stepsOnRoute: legIndex + 1
    };
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
              max-width: 1120px;      /* 👈 caps inner panel width */
              box-sizing: border-box;
              margin: 0 auto;         /* center within the window */
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
            .tc-sub {
              font-size: 0.78rem;
              opacity: 0.85;
            }
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
            .bbttcc-travel-button:hover {
              filter: brightness(1.04);
            }
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
            .rp-leg-row:last-child {
              border-bottom: none;
            }
            .rp-leg-row:hover {
              background: rgba(30,64,175,0.45);
            }
            .rp-leg-idx {
              font-size: 0.75rem;
              opacity: 0.7;
              width: 1.2rem;
              text-align: right;
            }
            .rp-leg-main {
              flex: 1;
            }
            .rp-leg-terrain {
              opacity: 0.85;
              font-size: 0.76rem;
            }
            .rp-leg-cost {
              font-size: 0.78rem;
              opacity: 0.9;
              white-space: nowrap;
            }
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
            .rp-hazard[data-type="radiation"] {
              border-color: #b91c1c;
              color: #fee2e2;
              background: #111827;
            }
            .rp-hazard[data-type="unstable"] {
              border-color: #4b5563;
              color: #e5e7eb;
              background: #020617;
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
            .tc-right-buttons {
              display:flex;
              flex-wrap:wrap;
              gap:0.4rem;
              margin-top:0.6rem;
            }
            .tc-right-buttons .bbttcc-travel-button.primary {
              background:
                radial-gradient(circle at 0 0, rgba(56,189,248,0.5), transparent 55%),
                linear-gradient(135deg,#4f46e5,#0ea5e9);
              color:#f9fafb;
              border-color:rgba(59,130,246,0.95);
            }
            .tc-right-buttons .bbttcc-travel-button.primary:hover {
              filter:brightness(1.06);
            }
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
      const $rout = content.querySelector(".rp-out");

      $fac.innerHTML = factions.map(f => `<option value="${f.id}">${enc(f.name)}</option>`).join("");

      const hexOpts = hexes.map(h => `<option value="${h.uuid}">${enc(h.label)}</option>`).join("");
      $rf.innerHTML = `<option value="">[From]</option>${hexOpts}`;
      $rt.innerHTML = `<option value="">[To]</option>${hexOpts}`;

      const legs = []; // {fromUuid, toUuid, fromId, toId}

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
          const terrKey  = t?.terrainKey || "";
          const terrInfo = dict[terrKey] || {};
          const costStr  = opToStr(terrInfo.cost || {}) || "—";
          const hazard   = hazardForHex(t);

          const hazardHtml = hazard
            ? `<span class="rp-hazard" data-type="${hazard.type}">
                 <span>${hazard.icon}</span><span>${enc(hazard.label)}</span>
               </span>`
            : "";

          return `<div class="rp-leg-row" data-index="${i}" data-to="${enc(L.toId)}">
            <span class="rp-leg-idx">${i + 1}.</span>
            <div class="rp-leg-main">
              <div>${enc(f?.label)} → ${enc(t?.label)}</div>
              <div class="rp-leg-terrain">
                [${enc(terrInfo.label || terrKey || "Unknown")}]
                ${hazardHtml}
              </div>
            </div>
            <div class="rp-leg-cost">${enc(costStr)}</div>
            <button type="button" class="rp-leg-remove" data-i="${i}">✕</button>
          </div>`;
        }).join("");

        $legs.innerHTML = rows ||
          `<div style="padding:.5rem;font-size:.82rem;opacity:.8;">No legs added yet. Pick From/To hexes and click <b>Add Leg</b>.</div>`;

        const totalOP = {};
        for (const L of legs) {
          const t = hexes.find(h => h.id === L.toId);
          const terrKey = t?.terrainKey || "";
          const cost = dict[terrKey]?.cost || {};
          for (const [k, v] of Object.entries(cost)) {
            const kk = String(k).toLowerCase();
            totalOP[kk] = (totalOP[kk] || 0) + Number(v || 0);
          }
        }

        const baseLabel = legs.length
          ? `Legs: ${legs.length} • Est. OP: ${opToStr(totalOP) || "—"}`
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
              if (afterStr) {
                $est.textContent = `${baseLabel} • After: ${afterStr}`;
              } else {
                $est.textContent = `${baseLabel} • After: (all zero)`;
              }
            } else {
              const missing = Object.entries(preview.underflow || {})
                .map(([k, info]) => {
                  const need = Math.abs(info.after);
                  return `${opLabel(k)} ${need}`;
                })
                .join(", ");
              $est.textContent = `${baseLabel} • Not enough OP${missing ? ` (short: ${missing})` : ""}`;
            }
          } catch (e) {
            console.warn(TAG, "OP preview failed in Travel Console", e);
          }
        })();

        recomputeRadiation();

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
          const toId = row.dataset.to || null;
          row.addEventListener("mouseenter", () => {
            if (toId) setHoverHex(toId);
          });
          row.addEventListener("mouseleave", () => {
            setHoverHex(null);
          });
        });
      }

      content.querySelector('[data-action="rp-add"]').onclick = () => {
        const fUuid = $rf.value;
        const tUuid = $rt.value;
        if (!fUuid || !tUuid) {
          $rout.textContent = "Pick both hexes first.";
          return;
        }
        if (fUuid === tUuid) {
          $rout.textContent = "From/To must differ.";
          return;
        }

        const fromHex = hexes.find(h => h.uuid === fUuid);
        const toHex   = hexes.find(h => h.uuid === tUuid);
        if (!fromHex || !toHex) {
          $rout.textContent = "Hex not found on this scene.";
          return;
        }

        legs.push({
          fromUuid: fUuid,
          toUuid:   tUuid,
          fromId:   fromHex.id,
          toId:     toHex.id
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
          newLegs.push({
            fromUuid: fromHex.uuid,
            toUuid:   toHex.uuid,
            fromId,
            toId
          });
        }
        legs.length = 0;
        legs.push(...newLegs);
        render();
      };

      content.querySelector('[data-action="rp-exec"]').onclick = async () => {
        try {
          const factionId = $fac.value;
          if (!factionId) {
            $rout.textContent = "Pick a faction first.";
            return;
          }
          if (!legs.length) {
            $rout.textContent = "Add at least one leg.";
            return;
          }

          const arcApi = game.bbttcc?.api?.travel?.arc;
          const arcEvents = [];

          const out = [];
          for (let i = 0; i < legs.length; i++) {
            const L = legs[i];

            try {
              if (arcApi?.rollStep) {
                const destHex = hexes.find(h => h.id === L.toId);
                const stepCtx = buildArcStepContext(destHex, i);
                if (stepCtx) {
                  const arcResult = arcApi.rollStep(stepCtx);
                  arcEvents.push({
                    index: i + 1,
                    toLabel: destHex?.label || "(unknown hex)",
                    ctx: stepCtx,
                    result: arcResult
                  });
                }
              }
            } catch (arcErr) {
              console.warn(TAG, "Travel Arc roll failed for leg", i + 1, arcErr);
            }

            const r = await game.bbttcc.api.travel.travelHex({
              factionId,
              hexFrom: L.fromUuid,  // use UUIDs for proper naming/logs
              hexTo:   L.toUuid
            });
            out.push(`${i + 1}) ${r?.summary || (r?.ok ? "Travel OK" : "Travel failed")}`);

            try {
              const dest = canvas.drawings.get(L.toId);
              if (dest) {
                const tokens = canvas.tokens.placeables.filter(t => t.actor?.id === factionId);
                let token = tokens.find(t => t.controlled) || tokens.find(t => !t.hidden) || tokens[0];
                if (token) {
                  await token.document.update({
                    x: dest.center.x - token.w / 2,
                    y: dest.center.y - token.h / 2
                  }, { animate: true });
                  ui.notifications.info(
                    `Moved faction token to ${dest.document.text || dest.document.name || dest.id}`
                  );
                  await new Promise(r => setTimeout(r, 800));
                } else {
                  console.warn(TAG, "No token found for faction", factionId);
                }
              }
            } catch (moveErr) {
              console.warn(TAG, "Move error", moveErr);
            }

            if (!r?.ok) break;
          }

          console.log(TAG, "Route results →\n" + out.join("\n"));
          if (arcEvents.length) {
            console.log(TAG, "Travel Arc events (per leg):", arcEvents);
          }

          if (game.bbttcc?.runVisuals) {
            console.log(TAG, "Launching travel visuals automatically…");
            await new Promise(r => setTimeout(r, 800));
            await game.bbttcc.runVisuals(game.bbttcc.ui.travelConsole);
          }

          let finalText = out[out.length - 1] || "Done.";
          const lastArc = arcEvents[arcEvents.length - 1];
          if (lastArc?.result) {
            const { hazard, monster, rare, worldboss } = lastArc.result;
            const bits = [];
            if (hazard?.key)   bits.push(`Hazard: ${hazard.key}`);
            if (monster?.key)  bits.push(`Monster: ${monster.key}`);
            if (rare?.key)     bits.push(`Rare: ${rare.key}`);
            if (worldboss?.key) bits.push(`World Boss: ${worldboss.key}`);
            if (bits.length) {
              finalText = `${finalText}\nArc Events (last leg): ${bits.join(" • ")}`;
            }
          }

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

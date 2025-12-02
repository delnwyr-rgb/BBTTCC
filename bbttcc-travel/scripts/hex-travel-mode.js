/* BBTTCC – Hex Travel Mode (v1.0.3)
 * Add legs 3 ways:
 *  1) Ctrl/Cmd+Click hex (clickDrawing with modifier)
 *  2) Double-click hex (dblclickDrawing)
 *  3) "Capture Next Click" button (stage pointer, robust hit-test)
 *
 * Also: faction picker, intel-aware forecasts, execute via api.travelHex.
 */

(() => {
  const MOD_FCT  = "bbttcc-factions";
  const MOD_TERR = "bbttcc-territory";

  // Engine helpers from hex-travel.js (if present)
  const H = () => game?.bbttcc?.api || {};
  const TERRAIN_TABLE     = H()?._hexTravel?.TERRAIN_TABLE || {};
  const getHexTerrainSpec = H()?._hexTravel?.getHexTerrainSpec;

  // ---------- Robust hit-test (polygon/rect) ----------
  const toPixiPoint = (x,y)=> new PIXI.Point(x,y);
  function drawingContainsGlobal(d, gx, gy) {
    try {
      const local = d.toLocal(toPixiPoint(gx, gy));
      const shape = d.document.shape || {};
      const t = (shape.type||"").toLowerCase();
      if (t === "p" || (Array.isArray(shape.points) && shape.points.length >= 6)) {
        const poly = new PIXI.Polygon(shape.points);
        return poly.contains(local.x, local.y);
      }
      const w = Number(d.document.width  ?? shape.width  ?? d.width  ?? 0);
      const h = Number(d.document.height ?? shape.height ?? d.height ?? 0);
      return local.x >= 0 && local.y >= 0 && local.x <= w && local.y <= h;
    } catch(e) { return false; }
  }
  function robustGetHexAtPoint(gx, gy) {
    const all = canvas.drawings.placeables
      .filter(d => !!d.document.getFlag(MOD_TERR))
      .sort((a,b)=> (a.zIndex||0) - (b.zIndex||0))
      .reverse();
    for (const d of all) if (drawingContainsGlobal(d, gx, gy)) return d;
    return null;
  }

  // ---------- Math / helpers ----------
  function intrigueMod(actor) {
    const fx = actor?.getFlag(MOD_FCT) || {};
    return Number(
      foundry.utils.getProperty(fx, "skills.intrigue.mod") ??
      foundry.utils.getProperty(fx, "mods.intrigue") ?? 0
    );
  }
  function darknessBump(actor, hexDrawing) {
    const fx = actor?.getFlag(MOD_FCT) || {};
    const regionId = hexDrawing?.id || "global";
    const regional = foundry.utils.getProperty(fx, `darkness.${regionId}`) ?? 0;
    const global   = foundry.utils.getProperty(fx, `darkness.global`) ?? 0;
    return Math.max(regional, global) >= 7 ? 2 : 0;
  }
  function intelConfidence(hexDrawing) {
    const intel = hexDrawing?.document?.getFlag(MOD_TERR, "intel") || {};
    const c = Number(intel.confidence ?? 0);
    return isNaN(c) ? 0 : Math.max(0, Math.min(1, c));
  }
  function successChance(dc, mod) {
    const p = (21 - (dc - mod)) / 20;
    return Math.max(0, Math.min(1, p));
  }
  function labelOP(k) {
    const L = { economy:"Economy", logistics:"Logistics", intrigue:"Intrigue",
      violence:"Violence", nonLethal:"Non-Lethal", faith:"Faith",
      diplomacy:"Diplomacy", softPower:"Soft Power" };
    return L[k] || k;
  }
  function opCostToString(cost) {
    return Object.entries(cost).filter(([_,v])=>v>0).map(([k,v])=>`${v} ${labelOP(k)}`).join(", ");
  }
  function simulateBeforeTravelHooks(ctx){ Hooks.callAll("bbttcc:beforeTravel", ctx); }

  // ---------- UI Panel ----------
  let ACTIVE = null;  // { factionId, tokenId, actor, token, path[], div, hud, hooks, _gfx, captureOnce }

  function closePanel() {
    if (!ACTIVE) return;
    if (ACTIVE.hooks?.clickDrawing)   Hooks.off("clickDrawing", ACTIVE.hooks.clickDrawing);
    if (ACTIVE.hooks?.dblclickDrawing)Hooks.off("dblclickDrawing", ACTIVE.hooks.dblclickDrawing);
    if (ACTIVE.hooks?.stagePointer)   canvas.stage.off("pointerdown", ACTIVE.hooks.stagePointer);
    try { ACTIVE.div?.remove(); } catch(e){}
    try { ACTIVE.hud?.remove(); } catch(e){}
    try { ACTIVE._gfx?.destroy(true); } catch(e){}
    ACTIVE = null;
  }

  function openPanel({ factionId, tokenId }) {
    closePanel();

    const actor = game.actors.get(factionId);
    const token = canvas.tokens.get(tokenId);
    if (!actor?.getFlag(MOD_FCT,"isFaction")) {
      ui.notifications?.warn("Select a faction token first.");
      return;
    }

    const div = document.createElement("div");
    div.id = "bbttcc-travel-panel";
    div.style.cssText = `
      position: absolute; top: 56px; right: 12px; z-index: 200;
      width: 440px; max-height: 72vh; overflow: auto;
      background: rgba(18,18,18,.94); color:#fff; padding:12px;
      border-radius: 12px; font: 13px Helvetica; box-shadow: 0 0 10px rgba(0,0,0,.45);
    `;
    document.body.appendChild(div);

    const hud = document.createElement("div");
    hud.id = "bbttcc-travel-hud";
    hud.style.cssText = `
      position:absolute; top: 6px; right: 12px; z-index: 200;
      background: rgba(25,25,25,.9); color:#fff; padding:6px 10px;
      border-radius:8px; font:12px Helvetica; box-shadow: 0 0 6px rgba(0,0,0,.35);
    `;
    hud.textContent = "Travel Mode: Ctrl/Cmd+Click or Double-click hexes to add (Esc to exit)";
    document.body.appendChild(hud);

    ACTIVE = { factionId, tokenId, actor, token, path: [], div, hud, hooks:{}, captureOnce:false };
    game.bbttcc.api.travelPlanner._active = ACTIVE;

    // 1) Ctrl/Cmd+Click on Drawing
    ACTIVE.hooks.clickDrawing = (drawing, ev) => {
      const e = ev?.data?.originalEvent;
      const mod = e?.ctrlKey || e?.metaKey; // Ctrl (Win/Linux) or Cmd (macOS)
      if (!mod) return; // leave normal click for your editor
      ev?.preventDefault?.(); ev?.stopPropagation?.();
      addHexToPath(drawing);
    };
    Hooks.on("clickDrawing", ACTIVE.hooks.clickDrawing);

    // 2) Double-click on Drawing
    ACTIVE.hooks.dblclickDrawing = (drawing, ev) => {
      ev?.preventDefault?.(); ev?.stopPropagation?.();
      addHexToPath(drawing);
    };
    Hooks.on("dblclickDrawing", ACTIVE.hooks.dblclickDrawing);

    // 3) One-shot capture on the stage (button toggles this)
    ACTIVE.hooks.stagePointer = (event) => {
      if (!ACTIVE?.captureOnce) return;
      ACTIVE.captureOnce = false;
      const { x, y } = event.data.getLocalPosition(canvas.app.stage);
      const hex = robustGetHexAtPoint(x, y);
      if (!hex) {
        ui.notifications?.warn("No hex under pointer. Try again or zoom in.");
        return;
      }
      addHexToPath(hex);
      renderPanel(); // update button label
    };
    canvas.stage.on("pointerdown", ACTIVE.hooks.stagePointer);

    // Esc to exit
    const esc = (ev)=>{ if(ev.key==="Escape") { window.removeEventListener("keydown", esc); closePanel(); } };
    window.addEventListener("keydown", esc);

    renderPanel();
  }

  function factionsList() {
    return game.actors.filter(a => a.getFlag(MOD_FCT,"isFaction"));
  }

  function renderPanel() {
    if (!ACTIVE) return;
    const { actor, path } = ACTIVE;
    const legs = Math.max(0, path.length - 1);
    const total = summarizeTotals();

    const pct = (n)=> `${Math.round(n*100)}%`;
    const [pMin, pMax] = total.successRange;

    const allF = factionsList();
    const opts = allF.map(a => `<option value="${a.id}" ${a.id===actor.id?"selected":""}>${foundry.utils.escapeHTML(a.name)}</option>`).join("");

    ACTIVE.div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:.5rem;">
        <div style="font-weight:700;">Travel Planner</div>
        <select id="bbttcc-travel-faction" style="flex:1; background:#0e0e0e; color:#fff; border:1px solid #444; padding:4px 6px; border-radius:6px;">${opts}</select>
      </div>
      <div style="margin-top:.25rem; font-size:12px; color:#bbb;">
        Add legs by <b>Ctrl/Cmd+Click</b> or <b>Double-click</b> hexes. Or use <b>Capture Next Click</b> to add the hex under your next canvas click.
      </div>
      <hr style="border-color:#333; margin:.5rem 0;"/>

      <div><b>Legs:</b> ${legs}</div>
      <div><b>Total Forecast Cost:</b> ${opCostToString(total.cost) || "—"}</div>
      <div><b>Per-Leg Safe Chance (min→max):</b> ${pct(pMin)} → ${pct(pMax)}</div>

      <div style="margin:.5rem 0; padding:.5rem; background:#111; border:1px solid #333; border-radius:8px; max-height:34vh; overflow:auto;">
        ${path.map((p,i)=>{
          if (i===0) return `<div style="margin:.25rem 0;"><b>Start:</b> ${formatHexName(p)}</div>`;
          const f = p.forecast||{};
          const cost = opCostToString(f.cost||{}) || "—";
          const band = f.pBand? `${pct(f.pBand[0])} → ${pct(f.pBand[1])}` : "—";
          const terr = p.spec?.flags?.terrainType || p.spec?.key || "Unknown";
          const intel = f.intel != null ? ` | Intel: ${(Math.round(f.intel*100))}%` : "";
          return `
            <div style="margin:.25rem 0; padding:.45rem .5rem; background:#151515; border-radius:6px;">
              <div><b>Leg ${i}</b> → <i>${terr}</i></div>
              <div>Cost: ${cost}</div>
              <div>Safe Chance: ${band}${intel}</div>
            </div>
          `;
        }).join("")}
      </div>

      <div style="display:flex; gap:.5rem; flex-wrap:wrap; align-items:center; justify-content:space-between;">
        <div class="left">
          <button id="bbttcc-capture">${ACTIVE.captureOnce ? "Click a Hex Now…" : "Capture Next Click"}</button>
        </div>
        <div class="right" style="display:flex; gap:.5rem;">
          <button id="bbttcc-travel-clear">Clear Path</button>
          <button id="bbttcc-travel-exec" ${legs? "" : "disabled"}>Confirm & Execute</button>
          <button id="bbttcc-travel-close">Close</button>
        </div>
      </div>

      <style>
        #bbttcc-travel-panel button {
          background:#2a82c7; color:#fff; border:0; padding:6px 10px; border-radius:8px; cursor:pointer;
        }
        #bbttcc-travel-panel button[disabled]{ background:#3a3a3a; cursor:not-allowed; }
        #bbttcc-travel-panel select { outline: none; }
      </style>
    `;

    // wires
    ACTIVE.div.querySelector("#bbttcc-travel-clear")?.addEventListener("click", ()=>{
      ACTIVE.path = []; drawOverlayPath(); renderPanel();
    });
    ACTIVE.div.querySelector("#bbttcc-travel-exec")?.addEventListener("click", ()=>executeRoute());
    ACTIVE.div.querySelector("#bbttcc-travel-close")?.addEventListener("click", ()=>closePanel());
    ACTIVE.div.querySelector("#bbttcc-travel-faction")?.addEventListener("change", (e)=>{
      const newId = e.currentTarget.value;
      const newActor = game.actors.get(newId);
      if (!newActor) return;
      ACTIVE.actor = newActor;
      ACTIVE.factionId = newId;
      if (!ACTIVE.token || ACTIVE.token.actor?.id !== newId) {
        const first = canvas.tokens.placeables.find(t=>t.actor?.id === newId);
        if (first) ACTIVE.token = first;
      }
      for (let i=1;i<(ACTIVE.path?.length||0);i++) forecastLeg(i);
      renderPanel();
    });
    ACTIVE.div.querySelector("#bbttcc-capture")?.addEventListener("click", ()=>{
      ACTIVE.captureOnce = true;
      renderPanel();
      ui.notifications?.info?.("Click the canvas to add the hex under your pointer.");
    });
  }

  function formatHexName(p) {
    const f = p.spec?.flags || {};
    return f.name || f.hexName || p.hex?.id || "Hex";
  }

  function addHexToPath(hexDrawing) {
    if (!ACTIVE) return;
    const center = hexDrawing.center;
    const hasFlags = !!hexDrawing?.document?.getFlag(MOD_TERR);
    // use engine helper if flags exist; else safe defaults
    const specFull = hasFlags && getHexTerrainSpec ? getHexTerrainSpec(hexDrawing)
      : { key:"unknown", spec: { cost: { economy:1 }, tier: 1 }, flags: { terrainType: "Unknown" } };

    ACTIVE.path.push({ hex: hexDrawing, center, spec: specFull });
    forecastLeg(ACTIVE.path.length - 1);
    drawOverlayPath();
    renderPanel();
  }

  function drawOverlayPath() {
    try { ACTIVE?._gfx?.destroy(true); } catch(e){}
    if (!ACTIVE || !ACTIVE.path?.length) return;
    const g = new PIXI.Graphics();
    g.zIndex = 1000;
    const pts = ACTIVE.path.map(p=>p.center);
    if (pts.length >= 2) {
      g.lineStyle(4, 0x4FC3F7, 0.9);
      g.moveTo(pts[0].x, pts[0].y);
      for (let i=1;i<pts.length;i++) g.lineTo(pts[i].x, pts[i].y);
    }
    for (const p of ACTIVE.path) {
      const b = p.hex.bounds;
      g.beginFill(0x42A5F5, 0.15);
      g.drawRoundedRect(b.x, b.y, b.width, b.height, 8);
      g.endFill();
    }
    canvas.stage.addChild(g);
    ACTIVE._gfx = g;
  }

  function forecastLeg(i) {
    if (i===0) return;
    const { actor, token, path } = ACTIVE;
    const prev = path[i-1], curr = path[i];

    const terrKey = curr.spec?.key || "";
    const terrainSpec = TERRAIN_TABLE[terrKey] || curr.spec?.spec || { cost:{ economy:1 }, tier:1 };
    const baseCost = foundry.utils.duplicate(terrainSpec.cost || { economy:1 });
    const tier = Number(terrainSpec.tier || 1);

    const ctx = {
      factionId: actor.id, actor, from: prev.hex, to: curr.hex,
      terrainKey: terrKey, terrainTier: tier,
      cost: baseCost, crew: actor.getFlag(MOD_FCT, "crew") || [],
      preventHazard: false, dcMod: 0, token
    };
    simulateBeforeTravelHooks(ctx);

    const dc  = 15 + (tier*2) + ctx.dcMod + darknessBump(actor, curr.hex);
    const mod = intrigueMod(actor);

    const intel = intelConfidence(curr.hex);
    const dcSpread = Math.round((1 - intel) * 3);
    const pLo = successChance(dc + dcSpread, mod);
    const pHi = successChance(dc - dcSpread, mod);

    curr.forecast = { cost: ctx.cost, dc, mod, pBand:[Math.min(pLo,pHi), Math.max(pLo,pHi)], intel };
    curr.ctx = ctx;
  }

  function summarizeTotals() {
    const total = { cost:{}, successRange:[1,0] };
    let any = false;
    for (let i=1;i<(ACTIVE.path?.length||0);i++) {
      const f = ACTIVE.path[i].forecast;
      if (!f) continue;
      for (const [k,v] of Object.entries(f.cost||{})) total.cost[k] = (total.cost[k]||0) + (v||0);
      const [lo, hi] = f.pBand || [1,1];
      total.successRange[0] = Math.min(total.successRange[0], lo);
      total.successRange[1] = Math.max(total.successRange[1], hi);
      any = true;
    }
    if (!any) total.successRange = [1,1];
    return total;
  }

  async function executeRoute() {
    const { actor, token, path } = ACTIVE;
    if (!path || path.length < 2) return;

    const hexes = path.map(p=>p.hex.id);
    for (let i=0;i<hexes.length-1;i++) {
      const hexFrom = hexes[i], hexTo = hexes[i+1];
      try {
        await H().travelHex({ factionId: actor.id, hexFrom, hexTo, tokenId: token.id });
        const to = canvas.drawings.get(hexTo);
        if (to) await token.document.update({ x: to.center.x - token.w/2, y: to.center.y - token.h/2 });
      } catch (e) {
        ui.notifications?.error?.(`Travel aborted on leg ${i+1}: ${e.message}`);
        return;
      }
    }
    ui.notifications?.info?.("Travel complete.");
    closePanel();
  }

  // ---------- HUD button & API ----------
  function addSceneButton() {
    const id = "bbttcc-travel-mode-btn";
    const old = document.getElementById(id);
    if (old) old.remove();
    const btn = document.createElement("div");
    btn.id = id;
    btn.style.cssText = `
      position:absolute; top: 6px; right: 180px; z-index: 200;
      background: rgba(20,20,20,.9); color:#fff; padding:6px 10px; border-radius:8px;
      cursor:pointer; font: 12px Helvetica; box-shadow: 0 0 6px rgba(0,0,0,.35);
    `;
    btn.textContent = "Open Travel Planner";
    btn.onclick = () => {
      const token = canvas.tokens.controlled[0] || canvas.tokens.placeables[0];
      const actor = token?.actor;
      if (!actor?.getFlag(MOD_FCT,"isFaction")) return ui.notifications?.warn?.("Select a faction token first.");
      openPanel({ factionId: actor.id, tokenId: token.id });
    };
    document.body.appendChild(btn);
  }

  Hooks.on("canvasReady", addSceneButton);

  Hooks.once("ready", () => {
    game.bbttcc = game.bbttcc || { api:{} };
    game.bbttcc.api.travelPlanner = {
      open({ factionId, tokenId }={}) { openPanel({ factionId, tokenId }); },
      close() { closePanel(); },
      _active: null
    };
    console.log("[bbttcc] Travel Planner (v1.0.3) ready.");
  });

})();

/* BBTTCC – Hex Travel Visual Engine (v1.1)
 * Foundry v13.348 compatible
 *
 * Features:
 *  - Token-driven travel: crossing hex → api.travelHex()
 *  - Terrain-aware OP costs + crew hooks (before/after)
 *  - 1d20 + Intrigue vs (15 + tier*2) for encounter
 *  - Visual trail, cost pop-ups, roll pulse, encounter marker
 *  - War Log entry + optional travel state on destination hex
 *
 * Sources (design alignment):
 *  - Sprint Brief: Hex Movement System v1.0 (api.travelHex, hooks, DC, war log) – pages 1–2:contentReference[oaicite:2]{index=2}
 *  - Terrain/Movement/Crew/Encounter Reference (tiers, encounter bias):contentReference[oaicite:3]{index=3}
 */

(() => {
  const MOD_FCT = "bbttcc-factions";
  const MOD_TERR = "bbttcc-territory";
  const API_PATH = "bbttcc";

  // --- Config ----------------------------------------------------------------

  /** Terrain base OP costs (Economy/Logistics/Intrigue), tier, and encounter bias.
   *  Adjust to match your table; keys must match drawing.flags[bbttcc-territory].terrainType */
  const TERRAIN_TABLE = {
    "plains":        { cost: { economy:1 }, tier:1, bias:"balanced" },
    "grasslands":    { cost: { economy:1 }, tier:1, bias:"balanced" },
    "forest":        { cost: { economy:1, intrigue:1 }, tier:2, bias:"hazard" },
    "jungle":        { cost: { economy:1, intrigue:1 }, tier:2, bias:"hazard" },
    "mountains":     { cost: { economy:2, logistics:1 }, tier:3, bias:"hazard" },
    "highlands":     { cost: { economy:2, logistics:1 }, tier:3, bias:"hazard" },
    "canyons":       { cost: { economy:1, violence:1 }, tier:2, bias:"combat" },
    "badlands":      { cost: { economy:1, violence:1 }, tier:2, bias:"combat" },
    "swamp":         { cost: { economy:2, nonLethal:1 }, tier:3, bias:"hazard" },
    "mire":          { cost: { economy:2, nonLethal:1 }, tier:3, bias:"hazard" },
    "desert":        { cost: { economy:2 }, tier:2, bias:"discovery" },
    "ashWastes":     { cost: { economy:2 }, tier:2, bias:"discovery" },
    "river":         { cost: { economy:1, logistics:1 }, tier:1, bias:"discovery" },
    "lake":          { cost: { economy:1, logistics:1 }, tier:1, bias:"discovery" },
    "sea":           { cost: { economy:3, logistics:2 }, tier:4, bias:"discovery" },
    "ocean":         { cost: { economy:3, logistics:2 }, tier:4, bias:"discovery" },
    "ruins":         { cost: { economy:1, intrigue:1 }, tier:2, bias:"mix" },
    "urbanWreckage": { cost: { economy:1, intrigue:1 }, tier:2, bias:"mix" },
    "wasteland":     { cost: { economy:1, faith:1 }, tier:4, bias:"extreme" },
    "radiation":     { cost: { economy:1, faith:1 }, tier:4, bias:"extreme" }
  };

  // Visual toggles
  const VISUALS = {
    trail: true,
    popups: true,
    dicePulse: true,
    encounterMarker: true,
    trailFadeMs: 5000,
    popupMs: 2500,
    pulseMs: 900
  };

  // --- Utility ---------------------------------------------------------------

  function isFactionActor(actor) {
    return !!actor?.getFlag(MOD_FCT, "isFaction");
  }

  function getFactionAPI() {
    return game?.bbttcc?.api?.factions || game.modules.get("bbttcc-raid")?.api?.factions;
  }

  function getRaidAPI() {
    return game?.bbttcc?.api?.raid || game.modules.get("bbttcc-raid")?.api?.raid;
  }

  function getFactionColor(actor) {
    return actor?.getFlag(MOD_FCT, "color") || "#33AAFF";
  }

  function normalizeTerrainKey(t) {
    return String(t || "").replace(/\s+/g, "").replace(/[^\w]/g, "").toLowerCase();
  }

  function getHexAtPoint(x, y) {
    // Any Drawing with bbttcc-territory flags and containsPoint
    const dwgs = canvas.drawings.placeables;
    for (const d of dwgs) {
      const f = d.document.getFlag(MOD_TERR);
      if (!f) continue;
      // Foundry drawings have a convenient containsPoint if polygonal; fallback to bounds check.
      const pt = new PIXI.Point(x, y);
      if (d.bounds?.contains(x, y) || d.containsPoint?.(pt)) return d;
    }
    return null;
  }

  function getHexTerrainSpec(drawing) {
    const flags = drawing?.document?.getFlag(MOD_TERR) || {};
    const key = normalizeTerrainKey(flags.terrainType || flags.terrain || "");
    return { key, spec: TERRAIN_TABLE[key], flags };
  }

  function clone(o) { return foundry.utils.duplicate(o || {}); }

  async function spendOP({ factionId, cost }) {
    const api = getFactionAPI();
    if (!api?.spendOP) throw new Error("Faction API spendOP not available.");
    return api.spendOP({ factionId, spend: cost });
  }

  function getFactionIntrigueMod(actor) {
    // Try a few places; default 0 to stay safe if not modeled.
    const fx = actor?.getFlag(MOD_FCT) || {};
    return Number(
      foundry.utils.getProperty(fx, "skills.intrigue.mod") ??
      foundry.utils.getProperty(fx, "mods.intrigue") ??
      0
    );
  }

  function darknessEncounterBoost(actor, hexDrawing) {
    // Optional: read region/global darkness to modify encounter odds.
    const fx = actor?.getFlag(MOD_FCT) || {};
    const regionId = hexDrawing?.id || "global";
    const regional = foundry.utils.getProperty(fx, `darkness.${regionId}`) ?? 0;
    const global = foundry.utils.getProperty(fx, `darkness.global`) ?? 0;
    const worst = Math.max(regional, global);
    return worst >= 7 ? 2 : 0; // +2 DC pressure as “doubles encounter chance” proxy:contentReference[oaicite:4]{index=4}
  }

  // --- Visuals ---------------------------------------------------------------

  function drawTrail(a, b, color = "#33AAFF") {
    if (!VISUALS.trail) return;
    const g = new PIXI.Graphics();
    g.lineStyle(4, PIXI.utils.string2hex(color), 0.9);
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    canvas.stage.addChild(g);
    setTimeout(() => g.destroy(true), VISUALS.trailFadeMs);
  }

  function popupText(pos, text) {
    if (!VISUALS.popups) return;
    const style = new PIXI.TextStyle({
      fontFamily: "Helvetica", fontSize: 18, fill: 0xFFFFFF, stroke: 0x000000, strokeThickness: 4
    });
    const t = new PIXI.Text(text, style);
    t.anchor.set(0.5, 1.2);
    t.position.set(pos.x, pos.y);
    canvas.stage.addChild(t);
    // Float up + fade
    const dy = -40;
    const ms = VISUALS.popupMs;
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / ms);
      t.position.y = pos.y + dy * p;
      t.alpha = 1 - p;
      if (p < 1) requestAnimationFrame(tick); else t.destroy(true);
    };
    tick();
  }

  function pulseToken(token, colorHex = "#00FF66") {
    if (!VISUALS.dicePulse) return;
    const c = PIXI.utils.string2hex(colorHex);
    const orig = token.border?.alpha ?? 0;
    let state = 0;
    const id = setInterval(() => {
      state++;
      const on = state % 2 === 1;
      try {
        token.border = token.border || new PIXI.Graphics();
        token.border.clear();
        token.border.lineStyle(6, c, on ? 0.9 : 0.2);
        const b = token.getBounds();
        token.border.drawRoundedRect(b.x - 4, b.y - 4, b.width + 8, b.height + 8, 8);
        if (!token.border.parent) canvas.stage.addChild(token.border);
      } catch(e) {/* noop */}
    }, 150);
    setTimeout(() => {
      clearInterval(id);
      try { token.border?.destroy(true); } catch(e) {}
      token.border = null;
    }, VISUALS.pulseMs);
  }

  let _encounterSymbols = new Map();
  function placeEncounterIcon(hexDrawing, label="Encounter") {
    if (!VISUALS.encounterMarker || !hexDrawing) return;
    const center = hexDrawing.center;
    const style = new PIXI.TextStyle({ fontFamily:"Helvetica", fontSize:22, fill:0xFFD166, stroke:0x000000, strokeThickness:4 });
    const icon = new PIXI.Text("⚔️", style);
    icon.anchor.set(0.5, 0.5);
    icon.position.set(center.x, center.y);
    icon.interactive = true;
    icon.buttonMode = true;
    icon.eventMode = "static";
    icon.cursor = "pointer";
    icon.on("pointerdown", () => {
      // GM can open raid console or scenario browser here; leave to your UI layer
      ui.notifications?.info?.(`${label}: click your Raid/Scenario UI to resolve.`);
    });
    canvas.stage.addChild(icon);
    // soft pulse
    let grow = true;
    const id = setInterval(() => {
      icon.scale.set(grow ? 1.15 : 1.0);
      grow = !grow;
    }, 400);
    _encounterSymbols.set(hexDrawing.id, { icon, id });
    setTimeout(() => removeEncounterIcon(hexDrawing.id), 15000); // auto-clean
  }
  function removeEncounterIcon(hexId) {
    const rec = _encounterSymbols.get(hexId);
    if (!rec) return;
    clearInterval(rec.id);
    try { rec.icon.destroy(true); } catch(e) {}
    _encounterSymbols.delete(hexId);
  }

  // --- Core Travel -----------------------------------------------------------

  async function travelHex({ factionId, hexFrom, hexTo, tokenId=null } = {}) {
    if (!factionId || !hexFrom || !hexTo) throw new Error("travelHex: missing factionId/hexFrom/hexTo");
    const actor = game.actors.get(factionId);
    if (!isFactionActor(actor)) throw new Error("travelHex: actor is not a faction");

    const from = canvas.drawings.get(hexFrom);
    const to   = canvas.drawings.get(hexTo);
    if (!to) throw new Error("travelHex: destination hex not found");

    const { spec, key, flags: terrFlags } = getHexTerrainSpec(to);
    if (!spec) throw new Error(`travelHex: unknown terrain type '${terrFlags?.terrainType || key}'`);

    // Build travel context
    const ctx = {
      factionId, actor, from, to,
      terrainKey: key,
      terrainTier: Number(spec.tier || 1),
      cost: clone(spec.cost),  // mutable; crew hooks can modify
      crew: actor.getFlag(MOD_FCT, "crew") || [],
      preventHazard: false,
      dcMod: 0,   // crew hooks can add/sub
      token: tokenId ? canvas.tokens.get(tokenId) : null
    };

    // Crew & terrain hooks (before) – allows Recon Rangers, Storm Wardens, etc.:contentReference[oaicite:5]{index=5}
    Hooks.callAll("bbttcc:beforeTravel", ctx);

    // Visual trail
    const a = from?.center || ctx.token?.center || { x: to.center.x - 20, y: to.center.y - 20 };
    const b = to.center;
    drawTrail(a, b, getFactionColor(actor));

    // Spend OPs via factions API (Regeneration Pipeline):contentReference[oaicite:6]{index=6}
    await spendOP({ factionId, cost: ctx.cost });

    // Popup costs
    const mid = { x: (a.x + b.x)/2, y: (a.y + b.y)/2 };
    const costTxt = Object.entries(ctx.cost).map(([k,v]) => (v>0?`-${v} ${labelOP(k)}`:null)).filter(Boolean).join(", ");
    if (costTxt) popupText(mid, costTxt);

    // Encounter roll: 1d20 + Intrigue vs (15 + tier*2 + adjustments):contentReference[oaicite:7]{index=7}
    const intrigueMod = getFactionIntrigueMod(actor);
    const darknessBump = darknessEncounterBoost(actor, to); // optional: Darkness ≥7 raises pressure:contentReference[oaicite:8]{index=8}
    const dc = 15 + (ctx.terrainTier * 2) + ctx.dcMod + darknessBump;

    const roll = await (new Roll("1d20 + @int", { int: intrigueMod })).evaluate({ async: true });
    const success = roll.total >= dc;
    pulseToken(ctx.token ?? canvas.tokens.controlled[0] ?? canvas.tokens.placeables[0], success ? "#00FF66" : "#FF3366");
    popupText(b, `Travel Check ${roll.total} vs DC ${dc} ${success ? "✅" : "❌"}`);

    // Travel data stub on destination hex:contentReference[oaicite:9]{index=9}
    const travelStub = {
      active: true,
      factionId,
      hexFrom, hexTo,
      terrainType: terrFlags?.terrainType || key,
      opCost: ctx.cost,
      crewUsed: ctx.crew,
      result: success ? "safe" : (ctx.preventHazard ? "safe" : "encounter"),
      encounterTier: ctx.terrainTier
    };
    await to.document.setFlag(MOD_TERR, "travel", travelStub).catch(()=>{ /* non-fatal */ });

    // Encounter trigger or safe arrival
    let encounterLabel = "";
    if (!success && !ctx.preventHazard) {
      // Choose an encounter family from Terrain Reference; raid API schedules a travelEncounter:contentReference[oaicite:10]{index=10}
      const raid = getRaidAPI();
      if (raid?.scheduleEvent) {
        await raid.scheduleEvent({ kind: "travelEncounter", tier: ctx.terrainTier, hexId: to.id, terrain: key, factionId });
      }
      encounterLabel = `Encounter (Tier ${ctx.terrainTier})`;
      placeEncounterIcon(to, encounterLabel);
    }

    // War Log entry:contentReference[oaicite:11]{index=11}
    await writeWarLog(actor, {
      kind: "travel",
      hexFrom, hexTo,
      terrain: terrFlags?.terrainType || key,
      opSpent: ctx.cost,
      roll: roll.total,
      dc,
      result: success ? "safe" : (ctx.preventHazard ? "safe-prevented" : "encounter"),
      note: encounterLabel
    });

    // Crew & terrain hooks (after)
    Hooks.callAll("bbttcc:afterTravel", { ...ctx, success, rollTotal: roll.total, dc });

    return { success, dc, roll: roll.total, context: ctx };
  }

  function labelOP(k) {
    const L = {
      economy: "Economy OP",
      logistics: "Logistics",
      intrigue: "Intrigue OP",
      violence: "Violence OP",
      nonLethal: "Non-Lethal OP",
      faith: "Faith OP",
      diplomacy: "Diplomacy OP",
      softPower: "Soft Power OP"
    };
    return L[k] || k;
  }

  async function writeWarLog(actor, entry) {
    const api = getFactionAPI();
    if (api?.logWar) {
      return api.logWar(actor.id, entry);
    }
    // Fallback: push onto flag
    const prev = actor.getFlag(MOD_FCT, "warLogs") || [];
    const now = new Date().toISOString();
    const log = { ts: now, ...entry };
    prev.push(log);
    await actor.setFlag(MOD_FCT, "warLogs", prev);
  }

  // --- Token hook: trigger travel when crossing hexes ------------------------

  Hooks.on("updateToken", async (doc, changes, opts, userId) => {
    // Only react to position moves
    if (changes.x === undefined && changes.y === undefined) return;
    const token = canvas.tokens.get(doc.id);
    const actor = token?.actor;
    if (!isFactionActor(actor)) return;

    // Previous and new positions → hex detection
    const prevX = doc._source.x ?? doc.x, prevY = doc._source.y ?? doc.y;
    const fromHex = getHexAtPoint(prevX, prevY);
    const toHex   = getHexAtPoint(doc.x ?? prevX, doc.y ?? prevY);
    if (!fromHex || !toHex || fromHex.id === toHex.id) return;

    try {
      await travelHex({ factionId: actor.id, hexFrom: fromHex.id, hexTo: toHex.id, tokenId: token.id });
    } catch (err) {
      console.error("[bbttcc] travelHex error:", err);
      ui.notifications?.error?.(`Travel failed: ${err.message}`);
    }
  });

  // --- API registration ------------------------------------------------------

  Hooks.once("ready", () => {
    // mount bbttcc.api if not present
    game.bbttcc = game.bbttcc || { api: {} };
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.travelHex = travelHex;

    // Optional: expose utilities
    game.bbttcc.api._hexTravel = {
      TERRAIN_TABLE,
      getHexAtPoint,
      getHexTerrainSpec
    };

    console.log("[bbttcc] Hex Travel Visual Engine ready.");
  });

})();

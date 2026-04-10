/* ---------- bbttcc-territory / scripts/main.js (Auto-calc restored + Manual Override) ---------- */

// BBTTCC_TERR_DASH_CLEANUP
// AppV2 safety: clear legacy Territory Dashboard singleton reference.
// The opener should use game.bbttcc.apps.territoryDashboard (or BBTTCC_OpenTerritoryDashboard).
Hooks.once("ready", () => {
  try {
    const desc = Object.getOwnPropertyDescriptor(globalThis, "__bbttcc_dashboard");
    if (desc && ("value" in desc)) delete globalThis.__bbttcc_dashboard;
  } catch (e) {
    console.warn("[bbttcc-territory] dashboard cleanup failed", e);
  }
});

const MOD = "bbttcc-territory";
const TOOLBAR_ID = "bbttcc-toolbar";
const renderTpl = foundry.applications?.handlebars?.renderTemplate || renderTemplate;
const TPL_HEX_CONFIG = `modules/${MOD}/templates/hex-config.hbs`;

/* ---------------- Terrain Canon (Normalization) ----------------
 * Canonical terrain storage (single source of truth):
 *   flags.bbttcc-territory.terrain = { key, label }
 *
 * Compatibility (legacy readers):
 *   flags.bbttcc-territory.terrainType = key
 *   flags.bbttcc-territory.terrainKey  = key
 *
 * We normalize on every Hex Config save (writer-of-record) and provide a GM
 * helper to migrate existing hexes on the *current scene*.
 */
const BBTTCC_TERRAIN_LABELS = {
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

function bbttccTerrainFromType(type) {
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

function bbttccNormalizeTerrainKey(raw) {
  const s = String(raw || "").trim();
  const low = s.toLowerCase();

  let mapped =
    (low.includes("mountain") || low.includes("highland")) ? "mountains" :
    (low.includes("canyon") || low.includes("badland")) ? "canyons" :
    (low.includes("swamp") || low.includes("mire") || low.includes("marsh")) ? "swamp" :
    (low.includes("forest") || low.includes("jungle")) ? "forest" :
    (low.includes("desert") || low.includes("ash")) ? "desert" :
    (low.includes("river") || low.includes("lake")) ? "river" :
    (low.includes("sea") || low.includes("ocean")) ? "ocean" :
    (low.includes("ruin") || low.includes("urban")) ? "ruins" :
    (low.includes("wasteland") || low.includes("radiation")) ? "wasteland" :
    (low.includes("plain") || low.includes("grass")) ? "plains" :
    s;

  if (mapped === "ashwastes") mapped = "ashWastes";
  if (mapped === "urbanwreckage") mapped = "urbanWreckage";
  return mapped || "plains";
}

function bbttccReadTerrainKeyFromFlags(tf) {
  try {
    if (!tf || typeof tf !== "object") return null;
    const terr = tf.terrain;
    const fromObj = (terr && typeof terr === "object") ? (terr.key || terr.label) : null;
    const raw =
      fromObj ||
      tf.terrainKey ||
      tf.terrainType ||
      terr ||
      null;
    if (!raw) return null;
    return bbttccNormalizeTerrainKey(raw);
  } catch (_e) { return null; }
}

function bbttccBuildTerrainObj(key) {
  const k = bbttccNormalizeTerrainKey(key);
  return { key: k, label: BBTTCC_TERRAIN_LABELS[k] || k };
}

async function bbttccMigrateTerrainFlagsCurrentScene({ dryRun=false } = {}) {
  const draws = canvas?.drawings?.placeables || [];
  let scanned=0, updated=0, unchanged=0, unknown=0;
  const changed = [];

  for (const p of draws) {
    const doc = p?.document;
    const tf = doc?.flags?.[MOD];
    if (!tf || typeof tf !== "object") continue;
    scanned++;

    let key = bbttccReadTerrainKeyFromFlags(tf);
    if (!key) key = bbttccTerrainFromType(tf.type);
    if (!key) { unknown++; continue; }

    const terrObj = bbttccBuildTerrainObj(key);

    const cur = tf.terrain;
    const curKey = (cur && typeof cur === "object") ? String(cur.key || "") : String(tf.terrainKey || tf.terrainType || "");
    const curLabel = (cur && typeof cur === "object") ? String(cur.label || "") : "";

    const already =
      (cur && typeof cur === "object" && curKey === terrObj.key && curLabel === terrObj.label) &&
      String(tf.terrainType || "") === terrObj.key &&
      String(tf.terrainKey  || "") === terrObj.key;

    if (already) { unchanged++; continue; }

    updated++;
    changed.push({ id: doc.id, name: doc.text || tf.name || "(hex)", key: terrObj.key, label: terrObj.label });

    if (!dryRun) {
      await doc.update({
        [`flags.${MOD}.terrain`]: terrObj,
        [`flags.${MOD}.terrainType`]: terrObj.key,
        [`flags.${MOD}.terrainKey`]: terrObj.key
      }, { parent: doc.parent });
    }
  }

  console.log("[bbttcc-territory][terrain-migrate] Done", { scanned, updated, unchanged, unknown, dryRun, changed });
  try {
    if (changed.length) console.table(changed);
    ui?.notifications?.info?.(`Terrain normalize (${dryRun ? "dry run" : "applied"}): updated ${updated}/${scanned} (unknown: ${unknown}).`);
  } catch (_e) {}
  return { ok:true, scanned, updated, unchanged, unknown, dryRun, changed };
}

/* ---------------- War Log normalization (Alpha infra) ----------------
 * Some writers emit warLog entries with ts but no date, or date but no ts.
 * This hook normalizes any bbttcc-factions warLogs being written in an Actor update:
 * - ensures every entry has ts (number, ms)
 * - ensures every entry has date (locale string derived from ts)
 * Safe: only touches the update payload when warLogs are present.
 */
function bbttccNormalizeWarLogsInUpdate(updateData) {
  const MOD = "bbttcc-factions";
  const flags = updateData?.flags?.[MOD];
  if (!flags) return;

  // warLogs is the canonical key in this build; some older writers used warLog(s)
  const key = Array.isArray(flags.warLogs) ? "warLogs"
            : Array.isArray(flags.warLog)  ? "warLog"
            : null;
  if (!key) return;

  const now = Date.now();
  const arr = flags[key];
  if (!Array.isArray(arr)) return;

  flags[key] = arr.map((e) => {
    if (!e || typeof e !== "object") return e;
    const out = { ...e };

    // Prefer explicit ts; if absent, try to parse date; else use now.
    let ts = (typeof out.ts === "number" && Number.isFinite(out.ts)) ? out.ts : null;
    if (ts == null && typeof out.date === "string" && out.date.trim()) {
      const parsed = Date.parse(out.date);
      if (Number.isFinite(parsed)) ts = parsed;
    }
    if (ts == null) ts = now;
    out.ts = ts;

    // Ensure date is present and derived from ts (matching other subsystems' formatting)
    if (typeof out.date !== "string" || !out.date.trim()) {
      try { out.date = new Date(ts).toLocaleString(); }
      catch { out.date = new Date(now).toLocaleString(); }
    }

    return out;
  });
}

/* ---------------- Handlebars helpers ---------------- */
Hooks.once("init", () => {
// Normalize bbttcc-factions warLogs so every entry has both ts and date.
Hooks.on("preUpdateActor", (actor, updateData) => {
  try { bbttccNormalizeWarLogsInUpdate(updateData); } catch (e) {}
});


  if (!Handlebars.helpers.bbttcc_eq)
    Handlebars.registerHelper("bbttcc_eq", (a,b)=>String(a)===String(b));
  if (!Handlebars.helpers.bbttcc_contains)
    Handlebars.registerHelper("bbttcc_contains", (arr,v)=>{
      if (!arr) return false;
      if (Array.isArray(arr)) return arr.includes(v);
      return String(arr).split(",").map(s=>s.trim()).includes(v);
    });
});

/* ---------------- Visuals ---------------- */
const BBTTCC_STATUS_STYLE = {
  unclaimed: { fillColor:"#24313f", strokeColor:"#d9e6f2", fillAlpha:0.14, strokeAlpha:1.00, strokeWidth:6, textColor:"#f8fbff" },
  claimed:   { fillColor:"#0e2b3b", strokeColor:"#39d5ff", fillAlpha:0.18, strokeAlpha:1.00, strokeWidth:7, textColor:"#f3fbff" },
  contested: { fillColor:"#332508", strokeColor:"#ffd166", fillAlpha:0.19, strokeAlpha:1.00, strokeWidth:7, textColor:"#fff8df" },
  occupied:  { fillColor:"#321338", strokeColor:"#ff5ac8", fillAlpha:0.20, strokeAlpha:1.00, strokeWidth:7, textColor:"#fff4fc" }
};

const BBTTCC_TYPE_STYLE = {
  wilderness: { fillTint:"#8193a3", fillWeight:0.10 },
  settlement: { strokeTint:"#6ee7ff", strokeWeight:0.18, fillTint:"#17334a", fillWeight:0.12 },
  fortress:   { strokeTint:"#ff8f5a", strokeWeight:0.30, fillTint:"#472012", fillWeight:0.20, strokeWidthBonus:1 },
  mine:       { strokeTint:"#ffd38a", strokeWeight:0.26, fillTint:"#4a3720", fillWeight:0.18 },
  farm:       { strokeTint:"#fff0a8", strokeWeight:0.20, fillTint:"#2f3512", fillWeight:0.16 },
  port:       { strokeTint:"#7be7ff", strokeWeight:0.28, fillTint:"#0f2943", fillWeight:0.18 },
  factory:    { strokeTint:"#ff9f7a", strokeWeight:0.25, fillTint:"#41231c", fillWeight:0.18 },
  research:   { strokeTint:"#9c8cff", strokeWeight:0.28, fillTint:"#201c49", fillWeight:0.20 },
  temple:     { strokeTint:"#ffe58a", strokeWeight:0.30, fillTint:"#4a4314", fillWeight:0.18 },
  ruins:      { strokeTint:"#c6b7ff", strokeWeight:0.22, fillTint:"#353047", fillWeight:0.18 },
  wasteland:  { strokeTint:"#ff7f7f", strokeWeight:0.20, fillTint:"#4b1f2b", fillWeight:0.18 }
};

const BBTTCC_TERRAIN_STYLE = {
  plains:         { fillTint:"#7b8f64", fillWeight:0.08 },
  grasslands:     { fillTint:"#88a36c", fillWeight:0.08 },
  forest:         { fillTint:"#375b49", fillWeight:0.10 },
  jungle:         { fillTint:"#28624d", fillWeight:0.12 },
  mountains:      { strokeTint:"#ffffff", strokeWeight:0.08, fillTint:"#5b6573", fillWeight:0.08 },
  highlands:      { strokeTint:"#ffffff", strokeWeight:0.08, fillTint:"#5b6573", fillWeight:0.08 },
  canyons:        { fillTint:"#76513a", fillWeight:0.10 },
  badlands:       { fillTint:"#76513a", fillWeight:0.10 },
  swamp:          { fillTint:"#395046", fillWeight:0.12 },
  mire:           { fillTint:"#395046", fillWeight:0.12 },
  desert:         { fillTint:"#7d6841", fillWeight:0.10 },
  ashWastes:      { fillTint:"#655560", fillWeight:0.12 },
  river:          { strokeTint:"#9ae7ff", strokeWeight:0.16, fillTint:"#1c4860", fillWeight:0.14 },
  lake:           { strokeTint:"#9ae7ff", strokeWeight:0.16, fillTint:"#1c4860", fillWeight:0.14 },
  sea:            { strokeTint:"#9ae7ff", strokeWeight:0.16, fillTint:"#1c4860", fillWeight:0.14 },
  ocean:          { strokeTint:"#9ae7ff", strokeWeight:0.16, fillTint:"#1c4860", fillWeight:0.14 },
  ruins:          { fillTint:"#4a4255", fillWeight:0.12 },
  urbanWreckage:  { fillTint:"#4a4255", fillWeight:0.12 },
  wasteland:      { fillTint:"#5a3946", fillWeight:0.12 },
  radiation:      { strokeTint:"#d0ff66", strokeWeight:0.18, fillTint:"#355012", fillWeight:0.16 }
};

function bbttccClamp01(n) {
  n = Number(n);
  if (!Number.isFinite(n)) n = 0;
  return Math.max(0, Math.min(1, n));
}

function bbttccHexToRgb(hex) {
  const raw = String(hex || "").replace(/[^0-9a-f]/gi, "");
  const h = raw.length === 3
    ? raw.replace(/(.)/g, "$1$1")
    : (raw + "000000").slice(0, 6);
  return {
    r: parseInt(h.slice(0,2), 16) || 0,
    g: parseInt(h.slice(2,4), 16) || 0,
    b: parseInt(h.slice(4,6), 16) || 0
  };
}

function bbttccRgbToHex(rgb) {
  function c(v) {
    const n = Math.max(0, Math.min(255, Math.round(Number(v) || 0)));
    return n.toString(16).padStart(2, "0");
  }
  return "#" + c(rgb.r) + c(rgb.g) + c(rgb.b);
}

function bbttccMixHex(a, b, weightB) {
  const w = bbttccClamp01(weightB);
  const A = bbttccHexToRgb(a);
  const B = bbttccHexToRgb(b);
  return bbttccRgbToHex({
    r: A.r + (B.r - A.r) * w,
    g: A.g + (B.g - A.g) * w,
    b: A.b + (B.b - A.b) * w
  });
}

function bbttccVisualTypeKey(raw) {
  return String(raw || "wilderness").trim().toLowerCase();
}

function bbttccVisualTerrainKey(flags) {
  const terrObj = flags && flags.terrain && typeof flags.terrain === "object" ? flags.terrain : null;
  const terrRaw = terrObj ? (terrObj.key || terrObj.label || "") : (flags && (flags.terrainKey || flags.terrainType || ""));
  return bbttccNormalizeTerrainKey(terrRaw || bbttccTerrainFromType(flags && flags.type));
}

function bbttccHasLeyGate(flags) {
  try {
    return !!(flags && flags.leylines && flags.leylines.gate && flags.leylines.gate.enabled === true && String(flags.leylines.gate.linkHexUuid || "").trim());
  } catch (e) {
    return false;
  }
}

function bbttccApplyAccent(style, accent) {
  if (!accent || typeof accent !== "object") return style;
  if (accent.strokeTint) style.strokeColor = bbttccMixHex(style.strokeColor, accent.strokeTint, accent.strokeWeight || 0.2);
  if (accent.fillTint) style.fillColor = bbttccMixHex(style.fillColor, accent.fillTint, accent.fillWeight || 0.1);
  if (accent.textTint) style.textColor = bbttccMixHex(style.textColor, accent.textTint, accent.textWeight || 0.15);
  if (accent.strokeWidthBonus) style.strokeWidth += Number(accent.strokeWidthBonus) || 0;
  if (accent.fillAlphaBonus) style.fillAlpha += Number(accent.fillAlphaBonus) || 0;
  return style;
}

function bbttccCapitalDisplayText(rawText) {
  const base = String(rawText || "Hex").replace(/^\s*[✦◆◈★]+\s*/u, "").trim();
  return "✦ " + (base || "Capital");
}

function styleForStatus(status, opts) {
  opts = opts || {};
  let st = String(status || "unclaimed").toLowerCase();
  if (st === "scorched") st = "occupied"; // legacy rename

  const base = Object.assign({}, BBTTCC_STATUS_STYLE[st] || BBTTCC_STATUS_STYLE.unclaimed);
  const typeKey = bbttccVisualTypeKey(opts.type);
  const terrainKey = bbttccNormalizeTerrainKey(opts.terrainKey || bbttccTerrainFromType(typeKey));

  bbttccApplyAccent(base, BBTTCC_TYPE_STYLE[typeKey]);
  bbttccApplyAccent(base, BBTTCC_TERRAIN_STYLE[terrainKey]);

  if (opts.hasLeyGate) {
    base.strokeColor = bbttccMixHex(base.strokeColor, "#8f7cff", 0.42);
    base.fillColor = bbttccMixHex(base.fillColor, "#22195a", 0.18);
    base.strokeWidth += 1;
  }

  if (opts.capital) {
    base.strokeColor = bbttccMixHex(base.strokeColor, "#fff2a8", 0.82);
    base.fillColor = bbttccMixHex(base.fillColor, "#5a4310", 0.24);
    base.textColor = "#fff6cf";
    base.strokeWidth += 6;
    base.fillAlpha += 0.06;
    base.fontSize = 15;
    base.textStroke = "#1b1406";
  }

  if (typeKey === "fortress" || typeKey === "factory" || typeKey === "research") {
    base.strokeWidth += 1;
  }

  base.strokeWidth = Math.max(5, Math.round(base.strokeWidth));
  base.fillAlpha = Math.max(0.10, Math.min(0.34, base.fillAlpha));
  base.strokeAlpha = Math.max(0.96, Math.min(1.00, base.strokeAlpha));
  return base;
}
async function applyStyle(dr) {
  if (!dr) return;
  const f = dr.flags && dr.flags[MOD] ? dr.flags[MOD] : {};
  const isCapital = !!f.capital;
  const st = styleForStatus(f.status, {
    capital: isCapital,
    type: f.type,
    terrainKey: bbttccVisualTerrainKey(f),
    hasLeyGate: bbttccHasLeyGate(f)
  });
  const baseLabel = String(f.name || dr.text || "Hex").trim();
  const nextText = isCapital ? bbttccCapitalDisplayText(baseLabel) : baseLabel.replace(/^\s*[✦◆◈★]+\s*/u, "").trim();
  const patch = {
    fillColor: st.fillColor,
    fillAlpha: st.fillAlpha,
    strokeColor: st.strokeColor,
    strokeAlpha: st.strokeAlpha,
    strokeWidth: st.strokeWidth,
    textColor: st.textColor || "#f8fafc",
    fontSize: isCapital ? Math.max(Number(dr.fontSize || 12), Number(st.fontSize || 15)) : Math.max(12, Number(dr.fontSize || 12)),
    text: nextText || "Hex"
  };
  if (st.textStroke) patch.textStroke = st.textStroke;
  await dr.update(patch).catch(()=>{});
  try { await bbttccRefreshCapitalOverlayForDrawing(dr); } catch (_e) {}
}

/* ---------------- Capital Overlay Chrome (runtime-only, zero extra documents) ---------------- */
let BBTTCC_CAPITAL_OVERLAY_LAYER = null;

function bbttccGetCapitalOverlayHost() {
  try {
    if (!canvas || !canvas.primary) return null;
    if (!BBTTCC_CAPITAL_OVERLAY_LAYER) {
      BBTTCC_CAPITAL_OVERLAY_LAYER = new PIXI.Container();
      BBTTCC_CAPITAL_OVERLAY_LAYER.sortableChildren = true;
      BBTTCC_CAPITAL_OVERLAY_LAYER.eventMode = "none";
      BBTTCC_CAPITAL_OVERLAY_LAYER.label = "bbttcc-capital-overlays";
      canvas.primary.addChild(BBTTCC_CAPITAL_OVERLAY_LAYER);
    }
    return BBTTCC_CAPITAL_OVERLAY_LAYER;
  } catch (e) {
    console.warn("[bbttcc-territory] capital overlay host failed", e);
    return null;
  }
}

function bbttccClearCapitalOverlays() {
  try {
    if (!BBTTCC_CAPITAL_OVERLAY_LAYER) return;
    const kids = BBTTCC_CAPITAL_OVERLAY_LAYER.removeChildren();
    for (const k of kids) {
      try { k.destroy({ children:true }); } catch (_e) {}
    }
  } catch (e) {
    console.warn("[bbttcc-territory] capital overlay clear failed", e);
  }
}

function bbttccDrawingBounds(doc) {
  try {
    const x = Number(doc.x || 0);
    const y = Number(doc.y || 0);
    const shape = doc.shape || {};
    const pts = Array.isArray(shape.points) ? shape.points : [];
    if (pts.length >= 12) {
      const xs = [];
      const ys = [];
      for (let i = 0; i < pts.length; i += 2) {
        xs.push(x + Number(pts[i] || 0));
        ys.push(y + Number(pts[i + 1] || 0));
      }
      return {
        minX: Math.min.apply(null, xs),
        minY: Math.min.apply(null, ys),
        maxX: Math.max.apply(null, xs),
        maxY: Math.max.apply(null, ys)
      };
    }
    const w = Number(doc.shape && doc.shape.width || doc.width || 0);
    const h = Number(doc.shape && doc.shape.height || doc.height || 0);
    return { minX:x, minY:y, maxX:x+w, maxY:y+h };
  } catch (e) {
    return { minX:0, minY:0, maxX:0, maxY:0 };
  }
}

function bbttccHexAbsPoints(doc) {
  const x = Number(doc.x || 0);
  const y = Number(doc.y || 0);
  const pts = (doc.shape && Array.isArray(doc.shape.points)) ? doc.shape.points : [];
  const out = [];
  for (let i = 0; i < pts.length; i += 2) out.push({ x: x + Number(pts[i] || 0), y: y + Number(pts[i + 1] || 0) });
  return out;
}

function bbttccBuildCapitalOverlayForDrawing(doc) {
  const f = doc && doc.flags && doc.flags[MOD] ? doc.flags[MOD] : {};
  if (!f || !f.capital) return null;

  const pts = bbttccHexAbsPoints(doc);
  if (!pts.length) return null;

  const bounds = bbttccDrawingBounds(doc);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const size = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

  const root = new PIXI.Container();
  root.label = "bbttcc-capital-overlay:" + String(doc.id || "");
  root.eventMode = "none";
  root.zIndex = 9000;
  root.alpha = 0.96;

  const glow = new PIXI.Graphics();
  glow.poly(pts.map(p => [p.x, p.y]).flat(), true);
  glow.stroke({ width: Math.max(10, Math.round(size * 0.07)), color: 0xffd76a, alpha: 0.16, join: "round" });
  root.addChild(glow);

  const frame = new PIXI.Graphics();
  frame.poly(pts.map(p => [p.x, p.y]).flat(), true);
  frame.stroke({ width: Math.max(4, Math.round(size * 0.028)), color: 0xffefb0, alpha: 0.95, join: "round" });
  root.addChild(frame);

  const inner = new PIXI.Graphics();
  inner.poly(pts.map(p => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return [cx + dx * 0.84, cy + dy * 0.84];
  }).flat(), true);
  inner.stroke({ width: Math.max(2, Math.round(size * 0.012)), color: 0x7be7ff, alpha: 0.70, join: "round" });
  root.addChild(inner);

  const crest = new PIXI.Graphics();
  const crestY = cy - size * 0.34;
  const crestW = Math.max(12, size * 0.10);
  const crestH = Math.max(16, size * 0.12);
  crest.moveTo(cx, crestY - crestH * 0.55);
  crest.lineTo(cx + crestW * 0.82, crestY - crestH * 0.10);
  crest.lineTo(cx + crestW * 0.48, crestY + crestH * 0.62);
  crest.lineTo(cx, crestY + crestH * 0.28);
  crest.lineTo(cx - crestW * 0.48, crestY + crestH * 0.62);
  crest.lineTo(cx - crestW * 0.82, crestY - crestH * 0.10);
  crest.closePath();
  crest.fill({ color: 0xffd76a, alpha: 0.92 });
  crest.stroke({ width: Math.max(2, Math.round(size * 0.012)), color: 0xfff6cf, alpha: 0.95, join: "round" });
  root.addChild(crest);

  const brackets = new PIXI.Graphics();
  const seg = Math.max(10, size * 0.12);
  const inset = Math.max(6, size * 0.05);
  brackets.stroke({ width: Math.max(2, Math.round(size * 0.014)), color: 0xfff1a8, alpha: 0.90, join: "round" });
  brackets.moveTo(bounds.minX + inset, bounds.minY + inset + seg).lineTo(bounds.minX + inset, bounds.minY + inset).lineTo(bounds.minX + inset + seg, bounds.minY + inset);
  brackets.moveTo(bounds.maxX - inset - seg, bounds.minY + inset).lineTo(bounds.maxX - inset, bounds.minY + inset).lineTo(bounds.maxX - inset, bounds.minY + inset + seg);
  brackets.moveTo(bounds.minX + inset, bounds.maxY - inset - seg).lineTo(bounds.minX + inset, bounds.maxY - inset).lineTo(bounds.minX + inset + seg, bounds.maxY - inset);
  brackets.moveTo(bounds.maxX - inset - seg, bounds.maxY - inset).lineTo(bounds.maxX - inset, bounds.maxY - inset).lineTo(bounds.maxX - inset, bounds.maxY - inset - seg);
  root.addChild(brackets);

  return root;
}

async function bbttccRefreshCapitalOverlayForDrawing(doc) {
  try {
    const host = bbttccGetCapitalOverlayHost();
    if (!host || !doc) return;
    const label = "bbttcc-capital-overlay:" + String(doc.id || "");
    const existing = host.children.find(c => c && c.label === label);
    if (existing) {
      host.removeChild(existing);
      try { existing.destroy({ children:true }); } catch (_e) {}
    }
    const built = bbttccBuildCapitalOverlayForDrawing(doc);
    if (built) host.addChild(built);
  } catch (e) {
    console.warn("[bbttcc-territory] capital overlay refresh failed", e);
  }
}

async function bbttccRefreshAllCapitalOverlays() {
  try {
    const host = bbttccGetCapitalOverlayHost();
    if (!host) return;
    bbttccClearCapitalOverlays();
    const draws = canvas && canvas.drawings && canvas.drawings.placeables ? canvas.drawings.placeables : [];
    for (const p of draws) {
      const doc = p && p.document ? p.document : null;
      const f = doc && doc.flags ? doc.flags[MOD] : null;
      if (!doc || !f || !f.capital || (!f.isHex && f.kind !== "territory-hex")) continue;
      const built = bbttccBuildCapitalOverlayForDrawing(doc);
      if (built) host.addChild(built);
    }
  } catch (e) {
    console.warn("[bbttcc-territory] capital overlay rebuild failed", e);
  }
}

/* ---------------- Grid helpers ---------------- */
function detectStartAngle(){ const isHex=!!canvas?.grid?.isHexagonal; const flatTop=isHex ? !!canvas.grid.columns : true; return flatTop?0:-Math.PI/6; }
function hexVerts(cx,cy,r,start){ const pts=[]; for(let i=0;i<6;i++){ const a=start+i*Math.PI/3; pts.push(cx+r*Math.cos(a), cy+r*Math.sin(a)); } return pts; }
function toRelativePoints(abs){ const xs=[],ys=[]; for(let i=0;i<abs.length;i+=2){ xs.push(abs[i]); ys.push(abs[i+1]); } const minX=Math.min(...xs),minY=Math.min(...ys); const rel=[]; for(let i=0;i<abs.length;i+=2) rel.push(abs[i]-minX, abs[i+1]-minY); return {rel, origin:{x:minX,y:minY}}; }
function snapCenter(x,y){ try{ if (canvas?.grid?.getCenterPoint) return canvas.grid.getCenterPoint({x,y}); if (canvas?.grid?.getSnappedPoint) return canvas.grid.getSnappedPoint({x,y},1); }catch{} const g=canvas.scene?.grid?.size??100; return {x:Math.round(x/g)*g, y:Math.round(y/g)*g}; }
function worldFromEvent(ev){ try{ if (ev?.data?.getLocalPosition) return ev.data.getLocalPosition(canvas.app.stage); if (ev?.global) return canvas.stage.worldTransform.applyInverse(ev.global);}catch{} const cx=(canvas.scene?.width??0)/2, cy=(canvas.scene?.height??0)/2; return {x:cx,y:cy}; }

/* ---------------- Owners / Sephirot ---------------- */
function buildOwnerList(){
  const list=[];
  for (const a of game.actors?.contents ?? []) {
    const isFaction = a.getFlag?.("bbttcc-factions","isFaction")===true ||
      String(a.system?.details?.type?.value ?? "").toLowerCase()==="faction";
    if (isFaction) list.push({id:a.id, name:a.name});
  }
  return list.sort((A,B)=>A.name.localeCompare(B.name));
}
const keyFromName = (n)=> String(n||"").toLowerCase().trim().replace(/[^\p{L}]+/gu,"");
async function buildSephirotList(){
  const foundByName = new Map();
  for (const it of game.items?.contents ?? []) {
    const name = it?.name ?? "";
    if (/^(Keter|Chokhmah|Binah|Chesed|Gevurah|Tiferet|Netzach|Hod|Yesod|Malkuth)$/i.test(name))
      foundByName.set(name, { uuid: it.uuid, name });
  }
  for (const nm of ["Keter","Chokhmah","Binah","Chesed","Gevurah","Tiferet","Netzach","Hod","Yesod","Malkuth"])
    if (!foundByName.has(nm)) foundByName.set(nm, { uuid: keyFromName(nm), name: nm });
  return Array.from(foundByName.values()).sort((A,B)=>A.name.localeCompare(B.name));
}
async function nameFromUuid(uuid){
  if (!uuid) return "";
  if (!uuid.includes(".")) return uuid; // stored canonical key
  try { const doc = await fromUuid(uuid); return doc?.name || ""; } catch { return ""; }
}


/* ---------------- Leylines: Gates (Remote Adjacency) ----------------
 * Sprint B.2 Step 2 — Resolver only
 *
 * Gates are authored per-hex under:
 *   flags.bbttcc-territory.leylines.gate
 *
 * This step does NOT change travel/pathing automatically yet.
 * It provides a stable resolver API so Travel/Trade/Logistics can opt-in safely.
 *
 * Gate usability rules (Alpha):
 * - enabled === true
 * - linkHexUuid is a non-empty UUID
 * - faction tier meets minFactionTier (A/B/C). Unknown => A.
 * - (optional future) purity/memoryCharge constraints
 */

function _bbttccTierRank(t){
  const k = String(t || "A").trim().toUpperCase();
  if (k === "C") return 3;
  if (k === "B") return 2;
  return 1; // A/default
}

function _bbttccGetFactionTierKey(factionId){
  try {
    if (!factionId) return "A";
    const A = game.actors?.get?.(factionId) || null;
    if (!A) return "A";

    // Common variants across sprints/builds
    const v1 = A.getFlag?.("bbttcc-factions","tier");
    const v2 = A.getFlag?.("bbttcc-factions","tierKey");
    const v3 = A.getFlag?.("bbttcc-factions","tierBand");
    const v4 = A.getFlag?.("bbttcc-factions","factionTier");
    const raw = v2 ?? v3 ?? v4 ?? v1;

    // Some builds store { key:"B" } or { band:"B" }
    if (raw && typeof raw === "object") {
      const kk = raw.key ?? raw.band ?? raw.tier ?? raw.value;
      if (kk != null) return String(kk).trim().toUpperCase() || "A";
      return "A";
    }

    return String(raw || "A").trim().toUpperCase() || "A";
  } catch (e) {
    return "A";
  }
}

function _bbttccReadLeylines(tf){
  const ley = tf && tf.leylines && (typeof tf.leylines === "object") ? tf.leylines : null;
  if (ley) return ley;
  if (tf && typeof tf === "object" && tf.primaryResonance !== undefined && tf.flowState !== undefined) return tf;
  return null;
}

function _bbttccNormalizeGate(gate){
  const g = (gate && typeof gate === "object") ? gate : {};
  return Object.assign(
    { enabled:false, linkHexUuid:"", strength:0.5, minFactionTier:"B", locked:false },
    g
  );
}

function _bbttccGateUsable(args){
  try {
    args = args || {};
    const hexTf = args.hexTf;
    const factionId = args.factionId;

    if (!hexTf) return { ok:false, reason:"no-hex" };
    const ley = _bbttccReadLeylines(hexTf);
    if (!ley) return { ok:false, reason:"no-leylines" };

    const gate = _bbttccNormalizeGate(ley.gate);
    if (!gate.enabled) return { ok:false, reason:"disabled" };

    const targetUuid = String(gate.linkHexUuid || "").trim();
    if (!targetUuid) return { ok:false, reason:"no-target" };

    const minTier = String(gate.minFactionTier || "B").trim().toUpperCase();
    const facTier = _bbttccGetFactionTierKey(factionId);
    if (_bbttccTierRank(facTier) < _bbttccTierRank(minTier)) {
      return { ok:false, reason:"tier", facTier: facTier, minTier: minTier };
    }

    const strength = Number(gate.strength ?? 0.5);
    const str = Number.isFinite(strength) ? Math.max(0, Math.min(1, strength)) : 0.5;

    return { ok:true, targetUuid: targetUuid, strength: str, minTier: minTier, facTier: facTier, gate: gate };
  } catch (e) {
    return { ok:false, reason:"error" };
  }
}

/**
 * Resolve remote adjacency for a given hex UUID and faction.
 * Returns an object so future systems can use strength safely.
 *
 * Result:
 * {
 *   ok, hexUuid, factionId,
 *   links: [{ toUuid, strength, kind:"gate", minTier, facTier }],
 *   reason? // if ok=false
 * }
 */
async function bbttccResolveRemoteAdjacency(args){
  try {
    args = args || {};
    const hexUuid = String(args.hexUuid || "").trim();
    const factionId = String(args.factionId || "").trim();

    const out = { ok:false, hexUuid: hexUuid, factionId: factionId, links: [] };
    if (!hexUuid) { out.reason = "no-hexUuid"; return out; }

    const dr = await fromUuid(hexUuid);
    if (!dr) { out.reason = "hex-not-found"; return out; }

    const tf = dr.flags?.[MOD] || {};
    const gateCheck = _bbttccGateUsable({ hexTf: tf, factionId: factionId });

    if (!gateCheck.ok) {
      out.reason = gateCheck.reason || "no-gate";
      out.facTier = gateCheck.facTier;
      out.minTier = gateCheck.minTier;
      return out;
    }

    let targetDoc = null;
    try { targetDoc = await fromUuid(gateCheck.targetUuid); } catch (e) {}
    if (!targetDoc) {
      out.reason = "target-not-found";
      out.targetUuid = gateCheck.targetUuid;
      return out;
    }

    out.ok = true;
    out.links.push({
      toUuid: gateCheck.targetUuid,
      strength: gateCheck.strength,
      kind: "gate",
      minTier: gateCheck.minTier,
      facTier: gateCheck.facTier
    });

    return out;
  } catch (e) {
    return { ok:false, hexUuid: String(args?.hexUuid||""), factionId: String(args?.factionId||""), links: [], reason:"error" };
  }
}

/* ---------------- Old (working) math restored ---------------- */
/** Sephirot flat resource adds (before multipliers) */
function sephirotResourceBonus(name){
  const k = String(name||"").toLowerCase();
  switch (k) {
    case "keter":   return { food:1, materials:1, trade:1, military:1, knowledge:1 };
    case "chokhmah":return { food:0, materials:0, trade:0, military:0, knowledge:3 };
    case "binah":   return { food:0, materials:1, trade:0, military:0, knowledge:2 };
    case "chesed":  return { food:1, materials:0, trade:2, military:0, knowledge:0 };
    case "gevurah": return { food:0, materials:0, trade:0, military:3, knowledge:0 };
    case "tiferet": return { food:0, materials:0, trade:1, military:1, knowledge:1 };
    case "netzach": return { food:0, materials:0, trade:1, military:2, knowledge:0 };
    case "hod":     return { food:0, materials:2, trade:1, military:0, knowledge:0 };
    case "yesod":   return { food:0, materials:0, trade:1, military:0, knowledge:1 };
    case "malkuth": return { food:0, materials:3, trade:0, military:0, knowledge:0 };
    default:        return { food:0, materials:0, trade:0, military:0, knowledge:0 };
  }
}
/** Modifiers → global/trade multipliers (unchanged from working build) */
function getModifierEffects(modifiers=[]){
  const set = new Set((modifiers||[]).map(m=>String(m).trim().toLowerCase()));
  let mAll=1.0, mTrade=1.0;
  const bump=(pct)=>{ mAll *= (1+pct); };
  const bumpTrade=(pct)=>{ mTrade *= (1+pct); };

  if (set.has("well-maintained"))        bump(+0.25);
  if (set.has("fortified"))              { /* 0% prod */ }
  if (set.has("strategic position"))     bump(+0.10);
  if (set.has("loyal population"))       bump(+0.15);
  if (set.has("trade hub"))              bumpTrade(+0.50);
  if (set.has("contaminated"))           bump(-0.50);
  if (set.has("damaged infrastructure")) bump(-0.25);
  if (set.has("hostile population"))     bump(-0.25);
  if (set.has("difficult terrain"))      bump(-0.10);
  if (set.has("radiation zone"))         bump(-0.75);
  if (set.has("supply line vulnerable")) bump(-0.15); // keep the original value
  return { mAll, mTrade };
}
/** Type→base pips */
const TYPE_BASE = {
  settlement:{food:2, materials:1, trade:3, military:0, knowledge:0},
  fortress:  {food:0, materials:3, trade:1, military:4, knowledge:0},
  mine:      {food:0, materials:5, trade:2, military:0, knowledge:0},
  farm:      {food:5, materials:1, trade:2, military:0, knowledge:0},
  port:      {food:2, materials:2, trade:4, military:0, knowledge:0},
  factory:   {food:0, materials:4, trade:3, military:0, knowledge:0},
  research:  {food:0, materials:1, trade:1, military:0, knowledge:4},
  temple:    {food:1, materials:1, trade:1, military:0, knowledge:2},
  wasteland: {food:0, materials:1, trade:0, military:0, knowledge:0},
  ruins:     {food:0, materials:2, trade:0, military:0, knowledge:1}
};
/** Size multipliers */
const SIZE_MULT = {
  none: 0,

  outpost: 0.5,
  village: 0.75,
  town: 1,
  city: 1.5,
  metropolis: 2,
  megalopolis: 3
};

/** Compute EFFECTIVE resources: base → +sephirot → ×modifiers */
function computeEffectiveResources(base, sephirotName, modifiers){
  const add = sephirotResourceBonus(sephirotName);
  const { mAll, mTrade } = getModifierEffects(modifiers);

  const afterAdd = {
    food:      Number(base.food||0)      + add.food,
    materials: Number(base.materials||0) + add.materials,
    trade:     Number(base.trade||0)     + add.trade,
    military:  Number(base.military||0)  + add.military,
    knowledge: Number(base.knowledge||0) + add.knowledge
  };

  const mul = (v,m)=> Math.max(0, Math.round(v*m));
  const effective = {
    food:      mul(afterAdd.food,      mAll),
    materials: mul(afterAdd.materials, mAll),
    trade:     mul(afterAdd.trade,     mAll * mTrade),
    military:  mul(afterAdd.military,  mAll),
    knowledge: mul(afterAdd.knowledge, mAll)
  };

  return { effective, added:add, multipliers:{mAll,mTrade} };
}

/* Optional: OP cache from resources (unchanged; harmless for UI) */
const RES_TO_OP = {
  economy:{food:0.5, materials:0.8, trade:1.0, military:0.1, knowledge:0.25},
  violence:{food:0.1, materials:0.2, trade:0.2, military:0.8, knowledge:0.0},
  nonLethal:{food:0.2, materials:0.1, trade:0.2, military:0.5, knowledge:0.3},
  intrigue:{food:0.0, materials:0.1, trade:0.5, military:0.1, knowledge:1.0},
  diplomacy:{food:0.2, materials:0.0, trade:0.6, military:0.0, knowledge:0.4},
  softPower:{food:0.2, materials:0.0, trade:0.5, military:0.0, knowledge:0.3}
};
/* ---------------- Leyline Flow Modifiers ---------------- */
const LEY_FLOW_MULT = {
  normal:     1.0,
  turbulence: 0.9,
  surge:      1.3,
  stagnation: 0.6,
  inversion:  1.0, // multiplier is applied after swaps
  fracture:   0.8,
  seal:       0.0
};

function resourcesToOP(res, flowState = "normal"){
  const out = { economy:0, violence:0, nonLethal:0, intrigue:0, diplomacy:0, softPower:0 };

  for (const [op,weights] of Object.entries(RES_TO_OP)) {
    let v = 0;
    for (const [rk,w] of Object.entries(weights)) v += (res[rk]||0)*w;
    out[op] = Math.max(0, Math.round(v));
  }

  // Inversion swaps (narrative: the grid lies)
  if (flowState === "inversion") {
    [out.violence, out.softPower] = [out.softPower, out.violence];
    [out.diplomacy, out.intrigue] = [out.intrigue, out.diplomacy];
  }

  // Flow multiplier
  const mult = LEY_FLOW_MULT[flowState] ?? 1.0;
  for (const k of Object.keys(out)) {
    out[k] = Math.max(0, Math.round(out[k] * mult));
  }

  return out;
}


/* ---------------- Hex Editor ---------------- */
const OPEN = new Map();


/* ---------------- GM Manual Edit Panel (Phase 2) ----------------
 * Hex Config is opened via a V1 Dialog. Render hooks are timing-fragile.
 * We inject the GM panel directly from openHexEditorByUuid after dlg.render(true),
 * using a short retry loop to wait for Dialog content attachment.
 *
 * Gated by:
 *  - GM user
 *  - bbttcc-core world setting "gmEditMode" enabled
 *
 * Uses Core GM API: game.bbttcc.api.gm.setHex(...)
 */
function bbttccGMEditEnabled(){
  try { return !!(game && game.user && game.user.isGM) && !!game.settings.get("bbttcc-core","gmEditMode"); }
  catch (e) { return false; }
}
function bbttccHtmlEscape(s){
  return String(s==null?"":s)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}
function bbttccNumOrBlank(v){
  if (v === null || typeof v === "undefined") return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
}

function bbttccInjectGMPanelIntoHexConfigDialog(dlg, dr){
  try {
    if (!bbttccGMEditEnabled()) return;
    if (!dlg || !dr) return;

    const MAX_TRIES = 40;     // ~1s at 25ms
    const DELAY_MS  = 25;

    let tries = 0;

    function attempt(){
      tries += 1;
      try {
        const host = (dlg.element && dlg.element[0]) ? dlg.element[0] : null;
        const form = host ? host.querySelector("form.bbttcc-hex-config") : null;

        if (!form) {
          if (tries < MAX_TRIES) return setTimeout(attempt, DELAY_MS);
          console.warn("[bbttcc-territory] GM panel: form not found after retries", { tries, uuid: dr.uuid });
          return;
        }

        if (form.querySelector("[data-bbttcc='gm-edit-panel']")) return; // already there

        const tf = (dr.flags && dr.flags[MOD]) ? dr.flags[MOD] : {};
        const travel = tf.travel || {};
        const dev = tf.development || {};
        const integ = tf.integration || {};
        const alarm = tf.alarm || {};
        const camp = tf.campaign || {};

        const wrap = document.createElement("fieldset");
        wrap.setAttribute("data-bbttcc","gm-edit-panel");
        wrap.style.marginTop = "0.75rem";
        wrap.style.border = "1px solid rgba(100,116,139,0.55)";
        wrap.style.borderRadius = "0.75rem";
        wrap.style.padding = "0.6rem 0.7rem 0.65rem";
        wrap.style.background = "linear-gradient(160deg, rgba(15,23,42,0.98), rgba(15,23,42,1))";

        wrap.innerHTML = `
          <legend style="padding:0 0.25rem; opacity:0.9; font-size:11px; text-transform:uppercase; letter-spacing:0.12em; color:#cbd5f5;">
            GM: Manual Edit
          </legend>

          <div class="form-group">
            <label>Hex UUID</label>
            <div style="display:flex; gap:0.5rem; align-items:center;">
              <input type="text" readonly value="${bbttccHtmlEscape(dr.uuid)}" style="flex:1;">
              <button type="button" class="bbttcc-btn" data-gm-action="copy-uuid">Copy</button>
            </div>
            <p class="hint">GM-only. Requires bbttcc-core → GM Edit Mode.</p>
          </div>

          <div class="form-group">
            <label>Travel Units Override</label>
            <input type="number" min="0" max="99" step="1" name="gm.travel.unitsOverride" value="${bbttccHtmlEscape(bbttccNumOrBlank(travel.unitsOverride))}">
            <p class="hint">Blank = no change. Clear removes override.</p>
          </div>

          <div class="form-group">
            <label>Development Stage</label>
            <input type="number" min="0" max="6" step="1" name="gm.development.stage" value="${bbttccHtmlEscape(bbttccNumOrBlank((dev.stage != null) ? dev.stage : integ.progress))}">
            <p class="hint">Writes development.stage + integration.progress (0–6).</p>
          </div>

          <div class="form-group row" style="align-items:center;">
            <label style="margin:0;">Development Locked</label>
            <input type="checkbox" name="gm.development.locked" ${(dev.locked === true || integ.locked === true) ? "checked" : ""}>
          </div>

          <div class="form-group">
            <label>Alarm</label>
            <div style="display:flex; gap:0.5rem; align-items:center;">
              <input type="number" min="0" max="99" step="1" name="gm.alarm.value" value="${bbttccHtmlEscape(bbttccNumOrBlank(alarm.value))}" style="flex:1;">
              <label class="checkbox" style="display:flex; gap:0.35rem; align-items:center; margin:0;">
                <input type="checkbox" name="gm.alarm.locked" ${(alarm.locked === true) ? "checked" : ""}>
                <span>Lock</span>
              </label>
            </div>
            <p class="hint">Blank = no change.</p>
          </div>

          <div class="form-group">
            <label>On-Enter Beat ID</label>
            <input type="text" name="gm.campaign.onEnterBeatId" value="${bbttccHtmlEscape(camp.onEnterBeatId || "")}" placeholder="e.g. enc_hidden_ruins">
          </div>

          <div class="form-group">
            <label>GM Note (audit)</label>
            <input type="text" name="gm.note" value="" placeholder="Why are we changing reality?">
          </div>

          <div class="form-group" style="display:flex; gap:0.5rem; justify-content:flex-end;">
            <button type="button" class="bbttcc-btn" data-gm-action="clear">Clear Overrides</button>
            <button type="button" class="bbttcc-btn" data-gm-action="apply">Apply</button>
          </div>
        `;

        form.appendChild(wrap);

        function q(sel){ return wrap.querySelector(sel); }
        function val(name){ const el = q('[name="' + name + '"]'); return el ? (el.value || "") : ""; }
        function checked(name){ const el = q('[name="' + name + '"]'); return !!(el && el.checked); }

        wrap.addEventListener("click", async function(ev){
          const btn = (ev.target && ev.target.closest) ? ev.target.closest("button[data-gm-action]") : null;
          if (!btn) return;
          ev.preventDefault(); ev.stopPropagation();

          const action = btn.getAttribute("data-gm-action");

          if (action === "copy-uuid") {
            try {
              navigator.clipboard.writeText(dr.uuid);
              ui && ui.notifications && ui.notifications.info && ui.notifications.info("Copied Hex UUID to clipboard.");
            } catch (e) {
              ui && ui.notifications && ui.notifications.warn && ui.notifications.warn("Could not copy UUID (see console).");
              console.warn("[bbttcc-territory] copy uuid failed", e);
            }
            return;
          }

          // Prefer territory-side GM hex setter (0-safe); fall back to core GM API.
          const terrApi = game.bbttcc && game.bbttcc.api && game.bbttcc.api.territory;
          const setHexFn =
            (terrApi && typeof terrApi.gmSetHex === "function") ? terrApi.gmSetHex :
            (game.bbttcc && game.bbttcc.api && game.bbttcc.api.gm && typeof game.bbttcc.api.gm.setHex === "function") ? game.bbttcc.api.gm.setHex :
            null;

          if (!setHexFn) {
            ui && ui.notifications && ui.notifications.error && ui.notifications.error("GM Hex API not available (bbttcc-territory or bbttcc-core missing).");
            return;
          }

          const note = String(val("gm.note") || "").trim();

          if (action === "clear") {
            try {
  await setHexFn({
    hexUuid: dr.uuid,
    patch: {
      // 🔑 Hand authority back to the system
      manualOverride: false,

      // Clear all manual override values
      travel: { unitsOverride: null },
      development: { stage: null, locked: null },
      integration: { progress: null, locked: null },
      alarm: { value: null, locked: null },
      campaign: { onEnterBeatId: null }
    },
    note: note || "Clear hex overrides"
  });


  // Verify + log (high-signal when other UIs don’t update)
  try {
    const fresh = await fromUuid(dr.uuid);
    const tf2 = fresh?.flags?.[MOD] || {};
    console.log("[bbttcc-territory] GM clear verify", {
      uuid: dr.uuid,
      travel: tf2.travel,
      development: tf2.development,
      integration: tf2.integration,
      alarm: tf2.alarm,
      campaign: tf2.campaign
    });
  } catch (_) {}

  try { Hooks.callAll && Hooks.callAll("bbttcc:territory:hexUpdated", { hexUuid: dr.uuid }); } catch(e) {}

  // IMPORTANT: OPEN map can wedge reopening if the close callback doesn’t fire in time.
  try { OPEN.delete(dr.id); } catch(e) {}

  try { await dlg.close(); } catch(e) {}
  try { setTimeout(function(){ openHexEditorByUuid(dr.uuid); }, 75); } catch(e) {}
} catch (e) {
  console.warn("[bbttcc-territory] GM clear failed", e);
  ui?.notifications?.error?.("GM Clear failed — see console.");
}

            return;
          }

          if (action === "apply") {
            const patch = {};

            patch.manualOverride = true;

            const uo = String(val("gm.travel.unitsOverride") || "").trim();
            if (uo !== "") patch.travel = Object.assign(patch.travel || {}, { unitsOverride: Number(uo) });

            const st = String(val("gm.development.stage") || "").trim();
            patch.development = patch.development || {};
            if (st !== "") patch.development.stage = Number(st);
            patch.development.locked = checked("gm.development.locked");

            const av = String(val("gm.alarm.value") || "").trim();
            patch.alarm = patch.alarm || {};
            if (av !== "") patch.alarm.value = Number(av);
            patch.alarm.locked = checked("gm.alarm.locked");

            const beat = String(val("gm.campaign.onEnterBeatId") || "").trim();
            if (beat !== "") patch.campaign = Object.assign(patch.campaign || {}, { onEnterBeatId: beat });

            try {
  await setHexFn({ hexUuid: dr.uuid, patch: patch, note: note || "GM edit hex" });

  try {
    const fresh = await fromUuid(dr.uuid);
    const tf2 = fresh?.flags?.[MOD] || {};
    console.log("[bbttcc-territory] GM apply verify", {
      uuid: dr.uuid,
      travel: tf2.travel,
      development: tf2.development,
      integration: tf2.integration,
      alarm: tf2.alarm,
      campaign: tf2.campaign
    });
  } catch (_) {}

  try { Hooks.callAll && Hooks.callAll("bbttcc:territory:hexUpdated", { hexUuid: dr.uuid }); } catch(e) {}

  try { OPEN.delete(dr.id); } catch(e) {}
  try { await dlg.close(); } catch(e) {}
  try { setTimeout(function(){ openHexEditorByUuid(dr.uuid); }, 75); } catch(e) {}
} catch (e) {
  console.warn("[bbttcc-territory] GM apply failed", e);
  ui?.notifications?.error?.("GM Apply failed — see console.");
}

            return;
          }
        });

        console.log("[bbttcc-territory] GM panel injected into Hex Config", { uuid: dr.uuid });
      } catch (e2) {
        console.warn("[bbttcc-territory] GM panel inject failed", e2);
      }
    }

    setTimeout(attempt, 0);
  } catch (e) {
    console.warn("[bbttcc-territory] GM panel inject outer failed", e);
  }
}

async function openHexEditorByUuid(uuid){
  if (!uuid) return ui.notifications?.warn?.("Hex not found.");
  const dr = await fromUuid(uuid);
  if (!dr)  return ui.notifications?.warn?.("Hex not found.");

  const existing = OPEN.get(dr.id);
  if (existing) { try { existing.bringToTop(); } catch{} return; }

  const f = foundry.utils.getProperty(dr, `flags.${MOD}`) ?? {};

  // Integration track (0–6) with derived stage
  const integ = f.integration ?? {};
  const rawProgress = Number.isFinite(integ.progress) ? integ.progress : 0;
  const integrationProgress = Math.max(0, Math.min(6, Math.round(rawProgress)));

  let integrationStageKey = "wild";
  if (integrationProgress >= 6) integrationStageKey = "integrated";
  else if (integrationProgress === 5) integrationStageKey = "settled";
  else if (integrationProgress >= 3) integrationStageKey = "developing";
  else if (integrationProgress >= 1) integrationStageKey = "outpost";

  const integrationStageLabels = {
    wild: "Untouched Wilderness",
    outpost: "Foothold / Outpost",
    developing: "Developing Territory",
    settled: "Settled Province",
    integrated: "Integrated Heartland"
  };
  const integrationStageLabel = integrationStageLabels[integrationStageKey] || "—";

  const context = {
    name: f.name ?? dr.text ?? "",
    ownerId: f.factionId ?? "",
    ownerList: buildOwnerList(),
    status: f.status ?? "unclaimed",
    type: f.type ?? "wilderness",
    size: f.size ?? "none",
    population: f.population ?? "uninhabited",
    capital: !!f.capital,
    resources: {
      food:      Number(f.resources?.food ?? 0),
      materials: Number(f.resources?.materials ?? 0),
      trade:     Number(f.resources?.trade ?? 0),
      military:  Number(f.resources?.military ?? 0),
      knowledge: Number(f.resources?.knowledge ?? 0)
    },
    // Integration display
    integrationProgress,
    integrationMax: 6,
    integrationStageKey,
    integrationStageLabel,

    sephirotUuid: f.sephirotUuid || "",
    sephirotList: await buildSephirotList(),
    modifiers: Array.isArray(f.modifiers) ? f.modifiers : [],
    notes: f.notes ?? "",
    createdAt: f.createdAt ? new Date(f.createdAt).toLocaleString() : "",

    leylines: (() => {
      const raw = (f.leylines && typeof f.leylines === "object") ? f.leylines : {};
      const out = Object.assign({
        primaryResonance: "none",
        flowState: "normal",
        purity: 0,
        memoryCharge: 0,
        gate: { enabled:false, linkHexUuid:"", strength:0.5, minFactionTier:"B", locked:false }
      }, raw);

      out.gate = Object.assign(
        { enabled:false, linkHexUuid:"", strength:0.5, minFactionTier:"B", locked:false },
        (out.gate && typeof out.gate === "object") ? out.gate : {}
      );

      return foundry.utils.deepClone(out);
    })(),
  };

  const html = await renderTpl(TPL_HEX_CONFIG, context);

  // Manual override toggle (injected, non-invasive)
  const overrideBlock = `
    <fieldset style="margin-top:.5rem; border:1px solid #666; border-radius:6px; padding:.5rem;">
      <legend style="padding:0 .25rem; opacity:.9;">Save Behavior</legend>
      <label class="checkbox">
        <input type="checkbox" name="manualOverride" ${((f.manualOverride === true) && Object.values((f.resources||{})).some(n=>Number(n||0)>0)) ? "checked" : ""}>
        <span>Manual resource override</span>
      </label>
      <p class="hint">Unchecked → save <em>auto-calculated</em> resources from Type × Size × Alignment + Modifiers (recommended).</p>
    </fieldset>
  `;

  const dlg = new Dialog(
  {
    title: "BBTTCC: Hex Configuration",
    content: `<form class="bbttcc-hex-config">${html}${overrideBlock}</form>`,
    buttons: {
      save: {
        icon:`<i class="far fa-save"></i>`,
        label:"Save",
        callback: async (jq) => {
          try {
            const form = jq[0].querySelector("form");
            const fd = new FormData(form);
            const data = {};

            // NOTE: we DO NOT bucket leylines.* generically anymore,
            // because we need to support nested leylines.gate.* fields.
            for (const [k,v] of fd.entries()) {
              if (k==="modifiers") (data.modifiers ??= []).push(v);
              else if (k.startsWith("resources.")) {
                const key = k.split(".")[1];
                (data.resources ??= {})[key] = Number(v||0);
              } else {
                data[k]=v;
              }
            }
            if (!fd.has("capital")) data.capital = false;
            // Resource manual override checkbox (affects resource persistence only)
            const manualResourceOverride = (fd.get("manualOverride") === "on");

            // Preserve any existing GM authority override (set by GM panel)
            const existingGMOverride = !!f.manualOverride;

            // Resolve Sephirot name + canonical key
            const selUuid = data.sephirotUuid || "";
            const selName = await nameFromUuid(selUuid);
            const selKey  = keyFromName(selName);

            // BASE (what user typed; may be all 0)
            const base = {
              food:      Number(data.resources?.food || 0),
              materials: Number(data.resources?.materials || 0),
              trade:     Number(data.resources?.trade || 0),
              military:  Number(data.resources?.military || 0),
              knowledge: Number(data.resources?.knowledge || 0)
            };

            // Build the auto base from Type×Size ladder, then apply +sephirot & ×modifiers
            const typeKey = String(data.type||"settlement").toLowerCase();
            const sizeKey = String(data.size||"none").toLowerCase();
            const typedBase = TYPE_BASE[typeKey] || TYPE_BASE.settlement;
            const sizeMult = SIZE_MULT[sizeKey] ?? 0;
            const sizedBase = {
              food:      Math.round((typedBase.food||0)     * sizeMult),
              materials: Math.round((typedBase.materials||0)* sizeMult),
              trade:     Math.round((typedBase.trade||0)    * sizeMult),
              military:  Math.round((typedBase.military||0) * sizeMult),
              knowledge: Math.round((typedBase.knowledge||0)* sizeMult)
            };

            // Compute effective from whichever vector will be used for UI
            const mods = Array.isArray(data.modifiers) ? data.modifiers : [];
            const vectorForDisplay =
              (manualResourceOverride && Object.values(base).some(n=>n>0))
                ? base
                : sizedBase;

            const calc = computeEffectiveResources(vectorForDisplay, selName, mods);

            // Visible resources on hex:
            //  - Manual override: save the typed base unchanged
            //  - Auto mode:       save the EFFECTIVE totals (old working behavior)
            const resourcesToPersist =
              (manualResourceOverride && Object.values(base).some(n=>n>0))
                ? base
                : calc.effective;

            // ------------------------------------------------------------
            // Leylines (Sprint B.2 Step 1): parse nested fields + persist
            // ------------------------------------------------------------

            const clamp = (n, lo, hi) => {
              n = Number(n);
              if (!Number.isFinite(n)) n = lo;
              return Math.max(lo, Math.min(hi, n));
            };

            // existing leylines (prefer doc; fallback to f) — normalized to include gate defaults
            const existingLey = dr.getFlag(MOD, "leylines");
            const rawLey = (existingLey && typeof existingLey === "object")
              ? existingLey
              : ((f.leylines && typeof f.leylines === "object") ? f.leylines : {});

            const baseLey = Object.assign({
              primaryResonance: "none",
              flowState: "normal",
              purity: 0,
              memoryCharge: 0,
              gate: { enabled:false, linkHexUuid:"", strength:0.5, minFactionTier:"B", locked:false }
            }, (rawLey && typeof rawLey === "object") ? rawLey : {});

            // Ensure gate exists even if a legacy leylines object overwrote it
            baseLey.gate = Object.assign(
              { enabled:false, linkHexUuid:"", strength:0.5, minFactionTier:"B", locked:false },
              (baseLey.gate && typeof baseLey.gate === "object") ? baseLey.gate : {}
            );


            const leylinesToPersist = Object.assign({
              primaryResonance: "none",
              flowState: "normal",
              purity: 0,
              memoryCharge: 0,
              gate: {
                enabled: false,
                linkHexUuid: "",
                strength: 0.5,
                minFactionTier: "B",
                locked: false
              }
            }, baseLey || {});

            // Top-level leylines
            leylinesToPersist.primaryResonance = String(fd.get("leylines.primaryResonance") || leylinesToPersist.primaryResonance || "none");
            leylinesToPersist.flowState        = String(fd.get("leylines.flowState") || leylinesToPersist.flowState || "normal");
            leylinesToPersist.purity           = clamp(fd.get("leylines.purity") ?? leylinesToPersist.purity ?? 0, -5, 5);
            leylinesToPersist.memoryCharge     = clamp(fd.get("leylines.memoryCharge") ?? leylinesToPersist.memoryCharge ?? 0, 0, 999);

            // Gate (nested)
            const g = Object.assign({
              enabled: false,
              linkHexUuid: "",
              strength: 0.5,
              minFactionTier: "B",
              locked: false
            }, (leylinesToPersist.gate && typeof leylinesToPersist.gate === "object") ? leylinesToPersist.gate : {});

            g.enabled = (fd.get("leylines.gate.enabled") === "on");

            // accept either field name from HBS
            const gateTarget =
              fd.get("leylines.gate.linkHexUuid") ??
              fd.get("leylines.gate.targetHexUuid") ??
              null;

            g.linkHexUuid = String(gateTarget || g.linkHexUuid || "").trim();

            g.strength = clamp(fd.get("leylines.gate.strength") ?? g.strength ?? 0.5, 0, 1);

            // accept either field name from HBS
            const gateMinTier =
              fd.get("leylines.gate.minFactionTier") ??
              fd.get("leylines.gate.minTier") ??
              null;

            g.minFactionTier = String(gateMinTier || g.minFactionTier || "B").toUpperCase();

            g.locked = (fd.get("leylines.gate.locked") === "on");


            leylinesToPersist.gate = g;

            // Optional OP cache derived from the same visible vector, modulated by flowState
            const flowState = String(leylinesToPersist.flowState || "normal");
            const effectiveOPs = resourcesToOP(resourcesToPersist, flowState);

            const name = (data.name ?? "").trim() || dr.text || "Hex";
            const now = Date.now();

            // Flags patch — we’ll set per-key for robustness
            const flagsPatch = {
              isHex:true, kind:"territory-hex", name,
              factionId:data.factionId || "",
              status:data.status || "unclaimed",
              type:data.type || "wilderness",
              // Terrain Canon (writer-of-record): derive from existing flags or Type mapping.
              // (Hex Config currently authors `type`, not `terrain` directly.)
              terrain: (() => {
                const existingKey = bbttccReadTerrainKeyFromFlags(f) || null;
                const fromType = bbttccTerrainFromType(data.type || "wilderness");
                const key = bbttccNormalizeTerrainKey(existingKey || fromType || "plains");
                return bbttccBuildTerrainObj(key);
              })(),
              terrainType: (() => {
                const existingKey = bbttccReadTerrainKeyFromFlags(f) || null;
                const fromType = bbttccTerrainFromType(data.type || "wilderness");
                const key = bbttccNormalizeTerrainKey(existingKey || fromType || "plains");
                return key;
              })(),
              terrainKey: (() => {
                const existingKey = bbttccReadTerrainKeyFromFlags(f) || null;
                const fromType = bbttccTerrainFromType(data.type || "wilderness");
                const key = bbttccNormalizeTerrainKey(existingKey || fromType || "plains");
                return key;
              })(),

              size:data.size || "none",
              population:data.population || "uninhabited",
              capital: !!data.capital,

              // Visible numbers (either manual base, or auto effective)
              resources: resourcesToPersist,

              // Leylines (with Gate)
              leylines: leylinesToPersist,

              // Transparency / preview
              sephirotBonus: calc.added,
              calc: {
                base: vectorForDisplay,
                sephirotName: selName,
                multipliers: calc.multipliers,
                modifiers: mods,
                effective: calc.effective
              },

              // Alignment (all forms for fast lookups)
              sephirotUuid: selUuid,
              sephirotName: selName,
              sephirotKey:  selKey,

              // Manual switch (for readers who care)
              manualOverride: (existingGMOverride || !!(manualResourceOverride && Object.values(base).some(n=>n>0))),

              // Optional: OP cache for sheets/turn math
              effectiveCached: effectiveOPs,
              effectiveAt: now,

              // Notes / mods
              modifiers: mods,
              notes: data.notes ?? ""
            };

            // Write per-key to avoid any scene/permission quirk
            for (const [k,v] of Object.entries(flagsPatch)) {
              // eslint-disable-next-line no-await-in-loop
              await dr.setFlag(MOD, k, v);
            }
            await dr.update({ text:name }).catch(()=>{});

            // Verify; compact log
            const fresh = await fromUuid(dr.uuid);
            const gf = (k)=> fresh.getFlag(MOD, k);
            console.log("[bbttcc-territory] Save verify:", {
              name: gf("name"),
              type: gf("type"),
              size: gf("size"),
              resources: gf("resources"),
              leylines: gf("leylines"),
              manualOverride: gf("manualOverride"),
              effectiveCached: gf("effectiveCached"),
              effectiveAt: gf("effectiveAt")
            });

            await applyStyle(fresh);
            ui.notifications?.info?.("Hex saved.");
          } catch (err) {
            console.error("[bbttcc-territory] Save failed:", err);
            ui.notifications?.error?.("Hex save failed — see console.");
          }
        }
      },
      cancel:{ label:"Cancel" }
    },
    default:"save",
    close:()=>OPEN.delete(dr.id)
  },
  {
    id: "bbttcc-hex-config",
    width: 820,
    height: 820,
    resizable: true
  }
);

  OPEN.set(dr.id, dlg);
  dlg.render(true);
  // Phase 2: GM Manual Edit panel injection (Dialog content is V1)
  bbttccInjectGMPanelIntoHexConfigDialog(dlg, dr);
}

/* ---------------- Create Hex ---------------- */
function buildHexData({ x,y }){
  const g=canvas.scene?.grid?.size ?? 100;
  const r=Math.max(12, Math.round(g*0.5));
  const abs=hexVerts(x,y,r,detectStartAngle());
  const {rel,origin}=toRelativePoints(abs);
  const v=styleForStatus("unclaimed");
  return {
    shape:{type:"p", points:rel},
    x:origin.x, y:origin.y,
    fillAlpha:v.fillAlpha, fillColor:v.fillColor, strokeColor:v.strokeColor, strokeAlpha:v.strokeAlpha, strokeWidth:v.strokeWidth,
    text:"Hex",
    fontSize: 12,
    flags:{ [MOD]:{
      isHex:true, kind:"territory-hex", name:"Hex",
      status:"unclaimed", type:"wilderness", size:"none",
      population:"uninhabited", capital:false,
      resources:{ food:0, materials:0, trade:0, military:0, knowledge:0 },
      leylines:{
        primaryResonance:"none",
        flowState:"normal",
        purity:0,
        memoryCharge:0,
        gate:{ enabled:false, linkHexUuid:"", strength:0.5, minFactionTier:"B", locked:false }
      },
      createdAt: Date.now()
    }}
  };
}
async function _createHexAt(x,y){
  const c=snapCenter(x,y);
  const data=buildHexData(c);
  const [doc] = await canvas.scene.createEmbeddedDocuments("Drawing",[data]);
  await applyStyle(doc);
  return doc;
}

/* ---------------- Toolbar ---------------- */
function toolbarHTML(){
  return `
  <div id="${TOOLBAR_ID}" class="bbttcc-control-bar-wrap" data-bbttcc-toolbar="true" aria-label="BBTTCC Control Bar">
    <div class="bbttcc-toolbar bbttcc-control-bar">
      
      <div class="bbttcc-toolbar-left">
        <div class="bbttcc-toolbar-brand">
          <i class="fas fa-bars"></i>
          <strong>BBTTCC</strong>
        </div>
      </div>

      <div class="bbttcc-toolbar-center">
        <!-- MAIN ROW (ALL BUTTONS GO HERE) -->
        <div class="row bbttcc-toolbar-main"></div>
      </div>

      <div class="bbttcc-toolbar-right">
        <div class="row bbttcc-toolbar-utility">
          <button type="button" class="bbttcc-btn bbttcc-btn-icon" data-action="reset-pos" title="Re-center control bar">
            <i class="fas fa-undo"></i>
          </button>
        </div>
      </div>

    </div>
  </div>`;
}

function ensureToolbar(){
  let el = document.getElementById(TOOLBAR_ID);

  if (!el) {
    document.body.insertAdjacentHTML("beforeend", toolbarHTML());
    el = document.getElementById(TOOLBAR_ID);

    // central click handler
    el.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      onAction(btn.dataset.action);
    });
  }

  // normalize structure (safety if other scripts touched it)
  el.classList.add("bbttcc-control-bar-wrap");
  el.setAttribute("data-bbttcc-toolbar", "true");

  const shell = el.querySelector(".bbttcc-toolbar");
  if (shell) shell.classList.add("bbttcc-control-bar");

  /* -----------------------------
     BASE BUTTON INJECTION (NEW)
  ----------------------------- */

  const row = el.querySelector(".bbttcc-toolbar-main");

  if (row && !row.querySelector('[data-action="territory-dashboard"]')) {
    const mk = (action, icon, label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bbttcc-btn";
      btn.dataset.action = action;
      btn.innerHTML = `<i class="fas fa-${icon}"></i><span>${label}</span>`;
      return btn;
    };

    row.appendChild(mk("territory-dashboard", "th-large", "Dashboard"));
    row.appendChild(mk("create-hex", "draw-polygon", "Create Hex"));
    row.appendChild(mk("campaign-overview", "list", "Overview"));
  }

  return el;
}

/* ---------------- Placement flow ---------------- */
let placing=false;
function endPlacement(){ placing=false; try{ canvas.stage.off?.("pointerdown", onDown);}catch{} window.removeEventListener("keydown", onEsc, {capture:true}); ui.notifications?.info?.("Hex placement ended."); }
function onEsc(e){ if (e.key==="Escape") endPlacement(); }
async function onDown(ev){
  if (!placing) return; endPlacement();
  try {
    const w=worldFromEvent(ev);
    const doc=await game.bbttcc.api.territory._createHexInternal(w.x,w.y);
    if (doc?.uuid) await openHexEditorByUuid(doc.uuid);
    ui.notifications?.info?.("Hex created.");
  } catch(err){
    console.error(`[${MOD}] hex create failed`, err);
    ui.notifications?.error?.("Failed to create hex.");
  }
}
function beginPlaceHex(){ if (placing) return; placing=true; ui.notifications?.info?.("Click anywhere to place a hex (Esc to cancel)."); window.addEventListener("keydown", onEsc, {capture:true}); canvas.stage.on?.("pointerdown", onDown, {once:true}); }

/* ---------------- Toolbar actions ---------------- */
async function onAction(action){
  const api = game?.bbttcc?.api?.territory ?? {};

  if (action==="reset-pos") {
    const el = document.getElementById(TOOLBAR_ID);
    if (el) {
      el.style.left = "";
      el.style.top = "";
      el.style.right = "";
      el.style.bottom = "";
      el.style.transform = "";
    }
    return ui.notifications?.info?.("Control bar re-centered.");
  }

  if (action==="territory-dashboard") {
    // ✅ Prefer the safe opener installed by overview-button.js (AppV2-safe)
    if (typeof globalThis.BBTTCC_OpenTerritoryDashboard === "function") {
      return globalThis.BBTTCC_OpenTerritoryDashboard();
    }

    // ✅ Fallback: AppV2-safe open without legacy singleton
    const ctor = globalThis.BBTTCC_TerritoryDashboardCtor || api._dashboardCtor;
    if (typeof ctor !== "function") return ui.notifications?.warn?.("Dashboard unavailable.");

    game.bbttcc = game.bbttcc || {};
    game.bbttcc.apps = game.bbttcc.apps || {};

    let inst = game.bbttcc.apps.territoryDashboard;
    const dead = !inst || typeof inst.render !== "function" || inst._state === 0;

    if (dead) {
      inst = new ctor();
      game.bbttcc.apps.territoryDashboard = inst;
    }

    inst.render({ force: true, focus: true });
    return inst;
  }

  if (action==="campaign-overview") {
    if (typeof api.openCampaignOverview==="function") return api.openCampaignOverview();
    return ui.notifications?.warn?.("Campaign Overview unavailable.");
  }

  if (action==="create-hex") {
    if (typeof api.createHexAt!=="function") return ui.notifications?.warn?.("createHexAt API unavailable.");
    beginPlaceHex();
  }
}


/* ---------------- GM Adapter: gmSetHex (Phase 1.5) ----------------
 * Core GM write-layer calls game.bbttcc.api.territory.gmSetHex({ hexUuid, patch, note }).
 * We store values in flags.bbttcc-territory.* to match existing hex config patterns.
 *
 * Supported patch paths (structured objects):
 *   travel.unitsOverride               -> flags.travel.unitsOverride
 *   development.stage                  -> flags.integration.progress (alias) + flags.development.stage
 *   development.locked                 -> flags.integration.locked   (alias) + flags.development.locked
 *   alarm.value / alarm.locked         -> flags.alarm.value / flags.alarm.locked
 *   campaign.onEnterBeatId             -> flags.campaign.onEnterBeatId
 *
 * Notes:
 * - GM-only; Core already enforces GM-only + allowlist, but we re-check for safety.
 * - Values are clamped/sanitized where sensible (e.g., integration progress 0–6).
 */
function _bbttccIsGM(){ try { return !!(game && game.user && game.user.isGM); } catch (e) { return false; } }

function _bbttccClamp(n, lo, hi){
  n = Number(n);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

async function gmSetHex(args){
  args = args || {};
  if (!_bbttccIsGM()) throw new Error("[bbttcc-territory] GM-only: gmSetHex");
  const hexUuid = args.hexUuid;
  const patch = args.patch || {};
  if (!hexUuid) throw new Error("[bbttcc-territory] gmSetHex requires hexUuid");
  const dr = await fromUuid(hexUuid);
  if (!dr) throw new Error("[bbttcc-territory] Hex not found: " + hexUuid);

  const f = foundry.utils.getProperty(dr, `flags.${MOD}`) ?? {};

  // Merge nested objects safely without spread
  const mergeObj = (a, b) => Object.assign({}, (a && typeof a === "object") ? a : {}, (b && typeof b === "object") ? b : {});

  // 0) manualOverride (authority switch)
  // - true  => GM overrides are authoritative; engine should not recompute
  // - false => resume system control / recompute
  // - null  => clear the flag entirely
  if (Object.prototype.hasOwnProperty.call(patch, "manualOverride")) {
    const mv = patch.manualOverride;
    if (mv === null) {
      await dr.unsetFlag(MOD, "manualOverride");
    } else {
      await dr.setFlag(MOD, "manualOverride", !!mv);
    }
  }

  // 1) travel.unitsOverride
  if (patch.travel && Object.prototype.hasOwnProperty.call(patch.travel, "unitsOverride")) {
    const v = patch.travel.unitsOverride;
    if (v === null) await dr.unsetFlag(MOD, "travel");
    else {
      const units = _bbttccClamp(v, 0, 99);
      await dr.setFlag(MOD, "travel", mergeObj(f.travel, { unitsOverride: units }));
    }
  }

  // 2) development.stage / development.locked (alias integration.progress/locked)
  if (patch.development && Object.prototype.hasOwnProperty.call(patch.development, "stage")) {
    const v = patch.development.stage;
    if (v === null) {
    await dr.unsetFlag(MOD, "development");
    } else {
      const stage = _bbttccClamp(v, 0, 6);

      // IMPORTANT: merge from CURRENT flags, not stale snapshot
      const curDev = (await dr.getFlag(MOD, "development")) || {};
      const curIn  = (await dr.getFlag(MOD, "integration")) || {};

      await dr.setFlag(MOD, "development", mergeObj(curDev, { stage }));
      await dr.setFlag(MOD, "integration", mergeObj(curIn, { progress: stage }));

      // Legacy readers sometimes expect a flat integrationProgress number
      try { await dr.setFlag(MOD, "integrationProgress", stage); } catch (e) {}
    }
  }

  if (patch.development && Object.prototype.hasOwnProperty.call(patch.development, "locked")) {
    const v = patch.development.locked;
    if (v === null) {
      // Clear ONLY the lock, keep stage/progress intact
      const curDev = (await dr.getFlag(MOD, "development")) || {};
      const curIn  = (await dr.getFlag(MOD, "integration")) || {};

      delete curDev.locked;
      delete curIn.locked;

      await dr.setFlag(MOD, "development", curDev);
      await dr.setFlag(MOD, "integration", curIn);
      try { await dr.unsetFlag(MOD, "integrationLocked"); } catch (e) {}
    } else {
      const locked = !!v;

      // IMPORTANT: merge from CURRENT flags, not stale snapshot
      const curDev = (await dr.getFlag(MOD, "development")) || {};
      const curIn  = (await dr.getFlag(MOD, "integration")) || {};

      await dr.setFlag(MOD, "development", mergeObj(curDev, { locked }));
      await dr.setFlag(MOD, "integration", mergeObj(curIn, { locked }));
      try { await dr.setFlag(MOD, "integrationLocked", locked); } catch (e) {}
    }
  }

  // 3) alarm
  if (patch.alarm && Object.prototype.hasOwnProperty.call(patch.alarm, "value")) {
    const v = patch.alarm.value;
    if (v === null) await dr.unsetFlag(MOD, "alarm");
    else {
      const av = _bbttccClamp(v, 0, 99);
      await dr.setFlag(MOD, "alarm", mergeObj(f.alarm, { value: av }));
    }
  }
  if (patch.alarm && Object.prototype.hasOwnProperty.call(patch.alarm, "locked")) {
    const v = patch.alarm.locked;
    if (v === null) await dr.unsetFlag(MOD, "alarm");
    else {
      const locked = !!v;
      await dr.setFlag(MOD, "alarm", mergeObj(f.alarm, { locked: locked }));
    }
  }

  // 4) campaign.onEnterBeatId
  if (patch.campaign && Object.prototype.hasOwnProperty.call(patch.campaign, "onEnterBeatId")) {
    const v = patch.campaign.onEnterBeatId;
    if (v === null) await dr.unsetFlag(MOD, "campaign");
    else {
      const beatId = String(v || "").trim();
      await dr.setFlag(MOD, "campaign", mergeObj(f.campaign, { onEnterBeatId: beatId }));
    }
  }

  try { await applyStyle(dr); } catch (e) {}
  return { ok: true, hexUuid: dr.uuid, name: (dr.text || f.name || "Hex") };
}


/* ---------------- Ready ---------------- */
Hooks.once("ready", ()=>{
// One-time migration: normalize existing bbttcc-factions warLogs entries so they all have ts+date.
// Safe for Alpha: runs once on ready; only writes if changes are detected.
(async () => {
  try {
    const MOD = "bbttcc-factions";
    const actors = game?.actors?.contents || [];
    for (const a of actors) {
      if (!a?.getFlag?.(MOD, "isFaction")) continue;
      const wl = a.getFlag(MOD, "warLogs");
      if (!Array.isArray(wl) || wl.length === 0) continue;

      const before = wl;
      const updateData = { flags: { [MOD]: { warLogs: before } } };
      bbttccNormalizeWarLogsInUpdate(updateData);
      const after = updateData.flags[MOD].warLogs;

      // detect change
      const changed =
        before.length !== after.length ||
        before.some((e, i) => (e?.ts !== after[i]?.ts) || (e?.date !== after[i]?.date));

      if (changed) {
        await a.setFlag(MOD, "warLogs", after);
      }
    }
  } catch (e) {
    console.warn("[bbttcc] warLog normalization migration failed", e);
  }
})();


  ensureToolbar();
  game.bbttcc ??= { api:{} };
  game.bbttcc.api ??= {};
  game.bbttcc.api.territory ??= {};
  // Terrain Canon: expose current-scene migrator (GM macro can call this)
  game.bbttcc.api.territory.migrateTerrainFlagsCurrentScene = bbttccMigrateTerrainFlagsCurrentScene;
  game.bbttcc.api.territory.normalizeTerrainKey = bbttccNormalizeTerrainKey;
  game.bbttcc.api.territory.buildTerrainObj = bbttccBuildTerrainObj;


  // Leylines — Gates (Remote Adjacency) resolver API (Sprint B.2 Step 2)
  game.bbttcc.api.territory.leylines = game.bbttcc.api.territory.leylines || {};
  game.bbttcc.api.territory.leylines.tierRank = _bbttccTierRank;
  game.bbttcc.api.territory.leylines.getFactionTierKey = _bbttccGetFactionTierKey;
  game.bbttcc.api.territory.leylines.gateUsable = function(args){ return _bbttccGateUsable(args || {}); };
  game.bbttcc.api.territory.leylines.resolveRemoteAdjacency = function(args){ return bbttccResolveRemoteAdjacency(args || {}); };


  // Leylines: expose conversion helper for debugging / macros
  game.bbttcc.api.territory.resourcesToOP = (res, flowState)=> resourcesToOP(res, flowState);
  game.bbttcc.api.territory.LEY_FLOW_MULT = LEY_FLOW_MULT;

  // Phase 1.5: GM write adapter for hex direct edits
  game.bbttcc.api.territory.gmSetHex = gmSetHex;

  game.bbttcc.api.territory._createHexInternal = _createHexAt;
  game.bbttcc.api.territory.createHexAt = async (a,b)=>{
    let x,y; if (typeof a==="object") ({x,y}=a); else { x=a; y=b; }
    const doc=await _createHexAt(x,y); if (doc?.uuid) await openHexEditorByUuid(doc.uuid); return doc;
  };
  game.bbttcc.api.territory.openHexConfig = (uuid)=> openHexEditorByUuid(uuid);
  game.bbttcc.api.territory.claim        = (uuid)=> openHexEditorByUuid(uuid);
  game.bbttcc.api.territory.refreshCapitalOverlays = ()=> bbttccRefreshAllCapitalOverlays();
});

Hooks.on("canvasReady", () => {
  // Re-ensure the BBTTCC toolbar exists whenever a new scene is drawn.
  // If it's already there, ensureToolbar() does nothing.
  try {
    ensureToolbar();
  } catch (e) {
    console.warn("[bbttcc-territory] ensureToolbar on canvasReady failed", e);
  }
  try {
    bbttccRefreshAllCapitalOverlays();
  } catch (e) {
    console.warn("[bbttcc-territory] capital overlay rebuild on canvasReady failed", e);
  }
});

Hooks.on("updateDrawing", (doc) => {
  try {
    const f = doc && doc.flags ? doc.flags[MOD] : null;
    if (!f || (!f.isHex && f.kind !== "territory-hex")) return;
    bbttccRefreshCapitalOverlayForDrawing(doc);
  } catch (e) {
    console.warn("[bbttcc-territory] capital overlay updateDrawing failed", e);
  }
});

Hooks.on("deleteDrawing", (doc) => {
  try {
    const host = bbttccGetCapitalOverlayHost();
    if (!host) return;
    const label = "bbttcc-capital-overlay:" + String(doc && doc.id || "");
    const existing = host.children.find(c => c && c.label === label);
    if (existing) {
      host.removeChild(existing);
      try { existing.destroy({ children:true }); } catch (_e) {}
    }
  } catch (e) {
    console.warn("[bbttcc-territory] capital overlay deleteDrawing failed", e);
  }
});

// Player-facing Hex Sheet opener (AppV2-safe)
//
// This replaces the older Dialog-only shell. It renders the full Hex Sheet template
// (modules/bbttcc-territory/templates/hex-sheet.hbs) with actual hex data.
// Accepts either:
//   openHexSheet("DrawingUUID...")
//   openHexSheet({ hexUuid: "DrawingUUID..." })
//   openHexSheet({ uuid: "DrawingUUID..." })
(() => {
  const TPL_HEX_SHEET = `modules/${MOD}/templates/hex-sheet.hbs`;
  const _HEX_SHEET_OPEN = new Map(); // hexUuid -> app instance

  function _clamp(n, lo, hi) {
    n = Number(n);
    if (!Number.isFinite(n)) n = lo;
    return Math.max(lo, Math.min(hi, n));
  }

  function _toInt(n, fb = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.round(x) : fb;
  }

  function _pips(current, max) {
    const cur = _clamp(_toInt(current, 0), 0, max);
    const out = [];
    for (let i = 1; i <= max; i++) out.push({ on: i <= cur });
    return out;
  }

  function _radTier(rad) {
    const r = Math.max(0, _toInt(rad, 0));
    if (r <= 0) return "—";
    if (r <= 2) return "I";
    if (r <= 5) return "II";
    if (r <= 9) return "III";
    return "IV";
  }

  function _resolveHexUuid(arg) {
    // Tolerant signature handler: string or object payload.
    // Supports nested payloads (e.g. { hexUuid: { uuid:"..." } }).
    if (!arg) return "";

    // Direct string UUID
    if (typeof arg === "string") return String(arg).trim();

    // Some callers pass a Document-like thing directly
    if (arg && typeof arg === "object" && typeof arg.uuid === "string") return String(arg.uuid).trim();

    if (typeof arg === "object") {
      let h = arg.hexUuid ?? arg.uuid ?? arg.drawingUuid ?? arg.id ?? "";

      // Nested object cases: {hexUuid:{uuid:"..."}} or {hexUuid:{id:"..."}} etc.
      if (h && typeof h === "object") {
        if (typeof h.uuid === "string") h = h.uuid;
        else if (typeof h.id === "string" && typeof h.documentName === "string") {
          // Best-effort: if it's a Document-ish payload (rare), keep id only.
          h = h.id;
        } else if (typeof h.id === "string") h = h.id;
        else h = "";
      }

      // Sometimes callers pass dataset objects by mistake: { currentTarget: { dataset:{ hexUuid:"..." } } }
      if (!h && arg.currentTarget && arg.currentTarget.dataset) {
        h = arg.currentTarget.dataset.hexUuid || arg.currentTarget.dataset.hexUUID || arg.currentTarget.dataset.uuid || "";
      }

      return String(h || "").trim();
    }

    return String(arg || "").trim();
  }

  class BBTTCC_HexSheetApp extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "bbttcc-hex-sheet",
      window: { title: "BBTTCC — Hex Sheet", icon: "fas fa-hexagon" },
      position: { width: 920, height: 720 },
      classes: ["bbttcc", "bbttcc-hex-sheet", "sheet"],
      resizable: true
    };

    static PARTS = { body: { template: TPL_HEX_SHEET } };

    constructor({ hexUuid }, options = {}) {
      super(options);
      this.hexUuid = String(hexUuid || "").trim();
    }

    async _resolveDrawing() {
      try {
        if (!this.hexUuid) return null;
        const doc = await fromUuid(this.hexUuid);
        return doc || null;
      } catch (_e) { return null; }
    }

    async _preparePartContext(partId, ctx) {
      if (partId !== "body") return ctx;

      const isGM = !!game.user?.isGM;
      const hexUuid = this.hexUuid;

      const dr = await this._resolveDrawing();
      if (!dr) {
        return {
          ...ctx,
          isGM,
          hexUuid,
          name: "(MISSING HEX)",
          size: "—",
          type: "—",
          status: "missing",
          ownerName: "—",
          facilitySummary: "None",
          integrationProgress: 0,
          integrationPips: _pips(0, 6),
          radiation: 0,
          radiationPips: _pips(0, 6),
          darkness: 0,
          darknessPips: _pips(0, 6),
          radiationTier: "—",
          conditionsCount: "0",
          hasConditions: false,
          conditions: [],
          hasResources: false,
          resourcesList: [],
          notes: `Could not resolve hex for UUID: ${String(hexUuid)}`
        };
      }

      const tf = dr.flags?.[MOD] ?? {};

      // Permission: GM always OK; non-GM must own the faction that owns the hex
      // (or the hex is ownerless).
      const factionId = String(tf.factionId || tf.ownerId || "").trim();
      const faction = factionId ? game.actors?.get?.(factionId) : null;

      if (!isGM) {
        const ok = !faction
          ? true
          : !!faction?.testUserPermission?.(game.user, "OWNER");
        if (!ok) {
          return {
            ...ctx,
            isGM,
            hexUuid,
            name: tf.name || dr.text || dr.name || "(Hex)",
            size: String(tf.size || "—"),
            type: String(tf.type || "—"),
            status: String(tf.status || "—"),
            ownerName: faction?.name || "—",
            facilitySummary: "—",
            integrationProgress: _clamp(tf.integration?.progress ?? 0, 0, 6),
            integrationPips: _pips(tf.integration?.progress ?? 0, 6),
            radiation: 0,
            radiationPips: _pips(0, 6),
            darkness: 0,
            darknessPips: _pips(0, 6),
            radiationTier: "—",
            conditionsCount: "—",
            hasConditions: false,
            conditions: [],
            hasResources: false,
            resourcesList: [],
            notes: "You don't have permission to view detailed hex data."
          };
        }
      }

      // Tracks (alpha-safe)
      const integration = _clamp(tf.integration?.progress ?? tf.integrationProgress ?? 0, 0, 6);
      const radiation = Math.max(0, _toInt(tf.radiation?.value ?? tf.radiation ?? 0, 0));
      const darkness = Math.max(0, _toInt(tf.darkness?.local ?? tf.localDarkness ?? tf.darkness ?? 0, 0));

      // Facilities (alpha-safe)
      const facs = Array.isArray(tf.facilities) ? tf.facilities : [];
      const facilitySummary = facs.length ? `${facs.length}` : "None";

      // Conditions (alpha-safe)
      const conditions = Array.isArray(tf.conditions) ? tf.conditions.map(c => String(c).trim()).filter(Boolean) : [];
      const hasConditions = conditions.length > 0;

      // Resources/Yields (what's recorded on the hex flags)
      const r = tf.resources || {};
      const resourcesList = [
        { label: "Food", value: _toInt(r.food ?? 0, 0) },
        { label: "Materials", value: _toInt(r.materials ?? 0, 0) },
        { label: "Trade", value: _toInt(r.trade ?? 0, 0) },
        { label: "Military", value: _toInt(r.military ?? 0, 0) },
        { label: "Knowledge", value: _toInt(r.knowledge ?? 0, 0) }
      ];
      const hasResources = resourcesList.some(x => Number(x.value || 0) !== 0);

      return {
        ...ctx,
        isGM,
        hexUuid,
        name: tf.name || dr.text || dr.name || "(Hex)",
        size: String(tf.size || "—"),
        type: String(tf.type || "—"),
        status: String(tf.status || "—"),
        ownerName: faction?.name || (tf.ownerName || "—"),
        facilitySummary,
        integrationProgress: integration,
        integrationPips: _pips(integration, 6),
        radiation,
        radiationPips: _pips(Math.min(6, radiation), 6),
        darkness,
        darknessPips: _pips(Math.min(6, darkness), 6),
        radiationTier: _radTier(radiation),
        conditionsCount: String(conditions.length),
        hasConditions,
        conditions,
        hasResources,
        resourcesList,
        notes: String(tf.notes || "").trim() || ""
      };
    }

    async _onRender(ctx, opts) {
      await super._onRender(ctx, opts);

      // Optional: GM controls (safe no-ops for now). We keep the buttons in the
      // template, but we don't hard-require gmSetHex to exist.
      const root = this.element?.[0] ?? this.element;
      if (!root || !(root instanceof HTMLElement)) return;

      if (root.dataset.bbttccHexSheetBound === "1") return;
      root.dataset.bbttccHexSheetBound = "1";

      root.addEventListener("click", async (ev) => {
        const btn = ev.target?.closest?.("button[data-action]");
        if (!btn) return;
        const act = String(btn.getAttribute("data-action") || "");
        if (!act) return;

        if (!game.user?.isGM) return;

        // Only wire the two high-signal controls for now:
        // - hex-config (open GM Hex Config)
        // - open-builder (future hook; currently opens config)
        if (act === "hex-config" || act === "open-builder") {
          ev.preventDefault(); ev.stopPropagation();
          const api = game.bbttcc?.api?.territory;
          const open = api?.openHexConfig || api?.claim || null;
          if (typeof open !== "function") return ui.notifications?.warn?.("Hex Config not available.");
          await open(this.hexUuid);
          return;
        }

        // GM adjust radiation (writes to flags.bbttcc-territory.radiation.value)
        if (act === "hex-rad") {
          ev.preventDefault(); ev.stopPropagation();
          const delta = Number(btn.getAttribute("data-delta") || 0) || 0;
          const dr = await this._resolveDrawing();
          if (!dr) return;
          const tf = dr.flags?.[MOD] ?? {};
          const cur = Math.max(0, _toInt(tf.radiation?.value ?? tf.radiation ?? 0, 0));
          const next = Math.max(0, cur + delta);
          await dr.setFlag(MOD, "radiation", Object.assign({}, (tf.radiation && typeof tf.radiation === "object") ? tf.radiation : {}, { value: next }));
          this.render({ force: true });
          return;
        }
      }, true);
    }
  }

  // Public opener
  game.bbttcc = game.bbttcc || {};
  game.bbttcc.api = game.bbttcc.api || {};
  game.bbttcc.api.territory = game.bbttcc.api.territory || {};

  game.bbttcc.api.territory.openHexSheet = async (arg) => {
    const hexUuid = _resolveHexUuid(arg);
    if (!hexUuid || hexUuid === "[object Object]") {
      console.warn("[bbttcc-territory] openHexSheet: bad hexUuid payload", { arg, hexUuid });
      return ui.notifications?.warn?.("Hex Sheet: could not read hex UUID (see console).");
    }
    if (!hexUuid) return ui.notifications?.warn?.("Hex Sheet: missing hex UUID.");

    // De-dupe per-hex
    const existing = _HEX_SHEET_OPEN.get(hexUuid);
    if (existing && existing.rendered) {
      try { existing.bringToTop?.(); } catch(_e) {}
      return existing;
    }

    const app = new BBTTCC_HexSheetApp({ hexUuid });
    _HEX_SHEET_OPEN.set(hexUuid, app);
    app.render({ force: true, focus: true });
    return app;
  };
})();


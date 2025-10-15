/* modules/bbttcc-territory/scripts/main.js */
const MOD = "bbttcc-territory";
const TOOLBAR_ID = "bbttcc-toolbar";
const TPL_HEX_CONFIG = `modules/${MOD}/templates/hex-config.hbs`;

/* ------------------------------------------------
   Handlebars helpers (idempotent)
--------------------------------------------------- */
Hooks.once("init", () => {
  if (!Handlebars.helpers.bbttcc_eq)
    Handlebars.registerHelper("bbttcc_eq", (a, b) => a === b);
  if (!Handlebars.helpers.bbttcc_contains)
    Handlebars.registerHelper("bbttcc_contains", (arr, v) => {
      if (!arr) return false;
      if (Array.isArray(arr)) return arr.includes(v);
      return String(arr).split(",").map(s => s.trim()).includes(v);
    });
});

/* ------------------------------------------------
   Visuals
--------------------------------------------------- */
function styleForStatus(status = "unclaimed", { capital = false } = {}) {
  if (status === "scorched") status = "occupied"; // legacy rename
  const table = {
    unclaimed: { fillColor:"#999999", strokeColor:"#333333", fillAlpha:0.20, strokeAlpha:0.90, strokeWidth:3 },
    claimed:   { fillColor:"#00B894", strokeColor:"#00695C", fillAlpha:0.22, strokeAlpha:0.95, strokeWidth:3 },
    contested: { fillColor:"#F39C12", strokeColor:"#AF601A", fillAlpha:0.24, strokeAlpha:0.95, strokeWidth:3 },
    occupied:  { fillColor:"#E74C3C", strokeColor:"#922B21", fillAlpha:0.26, strokeAlpha:0.95, strokeWidth:3 }
  };
  const base = table[status] ?? table.unclaimed;
  return { ...base, strokeWidth: base.strokeWidth + (capital ? 2 : 0) };
}

async function applyStyle(dr) {
  if (!dr) return;
  const f = dr.flags?.[MOD] ?? {};
  const st = styleForStatus(f.status, { capital: !!f.capital });
  await dr.update({
    fillColor: st.fillColor,
    fillAlpha: st.fillAlpha,
    strokeColor: st.strokeColor,
    strokeAlpha: st.strokeAlpha,
    strokeWidth: st.strokeWidth
  }).catch(() => {});
}

/* ------------------------------------------------
   Geometry & grid helpers
--------------------------------------------------- */
function detectStartAngle() {
  const isHex = !!canvas?.grid?.isHexagonal;
  const flatTop = isHex ? !!canvas.grid.columns : true;
  return flatTop ? 0 : -Math.PI / 6;
}
function hexVerts(cx, cy, r, start) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = start + i * Math.PI / 3;
    pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a)); // flat array [x1,y1,...]
  }
  return pts;
}
function toRelativePoints(abs) {
  const xs = [], ys = [];
  for (let i = 0; i < abs.length; i += 2) { xs.push(abs[i]); ys.push(abs[i+1]); }
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const rel = [];
  for (let i = 0; i < abs.length; i += 2) rel.push(abs[i]-minX, abs[i+1]-minY);
  return { rel, origin: { x: minX, y: minY } };
}
function snapCenter(x, y) {
  try {
    if (canvas?.grid?.getCenterPoint) return canvas.grid.getCenterPoint({ x, y });
    if (canvas?.grid?.getSnappedPoint) return canvas.grid.getSnappedPoint({ x, y }, 1);
  } catch {}
  const g = canvas.scene?.grid?.size ?? 100;
  return { x: Math.round(x / g) * g, y: Math.round(y / g) * g };
}

/* ------------------------------------------------
   Pointer → world coords (v13-safe)
--------------------------------------------------- */
function worldFromEvent(ev) {
  try {
    if (ev?.data?.getLocalPosition) return ev.data.getLocalPosition(canvas.app.stage);
    if (ev?.global) return canvas.stage.worldTransform.applyInverse(ev.global);
  } catch {}
  const cx = (canvas.scene?.width ?? 0) / 2;
  const cy = (canvas.scene?.height ?? 0) / 2;
  return { x: cx, y: cy };
}

/* ------------------------------------------------
   Owner list (factions)
--------------------------------------------------- */
function buildOwnerList() {
  const list = [];
  for (const a of game.actors?.contents ?? []) {
    const isFaction =
      a.getFlag?.("bbttcc-factions", "isFaction") === true ||
      String(a.system?.details?.type?.value ?? "").toLowerCase() === "faction";
    if (isFaction) list.push({ id: a.id, name: a.name });
  }
  return list.sort((A, B) => A.name.localeCompare(B.name));
}

/* ------------------------------------------------
   Sephirot discovery (world + packs + fallback)
--------------------------------------------------- */
async function buildSephirotList() {
  const out = new Map(); // name -> {uuid,name}

  // world items
  for (const it of game.items?.contents ?? []) {
    const name = it?.name ?? "";
    if (/^(Keter|Chokhmah|Binah|Chesed|Gevurah|Tiferet|Netzach|Hod|Yesod|Malkuth)$/i.test(name)) {
      out.set(name, { uuid: it.uuid, name });
    } else {
      const cat = it.getFlag?.("bbttcc-character-options", "category");
      if (cat && /sephiro/i.test(cat) && name) out.set(name, { uuid: it.uuid, name });
    }
  }

  // packs (preferred exact id; else heuristic)
  const PREFERRED = "bbttcc-character-options.sephirothic-alignments";
  const packsToCheck = [];
  if (game.packs?.has(PREFERRED)) packsToCheck.push(PREFERRED);
  else for (const p of game.packs ?? []) {
    const id = p?.collection ?? "", title = p?.metadata?.label ?? "";
    if (/sephiro/i.test(id) || /sephiro/i.test(title)) packsToCheck.push(id);
  }

  for (const pid of packsToCheck) {
    try {
      const pack = game.packs.get(pid);
      if (!pack) continue;
      const idx = await pack.getIndex({ fields: ["name"] });
      for (const e of idx) {
        const name = e?.name ?? "";
        if (!name) continue;
        if (/^(Keter|Chokhmah|Binah|Chesed|Gevurah|Tiferet|Netzach|Hod|Yesod|Malkuth)$/i.test(name) || /sephiro/i.test(name)) {
          const uuid = `Compendium.${pack.collection}.${e._id}`;
          if (!out.has(name)) out.set(name, { uuid, name });
        }
      }
    } catch {}
  }

  if (out.size === 0) {
    const names = ["Keter","Chokhmah","Binah","Chesed","Gevurah","Tiferet","Netzach","Hod","Yesod","Malkuth"];
    for (const name of names) out.set(name, { uuid: name.toLowerCase(), name });
  }
  return Array.from(out.values()).sort((A, B) => A.name.localeCompare(B.name));
}

/* ------------------------------------------------
   Sephirot additive bonuses (per-hex, conservative defaults)
   (These are added BEFORE percentage modifiers are applied.)
--------------------------------------------------- */
function sephirotResourceBonus(name) {
  const k = String(name || "").toLowerCase();
  // additive bonuses to the 5 resources
  switch (k) {
    case "keter":     return { food:1, materials:1, trade:1, military:1, knowledge:1 };
    case "chokhmah":  return { food:0, materials:0, trade:0, military:0, knowledge:3 };
    case "binah":     return { food:0, materials:1, trade:0, military:0, knowledge:2 };
    case "chesed":    return { food:1, materials:0, trade:2, military:0, knowledge:0 };
    case "gevurah":   return { food:0, materials:0, trade:0, military:3, knowledge:0 };
    case "tiferet":   return { food:0, materials:0, trade:1, military:1, knowledge:1 };
    case "netzach":   return { food:0, materials:0, trade:1, military:2, knowledge:0 };
    case "hod":       return { food:0, materials:2, trade:1, military:0, knowledge:0 };
    case "yesod":     return { food:0, materials:0, trade:1, military:0, knowledge:1 };
    case "malkuth":   return { food:0, materials:3, trade:0, military:0, knowledge:0 };
    default:          return { food:0, materials:0, trade:0, military:0, knowledge:0 };
  }
}

/* ------------------------------------------------
   Modifier engine (percent multipliers + notes)
   Returns: { mAll, mTrade, notes[] } — multiply AFTER additive bonuses
--------------------------------------------------- */
function getModifierEffects(modifiers = []) {
  const set = new Set((modifiers || []).map(m => String(m).trim().toLowerCase()));
  let mAll = 1.0;
  let mTrade = 1.0;
  const notes = [];

  const bump = (pct) => { mAll *= (1 + pct); };
  const bumpTrade = (pct) => { mTrade *= (1 + pct); };

  if (set.has("well-maintained"))  { bump(+0.25); notes.push("+1 defense, +1 loyalty"); }
  if (set.has("fortified"))        { /* +0% prod */ notes.push("+3 defense, siege resistant"); }
  if (set.has("strategic position")) { bump(+0.10); notes.push("+1 OP to adjacent hexes"); }
  if (set.has("loyal population")) { bump(+0.15); notes.push("+2 loyalty"); }
  if (set.has("trade hub"))        { bumpTrade(+0.50); notes.push("+2 Diplomacy OP generation"); }
  if (set.has("contaminated"))     { bump(-0.50); notes.push("Radiation exposure, population loss"); }
  if (set.has("damaged infrastructure")) { bump(-0.25); notes.push("Repair needed"); }
  if (set.has("hostile population")) { bump(-0.25); notes.push("-2 loyalty, sabotage risk"); }
  if (set.has("difficult terrain"))  { bump(-0.10); notes.push("Movement penalties, defensive bonus"); }
  if (set.has("radiation zone"))     { bump(-0.75); notes.push("Ongoing health damage"); }

  // Supply Line Vulnerable — variable; choose a conservative -15% unless later overridden
  if (set.has("supply line vulnerable")) { bump(-0.15); notes.push("Supply lines interdicted (variable)"); }

  // Hidden Resources — not a multiplier; record for roll-ups
  if (set.has("hidden resources")) notes.push("+1 random resource/turn");

  return { mAll, mTrade, notes };
}

/* ------------------------------------------------
   Resource compute
   base  -> add(sephirot) -> multiply(modifiers)
--------------------------------------------------- */
function computeEffectiveResources(base, sephirotName, modifiers) {
  const add = sephirotResourceBonus(sephirotName);
  const { mAll, mTrade } = getModifierEffects(modifiers);

  const afterAdd = {
    food:      Number(base.food||0)      + add.food,
    materials: Number(base.materials||0) + add.materials,
    trade:     Number(base.trade||0)     + add.trade,
    military:  Number(base.military||0)  + add.military,
    knowledge: Number(base.knowledge||0) + add.knowledge
  };

  // Apply global multiplier, then per-trade extra
  const mul = (v, m) => Math.max(0, Math.round(v * m));
  const eff = {
    food:      mul(afterAdd.food,      mAll),
    materials: mul(afterAdd.materials, mAll),
    trade:     mul(afterAdd.trade,     mAll * mTrade),
    military:  mul(afterAdd.military,  mAll),
    knowledge: mul(afterAdd.knowledge, mAll)
  };

  return { effective: eff, added: add, multipliers: { mAll, mTrade } };
}

/* ------------------------------------------------
   Hex Editor (singleton per drawing)
--------------------------------------------------- */
const _openEditors = new Map(); // drawing.id -> Dialog

async function openHexEditorByUuid(uuid) {
  if (!uuid) return ui.notifications?.warn?.("Hex not found.");
  const dr = await fromUuid(uuid);
  if (!dr) return ui.notifications?.warn?.("Hex not found.");

  const existing = _openEditors.get(dr.id);
  if (existing) { try { existing.bringToTop(); } catch {} return; }

  const ownerList = buildOwnerList();
  const sephirotList = await buildSephirotList();

  const f = foundry.utils.getProperty(dr, `flags.${MOD}`) ?? {};
  const sephirotUuid = f.sephirotUuid || "";
  const sephirotName = f.sephirotName || "";

  const context = {
    name: f.name ?? dr.text ?? "",
    ownerId: f.factionId ?? "",
    ownerList,
    status: f.status ?? "unclaimed",
    type: f.type ?? "settlement",
    size: f.size ?? "town",
    population: f.population ?? "medium",
    capital: !!f.capital,
    resources: {
      food:       Number(f.resources?.food ?? 0),
      materials:  Number(f.resources?.materials ?? 0),
      trade:      Number(f.resources?.trade ?? 0),
      military:   Number(f.resources?.military ?? 0),
      knowledge:  Number(f.resources?.knowledge ?? 0)
    },
    sephirotUuid,
    sephirotList,
    modifiers: Array.isArray(f.modifiers) ? f.modifiers : [],
    notes: f.notes ?? "",
    createdAt: f.createdAt ? new Date(f.createdAt).toLocaleString() : ""
  };

  const html = await renderTemplate(TPL_HEX_CONFIG, context);

  const dlg = new Dialog({
    title: "BBTTCC: Hex Configuration",
    content: `<form class="bbttcc-hex-config">${html}</form>`,
    buttons: {
      save: {
        icon: `<i class="far fa-save"></i>`,
        label: "Save",
        callback: async (jq) => {
          const form = jq[0].querySelector("form");
          const fd = new FormData(form);
          const data = {};
          for (const [k, v] of fd.entries()) {
            if (k === "modifiers") (data.modifiers ??= []).push(v);
            else if (k.startsWith("resources.")) {
              const key = k.split(".")[1];
              (data.resources ??= {})[key] = Number(v || 0);
            } else data[k] = v;
          }
          if (!fd.has("capital")) data.capital = false;

          // Resolve selected Sephirot label for bonuses
          const selUuid = data.sephirotUuid || "";
          let selName = "";
          if (selUuid) {
            const found = sephirotList.find(x => x.uuid === selUuid);
            selName = found?.name ?? selUuid;
          }

          // Compute EFFECTIVE totals every save (order: base -> +sephirot -> *modifiers)
          const base = {
            food:      Number(data.resources?.food ?? 0),
            materials: Number(data.resources?.materials ?? 0),
            trade:     Number(data.resources?.trade ?? 0),
            military:  Number(data.resources?.military ?? 0),
            knowledge: Number(data.resources?.knowledge ?? 0)
          };
          const mods = Array.isArray(data.modifiers) ? data.modifiers : [];
          const calc = computeEffectiveResources(base, selName, mods);

          const name = (data.name ?? "").trim() || dr.text || "Hex";
          const upd = {
            _id: dr.id,
            [`flags.${MOD}.isHex`]: true,
            [`flags.${MOD}.kind`]: "territory-hex",
            [`flags.${MOD}.name`]: name,
            [`flags.${MOD}.factionId`]: data.factionId || "",
            [`flags.${MOD}.status`]: data.status || "unclaimed",
            [`flags.${MOD}.type`]: data.type || "settlement",
            [`flags.${MOD}.size`]: data.size || "town",
            [`flags.${MOD}.population`]: data.population || "medium",
            [`flags.${MOD}.capital`]: !!data.capital,

            // Persist EFFECTIVE totals (visible numbers on the hex)
            [`flags.${MOD}.resources`]: calc.effective,

            // Transparency for roll-ups / UI
            [`flags.${MOD}.sephirotBonus`]: calc.added,
            [`flags.${MOD}.calc`]: {
              base,
              sephirotName: selName,
              multipliers: calc.multipliers,
              modifiers: mods
            },

            // Legacy-friendly selection fields
            [`flags.${MOD}.sephirotUuid`]: selUuid,
            [`flags.${MOD}.sephirotName`]: selName,

            // Keep any notes/modifiers
            [`flags.${MOD}.modifiers`]: mods,
            [`flags.${MOD}.notes`]: data.notes ?? "",
            text: name
          };

          await canvas.scene.updateEmbeddedDocuments("Drawing", [upd]);
          await applyStyle(dr);
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "save",
    close: () => { _openEditors.delete(dr.id); }
  });

  _openEditors.set(dr.id, dlg);
  dlg.render(true);
}

/* ------------------------------------------------
   Create hex (uses same editor directly after create)
--------------------------------------------------- */
function buildHexData({ x, y }) {
  const g = canvas.scene?.grid?.size ?? 100;
  const r = Math.max(12, Math.round(g * 0.5));
  const start = detectStartAngle();
  const abs = hexVerts(x, y, r, start);
  const { rel, origin } = toRelativePoints(abs);
  const visual = styleForStatus("unclaimed");
  return {
    shape: { type: "p", points: rel },
    x: origin.x,
    y: origin.y,
    fillAlpha: visual.fillAlpha,
    fillColor: visual.fillColor,
    strokeColor: visual.strokeColor,
    strokeAlpha: visual.strokeAlpha,
    strokeWidth: visual.strokeWidth,
    text: "Hex",
    flags: {
      [MOD]: {
        isHex: true,
        kind: "territory-hex",
        name: "Hex",
        status: "unclaimed",
        type: "settlement",
        size: "town",
        population: "medium",
        capital: false,
        // Base starts at 0; effective is computed on first Save after edit selections
        resources: { food: 0, materials: 0, trade: 0, military: 0, knowledge: 0 },
        createdAt: Date.now()
      }
    }
  };
}
async function _createHexAt(x, y) {
  const c = snapCenter(x, y);
  const data = buildHexData(c);
  const [doc] = await canvas.scene.createEmbeddedDocuments("Drawing", [data]);
  await applyStyle(doc);
  return doc;
}

/* ------------------------------------------------
   Toolbar (floating overlay)
--------------------------------------------------- */
function toolbarHTML() {
  return `
  <div id="${TOOLBAR_ID}" style="position:fixed; left:60px; top:60px; z-index:1000;">
    <div class="bbttcc-toolbar" style="min-width:220px; padding:.4rem .5rem; background:#1118; border:1px solid #444; border-radius:10px;">
      <div class="bbttcc-toolbar-handle" style="cursor:move; user-select:none; display:flex; align-items:center; gap:.5rem;">
        <i class="fas fa-grip-lines"></i><strong>BBTTCC</strong>
        <span style="flex:1;"></span>
        <button type="button" data-action="reset-pos" title="Reset toolbar"><i class="fas fa-undo"></i></button>
      </div>
      <div style="display:flex; gap:.35rem; margin-top:.35rem; flex-wrap:wrap;">
        <button type="button" data-action="territory-dashboard"><i class="fas fa-th-large"></i> Dashboard</button>
        <button type="button" data-action="create-hex"><i class="fas fa-draw-polygon"></i> Create Hex</button>
        <button type="button" data-action="campaign-overview"><i class="fas fa-list"></i> Overview</button>
      </div>
    </div>
  </div>`;
}
function ensureToolbar() {
  let el = document.getElementById(TOOLBAR_ID);
  if (!el) {
    document.body.insertAdjacentHTML("beforeend", toolbarHTML());
    el = document.getElementById(TOOLBAR_ID);
    const handle = el.querySelector(".bbttcc-toolbar-handle");
    let drag = false, sx = 0, sy = 0, pid;
    handle.addEventListener("pointerdown", e => {
      drag = true;
      const r = el.getBoundingClientRect();
      sx = (e.clientX ?? 0) - r.left;
      sy = (e.clientY ?? 0) - r.top;
      pid = e.pointerId; el.setPointerCapture?.(pid);
    });
    window.addEventListener("pointermove", e => {
      if (!drag) return;
      el.style.left = `${Math.max(0, (e.clientX ?? 0) - sx)}px`;
      el.style.top = `${Math.max(0, (e.clientY ?? 0) - sy)}px`;
    });
    window.addEventListener("pointerup", () => { drag = false; if (pid) el.releasePointerCapture?.(pid); });
    el.addEventListener("click", e => {
      const btn = e.target.closest("button[data-action]");
      if (btn) onAction(btn.dataset.action);
    });
  }
}

/* ------------------------------------------------
   Placement flow
--------------------------------------------------- */
let placing = false;
function endPlacement() {
  placing = false;
  try { canvas.stage.off?.("pointerdown", onDown); } catch {}
  window.removeEventListener("keydown", onEsc, { capture: true });
  ui.notifications?.info?.("Hex placement ended.");
}
function onEsc(e) { if (e.key === "Escape") endPlacement(); }

async function onDown(ev) {
  if (!placing) return;
  endPlacement();
  try {
    const w = worldFromEvent(ev);
    const doc = await game.bbttcc.api.territory._createHexInternal(w.x, w.y);
    if (doc?.uuid) await openHexEditorByUuid(doc.uuid); // open the new editor directly
    ui.notifications?.info?.("Hex created.");
  } catch (err) {
    console.error(`[${MOD}] hex create failed`, err);
    ui.notifications?.error?.("Failed to create hex.");
  }
}
function beginPlaceHex() {
  if (placing) return;
  placing = true;
  ui.notifications?.info?.("Click anywhere to place a hex (Esc to cancel).");
  window.addEventListener("keydown", onEsc, { capture: true });
  canvas.stage.on?.("pointerdown", onDown, { once: true });
}

/* ------------------------------------------------
   Toolbar actions
--------------------------------------------------- */
async function onAction(action) {
  const api = game?.bbttcc?.api?.territory ?? {};
  if (action === "reset-pos") {
    const el = document.getElementById(TOOLBAR_ID);
    if (el) { el.style.left = "60px"; el.style.top = "60px"; }
    return ui.notifications?.info?.("Toolbar reset.");
  }
  if (action === "territory-dashboard") {
    const ctor = globalThis.BBTTCC_TerritoryDashboardCtor || api._dashboardCtor;
    if (typeof ctor !== "function")
      return ui.notifications?.warn?.("Dashboard unavailable.");
    (globalThis.__bbttcc_dashboard ??= new ctor()).render(true, { focus: true });
  }
  if (action === "campaign-overview") {
    if (typeof api.openCampaignOverview === "function")
      return api.openCampaignOverview();
    return ui.notifications?.warn?.("Campaign Overview unavailable.");
  }
  if (action === "create-hex") {
    if (typeof api.createHexAt !== "function")
      return ui.notifications?.warn?.("createHexAt API unavailable.");
    beginPlaceHex();
  }
}

/* ------------------------------------------------
   Public API + ready
--------------------------------------------------- */
Hooks.once("ready", () => {
  ensureToolbar();
  game.bbttcc ??= { api: {} };
  game.bbttcc.api ??= {};
  game.bbttcc.api.territory ??= {};

  // internal primitive
  game.bbttcc.api.territory._createHexInternal = _createHexAt;

  // external (object or positional), opens editor directly
  game.bbttcc.api.territory.createHexAt = async (a, b) => {
    let x, y;
    if (typeof a === "object") ({ x, y } = a); else { x = a; y = b; }
    const doc = await _createHexAt(x, y);
    if (doc?.uuid) await openHexEditorByUuid(doc.uuid);
    return doc;
  };

  // used by dashboard/edit
  game.bbttcc.api.territory.openHexConfig = (uuid) => openHexEditorByUuid(uuid);
  game.bbttcc.api.territory.claim = (uuid) => openHexEditorByUuid(uuid);
});

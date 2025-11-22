/* modules/bbttcc-territory/apps/campaign-overview-app.js */
const MOD = "bbttcc-territory";
const FACTIONS_MOD = "bbttcc-factions";
const FACTION_SHEET_CLASS = `${FACTIONS_MOD}.BBTTCCFactionSheet`;

const log  = (...a) => console.log(`[${MOD}]`, ...a);
const warn = (...a) => console.warn(`[${MOD}]`, ...a);

/* ========= Size table (unchanged) ========= */
const SIZE_TABLE = {
  outpost:     { mult: 0.50, defense: 0, label: "Outpost" },
  village:     { mult: 0.75, defense: 1, label: "Village" },
  town:        { mult: 1.00, defense: 1, label: "Town" },
  city:        { mult: 1.50, defense: 2, label: "City" },
  metropolis:  { mult: 2.00, defense: 3, label: "Metropolis" },
  megalopolis: { mult: 3.00, defense: 4, label: "Megalopolis" }
};
const SIZE_ALIAS = { small:"outpost", standard:"town", large:"metropolis" };

/* ========= Modifier spec (unchanged) ========= */
const MODS = {
  "Well-Maintained": { multAll:+0.25, defense:+1, loyalty:+1 },
  "Fortified": { defense:+3 },
  "Strategic Position": { multAll:+0.10, flags:{ adjacencyBonus:true } },
  "Hidden Resources": {},
  "Loyal Population": { multAll:+0.15, loyalty:+2 },
  "Trade Hub": { multPer:{ trade:+0.50 }, diplomacy:+2 },
  "Contaminated": { multAll:-0.50, flags:{ radiation:true } },
  "Damaged Infrastructure": { multAll:-0.25 },
  "Hostile Population": { multAll:-0.25, loyalty:-2 },
  "Supply Line Vulnerable": { multAll:-0.10, flags:{ supplyVulnerable:true } },
  "Difficult Terrain": { multAll:-0.10, defense:+1 },
  "Radiation Zone": { multAll:-0.75, flags:{ radiation:true, radiationZone:true } }
};

/* ========= Sephirot effects (unchanged) ========= */
const SEPHIROT = {
  keter:    { addPer:{ all:+1 }, tech:+1 },
  chokmah:  { addPer:{ knowledge:+2, trade:+2 } },
  binah:    { addPer:{ knowledge:+2, trade:+2 } },
  chesed:   { diplomacy:+3, loyalty:+3 },
  gevurah:  { addPer:{ military:+3 }, defense:+1 },
  tiferet:  { diplomacy:+2, loyalty:+2 },
  netzach:  { addPer:{ military:+2 }, loyalty:+2 },
  hod:      { addPer:{ knowledge:+2, trade:+2 } },
  yesod:    { addPer:{ trade:+2 }, diplomacy:+2 },
  malkuth:  { addPer:{ trade:+4 } }
};

/* ========= Helpers ========= */
function calcBaseByType(type) {
  const base = { food:0, materials:0, trade:0, military:0, knowledge:0 };
  switch ((type ?? "").toLowerCase()) {
    case "farm":       base.food = 20; base.trade = 5; break;
    case "mine":       base.materials = 20; base.trade = 5; break;
    case "settlement": base.trade = 10; base.military = 5; break;
    case "fortress":   base.military = 20; break;
    case "port":       base.trade = 15; base.food = 5; break;
    case "factory":    base.materials = 15; base.military = 5; break;
    case "research":   base.knowledge = 20; break;
    case "temple":     base.knowledge = 10; base.trade = 5; break;
    case "ruins":      base.materials = 5; break;
    default: break;
  }
  return base;
}
const zRes = () => ({ food:0, materials:0, trade:0, military:0, knowledge:0, technology:0 });
const addRes = (A, B) => { for (const k in A) A[k] = Number(A[k]) + Number(B?.[k] ?? 0); return A; };
function looksLikeTechnocrat(actor) {
  try { return JSON.stringify(actor?.flags ?? {}).toLowerCase().includes("technocrat"); }
  catch { return false; }
}
function normalizeSizeKey(sizeRaw) {
  if (!sizeRaw) return "town";
  let k = String(sizeRaw).toLowerCase().trim();
  if (SIZE_ALIAS[k]) k = SIZE_ALIAS[k];
  return SIZE_TABLE[k] ? k : "town";
}
function keyFromName(n){ return String(n||"").toLowerCase().trim().replace(/[^\p{L}]+/gu,""); }
async function resolveSephirotKeyFromFlags(f) {
  if (f.sephirotKey) return String(f.sephirotKey).toLowerCase().trim();
  if (!f.sephirotUuid) return "";
  try { const it = await fromUuid(f.sephirotUuid); return keyFromName(it?.name ?? ""); }
  catch { return ""; }
}
const HR_KEYS = ["food","materials","trade","military","knowledge"];
function stablePickResourceForHiddenResources(drawId) {
  const s = String(drawId || ""); let h = 0;
  for (let i=0;i<s.length;i++) h = (h + s.charCodeAt(i)) % 9973;
  return HR_KEYS[h % HR_KEYS.length];
}

/** Apply size + modifiers + sephirot; return effective outputs & side-effects. */
async function effHexWithAll(dr) {
  const f = dr.flags?.[MOD] ?? {};

  // Size
  const sizeKey = normalizeSizeKey(f.size);
  const { mult, defense: sizeDefense } = SIZE_TABLE[sizeKey];

  // Base (stored or auto)
  const stored = {
    food: Number(f.resources?.food ?? 0),
    materials: Number(f.resources?.materials ?? 0),
    trade: Number(f.resources?.trade ?? 0),
    military: Number(f.resources?.military ?? 0),
    knowledge: Number(f.resources?.knowledge ?? 0)
  };
  const auto = !!f.autoCalc || Object.values(stored).every(n => n === 0);
  const base = auto ? calcBaseByType(f.type ?? "settlement") : stored;
  const sized = Object.fromEntries(Object.entries(base).map(([k,v]) => [k, Number(v) * mult]));

  // Modifiers
  let factorAll = 1.0;
  const factorPer = { food:1, materials:1, trade:1, military:1, knowledge:1 };
  const addPer    = { food:0, materials:0, trade:0, military:0, knowledge:0 };
  let defense = sizeDefense, loyalty = 0, diplomacy = 0;
  let flags = { radiation:false, supplyVulnerable:false, adjacencyBonus:false };

  if (Array.isArray(f.modifiers)) {
    for (const m of f.modifiers) {
      const spec = MODS[m]; if (!spec) continue;
      if (typeof spec.multAll === "number") factorAll *= (1 + spec.multAll);
      if (spec.multPer) for (const k of Object.keys(spec.multPer)) factorPer[k] *= (1 + Number(spec.multPer[k]||0));
      if (spec.addPer)  for (const k of Object.keys(spec.addPer))  addPer[k]   += Number(spec.addPer[k]||0);
      if (typeof spec.defense   === "number") defense   += spec.defense;
      if (typeof spec.loyalty   === "number") loyalty   += spec.loyalty;
      if (typeof spec.diplomacy === "number") diplomacy += spec.diplomacy;
      if (spec.flags?.radiation)        flags.radiation = true;
      if (spec.flags?.supplyVulnerable) flags.supplyVulnerable = true;
      if (spec.flags?.adjacencyBonus)   flags.adjacencyBonus = true;

      if (m === "Hidden Resources") {
        const pick = stablePickResourceForHiddenResources(dr.id || dr.uuid || "");
        addPer[pick] += 1;
      }
    }
  }

  // Apply multiplicative + additive effects
  const eff = {};
  for (const k of Object.keys(sized)) eff[k] = Number(sized[k]) * factorAll * factorPer[k];
  for (const k of Object.keys(addPer)) eff[k] = Number(eff[k]) + Number(addPer[k] || 0);

  // Sephirot bonuses
  const sephKey = await resolveSephirotKeyFromFlags(f);
  const se = SEPHIROT[sephKey];
  if (se) {
    if (se.addPer) {
      if (se.addPer.all) {
        for (const k of ["food","materials","trade","military","knowledge"]) {
          eff[k] = Number(eff[k]) + Number(se.addPer.all);
        }
      }
      for (const k of Object.keys(se.addPer)) {
        if (k === "all") continue;
        eff[k] = Number(eff[k]) + Number(se.addPer[k] || 0);
      }
    }
    if (typeof se.defense   === "number") defense   += se.defense;
    if (typeof se.loyalty   === "number") loyalty   += se.loyalty;
    if (typeof se.diplomacy === "number") diplomacy += se.diplomacy;
  }

  for (const k of Object.keys(eff)) eff[k] = Math.round(eff[k]);

  let technology = Number(eff.knowledge || 0);
  if ((f.type ?? "") === "research") technology += 2;
  if (se?.tech) technology += Number(se.tech||0);

  return {
    ...eff,
    technology,
    defenseBonus: Number(defense || 0),
    loyaltyDelta: Number(loyalty || 0),
    diplomacyDelta: Number(diplomacy || 0),
    flags
  };
}

/* ========= Faction + Character helpers (mirror faction sheet) ========= */
function isFactionActor(a) {
  if (!a) return false;
  try {
    if (a.getFlag?.(FACTIONS_MOD, "isFaction") === true) return true;
    const sysType = String(foundry.utils.getProperty(a, "system.details.type.value") ?? "").toLowerCase();
    if (sysType === "faction") return true;
    const sheetClass = a.getFlag?.("core", "sheetClass") ?? foundry.utils.getProperty(a, "flags.core.sheetClass");
    if (sheetClass === FACTION_SHEET_CLASS) return true;
    const ctorName = a?.sheet?.constructor?.name || "";
    if (ctorName.includes("BBTTCCFactionSheet")) return true;
    return false;
  } catch { return false; }
}
function isCharacter(a) { return String(a?.type ?? "").toLowerCase() === "character"; }
function normalizeOps(obj = {}) {
  return {
    violence:   Number(obj.violence   ?? 0),
    nonlethal:  Number(obj.nonlethal  ?? obj.nonLethal ?? 0),
    intrigue:   Number(obj.intrigue   ?? 0),
    economy:    Number(obj.economy    ?? 0),
    softpower:  Number(obj.softpower  ?? obj.softPower ?? 0),
    diplomacy:  Number(obj.diplomacy  ?? 0),
    logistics:  Number(obj.logistics  ?? 0),
    culture:    Number(obj.culture    ?? 0),
    faith:      Number(obj.faith      ?? 0)
  };
}
function characterBelongsToFaction(char, faction) {
  const byId = char.getFlag?.(FACTIONS_MOD, "factionId");
  if (byId) return byId === faction.id;
  const legacyName = char?.flags?.[MOD]?.faction;
  if (!legacyName) return false;
  return String(legacyName).trim() === String(faction.name).trim();
}

/* ========= Status bands (Power Levels) ========= */
const STATUS_BANDS = [
  { key: "Emerging",    min: 0,   max: 99 },
  { key: "Growing",     min: 100, max: 199 },
  { key: "Established", min: 200, max: 299 },
  { key: "Powerful",    min: 300, max: 399 },
  { key: "Dominant",    min: 400, max: Infinity }
];
function bandFor(total) {
  for (const b of STATUS_BANDS) if (total >= b.min && total <= b.max) return b.key;
  return "Emerging";
}

/* Sum Faction Value + Roster (exactly like the faction sheet) */
function computeFactionTotalOPs(faction) {
  const KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];

  const opsFlags = foundry.utils.duplicate(faction.getFlag(FACTIONS_MOD, "ops") || {});
  const value = normalizeOps(Object.fromEntries(
    KEYS.map(k => [k, Number(opsFlags?.[k]?.value ?? 0)])
  ));

  const contribTotals = { violence:0, nonlethal:0, intrigue:0, economy:0, softpower:0, diplomacy:0, logistics:0, culture:0, faith:0 };
  for (const a of game.actors.contents) {
    if (!isCharacter(a)) continue;
    if (!characterBelongsToFaction(a, faction)) continue;

    let c = a.getFlag?.(FACTIONS_MOD, "opContribution");
    if (!c || Object.values(c).every(v => (Number(v)||0) === 0)) {
      c = a?.flags?.["bbttcc-character-options"]?.calculatedOPs || {};
    }
    const cc = normalizeOps(c);
    for (const k of KEYS) contribTotals[k] += Number(cc[k] || 0);
  }

  const total = KEYS.reduce((sum, k) => sum + (Number(value[k] || 0) + Number(contribTotals[k] || 0)), 0);
  return Math.max(0, Number(total) || 0);
}

/* ========= Faction Health reader (shared semantics with faction sheet) ========= */
function readHealthFlags(actor) {
  const victory  = actor.getFlag(FACTIONS_MOD, "victory")  || {};
  const darkness = actor.getFlag(FACTIONS_MOD, "darkness") || {};
  const morale   = actor.getFlag(FACTIONS_MOD, "morale");
  const loyalty  = actor.getFlag(FACTIONS_MOD, "loyalty");

  return {
    vp: Number(victory.vp ?? 0),
    unity: Number(victory.unity ?? 0),
    morale: Number(morale ?? 0),
    loyalty: Number(loyalty ?? 0),
    darkness: (typeof darkness.global === "number")
      ? darkness.global
      : (typeof darkness === "number" ? darkness : 0)
  };
}

/* ========= Great Work (Tikkun) helpers ========= */
const SPARK_THRESHOLD = 3;
function readGreatWorkDisplay(faction) {
  const api = game.bbttcc?.api?.tikkun;
  if (!api || typeof api.getGreatWorkState !== "function") {
    return { sparks: "—", status: "—", title: "" };
  }
  try {
    const st = api.getGreatWorkState(faction.id, { sparkThreshold: SPARK_THRESHOLD });
    const integrated = Number(st.integratedCount || 0);
    const sparksStr = `${integrated}/${SPARK_THRESHOLD}`;

    let status = "Not Ready";
    if (st.ready) status = "Ready";
    else if (integrated > 0 || (st.metrics && (st.metrics.unity > 0 || st.metrics.vp > 0))) {
      status = "Approaching";
    }

    const reasons = Array.isArray(st.reasons) ? st.reasons.filter(Boolean) : [];
    const title = st.ready
      ? "All Great Work conditions satisfied."
      : (reasons.length ? reasons.join("; ") : "Conditions not yet met.");

    return { sparks: sparksStr, status, title };
  } catch (e) {
    warn("readGreatWorkDisplay failed", e);
    return { sparks: "—", status: "—", title: "" };
  }
}

/* ================= Campaign Overview App (AppV2 + HBS) ================= */
class BBTTCC_CampaignOverview extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-campaign-overview",
    title: "BBTTCC — Campaign Overview",
    width: 980,
    height: 600,
    resizable: true,
    classes: ["bbttcc","bbttcc-overview"]
  };
  static PARTS = { body: { template: `modules/${MOD}/templates/campaign-overview.hbs` } };

  async _preparePartContext(partId, context) {
    if (partId !== "body") return context;

    /* 1) Collect factions robustly */
    let factions = (game.actors?.contents ?? []).filter(isFactionActor);
    if (!factions.length) {
      factions = (game.actors?.contents ?? []).filter(a => {
        const sheetClass = a.getFlag?.("core","sheetClass") ?? a?.flags?.core?.sheetClass;
        return sheetClass === FACTION_SHEET_CLASS;
      });
    }

    /* 2) Pre-scan all hexes across scenes */
    const allDrawings = [];
    for (const sc of game.scenes?.contents ?? []) {
      for (const dr of sc.drawings?.contents ?? []) {
        const f = dr.flags?.[MOD] ?? {};
        if (f.isHex === true || f.kind === "territory-hex") allDrawings.push({ sc, dr, f });
      }
    }

    /* 3) Build rows */
    const rows = [];
    for (const fa of factions) {
      const res = zRes();
      const scenesSet = new Map();
      let hexCount = 0;
      let defenseTotal = 0, loyaltyTotal = 0, diplomacyTotal = 0;
      let hasRadiation = false, hasSupplyIssues = false, hasAdjacencyBonus = false;

      for (const { sc, dr } of allDrawings) {
        const f = dr.flags?.[MOD] ?? {};
        if ((f.factionId ?? "") !== fa.id) continue;
        hexCount++;
        scenesSet.set(sc.id, sc.name);
        const eff = await effHexWithAll(dr);
        defenseTotal   += Number(eff.defenseBonus || 0);
        loyaltyTotal   += Number(eff.loyaltyDelta || 0);
        diplomacyTotal += Number(eff.diplomacyDelta || 0);
        hasRadiation   ||= !!eff.flags?.radiation;
        hasSupplyIssues||= !!eff.flags?.supplyVulnerable;
        hasAdjacencyBonus ||= !!eff.flags?.adjacencyBonus;
        addRes(res, eff);
      }
      if (looksLikeTechnocrat(fa)) res.technology = Math.round(res.technology * 1.15);

      const totalOPs = computeFactionTotalOPs(fa);
      const statusKey = bandFor(totalOPs);
      const statusLabel = game.i18n?.localize?.(`BBTTCC.PowerLevels.${statusKey}`) || statusKey;

      rows.push({
        hasActor: true,
        factionName: fa.name,
        factionId: fa.id,

        powerLabel: statusLabel,
        powerTotal: totalOPs,
        power: statusLabel,

        hexCount,
        defenseTotal, loyaltyTotal, diplomacyTotal,
        flags: { hasRadiation, hasSupplyIssues, hasAdjacencyBonus },
        scenes: Array.from(scenesSet.values()).sort((a,b)=>a.localeCompare(b)),
        resources: res
      });
    }

    /* Unclaimed row (no faction health or GW) */
    const unclaimed = zRes();
    const unScenes = new Map();
    let unHex = 0, unDefense = 0, unLoyalty = 0, unDiplomacy = 0;
    let unHasRad = false, unHasSupply = false, unHasAdj = false;

    for (const { sc, dr } of allDrawings) {
      const f = dr.flags?.[MOD] ?? {};
      if ((f.factionId ?? "") !== "") continue;
      unHex++; unScenes.set(sc.id, sc.name);
      const eff = await effHexWithAll(dr);
      unDefense   += Number(eff.defenseBonus || 0);
      unLoyalty   += Number(eff.loyaltyDelta || 0);
      unDiplomacy += Number(eff.diplomacyDelta || 0);
      unHasRad    ||= !!eff.flags?.radiation;
      unHasSupply ||= !!eff.flags?.supplyVulnerable;
      unHasAdj    ||= !!eff.flags?.adjacencyBonus;
      addRes(unclaimed, eff);
    }
    if (unHex > 0) {
      rows.push({
        hasActor: false,
        factionName: "Unclaimed",
        factionId: "",
        powerLabel: "—",
        powerTotal: 0,
        power: "—",
        hexCount: unHex,
        defenseTotal: unDefense,
        loyaltyTotal: unLoyalty,
        diplomacyTotal: unDiplomacy,
        flags: { hasRadiation: unHasRad, hasSupplyIssues: unHasSupply, hasAdjacencyBonus: unHasAdj },
        scenes: Array.from(unScenes.values()).sort((a,b)=>a.localeCompare(b)),
        resources: unclaimed
      });
    }

    rows.sort((A,B)=>A.factionName.localeCompare(B.factionName));
    return { rows };
  }

  async _onRender(ctx, opts) {
    await super._onRender(ctx, opts);
    const root = this.element;
    if (!(root instanceof HTMLElement)) return;

    // -----------------------------------------------------------------------
    // 1) Rename "Power" header → "Status"
    // -----------------------------------------------------------------------
    const statusLabel = game.i18n?.localize?.("BBTTCC.Labels.Status") || "Status";
    const thData = root.querySelector("th[data-col='power']");
    if (thData) thData.textContent = statusLabel;
    else {
      const headers = [...root.querySelectorAll("thead th")];
      const h = headers.find(el => String(el.textContent || "").trim().toLowerCase() === "power");
      if (h) h.textContent = statusLabel;
    }

    // -----------------------------------------------------------------------
    // 2) Substitute Status cell contents using up-to-date OP bands
    // -----------------------------------------------------------------------
    let headers = [...root.querySelectorAll("thead th")];
    let colIdx = headers.findIndex(el => /^(power|status)$/i.test(String(el.textContent || "").trim()));
    if (colIdx < 0) {
      colIdx = headers.findIndex(el => (el.getAttribute("data-col") || "").toLowerCase() === "power");
    }

    try {
      if (colIdx >= 0) {
        const rows = [...root.querySelectorAll("tbody tr")];
        for (const tr of rows) {
          const cells = [...tr.children];
          const td = cells[colIdx];
          if (!td) continue;
          const openBtn = tr.querySelector("[data-open-faction]");
          const actorId = openBtn?.getAttribute?.("data-open-faction") || "";
          const faction = actorId && game.actors?.get(actorId);
          let labelText = "—";
          if (faction) {
            const totalOPs = computeFactionTotalOPs(faction);
            const key = bandFor(totalOPs);
            labelText = game.i18n?.localize?.(`BBTTCC.PowerLevels.${key}`) || key;
          }
          td.textContent = labelText;
        }
      }
    } catch (e) {
      warn("Status cell substitution failed", e);
    }

    // -----------------------------------------------------------------------
    // 3) Inject Faction Health + Great Work columns
    // -----------------------------------------------------------------------
    try {
      const table = root.querySelector("table");
      if (!table) throw new Error("Overview table not found.");

      // Clean up any prior injection on re-render
      const oldHealthThs = table.querySelectorAll("th[data-bbttcc-health]");
      oldHealthThs.forEach(th => th.remove());
      const oldHealthTds = table.querySelectorAll("td[data-bbttcc-health]");
      oldHealthTds.forEach(td => td.remove());

      const headRow = table.querySelector("thead tr");
      if (!headRow) throw new Error("Header row not found.");

      const HEALTH_COLS = [
        { key: "vp",      label: "VP" },
        { key: "unity",   label: "Unity" },
        { key: "morale",  label: "Morale" },
        { key: "loyalty", label: "Loyalty" },
        { key: "dark",    label: "Darkness" },
        { key: "sparks",  label: "Sparks" },
        { key: "gw",      label: "Great Work" }
      ];

      // Append new header cells
      for (const col of HEALTH_COLS) {
        const th = document.createElement("th");
        th.dataset.bbttccHealth = "1";
        th.textContent = col.label;
        th.style.whiteSpace = "nowrap";
        headRow.appendChild(th);
      }

      const bodyRows = [...table.querySelectorAll("tbody tr")];
      for (const tr of bodyRows) {
        const openBtn = tr.querySelector("[data-open-faction]");
        const actorId = openBtn?.getAttribute?.("data-open-faction") || "";
        const faction = actorId && game.actors?.get(actorId);

        let vals = {
          vp: "—", unity: "—", morale: "—", loyalty: "—", dark: "—",
          sparks: "—", gw: "—"
        };
        let gwState = null;

        if (faction) {
          const h = readHealthFlags(faction);
          vals.vp      = String(h.vp ?? 0);
          vals.unity   = `${Number(h.unity ?? 0)}%`;
          vals.morale  = `${Number(h.morale ?? 0)}%`;
          vals.loyalty = `${Number(h.loyalty ?? 0)}%`;
          vals.dark    = String(h.darkness ?? 0);

          gwState = readGreatWorkDisplay(faction);
          if (gwState) {
            vals.sparks = gwState.sparks;
            vals.gw     = gwState.status;
          }
        }

        for (const col of HEALTH_COLS) {
          const td = document.createElement("td");
          td.dataset.bbttccHealth = "1";
          td.style.textAlign = "center";
          td.textContent = vals[col.key];

          if (col.key === "gw" && gwState && gwState.title) {
            td.title = gwState.title;
          }

          tr.appendChild(td);
        }
      }
    } catch (e) {
      warn("Health + Great Work column injection failed", e);
    }

    // -----------------------------------------------------------------------
    // 4) Click handler for "open faction" buttons (unchanged)
    // -----------------------------------------------------------------------
    if (this._evAbort) { try { this._evAbort.abort(); } catch {} }
    this._evAbort = new AbortController();
    const sig = this._evAbort.signal;

    root.addEventListener("click", (ev) => {
      const btn = ev.target.closest?.("button[data-open-faction]");
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();
      const actorId = btn.getAttribute("data-open-faction") || "";
      const actor = actorId && game.actors?.get(actorId);
      if (!actor) return ui.notifications?.warn?.("Faction actor not found.");
      try { actor.sheet?.render(true, { focus: true }); }
      catch (e) { warn("Failed to open faction sheet", e); ui.notifications?.error?.("Could not open that faction (see console)."); }
    }, { capture: true, signal: sig });
  }

  async close(opts) {
    if (this._evAbort) { try { this._evAbort.abort(); } catch {} this._evAbort = null; }
    return super.close(opts);
  }
}

/* Publish ctor + opener */
globalThis.BBTTCC_CampaignOverviewCtor = BBTTCC_CampaignOverview;
Hooks.once("ready", () => {
  try {
    game.bbttcc ??= { api: {} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.territory ??= {};
    game.bbttcc.api.territory.openCampaignOverview = () => {
      const C = globalThis.BBTTCC_CampaignOverviewCtor;
      if (typeof C === "function") new C().render(true, { focus: true });
      else ui.notifications?.warn?.("Campaign Overview app not available.");
    };
    log("Campaign Overview opener registered.");
  } catch (e) { warn("Failed to register Campaign Overview opener", e); }
});

export { BBTTCC_CampaignOverview };

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
const zRes = () => ({ food:0, materials:0, trade:0, military:0, knowledge:0 });
const addRes = (A, B) => { for (const k in A) A[k] = Number(A[k]) + Number(B?.[k] ?? 0); return A; };
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

  return {
    ...eff,
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

/* ============== Help / tooltip dictionary (central registry) ==============
   Registered into game.bbttcc.help (bbttcc-core) under appKey "overview" at
   ready. Consumed three ways:
     - template:  data-tooltip="{{bbttccTip 'overview' '<key>'}}"  (campaign-overview.hbs)
     - JS DOM:    _ovTip("<key>")  (injected Faction-Health columns, World-Health chip)
     - tours:     inert data-tour="overview.<key>" anchors use the same keys.
   Style: "Name — what it is. What it does mechanically. When/why you'd use it."
   Numbers are read from the actual engines: this file (STATUS_BANDS,
   SIZE_TABLE, MODS, SEPHIROT, effHexWithAll), bbttcc-tikkun api.tikkun.js
   (getGreatWorkState thresholds: sparks 3 / VP 10 / Unity 30 / Darkness ≤3,
   corrupted sparks excluded), and bbttcc-epic repair.js + presence.js
   (World-Health = aligned/total hexes; Reach by Presence band 1/2/3/5). */
const OVERVIEW_TIPS = {
  // ---- Header / strip ----
  header:      "Campaign Overview — the GM's read-only rollup of every faction in the world: territory, per-turn yields, defense, faction health, and Great Work readiness, aggregated across all Scenes. Nothing here edits anything; use Open to jump to a faction sheet.",
  scope:       "Scope — this table aggregates every territory hex on every Scene in the world, unlike the Territory Dashboard, which shows only the current Scene.",
  worldHealth: "World-Health — the Act-I win track: the percentage of all hexes that are both reunified under a protagonist (converged-Steward) faction and healed (Purified, or per-hex Darkness ≤ 3). At 100% Malkuth aligns and Act I completes. Reach is how many acts of repair the party can perform per turn, set by their pooled Presence band: Low 1, Mid 2, High 3, Apex 5.",

  // ---- Base columns ----
  colFaction:   "Faction — every Bad Eden faction actor in the world, plus an Unclaimed row that aggregates ownerless hexes.",
  colStatus:    "Status — the faction's power band, from its total OPs (the faction's own value plus every member's contribution): Emerging 0–99, Growing 100–199, Established 200–299, Powerful 300–399, Dominant 400+.",
  colHexes:     "Hexes — how many territory hexes the faction holds across all Scenes.",
  colScenes:    "Scenes — which Scenes the faction's hexes sit on.",
  colResources: "Resources (per turn) — the faction's summed effective yields: each hex's base pips × size multiplier × modifiers, plus sephirot bonuses, totalled across every holding. This is the production the turn engine converts into OP income.",
  colDefense:   "Defense — the summed defensive bonuses across the faction's hexes, from size (Village/Town +1 … Megalopolis +4), modifiers (Fortified +3, Well-Maintained +1, Difficult Terrain +1…), and sephirot (Gevurah +1). Each hex's own share applies when that hex is raided.",
  colOpen:      "Open — jump to this faction's full sheet.",
  rowUnclaimed: "Unclaimed — the aggregate of every hex with no owning faction. Its yields flow to no one until the hexes are claimed.",

  // ---- Injected Faction-Health / Great-Work columns ----
  health:  "Faction Health — VP, Unity, Morale, Loyalty, Darkness, Sparks, and Great Work, read live from each faction actor and the Tikkun engine.",
  vp:      "VP — Victory Points on the faction's victory track. Great Work readiness requires VP ≥ 10.",
  unity:   "Unity — the faction's internal cohesion (%). Great Work readiness requires Unity ≥ 30.",
  morale:  "Morale — the faction's fighting spirit (%), read from the faction sheet's health flags; raids, upkeep, and events move it.",
  loyalty: "Loyalty — how loyal the faction's population and membership are (%), read from the faction sheet's health flags; hex modifiers like Loyal/Hostile Population push it during play.",
  dark:    "Darkness — the faction's global Qliphothic taint. It climbs 1 per turn while the faction owns any Radiated hex, and cleansing Purified territory lowers it. Great Work readiness requires Darkness ≤ 3.",
  sparks:  "Sparks — integrated Holy Sparks toward the Great Work, shown against the threshold of 3. Corrupted sparks do not count until they are repaired and re-deposited.",
  gw:      "Great Work — the readiness verdict: Ready when Sparks ≥ 3, Unity ≥ 30, VP ≥ 10, Darkness ≤ 3, and no corrupted sparks are held; Approaching when partway there. Hover a row's cell to see the exact blockers."
};

// Stamp a registry tooltip onto a JS-built element (skips silently when the
// registry isn't available — e.g. bbttcc-core disabled).
function _ovTip(el, key) {
  try {
    const t = game.bbttcc?.help?.tip?.("overview", key) || "";
    if (t && el) el.dataset.tooltip = t;
  } catch (_e) {}
}

/* ================= Campaign Overview App (AppV2 + HBS) ================= */
class BBTTCC_CampaignOverview extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  // Mirror the Territory Dashboard's AppV2 option shape so the window is actually
  // resizable and sized via position/window (legacy flat width/height/resizable
  // keys are ignored by ApplicationV2). Do NOT mutate the shared super defaults.
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(
    foundry.utils.deepClone(super.DEFAULT_OPTIONS || {}),
    {
      id: "bbttcc-campaign-overview",
      classes: ["bbttcc","bbttcc-overview","bbttcc-be","bbttcc-theme-gm"],
      position: { width: 1100, height: 640 },
      window: {
        title: "Bad Eden — Campaign Overview",
        resizable: true,
        controls: [],
        icon: ""
      }
    },
    { inplace: false }
  );
  static PARTS = { body: { template: `modules/${MOD}/templates/campaign-overview.hbs` } };

  constructor(options={}) {
    super(options);
    // Protect against upstream mutations of the window option shape.
    try {
      this.options.window ??= {};
      if (!Array.isArray(this.options.window.controls)) this.options.window.controls = [];
      if (this.options.window.icon == null) this.options.window.icon = "";
    } catch (_) {}
    this._bbttccScrollTop = 0;
  }

  _findScroller() {
    const root = this.element;
    return root?.querySelector?.(".window-content") || root;
  }

  _rememberScroll() {
    try { this._bbttccScrollTop = this._findScroller()?.scrollTop ?? 0; } catch {}
  }

  _restoreScroll() {
    try {
      const sc = this._findScroller();
      if (sc && typeof this._bbttccScrollTop === "number") sc.scrollTop = this._bbttccScrollTop;
    } catch {}
  }

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

    // Keep the scroll position stable across re-renders.
    this._restoreScroll();

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
          // Write into the styled pill when present — td.textContent nuked the
          // .bbttcc-pill span so Status rendered unstyled (fixed 2026-07-08).
          const pill = td.querySelector(".bbttcc-pill");
          if (pill) pill.textContent = labelText;
          else td.textContent = labelText;
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
      let firstHealthTh = true;
      for (const col of HEALTH_COLS) {
        const th = document.createElement("th");
        th.dataset.bbttccHealth = "1";
        th.textContent = col.label;
        th.style.whiteSpace = "nowrap";
        _ovTip(th, col.key);
        if (firstHealthTh) { th.dataset.tour = "overview.health"; firstHealthTh = false; }
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
            // Per-row verdict detail (the exact blockers) wins over the generic
            // column explanation, rendered through Foundry's tooltip manager.
            td.dataset.tooltip = gwState.title;
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

    // -----------------------------------------------------------------------
    // 5) World-Health strip tooltip + tour anchor.
    //    bbttcc-epic injects #bbttcc-epic-worldhealth from the
    //    renderBBTTCC_CampaignOverview hook, which fires AFTER _onRender —
    //    so stamp on the next tick, once the chip exists (RFI + GM only).
    // -----------------------------------------------------------------------
    setTimeout(() => {
      try {
        const chip = this.element?.querySelector?.("#bbttcc-epic-worldhealth");
        if (!chip) return;
        _ovTip(chip, "worldHealth");
        chip.dataset.tour = "overview.worldHealth";
      } catch (_e) {}
    }, 0);
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

    // Explanation tooltips → central registry (bbttcc-core). Guarded: no-op
    // when bbttcc-core is disabled; {{bbttccTip}} then renders "".
    try { game.bbttcc?.help?.register?.("overview", OVERVIEW_TIPS); } catch (_eHelp) {}
    let _overviewApp = null;
    game.bbttcc.api.territory.openCampaignOverview = () => {
      const C = globalThis.BBTTCC_CampaignOverviewCtor;
      if (typeof C !== "function") return ui.notifications?.warn?.("Campaign Overview app not available.");
      // Singleton: repeated toolbar clicks were stacking fresh windows with
      // the same DOM id (fixed 2026-07-08).
      const alive = _overviewApp && (_overviewApp.rendered || _overviewApp.element?.isConnected);
      if (!alive) _overviewApp = new C();
      _overviewApp.render(true, { focus: true });
      return _overviewApp;
    };
    log("Campaign Overview opener registered.");
  } catch (e) { warn("Failed to register Campaign Overview opener", e); }
});

export { BBTTCC_CampaignOverview };

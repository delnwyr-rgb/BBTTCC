/* modules/bbttcc-factions/scripts/module.js
 * BBTTCC — Faction Sheet (v13-safe)
 * - Defense totals, Advance Turn/OP (Dry/Apply), Commit Turn
 * - Header strips: Bank/Stockpile (resources), OP Bank
 * - Raid Plan (player pre-staging) compact header grid
 */
const MODULE_ID = "bbttcc-factions";
const TER_MOD   = "bbttcc-territory";
const SHEET_ID  = `${MODULE_ID}.BBTTCCFactionSheet`;

const log  = (...a) => console.log(`[${MODULE_ID}]`, ...a);
const warn = (...a) => console.warn(`[${MODULE_ID}]`, ...a);
const clamp0 = (v) => Math.max(0, Number(v ?? 0) || 0);

/* ---------------- utils ---------------- */
function isFactionActor(a) {
  if (!a) return false;
  try {
    if (a.getFlag?.(MODULE_ID, "isFaction")) return true;
    const typ = foundry.utils.getProperty(a, "system.details.type.value");
    if (typ === "faction") return true;
  } catch (e) {}
  return false;
}
function isCharacter(a) {
  return a?.type === "character" || foundry.utils.getProperty(a, "type") === "character";
}
function getFlag(doc, path, fallback) {
  try { return doc.getFlag?.(MODULE_ID, path) ?? fallback; } catch { return fallback; }
}
function setFlag(doc, path, value) {
  try { return doc.setFlag?.(MODULE_ID, path, value); } catch { return null; }
}
function delFlag(doc, path) {
  try { return doc.unsetFlag?.(MODULE_ID, path); } catch { return null; }
}
function deepClone(obj) { return foundry.utils.duplicate(obj ?? {}); }
function zeroOps() {
  return {
    violence:0, nonlethal:0, intrigue:0, economy:0,
    softpower:0, diplomacy:0, logistics:0, culture:0, faith:0
  };
}
function zeroRes() {
  return {
    food:0, materials:0, trade:0, military:0, knowledge:0, technology:0
  };
}
function allFactions() {
  return game.actors?.contents?.filter?.(isFactionActor) ?? [];
}
function gmIds() {
  return game.users?.filter(u => u.isGM).map(u => u.id) ?? [];
}

/** list all faction actors (used in ready hook) */
function listFactionActors() {
  return allFactions();
}

/** ownership helper for hex drawings */
function _ownedByFaction(drawing, faction) {
  const f = drawing.flags?.[TER_MOD] ?? {};
  const ownerId = f.factionId || f.ownerId;
  const ownerName = f.faction ?? f.ownerName;
  return (ownerId && ownerId === faction.id) ||
         (!!ownerName && String(ownerName).trim() === String(faction.name).trim());
}

/** ensure faction hints/flags/type are consistent */
async function ensureFactionHints(actor) {
  try {
    if (!actor) return;

    const typePath = "system.details.type.value";
    const isFac = isFactionActor(actor);
    const updates = {};

    if (isFac) {
      if (!actor.getFlag(MODULE_ID, "isFaction")) {
        updates[`flags.${MODULE_ID}.isFaction`] = true;
      }
      const curType = foundry.utils.getProperty(actor, typePath);
      if (curType !== "faction") {
        updates[typePath] = "faction";
      }
    } else {
      if (actor.getFlag(MODULE_ID, "isFaction")) {
        updates[`flags.${MODULE_ID}.isFaction`] = null;
      }
    }

    if (Object.keys(updates).length) {
      await actor.update(updates);
    }
  } catch (e) {
    warn("ensureFactionHints", e);
  }
}

/* ---------------- OP display helpers ---------------- */
function fmtOpsRow(ops){
  const keys = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
  return keys.filter(k => (ops[k]||0) > 0).map(k => `<b>${(ops[k]||0)}</b> ${k}`).join(" • ") || "—";
}

/* ---------------- Power bands ---------------- */
const POWER_BANDS = [
  { key: "Emerging",    min: 0,   max: 99 },
  { key: "Growing",     min: 100, max: 199 },
  { key: "Established", min: 200, max: 299 },
  { key: "Powerful",    min: 300, max: 399 },
  { key: "Dominant",    min: 400, max: Infinity }
];
function computePowerKey(totalOPs) {
  for (const b of POWER_BANDS) if (totalOPs >= b.min && totalOPs <= b.max) return b.key;
  return "Emerging";
}

/* ===================================================================
   EFFECTIVE HEX CALC (defense included)
   =================================================================== */

const SIZE_TABLE = {
  outpost:     { mult: 0.50, defense: 0 },
  village:     { mult: 0.75, defense: 1 },
  town:        { mult: 1.00, defense: 1 },
  city:        { mult: 1.50, defense: 2 },
  metropolis:  { mult: 2.00, defense: 3 },
  megalopolis: { mult: 3.00, defense: 4 }
};
const SIZE_ALIAS = { small:"outpost", standard:"town", large:"metropolis" };

const MODS = {
  "Well-Maintained":       { multAll:+0.25, defense:+1, loyalty:+1 },
  "Fortified":             { defense:+3 },
  "Strategic Position":    { multAll:+0.10, flags:{ adjacencyBonus:true } },
  "Hidden Resources":      {},
  "Loyal Population":      { multAll:+0.15, loyalty:+2 },
  "Trade Hub":             { multPer:{ trade:+0.50 }, diplomacy:+2 },
  "Contaminated":          { multAll:-0.50, flags:{ radiation:true } },
  "Damaged Infrastructure":{ multAll:-0.25 },
  "Hostile Population":    { multAll:-0.25, loyalty:-2 },
  "Supply Line Vulnerable":{ multAll:-0.10, flags:{ supplyVulnerable:true } },
  "Difficult Terrain":     { multAll:-0.10, defense:+1 },
  "Radiation Zone":        { multAll:-0.75, flags:{ radiation:true, radiationZone:true } }
};

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

/* ---------------- Integration → efficiency multipliers ---------------- */

const INTEGRATION_STAGE_MULT = {
  wild:       1.00,
  outpost:    1.00,
  developing: 1.05,
  settled:    1.10,
  integrated: 1.20
};

function integrationStageKeyFromProgress(progressRaw) {
  let p = Math.round(Number(progressRaw ?? 0) || 0);
  if (p < 0) p = 0;
  if (p >= 6) return "integrated";
  if (p === 5) return "settled";
  if (p >= 3) return "developing";
  if (p >= 1) return "outpost";
  return "wild";
}

function integrationMultFromFlags(integrationFlags) {
  const progress = integrationFlags?.progress ?? 0;
  const stageKey = integrationStageKeyFromProgress(progress);
  const mult = INTEGRATION_STAGE_MULT[stageKey] ?? 1.0;
  return { mult, stageKey };
}

function normalizeSizeKey(sizeRaw) {
  if (!sizeRaw) return "town";
  let k = String(sizeRaw).toLowerCase().trim();
  if (SIZE_ALIAS[k]) k = SIZE_ALIAS[k];
  return SIZE_TABLE[k] ? k : "town";
}
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
  }
  return base;
}
const HR_KEYS = ["food","materials","trade","military","knowledge"];
function stablePickResourceForHiddenResources(drawId) {
  const s = String(drawId || ""); let h = 0;
  for (let i=0;i<s.length;i++) h = (h + s.charCodeAt(i)) % 9973;
  return HR_KEYS[h % HR_KEYS.length];
}
const zRes = () => ({ food:0, materials:0, trade:0, military:0, knowledge:0, technology:0 });
const addRes = (A, B) => { for (const k in A) A[k] = Number(A[k]) + Number(B?.[k] ?? 0); return A; };

async function resolveSephirotKeyFromFlags(f) {
  if (f.sephirotKey) return String(f.sephirotKey).toLowerCase().trim();
  if (!f.sephirotUuid) return "";
  try { const it = await fromUuid(f.sephirotUuid); return (it?.name ?? "").toLowerCase().replace(/[^\p{L}]+/gu,""); }
  catch { return ""; }
}

/** Apply size + modifiers + sephirot + integration; return effective outputs & side-effects. */
async function effHexWithAll(dr) {
  const f = dr.flags?.[TER_MOD] ?? {};

  const sizeKey = normalizeSizeKey(f.size);
  const { mult, defense: sizeDefense } = SIZE_TABLE[sizeKey];

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

  let factorAll = 1.0;
  const factorPer = { food:1, materials:1, trade:1, military:1, knowledge:1 };
  const addPer    = { food:0, materials:0, trade:0, military:0, knowledge:0 };
  let defense     = Number(sizeDefense || 0);

  const mods = Array.isArray(f.modifiers) ? f.modifiers : [];
  if (mods.length) {
    for (const m of mods) {
      const spec = MODS[m]; if (!spec) continue;
      if (typeof spec.multAll === "number") factorAll *= (1 + spec.multAll);
      if (spec.multPer) for (const k of Object.keys(spec.multPer)) factorPer[k] *= (1 + Number(spec.multPer[k]||0));
      if (spec.addPer)  for (const k of Object.keys(spec.addPer))  addPer[k]   += Number(spec.addPer[k]||0);
      if (typeof spec.defense === "number") defense += Number(spec.defense || 0);

      if (m === "Hidden Resources") {
        const pick = stablePickResourceForHiddenResources(dr.id || dr.uuid || "");
        addPer[pick] += 1;
      }
    }
  }

  const eff = {};
  for (const k of Object.keys(sized)) eff[k] = Number(sized[k]) * factorAll * factorPer[k];
  for (const k of Object.keys(addPer)) eff[k] = Number(eff[k]) + Number(addPer[k] || 0);

  const sephKey = await resolveSephirotKeyFromFlags(f);
  const se = SEPHIROT[sephKey];
  if (se && se.addPer) {
    if (typeof se.addPer.all === "number") {
      for (const k of ["food","materials","trade","military","knowledge"]) {
        eff[k] = Number(eff[k] ?? 0) + Number(se.addPer.all || 0);
      }
    }
    for (const [k, v] of Object.entries(se.addPer)) {
      if (k === "all") continue;
      eff[k] = Number(eff[k] ?? 0) + Number(v || 0);
    }
  }
  if (se && typeof se.defense === "number") defense += Number(se.defense || 0);

  // Integration efficiency multiplier
  const { mult: integMult } = integrationMultFromFlags(f.integration ?? {});
  if (integMult !== 1) {
    for (const k of Object.keys(eff)) {
      eff[k] = Number(eff[k] ?? 0) * integMult;
    }
  }

  for (const k of Object.keys(eff)) eff[k] = Math.round(eff[k]);

  let technology = Number(eff.knowledge || 0);
  if ((f.type ?? "") === "research") technology += 2;

  return { ...eff, technology, defenseBonus: defense };
}

/* ===================================================================
   COLLECT EFFECTIVE HEXES FOR A FACTION
   =================================================================== */

async function _collectTerritoryForScope(faction, scope /* "scene" | "all" */) {
  const res = zRes();
  let count = 0;
  const names = [];
  let defense = 0;

  const scenes = scope === "all" ? (game.scenes?.contents ?? []) : [canvas?.scene].filter(Boolean);
  for (const sc of scenes) {
    for (const d of sc.drawings?.contents ?? []) {
      const tf = d.flags?.[TER_MOD] ?? {};
      const isHex = (tf.isHex === true) || (tf.kind === "territory-hex") ||
        (d.shape?.type === "p" && Array.isArray(d.shape?.points) && d.shape.points.length === 12);
      if (!isHex) continue;
      if (!_ownedByFaction(d, faction)) continue;

      count++;
      names.push(tf.name || d.text || `Hex #${count}`);
      const eff = await effHexWithAll(d);
      defense += Number(eff.defenseBonus || 0);
      addRes(res, eff);
    }
  }

  if (count === 0) return null;
  return { count, resources: res, names, defenseTotal: defense };

// Expose for console-based testing
if (globalThis && !globalThis._collectTerritoryForScope) {
  globalThis._collectTerritoryForScope = _collectTerritoryForScope;
}
}

/* ---------- Roster / OPs ---------- */
function _normalizeOps(obj = {}) {
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
function _characterBelongsToFaction(char, faction) {
  const byId = char.getFlag?.(MODULE_ID, "factionId");
  if (byId) return byId === faction.id;
  const byName = char.getFlag?.(MODULE_ID, "factionName");
  if (byName) return String(byName).trim() === String(faction.name).trim();
  return false;
}

/* ---------- Commit Turn helpers (resources) ---------- */
function _zeros() {
  return { food:0, materials:0, trade:0, military:0, knowledge:0, technology:0, defense:0 };
}
function _isZeroBank(b) {
  const z = _zeros();
  const src = b || {};
  return Object.keys(z).every(k => Number(src[k] || 0) === 0);
}
async function _migrateWarLogToWarLogs(actor) {
  try {
    const legacy = actor.getFlag(MODULE_ID, "warLog");
    const hasLegacy = Array.isArray(legacy) && legacy.length;
    if (!hasLegacy) return;
    const cur = actor.getFlag(MODULE_ID, "warLogs");
    const arr = Array.isArray(cur) ? cur.slice() : [];
    for (const e of legacy) arr.push(e);
    await actor.update({ [`flags.${MODULE_ID}.warLogs`]: arr, [`flags.${MODULE_ID}.warLog`]: null });
    log(`Migrated ${legacy.length} legacy warLog entries → warLogs for`, actor.name);
  } catch (e) { warn("migrate warLog->warLogs", e); }
}
async function commitTurnBank(actor) {
  await _migrateWarLogToWarLogs(actor);

  const flags = foundry.utils.duplicate(actor.flags?.[MODULE_ID] ?? {});
  const bank  = flags.turnBank ?? _zeros();
  if (_isZeroBank(bank)) {
    ui.notifications?.warn?.("Nothing to commit — Turn Bank is empty.");
    return false;
  }

  const stock = flags.stockpile ?? _zeros();
  const committed = { ..._zeros() };
  for (const k of Object.keys(stock)) {
    stock[k]      = Number(stock[k] || 0) + Number(bank[k] || 0);
    committed[k]  = Number(bank[k] || 0);
  }

  const cleared = _zeros();
  const warLogs = Array.isArray(flags.warLogs) ? flags.warLogs : [];
  warLogs.push({
    ts: Date.now(),
    type: "commit",
    committed,
    summary: "Committed Turn Bank to stockpile."
  });

  await actor.update({
    [`flags.${MODULE_ID}.stockpile`]: stock,
    [`flags.${MODULE_ID}.turnBank`]: cleared,
    [`flags.${MODULE_ID}.warLogs`]: warLogs
  });

  ui.notifications?.info?.(`Committed turn for ${actor.name}.`);
  ChatMessage.create({
    content: `<p><strong>${foundry.utils.escapeHTML(actor.name)}</strong> committed the Strategic Turn.</p>
              <p>Moved to <em>Stockpile</em>:
              Food ${committed.food}, Materials ${committed.materials}, Trade ${committed.trade},
              Military ${committed.military}, Knowledge ${committed.knowledge}, Technology ${committed.technology}, Defense ${committed.defense}</p>`,
    speaker: { alias: "BBTTCC — Factions" },
    whisper: game.users.filter(u => u.isGM).map(u => u.id)
  });

  return true;
}

/* --------- format helpers for header strips --------- */
function fmtResLine(obj = {}) {
  const n = (v)=>Number(v||0);
  return `F ${n(obj.food)} • M ${n(obj.materials)} • T ${n(obj.trade)} • Mil ${n(obj.military)} • K ${n(obj.knowledge)} • Tech ${n(obj.technology)} • Def ${n(obj.defense)}`;
}
function _zerosOP() {
  return { violence:0, nonlethal:0, intrigue:0, economy:0, softpower:0, diplomacy:0, logistics:0, culture:0, faith:0 };
}
function fmtOPRow(op = {}) {
  const n = (k)=>Number(op?.[k]||0);
  return `
    <table class="bbttcc-table" style="width:auto;">
      <thead>
        <tr>
          <th>Viol</th><th>NonL</th><th>Intr</th><th>Econ</th><th>Soft</th><th>Dip</th><th>Log</th><th>Cult</th><th>Faith</th>
        </tr>
      </thead>
      <tbody>
        <tr class="center">
          <td><b>${n("violence")}</b></td>
          <td>${n("nonlethal")}</td>
          <td><b>${n("intrigue")}</b></td>
          <td>${n("economy")}</td>
          <td>${n("softpower")}</td>
          <td>${n("diplomacy")}</td>
          <td>${n("logistics")}</td>
          <td>${n("culture")}</td>
          <td>${n("faith")}</td>
        </tr>
      </tbody>
    </table>`;
}

/* ---------- NEW: Raid Plan helpers ---------- */
const RP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
const RP_LABEL = {
  violence:"Viol", nonlethal:"NonL", intrigue:"Intr", economy:"Econ",
  softpower:"Soft", diplomacy:"Dip", logistics:"Log", culture:"Cult", faith:"Faith"
};
function _raidPlanFromFlags(actor) {
  const rp = foundry.utils.duplicate(actor.getFlag(MODULE_ID, "raidPlan") || {});
  for (const k of RP_KEYS) if (typeof rp[k] !== "number") rp[k] = 0;
  return rp;
}
async function _saveRaidPlanKey(actor, key, value) {
  value = clamp0(Number(value||0));
  await actor.update({ [`flags.${MODULE_ID}.raidPlan.${key}`]: value }, { render: false });
  return value;
}

/* ---------------- Sheet ---------------- */
class BBTTCCFactionSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "bbttcc-faction-sheet",
      classes: ["bbttcc", "sheet", "actor"],
      template: `modules/${MODULE_ID}/templates/faction-sheet.hbs`,
      width: 1000,
      height: "auto",
      scrollY: [".bbttcc-faction-body"],
      submitOnChange: true,
      closeOnSubmit: false
    });
  }

  async _canUserView(u) { return (await super._canUserView(u)) && isFactionActor(this.actor); }

  _collectRosterAndContribs() {
    const roster = [];
    const totals = { violence:0, nonlethal:0, intrigue:0, economy:0, softpower:0, diplomacy:0, logistics:0, culture:0, faith:0 };

    for (const a of game.actors.contents) {
      if (!isCharacter(a)) continue;
      if (!_characterBelongsToFaction(a, this.actor)) continue;

      let contrib = _normalizeOps(a.getFlag?.(MODULE_ID, "opContribution") || {});
      if (Object.values(contrib).every(v => v === 0)) {
        const calc = a?.flags?.["bbttcc-character-options"]?.calculatedOPs || {};
        contrib = _normalizeOps(calc);
      }
      for (const k in totals) totals[k] += Number(contrib[k] || 0);

      roster.push({
        id: a.id, name: a.name, img: a.img,
        total: Object.values(contrib).reduce((s,v)=>s+(Number(v)||0),0),
        ...contrib
      });
    }

    const sumTotal = Object.values(totals).reduce((s,v)=>s+(Number(v)||0), 0);
    return { roster, totals, sumTotal };
  }

  async getData(opts) {
    const d = await super.getData(opts);

    const opsFlags = foundry.utils.duplicate(this.actor.getFlag(MODULE_ID, "ops") || {});
    const maxOPs   = Number(this.actor.getFlag(MODULE_ID, "maxOPs") ?? 0);

    const { roster, totals: contribTotals, sumTotal: contribGrand } = this._collectRosterAndContribs();
    const KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
    const rows = KEYS.map(key => {
      const value = Number(opsFlags[key]?.value ?? 0);
      const contrib = Number(contribTotals[key] ?? 0);
      return { key, label:key.charAt(0).toUpperCase() + key.slice(1), value, contrib, total:value+contrib };
    });

    const total = rows.reduce((s,r)=>s + (Number.isFinite(r.total) ? r.total : 0), 0);
    const powerKey   = computePowerKey(total);
    const powerLevelLabel  = game.i18n?.localize?.(`BBTTCC.PowerLevels.${powerKey}`) || powerKey;

    const territoryThisScene = await _collectTerritoryForScope(this.actor, "scene");
    const territoryTotals    = await _collectTerritoryForScope(this.actor, "all");

    const warLogs = Array.isArray(this.actor.getFlag(MODULE_ID, "warLogs")) ? this.actor.getFlag(MODULE_ID, "warLogs") : [];

    const turnBank  = this.actor.getFlag(MODULE_ID, "turnBank")  || _zeros();
    const stockpile = this.actor.getFlag(MODULE_ID, "stockpile") || _zeros();
    const opBank    = this.actor.getFlag(MODULE_ID, "opBank")    || _zerosOP();

    const raidPlan  = _raidPlanFromFlags(this.actor);

    return {
      ...d,
      fx: {
        ops: rows,
        maxOPs,
        totalOPs: total,
        powerKey,
        powerLevelLabel,
        roster,
        rosterTotals: contribTotals,
        rosterGrandTotal: contribGrand,
        territoryThisScene,
        territoryTotals,
        warLogs,
        bank: turnBank,
        stockpile,
        opBank,
        raidPlan
      }
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const host = html?.[0] instanceof HTMLElement ? html[0] : (html instanceof HTMLElement ? html : this.element);

    if (html?.find) {
      html.find("[data-op-inc]")?.on?.("click", async ev => { ev.preventDefault(); const key = ev.currentTarget.dataset.opInc; await this._bump(key, +1); });
      html.find("[data-op-dec]")?.on?.("click", async ev => { ev.preventDefault(); const key = ev.currentTarget.dataset.opDec; await this._bump(key, -1); });
    }
    try { this._bindRollButtons(host); } catch (e) { warn("bind rolls", e); }

    (host ?? document).querySelectorAll?.("[data-open-actor]")?.forEach(btn => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        const id = btn.getAttribute("data-open-actor");
        game.actors.get(id)?.sheet?.render(true, { focus: true });
      });
    });

    try {
      const headerRows = host.querySelectorAll(".sheet-header .flexrow");
      const targetRow = headerRows?.[1] || host.querySelector(".sheet-header");
      if (!targetRow) return;

      let ctrls = targetRow.querySelector("#bbttcc-faction-ctrls");
      if (!ctrls) {
        ctrls = document.createElement("div");
        ctrls.id = "bbttcc-faction-ctrls";
        ctrls.className = "flex0";
        ctrls.style.display = "flex";
        ctrls.style.flexWrap = "wrap";
        ctrls.style.gap = "6px";
        targetRow.prepend(ctrls);
      }
      ctrls.replaceChildren();

      const mkBtn = (label, title, dataset) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn";
        b.textContent = label;
        b.title = title || "";
        b.style.padding = "4px 8px";
        b.style.borderRadius = "6px";
        b.style.border = "1px solid rgba(255,255,255,0.18)";
        b.style.background = "rgba(255,255,255,0.06)";
        b.style.cursor = "pointer";
        Object.entries(dataset || {}).forEach(([k,v]) => b.dataset[k] = v);
        return b;
      };

      ctrls.appendChild(mkBtn("Advance Turn (Dry)", "Preview per-turn resource yield", { act:"turn", apply:"0" }));
      ctrls.appendChild(mkBtn("Advance Turn (Apply)", "Deposit per-turn resources into Turn Bank", { act:"turn", apply:"1" }));
      ctrls.appendChild(mkBtn("Advance OP (Dry)", "Preview OP regeneration from resources", { act:"op", apply:"0" }));
      ctrls.appendChild(mkBtn("Advance OP (Apply)", "Deposit OPs into OP Bank", { act:"op", apply:"1" }));
      ctrls.appendChild(mkBtn("Commit Turn", "Move Turn Bank to Stockpile", { act:"commit" }));
      // NEW: Ritual button
      ctrls.appendChild(mkBtn("Ritual", "Open Final Ritual Console", { act:"ritual" }));

      ctrls.addEventListener("click", async (ev) => {
        const btn = ev.target.closest("button"); if (!btn) return;
        const act = btn.dataset.act;
        try {
          if (act === "ritual") {
            const tApi = game.bbttcc?.api?.tikkun;
            if (!tApi || typeof tApi.openRitualConsole !== "function") {
              ui.notifications?.warn?.("Final Ritual console unavailable.");
              return;
            }
            tApi.openRitualConsole({ factionId: this.actor.id });
            return;
          }

          if (act === "commit") {
            await commitTurnBank(this.actor);
            return;
          }
          const api = game.bbttcc?.api?.territory;
          if (!api) return ui.notifications?.error?.("BBTTCC Territory API not available.");
          const apply = btn.dataset.apply === "1";

          if (act === "turn") {
            await api.advanceTurn({ apply, factionId: this.actor.id });
            ui.notifications?.info?.(`Advance Turn (${apply ? "Apply" : "Dry"}) complete.`);
          } else if (act === "op") {
            await api.advanceOPRegen({ apply, factionId: this.actor.id });
            ui.notifications?.info?.(`Advance OP (${apply ? "Apply" : "Dry"}) complete.`);
          }
        } catch (e) {
          console.error(e);
          ui.notifications?.error?.("Action failed (see console).");
        }
      });

      let strips = targetRow.querySelector("#bbttcc-faction-strips");
      if (!strips) {
        strips = document.createElement("div");
        strips.id = "bbttcc-faction-strips";
        strips.className = "flex1";
        strips.style.display = "flex";
        strips.style.flexDirection = "column";
        strips.style.gap = "2px";
        targetRow.insertBefore(strips, targetRow.firstElementChild?.nextSibling || null);
      }
      strips.replaceChildren();

      const mkLine = (label, obj) => {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.gap = "8px";
        const left = document.createElement("strong");
        left.textContent = label + ":";
        const right = document.createElement("span");
        right.textContent = fmtResLine(obj);
        row.append(left, right);
        return row;
      };

      strips.appendChild(mkLine("Bank", this.actor.getFlag(MODULE_ID,"turnBank")  || _zeros()));
      strips.appendChild(mkLine("Stockpile", this.actor.getFlag(MODULE_ID,"stockpile") || _zeros()));

      let opbar = targetRow.querySelector("#bbttcc-opbank-strip");
      if (!opbar) {
        opbar = document.createElement("div");
        opbar.id = "bbttcc-opbank-strip";
        opbar.className = "flex0";
        opbar.style.marginLeft = ".75rem";
        opbar.style.display = "flex";
        opbar.style.flexDirection = "column";
        opbar.style.alignItems = "flex-end";
        opbar.style.gap = ".25rem";
        targetRow.appendChild(opbar);
      }
      opbar.replaceChildren();
      const opTitle = document.createElement("div");
      opTitle.style.fontSize = "12px"; opTitle.style.fontWeight = "600"; opTitle.textContent = "OP Bank";
      const opTblWrap = document.createElement("div");
      opTblWrap.innerHTML = fmtOPRow(this.actor.getFlag(MODULE_ID,"opBank") || _zerosOP());
      opbar.appendChild(opTitle);
      opbar.appendChild(opTblWrap.firstElementChild);

      let rpanel = targetRow.querySelector("#bbttcc-raidplan-strip");
      if (!rpanel) {
        rpanel = document.createElement("div");
        rpanel.id = "bbttcc-raidplan-strip";
        rpanel.className = "flex0";
        rpanel.style.marginLeft = ".75rem";
        rpanel.style.display = "flex";
        rpanel.style.flexDirection = "column";
        rpanel.style.alignItems = "flex-end";
        rpanel.style.gap = ".25rem";
        rpanel.style.overflow = "visible";
        targetRow.appendChild(rpanel);
      }
      const plan = _raidPlanFromFlags(this.actor);

      rpanel.replaceChildren();
      const rtitle = document.createElement("div");
      rtitle.style.fontSize = "12px"; rtitle.style.fontWeight = "600";
      rtitle.textContent = "Raid Plan (Player Staging)";
      rpanel.appendChild(rtitle);

      const tbl = document.createElement("table");
      tbl.className = "bbttcc-table";
      tbl.style.width = "auto";
      tbl.style.background = "rgba(0,0,0,0.12)";
      tbl.style.border = "1px solid rgba(255,255,255,0.08)";
      tbl.style.borderRadius = "6px";

      const thead = document.createElement("thead");
      const trh = document.createElement("tr");
      for (const k of RP_KEYS) {
        const th = document.createElement("th"); th.textContent = RP_LABEL[k]; th.style.padding = "2px 6px";
        trh.appendChild(th);
      }
      thead.appendChild(trh); tbl.appendChild(thead);

      const tbody = document.createElement("tbody");

      const trv = document.createElement("tr"); trv.className = "center";
      for (const k of RP_KEYS) {
        const td = document.createElement("td");
        td.style.padding = "4px 6px";
        td.innerHTML = `<b data-rp-val="${k}">${Number(plan[k]||0)}</b>`;
        trv.appendChild(td);
      }
      tbody.appendChild(trv);

      const tra = document.createElement("tr"); tra.className = "center";
      for (const k of RP_KEYS) {
        const td = document.createElement("td");
        td.style.padding = "2px 4px";
        td.style.whiteSpace = "nowrap";
        td.style.display = "flex";
        td.style.alignItems = "center";
        td.style.justifyContent = "center";
        td.style.gap = "4px";
        td.style.minHeight = "26px";

        const mkPlanBtn = (txt, ds, act="rp") => {
          const b = document.createElement("button");
          b.type = "button"; b.className = "btn";
          b.textContent = txt; b.dataset.delta = String(ds);
          b.dataset.key = k; b.dataset.act = act;
          b.style.minWidth = "24px"; b.style.height = "22px";
          b.style.lineHeight = "20px"; b.style.padding = "0 6px";
          b.style.margin = "0";
          b.style.border = "1px solid rgba(255,255,255,0.18)";
          b.style.borderRadius = "6px";
          b.style.background = "rgba(255,255,255,0.06)";
          return b;
        };

        td.appendChild(mkPlanBtn("−1", -1));
        td.appendChild(mkPlanBtn("+1", +1));
        td.appendChild(mkPlanBtn("−5", -5));
        td.appendChild(mkPlanBtn("+5", +5));
        td.appendChild(mkPlanBtn("R", "reset", "rp-reset"));

        tra.appendChild(td);
      }
      tbody.appendChild(tra);
      tbl.appendChild(tbody);
      rpanel.appendChild(tbl);

      rpanel.addEventListener("click", async (ev) => {
        const btn = ev.target.closest?.("button"); if (!btn) return;
        const act = btn.dataset.act; const key = btn.dataset.key;
        if (!RP_KEYS.includes(key)) return;

        const oldVal = Number((this.actor.getFlag(MODULE_ID,"raidPlan") || {})[key] || 0);
        let next = oldVal;
        if (act === "rp-reset") next = 0;
        else next = clamp0(oldVal + Number(btn.dataset.delta||0));

        await _saveRaidPlanKey(this.actor, key, next);
        const cell = rpanel.querySelector(`[data-rp-val="${key}"]`);
        if (cell) cell.textContent = String(next);
      });

    } catch (e) { warn("Header build error", e); }
  }

  _bindRollButtons(root) {
    const actor = this.actor;
    const candidates = [
      ...root.querySelectorAll("[data-op-roll]"),
      ...root.querySelectorAll("[data-roll]"),
      ...root.querySelectorAll("[data-op]"),
      ...root.querySelectorAll(".bbttcc-op-roll"),
      ...root.querySelectorAll(".op-roll")
    ];
    const seen = new Set();
    const buttons = candidates.filter(b => b instanceof HTMLElement && !seen.has(b) && seen.add(b));
    const keyFrom = (el) => (el.dataset.opRoll || el.dataset.roll || el.dataset.op || el.dataset.key || el.getAttribute("value") || el.textContent || "").trim().toLowerCase();
    const normalizeKey = (k) => /^non[-_\s]?lethal$/.test(k) ? "nonlethal" : /^soft[-_\s]?power$/.test(k) ? "softpower" : k;

    for (const btn of buttons) {
      if (btn.dataset.bbttccBound === "1") continue;
      btn.dataset.bbttccBound = "1";
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        try {
          let key = normalizeKey(keyFrom(btn));
          if (!key) return ui.notifications?.warn?.("No OP key to roll.");

          const opsFlags = foundry.utils.duplicate(actor.getFlag(MODULE_ID, "ops") || {});
          const base = Number(opsFlags?.[key]?.value ?? 0);
          const contrib = Number((this._collectRosterAndContribs()?.totals?.[key]) ?? 0);

          const roll = new Roll("1d20 + @b", { b: base + contrib });
          await roll.evaluate({ async: true });

          const label = key.charAt(0).toUpperCase() + key.slice(1);
          roll.toMessage({
            speaker: { alias: actor.name },
            flavor: `<strong>${actor.name}</strong> — ${label} Check<br/><small>Bonus = Value (${base}) + Roster (${contrib})</small>`
          });
        } catch (e) { console.error(`[${MODULE_ID}] roll failed`, e); ui.notifications?.error?.("Roll failed (see console)."); }
      });
    }
  }

  async _bump(key, delta) {
    if (!key) return;
    const ops = foundry.utils.duplicate(this.actor.getFlag(MODULE_ID, "ops") || {});
    const row = ops[key] || { value: 0 };
    row.value = clamp0((row.value ?? 0) + delta);
    ops[key] = row;
    await this.actor.setFlag(MODULE_ID, "ops", ops);
    this.render(false);
  }
}

/* ---------------- registration / enforcement ---------------- */
Hooks.once("init", () => {
  try {
    foundry.applications.apps.DocumentSheetConfig.registerSheet(
      Actor, MODULE_ID, BBTTCCFactionSheet,
      { types: ["npc"], makeDefault: false, label: "BBTTCC Faction" }
    );
    log("Faction sheet registered", SHEET_ID);
  } catch (e) { warn("registerSheet failed", e); }
});

Hooks.once("ready", async () => {
  for (const a of listFactionActors()) {
    try {
      await ensureFactionHints(a);
      const cur = a.getFlag("core","sheetClass") || foundry.utils.getProperty(a,"flags.core.sheetClass");
      if (isFactionActor(a) && cur !== SHEET_ID) await a.update({ "flags.core.sheetClass": SHEET_ID });
    } catch (e) { warn("ready assignment", e); }
  }
  log("ready — faction sheet assignment pass complete");
});

Hooks.on("createActor", ensureFactionHints);
Hooks.on("updateActor", async (actor, data) => {
  try {
    const touchedFlag = foundry.utils.hasProperty(data, "flags.bbttcc-factions.isFaction");
    const touchedType = foundry.utils.hasProperty(data, "system.details.type.value");
    if (touchedFlag || touchedType) {
      await ensureFactionHints(actor);
      const cur = actor.getFlag("core","sheetClass") || foundry.utils.getProperty(actor,"flags.core.sheetClass");
      if (isFactionActor(actor) && cur !== SHEET_ID) await actor.update({ "flags.core.sheetClass": SHEET_ID });
    }
  } catch (e) { warn("updateActor hook", e); }
});

/* modules/bbttcc-factions/scripts/module.js */
const MODULE_ID = "bbttcc-factions";
const TER_MOD   = "bbttcc-territory";
const SHEET_ID  = `${MODULE_ID}.BBTTCCFactionSheet`;

const log  = (...a) => console.log(`[${MODULE_ID}]`, ...a);
const warn = (...a) => console.warn(`[${MODULE_ID}]`, ...a);

/* ---------------- utils ---------------- */
function isFactionActor(a) {
  if (!a) return false;
  try {
    if (a.getFlag?.(MODULE_ID, "isFaction") === true) return true;
    const t = String(foundry.utils.getProperty(a, "system.details.type.value") ?? "").toLowerCase();
    return t === "faction";
  } catch { return false; }
}
function isCharacter(a) { return String(a?.type ?? "").toLowerCase() === "character"; }
const clamp0 = (v) => Math.max(0, Number(v ?? 0) || 0);

async function ensureFactionHints(a) {
  try {
    if (isFactionActor(a) && a.getFlag(MODULE_ID, "isFaction") !== true) await a.setFlag(MODULE_ID, "isFaction", true);
    if (a.system?.details?.type?.value !== "faction") await a.update({ "system.details.type.value": "faction" });
  } catch (e) { warn("ensureFactionHints failed", e); }
}
function listFactionActors() { return game.actors.contents.filter(isFactionActor); }

/* ---------------- Power bands (expanded) ---------------- */
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
   EFFECTIVE HEX CALC — IDENTICAL to Campaign Overview implementation
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
    default: break;
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

/** Apply size + modifiers + sephirot; return effective outputs & side-effects. */
async function effHexWithAll(dr) {
  const f = dr.flags?.[TER_MOD] ?? {};

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
  let defense = sizeDefense;

  if (Array.isArray(f.modifiers)) {
    for (const m of f.modifiers) {
      const spec = MODS[m]; if (!spec) continue;
      if (typeof spec.multAll === "number") factorAll *= (1 + spec.multAll);
      if (spec.multPer) for (const k of Object.keys(spec.multPer)) factorPer[k] *= (1 + Number(spec.multPer[k]||0));
      if (spec.addPer)  for (const k of Object.keys(spec.addPer))  addPer[k]   += Number(spec.addPer[k]||0);

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
  if (se && se.addPer) {
    if (se.addPer.all) for (const k of ["food","materials","trade","military","knowledge"]) eff[k] = Number(eff[k]) + Number(se.addPer.all);
    for (const k of Object.keys(se.addPer)) if (k !== "all") eff[k] = Number(eff[k]) + Number(se.addPer[k] || 0);
  }

  // Round per resource
  for (const k of Object.keys(eff)) eff[k] = Math.round(eff[k]);

  // Technology after everything else
  let technology = Number(eff.knowledge || 0);
  if ((f.type ?? "") === "research") technology += 2;

  return { ...eff, technology, defenseBonus: Number(isFinite(eff.defenseBonus)?eff.defenseBonus:0) };
}

/* ---------- Territory collectors ---------- */
function _ownedByFaction(d, faction) {
  const f = d.flags?.[TER_MOD] ?? {};
  const ownerId = f.factionId ?? f.ownerId;
  const ownerName = f.faction ?? f.ownerName;
  return (ownerId && ownerId === faction.id) ||
         (!!ownerName && String(ownerName).trim() === String(faction.name).trim());
}

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
}

/* ============== Roster / OPs (unchanged) ============== */
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
  const legacyName = char?.flags?.[TER_MOD]?.faction;
  if (!legacyName) return false;
  return String(legacyName).trim() === String(faction.name).trim();
}

/* ---------------- Commit Turn helpers ---------------- */
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

/* --------- tiny formatter for header strip --------- */
function fmtResLine(obj = {}) {
  const n = (v)=>Number(v||0);
  return `F ${n(obj.food)} • M ${n(obj.materials)} • T ${n(obj.trade)} • Mil ${n(obj.military)} • K ${n(obj.knowledge)} • Tech ${n(obj.technology)} • Def ${n(obj.defense)}`;
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

    const sumTotal = Object.values(totals).reduce((s,v)=>s+(Number(v)||0),0);
    return { roster, totals, sumTotal };
  }

  async getData(opts) {
    const d = await super.getData(opts);

    const opsFlags = foundry.utils.duplicate(this.actor.getFlag(MODULE_ID, "ops") || {});
    const maxOPs   = Number(this.actor.getFlag(MODULE_ID, "maxOPs") ?? 0);

    const { roster, totals: contribTotals, sumTotal: contribGrand } = this._collectRosterAndContribs();
    const KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
    const rows = KEYS.map(k => {
      const value = Number(opsFlags[k]?.value ?? 0);
      const contrib = Number(contribTotals[k] ?? 0);
      return { key:k, label:k.charAt(0).toUpperCase() + k.slice(1), value, contrib, total:value+contrib };
    });

    const total = rows.reduce((s,r)=>s + (Number.isFinite(r.total) ? r.total : 0), 0);
    const powerKey   = computePowerKey(total);
    const powerLevelLabel  = game.i18n?.localize?.(`BBTTCC.PowerLevels.${powerKey}`) || powerKey;

    // Territory — scene & all (effective math)
    const territoryThisScene = await _collectTerritoryForScope(this.actor, "scene");
    const territoryTotals    = await _collectTerritoryForScope(this.actor, "all");

    const warLogs = Array.isArray(this.actor.getFlag(MODULE_ID, "warLogs")) ? this.actor.getFlag(MODULE_ID, "warLogs") : [];

    // NEW: expose bank + stockpile values for optional uses (even though we inject header via JS)
    const turnBank  = this.actor.getFlag(MODULE_ID, "turnBank")  || _zeros();
    const stockpile = this.actor.getFlag(MODULE_ID, "stockpile") || _zeros();

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
        // for completeness
        bank: turnBank,
        stockpile
      }
    };
  }

  /* ---------- ROLL BINDING + targeted nuke of the legacy top card ---------- */
  activateListeners(html) {
    super.activateListeners(html);
    const host = html?.[0] instanceof HTMLElement ? html[0] : (html instanceof HTMLElement ? html : this.element);

    const nukeLegacy = (scope) => {
      try {
        const fieldsets = [...(scope.querySelectorAll?.("fieldset") ?? [])];
        for (const fs of fieldsets) {
          const legendTxt = (fs.querySelector("legend")?.textContent || "").trim().toLowerCase();
          const hasDetailsRel = !![...fs.querySelectorAll("summary,details")].find(el => (el.textContent || "").toLowerCase().includes("relationships"));
          const hasOldHint = (fs.textContent || "").toLowerCase().includes("totals reflect all owned bbttcc hexes");
          const hasOldButtons = !!(fs.querySelector("[data-bbttcc-open-rel]") || fs.querySelector("[data-bbttcc-recalc]"));

          if (hasDetailsRel || hasOldHint || (legendTxt.includes("bbttcc — territory roll-up") && (hasOldButtons || hasDetailsRel))) {
            fs.remove();
          }
        }
      } catch (e) { /* ignore */ }
    };

    // Immediate pass
    nukeLegacy(host);

    // Watch for late injections
    try {
      if (this._legacyObs) this._legacyObs.disconnect();
      this._legacyObs = new MutationObserver(muts => {
        for (const m of muts) {
          for (const n of m.addedNodes) {
            if (n instanceof HTMLElement) nukeLegacy(n);
          }
        }
      });
      this._legacyObs.observe(host, { childList: true, subtree: true });
    } catch (e) { warn("observer", e); }

    // Usual listeners
    if (html?.find) {
      html.find("[data-op-inc]")?.on?.("click", async ev => {
        ev.preventDefault(); const key = ev.currentTarget.dataset.opInc; await this._bump(key, +1);
      });
      html.find("[data-op-dec]")?.on?.("click", async ev => {
        ev.preventDefault(); const key = ev.currentTarget.dataset.opDec; await this._bump(key, -1);
      });
    }
    try { this._bindRollButtons(host); } catch (e) { warn("bind rolls", e); }

    (host ?? document).querySelectorAll?.("[data-open-actor]")?.forEach(btn => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        const id = btn.getAttribute("data-open-actor");
        game.actors.get(id)?.sheet?.render(true, { focus: true });
      });
    });

    /* ---------- Insert Commit Turn button (header, right side) ---------- */
    try {
      const headerRows = host.querySelectorAll(".sheet-header .flexrow");
      const targetRow = headerRows?.[1] || host.querySelector(".sheet-header");
      if (targetRow && !targetRow.querySelector?.("[data-bbttcc-commit-turn]")) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("data-bbttcc-commit-turn", "1");
        btn.className = "bbttcc-btn";
        btn.style.marginLeft = ".5rem";
        btn.title = "Commit the current Turn Bank into Stockpile and log it";
        btn.innerHTML = `<i class="fas fa-check-circle"></i> Commit Turn`;
        targetRow.appendChild(btn);

        btn.addEventListener("click", async (ev) => {
          ev.preventDefault();
          const ok = await Dialog.confirm({
            title: "Commit Strategic Turn?",
            content: `<p>This will move all resources/technology/defense from <strong>Turn Bank</strong> into <strong>Stockpile</strong>, then reset Turn Bank to 0 and append a log entry.</p>`,
            yes: () => true, no: () => false, defaultYes: true
          });
          if (!ok) return;
          try {
            const done = await commitTurnBank(this.actor);
            if (done) this.render(false);
          } catch (e) {
            console.error(`[${MODULE_ID}] commitTurn error`, e);
            ui.notifications?.error?.("Commit Turn failed (see console).");
          }
        });
      }
    } catch (e) { warn("Commit Turn button insert", e); }

    /* ---------- NEW: Turn Bank / Stockpile readout strip ---------- */
    try {
      const bank  = this.actor.getFlag(MODULE_ID, "turnBank")  || _zeros();
      const stock = this.actor.getFlag(MODULE_ID, "stockpile") || _zeros();

      const headerRows = host.querySelectorAll(".sheet-header .flexrow");
      const targetRow = headerRows?.[1] || host.querySelector(".sheet-header");
      if (!targetRow) return;

      // container (idempotent)
      let bar = targetRow.querySelector("#bbttcc-bank-strip");
      if (!bar) {
        bar = document.createElement("div");
        bar.id = "bbttcc-bank-strip";
        bar.className = "flex0";
        bar.style.display = "flex";
        bar.style.flexDirection = "column";
        bar.style.alignItems = "flex-end";
        bar.style.gap = ".2rem";
        bar.style.marginLeft = ".75rem";
        targetRow.appendChild(bar);
      }

      const mkRow = (label, text) => {
        const row = document.createElement("div");
        row.className = "bbttcc-bank-row";
        row.style.fontSize = "12px";
        row.style.whiteSpace = "nowrap";
        row.innerHTML = `<strong>${label}:</strong> <span>${foundry.utils.escapeHTML(text)}</span>`;
        return row;
      };

      bar.replaceChildren(
        mkRow("Bank",      fmtResLine(bank)),
        mkRow("Stockpile", fmtResLine(stock))
      );
    } catch (e) { warn("Bank/Stockpile strip", e); }
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
          const { totals: contribTotals } = this._collectRosterAndContribs();
          const contrib = Number(contribTotals?.[key] ?? 0);

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
      if (cur !== SHEET_ID) await a.update({ "flags.core.sheetClass": SHEET_ID });
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

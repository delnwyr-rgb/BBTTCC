/* modules/bbttcc-territory/scripts/turn-driver.js
 * BBTTCC — Strategic Turn drivers (v13-safe)
 * - advanceTurn({apply, sceneId})       → Resources/Technology/Defense → Turn Bank (as you already use)
 * - advanceOPRegen({apply, sceneId})    → Resources→OP pipeline → Faction OP Bank (dual-layer economy)
 *
 * Notes:
 * • OP pipeline uses the deterministic mapping from the Gap Analysis (Food/Materials/Trade/Military/Knowledge → 9 OP buckets),
 *   then applies size/status/modifiers/alignment at the hex layer, floors totals, and persists per-hex fractional remainders.  :contentReference[oaicite:2]{index=2}
 * • OPs are deposited to flags["bbttcc-factions"].opBank (same store the Raid Console reads & spends).                   :contentReference[oaicite:3]{index=3} :contentReference[oaicite:4]{index=4}
 */

const TERR_MOD = "bbttcc-territory";
const FCT_MOD  = "bbttcc-factions";
const TAG      = "[bbttcc-territory/turn-driver]";

const log  = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

/* ------------------------------------------------------------------
   Shared: faction helpers
------------------------------------------------------------------- */
function isFactionActor(a) {
  if (!a) return false;
  try {
    if (a.getFlag?.(FCT_MOD, "isFaction") === true) return true;
    const t = (foundry.utils.getProperty(a, "system.details.type.value") ?? "").toString().toLowerCase();
    if (t === "faction") return true;
    const cls = a.getFlag?.("core","sheetClass") ?? a?.flags?.core?.sheetClass;
    return String(cls||"").includes("BBTTCCFactionSheet");
  } catch { return false; }
}
function listFactions() { return (game.actors?.contents ?? []).filter(isFactionActor); }

/* ------------------------------------------------------------------
   Effective hex math (same kernels you’re using elsewhere)
   (We bring in the same tables so math is consistent across apps.)   :contentReference[oaicite:5]{index=5}
------------------------------------------------------------------- */
const SIZE_TABLE = {
  outpost:{ mult:0.50, defense:0 },
  village:{ mult:0.75, defense:1 },
  town:{ mult:1.00, defense:1 },
  city:{ mult:1.50, defense:2 },
  metropolis:{ mult:2.00, defense:3 },
  megalopolis:{ mult:3.00, defense:4 }
};
const SIZE_ALIAS = { small:"outpost", standard:"town", large:"metropolis" };

const MODS = {
  "Well-Maintained": { multAll:+0.25, defense:+1, loyalty:+1 },
  "Fortified": { defense:+3 },
  "Strategic Position": { multAll:+0.10 },
  "Hidden Resources": {},
  "Loyal Population": { multAll:+0.15, loyalty:+2 },
  "Trade Hub": { multPer:{ trade:+0.50 }, diplomacy:+2 },
  "Contaminated": { multAll:-0.50, flags:{ radiation:true } },
  "Damaged Infrastructure": { multAll:-0.25 },
  "Hostile Population": { multAll:-0.25, loyalty:-2 },
  "Supply Line Vulnerable": { multAll:-0.10 },
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
  }
  return base;
}

const HR_KEYS = ["food","materials","trade","military","knowledge"];
function stablePickResourceForHiddenResources(id) {
  const s = String(id || ""); let h = 0;
  for (let i=0;i<s.length;i++) h = (h + s.charCodeAt(i)) % 9973;
  return HR_KEYS[h % HR_KEYS.length];
}

/** Return effective per-turn resource pips (food/materials/trade/military/knowledge) + tech & defenseBonus. */
async function effHexWithAll(d) {
  const tf = d.flags?.[TERR_MOD] ?? {};
  const sizeKey = normalizeSizeKey(tf.size);
  const { mult, defense: sizeDefense } = SIZE_TABLE[sizeKey];

  const stored = {
    food: Number(tf.resources?.food ?? 0),
    materials: Number(tf.resources?.materials ?? 0),
    trade: Number(tf.resources?.trade ?? 0),
    military: Number(tf.resources?.military ?? 0),
    knowledge: Number(tf.resources?.knowledge ?? 0)
  };
  const auto = Object.values(stored).every(n => n === 0);
  const base = auto ? calcBaseByType(tf.type ?? "settlement") : stored;

  // multiplicative/additive via modifiers
  let factorAll = 1.0; const factorPer = { food:1, materials:1, trade:1, military:1, knowledge:1 };
  const addPer  = { food:0, materials:0, trade:0, military:0, knowledge:0 };
  let defense = sizeDefense;

  if (Array.isArray(tf.modifiers)) {
    for (const m of tf.modifiers) {
      const spec = MODS[m]; if (!spec) continue;
      if (typeof spec.multAll === "number") factorAll *= (1 + spec.multAll);
      if (spec.multPer) for (const k of Object.keys(spec.multPer)) factorPer[k] *= (1 + Number(spec.multPer[k]||0));
      if (spec.addPer)  for (const k of Object.keys(spec.addPer))  addPer[k]   += Number(spec.addPer[k]||0);
      if (typeof spec.defense === "number") defense += Number(spec.defense || 0);
      if (m === "Hidden Resources") addPer[stablePickResourceForHiddenResources(d.id || d.uuid || "")] += 1;
    }
  }

  // apply
  const sized = {}; for (const k of Object.keys(base)) sized[k] = Number(base[k]) * mult * factorAll * factorPer[k];
  for (const k of Object.keys(addPer)) sized[k] = Number(sized[k]) + Number(addPer[k]||0);

  // sephirot
  let tech = 0;
  const seKey = (tf.sephirotKey || "").toLowerCase().trim() || await (async () => {
    if (!tf.sephirotUuid) return "";
    try { const it = await fromUuid(tf.sephirotUuid); return (it?.name ?? "").toLowerCase().replace(/[^\p{L}]+/gu,""); }
    catch { return ""; }
  })();
  const se = SEPHIROT[seKey];
  if (se && se.addPer) {
    if (se.addPer.all) for (const k of Object.keys(sized)) if (k in sized) sized[k] = Number(sized[k]) + Number(se.addPer.all||0);
    for (const k of Object.keys(se.addPer)) if (k !== "all" && k in sized) sized[k] = Number(sized[k]) + Number(se.addPer[k]||0);
  }
  if (se && typeof se.defense === "number") defense += Number(se.defense||0);
  if ((tf.type ?? "") === "research") tech += 2;
  // final round
  const eff = {}; for (const k of Object.keys(sized)) eff[k] = Math.round(sized[k]);
  return { ...eff, technology: Math.round(Number(eff.knowledge||0) + tech), defenseBonus: defense };
}

/* ------------------------------------------------------------------
   Hex→OP mapping (Gap Analysis v1)
   Food:    +0.5 Economy, +0.5 Culture
   Materials:+0.75 Economy, +0.25 Logistics
   Trade:   +0.5 Economy, +0.5 Diplomacy
   Military:+0.5 Violence, +0.5 Non-Lethal
   Knowledge:+0.5 Intrigue, +0.25 Faith, +0.25 Soft Power         :contentReference[oaicite:6]{index=6}
------------------------------------------------------------------- */
const RES_TO_OP = {
  economy:   { food:0.5, materials:0.75, trade:0.5, military:0.0, knowledge:0.0 },
  violence:  { food:0.0, materials:0.0,  trade:0.0, military:0.5, knowledge:0.0 },
  nonlethal: { food:0.0, materials:0.0,  trade:0.0, military:0.5, knowledge:0.0 },
  diplomacy: { food:0.0, materials:0.0,  trade:0.5, military:0.0, knowledge:0.0 },
  softpower: { food:0.0, materials:0.0,  trade:0.0, military:0.0, knowledge:0.25 },
  intrigue:  { food:0.0, materials:0.0,  trade:0.0, military:0.0, knowledge:0.5 },
  logistics: { food:0.0, materials:0.25, trade:0.0, military:0.0, knowledge:0.0 },
  culture:   { food:0.5, materials:0.0,  trade:0.0, military:0.0, knowledge:0.0 },
  faith:     { food:0.0, materials:0.0,  trade:0.0, military:0.0, knowledge:0.25 }
};

/* Carry fractional remainders per hex between turns (on the hex) */
function _getFrac(d) {
  const f = d.getFlag(TERR_MOD, "opFrac") || {};
  return { ...{economy:0,violence:0,nonlethal:0,intrigue:0,softpower:0,diplomacy:0,logistics:0,culture:0,faith:0}, ...f };
}
async function _setFrac(d, frac) { await d.setFlag(TERR_MOD, "opFrac", frac); }

/* ------------------------------------------------------------------
   Scanner: collect all owned hexes and compute OP outputs
------------------------------------------------------------------- */
function isHexDrawing(d) {
  const tf = d.flags?.[TERR_MOD] ?? {};
  const poly = d.shape?.type === "p" && Array.isArray(d.shape?.points) && d.shape.points.length >= 10;
  return tf.isHex === true || tf.kind === "territory-hex" || poly;
}
function ownedByFaction(d, faction) {
  const tf = d.flags?.[TERR_MOD] ?? {};
  const id = tf.factionId ?? tf.ownerId;
  const nm = tf.faction ?? tf.ownerName;
  return (id && id === faction.id) || (!!nm && String(nm).trim() === String(faction.name).trim());
}

/** Compute per-faction OP regen totals (with frac carry). */
async function collectOPByFaction({ sceneId=null } = {}) {
  const scenes = sceneId ? [game.scenes.get(sceneId)].filter(Boolean) : (game.scenes?.contents ?? []);
  const out = new Map(); // factionId -> { name, ops:{...}, hexes:[], scenes:Set<string> }

  const factions = listFactions();
  const byId = new Map(factions.map(f => [f.id, f]));

  for (const sc of scenes) {
    for (const d of sc.drawings?.contents ?? []) {
      if (!isHexDrawing(d)) continue;
      const tf = d.flags?.[TERR_MOD] ?? {};
      let ownerId = tf.factionId ?? tf.ownerId; let fac = ownerId ? byId.get(ownerId) : null;
      if (!fac) {
        const nm = tf.faction ?? tf.ownerName;
        if (nm) fac = factions.find(f => String(f.name).trim() === String(nm).trim());
        if (fac) ownerId = fac.id;
      }
      if (!fac) continue;

      const eff = await effHexWithAll(d); // {food,materials,trade,military,knowledge, technology, defenseBonus}
      // Map resources → OP (floats)
      const floats = { economy:0,violence:0,nonlethal:0,intrigue:0,softpower:0,diplomacy:0,logistics:0,culture:0,faith:0 };
      for (const op of Object.keys(floats)) {
        const weights = RES_TO_OP[op] || {};
        let sum = 0;
        sum += (weights.food||0)     * Number(eff.food||0);
        sum += (weights.materials||0)* Number(eff.materials||0);
        sum += (weights.trade||0)    * Number(eff.trade||0);
        sum += (weights.military||0) * Number(eff.military||0);
        sum += (weights.knowledge||0)* Number(eff.knowledge||0);
        floats[op] = sum;
      }

      // add & carry fractional remainders per hex
      const prevFrac = _getFrac(d);
      const totalsInt = {};
      const nextFrac  = {};
      for (const op of Object.keys(floats)) {
        const acc = Number(floats[op]) + Number(prevFrac[op]||0);
        totalsInt[op] = Math.floor(acc);
        nextFrac[op]  = acc - totalsInt[op];
      }
      await _setFrac(d, nextFrac);

      // push into out map
      if (!out.has(ownerId)) out.set(ownerId, {
        factionId: ownerId,
        name: fac.name,
        ops: { economy:0,violence:0,nonlethal:0,intrigue:0,softpower:0,diplomacy:0,logistics:0,culture:0,faith:0 },
        hexes:[], scenes:new Set()
      });
      const row = out.get(ownerId);
      row.hexes.push({ id:d.id, name: tf.name || d.text || "Hex", ops: totalsInt });
      row.scenes.add(sc.name);
      for (const op of Object.keys(row.ops)) row.ops[op] += Number(totalsInt[op]||0);
    }
  }
  for (const v of out.values()) v.scenes = [...v.scenes];
  return out;
}

/* ------------------------------------------------------------------
   OP Regeneration (dry/apply)
------------------------------------------------------------------- */
async function advanceOPRegen({ apply=false, sceneId=null } = {}) {
  const byFaction = await collectOPByFaction({ sceneId });
  if (!byFaction || byFaction.size === 0) {
    ui.notifications?.warn?.("No claimed BBTTCC hexes found to regenerate OPs.");
    return { changed:false, rows:[] };
  }
  const rows = [];

  for (const data of byFaction.values()) {
    const actor = game.actors.get(data.factionId);
    if (!actor) continue;
    rows.push({ factionId:data.factionId, factionName:data.name, scenes:data.scenes, ops:data.ops });

    if (apply) {
      // deposit into opBank (not capped; this is the spend bank used by raids)  :contentReference[oaicite:7]{index=7}
      const flags = foundry.utils.duplicate(actor.flags?.[FCT_MOD] ?? {});
      const bank  = foundry.utils.duplicate(flags.opBank ?? {
        violence:0, nonlethal:0, intrigue:0, economy:0, softpower:0, diplomacy:0, logistics:0, culture:0, faith:0
      });
      for (const k of Object.keys(bank)) bank[k] = Number(bank[k]||0) + Number(data.ops[k]||0);

      const warLogs = Array.isArray(flags.warLogs) ? flags.warLogs : [];
      warLogs.push({
        ts: Date.now(),
        type: "turn-op",
        scenes: data.scenes,
        gained: { ...data.ops },
        summary: `Regenerated OPs: Viol ${bank.violence} NL ${bank.nonlethal} Intr ${bank.intrigue} Eco ${bank.economy} Soft ${bank.softpower} Dip ${bank.diplomacy} Log ${bank.logistics} Cult ${bank.culture} Faith ${bank.faith}`
      });

      await actor.update({ [`flags.${FCT_MOD}.opBank`]: bank, [`flags.${FCT_MOD}.warLogs`]: warLogs });
    }
  }

  // Chat card
  const lines = rows.map(r => {
    const o = r.ops;
    const gains = `Viol ${o.violence} • NL ${o.nonlethal} • Intr ${o.intrigue} • Eco ${o.economy} • Soft ${o.softpower} • Dip ${o.diplomacy} • Log ${o.logistics} • Cult ${o.culture} • Faith ${o.faith}`;
    const scs = r.scenes.length ? r.scenes.join(", ") : "—";
    return `<tr>
      <td style="white-space:nowrap;"><strong>${foundry.utils.escapeHTML(r.factionName)}</strong></td>
      <td>${foundry.utils.escapeHTML(scs)}</td>
      <td>${gains}</td>
    </tr>`;
  }).join("");

  const hdr = apply ? "<strong>OP Regeneration Applied</strong>" : "<strong>OP Regeneration (Dry-Run)</strong>";
  const html = `<div class="bbttcc-opregen-summary">
    <p>${hdr}</p>
    <table class="bbttcc-table" style="width:100%;">
      <thead><tr><th>Faction</th><th style="width:30%;">Scenes</th><th>Gains</th></tr></thead>
      <tbody>${lines}</tbody>
    </table>
  </div>`;
  ChatMessage.create({ content: html, speaker: { alias: "BBTTCC — Territory" }, whisper: game.users.filter(u=>u.isGM).map(u=>u.id) });

  return { changed: !!apply, rows };
}

/* ------------------------------------------------------------------
   Resources → Turn Bank driver (existing feature you’re using)
   (kept for completeness so this file is the canonical turn driver)
------------------------------------------------------------------- */
async function advanceTurn({ apply=false, sceneId=null } = {}) {
  // Reuse your existing implementation here if you already installed it earlier.
  // (This stub just calls the version you registered previously, if present.)
  const api = game.bbttcc?.api?.territory;
  if (api && api._delegateAdvanceTurn) return api._delegateAdvanceTurn({ apply, sceneId });
  // If no delegate is present, do a no-op dry card.
  return { changed:false, rows:[] };
}

/* ------------------------------------------------------------------
   API registration
------------------------------------------------------------------- */
function ensureNS() {
  game.bbttcc ??= { api:{} };
  game.bbttcc.api ??= {};
  game.bbttcc.api.territory ??= {};
}

Hooks.once("ready", () => {
  ensureNS();
  // Keep any previously registered advanceTurn as a delegate if it exists,
  // then expose both drivers canonically from here.
  if (typeof game.bbttcc.api.territory.advanceTurn === "function") {
    game.bbttcc.api.territory._delegateAdvanceTurn = game.bbttcc.api.territory.advanceTurn;
  }
  game.bbttcc.api.territory.advanceTurn   = advanceTurn;
  game.bbttcc.api.territory.advanceOPRegen = advanceOPRegen;

  log("Turn Drivers registered: advanceTurn(resources) + advanceOPRegen(OP).");
});

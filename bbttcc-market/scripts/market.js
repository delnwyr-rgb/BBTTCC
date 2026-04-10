
// modules/bbttcc-market/scripts/market.js
// BBTTCC Market — Procurement Console (MVP)
//
// - Spend Faction Economy OP to purchase:
//   - gear (Item UUID → character inventory)
//   - rig (registry payload → flags.bbttcc-factions.rigs[] via factions API)
//   - facility (payload → hex.flags.bbttcc-territory.facilities.primary)
//   - hex_asset (payload → hex.flags.bbttcc-territory.assets[])
//
// This module is intentionally GM-driven and avoids combat/HP hooks.

const MODULE_ID = "bbttcc-market";
const MOD_FACTIONS = "bbttcc-factions";
const MOD_TERR = "bbttcc-territory";

const log  = (...a) => console.log(`[${MODULE_ID}]`, ...a);
const warn = (...a) => console.warn(`[${MODULE_ID}]`, ...a);

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/* ===================== Economic Horizon (Faction Tier → Rarity Horizon) =====================

  - Tier A → Uncommon
  - Tier B → Rare
  - Tier C → Very Rare
  - Artifact → never purchasable (discovery only)

  Catalog entries MAY declare `rarity`, but for Gear we also auto-resolve rarity from the
  underlying dnd5e Item referenced by `entry.uuid` (system.rarity).
*/

const RARITY_RANK = {
  common: 1,
  uncommon: 2,
  rare: 3,
  very_rare: 4,
  legendary: 5,
  artifact: 6
};

function _tierToRarity(tier) {
  const t = Number(tier);
  if (!Number.isFinite(t) || t <= 0) return null;
  if (t === 1) return "uncommon";
  if (t === 2) return "rare";
  if (t === 3) return "very_rare";
  return "legendary"; // tier 4+
}

function normalizeRarity(r) {
  const k = String(r || "common").trim().toLowerCase();
  return RARITY_RANK[k] ? k : "common";
}

function _normalizeExternalRarity(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "common";
  if (s === "common") return "common";
  if (s === "uncommon") return "uncommon";
  if (s === "rare") return "rare";
  if (s === "legendary") return "legendary";
  if (s === "artifact") return "artifact";
  // very rare variants
  if (s === "very_rare" || s === "very rare" || s === "very-rare" || s === "veryrare") return "very_rare";
  if (s.includes("very") && s.includes("rare")) return "very_rare";
  return "common";
}

function factionEconomicHorizon(factionActor) {
  const tier = String(factionActor?.getFlag?.(MOD_FACTIONS, "tier") || "A").toUpperCase();
  if (tier === "C") return "very_rare";
  if (tier === "B") return "rare";
  return "uncommon";
}

function rarityDistance(entryRarity, horizonRarity) {
  return (RARITY_RANK[normalizeRarity(entryRarity)] - RARITY_RANK[normalizeRarity(horizonRarity)]);
}

function scaledEconomyCost(baseCost, distance) {
  const n = Number(baseCost ?? 0) || 0;
  if (distance <= 0) return 0;     // Standard Issue (within horizon)
  if (distance === 1) return n;
  if (distance === 2) return n * 2;
  return n * 4;                    // distance ≥ 3
}

async function resolveEntryRarity(entry) {
  // 1) Explicit rarity on the catalog entry wins (optional authoring)
  if (entry?.rarity) return normalizeRarity(_normalizeExternalRarity(entry.rarity));

  // 2) Gear: resolve from the referenced dnd5e Item (system.rarity)
  try {
    const kind = String(entry?.kind || "").toLowerCase();
    const uuid = String(entry?.uuid || "").trim();
    if (kind === "gear" && uuid) {
      const doc = await fromUuid(uuid);
      if (doc) {
        const sysR = foundry.utils.getProperty(doc, "system.rarity");
        const altR = foundry.utils.getProperty(doc, "system.traits.rarity") || foundry.utils.getProperty(doc, "flags.dnd5e.rarity");
        const raw = sysR || altR || "";
        return normalizeRarity(_normalizeExternalRarity(raw));
      }
    }
  } catch {}

  // 3) Non-gear: infer from declared tier-like fields (rig/facility/upgrades/assets)
  try {
    const kind = String(entry?.kind || "").toLowerCase();
    if (kind !== "gear") {
      const t =
        entry?.tier ??
        entry?.rigData?.tier ??
        entry?.facilityPatch?.tier ??
        entry?.patch?.tier ??
        entry?.rigData?.minTier ??
        entry?.facilityPatch?.minTier;
      const mapped = _tierToRarity(t);
      if (mapped) return normalizeRarity(mapped);
    }
  } catch {}

  // 4) Default
  return "common";
}

function rarityLabelFor(r) {
  const k = normalizeRarity(r);
  if (k === "very_rare") return "Very Rare";
  return k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ");
}

function chipSpecFor(rarity, horizon, distance, baseCost, econCost) {
  // Returns { text, title, style }
  const rLab = rarityLabelFor(rarity || "common");
  const hLab = rarityLabelFor(horizon || "uncommon");
  const d = Number(distance || 0);
  const b0 = Number(baseCost || 0) || 0;
  const e0 = Number(econCost || 0) || 0;

  if (String(rarity) === "artifact") {
    return {
      text: "Artifact",
      title: "Artifact (discovery only)",
      style: "border-color:rgba(148,163,184,.40);background:rgba(100,116,139,.15);letter-spacing:.06em;text-transform:uppercase;"
    };
  }

  if (d <= 0) {
    return {
      text: e0 ? `Standard Issue • Econ ${e0}` : "Standard Issue",
      title: e0 ? `Rarity ${rLab} (≤ Horizon ${hLab}) • Base ${b0} → ${e0}` : `Rarity ${rLab} (≤ Horizon ${hLab})`,
      style: "border-color:rgba(34,197,94,.35);background:rgba(34,197,94,.10);"
    };
  }

  let mult = 1;
  if (d === 2) mult = 2;
  else if (d >= 3) mult = 4;

  const b = b0;
  const e = e0;
  const multLabel = (mult === 1) ? "x1" : (mult === 2) ? "x2" : "x4";

  const style =
    (mult >= 4) ? "border-color:rgba(239,68,68,.40);background:rgba(239,68,68,.10);" :
    (mult >= 2) ? "border-color:rgba(249,115,22,.35);background:rgba(249,115,22,.10);" :
                 "border-color:rgba(250,204,21,.35);background:rgba(250,204,21,.10);";

  return {
    text: `Strains (${multLabel}) • Econ ${e}`,
    title: `Rarity ${rLab} vs Horizon ${hLab} (Δ ${d}) • Base ${b} → ${e}`,
    style
  };
}

function isFactionActor(a) {
  if (!a) return false;
  try {
    if (a.getFlag?.(MOD_FACTIONS, "isFaction")) return true;
    const typ = foundry.utils.getProperty(a, "system.details.type.value");
    if (typ === "faction") return true;
  } catch {}
  return false;
}

function isCharacterActor(a) {
  try { return a?.type === "character"; } catch { return false; }
}

function allFactions() {
  return game.actors?.contents?.filter?.(isFactionActor) ?? [];
}

function allCharacters() {
  return game.actors?.contents?.filter?.(isCharacterActor) ?? [];
}

function esc(s) {
  try { return foundry.utils.escapeHTML(String(s ?? "")); } catch { return String(s ?? ""); }
}

function _safeJsonParse(txt, fallback) {
  try { return JSON.parse(txt); } catch { return fallback; }
}

function _clamp0(n) {
  const x = Number(n ?? 0);
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}

function kindLabel(k) {
  const key = String(k || "").toLowerCase();
  if (key === "gear") return "Gear";
  if (key === "rig") return "Rig";
  if (key === "facility") return "Facility";
  if (key === "hex_asset") return "Hex Asset";
  if (key === "rig_upgrade") return "Rig Upgrade";
  if (key === "facility_upgrade") return "Facility Upgrade";
  return "Thing";
}

function costLabel(cost) {
  const c = cost && typeof cost === "object" ? cost : {};
  const econ = Number(c.economy ?? 0) || 0;
  const parts = [];
  if (econ) parts.push(`Econ ${econ}`);
  const rest = Object.entries(c).filter(([k,_]) => k !== "economy").map(([k,v]) => `${k} ${v}`);
  return parts.concat(rest).join(" · ") || "0";
}


function _uuidish(v) {
  const s = String(v || "");
  return s.includes("Compendium.") || s.startsWith("Actor.") || s.startsWith("Item.") || s.startsWith("Scene.") || s.startsWith("Folder.") || s.startsWith("JournalEntry.") || s.startsWith("RollTable.");
}

function _makeId(prefix="id") {
  return `${prefix}-${Math.random().toString(36).slice(2,8)}-${Date.now().toString(36)}`;
}

function _vendorsArray() {
  const v = game.settings.get(MODULE_ID, "vendors") || [];
  return Array.isArray(v) ? v : [];
}

function _catalogArray() {
  const c = game.settings.get(MODULE_ID, "catalog") || [];
  return Array.isArray(c) ? c : [];
}

function _normalizeVendor(v) {
  const id = String(v?.id || _makeId("vendor"));
  const tags = Array.isArray(v?.tags) ? v.tags : String(v?.tags || "").split(",").map(s=>s.trim()).filter(Boolean);
  const active = (v?.active === false) ? false : true;
  return { id, name: String(v?.name || id), blurb: String(v?.blurb || ""), tags: tags.map(t=>String(t)), active };
}


function _normalizeEntry(e) {
  const id = String(e?.id || _makeId("entry"));
  const kind = String(e?.kind || "gear");
  const costObj = (e?.cost && typeof e.cost === "object") ? e.cost : { economy: Number(e?.econ ?? e?.cost ?? 0) || 0 };
  const out = {
    id,
    vendorId: String(e?.vendorId || ""),
    kind,
    name: String(e?.name || id),
    blurb: String(e?.blurb || ""),
    cost: { ...costObj, economy: Number(costObj.economy ?? 0) || 0 },
    buCost: Number(e?.buCost ?? 0) || 0
  };
  if (kind === "gear") out.uuid = String(e?.uuid || "");
  if (kind === "rig") out.rigData = e?.rigData || {};
  if (kind === "facility") out.facilityPatch = e?.facilityPatch || {};
  if (kind === "hex_asset") out.asset = e?.asset || { key:"", label:"" };
  if (kind === "rig_upgrade" || kind === "facility_upgrade") out.patch = e?.patch || {};
  return out;
}

function _entryPayloadString(e) {
  const kind = String(e?.kind || "");
  if (kind === "gear") return String(e?.uuid || "");
  if (kind === "rig") return JSON.stringify(e?.rigData || {}, null, 2);
  if (kind === "facility") return JSON.stringify(e?.facilityPatch || {}, null, 2);
  if (kind === "hex_asset") return JSON.stringify(e?.asset || {}, null, 2);
  if (kind === "rig_upgrade" || kind === "facility_upgrade") return JSON.stringify(e?.patch || {}, null, 2);
  return "";
}

/* ===================== Settings: vendors + catalogs ===================== */

const DEFAULT_VENDORS = [
  {
    id: "mall-of-forgotten-yesterdays",
    name: "Mall of Forgotten Yesterdays",
    blurb: "A temple of consumer ghosts. The lights still hum.",
    tags: ["mall","gear","oddities"],
    active: true
  },
  {
    id: "furriers-fixit-farm",
    name: "Furrier's Fixit Farm",
    blurb: "Repair cult, salvage orchard, and a surprisingly good coffee cart.",
    tags: ["repair","rigs","facilities"],
    active: true
  }
];

// Minimal starter catalog. Replace these UUIDs with your real compendium UUIDs.
const DEFAULT_CATALOG = [
  {
    id: "starter-medkit",
    vendorId: "mall-of-forgotten-yesterdays",
    kind: "gear",
    name: "Field Medkit (Surplus)",
    blurb: "Bandages, syringes, clean-ish gloves. Keeps you from dying of dumb.",
    uuid: "", // Compendium.x.y.Item.<id>
    cost: { economy: 1 }
  },
  {
    id: "starter-rig-war",
    vendorId: "furriers-fixit-farm",
    kind: "rig",
    name: "War Rig (Template)",
    blurb: "A bare chassis with attitude. Configure after purchase.",
    rigData: {
      name: "New Rig",
      type: "war-rig",
      hitTrack: { max: 10, current: 10 },
      damageStep: 0,
      mobilityTags: [],
      raidBonuses: { defense: 0 },
      passiveBonuses: [],
      turnEffectsRaw: []
    },
    cost: { economy: 3 }
  },
  {
    id: "starter-facility-bunker",
    vendorId: "furriers-fixit-farm",
    kind: "facility",
    name: "Bunker (Small)",
    blurb: "Walls. Doors. The feeling that the world can't reach you (it can).",
    facilityPatch: {
      version: "0.1",
      facilityType: "bunker",
      tier: 1,
      size: "small",
      structureDefenseRating: 3,
      hitTrack: ["light","heavy","breached","destroyed"],
      opModifiers: { violenceDefense: 1, faithDefense: 1 },
      raidBonuses: { defenderDcBonus: 1, attackerExtraOpCost: { violence: 1, logistics: 0 }, maxDefenderUnits: 2, notes: "" },
      travelEncounterEffects: { encounterTierAdjust: 0, hazardMitigation: ["shelter-from-weather"], description: "" },
      hazards: { radiation: 0, corruption: 0, instability: 0, notes: "" },
      hexBinding: { notes: "" },
      integration: { autoApplyRaidBonuses: true, autoApplyTurnEffects: true, turnEffects: [], resolutionHooks: {} }
    },
    cost: { economy: 4 }
  },
  {
    id: "hex-asset-workshop",
    vendorId: "furriers-fixit-farm",
    kind: "hex_asset",
    name: "Workshop Bay (Hex Asset)",
    blurb: "A place where tools exist and people argue about them.",
    asset: { key: "workshop_bay", label: "Workshop Bay" },
    cost: { economy: 2 }
  }

,
{
  id: "gear-xvli",
  vendorId: "mall-of-forgotten-yesterdays",
  kind: "gear",
  name: "Imported Item",
  blurb: "",
  uuid: "Compendium.bbttcc-master-content.items.Item.XvliX6HYw04Ao3A4",
  cost: { economy: 1 }
},
{
  id: "gear-hlvn",
  vendorId: "mall-of-forgotten-yesterdays",
  kind: "gear",
  name: "Imported Item",
  blurb: "",
  uuid: "Compendium.bbttcc-master-content.items.Item.HlvNlhDr9F2COugT",
  cost: { economy: 1 }
}
];

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "vendors", {
    name: "Vendors",
    scope: "world",
    config: false,
    type: Object,
    default: DEFAULT_VENDORS
  });

  game.settings.register(MODULE_ID, "catalog", {
    name: "Catalog",
    scope: "world",
    config: false,
    type: Object,
    default: DEFAULT_CATALOG
  });

  game.settings.register(MODULE_ID, "lastContext", {
    name: "Market Context",
    scope: "client",
    config: false,
    type: Object,
    default: { vendorId: DEFAULT_VENDORS[0].id, factionId: "", characterId: "", hexUuid: "", q: "", kind: "", note: "" }
  });
});

/* ===================== Core purchase pipeline ===================== */

async function spendEconomyOP(factionId, econCost, meta = {}) {
  const n = Number(econCost ?? 0) || 0;
  if (!n) return { ok: true, committed: true, cost: 0 };

  const opApi = game.bbttcc?.api?.op;
  if (!opApi || typeof opApi.commit !== "function") throw new Error("OP API not available (game.bbttcc.api.op.commit).");

  // Spending uses NEGATIVE deltas (world convention).
  const deltas = { economy: -Math.abs(n) };

  const res = await opApi.commit(factionId, deltas, {
    source: "market",
    label: meta?.label || "Market Purchase",
    note: meta?.note || ""
  });

  if (!res?.committed) {
    return { ok: false, committed: false, underflow: res?.underflow ?? null };
  }
  return { ok: true, committed: true, cost: n };
}

async function appendFactionReceipt(factionActor, receipt) {
  try {
    const cur = factionActor.getFlag(MOD_FACTIONS, "warLogs");
    const warLogs = Array.isArray(cur) ? foundry.utils.duplicate(cur) : [];
    warLogs.unshift(receipt);
    await factionActor.setFlag(MOD_FACTIONS, "warLogs", warLogs);
  } catch (e) {
    warn("appendFactionReceipt failed", e);
  }
}

async function deliverGearToCharacter(characterId, itemUuid, qty = 1) {
  if (!characterId) throw new Error("No character selected for gear delivery.");
  if (!itemUuid) throw new Error("No gear UUID set on this catalog entry.");

  const actor = game.actors.get(characterId);
  if (!actor) throw new Error("Character actor not found.");
  const src = await fromUuid(itemUuid);
  if (!src) throw new Error("Could not resolve gear UUID.");

  const data = src.toObject ? src.toObject() : foundry.utils.duplicate(src);
  delete data._id;
  data.system = data.system ?? {};
  // qty (dnd5e uses system.quantity)
  try {
    const q = Number(foundry.utils.getProperty(data, "system.quantity") ?? 1) || 1;
    foundry.utils.setProperty(data, "system.quantity", q * Math.max(1, Number(qty)||1));
  } catch {}

  await actor.createEmbeddedDocuments("Item", [data]);
  return true;
}

async function deliverRigToFaction(factionId, rigData) {
  const api = game.bbttcc?.api?.factions;
  if (!api || typeof api.addRig !== "function") throw new Error("Factions rig API not available (game.bbttcc.api.factions.addRig).");
  const rig = await api.addRig(factionId, rigData || {});
  return rig;
}


async function _getFactionRigsArray(factionActor) {
  const rigs = factionActor.getFlag(MOD_FACTIONS, "rigs");
  return Array.isArray(rigs) ? foundry.utils.duplicate(rigs) : [];
}

async function applyRigUpgradePatch(factionId, patch, meta = {}) {
  const faction = game.actors.get(factionId);
  if (!faction) throw new Error("Faction not found.");

  const rigs = await _getFactionRigsArray(faction);
  if (!rigs.length) throw new Error("Faction has no rigs to upgrade.");

  const target = patch?.target || {};
  let idx = -1;
  if (target.rigId) idx = rigs.findIndex(r => r?.rigId === target.rigId);
  if (idx < 0 && target.name) idx = rigs.findIndex(r => String(r?.name||"") === String(target.name));
  if (idx < 0 && target.latest) idx = 0;
  if (idx < 0) idx = 0;

  const cur = rigs[idx] || {};
  const next = foundry.utils.mergeObject(foundry.utils.duplicate(cur), foundry.utils.duplicate(patch?.patch || patch), { inplace:false, overwrite:true });
  rigs[idx] = next;
  await faction.setFlag(MOD_FACTIONS, "rigs", rigs);

  return { rigIndex: idx, rigId: next?.rigId || null };
}

async function deliverFacilityToHex(hexUuid, facilityPatch) {
  if (!hexUuid) throw new Error("Facility delivery requires a hexUuid.");
  const hex = await fromUuid(hexUuid);
  if (!hex) throw new Error("Could not resolve hexUuid for facility delivery.");

  const tf = foundry.utils.duplicate(hex.flags?.[MOD_TERR] ?? {});
  const facilitiesRoot = tf.facilities ?? {};
  const currentPrimary = facilitiesRoot.primary ?? {};
  const nextPrimary = foundry.utils.mergeObject(foundry.utils.duplicate(currentPrimary), foundry.utils.duplicate(facilityPatch || {}), { inplace:false, overwrite:true });

  const nextFacilities = foundry.utils.duplicate(facilitiesRoot);
  nextFacilities.primary = nextPrimary;

  await hex.update({ [`flags.${MOD_TERR}.facilities`]: nextFacilities });
  return true;
}


async function applyFacilityUpgradePatch(hexUuid, patch) {
  if (!hexUuid) throw new Error("Facility upgrade requires a hexUuid.");
  const hex = await fromUuid(hexUuid);
  if (!hex) throw new Error("Could not resolve hexUuid.");

  const tf = foundry.utils.duplicate(hex.flags?.[MOD_TERR] ?? {});
  const facilitiesRoot = tf.facilities ?? {};
  const currentPrimary = facilitiesRoot.primary ?? {};
  const nextPrimary = foundry.utils.mergeObject(foundry.utils.duplicate(currentPrimary), foundry.utils.duplicate(patch?.patch || patch), { inplace:false, overwrite:true });

  const nextFacilities = foundry.utils.duplicate(facilitiesRoot);
  nextFacilities.primary = nextPrimary;

  await hex.update({ [`flags.${MOD_TERR}.facilities`]: nextFacilities });
  return true;
}

async function deliverHexAsset(hexUuid, asset) {
  if (!hexUuid) throw new Error("Hex asset delivery requires a hexUuid.");
  const hex = await fromUuid(hexUuid);
  if (!hex) throw new Error("Could not resolve hexUuid for asset delivery.");

  const tf = foundry.utils.duplicate(hex.flags?.[MOD_TERR] ?? {});
  const cur = Array.isArray(tf.assets) ? tf.assets.slice() : [];
  cur.unshift({
    key: String(asset?.key || "asset"),
    label: String(asset?.label || asset?.key || "Asset"),
    ts: Date.now()
  });

  await hex.update({ [`flags.${MOD_TERR}.assets`]: cur });
  return true;
}

async function purchase({ entryId, factionId, characterId, hexUuid, note } = {}) {
  const faction = game.actors.get(factionId);
  if (!faction || !isFactionActor(faction)) throw new Error("Buyer faction not found.");

  const catalog = game.settings.get(MODULE_ID, "catalog") || [];
  const entry = (Array.isArray(catalog) ? catalog : []).find(e => e?.id === entryId);
  if (!entry) throw new Error("Catalog entry not found.");

  // Economic Horizon: compute spend based on rarity vs faction horizon.
  // Base cost remains the authored Econ cost on the catalog entry.
  const baseCost = Number(entry?.cost?.economy ?? 0) || 0;
  const horizon = factionEconomicHorizon(faction);
  const rarity = await resolveEntryRarity(entry);

  if (rarity === "artifact") {
    throw new Error("Artifacts cannot be purchased. Discovery only.");
  }

  const distance = rarityDistance(rarity, horizon);
  const kind = String(entry.kind || "").toLowerCase();
  let econCost = scaledEconomyCost(baseCost, distance);

  // Gear can be free if within horizon (Standard Issue). Big-ticket purchases should still cost their base Econ.
  if (distance <= 0 && kind && kind !== "gear") {
    econCost = baseCost;
  }

  // 1) Spend
  const spendRes = await spendEconomyOP(factionId, econCost, { label: entry.name, note });
  if (!spendRes.ok) throw new Error("Insufficient Economy OP (or OP engine refused commit).");

  // 2) Deliver
  let delivered = null;

  if (kind === "gear") {
    await deliverGearToCharacter(characterId, entry.uuid, 1);
    delivered = { to: "character", characterId };
  } else if (kind === "rig") {
    const rig = await deliverRigToFaction(factionId, entry.rigData);
    delivered = { to: "faction", rigId: rig?.rigId || null };
  } else if (kind === "facility") {
    await deliverFacilityToHex(hexUuid, entry.facilityPatch);
    delivered = { to: "hex", hexUuid };
  } else if (kind === "hex_asset") {
    await deliverHexAsset(hexUuid, entry.asset);
    delivered = { to: "hex", hexUuid };
  } else if (kind === "rig_upgrade") {
    const patch = entry.patch || {};
    const res = await applyRigUpgradePatch(factionId, patch, { note });
    delivered = { to: "faction", rigUpgrade: true, ...res };
  } else if (kind === "facility_upgrade") {
    const patch = entry.patch || {};
    await applyFacilityUpgradePatch(hexUuid, patch);
    delivered = { to: "hex", facilityUpgrade: true, hexUuid };
  } else {
    throw new Error(`Unsupported kind: ${kind}`);
  }

  // 3) Receipt (faction war log)
  const receipt = {
    ts: Date.now(),
    type: "market_purchase",
    summary: econCost
      ? `Purchased: ${entry.name} (Econ ${econCost})`
      : `Acquired: ${entry.name} (Standard Issue)`,
    vendorId: entry.vendorId || "",
    entryId,
    econCost,
    baseCost,
    rarity,
    horizon,
    distance,
    delivered,
    note: String(note || "").trim()
  };
  await appendFactionReceipt(faction, receipt);

  // 4) GM whisper receipt
  try {
    const gmIds = (game.users ?? []).filter(u => u.isGM).map(u => u.id);
    if (gmIds.length) {
      await ChatMessage.create({
        whisper: gmIds,
        speaker: { alias: "BBTTCC Market" },
        content: `<p><b>Market Purchase</b></p>
          <p><b>${esc(faction.name)}</b> acquired <b>${esc(entry.name)}</b> ${econCost ? `for <code>Econ ${esc(econCost)}</code>` : `<i>(Standard Issue)</i>`}.</p>
          <p class="bbttcc-muted">Rarity: <code>${esc(rarity)}</code> • Horizon: <code>${esc(horizon)}</code> • Δ: <code>${esc(distance)}</code></p>
          ${note ? `<p class="bbttcc-muted">Note: ${esc(note)}</p>` : ""}`
      });
    }
  } catch {}

  return { ok: true, entry, receipt };
}

/* ===================== UI ===================== */

export class BBTTCCMarketApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-market",
    window: { title: "BBTTCC Market", icon: "fas fa-store", resizable: true },
    position: { width: 980, height: 720 },
    classes: ["bbttcc", "bbttcc-market", "sheet"],
    resizable: true
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/market-app.hbs` }
  };

  constructor(options = {}) {
    super(options);
    this._abort = null;
    this._docCache = new Map();
  }

  _loadCtx() {
    const c = game.settings.get(MODULE_ID, "lastContext") || {};
    return {
      vendorId: c.vendorId || DEFAULT_VENDORS[0].id,
      factionId: c.factionId || "",
      characterId: c.characterId || "",
      hexUuid: c.hexUuid || "",
      q: c.q || "",
      kind: c.kind || "",
      note: c.note || ""
    };
  }

  _saveCtx(patch) {
    const cur = this._loadCtx();
    const next = foundry.utils.mergeObject(cur, patch || {}, { inplace:false, overwrite:true });
    game.settings.set(MODULE_ID, "lastContext", next);
  }

  async _preparePartContext(partId, context) {
    if (partId !== "body") return context;

    const ctx = this._loadCtx();

    const vendorsRaw0 = game.settings.get(MODULE_ID, "vendors") || [];
const catalogRaw = game.settings.get(MODULE_ID, "catalog") || [];

const isGM = !!game.user?.isGM;
const vendorsRaw = (Array.isArray(vendorsRaw0) ? vendorsRaw0 : []).map(_normalizeVendor);

// Players should only see active markets.
const visibleVendors = isGM ? vendorsRaw : vendorsRaw.filter(v => v.active !== false);

// If lastContext points at an inactive market, fall back to the first active one (for players).
if (!isGM) {
  const curV = vendorsRaw.find(v => v.id === ctx.vendorId);
  if (!curV || curV.active === false) {
    ctx.vendorId = visibleVendors?.[0]?.id || "";
    this._saveCtx({ vendorId: ctx.vendorId });
  }
}

const vendors = visibleVendors.map(v => ({
  id: v.id,
  name: v.name,
  active: v.active !== false,
  displayName: (isGM && v.active === false) ? `${v.name} (inactive)` : v.name,
  selected: v.id === ctx.vendorId
}));

    const vendor = vendorsRaw.find(v => v.id === ctx.vendorId) || vendorsRaw?.[0];
    const vendorName = vendor?.name || "Vendor";

    const vendorStatusLine = (isGM && vendor && vendor.active === false) ? "Inactive: hidden from players." : "";

    const factions = allFactions()
      .filter(a => game.user?.isGM || a?.isOwner)
      .map(a => ({ id: a.id, name: a.name, selected: a.id === ctx.factionId }))
      .sort((a,b)=>String(a.name).localeCompare(String(b.name)));
const characters = allCharacters().map(a => ({ id: a.id, name: a.name, selected: a.id === ctx.characterId }))
      .sort((a,b)=>String(a.name).localeCompare(String(b.name)));

    let entries = (Array.isArray(catalogRaw) ? catalogRaw : []).filter(e => e?.vendorId === ctx.vendorId);

    if (ctx.kind) entries = entries.filter(e => String(e.kind||"") === ctx.kind);
    if (ctx.q) {
      const q = String(ctx.q).toLowerCase();
      entries = entries.filter(e =>
        String(e.name||"").toLowerCase().includes(q) ||
        String(e.blurb||"").toLowerCase().includes(q) ||
        String(e.kind||"").toLowerCase().includes(q)
      );
    }

    entries = await Promise.all(entries.map(async (e) => {
      const kind = String(e.kind || "").toLowerCase();
      let docUuid = "";
      let img = "";
      let docName = "";
      if (kind === "gear") {
        docUuid = String(e.uuid || "").trim();
        if (docUuid) {
          try {
            const cached = this._docCache.get(docUuid);
            const doc = cached || await fromUuid(docUuid);
            if (doc && !cached) this._docCache.set(docUuid, doc);
            img = String(doc?.img || "");
            docName = String(doc?.name || "");
          } catch {}
        }
      }

      return {
        id: e.id,
        name: e.name,
        blurb: e.blurb || "",
        kind: e.kind,
        kindLabel: kindLabel(e.kind),
        costLabel: costLabel(e.cost),
        buCost: e.buCost ? Number(e.buCost) : 0,
        img,
        docUuid,
        docName,
        canOpen: !!docUuid
      };
    }));

    return {
      ...context,
      apiReady: true,
      isGM,
      vendorStatusLine,
      vendors,
      vendorName,
      factions,
      characters,
      entries,
      hexUuid: ctx.hexUuid,
      q: ctx.q,
      note: ctx.note
    };
  }

  async _onRender(ctx, opts) {
    await super._onRender(ctx, opts);

    const root = this.element?.[0] ?? this.element;
    if (!root) return;

    if (this._abort) { try { this._abort.abort(); } catch {} }
    this._abort = new AbortController();
    const sig = this._abort.signal;

    const vendorSel = root.querySelector("[data-role='vendor']");
    const factionSel = root.querySelector("[data-role='faction']");
    const charSel = root.querySelector("[data-role='character']");
    const hexInp = root.querySelector("[data-role='hexUuid']");
    const qInp = root.querySelector("[data-role='q']");
    const kindSel = root.querySelector("[data-role='kind']");
    const noteInp = root.querySelector("[data-role='note']");

// --- Economic Horizon chips (UI) ---
// Adds chips near Buy buttons without modifying templates.
try {
  const ctxNow0 = this._loadCtx();
  const buyerFaction0 = ctxNow0.factionId ? game.actors.get(ctxNow0.factionId) : null;
  const horizon0 = buyerFaction0 ? factionEconomicHorizon(buyerFaction0) : null;

  const catalogAll0 = game.settings.get(MODULE_ID, "catalog") || [];
  const catalogAll = Array.isArray(catalogAll0) ? catalogAll0 : [];

  const rows = Array.from(root.querySelectorAll("[data-entry-id]"));
  if (horizon0 && rows.length) {
    for (const row of rows) {
      const entryId = row.getAttribute("data-entry-id") || (row.dataset ? row.dataset.entryId : "");
      if (!entryId) continue;
      if (row.querySelector(".bbttcc-market-chip")) continue;

      const entry = catalogAll.find(e => e && e.id === entryId);
      if (!entry) continue;

      const baseCost = Number(entry?.cost?.economy ?? 0) || 0;
      const rarity = await resolveEntryRarity(entry);
      const distance = rarityDistance(rarity, horizon0);
      let econCost = scaledEconomyCost(baseCost, distance);
      const kind = String(entry?.kind || "").toLowerCase();
      if (distance <= 0 && kind && kind !== "gear") econCost = baseCost;

      const spec = chipSpecFor(rarity, horizon0, distance, baseCost, econCost);

      const chip = document.createElement("span");
      chip.className = "bbttcc-market-chip";
      chip.textContent = spec.text || "";
      if (spec.title) chip.title = spec.title;

      chip.style.cssText =
        "display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;line-height:16px;margin-right:8px;" +
        "border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.45);color:#e5e7eb;white-space:nowrap;" +
        (spec.style || "");

      const buyBtn = row.querySelector("button[data-action='buy']");
      if (buyBtn && buyBtn.parentElement) buyBtn.parentElement.insertBefore(chip, buyBtn);
      else row.appendChild(chip);
    }
  }
} catch {}


    const persist = () => {
      this._saveCtx({
        vendorId: vendorSel?.value || "",
        factionId: factionSel?.value || "",
        characterId: charSel?.value || "",
        hexUuid: hexInp?.value || "",
        q: qInp?.value || "",
        kind: kindSel?.value || "",
        note: noteInp?.value || ""
      });
    };

    [vendorSel, factionSel, charSel, kindSel].forEach(el => {
      el?.addEventListener("change", () => { persist(); this.render(false); }, { signal: sig });
    });
    [hexInp, qInp, noteInp].forEach(el => {
      el?.addEventListener("input", () => { persist(); }, { signal: sig });
      el?.addEventListener("change", () => { persist(); this.render(false); }, { signal: sig });
    });

    root.addEventListener("click", async (ev) => {
      const ctl = ev.target?.closest?.("[data-action]");
      if (!ctl) return;
      const act = ctl.dataset.action;

      if (act === "manage") { game.bbttcc?.api?.market?.openCatalogEditor?.(); return; }

      if (act === "openDoc") {
        ev.preventDefault(); ev.stopPropagation();
        const uuid = String(ctl.dataset.uuid || "").trim();
        if (!uuid) return;
        try {
          const doc = await fromUuid(uuid);
          if (doc?.sheet) doc.sheet.render(true, { focus: true });
          else ui.notifications?.warn?.("Doc not available.");
        } catch (e) {
          console.error(e);
          ui.notifications?.error?.("Could not open item.");
        }
        return;
      }

      if (act !== "buy") return;

      ev.preventDefault(); ev.stopPropagation();

      const entryEl = ctl.closest?.("[data-entry-id]");
      const entryId = entryEl?.dataset?.entryId;
      if (!entryId) return;

      const ctxNow = this._loadCtx();
      try {
        const res = await purchase({
          entryId,
          factionId: ctxNow.factionId,
          characterId: ctxNow.characterId,
          hexUuid: ctxNow.hexUuid,
          note: ctxNow.note
        });
        ui.notifications?.info?.("Purchase complete.");
        this.render(false);
      } catch (e) {
        console.error(e);
        ui.notifications?.error?.(e?.message || "Purchase failed.");
      }
    }, { capture: true, signal: sig });
  }
}



/* ===================== Catalog Editor (Drag & Drop) ===================== */

export class BBTTCCMarketCatalogEditorApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-market-catalogs",
    window: { title: "Market Catalogs", icon: "fas fa-list", resizable: true },
    position: { width: 1100, height: 780 },
    classes: ["bbttcc", "bbttcc-market", "sheet"],
    resizable: true
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/catalog-editor.hbs` }
  };

  constructor(options = {}) {
    super(options);
    this._abort = null;
    this._saving = false;
    this._confirmDelete = { vendorId: null, ts: 0 };
    const vendors = _vendorsArray().map(_normalizeVendor);
    this.vendorId = vendors?.[0]?.id || "vendor";
  }

  async _preparePartContext(partId, context) {
    if (partId !== "body") return context;

    const vendorsRaw = _vendorsArray().map(_normalizeVendor);
    const vendorId = this.vendorId || vendorsRaw?.[0]?.id;
    const vendors = vendorsRaw.map(v => ({ id: v.id, name: v.name, active: v.active !== false, displayName: (v.active === false) ? `${v.name} (inactive)` : v.name, selected: v.id === vendorId }));
    const vendor = vendorsRaw.find(v => v.id === vendorId) || vendorsRaw[0] || _normalizeVendor({ id: "vendor", name: "Vendor" });

    const entriesRaw = _catalogArray().filter(e => String(e.vendorId) === String(vendorId)).map(_normalizeEntry);
    const entries = entriesRaw.map(e => ({
      id: e.id,
      name: e.name,
      blurb: e.blurb,
      econ: Number(e.cost?.economy ?? 0) || 0,
      buCost: Number(e.buCost ?? 0) || 0,
      payload: _entryPayloadString(e),
      kind: e.kind,
      isGear: e.kind === "gear",
      isRig: e.kind === "rig",
      isFacility: e.kind === "facility",
      isHexAsset: e.kind === "hex_asset",
      isRigUpgrade: e.kind === "rig_upgrade",
      isFacilityUpgrade: e.kind === "facility_upgrade"
    }));

    const vendorTagsRaw = Array.isArray(vendor.tags) ? vendor.tags.join(", ") : String(vendor.tags || "");

    return {
      ...context,
      vendors,
      vendor: { ...vendor, tagsRaw: vendorTagsRaw },
      entries
    };
  }

  async _onRender(ctx, opts) {
  await super._onRender(ctx, opts);
  const root = this.element?.[0] ?? this.element;
  if (!root) return;

  // Prevent listener stacking on rerender.
  if (this._abort) { try { this._abort.abort(); } catch {} }
  this._abort = new AbortController();
  const sig = this._abort.signal;

  const vendorSel = root.querySelector("[data-role='vendor']");
  vendorSel?.addEventListener("change", () => {
    this.vendorId = vendorSel.value;
    this.render(false);
  }, { signal: sig });

  const dz = root.querySelector("[data-role='dropzone']");
  if (dz) {
    dz.addEventListener("dragover", (ev) => { ev.preventDefault(); dz.classList.add("is-over"); }, { signal: sig });
    dz.addEventListener("dragleave", () => dz.classList.remove("is-over"), { signal: sig });
    dz.addEventListener("drop", async (ev) => {
      ev.preventDefault();
      dz.classList.remove("is-over");

      let data = {};
      try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch {}
      if (!data || typeof data !== "object") return;

      try {
        const imported = await this._importDropData(data);
        if (imported?.count) ui.notifications?.info?.(`Imported ${imported.count} item(s) into catalog.`);
        this.render(false);
      } catch (e) {
        console.error(e);
        ui.notifications?.error?.(e?.message || "Import failed.");
      }
    }, { signal: sig });
  }

  root.addEventListener("click", async (ev) => {
    const btn = ev.target?.closest?.("button");
    if (!btn) return;
    const act = btn.dataset.action;

    if (act === "vendor-add") return this._vendorAdd();
    if (act === "vendor-del") return this._vendorDeleteSelected(); // toast-confirmed
    if (act === "entry-add") return this._entryAdd();
    if (act === "save") return this._saveAll();

    const row = btn.closest?.("[data-entry-id]");
    if (!row) return;
    const entryId = row.dataset.entryId;

    if (act === "del") return this._entryDelete(entryId);
    if (act === "dup") return this._entryDuplicate(entryId);
  }, { capture: true, signal: sig });
}

  _readVendorForm() {
    const root = this.element?.[0] ?? this.element;
    const vendors = _vendorsArray().map(_normalizeVendor);
    const idx = vendors.findIndex(v => v.id === this.vendorId);
    if (idx < 0) return null;

    const name = root.querySelector("[data-role='vendorName']")?.value || vendors[idx].name;
    const blurb = root.querySelector("[data-role='vendorBlurb']")?.value || "";
    const tagsRaw = root.querySelector("[data-role='vendorTags']")?.value || "";
    const active = !!root.querySelector("[data-role='vendorActive']")?.checked;

    vendors[idx] = _normalizeVendor({ ...vendors[idx], name, blurb, tags: tagsRaw, active });
    return { vendors, vendorId: vendors[idx].id };
  }

  _readEntriesForm() {
    const root = this.element?.[0] ?? this.element;
    const vendorId = this.vendorId;

    const all = _catalogArray().map(_normalizeEntry);
    const keep = all.filter(e => e.vendorId !== vendorId);

    const rows = [...root.querySelectorAll("[data-entry-id]")];
    const entries = rows.map(row => {
      const id = row.dataset.entryId;
      const name = row.querySelector("[data-k='name']")?.value || id;
      const kind = row.querySelector("[data-k='kind']")?.value || "gear";
      const econ = Number(row.querySelector("[data-k='cost.economy']")?.value || 0) || 0;
      const buCost = Number(row.querySelector("[data-k='buCost']")?.value || 0) || 0;
      const blurb = row.querySelector("[data-k='blurb']")?.value || "";
      const payload = row.querySelector("[data-k='payload']")?.value || "";

      const base = { id, vendorId, kind, name, blurb, cost: { economy: econ }, buCost };

      if (kind === "gear") return _normalizeEntry({ ...base, uuid: payload.trim() });
      if (kind === "rig") return _normalizeEntry({ ...base, rigData: _safeJsonParse(payload, {}) });
      if (kind === "facility") return _normalizeEntry({ ...base, facilityPatch: _safeJsonParse(payload, {}) });
      if (kind === "hex_asset") return _normalizeEntry({ ...base, asset: _safeJsonParse(payload, {}) });
      if (kind === "rig_upgrade" || kind === "facility_upgrade") return _normalizeEntry({ ...base, patch: _safeJsonParse(payload, {}) });

      return _normalizeEntry(base);
    });

    return keep.concat(entries);
  }

  async _saveAll() {
  if (this._saving) return;
  const vf = this._readVendorForm();
  if (!vf) return;

  const nextVendors = vf.vendors;
  const nextCatalog = this._readEntriesForm();

  this._saving = true;
  try {
    await game.settings.set(MODULE_ID, "vendors", nextVendors);
    await game.settings.set(MODULE_ID, "catalog", nextCatalog);
    ui.notifications?.info?.("Catalogs saved.");
  } finally {
    this._saving = false;
  }

  this.render(false);
}

  async _vendorAdd() {
    const vendors = _vendorsArray().map(_normalizeVendor);
    const id = _makeId("vendor");
    vendors.push(_normalizeVendor({ id, name: "New Vendor", blurb: "", tags: [] }));
    await game.settings.set(MODULE_ID, "vendors", vendors);
    this.vendorId = id;
    this.render(false);
  }

  async _entryAdd() {
    const cat = _catalogArray().map(_normalizeEntry);
    const id = _makeId("entry");
    cat.unshift(_normalizeEntry({ id, vendorId: this.vendorId, kind: "gear", name: "New Entry", blurb: "", uuid: "", cost: { economy: 1 } }));
    await game.settings.set(MODULE_ID, "catalog", cat);
    this.render(false);
  }

  async _entryDelete(entryId) {
    const vendorId = this.vendorId;
    const cat = _catalogArray().map(_normalizeEntry).filter(e => !(e.vendorId === vendorId && e.id === entryId));
    await game.settings.set(MODULE_ID, "catalog", cat);
    this.render(false);
  }

  async _entryDuplicate(entryId) {
    const vendorId = this.vendorId;
    const cat = _catalogArray().map(_normalizeEntry);
    const src = cat.find(e => e.vendorId === vendorId && e.id === entryId);
    if (!src) return;
    const dup = foundry.utils.duplicate(src);
    dup.id = _makeId("entry");
    dup.name = `${dup.name} (Copy)`;
    cat.unshift(_normalizeEntry(dup));
    await game.settings.set(MODULE_ID, "catalog", cat);
    this.render(false);
  }

  async _importDropData(data) {
    const vendorId = this.vendorId;

    const type = String(data.type || "").toLowerCase();
    const uuid = data.uuid || data?.data?.uuid;
    let uuids = [];

    if (uuid && _uuidish(uuid)) {
      if (type === "item") {
        uuids = [uuid];
      } else if (type === "folder" || uuid.startsWith("Folder.")) {
        const folderId = data.id || (uuid.split(".")[1] || "");
        const folder = game.folders?.get?.(folderId);
        const items = folder?.contents?.filter?.(d => d.documentName === "Item") || [];
        uuids = items.map(it => it.uuid).filter(Boolean);
      } else {
        const doc = await fromUuid(uuid);
        if (doc?.documentName === "Item") uuids = [doc.uuid];
      }
    } else if (type === "folder" && data.id) {
      const folder = game.folders?.get?.(data.id);
      const items = folder?.contents?.filter?.(d => d.documentName === "Item") || [];
      uuids = items.map(it => it.uuid).filter(Boolean);
    }

    if (!uuids.length) throw new Error("Drop did not resolve to any Items.");

    const catalog = _catalogArray().map(_normalizeEntry);
    let count = 0;

    for (const u of uuids) {
      const doc = await fromUuid(u);
      const name = doc?.name || "Item";
      const id = _makeId("gear");
      catalog.unshift(_normalizeEntry({ id, vendorId, kind: "gear", name, blurb: "", uuid: u, cost: { economy: 1 } }));
      count += 1;
    }

    await game.settings.set(MODULE_ID, "catalog", catalog);
    return { count };
  }
}
/* ===================== API surface ===================== */

Hooks.once("ready", () => {
  game.bbttcc ??= {};
  game.bbttcc.api ??= {};
  game.bbttcc.api.market ??= {};

  game.bbttcc.api.market.purchase = purchase;
  game.bbttcc.api.market.openMarket = (() => {
    let inst = null;
    return () => {
      if (inst && inst.rendered) { inst.bringToTop?.(); return inst; }
      inst = new BBTTCCMarketApp();
      inst.render(true, { focus: true });
      return inst;
    };
  })();

game.bbttcc.api.market.openCatalogEditor = (() => {
  let inst = null;
  return () => {
    if (!game.user?.isGM) return ui.notifications?.warn?.("GM only.");
    if (inst && inst.rendered) { inst.bringToTop?.(); return inst; }
    inst = new BBTTCCMarketCatalogEditorApp();
    inst.render(true, { focus: true });
    return inst;
  };
})();


  game.bbttcc.api.market.listVendors = () => foundry.utils.duplicate(_vendorsArray().map(_normalizeVendor));

  game.bbttcc.api.market.listCatalog = () => foundry.utils.duplicate(_catalogArray().map(_normalizeEntry));

  

  // ---------------------------
  // Player-facing launcher: Faction Sheet header button
  // - Visible to: GM, and players who own the faction actor
  // - Clicking opens the Market and preselects the faction in lastContext
  // ---------------------------
  try {
    Hooks.on("getActorSheetHeaderButtons", (app, buttons) => {
      try {
        const actor = app?.actor;
        if (!actor || !isFactionActor(actor)) return;
        const canOpen = game.user?.isGM || actor?.isOwner;
        if (!canOpen) return;

        buttons.unshift({
          label: "Market",
          class: "bbttcc-open-market",
          icon: "fas fa-store",
          onclick: () => {
            try {
              // preselect faction for convenience
              const cur = game.settings.get(MODULE_ID, "lastContext") || {};
              const next = foundry.utils.mergeObject(cur, { factionId: actor.id }, { inplace:false, overwrite:true });
              game.settings.set(MODULE_ID, "lastContext", next);
            } catch (_e) {}
            try { game.bbttcc?.api?.market?.openMarket?.(); } catch (e) { console.error(e); }
          }
        });
      } catch (_e) {}
    });
  } catch (_e) {}

log("ready — market API mounted at game.bbttcc.api.market (openMarket/openCatalogEditor/purchase/listVendors/listCatalog)");
});

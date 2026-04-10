// bbttcc-character-options/scripts/module.js
// v1.8.6 — OP scanner + Identity API + Tier Engine (archetypes + crew types + occult)
// Slice 1: refined unlock mapping API (no mechanics yet)

import { REFINED_OPTIONS } from "../data/refined-options.js";

const MOD = "bbttcc-character-options";
const log  = (...a) => console.log(`[${MOD}]`, ...a);
const warn = (...a) => console.warn(`[${MOD}]`, ...a);

// Packs where tier feats live
const PACK_ARCHETYPES = "bbttcc-character-options.character-archetypes";
const PACK_CREWTYPES  = "bbttcc-character-options.crew-types";
const PACK_OCCULT     = "bbttcc-character-options.occult-associations";

// OP buckets
const OP_KEYS = [
  "violence","nonlethal","intrigue","economy","softpower",
  "diplomacy","logistics","culture","faith"
];

const ALIASES = {
  violence:   ["violence","Violence"],
  nonlethal:  ["nonlethal","nonLethal","Nonlethal","Non-Lethal","non_lethal"],
  intrigue:   ["intrigue","Intrigue"],
  economy:    ["economy","Economy"],
  softpower:  ["softpower","softPower","Softpower","SoftPower","soft_power"],
  diplomacy:  ["diplomacy","Diplomacy"],
  logistics:  ["logistics","Logistics"],
  culture:    ["culture","Culture"],
  faith:      ["faith","Faith"]
};

// Per-actor guard so Tier Engine can't run concurrently and double-add feats
const _tierSyncActive = new Set();

/* ---------------------------------------
 * Hooks: expose APIs
 * ------------------------------------ */

Hooks.once("ready", () => {
  game.bbttcc = game.bbttcc ?? { api: {} };
  game.bbttcc.api = game.bbttcc.api ?? {};

  // OP calculator API
  game.bbttcc.api.characterOptions = game.bbttcc.api.characterOptions ?? {};
  game.bbttcc.api.characterOptions.recalcActor = recalcActor;
  game.bbttcc.api.characterOptions.recalcAll   = recalcAll;

  // Identity + Tier API
  game.bbttcc.api.identity = game.bbttcc.api.identity ?? {
    getIdentityFlags,
    setIdentityFlags,
    syncOptionTiers,
    getTierForLevel
  };

  // Slice 1: refined mapping + helpers (no mechanics here)
  game.bbttcc.api.characterOptions.refined = {
    data: REFINED_OPTIONS,
    getOwnedOptionCounts,
    getUnlocksForActor
  };

  log("ready — API exposed:", {
    characterOptions: Object.keys(game.bbttcc.api.characterOptions || {}),
    identity: Object.keys(game.bbttcc.api.identity || {}),
    refined: true
  });
});

/**
 * When a CLASS item on a character is updated and its levels change,
 * explicitly resync tiers. This is how we catch D&D5e level-ups.
 */
Hooks.on("updateItem", (item, changes) => {
  try {
    const actor = item?.parent;
    if (!actor || (actor.type ?? "").toLowerCase() !== "character") return;

    const isClass = (item.type ?? "").toLowerCase() === "class";
    if (!isClass) return;

    const levelsChanged =
      foundry.utils.hasProperty(changes, "system.levels") ||
      foundry.utils.hasProperty(changes, "system.levels.value");

    if (!levelsChanged) return;

    log("updateItem hook — class levels changed, resyncing tiers", {
      actor: actor.name,
      item: item.name,
      changes
    });

    game.bbttcc?.api?.identity?.syncOptionTiers?.(actor, { silent: false });
  } catch (e) {
    warn("updateItem hook (Tier Engine) failed", e);
  }
});

/* ---------------------------------------
 * Refined Options (Slice 1)
 * ------------------------------------ */

function normalizeOptionKey(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]+/g, "")
    .replace(/^_+|_+$/g, "");
}

function getOwnedOptionCounts(actorOrId) {
  const actor = typeof actorOrId === "string" ? game.actors.get(actorOrId) : actorOrId;
  if (!actor) return {};
  const identity = actor.getFlag(MOD, "identity") || {};
  const counts = {};
  for (const family of ["archetype", "crew", "occult"]) {
    const slot = identity?.[family];
    const keyRaw = slot?.optionKey;
    if (!keyRaw) continue;
    const key = normalizeOptionKey(keyRaw);
    const k = `${family}:${key}`;
    counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
}

function getUnlocksForActor(actorOrId) {
  const actor = typeof actorOrId === "string" ? game.actors.get(actorOrId) : actorOrId;
  if (!actor) return [];
  const identity = actor.getFlag(MOD, "identity") || {};
  const out = [];
  for (const family of ["archetype", "crew", "occult"]) {
    const slot = identity?.[family];
    const keyRaw = slot?.optionKey;
    if (!keyRaw) continue;
    const key = normalizeOptionKey(keyRaw);
    const def = REFINED_OPTIONS?.[family]?.[key];
    if (!def) continue;
    out.push({
      family,
      optionKey: key,
      l1: def.l1 || null,
      l2: def.l2 || null,
      stacking: def.stacking || null
    });
  }
  return out;
}

/* ---------------------------------------
 * Shared helpers
 * ------------------------------------ */

function N(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }

function blankOps(){
  return {
    violence:0, nonlethal:0, intrigue:0, economy:0, softpower:0,
    diplomacy:0, logistics:0, culture:0, faith:0
  };
}

function addInto(a,b){
  for (const k of OP_KEYS) a[k] = N(a[k]) + N(b?.[k]);
  return a;
}

function sum(o){
  return OP_KEYS.reduce((n,k)=>n + N(o?.[k]), 0);
}

function normAny(src = {}) {
  const out = blankOps();
  for (const key of OP_KEYS) {
    for (const alias of ALIASES[key]) {
      if (src?.[alias] !== undefined) { out[key] = N(src[alias]); break; }
    }
  }
  return out;
}

function isPlain(o){ return o && typeof o === "object" && !Array.isArray(o); }

/** Depth-limited object scan for embedded ops/bonuses-like shapes. */
function scanForOps(obj, depth=0, maxDepth=3) {
  if (!isPlain(obj) || depth > maxDepth) return blankOps();
  let out = blankOps();

  const maybe = normAny(obj);
  if (sum(maybe) !== 0) addInto(out, maybe);

  let i = 0;
  for (const [k, v] of Object.entries(obj)) {
    if (!isPlain(v)) continue;
    if (/(ops|OPs|bonuses|bbttcc|bonus)$/i.test(k) || i < 10) {
      addInto(out, scanForOps(v, depth+1, maxDepth));
      i++;
    }
  }
  return out;
}

/** Active Effects: accept any key that ends with ".<bucket>" (aliases ok). */
function scanAEForOps(effects = []) {
  const out = blankOps();
  for (const ef of effects ?? []) {
    for (const ch of ef.changes ?? []) {
      const key = String(ch.key ?? "");
      const val = N(ch.value);
      if (!Number.isFinite(val) || val === 0) continue;

      const low = key.toLowerCase();
      for (const bucket of OP_KEYS) {
        if (low.endsWith(`.${bucket}`)) out[bucket] = N(out[bucket]) + val;
      }
      for (const [bucket, alist] of Object.entries(ALIASES)) {
        if (alist.some(a => low.endsWith(`.${a.toLowerCase()}`))) {
          out[bucket] = N(out[bucket]) + val;
        }
      }
    }
  }
  return out;
}

/* ---------------------------------------
 * OP calculator: recalcAll / recalcActor
 * ------------------------------------ */

async function recalcAll() {
  const results = {};
  const actors = game.actors?.contents ?? [];
  for (const a of actors) {
    if ((a?.type ?? "").toLowerCase() === "faction") continue;
    results[a.id] = await recalcActor(a);
  }
  ui?.notifications?.info?.(`${MOD}: recalculated OPs for ${Object.keys(results).length} actors.`);
  return results;
}

/** Make a deep-ish copy of actor.flags and **remove** derived fields we write. */
function scrubActorFlags(flags) {
  try {
    const clone = JSON.parse(JSON.stringify(flags ?? {}));
    if (clone?.[MOD]?.calculatedOPs) delete clone[MOD].calculatedOPs;
    return clone;
  } catch {
    return {};
  }
}

async function recalcActor(actorOrId) {
  const actor = typeof actorOrId === "string" ? game.actors.get(actorOrId) : actorOrId;
  if (!actor) { warn("recalcActor — no actor", actorOrId); return blankOps(); }

  const dbg = { items: [], flagsHit: false, sysHit: false, aeHit: false };

  const actorFlagsOps  = scanForOps(scrubActorFlags(actor.flags));
  const actorSystemOps = scanForOps(actor.system ?? {});
  if (sum(actorFlagsOps))  dbg.flagsHit = true;
  if (sum(actorSystemOps)) dbg.sysHit   = true;

  const itemOpsTotal = blankOps();
  for (const it of actor.items.contents) {
    const hit = { name: it.name, flags:0, system:0, effects:0 };

    const bco = it.flags?.[MOD];
    if (isPlain(bco)) {
      const opsFast  = normAny(bco.ops     || {});
      const bonFast  = normAny(bco.bonuses || {});
      if (sum(opsFast)) addInto(itemOpsTotal, opsFast);
      if (sum(bonFast)) addInto(itemOpsTotal, bonFast);
      hit.flags += sum(opsFast) + sum(bonFast);
    }

    const fopsDeep = scanForOps(it.flags ?? {});
    if (sum(fopsDeep)) { addInto(itemOpsTotal, fopsDeep); hit.flags += sum(fopsDeep); }

    const sops = scanForOps(it.system ?? {});
    if (sum(sops)) { addInto(itemOpsTotal, sops); hit.system = sum(sops); }

    const eops = scanAEForOps(it.effects ?? []);
    if (sum(eops)) { addInto(itemOpsTotal, eops); hit.effects = sum(eops); }

    if (hit.flags || hit.system || hit.effects) dbg.items.push(hit);
  }

  const actorAE = scanAEForOps(actor.effects ?? []);
  if (sum(actorAE)) dbg.aeHit = true;

  let total = blankOps();
  addInto(total, actorFlagsOps);
  addInto(total, actorSystemOps);
  addInto(total, itemOpsTotal);
  addInto(total, actorAE);

  await actor.setFlag(MOD, "calculatedOPs", total);

  const itemCount = dbg.items.length;
  const itemSum = sum(itemOpsTotal);
  log(
    `recalcActor ${actor.name} → total=${sum(total)} (actorFlags=${sum(actorFlagsOps)}, actorSystem=${sum(actorSystemOps)}, items=${itemSum} in ${itemCount} item(s), actorAE=${sum(actorAE)})`,
    total
  );

  Hooks.callAll("bbttcc:opsRecalculated", actor, foundry.utils.deepClone(total));
  return total;
}

/* ---------------------------------------
 * Identity API
 * ------------------------------------ */

// (…leave the remainder of your original file exactly as-is…)
// NOTE: For brevity here, this replacement expects you to keep the rest of your existing module.js
// content unchanged BELOW this point in your file.


/* ---------------------------------------
 * Identity API
 * ------------------------------------ */

function getIdentityFlags(actorOrId) {
  const actor = typeof actorOrId === "string" ? game.actors.get(actorOrId) : actorOrId;
  if (!actor) {
    warn("getIdentityFlags — no actor", actorOrId);
    return {};
  }
  const raw = actor.getFlag(MOD, "identity") || {};
  return isPlain(raw) ? foundry.utils.deepClone(raw) : {};
}

async function setIdentityFlags(actorOrId, partial = {}) {
  const actor = typeof actorOrId === "string" ? game.actors.get(actorOrId) : actorOrId;
  if (!actor) {
    warn("setIdentityFlags — no actor", actorOrId);
    return {};
  }

  const current = getIdentityFlags(actor);
  let next;

  if (foundry?.utils?.mergeObject) {
    next = foundry.utils.mergeObject(current, partial, { inplace: false, overwrite: true });
  } else {
    next = { ...current, ...partial };
  }

  await actor.setFlag(MOD, "identity", next);
  return next;
}

/**
 * Given a total character level, return a tier number for level-based options.
 *  1–4 → 1, 5–10 → 2, 11–16 → 3, 17+ → 4
 */
function getTierForLevel(level) {
  const L = Number(level) || 0;
  if (L >= 17) return 4;
  if (L >= 11) return 3;
  if (L >= 5)  return 2;
  return 1;
}

/**
 * Best-effort “what level is this character?” helper.
 */
function inferLevelFromActor(actor) {
  if (!actor) return 0;

  const sys = actor.system ?? {};
  const candidates = [
    sys.details?.level,
    sys.details?.level?.value,
    sys.details?.levels,
    sys.details?.levels?.value,
    sys.classesTotal,
    sys.classes?.levels
  ];

  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return 0;
}

/* ---------------------------------------
 * Tier Engine — helpers
 * ------------------------------------ */

function slugifyName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/^archetype:\s*/, "")
    .replace(/^crew type:\s*/, "")
    .replace(/^occult association:\s*/, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildTierNameVariants(prefix, displayName, tier) {
  return [
    `${prefix}: ${displayName} (Tier ${tier})`,
    `${prefix}: ${displayName} — Tier ${tier}`,
    `${prefix}: ${displayName} - Tier ${tier}`
  ];
}

function extractTierFromName(name) {
  const s = String(name || "");
  let m = s.match(/\(Tier\s+(\d+)\)/i);
  if (m) return Number(m[1]) || 0;
  m = s.match(/[—-]\s*Tier\s+(\d+)$/i);
  if (m) return Number(m[1]) || 0;
  return 0;
}

function getTierIdentifierStemFromBaseDoc(baseDoc, prefix, fallback) {
  const ident = String(baseDoc?.system?.identifier || "").trim();
  if (ident) {
    return ident
      .replace(new RegExp("^" + prefix + "[-_]", "i"), "")
      .replace(/[-_]t\d+$/i, "")
      .trim();
  }
  return slugifyName(fallback || "");
}

function buildTierIdentifier(prefix, stem, tier) {
  const s = String(stem || "").trim();
  if (!s) return null;
  return `${prefix}-${s}-t${tier}`;
}

/* ---------- Archetype helpers ---------- */

/**
 * Resolve the actor's archetype option from identity + pack.
 */
async function resolveArchetypeOptionGeneric(actor, identity) {
  const slot = identity?.archetype;
  if (!slot || !slot.pack || !(slot.id || slot.key)) {
    return {
      hasArchetype: false,
      identity,
      optionKey: null,
      displayName: null,
      packKey: null,
      baseDoc: null,
      identifierStem: null
    };
  }

  const packKey = slot.pack || PACK_ARCHETYPES;

  try {
    const pack = game.packs.get(packKey);
    if (!pack) {
      warn("resolveArchetypeOptionGeneric — pack not found", packKey);
      return {
        hasArchetype: false,
        identity,
        optionKey: null,
        displayName: null,
        packKey,
        baseDoc: null,
        identifierStem: null
      };
    }

    const docId = slot.id || slot.key;
    const baseDoc = await pack.getDocument(docId).catch(() => null);
    if (!baseDoc) {
      warn("resolveArchetypeOptionGeneric — base doc not found", { packKey, key: slot.key, id: slot.id });
      return {
        hasArchetype: false,
        identity,
        optionKey: null,
        displayName: null,
        packKey,
        baseDoc: null,
        identifierStem: null
      };
    }

    const baseName = String(baseDoc.name || "");
    const displayName = baseName.replace(/^Archetype:\s*/i, "").trim();

    const optFlags =
      baseDoc.getFlag?.(MOD, "option") ||
      baseDoc.getFlag?.("bbttcc-character-options", "option") ||
      {};

    const optionKey = slot.optionKey || optFlags.key || slugifyName(displayName);
    const identifierStem = getTierIdentifierStemFromBaseDoc(baseDoc, "archetype", optionKey || displayName);

    const patched = foundry.utils.mergeObject(identity, {
      archetype: {
        ...slot,
        key: baseDoc.id,
        id: baseDoc.id,
        optionKey,
        identifier: String(baseDoc.system?.identifier || slot.identifier || ""),
        displayName
      }
    }, { inplace: false, overwrite: true });

    await setIdentityFlags(actor, { archetype: patched.archetype });

    return {
      hasArchetype: true,
      identity: patched,
      optionKey,
      displayName,
      packKey,
      baseDoc,
      identifierStem
    };
  } catch (e) {
    warn("resolveArchetypeOptionGeneric error", e);
    return {
      hasArchetype: false,
      identity,
      optionKey: null,
      displayName: null,
      packKey: null,
      baseDoc: null,
      identifierStem: null
    };
  }
}

/**
 * Load a tier feat document for an archetype from its pack.
 */
async function loadArchetypeTierDoc(packKey, identifierStem, displayName, tier) {
  const expectedIdentifier = buildTierIdentifier("archetype", identifierStem, tier);
  const expectedNames = buildTierNameVariants("Archetype", displayName, tier);

  const pack = game.packs.get(packKey || PACK_ARCHETYPES);
  if (!pack) {
    warn("TierEngine[Archetype] — pack not found", packKey);
    return null;
  }

  try {
    const idx = await pack.getIndex({ fields: ["name", "type", "system.identifier"] });
    const entry =
      idx.find(e => {
        if (e.type !== "feat") return false;
        const ident = foundry.utils.getProperty(e, "system.identifier");
        return expectedIdentifier && ident === expectedIdentifier;
      }) ||
      idx.find(e => e.type === "feat" && expectedNames.includes(String(e.name || "")));

    if (!entry) {
      warn("TierEngine[Archetype] — tier item not found in index", {
        identifierStem,
        displayName,
        expectedIdentifier,
        expectedNames,
        tier
      });
      return null;
    }

    const doc = await pack.getDocument(entry._id).catch(() => null);
    if (!doc) {
      warn("TierEngine[Archetype] — tier document is null", entry._id);
      return null;
    }
    return doc;
  } catch (e) {
    warn("TierEngine[Archetype] — loadArchetypeTierDoc failed", e);
    return null;
  }
}

/**
 * Ensure the actor has archetype tier feats for all tiers <= currentTier,
 * and none with tier > currentTier.
 */
async function ensureArchetypeTierFeats(actor, identity, tier) {
  if (!tier || tier < 1 || tier > 4) return;

  const {
    hasArchetype,
    optionKey,
    displayName,
    packKey,
    identity: patched,
    identifierStem
  } = await resolveArchetypeOptionGeneric(actor, identity);

  if (!hasArchetype || !optionKey) return patched ?? identity;

  const items = actor.items?.contents ?? actor.items ?? [];

  const archetypeItems = items
    .map(it => {
      const optCO = it.flags?.["bbttcc-character-options"]?.option;
      const opt   = optCO || it.flags?.[MOD]?.option || {};
      const ident = it.system?.identifier ?? "";
      const name  = it.name ?? "";

      const isThisArchetype =
        (opt?.category === "archetype" && opt?.key === optionKey) ||
        (typeof ident === "string" && identifierStem && ident.startsWith(`archetype-${identifierStem}`)) ||
        (/^Archetype:\s*/i.test(name) && name.includes(displayName));

      if (!isThisArchetype) return null;

      let t = Number(opt?.tier);
      if (!Number.isFinite(t)) {
        t = extractTierFromName(name);
      }
      if (!Number.isFinite(t)) t = 0;

      return { it, tier: t, ident, name };
    })
    .filter(Boolean);

  const toDelete = archetypeItems.filter(w => w.tier > tier).map(w => w.it.id);
  if (toDelete.length) {
    log("TierEngine[Archetype] — deleting higher tier feats", {
      actor: actor.name,
      optionKey,
      currentTier: tier,
      ids: toDelete
    });
    await actor.deleteEmbeddedDocuments("Item", toDelete);
  }

  for (let t = 1; t <= tier; t++) {
    const tierAlready = archetypeItems.find(
      w => w.tier === t && !toDelete.includes(w.it.id)
    );
    if (tierAlready) continue;

    const doc = await loadArchetypeTierDoc(packKey, identifierStem, displayName, t);
    if (!doc) continue;

    const identNeeded = doc.system?.identifier ?? null;
    const nameNeeded  = doc.name;

    const dup = actor.items.find(it => {
      const i2 = it.system?.identifier ?? "";
      if (identNeeded && i2 === identNeeded) return true;
      if (it.name === nameNeeded) return true;
      return false;
    });
    if (dup) {
      log("TierEngine[Archetype] — skipped duplicate tier feat", {
        actor: actor.name,
        optionKey,
        tier: t,
        identifier: identNeeded,
        name: nameNeeded
      });
      continue;
    }

    log("TierEngine[Archetype] — attaching missing tier feat", {
      actor: actor.name,
      optionKey,
      tier: t,
      itemName: doc.name
    });

    await actor.createEmbeddedDocuments("Item", [doc.toObject()]);
  }

  return patched;
}

/* ---------- Crew helpers ---------- */

/**
 * Resolve the actor's crew option from identity + pack.
 */
async function resolveCrewOptionGeneric(actor, identity) {
  const slot = identity?.crew;
  if (!slot || !slot.pack || !(slot.id || slot.key)) {
    return {
      hasCrew: false,
      identity,
      optionKey: null,
      displayName: null,
      packKey: null,
      baseDoc: null,
      identifierStem: null
    };
  }

  const packKey = slot.pack || PACK_CREWTYPES;

  try {
    const pack = game.packs.get(packKey);
    if (!pack) {
      warn("resolveCrewOptionGeneric — pack not found", packKey);
      return {
        hasCrew: false,
        identity,
        optionKey: null,
        displayName: null,
        packKey,
        baseDoc: null,
        identifierStem: null
      };
    }

    const docId = slot.id || slot.key;
    const baseDoc = await pack.getDocument(docId).catch(() => null);
    if (!baseDoc) {
      warn("resolveCrewOptionGeneric — base doc not found", { packKey, key: slot.key, id: slot.id });
      return {
        hasCrew: false,
        identity,
        optionKey: null,
        displayName: null,
        packKey,
        baseDoc: null,
        identifierStem: null
      };
    }

    const baseName = String(baseDoc.name || "");
    const displayName = baseName.replace(/^Crew Type:\s*/i, "").trim();

    const optFlags =
      baseDoc.getFlag?.(MOD, "option") ||
      baseDoc.getFlag?.("bbttcc-character-options", "option") ||
      {};

    const optionKey = slot.optionKey || optFlags.key || slugifyName(displayName);
    const identifierStem = getTierIdentifierStemFromBaseDoc(baseDoc, "crew", optionKey || displayName);

    const patched = foundry.utils.mergeObject(identity, {
      crew: {
        ...slot,
        key: baseDoc.id,
        id: baseDoc.id,
        optionKey,
        identifier: String(baseDoc.system?.identifier || slot.identifier || ""),
        displayName
      }
    }, { inplace: false, overwrite: true });

    await setIdentityFlags(actor, { crew: patched.crew });

    return {
      hasCrew: true,
      identity: patched,
      optionKey,
      displayName,
      packKey,
      baseDoc,
      identifierStem
    };
  } catch (e) {
    warn("resolveCrewOptionGeneric error", e);
    return {
      hasCrew: false,
      identity,
      optionKey: null,
      displayName: null,
      packKey: null,
      baseDoc: null,
      identifierStem: null
    };
  }
}

/**
 * Load a tier feat document for a crew type from its pack.
 */
async function loadCrewTierDoc(packKey, identifierStem, displayName, tier) {
  const expectedIdentifier = buildTierIdentifier("crew", identifierStem, tier);
  const expectedNames = buildTierNameVariants("Crew Type", displayName, tier);

  const pack = game.packs.get(packKey || PACK_CREWTYPES);
  if (!pack) {
    warn("TierEngine[Crew] — pack not found", packKey);
    return null;
  }

  try {
    const idx = await pack.getIndex({ fields: ["name", "type", "system.identifier"] });
    const entry =
      idx.find(e => {
        if (e.type !== "feat") return false;
        const ident = foundry.utils.getProperty(e, "system.identifier");
        return expectedIdentifier && ident === expectedIdentifier;
      }) ||
      idx.find(e => e.type === "feat" && expectedNames.includes(String(e.name || "")));

    if (!entry) {
      warn("TierEngine[Crew] — tier item not found in index", {
        identifierStem,
        displayName,
        expectedIdentifier,
        expectedNames,
        tier
      });
      return null;
    }

    const doc = await pack.getDocument(entry._id).catch(() => null);
    if (!doc) {
      warn("TierEngine[Crew] — tier document is null", entry._id);
      return null;
    }
    return doc;
  } catch (e) {
    warn("TierEngine[Crew] — loadCrewTierDoc failed", e);
    return null;
  }
}

/**
 * Ensure the actor has crew tier feats for all tiers <= currentTier,
 * and none with tier > currentTier.
 */
async function ensureCrewTierFeats(actor, identity, tier) {
  if (!tier || tier < 1 || tier > 4) return;

  const {
    hasCrew,
    optionKey,
    displayName,
    packKey,
    identity: patched,
    identifierStem
  } = await resolveCrewOptionGeneric(actor, identity);

  if (!hasCrew || !optionKey) return patched ?? identity;

  const items = actor.items?.contents ?? actor.items ?? [];

  const crewItems = items
    .map(it => {
      const optCO = it.flags?.["bbttcc-character-options"]?.option;
      const opt   = optCO || it.flags?.[MOD]?.option || {};
      const ident = it.system?.identifier ?? "";
      const name  = it.name ?? "";

      const isThisCrew =
        (opt?.category === "crew" && opt?.key === optionKey) ||
        (typeof ident === "string" && identifierStem && ident.startsWith(`crew-${identifierStem}`)) ||
        (/^Crew Type:\s*/i.test(name) && name.includes(displayName));

      if (!isThisCrew) return null;

      let t = Number(opt?.tier);
      if (!Number.isFinite(t)) {
        t = extractTierFromName(name);
      }
      if (!Number.isFinite(t)) t = 0;

      return { it, tier: t, ident, name };
    })
    .filter(Boolean);

  const toDelete = crewItems.filter(w => w.tier > tier).map(w => w.it.id);
  if (toDelete.length) {
    log("TierEngine[Crew] — deleting higher tier feats", {
      actor: actor.name,
      optionKey,
      currentTier: tier,
      ids: toDelete
    });
    await actor.deleteEmbeddedDocuments("Item", toDelete);
  }

  for (let t = 1; t <= tier; t++) {
    const tierAlready = crewItems.find(
      w => w.tier === t && !toDelete.includes(w.it.id)
    );
    if (tierAlready) continue;

    const doc = await loadCrewTierDoc(packKey, identifierStem, displayName, t);
    if (!doc) continue;

    const identNeeded = doc.system?.identifier ?? null;
    const nameNeeded  = doc.name;

    const dup = actor.items.find(it => {
      const i2 = it.system?.identifier ?? "";
      if (identNeeded && i2 === identNeeded) return true;
      if (it.name === nameNeeded) return true;
      return false;
    });
    if (dup) {
      log("TierEngine[Crew] — skipped duplicate tier feat", {
        actor: actor.name,
        optionKey,
        tier: t,
        identifier: identNeeded,
        name: nameNeeded
      });
      continue;
    }

    log("TierEngine[Crew] — attaching missing tier feat", {
      actor: actor.name,
      optionKey,
      tier: t,
      itemName: doc.name
    });

    await actor.createEmbeddedDocuments("Item", [doc.toObject()]);
  }

  return patched;
}

/* ---------- Occult helpers ---------- */

/**
 * Resolve the actor's occult association option from identity + pack.
 */
async function resolveOccultOptionGeneric(actor, identity) {
  const slot = identity?.occult;
  if (!slot || !slot.pack || !(slot.id || slot.key)) {
    return {
      hasOccult: false,
      identity,
      optionKey: null,
      displayName: null,
      packKey: null,
      baseDoc: null,
      identifierStem: null
    };
  }

  const packKey = slot.pack || PACK_OCCULT;

  try {
    const pack = game.packs.get(packKey);
    if (!pack) {
      warn("resolveOccultOptionGeneric — pack not found", packKey);
      return {
        hasOccult: false,
        identity,
        optionKey: null,
        displayName: null,
        packKey,
        baseDoc: null,
        identifierStem: null
      };
    }

    const docId = slot.id || slot.key;
    const baseDoc = await pack.getDocument(docId).catch(() => null);
    if (!baseDoc) {
      warn("resolveOccultOptionGeneric — base doc not found", { packKey, key: slot.key, id: slot.id });
      return {
        hasOccult: false,
        identity,
        optionKey: null,
        displayName: null,
        packKey,
        baseDoc: null,
        identifierStem: null
      };
    }

    const baseName = String(baseDoc.name || "");
    const displayName = baseName.replace(/^Occult Association:\s*/i, "").trim();

    const optFlags =
      baseDoc.getFlag?.(MOD, "option") ||
      baseDoc.getFlag?.("bbttcc-character-options", "option") ||
      {};

    const optionKey = slot.optionKey || optFlags.key || slugifyName(displayName);
    const identifierStem = getTierIdentifierStemFromBaseDoc(baseDoc, "occult", optionKey || displayName);

    const patched = foundry.utils.mergeObject(identity, {
      occult: {
        ...slot,
        key: baseDoc.id,
        id: baseDoc.id,
        optionKey,
        identifier: String(baseDoc.system?.identifier || slot.identifier || ""),
        displayName
      }
    }, { inplace: false, overwrite: true });

    await setIdentityFlags(actor, { occult: patched.occult });

    return {
      hasOccult: true,
      identity: patched,
      optionKey,
      displayName,
      packKey,
      baseDoc,
      identifierStem
    };
  } catch (e) {
    warn("resolveOccultOptionGeneric error", e);
    return {
      hasOccult: false,
      identity,
      optionKey: null,
      displayName: null,
      packKey: null,
      baseDoc: null,
      identifierStem: null
    };
  }
}

/**
 * Load a tier feat document for an occult association from its pack.
 */
async function loadOccultTierDoc(packKey, identifierStem, displayName, tier) {
  const expectedIdentifier = buildTierIdentifier("occult", identifierStem, tier);
  const expectedNames = buildTierNameVariants("Occult Association", displayName, tier);

  const pack = game.packs.get(packKey || PACK_OCCULT);
  if (!pack) {
    warn("TierEngine[Occult] — pack not found", packKey);
    return null;
  }

  try {
    const idx = await pack.getIndex({ fields: ["name", "type", "system.identifier"] });
    const entry =
      idx.find(e => {
        if (e.type !== "feat") return false;
        const ident = foundry.utils.getProperty(e, "system.identifier");
        return expectedIdentifier && ident === expectedIdentifier;
      }) ||
      idx.find(e => e.type === "feat" && expectedNames.includes(String(e.name || "")));

    if (!entry) {
      warn("TierEngine[Occult] — tier item not found in index", {
        identifierStem,
        displayName,
        expectedIdentifier,
        expectedNames,
        tier
      });
      return null;
    }

    const doc = await pack.getDocument(entry._id).catch(() => null);
    if (!doc) {
      warn("TierEngine[Occult] — tier document is null", entry._id);
      return null;
    }
    return doc;
  } catch (e) {
    warn("TierEngine[Occult] — loadOccultTierDoc failed", e);
    return null;
  }
}

/**
 * Ensure the actor has occult tier feats for all tiers <= currentTier,
 * and none with tier > currentTier.
 */
async function ensureOccultTierFeats(actor, identity, tier) {
  if (!tier || tier < 1 || tier > 4) return;

  const {
    hasOccult,
    optionKey,
    displayName,
    packKey,
    identity: patched,
    identifierStem
  } = await resolveOccultOptionGeneric(actor, identity);

  if (!hasOccult || !optionKey) return patched ?? identity;

  const items = actor.items?.contents ?? actor.items ?? [];

  const occultItems = items
    .map(it => {
      const optCO = it.flags?.["bbttcc-character-options"]?.option;
      const opt   = optCO || it.flags?.[MOD]?.option || {};
      const ident = it.system?.identifier ?? "";
      const name  = it.name ?? "";

      const isThisOccult =
        (opt?.category === "occult" && opt?.key === optionKey) ||
        (typeof ident === "string" && identifierStem && ident.startsWith(`occult-${identifierStem}`)) ||
        (/^Occult Association:\s*/i.test(name) && name.includes(displayName));

      if (!isThisOccult) return null;

      let t = Number(opt?.tier);
      if (!Number.isFinite(t)) {
        t = extractTierFromName(name);
      }
      if (!Number.isFinite(t)) t = 0;

      return { it, tier: t, ident, name };
    })
    .filter(Boolean);

  const toDelete = occultItems.filter(w => w.tier > tier).map(w => w.it.id);
  if (toDelete.length) {
    log("TierEngine[Occult] — deleting higher tier feats", {
      actor: actor.name,
      optionKey,
      currentTier: tier,
      ids: toDelete
    });
    await actor.deleteEmbeddedDocuments("Item", toDelete);
  }

  for (let t = 1; t <= tier; t++) {
    const tierAlready = occultItems.find(
      w => w.tier === t && !toDelete.includes(w.it.id)
    );
    if (tierAlready) continue;

    const doc = await loadOccultTierDoc(packKey, identifierStem, displayName, t);
    if (!doc) continue;

    const identNeeded = doc.system?.identifier ?? null;
    const nameNeeded  = doc.name;

    const dup = actor.items.find(it => {
      const i2 = it.system?.identifier ?? "";
      if (identNeeded && i2 === identNeeded) return true;
      if (it.name === nameNeeded) return true;
      return false;
    });
    if (dup) {
      log("TierEngine[Occult] — skipped duplicate tier feat", {
        actor: actor.name,
        optionKey,
        tier: t,
        identifier: identNeeded,
        name: nameNeeded
      });
      continue;
    }

    log("TierEngine[Occult] — attaching missing tier feat", {
      actor: actor.name,
      optionKey,
      tier: t,
      itemName: doc.name
    });

    await actor.createEmbeddedDocuments("Item", [doc.toObject()]);
  }

  return patched;
}

/* ---------------------------------------
 * Tier Engine — main entrypoint
 * ------------------------------------ */

async function syncOptionTiers(actorOrId, opts = {}) {
  const actor = typeof actorOrId === "string" ? game.actors.get(actorOrId) : actorOrId;
  if (!actor) {
    warn("syncOptionTiers — no actor", actorOrId);
    return { level: 0, tier: 1 };
  }
  if ((actor.type ?? "").toLowerCase() !== "character") {
    return { level: 0, tier: 1 };
  }

  const key = actor.id ?? actor.uuid ?? actor.name;
  if (_tierSyncActive.has(key)) {
    log("syncOptionTiers — already running for actor, skipping extra call", { actor: actor.name });
    const levelExisting = inferLevelFromActor(actor);
    const tierExisting  = getTierForLevel(levelExisting);
    return { level: levelExisting, tier: tierExisting, identity: getIdentityFlags(actor) };
  }

  _tierSyncActive.add(key);
  try {
    const level = inferLevelFromActor(actor);
    const tier  = getTierForLevel(level);

    const before = getIdentityFlags(actor);
    const next   = foundry.utils.deepClone(before);

    const LEVEL_FAMILIES = ["archetype", "crew", "occult", "political"];

    let changed = false;
    for (const slot of LEVEL_FAMILIES) {
      if (!next[slot]) continue;
      const prevTier = next[slot].currentTier;
      if (prevTier !== tier) {
        next[slot].currentTier = tier;
        changed = true;
      }
    }

    if (changed) {
      await actor.setFlag(MOD, "identity", next);
    }

    try {
      await ensureArchetypeTierFeats(actor, next, tier);
    } catch (e) {
      warn("syncOptionTiers — ensureArchetypeTierFeats error", e);
    }

    try {
      await ensureCrewTierFeats(actor, next, tier);
    } catch (e) {
      warn("syncOptionTiers — ensureCrewTierFeats error", e);
    }

    try {
      await ensureOccultTierFeats(actor, next, tier);
    } catch (e) {
      warn("syncOptionTiers — ensureOccultTierFeats error", e);
    }

    if (!opts?.silent) {
      log(`syncOptionTiers — ${actor.name} (level=${level}) → tier=${tier}`, {
        families: LEVEL_FAMILIES,
        changed,
        identity: next
      });
    }

    return { level, tier, identity: next };
  } finally {
    _tierSyncActive.delete(key);
  }
}

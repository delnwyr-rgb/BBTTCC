// Fourth Thing — bbttcc-bridge.js  v0.1.0
// Sprint C: BBTTCC Bridge
//
// All functions are defensive — every call is guarded by bbttccActive().
// Fourth Thing works fully standalone when bbttcc-auto-link is not loaded.

// ─── Guard ───────────────────────────────────────────────────────────────────

function bbttccActive() {
  // V14: game.modules.get().active is unreliable — check the API namespace directly
  return !!game.bbttcc?.api;
}

// ─── Shared bridge helpers ─────────────────────────────────────────────────────

function ftUniqueStrings(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map(v => String(v ?? "").trim())
    .filter(Boolean)));
}

function ftSplitAssetText(value) {
  return String(value ?? "")
    .split(/\r?\n|,/)
    .map(v => v.trim())
    .filter(Boolean);
}

function ftNormalizeAssetName(value, kind = "crew") {
  let out = String(value ?? "").trim();
  if (!out) return "";
  if (kind === "crew") {
    out = out.replace(/^Crew Type:\s*/i, "");
    out = out.replace(/^Awesome Crew:\s*/i, "");
  } else {
    out = out.replace(/^Occult Association:\s*/i, "");
    out = out.replace(/^Occult:\s*/i, "");
  }
  // Strip "(Tier N)" / "(T N)" suffix so a base feat + its tier-N power
  // collapse to a single canonical name (e.g. "Covert Ops Cell (Tier 1)" →
  // "Covert Ops Cell"). The crew/occult IDENTITY is the same regardless of
  // which tier powers the steward has unlocked.
  out = out.replace(/\s*\((?:Tier|T)\s*\d+\)\s*$/i, "");
  return out.trim();
}

function ftScanActorForAssetNames(actor, kind = "crew") {
  const out = [];
  const namePattern = kind === "crew"
    ? /^(?:Crew Type|Awesome Crew):\s*/i
    : /^(?:Occult Association|Occult):\s*/i;
  const idPrefix = kind === "crew" ? "crew-" : "occult-";

  // Source 1: identity flag (set by character-options wizard)
  try {
    const co    = actor?.getFlag?.("bbttcc-character-options", "identity") ?? {};
    const coTop = actor?.flags?.["bbttcc-character-options"] ?? {};
    const flagBlocks = kind === "crew"
      ? [co.crew, coTop.crew, coTop.identity?.crew]
      : [co.occult, coTop.occult, coTop.identity?.occult];
    for (const blk of flagBlocks) {
      if (!blk) continue;
      const raw = blk.displayName ?? blk.name ?? blk.label ?? "";
      const stripped = ftNormalizeAssetName(raw, kind);
      if (stripped) out.push(stripped);
    }
  } catch (_e) {}

  // Source 2: embedded items (any item-type, since pack data sometimes
  // ships them as feat/feature but custom worlds may diverge)
  try {
    const items = actor?.items?.contents ?? Array.from(actor?.items ?? []);
    for (const it of items) {
      const nm = String(it?.name ?? "");
      const ident = String(it?.system?.identifier ?? "");
      if (namePattern.test(nm)) {
        const stripped = ftNormalizeAssetName(nm, kind);
        if (stripped) out.push(stripped);
      } else if (ident && ident.startsWith(idPrefix)) {
        const stripped = ftNormalizeAssetName(nm, kind);
        if (stripped) out.push(stripped);
      }
    }
  } catch (_e) {}

  return ftUniqueStrings(out);
}

function ftParseAssetBucket(value, kind = "crew") {
  if (value == null) return [];

  if (Array.isArray(value)) {
    const out = [];
    for (const entry of value) out.push(...ftParseAssetBucket(entry, kind));
    return ftUniqueStrings(out);
  }

  if (typeof value === "object") {
    if (value.name || value.displayName || value.label) {
      return ftUniqueStrings([ftNormalizeAssetName(value.displayName ?? value.name ?? value.label, kind)]);
    }

    if (Array.isArray(value.active) || Array.isArray(value.reserve)) {
      return ftUniqueStrings([
        ...ftParseAssetBucket(value.active ?? [], kind),
        ...ftParseAssetBucket(value.reserve ?? [], kind)
      ]);
    }
  }

  return ftUniqueStrings(ftSplitAssetText(value).map(v => ftNormalizeAssetName(v, kind)));
}

function ftTierToNumber(raw) {
  const value = (raw && typeof raw === "object")
    ? (raw.value ?? raw.key ?? raw.band ?? raw.tier ?? raw.level ?? null)
    : raw;

  if (value == null || value === "") return 0;

  const s = String(value).trim().toUpperCase();
  if (s === "A") return 0;
  if (s === "B") return 1;
  if (s === "C") return 2;

  const n = Number(s.replace(/^T/i, ""));
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}


const FT_PACK_KEYS = {
  archetype: "bbttcc-character-options.character-archetypes",
  sephirothicAlignment: "bbttcc-character-options.sephirothic-alignments",
  crew: "bbttcc-character-options.crew-types",
  occult: "bbttcc-character-options.occult-associations"
};

const FT_IDENTITY_SLOTS = {
  archetype: {
    pack: FT_PACK_KEYS.archetype,
    categories: ["character-archetypes", "archetype", "archetypes", "bbttcc-archetype"]
  },
  sephirothicAlignment: {
    pack: FT_PACK_KEYS.sephirothicAlignment,
    categories: ["sephirothic-alignments", "alignment", "alignments", "bbttcc-alignment"]
  }
};

const FT_POLITICAL_PHILOSOPHIES = [
  { key: "marxist",          label: "Marxist / Communist",      happiness: "Collective emancipation through eliminating exploitation and alienation.", suffering: "Exploitation, alienation, and manufactured scarcity." },
  { key: "liberal",          label: "Liberal",                   happiness: "Protected autonomy and consent under transparent rules.", suffering: "Rights violations, coercion, and exclusion from due process." },
  { key: "social_democratic",label: "Social Democratic",         happiness: "Material security, dignity, and preventable harm reduction.", suffering: "Preventable suffering, abandonment, and unchecked inequality." },
  { key: "libertarian",      label: "Libertarian",               happiness: "Freedom from coercion; voluntary association and exchange.", suffering: "Coercion, imposed authority, and forced redistribution." },
  { key: "authoritarian",    label: "Authoritarian / Statist",   happiness: "Order, predictability, and safety through hierarchy.", suffering: "Chaos, fragmentation, and disobedience." },
  { key: "theocratic",       label: "Theocratic",                happiness: "Alignment with transcendent moral truth.", suffering: "Heresy, corruption, and desecration." },
  { key: "fascist",          label: "Fascist",                   happiness: "Mythic unity, strength, and dominance.", suffering: "Weakness, pluralism, and dissent." },
  { key: "anarchist",        label: "Anarchist",                 happiness: "Mutual aid and voluntary cooperation without hierarchy.", suffering: "Domination, imposed hierarchy, and coercion." }
];

const FT_ENLIGHTENMENT_LEVELS = [
  { key: "unawakened",    label: "Unawakened" },
  { key: "awakening",     label: "Awakening" },
  { key: "seeking",       label: "Seeking" },
  { key: "wisdom",        label: "Wisdom" },
  { key: "understanding", label: "Understanding" },
  { key: "enlightened",   label: "Enlightened" },
  { key: "qliphothic",    label: "Qliphothic" }
];

const FT_ENLIGHTENMENT_ITEM_DATA = {
  unawakened:   { name: "Enlightenment: Unawakened",   type: "feat", img: "systems/dnd5e/icons/svg/items/feature.svg", flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { economy: 1 } } } },
  awakening:    { name: "Enlightenment: Awakening",    type: "feat", img: "systems/dnd5e/icons/svg/items/feature.svg", flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { intrigue: 1, softpower: 1 } } } },
  seeking:      { name: "Enlightenment: Seeking",      type: "feat", img: "systems/dnd5e/icons/svg/items/feature.svg", flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { intrigue: 1, softpower: 2 } } } },
  wisdom:       { name: "Enlightenment: Wisdom",       type: "feat", img: "systems/dnd5e/icons/svg/items/feature.svg", flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { diplomacy: 1, intrigue: 1, softpower: 1 } } } },
  understanding:{ name: "Enlightenment: Understanding",type: "feat", img: "systems/dnd5e/icons/svg/items/feature.svg", flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { softpower: 2, diplomacy: 1 } } } },
  enlightened:  { name: "Enlightenment: Enlightened",  type: "feat", img: "systems/dnd5e/icons/svg/items/feature.svg", flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { diplomacy: 3, softpower: 2 } } } },
  qliphothic:   { name: "Enlightenment: Qliphothic",   type: "feat", img: "systems/dnd5e/icons/svg/items/feature.svg", flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { violence: 2, intrigue: 2 } } } }
};

function ftLabelForPoliticalPhilosophy(key) {
  return FT_POLITICAL_PHILOSOPHIES.find(p => p.key === String(key ?? ""))?.label ?? String(key ?? "").trim();
}

function ftGetPoliticalPhilosophyDef(key) {
  return FT_POLITICAL_PHILOSOPHIES.find(p => p.key === String(key ?? "")) ?? null;
}

function ftLabelForEnlightenment(key) {
  return FT_ENLIGHTENMENT_LEVELS.find(x => x.key === String(key ?? ""))?.label ?? "Unawakened";
}

function ftFactionActors() {
  return (game.actors?.contents ?? [])
    .filter(a => {
      const sys = a.system?.system ?? a.system ?? {};
      return a.getFlag?.("bbttcc-factions", "isFaction") === true || String(sys?.details?.type?.value ?? sys?.details?.type ?? "").toLowerCase() === "faction";
    })
    .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
}

function ftResolveFactionLink(actor) {
  const rawSys = actor?.system?.system ?? actor?.system ?? {};
  const factionId = rawSys?.faction?.id ?? actor?.getFlag?.("bbttcc-factions", "factionId") ?? null;
  if (factionId) {
    const faction = game.bbttcc?.api?.factions?.get?.(factionId) ?? game.actors?.get?.(factionId) ?? null;
    if (faction) return { id: faction.id, name: faction.name, actor: faction };
  }

  const legacyName = String(rawSys?.faction?.name ?? actor?.getFlag?.("bbttcc-territory", "faction") ?? actor?.flags?.["bbttcc-territory"]?.faction ?? "").trim();
  if (legacyName) {
    const match = ftFactionActors().find(f => String(f.name ?? "") === legacyName) ?? null;
    if (match) return { id: match.id, name: match.name, actor: match };
    return { id: "", name: legacyName, actor: null };
  }

  return { id: factionId ?? "", name: "", actor: null };
}

function ftIsBaseOptionEntry(entry) {
  const name = String(entry?.name ?? "").trim();
  return !/(?:\(\s*Tier\s+\d+\s*\)|[—-]\s*Tier\s+\d+)$/i.test(name);
}

async function ftIndexIdentityPack(key) {
  const pack = game.packs?.get(key);
  if (!pack) return [];
  const idx = await pack.getIndex({ fields: ["name", "type"] });
  return idx
    .filter(e => ["feat", "feat5e", "featv2", "featV2", "feat-5e"].includes(e.type))
    .filter(ftIsBaseOptionEntry)
    .map(({ _id, name }) => ({ id: _id, name }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

// Index a crew/occult pack — same as ftIndexIdentityPack but strips the
// "Crew Type: " / "Occult Association: " prefix from display names.
async function ftIndexEchoAssetPack(key, kind = "crew") {
  const pack = game.packs?.get(key);
  if (!pack) return [];
  try {
    const idx = await pack.getIndex({ fields: ["name", "type"] });
    return idx
      .filter(e => ["feat", "feat5e", "featv2", "featV2", "feat-5e"].includes(e.type))
      .filter(ftIsBaseOptionEntry)
      .map(({ _id, name }) => ({
        id: _id,
        name: ftNormalizeAssetName(name, kind),
        rawName: name
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  } catch (err) {
    console.warn(`Fourth Thing | ftIndexEchoAssetPack(${key}) failed:`, err);
    return [];
  }
}

// ─── Class / Ancestry / Subclass — pack indexing + swap helpers ──────────────
// Subclasses live in the `classes` pack alongside their parents (type="subclass").
// Ancestries live in `ancestries` (type can be "species" or legacy "race").

const FT_ID_PACK_CLASSES    = "bbttcc-master-content.classes";
const FT_ID_PACK_ANCESTRIES = "bbttcc-master-content.ancestries";

async function ftIndexItemPackByType(packKey, allowedTypes) {
  const pack = game.packs?.get(packKey);
  if (!pack) return [];
  try {
    const idx = await pack.getIndex({ fields: ["name", "type", "system.identifier", "system.classIdentifier"] });
    const allow = new Set(Array.isArray(allowedTypes) ? allowedTypes : [allowedTypes]);
    return idx
      .filter(e => allow.has(e.type))
      .map(e => ({
        id: e._id,
        name: e.name,
        identifier: e.system?.identifier ?? "",
        classIdentifier: e.system?.classIdentifier ?? ""
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  } catch (err) {
    console.warn(`Fourth Thing | ftIndexItemPackByType(${packKey}, ${allowedTypes}) failed:`, err);
    return [];
  }
}

// Index playable heritages (root heritage feats) from a pack. Detection
// covers two authored shapes:
//   1. Properly tagged heritage roots — type=feat with flags.bbttcc.kind ===
//      "heritage" (or identifier ending in "_heritage"). Examples: Cryptidkin
//      and Circuitborn (cryptidkin_chupacabra.json etc.).
//   2. Lineage tier-1 items used as the heritage root for species that don't
//      ship a separate root item (Sephirotic Scion, Menhirkin, Oldenborn,
//      Qliph Scarred). Identifier looks like "<species>_<lineage>_tier1"
//      with flags.bbttcc.kind === "<species>" (mirroring the species
//      identifier). For these we set family = species identifier so the
//      ancestry-family filter on the steward sheet matches.
// Returns { id, name, family } where family matches the species-root family
// used to filter the dropdown.
async function ftIndexHeritagePack(packKey) {
  const pack = game.packs?.get(packKey);
  if (!pack) return [];
  try {
    const idx = await pack.getIndex({ fields: ["name", "type", "system.identifier", "flags.bbttcc.kind", "flags.bbttcc.family"] });
    return idx
      .filter(e => {
        const t = String(e.type || "").toLowerCase();
        if (t !== "feat") return false;
        const sys = e.system || {};
        const identifier = String(sys.identifier ?? e["system.identifier"] ?? "").toLowerCase();
        const flags = (e.flags && e.flags.bbttcc) || {};
        const kind = String(flags.kind ?? e["flags.bbttcc.kind"] ?? "").toLowerCase();
        // Shape 1: explicit heritage root
        if (kind === "heritage" || identifier.endsWith("_heritage")) return true;
        // Shape 2: lineage tier-1 acting as the heritage root. kind names the
        // species (e.g. "sephirotic_scion"), identifier ends in "_tier1", and
        // identifier starts with the species identifier prefix.
        if (kind && identifier.endsWith("_tier1") && identifier.startsWith(`${kind}_`)) return true;
        return false;
      })
      .map(e => {
        const sys = e.system || {};
        const identifier = String(sys.identifier ?? e["system.identifier"] ?? "").toLowerCase();
        const flags = (e.flags && e.flags.bbttcc) || {};
        const kind = String(flags.kind ?? e["flags.bbttcc.kind"] ?? "").toLowerCase();
        let family = String(flags.family ?? e["flags.bbttcc.family"] ?? "").toLowerCase();
        if (!family) {
          // Lineage tier-1 shape: family = the kind/species identifier so the
          // sheet's ancestry-family filter matches the embedded species's
          // identifier (sephirotic_scion, menhirkin, etc.).
          if (kind && identifier.endsWith("_tier1") && identifier.startsWith(`${kind}_`)) {
            family = kind;
          } else {
            const m = identifier.match(/^([a-z0-9]+)_/);
            if (m) family = m[1];
          }
        }
        return { id: e._id, name: e.name, family };
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  } catch (err) {
    console.warn(`Fourth Thing | ftIndexHeritagePack(${packKey}) failed:`, err);
    return [];
  }
}

// Extract the trailing item id from a compendium UUID. Example input:
// "Compendium.bbttcc-master-content.classes.Item.V7fpwepCDoqUdT1O" → "V7fpwepCDoqUdT1O"
function ftIdFromUuid(uuid) {
  const parts = String(uuid ?? "").split(".");
  return parts[parts.length - 1] || "";
}

/**
 * Swap (or clear) the embedded item of a given type on an actor, and update
 * the BBTTCC nativeLinks flag so the header pills reflect the new choice.
 *
 * @param {Actor} actor
 * @param {object} cfg  { types, packKey, flagName, flagUuid, flagApplied }
 * @param {string|null} newKey  compendium item id, or empty/null to clear.
 */
async function ftSwapEmbeddedByType(actor, cfg, newKey) {
  if (!actor) return null;
  const { types, packKey, flagName, flagUuid, flagApplied } = cfg;
  const typeSet = new Set(Array.isArray(types) ? types : [types]);
  const nextKey = String(newKey ?? "").trim();

  // Delete any currently-embedded items of the matching type(s).
  const existing = Array.from(actor.items ?? [])
    .filter(it => typeSet.has(it.type))
    .map(it => it.id);
  if (existing.length) await actor.deleteEmbeddedDocuments("Item", existing);

  // Clearing ("— None —") — just update flags and bail.
  if (!nextKey) {
    await actor.setFlag("bbttcc-character-options", "nativeLinks", {
      [flagName]:    "",
      [flagUuid]:    "",
      [flagApplied]: false
    });
    return null;
  }

  const pack = game.packs?.get(packKey);
  if (!pack) {
    ui.notifications?.error(`Missing pack: ${packKey}`);
    return null;
  }
  const doc = await pack.getDocument(nextKey);
  if (!doc) {
    ui.notifications?.error(`Could not resolve item ${nextKey} in ${packKey}`);
    return null;
  }

  await actor.createEmbeddedDocuments("Item", [doc.toObject()]);
  await actor.setFlag("bbttcc-character-options", "nativeLinks", {
    [flagName]:    doc.name,
    [flagUuid]:    `Compendium.${packKey}.Item.${nextKey}`,
    [flagApplied]: true
  });
  return doc;
}

// ── Atomic swap helpers shared by ancestry / class / subclass ──────────────
// Same three-pass cleanup pattern as applyActorHeritageChange: delete ALL
// items whose name prefix or lineage flag doesn't match the NEW selection,
// then import the new doc + advancement grants and stamp lineage tags.

async function _ftFireCampaignStartFor(actor, createdItems) {
  // Mirrors the apply-starting-grants macro, scoped to specific items.
  const fired = actor.getFlag("fourththing", "startingGrantsFiredItems") ?? {};
  const firedClean = { ...fired };
  let dirty = false;
  const POOL = {
    "violence-op":"violence","intrigue-op":"intrigue","soft-power-op":"softpower",
    "diplomacy-op":"diplomacy","economy-op":"economy","non-lethal-op":"nonlethal",
    "faith-op":"faith","logistics-op":"logistics","siege-op":"siege","body-op":"body","soul-op":"soul"
  };
  for (const item of createdItems) {
    const grants = item.flags?.fourththing?.resourceGrants;
    if (!Array.isArray(grants)) continue;
    const starts = grants.filter(g => g.cadence === "per-campaign-start");
    if (!starts.length) continue;
    for (const g of starts) {
      try {
        if (typeof g.resource !== "string" || !g.resource.endsWith("-op")) continue;
        const factionId = actor.getFlag?.("bbttcc-factions", "factionId");
        const faction = factionId ? game.actors?.get(factionId) : null;
        if (!faction) continue;
        const pool = POOL[g.resource];
        if (!pool) continue;
        const bank = foundry.utils.duplicate(faction.flags?.["bbttcc-factions"]?.opBank ?? {});
        bank[pool] = (Number(bank[pool]) || 0) + Number(g.amount);
        await faction.update({ "flags.bbttcc-factions.opBank": bank });
      } catch (_e) { /* skip per-grant errors */ }
    }
    firedClean[item.id] = { firedAt: Date.now(), itemName: item.name, viaSwap: true };
    dirty = true;
  }
  return { firedClean, dirty };
}

async function _ftAtomicSwap(actor, cfg, newKey) {
  if (!actor) return null;
  const { types, packKey, flagName, flagUuid, flagApplied, lineageFlag, namePrefixMatch, label } = cfg;
  const typeSet = new Set(Array.isArray(types) ? types : [types]);
  const nextKey = String(newKey ?? "").trim();

  // Resolve NEW name first so cleanup can filter by it.
  let newName = "";
  if (nextKey) {
    const previewPack = game.packs?.get(packKey);
    const previewDoc  = previewPack ? await previewPack.getDocument(nextKey) : null;
    newName  = String(previewDoc?.name ?? "");
  }
  const newLower = newName.toLowerCase();

  // Aggressive cleanup — delete by type, lineage-mismatch, name-prefix-mismatch
  const toDeleteIds = new Set();
  for (const it of actor.items ?? []) {
    if (typeSet.has(it.type)) { toDeleteIds.add(it.id); continue; }
    const lineage = String(it?.flags?.fourththing?.[lineageFlag] ?? "").toLowerCase();
    if (lineage && lineage !== newLower) { toDeleteIds.add(it.id); continue; }
    if (namePrefixMatch && newLower) {
      const m = String(it.name ?? "").match(namePrefixMatch);
      if (m) {
        const matched = m[1].trim().toLowerCase();
        if (matched !== newLower) toDeleteIds.add(it.id);
      }
    }
  }
  const deletedIds = [...toDeleteIds];
  if (deletedIds.length) await actor.deleteEmbeddedDocuments("Item", deletedIds);

  // Drop orphan starting-grant fired-flag entries
  const fired = actor.getFlag("fourththing", "startingGrantsFiredItems") ?? {};
  const firedClean = { ...fired };
  let firedDirty = false;
  for (const id of deletedIds) {
    if (id in firedClean) { delete firedClean[id]; firedDirty = true; }
  }

  // Clear-only path
  if (!nextKey) {
    if (firedDirty) await actor.setFlag("fourththing", "startingGrantsFiredItems", firedClean);
    await actor.setFlag("bbttcc-character-options", "nativeLinks", {
      [flagName]: "", [flagUuid]: "", [flagApplied]: false
    });
    return null;
  }

  // Import new doc + advancement grants (level ≤ 1)
  const pack = game.packs?.get(packKey);
  if (!pack) { ui.notifications?.error(`Missing pack: ${packKey}`); return null; }
  const doc = await pack.getDocument(nextKey);
  if (!doc) { ui.notifications?.error(`Could not resolve ${label} ${nextKey} in ${packKey}`); return null; }

  const toCreate = [doc.toObject()];
  const advRaw = doc.system?.advancement ?? {};
  const advRows = Array.isArray(advRaw) ? advRaw : Object.values(advRaw);
  for (const row of advRows) {
    if (!row || row.type !== "ItemGrant") continue;
    if ((row.level ?? 0) > 1) continue;
    const entries = row.configuration?.items ?? [];
    for (const entry of entries) {
      try {
        const granted = await fromUuid(entry.uuid);
        if (!granted) continue;
        toCreate.push(granted.toObject());
      } catch (_e) {}
    }
  }

  const seen = new Set();
  const cleaned = [];
  for (const obj of toCreate) {
    const key = String(obj.type || "") + "::" + String(obj.name || "");
    if (seen.has(key)) continue;
    seen.add(key);
    const c = foundry.utils.deepClone(obj);
    delete c._id;
    foundry.utils.setProperty(c, `flags.fourththing.${lineageFlag}`, newName);
    cleaned.push(c);
  }
  const created = cleaned.length ? await actor.createEmbeddedDocuments("Item", cleaned) : [];

  // Fire per-campaign-start grants on newly-imported items
  const fireResult = await _ftFireCampaignStartFor(actor, created);
  for (const [id, payload] of Object.entries(fireResult.firedClean)) {
    firedClean[id] = payload;
  }
  if (fireResult.dirty || firedDirty) {
    await actor.setFlag("fourththing", "startingGrantsFiredItems", firedClean);
  }

  const uuid = `Compendium.${packKey}.Item.${nextKey}`;
  await actor.setFlag("bbttcc-character-options", "nativeLinks", {
    [flagName]: doc.name, [flagUuid]: uuid, [flagApplied]: true
  });

  if (deletedIds.length || created.length) {
    const msg = `<b>${actor.name}</b> ${label} swap → <b>${newName}</b>` +
      (deletedIds.length ? ` · removed ${deletedIds.length} stale` : "") +
      (created.length    ? ` · added ${created.length} new` : "");
    ChatMessage.create({
      user: game.user.id,
      content: `<p style="font-size:0.78rem">${msg}</p>`,
      whisper: [game.user.id]
    });
  }
  return doc;
}

export async function applyActorClassChange(actor, newKey) {
  // Cascade: clear subclass first (subclasses are class-specific)
  await applyActorSubclassChange(actor, "");
  return _ftAtomicSwap(actor, {
    types: "class",
    packKey: FT_ID_PACK_CLASSES,
    flagName: "className",
    flagUuid: "classUuid",
    flagApplied: "classApplied",
    lineageFlag: "grantedByClass",
    // Class-feature names look like "Bulwark — Tier 1: ..." — match prefix
    namePrefixMatch: /^([A-Z][a-zA-Z'\- ]+?)\s+—\s+Tier/,
    label: "class"
  }, newKey);
}

export async function applyActorAncestryChange(actor, newKey) {
  // Cascade: clear heritage first (heritages are ancestry-specific)
  await applyActorHeritageChange(actor, null);
  return _ftAtomicSwap(actor, {
    types: ["species", "race"],
    packKey: FT_ID_PACK_ANCESTRIES,
    flagName: "ancestryName",
    flagUuid: "speciesUuid",
    flagApplied: "ancestryApplied",
    lineageFlag: "grantedByAncestry",
    // Species cores: "Human: Stubborn Spark", "Menhirkin: ...", etc.
    namePrefixMatch: /^([A-Z][a-zA-Z'\-]+):\s/,
    label: "ancestry"
  }, newKey);
}

export async function applyActorSubclassChange(actor, newKey) {
  return _ftAtomicSwap(actor, {
    types: "subclass",
    packKey: FT_ID_PACK_CLASSES,
    flagName: "subclassName",
    flagUuid: "subclassUuid",
    flagApplied: "subclassApplied",
    lineageFlag: "grantedBySubclass",
    // Subclass-feature names look like "Avalanche L1: ...", "Wayfarer Tongue L17: ..."
    namePrefixMatch: /^([A-Z][a-zA-Z'\- ]+?)\s+L\d+:/,
    label: "subclass"
  }, newKey);
}

/**
 * Swap (or clear) the heritage feat on an actor — atomic version.
 *
 * Mirrors the wizard's heritage import flow AND cleans up after the previous
 * heritage so the dropdown is the source of truth (no stale residue from a
 * prior selection). Three-pass cleanup before adding the new heritage:
 *   1. Delete the OLD heritage wrapper (kind === "heritage")
 *   2. Delete items stamped with `flags.fourththing.grantedByHeritage === <old>`
 *      (canonical lineage tag — added on items created here going forward)
 *   3. Delete items whose name matches the legacy parenthetical pattern
 *      "<Family> (<oldHeritage>):" (catches items added before lineage tags
 *      existed — e.g. wizard-imports from older sessions)
 *
 * Newly-created items (heritage wrapper + tier ≤1 grants) are stamped with
 * `flags.fourththing.grantedByHeritage = <new heritage short name>` so the
 * NEXT swap can clean them up cleanly via pass 2 above.
 *
 * After items land, per-campaign-start resource grants on the new items fire
 * automatically, and the actor's `startingGrantsFiredItems` flag is updated
 * (entries for deleted items are cleared, entries for new items are stamped).
 *
 * @param {Actor} actor
 * @param {string|null} newKey  Compendium item id within the ancestries pack,
 *                              or empty/null to clear the current heritage.
 */
export async function applyActorHeritageChange(actor, newKey) {
  if (!actor) return null;
  const packKey = FT_ID_PACK_ANCESTRIES;
  const nextKey = String(newKey ?? "").trim();

  // ── Resolve the NEW heritage's short name FIRST so cleanup can filter by it ──
  // Two name shapes are supported, mirroring the indexer in ftIndexHeritagePack:
  //   • Cryptidkin / Circuitborn shape: "Heritage: Chupacabra" → "Chupacabra".
  //   • Sephirotic / Menhirkin / Oldenborn / Qliph shape: lineage tier-1 items
  //     named like "Sephirotic Scion (Cherubic): The Gate Knows You" — the
  //     parenthetical lineage is what the cleanup pass uses to identify
  //     same-lineage items, so we extract that.
  let newHeritageShort = "";
  if (nextKey) {
    const previewPack = game.packs?.get(packKey);
    const previewDoc  = previewPack ? await previewPack.getDocument(nextKey) : null;
    const rawName     = String(previewDoc?.name ?? "");
    const parenMatch  = rawName.match(/\(([^)]+)\)/);
    if (parenMatch) {
      newHeritageShort = parenMatch[1].trim();
    } else {
      newHeritageShort = rawName.replace(/^[^:]+Heritage:\s*/i, "").trim();
    }
  }
  const newLower = newHeritageShort.toLowerCase();

  // ── Aggressive cleanup ── delete ALL heritage residue that doesn't match
  //   the NEW heritage. Three signals:
  //     A. Heritage WRAPPER items (kind === "heritage") — always deleted; the
  //        new wrapper gets re-imported below.
  //     B. Items tagged `flags.fourththing.grantedByHeritage` whose tag
  //        doesn't match the new heritage (forward-compat lineage signal).
  //     C. Items whose name matches the legacy parenthetical pattern
  //        "<Family> (<Sub>):" where <Sub> doesn't match the new heritage —
  //        catches every pre-fix item from older sessions.
  //   Items with NO parenthetical and NO lineage tag are left alone (species
  //   cores like "Human: Stubborn Spark", subclasses, archetypes, etc.).
  const toDeleteIds = new Set();
  for (const it of actor.items ?? []) {
    const name  = String(it.name ?? "");
    const kind  = String(it?.flags?.bbttcc?.kind ?? "").toLowerCase();
    const ident = String(it?.system?.identifier ?? "").toLowerCase();
    const lineage = String(it?.flags?.fourththing?.grantedByHeritage ?? "").toLowerCase();

    // A. Wrapper — always delete (re-add the matching one below)
    if (kind === "heritage" || ident.endsWith("_heritage")) {
      toDeleteIds.add(it.id);
      continue;
    }
    // B. Lineage-tagged item not matching new heritage
    if (lineage && lineage !== newLower) {
      toDeleteIds.add(it.id);
      continue;
    }
    // C. Parenthetical pattern not matching new heritage
    const parenMatch = name.match(/^[^(]+\(([^)]+)\)\s*:/);
    if (parenMatch) {
      const sub = parenMatch[1].trim().toLowerCase();
      if (!newLower || sub !== newLower) {
        toDeleteIds.add(it.id);
      }
    }
  }
  const deletedIds = [...toDeleteIds];
  if (deletedIds.length) await actor.deleteEmbeddedDocuments("Item", deletedIds);

  // Clear orphaned startingGrantsFiredItems entries for deleted items
  const fired = actor.getFlag("fourththing", "startingGrantsFiredItems") ?? {};
  const firedClean = { ...fired };
  let firedDirty = false;
  for (const id of deletedIds) {
    if (id in firedClean) { delete firedClean[id]; firedDirty = true; }
  }

  // ── Clear-only path (dropdown set to "— None —") ───────────────────────────
  if (!nextKey) {
    if (firedDirty) await actor.setFlag("fourththing", "startingGrantsFiredItems", firedClean);
    await actor.setFlag("bbttcc-character-options", "heritageUuid", "");
    await actor.setFlag("bbttcc-character-options", "nativeLinks", {
      heritageName:    "",
      heritageUuid:    "",
      heritageApplied: false
    });
    return null;
  }

  // ── Resolve & import the new heritage + tier ≤1 grants ─────────────────────
  const pack = game.packs?.get(packKey);
  if (!pack) { ui.notifications?.error(`Missing pack: ${packKey}`); return null; }
  const doc = await pack.getDocument(nextKey);
  if (!doc) { ui.notifications?.error(`Could not resolve heritage ${nextKey} in ${packKey}`); return null; }
  // newHeritageShort already resolved above (used for cleanup filtering)

  const toCreate = [doc.toObject()];
  const advRaw = doc.system?.advancement ?? {};
  const advRows = Array.isArray(advRaw) ? advRaw : Object.values(advRaw);
  for (const row of advRows) {
    if (!row || row.type !== "ItemGrant") continue;
    if ((row.level ?? 0) > 1) continue;
    const entries = row.configuration?.items ?? [];
    for (const entry of entries) {
      try {
        const granted = await fromUuid(entry.uuid);
        if (!granted) continue;
        const obj = granted.toObject();
        foundry.utils.setProperty(obj, "flags.fourththing.principleSource", "ancestry");
        toCreate.push(obj);
      } catch (_e) { /* skip missing grant */ }
    }
  }

  // De-duplicate by (type, name); stamp lineage tag for clean future swaps.
  const seen = new Set();
  const cleaned = [];
  for (const obj of toCreate) {
    const key = String(obj.type || "") + "::" + String(obj.name || "");
    if (seen.has(key)) continue;
    seen.add(key);
    const c = foundry.utils.deepClone(obj);
    delete c._id;
    foundry.utils.setProperty(c, "flags.fourththing.grantedByHeritage", newHeritageShort);
    cleaned.push(c);
  }
  const created = cleaned.length ? await actor.createEmbeddedDocuments("Item", cleaned) : [];

  // ── Fire per-campaign-start resource grants on the new items only ─────────
  // Walks `created` (the documents we just made) so we don't re-fire grants
  // from items the user already had.
  const newItemIds = (created ?? []).map(d => d.id);
  for (const newId of newItemIds) {
    const item = actor.items.get(newId);
    if (!item) continue;
    const grants = item.flags?.fourththing?.resourceGrants;
    if (!Array.isArray(grants)) continue;
    const startingGrants = grants.filter(g => g.cadence === "per-campaign-start");
    if (startingGrants.length === 0) continue;
    // Use the engine helper if exposed; otherwise inline the apply.
    const fire = game.fourththing?.fireResourceGrants;
    if (typeof fire === "function") {
      // The helper walks ALL items — to avoid double-fire on items that
      // weren't part of this swap, mark this single item as the "last fired"
      // by stamping its id in firedClean BEFORE the call. Then call the
      // helper, which will skip it via no-op since cadence-matching items
      // already get fired by walking. Simpler: inline the fire here.
    }
    // Inline single-item fire — use the same engine semantics
    for (const g of startingGrants) {
      try {
        const fireOne = game.fourththing?._applyOneGrant; // not exported as public API
        // Fallback path: directly nudge the faction opBank for OP grants
        if (typeof g.resource === "string" && g.resource.endsWith("-op")) {
          const factionId = actor.getFlag?.("bbttcc-factions", "factionId");
          const faction = factionId ? game.actors?.get(factionId) : null;
          if (!faction) continue;
          const POOL = {
            "violence-op":"violence","intrigue-op":"intrigue","soft-power-op":"softpower",
            "diplomacy-op":"diplomacy","economy-op":"economy","non-lethal-op":"nonlethal",
            "faith-op":"faith","logistics-op":"logistics","siege-op":"siege","body-op":"body","soul-op":"soul"
          };
          const pool = POOL[g.resource];
          if (!pool) continue;
          const bank = foundry.utils.duplicate(faction.flags?.["bbttcc-factions"]?.opBank ?? {});
          bank[pool] = (Number(bank[pool]) || 0) + Number(g.amount);
          await faction.update({ "flags.bbttcc-factions.opBank": bank });
        }
      } catch (_e) { /* swallow per-grant errors so swap completes */ }
    }
    firedClean[newId] = { firedAt: Date.now(), itemName: item.name, viaSwap: true };
    firedDirty = true;
  }

  if (firedDirty) await actor.setFlag("fourththing", "startingGrantsFiredItems", firedClean);

  const uuid = `Compendium.${packKey}.Item.${nextKey}`;
  await actor.setFlag("bbttcc-character-options", "heritageUuid", uuid);
  await actor.setFlag("bbttcc-character-options", "nativeLinks", {
    heritageName:    doc.name,
    heritageUuid:    uuid,
    heritageApplied: true
  });

  // Surface a chat note so GM sees what changed (concise; only if something happened)
  if (deletedIds.length || created.length) {
    const msg = [
      `<b>${actor.name}</b> heritage swap → <b>${newHeritageShort}</b>`,
      deletedIds.length ? `· removed ${deletedIds.length} stale item(s)` : null,
      created.length    ? `· added ${created.length} new item(s)` : null
    ].filter(Boolean).join(" ");
    ChatMessage.create({
      user: game.user.id,
      content: `<p style="font-size:0.78rem">${msg}</p>`,
      whisper: [game.user.id]
    });
  }

  return doc;
}

function ftIdentitySelectionKey(actor, slotKey) {
  const identity = game.bbttcc?.api?.identity?.getIdentityFlags?.(actor?.id ?? actor) ?? actor?.getFlag?.("bbttcc-character-options", "identity") ?? {};
  const mirrorKeyMap = { archetype: "archetype", sephirothicAlignment: "sephirot" };
  return identity?.[slotKey]?.key ?? actor?.flags?.["bbttcc-character-options"]?.[mirrorKeyMap[slotKey]]?.id ?? "";
}

function ftMatchesIdentityFamilyItem(it, slotKey, cfg) {
  const name = String(it?.name || "");
  const ident = String(it?.system?.identifier || "");
  const cat = String(it?.getFlag?.("bbttcc-character-options", "category") || "");

  if (cfg?.categories?.includes(cat)) return true;

  if (slotKey === "archetype") {
    if (/^Archetype:/i.test(name)) return true;
    if (ident.startsWith("archetype-")) return true;
    return false;
  }

  if (slotKey === "sephirothicAlignment") {
    if (/^Alignment:/i.test(name)) return true;
    if (ident.startsWith("alignment-")) return true;
    return false;
  }

  return false;
}

async function ftDeleteIdentityFamilyItems(actor, slotKey, cfg) {
  const items = actor?.items?.contents ?? actor?.items ?? [];
  const toDelete = items.filter(it => ftMatchesIdentityFamilyItem(it, slotKey, cfg)).map(it => it.id);
  if (toDelete.length) await actor.deleteEmbeddedDocuments("Item", toDelete);
  return toDelete;
}

async function ftDeleteSephirotItems(actor) {
  const items = actor?.items?.contents ?? actor?.items ?? [];
  const toDelete = items.filter(it => {
    const name = String(it?.name ?? "");
    const ident = String(it?.system?.identifier ?? "");
    const cat = it?.getFlag?.("bbttcc-character-options", "category");
    return FT_IDENTITY_SLOTS.sephirothicAlignment.categories.includes(cat) || /^alignment/i.test(name) || ident.startsWith("alignment-");
  }).map(it => it.id);
  if (toDelete.length) await actor.deleteEmbeddedDocuments("Item", toDelete);
}

async function ftSyncLegacyIdentityMirror(actor, slotKey, slotData) {
  const mirrorKeyMap = {
    archetype: "archetype",
    sephirothicAlignment: "sephirot"
  };
  const mirrorKey = mirrorKeyMap[slotKey];
  if (!mirrorKey) return;

  if (!slotData || !slotData.key) {
    try { await actor.unsetFlag("bbttcc-character-options", mirrorKey); }
    catch (_e) { await actor.setFlag("bbttcc-character-options", mirrorKey, null); }
    return;
  }

  await actor.setFlag("bbttcc-character-options", mirrorKey, {
    pack: slotData.pack || null,
    id: slotData.id || slotData.key || null,
    key: slotData.optionKey || null,
    name: slotData.name || "",
    identifier: slotData.identifier || "",
    category: slotData.category || null
  });
}


// Bootstrap: when a steward is freshly linked to a faction (or when a faction
// has never had its echoAssets seeded), scan the steward's items for crew/
// occult feats and persist any newly detected names into the faction flag.
// Idempotent — only writes when there's a delta. Called during the async
// context build (getBBTTCCContext) so the steward tab + Manage Echo Assets
// dialog both see auto-populated values on first render.
export async function ftEnsureEchoAssetsBootstrap(faction, actor) {
  if (!faction || !actor || !bbttccActive()) return;
  try {
    const detectedCrew   = ftScanActorForAssetNames(actor, "crew");
    const detectedOccult = ftScanActorForAssetNames(actor, "occult");

    const stored = faction.getFlag?.("fourththing", "echoAssets")
                ?? faction.flags?.fourththing?.echoAssets
                ?? faction.flags?.["roll-for-initiation"]?.echoAssets
                ?? {};

    const storedActiveCrew   = ftParseAssetBucket(stored.activeCrew   ?? [], "crew");
    const storedReserveCrew  = ftParseAssetBucket(stored.reserveCrew  ?? [], "crew");
    const storedActiveOccult = ftParseAssetBucket(stored.activeOccult ?? [], "occult");
    const storedReserveOccult= ftParseAssetBucket(stored.reserveOccult?? [], "occult");

    // Bootstrap is AUTHORITATIVE for active lists: the steward's currently-
    // attached crew/occult feats define the active roster. Anything that was
    // previously active but is no longer detected gets dropped (they removed
    // it via the wizard or sheet). Reserve lists are preserved as user-
    // curated state — they only change via the Manage Echo Assets dialog.
    const nextActiveCrew   = ftUniqueStrings(detectedCrew);
    const nextActiveOccult = ftUniqueStrings(detectedOccult);

    const sameCrew   = nextActiveCrew.length   === storedActiveCrew.length
                    && nextActiveCrew.every((n, i) => n === storedActiveCrew[i]);
    const sameOccult = nextActiveOccult.length === storedActiveOccult.length
                    && nextActiveOccult.every((n, i) => n === storedActiveOccult[i]);
    if (sameCrew && sameOccult) return;

    const payload = {
      ...stored,
      activeCrew:    nextActiveCrew,
      reserveCrew:   storedReserveCrew,
      activeOccult:  nextActiveOccult,
      reserveOccult: storedReserveOccult,
      slots:         stored.slots ?? null,
      updatedTs:     Date.now(),
      stewardId:     actor.id,
      stewardName:   actor.name
    };

    await faction.update({
      "flags.fourththing.echoAssets": payload
    });
  } catch (e) {
    console.warn("Fourth Thing | ftEnsureEchoAssetsBootstrap failed:", e);
  }
}

export function getLinkedFaction(actor) {
  if (!bbttccActive()) return null;

  try {
    return ftResolveFactionLink(actor).actor ?? null;
  } catch (e) {
    console.warn("Fourth Thing | getLinkedFaction failed:", e);
    return null;
  }
}

export function getFactionEchoAssets(faction, actor = null) {
  const blank = {
    tier: 0,
    crewSlots: 2, occultSlots: 2,
    defaultCrewSlots: 2, defaultOccultSlots: 2,
    usesOverride: false,
    crewStatusLabel: "0 / 2", occultStatusLabel: "0 / 2",
    crewOver: false, occultOver: false,
    activeCrew: [],
    reserveCrew: [],
    activeOccult: [],
    reserveOccult: [],
    activeCrewCount: 0, activeOccultCount: 0,
    remainingCrew: 2, remainingOccult: 2,
    overCapacity: false,
    hasAny: false,
    legacyCrew: [],
    legacyOccult: [],
    // Legacy compat (for any caller still reading these)
    slots: 4, defaultSlots: 4, statusLabel: "4 open", totalActive: 0, remainingSlots: 4
  };

  try {
    if (!faction) return blank;

    const fSys = faction.system?.system ?? faction.system ?? {};
    const tier = ftTierToNumber(
      faction.getFlag?.("bbttcc-factions", "tier")
      ?? faction.getFlag?.("bbttcc-factions", "tierKey")
      ?? faction.getFlag?.("bbttcc-factions", "tierBand")
      ?? faction.getFlag?.("bbttcc-factions", "factionTier")
      ?? fSys?.tier?.value
      ?? fSys?.factionTier
      ?? fSys?.level?.value
      ?? 0
    );
    // Per-pool capacity model (2026-04-27): each of crew + occult gets its
    // own slot pool sized at T+1 (Tier 1 → 2 slots per pool). Stewards START
    // with one of each at creation, so default-state for a Tier 1 actor is
    // 1 of 2 / 1 of 2, with room to acquire more in-game.
    const defaultCrewSlots   = Math.max(2, tier + 1);
    const defaultOccultSlots = Math.max(2, tier + 1);

    const stored = faction.getFlag?.("fourththing", "echoAssets")
                ?? faction.flags?.fourththing?.echoAssets
                ?? faction.flags?.["roll-for-initiation"]?.echoAssets
                ?? {};

    const co    = actor?.getFlag?.("bbttcc-character-options", "identity") ?? {};
    const coTop = actor?.flags?.["bbttcc-character-options"] ?? {};

    const legacyCrewFromFlags = ftParseAssetBucket(
      co.crew?.displayName
      ?? co.crew?.name
      ?? coTop.crew?.displayName
      ?? coTop.crew?.name
      ?? coTop.identity?.crew?.displayName
      ?? coTop.identity?.crew?.name
      ?? "",
      "crew"
    );
    const legacyCrewFromItems = ftScanActorForAssetNames(actor, "crew");
    const legacyCrew = ftUniqueStrings([...legacyCrewFromFlags, ...legacyCrewFromItems]);

    const legacyOccultFromFlags = ftParseAssetBucket(
      co.occult?.displayName
      ?? co.occult?.name
      ?? coTop.occult?.displayName
      ?? coTop.occult?.name
      ?? coTop.identity?.occult?.displayName
      ?? coTop.identity?.occult?.name
      ?? "",
      "occult"
    );
    const legacyOccultFromItems = ftScanActorForAssetNames(actor, "occult");
    const legacyOccult = ftUniqueStrings([...legacyOccultFromFlags, ...legacyOccultFromItems]);

    const hasCrewData = stored.activeCrew != null || stored.reserveCrew != null || stored.crew != null || stored.assets?.crew != null || stored.active?.crew != null || stored.reserve?.crew != null;
    const hasOccultData = stored.activeOccult != null || stored.reserveOccult != null || stored.occult != null || stored.assets?.occult != null || stored.active?.occult != null || stored.reserve?.occult != null;

    const storedActiveCrew = hasCrewData
      ? ftParseAssetBucket(stored.activeCrew ?? stored.crew?.active ?? stored.assets?.crew?.active ?? stored.active?.crew ?? [], "crew")
      : [];
    const activeCrew = ftUniqueStrings([...legacyCrew, ...storedActiveCrew]);

    const reserveCrew = ftParseAssetBucket(
      hasCrewData
        ? (stored.reserveCrew ?? stored.crew?.reserve ?? stored.assets?.crew?.reserve ?? stored.reserve?.crew ?? [])
        : [],
      "crew"
    ).filter(name => !activeCrew.includes(name));

    const storedActiveOccult = hasOccultData
      ? ftParseAssetBucket(stored.activeOccult ?? stored.occult?.active ?? stored.assets?.occult?.active ?? stored.active?.occult ?? [], "occult")
      : [];
    const activeOccult = ftUniqueStrings([...legacyOccult, ...storedActiveOccult]);

    const reserveOccult = ftParseAssetBucket(
      hasOccultData
        ? (stored.reserveOccult ?? stored.occult?.reserve ?? stored.assets?.occult?.reserve ?? stored.reserve?.occult ?? [])
        : [],
      "occult"
    ).filter(name => !activeOccult.includes(name));

    const rawCrewSlots   = stored.crewSlots   ?? stored.crewCap   ?? null;
    const rawOccultSlots = stored.occultSlots ?? stored.occultCap ?? null;
    const nCrewSlots   = Number(rawCrewSlots);
    const nOccultSlots = Number(rawOccultSlots);
    const crewSlots   = Number.isFinite(nCrewSlots)   && nCrewSlots   > 0 ? Math.max(1, Math.floor(nCrewSlots))   : defaultCrewSlots;
    const occultSlots = Number.isFinite(nOccultSlots) && nOccultSlots > 0 ? Math.max(1, Math.floor(nOccultSlots)) : defaultOccultSlots;
    const usesOverride = (Number.isFinite(nCrewSlots)   && Math.floor(nCrewSlots)   !== defaultCrewSlots)
                      || (Number.isFinite(nOccultSlots) && Math.floor(nOccultSlots) !== defaultOccultSlots);

    const activeCrewCount   = activeCrew.length;
    const activeOccultCount = activeOccult.length;
    const remainingCrew   = Math.max(0, crewSlots   - activeCrewCount);
    const remainingOccult = Math.max(0, occultSlots - activeOccultCount);
    const crewOver   = activeCrewCount   > crewSlots;
    const occultOver = activeOccultCount > occultSlots;
    const overCapacity = crewOver || occultOver;
    const crewStatusLabel   = `${activeCrewCount} / ${crewSlots}`;
    const occultStatusLabel = `${activeOccultCount} / ${occultSlots}`;

    return {
      tier,
      crewSlots, occultSlots, defaultCrewSlots, defaultOccultSlots, usesOverride,
      crewStatusLabel, occultStatusLabel, crewOver, occultOver,
      activeCrew, reserveCrew, activeOccult, reserveOccult,
      activeCrewCount, activeOccultCount, remainingCrew, remainingOccult,
      overCapacity,
      hasAny: !!(activeCrew.length || reserveCrew.length || activeOccult.length || reserveOccult.length),
      legacyCrew, legacyOccult,
      // Legacy compat fields — kept so older template/dialog code paths still
      // resolve safely until they're updated to the per-pool shape.
      slots: crewSlots + occultSlots,
      defaultSlots: defaultCrewSlots + defaultOccultSlots,
      totalActive: activeCrewCount + activeOccultCount,
      remainingSlots: remainingCrew + remainingOccult,
      statusLabel: overCapacity
        ? `Over (crew ${crewStatusLabel}, occult ${occultStatusLabel})`
        : `Crew ${crewStatusLabel} • Occult ${occultStatusLabel}`
    };
  } catch (e) {
    console.warn("Fourth Thing | getFactionEchoAssets failed:", e);
    return blank;
  }
}

// ─── Terrain → Sephirah resonance map ────────────────────────────────────────
// Maps BBTTCC terrain keys to sephirothic resonance.
// If the actor's active sephirah matches the terrain resonance, magic rolls gain +1.
// Qliphothic terrain adds +1 Noise instead.

const TERRAIN_SEPHIRAH = {
  // Natural
  forest:       "netzach",
  grassland:    "netzach",
  wetlands:     "chesed",
  river:        "chesed",
  ocean:        "chesed",
  mountain:     "gevurah",
  desert:       "gevurah",
  tundra:       "malkuth",
  // Urban
  city:         "hod",
  ruins:        "malkuth",
  industrial:   "hod",
  // Sacred / liminal
  ley_nexus:    "keter",
  sacred_site:  "tiferet",
  dreamgate:    "yesod",
  moonpath:     "yesod",
  shadow_zone:  "binah",
  vault:        "binah",
  // Hazardous
  qliphothic:   null,   // null = adds Noise, not alignment bonus
  irradiated:   null,
  wasteland:    "malkuth"
};

// ─── Terrain bonus ────────────────────────────────────────────────────────────

/**
 * Returns { alignBonus: number, noiseBonus: number, terrainLabel: string }
 * alignBonus: +1 if actor's sephirah resonates with current hex terrain
 * noiseBonus: +1 if terrain is Qliphothic/irradiated
 */
export function getTerrainMagicModifiers(actor) {
  const result = { alignBonus: 0, noiseBonus: 0, terrainKey: null, terrainLabel: null };
  if (!bbttccActive()) return result;

  try {
    // Get the actor's current token on the active scene
    const token = actor.getActiveTokens(true, true)[0];
    if (!token) return result;

    // Read terrain from the hex the token occupies.
    // BBTTCC stores terrain on scene flags keyed by hex ID.
    const scene   = token.scene ?? game.scenes.active;
    const hexData = scene?.getFlag("bbttcc-territory", "hexes") ?? {};

    // Find which hex contains this token (BBTTCC stores hex center coords)
    const tx = token.x + (token.width  * scene?.grid?.size ?? 100) / 2;
    const ty = token.y + (token.height * scene?.grid?.size ?? 100) / 2;

    let bestHex = null;
    let bestDist = Infinity;
    for (const [hexId, hexInfo] of Object.entries(hexData)) {
      if (!hexInfo?.center) continue;
      const dx = hexInfo.center.x - tx;
      const dy = hexInfo.center.y - ty;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) { bestDist = dist; bestHex = hexInfo; }
    }

    if (!bestHex?.terrain?.key) return result;
    const terrainKey = bestHex.terrain.key;
    result.terrainKey   = terrainKey;
    result.terrainLabel = bestHex.terrain.label ?? terrainKey;

    // Check resonance
    const sephirahResonance = TERRAIN_SEPHIRAH[terrainKey];
    if (sephirahResonance === null) {
      // Qliphothic / irradiated — adds Noise
      result.noiseBonus = 1;
    } else if (sephirahResonance) {
      const actorSeph = (actor.system?.system ?? actor.system)?.magic?.sephirah ?? "tiferet";
      if (actorSeph === sephirahResonance) result.alignBonus = 1;
    }
  } catch (e) {
    console.warn("Fourth Thing | getTerrainMagicModifiers failed:", e);
  }

  return result;
}

// ─── Tikkun flag reader ───────────────────────────────────────────────────────

/**
 * Returns the actor's Tikkun data from bbttcc-tikkun flags.
 * Falls back to the actor's own system.tikkun if BBTTCC is not active.
 */
export function getTikkunData(actor) {
  const rawSys = actor.system?.system ?? actor.system;
  const base   = { stage: rawSys?.tikkun?.stage ?? "sleeper", sparks: {}, enlightenmentPoints: 0 };
  if (!bbttccActive()) return base;

  try {
    const flags = actor.getFlag("bbttcc-tikkun", "data") ?? {};
    return {
      stage:               flags.stage               ?? base.stage,
      sparks:              flags.sparks              ?? {},
      enlightenmentPoints: flags.enlightenmentPoints ?? 0,
      tikkunActions:       flags.tikkunActions       ?? [],
      qliphothicTaint:     flags.qliphothicTaint     ?? 0,
      sephirothicProgress: flags.sephirothicProgress ?? {}
    };
  } catch (e) {
    console.warn("Fourth Thing | getTikkunData failed:", e);
    return base;
  }
}

// ─── Faction live data ────────────────────────────────────────────────────────

/**
 * Returns live faction data for the actor's linked faction.
 * Returns null if BBTTCC inactive or no faction linked.
 */

export function getFactionData(actor) {
  if (!bbttccActive()) return null;

  try {
    const rawSys = actor.system?.system ?? actor.system;
    const resolved = ftResolveFactionLink(actor);
    const faction = resolved.actor;
    const fallbackId = rawSys?.faction?.id ?? actor.getFlag?.("bbttcc-factions", "factionId") ?? "";

    if (!faction) {
      if (!resolved.name && !fallbackId) return null;
      return {
        id: resolved.id || fallbackId,
        name: resolved.name || fallbackId,
        morale: null,
        loyalty: rawSys?.faction?.loyalty ?? 0,
        tier: 0,
        level: 0,
        op: null,
        echoAssets: getFactionEchoAssets(null, actor)
      };
    }

    const fSys = faction.system?.system ?? faction.system ?? {};
    const tier = ftTierToNumber(
      faction.getFlag?.("bbttcc-factions", "tier")
      ?? faction.getFlag?.("bbttcc-factions", "tierKey")
      ?? faction.getFlag?.("bbttcc-factions", "tierBand")
      ?? faction.getFlag?.("bbttcc-factions", "factionTier")
      ?? fSys?.tier?.value
      ?? fSys?.factionTier
      ?? fSys?.level?.value
      ?? 0
    );

    return {
      id: faction.id,
      name: faction.name,
      morale: fSys?.health?.morale?.value ?? fSys?.morale?.value ?? null,
      loyalty: rawSys?.faction?.loyalty ?? 0,
      tier,
      level: tier,
      op: fSys?.op?.value ?? null,
      echoAssets: getFactionEchoAssets(faction, actor)
    };
  } catch (e) {
    console.warn("Fourth Thing | getFactionData failed:", e);
    return null;
  }
}

async function ftBuildEditContext(actor) {
  if (!bbttccActive()) {
    return {
      factions: [],
      currentFactionId: "",
      currentFactionName: "",
      archetypes: [],
      currentArchetypeKey: "",
      philosophies: [],
      currentPhilosophyKey: "",
      sephirothicAlignments: [],
      currentSephirothicAlignmentKey: "",
      enlightenmentLevels: FT_ENLIGHTENMENT_LEVELS,
      currentEnlightenmentKey: "unawakened",
      classes: [], currentClassKey: "",
      ancestries: [], currentAncestryKey: "",
      subclasses: [], currentSubclassKey: "", currentSubclassClassIdentifier: "",
      heritages: [], currentHeritageKey: "", currentAncestryFamily: "",
      crews: [], currentCrewKey: "",
      occults: [], currentOccultKey: ""
    };
  }

  const resolvedFaction = ftResolveFactionLink(actor);
  const coTop = actor.flags?.["bbttcc-character-options"] ?? {};

  // Current class/ancestry/subclass — prefer nativeLinks uuids, fall back to embedded items.
  const embeddedClass    = Array.from(actor.items ?? []).find(i => i.type === "class");
  const embeddedAncestry = Array.from(actor.items ?? []).find(i => i.type === "species" || i.type === "race");
  const embeddedSubclass = Array.from(actor.items ?? []).find(i => i.type === "subclass");
  // Heritage roots come in as type=feat (mapped to "feature" by preCreateItem)
  // and preserve flags.bbttcc.kind === "heritage".
  const embeddedHeritage = Array.from(actor.items ?? []).find(i => {
    const kind  = String(i?.flags?.bbttcc?.kind ?? "").toLowerCase();
    const ident = String(i?.system?.identifier ?? "").toLowerCase();
    return kind === "heritage" || ident.endsWith("_heritage");
  });

  const currentClassKey    = ftIdFromUuid(coTop.nativeLinks?.classUuid    ?? coTop.classUuid    ?? "");
  const currentAncestryKey = ftIdFromUuid(coTop.nativeLinks?.speciesUuid  ?? coTop.speciesUuid  ?? "");
  const currentSubclassKey = ftIdFromUuid(coTop.nativeLinks?.subclassUuid ?? "");
  const currentHeritageKey = ftIdFromUuid(coTop.nativeLinks?.heritageUuid ?? coTop.heritageUuid ?? "");

  // Subclass dropdown is filtered by the current class's identifier, so you
  // only see Aurablade doctrines when your Path is Aurablade, etc.
  const currentClassIdentifier = String(embeddedClass?.system?.identifier ?? "").trim();
  const allSubclasses = await ftIndexItemPackByType(FT_ID_PACK_CLASSES, "subclass");
  const filteredSubclasses = currentClassIdentifier
    ? allSubclasses.filter(s => !s.classIdentifier || s.classIdentifier === currentClassIdentifier)
    : allSubclasses;

  // Heritage dropdown is filtered by the current ancestry's family — Cryptidkin
  // species shows only Cryptidkin heritages, etc. Family is read from the
  // embedded ancestry item's bbttcc flag, falling back to system.identifier.
  let currentAncestryFamily = String(embeddedAncestry?.flags?.bbttcc?.family ?? "").toLowerCase();
  if (!currentAncestryFamily) {
    currentAncestryFamily = String(embeddedAncestry?.system?.identifier ?? "").toLowerCase();
  }
  const allHeritages = await ftIndexHeritagePack(FT_ID_PACK_ANCESTRIES);
  // Cross-cutting heritage families bypass the species filter — Sephirotic
  // Heritages key off sephirah alignment, not ancestry, so a Human or
  // Cryptidkin character can equally take one. Add new cross-cutting roots
  // here as they're authored.
  const CROSS_CUTTING_FAMILIES = new Set(["sephirotic"]);
  const filteredHeritages = currentAncestryFamily
    ? allHeritages.filter(h => !h.family || h.family === currentAncestryFamily || CROSS_CUTTING_FAMILIES.has(h.family))
    : allHeritages;

  return {
    factions: ftFactionActors().map(a => ({ id: a.id, name: a.name })),
    currentFactionId: resolvedFaction.id || (actor.getFlag?.("bbttcc-factions", "factionId") ?? ""),
    currentFactionName: resolvedFaction.name || "",
    archetypes: await ftIndexIdentityPack(FT_PACK_KEYS.archetype),
    currentArchetypeKey: ftIdentitySelectionKey(actor, "archetype"),
    philosophies: FT_POLITICAL_PHILOSOPHIES.map(p => ({ key: p.key, label: p.label })),
    currentPhilosophyKey: actor.getFlag?.("bbttcc-aae", "politicalPhilosophy") ?? "",
    sephirothicAlignments: await ftIndexIdentityPack(FT_PACK_KEYS.sephirothicAlignment),
    currentSephirothicAlignmentKey: ftIdentitySelectionKey(actor, "sephirothicAlignment"),
    enlightenmentLevels: FT_ENLIGHTENMENT_LEVELS,
    currentEnlightenmentKey: actor.getFlag?.("bbttcc-character-options", "enlightenment")?.level ?? "unawakened",
    classes: await ftIndexItemPackByType(FT_ID_PACK_CLASSES, "class"),
    currentClassKey,
    ancestries: await ftIndexItemPackByType(FT_ID_PACK_ANCESTRIES, ["species", "race"]),
    currentAncestryKey,
    subclasses: filteredSubclasses,
    currentSubclassKey,
    currentSubclassClassIdentifier: currentClassIdentifier,
    heritages: filteredHeritages,
    currentHeritageKey,
    currentAncestryFamily,
    crews: await ftIndexEchoAssetPack(FT_PACK_KEYS.crew, "crew"),
    currentCrewKey: String(coTop.identity?.crew?.key ?? coTop.identity?.crew?.id ?? coTop.crew?.id ?? ""),
    occults: await ftIndexEchoAssetPack(FT_PACK_KEYS.occult, "occult"),
    currentOccultKey: String(coTop.identity?.occult?.key ?? coTop.identity?.occult?.id ?? coTop.occult?.id ?? "")
  };
}

// ─── Full bridge context ──────────────────────────────────────────────────────

/**
 * Returns structured identity data from BBTTCC flags.
 * All fields have safe string defaults.
 */
export async function getIdentityData(actor) {
  const empty = { ancestry: "", heritage: "", cls: "", subclass: "", archetype: "", crew: "",
                  occult: "", philosophy: "", sephirotic: "", enlightenment: "",
                  hasIdentity: false, needsStatSync: false, classApplied: true };
  try {
    const co    = actor.getFlag("bbttcc-character-options", "identity") ?? {};
    const coTop = actor.flags?.["bbttcc-character-options"] ?? {};
    const aae   = actor.flags?.["bbttcc-aae"] ?? {};

    // Resolve ancestry name — try stored name first, then async UUID lookup
    let ancestry = coTop.nativeLinks?.ancestryName ?? "";
    if (!ancestry && coTop.speciesUuid) {
      try {
        const item = await fromUuid(coTop.speciesUuid);
        ancestry = item?.name ?? "";
      } catch(e) { /* UUID not resolvable */ }
    }

    // Prefer the BBTTCC Wizard's recorded class name; fall back to the actor's embedded class item.
    let cls = coTop.nativeLinks?.className ?? "";
    if (!cls) {
      const classItem = (actor.items?.contents ?? Array.from(actor.items ?? []))
        .find(i => i.type === "class");
      cls = classItem?.name ?? "";
    }

    // Subclass — same precedence: flag first, embedded item second.
    let subclass = coTop.nativeLinks?.subclassName ?? "";
    if (!subclass) {
      const subclassItem = (actor.items?.contents ?? Array.from(actor.items ?? []))
        .find(i => i.type === "subclass");
      subclass = subclassItem?.name ?? "";
    }

    // Heritage — same precedence: flag first, embedded heritage feat second.
    // Strip the redundant "<Family> Heritage: " prefix so the header pill
    // reads just the lineage ("Furrykin" instead of "Cryptidkin Heritage: Furrykin").
    let heritage = coTop.nativeLinks?.heritageName ?? "";
    if (!heritage) {
      const heritageItem = (actor.items?.contents ?? Array.from(actor.items ?? []))
        .find(i => {
          const kind  = String(i?.flags?.bbttcc?.kind ?? "").toLowerCase();
          const ident = String(i?.system?.identifier ?? "").toLowerCase();
          return kind === "heritage" || ident.endsWith("_heritage");
        });
      heritage = heritageItem?.name ?? "";
    }
    heritage = String(heritage).replace(/^[^:]+Heritage:\s*/i, "");
    const archetype   = co.archetype?.displayName         ?? coTop.archetype?.name?.replace("Archetype: ", "")       ?? "";
    const crew        = co.crew?.displayName              ?? coTop.crew?.name?.replace("Crew Type: ", "")            ?? "";
    const occult      = co.occult?.displayName            ?? coTop.occult?.name?.replace("Occult Association: ", "") ?? "";
    const philosophy  = ftLabelForPoliticalPhilosophy(aae.politicalPhilosophy) || "";
    const sephirotic  = co.sephirothicAlignment?.name?.replace("Alignment: ", "")
                     ?? coTop.sephirot?.name?.replace("Alignment: ", "") ?? "";
    const enlightenment = co.enlightenment?.name?.replace("Enlightenment: ", "")
                       ?? coTop.enlight?.name?.replace("Enlightenment: ", "") ?? "";

    const hasIdentity   = !!(archetype || cls || ancestry);
    const classApplied  = coTop.nativeLinks?.classApplied ?? true;
    const classUuid     = coTop.classUuid ?? coTop.nativeLinks?.classUuid ?? "";

    // Detect if wizard wrote D&D abilities but FT attributes are still default
    const rawSys = actor.system?.system ?? actor.system;
    const abilities = rawSys?.abilities ?? actor.system?.abilities ?? {};
    const attrs     = rawSys?.attributes ?? {};
    const needsStatSync = Object.keys(abilities).length > 0
      && Object.values(attrs).every(a => (a?.value ?? 2) === 2);

    return { ancestry, heritage, cls, subclass, archetype, crew, occult, philosophy,
             sephirotic, enlightenment, hasIdentity, needsStatSync,
             classApplied, classUuid };
  } catch(e) {
    console.warn("Fourth Thing | getIdentityData failed:", e);
    return empty;
  }
}



export async function getBBTTCCContext(actor) {
  // Bootstrap echo assets BEFORE building the faction snapshot so the steward
  // tab + Manage Echo Assets dialog both pick up the persisted values on the
  // very first render after a faction link is made.
  try {
    const linked = getLinkedFaction(actor);
    if (linked) await ftEnsureEchoAssetsBootstrap(linked, actor);
  } catch (e) {
    console.warn("Fourth Thing | echo-asset bootstrap pre-context failed:", e);
  }
  return {
    active:   bbttccActive(),
    tikkun:   getTikkunData(actor),
    faction:  getFactionData(actor),
    terrain:  getTerrainMagicModifiers(actor),
    identity: await getIdentityData(actor),
    edit:     await ftBuildEditContext(actor)
  };
}


// ─── BBTTCC API delegates ─────────────────────────────────────────────────────
// Called from sheet action handlers — each is a no-op if BBTTCC is inactive.

export function openBridge(actor) {
  if (!bbttccActive()) return ui.notifications?.warn("BBTTCC support module not active.");
  game.bbttcc?.api?.bridge?.open?.(actor.id);
}

export function openRadiation(actor) {
  if (!bbttccActive()) return ui.notifications?.warn("BBTTCC support module not active.");
  // Radiation API is data-only — show a simple dialog with current RP and level
  const rawSys  = actor.system?.system ?? actor.system;
  const rp      = rawSys?.radiation?.rp ?? 0;
  const radApi  = game.bbttcc.api.radiation;
  const level   = radApi?.levelFor?.(rp) ?? "none";
  new Dialog({
    title:   `Radiation — ${actor.name}`,
    content: `<div style="padding:0.5rem">
      <p style="margin:0 0 0.5rem"><strong>Current RP:</strong> ${rp}</p>
      <p style="margin:0 0 0.5rem"><strong>Level:</strong> ${level}</p>
      <div style="display:flex;gap:0.5rem;margin-top:0.75rem">
        <label style="font-size:0.8rem">Adjust RP</label>
        <input type="number" id="ft-rp-delta" value="0" style="width:60px"/>
      </div>
    </div>`,
    buttons: {
      apply: {
        label: "Apply",
        callback: async (html) => {
          const delta = parseInt(html.find("#ft-rp-delta").val()) || 0;
          if (delta !== 0) {
            const newRp = Math.max(0, rp + delta);
            await actor.update({ "system.radiation.rp": newRp });
            ui.notifications.info(`${actor.name}: Radiation ${rp} → ${newRp} RP`);
          }
        }
      },
      close: { label: "Close" }
    },
    default: "close"
  }).render(true);
}

export function openTikkunPopup(actor) {
  if (!bbttccActive()) return ui.notifications?.warn("BBTTCC support module not active.");
  const resolved = ftResolveFactionLink(actor);
  game.bbttcc.api.tikkun.openRitualConsole({ factionId: resolved.id || null });
}

export function openIdentityChooser(actor, app, type) {
  if (!bbttccActive()) return ui.notifications?.warn("BBTTCC support module not active.");
  // openCharacterWizard is the V14 AppV2-compatible identity UI
  const autoLink = game.bbttcc.api.autoLink;
  if (autoLink?.openCharacterWizard) {
    autoLink.openCharacterWizard(actor, type);
    return;
  }
  // Fallback: full sorting wizard
  const sorting = game.bbttcc.api.sorting;
  if (sorting?.openWizard) {
    sorting.openWizard(actor);
    return;
  }
  ui.notifications?.warn(`BBTTCC identity chooser not available for type: ${type}`);
}

export function openFactionSheet(actor) {
  if (!bbttccActive()) return;
  const faction = getLinkedFaction(actor);
  if (!faction) return ui.notifications?.warn("No faction linked to this character.");
  faction?.sheet?.render(true);
}


export async function setActorFaction(actor, factionId) {
  if (!actor) return null;
  const nextId = String(factionId ?? "").trim() || null;
  const faction = nextId ? (game.actors?.get(nextId) ?? null) : null;
  const name = faction?.name ?? "";

  await actor.setFlag("bbttcc-factions", "factionId", nextId);
  await actor.setFlag("bbttcc-territory", "faction", name || "");
  await actor.update({
    "system.faction.id": nextId,
    "system.faction.name": name || ""
  });

  return { id: nextId, name };
}

export async function applyIdentitySlotChange(actor, slotKey, newKey) {
  if (!actor) return null;
  const nextKey = String(newKey ?? "").trim();

  if (slotKey === "political") {
    return setActorPoliticalPhilosophy(actor, nextKey);
  }

  const cfg = FT_IDENTITY_SLOTS[slotKey];
  if (!cfg) throw new Error(`Unknown identity slot: ${slotKey}`);

  if (slotKey === "sephirothicAlignment") await ftDeleteSephirotItems(actor);
  else await ftDeleteIdentityFamilyItems(actor, slotKey, cfg);

  const idApi = game.bbttcc?.api?.identity;
  const currentFlags = idApi?.getIdentityFlags?.(actor.id ?? actor) || actor.getFlag?.("bbttcc-character-options", "identity") || {};
  const nextFlags = foundry.utils.mergeObject(foundry.utils.deepClone(currentFlags), {
    [slotKey]: { key: null, id: null, pack: null, category: cfg.categories[0], optionKey: null, identifier: "", name: "" }
  }, { inplace: false, overwrite: true });

  if (!nextKey) {
    await ftSyncLegacyIdentityMirror(actor, slotKey, null);
    if (idApi?.setIdentityFlags) await idApi.setIdentityFlags(actor.id ?? actor, nextFlags);
    else await actor.setFlag("bbttcc-character-options", "identity", nextFlags);
    await idApi?.syncOptionTiers?.(actor.id ?? actor, { silent: true });
    await game.bbttcc?.api?.characterOptions?.recalcActor?.(actor.id);
    return nextFlags;
  }

  const pack = game.packs?.get(cfg.pack);
  if (!pack) throw new Error(`Missing pack: ${cfg.pack}`);
  const doc = await pack.getDocument(nextKey);
  if (!doc) throw new Error(`Could not resolve identity document: ${slotKey} ${nextKey}`);

  await actor.createEmbeddedDocuments("Item", [doc.toObject()]);
  const opt = doc.getFlag?.("bbttcc-character-options", "option") || {};
  const slotData = {
    key: doc.id,
    id: doc.id,
    pack: cfg.pack,
    category: cfg.categories[0],
    optionKey: String(opt.key || "").trim() || null,
    identifier: String(doc.system?.identifier || "").trim(),
    name: String(doc.name || "")
  };

  nextFlags[slotKey] = slotData;
  await ftSyncLegacyIdentityMirror(actor, slotKey, slotData);
  if (idApi?.setIdentityFlags) await idApi.setIdentityFlags(actor.id ?? actor, nextFlags);
  else await actor.setFlag("bbttcc-character-options", "identity", nextFlags);
  await idApi?.syncOptionTiers?.(actor.id ?? actor, { silent: true });
  await game.bbttcc?.api?.characterOptions?.recalcActor?.(actor.id);
  return nextFlags;
}

export async function setActorPoliticalPhilosophy(actor, key) {
  if (!actor) return null;
  const nextKey = String(key ?? "").trim() || null;
  await actor.setFlag("bbttcc-aae", "politicalPhilosophy", nextKey);
  await game.bbttcc?.api?.characterOptions?.recalcActor?.(actor.id);
  return nextKey;
}

// Crew / Occult are flag-only identity slots (no embedded items).
// Mirrors the wizard's write pattern: `flags.bbttcc-character-options.identity.<slot>`
// plus the per-slot shortcut flag `flags.bbttcc-character-options.<slot>`.
export async function setActorEchoAssetSlot(actor, slotKey, packEntryId) {
  if (!actor) return null;
  if (slotKey !== "crew" && slotKey !== "occult") {
    throw new Error(`setActorEchoAssetSlot: unsupported slot "${slotKey}"`);
  }

  const packKey = FT_PACK_KEYS[slotKey];
  const idApi   = game.bbttcc?.api?.identity;
  const current = idApi?.getIdentityFlags?.(actor.id ?? actor)
              || actor.getFlag?.("bbttcc-character-options", "identity")
              || {};
  const next = foundry.utils.deepClone(current);

  const nextId = String(packEntryId ?? "").trim();
  if (!nextId) {
    next[slotKey] = { key: null, id: null, pack: null, optionKey: null, identifier: "", name: "", displayName: "" };
    if (idApi?.setIdentityFlags) await idApi.setIdentityFlags(actor.id ?? actor, next);
    else await actor.setFlag("bbttcc-character-options", "identity", next);
    try { await actor.unsetFlag("bbttcc-character-options", slotKey); }
    catch (_e) { await actor.setFlag("bbttcc-character-options", slotKey, null); }
    await game.bbttcc?.api?.characterOptions?.recalcActor?.(actor.id);
    return next;
  }

  const pack = game.packs?.get(packKey);
  if (!pack) throw new Error(`Missing pack: ${packKey}`);
  const doc = await pack.getDocument(nextId);
  if (!doc) throw new Error(`Could not resolve ${slotKey} document: ${nextId}`);

  const rawName = String(doc.name || "");
  const displayName = ftNormalizeAssetName(rawName, slotKey);
  const slotData = {
    key: doc.id,
    id: doc.id,
    pack: packKey,
    optionKey: String(doc.getFlag?.("bbttcc-character-options", "option")?.key ?? "").trim() || null,
    identifier: String(doc.system?.identifier || "").trim(),
    name: rawName,
    displayName
  };

  next[slotKey] = slotData;
  if (idApi?.setIdentityFlags) await idApi.setIdentityFlags(actor.id ?? actor, next);
  else await actor.setFlag("bbttcc-character-options", "identity", next);
  await actor.setFlag("bbttcc-character-options", slotKey, {
    pack: packKey,
    id: doc.id,
    name: rawName,
    identifier: slotData.identifier
  });
  await game.bbttcc?.api?.characterOptions?.recalcActor?.(actor.id);
  return next;
}

export async function setActorEnlightenment(actor, levelKey) {
  if (!actor) return null;
  const nextKey = FT_ENLIGHTENMENT_ITEM_DATA[String(levelKey ?? "").trim()] ? String(levelKey ?? "").trim() : "unawakened";
  const display = ftLabelForEnlightenment(nextKey);

  await actor.setFlag("bbttcc-character-options", "enlightenment", { level: nextKey, display });

  const existing = actor.items?.filter(it => it.getFlag?.("bbttcc-character-options", "category") === "enlightenment-levels") ?? [];
  const toDelete = existing.map(it => it.id);
  if (toDelete.length) await actor.deleteEmbeddedDocuments("Item", toDelete);

  const src = FT_ENLIGHTENMENT_ITEM_DATA[nextKey];
  if (src) {
    const worldSrc = game.items?.find(i => i.name === src.name && i.getFlag?.("bbttcc-character-options", "category") === "enlightenment-levels");
    const createData = worldSrc ? worldSrc.toObject() : foundry.utils.deepClone(src);
    foundry.utils.setProperty(createData, 'flags["bbttcc-character-options"].category', "enlightenment-levels");
    await actor.createEmbeddedDocuments("Item", [createData]);
  }

  await game.bbttcc?.api?.characterOptions?.recalcActor?.(actor.id);
  Hooks.callAll("bbttcc:enlightenmentChanged", { actorId: actor.id, level: nextKey, display });
  return { level: nextKey, display };
}

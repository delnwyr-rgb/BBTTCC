/* modules/bbttcc-factions/scripts/module.js
 * BBTTCC — Faction Sheet (v13-safe)
 *
 * - Defense totals, Advance Turn/OP (Dry/Apply), Commit Turn
 * - Header strips: Bank/Stockpile (resources), OP Bank
 * - Raid Plan (player pre-staging) compact header grid
 *
 * RIGS (v1): Mobile infrastructure attached to factions
 * - Stored at flags.bbttcc-factions.rigs[]
 * - Schema normalized/ensured for any isFaction actor
 * - Lightweight API helpers added under game.bbttcc.api.factions.*
 */

const MODULE_ID = "bbttcc-factions";
const TER_MOD   = "bbttcc-territory";
// Foundry sheet class id used for flags.core.sheetClass assignment.
const SHEET_ID  = `${MODULE_ID}.BBTTCCFactionSheet`;
/* === AAE POLITICS (Faction Sheet) === */
    const AAE_MOD = "bbttcc-aae";
    const AAE_POLITICAL = {
      marxist:            { key:"marxist",            label:"Marxist / Communist" },
      liberal:            { key:"liberal",            label:"Liberal" },
      social_democratic:  { key:"social_democratic",  label:"Social Democratic" },
      libertarian:        { key:"libertarian",        label:"Libertarian" },
      authoritarian:      { key:"authoritarian",      label:"Authoritarian / Statist" },
      theocratic:         { key:"theocratic",         label:"Theocratic" },
      fascist:            { key:"fascist",            label:"Fascist" },
      anarchist:          { key:"anarchist",          label:"Anarchist" }
    };

    function aaePoliticalLabel(key) {
      return AAE_POLITICAL[key]?.label || "(None)";
    }

    function readActorPoliticalPhilosophy(actor) {
      try {
        const k = actor?.getFlag?.(AAE_MOD, "politicalPhilosophy");
        return (k && typeof k === "string") ? k : "";
      } catch { return ""; }
    }

    function readFactionPoliticalOverride(factionActor) {
      try {
        const k = factionActor?.getFlag?.(AAE_MOD, "politicalPhilosophyOverride");
        return (k && typeof k === "string") ? k : "";
      } catch { return ""; }
    }

    function readFactionDriftState(factionActor) {
      try {
        const driftScore = Number(factionActor?.getFlag?.(AAE_MOD, "driftScore") ?? 0) || 0;
        const severityState = String(factionActor?.getFlag?.(AAE_MOD, "severityState") || "stable");
        const lastImpacts = factionActor?.getFlag?.(AAE_MOD, "lastPoliticalImpacts");
        return {
          driftScore: Math.max(-100, Math.min(100, driftScore)),
          severityState: severityState || "stable",
          lastImpacts: Array.isArray(lastImpacts) ? lastImpacts.slice(0, 3) : []
        };
      } catch {
        return { driftScore: 0, severityState: "stable", lastImpacts: [] };
      }
    }

    function computeRosterPoliticalDistribution(rosterActors) {
      const counts = {};
      let total = 0;
      for (const a of rosterActors) {
        const k = readActorPoliticalPhilosophy(a);
        if (!k) continue;
        counts[k] = (counts[k] || 0) + 1;
        total += 1;
      }
      const dist = Object.entries(counts)
        .map(([key, count]) => ({ key, label: aaePoliticalLabel(key), count, pct: total ? Math.round((count/total)*100) : 0 }))
        .sort((a,b)=> b.count - a.count || a.label.localeCompare(b.label));

      const plurality = dist[0]?.key || "";
      const pluralityPct = dist[0]?.pct || 0;

      return { total, dist, plurality, pluralityPct };
    }
    /* === /AAE POLITICS (Faction Sheet) === */
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

function deepClone(obj) { return foundry.utils.duplicate(obj ?? {}); }

function allFactions() {
  return game.actors?.contents?.filter?.(isFactionActor) ?? [];
}

function listFactionActors() { return allFactions(); }

/* ===================================================================
   RIGS — DATA MODEL (Phase 1)
   =================================================================== */

const RIG_DAMAGE_STEPS = ["intact", "light", "heavy", "breached", "destroyed"];

function _capDamageStep(step) {
  const n = Number(step ?? 0) || 0;
  return Math.max(0, Math.min(RIG_DAMAGE_STEPS.length - 1, n));
}

function _rigEffPctFromStep(step) {
  const s = Number(step ?? 0) || 0;
  if (s <= 0) return 100;
  if (s === 1) return 75;
  if (s === 2) return 50;
  if (s === 3) return 25;
  return 0;
}


/** Return a 16-char id. Uses Foundry helper when available. */
function makeRigId() {
  try {
    if (foundry?.utils?.randomID) return foundry.utils.randomID(16);
  } catch {}
  return (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 16);
}

function _isPlainObject(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

function normalizeHitTrack(hitTrack) {
  const ht = _isPlainObject(hitTrack) ? hitTrack : {};
  const max = clamp0(ht.max ?? ht.hpMax ?? 0);
  let cur = clamp0(ht.current ?? ht.hp ?? max);
  if (max > 0) cur = Math.min(cur, max);
  return { max, current: cur };
}

function normalizeRigBonuses(raidBonuses) {
  const b = _isPlainObject(raidBonuses) ? raidBonuses : {};
  return deepClone(b);
}

// Phase 2 (prep): combat profile is optional but normalized when present.
function normalizeRigCombat(rawCombat) {
  const c = _isPlainObject(rawCombat) ? deepClone(rawCombat) : {};
  const role = String(c.role || "").trim().toLowerCase();
  const allowedRoles = new Set(["combat", "support", "scout", "command"]);

  const capMods = _isPlainObject(c.capMods) ? deepClone(c.capMods) : {};
  const systems = Array.isArray(c.systems)
    ? c.systems.map(s => String(s).trim()).filter(Boolean)
    : (typeof c.systems === "string" ? c.systems.split(",").map(s => s.trim()).filter(Boolean) : []);

  return {
    role: allowedRoles.has(role) ? role : "support", // safe default
    power: clamp0(c.power ?? 0),
    capMods,
    systems,
    signature: String(c.signature || "").trim(),
    notes: String(c.notes || "").trim()
  };
}

function normalizeRig(raw, { ownerFactionId } = {}) {
  const r = _isPlainObject(raw) ? deepClone(raw) : {};
  const now = Date.now();

  const rigId = String(r.rigId || r.id || makeRigId()).slice(0, 64);
  const name  = String(r.name || r.label || "Unnamed Rig").trim();
  const type  = String(r.type || "rig").trim().toLowerCase();

  const damageStepRaw =
    (typeof r.damageStep === "number")
      ? r.damageStep
      : (typeof r.damageStep === "string")
        ? RIG_DAMAGE_STEPS.indexOf(r.damageStep.toLowerCase().trim())
        : (typeof r.damageState === "string")
          ? RIG_DAMAGE_STEPS.indexOf(r.damageState.toLowerCase().trim())
          : 0;

  const damageStep = _capDamageStep(Number(damageStepRaw) || 0);
  const hitTrack = normalizeHitTrack(r.hitTrack);

  const mobilityTags = Array.isArray(r.mobilityTags)
    ? r.mobilityTags.map(s => String(s).trim()).filter(Boolean)
    : (typeof r.mobilityTags === "string"
      ? r.mobilityTags.split(",").map(s => s.trim()).filter(Boolean)
      : []);

  const turnEffectsRaw = Array.isArray(r.turnEffectsRaw)
    ? r.turnEffectsRaw
    : (typeof r.turnEffectsRaw === "string"
      ? [r.turnEffectsRaw]
      : []);

  const passiveBonuses = Array.isArray(r.passiveBonuses)
    ? r.passiveBonuses.map(b => (_isPlainObject(b) ? deepClone(b) : b)).filter(Boolean)
    : (typeof r.passiveBonuses === "string"
      ? (() => { try { const p = JSON.parse(r.passiveBonuses); return Array.isArray(p) ? p : []; } catch { return []; } })()
      : []);

  // UI helpers (Phase 1): show effectiveness + counts + summary
  const effPct = _rigEffPctFromStep(damageStep);
  const passiveCount = passiveBonuses.length;
  const passiveSummary = passiveBonuses
    .map(b => String(b?.label || b?.key || "").trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(", ") + (passiveBonuses.length > 2 ? "…" : "");

  return {
    rigId,
    name,
    type,
    ownerFactionId: String(r.ownerFactionId || ownerFactionId || "").trim(),
    hitTrack,
    damageStep,
    damageState: RIG_DAMAGE_STEPS[damageStep],
    raidBonuses: normalizeRigBonuses(r.raidBonuses),
    turnEffectsRaw,
    passiveBonuses,
    mobilityTags,
    combat: (r.combat ? normalizeRigCombat(r.combat) : null),
    createdTs: Number(r.createdTs || now),
    updatedTs: Number(r.updatedTs || now),

    // derived fields used by faction-sheet.hbs
    effPct,
    passiveCount,
    passiveSummary
  };
}

/**
 * Ensure flags.bbttcc-factions.rigs exists and elements are normalized.
 * Non-destructive.
 */
async function ensureFactionRigs(actor) {
  try {
    if (!actor || !isFactionActor(actor)) return false;

    const flags = deepClone(actor.flags?.[MODULE_ID] ?? {});
    const cur = flags.rigs;

    let rigs = Array.isArray(cur) ? cur : null;
    if (!rigs) rigs = [];

    const ownerFactionId = actor.id;
    const normalized = rigs.map(r => normalizeRig(r, { ownerFactionId }));

    const changed =
      !Array.isArray(cur) ||
      JSON.stringify(cur) !== JSON.stringify(normalized);

    if (!changed) return false;

    await actor.update({ [`flags.${MODULE_ID}.rigs`]: normalized }, { render: false });
    return true;
  } catch (e) {
    warn("ensureFactionRigs", e);
    return false;
  }
}

/** Convenience: resolve faction actor from id/actor. */
function resolveFactionActor(factionActorOrId) {
  if (!factionActorOrId) return null;
  if (typeof factionActorOrId === "string") return game.actors?.get(factionActorOrId) ?? null;
  if (factionActorOrId?.id && factionActorOrId?.documentName === "Actor") return factionActorOrId;
  return null;
}


/* ===================================================================
   DOCTRINE — FACTION FEAT ITEMS (Maneuvers + Strategics)
   - Items are embedded on the faction actor as type:"feat"
   - Canonical identity lives at flags.bbttcc.kind + flags.bbttcc.key
   - Mechanics remain in game.bbttcc.api.raid.EFFECTS (no duplication)
   =================================================================== */

// -----------------------------------------------------------------
// Doctrine Compendium (Single Source of Truth)
// Pack: bbttcc-master-content.doctrines
// - Embedded faction items remain *entitlement wrappers* (flags.bbttcc.kind/key)
// - Display/open/drag prefer the compendium entry when available.
// -----------------------------------------------------------------
const BBTTCC_DOCTRINE_PACK = "bbttcc-master-content.doctrines";
const __bbttccDoctrinePackCache = {
  ts: 0,
  map: null,  // Map "kind:key" -> { packId, docId, uuid, name, img }
  byKey: {}   // legacy/compat lookup cache
};

async function _bbttccGetDoctrineIndexMap() {
  try {
    const now = Date.now();
    if (__bbttccDoctrinePackCache.map && (now - (__bbttccDoctrinePackCache.ts || 0) < 30_000)) {
      return __bbttccDoctrinePackCache.map;
    }

    const pack = game.packs?.get?.(BBTTCC_DOCTRINE_PACK) || null;
    if (!pack) return new Map();

    let index = null;
    try {
      index = await pack.getIndex({ fields: ["name", "img", "flags.bbttcc.kind", "flags.bbttcc.key"] });
    } catch (_eIdx) {
      index = await pack.getIndex();
    }

    const rows = Array.isArray(index) ? index : (index?.contents || index?.documents || []);
    const map = new Map();
    for (const r of (rows || [])) {
      const f = r?.flags?.bbttcc || r?.flags?.["bbttcc"] || {};
      const kind = String(f.kind || "").toLowerCase().trim();
      const key  = String(f.key  || "").toLowerCase().trim();
      const docId = String(r._id || r.id || "").trim();
      if (!kind || !key || !docId) continue;

      map.set(kind + ":" + key, {
        packId: BBTTCC_DOCTRINE_PACK,
        docId,
        uuid: `Compendium.${BBTTCC_DOCTRINE_PACK}.Item.${docId}`,
        name: r.name || "",
        img: r.img || ""
      });
    }

    __bbttccDoctrinePackCache.ts = now;
    __bbttccDoctrinePackCache.map = map;
    __bbttccDoctrinePackCache.byKey = {}; // reset compat cache for safety
    return map;
  } catch (_e) {
    return new Map();
  }
}

function _bbttccIsDoctrineItem(it, kind) {
  try {
    if (!it) return false;
    if (String(it.type || "") !== "feat") return false;
    const f = it.flags?.bbttcc || {};
    const k = String(f.kind || "").toLowerCase();
    const key = String(f.key || "").toLowerCase();
    if (!k || !key) return false;
    if (kind && String(kind).toLowerCase() !== k) return false;
    return true;
  } catch (_e) { return false; }
}

function _bbttccListDoctrineItems(actor, kind) {
  try {
    const items = actor?.items ? Array.from(actor.items) : [];
    return items.filter(it => _bbttccIsDoctrineItem(it, kind));
  } catch (_e) { return []; }
}

function _bbttccOwnedDoctrineKeys(actor, kind) {
  const set = new Set();
  for (const it of _bbttccListDoctrineItems(actor, kind)) {
    try {
      const key = String(it?.flags?.bbttcc?.key || "").toLowerCase().trim();
      if (key) set.add(key);
    } catch (_e) {}
  }
  return set;
}

function _bbttccDoctrineLabelForKey(kind, key) {
  try {
    const EFFECTS = game.bbttcc?.api?.raid?.EFFECTS || {};
    const spec = EFFECTS[String(key || "").toLowerCase()];
    if (spec?.label) return String(spec.label);
  } catch (_e) {}
  // fallback: prettify
  return String(key || "")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function _bbttccGrantDoctrineEmbeddedItem(actor, { kind, key, silent=false } = {}) {
  const a = resolveFactionActor(actor) || actor;
  if (!a) throw new Error("Doctrine grant: invalid faction actor");

  const k = String(kind || "").toLowerCase().trim();
  const kk = String(key || "").toLowerCase().trim();
  if (!k || !kk) throw new Error("Doctrine grant: missing kind/key");
  if (!["maneuver", "strategic"].includes(k)) throw new Error("Doctrine grant: invalid kind");

  const owned = _bbttccOwnedDoctrineKeys(a, k);
  if (owned.has(kk)) return { ok:true, already:true };

  // Validate against EFFECTS when available (authoritative set)
  const EFFECTS = game.bbttcc?.api?.raid?.EFFECTS || {};
  const spec = EFFECTS[kk] || null;
  if (!spec) {
    // Fail-open for authoring worlds where EFFECTS isn't loaded yet
    warn(`Doctrine grant: EFFECTS missing key '${kk}'. Creating item anyway (alpha-safe).`);
  }

  const itemData = {
    name: spec?.label || _bbttccDoctrineLabelForKey(k, kk),
    type: "feat",
    flags: { bbttcc: { kind: k, key: kk } }
  };

  await a.createEmbeddedDocuments("Item", [itemData]);

  // Optional war log receipt
  if (!silent) {
    try {
      const logs = Array.isArray(a.getFlag(MODULE_ID, "warLogs"))
        ? foundry.utils.duplicate(a.getFlag(MODULE_ID, "warLogs"))
        : [];
      const ts = Date.now();
      logs.push({ ts, date: new Date(ts).toLocaleString(), type: "doctrine", summary: `Doctrine gained: ${itemData.name}` });
      await a.setFlag(MODULE_ID, "warLogs", logs);
    } catch (_e) {}
  }

  return { ok:true, created:true, kind:k, key:kk };
}


const _BBTTCC_STANDARD_START_MANEUVERS = [
  "suppressive_fire",
  "patch_the_breach",
  "smoke_and_mirrors",
  "flank_attack"
];
const _BBTTCC_STANDARD_START_STRATEGICS = [
  "harvest_season",
  "minor_repair",
  "develop_outpost_stability",
  "establish_outpost",
  "establish_supply_line",
  "establish_trade_route",
  "found_site_farm",
  "found_site_fortress",
  "found_site_mine",
  "found_site_port",
  "found_site_research",
  "upgrade_outpost_settlement",
  "develop_infrastructure_std"
];

// Ensure a faction has baseline doctrine (standard package).
// - If the faction has zero doctrine items, stamp the standard baseline silently.
// - Safe to call repeatedly (grant checks for duplicates).
async function _bbttccEnsureBaselineDoctrine(actor){
  try {
    const a = resolveFactionActor(actor) || actor;
    if (!a || !isFactionActor(a)) return false;

    const seedMeta = a.getFlag?.(MODULE_ID, "doctrineSeedMeta") || {};
    if (seedMeta?.inProgress || seedMeta?.applied) return false;

    const hasAny =
      (_bbttccListDoctrineItems(a, "maneuver").length > 0) ||
      (_bbttccListDoctrineItems(a, "strategic").length > 0);

    if (hasAny) return false;

    for (const k of _BBTTCC_STANDARD_START_MANEUVERS) {
      try { await _bbttccGrantDoctrineEmbeddedItem(a, { kind:"maneuver", key:String(k), silent:true }); } catch(_e){}
    }
    for (const k of _BBTTCC_STANDARD_START_STRATEGICS) {
      try { await _bbttccGrantDoctrineEmbeddedItem(a, { kind:"strategic", key:String(k), silent:true }); } catch(_e){}
    }

    try {
      await a.update({
        [`flags.${MODULE_ID}.doctrineSeedMeta`]: {
          packageKey: "standard",
          version: "1.0.0",
          inProgress: false,
          applied: true,
          source: "ensureBaselineDoctrine",
          updatedTs: Date.now()
        }
      });
    } catch (_e) {}

    return true;
  } catch (_e) { return false; }
}


/* ===================================================================
   RIGS → TRAVEL BRIDGE (Phase 1/2/3/4/5 + Mitigation Report)
   - Phase 1: attach resolved rigs + travel bonuses to ctx (read-only)
   - Phase 2: apply scaled op deltas to ctx.cost (safe, clamped)
   - Phase 3: hazardChance → probabilistic preventHazard
   - Phase 4: travelDefense → DC reduction via ctx.dcMod
   - Phase 5: encounterTierBias.down → terrainTier downshift
   - Report: ctx.rigMitigationReport for UI/abilities later
   =================================================================== */

function _roundAwayFromZero(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x) || x === 0) return 0;
  return x < 0 ? Math.floor(x) : Math.ceil(x);
}

function _normalizeRigTravelBonus(b) {
  // Passive bonuses are expected to be plain objects; keep as-is but deepClone
  return _isPlainObject(b) ? deepClone(b) : null;
}

function _resolveFactionFromTravelCtx(ctx) {
  const a = ctx?.actor;
  if (a && isFactionActor(a)) return a;
  const fid = ctx?.factionId;
  if (fid) {
    const fa = game.actors?.get(fid);
    if (fa && isFactionActor(fa)) return fa;
  }
  return null;
}

function _installRigTravelBridge() {
  try {
    if (game.bbttcc?.__rigTravelBridgeInstalled) return;
    game.bbttcc ??= {};
    game.bbttcc.__rigTravelBridgeInstalled = true;

    Hooks.on("bbttcc:beforeTravel", (ctx) => {
      try {
        const faction = _resolveFactionFromTravelCtx(ctx);
        const rigsRaw = faction ? faction.getFlag(MODULE_ID, "rigs") : [];
        const rigs = Array.isArray(rigsRaw)
          ? rigsRaw.map(r => normalizeRig(r, { ownerFactionId: faction?.id })).filter(Boolean)
          : [];

        /* ------------------------------------------------------------
         * Phase 1 — Resolve rig travel bonuses (read-only)
         * ------------------------------------------------------------ */
        const travelBonuses = [];
        for (const r of rigs) {
          const pb = Array.isArray(r.passiveBonuses) ? r.passiveBonuses : [];
          for (const b0 of pb) {
            const b = _normalizeRigTravelBonus(b0);
            if (!b) continue;
            if (String(b.kind || "").trim().toLowerCase() !== "travel") continue;

            const effPct = Number(r.effPct ?? 100);
            const scalar = Math.max(0, Math.min(1, effPct / 100));

            travelBonuses.push({
              rigId: r.rigId,
              rigName: r.name,
              effPct,
              scalar,
              bonus: b
            });
          }
        }

        ctx.rigsResolved = rigs;
        ctx.rigTravelBonusesResolved = travelBonuses;
        ctx.rigSummary = {
          rigCount: rigs.length,
          bonusCount: travelBonuses.length,
          names: rigs.map(r => r?.name).filter(Boolean)
        };

        /* ------------------------------------------------------------
         * Phase 2 — OP cost deltas (scaled, round-away-from-zero)
         * ------------------------------------------------------------ */
        const before = deepClone(ctx.cost || {});
        const delta = {};

        for (const entry of travelBonuses) {
          const op = entry?.bonus?.op;
          if (!_isPlainObject(op)) continue;

          for (const [k, v] of Object.entries(op)) {
            const raw = Number(v || 0);
            if (!Number.isFinite(raw) || raw === 0) continue;

            const scaled = raw * Number(entry.scalar || 0);
            const step = _roundAwayFromZero(scaled);
            if (!step) continue;

            delta[k] = (Number(delta[k] || 0) + step);
          }
        }

        const after = deepClone(before);
        if (_isPlainObject(after)) {
          for (const [k, dv] of Object.entries(delta)) {
            const cur = Number(after[k] || 0);
            after[k] = Math.max(0, cur + Number(dv || 0));
          }
        }

        ctx.rigCostBefore = before;
        ctx.rigCostDelta  = delta;
        ctx.rigCostAfter  = after;

        // Apply in-place so spendOP sees the modified cost
        if (_isPlainObject(ctx.cost)) {
          for (const [k, v] of Object.entries(after)) ctx.cost[k] = v;
        } else {
          ctx.cost = after;
        }

        /* ------------------------------------------------------------
         * Phase 3 — hazardChance → probabilistic preventHazard
         * ------------------------------------------------------------ */
        let hazardDelta = 0;
        for (const entry of travelBonuses) {
          const hz = Number(entry?.bonus?.hazardChance ?? 0);
          if (!Number.isFinite(hz) || hz === 0) continue;
          hazardDelta += hz * Number(entry.scalar || 0);
        }

        const preventChance = Math.max(0, Math.min(0.95, -hazardDelta));

        ctx.rigHazardDelta = hazardDelta;
        ctx.rigHazardPreventChance = preventChance;

        if (!ctx.preventHazard && preventChance > 0) {
          const roll01 = Math.random();
          ctx.rigHazardRoll = roll01;
          if (roll01 < preventChance) {
            ctx.preventHazard = true;
            ctx.rigHazardPrevented = true;
          } else {
            ctx.rigHazardPrevented = false;
          }
        } else {
          ctx.rigHazardRoll = null;
          ctx.rigHazardPrevented = !!ctx.preventHazard;
        }

        /* ------------------------------------------------------------
         * Phase 4 — travelDefense → DC reduction via ctx.dcMod
         * ------------------------------------------------------------ */
        let travelDefenseRaw = 0;
        for (const entry of travelBonuses) {
          const td = Number(entry?.bonus?.travelDefense ?? 0);
          if (!Number.isFinite(td) || td === 0) continue;
          travelDefenseRaw += td * Number(entry.scalar || 0);
        }

        const travelDefenseStep = _roundAwayFromZero(travelDefenseRaw);

        ctx.rigTravelDefenseRaw = travelDefenseRaw;
        ctx.rigTravelDefenseStep = travelDefenseStep;
        ctx.rigDcModBefore = Number(ctx.dcMod || 0);

        if (travelDefenseStep) {
          ctx.dcMod = Number(ctx.dcMod || 0) - travelDefenseStep;
        }

        ctx.rigDcModAfter = Number(ctx.dcMod || 0);

        /* ------------------------------------------------------------
         * Phase 5 — encounterTierBias.down → terrainTier downshift
         * (affects DC + encounter tier consistently, no Travel edits)
         * ------------------------------------------------------------ */
        let tierDownRaw = 0;
        for (const entry of travelBonuses) {
          const down = Number(entry?.bonus?.encounterTierBias?.down ?? 0);
          if (!Number.isFinite(down) || down === 0) continue;
          tierDownRaw += down * Number(entry.scalar || 0);
        }

        const tierDownStep = _roundAwayFromZero(tierDownRaw);

        ctx.rigTierDownRaw = tierDownRaw;
        ctx.rigTierDownStep = tierDownStep;
        ctx.rigTerrainTierBefore = Number(ctx.terrainTier || 1);

        if (tierDownStep) {
          const curTier = Number(ctx.terrainTier || 1);
          ctx.terrainTier = Math.max(1, curTier - tierDownStep);
        }

        ctx.rigTerrainTierAfter = Number(ctx.terrainTier || 1);

        /* ------------------------------------------------------------
         * Mitigation Report — reusable summary for UI / abilities later
         * ------------------------------------------------------------ */
        const sources = travelBonuses.map(e => ({
          rigId: e.rigId,
          rigName: e.rigName,
          effPct: e.effPct,
          scalar: e.scalar,
          key: e?.bonus?.key || "",
          label: e?.bonus?.label || e?.bonus?.key || "",
          kind: e?.bonus?.kind || "travel"
        }));

        ctx.rigMitigationReport = {
          factionId: ctx.factionId,
          factionName: ctx.actor?.name || "",
          rigCount: rigs.length,
          bonusCount: travelBonuses.length,
          // Phase 2
          costBefore: ctx.rigCostBefore,
          costDelta: ctx.rigCostDelta,
          costAfter: ctx.rigCostAfter,
          // Phase 3
          hazardDelta: ctx.rigHazardDelta,
          hazardPreventChance: ctx.rigHazardPreventChance,
          hazardRoll: ctx.rigHazardRoll,
          hazardPrevented: ctx.rigHazardPrevented,
          // Phase 4
          travelDefenseRaw: ctx.rigTravelDefenseRaw,
          travelDefenseStep: ctx.rigTravelDefenseStep,
          dcModBefore: ctx.rigDcModBefore,
          dcModAfter: ctx.rigDcModAfter,
          // Phase 5
          tierDownRaw: ctx.rigTierDownRaw,
          tierDownStep: ctx.rigTierDownStep,
          terrainTierBefore: ctx.rigTerrainTierBefore,
          terrainTierAfter: ctx.rigTerrainTierAfter,
          // Sources
          sources
        };

      } catch (e) {
        warn("rig travel bridge hook failed", e);
      }
    });

    log("ready — rig travel bridge installed (Phase 1/2/3/4/5 + report)");
  } catch (e) {
    warn("install rig travel bridge failed", e);
  }
}


// === Sprint: Tier + Assets + Pressure UI/Flags (enhancer-only) ===
try {
  // If you prefer static imports, move these to top-level.
  await import(`./faction-pressure.enhancer.js`);
  await import(`./faction-tier-victorygate.enhancer.js`);
  await import(`./faction-tier-assets-ui.enhancer.js`);
  await import(`./faction-tier-stability.enhancer.js`);
  await import(`./faction-tier-advance-button.enhancer.js`);
  await import(`./faction-tier-advancement-api.enhancer.js`);
  console.log("[bbttcc-factions] Tier/Assets/Pressure enhancers loaded.");
} catch (e) {
  console.warn("[bbttcc-factions] Failed to load Tier/Assets/Pressure enhancers:", e);
}



/* ===================================================================
   TERRITORY OWNERSHIP + HINTS
   =================================================================== */

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

      const flags = actor.flags?.[MODULE_ID] ?? {};
      if (!Array.isArray(flags.rigs)) {
        updates[`flags.${MODULE_ID}.rigs`] = [];
      }
    } else {
      if (actor.getFlag(MODULE_ID, "isFaction")) {
        updates[`flags.${MODULE_ID}.isFaction`] = null;
      }
    }

    if (Object.keys(updates).length) {
      await actor.update(updates);
    }

    if (isFac) {
      await ensureFactionRigs(actor);
      try { await _bbttccEnsureBaselineDoctrine(actor); } catch(_e) {}
    }
  } catch (e) {
    warn("ensureFactionHints", e);
  }
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
   OWNED HEX LIST (player-facing)
   =================================================================== */

async function _listOwnedHexesForFaction(faction, scope /* "scene" | "all" */) {
  try {
    const rows = [];
    const scenes = scope === "all" ? (game.scenes?.contents ?? []) : [canvas?.scene].filter(Boolean);

    for (const sc of scenes) {
      for (const d of sc.drawings?.contents ?? []) {
        const tf = d.flags?.[TER_MOD] ?? {};
        const isHex = (tf.isHex === true) || (tf.kind === "territory-hex") ||
          (d.shape?.type === "p" && Array.isArray(d.shape?.points) && d.shape.points.length === 12);
        if (!isHex) continue;
        if (!_ownedByFaction(d, faction)) continue;

        rows.push({
          uuid: d.uuid,
          sceneName: sc.name || "—",
          name: String(tf.name || d.text || d.name || "").trim() || `Hex ${d.id}`,
          type: String(tf.type || "settlement"),
          size: String(tf.size || "town"),
          status: String(tf.status || "claimed"),
          capital: !!tf.capital,
          integrationProgress: Number(tf.integration?.progress ?? 0) || 0
        });
      }
    }

    rows.sort((a,b) => (b.capital?1:0)-(a.capital?1:0)
      || a.sceneName.localeCompare(b.sceneName)
      || a.name.localeCompare(b.name));

    return rows;
  } catch (e) {
    warn("_listOwnedHexesForFaction failed", e);
    return [];
  }
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

/* ---------- Raid Plan helpers ---------- */
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

/* ===================================================================
   RIG CONSOLE (Facility Builder parity)
   - Opens from Faction Sheet Rig table (Add Rig / Bonuses)
   - Uses template: modules/bbttcc-factions/templates/rig-config-app.hbs
   - Uses css:      modules/bbttcc-factions/styles/rig-config.css
   =================================================================== */

async function _ensureRigConsoleCssLoaded() {
  try {
    const href = `modules/${MODULE_ID}/styles/rig-config.css`;
    if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(l => (l.href || "").includes("rig-config.css"))) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = href;
    document.head.appendChild(link);
  } catch (e) {
    warn("rig-config.css load failed", e);
  }
}

function _safeJsonParse(txt, fallback) {
  try { return JSON.parse(txt); } catch { return fallback; }
}

function _toNum(v, d = 0) {
  // Normalize unicode minus/dashes to ASCII '-' and parse safely
  if (typeof v === "string") {
    v = v
      .replace(/[−–—]/g, "-")   // U+2212, en-dash, em-dash
      .replace(/[^\d.\-+]/g, "") // strip any stray characters (safety)
      .trim();
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

// Rig templates (Apply Template)
const RIG_PRESETS = {
  /* ------------------------
   * Generic starters
   * ------------------------ */
  "war-rig": {
    name: "War Rig",
    type: "war-rig",
    hitMax: 10,
    raidDefense: 2,
    mobilityTags: "tracked, armored",
    combat: { role: "combat", power: 3, capMods: { violence: 2 }, systems: ["armor_plating"], signature: "breakthrough" },
    passiveBonuses: [
      { key: "armored_screen", label: "Armored Screen", kind: "travel", travelDefense: 1, notes: "Reduces losses from ambushes while traveling." }
    ]
  },
  "support-rig": {
    name: "Support Rig",
    type: "support-rig",
    hitMax: 8,
    raidDefense: 1,
    mobilityTags: "wheeled, logistics",
    combat: { role: "support", power: 2, capMods: { logistics: 2, economy: 1 }, systems: ["repair_teams"], signature: "patch_and_push" },
    passiveBonuses: [
      { key: "quartermaster_train", label: "Quartermaster Train", kind: "travel", op: { economy: -1 }, hazardChance: -0.05, notes: "Improves supply efficiency and route planning." }
    ]
  },
  "scout-rig": {
    name: "Scout Rig",
    type: "scout-rig",
    hitMax: 6,
    raidDefense: 0,
    mobilityTags: "fast, recon",
    combat: { role: "scout", power: 2, capMods: { intrigue: 2, logistics: 1 }, systems: ["route_scanner"], signature: "hit_and_vanish" },
    passiveBonuses: [
      { key: "forward_scouts", label: "Forward Scouts", kind: "travel", hazardChance: -0.10, encounterTierBias: { down: 1 }, notes: "Spots danger early; nudges encounters downward." }
    ]
  },

  /* ------------------------
   * Canonical named rigs (Registry v1)
   * NOTE: These are still 'templates' (Phase 1) — they stamp identity,
   * tags, HP/defense, and travel-ready passives. Combat profiles will
   * be added in the next step (rig.combat) without breaking existing rigs.
   * ------------------------ */

  // SCOUT
  "jackalope-sprinter": {
    name: "Jackalope Sprinter",
    type: "scout-rig",
    hitMax: 8,
    raidDefense: 1,
    mobilityTags: "scout, fast, interdict, terrain-hopper",
    combat: { role: "scout", power: 2, capMods: { logistics: 2, intrigue: 1 }, systems: ["route_scanner", "signal_mask"], signature: "hit_and_vanish" },
    passiveBonuses: [
      { key: "forward_scouts", label: "Forward Scouts", kind: "travel", hazardChance: -0.10, encounterTierBias: { down: 1 }, notes: "Spots danger early; nudges encounters downward." },
      { key: "hazard_dampeners", label: "Hazard Dampeners", kind: "travel", hazardChance: -0.05, notes: "Shock absorbers + sensors reduce hazard frequency." }
    ]
  },
  "needlewing-courier-skiff": {
    name: "Needlewing Courier Skiff",
    type: "scout-rig",
    hitMax: 7,
    raidDefense: 0,
    mobilityTags: "scout, stealthy, messenger, air-gap",
    combat: { role: "scout", power: 2, capMods: { intrigue: 2, diplomacy: 1 }, systems: ["signal_mask"], signature: "black_bag_drop" },
    passiveBonuses: [
      { key: "signal_mask", label: "Signal Mask", kind: "travel", hazardChance: -0.05, notes: "Masks signatures; reduces detection/ambush odds." },
      { key: "route_scanner", label: "Route Scanner", kind: "travel", encounterTierBias: { down: 1 }, notes: "Improves recon; tends to select safer legs." }
    ]
  },

  // SUPPORT
  "attaccountant-auditor-platform": {
    name: "Attaccountant Auditor Platform",
    type: "support-rig",
    hitMax: 10,
    raidDefense: 2,
    mobilityTags: "support, armored, ledger-magic, compliance",
    combat: { role: "support", power: 3, capMods: { economy: 3, intrigue: 2, diplomacy: 1 }, systems: ["abacus_array", "compliance_bulwark"], signature: "ledger_lock" },
    passiveBonuses: [
      { key: "quartermaster_train", label: "Quartermaster Train", kind: "travel", op: { economy: -1 }, notes: "Audit-driven supply efficiency; trims economy spend." },
      { key: "armored_screen", label: "Armored Screen", kind: "travel", travelDefense: 1, notes: "Compliance plating reduces travel losses from ambushes." }
    ]
  },
  "field-workshop-crawler": {
    name: "Field Workshop Crawler",
    type: "support-rig",
    hitMax: 11,
    raidDefense: 1,
    mobilityTags: "support, repair, builder, heavy",
    combat: { role: "support", power: 2, capMods: { logistics: 3, economy: 1 }, systems: ["spare_parts_vault"], signature: "patch_and_push" },
    passiveBonuses: [
      { key: "quartermaster_train", label: "Quartermaster Train", kind: "travel", op: { economy: -1 }, notes: "Parts discipline reduces waste and improves routing." },
      { key: "repair_teams", label: "Repair Teams", kind: "travel", travelDefense: 1, notes: "Field repairs keep the column moving; reduces travel DC via defense." }
    ]
  },
  "chorus-relay-shrine": {
    name: "Chorus Relay Shrine",
    type: "support-rig",
    hitMax: 9,
    raidDefense: 1,
    mobilityTags: "support, ritual, broadcast, tiferet-adjacent",
    combat: { role: "support", power: 3, capMods: { softpower: 3, faith: 2 }, systems: ["choir_antennae"], signature: "harmony_pulse" },
    passiveBonuses: [
      { key: "harmony_pulse", label: "Harmony Pulse", kind: "travel", hazardChance: -0.05, notes: "Stabilizing resonance reduces travel hazards." },
      { key: "forward_scouts", label: "Chorus Pathfinding", kind: "travel", encounterTierBias: { down: 1 }, notes: "A singing network tends to find the calmer route." }
    ]
  },

  // COMBAT
  "burrow-blaster": {
    name: "Burrow Blaster",
    type: "war-rig",
    hitMax: 14,
    raidDefense: 2,
    mobilityTags: "combat, siege, subterranean, ambush",
    combat: { role: "combat", power: 4, capMods: { violence: 3, logistics: 1, intrigue: 1 }, systems: ["seismic_drill", "tremor_mortar"], signature: "subterranean_shock" },
    passiveBonuses: [
      { key: "hazard_dampeners", label: "Seismic Stabilizers", kind: "travel", hazardChance: -0.05, notes: "Dampeners reduce hazard frequency on rough legs." },
      { key: "armored_screen", label: "Hull Plating", kind: "travel", travelDefense: 1, notes: "Heavy plating improves travel defense." }
    ]
  },
  "red-herring-chassis": {
    name: "War-Rig Chassis (Red Herring Pattern)",
    type: "war-rig",
    hitMax: 13,
    raidDefense: 2,
    mobilityTags: "combat, armored, multi-role, raid-ready",
    combat: { role: "combat", power: 4, capMods: { violence: 2, intrigue: 2 }, systems: ["spike_ram"], signature: "breakthrough" },
    passiveBonuses: [
      { key: "armored_screen", label: "Armored Screen", kind: "travel", travelDefense: 1, notes: "Reduces losses from ambushes while traveling." }
    ]
  },
  "knotsteel-longboat-tank": {
    name: "Knotsteel Longboat Tank",
    type: "war-rig",
    hitMax: 15,
    raidDefense: 2,
    mobilityTags: "combat, boarding, shock, valhaulan",
    combat: { role: "combat", power: 3, capMods: { violence: 3, diplomacy: 1 }, systems: ["knot_glyph_plating"], signature: "boarding_party" },
    passiveBonuses: [
      { key: "armored_screen", label: "Knot-Glyph Plating", kind: "travel", travelDefense: 1, notes: "Warded plating blunts ambush damage." },
      { key: "forward_scouts", label: "Raid Instincts", kind: "travel", hazardChance: -0.05, notes: "Veteran crews sniff out trouble early." }
    ]
  },

  // COMMAND
  "oracle-spindle-war-tower": {
    name: "War Tower (Oracle Spindle)",
    type: "custom",
    hitMax: 16,
    raidDefense: 3,
    mobilityTags: "command, doctrine-amplifier, signal, fortress",
    combat: { role: "command", power: 5, capMods: { intrigue: 3, diplomacy: 3, logistics: 2 }, systems: ["field_tribunal", "signal_web"], signature: "command_override" },
    passiveBonuses: [
      { key: "quartermaster_train", label: "Signal Web Logistics", kind: "travel", op: { logistics: -1 }, notes: "Command routing reduces logistics spend (Phase 2 travel bridge)." },
      { key: "armored_screen", label: "Fortress Envelope", kind: "travel", travelDefense: 1, notes: "The tower projects protective geometry while moving." }
    ]
  }
};

// Passive bonus presets (Add dropdown)
const PASSIVE_BONUS_PRESETS = {
  "quartermaster_train": {
    key: "quartermaster_train",
    label: "Quartermaster Train",
    kind: "travel",
    op: { economy: -1 },
    hazardChance: -0.05,
    encounterTierBias: { down: 0 },
    travelDefense: 0,
    notes: "Improves supply efficiency and route planning."
  },
  "hazard_dampeners": {
    key: "hazard_dampeners",
    label: "Hazard Dampeners",
    kind: "travel",
    op: {},
    hazardChance: -0.10,
    encounterTierBias: { down: 1 },
    travelDefense: 0,
    notes: "Sensors and dampeners reduce hazard frequency."
  },
  "forward_scouts": {
    key: "forward_scouts",
    label: "Forward Scouts",
    kind: "travel",
    op: {},
    hazardChance: -0.05,
    encounterTierBias: { down: 1 },
    travelDefense: 0,
    notes: "Spots danger early; nudges encounters downward."
  },
  "armored_screen": {
    key: "armored_screen",
    label: "Armored Screen",
    kind: "travel",
    op: {},
    hazardChance: 0,
    encounterTierBias: {},
    travelDefense: 1,
    notes: "Reduces losses from ambushes while traveling."
  }
};

// Turn effect presets (Add → appends JSON array)
const TURN_EFFECT_PRESETS = {
  "regen_minor_hp": { key: "regen_minor_hp", amount: 1, notes: "Repairs 1 HP per turn (if not destroyed)." },
  "supply_cache": { key: "supply_cache", economy: 1, notes: "Adds +1 Economy OP during turn regen." },
  "warding_field": { key: "warding_field", defense: 1, notes: "Adds +1 defense to raid math while active." }
};

const RIG_COMBAT_ROLE_OPTIONS = ["combat", "support", "scout", "command"];
const RIG_SIGNATURE_OPTIONS = [
  "breakthrough",
  "patch_and_push",
  "hit_and_vanish",
  "black_bag_drop",
  "ledger_lock",
  "harmony_pulse",
  "subterranean_shock",
  "boarding_party",
  "command_override"
];
const RIG_COMBAT_SYSTEM_OPTIONS = [
  "armor_plating",
  "repair_teams",
  "route_scanner",
  "signal_mask",
  "abacus_array",
  "compliance_bulwark",
  "spare_parts_vault",
  "choir_antennae",
  "seismic_drill",
  "tremor_mortar",
  "spike_ram",
  "knot_glyph_plating",
  "field_tribunal",
  "signal_web"
];
const RIG_CAPMOD_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];

function _applyRigPresetToForm(form, presetKey) {
  const p = RIG_PRESETS[presetKey];
  if (!form || !p) return;

  // Store optional combat profile on the form so Save can persist it
  // without requiring new template fields.
  try {
    if (p.combat) form.dataset.bbttccCombatPreset = JSON.stringify(p.combat);
    else delete form.dataset.bbttccCombatPreset;
  } catch {}

  // Stash combat profile on the form (no UI yet). Save handler will persist it.
  try {
    if (p.combat) form.dataset.bbttccCombatPreset = JSON.stringify(p.combat);
    else delete form.dataset.bbttccCombatPreset;
  } catch {}

  const set = (name, value) => {
    const el = form.querySelector(`[name="${name}"]`);
    if (!el) return;
    el.value = value;
  };

  set("rig.name", p.name);
  set("rig.type", p.type);
  set("rig.hitMax", p.hitMax);
  set("rig.raidDefense", p.raidDefense);
  set("rig.mobilityTags", p.mobilityTags);

  const txt = JSON.stringify(p.passiveBonuses || [], null, 2);
  set("rig.passiveBonusesRaw", txt);
  const adv = form.querySelector('[data-role="passive-json-advanced"]');
  if (adv) adv.value = txt;
}

function _normalizePassiveBonusForGui(b) {
  const out = deepClone(_isPlainObject(b) ? b : {});
  out.key = String(out.key || "").trim() || foundry.utils.randomID(8);
  out.label = String(out.label || out.key).trim();
  out.kind = String(out.kind || "travel").trim();

  out.op = _isPlainObject(out.op) ? out.op : {};
  if (out.op.economy == null) out.op.economy = 0;

  out.hazardChance = _toNum(out.hazardChance, 0);
  out.travelDefense = _toNum(out.travelDefense, 0);

  out.encounterTierBias = _isPlainObject(out.encounterTierBias) ? out.encounterTierBias : {};
  if (out.encounterTierBias.down == null) out.encounterTierBias.down = 0;

  out.notes = String(out.notes || "").trim();
  return out;
}

function _renderPassiveList(container, bonuses) {
  if (!container) return;
  container.replaceChildren();

  const mk = (label, name, value, type = "text", hint = "") => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const lab = document.createElement("label");
    lab.textContent = label;
    const inp = document.createElement("input");
    inp.name = name;
    inp.type = type;
    inp.value = value ?? "";
    wrap.appendChild(lab);
    wrap.appendChild(inp);
    if (hint) {
      const sm = document.createElement("small");
      sm.textContent = hint;
      wrap.appendChild(sm);
    }
    return wrap;
  };

  bonuses.forEach((b, idx) => {
    const bonus = _normalizePassiveBonusForGui(b);

    const box = document.createElement("div");
    box.style.padding = ".35rem";
    box.style.border = "1px solid rgba(255,255,255,0.08)";
    box.style.borderRadius = ".6rem";
    box.style.background = "rgba(0,0,0,0.12)";
    box.dataset.idx = String(idx);

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "1fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr auto";
    grid.style.gap = ".4rem";
    grid.style.alignItems = "end";

    grid.appendChild(mk("Label", "label", bonus.label));
    grid.appendChild(mk("Key", "key", bonus.key));
    grid.appendChild(mk("Econ OP", "econ", String(bonus.op?.economy ?? 0), "number"));
    grid.appendChild(mk("Hazard %", "hazard", String(bonus.hazardChance ?? 0), "number", "Use -0.05 for -5%"));
    grid.appendChild(mk("Tier Down", "tierDown", String(bonus.encounterTierBias?.down ?? 0), "number"));
    grid.appendChild(mk("Defense", "def", String(bonus.travelDefense ?? 0), "number"));

    const btns = document.createElement("div");
    btns.style.display = "flex";
    btns.style.gap = ".25rem";

    const del = document.createElement("button");
    del.type = "button";
    del.className = "bbttcc-button";
    del.dataset.action = "passive-del";
    del.dataset.idx = String(idx);
    del.innerHTML = `<i class="fas fa-trash"></i>`;
    del.title = "Remove";
    btns.appendChild(del);

    grid.appendChild(btns);

    const notes = document.createElement("div");
    notes.className = "field";
    notes.style.gridColumn = "1 / -1";
    notes.innerHTML = `
      <label>Notes</label>
      <input name="notes" type="text" value="${foundry.utils.escapeHTML(bonus.notes || "")}">
    `;

    box.appendChild(grid);
    box.appendChild(notes);
    container.appendChild(box);
  });
}

function _normalizeTurnEffectForGui(effect) {
  const out = _isPlainObject(effect) ? deepClone(effect) : {};
  out.key = String(out.key || "").trim() || foundry.utils.randomID(8);
  out.amount = _toNum(out.amount, 0);
  out.economy = _toNum(out.economy, 0);
  out.defense = _toNum(out.defense, 0);
  out.notes = String(out.notes || "").trim();
  return out;
}

function _renderTurnEffectList(container, effects) {
  if (!container) return;
  container.replaceChildren();

  const mk = (label, name, value, type = "text", hint = "") => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const lab = document.createElement("label");
    lab.textContent = label;
    const inp = document.createElement("input");
    inp.name = name;
    inp.type = type;
    inp.value = value ?? "";
    wrap.appendChild(lab);
    wrap.appendChild(inp);
    if (hint) {
      const sm = document.createElement("small");
      sm.textContent = hint;
      wrap.appendChild(sm);
    }
    return wrap;
  };

  effects.forEach((e, idx) => {
    const effect = _normalizeTurnEffectForGui(e);
    const box = document.createElement("div");
    box.className = "bbttcc-rig-rowbox";
    box.dataset.idx = String(idx);

    const grid = document.createElement("div");
    grid.className = "bbttcc-rig-grid-turn";
    grid.appendChild(mk("Effect Key", "key", effect.key));
    grid.appendChild(mk("Repair", "amount", String(effect.amount ?? 0), "number", "HP repaired per turn"));
    grid.appendChild(mk("Economy", "economy", String(effect.economy ?? 0), "number", "Turn regen delta"));
    grid.appendChild(mk("Defense", "defense", String(effect.defense ?? 0), "number", "Raid defense delta"));

    const btns = document.createElement("div");
    btns.className = "bbttcc-rig-row-actions";
    const del = document.createElement("button");
    del.type = "button";
    del.className = "bbttcc-button";
    del.dataset.action = "turn-del";
    del.dataset.idx = String(idx);
    del.innerHTML = '<i class="fas fa-trash"></i>';
    del.title = "Remove";
    btns.appendChild(del);
    grid.appendChild(btns);

    const notes = document.createElement("div");
    notes.className = "field";
    notes.style.gridColumn = "1 / -1";
    notes.innerHTML = `
      <label>Notes</label>
      <input name="notes" type="text" value="${foundry.utils.escapeHTML(effect.notes || "")}">`;

    box.appendChild(grid);
    box.appendChild(notes);
    container.appendChild(box);
  });
}

function _readTurnEffectList(container, currentEffects) {
  const boxes = [...container.querySelectorAll("[data-idx]")];
  const next = currentEffects.map(_normalizeTurnEffectForGui);

  for (const box of boxes) {
    const idx = Number(box.dataset.idx);
    const get = (name) => box.querySelector(`[name="${name}"]`)?.value;
    const cur = next[idx] ?? _normalizeTurnEffectForGui({});
    cur.key = String(get("key") || cur.key).trim() || foundry.utils.randomID(8);
    cur.amount = _toNum(get("amount"), 0);
    cur.economy = _toNum(get("economy"), 0);
    cur.defense = _toNum(get("defense"), 0);
    cur.notes = String(get("notes") || "").trim();
    next[idx] = cur;
  }
  return next;
}

function _encodeRigTurnEffects(effects) {
  return JSON.stringify((Array.isArray(effects) ? effects : []).map(_normalizeTurnEffectForGui), null, 2);
}

function _readCombatSystems(form, fallback) {
  const hidden = form?.querySelector('[name="rig.combat.systemsCsv"]');
  const source = String(hidden?.value || (Array.isArray(fallback) ? fallback.join(", ") : "") || "");
  const seen = new Set();
  return source.split(",").map(s => String(s || "").trim()).filter(Boolean).filter(s => {
    const key = s.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function _writeCombatSystems(form, systems) {
  const next = [];
  const seen = new Set();
  for (const s of (Array.isArray(systems) ? systems : [])) {
    const clean = String(s || "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(clean);
  }
  const hidden = form?.querySelector('[name="rig.combat.systemsCsv"]');
  if (hidden) hidden.value = next.join(', ');
  return next;
}

function _renderCombatSystems(form, systems) {
  if (!form) return;
  const list = form.querySelector('[data-role="combat-systems-list"]');
  const empty = form.querySelector('[data-role="combat-systems-empty"]');
  const next = _writeCombatSystems(form, systems);
  if (!list) return;
  list.innerHTML = '';
  if (!next.length) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  next.forEach((sys, idx) => {
    const chip = document.createElement('div');
    chip.className = 'bbttcc-rig-chip';
    const label = document.createElement('span');
    label.textContent = sys;
    chip.appendChild(label);
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'bbttcc-button';
    del.dataset.action = 'combat-system-del';
    del.dataset.idx = String(idx);
    del.title = 'Remove system';
    del.innerHTML = '<i class="fas fa-times"></i>';
    chip.appendChild(del);
    list.appendChild(chip);
  });
}

function _parseRigCombatForm(form, fallback) {
  const current = normalizeRigCombat(_isPlainObject(fallback) ? fallback : {});
  const role = String(form.querySelector('[name="rig.combat.role"]')?.value || current.role || "support").trim().toLowerCase();
  const power = clamp0(form.querySelector('[name="rig.combat.power"]')?.value || current.power || 0);
  const signature = String(form.querySelector('[name="rig.combat.signature"]')?.value || current.signature || "").trim();
  const systems = _readCombatSystems(form, current.systems || []);
  const notes = String(form.querySelector('[name="rig.combat.notes"]')?.value || current.notes || "").trim();
  const capMods = {};
  for (const k of RIG_CAPMOD_KEYS) {
    const raw = form.querySelector('[name="rig.combat.capMods.' + k + '"]')?.value;
    const val = _toNum(raw, 0);
    if (val) capMods[k] = val;
  }
  return normalizeRigCombat({ role, power, signature, systems, notes, capMods });
}

function _writeRigCombatToForm(form, combat) {
  const c = normalizeRigCombat(combat || {});
  const set = (name, value) => {
    const el = form.querySelector('[name="' + name + '"]');
    if (el) el.value = value == null ? "" : String(value);
  };
  set('rig.combat.role', c.role || 'support');
  set('rig.combat.power', c.power || 0);
  set('rig.combat.signature', c.signature || '');
  _renderCombatSystems(form, Array.isArray(c.systems) ? c.systems : []);
  set('rig.combat.notes', c.notes || '');
  for (const k of RIG_CAPMOD_KEYS) set('rig.combat.capMods.' + k, c.capMods && c.capMods[k] ? c.capMods[k] : 0);
}

function _readPassiveList(container, currentBonuses) {
  const boxes = [...container.querySelectorAll("[data-idx]")];
  const next = currentBonuses.map(_normalizePassiveBonusForGui);

  for (const box of boxes) {
    const idx = Number(box.dataset.idx);

    const get = (name) => box.querySelector(`[name="${name}"]`)?.value;
    const label = get("label");
    const key   = get("key");
    const econ  = _toNum(get("econ"), 0);
    const hz    = _toNum(get("hazard"), 0);
    const td    = _toNum(get("tierDown"), 0);
    const def   = _toNum(get("def"), 0);
    const notes = box.querySelector(`[name="notes"]`)?.value ?? "";

    const b = next[idx] ?? _normalizePassiveBonusForGui({});
    b.label = String(label || b.label).trim();
    b.key   = String(key || b.key).trim();
    b.op = _isPlainObject(b.op) ? b.op : {};
    b.op.economy = econ;
    b.hazardChance = hz;
    b.encounterTierBias = _isPlainObject(b.encounterTierBias) ? b.encounterTierBias : {};
    b.encounterTierBias.down = td;
    b.travelDefense = def;
    b.notes = String(notes || "").trim();

    next[idx] = b;
  }

  return next;
}

class BBTTCCRigConsole extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-rig-console",
    window: { title: "BBTTCC Rig Config", icon: "fas fa-truck-monster" },
    position: { width: 780, height: "auto" },
    classes: ["bbttcc", "bbttcc-rig-config", "sheet"],
    resizable: true
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/rig-config-app.hbs` }
  };

  constructor({ factionId, rigId }, options = {}) {
    super(options);
    this.factionId = factionId;
    this.rigId = rigId;
    this._abort = null;
  }

  async _getActor() { return game.actors?.get(this.factionId) ?? null; }

  async _getRig() {
    const a = await this._getActor();
    if (!a) return null;
    const rigs = a.getFlag(MODULE_ID, "rigs") || [];
    return rigs.find(r => r?.rigId === this.rigId) ?? null;
  }

  async _preparePartContext(partId, ctx) {
    if (partId !== "body") return ctx;

    const actor = await this._getActor();
    const rigRaw = await this._getRig();
    const rig = normalizeRig(rigRaw ?? { rigId: this.rigId }, { ownerFactionId: actor?.id });

    return {
      ...ctx,
      actor,
      rig,
      presetKeys: Object.keys(RIG_PRESETS),
      passivePresetKeys: Object.keys(PASSIVE_BONUS_PRESETS),
      turnPresetKeys: Object.keys(TURN_EFFECT_PRESETS),
      passiveBonusesRaw: JSON.stringify(rig.passiveBonuses || [], null, 2),
      turnEffectsRaw: _encodeRigTurnEffects(rig.turnEffectsRaw || []),
      combat: rig.combat || normalizeRigCombat({}),
      combatSystemsCsv: Array.isArray(rig.combat?.systems) ? rig.combat.systems.join(", ") : "",
      combatRoleOptions: RIG_COMBAT_ROLE_OPTIONS,
      combatSignatureOptions: RIG_SIGNATURE_OPTIONS,
      combatSystemOptions: RIG_COMBAT_SYSTEM_OPTIONS,
      capModKeys: RIG_CAPMOD_KEYS
    };
  }

  async _onRender(ctx, opts) {
    await super._onRender(ctx, opts);

    const root = this.element?.[0] ?? this.element;
    if (!root) return;

    if (this._abort) { try { this._abort.abort(); } catch {} }
    this._abort = new AbortController();
    const sig = this._abort.signal;

    const form = root.querySelector("form.bbttcc-rig-config-form");
    if (!form) return;

    const passiveList = form.querySelector('[data-role="passive-list"]');
    const hiddenJson  = form.querySelector('[name="rig.passiveBonusesRaw"]');
    const advJson     = form.querySelector('[data-role="passive-json-advanced"]');
    const turnList    = form.querySelector('[data-role="turn-list"]');
    const turnJson    = form.querySelector('[name="rig.turnEffectsRaw"]');

    const parseBonuses = () => {
      const src = (advJson?.value?.trim?.() ? advJson.value : (hiddenJson?.value ?? "[]"));
      const parsed = _safeJsonParse(src, []);
      return Array.isArray(parsed) ? parsed.map(_normalizePassiveBonusForGui) : [];
    };

    const syncToJson = (bonuses) => {
      const txt = JSON.stringify(bonuses, null, 2);
      if (hiddenJson) hiddenJson.value = txt;
      if (advJson) advJson.value = txt;
    };

    let bonuses = parseBonuses();
    _renderPassiveList(passiveList, bonuses);
    let turnEffects = _safeJsonParse(String(turnJson?.value || "[]"), []);
    if (!Array.isArray(turnEffects)) turnEffects = [];
    turnEffects = turnEffects.map(_normalizeTurnEffectForGui);
    _renderTurnEffectList(turnList, turnEffects);
    _writeRigCombatToForm(form, form?.dataset?.bbttccCombatPreset ? _safeJsonParse(form.dataset.bbttccCombatPreset, {}) : (ctx?.combat || {}));

    let combatSystems = _readCombatSystems(form, ctx?.combat?.systems || []);
    _renderCombatSystems(form, combatSystems);

    // Save
    root.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.(".bbttcc-button.primary");
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();

      if (passiveList) {
        bonuses = _readPassiveList(passiveList, bonuses);
        syncToJson(bonuses);
      }
      if (turnList && turnJson) {
        turnEffects = _readTurnEffectList(turnList, turnEffects);
        turnJson.value = _encodeRigTurnEffects(turnEffects);
      }
      try {
        form.dataset.bbttccCombatPreset = JSON.stringify(_parseRigCombatForm(form, _safeJsonParse(form.dataset.bbttccCombatPreset || "{}", {})));
      } catch {}

      this._handleSave(form);
    }, { capture: true, signal: sig });

    // Apply Template
    root.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.(".bbttcc-button.preset");
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();

      const key = form.querySelector('[name="rig.presetKey"]')?.value || "war-rig";
      _applyRigPresetToForm(form, key);

      bonuses = parseBonuses();
      _renderPassiveList(passiveList, bonuses);
      try {
        const presetCombat = form?.dataset?.bbttccCombatPreset ? _safeJsonParse(form.dataset.bbttccCombatPreset, {}) : {};
        _writeRigCombatToForm(form, presetCombat);
      } catch {}
      turnEffects = _safeJsonParse(String(turnJson?.value || "[]"), []);
      if (!Array.isArray(turnEffects)) turnEffects = [];
      turnEffects = turnEffects.map(_normalizeTurnEffectForGui);
      _renderTurnEffectList(turnList, turnEffects);
      ui.notifications?.info?.(`Applied ${key} template — adjust then Save.`);
    }, { capture: true, signal: sig });

    // Add passive preset
    root.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.('[data-action="passive-add"]');
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();

      const key = form.querySelector('[name="rig.passivePresetKey"]')?.value || "quartermaster_train";
      const preset = PASSIVE_BONUS_PRESETS[key];
      if (!preset) return;

      bonuses = _readPassiveList(passiveList, bonuses);
      bonuses.push(_normalizePassiveBonusForGui(preset));
      syncToJson(bonuses);
      _renderPassiveList(passiveList, bonuses);
    }, { capture: true, signal: sig });

    // Delete passive row
    root.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.('[data-action="passive-del"]');
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();

      const idx = Number(btn.dataset.idx);
      bonuses = _readPassiveList(passiveList, bonuses);
      bonuses.splice(idx, 1);
      syncToJson(bonuses);
      _renderPassiveList(passiveList, bonuses);
    }, { capture: true, signal: sig });

    root.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.('[data-action="combat-system-add"]');
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();
      const sel = form.querySelector('[name="rig.combat.systemAdd"]');
      const val = String(sel?.value || '').trim();
      if (!val) return;
      combatSystems = _readCombatSystems(form, combatSystems);
      combatSystems.push(val);
      combatSystems = _writeCombatSystems(form, combatSystems);
      _renderCombatSystems(form, combatSystems);
      try {
        form.dataset.bbttccCombatPreset = JSON.stringify(_parseRigCombatForm(form, _safeJsonParse(form.dataset.bbttccCombatPreset || "{}", {})));
      } catch {}
    }, { capture: true, signal: sig });

    root.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.('[data-action="combat-system-del"]');
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();
      const idx = Number(btn.dataset.idx);
      combatSystems = _readCombatSystems(form, combatSystems);
      combatSystems.splice(idx, 1);
      combatSystems = _writeCombatSystems(form, combatSystems);
      _renderCombatSystems(form, combatSystems);
      try {
        form.dataset.bbttccCombatPreset = JSON.stringify(_parseRigCombatForm(form, _safeJsonParse(form.dataset.bbttccCombatPreset || "{}", {})));
      } catch {}
    }, { capture: true, signal: sig });

    // Live sync
    let t = null;
    root.addEventListener("input", (ev) => {
      const inPassive = !!ev.target.closest?.('[data-role="passive-list"]');
      const inTurn = !!ev.target.closest?.('[data-role="turn-list"]');
      const inCombat = !!ev.target.closest?.('[data-role="rig-combat-box"]');
      if (!inPassive && ev.target !== advJson && !inTurn && !inCombat) return;

      clearTimeout(t);
      t = setTimeout(() => {
        bonuses = parseBonuses();
        if (ev.target === advJson) {
          _renderPassiveList(passiveList, bonuses);
          if (hiddenJson) hiddenJson.value = advJson.value;
          return;
        }
        if (inPassive) {
          bonuses = _readPassiveList(passiveList, bonuses);
          syncToJson(bonuses);
        }
        if (inTurn) {
          turnEffects = _readTurnEffectList(turnList, turnEffects);
          if (turnJson) turnJson.value = _encodeRigTurnEffects(turnEffects);
        }
        if (inCombat) {
          try {
            form.dataset.bbttccCombatPreset = JSON.stringify(_parseRigCombatForm(form, _safeJsonParse(form.dataset.bbttccCombatPreset || "{}", {})));
          } catch {}
        }
      }, 150);
    }, { capture: true, signal: sig });

    // Add turn effect preset
    root.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.('[data-action="turn-add"]');
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();

      const key = form.querySelector('[name="rig.turnPresetKey"]')?.value || "regen_minor_hp";
      const preset = TURN_EFFECT_PRESETS[key];
      if (!preset) return;

      turnEffects = _readTurnEffectList(turnList, turnEffects);
      turnEffects.push(_normalizeTurnEffectForGui(preset));
      if (turnJson) turnJson.value = _encodeRigTurnEffects(turnEffects);
      _renderTurnEffectList(turnList, turnEffects);
      ui.notifications?.info?.(`Added turn effect: ${key}`);
    }, { capture: true, signal: sig });

    root.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.('[data-action="turn-del"]');
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();
      const idx = Number(btn.dataset.idx);
      turnEffects = _readTurnEffectList(turnList, turnEffects);
      turnEffects.splice(idx, 1);
      if (turnJson) turnJson.value = _encodeRigTurnEffects(turnEffects);
      _renderTurnEffectList(turnList, turnEffects);
    }, { capture: true, signal: sig });
  }

  async _handleSave(form) {
  const actor = await this._getActor();
  if (!actor) return ui.notifications?.error?.("Rig Console: could not resolve faction actor.");

  const fd = new FormData(form);
  const name = String(fd.get("rig.name") || "New Rig").trim();
  const type = String(fd.get("rig.type") || "rig").trim().toLowerCase();
  const hitMax = clamp0(fd.get("rig.hitMax")) || 10;
  const raidDefense = Number(fd.get("rig.raidDefense") ?? 0) || 0;
  const mobilityTags = String(fd.get("rig.mobilityTags") || "")
    .split(",").map(s => s.trim()).filter(Boolean);

    // --- PASSIVES: read from GUI first (source of truth), fall back to JSON only if needed ---
  let parsed = null;

  const passiveList = form.querySelector('[data-role="passive-list"]');
  const boxes = passiveList
    ? [...passiveList.querySelectorAll('div[data-idx]')].filter(b => b.querySelector('[name="econ"]'))
    : [];

  if (boxes.length) {
    // Build bonuses directly from the visible inputs
    parsed = boxes
      .map(box => {
        const get = (sel) => box.querySelector(sel)?.value;

        const label = String(get('[name="label"]') || "").trim();
        const key   = String(get('[name="key"]') || "").trim();
        const econ  = _toNum(get('[name="econ"]'), 0);
        const hz    = _toNum(get('[name="hazard"]'), 0);
        const td    = _toNum(get('[name="tierDown"]'), 0);
        const def   = _toNum(get('[name="def"]'), 0);
        const notes = String(get('[name="notes"]') || "").trim();

        if (!key && !label) return null;

        return {
          key: key || foundry.utils.randomID(8),
          label: label || key,
          kind: "travel",
          op: { economy: econ },
          hazardChance: hz,
          encounterTierBias: { down: td },
          travelDefense: def,
          notes
        };
      })
      .filter(Boolean);

    console.log("[BBTTCC][RigSprint] SAVE parsed econ =", parsed?.[0]?.op?.economy, "raw=", boxes?.[0]?.querySelector?.('[name="econ"]')?.value);

    // Keep JSON fields in sync so Advanced editor reflects what was saved
    const txt = JSON.stringify(parsed, null, 2);
    const hiddenJson = form.querySelector('[name="rig.passiveBonusesRaw"]');
    const advJson = form.querySelector('[data-role="passive-json-advanced"]');
    if (hiddenJson) hiddenJson.value = txt;
    if (advJson) advJson.value = txt;
  } else {
    // Fallback: parse JSON textareas (older path)
    const rawTxt = String(fd.get("rig.passiveBonusesRaw") || fd.get("rig.passiveBonusesRawAdvanced") || "[]");
    const p = _safeJsonParse(rawTxt, null);
    if (!Array.isArray(p)) {
      ui.notifications?.error?.("Passive Bonuses JSON is invalid. It must be an array.");
      return;
    }
    parsed = p;

    console.log("[BBTTCC][RigSprint] SAVE parsed bonuses (JSON fallback) =", parsed);
  }

  // Turn effects
  let turnEffectsRaw = [];
  const turnList = form.querySelector('[data-role="turn-list"]');
  if (turnList) {
    turnEffectsRaw = _readTurnEffectList(turnList, []);
    const hiddenTurn = form.querySelector('[name="rig.turnEffectsRaw"]');
    if (hiddenTurn) hiddenTurn.value = _encodeRigTurnEffects(turnEffectsRaw);
  } else {
    const turnTxt = String(fd.get("rig.turnEffectsRaw") || "[]");
    const turnParsed = _safeJsonParse(turnTxt, []);
    if (Array.isArray(turnParsed)) turnEffectsRaw = turnParsed;
  }

  await ensureFactionRigs(actor);
  const cur = actor.getFlag(MODULE_ID, "rigs");
  const rigs = Array.isArray(cur) ? cur.slice() : [];
  const idx = rigs.findIndex(r => r?.rigId === this.rigId);

  const existing = idx >= 0 ? rigs[idx] : { rigId: this.rigId, createdTs: Date.now() };

  // Combat profile (Phase 2 prep): comes from existing rig OR the last
  // applied preset on this form (stored in dataset by _applyRigPresetToForm).
  let combat = existing?.combat ?? null;
  try {
    combat = _parseRigCombatForm(form, existing?.combat ?? _safeJsonParse(form?.dataset?.bbttccCombatPreset || "{}", {}));
    form.dataset.bbttccCombatPreset = JSON.stringify(combat);
  } catch {}
  const merged = {
  ...existing,
  rigId: this.rigId,
  ownerFactionId: actor.id,
  name,
  type,
  // ✅ bump updatedTs ONLY on an intentional user save
  updatedTs: Date.now(),
  hitTrack: { max: hitMax, current: Math.min(clamp0(existing?.hitTrack?.current ?? hitMax), hitMax) },
  raidBonuses: { ...(existing?.raidBonuses ?? {}), defense: raidDefense },
  mobilityTags,
  combat,
  passiveBonuses: parsed,
  turnEffectsRaw
};


  const next = normalizeRig(merged, { ownerFactionId: actor.id });

  console.log("[BBTTCC][RigSprint] SAVE writing econ =", next?.passiveBonuses?.[0]?.op?.economy);

  if (idx >= 0) rigs[idx] = next;
  else rigs.push(next);

  await actor.update({ [`flags.${MODULE_ID}.rigs`]: rigs }, { render: false });

  ui.notifications?.info?.("Rig saved.");
  this.close();
}
}


async function _openRigConsole({ actor, rigId }) {
  if (!actor?.id || !rigId) return;
  await _ensureRigConsoleCssLoaded();
  _installRigTravelBridge();
  const app = new BBTTCCRigConsole({ factionId: actor.id, rigId });
  app.render(true, { focus: true });
}


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
    const rosterActors = [];
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

      rosterActors.push(a);

      roster.push({
        id: a.id, name: a.name, img: a.img,
        total: Object.values(contrib).reduce((s,v)=>s+(Number(v)||0),0),
        ...contrib
      });
    }

    const sumTotal = Object.values(totals).reduce((s,v)=>s+(Number(v)||0), 0);
    return { roster, rosterActors, totals, sumTotal };
  }

  async getData(opts) {
    const d = await super.getData(opts);

    const opsFlags = foundry.utils.duplicate(this.actor.getFlag(MODULE_ID, "ops") || {});

    // NOTE (Starting Faction Sprint): "Total OPs" in the header is now BANK-ONLY.
    // Character Options (roster contribs) influence rolls/availability, but do not inflate bank totals.
    //
    // Display convention:
    //   totalOPs = current bank total (sum of flags.bbttcc-factions.opBank)
    //   maxOPs   = bank potential (sum of per-bucket caps)
    //
    // Caps resolution (non-destructive):
    //   1) flags.bbttcc-factions.opCaps { key: cap } (authoritative)
    //   2) flags.bbttcc-factions.opCapPer (single number applied to all buckets)
    //   3) derive from factionLevel/level/buildUnits (alpha-safe default)
    const _isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
    const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];

    const rawCaps = this.actor.getFlag(MODULE_ID, "opCaps");
    const capPer  = Number(this.actor.getFlag(MODULE_ID, "opCapPer") ?? NaN);
    const lvlRaw  =
      this.actor.getFlag(MODULE_ID, "factionLevel") ??
      this.actor.getFlag(MODULE_ID, "level") ??
      this.actor.getFlag(MODULE_ID, "buildUnits") ??
      1;
    const level = Math.max(1, Number(lvlRaw) || 1);

    // Alpha-safe derivation: Level 1 cap=5, then +2 per level.
    const derivedCapPer = 5 + Math.max(0, level - 1) * 2;

    const opCaps = (() => {
      const out = {};
      if (_isObj(rawCaps)) {
        for (const k of OP_KEYS) out[k] = Math.max(0, Number(rawCaps[k] ?? 0) || 0);
        return out;
      }
      const per = Number.isFinite(capPer) ? capPer : derivedCapPer;
      for (const k of OP_KEYS) out[k] = Math.max(0, Number(per) || 0);
      return out;
    })();

    const { roster, rosterActors, totals: contribTotals, sumTotal: contribGrand } = this._collectRosterAndContribs();
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

        const ownedHexesAll = await _listOwnedHexesForFaction(this.actor, "all");
const warLogs = Array.isArray(this.actor.getFlag(MODULE_ID, "warLogs")) ? this.actor.getFlag(MODULE_ID, "warLogs") : [];


// --- Quest Log (party-facing, stored on flags.bbttcc-factions.quests) ---
const questTrackRaw = (this.actor.getFlag(MODULE_ID, "quests") || foundry.utils.getProperty(this.actor, "flags.bbttcc.quests"));
const questTrack = (questTrackRaw && typeof questTrackRaw === "object") ? questTrackRaw : { active:{}, completed:{}, archived:{} };
const questReg = (() => {
  try { return game.settings.get("bbttcc-campaign", "quests") || {}; } catch (_e) { return {}; }
})();
function qName(qid) {
  const q = questReg && questReg[qid];
  return q && q.name ? q.name : qid;
}
function qRows(mapObj, status) {
  const rows = [];
  const keys = mapObj ? Object.keys(mapObj) : [];
  for (const qid of keys) {
    const tr = mapObj[qid] || {};
    const prog = tr.progress && tr.progress.beats && typeof tr.progress.beats === "object" ? tr.progress.beats : {};
    let seen = 0, done = 0;
    for (const b of Object.values(prog)) {
      const st = String(b && b.state || "");
      if (st === "completed") done++;
      else if (st) seen++;
    }
    rows.push({
      questId: qid,
      name: qName(qid),
      status,
      notes: String(tr.notes || "").trim(),
      acceptedTs: tr.acceptedTs || null,
      completedTs: tr.completedTs || null,
      seenCount: seen,
      completedCount: done
    });
  }
  rows.sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  return rows;
}
const questLog = {
  active: qRows(questTrack.active, "active"),
  completed: qRows(questTrack.completed, "completed")
};


// --- AAE Politics (Faction Pressure: roster plurality + optional override) ---
const rosterDist = computeRosterPoliticalDistribution(rosterActors || []);
const overrideKey = readFactionPoliticalOverride(this.actor);
const centerKey = (overrideKey && AAE_POLITICAL[overrideKey]) ? overrideKey : rosterDist.plurality;
const centerLabel = centerKey ? aaePoliticalLabel(centerKey) : "(None)";
const { driftScore, severityState, lastImpacts } = readFactionDriftState(this.actor);
const politicalPressure = {
  overrideKey: overrideKey || "",
  centerKey: centerKey || "",
  centerLabel,
  pluralityKey: rosterDist.plurality || "",
  pluralityPct: rosterDist.pluralityPct || 0,
  totalWithPhilosophy: rosterDist.total || 0,
  dist: rosterDist.dist || [],
  driftScore,
  severityState,
  lastImpacts
};

    const turnBank  = this.actor.getFlag(MODULE_ID, "turnBank")  || _zeros();
    const stockpile = this.actor.getFlag(MODULE_ID, "stockpile") || _zeros();
    const opBank    = this.actor.getFlag(MODULE_ID, "opBank")    || _zerosOP();

    // -----------------------------------------------------------------
    // Planned Strategic Actions (Next Turn Queue)
    // Source of truth: faction warLogs entries with type === "planned".
    // These are created by the Planner / planActivity(), and consumed by
    // raid.consumePlanned during Advance Turn (Apply).
    // -----------------------------------------------------------------
    const _plannedHumanize = (k) => String(k || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const raidApi = game.bbttcc?.api?.raid;
    const EFFECTS = raidApi?.EFFECTS || {};
    const OP_KEYS_9 = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
    const _fmtCost = (costObj) => {
      const c = costObj && typeof costObj === "object" ? costObj : {};
      const parts = [];
      for (const k of OP_KEYS_9) {
        const v = Number(c[k] ?? 0) || 0;
        if (v > 0) parts.push(`${v} ${k}`);
      }
      return parts.length ? parts.join(" • ") : "—";
    };
    const _canAfford = (bankObj, costObj) => {
      const bank = bankObj && typeof bankObj === "object" ? bankObj : {};
      const cost = costObj && typeof costObj === "object" ? costObj : {};
      for (const k of OP_KEYS_9) {
        if ((Number(cost[k] ?? 0) || 0) > (Number(bank[k] ?? 0) || 0)) return false;
      }
      return true;
    };

    const plannedActions = (Array.isArray(warLogs) ? warLogs : [])
      .filter(e => String(e?.type || "").toLowerCase() === "planned")
      .filter(e => {
        // Keep only this faction's planned entries (defensive).
        const aid = String(e?.attackerId || e?.factionId || "").trim();
        return !aid || aid === String(this.actor.id);
      })
      .sort((a,b) => (Number(a?.ts||0) - Number(b?.ts||0)))
      .map(e => {
        const keyRaw = String(e?.activityKey || e?.activity || "").trim().toLowerCase();
        const spec = EFFECTS[keyRaw] || EFFECTS[String(keyRaw||"").toUpperCase()] || EFFECTS[String(keyRaw||"").toLowerCase()] || null;
        const label = String(spec?.label || e?.label || _plannedHumanize(keyRaw) || "(Unknown)");
        const cost = spec?.cost || e?.cost || {};
        const costLine = _fmtCost(cost);
        const targetName = String(e?.targetName || e?.targetLabel || e?.targetType || "(target)");
        const notes = String(e?.note || e?.notes || "").trim();
        const canAfford = _canAfford(opBank, cost);
        return {
          ts: Number(e?.ts || 0) || 0,
          date: String(e?.date || ""),
          activityKey: keyRaw,
          label,
          cost,
          costLine,
          canAfford,
          targetName,
          targetUuid: e?.targetUuid || null,
          notes
        };
      });

    // Header totals (bank-only)
    const bankTotal = OP_KEYS.reduce((s, k) => s + clamp0(opBank?.[k]), 0);
    const bankPotential = OP_KEYS.reduce((s, k) => s + clamp0(opCaps?.[k]), 0);

    const raidPlan  = _raidPlanFromFlags(this.actor);

    // RIGS (robust): read directly from actor flags every time
    const rigsRaw = this.actor.getFlag(MODULE_ID, "rigs");
    const rigs = Array.isArray(rigsRaw)
      ? rigsRaw.map(r => normalizeRig(r, { ownerFactionId: this.actor.id }))
      : [];

// -----------------------------------------------------------------
// Doctrine (Maneuvers + Strategics)
// - Embedded feats on the faction are entitlement wrappers.
// - Display/open/drag prefer Master Content compendium entries.
// -----------------------------------------------------------------
const doctrine = await (async () => {
  const all = (this.actor?.items ? Array.from(this.actor.items) : []);
  const idxMap = await _bbttccGetDoctrineIndexMap();

  const pick = (kind) => all
    .filter(it => _bbttccIsDoctrineItem(it, kind))
    .map(it => {
      const k0 = String(it.flags?.bbttcc?.key || "").toLowerCase().trim();
      const kind0 = String(it.flags?.bbttcc?.kind || kind).toLowerCase().trim();
      const hit = idxMap.get(kind0 + ":" + k0) || null;

      // Keep embedded id for remove operations; but prefer compendium UUID/img/name for display+drag.
      return {
        id: it.id,                  // embedded item id
        embeddedUuid: it.uuid,      // for fallback/debug only
        uuid: hit?.uuid || it.uuid, // preferred
        name: hit?.name || it.name,
        img: hit?.img || it.img,
        kind: kind0,
        key: k0
      };
    })
    .sort((a,b)=> String(a.name||"").localeCompare(String(b.name||"")));

  return {
    maneuvers: pick("maneuver"),
    strategics: pick("strategic")
  };
})();

    return {
      ...d,
      isGM: !!game.user?.isGM,
      gmEditMode: !!game.user?.isGM && !!game.settings?.get?.('bbttcc-core','gmEditMode'),
      rigs, // <-- top-level (defensive)
      fx: {
        ops: rows,
        maxOPs: bankPotential,
        totalOPs: bankTotal,
        // kept for debugging/roll logic if needed later
        totalOPsForRolls: total,
        powerKey,
        powerLevelLabel,
        roster,
        rosterTotals: contribTotals,
        rosterGrandTotal: contribGrand,
        territoryThisScene,
        territoryTotals,
        ownedHexesAll,
        warLogs,
        bank: turnBank,
        stockpile,
        opBank,
        bankLine: fmtResLine(turnBank),
        stockpileLine: fmtResLine(stockpile),
        raidPlan,
        plannedActions,
        doctrine,
        rigs, // <-- primary template source
        politicalPressure
      }
    };
  }

  async _openAdvisorDialog() {
    try {
      const api = game.bbttcc?.api?.agent;
      if (!api?.recommendNextActions) return ui.notifications?.warn?.("Advisor not available.");

      const result = await api.recommendNextActions(this.actor.id);
      const esc = (v) => foundry.utils.escapeHTML(String(v ?? ""));
      const mal = result?.mal || {};
      const why = mal?.whyNot || {};
      const conf = result?.confidence || {};
      const overallTitle = esc(result?.top?.overall?.label || result?.top?.overall?.key || "Advisor");
      const overallConf = esc(conf?.overall || "unknown");

      const section = (title, body, tone="") => `
        <section class="bbttcc-advisor-section ${tone}">
          <h3>${esc(title)}</h3>
          <div class="bbttcc-advisor-copy">${esc(body || "No recommendation available.")}</div>
        </section>
      `;

      const whyItems = [
        why?.overall ? `<li><strong>Overall:</strong> ${esc(why.overall)}</li>` : "",
        why?.strategic ? `<li><strong>Strategic:</strong> ${esc(why.strategic)}</li>` : "",
        why?.travel ? `<li><strong>Travel:</strong> ${esc(why.travel)}</li>` : "",
        why?.raid ? `<li><strong>Raid:</strong> ${esc(why.raid)}</li>` : ""
      ].filter(Boolean).join("");

      const content = `
        <div class="bbttcc-advisor-dialog">
          <div class="bbttcc-advisor-hero">
            <div class="bbttcc-advisor-eyebrow">Mal Says</div>
            <div class="bbttcc-advisor-headline">${overallTitle}</div>
            <div class="bbttcc-advisor-subline">Overall confidence: <b>${overallConf}</b></div>
          </div>

          ${section("Overall", mal?.overall, "overall")}
          ${section("Strategic", mal?.strategic, "strategic")}
          ${section("Travel", mal?.travel, "travel")}
          ${section("Raid", mal?.raid, "raid")}

          ${whyItems ? `
            <section class="bbttcc-advisor-section why-not">
              <h3>Why Not</h3>
              <ul class="bbttcc-advisor-why">${whyItems}</ul>
            </section>
          ` : ""}
        </div>
      `;

      await new Dialog({
        title: `${this.actor.name} — Advisor`,
        content,
        buttons: {
          refresh: {
            label: '<i class="fas fa-rotate-right"></i> Refresh',
            callback: () => setTimeout(() => this._openAdvisorDialog(), 0)
          },
          close: {
            label: '<i class="fas fa-check"></i> Close'
          }
        },
        default: "close"
      }).render(true);
    } catch (e) {
      console.error("[bbttcc-factions] Advisor dialog failed", e);
      ui.notifications?.error?.("Advisor dialog failed. See console.");
    }
  }


  activateListeners(html) {
    super.activateListeners(html);

    // Open Quest Log window
    try {
      html.find("[data-open-quest-log]").on("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        const api = game.bbttcc?.api?.quests;
        if (!api?.openQuestLog) return ui.notifications?.warn?.("Quest Log not available.");
        await api.openQuestLog({ factionId: this.actor.id });
      });
    } catch (e) {
      console.warn("[bbttcc-factions] Quest Log opener bind failed", e);
    }



// Open Hex Sheet (player-facing)
try {
  html.find("[data-open-hex-sheet]").on("click", async (ev) => {
    ev.preventDefault();
    const uuid = String(ev.currentTarget?.dataset?.hexUuid || "").trim();
    if (!uuid) return;
    const tApi = game.bbttcc?.api?.territory;
    if (!tApi?.openHexSheet) return ui.notifications?.warn?.("Hex Sheet not available.");
    await tApi.openHexSheet(uuid);
  });
} catch (e) { console.warn("Hex opener bind failed", e); }

// Open Advisor
try {
  html.find("[data-open-advisor]").on("click", async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    await this._openAdvisorDialog();
  });
} catch (e) {
  console.warn("[bbttcc-factions] Advisor opener bind failed", e);
}

// Open Activity Planner (faction-locked)

try {
  html.find("[data-open-activity-planner]").on("click", async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const raid = game.bbttcc?.api?.raid;
    if (!raid?.openActivityPlanner) return ui.notifications?.warn?.("Planner not available.");
    // Lock the planner to this faction so players can't "hop" factions.
    raid.openActivityPlanner({ factionId: this.actor.id, lockFaction: true });
  });
} catch (e) {
  console.warn("[bbttcc-factions] Planner opener bind failed", e);
}

// -----------------------------------------------------------------
// Planned Strategic Actions (Next Turn Queue)
// - Visible to players/GM on faction sheet
// - Allow removal BEFORE Advance Turn consumes planned entries
// -----------------------------------------------------------------
try {
  const root = (html?.[0] instanceof HTMLElement) ? html[0] : (this.element?.[0] ?? this.element);
  if (root && root instanceof HTMLElement && !root.dataset.bbttccPlannedBound) {
    root.dataset.bbttccPlannedBound = "1";

    root.addEventListener("click", async (ev) => {
      const btn = ev.target?.closest?.("[data-planned-act]");
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();

      const act = String(btn.getAttribute("data-planned-act") || "");
      const tsRaw = String(btn.getAttribute("data-ts") || "");
      const ts = Number(tsRaw || 0) || 0;

      const logsCur = Array.isArray(this.actor.getFlag(MODULE_ID, "warLogs"))
        ? foundry.utils.duplicate(this.actor.getFlag(MODULE_ID, "warLogs"))
        : [];

      const isPlanned = (e) => String(e?.type || "").toLowerCase() === "planned";

      if (act === "remove") {
        if (!ts) return;

        const victim = logsCur.find(e => isPlanned(e) && Number(e?.ts || 0) === ts);
        const next = logsCur.filter(e => !(isPlanned(e) && Number(e?.ts || 0) === ts));

        // Audit entry (non-breaking, shows in war logs)
        const now = Date.now();
        const label = String(victim?.activityKey || victim?.activity || "planned action");
        const tgt = String(victim?.targetName || victim?.targetType || "target");
        next.push({
          ts: now,
          date: (new Date(now)).toLocaleString(),
          type: "turn",
          activity: "planned_remove",
          summary: `Removed planned action: ${label} → ${tgt}.`
        });

        await this.actor.update({ [`flags.${MODULE_ID}.warLogs`]: next });
        ui.notifications?.info?.("Removed planned action.");
        this.render(false);
        return;
      }

      if (act === "clear") {
        const any = logsCur.some(isPlanned);
        if (!any) return ui.notifications?.info?.("No planned actions to clear.");

        const ok = await Dialog.confirm({
          title: "Clear Planned Actions",
          content: `<p>Remove <b>all</b> planned strategic actions for <b>${foundry.utils.escapeHTML(this.actor.name)}</b>?</p>`
        });
        if (!ok) return;

        const kept = logsCur.filter(e => !isPlanned(e));
        const now = Date.now();
        kept.push({
          ts: now,
          date: (new Date(now)).toLocaleString(),
          type: "turn",
          activity: "planned_clear",
          summary: "Cleared all planned actions before Advance Turn."
        });

        await this.actor.update({ [`flags.${MODULE_ID}.warLogs`]: kept });
        ui.notifications?.info?.("Cleared planned actions.");
        this.render(false);
        return;
      }
    }, true);
  }
} catch (e) {
  console.warn("[bbttcc-factions] Planned-actions bind failed", e);
}




// -----------------------------------------------------------------
// Tabs (v13-safe, lightweight)
// -----------------------------------------------------------------
try {
  const root = (html?.[0] instanceof HTMLElement) ? html[0] : (this.element?.[0] ?? this.element);
  if (root && root instanceof HTMLElement && !root.dataset.bbttccTabsBound) {
    root.dataset.bbttccTabsBound = "1";
    root.addEventListener("click", (ev) => {
      const item = ev.target?.closest?.(".bbttcc-tabs .item");
      if (!item) return;
      ev.preventDefault();
      ev.stopPropagation();

      const tab = item.getAttribute("data-tab") || "";
      if (!tab) return;

      root.querySelectorAll(".bbttcc-tabs .item").forEach((el) => el.classList.remove("is-active"));
      item.classList.add("is-active");

      root.querySelectorAll(".bbttcc-tab").forEach((el) => el.classList.remove("is-active"));
      const panel = root.querySelector(`.bbttcc-tab[data-tab="${CSS.escape(tab)}"]`);
      if (panel) panel.classList.add("is-active");
    }, true);
  }
} catch (e) { console.warn("[bbttcc-factions] Tabs bind failed", e); }





// -----------------------------------------------------------------
// Doctrine Compendium Resolver
// Pack: "bbttcc-master-content.doctrines"
// - Allows opening the compendium-backed doctrine entry if present.
// - Falls back to embedded faction item if pack entry is missing.
// -----------------------------------------------------------------

async function _bbttccResolveDoctrinePackEntry(kind, key) {
  try {
    kind = String(kind || "").toLowerCase().trim();
    key  = String(key  || "").toLowerCase().trim();
    if (!kind || !key) return null;

    const cacheKey = kind + ":" + key;

    // Fast path: map cache (preferred)
    const map = await _bbttccGetDoctrineIndexMap();
    const hit = map.get(cacheKey) || null;
    if (hit) return { packId: hit.packId, docId: hit.docId, uuid: hit.uuid, name: hit.name, img: hit.img };

    // Compat cache (kept for callers that expect byKey)
    if (__bbttccDoctrinePackCache.byKey && __bbttccDoctrinePackCache.byKey[cacheKey]) {
      return __bbttccDoctrinePackCache.byKey[cacheKey];
    }

    return null;
  } catch (_e) {
    return null;
  }
}

async function _bbttccOpenDoctrineEntry(kind, key, fallbackItemUuid=null) {
  try {
    const hit = await _bbttccResolveDoctrinePackEntry(kind, key);
    if (hit && hit.packId && hit.docId) {
      const pack = game.packs.get(hit.packId);
      const doc = await pack.getDocument(hit.docId);
      if (doc?.sheet) {
        doc.sheet.render(true, { focus: true });
        return true;
      }
    }
  } catch (_e) {}

  // fallback to embedded item
  try {
    if (fallbackItemUuid) {
      const it = await fromUuid(String(fallbackItemUuid)).catch(()=>null);
      if (it?.sheet) {
        it.sheet.render(true, { focus: true });
        return true;
      }
    }
  } catch (_e2) {}

  return false;
}

/* -----------------------------------------------------------------
   Doctrine Tab interactions
   - Embedded feat items = entitlements (flags.bbttcc.kind/key)
   - UI (open/add/drag) prefers Master Content compendium entries
   ----------------------------------------------------------------- */
try {
  const root = (html?.[0] instanceof HTMLElement) ? html[0] : (this.element?.[0] ?? this.element);
  if (root && root instanceof HTMLElement && !root.dataset.bbttccDoctrineBound) {
    root.dataset.bbttccDoctrineBound = "1";

    // CLICK actions: open / add / remove
    root.addEventListener("click", async (ev) => {
      const btn = ev.target?.closest?.("[data-doctrine-act]");
      if (!btn) return;

      const act = String(btn.getAttribute("data-doctrine-act") || "");
      const kindAttr = String(btn.getAttribute("data-kind") || "").toLowerCase().trim();
      const keyAttr  = String(btn.getAttribute("data-key")  || "").toLowerCase().trim();
      const itemId   = String(btn.getAttribute("data-item-id") || "");

      // Players may OPEN doctrine entries, but only GMs may add/remove/grant.
      if (!game.user?.isGM && act !== "open") return ui.notifications?.warn?.("GM only.");

      ev.preventDefault();
      ev.stopPropagation();

      if (act === "open") {
        const it = itemId ? (this.actor.items?.get?.(itemId) || null) : null;
        const ok = await _bbttccOpenDoctrineEntry(kindAttr, keyAttr, it?.uuid || null);
        if (!ok && it?.sheet) it.sheet.render(true, { focus: true });
        return;
      }

      if (act === "remove") {
        if (!itemId) return;
        const it = this.actor.items?.get?.(itemId) || null;
        const name = it?.name || "doctrine item";
        const ok = await Dialog.confirm({
          title: "Remove Doctrine",
          content: `<p>Remove <b>${foundry.utils.escapeHTML(name)}</b> from <b>${foundry.utils.escapeHTML(this.actor.name)}</b>?</p>`
        });
        if (!ok) return;
        await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
        ui.notifications?.info?.("Doctrine removed.");
        this.render(false);
        return;
      }

      if (act === "add") {
        // Compendium-driven picker (SOT)
        const wantKind = (kindAttr === "maneuver") ? "maneuver" : "strategic";
        const idxMap = await _bbttccGetDoctrineIndexMap();

        const entries = [];
        for (const [k, v] of idxMap.entries()) {
          if (!v) continue;
          const parts = String(k).split(":");
          const kKind = parts[0] || "";
          const kKey  = parts[1] || "";
          if (kKind !== wantKind) continue;
          entries.push({ key: kKey, name: v.name || kKey });
        }

        entries.sort((a,b)=> String(a.name).localeCompare(String(b.name)));

        if (!entries.length) return ui.notifications?.warn?.("No doctrine entries found in Master Content doctrines pack.");

        const options = entries.map(e => {
          return `<option value="${foundry.utils.escapeHTML(String(e.key))}">${foundry.utils.escapeHTML(String(e.name))}</option>`;
        }).join("");

        const picked = await new Promise((resolve) => {
          new Dialog({
            title: `Grant ${wantKind === "maneuver" ? "Maneuver" : "Strategic Activity"}`,
            content: `
              <form>
                <div class="form-group">
                  <label>Select</label>
                  <select name="key">${options}</select>
                </div>
                <p class="hint">Grants an embedded entitlement item (flags.bbttcc.kind/key). Display pulls from Master Content doctrines.</p>
              </form>`,
            buttons: {
              ok: { label: "Grant", callback: (h) => resolve(h[0].querySelector('select[name="key"]')?.value || "") },
              cancel: { label: "Cancel", callback: () => resolve("") }
            },
            default: "ok",
            close: () => resolve("")
          }, { width: 560 }).render(true);
        });
        if (!picked) return;

        const api = game.bbttcc?.api?.factions?.doctrine;
        if (!api?.grant) return ui.notifications?.warn?.("Doctrine API missing.");
        await api.grant(this.actor.id, { kind: wantKind, key: picked, silent: false });

        ui.notifications?.info?.("Doctrine granted.");
        this.render(false);
        return;
      }
    }, true);

    // DRAGSTART: emit Item payload (prefer compendium UUID)
    root.addEventListener("dragstart", (ev) => {
      try {
        if (!game.user?.isGM) return;
        const row = ev.target?.closest?.(".bbttcc-doctrine-row[data-item-id]") || ev.target?.closest?.("[data-item-id][data-kind][data-key]");
        if (!row) return;

        const itemId = String(row.getAttribute("data-item-id") || "");
        const kind = String(row.getAttribute("data-kind") || "").toLowerCase().trim();
        const key  = String(row.getAttribute("data-key")  || "").toLowerCase().trim();

        // Prefer cached compendium uuid if available
        const cacheKey = kind + ":" + key;
        const map = __bbttccDoctrinePackCache.map;
        const hit = (map && map.get) ? (map.get(cacheKey) || null) : null;
        const uuid = hit?.uuid || (itemId ? (this.actor.items?.get?.(itemId)?.uuid || "") : "");

        if (!uuid) return;

        const payload = { type: "Item", uuid };
        ev.dataTransfer?.setData("text/plain", JSON.stringify(payload));
        ev.dataTransfer?.setData("application/json", JSON.stringify(payload));
        ev.dataTransfer.effectAllowed = "copy";
      } catch (_e) {}
    }, true);

    // DROP: accept Item payloads and grant entitlement if doctrine-shaped
    root.addEventListener("dragover", (ev) => {
      const dz = ev.target?.closest?.(".bbttcc-doctrine-dropzone[data-doctrine-drop]");
      if (!dz) return;
      if (!game.user?.isGM) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "copy";
    }, true);

    root.addEventListener("drop", async (ev) => {
      const dz = ev.target?.closest?.(".bbttcc-doctrine-dropzone[data-doctrine-drop]");
      if (!dz) return;
      if (!game.user?.isGM) return;

      ev.preventDefault();
      ev.stopPropagation();

      let raw = ev.dataTransfer?.getData("application/json") || ev.dataTransfer?.getData("text/plain") || "";
      raw = String(raw || "").trim();
      if (!raw) return;

      let data = null;
      try { data = JSON.parse(raw); } catch { data = null; }
      if (!data || String(data.type || "") !== "Item") return ui.notifications?.warn?.("Drop an Item to grant doctrine.");

      const uuid = String(data.uuid || "");
      if (!uuid) return ui.notifications?.warn?.("Dropped item has no uuid.");

      const doc = await fromUuid(uuid).catch(()=>null);
      if (!doc) return ui.notifications?.warn?.("Could not resolve dropped item.");

      const f = doc.flags?.bbttcc || {};
      const kind = String(f.kind || "").toLowerCase().trim();
      const key  = String(f.key  || "").toLowerCase().trim();
      if (!kind || !key) return ui.notifications?.warn?.("That item is not a BBTTCC doctrine item (missing flags.bbttcc.kind/key).");

      const api = game.bbttcc?.api?.factions?.doctrine;
      if (!api?.grant) return ui.notifications?.warn?.("Doctrine API missing.");
      await api.grant(this.actor.id, { kind, key, silent: false });

      ui.notifications?.info?.("Doctrine granted.");
      this.render(false);
    }, true);
  }
} catch (e) { console.warn("[bbttcc-factions] Doctrine bind failed", e); }


// -----------------------------------------------------------------
// Open Raid Console (faction-locked) — override any legacy bindings
// -----------------------------------------------------------------
try {
  const root = (html?.[0] instanceof HTMLElement) ? html[0] : (this.element?.[0] ?? this.element);
  if (root && root instanceof HTMLElement && !root.dataset.bbttccRaidOpenBound) {
    root.dataset.bbttccRaidOpenBound = "1";
    root.addEventListener("click", async (ev) => {
      const btn = ev.target?.closest?.("[data-open-raid-console]");
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();

      const raid = game.bbttcc?.api?.raid;
      const open = raid?.openConsole || raid?.openRaidConsole;
      if (typeof open !== "function") return ui.notifications?.warn?.("Raid Console not available.");
      await open({ factionId: this.actor.id, mode: "commit" });
    }, true);
  }
} catch (e) { console.warn("[bbttcc-factions] Raid opener bind failed", e); }

// -----------------------------------------------------------------
// Open Ritual Console (Final Ritual / Tikkun)
// -----------------------------------------------------------------
try {
  const root = (html?.[0] instanceof HTMLElement) ? html[0] : (this.element?.[0] ?? this.element);
  if (root && root instanceof HTMLElement && !root.dataset.bbttccRitualOpenBound) {
    root.dataset.bbttccRitualOpenBound = "1";
    root.addEventListener("click", async (ev) => {
      const btn = ev.target?.closest?.("[data-open-ritual]");
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();

      const tApi = game.bbttcc?.api?.tikkun || game.bbttcc?.api?.tikkunOlam || game.bbttcc?.api?.ritual;
      const openFn =
        tApi?.openRitualConsole ||
        tApi?.openRitual ||
        tApi?.openFinalRitual ||
        globalThis.BBTTCC_OpenRitualConsole ||
        null;

      if (typeof openFn !== "function") {
        ui.notifications?.warn?.("Ritual console unavailable (Tikkun API not loaded).");
        return;
      }

      // Players: request GM open it.
      if (!game.user?.isGM) {
        try {
          const gmIds = (game.users?.filter(u=>u.isGM) || []).map(u=>u.id);
          await ChatMessage.create({
            speaker: { alias: "BBTTCC" },
            whisper: gmIds,
            content: `<p><b>Ritual Request</b></p><p><b>${foundry.utils.escapeHTML(this.actor.name)}</b> requests the Ritual Console be opened.</p>`
          });
          ui.notifications?.info?.("Ritual request sent to GM.");
        } catch (_e) {
          ui.notifications?.warn?.("Waiting for GM to open the Ritual Console.");
        }
        return;
      }

      await openFn({ factionId: this.actor.id });
    }, true);
  }
} catch (e) { console.warn("[bbttcc-factions] Ritual opener bind failed", e); }


// Quest Log actions
try {
  html.find("[data-quest-act='note']").on("click", async (ev) => {
    ev.preventDefault();
    const qid = String(ev.currentTarget?.dataset?.questId || "").trim();
    if (!qid) return;
    const cur = this.actor.getFlag(MODULE_ID, "quests") || {};
    const active = (cur.active && cur.active[qid]) ? cur.active[qid] : ((cur.completed && cur.completed[qid]) ? cur.completed[qid] : null);
    const prev = active && active.notes ? String(active.notes) : "";
    const content = `<p class="bbttcc-muted">Quest: <code>${qid}</code></p><textarea style="width:100%; min-height:180px;" name="qnote">${prev}</textarea>`;
    new Dialog({
      title: "Quest Notes",
      content,
      buttons: {
        save: {
          label: "Save",
          callback: async (html2) => {
            const val = String(html2.find("textarea[name='qnote']").val() || "").trim();
            const track = this.actor.getFlag(MODULE_ID, "quests") || { active:{}, completed:{}, archived:{} };
            if (track.active && track.active[qid]) track.active[qid].notes = val;
            else if (track.completed && track.completed[qid]) track.completed[qid].notes = val;
            else {
              track.active = track.active || {};
              track.active[qid] = { questId: qid, status:"active", acceptedTs: Date.now(), lastTouchedTs: Date.now(), notes: val, progress:{beats:{}}, history:[] };
            }
            await this.actor.setFlag(MODULE_ID, "quests", track);
            this.render(false);
          }
        },
        cancel: { label: "Cancel" }
      },
      default: "save"
    }).render(true);
  });

  html.find("[data-quest-act='complete']").on("click", async (ev) => {
    ev.preventDefault();
    if (!game.user.isGM) return ui.notifications?.warn?.("GM only.");
    const qid = String(ev.currentTarget?.dataset?.questId || "").trim();
    if (!qid) return;
    const track = this.actor.getFlag(MODULE_ID, "quests") || { active:{}, completed:{}, archived:{} };
    track.active = track.active || {};
    track.completed = track.completed || {};
    const row = track.active[qid] || track.completed[qid] || { questId: qid, acceptedTs: Date.now(), progress:{beats:{}}, history:[] };
    row.status = "completed";
    row.completedTs = row.completedTs || Date.now();
    track.completed[qid] = row;
    delete track.active[qid];
    await this.actor.setFlag(MODULE_ID, "quests", track);
    this.render(false);
  });
} catch (_eQ) {}
    const host = html?.[0] instanceof HTMLElement ? html[0] : (html instanceof HTMLElement ? html : this.element);
    // Stable root element for delegated listeners (avoid scope bugs across browsers)
    const rootMaybe = (this.element && (this.element[0] ?? this.element)) ?? (host && (host[0] ?? host)) ?? null;
    const rootEl = (rootMaybe && rootMaybe[0] instanceof HTMLElement) ? rootMaybe[0] : rootMaybe;



// GM MANUAL EDIT: delegated controls (GM-only, gated by bbttcc-core.gmEditMode)
try {
  const gmEnabled = !!game.user?.isGM && !!game.settings?.get?.("bbttcc-core","gmEditMode");
  if (rootEl && rootEl instanceof HTMLElement && gmEnabled && !rootEl.dataset.bbttccGmEditBound) {
    rootEl.dataset.bbttccGmEditBound = "1";

    const readNum = (el) => {
      const n = Number(el?.value ?? 0);
      return Number.isFinite(n) ? n : 0;
    };

    const rebuildFromFlags = async () => {
      try { await this.render(true, { focus: true }); } catch {}
    };

    rootEl.addEventListener("click", async (ev) => {
      const btn = ev.target?.closest?.("[data-gm-act]");
      if (!btn) return;

      ev.preventDefault();
      ev.stopPropagation();

      const act = btn.getAttribute("data-gm-act") || "";
      const fieldset = btn.closest?.(".bbttcc-card-gmedit") || rootEl.querySelector?.(".bbttcc-card-gmedit");
      if (!fieldset) return;

      if (act === "copyId") {
        try {
          await navigator.clipboard.writeText(String(this.actor?.id || ""));
          ui.notifications?.info?.("Copied faction ID.");
        } catch {
          ui.notifications?.warn?.("Copy failed (clipboard blocked).");
        }
        return;
      }

      if (act === "clear") {
        await rebuildFromFlags();
        return;
      }

      if (act !== "apply") return;

      // Gather OP bank edits
      const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
      const newOpBankRaw = {};
      for (const k of OP_KEYS) {
        const el = fieldset.querySelector(`[data-gm-op="${k}"]`);
        newOpBankRaw[k] = Math.max(0, Math.round(readNum(el)));
      }

      // Enforce OP caps (tier-gated). GM edit is NOT allowed to create over-cap bank state.
      const _safeNum = (v, fb = 0) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : fb;
      };

      const _readCaps = (actor) => {
        try {
          const f = actor?.flags?.[MODULE_ID] || {};
          const rawCaps = f.opCaps;
          const out = {};

          if (rawCaps && typeof rawCaps === "object") {
            for (const k of OP_KEYS) out[k] = Math.max(0, Math.floor(_safeNum(rawCaps[k], 0)));
            return out;
          }

          const per = _safeNum(f.opCapPer, 0);
          if (per > 0) {
            for (const k of OP_KEYS) out[k] = Math.max(0, Math.floor(per));
            return out;
          }

          // Derive from faction tier (authoritative) if present.
          let tier = _safeNum(f.tier, -1);
          if (!Number.isFinite(tier) || tier < 0) {
            const snap = (f.progression && f.progression.victory) ? f.progression.victory : null;
            const tfb = snap ? _safeNum(snap.tierFromBadge, -1) : -1;
            tier = (tfb >= 0) ? tfb : 0;
          }
          tier = Math.max(0, Math.min(4, Math.floor(tier)));

          // Cap bands (per bucket). T0=5, T1=7, T2=9, T3=11, T4=13
          const band = [5, 7, 9, 11, 13];
          const derivedPer = band[tier] || 5;

          for (const k of OP_KEYS) out[k] = Math.max(0, Math.floor(derivedPer));
          return out;
        } catch (_e) {
          const out = {};
          for (const k of OP_KEYS) out[k] = 0;
          return out;
        }
      };

      const caps = _readCaps(this.actor);
      const newOpBank = {};
      const clamped = [];
      for (const k of OP_KEYS) {
        const want = _safeNum(newOpBankRaw[k], 0);
        const capK = _safeNum(caps?.[k], 0);
        // Treat capK<=0 as "no cap" (alpha-safe), but in normal play caps should always be >0.
        const val = (capK > 0) ? Math.max(0, Math.min(want, capK)) : Math.max(0, want);
        newOpBank[k] = val;
        if (val !== want) clamped.push({ key: k, want, cap: capK, final: val });
      }      // Gather tracks
      const moraleEl  = fieldset.querySelector(`[data-gm-track="morale"]`);
      const loyaltyEl = fieldset.querySelector(`[data-gm-track="loyalty"]`);
      const darkEl    = fieldset.querySelector(`[data-gm-track="darkness"]`);
      const vpEl      = fieldset.querySelector(`[data-gm-victory="vp"]`);
      const unityEl   = fieldset.querySelector(`[data-gm-victory="unity"]`);

      const morale  = Math.max(0, Math.round(readNum(moraleEl)));
      const loyalty = Math.max(0, Math.round(readNum(loyaltyEl)));
      const darkness = Math.max(0, Math.round(readNum(darkEl)));
      const vp = Math.max(0, Math.round(readNum(vpEl)));
      const unity = Math.max(0, Math.round(readNum(unityEl)));

      const noteEl = fieldset.querySelector("[data-gm-note]");
      let note = String(noteEl?.value || "").trim();

      if (clamped.length) {
        const parts = clamped.map(r => `${r.key}:${r.want}→${r.final}${(r.cap>0?`(cap ${r.cap})`:"")}`);
        ui.notifications?.warn?.(`OP bank clamped to caps: ${parts.join(" • ")}`);
        // If the GM provided a note, keep it and append the clamp summary. Otherwise create a minimal audit note.
        note = note ? `${note} | OP clamped: ${parts.join(" • ")}` : `OP clamped to caps: ${parts.join(" • ")}`;
      }

      // Preserve existing victory payload, only overwrite vp/unity
      const existingVictory = this.actor.getFlag(MODULE_ID, "victory") || {};
      const newVictory = foundry.utils.mergeObject(foundry.utils.duplicate(existingVictory), { vp, unity }, { inplace: false });

      const updates = {};
      updates[`flags.${MODULE_ID}.opBank`] = newOpBank;
      updates[`flags.${MODULE_ID}.morale`] = morale;
      updates[`flags.${MODULE_ID}.loyalty`] = loyalty;
      updates[`flags.${MODULE_ID}.darkness`] = darkness;
      updates[`flags.${MODULE_ID}.victory`] = newVictory;

      try {
        await this.actor.update(updates);

        // Optional audit war log
        if (note) {
          const warLogs = Array.isArray(this.actor.getFlag(MODULE_ID, "warLogs")) ? foundry.utils.duplicate(this.actor.getFlag(MODULE_ID, "warLogs")) : [];
          warLogs.unshift({
            type: "gm_adjustment",
            ts: Date.now(),
            date: (new Date()).toLocaleDateString(),
            summary: note
          });
          await this.actor.setFlag(MODULE_ID, "warLogs", warLogs);
        }

        ui.notifications?.info?.("GM edits applied.");
        await rebuildFromFlags();
      } catch (e) {
        console.error(e);
        ui.notifications?.error?.("GM edit failed (see console).");
      }
    }, true);
  }
} catch (e) { warn("gm edit bind", e); }

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

    // RIGS: delegated controls (bound to sheet root, capture-mode, and only once)
    try {
      const rootMaybe = (this.element && (this.element[0] ?? this.element)) ?? (host && (host[0] ?? host)) ?? null;
      const root = (rootMaybe && rootMaybe[0] instanceof HTMLElement) ? rootMaybe[0] : rootMaybe;
      if (root && root instanceof HTMLElement && !rootEl.dataset.bbttccRigsBound) {
        rootEl.dataset.bbttccRigsBound = "1";

        rootEl.addEventListener("click", async (ev) => {
          const btn = ev.target?.closest?.("[data-rig-act]");
          if (!btn) return;

          ev.preventDefault();
          ev.stopPropagation();

          const act = btn.getAttribute("data-rig-act");
          const row = btn.closest?.("[data-rig-id]");
          const rigId = row?.getAttribute?.("data-rig-id") ?? null;

          const api = game.bbttcc?.api?.factions;
          if (!api) return ui.notifications?.error?.("Factions API not available.");

          if (act === "add") {
            const api = game.bbttcc?.api?.factions;
            const created = await api.addRig(this.actor.id, {
              name: "New Rig",
              type: "war-rig",
              hitTrack: { max: 10, current: 10 },
              damageStep: 0,
              mobilityTags: [],
              raidBonuses: { defense: 0 },
              passiveBonuses: [],
              turnEffectsRaw: []
            });
            await _openRigConsole({ actor: this.actor, rigId: created?.rigId });
            this.render(false);
            return;
          }

          if (!rigId) return;


if (act === "bonuses") {
  await _openRigConsole({ actor: this.actor, rigId });
  this.render(false);
  return;
}

          if (act === "delete") {
            const ok = await Dialog.confirm({
              title: "Delete Rig",
              content: `<p>Delete this rig?</p><p><code>${foundry.utils.escapeHTML(rigId)}</code></p>`
            });
            if (!ok) return;
            await api.removeRig(this.actor.id, rigId);
            this.render(false);
            return;
          }

          if (act === "dmgUp" || act === "dmgDown") {
            const rigsNow = api.listRigs(this.actor.id);
            const rig = rigsNow.find(r => r?.rigId === rigId);
            if (!rig) return ui.notifications?.warn?.("Rig not found.");

            const delta = (act === "dmgUp") ? 1 : -1;
            const nextStep = _capDamageStep((rig.damageStep ?? 0) + delta);

            await api.updateRig(this.actor.id, rigId, { damageStep: nextStep });
            this.render(false);
            return;
          }
        }, true); // CAPTURE
      }
    } catch (e) { warn("rig listeners", e); }



// --- AAE Politics controls (GM) ---
try {
  if (rootEl && rootEl instanceof HTMLElement && !rootEl.dataset.bbttccPolBound) {
    rootEl.dataset.bbttccPolBound = "1";

    // Override select
    rootEl.addEventListener("change", async (ev) => {
      const sel = ev.target?.closest?.("[data-pol-override]");
      if (!sel) return;
      if (!game.user?.isGM) return;
      const v = String(sel.value || "").trim();
      await this.actor.setFlag(AAE_MOD, "politicalPhilosophyOverride", v || null);
      this.render(false);
    }, true);

    // Drift adjust buttons
    rootEl.addEventListener("click", async (ev) => {
      const btn = ev.target?.closest?.("[data-pol-act]");
      if (!btn) return;
      if (!game.user?.isGM) return;
      ev.preventDefault(); ev.stopPropagation();

      const act = String(btn.dataset.polAct || "");
      const delta = Number(btn.dataset.polDelta || 0) || 0;

      if (act === "drift") {
        const cur = Number(this.actor.getFlag(AAE_MOD, "driftScore") ?? 0) || 0;
        const next = Math.max(-100, Math.min(100, cur + delta));
        await this.actor.setFlag(AAE_MOD, "driftScore", next);
        this.render(false);
      }

      if (act === "reset") {
        await this.actor.setFlag(AAE_MOD, "driftScore", 0);
        await this.actor.setFlag(AAE_MOD, "severityState", "stable");
        this.render(false);
      }
    }, true);
  }
} catch (e) { warn("politics listeners", e); }
// --- /AAE Politics controls ---
    // Header strips/buttons are now rendered in faction-sheet.hbs (HexChrome header grid).
    // (Legacy dynamic header injection removed to keep the header cohesive.)
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
  // ------------------------------------------------------------
  // Handlebars helpers (required by faction-sheet.hbs)
  // ------------------------------------------------------------
  try {
    if (globalThis.Handlebars) {
      if (!Handlebars.helpers.bbttcc_eq) {
        Handlebars.registerHelper("bbttcc_eq", (a, b) => String(a) === String(b));
      }
      if (!Handlebars.helpers.bbttcc_contains) {
        Handlebars.registerHelper("bbttcc_contains", (arr, v) => {
          if (!arr) return false;
          if (Array.isArray(arr)) return arr.includes(v);
          return String(arr).split(",").map(s => s.trim()).includes(String(v).trim());
        });
      }
    }
  } catch (e) {
    console.warn("[bbttcc-factions] helper registration failed", e);
  }

  try {
    foundry.applications.apps.DocumentSheetConfig.registerSheet(
      Actor, MODULE_ID, BBTTCCFactionSheet,
      { types: ["npc"], makeDefault: false, label: "BBTTCC Faction" }
    );
    log("Faction sheet registered", SHEET_ID);
  } catch (e) { warn("registerSheet failed", e); }
});

Hooks.once("ready", async () => {
  try {
    game.bbttcc ??= {};
    game.bbttcc.apps ??= {};
    game.bbttcc.apps.RigConsole = BBTTCCRigConsole;

    // -----------------------------------------------------------------
    // Starting Faction Packages (Registry) — v1.0
    // -----------------------------------------------------------------
    // We keep this as a pure JS registry mounted on the BBTTCC API so:
    // - The Wizard can apply packages atomically.
    // - We can add presets without touching world data.
    // - Later we can optionally mirror to a world setting.
    game.bbttcc.api ??= {};
    game.bbttcc.api.factions ??= {};

    const OP_KEYS = game.bbttcc?.api?.op?.KEYS ?? [
      "violence","nonlethal","intrigue","economy","softpower",
      "diplomacy","logistics","culture","faith"
    ];

    // Helper to build a full 9-key object with defaults.
    const _opObj = (seed = {}) => {
      const out = {};
      for (const k of OP_KEYS) out[k] = clamp0(seed?.[k] ?? 0);
      return out;
    };

    // Level 1 package defaults (Alpha-safe, conservative)
    const PKG_STANDARD_V1 = {
      key: "standard",
      label: "Standard Start (v1)",
      version: "1.0.0",
      factionLevel: 1,

      // OP economy (bank actual + bank potential)
      opCaps: _opObj({
        violence: 5,
        nonlethal: 5,
        intrigue: 5,
        economy: 7,
        softpower: 6,
        diplomacy: 6,
        logistics: 7,
        culture: 5,
        faith: 5
      }),
      opSeed: _opObj({
        violence: 1,
        nonlethal: 1,
        intrigue: 1,
        economy: 3,
        softpower: 2,
        diplomacy: 1,
        logistics: 3,
        culture: 1,
        faith: 1
      }),

      // Territory/Assets (wizard applies these; registry is declarative)
      startingHexes: { count: 1, placementRule: "free-pick", initialStatus: "claimed" },
      startingFacilities: [{ templateKey: "basic" }],
      startingRigs: [],

      // Tracks (kept mild; your sheet/enhancers already assume these exist)
      tracks: { morale: 25, loyalty: 25, darkness: 0, victory: { vp: 0, unity: 0, badgeKey: "emerging" } },


      // Doctrine (baseline, auto-granted on faction creation)
      // These keys must exist in raid.EFFECTS to have full tooltip/cost text.
      doctrine: {
        maneuvers: Array.from(_BBTTCC_STANDARD_START_MANEUVERS),
        strategics: Array.from(_BBTTCC_STANDARD_START_STRATEGICS)
      },

      // War log provenance (wizard can append specifics like hex name)
      initialWarLog: [
        "Faction founded. Level 1 established.",
        "Starting OP bank seeded (Standard Start v1).",
        "Claim staked on a home hex."
      ]
    };

    // Mount registry + helpers (non-breaking augmentation)
    const factionApi = game.bbttcc.api.factions;
    factionApi.startingPackages ??= {};
    factionApi.startingPackages[PKG_STANDARD_V1.key] = PKG_STANDARD_V1;

    factionApi.listStartingPackages ??= (() => {
      return Object.values(factionApi.startingPackages ?? {}).map(p => ({ key: p.key, label: p.label, version: p.version }));
    });

    factionApi.getStartingPackage ??= ((key = "standard") => {
      const p = (factionApi.startingPackages ?? {})[key];
      return p ? deepClone(p) : null;
    });


    // -----------------------------------------------------------------
    // Doctrine API — embedded feat items as faction entitlements
    // -----------------------------------------------------------------
    factionApi.doctrine ??= {};

    // List doctrine items on a faction actor (kind optional: "maneuver" | "strategic")
    factionApi.doctrine.list ??= ((factionActorOrId, kind = null) => {
      const a = resolveFactionActor(factionActorOrId);
      if (!a) return [];
      return _bbttccListDoctrineItems(a, kind);
    });

    // Return a Set of owned doctrine keys (lowercased)
    factionApi.doctrine.ownedKeys ??= ((factionActorOrId, kind) => {
      const a = resolveFactionActor(factionActorOrId);
      if (!a) return new Set();
      return _bbttccOwnedDoctrineKeys(a, kind);
    });

    // Grant a doctrine item to a faction actor
    // Options:
    //   silent=true -> no war log receipt (used for starting packages)
    factionApi.doctrine.grant ??= (async (factionActorOrId, { kind, key, silent=false } = {}) => {
      const a = resolveFactionActor(factionActorOrId);
      return _bbttccGrantDoctrineEmbeddedItem(a, { kind, key, silent: !!silent });
    });



// Apply a starting package atomically (Wizard-ready).
// Writes only bbttcc-factions flags + appends provenance war logs.
factionApi.applyStartingPackage ??= (async ({
  actor,
  actorId,
  packageKey = "standard",
  homeHexUuid = null,
  overrides = {},
  dryRun = false
} = {}) => {
  const a = actor
    ?? (actorId ? game.actors?.get?.(actorId) : null);
  if (!a) throw new Error("applyStartingPackage: missing actor");
  if (!isFactionActor(a)) {
    // Allow birthing a new faction actor by setting isFaction here.
    // We still validate it is an Actor document.
    if (!(a instanceof Actor)) throw new Error("applyStartingPackage: actor is not an Actor");
  }

  const basePkg = factionApi.getStartingPackage(packageKey);
  if (!basePkg) throw new Error(`applyStartingPackage: unknown packageKey '${packageKey}'`);

  // Shallow merge overrides (deep merge for nested objects we care about)
  const pkg = foundry.utils.mergeObject(deepClone(basePkg), deepClone(overrides || {}), { inplace: false, insertKeys: true, insertValues: true, overwrite: true });

  const now = Date.now();
  const date = new Date(now).toLocaleString();

  const opCaps = _normalizeOps(pkg.opCaps || {});
  const opSeed = _normalizeOps(pkg.opSeed || {});

  // Victory object: keep existing badge payload if present, else set minimal defaults
  const curVictory = a.getFlag?.(MODULE_ID, "victory") || {};
  const vIn = pkg.tracks?.victory || {};
  const victory = foundry.utils.mergeObject(
    {
      vp: 0,
      unity: 0,
      badgeKey: "emerging",
      badgeLabel: "Emerging",
      badge: curVictory.badge || null
    },
    deepClone(vIn),
    { inplace: false, overwrite: true }
  );

  const tracks = pkg.tracks || {};
  const morale = clamp0(tracks.morale ?? 2);
  const loyalty = clamp0(tracks.loyalty ?? 2);
  const darkness = clamp0(tracks.darkness ?? 0);

  // Stockpile shape is canonical in this module
  const stockpile = _zeros();

  // War log provenance entries
  const warLogsCur = Array.isArray(a.getFlag?.(MODULE_ID, "warLogs")) ? deepClone(a.getFlag(MODULE_ID, "warLogs")) : [];
  const prov = Array.isArray(pkg.initialWarLog) ? pkg.initialWarLog : [];
  for (let i = 0; i < prov.length; i++) {
    let summary = String(prov[i] ?? "").trim();
    if (!summary) continue;
    if (i === prov.length - 1 && homeHexUuid) {
      summary = `${summary} (${homeHexUuid})`;
    }
    warLogsCur.push({ ts: now + i, date, type: "commit", summary });
  }

  const patch = {
    isFaction: true,
    factionLevel: clamp0(pkg.factionLevel ?? 1) || 1,

    opCaps,
    opBank: opSeed,

    // Keep these minimal; engines fill them later
    raidPlan: {},
    ops: {},

    // Assets
    rigs: Array.isArray(pkg.startingRigs) ? deepClone(pkg.startingRigs) : [],
    activeRigId: "",

    // Resources
    stockpile,

    // Tracks
    morale,
    loyalty,
    darkness,
    victory,

    // Optional anchor
    ...(homeHexUuid ? { homeHexUuid: String(homeHexUuid) } : {})
  };

  if (dryRun) return { ok: true, actorId: a.id, packageKey: pkg.key, patch, appendedWarLogs: prov.length };

  const update = {};
  for (const [k, v] of Object.entries(patch)) {
    update[`flags.${MODULE_ID}.${k}`] = v;
  }
  update[`flags.${MODULE_ID}.warLogs`] = warLogsCur;
  update[`flags.${MODULE_ID}.doctrineSeedMeta`] = {
    packageKey: String(pkg.key || packageKey || "standard"),
    version: String(pkg.version || "1.0.0"),
    inProgress: true,
    applied: false,
    source: "applyStartingPackage",
    updatedTs: now
  };

  await a.update(update);

  // Baseline doctrine (starting package): grant embedded feat items silently.
  try {
    const doc = pkg.doctrine || {};
    const mans = Array.isArray(doc.maneuvers) ? doc.maneuvers : [];
    const strs = Array.isArray(doc.strategics) ? doc.strategics : [];
    for (const k of mans) { try { await factionApi.doctrine.grant(a, { kind:"maneuver", key:String(k||""), silent:true }); } catch(_e){} }
    for (const k of strs) { try { await factionApi.doctrine.grant(a, { kind:"strategic", key:String(k||""), silent:true }); } catch(_e){} }
  } catch (e) { /* non-fatal */ }

  try {
    await a.update({
      [`flags.${MODULE_ID}.doctrineSeedMeta`]: {
        packageKey: String(pkg.key || packageKey || "standard"),
        version: String(pkg.version || "1.0.0"),
        inProgress: false,
        applied: true,
        source: "applyStartingPackage",
        updatedTs: Date.now()
      }
    });
  } catch (_e) {}

  return { ok: true, actorId: a.id, packageKey: pkg.key, applied: patch };
});



// Create a new faction actor and apply a starting package (Wizard pipeline helper).
// NOTE: Keeps actor.type = 'npc' to match existing faction actors in this world.
factionApi.createFactionFromPackage ??= (async ({
  name,
  packageKey = "standard",
  homeHexUuid = null,
  overrides = {},
  folderId = null,
  img = null,
  dryRun = false
} = {}) => {
  const nm = String(name ?? "").trim();
  if (!nm) throw new Error("createFactionFromPackage: missing name");
  const actorData = {
    name: nm,
    type: "npc"
  };
  if (folderId) actorData.folder = folderId;
  if (img) actorData.img = img;

  if (dryRun) {
    // Preview: compute patch that would be applied, without creating an actor.
    const pkg = factionApi.getStartingPackage(packageKey);
    if (!pkg) throw new Error(`createFactionFromPackage: unknown packageKey '${packageKey}'`);
    const preview = await factionApi.applyStartingPackage({
      actor: { id: "(dry-run)", getFlag: () => null }, // minimal stub; applyStartingPackage won't use update path when dryRun
      packageKey,
      homeHexUuid,
      overrides,
      dryRun: true
    }).catch(() => null);

    // If stub preview fails due to Actor instance checks, fall back to returning package info.
    return {
      ok: true,
      dryRun: true,
      actorData,
      packageKey,
      package: pkg,
      preview
    };
  }

  // Create actor first, then apply package atomically.
  const a = await Actor.create(actorData, { renderSheet: true });
  if (!a) throw new Error("createFactionFromPackage: Actor.create failed");

  const applied = await factionApi.applyStartingPackage({
    actor: a,
    packageKey,
    homeHexUuid,
    overrides,
    dryRun: false
  });

  return { ok: true, actorId: a.id, actorUuid: a.uuid, packageKey, applied };
});

// ─────────────────────────────────────────────────────────────────────────────
// ------------------------------------------------------------
// Starting Territory Assignment (Wizard-ready, deterministic)
// ------------------------------------------------------------

// Deterministic index from selectionKey
function __bbttccHashToIndex(str, mod) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % Math.max(1, mod);
}

function __bbttccIsHexDrawing(dr) {
  const TER_MOD = "bbttcc-territory";
  const tf = dr?.flags?.[TER_MOD] ?? {};
  return (tf.isHex === true) || (tf.kind === "territory-hex") ||
    (dr.shape?.type === "p" && Array.isArray(dr.shape?.points) && dr.shape.points.length === 12);
}

function __bbttccAvailabilityTier(dr) {
  const TER_MOD = "bbttcc-territory";
  const tf = dr?.flags?.[TER_MOD] ?? {};
  const status = String(tf.status ?? "").trim().toLowerCase();
  const factionId = String(tf.factionId ?? "").trim();
  if (status === "unclaimed") return 1;               // prefer true unclaimed
  if (!factionId || factionId === "(none)") return 2; // fallback: ownerless
  return 99;
}

function __bbttccCentroid(dr) {
  const x = Number(dr.x ?? 0), y = Number(dr.y ?? 0);
  const w = Number(dr.shape?.width ?? dr.width ?? 0);
  const h = Number(dr.shape?.height ?? dr.height ?? 0);
  return { cx: x + (w / 2), cy: y + (h / 2) };
}

function __bbttccDist2(a, b) {
  const dx = a.cx - b.cx;
  const dy = a.cy - b.cy;
  return dx * dx + dy * dy;
}

// Shared selector used by preview + apply
async function __bbttccSelectStartingCluster({ selectionKey, baseHexUuid = null, genHexUuid1 = null, genHexUuid2 = null, baseType = "settlement", generatorTypes = ["farm", "mine"] } = {}) {
  const TER_MOD = "bbttcc-territory";
  const scenes = game.scenes?.contents ?? [];
  const poolAll = [];

  for (const sc of scenes) {
    const drawings = sc.drawings?.contents ?? [];
    for (const dr of drawings) {
      if (!__bbttccIsHexDrawing(dr)) continue;
      const tier = __bbttccAvailabilityTier(dr);
      if (tier === 99) continue;
      const name = String((dr.flags?.[TER_MOD]?.name ?? dr.text ?? "").trim()) || (dr.text || dr.name || `Hex ${dr.id}`);
      poolAll.push({ sc, dr, uuid: dr.uuid, name, tier });
    }
  }

  if (poolAll.length < 3) throw new Error(`assignStartingTerritory: need 3 available hexes; found ${poolAll.length}.`);

  const tier1 = poolAll.filter(h => h.tier === 1);
  const pool = (tier1.length >= 3) ? tier1 : poolAll;

  let base = null;
  if (baseHexUuid) {
    base = poolAll.find(h => h.uuid === baseHexUuid) ?? null;
    if (!base) throw new Error("assignStartingTerritory: baseHexUuid not found in available pool.");
  } else {
    const key = String(selectionKey || `${baseType}:${(generatorTypes||[]).join(",")}:${game.world.id}`);
    const idx = __bbttccHashToIndex(key, pool.length);
    base = pool[idx];
  }

  const bc = __bbttccCentroid(base.dr);

  // Generator picks:
  // - If GM explicitly chose generator hexes, honor them.
  // - Otherwise choose nearest two available hexes to the base.
  let gen1 = null;
  let gen2 = null;

  if (genHexUuid1 && genHexUuid2) {
    const g1 = poolAll.find(h => h.uuid === genHexUuid1) ?? null;
    const g2 = poolAll.find(h => h.uuid === genHexUuid2) ?? null;
    if (!g1 || !g2) throw new Error("assignStartingTerritory: generator hex UUID not found in available pool.");
    if (g1.uuid === base.uuid || g2.uuid === base.uuid) throw new Error("assignStartingTerritory: generator hex cannot equal base hex.");
    if (g1.uuid === g2.uuid) throw new Error("assignStartingTerritory: generator hexes must be distinct.");

    gen1 = g1;
    gen2 = g2;
  } else {
    const sorted = poolAll
      .filter(h => h.uuid !== base.uuid)
      .map(h => ({ ...h, d2: __bbttccDist2(bc, __bbttccCentroid(h.dr)) }))
      .sort((a, b) => a.d2 - b.d2);

    gen1 = sorted[0];
    gen2 = sorted[1];
    if (!gen1 || !gen2) throw new Error("assignStartingTerritory: could not find 2 generator neighbors.");
  }

  return [
    { role: "base", ...base, type: String(baseType), progress: 4, capital: true },
    { role: "gen", ...gen1, type: String(generatorTypes?.[0] || "farm"), progress: 2, capital: false },
    { role: "gen", ...gen2, type: String(generatorTypes?.[1] || "mine"), progress: 2, capital: false }
  ];
}

// Preview API (no writes): lets Wizard show the chosen cluster deterministically
factionApi.previewStartingTerritory ??= (async ({
  selectionKey = "",
  baseHexUuid = null,
  genHexUuid1 = null,
  genHexUuid2 = null,
  baseType = "settlement",
  generatorTypes = ["farm", "mine"]
} = {}) => {
  const key = String(selectionKey || `${baseType}:${(generatorTypes||[]).join(",")}:${game.world.id}`);
  const picks = await __bbttccSelectStartingCluster({ selectionKey: key, baseHexUuid, genHexUuid1, genHexUuid2, baseType, generatorTypes });
  return {
    ok: true,
    dryRun: true,
    selectionKey: key,
    territoryPatches: picks.map(p => {
      const isBase = String(p.role) === "base";
      return ({
        uuid: p.uuid,
        sceneId: p.sc.id,
        name: p.name,
        role: p.role,
        type: p.type,
        status: "claimed",
        capital: p.capital,
        integration: { progress: p.progress },
        size: isBase ? "town" : "outpost",
        population: isBase ? "medium" : "low"
      });
    })
  };
});


// Starting cluster resource seeding (matches canonical territory TYPE_BASE × SIZE_MULT)
// Purpose: newborn factions should have functioning productive hexes immediately,
// while preserving the broader world model where typed hexes may still be inert
// until explicitly configured by a GM.
const __bbttccStartingTypeBase = {
  settlement:{ food:2, materials:1, trade:3, military:0, knowledge:0 },
  fortress:  { food:0, materials:3, trade:1, military:4, knowledge:0 },
  mine:      { food:0, materials:5, trade:2, military:0, knowledge:0 },
  farm:      { food:5, materials:1, trade:2, military:0, knowledge:0 },
  port:      { food:2, materials:2, trade:4, military:0, knowledge:0 },
  factory:   { food:0, materials:4, trade:3, military:0, knowledge:0 },
  research:  { food:0, materials:1, trade:1, military:0, knowledge:4 },
  temple:    { food:1, materials:1, trade:1, military:0, knowledge:2 },
  wasteland: { food:0, materials:1, trade:0, military:0, knowledge:0 },
  ruins:     { food:0, materials:2, trade:0, military:0, knowledge:1 },
  wilderness:{ food:0, materials:0, trade:0, military:0, knowledge:0 }
};
const __bbttccStartingSizeMult = { none:0, outpost:0.5, village:0.75, town:1, city:1.5, metropolis:2, megalopolis:3 };

function __bbttccSeedResourcesForStartingHex(type, size) {
  const t = String(type || "wilderness").toLowerCase().trim();
  const s = String(size || "none").toLowerCase().trim();
  const base = __bbttccStartingTypeBase[t] || __bbttccStartingTypeBase.wilderness;
  const mult = Number(__bbttccStartingSizeMult[s]);
  const m = Number.isFinite(mult) ? mult : 0;
  const out = {};
  for (const k of ["food","materials","trade","military","knowledge"]) {
    out[k] = Math.max(0, Math.round((Number(base[k] || 0)) * m));
  }
  return out;
}

// Apply API (writes to drawings + faction actor): claims 3 hexes and sets type/progress/capital.
factionApi.assignStartingTerritory ??= (async ({
  factionActor,
  factionId,
  baseType = "settlement",
  generatorTypes = ["farm", "mine"],
  selectionKey = "",
  baseHexUuid = null,
  genHexUuid1 = null,
  genHexUuid2 = null,
  dryRun = false
} = {}) => {
  const TER_MOD = "bbttcc-territory";
  const FAC_MOD = MODULE_ID;

  const actor =
    factionActor ??
    (factionId ? game.actors.get(factionId) : null);

  if (!actor) throw new Error("assignStartingTerritory: missing factionActor/factionId");
  if (actor.getFlag(FAC_MOD, "isFaction") !== true) throw new Error("assignStartingTerritory: actor is not a faction");

  const key = String(selectionKey || `${actor.id}:${baseType}:${(generatorTypes||[]).join(",")}:${game.world.id}`);
  const picks = await __bbttccSelectStartingCluster({ selectionKey: key, baseHexUuid, genHexUuid1, genHexUuid2, baseType, generatorTypes });

  // Temple overlay (birth-only): faith/culture caps+seed +1 when any temple is chosen
  const hasTemple = picks.some(p => String(p.type).toLowerCase() === "temple");

  const fFlags = foundry.utils.duplicate(actor.flags?.[FAC_MOD] ?? {});
  const opCaps = foundry.utils.duplicate(fFlags.opCaps ?? {});
  const opBank = foundry.utils.duplicate(fFlags.opBank ?? {});
  const warLogs = Array.isArray(fFlags.warLogs) ? [...fFlags.warLogs] : [];

  if (hasTemple) {
    opCaps.faith = (Number(opCaps.faith ?? 0) || 0) + 1;
    opCaps.culture = (Number(opCaps.culture ?? 0) || 0) + 1;
    opBank.faith = (Number(opBank.faith ?? 0) || 0) + 1;
    opBank.culture = (Number(opBank.culture ?? 0) || 0) + 1;
  }

  // Clamp bank to caps (if caps exist)
  const keys = game.bbttcc?.api?.op?.KEYS ?? ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
  for (const k of keys) {
    const v = Number(opBank[k] ?? 0) || 0;
    const c = Number(opCaps?.[k] ?? 0) || 0;
    if (c > 0) opBank[k] = Math.max(0, Math.min(v, c));
  }

  const ts = Date.now();
  warLogs.push({ type: "commit", ts, date: new Date(ts).toLocaleString(), summary: `Starting cluster claimed: base=${picks[0].type} (4/6), gens=${picks[1].type} (2/6), ${picks[2].type} (2/6).` });
  if (hasTemple) {
    const ts2 = Date.now();
    warLogs.push({ type: "commit", ts: ts2, date: new Date(ts2).toLocaleString(), summary: "Temple start detected: Faith/Culture caps+seed applied (+1 each)." });
  }

  const territoryPatches = picks.map(p => {
    const isBase = String(p.role) === "base";
    return {
      uuid: p.uuid,
      sceneId: p.sc.id,
      name: p.name,
      role: p.role,
      type: p.type,
      status: "claimed",
      capital: p.capital,
      integration: { progress: p.progress },
      // Seed productive defaults for newly created factions only.
      // This preserves general territory behavior elsewhere, including
      // intentionally inert / abandoned typed hexes.
      size: isBase ? "town" : "outpost",
      population: isBase ? "medium" : "low",
      resources: __bbttccSeedResourcesForStartingHex(
        p.type,
        (isBase ? "town" : "outpost")
      ),
      factionId: actor.id
    };
  });

  if (dryRun) {
    return { ok: true, dryRun: true, selectionKey: key, territoryPatches };
  }

  // Apply to drawings
  for (const p of picks) {
    const isBase = String(p.role) === "base";
    const nextFlags = foundry.utils.mergeObject(foundry.utils.duplicate(p.dr.flags?.[TER_MOD] ?? {}), {
      isHex: true,
      kind: "territory-hex",
      status: "claimed",
      factionId: actor.id,
      faction: actor.name,
      ownerId: actor.id,
      ownerName: actor.name,
      type: p.type,
      capital: !!p.capital,
      integration: { progress: p.progress },
      // Seed productive defaults for the starting cluster only.
      // This keeps the broader territory model flexible:
      // a typed hex elsewhere may still be intentionally abandoned/inert.
      size: isBase ? "town" : "outpost",
      population: isBase ? "medium" : "low",
      autoCalc: true,
      resources: __bbttccSeedResourcesForStartingHex(
        p.type,
        (isBase ? "town" : "outpost")
      )
    }, { inplace: false, overwrite: true });

    await p.sc.updateEmbeddedDocuments("Drawing", [{
      _id: p.dr.id,
      [`flags.${TER_MOD}`]: nextFlags
    }]);
  }

  // Apply to faction actor
  const factionPatch = {
    homeHexUuid: picks[0].uuid,
    startHexes: picks.map(p => p.uuid),
    opCaps,
    opBank,
    warLogs
  };

  await actor.update({ [`flags.${FAC_MOD}`]: foundry.utils.mergeObject(foundry.utils.duplicate(actor.flags?.[FAC_MOD] ?? {}), factionPatch, { inplace:false, overwrite:true }) });

  return {
    ok: true,
    selectionKey: key,
    chosen: territoryPatches,
    homeHexUuid: picks[0].uuid,
    startHexes: picks.map(p => p.uuid)
  };
});


// Faction Creation Wizard (UI Shell — MVP)
// - GM-facing, minimal steps: Identity → Package+Home Hex → Review+Create
// - Calls createFactionFromPackage() under the hood
// - No roster/entitlement wiring yet (next slice)
// ──────────────────────────────────────────────────────────────────────────────
class BBTTCCFactionCreationWizard extends (globalThis.Application ?? foundry?.applications?.api?.ApplicationV2 ?? Object) {
  static get defaultOptions() {
    const base = super.defaultOptions ?? {};
    return foundry.utils.mergeObject(base, {
      id: "bbttcc-faction-creation-wizard",
      title: "BBTTCC — Create Faction",
      width: 620,
      height: "auto",
      resizable: true,
      classes: ["bbttcc", "bbttcc-faction-wizard"],
      popOut: true
    });
  }

  // Private state holder (avoid clobbering Application._state numeric)
  get _fwState() {
    if (!this.__bbttccFactionWizard) {
      this.__bbttccFactionWizard = {
        name: "",
        packageKey: "standard",

        // Territory selection
        baseType: "settlement",
        genType1: "farm",
        genType2: "mine",

        // Optional GM overrides (defaults: system decides cluster)
        baseHexUuid: "",
        genHexUuid1: "",
        genHexUuid2: "",

        // Deterministic key (preview/apply parity; also good provenance)
        selectionKey: "",

        // Data sources
        packages: [],
        hexes: []
      };
    }
    return this.__bbttccFactionWizard;
  }

  async _ensurePackages() {
    try {
      const list = game.bbttcc?.api?.factions?.listStartingPackages?.() ?? [];
      this._fwState.packages = Array.isArray(list) ? list : [];
      if (!this._fwState.packages.find(p => p.key === this._fwState.packageKey) && this._fwState.packages[0]) {
        this._fwState.packageKey = this._fwState.packages[0].key;
      }
    } catch (e) {
      warn("Wizard: failed to listStartingPackages()", e);
      this._fwState.packages = [];
    }
  }

  async _ensureHexes() {
    try {
      // Cache: enumerating all hex drawings across scenes can be slow.
      // Only rebuild when we don't already have a populated list.
      if (Array.isArray(this._fwState.hexes) && this._fwState.hexes.length) return;

      const TER_MOD = "bbttcc-territory";
      const rows = [];
      const scenes = game.scenes?.contents ?? [];
      for (const sc of scenes) {
        const drawings = sc.drawings?.contents ?? [];
        for (const dr of drawings) {
          const tf = dr.flags?.[TER_MOD] ?? {};
          const isHex = (tf.isHex === true) || (tf.kind === "territory-hex") ||
            (dr.shape?.type === "p" && Array.isArray(dr.shape?.points) && dr.shape.points.length === 12);
          if (!isHex) continue;

          const name = String(tf.name ?? dr.text ?? "").trim() || `Hex ${dr.id}`;
          const uuid = dr.uuid || `Scene.${sc.id}.Drawing.${dr.id}`;
          rows.push({ uuid, name, sceneId: sc.id, sceneName: sc.name || "—" });
        }
      }
      rows.sort((a,b) => (a.sceneName||"").localeCompare(b.sceneName||"") || (a.name||"").localeCompare(b.name||""));
      this._fwState.hexes = rows;
    } catch (e) {
      warn("Wizard: failed to enumerate hex drawings", e);
      this._fwState.hexes = [];
    }
  }

  async getData(options = {}) {
    await this._ensurePackages();
    await this._ensureHexes();

    const pkg = game.bbttcc?.api?.factions?.getStartingPackage?.(this._fwState.packageKey) ?? null;

    const sum9 = (obj) => {
      const keys = game.bbttcc?.api?.op?.KEYS ?? ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
      return keys.reduce((s,k)=> s + (Number(obj?.[k])||0), 0);
    };

    const bankTotal = sum9(pkg?.opSeed);
    const capTotal  = sum9(pkg?.opCaps);

    if (!String(this._fwState.selectionKey || '').trim()) this._rebuildSelectionKey();

    return {
      ...this._fwState,
      pkg,
      bankTotal,
      capTotal
    };
  }

  _rebuildSelectionKey() {
    const s = this._fwState;
    const nm = String(s.name || "Faction").trim() || "Faction";
    const g1 = String(s.genType1 || "farm").trim();
    const g2 = String(s.genType2 || "mine").trim();
    s.selectionKey = `${nm}:${s.baseType}:${g1},${g2}:${game.world.id}`;
  }

  async _renderInner(data) {
    const ctx = data ?? await this.getData();

    const pkgOptions = (ctx.packages || []).map(p => {
      const sel = p.key === ctx.packageKey ? "selected" : "";
      return `<option value="${p.key}" ${sel}>${foundry.utils.escapeHTML(p.label)} (${foundry.utils.escapeHTML(p.version)})</option>`;
    }).join("");

    const renderHexOptions = (selectedUuid) => (ctx.hexes || []).map(h => {
      const sel = (h.uuid === selectedUuid) ? "selected" : "";
      const label = `${h.sceneName} — ${h.name}`;
      return `<option value="${h.uuid}" ${sel}>${foundry.utils.escapeHTML(label)}</option>`;
    }).join("");

    const hexOptionsBase = renderHexOptions(ctx.baseHexUuid);
    const hexOptionsGen1 = renderHexOptions(ctx.genHexUuid1);
    const hexOptionsGen2 = renderHexOptions(ctx.genHexUuid2);

    const TYPE_OPTIONS = [
      { key: "settlement", label: "Settlement" },
      { key: "fortress", label: "Fortress" },
      { key: "mine", label: "Mine" },
      { key: "farm", label: "Farm" },
      { key: "factory", label: "Factory" },
      { key: "port", label: "Port" },
      { key: "research", label: "Research" },
      { key: "temple", label: "Temple / Shrine" }
    ];

    const mkTypeOpts = (selected) => TYPE_OPTIONS.map(t => {
      const sel = (t.key === selected) ? "selected" : "";
      return `<option value="${t.key}" ${sel}>${foundry.utils.escapeHTML(t.label)}</option>`;
    }).join("");

    const pkg = ctx.pkg;
    const pkgMeta = pkg ? `
      <div class="bbttcc-hint">
        <b>${foundry.utils.escapeHTML(pkg.label)}</b> • v${foundry.utils.escapeHTML(pkg.version)} • OP Seed <b>${ctx.bankTotal}</b> • OP Caps <b>${ctx.capTotal}</b>
      </div>
    ` : `<div class="bbttcc-hint">No package selected.</div>`;

    return `
      <style>
        .bbttcc-faction-wizard .window-content{ padding:12px; }
        .bbttcc-faction-wizard .bbttcc-character-wizard,
        .bbttcc-faction-wizard .bbttcc-wizard-shell{
          padding: 0.75rem 0.9rem 0.9rem;
          font-family: Helvetica, Arial, sans-serif;
          font-size: 12px;
          color: #e5e7eb;
          background:
            radial-gradient(circle at 0 0, rgba(148,163,184,0.18), transparent 55%),
            radial-gradient(circle at 100% 0, rgba(251,113,133,0.18), transparent 55%),
            radial-gradient(circle at 0 100%, rgba(56,189,248,0.18), transparent 60%),
            linear-gradient(145deg, rgba(15,23,42,0.98), rgba(15,23,42,0.96));
          border-radius: 0.85rem;
          box-shadow:
            0 0 0 1px rgba(15,23,42,0.95),
            0 18px 32px rgba(15,23,42,0.9);
          box-sizing: border-box;
        }
        .bbttcc-faction-wizard .bbttcc-wizard-header{ margin-bottom: .6rem; }
        .bbttcc-faction-wizard .bbttcc-wizard-title{
          margin:0 0 .2rem; font-size:15px; text-transform:uppercase; letter-spacing:.2em; font-weight:700;
        }
        .bbttcc-faction-wizard .bbttcc-wizard-subtitle{ margin:0; font-size:11px; color:#cbd5f5; opacity:.95; }
        .bbttcc-faction-wizard .bbttcc-wizard-grid{
          display:grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap:.6rem;
        }
        .bbttcc-faction-wizard .bbttcc-wizard-card{
          padding:.55rem .65rem;
          border-radius:.7rem;
          background:
            radial-gradient(circle at 0 0, rgba(30,64,175,0.24), transparent 60%),
            radial-gradient(circle at 100% 100%, rgba(147,51,234,0.24), transparent 55%),
            linear-gradient(160deg, rgba(15,23,42,0.98), rgba(15,23,42,1));
          border: 1px solid rgba(30,64,175,0.9);
          box-shadow: 0 0 0 1px rgba(15,23,42,0.9), 0 8px 20px rgba(15,23,42,0.95);
        }
        .bbttcc-faction-wizard .bbttcc-wizard-card-wide{ grid-column: 1 / -1; }
        .bbttcc-faction-wizard .bbttcc-wizard-card-title{
          margin:0 0 .35rem; font-size:12px; text-transform:uppercase; letter-spacing:.14em; font-weight:700;
        }
        .bbttcc-faction-wizard .bbttcc-field{ display:flex; flex-direction:column; gap:.15rem; margin-bottom:.35rem; }
        .bbttcc-faction-wizard .bbttcc-field label{
          font-size:11px; text-transform:uppercase; letter-spacing:.12em; color:#cbd5f5;
        }
        .bbttcc-faction-wizard .bbttcc-field input,
        .bbttcc-faction-wizard .bbttcc-field select{
          padding:.25rem .35rem; font-size:12px;
          background-color: rgba(15,23,42,0.92);
          border-radius: 0.35rem;
          border: 1px solid rgba(31,41,55,0.95);
          color: #e5e7eb;
        }
        .bbttcc-faction-wizard .bbttcc-field input:focus,
        .bbttcc-faction-wizard .bbttcc-field select:focus{
          outline:none; border-color: rgba(59,130,246,0.9);
          box-shadow: 0 0 0 1px rgba(59,130,246,0.7);
        }
        .bbttcc-faction-wizard .bbttcc-hint{ margin:.15rem 0 0; font-size:10px; color:#9ca3af; }
        .bbttcc-faction-wizard .bbttcc-muted{ opacity:.75; font-size:11px; }
        .bbttcc-faction-wizard .bbttcc-wizard-footer{
          display:flex; justify-content: space-between; align-items:center; gap:.6rem;
          margin-top:.6rem; padding-top:.6rem; border-top: 1px solid rgba(30,64,175,0.45);
        }
        .bbttcc-faction-wizard .bbttcc-wizard-create{
          display:inline-flex; align-items:center; gap:.35rem;
          padding:.32rem .9rem; font-size:12px;
          text-transform:uppercase; letter-spacing:.14em;
          border-radius:999px; border:1px solid rgba(59,130,246,0.9);
          background:
            radial-gradient(circle at 0 0, rgba(59,130,246,0.45), transparent 55%),
            linear-gradient(135deg, rgba(30,64,175,0.96), rgba(147,51,234,0.96));
          color:#e5e7eb; cursor:pointer;
          box-shadow: 0 0 0 1px rgba(15,23,42,0.95), 0 8px 20px rgba(15,23,42,0.95);
        }
        .bbttcc-faction-wizard .bbttcc-wizard-create:disabled{ opacity:.45; cursor:not-allowed; filter: grayscale(.25); }
        .bbttcc-faction-wizard .bbttcc-wizard-create:hover{ filter: brightness(1.05); }
        .bbttcc-faction-wizard code{
          background: rgba(0,0,0,0.25);
          padding: 0.05rem 0.25rem;
          border-radius: 0.35rem;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .bbttcc-faction-wizard .bbttcc-inline{
          display:flex; gap:.6rem; align-items:flex-end; flex-wrap:wrap;
        }
        .bbttcc-faction-wizard .bbttcc-inline > .bbttcc-field{ flex: 1 1 180px; margin-bottom:0; }
      </style>

      <form class="bbttcc-wizard-shell bbttcc-faction-wizard-form">
        <div class="bbttcc-wizard-header">
          <h2 class="bbttcc-wizard-title">Create Faction</h2>
          <p class="bbttcc-wizard-subtitle">One screen. Pick your start. Hit the button. Confirm the ritual.</p>
        </div>

        <div class="bbttcc-wizard-grid">

          <section class="bbttcc-wizard-card">
            <h3 class="bbttcc-wizard-card-title">Identity</h3>
            <div class="bbttcc-field">
              <label>Faction Name</label>
              <input type="text" name="name" value="${foundry.utils.escapeHTML(String(ctx.name ?? ""))}" placeholder="e.g. The Circuit Riders"/>
              <p class="bbttcc-hint">Creates an <b>NPC</b> actor flagged as a BBTTCC faction.</p>
            </div>
          </section>

          <section class="bbttcc-wizard-card">
            <h3 class="bbttcc-wizard-card-title">Package</h3>
            <div class="bbttcc-field">
              <label>Starting Package</label>
              <select name="packageKey">${pkgOptions}</select>
              ${pkgMeta}
            </div>
          </section>

          <section class="bbttcc-wizard-card bbttcc-wizard-card-wide">
            <h3 class="bbttcc-wizard-card-title">Territory Types</h3>

            <div class="bbttcc-inline">
              <div class="bbttcc-field">
                <label>Base Type (4/6)</label>
                <select name="baseType">${mkTypeOpts(ctx.baseType)}</select>
              </div>

              <div class="bbttcc-field">
                <label>Generator #1 (2/6)</label>
                <select name="genType1">${mkTypeOpts(ctx.genType1)}</select>
              </div>

              <div class="bbttcc-field">
                <label>Generator #2 (2/6)</label>
                <select name="genType2">${mkTypeOpts(ctx.genType2)}</select>
              </div>
            </div>

            <p class="bbttcc-hint">
              If you don’t pick hexes below, the system chooses a <b>deterministic starting cluster</b> for you.
              That means the same inputs produce the same cluster (good for reproducibility).
            </p>
          </section>

          <section class="bbttcc-wizard-card bbttcc-wizard-card-wide">
            <h3 class="bbttcc-wizard-card-title">Starting Hex Overrides (GM)</h3>

            <p class="bbttcc-muted" style="margin:0 0 .4rem;">
              Optional: force the exact three starting hexes. Leave blank for “system decides”.
            </p>

            <div class="bbttcc-inline">
              <div class="bbttcc-field">
                <label>Base Hex (capital)</label>
                <select name="baseHexSelect">
                  <option value="">— System Decides (Recommended) —</option>
                  ${hexOptionsBase}
                </select>
              </div>

              <div class="bbttcc-field">
                <label>Generator Hex #1</label>
                <select name="genHexSelect1">
                  <option value="">— Auto (nearest to base) —</option>
                  ${hexOptionsGen1}
                </select>
              </div>

              <div class="bbttcc-field">
                <label>Generator Hex #2</label>
                <select name="genHexSelect2">
                  <option value="">— Auto (nearest to base) —</option>
                  ${hexOptionsGen2}
                </select>
              </div>
            </div>

            <p class="bbttcc-hint">
              To fully manual-pick, set all three. If you only set Base, the two generators will auto-pick as the nearest neighbors.
            </p>
          </section>

        </div>

        <div class="bbttcc-wizard-footer">
          <div class="bbttcc-muted">
            Deterministic key: <code>${foundry.utils.escapeHTML(String(ctx.selectionKey || ""))}</code>
          </div>

          <button type="button" class="bbttcc-wizard-create" data-action="create"
            ${(!String(ctx.name||"").trim() || !String(ctx.packageKey||"").trim()) ? "disabled" : ""}>
            <i class="fas fa-bolt"></i> Create Faction
          </button>
        </div>
      </form>
    `;
  }

  activateListeners(html) {
    super.activateListeners?.(html);

    const root =
      (this.element?.[0] instanceof HTMLElement) ? this.element[0] :
      (this.element instanceof HTMLElement) ? this.element :
      null;
    if (!root) return;

    const readFields = () => {
      const s = this._fwState;

      const name = root.querySelector('input[name="name"]')?.value ?? s.name;
      const packageKey = root.querySelector('select[name="packageKey"]')?.value ?? s.packageKey;

      const baseType = root.querySelector('select[name="baseType"]')?.value ?? s.baseType;
      const genType1 = root.querySelector('select[name="genType1"]')?.value ?? s.genType1;
      const genType2 = root.querySelector('select[name="genType2"]')?.value ?? s.genType2;

      const baseHexUuid = root.querySelector('select[name="baseHexSelect"]')?.value ?? "";
      const genHexUuid1 = root.querySelector('select[name="genHexSelect1"]')?.value ?? "";
      const genHexUuid2 = root.querySelector('select[name="genHexSelect2"]')?.value ?? "";

      s.name = String(name || "");
      s.packageKey = String(packageKey || "standard");
      s.baseType = String(baseType || "settlement");
      s.genType1 = String(genType1 || "farm");
      s.genType2 = String(genType2 || "mine");
      s.baseHexUuid = String(baseHexUuid || "");
      s.genHexUuid1 = String(genHexUuid1 || "");
      s.genHexUuid2 = String(genHexUuid2 || "");

      this._rebuildSelectionKey();
    };

    const updateUi = () => {
      // Update deterministic key readout + Create button enabled state without re-rendering.
      const keyEl = root.querySelector(".bbttcc-muted code");
      if (keyEl) keyEl.textContent = String(this._fwState.selectionKey || "");

      const btn = root.querySelector('button[data-action="create"]');
      if (btn) {
        const ok = !!String(this._fwState.name || "").trim() && !!String(this._fwState.packageKey || "").trim();
        btn.disabled = !ok;
      }
    };

    // Keep state in sync as user edits.
    // IMPORTANT: do NOT re-render on every keystroke, or the input will lose focus.
    root.addEventListener("input", (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.matches('input[name="name"], select[name="packageKey"], select[name="baseType"], select[name="genType1"], select[name="genType2"], select[name="baseHexSelect"], select[name="genHexSelect1"], select[name="genHexSelect2"]')) {
        readFields();
        updateUi();
      }
    }, true);

    // Initial UI sync once mounted
    readFields();
    updateUi();

    root.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const action = btn.getAttribute("data-action");
        readFields();

        if (action !== "create") return;

        if (!game.user?.isGM) return ui.notifications.warn("GM only.");
        if (!String(this._fwState.name).trim()) return ui.notifications.warn("Please enter a faction name.");
        if (!String(this._fwState.packageKey).trim()) return ui.notifications.warn("Please choose a starting package.");

        const s = this._fwState;
        const genTypes = [s.genType1, s.genType2].filter(Boolean);
        const hasOverrides = !!(s.baseHexUuid || s.genHexUuid1 || s.genHexUuid2);

        // Compute final chosen hexes (including auto-picks) so the confirmation can show concrete names.
        let dry = null;
        try {
          dry = await game.bbttcc.api.factions.assignStartingTerritory({
            factionActor: { id: "DRYRUN" },
            baseType: s.baseType,
            generatorTypes: genTypes,
            selectionKey: s.selectionKey,
            baseHexUuid: s.baseHexUuid || null,
            genHexUuid1: s.genHexUuid1 || null,
            genHexUuid2: s.genHexUuid2 || null,
            dryRun: true
          });
        } catch (e) {
          // If dry-run fails, we'll still allow the user to confirm — creation will surface the real error.
          warn("Wizard: assignStartingTerritory dryRun failed", e);
        }

        const pickRows = Array.isArray(dry?.territoryPatches)
          ? dry.territoryPatches
          : (Array.isArray(dry?.chosen) ? dry.chosen : []);

        const picksHtml = pickRows.length ? `
          <div style="margin-top:.45rem;">
            <div class="bbttcc-muted" style="margin-bottom:.25rem;">Starting Hexes:</div>
            <ul style="margin:0; padding-left:1.15rem;">
              ${pickRows.map(p => {
                const nm = foundry.utils.escapeHTML(String(p.name || p.hexName || p.uuid || ""));
                const ty = foundry.utils.escapeHTML(String(p.type || ""));
                const role = String(p.role || "");
                const roleLabel = role === "base" ? "Capital" : "Generator";
                return `<li><b>${roleLabel}:</b> ${nm} <span class="bbttcc-muted">(${ty})</span></li>`;
              }).join("")}
            </ul>
          </div>
        ` : "";

        const summaryHtml = `
          <div class="bbttcc-muted" style="margin-bottom:.35rem;">
            You're about to forge a faction with the following choices:
          </div>
          <ul style="margin:0; padding-left:1.15rem;">
            <li><b>Name:</b> ${foundry.utils.escapeHTML(String(s.name||""))}</li>
            <li><b>Package:</b> ${foundry.utils.escapeHTML(String(s.packageKey||""))}</li>
            <li><b>Base Type:</b> ${foundry.utils.escapeHTML(String(s.baseType||""))}</li>
            <li><b>Generators:</b> ${foundry.utils.escapeHTML(String(genTypes.join(", ")||""))}</li>
            <li><b>Hex Overrides:</b> ${hasOverrides ? "Yes" : "No (System decides cluster)"}</li>
            <li><b>Key:</b> <code>${foundry.utils.escapeHTML(String(s.selectionKey||""))}</code></li>
          </ul>
          ${picksHtml}
          ${hasOverrides ? `<p class="bbttcc-muted" style="margin:.45rem 0 0;">Override note: Base/Gen hexes will be honored when provided; missing gens will auto-pick nearest to base.</p>` : ""}
        `;

        // Toast + confirm dialog.
        ui.notifications.info("Review your choices — confirm to create the faction.");

        const ok = await new Promise((resolve) => {
          const dlg = new Dialog({
            title: "Confirm Faction Creation",
            content: summaryHtml,
            buttons: {
              yes: {
                icon: '<i class="fas fa-check"></i>',
                label: "Confirm",
                callback: () => resolve(true)
              },
              no: {
                icon: '<i class="fas fa-times"></i>',
                label: "Go Back",
                callback: () => resolve(false)
              }
            },
            default: "no",
            close: () => resolve(false)
          });
          dlg.render(true);
        });

        if (!ok) return;

        try {
          // 1) Create faction actor + apply starting package
          const created = await game.bbttcc.api.factions.createFactionFromPackage({
            name: s.name,
            packageKey: s.packageKey
          });

          const a = game.actors.get(created.actorId);
          if (!a) throw new Error("Created faction actor not found.");

          // 2) Claim + configure starting territory (deterministic via selectionKey)
          await game.bbttcc.api.factions.assignStartingTerritory({
            factionActor: a,
            baseType: s.baseType,
            generatorTypes: genTypes,
            selectionKey: s.selectionKey,
            baseHexUuid: s.baseHexUuid || null,
            genHexUuid1: s.genHexUuid1 || null,
            genHexUuid2: s.genHexUuid2 || null,
            dryRun: false
          });

          ui.notifications.info(`Faction created: ${s.name}`);
          a.sheet?.render?.(true, { focus: true });
          this.close();
        } catch (e) {
          console.error(e);
          ui.notifications.error(`Failed to create faction: ${e?.message ?? e}`);
        }
      });
    });
  }
}

// API opener
factionApi.openCreationWizard ??= (() => {
  let _inst = null;
  return () => {
    if (!game.user?.isGM) return ui.notifications.warn("GM only.");
    try {
      if (_inst && _inst.rendered) {
        _inst.bringToTop?.();
        return _inst;
      }
      _inst = new BBTTCCFactionCreationWizard();
      _inst.render(true);
      return _inst;
    } catch (e) {
      console.error(e);
      ui.notifications.error(`Failed to open wizard: ${e?.message ?? e}`);
    }
  };
})();





    log("ready — startingPackages registry mounted", factionApi.listStartingPackages());

    // Load rig CSS once
    await _ensureRigConsoleCssLoaded();

    // Install Rig → Travel bridge at startup
    _installRigTravelBridge();
  } catch (e) {
    warn("RigConsole register/css/bridge", e);
  }

  // Ensure faction hints + sheet assignment
  for (const a of listFactionActors()) {
    try {
      await ensureFactionHints(a);
      try { await _bbttccEnsureBaselineDoctrine(a); } catch(_e) {}
      const cur = a.getFlag("core","sheetClass") || foundry.utils.getProperty(a,"flags.core.sheetClass");
      if (isFactionActor(a) && cur !== SHEET_ID) await a.update({ "flags.core.sheetClass": SHEET_ID });
    } catch (e) { warn("ready assignment", e); }
  }

  // Attach Rigs helpers to existing API surface (non-breaking augmentation)
  try {
    const api = game.bbttcc?.api?.factions;
    if (api) {
      api.listRigs = (factionActorOrId) => {
        const a = resolveFactionActor(factionActorOrId);
        if (!a) return [];
        const rigs = a.getFlag(MODULE_ID, "rigs");
        return Array.isArray(rigs) ? deepClone(rigs) : [];
      };

      api.addRig = async (factionActorOrId, rigData = {}) => {
        const a = resolveFactionActor(factionActorOrId);
        if (!a) throw new Error("addRig: invalid faction actor");
        await ensureFactionRigs(a);

        const cur = a.getFlag(MODULE_ID, "rigs");
        const rigs = Array.isArray(cur) ? cur.slice() : [];
        const rig = normalizeRig(rigData, { ownerFactionId: a.id });

        while (rigs.some(x => x?.rigId === rig.rigId)) rig.rigId = makeRigId();

        rigs.push(rig);
        await a.update({ [`flags.${MODULE_ID}.rigs`]: rigs }, { render: false });
        return rig;
      };

      api.updateRig = async (factionActorOrId, rigId, patch = {}) => {
        const a = resolveFactionActor(factionActorOrId);
        if (!a) throw new Error("updateRig: invalid faction actor");
        await ensureFactionRigs(a);

        const cur = a.getFlag(MODULE_ID, "rigs");
        const rigs = Array.isArray(cur) ? cur.slice() : [];
        const idx = rigs.findIndex(r => r?.rigId === rigId);
        if (idx < 0) throw new Error(`updateRig: rig not found: ${rigId}`);

        const merged = { ...rigs[idx], ...deepClone(patch), rigId, ownerFactionId: a.id };
        rigs[idx] = normalizeRig(merged, { ownerFactionId: a.id });

        await a.update({ [`flags.${MODULE_ID}.rigs`]: rigs }, { render: false });
        return rigs[idx];
      };

      api.removeRig = async (factionActorOrId, rigId) => {
        const a = resolveFactionActor(factionActorOrId);
        if (!a) throw new Error("removeRig: invalid faction actor");
        await ensureFactionRigs(a);

        const cur = a.getFlag(MODULE_ID, "rigs");
        const rigs = Array.isArray(cur) ? cur.slice() : [];
        const next = rigs.filter(r => r?.rigId !== rigId);
        await a.update({ [`flags.${MODULE_ID}.rigs`]: next }, { render: false });
        return true;
      };

      api.ensureFactionRigs = async (factionActorOrId) => {
        const a = resolveFactionActor(factionActorOrId);
        if (!a) return false;
        return ensureFactionRigs(a);
      };

      log("ready — rigs API helpers attached (listRigs/addRig/updateRig/removeRig/ensureFactionRigs)");
    }
  } catch (e) {
    warn("ready — rigs API attach failed", e);
  }

  log("ready — faction sheet assignment pass complete");
});

Hooks.on("createActor", ensureFactionHints);
Hooks.on("updateActor", async (actor, data) => {
  try {
    const touchedFlag = foundry.utils.hasProperty(data, "flags.bbttcc-factions.isFaction");
    const touchedType = foundry.utils.hasProperty(data, "system.details.type.value");
    const touchedBBTTCC = foundry.utils.hasProperty(data, `flags.${MODULE_ID}`);

    if (touchedFlag || touchedType || touchedBBTTCC) {
      await ensureFactionHints(actor);
      const cur = actor.getFlag("core","sheetClass") || foundry.utils.getProperty(actor,"flags.core.sheetClass");
      if (isFactionActor(actor) && cur !== SHEET_ID) await actor.update({ "flags.core.sheetClass": SHEET_ID });
    }
  } catch (e) { warn("updateActor hook", e); }
});


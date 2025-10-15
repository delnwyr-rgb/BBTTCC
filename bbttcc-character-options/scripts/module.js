// bbttcc-character-options/scripts/module.js
// v1.4.2 — Fix double-counting by excluding our own calculatedOPs from scans
// Broad-spectrum OP discovery (+ .bonuses); persists to flags[MOD].calculatedOPs
// API: game.bbttcc.api.characterOptions.{recalcActor,recalcAll}

const MOD = "bbttcc-character-options";
const log  = (...a) => console.log(`[${MOD}]`, ...a);
const warn = (...a) => console.warn(`[${MOD}]`, ...a);

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

Hooks.once("ready", () => {
  game.bbttcc = game.bbttcc ?? { api: {} };
  game.bbttcc.api = game.bbttcc.api ?? {};
  game.bbttcc.api.characterOptions = { recalcActor, recalcAll };
  log("ready — API exposed: game.bbttcc.api.characterOptions = { recalcActor, recalcAll }");
});

function N(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
function blankOps(){
  return { violence:0, nonlethal:0, intrigue:0, economy:0, softpower:0,
           diplomacy:0, logistics:0, culture:0, faith:0 };
}
function addInto(a,b){ for(const k of OP_KEYS) a[k] = N(a[k]) + N(b?.[k]); return a; }
function sum(o){ return OP_KEYS.reduce((n,k)=>n + N(o?.[k]), 0); }

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

  // Might be a whole bundle
  const maybe = normAny(obj);
  if (sum(maybe) !== 0) addInto(out, maybe);

  // Follow promising keys (ops/bonuses/bbttcc), and a few generic children
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
    if (clone?.[MOD]?.calculatedOPs) delete clone[MOD].calculatedOPs; // ← key fix
    return clone;
  } catch { return {}; }
}

async function recalcActor(actorOrId) {
  const actor = typeof actorOrId === "string" ? game.actors.get(actorOrId) : actorOrId;
  if (!actor) { warn("recalcActor — no actor", actorOrId); return blankOps(); }

  const dbg = { items: [], flagsHit: false, sysHit: false, aeHit: false };

  // 1) Actor-level flags/system scans (flags scrubbed to avoid double-counting)
  const actorFlagsOps  = scanForOps(scrubActorFlags(actor.flags));
  const actorSystemOps = scanForOps(actor.system ?? {});
  if (sum(actorFlagsOps))  dbg.flagsHit = true;
  if (sum(actorSystemOps)) dbg.sysHit   = true;

  // 2) Item-level scans (flags across ALL namespaces + system)
  const itemOpsTotal = blankOps();
  for (const it of actor.items.contents) {
    const hit = { name: it.name, flags:0, system:0, effects:0 };

    // Fast path: our module flags (read ops + bonuses)
    const bco = it.flags?.[MOD];
    if (isPlain(bco)) {
      const opsFast  = normAny(bco.ops     || {});
      const bonFast  = normAny(bco.bonuses || {});
      if (sum(opsFast)) addInto(itemOpsTotal, opsFast);
      if (sum(bonFast)) addInto(itemOpsTotal, bonFast);
      hit.flags += sum(opsFast) + sum(bonFast);
    }

    // Deep scan across all flags (so 3rd-party can contribute)
    const fopsDeep = scanForOps(it.flags ?? {});
    if (sum(fopsDeep)) { addInto(itemOpsTotal, fopsDeep); hit.flags += sum(fopsDeep); }

    // system tree
    const sops = scanForOps(it.system ?? {});
    if (sum(sops)) { addInto(itemOpsTotal, sops); hit.system = sum(sops); }

    // effects on item
    const eops = scanAEForOps(it.effects ?? []);
    if (sum(eops)) { addInto(itemOpsTotal, eops); hit.effects = sum(eops); }

    if (hit.flags || hit.system || hit.effects) dbg.items.push(hit);
  }

  // 3) Active Effects on actor
  const actorAE = scanAEForOps(actor.effects ?? []);
  if (sum(actorAE)) dbg.aeHit = true;

  // 4) Total
  let total = blankOps();
  addInto(total, actorFlagsOps);
  addInto(total, actorSystemOps);
  addInto(total, itemOpsTotal);
  addInto(total, actorAE);

  await actor.setFlag(MOD, "calculatedOPs", total);

  const itemCount = dbg.items.length;
  const itemSum = sum(itemOpsTotal);
  log(`recalcActor ${actor.name} → total=${sum(total)} (actorFlags=${sum(actorFlagsOps)}, actorSystem=${sum(actorSystemOps)}, items=${itemSum} in ${itemCount} item(s), actorAE=${sum(actorAE)})`, total);

  Hooks.callAll("bbttcc:opsRecalculated", actor, foundry.utils.deepClone(total));
  return total;
}

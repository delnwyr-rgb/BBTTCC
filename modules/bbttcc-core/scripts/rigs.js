/* ─────────────────────────────────────────────────────────────────────────────
 * bbttcc-core · rigs.js — the system-agnostic RIG accessor (2026-10-08)
 * ─────────────────────────────────────────────────────────────────────────────
 * A rig (a vehicle or a structure) is a native `rig` Actor on fourththing (the
 * RFI canon, systems/fourththing/RIG_BOSS_SCHEMA.md) and a native dnd5e `vehicle`
 * Actor carrying the June-2026 flag layer `flags["bbttcc-factions"].rig` on dnd5e
 * (RIG_SPRINT_PLAN.md). Modules never touch either shape directly: they read a
 * NORMALISED view in the RFI field groups and write through `update()`.
 *
 *   game.bbttcc.rigs.isRig(actor)                   a rig on this system?
 *   game.bbttcc.rigs.data(actor) → {identity:{mobility,state,factionOwnerId,archetype,binding},
 *                                   integrity:{value,max,tier,bracket}, crew:{slots,capacity,crewMin,crewMax},
 *                                   travel:{speed,range,hazardResist,domains,depthRating},
 *                                   output:{modules,basePerTurn}, defenses:{resistances,immunities,vulnerabilities},
 *                                   order, frame, tags}   (never null for a rig; null otherwise)
 *   game.bbttcc.rigs.update(actor, { "identity.factionOwnerId": id, "integrity.value": 12, … })
 *   game.bbttcc.rigs.create({ name, img, identity, integrity, crew, travel, output, defenses, items, token }) → Actor
 *   game.bbttcc.rigs.list() · listByFaction(factionId) · ownerOf(actor) · setOwner(actor, factionId)
 *   game.bbttcc.rigs.health(actor) → {value, max}    (game.bbttcc.combat.getHealth)
 *   game.bbttcc.rigs.gearOf(item) → the rigGear flag (either flavour) · isFrame(item) · frameOf(actor)
 *   game.bbttcc.rigs.boardedRigOf(steward) → {rigId, tokenId, sceneId} | null
 *   await game.bbttcc.rigs.board(steward, rig, opts) · disembark(steward, opts)
 *        (fourththing: game.fourththing.rig.*; dnd5e: the runtime registers rigs.impl.{board,disembark})
 *   game.bbttcc.rigs.impl   — the per-system runtime hooks (dnd5e: bbttcc-factions rigs runtime)
 *
 * dnd5e field map (write side): identity.* / crew.* / travel.* / output.* / order / frame /
 * tier / bracket → flags.bbttcc-factions.rig.*; integrity.value|max → system.attributes.hp;
 * defenses.* → system.traits.dr/di/dv (through the rubric damage map, best effort).
 * The second owner key `flags.bbttcc-factions.factionId` is kept in step on both systems.
 * ───────────────────────────────────────────────────────────────────────────── */
const TAG = "[bbttcc-core/rigs]";
const F = "bbttcc-factions";                    // the flag scope the June layer and the faction link share
const isRFI = () => game.system?.id === "fourththing";
const rawSys = (a) => a?.system?.system ?? a?.system ?? {};
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const clone = (v) => foundry.utils.deepClone(v);

/** dnd5e damage threshold by bracket (RIG_SPRINT_PLAN §1; RFI plating is the system's own). */
const DT_BY_BRACKET = { personal: 0, light: 5, medium: 10, heavy: 15, siege: 20 };
const HP_BY_BRACKET = { personal: 10, light: 30, medium: 60, heavy: 100, siege: 150 };
const DEFAULT_CAPACITY = { pilot: { min: 1, max: 1 }, gunner: { min: 0, max: 2 }, engineer: { min: 0, max: 1 }, crew: { min: 0, max: 4 } };
const DEFAULT_TRAVEL = { speed: 1, range: 5, hazardResist: 0, domains: ["land"], depthRating: 0 };

function isRig(actor) {
  if (!actor) return false;
  if (isRFI()) return actor.type === "rig";
  return actor.type === "vehicle" && !!actor.flags?.[F]?.rig;
}

/** The normalised view. RFI = the system data itself (live object); dnd5e = assembled from flags + HP. */
function data(actor) {
  if (!isRig(actor)) return null;
  if (isRFI()) return rawSys(actor);
  const r = actor.flags?.[F]?.rig ?? {};
  const hp = actor.system?.attributes?.hp ?? {};
  const traits = actor.system?.traits ?? {};
  const setOf = (t) => [...(t?.value ?? [])].concat(t?.custom ? String(t.custom).split(";").map(s => s.trim()).filter(Boolean) : []);
  return {
    identity: { mobility: r.mobility ?? "mobile", state: r.state ?? "parked", factionOwnerId: r.factionOwnerId ?? actor.flags?.[F]?.factionId ?? "", archetype: r.archetype ?? "", binding: { hexId: "", sceneId: "", tokenId: "", ...(r.binding ?? {}) } },
    integrity: { value: num(hp.value), max: num(hp.max), tier: num(r.tier, 1), bracket: r.bracket ?? "medium" },
    crew: { slots: clone(r.crew?.slots ?? []), capacity: clone(r.crew?.capacity ?? r.frame?.capacity ?? DEFAULT_CAPACITY), crewMin: num(r.crew?.crewMin, 1), crewMax: num(r.crew?.crewMax, 8) },
    travel: { ...DEFAULT_TRAVEL, ...(r.travel ?? {}) },
    output: { modules: clone(r.output?.modules ?? []), basePerTurn: clone(r.output?.basePerTurn ?? {}) },
    defenses: { resistances: setOf(traits.dr), immunities: setOf(traits.di), vulnerabilities: setOf(traits.dv) },
    order: r.order ?? "none",
    frame: clone(r.frame ?? null),
    tags: clone(r.tags ?? [])
  };
}

/** Write normalised paths. RFI: `system.<path>`. dnd5e: the flag layer, HP for integrity. */
function toUpdate(actor, patch = {}) {
  const flat = foundry.utils.flattenObject(patch);
  const out = {};
  for (const [k, v] of Object.entries(flat)) {
    if (isRFI()) { out[`system.${k}`] = v; if (k === "identity.factionOwnerId") out[`flags.${F}.factionId`] = v || null; continue; }
    if (k === "integrity.value") out["system.attributes.hp.value"] = num(v);
    else if (k === "integrity.max") out["system.attributes.hp.max"] = num(v);
    else if (k === "integrity.tier") out[`flags.${F}.rig.tier`] = num(v, 1);
    else if (k === "integrity.bracket") { out[`flags.${F}.rig.bracket`] = v; out["system.attributes.hp.dt"] = DT_BY_BRACKET[v] ?? 0; }
    else if (k.startsWith("identity.")) { const sub = k.slice("identity.".length); out[`flags.${F}.rig.${sub}`] = v; if (sub === "factionOwnerId") out[`flags.${F}.factionId`] = v || null; }
    else if (k.startsWith("defenses.")) { const kind = { resistances: "dr", immunities: "di", vulnerabilities: "dv" }[k.split(".")[1]]; if (kind) out[`system.traits.${kind}.value`] = Array.isArray(v) ? v : [v]; }
    else out[`flags.${F}.rig.${k}`] = v;   // crew.*, travel.*, output.*, order, frame, tags
  }
  return out;
}
async function update(actor, patch = {}, options = {}) {
  if (!actor) return null;
  const u = toUpdate(actor, patch);
  return Object.keys(u).length ? actor.update(u, options) : actor;
}

/** Create a rig from a normalised spec. */
async function create(spec = {}) {
  const { name = "Rig", img, identity = {}, integrity = {}, crew = {}, travel = {}, output = {}, defenses = {}, items = [], token = {}, folder = null, tags = [] } = spec;
  const bracket = integrity.bracket ?? "medium";
  const max = num(integrity.max, HP_BY_BRACKET[bracket] ?? 30), value = num(integrity.value, max);
  if (isRFI()) {
    const system = { identity: { mobility: "mobile", state: "parked", factionOwnerId: "", archetype: "", binding: { hexId: "", sceneId: "", tokenId: "" }, ...identity },
      crew: { slots: [], capacity: DEFAULT_CAPACITY, crewMin: 1, crewMax: 8, ...crew }, integrity: { value, max, tier: num(integrity.tier, 1), bracket },
      output: { modules: [], basePerTurn: {}, ...output }, travel: { ...DEFAULT_TRAVEL, ...travel }, defenses: { resistances: [], immunities: [], vulnerabilities: [], ...defenses }, tags };
    return Actor.create({ name, type: "rig", img: img ?? "icons/svg/castle.svg", folder, system, items, prototypeToken: token, flags: { [F]: { factionId: identity.factionOwnerId || null } } });
  }
  const rig = { mobility: identity.mobility ?? "mobile", state: identity.state ?? "parked", factionOwnerId: identity.factionOwnerId ?? "", archetype: identity.archetype ?? "",
    binding: { hexId: "", sceneId: "", tokenId: "", ...(identity.binding ?? {}) }, tier: num(integrity.tier, 1), bracket,
    crew: { slots: [], capacity: DEFAULT_CAPACITY, crewMin: 1, crewMax: 8, ...crew }, output: { modules: [], basePerTurn: {}, ...output }, travel: { ...DEFAULT_TRAVEL, ...travel }, order: "none", tags };
  const traits = {}; for (const [k, kind] of [["resistances", "dr"], ["immunities", "di"], ["vulnerabilities", "dv"]]) if (defenses[k]?.length) traits[kind] = { value: defenses[k] };
  return Actor.create({ name, type: "vehicle", img: img ?? "icons/svg/castle.svg", folder,
    system: { attributes: { hp: { value, max, dt: DT_BY_BRACKET[bracket] ?? 0 } }, traits },
    items, prototypeToken: token, flags: { [F]: { rig, factionId: identity.factionOwnerId || null } } });
}

const list = () => game.actors.filter(isRig);
const ownerOf = (actor) => (isRig(actor) ? (data(actor).identity.factionOwnerId || actor.flags?.[F]?.factionId || "") : "");
const listByFaction = (factionId) => { const id = String(factionId ?? "").replace(/^Actor\./, ""); return list().filter(a => String(ownerOf(a)).replace(/^Actor\./, "") === id); };
const setOwner = (actor, factionId) => update(actor, { "identity.factionOwnerId": factionId ? String(factionId).replace(/^Actor\./, "") : "" });
const health = (actor) => game.bbttcc?.combat?.getHealth?.(actor) ?? (() => { const d = data(actor); return d ? { value: d.integrity.value, max: d.integrity.max } : { value: null, max: null }; })();

/* ── gear ─────────────────────────────────────────────────────────────────── */
const gearOf = (item) => item?.flags?.fourththing?.rigGear ?? item?.flags?.bbttcc?.rigGear ?? item?.flags?.[F]?.rigGear ?? null;
const isFrame = (item) => !!(item?.flags?.fourththing?.rigFrame || gearOf(item)?.subtype === "rig-frame");
const frameOf = (actor) => actor?.items?.find?.(isFrame) ?? null;

/* ── boarding ─────────────────────────────────────────────────────────────── */
const impl = {};   // the per-system runtime registers { board, disembark, park, deploy, destroy, outputFor, applyTurnOutput }
function boardedRigOf(steward) {
  const f = isRFI() ? steward?.flags?.fourththing?.boardedRig : steward?.flags?.[F]?.boardedRig;
  if (!f) return null;
  return typeof f === "string" ? { rigId: f } : { rigId: f.rigId ?? f.id ?? null, tokenId: f.tokenId ?? null, sceneId: f.sceneId ?? null };
}
async function board(steward, rig, opts = {}) {
  if (isRFI() && typeof game.fourththing?.rig?.board === "function") return game.fourththing.rig.board(steward, rig, opts);
  if (typeof impl.board === "function") return impl.board(steward, rig, opts);
  ui.notifications?.warn?.("Boarding isn't available on this system yet."); return false;
}
async function disembark(steward, opts = {}) {
  if (isRFI() && typeof game.fourththing?.rig?.disembark === "function") return game.fourththing.rig.disembark(steward, opts);
  if (typeof impl.disembark === "function") return impl.disembark(steward, opts);
  ui.notifications?.warn?.("Disembarking isn't available on this system yet."); return false;
}
const via = (name) => async (...args) => (typeof impl[name] === "function" ? impl[name](...args) : (ui.notifications?.warn?.(`${name} isn't available on this system yet.`), false));

Hooks.once("init", () => {
  game.bbttcc = game.bbttcc || {};
  game.bbttcc.rigs = {
    isRig, data, update, toUpdate, create, list, listByFaction, ownerOf, setOwner, health,
    gearOf, isFrame, frameOf, boardedRigOf, board, disembark, impl,
    park: via("park"), deploy: via("deploy"), destroy: via("destroy"), restore: via("restore"), outputFor: via("outputFor"), applyTurnOutput: via("applyTurnOutput"),
    DT_BY_BRACKET, HP_BY_BRACKET, FLAG_SCOPE: F
  };
  console.log(TAG, `installed game.bbttcc.rigs (${isRFI() ? "fourththing rig actors" : "dnd5e vehicles + flags." + F + ".rig"})`);
});

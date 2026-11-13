// rigs-5e · tools/stations.macro.js  (Dave 2026-11-13: "the boarding engine should have the players select a specific
// station, which then sets that power as their fire weapon ability. Or if they're engineers, the healing/repair abilities.")
// 1) WORLDBREAKER: tag its 12 "Station NN" items with their crew role (flags.rigs-5e.station.role) and give the six
//    [SYSTEM] stations real powers, authored from their own descriptions (Command Spire trample, Aegis Raise Shields +
//    Interpose, Reactor Overcharge + vent, Sensor Paint Target, Nanite Field Repair, Countermeasures Evasive Aura +
//    Smokescreen). Weapon stations keep Dave's numbers.
// 2) LEGANSUS TAL: tag each part's station weapon with that part's role + key (the combiner seats each pilot at it);
//    FINAL CONVERGENCE stays shared (untagged).
// Idempotent. DRY_RUN = true only reports.
const DRY_RUN = true;
const SCOPE = "rigs-5e";
const rid = () => foundry.utils.randomID(16);
const ROUND = { value: 1, units: "rounds", expiry: "turnStart" };
const report = [];
const AE = (name, img, changes = [], statuses = [], duration = ROUND) => ({ name, img, transfer: false, statuses, duration: duration ?? {},
  system: { changes: changes.map(([key, type, value]) => ({ key, type, value: String(value), phase: "initial", priority: 20 })) } });
const DR10 = Object.keys(CONFIG.DND5E.damageTypes ?? {}).map(t => [`system.traits.dm.amount.${t}`, "add", -10]);

// role per WORLDBREAKER station number; system-station powers: [activity, effect|null]
const WB_ROLE = { "01": "pilot", "02": "gunner", "03": "gunner", "04": "gunner", "05": "gunner", "06": "crew", "07": "engineer", "08": "crew", "09": "engineer", "10": "gunner", "11": "crew", "12": "gunner" };
const util = (name, act, extra = {}) => ({ _id: rid(), type: "utility", name, activation: { type: act, value: 1 }, range: { units: "self" }, target: { affects: { type: "self" } }, ...extra });
const WB_POWERS = {
  "01": [
    [{ _id: rid(), type: "save", name: "Trample", activation: { type: "action", value: 1 }, save: { ability: ["dex"], dc: { calculation: "", formula: "22" } },
       damage: { onSave: "half", parts: [{ number: 10, denomination: 10, types: ["bludgeoning"] }] }, range: { value: "60", units: "ft" }, target: { affects: { type: "creature", count: "1" } } },
     AE("Trampled — Prone", "systems/dnd5e/icons/svg/statuses/prone.svg", [], ["prone"], null)],
    [util("Order the Charge", "bonus"), null] ],
  "06": [
    [util("Raise Shields", "action"), AE("Shields Raised", "icons/magic/defensive/shield-barrier-glowing-blue.webp", [["system.attributes.ac.flat", "add", 4], ...DR10])],
    [{ _id: rid(), type: "utility", name: "Interpose", activation: { type: "reaction", value: 1 }, range: { value: "30", units: "ft" }, target: { affects: { type: "ally", count: "1" } } },
     AE("Interposed (+5 AC)", "icons/magic/defensive/shield-barrier-deflect-teal.webp", [["system.attributes.ac.bonus", "add", 5]])] ],
  "07": [
    [util("Overcharge", "bonus"), AE("Overcharged", "icons/magic/lightning/orb-ball-spiral-blue.webp", [["flags.dnd5e-table-kit.advantage.attack", "override", "all"]], [], null)],
    [{ _id: rid(), type: "damage", name: "Reactor Vent", activation: { type: "special", value: null }, damage: { parts: [{ number: 6, denomination: 6, types: ["fire"] }] },
       range: { units: "self" }, target: { template: { count: "1", type: "radius", size: "15", units: "ft" }, affects: { type: "creature" } } }, null] ],
  "08": [
    [{ _id: rid(), type: "utility", name: "Paint Target", activation: { type: "action", value: 1 }, range: { value: "1500", units: "ft" }, target: { affects: { type: "creature", count: "1" } } },
     AE("Painted (attacks have advantage)", "icons/skills/targeting/crosshair-pointed-orange.webp", [["flags.dnd5e-table-kit.grants.advantage.attack", "override", "all"]])] ],
  "09": [
    [{ _id: rid(), type: "heal", name: "Field Repair", activation: { type: "action", value: 1 }, healing: { number: 6, denomination: 10, bonus: "20", types: ["healing"] },
       range: { units: "self" }, target: { affects: { type: "self" } } }, null],
    [util("Purge Systems", "action"), null] ],
  "11": [
    [util("Evasive Aura", "bonus"), AE("Evasive Aura", "icons/magic/air/wind-vortex-swirl-blue.webp", [["flags.dnd5e-table-kit.grants.disadvantage.attack", "override", "all"]], [], null)],
    [util("Smokescreen", "action", { target: { template: { count: "1", type: "radius", size: "40", units: "ft" }, affects: { type: "space" } } }), null] ],
};

async function tag(item, station) {
  const cur = item.flags?.[SCOPE]?.station;
  if (cur && cur.role === station.role && (cur.part ?? null) === (station.part ?? null)) return;
  report.push(`tag ${item.parent.name} › ${item.name} → ${station.role}${station.part ? ` (${station.part})` : ""}`);
  if (!DRY_RUN) await item.update({ [`flags.${SCOPE}.station`]: station });
}
async function addPowers(item, powers) {
  if ((item.system.activities?.size ?? 0) > 0) return;
  report.push(`powers ${item.name}: ${powers.map(([a]) => a.name).join(", ")}`);
  if (DRY_RUN) return;
  await item.update({ "system.activities": Object.fromEntries(powers.map(([a]) => [a._id, a])) });
  for (const [a, eff] of powers) {
    if (!eff) continue;
    const [e] = await item.createEmbeddedDocuments("ActiveEffect", [eff]);
    await item.update({ [`system.activities.${a._id}.effects`]: [{ _id: e.id }] });
  }
}

const wb = game.actors.find(a => a.type === "vehicle" && a.name === "WORLDBREAKER");
if (wb) for (const it of wb.items) {
  const m = it.name.match(/^Station (\d\d)/); if (!m) continue;
  await tag(it, { role: WB_ROLE[m[1]] ?? "crew" });
  if (WB_POWERS[m[1]]) await addPowers(it, WB_POWERS[m[1]]);
} else report.push("! no WORLDBREAKER");

const titan = game.actors.find(a => a.name === "LEGANSUS TAL" && a.folder?.name === "Legansus Tal");
const PART_ITEM = { core: "Sunheart Lance", crown: "Prismatic Eye", rarm: "Starsplitter Blade", larm: "Thunderhead Gauntlet", pauldron: "Storm Lattice", reactor: "Soulfire Reactor", rleg: "Quake Stride", lleg: "Dragonfire Spur", wings: "Chorus Wings" };
if (titan) {
  const parts = titan.flags?.[SCOPE]?.combiner?.parts ?? [];
  for (const p of parts) { const it = titan.items.getName(PART_ITEM[p.key]); if (it) await tag(it, { role: p.role, part: p.key }); }
} else report.push("! no LEGANSUS TAL");
console.log("[stations]", report);
ui.notifications.info(`${DRY_RUN ? "DRY RUN — " : ""}${report.length} steps — see console`);
return report;

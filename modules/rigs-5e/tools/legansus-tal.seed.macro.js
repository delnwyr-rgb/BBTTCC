// rigs-5e · tools/legansus-tal.seed.macro.js  (Dave 2026-11-13)
// Builds LEGANSUS TAL — the universe-ending combining titan — and its nine component vehicles, one per
// Stonesparks OG hero, in the Third Kaeron War. Original designs (a combining-robot homage, no borrowed names/looks).
// Each vehicle: a mecha rig with a single-pilot Vanguard Frame, its own signature weapon, hull 300 / AC 24 / DT 15.
// The titan: mecha T5 rig, Legansus Tal Chassis, hull 3000 / AC 36 / DT 40, walk + fly 90, one station weapon per
// part + FINAL CONVERGENCE (all nine joined, 1/long rest). Combiner flags link them (scripts/combiner.js).
// Idempotent (skips actors that already exist in the "Legansus Tal" folder). DRY_RUN = true only reports.
const DRY_RUN = true;
const R = game.bbttcc?.rigs;
if (!R?.impl?.ensure || !game.rigs5e?.combiner) return ui.notifications.error("rigs-5e (with combiner) is not loaded.");
const FOLDER = "Legansus Tal";
const MECH = "art/Coraliindra/kaarn_battle_mech.png", TITAN_ART = "art/Coraliindra/legansus_tal.png";
const rid = () => foundry.utils.randomID(16);
const pc = (name) => game.actors.find(a => a.name === name && a.folder?.name === "Stonesparks OG");

// dnd5e 6 activity builders
const atk = (name, kind, bonus, n, d, b, type, range = 0) => ({ _id: rid(), type: "attack", name, activation: { type: "action", value: 1 },
  attack: { ability: "", bonus: String(bonus), flat: true, type: { value: kind, classification: "weapon" } },
  damage: { includeBase: false, parts: [{ number: n, denomination: d, bonus: String(b), types: [type] }] },
  range: kind === "ranged" ? { value: String(range || 600), units: "ft" } : { value: "", units: "ft", reach: 15 } });
const save = (name, ab, dc, parts, tpl, onSave = "half") => ({ _id: rid(), type: "save", name, activation: { type: "action", value: 1 },
  save: { ability: [ab], dc: { calculation: "", formula: String(dc) } }, damage: { onSave, parts: parts.map(([n, d, b, t]) => ({ number: n, denomination: d, bonus: String(b ?? ""), types: [t] })) },
  target: { template: { count: "1", contiguous: false, type: tpl[0], size: String(tpl[1]), width: tpl[2] ? String(tpl[2]) : "", units: "ft" }, affects: { type: "creature" } }, range: { units: "self" } });
const heal = (name, n, d, b, radius) => ({ _id: rid(), type: "heal", name, activation: { type: "action", value: 1 },
  healing: { number: n, denomination: d, bonus: String(b), types: ["temphp"] },
  target: { template: { count: "1", type: "radius", size: String(radius), units: "ft" }, affects: { type: "ally", choice: false } }, range: { units: "self" } });
const feat = (name, img, desc, acts, extra = {}) => ({ name, type: "feat", img,
  system: { description: { value: `<p>${desc}</p>` }, type: { value: "vehicle" }, activities: Object.fromEntries(acts.map(a => [a._id, a])), ...extra } });

// The nine — key, vehicle, hero, part, titan seat, tint, vehicle weapon, titan station weapon
const PARTS = [
  { key: "core", vehicle: "Sunheart Bastion", hero: "Escanor", part: "Core", role: "pilot", tint: "#ffd36a",
    v: feat("Dawnward Lance", "icons/magic/light/beam-rays-yellow.webp", "A spear of morning light from the Bastion's prow.", [save("Dawnward Lance", "dex", 22, [[10, 10, 10, "radiant"]], ["line", 120, 10])]),
    t: feat("Sunheart Lance", "icons/magic/light/beam-rays-yellow-blue.webp", "The titan's heart opens and the sun comes out of it — a 300-ft line of radiant ruin.", [save("Sunheart Lance", "dex", 26, [[20, 10, 30, "radiant"]], ["line", 300, 10])]) },
  { key: "crown", vehicle: "Arcanum Crown", hero: "Belikose, The", part: "Head", role: "pilot", tint: "#b07bff",
    v: feat("Evocation Prism", "icons/magic/symbols/question-stone-yellow.webp", "Refracts the pilot's will into a lance of force.", [atk("Evocation Prism", "ranged", 15, 6, 10, 12, "force", 300)]),
    t: feat("Prismatic Eye", "icons/magic/perception/eye-ringed-glow-angry-red.webp", "The Crown's eye splits light into every color of unmaking.", [atk("Prismatic Eye", "ranged", 20, 12, 10, 25, "force", 600)]) },
  { key: "rarm", vehicle: "Gallant Arm", hero: "Alwin F", part: "Right Arm", role: "gunner", tint: "#e8e8ff",
    v: feat("Duelist's Edge", "icons/weapons/swords/sword-guard-blue.webp", "The Gallant Arm fences like its pilot — precise, relentless.", [atk("Duelist's Edge", "melee", 15, 6, 12, 12, "slashing")]),
    t: feat("Starsplitter Blade", "icons/weapons/swords/greatsword-blue.webp", "A blade long enough to cut a constellation in half.", [atk("Starsplitter Blade", "melee", 20, 14, 12, 30, "slashing")]) },
  { key: "larm", vehicle: "Tempest Fist", hero: "Thalora Stormrider '24", part: "Left Arm", role: "gunner", tint: "#6ab0ff",
    v: feat("Squall Knuckles", "icons/magic/lightning/fist-unarmed-strike-blue.webp", "Storm-wrapped knuckles the size of a wagon.", [atk("Squall Knuckles", "melee", 15, 6, 10, 12, "thunder")]),
    t: feat("Thunderhead Gauntlet", "icons/magic/lightning/fist-unarmed-strike-blue-green.webp", "The left fist lands like a falling sky — thunder, and the ground buckles.", [atk("Thunderhead Gauntlet", "melee", 20, 12, 10, 25, "thunder"), save("Thunderclap Shockwave", "str", 26, [], ["radius", 20], "none")]), prone: true },
  { key: "pauldron", vehicle: "Stormcaller Pauldron", hero: "Darth Babs", part: "Shoulder Cannon", role: "gunner", tint: "#7bffea",
    v: feat("Arc Coil", "icons/magic/lightning/bolt-strike-blue.webp", "Lightning that remembers where it was aimed.", [save("Arc Coil", "dex", 22, [[8, 8, 10, "lightning"]], ["radius", 15])]),
    t: feat("Storm Lattice", "icons/magic/lightning/bolts-salvo-clouds-sky.webp", "The pauldron unfolds into a net of lightning across a whole battlefield.", [save("Storm Lattice", "dex", 26, [[18, 8, 20, "lightning"]], ["radius", 40])]) },
  { key: "reactor", vehicle: "Grave Engine", hero: "Melwys the Dead '24", part: "Reactor", role: "gunner", tint: "#7a3a9a",
    v: feat("Ghoulfire Vent", "icons/magic/unholy/beam-ringed-impact-purple.webp", "The Engine exhales what it burned to run.", [save("Ghoulfire Vent", "con", 22, [[8, 10, 10, "necrotic"]], ["cone", 30])]),
    t: feat("Soulfire Reactor", "icons/magic/unholy/orb-glowing-purple.webp", "The reactor's cold fire floods a 60-ft cone — the dead fuel the titan.", [save("Soulfire Reactor", "con", 26, [[16, 10, 20, "necrotic"]], ["cone", 60])]) },
  { key: "rleg", vehicle: "Juggernaut Strider", hero: "L0-N4N", part: "Right Leg", role: "engineer", tint: "#ff8a3a",
    v: feat("Ramguard", "icons/skills/melee/strike-hammer-destructive-orange.webp", "The Strider doesn't stop. Things in front of it do.", [atk("Ramguard", "melee", 15, 6, 10, 12, "bludgeoning")]),
    t: feat("Quake Stride", "icons/magic/earth/barrier-stone-explosion-debris.webp", "One step and the earth ripples outward — everything nearby goes down.", [save("Quake Stride", "dex", 26, [[12, 10, 20, "bludgeoning"]], ["radius", 30])]), prone: true },
  { key: "lleg", vehicle: "Wyrmshadow Strider", hero: "Keel Kindlebreath '24", part: "Left Leg", role: "engineer", tint: "#3aa86a",
    v: feat("Shadow Spur", "icons/magic/fire/blast-jet-stream-splash.webp", "Dragonfire from a heel that was never quite where you looked.", [atk("Shadow Spur", "melee", 15, 6, 8, 12, "fire")]),
    t: feat("Dragonfire Spur", "icons/magic/fire/flame-burning-creature-skeleton.webp", "The left heel kicks a jet of dragonfire that knows the target's blind side.", [atk("Dragonfire Spur", "melee", 20, 12, 8, 25, "fire")]) },
  { key: "wings", vehicle: "Aria Wings", hero: "Tillandriel Mirabeth Nayirella Te'Lassian", part: "Wings", role: "crew", tint: "#ff8ad6", fly: true,
    v: feat("Encore", "icons/magic/sonic/projectile-sound-rings-wave.webp", "The Wings sing allies back onto their feet.", [heal("Encore", 3, 10, 10, 30)]),
    t: feat("Chorus Wings", "icons/magic/sonic/bell-alarm-red-purple.webp", "The wings open and the whole field hears the chorus — allies within 60 ft gain temporary hit points.", [heal("Chorus Wings", 6, 10, 20, 60)]) },
];
const FINAL = feat("FINAL CONVERGENCE", "icons/magic/light/explosion-star-large-teal-purple.webp",
  "<b>All nine as one.</b> Only when every part is joined (the combiner refuses it otherwise). Once per long rest. The nine pilots pour everything through the titan in one strike that ends the argument.",
  [{ _id: rid(), type: "damage", name: "Final Convergence", activation: { type: "action", value: 1 }, consumption: { targets: [{ type: "itemUses", value: "1" }] },
     damage: { parts: [{ number: 30, denomination: 12, bonus: "60", types: ["radiant"] }, { number: 20, denomination: 10, bonus: "", types: ["force"] }] }, range: { value: "1000", units: "ft" } }],
  { uses: { max: "1", spent: 0, recovery: [{ period: "lr", type: "recoverAll" }] } });
FINAL.flags = { "rigs-5e": { requiresComplete: true } };

const frame = (name, img, rf) => ({ name, type: "loot", img, system: { description: { value: `<p>${name}.</p>` } }, flags: { fourththing: { rigFrame: rf } } });
const VANGUARD = { bracket: "mecha", pilotMount: true, baseIntegrity: 300, tierStep: 0, mobilityAllowed: ["mobile"], slots: { weapon: 1, system: 1, output: 0 },
  capacity: { pilot: { min: 1, max: 1 }, gunner: { min: 0, max: 0 }, engineer: { min: 0, max: 0 }, crew: { min: 0, max: 1 } },
  actions: { pilot: ["steer", "evasive", "stomp", "fire-weapon", "vent-heat"], gunner: [], engineer: [], crew: ["brace", "hold-on"] }, travel: { speed: 5, range: 12 } };
const TITAN_FRAME = { bracket: "mecha", baseIntegrity: 3000, tierStep: 0, mobilityAllowed: ["mobile"], slots: { weapon: 9, system: 4, output: 0 },
  capacity: { pilot: { min: 1, max: 2 }, gunner: { min: 0, max: 4 }, engineer: { min: 0, max: 2 }, crew: { min: 0, max: 12 } },
  actions: { pilot: ["steer", "stomp", "evasive", "vent-heat"], gunner: ["fire-weapon", "aimed-shot"], engineer: ["repair", "vent-heat"], crew: ["operate-module", "brace", "signal", "hold-on"] }, travel: { speed: 6, range: 20 } };

const report = [];
let folder = game.folders.find(f => f.type === "Actor" && f.name === FOLDER);
if (!folder && !DRY_RUN) folder = await Folder.create({ name: FOLDER, type: "Actor", color: "#3a5bbf" });
const existing = (n) => game.actors.find(a => a.name === n && a.folder?.id === folder?.id);

async function makeRig({ name, img, w, tint, hull, ac, dt, walk, fly, items, frameItem, owners, extraFlags }) {
  let a = existing(name);
  if (a) { report.push(`= ${name} (exists)`); return a; }
  report.push(`+ ${name}`);
  if (DRY_RUN) return null;
  const ownership = { default: 0 }; for (const u of owners ?? []) ownership[u] = 3;
  a = await Actor.create({ name, type: "vehicle", img, folder: folder.id, ownership,
    system: { attributes: { hp: { value: hull, max: hull, dt }, ac: { calc: "flat", flat: ac } }, traits: { size: w >= 8 ? "grg" : "huge" } },
    prototypeToken: { name, actorLink: true, width: w, height: w, texture: { src: img, ...(tint ? { tint } : {}) }, disposition: 1 },
    flags: extraFlags ?? {} });
  await R.impl.ensure(a, { identity: { mobility: "mobile", state: "parked", archetype: name.toLowerCase() }, integrity: { bracket: "mecha", tier: 5, authored: true } });
  await R.update(a, { "integrity.authored": true });
  await a.createEmbeddedDocuments("Item", [frameItem, ...items]);
  await new Promise(r => setTimeout(r, 600));
  const fr = a.items.find(i => i.flags?.fourththing?.rigFrame);
  if (fr && !R.data(a)?.frame?.itemId) await R.impl.applyFrame(a, fr);
  await a.update({ "system.attributes.hp.max": hull, "system.attributes.hp.value": hull, "system.attributes.hp.dt": dt,
    "system.attributes.ac.calc": "flat", "system.attributes.ac.flat": ac,
    "system.attributes.movement.speeds.walk": String(walk), ...(fly ? { "system.attributes.movement.speeds.fly": String(fly) } : {}) });
  return a;
}
async function addProne(actor, itemName) {
  const it = actor?.items.getName(itemName); if (!it || it.effects.size) return;
  const [e] = await it.createEmbeddedDocuments("ActiveEffect", [{ name: "Knocked Prone", img: "systems/dnd5e/icons/svg/statuses/prone.svg", statuses: ["prone"], transfer: false }]);
  const act = it.system.activities.contents.find(x => x.type === "save") ?? it.system.activities.contents[0];
  await it.update({ [`system.activities.${act.id}.effects`]: [...act.effects.map(x => ({ _id: x._id })), { _id: e.id }] });
}

// 1) the titan
const titan = await makeRig({ name: "LEGANSUS TAL", img: TITAN_ART, w: 10, hull: 3000, ac: 36, dt: 40, walk: 90, fly: 90,
  frameItem: frame("Legansus Tal Chassis", TITAN_ART, TITAN_FRAME), items: [...PARTS.map(p => p.t), FINAL], owners: [] });
if (titan) for (const p of PARTS.filter(p => p.prone)) await addProne(titan, p.t.name);
// 2) the nine vehicles
const made = [];
for (const p of PARTS) {
  const hero = pc(p.hero);
  const owners = hero ? Object.entries(hero.ownership).filter(([u, l]) => l === 3 && u !== "default" && !game.users.get(u)?.isGM).map(([u]) => u) : [];
  if (!hero) report.push(`! hero not found in Stonesparks OG: ${p.hero}`);
  const v = await makeRig({ name: p.vehicle, img: MECH, w: 3, tint: p.tint, hull: 300, ac: 24, dt: 15, walk: 60, fly: p.fly || p.key === "crown" ? 60 : 0,
    frameItem: frame("Vanguard Frame", MECH, VANGUARD), items: [p.v], owners });
  if (v && p.prone) await addProne(v, p.v.name);
  made.push({ p, v });
}
// 3) link them
if (!DRY_RUN && titan) {
  const parts = made.filter(m => m.v).map(({ p, v }) => ({ key: p.key, label: `${p.vehicle} (${p.part})`, rigId: v.id, role: p.role }));
  if (!titan.flags?.["rigs-5e"]?.combiner?.formed) await titan.update({ "flags.rigs-5e.combiner": { name: "LEGANSUS TAL", parts, formed: false, joined: [] } });
  for (const { p, v } of made) if (v) await v.update({ "flags.rigs-5e.combinerPart": { titanId: titan.id, key: p.key } });
  report.push(`linked ${parts.length} parts → LEGANSUS TAL`);
}
console.log("[legansus-tal.seed]", report);
ui.notifications.info(`${DRY_RUN ? "DRY RUN — " : ""}${report.length} steps — see console`);
return report;

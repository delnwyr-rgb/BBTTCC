// rigs-5e · tools/legansus-tal.kit.macro.js  (Dave 2026-11-13: "the individual robots need attacks of their own for the
// stewards to use while piloting them")
// Each Legansus Tal vehicle gets a full kit: its signature weapon (seed tool) + an at-will BASIC attack + a bonus-action /
// reaction POWER in its hero's style. Attacks roll with the PILOT's own numbers (rigs-5e crew-roll hook swaps in their
// ability mod + proficiency) plus the vehicle's targeting bonus; damage is the vehicle's. The titan's station attacks get
// the same scheme, and every Stonesparks OG player may use the titan's stations once seated (OWNER).
// Idempotent (adds by name, re-runnable). DRY_RUN = true only reports.
const DRY_RUN = true;
const VEH_BONUS = "3", TITAN_BONUS = "8";            // targeting bonus on top of the pilot's own mod + prof
const R = game.bbttcc?.rigs;
if (!R?.isRig) return ui.notifications.error("rigs-5e is not loaded.");
const rid = () => foundry.utils.randomID(16);
const ROUND = { value: 1, units: "rounds", expiry: "turnStart" };

const atk = (name, kind, n, d, b, type, range = 0) => ({ _id: rid(), type: "attack", name, activation: { type: "action", value: 1 },
  attack: { ability: kind === "ranged" ? "dex" : "str", bonus: VEH_BONUS, flat: false, type: { value: kind, classification: "weapon" } },
  damage: { includeBase: false, parts: [{ number: n, denomination: d, bonus: String(b), types: [type] }] },
  range: kind === "ranged" ? { value: String(range || 300), units: "ft" } : { value: "", units: "ft", reach: 10 } });
const selfUtil = (name, act) => ({ _id: rid(), type: "utility", name, activation: { type: act, value: 1 }, range: { units: "self" }, target: { affects: { type: "self" } } });
const tempHp = (name, act, n, d, b) => ({ _id: rid(), type: "heal", name, activation: { type: act, value: 1 }, healing: { number: n, denomination: d, bonus: String(b), types: ["temphp"] }, range: { units: "self" }, target: { affects: { type: "self" } } });
const saveT = (name, act, ab, dc, parts, { radius = 0, range = 60 } = {}) => ({ _id: rid(), type: "save", name, activation: { type: act, value: 1 },
  save: { ability: [ab], dc: { calculation: "", formula: String(dc) } }, damage: { onSave: "half", parts: parts.map(([n, dd, b, t]) => ({ number: n, denomination: dd, bonus: String(b ?? ""), types: [t] })) },
  ...(radius ? { target: { template: { count: "1", type: "radius", size: String(radius), units: "ft" }, affects: { type: "creature" } }, range: { units: "self" } }
            : { target: { affects: { type: "creature", count: "1" } }, range: { value: String(range), units: "ft" } }) });
const feat = (name, img, desc, act) => ({ name, type: "feat", img, system: { description: { value: `<p>${desc}</p>` }, type: { value: "vehicle" }, activities: { [act._id]: act } } });
const AE = (name, img, changes = [], statuses = []) => ({ name, img, transfer: false, statuses, duration: ROUND,
  system: { changes: changes.map(([key, type, value]) => ({ key, type, value: String(value), phase: "initial", priority: 20 })) } });
const ACp5 = [["system.attributes.ac.flat", "add", 5]];
const ADV = [["flags.dnd5e-table-kit.advantage.attack", "override", "all"]];

const KIT = {
  "Sunheart Bastion": [
    feat("Bastion Maul", "icons/weapons/hammers/hammer-war-spiked-simple.webp", "The Bastion's sun-bright maul. At will.", atk("Bastion Maul", "melee", 4, 10, 10, "radiant")),
    [feat("Aegis Flare", "icons/magic/defensive/shield-barrier-glowing-triangle-blue.webp", "Reaction — a flare of holy light hardens the hull: +5 AC until your next turn.", selfUtil("Aegis Flare", "reaction")), AE("Aegis Flare", "icons/magic/defensive/shield-barrier-glowing-triangle-blue.webp", ACp5)] ],
  "Arcanum Crown": [
    feat("Arc Bolts", "icons/magic/lightning/orb-ball-purple.webp", "Three motes of force that never miss their caster's intent. At will, 300 ft.", atk("Arc Bolts", "ranged", 4, 8, 10, "force", 300)),
    feat("Spellward Halo", "icons/magic/defensive/shield-barrier-flaming-diamond-purple.webp", "Reaction — the Crown's wards drink the blow: temporary hit points.", tempHp("Spellward Halo", "reaction", 4, 10, 10)) ],
  "Gallant Arm": [
    feat("Riposte Saber", "icons/weapons/swords/sword-guard-steel-green.webp", "A duelist's blade the size of a lamppost. At will.", atk("Riposte Saber", "melee", 4, 10, 10, "slashing")),
    [feat("Superiority Surge", "icons/skills/melee/maneuver-sword-katana-yellow.webp", "Bonus action — read the opening: advantage on the Arm's attacks until your next turn.", selfUtil("Superiority Surge", "bonus")), AE("Superiority Surge", "icons/skills/melee/maneuver-sword-katana-yellow.webp", ADV)] ],
  "Tempest Fist": [
    feat("Gale Jab", "icons/magic/air/fog-gas-smoke-swirling-gray.webp", "A jab that lands with a thunderclap. At will.", atk("Gale Jab", "melee", 4, 8, 10, "thunder")),
    feat("Storm Aura", "icons/magic/lightning/bolt-forked-large-blue.webp", "Bonus action — the Fist crackles: everything within 30 ft makes a DEX save or takes lightning.", saveT("Storm Aura", "bonus", "dex", 21, [[4, 6, 6, "lightning"]], { radius: 30 })) ],
  "Stormcaller Pauldron": [
    feat("Static Cannon", "icons/magic/lightning/bolt-strike-blue-white.webp", "A shoulder-mounted bolt thrower. At will, 300 ft.", atk("Static Cannon", "ranged", 4, 8, 10, "lightning", 300)),
    [feat("Force Tether", "icons/magic/control/debuff-chains-shackle-movement-red.webp", "Bonus action — an unseen grip: STR save or restrained until your next turn.", saveT("Force Tether", "bonus", "str", 21, [], { range: 60 })), AE("Force Tether", "icons/magic/control/debuff-chains-shackle-movement-red.webp", [], ["restrained"])] ],
  "Grave Engine": [
    feat("Hex Claw", "icons/magic/unholy/hand-claw-glow-orange.webp", "The Engine's clawed manipulator, cold with grave-light. At will.", atk("Hex Claw", "melee", 4, 10, 10, "necrotic")),
    feat("Undying Coil", "icons/magic/unholy/strike-body-life-soul-purple.webp", "Bonus action — the reactor feeds on what it killed: temporary hit points.", tempHp("Undying Coil", "bonus", 3, 10, 10)) ],
  "Juggernaut Strider": [
    feat("Piston Kick", "icons/skills/melee/unarmed-punch-fist.webp", "A hydraulic kick that dents siege walls. At will.", atk("Piston Kick", "melee", 4, 10, 10, "bludgeoning")),
    [feat("Unstoppable", "icons/magic/defensive/armor-shield-barrier-steel.webp", "Bonus action — lock the frame: +5 AC until your next turn.", selfUtil("Unstoppable", "bonus")), AE("Unstoppable", "icons/magic/defensive/armor-shield-barrier-steel.webp", ACp5)] ],
  "Wyrmshadow Strider": [
    feat("Ghost Talon", "icons/creatures/claws/claw-talons-glowing-orange.webp", "A talon that strikes from the shadow it casts. At will.", atk("Ghost Talon", "melee", 4, 8, 10, "piercing")),
    [feat("Shadowstep Burn", "icons/magic/movement/trail-streak-impact-blue.webp", "Bonus action — the Strider steps through its own shadow (teleport up to 60 ft) and strikes from the dark: advantage until your next turn.", selfUtil("Shadowstep Burn", "bonus")), AE("Shadowstep Burn", "icons/magic/movement/trail-streak-impact-blue.webp", ADV)] ],
  "Aria Wings": [
    feat("Lancet Note", "icons/magic/sonic/projectile-sound-rings-wave.webp", "A single note sharpened to a point. At will, 300 ft.", atk("Lancet Note", "ranged", 4, 8, 10, "psychic", 300)),
    [feat("Dazzling Chord", "icons/magic/light/explosion-star-glow-silhouette.webp", "Bonus action — a chord too bright to look at: WIS save or the target has disadvantage on attacks until your next turn.", saveT("Dazzling Chord", "bonus", "wis", 21, [], { range: 60 })), AE("Dazzled", "icons/magic/light/explosion-star-glow-silhouette.webp", [["flags.dnd5e-table-kit.disadvantage.attack", "override", "all"]])] ],
};

const report = [];
async function addWithEffect(rig, item, effect) {
  if (rig.items.getName(item.name)) { report.push(`= ${rig.name}: ${item.name}`); return; }
  report.push(`+ ${rig.name}: ${item.name}${effect ? ` (+ ${effect.name})` : ""}`);
  if (DRY_RUN) return;
  const [it] = await rig.createEmbeddedDocuments("Item", [item]);
  if (!effect) return;
  const [e] = await it.createEmbeddedDocuments("ActiveEffect", [effect]);
  const act = it.system.activities.contents[0];
  await it.update({ [`system.activities.${act.id}.effects`]: [{ _id: e.id }] });
}
async function rebaseAttacks(rig, bonus) {
  for (const it of rig.items) for (const act of (it.system.activities?.contents ?? [])) {
    if (act.type !== "attack" || act.attack?.flat === false) continue;
    report.push(`~ ${rig.name}: ${it.name} → pilot's numbers + ${bonus}`);
    if (!DRY_RUN) await it.update({ [`system.activities.${act.id}.attack.flat`]: false, [`system.activities.${act.id}.attack.bonus`]: bonus,
      [`system.activities.${act.id}.attack.ability`]: act.attack?.type?.value === "ranged" ? "dex" : "str" });
  }
}
for (const [name, kit] of Object.entries(KIT)) {
  const rig = game.actors.find(a => a.name === name && a.folder?.name === "Legansus Tal");
  if (!rig) { report.push(`! missing ${name}`); continue; }
  for (const k of kit) Array.isArray(k) ? await addWithEffect(rig, k[0], k[1]) : await addWithEffect(rig, k, null);
  await rebaseAttacks(rig, VEH_BONUS);
}
const titan = game.actors.find(a => a.name === "LEGANSUS TAL" && a.folder?.name === "Legansus Tal");
if (titan) {
  await rebaseAttacks(titan, TITAN_BONUS);
  const heroesFolder = game.folders.find(f => f.type === "Actor" && f.name === "Stonesparks OG");
  const users = new Set((heroesFolder?.contents ?? []).filter(a => a.type === "character").flatMap(a => Object.entries(a.ownership).filter(([u, l]) => l === 3 && u !== "default" && !game.users.get(u)?.isGM).map(([u]) => u)));
  const own = { ...titan.ownership }; let n = 0; for (const u of users) if (own[u] !== 3) { own[u] = 3; n++; }
  report.push(`titan: ${n} player(s) given its stations`);
  if (!DRY_RUN && n) await titan.update({ ownership: own });
}
console.log("[legansus-tal.kit]", report);
ui.notifications.info(`${DRY_RUN ? "DRY RUN — " : ""}${report.length} steps — see console`);
return report;

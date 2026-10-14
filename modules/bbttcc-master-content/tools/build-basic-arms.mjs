#!/usr/bin/env node
/* build-basic-arms.mjs — BASIC ARMS catalog (2026-10-14, Dave: "we have no longswords, we have no basic pistols
 * or modern firearms"). Fills the T1 baseline out to a real starter catalog: 10 melee + 9 firearms/bows (one T2
 * squad gun) + 7 armor + 1 shield, all Standard Issue (no signature, no attunement) in the shape the pack already
 * uses (Slug Pistol / Combat Knife / Patrolman's Plate are the templates — read from a LIVE dump so AA blocks and
 * the Defense Grant effect shape are the ones the world actually runs).
 *
 *   node tools/build-basic-arms.mjs <items.jsonl>                 emit seed-basic-arms-2026-10-14.macro.js (DRY_RUN)
 *   node tools/build-basic-arms.mjs <items.jsonl> --dump out.jsonl  also write the records in ft-dump-pack shape (offline ft-lint-items)
 *   node tools/build-basic-arms.mjs <items.jsonl> --source          also write packs/_source/items/<Name>_<id>.json (repo canon → 5E gear lane)
 *
 * Ids are FIXED (ID_SEED table below) so the repo _source and the live pack carry the same _id (seed uses keepId).
 * Prices follow systems/fourththing/rfi-pricing.js: T1 weapon 50 violence · T2 weapon 150 · T1 armor 75 nonlethal ·
 * T1 shield 35 nonlethal · saleBack = 40%. Icons = core Foundry webp only (lint I18).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2); const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ITEMS = argv.find(a => !a.startsWith("--") && a.endsWith(".jsonl"));
if (!ITEMS) { console.error("usage: build-basic-arms.mjs <live items.jsonl> [--dump out.jsonl] [--source] [--out macro.js]"); process.exit(2); }
const STAMP = "2026-10-14";
const OUT = opt("--out", path.join(HERE, `seed-basic-arms-${STAMP}.macro.js`)), DUMP = opt("--dump"), SOURCE = argv.includes("--source");
const SRC_DIR = path.resolve(HERE, "../packs/_source/items");

const rows = fs.readFileSync(ITEMS, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
const items = rows.filter(r => r.k.startsWith("!items!")).map(r => r.v);
const effectsByItem = {};
for (const r of rows) { const m = r.k.match(/^!items\.effects!([^.]+)\.(.+)$/); if (m) (effectsByItem[m[1]] ??= []).push(r.v); }
const byName = n => { const it = items.find(i => i.name === n); if (!it) throw new Error(`items pack has no "${n}"`); return it; };
const have = new Set(items.map(i => i.name));

// ─── Folders (live ids; the seed falls back to a name lookup) ────────────────
const FOLDER = {
  t1weapons: { id: "bQhXd1gwJXtaVLGh", name: "T1 Baseline Weapons" },
  weapons:   { id: "H6eMhWQrjwcwZcBi", name: "BBTTCC Weapons" },
  t1armor:   { id: "2yW6O57xUFtROfpB", name: "T1 Baseline Armor" }
};
const GM_USER = "bytUGWIOqq9eT7Or";
const SYS_VER = items.map(i => i._stats?.systemVersion).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop() ?? "0.6.20";

// Fixed ids — repo _source == live pack. Never reuse one for a different name.
const ID_SEED = {
  "Longsword": "bA1LongSwrd0001a", "Shortsword": "bA1ShrtSwrd0002b", "Greatsword": "bA1GrtSword0003c", "Machete": "bA1Machete00004d",
  "Spear": "bA1Spear0000005e", "Slugger Bat": "bA1SlugrBat0006f", "Mace": "bA1Mace00000007g", "Quarterstaff": "bA1QrtrStaf0008h",
  "Felling Axe": "bA1FellAxe00009i", "Warhammer": "bA1WarHamr0010j0", "Auto Pistol": "bA1AutoPstl0011k", "Holdout Pistol": "bA1HoldPstl0012l",
  "Machine Pistol": "bA1MachPstl0013m", "Pump Shotgun": "bA1PumpShot0014n", "Sawed-Off Shotgun": "bA1SawdShot0015o", "Carbine": "bA1Carbine00016p",
  "Service Rifle": "bA1ServRifl0017q", "Squad Machine Gun": "bA2SquadMG00018r", "Hunting Bow": "bA1HuntBow00019s",
  "Ballistic Vest": "bA1BalstVst0020t", "Riding Leathers": "bA1RideLthr0021u", "Flak Jacket": "bA1FlakJckt0022v", "Tactical Harness": "bA1TactHrns0023w",
  "Riot Armor": "bA1RiotArmr0024x", "Scrap Plate": "bA1ScrpPlat0025y", "Scrap Helm": "bA1ScrpHelm0026z", "Riot Shield": "bA1RiotShld0027A"
};
for (const [n, id] of Object.entries(ID_SEED)) if (!/^[A-Za-z0-9]{16}$/.test(id)) throw new Error(`bad id for ${n}: ${id}`);
if (new Set(Object.values(ID_SEED)).size !== Object.keys(ID_SEED).length) throw new Error("duplicate ids in ID_SEED");

// ─── Pricing (rfi-pricing.js tables, T1/T2 only) ─────────────────────────────
const TIER_BASE = { 1: 50, 2: 150 }, FRAME_MULT = { weapon: 1.0, armor: 1.5, shield: 0.7 }, POOL = { weapon: "violence", armor: "nonlethal", shield: "nonlethal" };
const ROMAN = ["", "I", "II"];
function price(tier, frame) {
  const marks = Math.round(TIER_BASE[tier] * FRAME_MULT[frame]);
  return { marks, currency: POOL[frame], gmOverride: false, altCurrencies: {}, split: null, rarityMult: 1,
    notes: `T${ROMAN[tier]} ${frame} stamp`, bound: "free", saleBack: Math.floor(marks * 0.4) };
}

// ─── Templates from the live pack ────────────────────────────────────────────
const TPL_RANGED = byName("Slug Pistol"), TPL_MELEE = byName("Combat Knife"), TPL_ARMOR = byName("Patrolman's Plate");
const uuid = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16); });
function aaBlock(base, name, menu, video) {
  const aa = structuredClone(base.flags.autoanimations);
  aa.id = uuid(); aa.label = name; aa.menu = menu; aa.primary.video = { ...aa.primary.video, ...video };
  delete aa.meleeSwitch;   // the Combat Knife carries a thrown-range switch; none of these do
  return aa;
}
const AA_MELEE  = (name, animation, variant = "01", color = "white") => aaBlock(TPL_MELEE,  name, "melee", { dbSection: "melee", menuType: "weapon", animation, variant, color });
const AA_BULLET = (name) => aaBlock(TPL_RANGED, name, "range", { dbSection: "range", menuType: "weapon", animation: "bullet", variant: "1", color: "blue" });
const AA_ARROW  = (name) => aaBlock(TPL_RANGED, name, "range", { dbSection: "range", menuType: "weapon", animation: "arrow", variant: "regular", color: "regular" });
const TPL_EFFECT = effectsByItem[TPL_ARMOR._id]?.[0]; if (!TPL_EFFECT) throw new Error("Patrolman's Plate has no live Defense Grant effect to template");

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const fmtRange = r => r.short === 1 && r.long === 1 ? `<li><strong>Reach:</strong> Melee</li>` : `<li><strong>Range:</strong> ${r.short} / ${r.long}</li>`;
function weaponMech(w) {
  return `\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>${w.effect}</p>\n<ul>\n  <li><strong>Damage:</strong> ${w.formula} Kinetic damage to <em>Integrity</em> <span style="opacity:.75">(${w.flavorKey})</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> ${cap(w.skill)} (Violence)</li>\n  ${fmtRange(w.range)}\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T${w.tier}</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->`;
}
const WEIGHT_SKILL = { light: "fitting", medium: "bracing", heavy: "plating", shield: "bracing" };
function armorMech(a, p) {
  const def = [["Guard", a.guard], ["Evasion", a.evasion], ["Resolve", a.resolve]].filter(([, v]) => v).map(([k, v]) => `${k} ${v > 0 ? "+" : "−"}${Math.abs(v)}`).join(", ");
  return `\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> ${cap(a.weight)}</li>\n  <li><strong>Defense:</strong> ${def}</li>\n  <li><strong>Requires:</strong> ${cap(WEIGHT_SKILL[a.weight])} (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> ${p.marks} Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->`;
}

// ─── THE CATALOG ─────────────────────────────────────────────────────────────
// Standard Issue throughout: no signature, no attunement — Frame Dice, Ruin Charges and Surge do the interesting work.
const M = (o) => ({ cat: "melee", skill: "melee", range: { short: 1, long: 1 }, tier: 1, folder: "t1weapons", ...o });
const R = (o) => ({ cat: "ranged", skill: "firearms", flavorKey: "ballistic", tier: 1, folder: "t1weapons", aa: AA_BULLET, ...o });
const WEAPONS = [
  M({ name: "Longsword", formula: "1d8", flavorKey: "blade", tags: ["sword", "versatile"], img: "icons/weapons/swords/sword-guard-worn.webp", aa: n => AA_MELEE(n, "sword"),
    effect: "Versatile: one hand beside a shield, two hands when you mean it. No signature ability.", flavor: "The shape every other sword is apologizing for not being.",
    signature: "Thirty inches of settled argument.", mats: ["sheet-steel", "leather-grip"],
    lore: "<p>A straight double-edged blade with a plain cross-guard and a grip long enough for a second hand. Ground from pre-Fall leaf-spring or faction sheet-steel, depending on who made it and what they had. The weapon most hex militias train on first, because it forgives bad footwork and rewards good.</p><p><b>Standard Issue.</b> No signature, no hum, no history worth mentioning. It cuts.</p>" }),
  M({ name: "Shortsword", formula: "1d6", flavorKey: "blade", tags: ["sword", "light", "finesse"], img: "icons/weapons/swords/shortsword-guard-steel-worn.webp", aa: n => AA_MELEE(n, "sword"),
    effect: "Light, finesse-friendly. Pairs with a second weapon or a buckler. No signature ability.", flavor: "Short enough to draw in a doorway. Long enough to matter.",
    signature: "Made for rooms, not fields.", mats: ["sheet-steel", "leather-grip"],
    lore: "<p>Two feet of blade and a grip for one hand. The sidearm of people who do their fighting in corridors, stairwells and crowded markets — courier guards, dock crews, anyone who has ever had to turn around fast. Cheap to make and cheaper to replace.</p><p><b>Standard Issue.</b> Quick, close, honest.</p>" }),
  M({ name: "Greatsword", formula: "1d12", flavorKey: "blade", tags: ["sword", "two-handed", "heavy"], img: "icons/weapons/swords/greatsword-crossguard-steel.webp", aa: n => AA_MELEE(n, "greatsword"),
    effect: "Two-handed, heavy. Pairs well with Bulwark Frame. No signature ability.", flavor: "Not a sword. A decision.",
    signature: "Five feet of steel and no plan B.", mats: ["sheet-steel", "brace-iron", "leather-grip"],
    lore: "<p>A two-handed blade as tall as its wielder, hammered from a pre-Fall highway sign-post or a faction forge's best sheet. Slow to bring around, impossible to ignore. Favoured by gate-wardens and anyone whose job is to make the first person through a door regret it.</p><p><b>Standard Issue.</b> Heavy two-handed kinetic. No signature — the weight is the statement.</p>" }),
  M({ name: "Machete", formula: "1d6", flavorKey: "chop", tags: ["blade", "light", "utility"], img: "icons/weapons/swords/machete.webp", aa: n => AA_MELEE(n, "sword"),
    effect: "Light. Doubles as a trail tool — clears brush, opens crates, settles disputes. No signature ability.", flavor: "Half the time it's a tool. The other half, nobody asks.",
    signature: "Clears a path either way.", mats: ["sheet-steel", "wrapped-leather"],
    lore: "<p>A broad single-edged chopping blade with a wrapped grip. Every travelling crew in Bad Eden owns one and most own three — for the overgrowth on the old roads, the lids on the salvage crates, and the moment the parley goes wrong. Factories stamp them by the gross.</p><p><b>Standard Issue.</b> Light, cheap, always within reach.</p>" }),
  M({ name: "Spear", formula: "1d8", flavorKey: "stab", tags: ["spear", "versatile", "thrown"], img: "icons/weapons/polearms/spear-flared-worn.webp", aa: n => AA_MELEE(n, "spear"),
    effect: "Versatile. May be thrown at short range as an improvised ranged attack. No signature ability.", flavor: "Reach is a kind of armor.",
    signature: "The oldest answer to the oldest problem.", mats: ["pig-iron", "ash-haft"],
    lore: "<p>A forged leaf-shaped head on six feet of ash. The weapon of hex pickets, boat crews and anyone who would rather the fight happened a little further away. Easy to make, easy to teach, and the long haft keeps a ring of them steady where a line of knives would break.</p><p><b>Standard Issue.</b> Reach and a throw. Nothing else needed.</p>" }),
  M({ name: "Slugger Bat", formula: "1d6", flavorKey: "blunt", tags: ["club", "light", "improvised"], img: "icons/weapons/clubs/bat-nail.webp", aa: n => AA_MELEE(n, "club"),
    effect: "Light. Improvised — nobody looks twice at it until it's too late. No signature ability.", flavor: "Pre-Fall sporting goods, post-Fall diplomacy.",
    signature: "Batting a thousand.", mats: ["hickory-haft", "bronze-nail"],
    lore: "<p>A hickory baseball bat, usually with a few bronze nails driven through the barrel for emphasis. Found in the back of every bunker, the trunk of every rig and the hands of every bouncer at every drinking hole from Chuckle Creek to the Drowned South. Nobody has to be taught how to use one.</p><p><b>Standard Issue.</b> Light, blunt, cheerful.</p>" }),
  M({ name: "Mace", formula: "1d8", flavorKey: "blunt", tags: ["mace", "bludgeon"], img: "icons/weapons/maces/mace-flanged-steel-grey.webp", aa: n => AA_MELEE(n, "mace"),
    effect: "One-handed blunt. Good against plate — the armor stays put and the person inside it doesn't. No signature ability.", flavor: "Doesn't need an edge. Needs a reason.",
    signature: "A flanged opinion.", mats: ["pig-iron", "leather-grip"],
    lore: "<p>A flanged iron head on a short steel haft. Where the longsword is the militia's first lesson, the mace is the constable's — it dents, it stuns, and it doesn't stick in anything. Carried by hex constables, sept wardens and anyone whose job involves bringing people back in one piece, mostly.</p><p><b>Standard Issue.</b> Blunt, one-handed, dependable.</p>" }),
  M({ name: "Quarterstaff", formula: "1d6", flavorKey: "blunt", tags: ["staff", "two-handed", "versatile"], img: "icons/weapons/staves/staff-simple-wrapped.webp", aa: n => AA_MELEE(n, "quarterstaff"),
    effect: "Two-handed, versatile. A walking stick first; a weapon when the walk goes wrong. No signature ability.", flavor: "Leans on you as much as you lean on it.",
    signature: "Six feet of patience.", mats: ["ash-haft", "wrapped-leather"],
    lore: "<p>Six feet of seasoned ash with leather wraps at the grips and iron ferrules at the ends. The traveller's weapon — a pilgrim's stick, a boatman's pole, a teacher's pointer, and the one weapon every Initiate's order lets its novices carry through the gate. Cheap, legal everywhere, and faster than it looks.</p><p><b>Standard Issue.</b> Two-handed blunt. Nothing to confiscate.</p>" }),
  M({ name: "Felling Axe", formula: "1d10", flavorKey: "chop", tags: ["axe", "two-handed", "heavy"], img: "icons/weapons/axes/axe-double-chopping-black.webp", aa: n => AA_MELEE(n, "greataxe"),
    effect: "Two-handed, heavy. Splits timber, doors and arguments. No signature ability.", flavor: "Built for trees. Trees don't fight back.",
    signature: "Every swing is the last one, as far as the tree is concerned.", mats: ["pig-iron", "hickory-haft"],
    lore: "<p>A heavy double-bit axe on a long hickory haft, straight off the timber crews that keep the hex roads open. Nobody designed it as a weapon; nobody needed to. When the raid alarm sounds in a logging camp, this is what comes out of the shed.</p><p><b>Standard Issue.</b> Heavy two-handed chop. Honest work, either way.</p>" }),
  M({ name: "Warhammer", formula: "1d8", flavorKey: "blunt", tags: ["hammer", "versatile"], img: "icons/weapons/hammers/hammer-war-rounding.webp", aa: n => AA_MELEE(n, "warhammer"),
    effect: "Versatile. A hammer face for plate, a spike for everything else. No signature ability.", flavor: "Forge tool. Field tool. Same tool.",
    signature: "Rounds off the corners of a bad day.", mats: ["pig-iron", "ash-haft"],
    lore: "<p>A squared iron head with a hammer face on one side and a short spike on the other, mounted on an ash haft long enough for two hands. It comes off the same forge as the rivet-plate it's meant to beat in — the smiths of Bad Eden have never seen the point of making two tools where one will do.</p><p><b>Standard Issue.</b> Blunt, versatile, no questions at the forge door.</p>" }),

  R({ name: "Auto Pistol", formula: "1d8", range: { short: 20, long: 80 }, tags: ["pistol", "ballistic", "sidearm", "quick-reload"], img: "icons/weapons/guns/pistol-automatic.webp",
    effect: "Semi-automatic sidearm with a box magazine — reloads in a breath. No signature ability.", flavor: "Fourteen rounds and a slide that never asked permission.",
    signature: "Drop the magazine, slap the next one, keep talking.", mats: ["sheet-steel", "casing-brass"],
    lore: "<p>A magazine-fed semi-automatic handgun — the pre-Fall service pattern, still turned out by faction armouries from stamped sheet and salvaged barrels. Where the Slug Pistol is the glove-box gun, this is the holster gun: more rounds, faster reload, same honest kick.</p><p><b>Standard Issue.</b> No electronics, no hum. Point, pull, repeat.</p>" }),
  R({ name: "Holdout Pistol", formula: "1d6", range: { short: 10, long: 40 }, tags: ["pistol", "ballistic", "concealable"], img: "icons/weapons/guns/pistol-handgun-small.webp",
    effect: "Concealable. Fits a boot, a sleeve or a sept-cloth hem. Short range. No signature ability.", flavor: "Nobody checks the boot.",
    signature: "Two rounds. Pick them carefully.", mats: ["sheet-steel", "casing-brass"],
    lore: "<p>A snub-barrelled pocket pistol, two to five rounds, built to vanish. Carried by couriers, card players, Pactkeepers and anyone who walks into rooms where weapons are collected at the door. Useless past a card table. Decisive at one.</p><p><b>Standard Issue.</b> Concealable sidearm. The whole point is that nobody knows.</p>" }),
  R({ name: "Machine Pistol", formula: "1d8", range: { short: 15, long: 60 }, tags: ["pistol", "ballistic", "automatic"], img: "icons/weapons/guns/machine-gun-sub-pistol.webp",
    effect: "Automatic sidearm. Loud, fast and over quickly. No signature ability.", flavor: "Empties a magazine faster than a bad apology.",
    signature: "The sound of a decision being made for you.", mats: ["sheet-steel", "casing-brass", "spring-tension-arm"],
    lore: "<p>A full-auto handgun with an extended magazine and a folding foregrip — a bandit's gun, a bodyguard's gun, a get-out-of-the-alley gun. It climbs, it chews ammunition and it turns every room it is fired in into a conversation nobody can hear. Faction armouries make them; few issue them.</p><p><b>Standard Issue.</b> Automatic, close-range, inaccurate past a doorway.</p>" }),
  R({ name: "Pump Shotgun", formula: "1d10", range: { short: 10, long: 40 }, tags: ["shotgun", "ballistic", "two-handed"], img: "icons/weapons/guns/shotgun-pump.webp",
    effect: "Two-handed scattergun. Brutal up close, useless at distance. No signature ability.", flavor: "The pump is the warning. The rest is paperwork.",
    signature: "Racks once. That's usually enough.", mats: ["sheet-steel", "walnut-stock", "lead-shot"],
    lore: "<p>A pump-action smoothbore with a tube magazine and a walnut stock, loaded with whatever lead-shot the trade post had. The homestead gun of Bad Eden — behind every bar, under every bunk, in the rack of every hovercraft. Hits like a wall at ten paces and like a rumour at forty.</p><p><b>Standard Issue.</b> Short-range two-handed ballistic. Nobody has ever called it elegant.</p>" }),
  R({ name: "Sawed-Off Shotgun", formula: "1d10", range: { short: 5, long: 20 }, tags: ["shotgun", "ballistic", "concealable"], img: "icons/weapons/guns/shotgun-short-steel.webp",
    effect: "One-handed scattergun, hides under a coat. Point-blank only. No signature ability.", flavor: "Two barrels. One conversation.",
    signature: "Shortened for people who like to be close to their problems.", mats: ["sheet-steel", "lead-shot"],
    lore: "<p>A double-barrelled shotgun with the barrels and stock cut back to something that fits under a duster. Favoured by rig crews, river smugglers and anyone whose fights happen across a table. Past twenty feet it is a loud way to miss; inside five, nothing standard-issue hits harder.</p><p><b>Standard Issue.</b> Concealable, two shots, no third chance.</p>" }),
  R({ name: "Carbine", formula: "1d10", range: { short: 40, long: 150 }, tags: ["rifle", "ballistic", "two-handed"], img: "icons/weapons/guns/rifle-assault-carbine.webp",
    effect: "Two-handed short rifle. Handles in a rig cab or a stairwell. No signature ability.", flavor: "A rifle that learned to live indoors.",
    signature: "Short enough for the cab, long enough for the road.", mats: ["sheet-steel", "walnut-stock", "casing-brass"],
    lore: "<p>A short-barrelled magazine rifle, the pattern faction outriders and rig gunners prefer: light enough to swing through a hatch, accurate enough to answer a Hunting Rifle at road range. Stamped receivers, salvaged optics when the crew can get them.</p><p><b>Standard Issue.</b> Two-handed ballistic. The outrider's compromise.</p>" }),
  R({ name: "Service Rifle", formula: "1d10", range: { short: 40, long: 160 }, tags: ["rifle", "ballistic", "automatic", "two-handed"], img: "icons/weapons/guns/rifle-assault-wood-grip.webp",
    effect: "Two-handed select-fire rifle — the faction line-infantry pattern. No signature ability.", flavor: "Issued by the crate. Returned by the handful.",
    signature: "The faction's handwriting, in brass.", mats: ["sheet-steel", "walnut-stock", "casing-brass"],
    lore: "<p>The select-fire rifle every faction armoury turns out for its line troops — a wooden-gripped pattern copied from a pre-Fall design nobody remembers the name of. Thirty-round magazines, iron sights, a bayonet lug that mostly holds a bottle opener. When a Garrison Fort empties out, this is what it empties out carrying.</p><p><b>Standard Issue.</b> Two-handed ballistic, automatic. The sound of a faction meaning it.</p>" }),
  R({ name: "Squad Machine Gun", formula: "2d6", range: { short: 40, long: 160 }, tier: 2, folder: "weapons", tags: ["machine-gun", "ballistic", "automatic", "two-handed", "heavy"], img: "icons/weapons/guns/machine-gun-drum.webp",
    effect: "Heavy, two-handed, belt- or drum-fed. Suppresses a street on its own. Best fired braced or from a rig mount. No signature ability.", flavor: "One per squad. One is plenty.",
    signature: "Keeps heads down and ledgers open.", mats: ["brace-iron", "sheet-steel", "casing-brass"],
    lore: "<p>A drum-fed light machine gun on a bipod — the heaviest thing a faction hands to one person. Proven kit, not starter kit: the quartermaster signs it out by name, and the crew that carries it carries nothing else. On a rig pintle it is the difference between a convoy and a target.</p><p><b>Proven Issue.</b> Tier II heavy automatic ballistic. No signature — it has never needed one.</p>" }),
  R({ name: "Hunting Bow", formula: "1d8", range: { short: 30, long: 120 }, flavorKey: "arrow", aa: AA_ARROW, tags: ["bow", "silent", "two-handed"], img: "icons/weapons/bows/longbow-recurve-leather-brown.webp",
    effect: "Two-handed, silent. Arrows can be recovered and re-fletched. No signature ability.", flavor: "Quiet enough to keep the deer, and the neighbours, from noticing.",
    signature: "Every arrow comes back if you walk far enough.", mats: ["ash-haft", "hex-rope"],
    lore: "<p>A recurve hunting bow of laminated ash with a hex-rope string, the kind every hex still makes because arrows are free and brass is not. Hunters, scouts and anyone who would rather not announce themselves carry one. It will never out-shoot a Hunting Rifle; it will out-last one, and the ammunition grows on trees.</p><p><b>Standard Issue.</b> Silent two-handed ranged. No signature — it predates the idea.</p>" })
];

const ARMOR = [
  { name: "Ballistic Vest", weight: "light", guard: 2, evasion: 0, resolve: 0, tags: ["vest", "ballistic"], img: "icons/equipment/chest/bullet-proof-vest-kevlar.webp", mats: ["pre-fall-cotton", "expanded-polyurethane", "rivet-strap"],
    signature: "Pre-Fall fibre that still remembers what it was for.", lore: "<p>A sleeveless vest of layered pre-Fall ballistic fibre with foam trauma pads front and back, pulled from an evidence locker or a cop's closet two centuries ago and re-stitched a dozen times since. Light enough to wear under a coat all day; stiff enough to stop a slug. The sidearm's answer.</p><p><strong>Standard Issue.</strong> No signature, no harmonization. Zips up the front.</p>" },
  { name: "Riding Leathers", weight: "light", guard: 1, evasion: 1, resolve: 0, tags: ["leather", "road"], img: "icons/equipment/chest/jacket-motorcycle-leather-brown.webp", mats: ["work-leather", "rivet-strap"],
    signature: "Road-rash insurance with a collar.", lore: "<p>A heavy leather riding jacket with doubled elbows and shoulders, cut for a rig saddle or a hovercraft rail. Outriders, couriers and anyone who spends more time on the road than off it. Turns a slide on gravel into a story and a knife into a scuff.</p><p><strong>Standard Issue.</strong> No signature. Smells of fuel and weather.</p>" },
  { name: "Flak Jacket", weight: "medium", guard: 2, evasion: 0, resolve: 0, tags: ["jacket", "ballistic"], img: "icons/equipment/chest/jacket-modern-military.webp", mats: ["road-canvas", "sheet-steel", "quilted-liner"],
    signature: "Canvas on the outside, sheet-steel on the inside, a faction stencil on the back.", lore: "<p>A canvas field jacket with steel plates sewn into the chest and back panels over a quilted liner — the faction line-infantry pattern, issued by the crate alongside the Service Rifle. Heavier than it looks and warmer than anyone wants in a Bad Eden summer, but it stops what a militia expects to be shot with.</p><p><strong>Standard Issue.</strong> No signature, no harmonization. Name on the tape.</p>" },
  { name: "Tactical Harness", weight: "medium", guard: 1, evasion: 1, resolve: 0, tags: ["harness", "utility"], img: "icons/equipment/chest/harness-tactical-heavy.webp", mats: ["road-canvas", "rivet-strap", "tool-loop"],
    signature: "Twelve pockets, and every one has a reason.", lore: "<p>A webbing harness and chest rig over a padded canvas shell — pouches for magazines, a loop for the machete, a ring for the lantern. Scouts and rig crews wear it because it keeps everything where the hands already know to find it; the padding is almost incidental, and still better than nothing.</p><p><strong>Standard Issue.</strong> No signature. Rattles if you run.</p>" },
  { name: "Riot Armor", weight: "heavy", guard: 3, evasion: -1, resolve: 0, tags: ["plate", "riot"], img: "icons/equipment/chest/riot-black.webp", mats: ["sheet-steel", "padded-coat", "leather-strap"],
    signature: "Built for a crowd that has stopped listening.", lore: "<p>Segmented black steel plate over a padded coat — chest, shoulders, forearms, shins — the pattern a pre-Fall riot line wore and a hex constabulary still does. Heavy, loud, and very hard to argue with. The wearer gives up quickness for the certainty that the first swing lands on steel.</p><p><strong>Standard Issue.</strong> No signature, no harmonization. Clatters on stairs.</p>" },
  { name: "Scrap Plate", weight: "heavy", guard: 2, evasion: 0, resolve: 1, tags: ["plate", "salvaged"], img: "icons/equipment/chest/breastplate-banded-steel-studded.webp", mats: ["rivet-plate", "sheet-steel", "gambeson"],
    signature: "Someone's car door. Now it's yours.", lore: "<p>Riveted plates of salvaged sheet — car doors, signage, a pre-Fall refrigerator — strapped over a gambeson by whoever had the rivets and the afternoon. No two suits match and none of them fit, but the weight on your shoulders is the weight of knowing you'll walk out. The Bulwark's second suit; the bandit's first.</p><p><strong>Standard Issue.</strong> No signature. Every dent is a previous owner.</p>" },
  { name: "Scrap Helm", weight: "light", guard: 1, evasion: 0, resolve: 0, tags: ["helm", "salvaged"], img: "icons/equipment/head/cap-steel.webp", mats: ["sheet-steel", "quilted-liner"],
    signature: "Keeps the rain and the rebar off.", lore: "<p>A steel skull-cap hammered from sheet, lined with quilted cloth and chin-strapped with whatever was handy. Worn over a hood, under a hat, or on its own by people who have been hit in the head once already and formed an opinion. Pairs with any armor; stacks with none of the arguments.</p><p><strong>Standard Issue.</strong> No signature. One size fits most.</p>" },
  { name: "Riot Shield", weight: "shield", guard: 2, evasion: -1, resolve: 0, tags: ["tower"], img: "icons/equipment/shield/heater-steel-grey.webp", mats: ["sheet-steel", "leather-cuff", "brace-iron"],
    signature: "A wall that agreed to come along.", lore: "<p>A tall rectangular shield of sheet-steel on a brace-iron frame with a forearm cuff and a grip, the constabulary pattern. It covers from chin to knee and makes a line of four people into a wall. Heavy enough that nobody carrying one is dodging anything; that was never the plan.</p><p><strong>Standard Issue.</strong> Pairs with any one-handed weapon. No signature, no attunement, no view.</p>" }
];

// ─── Build records ───────────────────────────────────────────────────────────
const now = Date.now();
const stats = (t) => ({ coreVersion: "14.364", systemId: "fourththing", systemVersion: SYS_VER, createdTime: t, modifiedTime: t, lastModifiedBy: GM_USER, compendiumSource: null, duplicateSource: null, exportSource: null });
const rfiBase = (frame, tier, signature, mats, lore, reach) => ({ tier: ROMAN[tier], footprint: 1, reach, frame, signature, origin: "looted", originator: null, bound: "free",
  upkeep: { mode: "passive", per: "scene" }, misfire: { tierClamp: true, table: null }, signals: {}, lore, materialOf: mats, price: price(tier, frame) });

function buildWeapon(w) {
  const id = ID_SEED[w.name]; if (!id) throw new Error(`no id for ${w.name}`);
  const manifestation = structuredClone(TPL_MELEE.system.manifestation); manifestation.tier = w.tier;
  const tags = [`t${w.tier}-baseline`, ...w.tags];
  return {
    name: w.name, type: "weapon", img: w.img,
    system: { category: w.cat, intent: "violence", skill: w.skill,
      damage: { formula: w.formula, attribute: "violence", type: "kinetic", damageFlavor: w.flavorKey, track: "integrity" }, damageParts: [],
      range: w.range, tags, effect: w.effect, flavor: w.flavor, manifestation,
      description: { value: w.lore + weaponMech(w) } },
    flags: { fourththing: { rfi: { item: rfiBase("weapon", w.tier, w.signature, w.mats, w.lore, "5") } }, autoanimations: w.aa(w.name) },
    folder: FOLDER[w.folder].id, _id: id, effects: [], sort: 0, ownership: { default: 0, [GM_USER]: 3 }, _stats: stats(now), _key: `!items!${id}`
  };
}
function buildArmor(a) {
  const id = ID_SEED[a.name]; if (!id) throw new Error(`no id for ${a.name}`);
  const frame = a.weight === "shield" ? "shield" : "armor";
  const p = price(1, frame);
  const tags = ["t1-baseline", a.weight, ...a.tags];
  const changes = [["guard", a.guard], ["evasion", a.evasion], ["resolve", a.resolve]].filter(([, v]) => v)
    .map(([k, v]) => ({ key: `flags.fourththing.grant.${k}`, value: v, priority: 20, type: "add", phase: "initial" }));
  const eff = structuredClone(TPL_EFFECT); delete eff._stats; delete eff._key;
  eff._id = id.slice(0, 12) + "Eff1"; eff.system = { changes }; eff._key = `!items.effects!${id}.${eff._id}`; eff._stats = stats(now);
  return {
    name: a.name, type: "armor", img: a.img,
    system: { guardBonus: a.guard, evasionBonus: a.evasion, resolveBonus: a.resolve, resistances: [], armorSkill: WEIGHT_SKILL[a.weight], equipped: false, tags, category: "armor", source: "",
      description: { value: a.lore + armorMech(a, p), chat: "" } },
    flags: { fourththing: { rfi: { item: rfiBase(frame, 1, a.signature, a.mats, a.lore, "self") } } },
    folder: FOLDER.t1armor.id, _id: id, effects: [eff], sort: 0, ownership: { default: 0, [GM_USER]: 3 }, _stats: stats(now), _key: `!items!${id}`
  };
}
const built = [...WEAPONS.map(buildWeapon), ...ARMOR.map(buildArmor)];
for (const b of built) if (have.has(b.name)) console.warn(`⚠ "${b.name}" already exists in the live pack — the seed will skip it`);
const folderName = id => Object.values(FOLDER).find(f => f.id === id).name;

// ─── Outputs ─────────────────────────────────────────────────────────────────
// 1. the seed macro (create data: no _key/_stats; keepId so live == repo)
const seedRows = built.map(b => { const v = structuredClone(b); delete v._key; delete v._stats; delete v.ownership; delete v.sort;
  for (const e of v.effects) { delete e._key; delete e._stats; } return { folderId: v.folder, folderName: folderName(v.folder), v: (delete v.folder, v) }; });
const macro = `/* seed-basic-arms-${STAMP}.macro.js — BASIC ARMS seed (GENERATED ${STAMP} by build-basic-arms.mjs — do not hand-edit; rebuild from a fresh dump).
 * Run from a GM seat on EMBER. DRY_RUN = true prints the plan and writes nothing; flip to false to create.
 * What: ${WEAPONS.length} weapons (${WEAPONS.filter(w => w.tier === 1).length} T1 + ${WEAPONS.filter(w => w.tier === 2).length} T2) and ${ARMOR.length} armor/shield pieces, Standard Issue, into bbttcc-master-content.items
 *       (folders "T1 Baseline Weapons" / "BBTTCC Weapons" / "T1 Baseline Armor"). A name already in the pack is skipped. Ids are kept (repo _source == live).
 */
const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.items";
const ITEMS = ${JSON.stringify(seedRows, null, 1)};
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const pack = game.packs.get(PACK_ID); if (!pack) return ui.notifications.error(\`No pack \${PACK_ID}\`);
  const index = await pack.getIndex(); const have = new Set(index.map(i => i.name)); const haveId = new Set(index.map(i => i._id));
  const log = []; let created = 0, skipped = 0;
  const wasLocked = pack.locked;
  try {
    if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
    const folderId = (row) => { const f = pack.folders.get(row.folderId) ?? pack.folders.find(x => x.name === row.folderName); if (!f) throw new Error(\`folder \${row.folderName} not in the pack\`); return f.id; };
    const fresh = [];
    for (const row of ITEMS) {
      if (have.has(row.v.name) || haveId.has(row.v._id)) { log.push(\`· skip \${row.v.name} — already in the pack\`); skipped++; continue; }
      const r = row.v.flags.fourththing.rfi.item;
      log.push(\`\${DRY_RUN ? "·" : "✔"} [\${row.folderName}] \${row.v.name}  T\${r.tier} \${r.frame} \${r.price.marks} \${r.price.currency} marks · \${row.v.img}\`);
      fresh.push({ ...row.v, folder: folderId(row) });
    }
    if (!DRY_RUN && fresh.length) { const docs = await Item.createDocuments(fresh, { pack: pack.collection, keepId: true }); created = docs.length; }
    else created = fresh.length;
  } finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  console.log(\`[seed-basic-arms] \${DRY_RUN ? "DRY RUN" : "CREATED"} — \${created} item(s), \${skipped} skipped\\n\` + log.join("\\n"));
  ui.notifications.info(\`seed-basic-arms \${DRY_RUN ? "dry run" : "created"}: \${created} items, \${skipped} skipped — see console (F12).\`);
  return { created, skipped, log };
})();
`;
fs.writeFileSync(OUT, macro);
console.log(`seed → ${OUT} (${built.length} items: ${WEAPONS.length} weapons, ${ARMOR.length} armor)`);

// 2. dump-shaped rows for the offline lint
if (DUMP) {
  const lines = [];
  for (const b of built) { const v = structuredClone(b); v.effects = v.effects.map(e => e._id); lines.push(JSON.stringify({ k: v._key, v }));
    for (const e of b.effects) lines.push(JSON.stringify({ k: e._key, v: e })); }
  fs.writeFileSync(DUMP, lines.join("\n") + "\n");
  console.log(`dump → ${DUMP} (${lines.length} records)`);
}

// 3. repo _source files (pack-record shape, same as the rest of packs/_source/items)
if (SOURCE) {
  let n = 0;
  for (const b of built) {
    const fn = path.join(SRC_DIR, `${b.name.replace(/[^A-Za-z0-9]/g, "_")}_${b._id}.json`);
    fs.writeFileSync(fn, JSON.stringify(b, null, 2) + "\n"); n++;
  }
  console.log(`source → ${n} files in ${path.relative(process.cwd(), SRC_DIR)}`);
}

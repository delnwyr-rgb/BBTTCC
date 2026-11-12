#!/usr/bin/env node
/* build-halloween-hoard.mjs — THE HALLOWEEN HOARD (2026-10-31, Dave: "new weapons and armor and jewelry and gadgets … Halloween
 * themed if they are found in the grief towns … a costume … the most popular costume of that year for the 9-12 set, got at the
 * Crown Mall probably. No town has a complete set … rewards for quests or looted from defeated enemies. Powerful receipts").
 *
 * ONE catalogue → everything the hoard needs, with FIXED ids so repo _source == live:
 *   node tools/build-halloween-hoard.mjs                      writes (all paths under modules/):
 *     bbttcc-master-content/tools/seed-halloween-hoard-2026-10-31.macro.js   [GM, DRY_RUN, keepId]
 *         27 items → bbttcc-master-content.items (new folder "Halloween Hoard 2077")
 *         9 receipt templates → bbttcc-master-content.courtly-secrets
 *         13 boss drops → the pack NPC docs AND every world actor of the same name (the corpse loot shows them)
 *     bbttcc-master-content/packs/_source/items/<Name>_<id>.json · packs/_source/courtly-secrets/<Name>_<id>.json  (repo canon)
 *     bbttcc-campaign/tools/patch-halloween-hoard-2026-10-31.macro.js  [GM, DRY_RUN] — the campaign edit (inlines halloween-hoard-campaign-patch.mjs)
 *   --dump <out.jsonl>   also write the item records in ft-dump-pack shape (→ bin/ft-lint-items <dir> --pack items)
 *
 * Mechanics are ENGINE-EXECUTED, never prose-only:
 *   armor        guard/evasion/resolve as system fields + the ⚙️ Defense Grant AE (the live armor shape), graded per item-ladder.js
 *   weapons      graded (+rank to hit / damage baked into the formula); two carry a bound Working (charges, cast path)
 *   worn gear    FT.WORN_GEAR_SLOTS slots, equipped by the inventory toggle: AE grant rows (guard/evasion/resolve/resists/condImmunes/
 *                surgeCap — 2026-10-31 engine), passives.checkBonus / passives.initiative.bonus, flags.bbttcc.radiation.tierDelta
 *   gadgets      gear hosting a bound Working (flags.fourththing.working + rfi.item.tech charged, attuned, a fuel material)
 *   the costume  three worn pieces tagged set:sparky — game.fourththing.sets.complete(actor,"sparky") wards the Wendigo rung
 * Prices follow systems/fourththing/rfi-pricing.js (computeListPrice); icons are core Foundry webp (lint I18).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { HOARD_DEFAULT } from "../../bbttcc-campaign/tools/halloween-hoard-campaign-patch.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
// The system modules register Foundry hooks at load — stub the globals the way lint-items.mjs does, then import from SOURCE so prices
// and grade names cannot drift from the code.
globalThis.Hooks ??= { on() {}, once() {}, callAll() {} }; globalThis.game ??= { settings: { get() { return undefined; } } };
const { computeListPrice, computeSaleBack, defaultCurrencyForFrame } = await import(pathToFileURL(path.resolve(ROOT, "systems/fourththing/rfi-pricing.js")).href);
const { GRADES } = await import(pathToFileURL(path.resolve(ROOT, "systems/fourththing/item-ladder.js")).href);
const argv = process.argv.slice(2); const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const STAMP = "2026-10-31";
const DUMP = opt("--dump");
const SRC_ITEMS = path.join(HERE, "../packs/_source/items");
const SRC_SECRETS = path.join(HERE, "../packs/_source/courtly-secrets");
const OUT_SEED = path.join(HERE, `seed-halloween-hoard-${STAMP}.macro.js`);
const OUT_PATCH = path.resolve(ROOT, "modules/bbttcc-campaign/tools", `patch-halloween-hoard-${STAMP}.macro.js`);
const PATCH_SRC = path.resolve(ROOT, "modules/bbttcc-campaign/tools/halloween-hoard-campaign-patch.mjs");

const FOLDER = { id: "hH0Folder0000001", name: "Halloween Hoard 2077" };
const ID = HOARD_DEFAULT.items;   // the campaign patch and this build share one id table
const idOk = (s) => /^[A-Za-z0-9]{16}$/.test(s);
const NOW = 1793491200000;   // 2026-10-31T00:00Z — _stats timestamps
const stats = { coreVersion: "14.369", systemId: "fourththing", systemVersion: "0.6.37", createdTime: NOW, modifiedTime: NOW, lastModifiedBy: "bytUGWIOqq9eT7Or", compendiumSource: null, duplicateSource: null, exportSource: null };
const ROMAN = { 1: "I", 2: "II", 3: "III", 4: "IV" };
const p = (html) => `<p>${html}</p>`;

/* ─── shapes (copied from the live pack: Longsword / Riot Armor / Doorframe Discount) ─────────────────────────── */
const MANIFEST_WEAPON = { tier: 1, concept: "", form: "weapon", function: "harm", stability: "bound", interactionModel: "weapon", costType: "none", costValue: 0, costText: "", duration: "scene", durationText: "", triggerText: "", scale: "personal", targetText: "", rangeAreaText: "", rangeFt: 0, maintenanceCost: "", riskText: "", pathResonance: "", fictionalPermission: "", gmCalibration: "", mechanicalHook: "", signature: "", thirdThing: "", opCost: { pool: "", value: 0 } };
const POWER_MANIFEST = (o) => ({ tier: 1, concept: o.concept || "", form: o.form || "ward", function: o.fn || "protect", stability: "instant", interactionModel: "event", costType: "none", costValue: 0, costText: "", duration: o.duration || "1-round", durationText: "", triggerText: "", scale: "personal", targetText: "", rangeAreaText: "", rangeFt: o.rangeFt ?? 30, maintenanceCost: "", riskText: "", pathResonance: "", fictionalPermission: "", gmCalibration: "", mechanicalHook: "", signature: "", thirdThing: "", opCost: { pool: "", value: 0 }, area: { shape: o.areaShape || "none", size: o.areaSize || 0 }, activation: { type: "action", consumePool: true }, ...(o.save ? { resolution: { shape: "save", saveAttribute: o.save.attribute, saveDcMode: "cast-dc", onSave: "negate" } } : {}), maintenanceKey: "none", isSignature: false, chain: { enabled: false, count: 3, range: 30, damageFormula: "1d6", damageType: "", carryConditions: false, carryEffects: false }, conditionalDamage: [], appliedEffects: { modifiers: o.modifiers || [], resists: [], immunes: [] }, ...(o.states ? { appliedStates: { states: o.states, duration: o.duration || "1-round" } } : {}) });
const power = (o) => ({ name: o.name, img: o.img, system: {
  intent: o.intent || "intrigue", channel: o.channel || "mind", sephirah: o.sephirah || "yesod",
  activation: "action", target: o.target || "self", range: o.range || "near", damageFlavor: "",
  damageRoll: { op: "none", number: 0, die: "d6", attribute: "", type: "kinetic", flavor: "", track: "integrity" }, damageParts: [],
  effect: o.effect, tags: ["bound-working", "halloween-hoard", ...(o.tags || [])], category: "manifestation", flavor: o.flavor || "",
  manifestation: POWER_MANIFEST(o), description: { value: p(o.effect), chat: "" } } });

const effectRows = (id, rows) => rows.length ? [{ name: "⚙️ Defense Grant", transfer: false, disabled: false, flags: { fourththing: { defenseGrant: true } },
  system: { changes: rows.map(([key, value]) => ({ key: `flags.fourththing.grant.${key}`, value, priority: 20, type: "add", phase: "initial" })) },
  _id: `${id.slice(0, 12)}Eff1`, img: "icons/svg/aura.svg", type: "base", start: null, duration: { value: null, units: "seconds", expiry: null, expired: false },
  description: "", origin: null, tint: "#ffffff", statuses: [], showIcon: 1, folder: null, sort: 0, _stats: stats }] : [];

function rfi({ tier, frame, bound = "free", tech = null, signature, lore, materialOf, reach = "self", rarityMult = 1, notes = "", origin = "looted" }) {
  const marks = computeListPrice({ tier, frame, hasTech: !!tech, bound, rarityMult });
  const currency = defaultCurrencyForFrame(frame);
  return { tier: ROMAN[tier], footprint: 1, reach, frame, signature, origin, originator: null, bound, upkeep: { mode: "passive", per: "scene" }, misfire: { tierClamp: true, table: null }, signals: {}, lore,
    materialOf, ...(tech ? { tech } : {}),
    price: { marks, currency, gmOverride: false, altCurrencies: {}, split: null, rarityMult, notes: notes || `T${ROMAN[tier]} ${frame}${tech ? " × tech 2.0" : ""} × bound ${bound}`, bound, saleBack: computeSaleBack(marks, bound) } };
}
const techBlock = (charges, recoverPer) => ({ kind: "charged", charges: { value: charges, max: charges, recoverPer }, fuel: null, attunement: { required: true, slots: 1 }, signature: "bound-working", failure: "misfire", origin: "witness-forge", shielded: false });
const working = (pw, charges, recoverPer) => ({ power: pw, charges: { value: charges, max: charges, recoverPer }, tier: 1 });

const doc = (id, name, type, img, system, flags, effects = [], sort = 0) => {
  if (!idOk(id)) throw new Error(`bad id ${id} (${name})`);
  return { _id: id, name, type, img, system, flags, effects, folder: FOLDER.id, sort, ownership: { default: 0 }, _stats: stats, _key: `!items!${id}` };
};

/* ─── WEAPONS ───────────────────────────────────────────────────────────────────────────────────────────────── */
function weapon({ id, name, grade, img, category = "melee", skill = "melee", die, type = "kinetic", flavorDmg, range = { short: 1, long: 1 }, tags, effect, flavor, lore, signature, materialOf, tier, work = null, workCharges = 2, workPer = "scene", drop }) {
  const G = grade ? GRADES[grade] : null;
  const bound = work ? "attuned" : (G ? G.bound : "free");
  if (G && G.rank === 3 && work) throw new Error(`${name}: a Crowned weapon cannot also host a Working (soulbound ≠ attuned)`);
  const formula = G ? `${die}+${G.rank}` : die;
  const fullName = G ? `${G.name} ${name}` : name;
  const sys = { category, intent: "violence", skill, damage: { formula, attribute: "violence", type, damageFlavor: flavorDmg, track: "integrity" }, damageParts: [], range: { ...range, units: "sq" },
    tags: ["halloween-hoard", "mal-voiced", ...(G ? ["graded", `grade-${G.key}`] : []), ...(work ? ["bound-working"] : []), ...tags], effect, flavor, manifestation: { ...MANIFEST_WEAPON },
    description: { value: p(lore) + p(`<em>${effect}</em>`) + (work ? p(`<strong>Bound Working — ${work.name}:</strong> ${work.system.effect} (${workCharges} charge${workCharges === 1 ? "" : "s"}, recovers per ${workPer}.)`) : ""), chat: "" } };
  const flags = { fourththing: { rfi: { item: rfi({ tier, frame: "weapon", bound, tech: work ? techBlock(workCharges, workPer) : null, signature, lore: p(lore), materialOf, reach: category === "ranged" ? String(range.long) : "melee", origin: "looted",
      notes: `T${ROMAN[tier]} weapon${G ? ` (${G.name} +${G.rank})` : ""}${work ? ` × tech 2.0 (bound Working: ${work.name})` : ""} × bound ${bound}` }) },
    ...(G ? { grade: { rank: G.rank, name: G.name, key: G.key, attack: G.rank, damage: G.rank } } : {}),
    ...(work ? { working: working(work, workCharges, workPer) } : {}) } };
  return { drop, d: doc(id, fullName, "weapon", img, sys, flags) };
}
/* ─── ARMOR ─────────────────────────────────────────────────────────────────────────────────────────────────── */
function armor({ id, name, grade, img, weight, guard = 0, evasion = 0, resolve = 0, resistances = [], tags, effect, flavor, lore, signature, materialOf, tier, drop }) {
  const G = grade ? GRADES[grade] : null;
  const skill = { light: "fitting", medium: "bracing", heavy: "plating" }[weight];
  const bump = (v) => (G && v > 0 ? v + G.rank : v);
  const g = bump(guard), e = bump(evasion), r = bump(resolve);
  const fullName = G ? `${G.name} ${name}` : name;
  const sys = { guardBonus: g, evasionBonus: e, resolveBonus: r, resistances, armorSkill: skill, equipped: false,
    tags: ["halloween-hoard", "mal-voiced", weight, ...(G ? ["graded", `grade-${G.key}`] : []), ...tags], category: "armor", source: "",
    description: { value: p(lore) + p(`<em>${effect}</em>`) + p(`Guard ${g >= 0 ? "+" : ""}${g} · Evasion ${e >= 0 ? "+" : ""}${e} · Resolve ${r >= 0 ? "+" : ""}${r}${resistances.length ? ` · resists ${resistances.join(", ")}` : ""} — ${weight}, needs ${skill} (Trained = half, Proficient = full).`), chat: "" } };
  const rows = [["guard", g], ["evasion", e], ["resolve", r]].filter(([, v]) => v !== 0);
  const flags = { fourththing: { rfi: { item: rfi({ tier, frame: "armor", bound: G ? G.bound : "free", signature, lore: p(lore), materialOf, notes: `T${ROMAN[tier]} armor${G ? ` (${G.name} +${G.rank})` : ""} × bound ${G ? G.bound : "free"}` }) },
    ...(G ? { grade: { rank: G.rank, name: G.name, key: G.key, defense: G.rank } } : {}) } };
  return { drop, d: doc(id, fullName, "armor", img, sys, flags, effectRows(id, rows)) };
}
/* ─── WORN GEAR (jewelry + the costume) ─────────────────────────────────────────────────────────────────────── */
function worn({ id, name, img, slot, frame = "talisman", bound = "free", tier, grants = [], checkBonus = [], initiative = 0, radiationDelta = 0, set = null, tags = [], effect, flavor, lore, signature, materialOf, drop }) {
  const sys = { slot, tags: ["halloween-hoard", "mal-voiced", "worn", ...(set ? [`set:${set}`, "costume"] : []), ...tags], category: "gear", source: "", quantity: 1,
    description: { value: p(lore) + p(`<em>${effect}</em>`) + p(`Worn (${slot}) — equip it on the sheet (◇ → ◆) for the benefit.${set ? ` Part of the Sparky set: wear all three and the Wendigo don't take you.` : ""}`), chat: "" } };
  const ft = { rfi: { item: rfi({ tier, frame, bound, signature, lore: p(lore), materialOf, notes: `T${ROMAN[tier]} ${frame} × bound ${bound}` }) } };
  const passives = {};
  if (checkBonus.length) passives.checkBonus = checkBonus.map(([skill, bonus, note]) => ({ context: "check", skill, bonus, ...(note ? { note } : {}) }));
  if (initiative) passives.initiative = { bonus: initiative };
  if (Object.keys(passives).length) ft.passives = passives;
  const flags = { fourththing: ft, ...(radiationDelta ? { bbttcc: { radiation: { tierDelta: radiationDelta } } } : {}) };
  return { drop, d: doc(id, name, "gear", img, sys, flags, effectRows(id, grants)) };
}
/* ─── GADGETS (gear hosting a bound Working) ────────────────────────────────────────────────────────────────── */
function gadget({ id, name, img, slot = "trinket", tier, work, charges = 2, per = "scene", tags = [], flavor, lore, signature, materialOf, drop }) {
  const sys = { slot, tags: ["halloween-hoard", "mal-voiced", "bound-working", "gadget", ...tags], category: "gear", source: "", quantity: 1,
    description: { value: p(lore) + p(`<strong>Bound Working — ${work.name}:</strong> ${work.system.effect}`) + p(`${charges} charge${charges === 1 ? "" : "s"}, recovers per ${per}. Cast it from the Manifestations tab like any power — it spends a charge instead of Clarity (Noise and misfire still apply).`), chat: "" } };
  const flags = { fourththing: { rfi: { item: rfi({ tier, frame: "tool", bound: "attuned", tech: techBlock(charges, per), signature, lore: p(lore), materialOf, notes: `T${ROMAN[tier]} tool × tech 2.0 (bound Working: ${work.name}) × attuned` }) }, working: working(work, charges, per) } };
  return { drop, d: doc(id, name, "gear", img, sys, flags) };
}

/* ═══ THE CATALOGUE ═══════════════════════════════════════════════════════════════════════════════════════════ */
const B = (name) => name;   // boss name (pack NPC doc name == world actor name)
const ITEMS = [
  /* ── the Sparky costume (quest: one piece per grief town) ── */
  worn({ id: ID.sparky_mask, name: "Sparky Mask (Crown Mall, 2077)", img: "icons/equipment/head/mask-carved-face-orange.webp", slot: "mask", frame: "vestment", tier: 1, set: "sparky",
    grants: [["resolve", 1]], checkBonus: [["performance", 2, "Sparky says: nobody can read a dog's face"]],
    effect: "Resolve +1 and +2 on Performance checks while worn — behind the goggles you could be anybody, which is the point of a mask.",
    signature: "SPARKY, in the cereal-box font. One ear bent.", lore: "Yellow vinyl, goggles painted on, elastic that never lost its stretch because nothing in Soft Landing wears out. It was under the row of small sneakers at the castle door, face down, where a kid drops a mask the second the grown-ups stop looking. The inside still smells like running.",
    materialOf: ["vinyl", "elastic", "mascot-energy"], tags: ["mask", "grief-towns"] }),
  worn({ id: ID.sparky_shirt, name: "Sparky Reactor-Suit Top (Crown Mall, 2077)", img: "icons/equipment/chest/shirt-collared-yellow.webp", slot: "costume", frame: "vestment", tier: 1, set: "sparky",
    grants: [["guard", 1]], radiationDelta: -1,
    effect: "Guard +1 while worn, and it is a reactor suit — it says so on the back — so radiation on a hex bites one level softer (the radiation engine reads it like any rad gear).",
    signature: "The trefoil paw on the chest. A concession uniform, he says.", lore: "Padded yellow, the trefoil paw over the heart, DUCK AND GLOW! across the shoulders. Bucky Sorrel of Stillwater sold it to you off his own back for buttons, and was wearing another one underneath. Sparky the Reactor Pup taught a generation of children what to do when the sirens went. The sirens went.",
    materialOf: ["padded-cloth", "reflective-tape", "mascot-energy"], tags: ["shirt", "grief-towns"] }),
  worn({ id: ID.sparky_pants, name: "Sparky Reactor-Suit Pants (Crown Mall, 2077)", img: "icons/equipment/leg/pants-brown-orange-leather-pants.webp", slot: "costume", frame: "vestment", tier: 1, set: "sparky",
    grants: [["evasion", 1]], checkBonus: [["athletics", 2, "kids run"]],
    effect: "Evasion +1 and +2 on Athletics checks while worn — the knees are gone because the kid who wore them ran everywhere, and the pants remember how.",
    signature: "Both knees worn through to the lining. Eleven thousand and six pianos.", lore: "Yellow padded trousers, the paw on one hip, knees out. Dewey of Chuckle Creek traded them for a ride on your rig and did not need them, because nothing there hurts. His brother had the top but got too big. The set was never complete in any one town. That was the whole trouble with that Halloween.",
    materialOf: ["padded-cloth", "reflective-tape", "mascot-energy"], tags: ["pants", "grief-towns"] }),
  /* ── jewelry (boss drops) ── */
  worn({ id: "hH0ReeveRing0001", name: "Ring of the Reeve's Toll", img: "icons/equipment/finger/ring-signet-copper.webp", slot: "ring", tier: 2, drop: B("Hollis Varn, Reeve of the Broken Bridge"),
    checkBonus: [["intimidation", 1], ["streetwise", 1]],
    effect: "+1 on Intimidation and Streetwise checks while worn. Every bridge has a price; the ring remembers which hand to hold out.",
    signature: "A copper signet worn smooth on the inside by two centuries of being turned.", lore: "Hollis Varn wore it on the hand he held out. He had a rate for everyone and a reason for every rate, and the ring made both sound settled. It will do the same for you, which is not entirely a gift.", materialOf: ["copper", "toll-stamp"] }),
  worn({ id: "hH0DrownLocket01", name: "Drowned South Locket", img: "icons/equipment/neck/amulet-carved-stone-bottle.webp", slot: "amulet", tier: 2, drop: B("The Ferryman of the Drowned South"),
    grants: [["resolve", 1], ["condImmunes", "drowning"]],
    effect: "Resolve +1 while worn, and you cannot drown — the locket holds one breath, and it is always the next one.",
    signature: "A stoppered stone bottle on a chain. Something moves inside when you are not looking.", lore: "The Ferryman kept it against his chest for the river's sake. Open it and there is water in it, river water, and the water is not still. Wear it and the Drowned South will carry you across instead of down.", materialOf: ["river-stone", "cork", "last-breath"] }),
  worn({ id: "hH0QuizMedal0001", name: "Gloomgill's Quiz Medal", img: "icons/commodities/treasure/medal-ribbon-star-gold-red.webp", slot: "pin", tier: 3, drop: B("Gloomgill"),
    checkBonus: [["lore", 2], ["occult", 1]],
    effect: "+2 on Lore and +1 on Occult checks while pinned on. Gloomgill asked the questions; whoever wears this knew the answers.",
    signature: "FIRST PLACE, in gilt, over a question mark.", lore: "The marsh quizmaster gave these out, once a decade, to the one guest who got every question right. There are three in the world. The other two are on the bottom of the marsh, still pinned to the winners.", materialOf: ["gilt", "ribbon", "right-answer"] }),
  worn({ id: "hH0PirateEarring", name: "Sky-Pirate's Earring", img: "icons/commodities/treasure/trinket-wing-white.webp", slot: "trinket", tier: 3, drop: B("Sklar Bjrornholt"),
    initiative: 2, checkBonus: [["piloting", 1]],
    effect: "Initiative +2 and +1 on Piloting checks while worn. Valhaulan boarders move first or not at all.",
    signature: "A gold hoop with a blue bead that is not glass.", lore: "Sklar Bjrornholt wore one; the other is on whoever took the last ship before this one. The bead is a drop of the high cold sky, and it wants to be up there, and it will pull you along.", materialOf: ["gold", "sky-bead"] }),
  worn({ id: "hH0GeraldLanyard", name: "Gerald's Lanyard, Laminated", img: "icons/sundries/documents/document-official-capital.webp", slot: "amulet", tier: 3, drop: B("Gerald, Assistant Regional Manager of the Apocalypse"),
    grants: [["surgeCap", 1]], checkBonus: [["diplomacy", 1, "the badge opens doors, slowly"]],
    effect: "Surge cap +1 and +1 on Diplomacy checks while worn. It says ASSISTANT REGIONAL MANAGER, and things that read it tend to wait their turn.",
    signature: "GERALD — ASSISTANT REGIONAL MANAGER — APOCALYPSE (REGION 4). The photo is not of Gerald.", lore: "Laminated, which is why it survived. Gerald wore it to every meeting including the last one. It confers no authority whatsoever and everyone who sees it behaves as though it does, which is the only kind of authority there has ever been.", materialOf: ["laminate", "nylon", "middle-management"] }),
  worn({ id: "hH0MaargRing0001", name: "Maarg's Collector's Ring", img: "icons/equipment/finger/ring-cabochon-gold-purple.webp", slot: "ring", tier: 4, bound: "attuned", drop: B("Desenitarius Maarg"),
    grants: [["surgeCap", 1], ["resists", "psychic"]],
    effect: "Surge cap +1 and resistance to psychic harm while worn. The Collector kept everyone else's dreams in it; it has room for yours to run hotter.",
    signature: "A purple cabochon with something small and sleeping inside it.", lore: "Desenitarius Maarg wore it on the old roads and took a dream from everyone who paid the toll, and kept them here, in the stone, like coins. Wear it and the dreams press back against whatever presses in. Attunes to one wearer; it is particular about company.", materialOf: ["old-gold", "dream-cabochon", "collected-sleep"] }),
  /* ── gadgets (quest rewards) ── */
  gadget({ id: ID.fog_machine, name: "Fog Machine, Party Grade", img: "icons/tools/laboratory/bowl-liquid-orange.webp", tier: 1, charges: 2, per: "scene",
    work: power({ name: "Dry Ice", img: "icons/magic/air/fog-gas-smoke-dense-gray.webp", target: "self", range: "self", effect: "A bank of stage fog boils out around you until your next turn: Evasion +2 while it stands, and you may move 2 squares unseen as part of the cast.", flavor: "Mal: 'It worked at the finale. Finales are mostly fog.'", form: "cloud", fn: "conceal", modifiers: [{ stat: "evasion", op: "+", value: 2 }], areaShape: "circle", areaSize: 2, tags: ["fog", "stealth"] }),
    signature: "A dented party fog machine with a reservoir that never runs dry.", lore: "The Chuckle Creek showrunner's. It made the series finale look like a series finale. The reservoir refills itself between scenes because that is what reservoirs do on television.", materialOf: ["pre-fall-component", "glycol", "stage-direction"] }),
  gadget({ id: ID.doorbell_camera, name: "Doorbell Camera, Still Recording", img: "icons/tools/navigation/spyglass-telescope-brass.webp", slot: "lens", tier: 2, charges: 2, per: "scene",
    work: power({ name: "Playback", img: "icons/magic/perception/eye-ringed-glow-angry-small-red.webp", target: "self", range: "near", effect: "Review the last thirty seconds from every angle: hidden or invisible things within 6 squares are revealed to you until your next turn, and you may not be surprised this round.", flavor: "Mal: 'It saw the kid come to the door. It is still seeing it.'", form: "lens", fn: "reveal", rangeFt: 30, tags: ["sight", "reveal"] }),
    signature: "A doorbell camera, unplugged for two centuries, with a live red light.", lore: "From Miss June's rare inventory: the camera from a porch on Mallwalker Lane, the night of the thirty-first. It has footage. It will show you the footage if you hold it to your eye, and it will also show you the next thirty seconds, which it should not have.", materialOf: ["pre-fall-component", "witness-glass", "porchlight"] }),
  gadget({ id: ID.spirit_board, name: "Spirit Board, Travel Edition", img: "icons/sundries/gaming/magic-eight-ball.webp", tier: 2, charges: 2, per: "scene",
    work: power({ name: "Ask the Board", img: "icons/magic/symbols/runes-triangle-orange-purple.webp", target: "single", range: "near", intent: "presence", channel: "soul", effect: "One target within 6 squares: Soul save vs Cast DC. On a fail they are Compelled for 1 round — they answer one question truthfully, and the planchette moves on its own to confirm it.", flavor: "Mal: 'Everyone pushes the planchette. The trick is the board pushes back.'", form: "sigil", fn: "compel", save: { attribute: "soul" }, states: ["compelled"], tags: ["compel", "truth"] }),
    signature: "A folding spirit board, letters worn smooth at YES and at GOODBYE.", lore: "Soft Landing's. The kids played it at the state function the night the ground went soft, and it told them something, and then the Mayor banged the gavel and they never finished asking. It still wants to finish.", materialOf: ["pre-fall-component", "pressboard", "unfinished-question"] }),
  gadget({ id: ID.glow_bandolier, name: "Glow-Stick Bandolier", img: "icons/sundries/lights/lantern-emergency-lit.webp", tier: 1, charges: 3, per: "scene",
    work: power({ name: "Crack and Shake", img: "icons/magic/light/beams-rays-orange-purple-large.webp", target: "self", range: "near", effect: "Crack a stick and the parade route lights up: you and every ally within 3 squares gain Evasion +1 for 1 round, and the area is brightly lit until your next turn.", flavor: "Mal: 'Green means go. Nobody at the parade ever decided what red meant.'", form: "light", fn: "protect", modifiers: [{ stat: "evasion", op: "+", value: 1 }], areaShape: "circle", areaSize: 3, tags: ["light", "ward"] }),
    signature: "Twelve glow sticks on a sash, all still glowing.", lore: "Stillwater parade-marshal issue. Glow sticks are supposed to die by morning; these have been going since 2077 because the parade has not ended. Crack one and for a round the dark remembers it is supposed to be a party.", materialOf: ["pre-fall-component", "luminol", "parade-permit"] }),
  gadget({ id: ID.walkie, name: "Pre-Fall Walkie, One of a Pair", img: "icons/tools/navigation/compass-brass-blue-red.webp", tier: 2, charges: 2, per: "scene",
    work: power({ name: "Over.", img: "icons/magic/sonic/projectile-sound-rings-wave.webp", target: "single", range: "far", effect: "Key the walkie: one ally within 12 squares hears you clear as a bell and gains Resolve +2 for 1 round. Occasionally someone else answers. Do not answer back.", flavor: "Mal: 'The other one is out there. Somebody has it. Somebody is very polite about it.'", form: "voice", fn: "steady", modifiers: [{ stat: "resolve", op: "+", value: 2 }], rangeFt: 60, tags: ["comms", "steady"] }),
    signature: "A yellow kids' walkie-talkie, channel 3, battery compartment empty, working.", lore: "Chuckle Creek. The new episode needed a prop and this was in the drawer. It has no batteries and it works, and sometimes when you key it the other one keys back, from somewhere that is not Chuckle Creek, and a courteous voice says thank you for the directions.", materialOf: ["pre-fall-component", "yesodium", "channel-three"] }),
  gadget({ id: ID.candy_scale, name: "Candy Scale, Calibrated to 2077", img: "icons/commodities/tech/clock-stopwatch-brass.webp", tier: 1, charges: 2, per: "scene",
    work: power({ name: "Weigh It", img: "icons/magic/control/debuff-energy-hold-levitate-yellow.webp", target: "single", range: "near", intent: "presence", channel: "mind", effect: "Set the scale before one target within 6 squares: Mind save vs Cast DC. On a fail it tells them exactly what they are worth, in candy, and they are Shaken for 1 round.", flavor: "Mal: 'Everybody wants to know. Nobody wants to know in fun-size.'", form: "sigil", fn: "shake", save: { attribute: "mind" }, states: ["shaken"], tags: ["shaken", "truth"] }),
    signature: "A brass candy scale, pans polished, needle steady at a number that is always a little low.", lore: "Bucky Sorrel's, from the lemonade concession, used to weigh the haul on the thirty-first. It still measures in 2077 candy. Put anything on it and it tells you what that thing would have fetched at the end of the night, and it is never as much as you hoped.", materialOf: ["pre-fall-component", "brass", "fun-size"] }),
  /* ── weapons ── */
  weapon({ id: "hH0CandyCleaver1", name: "Candy-Corn Cleaver", grade: 1, img: "icons/weapons/swords/sword-broad-red.webp", die: "1d8", flavorDmg: "blade", tier: 2, drop: B("Hollis Varn, Reeve of the Broken Bridge"),
    tags: ["machete", "cleaver"], effect: "A machete, Inlaid: +1 to hit and +1 damage. Confiscated from a child in 2077 and sharpened since by someone who was not one.",
    flavor: "Orange at the back, yellow at the edge, white where it bites.", lore: "Hollis Varn's. The blade is painted in three stripes like the candy and the paint has never chipped, which is not how paint works. He used it at the toll bar on the people who argued about the rate. There were not many arguments.", signature: "Three stripes. Never chips.", materialOf: ["scrap-steel", "enamel", "toll-stamp"] }),
  weapon({ id: "hH0LanternFlail1", name: "Lantern-Head Flail", grade: 1, img: "icons/weapons/maces/flail-studded-grey.webp", die: "1d8", flavorDmg: "blunt", tier: 2, drop: B("Gloomgill"),
    tags: ["flail", "mace", "light-source"], effect: "A flail, Inlaid: +1 to hit and +1 damage. The hollow iron head holds a candle that will not go out — bright light 4 squares while it is in your hand.",
    flavor: "A carved iron pumpkin on a chain, grinning, lit from inside.", lore: "Gloomgill kept it by the quiz lectern for the guests who answered wrong. The face is cut into the iron and the candle behind it has burned since the marsh went dark, and it is cheerful about it, which is worse.", signature: "The grin is lit from inside.", materialOf: ["cast-iron", "chain", "tallow-that-will-not"] }),
  weapon({ id: "hH0PorchCarbine1", name: "Porchlight Carbine", grade: 2, img: "icons/weapons/guns/rifle-brown.webp", category: "ranged", skill: "firearms", die: "1d10", flavorDmg: "ballistic", range: { short: 8, long: 32 }, tier: 3, drop: B("Compliance Engine PRIME"),
    tags: ["carbine", "rifle", "pre-fall"], effect: "A carbine, Circuited: +2 to hit and +2 damage; attunes to one hand. Under the barrel, a porchlight that was a perimeter light once.",
    flavor: "The light comes on by itself when something is on the step.", lore: "Compliance Engine PRIME's perimeter arm, re-barrelled by a hex gunsmith who did not ask what the light was for. The light is for knowing who is on the porch. It still knows.", signature: "The porchlight comes on by itself.",
    work: power({ name: "Porchlight", img: "icons/magic/light/beam-rays-yellow.webp", target: "single", range: "far", intent: "violence", channel: "body", effect: "Light one target within 12 squares: Body save vs Cast DC. On a fail they are lit for 1 round — Guard −2, and nothing they do is unseen.", flavor: "Mal: 'Trick or treat. The porch decides which.'", form: "beam", fn: "mark", save: { attribute: "body" }, modifiers: [{ stat: "guard", op: "-", value: 2 }], rangeFt: 60, tags: ["mark", "light"] }), workCharges: 2, workPer: "scene",
    materialOf: ["gun-steel", "pre-fall-component", "hex-glyph-plate", "perimeter-light"] }),
  weapon({ id: ID.doorbell_knuckles, name: "Doorbell Knuckles", grade: 2, img: "icons/weapons/fist/claw-gauntlet-gray.webp", skill: "brawl", die: "1d6", flavorDmg: "chime", tier: 3,
    tags: ["knuckles", "fist", "doorbell"], effect: "Brass knuckles, Circuited: +2 to hit and +2 damage; attunes to one hand. Each knuckle is a doorbell button. Each one rings.",
    flavor: "Ding. Dong. Ditch.", lore: "Kickflip Lazarus wore them for the run-back and gave them to the one who skated it clean. Four doorbell buttons on a brass bar; hit something and every porch on Mallwalker Lane rings at once, two hundred years late.", signature: "Four buttons. All of them ring.",
    work: power({ name: "Ding-Dong Ditch", img: "icons/magic/movement/trail-streak-impact-blue.webp", target: "self", range: "self", intent: "intrigue", channel: "body", effect: "Ring and run: step 3 squares without provoking anything and take Evasion +2 until your next turn. Best used immediately after a hit, which is the only time anyone has ever used it.", flavor: "Mal: 'The sport of kings. Very short kings.'", form: "step", fn: "move", modifiers: [{ stat: "evasion", op: "+", value: 2 }], tags: ["move", "evade"] }), workCharges: 2, workPer: "scene",
    materialOf: ["brass", "pre-fall-component", "witness-glass", "doorbell-button"] }),
  weapon({ id: "hH0BoardingAxe01", name: "Valhaulan Boarding Axe", grade: 3, img: "icons/weapons/axes/axe-double-engraved-blue.webp", die: "1d10", flavorDmg: "blade", tier: 4, drop: B("Sklar Bjrornholt"),
    tags: ["axe", "valhaulan", "capstone"], effect: "A boarding axe, Crowned: +3 to hit and +3 damage; soulbound — keyed to the hand that took it from Sklar, it will not be sold. On a hit, push the target 1 square: Boarding Call.",
    flavor: "Blue steel, Valhaulan script down the haft, a name you cannot read and will come to.", lore: "Sklar Bjrornholt's. It has gone over the rail of eleven ships and come back every time. The script on the haft is the new hand, the one Etta knows, and it spells the axe's name, and the axe will tell you the name the first time you kill with it and never again.", signature: "It will tell you its name once.", materialOf: ["sky-steel", "valhaulan-script", "a-true-name"] }),
  weapon({ id: ID.egg_shotgun, name: "Egg-Carton Shotgun", grade: 1, img: "icons/weapons/guns/gun-blunderbuss-gold.webp", category: "ranged", skill: "firearms", die: "1d10", flavorDmg: "ballistic", range: { short: 2, long: 8 }, tier: 2,
    tags: ["shotgun", "sawed-off", "trick-or-treat"], effect: "A sawed-off, Inlaid: +1 to hit and +1 damage. Loaded from an egg carton; when you fire it at one target, an adjacent second target takes the spray too (GM applies the roll's damage once more).",
    flavor: "A dozen in the carton. You are always one short.", lore: "Donny on the Wall took it off a party at the mall gate in 2077 and has kept it, like everything else, out of a sense that someone should. He gives it to the ones who answer honestly. The carton is always one egg short and the gun does not seem to mind.", signature: "Always one egg short.", materialOf: ["scrap-steel", "egg-carton", "bad-vibes"] }),
  /* ── armor ── */
  armor({ id: "hH0ApexHideCoat1", name: "Apex Hide Coat", grade: 1, img: "icons/equipment/chest/breastplate-scale-leather.webp", weight: "medium", guard: 2, tier: 2, drop: B("Apex Predator"),
    resistances: ["thermal"], tags: ["coat", "hide"], effect: "Medium, Inlaid: Guard +3, resists thermal. Needs Bracing. The hide of the thing that ate the things that ate people.",
    flavor: "Still warm. It is always still warm.", lore: "Whoever skinned the Apex Predator did it fast and did not stay. The hide holds heat the way the animal did, and whatever the animal was immune to, you are now a little immune to, and whatever it was afraid of, you will be afraid of too.", signature: "Still warm.", materialOf: ["apex-hide", "sinew", "hex-inlay"] }),
  armor({ id: ID.mall_vest, name: "Mall Security Vest", grade: 1, img: "icons/equipment/chest/vest-cloth-tattered-orange.webp", weight: "light", guard: 2, tier: 2,
    tags: ["vest", "security", "crown-mall"], effect: "Light, Inlaid: Guard +3. Needs Fitting. The Tanneritos gave it to you so that you would never, ever wear it like a mall cop.",
    flavor: "SECURITY, in letters that have started to mean something else.", lore: "Crown Mall issue, 2077, hi-vis gone to amber. The Tanneritos keep one as a reminder of what not to be and give it away when they make peace, because nothing makes a person less of a cop than being handed the vest by the kids. The inlay is theirs. It is very good inlay.", signature: "Given by the kids. That is the whole bonus.", materialOf: ["hi-vis-nylon", "kevlar-weave", "hex-inlay"] }),
  armor({ id: "hH0DrownedCoat01", name: "Drowned Coat", grade: 2, img: "icons/equipment/chest/coat-trench-brown.webp", weight: "medium", guard: 1, resolve: 1, tier: 3, drop: B("The Ferryman of the Drowned South"),
    resistances: ["chemical"], tags: ["coat", "revenant", "river"], effect: "Medium, Circuited: Guard +3, Resolve +3, resists chemical; attunes to one wearer. Needs Bracing. It is always wet and it never drips.",
    flavor: "Wet to the touch. Dry where it hangs.", lore: "The Ferryman wore it across the Drowned South for two hundred years and never once came out dry, and never once dripped. The circuit of sigils down the back is the river's own, which is why the water in the coat does you no harm and the river does less.", signature: "Wet. Never drips.", materialOf: ["oilcloth", "river-sigils", "hex-glyph-plate", "wardiron"] }),
  armor({ id: "hH0CompliancePl1", name: "Compliance Plate", grade: 2, img: "icons/equipment/chest/breastplate-metal-scaled-grey.webp", weight: "heavy", guard: 3, evasion: -1, tier: 3, drop: B("Compliance Engine PRIME"),
    resistances: ["electrical"], tags: ["plate", "construct", "pre-fall"], effect: "Heavy, Circuited: Guard +5, Evasion −1, resists electrical; attunes to one wearer. Needs Plating. Every plate is stamped COMPLIANT.",
    flavor: "It is compliant. You, in it, are compliant. Something approves.", lore: "Cut from the Engine's own shell by someone with a long week ahead of them. The plates still carry the stamp and the stamp still carries the charge, and the charge is why nothing electrical gets through, and also why you will sometimes hear a small, satisfied click when you obey a sign.", signature: "Click.", materialOf: ["engine-shell", "hex-glyph-plate", "rivet-plate", "compliance-stamp"] }),
  armor({ id: "hH0ManagerBlazer", name: "Regional Manager's Blazer", grade: 3, img: "icons/equipment/chest/coat-collared-red-gold.webp", weight: "light", guard: 1, resolve: 2, tier: 4, drop: B("Gerald, Assistant Regional Manager of the Apocalypse"),
    tags: ["blazer", "capstone", "apocalypse"], effect: "Light, Crowned: Guard +4, Resolve +5; soulbound. Needs Fitting. Gerald's blazer, with Gerald's name in the collar crossed out and yours, somehow, written in.",
    flavor: "Dry clean only. The world ended and it is still dry clean only.", lore: "Gerald wore it to the end of everything and it has not a mark on it. Put it on and the collar already has your name, in Gerald's handwriting, which you have never seen, and the Apocalypse (Region 4) treats you as the person it reports to. It is soulbound. It was always going to be.", signature: "Your name is already in the collar.", materialOf: ["worsted", "shoulder-pad", "a-true-name", "regional-authority"] }),
  armor({ id: ID.hoodie, name: "Trick-or-Treater's Hoodie", grade: 1, img: "icons/equipment/back/cloak-hooded-blue.webp", weight: "light", guard: 1, evasion: 1, tier: 2,
    tags: ["hoodie", "grief-towns", "soft-landing"], effect: "Light, Inlaid: Guard +2, Evasion +2. Needs Fitting. A kid's hoodie, grown to fit you, left at the castle with the shoes.",
    flavor: "The pockets are full of candy. The candy is fine. Do not think about the candy.", lore: "Soft Landing. When you went first and grieved with them, somebody left this on the kerb for you, folded, the way a parent folds a thing for a kid who will not fold it. It fits whoever grieves honestly. The inlay in the drawstrings is the Mayor's own needlework.", signature: "It fits whoever grieves honestly.", materialOf: ["fleece", "drawstring", "hex-inlay", "fun-size"] })
];

/* ─── receipts (courtly-secrets templates) ─────────────────────────────────────────────────────────────────── */
const SECRETS = [
  { id: "hH0RecRecess0001", name: "A Recess, Called by Nobody",        key: "recess",        img: "icons/sundries/documents/document-sealed-signatures-red.webp", text: "Somebody rings a bell that is not on the agenda, and the whole court stops to listen to a train leave. Nobody loses anything in the next exchange — Influence stands where it was; scandal, Suspicion and marks still happen.", play: "the next exchange deals no Influence damage to either side." },
  { id: "hH0RecStrike0001", name: "The Room Remembers Differently",    key: "strikeRecord",  img: "icons/sundries/documents/document-torn-diagram-tan.webp", text: "A page comes out of the minutes so cleanly that everyone agrees it was never there. Influence, Suspicion, scandal and the round go back to before the last exchange; the marks spent in it stay spent.", play: "strike the last exchange from the record." },
  { id: "hH0RecPrice00001", name: "The Price List",                    key: "namePrice",     img: "icons/sundries/documents/document-writing-brown.webp", text: "Filed under WEATHER: who in this court wants what, and what it costs. Every courtier's favor toward both sides, and the court bonus each side carries, whispered to you alone.", play: "every courtier's favor, both sides, whispered to you." },
  { id: "hH0RecCounter001", name: "Counterfeit Truth, Notarized",      key: "counterfeit",   img: "icons/sundries/documents/document-sealed-brown-red.webp", text: "A notary's seal on a thing nobody said. Your next stolen receipt plays as earned — no Suspicion, and the one you took it from never learns who carried it.", play: "your next stolen receipt plays as earned." },
  { id: "hH0RecAgenda0001", name: "The Agenda, Amended in Pencil",     key: "rewriteStake",  img: "icons/sundries/documents/document-bound-white-tan.webp", text: "The word at the top of the page is crossed out and another written above it in a hand everyone recognises. Change what this Parley is for — Persuade, Deceive, or Stay unnoticed.", play: "rewrite the stake — change what this Parley is for." },
  { id: "hH0RecWrit000001", name: "Sovereign Writ",                    key: "decree",        img: "icons/sundries/scrolls/scroll-bound-sealed-red-gold.webp", text: "A writ with a seal older than the court. Produce it and the next exchange is simply yours — the dice are read, and the record says you won by at least three.", play: "you win the next exchange outright." },
  { id: "hH0RecDrinks0001", name: "Round of Drinks on the House",      key: "favorAllPlus1", img: "icons/consumables/drinks/alcohol-beer-stein-wooden-brown.webp", text: "Somebody is paying and it is you. Every courtier at the table warms to your side by one.", play: "+1 Favor with every courtier, your side." },
  { id: "hH0RecPickpock01", name: "The Pickpocket's Apology",          key: "discardStolen", img: "icons/sundries/documents/envelope-sealed-red-white.webp", text: "A note in the opponent's pocket where a secret used to be: SORRY. They discard a stolen receipt at random.", play: "your opponent discards a random stolen receipt." },
  { id: "hH0RecAudit00001", name: "Audit Notice",                      key: "freezePurse",   img: "icons/sundries/documents/document-official-capital.webp", text: "Every purse at the table is frozen pending review. No marks may be spent by either side next exchange.", play: "no marks may be spent by either side next exchange." }
].map((s, i) => ({ _id: s.id, name: s.name, type: "feat", img: s.img,
  system: { category: "technique", source: "", tags: ["halloween-hoard"], description: { value: p(`<strong>${s.name}.</strong> ${s.text}`) + p(`<em>Play:</em> ${s.play}`), chat: "", unidentified: "" } },
  flags: { "bbttcc-raid": { secret: { effectKey: s.key, acquisition: "template", acquiredAt: 0, raidId: "" } } },
  effects: [], folder: null, sort: 3100000 + i * 100000, ownership: { default: 0 }, _stats: stats, _key: `!items!${s.id}` }));

for (const s of SECRETS) if (!idOk(s._id)) throw new Error(`bad secret id ${s._id}`);
const docs = ITEMS.map(x => x.d);
const names = new Set(); for (const d of docs) { if (names.has(d.name)) throw new Error(`duplicate name ${d.name}`); names.add(d.name); }
const DROPS = ITEMS.filter(x => x.drop).map(x => ({ npc: x.drop, itemId: x.d._id, itemName: x.d.name }));

/* ─── write: _source ───────────────────────────────────────────────────────────────────────────────────────── */
const writeSource = (dir, d) => {
  const have = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  const prev = have.find(f => f.endsWith(`_${d._id}.json`));
  fs.writeFileSync(path.join(dir, prev ?? `${d.name.replace(/[^A-Za-z0-9]/g, "_")}_${d._id}.json`), JSON.stringify(d, null, 2) + "\n");
};
for (const d of docs) writeSource(SRC_ITEMS, d);
for (const s of SECRETS) writeSource(SRC_SECRETS, s);
if (DUMP) fs.writeFileSync(DUMP, docs.map(d => JSON.stringify({ k: d._key, v: (({ _key, ...rest }) => rest)(d) })).join("\n") + "\n");

/* ─── write: the seed macro ────────────────────────────────────────────────────────────────────────────────── */
const seedItems = docs.map(d => (({ _key, ...rest }) => rest)(d));
const seedSecrets = SECRETS.map(d => (({ _key, ...rest }) => rest)(d));
fs.writeFileSync(OUT_SEED, `/* seed-halloween-hoard-${STAMP}.macro.js — THE HALLOWEEN HOARD seed (GENERATED ${STAMP} by build-halloween-hoard.mjs — do not hand-edit; rebuild).
 * Run from a GM seat on EMBER (then on the foundry instance). DRY_RUN = true prints the plan and writes nothing; flip to false to create.
 * What: ${seedItems.length} items → bbttcc-master-content.items in the folder "${FOLDER.name}" (created, fixed id) · ${seedSecrets.length} receipt templates →
 *       bbttcc-master-content.courtly-secrets · ${DROPS.length} boss drops onto the pack NPC docs AND every world actor of the same name (corpse loot shows them).
 *       A name already in a pack is skipped; ids are kept (repo _source == live). Then run patch-halloween-hoard-${STAMP}.macro.js for the campaign.
 */
const DRY_RUN = true;
const FOLDER = ${JSON.stringify(FOLDER)};
const ITEMS = ${JSON.stringify(seedItems, null, 1)};
const SECRETS = ${JSON.stringify(seedSecrets, null, 1)};
const DROPS = ${JSON.stringify(DROPS, null, 1)};
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const log = []; let created = 0, skipped = 0, dropped = 0;
  const unlock = async (pack, fn) => { const was = pack.locked; try { if (!DRY_RUN && was) await pack.configure({ locked: false }); return await fn(); } finally { if (!DRY_RUN && was) await pack.configure({ locked: true }); } };
  // 1 · items
  const ipack = game.packs.get("bbttcc-master-content.items"); if (!ipack) return ui.notifications.error("No items pack");
  await unlock(ipack, async () => {
    const index = await ipack.getIndex(); const have = new Set(index.map(i => i.name)); const haveId = new Set(index.map(i => i._id));
    let folder = ipack.folders.get(FOLDER.id) ?? ipack.folders.find(f => f.name === FOLDER.name);
    if (!folder) { log.push(\`\${DRY_RUN ? "·" : "✔"} folder "\${FOLDER.name}"\`); if (!DRY_RUN) [folder] = await Folder.createDocuments([{ _id: FOLDER.id, name: FOLDER.name, type: "Item", color: "#d4791f", sorting: "m" }], { pack: ipack.collection, keepId: true }); }
    const fresh = [];
    for (const v of ITEMS) {
      if (have.has(v.name) || haveId.has(v._id)) { log.push(\`· skip \${v.name} — already in the pack\`); skipped++; continue; }
      const r = v.flags.fourththing.rfi.item;
      log.push(\`\${DRY_RUN ? "·" : "✔"} [\${v.type}] \${v.name}  T\${r.tier} \${r.frame} \${r.price.marks} \${r.price.currency} marks · \${v.img}\`);
      fresh.push({ ...v, folder: folder?.id ?? FOLDER.id });
    }
    if (!DRY_RUN && fresh.length) { const made = await Item.createDocuments(fresh, { pack: ipack.collection, keepId: true }); created += made.length; } else created += fresh.length;
  });
  // 2 · receipts
  const spack = game.packs.get("bbttcc-master-content.courtly-secrets"); if (!spack) return ui.notifications.error("No courtly-secrets pack");
  await unlock(spack, async () => {
    const index = await spack.getIndex(); const have = new Set(index.map(i => i.name)); const haveId = new Set(index.map(i => i._id));
    const fresh = SECRETS.filter(v => { if (have.has(v.name) || haveId.has(v._id)) { log.push(\`· skip receipt \${v.name}\`); skipped++; return false; } log.push(\`\${DRY_RUN ? "·" : "✔"} [receipt] \${v.name} → \${v.flags["bbttcc-raid"].secret.effectKey}\`); return true; });
    if (!DRY_RUN && fresh.length) { const made = await Item.createDocuments(fresh, { pack: spack.collection, keepId: true }); created += made.length; } else created += fresh.length;
  });
  // 3 · boss drops — pack NPC docs + world actors by name (the item is a clone of the pack record; the corpse vault shows weapon/armor/gear)
  const byId = new Map(ITEMS.map(v => [v._id, v]));
  const npack = game.packs.get("bbttcc-master-content.npcs");
  const npcIndex = npack ? await npack.getIndex() : [];
  await unlock(npack ?? ipack, async () => {
    for (const d of DROPS) {
      const data = foundry.utils.deepClone(byId.get(d.itemId)); delete data._id; delete data.folder; delete data.sort; delete data.ownership; delete data._stats;
      foundry.utils.setProperty(data, "flags.bbttcc-master-content.hoardDrop", { itemId: d.itemId, stamp: "${STAMP}" });
      const targets = [];
      const idx = npcIndex.find(i => i.name === d.npc); if (idx && npack) { const a = await npack.getDocument(idx._id); if (a) targets.push(a); } else log.push(\`⚠ pack NPC "\${d.npc}" not found\`);
      for (const a of game.actors.filter(a => a.name === d.npc)) targets.push(a);
      for (const a of targets) {
        if (a.items.some(it => it.name === d.itemName)) { log.push(\`· \${a.name} (\${a.pack ? "pack" : "world"}) already carries \${d.itemName}\`); continue; }
        log.push(\`\${DRY_RUN ? "·" : "✔"} drop \${d.itemName} → \${a.name} (\${a.pack ? "pack" : "world"})\`);
        if (!DRY_RUN) await a.createEmbeddedDocuments("Item", [data]); dropped++;
      }
    }
  });
  console.log(\`[seed-halloween-hoard] \${DRY_RUN ? "DRY RUN" : "APPLIED"} — \${created} created, \${skipped} skipped, \${dropped} drops\\n\` + log.join("\\n"));
  ui.notifications.info(\`seed-halloween-hoard \${DRY_RUN ? "dry run" : "applied"}: \${created} created, \${skipped} skipped, \${dropped} drops — see console (F12).\`);
  return { created, skipped, dropped, log };
})();
`);

/* ─── write: the campaign patch macro (inlines the pure module) ───────────────────────────────────────────── */
const pure = fs.readFileSync(PATCH_SRC, "utf8").replace(/^export const /gm, "const ").replace(/^export function /gm, "function ");
fs.writeFileSync(OUT_PATCH, `/* patch-halloween-hoard-${STAMP}.macro.js — THE HALLOWEEN HOARD campaign patch (GENERATED ${STAMP} by build-halloween-hoard.mjs from
 * halloween-hoard-campaign-patch.mjs — do not hand-edit; rebuild). Run AFTER seed-halloween-hoard-${STAMP}.macro.js (the quest items clone
 * pack records by uuid). GM only; DRY_RUN default true; idempotent; backs up \`campaigns\` to a download first.
 * Adds: the Sparky costume (one piece per grief town + Proof of Purchase at Miss June), 10 quest rewards, 7 reality-bending receipts.
 */
${pure}
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));   // true copy (never deepClone a setting — 2026-10-22)
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(\`Active campaign '\${campaignId}' not found.\`);
  const { changes, report } = applyHoardPatch(camp, HOARD_DEFAULT);
  console.log(\`[halloween-hoard ${STAMP}] \${DRY_RUN ? "DRY RUN" : "APPLY"} — \${changes} change(s)\\n\` + report.join("\\n"));
  if (DRY_RUN) return ui.notifications.info(\`DRY RUN — \${changes} change(s); see console.\`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", \`campaigns-backup-pre-halloween-hoard-\${Date.now()}.json\`); } catch (e) { console.warn(e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(\`Applied \${changes} change(s) — the hoard is in the towns.\`);
})();
`);

console.log(`[build-halloween-hoard] ${docs.length} items, ${SECRETS.length} receipts, ${DROPS.length} drops`);
for (const d of docs) { const r = d.flags.fourththing.rfi.item; console.log(`  ${d.type.padEnd(6)} ${d.name.padEnd(46)} T${r.tier.padEnd(3)} ${String(r.price.marks).padStart(5)} ${r.price.currency.padEnd(9)} ${d.flags.fourththing.grade ? d.flags.fourththing.grade.name : ""}${d.flags.fourththing.working ? " ⟡" + d.flags.fourththing.working.power.name : ""}`); }
console.log(`→ ${path.relative(ROOT, OUT_SEED)}\n→ ${path.relative(ROOT, OUT_PATCH)}\n→ _source: ${path.relative(ROOT, SRC_ITEMS)} / ${path.relative(ROOT, SRC_SECRETS)}${DUMP ? `\n→ dump ${DUMP}` : ""}`);

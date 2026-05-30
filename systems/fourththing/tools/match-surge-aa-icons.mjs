#!/usr/bin/env node
// match-surge-aa-icons.mjs
// Reads the 136 Surge ability source JSONs, the BBTTCC Button Icons library, and a
// verified JB2A animation palette (mined from dnd5e-animations/autorec.json). For each
// ability it picks (1) the best-matching button icon -> system img, and (2) an
// Automated Animations v7 flags.autoanimations config (menu + primary.video), driven by
// surgeBucket + element/weapon/AoE cues + class theme priors.
//
// Output: writes /tmp/ftaa/proposal.json and /tmp/ftaa/proposal.md (review artifact).
// With --apply it ALSO stamps img + flags.autoanimations into the source JSONs in place.
//
// Usage:
//   node tools/match-surge-aa-icons.mjs            # dry-run, write proposal only
//   node tools/match-surge-aa-icons.mjs --apply    # also stamp source JSONs

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const APPLY = process.argv.includes("--apply");
const HOME = os.homedir();
const SRC_DIR = path.join(HOME, "systems/fourththing/packs/_source/surge-abilities");
const ICON_DIR = path.join(HOME, "Library/Application Support/FoundryVTT/Data/art/bbttcc/GOTTGAIT/BBTTCC Button Icons");
const ICON_IMG_PREFIX = "art/bbttcc/GOTTGAIT/BBTTCC Button Icons"; // Foundry-relative img path
const OUT_DIR = "/tmp/ftaa";
fs.mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Verified JB2A animation palette (every video config below ships as a working
// dnd5e-animations preset, so it is guaranteed to resolve in the Sequencer DB).
// menu = AA category; video = primary.video {dbSection,menuType,animation,variant,color}.
// ---------------------------------------------------------------------------
const V = (dbSection, menuType, animation, variant, color) => ({ dbSection, menuType, animation, variant, color, enableCustom: false, customPath: "" });
const PALETTE = {
  // --- ranged offence (source -> target bolt/ray/beam) ---
  fire_bolt:     { menu: "range", v: V("range", "spell", "firebolt", "01", "orange") },
  scorch:        { menu: "range", v: V("range", "spell", "scorchingray", "01", "orange") },
  frost_ray:     { menu: "range", v: V("range", "spell", "rayoffrost", "01", "blue") },
  holy_bolt:     { menu: "range", v: V("range", "spell", "guidingbolt", "01", "yellow") },
  force_missile: { menu: "range", v: V("range", "spell", "magicmissile", "01", "purple") },
  eldritch:      { menu: "range", v: V("range", "spell", "eldritchblast", "01", "purple") },
  chromatic:     { menu: "range", v: V("range", "spell", "guidingbolt", "02", "random") },
  arrow:         { menu: "range", v: V("range", "weapon", "arrow", "regular", "regular") },
  // --- melee offence (swing) ---
  sword:         { menu: "melee", v: V("melee", "weapon", "sword", "01", "white") },
  club:          { menu: "melee", v: V("melee", "weapon", "club", "01", "white") },
  dagger:        { menu: "melee", v: V("melee", "weapon", "dagger", "01", "white") },
  fist:          { menu: "melee", v: V("melee", "weapon", "unarmedstrike", "physical", "yellow") },
  // --- area / template offence ---
  cone_cold:     { menu: "templatefx", v: V("templatefx", "cone", "coneofcold", "01", "blue") },
  lightning:     { menu: "templatefx", v: V("templatefx", "ray", "lightningbolt", "01", "blue") },
  shatter:       { menu: "templatefx", v: V("templatefx", "circle", "shatter", "01", "orange") },
  evocation:     { menu: "templatefx", v: V("templatefx", "circle", "magicsign", "evocation", "red") },
  // --- on-token: heals ---
  heal:          { menu: "ontoken", v: V("static", "spell", "curewounds", "01", "blue") },
  heal_generic:  { menu: "ontoken", v: V("static", "spell", "generichealing", "01", "blue") },
  // --- on-token: defensive wards/shields ---
  shield_ice:    { menu: "ontoken", v: V("static", "shieldfx", "ice", "03", "purple") },
  frost_impact:  { menu: "ontoken", v: V("static", "impact", "frost", "01", "blue") },
  // --- on-token: buffs (narrative / support) ---
  bless:         { menu: "ontoken", v: V("static", "spell", "bless", "intro", "yellow") },
  bless_loop:    { menu: "ontoken", v: V("static", "spell", "bless", "loop", "purple") },
  divine_buff:   { menu: "ontoken", v: V("static", "spell", "divinesmite", "source", "yellowwhite") },
  music:         { menu: "ontoken", v: V("static", "music", "notes", "01", "purple") },
  sacred:        { menu: "ontoken", v: V("static", "spell", "sacredflame", "target", "yellow") },
  // --- on-token: debuffs ---
  curse:         { menu: "ontoken", v: V("static", "spell", "divinesmite", "source", "darkpurple") },
  fear:          { menu: "ontoken", v: V("static", "conditions", "fear", "02", "darkpurple") },
  hold:          { menu: "ontoken", v: V("static", "magicsign", "enchantment", "02", "purple") },
  necro:         { menu: "ontoken", v: V("static", "spell", "tollthedead", "skull", "green") },
  explosion:     { menu: "ontoken", v: V("static", "generic", "explosion", "01", "red") },
};

// ---------------------------------------------------------------------------
// Element / cue detection -> picks the palette tag.
// ---------------------------------------------------------------------------
const ELEMENTS = [
  { tag: "fire",     re: /\b(fire|flame|burn|burning|blaze|inferno|ember|scorch|pyre|forge|furnace|incinerat|combust)\b/i },
  { tag: "cold",     re: /\b(frost|ice|cold|freeze|frozen|glacial|chill|winter|rime)\b/i },
  { tag: "lightning",re: /\b(lightning|shock|thunder|storm|spark|volt|electric|arc)\b/i },
  { tag: "force",    re: /\b(force|kinetic|telekine|gravity|push|slam|impact|concuss|shockwave|repuls)\b/i },
  { tag: "radiant",  re: /\b(radiant|holy|sacred|divine|light|dawn|sun|halo|blessed|luminous|gold)\b/i },
  { tag: "necrotic", re: /\b(necrotic|decay|rot|wither|death|skull|grave|drain|blight|corrupt|ruin)\b/i },
  { tag: "psychic",  re: /\b(psychic|mind|mental|dream|phase|nightmare|trance|memory|thought|psi)\b/i },
  { tag: "poison",   re: /\b(poison|acid|venom|spore|toxic|gas|corrode|blight)\b/i },
  { tag: "sonic",    re: /\b(sonic|sound|voice|word|shout|scream|resonan|vibrat|hymn|song)\b/i },
];
const MELEE_CUE  = /\b(strike|slash|cleave|blade|sword|hew|swing|melee|hack|chop|gut|stab|lunge|smash|slam|hammer|fist|punch|claw|rend|maul|crush|pummel|bash)\b/i;
const RANGED_CUE = /\b(bolt|ray|beam|blast|hurl|throw|thrown|fling|launch|shoot|fire a|gun|arrow|missile|dart|lob|project|lance|streak)\b/i;
const AOE_CUE    = /\b(cone|burst|nova|wave|every (foe|enemy|creature)|all (foes|enemies)|area|aura|radius|blast (out|all)|quake|erupt|explod|sweep|shatter|within \d|around (you|the))\b/i;

// element tag -> palette tags by mode
const RANGE_BY_ELEM = { fire: "fire_bolt", cold: "frost_ray", lightning: "lightning", force: "force_missile", radiant: "holy_bolt", necrotic: "eldritch", psychic: "eldritch", poison: "chromatic", sonic: "shatter" };
const AOE_BY_ELEM   = { fire: "shatter", cold: "cone_cold", lightning: "lightning", force: "shatter", radiant: "evocation", necrotic: "necro", psychic: "evocation", poison: "shatter", sonic: "shatter" };
const MELEE_BY_ELEM = { fire: "sword", cold: "sword", lightning: "sword", force: "club", radiant: "sword", necrotic: "dagger", psychic: "fist", poison: "dagger", sonic: "club" };
const DEBUFF_BY_ELEM = { necrotic: "necro", psychic: "hold", cold: "frost_impact", fire: "explosion", radiant: "sacred", sonic: "fear", force: "explosion", poison: "necro", lightning: "explosion" };

function detectElement(text) {
  for (const e of ELEMENTS) if (e.re.test(text)) return e.tag;
  return null;
}

function chooseAnim(a) {
  const text = `${a.name}. ${a.desc}`;
  const elem = detectElement(text);
  if (a.bucket === "heal") return /\b(ward|barrier|shield|armor|brace)\b/i.test(text) ? "shield_ice" : "heal";
  if (a.bucket === "def") {
    if (elem === "cold") return "frost_impact";
    return "shield_ice";
  }
  if (a.bucket === "narr") {
    if (/\b(fear|terror|dread|panic)\b/i.test(text)) return "fear";
    if (/\b(curse|hex|mark|doom|sentence|writ)\b/i.test(text)) return "curse";
    if (/\b(hold|bind|stop|freeze|lock|still|root|paraly)\b/i.test(text)) return "hold";
    if (/\b(word|voice|song|hymn|speak|name|notes|music)\b/i.test(text)) return "music";
    return "bless";
  }
  // bucket === "off"
  if (AOE_CUE.test(text)) return AOE_BY_ELEM[elem] || "shatter";
  if (MELEE_CUE.test(text) && !RANGED_CUE.test(text)) return MELEE_BY_ELEM[elem] || "sword";
  if (RANGED_CUE.test(text)) return RANGE_BY_ELEM[elem] || "force_missile";
  // default offence: element-coloured bolt, else force missile
  return RANGE_BY_ELEM[elem] || "force_missile";
}

// ---------------------------------------------------------------------------
// Icon matching.
// ---------------------------------------------------------------------------
const STOP = new Set("icon icons button bbttcc the of a an and or to with your you for in on at is be as it from into background removed png webp jpg".split(" "));
function tokens(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter(t => t && t.length > 2 && !STOP.has(t));
}

// class -> preferred icon-stem keyword families (heavy boost when an icon contains one)
function classKey(cls) {
  const c = (cls || "").toLowerCase();
  if (c.includes("bulwark") || c.includes("avalanche") || c.includes("cataclyst") || c.includes("mountain"))
    return ["wall","rampart","titan","titanbound","anvil","mountain","siege","fist_wall","brick","earthquake","stone","bunker","shield","defense","force_field","breaker","smash"];
  if (c.includes("harmony") || c.includes("accord") || c.includes("overwatch") || c.includes("resolve") || c.includes("mandate"))
    return ["marshall","harmonymarshal","flag","crowd_control","peace","shout","military","throne","holy_symbol","people","command","star","checkmark"];
  if (c.includes("soul smith") || c.includes("forge") || c.includes("bound light") || c.includes("victory") || c.includes("reclaimer"))
    return ["forge","anvil","smith","furnace","crucible","hammer","bellows","aurablade","heart_metal","blade","sun","greataxe","gauntlet"];
  if (c.includes("linguist") || c.includes("annotator") || c.includes("metaphor") || c.includes("redactor"))
    return ["quill","scroll","punctuation","eraser","speech","book","spellbook","sigil","decomm","mirror"];
  if (c.includes("dream") || c.includes("quiet sun") || c.includes("sapphire") || c.includes("thousand faces") || c.includes("trance"))
    return ["dream","moon","sleep","mask","multiple_personas","mirror","sapphire","star","spirit","portal"];
  if (c.includes("pactkeeper") || c.includes("archivist") || c.includes("auditor") || c.includes("steward"))
    return ["safe","key","scroll","holy_restriction","contain","throne","holy_symbol","mask","book","crown","checkmark"];
  if (c.includes("courier") || c.includes("black stair") || c.includes("last mile") || c.includes("wayfarer") || c.includes("route"))
    return ["ghostly_runner","mystic_runner","run","step","road","escape","cloak","stealth","speed","tunnel","fly","wind"];
  if (c.includes("wyrdlens") || c.includes("foresight") || c.includes("mercy") || c.includes("truth") || c.includes("refraction"))
    return ["wyrdlens","single_eye","eyes","mirror","magnifying","surveillance","holy_ray","ray","spark","star"];
  return [];
}

// generic theme word -> icon-stem hints (helps general + cross-class)
const THEME_HINTS = [
  [/\b(heal|mend|restore|recover|patch|stitch|cure|soothe|repair)\b/i, ["heart","hearth","chalice","tree_of_life","leaf","holy","cauldron"]],
  [/\b(shield|ward|guard|protect|defen|barrier|aegis|bulwark|cover)\b/i, ["shield","defense","force_field","wall","armor","rampart"]],
  [/\b(fire|flame|burn|forge|furnace)\b/i, ["flame","fire","forge","furnace","explosion","phoenix","volcano"]],
  [/\b(frost|ice|cold|freeze)\b/i, ["black_ice","ice","frost","dream_ice"]],
  [/\b(lightning|shock|storm|thunder|spark)\b/i, ["dream_lightning","storm","spark","energy_blast","weather"]],
  [/\b(fear|terror|dread|panic)\b/i, ["fear","skull","monster","nightmare","mask"]],
  [/\b(curse|hex|doom|mark|sentence)\b/i, ["hex","skull","compulsion","dominated","sigil"]],
  [/\b(move|dash|run|step|teleport|blink|escape|flee|speed|swift)\b/i, ["run","step","escape","ghostly_runner","speed","fly","wind","road"]],
  [/\b(eye|see|sight|reveal|foresee|truth|vision|scry|detect)\b/i, ["single_eye","eyes","magnifying","surveillance","mirror"]],
  [/\b(word|voice|speak|name|song|hymn|shout|music|sound)\b/i, ["speech","shout","music","punctuation","quill"]],
  [/\b(bind|hold|lock|contain|trap|chain|stop|root)\b/i, ["contain","net","safe","key","web","holy_restriction"]],
  [/\b(force|push|slam|kinetic|impact|smash|crush|shock)\b/i, ["fist_crush","smash_wall","shockwave","push","fist_wall"]],
  [/\b(light|holy|sacred|divine|dawn|sun|blessed|radian)\b/i, ["holy_ray","holy_symbol","sun","sunrise","star","forge_sun"]],
  [/\b(blood|sacrifice|vein|hymn)\b/i, ["blood_hymn","heart","blood_drop"]],
  [/\b(dream|sleep|nightmare|trance|lucid)\b/i, ["dream","sleep","moon","spirit"]],
  [/\b(quake|earth|stone|rock|ground|tremor)\b/i, ["earthquake","cracked_stone","stone_sphere","mountain","cave"]],
  [/\b(blade|sword|cut|slash|edge|sever)\b/i, ["blade","sword","saber","void_edge","aurablade","axe"]],
  [/\b(crew|ally|allies|team|squad|companion|crowd|people)\b/i, ["people","crowd_control","flag","marshall"]],
];

let ICONS = null;
function loadIcons() {
  if (ICONS) return ICONS;
  const files = fs.readdirSync(ICON_DIR).filter(f => /\.(png|webp|jpg|svg)$/i.test(f));
  ICONS = files.map(f => {
    const stem = f.replace(/\.(png|webp|jpg|svg)+$/i, "")
                  .replace(/^BBTTCC[_ ]button[_ ]icon[_ ]/i, "")
                  .replace(/^bbttcc[_ ]icons?[_ ]/i, "")
                  .replace(/\bbackground removed\b/i, "")
                  .replace(/[_ ]+/g, " ").trim();
    return { file: f, stem, toks: new Set(tokens(stem)) };
  });
  return ICONS;
}

function chooseIcon(a) {
  const icons = loadIcons();
  const cls = classKey(a.cls);
  const abilTok = new Set([...tokens(a.name), ...tokens(a.desc)]);
  const text = `${a.name}. ${a.desc}`;
  const themeStems = [];
  for (const [re, stems] of THEME_HINTS) if (re.test(text)) themeStems.push(...stems);
  let best = null, bestScore = -1;
  for (const ic of icons) {
    let score = 0;
    // direct token overlap with ability name/desc (name words weigh more)
    for (const t of ic.toks) {
      if (tokens(a.name).includes(t)) score += 6;
      else if (abilTok.has(t)) score += 3;
    }
    // class prior
    for (const k of cls) if (ic.stem.includes(k)) { score += 4; break; }
    // theme hints
    for (const k of themeStems) if (ic.stem.includes(k)) { score += 3; }
    // small penalty for very generic stems so specific art wins ties
    if (/(^| )(icon|frame|background|logos?|texture)( |$)/.test(ic.stem)) score -= 5;
    if (score > bestScore) { bestScore = score; best = ic; }
  }
  return { icon: best, score: bestScore };
}

// ---------------------------------------------------------------------------
// AA flag builder (full v7 schema, from a real working item template).
// ---------------------------------------------------------------------------
function buildAAFlags(animTag, a) {
  const p = PALETTE[animTag];
  const sound = { enable: false, delay: 0, repeat: 1, repeatDelay: 250, startTime: 0, volume: 0.75 };
  const baseOpt = { contrast: 0, delay: 0, elevation: 1000, isWait: false, opacity: 1, playbackRate: 1, repeat: 1, repeatDelay: 250, saturate: 0, size: 1, tint: false, tintColor: "#FFFFFF", zIndex: 1 };
  const offOpt  = { addTokenWidth: false, anchor: "0.5", contrast: 0, delay: 0, elevation: 1000, fadeIn: 250, fadeOut: 500, isMasked: false, isRadius: false, isWait: false, opacity: 1, repeat: 1, repeatDelay: 250, saturate: 0, size: 1, tint: false, tintColor: "#FFFFFF", zIndex: 1 };
  const off = (en) => ({ enable: en, video: V("static", "spell", "curewounds", "01", "blue"), sound: { ...sound }, options: { ...offOpt } });
  return {
    id: `ft-${a.surgeKey}`,
    label: a.name,
    macro: { enable: false, playWhen: "0" },
    menu: p.menu,
    primary: { video: { ...p.v }, sound: { ...sound }, options: { ...baseOpt } },
    secondary: off(false),
    soundOnly: { sound: { ...sound } },
    source: off(false),
    target: off(false),
    isEnabled: true,
    isCustomized: true,
    fromAmmo: false,
    version: 5,
  };
}

// ---------------------------------------------------------------------------
// Run.
// ---------------------------------------------------------------------------
// Optional curated refinements (surgeKey -> {iconFile, animTag, reason}) that override
// the deterministic picks. Produced by the LLM refinement pass.
let REFINE = {};
const refPath = "/tmp/ftaa/refinements.json";
if (fs.existsSync(refPath)) {
  for (const r of JSON.parse(fs.readFileSync(refPath, "utf8"))) REFINE[r.surgeKey] = r;
  console.log(`Loaded ${Object.keys(REFINE).length} curated refinements.`);
}

const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith(".json"));
const stripHtml = s => (s || "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
const proposal = [];
for (const f of files) {
  const full = path.join(SRC_DIR, f);
  const d = JSON.parse(fs.readFileSync(full, "utf8"));
  const ft = d.flags?.fourththing || {};
  const a = { file: f, surgeKey: ft.surgeKey, name: d.name, cls: ft.surgeClass, bucket: ft.surgeBucket,
              cost: ft.surgeCost, tier: ft.surgeTier, desc: stripHtml(d.system?.description?.value) };
  const ref = REFINE[a.surgeKey];
  let animTag, iconFile, score, reason = "";
  if (ref && PALETTE[ref.animTag] && fs.existsSync(path.join(ICON_DIR, ref.iconFile))) {
    animTag = ref.animTag; iconFile = ref.iconFile; score = 999; reason = ref.reason || "";
  } else {
    animTag = chooseAnim(a);
    const picked = chooseIcon(a);
    iconFile = picked.icon.file; score = picked.score;
  }
  const aaFlags = buildAAFlags(animTag, a);
  const imgPath = `${ICON_IMG_PREFIX}/${iconFile}`;
  proposal.push({ ...a, animTag, animMenu: PALETTE[animTag].menu, anim: Object.values(PALETTE[animTag].v).slice(0,5).filter(Boolean).join("."),
                  iconFile, iconScore: score, imgPath, reason });
  if (APPLY) {
    d.img = imgPath;
    d.flags = d.flags || {};
    d.flags.autoanimations = aaFlags;
    fs.writeFileSync(full, JSON.stringify(d, null, 2));
  }
}

fs.writeFileSync(path.join(OUT_DIR, "proposal.json"), JSON.stringify(proposal, null, 2));

// markdown table grouped by class
proposal.sort((x, y) => (x.cls || "").localeCompare(y.cls || "") || (x.bucket || "").localeCompare(y.bucket || ""));
let md = `# Surge AA + Icon proposal (${proposal.length} abilities)\n\n`;
let curCls = null;
for (const p of proposal) {
  if (p.cls !== curCls) { curCls = p.cls; md += `\n## ${curCls}\n\n| Ability | Bkt | Icon | Animation | Why |\n|---|---|---|---|---|\n`; }
  const ico = p.iconFile.replace(/\.(png|webp|jpg|svg)$/i,"").replace(/^BBTTCC_button_icon_|^bbttcc_button_icon_|^bbttcc_icons?_/i,"");
  md += `| ${p.name} | ${p.bucket} | ${ico}${p.iconScore<=0?" ⚠️":""} | \`${p.animTag}\` | ${p.reason||""} |\n`;
}
fs.writeFileSync(path.join(OUT_DIR, "proposal.md"), md);

const lowConf = proposal.filter(p => p.iconScore <= 0);
console.log(`Wrote proposal for ${proposal.length} abilities.${APPLY ? " [APPLIED to source JSONs]" : " [dry-run]"}`);
console.log(`Low-confidence icon picks (score<=0): ${lowConf.length}`);
if (lowConf.length) console.log(lowConf.map(p => `  - ${p.name} (${p.cls})`).join("\n"));
console.log(`Artifacts: ${OUT_DIR}/proposal.json  ${OUT_DIR}/proposal.md`);

#!/usr/bin/env node
// build-fourththing-autorec.mjs
// Emits a fourththing Automated Animations "autorec" keyword menu: each entry's `label`
// is matched as a SUBSTRING of an item's normalized name (AA: rinsedName.includes(label)),
// so any fourththing item/manifestation/weapon whose NAME contains the keyword auto-animates
// even without per-item flags. Per-item flags still take precedence — this is the fallback layer.
//
// Output:
//   packs/_source/fourththing-autorec.json   (importable AA menu: melee/range/ontoken/templatefx)
//
// Labels are ordered specific -> generic (AA returns the FIRST bestMatch), and risky short
// labels carry excludedTerms to avoid false positives (e.g. "ice" must not match "voice").

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const OUT = path.join(os.homedir(), "systems/fourththing/packs/_source/fourththing-autorec.json");

const V = (dbSection, menuType, animation, variant, color) => ({ dbSection, menuType, animation, variant, color, enableCustom: false, customPath: "" });
const TAG = {
  fire_bolt:     { menu: "range", v: V("range", "spell", "firebolt", "01", "orange") },
  frost_ray:     { menu: "range", v: V("range", "spell", "rayoffrost", "01", "blue") },
  holy_bolt:     { menu: "range", v: V("range", "spell", "guidingbolt", "01", "yellow") },
  force_missile: { menu: "range", v: V("range", "spell", "magicmissile", "01", "purple") },
  eldritch:      { menu: "range", v: V("range", "spell", "eldritchblast", "01", "purple") },
  arrow:         { menu: "range", v: V("range", "weapon", "arrow", "regular", "regular") },
  sword:         { menu: "melee", v: V("melee", "weapon", "sword", "01", "white") },
  club:          { menu: "melee", v: V("melee", "weapon", "club", "01", "white") },
  dagger:        { menu: "melee", v: V("melee", "weapon", "dagger", "01", "white") },
  fist:          { menu: "melee", v: V("melee", "weapon", "unarmedstrike", "physical", "yellow") },
  cone_cold:     { menu: "templatefx", v: V("templatefx", "cone", "coneofcold", "01", "blue") },
  lightning:     { menu: "templatefx", v: V("templatefx", "ray", "lightningbolt", "01", "blue") },
  shatter:       { menu: "templatefx", v: V("templatefx", "circle", "shatter", "01", "orange") },
  heal:          { menu: "ontoken", v: V("static", "spell", "curewounds", "01", "blue") },
  shield_ice:    { menu: "ontoken", v: V("static", "shieldfx", "ice", "03", "purple") },
  bless:         { menu: "ontoken", v: V("static", "spell", "bless", "intro", "yellow") },
  divine_buff:   { menu: "ontoken", v: V("static", "spell", "divinesmite", "source", "yellowwhite") },
  music:         { menu: "ontoken", v: V("static", "music", "notes", "01", "purple") },
  curse:         { menu: "ontoken", v: V("static", "spell", "divinesmite", "source", "darkpurple") },
  fear:          { menu: "ontoken", v: V("static", "conditions", "fear", "02", "darkpurple") },
  hold:          { menu: "ontoken", v: V("static", "magicsign", "enchantment", "02", "purple") },
  necro:         { menu: "ontoken", v: V("static", "spell", "tollthedead", "skull", "green") },
  explosion:     { menu: "ontoken", v: V("static", "generic", "explosion", "01", "red") },
};

// label, tag, optional excludedTerms. Order = priority (specific first).
// Labels are rinsed (lowercased, non-alnum stripped) before substring matching.
const KEYWORDS = [
  // --- area / elemental (specific compound names first) ---
  ["fireball", "shatter"], ["scorching", "fire_bolt"], ["firebolt", "fire_bolt"],
  ["coneofcold", "cone_cold"], ["lightningbolt", "lightning"], ["chainlightning", "lightning"],
  ["shockwave", "shatter"], ["earthquake", "shatter"], ["thunderwave", "shatter"],
  ["inferno", "shatter"], ["eruption", "shatter"], ["cataclysm", "shatter"],
  // --- ranged bolts/guns ---
  ["eldritch", "eldritch"], ["magicmissile", "force_missile"], ["guidingbolt", "holy_bolt"],
  ["crossbow", "arrow"], ["longbow", "arrow"], ["shortbow", "arrow"],
  ["rifle", "arrow"], ["pistol", "arrow"], ["railgun", "arrow"], ["shotgun", "arrow"],
  ["arrow", "arrow"], ["bullet", "arrow"], ["sniper", "arrow"],
  // --- melee weapons ---
  ["greatsword", "sword"], ["longsword", "sword"], ["shortsword", "sword"], ["saber", "sword"],
  ["greataxe", "club"], ["warhammer", "club"], ["greatclub", "club"], ["maul", "club"],
  ["morningstar", "club"], ["gauntlet", "fist"], ["quarterstaff", "club"],
  ["dagger", "dagger"], ["stiletto", "dagger"], ["sword", "sword"], ["blade", "sword"],
  ["hammer", "club"], ["mace", "club"], ["club", "club"], ["axe", "club"],
  ["spear", "sword"], ["glaive", "sword"], ["halberd", "club"], ["whip", "sword"],
  ["punch", "fist"], ["unarmed", "fist"], ["claw", "fist"], ["fist", "fist"],
  // --- single-element cues (after compound names) ---
  ["lightning", "lightning"], ["thunder", "shatter"], ["frost", "frost_ray"],
  ["flame", "fire_bolt"], ["cinder", "fire_bolt"], ["ember", "fire_bolt"],
  ["scorch", "fire_bolt"], ["fire", "fire_bolt", ["fireform", "ceasefire"]],
  ["frostbite", "frost_ray"], ["freeze", "frost_ray"],
  ["necrotic", "necro"], ["wither", "necro"], ["decay", "necro"],
  // --- defensive wards ---
  ["bulwark", "shield_ice"], ["rampart", "shield_ice"], ["aegis", "shield_ice"],
  ["sanctum", "shield_ice"], ["sanctuary", "shield_ice"], ["barrier", "shield_ice"],
  ["forcefield", "shield_ice"], ["bastion", "shield_ice"], ["ward", "shield_ice", ["forward", "warden", "steward", "wardrobe", "award", "wayward"]],
  ["shield", "shield_ice"], ["shelter", "shield_ice"], ["brace", "shield_ice"],
  // --- heals ---
  ["rebirth", "heal"], ["renewal", "heal"], ["salvage", "heal"], ["mend", "heal"],
  ["stitch", "heal"], ["patch", "heal"], ["heal", "heal"], ["weld", "heal"],
  ["restore", "heal"], ["crucible", "heal"], ["furnace", "heal"],
  // --- buffs (narrative/support) ---
  ["rally", "bless"], ["anthem", "music"], ["hymn", "music"], ["crescendo", "music"],
  ["blessing", "bless"], ["bless", "bless", ["blessed"]], ["banner", "bless"],
  ["omen", "bless"], ["foresight", "bless"], ["inspire", "bless"], ["apotheosis", "divine_buff"],
  // --- debuffs ---
  ["erasure", "curse"], ["redact", "curse"], ["frailty", "curse"], ["curse", "curse"],
  ["doom", "curse"], ["hex", "curse"], ["terror", "fear"], ["dread", "fear"], ["fear", "fear"],
  ["silence", "hold"], ["binding", "hold"], ["writ", "hold"], ["clause", "curse"],
];

const base = {
  levels3d: { type: "explosion", data: { color01: "#FFFFFF", color02: "#FFFFFF", spritePath: "modules/levels-3d-preview/assets/particles/dust.png", autoSize: true }, sound: { enable: false }, secondary: { enable: false, data: { color01: "#FFFFFF", color02: "#FFFFFF", spritePath: "modules/levels-3d-preview/assets/particles/dust.png", autoSize: true } }, tokens: { enable: false, source: false, target: false, sourceType: "twirl", sourcePlay: "start", targetType: "shake", targetPlay: "end" } },
  macro: { enable: false, playWhen: "0" },
  meleeSwitch: { video: V("range", "weapon", "arrow", "regular", "regular"), sound: { enable: false, delay: 0, repeat: 1, repeatDelay: 250, startTime: 0, volume: 0.75 }, options: { detect: "automatic", range: 2, returning: false, switchType: "on" } },
};
const SOUND = { enable: false, delay: 0, repeat: 1, repeatDelay: 250, startTime: 0, volume: 0.75 };
const PRIM_OPT = { contrast: 0, delay: 0, elevation: 1000, isWait: false, opacity: 1, playbackRate: 1, repeat: 1, repeatDelay: 250, saturate: 0, size: 1, tint: false, tintColor: "#FFFFFF", zIndex: 1 };
const SEC_OPT = { addTokenWidth: false, anchor: "0.5", contrast: 0, delay: 0, elevation: 1000, fadeIn: 250, fadeOut: 500, isMasked: false, isRadius: true, isWait: false, opacity: 1, repeat: 1, repeatDelay: 250, saturate: 0, size: 1.5, tint: false, tintColor: "#FFFFFF", zIndex: 1 };
const off = () => ({ enable: false, video: V("static", "spell", "curewounds", "01", "blue"), sound: { ...SOUND }, options: { ...SEC_OPT } });

const menu = { melee: [], range: [], ontoken: [], templatefx: [], preset: [], aura: [], aefx: [], version: 6 };
let id = 1;
const seen = new Set();
for (const [label, tag, excluded] of KEYWORDS) {
  if (seen.has(label)) continue; seen.add(label);
  const p = TAG[tag];
  const entry = {
    id: String(id++), label,
    ...JSON.parse(JSON.stringify(base)),
    menu: p.menu,
    primary: { video: { ...p.v }, sound: { ...SOUND }, options: { ...PRIM_OPT } },
    secondary: off(), soundOnly: { sound: { ...SOUND } }, source: off(), target: off(),
  };
  if (excluded && excluded.length) entry.advanced = { excludedTerms: excluded, exactMatch: false };
  menu[p.menu].push(entry);
}

fs.writeFileSync(OUT, JSON.stringify(menu, null, 2));
const counts = Object.fromEntries(Object.entries(menu).filter(([k]) => Array.isArray(menu[k])).map(([k, v]) => [k, v.length]));
console.log(`Wrote ${OUT}`);
console.log(`Entries by menu:`, counts, `total labels:`, seen.size);

// --- also emit a self-contained in-world merge macro (no fetch / no clobber) ---
const MACRO = path.join(os.homedir(), "systems/fourththing/tools/install-fourththing-autorec.macro.js");
const macroSrc = `// install-fourththing-autorec.macro.js  — RUN IN-WORLD (GM), then F5.
// Merges the fourththing keyword menu into Automated Animations' Automatic Recognition
// menu WITHOUT clobbering existing entries (appends labels not already present per section).
// AA matches each label as a substring of an item's normalized name; per-item AA flags
// (already stamped on the 136 Surge abilities) take precedence over these fallbacks.
// Fetches the menu from the deployed system path (kept small so it pastes easily).
(async () => {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  if (!game.modules.get("autoanimations")?.active) return ui.notifications.error("Automated Animations is not active.");
  const URL = "systems/fourththing/packs/_source/fourththing-autorec.json";
  let MENU;
  try { MENU = await foundry.utils.fetchJsonWithTimeout(URL); }
  catch (e) { return ui.notifications.error("Could not load " + URL + " — is the file deployed? " + e.message); }
  const SECTIONS = ["melee","range","ontoken","templatefx","preset","aura","aefx"];
  const cur = foundry.utils.deepClone(game.settings.get("autoanimations","aaAutorec") || {});
  for (const s of SECTIONS) if (!Array.isArray(cur[s])) cur[s] = [];
  // next id across all sections
  let nextId = 1;
  for (const s of SECTIONS) for (const e of cur[s]) { const n = parseInt(e.id); if (Number.isFinite(n) && n >= nextId) nextId = n + 1; }
  let added = 0, skipped = 0;
  for (const s of SECTIONS) {
    const have = new Set(cur[s].map(e => String(e.label || "").toLowerCase()));
    for (const e of (MENU[s] || [])) {
      if (have.has(String(e.label).toLowerCase())) { skipped++; continue; }
      cur[s].push({ ...foundry.utils.deepClone(e), id: String(nextId++) });
      added++;
    }
  }
  cur.version = Math.max(cur.version || 0, MENU.version || 0);
  await game.settings.set("autoanimations","aaAutorec", cur);
  ui.notifications.info(\`fourththing autorec: +\${added} keyword labels added, \${skipped} already present. F5 to apply.\`);
  console.log("[fourththing] autorec merged:", { added, skipped });
})();
`;
fs.writeFileSync(MACRO, macroSrc);
console.log(`Wrote ${MACRO}`);

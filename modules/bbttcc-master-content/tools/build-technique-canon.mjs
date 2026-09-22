#!/usr/bin/env node
// build-technique-canon.mjs — Techniques audit R1–R6 (owner rulings 2026-09-21).
//
// ONE source of truth for the 75 Bad Eden techniques' canon: rewrites the pack
// SOURCE dumps (packs/_source/items/*.json, category "technique") in place and
// emits tools/restamp-techniques.macro.js — the in-world GM macro that applies
// the same rewrite to the live `bbttcc-master-content.items` pack AND to every
// world actor's copy (DRY_RUN=true by default). Run from the repo root:
//
//   node modules/bbttcc-master-content/tools/build-technique-canon.mjs
//
// Vocabulary canon (R1): Sanctuary → Soma Break · Respite → Scene Break ·
// "one level of Stress" → "one level of Strain" (the stackable condition) ·
// "gain mastery" → "its rank rises by one" · "skill rank bonus" → "rank bonus"
// (glossary) · tool ranks → Tinkering · "roll 3d10 keep lowest 2" → Imposed.
// R2 temp Integrity, R3 Tactical Reserve = 2 banked rerolls / Soma Break,
// R4 initiative/defense reroll grants (mirrored onto flags.fourththing.rerolls —
// the engine truth is ID_REROLL_GRANTS in systems/fourththing/ft-progression.js),
// R5 Impose, R6 AutoAnimations presets on the active techniques.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC  = path.join(HERE, "..", "packs", "_source", "items");
const OUT  = path.join(HERE, "restamp-techniques.macro.js");

// ── Reroll grants (mirror of ft-progression.js ID_REROLL_GRANTS) ─────────────
const REROLLS = {
  bbttcc_feat_anchor_point: [
    { context: "save",  mode: "reroll-lowest", vs: "being pushed, pulled, knocked prone, Shaken, or charmed", note: "Anchor Point" },
    { context: "check", mode: "reroll-lowest", vs: "being pushed, pulled, knocked prone, Shaken, or charmed", note: "Anchor Point" },
    { context: "forced-movement", mode: "reroll-lowest", note: "Anchor Point" }
  ],
  bbttcc_feat_combat_instinct:    [ { context: "initiative", mode: "reroll-lowest", note: "Combat Instinct" } ],
  bbttcc_feat_danger_close:       [ { context: "initiative", mode: "reroll-lowest", when: "belowHalfIntegrity", note: "Danger Close — below half Integrity" },
                                    { context: "check", attribute: "intrigue", mode: "reroll-lowest", when: "belowHalfIntegrity", note: "Danger Close — below half Integrity" } ],
  bbttcc_feat_darkness_hardened:  [ { context: "defense", mode: "reroll-lowest", vs: "being Shaken", note: "Darkness Hardened" } ],
  bbttcc_feat_grave_calm:         [ { context: "defense", mode: "reroll-lowest", vs: "being Shaken", note: "Grave Calm — on a success an ally within 2 squares gets the same on their next save" } ],
  bbttcc_feat_ironclad_training:  [ { context: "defense", mode: "reroll-lowest", vs: "being knocked prone", when: "armored", note: "Ironclad Training — armor or shield" } ],
  bbttcc_feat_enduring_focus:     [ { context: "check", attribute: "body", mode: "reroll-lowest", vs: "maintaining a Clarity hold", note: "Enduring Focus" } ],
  bbttcc_feat_overwatch_discipline: [ { context: "attack", mode: "reroll-lowest", vs: "reaction strikes", when: "unmoved", note: "Overwatch Discipline — you have not moved this turn" } ],
  bbttcc_feat_quickdraw_protocol: [ { context: "attack", mode: "reroll-lowest", vs: "your first attack with a weapon drawn on initiative", when: "firstRound", note: "Quickdraw Protocol — first round" } ],
  bbttcc_feat_shadow_advantage:   [ { context: "attack", mode: "reroll-lowest", vs: "a creature that has not yet acted this round (once per round)", note: "Shadow Advantage" } ],
  bbttcc_feat_situational_mastery: [ { context: "attack", mode: "reroll-lowest", vs: "your first attack roll — or pick the first defense check / +2 squares instead", when: "firstRound", note: "Situational Mastery — start of combat" },
                                     { context: "defense", mode: "reroll-lowest", vs: "your first defense check — if that was your pick", when: "firstRound", note: "Situational Mastery — start of combat" } ],
  bbttcc_feat_strike_and_fade:    [ { context: "check", skill: "stealth", mode: "reroll-lowest", vs: "after Strike and Fade ends in dim light, darkness, or cover", note: "Strike and Fade" } ],
  bbttcc_feat_vaultbreaker:       [ { context: "check", mode: "reroll-lowest", vs: "locating hidden doors, panels, caches, and secret compartments", note: "Vaultbreaker" } ],
  bbttcc_feat_leyline_attunement: [ { context: "initiative", mode: "reroll-lowest", vs: "the first combat after attuning (Resonant Warning)", note: "Leyline Attunement" },
                                    { context: "check", skill: "athletics", mode: "reroll-lowest", vs: "one check per hour of travel (Guidance of the Current)", note: "Leyline Attunement" },
                                    { context: "check", skill: "stealth", mode: "reroll-lowest", vs: "one check per hour of travel (Quiet Step)", note: "Leyline Attunement" } ],
  bbttcc_feat_sure_recitation:    [ { context: "caster-check", mode: "reroll-lowest", note: "Sure Recitation" } ]
};
// ── Defense-grant flags ───────────────────────────────────────────────────────
const GRANTS = {
  bbttcc_feat_combat_instinct: { conditionImmunities: ["surprise"] }
};
// ── AutoAnimations presets (R6) — palette tags → AA v5 blocks ────────────────
const PALETTE = {
  shield:      { menu: "ontoken", v: { dbSection: "static", menuType: "shieldfx",   animation: "ice",            variant: "03",    color: "purple",      enableCustom: false, customPath: "" } },
  heal:        { menu: "ontoken", v: { dbSection: "static", menuType: "spell",      animation: "curewounds",     variant: "01",    color: "blue",        enableCustom: false, customPath: "" } },
  heal_generic:{ menu: "ontoken", v: { dbSection: "static", menuType: "spell",      animation: "generichealing", variant: "01",    color: "blue",        enableCustom: false, customPath: "" } },
  bless:       { menu: "ontoken", v: { dbSection: "static", menuType: "spell",      animation: "bless",          variant: "intro", color: "yellow",      enableCustom: false, customPath: "" } },
  bless_loop:  { menu: "ontoken", v: { dbSection: "static", menuType: "spell",      animation: "bless",          variant: "loop",  color: "purple",      enableCustom: false, customPath: "" } },
  divine_buff: { menu: "ontoken", v: { dbSection: "static", menuType: "spell",      animation: "divinesmite",    variant: "source",color: "yellowwhite", enableCustom: false, customPath: "" } },
  sacred:      { menu: "ontoken", v: { dbSection: "static", menuType: "spell",      animation: "sacredflame",    variant: "target",color: "yellow",      enableCustom: false, customPath: "" } },
  curse:       { menu: "ontoken", v: { dbSection: "static", menuType: "spell",      animation: "divinesmite",    variant: "source",color: "darkpurple",  enableCustom: false, customPath: "" } },
  fear:        { menu: "ontoken", v: { dbSection: "static", menuType: "conditions", animation: "fear",           variant: "02",    color: "darkpurple",  enableCustom: false, customPath: "" } },
  hold:        { menu: "ontoken", v: { dbSection: "static", menuType: "magicsign",  animation: "enchantment",    variant: "02",    color: "purple",      enableCustom: false, customPath: "" } },
  explosion:   { menu: "ontoken", v: { dbSection: "static", menuType: "generic",    animation: "explosion",      variant: "01",    color: "red",         enableCustom: false, customPath: "" } },
  frost_impact:{ menu: "ontoken", v: { dbSection: "static", menuType: "impact",     animation: "frost",          variant: "01",    color: "blue",        enableCustom: false, customPath: "" } },
  dash:        { menu: "ontoken", v: { dbSection: "static", menuType: "spell",      animation: "mistystep",      variant: "01",    color: "blue",        enableCustom: false, customPath: "" } },
  detect:      { menu: "ontoken", v: { dbSection: "static", menuType: "spell",      animation: "detectmagic",    variant: "intro", color: "blue",        enableCustom: false, customPath: "" } },
  sword:       { menu: "melee",   v: { dbSection: "melee",  menuType: "weapon",     animation: "sword",          variant: "01",    color: "white",       enableCustom: false, customPath: "" } },
  arrow:       { menu: "range",   v: { dbSection: "range",  menuType: "weapon",     animation: "arrow",          variant: "regular",color: "regular",    enableCustom: false, customPath: "" } }
};
const AA = {
  bbttcc_feat_adaptive_defense: "shield",      bbttcc_feat_unbroken_guard: "shield",        bbttcc_feat_iron_will: "shield",
  bbttcc_feat_last_ritual: "heal",             bbttcc_feat_medic_of_the_wastes: "heal",     bbttcc_feat_rig_hand: "heal_generic",
  bbttcc_feat_spark_sense: "detect",           bbttcc_feat_vaultbreaker: "detect",
  bbttcc_feat_calm_the_mob: "bless",           bbttcc_feat_hold_the_line: "bless",          bbttcc_feat_combat_logistics: "bless",
  bbttcc_feat_weatherwise: "bless",            bbttcc_feat_pressure_tested: "bless",
  bbttcc_feat_grave_calm: "bless_loop",        bbttcc_feat_pressure_transference: "bless_loop",
  bbttcc_feat_refuse_the_narrative: "hold",    bbttcc_feat_deliberate_tempo: "hold",
  bbttcc_feat_reclamation: "sacred",
  bbttcc_feat_tactical_reserve: "divine_buff", bbttcc_feat_iron_nerves: "divine_buff",      bbttcc_feat_quickdraw_protocol: "divine_buff",
  bbttcc_feat_situational_mastery: "divine_buff", bbttcc_feat_unyielding_finish: "divine_buff",
  bbttcc_feat_combat_intuition: "sword",       bbttcc_feat_environmental_opportunist: "sword", bbttcc_feat_desperate_measure: "sword",
  bbttcc_feat_bladed_tempo: "sword",
  bbttcc_feat_last_exit: "dash",               bbttcc_feat_strike_and_fade: "dash",         bbttcc_feat_decisive_momentum: "dash",
  bbttcc_feat_relentless_advance: "dash",
  bbttcc_feat_controlled_aggression: "curse",  bbttcc_feat_unsettling_precision: "curse",   bbttcc_feat_calculated_risk: "curse",
  bbttcc_feat_darkness_hardened: "fear",
  bbttcc_feat_linebreaker: "frost_impact",     bbttcc_feat_edge_of_control: "frost_impact",
  bbttcc_feat_disciplined_fire: "arrow",
  bbttcc_feat_improvised_engineer: "explosion", bbttcc_feat_controlled_collapse: "explosion", bbttcc_feat_breach_specialist: "explosion"
  // Threatening Silence + Backline Commander already carry AA (kept as-is).
};
// ── Engine notes appended to each text (⚙ wired · 🃏 card · ✍ table) ─────────
const NOTES = {
  bbttcc_feat_adaptive_defense: "🃏 Card — click ▶ when you are hit: it shows the reduction (rank bonus + Violence or Intrigue).",
  bbttcc_feat_anchor_point: "⚙ Reroll-lowest on checks and defense checks; the push / pull / prone / Shaken / charm gate is read by the GM.",
  bbttcc_feat_backline_commander: "🃏 Card — bonus action, rank-bonus uses per Soma Break; target the ally first.",
  bbttcc_feat_battlefield_presence: "✍ Aura — the GM applies the reroll to the allies' first defense check vs Shaken or charm each combat.",
  bbttcc_feat_bladed_tempo: "✍ Table rule.",
  bbttcc_feat_breach_specialist: "⚙ +1 Tinkering. 🃏 Card — the max-damage-vs-objects rider, once per round.",
  bbttcc_feat_calculated_risk: "🃏 Card — once per turn: banks a reroll for your attack; attacks against you reroll their lowest die until your next turn (GM applies).",
  bbttcc_feat_calm_the_mob: "⚙ +1 to Diplomacy or Intimidation — whichever you rank higher.",
  bbttcc_feat_combat_instinct: "⚙ Initiative rerolls its lowest die; you are immune to Surprised.",
  bbttcc_feat_combat_intuition: "🃏 Card — reaction, once per round.",
  bbttcc_feat_combat_logistics: "🃏 Card — target the ally and click ▶ at the start of combat: they gain temporary Integrity equal to your rank bonus.",
  bbttcc_feat_controlled_aggression: "🃏 Card — once per turn, target first: the target is Imposed; you deal minimum damage.",
  bbttcc_feat_controlled_collapse: "🃏 Card — once per Soma Break.",
  bbttcc_feat_danger_close: "⚙ Below half Integrity: initiative and Intrigue checks reroll the lowest die.",
  bbttcc_feat_darkness_hardened: "⚙ Defense checks vs Shaken reroll the lowest die. 🃏 Card — once per Soma Break: choose to succeed; one level of Strain lands.",
  bbttcc_feat_decisive_momentum: "🃏 Card — once per round.",
  bbttcc_feat_deliberate_tempo: "🃏 Card — once per turn: banks a reroll for the delayed attack.",
  bbttcc_feat_desperate_measure: "🃏 Card — once per Scene Break: shows the glancing-blow damage (rank bonus).",
  bbttcc_feat_disciplined_fire: "🃏 Card — once per turn: Pin (noted) or Disrupt (target first → Imposed).",
  bbttcc_feat_edge_of_control: "✍ Table rule.",
  bbttcc_feat_enduring_focus: "⚙ Body checks reroll the lowest die; the Clarity-hold gate is read by the GM.",
  bbttcc_feat_environmental_opportunist: "🃏 Card — reaction, once per turn.",
  bbttcc_feat_fluid_footwork: "⚙ +2 squares movement applies automatically.",
  bbttcc_feat_focused_execution: "🃏 Card — shows the damage bonus (rank bonus).",
  bbttcc_feat_grave_calm: "⚙ Defense checks vs Shaken reroll the lowest die; the ally's copy is applied by the GM.",
  bbttcc_feat_grim_persistence: "⚙ Integrity max +2 × level applies automatically; the hold-at-1 fires by itself, once per Soma Break.",
  bbttcc_feat_hard_lessons: "⚙ After a failed defense check, your defense checks reroll the lowest die until the end of your next turn.",
  bbttcc_feat_hold_the_line: "✍ Table rule.",
  bbttcc_feat_improvised_engineer: "⚙ +1 Tinkering. 🃏 Card — the device is built by hand.",
  bbttcc_feat_iron_nerves: "⚙ Rolling initiative grants temporary Integrity equal to your rank bonus. 🃏 Card — the +1d4, once per Scene Break.",
  bbttcc_feat_iron_will: "⚙ +1 Guard (Body) or +1 Resolve (Soul) — the engine takes your higher faculty (ties → Soul); the GM can set flags.fourththing.ironWill. 🃏 Card — once per Soma Break: banks a reroll for the failed defense check.",
  bbttcc_feat_ironclad_training: "⚙ In armor or with a shield, defense checks vs prone reroll the lowest die.",
  bbttcc_feat_last_exit: "🃏 Card — once per Soma Break.",
  bbttcc_feat_leyline_attunement: "⚙ The initiative / Athletics / Stealth rerolls are wired with the attunement named as the gate — the GM reads which you chose.",
  bbttcc_feat_linebreaker: "🃏 Card — target first: the enemy is Imposed for its reaction strikes until the end of its next turn.",
  bbttcc_feat_medic_of_the_wastes: "⚙ +1 Faith. 🃏 Card — shows the Integrity numbers.",
  bbttcc_feat_overwatch_discipline: "⚙ While you have not moved this turn, your attack rolls reroll the lowest die; the reaction-strike gate is read by the GM.",
  bbttcc_feat_last_ritual: "🃏 Card — reaction, once per Scene Break; target the fallen ally: stabilized, with temporary Integrity equal to your rank bonus.",
  bbttcc_feat_pressure_tested: "⚙ Succeeding on a defense check banks a reroll, once per Scene Break (the 'ignore the effect' fork is the GM's).",
  bbttcc_feat_pressure_transference: "🃏 Card — reaction, once per round; target the ally: a reroll is banked for them.",
  bbttcc_feat_quickdraw_protocol: "⚙ First round: your attack rolls reroll the lowest die; the drawn-weapon gate is read by the GM.",
  bbttcc_feat_reclamation: "⚙ Card — once per scene: +2 Clarity and 1 Stress, applied.",
  bbttcc_feat_refuse_the_narrative: "🃏 Card — once per Soma Break.",
  bbttcc_feat_relentless_advance: "🃏 Card — once per turn: temporary Integrity equal to your rank bonus.",
  bbttcc_feat_rig_hand: "⚙ +1 Tinkering. 🃏 Card — once per Soma Break.",
  bbttcc_feat_scavenged_insight: "✍ Table rule.",
  bbttcc_feat_scavenger_savant: "⚙ +1 Investigation.",
  bbttcc_feat_shadow_advantage: "⚙ Attack rolls reroll the lowest die; the has-not-acted gate (once per round) is read by the GM.",
  bbttcc_feat_situational_mastery: "⚙ First round: your first attack roll or defense check rerolls the lowest die; the movement pick is by hand.",
  bbttcc_feat_spark_sense: "⚙ +1 Occult. 🃏 Card — rank-bonus uses per Soma Break.",
  bbttcc_feat_strike_and_fade: "⚙ Stealth checks reroll the lowest die; the dim-light / cover gate is read by the GM.",
  bbttcc_feat_tactical_reserve: "⚙ Each Soma Break banks 2 rerolls (a refill, not a stack). Yours auto-fire on your next roll; handing one to an ally is moved by the GM.",
  bbttcc_feat_threat_assessment: "⚙ +1 to Perception or Investigation — whichever you rank higher.",
  bbttcc_feat_threatening_silence: "🃏 Card — bonus action, once per Scene Break; target first: Imposed.",
  bbttcc_feat_unbroken_guard: "🃏 Card — reaction; target the attacker: Imposed, movement 0 (GM).",
  bbttcc_feat_unsettling_precision: "🃏 Card — target first: Imposed for its next defense check.",
  bbttcc_feat_unyielding_finish: "🃏 Card — once per round: banks a reroll.",
  bbttcc_feat_vaultbreaker: "⚙ Checks to find hidden doors and caches reroll the lowest die. 🃏 Card — the 9-or-lower-counts-as-10, once per Scene Break.",
  bbttcc_feat_weapon_familiarity: "✍ Table rule.",
  bbttcc_feat_weatherwise: "⚙ +1 to Athletics or Lore — whichever you rank higher. 🃏 Card — once per Soma Break."
};
// ── Text canon (R1) — ordered regex passes over the description HTML ─────────
const TEXT_RULES = [
  [/\bSanctuary\b/g, "Soma Break"],
  [/short or Soma Break/g, "Scene Break or Soma Break"],
  [/\bRespites?\b/g, (m) => m.endsWith("s") ? "Scene Breaks" : "Scene Break"],
  [/one level of Stress/g, "one level of Strain"],
  [/If you already have it, you gain mastery\./g, "If you already have it, its rank rises by one instead."],
  [/If you are already proficient, you gain mastery instead\./g, "If you already have it, its rank rises by one instead."],
  [/skill rank bonus/g, "rank bonus"],
  [/You gain skill rank with thieves’ tools\./g, "You gain a rank in Tinkering (thieves’ tools)."],
  [/You gain skill rank with artisan’s tools of your choice\./g, "You gain a rank in Tinkering (artisan’s tools)."],
  [/You gain skill rank with tinker’s tools\./g, "You gain a rank in Tinkering (tinker’s tools)."],
  [/impose roll 3d10 keep lowest 2 on the target’s next attack/g, "Impose the target: its next attack roll is 3d10 keep-lowest-2"],
  [/that enemy roll 3d10 keep lowest 2 on reaction strikes until the end of its next turn/g, "that enemy is Imposed: its reaction strikes roll 3d10 keep-lowest-2 until the end of its next turn"],
  [/That creature roll 3d10 keep lowest 2 on its next attack roll against a target other than you/g, "That creature is Imposed: its next attack roll against a target other than you is 3d10 keep-lowest-2"],
  [/impose roll 3d10 keep lowest 2 on that attack/g, "Impose the attacker (that attack rolls 3d10 keep-lowest-2)"],
  [/it roll 3d10 keep lowest 2 on its next defense checks before the end of its next turn/g, "it is Imposed: its next defense check before the end of its next turn is 3d10 keep-lowest-2"],
  [/is made with keep-lowest\./g, "is Imposed (3d10 keep-lowest-2)."],
  [/Choose Soul or Body\. You gain a skill rank in defense checks using that attribute\./g, "Choose Soul or Body: defense checks keyed to it gain +1 (Body → Guard, Soul → Resolve)."]
];
// Per-item surgery beyond the regex passes.
const SPECIAL = {
  bbttcc_feat_tactical_reserve: (html) => html.replace(
    /<p>You gain 2 Tactical Dice[^<]*<\/p>/,
    "<p>At each Soma Break you bank 2 rerolls. When you or a creature you can see within 6 squares makes an attack roll, attribute check, or defense check, you may spend one to reroll the lowest die of that roll (keep the higher). Unspent rerolls are replaced at the next Soma Break.</p>"),
  bbttcc_feat_last_ritual:       (html) => html.replace("<h2>Last Ritual</h2>", "<h2>Penultimate Rites</h2>"),
  bbttcc_feat_focused_execution: (html) => html.replace("<h2>Focused Execution</h2>", "<h2>Focused Shot</h2>"),
  bbttcc_feat_scavenged_insight: (html) => html.replace(/<h2>Scavenged Insight[^<]*<\/h2>/, "<h2>Scavenged Insight</h2>")
};
const RENAME = { bbttcc_feat_scavenged_insight: "Scavenged Insight" };

function canonText(id, html) {
  let out = String(html ?? "");
  for (const [re, rep] of TEXT_RULES) out = out.replace(re, rep);
  if (SPECIAL[id]) out = SPECIAL[id](out);
  const note = NOTES[id];
  if (note && !/[⚙✍🃏]/.test(out)) out += `<p class="ft-engine-note"><em>${note}</em></p>`;
  return out;
}
const SOUND = { enable: false, delay: 0, repeat: 1, repeatDelay: 250, startTime: 0, volume: 0.75 };
const POPT  = { contrast: 0, delay: 0, elevation: 1000, isWait: false, opacity: 1, playbackRate: 1, repeat: 1, repeatDelay: 250, saturate: 0, size: 1, tint: false, tintColor: "#FFFFFF", zIndex: 1 };
const SOPT  = { addTokenWidth: false, anchor: "0.5", contrast: 0, delay: 0, elevation: 1000, fadeIn: 250, fadeOut: 500, isMasked: false, isRadius: true, isWait: false, opacity: 1, repeat: 1, repeatDelay: 250, saturate: 0, size: 1.5, tint: false, tintColor: "#FFFFFF", zIndex: 1 };
const offBlk = () => ({ enable: false, video: { dbSection: "static", menuType: "spell", animation: "curewounds", variant: "01", color: "blue", enableCustom: false, customPath: "" }, sound: { ...SOUND }, options: { ...SOPT } });
function buildAA(tag, name) {
  const p = PALETTE[tag];
  return { id: "ft-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: name,
    macro: { enable: false, playWhen: "0" }, menu: p.menu,
    primary: { video: { ...p.v }, sound: { ...SOUND }, options: { ...POPT } },
    secondary: offBlk(), soundOnly: { sound: { ...SOUND } }, source: offBlk(), target: offBlk(),
    isEnabled: true, isCustomized: true, fromAmmo: false, version: 5 };
}

// ── 1. Rewrite the pack source dumps ─────────────────────────────────────────
const CANON = {};   // identifier → { name, description, rerolls, grants, aa }
let touched = 0;
for (const f of fs.readdirSync(SRC)) {
  if (!f.endsWith(".json")) continue;
  const p = path.join(SRC, f);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  if (j.system?.category !== "technique") continue;
  const id = String(j.system?.identifier ?? "");
  if (!id.startsWith("bbttcc_feat_")) continue;   // the 5 rig frames mis-filed as techniques stay untouched
  const before = JSON.stringify(j);
  const name = RENAME[id] ?? j.name;
  j.name = name;
  j.system.description.value = canonText(id, j.system.description.value);
  j.flags ??= {}; j.flags.fourththing ??= {};
  if (REROLLS[id]) j.flags.fourththing.rerolls = REROLLS[id];
  if (GRANTS[id])  j.flags.fourththing.grants  = { ...(j.flags.fourththing.grants ?? {}), ...GRANTS[id] };
  if (AA[id] && !j.flags.autoanimations) j.flags.autoanimations = buildAA(AA[id], name);
  if (j.system.source && typeof j.system.source === "object") { j.system.source.custom = "Bad Eden Core Feats v1 — techniques canon 2026-09-21"; j.system.source.revision = 2; }
  CANON[id] = { name, description: j.system.description.value, rerolls: REROLLS[id] ?? null, grants: GRANTS[id] ?? null, aa: j.flags.autoanimations ?? null };
  if (JSON.stringify(j) !== before) { fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n"); touched++; }
}
const ids = Object.keys(CANON);
console.log(`techniques: ${ids.length} canon rows · ${touched} source files rewritten`);
const leftovers = ids.filter(id => /\bSanctuary\b|\bRespite\b|level of Stress|gain mastery|skill rank bonus|keep lowest 2/.test(CANON[id].description));
if (leftovers.length) { console.error("LEFTOVER vocabulary:", leftovers); process.exit(1); }

// ── 2. Emit the live restamp macro ───────────────────────────────────────────
const macro = `// restamp-techniques.macro.js — RUN IN-WORLD (GM). Run in BOTH worlds (foundry + ember).
// GENERATED ${new Date().toISOString()} by tools/build-technique-canon.mjs — do not hand-edit; edit the builder.
//
// Techniques audit R1–R6 (owner rulings 2026-09-21): rewrites the ${ids.length} Bad Eden
// techniques in the live \`bbttcc-master-content.items\` pack AND every world
// actor's copy — canon vocabulary (Soma Break / Scene Break / Strain / rank
// bonus / Imposed), flags.fourththing.rerolls (R4), condition-immunity grants,
// AutoAnimations presets (R6, only where the item has none). Keyed by
// system.identifier; idempotent. DRY_RUN=true reports only.
(async () => {
  const DRY_RUN = true;                                   // <-- set false to apply
  if (!game.user?.isGM) return ui.notifications.warn("GM only.");
  const CANON = ${JSON.stringify(CANON)};
  const PACK_ID = "bbttcc-master-content.items";
  const tally = { pack: 0, actors: 0, actorItems: 0, skipped: 0, missing: [] };
  const planFor = (doc, row) => {
    const upd = {};
    if (doc.name !== row.name) upd["name"] = row.name;
    if (String(doc.system?.description?.value ?? "") !== row.description) upd["system.description.value"] = row.description;
    if (row.rerolls && JSON.stringify(doc.flags?.fourththing?.rerolls ?? null) !== JSON.stringify(row.rerolls)) upd["flags.fourththing.rerolls"] = row.rerolls;
    if (row.grants) for (const [k, v] of Object.entries(row.grants)) {
      if (JSON.stringify(doc.flags?.fourththing?.grants?.[k] ?? null) !== JSON.stringify(v)) upd[\`flags.fourththing.grants.\${k}\`] = v;
    }
    if (row.aa && !doc.flags?.autoanimations) upd["flags.autoanimations"] = row.aa;
    return upd;
  };
  // 1. The pack.
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications.error(\`Pack \${PACK_ID} not found.\`);
  const wasLocked = pack.locked;
  if (wasLocked && !DRY_RUN) await pack.configure({ locked: false });
  const docs = await pack.getDocuments();
  const seen = new Set();
  for (const doc of docs) {
    const id = String(doc.system?.identifier ?? "");
    const row = CANON[id]; if (!row) continue;
    seen.add(id);
    const upd = planFor(doc, row);
    if (!Object.keys(upd).length) { tally.skipped++; continue; }
    console.log("[techniques] pack", doc.name, Object.keys(upd));
    if (!DRY_RUN) await doc.update(upd);
    tally.pack++;
  }
  if (wasLocked && !DRY_RUN) await pack.configure({ locked: true });
  for (const id of Object.keys(CANON)) if (!seen.has(id)) tally.missing.push(id);
  // 2. Every world actor's copies (the party's sheets read THEIR items).
  for (const actor of game.actors) {
    const updates = [];
    for (const it of actor.items) {
      const row = CANON[String(it.system?.identifier ?? "")]; if (!row) continue;
      const upd = planFor(it, row);
      if (!Object.keys(upd).length) { tally.skipped++; continue; }
      updates.push({ _id: it.id, ...upd });
      console.log("[techniques] actor", actor.name, "·", it.name, Object.keys(upd));
    }
    if (!updates.length) continue;
    if (!DRY_RUN) await actor.updateEmbeddedDocuments("Item", updates);
    tally.actors++; tally.actorItems += updates.length;
  }
  const line = \`restamp-techniques \${DRY_RUN ? "(DRY RUN)" : "(APPLIED)"} — pack items \${tally.pack} · actors \${tally.actors} (\${tally.actorItems} items) · already-canon \${tally.skipped} · not in pack \${tally.missing.length}\`;
  console.log(line, tally.missing);
  ui.notifications.info(line + (DRY_RUN ? " — set DRY_RUN=false to apply, then F5." : " — F5 to reload sheets."));
})();
`;
fs.writeFileSync(OUT, macro);
console.log("wrote", path.relative(process.cwd(), OUT));

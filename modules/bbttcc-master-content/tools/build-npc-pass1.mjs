#!/usr/bin/env node
/* build-npc-pass1.mjs — compile the NPC Pack v1 "pass 1" fixes (the uncontroversial ones) into a guarded
 * DRY_RUN macro.  Usage (repo root):
 *   node modules/bbttcc-master-content/tools/build-npc-pass1.mjs <npcs.jsonl> <assets.txt>
 *   → writes modules/bbttcc-master-content/tools/npc-pack-pass1.macro.js (+ prints the plan summary)
 * Inputs are LIVE dumps (`bin/ft-dump-pack npcs …`, `bin/ft-dump-pack --assets …`) — ember canonical.
 *
 * Pass 1 (owner rulings 2026-10-06; scope excludes "Test PCs" + "Testing Characters"):
 *   ART    wire art already on the box to shells that have none (curated list below — Dave's GOTTGAIT tokens)
 *   ICON   broken item icons → nearest existing core icon; grey `icons/svg/*` + `systems/dnd5e/*.svg` →
 *          the ability's BBTTCC icon (npc-abilities-aa-map.json) else a full-colour core webp by meaning
 *   DMG    monster weapon dice → the per-tier budget (threat-budget.mjs normalizeDamage)
 *   SIG    lineage signature resist / vuln / condition immunities the monster is missing (monster-builder LINEAGES)
 *   ROLE   `system.role` holding a title → title moves to flags.fourththing.rfi.actor.title, role becomes a role word
 * Every edit carries the value it expects to replace; the macro skips (and reports) anything that drifted.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeDamage, LIMITED_RE } from "./threat-budget.mjs";

const [NPCS, ASSETS_FILE] = process.argv.slice(2);
if (!NPCS || !ASSETS_FILE) { console.error("usage: build-npc-pass1.mjs <npcs.jsonl> <assets.txt>"); process.exit(2); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = new Set(fs.readFileSync(ASSETS_FILE, "utf8").split("\n").filter(Boolean));
const recs = fs.readFileSync(NPCS, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
const folders = Object.fromEntries(recs.filter(r => r.k.startsWith("!folders!")).map(r => [r.v._id, r.v]));
const fpath = id => { const s = []; for (let f = folders[id]; f; f = folders[f.folder]) s.unshift(f.name); return s.join("/") || "(root)"; };
const actors = recs.filter(r => r.k.startsWith("!actors!")).map(r => r.v);
const items = {}; for (const r of recs.filter(r => r.k.startsWith("!actors.items!"))) (items[r.k.split("!")[2].split(".")[0]] ??= []).push(r.v);
const OUT_OF_SCOPE = /^(Test PCs|Testing Characters)(\/|$)/;
const ROMAN = { I: 1, II: 2, III: 3, IV: 4 };
const enc = p => p.split("/").map(encodeURIComponent).join("/");            // stored paths use %20 (pack convention)
const must = p => { if (!ASSETS.has(p)) throw new Error(`target not on ember: ${p}`); return enc(p); };

// ── curated art (A2 hits, eyeballed): name → [portrait, token] ──────────────────────────────────────────
const T = "art/bbttcc/GOTTGAIT/GOTTGAIT Token/", CO = "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/";
const ART = {
  "Howard": [T + "Howard.png"], "Simone": [T + "Simone.png"],
  "Gloomgill": ["art/bbttcc/GOTTGAIT/ArtForBBTTCCModule/Gloomgill.png"],
  "Gilbert, Attendant Eternal": [CO + "gilbert_token.png"],
  "Scavenger — Bit": ["modules/bbttcc-onboarding/art/scavenger-bit.webp"],
  "Scavenger — Coll": ["modules/bbttcc-onboarding/art/scavenger-coll.webp"],
};

// ── icons ───────────────────────────────────────────────────────────────────────────────────────────────
const BTN = "art/bbttcc/GOTTGAIT/BBTTCC Button Icons/";
const AAMAP = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(HERE, "npc-abilities-aa-map.json"), "utf8"))
  .filter(r => r.iconFile && ASSETS.has(BTN + r.iconFile)).map(r => [r.name.toLowerCase(), BTN + r.iconFile]));
const BROKEN = {
  "icons/sundries/gaming/chess-pawn-white-pearl.webp": "icons/sundries/gaming/chess-pawn-white-glass.webp",
  "icons/weapons/artifacts/cannon-engraved.webp": "icons/weapons/artillery/cannon-tech-white.webp",
};
// grey core svg → full-colour core webp by meaning (each target verified on ember by must())
const SVG = {
  "item-bag": "icons/containers/bags/pack-leather-stitched-tan.webp", sword: "icons/weapons/swords/swords-sharp-worn.webp",
  combat: "icons/skills/melee/blade-tip-damaged-acid-green.webp", oak: "icons/magic/nature/root-vine-caduceus-healing.webp",
  sound: "icons/magic/sonic/projectile-sound-rings-wave.webp", temple: "icons/environment/settlement/temple-night.webp",
  "mage-shield": "icons/magic/air/air-pressure-shield-blue.webp", book: "icons/sundries/books/book-rounded-blue.webp",
  cowled: "icons/equipment/head/hood-cloth-teal.webp", explosion: "icons/magic/fire/explosion-fireball-medium-orange.webp",
  invisible: "icons/magic/control/silhouette-aura-energy.webp", terror: "icons/magic/death/blood-corruption-vomit-red.webp",
  eye: "icons/weapons/staves/staff-ornate-eye.webp", fire: "icons/weapons/guns/flamethrower-spray-fire-orange.webp",
  silenced: "icons/weapons/guns/pistol-silenced.webp", anchor: "icons/tools/nautical/anchor-blue.webp",
  sun: "icons/magic/air/weather-sunlight-sky.webp", wing: "icons/magic/holy/angel-wings-gray.webp",
  statue: "icons/commodities/treasure/statue-bust-stone-grey.webp", daze: "icons/magic/control/sleep-bubble-purple.webp",
  net: "icons/environment/cosmos/astronomy-planetary-orbits.webp", ruins: "icons/environment/wilderness/wall-ruins.webp",
  downgrade: "icons/magic/death/blood-corruption-vomit-red.webp", biohazard: "icons/equipment/body/suit-biohazard-protection.webp",
  walk: "icons/equipment/feet/boots-collared-leather.webp", padlock: "icons/containers/chest/chest-simple-box-blue.webp",
  sleep: "icons/magic/control/sleep-bubble-purple.webp", blind: "icons/creatures/eyes/humanoid-single-blind.webp",
  pawprint: "icons/magic/nature/wolf-paw-glow-small-green.webp", bones: "icons/weapons/daggers/dagger-bone-grey.webp",
  poison: "icons/weapons/daggers/dagger-poisoned.webp", aura: "icons/magic/control/silhouette-aura-energy.webp",
  chest: "icons/containers/chest/chest-oak-steel-brown.webp", acid: "icons/skills/melee/blade-tip-acid-poison-green.webp",
  degen: "icons/magic/death/blood-corruption-vomit-red.webp", light: "icons/sundries/lights/candle-lit-angelic.webp",
  "holy-shield": "icons/weapons/swords/sword-gold-holy.webp", angel: "icons/magic/holy/angel-winged-humanoid-blue.webp",
  target: "icons/skills/targeting/target-glowing-yellow.webp", unconscious: "icons/magic/control/sleep-bubble-purple.webp",
  heal: "icons/magic/nature/root-vine-caduceus-healing.webp", tankard: "icons/containers/bags/pack-leather-stitched-tan.webp",
  paralysis: "icons/magic/control/sleep-bubble-purple.webp", blood: "icons/magic/unholy/strike-beam-blood-large-red-purple.webp",
  regen: "icons/magic/nature/root-vine-caduceus-healing.webp", "fire-shield": "icons/magic/defensive/shield-barrier-flaming-diamond-acid.webp",
  cave: "icons/environment/wilderness/cave-entrance.webp", lightning: "icons/commodities/treasure/stone-cracked-lightning-blue.webp",
  tower: "icons/environment/settlement/tower-stone-blue.webp",
  feature: "icons/magic/control/silhouette-aura-energy.webp", weapon: "icons/weapons/swords/swords-sharp-worn.webp",
};
// rig frames (grey oak placeholder) → BBTTCC vehicle / mech button icons, by frame name
const FRAME_ICON = [[/power-armor|mecha/i, BTN + "bbttcc_icons_mech_1.png"], [/atr|transport/i, BTN + "BBTTCC_button_icon_vehicle_2.png"], [/frame/i, BTN + "BBTTCC_button_icon_vehicle_1.png"]];
function iconFix(it) {
  const img = decodeURIComponent(it.img || "");
  if (BROKEN[img]) return must(BROKEN[img]);
  if (!/^icons\/svg\/|^systems\/dnd5e\/.*\.svg$/.test(img)) return null;
  const frame = /frame$/i.test(it.name) && FRAME_ICON.find(([re]) => re.test(it.name)); if (frame) return must(frame[1]);
  const byName = AAMAP[String(it.name).toLowerCase()]; if (byName) return enc(byName);
  const key = path.basename(img, ".svg"); if (!SVG[key]) throw new Error(`no SVG map for ${img} (${it.name})`);
  return must(SVG[key]);
}

// ── lineage signatures + role vocabulary from the builder ───────────────────────────────────────────────
const builderSrc = fs.readFileSync(path.join(HERE, "../../bbttcc-auto-link/scripts/monster-builder.js"), "utf8");
const block = builderSrc.slice(builderSrc.indexOf("const MORTAL_BANNERS"), builderSrc.indexOf("const LINEAGE_BY_KEY"));
const { LINEAGES } = new Function(`${block}; return { LINEAGES };`)();
const LIN = Object.fromEntries(LINEAGES.map(l => [l.key, l]));
const ROLE_WORDS = new Set(["brute", "caster", "stealth", "scout", "hardened"]);
const ROLE_FROM_TITLE = [
  [/berserk|juggernaut|golem|warlord|tyrant|lord|brute|raider|guard|horde|cataclysm|catastrophe|calamity/i, "brute"],
  [/ambush|stalker|predator|seducer|parasite|tempter|courier|attendant|maître|wraith/i, "stealth"],
  [/vermin|scout|drone|hound/i, "scout"],
  [/construct|sentinel|protocol|golem|hardened|engine|wall|judge|plant/i, "hardened"],
  [/caster|weather|idol|voice|elemental|agitator|tormentor|horror|wyrm|dragon|manager|miasma|archon|angel|avatar/i, "caster"],
];

// ── compile ─────────────────────────────────────────────────────────────────────────────────────────────
const plan = []; const tally = { ART: 0, ICON: 0, DMG: 0, SIG: 0, ROLE: 0 };
for (const a of actors) {
  const f = fpath(a.folder); if (OUT_OF_SCOPE.test(f)) continue;
  const its = items[a._id] || [], rfi = a.flags?.fourththing?.rfi?.actor || {}, lin = rfi.lineage;
  const p = { id: a._id, name: a.name, folder: f, set: {}, expect: {}, items: [], notes: [] };

  if (ART[a.name] && (/mystery-man|icons\/svg/.test(a.img || "") || !a.img)) {
    const [portrait, token = portrait] = ART[a.name];
    p.set.img = must(portrait); p.expect.img = a.img;
    p.set["prototypeToken.texture.src"] = must(token); p.expect["prototypeToken.texture.src"] = a.prototypeToken?.texture?.src;
    p.notes.push(`ART ${path.basename(portrait)}`); tally.ART++;
  }
  for (const it of its) {
    const set = {}, expect = {}, why = [];
    { const ni = iconFix(it); if (ni) { set.img = ni; expect.img = it.img; why.push("ICON"); tally.ICON++; } }
    if (lin && it.type === "weapon" && it.system?.damage?.formula) {
      const tier = ROMAN[rfi.tier] || 1, nf = normalizeDamage(it.system.damage.formula, tier, LIMITED_RE.test(it.name));
      if (nf !== it.system.damage.formula) { set["system.damage.formula"] = nf; expect["system.damage.formula"] = it.system.damage.formula; why.push(`DMG ${it.system.damage.formula}→${nf}`); tally.DMG++; }
    }
    if (why.length) p.items.push({ id: it._id, name: it.name, set, expect, why: why.join(" · ") });
  }
  if (lin && LIN[lin]) {
    const L = LIN[lin], d = a.system?.defenses || {}, has = (arr, x) => (arr || []).map(String).some(v => v === x || v.startsWith(x + ":"));
    const grants = its.flatMap(i => i.flags?.fourththing?.grants?.resists || []);
    const addR = L.resist.filter(x => !has(d.resistances, x) && !grants.includes(x)), addV = L.vuln.filter(x => !has(d.vulnerabilities, x));
    const ci = a.system?.conditionImmunities || [], addC = L.condImm.filter(x => !ci.includes(x));
    if (addR.length) { p.set["system.defenses.resistances"] = [...(d.resistances || []), ...addR]; p.expect["system.defenses.resistances"] = d.resistances || []; }
    if (addV.length) { p.set["system.defenses.vulnerabilities"] = [...(d.vulnerabilities || []), ...addV]; p.expect["system.defenses.vulnerabilities"] = d.vulnerabilities || []; }
    if (addC.length) { p.set["system.conditionImmunities"] = [...ci, ...addC]; p.expect["system.conditionImmunities"] = ci; }
    if (addR.length + addV.length + addC.length) { p.notes.push(`SIG +${[...addR.map(x => "res " + x), ...addV.map(x => "vuln " + x), ...addC.map(x => "imm " + x)].join(", ")}`); tally.SIG++; }
    const role = String(a.system?.role ?? "");
    if (role && !ROLE_WORDS.has(role.toLowerCase())) {
      const word = (ROLE_FROM_TITLE.find(([re]) => re.test(role)) || [, L.role])[1];
      p.set["system.role"] = word; p.expect["system.role"] = role;
      if (!rfi.title) { p.set["flags.fourththing.rfi.actor.title"] = role; p.expect["flags.fourththing.rfi.actor.title"] = rfi.title ?? null; }
      p.notes.push(`ROLE "${role}" → ${word}`); tally.ROLE++;
    }
  }
  if (Object.keys(p.set).length || p.items.length) plan.push(p);
}

// ── emit macro ──────────────────────────────────────────────────────────────────────────────────────────
const OUT = path.join(HERE, "npc-pack-pass1.macro.js");
fs.writeFileSync(OUT, `/* npc-pack-pass1.macro.js — NPC Pack v1 full pass, PASS 1 (GENERATED ${new Date().toISOString().slice(0, 10)} by build-npc-pass1.mjs — do not hand-edit; rebuild from a fresh dump).
 * Paste into a GM macro on EMBER and run. DRY_RUN = true prints the whole plan and writes nothing; flip to false to write.
 * Writes to the compendium bbttcc-master-content.npcs (unlocked for the write, re-locked after).
 * What: ART (wire art already on the box) · ICON (broken + grey icons → colour) · DMG (weapon dice → tier budget) ·
 *       SIG (missing lineage resist/vuln/immunities) · ROLE (title out of system.role into rfi.actor.title).
 * Guard: every field is written only if it still holds the value the plan expects (else SKIP + reported).
 * Tally: ${JSON.stringify(tally)} across ${plan.length} actors.  Afterwards: re-dump + \`bin/ft-lint-bestiary\`.
 */
const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.npcs";
const PLAN = ${JSON.stringify(plan)};
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const pack = game.packs.get(PACK_ID); if (!pack) return ui.notifications.error(\`No pack \${PACK_ID}\`);
  const eq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const get = foundry.utils.getProperty;
  const log = []; let wrote = 0, skipped = 0;
  const wasLocked = pack.locked;
  if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
  try {
    for (const p of PLAN) {
      const a = await pack.getDocument(p.id);
      if (!a || a.name !== p.name) { log.push(\`✗ SKIP \${p.name} — not found / renamed\`); skipped++; continue; }
      const upd = {}; for (const [k, v] of Object.entries(p.set)) { if (eq(get(a, k), p.expect[k])) upd[k] = v; else { log.push(\`✗ drift \${p.name} \${k}\`); skipped++; } }
      const iu = [];
      for (const it of p.items) {
        const doc = a.items.get(it.id); if (!doc) { log.push(\`✗ drift \${p.name} › \${it.name} gone\`); skipped++; continue; }
        const u = { _id: it.id }; for (const [k, v] of Object.entries(it.set)) { if (eq(get(doc, k), it.expect[k])) u[k] = v; else { log.push(\`✗ drift \${p.name} › \${it.name} \${k}\`); skipped++; } }
        if (Object.keys(u).length > 1) iu.push(u);
      }
      log.push(\`\${DRY_RUN ? "·" : "✔"} \${p.folder} › \${p.name}  \${p.notes.join(" · ")}\${iu.length ? \`  [\${iu.length} item(s): \${p.items.map(i => i.why).join(" | ")}]\` : ""}\`);
      if (!DRY_RUN) { if (Object.keys(upd).length) await a.update(upd); if (iu.length) await a.updateEmbeddedDocuments("Item", iu); }
      wrote++;
    }
  } finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  console.log(\`[npc-pack-pass1] \${DRY_RUN ? "DRY RUN" : "APPLIED"} — \${wrote} actor(s), \${skipped} skip/drift\\n\` + log.join("\\n"));
  ui.notifications.info(\`npc-pack-pass1 \${DRY_RUN ? "dry run" : "applied"}: \${wrote} actors, \${skipped} skipped — see console (F12).\`);
})();
`);
console.log(`build-npc-pass1 → ${path.relative(process.cwd(), OUT)}  ${JSON.stringify(tally)} across ${plan.length} actors`);
for (const p of plan.filter(p => p.notes.length)) console.log(`  ${p.folder} › ${p.name}: ${p.notes.join(" · ")}`);
console.log(`  + ${plan.reduce((n, p) => n + p.items.length, 0)} item edits (icons/damage)`);
for (const p of plan) for (const i of p.items) if (/DMG/.test(i.why)) console.log(`    ${p.name} › ${i.name}: ${i.why.match(/DMG [^·]+/)[0]}`);

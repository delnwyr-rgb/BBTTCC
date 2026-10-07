#!/usr/bin/env node
/* build-lineage-traits.mjs — PASS 4a: every bestiary monster carries its LINEAGE TRAIT item (and the two weaponless ones get
 * their lineage's signature strike), with the trait's mechanic authored as npc-automation data, not just prose.
 * Usage (repo root): node modules/bbttcc-master-content/tools/build-lineage-traits.mjs <npcs.jsonl>
 *   → writes modules/bbttcc-master-content/tools/npc-pack-pass4-lineage-traits.macro.js
 * Traits come straight from the builder (bbttcc-auto-link/scripts/monster-builder.js LINEAGES / MORTAL_BANNERS / QLIPHOTH),
 * so the lint, the builder and this pass can never disagree on what a lineage's trait IS. Rules below are the trait prose
 * translated into the engine's vocabulary (npc-automation.js); DC-by-tier = 11 + 2×tier.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateNpcAuto } from "./npc-auto-schema.mjs";

const [NPCS] = process.argv.slice(2);
if (!NPCS) { console.error("usage: build-lineage-traits.mjs <npcs.jsonl>"); process.exit(2); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const builderSrc = fs.readFileSync(path.join(HERE, "../../bbttcc-auto-link/scripts/monster-builder.js"), "utf8");
const block = builderSrc.slice(builderSrc.indexOf("const MORTAL_BANNERS"), builderSrc.indexOf("const LINEAGE_BY_KEY"));
const { LINEAGES, MORTAL_BANNERS, QLIPHOTH } = new Function(`${block}; return { LINEAGES, MORTAL_BANNERS, QLIPHOTH };`)();
const LIN = Object.fromEntries(LINEAGES.map(l => [l.key, l]));
const ROMAN = { I: 1, II: 2, III: 3, IV: 4 };
// Owner rulings 2026-10-06 for creatures whose sub-lineage is a flavour word, not a qliphah / banner. Stamped on the actor as
// flags.fourththing.rfi.actor.qliphah (the flavour word in subLineage stays). "Agshekeloh" = Dave's spelling of
// Gha'agsheblah = Gamchicoth (Excess, hull of Chesed). Gilbert = Samael (hull of Hod — his Redemption ending turns him Hod).
const RULED_QLIPHAH = { LQS2jaeFhzFMDpxA: "samael", a0mWjHfmFd2KmWnI: "ghagiel", dskzJNdpkiTFEbik: "thagirion", "Please-Stop-Hitting-Yourself (Qliphothic Loop)": "gamchicoth", "Gerald, Assistant Regional Manager of the Apocalypse": "ghagiel" };
const BANNER_ALIAS = { jackalope: "beast-folk" };   // Jackalope Tinker-Scout → Beast-Folk "Entrepreneurial" (ruled 2026-10-06)
const dcFor = t => 11 + 2 * t;

// ── the trait mechanics, in engine vocabulary ───────────────────────────────────────────────────────────────
const LINEAGE_RULES = {
  wild: (m) => [
    { on: "attack", if: { firstRound: true }, do: { reroll: "attack" }, limit: { per: "combat", uses: 1 }, label: "Territory — the first strike rerolls the lowest" },
    ...(["pack", "predator", "insect"].includes(m.sub) ? [{ on: "attack", if: { allyAdjacentToTarget: true }, do: { reroll: "attack" }, label: "Pack — reroll the lowest beside an ally" }] : []),
  ],
  "hex-touched": () => [
    { on: "zero", do: { heal: 1, prompt: "The hex tries one more thing: it acts for ONE more round (reroll-the-lowest on attacks), then drops." }, limit: { per: "combat", uses: 1 } },
  ],
  "pre-fall": () => [
    { on: "struck", do: { prompt: "Broken Protocol: combat protocol for 3 rounds, then back to the directive if nothing hostile is in sight." }, limit: { per: "combat", uses: 1 } },
  ],
  sephirotic: (m) => [
    { on: "struck", if: { damageType: ["qliphothic"] }, do: { condition: { key: "restrained", duration: "1-round", save: { attr: "soul", dc: dcFor(m.tier) } } }, label: "Correction, Not Anger" },
  ],
  dream: () => [
    { on: "attacked", if: { ownerNotAttacked: true }, do: { reroll: "attack-highest" }, label: "Half-Real — until it attacks, attacks against it reroll the highest" },
    { on: "selfTurnStart", do: { prompt: "Half-Real: moves through creatures and objects as difficult terrain; 1d10 kinetic if it ends inside something solid." }, limit: { per: "combat", uses: 1 } },
  ],
  revenant: () => [
    { on: "hit", do: { heal: "1d4" }, label: "Crystallized Grief — the warmth it takes mends it" },
    { on: "zero", do: { prompt: "Laid to rest, not killed: it reforms next dusk unless the grief that made it is named aloud." } },
  ],
};
const BANNER_RULES = {
  raider: () => [
    { on: "attack", if: { firstRound: true, targetNotActed: true }, do: { reroll: "attack" }, label: "Ambush Crew" },
    { on: "bloodied", do: { morale: { attr: "soul", dc: 12, outcome: "disengages and runs at full speed" } } },
  ],
  sept: () => [{ on: "allyDamaged", radius: 6, do: { ward: 0.5 }, limit: { per: "round", uses: 1 }, label: "Minor Ward" }],
  witness: () => [{ on: "zero", do: { prompt: "Reports Up: its last sight is transmitted to the nearest Witness within a mile." } }],
  valhaulan: () => [{ on: "bloodied", do: { tempIntegrity: 5, prompt: "Storm-Voiced: allies within 6 squares reroll the lowest die on their next attack." }, limit: { per: "scene", uses: 1 } }],
  cultist: () => [{ on: "hit", if: { damageType: ["qliphothic"] }, do: { prompt: "Each Spell Is Also a Wound: the cultist takes 1 qliphothic damage to Stress." } }],
  "oath-bound": () => [{ on: "zero", do: { heal: 1, prompt: "Sworn: drops to 1 instead and gains +2 on its next attack — the oath tries one more thing." }, limit: { per: "combat", uses: 1 } }],
  "beast-folk": () => [{ on: "use", who: "targets", do: { save: { attr: "mind", dc: 12, onSave: "negate" }, prompt: "Entrepreneurial: on a fail the target spends its next action considering the offer." }, limit: { per: "scene", uses: 1 } }],
  unaffiliated: () => [{ on: "bloodied", do: { morale: { attr: "soul", dc: 12, outcome: "GM rolls d6 openly — 1–2 surrender, 3–4 flee, 5–6 fight on" } } }],
};
const AURA_RULES = (q, tier) => {
  const dc = dcFor(tier);
  switch (q) {
    case "thaumiel":      return [{ on: "turnStart", radius: 2, who: "enemies", do: { prompt: "Aura of Duality: rolls twice and keeps the worse on skill checks until the start of its next turn." } }];
    case "ghagiel":       return [{ on: "turnStart", radius: 3, who: "enemies", do: { prompt: "Aura of Obstruction: twice-keep-worse on Mind checks until the start of its next turn." } }];
    case "satariel":      return [{ on: "turnStart", radius: 6, who: "enemies", do: { prompt: "Aura of Concealment: twice-keep-worse on checks to read intentions or see through deception." } }];
    case "gamchicoth":    return [{ on: "turnStart", radius: 4, who: "enemies", do: { save: { attr: "soul", dc, onSave: "negate" }, prompt: "Aura of Excess: on a fail, spends its bonus action on one reckless, pleasurable thing." } }];
    case "golachab":      return [{ on: "turnStart", radius: 4, who: "enemies", do: { prompt: "Aura of Cruelty: any damage taken within 4 squares deals +1d4 psychic to Stress." } }];
    case "thagirion":     return [{ on: "turnStart", radius: 6, who: "enemies", do: { prompt: "Aura of Contention: twice-keep-worse on Presence checks to persuade or de-escalate." } }];
    case "harab-serapel": return [{ on: "turnStart", radius: 6, who: "enemies", do: { save: { attr: "soul", dc, onSave: "negate" }, prompt: "Aura of Avarice: on a fail, its movement goes toward the most valuable object it can see." } }];
    case "samael":        return [{ on: "turnStart", radius: 6, who: "enemies", do: { prompt: "Aura of Vanity: twice-keep-worse on checks to resist being Charmed while it can be seen." } }];
    case "gamaliel":      return [{ on: "turnStart", radius: 4, who: "enemies", do: { save: { attr: "soul", dc, onSave: "negate" }, damage: { formula: "1d4", type: "psychic" } }, label: "Aura of Obscenity" }];
    case "nahemoth":      return [{ on: "turnStart", radius: 2, who: "enemies", do: { condition: { key: "staggered", duration: "1-round", save: { attr: "soul", dc } } }, label: "Aura of Materialism" }];
    default: return null;
  }
};

// ── live pack ───────────────────────────────────────────────────────────────────────────────────────────────
const recs = fs.readFileSync(NPCS, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
const actors = recs.filter(r => r.k.startsWith("!actors!")).map(r => r.v);
const items = {}; for (const r of recs.filter(r => r.k.startsWith("!actors.items!"))) (items[r.k.split("!")[2].split(".")[0]] ??= []).push(r.v);
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const featureItem = (name, desc, flavor, lineage, rules, extraTags = []) => ({
  name, type: "feature", img: "icons/magic/control/silhouette-aura-energy.webp",
  system: { category: "principle", source: "lineage", tags: ["lineage-trait", lineage, ...extraTags], description: { value: `<p>${esc(desc)}</p>${flavor ? `<p><em>${esc(flavor)}</em></p>` : ""}`, chat: "" } },
  flags: { fourththing: { npcAuto: { v: 1, rules }, rfi: { item: { frame: "trait", lineageTrait: lineage } } } },
});
const plan = [], unknown = [], tally = { traits: 0, auras: 0, strikes: 0 };
for (const a of actors) {
  const rfi = a.flags?.fourththing?.rfi?.actor; if (!rfi?.lineage) continue;
  const L = LIN[rfi.lineage]; if (!L) continue;
  const m = { id: a._id, name: a.name, lineage: rfi.lineage, sub: rfi.subLineage, tier: ROMAN[rfi.tier] || 1 };
  const its = items[a._id] || [];
  const p = { id: a._id, name: a.name, items: [], notes: [], set: {} };
  if (rfi.lineage === "qliphothic") {
    const ruled = RULED_QLIPHAH[a._id] ?? RULED_QLIPHAH[a.name] ?? null;
    const qk = rfi.qliphah ?? ruled ?? m.sub;
    if (ruled && rfi.qliphah !== ruled) { p.set["flags.fourththing.rfi.actor.qliphah"] = ruled; p.notes.push(`qliphah → ${ruled} (ruled)`); }
    const q = QLIPHOTH[qk], rules = AURA_RULES(qk, m.tier);
    if (!its.some(i => /^Aura of/i.test(i.name))) {
      if (q && rules) { p.items.push(featureItem(`Aura of ${q.vice}`, q.aura, `${q.label}${qk === "gamchicoth" && /Hitting/.test(a.name) ? " (Agshekeloh)" : ""} — hull of ${q.hullOf}.`, "qliphothic", rules, [m.sub, qk])); p.notes.push(`Aura of ${q.vice}`); tally.auras++; }
      else unknown.push(`${a.name} (qliphothic/${m.sub})`);
    }
  } else {
    const banner = BANNER_ALIAS[m.sub] ?? m.sub;
    const trait = rfi.lineage === "mortal" ? MORTAL_BANNERS[banner]?.trait : L.trait;
    const rules = rfi.lineage === "mortal" ? BANNER_RULES[banner]?.(m) : LINEAGE_RULES[rfi.lineage]?.(m);
    if (!trait || !rules) { unknown.push(`${a.name} (${rfi.lineage}/${m.sub})`); }
    else if (!its.some(i => i.name.toLowerCase().includes(trait.name.toLowerCase()))) { p.items.push(featureItem(trait.name, trait.desc, trait.flavor, rfi.lineage, rules, m.sub ? [m.sub] : [])); p.notes.push(trait.name); tally.traits++; }
  }
  // the lineage's signature strike for monsters with NO weapon at all (B4)
  if (!its.some(i => i.type === "weapon") && L.strike) {
    const s = L.strike, dice = { 1: "1d8", 2: "2d6", 3: "2d8", 4: "2d10" }[m.tier];
    p.items.push({ name: s.name, type: "weapon", img: "icons/weapons/swords/swords-sharp-worn.webp",
      system: { category: s.melee ? "melee" : "ranged", intent: "violence", skill: s.melee ? "melee" : "ranged", damage: { formula: dice, type: s.damageType, damageFlavor: s.damageFlavor || "", attribute: "violence", track: ["psychic", "qliphothic"].includes(s.damageType) ? "stress" : "integrity" }, range: s.melee ? { value: s.reach || 5, units: "ft" } : { value: s.shortRange || 30, long: s.longRange || 90, units: "ft" }, effect: s.riderText || "", tags: ["lineage-strike", rfi.lineage], description: { value: `<p>${esc(s.riderText || "")}</p>`, chat: "" } },
      flags: { fourththing: { rfi: { item: { frame: "attack", lineageStrike: rfi.lineage } }, npcAuto: s.riderText ? { v: 1, rules: [{ on: "hit", do: { prompt: s.riderText.slice(0, 118) } }] } : undefined } } });
    p.notes.push(`signature strike ${s.name} ${dice}`); tally.strikes++;
  }
  for (const it of p.items) { const probs = validateNpcAuto(it.flags?.fourththing?.npcAuto, `${a.name} › ${it.name}: `); if (probs.length) { console.error(probs.join("\n")); process.exit(1); } }
  if (p.items.length || Object.keys(p.set).length) plan.push(p);
}

const OUT = path.join(HERE, process.argv[3] || "npc-pack-pass4-lineage-traits.macro.js");
fs.writeFileSync(OUT, `/* npc-pack-pass4-lineage-traits.macro.js — NPC Pack v1 PASS 4a: Lineage Trait items + signature strikes (GENERATED
 * ${new Date().toISOString().slice(0, 10)} by build-lineage-traits.mjs — do not hand-edit). GM macro on EMBER; DRY_RUN = true prints the plan.
 * Adds each monster's lineage trait as a feature item carrying npc-automation rules, and a signature strike to the two
 * weaponless monsters. World copies (same ids) get the same items. Name-checked; skips monsters that already carry the trait.
 * Tally: ${JSON.stringify(tally)}${unknown.length ? ` · no trait defined for: ${unknown.join("; ")}` : ""}
 */
const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.npcs";
const PLAN = ${JSON.stringify(plan)};
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const pack = game.packs.get(PACK_ID); if (!pack) return ui.notifications.error(\`No pack \${PACK_ID}\`);
  const log = []; let wrote = 0, skipped = 0;
  const wasLocked = pack.locked; if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
  try {
    for (const ctx of ["world", "pack"]) for (const p of PLAN) {
      const a = ctx === "world" ? game.actors.get(p.id) : await pack.getDocument(p.id).catch(() => null);
      if (!a) { if (ctx === "pack") { log.push(\`✗ [pack] \${p.name} missing\`); skipped++; } continue; }
      if (a.name !== p.name) { log.push(\`✗ [\${ctx}] \${p.id} is "\${a.name}" (expected "\${p.name}")\`); skipped++; continue; }
      const add = p.items.filter(it => !a.items.find(x => x.name === it.name));
      const set = Object.fromEntries(Object.entries(p.set ?? {}).filter(([k, v]) => foundry.utils.getProperty(a, k) !== v));
      if (!add.length && !Object.keys(set).length) { log.push(\`· ok [\${ctx}] \${a.name}\`); continue; }
      log.push(\`\${DRY_RUN ? "·" : "✔"} [\${ctx}] \${a.name}: \${add.length ? "+ " + add.map(i => i.name).join(", ") : ""}\${Object.keys(set).length ? " · " + Object.entries(set).map(([k, v]) => k.split(".").pop() + "=" + v).join(", ") : ""}\`);
      if (!DRY_RUN) { if (Object.keys(set).length) await a.update(set); if (add.length) await a.createEmbeddedDocuments("Item", add); }
      wrote += add.length;
    }
  } finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  console.log(\`[npc-pack-pass4-lineage-traits] \${DRY_RUN ? "DRY RUN" : "APPLIED"} — \${wrote} item(s), \${skipped} skipped\\n\` + log.join("\\n"));
  ui.notifications.info(\`npc-pack-pass4-lineage-traits \${DRY_RUN ? "dry run" : "applied"}: \${wrote} items, \${skipped} skipped — see console (F12).\`);
})();
`);
console.log(`build-lineage-traits → ${path.relative(process.cwd(), OUT)}  ${JSON.stringify(tally)} across ${plan.length} monsters`);
if (unknown.length) console.log(`  no trait defined (ask Dave): ${unknown.join("; ")}`);

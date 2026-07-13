#!/usr/bin/env node
// Generate the npc-callings compendium source — the six non-Surge, NPC-grade
// Callings (one per faculty) per CALLINGS-NPC-CLASSES-2026-07-11.md. Each
// Calling = 1 class item (identity + Knack + aptitude kit + service pool) and
// 4 tier features (Trade row + Trick per tier). Zero Surge coupling by
// construction — these identifiers never appear in _FT_SURGE_MENU or any
// generation hook.
//
//   node modules/bbttcc-character-options/tools/build-npc-callings.mjs   # regen JSON
//   node modules/bbttcc-character-options/tools/compile-npc-callings.mjs # JSON → LevelDB

import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const MOD  = resolve(here, "..");
const OUT  = resolve(MOD, "packs/_source/npc-callings");

const TIER_TITLE = { 1: "Apprentice", 2: "Initiate", 3: "Master", 4: "Archon" };
const TIER_FEE   = { 1: 10, 2: 30, 3: 90, 4: 270 };
const ROMAN      = { 1: "I", 2: "II", 3: "III", 4: "IV" };

const CALLINGS = [
  {
    key: "bravo", code: "brv", name: "Bravo", faculty: "violence",
    img: "icons/svg/sword.svg", pool: "Violence",
    signature: "melee", secondary: "brawl",
    flavor: "Somebody has to stand where the trouble is.",
    umbrella: "guard, soldier, bandit, bouncer, duelist, caravan outrider",
    knack: ["Shieldwall", "Allies within reach add <strong>+1 Guard</strong> (+2 at Tier III). The Bravo is why the militia line holds."],
    awakens: "Aurablade or Bulwark",
    trades: [
      ["Stand a watch", "Guard a person, door, or camp for a night/shift."],
      ["Drill the green", "Train a group; they count Trained (rank 1) in one Violence aptitude for the next scene that tests it."],
      ["Muscle for the job", "Accompany one operation as a combatant (full stat participation)."],
      ["Raise the wall", "Marshal a settlement's defense; the hex counts one bracket tougher for one raid (GM adjudicates)."],
    ],
    tricks: [
      ["Hold the Line", "When an adjacent ally is hit, the Bravo takes the hit instead."],
      ["Disarming Blow", "On a hit, the target drops its weapon or takes −2 on its next strike."],
      ["Veteran's Read", "Declare one enemy's next move aloud; all allies get +2 to defend against exactly that."],
      ["Last Stand", "When an ally within reach would drop to 0 Integrity, the Bravo intercepts, takes the damage, and makes one immediate free strike."],
    ],
  },
  {
    key: "operator", code: "opr", name: "Operator", faculty: "intrigue",
    img: "icons/svg/cowled.svg", pool: "Intrigue",
    signature: "stealth", secondary: "streetwise",
    flavor: "Everything's a door if you hold it right.",
    umbrella: "thief, smuggler, spy, courier, fence, hacker, fixer",
    knack: ["Underfoot", "In crowds, markets, and streets, the Operator passes unremarked unless actively hunted; Streetwise checks never fumble (at Tier III, also Stealth)."],
    awakens: "Shadow Courier",
    trades: [
      ["Carry it quiet", "Move a package/message across town, no questions."],
      ["Fence it", "Move stolen goods at ×0.30 instead of the standard fence ×0.25."],
      ["Case the place", "Deliver a floor plan — entrances, watch rotations, one exploitable habit."],
      ["Papers, clean", "Forge documents/seals good enough to pass sept or Witness scrutiny once."],
    ],
    tricks: [
      ["Pocketed", "Produce a mundane Tier-I item they plausibly lifted earlier."],
      ["Wasn't Me", "After acting, vanish from the scene's notice if no one has them physically held."],
      ["Skeleton Key", "Bypass one lock, checkpoint, or seal, offscreen-grade, no roll."],
      ["Ghost Ledger", "One small fact of record (a manifest line, a name on a list, a shipment count) has always read the way the Operator needs it to."],
    ],
  },
  {
    key: "broker", code: "brk", name: "Broker", faculty: "presence",
    img: "icons/svg/sound.svg", pool: "Diplomacy or Soft Power (GM picks by job)",
    signature: "diplomacy", secondary: "empathy",
    flavor: "There is no problem two reasonable parties can't monetize.",
    umbrella: "merchant, envoy, entertainer, cult recruiter, gang face",
    knack: ["Fair Price", "The Broker moves any negotiated price <strong>5% per tier</strong> in their side's favor inside the ±25% tolerance band (Tier IV: the full ±20% swing)."],
    awakens: "Harmony Marshal",
    trades: [
      ["Word on the street", "Current prices, current rumors, who's buying."],
      ["An introduction", "Arrange a meeting with someone one social rung up."],
      ["Shape the story", "Seed or smother one rumor across a settlement over a downtime."],
      ["The table", "Convene a parley between hostile parties who would not otherwise sit."],
    ],
    tricks: [
      ["Read the Room", "GM truthfully answers: who here has the real power, and what do they want right now?"],
      ["Crowd's Ear", "Sway a crowd's disposition one step (hostile→wary, wary→listening)."],
      ["Name-Drop", "Invoke a connection to open one door; the GM decides what string comes attached."],
      ["Deal of a Lifetime", "Mid-scene, produce terms both sides prefer to violence; fighting stops while the offer stands."],
    ],
  },
  {
    key: "stalwart", code: "stw", name: "Stalwart", faculty: "body",
    img: "icons/svg/anchor.svg", pool: "Economy",
    signature: "athletics", secondary: "plating",
    flavor: "The Shattering didn't end the work. Nothing ends the work.",
    umbrella: "laborer, teamster, forager, wall-crew, rig-hand, survivor",
    knack: ["Hazard-Hardened", "Reduce each environmental hazard/radiation tick by 1 (by 2 at Tier III), and labor output counts double for facility/build work."],
    awakens: "Bulwark or Soul-Smith",
    trades: [
      ["Haul and raise", "A day's heavy labor — cargo moved, wall raised, field cleared."],
      ["Keep her running", "One rig repair tick between scenes (engineer-grade maintenance)."],
      ["Guide through", "Lead a party across one hex of hostile terrain, halving travel complications."],
      ["Foreman", "Run a work crew; a facility's output counts +1 bracket for one turn."],
    ],
    tricks: [
      ["Put Your Back Into It", "Auto-succeed one feat of raw strength or endurance of tier-appropriate difficulty."],
      ["Endure", "Halve one incoming instance of kinetic damage."],
      ["Second Wind", "Recover Integrity equal to 2×tier."],
      ["Too Stubborn to Die", "Damage that would drop the Stalwart leaves them at 1 Integrity, still standing, immovable this round."],
    ],
  },
  {
    key: "savant", code: "sav", name: "Savant", faculty: "mind",
    img: "icons/svg/book.svg", pool: "Economy or Soft Power (GM picks by job)",
    signature: "lore", secondary: "investigation",
    flavor: "It's not obscure. You just haven't read it.",
    umbrella: "scholar, engineer, medic, archivist, detective, translator",
    knack: ["Library-Brain", "Lore and Investigation checks never fumble; identifies items of tier ≤ own tier on sight (at Tier III, including technomagical origin)."],
    awakens: "Wyrdlens Adept or Cosmic Linguist",
    trades: [
      ["Appraise / identify", "What it is, what it's worth, whether it's what the seller claims."],
      ["Patch them up", "Between scenes, restore 2×tier Integrity to one patient or clear one physical condition."],
      ["Research a question", "One downtime, one honest answer with sources (GM: truthful, not necessarily complete)."],
      ["Draft the schematic", "Author a crafting recipe for an item of tier ≤ 3 (validator rules still apply)."],
    ],
    tricks: [
      ["I've Read About This", "Explain the situation; one ally gets +2 on their next relevant check."],
      ["Diagnosis", "Name one creature's type and reveal its resistances or a weakness."],
      ["Field Solution", "Jury-rig a one-use tool, antidote, or bypass from what's on hand."],
      ["Eureka", "Solve one technical or lore obstacle outright, offscreen-grade; it simply stops being the blocker."],
    ],
  },
  {
    key: "keeper", code: "kpr", name: "Keeper", faculty: "soul",
    img: "icons/svg/temple.svg", pool: "Soft Power",
    signature: "faith", secondary: "insight",
    flavor: "The dead are fine. It's the living who need tending.",
    umbrella: "priest, ritualist, medium, hedge-warden, funeral speaker",
    knack: ["Hearthlight", "Allies within near range add <strong>+1 Resolve</strong> (+2 at Tier III). The congregation stands straighter when the Keeper is present."],
    awakens: "Pactkeeper or Dreamwalker",
    trades: [
      ["The rites", "Weddings, funerals, blessings; participants recover 2×tier Stress between scenes."],
      ["Hear the burden", "One confession/counsel session clears one fear- or grief-borne condition."],
      ["Consecrate the threshold", "Ward one door/room/camp — first qliphothic or psychic intrusion each scene is blunted (−2 to its effect)."],
      ["Read the omens", "One divination-grade answer per downtime — a true sign about a chosen course, delivered as an omen, not a sentence."],
    ],
    tricks: [
      ["Steady the Soul", "An ally rerolls a failed Resolve defense or immediately shakes a fear effect."],
      ["Warding Sign", "Impose −2 on one incoming psychic or qliphothic effect."],
      ["Rite of Passage", "End one ongoing spiritual affliction on a willing subject."],
      ["Intercession", "An ally under the Keeper's care who would drop to 0 Stress holds at 1; the Keeper visibly carries it for them."],
    ],
  },
];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function classDescription(c) {
  const feeRow = [1, 2, 3, 4].map(t => `T${t} ${TIER_FEE[t]}`).join(" / ");
  return [
    `<p><em>"${c.flavor}"</em></p>`,
    `<p><strong>${c.name}</strong> is the ${cap(c.faculty)} Calling — the trade that kept its bearers alive after the Shattering. Umbrella: ${c.umbrella}. A profession is a flavor label on the Calling.</p>`,
    `<p><strong>Knack — ${c.knack[0]}:</strong> ${c.knack[1]}</p>`,
    `<p><strong>Aptitude kit:</strong> signature aptitude <strong>${cap(c.signature)}</strong> rank = tier; secondary <strong>${cap(c.secondary)}</strong> rank = tier − 1.</p>`,
    `<p><strong>Services:</strong> a standard job costs the tier fee (${feeRow} marks), paid in <strong>${c.pool}</strong> marks. Cross-pool ×1.5 friction applies as usual.</p>`,
    `<p><strong>Tiers:</strong> Apprentice → Initiate → Master → Archon. Grant the matching tier features alongside this class item.</p>`,
    `<p><strong>Awakens into:</strong> ${c.awakens}. A Steward is a Calling that ignited into a Path — Surge is the mark of Stewardship, which is why no Calling banks or spends it.</p>`,
  ].join("");
}

function tierDescription(c, t) {
  const [tradeName, tradeText] = c.trades[t - 1];
  const [trickName, trickText] = c.tricks[t - 1];
  return [
    `<p><strong>${c.name} — ${TIER_TITLE[t]}</strong> (Tier ${ROMAN[t]}).</p>`,
    `<p><strong>Trade — ${tradeName}:</strong> ${tradeText} <span style="opacity:0.7">Standard fee ${TIER_FEE[t]} marks (${c.pool}).</span></p>`,
    `<p><strong>Trick — ${trickName}</strong> <em>(1/scene)</em>: ${trickText}</p>`,
    t === 3 ? `<p><em>Master step:</em> the ${c.name}'s Knack (${c.knack[0]}) improves at this tier — see the class entry.</p>` : "",
  ].join("");
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let n = 0;
for (const [i, c] of CALLINGS.entries()) {
  const classDoc = {
    _id: `becalling${c.code}0cls`,
    name: c.name,
    type: "class",
    img: c.img,
    system: {
      category: "calling",
      identifier: `calling-${c.key}`,
      source: "Callings",
      tags: ["calling", c.key, c.faculty],
      description: { value: classDescription(c), chat: "" },
    },
    effects: [],
    folder: null,
    sort: (i + 1) * 100000,
    ownership: { default: 0 },
    flags: {
      bbttcc: { kind: "calling" },
      fourththing: {
        calling: {
          key: c.key, faculty: c.faculty,
          signature: c.signature, secondary: c.secondary,
          pool: c.pool, awakens: c.awakens,
        },
      },
    },
  };
  writeFileSync(resolve(OUT, `${c.key}.json`), JSON.stringify(classDoc, null, 2) + "\n");
  n++;

  for (const t of [1, 2, 3, 4]) {
    const featDoc = {
      _id: `becalling${c.code}0t0${t}`,
      name: `${c.name} — ${TIER_TITLE[t]} (Tier ${ROMAN[t]})`,
      type: "feature",
      img: c.img,
      system: {
        category: "calling",
        source: "Callings",
        tags: ["calling", c.key, `tier-${t}`],
        description: { value: tierDescription(c, t), chat: "" },
      },
      effects: [],
      folder: null,
      sort: (i + 1) * 100000 + t * 1000,
      ownership: { default: 0 },
      flags: { fourththing: { calling: { key: c.key, tier: t } } },
    };
    writeFileSync(resolve(OUT, `${c.key}-t${t}.json`), JSON.stringify(featDoc, null, 2) + "\n");
    n++;
  }
}
console.log(`Wrote ${n} source items → ${OUT}`);

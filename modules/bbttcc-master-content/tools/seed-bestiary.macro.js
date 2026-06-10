// Bad Eden — Phase 9 Seed: Bestiary (2026-05-11)
// ─────────────────────────────────────────────────────────────────────────────
// Seeds 28 NPC actors into game.actors covering T1–T4 across raider, wildlife,
// witness, sept, hex-touched, pre-fall, and legendary themes. Each NPC carries:
//   • full stat block (attributes / derived / skills slot / tags)
//   • flags.fourththing.rfi.actor.price (bounty/hire/ransom per rubric §9)
//   • flags.fourththing.rfi.actor.bestiary
//       - themes  (string[] for encounter-table assignment)
//       - role    (humanoid / beast / construct / undead / fiend)
//       - lootTable [{ name, qty, weight }]  — encounter engine resolves names
//                                              against world/compendium items
//
// Knobs:
//   DRY_RUN — true: log payloads, don't write
//   SKIP_EXISTING — true: skip NPCs whose name already exists
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const DRY_RUN = false;
  const SKIP_EXISTING = true;

  const pricing = game.fourththing?.pricing;
  if (!pricing) {
    ui.notifications?.error("game.fourththing.pricing unavailable — is rfi-pricing.js loaded?");
    return;
  }

  // ── Per-bracket × tier integrity (mirrors seed-rigs-facilities-bosses) ──
  const INTEGRITY = {
    light:  { I: 25, II: 32, III: 39, IV: 46 },
    medium: { I: 40, II: 50, III: 60, IV: 70 },
    heavy:  { I: 60, II: 75, III: 90, IV: 105 }
  };
  const TIER_INT = { I: 1, II: 2, III: 3, IV: 4 };

  // ── Attribute baselines by tier × role-archetype ──
  // role: brute / caster / stealth / scout / hardened
  function attrsFor(role, tier) {
    const t = TIER_INT[tier] ?? 1;
    const bonus = Math.max(0, t - 1);   // +1 per tier above I
    const base = {
      brute:    { violence: 3, intrigue: 1, presence: 2, body: 3, mind: 1, soul: 1 },
      caster:   { violence: 1, intrigue: 2, presence: 2, body: 1, mind: 2, soul: 4 },
      stealth:  { violence: 2, intrigue: 4, presence: 1, body: 2, mind: 2, soul: 1 },
      scout:    { violence: 2, intrigue: 3, presence: 2, body: 2, mind: 3, soul: 1 },
      hardened: { violence: 2, intrigue: 1, presence: 2, body: 4, mind: 1, soul: 2 }
    }[role] || { violence: 2, intrigue: 2, presence: 2, body: 2, mind: 2, soul: 2 };
    const out = {};
    for (const k of Object.keys(base)) out[k] = { value: base[k] + bonus };
    return out;
  }

  // ── Build NPC payload from compact spec ──
  function buildNPC(spec) {
    const integrity = INTEGRITY[spec.bracket][spec.tier];
    const stress = Math.floor(integrity * 0.5);
    const guard  = 10 + Math.floor((spec.tier === "I" ? 1 : TIER_INT[spec.tier]));
    const evasion = guard + (spec.role === "stealth" ? 2 : 0);
    const resolve = guard + (spec.role === "caster" ? 2 : 0);
    const prices = pricing.computeBossPricing({ tier: spec.tier, bracket: spec.bracket });
    const currency = spec.currency || "violence";

    return {
      name: spec.name,
      type: "npc",
      img:  spec.img || "icons/svg/mystery-man.svg",
      system: {
        role:      spec.role,
        tier:      TIER_INT[spec.tier],
        factionId: "",
        notes:     spec.blurb || "",
        details:   { level: TIER_INT[spec.tier], tier: TIER_INT[spec.tier], statPoints: 0, skillPoints: 0 },
        faction:   { id: null, loyalty: 0 },
        attributes: attrsFor(spec.role, spec.tier),
        skills:     {},
        derived:    {
          integrity: { value: integrity, max: integrity },
          stress:    { value: stress, max: stress },
          guard:     { value: guard },
          evasion:   { value: evasion },
          resolve:   { value: resolve }
        },
        magic:        { clarity: { value: 2, max: 5 }, noise: { value: 0, max: 10 }, sephirah: spec.sephirah || "malkuth" },
        resources:    {
          frameDice:   { current: 0, max: 0 },
          ruinCharges: { current: 0, max: 0 },
          pace:        { current: 0, max: 0 },
          package:     { type: "", id: "", carried: false },
          burn:        { current: 0, max: 8 },
          aura:        { state: "none" },
          // accessDice removed 2026-05-20 — replaced by `pace` (Shadow Courier canon)
          surge:       { value: 0, max: 10, sceneResetAt: null },
          dreamResonance: { active: false, insightUsed: false, hexSephirah: "" },
          forgeCharge: { relicUsed: false, sparksRepaired: 0 }
        },
        conditions:   {},
        actions:      { actionUsed: false, bonusUsed: false, reactionUsed: false, movementUsedFt: 0, movementBudgetFt: 30 },
        defenses:     { resistances: spec.resistances || [], immunities: [], vulnerabilities: spec.vulnerabilities || [] },
        conditionImmunities: spec.conditionImmunities || [],
        tags:         [],
        radiation:    { rp: 0, thresholds: { minor: 25, major: 50, severe: 75 } },
        darkness:     { value: 0, taint: 0, fragments: [] }
      },
      flags: {
        fourththing: {
          rfi: {
            actor: {
              tier:      spec.tier,
              bracket:   spec.bracket,
              archetype: spec.archetype || spec.name.toLowerCase().replace(/\s+/g, "-"),
              bestiary:  {
                themes:    spec.themes || [],
                role:      spec.role,
                lootTable: spec.loot || []
              },
              price: {
                marks:        prices.bounty,
                bounty:       prices.bounty,
                hire:         prices.hire,
                ransom:       prices.ransom,
                currency,
                gmOverride:   false,
                notes:        `T${spec.tier} ${spec.bracket} ${spec.role} (bestiary) — bounty ${prices.bounty} / hire ${prices.hire} / ransom ${prices.ransom} marks (paid in ${currency})`
              }
            }
          }
        }
      }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //   ROSTER  (28 entries)
  // ─────────────────────────────────────────────────────────────────────────

  const ROSTER = [
    // ── T1 wildlife / scavengers (8) ────────────────────────────────────
    { name: "Hex-Touched Stray", tier: "I", bracket: "light", role: "brute",
      archetype: "hex-stray", themes: ["wildlife", "hex-touched", "feral"], currency: "violence",
      blurb: "A feral dog warped by hex-script ambient corruption. Pack hunter, low cunning.",
      loot: [{ name: "Heart-Iron Shaving", qty: "1d3", weight: 5 }, { name: "Scrap Salvage", qty: "1", weight: 3 }],
      img: "icons/creatures/abilities/paw-print-pink.webp" },
    { name: "Dust Scavenger", tier: "I", bracket: "light", role: "stealth",
      archetype: "dust-scavenger", themes: ["humanoid", "raider", "scavenger"], currency: "violence",
      blurb: "A scrap-clad survivor turned predator. Carries rusty knives and stolen rations.",
      loot: [{ name: "Scrap Salvage", qty: "1d4", weight: 5 }, { name: "Bronze Nail", qty: "1d3", weight: 3 }],
      img: "icons/environment/people/commoner.webp" },
    { name: "Bog-Skitter Swarm", tier: "I", bracket: "light", role: "brute",
      archetype: "bog-skitter", themes: ["wildlife", "swarm", "insect"], currency: "violence",
      vulnerabilities: ["fire"],
      blurb: "Insect swarm that boils out of stagnant mire when disturbed. Bites are venomous.",
      loot: [{ name: "Mire-Resin", qty: "1d2", weight: 4 }, { name: "Reagent Moss", qty: "1", weight: 2 }],
      img: "icons/creatures/abilities/mouth-teeth-rotted.webp" },
    { name: "Septless Wanderer", tier: "I", bracket: "light", role: "caster",
      archetype: "septless-wanderer", themes: ["humanoid", "cultist", "lost"], currency: "softpower",
      blurb: "A drifter whose oath broke years ago. Mumbles prayers to no one, lashes out reflexively.",
      loot: [{ name: "Prayer Resin", qty: "1", weight: 4 }, { name: "Witness-Glass", qty: "1", weight: 1 }],
      img: "icons/environment/people/cleric-grey.webp" },
    { name: "Salt Wraith", tier: "I", bracket: "light", role: "caster",
      archetype: "salt-wraith", themes: ["undead", "haunting"], currency: "softpower",
      resistances: ["kinetic"], vulnerabilities: ["radiant"], conditionImmunities: ["charmed", "shaken"],
      blurb: "Battlefield revenant of crystallized grief. Drains warmth and resolve.",
      loot: [{ name: "Salt Block", qty: "1d3", weight: 5 }, { name: "Memory Resin", qty: "1", weight: 2 }],
      img: "icons/creatures/magical/spirit-undead-armored-blue.webp" },
    { name: "Pre-Fall Drone", tier: "I", bracket: "light", role: "scout",
      archetype: "pre-fall-drone", themes: ["construct", "pre-fall", "relic"], currency: "intrigue",
      resistances: ["radiant", "kinetic"], conditionImmunities: ["charmed", "shaken", "compelled"],
      blurb: "A still-functioning servitor from before the Fall. Limited directive set; loops on broken protocol.",
      loot: [{ name: "Pre-Fall Component", qty: "1", weight: 1 }, { name: "Soft Alloy", qty: "1d2", weight: 5 }],
      img: "icons/commodities/tech/cog-bronze.webp" },
    { name: "Reed-Skin Stalker", tier: "I", bracket: "light", role: "stealth",
      archetype: "reed-skin-stalker", themes: ["wildlife", "ambusher", "amphibian"], currency: "intrigue",
      blurb: "Camouflaged amphibian predator. Strikes from still water, then vanishes.",
      loot: [{ name: "Mire-Resin", qty: "1d3", weight: 5 }, { name: "Freshwater Pearl", qty: "1", weight: 1 }],
      img: "icons/creatures/reptiles/snake-coiled-spotted-grey.webp" },
    { name: "Ash Wolf", tier: "I", bracket: "light", role: "brute",
      archetype: "ash-wolf", themes: ["wildlife", "predator", "pack"], currency: "violence",
      blurb: "Apex pack hunter of the burn-zones. Coat smokes when angered.",
      loot: [{ name: "Herd Leather", qty: "1d2", weight: 5 }, { name: "Ash-Wood", qty: "1", weight: 3 }],
      img: "icons/creatures/abilities/wolf-howl-moon-grey.webp" },

    // ── T2 mid-threat (10) ─────────────────────────────────────────────
    { name: "Witness Initiate", tier: "II", bracket: "light", role: "stealth",
      archetype: "witness-initiate", themes: ["humanoid", "spy", "witness"], currency: "intrigue",
      blurb: "Junior eye of the Witness order. Gathers, reports, dies anonymously.",
      loot: [{ name: "Witness-Glass", qty: "1", weight: 5 }, { name: "Focusing Lens", qty: "1", weight: 2 }],
      img: "icons/commodities/tech/lens-glass.webp" },
    { name: "Sept Acolyte", tier: "II", bracket: "light", role: "caster",
      archetype: "sept-acolyte", themes: ["humanoid", "ritualist", "sept"], currency: "softpower",
      blurb: "Lower-rung ritualist of the Sept. Channels small blessings and minor wards.",
      loot: [{ name: "Prayer Resin", qty: "1d2", weight: 5 }, { name: "Blessed Thread", qty: "1d2", weight: 3 }],
      img: "icons/environment/people/cleric-female.webp" },
    { name: "Raider Marauder", tier: "II", bracket: "medium", role: "brute",
      archetype: "raider-marauder", themes: ["humanoid", "raider", "military"], currency: "violence",
      blurb: "Standing infantry of a raider warband. Disciplined enough to hold a line.",
      loot: [{ name: "Heart-Iron", qty: "1", weight: 4 }, { name: "Rad-Iron", qty: "1d2", weight: 3 }, { name: "Cold-Iron", qty: "1", weight: 2 }],
      img: "icons/environment/people/commoner.webp" },
    { name: "Hex-Iron Berserker", tier: "II", bracket: "medium", role: "brute",
      archetype: "hex-iron-berserker", themes: ["humanoid", "cultist", "berserker"], currency: "violence",
      resistances: ["kinetic"], vulnerabilities: ["radiant"],
      blurb: "Cultist who let the hex-iron sing through them. Pain doesn't register correctly anymore.",
      loot: [{ name: "Hex-Iron Cleat", qty: "1", weight: 5 }, { name: "Hex-Glyph Plate", qty: "1", weight: 1 }],
      img: "icons/skills/melee/strike-axe-blood-red.webp" },
    { name: "Vow-Bound Thrall", tier: "II", bracket: "light", role: "hardened",
      archetype: "vow-bound-thrall", themes: ["humanoid", "oath-bound", "soldier"], currency: "diplomacy",
      conditionImmunities: ["charmed", "compelled"],
      blurb: "Soldier whose loyalty is enforced by a vow-bone implant. Will die before breaking it.",
      loot: [{ name: "Vow-Bone", qty: "1", weight: 2 }, { name: "Oath-Ink", qty: "1", weight: 3 }, { name: "Cold-Iron", qty: "1d2", weight: 4 }],
      img: "icons/equipment/wrist/manacles-iron.webp" },
    { name: "Bone Patriarch", tier: "II", bracket: "medium", role: "caster",
      archetype: "bone-patriarch", themes: ["humanoid", "necromancer", "elder"], currency: "softpower",
      blurb: "Old-blood ritualist who keeps a finger-bone of every ancestor. They speak; he listens.",
      loot: [{ name: "Finger-Bone", qty: "1d4", weight: 5 }, { name: "Marrow Tincture", qty: "1", weight: 2 }, { name: "Vow-Bone", qty: "1", weight: 1 }],
      img: "icons/skills/melee/strike-skeleton-skull-yellow.webp" },
    { name: "Crystal Lurker", tier: "II", bracket: "light", role: "stealth",
      archetype: "crystal-lurker", themes: ["hex-touched", "ambusher", "cave"], currency: "intrigue",
      blurb: "Hex-touched humanoid encased in slow-growing crystal armor. Strikes from cave shadows.",
      loot: [{ name: "Crystal Fragment", qty: "1d3", weight: 5 }, { name: "Fogged Quartz", qty: "1", weight: 3 }, { name: "Focused Crystal", qty: "1", weight: 1 }],
      img: "icons/magic/water/water-iceberg-bubbles.webp" },
    { name: "Pre-Fall Sentinel", tier: "II", bracket: "medium", role: "hardened",
      archetype: "pre-fall-sentinel", themes: ["construct", "pre-fall", "guardian"], currency: "intrigue",
      resistances: ["kinetic", "radiant"], conditionImmunities: ["charmed", "shaken", "compelled"],
      blurb: "A relic guardian still patrolling a pre-Fall installation. Doesn't recognize the new world.",
      loot: [{ name: "Pre-Fall Component", qty: "1", weight: 2 }, { name: "Heart-Coil", qty: "1", weight: 3 }, { name: "Scribed Steel", qty: "1", weight: 4 }],
      img: "icons/commodities/tech/cog-steel.webp" },
    { name: "Marsh-Tongue Hex", tier: "II", bracket: "medium", role: "caster",
      archetype: "marsh-tongue-hex", themes: ["hex-touched", "eldritch", "wildlife"], currency: "softpower",
      blurb: "Eldritch beast that speaks in tongues no human dialect should produce. Mire and song.",
      loot: [{ name: "Mire-Resin", qty: "1d3", weight: 5 }, { name: "Tree-of-Life Shard", qty: "1", weight: 1 }, { name: "Witness Resin", qty: "1", weight: 2 }],
      img: "icons/creatures/mammals/beast-horned-scaled-glow-pink.webp" },
    { name: "Cinder-Hawk Mother", tier: "II", bracket: "medium", role: "scout",
      archetype: "cinder-hawk-mother", themes: ["wildlife", "predator", "aerial"], currency: "violence",
      blurb: "Apex aerial predator. Smaller than legend; meaner than expected.",
      loot: [{ name: "Herd Leather", qty: "1d2", weight: 4 }, { name: "Ash-Wood", qty: "1d3", weight: 3 }, { name: "Heart-Iron", qty: "1", weight: 2 }],
      img: "icons/creatures/abilities/wings-raven-glow-orange.webp" },

    // ── T3 high-threat (6) ─────────────────────────────────────────────
    { name: "Witness-Warden Lieutenant", tier: "III", bracket: "medium", role: "stealth",
      archetype: "witness-warden-lt", themes: ["humanoid", "spy", "commander"], currency: "intrigue",
      blurb: "Mid-tier spy commander. Operates from shadows, reports up the Witness chain.",
      loot: [{ name: "Witness-Glass", qty: "1d2", weight: 5 }, { name: "Pre-Fall Component", qty: "1", weight: 1 }, { name: "Memory Resin", qty: "1", weight: 3 }],
      img: "icons/equipment/head/hood-leather-grey.webp" },
    { name: "Hex-Touched Champion", tier: "III", bracket: "medium", role: "brute",
      archetype: "hex-touched-champion", themes: ["humanoid", "champion", "corrupted"], currency: "violence",
      resistances: ["kinetic"], vulnerabilities: ["radiant"],
      blurb: "A would-be hero who took on a hex-pact to win and lost in slow motion.",
      loot: [{ name: "Heart-Iron", qty: "1d3", weight: 5 }, { name: "Hex-Glyph Plate", qty: "1", weight: 2 }, { name: "Sacred Gold", qty: "1", weight: 1 }],
      img: "icons/skills/melee/weapons-crossed-swords-purple.webp" },
    { name: "Yesodium Cultist Adept", tier: "III", bracket: "medium", role: "caster",
      archetype: "yesodium-cultist-adept", themes: ["humanoid", "cultist", "caster"], currency: "softpower",
      blurb: "A devotee who learned to hum the Yesodium-channel. Each spell is also a wound.",
      loot: [{ name: "Yesodium", qty: "1", weight: 2 }, { name: "Prayer Resin", qty: "1d2", weight: 4 }, { name: "Witness Resin", qty: "1", weight: 3 }],
      img: "icons/magic/light/orb-lightbulb-glowing-yellow.webp" },
    { name: "Pre-Fall Battlemind", tier: "III", bracket: "heavy", role: "hardened",
      archetype: "pre-fall-battlemind", themes: ["construct", "pre-fall", "ai"], currency: "intrigue",
      resistances: ["kinetic", "radiant", "psychic"], conditionImmunities: ["charmed", "shaken", "compelled", "burning"],
      blurb: "An ancient battlefield AI in a still-functioning frame. Patient. Catastrophic.",
      loot: [{ name: "Pre-Fall Component", qty: "1d2", weight: 5 }, { name: "Heart-Coil", qty: "1d2", weight: 3 }, { name: "Scribed Steel", qty: "1", weight: 4 }],
      img: "icons/magic/lightning/orb-ball-blue.webp" },
    { name: "Tree-of-Life Custodian", tier: "III", bracket: "heavy", role: "caster",
      archetype: "tree-of-life-custodian", themes: ["construct", "guardian", "sacred"], currency: "softpower",
      resistances: ["radiant"], conditionImmunities: ["charmed", "compelled"],
      blurb: "A shrine guardian bound to a Tree-of-Life shard. Sees every intent.",
      loot: [{ name: "Tree-of-Life Shard", qty: "1", weight: 2 }, { name: "Sacred Gold", qty: "1d2", weight: 5 }, { name: "Blessed Thread", qty: "1d2", weight: 4 }],
      img: "icons/environment/wilderness/tree-ash.webp" },
    { name: "Soma-Reaper", tier: "III", bracket: "medium", role: "stealth",
      archetype: "soma-reaper", themes: ["fiend", "dream", "harvester"], currency: "nonlethal",
      conditionImmunities: ["shaken"],
      blurb: "A dream-fiend that harvests Soma-Break echoes from sleepers. Half-real until it strikes.",
      loot: [{ name: "Marrow Tincture", qty: "1", weight: 4 }, { name: "Memory Resin", qty: "1d2", weight: 5 }, { name: "Witness-Glass", qty: "1", weight: 1 }],
      img: "icons/creatures/magical/spirit-undead-horned-blue.webp" },

    // ── T4 legendary (4) ───────────────────────────────────────────────
    { name: "Avatar of the Veil", tier: "IV", bracket: "heavy", role: "caster",
      archetype: "avatar-of-the-veil", themes: ["legendary", "hex-touched", "veil"], currency: "softpower",
      resistances: ["kinetic", "psychic"], conditionImmunities: ["charmed", "shaken", "compelled"],
      blurb: "A walking thinning of the Veil. The world rearranges itself in their presence.",
      loot: [{ name: "Yesodium", qty: "1d2", weight: 4 }, { name: "Tree-of-Life Shard", qty: "1", weight: 2 }, { name: "Vow-Bound Edge", qty: "1", weight: 1 }, { name: "Pre-Fall Component", qty: "1", weight: 2 }],
      img: "icons/magic/holy/projectile-cross-glowing-yellow.webp" },
    { name: "Pre-Fall Apex Construct", tier: "IV", bracket: "heavy", role: "hardened",
      archetype: "pre-fall-apex-construct", themes: ["legendary", "construct", "pre-fall"], currency: "intrigue",
      resistances: ["kinetic", "radiant", "psychic"], conditionImmunities: ["charmed", "shaken", "compelled", "burning", "prone"],
      blurb: "A relic war-machine from before the Fall, somehow still under power.",
      loot: [{ name: "Pre-Fall Component", qty: "1d3", weight: 5 }, { name: "Heart-Coil", qty: "1d2", weight: 4 }, { name: "Yesodium", qty: "1", weight: 2 }, { name: "Soft Alloy", qty: "1d4", weight: 3 }],
      img: "icons/commodities/tech/cog-engraved.webp" },
    { name: "Hex-Warlord's Honored Guard", tier: "IV", bracket: "heavy", role: "brute",
      archetype: "honored-guard", themes: ["legendary", "humanoid", "elite"], currency: "violence",
      conditionImmunities: ["charmed", "shaken"],
      blurb: "Elite bodyguard sworn to a Hex-Warlord. Has killed more heroes than they remember.",
      loot: [{ name: "Hex-Glyph Plate", qty: "1d2", weight: 4 }, { name: "Heart-Iron", qty: "1d3", weight: 5 }, { name: "Sacred Gold", qty: "1", weight: 3 }, { name: "Vow-Bound Edge", qty: "1", weight: 2 }],
      img: "icons/equipment/chest/breastplate-banded-steel.webp" },
    { name: "Witness Apotheon", tier: "IV", bracket: "heavy", role: "caster",
      archetype: "witness-apotheon", themes: ["legendary", "witness", "seer"], currency: "intrigue",
      resistances: ["psychic", "radiant"], conditionImmunities: ["charmed", "compelled", "shaken"],
      blurb: "A Witness who looked too long and now sees everything. Speaks only when ending things.",
      loot: [{ name: "Witness-Glass", qty: "1d3", weight: 5 }, { name: "Witness Resin", qty: "1d2", weight: 4 }, { name: "Pre-Fall Component", qty: "1", weight: 2 }, { name: "Hex-Glyph Plate", qty: "1", weight: 1 }],
      img: "icons/magic/perception/eye-ringed-glow-angry-violet.webp" }
  ];

  // ── Build payloads + filter existing ─────────────────────────────────────
  const payloads = ROSTER.map(buildNPC);
  const toCreate = payloads.filter(p => {
    if (!SKIP_EXISTING) return true;
    const exists = game.actors.find(a => a.name === p.name && a.type === p.type);
    if (exists) console.debug(`[seed-bestiary] skip ${p.name} — already exists`);
    return !exists;
  });

  console.log(`[seed-bestiary] ${DRY_RUN ? "DRY-RUN" : "WET-RUN"} will create ${toCreate.length} NPC(s) (of ${payloads.length} total)`);
  if (toCreate.length) {
    console.table(toCreate.map(p => ({
      name:     p.name,
      tier:     p.flags.fourththing.rfi.actor.tier,
      bracket:  p.flags.fourththing.rfi.actor.bracket,
      role:     p.flags.fourththing.rfi.actor.bestiary.role,
      themes:   p.flags.fourththing.rfi.actor.bestiary.themes.join(","),
      bounty:   p.flags.fourththing.rfi.actor.price.bounty,
      currency: p.flags.fourththing.rfi.actor.price.currency
    })));
  }

  if (!DRY_RUN && toCreate.length) {
    const created = await Actor.createDocuments(toCreate);
    console.log(`[seed-bestiary] created ${created.length} NPC(s) in game.actors`);
    ui.notifications?.info(`Seeded ${created.length} bestiary NPC(s). Open the Actors directory to review.`);
  } else if (DRY_RUN) {
    ui.notifications?.info(`DRY-RUN: would create ${toCreate.length} NPC(s). Flip DRY_RUN = false to commit.`);
  } else {
    ui.notifications?.info("No new NPCs — all 28 already exist (SKIP_EXISTING).");
  }
})();

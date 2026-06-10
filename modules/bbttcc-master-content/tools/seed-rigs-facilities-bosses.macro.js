// Bad Eden — Phase 8 Seed: Rigs / Facilities / Bosses / Personal Rigs (2026-05-10)
// ─────────────────────────────────────────────────────────────────────────────
// Seeds 20 pre-built actor templates into game.actors:
//   • 6 personal rigs   (bracket=personal, single pilot)
//   • 5 war rigs        (light / medium / heavy / siege brackets)
//   • 5 facilities      (siege bracket, mobility=stationary)
//   • 4 bosses          (adversarial archetypes, phase ladder + raid profile)
//
// Each actor carries a price flag at flags.fourththing.rfi.actor.price computed
// from the rubric (§7 rigs, §8 facilities, §9 bosses). Future market.js work
// will resolve these flags for rig/facility/boss catalog entries.
//
// Knobs:
//   DRY_RUN — true: log payloads, don't write
//   SKIP_EXISTING — true: skip actors whose name already exists
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const DRY_RUN = false;
  const SKIP_EXISTING = true;

  const pricing = game.fourththing?.pricing;
  if (!pricing) {
    ui.notifications?.error("game.fourththing.pricing unavailable — is rfi-pricing.js loaded?");
    return;
  }

  // ── Per-bracket integrity sizing ────────────────────────────────────────
  // baseIntegrity + (tier-1) × tierStep, per RIG_BOSS_SCHEMA §1.
  const INTEGRITY_BY_BRACKET = {
    personal: { base: 15, step: 5  },
    light:    { base: 25, step: 7  },
    medium:   { base: 40, step: 10 },
    heavy:    { base: 60, step: 15 },
    siege:    { base: 80, step: 20 }
  };
  const TIER_INT = { I: 1, II: 2, III: 3, IV: 4 };

  function rigIntegrity(bracket, tier) {
    const b = INTEGRITY_BY_BRACKET[bracket] ?? INTEGRITY_BY_BRACKET.light;
    const t = TIER_INT[tier] ?? 1;
    return b.base + (t - 1) * b.step;
  }

  // Pool-resolution helper: explicit > category default (rigs default Violence,
  // facilities Economy, bosses by archetype).
  function resolveCurrency(explicit, fallback) {
    return explicit && explicit !== "auto" ? explicit : (fallback ?? "economy");
  }

  // ── Build a rig actor payload (used for personal rigs, war rigs, facilities) ─
  function buildRigData(spec) {
    const integrity = rigIntegrity(spec.bracket, spec.tier);
    const marks = pricing.computeRigListPrice({ tier: spec.tier, bracket: spec.bracket });
    const currency = resolveCurrency(spec.currency, spec.bracket === "siege" ? "economy" : (spec.civilian ? "economy" : "violence"));

    const monthlyYield = Number(spec.monthlyYieldMarks) || 0;
    const finalMarks = (spec.mobility === "stationary" && monthlyYield > 0)
      ? pricing.computeFacilityListPrice({ tier: spec.tier, bracket: spec.bracket, monthlyYieldMarks: monthlyYield })
      : marks;

    return {
      name: spec.name,
      type: "rig",
      img:  spec.img || "icons/svg/cog.svg",
      system: {
        identity: {
          mobility: spec.mobility || "mobile",
          state:    "parked",
          factionOwnerId: "",
          archetype: spec.archetype || spec.name.toLowerCase().replace(/\s+/g, "-"),
          binding: { hexId: "", sceneId: "", tokenId: "" }
        },
        crew: {
          slots: [],
          capacity: spec.capacity || {
            pilot:    { min: spec.bracket === "personal" ? 1 : (spec.mobility === "stationary" ? 0 : 1), max: 1 },
            gunner:   { min: 0, max: spec.gunnerSlots ?? 0 },
            engineer: { min: 0, max: spec.engineerSlots ?? 0 },
            crew:     { min: 0, max: spec.crewSlots ?? 0 }
          },
          crewMin: spec.mobility === "stationary" ? 0 : 1,
          crewMax: (spec.gunnerSlots ?? 0) + (spec.engineerSlots ?? 0) + (spec.crewSlots ?? 0) + 1
        },
        integrity: { value: integrity, max: integrity, tier: TIER_INT[spec.tier] ?? 1, bracket: spec.bracket },
        defenses:  { resistances: spec.resistances || [], immunities: [], vulnerabilities: [] },
        conditionImmunities: [],
        output: {
          modules: [],
          basePerTurn: spec.basePerTurn || {}
        },
        travel: spec.mobility === "stationary"
          ? { speed: 0, range: 0, hazardResist: 0 }
          : { speed: spec.speed ?? 3, range: spec.range ?? 10, hazardResist: spec.hazardResist ?? 0 },
        tags: spec.tags || []
      },
      flags: {
        fourththing: {
          rfi: {
            actor: {
              tier:     spec.tier,
              bracket:  spec.bracket,
              archetype: spec.archetype || spec.name,
              price: {
                marks:        finalMarks,
                currency,
                gmOverride:   false,
                split:        null,
                notes:        `T${spec.tier} ${spec.bracket} rig × bracket × ${pricing.rigBracketMult(spec.bracket)}${monthlyYield > 0 ? ` (facility floor = max(rig, yield×30=${monthlyYield * 30}))` : ""}`
              }
            }
          }
        }
      }
    };
  }

  // ── Build a boss actor payload ──────────────────────────────────────────
  function buildBossData(spec) {
    const integrity = rigIntegrity(spec.bracket, spec.tier);
    const prices = pricing.computeBossPricing({ tier: spec.tier, bracket: spec.bracket });
    const currency = resolveCurrency(spec.currency, "violence");  // default Violence for adversarial

    return {
      name: spec.name,
      type: "boss",
      img:  spec.img || "icons/svg/blood.svg",
      system: {
        identity: { archetype: spec.archetype || spec.name.toLowerCase().replace(/\s+/g, "-"), factionId: "", portraitVariants: [] },
        phases:   {
          ladder: (spec.phases || []).map((p, i) => ({
            label:                p.label    || `Phase ${i+1}`,
            integrityThreshold:   p.threshold ?? Math.max(0, 100 - i * 33),
            onEnterEffects:       [],
            manifestationGrants:  [],
            surgeBoost:           p.surgeBoost ?? (i + 1)
          })),
          currentPhase: 0
        },
        integrity: { value: integrity, max: integrity, tier: TIER_INT[spec.tier] ?? 1, bracket: spec.bracket },
        defenses:  { resistances: spec.resistances || [], immunities: [], vulnerabilities: [] },
        conditionImmunities: [],
        manifestations: { library: [], surge: { current: 0, max: 6, exploded: 0 }, momentum: 0 },
        doctrine:  { slot: "", maneuverKeys: [] },
        powers:    { powers: [], cooldowns: {} },
        behaviors: { behaviors: [], triggerState: {} },
        raidStats: { rounds: 0, morale: spec.morale ?? 3, infiltration: 0, alarm: 0 },
        raidProfile: {
          key: spec.archetype || spec.name.toLowerCase().replace(/\s+/g, "-"),
          mode: spec.raidMode || "hybrid",
          moraleHits: spec.moraleHits ?? 4,
          hitTrack: "",
          tagsRaw: "",
          opStats: spec.opStats || { violence: 0, nonlethal: 0, intrigue: 0, economy: 0, softpower: 0, diplomacy: 0, logistics: 0, culture: 0, faith: 0 },
          behaviorsRaw: "[]"
        },
        tags: spec.tags || []
      },
      flags: {
        fourththing: {
          rfi: {
            actor: {
              tier:     spec.tier,
              bracket:  spec.bracket,
              archetype: spec.archetype || spec.name,
              price: {
                marks:        prices.bounty,    // headline = bounty
                bounty:       prices.bounty,
                hire:         prices.hire,
                ransom:       prices.ransom,
                currency,
                gmOverride:   false,
                notes:        `T${spec.tier} ${spec.bracket} boss — bounty ${prices.bounty} / hire ${prices.hire} / ransom ${prices.ransom} marks (paid in ${currency})`
              }
            }
          }
        }
      }
    };
  }

  // ── PERSONAL RIGS (6) ───────────────────────────────────────────────────
  const PERSONAL_RIGS = [
    { name: "Dust Skiff",          tier: "I",  bracket: "personal", mobility: "mobile",
      civilian: true,  currency: "economy",   archetype: "dust-skiff",
      speed: 3, range: 12, hazardResist: 0, tags: ["civilian", "commuter"],
      img: "icons/environment/wilderness/cave-entry-dwarven-hidden.webp" },
    { name: "Hex-Jumper Bike",     tier: "I",  bracket: "personal", mobility: "mobile",
      currency: "violence",  archetype: "hex-jumper",
      speed: 5, range: 8,  hazardResist: 1, tags: ["military", "scout"],
      img: "icons/commodities/tech/wheel-spoked-wood.webp" },
    { name: "Salvage Trike",       tier: "I",  bracket: "personal", mobility: "mobile",
      civilian: true,  currency: "economy",   archetype: "salvage-trike",
      speed: 2, range: 14, hazardResist: 1, tags: ["civilian", "scavenger"],
      img: "icons/commodities/tech/cog-bronze.webp" },
    { name: "Septlight Speeder",   tier: "II", bracket: "personal", mobility: "mobile",
      currency: "softpower", archetype: "septlight-speeder",
      speed: 6, range: 10, hazardResist: 1, tags: ["sept", "courier"],
      img: "icons/sundries/lights/lantern-iron-yellow.webp" },
    { name: "Witness-Sled",        tier: "II", bracket: "personal", mobility: "hybrid",
      currency: "intrigue",  archetype: "witness-sled",
      speed: 4, range: 12, hazardResist: 2, tags: ["spy", "covert"],
      img: "icons/commodities/tech/lens-glass.webp" },
    { name: "Oathbound Courser",   tier: "III",bracket: "personal", mobility: "mobile",
      currency: "diplomacy", archetype: "oathbound-courser",
      speed: 7, range: 18, hazardResist: 3, tags: ["diplomatic", "envoy"],
      img: "icons/sundries/documents/document-sealed-tan.webp" }
  ];

  // ── WAR RIGS (5) ────────────────────────────────────────────────────────
  const WAR_RIGS = [
    { name: "Scout Cycle",         tier: "II", bracket: "light",  mobility: "mobile",
      gunnerSlots: 1, crewSlots: 1,
      speed: 6, range: 15, hazardResist: 1, tags: ["military", "scout"],
      img: "icons/commodities/tech/wheel-spoked-iron.webp" },
    { name: "Sail Barge",          tier: "II", bracket: "medium", mobility: "hybrid",
      civilian: true, currency: "economy",
      gunnerSlots: 1, engineerSlots: 1, crewSlots: 4,
      speed: 3, range: 25, hazardResist: 2, tags: ["civilian", "trade"],
      basePerTurn: { economy: 5 },
      img: "icons/environment/wilderness/water-river.webp" },
    { name: "Heart-Iron War Rig",  tier: "III",bracket: "heavy",  mobility: "mobile",
      gunnerSlots: 3, engineerSlots: 1, crewSlots: 3,
      speed: 4, range: 20, hazardResist: 3, tags: ["military", "war-rig"],
      img: "icons/commodities/tech/cog-steel.webp" },
    { name: "Iron Howdah",         tier: "III",bracket: "heavy",  mobility: "mobile",
      gunnerSlots: 4, engineerSlots: 1, crewSlots: 2,
      speed: 3, range: 18, hazardResist: 4, tags: ["military", "mounted-platform"],
      img: "icons/environment/creatures/elephant.webp" },
    { name: "Hex-Cannon Platform", tier: "IV", bracket: "siege",  mobility: "hybrid",
      gunnerSlots: 2, engineerSlots: 2, crewSlots: 4,
      speed: 1, range: 8,  hazardResist: 5, tags: ["military", "siege"],
      img: "icons/weapons/artillery/cannon-engraved.webp" }
  ];

  // ── FACILITIES (5) — stationary rigs with monthly yield ─────────────────
  const FACILITIES = [
    { name: "Hex Forge",           tier: "II", bracket: "siege",  mobility: "stationary",
      civilian: true, currency: "economy",
      monthlyYieldMarks: 60, basePerTurn: { economy: 2 },
      tags: ["facility", "forge"],
      img: "icons/environment/settlement/forge.webp" },
    { name: "Yesodium Mine",       tier: "III",bracket: "siege",  mobility: "stationary",
      civilian: true, currency: "economy",
      monthlyYieldMarks: 200, basePerTurn: { economy: 7 },
      tags: ["facility", "extraction"],
      img: "icons/environment/wilderness/cave-entry-mountain-dark.webp" },
    { name: "Market Hall",         tier: "II", bracket: "siege",  mobility: "stationary",
      civilian: true, currency: "economy",
      monthlyYieldMarks: 90, basePerTurn: { economy: 3 },
      tags: ["facility", "commerce"],
      img: "icons/environment/settlement/building-trade.webp" },
    { name: "Septhouse",           tier: "II", bracket: "siege",  mobility: "stationary",
      currency: "softpower",
      monthlyYieldMarks: 75, basePerTurn: { softpower: 3 },
      tags: ["facility", "sept", "soft-power"],
      img: "icons/environment/settlement/temple.webp" },
    { name: "Training Ground",     tier: "II", bracket: "siege",  mobility: "stationary",
      currency: "violence",
      monthlyYieldMarks: 75, basePerTurn: { violence: 3 },
      tags: ["facility", "military", "drill"],
      img: "icons/environment/settlement/wall-stone.webp" }
  ];

  // ── BOSSES (4) ──────────────────────────────────────────────────────────
  const BOSSES = [
    { name: "Raider Chief",     tier: "II", bracket: "heavy",  currency: "violence",
      archetype: "raider-chief", tags: ["raider", "violence"], raidMode: "violence", moraleHits: 5,
      phases: [
        { label: "Brash",    threshold: 100, surgeBoost: 0 },
        { label: "Wounded",  threshold: 50,  surgeBoost: 1 },
        { label: "Cornered", threshold: 20,  surgeBoost: 3 }
      ],
      opStats: { violence: 8, intrigue: 2, economy: 0, nonlethal: 0, softpower: 0, diplomacy: 0, logistics: 1, culture: 0, faith: 0 },
      img: "icons/environment/people/commoner.webp" },

    { name: "Witness-Warden",   tier: "III", bracket: "medium", currency: "intrigue",
      archetype: "witness-warden", tags: ["intrigue", "witness"], raidMode: "intrigue", moraleHits: 4,
      phases: [
        { label: "Observing",  threshold: 100, surgeBoost: 0 },
        { label: "Unveiled",   threshold: 60,  surgeBoost: 2 },
        { label: "Revealed",   threshold: 25,  surgeBoost: 4 }
      ],
      opStats: { violence: 2, intrigue: 8, economy: 0, nonlethal: 3, softpower: 1, diplomacy: 0, logistics: 0, culture: 2, faith: 1 },
      img: "icons/commodities/tech/lens-glass.webp" },

    { name: "Hex-Warlord",      tier: "III", bracket: "heavy",  currency: "softpower",
      archetype: "hex-warlord", tags: ["soft-power", "warlord"], raidMode: "hybrid", moraleHits: 6,
      phases: [
        { label: "Throned",     threshold: 100, surgeBoost: 1 },
        { label: "Marshalled",  threshold: 60,  surgeBoost: 2 },
        { label: "Last Stand",  threshold: 25,  surgeBoost: 4 }
      ],
      opStats: { violence: 6, intrigue: 3, economy: 2, nonlethal: 2, softpower: 6, diplomacy: 3, logistics: 2, culture: 4, faith: 2 },
      img: "icons/environment/people/king.webp" },

    { name: "Soma-Fiend",       tier: "II",  bracket: "light",  currency: "nonlethal",
      archetype: "soma-fiend",  tags: ["non-lethal", "fiend"], raidMode: "nonlethal", moraleHits: 3,
      phases: [
        { label: "Slumbering",  threshold: 100, surgeBoost: 0 },
        { label: "Roused",      threshold: 50,  surgeBoost: 2 }
      ],
      opStats: { violence: 3, intrigue: 4, economy: 0, nonlethal: 7, softpower: 0, diplomacy: 0, logistics: 0, culture: 1, faith: 1 },
      img: "icons/creatures/eyes/lizard-single-orange.webp" }
  ];

  // ── Build payloads ──────────────────────────────────────────────────────
  const payloads = [];
  for (const s of PERSONAL_RIGS) payloads.push(buildRigData(s));
  for (const s of WAR_RIGS)      payloads.push(buildRigData(s));
  for (const s of FACILITIES)    payloads.push(buildRigData(s));
  for (const s of BOSSES)        payloads.push(buildBossData(s));

  // Skip existing.
  const toCreate = payloads.filter(p => {
    if (!SKIP_EXISTING) return true;
    const existing = game.actors.find(a => a.name === p.name && a.type === p.type);
    if (existing) console.debug(`[seed-rigs-bosses] skip ${p.name} — already exists`);
    return !existing;
  });

  console.log(`[seed-rigs-bosses] ${DRY_RUN ? "DRY-RUN" : "WET-RUN"} will create ${toCreate.length} actor(s) (of ${payloads.length} total)`);
  if (toCreate.length) {
    console.table(toCreate.map(p => ({
      name:    p.name,
      type:    p.type,
      tier:    p.flags.fourththing.rfi.actor.tier,
      bracket: p.flags.fourththing.rfi.actor.bracket,
      marks:   p.flags.fourththing.rfi.actor.price.marks,
      currency: p.flags.fourththing.rfi.actor.price.currency
    })));
  }

  if (!DRY_RUN && toCreate.length) {
    const created = await Actor.createDocuments(toCreate);
    console.log(`[seed-rigs-bosses] created ${created.length} actor(s) in game.actors`);
    ui.notifications?.info(`Seeded ${created.length} rig/boss/facility actor(s). Open the Actors directory to review.`);
  } else if (DRY_RUN) {
    ui.notifications?.info(`DRY-RUN: would create ${toCreate.length} actor(s). Flip DRY_RUN = false to commit.`);
  } else {
    ui.notifications?.info("No new actors — all 20 already exist (SKIP_EXISTING).");
  }
})();

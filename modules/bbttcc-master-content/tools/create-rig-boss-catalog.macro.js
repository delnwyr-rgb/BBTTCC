// BBTTCC — Rig & Boss Catalog (Phase 4 of the 2026-05-07 modernization sprint)
// ─────────────────────────────────────────────────────────────────────────────
// Authors a starter catalog spanning the 6 gear/template subtypes consumed by
// the new Rig + Boss actor sheets:
//
//   • rig-frame      (5 items) — structural identity; declares slots, capacity,
//                                bracket, integrity, action menu per role
//   • rig-weapon     (5 items) — combat modules (gunner-operated)
//   • rig-system     (5 items) — utility modules (sensors/shields/repair/cloak)
//   • output-module  (5 items) — per-turn producers; mobileLegal flag
//   • boss-augment   (5 items) — phase grants, AE-shaped
//   • rig-template   (4 items) — pre-built rig configs (drop on blank Rig)
//   • boss-template  (1 item)  — Gloomgill (port from bosses.gloomgill.js)
//
// Items target `bbttcc-master-content.items` compendium under a new folder
// "Rig & Boss Catalog". Idempotent — re-running skips items that already
// exist by name unless FORCE_CREATE = true.
//
// Subtype routing on the Rig sheet keys off `flags.fourththing.rigGear.subtype`.
// Frames additionally carry `flags.fourththing.rigFrame.{...}` defining slot
// counts, integrity, action menu per role, mobility constraints, travel.
// Templates carry `flags.fourththing.rigTemplate.config` (or `bossTemplate`)
// holding the full pre-populated boss/rig system shape.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID       = "bbttcc-master-content.items";
const FOLDER_NAME   = "Rig & Boss Catalog";
const DRY_RUN       = false;
const FORCE_CREATE  = false;

// ── ICONS ─────────────────────────────────────────────────────────────────
const ICON = {
  frame:    "icons/environment/settlement/wagon-black.webp",
  weapon:   "icons/weapons/artifacts/cannon-engraved.webp",
  system:   "icons/sundries/gaming/chess-pawn-white-pearl.webp",
  output:   "icons/tools/smithing/anvil.webp",
  augment:  "icons/magic/symbols/runes-etched-steel-orange.webp",
  template: "icons/sundries/scrolls/scroll-bound-sealed-red.webp",
  boss:     "icons/creatures/abilities/dragon-breath-purple.webp"
};

// ── FRAMES (5) ────────────────────────────────────────────────────────────
const FRAMES = [
  {
    name: "Light Skiff Frame",
    img: ICON.frame,
    description: "<p>A two-seat scrambler with bald tires, an angry engine, and a single hardpoint that wishes it were a cannon. Built for the run, not the fight.</p><p><b>Frame · Light · Mobile</b></p>",
    rigFrame: {
      bracket: "light", baseIntegrity: 16, tierStep: 6,
      mobilityAllowed: ["mobile"], slots: { weapon: 1, system: 1, output: 0 },
      capacity: { pilot: { min: 1, max: 1 }, gunner: { min: 0, max: 0 }, engineer: { min: 0, max: 0 }, crew: { min: 0, max: 1 } },
      actions: {
        pilot:    ["steer", "evasive", "swerve"],
        gunner:   [],
        engineer: [],
        crew:     ["brace", "hold-on"]
      },
      travel: { speed: 4, range: 12 },
      visualFrame: "open-corners"
    }
  },
  {
    name: "War Rig Frame",
    img: ICON.frame,
    description: "<p>A diesel-howling hulk of plate and bolted-on intent. The kind of vehicle that arrives like weather. Crew of five, four guns, room in back for whatever you took.</p><p><b>Frame · Heavy · Mobile · Mad Max canon</b></p>",
    rigFrame: {
      bracket: "heavy", baseIntegrity: 48, tierStep: 14,
      mobilityAllowed: ["mobile"], slots: { weapon: 4, system: 2, output: 1 },
      capacity: { pilot: { min: 1, max: 1 }, gunner: { min: 0, max: 2 }, engineer: { min: 0, max: 1 }, crew: { min: 0, max: 3 } },
      actions: {
        pilot:    ["steer", "ram", "hold-position", "evasive", "swerve"],
        gunner:   ["fire-weapon", "aimed-shot", "suppression", "reload", "opportunity-fire"],
        engineer: ["repair", "boost-system", "vent-heat", "counter-sabotage"],
        crew:     ["operate-module", "reload", "brace", "hold-on"]
      },
      travel: { speed: 3, range: 8 },
      visualFrame: "open-corners"
    }
  },
  {
    name: "Sail Barge Frame",
    img: ICON.frame,
    description: "<p>A pleasure-galley with delusions of fortress. Docks at hexes to throw lavish productions; cuts loose to roam when the music demands it. Throne optional, mandatory.</p><p><b>Frame · Medium · Hybrid · Jabba canon</b></p>",
    rigFrame: {
      bracket: "medium", baseIntegrity: 32, tierStep: 10,
      mobilityAllowed: ["hybrid"], slots: { weapon: 2, system: 2, output: 3 },
      capacity: { pilot: { min: 1, max: 1 }, gunner: { min: 0, max: 1 }, engineer: { min: 0, max: 1 }, crew: { min: 0, max: 6 } },
      actions: {
        pilot:    ["steer", "tack-against-wind", "raise-sail", "evasive"],
        gunner:   ["fire-weapon", "suppression", "reload"],
        engineer: ["repair", "boost-system", "vent-heat"],
        crew:     ["operate-module", "brace", "signal", "hold-on"]
      },
      travel: { speed: 2, range: 10 },
      visualFrame: "anchor-ring"
    }
  },
  {
    name: "Forge Facility Frame",
    img: ICON.frame,
    description: "<p>A bolted-down industrial cathedral. Chimneys exhale slag and prayer in equal measure. Doesn't move; doesn't need to. Things come <em>to</em> it.</p><p><b>Frame · Siege · Stationary</b></p>",
    rigFrame: {
      bracket: "siege", baseIntegrity: 64, tierStep: 18,
      mobilityAllowed: ["stationary"], slots: { weapon: 1, system: 2, output: 4 },
      capacity: { pilot: { min: 0, max: 0 }, gunner: { min: 0, max: 1 }, engineer: { min: 0, max: 2 }, crew: { min: 0, max: 4 } },
      actions: {
        pilot:    [],
        gunner:   ["fire-weapon", "suppression", "opportunity-fire"],
        engineer: ["repair", "boost-system", "vent-heat", "cycle-power", "counter-sabotage"],
        crew:     ["operate-module", "reload", "brace"]
      },
      travel: { speed: 0, range: 0 },
      visualFrame: "anchor-corners"
    }
  },
  {
    name: "Garrison Fort Frame",
    img: ICON.frame,
    description: "<p>Stone, sandbags, and the kind of stubborn that calcifies into law. Crewed by gunners and held by quartermasters. Output is reputation: nothing crosses without a paper trail.</p><p><b>Frame · Heavy · Stationary</b></p>",
    rigFrame: {
      bracket: "heavy", baseIntegrity: 56, tierStep: 16,
      mobilityAllowed: ["stationary"], slots: { weapon: 4, system: 3, output: 1 },
      capacity: { pilot: { min: 0, max: 0 }, gunner: { min: 0, max: 3 }, engineer: { min: 0, max: 1 }, crew: { min: 0, max: 4 } },
      actions: {
        pilot:    [],
        gunner:   ["fire-weapon", "aimed-shot", "suppression", "reload", "opportunity-fire"],
        engineer: ["repair", "boost-system", "counter-sabotage"],
        crew:     ["operate-module", "reload", "brace", "signal", "hold-on"]
      },
      travel: { speed: 0, range: 0 },
      visualFrame: "anchor-corners"
    }
  }
];

// ── WEAPONS (5) ───────────────────────────────────────────────────────────
const WEAPONS = [
  { name: "Twin Autocannons",  damage: "2d8",  type: "kinetic",   tier: 1, range: { short: 4, long: 12 }, tags: ["suppression"], desc: "Belt-fed twin barrels. Less aimed than <em>insisted upon</em>. Suppression in service of statement." },
  { name: "Plasma Lance",      damage: "3d8",  type: "energy",    tier: 2, range: { short: 6, long: 14 }, tags: ["piercing"],    desc: "Long focused beam that doesn't just hit a target — it <em>edits</em> it. Anti-armor specialty." },
  { name: "Mortar Battery",    damage: "3d6",  type: "kinetic",   tier: 2, range: { short: 8, long: 24 }, tags: ["aoe","arc"],   desc: "Indirect fire from pre-rotated tubes. Crew yells coordinates at each other; the math sometimes lands." },
  { name: "Phase Disruptor",   damage: "3d10", type: "qliphothic",tier: 3, range: { short: 4, long: 8 },  tags: ["unstable"],    desc: "A weapon that does not so much fire as <em>complain</em> at reality until something breaks. Gunner sleeps poorly." },
  { name: "Resonance Howler",  damage: "2d6",  type: "psychic",   tier: 3, range: { short: 6, long: 12 }, tags: ["aoe","morale"],desc: "Sub-audible siren that turns will into wet paper. Doesn't damage steel; ruins morale within the cone." }
];

// ── SYSTEMS (5) ───────────────────────────────────────────────────────────
const SYSTEMS = [
  { name: "Reinforced Plating",  passive: true,  desc: "Bolted-on plate; ugly, heavy, effective. Adds integrity without subtlety." },
  { name: "Repair Bay",          passive: false, desc: "A dedicated cubby with a wrench wall and a swearing engineer. Engineer's repair action gains traction here." },
  { name: "Comms Array",         passive: true,  desc: "A nest of antennae held together by faith. Extends signal range; allies on hex coordinate at +1 step." },
  { name: "Phase Cloak",         passive: false, desc: "Burns coolant for invisibility. Active toggle; the rig is harder to target until cycled off." },
  { name: "Sensor Suite",        passive: true,  desc: "Looks farther, sees sooner. Passive +perception for crew on board; initiative ties broken in your favor." }
];

// ── OUTPUT MODULES (5) ────────────────────────────────────────────────────
const OUTPUTS = [
  { name: "Mounted Forge",          yield: { steel: 2, parts: 1 },   mobileLegal: true,  desc: "Anvil bolted to a turret-ring. Produces ingots and parts each turn the rig is parked or docked. War rigs run it at half during deployment." },
  { name: "Quartermaster Dispenser",yield: { supplies: 3 },          mobileLegal: true,  desc: "A clipboarded oracle that allocates rations, ammo, and small mercies. Faction supplies stack here." },
  { name: "Hex-Bound Garrison Plate",yield: { militia_op: 1 },        mobileLegal: false, desc: "An anchored authority — registers the holding with the local hex. Stationary-only: deploying the rig severs the bond." },
  { name: "Hunter Pen",             yield: { meat: 2, leather: 1 },  mobileLegal: true,  desc: "Cages, hooks, and a butcher who hums. Works mid-deployment; nature provides on the move." },
  { name: "Beacon Spire",           yield: { signal: 1, faith: 1 },  mobileLegal: false, desc: "A vertical hymn of light. Stationary-only: the spire's purpose is being a fixed point others can find." }
];

// ── BOSS AUGMENTS (5) ─────────────────────────────────────────────────────
const AUGMENTS = [
  { name: "Phase 2 Surge Burst",   desc: "On entering Phase 2, gain 2 Surge dice immediately. The boss <em>remembers it has options</em>." },
  { name: "Wrath Resistance",      desc: "From Phase 3 onward, kinetic damage hits for 1 less per die. Skin hardens with the situation." },
  { name: "Final Roar",            desc: "On entering the final phase: +1 Momentum, +2 Surge, all manifestations re-armed. The cornered animal speaks." },
  { name: "Adaptive Defense",      desc: "Each phase entry rotates one resistance to whichever damage type was dealt most recently. Boss <em>learns</em>." },
  { name: "Eldritch Aura",         desc: "Crew within reach gain psychic vulnerability while the boss is on its current phase. Standing too close costs." }
];

// ── TEMPLATES (5) ─────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    name: "War Rig Template",
    kind: "rigTemplate",
    img: ICON.template,
    description: "<p>Pre-rolled war rig: heavy frame, two autocannons, plating, repair bay. Drop onto a blank Rig actor to populate.</p>",
    config: {
      identity: { mobility: "mobile", state: "parked", archetype: "war-rig" },
      frame: "War Rig Frame",
      gear: { weapons: ["Twin Autocannons", "Twin Autocannons"], systems: ["Reinforced Plating", "Repair Bay"], outputs: [] }
    }
  },
  {
    name: "Sail Barge Template",
    kind: "rigTemplate",
    img: ICON.template,
    description: "<p>Pre-rolled hybrid pleasure-galley: medium frame, harpoon, sensors, comms, three output bays. Anchors at a hex for full output.</p>",
    config: {
      identity: { mobility: "hybrid", state: "parked", archetype: "sail-barge" },
      frame: "Sail Barge Frame",
      gear: { weapons: ["Mortar Battery"], systems: ["Sensor Suite", "Comms Array"], outputs: ["Quartermaster Dispenser", "Beacon Spire", "Mounted Forge"] }
    }
  },
  {
    name: "Forge Facility Template",
    kind: "rigTemplate",
    img: ICON.template,
    description: "<p>Pre-rolled stationary forge facility: siege frame, four output modules. The classic stationary 'rig' = facility.</p>",
    config: {
      identity: { mobility: "stationary", state: "parked", archetype: "forge-facility" },
      frame: "Forge Facility Frame",
      gear: { weapons: ["Twin Autocannons"], systems: ["Reinforced Plating", "Phase Cloak"], outputs: ["Mounted Forge", "Mounted Forge", "Hunter Pen", "Quartermaster Dispenser"] }
    }
  },
  {
    name: "Garrison Fort Template",
    kind: "rigTemplate",
    img: ICON.template,
    description: "<p>Pre-rolled stationary garrison: heavy frame, four guns, militia output. Holds a hex against raids.</p>",
    config: {
      identity: { mobility: "stationary", state: "parked", archetype: "garrison" },
      frame: "Garrison Fort Frame",
      gear: { weapons: ["Twin Autocannons", "Twin Autocannons", "Mortar Battery", "Plasma Lance"], systems: ["Reinforced Plating", "Sensor Suite", "Comms Array"], outputs: ["Hex-Bound Garrison Plate"] }
    }
  },
  {
    name: "Gloomgill Boss Template",
    kind: "bossTemplate",
    img: ICON.boss,
    description: "<p>Port of the existing <code>bosses.gloomgill.js</code> canonical boss into the new Boss actor schema. Drop onto a blank Boss actor to populate identity, raid profile, manifestations, and phase ladder.</p>",
    config: {
      identity: { archetype: "qliphothic_warden" },
      raidProfile: {
        key: "gloomgill",
        mode: "hybrid",
        moraleHits: 4,
        hitTrack: "observed, pressured, compromised, expelled",
        tagsRaw: "qliphothic, warden, void",
        opStats: { violence: 10, nonlethal: 0, intrigue: 4, economy: 0, softpower: 0, diplomacy: 0, logistics: 0, culture: 0, faith: 2 }
      },
      doctrine: { maneuverKeys: ["void_signal_collapse", "suppressive_fire", "qliphothic_gambit", "psychic_disruption"] },
      integrity: { value: 80, max: 80, tier: 3, bracket: "siege" },
      manifestations: { surge: { current: 0, max: 8, exploded: 0 }, momentum: 2 },
      phases: {
        currentPhase: 0,
        ladder: [
          { label: "Observed",      integrityThreshold: 100, surgeBoost: 0, manifestationGrants: [] },
          { label: "Pressured",     integrityThreshold: 75,  surgeBoost: 1, manifestationGrants: [] },
          { label: "Compromised",   integrityThreshold: 40,  surgeBoost: 2, manifestationGrants: [] },
          { label: "Expelled",      integrityThreshold: 10,  surgeBoost: 3, manifestationGrants: [] }
        ]
      }
    }
  }
];

// ── EXECUTION ─────────────────────────────────────────────────────────────
(async () => {
  if (!game.user?.isGM) {
    ui.notifications?.warn("GM only.");
    return;
  }

  const pack = game.packs.get(PACK_ID);
  if (!pack) {
    ui.notifications?.error(`Pack not found: ${PACK_ID}`);
    return;
  }

  // Folder lookup/create (in compendium)
  const collection = await pack.getDocuments();
  const existingByName = new Map(collection.map(d => [d.name, d]));

  let folder = pack.folders?.find(f => f.name === FOLDER_NAME);
  if (!folder && !DRY_RUN) {
    folder = await Folder.create({ name: FOLDER_NAME, type: "Item" }, { pack: PACK_ID });
  }
  const folderId = folder?.id ?? null;

  let created = 0, skipped = 0;
  const stamp = (item) => {
    if (folderId) item.folder = folderId;
    return item;
  };

  // ── Frames ─────────────────────────────────────────────────────────────
  for (const f of FRAMES) {
    if (existingByName.has(f.name) && !FORCE_CREATE) { skipped++; continue; }
    const itemData = stamp({
      name: f.name,
      type: "gear",
      img:  f.img,
      system: { description: { value: f.description } },
      flags: {
        fourththing: {
          rigGear:  { subtype: "rig-frame" },
          rigFrame: f.rigFrame
        }
      }
    });
    if (!DRY_RUN) await Item.create(itemData, { pack: PACK_ID });
    created++;
  }

  // ── Weapons ────────────────────────────────────────────────────────────
  for (const w of WEAPONS) {
    if (existingByName.has(w.name) && !FORCE_CREATE) { skipped++; continue; }
    const itemData = stamp({
      name: w.name,
      type: "weapon",
      img:  ICON.weapon,
      system: {
        description: { value: `<p>${w.desc}</p>` },
        category: "ranged",
        skill: "firearms",
        damage: { formula: w.damage, type: w.type, attribute: "violence", track: "integrity" },
        range:  w.range,
        tags:   w.tags
      },
      flags: {
        fourththing: {
          rigGear:  { subtype: "rig-weapon" },
          rfi:      { item: { tier: ["I","II","III","IV"][w.tier - 1] ?? "II", frame: "weapon" } }
        }
      }
    });
    if (!DRY_RUN) await Item.create(itemData, { pack: PACK_ID });
    created++;
  }

  // ── Systems ────────────────────────────────────────────────────────────
  for (const s of SYSTEMS) {
    if (existingByName.has(s.name) && !FORCE_CREATE) { skipped++; continue; }
    const itemData = stamp({
      name: s.name,
      type: "gear",
      img:  ICON.system,
      system: { description: { value: `<p>${s.desc}</p>` } },
      flags: {
        fourththing: {
          rigGear: { subtype: "rig-system", passive: !!s.passive }
        }
      }
    });
    if (!DRY_RUN) await Item.create(itemData, { pack: PACK_ID });
    created++;
  }

  // ── Output Modules ─────────────────────────────────────────────────────
  for (const o of OUTPUTS) {
    if (existingByName.has(o.name) && !FORCE_CREATE) { skipped++; continue; }
    const itemData = stamp({
      name: o.name,
      type: "gear",
      img:  ICON.output,
      system: { description: { value: `<p>${o.desc}</p>` } },
      flags: {
        fourththing: {
          rigGear: { subtype: "output-module", yield: o.yield, mobileLegal: !!o.mobileLegal }
        }
      }
    });
    if (!DRY_RUN) await Item.create(itemData, { pack: PACK_ID });
    created++;
  }

  // ── Boss Augments ──────────────────────────────────────────────────────
  for (const a of AUGMENTS) {
    if (existingByName.has(a.name) && !FORCE_CREATE) { skipped++; continue; }
    const itemData = stamp({
      name: a.name,
      type: "feature",
      img:  ICON.augment,
      system: { description: { value: `<p>${a.desc}</p>` } },
      flags: {
        fourththing: {
          rigGear: { subtype: "boss-augment" }
        }
      }
    });
    if (!DRY_RUN) await Item.create(itemData, { pack: PACK_ID });
    created++;
  }

  // ── Templates ──────────────────────────────────────────────────────────
  for (const t of TEMPLATES) {
    if (existingByName.has(t.name) && !FORCE_CREATE) { skipped++; continue; }
    const itemData = stamp({
      name: t.name,
      type: "feature",
      img:  t.img,
      system: { description: { value: t.description } },
      flags: {
        fourththing: {
          rigGear: { subtype: t.kind === "bossTemplate" ? "boss-template" : "rig-template" },
          [t.kind]: { config: t.config }
        }
      }
    });
    if (!DRY_RUN) await Item.create(itemData, { pack: PACK_ID });
    created++;
  }

  const msg = `Rig & Boss Catalog — created ${created}, skipped ${skipped} (existing). Folder: ${FOLDER_NAME}.`;
  ui.notifications?.info(msg);
  console.log("[bbttcc-master-content/rig-boss-catalog]", msg);
})();

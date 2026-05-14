// BBTTCC — Personal Rigs add-on (Phase 4.5 follow-up to the 2026-05-07 sprint)
// ─────────────────────────────────────────────────────────────────────────────
// Adds the "personal" rig bracket: single-pilot speeders, bikes, motorcycles.
// Mad Max scouting, Tatooine landspeeders, urban escape work. One seat,
// minimal slots, top-shelf travel speed.
//
// Items land in `bbttcc-master-content.items` under the "Rig & Boss Catalog"
// folder (same folder as the main catalog). Idempotent — re-runs skip
// items that already exist by name unless FORCE_CREATE = true.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID      = "bbttcc-master-content.items";
const FOLDER_NAME  = "Rig & Boss Catalog";
const DRY_RUN      = false;
const FORCE_CREATE = false;

const ICON_FRAME    = "icons/environment/settlement/wagon-black.webp";
const ICON_TEMPLATE = "icons/sundries/scrolls/scroll-bound-sealed-red.webp";

// ── PERSONAL FRAMES (3) ──────────────────────────────────────────────────
const PERSONAL_FRAMES = [
  {
    name: "Speeder Bike Frame",
    img: ICON_FRAME,
    description: "<p>Two wheels of bad decision. Outruns most opinions and a fair number of bullets. No room for company; that's the appeal.</p><p><b>Frame · Personal · Mobile · Single seat</b></p>",
    rigFrame: {
      bracket: "personal", baseIntegrity: 8, tierStep: 3,
      mobilityAllowed: ["mobile"], slots: { weapon: 0, system: 1, output: 0 },
      capacity: { pilot: { min: 1, max: 1 }, gunner: { min: 0, max: 0 }, engineer: { min: 0, max: 0 }, crew: { min: 0, max: 0 } },
      actions: {
        pilot:    ["steer", "evasive", "swerve"],
        gunner:   [], engineer: [], crew: []
      },
      travel: { speed: 6, range: 8 },
      visualFrame: "open-corners"
    }
  },
  {
    name: "Landspeeder Frame",
    img: ICON_FRAME,
    description: "<p>Hovers a foot off the dirt and hates every grain of it. Single pilot, side-mounted hardpoint, just enough cargo for a canteen and a grudge.</p><p><b>Frame · Personal · Mobile · Single seat + 1 weapon</b></p>",
    rigFrame: {
      bracket: "personal", baseIntegrity: 10, tierStep: 4,
      mobilityAllowed: ["mobile"], slots: { weapon: 1, system: 0, output: 0 },
      capacity: { pilot: { min: 1, max: 1 }, gunner: { min: 0, max: 0 }, engineer: { min: 0, max: 0 }, crew: { min: 0, max: 0 } },
      actions: {
        pilot:    ["steer", "ram", "evasive", "swerve"],
        gunner:   [], engineer: [], crew: []
      },
      travel: { speed: 5, range: 12 },
      visualFrame: "open-corners"
    }
  },
  {
    name: "Motorspeeder Frame",
    img: ICON_FRAME,
    description: "<p>The compromise: hover-bike with a saddlebag and a pillion that fits a body bag if folded carefully. Faster than a landspeeder, less dignified than a bike.</p><p><b>Frame · Personal · Mobile · Pilot + 1 passenger</b></p>",
    rigFrame: {
      bracket: "personal", baseIntegrity: 9, tierStep: 3,
      mobilityAllowed: ["mobile"], slots: { weapon: 1, system: 1, output: 0 },
      capacity: { pilot: { min: 1, max: 1 }, gunner: { min: 0, max: 0 }, engineer: { min: 0, max: 0 }, crew: { min: 0, max: 1 } },
      actions: {
        pilot:    ["steer", "evasive", "swerve"],
        gunner:   [], engineer: [],
        crew:     ["brace", "hold-on"]
      },
      travel: { speed: 7, range: 10 },
      visualFrame: "open-corners"
    }
  }
];

// ── PERSONAL TEMPLATES (3) ────────────────────────────────────────────────
const PERSONAL_TEMPLATES = [
  {
    name: "Speeder Bike Template",
    description: "<p>Stripped-down personal escape vehicle. Drop on a blank Rig actor.</p>",
    config: {
      identity: { mobility: "mobile", state: "parked", archetype: "speeder-bike" },
      frame: "Speeder Bike Frame",
      gear: { weapons: [], systems: ["Sensor Suite"], outputs: [] }
    }
  },
  {
    name: "Landspeeder Template",
    description: "<p>Solo scout speeder with a hardpoint. Drop on a blank Rig actor.</p>",
    config: {
      identity: { mobility: "mobile", state: "parked", archetype: "landspeeder" },
      frame: "Landspeeder Frame",
      gear: { weapons: ["Twin Autocannons"], systems: [], outputs: [] }
    }
  },
  {
    name: "Motorspeeder Template",
    description: "<p>Two-up hover-bike. Drop on a blank Rig actor; bring a friend.</p>",
    config: {
      identity: { mobility: "mobile", state: "parked", archetype: "motorspeeder" },
      frame: "Motorspeeder Frame",
      gear: { weapons: ["Twin Autocannons"], systems: ["Sensor Suite"], outputs: [] }
    }
  }
];

// ── EXECUTION ─────────────────────────────────────────────────────────────
(async () => {
  if (!game.user?.isGM) { ui.notifications?.warn("GM only."); return; }

  const pack = game.packs.get(PACK_ID);
  if (!pack) { ui.notifications?.error(`Pack not found: ${PACK_ID}`); return; }

  const collection = await pack.getDocuments();
  const existingByName = new Map(collection.map(d => [d.name, d]));

  let folder = pack.folders?.find(f => f.name === FOLDER_NAME);
  if (!folder && !DRY_RUN) {
    folder = await Folder.create({ name: FOLDER_NAME, type: "Item" }, { pack: PACK_ID });
  }
  const folderId = folder?.id ?? null;

  let created = 0, skipped = 0;

  // Frames
  for (const f of PERSONAL_FRAMES) {
    if (existingByName.has(f.name) && !FORCE_CREATE) { skipped++; continue; }
    const itemData = {
      name: f.name,
      type: "gear",
      img:  f.img,
      folder: folderId,
      system: { description: { value: f.description } },
      flags: { fourththing: { rigGear: { subtype: "rig-frame" }, rigFrame: f.rigFrame } }
    };
    if (!DRY_RUN) await Item.create(itemData, { pack: PACK_ID });
    created++;
  }

  // Templates
  for (const t of PERSONAL_TEMPLATES) {
    if (existingByName.has(t.name) && !FORCE_CREATE) { skipped++; continue; }
    const itemData = {
      name: t.name,
      type: "feature",
      img:  ICON_TEMPLATE,
      folder: folderId,
      system: { description: { value: t.description } },
      flags: { fourththing: { rigGear: { subtype: "rig-template" }, rigTemplate: { config: t.config } } }
    };
    if (!DRY_RUN) await Item.create(itemData, { pack: PACK_ID });
    created++;
  }

  const msg = `Personal Rigs add-on — created ${created}, skipped ${skipped}.`;
  ui.notifications?.info(msg);
  console.log("[bbttcc-master-content/personal-rigs]", msg);
})();

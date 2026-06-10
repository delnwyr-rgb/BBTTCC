// Bad Eden — Frame Audit Fix (2026-05-13)
// ─────────────────────────────────────────────────────────────────────────────
// Fills the rig-frame catalog gaps surfaced during the 2026-05-13 audit:
//   1. Oathbound Courser Frame (personal, mobile, courier)
//   2. Hex-Cannon Platform Frame (siege, stationary)
//   3. Iron Howdah Frame (medium, hybrid mobile gunnery)
//   4. Trade Hall Frame (medium, stationary civic facility)
//   5. Recon Drone Frame (personal, mobile, light recon)
//
// Items land in `bbttcc-master-content.items` under the "Rig & Boss Catalog"
// folder. Idempotent — re-runs skip items that already exist by name unless
// FORCE_CREATE = true.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID      = "bbttcc-master-content.items";
const FOLDER_NAME  = "Rig & Boss Catalog";
const DRY_RUN      = false;
const FORCE_CREATE = false;

const ICON_FRAME = "icons/environment/settlement/wagon-black.webp";

const FRAMES = [
  {
    name: "Oathbound Courser Frame",
    img: ICON_FRAME,
    description: "<p>A sacred messenger's mount — single rider, no weapon mount, built for speed and diplomatic reach. Travels under oath-protection; rarely engaged in direct combat because rules of safe passage cover it.</p><p><b>Frame · Personal · Mobile · Courier</b></p>",
    rigFrame: {
      bracket: "personal", baseIntegrity: 8, tierStep: 3,
      mobilityAllowed: ["mobile"], slots: { weapon: 0, system: 1, output: 0 },
      capacity: { pilot: { min: 1, max: 1 }, gunner: { min: 0, max: 0 }, engineer: { min: 0, max: 0 }, crew: { min: 0, max: 0 } },
      actions: {
        pilot:    ["steer", "evasive", "swerve", "oath-leap"],
        gunner:   [], engineer: [], crew: []
      },
      travel: { speed: 8, range: 16 },
      tags: ["courier", "oathbound", "diplomatic", "fast"],
      visualFrame: "open-corners"
    }
  },
  {
    name: "Hex-Cannon Platform Frame",
    img: ICON_FRAME,
    description: "<p>A heavy stationary gunnery emplacement. Two main mounts, anti-vehicle profile, no mobility. Crewed by a dedicated gun team; engineers keep the cycle hot. Best parked on a strategic ridge.</p><p><b>Frame · Siege · Stationary · Heavy Gunnery</b></p>",
    rigFrame: {
      bracket: "siege", baseIntegrity: 60, tierStep: 15,
      mobilityAllowed: ["stationary"], slots: { weapon: 2, system: 1, output: 0 },
      capacity: { pilot: { min: 0, max: 0 }, gunner: { min: 1, max: 2 }, engineer: { min: 0, max: 1 }, crew: { min: 0, max: 2 } },
      actions: {
        pilot:    [],
        gunner:   ["aimed-shot", "suppression", "siege-volley", "reload", "opportunity-fire"],
        engineer: ["repair", "cycle-power", "vent-heat"],
        crew:     ["brace", "operate-module", "signal"]
      },
      travel: { speed: 0, range: 0 },
      tags: ["siege", "stationary", "anti-vehicle", "fortification-class"],
      visualFrame: "closed-corners"
    }
  },
  {
    name: "Iron Howdah Frame",
    img: ICON_FRAME,
    description: "<p>A mounted gunnery platform — typically affixed to a war beast or large vehicle. Movement is borrowed from the mount; the howdah itself is a fighting box. Gunners ride high with clear arcs of fire.</p><p><b>Frame · Medium · Hybrid · Mounted Gunnery</b></p>",
    rigFrame: {
      bracket: "medium", baseIntegrity: 35, tierStep: 8,
      mobilityAllowed: ["hybrid"], slots: { weapon: 2, system: 0, output: 0 },
      capacity: { pilot: { min: 0, max: 0 }, gunner: { min: 1, max: 2 }, engineer: { min: 0, max: 0 }, crew: { min: 0, max: 2 } },
      actions: {
        pilot:    [],
        gunner:   ["aimed-shot", "suppression", "fire-weapon"],
        engineer: [],
        crew:     ["brace", "hold-on", "signal"]
      },
      travel: { speed: 3, range: 6 },
      tags: ["mounted", "howdah", "mobile-gunnery", "hybrid"],
      visualFrame: "hybrid"
    }
  },
  {
    name: "Trade Hall Frame",
    img: ICON_FRAME,
    description: "<p>A civic stationary structure — market, exchange, or guildhall. Soft target with no defenses but real economic output. Defenders rely on courtesy, walls, and the fact that destroying a Trade Hall costs everyone.</p><p><b>Frame · Medium · Stationary · Civic Facility</b></p>",
    rigFrame: {
      bracket: "medium", baseIntegrity: 30, tierStep: 6,
      mobilityAllowed: ["stationary"], slots: { weapon: 0, system: 1, output: 2 },
      capacity: { pilot: { min: 0, max: 0 }, gunner: { min: 0, max: 0 }, engineer: { min: 0, max: 1 }, crew: { min: 0, max: 4 } },
      actions: {
        pilot:    [],
        gunner:   [],
        engineer: ["repair"],
        crew:     ["operate-module", "signal", "counter-sabotage"]
      },
      travel: { speed: 0, range: 0 },
      tags: ["civic", "market", "trade", "stationary", "soft-target"],
      visualFrame: "closed-corners"
    }
  },
  {
    name: "Recon Drone Frame",
    img: ICON_FRAME,
    description: "<p>An automated or single-pilot scout. Light enough to be deniable, fast enough to outrun most counters, optionally armed for harassment. Loses Integrity quickly when engaged; designed to be replaceable.</p><p><b>Frame · Personal · Mobile · Light Recon</b></p>",
    rigFrame: {
      bracket: "personal", baseIntegrity: 5, tierStep: 2,
      mobilityAllowed: ["mobile"], slots: { weapon: 1, system: 1, output: 0 },
      capacity: { pilot: { min: 1, max: 1 }, gunner: { min: 0, max: 0 }, engineer: { min: 0, max: 0 }, crew: { min: 0, max: 0 } },
      actions: {
        pilot:    ["steer", "evasive", "swerve", "scan"],
        gunner:   [], engineer: [], crew: []
      },
      travel: { speed: 8, range: 10 },
      tags: ["recon", "drone", "light", "deniable"],
      visualFrame: "open-corners"
    }
  }
];

// ── EXECUTE ────────────────────────────────────────────────────────────────
(async () => {
  const pack = game.packs.get(PACK_ID);
  if (!pack) {
    ui.notifications?.error(`Pack not found: ${PACK_ID}`);
    return;
  }
  if (pack.locked) {
    ui.notifications?.warn(`Pack is locked — unlock it first via Compendium settings.`);
    return;
  }

  await pack.getIndex();
  let folder = pack.folders?.find(f => f.name === FOLDER_NAME);
  if (!folder) {
    folder = await Folder.create({
      name: FOLDER_NAME, type: "Item", color: "#d4a35f",
      flags: { "bbttcc-master-content": { stamped: "frames-audit-fix" } }
    }, { pack: PACK_ID });
    console.log(`[frames-audit-fix] Created folder "${FOLDER_NAME}"`);
  }

  const created = [];
  const skipped = [];

  for (const def of FRAMES) {
    const existing = pack.index.find(e => e.name === def.name);
    if (existing && !FORCE_CREATE) {
      skipped.push(def.name);
      continue;
    }

    const itemData = {
      name: def.name,
      type: "feat",
      img: def.img,
      folder: folder?.id ?? null,
      system: {
        description: { value: def.description, chat: "", unidentified: "" }
      },
      flags: {
        fourththing: {
          rigGear:  { subtype: "rig-frame" },
          rigFrame: def.rigFrame
        }
      }
    };

    if (DRY_RUN) {
      console.log(`[frames-audit-fix] DRY-RUN would create:`, def.name, itemData);
      created.push(def.name + " (dry-run)");
      continue;
    }

    try {
      const cls = getDocumentClass("Item");
      const doc = await cls.create(itemData, { pack: PACK_ID });
      created.push(`${def.name} (${doc?.id})`);
      console.log(`[frames-audit-fix] Created:`, def.name);
    } catch (e) {
      console.warn(`[frames-audit-fix] Failed to create ${def.name}`, e);
    }
  }

  const summary = [
    `Bad Eden Frame Audit Fix complete.`,
    `Created: ${created.length} (${created.join(", ") || "—"})`,
    `Skipped (existed): ${skipped.length} (${skipped.join(", ") || "—"})`,
    DRY_RUN ? `DRY_RUN was true — no documents written.` : ``
  ].filter(Boolean).join("\n");
  console.log(`[frames-audit-fix] ${summary}`);
  ui.notifications?.info(summary, { permanent: true });
})();

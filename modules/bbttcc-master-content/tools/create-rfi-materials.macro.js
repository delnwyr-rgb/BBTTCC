// Bad Eden — Create RFI Crafting Materials (seed pack)
// ─────────────────────────────────────────────────────────────────────────────
// Adds 12 raw-material items to `bbttcc-master-content.items`. Each has:
//   • type: "gear"
//   • flags.fourththing.rfi.item.frame:        "material"
//   • flags.fourththing.rfi.item.materialKey:  string the recipe engine reads
//   • flags.fourththing.rfi.item.charges:      stack size (units in this pile)
//   • flags.fourththing.rfi.item.tier:         scarcity tier (I-IV)
//   • flags.fourththing.rfi.item.lore:         flavor / where you find it
//
// Drag any of these onto a steward to populate their inventory; the Forge UI
// then surfaces every recipe whose materialOf list is satisfied.
//
// Yesodium leads — adjust its lore from your in-game Journal entry, since I
// only had Kabbalistic prior knowledge to design from. Treat the lore here as
// a placeholder to refine.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const DRY_RUN = false;
const FORCE   = false;

const MATERIALS = [
  {
    name: "Yesodium",
    materialKey: "yesodium",
    tier: "III", charges: 1,
    signature: "The foundation hums when held.",
    lore: "<p><i>Refine this lore from the Journal entry you have in-game — what follows is a placeholder shaped from sephirothic prior.</i></p>"
      + "<p>Yesodium is the crystallized tension between dream and ground — the sephirah of <b>Yesod</b> made tangible. Mined where the unconscious of the world surfaces: under sept-foundations, beneath sleeping cities, at the bottom of unanswered prayers.</p>"
      + "<p>Resonates with foundations: anchors, vows, dream-gates, bindings.</p>",
    tags: ["sephirotic", "yesod", "foundation"]
  },

  // ── Sept / Witness family ───────────────────────────────────────────────
  {
    name: "Sept-Cloth",
    materialKey: "sept-cloth",
    tier: "I", charges: 5,
    signature: "Woven on the backloom of a sept-house.",
    lore: "<p>Hand-loomed cloth carrying the residue of the prayers worked into it. Light, breathable, faintly luminous in the dark.</p>",
    tags: ["sept", "cloth", "blessed"]
  },
  {
    name: "Vow-Bone",
    materialKey: "vow-bone",
    tier: "III", charges: 1,
    signature: "Bone that remembers a promise.",
    lore: "<p>Calcified marrow recovered from witnesses who died holding a vow. Carved into clasps, hilt-pommels, and ritual fastenings.</p>",
    tags: ["vow", "bone", "ritual"]
  },
  {
    name: "Witness-Glass",
    materialKey: "witness-glass",
    tier: "II", charges: 3,
    signature: "Glass that won't forget what it has seen.",
    lore: "<p>Slag glass cooled too slow at a sept-trial. Holds an impression of the testimony given over it. Used in recording crystals and oath-styluses.</p>",
    tags: ["witness", "glass", "memory"]
  },

  // ── Heart / Aurablade family ────────────────────────────────────────────
  {
    name: "Heart-Iron",
    materialKey: "heart-iron",
    tier: "II", charges: 3,
    signature: "Iron that hums when it sees the smith.",
    lore: "<p>Slow-cooled meteoric iron with an aural signature — strikes a tone when shaped, holds its temper through a manifestation. Aurablade smiths swear by it.</p>",
    tags: ["heart-iron", "aurablade", "metal"]
  },
  {
    name: "Anchorstone",
    materialKey: "anchorstone",
    tier: "II", charges: 3,
    signature: "A weight that argues with the wind.",
    lore: "<p>Dense igneous rubble harvested from collapsed sept-foundations. Used to ballast Bulwark armor and ritual tools that need to <i>stay</i>.</p>",
    tags: ["bulwark", "stone", "ground"]
  },

  // ── Hex / Travel family ─────────────────────────────────────────────────
  {
    name: "Cold-Iron",
    materialKey: "cold-iron",
    tier: "II", charges: 5,
    signature: "Forged at midnight, never reheated.",
    lore: "<p>Iron worked once at low temperature and sealed before it can sing. Bites against curses and qliphothic substance; brittle to careless shaping.</p>",
    tags: ["iron", "cold-forge", "hex-resistant"]
  },
  {
    name: "Hex-Glyph Plate",
    materialKey: "hex-glyph-plate",
    tier: "III", charges: 2,
    signature: "Steel that argues with the weather.",
    lore: "<p>Sheet steel pre-engraved with hex-warding glyphs by an apprentice scribe. Each plate covers about a forearm's worth of armor; the glyph chosen at engraving decides what it deflects.</p>",
    tags: ["hex", "armor-plate", "warded"]
  },

  // ── Channel / Magic family ──────────────────────────────────────────────
  {
    name: "Focusing Lens",
    materialKey: "focusing-lens",
    tier: "II", charges: 3,
    signature: "Glass ground until it argues with light.",
    lore: "<p>Hand-ground glass blank, optical-grade. Used in laser barrels, sephirotic lenses, and confession crystals. Tedious to make; cheap to buy if you don't ask where it came from.</p>",
    tags: ["lens", "glass", "optical"]
  },
  {
    name: "Heart-Coil",
    materialKey: "heart-coil",
    tier: "II", charges: 2,
    signature: "Wound from a working that wanted to be a heart.",
    lore: "<p>Hand-wound copper-and-aurablade-resin coil, harvested from intact pre-Eden tech caches. The coil hums when current passes; the hum harmonizes with the wielder's pulse.</p>",
    tags: ["coil", "channel", "salvage"]
  },

  // ── Ritual / Pact family ───────────────────────────────────────────────
  {
    name: "Oath-Ink",
    materialKey: "oath-ink",
    tier: "II", charges: 3,
    signature: "Ink that won't let the page lie.",
    lore: "<p>Vegetal ink mixed with a drop of the writer's blood and a sept-witness's tear. Used in pact-styluses and notarized vows.</p>",
    tags: ["ink", "pact", "ritual"]
  },
  {
    name: "Vow-Resin",
    materialKey: "vow-resin",
    tier: "II", charges: 3,
    signature: "Hardened from the air of an unbroken promise.",
    lore: "<p>Crystalized residue collected from sept-rooms after long oath-keeping vigils. Used to seal pact-pen barrels and bind marrow-tonic compounds.</p>",
    tags: ["resin", "vow", "ritual"]
  }
];

const DEFAULT_IMG = "icons/svg/mystery-man.svg";

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);
  const docs = await pack.getDocuments();

  const RfiItems = game.fourththing?.items;
  if (!RfiItems) return ui.notifications?.error("RFI items API not available.");

  // Resolve a folder for materials — prefer a "Materials" or "RFI Materials"
  // subfolder if it exists, else fall back to root Gear.
  const allFolders = pack.folders ?? new Map();
  let targetFolder = null;
  for (const f of allFolders) {
    if (/^(rfi materials|materials)$/i.test(f.name)) { targetFolder = f; break; }
  }
  if (!targetFolder) {
    for (const f of allFolders) if (f.name === "Gear") { targetFolder = f; break; }
  }

  const created = [];
  const skipped = [];

  for (const row of MATERIALS) {
    const exists = docs.find(d => d.name === row.name);
    if (exists && !FORCE) { skipped.push(row.name); continue; }

    const defaults = RfiItems.defaults({ type: "gear", system: {}, getFlag: () => null });
    const rfiFlag = {
      ...defaults,
      tier:        row.tier,
      frame:       "material",
      origin:      "found",
      bound:       "free",
      signature:   row.signature,
      lore:        row.lore,
      upkeep:      { mode: "passive", per: "none" },
      charges:     row.charges,
      materialKey: row.materialKey
    };

    const itemData = {
      name:   row.name,
      type:   "gear",
      img:    DEFAULT_IMG,
      system: {
        slot: "material",
        tags: ["material", row.materialKey, ...(row.tags ?? [])]
      },
      flags:  { fourththing: { rfi: { item: rfiFlag } } }
    };
    if (targetFolder) itemData.folder = targetFolder.id;

    if (!DRY_RUN) await Item.create(itemData, { pack: PACK_ID });
    created.push(`+ ${row.name.padEnd(22)} key=${row.materialKey.padEnd(20)} T${row.tier} ×${row.charges}`);
  }

  console.group("RFI Materials seed");
  created.forEach(c => console.log(c));
  if (skipped.length) console.log("skipped (existed):", skipped.join(", "));
  console.groupEnd();

  if (DRY_RUN) ui.notifications?.info(`DRY RUN — would create ${created.length}; ${skipped.length} skipped.`);
  else ui.notifications?.info(`Created ${created.length} materials; ${skipped.length} skipped. Drag them onto a steward and click Forge.`);
})();

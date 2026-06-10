// Bad Eden — Create RFI Crafting Materials (Set 2 — fill out the catalog)
// ─────────────────────────────────────────────────────────────────────────────
// Adds the remaining 31 materials referenced by `materialOf` arrays in items
// shipped across sprints A2 + B + C + Rad Suits + Bad Eden Gear conversion.
// After this runs, EVERY recipe in those sprints is completable.
//
// Idempotent — items with matching names are skipped unless FORCE = true.
// Lands materials in the "Materials" / "RFI Materials" / "Gear" folder
// (whichever exists first).
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const DRY_RUN = false;
const FORCE   = false;

const MATERIALS = [
  // ── Sept Family (sept-house craft tradition) ───────────────────────────
  { name: "Blessed Thread",    materialKey: "blessed-thread",    tier: "I", charges: 5, sig: "Spool that hums faintly when held to the ear.", lore: "<p>Hand-spun thread blessed at a sept-altar. Sewn into vestments and pact-bindings.</p>" },
  { name: "Prayer Resin",      materialKey: "prayer-resin",      tier: "II", charges: 3, sig: "Tacky residue from a long vigil.", lore: "<p>Waxy buildup scraped from sept-pews after long vigils. Smells of incense and exhaustion.</p>" },
  { name: "Silence-Silk",      materialKey: "silence-silk",      tier: "III", charges: 2, sig: "Cloth so quiet it forgets it was woven.", lore: "<p>Spider-silk from caves below sept-trial chambers. Dampens sound and rumor in equal measure.</p>" },
  { name: "Sept Tuning Fork",  materialKey: "sept-tuning-fork",  tier: "II", charges: 2, sig: "One note, sustained until you stop listening.", lore: "<p>Cast at the moment of dawn from sept-bell alloy. Used as a tuning core in resonant weapons.</p>" },
  { name: "Sept-Stamped Haft", materialKey: "sept-stamped-haft", tier: "II", charges: 2, sig: "A handle that knows what it's for.", lore: "<p>Hardwood haft pressed with the maker-sept's seal. Improves grip in mercy weapons and ritual mauls.</p>" },
  { name: "Prayer Binding",    materialKey: "prayer-binding",    tier: "II", charges: 3, sig: "A knot that keeps a vow.", lore: "<p>Cord knotted in a sept-ritual pattern. Used to bind lenses, components, and oaths.</p>" },
  { name: "Sacred Gold",       materialKey: "sacred-gold",       tier: "III", charges: 2, sig: "Gold that remembers the offering plate.", lore: "<p>Gold reclaimed from sept-tithes and re-melted at consecrated forge. Resists qliphothic tarnish.</p>" },
  { name: "Scribed Steel",     materialKey: "scribed-steel",     tier: "III", charges: 2, sig: "Steel etched with a rule.", lore: "<p>Forge-blank steel inscribed with sept-canon glyphs along the fuller. Holds blessing in the cut.</p>" },

  // ── Vow / Pact Family ─────────────────────────────────────────────────
  { name: "Vow-Shaft",         materialKey: "vow-shaft",         tier: "II", charges: 3, sig: "A barrel that won't lie about what it carries.", lore: "<p>Hollow oath-wood reinforced with witness-glass. Forms the spine of pact styluses and binding tools.</p>" },
  { name: "Vow-Bound Edge",    materialKey: "vow-bound-edge",    tier: "III", charges: 1, sig: "An edge sworn to its purpose.", lore: "<p>Tempered cutting blank consecrated to a single function. Loses its potency if used outside its sworn role.</p>" },
  { name: "Witness Resin",     materialKey: "witness-resin",     tier: "III", charges: 1, sig: "Hardened tear of a sept-witness.", lore: "<p>Resinous residue from sept-witnesses who held truth too long. Used in the highest-tier ceremonial gear.</p>" },

  // ── Hex Family (hex-warding craft) ─────────────────────────────────────
  { name: "Hex-Script Plate",  materialKey: "hex-script",        tier: "II", charges: 3, sig: "A line of writing that turns weather.", lore: "<p>Pre-engraved metal strip carrying a single hex-warding glyph. Hand-applied by hex-scribes.</p>" },
  { name: "Hex-Iron Cleat",    materialKey: "hex-iron-cleat",    tier: "II", charges: 4, sig: "Iron stud that argues with terrain.", lore: "<p>Stamped iron cleat with hex-warding pattern. The pattern shifts when you're not looking — and when you need it to.</p>" },
  { name: "Hex Rope",          materialKey: "hex-rope",          tier: "I", charges: 5, sig: "Knotted to mark the way home.", lore: "<p>Plain rope knotted in a hex-pattern by a courier. The knots remember the route.</p>" },
  { name: "Anchor Quartz",     materialKey: "anchor-quartz",     tier: "II", charges: 3, sig: "Stone that disagrees with the wind.", lore: "<p>Crystal core extracted from anchorstone deposits. Holds resonance; ballasts heavy weapons.</p>" },

  // ── Channel / Tech Family (energy + salvage) ───────────────────────────
  { name: "Focused Crystal",   materialKey: "focused-crystal",   tier: "II", charges: 3, sig: "Crystal cut to a single colour.", lore: "<p>Lattice-grown crystal tuned to one frequency of the visible spectrum. Drives saber emitters and signal lenses.</p>" },
  { name: "Rad-Iron",          materialKey: "rad-iron",          tier: "II", charges: 4, sig: "Iron the wasteland reluctantly returned.", lore: "<p>Reclaimed iron from radiation-saturated ruins. Carries a faint click; tempered for energy weapon frames.</p>" },
  { name: "Soft Alloy",        materialKey: "soft-alloy",        tier: "II", charges: 3, sig: "Metal that yields without breaking.", lore: "<p>Engineered alloy that deforms under impact, transferring force without fragmenting bone. Mercy-weapon staple.</p>" },

  // ── Memory / Witness Family ────────────────────────────────────────────
  { name: "Finger-Bone",       materialKey: "finger-bone",       tier: "I", charges: 3, sig: "Small relic of a small confession.", lore: "<p>Knuckle-bone of a confessed witness. Used as a binding fetter or knife pommel — small admissions, sharp consequences.</p>" },
  { name: "Fogged Quartz",     materialKey: "fogged-quartz",     tier: "II", charges: 3, sig: "Crystal that holds what was said over it.", lore: "<p>Slow-cooled quartz with internal cloudiness. Records audible truth; releases it on a touch and a name.</p>" },
  { name: "Memory Resin",      materialKey: "memory-resin",      tier: "II", charges: 3, sig: "Setting compound that remembers being liquid.", lore: "<p>Slow-curing resin that holds its last molded shape; useful as a binder in confession crystals and recording matrices.</p>" },

  // ── Courier Family (Shadow Courier) ────────────────────────────────────
  { name: "Enamel Pin",        materialKey: "enamel-pin",        tier: "I", charges: 4, sig: "A small flag for a private kingdom.", lore: "<p>Enameled metal pin, sigil-blank. Used to identify Shadow Couriers — and, when worked, to bind crossing-magic.</p>" },
  { name: "Courier Glass",     materialKey: "courier-glass",     tier: "II", charges: 3, sig: "Glass that has been to where you haven't.", lore: "<p>Hand-blown glass from courier-route waystations. Each piece carries the route it traveled in its faint internal striae.</p>" },
  { name: "Threshold Wax",     materialKey: "threshold-wax",     tier: "II", charges: 3, sig: "Wax pressed at a door that mattered.", lore: "<p>Black wax sealed at a sept-threshold. Holds the threshold's permission; used in courier sigils and crossing pacts.</p>" },
  { name: "Brass Thumb-Bell",  materialKey: "brass-thumb-bell",  tier: "I", charges: 3, sig: "One sound, then silence.", lore: "<p>Tiny brass bell on a hex-rope cord. Rung once before crossing a threshold that matters.</p>" },

  // ── Aurablade / Marrow Family ──────────────────────────────────────────
  { name: "Marrow Tincture",   materialKey: "marrow-tincture",   tier: "III", charges: 2, sig: "A drop, drawn from a willing arm.", lore: "<p>Refined marrow tincture, drawn under sept-supervision. Required to bind heart-iron and vow-resin compounds; can never be commercially substituted.</p>" },

  // ── Sephirotic Family ──────────────────────────────────────────────────
  { name: "Tree-of-Life Shard", materialKey: "tree-of-life-shard", tier: "III", charges: 1, sig: "A piece of the diagram, made solid.", lore: "<p>Crystalline fragment dropped from sephirotic alignment events. Each shard carries one sefirah's signature; used in lenses and ward-anchors.</p>" },

  // ── Hexstrider Family ──────────────────────────────────────────────────
  { name: "Root Leather",      materialKey: "root-leather",      tier: "I", charges: 4, sig: "Leather that grew toward water.", lore: "<p>Leather cured with hex-root extract; tougher than vegetable-tan, breathes against radiation.</p>" },
  { name: "Balance Bind",      materialKey: "balance-bind",      tier: "II", charges: 3, sig: "A cord that argues with gravity.", lore: "<p>Hand-twisted cord of hex-rope and witness-thread. Used in cleats and ritual harnesses where staying upright matters.</p>" },

  // ── Misc Mundane (low-tier shop materials) ─────────────────────────────
  { name: "Bronze Nail",       materialKey: "bronze-nail",       tier: "I", charges: 10, sig: "A fastener with no opinions.", lore: "<p>Plain bronze nail. Useful in knife construction, sept-fittings, and patching boots. Common.</p>" },

  // ── Aurablade variant (heart-iron substack) ────────────────────────────
  { name: "Heart-Iron Shaving", materialKey: "heart-iron-shaving", tier: "I", charges: 5, sig: "A flake that hums.", lore: "<p>Curl of heart-iron pulled from the smith's anvil. Used as catalyst in marrow tonics and aurablade compounds; one stack equals one full bar shaved.</p>" }
];

const DEFAULT_IMG = "icons/svg/mystery-man.svg";

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);
  const docs = await pack.getDocuments();

  const RfiItems = game.fourththing?.items;
  if (!RfiItems) return ui.notifications?.error("RFI items API not available.");

  const allFolders = pack.folders ?? new Map();
  let targetFolder = null;
  for (const f of allFolders) {
    if (/^(rfi materials|materials)$/i.test(f.name)) { targetFolder = f; break; }
  }
  if (!targetFolder) for (const f of allFolders) if (f.name === "Gear") { targetFolder = f; break; }

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
      signature:   row.sig,
      lore:        row.lore,
      upkeep:      { mode: "passive", per: "none" },
      charges:     row.charges,
      materialKey: row.materialKey
    };

    const itemData = {
      name:   row.name,
      type:   "gear",
      img:    DEFAULT_IMG,
      system: { slot: "material", tags: ["material", row.materialKey] },
      flags:  { fourththing: { rfi: { item: rfiFlag } } }
    };
    if (targetFolder) itemData.folder = targetFolder.id;

    if (!DRY_RUN) await Item.create(itemData, { pack: PACK_ID });
    created.push(`+ ${row.name.padEnd(24)} key=${row.materialKey.padEnd(24)} T${row.tier} ×${row.charges}`);
  }

  console.group(`RFI Materials Set 2 — ${created.length} created, ${skipped.length} skipped`);
  created.forEach(c => console.log(c));
  if (skipped.length) console.log("skipped (existed):", skipped.join(", "));
  console.groupEnd();

  if (DRY_RUN) ui.notifications?.info(`DRY RUN — would create ${created.length}; ${skipped.length} skipped.`);
  else ui.notifications?.info(`Created ${created.length} materials; ${skipped.length} skipped. Catalog complete.`);
})();

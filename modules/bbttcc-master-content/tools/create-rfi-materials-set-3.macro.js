// Bad Eden — Create RFI Crafting Materials (Set 3 — raw natural resources)
// ─────────────────────────────────────────────────────────────────────────────
// Set 1 + Set 2 shipped 43 theme-loaded materials (sept/vow/witness/courier).
// Set 3 fills the natural-resource gap so the Hex Resource Node seeder can
// populate wilderness/mountains/swamp/river/plains/etc. with terrain-true
// raw materials. Idempotent — items with matching names are skipped unless
// FORCE = true.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const DRY_RUN = false;
const FORCE   = false;

const MATERIALS = [
  // ── Mountains / Canyons ────────────────────────────────────────────────
  { name: "Ore Vein",          materialKey: "ore-vein",          tier: "I",  charges: 6, sig: "A bright streak in the dark stone.",          lore: "<p>Raw ferrous ore broken from a mountainside outcrop. Smelt-ready, but the slag tells stories.</p>" },
  { name: "Mountain Stone",    materialKey: "mountain-stone",    tier: "I",  charges: 8, sig: "Cold to the palm, slow to warm.",            lore: "<p>Quarried highland stone — durable, dense, indifferent. Ballast for vehicles, anchor for forge-frames.</p>" },
  { name: "Crystal Fragment",  materialKey: "crystal-fragment",  tier: "II", charges: 3, sig: "A shard that catches one wavelength.",        lore: "<p>Raw lattice fragment from a high-altitude crystal field. Pre-cut, pre-tuning — the smith decides the colour.</p>" },
  { name: "Sun-Glass",         materialKey: "sun-glass",         tier: "II", charges: 3, sig: "Glass the sun made by accident.",             lore: "<p>Volcanic glass formed in canyon firefalls and desert lightning strikes. Sharp, brittle, useful for blades and lenses.</p>" },

  // ── Forest ────────────────────────────────────────────────────────────
  { name: "Ash-Wood",          materialKey: "ash-wood",          tier: "I",  charges: 6, sig: "A grain that argues with the saw.",           lore: "<p>Hard-grained timber pulled from old-growth forest. Bowyers and haft-makers fight over the straight runs.</p>" },
  { name: "Wild Herb",         materialKey: "wild-herb",         tier: "I",  charges: 8, sig: "Bunched fragrance still attached to dirt.",   lore: "<p>Mixed cuttings of medicinal and culinary herbs — bitterleaf, salvia, pith-flower. Tincture stock for any apothecary.</p>" },

  // ── Swamp ─────────────────────────────────────────────────────────────
  { name: "Mire-Resin",        materialKey: "mire-resin",        tier: "II", charges: 4, sig: "Thick black sap that won't wash off.",        lore: "<p>Dense resin tapped from swamp-rooted hardwoods. Waterproofs, binds, and stains the hands of whoever tries.</p>" },
  { name: "Bog-Iron",          materialKey: "bog-iron",          tier: "I",  charges: 5, sig: "Iron the swamp gave up reluctantly.",         lore: "<p>Nodules of iron concretion harvested from peat-bog seeps. Lower yield than mine ore, but free from the deep-rock toll.</p>" },
  { name: "Reagent Moss",      materialKey: "reagent-moss",      tier: "I",  charges: 8, sig: "A green that absorbs more than it should.",   lore: "<p>Sphagnum-grade moss with native alchemical properties. Used as a base medium for tinctures, antitoxins, and slow-burn fuses.</p>" },

  // ── River / Ocean ─────────────────────────────────────────────────────
  { name: "River Clay",        materialKey: "river-clay",        tier: "I",  charges: 8, sig: "Wet earth that holds a thumbprint.",          lore: "<p>Fine-grained clay scooped from river-mouth deposits. Throws a pot, seals a wound, beds a cobble road.</p>" },
  { name: "Salt Block",        materialKey: "salt-block",        tier: "I",  charges: 6, sig: "A pale brick that sweats in summer.",         lore: "<p>Evaporated salt cake from coastal pans or upstream brine springs. Currency, preservative, ritual perimeter.</p>" },
  { name: "Freshwater Pearl",  materialKey: "freshwater-pearl",  tier: "II", charges: 2, sig: "A small moon someone shucked.",               lore: "<p>Irregular pearl from river mussels — softer luster than ocean stock, but more affordable for sigil-work and offering plates.</p>" },

  // ── Plains ────────────────────────────────────────────────────────────
  { name: "Wild Grain",        materialKey: "wild-grain",        tier: "I",  charges: 8, sig: "Heads heavy enough to bow the stalk.",        lore: "<p>Cut grain from open prairie — millable, brewable, fermentable. Field-essential, town-affordable.</p>" },
  { name: "Herd Leather",      materialKey: "herd-leather",      tier: "I",  charges: 5, sig: "Hide still smelling of grass and exhaustion.", lore: "<p>Raw, salt-cured plains-herd hide. Untreated stock for armorers and saddlers; pre-sept, pre-blessing.</p>" },

  // ── Wasteland / Ruins ─────────────────────────────────────────────────
  { name: "Scrap Salvage",     materialKey: "scrap-salvage",     tier: "I",  charges: 6, sig: "A handful of weight that used to be something.", lore: "<p>Mixed salvage from collapsed structures and cratered roads. Sorted and stripped, it feeds every working forge.</p>" },
  { name: "Pre-Fall Component", materialKey: "prefall-component", tier: "III", charges: 1, sig: "A small machine that still wants to work.",   lore: "<p>Salvaged module from pre-Fall infrastructure — circuit core, gear assembly, power cell. Inscrutable, irreplaceable, carefully boxed.</p>" }
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
    created.push(`+ ${row.name.padEnd(24)} key=${row.materialKey.padEnd(20)} T${row.tier} ×${row.charges}`);
  }

  console.group(`RFI Materials Set 3 — ${created.length} created, ${skipped.length} skipped`);
  created.forEach(c => console.log(c));
  if (skipped.length) console.log("skipped (existed):", skipped.join(", "));
  console.groupEnd();

  if (DRY_RUN) ui.notifications?.info(`DRY RUN — would create ${created.length}; ${skipped.length} skipped.`);
  else ui.notifications?.info(`Created ${created.length} natural-resource materials; ${skipped.length} skipped.`);
})();

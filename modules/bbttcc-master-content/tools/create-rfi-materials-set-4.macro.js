// Bad Eden — Create RFI Crafting Materials (Set 4 — the recipe vocabulary the land never yielded)
// ─────────────────────────────────────────────────────────────────────────────
// Audit 2026-09-20: 259 recipe rows across the libraries name 133 material keys; sets 1–3 minted 59. This set mints
// the REAL materials still missing (ores, leathers, hafts, weaves, salvage parts, threads, crystal) so hex-node drops
// clone a real item and the Forge's "0/1" chips can be filled. Two keys are NOT minted on purpose — `scrap-steel` and
// `pre-fall-component` are aliases of `scrap-salvage` / `prefall-component` inside the Forge (RfiCrafting.KEY_ALIASES).
// The 19 abstract "materials" the Crown Mall items name (regret, team-spirit, physics-violation…) await a ruling.
// Idempotent — items with matching names are skipped unless FORCE = true. Dry run lists, then a confirm dialog applies.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const FORCE   = false;

const M = (name, materialKey, tier, charges, sig, lore) => ({ name, materialKey, tier, charges, sig, lore: `<p>${lore}</p>` });
const MATERIALS = [
  // ── ORE family (mountain / mine / bog drops) ───────────────────────────
  M("Pig Iron",            "pig-iron",            "I",   6, "Rough bars still sweating slag.",                 "First-smelt iron poured from bog and vein ore. Brittle until worked; the forge's daily bread."),
  M("Threshold Iron",      "threshold-iron",      "II",  3, "Iron that remembers a doorway.",                 "Iron quenched across a lintel at the turn of the day. Wards like to be hung from it."),
  M("Brace Iron",          "brace-iron",          "I",   5, "Bent once, on purpose.",                          "Strap iron pre-curved for bracing frames, chassis and splints."),
  M("Wardiron",            "wardiron",            "III", 2, "Cold even in the fire.",                         "Cold-iron refined under a spoken ward. Holds an inscription the way skin holds a scar."),
  M("Blessed Steel",       "blessed-steel",       "III", 2, "Steel that was prayed over before it was struck.", "Sept-blessed steel stock. Takes a sigil cleanly and never rings false."),
  M("Mirror Alloy",        "mirror-alloy",        "III", 2, "A metal that shows you slightly late.",          "Silvered alloy drawn from crystal-field runoff. Lenses, scrying plates, reflective wards."),
  M("Silence Alloy",       "silence-alloy",       "III", 2, "Drops without a sound.",                         "Lead-tin alloy tuned against resonance. Dampens the hum of anything cased in it."),
  M("Brass",               "brass",               "I",   6, "Yellow metal, honest weight.",                   "Copper-zinc stock for fittings, bells, valves and casings."),
  M("Casing Brass",        "casing-brass",        "I",   8, "A handful of small bright cups.",                "Drawn brass for cartridge and shell casings. Reloaders hoard it."),
  M("Lead Shot",           "lead-shot",           "I",   8, "Heavy, dull, decisive.",                         "Cast lead pellets and balls. Ammunition, counterweight, ballast."),
  M("Sheet Steel",         "sheet-steel",         "I",   6, "Flat, cold, wants to be a plate.",               "Rolled salvage steel in sheets. Armor plate, panels, shields, hulls."),
  M("Rivet Plate",         "rivet-plate",         "I",   6, "Pre-drilled, pre-decided.",                      "Small steel plates punched for riveting. Armor, straps and reinforcements go faster with it."),
  M("Pre-Fall Stainless",  "pre-fall-stainless",  "II",  3, "Still shining, unfairly.",                       "Stainless stock salvaged from pre-Fall kitchens and clinics. Never rusts; never forgives a bad weld."),
  // ── SALVAGE parts ───────────────────────────────────────────────────────
  M("Spring-Tension Arm",  "spring-tension-arm",  "II",  3, "A coiled argument with gravity.",                "Salvaged spring assembly. Triggers, launchers, traps, prosthetics."),
  M("Pre-Fall Electronics","pre-fall-electronics","III", 1, "A board that still hums if you ask nicely.",     "Circuit boards and sensor packs from before the Fall. Yesodic tech wants them."),
  M("Stubborn Batteries",  "stubborn-batteries",  "II",  2, "Holds a charge out of spite.",                   "Cells that should have died decades ago. They did not."),
  M("Ley-Tuned Magnetic Tape","ley-tuned-magnetic-tape","III",1,"A ribbon that hums at the right pitch.",     "Cassette tape re-magnetised on a leyline. Records more than sound."),
  M("Lunchbox Frame",      "lunchbox-frame",      "I",   4, "Tin, hinged, somebody's name scratched inside.", "Pressed-tin lunchbox shells. Small casings, reliquaries, radios."),
  M("Sealed Foil",         "sealed-foil",         "I",   6, "Crinkles like it has a secret.",                 "Pre-Fall packaging foil, still sealed. Shielding, wrapping, offering plates."),
  M("Pre-Fall Signage",    "pre-fall-signage",    "II",  2, "Letters that still insist.",                     "Enamelled and plastic signs from before. Words carry weight; these carry it literally."),
  M("Pre-Fall Condiment",  "pre-fall-condiment",  "I",   4, "Best before a civilisation.",                    "Sealed sauces and pastes. Reagent, bribe, dare."),
  M("Actually Suspect Additives","actually-suspect-additives","II",2,"Ingredients: yes.",                     "Pre-Fall food chemistry in powder form. Alchemists and the very hungry disagree about it."),
  M("Expanded Polyurethane","expanded-polyurethane","I",  5, "Foam that forgot to decay.",                    "Salvaged foam blocks. Padding, flotation, insulation, moulds."),
  M("Competent Engraving", "competent-engraving", "II",  3, "Someone took their time.",                       "Engraved plates and fittings recovered intact. Reused as sigil bases and maker's marks."),
  // ── HIDE family ─────────────────────────────────────────────────────────
  M("Work Leather",        "work-leather",        "I",   6, "Tanned, oiled, already tired.",                  "Herd hide tanned for daily use. Aprons, boots, harness, armour backing."),
  M("Road Leather",        "road-leather",        "II",  4, "Scuffed by a hundred miles of thatward.",        "Hide cured on the road with salt and smoke. Tougher than work leather, and it knows the routes."),
  M("Oath Leather",        "oath-leather",        "III", 2, "Sworn on, then cut.",                            "Hide tanned in a vow-bath. Binds a promise into whatever it's stitched to."),
  M("Sept Leather",        "sept-leather",        "II",  3, "Stamped seven times.",                           "Leather blessed and stamped by a sept. Vestments, bindings, ritual straps."),
  M("Leather Strap",       "leather-strap",       "I",   8, "Buckle optional.",                               "Cut and finished leather strapping. Belts, harness, armor points."),
  M("Leather Grip",        "leather-grip",        "I",   8, "Wrapped by hand, warmed by the same.",           "Wound leather grips for hafts, hilts and handles."),
  M("Leather Cuff",        "leather-cuff",        "I",   6, "Protects the wrist, hides the pulse.",           "Stitched leather cuffs. Bracers, gauntlet backing, sleeve ends."),
  M("Rivet Strap",         "rivet-strap",         "I",   6, "Leather that clanks.",                           "Leather strap pre-set with rivets. Fast armour, fast harness."),
  M("Wrapped Leather",     "wrapped-leather",     "I",   6, "Layered until it stops arguing.",                "Leather wound in layers for shafts, stocks and shield rims."),
  M("Corded Belt",         "corded-belt",         "I",   6, "Holds more than trousers up.",                   "Cord-reinforced leather belt stock. Rigs, packs, sling points."),
  M("Tool Loop",           "tool-loop",           "I",   8, "Somewhere to hang the day.",                     "Sewn leather loops for tools and kit. Bandoliers, aprons, work rigs."),
  M("Bad Eden Meat",       "bad-eden-meat",       "I",   6, "Tastes like the hex it came from.",              "Butchered herd and game. Rations, bait, offerings, upkeep."),
  // ── WOOD family ─────────────────────────────────────────────────────────
  M("Oak Core",            "oak-core",            "II",  3, "The tree's opinion, heartwood-deep.",            "Heartwood billets of old oak. Stocks, shield bosses, altar blocks."),
  M("Hickory Haft",        "hickory-haft",        "I",   6, "Springs back; so will you.",                     "Shaped hickory handles for axes, hammers and mauls."),
  M("Ash Haft",            "ash-haft",            "I",   6, "Straight-grained and patient.",                  "Turned ash shafts for spears, tools and staves."),
  M("Walnut Stock",        "walnut-stock",        "II",  3, "Dark grain, warm shoulder.",                     "Walnut blanks for rifle and crossbow stocks."),
  M("Vigil Resin",         "vigil-resin",         "II",  3, "Sap tapped at the hour nobody sleeps.",          "Resin gathered during a night vigil. Lamps, wards, slow fuses."),
  // ── WEAVE / thread ──────────────────────────────────────────────────────
  M("Wool",                "wool",                "I",   8, "Warm, itchy, ordinary.",                         "Raw shorn wool. Liners, padding, cloaks, felt."),
  M("Sept Wool",           "sept-wool",           "II",  4, "Shorn under a blessing.",                        "Wool from sept-kept flocks. Vestment cloth and warded linings."),
  M("Warded Wool",         "warded-wool",         "III", 2, "Felted with a sigil in the nap.",                "Wool felted around a written ward. Coats that keep more than the cold out."),
  M("Prayer Thread",       "prayer-thread",       "I",   8, "A line with a line in it.",                      "Thread spun while a litany is spoken. Sept stitching and binding."),
  M("Calming Thread",      "calming-thread",      "II",  4, "Steadies the hand that holds it.",               "Herb-dyed thread that quiets the nerves. Medics' kits, focus wraps."),
  M("Ash Thread",          "ash-thread",          "II",  3, "Grey, fine, remembers fire.",                    "Thread spun with ash-wood fibre and hearth ash. Mourning work and fire wards."),
  M("Circle Silk",         "circle-silk",         "III", 2, "Woven in a ring, never cut in one.",             "Silk spun in a closed circle. Binding cloth for rites and vows."),
  M("Yesodium Thread",     "yesodium-thread",     "III", 2, "Glows faintly when the ley shifts.",             "Thread drawn with yesodium filament. Circuitry you can sew."),
  M("Road Canvas",         "road-canvas",         "I",   6, "Patched, waxed, still travelling.",              "Heavy canvas from tents, tarps and sails. Packs, awnings, rig skins."),
  M("Pre-Fall Cotton",     "pre-fall-cotton",     "II",  3, "Softer than anything grown since.",              "Bolts of pre-Fall cotton from sealed stock. Liners, bandages, fine shirts."),
  M("Gambeson",            "gambeson",            "I",   3, "Quilted courage.",                               "Padded cloth armour body, ready for plates or wear on its own."),
  M("Padded Coat",         "padded-coat",         "I",   3, "A coat that argues with knives.",                "Layered and stitched coat blank. Armour base, winter wear."),
  M("Quilted Liner",       "quilted-liner",       "I",   4, "What the armour is actually made of.",           "Quilted liner panels for helmets, cuirasses and coats."),
  M("Mail",                "mail",                "II",  2, "Rings, thousands, all agreeing.",                "Riveted mail sections. Armour, curtains, drag-nets for the strange."),
  // ── HERB / kitchen ──────────────────────────────────────────────────────
  M("Ground Bean",         "ground-bean",         "I",   8, "Smells like a morning that might go well.",      "Roasted and ground bean. Coffee, ration, bargaining chip."),
  M("Low-Grade Precognition","low-grade-precognition","III",1,"You knew you'd find this.",                    "A distillate of swamp herb and quartz dust. A few seconds ahead, no more."),
  // ── CRYSTAL / sacred ────────────────────────────────────────────────────
  M("Hex Lattice",         "hex-lattice",         "III", 2, "Six-sided, all the way down.",                   "Crystal grown in a hex field's own geometry. Anchors, keystones, hexchrome work."),
  M("Sept Silver",         "sept-silver",         "II",  3, "Silver that has heard a service.",               "Silver refined and blessed by a sept. Sigils, offering plates, sacred fittings."),
  // ── PAPER / ink ─────────────────────────────────────────────────────────
  M("Pre-Fall Paper",      "pre-fall-paper",      "I",   8, "Still white, unreasonably.",                     "Reams and sheets from before. Receipts, wards, maps, letters."),
  M("Wax Paper",           "wax-paper",           "I",   8, "Keeps the grease in and the world out.",         "Waxed sheets. Wrapping, seals, slow-burn fuses."),
  M("Receipt Paper",       "receipt-paper",       "I",   8, "Proof, by the roll.",                            "Thermal roll stock. The Errata's favourite medium."),
  M("Ink, Three Colors",   "ink-three-colors",    "II",  3, "Red for what was, black for what is, blue for what's owed.", "A three-well ink set. Annotation, marginalia, contracts.")
];

const DEFAULT_IMG = "icons/svg/mystery-man.svg";

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);
  const docs = await pack.getDocuments();
  const RfiItems = game.fourththing?.items;
  if (!RfiItems) return ui.notifications?.error("RFI items API not available.");

  const allFolders = pack.folders ?? new Map(); let targetFolder = null;
  for (const f of allFolders) if (/^(rfi materials|materials)$/i.test(f.name)) { targetFolder = f; break; }
  if (!targetFolder) for (const f of allFolders) if (f.name === "Gear") { targetFolder = f; break; }

  const haveKey = new Set(docs.map(d => foundry.utils.getProperty(d, "flags.fourththing.rfi.item.materialKey")).filter(Boolean));
  const toCreate = [], skipped = [];
  for (const row of MATERIALS) {
    const exists = docs.find(d => d.name === row.name) || (haveKey.has(row.materialKey) ? { name: row.materialKey } : null);
    if (exists && !FORCE) { skipped.push(row.name); continue; }
    const defaults = RfiItems.defaults({ type: "gear", system: {}, getFlag: () => null });
    const rfiFlag = { ...defaults, tier: row.tier, frame: "material", origin: "found", bound: "free", signature: row.sig, lore: row.lore,
      upkeep: { mode: "passive", per: "none" }, charges: row.charges, materialKey: row.materialKey };
    const itemData = { name: row.name, type: "gear", img: DEFAULT_IMG, system: { slot: "material", tags: ["material", row.materialKey] }, flags: { fourththing: { rfi: { item: rfiFlag } } } };
    if (targetFolder) itemData.folder = targetFolder.id;
    toCreate.push(itemData);
  }
  console.group(`RFI Materials Set 4 — ${toCreate.length} to create, ${skipped.length} skipped`);
  toCreate.forEach(d => console.log(`+ ${d.name.padEnd(26)} key=${d.flags.fourththing.rfi.item.materialKey.padEnd(26)} T${d.flags.fourththing.rfi.item.tier} ×${d.flags.fourththing.rfi.item.charges}`));
  if (skipped.length) console.log("skipped (existed):", skipped.join(", "));
  console.groupEnd();
  if (!toCreate.length) return ui.notifications?.info("RFI Materials Set 4: nothing to create.");
  const yes = await Dialog.confirm({ title: "Create RFI Materials — Set 4", content: `<p><b>${toCreate.length}</b> material item(s) would be created in <code>${PACK_ID}</code> (${skipped.length} already exist; list in the console).</p><p>Create them?</p>` });
  if (!yes) return;
  for (const d of toCreate) await Item.create(d, { pack: PACK_ID });
  ui.notifications?.info(`Created ${toCreate.length} materials (set 4); ${skipped.length} skipped.`);
})();

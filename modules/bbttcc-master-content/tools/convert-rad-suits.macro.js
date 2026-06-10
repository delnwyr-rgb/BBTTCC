// Bad Eden — Convert Rad Suits to RFI-native Armor
// ─────────────────────────────────────────────────────────────────────────────
// Rewrites the three Rad Suits in `bbttcc-master-content.items` from the dnd5e
// equipment shape (system.armor.value, system.type.value=light/medium/heavy)
// into the fourththing armor shape:
//   { guardBonus, evasionBonus, resolveBonus, resistances, armorSkill,
//     equipped, tags }
//
// Also stamps:
//   • flags.fourththing.rfi.item   — schema (tier, frame, signature, origin)
//   • flags.fourththing.grants     — defense engine grants (resistances)
//   • the original system block under flags.fourththing.rfi.item.legacySystem
//     so the dnd5e descriptions/weight/price aren't lost.
//
// Run as a GM script macro. Safe to re-run — overwrites in place.
// Set DRY_RUN = true to preview without writing.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const DRY_RUN = false;

// One row per suit. armorSkill choices reflect the "what skill makes this
// gear sing" question: weave for flexible liners, warding for radiation-
// shielded suits, plating for heavy hardsuits.
const SUITS = [
  {
    match:        /^Rad Suit \(Mk I\)$/i,
    armorSkill:   "weave",
    guardBonus:   2,
    evasionBonus: 1,
    resolveBonus: 1,
    tier:         "II",
    signature:    "Sealed against the unseen.",
    description:  "<p>Light hazmat liner. Flexible, shielded weave keeps the slow death out without slowing the wearer down.</p>",
    resistances:  ["radiation", "necrotic"]
  },
  {
    match:        /^Rad Suit \(Mk II\)$/i,
    armorSkill:   "warding",
    guardBonus:   3,
    evasionBonus: 0,
    resolveBonus: 2,
    tier:         "III",
    signature:    "Containment, standard issue.",
    description:  "<p>Standard hazmat suit. Layered warding shrugs off creeping toxins; a vow not to flinch when the geiger sings.</p>",
    resistances:  ["radiation", "necrotic", "poison"]
  },
  {
    match:        /^Rad Suit \(Mk III\)$/i,
    armorSkill:   "plating",
    guardBonus:   4,
    evasionBonus: -1,
    resolveBonus: 3,
    tier:         "IV",
    signature:    "Walks through the wasteland like it's a memory.",
    description:  "<p>Heavy hardsuit. Plate-grade shielding turns the wearer into a slow-moving sanctuary; movement suffers, the world bounces off.</p>",
    resistances:  ["radiation", "necrotic", "poison", "kinetic"]
  }
];

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);
  const docs = await pack.getDocuments();

  const RfiItems = game.fourththing?.items;
  if (!RfiItems) return ui.notifications?.error("RFI items API not available — load the fourththing system.");

  const updates = [];
  const reportRows = [];

  for (const suit of SUITS) {
    const item = docs.find(d => suit.match.test(d.name));
    if (!item) {
      reportRows.push(`✗ NOT FOUND: ${suit.match}`);
      continue;
    }

    const legacySystem = foundry.utils.deepClone(item.system ?? {});
    const defaults = RfiItems.defaults({ type: "armor", system: {}, getFlag: () => null });

    const rfiFlag = {
      ...defaults,
      tier:      suit.tier,
      frame:     "armor",
      origin:    "looted",
      signature: suit.signature,
      // Keep the original dnd5e shape recoverable.
      legacySystem
    };

    const grants = {
      resistances: suit.resistances.map(t => ({ type: t }))
    };

    const newSystem = {
      guardBonus:   suit.guardBonus,
      evasionBonus: suit.evasionBonus,
      resolveBonus: suit.resolveBonus,
      armorSkill:   suit.armorSkill,
      equipped:     false,
      resistances:  suit.resistances.slice(), // mirror on system for clarity in the item sheet
      tags:         ["hazmat", "rad-shielded"]
    };

    // fourththing's armor schema has no description field (per template.json);
    // stash the lore on the RFI flag where the item sheet strip + future tools
    // can surface it without breaking the data model.
    rfiFlag.lore = suit.description;

    updates.push({
      _id:    item.id,
      type:   "armor",
      system: newSystem,
      "flags.fourththing.rfi.item": rfiFlag,
      "flags.fourththing.grants":   grants
    });

    reportRows.push(`✓ ${item.name.padEnd(20)} T${suit.tier} ${suit.armorSkill.padEnd(8)} G+${suit.guardBonus} E${suit.evasionBonus >= 0 ? "+" : ""}${suit.evasionBonus} R+${suit.resolveBonus} resists=${suit.resistances.join(",")}`);
  }

  if (DRY_RUN) {
    console.group("Rad Suit conversion — DRY RUN");
    reportRows.forEach(r => console.log(r));
    console.groupEnd();
    return ui.notifications?.info(`DRY RUN — would update ${updates.length} suit(s).`);
  }

  if (updates.length) {
    await Item.updateDocuments(updates, { pack: PACK_ID });
  }

  console.group("Rad Suit conversion — applied");
  reportRows.forEach(r => console.log(r));
  console.groupEnd();
  ui.notifications?.info(`Rad Suits converted: ${updates.length}.`);
})();

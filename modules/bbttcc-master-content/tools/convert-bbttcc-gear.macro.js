// BBTTCC — Convert BBTTCC Gear (root Gear folder) to RFI-native gear
// ─────────────────────────────────────────────────────────────────────────────
// Walks the 13 hand-authored BBTTCC items in the root Gear folder of the
// `bbttcc-master-content.items` pack and rewrites them as fourththing gear:
//
//   • type: equipment / consumable → gear  (constructor coercion handles
//     drag-drop too, but we fix the source pack so it's clean going forward)
//   • flags.fourththing.rfi.item   — tier, frame, origin, signature, lore
//   • flags.fourththing.grants     — resistances/condition-immunities for
//     items where the protection is canonical (Filtermask vs poison, Radcloth
//     Hood + Scrubber Harness vs radiation). Equip + skill gating already
//     wired in the defense engine.
//
// Items without an engine hook (Hex Boots travel DC, Geiger Drone release,
// Reactor Shield Cape reaction, etc.) are stamped with tier + signature +
// lore only — the mechanic stays GM-asserted until a future sprint adds the
// engine for it. Better than fake active-effects that don't fire.
//
// Run as a GM script macro. Safe to re-run — overwrites in place.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const DRY_RUN = false;

// One row per item. Keep `tier` modest (T1/T2/T3) — these are mundane gear,
// not manifestations. Authored T-IV would say "this is on par with the Mk III
// Hardsuit" which only Reactor Shield Cape comes close to.
const GEAR = [
  {
    name: "Filtermask Mk II",
    tier: "I", frame: "tool", origin: "looted",
    signature: "The world quiets when you breathe through the mask.",
    lore: "Sealed breather. Filters dust, spores, gas; gives a Body save the second wind it needs.",
    grants: { resistances: ["poison"] },
    tags:   ["mask", "breather"]
  },
  {
    name: "Geiger Familiar Drone",
    tier: "II", frame: "tool", origin: "looted",
    signature: "It clicks for what you can't see yet.",
    lore: "Tiny flying sensor (Guard 15, Integrity 5). Released as an action — maps radiation pockets and Spark traces within 300 ft for 10 minutes.",
    tags: ["drone", "sensor"]
  },
  {
    name: "Grapnel Spool",
    tier: "II", frame: "tool", origin: "looted",
    signature: "Up and across is the same direction.",
    lore: "Fifty feet of mono-filament. Reroll the lowest die on climb/jump tests; pulls a Medium target on a Body vs. DC 13.",
    tags: ["climbing", "rope"]
  },
  {
    name: "Hex Boots",
    tier: "II", frame: "tool", origin: "looted",
    signature: "The land bends a little for the right wearer.",
    lore: "Boosters tuned for hex-crawl reality. Once per travel leg, reduce the Travel Check DC by 2 (min 10) for the party.",
    tags: ["travel", "boots"]
  },
  {
    name: "Hex Compass",
    tier: "I", frame: "tool", origin: "looted",
    signature: "Home pulls.",
    lore: "When traveling overland, you always know the nearest aligned hex of your faction.",
    tags: ["compass", "navigation"]
  },
  {
    name: "Horizon Courier Pack",
    tier: "III", frame: "tool", origin: "looted",
    signature: "A leap that mistakes itself for flight.",
    lore: "Folding glider + energy assist. 40-ft fly speed for 10 minutes (1/day); overland travel time −25% for a small party.",
    tags: ["pack", "glider", "travel"]
  },
  {
    name: "Proselyte Recon Drone",
    tier: "III", frame: "tool", origin: "looted",
    signature: "An eye where you cannot be.",
    lore: "Orb drone with omnidirectional eyes. Reroll the lowest die on Stealth (Intrigue) checks while surveilling; can project Minor Illusion at will.",
    tags: ["drone", "stealth", "surveillance"]
  },
  {
    name: "Quipu Ledger Strap",
    tier: "I", frame: "tool", origin: "looted",
    signature: "Memory braided into rope.",
    lore: "Knotted cord mnemonic. You always recall the last 10 War Log entries precisely; +1 to Economy checks auditing supplies.",
    tags: ["mnemonic", "ledger"]
  },
  {
    name: "Radcloth Hood",
    tier: "I", frame: "tool", origin: "looted",
    signature: "Cloth, sigil, vow.",
    lore: "Light hood woven with shielding sigils. Reroll the lowest die on saves vs mild radiation & spores; reduces Swamp/Mire and Wasteland exposure checks.",
    grants: { resistances: ["radiation"] },
    tags: ["hood", "rad-shielded"]
  },
  {
    name: "Reactor Shield Cape",
    tier: "III", frame: "tool", origin: "looted",
    signature: "When the world flares, the cape drinks.",
    lore: "Reaction (3/day): on taking energy damage, gain resistance to energy until the end of your next turn. Manually tracked — no auto-effect.",
    // No always-on grant — it's a reaction, not a passive.
    tags: ["cape", "reactor", "reaction"]
  },
  {
    name: "Rust-Ooze Solvent Vial",
    tier: "I", frame: "consumable", origin: "looted",
    signature: "The grip lets go.",
    lore: "Dissolves mundane rust/ooze residue. Reroll the lowest die to escape viscous traps or rust-restraints for 1 minute. Single use.",
    tags: ["solvent", "consumable", "single-use"]
  },
  {
    name: "Scrapwork Toolkit",
    tier: "I", frame: "tool", origin: "looted",
    signature: "Useful hands, useful tools.",
    lore: "Counts as tinker's tools. Repairing constructs/vehicles takes 25% less time.",
    tags: ["toolkit", "tinker"]
  },
  {
    name: "Scrubber Harness",
    tier: "III", frame: "tool", origin: "looted",
    signature: "Clean the air. Clean the wearer.",
    lore: "Radiation Dampening: reduces wearer's radiation exposure tier by 1 (min 0). Cleanse: 2/day, as an action, scrub radiation from a 10-ft cube.",
    grants: { resistances: ["radiation"] },
    tags: ["harness", "rad-cleanse"]
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
  const missing = [];

  for (const row of GEAR) {
    const item = docs.find(d => d.name === row.name);
    if (!item) { missing.push(row.name); continue; }

    const legacySystem = foundry.utils.deepClone(item.system ?? {});
    const defaults = RfiItems.defaults({ type: "gear", system: {}, getFlag: () => null });

    const rfiFlag = {
      ...defaults,
      tier:      row.tier,
      frame:     row.frame,
      origin:    row.origin,
      signature: row.signature,
      lore:      row.lore,
      legacySystem
    };

    // Single-use consumables get an upkeep stamp so the engine sees them as
    // "no upkeep" (consumables don't tick footprint).
    if (row.frame === "consumable") {
      rfiFlag.upkeep = { mode: "passive", per: "none" };
    }

    const update = {
      _id:    item.id,
      type:   "gear",
      system: { slot: "misc", tags: row.tags ?? [] },
      "flags.fourththing.rfi.item": rfiFlag
    };

    if (row.grants) {
      update["flags.fourththing.grants"] = row.grants;
    }

    updates.push(update);
    const grantNote = row.grants?.resistances?.length ? ` resists=${row.grants.resistances.join(",")}` : "";
    reportRows.push(`✓ ${row.name.padEnd(28)} T${row.tier} ${row.frame.padEnd(10)}${grantNote}`);
  }

  if (missing.length) {
    console.warn("Missing items:", missing);
  }

  if (DRY_RUN) {
    console.group("BBTTCC Gear conversion — DRY RUN");
    reportRows.forEach(r => console.log(r));
    if (missing.length) console.log("MISSING:", missing.join(", "));
    console.groupEnd();
    return ui.notifications?.info(`DRY RUN — would update ${updates.length} item(s); ${missing.length} not found.`);
  }

  if (updates.length) {
    await Item.updateDocuments(updates, { pack: PACK_ID });
  }

  console.group("BBTTCC Gear conversion — applied");
  reportRows.forEach(r => console.log(r));
  if (missing.length) console.log("MISSING:", missing.join(", "));
  console.groupEnd();
  ui.notifications?.info(`BBTTCC Gear converted: ${updates.length}${missing.length ? `; ${missing.length} not found` : ""}.`);
})();

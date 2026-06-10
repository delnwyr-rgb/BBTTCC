// Bad Eden — Convert Bad Eden Weapons to RFI-native weapons (Sprint B)
// ─────────────────────────────────────────────────────────────────────────────
// Rewrites the 5 hand-authored weapons in the Bad Eden Weapons folder of
// `bbttcc-master-content.items` into proper fourththing-shaped weapons:
//
//   • system.damage — RFI 7-damage canon (kinetic, energy, sephirotic,
//     qliphothic, radiation, necrotic, radiant). dnd5e "radiant" maps to
//     "energy" with a "light" flavor for laser tech, or "sephirotic" for
//     sacred/atonement weapons. Each weapon gets a signature damage type
//     that says what kind of harm it actually does.
//   • system.range, system.intent, system.skill, system.category, system.tags
//   • flags.fourththing.rfi.item — tier, frame, origin, bound, signature, lore
//   • flags.fourththing.rfi.item.materialOf — raw materials the weapon was
//     forged from. Crafting hooks for the future gathering/crafting engine.
//   • flags.fourththing.rfi.item.signals — per-weapon special tags
//     (mercy, stun, daily-charges) the GM/engine reads on activation.
//   • Weapons that have daily/per-rest charges store them as flags only;
//     they aren't consumed/deleted (we'll add a "Spend Charge" UI later).
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const DRY_RUN = false;

const WEAPONS = [
  {
    name: "Frikkin' Laser Blade Saber",
    rfi: {
      tier: "II", frame: "weapon", origin: "looted", bound: "free",
      signature: "A saber made of light. No big deal.",
      lore: "<p>One-handed blade of bound photons. Hums a single note when drawn; the colour shifts with the wielder's mood.</p>"
        + "<p>Cuts through metal slow and cuts through doubt fast.</p>",
      materialOf: ["focused-crystal", "rad-iron", "heart-coil"],
      signals: { lightblade: true }
    },
    system: {
      category: "melee",
      intent:   "violence",
      skill:    "melee",
      damage:   { formula: "1d10", attribute: "violence", type: "energy", damageFlavor: "light", track: "integrity" },
      range:    { short: 1, long: 1 },
      tags:     ["saber", "energy-blade", "light"],
      effect:   "On a clean hit, the saber may sever a manifestation's anchor — at GM discretion, suppress one ongoing manifestation effect on the target until end of next turn.",
      flavor:   "What?"
    }
  },
  {
    name: "Gilded Atonement Blade",
    rfi: {
      tier: "III", frame: "weapon", origin: "looted", bound: "attuned",
      signature: "The edge hums when you lie, you know.",
      lore: "<p>Hand-forged longsword sheathed in gilt. The pommel is a sept-mark; the fuller is inscribed with a single word in three languages.</p>"
        + "<p><b>Sanctified.</b> Deals sephirotic damage.</p>"
        + "<p><b>Mercy Finish.</b> If this weapon reduces a creature to 0 Integrity, it falls <i>unconscious and stable</i> instead of dying. A target in a Qliphothic/Corrupted/Darkness-bound state has that state suppressed and may \"come back to themselves\" (GM discretion).</p>",
      materialOf: ["sacred-gold", "scribed-steel", "vow-bound-edge"],
      signals: { mercy: true, sanctified: true }
    },
    system: {
      category: "melee",
      intent:   "violence",
      skill:    "melee",
      damage:   { formula: "1d8", attribute: "violence", type: "sephirotic", damageFlavor: "atonement", track: "integrity" },
      range:    { short: 1, long: 1 },
      tags:     ["longsword", "sept-blessed", "atonement", "mercy"],
      effect:   "Mercy Finish: a kill turns into stable unconsciousness; a Qliphothic/Darkness state is suppressed.",
      flavor:   "Forged in a sept-foundry. Tempered in a confession."
    }
  },
  {
    name: "Laser Pistol, Rad",
    rfi: {
      tier: "I", frame: "weapon", origin: "looted", bound: "free",
      signature: "It shoots lasers. And has a stun mode.",
      lore: "<p>Standard-issue energy sidearm. Compact, focusing-lens nose, two-position selector for kill/stun.</p>"
        + "<p><b>Stun Mode.</b> Switch as a free action. On a hit in stun mode, target makes a Body test (DC 12) or is Staggered until end of next turn. No Integrity damage delivered.</p>",
      materialOf: ["rad-iron", "focusing-lens"],
      signals: { stun: true }
    },
    system: {
      category: "ranged",
      intent:   "violence",
      skill:    "ranged",
      damage:   { formula: "1d10", attribute: "violence", type: "energy", damageFlavor: "laser", track: "integrity" },
      range:    { short: 30, long: 120 },
      tags:     ["pistol", "energy", "stun"],
      effect:   "Stun Mode: free-action toggle; on hit, Body DC 12 or Staggered (no Integrity dealt).",
      flavor:   "RIGHT??"
    }
  },
  {
    name: "Laser Rifle, Rad",
    rfi: {
      tier: "II", frame: "weapon", origin: "looted", bound: "free",
      signature: "Shoots through buildings.",
      lore: "<p>Long-barrel rifle. Heavy focusing array. The kind of weapon the kind of person carries when the kind of person needs to carry that kind of weapon.</p>"
        + "<p><b>Penetrating Beam.</b> On a clean hit, the beam ignores half cover and treats three-quarters cover as half cover.</p>",
      materialOf: ["rad-iron", "focusing-lens", "heart-coil"],
      signals: { penetrating: true }
    },
    system: {
      category: "ranged",
      intent:   "violence",
      skill:    "ranged",
      damage:   { formula: "2d8", attribute: "violence", type: "energy", damageFlavor: "laser", track: "integrity" },
      range:    { short: 60, long: 240 },
      tags:     ["rifle", "energy", "penetrating"],
      effect:   "Penetrating Beam: ignores half cover; three-quarters cover counts as half.",
      flavor:   "Carry-name: Dutch. Sarge. Arnold."
    }
  },
  {
    name: "Mercy Driver",
    rfi: {
      tier: "III", frame: "weapon", origin: "looted", bound: "attuned",
      signature: "Not every monster deserves a grave.",
      lore: "<p>A short, heavy bludgeon. The head is plated in soft alloy that deforms on contact, transferring force without breaking bone. Sept-engraved.</p>"
        + "<p><b>Nonlethal by Design.</b> When this weapon reduces a humanoid to 0 Integrity, the target becomes <i>unconscious and stable</i>.</p>"
        + "<p><b>Stabilize Charges (3/day).</b> Spend 1 charge to stabilize a creature you can see within range (no action, once per turn).</p>",
      materialOf: ["soft-alloy", "sept-stamped-haft"],
      signals: { mercy: true, nonlethal: true },
      // Daily-recharge charges. The engine doesn't auto-refill yet — track
      // here, refill manually after a Soma Break until the engine ships.
      charges: 3,
      rechargesOn: "soma-break"
    },
    system: {
      category: "melee",
      intent:   "violence",
      skill:    "melee",
      damage:   { formula: "1d6", attribute: "violence", type: "sephirotic", damageFlavor: "subdual", track: "integrity" },
      range:    { short: 1, long: 1 },
      tags:     ["bludgeon", "nonlethal", "mercy"],
      effect:   "Nonlethal by Design: kill becomes stable-unconscious. Stabilize 3/Soma Break: stabilize a visible creature, no action.",
      flavor:   "The handle is stained where the wielder grips it. The head is unmarked."
    }
  }
];

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);
  const docs = await pack.getDocuments();

  const RfiItems = game.fourththing?.items;
  if (!RfiItems) return ui.notifications?.error("RFI items API not available.");

  const updates = [];
  const reportRows = [];
  const missing = [];

  for (const row of WEAPONS) {
    const item = docs.find(d => d.name === row.name);
    if (!item) { missing.push(row.name); continue; }

    const legacySystem = foundry.utils.deepClone(item.system ?? {});
    const defaults = RfiItems.defaults({ type: "weapon", system: {}, getFlag: () => null });

    const rfiFlag = {
      ...defaults,
      ...row.rfi,
      legacySystem
    };

    updates.push({
      _id:    item.id,
      type:   "weapon",
      system: row.system,
      "flags.fourththing.rfi.item": rfiFlag
    });

    const dmg = row.system.damage;
    const tagSummary = (row.rfi.signals ? Object.keys(row.rfi.signals).filter(k => row.rfi.signals[k]).join(",") : "");
    reportRows.push(`✓ ${row.name.padEnd(32)} T${row.rfi.tier} ${row.system.category.padEnd(7)} ${dmg.formula.padEnd(5)} ${dmg.type}${dmg.damageFlavor ? `/${dmg.damageFlavor}` : ""}${tagSummary ? ` [${tagSummary}]` : ""}`);
  }

  if (missing.length) console.warn("Missing items:", missing);

  if (DRY_RUN) {
    console.group("Bad Eden Weapons conversion — DRY RUN");
    reportRows.forEach(r => console.log(r));
    if (missing.length) console.log("MISSING:", missing.join(", "));
    console.groupEnd();
    return ui.notifications?.info(`DRY RUN — would update ${updates.length} weapon(s); ${missing.length} not found.`);
  }

  if (updates.length) {
    await Item.updateDocuments(updates, { pack: PACK_ID });
  }

  console.group("Bad Eden Weapons conversion — applied");
  reportRows.forEach(r => console.log(r));
  if (missing.length) console.log("MISSING:", missing.join(", "));
  console.groupEnd();
  ui.notifications?.info(`Bad Eden Weapons converted: ${updates.length}${missing.length ? `; ${missing.length} not found` : ""}.`);
})();

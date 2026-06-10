// Bad Eden — Tier I Baseline Weapons (+ rad/frikkin' tier promotions)
// ─────────────────────────────────────────────────────────────────────────────
// Two passes in one macro:
//
//   PASS A: author 7 Tier-I baseline weapons (4 melee, 3 ranged) so chargen
//           Stewards have something to swing or shoot that isn't a manifestation
//           and doesn't carry a signature ability. Standard issue.
//
//   PASS B: re-tier the existing rad/frikkin' weapons up to where their
//           signature abilities actually sit:
//             • Laser Pistol, Rad           T1 → T2  (stun-mode signature)
//             • Frikkin' Laser Blade Saber  T2 → T3  (anchor-sever signature)
//             • Laser Rifle, Rad            T2 → T3  (penetrating beam signature)
//           Mercy Driver (T3) and Gilded Atonement Blade (T3) already sit right.
//
// Items land in `bbttcc-master-content.items` under a "T1 Baseline Weapons"
// folder (created if absent). Idempotent — items with matching names skip
// PASS A unless FORCE_CREATE = true. PASS B updates by name.
//
// Schema mirrors `convert-bbttcc-weapons.macro.js`:
//   • system: { category, intent, skill, damage{formula,attribute,type,
//     damageFlavor,track}, range{short,long}, tags, effect, flavor }
//   • flags.fourththing.rfi.item: { tier, frame, origin, bound, signature,
//     lore, materialOf, signals }
//
// RFI 7-damage canon for T1: kinetic only (no energy/sephirotic/qliphothic
// at baseline tier — those are aspirational damage types).
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const FOLDER_NAME = "T1 Baseline Weapons";
const DRY_RUN = false;
const FORCE_CREATE = false;     // re-create even if name exists
const RUN_PASS_A   = true;      // author T1 baseline
const RUN_PASS_B   = true;      // re-tier rad/frikkin' weapons

// ── PASS A — T1 baseline weapons ─────────────────────────────────────────
const T1_WEAPONS = [
  // ── Melee ─────────────────────────────────────────────────────────────
  {
    name: "Combat Knife",
    rfi: {
      tier: "I", frame: "weapon", origin: "looted", bound: "free",
      signature: "Sharpened on a thousand other days like this one.",
      lore: "<p>Standard-issue field knife. Single-edge, thumb groove, hard sheath that clips to a belt or boot. The first weapon most Stewards carry and the last one they put down. Honest steel — no signature, no story, just edge.</p>"
        + "<p><b>Standard Issue.</b> Light enough for off-hand work; close enough for the kind of conversation knives are for.</p>",
      materialOf: ["scrap-steel", "leather-grip"]
    },
    system: {
      category: "melee", intent: "violence", skill: "melee",
      damage: { formula: "1d6", attribute: "violence", type: "kinetic", damageFlavor: "blade", track: "integrity" },
      range:  { short: 1, long: 1 },
      tags:   ["t1-baseline", "knife", "light", "finesse"],
      effect: "Light, finesse-friendly. No signature ability.",
      flavor: "Cheap. Honest. Always sharp enough."
    }
  },
  {
    name: "Hand Axe",
    rfi: {
      tier: "I", frame: "weapon", origin: "looted", bound: "free",
      signature: "Splits firewood in the morning, splits opinions in the evening.",
      lore: "<p>Single-bit utility axe with a hickory haft and a leather wrist-thong. Cuts kindling, cuts cord, cuts targets that get within arm's reach. Throws acceptably for short distances.</p>"
        + "<p><b>Standard Issue.</b> Pulls double duty as a tool. No signature, no surprise — just dependable weight.</p>",
      materialOf: ["scrap-steel", "hickory-haft"]
    },
    system: {
      category: "melee", intent: "violence", skill: "melee",
      damage: { formula: "1d8", attribute: "violence", type: "kinetic", damageFlavor: "chop", track: "integrity" },
      range:  { short: 1, long: 1 },
      tags:   ["t1-baseline", "axe", "versatile", "thrown"],
      effect: "Versatile. May be thrown at short range as an improvised ranged attack.",
      flavor: "Equally good at cordwood and conversation."
    }
  },
  {
    name: "Maul",
    rfi: {
      tier: "I", frame: "weapon", origin: "looted", bound: "free",
      signature: "When the door is the problem, the maul is the answer.",
      lore: "<p>Two-handed iron-headed maul on a long ash haft. Heavy, slow, and absolutely uninterested in your finesse. The Bulwark's first real weapon — the one you swing when subtlety has already failed.</p>"
        + "<p><b>Standard Issue.</b> Heavy two-handed kinetic. No signature — Frame Dice and Ruin Charges still do their work; the maul just makes the impact mean it.</p>",
      materialOf: ["pig-iron", "ash-haft"]
    },
    system: {
      category: "melee", intent: "violence", skill: "melee",
      damage: { formula: "1d12", attribute: "violence", type: "kinetic", damageFlavor: "blunt", track: "integrity" },
      range:  { short: 1, long: 1 },
      tags:   ["t1-baseline", "maul", "two-handed", "heavy"],
      effect: "Two-handed, heavy. Pairs well with Bulwark Frame.",
      flavor: "Not subtle. Not trying to be."
    }
  },
  {
    name: "Sap",
    rfi: {
      tier: "I", frame: "weapon", origin: "looted", bound: "free",
      signature: "A short conversation about the back of a head.",
      lore: "<p>Leather-wrapped lead-shot bludgeon, palm-sized. Lives in a pocket or a sleeve. Designed to put someone out without breaking anything that won't heal in a week.</p>"
        + "<p><b>Standard Issue (Subdual).</b> Damage is subdual-flavored — narratively kinetic but easy to declare nonlethal. Useful for Couriers, intriguers, and anyone whose plan ended with \"and then we walk away.\"</p>",
      materialOf: ["lead-shot", "wrapped-leather"]
    },
    system: {
      category: "melee", intent: "violence", skill: "melee",
      damage: { formula: "1d6", attribute: "violence", type: "kinetic", damageFlavor: "subdual", track: "integrity" },
      range:  { short: 1, long: 1 },
      tags:   ["t1-baseline", "sap", "concealable", "subdual"],
      effect: "Concealable. Damage easily declared nonlethal at the wielder's option.",
      flavor: "Compact. Apologetic. Functional."
    }
  },

  // ── Ranged ────────────────────────────────────────────────────────────
  {
    name: "Slug Pistol",
    rfi: {
      tier: "I", frame: "weapon", origin: "looted", bound: "free",
      signature: "Six rounds, one trigger, no opinions.",
      lore: "<p>Standard-pattern slug-throwing sidearm. Iron sights, six-round chamber, kicks like a polite mule. The most common ranged weapon in Bad Eden — the kind of pistol you find in a glove box, a holster, or the bottom of a trade-post crate.</p>"
        + "<p><b>Standard Issue.</b> No signature, no electronics, no hum. It just shoots.</p>",
      materialOf: ["scrap-steel", "casing-brass"]
    },
    system: {
      category: "ranged", intent: "violence", skill: "ranged",
      damage: { formula: "1d8", attribute: "violence", type: "kinetic", damageFlavor: "ballistic", track: "integrity" },
      range:  { short: 20, long: 80 },
      tags:   ["t1-baseline", "pistol", "ballistic", "sidearm"],
      effect: "Standard ballistic sidearm. No signature ability.",
      flavor: "Boring. Reliable. The two best things a pistol can be."
    }
  },
  {
    name: "Hunting Rifle",
    rfi: {
      tier: "I", frame: "weapon", origin: "looted", bound: "free",
      signature: "Patient steel for impatient situations.",
      lore: "<p>Bolt-action long arm, walnut stock, iron sights with an optional clamp-mount for a scope nobody can afford. Slow, accurate, loud. Used for game, for guard duty, and once memorably for an argument over fence lines.</p>"
        + "<p><b>Standard Issue.</b> Long range, no electronics, no magic. The rifle every patrol cabinet has at least one of.</p>",
      materialOf: ["scrap-steel", "walnut-stock"]
    },
    system: {
      category: "ranged", intent: "violence", skill: "ranged",
      damage: { formula: "1d10", attribute: "violence", type: "kinetic", damageFlavor: "ballistic", track: "integrity" },
      range:  { short: 60, long: 200 },
      tags:   ["t1-baseline", "rifle", "ballistic", "two-handed"],
      effect: "Long-arm ballistic. Two-handed.",
      flavor: "Loud where it counts. Quiet otherwise."
    }
  },
  {
    name: "Bolt-Driver",
    rfi: {
      tier: "I", frame: "weapon", origin: "looted", bound: "free",
      signature: "Quiet enough to keep your secrets.",
      lore: "<p>Compact crossbow built around a salvaged spring-tension mechanism. Slow to reload, near-silent on release. The Courier's preferred long-touch tool when noise is a tax you can't afford to pay.</p>"
        + "<p><b>Standard Issue.</b> Silent. Slow to reload (1 action between shots, GM call). No signature.</p>",
      materialOf: ["scrap-steel", "spring-tension-arm"]
    },
    system: {
      category: "ranged", intent: "violence", skill: "ranged",
      damage: { formula: "1d8", attribute: "violence", type: "kinetic", damageFlavor: "bolt", track: "integrity" },
      range:  { short: 30, long: 120 },
      tags:   ["t1-baseline", "crossbow", "silent", "slow-reload"],
      effect: "Silent on discharge. GM may call for a 1-action reload between shots.",
      flavor: "The kind of weapon that knows how to shut up."
    }
  }
];

// ── PASS B — rad/frikkin' tier promotions ────────────────────────────────
// Update the `flags.fourththing.rfi.item.tier` for the listed weapons.
// Leaves all other fields intact.
const RETIER = [
  { name: "Laser Pistol, Rad",          newTier: "II",  reason: "Stun-mode signature ability — too cool for chargen." },
  { name: "Frikkin' Laser Blade Saber", newTier: "III", reason: "Photon saber, severs manifestation anchors — clearly aspirational." },
  { name: "Laser Rifle, Rad",           newTier: "III", reason: "Cover-piercing energy beam — high-end military." }
];

// ── Driver ────────────────────────────────────────────────────────────────
(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);
  if (pack.locked) {
    try { await pack.configure({ locked: false }); }
    catch (e) { return ui.notifications?.error(`Cannot unlock ${PACK_ID}: ${e.message}`); }
  }

  const RfiItems = game.fourththing?.items;
  if (!RfiItems) return ui.notifications?.error("RFI items API not available — is the fourththing system active?");

  await pack.getIndex();
  const docs = await pack.getDocuments();

  // ── PASS A ─────────────────────────────────────────────────────────────
  const created = [];
  const skipped = [];
  if (RUN_PASS_A) {
    const Folder = foundry.documents?.Folder ?? globalThis.Folder;
    let folder = pack.folders?.find(f => f.name === FOLDER_NAME);
    if (!folder && !DRY_RUN) {
      folder = await Folder.create(
        { name: FOLDER_NAME, type: "Item", color: "#8c5a5a" },
        { pack: PACK_ID }
      );
    }

    for (const row of T1_WEAPONS) {
      const exists = docs.find(d => d.name === row.name);
      if (exists && !FORCE_CREATE) { skipped.push(row.name); continue; }

      const defaults = RfiItems.defaults({ type: "weapon", system: {}, getFlag: () => null });
      const rfiFlag = { ...defaults, ...row.rfi };

      const itemData = {
        name:   row.name,
        type:   "weapon",
        img:    row.img ?? "icons/svg/sword.svg",
        system: row.system ?? {},
        flags:  { fourththing: { rfi: { item: rfiFlag } } }
      };
      if (folder?.id) itemData.folder = folder.id;

      if (!DRY_RUN) await Item.create(itemData, { pack: PACK_ID });
      created.push(row.name);
    }
  }

  // ── PASS B ─────────────────────────────────────────────────────────────
  const retiered = [];
  const missing  = [];
  if (RUN_PASS_B) {
    const updates = [];
    for (const row of RETIER) {
      const item = docs.find(d => d.name === row.name);
      if (!item) { missing.push(row.name); continue; }
      const oldTier = item.flags?.fourththing?.rfi?.item?.tier ?? "?";
      updates.push({
        _id: item.id,
        "flags.fourththing.rfi.item.tier": row.newTier
      });
      retiered.push(`${row.name}: T${oldTier} → T${row.newTier} (${row.reason})`);
    }
    if (updates.length && !DRY_RUN) {
      await Item.updateDocuments(updates, { pack: PACK_ID });
    }
  }

  ui.notifications.info(
    `T1 Baseline Weapons: created ${created.length}, skipped ${skipped.length}; retiered ${retiered.length}` +
    (missing.length ? `, missing ${missing.length}` : "") +
    (DRY_RUN ? " (DRY RUN)" : "")
  );
  console.group("[t1-baseline-weapons]");
  console.log("created:", created);
  if (skipped.length)  console.log("skipped (existing):", skipped);
  if (retiered.length) { console.log("retiered:"); retiered.forEach(r => console.log("  •", r)); }
  if (missing.length)  console.warn("missing (Pass B):", missing);
  console.groupEnd();
})();

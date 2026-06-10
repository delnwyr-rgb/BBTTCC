// Bad Eden — Stamp RFI Item Flags On Existing Gear (and coerce dnd5e types)
// ─────────────────────────────────────────────────────────────────────────────
// Walks `bbttcc-master-content.items` and converts Bad Eden Armor, Bad Eden
// Weapons, and Wondrous Items into RFI-usable gear:
//   1) Coerces dnd5e types (equipment, consumable, tool, loot) into
//      fourththing's valid types (armor or gear). The constructor rejects
//      unknown types with a hard error, so this MUST happen at the source.
//   2) Stashes the original dnd5e system block under
//      flags.fourththing.rfi.item.legacySystem so descriptions/attunement
//      data are recoverable later (description.value lives there).
//   3) Stamps flags.fourththing.rfi.item with tier/frame/origin defaults.
//
// After running, dragging any of these onto a character produces a clean
// fourththing item that lands in the Inventory tab.
//
// Run as a GM script macro. Idempotent — re-running won't re-coerce items
// that already have RFI flags unless FORCE = true.
//
// Set DRY_RUN = true to preview without writing.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const DRY_RUN = false;
const FORCE   = false;

// Folder ids in the items pack (verified against pack folder listing).
const TARGET_FOLDERS = {
  "VnpeyGKHKdBSbxb1": { name: "Bad Eden Armor",   defaultTier: "II", forceType: "armor" },
  "H6eMhWQrjwcwZcBi": { name: "Bad Eden Weapons", defaultTier: "II", forceType: null    }, // weapons stay weapons
  "TNrB6kEiHS0KwwJT": { name: "Wondrous Items", defaultTier: "II", forceType: "gear"  }
};

// dnd5e → fourththing type coercion. fourththing accepts:
// power, weapon, armor, gear, feature, feat, class, subclass, race, species.
const TYPE_COERCE = {
  equipment: "gear", consumable: "gear", tool: "gear", loot: "gear", backpack: "gear",
  spell: "power", feat: "feature"
};

// Tier inference from dnd5e rarity (when set on the source item).
const RARITY_TO_TIER = {
  "common":     "I",
  "uncommon":   "II",
  "rare":       "III",
  "very rare":  "IV",
  "veryRare":   "IV",
  "very_rare":  "IV",
  "legendary":  "IV",
  "artifact":   "IV"
};

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);

  const docs = await pack.getDocuments();

  const RfiItems = game.fourththing?.items;
  if (!RfiItems) return ui.notifications?.error("RFI items API not available — load the fourththing system.");

  let stamped = 0, skipped = 0, missed = 0;
  const updates = [];
  const reportRows = [];

  for (const item of docs) {
    const targetFolder = TARGET_FOLDERS[item.folder?.id];
    if (!targetFolder) { missed++; continue; }

    const existing = item.flags?.fourththing?.rfi?.item;
    if (existing && !FORCE) { skipped++; continue; }

    // Decide the final fourththing type. forceType wins for armor/wondrous;
    // weapons keep their type if already valid, else coerce.
    const validFtTypes = new Set(["weapon","armor","gear","power","feature","feat","class","subclass","race","species"]);
    let finalType = item.type;
    if (targetFolder.forceType) {
      finalType = targetFolder.forceType;
    } else if (!validFtTypes.has(item.type)) {
      finalType = TYPE_COERCE[item.type] || "gear";
    }

    const rarity = String(
      foundry.utils.getProperty(item, "system.rarity") ??
      foundry.utils.getProperty(item, "system.traits.rarity") ??
      foundry.utils.getProperty(item, "flags.dnd5e.rarity") ?? ""
    ).trim().toLowerCase();
    const inferredTier = RARITY_TO_TIER[rarity] || targetFolder.defaultTier;

    // Build a stub item object the engine can read for frame inference. We
    // pass the FUTURE type because that's what the post-update item will be.
    const defaults = RfiItems.defaults({ type: finalType, system: {}, getFlag: () => null });

    const rfiFlag = {
      ...defaults,
      tier:   inferredTier,
      origin: "looted"
    };

    // Preserve the original system block as legacy data so descriptions etc.
    // aren't lost when we reset to a clean type.
    const legacySystem = foundry.utils.duplicate(item.system ?? {});

    const update = {
      _id: item.id,
      "flags.fourththing.rfi.item":              rfiFlag,
      "flags.fourththing.rfi.item.legacySystem": legacySystem
    };

    if (finalType !== item.type) {
      update.type   = finalType;
      update.system = {};   // ForcedReplacement — empty system for the new type
    }

    updates.push(update);
    reportRows.push(`${targetFolder.name.padEnd(16)} ${String(item.name).padEnd(36)} ${item.type}→${finalType.padEnd(8)} T${inferredTier} ${defaults.frame}`);
    stamped++;
  }

  if (DRY_RUN) {
    console.group("RFI gear stamp — DRY RUN");
    reportRows.forEach(r => console.log(r));
    console.groupEnd();
    return ui.notifications?.info(`DRY RUN — would stamp ${stamped} item(s); skipped ${skipped}; ${missed} not in target folders.`);
  }

  if (updates.length) {
    await Item.updateDocuments(updates, { pack: PACK_ID });
  }

  console.group("RFI gear stamp — applied");
  reportRows.forEach(r => console.log(r));
  console.groupEnd();
  ui.notifications?.info(`RFI flags stamped on ${stamped} item(s); skipped ${skipped}; ${missed} outside target folders.`);
})();

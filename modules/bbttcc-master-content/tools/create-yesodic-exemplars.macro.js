// BBTTCC — Create Yesodic Exemplar Recipes
// ─────────────────────────────────────────────────────────────────────────────
// Adds 6 Tier-III/IV recipe targets that consume Yesodium plus supporting
// materials. Each carries `flags.fourththing.rfi.item.requiresHarmonization:
// true` — the craft engine stamps `harmonized: true` only on a Great Success
// (forge roll margin ≥ 5). Unharmonized exemplars keep their lore + base
// stats but the Memory/Identity bonuses are inert.
//
// Canonical signals (from the Yesodium journal):
//   weapons → memoryEdge, adaptiveWeight, identityCut
//   armor   → memoryOfProtection, flowPlating, gateAttunement
//   sigil/lens/structure → engine signals matching the canonical ability
//
// Run as a GM script macro. Drops items in the appropriate top-level folder.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const DRY_RUN = false;
const FORCE   = false;

const EXEMPLARS = [
  // ── Yesodic Weapon — Edge ───────────────────────────────────────────────
  {
    name: "Yesodic Edge",
    targetType: "weapon",
    folderName: "Weapons",
    rfi: {
      tier: "IV", frame: "weapon", origin: "looted", bound: "attuned",
      requiresHarmonization: true,
      signature: "The blade remembers being ore. The cut remembers being a name.",
      lore: "<p>One-handed blade forged from Yesodium tempered in scribed-steel and bound with marrow tincture. When stabilized to <i>Harmonized</i>, the blade carries Yesod's signature.</p>"
        + "<p><b>Memory Edge.</b> Once per raid, after a roll resolves, add +1 margin retroactively.</p>"
        + "<p><b>Adaptive Weight.</b> Counts as the wielder's optimal metal — no encumbrance penalties.</p>"
        + "<p><b>Identity Cut.</b> +1 effective damageStep against constructs, gates, and dream-entities.</p>"
        + "<p><i>Unharmonized: stats apply, signal abilities dormant.</i></p>",
      materialOf: [
        { key: "yesodium",      qty: 2 },
        { key: "scribed-steel", qty: 1 },
        { key: "marrow-tincture", qty: 1 }
      ],
      signals: { memoryEdge: true, adaptiveWeight: true, identityCut: true }
    },
    system: {
      category: "melee",
      intent:   "violence",
      skill:    "melee",
      damage:   { formula: "1d8+1", attribute: "violence", type: "sephirotic", damageFlavor: "identity", track: "integrity" },
      range:    { short: 1, long: 1 },
      tags:     ["yesodic", "blade", "identity-cut", "attunement"],
      effect:   "Memory Edge (1/raid +1 margin), Adaptive Weight, Identity Cut (+1 damageStep vs constructs/gates/dream-entities). Harmonized only.",
      flavor:   "Hum and edge agree on a single conclusion."
    }
  },

  // ── Yesodic Weapon — Hammer of the First Word ──────────────────────────
  {
    name: "Yesodic Hammer of the First Word",
    targetType: "weapon",
    folderName: "Weapons",
    rfi: {
      tier: "IV", frame: "weapon", origin: "looted", bound: "attuned",
      requiresHarmonization: true,
      signature: "The first hammer to strike. The last to forget.",
      lore: "<p>Two-handed maul cast from Yesodium around a sept-tuning-fork core, hafted on heart-iron and ballasted with anchor quartz.</p>"
        + "<p><b>Memory Edge.</b> Once per raid, after a roll resolves, add +1 margin retroactively.</p>"
        + "<p><b>Identity Cut.</b> +1 effective damageStep against constructs, gates, and dream-entities.</p>"
        + "<p><b>Adaptive Weight.</b> Wields as if balanced for the wielder, regardless of build.</p>"
        + "<p><i>Unharmonized: stats apply, signal abilities dormant.</i></p>",
      materialOf: [
        { key: "yesodium",          qty: 3 },
        { key: "sept-tuning-fork",  qty: 1 },
        { key: "heart-iron",        qty: 2 },
        { key: "anchor-quartz",     qty: 1 }
      ],
      signals: { memoryEdge: true, adaptiveWeight: true, identityCut: true, resonant: true }
    },
    system: {
      category: "melee",
      intent:   "violence",
      skill:    "melee",
      damage:   { formula: "1d12+2", attribute: "violence", type: "sephirotic", damageFlavor: "first-cause", track: "integrity" },
      range:    { short: 1, long: 1 },
      tags:     ["yesodic", "maul", "two-handed", "resonant", "attunement"],
      effect:   "Memory Edge, Adaptive Weight, Identity Cut. Resonant: the first strike of an exchange echoes; targets within 5 ft hear their own name.",
      flavor:   "Held wrong, it sings flat. Held right, the world quiets."
    }
  },

  // ── Yesodic Armor — Plating ────────────────────────────────────────────
  {
    name: "Yesodic Plating",
    targetType: "armor",
    folderName: "Armor",
    rfi: {
      tier: "IV", frame: "armor", origin: "looted", bound: "attuned",
      requiresHarmonization: true,
      signature: "Plate that argues with its own injuries.",
      lore: "<p>Heavy plate forged from Yesodium over hex-glyph plates, ballasted at the joints with anchor quartz.</p>"
        + "<p><b>Memory of Protection.</b> Once per raid, reduce incoming margin by 1.</p>"
        + "<p><b>Flow Plating.</b> May convert one structural damageStep into narrative strain (cosmetic, no track loss).</p>"
        + "<p><b>Gate Attunement.</b> +1 defensive bonus when operating near Ley Gates.</p>"
        + "<p><i>Unharmonized: stats apply, signal abilities dormant.</i></p>",
      materialOf: [
        { key: "yesodium",         qty: 3 },
        { key: "hex-glyph-plate",  qty: 2 },
        { key: "anchor-quartz",    qty: 1 }
      ],
      grants: { resistances: ["kinetic", "sephirotic"] },
      signals: { memoryOfProtection: true, flowPlating: true, gateAttunement: true }
    },
    system: {
      guardBonus:   3,
      evasionBonus: 0,
      resolveBonus: 2,
      armorSkill:   "plating",
      equipped:     false,
      resistances:  ["kinetic", "sephirotic"],
      tags:         ["yesodic", "plate", "ley-gate-aware", "attunement"]
    }
  },

  // ── Yesodic Structure — Gate Frame ─────────────────────────────────────
  {
    name: "Yesodic Gate Frame",
    targetType: "gear",
    folderName: "Gear",
    rfi: {
      tier: "IV", frame: "tool", origin: "looted", bound: "attuned",
      requiresHarmonization: true,
      signature: "A frame around the door between.",
      lore: "<p>Modular Yesodium frame component, hand-fitted at a Ley Gate site. One set of brackets — three are typically needed for a working gate.</p>"
        + "<p><b>Leyline Stable (Harmonized).</b> +1 to stabilization checks involving Leylines within the gate's cell.</p>"
        + "<p><b>Gate Attunement (Harmonized).</b> Reduces Gate-travel instability chance by one tier.</p>"
        + "<p><b>Reversion Note.</b> If Khezek-Tor's main vein destabilizes, every Yesodic structure globally rolls Reversion. Plan accordingly.</p>"
        + "<p><i>Unharmonized: structural value only — signal abilities inert.</i></p>",
      materialOf: [
        { key: "yesodium",           qty: 4 },
        { key: "tree-of-life-shard", qty: 1 },
        { key: "prayer-binding",     qty: 2 }
      ],
      signals: { gateAttunement: true, leylineStable: true, structuralFrame: true }
    },
    system: {
      slot: "structure",
      tags: ["yesodic", "structure", "gate-frame", "leyline", "attunement"]
    }
  },

  // ── Yesodic Sigil — Sigil of the Hearthward (T3) ───────────────────────
  {
    name: "Yesodic Sigil of the Hearthward",
    targetType: "gear",
    folderName: "Gear",
    rfi: {
      tier: "III", frame: "sigil", origin: "looted", bound: "attuned",
      requiresHarmonization: true,
      signature: "Worn against the day the world forgets your name.",
      lore: "<p>Small enameled sigil of Yesodium-bonded sept-cloth and blessed thread, worn at the throat or pinned under the lapel.</p>"
        + "<p><b>Reversion Shield (Harmonized, 1/raid).</b> When the wearer (or one item they're carrying) would suffer a Reversion event, the sigil takes the hit instead — the sigil itself reverts to slag and is destroyed.</p>"
        + "<p><i>Unharmonized: a comforting weight at the throat. Nothing more.</i></p>",
      materialOf: [
        { key: "yesodium",       qty: 1 },
        { key: "sept-cloth",     qty: 2 },
        { key: "blessed-thread", qty: 3 }
      ],
      signals: { reversionShield: true, hearthward: true }
    },
    system: {
      slot: "pin",
      tags: ["yesodic", "sigil", "reversion-shield", "attunement"]
    }
  },

  // ── Yesodic Lens — Memory Lens (T3) ────────────────────────────────────
  {
    name: "Yesodic Memory Lens",
    targetType: "gear",
    folderName: "Gear",
    rfi: {
      tier: "III", frame: "tool", origin: "looted", bound: "attuned",
      requiresHarmonization: true,
      signature: "What the lens once saw, you see again.",
      lore: "<p>Hand-ground lens of Yesodium-clouded glass, set in a Tree-of-Life-shard mount.</p>"
        + "<p><b>Recall Sephirah (Harmonized, 1/scene).</b> Look through the lens at any object, person, or location you have previously perceived under a known sephirotic alignment. Recall that alignment now — the GM names which sefirah dominated the moment.</p>"
        + "<p><b>Memory Edge (Harmonized).</b> Once per raid, after a magic test resolves, add +1 margin retroactively.</p>"
        + "<p><i>Unharmonized: clear glass. Pretty. Inert.</i></p>",
      materialOf: [
        { key: "yesodium",           qty: 1 },
        { key: "tree-of-life-shard", qty: 1 },
        { key: "focused-crystal",    qty: 2 },
        { key: "prayer-binding",     qty: 1 }
      ],
      signals: { memoryEdge: true, sephirotic_aligned: true, recall_sephirah: true }
    },
    system: {
      slot: "lens",
      tags: ["yesodic", "lens", "memory", "sephirotic", "attunement"]
    }
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

  const allFolders = pack.folders ?? new Map();
  const folderByName = new Map();
  for (const f of allFolders) folderByName.set(f.name.toLowerCase(), f);

  const created = [];
  const skipped = [];

  for (const row of EXEMPLARS) {
    const exists = docs.find(d => d.name === row.name);
    if (exists && !FORCE) { skipped.push(row.name); continue; }

    const defaults = RfiItems.defaults({ type: row.targetType, system: {}, getFlag: () => null });
    const rfiFlag = { ...defaults, ...row.rfi };

    const folder = folderByName.get(row.folderName.toLowerCase()) ?? null;

    const itemData = {
      name:   row.name,
      type:   row.targetType,
      img:    DEFAULT_IMG,
      system: row.system,
      flags:  { fourththing: { rfi: { item: rfiFlag } } }
    };
    if (folder) itemData.folder = folder.id;
    if (row.rfi.grants) itemData.flags.fourththing.grants = row.rfi.grants;

    if (!DRY_RUN) await Item.create(itemData, { pack: PACK_ID });

    const matLine = row.rfi.materialOf.map(m => `${m.key}×${m.qty}`).join(",");
    created.push(`+ ${row.name.padEnd(34)} ${row.targetType.padEnd(7)} T${row.rfi.tier}  recipe: ${matLine}`);
  }

  console.group("Yesodic Exemplars — sprint result");
  created.forEach(c => console.log(c));
  if (skipped.length) console.log("skipped (existed):", skipped.join(", "));
  console.groupEnd();

  if (DRY_RUN) ui.notifications?.info(`DRY RUN — would create ${created.length}; ${skipped.length} skipped.`);
  else ui.notifications?.info(`Created ${created.length} Yesodic exemplars; ${skipped.length} skipped.`);
})();

// Bad Eden — Create RFI Gear Sprint C — 12 new standalone pieces
// ─────────────────────────────────────────────────────────────────────────────
// Adds 12 fresh fourththing-shaped items to `bbttcc-master-content.items`.
// Mix: 3 armor (with skill-gated grants), 3 weapons (RFI 7-damage canon),
// 3 tools, 2 sigils/ritual, 1 consumable. Tier ladder I→IV.
//
// Every item carries `flags.fourththing.rfi.item.materialOf` — a list of raw
// materials (themes for the future gathering/crafting sprint). When that
// engine ships, harvesting any tagged material instantly surfaces every item
// that references it. No data migration required.
//
// Items land in their thematically-correct top-level folder (Armor / Weapons
// / Gear / Consumables). Idempotent — items with matching names are skipped
// unless FORCE = true.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const DRY_RUN = false;
const FORCE   = false;

const ITEMS = [
  // ── ARMOR (3) ──────────────────────────────────────────────────────────
  {
    name: "Septhide Vestments",
    targetType: "armor",
    folderName: "Armor",
    rfi: {
      tier: "II", frame: "armor", origin: "looted", bound: "free",
      signature: "Cloth that remembers the prayer it was woven for.",
      lore: "<p>Layered cloth armor stitched in a sept-house. Light, breathable, embroidered with a single prayer running spine to hem.</p>"
        + "<p>Wards the wearer against the static the world drags in — corruption finds the cloth quieter than the body beneath.</p>",
      materialOf: ["sept-cloth", "blessed-thread", "prayer-resin"],
      grants: { resistances: ["qliphothic"] }
    },
    system: {
      guardBonus:   2,
      evasionBonus: 1,
      resolveBonus: 2,
      armorSkill:   "weave",
      equipped:     false,
      resistances:  ["qliphothic"],
      tags:         ["light-cloth", "sept-blessed"]
    }
  },
  {
    name: "Hex-Carved Plate",
    targetType: "armor",
    folderName: "Armor",
    rfi: {
      tier: "III", frame: "armor", origin: "looted", bound: "attuned",
      signature: "The hex remembers what the steel would forget.",
      lore: "<p>Heavy plate hand-engraved with hex-warding glyphs over every joint and seam. Cold-iron core, anchorstone fittings.</p>"
        + "<p>Slows the wearer; unmoves them. The hex grounds blunt force; the carving turns cursed-energy aside.</p>",
      materialOf: ["cold-iron", "hex-glyph-plate", "anchorstone"],
      grants: { resistances: ["kinetic", "qliphothic"] }
    },
    system: {
      guardBonus:   4,
      evasionBonus: -1,
      resolveBonus: 1,
      armorSkill:   "plating",
      equipped:     false,
      resistances:  ["kinetic", "qliphothic"],
      tags:         ["plate", "hex-warded", "attunement"]
    }
  },
  {
    name: "Mantle of Witnessed Silence",
    targetType: "armor",
    folderName: "Armor",
    rfi: {
      tier: "IV", frame: "armor", origin: "looted", bound: "soulbound",
      signature: "What is witnessed cannot be unsaid.",
      lore: "<p>Long ceremonial mantle worn by sept-witnesses at the trials of the lost. Silence-silk weave; vow-bone clasp at the throat.</p>"
        + "<p>The wearer cannot be moved by what is whispered. Charm finds no purchase; compulsion forgets its own intent.</p>"
        + "<p><b>Soulbound.</b> The mantle binds at first attunement. It cannot be re-bonded.</p>",
      materialOf: ["silence-silk", "vow-bone", "witness-resin"],
      grants: {
        resistances: ["necrotic"],
        conditionImmunities: ["charmed", "compelled"]
      }
    },
    system: {
      guardBonus:   1,
      evasionBonus: 1,
      resolveBonus: 5,
      armorSkill:   "warding",
      equipped:     false,
      resistances:  ["necrotic"],
      tags:         ["ceremonial", "soulbound", "sept-witness"]
    }
  },

  // ── WEAPONS (3) ────────────────────────────────────────────────────────
  {
    name: "Brass Knife of the Quiet Word",
    targetType: "weapon",
    folderName: "Weapons",
    rfi: {
      tier: "II", frame: "weapon", origin: "looted", bound: "attuned",
      signature: "A word kept short; an edge kept shorter.",
      lore: "<p>Small parry knife. Brass guard etched with a single word in three languages, all meaning <i>enough</i>.</p>"
        + "<p>Favored by Shadow Couriers. Light enough to draw between sentences.</p>"
        + "<p><b>Quiet Word.</b> While attuned and equipped, you have +1 to Evasion against the first attack each round.</p>",
      materialOf: ["bronze-nail", "hex-script", "finger-bone"],
      signals: { parry: true }
    },
    system: {
      category: "melee",
      intent:   "intrigue",
      skill:    "melee",
      damage:   { formula: "1d6", attribute: "intrigue", type: "kinetic", damageFlavor: "stab", track: "integrity" },
      range:    { short: 1, long: 1 },
      tags:     ["knife", "parry", "courier-favored"],
      effect:   "Quiet Word: +1 Evasion vs the first attack each round while attuned and equipped.",
      flavor:   "Carried in the inside seam, not the belt."
    }
  },
  {
    name: "Singing Hammer",
    targetType: "weapon",
    folderName: "Weapons",
    rfi: {
      tier: "III", frame: "weapon", origin: "looted", bound: "attuned",
      signature: "It hums one note. The note is yours.",
      lore: "<p>Two-handed maul forged around a sept-tuning-fork. The head hums a single note when drawn — the note matches the wielder's name when spoken aloud.</p>"
        + "<p><b>Resonant.</b> On a clean hit, the target's next manifestation has +1 misfire bias.</p>",
      materialOf: ["heart-iron", "sept-tuning-fork", "anchor-quartz"],
      signals: { resonant: true }
    },
    system: {
      category: "melee",
      intent:   "violence",
      skill:    "melee",
      damage:   { formula: "1d12", attribute: "violence", type: "energy", damageFlavor: "resonance", track: "integrity" },
      range:    { short: 1, long: 1 },
      tags:     ["maul", "resonant", "two-handed"],
      effect:   "Resonant: on hit, target's next manifestation rolls misfire with +1 bias.",
      flavor:   "Held wrong, it sings flat."
    }
  },
  {
    name: "Pact-Pen Stylus",
    targetType: "weapon",
    folderName: "Weapons",
    rfi: {
      tier: "II", frame: "weapon", origin: "looted", bound: "attuned",
      signature: "Words that can't be unwritten.",
      lore: "<p>A heavy stylus of vow-shaft and witness-glass. Held by Pactkeepers; favored when an oath needs an enforcement clause.</p>"
        + "<p><b>Binding.</b> On a clean hit, GM may invite the target to honor an oath they have previously sworn — at GM discretion, the target either complies or takes 1 stress.</p>",
      materialOf: ["oath-ink", "vow-shaft", "witness-glass"],
      signals: { binding: true }
    },
    system: {
      category: "melee",
      intent:   "presence",
      skill:    "melee",
      damage:   { formula: "1d4", attribute: "presence", type: "sephirotic", damageFlavor: "binding", track: "integrity" },
      range:    { short: 1, long: 1 },
      tags:     ["stylus", "binding", "pactkeeper-favored"],
      effect:   "Binding: on hit, target either honors a prior oath or takes 1 stress (GM call).",
      flavor:   "Looks like a fountain pen. Reads like a contract."
    }
  },

  // ── TOOLS (3) ──────────────────────────────────────────────────────────
  {
    name: "Sephirotic Lens",
    targetType: "gear",
    folderName: "Gear",
    rfi: {
      tier: "II", frame: "tool", origin: "looted", bound: "attuned",
      signature: "One sephirah at a time, held clean.",
      lore: "<p>Crystal lens carved with a single sefirot glyph at the rim. Hold it up and only that emanation passes through.</p>"
        + "<p><b>Aligned Sight.</b> While attuned, equipped, and tuned to a sephirah you've named, you reroll the lowest die on magic tests aligned to that sephirah.</p>",
      materialOf: ["tree-of-life-shard", "focusing-lens", "prayer-binding"],
      signals: { sephirotic_aligned: true }
    },
    system: {
      slot: "lens",
      tags: ["lens", "sephirotic", "attunement"]
    }
  },
  {
    name: "Hexstrider Cleats",
    targetType: "gear",
    folderName: "Gear",
    rfi: {
      tier: "II", frame: "tool", origin: "looted", bound: "free",
      signature: "The terrain agrees with the wearer's argument.",
      lore: "<p>Lightweight cleats fitted with hex-iron studs in a deliberate pattern. The pattern shifts when no one's watching.</p>"
        + "<p><b>Sure-Footed.</b> While equipped, you reroll the lowest die on Body checks to keep balance on hostile terrain (rubble, ice, slick blood, hex-warped ground).</p>",
      materialOf: ["hex-iron-cleat", "root-leather", "balance-bind"],
      signals: { surefooted: true }
    },
    system: {
      slot: "boots",
      tags: ["boots", "hex-iron", "travel"]
    }
  },
  {
    name: "Confession Crystal",
    targetType: "gear",
    folderName: "Gear",
    rfi: {
      tier: "III", frame: "tool", origin: "looted", bound: "attuned",
      signature: "What was admitted is never lost.",
      lore: "<p>Palm-sized crystal of fogged quartz. Records the most recent admission of guilt or truth spoken within 30 ft.</p>"
        + "<p><b>Replay (1/Scene).</b> As an action, the wearer may play the recording back in the original speaker's voice. Useful for negotiations, blackmail, and very awkward weddings.</p>"
        + "<p><i>Charges refresh on Soma Break.</i></p>",
      materialOf: ["fogged-quartz", "memory-resin", "witness-glass"],
      charges: 1,
      rechargesOn: "soma-break",
      signals: { record: true }
    },
    system: {
      slot: "wondrous",
      tags: ["wondrous", "crystal", "attunement", "record"]
    }
  },

  // ── SIGILS / RITUAL (2) ────────────────────────────────────────────────
  {
    name: "Sigil of Quiet Crossings",
    targetType: "gear",
    folderName: "Gear",
    rfi: {
      tier: "II", frame: "sigil", origin: "looted", bound: "attuned",
      signature: "The threshold knows your name.",
      lore: "<p>A small enameled pin worn at the collar by Shadow Couriers. The sigil shifts depending on the threshold most recently crossed by the wearer.</p>"
        + "<p><b>Recognized in Transit.</b> While attuned and equipped, doors that the wearer has previously passed remain open one beat longer than they should — narratively, the courier slips through where another wouldn't.</p>",
      materialOf: ["enamel-pin", "courier-glass", "threshold-wax"],
      signals: { crossing_aligned: true }
    },
    system: {
      slot: "pin",
      tags: ["sigil", "courier", "attunement"]
    }
  },
  {
    name: "Threshold Bell, Hand-Sized",
    targetType: "gear",
    folderName: "Gear",
    rfi: {
      tier: "I", frame: "sigil", origin: "looted", bound: "free",
      signature: "Ring it once. Mean it.",
      lore: "<p>Brass thumb-bell on a hex-rope cord. Couriers and sept-witnesses ring it once before crossing a threshold that matters; the sound marks the door for return.</p>"
        + "<p>Mundane bell. Ritual matters. Foley for fiction.</p>",
      materialOf: ["brass-thumb-bell", "hex-rope"],
      signals: { ritual: true }
    },
    system: {
      slot: "ritual-tool",
      tags: ["bell", "ritual", "courier"]
    }
  },

  // ── CONSUMABLE (1) ─────────────────────────────────────────────────────
  {
    name: "Marrow Pact Tonic",
    targetType: "gear",
    folderName: "Consumables",
    rfi: {
      tier: "III", frame: "consumable", origin: "looted", bound: "free",
      signature: "Trade owed-in-blood for spent-in-blood.",
      lore: "<p>Black-market potion brewed from heart-iron shavings, vow-resin, and a measure of the drinker's own marrow.</p>"
        + "<p>One ledger entry softens. Two frame dice return to the pool. The drinker pays in nerves; the body pays later.</p>",
      materialOf: ["heart-iron-shaving", "vow-resin", "marrow-tincture"],
      charges: 1,
      upkeep: { mode: "passive", per: "none" },
      consume: {
        effects: [
          { kind: "track", track: "bloodDebt", op: "subtract", delta: 1 },
          { kind: "track", track: "frameDice", op: "add",      delta: 2 },
          { kind: "track", track: "stress",    op: "add",      delta: 2 }
        ],
        decrement: true
      }
    },
    system: {
      slot: "consumable",
      tags: ["potion", "blood-debt", "frame-die", "single-use"]
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

  // Resolve folder by name — case-insensitive, prefers exact match.
  const allFolders = pack.folders ?? new Map();
  const folderByName = new Map();
  for (const f of allFolders) folderByName.set(f.name.toLowerCase(), f);

  const created = [];
  const skipped = [];

  for (const row of ITEMS) {
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

    const tags = (row.rfi.signals ? Object.keys(row.rfi.signals).filter(k => row.rfi.signals[k]).join(",") : "");
    const grantNote = row.rfi.grants?.resistances?.length ? ` resists=${row.rfi.grants.resistances.join(",")}` : "";
    created.push(`+ ${row.name.padEnd(34)} ${row.targetType.padEnd(7)} T${row.rfi.tier} ${row.rfi.frame.padEnd(10)}${grantNote}${tags ? ` [${tags}]` : ""}`);
  }

  console.group("RFI Gear Sprint C — result");
  created.forEach(c => console.log(c));
  if (skipped.length) console.log("skipped (existed):", skipped.join(", "));
  console.groupEnd();

  if (DRY_RUN) ui.notifications?.info(`DRY RUN — would create ${created.length}; ${skipped.length} skipped.`);
  else ui.notifications?.info(`Created ${created.length} new RFI items; ${skipped.length} skipped.`);
})();

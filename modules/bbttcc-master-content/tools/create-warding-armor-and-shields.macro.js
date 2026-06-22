// Bad Eden — Warding Armor & Shields seeder
// ─────────────────────────────────────────────────────────────────────────────
// Purpose: the catalog skewed heavy toward WEAVE (cloth/light) and PLATING
// (plate/heavy). The third wear-class — WARDING (shields + protective vestments,
// keyed off Soul) — was nearly empty: only the Pressed Buckler (T1 shield),
// the Foam Finger (Mal-voiced novelty), and the Mantle of Witnessed Silence
// (T4 warding vestment) existed across the whole pool.
//
// This macro fills the gap with a proper tier-I→IV ladder:
//   • 5 SHIELDS      (frame: "shield",  armorSkill: "warding")
//   • 5 WARD-VESTS   (frame: "armor",   armorSkill: "warding")
// Most carry magical grants (resistances / condition immunities) so warding
// finally has reasons to wear it past tier 1.
//
// Grants follow the DEPLOYED, working Steelweave Hauberk pattern:
//   - top-level `grants` on the row → copied to `flags.fourththing.grants`
//     (the defense engine reads flags.fourththing.grants, NOT rfi.item.grants),
//     using the structured { type, flavor? } shape the Rad Suits use.
//   - `system.resistances` carries the plain string mirror for the sheet.
// Resistance types are the CANONICAL FT.DAMAGE_TYPES set (kinetic / electrical /
// thermal / chemical / poison / psychic / sephirotic / qliphothic / radiation).
// (The old Mantle's "necrotic" is NOT a live type — deliberately avoided here.)
//
// Items land in `bbttcc-master-content.items` under a "Warding & Shields"
// folder (created if absent). Idempotent — names already present are skipped
// unless FORCE = true. Flip DRY_RUN to preview without writing.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID     = "bbttcc-master-content.items";
const FOLDER_NAME = "Warding & Shields";
const DRY_RUN     = false;
const FORCE       = false;

const ITEMS = [
  // ════════════════ SHIELDS (frame: "shield") ════════════════════════════════

  // ── T2 · Wardiron Targe — bread-and-butter magical shield ─────────────────
  {
    name: "Wardiron Targe",
    targetType: "armor",
    rfi: {
      tier: "II", frame: "shield", origin: "looted", bound: "free",
      signature: "Cold-forged to take the hit you didn't see.",
      lore: "<p>A heavy round targe banded in wardiron — anchorstone smelted with the steel so the metal sits a half-beat ahead of the blow. Favored by faction line-holders who'd rather lose the shield than the arm behind it.</p>"
        + "<p><b>Wardiron.</b> The banding grounds raw force. Resists kinetic. No attunement — the iron does the remembering.</p>",
      materialOf: ["wardiron", "anchorstone", "oak-core"]
    },
    grants: { resistances: [{ type: "kinetic" }] },
    system: {
      guardBonus: 2, evasionBonus: 0, resolveBonus: 1,
      armorSkill: "warding", equipped: false,
      resistances: ["kinetic"],
      tags: ["shield", "warding", "wardiron"]
    }
  },

  // ── T2 · Sept-Blessed Aegis — ward against corruption ─────────────────────
  {
    name: "Sept-Blessed Aegis",
    targetType: "armor",
    rfi: {
      tier: "II", frame: "shield", origin: "given", bound: "free",
      signature: "Blessed once, and it took.",
      lore: "<p>A kite shield consecrated in a sept-house, its face inlaid with a prayer-resin sigil that warms faintly when the world's static draws near. Issued to chapter-wardens who walk into qliphothic ground on purpose.</p>"
        + "<p><b>Consecrated.</b> Corruption finds the shield quieter than the body behind it. Resists qliphothic.</p>",
      materialOf: ["blessed-steel", "prayer-resin", "sept-leather"]
    },
    grants: { resistances: [{ type: "qliphothic" }] },
    system: {
      guardBonus: 2, evasionBonus: 0, resolveBonus: 2,
      armorSkill: "warding", equipped: false,
      resistances: ["qliphothic"],
      tags: ["shield", "warding", "sept-blessed"]
    }
  },

  // ── T3 · Mirrorface Pavise — heavy tower shield, energy ward ───────────────
  {
    name: "Mirrorface Pavise",
    targetType: "armor",
    rfi: {
      tier: "III", frame: "shield", origin: "looted", bound: "attuned",
      signature: "Stand behind it. Let the world spend itself.",
      lore: "<p>A full-height pavise faced in polished mirror-alloy over a hex-lattice core. Heavy enough to plant; broad enough to hide a second Steward. The mirror face scatters arc and flame back the way they came.</p>"
        + "<p><b>Mirror Face.</b> Resists electrical and thermal. Slow to carry, slower to move — but nothing gets past it cheaply.</p>",
      materialOf: ["mirror-alloy", "hex-lattice", "brace-iron"]
    },
    grants: { resistances: [{ type: "electrical" }, { type: "thermal" }] },
    system: {
      guardBonus: 4, evasionBonus: -1, resolveBonus: 1,
      armorSkill: "warding", equipped: false,
      resistances: ["electrical", "thermal"],
      tags: ["shield", "warding", "tower", "attunement"]
    }
  },

  // ── T3 · Oathkeeper's Bulwark — reactive, eat-the-blow ─────────────────────
  {
    name: "Oathkeeper's Bulwark",
    targetType: "armor",
    rfi: {
      tier: "III", frame: "shield", origin: "given", bound: "attuned",
      signature: "It keeps the promise so your ribs don't have to.",
      lore: "<p>A reinforced heater shield carried by Pactkeeper enforcers, its rim engraved with a standing oath the bearer renews each dawn. When the oath holds, so does the shield — vow-resin lacing snags incoming force and feeds it into the bearer's stance.</p>"
        + "<p><b>Eat the Blow (1/Soma Break).</b> While attuned and equipped, the bearer may shift one die of incoming kinetic damage into Stress instead of Integrity. GM-adjudicated; tap the use tracker when spent. Resists kinetic passively.</p>",
      materialOf: ["heart-iron", "vow-resin", "oath-leather"]
    },
    grants: { resistances: [{ type: "kinetic" }] },
    system: {
      guardBonus: 3, evasionBonus: 0, resolveBonus: 2,
      armorSkill: "warding", equipped: false,
      resistances: ["kinetic"],
      uses: { max: 1, spent: 0 },
      tags: ["shield", "warding", "reactive", "pactkeeper-favored", "attunement"]
    }
  },

  // ── T4 · Aegis of the Final Door — soulbound capstone shield ──────────────
  {
    name: "Aegis of the Final Door",
    targetType: "armor",
    rfi: {
      tier: "IV", frame: "shield", origin: "found", bound: "soulbound",
      signature: "Some doors you hold shut from this side.",
      lore: "<p>A great round shield said to have been the last thing standing at a threshold no one names. Its face is featureless save for a single closed ring; the metal does not reflect, only quiets. Those who carry it report the world's whispering simply… stops at the rim.</p>"
        + "<p><b>The Closed Ring.</b> Resists qliphothic and psychic. The bearer cannot be charmed or compelled while it is raised.</p>"
        + "<p><b>Soulbound.</b> Binds at first attunement and cannot be re-bonded.</p>",
      materialOf: ["threshold-iron", "silence-alloy", "vow-bone"]
    },
    grants: {
      resistances: [{ type: "qliphothic" }, { type: "psychic" }],
      conditionImmunities: ["charmed", "compelled"]
    },
    system: {
      guardBonus: 3, evasionBonus: 0, resolveBonus: 4,
      armorSkill: "warding", equipped: false,
      resistances: ["qliphothic", "psychic"],
      tags: ["shield", "warding", "soulbound", "capstone"]
    }
  },

  // ════════════════ WARDING VESTMENTS (frame: "armor") ═══════════════════════

  // ── T1 · Warded Wayfarer's Shroud — low-end warding option ────────────────
  {
    name: "Warded Wayfarer's Shroud",
    targetType: "armor",
    rfi: {
      tier: "I", frame: "armor", origin: "looted", bound: "free",
      signature: "A travel cloak that someone bothered to bless.",
      lore: "<p>A hooded shroud of road-canvas with a thumb-width of prayer-thread run through the hem. Sold at sept-adjacent waystations to pilgrims who can't afford real warding but won't walk corrupted ground bare.</p>"
        + "<p><b>Standard Issue.</b> The thread takes the worst of the static off. Resists qliphothic. The first warding piece most Stewards ever own.</p>",
      materialOf: ["road-canvas", "prayer-thread"]
    },
    grants: { resistances: [{ type: "qliphothic" }] },
    system: {
      guardBonus: 1, evasionBonus: 1, resolveBonus: 1,
      armorSkill: "warding", equipped: false,
      resistances: ["qliphothic"],
      tags: ["t1-baseline", "warding", "cloth", "light"]
    }
  },

  // ── T2 · Cassock of Quiet Hours — anti-psychic vestment ───────────────────
  {
    name: "Cassock of Quiet Hours",
    targetType: "armor",
    rfi: {
      tier: "II", frame: "armor", origin: "given", bound: "free",
      signature: "Worn by those who keep the late watch.",
      lore: "<p>A heavy sept-cassock cut for the ones who sit the night vigils — quilted, hooded, stitched with a calming refrain in a thread you can only read by touch. The mind stays the bearer's own through the long dark.</p>"
        + "<p><b>Quiet Hours.</b> Resists psychic. The refrain holds the bearer's thoughts to their own shape.</p>",
      materialOf: ["sept-cloth", "calming-thread", "vigil-resin"]
    },
    grants: { resistances: [{ type: "psychic" }] },
    system: {
      guardBonus: 1, evasionBonus: 1, resolveBonus: 3,
      armorSkill: "warding", equipped: false,
      resistances: ["psychic"],
      tags: ["warding", "vestment", "sept", "vigil"]
    }
  },

  // ── T3 · Vestments of the Standing Vow — anti-compulsion ──────────────────
  {
    name: "Vestments of the Standing Vow",
    targetType: "armor",
    rfi: {
      tier: "III", frame: "armor", origin: "given", bound: "attuned",
      signature: "The vow stands whether you do or not.",
      lore: "<p>Formal warding vestments worn when a Steward swears an oath meant to outlast them. Vow-bone toggles, a hem weighted with witness-glass beads that click once for every promise kept. While the vow stands, no one else's word can move the wearer off it.</p>"
        + "<p><b>Standing Vow.</b> Resists qliphothic. The wearer cannot be compelled while attuned.</p>",
      materialOf: ["witness-glass", "vow-bone", "sept-wool"]
    },
    grants: {
      resistances: [{ type: "qliphothic" }],
      conditionImmunities: ["compelled"]
    },
    system: {
      guardBonus: 2, evasionBonus: 1, resolveBonus: 3,
      armorSkill: "warding", equipped: false,
      resistances: ["qliphothic"],
      tags: ["warding", "vestment", "ceremonial", "attunement"]
    }
  },

  // ── T3 · Hexbane Surplice — dual-resist field vestment ────────────────────
  {
    name: "Hexbane Surplice",
    targetType: "armor",
    rfi: {
      tier: "III", frame: "armor", origin: "looted", bound: "attuned",
      signature: "For the ground where the air itself is wrong.",
      lore: "<p>A field surplice layered over a hex-lattice underlayer, cut for wardens who walk hex-blighted ground where the curse runs hot. Turns aside both the corruption and the scorch that so often comes with it.</p>"
        + "<p><b>Hexbane Weave.</b> Resists qliphothic and thermal. Built to be worn working, not displayed.</p>",
      materialOf: ["hex-lattice", "warded-wool", "ash-thread"]
    },
    grants: { resistances: [{ type: "qliphothic" }, { type: "thermal" }] },
    system: {
      guardBonus: 2, evasionBonus: 0, resolveBonus: 2,
      armorSkill: "warding", equipped: false,
      resistances: ["qliphothic", "thermal"],
      tags: ["warding", "vestment", "hex-warded", "field", "attunement"]
    }
  },

  // ── T4 · Mantle of the Unbroken Circle — soulbound capstone vestment ──────
  {
    name: "Mantle of the Unbroken Circle",
    targetType: "armor",
    rfi: {
      tier: "IV", frame: "armor", origin: "found", bound: "soulbound",
      signature: "What the circle holds, it holds whole.",
      lore: "<p>A ceremonial mantle of the highest warding order, its collar a closed ring of sept-silver with no clasp — once bound, it has no open ends. Worn by those who stand between a congregation and the things that would unmake it. The corruption, the whisper, and the false light all break on the circle alike.</p>"
        + "<p><b>The Unbroken Circle.</b> Resists qliphothic, psychic, and sephirotic.</p>"
        + "<p><b>Soulbound.</b> Binds at first attunement and cannot be re-bonded.</p>",
      materialOf: ["sept-silver", "circle-silk", "witness-resin"]
    },
    grants: {
      resistances: [{ type: "qliphothic" }, { type: "psychic" }, { type: "sephirotic" }]
    },
    system: {
      guardBonus: 2, evasionBonus: 1, resolveBonus: 5,
      armorSkill: "warding", equipped: false,
      resistances: ["qliphothic", "psychic", "sephirotic"],
      tags: ["warding", "vestment", "soulbound", "capstone", "ceremonial"]
    }
  }
];

// ── Driver (mirrors create-tier1-baseline-armor.macro.js) ────────────────────
(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);
  if (pack.locked) {
    try { await pack.configure({ locked: false }); }
    catch (e) { return ui.notifications?.error(`Cannot unlock ${PACK_ID}: ${e.message}`); }
  }

  const Folder = foundry.documents?.Folder ?? globalThis.Folder;
  let folder = pack.folders?.find(f => f.name === FOLDER_NAME);
  if (!folder && !DRY_RUN) {
    folder = await Folder.create(
      { name: FOLDER_NAME, type: "Item", color: "#4a6f8c" },
      { pack: PACK_ID }
    );
  }

  await pack.getIndex();
  const docs = await pack.getDocuments();
  const RfiItems = game.fourththing?.items;
  if (!RfiItems) return ui.notifications?.error("RFI items API not available — is the fourththing system active?");

  const created = [];
  const skipped = [];

  for (const row of ITEMS) {
    const exists = docs.find(d => d.name === row.name);
    if (exists && !FORCE) { skipped.push(row.name); continue; }

    const defaults = RfiItems.defaults({ type: row.targetType, system: {}, getFlag: () => null });
    const rfiFlag = { ...defaults, ...row.rfi };

    const flags = { fourththing: { rfi: { item: rfiFlag } } };
    if (row.grants) flags.fourththing.grants = row.grants;

    const itemData = {
      name:   row.name,
      type:   row.targetType,
      img:    row.img ?? "icons/svg/mystery-man.svg",
      system: row.system ?? {},
      flags
    };
    if (folder?.id) itemData.folder = folder.id;

    if (!DRY_RUN) await Item.create(itemData, { pack: PACK_ID });

    const frame = row.rfi.frame.padEnd(7);
    const res   = row.system.resistances?.length ? ` resists=${row.system.resistances.join(",")}` : "";
    const ci    = row.grants?.conditionImmunities?.length ? ` immune=${row.grants.conditionImmunities.join(",")}` : "";
    created.push(`+ ${row.name.padEnd(32)} T${row.rfi.tier} ${frame}${res}${ci}`);
  }

  console.group("Warding Armor & Shields — result");
  created.forEach(c => console.log(c));
  if (skipped.length) console.log("skipped (existing):", skipped.join(", "));
  console.groupEnd();

  ui.notifications.info(
    `Warding & Shields seeded: created ${created.length}, skipped ${skipped.length}` +
    (DRY_RUN ? " (DRY RUN)" : "")
  );
})();

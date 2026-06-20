// Bad Eden — Create RFI-native Consumables (Sprint: New Gear)
// ─────────────────────────────────────────────────────────────────────────────
// Adds 17 fourththing-shaped consumables to `bbttcc-master-content.items`.
// Each ships with a `flags.fourththing.rfi.item.consume` block read by the
// runConsumeEffects engine — clicking [Use] on the inventory tab rolls dice,
// adjusts tracks (integrity / stress / clarity / noise / radiation / burn /
// blood debt), removes conditions, decrements a charge, and posts a chat
// receipt.
//
// Items land in the Bad Eden Consumables folder if it exists, else the root
// Consumables folder. Idempotent — items with matching names are skipped
// unless FORCE = true.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const DRY_RUN = false;
const FORCE   = false;

// Consumable catalog. Each row becomes one item document.
//   tier     — RFI tier (rarity)
//   charges  — initial charge count (typically 1; dose-based items can be 3)
//   consume  — engine effects executed on [Use]
//   lore     — flavor text shown on the item sheet strip
const CONSUMABLES = [
  // ── Healing (integrity restore) ─────────────────────────────────────────
  {
    name: "Field Patch",
    tier: "I", charges: 1,
    signature: "A breath returned where one was missing.",
    lore: "Standard battlefield seal. A pulse of restorative gel and a synthetic heartbeat — enough to keep moving, not enough to keep going.",
    consume: { effects: [{ kind: "track", track: "integrity", op: "add", formula: "1d6+1" }], decrement: true }
  },
  {
    name: "Stim Spike",
    tier: "II", charges: 1,
    signature: "The body remembers what it was asked to do.",
    lore: "Combat stim ampoule. Burns clean, knits torn meat, leaves the user steady-handed for the next exchange.",
    consume: { effects: [{ kind: "track", track: "integrity", op: "add", formula: "2d6+2" }], decrement: true }
  },
  {
    name: "Surgeon's Pact",
    tier: "III", charges: 1,
    signature: "A wound traded for a heavier one, owed elsewhere.",
    lore: "Black-market field surgery in a syringe. Unbinds death from the body for a moment; the cost lands in stress, not flesh.",
    consume: {
      effects: [
        { kind: "track", track: "integrity", op: "add",      formula: "4d6+5" },
        { kind: "track", track: "stress",    op: "subtract", delta: 1 }
      ],
      decrement: true
    }
  },

  // ── Stress relief ───────────────────────────────────────────────────────
  {
    name: "Calmpact Vial",
    tier: "I", charges: 1,
    signature: "The hands stop shaking before the mind catches up.",
    lore: "A dose of pacifying compound. Drops the cortisol floor; the world stays loud but stops cutting.",
    consume: { effects: [{ kind: "track", track: "stress", op: "add", delta: 2 }], decrement: true }
  },
  {
    name: "Communion Tea",
    tier: "II", charges: 3,
    signature: "Three sips. Three returns to yourself.",
    lore: "Brewed at sept-houses and shared on the road. Settles the nerves, brightens the inner light. Three doses to a thermos.",
    consume: {
      effects: [
        { kind: "track", track: "stress",  op: "add",      delta: 5 },
        { kind: "track", track: "clarity", op: "add",      delta: 1 }
      ],
      decrement: true
    }
  },

  // ── Magic engine: clarity / noise ───────────────────────────────────────
  {
    name: "Clarity Wafer",
    tier: "I", charges: 1,
    signature: "A clean note in a noisy room.",
    lore: "Dissolves on the tongue. Cuts the static between intention and effect.",
    consume: { effects: [{ kind: "track", track: "clarity", op: "add", delta: 1 }], decrement: true }
  },
  {
    name: "Cathedral Crystal",
    tier: "III", charges: 1,
    signature: "An hour of sanctuary, fitted in the palm.",
    lore: "Resonant lattice grown in a sept-vault. Snaps in the hand, releasing a soft tone that scrubs the inner channel clean.",
    consume: {
      effects: [
        { kind: "track", track: "clarity", op: "setMax" },
        { kind: "track", track: "noise",   op: "subtract", delta: 3 }
      ],
      decrement: true
    }
  },
  {
    name: "Noise Suppressant",
    tier: "II", charges: 1,
    signature: "The Qliphothic echo fades for a breath.",
    lore: "Counter-resonant draught. Eats the static you've been carrying — the kind manifestations leave behind.",
    consume: { effects: [{ kind: "track", track: "noise", op: "subtract", delta: 3 }], decrement: true }
  },

  // ── Radiation ──────────────────────────────────────────────────────────
  {
    name: "Iodine Capsule",
    tier: "I", charges: 1,
    signature: "Bitter on the tongue. Quiet in the marrow.",
    lore: "Standard rad-kit issue. Won't undo what's done; will keep what hasn't from settling in.",
    consume: { effects: [{ kind: "track", track: "radiation", op: "subtract", delta: 25 }], decrement: true }
  },
  {
    name: "Decay Inhibitor",
    tier: "II", charges: 1,
    signature: "Half a wasteland's worth of sin, pulled out clean.",
    lore: "Heavy chelating dose. Burns going in. Binds and excretes everything radioactive in the system.",
    consume: { effects: [{ kind: "track", track: "radiation", op: "subtract", delta: 50 }], decrement: true }
  },

  // ── Mutation cure (gene-cleanse) ─────────────────────────────────────────
  // Radiation MUTATIONS are permanent transformations (they outlast a detox).
  // These are the in-fiction cure: kind "mutation" routes through the consume
  // engine to the radiation mutations API, deleting the mutation + its effect AE.
  {
    name: "Gene-Cleanse Serum",
    tier: "III", charges: 1,
    signature: "The body forgets one thing the radiation taught it.",
    lore: "Retroviral scrub-kit. Targets a single mutation and unwrites it from the marrow — you choose which scar to lose.",
    consume: { effects: [{ kind: "mutation", op: "cleanse", count: 1 }], decrement: true }
  },
  {
    name: "Gene-Purge Infusion",
    tier: "III", charges: 1,
    signature: "Every borrowed shape, returned at once.",
    lore: "Full-spectrum genomic reset, vault-grade and brutal. Strips away every radiation mutation — boon and bane alike — in one searing pass.",
    consume: { effects: [{ kind: "mutation", op: "cleanseAll" }], decrement: true }
  },

  // ── Blood Debt ──────────────────────────────────────────────────────────
  {
    name: "Atonement Lozenge",
    tier: "II", charges: 1,
    signature: "Trade owed to flesh for owed to spirit.",
    lore: "Sept-blessed. Loosens one knot in the Blood Debt ledger; the wearer spends the relief in nerves.",
    consume: {
      effects: [
        { kind: "track", track: "bloodDebt", op: "subtract", delta: 1 },
        { kind: "track", track: "stress",    op: "subtract", delta: 2 }
      ],
      decrement: true
    }
  },

  // ── Burn (Aurablade / channel state) ────────────────────────────────────
  {
    name: "Coolant Glycerol",
    tier: "II", charges: 1,
    signature: "The aura settles back into its case.",
    lore: "Topical channel-coolant. Brings a hot edge back to controlled temper.",
    consume: { effects: [{ kind: "track", track: "burn", op: "subtract", delta: 2 }], decrement: true }
  },

  // ── Conditions ──────────────────────────────────────────────────────────
  {
    name: "Antidote Cartridge",
    tier: "I", charges: 1,
    signature: "The poison releases its grip and is forgotten.",
    lore: "Auto-injector loaded with broad-spectrum counteragent. Clears poisoned in a single press.",
    consume: { effects: [{ kind: "condition", op: "remove", condition: "poisoned" }], decrement: true }
  },
  {
    name: "Memory Restorative",
    tier: "II", charges: 1,
    signature: "You are returned to yourself.",
    lore: "Ritual draught — equal parts pharmacology and naming. Strips charm and compulsion off the will.",
    consume: {
      effects: [
        { kind: "condition", op: "remove", condition: "charmed" },
        { kind: "condition", op: "remove", condition: "compelled" }
      ],
      decrement: true
    }
  },

  // ── Combat / resource boost ────────────────────────────────────────────
  {
    name: "Adrenal Burn",
    tier: "II", charges: 1,
    signature: "One frame, paid in the same coin you'll spend it.",
    lore: "Combat stim that primes the next move. Returns one Frame Die to the pool.",
    consume: { effects: [{ kind: "track", track: "frameDice", op: "add", delta: 1 }], decrement: true }
  }
];

// Image fallback — Foundry's mystery icon. Authors can hand-edit per-item later.
const DEFAULT_IMG = "icons/svg/mystery-man.svg";

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);
  const docs = await pack.getDocuments();

  const RfiItems = game.fourththing?.items;
  if (!RfiItems) return ui.notifications?.error("RFI items API not available.");

  // Resolve a folder for the new items: prefer a subfolder of Consumables
  // named "RFI Consumables" or "Bad Eden Consumables", else fall back to
  // "Consumables" root, else null (uncategorized).
  const allFolders = pack.folders ?? new Map();
  let targetFolder = null;
  for (const f of allFolders) {
    if (/^(rfi|bbttcc) consumables$/i.test(f.name)) { targetFolder = f; break; }
  }
  if (!targetFolder) {
    for (const f of allFolders) if (f.name === "Consumables") { targetFolder = f; break; }
  }

  const created = [];
  const skipped = [];

  for (const row of CONSUMABLES) {
    const exists = docs.find(d => d.name === row.name);
    if (exists && !FORCE) { skipped.push(row.name); continue; }

    const defaults = RfiItems.defaults({ type: "gear", system: {}, getFlag: () => null });

    const rfiFlag = {
      ...defaults,
      tier:      row.tier,
      frame:     "consumable",
      origin:    "looted",
      signature: row.signature,
      lore:      row.lore,
      upkeep:    { mode: "passive", per: "none" },
      charges:   row.charges,
      consume:   row.consume
    };

    const itemData = {
      name:   row.name,
      type:   "gear",
      img:    DEFAULT_IMG,
      system: { slot: "consumable", tags: ["consumable", `tier-${row.tier.toLowerCase()}`] },
      flags:  { fourththing: { rfi: { item: rfiFlag } } }
    };
    if (targetFolder) itemData.folder = targetFolder.id;

    if (exists && FORCE) {
      await exists.update({
        type: "gear",
        system: itemData.system,
        "flags.fourththing.rfi.item": rfiFlag
      });
      created.push(`↻ ${row.name} (force-updated)`);
    } else {
      if (!DRY_RUN) await Item.create(itemData, { pack: PACK_ID });
      created.push(`+ ${row.name} T${row.tier} ×${row.charges}`);
    }
  }

  console.group("RFI Consumables — sprint result");
  created.forEach(c => console.log(c));
  if (skipped.length) console.log("skipped (existed):", skipped.join(", "));
  console.groupEnd();

  if (DRY_RUN) ui.notifications?.info(`DRY RUN — would create ${created.length}; ${skipped.length} skipped.`);
  else ui.notifications?.info(`Created ${created.length} consumables; ${skipped.length} skipped.`);
})();

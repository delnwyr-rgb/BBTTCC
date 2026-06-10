// Bad Eden — Create RFI Path-Themed Consumables (Sprint A2)
// ─────────────────────────────────────────────────────────────────────────────
// Adds 14 path-flavored consumables to `bbttcc-master-content.items`. Each
// resonates with one of the existing path lenses (Aurablade, Bulwark, Shadow
// Courier, Dreamwalker, Soul-Smith) — the lore is path-specific, the consume
// effects mirror the path's resource economy (Aurablade burn/frame dice;
// Bulwark stress/ruin charges; Shadow Courier access dice; Dreamwalker
// clarity/noise; Soul-Smith integrity/blood debt).
//
// Drops alongside the generic 15 from create-rfi-consumables.macro.js — they
// share the same engine (flags.fourththing.rfi.item.consume).
//
// Idempotent — items with matching names are skipped unless FORCE = true.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const DRY_RUN = false;
const FORCE   = false;

const CONSUMABLES = [
  // ── Aurablade — emotion, edge, heat, controlled burn ────────────────────
  {
    name: "Tempering Oil",
    path: "Aurablade",
    tier: "II", charges: 1,
    signature: "The edge cools. The hand remembers.",
    lore: "<p>Slow-flowing oil pressed from heart-iron and prayer ash. Pour it across the blade between exchanges; the burn settles, the frame steadies.</p>",
    consume: {
      effects: [
        { kind: "track", track: "burn",      op: "subtract", delta: 3 },
        { kind: "track", track: "frameDice", op: "add",      delta: 1 }
      ],
      decrement: true
    }
  },
  {
    name: "Wrathblade Tincture",
    path: "Aurablade",
    tier: "II", charges: 1,
    signature: "Hot in. Hotter out.",
    lore: "<p>Distilled focus and bottled fury. Drink before a hard exchange — the next strikes feel like they're already happening. The cost lands in the channel; the burn deepens.</p>",
    consume: {
      effects: [
        { kind: "track", track: "frameDice", op: "add", delta: 2 },
        { kind: "track", track: "burn",      op: "add", delta: 1 }
      ],
      decrement: true
    }
  },
  {
    name: "Hearthsteel Charm",
    path: "Aurablade",
    tier: "I", charges: 1,
    signature: "A small fire, banked.",
    lore: "<p>A coin of stress-tempered alloy. Press it to the breastbone; one degree of channel-heat releases as a quiet hiss.</p>",
    consume: {
      effects: [
        { kind: "track", track: "burn",   op: "subtract", delta: 1 },
        { kind: "track", track: "stress", op: "subtract", delta: 1 }
      ],
      decrement: true
    }
  },
  {
    name: "Edge Memory Vial",
    path: "Aurablade",
    tier: "III", charges: 1,
    signature: "The blade remembers its first cut.",
    lore: "<p>Cloudy resin holding a single sharp moment — the first true strike. Crush the vial and the channel resets to that edge: clean, untired, unfinished.</p>",
    consume: {
      effects: [
        { kind: "track", track: "burn",      op: "subtract", delta: 99 },
        { kind: "track", track: "frameDice", op: "add",      delta: 1 }
      ],
      decrement: true
    }
  },

  // ── Bulwark — mass, anchor, denial, sanctuary ───────────────────────────
  {
    name: "Anchorstone Dust",
    path: "Bulwark",
    tier: "II", charges: 1,
    signature: "Heavy on the tongue. Steady in the stance.",
    lore: "<p>Powdered foundation-stone, sept-blessed. Dissolves slow; while it does, the body remembers it has weight. A held vow refills.</p>",
    consume: {
      effects: [
        { kind: "track", track: "ruin",   op: "add", delta: 1 },
        { kind: "track", track: "stress", op: "add", delta: 2 }
      ],
      decrement: true
    }
  },
  {
    name: "Reinforcement Salve",
    path: "Bulwark",
    tier: "II", charges: 1,
    signature: "Closes the breach.",
    lore: "<p>Mason's-grade healing balm. Doesn't knit flesh so much as <i>refit</i> it — the body acknowledges the repair the way a wall acknowledges a brace.</p>",
    consume: {
      effects: [{ kind: "track", track: "integrity", op: "add", formula: "2d4+2" }],
      decrement: true
    }
  },
  {
    name: "Stancepowder",
    path: "Bulwark",
    tier: "I", charges: 1,
    signature: "The ground answers.",
    lore: "<p>A pinch of salt and ground iron, breathed in once. Pulls the panic down to where it can be put.</p>",
    consume: {
      effects: [{ kind: "track", track: "stress", op: "add", delta: 3 }],
      decrement: true
    }
  },

  // ── Shadow Courier — thresholds, transit, deliveries ────────────────────
  {
    name: "Crossing Pass",
    path: "Shadow Courier",
    tier: "II", charges: 1,
    signature: "The door is already on your side.",
    lore: "<p>A laminated chit signed by no one in particular. While it's on you, the next threshold opens — and the courier's wallet fills back up with a carry's worth of breath.</p>",
    consume: {
      effects: [
        { kind: "track", track: "pace",       op: "add", delta: 1 },
        { kind: "track", track: "stress",     op: "add", delta: 1 }
      ],
      decrement: true
    }
  },
  {
    name: "Falsewall Strip",
    path: "Shadow Courier",
    tier: "I", charges: 1,
    signature: "There was never a wall here.",
    lore: "<p>Adhesive strip patterned to look like brick. Press it where you came in; the way out forgets you used the front.</p>",
    consume: {
      effects: [{ kind: "track", track: "stress", op: "add", delta: 2 }],
      decrement: true
    }
  },
  {
    name: "Threshold Wax",
    path: "Shadow Courier",
    tier: "III", charges: 1,
    signature: "Three thresholds, paid in full.",
    lore: "<p>A black-wax seal warmed in the palm and pressed to the tongue. The route opens — three crossings without trace, the courier's pack heavier with permission.</p>",
    consume: {
      effects: [
        { kind: "track", track: "pace",       op: "add",      delta: 2 },
        { kind: "track", track: "clarity",    op: "setMax" },
        { kind: "track", track: "noise",      op: "subtract", delta: 1 }
      ],
      decrement: true
    }
  },

  // ── Dreamwalker — mirrors, doubles, dream-logic ─────────────────────────
  {
    name: "Lucid Drop",
    path: "Dreamwalker",
    tier: "II", charges: 1,
    signature: "The dream notices itself.",
    lore: "<p>Single sweet drop the color of unshed tears. Drink and the channel separates from the static — the manifestation begins to make sense again.</p>",
    consume: {
      effects: [
        { kind: "track", track: "clarity", op: "add",      delta: 1 },
        { kind: "track", track: "noise",   op: "subtract", delta: 2 }
      ],
      decrement: true
    }
  },
  {
    name: "Mirror Shard",
    path: "Dreamwalker",
    tier: "III", charges: 1,
    signature: "You meet yourself across the surface.",
    lore: "<p>A sliver of dream-glass. Press the shard to the third eye, swallow the answer your double whispers. The channel goes wide and clean; the body pays in nerves.</p>",
    consume: {
      effects: [
        { kind: "track", track: "clarity", op: "setMax" },
        { kind: "track", track: "noise",   op: "subtract", delta: 3 },
        { kind: "track", track: "stress",  op: "add",      delta: 2 }
      ],
      decrement: true
    }
  },

  // ── Soul-Smith — memory, devotion, repair ───────────────────────────────
  {
    name: "Repair Sigil",
    path: "Soul-Smith",
    tier: "II", charges: 1,
    signature: "The body remembers being whole.",
    lore: "<p>Hand-stamped sigil on edible parchment. Eat it; the wounds remember they used to be skin.</p>",
    consume: {
      effects: [{ kind: "track", track: "integrity", op: "add", formula: "2d6" }],
      decrement: true
    }
  },
  {
    name: "Memory Solder",
    path: "Soul-Smith",
    tier: "III", charges: 1,
    signature: "An old debt, named and closed.",
    lore: "<p>A bead of consecrated solder. Held in the mouth until it dissolves. One ledger entry softens; one nervous knot loosens with it.</p>",
    consume: {
      effects: [
        { kind: "track", track: "bloodDebt", op: "subtract", delta: 1 },
        { kind: "track", track: "stress",    op: "add",      delta: 3 }
      ],
      decrement: true
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

  // Re-use the same Consumables folder as the generic batch.
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
      consume:   row.consume,
      // Path tag — usable by future faction/path filters in the market UI.
      path:      row.path
    };

    const itemData = {
      name:   row.name,
      type:   "gear",
      img:    DEFAULT_IMG,
      system: {
        slot: "consumable",
        tags: ["consumable", `tier-${row.tier.toLowerCase()}`, `path-${row.path.toLowerCase().replace(/\s+/g,"-")}`]
      },
      flags:  { fourththing: { rfi: { item: rfiFlag } } }
    };
    if (targetFolder) itemData.folder = targetFolder.id;

    if (!DRY_RUN) await Item.create(itemData, { pack: PACK_ID });
    created.push(`+ [${row.path.padEnd(15)}] ${row.name.padEnd(28)} T${row.tier}`);
  }

  console.group("RFI Path Consumables — sprint result");
  created.forEach(c => console.log(c));
  if (skipped.length) console.log("skipped (existed):", skipped.join(", "));
  console.groupEnd();

  if (DRY_RUN) ui.notifications?.info(`DRY RUN — would create ${created.length}; ${skipped.length} skipped.`);
  else ui.notifications?.info(`Created ${created.length} path-themed consumables; ${skipped.length} skipped.`);
})();

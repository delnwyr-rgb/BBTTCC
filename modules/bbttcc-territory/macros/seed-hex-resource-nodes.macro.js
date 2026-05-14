// BBTTCC — Seed Hex Resource Nodes (live scene)
// ─────────────────────────────────────────────────────────────────────────────
// GM macro. Walks every BBTTCC hex on the active scene and writes a weighted
// random list of resource nodes into `flags.bbttcc-territory.resourceNodes`
// based on the hex's `type` and `terrainKey`. Idempotent: hexes that already
// have non-empty resourceNodes are skipped unless OVERWRITE = true.
//
// Storage model (Choice A):
//   flags.bbttcc-territory.resourceNodes = [
//     { id, materialKey, materialName, tier, dc, skill,
//       yieldFormula, charges, maxCharges, rich, discovered }
//   ]
//
// Discovery model α (v1): nodes are visible whenever the hex itself is
// visible (fog reveal = full discovery). The `discovered` field is reserved
// for a later scout/explore mechanic.
//
// To clear nodes, run the companion `clear-hex-resource-nodes.macro.js`.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  if (!game.user?.isGM) { ui.notifications?.error("GM only."); return; }

  const MOD = "bbttcc-territory";
  const OVERWRITE  = false;     // re-seed hexes that already have nodes
  const DRY_RUN    = false;     // log only, don't write
  const RICH_RATE  = 0.15;      // 15% of nodes get rich treatment
  const RICH_MULT  = 2;         // rich = 2x charges
  const SEED_SALT  = canvas.scene?.id || "default"; // deterministic-ish per scene

  // Node count distribution: 30% → 1, 50% → 2, 20% → 3
  const COUNT_WEIGHTS = [
    { n: 1, w: 30 },
    { n: 2, w: 50 },
    { n: 3, w: 20 }
  ];

  // ── Material tables (all keys must exist in bbttcc-master-content.items) ──
  // Run create-rfi-materials-set-3.macro.js first if you haven't already.
  const TERRAIN_TABLES = {
    plains:    { weights: [["wild-grain",5],["herd-leather",3],["wild-herb",4],["root-leather",1]], skill:"body",      richness:1.0 },
    forest:    { weights: [["ash-wood",5],["wild-herb",3],["vow-resin",2],["memory-resin",1]],      skill:"soul",      richness:1.1 },
    mountains: { weights: [["heart-iron",3],["ore-vein",5],["mountain-stone",4],["crystal-fragment",2],["anchorstone",1]], skill:"body", richness:1.0 },
    canyons:   { weights: [["ore-vein",3],["sun-glass",4],["finger-bone",2],["crystal-fragment",2],["fogged-quartz",1]], skill:"body", richness:0.9 },
    swamp:     { weights: [["mire-resin",4],["bog-iron",4],["reagent-moss",5],["prayer-resin",1],["fogged-quartz",1]], skill:"soul",   richness:0.9 },
    desert:    { weights: [["sun-glass",4],["yesodium",1],["scrap-salvage",2]],                    skill:"body",      richness:0.6 },
    river:     { weights: [["river-clay",4],["salt-block",3],["freshwater-pearl",1],["courier-glass",1]], skill:"body", richness:0.85 },
    ocean:     { weights: [["salt-block",5],["freshwater-pearl",2],["courier-glass",1]],           skill:"body",      richness:0.7 },
    ruins:     { weights: [["scrap-salvage",4],["prefall-component",3],["rad-iron",2],["yesodium",1]], skill:"mind",   richness:1.2 },
    wasteland: { weights: [["yesodium",3],["scrap-salvage",4],["rad-iron",3],["sun-glass",1]],     skill:"mind",      richness:0.7 }
  };

  // Bespoke overrides for non-wilderness hex types. These REPLACE the
  // terrain table when present; richness is a node-count multiplier.
  const TYPE_TABLES = {
    mine: {
      weights: [["heart-iron",4],["ore-vein",6],["mountain-stone",2],["crystal-fragment",2],["anchorstone",1]],
      skill: "body", richness: 1.4, minNodes: 2
    },
    factory: {
      weights: [["scrap-salvage",6],["prefall-component",3],["rad-iron",4],["soft-alloy",2],["focused-crystal",1]],
      skill: "mind", richness: 1.3, minNodes: 2
    },
    farm: {
      weights: [["wild-grain",6],["herd-leather",4],["wild-herb",3],["reagent-moss",1]],
      skill: "body", richness: 1.4, minNodes: 2
    },
    port: {
      weights: [["salt-block",4],["freshwater-pearl",2],["courier-glass",3],["river-clay",2],["enamel-pin",1]],
      skill: "body", richness: 1.1, minNodes: 1
    },
    temple: {
      weights: [["witness-resin",2],["oath-ink",3],["sacred-gold",2],["blessed-thread",4],["prayer-resin",3],["sept-tuning-fork",1]],
      skill: "soul", richness: 1.2, minNodes: 1
    },
    research: {
      weights: [["focused-crystal",4],["fogged-quartz",3],["memory-resin",3],["prefall-component",2],["scrap-salvage",2]],
      skill: "mind", richness: 1.1, minNodes: 1
    },
    fortress: {
      // Defensive structure — sparse, but iron and salvage make sense.
      weights: [["scrap-salvage",3],["bog-iron",2],["heart-iron",1],["soft-alloy",2]],
      skill: "body", richness: 0.5, minNodes: 0
    },
    settlement: {
      // Settlements draw resources from surrounding land — fall through to terrain.
      weights: null
    }
  };

  // DC ladder by tier
  const DC_BY_TIER = { I: 10, II: 13, III: 16, IV: 19 };
  // Yield formula by tier
  const YIELD_BY_TIER = { I: "1d4", II: "1d4+1", III: "1d6+1", IV: "1d6+2" };
  // Default charges floor by tier (will be overridden by material's own charges if richer)
  const CHARGES_BY_TIER = { I: 5, II: 4, III: 3, IV: 2 };

  // ── PRNG: small mulberry32 seeded from scene id + hex id ────────────────
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── Build pack index for materials ──────────────────────────────────────
  const PACK_ID = "bbttcc-master-content.items";
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);
  const idx = await pack.getIndex({ fields: ["name", "flags.fourththing.rfi.item.materialKey", "flags.fourththing.rfi.item.tier", "flags.fourththing.rfi.item.charges"] });
  const byKey = new Map();
  for (const e of idx) {
    const k = foundry.utils.getProperty(e, "flags.fourththing.rfi.item.materialKey");
    if (!k) continue;
    byKey.set(String(k), {
      id: e._id,
      uuid: `Compendium.${PACK_ID}.${e._id}`,
      name: e.name,
      tier: foundry.utils.getProperty(e, "flags.fourththing.rfi.item.tier") || "I",
      charges: Number(foundry.utils.getProperty(e, "flags.fourththing.rfi.item.charges") ?? 0)
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  function pickWeighted(rng, weights) {
    const total = weights.reduce((s, [, w]) => s + w, 0);
    let roll = rng() * total;
    for (const [k, w] of weights) {
      roll -= w;
      if (roll <= 0) return k;
    }
    return weights[weights.length - 1][0];
  }
  function pickCount(rng, richnessMult, minNodes = 0) {
    const total = COUNT_WEIGHTS.reduce((s, e) => s + e.w, 0);
    let roll = rng() * total;
    let n = 1;
    for (const e of COUNT_WEIGHTS) {
      roll -= e.w;
      if (roll <= 0) { n = e.n; break; }
    }
    n = Math.max(minNodes, Math.round(n * richnessMult));
    return Math.max(0, Math.min(5, n));
  }
  function uid(rng) {
    return "rn_" + Math.floor(rng() * 0xFFFFFFFF).toString(16).padStart(8, "0") + Math.floor(rng() * 0xFFFFFFFF).toString(16).padStart(8, "0");
  }

  function buildNode(rng, materialKey, skill) {
    const mat = byKey.get(materialKey);
    if (!mat) {
      console.warn(`[seed-hex-nodes] material missing from pack: ${materialKey}`);
      return null;
    }
    const tier = mat.tier || "I";
    const dc = DC_BY_TIER[tier] ?? 12;
    const yieldFormula = YIELD_BY_TIER[tier] ?? "1d4";
    const baseCharges = mat.charges > 0 ? mat.charges : (CHARGES_BY_TIER[tier] ?? 4);
    const isRich = rng() < RICH_RATE;
    const charges = isRich ? baseCharges * RICH_MULT : baseCharges;
    return {
      id: uid(rng),
      materialKey,
      materialName: mat.name,
      materialUuid: mat.uuid,
      tier,
      dc,
      skill,
      yieldFormula,
      charges,
      maxCharges: charges,
      rich: isRich,
      discovered: false
    };
  }

  // ── Walk the scene's hexes ──────────────────────────────────────────────
  const scene = canvas.scene;
  if (!scene) return ui.notifications?.error("No active scene.");

  const hexDocs = scene.drawings.filter(d => {
    const f = d.flags?.[MOD] ?? {};
    return f.isHex === true || String(f.kind || "").toLowerCase() === "territory-hex";
  });

  if (!hexDocs.length) return ui.notifications?.warn("No BBTTCC hexes on this scene.");

  let seeded = 0, skipped = 0, totalNodes = 0;
  const updates = [];

  for (const dr of hexDocs) {
    const f = dr.flags[MOD] ?? {};
    const existing = Array.isArray(f.resourceNodes) ? f.resourceNodes : [];
    if (existing.length && !OVERWRITE) { skipped++; continue; }

    const type = String(f.type || "wilderness").toLowerCase();
    const terrainKey = String(f.terrainKey || f.terrain?.key || "plains").toLowerCase();

    // Pick the table: type override (if non-null weights) > terrain
    const typeOverride = TYPE_TABLES[type];
    let tbl = TERRAIN_TABLES[terrainKey] || TERRAIN_TABLES.plains;
    let minNodes = 0;
    if (typeOverride && typeOverride.weights) {
      tbl = typeOverride;
      minNodes = typeOverride.minNodes ?? 0;
    }

    const rng = mulberry32(hashStr(`${SEED_SALT}|${dr.id}`));
    const count = pickCount(rng, tbl.richness ?? 1.0, minNodes);
    const nodes = [];
    for (let i = 0; i < count; i++) {
      const key = pickWeighted(rng, tbl.weights);
      const node = buildNode(rng, key, tbl.skill || "body");
      if (node) nodes.push(node);
    }

    updates.push({ _id: dr.id, [`flags.${MOD}.resourceNodes`]: nodes });
    seeded++;
    totalNodes += nodes.length;
  }

  console.group(`[bbttcc-territory] Seed Hex Resource Nodes — DRY=${DRY_RUN}, OVERWRITE=${OVERWRITE}`);
  console.log(`Hexes: ${hexDocs.length}  seeded: ${seeded}  skipped (already had nodes): ${skipped}  total nodes: ${totalNodes}`);
  if (updates.length && updates[0]) {
    const sample = updates[0][`flags.${MOD}.resourceNodes`];
    console.log("sample first hex's nodes:", sample);
  }
  console.groupEnd();

  if (DRY_RUN) {
    ui.notifications?.info(`DRY RUN — would seed ${seeded} hexes with ${totalNodes} nodes (${skipped} skipped).`);
    return;
  }

  if (updates.length) {
    await scene.updateEmbeddedDocuments("Drawing", updates);
  }
  ui.notifications?.info(`Seeded ${seeded} hexes (${totalNodes} nodes total). ${skipped} hexes already had nodes — set OVERWRITE=true to re-seed.`);
})();

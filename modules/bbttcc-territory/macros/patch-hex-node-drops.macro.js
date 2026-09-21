// Bad Eden — Patch Hex Resource Nodes with DROP TABLES (all region scenes)
// ─────────────────────────────────────────────────────────────────────────────
// GM macro. Owner ruling 2026-09-20: nodes regrow every turn and a successful gather may ALSO drop the recipe materials
// (Oath Leather, Soft Alloy, Hex Lattice, the ores the recipes name…). Every hex node on every scene gets a drop table
// by its FAMILY (what it mainly yields). Idempotent: a node whose drops already match is left alone; OVERWRITE=false keeps
// hand-authored drop tables. Dry run first (console table), then a confirm dialog applies.
//
// Drop shape (read by api.territory.harvestHexNode): { key, chance (0..1), qty ("1"|"1d2"), name, tier, uuid? }.
// uuid is stamped when the master-content pack holds the key; otherwise harvest resolves by key at gather time
// (run create-rfi-materials-set-4 to mint the missing ones — a stub item is created if a key still has no item).
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const MOD = "bbttcc-territory", PATH = `flags.${MOD}.resourceNodes`, TAG = "[patch-hex-node-drops]";
  const OVERWRITE = false;   // true = replace hand-authored drop tables too

  // family by the node's MAIN material key
  const FAMILY_OF = {
    "ore-vein":"ORE", "bog-iron":"ORE", "heart-iron":"ORE", "mountain-stone":"ORE", "anchorstone":"ORE",
    "scrap-salvage":"SALVAGE", "prefall-component":"SALVAGE", "rad-iron":"SALVAGE", "soft-alloy":"SALVAGE",
    "herd-leather":"HIDE", "root-leather":"HIDE",
    "ash-wood":"WOOD", "vow-resin":"WOOD", "memory-resin":"WOOD",
    "wild-grain":"FARM",
    "wild-herb":"HERB", "reagent-moss":"HERB", "mire-resin":"HERB",
    "crystal-fragment":"CRYSTAL", "sun-glass":"CRYSTAL", "fogged-quartz":"CRYSTAL", "courier-glass":"CRYSTAL",
    "river-clay":"SHORE", "salt-block":"SHORE", "freshwater-pearl":"SHORE", "finger-bone":"SHORE",
    "prayer-resin":"SACRED", "blessed-thread":"SACRED", "oath-ink":"SACRED", "witness-resin":"SACRED", "sacred-gold":"SACRED",
    "yesodium":"YESOD"
  };
  // [key, chance, qty]
  const DROPS = {
    ORE:     [["pig-iron",.40,"1d2"],["cold-iron",.20,"1"],["rad-iron",.10,"1"],["soft-alloy",.10,"1"],["hex-iron-cleat",.08,"1"],["threshold-iron",.05,"1"]],
    SALVAGE: [["sheet-steel",.35,"1d2"],["spring-tension-arm",.20,"1"],["pre-fall-electronics",.15,"1"],["stubborn-batteries",.15,"1"],["lead-shot",.20,"1d2"],["casing-brass",.20,"1d2"],["brass",.15,"1"],["rivet-plate",.15,"1"],["pre-fall-stainless",.10,"1"]],
    HIDE:    [["work-leather",.40,"1d2"],["road-leather",.25,"1"],["oath-leather",.10,"1"],["leather-strap",.20,"1"],["leather-grip",.20,"1"],["leather-cuff",.15,"1"],["rivet-strap",.10,"1"],["wrapped-leather",.15,"1"],["corded-belt",.15,"1"],["tool-loop",.15,"1"]],
    WOOD:    [["oak-core",.25,"1"],["hickory-haft",.25,"1"],["ash-haft",.30,"1"],["walnut-stock",.15,"1"],["vigil-resin",.10,"1"]],
    FARM:    [["wool",.25,"1d2"],["sept-wool",.15,"1"],["bad-eden-meat",.30,"1d2"],["wax-paper",.10,"1"],["ground-bean",.20,"1d2"]],
    HERB:    [["ground-bean",.30,"1d2"],["calming-thread",.20,"1"],["marrow-tincture",.10,"1"],["low-grade-precognition",.05,"1"],["ash-thread",.10,"1"]],
    CRYSTAL: [["anchor-quartz",.30,"1"],["focused-crystal",.20,"1"],["hex-lattice",.10,"1"],["witness-glass",.15,"1"],["mirror-alloy",.05,"1"]],
    SHORE:   [["sept-silver",.10,"1"],["road-canvas",.20,"1d2"],["pre-fall-paper",.15,"1d2"],["silence-alloy",.05,"1"],["brace-iron",.15,"1"]],
    SACRED:  [["sacred-gold",.15,"1"],["vow-bone",.20,"1"],["sept-silver",.15,"1"],["prayer-thread",.30,"1d2"],["threshold-wax",.30,"1"],["circle-silk",.10,"1"],["warded-wool",.10,"1"]],
    YESOD:   [["rad-iron",.30,"1"],["heart-iron",.15,"1"],["heart-coil",.10,"1"],["yesodium-thread",.15,"1"],["blessed-steel",.10,"1"]]
  };
  const nameOf = k => String(k).split("-").map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(" ").replace(/\bPre Fall\b/, "Pre-Fall").replace(/\bSept\b/, "Sept");

  // pack index → uuid/name/tier per key
  const PACK_ID = "bbttcc-master-content.items"; const pack = game.packs.get(PACK_ID); const byKey = new Map();
  if (pack) { const idx = await pack.getIndex({ fields: ["name", "flags.fourththing.rfi.item.materialKey", "flags.fourththing.rfi.item.tier"] });
    for (const e of idx) { const k = foundry.utils.getProperty(e, "flags.fourththing.rfi.item.materialKey"); if (k) byKey.set(String(k), { uuid: `Compendium.${PACK_ID}.${e._id}`, name: e.name, tier: foundry.utils.getProperty(e, "flags.fourththing.rfi.item.tier") || "I" }); } }
  const mkDrop = ([key, chance, qty]) => { const m = byKey.get(key); return { key, chance, qty, name: m?.name || nameOf(key), tier: m?.tier || "I", ...(m ? { uuid: m.uuid } : {}) }; };
  const sameDrops = (a, b) => JSON.stringify((a || []).map(d => [d.key, d.chance, d.qty])) === JSON.stringify((b || []).map(d => [d.key, d.chance, d.qty]));

  const plan = []; const unknownFamily = new Set(); const unminted = new Set(); let nodes = 0;
  for (const sc of game.scenes.contents) {
    const updates = [];
    for (const d of sc.drawings.contents) {
      const tf = d.flags?.[MOD] || {}; if (!(tf.isHex === true || tf.kind === "territory-hex" || tf.hexId)) continue;
      const arr = Array.isArray(tf.resourceNodes) ? tf.resourceNodes : []; if (!arr.length) continue;
      let changed = false;
      const next = arr.map(n => {
        nodes++; const fam = FAMILY_OF[n.materialKey]; if (!fam) { unknownFamily.add(n.materialKey); return n; }
        const drops = DROPS[fam].map(mkDrop); for (const x of drops) if (!x.uuid) unminted.add(x.key);
        if (Array.isArray(n.drops) && n.drops.length && !OVERWRITE && !sameDrops(n.drops, drops)) return n; // hand-authored — keep
        if (sameDrops(n.drops, drops)) return n;
        changed = true; return { ...n, drops };
      });
      if (changed) { updates.push({ _id: d.id, [PATH]: next }); plan.push({ scene: sc.name, hex: tf.hexName || tf.name || d.id, nodes: next.map(n => `${n.materialKey}→${FAMILY_OF[n.materialKey] || "?"}`).join(", ") }); }
    }
    if (updates.length) plan._updates = [...(plan._updates || []), { scene: sc, updates }];
  }
  console.group(`${TAG} ${plan.length} hex(es) to stamp of ${nodes} node(s) scanned`);
  console.table(plan);
  if (unknownFamily.size) console.warn(TAG, "no family for main keys:", [...unknownFamily].join(", "));
  if (unminted.size) console.warn(TAG, "drop keys with NO pack item yet (stub on harvest until set-4 is minted):", [...unminted].sort().join(", "));
  console.groupEnd();
  if (!plan.length) return ui.notifications?.info("Hex node drops: nothing to change.");
  const yes = await Dialog.confirm({ title: "Stamp hex node drop tables", content: `<p><b>${plan.length}</b> hex(es) get drop tables by family (details in the console).${unminted.size ? `<br><small>${unminted.size} drop key(s) have no pack item yet — harvest stubs them until <code>create-rfi-materials-set-4</code> runs.</small>` : ""}</p><p>Apply?</p>` });
  if (!yes) return;
  let n = 0; for (const { scene, updates } of (plan._updates || [])) { await scene.updateEmbeddedDocuments("Drawing", updates); n += updates.length; }
  ui.notifications?.info(`Hex node drops stamped on ${n} hex(es).`);
})();

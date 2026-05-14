// BBTTCC — Clear Hex Resource Nodes (live scene)
// ─────────────────────────────────────────────────────────────────────────────
// GM macro. Strips `flags.bbttcc-territory.resourceNodes` from every BBTTCC
// hex on the active scene. Companion to seed-hex-resource-nodes.macro.js.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  if (!game.user?.isGM) { ui.notifications?.error("GM only."); return; }

  const MOD = "bbttcc-territory";
  const scene = canvas.scene;
  if (!scene) return ui.notifications?.error("No active scene.");

  const hexDocs = scene.drawings.filter(d => {
    const f = d.flags?.[MOD] ?? {};
    return f.isHex === true || String(f.kind || "").toLowerCase() === "territory-hex";
  });

  let cleared = 0, totalNodesCleared = 0;
  const updates = [];
  for (const dr of hexDocs) {
    const f = dr.flags[MOD] ?? {};
    if (!Array.isArray(f.resourceNodes) || !f.resourceNodes.length) continue;
    totalNodesCleared += f.resourceNodes.length;
    updates.push({ _id: dr.id, [`flags.${MOD}.-=resourceNodes`]: null });
    cleared++;
  }

  if (!updates.length) {
    ui.notifications?.info(`No hexes had resource nodes (${hexDocs.length} hexes scanned).`);
    return;
  }

  await scene.updateEmbeddedDocuments("Drawing", updates);
  console.log(`[bbttcc-territory] Cleared resource nodes from ${cleared} hexes (${totalNodesCleared} nodes total).`);
  ui.notifications?.info(`Cleared ${totalNodesCleared} resource nodes from ${cleared} hexes.`);
})();

// Bad Eden — Scan Hex Resource Nodes (read-only console diagnostic)
// ─────────────────────────────────────────────────────────────────────────────
// Walks the active scene's hexes and tallies resource nodes by material.
// Useful for verifying a seed run and spot-checking distribution.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const MOD = "bbttcc-territory";
  const scene = canvas.scene;
  if (!scene) return ui.notifications?.error("No active scene.");

  const hexDocs = scene.drawings.filter(d => {
    const f = d.flags?.[MOD] ?? {};
    return f.isHex === true || String(f.kind || "").toLowerCase() === "territory-hex";
  });

  const tally = new Map();
  let hexesWithNodes = 0, totalNodes = 0, richNodes = 0, totalCharges = 0;
  const perHex = [];
  for (const dr of hexDocs) {
    const f = dr.flags[MOD] ?? {};
    const nodes = Array.isArray(f.resourceNodes) ? f.resourceNodes : [];
    if (nodes.length) hexesWithNodes++;
    totalNodes += nodes.length;
    for (const n of nodes) {
      tally.set(n.materialKey, (tally.get(n.materialKey) || 0) + 1);
      if (n.rich) richNodes++;
      totalCharges += Number(n.charges || 0);
    }
    if (nodes.length) {
      perHex.push({
        hex: f.name || dr.text || "(unnamed)",
        terrain: f.terrainKey || f.terrain?.key || "?",
        type: f.type || "?",
        nodes: nodes.map(n => `${n.materialName}${n.rich ? "★" : ""} ×${n.charges}`).join(", ")
      });
    }
  }

  console.group("[bbttcc-territory] Hex Resource Node Scan");
  console.log(`hexes: ${hexDocs.length}  with nodes: ${hexesWithNodes}  total nodes: ${totalNodes}  rich: ${richNodes}  total charges: ${totalCharges}`);
  console.log("by material:");
  console.table([...tally.entries()].map(([k, n]) => ({ material: k, n })).sort((a, b) => b.n - a.n));
  console.log("first 10 hexes:");
  console.table(perHex.slice(0, 10));
  console.groupEnd();

  ui.notifications?.info(`Scan: ${hexesWithNodes}/${hexDocs.length} hexes have nodes (${totalNodes} total, ${richNodes} rich). See console.`);
})();

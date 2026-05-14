// ─────────────────────────────────────────────────────────────────────────────
// BBTTCC — Diagnostic: where do RFI subclass/doctrine items actually live?
// ─────────────────────────────────────────────────────────────────────────────
// Paste in F12 console. Lists candidate items from BOTH packs (subclasses +
// classes) and from every actor, matching the names we expected to wire in
// Phase 5. Helps us re-target the dispatcher and the callout snippet.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const TARGETS = [
    "Forge of Bound Light", "Forge of the Spark Reclaimer", "Forge of Victory",
    "Trance of the Quiet Sun", "Trance of the Sapphire Gate", "Trance of the Thousand Faces",
    "Refraction of Foresight", "Refraction of Mercy", "Refraction of Truth",
    "Mandate of Accord", "Mandate of Overwatch", "Mandate of Resolve",
    "Route of the Ashen Run", "Route of the Blackchannel", "Route of the Emerald Relief",
    "Path of the Faultline", "Path of the Gentle Demolition",
  ];

  const inspect = (where, item) => ({
    where,
    name: item.name,
    type: item.type,
    identifier: item.system?.identifier ?? "",
    descLen: (item.system?.description?.value ?? "").length
  });

  const out = [];

  // Scan declared bbttcc-master-content packs
  for (const packId of ["bbttcc-master-content.classes", "bbttcc-master-content.subclasses"]) {
    const pack = game.packs.get(packId);
    if (!pack) { console.warn(`Pack ${packId} not found`); continue; }
    const idx = await pack.getIndex({ fields: ["name", "type"] });
    let hits = 0;
    for (const e of idx) {
      // Match by name fragment OR exact name
      if (TARGETS.some(t => (e.name ?? "").includes(t.split(":")[0]))) {
        const doc = await pack.getDocument(e._id);
        out.push(inspect(packId, doc));
        hits++;
      }
    }
    console.log(`  ${packId}: ${idx.size ?? idx.length} total items, ${hits} matched`);
  }

  // Scan actors
  for (const actor of game.actors) {
    for (const item of actor.items) {
      if (TARGETS.some(t => (item.name ?? "").includes(t.split(":")[0]))) {
        out.push(inspect(`actor:${actor.name}`, item));
      }
    }
  }

  console.log(`\n%c=== Found ${out.length} candidate items ===`, "color:#ffaa00;font-weight:bold");
  console.table(out);
  window.__bbttccSubclassProbe = out;
  console.log("Stashed at window.__bbttccSubclassProbe — copy back to Claude.");
  console.log("DONE");
})();

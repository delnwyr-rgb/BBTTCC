// ─────────────────────────────────────────────────────────────────────────────
// Bad Eden — R4b: live-world BBTTCC → Bad Eden scrub
// ─────────────────────────────────────────────────────────────────────────────
// Paste into F12 console (as GM). Idempotent. DRY-RUN first.
//
// Walks every bbttcc-* compendium pack + every world Actor + every Actor's
// embedded items + every world Item. For each Document: recurses every string
// VALUE and substitutes display BBTTCC → "Bad Eden" using the same identifier-
// aware regex R4a uses on source JSON:
//
//   (?<!/)BBTTCC(?![A-Z_])(?!\.[A-Z])(?!-[A-Z])
//
//   Skip if preceded by /        (asset paths: art/.../BBTTCC%20..., src="...")
//   Skip if followed by [A-Z_]   (identifiers: BBTTCC_FEATS_PACK, BBTTCCFoo)
//   Skip if followed by .[A-Z]   (localize keys: BBTTCC.Dashboard.Title)
//   Skip if followed by -[A-Z]   (asset names: BBTTCC-Display.woff2)
//
// JSON object KEYS are preserved verbatim — only string VALUES transform.
// Document._id, _stats, ownership, sort, folder, etc. are untouched.
//
// USAGE:
//   1. Set DRY_RUN = true and paste. Review the console log of what would change.
//   2. If clean, set DRY_RUN = false and paste again. Real updates fire.
//   3. Re-running is safe (idempotent — second run finds nothing to change).
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const DRY_RUN = true;   // ← set false for real run after reviewing the dry-run output
  const TAG     = "[R4b]";

  const PROSE_RE = /(?<!\/)BBTTCC(?![A-Z_])(?!\.[A-Z])(?!-[A-Z])/g;

  function subString(s) {
    if (typeof s !== "string") return s;
    let out = s.replace(PROSE_RE, "Bad Eden");
    out = out.replace(/Fourth Thing/g, "Roll For Initiation");
    out = out.replace(/Fourththing/g, "RollForInitiation");
    return out;
  }

  // Recurse: transform string VALUES; keys preserved verbatim.
  function transform(node) {
    if (typeof node === "string") return subString(node);
    if (Array.isArray(node))     return node.map(transform);
    if (node && typeof node === "object") {
      const out = {};
      for (const k of Object.keys(node)) out[k] = transform(node[k]);
      return out;
    }
    return node;
  }

  // Compare orig vs updated; return ONLY changed top-level fields (Foundry-friendly update shape).
  function diffFields(orig, updated) {
    const updates = {};
    const SKIP = new Set(["_id", "_stats", "ownership", "sort", "folder"]); // never overwrite system metadata
    for (const k of Object.keys(updated)) {
      if (SKIP.has(k)) continue;
      if (JSON.stringify(orig[k]) !== JSON.stringify(updated[k])) {
        updates[k] = updated[k];
      }
    }
    return updates;
  }

  async function scrubDoc(doc, label) {
    let orig;
    try { orig = doc.toObject(); }
    catch (e) { console.warn(`${TAG} ${label}: toObject failed`, e); return 0; }
    const updated = transform(orig);
    const updates = diffFields(orig, updated);
    if (Object.keys(updates).length === 0) return 0;
    if (DRY_RUN) {
      const sampleField = Object.keys(updates)[0];
      const before = JSON.stringify(orig[sampleField] ?? "").slice(0, 80);
      const after  = JSON.stringify(updates[sampleField] ?? "").slice(0, 80);
      console.log(`${TAG} [dry] ${label}: ${Object.keys(updates).join(",")}\n        - ${before}\n        + ${after}`);
      return 1;
    }
    try {
      await doc.update(updates, { diff: false });
      return 1;
    } catch (e) {
      console.warn(`${TAG} ${label}: update failed`, e);
      return 0;
    }
  }

  const stats = { packs: 0, packDocs: 0, packDocsChanged: 0, actors: 0, actorsChanged: 0, actorItems: 0, worldItems: 0 };
  const t0 = Date.now();

  // ── 1) Compendium packs ───────────────────────────────────────────────────
  const targetPacks = Array.from(game.packs).filter(p => {
    const id = p.collection;
    return id?.startsWith("bbttcc-") || id?.startsWith("fourththing");
  });
  console.log(`${TAG} scanning ${targetPacks.length} packs…`);

  for (const pack of targetPacks) {
    stats.packs++;
    const wasLocked = pack.locked;
    if (wasLocked && !DRY_RUN) {
      try { await pack.configure({ locked: false }); } catch (e) { console.warn(`${TAG} unlock failed: ${pack.collection}`, e); }
    }
    let docs;
    try { docs = await pack.getDocuments(); }
    catch (e) { console.warn(`${TAG} getDocuments failed: ${pack.collection}`, e); continue; }
    let changedInPack = 0;
    for (const doc of docs) {
      stats.packDocs++;
      const c = await scrubDoc(doc, `pack:${pack.collection} > ${doc.name}`);
      if (c) { stats.packDocsChanged++; changedInPack++; }
    }
    if (changedInPack) console.log(`${TAG} pack ${pack.collection}: ${changedInPack}/${docs.length} doc(s) ${DRY_RUN ? "would change" : "changed"}`);
    if (wasLocked && !DRY_RUN) {
      try { await pack.configure({ locked: true }); } catch (_e) {}
    }
  }

  // ── 2) World Actors + their embedded items ────────────────────────────────
  console.log(`${TAG} scanning ${game.actors.size} world actors…`);
  for (const actor of game.actors) {
    let actorChanged = false;
    for (const item of actor.items) {
      const c = await scrubDoc(item, `actor:${actor.name} > ${item.name}`);
      if (c) { stats.actorItems++; actorChanged = true; }
    }
    if (actorChanged) stats.actorsChanged++;
    stats.actors++;
  }

  // ── 3) World Items (top-level Items directory) ────────────────────────────
  console.log(`${TAG} scanning ${game.items.size} world items…`);
  for (const item of game.items) {
    const c = await scrubDoc(item, `world-item > ${item.name}`);
    if (c) stats.worldItems++;
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`${TAG} ${DRY_RUN ? "DRY-RUN" : "LIVE"} sweep complete in ${dt}s`, stats);

  ui.notifications?.info(
    `R4b ${DRY_RUN ? "dry-run" : "live"}: ${stats.packDocsChanged} pack docs · ${stats.actorItems} actor items · ${stats.worldItems} world items ${DRY_RUN ? "would change" : "changed"} (${dt}s)`,
    { permanent: !DRY_RUN }
  );
})();

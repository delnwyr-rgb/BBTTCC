// bbttcc-master-content/tools/refresh-burn-to-surge-text-2026-10-29.macro.js
// Burn folded into Surge (owner ruling "C", defaults blessed 2026-10-29). Refreshes the
// Aurablade / Soul-Smith family + Coolant Glycerol text (Burn → Surge heat, Burn numbers →
// Cool / Stoked / Overheated) in THREE places, because actor copies are frozen snapshots:
//   1. the compendium docs (bbttcc-master-content.classes / .items), by _id
//   2. world Items, by identifier (or old name)
//   3. every actor's embedded copy, by identifier (or old name)
// Two feats are renamed too: "Aurablade: Burn State" → "Aurablade: Surge & Aura",
// "Aurablade: Stabilize Burn" → "Aurablade: Vent Surge" (routing is by identifier).
// Data: burn-to-surge-text-2026-10-29.json (built by build-burn-to-surge-text-2026-10-29.mjs).
// Safe by construction: a doc is written only while its description still equals the
// expected old text — anything edited in-world since is reported, never overwritten.
// Run as GM: DRY_RUN = true first, then false; a rerun reports 0 to update. Packs are
// per instance and actors per world — run once in each world.
const DRY_RUN = true;
const DATA = "modules/bbttcc-master-content/tools/burn-to-surge-text-2026-10-29.json";
(async () => {
  if (!game.user?.isGM) return ui.notifications.warn("GM only.");
  const { rows } = await fetch(DATA, { cache: "no-store" }).then(r => r.json());
  const byIdent = new Map(rows.filter(r => r.identifier).map(r => [r.identifier, r]));
  const byName  = new Map(rows.flatMap(r => [[r.oldName, r], [r.name, r]]));   // old or already-renamed
  const rowFor  = (it) => byIdent.get(String(it.system?.identifier ?? it.flags?.bbttcc?.identifier ?? "")) ?? byName.get(it.name);

  // Decide one doc: "update" (with the update object) | "current" | "conflict".
  const judge = (it, r) => {
    const cur = it.system?.description?.value ?? "";
    const nameOk = it.name === r.name;
    if (cur === r.new && nameOk) return { kind: "current" };
    if (cur !== r.new && cur !== r.old) return { kind: "conflict", why: "description edited in-world" };
    const u = { _id: it.id };
    if (cur !== r.new) u["system.description.value"] = r.new;
    if (!nameOk && it.name === r.oldName) u.name = r.name;
    if (r.activity && it.system?.activities?.primary && it.system.activities.primary.name === r.oldActivity) u["system.activities.primary.name"] = r.activity;
    return { kind: "update", u };
  };

  const report = { packs: {}, worldItems: { update: 0, current: 0, conflicts: [] }, actors: { update: 0, current: 0, actorsTouched: 0, conflicts: [] } };

  // 1 — compendium docs, by _id.
  const byPack = {};
  for (const r of rows) (byPack[r.pack] ??= []).push(r);
  for (const [packId, prow] of Object.entries(byPack)) {
    const pack = game.packs.get(packId);
    if (!pack) { report.packs[packId] = "not available in this world"; continue; }
    const docs = new Map((await pack.getDocuments()).map(d => [d.id, d]));
    const updates = [], conflicts = []; let current = 0;
    for (const r of prow) {
      const d = docs.get(r._id);
      if (!d) { conflicts.push(`${r.oldName}: not in the pack`); continue; }
      const j = judge(d, r);
      if (j.kind === "current") current++;
      else if (j.kind === "conflict") conflicts.push(`${d.name}: ${j.why} — skipped`);
      else updates.push(j.u);
    }
    if (!DRY_RUN && updates.length) {
      const wasLocked = pack.locked;
      if (wasLocked) await pack.configure({ locked: false });
      try { await Item.updateDocuments(updates, { pack: packId }); }
      finally { if (wasLocked) await pack.configure({ locked: true }); }
    }
    report.packs[packId] = { [DRY_RUN ? "wouldUpdate" : "updated"]: updates.length, current, conflicts };
  }

  // 2 — world Items.
  const wItems = [];
  for (const it of game.items) {
    const r = rowFor(it); if (!r) continue;
    const j = judge(it, r);
    if (j.kind === "current") report.worldItems.current++;
    else if (j.kind === "conflict") report.worldItems.conflicts.push(`${it.name}: ${j.why}`);
    else wItems.push(j.u);
  }
  report.worldItems.update = wItems.length;
  if (!DRY_RUN && wItems.length) await Item.updateDocuments(wItems);

  // 3 — embedded copies on every actor.
  for (const a of game.actors) {
    const ups = [];
    for (const it of a.items) {
      const r = rowFor(it); if (!r) continue;
      const j = judge(it, r);
      if (j.kind === "current") report.actors.current++;
      else if (j.kind === "conflict") report.actors.conflicts.push(`${a.name} · ${it.name}: ${j.why}`);
      else ups.push(j.u);
    }
    if (!ups.length) continue;
    report.actors.update += ups.length; report.actors.actorsTouched++;
    if (!DRY_RUN) { try { await a.updateEmbeddedDocuments("Item", ups); } catch (e) { report.actors.conflicts.push(`${a.name}: write failed — ${e.message}`); } }
  }

  console.log("[refresh-burn-to-surge-text]", DRY_RUN ? "DRY RUN" : "APPLIED", report);
  ui.notifications.info(`Burn → Surge text ${DRY_RUN ? "(dry run)" : "applied"} — see console.`);
  return report;
})();

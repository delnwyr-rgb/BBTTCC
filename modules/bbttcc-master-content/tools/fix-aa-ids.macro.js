// fix-aa-ids.macro.js — RUN IN-WORLD (GM). Run in BOTH worlds. F5 not needed (data-only).
//
// REPAIR: Automated Animations 7.x validates `flags.autoanimations.id` as a UUIDv4
// (ObjectEntryStore). Our animate-*.macro.js scaffolds historically minted a SLUG id
// ("ft-hex-script-pistol"), which AA accepts at PLAYBACK but rejects when you OPEN the
// AA config sheet on the item — throwing:
//     'data.id' (ft-hex-script-pistol) is not a valid UUIDv4 string.
// This macro rewrites every invalid `flags.autoanimations.id` to a fresh UUIDv4, in place,
// preserving the entire rest of the AA config (menu/primary/secondary/sound/options).
//
//   • NON-DESTRUCTIVE — only touches the `.id` of AA flags whose id isn't already a valid
//     UUIDv4. Items with no AA, or AA already minted by AA's own UI (valid UUID), are skipped.
//   • Idempotent (safe to re-run — a fixed id passes the validity check next time).
//   • DRY_RUN=true first (reports only). Set DRY_RUN=false to apply.
//   • Scope: ALL Item compendium packs (every module/system) + world Items + items embedded
//     on world Actors (granted abilities). Set the toggles below to narrow scope.
(async () => {
  const DRY_RUN          = true;   // <-- set false to apply
  const INCLUDE_PACKS    = true;   // Item-type compendium packs (where the macro stamps live)
  const INCLUDE_WORLD    = true;   // game.items (unlinked world items)
  const INCLUDE_ACTORS   = true;   // items embedded on world actors (granted abilities)
  if (!game.user.isGM) return ui.notifications.warn("GM only.");

  const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const newId = () => (globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      }));

  // A doc needs fixing iff it has an AA flag whose id is present and NOT a valid UUIDv4.
  const needsFix = (doc) => {
    const aa = doc?.flags?.autoanimations ?? doc?.getFlag?.("autoanimations");
    if (!aa) return false;
    const id = aa.id;
    // Missing id is ALSO invalid for AA (ObjectEntryStore requires one) → mint.
    return !id || !UUID4.test(String(id));
  };

  const report = { packs: [], world: { scanned: 0, fixed: 0 }, actors: { scanned: 0, fixed: 0 }, total: 0, samples: [] };
  const note = (doc, where) => { if (report.samples.length < 12) report.samples.push(`[${where}] ${doc.name}: "${doc.flags?.autoanimations?.id ?? "(none)"}" → uuid`); };

  // ---- compendium packs ----
  if (INCLUDE_PACKS) {
    for (const pack of game.packs) {
      if (pack.metadata?.type !== "Item") continue;
      let docs;
      try { docs = await pack.getDocuments(); } catch (e) { console.warn("fix-aa-ids: cannot read", pack.collection, e); continue; }
      const targets = docs.filter(needsFix);
      if (!targets.length) continue;
      const wasLocked = pack.locked;
      if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
      for (const doc of targets) { note(doc, pack.collection); if (!DRY_RUN) await doc.update({ "flags.autoanimations.id": newId() }); }
      if (!DRY_RUN && wasLocked) await pack.configure({ locked: true });
      report.packs.push({ pack: pack.collection, fixed: targets.length, of: docs.length });
      report.total += targets.length;
    }
  }

  // ---- world items ----
  if (INCLUDE_WORLD) {
    for (const item of game.items) {
      report.world.scanned++;
      if (!needsFix(item)) continue;
      note(item, "world");
      if (!DRY_RUN) await item.update({ "flags.autoanimations.id": newId() });
      report.world.fixed++; report.total++;
    }
  }

  // ---- items embedded on world actors ----
  if (INCLUDE_ACTORS) {
    for (const actor of game.actors) {
      for (const item of actor.items) {
        report.actors.scanned++;
        if (!needsFix(item)) continue;
        note(item, `actor:${actor.name}`);
        if (!DRY_RUN) await item.update({ "flags.autoanimations.id": newId() });
        report.actors.fixed++; report.total++;
      }
    }
  }

  console.log("=== fix-aa-ids " + (DRY_RUN ? "(DRY RUN — no changes written)" : "(APPLIED)") + " ===");
  console.log("Compendium packs with bad AA ids:");
  if (report.packs.length) for (const p of report.packs) console.log(`   ${p.pack}: ${p.fixed} / ${p.of} fixed`);
  else console.log("   (none)");
  console.log(`World items: ${report.world.fixed} / ${report.world.scanned} fixed`);
  console.log(`Actor-embedded items: ${report.actors.fixed} / ${report.actors.scanned} scanned fixed`);
  console.log("Samples:", report.samples);
  console.log(`TOTAL ${DRY_RUN ? "to fix" : "fixed"}: ${report.total}`);
  ui.notifications.info((DRY_RUN ? "[DRY RUN] " : "") + `AA-id repair: ${report.total} item(s) ${DRY_RUN ? "would be" : ""} fixed across ${report.packs.length} pack(s) + world + actors. See console (F12).` + (DRY_RUN ? " Set DRY_RUN=false to apply." : " Open an AA config sheet to confirm — no more UUIDv4 error."));
})();

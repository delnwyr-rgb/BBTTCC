// modules/bbttcc-master-content/tools/rename-snarchy-burger.macro.js
// Bad Eden — 🍔 S'narchy Burger canonical rename (2026-07-18)
//
// Owner declared the franchise canon: "Snarky Burger" → "S'narchy Burger"
// (neon anarchy-A logo; mascot = furious burger flipping the bird).
// Repo code/tools already renamed in-place; THIS macro sweeps the LIVE world
// and the bbttcc compendia (items like "Snarky Burger Mascot's Final Smile",
// "Snarky Burger Special Sauce", journal lore, rig names).
//
// GM-run, per instance (both foundry + ember worlds). Safe to re-run — it
// only touches documents that still contain the old phrase. Set DRY_RUN=true
// to preview without writing.

(async () => {
  const OLD = /Snarky Burger/g;
  const NEW = "S'narchy Burger";
  const DRY_RUN = false;

  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const changes = [];
  const fix = (s) => (typeof s === "string" && OLD.test(s)) ? s.replace(OLD, NEW) : null;

  async function sweepDoc(doc, where) {
    const upd = {};
    const nm = fix(doc.name);
    if (nm) upd.name = nm;

    if (doc.documentName === "Item") {
      const d = fix(doc.system?.description?.value);
      if (d) upd["system.description.value"] = d;
    }
    if (doc.documentName === "Actor") {
      const tn = fix(doc.prototypeToken?.name);
      if (tn) upd["prototypeToken.name"] = tn;
      const bio = fix(doc.system?.details?.biography?.value ?? doc.system?.description?.value);
      if (bio) {
        if (doc.system?.details?.biography !== undefined) upd["system.details.biography.value"] = bio;
        else upd["system.description.value"] = bio;
      }
      for (const it of doc.items ?? []) await sweepDoc(it, `${where} › ${doc.name} (embedded)`);
    }
    if (doc.documentName === "JournalEntry") {
      for (const pg of doc.pages ?? []) {
        const pUpd = {};
        const pn = fix(pg.name);
        if (pn) pUpd.name = pn;
        const pc = fix(pg.text?.content);
        if (pc) pUpd["text.content"] = pc;
        if (Object.keys(pUpd).length) {
          changes.push(`${where} › ${doc.name} › page "${pg.name}"`);
          if (!DRY_RUN) await pg.update(pUpd);
        }
      }
    }

    if (Object.keys(upd).length) {
      changes.push(`${where} › ${doc.documentName} "${doc.name}"`);
      if (!DRY_RUN) await doc.update(upd);
    }
  }

  // ── World documents ──────────────────────────────────────────────────────
  for (const a of game.actors ?? []) await sweepDoc(a, "world");
  for (const i of game.items ?? []) await sweepDoc(i, "world");
  for (const j of game.journal ?? []) await sweepDoc(j, "world");
  for (const s of game.scenes ?? []) {
    const nm = fix(s.name);
    if (nm) { changes.push(`world › Scene "${s.name}"`); if (!DRY_RUN) await s.update({ name: nm, navName: fix(s.navName) ?? s.navName }); }
  }

  // ── bbttcc compendia (unlock → sweep → restore lock) ─────────────────────
  for (const pack of game.packs ?? []) {
    if (!String(pack.metadata?.packageName || "").startsWith("bbttcc")) continue;
    if (!["Actor", "Item", "JournalEntry"].includes(pack.documentName)) continue;
    const wasLocked = pack.locked;
    try {
      if (wasLocked && !DRY_RUN) await pack.configure({ locked: false });
      const docs = await pack.getDocuments();
      for (const d of docs) await sweepDoc(d, `pack ${pack.collection}`);
    } catch (e) {
      console.warn("[snarchy-rename] pack sweep failed:", pack.collection, e);
    } finally {
      if (wasLocked && !DRY_RUN) { try { await pack.configure({ locked: true }); } catch (_e) {} }
    }
  }

  console.log(`[snarchy-rename] ${DRY_RUN ? "DRY RUN — would change" : "changed"} ${changes.length} document(s):`);
  for (const c of changes) console.log("  •", c);
  ui.notifications?.info(`🍔 S'narchy Burger rename: ${changes.length} document(s) ${DRY_RUN ? "would be" : ""} updated — see console.`);
})();

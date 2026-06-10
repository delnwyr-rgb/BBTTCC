// Bad Eden master-content / tools / prune-surge-folded-feats.macro.js
//
// Deletes the vestigial subclass feat items whose mechanics were FOLDED INTO SURGE
// in the Phase-4 redesign (2026-05-28/29). Their handlers (bulwark_frame_pool,
// bulwark_ruin, bulwark_stance, cosmic_linguist_authority) are retired and now only
// nudge "use the ◆ Surge menu" — the real abilities live in the Surge spend table.
// Targets exactly what the Player HUD already hides: matched via the system helper
// game.fourththing._classAutomation.isRetiredFoldedFeature (no hardcoded name list,
// so it can't drift from the hide logic). Covers the 6 Bulwark subclass feats
// (Kinetic Inversion / Inverted Foundation / The Exchange / Stance Dance /
// Shockwave Arrival / Denial) + Editorial Authority.
//
// Removes them from BOTH world actors AND the master-content Item packs (the grant
// source), so new characters built afterward don't pick them up. Idempotent and
// re-runnable — safe to run again after rolling a new affected steward.
//
// USAGE: paste into a Script macro. Leave DRY_RUN=true first → review the console
// table (F12). Set DRY_RUN=false to actually delete. GM only.

const DRY_RUN = true;

// Item packs that may hold the folded feats as standalone documents (the grant
// source). Missing packs / non-Item packs are skipped silently.
const PACK_IDS = [
  "bbttcc-master-content.classes",
  "bbttcc-master-content.subclasses",
  "bbttcc-master-content.items",
  "bbttcc-master-content.ancestry_feats",
  "bbttcc-master-content.doctrines",
];

if (!game.user.isGM) {
  ui.notifications.error("prune-surge-folded-feats: GM only.");
} else {
  const isFolded = game.fourththing?._classAutomation?.isRetiredFoldedFeature;
  if (typeof isFolded !== "function") {
    ui.notifications.error("isRetiredFoldedFeature not found — update + reload the fourththing system, then retry.");
  } else {
    const report = [];

    // 1) World actors — the visible cleanup (removes the rows from Steward sheets/HUD).
    for (const actor of game.actors) {
      const dead = actor.items.filter(it => isFolded(it));
      if (!dead.length) continue;
      for (const it of dead) report.push({ where: `actor:${actor.name}`, name: it.name, type: it.type, id: it.id, status: DRY_RUN ? "would delete" : "deleted" });
      if (!DRY_RUN) await actor.deleteEmbeddedDocuments("Item", dead.map(d => d.id));
    }

    // 2) Compendium Item packs — the grant source, so rebuilds don't re-add them.
    for (const pid of PACK_IDS) {
      const pack = game.packs.get(pid);
      if (!pack || pack.documentName !== "Item") continue;
      let docs;
      try { docs = await pack.getDocuments(); } catch (e) { continue; }
      const dead = docs.filter(d => isFolded(d));
      if (!dead.length) continue;
      const wasLocked = pack.locked;
      if (wasLocked && !DRY_RUN) await pack.configure({ locked: false });
      for (const d of dead) report.push({ where: `pack:${pid}`, name: d.name, type: d.type, id: d.id, status: DRY_RUN ? "would delete" : "deleted" });
      if (!DRY_RUN) await pack.documentClass.deleteDocuments(dead.map(d => d.id), { pack: pid });
      if (wasLocked && !DRY_RUN) await pack.configure({ locked: true });
    }

    console.group("[prune-surge-folded-feats]");
    console.log("DRY_RUN:", DRY_RUN, "— set to false to delete.");
    if (report.length) console.table(report); else console.log("Nothing to prune — already clean.");
    console.groupEnd();
    ui.notifications.info(`Surge-folded feats: ${DRY_RUN ? "would delete" : "deleted"} ${report.length} item(s)${DRY_RUN ? " (DRY RUN — see console F12)" : ""}.`);
  }
}

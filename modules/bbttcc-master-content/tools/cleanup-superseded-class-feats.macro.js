// BBTTCC master-content / tools / cleanup-superseded-class-feats.macro.js
//
// Prunes feature/feat ITEMS off existing characters whose combat role is now fully
// covered by the redesigned Surge-spent class abilities (Soul-Smith / Harmony Marshal
// / Dreamwalker). The redesign added the new powers but left the old per-feature items
// sitting on sheets; this tidies them up.
//
// SAFETY:
//   • DRY_RUN=true by default — it only REPORTS (deletes nothing) until you flip it.
//   • Deletes ONLY items whose name matches PRUNE_NAMES (curated below) — nothing else.
//   • NEVER touches class / subclass docs (the progression + the Mal-voice text).
//   • Only scans actors that actually have one of the redesigned classes.
//   • Prints a REVIEW table of the OTHER feats on those actors so you can add names
//     to PRUNE_NAMES yourself (e.g. leftover subclass feature items) — review first,
//     then re-run. Leave anything you're unsure about OUT of the list.
//
// SCOPE: existing world actors only. (New characters still get these features from the
// class advancement until that's edited separately — that's a different, later job.)
//
// USAGE: paste into a script macro. DRY_RUN=true → read the console (F12) tables.
//        Edit PRUNE_NAMES. DRY_RUN=false → delete.

const DRY_RUN = true;

// Case-insensitive "name contains" match. Seeded with the Dreamwalker 8 soma-break
// feats — now superseded by the 4 Surge tiers (Omen / Dream Ward / Shared Dream /
// Reality Hack). ADD leftover subclass feature names here AFTER reviewing the table.
const PRUNE_NAMES = [
  // ── CONFIRMED 2026-05-27 — The Hammer is Forge of BOUND LIGHT, so these
  //    Forge-of-Victory feats are strays from a previous subclass: safe to remove.
  //    (Only The Hammer carries them in the current roster.)
  //    ⚠ If you later add a REAL Forge of Victory character, drop "Standard of Will"
  //    and "Victory Forge" from this list FIRST — those are that subclass's kept
  //    out-of-combat skin. The DRY-run table always shows exactly what would go.
  "Triumph Weave",
  "Victory Forge",
  "Rally Stitch",
  "Banner of the Final Push",
  "Standard of Will",
  "Marchwork",

  // ── Dreamwalker's 8 soma-break feats — the "sprawl", now covered by the 4 Surge
  //    tiers. No current (low-tier) Dreamwalker has them yet; uncomment when you have
  //    a high-level one. NOTE: "Fractal Self" gave a passive reroll (advantage) — the
  //    Omen Surge spend replaces it on demand. Keep it commented to preserve the passive.
  // "Dream-Thread Tuning", "Dream Rite", "Omen-Thread Weaving", "Mnemonic Spillway",
  // "Waking Dreamfield", "Ascension Layer", "Fractal Self", "Apotheosis of the Oneiric",
];

const PROTECT_TYPES = new Set(["class", "subclass"]);   // never delete progression docs
const FEAT_TYPES    = new Set(["feat", "feature"]);
const lc = (s) => String(s ?? "").toLowerCase();
const isPrune = (name) => PRUNE_NAMES.some(p => lc(name).includes(lc(p)));

// Only touch actors with a redesigned class/subclass.
const hasRedesignedClass = (actor) => Array.from(actor.items ?? []).some(i => {
  if (i.type !== "class" && i.type !== "subclass") return false;
  const id = lc(i.system?.identifier), nm = lc(i.name);
  return id.includes("soul-smith") || id.includes("soul_smith") || nm.includes("soul smith") || nm.includes("soul-smith")
      || id.includes("harmony")    || nm.includes("harmony marshal")
      || id.includes("dreamwalker")|| nm.includes("dreamwalker");
});

const deleteRows = [];
const reviewRows = [];
const pending = [];

for (const actor of game.actors) {
  if (!hasRedesignedClass(actor)) continue;
  const ids = [];
  for (const it of actor.items) {
    if (PROTECT_TYPES.has(it.type) || !FEAT_TYPES.has(it.type)) continue;
    if (isPrune(it.name)) { ids.push(it.id); deleteRows.push({ actor: actor.name, item: it.name, type: it.type }); }
    else                  { reviewRows.push({ actor: actor.name, item: it.name, type: it.type }); }
  }
  if (ids.length) pending.push({ actor, ids });
}

if (!DRY_RUN) {
  for (const { actor, ids } of pending) {
    try { await actor.deleteEmbeddedDocuments("Item", ids); }
    catch (e) { console.warn("[cleanup] delete failed for", actor.name, e); }
  }
}

console.group("[cleanup-superseded-class-feats]");
console.log("DRY_RUN:", DRY_RUN);
console.log(`%c${DRY_RUN ? "WOULD DELETE" : "DELETED"} — ${deleteRows.length} item(s):`, "font-weight:bold;color:#dc5050");
console.table(deleteRows);
console.log("%cREVIEW — other feats on these actors (add to PRUNE_NAMES if superseded):", "color:#e8c84a");
console.table(reviewRows);
console.groupEnd();
ui.notifications.info(`Cleanup: ${DRY_RUN ? "would delete" : "deleted"} ${deleteRows.length} item(s); ${reviewRows.length} to review. See console (F12).`);

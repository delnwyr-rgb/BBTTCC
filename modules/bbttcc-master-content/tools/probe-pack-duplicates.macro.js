// Bad Eden — Probe the items pack for DUPLICATES + per-document description state
// READ-ONLY. Writes nothing. Pure diagnostic to console.
// ─────────────────────────────────────────────────────────────────────────────
// Reports: (1) every name in the pack that has MORE THAN ONE document (duplicates),
// with each doc's id + description length; (2) for the known still-empty names, the
// per-document descLen so we can see if a filled copy and an empty copy coexist.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const WATCH = [
  "Cloak of Null Profile", "Ego‑Dragon Scale Aegis", "Abacus Gauntlet", "Unicorn Ramming Module",
  "Neon Spirit Armor", "Veilbreaker Mantle", "Reactor Shield Cape", "Wardstone of Gevurah",
];

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);
  const docs = await pack.getDocuments();
  const strip = (h) => String(h ?? "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").trim();

  // group by name
  const byName = new Map();
  for (const d of docs) { if (!byName.has(d.name)) byName.set(d.name, []); byName.get(d.name).push(d); }

  const dupes = [...byName.entries()].filter(([, arr]) => arr.length > 1);
  console.group(`%c[probe] pack total docs: ${docs.length} | unique names: ${byName.size} | DUPLICATE names: ${dupes.length}`, "color:#ffb000;font-weight:bold");
  if (dupes.length) {
    console.log("=== DUPLICATES (name → each copy's id + descLen) ===");
    for (const [name, arr] of dupes.sort((a, b) => a[0].localeCompare(b[0]))) {
      console.log(`• ${name}  (${arr.length} copies)`);
      arr.forEach(d => console.log(`     id=${d.id}  descLen=${strip(d.system?.description?.value).length}  folder=${d.folder?.name ?? "—"}`));
    }
  } else {
    console.log("No duplicate names in the pack.");
  }
  console.log("\n=== WATCH list (per-document description length) ===");
  for (const name of WATCH) {
    const arr = byName.get(name) || [];
    if (!arr.length) { console.log(`• ${name}: NOT FOUND in pack`); continue; }
    console.log(`• ${name}: ${arr.length} cop${arr.length === 1 ? "y" : "ies"} → ` + arr.map(d => `[id=${d.id} len=${strip(d.system?.description?.value).length}]`).join("  "));
  }
  console.groupEnd();

  // world dupes too (cheap)
  const wByName = new Map();
  for (const d of game.items) { if (!wByName.has(d.name)) wByName.set(d.name, []); wByName.get(d.name).push(d); }
  const wDupes = [...wByName.entries()].filter(([, a]) => a.length > 1);
  console.log(`[probe] world items: ${game.items.size} | world duplicate names: ${wDupes.length}` + (wDupes.length ? " → " + wDupes.map(([n]) => n).join(", ") : ""));

  ui.notifications.info(`Probe: ${dupes.length} duplicate name(s) in pack, ${wDupes.length} in world. See console.`);
})();

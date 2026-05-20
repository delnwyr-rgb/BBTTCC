/**
 * Rename Shadow Courier "Access Die" / "Action Dice" → "Pace" in live pack items.
 *
 * 2026-05-20. The SC class was migrated from the legacy Access-Dice pool to
 * the Pace pool in Sprint F (2026-05-XX), but some compiled pack item
 * descriptions still reference the old name. This macro walks every SC item
 * in the canonical classes pack and performs a non-destructive find/replace
 * across description.value.
 *
 * Safe to re-run: idempotent (already-renamed text is a no-op).
 *
 * Usage: paste into a Foundry Script Macro and execute as GM.
 */
const PACK_KEY = "bbttcc-master-content.classes";
const REPLACEMENTS = [
  // Order matters — process longer phrases first so we don't double-rewrite.
  ["Access Dice", "Pace"],
  ["Access Die",  "Pace"],
  ["Action Dice", "Pace"],
  ["Action Die",  "Pace"],
  ["access dice", "Pace"],
  ["access die",  "Pace"],
  ["action dice", "Pace"],
  ["action die",  "Pace"]
];

const SC_NAME_RE        = /shadow\s*courier/i;
const SC_IDENTIFIER_RE  = /^(shadow.courier|bbttcc-shadow-courier)/i;
const SC_CLASS_FLAG_RE  = /^shadow.courier$/i;

if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

const pack = game.packs.get(PACK_KEY);
if (!pack) { ui.notifications.error(`Pack ${PACK_KEY} not found.`); return; }
const wasLocked = pack.locked;
if (wasLocked) {
  try { await pack.configure({ locked: false }); }
  catch (e) { ui.notifications.error("Could not unlock pack."); return; }
}

const index = await pack.getIndex({ fields: ["name", "type", "system.identifier", "flags.bbttcc.classIdentifier"] });
const candidates = index.filter(e => {
  if (SC_NAME_RE.test(String(e.name || ""))) return true;
  if (SC_IDENTIFIER_RE.test(String(e.system?.identifier || ""))) return true;
  if (SC_CLASS_FLAG_RE.test(String(e.flags?.bbttcc?.classIdentifier || ""))) return true;
  return false;
});

const report = { scanned: 0, edited: 0, perItem: [], errors: [] };

for (const entry of candidates) {
  report.scanned++;
  try {
    const doc = await pack.getDocument(entry._id);
    if (!doc) continue;
    const before = doc.system?.description?.value ?? "";
    if (!before) continue;
    let after = before;
    for (const [needle, replacement] of REPLACEMENTS) {
      if (after.includes(needle)) {
        after = after.split(needle).join(replacement);
      }
    }
    if (after !== before) {
      const replaced = REPLACEMENTS
        .map(([n]) => ({ needle: n, count: (before.match(new RegExp(n.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "g")) || []).length }))
        .filter(r => r.count > 0);
      await doc.update({ "system.description.value": after });
      report.edited++;
      report.perItem.push({ name: doc.name, replaced });
    }
  } catch (e) {
    report.errors.push({ name: entry.name, error: e.message });
  }
}

if (wasLocked) {
  try { await pack.configure({ locked: true }); }
  catch (e) { ui.notifications.warn("Could not re-lock pack."); }
}

console.group("Shadow Courier — Access/Action Dice → Pace rename");
console.table(report.perItem.map(r => ({
  Item: r.name,
  Replacements: r.replaced.map(x => `${x.count}× "${x.needle}"`).join(", ")
})));
if (report.errors.length) console.error("Errors:", report.errors);
console.log(`Scanned ${report.scanned} · Edited ${report.edited} · Errors ${report.errors.length}`);
console.groupEnd();

ui.notifications.info(`Shadow Courier rename: scanned ${report.scanned}, edited ${report.edited}. See console for details.`);

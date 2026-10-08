#!/usr/bin/env node
/* build-bestiary-tuning.mjs — compile a bestiary tuning patch (from tune-bestiary.mjs) into a guarded GM macro.
 * Usage (repo root): node modules/bbttcc-master-content/tools/build-bestiary-tuning.mjs <npcs.jsonl> <patch.json> [--out tools/X.macro.js]
 *   patch.json = { [actorName]: { attrs: { faculty: [old, new] }, weapons: { itemName: [oldFormula, newFormula] }, steps, verdicts } }
 * The macro (DRY_RUN=true by default) updates the PACK actor by id (faculty values + weapon damage formulas, every field guarded by
 * its expected old value → drift = skip + log) and then every WORLD actor with the same name that carries the lineage flag
 * (imported copies, Crash Test Range foes, scene tokens' linked actors) with the same guards. Nothing else is touched —
 * derived pools/defenses recompute from faculties at prepare time, and the threat chassis layers on top (threat-chassis.js).
 */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2); const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [NPCS, PATCH] = argv.filter((a, i) => !a.startsWith("--") && !(argv[i - 1] || "").startsWith("--"));
if (!NPCS || !PATCH) { console.error("usage: build-bestiary-tuning.mjs <npcs.jsonl> <patch.json> [--out file]"); process.exit(2); }
const OUT = opt("--out", path.join(HERE, `tune-bestiary-${new Date().toISOString().slice(0, 10)}.macro.js`));
const rows = fs.readFileSync(NPCS, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
const actors = rows.filter(r => r.k.startsWith("!actors!")).map(r => r.v);
const folders = Object.fromEntries(rows.filter(r => r.k.startsWith("!folders!")).map(r => [r.v._id, r.v.name]));
const patch = JSON.parse(fs.readFileSync(PATCH, "utf8"));
const plan = []; let nAttr = 0, nDice = 0;
for (const [name, p] of Object.entries(patch)) {
  const a = actors.find(x => x.name === name); if (!a) { console.error(`✗ ${name}: not in the dump`); continue; }
  const items = rows.filter(r => r.k.startsWith(`!actors.items!${a._id}.`)).map(r => r.v);
  const set = {}, expect = {}, why = [];
  for (const [k, [old, nv]] of Object.entries(p.attrs || {})) {
    const live = Number(a.system?.attributes?.[k]?.value) || 0;
    if (live !== old) { console.error(`✗ ${name}: ${k} is ${live} in the dump, patch expected ${old}`); continue; }
    set[`system.attributes.${k}.value`] = nv; expect[`system.attributes.${k}.value`] = old; why.push(`${k} ${old}→${nv}`); nAttr++;
  }
  const itemPlan = [];
  for (const [iname, [old, nf]] of Object.entries(p.weapons || {})) {
    const it = items.find(i => i.type === "weapon" && i.name === iname); if (!it) { console.error(`✗ ${name} › ${iname}: weapon not in the dump`); continue; }
    if (it.system?.damage?.formula !== old) { console.error(`✗ ${name} › ${iname}: formula is ${it.system?.damage?.formula}, patch expected ${old}`); continue; }
    itemPlan.push({ id: it._id, name: iname, set: { "system.damage.formula": nf }, expect: { "system.damage.formula": old }, why: `${iname} ${old}→${nf}` }); nDice++;
  }
  if (!Object.keys(set).length && !itemPlan.length) continue;
  const rfi = a.flags?.fourththing?.rfi?.actor || {};
  plan.push({ id: a._id, name, folder: folders[a.folder] || "", tier: rfi.tier, bracket: rfi.bracket, set, expect, items: itemPlan, why, verdict: (p.verdicts || []).at(-1) || "" });
}
const stamp = new Date().toISOString().slice(0, 10);
fs.writeFileSync(OUT, `/* ${path.basename(OUT)} — BESTIARY TUNING PASS (GENERATED ${stamp} by build-bestiary-tuning.mjs — do not hand-edit; rebuild from a fresh dump).
 * Paste into a GM macro on EMBER and run. DRY_RUN = true prints the whole plan and writes nothing; flip to false to write.
 * What: ${plan.length} monsters · ${nAttr} faculty change(s) · ${nDice} weapon dice change(s), found by bin/ft-tune-bestiary against
 *       bin/ft-sim-encounter --chassis system (targets ruled 2026-10-06: 3 lights / 1 medium = fair vs one Steward, heavy = duo, boss = party).
 * Where: the PACK actor (by id) and then every WORLD actor of the same name carrying the lineage flag. Every field is guarded by
 *        its expected old value — a changed field is skipped and logged as drift, never overwritten.
 */
const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.npcs";
const PLAN = ${JSON.stringify(plan, null, 1)};
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const pack = game.packs.get(PACK_ID); if (!pack) return ui.notifications.error(\`No pack \${PACK_ID}\`);
  const get = (doc, k) => foundry.utils.getProperty(doc, k);
  const eq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const log = []; let wrote = 0, worldWrote = 0, skipped = 0;
  const apply = async (a, p, where) => {
    const upd = {}; for (const [k, v] of Object.entries(p.set)) { if (eq(get(a, k), p.expect[k])) upd[k] = v; else { log.push(\`✗ drift \${where} \${p.name} \${k} = \${JSON.stringify(get(a, k))} (expected \${JSON.stringify(p.expect[k])})\`); skipped++; } }
    const iu = [];
    for (const it of p.items) {
      const doc = where === "[pack]" ? a.items.get(it.id) : a.items.find(d => d.type === "weapon" && d.name === it.name);
      if (!doc) { log.push(\`✗ drift \${where} \${p.name} › \${it.name} gone\`); skipped++; continue; }
      const u = { _id: doc.id }; for (const [k, v] of Object.entries(it.set)) { if (eq(get(doc, k), it.expect[k])) u[k] = v; else { log.push(\`✗ drift \${where} \${p.name} › \${it.name} \${k} = \${JSON.stringify(get(doc, k))}\`); skipped++; } }
      if (Object.keys(u).length > 1) iu.push(u);
    }
    if (!Object.keys(upd).length && !iu.length) return false;
    log.push(\`\${DRY_RUN ? "·" : "✔"} \${where} \${p.folder ? p.folder + " › " : ""}\${p.name} [T\${p.tier} \${p.bracket}] \${p.why.join(", ")}\${iu.length ? " · " + p.items.filter(i => iu.some(u => u._id === (where === "[pack]" ? i.id : a.items.find(d => d.name === i.name)?.id))).map(i => i.why).join(", ") : ""}\`);
    if (!DRY_RUN) { if (Object.keys(upd).length) await a.update(upd); if (iu.length) await a.updateEmbeddedDocuments("Item", iu); }
    return true;
  };
  const wasLocked = pack.locked;
  try {
    if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
    for (const p of PLAN) {
      const a = await pack.getDocument(p.id);
      if (!a || a.name !== p.name) { log.push(\`✗ SKIP \${p.name} — not found / renamed in the pack\`); skipped++; continue; }
      if (await apply(a, p, "[pack]")) wrote++;
      for (const w of game.actors.filter(x => x.name === p.name && x.flags?.fourththing?.rfi?.actor?.lineage)) if (await apply(w, p, "[world]")) worldWrote++;
    }
  } finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  console.log(\`[tune-bestiary] \${DRY_RUN ? "DRY RUN" : "APPLIED"} — \${wrote} pack actor(s), \${worldWrote} world actor(s), \${skipped} skip/drift\\n\` + log.join("\\n"));
  ui.notifications.info(\`tune-bestiary \${DRY_RUN ? "dry run" : "applied"}: \${wrote} pack / \${worldWrote} world actors, \${skipped} skipped — see console (F12).\`);
})();
`);
console.log(`build-bestiary-tuning: ${plan.length} monsters · ${nAttr} faculty · ${nDice} dice → ${OUT}`);
for (const p of plan) console.log(`  ${p.name.padEnd(40)} T${String(p.tier).padEnd(3)} ${String(p.bracket).padEnd(6)} ${[...p.why, ...p.items.map(i => i.why)].join(", ")}  → ${p.verdict}`);

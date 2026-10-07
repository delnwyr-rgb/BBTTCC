#!/usr/bin/env node
/* build-npc-pass3-automation.mjs — compile NPC Pack v1 PASS 3b: the authored automation data onto every ability item.
 * Usage (repo root):
 *   node modules/bbttcc-master-content/tools/build-npc-pass3-automation.mjs <rule-input.json> <rule-output.json>
 *   → writes modules/bbttcc-master-content/tools/npc-pack-pass3-automation.macro.js
 * rule-input.json  = the 340 unique prose abilities + every occurrence {actorId, itemId, actor} (built from the live dump)
 * rule-output.json = per-ability verdict + weaponManifestation + npcAuto (authored 2026-10-06, validated by npc-auto-schema)
 * The macro writes BOTH the live world actors and the compendium (same ids): weapon riders merge into the existing
 * system.manifestation block (resolution / appliedStates / riderDamage / area — never the other keys), rules go to
 * flags.fourththing.npcAuto. Items are name-checked; identical data is skipped (re-run safe).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateNpcAuto, validateWeaponManifestation, AREA_ALIAS } from "./npc-auto-schema.mjs";

const [INPUT, OUTPUT] = process.argv.slice(2);
if (!INPUT || !OUTPUT) { console.error("usage: build-npc-pass3-automation.mjs <rule-input.json> <rule-output.json>"); process.exit(2); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const input = Object.fromEntries(JSON.parse(fs.readFileSync(INPUT, "utf8")).map(e => [e.key, e]));
const output = JSON.parse(fs.readFileSync(OUTPUT, "utf8")).entries;

const stale = [];
const plan = [], tally = { auto: 0, partial: 0, prompt: 0, flavor: 0, skip: 0, items: 0, weaponMf: 0, rules: 0 }, problems = [];
for (const e of output) {
  const src = input[e.key]; if (!src) { stale.push(e.key.split("|")[0]); continue; }   // authored for an item that no longer exists (merged/deleted actors)
  tally[e.verdict] = (tally[e.verdict] ?? 0) + 1;
  if (!e.npcAuto && !e.weaponManifestation) continue;
  if (e.weaponManifestation?.area?.shape && AREA_ALIAS[e.weaponManifestation.area.shape]) e.weaponManifestation.area.shape = AREA_ALIAS[e.weaponManifestation.area.shape];
  for (const p of [...validateNpcAuto(e.npcAuto, `${src.name}: `), ...validateWeaponManifestation(e.weaponManifestation, `${src.name}: `)]) problems.push(p);
  for (const o of src.occurrences) {
    plan.push({ actorId: o.actorId, itemId: o.itemId, actor: o.actor, item: o.itemName ?? src.name, verdict: e.verdict, npcAuto: e.npcAuto ?? null, mf: src.itemType === "weapon" ? (e.weaponManifestation ?? null) : null });
    tally.items++; if (e.weaponManifestation && src.itemType === "weapon") tally.weaponMf++; if (e.npcAuto) tally.rules += (e.npcAuto.rules ?? []).length;
  }
}
if (problems.length) { console.error("INVALID automation data:\n  " + problems.join("\n  ")); process.exit(1); }

const OUT = path.join(HERE, "npc-pack-pass3-automation.macro.js");
fs.writeFileSync(OUT, `/* npc-pack-pass3-automation.macro.js — NPC Pack v1 PASS 3b: ability automation data (GENERATED ${new Date().toISOString().slice(0, 10)}
 * by build-npc-pass3-automation.mjs — do not hand-edit; rebuild from rule-output.json).
 * Paste into a GM macro on EMBER. DRY_RUN = true prints the plan, writes nothing. Needs the 2026-10-06 system build
 * (npc-automation.js + the weapon-rider wiring) deployed first, else the data sits inert.
 * Writes BOTH the live world actors and the compendium bbttcc-master-content.npcs (same ids). Name-checked; re-run safe.
 * Tally: ${JSON.stringify(tally)}
 */
const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.npcs";
const PLAN = ${JSON.stringify(plan)};
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const pack = game.packs.get(PACK_ID); if (!pack) return ui.notifications.error(\`No pack \${PACK_ID}\`);
  const eq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const log = []; let wrote = 0, same = 0, skipped = 0;
  const wasLocked = pack.locked; if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
  const byActor = {}; for (const p of PLAN) (byActor[p.actorId] ??= []).push(p);
  try {
    for (const ctx of ["world", "pack"]) {
      for (const [actorId, rows] of Object.entries(byActor)) {
        const a = ctx === "world" ? game.actors.get(actorId) : await pack.getDocument(actorId).catch(() => null);
        if (!a) { if (ctx === "pack") { log.push(\`✗ [pack] \${rows[0].actor} missing\`); skipped++; } continue; }
        const updates = [];
        for (const p of rows) {
          const it = a.items.get(p.itemId) ?? a.items.find(i => i.name === p.item);
          if (!it) { log.push(\`✗ [\${ctx}] \${a.name} › \${p.item} — item missing\`); skipped++; continue; }
          if (it.name !== p.item) { log.push(\`✗ [\${ctx}] \${a.name} › \${p.item} — now "\${it.name}"\`); skipped++; continue; }
          const u = { _id: it.id }, bits = [];
          if (p.npcAuto && !eq(it.flags?.fourththing?.npcAuto, p.npcAuto)) { u["flags.fourththing.npcAuto"] = p.npcAuto; bits.push(\`\${p.npcAuto.rules.length} rule(s)\${p.npcAuto.recharge ? " +recharge" : ""}\`); }
          if (p.mf) {
            const cur = it.system?.manifestation ?? {};
            for (const k of ["resolution", "appliedStates", "riderDamage", "area"]) {
              if (p.mf[k] === undefined) continue;
              const merged = k === "resolution" ? { ...(cur.resolution ?? {}), ...p.mf.resolution } : p.mf[k];
              if (!eq(cur[k], merged)) { u[\`system.manifestation.\${k}\`] = merged; bits.push(k); }
            }
          }
          if (Object.keys(u).length > 1) { updates.push(u); log.push(\`\${DRY_RUN ? "·" : "✔"} [\${ctx}] \${a.name} › \${p.item} (\${p.verdict}): \${bits.join(", ")}\`); } else same++;
        }
        if (updates.length && !DRY_RUN) await a.updateEmbeddedDocuments("Item", updates);
        wrote += updates.length;
      }
    }
  } finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  console.log(\`[npc-pack-pass3-automation] \${DRY_RUN ? "DRY RUN" : "APPLIED"} — \${wrote} item write(s), \${same} already current, \${skipped} skipped\\n\` + log.join("\\n"));
  ui.notifications.info(\`npc-pack-pass3-automation \${DRY_RUN ? "dry run" : "applied"}: \${wrote} items, \${same} current, \${skipped} skipped — see console (F12).\`);
})();
`);
console.log(`build-npc-pass3-automation → ${path.relative(process.cwd(), OUT)}  ${JSON.stringify(tally)}${stale.length ? `\n  stale authored entries (item no longer in the pack): ${stale.join("; ")}` : ""}`);

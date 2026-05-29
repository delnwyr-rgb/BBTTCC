#!/usr/bin/env node
// Read-only survey of the npcs pack. Iterates the !actors.items! child keys and
// classifies each feature/feat item: does its description encode DAMAGE (dice)
// and/or a SAVE that a clickable weapon-type item would model better? No writes.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const PACK = resolve(here, "..", "packs", "npcs");
const require = createRequire(import.meta.url);
let ClassicLevel;
for (const p of ["classic-level","/opt/homebrew/lib/node_modules/@foundryvtt/foundryvtt-cli/node_modules/classic-level"]) { try { ({ ClassicLevel } = require(p)); break; } catch {} }
if (!ClassicLevel) throw new Error("classic-level not found");

const db = new ClassicLevel(PACK, { valueEncoding: "json" });
await db.open();

const strip = h => String(h||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
const DICE = /\b\d+d\d+\b/i;
const DMG  = /(\d+d\d+)(?:\s*\+\s*\d+)?\s+(\w+)?\s*(?:damage|to (?:integrity|stress))/i;
const SAVE = /\bDC\s*(\d+)\b/i;
const CHK  = /DC\s*\d+\s+(\w+)\s+(?:check|save|saving)/i;

// actor name + tier lookup
const actorMeta = {};
for await (const [key, doc] of db.iterator()) {
  if (key.startsWith("!actors!") && key.split("!").length === 3)
    actorMeta[doc._id] = { name: doc.name, tier: doc.system?.tier, bracket: doc.flags?.fourththing?.rfi?.actor?.bracket };
}

const rows = [];
for await (const [key, it] of db.iterator()) {
  if (!key.startsWith("!actors.items!")) continue;
  const actorId = key.split("!")[2].split(".")[0];
  if (it.type !== "feature" && it.type !== "feat") continue;
  const desc = strip(it.system?.description?.value);
  const dmgM = desc.match(DMG), saveM = desc.match(CHK), dcM = desc.match(SAVE);
  const hasDamage = DICE.test(desc) && /damage|to integrity|to stress/i.test(desc);
  const hasSave   = SAVE.test(desc);
  const isReaction = /\breaction\b/i.test(desc);
  if (!hasDamage && !hasSave) continue;
  rows.push({
    actorId, actor: actorMeta[actorId]?.name ?? actorId, tier: actorMeta[actorId]?.tier,
    item: it.name, type: it.type, itemId: it._id,
    hasDamage, hasSave, isReaction,
    dice: dmgM?.[1] || "", dmgType: dmgM?.[2] || "",
    dc: dcM?.[1] || "", saveAttr: saveM?.[1] || "",
    snippet: desc.slice(0,170)
  });
}
await db.close();

const byActor = {};
for (const r of rows) (byActor[r.actor] ??= []).push(r);
let conv=0, save=0;
for (const [actor, list] of Object.entries(byActor).sort()) {
  console.log(`\n■ ${actor}  [T${list[0].tier ?? "?"}]`);
  for (const r of list) {
    const cls = r.hasDamage ? "→ WEAPON (dmg)" : (r.isReaction ? "  reaction/save (skip)" : "  save-only");
    if (r.hasDamage) conv++; else save++;
    console.log(`   ${cls}  ${r.type}:"${r.item}"  dice=${r.dice||"-"} type=${r.dmgType||"-"} DC=${r.dc||"-"} attr=${r.saveAttr||"-"} react=${r.isReaction}`);
    console.log(`        "${r.snippet}"`);
  }
}
console.log(`\n=== ${rows.length} flagged: ${conv} damage-bearing (→ weapon), ${save} save/effect-only ===`);

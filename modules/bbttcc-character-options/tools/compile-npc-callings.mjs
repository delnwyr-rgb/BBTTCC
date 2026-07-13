#!/usr/bin/env node
// Compile the npc-callings JSON source into the ClassicLevel compendium pack.
// Direct classic-level write (same reasons as fourththing's
// compile-surge-abilities.mjs — the bundled `fvtt package pack` iterator is
// broken under Node 24 here). Key format is `!items!<_id>`, value is the
// document object.
//
//   node modules/bbttcc-character-options/tools/build-npc-callings.mjs   # regen JSON
//   node modules/bbttcc-character-options/tools/compile-npc-callings.mjs # JSON → LevelDB

import { readFileSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const MOD  = resolve(here, "..");
const SRC  = resolve(MOD, "packs/_source/npc-callings");
const PACK = resolve(MOD, "packs/npc-callings");

const require = createRequire(import.meta.url);
let ClassicLevel;
for (const p of [
  "classic-level",
  "/opt/homebrew/lib/node_modules/@foundryvtt/foundryvtt-cli/node_modules/classic-level",
]) {
  try { ({ ClassicLevel } = require(p)); break; } catch {}
}
if (!ClassicLevel) throw new Error("classic-level not found — install it or point at the fvtt CLI's copy");

rmSync(PACK, { recursive: true, force: true });

const files = readdirSync(SRC).filter(f => f.endsWith(".json"));
const db = new ClassicLevel(PACK, { valueEncoding: "json" });
await db.open();
const batch = db.batch();
let n = 0;
for (const f of files) {
  const doc = JSON.parse(readFileSync(resolve(SRC, f), "utf8"));
  if (!doc._id) throw new Error(`${f}: missing _id`);
  batch.put(`!items!${doc._id}`, doc);
  n++;
}
await batch.write();
await db.close();
console.log(`Compiled ${n} items → ${PACK}`);

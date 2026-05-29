#!/usr/bin/env node
// Compile the surge-abilities JSON source into the ClassicLevel compendium pack.
// We write the LevelDB directly via classic-level because the bundled
// `fvtt package pack` CLI's iterator is broken under Node 24 in this environment
// (LEVEL_ITERATOR_NOT_OPEN). Foundry reads the resulting dir natively — the key
// format is `!items!<_id>` and the value is the document object (no `_key`).
//
//   node systems/fourththing/tools/build-surge-abilities.mjs   # regen JSON
//   node systems/fourththing/tools/compile-surge-abilities.mjs # JSON → LevelDB

import { readFileSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const SYS  = resolve(here, "..");
const SRC  = resolve(SYS, "packs/_source/surge-abilities");
const PACK = resolve(SYS, "packs/surge-abilities");

// classic-level ships inside the globally-installed foundryvtt-cli.
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

#!/usr/bin/env node
// extract-npc-abilities.mjs
// Build the "BBTTCC NPC Abilities" Item compendium by extracting every embedded ability
// item from the NPC actors of BOTH live worlds, deduped by content (name+stats — exact
// duplicates collapse; same-name-different-stats stay as separate entries). Non-ability
// build scaffolding (class/subclass/species/race/background) is excluded. Each entry keeps
// its original data + a provenance flag (flags.bbttcc.npcAbility.sources/worlds) and gets a
// stable _id derived from its content hash (so re-runs are deterministic).
//
// Reads two pulled live npc packs; writes the LevelDB pack at packs/npc-abilities.
//   node tools/extract-npc-abilities.mjs   (expects /tmp/ftaa/npc_F and /tmp/ftaa/npc_E)

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let ClassicLevel;
for (const p of ["classic-level", "/opt/homebrew/lib/node_modules/@foundryvtt/foundryvtt-cli/node_modules/classic-level"]) { try { ({ ClassicLevel } = require(p)); break; } catch {} }
if (!ClassicLevel) throw new Error("classic-level not found");

const SOURCES = [["foundry", "/tmp/ftaa/npc_F"], ["ember", "/tmp/ftaa/npc_E"]];
const PACK = path.resolve(process.env.HOME, "modules/bbttcc-master-content/packs/npc-abilities");
const EXCLUDE_TYPES = new Set(["class", "subclass", "species", "race", "background"]);

const sortKeys = o => Array.isArray(o) ? o.map(sortKeys) : (o && typeof o === "object" ? Object.keys(o).sort().reduce((r, k) => (r[k] = sortKeys(o[k]), r), {}) : o);
const contentHash = item => {
  const c = JSON.parse(JSON.stringify(item));
  for (const k of ["_id", "_stats", "ownership", "sort", "folder"]) delete c[k];
  if (c.flags) { delete c.flags.core; if (!Object.keys(c.flags).length) delete c.flags; }
  return crypto.createHash("sha1").update(JSON.stringify(sortKeys(c))).digest();
};
// 16-char Foundry id (/^[A-Za-z0-9]{16}$/) deterministically from the content hash
const idFromHash = digest => {
  let s = digest.toString("base64").replace(/[^A-Za-z0-9]/g, "");
  while (s.length < 16) s += digest.toString("hex");
  return s.slice(0, 16);
};

const byHash = new Map();
for (const [world, p] of SOURCES) {
  const db = new ClassicLevel(p, { valueEncoding: "json" });
  await db.open();
  const actorName = {};
  for await (const [k, v] of db.iterator()) if (k.startsWith("!actors!")) actorName[v._id] = v.name;
  for await (const [k, v] of db.iterator()) {
    if (!k.startsWith("!actors.items!")) continue;
    if (EXCLUDE_TYPES.has(v.type)) continue;
    const actorId = k.split("!")[2].split(".")[0];
    const digest = contentHash(v);
    const hkey = digest.toString("hex");
    if (!byHash.has(hkey)) byHash.set(hkey, { item: v, digest, sources: new Set(), worlds: new Set() });
    const e = byHash.get(hkey);
    e.sources.add(actorName[actorId] || "?");
    e.worlds.add(world);
  }
  await db.close();
}

const entries = [...byHash.values()];
fs.rmSync(PACK, { recursive: true, force: true });
const db = new ClassicLevel(PACK, { valueEncoding: "json" });
await db.open();
const batch = db.batch();
const usedIds = new Set();
let n = 0;
const typeCount = {};
for (const e of entries) {
  const doc = JSON.parse(JSON.stringify(e.item));
  let id = idFromHash(e.digest);
  while (usedIds.has(id)) id = idFromHash(crypto.createHash("sha1").update(id).digest());
  usedIds.add(id);
  doc._id = id;
  delete doc.ownership; delete doc._stats; delete doc.folder; doc.sort = 0;
  doc.flags = doc.flags || {};
  if (doc.flags.core) delete doc.flags.core;
  doc.flags.bbttcc = doc.flags.bbttcc || {};
  doc.flags.bbttcc.npcAbility = { sources: [...e.sources].sort(), worlds: [...e.worlds].sort() };
  batch.put(`!items!${id}`, doc);
  typeCount[doc.type] = (typeCount[doc.type] || 0) + 1;
  n++;
}
await batch.write();
await db.close();
console.log(`Compiled ${n} NPC-ability items -> ${PACK}`);
console.log("by type:", JSON.stringify(typeCount));

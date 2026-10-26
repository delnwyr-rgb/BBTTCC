#!/usr/bin/env node
/* extract-npc-abilities.mjs — the "BBTTCC NPC Abilities" GM drag library, regenerated from the npcs PACK (BS1, 2026-10-26).
 *
 * The library has no runtime reader (CAPABILITIES: GM drag library only), so it must simply MIRROR what the pack monsters
 * and NPCs carry today. This tool reads the pack (the `_source/npcs` mirror — nested CLI shape — or a live JSONL dump),
 * takes every embedded ability of type weapon / feature / feat / power from every pack actor outside the Test-PC folders,
 * drops character-option leakage (Dreamie's archetype / crew / alignment records) and build scaffolding, dedupes by content
 * hash (same name + same stats collapse; same name, different stats stay apart) and stamps provenance
 * `flags.bbttcc.npcAbility = { sources:[actor names], sourceIds:[actor ids], worlds:["pack"], generated }`.
 *
 * Ids are STABLE: a record keeps the id of the existing library record with the same content hash, else of the record
 * with the same name that shares a source actor, else a deterministic id from the content hash.
 *
 * Output = a v2 applier manifest for `bbttcc-master-content.npc-abilities` (`_create` new ids, `_retype` changed ids
 * [delete + keepId re-create, so stale keys cannot linger], `_delete` ids no longer generated) and, with --write, the
 * `_source/npc-abilities` mirror rewritten to match. NEVER writes a LevelDB pack.
 *
 * Usage (repo root):
 *   node modules/bbttcc-master-content/tools/extract-npc-abilities.mjs [--src packs/_source/npcs | --dump npcs.jsonl]
 *        [--lib packs/_source/npc-abilities] [--out manifest.json] [--write]
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKS = path.resolve(HERE, "../packs");
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SRC = opt("--src", path.join(PACKS, "_source/npcs")), DUMP = opt("--dump"), LIB = opt("--lib", path.join(PACKS, "_source/npc-abilities"));
const OUT = opt("--out", "npc-abilities.manifest.json"), WRITE = argv.includes("--write");
// scope (2026-10-26): "monsters" (default) = lineage-flagged bestiary actors + entityKind "monster" — the GM drag library is the
// bestiary's ability shelf; named NPCs carry class / Path / doctrine kits that live in their own packs. "all" = every pack actor.
const SCOPE = opt("--scope", "monsters");
const inScope = a => SCOPE === "all" || !!a.flags?.fourththing?.rfi?.actor?.lineage || a.flags?.["bbttcc-auto-link"]?.entityKind === "monster";
const TODAY = new Date().toISOString().slice(0, 10);
const OUT_OF_SCOPE = /^(Test PCs|Testing Characters)(\/|$)/;
const KEEP_TYPES = new Set(["weapon", "feature", "feat", "power"]);
const CO_NAME = /^(Archetype|Crew Type|Occult Association|Alignment|Political Affiliation|Scion|Sephirotic Scion|Sephirotic Scion Heritage|Dreamwalker|Enlightenment|Heritage|Species|Calling)\b.*:/;

// ── load the pack: nested actors + folders ─────────────────────────────────────────────────────────────────
let actors = [], folders = {};
if (DUMP) {
  const recs = fs.readFileSync(DUMP, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
  const items = {}, effects = {};
  for (const r of recs) {
    const [, kind, rest] = r.k.split("!"), ids = rest.split(".");
    if (kind === "folders") folders[ids[0]] = r.v;
    else if (kind === "actors") actors.push(r.v);
    else if (kind === "actors.items") (items[ids[0]] ??= {})[ids[1]] = r.v;
    else if (kind === "actors.items.effects") (effects[`${ids[0]}.${ids[1]}`] ??= []).push(r.v);
  }
  for (const a of actors) { const mine = items[a._id] ?? {}; a.items = (Array.isArray(a.items) ? a.items : []).map(id => mine[id]).filter(Boolean).concat(Object.values(mine).filter(i => !(a.items ?? []).includes(i._id))); for (const i of a.items) i.effects = effects[`${a._id}.${i._id}`] ?? i.effects ?? []; }
} else {
  for (const f of fs.readdirSync(SRC).filter(f => f.endsWith(".json"))) {
    const d = JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8"));
    if (String(d._key || "").startsWith("!folders!")) folders[d._id] = d; else if (String(d._key || "").startsWith("!actors!")) actors.push(d);
  }
}
const fpath = id => { const s = []; for (let f = folders[id]; f; f = folders[f.folder]) s.unshift(f.name); return s.join("/"); };

// ── existing library ──────────────────────────────────────────────────────────────────────────────────────
const lib = {};
if (fs.existsSync(LIB)) for (const f of fs.readdirSync(LIB).filter(f => f.endsWith(".json"))) { const d = JSON.parse(fs.readFileSync(path.join(LIB, f), "utf8")); lib[d._id] = { doc: d, file: f }; }

// ── content hash (play state + provenance + bookkeeping stripped) ──────────────────────────────────────────
const sortKeys = o => Array.isArray(o) ? o.map(sortKeys) : (o && typeof o === "object" ? Object.keys(o).sort().reduce((r, k) => (r[k] = sortKeys(o[k]), r), {}) : o);
function canon(item) {
  const c = JSON.parse(JSON.stringify(item));
  for (const k of ["_id", "_stats", "ownership", "sort", "folder", "_key"]) delete c[k];
  if (c.flags) { delete c.flags.core; delete c.flags.bbttcc?.npcAbility; if (c.flags.bbttcc && !Object.keys(c.flags.bbttcc).length) delete c.flags.bbttcc; if (c.flags.fourththing?.npcAuto) { delete c.flags.fourththing.npcAuto.spent; delete c.flags.fourththing.npcAuto.spentRound; } if (!Object.keys(c.flags).length) delete c.flags; }
  for (const e of c.effects ?? []) { delete e._stats; delete e.origin; }
  return c;
}
const hashOf = item => crypto.createHash("sha1").update(JSON.stringify(sortKeys(canon(item)))).digest();
const idFromHash = digest => { let s = digest.toString("base64").replace(/[^A-Za-z0-9]/g, ""); while (s.length < 16) s += digest.toString("hex"); return s.slice(0, 16); };
const isCharacterOption = i => !!i.flags?.["bbttcc-character-options"] || CO_NAME.test(i.name) || /^(species|race|class|subclass|background)$/.test(i.type) || !!i.flags?.fourththing?.rfi?.item?.characterOption;

// ── gather ────────────────────────────────────────────────────────────────────────────────────────────────
const byHash = new Map(); let seen = 0, skippedCO = 0, skippedType = 0, scopedOut = 0;
for (const a of actors) {
  if (OUT_OF_SCOPE.test(fpath(a.folder)) || !inScope(a)) { scopedOut++; continue; }
  for (const it of a.items ?? []) {
    if (!it || typeof it !== "object") continue;
    seen++;
    if (!KEEP_TYPES.has(it.type)) { skippedType++; continue; }
    if (isCharacterOption(it)) { skippedCO++; continue; }
    const digest = hashOf(it), hk = digest.toString("hex");
    if (!byHash.has(hk)) byHash.set(hk, { item: canon(it), digest, sources: new Set(), sourceIds: new Set() });
    const e = byHash.get(hk); e.sources.add(a.name); e.sourceIds.add(a._id);
  }
}

// ── stable ids ────────────────────────────────────────────────────────────────────────────────────────────
const libByHash = {}, libByName = {};
for (const [id, { doc }] of Object.entries(lib)) { libByHash[hashOf(doc).toString("hex")] = id; (libByName[doc.name] ??= []).push(id); }
const used = new Set(); const out = [];
for (const e of byHash.values()) {
  const hk = e.digest.toString("hex");
  let id = libByHash[hk];
  if (!id || used.has(id)) {
    const cands = (libByName[e.item.name] ?? []).filter(x => !used.has(x));
    id = cands.find(x => (lib[x].doc.flags?.bbttcc?.npcAbility?.sourceIds ?? []).some(s => e.sourceIds.has(s)) || (lib[x].doc.flags?.bbttcc?.npcAbility?.sources ?? []).some(s => e.sources.has(s))) ?? cands[0];
  }
  if (!id || used.has(id)) { id = idFromHash(e.digest); while (used.has(id) || (lib[id] && !used.has(id) && lib[id].doc.name !== e.item.name)) id = idFromHash(crypto.createHash("sha1").update(id).digest()); }
  used.add(id);
  const doc = JSON.parse(JSON.stringify(e.item));
  doc._id = id; doc.sort = 0; doc.folder = null; doc.ownership = { default: 0 };
  doc.flags = doc.flags || {}; doc.flags.bbttcc = doc.flags.bbttcc || {};
  doc.flags.bbttcc.npcAbility = { sources: [...e.sources].sort(), sourceIds: [...e.sourceIds].sort(), worlds: ["pack"], generated: TODAY };
  out.push(doc);
}
out.sort((a, b) => a.name.localeCompare(b.name) || a._id.localeCompare(b._id));

// ── manifest: create / retype / delete ───────────────────────────────────────────────────────────────────
const same = (a, b) => JSON.stringify(sortKeys(canon(a))) === JSON.stringify(sortKeys(canon(b)));
const manifest = { _meta: { packId: "bbttcc-master-content.npc-abilities", world: null, collection: "items", order: 2, generated: TODAY, tool: "extract-npc-abilities.mjs",
  notes: `GM drag library regenerated from the npcs pack, scope ${SCOPE} (${actors.length - scopedOut} actors in scope; ${seen} embedded items seen, ${skippedType} non-ability types + ${skippedCO} character-option records dropped). _create new ids, _retype changed ids (full doc, keepId), _delete orphans. Apply AFTER BS_npcs.json.` },
  _create: [], _retype: [], _delete: [] };
const outIds = new Set(out.map(d => d._id));
for (const d of out) { const old = lib[d._id]?.doc; if (!old) manifest._create.push(d); else if (!same(old, d)) manifest._retype.push(d); }
for (const id of Object.keys(lib)) if (!outIds.has(id)) manifest._delete.push(id);
fs.writeFileSync(OUT, JSON.stringify(manifest, null, 1));
const typeCount = {}; for (const d of out) typeCount[d.type] = (typeCount[d.type] || 0) + 1;
console.log(`extract-npc-abilities → ${OUT}: ${out.length} records (${JSON.stringify(typeCount)}) · create ${manifest._create.length} · retype ${manifest._retype.length} · delete ${manifest._delete.length} · unchanged ${out.length - manifest._create.length - manifest._retype.length}`);

// ── _source mirror ───────────────────────────────────────────────────────────────────────────────────────
if (WRITE) {
  const safe = s => String(s).replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "item";
  for (const { file } of Object.values(lib)) fs.rmSync(path.join(LIB, file), { force: true });
  fs.mkdirSync(LIB, { recursive: true });
  for (const d of out) fs.writeFileSync(path.join(LIB, `${safe(d.name)}_${d._id}.json`), JSON.stringify({ ...d, _key: `!items!${d._id}` }, null, 2) + "\n");
  console.log(`_source mirror rewritten: ${LIB} (${out.length} files)`);
}

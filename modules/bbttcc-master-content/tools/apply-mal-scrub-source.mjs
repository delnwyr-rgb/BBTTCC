// Apply the Mal scrub + item glances to packs/_source/items (repo canon). Usage: node apply-mal-scrub-source.mjs [--write]
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import { scrubItemUpdate } from "./strip-mal.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, "../packs/_source/items");
const glances = JSON.parse(fs.readFileSync(path.join(here, "item-glances-2026-11-12.json"), "utf8"));
const malNames = new Set(JSON.parse(fs.readFileSync(path.join(here, "mal-voiced-items-2026-11-12.json"), "utf8")));
const TYPES = new Set(["weapon", "armor", "gear", "power"]);   // powers too (Dave 11-12: "scrub those too")
const write = process.argv.includes("--write");
let n = 0; const seen = new Set();
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json"))) {
  const p = path.join(dir, f); const d = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!TYPES.has(d.type)) continue;
  const upd = scrubItemUpdate(d, { malVoiced: malNames.has(d.name), clearFlavor: d.type === "power", glance: glances[d.name] });
  if (glances[d.name]) seen.add(d.name);
  if (!upd) continue;
  n++; console.log(`${d.name}: ${Object.keys(upd).join(", ")}`);
  if (write) {
    for (const [k, v] of Object.entries(upd)) { const ks = k.split("."); let o = d; for (const x of ks.slice(0, -1)) o = (o[x] ??= {}); o[ks.at(-1)] = v; }
    fs.writeFileSync(p, JSON.stringify(d, null, 2) + "\n");
  }
}
const unused = Object.keys(glances).filter(k => !seen.has(k));
console.log(`${n} items ${write ? "written" : "would change"}; glances unmatched: ${unused.length}`, unused);

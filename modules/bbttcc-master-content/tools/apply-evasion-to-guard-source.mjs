// node apply-evasion-to-guard-source.mjs [--write] — repo pass over every packs/_source/* folder (items + items embedded on
// actor docs); see evasion-to-guard.mjs.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { evasionToGuardUpdate } from "./evasion-to-guard.mjs";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packs/_source");
const write = process.argv.includes("--write");
const setPath = (o, p, v) => { const k = p.split("."); let c = o; for (const s of k.slice(0, -1)) c = c[s] ??= {}; c[k.at(-1)] = v; };
let n = 0, files = 0;
for (const sub of fs.readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory())) {
  const dir = path.join(root, sub.name);
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json"))) {
    const fp = path.join(dir, f); const raw = fs.readFileSync(fp, "utf8"); let d; try { d = JSON.parse(raw); } catch { continue; }
    let touched = false;
    const docs = [d, ...(Array.isArray(d.items) ? d.items : [])];
    for (const doc of docs) {
      if (!doc || typeof doc !== "object") continue;
      const u = evasionToGuardUpdate(doc); if (!u) continue;
      n++; touched = true; console.log(`${sub.name}/${d.name}${doc !== d ? ` › ${doc.name}` : ""}: ${Object.keys(u).map(k => k.split(".").slice(-2).join(".")).join(", ")}`);
      if (write) for (const [p, v] of Object.entries(u)) setPath(doc, p, v);
    }
    if (touched) { files++; if (write) fs.writeFileSync(fp, JSON.stringify(d, null, 2) + (raw.endsWith("\n") ? "\n" : "")); }
  }
}
console.log(`${n} doc(s) in ${files} file(s) ${write ? "written" : "would change (dry run)"}`);

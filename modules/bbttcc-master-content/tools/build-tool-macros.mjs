#!/usr/bin/env node
/* build-tool-macros.mjs — corral the tool macros ("Macro Madness", owner ask 2026-10-07) into ONE compendium.
 * Usage (repo root): node modules/bbttcc-master-content/tools/build-tool-macros.mjs
 *   → tools/seed-tool-macros-<date>.macro.js [GM, DRY_RUN]: creates one STUB Macro per tool file in the pack
 *     bbttcc-master-content.tool-macros (declared in module.json, type Macro), filed in family folders. A stub never
 *     embeds the tool: at run time it FETCHES the deployed file (so the compendium never goes stale), shows the file's
 *     header, and offers Dry run / APPLY (flips `const DRY_RUN`) or Run, then executes it exactly as a pasted macro would
 *     (AsyncFunction with speaker/actor/token/character/scope/args). The seed also files the world's loose macros into
 *     folders (FILE_WORLD_MACROS, non-destructive — moves only).
 *   → tools/TOOL_MACROS.md: the human index (family · name · gate · purpose · path).
 * Scans every bbttcc module's tools dir (.macro.js; master-content also .console.js) and macros dir (.js).
 */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../.."), MODS = path.join(ROOT, "modules");
const STAMP = "2026-10-07", OUT = path.join(HERE, `seed-tool-macros-${STAMP}.macro.js`), INDEX = path.join(HERE, "TOOL_MACROS.md");
const files = [];
for (const mod of fs.readdirSync(MODS).filter(m => m.startsWith("bbttcc-")).sort()) {
  for (const sub of ["tools", "macros"]) {
    const d = path.join(MODS, mod, sub); if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).sort()) {
      const ok = sub === "macros" ? f.endsWith(".js") : (f.endsWith(".macro.js") || (mod === "bbttcc-master-content" && f.endsWith(".console.js")));
      if (ok) files.push({ mod, rel: `modules/${mod}/${sub}/${f}`, base: f.replace(/\.(macro|console)?\.?js$/, "").replace(/\.macro$/, ""), file: path.join(d, f) });
    }
  }
}
const FAMILY = [
  [/^(audit|probe|dump|find|extract|surface|price-audit|sync-maneuver-tags|.*static-audit)/, "🔍 Audits (read-only)"],
  [/^(npc-pack-pass|regimen-pass|tune-bestiary-\d|seed-(bestiary-slots|named-statblocks|item-ladder)-\d|restamp-npcs-pack-embedded|append-per-use-callouts)/, "📜 Passes (generated, dated)"],
  [/^(crash-test|steward-gauntlet|.*-gauntlet-|tableau|courtly-secret-forge|mark-harvest-node|create-.*-demo|start-chase|dive-here|setup-underwater)/, "🎲 Play & Test"],
  [/^(animate|fix-aa|repair-aa|audit-aa)/, "🎞 Animations"],
  [/^(seed|create|import|setup|compile|author|load-|world-overview)/, "🌱 Seeders"],
  [/./, "🛠 Repairs & Stamps"]
];
const esc = s => String(s).replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
const entries = files.map(({ mod, rel, base, file }) => {
  const src = fs.readFileSync(file, "utf8");
  const dry = /const\s+DRY_RUN\s*=\s*(true|false)/.exec(src)?.[1] ?? null;
  const readOnly = /READ-ONLY|read-only|Read-only|Inspection-only|changes nothing|never writes/.test(src.slice(0, 1500));
  // header = the leading comment block, flattened
  const head = (src.match(/^(?:\s*(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*\n))+/)?.[0] ?? "").replace(/\/\*+|\*+\/|^\s*\*\s?|^\s*\/\/\s?/gm, "").replace(/[─═]{6,}/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 1800);
  const purpose = (head.split("\n").map(l => l.trim()).filter(l => l && !/^(usage|paste|run in|what:|where:)/i.test(l))[0] || base).slice(0, 160);
  const family = mod === "bbttcc-master-content" ? FAMILY.find(([re]) => re.test(base))[1] : `📦 ${mod.replace("bbttcc-", "")}`;
  const gate = readOnly && !dry ? "👁" : dry ? "🧪" : "⚠";
  return { mod, rel, base, family, gate, dry, readOnly, purpose, head };
});
const stub = (e) => `// ${e.base} — stub from "Bad Eden: Tool Macros" (GENERATED ${STAMP} by build-tool-macros.mjs). Runs the DEPLOYED file, never a stale copy.
// ${e.gate === "🧪" ? "Gated: the dialog offers Dry run (DRY_RUN=true) or APPLY (DRY_RUN=false)." : e.gate === "👁" ? "Read-only tool." : "⚠ Writes with no DRY_RUN gate — read the header first."}
const PATH = ${JSON.stringify(e.rel)}, NAME = ${JSON.stringify(e.base)};
const HEADER = \`${esc(e.head)}\`;
if (!game.user.isGM) return ui.notifications.error("GM only.");
const res = await fetch(\`/\${PATH}?v=\${Date.now()}\`); if (!res.ok) return ui.notifications.error(\`\${NAME}: \${PATH} not deployed (\${res.status})\`);
const src = await res.text();
const hasDry = /const\\s+DRY_RUN\\s*=\\s*(true|false)/.test(src);
const content = \`<p style="font-size:.8rem;opacity:.8">\${foundry.utils.escapeHTML(PATH)}</p><pre style="white-space:pre-wrap;font-size:.74rem;max-height:45vh;overflow:auto;border:1px solid #444;padding:.4rem">\${foundry.utils.escapeHTML(HEADER)}</pre>\`;
const buttons = hasDry
  ? [{ action: "dry", label: "🧪 Dry run", default: true }, { action: "apply", label: "✍ APPLY (writes)" }, { action: "cancel", label: "Cancel" }]
  : [{ action: "run", label: "▶ Run", default: true }, { action: "cancel", label: "Cancel" }];
const D2 = foundry.applications?.api?.DialogV2;
const choice = D2 ? await D2.wait({ window: { title: NAME }, content, buttons: buttons.map(b => ({ ...b, callback: () => b.action })), rejectClose: false })
  : await new Promise(r => new Dialog({ title: NAME, content, buttons: Object.fromEntries(buttons.map(b => [b.action, { label: b.label, callback: () => r(b.action) }])), close: () => r(null) }).render(true));
if (!choice || choice === "cancel") return;
const code = choice === "dry" ? src.replace(/const\\s+DRY_RUN\\s*=\\s*(true|false)/, "const DRY_RUN = true")
  : choice === "apply" ? src.replace(/const\\s+DRY_RUN\\s*=\\s*(true|false)/, "const DRY_RUN = false") : src;
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
ui.notifications.info(\`\${NAME}: \${choice === "dry" ? "dry run" : choice === "apply" ? "APPLYING" : "running"} — see console (F12).\`);
const _ctx = ["speaker", "actor", "token", "character", "scope", "args"].map(k => { try { return eval(k); } catch (_e) { return undefined; } });  // v14 macro scope lacks some of these
return new AsyncFunction("speaker", "actor", "token", "character", "scope", "args", code)(..._ctx);`;
const docs = entries.map(e => ({ name: `${e.gate} ${e.base}`, type: "script", img: e.gate === "👁" ? "icons/svg/eye.svg" : e.gate === "🧪" ? "icons/svg/chest.svg" : "icons/svg/hazard.svg", scope: "global", command: stub(e), folder: e.family, flags: { "bbttcc-master-content": { tool: { path: e.rel, module: e.mod, gate: e.gate, dryDefault: e.dry, generated: STAMP } } } }));
// world macro filing (the owner's loose macros → folders; moves only)
const WORLD_FILING = [
  [/reset|setup|campaign reset|wizard wizard/i, "🛠 Setup & Reset"],
  [/player view|fog/i, "👁 Player View"],
  [/onboarding/i, "🎓 Onboarding"],
  [/tableau|overlay|glow|burst|hex|reveal/i, "🎭 Scene, Hex & FX"],
  [/./, "🎲 Play Tools"]
];
fs.writeFileSync(OUT, `/* ${path.basename(OUT)} — TOOL MACROS COMPENDIUM seed (GENERATED ${STAMP} by build-tool-macros.mjs — do not hand-edit; rebuild).
 * Paste into a GM macro on EMBER and run. DRY_RUN = true prints the plan; false creates. Idempotent: existing names are skipped.
 * What: ${docs.length} stub macros (one per tool file across ${new Set(entries.map(e => e.mod)).size} modules) into bbttcc-master-content.tool-macros, filed by family;
 *       FILE_WORLD_MACROS = true also moves the world's loose Macro documents into folders (nothing deleted, nothing renamed).
 */
const DRY_RUN = true;
const FILE_WORLD_MACROS = true;
const UPDATE_EXISTING = true;   // refresh stubs whose command changed (generator edits)
const PACK_ID = "bbttcc-master-content.tool-macros";
const DOCS = ${JSON.stringify(docs)};
const WORLD_FILING = ${JSON.stringify(WORLD_FILING.map(([re, f]) => [re.source, re.flags, f]))};
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const pack = game.packs.get(PACK_ID); if (!pack) return ui.notifications.error(\`No pack \${PACK_ID} — module.json must declare it (then restart + hard reload).\`);
  const index = await pack.getIndex(); const have = new Set(index.map(i => i.name));
  const log = []; let created = 0, skipped = 0, filed = 0, updated = 0;
  const wasLocked = pack.locked;
  try {
    if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
    const folders = {}; const folderId = async (name) => { if (folders[name] !== undefined) return folders[name]; let f = pack.folders.find(x => x.name === name); if (!f && !DRY_RUN) f = await Folder.create({ name, type: "Macro" }, { pack: pack.collection }); return (folders[name] = f?.id ?? null); };
    const byFolder = {}; for (const d of DOCS) (byFolder[d.folder] ??= []).push(d);
    for (const [folder, list] of Object.entries(byFolder)) {
      const fid = await folderId(folder);
      const fresh = list.filter(d => { if (have.has(d.name)) { skipped++; return false; } return true; });
      for (const d of fresh) log.push(\`\${DRY_RUN ? "·" : "✔"} [\${folder}] \${d.name}\`);
      if (!DRY_RUN && fresh.length) await Macro.createDocuments(fresh.map(d => ({ ...d, folder: fid })), { pack: pack.collection });
      created += fresh.length;
      if (UPDATE_EXISTING) {                       // re-seed after a generator change: refresh the stub command/flags in place
        const stale = [];
        for (const d of list.filter(d => have.has(d.name))) { const i = index.find(x => x.name === d.name); const doc = await pack.getDocument(i._id); if (doc.command !== d.command) stale.push({ _id: doc.id, command: d.command, flags: d.flags, img: d.img }); }
        if (stale.length) { log.push(\`\${DRY_RUN ? "·" : "✔"} [\${folder}] \${stale.length} stub(s) updated\`); if (!DRY_RUN) await Macro.updateDocuments(stale, { pack: pack.collection }); updated += stale.length; }
      }
    }
    if (FILE_WORLD_MACROS) {
      const wf = {}; const wfId = async (name) => { if (wf[name] !== undefined) return wf[name]; let f = game.folders.find(x => x.type === "Macro" && x.name === name); if (!f && !DRY_RUN) f = await Folder.create({ name, type: "Macro" }); return (wf[name] = f?.id ?? null); };
      for (const m of game.macros.contents) {
        if (m.folder) continue;
        const rule = WORLD_FILING.find(([s, fl]) => new RegExp(s, fl).test(m.name)); const target = rule?.[2]; if (!target) continue;
        log.push(\`\${DRY_RUN ? "·" : "✔"} world: "\${m.name}" → \${target}\`);
        if (!DRY_RUN) { const fid = await wfId(target); if (fid) await m.update({ folder: fid }); }
        filed++;
      }
    }
  } finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  console.log(\`[seed-tool-macros] \${DRY_RUN ? "DRY RUN" : "APPLIED"} — \${created} stub(s) created, \${updated} updated, \${skipped} skipped, \${filed} world macro(s) filed\\n\` + log.join("\\n"));
  ui.notifications.info(\`seed-tool-macros \${DRY_RUN ? "dry run" : "applied"}: \${created} stubs, \${skipped} skipped, \${filed} world macros filed — see console (F12).\`);
})();
`);
// human index
const byFam = {}; for (const e of entries) (byFam[e.family] ??= []).push(e);
let md = `# Bad Eden: Tool Macros — index (GENERATED ${STAMP} by build-tool-macros.mjs)\n\nOne compendium (\`bbttcc-master-content.tool-macros\`) holds a STUB per tool file. A stub fetches the deployed file at run time, shows its header and offers **🧪 Dry run / ✍ APPLY** (tools with a \`DRY_RUN\` constant) or **▶ Run**. Gates: 🧪 = has a DRY_RUN switch · 👁 = read-only · ⚠ = writes with no dry-run gate (read the header first).\n\n`;
for (const fam of Object.keys(byFam).sort()) { md += `## ${fam} (${byFam[fam].length})\n\n| gate | tool | DRY_RUN default | purpose | path |\n|---|---|---|---|---|\n`; for (const e of byFam[fam]) md += `| ${e.gate} | \`${e.base}\` | ${e.dry ?? "—"} | ${e.purpose.replace(/\|/g, "\\|")} | \`${e.rel}\` |\n`; md += "\n"; }
fs.writeFileSync(INDEX, md);
console.log(`build-tool-macros: ${docs.length} stubs across ${Object.keys(byFam).length} folders → ${OUT}\n  index → ${INDEX}`);
for (const fam of Object.keys(byFam).sort()) console.log(`  ${fam.padEnd(32)} ${byFam[fam].length}  (🧪 ${byFam[fam].filter(e => e.gate === "🧪").length} · 👁 ${byFam[fam].filter(e => e.gate === "👁").length} · ⚠ ${byFam[fam].filter(e => e.gate === "⚠").length})`);

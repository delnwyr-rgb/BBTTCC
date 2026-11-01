#!/usr/bin/env node
/* lint-units.js — repo sweep for the "marks everywhere" ruling (2026-09-06). Node CLI, not a Foundry macro.
 * `bin/ft-lint-units` symlinks here. Exit 1 on any hit.
 *
 * Rules (each hit prints file:line — fix the code or, for a deliberate rule-unit derivation, tag the line
 * with a comment containing "per 10 marks" or "rule unit"):
 *   U1  a second literal for the OP↔marks ratio — only rfi-pricing.js (authority) and the op-engine mirror may say `= 10`
 *   U2  a reader that still falls back to a literal 10 (`OP_TO_MARKS ?? 10`, `|| 10`)
 *   U3  ÷10 or ×10 on a line that talks about OP/marks/opBank/opDeltas (a unit conversion in disguise)
 *   U4  retired names: formatMarksAsOP, formatMarksAsOPNumber, opToMarks
 *   U5  a rendered OP quantity: `${x} OP`, `N OP`, `+N OP` in strings/templates (OP is a NAME, never a number's unit)
 *   U6  the raid catalogs' JSON rules text (same test as U5)
 *   U7  the 5E content lanes' JSON (modules/bad-eden-5e/content/**) — every string, tags stripped, same test as U5/U6,
 *       plus "Operations Points" anywhere and worded quantities ("one spent OP", "1 fewer OP")
 */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../../..");
const ROOTS = ["systems/fourththing", "modules"].map(r => path.join(ROOT, r));
const SKIP = /\/(tools|packs|archive|node_modules|lang)\/|\.backup|surge-powers\//;
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (SKIP.test(p + "/")) continue; if (e.isDirectory()) walk(p); else if (/\.(js|mjs|hbs)$/.test(e.name)) files.push(p); } })(ROOTS[0]); (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (SKIP.test(p + "/")) continue; if (e.isDirectory()) walk(p); else if (/\.(js|mjs|hbs)$/.test(e.name)) files.push(p); } })(ROOTS[1]);
const AUTHORITY = /rfi-pricing\.js$/, MIRROR = /op-engine\.js$/;
const OK = /per 10 marks|rule unit|unit-ok/i;
const hits = [];
const CHANNEL_OP = /(\b\d+|\+\d+|−\d+)\s+(Violence|Nonlethal|Intrigue|Economy|Soft ?[Pp]ower|Diplomacy|Logistics|Culture|Faith)\s+OP\b/;
for (const f of files) {
  const rel = path.relative(ROOT, f);
  fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    const code = line.replace(/^\s*(\/\/|\*).*$/, "").replace(/\/\/.*$/, "");   // drop full-line + trailing comments
    if (!code.trim()) return;
    const tagged = OK.test(line);
    const rec = (rule, msg) => hits.push({ rule, file: rel, line: i + 1, msg, text: line.trim().slice(0, 140) });
    if (/(OP_TO_MARKS|MARKS_PER_OP[A-Z_]*)\s*=\s*10\b/.test(code) && !AUTHORITY.test(f) && !MIRROR.test(f)) rec("U1", "second literal for the ratio");
    if (/(OP_TO_MARKS|MARKS_PER_OP)[^;]*(\?\?|\|\|)\s*10\b/.test(code)) rec("U2", "literal fallback for the ratio");
    if (/(\/|\*)\s*10\b/.test(code) && /\b(OP|marks|Marks|opBank|opDeltas|opCost|op[A-Z]\w*)\b/.test(code) && !tagged && !AUTHORITY.test(f) && !MIRROR.test(f)) rec("U3", "÷10/×10 beside an OP/marks term (unit conversion?)");
    if (/\b(formatMarksAsOP(Number)?|opToMarks)\b/.test(code)) rec("U4", "retired op-engine name");
    if (/(\$\{[^}]+\}|\b\d+|\+\d+|−\d+)\s*OP\b(?![_A-Za-z])(?!\s+[A-Z][a-z])/.test(code) && !/OP\s*(=|\()/.test(code) && !tagged) rec("U5", "rendered OP quantity — quantities are marks");
    // 2026-10-28: "1 Economy OP per turn" / "+1 Faith OP" — a quantity with the channel between it and OP.
    if (/["'`]/.test(code) && CHANNEL_OP.test(code) && !tagged) rec("U5", "rendered OP quantity (N <Channel> OP) — quantities are marks");
  });
}
// U6 (strategic review #50, 2026-10-28): the raid catalogs' player-facing rules text — JSON, so the .js/.hbs sweep
// above never saw "shaves 15 OP" / "OP income ×1.25". A rendered quantity there is a hit like U5.
for (const rel of ["modules/bbttcc-raid/data/bbttcc_activities_v1_4.json", "modules/bbttcc-raid/data/bbttcc_maneuvers_v1_4.json"]) {
  let rows = []; try { rows = JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); } catch (_e) { continue; }
  for (const r of (Array.isArray(rows) ? rows : [])) {
    const t = String(r?.flags?.bbttcc?.effects?.text || "");
    if (/(\b\d+|\+\d+|−\d+)\s*OP\b(?![_A-Za-z])/.test(t) || CHANNEL_OP.test(t) || /\bOP (income|pools?|bank|is refunded)\b/.test(t)) hits.push({ rule: "U6", file: rel, line: 0, msg: `catalog text renders OP — "${r.name}"`, text: t.slice(0, 140) });
  }
}
// U7 (D&D port review C72, 2026-10-31): the 5E content lanes are JSON, so the ancestry cards rendered "+2 Faith OP" and
// "costs 1 fewer OP" onto the D&D sheet while this sweep read 0. Every string under modules/bad-eden-5e/content/ is scanned
// the way U5/U6 scan code (HTML tags stripped); "Operations Points" is a hit anywhere — OP is a name, quantities are marks.
const CONTENT_ROOT = path.join(ROOT, "modules/bad-eden-5e/content");
const contentFiles = [];
(function walk(d) { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.json$/.test(e.name)) contentFiles.push(p); } })(CONTENT_ROOT);
const CONTENT_OP = [
  /(\b\d+|\+\d+|−\d+|-\d+)\s*OP\b(?![_A-Za-z])/,
  CHANNEL_OP,
  /\bOP (income|pools?|bank|is refunded|budgets?|lines?|chits?|change|trigger|costs?|edge)\b/i,
  /\b(fewer|less|spent|spend|spends|regain|one|two|three|an?) (spent |extra |additional )?(Bad Eden )?OP\b(?! (category|categories|type|types|line|lines|channel|channels)\b)/i,   // "one OP category" is the name, not a quantity
  /\bOperations? Points?\b/i
];
for (const f of contentFiles) {
  const rel = path.relative(ROOT, f);
  let doc; try { doc = JSON.parse(fs.readFileSync(f, "utf8")); } catch (_e) { continue; }
  const seen = new Set();
  (function scan(v, label) {
    if (typeof v === "string") {
      const t = v.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      for (const re of CONTENT_OP) {
        const m = t.match(re); if (!m) continue;
        const k = `${label}|${m[0]}`; if (seen.has(k)) break; seen.add(k);
        hits.push({ rule: "U7", file: rel, line: 0, msg: `content text renders OP — ${label}`, text: t.slice(Math.max(0, m.index - 60), m.index + 80) });
        break;
      }
    } else if (Array.isArray(v)) v.forEach(x => scan(x, label));
    else if (v && typeof v === "object") { const name = typeof v.name === "string" ? v.name : label; for (const [k, x] of Object.entries(v)) scan(x, k === "name" ? label : name); }
  })(doc, path.basename(f, ".json"));
}
hits.sort((a, b) => a.rule.localeCompare(b.rule) || a.file.localeCompare(b.file) || a.line - b.line);
const byRule = {}; for (const h of hits) byRule[h.rule] = (byRule[h.rule] || 0) + 1;
console.log(`lint-units — ${files.length} files · ${hits.length} hit(s) ${JSON.stringify(byRule)}`);
for (const h of hits) console.log(`  ${h.rule} ${h.file}:${h.line}  ${h.msg}\n       ${h.text}`);
process.exit(hits.length ? 1 : 0);

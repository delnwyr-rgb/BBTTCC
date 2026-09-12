#!/usr/bin/env node
/* lint-pending.js — pending-key registry sweep (fix-the-boat item 3, 2026-09-12). Node CLI; `bin/ft-lint-pending`.
 * Reads modules/bbttcc-core/pending-keys.json. Exit 1 on:
 *   P1  a WRITER of a queued key that is not declared (pend.X = …, pending.X = …, nextTurn.X = …, bonuses.X …)
 *   P2  a writer of a key declared `retired`
 *   P3  a declared `live` consumer whose file or symbol no longer exists (registry rot)
 * Reports (exit 0) `unwired` keys as visible debt. Tag a deliberate exception with "pending-ok".
 */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../../..");
const REG = JSON.parse(fs.readFileSync(path.join(ROOT, "modules/bbttcc-core/pending-keys.json"), "utf8"));
const SKIP = /\/(tools|packs|archive|node_modules|lang|templates)\/|\.backup|\.mjs$/;
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (SKIP.test(p)) continue; if (e.isDirectory()) walk(p); else if (/\.js$/.test(e.name)) files.push(p); } })(path.join(ROOT, "modules"));
const hexKeys = REG["hex.turn.pending"], facPend = REG["faction.turn.pending"], nt = REG["faction.bonuses.nextTurn"], bon = REG["faction.bonuses"];
const declared = (k) => hexKeys[k] || facPend[k] || null;
const hits = [], debt = [];
const IGNORE = new Set(["ok", "repairs", "nextRound"]);   // container / return-object names, not keys
for (const f of files) {
  const rel = path.relative(ROOT, f);
  fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    const code = line.replace(/^\s*(\/\/|\*).*$/, "").replace(/\/\/.*$/, "");
    if (!code.trim() || /pending-ok/.test(line)) return;
    const rec = (rule, msg) => hits.push({ rule, file: rel, line: i + 1, msg, text: line.trim().slice(0, 130) });
    if (/intents\.pending\./.test(code)) return;   // raid-console round meta (r.meta.intents.pending.*) — scene-intent bookkeeping, not a queued turn effect
    for (const m of code.matchAll(/\bpend(?:ing)?\.(repairs\.)?([A-Za-z]+)\s*(?:[-+]?=[^=]|\.push\()/g)) {
      const key = (m[1] ? "repairs." : "") + m[2]; if (IGNORE.has(m[2])) continue;
      const d = declared(key);
      if (!d) rec("P1", `undeclared queued key '${key}' — add it to pending-keys.json with its consumer`);
      else if (d.status === "retired") rec("P2", `writer of retired key '${key}' — ${d.note || "remove the write"}`);
    }
    for (const m of code.matchAll(/nextTurn\.([A-Za-z]+)\s*(?:[-+]?=[^=]|\+\+)/g)) { const d = nt[m[1]]; if (!d) rec("P1", `undeclared bonuses.nextTurn.${m[1]}`); else if (d.status === "retired") rec("P2", `writer of retired nextTurn.${m[1]}`); }
    for (const m of code.matchAll(/nextTurn\.([A-Za-z]+)`\]/g)) { const d = nt[m[1]]; if (!d) rec("P1", `undeclared bonuses.nextTurn.${m[1]} (update path)`); }
    for (const m of code.matchAll(/bonuses\.(regenPlan|capBump|truce|scheduled|nextRaid)\b/g)) { if (!bon[m[1]] && !bon[m[1] + ".defenseBonus"]) rec("P1", `undeclared bonuses.${m[1]}`); }
    if (/turn\.pending\.nextTurn|pend\.nextTurn\s*=/.test(code)) rec("P2", "faction turn.pending.nextTurn is retired — write bonuses.nextTurn");
  });
}
// P3 — every live consumer must exist
for (const group of [hexKeys, facPend, nt, bon]) for (const [k, d] of Object.entries(group)) {
  if (d.status === "unwired") debt.push(`${k}: ${d.note || "no consumer"}`);
  if (d.status !== "live" || !d.consumer) continue;
  const [file, sym] = String(d.consumer).split("#"); const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) { hits.push({ rule: "P3", file: "pending-keys.json", line: 0, msg: `consumer file missing for '${k}': ${file}`, text: "" }); continue; }
  if (sym && !fs.readFileSync(p, "utf8").includes(sym)) hits.push({ rule: "P3", file: "pending-keys.json", line: 0, msg: `consumer symbol '${sym}' not found in ${file} for '${k}'`, text: "" });
}
hits.sort((a, b) => a.rule.localeCompare(b.rule) || a.file.localeCompare(b.file) || a.line - b.line);
const byRule = {}; for (const h of hits) byRule[h.rule] = (byRule[h.rule] || 0) + 1;
console.log(`lint-pending — ${files.length} files · ${hits.length} hit(s) ${JSON.stringify(byRule)} · ${debt.length} unwired (declared debt)`);
for (const h of hits) console.log(`  ${h.rule} ${h.file}:${h.line}  ${h.msg}${h.text ? `\n       ${h.text}` : ""}`);
for (const d of debt) console.log(`  ~  unwired: ${d}`);
process.exit(hits.length ? 1 : 0);

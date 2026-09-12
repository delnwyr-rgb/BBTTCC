#!/usr/bin/env node
/* lint-facts.js — "one authority per fact" sweep (2026-09-12, fix-the-boat item 1). Node CLI; `bin/ft-lint-facts`.
 * Exit 1 on any hit. Tag a deliberate exception with a comment containing "facts-ok".
 *
 *  F1  the tier cap band literal [50, 70, 90, 110, 130] anywhere but op-engine.js (facts.faction owns it)
 *  F2  tier re-derived from flags (`tierFromBadge`) anywhere but op-engine.js — use facts.faction.tier
 *  F3  hex yield read from the cache (`tf.resources`, `.resources ||`) in engine code — use facts.hex.resources
 *      (allowed: territory main.js = the authority; writers `resources =`/`resources:`; scene launcher writer)
 *  F4  hex loyalty read from `mods.loyalty` / registry loyalty numbers outside territory main.js — use facts.hex.loyaltyScore
 *      (allowed: writers `mods.loyalty =`/`+=`)
 *  F5  retired route counters: `Trade Routes:` war-log parse, deriveTradeRouteCountFrom*, nearest-six route guesses
 */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../../..");
const ROOTS = ["modules"].map(r => path.join(ROOT, r));
const SKIP = /\/(tools|packs|archive|node_modules|lang|templates)\/|\.backup|\.mjs$/;
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (SKIP.test(p)) continue; if (e.isDirectory()) walk(p); else if (/\.js$/.test(e.name)) files.push(p); } })(ROOTS[0]);
const OPENGINE = /bbttcc-factions\/scripts\/op-engine\.js$/, TERRMAIN = /bbttcc-territory\/scripts\/main\.js$/, LAUNCHER = /bbttcc-encounters\/scripts\/scene\.launcher\.js$/;
const OK = /facts-ok/;
const hits = [];
for (const f of files) {
  const rel = path.relative(ROOT, f);
  fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    const code = line.replace(/^\s*(\/\/|\*).*$/, "").replace(/\/\/.*$/, "");
    if (!code.trim() || OK.test(line)) return;
    const rec = (rule, msg) => hits.push({ rule, file: rel, line: i + 1, msg, text: line.trim().slice(0, 140) });
    if (/\[\s*50\s*,\s*70\s*,\s*90\s*,\s*110\s*,\s*130\s*\]/.test(code) && !OPENGINE.test(f)) rec("F1", "tier cap band literal — import TIER_CAP_BAND_MARKS or use facts.faction.capBand");
    if (/tierFromBadge/.test(code) && !OPENGINE.test(f)) rec("F2", "tier re-derived from flags — use facts.faction.tier");
    if (/\btf\??\.resources\b|\.resources\s*\|\|/.test(code) && !/resources\s*[:=]|hexFlags\.resources\s*!==|\bf\.resources\s*=/.test(code) && !TERRMAIN.test(f) && !LAUNCHER.test(f)) rec("F3", "hex yield read from the cache — use facts.hex.resources");
    if (/mods\??\.loyalty\b/.test(code) && !/mods\.loyalty\s*(=|\+=|-=)/.test(code) && !TERRMAIN.test(f)) rec("F4", "hex loyalty read from mods.loyalty — use facts.hex.loyalty / loyaltyScore");
    if (/"loyal population"\s*:\s*2\b|"hostile population"\s*:\s*-2\b/.test(code) && !TERRMAIN.test(f)) rec("F4", "modifier loyalty table copied — facts.hex owns HEX_MOD_LOYALTY");
    if (/deriveTradeRouteCountFrom|Trade Routes:\s*\\?s\*\(\\d\+\)|isTradeHubHex\(/.test(code)) rec("F5", "retired route counter — use facts.routes.trade");
  });
}
hits.sort((a, b) => a.rule.localeCompare(b.rule) || a.file.localeCompare(b.file) || a.line - b.line);
const byRule = {}; for (const h of hits) byRule[h.rule] = (byRule[h.rule] || 0) + 1;
console.log(`lint-facts — ${files.length} files · ${hits.length} hit(s) ${JSON.stringify(byRule)}`);
for (const h of hits) console.log(`  ${h.rule} ${h.file}:${h.line}  ${h.msg}\n       ${h.text}`);
process.exit(hits.length ? 1 : 0);

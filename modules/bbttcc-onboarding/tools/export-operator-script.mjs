#!/usr/bin/env node
/* export-operator-script.mjs — the OPERATOR's full script as one markdown file, for read-throughs and voice recording
 * (Dave, 2026-10-19: "does that script live somewhere, so I can do a voice recording?").
 *
 * Static extraction — no Foundry needed. Reads the onboarding module's source and pulls:
 *   • every `speak(...)` line in beats.js / incarnation-forge.js / director.js, grouped by beat, in run order
 *     (the Alpha induction first, then the beats the Alpha Cut leaves out, marked Beta-only)
 *   • every tour: intro, outro, each step's title + card text + speak line (tour-defs.js)
 * Template holes `${expr}` print as ⟨expr⟩ so the reader knows a name goes there. Conditionals print every branch, " / " apart.
 *
 *   node modules/bbttcc-onboarding/tools/export-operator-script.mjs [--out modules/bbttcc-onboarding/OPERATOR_SCRIPT.md]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MOD = path.join(ROOT, "modules/bbttcc-onboarding");
const S = (f) => fs.readFileSync(path.join(MOD, "scripts", f), "utf8");
const argv = process.argv.slice(2);
const out = argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : path.join(MOD, "OPERATOR_SCRIPT.md");

/* ── string-literal reader ─────────────────────────────────────────── */
function readLiteral(src, i) {
  // returns { text, end } for a literal starting at src[i] (quote), or null
  const q = src[i];
  if (q !== '"' && q !== "'" && q !== "`") return null;
  let s = "", j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === "\\") { const n = src[j + 1]; s += n === "n" ? "\n" : n === "t" ? " " : n; j += 2; continue; }
    if (c === q) return { text: s, end: j + 1 };
    if (q === "`" && c === "$" && src[j + 1] === "{") {
      let depth = 1, k = j + 2;
      while (k < src.length && depth) { if (src[k] === "{") depth++; else if (src[k] === "}") depth--; k++; }
      const expr = src.slice(j + 2, k - 1).trim();
      s += `⟨${holeName(expr)}⟩`; j = k; continue;
    }
    s += c; j++;
  }
  return null;
}
function holeName(expr) {
  const m = expr.match(/(?:ctx\.)?(?:steward|faction|rig|created|picked|f|a)\??\.name|label|name/);
  if (/steward/.test(expr)) return "steward name";
  if (/faction|\bf\.name|\bf\?\.name/.test(expr)) return "Domain name";
  if (/rig/.test(expr)) return "rig name";
  if (/created\.name|picked\.name/.test(expr)) return "name";
  return expr.length > 28 ? expr.slice(0, 26) + "…" : expr;
}
/* every literal inside a balanced-paren argument span, joined */
function readArgSpan(src, open) {
  let depth = 0, j = open;
  for (; j < src.length; j++) {
    const c = src[j];
    if (c === '"' || c === "'" || c === "`") { const L = readLiteral(src, j); if (L) { j = L.end - 1; continue; } }
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) break; }
  }
  return src.slice(open + 1, j);
}
function literalsIn(span) {
  const outL = []; let j = 0;
  while (j < span.length) {
    const c = span[j];
    if (c === '"' || c === "'" || c === "`") { const L = readLiteral(span, j); if (L) { if (L.text.trim()) outL.push(L.text); j = L.end; continue; } }
    j++;
  }
  return outL;
}
function firstArgText(src, open) {
  const span = readArgSpan(src, open);
  // drop the options object (", { audience: ... }") — literals before the top-level comma only
  let depth = 0, cut = span.length;
  for (let j = 0; j < span.length; j++) {
    const c = span[j];
    if (c === '"' || c === "'" || c === "`") { const L = readLiteral(span, j); if (L) { j = L.end - 1; continue; } }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) { cut = j; break; }
  }
  const arg = span.slice(0, cut);
  const lits = literalsIn(arg);
  if (!lits.length) return null;
  if (/\?/.test(arg) && lits.length > 1 && !/\+/.test(arg)) return lits.join("  /  ");   // conditional: every branch
  return lits.join("");                                                                   // concatenation
}

/* ── beats ─────────────────────────────────────────────────────────── */
function speakLines(file, { idRx = /^  id: "([a-z_]+)"/m } = {}) {
  const src = S(file); const lines = [];
  const rx = /\b(?:ctx\.)?_?(?:speak|handoff)\(/g; let m;
  while ((m = rx.exec(src))) {
    const open = m.index + m[0].length - 1;
    const text = firstArgText(src, open);
    if (!text) continue;
    const before = src.slice(0, m.index);
    const ids = [...before.matchAll(new RegExp(idRx.source, "gm"))];
    const beat = ids.length ? ids[ids.length - 1][1] : "";
    const line = before.split("\n").length;
    lines.push({ beat, line, text });
  }
  return lines;
}
const directorSrc = S("director.js");
const ALPHA_CUT = new Set((directorSrc.match(/ALPHA_CUT_BEATS = new Set\(\[([^\]]+)\]\)/)?.[1] || "").split(",").map(s => s.trim().replace(/"/g, "")).filter(Boolean));
const beatSrc = S("beats.js");
const beatOrder = [...beatSrc.matchAll(/^  id: "([a-z_]+)",\n  (?:label|title|name): "([^"]*)"/gm)].map(m => ({ id: m[1], label: m[2] }));
const beatLabel = Object.fromEntries(beatOrder.map(b => [b.id, b.label]));
const byBeat = new Map();
for (const l of speakLines("beats.js")) { if (!byBeat.has(l.beat)) byBeat.set(l.beat, []); byBeat.get(l.beat).push(l); }
const forgeLines = speakLines("incarnation-forge.js", { idRx: /^(?!x)x/m }).map(l => ({ ...l, beat: "incarnation" }));
const directorLines = speakLines("director.js", { idRx: /^(?!x)x/m });

/* ── tours ─────────────────────────────────────────────────────────── */
const tourSrc = S("tour-defs.js");
const tourBlocks = [...tourSrc.matchAll(/^const (\w+Tour) = \{/gm)].map((m) => { const close = tourSrc.indexOf("\n};", m.index); return { name: m[1], start: m.index, end: close < 0 ? tourSrc.length : close + 3 }; });   // a tour block ends at its own closing brace, not at the next tour (helpers may sit between)
const regOrder = [...tourSrc.matchAll(/tours\.register\((\w+)\)/g)].map(m => m[1]);
const tours = [];
for (const name of regOrder) {
  const b = tourBlocks.find(t => t.name === name); if (!b) continue;
  const body = tourSrc.slice(b.start, b.end);
  const t = { name, id: "", title: "", audience: "", intro: "", outro: "", steps: [] };
  const keyRx = /(?:^|,)[ \t]*(id|title|text|speak|intro|outro|audience|optional):\s*/gm; let m; let cur = null; let seenTourTitle = false;
  while ((m = keyRx.exec(body))) {
    const key = m[1]; const at = m.index + m[0].length;
    if (key === "optional") continue;
    const L = readLiteral(body, at); if (!L) continue;
    const lineStart = body.lastIndexOf("\n", m.index) + 1; const indent = body.slice(lineStart).match(/^[ \t]*/)[0].length;
    if (indent <= 2) {                         // tour-level
      if (key === "id") t.id = L.text; else if (key === "title") t.title = L.text; else if (key === "audience") t.audience = L.text;
      else if (key === "intro") t.intro = L.text; else if (key === "outro") t.outro = L.text;
      continue;
    }
    if (key === "id") { cur = { id: L.text, title: "", text: "", speak: "" }; t.steps.push(cur); continue; }
    if (!cur) continue;
    if (key === "title") cur.title = L.text; else if (key === "text") cur.text = L.text; else if (key === "speak") cur.speak = L.text;
  }
  tours.push(t);
}

/* Alpha twin of the faction-sheet tour: the Domain-tab steps live in a const beside it (tour-defs.js DOMAIN_TAB_STEPS). */
{
  const m = tourSrc.match(/^const DOMAIN_TAB_STEPS = \[/m);
  if (m) {
    const body = tourSrc.slice(m.index, tourSrc.indexOf("\n];", m.index) + 3);
    const t = { name: "DOMAIN_TAB_STEPS", id: "faction-sheet · Alpha (the Domain tab)", title: "Your Domain — the Domain tab (Alpha player seats)", audience: "player", intro: "", outro: "", steps: [] };
    const keyRx = /(?:^|,)[ \t]*(id|title|text|speak):\s*/gm; let k; let cur = null;
    while ((k = keyRx.exec(body))) {
      const L = readLiteral(body, k.index + k[0].length); if (!L) continue;
      if (k[1] === "id") { cur = { id: L.text, title: "", text: "", speak: "" }; t.steps.push(cur); continue; }
      if (cur) cur[k[1]] = L.text;
    }
    const i = tours.findIndex(x => x.id === "faction-sheet");
    tours.splice(i >= 0 ? i + 1 : tours.length, 0, t);
  }
}

/* ── render ────────────────────────────────────────────────────────── */
const md = [];
const today = new Date().toISOString().slice(0, 10);
md.push(`# The Operator — full script`, ``,
  `*Generated ${today} by \`modules/bbttcc-onboarding/tools/export-operator-script.mjs\` from the module source. Re-run it after any copy change; do not edit this file by hand.*`, ``,
  `The Operator is the glitchy tutorial daemon that narrates onboarding. \`*bzzt*\`, \`—static—\` and em-dash stutters are performance notes: a glitch, a dropped frame, a cough in the signal. ⟨…⟩ marks a name the game fills in at run time (the steward, the Domain, the rig). Lines separated by \`  /  \` are alternatives — the game picks one by situation; record each.`, ``,
  `Every line has an id (e.g. \`meatsuit.03\`, \`tour.raid-console.05\`) so a recording can be keyed to it later.`, ``,
  `---`, ``, `## Part I — The induction (Alpha arc, in run order)`, ``);

const renderBeat = (id, extra = []) => {
  const lines = [...(id === "incarnation" ? forgeLines : []), ...(byBeat.get(id) || [])].sort((a, b) => a.line - b.line);
  if (!lines.length) return;
  md.push(`### ${beatLabel[id] ? `${beatLabel[id]} ` : ""}\`${id}\`${ALPHA_CUT.has(id) ? " — *Beta-only, cut from the Alpha induction*" : ""}`, ``);
  lines.forEach((l, i) => md.push(`**\`${id}.${String(i + 1).padStart(2, "0")}\`** ${l.text.replace(/\n/g, "  \n")}`, ``));
};
for (const b of beatOrder) if (!ALPHA_CUT.has(b.id)) renderBeat(b.id);
md.push(`---`, ``, `## Part II — Beats the Alpha Cut leaves out (Beta worlds)`, ``);
for (const b of beatOrder) if (ALPHA_CUT.has(b.id)) renderBeat(b.id);
for (const id of byBeat.keys()) if (id && !beatOrder.some(b => b.id === id)) renderBeat(id);
if (byBeat.get("")?.length || directorLines.length) {
  md.push(`---`, ``, `## Part III — Operator asides (outside any single beat)`, ``);
  [...(byBeat.get("") || []), ...directorLines].forEach((l, i) => md.push(`**\`aside.${String(i + 1).padStart(2, "0")}\`** ${l.text.replace(/\n/g, "  \n")}`, ``));
}
md.push(`---`, ``, `## Part IV — Interface tours`, ``, `Each tour opens a REAL window and walks its parts. The Operator speaks the intro and outro; the step cards are read by the player (or voiced, if you like).`, ``);
for (const t of tours) {
  md.push(`### ${t.title} \`${t.id}\` — ${t.audience || "player"}`, ``);
  if (t.intro) md.push(`**\`tour.${t.id}.intro\`** ${t.intro}`, ``);
  t.steps.forEach((s, i) => {
    md.push(`**\`tour.${t.id}.${String(i + 1).padStart(2, "0")}\` · ${s.title}**  `, s.text.replace(/\n/g, "  \n"), ``);
    if (s.speak) md.push(`> *Operator:* ${s.speak}`, ``);
  });
  if (t.outro) md.push(`**\`tour.${t.id}.outro\`** ${t.outro}`, ``);
}
fs.writeFileSync(out, md.join("\n"));
const nBeat = [...byBeat.values()].reduce((n, a) => n + a.length, 0) + forgeLines.length + directorLines.length;
const nTour = tours.reduce((n, t) => n + t.steps.length + (t.intro ? 1 : 0) + (t.outro ? 1 : 0), 0);
console.log(`wrote ${path.relative(ROOT, out)} — ${nBeat} Operator lines across ${beatOrder.length} beats (${ALPHA_CUT.size} Beta-only), ${tours.length} tours / ${nTour} cards`);

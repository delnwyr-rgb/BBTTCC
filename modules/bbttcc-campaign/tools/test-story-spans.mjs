#!/usr/bin/env node
// test-story-spans.mjs — unit test for _expandStorySpans (scripts/module.js, sliced out between its BEGIN/END markers).
// usage: node modules/bbttcc-campaign/tools/test-story-spans.mjs   (exit 1 on any failure)
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, "..", "scripts", "module.js"), "utf8");
const m = src.match(/\/\/ BEGIN _expandStorySpans[\s\S]*?\n(function _expandStorySpans[\s\S]*?)\n\/\/ END _expandStorySpans/);
if (!m) { console.error("markers not found"); process.exit(1); }
const expand = new Function(m[1] + "; return _expandStorySpans;")();
const on = (set) => (ids) => String(ids).split("|").some(x => set.has(x));
const cases = [
  ["flat yes", "{{#played a}}Y{{else}}N{{/played}}", ["a"], "Y"],
  ["flat no", "{{#played a}}Y{{else}}N{{/played}}", [], "N"],
  ["flat no else", "x{{#played a}}Y{{/played}}z", [], "xz"],
  ["any list", "{{#played a|b|c}}Y{{else}}N{{/played}}", ["c"], "Y"],
  ["mark alias", "{{#mark a}}Y{{else}}N{{/mark}}", ["a"], "Y"],
  ["nested outer true", "{{#played a}}A{{else}}{{#played b}}B{{else}}{{#played c}}C{{else}}O{{/played}}{{/played}}{{/played}}", ["a", "b", "c"], "A"],
  ["nested middle true", "{{#played a}}A{{else}}{{#played b}}B{{else}}{{#played c}}C{{else}}O{{/played}}{{/played}}{{/played}}", ["b"], "B"],
  ["nested inner true", "{{#played a}}A{{else}}{{#played b}}B{{else}}{{#played c}}C{{else}}O{{/played}}{{/played}}{{/played}}", ["c"], "C"],
  ["nested none", "{{#played a}}A{{else}}{{#played b}}B{{else}}{{#played c}}C{{else}}O{{/played}}{{/played}}{{/played}}", [], "O"],
  ["mixed kinds (gully)", "{{#mark a}}R{{else}}{{#played b}}R{{else}}I{{/played}}{{/mark}}", [], "I"],
  ["mixed kinds outer", "{{#mark a}}R{{else}}{{#played b}}R{{else}}I{{/played}}{{/mark}}", ["a"], "R"],
  ["inner inside yes branch", "{{#played a}}[{{#played b}}B{{else}}-{{/played}}]{{else}}N{{/played}}", ["a"], "[-]"],
  ["two siblings", "{{#played a}}1{{/played}}|{{#played b}}2{{/played}}", ["b"], "|2"],
  ["unterminated left alone", "{{#played a}}Y{{else}}N", ["a"], "{{#played a}}Y{{else}}N"],
  ["no spans", "plain {{coalition.hexcount}} text", [], "plain {{coalition.hexcount}} text"],
  ["pike four states: crate", "{{#played i}}P{{else}}{{#played d1|d2|d3}}C{{else}}{{#played v1|v2}}R{{else}}O{{/played}}{{/played}}{{/played}}", ["d2", "v1"], "C"]
];
let fail = 0;
for (const [name, text, set, want] of cases) { const got = expand(text, on(new Set(set))); if (got !== want) { fail++; console.error(`FAIL ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); } }
console.log(fail ? `${fail} failure(s)` : `ok — ${cases.length} cases`); process.exit(fail ? 1 : 0);

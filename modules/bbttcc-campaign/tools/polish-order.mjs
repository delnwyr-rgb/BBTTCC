#!/usr/bin/env node
/* polish-order.mjs — keep the Beat Polish doc in SYSTEM ORDER (2026-10-16, Dave: "the Beat Polish doc is supposed
 * to list the beats in the order the system believes is the correct one").
 *
 *  The order is the campaign's own story scripts (campaign.story.scripts[key]): per script —
 *    ARRIVAL steps' beats → script STEPS' beats (each followed, depth-first, by its routed fail / continuation
 *    beats that sit on no step) → DOORS' beats → AFTER → leftovers (walked from roots, grouped by chapter quest).
 *  Beats belong to a script by `beat.story.quest`. Scripts without a script record (offices, valhaulan_*) keep
 *  a root-walk order.
 *  🪤 2026-10-20: a tab's section headings are the ONLY thing that keeps a script-less quest (the Offices slides)
 *  ahead of a scripted one that shares its tab. If an export has lost its "## Allesh-Gilliam" heading (the 10-20e rebuild
 *  did), the Offices chunks become "foreign" to the merged section and sort to its END. Check the output's first
 *  marker after each rebuild; restore the heading in the input rather than hand-moving chunks. Door-exterior cinematics (`*_exterior`) live in the Encounters tab by town, as the
 *  generator put them.
 *
 *  Usage:
 *    node polish-order.mjs --settings <ember-settings.json> [--actors <actors.json>] \
 *         --md "Act 0-1=t1.md" --md "Act 2 grief towns=t2.md" … --out <dir>   [--report-only] [--live-wins] [--keep id,id]
 *  `ember-settings.json` = { "bbttcc-campaign.campaigns": {...}, "bbttcc-campaign.quests": {...} } (classic-level
 *  dump of the world settings). Each --md is a tab's markdown EXPORT from Claude Docs (the engine's own md-v1).
 *  Writes <out>/<tab>.md (rebuilt, Dave's text untouched, sections reordered, missing beats added) + report.md.
 *  Nothing is published by this tool — the docs API does that (see memory reference_beat_polish_doc_2026_09_30).
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = { md: [], reportOnly: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--settings") opt.settings = args[++i];
  else if (a === "--actors") opt.actors = args[++i];
  else if (a === "--md") opt.md.push(args[++i]);
  else if (a === "--out") opt.out = args[++i];
  else if (a === "--report-only") opt.reportOnly = true;
  else if (a === "--live-wins") opt.liveWins = true;
  else if (a === "--keep") opt.keep = new Set(args[++i].split(",").map(x => x.trim()).filter(Boolean));   // beat ids whose DOC chunk is kept even under --live-wins   // 2026-10-19: every documented beat is re-rendered from live data (the doc's chunk prefix notes are kept); use after a patch has applied the doc's edits
  else { console.error("unknown arg", a); process.exit(2); }
}
if (!opt.settings || !opt.md.length || !opt.out) { console.error("need --settings, --md, --out"); process.exit(2); }

/* ── live data ─────────────────────────────────────────────────────────────── */
const settings = JSON.parse(fs.readFileSync(opt.settings, "utf8"));
const campsAll = settings["bbttcc-campaign.campaigns"]; const camp = Object.values(campsAll)[0];
const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats);
const byId = new Map(beats.map(b => [b.id, b]));
const authoredIndex = new Map(beats.map((b, i) => [b.id, i]));
const registry = settings["bbttcc-campaign.quests"] || {};
const story = camp.story || { quests: {}, scripts: {} };
const scripts = story.scripts || {}; const squests = story.quests || {};
const actors = opt.actors ? JSON.parse(fs.readFileSync(opt.actors, "utf8")) : {};
const keyOf = (b) => String(b?.story?.quest || "").trim();
const questName = (qid) => registry[qid]?.name || squests[qid]?.name || qid || "(no quest)";
const scriptName = (key) => squests[key]?.name || key;
const targetsOf = (b) => {
  const out = [];
  for (const c of (b.choices || [])) { if (c?.next) out.push(c.next); if (c?.failNext) out.push(c.failNext); }
  const o = b.outcomes || {};
  for (const k of ["success", "failure"]) { const v = o[k]; const t = v && typeof v === "object" ? v.next : v; if (typeof t === "string" && t) out.push(t); }
  return out.filter(t => byId.has(t));
};
const incoming = new Map();
for (const b of beats) for (const t of targetsOf(b)) incoming.set(t, (incoming.get(t) || 0) + 1);

/* ── markdown parsing (the export format) ──────────────────────────────────── */
const HEAD = /^#### (.*?) \(([^)]*`[^`]+`[^)]*)\)(.*)$/;   // label (`id`[, `id`…]) — meta; the ×8 "Filed" heading lists eight ids
const GEN_MARK = /^\*\*(Step|Door|Arrival|After|Also in this quest|Also here|Chapter)\b.*\*\*\s*$/;   // markers this tool regenerates (never carried over)
const ANY_MARK = /^\*\*[^*]+\*\*\s*$/;
function parseTab(md) {
  // The engine's export spells edit-fragmented bold as "**So****,**** ****i****n**…" (adjacent bold runs); the
  // toggles cancel pairwise, so "****" is a no-op and "** **" is a plain space — collapse both or they re-import
  // as literal asterisks.
  const lines = md.replace(/\r/g, "").split("\n").map(l => /\*\*\*\*/.test(l) ? l.replace(/\*\*\*\*/g, "").replace(/\*\* \*\*/g, " ") : l);
  const tab = { title: "", preamble: [], sections: [] };
  let i = 0;
  // title (h1) + preamble until first h2
  let sec = null;
  const pushChunk = (sec, chunk) => { if (chunk) sec.chunks.push(chunk); };
  let chunk = null; let pre = tab.preamble;
  for (; i < lines.length; i++) {
    const ln = lines[i];
    if (ln.startsWith("# ") && !tab.title && !sec) { tab.title = ln.slice(2).trim(); continue; }
    if (ln.startsWith("## ")) { pushChunk(sec, chunk); chunk = null; sec = { title: ln.slice(3).trim(), preamble: [], chunks: [] }; tab.sections.push(sec); pre = sec.preamble; continue; }
    const h = ln.match(HEAD);
    if (h) {
      // a marker (or note) directly above the heading belongs to this chunk
      const carry = [];
      const src = chunk ? chunk.body : pre;
      while (src.length && (src[src.length - 1].trim() === "" || ANY_MARK.test(src[src.length - 1]) || /^\*\(.*\)\*$/.test(src[src.length - 1]))) carry.unshift(src.pop());
      pushChunk(sec, chunk);
      const ids = [...h[2].matchAll(/`([^`]+)`/g)].map(m => m[1]).map(x => x.startsWith("_") ? "enc_circuit_riders_filed" + x : x);
      chunk = { heading: ln, label: h[1], ids, id: ids[0], meta: h[3], prefix: carry.filter(l => l.trim() !== ""), body: [] };
      if (!sec) { sec = { title: "", preamble: pre, chunks: [] }; tab.sections.push(sec); pre = sec.preamble; }
      continue;
    }
    (chunk ? chunk.body : pre).push(ln);
  }
  pushChunk(sec, chunk);
  for (const s of tab.sections) for (const c of s.chunks) { while (c.body.length && c.body[c.body.length - 1].trim() === "") c.body.pop(); }
  return tab;
}

/* ── rendering a beat that is not in the doc yet (same shape as the generator) ── */
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
function htmlToMd(html) {
  let s = String(html || "");
  s = s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>\s*<p[^>]*>/gi, "\n\n").replace(/<\/?p[^>]*>/gi, "\n")
       .replace(/<(b|strong)>/gi, "**").replace(/<\/(b|strong)>/gi, "**").replace(/<(i|em)>/gi, "*").replace(/<\/(i|em)>/gi, "*")
       .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");
  return s.split("\n").map(l => l.trimEnd()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
const mdEsc = (s) => String(s).replace(/([_*])/g, "\\$1");   // prose outside code spans, as the export does
function reqText(req) {
  const list = Array.isArray(req) ? req : (req ? [req] : []); const parts = [];
  for (const r of list) {
    if (!r) continue;
    if (r.anyOf) parts.push("hidden until any of " + r.anyOf.map(x => x.beatMark ? `\`${x.beatMark}\`` : JSON.stringify(x)).join(", "));
    else if (r.beatMark) parts.push(r.not ? `hidden once \`${r.beatMark}\` has played` : `hidden until \`${r.beatMark}\``);
    else if (r.flag) parts.push(`needs ${r.flag}${r.gte != null ? " ≥ " + r.gte : ""}${r.eq != null ? " = " + r.eq : ""}`);
    else if (r.questBucket) parts.push(`needs quest ${questName(r.questBucket)} ${r.is || ""}`.trim());
    else parts.push(JSON.stringify(r));
  }
  return parts.join("; ");
}
function goesTo(c) {
  let s = c.next ? `\`${c.next}\`` : "`(stays)`";
  if (c.checkStat) s = `\`${c.next || "(stays)"} · ${c.checkStat} DC ${c.checkDC ?? "?"}${c.failNext ? " · fail → " + c.failNext : ""}\``;
  if (c.secret) s += " · 🤫 secret roll";
  const r = reqText(c.requires); if (r) s += ` (${r})`;
  return s;
}
function renderBeat(b) {
  const metaBits = [b.type || "beat"];
  if (b.hexName) metaBits.push(`hex ${b.hexName}`);
  const sp = b.speakerActorId ? actors[String(b.speakerActorId)] : null; if (sp) metaBits.push(`speaker ${sp}`);
  const out = [`#### ${mdEsc(b.label || b.id)} (\`${b.id}\`) — ${mdEsc(metaBits.join(", "))}`, ""];
  const desc = htmlToMd(b.description); if (desc) { out.push(...desc.split("\n").map(l => /^[|#>]/.test(l) ? l : mdEsc(l))); out.push(""); }
  if (b.memoryText) { out.push(`*Memory: ${mdEsc(b.memoryText)}*`, ""); }
  const choices = (b.choices || []).filter(c => c && (c.label || c.next));
  if (choices.length) {
    out.push("| Choice | Shown after picking | Goes to |", "| --- | --- | --- |");
    for (const c of choices) out.push(`| ${mdEsc(esc(c.label))} | ${mdEsc(esc(c.description))} | ${goesTo(c)} |`);
    out.push("");
  }
  return out;
}

/* ── canonical order of one script's members ───────────────────────────────── */
function walkScript(key, memberIds) {
  const mem = new Set(memberIds); const sc = scripts[key]; const placed = new Set(); const out = [];   // [{marker?, id}]
  const designated = new Set();
  if (sc) {
    for (const st of (sc.arrival?.steps || [])) for (const b of (st.beats || [])) designated.add(b);
    for (const st of (sc.steps || [])) for (const b of (st.beats || [])) designated.add(b);
    for (const d of (sc.doors || [])) for (const b of (d.beats || [])) designated.add(b);
    for (const b of (sc.after || [])) designated.add(b);
  }
  // A beat's routed continuations follow it in choice order. Beats that belong to the SAME step/door/arrival
  // entry may be walked into (so "intro → listen → survey → crew → read → fetch Plumb → tally" reads in menu
  // order); other designated beats wait for their own slot.
  const dfs = (id, marker, allow = EMPTY) => {
    if (!mem.has(id) || placed.has(id)) return;
    placed.add(id); out.push({ id, marker }); marker = undefined;
    for (const t of targetsOf(byId.get(id))) if (mem.has(t) && !placed.has(t) && (!designated.has(t) || allow.has(t))) dfs(t, undefined, allow);
  };
  const EMPTY = new Set();
  if (sc) {
    for (const st of (sc.arrival?.steps || [])) { let m = `**Arrival · ${st.label || st.id}**`; const allow = new Set(st.beats || []); for (const b of (st.beats || [])) { if (mem.has(b) && !placed.has(b)) { dfs(b, m, allow); m = undefined; } } }
    for (const st of (sc.steps || [])) { let m = `**Step · ${st.label || st.id}**`; const allow = new Set(st.beats || []); for (const b of (st.beats || [])) { if (mem.has(b) && !placed.has(b)) { dfs(b, m, allow); m = undefined; } } }
    for (const d of (sc.doors || [])) { let m = `**Door · ${d.label || d.id}**`; const allow = new Set(d.beats || []); for (const b of (d.beats || [])) { if (mem.has(b) && !placed.has(b)) { dfs(b, m, allow); m = undefined; } } }
    { let m = "**After**"; for (const b of (sc.after || [])) { if (mem.has(b) && !placed.has(b)) { dfs(b, m); m = undefined; } } }
  }
  // leftovers: grouped by registry quest (chapters first keep the main quest's registry id first), roots first
  const rest = memberIds.filter(id => !placed.has(id));
  const mainReg = squests[key]?.registryId || "";
  const groups = new Map();
  for (const id of rest) { const q = byId.get(id)?.questId || ""; if (!groups.has(q)) groups.set(q, []); groups.get(q).push(id); }
  const order = [...groups.keys()].sort((a, b) => (a === mainReg ? -1 : b === mainReg ? 1 : 0));
  for (const q of order) {
    const ids = groups.get(q).sort((a, b) => authoredIndex.get(a) - authoredIndex.get(b));
    let m = !sc ? undefined : (q && q !== mainReg) ? `**Chapter · ${questName(q)}**` : "**Also in this quest (not on a step)**";
    for (const id of ids) if (!placed.has(id) && !(incoming.get(id) > 0 && ids.some(o => o !== id && targetsOf(byId.get(o)).includes(id)))) { dfs(id, m); m = undefined; }
    for (const id of ids) if (!placed.has(id)) { dfs(id, m); m = undefined; }
  }
  return out;
}

/* ── assemble ──────────────────────────────────────────────────────────────── */
const tabs = opt.md.map(spec => { const i = spec.indexOf("="); const name = spec.slice(0, i); const file = spec.slice(i + 1); return { name, file, parsed: parseTab(fs.readFileSync(file, "utf8")) }; });
const report = []; const say = (s) => report.push(s);
// where does each script key live today? (tab, section) by majority of its documented chunks
const home = new Map();            // key → { tab, section }
const docIds = new Map();          // beatId → { tab, section, chunk }
const townSection = new Map();     // Encounters tab: script key → section with its exteriors
for (const t of tabs) for (const s of t.parsed.sections) {
  const count = new Map();
  for (const c of s.chunks) for (const id of c.ids) {
    docIds.set(id, { tab: t, section: s, chunk: c });
    const k = keyOf(byId.get(id)); if (k) count.set(k, (count.get(k) || 0) + 1);
    if (/_exterior$/.test(id) && t.name.toLowerCase().startsWith("encounters") && k) townSection.set(k, s);
  }
  const best = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
  if (best && !t.name.toLowerCase().startsWith("encounters")) { s.key = best[0]; if (!home.has(best[0])) home.set(best[0], { tab: t, section: s }); }
}
const encountersTab = tabs.find(t => t.name.toLowerCase().startsWith("encounters"));
const stale = [...docIds.keys()].filter(id => !byId.has(id));
// a documented beat whose script lives in ANOTHER tab counts as missing from its home tab (2026-10-20: it leaves the tab it was in, see the rebuild loop)
const missing = beats.filter(b => { if (!docIds.has(b.id)) return true; const h = keyOf(b) ? home.get(keyOf(b)) : null; return !!(h && docIds.get(b.id).tab !== h.tab && !/_exterior$/.test(b.id)); });
const placeholders = missing.filter(b => /^evt_/.test(b.id));
say(`# Beat Polish order report — ${new Date().toISOString().slice(0, 10)}`);
say(`live beats ${beats.length} · documented ${docIds.size} · in doc but not live ${stale.length}${stale.length ? " (" + stale.join(", ") + ")" : ""} · live but undocumented ${missing.length} (of which ${placeholders.length} evt_ placeholders, skipped)`);
// decide destination for each missing beat
const inserts = new Map();   // section object → [beatId]
const strays = [];           // no section anywhere
for (const b of missing) {
  if (/^evt_/.test(b.id)) continue;
  const k = keyOf(b);
  if (/_exterior$/.test(b.id) && encountersTab) {
    const title = k ? scriptName(k) : questName(b.questId);
    let s = (k ? townSection.get(k) : null) || encountersTab.parsed.sections.find(x => x.created && x.title === title);
    if (!s) { s = { title, preamble: [], chunks: [], created: true }; encountersTab.parsed.sections.push(s); if (k) townSection.set(k, s); }
    (inserts.get(s) || inserts.set(s, []).get(s)).push(b.id); continue;
  }
  const h = k ? home.get(k) : null;
  if (h) { (inserts.get(h.section) || inserts.set(h.section, []).get(h.section)).push(b.id); continue; }
  strays.push(b);
}
if (strays.length && encountersTab) {
  const byQ = new Map(); for (const b of strays) { const q = b.questId || ""; if (!byQ.has(q)) byQ.set(q, []); byQ.get(q).push(b.id); }
  for (const [q, ids] of byQ) {
    const title = questName(q);
    let s = encountersTab.parsed.sections.find(x => x.title === title && !x.key);
    if (!s) { s = { title, preamble: [], chunks: [], created: true }; encountersTab.parsed.sections.push(s); }
    (inserts.get(s) || inserts.set(s, []).get(s)).push(...ids);
  }
}
// rebuild every tab
const summary = [];
for (const t of tabs) {
  const out = []; let moved = 0, added = 0, kept = 0, refreshed = 0;
  if (t.parsed.title) out.push(`# ${t.parsed.title}`, "");
  out.push(...t.parsed.preamble); while (out.length && out[out.length - 1].trim() === "") out.pop(); out.push("");
  // pull every chunk of this tab into a pool; chunks of a script whose home section is in this tab go there
  const pool = new Map(); for (const s of t.parsed.sections) for (const c of s.chunks) pool.set(c.id, c);
  const sectionMembers = new Map();   // section → [chunk ids]
  for (const s of t.parsed.sections) sectionMembers.set(s, []);
  for (const s of t.parsed.sections) for (const c of s.chunks) {
    const k = keyOf(byId.get(c.id)); const h = k ? home.get(k) : null;
    // 2026-10-20: a chunk whose script lives in ANOTHER tab leaves this one (the home tab adds it from live data) —
    // before this, a beat that gained a story.quest stayed in "Encounters and strays" AND appeared in its home tab.
    if (h && h.tab !== t && byId.has(c.id) && !/_exterior$/.test(c.id)) { moved++; say(`left "${t.name}" for ${h.tab.name}: ${c.id}`); continue; }
    const dest = (h && h.tab === t) ? h.section : s;
    if (dest !== s) moved++;
    sectionMembers.get(dest).push(c.id);
  }
  for (const s of t.parsed.sections) {
    const memberIds = [...sectionMembers.get(s), ...(inserts.get(s) || [])];
    if (!memberIds.length && !s.preamble.some(l => l.trim())) continue;
    out.push(`## ${s.title}`, "");
    const prePure = s.preamble.filter(l => !GEN_MARK.test(l)); while (prePure.length && prePure[0].trim() === "") prePure.shift(); while (prePure.length && prePure[prePure.length - 1].trim() === "") prePure.pop();
    if (prePure.length) { out.push(...prePure, ""); }
    const key = s.key || (memberIds.length ? keyOf(byId.get(memberIds[0])) : "");
    const inScript = memberIds.filter(id => keyOf(byId.get(id)) === key && byId.has(id));
    const foreign = memberIds.filter(id => !inScript.includes(id));
    const ordered = key ? walkScript(key, inScript) : inScript.map(id => ({ id }));
    const docOrder = sectionMembers.get(s).filter(id => inScript.includes(id));
    const newOrder = ordered.map(o => o.id).filter(id => docOrder.includes(id));
    // count real moves = ids not in the longest common subsequence of (doc order, new order)
    moved += docOrder.length - lcsLen(docOrder, newOrder);
    const keepSet = lcsKeep(docOrder, newOrder); const movedIds = docOrder.filter(id => !keepSet.has(id)); if (movedIds.length) say(`moved in "${s.title}": ${movedIds.join(", ")}`);
    const emit = (o) => {
      if (o.marker) out.push(o.marker, "");
      const c = pool.get(o.id);
      if (c && !(opt.liveWins && byId.has(o.id) && !opt.keep?.has(o.id))) { kept++; if (c.prefix.length) { out.push(...c.prefix.filter(l => !GEN_MARK.test(l)), ""); } out.push(c.heading, ""); const body = [...c.body]; while (body.length && body[0].trim() === "") body.shift(); out.push(...body, ""); }
      else if (c) { refreshed++; if (c.prefix.length) { out.push(...c.prefix.filter(l => !GEN_MARK.test(l)), ""); } out.push(...renderBeat(byId.get(o.id))); }
      else { added++; out.push(...renderBeat(byId.get(o.id))); }
    };
    for (const o of ordered) emit(o);
    if (foreign.length) { out.push(foreign.some(id => keyOf(byId.get(id))) ? "**Also here (belongs to another script; left where it was)**" : "**Also here (on no script step; left where it was)**", ""); for (const id of foreign) emit({ id }); }
  }
  while (out.length && out[out.length - 1].trim() === "") out.pop();
  const md = out.join("\n") + "\n";
  const safe = t.name.replace(/[^A-Za-z0-9]+/g, "_");
  if (!opt.reportOnly) fs.writeFileSync(path.join(opt.out, `${safe}.md`), md);
  summary.push({ tab: t.name, sections: t.parsed.sections.length, kept, refreshed, added, moved });
  say(`\n## ${t.name}\nsections ${t.parsed.sections.length} · beats kept ${kept} · refreshed from live ${refreshed} · added ${added} · moved into order ${moved}`);
  const addedIds = [...t.parsed.sections].flatMap(s => inserts.get(s) || []); if (addedIds.length) say("added: " + addedIds.join(", "));
}
function lcsKeep(a, b) { const n = a.length, m = b.length; const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0)); for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]); const keep = new Set(); let i = 0, j = 0; while (i < n && j < m) { if (a[i] === b[j]) { keep.add(a[i]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; } return keep; }
function lcsLen(a, b) { const n = a.length, m = b.length; const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0)); for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]); return dp[0][0]; }
if (placeholders.length) say(`\nskipped evt_ placeholders: ${placeholders.map(b => b.id).join(", ")}`);
fs.mkdirSync(opt.out, { recursive: true });
fs.writeFileSync(path.join(opt.out, "report.md"), report.join("\n") + "\n");
console.log(report.join("\n"));
console.table(summary);

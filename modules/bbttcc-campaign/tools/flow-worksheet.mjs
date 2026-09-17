import fs from "fs";
const m = await import("/Users/gamingaccount/modules/bbttcc-campaign/scripts/story-model.js");
const [inp, out] = process.argv.slice(2);
const j = JSON.parse(fs.readFileSync(inp, "utf8"));
const row = j.settings.find(s => s.ns === "bbttcc-campaign" && s.key === "campaigns"); let camps = row.value; if (typeof camps === "string") camps = JSON.parse(camps);
const cid = Object.keys(camps).find(k => camps[k]?.beats?.length); const c = camps[cid]; const beats = c.beats; const byId = new Map(beats.map(b => [b.id, b]));
let reg = j.settings.find(s => s.ns === "bbttcc-campaign" && s.key === "quests")?.value; if (typeof reg === "string") reg = JSON.parse(reg); reg = reg || {};
const actors = new Map((j.actors || []).map(a => [a._id, a.name])); const scenes = new Map((j.scenes || []).map(s => [s._id, s.name]));
const plain = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const gate = (b) => { const r = b.inject?.requires; const rs = Array.isArray(r) ? r : (r ? [r] : []); return rs.map(x => x.flag ? `${x.flag}${x.gte != null ? "≥" + x.gte : x.lte != null ? "≤" + x.lte : x.eq != null ? "=" + x.eq : ""}` : x.questBucket ? `${(reg[x.questBucket]?.name || x.questBucket)} ${x.is ? "is " + x.is : "not " + x.isNot}` : x.relation ? `standing ${x.is || "≥" + x.atLeast} with ${x.relation}` : x.beatMark ? `mark ${x.beatMark}` : JSON.stringify(x)).join(" · "); };
const routesIn = new Map(); for (const b of beats) for (const ch of (b.choices || [])) for (const t of [ch?.next, ch?.failNext]) if (t) routesIn.set(t, (routesIn.get(t) || []).concat(b.id));
const decl = (b) => m.declOf(b) || b.story || null;
const groups = {}; // quest → chapter|"" → beats
for (const b of beats) { const d = decl(b); if (!d?.quest) continue; const q = d.quest, ch = d.chapter || ""; (groups[q] ||= {}); (groups[q][ch] ||= []).push(b); }
const seq = (b) => Number.isFinite(Number(b.questStep)) && b.questStep != null ? Number(b.questStep) : 1e6;
const Q = m.QUEST_MAP.quests; const acts = {}; for (const [k, q] of Object.entries(Q)) (acts[q.act] ||= []).push(k);
let md = `# STORY FLOW WORKSHEET — extracted ${new Date().toISOString().slice(0, 10)}\n\nSource: the Act 2 turn-2 save with \`patch-vault-allies\` applied offline. ${beats.length} beats · ${Object.keys(Q).length} quests. Machine-extracted; the RULINGS columns are for the owner to fill.\n\nFor each quest: **RULE** = the order you want, the giver, the player-facing description, and one "next step" line per step. Beats are listed in today's questStep order with what routes INTO them (← ids), their gate, speaker, scene, and place. Pool beats (travel draws) and Word tickets are excluded.\n\n`;
for (const act of Object.keys(acts).sort((a, b) => a - b)) {
  md += `\n---\n\n# ACT ${act}\n`;
  for (const k of acts[act]) {
    const q = Q[k]; const r = reg[q.registryId] || {};
    md += `\n## ${q.name}  \`${k}\`${q.keystone ? "  ★ keystone" : ""}\n- **hex:** ${q.hex || "(none — anywhere)"} · **registry:** ${q.registryId || "(none)"}\n- **current description:** ${plain(r.description) || "(none)"}\n- **RULE — giver:** \n- **RULE — description (player-facing):** \n- **RULE — order:** \n`;
    const chs = groups[k] || {}; const chapterKeys = ["", ...Object.keys(q.chapters || {})];
    for (const ch of chapterKeys) {
      const list = (chs[ch] || []).slice().sort((a, b) => seq(a) - seq(b)); if (!list.length && ch === "") continue;
      md += ch ? `\n### chapter · ${q.chapters[ch]?.name || ch}  \`${ch}\`  (${(reg[q.chapters[ch]?.registryId] || {}).name || "no registry row"})\n` : `\n### main line\n`;
      md += `| # | beat | role | ← routed from | gate | speaker | scene | place | text |\n|---|---|---|---|---|---|---|---|---|\n`;
      for (const b of list) { const d = decl(b) || {}; const role = d.role ? `${d.role}${d.ending ? ":" + d.ending : ""}` : ""; const from = (routesIn.get(b.id) || []).slice(0, 3).join(", ") + ((routesIn.get(b.id) || []).length > 3 ? " …" : ""); md += `| ${b.questStep ?? ""} | \`${b.id}\` ${b.label ? "— " + b.label : ""} | ${role} | ${from || "—"} | ${gate(b) || "—"} | ${b.speakerActorId ? (actors.get(b.speakerActorId) || b.speakerActorId) : ""} | ${b.sceneId ? (scenes.get(String(b.sceneId).replace(/^Scene\./, "")) || b.sceneId) : ""} | ${m.placeOf(b, q) || "?"} | ${plain(b.description).slice(0, 110)} |\n`; }
      md += `\n**RULE — next-step lines (one per step, player-facing):**\n\n`;
    }
  }
}
fs.writeFileSync(out, md); console.log("wrote", out, md.length, "chars");

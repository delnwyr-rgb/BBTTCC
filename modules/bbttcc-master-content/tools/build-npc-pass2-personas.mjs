#!/usr/bin/env node
/* build-npc-pass2-personas.mjs — compile NPC Pack v1 PASS 2 (AI NPC personas) into a guarded DRY_RUN macro.
 * Usage (repo root):
 *   node modules/bbttcc-master-content/tools/build-npc-pass2-personas.mjs <npcs.jsonl> <world-personas.jsonl> [bios.json]
 *   → writes modules/bbttcc-master-content/tools/npc-pack-pass2-personas.macro.js
 *
 * Owner ask 2026-10-06: every named NPC carries its bio + roleplay notes on the AI NPC interface (mal-voice), for GMs and
 * for the model. What the dialogue engine reads (bbttcc-mal-voice/scripts/npc-dialogue.js :95-96, :396, :706):
 *   role line   system.biography.concept   (every actor type — the sheet's About panel, 2026-10-06; AI prefers it over npc role)
 *   public bio  system.biography.notes     (plain text; About panel renders paragraphs; open to anyone who sees the sheet)
 *   persona     flags.bbttcc-mal-voice.persona {notes (PRIVATE roleplay), topics, secretsRaw, recipesRaw}
 * Sources: the personas the seeders already wrote on ember's WORLD actors (`world-personas.jsonl`, matched by name) are
 * copied into the pack; `bios.json` (owner-approved drafts: {entries:[{name, role, bio, personaNotes?, topics?}]}) fills
 * the public layer and the four personas the world never had. Play-state keys (secretsUsed, recipesTaught) never travel.
 * Fill-only: a field that already holds text in the pack is left alone and reported. Scope skips Test PCs / Testing
 * Characters / Bad Eden Monsters / rigs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [NPCS, WORLD, BIOS] = process.argv.slice(2);
if (!NPCS || !WORLD) { console.error("usage: build-npc-pass2-personas.mjs <npcs.jsonl> <world-personas.jsonl> [bios.json]"); process.exit(2); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const recs = fs.readFileSync(NPCS, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
const folders = Object.fromEntries(recs.filter(r => r.k.startsWith("!folders!")).map(r => [r.v._id, r.v]));
const fpath = id => { const s = []; for (let f = folders[id]; f; f = folders[f.folder]) s.unshift(f.name); return s.join("/") || "(root)"; };
const world = Object.fromEntries(fs.readFileSync(WORLD, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)).filter(w => w.persona).map(w => [w.name, w]));
// drafts use CANON names; `packName` carries the pack spelling where they differ (Ondine Brakk, Sable 9, …) — key by the pack name
const bios = BIOS ? Object.fromEntries(JSON.parse(fs.readFileSync(BIOS, "utf8")).entries.filter(e => e.role || e.bio || e.personaNotes).map(e => [e.packName || e.name, e])) : {};
const OUT_OF_SCOPE = /^(Test PCs|Testing Characters|Bad Eden Monsters)(\/|$)/;
const MOD = "bbttcc-mal-voice";
const empty = v => !String(v ?? "").replace(/<[^>]+>/g, "").trim();
const PLAY_STATE = new Set(["secretsUsed", "recipesTaught"]);

// CUTS (owner ruling 2026-10-06: "cut if they aren't in any current lore or mentioned in any beats"). Verified per row.
const CUTS = [
  { name: "Sgt Brindle", why: "July-2026 Trojan Gift decoy sergeant, superseded by Sergeant Absalom Reyes; 0 hits in live settings/journals/scenes/macros (2026-10-06)" },
];
const cut = [];
for (const r of recs.filter(r => r.k.startsWith("!actors!"))) { const c = CUTS.find(c => c.name === r.v.name); if (c) cut.push({ id: r.v._id, name: r.v.name, folder: fpath(r.v.folder), why: c.why }); }
const plan = [], kept = [], tally = { persona: 0, role: 0, bio: 0, cut: cut.length };
for (const r of recs.filter(r => r.k.startsWith("!actors!"))) {
  const a = r.v, f = fpath(a.folder);
  if (OUT_OF_SCOPE.test(f) || a.type === "rig") continue;
  const w = world[a.name], b = bios[a.name];
  const p = { id: a._id, name: a.name, folder: f, set: {}, expect: {}, notes: [] };
  const cur = a.flags?.[MOD]?.persona;
  let persona = w ? Object.fromEntries(Object.entries(w.persona).filter(([k]) => !PLAY_STATE.has(k))) : null;
  if (persona && empty(persona.notes) && empty(persona.topics) && empty(persona.secretsRaw)) persona = null;   // empty shells don't travel
  if (!persona && b?.personaNotes) persona = { notes: b.personaNotes, topics: b.topics || "" };
  if (persona) {
    if (!cur || (empty(cur.notes) && empty(cur.topics))) {
      p.set[`flags.${MOD}.persona`] = persona; p.expect[`flags.${MOD}.persona`] = cur ?? null;
      p.notes.push(`persona ${w ? "← world" : "← draft"} (${String(persona.notes || "").length} ch, ${String(persona.secretsRaw || "").split("\n").filter(Boolean).length} secret)`); tally.persona++;
    } else kept.push(`${a.name}: pack already has persona — kept`);
  }
  const roleKey = "system.biography.concept", bioKey = "system.biography.notes";
  const get = k => k.split(".").reduce((x, s) => x?.[s], a);
  if (b?.role) { if (empty(get(roleKey))) { p.set[roleKey] = b.role; p.expect[roleKey] = get(roleKey) ?? null; p.notes.push("role"); tally.role++; } else kept.push(`${a.name}: role kept ("${get(roleKey)}")`); }
  if (b?.bio) { if (empty(get(bioKey))) { p.set[bioKey] = b.bio; p.expect[bioKey] = get(bioKey) ?? null; p.notes.push("bio"); tally.bio++; } else kept.push(`${a.name}: bio kept`); }
  if (Object.keys(p.set).length) plan.push(p);
}

const OUT = path.join(HERE, "npc-pack-pass2-personas.macro.js");
fs.writeFileSync(OUT, `/* npc-pack-pass2-personas.macro.js — NPC Pack v1 PASS 2: AI NPC personas (GENERATED ${new Date().toISOString().slice(0, 10)} by
 * build-npc-pass2-personas.mjs — do not hand-edit; rebuild from fresh dumps).
 * Paste into a GM macro on EMBER. DRY_RUN = true prints the plan, writes nothing; flip to false to write.
 * Writes the compendium bbttcc-master-content.npcs: copies each named NPC's mal-voice persona (private roleplay notes,
 * topics, secrets) from the world into the pack, and fills the PUBLIC role line + bio the AI and GM read.
 * Fill-only + guarded: a field is written only if it still holds what the plan saw (else SKIP, reported).
 * Also DELETES the owner-ruled cuts listed in CUT (name-checked; pack backed up on the box first).
 * Tally: ${JSON.stringify(tally)} across ${plan.length} actors.
 */
const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.npcs";
const PLAN = ${JSON.stringify(plan)};
const CUT = ${JSON.stringify(cut)};
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const pack = game.packs.get(PACK_ID); if (!pack) return ui.notifications.error(\`No pack \${PACK_ID}\`);
  // "", null and undefined are the same "empty" — template.json now seeds biography {concept:"",notes:""} on npc/rig
  const blank = v => (v === undefined || v === null || v === "" || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length)) ? null : v;
  const eq = (a, b) => JSON.stringify(blank(a)) === JSON.stringify(blank(b));
  const get = foundry.utils.getProperty;
  const log = []; let wrote = 0, skipped = 0;
  const wasLocked = pack.locked;
  if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
  try {
    for (const p of PLAN) {
      const a = await pack.getDocument(p.id);
      if (!a || a.name !== p.name) { log.push(\`✗ SKIP \${p.name} — not found / renamed\`); skipped++; continue; }
      const upd = {};
      for (const [k, v] of Object.entries(p.set)) { if (eq(get(a, k), p.expect[k])) upd[k] = v; else { log.push(\`✗ drift \${p.name} \${k}\`); skipped++; } }
      log.push(\`\${DRY_RUN ? "·" : "✔"} \${p.folder} › \${p.name}  \${p.notes.join(" · ")}\`);
      if (!DRY_RUN && Object.keys(upd).length) await a.update(upd);
      wrote++;
    }
    for (const c of CUT) {
      const a = await pack.getDocument(c.id);
      if (!a || a.name !== c.name) { log.push(\`✗ SKIP cut \${c.name} — not found / renamed\`); skipped++; continue; }
      log.push(\`\${DRY_RUN ? "·" : "✔"} CUT \${c.folder} › \${c.name} — \${c.why}\`);
      if (!DRY_RUN) await a.delete();
    }
  } finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  console.log(\`[npc-pack-pass2-personas] \${DRY_RUN ? "DRY RUN" : "APPLIED"} — \${wrote} actor(s), \${skipped} skip/drift\\n\` + log.join("\\n"));
  ui.notifications.info(\`npc-pack-pass2-personas \${DRY_RUN ? "dry run" : "applied"}: \${wrote} actors, \${skipped} skipped — see console (F12).\`);
})();
`);
console.log(`build-npc-pass2-personas → ${path.relative(process.cwd(), OUT)}  ${JSON.stringify(tally)} across ${plan.length} actors`);
for (const k of kept) console.log("  kept: " + k);

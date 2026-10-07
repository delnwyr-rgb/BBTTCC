#!/usr/bin/env node
/* build-regimen-pass5.mjs — REGIMEN steps 1–2 as one guarded macro: automation DATA onto non-monster content.
 * Usage (repo root):
 *   node modules/bbttcc-master-content/tools/build-regimen-pass5.mjs <packs-dir> <restamp-output.json> [trigger-conversion.json]
 *   → writes modules/bbttcc-master-content/tools/regimen-pass5-restamp.macro.js
 * restamp-output.json  = { entries:[{pack,id,name,verdict,set:{<dotted path>:value},effects:[{name,changes,transfer}],why}] }
 * trigger-conversion.json = { entries:[{pack,id,name,verdict,triggers:[…]}] }
 * The macro writes each PACK item (by id) AND every WORLD copy of it: items embedded on actors are matched by
 * system.identifier (techniques / features) or, failing that, by exact name + type. Flags are set with their expected
 * old value absent-or-equal (fill-only); AEs are created only when no AE of that name exists on the item. Re-run safe.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateNpcAuto } from "./npc-auto-schema.mjs";

const [PACKS, RESTAMP, TRIGGERS] = process.argv.slice(2);
if (!PACKS || !RESTAMP) { console.error("usage: build-regimen-pass5.mjs <packs-dir> <restamp-output.json> [trigger-conversion.json]"); process.exit(2); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACK_IDS = {
  items: "bbttcc-master-content.items", classes: "bbttcc-master-content.classes", doctrines: "bbttcc-master-content.doctrines",
  ancestries: "bbttcc-master-content.ancestries", "npc-abilities": "bbttcc-master-content.npc-abilities", "courtly-secrets": "bbttcc-master-content.courtly-secrets",
  "starter-manifestations": "fourththing.starter-manifestations", "surge-abilities": "fourththing.surge-abilities",
  "co-crew-types": "bbttcc-character-options.crew-types", "co-occult-associations": "bbttcc-character-options.occult-associations",
  "co-npc-callings": "bbttcc-character-options.npc-callings", "co-political-affiliations": "bbttcc-character-options.political-affiliations",
  "co-sephirothic-alignments": "bbttcc-character-options.sephirothic-alignments", "co-enlightenment-levels": "bbttcc-character-options.enlightenment-levels",
};
const live = {};
for (const f of fs.readdirSync(PACKS).filter(f => f.endsWith(".jsonl"))) {
  const pack = f.replace(/\.jsonl$/, ""); if (!PACK_IDS[pack]) continue;
  live[pack] = Object.fromEntries(fs.readFileSync(path.join(PACKS, f), "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)).filter(r => r.k.startsWith("!items!")).map(r => [r.v._id, r.v]));
}
const getP = (o, p) => p.split(".").reduce((x, k) => x?.[k], o);
const REROLL_CTX = new Set(["check", "save", "forced-movement", "initiative", "defense", "attack", "caster-check"]);
const TRIGGER_KINDS = new Set(["grant-resource", "add-temp-integrity", "apply-state", "heal", "extra-damage", "queued-reroll", "spend-and-survive", "chat-prompt"]);
const problems = [], plan = [], tally = { items: 0, flags: 0, effects: 0, triggers: 0, skipped: {} };

const restamp = JSON.parse(fs.readFileSync(RESTAMP, "utf8")).entries ?? [];
const triggers = TRIGGERS ? (JSON.parse(fs.readFileSync(TRIGGERS, "utf8")).entries ?? []) : [];
const byKey = new Map();
const rowFor = (e) => {
  const k = `${e.pack}|${e.id}`;
  if (!byKey.has(k)) {
    const v = live[e.pack]?.[e.id];
    if (!v) { problems.push(`${e.pack}/${e.id} ${e.name}: not in the live dump`); return null; }
    if (v.name !== e.name) { problems.push(`${e.pack}/${e.id}: name "${v.name}" ≠ authored "${e.name}"`); return null; }
    byKey.set(k, { pack: e.pack, packId: PACK_IDS[e.pack], id: e.id, name: e.name, type: v.type, identifier: v.system?.identifier || "", set: {}, expect: {}, effects: [], why: [] });
  }
  return byKey.get(k);
};
for (const e of restamp) {
  if (e.verdict !== "stamp") { tally.skipped[e.verdict] = (tally.skipped[e.verdict] || 0) + 1; continue; }
  const row = rowFor(e); if (!row) continue;
  const v = live[e.pack][e.id];
  for (const [k, val] of Object.entries(e.set ?? {})) {
    if (!k.startsWith("flags.fourththing.") && !k.startsWith("flags.bbttcc-character-options.")) { problems.push(`${e.name}: refusing to set ${k} (flags only)`); continue; }
    if (k === "flags.fourththing.rerolls") for (const r of val) { if (!REROLL_CTX.has(r?.context)) problems.push(`${e.name}: rerolls.context "${r?.context}"`); if (!["reroll-lowest", "reroll-highest"].includes(r?.mode)) problems.push(`${e.name}: rerolls.mode "${r?.mode}"`); }
    if (k === "flags.fourththing.npcAuto") for (const p of validateNpcAuto(val, `${e.name}: `)) problems.push(p);
    row.set[k] = val; row.expect[k] = getP(v, k) ?? null; tally.flags++;
  }
  for (const ae of e.effects ?? []) {
    if (!ae?.name || !Array.isArray(ae.changes) || !ae.changes.length) { problems.push(`${e.name}: malformed AE`); continue; }
    for (const c of ae.changes) if (!/^system\.(skills\.[a-z]+\.value|derived\.(guard|evasion|resolve|integrity|stress)\.aeBonus|derived\.initiative\.bonus|attributes\.[a-z]+\.value|derived\.movement\.walk)$/.test(c.key)) problems.push(`${e.name}: AE key "${c.key}" is not a path the system reads`);
    row.effects.push({ name: ae.name, img: v.img, transfer: ae.transfer !== false, disabled: false, changes: ae.changes.map(c => ({ key: c.key, type: c.type || "add", value: String(c.value), phase: c.phase || "derived", priority: Number(c.priority ?? 20) })), flags: { fourththing: { regimen: "2026-10-06" } } });
    tally.effects++;
  }
  if (e.why) row.why.push(e.why);
}
for (const e of triggers) {
  if (!Array.isArray(e.triggers)) continue;
  const row = rowFor(e); if (!row) continue;
  for (const t of e.triggers) { if (!TRIGGER_KINDS.has(t?.effect?.kind)) problems.push(`${e.name}: trigger kind "${t?.effect?.kind}"`); }
  row.set["flags.fourththing.triggers"] = e.triggers; row.expect["flags.fourththing.triggers"] = getP(live[e.pack][e.id], "flags.fourththing.triggers") ?? null; tally.triggers++;
  if (e.why) row.why.push(`triggers: ${e.why}`);
}
for (const row of byKey.values()) if (Object.keys(row.set).length || row.effects.length) { plan.push(row); tally.items++; }
if (problems.length) { console.error("INVALID restamp data:\n  " + problems.join("\n  ")); process.exit(1); }

const OUT = path.join(HERE, "regimen-pass5-restamp.macro.js");
fs.writeFileSync(OUT, `/* regimen-pass5-restamp.macro.js — REGIMEN steps 1–2: automation data onto items / class & Path features / ancestries /
 * character options / npc-abilities (GENERATED ${new Date().toISOString().slice(0, 10)} by build-regimen-pass5.mjs — do not hand-edit).
 * GM macro on EMBER. DRY_RUN = true prints the plan, writes nothing. Needs the 2026-10-06 system build (trigger kinds
 * apply-state / heal / extra-damage, resource-grant cadences) deployed + restarted first.
 * Writes each PACK item by id AND every WORLD copy embedded on actors (matched by system.identifier, else exact name + type).
 * Fill-only + name-checked; AEs created only when the item has no AE of that name. Re-run safe.
 * Tally: ${JSON.stringify(tally)}
 */
const DRY_RUN = true;
const PLAN = ${JSON.stringify(plan)};
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const eq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const get = foundry.utils.getProperty;
  const log = []; let packWrites = 0, worldWrites = 0, skipped = 0; const unlocked = [];
  // index every embedded world item once: identifier → [item], name|type → [item]
  const byIdent = new Map(), byName = new Map();
  for (const a of game.actors) for (const it of a.items) {
    const id = String(it.system?.identifier || ""); if (id) (byIdent.get(id) ?? byIdent.set(id, []).get(id)).push(it);
    const nk = it.name + "|" + it.type; (byName.get(nk) ?? byName.set(nk, []).get(nk)).push(it);
  }
  const apply = async (doc, row, where) => {
    const upd = {};
    for (const [k, v] of Object.entries(row.set)) { const cur = get(doc, k); if (cur === undefined || cur === null || eq(cur, row.expect[k]) || (Array.isArray(cur) && !cur.length)) upd[k] = v; else { log.push(\`✗ drift \${where} \${row.name} \${k}\`); skipped++; } }
    const newAEs = row.effects.filter(ae => !doc.effects.find(e => e.name === ae.name));
    if (!Object.keys(upd).length && !newAEs.length) return false;
    log.push(\`\${DRY_RUN ? "·" : "✔"} \${where} \${row.name}: \${[...Object.keys(upd).map(k => k.split(".").slice(-1)[0]), ...newAEs.map(a => "AE " + a.name)].join(", ")}\`);
    if (!DRY_RUN) { if (Object.keys(upd).length) await doc.update(upd); if (newAEs.length) await doc.createEmbeddedDocuments("ActiveEffect", newAEs); }
    return true;
  };
  try {
    for (const row of PLAN) {
      const pack = game.packs.get(row.packId);
      const doc = pack ? await pack.getDocument(row.id).catch(() => null) : null;
      if (!doc) { log.push(\`✗ [pack] \${row.packId} \${row.name} missing\`); skipped++; }
      else if (doc.name !== row.name) { log.push(\`✗ [pack] \${row.name} is now "\${doc.name}"\`); skipped++; }
      else { if (!DRY_RUN && pack.locked && !unlocked.includes(pack)) { await pack.configure({ locked: false }); unlocked.push(pack); } if (await apply(doc, row, "[pack " + row.pack + "]")) packWrites++; }
      const copies = (row.identifier ? byIdent.get(row.identifier) : null) ?? byName.get(row.name + "|" + row.type) ?? [];
      for (const it of copies) if (await apply(it, row, "[world " + it.parent.name + " ›]")) worldWrites++;
    }
  } finally { if (!DRY_RUN) for (const p of unlocked) await p.configure({ locked: true }); }
  const skips = log.filter(l => l.startsWith("✗"));
  console.log(\`[regimen-pass5-restamp] \${DRY_RUN ? "DRY RUN" : "APPLIED"} — \${packWrites} pack item(s), \${worldWrites} world copy(ies), \${skipped} skipped\` + (skips.length ? "\\nSKIPPED:\\n" + skips.join("\\n") + "\\n──" : "") + "\\n" + log.join("\\n"));
  ui.notifications.info(\`regimen-pass5 \${DRY_RUN ? "dry run" : "applied"}: \${packWrites} pack + \${worldWrites} world, \${skipped} skipped — see console (F12).\`);
})();
`);
console.log(`build-regimen-pass5 → ${path.relative(process.cwd(), OUT)}  ${JSON.stringify(tally)}`);

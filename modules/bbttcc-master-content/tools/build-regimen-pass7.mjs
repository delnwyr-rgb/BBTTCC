#!/usr/bin/env node
/* build-regimen-pass7.mjs — REGIMEN pass 7: the pass-5 needs-code / needs-predicate / chat-prompt backlog, now as EXECUTING data
 * (reroll `when` predicates, passives.ranks / checkBonus / aura, npcAuto attacked-by + ▶ Use rules, and trigger kinds that run).
 * Usage (repo root):
 *   node modules/bbttcc-master-content/tools/build-regimen-pass7.mjs <packs-dir> [restamp-pass7.json] [triggers-pass7.json]
 *   → writes modules/bbttcc-master-content/tools/regimen-pass7.macro.js
 * Data defaults to tools/data/restamp-pass7.json + tools/data/triggers-pass7.json. Vocabulary (trigger events / kinds / reroll `when`)
 * is READ FROM systems/fourththing/ft-progression.js so the data cannot drift from the engine; npcAuto rules go through npc-auto-schema.mjs.
 * Macro semantics = pass 5: writes each PACK item by id AND every WORLD copy (system.identifier, else exact name + type); every flag is
 * guarded by its expected old value (absent-or-equal); re-run safe; DRY_RUN = true prints the plan.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateNpcAuto } from "./npc-auto-schema.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const [PACKS, RESTAMP = path.join(HERE, "data/restamp-pass7.json"), TRIGGERS = path.join(HERE, "data/triggers-pass7.json")] = process.argv.slice(2);
if (!PACKS) { console.error("usage: build-regimen-pass7.mjs <packs-dir> [restamp-pass7.json] [triggers-pass7.json]"); process.exit(2); }

// ── engine vocabulary, read from the system source ───────────────────────────────────────────────
const PR = fs.readFileSync(path.join(ROOT, "systems/fourththing/ft-progression.js"), "utf8");
const listOf = (name) => { const m = PR.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\];`)); if (!m) throw new Error(`${name} not found in ft-progression.js`); return new Set([...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1])); };
export const TRIGGER_EVENTS = listOf("TRIGGER_EVENTS"), TRIGGER_KINDS = listOf("TRIGGER_EFFECT_KINDS"), WHEN_VOCAB = listOf("REROLL_WHEN_VOCAB");
const REROLL_CTX = new Set(["check", "save", "forced-movement", "initiative", "defense", "attack", "caster-check"]);
const LIMIT_WINDOWS = new Set(["turn", "round", "scene", "soma-break", "short-rest", "session"]);
const SKILLS = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, "systems/fourththing/template.json"), "utf8")).Actor.character.skills));
const ATTRS = new Set(["violence", "intrigue", "presence", "body", "mind", "soul"]);

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
const problems = [], plan = [], tally = { items: 0, flags: 0, triggers: 0, byFlag: {} };

// ── validators ───────────────────────────────────────────────────────────────────────────────────
const whenOk = (w) => (Array.isArray(w) ? w : [w]).every(x => WHEN_VOCAB.has(String(x)));
function checkRerolls(name, val) {
  if (!Array.isArray(val)) return problems.push(`${name}: rerolls must be an array`);
  for (const r of val) {
    if (!REROLL_CTX.has(r?.context)) problems.push(`${name}: rerolls.context "${r?.context}"`);
    if (!["reroll-lowest", "reroll-highest"].includes(r?.mode)) problems.push(`${name}: rerolls.mode "${r?.mode}"`);
    if (r?.when && !whenOk(r.when)) problems.push(`${name}: rerolls.when ${JSON.stringify(r.when)} not in the engine vocab`);
    if (r?.skill && !SKILLS.has(r.skill)) problems.push(`${name}: rerolls.skill "${r.skill}"`);
    if (r?.attribute && !ATTRS.has(r.attribute)) problems.push(`${name}: rerolls.attribute "${r.attribute}"`);
  }
}
function checkBonusList(name, list, where) {
  if (!Array.isArray(list)) return problems.push(`${name}: ${where} must be an array`);
  for (const b of list) {
    if (!(Number(b?.bonus) !== 0) || !Number.isFinite(Number(b?.bonus))) problems.push(`${name}: ${where}.bonus "${b?.bonus}"`);
    if (b?.context && !REROLL_CTX.has(b.context)) problems.push(`${name}: ${where}.context "${b.context}"`);
    if (b?.skill && !SKILLS.has(b.skill)) problems.push(`${name}: ${where}.skill "${b.skill}"`);
    if (b?.attribute && !ATTRS.has(b.attribute)) problems.push(`${name}: ${where}.attribute "${b.attribute}"`);
    if (b?.when && !whenOk(b.when)) problems.push(`${name}: ${where}.when ${JSON.stringify(b.when)}`);
  }
}
function checkPassives(name, p) {
  for (const k of Object.keys(p)) if (!["ranks", "checkBonus", "aura", "movement", "initiative", "vision", "combat"].includes(k)) problems.push(`${name}: passives.${k} is not read by the engine`);
  if (p.ranks) for (const [s, n] of Object.entries(p.ranks)) { if (!SKILLS.has(s)) problems.push(`${name}: passives.ranks.${s} is not a skill`); if (!(Number(n) > 0)) problems.push(`${name}: passives.ranks.${s} = ${n}`); }
  if (p.checkBonus) checkBonusList(name, p.checkBonus, "passives.checkBonus");
  if (p.aura) {
    const a = p.aura;
    for (const k of Object.keys(a)) if (!["radius", "who", "includeSelf", "requires", "rerolls", "checkBonus", "defenseBonus", "walkSquares", "ignoreForcedMovementSquares", "note"].includes(k)) problems.push(`${name}: passives.aura.${k} unknown`);
    if (!(Number(a.radius) > 0)) problems.push(`${name}: aura.radius ${a.radius}`);
    if (a.who && !["allies", "all", "enemies"].includes(a.who)) problems.push(`${name}: aura.who "${a.who}"`);
    if (a.requires) for (const k of Object.keys(a.requires)) if (!["equipped", "active", "lit"].includes(k)) problems.push(`${name}: aura.requires.${k} unknown`);
    if (a.rerolls) checkRerolls(name, a.rerolls);
    if (a.checkBonus) checkBonusList(name, a.checkBonus, "aura.checkBonus");
    if (a.defenseBonus) for (const k of Object.keys(a.defenseBonus)) if (!["guard", "evasion", "resolve"].includes(k)) problems.push(`${name}: aura.defenseBonus.${k}`);
    if (!a.rerolls?.length && !a.checkBonus?.length && !a.defenseBonus && !a.walkSquares && !a.ignoreForcedMovementSquares) problems.push(`${name}: aura grants nothing the engine reads`);
  }
}
function checkTriggers(name, ts) {
  if (!Array.isArray(ts)) return problems.push(`${name}: triggers must be an array`);
  ts.forEach((t, i) => {
    const w = `${name} trigger ${i}`;
    if (!TRIGGER_EVENTS.has(t?.event)) problems.push(`${w}: event "${t?.event}" is not fired by the engine`);
    if (!TRIGGER_KINDS.has(t?.effect?.kind)) problems.push(`${w}: kind "${t?.effect?.kind}" is not dispatched by the engine`);
    for (const k of Object.keys(t ?? {})) if (!["event", "predicate", "limit", "radius", "offer", "offerText", "effect"].includes(k)) problems.push(`${w}: unknown key "${k}"`);
    for (const k of Object.keys(t?.predicate ?? {})) if (!["tag", "dieMin", "amountMin", "scope", "movedMinFt", "when"].includes(k)) problems.push(`${w}: unknown predicate.${k}`);
    if (t?.predicate?.when && !whenOk(t.predicate.when)) problems.push(`${w}: predicate.when ${JSON.stringify(t.predicate.when)}`);
    if (t?.limit) { if (!LIMIT_WINDOWS.has(t.limit.window)) problems.push(`${w}: limit.window "${t.limit.window}"`); if (!(t.limit.uses === "tier" || Number(t.limit.uses) >= 1)) problems.push(`${w}: limit.uses ${t.limit.uses}`); }
    const a = t?.effect?.args ?? {};
    if (a.target && !["self", "target", "allies", "enemies", "faction"].includes(a.target)) problems.push(`${w}: args.target "${a.target}"`);
    if (t?.effect?.kind === "modify-incoming-damage" && !["half", "minus", "zero", "multiply"].includes(a.mode || "half")) problems.push(`${w}: modify mode "${a.mode}"`);
    if (t?.effect?.kind === "displace-token" && !(Number(a.squares) >= 1)) problems.push(`${w}: displace squares ${a.squares}`);
    if (t?.effect?.kind === "spend-counter" && !(a.counter && (a.per?.dieFormula || a.per?.flat))) problems.push(`${w}: spend-counter needs counter + per`);
    if (t?.effect?.kind === "bank-counter" && !a.counter) problems.push(`${w}: bank-counter needs counter`);
    if (/^on-(ally|self-or-ally|enemy)/.test(String(t?.event)) && t?.radius !== undefined && !(Number(t.radius) > 0)) problems.push(`${w}: radius ${t.radius}`);
  });
}

// ── plan ─────────────────────────────────────────────────────────────────────────────────────────
const restamp = JSON.parse(fs.readFileSync(RESTAMP, "utf8")).entries ?? [];
const triggers = JSON.parse(fs.readFileSync(TRIGGERS, "utf8")).entries ?? [];
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
  if (e.verdict !== "stamp") continue;
  const row = rowFor(e); if (!row) continue;
  const v = live[e.pack][e.id];
  for (const [k, val] of Object.entries(e.set ?? {})) {
    if (!k.startsWith("flags.fourththing.")) { problems.push(`${e.name}: refusing to set ${k} (flags only)`); continue; }
    const leaf = k.slice("flags.fourththing.".length);
    if (leaf === "rerolls") checkRerolls(e.name, val);
    else if (leaf === "npcAuto") for (const p of validateNpcAuto(val, `${e.name}: `)) problems.push(p);
    else if (leaf === "passives") checkPassives(e.name, val);
    else if (leaf === "triggers") checkTriggers(e.name, val);
    else problems.push(`${e.name}: ${k} is not a pass-7 flag`);
    if (leaf === "passives") {   // merge with the item's existing passives (movement / vision / initiative stay)
      const cur = getP(v, k) ?? {};
      row.set[k] = { ...cur, ...val }; row.expect[k] = Object.keys(cur).length ? cur : null;
    } else { row.set[k] = val; row.expect[k] = getP(v, k) ?? null; }
    tally.flags++; tally.byFlag[leaf] = (tally.byFlag[leaf] || 0) + 1;
  }
  if (e.why) row.why.push(e.why);
}
for (const e of triggers) {
  if (!Array.isArray(e.triggers)) continue;
  const row = rowFor(e); if (!row) continue;
  checkTriggers(e.name, e.triggers);
  row.set["flags.fourththing.triggers"] = e.triggers; row.expect["flags.fourththing.triggers"] = getP(live[e.pack][e.id], "flags.fourththing.triggers") ?? null; tally.triggers++;
  if (e.why) row.why.push(`triggers: ${e.why}`);
}
for (const row of byKey.values()) if (Object.keys(row.set).length) { plan.push(row); tally.items++; }
if (problems.length) { console.error("INVALID pass-7 data:\n  " + problems.join("\n  ")); process.exit(1); }

const OUT = path.join(HERE, "regimen-pass7.macro.js");
fs.writeFileSync(OUT, `/* regimen-pass7.macro.js — REGIMEN pass 7: executing automation data for the pass-5 backlog (GENERATED ${new Date().toISOString().slice(0, 10)}
 * by build-regimen-pass7.mjs — do not hand-edit). GM macro on EMBER. DRY_RUN = true prints the plan, writes nothing.
 * Needs the 2026-10-07 system build (trigger events/kinds, reroll when vocab, passives.ranks/checkBonus/aura, npcAuto use/attacked
 * extensions) deployed + pm2-restarted first. Writes each PACK item by id AND every WORLD copy embedded on actors (matched by
 * system.identifier, else exact name + type). Every flag is guarded by its expected old value (absent-or-equal). Re-run safe.
 * Tally: ${JSON.stringify(tally)}
 */
const DRY_RUN = true;
const PLAN = ${JSON.stringify(plan)};
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  if (!game.fourththing?.triggers?.kinds?.includes?.("modify-incoming-damage")) return ui.notifications.error("The 2026-10-07 system build is not running here — deploy + pm2 restart first.");
  const eq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const get = foundry.utils.getProperty;
  const log = []; let packWrites = 0, worldWrites = 0, skipped = 0; const unlocked = [];
  const byIdent = new Map(), byName = new Map();
  for (const a of game.actors) for (const it of a.items) {
    const id = String(it.system?.identifier || ""); if (id) (byIdent.get(id) ?? byIdent.set(id, []).get(id)).push(it);
    const nk = it.name + "|" + it.type; (byName.get(nk) ?? byName.set(nk, []).get(nk)).push(it);
  }
  const apply = async (doc, row, where) => {
    const upd = {};
    for (const [k, v] of Object.entries(row.set)) { const cur = get(doc, k); if (cur === undefined || cur === null || eq(cur, row.expect[k]) || (Array.isArray(cur) && !cur.length) || eq(cur, v)) { if (!eq(cur, v)) upd[k] = v; } else { log.push(\`✗ drift \${where} \${row.name} \${k.split(".").slice(-1)[0]}: live ≠ expected — skipped\`); } }
    if (!Object.keys(upd).length) return false;
    log.push(\`\${DRY_RUN ? "·" : "✔"} \${where} \${row.name}: \${Object.keys(upd).map(k => k.split(".").slice(-1)[0]).join(", ")}\`);
    if (!DRY_RUN) await doc.update(upd);
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
  console.log(\`[regimen-pass7] \${DRY_RUN ? "DRY RUN" : "APPLIED"} — \${packWrites} pack item(s), \${worldWrites} world copy(ies), \${skipped} skipped\` + (skips.length ? "\\nSKIPPED:\\n" + skips.join("\\n") + "\\n" : "\\n") + log.filter(l => !l.startsWith("✗")).join("\\n"));
  ui.notifications.info(\`regimen-pass7 \${DRY_RUN ? "dry run" : "applied"}: \${packWrites} pack + \${worldWrites} world, \${skipped} skipped — see console (F12).\`);
})();
`);
console.log(`build-regimen-pass7 → ${path.relative(process.cwd(), OUT)}  ${JSON.stringify(tally)}`);

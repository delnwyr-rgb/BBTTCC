#!/usr/bin/env node
/* build-record-sigils.mjs — REGIMEN pass 8: rules text + payload for the 13 empty Record sigils (fourththing.starter-manifestations,
 * folder "Bad Eden Manifestations"; Pactkeeper / Jurisdiction: Records & Precedent voice).
 * Usage (repo root): node modules/bbttcc-master-content/tools/build-record-sigils.mjs <packs-dir> [data/record-sigils-pass8.json]
 *   → writes tools/regimen-pass8-record-sigils.macro.js  [DRY_RUN=true]
 * Writes system.effect / flavor / tags / description (⚙️ Mechanical Effects block) / manifestation (merged) / damageRoll — only while
 * the live effect text is still EMPTY (the guard); world copies by exact name + type. Shapes mirror the filled T1 sigils (Invisible Clowns,
 * Footnote): appliedStates carries the save; damage rides damageRoll (psychic → Stress).
 */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [PACKS, DATA = path.join(HERE, "data/record-sigils-pass8.json")] = process.argv.slice(2);
if (!PACKS) { console.error("usage: build-record-sigils.mjs <packs-dir> [record-sigils-pass8.json]"); process.exit(2); }
const CONDITIONS = new Set(["staggered", "scarred", "calmed", "blinded", "prone", "shaken", "burning", "restrained", "charmed", "compelled", "imposed"]);
const ATTRS = new Set(["violence", "intrigue", "presence", "body", "mind", "soul"]);
const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
const live = Object.fromEntries(fs.readFileSync(path.join(PACKS, "starter-manifestations.jsonl"), "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)).filter(r => r.k.startsWith("!items!")).map(r => [r.v._id, r.v]));
const strip = (h) => String(h ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const problems = [], plan = [];
for (const e of data.entries) {
  const v = live[e.id];
  if (!v) { problems.push(`${e.name}: not in the live dump`); continue; }
  if (v.name !== e.name) { problems.push(`${e.id}: live "${v.name}" ≠ "${e.name}"`); continue; }
  if (strip(v.system?.effect)) { problems.push(`${e.name}: live effect is no longer empty — refusing to overwrite`); continue; }
  for (const s of e.states) if (!CONDITIONS.has(s)) problems.push(`${e.name}: state "${s}"`);
  if (e.save && !ATTRS.has(e.save)) problems.push(`${e.name}: save "${e.save}"`);
  if (!e.states.length && !e.damage) problems.push(`${e.name}: no payload`);
  if (e.damage && !(e.damage.number > 0 && /^d\d+$/.test(e.damage.die))) problems.push(`${e.name}: damage ${JSON.stringify(e.damage)}`);
  const f = data.frame, m = v.system.manifestation ?? {};
  const saveLine = e.save ? `${cap(e.save)} defense vs Cast DC` : "none (willing ally)";
  const effectLine = e.damage ? `${e.damage.number}${e.damage.die} psychic damage to Stress` : `${e.states.map(cap).join(", ")} for ${e.duration === "instant" ? "the moment" : e.duration.replace("-", " ")}`;
  const description = `\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>${e.mechanicalHook}</p>\n<ul>\n  <li><strong>Intent:</strong> ${cap(f.intent)}</li>\n  <li><strong>Action:</strong> ${cap(f.activation)}</li>\n  <li><strong>Range:</strong> ${cap(f.range)}</li>\n  <li><strong>Target:</strong> ${cap(f.target)}</li>\n  <li><strong>Target:</strong> ${e.targetText}</li>\n  <li><strong>Cost:</strong> ${f.clarity} Clarity</li>\n  <li><strong>Save:</strong> ${saveLine}</li>\n  <li><strong>Effect:</strong> ${effectLine}</li>\n  <li><strong>Duration:</strong> ${e.duration === "instant" ? "Instant" : cap(e.duration.replace("-", " "))}</li>\n  <li><strong>Tier:</strong> T${f.tier}</li>\n</ul>\n<p><strong>Risk:</strong> ${e.riskText}</p>\n<!-- BBTTCC:MECHANICS:END -->`;
  const manifestation = { ...m, concept: e.concept, form: "sigil", function: e.function, stability: "instant", interactionModel: e.save ? "directed" : "event",
    duration: e.duration, durationText: e.duration === "instant" ? "" : "Until the end of the target's next turn.", targetText: e.targetText, triggerText: e.triggerText || "",
    riskText: e.riskText, mechanicalHook: e.mechanicalHook, signature: e.signature || "", pathResonance: "Pactkeeper / Jurisdiction: Records & Precedent / make outcomes stick, make contradiction expensive.",
    fictionalPermission: "You administer continuity of meaning: what counts as having happened and how strongly it pulls on the present.",
    gmCalibration: "T1 civic-authority sigil: one creature, one round, one condition or 1d6 Stress. Keep the Record flavour procedural, not mind control.",
    scale: "personal", costType: "clarity", costValue: f.clarity, costText: `${f.clarity} Clarity`,
    appliedStates: { states: e.states, duration: e.duration === "instant" ? "1-round" : e.duration, saveEachRound: false, saveAttribute: e.save || "", saveDcMode: e.save ? "cast-dc" : "none", saveDcFixed: 15, saveAttributeOverrides: {} },
    area: { shape: "none", size: 0 } };
  const damageRoll = e.damage ? { op: "damage", number: e.damage.number, die: e.damage.die, attribute: f.intent, type: "psychic", flavor: "", track: "stress" } : (v.system.damageRoll ?? { op: "none", number: 0, die: "d6", attribute: "", type: "kinetic", flavor: "", track: "integrity" });
  plan.push({ id: e.id, name: e.name, type: v.type, set: {
    "system.effect": e.effect, "system.flavor": e.flavor, "system.tags": ["starter", "manifestation", "pactkeeper", "record", "precedent"],
    "system.description.value": description, "system.manifestation": manifestation, "system.damageRoll": damageRoll }, expectEffect: "" });
}
if (problems.length) { console.error("INVALID record-sigil data:\n  " + problems.join("\n  ")); process.exit(1); }
const OUT = path.join(HERE, "regimen-pass8-record-sigils.macro.js");
fs.writeFileSync(OUT, `/* regimen-pass8-record-sigils.macro.js — rules text + payload for the 13 empty Record sigils (GENERATED ${new Date().toISOString().slice(0, 10)}
 * by build-record-sigils.mjs — do not hand-edit). GM macro on EMBER. DRY_RUN = true prints the plan, writes nothing.
 * Guard: a sigil is written only while its live effect text is still EMPTY; world copies matched by exact name + type. Re-run safe. */
const DRY_RUN = true;
const PACK_ID = ${JSON.stringify(data.pack)};
const PLAN = ${JSON.stringify(plan)};
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const strip = (h) => String(h ?? "").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();
  const log = []; let packWrites = 0, worldWrites = 0, skipped = 0;
  const pack = game.packs.get(PACK_ID); if (!pack) return ui.notifications.error(\`pack \${PACK_ID} missing\`);
  const wasLocked = pack.locked;
  const apply = async (doc, row, where) => {
    if (strip(doc.system?.effect)) { log.push(\`✗ \${where} \${row.name}: effect already written — skipped\`); return false; }
    log.push(\`\${DRY_RUN ? "·" : "✔"} \${where} \${row.name}: effect, flavor, tags, description, manifestation, damageRoll\`);
    if (!DRY_RUN) await doc.update(row.set);
    return true;
  };
  try {
    if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
    for (const row of PLAN) {
      const doc = await pack.getDocument(row.id).catch(() => null);
      if (!doc) { log.push(\`✗ [pack] \${row.name} missing\`); skipped++; }
      else if (doc.name !== row.name) { log.push(\`✗ [pack] \${row.name} is now "\${doc.name}"\`); skipped++; }
      else if (await apply(doc, row, "[pack]")) packWrites++;
      for (const a of game.actors) for (const it of a.items) if (it.name === row.name && it.type === row.type) { if (await apply(it, row, "[world " + a.name + " ›]")) worldWrites++; }
    }
  } finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  console.log(\`[regimen-pass8-record-sigils] \${DRY_RUN ? "DRY RUN" : "APPLIED"} — \${packWrites} pack, \${worldWrites} world, \${skipped} skipped\\n\` + log.join("\\n"));
  ui.notifications.info(\`record sigils \${DRY_RUN ? "dry run" : "applied"}: \${packWrites} pack + \${worldWrites} world, \${skipped} skipped — see console (F12).\`);
})();
`);
console.log(`build-record-sigils → ${path.relative(process.cwd(), OUT)}  ${plan.length} sigils`);

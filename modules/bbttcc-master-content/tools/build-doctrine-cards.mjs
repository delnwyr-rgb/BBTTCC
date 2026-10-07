#!/usr/bin/env node
/* build-doctrine-cards.mjs — REGIMEN pass 6: owner-approved rules text + honest cost lines onto doctrine cards.
 * Usage (repo root): node modules/bbttcc-master-content/tools/build-doctrine-cards.mjs <doctrines-drafts.json> <doctrine-costs.json> <doctrines.jsonl>
 *   → writes modules/bbttcc-master-content/tools/regimen-pass6-doctrine-cards.macro.js
 * Owner rulings 2026-10-06 (markup doc, tab "Doctrine rules"): Keep = Y on 47 of 63 · cost lines read in MARKS with every
 * channel the engine bills (incl. Soft Power) · siege cards show BOTH tempos (queued price + clash price) · the nine executing
 * keys lose `meta.storyOnly` · the retired archetype names become the tarot names now in play.
 * Writes: flags.bbttcc.effects.text (the rule), system.description.value (name + rule + cost line), flags.bbttcc.meta.storyOnly.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [DRAFTS, COSTS, DUMP] = process.argv.slice(2);
if (!DRAFTS || !COSTS || !DUMP) { console.error("usage: build-doctrine-cards.mjs <doctrines-drafts.json> <doctrine-costs.json> <doctrines.jsonl>"); process.exit(2); }
const HERE = path.dirname(fileURLToPath(import.meta.url));
const drafts = JSON.parse(fs.readFileSync(DRAFTS, "utf8")).entries;
const costs = JSON.parse(fs.readFileSync(COSTS, "utf8"));
const live = Object.fromEntries(fs.readFileSync(DUMP, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)).filter(r => r.k.startsWith("!items!")).map(r => [r.v.flags?.bbttcc?.key, r.v]));

// Keep = Y (the owner's ticks, 2026-10-06). Unticked: the last four optacts and all twelve raid options — held back.
const UNTICKED = new Set(["optact_philosophic_exchange", "optact_ritual_binding", "optact_silent_brotherhood", "optact_thread_the_spread",
  "opt_bureaucratic_override", "opt_formal_parley", "opt_inherited_deference", "opt_make_do_and_hold", "opt_pierce_the_veil", "opt_prepared_insight",
  "opt_rapid_transmutation", "opt_shock_command", "opt_sight_of_the_tree", "opt_silent_entry", "opt_turn_the_card", "opt_veiled_access"]);
// The owner flagged these archetype names as retired; the live Archetype items are tarot-named (npcs/ancestries 2026-10-06).
const ARCHETYPE = { "Mayor-Administrator": "The Emperor (Administrator)", "Wizard-Scholar": "The Magician (Scholar)", "Warlord": "Strength (Warlord)", "Ancient Blood": "The Moon (Ancient Blood)", "Squad Leader": "The Chariot (Squad Leader)" };
const NOT_STORY_ONLY = new Set(["gather_intel", "loyalty_program", "propaganda_campaign", "alignment_shift", "cultural_festival_std", "develop_infrastructure_std", "diplomatic_mission_std", "optact_ritual_binding", "optact_operational_cohesion"]);
const CHANNEL = { violence: "Violence", intrigue: "Intrigue", presence: "Presence", softpower: "Soft Power", softPower: "Soft Power", diplomacy: "Diplomacy", economy: "Economy", nonlethal: "Nonlethal", faith: "Faith", logistics: "Logistics", culture: "Culture" };
const costLine = c => Object.entries(c).map(([k, v]) => `${CHANNEL[k] ?? k} ${v}`).join(" · ");
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const plan = [], tally = { cards: 0, held: 0, storyOnly: 0, archetype: 0 }, problems = [];
for (const d of drafts) {
  const v = live[d.key]; if (!v) { problems.push(`${d.key} not in the live doctrines pack`); continue; }
  if (UNTICKED.has(d.key)) { tally.held++; continue; }
  let text = d.text;
  for (const [old, now] of Object.entries(ARCHETYPE)) if (text.startsWith(old)) { text = now + text.slice(old.length); tally.archetype++; }
  const c = costs[d.key]; if (!c?.cost) { problems.push(`${d.key}: no engine cost`); continue; }
  const queued = costLine(c.cost);
  const cost = c.clashCost ? `Queued on the strategic turn: ${queued} marks. Fired in the clash: ${c.clashCost} marks from ${/defender/.test(text) ? "the garrison's bank" : "the siege Buffer"}.` : `Cost: ${queued} marks.`;
  const desc = `<p><strong>${esc(v.name.replace(/^⭐ /, ""))}</strong></p><p>${esc(text)}</p><p><em>${esc(cost)}</em></p><p style="opacity:.6;font-size:.85em">BBTTCC Doctrine • ${esc(d.kind)} • ${esc(d.key)}</p>`;
  const row = { id: v._id, key: d.key, name: v.name, set: { "flags.bbttcc.effects.text": text, "system.description.value": desc }, notes: ["rules text", "cost line (marks)"] };
  if (NOT_STORY_ONLY.has(d.key) && v.flags?.bbttcc?.meta?.storyOnly) { row.set["flags.bbttcc.meta.storyOnly"] = false; row.notes.push("storyOnly → false"); tally.storyOnly++; }
  plan.push(row); tally.cards++;
}
if (problems.length) { console.error("PROBLEMS:\n  " + problems.join("\n  ")); process.exit(1); }

const OUT = path.join(HERE, "regimen-pass6-doctrine-cards.macro.js");
fs.writeFileSync(OUT, `/* regimen-pass6-doctrine-cards.macro.js — doctrine cards get their rules text + honest cost lines (GENERATED ${new Date().toISOString().slice(0, 10)}
 * by build-doctrine-cards.mjs — do not hand-edit). GM macro on EMBER; DRY_RUN = true prints the plan.
 * Writes the compendium bbttcc-master-content.doctrines (by key) AND any world copy embedded on an actor (same key).
 * Tally: ${JSON.stringify(tally)}
 */
const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.doctrines";
const PLAN = ${JSON.stringify(plan)};
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const pack = game.packs.get(PACK_ID); if (!pack) return ui.notifications.error(\`No pack \${PACK_ID}\`);
  const log = []; let packWrites = 0, worldWrites = 0, skipped = 0;
  const wasLocked = pack.locked; if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
  const worldByKey = new Map(); for (const a of game.actors) for (const it of a.items) { const k = it.flags?.bbttcc?.key; if (k) (worldByKey.get(k) ?? worldByKey.set(k, []).get(k)).push(it); }
  try {
    for (const row of PLAN) {
      const doc = await pack.getDocument(row.id).catch(() => null);
      if (!doc || doc.flags?.bbttcc?.key !== row.key) { log.push(\`✗ [pack] \${row.name} (\${row.key}) missing or key changed\`); skipped++; }
      else { log.push(\`\${DRY_RUN ? "·" : "✔"} [pack] \${doc.name}: \${row.notes.join(", ")}\`); if (!DRY_RUN) await doc.update(row.set); packWrites++; }
      for (const it of worldByKey.get(row.key) ?? []) { log.push(\`\${DRY_RUN ? "·" : "✔"} [world \${it.parent.name} ›] \${it.name}\`); if (!DRY_RUN) await it.update(row.set); worldWrites++; }
    }
  } finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  console.log(\`[regimen-pass6-doctrine-cards] \${DRY_RUN ? "DRY RUN" : "APPLIED"} — \${packWrites} card(s), \${worldWrites} world copy(ies), \${skipped} skipped\\n\` + log.join("\\n"));
  ui.notifications.info(\`regimen-pass6 \${DRY_RUN ? "dry run" : "applied"}: \${packWrites} cards + \${worldWrites} world, \${skipped} skipped — see console (F12).\`);
})();
`);
console.log(`build-doctrine-cards → ${path.relative(process.cwd(), OUT)}  ${JSON.stringify(tally)}`);

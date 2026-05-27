// BBTTCC master-content / tools / rewrite-harmony-marshal-bodies.macro.js
//
// Refreshes the description bodies for the Harmony Marshal class doc + its three
// Mandates (Accord / Overwatch / Resolve) so the TEXT matches the post-redesign
// CRUNCH (the Surge harvest + the Surge-spent rally/mandate abilities + the
// aidBanked auto-reroll), in Mal's voice — replacing the narrative-only text and
// the "[TBD:balance] / Command" placeholders.
//
// Updates BOTH the compendium pack source AND existing embedded copies on world
// actors. Preserves name/identifier/advancement/flags; replaces system.description.value.
//
// USAGE: paste into a script macro (or console). DRY_RUN=true → review the
// console (F12) table; DRY_RUN=false → write.

const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.classes";

const BASE_BODY = `
<p><em>"You're not the hero. You're the reason the heroes don't trip over each other."</em></p>
<p>The Harmony Marshal runs on <strong>Surge</strong> like everyone — but yours arrives sideways: when an ally within 30 ft lands a surging roll (an exploding 10), the brilliance resonates into you and you bank a Surge too (+1, max +2/round). The party's best moments are your fuel; you spend them feeding the party back. Your tier powers are Surge spends, and the rerolls <em>auto-fire</em> now — no GM bookkeeping:</p>
<h3>The Mandate (spent via Surge)</h3>
<ul>
  <li><strong>Rallying Words</strong> (1) — an ally banks a <strong>reroll-lowest</strong> on their next roll.</li>
  <li><strong>Ease Attrition</strong> (2) — heal an ally and clear one condition.</li>
  <li><strong>Rally to Me</strong> (2) — an ally banks a reroll <em>and</em> frees a reaction.</li>
  <li><strong>Unity Flourish</strong> (3) — every ally within 30 ft banks a reroll.</li>
  <li><strong>Conductor's Crescendo</strong> (5) — the whole line banks a reroll and each clears a condition.</li>
</ul>
<p>The strategic layer endures out of combat — Attrition Easer, Loyalty Steward, and Unity Conductor still move Soft Power, attrition, and hex loyalty on the campaign turn. In a fight, though, you are a reroll engine: the dice obey you because you asked nicely, at exactly the right moment.</p>
`.trim();

const ACCORD_BODY = `
<p><em>"Act as one."</em></p>
<p><strong>Mode:</strong> Unity · <strong>Drift:</strong> Toward</p>
<p>Accord makes a squad move like a single animal with too many legs and no argument about which way to run. Your Surge spends turn coordination into mechanics — partners feeding each other rerolls, focus-fire that compounds, a whole line acting on one breath.</p>
<h3>Doctrine (spent via Surge)</h3>
<ul>
  <li><strong>Shared Breath</strong> (1) — name an Accord Partner: you and they each bank a reroll-lowest, and they may take a reaction right now.</li>
  <li><strong>Synchronized Advance</strong> (3) — allies within 30 ft bank a reroll on their next attack. Pile onto one target; the second blow lands in the hole the first made.</li>
  <li><strong>Group Turn</strong> (5) — allies within 30 ft each gain a freed bonus action, resolving together.</li>
</ul>
<p><em>Out-of-combat:</em> Accord Engine (bend a Parley toward peace), Unity Cadence (+Unity for a clean scene), and Resonant Truce (the de-escalation aura) remain the strategic flourishes.</p>
`.trim();

const OVERWATCH_BODY = `
<p><em>"Nothing unobserved."</em></p>
<p><strong>Mode:</strong> Tactical discipline · <strong>Drift:</strong> Sideways</p>
<p>Overwatch is the Marshal who already saw the ambush and is faintly bored by it. Your Surge spends are reactive armor — covering allies the instant they're threatened, countering the enemy's tricks, and drawing a line nobody crosses for free.</p>
<h3>Doctrine (spent via Surge)</h3>
<ul>
  <li><strong>Covered</strong> (1) — an ally gains DR equal to your tier this round (the Network has them).</li>
  <li><strong>Counter-Discord</strong> (2) — strip a debuff off an ally and hand them a reroll. The lie stops working.</li>
  <li><strong>Locked Perimeter</strong> (4) — allies within 30 ft gain DR. Hold the ground.</li>
</ul>
<p><em>Out-of-combat:</em> the per-use Counter-Discord reaction (cancel a deceit-based reroll within 60 ft) and the hex-scale All-Seeing Eye remain the strategic flourishes.</p>
`.trim();

const RESOLVE_BODY = `
<p><em>"No one breaks."</em></p>
<p><strong>Mode:</strong> Persistence · <strong>Drift:</strong> Away</p>
<p>Resolve is stubbornness elevated to a tactical doctrine. Your Surge spends keep people standing past the point they should have fallen — shrugging off fear, refusing the killing blow, and once a fight, refusing a death outright.</p>
<h3>Doctrine (spent via Surge)</h3>
<ul>
  <li><strong>Hold the Line</strong> (1) — clear Shaken off an ally and hand them a reroll. No one breaks.</li>
  <li><strong>Second Wind</strong> (3) — ward an ally: the next hit that would drop them holds them at 1 Integrity.</li>
  <li><strong>None Lost</strong> (5) — refuse a death: restore a fallen ally to half Integrity and ward them. Once per fight. Not this one. Not today.</li>
</ul>
<p><em>Out-of-combat:</em> Ground Not Yielded, the Long Watch (a restorative rest in hostile territory), and the None-Lost session capstone remain the strategic flourishes.</p>
`.trim();

const TARGETS = [
  { label: "Harmony Marshal (class)",  type: "class",    needles: ["harmony", "marshal"],   body: BASE_BODY },
  { label: "Mandate of Accord",        type: "subclass", needles: ["mandate of accord"],     body: ACCORD_BODY },
  { label: "Mandate of Overwatch",     type: "subclass", needles: ["mandate of overwatch"],  body: OVERWATCH_BODY },
  { label: "Mandate of Resolve",       type: "subclass", needles: ["mandate of resolve"],    body: RESOLVE_BODY },
];
const matchTarget = (doc) => TARGETS.find(t =>
  doc.type === t.type &&
  t.needles.every(n => String(doc.name ?? "").toLowerCase().includes(n)));

const report = [];

// 1) Compendium pack source
const pack = game.packs.get(PACK_ID);
if (!pack) { ui.notifications.error(`Pack ${PACK_ID} not found.`); }
else {
  const wasLocked = pack.locked;
  if (wasLocked && !DRY_RUN) await pack.configure({ locked: false });
  const docs = await pack.getDocuments();
  const updates = [];
  for (const t of TARGETS) {
    const doc = docs.find(d => matchTarget(d) === t);
    if (!doc) { report.push({ where: "PACK", target: t.label, status: "NOT FOUND" }); continue; }
    updates.push({ _id: doc.id, "system.description.value": t.body });
    report.push({ where: "PACK", target: t.label, doc: doc.name, status: DRY_RUN ? "would rewrite" : "rewritten" });
  }
  if (!DRY_RUN && updates.length) await pack.documentClass.updateDocuments(updates, { pack: PACK_ID });
  if (wasLocked && !DRY_RUN) await pack.configure({ locked: true });
}

// 2) Embedded copies on world actors
for (const actor of game.actors) {
  const ups = [];
  for (const it of actor.items) {
    const t = matchTarget(it);
    if (!t) continue;
    ups.push({ _id: it.id, "system.description.value": t.body });
    report.push({ where: `actor:${actor.name}`, target: t.label, doc: it.name, status: DRY_RUN ? "would rewrite" : "rewritten" });
  }
  if (!DRY_RUN && ups.length) await actor.updateEmbeddedDocuments("Item", ups);
}

console.group("[rewrite-harmony-marshal-bodies]");
console.log("DRY_RUN:", DRY_RUN);
console.table(report);
console.groupEnd();
const n = report.filter(r => r.status !== "NOT FOUND").length;
ui.notifications.info(`Harmony Marshal bodies: ${DRY_RUN ? "would rewrite" : "rewrote"} ${n} item(s). See console (F12).`);

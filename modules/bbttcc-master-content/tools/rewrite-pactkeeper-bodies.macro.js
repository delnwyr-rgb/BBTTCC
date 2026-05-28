// BBTTCC master-content / tools / rewrite-pactkeeper-bodies.macro.js
//
// Refreshes the description bodies for the Pactkeeper class doc + its three
// doctrines (Archivist of Precedent / Auditor / Steward of Living Communities) so
// the TEXT matches the post-redesign CRUNCH — the "obligation compounds" Surge
// generator, the base enforcer kit, and the 9 doctrine Surge spends — in Mal's
// voice. The canon 4 (The Bargain / Renegotiate / Sealed Pact / Ledger Day) survive
// as the pact/concurrency layer; the orphan leverage/civic-charge/pressure pools
// were purged (see prune-pactkeeper-cruft.macro.js for the dead feat items).
//
// Updates BOTH the compendium pack source AND embedded copies on world actors.
// Preserves name/identifier/advancement/flags; replaces system.description.value.
//
// USAGE: paste into a script macro. DRY_RUN=true → review console (F12); false → write.

const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.classes";

const BASE_BODY = `
<p><em>"You do not argue with the law. You are the clerk who files it."</em></p>
<p>The Pactkeeper runs on <strong>Surge</strong>, like everyone — and yours <strong>compounds</strong>: at the start of your turn, bank <strong>+1 Surge for each manifestation you're sustaining</strong> (max +2). The longer the pacts run, the more leverage accrues. The old leverage / civic-charge / pressure pools are gone; one currency now.</p>
<h3>The Enforcer (spent via Surge)</h3>
<ul>
  <li><strong>Invoke Clause</strong> (1) — name a clause on a foe: its next attack is at disadvantage.</li>
  <li><strong>Binding Writ</strong> (3) — a foe is Staggered and rolls its saves at disadvantage until your next turn.</li>
  <li><strong>Shelter the Bound</strong> (5) — you and an ally gain DR equal to Tier; the next hit that would drop them holds at 1.</li>
  <li><strong>Sovereign Writ</strong> (8) — a foe cannot take reactions and rolls its next attack <em>and</em> saves at disadvantage.</li>
</ul>
<p>The pact layer endures: <strong>The Bargain</strong> binds a subject (sustain on it at no extra Clarity upkeep), <strong>Renegotiate</strong> converts a misfire into accepted debt, <strong>Sealed Pact</strong> is your stance (+concurrency, no voluntary drop on the bound), and <strong>Ledger Day</strong> transfers a sustained manifestation to a willing ally.</p>
`.trim();

const ARCHIVIST_BODY = `
<p><em>"This was already decided. Long ago. In your favor."</em></p>
<p><strong>Doctrine:</strong> History as leverage — past rulings and remembered vows do work in the present; indexed, cited, hard to argue with.</p>
<p>The Archivist of Precedent wins the argument before it starts. Your Surge spends turn the record into force: cite the ruling that backs you, bind a foe to a precedent it cannot escape, and close the matter for good.</p>
<h3>Doctrine (spent via Surge)</h3>
<ul>
  <li><strong>Cite Precedent</strong> (1) — you and an ally each bank a reroll (the record supports you).</li>
  <li><strong>Stare Decisis</strong> (2) — a foe's next attack and its saves are at disadvantage (bound by precedent).</li>
  <li><strong>Res Judicata</strong> (5) — a foe cannot take reactions and rolls its saves at disadvantage. The matter is closed; there is no appeal.</li>
</ul>
`.trim();

const AUDITOR_BODY = `
<p><em>"I've seen the real ledger. You're overdrawn."</em></p>
<p><strong>Doctrine:</strong> Expose imbalance, debt, fraud, hidden cost — make somebody owe the room an answer.</p>
<p>The Auditor finds what's owed and collects it, violently if necessary. Your Surge spends are the reckoning: expose the hidden cost as damage, levy a penalty that staggers, and foreclose when the debt is called in full.</p>
<h3>Doctrine (spent via Surge)</h3>
<ul>
  <li><strong>Expose the Debt</strong> (1) — your next Strike or manifestation deals +Tier d6 (the hidden cost comes due).</li>
  <li><strong>Levy</strong> (2) — a foe is Staggered and its next attack is at disadvantage (payment is due, now).</li>
  <li><strong>Foreclose</strong> (5) — your next Strike lands as a max-die crit and ignores resistances. Everything you have; it was never really yours.</li>
</ul>
`.trim();

const STEWARD_BODY = `
<p><em>"Stand behind the agreement. It was written to hold you."</em></p>
<p><strong>Doctrine:</strong> Protect the agreement and the vulnerable party together — preserve trust while sharpening consequence.</p>
<p>The Steward of Living Communities is the pact's conscience: the boundary that keeps the whole thing from collapsing. Your Surge spends shield the bound — guard the vulnerable, keep a falling ally on their feet, and raise a sanctuary nothing crosses uninvited.</p>
<h3>Doctrine (spent via Surge)</h3>
<ul>
  <li><strong>Shield the Vulnerable</strong> (1) — an ally gains DR equal to Tier and a reroll.</li>
  <li><strong>Keep the Agreement</strong> (2) — heal an ally; the next hit that would drop them holds at 1.</li>
  <li><strong>Sanctuary</strong> (5) — allies within 30 ft gain DR equal to Tier and a freed reaction.</li>
</ul>
`.trim();

const TARGETS = [
  { label: "Pactkeeper (class)",                 type: "class",    needles: ["pactkeeper"], body: BASE_BODY },
  { label: "Archivist of Precedent (doctrine)",  type: "subclass", needles: ["archivist"],  body: ARCHIVIST_BODY },
  { label: "Auditor (doctrine)",                 type: "subclass", needles: ["auditor"],    body: AUDITOR_BODY },
  { label: "Steward of Living Communities",      type: "subclass", needles: ["steward"],    body: STEWARD_BODY },
];
const matchTarget = (doc) => TARGETS.find(t =>
  doc.type === t.type && t.needles.every(n => String(doc.name ?? "").toLowerCase().includes(n)));

const report = [];
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

console.group("[rewrite-pactkeeper-bodies]");
console.log("DRY_RUN:", DRY_RUN);
console.table(report);
console.groupEnd();
const n = report.filter(r => r.status !== "NOT FOUND").length;
ui.notifications.info(`Pactkeeper bodies: ${DRY_RUN ? "would rewrite" : "rewrote"} ${n} item(s). See console (F12).`);

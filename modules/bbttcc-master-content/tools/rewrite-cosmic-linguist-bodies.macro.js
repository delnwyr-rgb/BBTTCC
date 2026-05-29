// BBTTCC master-content / tools / rewrite-cosmic-linguist-bodies.macro.js
//
// Refreshes the description bodies for the Cosmic Linguist class doc + its three
// doctrines (Annotator / Metaphor Apostle / Redactor) so the TEXT matches the
// post-redesign CRUNCH — the "editor always has the next word" Surge generator
// (+1/turn, folds Resonance), the base edit-reality kit (the old Resonance channels),
// and the 9 doctrine Surge spends (the old Authority Edits) — in Mal's voice. The
// FULL FOLD retired Resonance / Strain / Editorial Authority into one Surge pool;
// "The Sentence" (signature mode) is kept.
//
// Updates BOTH the compendium pack source AND embedded copies on world actors.
// Preserves name/identifier/advancement/flags; replaces system.description.value.
//
// USAGE: paste into a script macro. DRY_RUN=true → review console (F12); false → write.

const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.classes";

const BASE_BODY = `
<p><em>"Strike the clause. Insert your own. Reality reads from the top."</em></p>
<p>The Cosmic Linguist edits reality like text — meaning first, matter second. One currency now: <strong>Surge</strong>. The editor always has the next word, so you bank <strong>+1 Surge at the start of your turn</strong> (the old Resonance, Strain, and Editorial Authority pools are folded into this single pool).</p>
<h3>The Edit (spent via Surge)</h3>
<ul>
  <li><strong>Emphasis</strong> (1) — your next Strike or manifestation hits for +Tier d6 (the word, underlined).</li>
  <li><strong>Stabilize</strong> (2) — you gain DR equal to Tier; your next cast resists counter / dispel (the sentence holds).</li>
  <li><strong>Impose a Reading</strong> (3) — a foe's next attack and its saves are at disadvantage (only one correct interpretation: yours).</li>
  <li><strong>Rewrite the Sentence</strong> (5) — a foe loses its reactions and rolls saves at disadvantage; allies near you bank a reroll.</li>
</ul>
<p><strong>The Sentence</strong> endures as your signature stance — while held, the manifestation's primary target is bound by name and rolls its saves against you at disadvantage.</p>
`.trim();

const ANNOTATOR_BODY = `
<p><em>"See below. It changes everything above."</em></p>
<p><strong>Doctrine:</strong> Prefer surgical changes with precise scope — a small note that produces a large consequence. You are strongest when the edit looks modest.</p>
<p>The Annotator wins in the margins. Your Surge spends are footnotes with teeth: shore up an ally's roll, pin a foe with marginalia it cannot ignore, and revise the whole passage at once.</p>
<h3>Doctrine (spent via Surge)</h3>
<ul>
  <li><strong>Footnote</strong> (1) — an ally banks a reroll-lowest (a small note, a large consequence).</li>
  <li><strong>Marginalia</strong> (2) — a foe is Staggered and rolls its saves at disadvantage.</li>
  <li><strong>Revision</strong> (5) — allies within 30 ft each bank a reroll-lowest (the whole passage, corrected).</li>
</ul>
`.trim();

const METAPHOR_BODY = `
<p><em>"Say what counts as what now. Reality is listening."</em></p>
<p><strong>Doctrine:</strong> Reality bends when likeness is declared and believed — your workings hinge on symbolic equivalence.</p>
<p>The Metaphor Apostle rules by declaration. Your Surge spends rewrite what things are: an ally becomes a wall, a foe's armor becomes paper, and your whole line becomes giants.</p>
<h3>Doctrine (spent via Surge)</h3>
<ul>
  <li><strong>Declared Likeness</strong> (1) — "you are a wall": an ally gains DR equal to Tier.</li>
  <li><strong>Declared Frailty</strong> (2) — "their armor is paper": a foe's next attack and its saves are at disadvantage.</li>
  <li><strong>Apotheosis</strong> (5) — "you are all giants": allies within 30 ft gain DR equal to Tier and a reroll.</li>
</ul>
`.trim();

const REDACTOR_BODY = `
<p><em>"It is not there anymore. It was never there."</em></p>
<p><strong>Doctrine:</strong> Power lies in omission, silence, and removal — a good redaction is terrifying because it leaves clean edges. Ask what word, path, memory, or option disappears.</p>
<p>The Redactor wins by deletion. Your Surge spends remove things from the sentence: an affliction off an ally, a foe's options, or the foe's entire standing as a threat.</p>
<h3>Doctrine (spent via Surge)</h3>
<ul>
  <li><strong>Redact</strong> (1) — strike one condition off an ally (clean edges where it used to be).</li>
  <li><strong>Silence</strong> (2) — a foe cannot take reactions until your next turn (its options, omitted).</li>
  <li><strong>Erasure</strong> (5) — a foe is Staggered, cannot take reactions, and rolls its saves at disadvantage (struck from the sentence).</li>
</ul>
`.trim();

const TARGETS = [
  { label: "Cosmic Linguist (class)",   type: "class",    needles: ["cosmic linguist"], body: BASE_BODY },
  { label: "Annotator (doctrine)",      type: "subclass", needles: ["annotator"],       body: ANNOTATOR_BODY },
  { label: "Metaphor Apostle (doctrine)", type: "subclass", needles: ["metaphor"],      body: METAPHOR_BODY },
  { label: "Redactor (doctrine)",       type: "subclass", needles: ["redactor"],        body: REDACTOR_BODY },
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

console.group("[rewrite-cosmic-linguist-bodies]");
console.log("DRY_RUN:", DRY_RUN);
console.table(report);
console.groupEnd();
const n = report.filter(r => r.status !== "NOT FOUND").length;
ui.notifications.info(`Cosmic Linguist bodies: ${DRY_RUN ? "would rewrite" : "rewrote"} ${n} item(s). See console (F12).`);

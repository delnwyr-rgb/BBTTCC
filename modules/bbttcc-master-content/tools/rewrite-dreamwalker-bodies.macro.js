// Bad Eden master-content / tools / rewrite-dreamwalker-bodies.macro.js
//
// Refreshes the description bodies for the Dreamwalker class doc + its three
// Trances (Quiet Sun / Sapphire Gate / Thousand Faces) so the TEXT matches the
// post-redesign CRUNCH (the cast→Surge gen + the 4 Surge tier powers + the 9
// Trance Surge spends; Echo Dice folded into Surge; Dream-Cache kept), in Mal's
// voice — replacing the narrative-only text and the "[TBD:balance] / Resonance"
// placeholders. The exploration/social capstones survive as out-of-combat skin.
//
// Updates BOTH the compendium pack source AND embedded copies on world actors.
// Preserves name/identifier/advancement/flags; replaces system.description.value.
//
// USAGE: paste into a script macro. DRY_RUN=true → review console (F12); false → write.

const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.classes";

const BASE_BODY = `
<p><em>"The future is just memory pointed the other way."</em></p>
<p>The Dreamwalker reads the Tree and works manifestations — and that work <em>is</em> the fuel. You run on <strong>Surge</strong> like everyone, but yours arrives when you <strong>cast a manifestation</strong> (bank +1, max +2/round). The old sprawl folds into this: Echo Dice are now Surge, and the eight soma-break feats live on as four tier powers.</p>
<h3>The Oracle (spent via Surge)</h3>
<ul>
  <li><strong>Omen</strong> (1) — you or an ally saw the thread coming: banks a reroll-lowest.</li>
  <li><strong>Dream Ward</strong> (2) — an ally drifts into a protective dreamstate: DR + a reroll.</li>
  <li><strong>Shared Dream</strong> (3) — allies within 30 ft bank a reroll and draw 1 Clarity (refuels their casting).</li>
  <li><strong>Reality Hack</strong> (5) — rewrite the moment: the party banks a reroll and one enemy rolls its next attack at disadvantage.</li>
</ul>
<p>The <strong>Dream-Cache</strong> endures — bank a manifestation between scenes, deploy it next scene without paying Clarity. And the oracle's quiet work stays out of combat: Dream Resonance still senses a hex's Sephirah, and you still Commune with the Great Work for a true answer.</p>
`.trim();

const QUIETSUN_BODY = `
<p><em>"Stillness is the loudest thing."</em></p>
<p><strong>Mode:</strong> Contemplative · <strong>Drift:</strong> Away</p>
<p>The Quiet Sun is the dreamer who stops the room by going still. Your Surge spends turn perception and patience into mechanics — seeing clearly, refusing a death, and forcing a beat of peace into a fight that didn't ask for one.</p>
<h3>Trance (spent via Surge)</h3>
<ul>
  <li><strong>Still Attention</strong> (1) — you and allies within 30 ft bank a reroll-lowest.</li>
  <li><strong>Somnolent Peace</strong> (2) — the next lethal blow against an ally drops them to 1 Integrity (unconscious), not dead.</li>
  <li><strong>Radiant Pause</strong> (3) — nearby enemies are Calmed: a contemplative beat where violence stalls.</li>
</ul>
<p><em>Out-of-combat:</em> The Revelation (ask the GM one true thing), The Unhurried Word, and the Sun-That-Does-Not-Set capstone (no lie holds in your presence) remain the oracle's quiet powers.</p>
`.trim();

const SAPPHIRE_BODY = `
<p><em>"Every threshold is also a doorway."</em></p>
<p><strong>Mode:</strong> Transitional · <strong>Drift:</strong> Sideways</p>
<p>The Sapphire Gate treats walls as suggestions and distance as paperwork. Your Surge spends are repositioning made real — carrying allies clear, stepping through a threshold for the tactical edge, holding the line steady at the door.</p>
<h3>Trance (spent via Surge)</h3>
<ul>
  <li><strong>Gate-Touched</strong> (1) — carry an ally through to safety: DR + a freed reaction.</li>
  <li><strong>Sapphire Step</strong> (2) — you and an ally step through and out elsewhere: each banks a reroll + a freed reaction.</li>
  <li><strong>Gate Held Open</strong> (3) — allies within 30 ft bank a reroll and gain DR (the threshold steadies them).</li>
</ul>
<p><em>Out-of-combat:</em> threshold-sight, the true teleport-by-linkage, the Gate Held Open evacuation, and the Gatewright capstone (make a door where none was) remain the explorer's powers.</p>
`.trim();

const THOUSAND_BODY = `
<p><em>"Identity is negotiable."</em></p>
<p><strong>Mode:</strong> Shape-changer · <strong>Drift:</strong> Toward</p>
<p>The Thousand Faces is never quite where — or who — you swung at. Your Surge spends weaponize misdirection: borrowed faces that can't be hit cleanly, read tells thrown back at the enemy, two of you at once.</p>
<h3>Trance (spent via Surge)</h3>
<ul>
  <li><strong>Borrowed Face</strong> (1) — they can't tell which face is real: you gain DR + bank a reroll.</li>
  <li><strong>Mirror Read</strong> (2) — you wear a foe's tell back at them: it rolls its next attack at disadvantage, and you bank a reroll.</li>
  <li><strong>Shared Face</strong> (3) — you and an ally blur behind borrowed identities: both gain DR.</li>
</ul>
<p><em>Out-of-combat:</em> the Borrowed / Gathered / Composite Faces (full disguise + memory access), Persona Cache, and the Thousand-and-One capstone remain the infiltrator's powers.</p>
`.trim();

const TARGETS = [
  { label: "Dreamwalker (class)",            type: "class",    needles: ["dreamwalker"],         body: BASE_BODY },
  { label: "Trance of the Quiet Sun",        type: "subclass", needles: ["quiet sun"],           body: QUIETSUN_BODY },
  { label: "Trance of the Sapphire Gate",    type: "subclass", needles: ["sapphire gate"],       body: SAPPHIRE_BODY },
  { label: "Trance of the Thousand Faces",   type: "subclass", needles: ["thousand faces"],      body: THOUSAND_BODY },
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

console.group("[rewrite-dreamwalker-bodies]");
console.log("DRY_RUN:", DRY_RUN);
console.table(report);
console.groupEnd();
const n = report.filter(r => r.status !== "NOT FOUND").length;
ui.notifications.info(`Dreamwalker bodies: ${DRY_RUN ? "would rewrite" : "rewrote"} ${n} item(s). See console (F12).`);

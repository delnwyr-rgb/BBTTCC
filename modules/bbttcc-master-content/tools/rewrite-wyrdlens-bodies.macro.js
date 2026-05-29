// BBTTCC master-content / tools / rewrite-wyrdlens-bodies.macro.js
//
// Refreshes the description bodies for the Wyrdlens Adept class doc + its three
// Refractions (Foresight / Mercy / Truth) so the TEXT matches the post-redesign
// CRUNCH — the "every revelation feeds the lens" Surge generator (cast → Surge), the
// base perception kit, and the 9 Refraction Surge spends — in Mal's voice. The free
// Probability Overlay (T2, 1/round reroll) + Tikkun Sight stay as the kept layer.
//
// Updates BOTH the compendium pack source AND embedded copies on world actors.
// Preserves name/identifier/advancement/flags; replaces system.description.value.
//
// USAGE: paste into a script macro. DRY_RUN=true → review console (F12); false → write.

const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.classes";

const BASE_BODY = `
<p><em>"Every structure has a flaw. You only have to look at it correctly."</em></p>
<p>The Wyrdlens Adept turns perception into force. You run on <strong>Surge</strong> like everyone, and yours arrives when you <strong>land a manifestation</strong> (bank +1, max +2/round) — every revelation feeds the lens. The free <strong>Probability Overlay</strong> (1/round reroll-lowest, refreshes at the start of your turn) stays as your innate edge.</p>
<h3>The Lens (spent via Surge)</h3>
<ul>
  <li><strong>Foresight</strong> (1) — you or an ally banks a reroll-lowest (you saw the thread).</li>
  <li><strong>Expose</strong> (2) — a foe's next attack and its saves are at disadvantage (you read the seam).</li>
  <li><strong>Refract</strong> (3) — an ally gains DR equal to Tier and a freed reaction (harm bends aside).</li>
  <li><strong>Revelation</strong> (5) — allies within 30 ft bank a reroll; a foe's next attack is at disadvantage.</li>
</ul>
<p><strong>Tikkun Sight</strong> endures — once per Soma Break, treat a misfire as a base-tier success (the Tree pays in Clarity instead).</p>
`.trim();

const FORESIGHT_BODY = `
<p><em>"You already know how this goes."</em></p>
<p><strong>Refraction:</strong> Anticipation — perception bent toward the next instant; routes, reactions, the moment before the moment.</p>
<p>The Refraction of Foresight reads time a half-second early. Your Surge spends are that edge made real: foreseen rerolls, an ally given room time shouldn't allow, and the strike that simply declines to land.</p>
<h3>Refraction (spent via Surge)</h3>
<ul>
  <li><strong>Anticipation</strong> (1) — you and an ally each bank a reroll (foreseen).</li>
  <li><strong>The Slowed Instant</strong> (2) — an ally gains a freed reaction and DR equal to Tier.</li>
  <li><strong>The Stopped Strike</strong> (5) — a foe is Staggered and its next attack is at disadvantage.</li>
</ul>
`.trim();

const MERCY_BODY = `
<p><em>"Not them. Not like this."</em></p>
<p><strong>Refraction:</strong> Mercy — perception bent toward compassion; motive over action, the prevented blow, the offered exit.</p>
<p>The Refraction of Mercy sees the person inside the threat. Your Surge spends shield and redirect: step between an ally and the hit, send harm into a wall instead, and open a clean way out.</p>
<h3>Refraction (spent via Surge)</h3>
<ul>
  <li><strong>The Prevented Blow</strong> (1) — an ally gains DR equal to Tier (you stepped between).</li>
  <li><strong>Redirected Harm</strong> (2) — an ally gains DR + the next hit that would drop them holds at 1.</li>
  <li><strong>The Open Hand</strong> (5) — heal an ally and clear a condition (offer the clean exit).</li>
</ul>
`.trim();

const TRUTH_BODY = `
<p><em>"I see what you actually are."</em></p>
<p><strong>Refraction:</strong> Truth — perception bent toward exposure; lies, concealment, the thing that does not want to be named.</p>
<p>The Refraction of Truth makes hiding impossible. Your Surge spends strip cover: read a foe true so its defenses fail, name the lie so it stops working, and lay an enemy so bare it has nowhere left to put a single intention.</p>
<h3>Refraction (spent via Surge)</h3>
<ul>
  <li><strong>The Reading Eye</strong> (1) — a foe rolls its saves at disadvantage (you read it true).</li>
  <li><strong>The Unconcealed Word</strong> (2) — a foe is Staggered and its next attack is at disadvantage.</li>
  <li><strong>The Exposure</strong> (5) — a foe cannot take reactions and rolls its saves at disadvantage.</li>
</ul>
`.trim();

const TARGETS = [
  { label: "Wyrdlens Adept (class)",        type: "class",    needles: ["wyrdlens"],  body: BASE_BODY },
  { label: "Refraction of Foresight",       type: "subclass", needles: ["foresight"], body: FORESIGHT_BODY },
  { label: "Refraction of Mercy",           type: "subclass", needles: ["mercy"],     body: MERCY_BODY },
  { label: "Refraction of Truth",           type: "subclass", needles: ["truth"],     body: TRUTH_BODY },
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

console.group("[rewrite-wyrdlens-bodies]");
console.log("DRY_RUN:", DRY_RUN);
console.table(report);
console.groupEnd();
const n = report.filter(r => r.status !== "NOT FOUND").length;
ui.notifications.info(`Wyrdlens bodies: ${DRY_RUN ? "would rewrite" : "rewrote"} ${n} item(s). See console (F12).`);

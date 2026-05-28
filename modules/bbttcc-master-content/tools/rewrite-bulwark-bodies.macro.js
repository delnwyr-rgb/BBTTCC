// BBTTCC master-content / tools / rewrite-bulwark-bodies.macro.js
//
// Refreshes the description bodies for the Bulwark class doc + its three Paths
// (Cataclyst / Avalanche / Mountain) so the TEXT matches the post-redesign CRUNCH
// — the "eat the blow" Surge generator, the re-homed fortress tier (Brace Wall +
// Bulwark Stance / Anchor / Mass Aegis / Sanctum / Mythic Stand, now Bulwark-only),
// and the 9 Path Surge spends — in Mal's voice. The Frame Dice / Ruin Charges +
// Catastrophic Entry / siege layer survives as the strategic skin (Titanbound &
// Breaker were folded into Bulwark; their combat role is now the Surge fortress).
//
// Updates BOTH the compendium pack source AND embedded copies on world actors.
// Preserves name/identifier/advancement/flags; replaces system.description.value.
//
// USAGE: paste into a script macro. DRY_RUN=true → review console (F12); false → write.

const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.classes";

const BASE_BODY = `
<p><em>"Set your feet. The line forms on you."</em></p>
<p>The Bulwark is the wall — and the wall runs on <strong>Surge</strong>, like everyone, but yours arrives the hard way: every time you <strong>take Integrity damage you bank +1 Surge</strong> (max +2/round). You eat the blow and turn it into the power to anchor, erupt, or hold. At zero Surge you still stand in the way; soak one hit and your turn opens up.</p>
<h3>The Fortress (spent via Surge — Bulwark only)</h3>
<ul>
  <li><strong>Brace Wall</strong> (1) — you and adjacent allies gain DR equal to Tier this round.</li>
  <li><strong>Bulwark Stance</strong> (6) — adjacent allies share your defenses until your next turn.</li>
  <li><strong>Anchor</strong> (5) — you and one ally become immune to forced movement and crowd-control until next round.</li>
  <li><strong>Mass Aegis</strong> (8) — allies within Tier squares gain +Tier to every defense this round.</li>
  <li><strong>Sanctum</strong> (9) — immune to one damage type for a round.</li>
  <li><strong>Mythic Stand</strong> (10) — invulnerable until the start of your next turn.</li>
</ul>
<p>These were always the Bulwark's birthright; they no longer leak into everyone else's menu. <strong>Frame Dice</strong> and <strong>Ruin Charges</strong> endure as the strategic layer — Catastrophic Entry still sunders armor and breaches structures, Ruin still cuts a Siege's cost — and both refill on a Soma Break.</p>
`.trim();

const CATACLYST_BODY = `
<p><em>"Something gives way. You aim where."</em></p>
<p><strong>Doctrine:</strong> Controlled eruption — trade stability for force on purpose.</p>
<p>The Cataclyst is the wall that decides to come down on someone. Your Surge spends turn your own stored impact into offense: a strike that erupts, a seam found in anything, a moment where the ground itself gives up standing still.</p>
<h3>Path (spent via Surge)</h3>
<ul>
  <li><strong>Erupt</strong> (1) — your next Strike blazes (+Tier d6 exploding) and hurls the target back.</li>
  <li><strong>Shatter</strong> (3) — your next Strike ignores resistances; the target is Staggered.</li>
  <li><strong>Cataclysm</strong> (5) — your next Strike lands as a max-die crit, and foes in reach are knocked Prone.</li>
</ul>
`.trim();

const AVALANCHE_BODY = `
<p><em>"You do not stop. They learn this the hard way."</em></p>
<p><strong>Doctrine:</strong> Momentum is the point — geography deciding to move.</p>
<p>The Avalanche is mass that arrives all at once. Your Surge spends are forward motion made lethal: barrel through, crash home, and — when it matters — become a thing nothing in the world can currently stop.</p>
<h3>Path (spent via Surge)</h3>
<ul>
  <li><strong>Roll Forward</strong> (1) — your next Strike +Tier d6, and the target is knocked Prone.</li>
  <li><strong>Crash</strong> (3) — your next Strike lands as a max-die crit; the target is Staggered.</li>
  <li><strong>Unstoppable</strong> (5) — immune to forced-movement/CC this round; your next Strike ignores resistances and knocks the target Prone.</li>
</ul>
`.trim();

const MOUNTAIN_BODY = `
<p><em>"You belong here now. Argue with the mountain."</em></p>
<p><strong>Doctrine:</strong> Durability, refusal, rootedness — immovable, load-bearing, patient.</p>
<p>The Mountain makes the scene bounce off you. Your Surge spends are the geometry of refusal: roots that share their footing, a flat "no" to the next thing done to you or yours, and a bastion the whole line forms behind.</p>
<h3>Path (spent via Surge)</h3>
<ul>
  <li><strong>Root</strong> (1) — you and adjacent allies gain DR equal to Tier and cannot be forcibly moved.</li>
  <li><strong>Deny</strong> (2) — you or an ally becomes immune to forced-movement/CC and gains DR this round.</li>
  <li><strong>Bastion</strong> (5) — allies within Tier squares gain DR equal to Tier; you cannot be moved.</li>
</ul>
`.trim();

const TARGETS = [
  { label: "Bulwark (class)",            type: "class",    needles: ["bulwark"],   body: BASE_BODY },
  { label: "Cataclyst (path)",           type: "subclass", needles: ["cataclyst"], body: CATACLYST_BODY },
  { label: "Path of the Avalanche",      type: "subclass", needles: ["avalanche"], body: AVALANCHE_BODY },
  { label: "Path of the Mountain",       type: "subclass", needles: ["mountain"],  body: MOUNTAIN_BODY },
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

console.group("[rewrite-bulwark-bodies]");
console.log("DRY_RUN:", DRY_RUN);
console.table(report);
console.groupEnd();
const n = report.filter(r => r.status !== "NOT FOUND").length;
ui.notifications.info(`Bulwark bodies: ${DRY_RUN ? "would rewrite" : "rewrote"} ${n} item(s). See console (F12).`);

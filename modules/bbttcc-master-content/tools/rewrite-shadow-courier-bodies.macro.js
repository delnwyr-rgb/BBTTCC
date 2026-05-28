// BBTTCC master-content / tools / rewrite-shadow-courier-bodies.macro.js
//
// Refreshes the description bodies for the Shadow Courier class doc + its three
// Routes (Wayfarer / Black Stair / Last Mile) so the TEXT matches the post-redesign
// CRUNCH — the "keep moving" Surge generator (Pace folded into Surge), the base
// mobility/tempo kit, and the 9 Route Surge spends — in Mal's voice. Shadowjack &
// Phantom Courier were folded into Shadow Courier; their combat role is now the
// Surge kit. The Package / delivery layer survives as the strategic skin.
//
// Updates BOTH the compendium pack source AND embedded copies on world actors.
// Preserves name/identifier/advancement/flags; replaces system.description.value.
//
// USAGE: paste into a script macro. DRY_RUN=true → review console (F12); false → write.

const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.classes";

const BASE_BODY = `
<p><em>"You're already moving. The fight rearranges around it."</em></p>
<p>The Shadow Courier runs on <strong>Surge</strong>, like everyone — but yours comes from <strong>motion</strong>. Move <strong>30+ ft in a turn and you bank +1 Surge</strong> (again at 60 ft, max +2/round). A courier in motion has options; a courier standing still is just a target. The old <em>Pace</em> pool folds into this — same fuel, one number.</p>
<h3>The Courier (spent via Surge)</h3>
<ul>
  <li><strong>Courier's Step</strong> (1) — +half-speed move (no provoke) and a freed reaction; flow through the fight.</li>
  <li><strong>Ghoststep</strong> (3) — DR equal to Tier till your next turn, and reposition out of danger.</li>
  <li><strong>Flank &amp; Strike</strong> (5) — reposition, then your next Strike has advantage <em>and</em> +Tier d6.</li>
  <li><strong>No Such Door</strong> (8) — allies within Tier squares each gain a freed reaction and a reroll; open the road for the whole team.</li>
</ul>
<p>The <strong>Package</strong> endures as your work — designate it, carry it, deliver it. <strong>Delivery banks your Surge to full</strong> and still triggers the route's strategic payoff (Intrigue OP, Darkness reduction, the arrival that mattered).</p>
`.trim();

const WAYFARER_BODY = `
<p><em>"Go. I'll hold the way."</em></p>
<p><strong>Doctrine:</strong> Movement is mercy — routes, deliveries, impossible arrival; open the road for someone who needs it.</p>
<p>The Wayfarer is the courier as lifeline. Your Surge spends are extraction made real: free an ally to run, escort them through untouched, and — when it's nearly too late — whisk them clear of the kill zone.</p>
<h3>Route (spent via Surge)</h3>
<ul>
  <li><strong>Clear Road</strong> (1) — an ally gains a freed reaction and a reroll; their road opens.</li>
  <li><strong>Safe Passage</strong> (2) — an ally gains DR equal to Tier and a reroll; nothing touches what you're carrying.</li>
  <li><strong>Impossible Arrival</strong> (5) — whisk a hurt ally clear: heal them, DR equal to Tier, and a freed reaction.</li>
</ul>
`.trim();

const BLACKSTAIR_BODY = `
<p><em>"You came through a door that wasn't for them."</em></p>
<p><strong>Doctrine:</strong> Thresholds weaponized — covert, predatory; who gets through and who really, really doesn't.</p>
<p>The Black Stair is the courier as ambush. Your Surge spends turn crossings into kills: strike from where they weren't watching, slam the threshold shut on a foe, and spring the stair that does not end.</p>
<h3>Route (spent via Surge)</h3>
<ul>
  <li><strong>Ambush</strong> (1) — your next Strike +Tier d6; the target's next attack is at disadvantage.</li>
  <li><strong>Cut Off</strong> (2) — a foe is Staggered and cannot take reactions until your next turn.</li>
  <li><strong>Stair-Trap</strong> (5) — your next Strike lands as a max-die crit and knocks the target Prone; if it drops them, you regain a freed action.</li>
</ul>
`.trim();

const LASTMILE_BODY = `
<p><em>"Give it to me. I carry things."</em></p>
<p><strong>Doctrine:</strong> Carry the unbearable thing to where it must go — intimate, burdensome, exact. Who bears the package now?</p>
<p>The Last Mile is the courier as the one who refuses to let it fall. Your Surge spends take the weight off others: shoulder their wounds at your own cost, carry an ally through a place that should have killed them, and deliver the unbearable thing intact.</p>
<h3>Route (spent via Surge)</h3>
<ul>
  <li><strong>Shoulder the Weight</strong> (1) — heal an ally Tier d6; you take half as Stress; they bank a reroll.</li>
  <li><strong>Quiet Voyage</strong> (2) — an ally gains DR equal to Tier, and the next hit that would drop them is held at 1.</li>
  <li><strong>Delivered</strong> (5) — restore a fallen or badly-hurt ally to half Integrity and clear a condition.</li>
</ul>
`.trim();

const TARGETS = [
  { label: "Shadow Courier (class)",   type: "class",    needles: ["shadow courier"], body: BASE_BODY },
  { label: "Wayfarer (route)",         type: "subclass", needles: ["wayfarer"],       body: WAYFARER_BODY },
  { label: "Black Stair (route)",      type: "subclass", needles: ["black stair"],    body: BLACKSTAIR_BODY },
  { label: "Last Mile (route)",        type: "subclass", needles: ["last mile"],      body: LASTMILE_BODY },
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

console.group("[rewrite-shadow-courier-bodies]");
console.log("DRY_RUN:", DRY_RUN);
console.table(report);
console.groupEnd();
const n = report.filter(r => r.status !== "NOT FOUND").length;
ui.notifications.info(`Shadow Courier bodies: ${DRY_RUN ? "would rewrite" : "rewrote"} ${n} item(s). See console (F12).`);

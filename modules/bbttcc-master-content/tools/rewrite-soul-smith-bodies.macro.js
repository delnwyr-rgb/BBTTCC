// Bad Eden master-content / tools / rewrite-soul-smith-bodies.macro.js
//
// Refreshes the description bodies for the Soul-Smith class doc + its three
// forges (Forge of Victory / Forge of the Spark Reclaimer / Forge of Bound Light)
// so the TEXT matches the post-redesign CRUNCH (the unified Spark economy + the
// Surge-spent forge abilities), in Mal's voice — replacing the old narrative-only
// text and the "[TBD:balance] / Forge Charges" placeholders.
//
// Updates BOTH the compendium pack source AND existing embedded copies on world
// actors (pack edits don't propagate to copies already on actors).
// Preserves: name, identifier, advancement, flags. Replaces system.description.value only.
//
// USAGE: paste into a script macro (or the console). DRY_RUN=true → review the
// table in the console (F12). DRY_RUN=false → write.

const DRY_RUN  = true;
const PACK_ID  = "bbttcc-master-content.classes";

// ── Bodies ───────────────────────────────────────────────────────────────────
const BASE_BODY = `
<p><em>"Give me time, a fire, and something to hit — and then we'll see."</em></p>
<p>The Soul-Smith runs a forge that does not much care whether you call it a person or a furnace; it answers to heat and intention either way. Mechanically you ride <strong>Burn</strong> — a 0→8 heat track that climbs when you or a nearby ally takes a hit (the forge stokes itself on other people's bad days) and banks <strong>Surge</strong> right alongside it. You spend that Surge on four forge-works, and the hotter you run, the harder they land — right up until the furnace bites back.</p>
<h3>The Four Works (spent via Surge)</h3>
<ul>
  <li><strong>Forge-Weld.</strong> Lay hands on the breakage and repair an ally — 1d8 + tier integrity. <em>Stoked</em> (Burn 2–3) ×1.5; <em>Overheated</em> (Burn 4+) ×2, and Overheated also costs you 1d6 Stress, because an open forge has opinions about being grabbed.</li>
  <li><strong>Atonement Crucible.</strong> Cleanse a condition off an ally (two while Stoked or hotter) and temper the wound into armor — they gain DR equal to your tier. The bad thing that happened to them is now load-bearing.</li>
  <li><strong>Furnace of Renewal.</strong> Light the aura: allies within 30 ft heal (Burn-scaled) and share your poison/necrotic resistance for three rounds. Stand near the fire. It is rude not to.</li>
  <li><strong>Relic of Rebirth.</strong> Forge a ward on an ally — the next hit that would drop them is held at 1. While Overheated, instead reforge a fallen ally back to half integrity (once per fight). The forge does not accept "dead" as a final answer. It considers it a draft.</li>
</ul>
<p><strong>Vent</strong> to cool Burn. Out of combat, <strong>Forge Works</strong> still does the slow miracles — repairing hexes, purifying corrupted Sparks, restoring ruined regions. Those take time, the way good welds do.</p>
`.trim();

const VICTORY_BODY = `
<p><em>"What breaks makes the hammer."</em></p>
<p><strong>Mode:</strong> Conquest · <strong>Drift:</strong> Toward</p>
<p>The Forge of Victory holds that a defeated enemy is simply raw material that has not been collected yet. You bank <strong>Victor's Sparks</strong> — a real resource, cap = tier + 1 — whenever a foe of consequence falls within reach of you, then spend Sparks + Surge to forge their ending into your edge. It is exactly as tasteless as it sounds, and it works.</p>
<h3>Doctrine (Spark-fueled, spent via Surge)</h3>
<ul>
  <li><strong>The Victor's Spark.</strong> When a foe falls in your presence, bank a Victor's Spark (free). Trophies. Flammable ones.</li>
  <li><strong>Forged Trophy.</strong> Spark + Surge: your next Strike blazes (+tier d6) and an ally gains DR equal to your tier — a weapon and a shield, both made of someone's worst day.</li>
  <li><strong>Compounded Blow.</strong> Spark: your next Strike lands as a max-die critical. The dead, it turns out, hold grudges you can aim.</li>
  <li><strong>Sundering Stroke.</strong> Spark + Surge: your next Strike ignores resistances and leaves the target Staggered. Armor is a suggestion you decline.</li>
  <li><strong>The Final Form (Capstone).</strong> A Capstone Weapon that swallows every Spark you ever collect, gaining a permanent minor benefit per Spark. Over a campaign it becomes a legendary thing with too many names. Bound to you; a lesser hand gets a fraction.</li>
</ul>
<p><em>Out-of-combat:</em> <strong>Standard of Will</strong> (raise a standard, allies +1 vs fear, +1 Unity/VP at scene end) and <strong>Victory Forge</strong> (convert OP after a clean objective) remain the strategic flourishes.</p>
`.trim();

const RECLAIMER_BODY = `
<p><em>"Nothing is beyond salvage."</em></p>
<p><strong>Mode:</strong> Salvage · <strong>Drift:</strong> Sideways</p>
<p>The Spark Reclaimer treats destruction as a delivery service. Anything that breaks near you — a foe, a rig, a wall somebody loved — sheds a <strong>Salvage Spark</strong> you pocket (cap = tier + 1). You spend Sparks + Surge to pull use out of ruin: mending allies, stripping wreckage into armor, salvaging whole people back from the edge.</p>
<h3>Doctrine (Spark-fueled, spent via Surge)</h3>
<ul>
  <li><strong>Where The Heat Was.</strong> When something is destroyed within reach of you, bank a Salvage Spark. The wreckage owes you. You collect.</li>
  <li><strong>Reclaim.</strong> Spark + Surge: salvage a condition off an ally and shore them up with DR equal to your tier. You take the broken thing off them and make it useful.</li>
  <li><strong>The Remembered Thing.</strong> Spark + Surge: pull a salvaged relic out of the residue — an ally heals 1d8 + tier and gains DR. It returns as it last existed, usable if it was usable.</li>
  <li><strong>Deep Salvage.</strong> Spark + Surge: restore an ally hard — 2d8 + tier integrity and clear <em>every</em> condition on them. Some ruins are worth the dig.</li>
  <li><strong>The Last Forge of the Broken Things (Capstone).</strong> Once per session, walk the perimeter of a destroyed site and, over a day's work, restore it to a Salvaged State (~25% capacity) — a garrison, a leyline node, a faction's ruined headquarters. The campaign-scale miracle stays campaign-scale.</li>
</ul>
<p><em>Out-of-combat:</em> <strong>Clean Extraction</strong> (negate a Darkness tick after a salvage or demolition you ran) remains the strategic flourish.</p>
`.trim();

const BOUNDLIGHT_BODY = `
<p><em>"Containment is the first virtue."</em></p>
<p><strong>Mode:</strong> Disciplined · <strong>Drift:</strong> Away</p>
<p>The Forge of Bound Light holds things so they stop hurting people — Sparks, mostly, but also the general principle. You bank a <strong>Spark</strong> when you contain harm (when an ally near you takes a hit, you catch what spills) — cap = tier + 1 — and spend Sparks + Surge to ward, seal, and bless. The least flashy forge, and the one that keeps the party breathing.</p>
<h3>Doctrine (Spark-fueled, spent via Surge)</h3>
<ul>
  <li><strong>The First Vessel.</strong> When an ally near you is hurt, you catch the released energy and bank a Spark — a vessel waiting to be filled.</li>
  <li><strong>Bound Vessel.</strong> Spark + Surge: ward an ally — DR equal to your tier plus poison/necrotic resistance for three rounds. A safe place to put the danger.</li>
  <li><strong>The Sealed Work.</strong> Spark + Surge: ward an ally with DR <em>and</em> a seal — the next hit that would drop them is held at 1. Sealed against breaking, briefly, by stubbornness rendered in metal.</li>
  <li><strong>Blessed Weapon.</strong> Spark: your weapon blazes with bound light — your next Strike deals +tier d6. The light remembers what it was given to hold, and it is not happy about it.</li>
  <li><strong>The Living Library (Capstone).</strong> Once per session, become a vessel yourself for 24 hours — carry any Spark instantly, craft on demand, transfer Sparks between allies as a free action. Costs Stress you get back in about a week. Worth it.</li>
</ul>
<p><em>Out-of-combat:</em> <strong>Pattern of Mercy</strong> (convert Economy → Soft Power after a Parley) and the <strong>Cathedral Vessel</strong> (a building or shrine that stabilizes a hex and dampens Darkness) remain the strategic flourishes.</p>
`.trim();

// ── Targets (flexible name match so the "(Bad Eden)" suffix etc. doesn't matter) ─
const TARGETS = [
  { label: "Soul-Smith (class)",            type: "class",    needles: ["soul", "smith"],       body: BASE_BODY },
  { label: "Forge of Victory",              type: "subclass", needles: ["forge of victory"],    body: VICTORY_BODY },
  { label: "Forge of the Spark Reclaimer",  type: "subclass", needles: ["spark reclaimer"],     body: RECLAIMER_BODY },
  { label: "Forge of Bound Light",          type: "subclass", needles: ["bound light"],         body: BOUNDLIGHT_BODY },
];
const matchTarget = (doc) => TARGETS.find(t =>
  doc.type === t.type &&
  t.needles.every(n => String(doc.name ?? "").toLowerCase().includes(n)));

const report = [];

// ── 1) Compendium pack source ────────────────────────────────────────────────
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

// ── 2) Embedded copies on world actors (pack edits don't propagate to these) ──
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

console.group("[rewrite-soul-smith-bodies]");
console.log("DRY_RUN:", DRY_RUN);
console.table(report);
console.groupEnd();
const n = report.filter(r => r.status !== "NOT FOUND").length;
ui.notifications.info(`Soul-Smith bodies: ${DRY_RUN ? "would rewrite" : "rewrote"} ${n} item(s). See console (F12) for the table.`);

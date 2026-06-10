// Bad Eden master-content / tools / rewrite-aurablade-doctrine-bodies.macro.js
//
// Replaces the description body on Blood Hymn / Stillheart / Void Edge
// subclass docs with text that describes the REAL compendium feats at their
// canonical L3/L6/L10/L14/L18 levels, instead of the phantom features
// ("The Wound Sings", "Chorus", etc.) that were authored as placeholders.
//
// Preserves: name, identifier, classIdentifier, advancement, flags.
// Replaces:  system.description.value (only).
//
// USAGE: DRY_RUN=true → review. DRY_RUN=false → write.

const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.classes";

const BODIES = {
  "Blood Hymn (Bad Eden)": `
<p><em>The wound is the prayer.</em></p>
<p><strong>Mode:</strong> Martyr · <strong>Drift:</strong> Toward</p>
<p>Blood Hymn Aurablades convert suffering into amplification. Where the base class governs Burn and Aura, the Hymn turns each blow into fuel — for cleave, for fear, for irreversible certainty. Played as the operative who runs <em>toward</em> the worst version of the fight on purpose.</p>
<h3>Doctrine Features</h3>
<ul>
  <li><strong>Level 3 — Escalation.</strong> Your Burn feeds itself. While at Burn 2–3 (Engaged), weapon attacks deal +tier damage and grant +1 Burn (once per turn). At Burn 4+ (Overheated), the bonus scales further.</li>
  <li><strong>Level 6 — Lifetithe.</strong> Convert flesh into certainty. As part of an attack or Aura effect, take self-damage equal to your tier to gain +1 Burn (no action), reroll one damage die, or reclaim a previously expended Aura effect this turn.</li>
  <li><strong>Level 10 — Crimson Arc.</strong> Your violence spills outward. Once per turn, when you hit at Burn 2+, choose another creature within reach and deal half the original damage to them. At Burn 4+ the secondary target takes full damage and both must save against an additional rider.</li>
  <li><strong>Level 14 — Terror Charge.</strong> Fear trails behind you. While at Burn 3+, creatures you hit save or become Shaken; Shaken creatures suffer disadvantage on opportunity attacks against you and have reduced movement when fleeing. At Burn 4+ nearby allies of your target are also affected.</li>
  <li><strong>Level 18 — Final Crescendo (Capstone).</strong> Once per Soma Break, as a bonus action: enter Burn 4 immediately. For the rest of the turn, all attacks deal maximum damage and you may cleave freely (no once-per-turn limit). Aftermath: your Burn drops to 0 and you suffer severe backlash.</li>
</ul>
`.trim(),

  "Stillheart (Bad Eden)": `
<p><em>The calm is the discipline.</em></p>
<p><strong>Mode:</strong> Protector · <strong>Drift:</strong> Away</p>
<p>Stillheart Aurablades hold the aura instead of feeding it. Burn arrives by stillness rather than damage; the doctrine extends safety outward, denies panic to the people you stand near, and refuses disruption when the field starts to fray.</p>
<h3>Doctrine Features</h3>
<ul>
  <li><strong>Level 3 — Centered Breath.</strong> Reduce Burn gained by 1 per encounter (minimum 0). Once per round when you would gain Burn you may decline. Allies within 10 ft reroll the lowest die on their first save vs fear or charm each scene.</li>
  <li><strong>Level 6 — Shared Aura.</strong> Extend stability outward. While at Burn 1–3, allies within 10 ft gain half your Aura's passive benefit (Fury: +1 dmg once/turn; Resolve: +1 Guard while stationary; Mercy: free nonlethal choice; Dread: resistance to fear).</li>
  <li><strong>Level 10 — Quiet Mind.</strong> You and allies within 10 ft are immune to being Shaken and reroll the lowest die on saves vs charm, confusion, or morale. At Burn 3+ you may spend your reaction to cancel one fear or charm effect on an ally.</li>
  <li><strong>Level 14 — Emotional Lock.</strong> Your Aura cannot be forcibly changed. As a bonus action, freeze your current Burn level — it cannot increase or decrease until the start of your next turn. At Burn 3+ you may ignore one backlash trigger entirely.</li>
  <li><strong>Level 18 — Eye of the Storm (Capstone).</strong> Once per Soma Break, for 1 minute in a 20-ft radius: Burn does not increase for you or allies; fear, charm, and morale effects are suppressed; ongoing emotional effects pause. After it ends, you gain 1 Burn.</li>
</ul>
`.trim(),

  "Void Edge (Bad Eden)": `
<p><em>Entropy has a shape. I cut along it.</em></p>
<p><strong>Mode:</strong> Edge-walker · <strong>Drift:</strong> Sideways</p>
<p>Void Edge Aurablades cut along the seams of decay. The doctrine suppresses what enemies rely on — buffs, advantage, morale — and propagates dread into the spaces between people. Played as the operative whose presence makes hope harder to organize.</p>
<h3>Doctrine Features</h3>
<ul>
  <li><strong>Level 3 — Null Field.</strong> Your blade suppresses advantage. When you hit at Burn 1+, suppress one of the following until the end of the target's next turn: advantage on attacks, bonus damage, or morale/inspiration effects. At Burn 3+ the target also loses one reaction.</li>
  <li><strong>Level 6 — Silence of Will.</strong> You break focus. Targets you hit have disadvantage on Clarity hold checks and cannot benefit from rallying or command effects. At Burn 3+, failing a Clarity hold also causes Burn-like fatigue (GM narrative).</li>
  <li><strong>Level 10 — Dread Cut.</strong> Fear propagates. When you hit at Burn 2+, the target saves or is Shaken; nearby enemies save or suffer hesitation (lose movement or reactions). At Burn 4+ fear spreads automatically to one additional creature.</li>
  <li><strong>Level 14 — Emotional Erasure.</strong> Once per round when you hit, remove one beneficial emotional, morale, or inspiration effect from the target. Bypasses resistance tied to hope or courage. At Burn 4+ the effect cannot be reapplied for 1 round.</li>
  <li><strong>Level 18 — Final Quiet (Capstone).</strong> Once per Soma Break, create a 30-ft zone for 1 minute: morale cannot rise, inspiration fails, hope/unity/courage buffs do not apply, enemies have disadvantage on saves vs fear. Afterward your Burn drops to 0.</li>
</ul>
`.trim()
};

const pack = game.packs.get(PACK_ID);
if (!pack) { ui.notifications.error(`Pack ${PACK_ID} not found.`); return; }

const wasLocked = pack.locked;
if (wasLocked && !DRY_RUN) await pack.configure({ locked: false });

const allDocs = await pack.getDocuments();
const updates = [];
const report = [];

for (const [name, body] of Object.entries(BODIES)) {
  const doc = allDocs.find(d => d.type === "subclass" && d.name === name);
  if (!doc) {
    report.push({ name, status: "NOT FOUND" });
    continue;
  }
  updates.push({ _id: doc.id, "system.description.value": body });
  report.push({ name, status: DRY_RUN ? "WOULD REWRITE" : "REWRITTEN", chars: body.length });
}

if (!DRY_RUN && updates.length) {
  await pack.documentClass.updateDocuments(updates, { pack: PACK_ID });
}
if (wasLocked && !DRY_RUN) await pack.configure({ locked: true });

console.group("[rewrite-aurablade-doctrine-bodies]");
console.log("DRY_RUN:", DRY_RUN);
console.table(report);
console.groupEnd();
ui.notifications.info(`Aurablade doctrine bodies: ${DRY_RUN ? "would rewrite" : "rewrote"} ${updates.length}.`);

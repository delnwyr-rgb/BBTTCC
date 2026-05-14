// BBTTCC — Update Class & Subclass Stubs (Sprint: Bulwark + Avalanche v1.0)
// ─────────────────────────────────────────────────────────────────────────────
// Run this as a GM script macro after running compile-loose-packs.macro.js so
// that the class stub descriptions stop referencing inline tier mechanics
// (now living as discrete feature items) and adopt RFI-clean language —
// no more "Violence mod", "[TBD:balance]", "[TODO(adv-call)]", or
// "prof bonus".
//
// Idempotent: re-running just rewrites the description fields with the same
// canonical text. Class advancement arrays are left empty (fourththing reads
// applyPathFeatures from compendium folders, not dnd5e advancement).
// ─────────────────────────────────────────────────────────────────────────────

const PACK = "bbttcc-master-content.classes";

const BULWARK_HTML = `
<p><strong>Primary Attribute:</strong> Violence</p>
<p><em>Physical inevitability made flesh. The world has two ways of saying no to change — by refusing to move, and by refusing to be stopped. You are one of them.</em></p>
<h3>Class Resources</h3>
<p>Two pools come online at Bulwark Initiation 1:</p>
<ul>
  <li><strong>Frame Dice</strong> — persistence. d8 dice spent to absorb hits or fuel defensive doctrine effects.</li>
  <li><strong>Ruin Charges</strong> — inevitability. Charges spent on offensive doctrine effects.</li>
</ul>
<p>Both pools share the same maximum: <strong>max(2, ceil((Violence value + Bulwark Initiation) / 3))</strong>, capped at 8. Both refill on a Soma Break. How each pool is <em>generated</em> depends on your chosen Path.</p>
<h3>Class Features</h3>
<ul>
  <li><strong>Initiation 1 — Founding Stance.</strong> Skill rank +1 in Athletics (Violence) and +1 in one tool of choice. +3 Violence OP cap, +2 Siege OP cap. Frame and Ruin pools come online.</li>
  <li><strong>Initiation 6 — Anchor or Advance.</strong> 1/scene signature stance. Anchor (cannot be moved) or Advance (cannot be prevented from reaching a declared destination), until the end of your next turn.</li>
  <li><strong>Initiation 11 — Polarity Mastery.</strong> Your Path's pool-generation rule gains a second trigger.</li>
  <li><strong>Initiation 16 — Architect of Certainty.</strong> Ruin Charge damage bypasses kinetic-type resistance and structure reduction. Frame Die absorption is further reduced by your Violence value.</li>
</ul>
<h3>Doctrines</h3>
<p>Choose at Initiation 1 — see <strong>Path of the Avalanche</strong> (Unstoppable Force), <strong>Path of the Mountain</strong> (Immovable Object), or <strong>Path of the Cataclyst</strong> (the hinge between).</p>
<h3>Merge Notes</h3>
<p>Bulwark supersedes Titanbound (Immovable Object) and Breaker (Unstoppable Force). The doctrine picked at Initiation 1 determines which pole your character leans toward.</p>
`.trim();

const AVALANCHE_HTML = `
<p><em>Nothing that moves can be stopped.</em></p>
<p style="opacity:0.7;font-size:0.85em">Mode: Unstoppable Force / drift: Toward</p>
<h3>Doctrine Features</h3>
<ul>
  <li><strong>Initiation 1 — Kinetic Inversion.</strong> Generate 1 Frame Die when you end a movement (≥ half speed) with a successful Violence action or melee weapon strike. 1/turn cap.</li>
  <li><strong>Initiation 5 — Shockwave Arrival.</strong> After moving 10+ ft in a straight line and landing a melee strike, spend 1 Ruin Charge to apply the strike to a 5-ft line behind the target. Original target pushed 10 ft.</li>
  <li><strong>Initiation 9 — No Terminal Velocity.</strong> Your speed cannot be reduced below half your base speed by any condition, terrain, or grapple short of a hard physical barrier.</li>
  <li><strong>Initiation 13 — The Breach.</strong> 1/scene declare a straight line and smash through barriers up to Hard hardness. Creatures along the line take (Violence value + Bulwark Initiation) kinetic damage with damageFlavor: bludgeoning, and are knocked prone.</li>
  <li><strong>Initiation 17 — Running Theology (Capstone).</strong> While you have ≥ 1 Frame Die: immune to forced movement, staggered, stuns, and paralysis. Spend Frame Dice at the start of your turn to add their roll to your speed in feet.</li>
</ul>
`.trim();

const MOUNTAIN_HTML = `
<p><em>Nothing that stands can be moved.</em></p>
<p style="opacity:0.7;font-size:0.85em">Mode: Immovable Object / drift: Away</p>
<h3>Doctrine Features</h3>
<ul>
  <li><strong>Initiation 1 — Inverted Foundation.</strong> Generate 1 Ruin Charge when you absorb a single instance of damage ≥ Violence value + Bulwark Initiation and remain upright. 1/turn cap. Ruin Charges left at scene-end convert 1-for-1 to Frame Dice on the next Soma Break.</li>
  <li><strong>Initiation 5 — Denial.</strong> Reaction: spend 1 Ruin Charge to end a creature's movement past you (within 5 ft). No roll, no defense check. Once per target per encounter.</li>
  <li><strong>Initiation 9 — The Hold.</strong> Cannot be moved from a space you have occupied for one full round, except by a single damage instance ≥ your current Integrity value.</li>
  <li><strong>Initiation 13 — Grave Weight.</strong> Ranged attacks against you roll 3d10 keep lowest 2. Movement-required spells fail outright. AoE damage with a defense check is reduced by your Bulwark Initiation even on a fail. Slow-approach Soul defense check (DC 15 + Initiation tier) for any creature crossing 30+ ft of open ground toward you.</li>
  <li><strong>Initiation 17 — The Patient Edifice (Capstone).</strong> Declare a Place at session start. While defending it: resistance to all damage, reroll lowest die on defense and attribute checks, immune to charmed / compelled / shaken, allies within 30 ft may use your Violence or Body value for fear / forced-movement / banishment defense checks. You no longer age.</li>
</ul>
`.trim();

const CATACLYST_HTML = `
<p><em>I am the conversion itself.</em></p>
<p style="opacity:0.7;font-size:0.85em">Mode: Hinge / drift: Sideways</p>
<h3>Doctrine Features</h3>
<ul>
  <li><strong>Initiation 1 — The Exchange.</strong> Bonus action: convert 1 Frame Die ↔ 1 Ruin Charge. Up to your Initiation tier times per Soma Break. Converted dice become "charged" — +1 die step on next absorption (Frame) or +1 die step on next damage (Ruin).</li>
  <li><strong>Initiation 5 — Stance Dance.</strong> Each turn, declare Advance (Ruin spends −1, +10 ft movement) or Anchor (Frame spends +1d4 conversion, cannot be moved against your will).</li>
  <li><strong>Initiation 9 — Decide The Weather.</strong> 1/scene, spend 2 Frame + 2 Ruin to raise a 30 ft × 10 ft impassable Wall, or collapse a structure within 30 ft into Rubble that grants allies cover and slows enemies (3d10kl2 movement checks).</li>
  <li><strong>Initiation 13 — The Third Door.</strong> 1/scene, spend Frame Dice and Ruin Charges together on a single action — defensive and offensive components both apply, no action-economy displacement.</li>
  <li><strong>Initiation 17 — Both Things At Once (Capstone).</strong> Frame and Ruin merge into a single Inevitability Dice pool (max = previous Frame max + previous Ruin max). Spend for either side at any time.</li>
</ul>
`.trim();

const SHADOW_COURIER_HTML = `
<p><strong>Primary Attribute:</strong> Intrigue</p>
<p><em>A liminal operator. You cross what isn't supposed to be crossed — borders, walls, alarms, routes, secrets, the thin membrane between here and there — and you always come out the other side carrying something.</em></p>
<h3>Class Resources</h3>
<p>Two slots come online at Shadow Courier Initiation 1:</p>
<ul>
  <li><strong>Pace</strong> — movement-generated meta-resource. Gain 1 when you move 30+ ft on your turn (1/turn cap, doctrines may add generators). Spend 1 as a free action for: +5 ft move, reroll a Stealth/Athletics/Tinkering check, or ignore one reaction strike. Pool max = max(2, ceil((Intrigue value + Shadow Courier Initiation) / 3)), capped at 8. Refills on Soma Break <em>and on every successful Package delivery</em>.</li>
  <li><strong>Package</strong> — one slot, one Package at a time. Type and contents set by your chosen Route at L1 (Message / Blade-or-Key / Soul). The slot is sacred — what's in it shapes how the world reacts to you.</li>
</ul>
<h3>Class Features</h3>
<ul>
  <li><strong>Initiation 1 — Liminal Operator.</strong> Skill rank +1 in Stealth (Intrigue) and Tinkering (Intrigue). +2 Intrigue OP cap, +2 Logistics OP cap. Pace + Package come online. Ignore the first detection-style roll an opponent attempts against you per encounter.</li>
  <li><strong>Initiation 6 — The Crossing.</strong> 1/scene signature move. Cross a threshold (door, wall, ward, alarm, hex boundary). Mundane barriers fail to register; magical wards take an Intrigue defense check vs DC 12 + ward source's tier × 2.</li>
  <li><strong>Initiation 11 — Package Mastery.</strong> Your Route's signature Package gains a delivery bonus on top of the L1 effect (Wayfarer +1 Intrigue OP; Black Stair recover 1 Access Die; Last Mile −1 Darkness in recipient's hex).</li>
  <li><strong>Initiation 16 — Unfound Route.</strong> 1/session, travel between any two thresholds you have personally crossed before. Up to 4 allies. 1-hour subjective journey. Shares a 1/session pool with the Black Stair capstone.</li>
</ul>
<h3>Doctrines</h3>
<p>Choose at Initiation 1 — see <strong>Route of the Wayfarer Tongue</strong> (Herald, Message), <strong>Route of the Black Stair</strong> (Thief, Blade-or-Key), or <strong>Route of the Last Mile</strong> (Psychopomp, Soul).</p>
<h3>Merge Notes</h3>
<p>Shadow Courier supersedes Shadowjack (infiltration / breach) and Phantom Courier (travel / routes). The Route picked at Initiation 1 determines what you're carrying and why.</p>
`.trim();

const WAYFARER_HTML = `
<p><em>Every message is already halfway arrived.</em></p>
<p style="opacity:0.7;font-size:0.85em">Mode: Herald / drift: Away</p>
<h3>Doctrine Features</h3>
<ul>
  <li><strong>Initiation 1 — The Tongue That Does Not Lie.</strong> Default Package = Message. Reroll lowest die on Insight (Soul) checks vs the recipient and Diplomacy (Presence) checks for safe passage. Delivery refills Pace to max + grants the entrusting faction +1 Intrigue OP.</li>
  <li><strong>Initiation 5 — Preceding Rumor.</strong> Carrying a Message → first NPC reaction in a new location uses reroll-lowest. Expected scenes: enemies make Soul defense check (DC 12 + Initiation tier × 2) or reveal hostile intent before acting.</li>
  <li><strong>Initiation 9 — The Protected Word.</strong> Carried Messages cannot be stolen, compelled out, or read by divination/telepathy. Death makes the Message inert. Compel-speech failure → 1d10x10 psychic damage to the caster.</li>
  <li><strong>Initiation 13 — Reply With Interest.</strong> On delivery, accept a Reply as a free action — Reply becomes your next Message. Recipients are obligated to provide one if they want the L1 + L11 delivery benefits.</li>
  <li><strong>Initiation 17 — The Standing Appointment (Capstone).</strong> Empty Package slot? GM designates a Message the world structurally needs delivered. Delivery → −2 Darkness in recipient's hex, +2 Tikkun progress.</li>
</ul>
`.trim();

const BLACKSTAIR_HTML = `
<p><em>A locked door is a suggestion.</em></p>
<p style="opacity:0.7;font-size:0.85em">Mode: Thief / drift: Toward</p>
<h3>Doctrine Features</h3>
<ul>
  <li><strong>Initiation 1 — The Crossing, Weaponized.</strong> Default Package = Blade or Key (declare per scene). Blade: first attack from concealment +1d10x10 kinetic with damageFlavor: blade. Key: bypass one non-magical lock/ward/password without check 1/scene. Either consumes on use.</li>
  <li><strong>Initiation 5 — The Threshold Is A Lie.</strong> The Crossing on magical barriers: DC −2, no magical trace (unless specifically warded against your class).</li>
  <li><strong>Initiation 9 — Extraction.</strong> Carrying a non-owned object/info/willing small creature as Package → you and the Package become untraceable by divination until delivery, willing reveal, or 24 hours pass.</li>
  <li><strong>Initiation 13 — Reverse Crossing.</strong> Use The Crossing to leave a place you shouldn't be able to leave (prison, dimensional trap, banishment, exile). Bring up to your Initiation tier allies. Arrive at any previously-visited location. Cannot escape an active combat round.</li>
  <li><strong>Initiation 17 — The Stair That Does Not End (Capstone).</strong> 1/session, step through any threshold and exit through any other threshold previously crossed in this campaign. Up to 4 allies, 1-hour subjective journey. Shares 1/session pool with class T4 Unfound Route.</li>
</ul>
`.trim();

const LASTMILE_HTML = `
<p><em>Nobody stays behind.</em></p>
<p style="opacity:0.7;font-size:0.85em">Mode: Psychopomp / drift: Sideways</p>
<h3>Doctrine Features</h3>
<ul>
  <li><strong>Initiation 1 — The Weight You Carry.</strong> Default Package = Soul (a being or intangible that cannot reach safety alone). −5 ft your speed, +5 ft to traveling allies. Reroll lowest on Stealth (Intrigue) and Athletics (Violence) checks made to protect/conceal the Soul. Delivery → recipient faction +1 Morale OP, −1 Darkness in their hex.</li>
  <li><strong>Initiation 5 — The Arms That Carry.</strong> Pick up unconscious / bound / Staggered creature your size or smaller as a bonus action without movement penalty (L1 speed penalty still applies only to the Soul). Hand off to adjacent ally as free action. Carry one size larger at half speed.</li>
  <li><strong>Initiation 9 — Funeral Rites.</strong> Carrying a dead body / dying creature's final message / death-cursed creature → delivery to a place of meaning resolves curses, completes rites, +2 Tikkun progress, additional −1 Darkness.</li>
  <li><strong>Initiation 13 — The Quiet Voyage.</strong> While carrying a Soul, become temporarily insubstantial up to your Initiation tier rounds per scene. Pass through non-magical barriers, immune to reaction strikes, invisible to non-attuned creatures. Cannot attack or use non-movement abilities while insubstantial.</li>
  <li><strong>Initiation 17 — The Ferryman's Right (Capstone).</strong> 1/session, carry one Soul the world would not otherwise release. Cost: 1 permanent Stress max OR 25 Radiation points. Soul arrives at declared destination alive and whole. Not for escape — for those who cannot escape themselves.</li>
</ul>
`.trim();

const PATCHES = {
  "XVCamqENQpSFYQOS": { name: "Bulwark", html: BULWARK_HTML },
  "iELfZ9lTJzzQtWxG": { name: "Path of the Avalanche (BBTTCC)", html: AVALANCHE_HTML },
  "LE31MzyjJWZsVDiF": { name: "Path of the Mountain (BBTTCC)", html: MOUNTAIN_HTML },
  "TymJux36egJ8oH6o": { name: "Path of the Cataclyst (BBTTCC)", html: CATACLYST_HTML },
  "5Ncfbe1ReQhbLLUP": { name: "Shadow Courier", html: SHADOW_COURIER_HTML },
  "kCpxoUP3SA2zbpa8": { name: "Route of the Wayfarer Tongue (BBTTCC)", html: WAYFARER_HTML },
  "P6cYL1DAZw3YPTsz": { name: "Route of the Black Stair (BBTTCC)", html: BLACKSTAIR_HTML },
  "ahzRK1eY8exF0JhW": { name: "Route of the Last Mile (BBTTCC)", html: LASTMILE_HTML }
};

if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

const pack = game.packs.get(PACK);
if (!pack) { ui.notifications.error(`Pack not found: ${PACK}`); return; }
if (pack.locked) {
  try { await pack.configure({ locked: false }); }
  catch (e) { console.warn(`[update-class-stubs] could not unlock ${PACK}`, e); }
}

const results = [];
for (const [id, patch] of Object.entries(PATCHES)) {
  try {
    const item = await pack.getDocument(id);
    if (!item) { results.push(`MISS ${patch.name} (${id})`); continue; }
    await item.update({ "system.description.value": patch.html });
    results.push(`OK   ${item.name} (${id})`);
  } catch (e) {
    results.push(`ERR  ${patch.name} (${id}): ${e.message}`);
    console.error(`[update-class-stubs] ${id}`, e);
  }
}

ChatMessage.create({
  speaker: { alias: "BBTTCC Update Class Stubs" },
  content: `<h4>Update Class Stubs</h4><pre style="font-size:0.78em;white-space:pre-wrap;">${foundry.utils.escapeHTML(results.join("\n"))}</pre>`
});
return results;

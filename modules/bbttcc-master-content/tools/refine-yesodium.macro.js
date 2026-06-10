// Bad Eden — Refine Yesodium with Canonical Lore + Engine Hooks
// ─────────────────────────────────────────────────────────────────────────────
// Replaces the placeholder Yesodium item with the canonical entry from the
// "Yesodium Is A Hell Of A Drug" journal: metastable proto-ore from the
// Yesod Impact Strata; Khezek-Tor primary vein; narrative-responsive metal
// that remembers being ore before it chose a form.
//
// Bakes the canonical mechanics into flags.fourththing.rfi.item.yesodium so
// the future Stabilization engine can read them without re-parsing prose:
//
//   yesodium: {
//     stabilizationDC: { common: 10, precious: 12, alloy: 16 },
//     approaches: { faith, economy, violence, intrigue, "soft-power" },
//     reversionTable: [...],         // d6 ladder
//     produces: ["iron","steel","copper","silver","gold","exotic","arcane-conductor"],
//     refusesTo: ["organic","complex-composite","living"]
//   }
//
// Run as a GM script macro. Idempotent — overwrites in place.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const DRY_RUN = false;

const CANONICAL_LORE = `
<h3>⛏️ Yesodium</h3>
<p><i>Canonical Resource Block — Bad Eden.</i></p>

<h4>🜂 Resource Classification</h4>
<ul>
  <li><b>Type:</b> Metastable Proto-Ore</li>
  <li><b>Origin:</b> Yesod Impact Strata</li>
  <li><b>Rarity:</b> Rare (Hex-Unique: <b>Khezek-Tor Primary Vein</b>)</li>
  <li><b>State:</b> Narrative-Responsive Mineral</li>
</ul>

<p>Yesodium is matter that has not fully collapsed into identity. It remembers being ore <i>before it chose a form</i>. It may be convinced to become:</p>
<ul>
  <li>Iron, Steel, Copper, Silver, Gold</li>
  <li>Exotic alloys</li>
  <li>Conductive arcane metals</li>
</ul>
<p>It cannot become: organic matter, complex composites (without additional crafting), or living material. It must be <b>stabilized</b> during shaping.</p>

<h4>⚙️ Core Mechanics</h4>

<h4>🧠 Stabilization Check (Crafting Gate)</h4>
<p>When forging Yesodium into a defined material, make a Stabilization Roll using the dominant crafting approach:</p>
<table style="width:100%;font-size:0.9em">
  <tr><th align="left">Approach</th><th align="left">OP Pool Used</th></tr>
  <tr><td>Ritualized Forging</td><td>Faith</td></tr>
  <tr><td>Precision Engineering</td><td>Economy</td></tr>
  <tr><td>Coercive Hammering</td><td>Violence</td></tr>
  <tr><td>Whispered Binding</td><td>Intrigue</td></tr>
  <tr><td>Cultural Songwork</td><td>Soft Power</td></tr>
</table>
<p><b>DC</b> scales with material complexity: Common metal (Iron/Steel) <b>10</b>; Precious (Silver/Gold) <b>12</b>; Alloy / Exotic (Starsteel, etc.) <b>14–16</b>.</p>

<h4>Outcomes</h4>
<ul>
  <li><b>Great Success</b> — Material gains +1 margin bonus to its primary function. Counts as <i>Harmonized Yesodium</i>.</li>
  <li><b>Success</b> — Material stabilizes normally.</li>
  <li><b>Failure</b> — Material stabilizes with a flaw (hairline instability). GM adds minor narrative risk.</li>
  <li><b>Critical Failure</b> — Reversion event. Slag collapse or dream fracture.</li>
</ul>

<h4>⚠️ Reversion Risk</h4>
<p>Yesodium retains memory. Under extreme stress (raid great failure, catastrophic damage, magical backlash), roll a <b>Reversion Check (d6):</b></p>
<ul>
  <li><b>1–2:</b> Stable</li>
  <li><b>3–4:</b> Flicker (temporary disadvantage next round)</li>
  <li><b>5:</b> Structural Weakening (damageStep +1)</li>
  <li><b>6:</b> Reversion Event — material destabilizes (weapon loses form mid-swing; armor softens under blow; structure partially dematerializes; rig plating destabilizes)</li>
</ul>

<h4>🗡️ Yesodic Weapons</h4>
<p>Weapons forged from <i>Harmonized</i> Yesodium gain:</p>
<ul>
  <li><b>Memory Edge.</b> Once per raid, add +1 margin after roll resolution.</li>
  <li><b>Adaptive Weight.</b> Counts as optimal metal for the wielder's build (no mechanical encumbrance penalties).</li>
  <li><b>Identity Cut.</b> Against constructs, gates, or dream-entities: +1 effective damageStep.</li>
</ul>
<p>If improperly stabilized: Reversion check triggered on Great Failure.</p>

<h4>🛡️ Yesodic Armor</h4>
<ul>
  <li><b>Memory of Protection.</b> Once per raid, reduce incoming margin by 1.</li>
  <li><b>Flow Plating.</b> May convert one structural damageStep into narrative strain (cosmetic, no track loss).</li>
  <li><b>Gate Attunement.</b> +1 defensive bonus when operating near Ley Gates.</li>
</ul>
<p>On catastrophic failure, armor may partially dematerialize.</p>

<h4>🏗️ Yesodic Structures</h4>
<p>Used in: Gate frames, Rig reinforcement, Ritual chambers, Defensive bastions.</p>
<ul>
  <li><b>Benefit.</b> +1 to stabilization checks when interacting with Leylines. Reduced Gate travel instability chance.</li>
  <li><b>Danger.</b> If Khezek-Tor's main vein destabilizes, every Yesodic structure globally must roll Reversion once. Yes. Globally.</li>
</ul>
`;

const ENGINE_HOOKS = {
  stabilizationDC: { common: 10, precious: 12, alloy: 16 },
  approaches: {
    "ritualized-forging":   "faith",
    "precision-engineering":"economy",
    "coercive-hammering":   "violence",
    "whispered-binding":    "intrigue",
    "cultural-songwork":    "soft-power"
  },
  produces:  ["iron", "steel", "copper", "silver", "gold", "exotic-alloy", "arcane-conductor"],
  refusesTo: ["organic", "complex-composite", "living"],
  reversionTable: [
    { roll: "1-2", outcome: "stable" },
    { roll: "3-4", outcome: "flicker",       effect: "disadvantage next round" },
    { roll: "5",   outcome: "weakening",     effect: "damageStep +1" },
    { roll: "6",   outcome: "reversion",     effect: "material destabilizes" }
  ],
  veinHex: "Khezek-Tor"
};

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);
  const docs = await pack.getDocuments();

  const item = docs.find(d => d.name === "Yesodium");
  if (!item) return ui.notifications?.error("Yesodium item not found — run create-rfi-materials.macro.js first.");

  const update = {
    _id: item.id,
    "flags.fourththing.rfi.item.signature": "It remembers being ore before it chose a form.",
    "flags.fourththing.rfi.item.lore":      CANONICAL_LORE,
    "flags.fourththing.rfi.item.yesodium":  ENGINE_HOOKS,
    "system.tags": [
      "material", "yesodium", "sephirotic", "yesod",
      "metastable-proto-ore", "narrative-responsive", "khezek-tor"
    ]
  };

  if (DRY_RUN) {
    console.log("DRY RUN — would apply:", update);
    return ui.notifications?.info("DRY RUN — Yesodium not updated.");
  }

  await item.update(update);
  console.log("✓ Yesodium refined with canonical lore + engine hooks.");
  ui.notifications?.info("Yesodium refined to canon.");
})();

// scripts/maneuvers-courtly-content.enhancer.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase D content: 12 anytime maneuvers for the Courtly Intrigue scenario,
// per COURTLY_INTRIGUE_SPEC.md §5.
//
// Each maneuver:
//   * Compendium-equivalent metadata (label, description, cost, tier)
//   * raidTypes ["presence"] — surfaces on Presence raids (which route to
//     the courtly engine on tableau-enabled scenes per [[option-b-routing]])
//   * fireMode: "anytime" — picked from the anytime ladder
//   * engine: "courtly" — tagged for the picker filter
//   * effects[] — scenarioEffects array dispatched via
//     __courtlyScenario.applyEffects(effects, { side: "A" })
//
// Mask Off (#12) carries a phaseEStub effect that warns the user; the
// scaffolding lights up automatically when Phase E ships Scandal Scars.
//
// Per [[bbttcc-api-exposure-pattern]] registration is two-pass.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  const TAG = "[bbttcc-raid:courtly-content]";

  const D = {
    engine: "courtly",
    raidTypes: ["presence"],
    layer: "tactical",
    fireMode: "anytime"
  };

  const RAW = [
    {
      key: "courtly_whispered_aside", label: "Whispered Aside", tier: 1, costBand: "light",
      cost: { diplomacy: 1 },
      effectsText: "Pick a courtier. +1 Favor to your side.",
      description: "<p>A bowed head, a brushed sleeve, a coded word at the edge of the music. <b>+1 Favor with a chosen courtier toward your side.</b></p>",
      effects: [
        { type: "favorShift", side: "self", delta: 1, prompt: "Choose a courtier to win over (+1 favor toward you)" }
      ]
    },
    {
      key: "courtly_public_toast", label: "Public Toast", tier: 1, costBand: "light",
      cost: { softpower: 1 },
      effectsText: "Suspicion −1. Next Persuade by your side: +1.",
      description: "<p>A raised cup, a gracious phrase that lands the room. <b>−1 Suspicion</b>, and your next Persuade reads as warmer by half a degree. <b>+1 to your next Persuade.</b></p>",
      effects: [
        { type: "suspicionFall", delta: 1, reason: "Public Toast" },
        { type: "queueActionBonus", side: "self", actionFilter: ["persuade"], value: 1, source: "Public Toast" }
      ]
    },
    {
      key: "courtly_plant_a_doubt", label: "Plant a Doubt", tier: 2, costBand: "light",
      cost: { intrigue: 1 },
      effectsText: "Pick a courtier. −1 Favor to opponent's side. Suspicion +1.",
      description: "<p>A muttered question, a raised eyebrow at the wrong moment. The doubt seeds itself. <b>−1 Favor with a chosen courtier toward your opponent's side. +1 Suspicion.</b></p>",
      effects: [
        { type: "favorShift", side: "opp", delta: -1, prompt: "Choose a courtier to sour against your opponent (−1 favor toward them)" },
        { type: "suspicionRise", delta: 1, reason: "Plant a Doubt" }
      ]
    },
    {
      key: "courtly_quote_old_law", label: "Quote the Old Law", tier: 2, costBand: "medium",
      cost: { diplomacy: 2 },
      effectsText: "Suspicion −2. Cancel one Scandal on the table.",
      description: "<p>An invocation of precedent that even the rumormongers daren't trespass. <b>−2 Suspicion</b> and <b>clears one Scandal flag</b> (your choice — your own or your opponent's).</p>",
      effects: [
        { type: "suspicionFall", delta: 2, reason: "Quote the Old Law" },
        { type: "clearScandal", side: "self", source: "Quote the Old Law" }
      ]
    },
    {
      key: "courtly_read_the_room", label: "Read the Room", tier: 1, costBand: "light",
      cost: { intrigue: 1 },
      effectsText: "Draw 1 Earned Secret.",
      description: "<p>You attend to the right glances, the right silences. Something useful coalesces. <b>Draw 1 Earned secret</b> from the courtly secrets compendium.</p>",
      effects: [
        { type: "drawSecret", side: "self", acquisition: "earned" }
      ]
    },
    {
      key: "courtly_stage_distraction", label: "Stage a Distraction", tier: 2, costBand: "light",
      cost: { softpower: 1 },
      effectsText: "Suspicion −1. Opponent discards a Stolen secret if held.",
      description: "<p>A spilled tray, a sudden song, a fainting noble — eyes turn, and your opponent's loudest piece of intel becomes inconvenient. <b>−1 Suspicion. Opponent discards one Stolen secret</b> (if any).</p>",
      effects: [
        { type: "suspicionFall", delta: 1, reason: "Stage a Distraction" },
        { type: "discardSecret", side: "opp", filter: { acquisition: "stolen" } }
      ]
    },
    {
      key: "courtly_forged_letter", label: "Forged Letter", tier: 3, costBand: "medium",
      cost: { intrigue: 2 },
      effectsText: "Acquire 1 Stolen secret. Suspicion +2.",
      description: "<p>The seal is convincing. The handwriting is *almost* right. It will hold — but not quietly. <b>Acquire 1 Stolen secret</b> from the courtly secrets compendium. <b>+2 Suspicion</b> because it's <em>almost</em> convincing.</p>",
      effects: [
        { type: "drawSecret", side: "self", acquisition: "stolen" },
        { type: "suspicionRise", delta: 2, reason: "Forged Letter" }
      ]
    },
    {
      key: "courtly_sidle_closer", label: "Sidle Closer", tier: 1, costBand: "light",
      cost: { diplomacy: 1 },
      effectsText: "Approach the center. +1 to your next Persuade or Inspire.",
      description: "<p>You drift toward the principal — close enough to be heard, close enough to be seen choosing them. <b>+1 to your next Persuade or Inspire.</b> <em>(Token movement on the tableau is a Phase D-prime polish item; the bonus lands now.)</em></p>",
      effects: [
        { type: "queueActionBonus", side: "self", actionFilter: ["persuade", "inspire"], value: 1, source: "Sidle Closer" }
      ]
    },
    {
      key: "courtly_eavesdrop", label: "Eavesdrop", tier: 2, costBand: "light",
      cost: { intrigue: 1 },
      effectsText: "Draw 1 Earned Secret (courtier-flavored).",
      description: "<p>A wall, an alcove, a half-open door. Patience does the rest. <b>Draw 1 Earned secret</b> tied to a courtier (GM may rename to taste).</p>",
      effects: [
        { type: "drawSecret", side: "self", acquisition: "earned" }
      ]
    },
    {
      key: "courtly_call_question", label: "Call the Question", tier: 3, costBand: "medium",
      cost: { softpower: 2 },
      effectsText: "Force next exchange to resolve with 0 spend both sides.",
      description: "<p>You demand a vote, a ruling, a single yes-or-no. The court must oblige. <b>Next round's spending is capped at 0 OP for both sides</b> — pure rolls, pure stakes.</p>",
      effects: [
        { type: "lockSpend", rounds: 1, maxSpend: 0 }
      ]
    },
    {
      key: "courtly_patrons_word", label: "Patron's Word", tier: 3, costBand: "medium",
      cost: { diplomacy: 1 },
      effectsText: "Spend a +2 patron's favor → +3 to one non-Intimidate roll.",
      description: "<p>You call in a chip from a high-placed friend (a courtier with favor ≥ 2 toward you). Their voice tips the scale. <b>−1 favor with the chosen patron → +3 to your next Persuade, Inspire, or Expose</b> (cannot be Intimidate).</p>",
      effects: [
        { type: "spendFavor", minFavor: 2 }
      ]
    },
    {
      key: "courtly_mask_off", label: "Mask Off", tier: 4, costBand: "heavy",
      cost: { violence: 1 },
      effectsText: "Burn a Scandal Scar → +2 to one Intimidate. Suspicion +2.",
      description: "<p>You stop pretending the rumor was beneath you and weaponize it. <b>Burn one light Scandal Scar from your faction → +2 to your next Intimidate this raid. +2 Suspicion.</b></p>",
      effects: [
        { type: "burnScandalScar", side: "self" },
        { type: "queueActionBonus", side: "self", actionFilter: ["intimidate"], value: 2, source: "Mask Off" },
        { type: "suspicionRise", delta: 2, reason: "Mask Off" }
      ]
    }
  ];

  const COURTLY_MANEUVERS = RAW.map(m => ({
    ...D, ...m,
    throughput: function (ctx) {
      return {
        scenarioEffects: foundry.utils.deepClone(m.effects),
        meta: { source: "throughput", maneuverKey: m.key, preview: true }
      };
    }
  }));

  function _register() {
    const raid = game.bbttcc?.api?.raid;
    const agent = game.bbttcc?.api?.agent;
    if (!raid?.EFFECTS) return false;

    const EFFECTS = raid.EFFECTS;
    const THROUGHPUT = agent?.__THROUGHPUT || null;

    let added = 0;
    for (const m of COURTLY_MANEUVERS) {
      EFFECTS[m.key] = {
        kind: "maneuver",
        key: m.key,
        label: m.label,
        tier: m.tier,
        raidTypes: m.raidTypes.slice(),
        cost: foundry.utils.deepClone(m.cost),
        fireMode: m.fireMode,
        text: m.effectsText,
        description: m.description,
        meta: {
          tier: m.tier,
          engine: m.engine,
          layer: m.layer,
          costBand: m.costBand,
          authoredSprint: "courtly-d",
          availability: "standard"
        }
      };
      if (THROUGHPUT && typeof m.throughput === "function") {
        THROUGHPUT[m.key] = m.throughput;
      }
      added++;
    }

    raid.courtlyManeuvers = COURTLY_MANEUVERS;
    console.log(TAG, `registered ${added} courtly anytime maneuvers; tiers:`,
      COURTLY_MANEUVERS.reduce((a, m) => (a[`T${m.tier}`] = (a[`T${m.tier}`] || 0) + 1, a), {})
    );
    return true;
  }

  if (!_register()) {
    Hooks.once("ready", () => Promise.resolve().then(_register));
  } else {
    Hooks.once("ready", () => Promise.resolve().then(_register));
  }
})();

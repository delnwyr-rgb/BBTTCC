// Bad Eden — Convert Reward Items to RFI-native gear/consumables
// ─────────────────────────────────────────────────────────────────────────────
// Walks the 5 hand-authored items in the Reward Items folder of
// `bbttcc-master-content.items` and rewrites them as fourththing gear:
//
//   • type coercion (equipment/consumable → gear or armor)
//   • flags.fourththing.rfi.item        — tier, frame, origin, bound, signature, lore
//   • flags.fourththing.rfi.item.consume (Potion of Radical Chill)
//   • flags.fourththing.rfi.item.legacySystem (description fallback for strip)
//   • Neon Spirit Armor lands as a real `armor` doc with stats
//
// Items with reactive / Soma-Break abilities get rich lore + tier + signature
// but no auto-engine block — those mechanics need a separate engine sprint.
// Run as a GM script macro. Idempotent.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const DRY_RUN = false;

const REWARDS = [
  {
    name: "Blessed Blockbuster Membership Card",
    targetType: "gear",
    rfi: {
      tier: "II", frame: "tool", origin: "looted", bound: "attuned",
      signature: "Be kind. Rewind.",
      lore: "<p>Plastic card that smells faintly of carpet cleaner and late fees forgiven by an angel. The number changes depending on who's holding it; the back always reads <i>FOREVER MEMBER</i>.</p>"
        + "<p><b>Be Kind, Rewind.</b> Reroll the lowest die on Mind (Lore) checks about popular entertainment, celebrities, urban legends, and \"what everyone was watching back then.\"</p>"
        + "<p><b>Late Fee Absolution (1/Soma Break).</b> When you fail an attribute check, pay it forward and reroll. Use the new roll. If it fails too, take −1 to your next attribute check before end of next turn — the universe <i>remembers</i>.</p>"
        + "<p><b>Sleeve of Protection.</b> Reroll the lowest die on defense checks against effects that would magically force you to forget something you've seen or learned in the last 24 hours.</p>"
    },
    system: { slot: "wondrous", tags: ["wondrous", "attunement", "memory", "rewind"] }
  },
  {
    name: "Discount Summoning Circle (10% off)",
    targetType: "gear",
    rfi: {
      tier: "II", frame: "consumable", origin: "looted", bound: "free",
      signature: "Terms apply. Demons binding.",
      charges: 1,
      upkeep: { mode: "passive", per: "none" },
      lore: "<p>A cheap vinyl mat printed with runes and an aggressively cheerful coupon code. The fine print is in Infernal, and it is <i>mostly</i> about arbitration.</p>"
        + "<p><b>Action — Place Circle.</b> Set the mat in an unoccupied space within reach. The circle lasts 10 minutes or until used. While within 5 ft, you can cast one conjuration manifestation with these benefits:</p>"
        + "<ul><li><b>10% Off Materials.</b> Reduce a costly material component cost by 10% (min 1 gp). Reduced cost is still consumed.</li>"
        + "<li><b>Coupon Stabilizer.</b> +1 to your Resolve DC for that manifestation.</li></ul>"
        + "<p>After the manifestation lands, the mat smokes, curls, and crumbles into glittery ash.</p>"
    },
    system: { slot: "consumable", tags: ["consumable", "summoning", "ritual", "single-use"] }
    // No consume block — placed effect; the player narrates the use, the GM decrements via the ✕ button.
  },
  {
    name: "Neon Spirit Armor",
    targetType: "armor",
    rfi: {
      tier: "III", frame: "armor", origin: "looted", bound: "attuned",
      signature: "Half plate that remembers the mall at midnight.",
      lore: "<p>It hums with the after-image of fluorescent signage. Smells like ozone and pretzel salt.</p>"
        + "<p><b>Neon Afterimage.</b> While in dim light or within 30 ft of an obvious artificial light source (signage, streetlights, neon, holo-ads), reroll the lowest die on Intrigue (tumble/balance/slip-past) checks to avoid provoking opportunity attacks.</p>"
        + "<p><b>Ghostwalk (1/Soma Break).</b> As a bonus action, become briefly half-ethereal until the end of your current turn. You can move through creatures and objects as if difficult terrain. If you end your turn inside an object, you're shunted to the nearest open space and take <b>1d10 kinetic damage</b>.</p>"
        + "<p><b>Neon Signature.</b> The armor sheds faint, shifting light: a 5-ft radius of dim light. Suppress or restore as a bonus action.</p>"
    },
    system: {
      guardBonus:   1,
      evasionBonus: 0,
      resolveBonus: 1,
      armorSkill:   "plating",
      equipped:     false,
      resistances:  [],
      tags:         ["half-plate", "neon", "attunement", "ghostwalk"]
    }
  },
  {
    name: "Potion of Radical Chill",
    targetType: "gear",
    rfi: {
      tier: "II", frame: "consumable", origin: "looted", bound: "free",
      signature: "Tastes like winter and irresponsible confidence.",
      charges: 1,
      upkeep: { mode: "passive", per: "none" },
      lore: "<p>A slushy-blue vial. When you drink it, you are suffused with a supernatural calm for 1 hour:</p>"
        + "<ul><li>Resistance to <b>energy (cold)</b> damage.</li>"
        + "<li>Reroll the lowest die on defense checks against being <b>Shaken</b>.</li>"
        + "<li><b>Radical Cool (1/Duration).</b> When you take fire or energy (cold) damage, use your reaction to reduce it by <b>2d6</b>.</li></ul>"
        + "<p>The effect ends early if you are Staggered.</p>"
        + "<p><i>Engine note: the immediate sip restores stress and softens the channel — extended duration buffs are GM-tracked.</i></p>",
      // Sipping the potion is the immediate +stress / +clarity hit; the
      // hour-long resistance is GM-asserted (track via timer or table-talk).
      consume: {
        effects: [
          { kind: "track", track: "stress",  op: "add",      delta: 4 },
          { kind: "track", track: "clarity", op: "add",      delta: 1 },
          { kind: "track", track: "noise",   op: "subtract", delta: 1 }
        ],
        decrement: true
      }
    },
    system: { slot: "consumable", tags: ["potion", "cold", "calm", "single-use"] }
  },
  {
    name: "Snack Machine Familiar",
    targetType: "gear",
    rfi: {
      tier: "III", frame: "tool", origin: "looted", bound: "attuned",
      signature: "A vending machine with legs and opinions about you.",
      lore: "<p>Tiny construct. Display of impossible snacks. Temperament like a disgruntled cashier.</p>"
        + "<p><b>Familiar (Action, 8 hours or until dismissed).</b> Deploy as a familiar. Acts on your initiative. Speed 25 ft (no fly). Can take Help; cannot Attack.</p>"
        + "<p><b>Snack Dispense (3/Day, bonus action while within 5 ft).</b> Choose one:</p>"
        + "<ul><li><b>Sugar Rush.</b> Gain 1d4 temporary Integrity.</li>"
        + "<li><b>Salt &amp; Focus.</b> +1 to your next attribute check within 1 minute.</li>"
        + "<li><b>Caffeine Bolt.</b> Walking speed +10 ft for 1 minute.</li></ul>"
        + "<p><b>Stat Block (quick).</b> Tiny construct; Guard 13; Integrity 5; Str 6 Dex 14 Con 10 Int 4 Wis 10 Cha 5; darkvision 60 ft; immune poison; condition immune poisoned. Perception (Mind) +2; Stealth (Intrigue) +4.</p>"
        + "<p><b>Dismiss.</b> Action — recall into the item. If it drops to 0 Integrity, it vanishes; redeploys after a Soma Break.</p>"
    },
    system: { slot: "wondrous", tags: ["wondrous", "familiar", "attunement", "construct"] }
  }
];

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);
  const docs = await pack.getDocuments();

  const RfiItems = game.fourththing?.items;
  if (!RfiItems) return ui.notifications?.error("RFI items API not available.");

  const updates = [];
  const reportRows = [];
  const missing = [];

  for (const row of REWARDS) {
    const item = docs.find(d => d.name === row.name);
    if (!item) { missing.push(row.name); continue; }

    const legacySystem = foundry.utils.deepClone(item.system ?? {});
    const defaults = RfiItems.defaults({ type: row.targetType, system: {}, getFlag: () => null });

    const rfiFlag = {
      ...defaults,
      ...row.rfi,
      legacySystem
    };

    updates.push({
      _id:    item.id,
      type:   row.targetType,
      system: row.system,
      "flags.fourththing.rfi.item": rfiFlag
    });

    const note = row.rfi.consume ? " [consume:wired]" : (row.rfi.frame === "consumable" ? " [consumable:lore-only]" : "");
    reportRows.push(`✓ ${row.name.padEnd(40)} ${row.targetType.padEnd(6)} T${row.rfi.tier} ${row.rfi.frame}${note}`);
  }

  if (missing.length) console.warn("Missing items:", missing);

  if (DRY_RUN) {
    console.group("Reward Items conversion — DRY RUN");
    reportRows.forEach(r => console.log(r));
    if (missing.length) console.log("MISSING:", missing.join(", "));
    console.groupEnd();
    return ui.notifications?.info(`DRY RUN — would update ${updates.length} item(s); ${missing.length} not found.`);
  }

  if (updates.length) {
    await Item.updateDocuments(updates, { pack: PACK_ID });
  }

  console.group("Reward Items conversion — applied");
  reportRows.forEach(r => console.log(r));
  if (missing.length) console.log("MISSING:", missing.join(", "));
  console.groupEnd();
  ui.notifications?.info(`Reward Items converted: ${updates.length}${missing.length ? `; ${missing.length} not found` : ""}.`);
})();

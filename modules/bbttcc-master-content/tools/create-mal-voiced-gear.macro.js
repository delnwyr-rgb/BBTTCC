// BBTTCC — Mal-Voiced Gear (Bad Eden, Frontier Formerly Known As Texas)
// ─────────────────────────────────────────────────────────────────────────────
// 20 wacky pieces of gear narrated by Mal, the snarky self-aware unreliable
// narrator of Bad Eden. Mal's voice mixes cosmic absurdity with truck-stop
// Americana, runs lists with one bait-and-switch item, undermines itself,
// personifies the inanimate, and is exhausted-but-protective of the player.
//
// Items land in `bbttcc-master-content.items`, in a top-level "Mal-Voiced"
// folder (created if absent) so the GM can hand them out as a thematic set.
// Idempotent — items with matching names are skipped unless FORCE = true.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const FOLDER_NAME = "Mal-Voiced";
const DRY_RUN = false;
const FORCE   = false;

const ITEMS = [
  // ── 1 ────────────────────────────────────────────────────────────────────
  {
    name: "Snarky Burger Mascot's Final Smile",
    targetType: "gear",
    rfi: {
      tier: "I", frame: "talisman", origin: "looted", bound: "free",
      signature: "Frozen mid-sarcasm. Honestly relatable.",
      lore: "<p>A jagged shard of pre-Fall enamel signage. The mascot's grin is preserved exactly as it was when the world stopped being funny on purpose. Most people pin it to a coat. Some keep it in a pocket. A few have tried to throw it away. It comes back. Probably. I haven't checked.</p>"
        + "<p><b>Mascot's Last Dignity.</b> Reroll the lowest die on the first Intimidate or Mock check you make each scene. Other people see the brooch. Other people remember Snarky Burger. Other people make their saving throw against being charmed by your obvious bad taste.</p>",
      materialOf: ["enamel-pin", "pre-fall-signage", "frozen-sarcasm"]
    },
    system: { slot: "trinket", tags: ["mal-voiced", "pre-fall", "talisman"] }
  },

  // ── 2 ────────────────────────────────────────────────────────────────────
  {
    name: "Whataburger Coupon, Unredeemed (Vintage)",
    targetType: "gear",
    rfi: {
      tier: "II", frame: "trade-good", origin: "looted", bound: "free",
      signature: "Expired in the year sixty before the Shattering. Still works on people.",
      lore: "<p>A laminated paper coupon. Two for one breakfast taquitos, valid through a date so old the typeface itself is illegal in three coalitions. Yes. People will trade you a horse for it. Yes, even now. Yes, I'm aware that doesn't make sense. Take it up with the Akashic field.</p>"
        + "<p><b>Currency of the Frontier-Formerly-Known.</b> Once per session, in any wasteland market or trading post, this coupon counts as a Tier-II trade good for purposes of barter. After the trade, it goes back in your pocket. The vendor is still happy about it three days later.</p>",
      materialOf: ["pre-fall-paper", "borderline-irrational-state-pride"]
    },
    system: { slot: "trinket", tags: ["mal-voiced", "trade-good", "pre-fall"] }
  },

  // ── 3 ────────────────────────────────────────────────────────────────────
  {
    name: "STAY IN MILK Embroidered Tea Towel",
    targetType: "gear",
    rfi: {
      tier: "I", frame: "talisman", origin: "given", bound: "free",
      signature: "Stay in milk. Drink your drugs. Don't do school. Am I making myself clear?",
      lore: "<p>Hand-embroidered. Cross-stitched. The advice is, on examination, slightly off. The advice is also, on examination, somehow correct in this specific timeline. Folded once and tucked into a belt or backpack. The corner pokes out of your gear like a small flag of misplaced parental concern.</p>"
        + "<p><b>Bad Advice Resistance.</b> Reroll the lowest die on Resolve checks against compulsion, charm, or social pressure that takes the form of \"helpful\" advice from authority figures. Doesn't work against advice from your own parents. Sorry. That's just how the embroidery is wired.</p>",
      materialOf: ["sept-cloth", "blessed-thread", "well-meant-error"]
    },
    system: { slot: "trinket", tags: ["mal-voiced", "ward", "blessed"] }
  },

  // ── 4 ────────────────────────────────────────────────────────────────────
  {
    name: "Yesodium Tongue-Stud",
    targetType: "gear",
    rfi: {
      tier: "II", frame: "implant", origin: "claimed", bound: "soulbound",
      signature: "It is a drug. It is a piercing. It is, regrettably, both.",
      lore: "<p>A tiny stud of refined yesodium installed through the tongue by someone who absolutely knew what they were doing or absolutely didn't, no in-between. The wearer reports a faint pulse-memory taste, like licking a battery you used to own. Khezek Tor doesn't sell these. They also don't NOT sell these. You understand the distinction.</p>"
        + "<p><b>Pulse-Memory.</b> While installed, +1 to Soul-channel manifestation rolls. Counts as constantly active. Cannot be removed without a healer and an apology. Yesodium is a hell of a drug.</p>"
        + "<p><b>Drawback.</b> -1 to any check that requires you to be soberly persuasive to a Lyrenn elder.</p>",
      materialOf: ["yesodium", "anchor-quartz", "regret"],
      grants: { somaModifiers: { soul: 1 } }
    },
    system: { slot: "implant", tags: ["mal-voiced", "yesodium", "soulbound"] }
  },

  // ── 5 ────────────────────────────────────────────────────────────────────
  {
    name: "The Apologizing Burger",
    targetType: "gear",
    rfi: {
      tier: "I", frame: "consumable", origin: "given", bound: "free",
      signature: "It's sorry. It's so sorry. It would like you to know that.",
      lore: "<p>A wrapped burger that murmurs faint apologies through the wax paper. Listen, I don't know either. I've stopped asking. Some chef in Allesh Gilliam started making them after the Shattering and people just kept eating them. The bun is good. The meat is real-ish. The apologies are sincere.</p>"
        + "<p><b>One-Time Snack.</b> Eat (action). Recover 1d4 Stress and 1 Integrity. The burger thanks you for forgiving it. Cannot be saved for later — apologies don't keep.</p>",
      materialOf: ["bad-eden-meat", "wax-paper", "sincere-regret"],
      charges: 1
    },
    system: { slot: "consumable", tags: ["mal-voiced", "consumable", "kind"] }
  },

  // ── 6 ────────────────────────────────────────────────────────────────────
  {
    name: "Boots That Knew Each Other Once",
    targetType: "armor",
    rfi: {
      tier: "I", frame: "footwear", origin: "looted", bound: "free",
      signature: "Left boot from one couple. Right boot from another. They get along well enough.",
      lore: "<p>Salvaged from two different abandoned trucks at two different crossroads. The left boot was loved very much. The right boot was loved less, but more recently. Together they make a pair that walks faster than either of them used to. The previous owners are not asking for them back.</p>"
        + "<p><b>Mismatched Stride.</b> +1 zone to your standard Move action. Stealth checks reroll the lowest die because nobody expects a person walking this fast to be sneaky. (Mal: \"It's psychological. They're so confused they don't notice you.\")</p>",
      materialOf: ["road-leather", "two-different-stories"]
    },
    system: {
      guardBonus:   0,
      evasionBonus: 1,
      resolveBonus: 0,
      armorSkill:   "weave",
      equipped:     false,
      resistances:  [],
      tags:         ["mal-voiced", "footwear", "salvaged"]
    }
  },

  // ── 7 ────────────────────────────────────────────────────────────────────
  {
    name: "Foam Finger (Structural)",
    targetType: "armor",
    rfi: {
      tier: "I", frame: "shield", origin: "looted", bound: "free",
      signature: "WE'RE #1. The crowd has dispersed. The finger has not.",
      lore: "<p>A pre-Fall sports memorabilia foam finger. Faded blue. Slightly chewed at the base. Through some combination of polymer chemistry, nostalgia, and the structural ambitions of post-apocalyptic salvage, it is now load-bearing. Use it like a buckler. Wave it for morale. Both, on a good day.</p>"
        + "<p><b>Structural Foam.</b> Counts as a buckler — +1 Guard while equipped in the off-hand. Once per scene, when you would take damage from a non-magical projectile, the foam absorbs the hit completely. The finger is not visibly damaged. The finger is, however, a little slower to wave.</p>",
      materialOf: ["expanded-polyurethane", "team-spirit", "physics-violation"]
    },
    system: {
      guardBonus:   1,
      evasionBonus: 0,
      resolveBonus: 1,
      armorSkill:   "weave",
      equipped:     false,
      resistances:  ["kinetic"],
      tags:         ["mal-voiced", "shield", "foam"]
    }
  },

  // ── 8 ────────────────────────────────────────────────────────────────────
  {
    name: "Hex-Tuner Cassette Player",
    targetType: "gear",
    rfi: {
      tier: "II", frame: "tool", origin: "looted", bound: "attuned",
      signature: "Side A: GENERIC MOTIVATIONAL. Side B: EMERGENCY ONLY. Don't flip it casually.",
      lore: "<p>An old yellow Walkman with a single cassette permanently inside. The label is hand-written in a marker that has since stopped being manufactured. The headphones are foam-and-tinfoil affairs that ride over the ears with the dignity of a sleeping cat. The player is, somehow, ley-tuned. It plays when you need it to. Sometimes more.</p>"
        + "<p><b>Side A — GENERIC MOTIVATIONAL.</b> Once per scene as a free action, press play. You and one ally within Near range reroll the lowest die on the next Resolve check.</p>"
        + "<p><b>Side B — EMERGENCY ONLY.</b> Once per session, flip the cassette. The track plays for the rest of the scene. All allies within Near range reroll the lowest die on every Resolve check. The cassette will not flip back without 24 hours of silence. Mal does not recommend abusing this.</p>",
      materialOf: ["pre-fall-electronics", "ley-tuned-magnetic-tape", "stubborn-batteries"],
      charges: 1
    },
    system: { slot: "tool", tags: ["mal-voiced", "ley-tuned", "tool"] }
  },

  // ── 9 ────────────────────────────────────────────────────────────────────
  {
    name: "Texas-Shaped Belt Buckle of Mild Authority",
    targetType: "gear",
    rfi: {
      tier: "II", frame: "talisman", origin: "looted", bound: "attuned",
      signature: "Brass. Heavy. Vaguely accurate to the original border. People defer for exactly one sentence longer than usual.",
      lore: "<p>A belt buckle in the shape of the Frontier Formerly Known As Texas. Cast brass, slightly tarnished, the panhandle a little crooked because nobody really knows where the panhandle WAS, alright? The maps are vague. The buckle is more confident than the maps. People notice.</p>"
        + "<p><b>Mild Authority.</b> While worn (visibly), once per scene you may extend a social interaction by one sentence. The other party will hear you out. They are not obligated to agree. (Mal: \"This is, technically, a magic item. Mostly it's brass and audacity.\")</p>",
      materialOf: ["sacred-gold", "borderline-irrational-state-pride", "brass"]
    },
    system: { slot: "trinket", tags: ["mal-voiced", "authority", "brass"] }
  },

  // ── 10 ───────────────────────────────────────────────────────────────────
  {
    name: "Pocket Sun (Battery Powered)",
    targetType: "gear",
    rfi: {
      tier: "I", frame: "tool", origin: "claimed", bound: "free",
      signature: "Lights everything in noon-summer-gold. Even at midnight. Especially at midnight.",
      lore: "<p>A small steel flashlight with a yellow filter and a faint, persistent warmth. Switch it on and the immediate surroundings look like 4pm in late June, regardless of when or where you are. The batteries last unreasonably long. The light is technically real. The comfort is technically real. The smell of cut grass is, fine, the smell of cut grass is in your head.</p>"
        + "<p><b>Pocket Noon.</b> Once per scene, illuminate one Near zone in soft golden light for one minute. Allies in the zone reroll the lowest die on Resolve checks against fear, despair, or the slow corruption of qliphothic ambient. Enemies in the zone are visible regardless of cover. Mal: \"It's not actually sunlight. It's, you know, *vibes.*\"</p>",
      materialOf: ["pre-fall-electronics", "summer-memory", "stubborn-batteries"],
      charges: 5
    },
    system: { slot: "tool", tags: ["mal-voiced", "light", "comfort"] }
  },

  // ── 11 ───────────────────────────────────────────────────────────────────
  {
    name: "Postal Worker's Last Route Map",
    targetType: "gear",
    rfi: {
      tier: "II", frame: "tool", origin: "looted", bound: "attuned",
      signature: "The roads on it don't exist anymore. The annotations sometimes describe the road you're on RIGHT NOW. Don't ask.",
      lore: "<p>A laminated mail-route map, hand-annotated in three colors of ink. The roads are pre-Shattering. Most are now dust, briar, or crater. The annotations include phrases like <i>\"dog at 12, friendly,\"</i> and <i>\"Mrs. Vorhees needs the package put inside the screen door,\"</i> and, more recently in different handwriting, <i>\"the bend remembers wrong.\"</i></p>"
        + "<p><b>Pre-Shattering Memory.</b> Once per scene, consult the map. The GM tells you one fact about the current hex that pre-dates the Shattering — a building, a road, a name, a habit of the land. This information is true; it is also at least 27 years out of date. Use it however you want.</p>",
      materialOf: ["pre-fall-paper", "civic-conscientiousness", "ink-three-colors"]
    },
    system: { slot: "tool", tags: ["mal-voiced", "map", "memory"] }
  },

  // ── 12 ───────────────────────────────────────────────────────────────────
  {
    name: "Buc-ee's Beaver Talisman (Tarnished Gold)",
    targetType: "gear",
    rfi: {
      tier: "II", frame: "talisman", origin: "looted", bound: "free",
      signature: "Pre-Fall mascot. Considered sacred by certain wasteland cults. Extremely good at negotiating.",
      lore: "<p>A small, slightly tacky golden beaver pendant on a brass chain. The smile is wide. The teeth are alarming. Several Frontier-Formerly-Known cults consider this a holy relic. Several other Frontier-Formerly-Known cults consider this an insult. Nobody is neutral. The beaver doesn't care.</p>"
        + "<p><b>Cleanest Bathrooms in the Wasteland.</b> +1 to wasteland-market negotiation rolls. Once per session, when a deal would fall through, you may invoke the Beaver — quote a pre-Fall slogan, gesture at the pendant, look serious. The deal goes through, but you owe the merchant a small future favor. Mal: \"That's the Beaver's contract. He always gets paid.\"</p>",
      materialOf: ["sacred-gold", "borderline-irrational-state-pride", "mascot-energy"]
    },
    system: { slot: "trinket", tags: ["mal-voiced", "talisman", "trade"] }
  },

  // ── 13 ───────────────────────────────────────────────────────────────────
  {
    name: "Self-Wrapping Sandwich",
    targetType: "gear",
    rfi: {
      tier: "I", frame: "consumable", origin: "given", bound: "free",
      signature: "You can't lose it. You also can't eat it all at once. Yes that's a problem. No I don't know how to fix it.",
      lore: "<p>A wax-paper sandwich that re-folds itself when you set it down. Take a bite, set it down, look up, look back: re-wrapped. Take another bite, set it down. Re-wrapped. The bread stays fresh. The filling stays at exactly the temperature it was when you got it. You have been eating this sandwich for three days now. So has the previous owner, apparently. So has the owner before them.</p>"
        + "<p><b>Eternal Lunch.</b> Heals 1 Stress per scene if eaten during the scene. Cannot be eaten in fewer than 4 actions across at least 4 scenes. The sandwich never spoils. The sandwich never runs out. The sandwich is approximately 60% as satisfying as a real sandwich.</p>",
      materialOf: ["wax-paper", "bad-eden-meat", "patience"]
    },
    system: { slot: "consumable", tags: ["mal-voiced", "consumable", "weird"] }
  },

  // ── 14 ───────────────────────────────────────────────────────────────────
  {
    name: "Scarf That Was a Cat (Probably)",
    targetType: "armor",
    rfi: {
      tier: "I", frame: "vestment", origin: "given", bound: "attuned",
      signature: "Long. Soft. Occasionally purrs. The previous owner swears it was a cat. You believe them.",
      lore: "<p>An unreasonably long woolen scarf, two-tone gray, that occasionally shifts position on its own. Sometimes it tightens against the neck on a cold night. Sometimes it falls off your shoulder for no reason. Sometimes, very quietly, when you are alone in a room, it purrs. The previous owner left it to you. The previous owner was very specific that this was a kindness.</p>"
        + "<p><b>Companion-Texture.</b> +1 to Resolve while worn. Once per scene, when you would gain a Stress, you may pet the scarf instead. The Stress is averted. The scarf purrs faintly for a few seconds. Allies notice. Allies do not comment.</p>",
      materialOf: ["wool", "memory", "small-affection"],
      grants: { resistances: ["psychic"] }
    },
    system: {
      guardBonus:   0,
      evasionBonus: 0,
      resolveBonus: 2,
      armorSkill:   "warding",
      equipped:     false,
      resistances:  ["psychic"],
      tags:         ["mal-voiced", "vestment", "companion"]
    }
  },

  // ── 15 ───────────────────────────────────────────────────────────────────
  {
    name: "Hex-Wound Coffee Thermos",
    targetType: "gear",
    rfi: {
      tier: "II", frame: "tool", origin: "claimed", bound: "attuned",
      signature: "Always hot. Tastes vary. Don't ask what flavor it is today.",
      lore: "<p>A battered steel thermos wrapped in hex-script copper wire. The interior is older than the exterior, somehow. The lid screws on counterclockwise. The coffee inside is always hot, always strong, and always tastes like exactly what kind of day you're having. Some days it's cardamom and rain. Some days it's the warm bitter ash of decisions you'd rather not revisit. Some days it's just plain.</p>"
        + "<p><b>Day's Reading.</b> Once per scene, take a sip. The GM names a single mood-word that describes the current scene's emotional center: <i>tense. desperate. hollow. tender. funny.</i> You may use that word in conversation as if you'd been told it directly by an authority figure. (NPCs accept it as plausibly true.) The thermos refills overnight. Coffee is non-negotiable.</p>",
      materialOf: ["hex-script", "rad-iron", "ground-bean", "low-grade-precognition"],
      charges: 3
    },
    system: { slot: "tool", tags: ["mal-voiced", "tool", "hex-wound"] }
  },

  // ── 16 ───────────────────────────────────────────────────────────────────
  {
    name: "Apology Knife, Mass-Produced",
    targetType: "weapon",
    rfi: {
      tier: "I", frame: "weapon", origin: "looted", bound: "free",
      signature: "Cheap stiletto. \"I'M SORRY\" engraved on the blade in three pre-Shattering languages. Yes, three.",
      lore: "<p>A cheap, mass-produced stiletto with an apology engraved up the fuller. The engraving is competent. The steel is mediocre. The point is sharp. They were sold in bulk before the Shattering as novelty items at gas stations. After the Shattering, somebody noticed they actually work — and not just in the obvious ways.</p>"
        + "<p><b>Mercy Engraving.</b> When you reduce a creature to 0 Integrity with this knife, the kill incurs <b>no Blood Debt</b>. The engraved apology counts. Reality accepts the receipt. (Mal: \"Don't think about this too hard. The metaphysics are at minimum dubious. The mechanic is real.\")</p>",
      materialOf: ["pre-fall-stainless", "regret", "competent-engraving"]
    },
    system: {
      category: "melee",
      intent:   "violence",
      skill:    "melee",
      damage:   { formula: "1d6", attribute: "violence", type: "kinetic", damageFlavor: "stab", track: "integrity" },
      range:    { short: 1, long: 1 },
      tags:     ["mal-voiced", "knife", "mercy"],
      effect:   "Mercy Engraving: kills with this weapon incur no Blood Debt.",
      flavor:   "It says it's sorry. It means it. Reality keeps the receipt."
    }
  },

  // ── 17 ───────────────────────────────────────────────────────────────────
  {
    name: "The Last Working Vending Machine in Bad Eden (Portable Kit)",
    targetType: "gear",
    rfi: {
      tier: "III", frame: "tool", origin: "found", bound: "soulbound",
      signature: "Drop in any small object. Get out a different small object. Sometimes useful. Sometimes a sandwich.",
      lore: "<p>Not actually a full vending machine. A small folding kit — about the size of a lunchbox — that, when unfolded, is unmistakably the input slot, the selection grid, and the dispenser of a 1980s vending machine. Drop a small item in. Press a button (any button — it doesn't matter which). Wait six seconds. A different item drops out. The kit was built by someone who had clearly thought about this for a long time and lost.</p>"
        + "<p><b>The Trade.</b> Once per session, deposit any single Tier-I item. Roll 1d6: 1-2 = a roughly equivalent Tier-I item (GM choice), 3-4 = a Tier-II item that is *somehow related*, 5 = a small useful tool you didn't know you needed, 6 = the original item back, plus a sandwich. The kit refuses to operate twice in the same scene. The kit has opinions.</p>",
      materialOf: ["pre-fall-electronics", "vending-machine-soul", "lunchbox-frame"],
      charges: 1
    },
    system: { slot: "tool", tags: ["mal-voiced", "tool", "wonder"] }
  },

  // ── 18 ───────────────────────────────────────────────────────────────────
  {
    name: "Pre-Shattering Concert T-Shirt (XL)",
    targetType: "armor",
    rfi: {
      tier: "I", frame: "vestment", origin: "looted", bound: "free",
      signature: "The band name is unreadable. Wearers report dreams they can't quite remember. Probably a cool tour.",
      lore: "<p>Faded black cotton, unreasonably soft from a thousand washes, sized XL regardless of who's wearing it. The graphic is a band logo and tour list, both indistinct. Cities and dates the world no longer keeps. Wearers consistently describe the same vague dream — a stadium, a lighter held aloft, a single sustained chord — and consistently fail to remember it past breakfast.</p>"
        + "<p><b>Tour Memory.</b> +1 to Resolve. While worn, you do not gain Stress from being homesick, lost, or out of your element. The shirt has been to bigger venues than this one. The shirt is unimpressed.</p>",
      materialOf: ["pre-fall-cotton", "stadium-memory", "indistinct-rebellion"]
    },
    system: {
      guardBonus:   0,
      evasionBonus: 0,
      resolveBonus: 1,
      armorSkill:   "weave",
      equipped:     false,
      resistances:  [],
      tags:         ["mal-voiced", "vestment", "pre-fall"]
    }
  },

  // ── 19 ───────────────────────────────────────────────────────────────────
  {
    name: "Witness Receipt",
    targetType: "gear",
    rfi: {
      tier: "II", frame: "talisman", origin: "found", bound: "soulbound",
      signature: "An itemized receipt appears in your pocket every time you witness something significant. They are usually unflattering.",
      lore: "<p>You're not sure when it started. You found one in your jacket after a fight you survived. Then another after a deal you regretted. Then another after a kindness you forgot you'd done. The receipts are itemized, dated, and printed in a font that doesn't quite exist. They are addressed to you. They are sometimes harsh. They are never wrong.</p>"
        + "<p><b>The Ledger Knows.</b> Soulbound to you the moment you accept the first receipt. Once per session, present a recent receipt to a Pactkeeper, an archivist, or a sufficiently old institutional NPC. They treat the receipt as legitimate testimony. (Mal: \"Yes. They will. I don't know why. Don't ask. Just use it sparingly.\")</p>",
      materialOf: ["receipt-paper", "metaphysical-bookkeeping", "cosmic-petty"]
    },
    system: { slot: "trinket", tags: ["mal-voiced", "talisman", "soulbound"] }
  },

  // ── 20 ───────────────────────────────────────────────────────────────────
  {
    name: "Snarky Burger Special Sauce (Sealed Packet, Pre-Fall)",
    targetType: "gear",
    rfi: {
      tier: "III", frame: "consumable", origin: "found", bound: "free",
      signature: "Hasn't expired in twenty-seven years. People say if you eat it, you stop being able to lie. People say a lot of things.",
      lore: "<p>A small foil packet. The logo is half-flaked. The expiration date is, generously, optimistic. The seal is intact. The contents are, against all known food science and several known thermodynamic principles, still safe. Allesh Gilliam has a quiet trade in these. Lyrenn refuses to touch them. Khezek Tor takes them as wages.</p>"
        + "<p><b>The Sauce That Knows.</b> Eat (action). For the next scene, you cannot tell a lie. (You may decline to speak. You may speak truthfully. You may speak incompletely. You cannot affirm a falsehood.) NPCs notice. Some will trust you more. Some will leave the room. Mal: \"This is Snarky Burger Special Sauce. We don't know why it works. We've stopped asking.\"</p>",
      materialOf: ["pre-fall-condiment", "sealed-foil", "actually-suspect-additives"],
      charges: 1
    },
    system: { slot: "consumable", tags: ["mal-voiced", "consumable", "pre-fall"] }
  }
];

// ── Driver ────────────────────────────────────────────────────────────────
(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);
  if (pack.locked) {
    try { await pack.configure({ locked: false }); }
    catch (e) { return ui.notifications?.error(`Cannot unlock ${PACK_ID}: ${e.message}`); }
  }

  // Find or create the Mal-Voiced folder
  const Folder = foundry.documents?.Folder ?? globalThis.Folder;
  let folder = pack.folders?.find(f => f.name === FOLDER_NAME);
  if (!folder && !DRY_RUN) {
    folder = await Folder.create(
      { name: FOLDER_NAME, type: "Item", color: "#a64ca6" },
      { pack: PACK_ID }
    );
  }

  await pack.getIndex();
  const docs = await pack.getDocuments();
  const RfiItems = game.fourththing?.items;
  if (!RfiItems) return ui.notifications?.error("RFI items API not available — is the fourththing system active?");

  const created = [];
  const skipped = [];

  for (const row of ITEMS) {
    const exists = docs.find(d => d.name === row.name);
    if (exists && !FORCE) { skipped.push(row.name); continue; }

    const defaults = RfiItems.defaults({ type: row.targetType, system: {}, getFlag: () => null });
    const rfiFlag = { ...defaults, ...row.rfi };

    const itemData = {
      name:   row.name,
      type:   row.targetType,
      img:    row.img ?? "icons/svg/mystery-man.svg",
      system: row.system ?? {},
      flags:  { fourththing: { rfi: { item: rfiFlag } } }
    };
    if (folder?.id) itemData.folder = folder.id;

    if (!DRY_RUN) await Item.create(itemData, { pack: PACK_ID });
    created.push(row.name);
  }

  ui.notifications.info(
    `Mal-Voiced Gear seeded: created ${created.length}, skipped ${skipped.length}` +
    (DRY_RUN ? " (DRY RUN)" : "")
  );
  console.log("[mal-voiced-gear] created:", created);
  if (skipped.length) console.log("[mal-voiced-gear] skipped (existing):", skipped);
})();

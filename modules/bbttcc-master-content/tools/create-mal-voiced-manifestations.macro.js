// BBTTCC — Mal-Voiced Manifestations (2026-05-20)
// ─────────────────────────────────────────────────────────────────────────────
// 20 round-conflict manifestations narrated in Mal's voice (the snarky, self-
// aware, unreliable narrator of Bad Eden). Mostly Tier 1–2 with a handful of
// Tier 3–4. Designed to be USEFUL in combat without being lethal: crowd
// control, distractions, defense debuffs, and modest psychic stress damage.
// No integrity damage, no Burning, no Dying — these win fights by making
// people uncomfortable, not by killing them.
//
//   Tier breakdown: 8 × T1, 7 × T2, 3 × T3, 2 × T4
//
// All items live in the `bbttcc-master-content.items` compendium under a new
// folder "Mal-Voiced Manifestations". Each is stamped with:
//   • flags.fourththing.malVoiced: true     (filterable in pickers)
//   • flags.fourththing.malVoicedTier: <n>  (sortable by power level)
//
// Idempotent — re-running skips items that already exist by name unless
// FORCE_CREATE = true. Paste this whole file into a Script Macro and run
// as GM. Requires the fourththing system (uses
// game.fourththing.createManifestationItemData to build canonical item data).
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  if (!game.user.isGM) {
    ui.notifications?.error("GM only — this macro authors compendium content.");
    return;
  }

  const PACK_ID      = "bbttcc-master-content.items";
  const FOLDER_NAME  = "Mal-Voiced Manifestations";
  const DRY_RUN      = false;
  const FORCE_CREATE = false;

  const builder = game?.fourththing?.createManifestationItemData;
  if (typeof builder !== "function") {
    ui.notifications?.error("fourththing.createManifestationItemData not loaded — reload Foundry after system update.");
    return;
  }

  const pack = game.packs?.get?.(PACK_ID);
  if (!pack) {
    ui.notifications?.error(`Pack not found: ${PACK_ID}`);
    return;
  }

  // Ensure folder exists inside the compendium.
  let folder = null;
  const existingFolders = pack.folders?.contents ?? [];
  folder = existingFolders.find(f => f.name === FOLDER_NAME) ?? null;
  if (!folder && !DRY_RUN) {
    folder = await Folder.create({ name: FOLDER_NAME, type: "Item", color: "#7a3aa3" }, { pack: PACK_ID });
  }

  // Index existing items in the pack (idempotency).
  const index = await pack.getIndex();
  const existingByName = new Map(index.map(e => [e.name, e]));

  // ── DAMAGE HELPER ─────────────────────────────────────────────────────────
  // Compact constructor: dmg(n, "dX", "psychic", "stress") → real damageRoll.
  // dmg(0) → op:"none" blank for pure-CC manifestations.
  const dmg = (number, die, type, track, attribute = "intrigue", flavor = "") => {
    if (!number || !die) return { op: "none", number: 0, die: "d6", attribute: "", type: "kinetic", flavor: "", track: "integrity" };
    return { op: "damage", number, die, attribute, type, flavor, track };
  };

  // ── APPLIED-STATES HELPER ─────────────────────────────────────────────────
  // Builds an appliedStates block from a compact opts object. Defaults to a
  // 1-round duration with cast-DC saves on Soul (the most common shape for
  // psychic CC). Override by passing duration, saveAttribute, saveEachRound.
  const states = (keys, opts = {}) => ({
    states: keys,
    duration:      opts.duration ?? "1-round",
    saveEachRound: opts.saveEachRound ?? false,
    saveAttribute: opts.saveAttribute ?? "soul",
    saveDcMode:    "cast-dc",
    saveDcFixed:   15,
    saveAttributeOverrides: opts.saveAttributeOverrides ?? {}
  });

  // ── DEFENSE-DEBUFF HELPER ─────────────────────────────────────────────────
  // Negative AE modifier on the target's defenses. Stack multiple by passing
  // an array of pairs, e.g. debuffs([["guard", 2], ["evasion", 1]]).
  const debuffs = (pairs = []) => ({
    modifiers: pairs.map(([stat, value]) => ({ stat, op: "-", value })),
    resists: [],
    immunes: []
  });

  // ── MANIFESTATION SPECS ───────────────────────────────────────────────────
  // 20 entries. Mal's voice: snarky, exhausted-but-protective, mixes cosmic
  // absurdity with truck-stop Americana, personifies the inanimate.
  const MANIFESTATIONS = [
    // ════════════════════════════════════════════════════════════════════════
    // TIER 1 — 8 entries (brief single-target CC, light stress)
    // ════════════════════════════════════════════════════════════════════════
    {
      name: "Invisible Clowns",
      tier: 1, intent: "intrigue", channel: "mind", sephirah: "hod",
      damageRoll: dmg(0),
      appliedStates: states(["staggered"], { saveAttribute: "soul" }),
      appliedEffects: debuffs([["guard", 2]]),
      concept: "Mal whispers and the target sees four greasepainted gentlemen they cannot quite focus on. They are honking. They are also, somehow, behind.",
      effect: "Target: Soul defense vs Cast DC. On fail: Staggered (movement halved, −2 attacks) and Guard −2 for 1 round.",
      flavor: "There aren't any clowns. You can tell because they aren't here. That isn't helping.",
      tags: ["mal-voiced", "cc", "distraction"]
    },
    {
      name: "The Floor's Just A Suggestion",
      tier: 1, intent: "intrigue", channel: "mind", sephirah: "yesod",
      damageRoll: dmg(0),
      appliedStates: states(["prone"], { saveAttribute: "body" }),
      concept: "Mal points out that the floor is, technically, a story everyone agreed to. The target loses the thread of that story.",
      effect: "Target: Body defense vs Cast DC. On fail: Prone for 1 round.",
      flavor: "It's still there. They just don't believe in it for a moment.",
      tags: ["mal-voiced", "cc", "prone"]
    },
    {
      name: "Sudden Memory Of A Bee",
      tier: 1, intent: "intrigue", channel: "mind", sephirah: "hod",
      damageRoll: dmg(1, "d4", "psychic", "stress", "intrigue"),
      appliedStates: states(["shaken"], { saveAttribute: "soul" }),
      appliedEffects: debuffs([["evasion", 2]]),
      concept: "Target distinctly remembers a bee on their neck. The bee is not there. The hand goes up anyway.",
      effect: "Target: Soul defense vs Cast DC. On fail: 1d4 psychic (stress), Shaken, and Evasion −2 for 1 round.",
      flavor: "Everybody's got a bee story. This is the worst one.",
      tags: ["mal-voiced", "stress", "distraction"]
    },
    {
      name: "Spotlight That Isn't There",
      tier: 1, intent: "intrigue", channel: "mind", sephirah: "hod",
      damageRoll: dmg(0),
      appliedStates: states(["blinded"], { saveAttribute: "presence" }),
      concept: "A cone of attention narrows on the target. They feel it on their face. They lose track of everything outside it.",
      effect: "Target: Presence defense vs Cast DC. On fail: Blinded for 1 round.",
      flavor: "Mal didn't put it there. Mal is just, like, pointing it out.",
      tags: ["mal-voiced", "cc", "blind"]
    },
    {
      name: "The Pre-Sneeze",
      tier: 1, intent: "intrigue", channel: "body", sephirah: "yesod",
      damageRoll: dmg(0),
      appliedStates: states(["staggered"], { saveAttribute: "body" }),
      concept: "Held in the endless half-second before a sneeze that will not finish. Useless and unable to leave.",
      effect: "Target: Body defense vs Cast DC. On fail: Staggered for 1 round and may not take reactions.",
      flavor: "It's coming. It isn't. It's coming. It isn't.",
      tags: ["mal-voiced", "cc", "reaction-deny"]
    },
    {
      name: "Unsolicited Jingle",
      tier: 1, intent: "presence", channel: "soul", sephirah: "hod",
      damageRoll: dmg(1, "d4", "psychic", "stress", "presence"),
      appliedStates: states(["shaken"], { saveAttribute: "soul" }),
      appliedEffects: debuffs([["resolve", 2]]),
      concept: "A jingle from a commercial that aired before the world ended attaches itself to the target's inner ear and will not vacate.",
      effect: "Target: Soul defense vs Cast DC. On fail: 1d4 psychic (stress), Shaken, and Resolve −2 for 1 round.",
      flavor: "It's about toothpaste. The toothpaste is gone. The jingle isn't.",
      tags: ["mal-voiced", "stress", "earworm"]
    },
    {
      name: "Cold Hands From An Aunt You Don't Have",
      tier: 1, intent: "intrigue", channel: "soul", sephirah: "geburah",
      damageRoll: dmg(1, "d6", "psychic", "stress", "intrigue"),
      appliedStates: states([], { saveAttribute: "soul" }),
      appliedEffects: debuffs([["guard", 1]]),
      concept: "Phantom cold press of palms on either side of the target's face. Whoever she was, she meant well.",
      effect: "Target: Soul defense vs Cast DC. On fail: 1d6 psychic (stress) and Guard −1 for 1 round.",
      flavor: "She was never your aunt. She is briefly your aunt. Then she isn't, but the cold stays.",
      tags: ["mal-voiced", "stress", "haunt"]
    },
    {
      name: "Pocket Existential Crisis",
      tier: 1, intent: "intrigue", channel: "mind", sephirah: "binah",
      damageRoll: dmg(0),
      appliedStates: states(["calmed"], { saveAttribute: "mind" }),
      concept: "Target catches their reflection in something and asks, briefly, why they are doing this. The answer takes a moment.",
      effect: "Target: Mind defense vs Cast DC. On fail: Calmed (cannot take violent actions willingly) for 1 round.",
      flavor: "Mal: 'It's a good question. I've been meaning to ask it.'",
      tags: ["mal-voiced", "cc", "calm"]
    },

    // ════════════════════════════════════════════════════════════════════════
    // TIER 2 — 7 entries (medium CC, modest AoE, sustained debuffs)
    // ════════════════════════════════════════════════════════════════════════
    {
      name: "Squirrel Of Cosmic Importance",
      tier: 2, intent: "intrigue", channel: "mind", sephirah: "yesod",
      damageRoll: dmg(0),
      appliedStates: states(["compelled"], { duration: "2-rounds", saveEachRound: true, saveAttribute: "soul" }),
      appliedEffects: debuffs([["resolve", 2]]),
      concept: "A squirrel crosses the target's eyeline. It is normal in every way except that it is profoundly Important. They must follow it.",
      effect: "Target: Soul defense vs Cast DC each round. On fail: Compelled (must spend at least one action chasing the squirrel away from the fight) and Resolve −2 for 2 rounds.",
      flavor: "It's not even a special squirrel. That is the issue.",
      tags: ["mal-voiced", "cc", "compel"]
    },
    {
      name: "The Karaoke Microphone Of Hannukiel",
      tier: 2, intent: "presence", channel: "soul", sephirah: "hod",
      damageRoll: dmg(2, "d6", "psychic", "stress", "presence"),
      appliedStates: states(["calmed"], { saveAttribute: "soul" }),
      concept: "A microphone the target cannot decline materializes in their hand. The song begins. They have always known the words.",
      effect: "Target: Soul defense vs Cast DC. On fail: 2d6 psychic (stress) and Calmed for 1 round — they cannot take violent actions while singing.",
      flavor: "It's Toto. It's always Toto. Mal does not know why.",
      tags: ["mal-voiced", "stress", "cc", "calm"]
    },
    {
      name: "Sub-Sandwich Premonition",
      tier: 2, intent: "intrigue", channel: "mind", sephirah: "malkuth",
      damageRoll: dmg(0),
      appliedStates: states(["shaken"], { saveAttribute: "presence" }),
      appliedEffects: debuffs([["guard", 2]]),
      concept: "Target is hit by a craving for a sandwich they remember vividly and have never eaten. Their attention is elsewhere.",
      effect: "Target: Presence defense vs Cast DC. On fail: Shaken, Guard −2, and loses their next bonus action for 1 round.",
      flavor: "It had pickled things. It had a name in Spanish. It is gone.",
      tags: ["mal-voiced", "cc", "action-deny"]
    },
    {
      name: "The Conversation They Meant To Have",
      tier: 2, intent: "intrigue", channel: "mind", sephirah: "tiferet",
      damageRoll: dmg(2, "d6", "psychic", "stress", "intrigue"),
      appliedStates: states(["shaken"], { duration: "2-rounds", saveEachRound: true, saveAttribute: "soul" }),
      concept: "Forced rumination. Target replays the conversation they should have had, with the person they should have had it with, in the order they should have had it.",
      effect: "Target: Soul defense vs Cast DC each round. On fail: 2d6 psychic (stress) and Shaken for 2 rounds.",
      flavor: "It goes better this time. They notice.",
      tags: ["mal-voiced", "stress", "regret"]
    },
    {
      name: "Misplaced Keys (Theirs)",
      tier: 2, intent: "intrigue", channel: "body", sephirah: "malkuth",
      damageRoll: dmg(0),
      appliedStates: states(["restrained"], { saveAttribute: "body" }),
      concept: "The target abruptly cannot find their keys. They are patting themselves down. They are not moving forward.",
      effect: "Target: Body defense vs Cast DC. On fail: Restrained for 1 round (frantic self-search; Evasion → 10).",
      flavor: "The keys are in their other pocket. Mal isn't going to tell them.",
      tags: ["mal-voiced", "cc", "restrain"]
    },
    {
      name: "Disco Ball Of Hod",
      tier: 2, intent: "intrigue", channel: "mind", sephirah: "hod",
      damageRoll: dmg(1, "d6", "psychic", "stress", "intrigue"),
      appliedStates: states(["blinded"], { saveAttribute: "body" }),
      concept: "Spinning light without a light source. Every nearby brain interprets it generously.",
      effect: "All enemies within Near range: Body defense vs Cast DC. On fail: 1d6 psychic (stress) and Blinded for 1 round.",
      flavor: "Mal: 'Yes, of course it's the Sephirah of glamour. What else would it be.'",
      tags: ["mal-voiced", "aoe", "near", "blind"]
    },
    {
      name: "The Unanswerable Voicemail",
      tier: 2, intent: "intrigue", channel: "soul", sephirah: "hod",
      damageRoll: dmg(1, "d6", "psychic", "stress", "intrigue"),
      appliedStates: states(["staggered"], { saveAttribute: "soul" }),
      concept: "A buzz at the hip. The target reaches for a phone that no longer exists. The message is from someone who no longer exists.",
      effect: "Target: Soul defense vs Cast DC. On fail: 1d6 psychic (stress), Staggered, and may not take reactions for 1 round.",
      flavor: "They knew. You should call them back.",
      tags: ["mal-voiced", "stress", "haunt", "reaction-deny"]
    },

    // ════════════════════════════════════════════════════════════════════════
    // TIER 3 — 3 entries (sustained CC, AoE, scene-impact)
    // ════════════════════════════════════════════════════════════════════════
    {
      name: "Public Speaking, Forever",
      tier: 3, intent: "presence", channel: "soul", sephirah: "tiferet",
      damageRoll: dmg(3, "d6", "psychic", "stress", "presence"),
      appliedStates: states(["compelled"], { duration: "2-rounds", saveEachRound: true, saveAttribute: "soul" }),
      appliedEffects: debuffs([["guard", 2]]),
      concept: "Target stands behind a podium that isn't there. The audience is. They have notes. They cannot stop.",
      effect: "Target: Soul defense vs Cast DC each round. On fail: 3d6 psychic (stress), Compelled (must spend an action speaking; cannot attack), and Guard −2 for 2 rounds.",
      flavor: "The slides have advanced. The next one is them, asleep, age six. Mal is sorry.",
      tags: ["mal-voiced", "cc", "compel", "stress"]
    },
    {
      name: "The Whole Restaurant Heard That",
      tier: 3, intent: "presence", channel: "soul", sephirah: "hod",
      damageRoll: dmg(0),
      appliedStates: states(["shaken"], { duration: "2-rounds", saveEachRound: true, saveAttribute: "presence" }),
      appliedEffects: debuffs([["guard", 2]]),
      concept: "The last action of each enemy is, retroactively, deeply embarrassing. Everyone is looking. The way no one looks at you when they are looking.",
      effect: "All enemies within Near range: Presence defense vs Cast DC each round. On fail: Shaken and Guard −2 for 2 rounds.",
      flavor: "Mal: 'I won't tell you what they all heard. You'd be Shaken too.'",
      tags: ["mal-voiced", "aoe", "near", "social"]
    },
    {
      name: "Tax Audit Of The Soul",
      tier: 3, intent: "intrigue", channel: "soul", sephirah: "binah",
      damageRoll: dmg(2, "d6", "psychic", "stress", "intrigue"),
      appliedStates: states(["restrained"], { duration: "2-rounds", saveAttribute: "soul" }),
      concept: "A folder of receipts the target does not remember collecting opens itself. The audit is in progress.",
      effect: "Target: Soul defense vs Cast DC. On fail: 2d6 psychic (stress), Restrained for 2 rounds (paperwork takes precedence), and loses access to one OP pool of the GM's choice until end of scene.",
      flavor: "The amount owed is in moments. The currency is unfavorable today.",
      tags: ["mal-voiced", "cc", "op-strip", "scene"]
    },

    // ════════════════════════════════════════════════════════════════════════
    // TIER 4 — 2 entries (scene-shaping, non-lethal but enormous)
    // ════════════════════════════════════════════════════════════════════════
    {
      name: "The Mall Of Forgotten Things",
      tier: 4, intent: "intrigue", channel: "mind", sephirah: "yesod",
      damageRoll: dmg(1, "d6", "psychic", "stress", "intrigue"),
      appliedStates: states(["compelled"], { duration: "3-rounds", saveEachRound: true, saveAttribute: "soul" }),
      concept: "An overlay of food-court linoleum and dead-storefront signage settles on the area. Enemies forget what they came in for.",
      effect: "All enemies within Far range: Soul defense vs Cast DC each round. On fail: Compelled (cannot leave the affected area; must spend an action wandering) and 1d6 psychic (stress) for 3 rounds.",
      flavor: "There is a Sbarro. There has never been a Sbarro. There is one now.",
      tags: ["mal-voiced", "aoe", "far", "compel", "scene-shape"]
    },
    {
      name: "Mal Narrates The Scene",
      tier: 4, intent: "presence", channel: "soul", sephirah: "keter",
      damageRoll: dmg(0),
      appliedStates: states(["shaken"], { duration: "scene", saveAttribute: "soul" }),
      concept: "Mal interjects. Mal's voice fills the negative space. The enemies suddenly know they are being talked about, and not kindly.",
      effect: "All enemies within Far range: Soul defense vs Cast DC. On fail: Shaken until end of scene. While Shaken from this manifestation, the first attack each round against the target by an ally rerolls its lowest die.",
      flavor: "Mal: 'They were always going to lose this. I'm just confirming it out loud.'",
      tags: ["mal-voiced", "aoe", "far", "scene", "narrator"]
    }
  ];

  // ── BUILD + STAMP ─────────────────────────────────────────────────────────
  // Per-spec: build canonical item data via system helper, stamp Mal-Voiced
  // flags, assign folder + tier-appropriate icon, Item.create into the pack.
  let created = 0, skipped = 0, failed = 0;
  for (const spec of MANIFESTATIONS) {
    if (existingByName.has(spec.name) && !FORCE_CREATE) { skipped++; continue; }
    try {
      const values = {
        name: spec.name,
        tier: spec.tier,
        intent: spec.intent,
        channel: spec.channel,
        sephirah: spec.sephirah,
        mode: "hermetic",
        stability: spec.stability ?? "ephemeral",
        form: "working",
        function: spec.damageRoll?.op === "damage" ? "harm" : "press",
        interactionModel: "directed",
        damageRoll: spec.damageRoll,
        appliedStates: spec.appliedStates,
        appliedEffects: spec.appliedEffects,
        concept: spec.concept,
        effect: spec.effect,
        flavor: spec.flavor,
        tags: [...(spec.tags ?? []), `tier:${spec.tier}`],
        costType: "clarity",
        costValue: Math.max(1, Math.floor(spec.tier / 2) || 1),
        duration: spec.duration ?? (spec.appliedStates?.duration ?? "1-round"),
        scale: spec.scale ?? "encounter",
        activation_block: { type: "action", consumePool: true }
      };
      const itemData = builder(null, "power", values);

      // Stamp Mal-Voiced flags so future pickers can filter on these.
      itemData.flags = itemData.flags ?? {};
      itemData.flags.fourththing = itemData.flags.fourththing ?? {};
      itemData.flags.fourththing.malVoiced = true;
      itemData.flags.fourththing.malVoicedTier = spec.tier;

      // Folder assignment + tier-appropriate icon.
      if (folder?.id) itemData.folder = folder.id;
      itemData.img = ({
        1: "icons/magic/symbols/question-stone-yellow.webp",
        2: "icons/magic/control/mouth-smile-tongue-purple.webp",
        3: "icons/magic/control/voodoo-doll-pain-blue.webp",
        4: "icons/magic/control/silhouette-grow-shrink-purple.webp"
      })[spec.tier] ?? "icons/svg/aura.svg";

      if (!DRY_RUN) await Item.create(itemData, { pack: PACK_ID });
      created++;
    } catch (err) {
      console.warn(`[mal-voiced-manifestations] Failed to create '${spec.name}':`, err);
      failed++;
    }
  }

  const msg = `Mal-Voiced Manifestations — created ${created}, skipped ${skipped} existing${failed ? `, failed ${failed}` : ""}. Folder: ${FOLDER_NAME}.`;
  ui.notifications?.info(msg);
  console.log("[bbttcc-master-content/mal-voiced-manifestations]", msg);
})();

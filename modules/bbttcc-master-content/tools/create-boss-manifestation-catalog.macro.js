// Bad Eden — Boss Manifestation Catalog (2026-05-17)
// ─────────────────────────────────────────────────────────────────────────────
// Authors 15 curated boss-flavored manifestations spanning the 5 canonical
// boss template archetypes (3 per archetype). Each manifestation is a
// type:"power" Item with full manifestation schema (damage rolls, save blocks,
// concept, effect, flavor) — cast-able from the boss sheet's Manifest tab via
// ftBossManifestCast.
//
//   qliphothic_auditor — Audit Demand, Cite Precedent, Issue Subpoena
//   megafauna_apex     — Charge, Bellow, Rend
//   courtly_horror     — Honeyed Insult, Veiled Threat, Patron's Disfavor
//   civic_idol         — Sermon, Excommunicate, Rally Faithful
//   feral_godling      — Eruption, Unmake, Devour
//
// All items live in the `bbttcc-master-content.items` compendium under a new
// folder "Boss Manifestations", stamped with:
//   • flags.fourththing.bossManifestation: true
//   • flags.fourththing.bossArchetype: <template-key>
//
// The bossArchetype flag lets the Boss Builder look up by archetype to
// embed the right loadout. The bossManifestation flag lets the Manifestation
// "Add Existing" picker on boss sheets filter out class-power pollution.
//
// Idempotent — re-running skips items that already exist by name unless
// FORCE_CREATE = true. Paste this whole file into a Script Macro and run
// as GM. Requires fourththing system loaded (uses
// game.fourththing.createManifestationItemData to build canonical item data).
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  if (!game.user.isGM) {
    ui.notifications?.error("GM only — this macro authors compendium content.");
    return;
  }

  const PACK_ID      = "bbttcc-master-content.items";
  const FOLDER_NAME  = "Boss Manifestations";
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
    folder = await Folder.create({ name: FOLDER_NAME, type: "Item", color: "#c83e3e" }, { pack: PACK_ID });
  }

  // Index existing items in the pack (idempotency).
  const index = await pack.getIndex();
  const existingByName = new Map(index.map(e => [e.name, e]));

  // ── DAMAGE HELPER ─────────────────────────────────────────────────────────
  // Build a damageRoll object from compact spec fields. Empty/zero number
  // returns the op:"none" blank (for non-damage manifestations).
  const dmg = (number, die, type, track, attribute = "presence", flavor = "") => {
    if (!number || !die) return { op: "none", number: 0, die: "d6", attribute: "", type: "kinetic", flavor: "", track: "integrity" };
    return { op: "damage", number, die, attribute, type, flavor, track };
  };

  // ── MANIFESTATION SPECS ───────────────────────────────────────────────────
  // Each spec carries: archetype (template key), name, tier, intent, channel,
  // sephirah, damageRoll, concept, effect, flavor, tags, optional cost/duration.
  // Defaults fill the rest.
  const MANIFESTATIONS = [
    // ── QLIPHOTHIC AUDITOR ──
    {
      archetype: "qliphothic_auditor",
      name: "Audit Demand",
      tier: 2, intent: "intrigue", channel: "soul", sephirah: "binah",
      damageRoll: dmg(2, "d6", "psychic", "stress", "intrigue"),
      concept: "The ledger lifts a finger. The named one pays the asked-for debt — in clarity, in dignity, or in time.",
      effect: "Target makes a Soul defense (DC 14) or takes 2d6 stress and answers one question truthfully.",
      flavor: "Pages turn. The ink lifts off the paper and lands somewhere it shouldn't.",
      tags: ["audit", "psychic", "social"]
    },
    {
      archetype: "qliphothic_auditor",
      name: "Cite Precedent",
      tier: 2, intent: "intrigue", channel: "mind", sephirah: "hod",
      damageRoll: dmg(0),
      concept: "An older ruling supersedes the one in play. The boss claims its citation and the players' last move is undone.",
      effect: "Cancel one player maneuver from this round. Single use until next phase.",
      flavor: "A page in some other book closes audibly. The room remembers it never opened.",
      tags: ["audit", "cancel", "phase-gated"]
    },
    {
      archetype: "qliphothic_auditor",
      name: "Issue Subpoena",
      tier: 3, intent: "intrigue", channel: "mind", sephirah: "binah",
      damageRoll: dmg(0),
      concept: "A name is written and a person is bound to answer. They cannot act away from the matter at hand.",
      effect: "Target loses access to one OP pool (GM picks) until the next phase change. Soul defense (DC 15) negates.",
      flavor: "Wax seals reseal themselves. The named one stops being able to look elsewhere.",
      tags: ["audit", "op-strip", "phase-gated"]
    },

    // ── MEGAFAUNA APEX ──
    {
      archetype: "megafauna_apex",
      name: "Charge",
      tier: 2, intent: "violence", channel: "body", sephirah: "geburah",
      damageRoll: dmg(3, "d8", "kinetic", "integrity", "violence"),
      concept: "Three tons of bone and weather move in a single line. Things in the way stop being in the way.",
      effect: "Move up to triple speed in a straight line. First target hit takes 3d8 kinetic and is pushed back 1 hex.",
      flavor: "You hear it before you see it. By the time you see it, you should already be moving.",
      tags: ["charge", "kinetic", "push"]
    },
    {
      archetype: "megafauna_apex",
      name: "Bellow",
      tier: 2, intent: "violence", channel: "soul", sephirah: "geburah",
      damageRoll: dmg(2, "d6", "sonic", "stress", "violence"),
      concept: "It roars. The roar is older than language. Hearing it is its own injury.",
      effect: "All targets within Near range make a Soul defense (DC 13) or take 2d6 stress and lose their next bonus action.",
      flavor: "Birds leave the trees three counties away.",
      tags: ["aoe", "morale", "sonic"]
    },
    {
      archetype: "megafauna_apex",
      name: "Rend",
      tier: 3, intent: "violence", channel: "body", sephirah: "geburah",
      damageRoll: dmg(4, "d10", "kinetic", "integrity", "violence"),
      concept: "Apex strikes once, with everything. Bone leverage and ancient anger.",
      effect: "Single target makes a Body defense (DC 15) or takes 4d10 kinetic. On a hit, target is staggered (no reactions until end of round).",
      flavor: "Whatever it was, it isn't anymore.",
      tags: ["single-target", "kinetic", "stagger"]
    },

    // ── COURTLY HORROR ──
    {
      archetype: "courtly_horror",
      name: "Honeyed Insult",
      tier: 2, intent: "intrigue", channel: "mind", sephirah: "tiferet",
      damageRoll: dmg(2, "d6", "psychic", "stress", "intrigue"),
      concept: "A compliment with a hook in it. The target feels seen and that is the wound.",
      effect: "Target makes a Mind defense (DC 14) or takes 2d6 stress and has disadvantage on their next social action.",
      flavor: "Everyone laughs. Almost everyone laughs.",
      tags: ["social", "insult", "stress"]
    },
    {
      archetype: "courtly_horror",
      name: "Veiled Threat",
      tier: 3, intent: "intrigue", channel: "soul", sephirah: "geburah",
      damageRoll: dmg(0),
      concept: "A perfectly polite sentence with a wire underneath it. The target understands what was promised.",
      effect: "Target loses 1 Morale and gains a Compromised condition until end of scene. Soul defense (DC 15) negates the condition.",
      flavor: "Your tea is exactly the right temperature. Yours is not.",
      tags: ["social", "morale", "condition"]
    },
    {
      archetype: "courtly_horror",
      name: "Patron's Disfavor",
      tier: 3, intent: "intrigue", channel: "mind", sephirah: "hod",
      damageRoll: dmg(0),
      concept: "The Court remembers a favor not given. A name is struck from a list.",
      effect: "Strip one of the target's faction tags or allegiance bonds for the remainder of the scene. Mind defense (DC 15) negates.",
      flavor: "Three letters arrive simultaneously. None of them apologize.",
      tags: ["social", "tag-strip", "scene"]
    },

    // ── CIVIC IDOL ──
    {
      archetype: "civic_idol",
      name: "Sermon",
      tier: 2, intent: "presence", channel: "soul", sephirah: "chesed",
      damageRoll: dmg(2, "d6", "radiant", "stress", "presence"),
      concept: "The idol speaks. Words land in the chest like coins in a fountain.",
      effect: "All targets within Far range make a Soul defense (DC 14) or take 2d6 stress. Faithful targets are exempt.",
      flavor: "You agree before you hear what was said.",
      tags: ["aoe", "morale", "narrative"]
    },
    {
      archetype: "civic_idol",
      name: "Excommunicate",
      tier: 3, intent: "presence", channel: "soul", sephirah: "binah",
      damageRoll: dmg(0),
      concept: "The idol points. A single target is removed from the story it thought it was in.",
      effect: "Target loses access to one faction OP track until end of scene (GM picks). Soul defense (DC 15) negates.",
      flavor: "They are still standing here. Nobody sees them anymore.",
      tags: ["social", "narrative", "single-target", "op-strip"]
    },
    {
      archetype: "civic_idol",
      name: "Rally Faithful",
      tier: 2, intent: "presence", channel: "soul", sephirah: "chesed",
      damageRoll: dmg(0),
      concept: "The idol calls upon the faithful. Wounds close where prayer reaches.",
      effect: "All allies within Far range heal 2d6 integrity. The idol gains 1 Surge.",
      flavor: "Bandages tighten themselves. Somebody starts humming.",
      tags: ["aoe", "heal", "ally"]
    },

    // ── FERAL GODLING ──
    {
      archetype: "feral_godling",
      name: "Eruption",
      tier: 3, intent: "violence", channel: "body", sephirah: "geburah",
      damageRoll: dmg(4, "d8", "kinetic", "integrity", "violence"),
      concept: "Reality breaks for a moment around the godling. Things nearby experience the break as damage.",
      effect: "Burst centered on the boss. All targets within Near make a Body defense (DC 15) or take 4d8 kinetic.",
      flavor: "The ground forgets what shape it was. Then remembers a worse one.",
      tags: ["aoe", "burst", "kinetic"]
    },
    {
      archetype: "feral_godling",
      name: "Unmake",
      tier: 4, intent: "violence", channel: "soul", sephirah: "binah",
      damageRoll: dmg(3, "d10", "qliphothic", "integrity", "violence"),
      concept: "The godling decides a thing was never there. Most things resist this. Some do not.",
      effect: "Target makes a Soul defense (DC 16) or takes 3d10 qliphothic damage and gains Unmaking 1 (recurring damage at start of each round until cleared).",
      flavor: "You think you were here. You cannot say why you thought that.",
      tags: ["single-target", "qliphothic", "high-tier", "dot"]
    },
    {
      archetype: "feral_godling",
      name: "Devour",
      tier: 3, intent: "violence", channel: "body", sephirah: "geburah",
      damageRoll: dmg(3, "d8", "kinetic", "integrity", "violence"),
      concept: "The godling takes what it kills. The wound becomes its strength.",
      effect: "Single target makes a Body defense (DC 15) or takes 3d8 kinetic. The boss heals integrity equal to half the damage dealt.",
      flavor: "Quiet for a moment. Then a sound like swallowing something larger than a throat should hold.",
      tags: ["single-target", "kinetic", "heal-self"]
    }
  ];

  // ── BUILD + STAMP ─────────────────────────────────────────────────────────
  // Per-spec: build canonical item data via system helper, stamp boss flags,
  // assign folder, Item.create into the pack.
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
        stability: spec.stability ?? "sustained",
        form: "working",
        function: spec.function ?? (spec.damageRoll?.op === "damage" ? "harm" : "press"),
        interactionModel: "directed",
        damageRoll: spec.damageRoll,
        concept: spec.concept,
        effect: spec.effect,
        flavor: spec.flavor,
        tags: [...(spec.tags ?? []), `archetype:${spec.archetype}`],
        costType: "clarity",
        costValue: Math.max(1, Math.floor(spec.tier / 2) || 1),
        duration: spec.duration ?? "scene",
        scale: spec.scale ?? "scene",
        activation_block: { type: "action", consumePool: true }
      };
      const itemData = builder(null, "power", values);

      // Stamp boss flags so the picker can filter + the builder can look up
      // by archetype. Preserves any flags the builder added (none currently).
      itemData.flags = itemData.flags ?? {};
      itemData.flags.fourththing = itemData.flags.fourththing ?? {};
      itemData.flags.fourththing.bossManifestation = true;
      itemData.flags.fourththing.bossArchetype = spec.archetype;

      // Folder assignment + tier-appropriate icon.
      if (folder?.id) itemData.folder = folder.id;
      itemData.img = ({
        qliphothic_auditor: "icons/magic/symbols/runes-etched-steel-orange.webp",
        megafauna_apex:     "icons/creatures/abilities/lion-roar.webp",
        courtly_horror:     "icons/magic/control/voodoo-doll-pain-blue.webp",
        civic_idol:         "icons/magic/holy/yin-yang-balance-symbol.webp",
        feral_godling:      "icons/creatures/abilities/dragon-breath-purple.webp"
      })[spec.archetype] ?? "icons/svg/aura.svg";

      if (!DRY_RUN) await Item.create(itemData, { pack: PACK_ID });
      created++;
    } catch (err) {
      console.warn(`[boss-manifestation-catalog] Failed to create '${spec.name}':`, err);
      failed++;
    }
  }

  const msg = `Boss Manifestation Catalog — created ${created}, skipped ${skipped} existing${failed ? `, failed ${failed}` : ""}. Folder: ${FOLDER_NAME}.`;
  ui.notifications?.info(msg);
  console.log("[bbttcc-master-content/boss-manifestation-catalog]", msg);
})();

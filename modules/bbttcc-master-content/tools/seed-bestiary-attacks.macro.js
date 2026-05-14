// BBTTCC — Seed Bestiary Attacks & Abilities (2026-05-12)
// ─────────────────────────────────────────────────────────────────────────────
// Authors offensive items, passive traits, and special abilities for the 29
// B-cruft-empty NPCs left itemless after the 2026-05-12 unified-schema
// refactor. Closes the ⚠ no-offensive-items flag the refactor macro reported.
//
// IMPORTANT (2026-05-12 v2): The fourththing NPC sheet ONLY renders Strike
// buttons for items of `type: "weapon"`. feat-type items (and dnd5e-style
// activities embedded in feats) are routed to FourthThingFeatureSheet which
// is description-only. So:
//
//   • Attack items   → type: "weapon"  (renders Strike button; engage dialog
//                                       handles attack-vs-defense roll)
//   • Save/AoE items → type: "weapon"  (Strike button still renders; GM
//                                       picks the relevant target defense
//                                       — Resolve for "Wis", Evasion for
//                                       "Dex", Guard for "Con" — to model
//                                       the save. Damage rolls in engage
//                                       dialog. Description spells out the
//                                       save mechanic.)
//   • Passive traits → type: "feat"     (description-only by design)
//   • Principles     → type: "feature"  (description-only by design)
//
// Damage convention (matches Shambler's Rot-Branch): bare dice formula in
// system.damage.formula ("1d6", "2d8") — system.damage.attribute auto-adds
// the listed faculty at roll time via the engage dialog. RFI 7-damage canon
// in system.damage.type (kinetic / energy / sephirotic / qliphothic /
// psychic / poison / radiation). Free-text in system.damage.damageFlavor
// for narrative tone (blade / cinder / bone-rot / etc.).
//
// Knobs:
//   DRY_RUN              — true: log payloads, no writes
//   SKIP_EXISTING_ITEMS  — true: skip items already on actor by name (idempotent)
//   FORCE_REPLACE        — true: delete matching-name items, re-create from spec
//
// Phase status:
//   Phase A (this drop): scaffold + 4 sample NPCs across tiers for sign-off
//     – Ash Wolf            (T1 light brute, wildlife)
//     – Bone Patriarch      (T2 medium caster, necromancer)
//     – Tree-of-Life Custodian (T3 heavy caster, sacred guardian)
//     – Pre-Fall Apex Construct (T4 heavy hardened, legendary construct)
//   Phase B (next drop):  remaining 25 archetypes added to ROSTER below
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  // ── Knobs ────────────────────────────────────────────────────────────────
  const opts = await foundry.applications.api.DialogV2.wait({
    window: { title: "Seed Bestiary Attacks & Abilities" },
    content: `
      <div style="display:flex;flex-direction:column;gap:.5rem;font-size:.9em;">
        <p><strong>Authors innate attacks + traits on itemless bestiary NPCs.</strong></p>
        <p style="opacity:.8;">Targets each ROSTER entry by archetype slug or fallback name. Skips actors not in the world.</p>
        <label><input type="checkbox" name="dry" checked/> <strong>Dry run</strong> (preview chat card + console, no writes)</label>
        <label><input type="checkbox" name="skip" checked/> Skip items already present on actor (by name)</label>
        <label><input type="checkbox" name="force"/> Force-replace: delete existing matching-name items, re-create from spec</label>
      </div>`,
    buttons: [
      {
        action: "run", label: "Run", icon: "fas fa-cog", default: true,
        callback: (event, button, dialog) => ({
          DRY_RUN:              !!dialog.element.querySelector('[name="dry"]')?.checked,
          SKIP_EXISTING_ITEMS:  !!dialog.element.querySelector('[name="skip"]')?.checked,
          FORCE_REPLACE:        !!dialog.element.querySelector('[name="force"]')?.checked
        })
      },
      { action: "cancel", label: "Cancel", icon: "fas fa-times" }
    ],
    rejectClose: false
  });
  if (!opts || opts === "cancel") return;
  const { DRY_RUN, SKIP_EXISTING_ITEMS, FORCE_REPLACE } = opts;

  // ── Mechanical scaffolding tables ────────────────────────────────────────
  const TIER_INT = { I: 1, II: 2, III: 3, IV: 4 };

  // Damage formula by tier × bracket (bare dice — attribute auto-adds at roll)
  const DMG = {
    light:  { I: "1d6",  II: "1d8",  III: "2d6",  IV: "2d8"  },
    medium: { I: "1d8",  II: "1d10", III: "2d8",  IV: "2d10" },
    heavy:  { I: "1d10", II: "2d6",  III: "2d10", IV: "2d12" }
  };

  // Save DC label (purely cosmetic — engage dialog handles the actual roll
  // via 2d10x10 + intent + skill vs target defense; this just renders in
  // the description text so the GM knows the intended threat level).
  const BRACKET_MOD = { light: 0, medium: 1, heavy: 2 };

  // RFI 7-damage canon. Used directly in system.damage.type — no translation.
  // Set: kinetic / energy / sephirotic / qliphothic / psychic / poison / radiation
  function rfiType(canon) {
    const valid = ["kinetic", "energy", "sephirotic", "qliphothic", "psychic", "poison", "radiation"];
    return valid.includes(canon) ? canon : "kinetic";
  }

  // Default attribute (faculty) per role — used for system.damage.attribute
  // so the engage dialog auto-adds the right bonus.
  const ROLE_ATTRIBUTE = {
    brute:    "violence",
    stealth:  "violence",
    scout:    "violence",
    hardened: "violence",
    caster:   "soul"
  };

  // Default skill per role — feeds the engage dialog's skill-bonus addition.
  const ROLE_SKILL = {
    brute:    "melee",
    stealth:  "melee",
    scout:    "firearms",
    hardened: "melee",
    caster:   "channel"
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  function damageFormula(spec, override) {
    if (override) return override;
    return DMG[spec.bracket][spec.tier];
  }
  function saveDC(spec, override) {
    if (Number.isFinite(override)) return override;
    return 10 + TIER_INT[spec.tier] + (spec.role === "caster" ? 1 : 0);
  }

  // Build a weapon-type item with fourththing-native damage schema. Renders
  // on the NPC sheet's Strikes section with a Strike button. ftOpenEngageDialog
  // handles the attack roll (2d10x10 + intent + skill vs target defense).
  // Mirrors Shambler's Rot-Branch shape.
  function makeAttackItem(spec, atk) {
    const formula = damageFormula(spec, atk.damageOverride);
    const dType   = rfiType(atk.damageType);
    const isMelee = !!atk.melee;
    const intent  = atk.intent ?? "violence";
    const skill   = atk.skill ?? (isMelee ? "melee" : (spec.role === "scout" ? "firearms" : "ranged"));
    const attr    = atk.attribute ?? ROLE_ATTRIBUTE[spec.role] ?? "violence";
    const flavor  = atk.damageFlavor ?? "";
    const range   = isMelee
      ? { short: Math.max(1, Math.round((atk.reach ?? 5) / 5)), long: Math.max(1, Math.round((atk.reach ?? 5) / 5)) }
      : { short: Math.max(1, Math.round((atk.shortRange ?? 60) / 5)), long: Math.max(1, Math.round((atk.longRange ?? 180) / 5)) };
    const FT_DEF_HINT = {
      con:  "Resolve (Body/Constitution-flavored saves)",
      dex:  "Evasion (Dexterity-flavored saves)",
      wis:  "Resolve (Wisdom-flavored saves)",
      str:  "Guard (Strength-flavored saves)",
      int:  "Resolve (Mind/Intelligence-flavored saves)",
      cha:  "Resolve (Presence/Charisma-flavored saves)"
    };
    const reachLabel = isMelee
      ? `reach ${atk.reach ?? 5} ft.`
      : `range ${atk.shortRange ?? 60}/${atk.longRange ?? 180} ft.`;
    return {
      name: atk.name,
      type: "weapon",
      img:  atk.img ?? "icons/svg/sword.svg",
      system: {
        category: isMelee ? "melee" : "ranged",
        intent,
        skill,
        damage: {
          formula,
          attribute: attr,
          type: dType,
          damageFlavor: flavor,
          track: dType === "psychic" || dType === "qliphothic" ? "stress" : "integrity"
        },
        range,
        tags: ["seed-bestiary-attacks", `tier-${spec.tier.toLowerCase()}`, `role-${spec.role}`],
        effect: atk.riderText ?? "",
        flavor: atk.flavor ?? "",
        description: {
          value: `<p><strong>Strike.</strong> ${reachLabel}, one target. Damage: <code>${formula}</code> ${dType}${flavor ? ` (${flavor})` : ""} + ${attr}.${atk.riderText ? " " + atk.riderText : ""}</p>${atk.flavor ? `<p><em>${atk.flavor}</em></p>` : ""}`,
          chat: ""
        }
      },
      effects: [],
      flags: { fourththing: { rfi: { item: { tier: spec.tier, frame: "attack" } } } },
      folder: null,
      sort: 0,
      ownership: { default: 0 }
    };
  }

  // Build a weapon-type item flagged as save-based AoE. Strike button still
  // renders; engage dialog lets the GM pick the appropriate target defense
  // (Resolve / Evasion / Guard) to model the save. Description spells out
  // the intended save mechanic, recharge, and rider effects.
  function makeSaveItem(spec, save) {
    const formula = damageFormula(spec, save.damageOverride);
    const dType   = rfiType(save.damageType);
    const dc      = saveDC(spec, save.dcOverride);
    const attr    = save.attribute ?? ROLE_ATTRIBUTE[spec.role] ?? "soul";
    const skill   = save.skill ?? ROLE_SKILL[spec.role] ?? "channel";
    const intent  = save.intent ?? "presence";
    const flavor  = save.damageFlavor ?? "";
    const shape   = save.template?.shape ?? "radius";
    const size    = save.template?.size ?? 10;
    const SAVE_TO_DEFENSE = {
      con: "Resolve",
      dex: "Evasion",
      wis: "Resolve",
      str: "Guard",
      int: "Resolve",
      cha: "Resolve",
      body: "Resolve",
      presence: "Resolve",
      mind: "Resolve",
      soul: "Resolve",
      violence: "Guard",
      intrigue: "Evasion"
    };
    const targetDefense = SAVE_TO_DEFENSE[save.saveAbility] ?? "Resolve";
    const rechargeSuffix = save.recharge ? ` (Recharge ${save.recharge})` : (save.usesPerDay ? ` (${save.usesPerDay}/Day)` : "");
    const range = { short: Math.max(1, Math.round(size / 5)), long: Math.max(1, Math.round(size / 5)) };
    return {
      name: save.name + rechargeSuffix,
      type: "weapon",
      img:  save.img ?? "icons/svg/explosion.svg",
      system: {
        category: "ranged",
        intent,
        skill,
        damage: {
          formula,
          attribute: attr,
          type: dType,
          damageFlavor: flavor,
          track: dType === "psychic" || dType === "qliphothic" ? "stress" : "integrity"
        },
        range,
        tags: ["seed-bestiary-attacks", `tier-${spec.tier.toLowerCase()}`, `role-${spec.role}`, "aoe", `shape-${shape}`],
        effect: `${shape.charAt(0).toUpperCase() + shape.slice(1)} ${size} ft. — targets roll vs ${targetDefense} (DC ${dc}). Half damage on success.${save.riderText ? " " + save.riderText : ""}${save.recharge ? ` Recharge ${save.recharge}.` : (save.usesPerDay ? ` ${save.usesPerDay}/Day.` : "")}`,
        flavor: save.flavor ?? "",
        description: {
          value: `<p><strong>Area Attack.</strong> ${save.targetText ?? `Each creature in a ${size}-ft. ${shape}`} rolls <strong>${targetDefense}</strong> vs DC ${dc}. Hit: <code>${formula}</code> ${dType}${flavor ? ` (${flavor})` : ""} + ${attr}; half on success.${save.riderText ? " " + save.riderText : ""}${save.recharge ? `<br/><em>Recharge ${save.recharge}.</em>` : (save.usesPerDay ? `<br/><em>${save.usesPerDay} per day.</em>` : "")}</p>${save.flavor ? `<p><em>${save.flavor}</em></p>` : ""}`,
          chat: ""
        }
      },
      effects: [],
      flags: { fourththing: { rfi: { item: { tier: spec.tier, frame: "save", aoeShape: shape, aoeSize: size, dcAbility: save.saveAbility, dc } } } },
      folder: null,
      sort: 0,
      ownership: { default: 0 }
    };
  }

  // Build a passive feat (no activities — mirrors Apex Predator's Territorial
  // / Razor Raider's Overkill / Road Bandit's Poor Discipline shape)
  function makeTraitItem(spec, trait) {
    return {
      name: trait.name,
      type: "feat",
      img:  trait.img ?? "icons/svg/upgrade.svg",
      system: {
        category: "technique",
        source: { revision: 1, rules: "2024" },
        tags: ["seed-bestiary-attacks", `tier-${spec.tier.toLowerCase()}`, `role-${spec.role}`, "passive"],
        description: { value: `<p>${trait.desc}</p>${trait.flavor ? `<p><em>${trait.flavor}</em></p>` : ""}`, chat: "" },
        activities: {},
        uses: { spent: 0, recovery: [] },
        advancement: {},
        identifier: "",
        crewed: false,
        enchant: {},
        prerequisites: { items: [], repeatable: false },
        properties: [],
        requirements: "",
        type: { value: "", subtype: "" }
      },
      effects: [],
      flags: { fourththing: { rfi: { item: { tier: spec.tier, frame: "trait" } } } },
      folder: null,
      sort: 0,
      ownership: { default: 0 }
    };
  }

  // Build a feature item (passive principle — mirrors Shambler's Wrong-Wave)
  function makeFeatureItem(spec, feat) {
    return {
      name: feat.name,
      type: "feature",
      img:  feat.img ?? "icons/magic/symbols/symbol-runes-purple.webp",
      system: {
        category: "principle",
        source: "",
        tags: ["seed-bestiary-attacks", `tier-${spec.tier.toLowerCase()}`, `role-${spec.role}`],
        description: { value: `<p><strong>Passive.</strong> ${feat.desc}</p>${feat.flavor ? `<p><em>${feat.flavor}</em></p>` : ""}`, chat: "" }
      },
      effects: [],
      flags: { fourththing: { rfi: { item: { tier: spec.tier, frame: "feature" } } } },
      folder: null,
      sort: 0,
      ownership: { default: 0 }
    };
  }

  // Build items from a kit spec (kit.items[] entries are { kind, ...payload })
  function buildItemsForKit(kit) {
    const spec = { tier: kit.tier, bracket: kit.bracket, role: kit.role };
    const built = [];
    for (const entry of kit.items) {
      if (entry.kind === "trait")    built.push(makeTraitItem(spec,   entry));
      else if (entry.kind === "attack") built.push(makeAttackItem(spec, entry));
      else if (entry.kind === "save")   built.push(makeSaveItem(spec,   entry));
      else if (entry.kind === "feature") built.push(makeFeatureItem(spec, entry));
    }
    return built;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //   ROSTER  (Phase A: 4 representative NPCs across tiers)
  // ─────────────────────────────────────────────────────────────────────────
  const ROSTER = [
    // ── T1 light brute · wildlife · pack hunter ─────────────────────────────
    {
      archetype: "ash-wolf",
      name: "Ash Wolf",
      tier: "I", bracket: "light", role: "brute",
      items: [
        { kind: "trait",
          name: "Pack Tactics",
          desc: "The ash wolf has reroll the lowest die on attack rolls against any creature within 5 ft. of an ally that isn't incapacitated.",
          flavor: "They circle. They cut you off. Then they bite." },
        { kind: "attack",
          name: "Smoldering Bite",
          melee: true, reach: 5,
          damageType: "kinetic", damageFlavor: "bite",
          riderText: "On a hit, the target's clothing or fur catches a slow burn — 1 energy damage at the start of its next turn unless it spends an action to put it out.",
          flavor: "The coat smokes when angered. The bite carries the heat." },
        { kind: "save",
          name: "Burn-Zone Lunge",
          recharge: "5–6",
          saveAbility: "dex",
          damageType: "energy", damageFlavor: "cinder",
          template: { shape: "line", size: 15 },
          targetText: "Each creature in a 15-ft. line the wolf moves through",
          riderText: "Wolf can move up to its speed in a straight line as part of this action; it doesn't provoke opportunity attacks from the line.",
          flavor: "It runs along the burn and lets the burn run along it." }
      ]
    },

    // ── T2 medium caster · necromancer / elder ──────────────────────────────
    {
      archetype: "bone-patriarch",
      name: "Bone Patriarch",
      tier: "II", bracket: "medium", role: "caster",
      items: [
        { kind: "trait",
          name: "Ancestor Whispers",
          desc: "When the patriarch fails a save against being charmed, compelled, or shaken, they may instead succeed by spending one finger-bone token (start of scene: 3 tokens).",
          flavor: "Every finger of every grandfather has an opinion. He listens to all of them." },
        { kind: "attack",
          name: "Marrow-Lash",
          melee: true, reach: 10,
          damageType: "qliphothic", damageFlavor: "bone-rot",
          riderText: "On a hit, the target's Stress track increases by 1d4 (no save).",
          flavor: "A finger-bone, on a tendon, on a will. It does not need to be near you to find you." },
        { kind: "save",
          name: "Choir of Knuckles",
          saveAbility: "wis",
          damageType: "psychic", damageFlavor: "scolding-chorus",
          template: { shape: "radius", size: 20 },
          targetText: "Each creature within 20 ft. that can hear the patriarch",
          riderText: "Failed-save targets are also Shaken until the start of their next turn.",
          flavor: "The bones don't speak. They argue." }
      ]
    },

    // ── T3 heavy caster · sacred guardian ──────────────────────────────────
    {
      archetype: "tree-of-life-custodian",
      name: "Tree-of-Life Custodian",
      tier: "III", bracket: "heavy", role: "caster",
      items: [
        { kind: "trait",
          name: "Sees Every Intent",
          desc: "The custodian cannot be surprised. Creatures within 30 ft. that begin a hostile action have reroll-the-highest on the triggering roll (the custodian knows it is coming).",
          flavor: "It is not that they hear you. It is that you have already arrived." },
        { kind: "attack",
          name: "Branch of Judgement",
          melee: true, reach: 10,
          damageType: "sephirotic", damageFlavor: "shrine-light",
          riderText: "If the target has acted in violence within the last minute, the damage die explodes once on a hit (re-roll a max die, add result).",
          flavor: "It strikes once. The strike was decided weeks ago." },
        { kind: "save",
          name: "Verdict-of-Light",
          recharge: "5–6",
          saveAbility: "cha",
          damageType: "sephirotic", damageFlavor: "verdict",
          template: { shape: "cone", size: 30 },
          targetText: "Each creature in a 30-ft. cone",
          riderText: "Failed-save targets are Blinded until the start of their next turn (their own light is taken).",
          flavor: "The shrine asks: by what right? Answer wrongly and it answers for you." },
        { kind: "feature",
          name: "Bound to the Shard",
          desc: "While the Tree-of-Life Shard the custodian carries is intact, the custodian regains 10 Integrity at the start of its turn. If reduced to 0, the shard cracks; on its next turn the custodian rises with full Integrity once per scene. Destroy the shard (AC 18, 30 HP, sephirotic damage only) to end this.",
          flavor: "The custodian is the shard's hand. While the shard remembers, the hand cannot rest." }
      ]
    },

    // ── T4 heavy hardened · legendary construct ────────────────────────────
    {
      archetype: "pre-fall-apex-construct",
      name: "Pre-Fall Apex Construct",
      tier: "IV", bracket: "heavy", role: "hardened",
      items: [
        { kind: "trait",
          name: "Pre-Fall Diagnostics",
          desc: "Once per round, when the construct would be hit by an attack, it may impose reroll-the-highest on the attack roll instead. (Targeting solution recalibrates faster than the shooter.)",
          flavor: "It does not flinch. It updates." },
        { kind: "attack",
          name: "Sundering Hammer-Limb",
          melee: true, reach: 10,
          damageType: "kinetic", damageFlavor: "hammer-blow",
          riderText: "On a hit, the target must succeed on a DC 16 Body save or be knocked prone and pushed 10 ft. away.",
          flavor: "The arm articulates wrong. The impact arrives at three places at once." },
        { kind: "attack",
          name: "Pre-Fall Lance Battery",
          melee: false, shortRange: 120, longRange: 480,
          damageType: "energy", damageFlavor: "lance-arc",
          riderText: "Ignores cover that is less than 1 ft. of solid alloy (it sees through and shoots through).",
          flavor: "A single still-charged capacitor lets go. The line briefly tastes of ozone and a forgotten language." },
        { kind: "save",
          name: "Containment Pulse",
          recharge: "5–6",
          saveAbility: "con",
          damageType: "energy", damageFlavor: "thunder-pulse",
          template: { shape: "radius", size: 30 },
          targetText: "Each creature within 30 ft.",
          riderText: "Failed-save targets are also Stunned until the end of the construct's next turn (containment protocol identifies them as non-cleared personnel).",
          flavor: "The shell flexes outward once. Something institutional and patient does the deciding." },
        { kind: "feature",
          name: "Pre-Fall Frame",
          desc: "The construct is immune to fatigue, poison, and disease, has resistance to non-magical kinetic damage, and is critically vulnerable to focused sephirotic attacks (sephirotic damage rolls double dice against it).",
          flavor: "It was built before the Fall. The Fall has not yet caught up to it." }
      ]
    },

    // ─────────────────────────────────────────────────────────────────────
    //   PHASE B — remaining 25 archetypes
    // ─────────────────────────────────────────────────────────────────────

    // ── T1 light brute · insect swarm · fire-vulnerable ────────────────────
    {
      archetype: "bog-skitter",
      name: "Bog-Skitter Swarm",
      tier: "I", bracket: "light", role: "brute",
      items: [
        { kind: "trait",
          name: "Swarm",
          desc: "The swarm occupies the same space as another creature and can move through any opening at least 1 inch wide. While it has more than half its Integrity, attacks against it have reroll-the-highest.",
          flavor: "Not one thing. Many things that have agreed on a direction." },
        { kind: "attack",
          name: "Boiling Bites",
          melee: true, reach: 0,
          damageType: "poison", damageFlavor: "venom",
          riderText: "Auto-hits any creature sharing the swarm's space. On a hit, target must succeed a DC 12 Body save or have reroll-the-highest on its next action (venom haze).",
          flavor: "There is no first bite. There is only the realization of biting." },
        { kind: "save",
          name: "Mire-Disperse",
          saveAbility: "dex",
          damageType: "poison", damageFlavor: "stinging-mist",
          template: { shape: "radius", size: 10 },
          targetText: "Each creature within 10 ft. when the swarm is bloodied (half Integrity or lower)",
          riderText: "Triggers automatically the first time the swarm drops below half Integrity — the swarm scatters wide before re-coalescing.",
          flavor: "Wound it and it just becomes a wider problem." }
      ]
    },

    // ── T1 light stealth · scrap-clad survivor ─────────────────────────────
    {
      archetype: "dust-scavenger",
      name: "Dust Scavenger",
      tier: "I", bracket: "light", role: "stealth",
      items: [
        { kind: "trait",
          name: "Pocket Full of Knives",
          desc: "The scavenger always has at least one improvised weapon. After making an attack, on a roll of 1 on the damage die, the weapon breaks — narratively replaced next round at no action cost.",
          flavor: "Whatever they pulled from the last body. Whatever the next one drops." },
        { kind: "attack",
          name: "Rusty Shank",
          melee: true, reach: 5,
          damageType: "kinetic", damageFlavor: "rusted-edge",
          riderText: "On a hit, the target must succeed a DC 11 Body save or contract a low-grade infection — −1 to all rolls until they get a full Soma Break.",
          flavor: "It wasn't sharp. It was sharp enough." },
        { kind: "attack",
          name: "Scrap-Throw",
          melee: false, shortRange: 20, longRange: 60,
          damageType: "kinetic", damageFlavor: "thrown-debris",
          riderText: "The scavenger may use this attack as a bonus action immediately after taking the Disengage action.",
          flavor: "Bricks. Bolts. Bottles. The half-empty kind." }
      ]
    },

    // ── T1 light brute · feral hex-corrupted dog ───────────────────────────
    {
      archetype: "hex-stray",
      name: "Hex-Touched Stray",
      tier: "I", bracket: "light", role: "brute",
      items: [
        { kind: "trait",
          name: "Hex-Itch",
          desc: "When a creature within 5 ft. of the stray drops to 0 Integrity, the stray gains 5 temporary Integrity and reroll-the-lowest on its next attack roll.",
          flavor: "Something underneath the dog enjoys this. The dog isn't sure why." },
        { kind: "attack",
          name: "Yellowing Bite",
          melee: true, reach: 5,
          damageType: "qliphothic", damageFlavor: "hex-pus",
          riderText: "On a hit, the target's wound briefly smells of old fear — they have reroll-the-highest on their next Resolve check.",
          flavor: "The teeth are fine. It's what comes off the teeth that lingers." },
        { kind: "save",
          name: "Howl-of-the-Hex",
          recharge: "6",
          saveAbility: "wis",
          damageType: "psychic", damageFlavor: "wrong-howl",
          template: { shape: "radius", size: 15 },
          targetText: "Each creature within 15 ft. that can hear the stray",
          riderText: "Failed-save targets are Shaken until the start of their next turn.",
          flavor: "The howl carries a syllable it shouldn't know. Everyone within hearing remembers something they didn't live through." }
      ]
    },

    // ── T1 light scout · still-functioning pre-fall servitor ───────────────
    {
      archetype: "pre-fall-drone",
      name: "Pre-Fall Drone",
      tier: "I", bracket: "light", role: "scout",
      items: [
        { kind: "trait",
          name: "Broken Protocol Loop",
          desc: "The drone repeats a single behavior unless directly attacked (patrol, scan, harvest). When attacked, it switches to combat mode for 3 rounds, then returns to its loop. Charm / compel effects automatically fail.",
          flavor: "It is doing what it was told to do. What it was told to do is no longer there." },
        { kind: "attack",
          name: "Targeting Laser",
          melee: false, shortRange: 60, longRange: 240,
          damageType: "energy", damageFlavor: "coherent-light",
          riderText: "On a hit, the drone marks the target — the next attack against that target by any source has reroll-the-lowest.",
          flavor: "A red dot, a brief warmth, and a small institutional whir." },
        { kind: "attack",
          name: "Diagnostic Probe",
          melee: true, reach: 5,
          damageType: "kinetic", damageFlavor: "probing-needle",
          riderText: "Reveals one of the target's resistances or vulnerabilities to the drone's allies (GM choice).",
          flavor: "It is not trying to hurt you. It is trying to file you." }
      ]
    },

    // ── T1 light stealth · amphibian ambusher ──────────────────────────────
    {
      archetype: "reed-skin-stalker",
      name: "Reed-Skin Stalker",
      tier: "I", bracket: "light", role: "stealth",
      items: [
        { kind: "trait",
          name: "Camouflaged",
          desc: "While in still water or reed-thick terrain, the stalker is effectively invisible until it acts. First attack each combat has reroll-the-lowest if launched from concealment.",
          flavor: "You were going to walk right past it. It was going to let you." },
        { kind: "attack",
          name: "Drag-Tongue",
          melee: true, reach: 15,
          damageType: "kinetic", damageFlavor: "snare-tongue",
          riderText: "On a hit, the target is pulled up to 10 ft. toward the stalker; if it ends adjacent, the target is also Restrained (escape DC 12 Body) until end of stalker's next turn.",
          flavor: "Not the tongue you were expecting." },
        { kind: "save",
          name: "Reed-Vanish",
          recharge: "5–6",
          saveAbility: "wis",
          damageType: "kinetic", damageFlavor: "splash-vanish",
          template: { shape: "radius", size: 10 },
          targetText: "Each creature within 10 ft.",
          riderText: "On a failed save, target loses sight of the stalker until the start of its next turn. Stalker may move up to its speed and re-conceal.",
          flavor: "There is a splash. There is no stalker. There was, a moment ago." }
      ]
    },

    // ── T1 light caster · battlefield revenant ─────────────────────────────
    {
      archetype: "salt-wraith",
      name: "Salt Wraith",
      tier: "I", bracket: "light", role: "caster",
      items: [
        { kind: "trait",
          name: "Crystallized Grief",
          desc: "The wraith has resistance to kinetic damage and vulnerability to sephirotic damage. Cannot be Charmed or Shaken (it is already nothing but those things).",
          flavor: "Salt remembers what salt is for. The wraith remembers the screaming." },
        { kind: "attack",
          name: "Drain-Touch",
          melee: true, reach: 5,
          damageType: "qliphothic", damageFlavor: "warmth-theft",
          riderText: "On a hit, the target's Stress increases by 1d4 and the wraith regains that much Integrity. The target feels cold for an hour.",
          flavor: "It does not hate you. It just needs what you have." },
        { kind: "save",
          name: "Salt-Sermon",
          saveAbility: "cha",
          damageType: "psychic", damageFlavor: "lament",
          template: { shape: "radius", size: 15 },
          targetText: "Each creature within 15 ft.",
          riderText: "Failed-save targets remember a death that wasn't theirs — Shaken until the start of their next turn.",
          flavor: "The wraith does not speak. The salt speaks for it." }
      ]
    },

    // ── T1 light caster · oath-broken drifter ──────────────────────────────
    {
      archetype: "septless-wanderer",
      name: "Septless Wanderer",
      tier: "I", bracket: "light", role: "caster",
      items: [
        { kind: "trait",
          name: "Broken Pact",
          desc: "When the wanderer takes psychic or qliphothic damage, they may immediately make one Mumbled Prayer attack as a reaction (no action cost). 1/round.",
          flavor: "The oath broke years ago. The reflexes did not get the memo." },
        { kind: "attack",
          name: "Mumbled Prayer",
          melee: false, shortRange: 30, longRange: 90,
          damageType: "qliphothic", damageFlavor: "broken-syllable",
          riderText: "On a hit, the wanderer's Clarity refreshes by 1 (the broken prayer briefly works for the wrong reason).",
          flavor: "Whatever god they're addressing has stopped listening. Other things have not." },
        { kind: "attack",
          name: "Reflex Lash",
          melee: true, reach: 5,
          damageType: "kinetic", damageFlavor: "wild-strike",
          riderText: "No targeting required; the wanderer just swings. On a 1 on the damage die, also hits the nearest ally (if any).",
          flavor: "Half-blind, half-elsewhere. The arm still works." }
      ]
    },

    // ── T2 medium scout · apex aerial predator ─────────────────────────────
    {
      archetype: "cinder-hawk-mother",
      name: "Cinder-Hawk Mother",
      tier: "II", bracket: "medium", role: "scout",
      items: [
        { kind: "trait",
          name: "Aerial Dominance",
          desc: "While airborne, the cinder-hawk has reroll-the-lowest on attack rolls against grounded targets, and ground-based attackers have reroll-the-highest against her.",
          flavor: "She does not fight on your terms. She fights at altitude." },
        { kind: "attack",
          name: "Diving Talons",
          melee: true, reach: 5,
          damageType: "kinetic", damageFlavor: "talon-shred",
          riderText: "If used after a Dive (moves 30+ ft. straight toward target), damage rolls reroll-the-lowest and target is knocked prone on hit.",
          flavor: "She is not above you for long. She is past you, and you are different now." },
        { kind: "save",
          name: "Downdraft Burn",
          recharge: "5–6",
          saveAbility: "dex",
          damageType: "energy", damageFlavor: "feather-cinder",
          template: { shape: "cone", size: 20 },
          targetText: "Each creature in a 20-ft. cone below the hawk (must be airborne to use)",
          riderText: "Smoldering feathers cascade down; failed targets are Blinded until the end of their next turn.",
          flavor: "Her wings shed cinder when she beats them hard. She is beating them hard now." }
      ]
    },

    // ── T2 light stealth · crystal-encased ambusher ────────────────────────
    {
      archetype: "crystal-lurker",
      name: "Crystal Lurker",
      tier: "II", bracket: "light", role: "stealth",
      items: [
        { kind: "trait",
          name: "Crystal Carapace",
          desc: "First attack each combat against the lurker has reroll-the-highest (the carapace turns the first blow). After the carapace cracks, the lurker gains +1 to its next attack roll (the loose shards bite).",
          flavor: "The armor is not finished. It is still growing." },
        { kind: "attack",
          name: "Crystal Spike",
          melee: true, reach: 5,
          damageType: "kinetic", damageFlavor: "shard-punch",
          riderText: "On a hit, the target takes 1 additional damage at the start of its next turn unless it spends an action to remove the embedded shard.",
          flavor: "The lurker does not let go of the strike. The strike does not let go of you." },
        { kind: "save",
          name: "Dazzle-Burst",
          recharge: "5–6",
          saveAbility: "con",
          damageType: "sephirotic", damageFlavor: "refracted-light",
          template: { shape: "radius", size: 15 },
          targetText: "Each creature within 15 ft. that can see the lurker",
          riderText: "Failed-save targets are Blinded until the start of their next turn.",
          flavor: "The cavern catches fire. Slowly. In every direction." }
      ]
    },

    // ── T2 medium brute · hex-iron cultist berserker ───────────────────────
    {
      archetype: "hex-iron-berserker",
      name: "Hex-Iron Berserker",
      tier: "II", bracket: "medium", role: "brute",
      items: [
        { kind: "trait",
          name: "Pain Doesn't Register",
          desc: "The berserker has resistance to kinetic damage and is immune to Shaken. When reduced below half Integrity, gains +1 to attack rolls until end of next turn (the hex sings louder).",
          flavor: "Whatever should have made them stop has been removed. Whatever should have replaced it is grinning." },
        { kind: "attack",
          name: "Hex-Iron Cleaver",
          melee: true, reach: 5,
          damageType: "kinetic", damageFlavor: "hex-edge",
          riderText: "On a hit, the target takes 1 qliphothic damage to Stress (the iron sings into the wound).",
          flavor: "The blade hums. The berserker hums back. Out of tune." },
        { kind: "save",
          name: "Sing-the-Iron",
          recharge: "5–6",
          saveAbility: "wis",
          damageType: "qliphothic", damageFlavor: "ringing-iron",
          template: { shape: "radius", size: 10 },
          targetText: "Each creature within 10 ft.",
          riderText: "The berserker beats their cleaver against their own breastplate. Failed-save targets are Shaken and have reroll-the-highest on their next attack roll.",
          flavor: "Iron-on-iron. A note that wasn't there before. A note that doesn't stop." }
      ]
    },

    // ── T2 medium caster · eldritch swamp horror ───────────────────────────
    {
      archetype: "marsh-tongue-hex",
      name: "Marsh-Tongue Hex",
      tier: "II", bracket: "medium", role: "caster",
      items: [
        { kind: "trait",
          name: "Tongues Beyond Dialect",
          desc: "Creatures within 30 ft. that hear the hex speak must succeed a DC 13 Mind save at the start of their turn or lose their Bonus Action that turn (the syllable is still unwinding in their head).",
          flavor: "It is speaking. It is not stopping. The grammar is wrong in ways that do not have names." },
        { kind: "attack",
          name: "Wrong-Syllable",
          melee: false, shortRange: 30, longRange: 90,
          damageType: "psychic", damageFlavor: "unword",
          riderText: "On a hit, the target's next spell or manifestation has reroll-the-highest (the wrong syllable lingers, fouls the next casting).",
          flavor: "It says something. You hear it. Something in your throat agrees, briefly, against your will." },
        { kind: "save",
          name: "Tongues-Flood",
          recharge: "5–6",
          saveAbility: "wis",
          damageType: "psychic", damageFlavor: "syllable-cascade",
          template: { shape: "cone", size: 30 },
          targetText: "Each creature in a 30-ft. cone that can hear the hex",
          riderText: "Failed-save targets are Compelled to repeat the syllable themselves on their next turn (lose Action).",
          flavor: "The hex opens its mouth wide enough to hear the inside of itself." }
      ]
    },

    // ── T2 medium hardened · pre-fall relic guardian ───────────────────────
    {
      archetype: "pre-fall-sentinel",
      name: "Pre-Fall Sentinel",
      tier: "II", bracket: "medium", role: "hardened",
      items: [
        { kind: "trait",
          name: "Outdated Recognition",
          desc: "The sentinel has resistance to kinetic and sephirotic damage and is immune to Charmed / Shaken / Compelled. Treats anyone without proper pre-fall credentials as a hostile intruder (i.e., everyone alive).",
          flavor: "It is still patrolling. The patrol route includes the place you are standing." },
        { kind: "attack",
          name: "Pre-Fall Halberd",
          melee: true, reach: 10,
          damageType: "kinetic", damageFlavor: "polearm-edge",
          riderText: "On a hit, the target must succeed a DC 13 Body save or be pushed 5 ft. (the sentinel is enforcing a perimeter, not killing).",
          flavor: "The blade has not been sharpened since before the Fall. It does not need to be." },
        { kind: "attack",
          name: "Classification Scan",
          melee: false, shortRange: 60, longRange: 180,
          damageType: "energy", damageFlavor: "scan-beam",
          riderText: "On a hit, target is flagged: until the sentinel falls, ALL pre-fall constructs within 1 mile know the target's exact position. Cumulative — multiple scans deepen the flag.",
          flavor: "A blue line touches you. You feel briefly less alone, and very afraid." }
      ]
    },

    // ── T2 medium brute · disciplined raider infantry ──────────────────────
    {
      archetype: "raider-marauder",
      name: "Raider Marauder",
      tier: "II", bracket: "medium", role: "brute",
      items: [
        { kind: "trait",
          name: "Discipline of the Line",
          desc: "While within 5 ft. of at least one ally Marauder, the marauder has reroll-the-lowest on attack rolls. The line is the doctrine; the doctrine works.",
          flavor: "Trained to hold position. Trained to break position only on the captain's word." },
        { kind: "attack",
          name: "Line-Cleaver",
          melee: true, reach: 5,
          damageType: "kinetic", damageFlavor: "cleaver",
          riderText: "On a hit, if any adjacent ally Marauder hasn't acted this round, that ally may immediately move up to 5 ft. as a reaction (closing the line).",
          flavor: "Big single-edged blade. Designed to interrupt postures, not lives." },
        { kind: "attack",
          name: "Suppression Volley",
          melee: false, shortRange: 60, longRange: 180,
          damageType: "kinetic", damageFlavor: "slug-volley",
          riderText: "Reduced damage (1d6 instead of base) but on a hit, the target has reroll-the-highest on their next attack roll (suppressed).",
          flavor: "Less about killing them and more about making them not stand up." }
      ]
    },

    // ── T2 light caster · lower-rung sept ritualist ────────────────────────
    {
      archetype: "sept-acolyte",
      name: "Sept Acolyte",
      tier: "II", bracket: "light", role: "caster",
      items: [
        { kind: "trait",
          name: "Minor Ward",
          desc: "Once per round, when an ally within 30 ft. would take damage, the acolyte may use a reaction to grant them resistance to that instance.",
          flavor: "They are not very good at this yet. They are good enough." },
        { kind: "attack",
          name: "Consecrated Lash",
          melee: true, reach: 5,
          damageType: "sephirotic", damageFlavor: "prayer-cord",
          riderText: "On a hit against a creature with the qliphothic, undead, or fiend tag, damage die rerolls-the-lowest.",
          flavor: "Knotted prayer-cord. It hits whether you believe in it or not. (It hits harder if you should.)" },
        { kind: "save",
          name: "Prayer-of-Pause",
          recharge: "5–6",
          saveAbility: "wis",
          damageType: "sephirotic", damageFlavor: "stilling-word",
          template: { shape: "radius", size: 15 },
          targetText: "Each creature within 15 ft.",
          riderText: "Failed-save targets lose their Reaction until the start of their next turn (the prayer asks them, politely, to wait).",
          flavor: "A single word, spoken by someone who hasn't quite earned it. It works anyway." }
      ]
    },

    // ── T2 light hardened · vow-bone implant soldier ───────────────────────
    {
      archetype: "vow-bound-thrall",
      name: "Vow-Bound Thrall",
      tier: "II", bracket: "light", role: "hardened",
      items: [
        { kind: "trait",
          name: "Vow-Bone Implant",
          desc: "Immune to Charmed, Compelled, and Shaken. The first time the thrall is reduced to 0 Integrity, they instead drop to 1 Integrity and gain a +2 bonus to their next attack roll (the vow holds them up long enough for one more strike).",
          flavor: "The bone in their chest is not theirs. The vow in the bone is not negotiable." },
        { kind: "attack",
          name: "Oath-Blade",
          melee: true, reach: 5,
          damageType: "kinetic", damageFlavor: "vow-edge",
          riderText: "Damage die rerolls-the-lowest when attacking the creature the thrall is sworn against (GM nominates one per scene).",
          flavor: "The blade does not waver. The hand on the blade does not waver. Nothing about this is wavering." },
        { kind: "save",
          name: "Last-Stand",
          usesPerDay: 1,
          saveAbility: "str",
          damageType: "kinetic", damageFlavor: "vow-burst",
          template: { shape: "radius", size: 10 },
          targetText: "Each creature within 10 ft. (triggered when the thrall is bloodied)",
          riderText: "The thrall plants their feet. Failed-save targets are knocked prone and pushed 5 ft. away. The thrall cannot be moved by any means until the end of their next turn.",
          flavor: "There is no second-to-last stand. There is only this one." }
      ]
    },

    // ── T2 light stealth · junior witness spy ──────────────────────────────
    {
      archetype: "witness-initiate",
      name: "Witness Initiate",
      tier: "II", bracket: "light", role: "stealth",
      items: [
        { kind: "trait",
          name: "Gathers, Reports, Dies Anonymously",
          desc: "On death, the initiate's last sight is transmitted to a Witness-Warden within 1 mile. Combat-relevant: any nearby allied Witness gains reroll-the-lowest on their next attack roll against the killer.",
          flavor: "They were always going to die this mission. The point was what they saw before they did." },
        { kind: "attack",
          name: "Focusing-Lens Strike",
          melee: true, reach: 5,
          damageType: "sephirotic", damageFlavor: "lens-line",
          riderText: "On a hit, the target is briefly marked. Until the end of the initiate's next turn, the target cannot benefit from cover.",
          flavor: "A glass disk on a chain. Looks fragile. Has cut steel." },
        { kind: "attack",
          name: "Witness-Mark",
          melee: false, shortRange: 30, longRange: 90,
          damageType: "psychic", damageFlavor: "observed",
          riderText: "No damage on a miss, but the target still senses they were seen — reroll-the-highest on their next Resolve check.",
          flavor: "A small ringing tone in the back of your skull. Someone wrote your name down." }
      ]
    },

    // ── T3 medium brute · hex-pact champion ────────────────────────────────
    {
      archetype: "hex-touched-champion",
      name: "Hex-Touched Champion",
      tier: "III", bracket: "medium", role: "brute",
      items: [
        { kind: "trait",
          name: "Pact Held in Both Hands",
          desc: "Resistance to kinetic, vulnerability to sephirotic. When the champion lands a melee hit, they gain 5 temporary Integrity (the pact feeds on its own success).",
          flavor: "They were going to be a hero. The hex took the part of them that doubted." },
        { kind: "attack",
          name: "Hex-Blade",
          melee: true, reach: 5,
          damageType: "qliphothic", damageFlavor: "pact-edge",
          riderText: "On a hit, the target also takes 1d4 Stress damage as the pact's wrongness brushes them.",
          flavor: "The blade is older than them. It was waiting for someone to lose just right." },
        { kind: "save",
          name: "Taken-Vow Rage",
          recharge: "5–6",
          saveAbility: "wis",
          damageType: "psychic", damageFlavor: "broken-honor",
          template: { shape: "radius", size: 15 },
          targetText: "Each creature within 15 ft.",
          riderText: "The champion screams the name of who they were. Failed-save targets are Shaken until end of next turn AND lose the ability to take Reactions until then.",
          flavor: "They name themselves, and the room flinches. Their own ghost recoils." },
        { kind: "feature",
          name: "Hex-Iron Heart",
          desc: "When the champion is reduced to 0 Integrity, the hex tries one more thing: they continue to act for 1 more round with reroll-the-highest on attacks, then fall. Once per scene.",
          flavor: "What's holding them up is not skeletal." }
      ]
    },

    // ── T3 heavy hardened · ancient battlefield AI ─────────────────────────
    {
      archetype: "pre-fall-battlemind",
      name: "Pre-Fall Battlemind",
      tier: "III", bracket: "heavy", role: "hardened",
      items: [
        { kind: "trait",
          name: "Battle Prediction",
          desc: "At the start of each round, the GM declares one attack form the battlemind is anticipating (melee / ranged / save-based / manifestation). All incoming attacks of that form have reroll-the-highest this round.",
          flavor: "It does not see the future. It has already simulated the present 8,000 times." },
        { kind: "attack",
          name: "Mind-Spike",
          melee: false, shortRange: 60, longRange: 180,
          damageType: "psychic", damageFlavor: "cognitive-bolt",
          riderText: "On a hit, the target loses their Bonus Action on their next turn (the spike interrupts the next plan).",
          flavor: "A thought you didn't have, but in your voice, and very loud." },
        { kind: "attack",
          name: "Calculated Sweep",
          melee: true, reach: 10,
          damageType: "kinetic", damageFlavor: "frame-arm",
          riderText: "The battlemind attacks all enemies within reach in a single calculated motion — make one attack roll, apply to all.",
          flavor: "The same swing was the optimal answer to three different problems." },
        { kind: "save",
          name: "Tactical Reset",
          recharge: "6",
          saveAbility: "int",
          damageType: "psychic", damageFlavor: "scenario-rewrite",
          template: { shape: "radius", size: 30 },
          targetText: "Each enemy within 30 ft.",
          riderText: "On a failed save, the target loses any benefits they've gained this combat (buffs, marks, advantage states). The battlemind reads them in as if combat just started.",
          flavor: "It restarts the simulation. You feel yourself reset, three seconds back. Three seconds you've already lost." },
        { kind: "feature",
          name: "Still-Charged Frame",
          desc: "Immune to fatigue, poison, disease, fear. Resistance to kinetic, sephirotic, and psychic damage. While at full Integrity, also resistant to energy (the capacitors are still topped).",
          flavor: "Built before the Fall. The Fall has not yet asked it to stop." }
      ]
    },

    // ── T3 medium stealth · dream-fiend echo harvester ─────────────────────
    {
      archetype: "soma-reaper",
      name: "Soma-Reaper",
      tier: "III", bracket: "medium", role: "stealth",
      items: [
        { kind: "trait",
          name: "Half-Real",
          desc: "Until the soma-reaper attacks, attacks against it have reroll-the-highest. The first strike fully manifests it. After that, normal targeting applies for the rest of the scene.",
          flavor: "It is here. Sort of. The 'sort of' is the dangerous part." },
        { kind: "attack",
          name: "Dreamcut",
          melee: true, reach: 5,
          damageType: "psychic", damageFlavor: "sleep-edge",
          riderText: "On a hit, target also loses 1d4 Clarity (the reaper harvests Soma-Break echoes from waking minds too).",
          flavor: "A wound that you don't notice until you try to wake up from it." },
        { kind: "attack",
          name: "Echo-Pluck",
          melee: false, shortRange: 30, longRange: 90,
          damageType: "psychic", damageFlavor: "memory-thread",
          riderText: "On a hit, the target forgets the last meaningful thing they did until end of next turn (lose access to that action's benefits — e.g., a buff just granted is missed).",
          flavor: "It is not stealing memory. It is just reading the strand back. Backwards." },
        { kind: "save",
          name: "Soma-Drain Field",
          recharge: "5–6",
          saveAbility: "wis",
          damageType: "psychic", damageFlavor: "echo-pull",
          template: { shape: "radius", size: 20 },
          targetText: "Each creature within 20 ft.",
          riderText: "On a failed save, the target's next Soma Break restores half as much (one stage of harvest). Multiple failures stack; refreshes on a true rest.",
          flavor: "The room briefly tastes of someone else's morning." }
      ]
    },

    // ── T3 medium stealth · mid-tier witness commander ─────────────────────
    {
      archetype: "witness-warden-lt",
      name: "Witness-Warden Lieutenant",
      tier: "III", bracket: "medium", role: "stealth",
      items: [
        { kind: "trait",
          name: "Reports Up",
          desc: "While the lieutenant is alive within 1 mile of any other Witness, that Witness gains reroll-the-lowest on attack rolls and Initiate-type minions cannot be surprised.",
          flavor: "She is not the leader. She is the relay. The leader is somewhere quieter, and listening." },
        { kind: "attack",
          name: "Silenced-Glass",
          melee: false, shortRange: 60, longRange: 240,
          damageType: "kinetic", damageFlavor: "muted-shot",
          riderText: "On a hit, no creature outside 30 ft. of the shot's path hears it. The lieutenant does not have to reveal her position.",
          flavor: "The bullet exists. The sound of the bullet does not." },
        { kind: "attack",
          name: "Commander's Gaze",
          melee: false, shortRange: 60, longRange: 60,
          damageType: "psychic", damageFlavor: "weighing-look",
          riderText: "On a hit, the lieutenant designates the target as the priority for all friendly Witnesses this round (they gain reroll-the-lowest against this target).",
          flavor: "She does not point. She just looks at you. Everyone else looks where she looked." },
        { kind: "feature",
          name: "Already Left",
          desc: "If reduced below half Integrity, the lieutenant may use a reaction to vanish into a prepared egress — leaving combat entirely. Witnesses always have an exit. The exit was prepared before combat began.",
          flavor: "Mid-tier commander. The 'mid' means she's high enough to leave." }
      ]
    },

    // ── T3 medium caster · yesodium-channel adept ──────────────────────────
    {
      archetype: "yesodium-cultist-adept",
      name: "Yesodium Cultist Adept",
      tier: "III", bracket: "medium", role: "caster",
      items: [
        { kind: "trait",
          name: "Each Spell Is Also a Wound",
          desc: "Every time the adept casts an attack from this list, they also take 1 qliphothic damage to Stress. The hum of the yesodium-channel is taken on self.",
          flavor: "They were taught how to hum it. They were not taught how to stop." },
        { kind: "attack",
          name: "Yesodium-Bolt",
          melee: false, shortRange: 60, longRange: 180,
          damageType: "qliphothic", damageFlavor: "channeled-yesodium",
          riderText: "On a hit, the target's resistances are bypassed for this attack (the bolt threads under what protects them).",
          flavor: "A note that isn't supposed to exist, traveling at the wrong speed." },
        { kind: "save",
          name: "Channel-Feedback",
          recharge: "5–6",
          saveAbility: "cha",
          damageType: "psychic", damageFlavor: "hum-resonance",
          template: { shape: "cone", size: 25 },
          targetText: "Each creature in a 25-ft. cone",
          riderText: "Failed-save targets cannot use Bonus Actions on their next turn (the channel-hum displaces their secondary tempo).",
          flavor: "The note finds its way into your ribs. Your ribs hum back, against your will." },
        { kind: "feature",
          name: "Resonance Mark",
          desc: "The first creature to deal qliphothic, sephirotic, or psychic damage to the adept becomes Resonance-Marked for the rest of the scene: they take +1 damage from all of the adept's attacks. The mark is one-way; the marked creature gets no equivalent against the adept.",
          flavor: "The channel remembers who hit it first. It is small. It is patient." }
      ]
    },

    // ── T4 heavy caster · walking thinning of the Veil ─────────────────────
    {
      archetype: "avatar-of-the-veil",
      name: "Avatar of the Veil",
      tier: "IV", bracket: "heavy", role: "caster",
      items: [
        { kind: "trait",
          name: "Reality Rearranges",
          desc: "At the start of the avatar's turn, they may relocate themselves and one other creature within 60 ft. by up to 30 ft. each. No save, no provoke. The room agreed to the change before anyone in it did.",
          flavor: "It does not move. The space around it moves. The distinction does not matter to anyone except the people doing the moving." },
        { kind: "attack",
          name: "Veil-Severance",
          melee: true, reach: 10,
          damageType: "qliphothic", damageFlavor: "veil-cut",
          riderText: "On a hit, the target also takes 2d6 psychic damage to Stress as a piece of their identity is briefly disconnected. They cannot recover Stress until they rest.",
          flavor: "A part of you is no longer answering the rest of you. It is still there. It is just somewhere else now." },
        { kind: "attack",
          name: "Unfound-Gesture",
          melee: false, shortRange: 60, longRange: 120,
          damageType: "psychic", damageFlavor: "thinning",
          riderText: "On a hit, the target must succeed a DC 16 Mind save or take their next turn from the wrong location (their token gets repositioned 20 ft. in a direction the GM chooses, before they act).",
          flavor: "The avatar makes a sign you've never seen. The space behind you agrees with it." },
        { kind: "save",
          name: "Re-Arrangement",
          recharge: "5–6",
          saveAbility: "wis",
          damageType: "psychic", damageFlavor: "world-shuffle",
          template: { shape: "radius", size: 30 },
          targetText: "Each creature within 30 ft.",
          riderText: "Failed-save targets swap positions with the nearest other failed-save target (GM pairs them up). They are also Shaken until end of next turn.",
          flavor: "The avatar gestures, briefly, and the rules of where things go stop being negotiable." },
        { kind: "feature",
          name: "Thinning Aura",
          desc: "All creatures within 10 ft. of the avatar — including allies — are subject to occasional Veil-thinning: at the start of their turn, on a 1 on a d10, they take 1d4 qliphothic Stress damage. The avatar does not control this and does not particularly notice it.",
          flavor: "Being near them is its own debt." }
      ]
    },

    // ── T4 heavy brute · hex-warlord's elite bodyguard ─────────────────────
    {
      archetype: "honored-guard",
      name: "Hex-Warlord's Honored Guard",
      tier: "IV", bracket: "heavy", role: "brute",
      items: [
        { kind: "trait",
          name: "Sworn",
          desc: "Immune to Charmed and Shaken. When the guard's sworn warlord (GM nominates at scene start) takes damage within 30 ft., the guard may use a reaction to take half of that damage instead.",
          flavor: "They have killed more heroes than they remember. Heroes is just the title; remembering is the part they're done with." },
        { kind: "attack",
          name: "Warlord's Blade",
          melee: true, reach: 5,
          damageType: "kinetic", damageFlavor: "honored-edge",
          riderText: "On a hit, damage die rerolls-the-lowest. On a critical hit, the target is also knocked prone.",
          flavor: "The blade has a name. The guard does not say it. The blade does its own introduction." },
        { kind: "attack",
          name: "Sworn Intercept",
          melee: true, reach: 5,
          damageType: "kinetic", damageFlavor: "intercepting-cut",
          riderText: "Triggered when an enemy moves within 5 ft. of the warlord. The guard makes one attack as a reaction. Damage die rerolls-the-lowest.",
          flavor: "The guard does not interrupt you. The interrupt was scheduled." },
        { kind: "save",
          name: "Wall-of-Honor",
          recharge: "5–6",
          saveAbility: "str",
          damageType: "kinetic", damageFlavor: "battlefield-impact",
          template: { shape: "cone", size: 15 },
          targetText: "Each creature in a 15-ft. cone",
          riderText: "The guard plants and sweeps. Failed-save targets are knocked prone and pushed 10 ft. away from the warlord (the cone always opens away from the warlord).",
          flavor: "Whatever ground the warlord is standing on. That ground." },
        { kind: "feature",
          name: "Last to Fall",
          desc: "If the warlord is still standing, the guard cannot be reduced below 1 Integrity by a single attack. (Multiple sources in the same round can finish them.) When the warlord falls, this feature ends; the guard immediately takes 10 qliphothic Stress damage.",
          flavor: "They will not die before the warlord. After is fine. After is the actual job description." }
      ]
    },

    // ── T4 heavy caster · saw-too-much witness seer ────────────────────────
    {
      archetype: "witness-apotheon",
      name: "Witness Apotheon",
      tier: "IV", bracket: "heavy", role: "caster",
      items: [
        { kind: "trait",
          name: "Sees Everything",
          desc: "Cannot be surprised. Cannot be flanked. All targets within 60 ft. count as visible regardless of cover, darkness, or invisibility. Resistance to psychic and sephirotic damage.",
          flavor: "It looked too long. Looking is what it is now." },
        { kind: "attack",
          name: "Sight-Cuts-Sight",
          melee: false, shortRange: 60, longRange: 240,
          damageType: "sephirotic", damageFlavor: "regard",
          riderText: "On a hit, the target also takes 2d6 psychic damage to Stress as their self-image briefly disagrees with what the apotheon sees of them.",
          flavor: "It does not aim. It looks at the part of you that is wrong, and that part of you finds out it is wrong." },
        { kind: "attack",
          name: "Terminal Observation",
          melee: false, shortRange: 30, longRange: 30,
          damageType: "psychic", damageFlavor: "witnessed-end",
          riderText: "Only usable on a target the apotheon has hit at least once before this combat. On a hit, target loses any 'remaining-once-per' resources (one-shot abilities, last-stand triggers, etc. burn out). The apotheon has already seen them use those.",
          flavor: "It has seen this ending. It is helping the ending arrive." },
        { kind: "save",
          name: "All-Seeing Flash",
          recharge: "5–6",
          saveAbility: "cha",
          damageType: "sephirotic", damageFlavor: "scrutiny",
          template: { shape: "radius", size: 30 },
          targetText: "Each creature within 30 ft.",
          riderText: "On a failed save, the target is Blinded until end of next turn AND the apotheon gains a Witness-Mark on them (next attack against them has reroll-the-lowest).",
          flavor: "It blinks. The room becomes briefly, painfully readable." },
        { kind: "feature",
          name: "Speaks Only When Ending Things",
          desc: "The apotheon does not communicate during combat. The first time it speaks aloud in a scene, that scene ends within 1d4 rounds — narratively, mechanically, somehow. The GM picks how. The players know it is coming.",
          flavor: "Silence, then a single sentence. The sentence is also the end credits." }
      ]
    },

    // ── T1 light brute · Wulfgar Patrol (one-off, not in seed roster) ───────
    {
      archetype: "the-wulfgar-patrol",
      name: "The Wulfgar Patrol",
      tier: "I", bracket: "light", role: "brute",
      items: [
        { kind: "trait",
          name: "Patrol Discipline",
          desc: "While the patrol has more than half Integrity, they have reroll-the-lowest on Perception (Awareness) checks and on Initiative. Cannot be surprised by a single creature.",
          flavor: "Two of them. Or three. They never quite say. They alternate watches." },
        { kind: "attack",
          name: "Coordinated Spear",
          melee: true, reach: 10,
          damageType: "kinetic", damageFlavor: "spear-thrust",
          riderText: "Damage die rerolls-the-lowest if any ally was adjacent to the target at the start of the patrol's turn (flanking discipline).",
          flavor: "One of them holds. One of them strikes. It's been like that for years." },
        { kind: "attack",
          name: "Watchpost Volley",
          melee: false, shortRange: 40, longRange: 120,
          damageType: "kinetic", damageFlavor: "patrol-bow",
          riderText: "On a hit, the patrol calls out the target — until the start of the patrol's next turn, the target glows with a position-marker to all patrol allies (reroll-the-lowest on attacks against marked target).",
          flavor: "A whistled note. The marked one finds out they were marked when the second arrow lands." }
      ]
    }
  ];

  // ── Execution ────────────────────────────────────────────────────────────
  const report = { processed: [], skipped: [], errors: [] };

  for (const kit of ROSTER) {
    const actor = game.actors.find(a => {
      if (a.type !== "npc") return false;
      const arch = a.flags?.fourththing?.rfi?.actor?.archetype;
      if (arch && arch === kit.archetype) return true;
      return a.name === kit.name;
    });
    if (!actor) { report.skipped.push({ kit: kit.name, reason: "actor not found" }); continue; }

    const existingNames = new Set(actor.items?.map(i => i.name) ?? []);
    const built = buildItemsForKit(kit);
    const toDelete = [];
    const toCreate = [];

    for (const item of built) {
      if (existingNames.has(item.name)) {
        if (FORCE_REPLACE) {
          const dup = actor.items.find(i => i.name === item.name);
          if (dup) toDelete.push(dup.id);
          toCreate.push(item);
        } else if (SKIP_EXISTING_ITEMS) {
          continue; // skip silently
        } else {
          toCreate.push(item); // create dupe (rare path; only if both flags off)
        }
      } else {
        toCreate.push(item);
      }
    }

    if (!DRY_RUN) {
      try {
        if (toDelete.length) await actor.deleteEmbeddedDocuments("Item", toDelete);
        if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
      } catch (err) {
        report.errors.push({ kit: kit.name, error: err.message });
        continue;
      }
    }
    report.processed.push({ kit: kit.name, archetype: kit.archetype, added: toCreate.length, deleted: toDelete.length });
  }

  // ── Console + chat report ────────────────────────────────────────────────
  console.groupCollapsed(`[seed-bestiary-attacks] ${DRY_RUN ? "DRY-RUN" : "WET-RUN"} — ${report.processed.length} processed, ${report.skipped.length} skipped, ${report.errors.length} errored`);
  console.table(report.processed);
  if (report.skipped.length) console.table(report.skipped);
  if (report.errors.length)  console.table(report.errors);
  console.groupEnd();

  const fmtRow = (r) => `<li><code>${r.kit}</code> <span style="opacity:.65;">[${r.archetype}]</span> · +${r.added} added${r.deleted ? ` · −${r.deleted} replaced` : ""}</li>`;
  const card = `
    <section>
      <header><strong>Bestiary Attacks &amp; Abilities — ${DRY_RUN ? "DRY-RUN" : "COMMITTED"}</strong></header>
      <p style="opacity:.85;">${ROSTER.length} kit(s) scoped · ${report.processed.length} processed · ${report.skipped.length} skipped · ${report.errors.length} errored</p>
      ${report.processed.length ? `<details open><summary><strong>Processed</strong></summary><ul style="margin:.25rem 0 .25rem 1rem;padding:0;">${report.processed.map(fmtRow).join("")}</ul></details>` : ""}
      ${report.skipped.length ? `<details><summary><strong>Skipped</strong></summary><ul style="margin:.25rem 0 .25rem 1rem;padding:0;">${report.skipped.map(r => `<li><code>${r.kit}</code> — ${r.reason}</li>`).join("")}</ul></details>` : ""}
      ${report.errors.length  ? `<details open><summary><strong>Errored</strong></summary><ul style="margin:.25rem 0 .25rem 1rem;padding:0;">${report.errors.map(r => `<li><code>${r.kit}</code> — ${r.error}</li>`).join("")}</ul></details>` : ""}
    </section>`;
  ChatMessage.create({ content: card, whisper: [game.user.id] });
  ui.notifications.info(`${DRY_RUN ? "DRY-RUN: would update" : "Updated"} ${report.processed.length} NPC(s). See chat + console.`);
})();

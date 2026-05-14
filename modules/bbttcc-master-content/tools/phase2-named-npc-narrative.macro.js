// phase2-named-npc-narrative.macro.js — Roll for Initiation
// Hand-authored RFI flavor for the 7 named NPCs translated by
// translate-5e-npcs.macro.js. Adds 1–2 manifestation/feature items per NPC,
// updates sephirah, refines role, and tweaks Guard/Evasion splits where the
// creature's nature calls for it.
//
// Idempotent: each patched actor gets a `phase2-narrative-applied` tag; the
// macro skips actors that already have it. Safe to re-run after a translator
// re-pass — the new translator output will lack the tag and get patched.
//
// Run as a Foundry script macro. Targets: bbttcc-master-content.npcs.
//
// Author: BBTTCC team — 2026-05-02

(async () => {
  const PACK_ID = "bbttcc-master-content.npcs";
  const APPLIED_TAG = "phase2-narrative-applied";
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications.error(`Compendium not found: ${PACK_ID}`);

  // ── Patch table — keyed by lowercased name substring ────────────────────────
  // Each entry can supply: sephirah, role, defenseSplit (guardDelta/evasionDelta),
  // and items[] of new embedded items to create after wipe-of-existing-passives.
  // Items follow the fourththing schema; manifestations live as type:"power".
  const PATCHES = [
    {
      key: "tiferet tree person",
      sephirah: "tiferet",
      role: "Sephirotic Judge (Plant)",
      defenseSplit: { guardDelta: +2, evasionDelta: -1 },  // rooted, hard to budge
      items: [
        {
          name: "Bough of Just Sentence",
          type: "power",
          img:  "icons/magic/nature/tree-druid-glow-green.webp",
          system: {
            intent: "presence", channel: "soul", sephirah: "tiferet",
            mode: "working", activation: "action", target: "single", range: "near",
            clarityRequired: 2, noiseGain: 1,
            effect: "A luminous bough extends from the bark. The named target must speak the truest thing they fear; on a failed Resolve, take 2d6 sephirotic damage applied to Stress and Calmed for one exchange while the tree weighs the answer.",
            flavor: "Bark grows over the wound and sings hymns until they answer.",
            damage: "2d6",
            manifestation: {
              family: "working", concept: "A bough that interrogates by judgment, not pain.",
              form: "branch", function: "judge", stability: "instant", interactionModel: "vow",
              costType: "clarity", costValue: 2, costText: "2 Clarity",
              duration: "instant", durationText: "Until the answer is given.",
              triggerText: "When the target tries to lie about the thing they fear most.",
              scale: "personal", targetText: "One creature within near.",
              rangeAreaText: "Near; the bough reaches.",
              maintenanceCost: "",
              riskText: "If the target speaks a truth that wounds the Tree, the Tree takes 1 Stress.",
              pathResonance: "Tiferet — beauty as judgment.",
              fictionalPermission: "May force a public confession and apply Calmed.",
              gmCalibration: "Sephirotic damage; only fires on a genuine evasion of fear.",
              mechanicalHook: "2d6 sephirotic to Stress + Calmed on failed Resolve.",
              signature: "Bark grows over the wound and sings hymns.",
              thirdThing: "The bough remembers every confession it has heard."
            },
            tags: ["translated", "5e-port", "phase2-narrative", "manifestation"]
          }
        },
        {
          name: "Roots of Tiferet",
          type: "feature",
          img: "icons/magic/nature/root-vine-yellow.webp",
          system: {
            description: { value: "<p><strong>Reaction.</strong> When struck, may root in place. While rooted, +2 Guard but movement is 0. Roots feed on the local Sephirotic field; while rooted, regain 1 Integrity per round.</p>" },
            tags: ["translated", "5e-port", "phase2-narrative"]
          }
        }
      ]
    },
    {
      key: "slippage wraith",
      sephirah: "yesod",
      role: "Phase Aberration (Reality-Drift)",
      defenseSplit: { guardDelta: -2, evasionDelta: +3 },  // hard to hit, easy to wound
      items: [
        {
          name: "Frame Drift",
          type: "power",
          img: "icons/magic/death/skeleton-ribcage-red.webp",
          system: {
            intent: "intrigue", channel: "mind", sephirah: "yesod",
            mode: "working", activation: "action", target: "self", range: "self",
            clarityRequired: 1, noiseGain: 2,
            effect: "Phase the Wraith partially out of the current frame. Until the start of its next turn, attackers reroll-lowest on attacks against it; on each missed attack, the attacker takes 1d6 qliphothic to Stress as the slip bleeds back into them.",
            flavor: "The air around it remembers things that didn't happen.",
            damage: "1d6",
            manifestation: {
              family: "working", concept: "Stop being entirely present.",
              form: "self-effect", function: "evade", stability: "sustained", interactionModel: "ward",
              costType: "clarity", costValue: 1, costText: "1 Clarity / scene",
              duration: "scene", durationText: "Until the next turn or dismissed.",
              triggerText: "When attacked.",
              scale: "personal", targetText: "Self.",
              rangeAreaText: "Self.",
              maintenanceCost: "1 Clarity per round to sustain.",
              riskText: "The Wraith may slip too far and lose 1 Integrity to a frame it can't return from.",
              pathResonance: "Yesod — foundation as suggestion.",
              fictionalPermission: "May refuse to be where it was.",
              gmCalibration: "Reroll-lowest on attacks; 1d6 qliphothic to Stress on misses.",
              mechanicalHook: "Reroll-lowest defense; reflective qliphothic damage.",
              signature: "The air remembers things that didn't happen.",
              thirdThing: "Anyone watching forgets where they were standing."
            },
            tags: ["translated", "5e-port", "phase2-narrative", "manifestation"]
          }
        },
        {
          name: "Slipped Through",
          type: "feature",
          img: "icons/magic/movement/abstract-ribbons-purple.webp",
          system: {
            description: { value: "<p><strong>Reaction.</strong> When struck, the Wraith may displace 1 hex / 5 feet. The attacker briefly forgets which target they aimed at — they take Disadvantage (reroll-lowest) on their next attack roll this exchange.</p>" },
            tags: ["translated", "5e-port", "phase2-narrative"]
          }
        }
      ]
    },
    {
      key: "valhaulan spark adept",
      sephirah: "geburah",
      role: "Martial Caster (Storm-Voiced)",
      items: [
        {
          name: "Spark Vow",
          type: "power",
          img: "icons/magic/lightning/bolt-strike-blue.webp",
          system: {
            intent: "violence", channel: "presence", sephirah: "geburah",
            mode: "working", activation: "action", target: "single", range: "far",
            clarityRequired: 2, noiseGain: 1,
            effect: "Name a target and speak a vow against them. The next time that target misses an attack against you or an ally, lightning answers — they take 2d8 energy to Integrity. Vow lasts one scene; only one Spark Vow may be active at a time.",
            flavor: "Ozone smell, and a bell rings somewhere in Valhaul.",
            damage: "2d8",
            manifestation: {
              family: "working", concept: "A martial pact with a sky that owes you.",
              form: "vow", function: "punish", stability: "bound", interactionModel: "trigger",
              costType: "clarity", costValue: 2, costText: "2 Clarity",
              duration: "scene", durationText: "Until paid out or scene ends.",
              triggerText: "When the named target misses an attack against the Adept or an ally.",
              scale: "personal", targetText: "One creature within far range.",
              rangeAreaText: "Far; sightline.",
              maintenanceCost: "",
              riskText: "If the named target dies before the vow pays out, the Adept takes 1 Stress.",
              pathResonance: "Geburah — severity, the answer that comes back.",
              fictionalPermission: "May call lightning on a missed attack.",
              gmCalibration: "Resolves once and ends; one Spark Vow at a time.",
              mechanicalHook: "2d8 energy on triggered miss.",
              signature: "Ozone, then a distant bell.",
              thirdThing: "The struck target's hair stands up for an hour after."
            },
            tags: ["translated", "5e-port", "phase2-narrative", "manifestation"]
          }
        },
        {
          name: "Hammer-Bright Ward",
          type: "power",
          img: "icons/magic/holy/yin-yang-balance-orange.webp",
          system: {
            intent: "violence", channel: "body", sephirah: "geburah",
            mode: "form", activation: "bonus", target: "self", range: "self",
            clarityRequired: 1, noiseGain: 0,
            effect: "While wielding a martial Form, +1 Guard. While the ward holds, kinetic damage you deal counts as energy.",
            flavor: "Sparks crawl up the haft.",
            damage: "",
            manifestation: {
              family: "form", concept: "A bright halo around the haft of any weapon.",
              form: "ward", function: "protect", stability: "bound", interactionModel: "passive",
              costType: "clarity", costValue: 1, costText: "1 Clarity / Soma Break",
              duration: "soma-break", durationText: "Until next Soma Break.",
              triggerText: "Activated as a Bonus action.",
              scale: "personal", targetText: "Self while armed.",
              rangeAreaText: "Self.",
              maintenanceCost: "",
              riskText: "While the ward is up, the Adept cannot benefit from cover.",
              pathResonance: "Geburah — bright martial discipline.",
              fictionalPermission: "May reflavor kinetic strikes as energy.",
              gmCalibration: "+1 Guard, kinetic→energy on outgoing damage.",
              mechanicalHook: "+1 Guard; outgoing damage type swap.",
              signature: "Sparks crawl up the haft.",
              thirdThing: "Iron near the wielder rings faintly."
            },
            tags: ["translated", "5e-port", "phase2-narrative", "manifestation"]
          }
        }
      ]
    },
    {
      key: "qlipothic shambler",
      sephirah: "malkuth",
      role: "Qliphothic Horror (Hollow)",
      items: [
        {
          name: "Hollow Hunger",
          type: "power",
          img: "icons/magic/death/grave-skull-headstone-purple.webp",
          system: {
            intent: "violence", channel: "soul", sephirah: "malkuth",
            mode: "working", activation: "action", target: "burst", range: "near",
            clarityRequired: 2, noiseGain: 2,
            effect: "The Shambler's mouth opens onto a place that isn't here. Each creature within near makes a Resolve check; on a failure, take 2d6 qliphothic damage to Stress and become Shaken until the start of their next turn.",
            flavor: "The room briefly tastes of iron and a memory you didn't have.",
            damage: "2d6",
            manifestation: {
              family: "working", concept: "Ambient hunger spilled outward from a wound that doesn't close.",
              form: "aura", function: "harm", stability: "instant", interactionModel: "save",
              costType: "noise", costValue: 2, costText: "2 Noise",
              duration: "instant", durationText: "One pulse.",
              triggerText: "When the Shambler is engaged in melee.",
              scale: "scene", targetText: "All creatures within near.",
              rangeAreaText: "Near burst.",
              maintenanceCost: "",
              riskText: "The Shambler takes 1 Stress per pulse.",
              pathResonance: "Malkuth corrupted — kingdom of consumption.",
              fictionalPermission: "Players may be Shaken by what's behind the teeth.",
              gmCalibration: "Resolve check; qliphothic to Stress.",
              mechanicalHook: "AOE Resolve save; 2d6 qliphothic to Stress + Shaken.",
              signature: "The room tastes of iron.",
              thirdThing: "Whoever fails remembers a death that wasn't theirs."
            },
            tags: ["translated", "5e-port", "phase2-narrative", "manifestation"]
          }
        },
        {
          name: "Wrong-Wave",
          type: "feature",
          img: "icons/magic/death/hand-withered-gray.webp",
          system: {
            description: { value: "<p><strong>Passive.</strong> When the Shambler drops to 0 Integrity, every creature within near makes a Soul check (DC 13). On failure, take 1d6 qliphothic damage to Stress as the wrongness spills out.</p>" },
            tags: ["translated", "5e-port", "phase2-narrative"]
          }
        }
      ]
    },
    {
      key: "jommetry serpent",
      sephirah: "hod",
      role: "Geometric Predator (Vector-Reader)",
      defenseSplit: { guardDelta: -1, evasionDelta: +2 },
      items: [
        {
          name: "Angle of Arrival",
          type: "power",
          img: "icons/magic/movement/trail-streak-pink.webp",
          system: {
            intent: "intrigue", channel: "mind", sephirah: "hod",
            mode: "working", activation: "action", target: "self", range: "near",
            clarityRequired: 1, noiseGain: 0,
            effect: "Move along an impossible chord; reappear at any point within near. The Serpent's next attack this turn rolls 2d10x10 with reroll-lowest.",
            flavor: "The room briefly grows a corner that wasn't drawn.",
            damage: "",
            manifestation: {
              family: "working", concept: "Travel along a line nobody drew.",
              form: "movement", function: "reposition", stability: "instant", interactionModel: "passive",
              costType: "clarity", costValue: 1, costText: "1 Clarity",
              duration: "instant", durationText: "One repositioning.",
              triggerText: "Activated as an Action.",
              scale: "personal", targetText: "Self.",
              rangeAreaText: "Near; any visible point.",
              maintenanceCost: "",
              riskText: "The Serpent appears unarmored for the moment of arrival.",
              pathResonance: "Hod — splendor of pure form.",
              fictionalPermission: "May appear at impossible angles.",
              gmCalibration: "Movement only; sets up the next attack with reroll-lowest.",
              mechanicalHook: "Free reposition near + advantage on next attack.",
              signature: "A corner appears that wasn't drawn.",
              thirdThing: "Geometry textbooks within 30 ft. develop new errata."
            },
            tags: ["translated", "5e-port", "phase2-narrative", "manifestation"]
          }
        },
        {
          name: "Read the Vector",
          type: "feature",
          img: "icons/magic/perception/eye-ringed-glow-angry-large-teal.webp",
          system: {
            description: { value: "<p><strong>Passive.</strong> Once per scene, the Serpent may reroll-lowest one defense check by reading where the strike was going to swing.</p>" },
            tags: ["translated", "5e-port", "phase2-narrative"]
          }
        }
      ]
    },
    {
      key: "lisa frank elemental",
      sephirah: "netzach",
      role: "Joy Elemental (Saturated)",
      items: [
        {
          name: "Rainbow Cascade",
          type: "power",
          img: "icons/magic/light/explosion-star-glow-pink.webp",
          system: {
            intent: "presence", channel: "soul", sephirah: "netzach",
            mode: "working", activation: "action", target: "burst", range: "near",
            clarityRequired: 2, noiseGain: 1,
            effect: "Release a saturated wave. Each creature within near makes a Resolve check; on failure, take 2d6 energy damage and become Charmed for one exchange (they see only beauty in the Elemental).",
            flavor: "Animal silhouettes briefly inhabit the landscape behind targets — a unicorn, a kitten, a dolphin.",
            damage: "2d6",
            manifestation: {
              family: "working", concept: "An eruption of impossible color and goodwill.",
              form: "aura", function: "charm", stability: "instant", interactionModel: "save",
              costType: "clarity", costValue: 2, costText: "2 Clarity",
              duration: "instant", durationText: "One pulse; Charm lasts one exchange.",
              triggerText: "Activated as an Action.",
              scale: "scene", targetText: "All creatures within near.",
              rangeAreaText: "Near burst.",
              maintenanceCost: "",
              riskText: "The Elemental fades by 1 Integrity per Cascade — joy is expensive.",
              pathResonance: "Netzach — eternity of art.",
              fictionalPermission: "Charmed targets cannot directly attack the Elemental.",
              gmCalibration: "Resolve check; energy damage; Charm one exchange.",
              mechanicalHook: "AOE save; 2d6 energy + Charmed.",
              signature: "Animals appear behind the targets.",
              thirdThing: "Anyone Charmed remembers it as the best afternoon of their life."
            },
            tags: ["translated", "5e-port", "phase2-narrative", "manifestation"]
          }
        },
        {
          name: "Saturation Field",
          type: "feature",
          img: "icons/magic/light/beams-rays-orange-purple-large.webp",
          system: {
            description: { value: "<p><strong>Passive.</strong> While the Elemental is present in the scene, lighting saturates impossibly. All damage to Integrity from any source is reduced by 1 (minimum 1). Manifestations cost +1 Clarity to cast — joy is expensive.</p>" },
            tags: ["translated", "5e-port", "phase2-narrative"]
          }
        }
      ]
    },
    {
      key: "gilbert",
      sephirah: "malkuth",
      role: "Theater Attendant (Mal-Voiced)",
      defenseSplit: { guardDelta: 0, evasionDelta: 0 },
      items: [
        {
          name: "The Mop Knows",
          type: "feature",
          img: "icons/tools/cooking/spoon-wooden-brown.webp",
          system: {
            description: { value: "<p><strong>Passive (Mal voice).</strong> Gilbert's mop has 50/50 precognition for any spilled fluid. Once per scene, Gilbert may name the next bodily fluid that will hit the floor and where; if right, he sweeps it before it lands. One PC in the scene may then reroll-lowest on any check involving footing, balance, or a cleanly-finished moment. Mop says: \"Already had it. Already there.\"</p>" },
            tags: ["translated", "5e-port", "phase2-narrative", "mal-voice"]
          }
        },
        {
          name: "Theater Etiquette",
          type: "feature",
          img: "icons/sundries/documents/blueprint-magic.webp",
          system: {
            description: { value: "<p><strong>Passive (Mal voice).</strong> While Gilbert is on stage, no one may bring flash photography, lit cigarettes, or weapon discharge into the orchestra section without winning a Diplomacy contest vs. Gilbert's Resolve. Gilbert reframes any direct violence against him as poor manners and continues sweeping. He cannot be Compelled by threat. The mop is his witness.</p>" },
            tags: ["translated", "5e-port", "phase2-narrative", "mal-voice"]
          }
        }
      ]
    }
  ];

  // ── Apply patches ──────────────────────────────────────────────────────────
  const index = await pack.getIndex({ fields: ["name"] });
  const created = [];
  const skipped = [];

  for (const patch of PATCHES) {
    const idx = index.find(e => String(e.name ?? "").toLowerCase().includes(patch.key));
    if (!idx) { skipped.push(`${patch.key} (not found in pack)`); continue; }
    const actor = await pack.getDocument(idx._id);
    const tags  = Array.isArray(actor.system?.tags) ? actor.system.tags : [];
    if (tags.includes(APPLIED_TAG)) { skipped.push(`${actor.name} (already patched)`); continue; }

    const updates = {};
    if (patch.sephirah) updates["system.magic.sephirah"] = patch.sephirah;
    if (patch.role)     updates["system.role"]           = patch.role;
    if (patch.defenseSplit) {
      const gV = Number(actor.system?.derived?.guard?.value   ?? 11);
      const eV = Number(actor.system?.derived?.evasion?.value ?? 11);
      updates["system.derived.guard.value"]   = Math.max(0, gV + (patch.defenseSplit.guardDelta   ?? 0));
      updates["system.derived.evasion.value"] = Math.max(0, eV + (patch.defenseSplit.evasionDelta ?? 0));
    }
    updates["system.tags"] = [...tags, APPLIED_TAG];
    await actor.update(updates);

    if (Array.isArray(patch.items) && patch.items.length) {
      await actor.createEmbeddedDocuments("Item", patch.items);
    }
    created.push(actor.name);
  }

  ui.notifications.info(`Phase 2 narrative pass: patched ${created.length}, skipped ${skipped.length}. See console.`);
  console.log("[ft-phase2-narrative] patched:", created);
  if (skipped.length) console.warn("[ft-phase2-narrative] skipped:", skipped);
})();

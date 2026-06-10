// Bad Eden — Bulk-stamp Phase C triggers (Chunk 6 bulk-author)
// ─────────────────────────────────────────────────────────────────────────────
// Generated 2026-04-29T00:25:57.200Z by build-stamp-triggers-bulk.mjs
// Source: /tmp/trigger-vocab.json (survey output, 61 triggers across 54 items).
//
// V1 strategy: every trigger stamps as { kind: "chat-prompt" } with the
// survey's trimmed effect_summary as the chat body. When the trigger fires
// the engine posts a GM prompt for manual resolution. Specific high-traffic
// items get hand-upgraded to grant-resource / extra-damage / etc. in
// follow-up passes — the pilot batch (Polarity Mastery, Inverted Foundation,
// Wayfarer L1, Liminal Operator, Hearth-Reader) already has structured
// effects and is skipped via the idempotency guard below.
//
// Looks each item up by NAME across all Item packs (per
// feedback_pack_id_mismatch). Idempotent (skips items with existing triggers).
// IIFE-wrapped per feedback_foundry_v14_macro_scope (bare `return` throws).
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

const DRY_RUN = false;

const BATCH = [
  {
    "name": "Oldenborn",
    "pack": "ancestries",
    "triggers": [
      {
        "event": "on-rest",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Dream-Flesh. You do not sleep. When you rest, you drift into Yesod"
          }
        }
      }
    ]
  },
  {
    "name": "Last Mile L1: The Weight You Carry",
    "pack": "classes/shadow_courier/route-of-the-last-mile",
    "triggers": [
      {
        "event": "on-delivery",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "On delivery: When you successfully deliver a Soul to safety (the GM confirms the destination counts as safety for that Soul), the recipie..."
          }
        }
      }
    ]
  },
  {
    "name": "Wayfarer Tongue L13: Reply With Interest",
    "pack": "classes/shadow_courier/route-of-the-wayfarer-tongue",
    "triggers": [
      {
        "event": "on-delivery",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Every door you knock on owes you an answer. When you successfully deliver a Message, you may accept a Reply as a free action"
          }
        }
      }
    ]
  },
  {
    "name": "Wayfarer Tongue L17: The Standing Appointment (Capstone)",
    "pack": "classes/shadow_courier/route-of-the-wayfarer-tongue",
    "triggers": [
      {
        "event": "on-delivery",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "On delivery of a Standing Appointment Message: Darkness in the recipient's hex is reduced by 2 points (in addition to any other reductions)"
          }
        }
      }
    ]
  },
  {
    "name": "Wayfarer Tongue L1: The Tongue That Does Not Lie",
    "pack": "classes/shadow_courier/route-of-the-wayfarer-tongue",
    "triggers": [
      {
        "event": "on-delivery",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "On delivery: When you successfully deliver a Message to its intended recipient (the GM confirms it counts), your Pace pool refills to max..."
          }
        }
      }
    ]
  },
  {
    "name": "Wayfarer Tongue L5: Preceding Rumor",
    "pack": "classes/shadow_courier/route-of-the-wayfarer-tongue",
    "triggers": [
      {
        "event": "on-scene-start",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "resent must succeed on a Soul defense check vs DC 12 + your Initiation tier × 2 at the start of the scene, or their hostile intent toward you becomes obvious before they can act on it"
          }
        }
      }
    ]
  },
  {
    "name": "Shadow Courier — Tier 1: Liminal Operator",
    "pack": "classes/shadow_courier/class-features",
    "triggers": [
      {
        "event": "on-move",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Pace generation. Gain 1 Pace when you move at least 30 feet on your turn"
          }
        }
      }
    ]
  },
  {
    "name": "Black Stair L5: The Threshold Is A Lie",
    "pack": "classes/shadow_courier/route-of-the-black-stair",
    "triggers": [
      {
        "event": "on-feature-use",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Wards aren't walls. They're paperwork. When you use your class's The Crossing ability (Class Tier 2) on a magical barrier, treat the barrier's check DC as if it were 2 lower"
          }
        }
      }
    ]
  },
  {
    "name": "Black Stair L1: The Crossing, Weaponized",
    "pack": "classes/shadow_courier/route-of-the-black-stair",
    "triggers": [
      {
        "event": "on-delivery",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Using the Key consumes it. On delivery (resolving the Blade strike on its intended target, or using the Key on its intended barrier): no Pace refill from this base f..."
          }
        }
      }
    ]
  },
  {
    "name": "Black Stair L9: Extraction",
    "pack": "classes/shadow_courier/route-of-the-black-stair",
    "triggers": [
      {
        "event": "on-package-take",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "What you carry, no one else can find. When you take a non-owned object , a piece of information , or a willing small creature into your possession as a Package, both you and the Package become untraceable by divinatio..."
          }
        }
      }
    ]
  },
  {
    "name": "Cataclyst L5: Stance Dance",
    "pack": "classes/bulwark/path-of-the-cataclyst",
    "triggers": [
      {
        "event": "on-turn-start",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "The hinge swings either way. You decide which way every turn. At the start of each of your turns, declare a stance for that turn"
          }
        }
      }
    ]
  },
  {
    "name": "Bulwark — Tier 3: Polarity Mastery",
    "pack": "classes/bulwark/class-features",
    "triggers": [
      {
        "event": "on-damage-taken",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "In addition to your normal Ruin generation, gain 1 Ruin Charge when you take damage from a single instance of any source while remaining upright"
          }
        }
      },
      {
        "event": "on-attack-hit",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "In addition to your normal Frame generation, gain 1 Frame Die when you score a successful melee strike (any roll where at least one die rolled before explosions shows ≥ 8)"
          }
        }
      }
    ]
  },
  {
    "name": "Mountain L1: Inverted Foundation",
    "pack": "classes/bulwark/path-of-the-mountain",
    "triggers": [
      {
        "event": "on-scene-end",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "End-of-scene conversion. Any Ruin Charges still in your pool when the scene ends convert 1-for-1 into Frame Dice on your next Soma Break (replacing the Frame Dice that would otherwise refill from th..."
          }
        }
      }
    ]
  },
  {
    "name": "Avalanche L1: Kinetic Inversion",
    "pack": "classes/bulwark/path-of-the-avalanche",
    "triggers": [
      {
        "event": "on-move",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "You generate Frame Dice when you end a movement, not when you start one. When you move at least half your speed in a turn and end that turn with a successful Violence-attribute action or weapon strike, gain 1 F..."
          }
        }
      }
    ]
  },
  {
    "name": "Avalanche L17: Running Theology (Capstone)",
    "pack": "classes/bulwark/path-of-the-avalanche",
    "triggers": [
      {
        "event": "on-turn-start",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "At the start of your turn you may spend any number of Frame Dice"
          }
        }
      }
    ]
  },
  {
    "name": "Avalanche L5: Shockwave Arrival",
    "pack": "classes/bulwark/path-of-the-avalanche",
    "triggers": [
      {
        "event": "on-move",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Arriving is the strike. When you move 10 feet or more in a straight line in a turn and finish with a melee weapon strike, you may spend 1 Ruin Charge as part of that strike"
          }
        }
      }
    ]
  },
  {
    "name": "Human",
    "pack": "ancestries",
    "triggers": [
      {
        "event": "on-save-fail",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Adaptive. Once per a Soma Break, when you fail a defense check, you can choose to succeed instead"
          }
        }
      },
      {
        "event": "on-skill-fail",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Adaptive. Once per a Soma Break, when you fail a defense check, you can choose to succeed instead"
          }
        }
      }
    ]
  },
  {
    "name": "Oldenborn (Earthbound): World-Anchor",
    "pack": "ancestry_feats",
    "triggers": [
      {
        "event": "on-forced-movement",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Reality tries to slide. You say: no.” World-Anchor (1/a Soma Break). When you or an ally you can see within 30 feet would be teleported, displaced, banished, or forcibly moved by a magical or metaphysical e..."
          }
        }
      }
    ]
  },
  {
    "name": "Circuitborn (Exo-Knight Line): Kinetic Overflow",
    "pack": "ancestry_feats",
    "triggers": [
      {
        "event": "on-attack-hit",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "When you hit with a weapon attack, you can spend 1 Overflow to deal +1d6 kinetic damage (force)"
          }
        }
      }
    ]
  },
  {
    "name": "Oldenborn (Lumenwrought): Moonlit Ward",
    "pack": "ancestry_feats",
    "triggers": [
      {
        "event": "on-self-or-ally-condition",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Moonlit Ward (tier [TODO(pb-call)]/a Soma Break). When you or an ally within 30 feet would be charmed or Shaken, you can use your reaction to grant reroll the lowest die on the defense ch..."
          }
        }
      }
    ]
  },
  {
    "name": "Furrykin (Mustelid): Relentless Bite",
    "pack": "ancestry_feats",
    "triggers": [
      {
        "event": "on-attack-hit",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Relentless Bite (1/a Soma Break). For 1 minute, once per turn when you hit a creature, you can reduce their speed to 0 until the start of their next turn (Violence save resists"
          }
        }
      }
    ]
  },
  {
    "name": "Human (Neanderthal): Protective Instinct",
    "pack": "ancestry_feats",
    "triggers": [
      {
        "event": "on-ally-hit",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "You move first.” Protective Instinct (tier [TODO(pb-call)]/a Soma Break). When an ally within 10 feet is hit, you can use your reaction to reduce the damage by 1d6 + your tier [TODO(pb-call)]"
          }
        }
      }
    ]
  },
  {
    "name": "Menhirkin",
    "pack": "ancestries",
    "triggers": [
      {
        "event": "on-ally-targeted",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Living Rampart. You have proficiency in the Athletics skill. As a reaction when a creature you can see targets an ally adjacent to you with an attack, you can interpose bulk and bad life choices, imposing disadva..."
          }
        }
      }
    ]
  },
  {
    "name": "Oldenborn Heritage: Stormborn Nomad",
    "pack": "heritages",
    "triggers": [
      {
        "event": "on-damage-taken",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "shallow snow, high winds, ash drifts). Ward of the Gale. Once per Soma Break, when you would take damage from an environmental source (storm, heat, cold, falling debris, pressure change), you may use your reaction t..."
          }
        }
      },
      {
        "event": "on-move",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "When you walk, the wind remembers that you used to be the reason it had a name"
          }
        }
      }
    ]
  },
  {
    "name": "Menhirkin Heritage: Igneous",
    "pack": "heritages",
    "triggers": [
      {
        "event": "on-damage-taken",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Igneous Traits Heat Memory. When you take energy damage with the fire flavor, you may bank that damage"
          }
        }
      }
    ]
  },
  {
    "name": "Echo-Diver Heritage: Tellurian",
    "pack": "heritages",
    "triggers": [
      {
        "event": "on-self-or-ally-hit",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Temporal Flinch. You cannot be surprised while conscious. Once per scene, when you or an ally within 10 feet would be hit by an attack you can see, you can use your reaction to shift yourself or that ally 5 feet"
          }
        }
      }
    ]
  },
  {
    "name": "Qliph-Scarred Heritage: Husk",
    "pack": "heritages",
    "triggers": [
      {
        "event": "on-skill-fail",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Qliphothic Saturation. Once per scene, when you fail a Soul check, you may reroll it"
          }
        }
      }
    ]
  },
  {
    "name": "Qliph-Scarred Heritage: Chthonic",
    "pack": "heritages",
    "triggers": [
      {
        "event": "on-skill-fail",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Qliphothic Saturation. Once per scene, when you fail a Soul check, you may reroll it"
          }
        }
      }
    ]
  },
  {
    "name": "Echo-Diver Heritage: Empyrean",
    "pack": "heritages",
    "triggers": [
      {
        "event": "on-self-or-ally-hit",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Temporal Flinch. You cannot be surprised while conscious. Once per scene, when you or an ally within 10 feet would be hit by an attack you can see, you can use your reaction to shift yourself or that ally 5 feet"
          }
        }
      }
    ]
  },
  {
    "name": "Echo-Diver Heritage: Abyssal",
    "pack": "heritages",
    "triggers": [
      {
        "event": "on-self-or-ally-hit",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Temporal Flinch. You cannot be surprised while conscious. Once per scene, when you or an ally within 10 feet would be hit by an attack you can see, you can use your reaction to shift yourself or that ally 5 feet"
          }
        }
      }
    ]
  },
  {
    "name": "Sephirotic Scion Heritage: Ophanic",
    "pack": "heritages",
    "triggers": [
      {
        "event": "on-agreement",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Light of Harmony. When two or more creatures within 30 feet of you are in active, explicit agreement (stated aloud), they each gain 1 temporary Integrity"
          }
        }
      }
    ]
  },
  {
    "name": "Human Heritage: Cro-Magnon",
    "pack": "heritages",
    "triggers": [
      {
        "event": "on-help-action",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Coalition Instinct. When you use the Help action on an ally's check and they succeed, the ally also recovers 1 point of Stress"
          }
        }
      }
    ]
  },
  {
    "name": "Sephirotic Scion Heritage: Seraphic",
    "pack": "heritages",
    "triggers": [
      {
        "event": "on-agreement",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Light of Harmony. When two or more creatures within 30 feet of you are in active, explicit agreement (stated aloud), they each gain 1 temporary Integrity"
          }
        }
      }
    ]
  },
  {
    "name": "Qliph-Scarred Heritage: Diabolic",
    "pack": "heritages",
    "triggers": [
      {
        "event": "on-skill-fail",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Qliphothic Saturation. Once per scene, when you fail a Soul check, you may reroll it"
          }
        }
      }
    ]
  },
  {
    "name": "Sephirotic Scion Heritage: Cherubic",
    "pack": "heritages",
    "triggers": [
      {
        "event": "on-agreement",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Light of Harmony. When two or more creatures within 30 feet of you are in active, explicit agreement (stated aloud), they each gain 1 temporary Integrity"
          }
        }
      }
    ]
  },
  {
    "name": "Sephirotic Scion (Ophanic): The Wheel Never Stops",
    "pack": "ancestries",
    "triggers": [
      {
        "event": "on-move",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "The Wheel Never Stops (1/Soma Break). When you move at least 10 feet on your turn, as a bonus action you may take either one weapon attack OR the Dash action"
          }
        }
      }
    ]
  },
  {
    "name": "Oldenborn (Stormborn Nomad): Nomad Networks",
    "pack": "ancestries",
    "triggers": [
      {
        "event": "on-search",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Route-Sense. When you spend at least 1 hour in a settlement of any size, the GM tells you one true thing about a route in or out of that settlement th..."
          }
        }
      }
    ]
  },
  {
    "name": "Menhirkin (Igneous): Magma Memory",
    "pack": "ancestries",
    "triggers": [
      {
        "event": "on-damage-taken",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Magma Memory (1/Soma Break). As a reaction when you take energy damage (any flavor) from a single source, you may bank a portion of the heat"
          }
        }
      }
    ]
  },
  {
    "name": "Oldenborn (Stormborn Nomad): Ward of the Gale",
    "pack": "ancestries",
    "triggers": [
      {
        "event": "on-damage-taken",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Ward of the Gale (1/a Soma Break). When you take damage from an attack, hazard, or effect you can see, you may use your reaction to wrap yourself in whirling air and reduce..."
          }
        }
      }
    ]
  },
  {
    "name": "Oldenborn (Stormborn Nomad): Weatherwise",
    "pack": "ancestries",
    "triggers": [
      {
        "event": "on-typed-damage-taken",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Wind-Read (1/Short Rest; recharges on Soma Break). When you would take energy damage with the lightning or cold flavor, or kinetic damage with the thunder flavor, you may use your reaction ..."
          }
        }
      },
      {
        "event": "on-damage-taken",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Wind-Read (1/Short Rest; recharges on Soma Break). When you would take energy damage with the lightning or cold flavor, or kinetic damage with the thunder flavor, you may use your reaction ..."
          }
        }
      },
      {
        "event": "on-typed-damage-taken",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Wind-Read (1/Short Rest). When you would take lightning, thunder, or cold damage, you may use your reaction to halve it"
          }
        }
      },
      {
        "event": "on-damage-taken",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Wind-Read (1/Short Rest). When you would take lightning, thunder, or cold damage, you may use your reaction to halve it"
          }
        }
      }
    ]
  },
  {
    "name": "Sephirotic Scion Core: The Higher Register",
    "pack": "ancestries",
    "triggers": [
      {
        "event": "on-agreement",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Light of Harmony. When two or more creatures within 30 ft are in active explicit agreement, each gains 1 temporary Integrity"
          }
        }
      }
    ]
  },
  {
    "name": "Oldenborn (Rustland Scavenger): Urban Scrounger",
    "pack": "ancestries",
    "triggers": [
      {
        "event": "on-search",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Markets, junkyards, half-dead malls. Your habitat.” Urban Scrounger. When you spend at least 4 hours searching any market, junkyard, ruin, or scrap economy, you can find one specific reasonable item the GM rules is p..."
          }
        }
      }
    ]
  },
  {
    "name": "Oldenborn (Rustland Scavenger): Patch & Repurpose",
    "pack": "ancestries",
    "triggers": [
      {
        "event": "on-soma-break",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Yourself included.” Patch & Repurpose. During a Soma Break, you can spend 10 minutes working on a single broken or low-charge item (a weapon, a tool, a power cell, a vehicle co..."
          }
        }
      }
    ]
  },
  {
    "name": "Circuitborn",
    "pack": "ancestries",
    "triggers": [
      {
        "event": "on-rest",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "You do not eat, drink, or sleep. You enter maintenance trance when you rest"
          }
        }
      },
      {
        "event": "on-rest",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "You do not eat, drink, or sleep. You enter maintenance trance when you rest"
          }
        }
      }
    ]
  },
  {
    "name": "Oldenborn (Rustland Scavenger): Ruin-Sense",
    "pack": "ancestries",
    "triggers": [
      {
        "event": "on-search",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "The dead cities are not silent. They are mid-sentence.” Ruin-Sense. When you spend 10 minutes examining a broken or ruined object, you can ask the GM one of: What was its last use? Who broke it? What does it still wa..."
          }
        }
      }
    ]
  },
  {
    "name": "Cryptidkin: Folklore & Frame",
    "pack": "ancestries",
    "triggers": [
      {
        "event": "on-would-drop-to-zero",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Survivor’s Instinct. When you would drop to 0 Integrity, you may instead drop to 1 Integrity and gain one level of Stress"
          }
        }
      }
    ]
  },
  {
    "name": "Human (Cro-Magnon): Ritual Memory",
    "pack": "ancestries",
    "triggers": [
      {
        "event": "on-soma-break",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Ritual Memory. During a Soma Break, you can lead your party in a 30-minute coalition ritual"
          }
        }
      }
    ]
  },
  {
    "name": "Qliph-Scarred",
    "pack": "ancestries",
    "triggers": [
      {
        "event": "on-kill",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Menace.** Proficiency with *Intimidation*. - **Perilous Boon.** When you reduce a creature to 0 HP, gain temporary HP = proficiency bonus"
          }
        }
      }
    ]
  },
  {
    "name": "Circuitborn Heritage: Synapse",
    "pack": "ancestries",
    "triggers": [
      {
        "event": "on-enemy-action",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Predictive Cache. Once per a Soma Break, when an enemy you can see takes an action, you may have anticipated it: gain reroll the lowest die on the next reaction or attack you mak..."
          }
        }
      }
    ]
  },
  {
    "name": "Echo-Diver Core: Half-Second Inheritance",
    "pack": "ancestries",
    "triggers": [
      {
        "event": "on-self-or-ally-hit",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Core Traits Temporal Flinch. You cannot be surprised while conscious. 1/scene, when you or an ally within 10 ft would be hit by an attack you can see, shift 5 ft as a reaction"
          }
        }
      }
    ]
  },
  {
    "name": "Breaker",
    "pack": "classes",
    "triggers": [
      {
        "event": "on-kill",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "2: When initiating a Siege, spend 1 less Violence OP. Tier 3: Ruin to Renewal — when you destroy a fortification, you may attempt a Faith or Economy check (DC 15) to purify the ground"
          }
        }
      }
    ]
  },
  {
    "name": "Harmony Marshal",
    "pack": "classes",
    "triggers": [
      {
        "event": "on-skill-success",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Tier 3: When you succeed at a Diplomacy check, restore +1 Loyalty in affected hex"
          }
        }
      }
    ]
  },
  {
    "name": "Human (Denisovan): Peak-Anchor",
    "pack": "ancestries",
    "triggers": [
      {
        "event": "on-forced-movement",
        "limit": {
          "window": "soma-break",
          "uses": 1
        },
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Gravity listens to you.” Peak-Anchor (1/a Soma Break). When you or an ally within 30 feet would be moved or teleported against your will, you can use your reaction to negate it"
          }
        }
      }
    ]
  },
  {
    "name": "Shadow Courier — Tier 3: Package Mastery",
    "pack": "classes/shadow_courier/class-features",
    "triggers": [
      {
        "event": "on-delivery",
        "effect": {
          "kind": "chat-prompt",
          "args": {
            "body": "Initiation 11 , your Route's signature Package type gains an additional benefit each time you successfully deliver it (in addition to the L1 doctrine delivery effect): Route of the Wayfarer Tongue (Message)"
          }
        }
      }
    ]
  }
];

async function findItemByName(name) {
  for (const pack of game.packs.values()) {
    if (pack.documentName !== "Item") continue;
    try {
      const idx = await pack.getIndex({ fields: ["name"] });
      const hit = idx.find(e => e.name === name);
      if (hit) {
        if (pack.locked) {
          try { await pack.configure({ locked: false }); }
          catch (e) { console.warn("[triggers-bulk] could not unlock", pack.collection, e); }
        }
        const doc = await pack.getDocument(hit._id);
        if (doc) return { doc, pack: pack.collection };
      }
    } catch (e) { console.warn("[triggers-bulk] index lookup failed for", pack.collection, e); }
  }
  return null;
}

const summary = { synced: [], skipped: [], errors: [], notFound: [] };

for (const job of BATCH) {
  try {
    const found = await findItemByName(job.name);
    if (!found) { summary.notFound.push(job.name); continue; }
    const { doc: liveItem, pack } = found;
    const existing = liveItem.flags?.fourththing?.triggers;
    if (Array.isArray(existing) && existing.length > 0) {
      summary.skipped.push(`${job.name} (${pack}): already has ${existing.length}`);
      continue;
    }
    if (DRY_RUN) {
      summary.synced.push(`[dry] ${job.name}: would add ${job.triggers.length}`);
      continue;
    }
    await liveItem.setFlag("fourththing", "triggers", job.triggers);
    summary.synced.push(`${job.name}: +${job.triggers.length}`);
  } catch (err) {
    summary.errors.push(`${job.name}: ${err.message}`);
    console.error("[triggers-bulk]", job, err);
  }
}

const lines = [
  `=== Bulk Trigger Stamp (${DRY_RUN ? "DRY-RUN" : "APPLIED"}) ===`,
  `Synced:    ${summary.synced.length}`,
  `Skipped:   ${summary.skipped.length}`,
  `Not found: ${summary.notFound.length}`,
  `Errors:    ${summary.errors.length}`,
  ...(summary.notFound.length ? ["", "Items not found in any pack:", ...summary.notFound.map(s => `  ✗ ${s}`)] : []),
  ...(summary.errors.length ? ["", "Errors:", ...summary.errors.map(s => `  ✗ ${s}`)] : []),
  "", "Synced (first 30):",
  ...summary.synced.slice(0, 30).map(s => `  ✓ ${s}`),
  ...(summary.synced.length > 30 ? [`  …and ${summary.synced.length - 30} more`] : []),
];
console.log(lines.join("\n"));
ChatMessage.create({
  user: game.user.id,
  content: `<pre style="font-size:0.78rem;white-space:pre-wrap">${lines.join("\n")}</pre>`,
  whisper: [game.user.id]
});
})();

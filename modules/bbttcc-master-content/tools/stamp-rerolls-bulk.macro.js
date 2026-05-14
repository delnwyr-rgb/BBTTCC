// BBTTCC — Bulk-stamp Shape B reroll grants on live ancestry/heritage/path items
// ─────────────────────────────────────────────────────────────────────────────
// Generated 2026-04-28T19:47:52.444Z by build-rerolls-bulk-macro.mjs
// Source: /tmp/reroll-survey/per-item.json + /tmp/shape-b-zombies.json
// Filtered to 60 live items (zombies excluded).
//
// Looks each item up by NAME across all Item packs. Idempotent (skips items
// that already have rerolls authored).
//
// Set DRY_RUN = true at top to preview without writes.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

const DRY_RUN = false;

const BATCH = [
  {
    "name": "Oldenborn",
    "rerolls": [
      {
        "context": "check",
        "mode": "reroll-lowest",
        "note": "on checks to interpret ruins, follow ley-lines, identify altered terrain, and…"
      },
      {
        "context": "check",
        "mode": "reroll-lowest",
        "note": "checks to interpret ruins, follow ley-lines, identify altered terrain, and se…"
      }
    ]
  },
  {
    "name": "Oldenborn (Ember-Touched): Hearth Dominion",
    "rerolls": [
      {
        "context": "save",
        "mode": "reroll-lowest",
        "vs": "vs:fear",
        "note": "on saves against fear until their next a Soma Break [TODO(adv-call)]"
      }
    ]
  },
  {
    "name": "Oldenborn (Lumenwrought): Mythic Recollection",
    "rerolls": [
      {
        "context": "defense",
        "mode": "reroll-highest",
        "vs": "vs:your man",
        "note": "on defense checks [TODO(adv-call)] against your manifestations and abilities …"
      }
    ]
  },
  {
    "name": "Furrykin (Ursid): Roar of the Old Woods",
    "rerolls": [
      {
        "context": "attack",
        "mode": "reroll-highest"
      }
    ]
  },
  {
    "name": "Human (Florensis): Opportunist",
    "rerolls": [
      {
        "context": "attack",
        "mode": "reroll-lowest",
        "note": "on attacks against distracted foes (GM: target is distracted if engaged by an…"
      }
    ]
  },
  {
    "name": "Human (Florensis): Burrow Memory",
    "rerolls": [
      {
        "context": "check",
        "skill": "athletics",
        "mode": "reroll-lowest"
      }
    ]
  },
  {
    "name": "Circuitborn (Parallax Line): Perfect Misdirection",
    "rerolls": [
      {
        "context": "check",
        "attribute": "soul",
        "mode": "reroll-highest",
        "note": "on attacks against you unless they succeed a Soul save at the start of their …"
      },
      {
        "context": "save",
        "mode": "reroll-highest",
        "note": "on attacks against you unless they succeed a Soul save at the start of their …"
      }
    ]
  },
  {
    "name": "Circuitborn (Synapse Line): Noosphere Hook",
    "rerolls": [
      {
        "context": "check",
        "mode": "reroll-lowest",
        "note": "on checks to track it (including digital/social tracking) [TODO(adv-call)]"
      }
    ]
  },
  {
    "name": "Circuitborn (Synapse Line): Memory-Print",
    "rerolls": [
      {
        "context": "check",
        "skill": "insight",
        "mode": "reroll-lowest",
        "note": "on one Investigation (Mind) (Mind), Lore (Mind), or Insight (Soul) (Soul) che…"
      },
      {
        "context": "check",
        "skill": "investigation",
        "mode": "reroll-lowest",
        "note": "on one Investigation (Mind) (Mind), Lore (Mind), or Insight (Soul) (Soul) che…"
      },
      {
        "context": "check",
        "skill": "lore",
        "mode": "reroll-lowest",
        "note": "on one Investigation (Mind) (Mind), Lore (Mind), or Insight (Soul) (Soul) che…"
      }
    ]
  },
  {
    "name": "Furrykin (Vulpin): Scent of Secrets",
    "rerolls": [
      {
        "context": "check",
        "skill": "perception",
        "mode": "reroll-lowest",
        "note": "on Insight (Soul) (Soul), Investigation (Mind) (Mind), and Perception (Mind) …"
      },
      {
        "context": "check",
        "skill": "insight",
        "mode": "reroll-lowest",
        "note": "on Insight (Soul) (Soul), Investigation (Mind) (Mind), and Perception (Mind) …"
      },
      {
        "context": "check",
        "skill": "investigation",
        "mode": "reroll-lowest",
        "note": "on Insight (Soul) (Soul), Investigation (Mind) (Mind), and Perception (Mind) …"
      },
      {
        "context": "check",
        "skill": "deception",
        "mode": "reroll-lowest",
        "note": "on Insight (Soul) (Soul), Investigation (Mind) (Mind), and Perception (Mind) …"
      }
    ]
  },
  {
    "name": "Human",
    "rerolls": [
      {
        "context": "check",
        "mode": "reroll-lowest",
        "note": "on one checks [TODO(adv-call)] of your choice each round (declare before roll…"
      }
    ]
  },
  {
    "name": "Oldenborn (Earthbound): Mountain Stance",
    "rerolls": [
      {
        "context": "check",
        "attribute": "violence",
        "mode": "reroll-lowest",
        "note": "on Violence checks [TODO(adv-call)] and Violence check, and creatures provoke…"
      },
      {
        "context": "attack",
        "mode": "reroll-lowest",
        "note": "on Violence checks [TODO(adv-call)] and Violence check, and creatures provoke…"
      },
      {
        "context": "opportunity-attack",
        "mode": "reroll-lowest",
        "note": "on Violence checks [TODO(adv-call)] and Violence check, and creatures provoke…"
      }
    ]
  },
  {
    "name": "Furrykin (Ursid): Apex Shelter",
    "rerolls": [
      {
        "context": "save",
        "mode": "reroll-lowest",
        "note": "on saves against being moved or knocked prone [TODO(adv-call)]"
      },
      {
        "context": "forced-movement",
        "mode": "reroll-lowest",
        "note": "on saves against being moved or knocked prone [TODO(adv-call)]"
      }
    ]
  },
  {
    "name": "Furrykin (Felid): Predator Patience",
    "rerolls": [
      {
        "context": "check",
        "skill": "perception",
        "mode": "reroll-lowest",
        "note": "on Perception (Mind) (Mind) and Insight (Soul) (Soul) checks [TODO(adv-call)]…"
      },
      {
        "context": "check",
        "skill": "insight",
        "mode": "reroll-lowest",
        "note": "on Perception (Mind) (Mind) and Insight (Soul) (Soul) checks [TODO(adv-call)]…"
      }
    ]
  },
  {
    "name": "Oldenborn (Lumenwrought): Moonlit Ward",
    "rerolls": [
      {
        "context": "defense",
        "mode": "reroll-lowest"
      },
      {
        "context": "attack",
        "mode": "reroll-highest"
      }
    ]
  },
  {
    "name": "Human (Erectus): Trail-Sovereign",
    "rerolls": [
      {
        "context": "check",
        "skill": "athletics",
        "mode": "reroll-lowest",
        "note": "on Athletics (Violence) (Body) and Athletics (Violence) (Violence) checks [TO…"
      },
      {
        "context": "check",
        "mode": "reroll-lowest"
      }
    ]
  },
  {
    "name": "Furrykin (Vulpin): Fable-Shadow",
    "rerolls": [
      {
        "context": "check",
        "attribute": "soul",
        "mode": "reroll-highest",
        "note": "on attacks against you unless they succeed a Soul save at the start of their …"
      },
      {
        "context": "save",
        "mode": "reroll-highest",
        "note": "on attacks against you unless they succeed a Soul save at the start of their …"
      }
    ]
  },
  {
    "name": "Human (Erectus): First Fire",
    "rerolls": [
      {
        "context": "defense",
        "mode": "reroll-lowest"
      }
    ]
  },
  {
    "name": "Circuitborn (Exo-Knight Line): Bulwark Protocol",
    "rerolls": [
      {
        "context": "defense",
        "mode": "reroll-lowest",
        "vs": "vs:moved or knocked prone",
        "note": "on defense checks [TODO(adv-call)] against being moved or knocked prone"
      },
      {
        "context": "forced-movement",
        "mode": "reroll-lowest",
        "vs": "vs:moved or knocked prone",
        "note": "on defense checks [TODO(adv-call)] against being moved or knocked prone"
      }
    ]
  },
  {
    "name": "Menhirkin",
    "rerolls": [
      {
        "context": "save",
        "mode": "reroll-lowest",
        "note": "on Constitution saves and cannot be forcibly removed from the hex against you…"
      },
      {
        "context": "forced-movement",
        "mode": "reroll-lowest",
        "note": "on ability checks you make to resist being pushed, knocked prone, or otherwis…"
      },
      {
        "context": "check",
        "mode": "reroll-lowest",
        "note": "on checks you make to build, repair, or fortify structures, siegeworks, and d…"
      },
      {
        "context": "save",
        "mode": "reroll-lowest",
        "note": "Constitution saves and cannot be forcibly removed from the hex against your w…"
      },
      {
        "context": "forced-movement",
        "mode": "reroll-lowest",
        "note": "ability checks you make to resist being pushed, knocked prone, or otherwise f…"
      },
      {
        "context": "check",
        "mode": "reroll-lowest",
        "note": "checks you make to build, repair, or fortify structures, siegeworks, and defe…"
      },
      {
        "context": "attack",
        "mode": "reroll-highest"
      }
    ]
  },
  {
    "name": "Oldenborn Heritage: Stormborn Nomad",
    "rerolls": [
      {
        "context": "check",
        "attribute": "soul",
        "mode": "reroll-lowest",
        "note": "on Presence and Soul checks to locate water, shelter, or safe passage in Dese…"
      },
      {
        "context": "check",
        "attribute": "soul",
        "mode": "reroll-lowest",
        "note": "Presence and Soul checks to locate water, shelter, or safe passage in Desert,…"
      }
    ]
  },
  {
    "name": "Menhirkin Heritage: Igneous",
    "rerolls": [
      {
        "context": "forced-movement",
        "mode": "reroll-lowest",
        "note": "on checks to resist being forcibly moved"
      },
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:exhaustion",
        "note": "on Body checks against exhaustion, long-duration physical wear, forced marche…"
      },
      {
        "context": "check",
        "skill": "stealth",
        "mode": "reroll-highest",
        "note": "on Intrigue (Stealth) checks unless you are on or in stone"
      },
      {
        "context": "check",
        "attribute": "intrigue",
        "mode": "reroll-highest",
        "note": "on Intrigue (Stealth) checks unless you are on or in stone"
      },
      {
        "context": "forced-movement",
        "mode": "reroll-lowest",
        "note": "checks to resist being forcibly moved"
      },
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:exhaustion",
        "note": "Body checks against exhaustion, long-duration physical wear, forced marches, …"
      },
      {
        "context": "check",
        "skill": "stealth",
        "mode": "reroll-highest",
        "note": "Intrigue (Stealth) checks unless you are on or in stone"
      },
      {
        "context": "check",
        "attribute": "intrigue",
        "mode": "reroll-highest",
        "note": "Intrigue (Stealth) checks unless you are on or in stone"
      }
    ]
  },
  {
    "name": "Echo-Diver Heritage: Tellurian",
    "rerolls": [
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:suffocation",
        "note": "on Body checks against suffocation, starvation, dehydration, and extreme temp…"
      },
      {
        "context": "check",
        "skill": "perception",
        "mode": "reroll-lowest",
        "note": "on Mind (Perception) checks to notice unstable structure, active traps, trigg…"
      },
      {
        "context": "check",
        "attribute": "mind",
        "mode": "reroll-lowest",
        "note": "on Mind (Perception) checks to notice unstable structure, active traps, trigg…"
      },
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "note": "on Body checks to maintain concentration on a power or manifestation"
      },
      {
        "context": "concentration",
        "mode": "reroll-lowest",
        "note": "on Body checks to maintain concentration on a power or manifestation"
      },
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:suffocation",
        "note": "Body checks against suffocation, starvation, dehydration, and extreme tempera…"
      },
      {
        "context": "check",
        "skill": "perception",
        "mode": "reroll-lowest",
        "note": "Mind (Perception) checks to notice unstable structure, active traps, trigger …"
      },
      {
        "context": "check",
        "attribute": "mind",
        "mode": "reroll-lowest",
        "note": "Mind (Perception) checks to notice unstable structure, active traps, trigger …"
      },
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "note": "Body checks to maintain concentration on a power or manifestation"
      },
      {
        "context": "concentration",
        "mode": "reroll-lowest",
        "note": "Body checks to maintain concentration on a power or manifestation"
      }
    ]
  },
  {
    "name": "Menhirkin Heritage: Sedimentary",
    "rerolls": [
      {
        "context": "forced-movement",
        "mode": "reroll-lowest",
        "note": "on checks to resist being forcibly moved"
      },
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:exhaustion",
        "note": "on Body checks against exhaustion, long-duration physical wear, forced marche…"
      },
      {
        "context": "check",
        "skill": "stealth",
        "mode": "reroll-highest",
        "note": "on Intrigue (Stealth) checks unless you are on or in stone"
      },
      {
        "context": "check",
        "attribute": "intrigue",
        "mode": "reroll-highest",
        "note": "on Intrigue (Stealth) checks unless you are on or in stone"
      },
      {
        "context": "forced-movement",
        "mode": "reroll-lowest",
        "note": "checks to resist being forcibly moved"
      },
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:exhaustion",
        "note": "Body checks against exhaustion, long-duration physical wear, forced marches, …"
      },
      {
        "context": "check",
        "skill": "stealth",
        "mode": "reroll-highest",
        "note": "Intrigue (Stealth) checks unless you are on or in stone"
      },
      {
        "context": "check",
        "attribute": "intrigue",
        "mode": "reroll-highest",
        "note": "Intrigue (Stealth) checks unless you are on or in stone"
      }
    ]
  },
  {
    "name": "Qliph-Scarred Heritage: Husk",
    "rerolls": [
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:effects that would drain",
        "note": "on Body checks against effects that would drain, wither, or corrupt your body"
      },
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:effects that would drain",
        "note": "Body checks against effects that would drain, wither, or corrupt your body"
      }
    ]
  },
  {
    "name": "Qliph-Scarred Heritage: Chthonic",
    "rerolls": [
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:effects that would drain",
        "note": "on Body checks against effects that would drain, wither, or corrupt your body"
      },
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:effects that would drain",
        "note": "Body checks against effects that would drain, wither, or corrupt your body"
      }
    ]
  },
  {
    "name": "Echo-Diver Heritage: Empyrean",
    "rerolls": [
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:suffocation",
        "note": "on Body checks against suffocation, starvation, dehydration, and extreme temp…"
      },
      {
        "context": "check",
        "skill": "perception",
        "mode": "reroll-lowest",
        "note": "on Mind (Perception) checks to notice unstable structure, active traps, trigg…"
      },
      {
        "context": "check",
        "attribute": "mind",
        "mode": "reroll-lowest",
        "note": "on Mind (Perception) checks to notice unstable structure, active traps, trigg…"
      },
      {
        "context": "check",
        "skill": "perception",
        "mode": "reroll-lowest"
      },
      {
        "context": "check",
        "attribute": "mind",
        "mode": "reroll-lowest"
      },
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:suffocation",
        "note": "Body checks against suffocation, starvation, dehydration, and extreme tempera…"
      },
      {
        "context": "check",
        "skill": "perception",
        "mode": "reroll-lowest",
        "note": "Mind (Perception) checks to notice unstable structure, active traps, trigger …"
      },
      {
        "context": "check",
        "attribute": "mind",
        "mode": "reroll-lowest",
        "note": "Mind (Perception) checks to notice unstable structure, active traps, trigger …"
      },
      {
        "context": "check",
        "skill": "perception",
        "mode": "reroll-lowest"
      },
      {
        "context": "check",
        "attribute": "mind",
        "mode": "reroll-lowest"
      }
    ]
  },
  {
    "name": "Echo-Diver Heritage: Abyssal",
    "rerolls": [
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:suffocation",
        "note": "on Body checks against suffocation, starvation, dehydration, and extreme temp…"
      },
      {
        "context": "check",
        "skill": "perception",
        "mode": "reroll-lowest",
        "note": "on Mind (Perception) checks to notice unstable structure, active traps, trigg…"
      },
      {
        "context": "check",
        "attribute": "mind",
        "mode": "reroll-lowest",
        "note": "on Mind (Perception) checks to notice unstable structure, active traps, trigg…"
      },
      {
        "context": "check",
        "skill": "insight",
        "mode": "reroll-lowest",
        "vs": "vs:becoming shaken",
        "note": "on Soul (Insight) checks and on defense checks against becoming shaken"
      },
      {
        "context": "check",
        "attribute": "soul",
        "mode": "reroll-lowest",
        "vs": "vs:becoming shaken",
        "note": "on Soul (Insight) checks and on defense checks against becoming shaken"
      },
      {
        "context": "defense",
        "mode": "reroll-lowest",
        "vs": "vs:becoming shaken",
        "note": "on Soul (Insight) checks and on defense checks against becoming shaken"
      },
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:suffocation",
        "note": "Body checks against suffocation, starvation, dehydration, and extreme tempera…"
      },
      {
        "context": "check",
        "skill": "perception",
        "mode": "reroll-lowest",
        "note": "Mind (Perception) checks to notice unstable structure, active traps, trigger …"
      },
      {
        "context": "check",
        "attribute": "mind",
        "mode": "reroll-lowest",
        "note": "Mind (Perception) checks to notice unstable structure, active traps, trigger …"
      },
      {
        "context": "check",
        "skill": "insight",
        "mode": "reroll-lowest",
        "vs": "vs:becoming shaken",
        "note": "Soul (Insight) checks and on defense checks against becoming shaken"
      },
      {
        "context": "check",
        "attribute": "soul",
        "mode": "reroll-lowest",
        "vs": "vs:becoming shaken",
        "note": "Soul (Insight) checks and on defense checks against becoming shaken"
      },
      {
        "context": "defense",
        "mode": "reroll-lowest",
        "vs": "vs:becoming shaken",
        "note": "Soul (Insight) checks and on defense checks against becoming shaken"
      }
    ]
  },
  {
    "name": "Sephirotic Scion Heritage: Ophanic",
    "rerolls": [
      {
        "context": "check",
        "skill": "perception",
        "mode": "reroll-lowest"
      },
      {
        "context": "check",
        "attribute": "mind",
        "mode": "reroll-lowest"
      },
      {
        "context": "check",
        "skill": "perception",
        "mode": "reroll-highest",
        "note": "on Mind (Perception) checks to notice things that have been perfectly still s…"
      },
      {
        "context": "check",
        "attribute": "mind",
        "mode": "reroll-highest",
        "note": "on Mind (Perception) checks to notice things that have been perfectly still s…"
      },
      {
        "context": "check",
        "skill": "perception",
        "mode": "reroll-lowest"
      },
      {
        "context": "check",
        "attribute": "mind",
        "mode": "reroll-lowest"
      },
      {
        "context": "check",
        "skill": "perception",
        "mode": "reroll-highest",
        "note": "Mind (Perception) checks to notice things that have been perfectly still sinc…"
      },
      {
        "context": "check",
        "attribute": "mind",
        "mode": "reroll-highest",
        "note": "Mind (Perception) checks to notice things that have been perfectly still sinc…"
      }
    ]
  },
  {
    "name": "Oldenborn Heritage: Rustland Scavenger",
    "rerolls": [
      {
        "context": "defense",
        "mode": "reroll-lowest",
        "vs": "vs:inhaled toxins",
        "note": "on defense checks against inhaled toxins, smoke, and industrial residue"
      },
      {
        "context": "defense",
        "mode": "reroll-lowest",
        "vs": "vs:inhaled toxins",
        "note": "defense checks against inhaled toxins, smoke, and industrial residue"
      }
    ]
  },
  {
    "name": "Menhirkin Heritage: Metamorphic",
    "rerolls": [
      {
        "context": "forced-movement",
        "mode": "reroll-lowest",
        "note": "on checks to resist being forcibly moved"
      },
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:exhaustion",
        "note": "on Body checks against exhaustion, long-duration physical wear, forced marche…"
      },
      {
        "context": "defense",
        "mode": "reroll-lowest",
        "vs": "vs:petr",
        "note": "on defense checks against petrification, forced transmutation, and forced sha…"
      },
      {
        "context": "check",
        "skill": "stealth",
        "mode": "reroll-highest",
        "note": "on Intrigue (Stealth) checks unless you are on or in stone"
      },
      {
        "context": "check",
        "attribute": "intrigue",
        "mode": "reroll-highest",
        "note": "on Intrigue (Stealth) checks unless you are on or in stone"
      },
      {
        "context": "forced-movement",
        "mode": "reroll-lowest",
        "note": "checks to resist being forcibly moved"
      },
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:exhaustion",
        "note": "Body checks against exhaustion, long-duration physical wear, forced marches, …"
      },
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "note": "Body checks to resist being knocked prone or grappled"
      },
      {
        "context": "forced-movement",
        "mode": "reroll-lowest",
        "note": "Body checks to resist being knocked prone or grappled"
      },
      {
        "context": "defense",
        "mode": "reroll-lowest",
        "vs": "vs:petr",
        "note": "defense checks against petrification, forced transmutation, and forced shape-…"
      },
      {
        "context": "check",
        "skill": "stealth",
        "mode": "reroll-highest",
        "note": "Intrigue (Stealth) checks unless you are on or in stone"
      },
      {
        "context": "check",
        "attribute": "intrigue",
        "mode": "reroll-highest",
        "note": "Intrigue (Stealth) checks unless you are on or in stone"
      }
    ]
  },
  {
    "name": "Qliph-Scarred Heritage: Diabolic",
    "rerolls": [
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:effects that would drain",
        "note": "on Body checks against effects that would drain, wither, or corrupt your body"
      },
      {
        "context": "check",
        "attribute": "presence",
        "mode": "reroll-lowest",
        "note": "on Presence checks to persuade, deceive, or intimidate creatures who are alre…"
      },
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:effects that would drain",
        "note": "Body checks against effects that would drain, wither, or corrupt your body"
      },
      {
        "context": "check",
        "attribute": "presence",
        "mode": "reroll-lowest",
        "note": "Presence checks to persuade, deceive, or intimidate creatures who are already…"
      }
    ]
  },
  {
    "name": "Sephirotic Scion Heritage: Cherubic",
    "rerolls": [
      {
        "context": "defense",
        "mode": "reroll-lowest",
        "vs": "vs:calmed",
        "note": "on defense checks against being calmed"
      },
      {
        "context": "defense",
        "mode": "reroll-lowest",
        "vs": "vs:calmed",
        "note": "defense checks against being calmed"
      }
    ]
  },
  {
    "name": "Human Heritage: Denisovan",
    "rerolls": [
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:poison",
        "note": "on Body checks against poison, environmental suffocation, and extreme altitude"
      },
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:poison",
        "note": "Body checks against poison, environmental suffocation, and extreme altitude"
      }
    ]
  },
  {
    "name": "Echo-Diver",
    "rerolls": [
      {
        "context": "save",
        "mode": "reroll-lowest",
        "vs": "vs:suffocation",
        "note": "on Constitution saves against suffocation, starvation, dehydration, and extre…"
      },
      {
        "context": "check",
        "mode": "reroll-lowest",
        "note": "on checks to notice unstable structure, active traps, trigger plates, load-be…"
      },
      {
        "context": "save",
        "mode": "reroll-lowest",
        "vs": "vs:suffocation",
        "note": "Constitution saves against suffocation, starvation, dehydration, and extreme …"
      },
      {
        "context": "check",
        "mode": "reroll-lowest",
        "note": "checks to notice unstable structure, active traps, trigger plates, load-beari…"
      }
    ]
  },
  {
    "name": "Oldenborn Heritage: Earthbound",
    "rerolls": [
      {
        "context": "defense",
        "mode": "reroll-lowest",
        "note": "on defense checks [TODO(adv-call)] to resist being knocked prone or forcibly …"
      },
      {
        "context": "forced-movement",
        "mode": "reroll-lowest",
        "note": "on defense checks [TODO(adv-call)] to resist being knocked prone or forcibly …"
      }
    ]
  },
  {
    "name": "Menhirkin (Metamorphic): The Thing You Were",
    "rerolls": [
      {
        "context": "check",
        "attribute": "intrigue",
        "mode": "reroll-lowest",
        "note": "on Intrigue checks to squeeze or slip past"
      },
      {
        "context": "check",
        "attribute": "intrigue",
        "mode": "reroll-lowest",
        "note": "Intrigue checks to squeeze or slip past"
      }
    ]
  },
  {
    "name": "Oldenborn (Stormborn Nomad): Nomad Networks",
    "rerolls": [
      {
        "context": "check",
        "attribute": "soul",
        "mode": "reroll-lowest",
        "note": "on Presence and Soul checks [TODO(adv-call)] made to find shelter, guides, su…"
      }
    ]
  },
  {
    "name": "Menhirkin (Igneous): Magma Memory",
    "rerolls": [
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:environmental cold",
        "note": "on Body checks against environmental cold"
      },
      {
        "context": "check",
        "attribute": "body",
        "mode": "reroll-lowest",
        "vs": "vs:environmental cold",
        "note": "Body checks against environmental cold"
      }
    ]
  },
  {
    "name": "Sephirotic Scion (Cherubic): The Gate Knows You",
    "rerolls": [
      {
        "context": "defense",
        "mode": "reroll-highest",
        "note": "any check or defense check related to that crossing"
      }
    ]
  },
  {
    "name": "Oldenborn (Stormborn Nomad): Ward of the Gale",
    "rerolls": [
      {
        "context": "defense",
        "mode": "reroll-lowest",
        "note": "on defense checks [TODO(adv-call)] against weather and travel hazards (sand, …"
      }
    ]
  },
  {
    "name": "Oldenborn (Stormborn Nomad): Weatherwise",
    "rerolls": [
      {
        "context": "defense",
        "mode": "reroll-lowest",
        "note": "on defense checks against weather effects (extreme cold, extreme heat, wind, …"
      },
      {
        "context": "defense",
        "mode": "reroll-lowest",
        "note": "defense checks against weather effects (extreme cold, extreme heat, wind, storm)"
      }
    ]
  },
  {
    "name": "Oldenborn (Rustland Scavenger): Salvage King",
    "rerolls": [
      {
        "context": "defense",
        "mode": "reroll-lowest",
        "vs": "vs:effects that would charm",
        "note": "on defense checks [TODO(adv-call)] against effects that would charm, frighten…"
      }
    ]
  },
  {
    "name": "Cryptidkin (Furrykin): Folklore Echo",
    "rerolls": [
      {
        "context": "check",
        "skill": "stealth",
        "mode": "reroll-lowest"
      },
      {
        "context": "check",
        "skill": "intimidation",
        "mode": "reroll-lowest"
      },
      {
        "context": "check",
        "attribute": "presence",
        "mode": "reroll-lowest"
      }
    ]
  },
  {
    "name": "Cryptidkin (Furrykin): Apex Den",
    "rerolls": [
      {
        "context": "initiative",
        "mode": "reroll-lowest"
      }
    ]
  },
  {
    "name": "Qliph-Scarred (Chthonic): What the Deep Dark Taught You",
    "rerolls": [
      {
        "context": "check",
        "skill": "stealth",
        "mode": "reroll-lowest"
      },
      {
        "context": "check",
        "attribute": "intrigue",
        "mode": "reroll-lowest"
      }
    ]
  },
  {
    "name": "Oldenborn (Rustland Scavenger): Urban Scrounger",
    "rerolls": [
      {
        "context": "check",
        "skill": "investigation",
        "mode": "reroll-lowest",
        "note": "on Investigation (Mind) (Mind) checks [TODO(adv-call)] to find concealed comp…"
      }
    ]
  },
  {
    "name": "Human (Denisovan): High-Altitude Blood",
    "rerolls": [
      {
        "context": "defense",
        "mode": "reroll-lowest",
        "vs": "vs:poison and environmental suffocation",
        "note": "on defense checks against poison and environmental suffocation"
      },
      {
        "context": "defense",
        "mode": "reroll-lowest",
        "vs": "vs:poison and environmental suffocation",
        "note": "defense checks against poison and environmental suffocation"
      }
    ]
  },
  {
    "name": "Cryptidkin (Furrykin): Pack Tongue",
    "rerolls": [
      {
        "context": "check",
        "skill": "stealth",
        "mode": "reroll-lowest",
        "note": "on the next Diplomacy (Presence), Intimidation (Presence) (Presence) (Presenc…"
      },
      {
        "context": "check",
        "skill": "intimidation",
        "mode": "reroll-lowest",
        "note": "on the next Diplomacy (Presence), Intimidation (Presence) (Presence) (Presenc…"
      },
      {
        "context": "check",
        "skill": "diplomacy",
        "mode": "reroll-lowest",
        "note": "on the next Diplomacy (Presence), Intimidation (Presence) (Presence) (Presenc…"
      },
      {
        "context": "check",
        "skill": "empathy",
        "mode": "reroll-lowest",
        "note": "on the next Diplomacy (Presence), Intimidation (Presence) (Presence) (Presenc…"
      }
    ]
  },
  {
    "name": "Echo-Diver",
    "rerolls": [
      {
        "context": "spark-id",
        "mode": "reroll-lowest"
      }
    ]
  },
  {
    "name": "Circuitborn",
    "rerolls": [
      {
        "context": "defense",
        "mode": "reroll-lowest",
        "vs": "vs:poison and disease",
        "note": "on defense checks [TODO(adv-call)] against poison and disease, and you are im…"
      }
    ]
  },
  {
    "name": "Oldenborn (Rustland Scavenger): Ruin-Sense",
    "rerolls": [
      {
        "context": "save",
        "mode": "reroll-lowest",
        "vs": "vs:airborne poisons",
        "note": "on saves against airborne poisons, toxic gas, and rad-dust"
      },
      {
        "context": "save",
        "mode": "reroll-lowest",
        "vs": "vs:airborne poisons",
        "note": "saves against airborne poisons, toxic gas, and rad-dust"
      }
    ]
  },
  {
    "name": "Cryptidkin (Furrykin): Wildframe & Instinct",
    "rerolls": [
      {
        "context": "check",
        "skill": "perception",
        "mode": "reroll-lowest"
      },
      {
        "context": "check",
        "attribute": "soul",
        "mode": "reroll-lowest"
      }
    ]
  },
  {
    "name": "Oldenborn (Rustland Scavenger): Toxic Lung Filters",
    "rerolls": [
      {
        "context": "defense",
        "mode": "reroll-lowest",
        "vs": "vs:inhaled toxins",
        "note": "on defense checks against inhaled toxins, smoke, and industrial residue"
      },
      {
        "context": "defense",
        "mode": "reroll-lowest",
        "vs": "vs:inhaled toxins",
        "note": "defense checks against inhaled toxins, smoke, and industrial residue"
      }
    ]
  },
  {
    "name": "Human (Cro-Magnon): Ritual Memory",
    "rerolls": [
      {
        "context": "defense",
        "mode": "reroll-lowest",
        "vs": "vs:shaken",
        "note": "on defense checks [TODO(adv-call)] against being Shaken"
      }
    ]
  },
  {
    "name": "Qliph-Scarred",
    "rerolls": [
      {
        "context": "check",
        "mode": "reroll-highest"
      }
    ]
  },
  {
    "name": "Circuitborn Heritage: Synapse",
    "rerolls": [
      {
        "context": "attack",
        "mode": "reroll-lowest",
        "note": "on the next reaction or attack you make against that enemy this round [TODO(a…"
      }
    ]
  },
  {
    "name": "Oldenborn (Stormborn Nomad): Weatherwise",
    "rerolls": [
      {
        "context": "save",
        "mode": "reroll-lowest",
        "note": "on saving throws against weather effects (extreme cold, extreme heat, wind, l…"
      },
      {
        "context": "save",
        "mode": "reroll-lowest",
        "note": "saving throws against weather effects (extreme cold, extreme heat, wind, ligh…"
      }
    ]
  },
  {
    "name": "Human (Cro-Magnon): First Fire",
    "rerolls": [
      {
        "context": "defense",
        "mode": "reroll-lowest",
        "vs": "vs:shaken or exhausted",
        "note": "on defense checks [TODO(adv-call)] against being Shaken or exhausted"
      }
    ]
  },
  {
    "name": "Circuitborn",
    "rerolls": [
      {
        "context": "save",
        "mode": "reroll-lowest",
        "vs": "vs:poison and disease",
        "note": "on saving throws against poison and disease, and you are immune to magical sleep"
      },
      {
        "context": "check",
        "mode": "reroll-lowest",
        "note": "on checks to identify surveillance, hidden speakers, encoded messages, or noo…"
      },
      {
        "context": "save",
        "mode": "reroll-lowest",
        "vs": "vs:poison and disease",
        "note": "saving throws against poison and disease, and you are immune to magical sleep"
      },
      {
        "context": "check",
        "mode": "reroll-lowest",
        "note": "checks to identify surveillance, hidden speakers, encoded messages, or noosph…"
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
          catch (e) { console.warn("[rerolls-bulk] could not unlock", pack.collection, e); }
        }
        const doc = await pack.getDocument(hit._id);
        if (doc) return { doc, pack: pack.collection };
      }
    } catch (e) { console.warn("[rerolls-bulk] index lookup failed for", pack.collection, e); }
  }
  return null;
}

const summary = { synced: [], skipped: [], errors: [], notFound: [] };

for (const job of BATCH) {
  try {
    const found = await findItemByName(job.name);
    if (!found) { summary.notFound.push(job.name); continue; }
    const { doc: liveItem, pack } = found;

    const existing = liveItem.flags?.fourththing?.rerolls;
    if (Array.isArray(existing) && existing.length > 0) {
      summary.skipped.push(`${job.name}: already has ${existing.length} grant(s)`);
      continue;
    }
    if (DRY_RUN) {
      summary.synced.push(`[dry] ${job.name}: would add ${job.rerolls.length}`);
      continue;
    }
    await liveItem.setFlag("fourththing", "rerolls", job.rerolls);
    summary.synced.push(`${job.name}: +${job.rerolls.length}`);
  } catch (err) {
    summary.errors.push(`${job.name}: ${err.message}`);
    console.error("[rerolls-bulk]", job, err);
  }
}

const lines = [
  `=== Bulk Reroll Stamp (${DRY_RUN ? "DRY-RUN" : "APPLIED"}) ===`,
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

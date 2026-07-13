# Surge Powers

A shared heroic-resource economy for **D&D 5e** on Foundry VTT (v12–v13, dnd5e 4.x–5.x).

## How it works

- **Bank Surge by rolling well.** Whenever a character's *kept* d20 (attack, save, ability
  check, skill, or concentration) lands at or above the threshold (**default 15**, configurable),
  they bank **+1 Surge**. Advantage and disadvantage flow in naturally — only the kept die counts.
- **Natural 20s explode.** A nat 20 re-rolls a bonus d20, chaining +1 extra Surge per further 20
  (toggleable).
- **Long rests refill.** A long rest banks +proficiency Surge as a baseline (toggleable).
- **Pool cap** is 2× proficiency bonus (minimum 4). Override per actor via the
  `flags.surge-powers.maxOverride` flag.
- Surge is a **separate pool** — it never modifies a d20 total.

## Spending it

Open the Surge Powers menu from the **⚡ token HUD button** or the **⚡ n/max button in the
character sheet header** (left-click either one). **Right-click** either button to edit the
pool directly — current Surge and the max (leave max blank for automatic). 23 universal
powers across four buckets — ⚔ Offense, 🛡 Defense, ✚ Restoration, ✦ Narrative — from 1⚡
(Snap Strike, Brace, Bonus Die) up to 10⚡ (Final Argument, Phoenix). Scaling effects grow
with the character's **Proficiency Bonus** (heals add Prof, DR equals Prof, auras reach
Prof×5 ft, damage riders add Prof d6), and the strongest entries unlock at a minimum Prof
(+3 / +4 / +6).

Effects that dnd5e supports natively (healing, temp HP, AC bonuses, Active Effects, initiative
repositioning) apply immediately. The rest arm a one-shot flag and post a clear chat card the
GM applies — flag-and-narrate.

**Optional integrations** (no hard dependencies): with **midi-qol** the advantage/disadvantage
flags become real roll automation; with **DAE** next-attack effects expire after exactly one
attack (`1Attack` special duration). Without them, effects remain visible, labeled markers.

## Settings

| Setting | Default | |
|---|---|---|
| Surge threshold | 15 | Kept d20 ≥ this banks +1 (15 ⇒ ~30% of rolls) |
| Natural 20s explode | on | Chain bonus Surge on nat 20s |
| Long rest refill | on | +proficiency Surge on a long rest |
| Gain notifications | on | Toast on Surge gain |

## API

`game.surgePowers` — `get(actor)`, `max(actor)`, `grant(actor, n)`, `spend(actor, n)`,
`set(actor, n)`, `openMenu(actor)`, `editPool(actor)`, `menu`, `applyEntry(actor, entry)`,
`profOf(actor)`.

---

Extracted from the **Bad Eden** campaign system's Surge Unification model (the universal
table; class kits live in the full system).

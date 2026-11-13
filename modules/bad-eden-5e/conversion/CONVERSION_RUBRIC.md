# The Bad Eden conversion rubric (RFI → D&D 5E)

**v1.12.0 · 2026-11-13** (Surge repricing mirror: heals × proficiency bonus; earlier: v1.11.0 D&D port review fix round C40–C50, C64, C72, P7). This is the canonical rulebook for turning a Bad Eden mechanic written for RFI (the `fourththing` system) into its D&D 5E twin. The machine copy is `rubric.json` beside this file; the build lint, the converter (`bin/ft-convert-5e`) and the parity check (`bin/ft-lint-parity`) read that file. Change the JSON and this page together.

✅ = ruled by Dave · ⏳ = drafted, ruling owed.

## The rule

Mechanics are written **once**. Anything both flavours share is authored in RFI canon (`bbttcc-master-content/packs/_source` and the engine banks) and flows through the converter into `modules/bad-eden-5e/content/`. Content that only exists in D&D (the SW5E-derived classes and powers) lives in `content/` and is marked `origin: 5e`. Every converted document carries `flags.bad-eden-5e.rfi = { id, pack, hash }` so the parity lint can report **missing** (no 5E twin), **stale** (the RFI source changed) and **orphaned** (the source is gone).

Shared engines that need no conversion: factions and OP, hexes and travel, marks, radiation, Spark, Surge and the Paths, the Strategic Turn.

## Units and recovery

| RFI | D&D | |
| --- | --- | --- |
| 1 square | 5 feet | ✅ |
| Soma Break | long rest | ✅ |
| Scene Break · 1/Scene | short rest | ✅ |
| tier uses / Soma Break | uses = proficiency bonus, per long rest (`@prof` / `lr`) | ✅ |
| +tier · = your tier · rank bonus | + your proficiency bonus | ✅ |
| "a small bonus" / "+1 rank" with no rule behind it | +2 (+1d4 where the source rolls a die) | ✅ |
| per campaign start · per Strategic Turn | unchanged | ✅ |

## Tracks and defenses

| RFI | D&D | |
| --- | --- | --- |
| Integrity · temporary Integrity | hit points · temporary hit points | ✅ |
| a level of Stress · Strain | a level of exhaustion | ✅ |
| Stress as *points* (old text) | 1d4 psychic, or temp HP = prof when it is a gain | ✅ |
| Clarity · Noise | keep the words; a Clarity bonus becomes a Flow-point bonus | ✅ |
| Radiation | keep — `bbttcc-radiation` runs in both | ✅ |
| Guard | AC | ✅ |
| Evasion · Resolve | Dexterity save · Wisdom save | ✅ |
| defense check vs X | saving throw of the mapped ability (poison / disease / environment → Constitution) | ✅ |
| "your DC" | 8 + proficiency bonus + the feature's ability | ✅ |

## Abilities and skills

| RFI faculty | D&D ability |
| --- | --- |
| Violence | Strength |
| Intrigue | Dexterity |
| Body | Constitution |
| Mind | Intelligence |
| Soul | Wisdom |
| Presence | Charisma |

"Lineage Lean toward X" → "Ancestry Lean: *ability*"; no fixed score bonus in either flavour (backgrounds carry the increases). ✅

| RFI skill | D&D | RFI skill | D&D |
| --- | --- | --- | --- |
| Brawl · Melee | melee attack rolls | Lore | History |
| Firearms | ranged attack rolls | Occult | Arcana |
| Athletics | Athletics | Faith · Ritual · Meditation | Religion |
| Stealth | Stealth | Perception | Perception |
| Hacking | tinker's tools (Arcana for machines) | Performance | Performance |
| Tinkering | tinker's tools | Plating | smith's tools |
| Piloting | vehicles | Fitting | carpenter's tools |
| Streetwise | Investigation (Persuasion in a town) | Bracing | mason's tools |
| Diplomacy | Persuasion | Empathy · Insight | Insight |
| Intimidation | Intimidation | Investigation | Investigation |

✅ Ruled 2026-10-07.

## Ranks and rolls

| RFI | D&D | |
| --- | --- | --- |
| Untrained · Trained · Expert · Master | nothing · proficiency · expertise · expertise + **Mastery** | ✅ |
| gain a skill rank | proficiency → expertise → Mastery, one step up | ✅ |
| **Mastery** | on checks with that skill or tool, a d20 roll of 9 or lower counts as 10 (`scripts/mastery.js`; one Active Effect flag per skill) | ✅ |
| 2d10 | d20 | ✅ |
| reroll the lowest die | advantage (an Active Effect when unconditional, text when conditional) | ✅ |
| reroll the highest · 3d10 keep lowest · Imposed | disadvantage | ✅ |
| banked reroll | banked advantage: the next d20 roll (yours, or handed to an ally) has advantage | ✅ (rider automation later) |
| exploding d10 | kept as a stated rule: "on a 10, roll again and add" | ✅ |
| minimum roll threshold | treat any 1 on the die as a 2 | ✅ |

## Tiers

Tier I at creation (level 0), Tier II at 5th, Tier III at 11th, Tier IV at 17th — RFI's own ladder (1–4 / 5–10 / 11–16 / 17+) and D&D's tiers of play. ✅

## Damage and conditions

| RFI | D&D | RFI | D&D |
| --- | --- | --- | --- |
| kinetic | bludgeoning, piercing, slashing (or the weapon's type) | sephirotic · qliphothic | kept — registered damage types |
| electrical | lightning | radiation | the radiation ladder only, never a damage type ✅ |
| thermal | fire / cold by flavour | energy (legacy) | the flavour's type |
| chemical | acid | sonic (SW5E) | thunder |
| poison · psychic | the same | true | can't be reduced or prevented |

| RFI condition | D&D | RFI condition | D&D |
| --- | --- | --- | --- |
| Shaken | frightened ✅ | Imposed | disadvantage on the next attack or save ✅ |
| Strained | exhaustion ✅ | Staggered | status `be5e-staggered` + speed ×½, −2 to attacks — the same Active Effect on the creature lane and the spell lane ✅ C42 2026-10-31 |
| Calmed | charmed, can't act violently | Compelled | charmed + must spend an action on the directive |
| Burning | 1d4 fire at the start of each turn | Dying | 0 HP, death saves |
| Scarred | keep the mark; −1 Flow point per 5 of your Flow maximum (min 1) to end of scene ✅ | Submerged / Drowning / Crushing | the 5E underwater and suffocation rules |
| blinded · prone · restrained · charmed · surprised | the same | jolted (SW5E) | no reactions until its next turn |

## Engine effects → sheet automation

**Path-discipline shifts (✅ ruled 2026-10-07, built):** the RFI `flags.fourththing.discipline` block (manifestation-discipline.js) becomes Active Effects on the feat — Clarity max +n → `flags.bad-eden-5e.bonus.points` +n on every tradition the character casts; concurrency +n → dnd5e concentration limit +n; upkeep ×½ → advantage on concentration saves, ×¾ → +2 on them; reach discount n → each upcast step costs n fewer points (`flags.bad-eden-5e.discount.upcast`, never below the base cost); misfire band shift → text (5E casting has no misfire table). A *mode* (Sentence / Refraction / Walking Lane / Sealed Pact) becomes a second effect, off by default, named "<Technique> — <stance> held", which the player toggles while the stance is held; Sealed Pact flips automatically with the surge-powers buff. **Clarity techniques:** Enduring Focus → advantage on concentration saves; Frugal Caster → level-1 powers cost 1 less (`discount.level1`); Reclamation → once per short rest, one level of exhaustion for 2 points per 5 of the pool max back; Overreach and Signature Ascendant stay text.

| RFI engine kind | D&D |
| --- | --- |
| `rerolls[]` unconditional | Active Effect: `system.skills.<key>.roll.mode` / `system.abilities.<abl>.save.roll.mode` / `…check.roll.mode` ADD 1; initiative → `system.attributes.init.roll.mode` |
| `rerolls[]` with `vs` / `when` | text |
| `grants.resistances` · `immunities` · `conditionImmunities` | Active Effect on `traits.dr` · `di` · `ci` (types through the damage table) |
| `ITEM_APTITUDE_GRANTS` / skill grants | a Trait advancement (`skills:<key>` / `tool:<key>`; `choice` → a choice) |
| `passives.movement.climbEqualsWalk` | Active Effect: climb = walk |
| `discipline.passive.clarityMaxBonus` | ⏳ Flow-point bonus flag |
| `triggers[]` chat prompts | text (the prompt body is the rule) |
| `resourceGrants[]` (OP) | verbatim text as a "Strategic Hooks" feature |
| `_tq.temp(n)` | a heal activity for temporary hit points (`@prof`) |
| `_tq.bank(n)` · `_tq.impose` | `flags.bad-eden-5e.riders` → `scripts/riders.js`: banked advantage on the receiver's next d20 test · the target is **Imposed** (status `be5e-imposed`: next attack roll or saving throw at disadvantage, then it clears) ✅ 2026-10-07 |
| `strain.gain(n)` | `riders.strain` → n levels of exhaustion ✅ |
| RFI uses / recovery | dnd5e uses with the recovery table |

## Gear (drafted for the gear lane)

Weapons: damage formula → a damage part (flat +N dropped unless enhanced), type through the damage table, Violence → Str (Dex if finesse), Intrigue → Dex ranged, ranges ×5 ft, tags → properties (two-handed, finesse, light, heavy, reach, thrown, loading, attunement), manifestation tier → rarity (uncommon / rare / very rare / legendary). Martial = tagged heavy, two-handed, reach, or a firearm beyond a pistol; the rest simple ✅.
Armor: Guard bonus → AC by band (light 10+, medium 12+, heavy 14+; `armorSkill` fitting / plating / bracing decides the band) ✅; Evasion / Resolve bonuses → Dex / Wis save-bonus Active Effects at full value (the +3..+5 on legendary vestments stand ✅ 2026-10-07); resistances → Active Effects. Prices stay in marks ✅ (dnd5e's price field labelled marks). `flags.bbttcc` (hazardResist / radiation.tierDelta / radiationResist / darkness*) rides on every twin and is part of the parity hash — `api.radiation protectionFor` and the darkness engine read it on either system ✅ C64 2026-10-31. Firearms: `firearmR` + the `fir` property come from one test, RFI's firearms skill (a bow by name and rig-mounted guns excluded); no `amm` anywhere until an ammunition consumable exists in the pack ✅ P7 2026-10-31.

**Consumables (✅ C46 ruled 2026-10-31):** the RFI "On use: …; Charges: N" block becomes real dnd5e activities, each spending one use (Charges → uses.max, autoDestroy at 0): Restore NdM(+K) Integrity → heal; Restore / Reduce N Stress → heal, temporary hit points = `@prof`; Inflict N Stress → Nd4 psychic to yourself; Cure <condition> → utility + `flags.bad-eden-5e.cure` [status] with the chat line naming what ends (the runtime hook that removes the status is owed in `scripts/`); Restore N Clarity → utility + `flags.bad-eden-5e.flow` N. Noise · Radiation · Surge · FrameDice · BloodDebt · mutations → a utility whose chat line names the op for the GM (no D&D engine yet) and a needs row. **Wondrous items:** an unconditional "resistance to X" → a transfer Active Effect on `traits.dr`; every other promised mechanic stays honest prose and is listed in `_needs-human/gear.md` for an override.

Rigs → the vehicle lane: `attributes.ac = { flat: rigAcFor(bracket, tier), calc: "flat" }` and the damage threshold from `bbttcc-core/scripts/economy.constants.js` (the tables the in-world builder mints from); condition words in RFI defense lists ("fear") → `traits.ci`, never a damage type; travel domains → vehicleType land / air / water / space ✅ C47 2026-10-31.

## Creatures (drafted for the monster lane)

**Source = `packs/_source/npcs`** (the lineage-flagged actors, items embedded), like every other lane — `conversion/sources/npcs-monsters.jsonl` is a fallback only, refreshed with `bin/ft-dump-pack npcs`, and `--parity creatures` prints its drift from canon ✅ C40 2026-10-31. **Numbers (✅ C45 ruled 2026-10-31):** hp = Integrity, AC = Guard, verbatim; the **CR label is derived** from what lands on the sheet (DMG p.274 — defensive CR from the hp band shifted 1 per 2 AC off the band, offensive CR from damage/round shifted 1 per 2 attack-bonus points, averaged, snapped to a legal CR; `CR_ROWS` in convert-5e.mjs) so the number the GM sees matches the stat block; the old Tier 1–4 → CR 1–4 / 5–8 / 9–13 / 14+ table is now only the band a needs-row compares against (Tier IV bosses land CR 8–9 with their 135 Integrity). The threat chassis still sets strikes, legendary actions and the per-tier damage bonus. Power saves use the intent's own ability (Mind → Intelligence, Presence → Charisma; no fold to Wisdom) ✅ C48; condition words in defense lists → `traits.ci` ✅ C47; the RFI stat idiom in item prose ("Strike. reach 1 square., one target. Damage: 2d10 kinetic + violence", "Hit: … + violence; half on success", "Fail: <dice> type + Condition", "Cost. 2 Clarity, +2 Noise", "Damage goes to Stress") is stripped before the rubric runs — the activity carries the dice, the rider sentence and Dave's flavour line stay ✅ C43; `npcAuto` condition objects render as words with their duration ✅ C41. Evasion / Resolve → Dex / Wis save proficiency; attributes 1–5 → scores 10 + 2×value ✅; skills through the rank table; attacks → weapon items through the gear table; lineage → creature type; bounties and hire stay in marks. **`npcAuto` rules (the monster rider slice, ✅ ruled + shipped 2026-10-07):** *use* + condition/save/damage → a save (or utility) activity on the feature with the condition as an applied effect (Staggered = status `be5e-staggered`: speed ×½, −2 to attacks; Shaken → frightened; Calmed/Compelled → charmed; a weapon's *kinetic* = its own damage type); *hit* + damage/condition/no-reactions/ongoing damage → riders on the weapon's attack activity; *saveFail* → effects on the weapon's save activity (a second "— condition" save activity when the weapon only attacks); *attack* + reroll → chat flavour; *turnStart · selfTurnStart · bloodied · zero · struck · attacked · damaged · allyDamaged* → text + `flags.bad-eden-5e.reminders` whispered to the GM at the moment by `scripts/reminders.js`; *radiation · morale · ward · tempIntegrity · heal · prompt* → chat flavour on the activity. Budgets are checked against `threat-chassis.js` and the table-kit encounter sim.

## Surge (shared engine, mirrored by hand) ✅ Dave 2026-11-13

Surge has no converter lane: the D&D twin is `surge-powers` (the universal menu in `scripts/surge-powers.js`, Path powers in `data/paths.json`) and the `dnd5e-table-kit` riders. When the RFI menu (`_FT_SURGE_MENU`) is repriced, mirror it there against this table. Dave: *"when I say proficiency bonus I mean in the BadEden5E system. In RFI it's Tier level."*

| RFI | D&D | |
| --- | --- | --- |
| any Tier-scaled Surge number | the proficiency bonus (PB) | ✅ |
| Tier gate I · II · III · IV | minProf none (PB 2) · 3 · 4 · 6; cost cap 4 · 6 · 8 · 10 | ✅ |
| Stitch · Field Patch 2d6 × Tier | 2d6 × PB (`2d6*@prof`) | ✅ |
| Rallying Cry · area heals 1d6 × Tier | 1d6 × PB each | ✅ |
| class heal by price 1 · 2–3 · 4+ | 1d6 · 2d6 · 3d6 × PB, priced by the **5E** cost; a doctrine that heals more keeps its + PB | ✅ |
| Doomstrike +Tier d6, sixes explode | +PB d6x | ✅ |
| Tier Surge +Tier to hit and damage | Power Surge: +PB to hit and +PB damage | ✅ |
| Crowning Blow critical ×2 | auto-hit, dnd5e critical, dice maximised | ✅ |
| Final Argument | auto-hit critical, +PB d6, dice maximised, ignores resistance | ✅ |
| damage riders wait for a hit | native: the damage roll consumes them, and it only follows a hit | ✅ |

## Vocabulary the lint refuses

Soma Break · Scene Break · Integrity · reroll the lowest · reroll(s) the highest · reroll-the-highest · keep-lowest-2 · N squares · aptitude · skill rank · defense check · Violence/Intrigue/Presence/Body/Mind/Soul check · VIO/INTR/PRE/BOD/MND/SOU · tier uses · +tier · level of Stress · kinetic/energy damage · Cast DC · Resolve DC · (Stress) · Damage goes to Stress · `Damage: NdM` stat lines · N OP / Operations Points (quantities are marks: the rows `\10 marks` append a 0 — 1 OP = 10 marks, the RFI ancestry cards say "+20 Intrigue marks") · the sheet scaffolding ("Per-Use Ability", "Click this feature"). Kept on purpose: Spark, Yesod, Sephirot/Qliphoth, noosphere, the Shattering, hex, marks, Strategic Turn, OP as a *name*, Clarity, Noise, Surge, Path, Doctrine, Soul-Smith (a Path name — the bare Body/Mind/Soul/Presence rows skip hyphen compounds, "(10 Mind)" channel prices, "this Presence" and anything priced in marks ✅ C44 2026-10-31). Manifestations are dnd5e spells (10-31): the vocabulary says spell / spells, never "powers" ✅ C49. `bin/ft-lint-units` now walks `modules/bad-eden-5e/content/**/*.json` too (rule U7) ✅ C72.

**Damage-only manifestations (✅ C50 ruled 2026-10-31):** a harm that deals damage with no state never auto-hits — "vs Evasion" in the RFI sentence → a ranged spell attack (melee on touch); otherwise a saving throw from the defense table (the named defense, else Dexterity for Integrity-track damage, Wisdom for Stress-track), half damage on a success, and the −2 AC / −2 saves rider lands only on a hit or a failed save (Keystone Verdict → Dex save, The Unstitching → Wis save).

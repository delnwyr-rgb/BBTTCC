# RFI Manifestation Magnitude — v1.2 (the points budget)

**Status:** Built 2026-11-08 (Manifestation Engine teeth, Phase B). Numbers approved by Dave on the "Rubric v1.2" tab (R01–R12). **Supersedes v1.1** — v1.1's per-tier bands ("the highest band wins") are retired; the *Investment overrides* section of v1.1 (stances, Surge, Blood Debt, cost) still describes the cast-time rules and is not repeated here.
**Why:** Dave, P25: "a system of weights and costs." Under v1.1 every dimension picked its own tier and the highest won, so range alone could make a pistol T2, a 30-ft lantern T4, and paying Stress changed nothing. Now what a manifestation **does** adds points, what its wielder **pays on top** takes points off, and the **net** sets the tier.
**Where it lives:** `ftManifestationMagnitude(item, kind, owner)` in `systems/fourththing/module.js` (public as `game.fourththing.manifestation.magnitude`). The Engine Review step, the derived-tier sheet hook, both item sheets' "⚖" line and the re-score macro all call it, and it reads every field through the runtime's own normalizers — so the score is always what a cast or a Strike actually does.

---

## The ladder

| Net points | Tier |
|---|---|
| 0–3 | **T1** |
| 4–5 | **T2** |
| 6–7 | **T3** |
| 8+ | **T4** |

Net = the sum of every line below, never below 0. Then the **floors**: a chain is at least **T2**; a hex-wide manifestation is **T4**.

Tier still sets everything downstream: the Clarity it costs (T1 1 · T2 2 · T3 3 · T4 4), the save-DC ladder (11 + tier×2 + channel), the misfire column, and the gate (a Form above its wielder's tier is inert; a Working above it needs a reach).

---

## Weights (add)

| What it does | Points |
|---|---|
| **Damage or healing** — primary roll + Additional Damage Dice (+ a foe weapon's on-hit rider damage), by average | **2 per 3.5** (one d6), rounded, at least 1 if anything rolls: 1d6 = 2 · 1d8 = 3 · 2d6 = 4 · 3d6 = 6 · 4d6 = 8. A flat bonus counts; the Intent faculty add **never** counts (P39). Extra dice count only when they roll: beside a Strike, a power's damage roll, or joined to a power's heal. |
| **Clarity / Noise set amount** (the pool row) | **1 per point** moved (\|Clarity\| + \|Noise\|) |
| **Range** | ≤30 ft **0** · 31–120 ft **1** · beyond 120 ft (incl. unlimited) **2**. Read exactly as the range check does (`_ftItemRangeFt`: rangeFt, else a legacy weapon range / Baseline; 0 = touch). Cones, lines and hex-wide take no range. |
| **Area** — burst radius, or cone / line length | ≤30 ft **0** · 31–120 ft **1** · beyond **2** (Dave R03: "30 radius should be baseline like range"). Area sizes go up to 600 ft (the cap was 120, which made "beyond" unreachable — fixed 2026-11-08). |
| **Hex-wide** (area shape `hex`: every token on the scene, sorted by disposition) | **tier floor 4** |
| **Conditions** | minor **1** (Prone, Shaken, Staggered, Calmed, Scarred, Imposed) · major **2** (Burning, Restrained, Blinded, Charmed, Compelled, Surprised, Stunned) |
| … the target gets a save against them | the conditions' total is **halved** (rounded up). "Gets a save" = a Save or Contested working, a Form / attack working with the creator's hit save, a foe's save-first strike or on-hit rider save. |
| … they last the scene, or until saved | **+1** |
| … the target saves each round to shake them off | **−1** (until-saved always saves each round, so it nets 0) |
| … they land on a hit with **no** save (attack roll, no hit save) | **+1** (in place of the halving) |
| **Harm that lands with no roll at all** (Auto shape, not beneficial, no hit save — damage, a condition, a Clarity drain / Noise add, or a debuff ward) | **+1** |
| **Wards / buffs** | ceil(stat points ÷ 2) **+ 1 per resistance + 2 per immunity** |
| **Chain** | the dice points of count × average(chain formula) + the carried conditions' weight **once** (full weight — not halved; fixed 2026-11-08 to match the approved spec). **Tier floor 2.** An area never chains. |
| **Conditional damage** (vs creature type) | **half** of those rows' dice points (rounded up) |
| **Bonus-action or Reaction** — a Form that strikes as one, a working its author set to Bonus or Reaction (scored as authored, whatever stance it is cast in) | **+1** |
| **Fixed save DC** — foe-owned or unowned items only (a Steward's DC is always the ladder — P02 / R12) | DC ≤15 **0** · ≤17 **+1** · ≤19 **+2** · higher **+3** |
| **Miss retaliation** (`manifestation.onMissRetaliation` — added 2026-11-08 for Spark Vow / Frame Drift): damage that lands on whoever misses (scope `self`: anyone who misses the bearer; scope `vow-target`: the vowed target's next miss against the caster or an ally) | **half** its dice points, rounded up — it needs a miss (conditional, like vs-creature-type damage). 2d8 = 5 → **3**; 1d6 = 2 → **1** |
| **Attacks against the bearer at disadvantage** (`manifestation.attackersDisadvantage`) | **+1** |
| **Damage-type conversion** (`manifestation.damageConvert` {from, to} — Hammer-Bright Ward's kinetic → electrical) | **0** (it changes which resists bite, not how much lands) |

Marks (2026-11-08): the three rows above ride one Active Effect per cast (`flags.fourththing.manifestationMark`) — on the caster for a self-range working, on the target for a vow. A vow lasts the scene and one caster holds one vow (recasting moves it); `markDuration` "next-turn" ends at the start of the caster's next turn, "scene" at the scene boundary (blank follows stability: instant → next turn, sustained / bound → scene). A ward row may carry `appliedEffects.condition` "martial-form": its Guard holds only while a melee / unarmed Form is in hand (scored as an ordinary ward — the condition is a cost the scorer doesn't discount).

**Worked (the six foe powers, 2026-11-08):** Bough of Just Sentence 2d6 psychic + Calmed, Soul save negates, 30 ft: +4 +1 = 5 → **T2**. Hollow Hunger 15-ft burst on itself, 2d6 qliphothic + Shaken, Soul save: +4 +1 −2 (its 2 Noise) = 3 → **T1**. Rainbow Cascade the same with Charmed: +4 +1 = 5 → **T2**. Spark Vow 2d8 vow at 60 ft: +3 +1 = 4 → **T2**. Frame Drift 1d6 per miss + disadvantage: +1 +1 = 2 → **T1**. Hammer-Bright Ward Guard +1 + kinetic → electrical: +1 → **T1**.

## Costs (subtract)

| What its wielder gives | Points |
|---|---|
| **Signature** (`isSignature`) — "the Sig should be Extra" (P29 / R10) | **−2** — a Signature gets 2 free points: the same tier with a little more on it |
| **Extra cost** on top of the tier's Clarity (P16 / R04 / R09) | Noise **1 : 1** · Strain **1 : 1** · Stress **at half** (2 Stress = 1 point, rounded down) · **capped at 3** in all. **Surge never counts** ("keep surge out of the resource pool"). |

Ascendant (2026-11-08): the Ascendant stance unlocks by **Enlightenment**, not tier — a Steward needs **Understanding** or higher (Enlightened); Qliphothic never unlocks it. One constant, `FT_ASCENDANT_ENLIGHTENMENT`. Foes keep the old rule (tier 3+) or reach it the same way. It is a cast-time stance, so it never scores.

Not scored (on purpose): the Intent faculty add, the item's shape / Form Type, stability (except that a Sustained / Bound item's conditions last the scene by default — that's the +1 above), nonlethal, a cast-time stance step (Chaotic / Ascendant +1 die, Hermetic one-tier reach — those are one cast, never the item).

---

## Worked examples (each scored by the built scorer — `PHASE_B_RESULTS.md`)

**1d6 + Blinded, the target gets a save → T1** (Dave R04/R05: "1d6 damage + blindness with a save to resist the effect would be tier 1")
- +2 damage 1d6 (avg 3.5)
- +1 Blinded — the target gets a save (half of 2)
- **Net 3 → T1.** The same Form with *no* save: +2 damage, +2 Blinded, +1 lands on a hit with no save = 5 → **T2**.

**Wrath-Brand — 1d6 fire → T1** (Dave 11-08: "a weapon that does fire damage", no states)
- +2 damage 1d6 (avg 3.5) — thermal, so it hits Guard; the + Violence faculty add is free
- **Net 2 → T1.** (The pre-fix 2d6 + Burning-on-hit-with-no-save version scored 4 + 2 + 1 = 7 → T3.)

**A hex-wide working → T4** (Dave P01: "a manifestation that impacted an entire hex … sounds like a Tier 4 option")
- +2 damage 1d6 (avg 3.5) to every non-friendly token on the scene, Body save
- floor T4 — hex-wide
- **Net 2, but hex-wide → T4.**

**The dice ladder:** a 1d6 attack is 2 points (T1), 2d6 is 4 (T2), 3d6 is 6 (T3), 4d6 is 8 (T4). Add 60 ft of range to the 2d6 bolt: 5 → still T2.

**Paying for it:** a 4d6 Signature that also costs 2 Stress: +8 damage, −2 Signature, −1 pays 2 Stress = **5 → T2**.

**Chains:** 1d6 + a ×3 1d4 chain: +2 damage, +4 chain (avg 7.5) = 6 → **T3**; a chain is never below T2. Carrying a condition adds its full weight: 1d6 attack + Blinded (no save on the hit) with a ×2 1d4 chain carrying it: +2 damage, +2 Blinded, +1 no save, +5 chain (3 dice + 2 carried) = 10 → **T4**.

**Big areas and Bonus actions (2026-11-08 fixes):** 1d6 save in a 150 ft sphere: +2 damage, +2 area = 4 → **T2**. 2d6 attack, 60 ft, cast as a Bonus action: +4, +1 range, +1 Bonus = 6 → **T3**.

**Wards:** Guard +2 = ceil(2/2) = 1 → **T1**. Guard +5 and resist kinetic, at 60 ft: +3 +1 +1 = 5 → **T2**. Guard +10 and immune kinetic: +5 +2 = 7 (+1 at 60 ft) → **T4**.

**A foe's DC:** a foe's save-first 2d6 + Restrained with a fixed DC 18: +4 damage, +1 Restrained (half — the target saves), +1 lasts the scene (a weapon's conditions follow its Bound stability), +2 fixed DC 18 = **8 → T4**. The same build on a Steward scores no DC line (and Stewards never store a fixed DC).

---

## Reading the breakdown

The Engine's Review step lists every line and the net ("Net 5 points → T2 — Saves as T2"); both item sheets show the same lines folded under "⚖ T2 · scores 5 points → T2". When a stored tier and the score disagree the sheet says so: a Steward's item re-tiers on the next edit to anything it does (the sheet re-score hook); a foe keeps its authored tier.

## Re-scoring existing content

`modules/bbttcc-campaign/tools/rescore-rubric-v1-2-2026-11-08.macro.js` — dry run by default; lists every item whose tier moves (with its breakdown), Steward vs foe vs world, and the Steward items that would now sit above their wielder's tier (inert Forms / Workings that need a reach). Writes only with `globalThis.__rescoreV12Write = true` (foes additionally need `__rescoreV12WriteFoes`).

## Open (watch in play)

- R03: is a free 30-ft burst too free? (Dave: "CHECK".)
- R10: Signature −2 — "let's see in practice".
- R09: the 3-point buy-down cap — "let's see how this plays out".
- Half-damage-on-save and a foe's save-first strike aren't discounted beyond the conditions' halving.

# RFI Manifestation Magnitude Budget — v1.1 (DRAFT)

**Status:** Draft, 2026-05-03. Addendum to *RFI Manifestation Tier Ruleset v1.0* (locked 2026-04-25).
**Why this exists:** v1.0 deliberately said "tier = footprint, not power." That works for *sustained* effects (upkeep self-throttles them) but leaves *instant* manifestations and *Bound Forms* (gear/armor/weapon analogues) without a magnitude rail. Without a rail, a Tier-I manifestation armor can ship +6/+6/+6 and the validator has nothing to push back with.
**How to apply:** When authoring a manifestation that produces a numeric mechanical effect (damage dice, defense bonus, healing, condition save DC, area/range), match the per-tier budget below. The fictional footprint rules (room/scene/region) still gate scope; this addendum just gives the *numbers* a ladder.

---

## Core principle (v1.1)

> Tier = footprint. **Magnitude = budget.** Investment (Surge, Blood Debt, Mode) can spend off-budget for one cast.

Two things change from v1.0:
1. Tier *does* set magnitude caps for instant/Bound effects, anchored to the existing baseline gear curve so manifestations can't out-pace authored items.
2. Investment levers (Surge, Blood Debt, Hermetic/Chaos/Ascendant Modes) buy *temporary* over-budget — never permanent.

---

## Magnitude Budget — instant + Bound effects

A manifestation may carry **one Major effect** at its tier's budget *or* **two Minor effects** (each at one-tier-down budget). Pick one shape, not both.

### Damage / single-target offense
| Tier | Major (one effect) | Minor (mix two) |
|---|---|---|
| T1 | **1d6** typed | 1d4 typed |
| T2 | **2d6** typed (or 1d10 + rider) | 1d6 typed |
| T3 | **3d6** typed (or 2d10 + rider) | 2d6 typed |
| T4 | **5d6** typed (or 3d10 + rider) | 3d6 typed |

*Rider = a non-damage tag like push, mark, prone, brief condition.*

### Defense / armor manifestation (anchor: T1/T2 baseline armor sprint)
| Tier | Total G+E+R bonus budget | Bound-Form upkeep | Examples in line |
|---|---|---|---|
| T1 | **2** points across G/E/R | 1 Clarity / Soma Break | matches *Drifter's Weave* (G+1/E+1/R+0), *Bulwark Hauberk* (G+2/E+0/R+1) |
| T2 | **3–4** points + 1 resistance type *or* 1 once/scene rider | 2 Clarity / SB | matches *Steelweave Hauberk* (G+3/E+0/R+1, kinetic resist, reactive lacing) |
| T3 | **5–6** points + 2 resistances + 1 condition immunity | 3 Clarity / SB | crafted/signature plate territory |
| T4 | **7–9** points + 3 resistances + 1 immunity + scene-trigger | 4 Clarity / SB + faction OP | boss/quest signature only |

A **shield**-frame manifestation pays half its budget into G or warding bonuses; a **robe**-frame manifestation may swap one defense point for one Clarity-rate bonus.

### Healing / restoration
| Tier | Single-target | Group |
|---|---|---|
| T1 | 1d6 + Body | — |
| T2 | 2d6 + Body, or 1d6 to up to 3 nearby | — |
| T3 | 3d6 + Body, or 2d6 to a group | one Soma Break tick to a group |
| T4 | 5d6 + restore one consumed Reach | mass scene-end stabilize |

### Save DC / control reach
DC = **8 + tier + Mind-or-Spirit attribute** (whichever the manifestation is keyed to).
This keeps DCs tied to tier without an extra budget line.

### Area / range
| Tier | Range | AoE if any |
|---|---|---|
| T1 | self / touch / 5 ft | — |
| T2 | 30 ft | 10-ft burst or 15-ft cone |
| T3 | 60 ft / line of sight in scene | 20-ft burst or 30-ft cone |
| T4 | district / region | site-scale (GM call) |

---

## Investment overrides (one-cast only)

These buy off-budget magnitude **for a single cast**. They never raise an item's permanent ceiling.

- **Surge** — roll the Surge die; on success, +1 magnitude band (e.g. T1 Major 1d6 → 2d6) or +1 rider. Failure rolls misfire on the *target* tier column.
- **Blood Debt (1)** — +1 magnitude band, no Surge roll. Bypasses the cap, costs the debt.
- **Hermetic Mode** — +1 Clarity to cast, but the cast counts as one tier *higher* for budget purposes only (not for footprint, not for misfire).
- **Chaos Mode** — −1 Clarity to cast, +1 magnitude band, but misfire d10 +2 (cap 10). High-variance burst.
- **Ascendant Mode** (T3+, aligned Sephirah) — costs 1 Blood Debt instead of Clarity; magnitude treated at +1 band, no misfire.

A manifestation cannot stack more than one Mode override + one Surge/BD override on the same cast.

---

## Authoring rules (validator-ready)

These are the rules a Path/Doctrine builder (currently halted) would enforce automatically:

1. **Single-band rule.** A manifestation declares one Major effect *or* two Minors, never both.
2. **Tier match.** Major effect dice/bonus may not exceed the tier's Major column.
3. **Bound budget.** Bound Forms must declare upkeep matching their tier (1/2/3/4 Clarity per Soma Break).
4. **Resistance/immunity gate.** Resistances at T2+, immunities at T3+, vulnerabilities-on-foe at T3+. T1 cannot grant any of the three.
5. **opCost rule (carries from v1.0).** T1–T3 must NOT carry opCost; T4 MUST.
6. **One rider per Major.** A Major damage effect may carry at most one non-damage rider; additional riders require Minor-effect slotting.
7. **Footprint hard wall.** Magnitude budget never lets a T1 cast affect more than one body/object — that's footprint, not power, and it stays absolute.

---

## Worked example — Tier-I Bulwark manifestation armor

A Tier-I Bulwark Steward declares a self-only Bound manifestation: *"Iron Promise."*

- **Footprint:** self (T1 ✓).
- **Stability:** Bound → 1 Clarity per Soma Break upkeep.
- **Cast cost:** 1 Clarity at cast.
- **Magnitude budget:** T1 defense — **2 points** across G/E/R, no resistance grant.
- **Author picks:** G+2 / E+0 / R+0 (matches *Patrolman's Plate* shape).
- **Override available:** Spend 1 Blood Debt at cast → treats the manifestation as T2 for one Soma Break, granting G+3/E+0/R+1 + kinetic resist *for that scene only*.
- **Misfire on Reach:** if the Bulwark Surges to T2 instead of paying Blood Debt, fail = roll T2 misfire column.

If the same Steward wanted resistance at T1, the answer is **no** — resistance is a T2+ grant. They'd need to pick *Bulwark Hauberk* (authored T1 plate, no resistance) and Reach to T2 via Blood Debt for one scene of resistance, or rebuild the manifestation as T2 with proper upkeep.

---

## Open items deferred to v1.2

- Stress/Noise rider math (riders that inflict Stress at higher tiers).
- Multi-target healing curve sanity-check vs. RFI Integrity scaling v1.
- Whether Path-defining Forms (Bulwark Frame, Aurablade) should carry an exemption letting a T1 Path-Form act at T2 magnitude *only for its specific Path's mechanic*.

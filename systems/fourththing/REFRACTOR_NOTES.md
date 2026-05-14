# Roll for Initiation / Bad Eden — Crew + Occult Faction-Scope Pass

This build layers the **Crew / Occult refactor** on top of the approved Manifestation Engine compatibility pass.

## What changed

- Crew and Occult are now presented as **faction-scoped Echo assets** on the Steward sheet
- Added a shared **Echo Assets** panel on the Core tab with:
  - active crew
  - reserve crew
  - active occult associations
  - reserve occult associations
  - shared capacity readout
- Added a **Manage Echo Assets** dialog that writes faction-side flags and supports migration-safe manual curation
- Legacy actor-level Crew / Occult identity choices are used as a **seed fallback** so existing Stewards do not go blank during migration
- Personal Steward identity badges now emphasize:
  - archetype
  - philosophy
  - sephirotic alignment
  - enlightenment

## Compatibility notes

- Underlying BBTTCC Character Options still exist and may still auto-apply OP bonuses from legacy Crew / Occult selections in the connected module layer
- This pass does **not** rewrite or remove those legacy options yet; it adds a faction-side asset layer in Roll for Initiation so the fiction and UI move first
- Echo asset data is stored on the linked faction actor at:
  - `flags.fourththing.echoAssets`
  - `flags.roll-for-initiation.echoAssets`

## Likely next step

1. Titanbound + Breaker merge into a single Path / doctrine family
2. ancestry canon rebuild
3. onboarding / Turn 1 territory-claim flow

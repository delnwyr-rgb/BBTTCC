# Pricing Rubric — Phase 0 Canon
*Drafted: 2026-05-10. Source of truth for marks-denominated pricing across items, materials, rigs, facilities, bosses, and technomagical gear.*

---

## 0. Top-line decisions (proposed — pending sign-off)

| Decision | Resolution |
|---|---|
| Currency | **Marks**, denominated per OP pool (1 OP = 10 marks). Items declare a native pool — see §1.5 |
| Authoritative price field | `flags.fourththing.rfi.item.price.marks` (integer) + `price.currency` (OP pool) |
| Tier ladder | 4 tiers, geometric ×3 progression |
| Sale-back | 40% of list price (rounded down) |
| Crafting fee | List price of materials (at retail unit cost) + tier-fee surcharge |
| Catalog read | `bbttcc-market` `cost.economy` reads `flags.…price.marks ÷ 10` if present, else falls back to settings-catalog OP cost |
| Technomagical | New schema/tag line — see §6 |
| Soulbound premium | × 1.5 list (one-of-a-kind, intransferable) |
| Negotiation tolerance | ± 25% of list at the GM's discretion (fence/discount range) |

---

## 1. Tier Base Cost (the spine)

The single number every other formula derives from. Calibrated to existing market range (5–50 OP = 50–500 marks observed in catalog entries today) with T4 above the current ceiling for late-game flex.

```
tierBase(t) = 50 × 3^(t-1)
```

| Tier | Base (marks) | Base (OP) | Pacing keyword |
|---|---|---|---|
| **T1** | 50 | 5 | starter / common |
| **T2** | 150 | 15 | proven / professional |
| **T3** | 450 | 45 | masterwork / signature |
| **T4** | 1350 | 135 | mythic / world-shaping |

Half-tier flexing (e.g. an unusually fine T2 item) is a × 1.5 modifier on `tierBase` — call it "T2★" in flavor text.

---

## 1.5. Currency & OP-Pool Denomination

Marks aren't a single wallet — they're per-pool (the faction `opBank` is keyed by OP type). Every item has a **native OP pool** that determines which faction stockpile it draws from. Default is Economy (the open marketplace), but most thematically-loaded items live elsewhere.

| Category cluster | Native pool | Examples |
|---|---|---|
| Weapons, mercenary contracts, war-rigs, military rig frames, gunner modules | **Violence** | Heart-Iron Saber, Hex-Iron Cleat, war-rig frame, mounted-gun rig modules |
| **Armor, shields**, restraints, non-lethal gear, prisoner ransom, intimidation tokens | **Non-Lethal** | Bulwark Hauberk, Steelweave Hauberk, tower shield, sleep-darts, manacles, witness-dampers, sept-hush amulets |
| Spy gear, smuggled tech, blackmail dossiers, hex-script intel, paired comms | **Intrigue** | Pre-Fall Comm Bead, forged sept seals, Witness Decoy Pin, smuggling crates |
| Trade goods, mundane gear, tools, facilities, infrastructure, raw materials | **Economy** | Tool kits, containers, civilian vehicles, generic consumables, lumber, ore |
| Cultural artifacts, art, propaganda, sacred relics, sigils, libraries, doctrines-as-objects | **Soft Power** | Vow-Bound Forge Core, sept-stamped haft, prayer-binding scroll, archive scrolls |
| Diplomatic gifts, hostages, treaty-binding objects, vow-bone stamps, sworn-oath tokens | **Diplomacy** | Vow-Bone, Oath-Ink, ceremonial gifts, treaty-anchor sigils, hostage-bonds |

**Cross-pool payment:** an item bought from its non-native pool costs **× 1.5** (the merchant doesn't take random tokens at face value). This stacks with the relations-tier friction from Phase B economy (Hostile blocked / Unfriendly +30% / Neutral +10% / Friendly+Allied 0%) — both apply at point-of-sale.

**Split pricing** (for hybrid items): an item can declare a `price.split` map distributing cost across pools. A Hex-Script Pistol = `{ violence: 200, intrigue: 100 }` means the buyer pays *both* pools simultaneously; no friction applies because each portion hits its native pool. Split-payment is the cheapest path for hybrid acquisitions; paying all-Economy fallback is `× 1.5` total list. Split is the right call whenever an item bridges domains (military hex-script, diplomatic relic-weapon, soft-power propaganda-tool, etc.).

**Steward (personal) wallet:** stewards keep a *single* personal marks wallet, treated as Economy-denominated for friction purposes. Pool-tracking only happens at faction-bank scale — asking players to juggle 6 pockets is a UX trap. Faction-funded steward gear (e.g. a soldier outfitted from the faction's Violence stockpile) flows from the faction's pool, not the steward's wallet.

**Currency lookup priority** (buy/sell dialog evaluation order):
1. If item declares `price.split`, charge each pool its share (no friction on natives; × 1.5 on any pool listed in the split's `altCurrencies`).
2. Else if buyer pays from `price.currency` (native pool): charge `list × relation-tier friction`.
3. Else (cross-pool): charge `list × 1.5 × relation-tier friction`.
4. Steward personal-wallet pays as Economy: native if `price.currency === "economy"`, cross-pool surcharge otherwise.

**Sale-back currency:** sells back into the buyer's native pool by default — a violence-vendor pays violence-marks for surplus weapons, a soft-power patron pays soft-power-marks for archived doctrines. GM may overrule (e.g. fences always pay Economy at the discounted stolen rate).

### 1.5.1 GM Override — the Woundhealer Rule

The §1.5 mapping is a **default** based on category, not a constraint. Item creation and the item sheet expose a **Native Pool** picker so the GM can override per-item for narrative-special cases. A sword that *heals* (Fritz Leiber's Woundhealer), a hammer that *binds treaties*, an "armor" that *projects propaganda*, a tool that's actually a relic — all want to leave their category default behind.

**Picker options on the item sheet:**
- **Auto (category default)** — derives from §1.5 mapping; this is the no-override state
- Violence / Non-Lethal / Intrigue / Economy / Soft Power / Diplomacy — explicit override
- **Split…** — opens a sub-dialog to author multi-pool split with mark amounts per pool

**Schema:**
```js
flags.fourththing.rfi.item.price.currency: "auto" | "violence" | "nonLethal" | "intrigue" | "economy" | "softPower" | "diplomacy"
flags.fourththing.rfi.item.price.gmOverride: true   // stamped automatically when override differs from category default
```

When `gmOverride: true`, the **price-audit macro skips this item** (it knows the categorization was deliberate). The audit otherwise flags items whose `price.currency` doesn't match the §1.5 default — useful for catching unintended drift, ignorable for narrative items.

**Worked example — Woundhealer:**
```js
{
  name: "Woundhealer",
  type: "weapon",
  flags.fourththing.rfi.item: {
    tier: "III",
    frame: "weapon",
    bound: "soulbound",
    price: {
      marks: 675,                       // T3 weapon × 1.0 × bound 1.5 = 675
      currency: "softPower",            // override — its narrative weight is mythic, not martial
      gmOverride: true,
      split: null,
      notes: "T3 weapon × 1.0 × soulbound 1.5; GM override softPower (Woundhealer)",
      bound: "soulbound",
      saleBack: 0                       // soulbound, no sale
    }
  }
}
```

Effect: a faction acquires Woundhealer by spending Soft Power marks (paying for myth, not for steel). Cross-pool payment from Violence still works at × 1.5 friction — anyone *can* buy it with violence-tokens, but it costs them more, which is the right narrative texture.

---

## 2. Category Multipliers

Apply to `tierBase` to get list price for a stock instance of that category.

| Category | × Multiplier | T1 list | T2 list | T3 list | T4 list |
|---|---|---|---|---|---|
| **Weapon** (frame: weapon) | 1.0 | 50 | 150 | 450 | 1350 |
| **Armor** (frame: armor) | 1.5 | 75 | 225 | 675 | 2025 |
| **Shield / off-hand** | 0.7 | 35 | 105 | 315 | 945 |
| **Tool** (frame: tool) | 0.6 | 30 | 90 | 270 | 810 |
| **Sigil / focus** (frame: sigil) | 1.2 | 60 | 180 | 540 | 1620 |
| **Container** (frame: container) | 0.4 | 20 | 60 | 180 | 540 |
| **Consumable** (frame: consumable) | 0.2 | 10 | 30 | 90 | 270 |
| **Material** (frame: material) — *unit* | 0.1 | 5 | 15 | 45 | 135 |
| **Vehicle / mount** (non-rig) | 5.0 | 250 | 750 | 2250 | 6750 |
| **Technomagical** (any frame) | × 2.0 of base category | — | — | — | — |

**Pricing formula (final):**
```
list = tierBase × categoryMult × techMult × boundMult × halfTierMult
```
Where:
- `techMult` = 2.0 if `flags.fourththing.rfi.tech` is present, else 1.0
- `boundMult` = 1.5 if `bound === "soulbound"`, else 1.0
- `halfTierMult` = 1.5 if "T#★", else 1.0

Round to the nearest 5 marks.

---

## 3. Materials — Unit Prices

Materials price at `tierBase × 0.1` per unit. Bundle pricing uses `unitPrice × charges` (the existing `flags.fourththing.rfi.item.charges` field).

| Material tier | Unit price | Bundle of 5 | Bundle of 10 |
|---|---|---|---|
| T1 | 5 marks | 25 | 50 |
| T2 | 15 marks | 75 | 150 |
| T3 | 45 marks | 225 | 450 |
| T4 | 135 marks | 675 | 1350 |

**Special-case materials** (priced above tier band — flagged on the item):
- **Yesodium** (T3, listed): × 3 = 135 marks/unit. Foundational technomagical fuel; shouldn't be commodity-priced.
- **Tree-of-Life Shard** (T3): × 4 = 180 marks/unit. Rare, single-source.
- **Pre-Fall Component** (T4): × 2 = 270 marks/unit. Salvage-only; not craftable.
- **Witness-Glass / Vow-Bone / Hex-Glyph Plate** (all T2/T3): × 1.5 (binding/oath substrate, restricted).

Markup applied via `flags.fourththing.rfi.item.price.rarityMult`.

---

## 4. Crafting Cost

The forge consumes materials *and* a marks fee. The marks fee covers tools, time, lost wax, sept tithe, GM-discretion fees.

```
craftCost = Σ(recipe.qty × material.unitPrice) + tierFee(itemTier)
```

| Item tier | tierFee (marks) |
|---|---|
| T1 | 10 |
| T2 | 30 |
| T3 | 90 |
| T4 | 270 |

**Failed craft penalty** (existing engine: 50% of materials wasted) — no marks-fee refund. Forge keeps the fee.

**Upcraft** (e.g. T2 result from T2 materials): standard formula. **Down-craft** (T2 materials → T1 result) is wasteful and explicitly *not* discounted — the rubric assumes you used the materials you had.

**Crafting profit margin** — by construction, list price ≈ 1.4× to 2× craft cost. Crafters who source/harvest their own materials profit; buyers of materials at retail break even or take a small loss.

---

## 5. Sale-Back & Trade-In

```
saleBack = floor(list × 0.40)
```

Vendors give 40% of list, factions sometimes give better at GM discretion (allied trade tier already removes 0–30% friction per economy phase B canon — that stacks).

**Soulbound items** sell back at 0 (they're soulbound).
**Damaged items** (integrity < 50%): saleBack × 0.5.

---

## 6. Technomagical Schema (new)

A new schema/tag line for items that combine craft + ritual + technology. Lives under a new substructure on the existing `flags.fourththing.rfi`:

```js
flags.fourththing.rfi.tech = {
  kind:        "charged" | "attuned" | "fueled" | "linked",
  charges:     { value: 0, max: 0, recoverPer: "soma-break" | "rest" | "scene" | "round" | "manual" },
  fuel:        { materialKey: "yesodium", perActivation: 1 },        // null if kind !== "fueled"
  attunement:  { required: false, slots: 1 },                        // slots count against steward attunement cap
  signature:   "string-id" | null,                                   // optional manifestation tag
  failure:     "misfire" | "drain" | "inert",                         // what happens on misuse / over-charge
  origin:      "pre-fall" | "septcraft" | "hex-script" | "witness-forge" | "homebrew",
  shielded:    false                                                  // reduces detection vs Witnesses
}
```

**Pricing knobs:**
- `techMult` = 2.0 base (already in §2).
- Each additional charge above the base of 1: + 10% of list.
- `attunement.required: true`: + 25% (attunement bumps reflect rarity/uniqueness).
- `fuel.perActivation > 1`: −10% (operating cost shifts to fuel).
- `shielded: true`: + 50% (Witness-evasion premium).

**Attunement cap (proposed):** 3 slots per steward (Body + Soul mod, floor 3). GM can overrule via flag. Not enforced by engine in v1 — UI warning only.

**Crafting requirement:** any tech item recipe MUST include ≥ 1 unit of one of: Yesodium, Witness-Glass, Hex-Glyph Plate, or Pre-Fall Component. Validator rejects otherwise.

**Examples (non-binding — for calibration):**

| Item | Tier | Frame | Tech kind | Charges | Fuel | Currency | List |
|---|---|---|---|---|---|---|---|
| Septlight Lantern | T1 | tool | charged | 3 / soma-break | — | Economy | 60 |
| Hex-Script Pistol | T2 | weapon | fueled | — | yesodium ×1/shot | **split:** Violence 200 + Intrigue 100 | 300 |
| Witness Decoy Pin | T2 | consumable (single) | inert-on-use | 1 | — | Intrigue | 60 |
| Pre-Fall Comm Bead | T3 | tool | linked (paired) | ∞ within range | — | Intrigue | 540 |
| Soulbound Hex-Reaver | T3 | weapon | attuned + charged | 5 / rest | — soulbound | **split:** Violence 1000 + Soft Power 500 | ~1500 |
| Vow-Bound Forge Core | T4 | sigil | fueled (siege) | — | yesodium ×3/turn | **split:** Soft Power 2160 + Diplomacy 1080 | 3240 |

The recurring pattern: *technomagical items frequently bridge domains, so split-currency is the rule rather than the exception above T1.*

---

## 7. Rig Pricing

Rigs are NOT priced via category multiplier — they have their own bracket-based ladder. Bracket multiplier applies to `tierBase`, then a frame-quality modifier applies on top.

| Bracket | × Multiplier | T1 | T2 | T3 | T4 |
|---|---|---|---|---|---|
| **Personal** (single pilot bike/skiff) | 2 | 100 | 300 | 900 | 2700 |
| **Light** (1–2 crew scout) | 5 | 250 | 750 | 2250 | 6750 |
| **Medium** (4–8 crew barge) | 12 | 600 | 1800 | 5400 | 16200 |
| **Heavy** (4–7 crew war-rig) | 25 | 1250 | 3750 | 11250 | 33750 |
| **Siege** (stationary fortress/forge) | 50 | 2500 | 7500 | 22500 | 67500 |

Frame is the **chassis only**. Weapons, systems, and output modules are separately-priced gear items (use §2 multipliers — `rig-weapon` = weapon ×, `rig-system` = sigil ×, `output-module` = tool ×).

**Total rig cost** = frame + Σ(equipped gear).

**Pre-built rig templates** (catalog): price = frame + suggested gear loadout, listed as a single bundle. Buyer can swap modules at retail before/after purchase.

---

## 8. Facility Pricing (= stationary rig)

Facilities are rigs with `mobility: "stationary"`. Their value is their **monthly output yield**, not combat. Use the rig formula above as a floor; layer the output-module pricing on top.

```
facilityList = max(rigBracketCost, monthlyYield × 30)
```

Where `monthlyYield` = sum of `output-module.basePerTurn × 30` (assuming daily ticks, 30-day month).

This ensures a 1-mark-per-day windmill is priced at least at the bracket-floor (a windmill can't be cheaper than its hex-bracket integrity-frame), and a rich Yesodium mine prices to its yield.

**Payback period** target: 30–90 days for stable economy. If `facilityList ÷ monthlyYield > 90`, drop a tier on the bracket; if `< 30`, bump a tier.

---

## 9. Boss Pricing (bounty / hire / capture)

Bosses don't have a list price — they aren't sold. They have three derived prices:

| Number | Use | Formula |
|---|---|---|
| **Bounty** | Faction-side reward for slaying | `tierBase × bracketMult × 0.6` |
| **Hire price** | Cost to retain a tameable / pact-bound boss | `tierBase × bracketMult × 1.5` |
| **Ransom** | Cost to recover a captured / hostage boss | `tierBase × bracketMult × 1.0` |

Bracket for bosses is the rig bracket they're sized at (a Light boss vs a Siege boss).

**Bounty payout** is in marks to the faction's opBank — *which* pool depends on the *method* of victory:

| Method | Pool credited |
|---|---|
| Combat kill (open battle, raid, duel) | **Violence** |
| Subdual / capture without killing | **Non-Lethal** |
| Assassination (stealth, poison, ambush) | **Intrigue** |
| Diplomatic exile / abdication / forced deposition | **Diplomacy** |
| Folkloric defeat (public trial, ritual contest, unmasking) | **Soft Power** |
| Faction-economic ruin (bankruptcy, asset stripping, blockade) | **Economy** |

Hire and ransom use the same table — you hire a war-boss with Violence-marks, a charm-boss with Soft Power, etc. Cross-pool payment for hire/ransom incurs the standard × 1.5 friction (the boss takes their fee in their preferred denomination).

---

## 10. Personal Rigs

Personal rigs (bracket: personal) are the steward-scale category — bikes, skiffs, hex-jumpers, single-pilot mechs. They serve as both transport and personal combat platform.

**Pricing** uses the rig bracket = "personal" row in §7. Realistic personal-rig price points:

| T | Stock (frame only) | Mid-tier (frame + 1 system + 1 weapon) | Pimped (frame + 3 modules) |
|---|---|---|---|
| T1 | 100 | ~190 | ~280 |
| T2 | 300 | ~570 | ~840 |
| T3 | 900 | ~1700 | ~2520 |
| T4 | 2700 | ~5100 | ~7560 |

Steward purchase: **personal rigs are character-owned**, not faction-owned (canon: rigs without `factionOwnerId` belong to the steward who paid). Faction can cover the cost via op-bank requisition — that's a roleplay/GM decision.

---

## 11. Field Surfacing & Plumbing (where this lives in code)

**On items** — the price is authored as:
```js
flags.fourththing.rfi.item.price = {
  marks:        450,                 // authoritative total list price (sum of split if split)
  currency:     "violence",          // native OP pool: auto | economy | violence | nonLethal | intrigue | softPower | diplomacy
  gmOverride:   false,               // true when currency differs from §1.5 category default (audit-skip flag)
  altCurrencies: { economy: 1.5 },   // optional override of cross-pool friction (default × 1.5 if absent)
  split:        null,                // optional hybrid pricing: { violence: 200, intrigue: 100 } — sums must equal marks
  rarityMult:   1.0,                 // pre-applied to marks for special-case materials
  notes:        "T3 weapon × 1.0, Violence-native",  // audit string (computed by macro)
  bound:        "free",              // duplicate of item.bound for sale-back logic
  saleBack:     180                  // pre-computed convenience field (= floor(marks × 0.40)); paid in price.currency
}
```

**Validator rules:**
- `currency` must be one of the six OP pool keys (matches `bbttcc-factions` opBank keys).
- If `split` is present, `Σ split.values()` MUST equal `marks` (within ±2 marks rounding tolerance).
- Tech items (`flags.fourththing.rfi.tech` present) at T2+ should declare `split` if they bridge domains — author warning, not engine error.

**Catalog read path** (`bbttcc-market/scripts/market.js`):
```
opCost = item.flags.fourththing.rfi.item.price.marks ÷ 10
       || catalogEntry.cost.economy        // fallback for legacy entries
```

**Crafting fee read path** (`systems/fourththing/rfi-crafting.js`): consume the recipe materials AND deduct `craftCost` from the steward's marks (or faction opBank if marked as faction-craft).

**Sale-back read path** (vendor / fence dialog): present `floor(marks × 0.40)` as offer; allow GM override.

**Migration:** items without `price.marks` pass through a one-time stamp pass that infers from `tier + frame + tech?` per §1+§2. Idempotent; runs on world load if `flags.fourththing.priceMigrationVersion < 1`.

---

## 12. Edge Cases & GM Knobs

| Situation | Rule |
|---|---|
| Quest reward, "priceless" | `price.marks: -1` (sentinel — UI shows "—", not for sale) |
| Faction-only item | `price.marks` set, but vendor list filters by ownership |
| Damaged (< 50% integrity) | `saleBack × 0.5`, list price unchanged |
| Stolen | GM flag `price.notes: "stolen"` — fences offer × 0.25 |
| Soulbound | × 1.5 list, sale-back = 0 |
| Soft inflation (post-victory boom) | GM seasonal modifier on the catalog read path; not stored on item |
| Faction-allied discount | already canon (Phase B economy) — friction reduction applies on top |
| Bulk (10+ identical) | Optional × 0.9; not engine-enforced, GM call |

---

## 13. Authoring Workflow (for content sprints)

When authoring a new item, the workflow is:
1. Decide **tier** (1–4) and **frame** (weapon/armor/tool/sigil/etc.).
2. Decide **technomagical?** — if yes, fill `flags.fourththing.rfi.tech` per §6.
3. Decide **bound** — free / attuned / soulbound.
4. Compute price via `list = tierBase × categoryMult × techMult × boundMult × halfTierMult` (or run the price-stamp macro — see §14).
5. Write the recipe in `flags.fourththing.rfi.item.materialOf` as `[{key, qty}, …]` if craftable.
6. Author flavor / mechanical text.

---

## 14. Tooling To Build (Phase 1+)

| Tool | Purpose | Path |
|---|---|---|
| `price-stamp.macro.js` | One-shot stamp existing items; idempotent on `priceMigrationVersion` | `bbttcc-master-content/tools/` |
| `price-audit.macro.js` | Report items missing price, tech-flagged items missing fuel material, etc. | `bbttcc-master-content/tools/` |
| `craft-cost-preview` (sheet) | Steward's craft dialog shows materials + fee + total *before* commit | `systems/fourththing/rfi-crafting.js` |
| `vendor-dialog-rebuild` | Show list + buy + sale-back side-by-side; respect bound/damaged/stolen/faction tier; pool-aware (shows native cost vs cross-pool surcharge) | `bbttcc-market` |
| Item-sheet **Native Pool** picker | Dropdown: Auto / 6 pools / Split…; stamps `gmOverride: true` when non-auto choice differs from category default | `systems/fourththing/sheets/item-sheet.js` |
| `rig-bundle-builder` | GM tool to lay out frame + modules and emit a single bundle list price | `systems/fourththing/` |

---

## 15. Open Questions Deferred to Phase 1+

1. **Inflation/deflation curves** — does post-conquest boom auto-modify catalog, or is it always GM-driven seasonal?
2. **Faction-internal pricing** — does an allied faction sell at list, or at sale-back, or at a tier-discounted rate? (Phase B leaning toward 0% friction = list, but need confirmation.)
3. **Mark sinks** — are there structural mark sinks (taxes, upkeep, crew wages)? Or is the economy purely supply/demand?
4. **Wage/upkeep ladder** — should rigs/facilities have monthly upkeep, in marks, that scales with tier × bracket? (Lean: yes, T × bracket × 0.05 per session/week.)
5. **Player-facing price visibility** — show price on every item sheet, or only in vendor/forge contexts?
6. **Negotiation mini-game** — any dice-rolled price adjustment, or pure GM fiat?
7. **Steward-side pool denomination** — locked at "personal wallet = Economy" for v1. Open: should specialists ever hold non-economy personal marks (a soldier paid directly in violence-tokens, a courtier in soft-power)? If yes, needs a UI sub-wallet model. Lean: defer to v2; v1 keeps the single wallet.
8. **Pool-conversion at the bank** — can a faction explicitly burn `N` violence-marks to receive `N × 0.6` economy-marks (formal exchange), or is cross-pool only ever spent at point-of-sale via the × 1.5 friction? Lean: no explicit conversion in v1 — friction is the only path, which preserves pool identity.

---

## 16. Sprint Phases (post-Phase 0 sign-off)

| Phase | Deliverable |
|---|---|
| 1 | Add `flags.fourththing.rfi.item.price` schema + `flags.fourththing.rfi.tech` schema to template defaults; add **Native Pool picker** + Split sub-dialog to the item-sheet price section (auto / 6 pools / split…) |
| 2 | `price-stamp.macro.js` + `price-audit.macro.js` in master-content tools (audit skips `gmOverride: true`) |
| 3 | Stamp all 43 materials with §3 prices |
| 4 | Stamp all existing items (T1 weapons/armor/etc.) with §1+§2 prices |
| 5 | Wire `bbttcc-market/scripts/market.js` to read price.marks (with fallback) |
| 6 | Wire `rfi-crafting.js` craft-fee deduction |
| 7 | Author technomagical content batch (~15–20 items per tier) |
| 8 | Author rig/facility/boss/personal-rig content batches |
| 9 | Bestiary authoring (uses item drops authored above as rewards) |
| 10 | Lightsail deploy: tar full subtree + md5-verified to both PM2 instances |

---
*End Phase 0 canon. Phase 1 begins on sign-off.*

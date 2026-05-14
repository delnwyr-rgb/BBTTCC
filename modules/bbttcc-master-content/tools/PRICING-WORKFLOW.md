# RFI Pricing Workflow — Phase 2 Tools

*Companion to `systems/fourththing/PRICING_RUBRIC.md`. Use these tools to apply the rubric to existing content (Phase 3 — 43 materials) and to all already-authored gear (Phase 4 — T1 weapons + armor + SW5E imports + everything else in master-content).*

## Tools

| File | Purpose | Mutates? |
|---|---|---|
| `price-stamp.macro.js` | Walks selected packs, stamps `flags.fourththing.rfi.item.price` per the rubric. Idempotent. | Yes (when DRY_RUN=false) |
| `price-audit.macro.js` | Read-only scan. Reports drift, missing prices, tech items missing required fuel, split-variance. | No |

Both are **F12 console paste-ables**, IIFE-wrapped, GM-only.

---

## Recommended order

### 1. Baseline audit (read-only — always start here)
1. F12 → console (GM client).
2. Open `tools/price-audit.macro.js`. Leave knobs at defaults (`PACK_IDS = null` scans everything).
3. Paste, hit enter.
4. **Read** the chat card and `console.table` output. The MISSING count is your starting baseline.

### 2. Dry-run stamp on a narrow scope
First time stamping: pick ONE pack to validate.
1. Open `tools/price-stamp.macro.js`.
2. Edit knobs:
   ```js
   const DRY_RUN = true;
   const PACK_IDS = ["bbttcc-master-content.items"];   // or whichever pack holds your materials
   const FORCE = false;
   ```
3. Paste in console. The output is a `console.table` of "would-stamp" rows. **Spot-check 3–4 rows** (tier, frame, currency, marks) against the rubric.
4. If anything looks wrong, fix the rubric or the macro before going wet.

### 3. Wet-run on that same pack
1. Same macro, change `DRY_RUN = false`.
2. Paste. Rows are stamped to disk.
3. Re-run **price-audit.macro.js** with the same `PACK_IDS` filter — you should see MISSING drop to 0 (for that pack) and zero drift entries.

### 4. Repeat scope-widening passes
Stamp materials first (the §3 rarity-mult table only applies to materials), then weapons, then armor, then everything else. The macro is idempotent — re-running on already-stamped items is a no-op (unless you set `FORCE=true`).

Suggested pack order (Phase 3 → Phase 4):
1. `bbttcc-master-content.items` (or wherever the 43 materials live — the audit will tell you)
2. `bbttcc-master-content.weapons` (or equivalent)
3. `bbttcc-master-content.armor`
4. `bbttcc-master-content.gear` / `tools` / `consumables` / `containers`
5. Any SW5E-imported pack still in scope
6. World-level items (`PACK_IDS = null` minus already-done packs, or just everything)

### 5. Final audit
After every pack is stamped, run `price-audit.macro.js` with `PACK_IDS = null`. Aim for:
- MISSING: 0 (every gear item has a price)
- CURRENCY_DRIFT: 0
- MARKS_DRIFT: 0 (or only items where you've intentionally overridden — flag them with `gmOverride: true` so the audit skips them)
- TECH_NO_FUEL: 0 (every tech item has a required fuel material in its recipe)
- SPLIT_VARIANCE: 0

---

## When the audit flags something

| Finding | What it means | Fix |
|---|---|---|
| **MISSING** | No price stamped. | Run the stamp macro. |
| **CURRENCY_DRIFT** | The item's `currency` doesn't match its frame's category default and `gmOverride: false`. | Either fix the currency (use the gold-coins button on the item sheet), or — if the override is *deliberate* — set `gmOverride: true` (the Woundhealer rule). |
| **MARKS_DRIFT** | Stored marks don't match `computeListPrice()` for tier × frame × bound × tech. The recipe or tier changed since stamping. | Re-stamp with `FORCE = true` for that pack, OR set `gmOverride: true` if you priced it manually. |
| **TECH_NO_FUEL** | Item has `flags.fourththing.rfi.tech` but no Yesodium / Witness-Glass / Hex-Glyph Plate / Pre-Fall Component in its recipe. Required by rubric §6. | Add the fuel material to the recipe (`flags.fourththing.rfi.item.materialOf`), or remove the `tech` flag if the item shouldn't be technomagical. |
| **SPLIT_VARIANCE** | `Σ price.split.values()` doesn't equal `price.marks` (±5). | Re-author the split via the Split… dialog from the gold-coins header button; it auto-balances on save. |

---

## Macro-author convention

These tools follow `bbttcc-master-content/tools/` style:
- `*.macro.js` — paste into a Macro slot in Foundry; can run from a hotbar button.
- `*.console.js` — paste directly into F12 console; one-shot.

Both flavors are valid here — these are written as console one-shots but will work as Macro docs. Re-paste after editing on disk; **macros are world docs, disk edits don't propagate** (see memory `feedback_foundry_macros_live_in_world.md`).

---

## What's next (Phase 5+)

After the bulk repricing pass is clean:
- **Phase 5:** wire `bbttcc-market/scripts/market.js` to read `price.marks ÷ 10` (with legacy catalog fallback). Storefronts then auto-source from item flags.
- **Phase 6:** wire `rfi-crafting.js` craft-fee deduction (materials at retail + tier surcharge per rubric §4).
- **Phase 7:** authoring sprint — technomagical batch (~15–20 per tier).
- **Phase 8:** rig / facility / boss / personal-rig batches.
- **Phase 9:** bestiary (uses item drops as rewards).

See `systems/fourththing/PRICING_RUBRIC.md` §16 for the full sprint phase ladder.

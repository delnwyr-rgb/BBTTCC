// BBTTCC — RFI Price Stamp (Phase 2, 2026-05-10)
// ─────────────────────────────────────────────────────────────────────────────
// Walks selected compendium packs (or all gear-bearing packs by default) and
// stamps `flags.fourththing.rfi.item.price` on every gear item that doesn't
// have one yet. Pricing math is delegated to `game.fourththing.pricing` so
// changes to the rubric only need to land in rfi-pricing.js.
//
// Companion: price-audit.macro.js (read-only — run before AND after stamping).
//
// Knobs:
//   DRY_RUN  — true: log what WOULD change, don't write. Start here.
//   PACK_IDS — array of pack ids ("module.packname"). null = all Item packs.
//   FORCE    — true: re-stamp even items that already have a price.
//              false: only stamp items missing price (default; idempotent).
//   SKIP_GM_OVERRIDE — true (default): never touch items with
//              `price.gmOverride: true`. The Woundhealer rule.
//
// Usage:
//   1. Load the world. F12 → console.
//   2. Edit the knobs below.
//   3. Paste this whole file into the console. Read the output. Re-run with
//      DRY_RUN = false when you're happy.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  // ── Knobs ─────────────────────────────────────────────────────────────────
  const DRY_RUN = true;
  const PACK_IDS = null;        // e.g. ["bbttcc-master-content.items"] or null for all
  const FORCE = false;
  const SKIP_GM_OVERRIDE = true;

  // ── Special-case material rarity multipliers (rubric §3) ──────────────────
  // Looked up by `flags.fourththing.rfi.item.materialKey` (lowercase-hyphen).
  // Authored markup applied on top of tier × 0.1 base unit price.
  const MATERIAL_RARITY = {
    "yesodium":             3.0,
    "tree-of-life-shard":   4.0,
    "pre-fall-component":   2.0,
    "witness-glass":        1.5,
    "vow-bone":             1.5,
    "hex-glyph-plate":      1.5
  };

  // ── Sanity checks ─────────────────────────────────────────────────────────
  const pricing = game.fourththing?.pricing;
  if (!pricing) {
    ui.notifications?.error("game.fourththing.pricing unavailable — is rfi-pricing.js loaded?");
    return;
  }
  const RfiItems = game.fourththing?.items;
  if (!RfiItems) {
    ui.notifications?.error("game.fourththing.items unavailable — is rfi-items.js loaded?");
    return;
  }

  // ── Pack selection ────────────────────────────────────────────────────────
  const allItemPacks = game.packs.filter(p => p.documentName === "Item");
  const selectedPacks = PACK_IDS
    ? allItemPacks.filter(p => PACK_IDS.includes(p.collection))
    : allItemPacks;

  // World items also get walked when PACK_IDS is null (no filter). Catalog
  // entries frequently point to game.items uuids — without this pass, those
  // items never get stamped and the market shows the stale legacy catalog
  // price instead.
  const includeWorldItems = !PACK_IDS;

  if (!selectedPacks.length && !includeWorldItems) {
    ui.notifications?.warn("No Item packs match PACK_IDS filter.");
    return;
  }

  console.log(`[price-stamp] ${DRY_RUN ? "DRY-RUN" : "WET-RUN"} on ${selectedPacks.length} pack(s)${includeWorldItems ? " + world items" : ""}`);

  // ── Walk + stamp ──────────────────────────────────────────────────────────
  const FLAG_NS = RfiItems.FLAG.ns;        // "fourththing"
  const FLAG_KEY = RfiItems.FLAG.key;      // "rfi.item"

  let totals = { scanned: 0, stamped: 0, skippedNonGear: 0, skippedExisting: 0, skippedOverride: 0, errors: 0 };
  const stampedRows = [];

  // Yield iterables across packs + world items so a single loop handles both.
  const sources = [];
  for (const pack of selectedPacks) {
    sources.push({ label: pack.collection, fetch: () => pack.getDocuments() });
  }
  if (includeWorldItems) {
    sources.push({ label: "(world items)", fetch: async () => Array.from(game.items ?? []) });
  }

  for (const src of sources) {
    let docs;
    try { docs = await src.fetch(); }
    catch (e) {
      console.warn(`[price-stamp] failed to load ${src.label}`, e);
      continue;
    }
    const pack = { collection: src.label };  // shape-compatible for stampedRows

    for (const item of docs) {
      totals.scanned++;
      try {
        if (!RfiItems.is.isGear(item)) { totals.skippedNonGear++; continue; }

        const rfi    = RfiItems.get(item) ?? {};
        const stored = item.getFlag?.(FLAG_NS, FLAG_KEY) ?? {};
        const existingPrice = stored.price;

        if (existingPrice && SKIP_GM_OVERRIDE && existingPrice.gmOverride) {
          totals.skippedOverride++; continue;
        }
        if (existingPrice && !FORCE) {
          totals.skippedExisting++; continue;
        }

        // ── Compute defaults ──
        const tier  = rfi.tier  ?? "I";
        const frame = rfi.frame ?? "tool";
        const bound = rfi.bound ?? "free";
        const hasTech = Boolean(stored.tech);

        // Material rarity boost (only meaningful for frame === "material" — this
        // pack uses materialKey on materials).
        let rarityMult = 1.0;
        const matKey = (rfi.materialKey ?? stored.materialKey ?? "").toLowerCase();
        if (frame === "material" && matKey && MATERIAL_RARITY[matKey]) {
          rarityMult = MATERIAL_RARITY[matKey];
        }

        const marks = pricing.computeListPrice({ tier, frame, hasTech, bound, rarityMult });
        const currency = pricing.defaultCurrencyForFrame(frame);
        const saleBack = pricing.computeSaleBack(marks, bound);

        const newPrice = {
          marks,
          currency,
          gmOverride:    false,
          altCurrencies: {},
          split:         null,
          rarityMult,
          notes:         `T${tier} ${frame} stamp${rarityMult !== 1 ? ` × rarity ${rarityMult}` : ""}${hasTech ? " × tech 2.0" : ""}${bound === "soulbound" ? " × soulbound 1.5" : ""}`,
          bound,
          saleBack
        };

        stampedRows.push({
          pack: pack.collection,
          name: item.name,
          tier, frame, bound,
          marks, currency, rarityMult,
          had: existingPrice ? "yes" : "no"
        });

        if (!DRY_RUN) {
          await item.setFlag(FLAG_NS, FLAG_KEY, { ...stored, price: newPrice });
        }
        totals.stamped++;
      } catch (e) {
        totals.errors++;
        console.warn(`[price-stamp] error on ${item?.name ?? item?.id}`, e);
      }
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  console.log("[price-stamp] totals", totals);
  if (stampedRows.length) {
    console.log(`[price-stamp] ${DRY_RUN ? "would stamp" : "stamped"} ${stampedRows.length} item(s) (first 25 shown):`);
    console.table(stampedRows.slice(0, 25));
    if (stampedRows.length > 25) console.log(`[price-stamp] (… ${stampedRows.length - 25} more — full list in console.table above)`);
  }
  ui.notifications?.info(
    `${DRY_RUN ? "DRY-RUN" : "Stamped"}: ${totals.stamped} priced / ${totals.skippedExisting} kept / ${totals.skippedOverride} GM-locked / ${totals.skippedNonGear} non-gear / ${totals.errors} errors`
  );
})();

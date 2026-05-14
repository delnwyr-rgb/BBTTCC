// BBTTCC — RFI Price Audit (Phase 2, 2026-05-10)
// ─────────────────────────────────────────────────────────────────────────────
// Read-only scan of every gear item in selected packs. Reports:
//   • MISSING        — item has no flags.fourththing.rfi.item.price at all
//   • CURRENCY_DRIFT — price.currency ≠ category default for the frame, and
//                      gmOverride is false (drift; should be auto)
//   • MARKS_DRIFT    — |stored marks − recomputed list| > MARKS_TOLERANCE
//                      (recipe + bound + tech changed but price wasn't re-stamped)
//   • TECH_NO_FUEL   — flags.…rfi.tech is set but the materialOf recipe doesn't
//                      include ANY of [yesodium, witness-glass, hex-glyph-plate,
//                      pre-fall-component]. Required by rubric §6.
//   • SPLIT_VARIANCE — |sum(price.split) − price.marks| > MARKS_TOLERANCE
//
// Items with `price.gmOverride: true` are skipped from drift checks (the
// Woundhealer rule — deliberate authoring is never drift).
//
// Output: console.table by category + a chat card summary.
//
// Knobs:
//   PACK_IDS         — array of pack ids, null for all Item packs
//   MARKS_TOLERANCE  — drift tolerance in marks (default 5; matches stamp rounding)
//   POST_CHAT_CARD   — true: post a summary chat card; false: console only
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const PACK_IDS = null;
  const MARKS_TOLERANCE = 5;
  const POST_CHAT_CARD = true;

  const REQUIRED_TECH_MATERIALS = new Set([
    "yesodium", "witness-glass", "hex-glyph-plate", "pre-fall-component"
  ]);

  const pricing = game.fourththing?.pricing;
  const RfiItems = game.fourththing?.items;
  if (!pricing || !RfiItems) {
    ui.notifications?.error("game.fourththing.pricing or .items unavailable.");
    return;
  }

  const FLAG_NS = RfiItems.FLAG.ns;
  const FLAG_KEY = RfiItems.FLAG.key;

  const allItemPacks = game.packs.filter(p => p.documentName === "Item");
  const selectedPacks = PACK_IDS
    ? allItemPacks.filter(p => PACK_IDS.includes(p.collection))
    : allItemPacks;

  // World items walked when no PACK_IDS filter — mirror price-stamp.macro.js
  // so audits cover the same surface that the stamper does.
  const includeWorldItems = !PACK_IDS;

  if (!selectedPacks.length && !includeWorldItems) {
    ui.notifications?.warn("No Item packs match PACK_IDS filter.");
    return;
  }

  const findings = {
    MISSING:        [],
    CURRENCY_DRIFT: [],
    MARKS_DRIFT:    [],
    TECH_NO_FUEL:   [],
    SPLIT_VARIANCE: []
  };
  let totals = { scanned: 0, gear: 0, withPrice: 0, gmOverride: 0 };

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
    catch (e) { console.warn(`[price-audit] could not load ${src.label}`, e); continue; }
    const pack = { collection: src.label };  // shape-compatible for findings rows

    for (const item of docs) {
      totals.scanned++;
      if (!RfiItems.is.isGear(item)) continue;
      totals.gear++;

      const rfi    = RfiItems.get(item) ?? {};
      const stored = item.getFlag?.(FLAG_NS, FLAG_KEY) ?? {};
      const price  = stored.price;
      const tech   = stored.tech;

      // ── MISSING ──
      if (!price) {
        findings.MISSING.push({ pack: pack.collection, name: item.name, type: item.type, tier: rfi.tier, frame: rfi.frame });
        continue;
      }
      totals.withPrice++;
      if (price.gmOverride) {
        totals.gmOverride++;
      }

      const tier  = rfi.tier  ?? "I";
      const frame = rfi.frame ?? "tool";
      const bound = rfi.bound ?? "free";
      const hasTech = Boolean(tech);

      // ── CURRENCY_DRIFT (skip if explicitly auto or GM-overridden) ──
      if (!price.gmOverride && price.currency && price.currency !== "auto") {
        const expected = pricing.defaultCurrencyForFrame(frame);
        if (price.currency !== expected && price.currency !== "split") {
          findings.CURRENCY_DRIFT.push({
            pack: pack.collection, name: item.name, frame,
            stored: price.currency, expected
          });
        }
      }

      // ── MARKS_DRIFT (skip GM-overridden) ──
      if (!price.gmOverride) {
        const rarityMult = Number(price.rarityMult) || 1.0;
        const recomputed = pricing.computeListPrice({ tier, frame, hasTech, bound, rarityMult });
        const stored_marks = Number(price.marks) || 0;
        if (stored_marks >= 0 && Math.abs(stored_marks - recomputed) > MARKS_TOLERANCE) {
          findings.MARKS_DRIFT.push({
            pack: pack.collection, name: item.name, tier, frame, bound,
            stored: stored_marks, expected: recomputed,
            delta: stored_marks - recomputed
          });
        }
      }

      // ── TECH_NO_FUEL ──
      if (tech) {
        const recipe = Array.isArray(stored.materialOf) ? stored.materialOf : [];
        const hasRequired = recipe.some(r => REQUIRED_TECH_MATERIALS.has(String(r?.key ?? "").toLowerCase()));
        if (!hasRequired) {
          findings.TECH_NO_FUEL.push({
            pack: pack.collection, name: item.name,
            recipe: recipe.map(r => `${r.key}×${r.qty}`).join(", ") || "(empty)"
          });
        }
      }

      // ── SPLIT_VARIANCE ──
      if (price.split && typeof price.split === "object") {
        const sum = Object.values(price.split).reduce((a, v) => a + (Number(v) || 0), 0);
        if (Math.abs(sum - (Number(price.marks) || 0)) > MARKS_TOLERANCE) {
          findings.SPLIT_VARIANCE.push({
            pack: pack.collection, name: item.name,
            split_sum: sum, marks: price.marks, delta: sum - price.marks
          });
        }
      }
    }
  }

  // ── Console output ────────────────────────────────────────────────────────
  console.log("[price-audit] totals", totals);
  for (const [key, rows] of Object.entries(findings)) {
    if (!rows.length) { console.log(`[price-audit] ${key}: 0`); continue; }
    console.log(`[price-audit] ${key}: ${rows.length}`);
    console.table(rows.slice(0, 25));
    if (rows.length > 25) console.log(`[price-audit] (… ${rows.length - 25} more)`);
  }

  // ── Chat card summary ─────────────────────────────────────────────────────
  if (POST_CHAT_CARD) {
    const fmt = (k) => `<li><strong>${k}:</strong> ${findings[k].length}</li>`;
    const allClean = Object.values(findings).every(arr => arr.length === 0);
    const ok = allClean
      ? `<p style="color:#5fb35f"><strong>Audit clean</strong> — no drift detected across ${totals.gear} gear items in ${selectedPacks.length} pack(s).</p>`
      : `<p style="color:#d4a35f"><strong>Drift detected</strong> across ${totals.gear} gear items in ${selectedPacks.length} pack(s). See console for full tables.</p>`;
    await ChatMessage.create({
      whisper: ChatMessage.getWhisperRecipients("GM"),
      content: `
        <div class="ft-misfire-box" style="border-color:#d4a35f">
          <strong>📊 RFI Price Audit</strong>
          ${ok}
          <ul style="margin:0.4rem 0;padding-left:1.2rem;">
            ${["MISSING","CURRENCY_DRIFT","MARKS_DRIFT","TECH_NO_FUEL","SPLIT_VARIANCE"].map(fmt).join("")}
          </ul>
          <p style="font-size:0.78rem;opacity:0.7;margin:0;">
            ${totals.gmOverride} item(s) skipped — flagged GM override (Woundhealer rule).
          </p>
        </div>`
    });
  }
})();

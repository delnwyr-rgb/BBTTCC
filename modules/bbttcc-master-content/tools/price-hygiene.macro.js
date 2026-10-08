/* price-hygiene.macro.js — PRICING HYGIENE PASS (2026-10-07, owner ask). Companion to price-audit (read) and price-stamp (fill-only).
 * Paste into a GM macro on EMBER (or click its stub in "Bad Eden: Tool Macros"). DRY_RUN = true logs every change; false writes.
 * Surface: every Item compendium + the world item directory, EXCEPT the monster kit (bbttcc-master-content.npc-abilities) and the Path
 * starter kits (fourththing.starter-manifestations) — neither is market goods, so neither carries a market price.
 * Per gear item (never one with price.gmOverride — the Woundhealer rule):
 *   1. FRAME   legacy `equipment` stamped frame "armor" by the type map: → "shield" when system.type.value is "shield", stays "armor" when
 *              it is light/medium/heavy, otherwise → "talisman" (the Wondrous Items — worn charms, relic-trinkets).
 *   2. RARITY  price.rarityMult ← RARITY_MULT[system.rarity] when the item declares one; an item filed under "Wondrous Items" with no
 *              rarity reads "rare" (×2 — this reproduces the hand prices the folder already carried: Quantum Staff 300, Cudgel 300).
 *   3. FUEL    technomagical items whose recipe lacks a binding material (rubric §6) get witness-glass ×1 appended to materialOf.
 *   4. PRICE   currency ← frame default (unless split) · marks ← computeListPrice(tier, frame, tech, bound, rarityMult) · saleBack.
 *   5. MISSING items with no price block get the full default stamp.
 *   6. MATERIALS (frame material) price as rubric §3: materialUnitPriceMarks(tier, rarityMult) × stack charges — the Forge already
 *      values them that way; the market had them at tier base PER STACK (Yesodium 1350 vs the Forge's 135), which made crafting
 *      cost more than buying. Path starter-kit forms (tag starter-kit) are granted, not sold — skipped.
 * Needs the 2026-10-07 pricing tables (shield / vestment / footwear / talisman / implant / trade-good / gear frames + RARITY_MULT)
 * — the macro refuses on an older build.
 */
const DRY_RUN = true;
const SKIP_PACKS = new Set(["bbttcc-master-content.npc-abilities", "fourththing.starter-manifestations"]);
const WONDROUS_FOLDER = "Wondrous Items";
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const P = game.fourththing?.pricing, R = game.fourththing?.items;
  if (!P || !R) return ui.notifications.error("game.fourththing.pricing / .items unavailable.");
  if (!P.RARITY_MULT || !P.rarityMultFor) return ui.notifications.error("pricing tables are pre-2026-10-07 — deploy rfi-pricing.js, restart, hard reload.");
  const REQ = new Set(["yesodium", "witness-glass", "hex-glyph-plate", "pre-fall-component"]);
  const eq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const log = []; const tally = { scanned: 0, frame: 0, rarity: 0, fuel: 0, price: 0, missing: 0, items: 0, skippedOverride: 0 };
  const sources = game.packs.filter(p => p.documentName === "Item" && !SKIP_PACKS.has(p.collection)).map(p => ({ pack: p, label: p.collection, fetch: () => p.getDocuments() }));
  sources.push({ pack: null, label: "(world)", fetch: async () => Array.from(game.items) });
  for (const src of sources) {
    let docs; try { docs = await src.fetch(); } catch (e) { console.warn("[price-hygiene] load failed", src.label, e); continue; }
    const wasLocked = src.pack?.locked ?? false; if (!DRY_RUN && wasLocked) await src.pack.configure({ locked: false });
    try {
      const folderName = (it) => (src.pack ? src.pack.folders.get(it.folder) : game.folders.get(it.folder))?.name ?? "";
      for (const it of docs) {
        if (!R.is.isGear(it)) continue; tally.scanned++;
        if ((it.system?.tags ?? []).includes("starter-kit") || it.flags?.fourththing?.starterKit) continue;   // Path grants, not market goods
        const st = foundry.utils.deepClone(it.getFlag("fourththing", "rfi.item") ?? {}); const why = []; const upd = {};
        if (st.price?.gmOverride) { tally.skippedOverride++; continue; }
        // 1. frame
        let frame = st.frame ?? "tool";
        if (it.type === "equipment" && frame === "armor") {
          const tv = String(it.system?.type?.value ?? "").toLowerCase();
          const nf = tv === "shield" ? "shield" : ["light", "medium", "heavy"].includes(tv) ? "armor" : "talisman";
          if (nf !== frame) { why.push(`frame ${frame}→${nf}`); upd["flags.fourththing.rfi.item.frame"] = nf; frame = nf; tally.frame++; }
        }
        // 2. rarity
        let rarityMult = Number(st.price?.rarityMult) || 1;
        const declared = String(it.system?.rarity ?? "").trim();
        if (declared && P.RARITY_MULT[declared] !== undefined) { if (P.RARITY_MULT[declared] !== rarityMult) { why.push(`rarity ${declared} ×${P.RARITY_MULT[declared]}`); rarityMult = P.RARITY_MULT[declared]; tally.rarity++; } }
        else if (folderName(it) === WONDROUS_FOLDER && frame !== "material" && rarityMult === 1) { why.push("wondrous → rare ×2"); rarityMult = 2; tally.rarity++; }
        // 3. tech fuel
        let materialOf = Array.isArray(st.materialOf) ? st.materialOf.map(m => typeof m === "string" ? { key: m, qty: 1 } : m) : [];
        if (st.tech && !materialOf.some(m => REQ.has(String(m?.key ?? "").toLowerCase()))) { materialOf = [...materialOf, { key: "witness-glass", qty: 1 }]; upd["flags.fourththing.rfi.item.materialOf"] = materialOf; why.push("recipe + witness-glass ×1"); tally.fuel++; }
        // 4/5. price
        const tier = st.tier ?? "I", bound = st.bound ?? "free", hasTech = !!st.tech;
        const marks = frame === "material"
          ? P.materialUnitPriceMarks(tier, rarityMult) * Math.max(1, Number(st.charges) || 1)
          : P.computeListPrice({ tier, frame, hasTech, bound, rarityMult });
        const currency = st.price?.currency === "split" ? "split" : P.defaultCurrencyForFrame(frame);
        const saleBack = P.computeSaleBack(marks, bound);
        if (!st.price) {
          upd["flags.fourththing.rfi.item.price"] = { marks, currency, gmOverride: false, altCurrencies: {}, split: null, rarityMult, notes: `T${tier} ${frame} stamp (hygiene 2026-10-07)`, bound, saleBack };
          why.push(`MISSING → ${marks} ${currency}`); tally.missing++;
        } else {
          const p = st.price; const changes = {};
          if (p.currency !== currency) changes["currency"] = currency;
          if (Math.abs((Number(p.marks) || 0) - marks) > 5) changes["marks"] = marks;
          if ((Number(p.rarityMult) || 1) !== rarityMult) changes["rarityMult"] = rarityMult;
          if (changes.marks !== undefined || changes.rarityMult !== undefined || (Number(p.saleBack) || 0) !== saleBack) changes["saleBack"] = saleBack;
          if (p.bound !== bound) changes["bound"] = bound;
          if (Object.keys(changes).length) {
            changes["notes"] = `T${tier} ${frame}${hasTech ? " × tech 2.0" : ""}${bound !== "free" ? ` × ${bound}` : ""}${rarityMult !== 1 ? ` × rarity ${rarityMult}` : ""} (hygiene 2026-10-07; was ${p.marks} ${p.currency})`;
            for (const [k, v] of Object.entries(changes)) upd[`flags.fourththing.rfi.item.price.${k}`] = v;
            why.push(`${p.marks} ${p.currency} → ${marks} ${currency}`); tally.price++;
          }
        }
        if (!Object.keys(upd).length) continue;
        tally.items++;
        log.push(`${DRY_RUN ? "·" : "✔"} ${src.label} › ${it.name} [T${tier} ${frame}${it.type === "equipment" ? "/equipment" : ""}]  ${why.join(" · ")}`);
        if (!DRY_RUN) await it.update(upd);
      }
    } finally { if (!DRY_RUN && wasLocked) await src.pack.configure({ locked: true }); }
  }
  console.log(`[price-hygiene] ${DRY_RUN ? "DRY RUN" : "APPLIED"} — ${tally.items} item(s) of ${tally.scanned} gear: frame ${tally.frame} · rarity ${tally.rarity} · fuel ${tally.fuel} · price ${tally.price} · missing ${tally.missing} · override-skipped ${tally.skippedOverride}\n` + log.join("\n"));
  ui.notifications.info(`price-hygiene ${DRY_RUN ? "dry run" : "applied"}: ${tally.items} items — see console (F12).`);
})();

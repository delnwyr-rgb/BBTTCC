#!/usr/bin/env node
/* build-price-hygiene.mjs — compile the PRICING HYGIENE PASS from a RAW live dump of bbttcc-master-content.items (2026-10-07).
 * Usage (repo root): node modules/bbttcc-master-content/tools/build-price-hygiene.mjs <items.jsonl> [--out macro.js]
 * Why a generated macro: the legacy wondrous pieces are stored as type "equipment" with a dnd `system.rarity`, but the running
 * system loads them as "gear" and strips `rarity` — a live macro cannot see either. The raw dump can, so the plan is compiled here
 * with the same tables (systems/fourththing/rfi-pricing.js) and every write is guarded by the expected old value.
 * Rules = price-hygiene.macro.js §1–6: re-frame legacy equipment (armor-typed → armor / shield / talisman) · rarityMult from the
 * declared rarity (or ×2 "rare" for the Wondrous Items folder) · witness-glass for tech recipes with no binding material ·
 * currency ← frame default · marks ← rubric (materials: unit × stack) · saleBack · MISSING → stamp. Skips gmOverride + starter-kit.
 */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2); const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [ITEMS] = argv.filter((a, i) => !a.startsWith("--") && !(argv[i - 1] || "").startsWith("--"));
if (!ITEMS) { console.error("usage: build-price-hygiene.mjs <items.jsonl> [--out macro.js]"); process.exit(2); }
const STAMP = "2026-10-07", OUT = opt("--out", path.join(HERE, `price-hygiene-${STAMP}.macro.js`));
globalThis.Hooks = { on() {}, once() {}, callAll() {} }; globalThis.game = { settings: { get() { return undefined; } } };
const P = await import(pathToFileURL(path.resolve(HERE, "../../../systems/fourththing/rfi-pricing.js")).href);
const REQ = new Set(["yesodium", "witness-glass", "hex-glyph-plate", "pre-fall-component"]);
const rows = fs.readFileSync(ITEMS, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
const folders = Object.fromEntries(rows.filter(r => r.k.startsWith("!folders!")).map(r => [r.v._id, r.v.name]));
const items = rows.filter(r => r.k.startsWith("!items!")).map(r => r.v);
const plan = []; const tally = { scanned: 0, frame: 0, rarity: 0, fuel: 0, price: 0, missing: 0 };
for (const it of items) {
  const st = it.flags?.fourththing?.rfi?.item; if (!st) continue; tally.scanned++;
  if ((it.system?.tags ?? []).includes("starter-kit") || it.flags?.fourththing?.starterKit) continue;
  if (st.price?.gmOverride) continue;
  const set = {}, expect = {}, why = [];
  let frame = st.frame ?? "tool";
  if (it.type === "equipment" && frame === "armor") {
    const tv = String(it.system?.type?.value ?? "").toLowerCase();
    const nf = tv === "shield" ? "shield" : ["light", "medium", "heavy"].includes(tv) ? "armor" : "talisman";
    if (nf !== frame) { set["flags.fourththing.rfi.item.frame"] = nf; expect["flags.fourththing.rfi.item.frame"] = frame; why.push(`frame ${frame}→${nf}`); frame = nf; tally.frame++; }
  }
  let rarityMult = Number(st.price?.rarityMult) || 1;
  const declared = String(it.system?.rarity ?? "").trim();
  if (declared && P.RARITY_MULT[declared] !== undefined) { if (P.RARITY_MULT[declared] !== rarityMult) { why.push(`rarity ${declared} ×${P.RARITY_MULT[declared]}`); rarityMult = P.RARITY_MULT[declared]; tally.rarity++; } }
  else if (folders[it.folder] === "Wondrous Items" && frame !== "material" && rarityMult === 1) { why.push("wondrous → rare ×2"); rarityMult = 2; tally.rarity++; }
  let materialOf = Array.isArray(st.materialOf) ? st.materialOf.map(m => typeof m === "string" ? { key: m, qty: 1 } : m) : [];
  if (st.tech && !materialOf.some(m => REQ.has(String(m?.key ?? "").toLowerCase()))) { const nm = [...materialOf, { key: "witness-glass", qty: 1 }]; set["flags.fourththing.rfi.item.materialOf"] = nm; expect["flags.fourththing.rfi.item.materialOf"] = st.materialOf ?? null; why.push("recipe + witness-glass ×1"); tally.fuel++; }
  const tier = st.tier ?? "I", bound = st.bound ?? "free", hasTech = !!st.tech;
  const marks = frame === "material" ? P.materialUnitPriceMarks(tier, rarityMult) * Math.max(1, Number(st.charges) || 1) : P.computeListPrice({ tier, frame, hasTech, bound, rarityMult });
  const currency = st.price?.currency === "split" ? "split" : P.defaultCurrencyForFrame(frame);
  const saleBack = P.computeSaleBack(marks, bound);
  if (!st.price) { set["flags.fourththing.rfi.item.price"] = { marks, currency, gmOverride: false, altCurrencies: {}, split: null, rarityMult, notes: `T${tier} ${frame} stamp (hygiene ${STAMP})`, bound, saleBack }; expect["flags.fourththing.rfi.item.price"] = null; why.push(`MISSING → ${marks} ${currency}`); tally.missing++; }
  else {
    const p = st.price, ch = {};
    if (p.currency !== currency) ch.currency = currency;
    if (Math.abs((Number(p.marks) || 0) - marks) > 5) ch.marks = marks;
    if ((Number(p.rarityMult) || 1) !== rarityMult) ch.rarityMult = rarityMult;
    if (ch.marks !== undefined || ch.rarityMult !== undefined || (Number(p.saleBack) || 0) !== saleBack) ch.saleBack = saleBack;
    if (p.bound !== bound) ch.bound = bound;
    if (Object.keys(ch).length) {
      ch.notes = `T${tier} ${frame}${hasTech ? " × tech 2.0" : ""}${bound !== "free" ? ` × ${bound}` : ""}${rarityMult !== 1 ? ` × rarity ${rarityMult}` : ""} (hygiene ${STAMP}; was ${p.marks} ${p.currency})`;
      for (const [k, v] of Object.entries(ch)) { set[`flags.fourththing.rfi.item.price.${k}`] = v; expect[`flags.fourththing.rfi.item.price.${k}`] = p[k] ?? null; }
      why.push(`${p.marks} ${p.currency} → ${marks} ${currency}`); tally.price++;
    }
  }
  if (!Object.keys(set).length) continue;
  plan.push({ id: it._id, name: it.name, type: it.type, folder: folders[it.folder] || "", tier, frame, set, expect, why });
}
fs.writeFileSync(OUT, `/* ${path.basename(OUT)} — PRICING HYGIENE PASS, bbttcc-master-content.items (GENERATED ${STAMP} by build-price-hygiene.mjs — rebuild from a fresh dump).
 * Paste into a GM macro on EMBER (or click its stub). DRY_RUN = true prints the plan; false writes. ${plan.length} items: frame ${tally.frame} · rarity ${tally.rarity}
 * · fuel ${tally.fuel} · price ${tally.price} · missing ${tally.missing} (of ${tally.scanned} gear). Every field is guarded by its expected old value (drift = skip + log).
 * Materials move to rubric §3 unit × stack (the Forge's valuation); wondrous equipment is re-framed talisman × its declared rarity.
 */
const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.items";
const PLAN = ${JSON.stringify(plan)};
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const pack = game.packs.get(PACK_ID); if (!pack) return ui.notifications.error(\`No pack \${PACK_ID}\`);
  const get = (doc, k) => foundry.utils.getProperty(doc._source ?? doc, k);
  const eq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const log = []; let wrote = 0, skipped = 0;
  const wasLocked = pack.locked;
  try {
    if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
    for (const p of PLAN) {
      const d = await pack.getDocument(p.id);
      if (!d || d.name !== p.name) { log.push(\`✗ SKIP \${p.name} — not found / renamed\`); skipped++; continue; }
      const upd = {}; for (const [k, v] of Object.entries(p.set)) { if (eq(get(d, k), p.expect[k])) upd[k] = v; else { log.push(\`✗ drift \${p.name} \${k} = \${JSON.stringify(get(d, k))} (expected \${JSON.stringify(p.expect[k])})\`); skipped++; } }
      if (!Object.keys(upd).length) continue;
      log.push(\`\${DRY_RUN ? "·" : "✔"} \${p.folder ? p.folder + " › " : ""}\${p.name} [T\${p.tier} \${p.frame}]  \${p.why.join(" · ")}\`);
      if (!DRY_RUN) await d.update(upd); wrote++;
    }
  } finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  console.log(\`[price-hygiene-${STAMP}] \${DRY_RUN ? "DRY RUN" : "APPLIED"} — \${wrote} item(s), \${skipped} skip/drift\\n\` + log.join("\\n"));
  ui.notifications.info(\`price-hygiene \${DRY_RUN ? "dry run" : "applied"}: \${wrote} items, \${skipped} skipped — see console (F12).\`);
})();
`);
console.log(`build-price-hygiene: ${plan.length} items → ${OUT} · ${JSON.stringify(tally)}`);
for (const p of plan.filter(p => /Valhauler|Lens of Tikkun|Anchor of the Known|Quantum Staff|Yesodium$|Wrapped Leather|Crowned Pressed|Null-Field|Rad Suit|Reactor Shield|Glowstick/.test(p.name))) console.log(`  ${p.name.padEnd(30)} T${p.tier} ${p.frame.padEnd(8)} ${p.why.join(" · ")}`);

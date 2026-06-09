/*
 * verify-doctrine-vfx.macro.js — RUN IN-WORLD (GM). Read-only; writes nothing.
 *
 * Reports the doctrine VFX variety pass: for every registered doctrine maneuver /
 * strategic-activity spec (the ones carrying a `.category`), it resolves the thematic
 * effect/burst arrays against THIS world's Sequencer DB and reports whether each lands
 * on its intended thematic key or degrades to the proven fallback (last array entry).
 *
 * Use it to (a) confirm coverage, and (b) find which thematic JB2A keys didn't resolve
 * so they can be swapped — the effect still PLAYS either way (graceful fallback), this
 * just tells you where the fancy asset is or isn't landing. Set FIRE_SAMPLES=true to
 * also play one effect per category on the selected token (or screen-centre).
 */
(async () => {
const FIRE_SAMPLES = false;

const fx = game.bbttcc?.api?.fx;
if (!fx) return ui.notifications.error("[verify-doctrine-vfx] game.bbttcc.api.fx not found — is bbttcc-fx-integration active?");
const exists = (k) => { try { return !!globalThis.Sequencer?.Database?.entryExists?.(String(k)); } catch { return false; } };
const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);

// Pull doctrine specs (only those carry a `.category`); dedupe by key.
const seen = new Set();
const rows = [];
for (const [key, spec] of fx.registry) {
  if (!spec || !spec.category || seen.has(key)) continue;
  seen.add(key);
  const eff = arr(spec.effect), bur = arr(spec.burst);
  const effHit = eff.find(exists) || null;
  const burHit = bur.find(exists) || null;
  const effProven = eff[eff.length - 1];
  const burProven = bur[bur.length - 1];
  rows.push({
    key, cat: spec.category,
    effHit, burHit,
    effThematic: !!effHit && effHit !== effProven,   // landed on a non-final (fancy) key
    burThematic: !!burHit && burHit !== burProven,
    effMiss: !effHit, burMiss: !burHit
  });
}

rows.sort((a, b) => a.cat.localeCompare(b.cat) || a.key.localeCompare(b.key));

// Per-category summary
const cats = {};
for (const r of rows) {
  const c = (cats[r.cat] = cats[r.cat] || { n: 0, effThem: 0, burThem: 0, effMiss: 0 });
  c.n++; if (r.effThematic) c.effThem++; if (r.burThematic) c.burThem++; if (r.effMiss) c.effMiss++;
}

console.log(`%c[verify-doctrine-vfx] ${rows.length} doctrine specs · Sequencer=${!!globalThis.Sequence} JB2A=${!!game.modules.get("jb2a_patreon")?.active || !!game.modules.get("JB2A_DnD5e")?.active}`, "font-weight:bold");
console.log("=== per-category coverage (effect-thematic-hit / total · burst-thematic-hit) ===");
for (const [c, v] of Object.entries(cats).sort()) {
  console.log(`  ${c.padEnd(10)} ${String(v.effThem).padStart(2)}/${v.n} thematic effect · ${v.burThem}/${v.n} thematic burst${v.effMiss ? ` · ⚠ ${v.effMiss} effect MISS (no key resolved!)` : ""}`);
}

const fellBack = rows.filter((r) => !r.effThematic && !r.effMiss);
console.log(`\n=== effect fell back to PROVEN (thematic key didn't resolve — swap candidates) (${fellBack.length}) ===`);
console.log(fellBack.map((r) => `  [${r.cat}] ${r.key}`).join("\n") || "  (none — every thematic effect key resolved!)");

const misses = rows.filter((r) => r.effMiss || r.burMiss);
if (misses.length) console.warn(`\n⚠ ${misses.length} spec(s) had NO resolving key (effect or burst) — should be impossible if proven fallbacks are correct:`, misses.map((r) => r.key));

const totThem = rows.filter((r) => r.effThematic).length;
ui.notifications.info(`[verify-doctrine-vfx] ${rows.length} doctrines · ${totThem} landed a thematic effect, ${fellBack.length} on proven fallback. See console (F12).`);

if (FIRE_SAMPLES) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const oneePerCat = {};
  for (const r of rows) if (!oneePerCat[r.cat]) oneePerCat[r.cat] = r.key;
  ui.notifications.info("[verify-doctrine-vfx] firing one sample per category…");
  for (const [cat, key] of Object.entries(oneePerCat)) {
    await fx.playKey(key, { targetToken: canvas.tokens?.controlled?.[0] || null }, { phase: "resolve", banner: false });
    console.log(`  fired ${cat} → ${key}`);
    await wait(1100);
  }
}
})();

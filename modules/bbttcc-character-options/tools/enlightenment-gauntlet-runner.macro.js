// enlightenment-gauntlet-runner.macro.js — RUN IN-WORLD (GM), AFTER the Forge.
// ─────────────────────────────────────────────────────────────────────────────
// ENLIGHTENMENT GAUNTLET · Phase 3 — THE RUNNER. Black-box drives the live Enlightenment
// engine (it exposes NO API) by mutating items on the Forge's Pilgrim and observing the
// flag + Active Effects the engine reconciles. Asserts the contract the fixes established:
//   • NO-CLOBBER  — set any level (incl. dropdown-vocab: awakening/seeking/wisdom/...) →
//                   flags.bbttcc-character-options.enlightenment.level STICKS (was wiped to "").
//   • DISPLAY     — the engine preserves/derives a non-empty display label.
//   • AE-PARITY   — exactly one enlightenment ActiveEffect iff the level is AE-bearing,
//                   tagged with the right level; AE-bearing levels carry their changes.
//   • PRECEDENCE  — two canonical items → the HIGHER level wins (not first-seen).
//   • READY-RACE  — churning unrelated items never duplicates the enlightenment AE.
// CONTRACT (AE_BEARING) is kept in step with enlightenment.js EFFECTS — update it when the
// ladder is unified so the runner asserts the new contract.
// Output: console table + JSON (auto-downloaded) + GM chat card. Restores the Pilgrim clean.
(async () => {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const t0 = performance.now();
  const MOD = "bbttcc-character-options";
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // ── Manifest ──
  const journal = game.journal.getName("ENLIGHTGAUNTLET · Manifest");
  const M = journal?.getFlag(MOD, "gauntletManifest");
  if (!M) return ui.notifications.error("Manifest not found — run the Forge first.");
  const pilgrim = game.actors.get(M.pilgrimId);
  if (!pilgrim) return ui.notifications.error("Pilgrim actor missing — re-run the Forge.");

  // CONTRACT (unified ladder): every canonical level is AE-bearing (each has an EFFECTS entry).
  const CANON = M.canonicalKeys || ["unawakened", "awakening", "seeking", "wisdom", "understanding", "enlightened", "qliphothic"];
  const ALIASES = M.aliasMap || { awakened: "awakening", adept: "seeking", illuminated: "wisdom", transcendent: "enlightened", sleeper: "unawakened" };
  // A representative change each level-with-changes must carry (proves real mechanics).
  const CHANGE_PROBE = { awakening: "system.bonuses.abilities.save", seeking: "flags.dnd5e.skills.ins.adv", wisdom: "system.bonuses.abilities.check", enlightened: "system.bonuses.abilities.save", qliphothic: "system.traits.dr.value" };
  // Ascending order for the precedence probe (highest wins); qliphothic is the corruption branch.
  const LADDER = CANON;

  const title = (s) => String(s).replace(/(^|-)([a-z])/g, (_, p, c) => (p ? " " : "") + c.toUpperCase());
  const F = [];
  const check = (name, cond, detail = "") => { F.push({ name, pass: !!cond, detail }); if (!cond) console.warn("FAIL:", name, detail); };
  const enlightAEs = () => pilgrim.effects?.filter(e => e.getFlag(MOD, "enlightenment") === true) ?? [];
  // Poll until the engine has reacted (the reconciler is async + serialized) — deterministic,
  // unlike a fixed sleep that flakes on the first cold fire against a remote world.
  async function waitUntil(fn, ms = 3000, step = 50) {
    const t0 = performance.now();
    do { try { if (fn()) return true; } catch (_e) {} await sleep(step); } while (performance.now() - t0 < ms);
    return false;
  }

  async function resetPilgrim() {
    const items = pilgrim.items?.filter(i => /^enlightenment[:\-]/i.test(i.name) || i.getFlag?.(MOD, "category") === "enlightenment-levels").map(i => i.id) ?? [];
    if (items.length) { await pilgrim.deleteEmbeddedDocuments("Item", items); await waitUntil(() => enlightAEs().length === 0); }
    const aes = enlightAEs().map(e => e.id);
    if (aes.length) await pilgrim.deleteEmbeddedDocuments("ActiveEffect", aes);
    try { await pilgrim.unsetFlag(MOD, "enlightenment"); } catch (_e) {}
    await waitUntil(() => enlightAEs().length === 0 && !pilgrim.getFlag(MOD, "enlightenment")?.level);
  }

  // Create the level item the way the sheet dropdown does (category-flagged) — the path that
  // used to clobber — OR as a plain canonical-named item (the compendium drag path). Every
  // canonical level is AE-bearing, so wait for the AE to land before asserting.
  async function setLevel(slug, { viaCategory }) {
    const data = { name: `Enlightenment: ${title(slug)}`, type: "feat", img: "icons/svg/item-bag.svg" };
    if (viaCategory) data.flags = { [MOD]: { category: "enlightenment-levels" } };
    await pilgrim.createEmbeddedDocuments("Item", [data]);
    await waitUntil(() => enlightAEs().length >= 1 && !!pilgrim.getFlag(MOD, "enlightenment")?.level);
    await sleep(150); // let any second serialized reconcile pass drain to its final state
  }

  // ── 1. Canonical sweep (every level via the dropdown/category path — the clobber path) ──
  for (const slug of CANON) {
    await resetPilgrim();
    await setLevel(slug, { viaCategory: true });

    const flag = pilgrim.getFlag(MOD, "enlightenment") || {};
    const aes = enlightAEs();

    check(`[cat] ${slug} · no-clobber`, flag.level === slug, `flag.level=${JSON.stringify(flag.level)} expected ${slug}`);
    check(`[cat] ${slug} · display set`, typeof flag.display === "string" && flag.display.length > 0, `display=${JSON.stringify(flag.display)}`);
    check(`[cat] ${slug} · exactly 1 AE`, aes.length === 1, `got ${aes.length}`);
    if (aes.length) check(`[cat] ${slug} · AE tagged level`, aes[0].getFlag(MOD, "level") === slug, `AE level=${aes[0].getFlag(MOD, "level")}`);
  }

  // ── 2. Drag path (plain-named item) — confirms levels grant their representative change ──
  for (const slug of Object.keys(CHANGE_PROBE)) {
    await resetPilgrim();
    await setLevel(slug, { viaCategory: false });
    const aes = enlightAEs();
    const probe = CHANGE_PROBE[slug];
    check(`[drag] ${slug} · AE present`, aes.length === 1, `got ${aes.length}`);
    check(`[drag] ${slug} · carries ${probe}`, aes.length === 1 && (aes[0].changes ?? []).some(c => c.key === probe),
      `changes=${JSON.stringify((aes[0]?.changes ?? []).map(c => c.key))}`);
  }

  // ── 3. Legacy alias resolution — old AE-vocab items resolve to their canonical level ──
  for (const [legacy, canon] of Object.entries(ALIASES)) {
    await resetPilgrim();
    await setLevel(legacy, { viaCategory: false }); // e.g. "Enlightenment: Awakened"
    const lvl = pilgrim.getFlag(MOD, "enlightenment")?.level;
    check(`[alias] ${legacy}→${canon}`, lvl === canon, `got ${lvl}`);
    check(`[alias] ${legacy} · AE matches canon`, enlightAEs()[0]?.getFlag(MOD, "level") === canon, `AE level=${enlightAEs()[0]?.getFlag(MOD, "level")}`);
  }

  // ── 4. Precedence — two items, the HIGHER ascension level must win ──
  {
    await resetPilgrim();
    await pilgrim.createEmbeddedDocuments("Item", [
      { name: "Enlightenment: Awakening", type: "feat" },
      { name: "Enlightenment: Enlightened", type: "feat" }
    ]);
    await waitUntil(() => pilgrim.getFlag(MOD, "enlightenment")?.level === "enlightened");
    await sleep(200); // both serialized passes must drain so the AE count is final
    const lvl = pilgrim.getFlag(MOD, "enlightenment")?.level;
    check("precedence · highest wins", lvl === "enlightened", `got ${lvl} (expected enlightened idx ${LADDER.indexOf("enlightened")})`);
    check("precedence · single AE", enlightAEs().length === 1, `got ${enlightAEs().length}`);
  }

  // ── 5. Fix D — character level mirrors onto the owning faction's enlightenmentLevel ──
  {
    const order = game.actors.get(M.orderId);
    await resetPilgrim();
    await setLevel("enlightened", { viaCategory: true });
    await waitUntil(() => order?.getFlag("bbttcc-factions", "enlightenmentLevel") === "enlightened");
    check("fixD · faction mirrors enlightened", order?.getFlag("bbttcc-factions", "enlightenmentLevel") === "enlightened",
      `faction level=${order?.getFlag("bbttcc-factions", "enlightenmentLevel")}`);
    // qliphothic (corruption) must NOT represent the faction as a benevolent top level.
    await resetPilgrim();
    await setLevel("qliphothic", { viaCategory: true });
    await waitUntil(() => order?.getFlag("bbttcc-factions", "enlightenmentLevel") !== "enlightened");
    check("fixD · corruption not counted as ascension", order?.getFlag("bbttcc-factions", "enlightenmentLevel") !== "qliphothic",
      `faction level=${order?.getFlag("bbttcc-factions", "enlightenmentLevel")}`);
  }

  // ── 6. Ready-race idempotency — churning unrelated items never duplicates the AE ──
  {
    await resetPilgrim();
    await setLevel("awakening", { viaCategory: false });
    for (let i = 0; i < 3; i++) {
      const [probe] = await pilgrim.createEmbeddedDocuments("Item", [{ name: `ZZ churn ${i}`, type: "feat" }]);
      await sleep(120);
      await pilgrim.deleteEmbeddedDocuments("Item", [probe.id]);
      await sleep(120);
    }
    await waitUntil(() => enlightAEs().length === 1 && pilgrim.getFlag(MOD, "enlightenment")?.level === "awakening");
    await sleep(150);
    check("ready-race · still exactly 1 AE after churn", enlightAEs().length === 1, `got ${enlightAEs().length}`);
    check("ready-race · level intact after churn", pilgrim.getFlag(MOD, "enlightenment")?.level === "awakening",
      `level=${pilgrim.getFlag(MOD, "enlightenment")?.level}`);
  }

  // ── Restore ──
  await resetPilgrim();

  // ── Report ──
  const fails = F.filter(r => !r.pass);
  const ms = Math.round(performance.now() - t0);
  console.log(`%c=== ENLIGHTENMENT RUNNER — ${F.length} fires / ${fails.length} FAIL (${ms}ms) ===`,
    "font-weight:bold;color:" + (fails.length ? "#e66" : "#6c6"));
  console.table(F.map(r => ({ assertion: r.name, result: r.pass ? "PASS" : "FAIL", detail: r.detail })));

  try {
    const blob = new Blob([JSON.stringify({ when: new Date().toISOString(), fires: F.length, fails: fails.length, results: F }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "enlightenment-runner.json"; a.click();
  } catch (_e) {}

  const rows = (fails.length ? fails : F.slice(0, 8)).map(r =>
    `<tr><td>${r.pass ? "✅" : "❌"}</td><td>${r.name}</td><td style="opacity:.8">${r.detail}</td></tr>`).join("");
  ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM"),
    content: `<div class="bbttcc card"><h3>🧘 Enlightenment Runner</h3>
      <p><b>${F.length}</b> fires · <b style="color:${fails.length ? "#c44" : "#3a3"}">${fails.length}</b> FAIL</p>
      <table style="font-size:11px"><tr><th></th><th>assertion</th><th>detail</th></tr>${rows}</table>
      <small style="opacity:.7">${fails.length ? "showing failures" : "showing first 8 of " + F.length}</small></div>`
  });
  ui.notifications[fails.length ? "error" : "info"](`Enlightenment Runner: ${F.length} fires / ${fails.length} FAIL.`);
})();

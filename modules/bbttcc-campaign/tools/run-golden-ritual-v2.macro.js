// Bad Eden — GOLDEN RITUAL v2: catch a Golden v11 world up to the latest content, in one go (2026-09-21)
// ─────────────────────────────────────────────────────────────────────────────
// Load the golden master first (Saves → ⟲ Load golden master; the client reloads), THEN run this, THEN save the
// result as the new golden. Every step is a tool macro that ships idempotent — already-applied steps report "ok".
// The ritual fetches each macro from its module, forces its dry-run flag off, answers its confirm dialog "yes",
// silences its backup download (ONE backup of the story settings is taken up front), and runs it.
//
//   DRY_RUN true  = each step's own dry-run report only (steps without a dry-run flag are skipped, listed as "confirm-only")
//           false = apply everything
//
// What the ritual CANNOT do: the by-hand meter corrections from the 21st (the seven stale-id rows' net) — apply those
// after, if the golden predates them. After APPLIED: save as Golden v12 and run bin/ft-replay-story on it.

(async () => {
  const DRY_RUN = true;
  const STEPS = [
    // [path under /modules, kind]  kind: "flag" = has `const DRY_RUN = …;`   "confirm" = asks via Dialog.confirm only
    ["bbttcc-campaign/tools/patch-story-flow-playtest.macro.js",          "flag"],     // P1–P19: Acts 0–2 flow, Day's End, doctrine unlocks
    ["bbttcc-campaign/tools/seed-story-flow-acts-3-6.macro.js",           "flag"],     // S1–S16: Acts 3–6, scenes, recipes taught, Receipts, doctrine
    ["bbttcc-campaign/tools/seed-effects-act2.macro.js",                  "flag"],     // E1–E9: the beats do what they say; stale ids → @coalition
    ["bbttcc-factions/tools/repair-onboarded-faction-parity.macro.js",    "flag"],     // caps / morale / loyalty parity for onboarding-founded factions
    ["bbttcc-master-content/tools/create-rfi-materials-set-4.macro.js",   "confirm"],  // the 63 missing recipe materials
    ["bbttcc-territory/macros/patch-hex-node-drops.macro.js",             "confirm"],  // drop tables on every hex node
    ["bbttcc-master-content/tools/seed-recipe-books.macro.js",            "confirm"],  // opening recipe hands
    ["bbttcc-master-content/tools/grant-sell-surplus.macro.js",           "confirm"],  // Sell Surplus for founded factions
    ["bbttcc-master-content/tools/dedupe-doctrine-items.macro.js",        "confirm"],  // one of each doctrine item
    ["bbttcc-campaign/tools/settle-story-awards.macro.js",                "confirm"],  // back-pay quest/chapter/creature awards the store holds
    ["bbttcc-campaign/tools/settle-story-doctrine.macro.js",              "confirm"]   // back-grant the doctrine the played beats earned
  ];

  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications?.error("GM only");
  const api = game.bbttcc?.api?.campaign; const cid = api?.getActiveCampaignId?.(); const camp = cid ? api.getCampaign(cid) : null;
  if (!camp) return ui.notifications?.error("No active campaign");
  if (!/thatward/i.test(String(camp.label || camp.title || ""))) return ui.notifications?.error(`Active campaign is "${camp.label}" — the ritual is for Thatward's Ho!`);
  const esc = s => String(s ?? "").replace(/</g, "&lt;"); const rows = []; const t0 = Date.now();

  if (!DRY_RUN) {
    const snap = {}; for (const k of ["campaigns", "quests", "encounterTables", "storyState", "directorState", "awardsLedger"]) { try { snap[k] = game.settings.get(NS, k); } catch (_e) {} }
    try { snap["fourththing.recipeBook"] = game.settings.get("fourththing", "recipeBook"); } catch (_e) {}
    (foundry.utils.saveDataToFile || saveDataToFile)(JSON.stringify({ kind: "bbttcc-golden-ritual-v2-backup", at: Date.now(), campaignId: cid, settings: snap }), "application/json", `backup-before-golden-ritual-v2-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  }

  const realConfirm = Dialog.confirm; const realCreateEl = document.createElement.bind(document);
  globalThis.__ritualNoSave = () => {};
  for (const [path, kind] of STEPS) {
    const name = path.split("/").pop().replace(/\.macro\.js$/, ""); const t1 = Date.now();
    if (DRY_RUN && kind === "confirm") { rows.push([name, "· confirm-only — runs on APPLY (its console table is the dry run)"]); continue; }
    try {
      const res = await fetch(`/modules/${path}?ritual=${Date.now()}`); if (!res.ok) throw new Error(`fetch ${res.status}`);
      let src = await res.text();
      if (kind === "flag") { if (!/const DRY_RUN\s*=\s*(true|false)\s*;/.test(src)) throw new Error("no DRY_RUN flag found"); src = src.replace(/const DRY_RUN\s*=\s*(true|false)\s*;/, `const DRY_RUN = ${DRY_RUN};`); }
      src = src.replace(/\(foundry\.utils\.saveDataToFile \|\| saveDataToFile\)/g, "__ritualNoSave").replace(/foundry\.utils\.saveDataToFile\s*\(/g, "__ritualNoSave(").replace(/(?<![.\w])saveDataToFile\s*\(/g, "__ritualNoSave(");
      // the newer macros download their backup through an <a download> click — swallow it (the one backup above covers them)
      src = src.replace(/a\.click\(\);/g, "/* ritual: no per-macro download */");
      if (!DRY_RUN) Dialog.confirm = async () => true;   // every "Apply?" is yes during the ritual
      try { await (0, eval)(src); } finally { Dialog.confirm = realConfirm; }
      rows.push([name, `✓ ${Math.round((Date.now() - t1) / 100) / 10}s`]);
    } catch (e) { console.error("[golden-ritual-v2] step failed:", name, e); rows.push([name, `✗ ${esc(e?.message || e)} — STOPPED`]); break; }
  }
  Dialog.confirm = realConfirm;
  if (!DRY_RUN) { try { await api.story?.project?.(cid); } catch (_e) {} }

  const banner = DRY_RUN ? "DRY RUN — the flag steps ran report-only (read their cards); confirm-only steps run on APPLY. Set DRY_RUN = false to apply." : "APPLIED — save this world as the new golden master.";
  await ChatMessage.create({ content: `<div style="font-size:12px;border-left:3px solid #d9a441;padding:.4em .6em;background:rgba(217,164,65,.08)"><b>🜂 GOLDEN RITUAL v2 — ${banner}</b> (${Math.round((Date.now() - t0) / 1000)}s)<table style="margin-top:.3em">${rows.map(([n, r]) => `<tr><td style="padding-right:.6em"><code>${esc(n)}</code></td><td>${r}</td></tr>`).join("")}</table></div>`, whisper: game.users.filter(u => u.isGM).map(u => u.id) });
  ui.notifications?.info(`Golden ritual v2: ${DRY_RUN ? "dry run done" : "applied"}.`);
})();

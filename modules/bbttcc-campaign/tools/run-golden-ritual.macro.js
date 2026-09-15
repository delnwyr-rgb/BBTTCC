// Bad Eden — RUN THE GOLDEN RITUAL: every seeder since Golden v4, in order, in one go (2026-09-14)
// ─────────────────────────────────────────────────────────────────────────────
// Fetches each tool macro from this module's tools folder, sets its DRY_RUN to the master flag below,
// silences its per-macro backup download (ONE backup of the five story settings is taken up front),
// and runs them in the order the story needs. Every step is idempotent, so re-running on a world that
// already has some of them is safe — already-applied steps report "ok (already)".
//
//   DRY_RUN     true  = every step runs in report-only mode (read the chat), nothing written
//               false = apply
//   RESET_STORE true  = clear the story store FIRST (ONLY right after loading a from-the-top golden that
//                       predates the store; never on a world with play in it)
//
// After APPLIED: export the campaign bundle and run `bin/ft-replay-story` on it, then re-save the golden.

(async () => {
  const DRY_RUN = true;
  const RESET_STORE = false;
  const STEPS = [
    "patch-leyline-stabilizer-gate",   // 09-10  Leyline Stabilizer waits for Yarrow's HQ beat
    "seed-lyrenn-blast-treatment",     // 09-13  That One Night: the door beat, the Spine, Fallout Bloom, hub gates, the Choir
    "patch-lyrenn-word-gates",         // 09-13  the two summons Words gate on their quests
    "seed-spark-endings",              // 09-13  sparks in the world: placements + closer stamps + Statues double-completer fix
    "patch-khezek-timeline",           // 09-13  Khezek-Tor canon prose, personas, page, hex notes
    "seed-tamsin-dream",               // 09-13  the cold open returns as the Father's dream
    "patch-hum-tent-rails",            // 09-14  the Tent on rails out of Allesh-Gilliam
    "seed-hum-travel-entries",         // 09-14  the Hum's rungs in the terrain tables per act (+ ambient)
    "scrub-orphan-beats",              // 09-14  14 dead beats removed
    "patch-review-beats",              // 09-14  stubs deleted, back stairs/generator hard-gated, Fixit ride to Act 2, Vault colour folded
    "patch-opening-closer",            // 09-14  the Opening Scene ends the Opening and sets Act 1
    "patch-vault-allies",              // 09-15  Vault rescue → Allies; Back Stairs/Generator gated on it; Siege Week gone; Touring Gift ends "kept"
    "migrate-story-declarations"       // LAST   declares every beat (quest · chapter · ending), bootstraps + projects the store,
  ];

  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications?.error("GM only");
  const api = game.bbttcc?.api?.campaign;
  const cid = api?.getActiveCampaignId?.(); const camp = cid ? api.getCampaign(cid) : null;
  if (!camp) return ui.notifications?.error("No active campaign");
  if (!/thatward/i.test(String(camp.label || camp.title || ""))) return ui.notifications?.error(`Active campaign is "${camp.label}" — the ritual is for Thatward's Ho!`);
  if (!api.story?.state) return ui.notifications?.error("story API missing — F5 after deploy");

  const esc = s => String(s ?? "").replace(/</g, "&lt;");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rows = []; const t0 = Date.now();

  // ── one backup up front ────────────────────────────────────────────────────
  if (!DRY_RUN) {
    const snap = {}; for (const k of ["campaigns", "quests", "encounterTables", "storyState", "directorState"]) { try { snap[k] = game.settings.get(NS, k); } catch (_e) {} }
    (foundry.utils.saveDataToFile || saveDataToFile)(JSON.stringify({ kind: "bbttcc-golden-ritual-backup", at: Date.now(), campaignId: cid, settings: snap }), "application/json", `backup-before-golden-ritual-${stamp}.json`);
    if (RESET_STORE) { await api.story.reset(cid); rows.push(["story.reset", "✓ store cleared"]); }
  } else if (RESET_STORE) rows.push(["story.reset", "· would clear the store"]);

  globalThis.__ritualNoSave = () => {};   // per-macro backups are silenced; the one above covers them
  for (const name of STEPS) {
    const t1 = Date.now();
    try {
      const url = `/modules/bbttcc-campaign/tools/${name}.macro.js?ritual=${Date.now()}`;
      const res = await fetch(url); if (!res.ok) throw new Error(`fetch ${res.status}`);
      let src = await res.text();
      if (!/const DRY_RUN\s*=\s*(true|false)\s*;/.test(src)) throw new Error("no DRY_RUN flag found");
      src = src.replace(/const DRY_RUN\s*=\s*(true|false)\s*;/, `const DRY_RUN = ${DRY_RUN};`);
      src = src.replace(/\(foundry\.utils\.saveDataToFile \|\| saveDataToFile\)/g, "__ritualNoSave").replace(/foundry\.utils\.saveDataToFile\s*\(/g, "__ritualNoSave(").replace(/(?<![.\w])saveDataToFile\s*\(/g, "__ritualNoSave(");
      const p = (0, eval)(src);          // each tool is an async IIFE — its promise is the last expression
      await p;
      rows.push([name, `✓ ${Math.round((Date.now() - t1) / 100) / 10}s`]);
    } catch (e) {
      console.error("[golden-ritual] step failed:", name, e);
      rows.push([name, `✗ ${esc(e?.message || e)} — STOPPED`]);
      break;
    }
  }
  if (!DRY_RUN) { try { await api.story.project(cid); } catch (_e) {} }

  const banner = DRY_RUN ? "DRY RUN — every step ran in report-only mode; read each step's card above. Set DRY_RUN = false to apply." : "APPLIED.";
  await ChatMessage.create({ content: `<div style="font-size:12px;border-left:3px solid #d9a441;padding:.4em .6em;background:rgba(217,164,65,.08)"><b>🜂 GOLDEN RITUAL — ${banner}</b> (${Math.round((Date.now() - t0) / 1000)}s)<br>${rows.map(([n, r]) => `&nbsp;${esc(n)} — ${r}`).join("<br>")}<br><i>${DRY_RUN ? "" : "Next: export the bundle → bin/ft-replay-story → re-save the golden."}</i></div>`, whisper: game.users.filter(u => u.isGM).map(u => u.id) });
  ui.notifications?.info(`Golden ritual: ${banner}`);
})();

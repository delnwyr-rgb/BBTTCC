/* run-catch-up-2026-09-30.macro.js — THE UBER MACRO: every macro Dave is in arrears on, in order, in one run. RUN IN-WORLD (GM, ember).
 * ─────────────────────────────────────────────────────────────────────────────
 * Audited against save 6i2gygbybk4v "Before Retrofit Update" (turn 3, Act 3): the older owed macros are ALREADY applied there
 * (faction parity opCaps, Sell Surplus, starter charters, hire catalog, spark endings, grief-town evergreen, Chuckle v3.2,
 * Soft Landing v2, Stillwater v2). What is NOT applied = the 12 retrofit seeders, the Bandit Lord rename, the two new town hubs,
 * plus two idempotent stragglers (restamp-techniques, patch-lyrenn-word-gates) that report "nothing to do" if already run.
 *
 * HOW IT WORKS: fetches each tool macro's source from the module tools folder, forces its DRY_RUN to this macro's DRY_RUN,
 * sets per-step constants (TOWN_KEY for the hub runner), and runs it as an async function, awaiting its result before the next
 * step (every seeder re-reads the campaigns setting, so each step sees the previous step's writes). One campaigns backup is
 * downloaded up front; the per-step backup downloads and confirm dialogs inside the sub-macros are suppressed for the run.
 *
 * HOW TO RUN: 1) DRY_RUN = true (default) → every step runs in its own dry-run mode and reports to the console (F12);
 *             2) read the summary table; 3) set DRY_RUN = false, run again; 4) F5. Re-running is safe — every step is idempotent, and
 *             since 2026-10-01 a seeder never overwrites a story script edited after seeding (it reports it and skips; the dated patch macros repair seeded worlds).
 * Steps can be switched off with `enabled: false`. A failing step stops the run unless CONTINUE_ON_ERROR = true.
 */
(async () => {
  const DRY_RUN = true;                    // <-- master switch: false = APPLY everything below, in order
  const CONTINUE_ON_ERROR = false;         // true = keep going past a failed step (the summary shows which failed)
  const AUTO_CONFIRM = true;               // answer any Dialog.confirm inside a sub-macro with "yes" (only matters when applying)
  const SUPPRESS_STEP_BACKUPS = true;      // one backup up front instead of a download per step

  const STEPS = [
    // wave 1 — the Chuckle shape retrofits (2026-09-27)
    { file: "modules/bbttcc-campaign/tools/seed-allesh-gilliam-retrofit.macro.js", label: "Allesh-Gilliam retrofit (spy arc + THE PIPELINE)", enabled: true },
    { file: "modules/bbttcc-campaign/tools/seed-khezek-tor-retrofit.macro.js",     label: "Khezek-Tor retrofit (THE OFFICIAL WORD, Bez)", enabled: true },
    { file: "modules/bbttcc-campaign/tools/seed-fixit-retrofit.macro.js",          label: "Fixit retrofit (Route Board, the Certification)", enabled: true },
    { file: "modules/bbttcc-campaign/tools/seed-lyrenn-retrofit.macro.js",         label: "Lyrenn retrofit (choir children, vault label, Wren)", enabled: true },
    { file: "modules/bbttcc-campaign/tools/seed-gloomgill-retrofit.macro.js",      label: "Gloomgill retrofit (examiner, receipts as answers, Final Fact)", enabled: true },
    // wave 2 (2026-09-27)
    { file: "modules/bbttcc-campaign/tools/seed-crown-mall-retrofit.macro.js",     label: "Crown Mall retrofit (Donny, Miss June, the clip)", enabled: true },
    { file: "modules/bbttcc-campaign/tools/seed-widening-trail-retrofit.macro.js", label: "Widening Trail retrofit (chapel, wagon, Legansus)", enabled: true },
    { file: "modules/bbttcc-campaign/tools/seed-hidden-vault-retrofit.macro.js",   label: "Hidden Vault retrofit (Gilbert, Lars, Sox, the manifest)", enabled: true },
    { file: "modules/bbttcc-campaign/tools/seed-maneuver-vault-retrofit.macro.js", label: "Maneuver Vault retrofit (sealed records, pulled files)", enabled: true },
    { file: "modules/bbttcc-campaign/tools/seed-circuit-riders-retrofit.macro.js", label: "Circuit Riders retrofit (Captain Robot voiced, FILE IT)", enabled: true },
    { file: "modules/bbttcc-campaign/tools/seed-forgotten-cause-retrofit.macro.js",label: "Forgotten Cause retrofit (the Maître-D', the guest list)", enabled: true },
    { file: "modules/bbttcc-campaign/tools/seed-sarmoung-hum-retrofit.macro.js",   label: "Sarmoung Hum (Tier 1 only: speakers + exits)", enabled: true },
    // rulings + hubs (2026-09-27 → 30)
    { file: "modules/bbttcc-mal-voice/tools/patch-bandit-lord-lady-ralph-maccio.macro.js", label: "Bandit Lord → Lady Ralph Maccio", enabled: true },
    { file: "modules/bbttcc-travel/tools/town-hubs/setup-town-hub.macro.js", label: "Town hub: Soft Landing", enabled: true, vars: { TOWN_KEY: "softlanding" } },
    { file: "modules/bbttcc-travel/tools/town-hubs/setup-town-hub.macro.js", label: "Town hub: Stillwater", enabled: true, vars: { TOWN_KEY: "stillwater" } },
    // idempotent stragglers — report "nothing to do" when already applied
    { file: "modules/bbttcc-master-content/tools/restamp-techniques.macro.js", label: "Restamp techniques R1–R6 (pack + actors)", enabled: true },
    { file: "modules/bbttcc-campaign/tools/patch-lyrenn-word-gates.macro.js",  label: "Lyrenn word gates (summons gated on quest state)", enabled: true },
  ];

  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const NS = "bbttcc-campaign";
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const summary = []; const t0 = Date.now();
  const tag = `[catch-up ${DRY_RUN ? "DRY RUN" : "APPLY"}]`;

  // one backup up front (campaigns setting = what every seeder rewrites)
  if (!DRY_RUN) {
    try {
      const raw = game.settings.get(NS, "campaigns");
      (foundry.utils.saveDataToFile ?? saveDataToFile)(typeof raw === "string" ? raw : JSON.stringify(raw), "text/json", `backup-campaigns-before-catch-up-${Date.now()}.json`);
    } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  }

  // suppress per-step backups + confirm dialogs for the duration of the run
  const saved = { confirm: globalThis.Dialog?.confirm, log: console.log };
  if (AUTO_CONFIRM && globalThis.Dialog) { try { Dialog.confirm = async () => true; } catch (_e) {} }

  try {
    for (const step of STEPS) {
      if (!step.enabled) { summary.push({ step: step.label, result: "skipped", changes: "", ms: 0 }); continue; }
      const captured = []; console.log = (...a) => { captured.push(a.map(x => typeof x === "string" ? x : JSON.stringify(x)).join(" ")); saved.log.apply(console, a); };
      // a sub-macro that bails with ui.notifications.error(...) RETURNS rather than throws — catch that and treat it as a failure
      const macroErrors = []; const savedNotifyError = ui.notifications.error; ui.notifications.error = (m, ...rest) => { macroErrors.push(String(m)); return savedNotifyError.call(ui.notifications, m, ...rest); };
      const started = Date.now();
      try {
        const res = await fetch(`${step.file}?t=${Date.now()}`); if (!res.ok) throw new Error(`fetch ${res.status}`);
        let src = await res.text();
        if (!/const DRY_RUN\s*=\s*(true|false)/.test(src)) throw new Error("no DRY_RUN constant in this macro — refusing to run it blind");
        src = src.replace(/const DRY_RUN\s*=\s*(true|false)/, `const DRY_RUN = ${DRY_RUN}`);
        // one backup up front: the step's own campaigns backup is cut out of its SOURCE (reassigning foundry.utils.saveDataToFile at run time does
        // not take effect, so every step used to download its own copy; review 2026-10-01)
        if (SUPPRESS_STEP_BACKUPS) src = src.replace(/foundry\.utils\.saveDataToFile\s*(\?\?|\|\|)\s*saveDataToFile/g, "(() => {})");
        for (const [k, v] of Object.entries(step.vars || {})) {
          const re = new RegExp(`const ${k}\\s*=\\s*("[^"]*"|'[^']*'|[^;]+);`); if (!re.test(src)) throw new Error(`no const ${k} in this macro`);
          src = src.replace(re, `const ${k} = ${JSON.stringify(v)};`);
        }
        // return the macro's own IIFE promise so we can await it
        if (!/^\s*\(async \(\) =>/m.test(src)) throw new Error("macro is not an (async () => …)() IIFE — cannot await it");
        src = src.replace(/^\s*\(async \(\) =>/m, "return (async () =>");
        await new AsyncFunction(src)();
        if (macroErrors.length) throw new Error(macroErrors[0]);
        const line = captured.find(l => /change/.test(l)) || captured.find(l => /APPLIED|DRY RUN|nothing to do|Nothing to do/i.test(l)) || "";
        const m = line.match(/(\d+)\s+change/); const changes = m ? Number(m[1]) : (/nothing to do/i.test(line) ? 0 : "?");
        summary.push({ step: step.label, result: "ok", changes, ms: Date.now() - started });
      } catch (e) {
        console.log = saved.log; console.error(`${tag} ✗ ${step.label}:`, e);
        summary.push({ step: step.label, result: "FAILED: " + (e?.message || e), changes: "", ms: Date.now() - started });
        if (!CONTINUE_ON_ERROR) { ui.notifications.error(`${tag} stopped at "${step.label}": ${e?.message || e} — later steps not run.`); break; }
      } finally { console.log = saved.log; ui.notifications.error = savedNotifyError; }
    }
  } finally {
    if (saved.confirm && globalThis.Dialog) { try { Dialog.confirm = saved.confirm; } catch (_e) {} }
    console.log = saved.log;
  }

  const ran = summary.filter(s => s.result === "ok").length, failed = summary.filter(s => /^FAILED/.test(s.result)).length, skipped = summary.filter(s => s.result === "skipped").length;
  console.log(`${tag} ${ran} ok · ${failed} failed · ${skipped} skipped · ${((Date.now() - t0) / 1000).toFixed(1)} s`); console.table(summary);
  const rows = summary.map(s => `<tr><td>${s.step}</td><td>${s.result}</td><td>${s.changes}</td></tr>`).join("");
  await ChatMessage.create({ whisper: [game.user.id], content: `<h3>${tag}</h3><table><tr><th>step</th><th>result</th><th>changes</th></tr>${rows}</table><p>${ran} ok · ${failed} failed · ${skipped} skipped${DRY_RUN ? " — nothing written. Set DRY_RUN = false to apply." : " — F5 now."}</p>` });
  ui.notifications[failed ? "warn" : "info"](`${tag} ${ran} ok · ${failed} failed · ${skipped} skipped — see console (F12) and the whispered chat card.${DRY_RUN ? "" : " F5."}`);
})();

/* run-catch-up-wave3-2026-09-30.macro.js — WAVE 3 in one run: the ten remaining retrofits in the Chuckle shape. RUN IN-WORLD (GM, ember).
 * ─────────────────────────────────────────────────────────────────────────────
 * Same engine as run-catch-up-2026-09-30 (fetch each tool macro, force its DRY_RUN to this master switch, await it, one backup up front,
 * per-step backups + confirms suppressed, ui.notifications.error inside a step = that step FAILED). Verified offline together on save
 * qxazuabkr3wp: 948 beats, 24 story scripts, lint 0 ERROR / 128 WARN (six fewer than live), replay no refusals.
 *
 * ORDER MATTERS (receipt exchanges are gated on marks, so either order plays, but the seeders assume earlier arcs' beats exist):
 *   water (Flooded Towns, Lost Statues, Balcones) → diplomacy (Siege, Bandit Accord, Trojan Gift) → faith (Cadence, Tifaret, Ninth Guest) → Finale.
 *
 * HOW TO RUN: 1) hard-reload; 2) DRY_RUN = true (default) → read the summary card + console; 3) DRY_RUN = false, run again; 4) F5.
 * Re-running is safe — every step is idempotent. DRY-RUN counts on later steps read a little low (dry steps create no actors/beats).
 */
(async () => {
  const DRY_RUN = false;                    // <-- master switch: false = APPLY everything below, in order
  const CONTINUE_ON_ERROR = false;
  const AUTO_CONFIRM = true;
  const SUPPRESS_STEP_BACKUPS = true;

  const T = "modules/bbttcc-campaign/tools/";
  const STEPS = [
    { file: T + "seed-flooded-towns-retrofit.macro.js",      label: "Flooded Towns (the Last Clerk, the Dispatcher, the vote, THE MINUTES)", enabled: true },
    { file: T + "seed-lost-statues-retrofit.macro.js",       label: "Lost Statues (the Basin Sexton, Sable's line, the seventh point)", enabled: true },
    { file: T + "seed-balcones-retrofit.macro.js",           label: "Balcones (Dr. Nkemelu, the Fault speaks, THE ITEMIZED COMPLAINT)", enabled: true },
    { file: T + "seed-fifteen-year-siege-retrofit.macro.js", label: "Fifteen-Year Siege (Thursday tea in the culvert, THE YEAR-ZERO ENTRY)", enabled: true },
    { file: T + "seed-bandit-accord-retrofit.macro.js",      label: "Bandit Accord (Lady Maccio's books, THE EXIT COLUMN)", enabled: true },
    { file: T + "seed-trojan-gift-retrofit.macro.js",        label: "A Gift. (Not a Trojan.) (the clerk, the Eleven, THE CLAUSE)", enabled: true },
    { file: T + "seed-cadence-retrofit.macro.js",            label: "The Cadence (Tempo at the gate, the drum, THE MAESTRA'S TERMS)", enabled: true },
    { file: T + "seed-tifaret-retrofit.macro.js",            label: "Forest of Early Tifaret (the ring, the Tree Person)", enabled: true },
    { file: T + "seed-ninth-guest-retrofit.macro.js",        label: "The Ninth Guest (the sign, the hand, the gap, THE TERMS OF THE WATCH)", enabled: true },
    { file: T + "seed-finale-retrofit.macro.js",             label: "Thatwards Ho! Finale (Sklar's arithmetic, THE PAYMASTER'S NUMBERS)", enabled: true },
  ];

  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const NS = "bbttcc-campaign";
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const summary = []; const t0 = Date.now();
  const tag = `[wave-3 ${DRY_RUN ? "DRY RUN" : "APPLY"}]`;

  if (!DRY_RUN) {
    try {
      const raw = game.settings.get(NS, "campaigns");
      (foundry.utils.saveDataToFile ?? saveDataToFile)(typeof raw === "string" ? raw : JSON.stringify(raw), "text/json", `backup-campaigns-before-wave3-${Date.now()}.json`);
    } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  }
  const saved = { fu: foundry.utils.saveDataToFile, confirm: globalThis.Dialog?.confirm, log: console.log };
  if (SUPPRESS_STEP_BACKUPS) { try { foundry.utils.saveDataToFile = () => {}; } catch (_e) {} }
  if (AUTO_CONFIRM && globalThis.Dialog) { try { Dialog.confirm = async () => true; } catch (_e) {} }

  try {
    for (const step of STEPS) {
      if (!step.enabled) { summary.push({ step: step.label, result: "skipped", changes: "", ms: 0 }); continue; }
      const captured = []; console.log = (...a) => { captured.push(a.map(x => typeof x === "string" ? x : JSON.stringify(x)).join(" ")); saved.log.apply(console, a); };
      const macroErrors = []; const savedNotifyError = ui.notifications.error; ui.notifications.error = (m, ...rest) => { macroErrors.push(String(m)); return savedNotifyError.call(ui.notifications, m, ...rest); };
      const started = Date.now();
      try {
        const res = await fetch(`${step.file}?t=${Date.now()}`); if (!res.ok) throw new Error(`fetch ${res.status}`);
        let src = await res.text();
        if (!/const DRY_RUN\s*=\s*(true|false)/.test(src)) throw new Error("no DRY_RUN constant in this macro — refusing to run it blind");
        src = src.replace(/const DRY_RUN\s*=\s*(true|false)/, `const DRY_RUN = ${DRY_RUN}`);
        for (const [k, v] of Object.entries(step.vars || {})) {
          const re = new RegExp(`const ${k}\\s*=\\s*("[^"]*"|'[^']*'|[^;]+);`); if (!re.test(src)) throw new Error(`no const ${k} in this macro`);
          src = src.replace(re, `const ${k} = ${JSON.stringify(v)};`);
        }
        if (!/^\s*\(async \(\) =>/m.test(src)) throw new Error("macro is not an (async () => …)() IIFE — cannot await it");
        src = src.replace(/^\s*\(async \(\) =>/m, "return (async () =>");
        await new AsyncFunction(src)();
        if (macroErrors.length) throw new Error(macroErrors[0]);
        const line = captured.find(l => /change/.test(l)) || captured.find(l => /APPLIED|DRY RUN|nothing to do/i.test(l)) || "";
        const m = line.match(/(\d+)\s+change/); const changes = m ? Number(m[1]) : (/nothing to do/i.test(line) ? 0 : "?");
        summary.push({ step: step.label, result: "ok", changes, ms: Date.now() - started });
      } catch (e) {
        console.log = saved.log; console.error(`${tag} ✗ ${step.label}:`, e);
        summary.push({ step: step.label, result: "FAILED: " + (e?.message || e), changes: "", ms: Date.now() - started });
        if (!CONTINUE_ON_ERROR) { ui.notifications.error(`${tag} stopped at "${step.label}": ${e?.message || e} — later steps not run.`); break; }
      } finally { console.log = saved.log; ui.notifications.error = savedNotifyError; }
    }
  } finally {
    try { foundry.utils.saveDataToFile = saved.fu; } catch (_e) {}
    if (saved.confirm && globalThis.Dialog) { try { Dialog.confirm = saved.confirm; } catch (_e) {} }
    console.log = saved.log;
  }

  const ran = summary.filter(s => s.result === "ok").length, failed = summary.filter(s => /^FAILED/.test(s.result)).length, skipped = summary.filter(s => s.result === "skipped").length;
  console.log(`${tag} ${ran} ok · ${failed} failed · ${skipped} skipped · ${((Date.now() - t0) / 1000).toFixed(1)} s`); console.table(summary);
  const rows = summary.map(s => `<tr><td>${s.step}</td><td>${s.result}</td><td>${s.changes}</td></tr>`).join("");
  await ChatMessage.create({ whisper: [game.user.id], content: `<h3>${tag}</h3><table><tr><th>step</th><th>result</th><th>changes</th></tr>${rows}</table><p>${ran} ok · ${failed} failed · ${skipped} skipped${DRY_RUN ? " — nothing written. Set DRY_RUN = false to apply." : " — F5 now."}</p>` });
  ui.notifications[failed ? "warn" : "info"](`${tag} ${ran} ok · ${failed} failed · ${skipped} skipped — see console (F12) and the whispered chat card.${DRY_RUN ? "" : " F5."}`);
})();

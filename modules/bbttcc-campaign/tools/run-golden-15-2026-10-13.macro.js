/* run-golden-15-2026-10-13.macro.js — GOLDEN MASTER 15 in one macro, two runs. RUN IN-WORLD (GM, ember).
 * ─────────────────────────────────────────────────────────────────────────────
 * THE GOLDEN RITUAL (Dave, 2026-10-13: "resave a Turn 0 Golden Master that includes all the new awesomeness").
 * Same shape as run-golden-13: the base is built OFFLINE by modules/bbttcc-world/tools/build-golden-base.py from
 * Golden Master 14.01 (87jitm7t7znj — turn 1, story phase 0, clean play state) + the live save "Save 10/13/2026, 10:20:59 PM"
 * (eo8telsyhghi — every content change since 10-05: the Recalcitrant Cafe, the Hexknight, the high-tier travel tables, the NPC
 * pack world copies, bandit restamps, market catalog/vendors, 85 new GM actors, scene bodies). Golden 15 base rules
 * (builder flags): --drop-deleted (actors Dave deleted on live stay deleted — Hollow Things, Straw Adversaries, Sir Smackalot,
 * Wired…), --exclude "^Trailer — |^Rad Shirts!" (shoot props), live-only player-owned CHARACTERS/rigs/factions skipped
 * (Redshirts, Mags' crews, the Folding Chair…), player-owned NPCs (the bandit crews lent to a player seat) carried with
 * ownership reset, config settings added since 10-05 carried from live, play state (director, story, turn, ledger, logs) = golden's.
 * The base sits on the server at Data/bbttcc-saves/roll-for-initiation-bad-eden/_golden15-base-source.json.
 *
 *   RUN 1 (the world is NOT the base yet — e.g. the live turn-8 world):
 *          safety save "Before Golden 15 (auto)" → import the base as a slot → load it (deleteExtras) → every client reloads.
 *   RUN 2 (the world IS the base: turn ≤ 1, story phase 0, story scripts present):
 *          the verification queue below (every step idempotent; all but the aptitude retro are expected to report 0 changes
 *          because the base already carries live content) → saves.save "Golden Master 15" ★ golden.
 *
 * NOT in the queue (on purpose): the town-hub runner (live scene bodies + door drawings are transplanted by the builder),
 * the campaign patches already in the live campaign, mid-play repairs. ⚠ The world turn stays the golden's (1). To bake a
 * literal turn 0 instead, rebuild the base with --turn 0 (the ritual's run detection accepts turn ≤ 1).
 *
 * HOW TO RUN: 0) full cache bust (hard reload / clear site data), GM first. 1) run as-is (DRY_RUN = true), read the chat card
 * + console. 2) DRY_RUN = false, run → the world loads the base and reloads. 3) run again with DRY_RUN = true (run 2 preview),
 * 4) DRY_RUN = false → queue + "Golden Master 15" ★. 5) export a bundle for bin/ft-lint-campaign + bin/ft-replay-story.
 * To get the turn-8 playtest back afterwards: 💾 Saves → load "Before Golden 15 (auto)".
 */
(async () => {
  const DRY_RUN = true;                        // <-- master switch
  const FORCE_RUN = 0;                        // 0 = decide from the world; 1 or 2 to force a run
  const BASE_URL = "bbttcc-saves/roll-for-initiation-bad-eden/_golden15-base-source.json";
  const GOLDEN_LABEL = "Golden Master 15";    // 2026-10-13: Golden 14.01 play state + every content change since (see header)
  const CONTINUE_ON_ERROR = false, AUTO_CONFIRM = true, SUPPRESS_STEP_BACKUPS = true;

  const C = "modules/bbttcc-campaign/tools/", HUB = "modules/bbttcc-travel/tools/town-hubs/setup-town-hub.macro.js";
  const STEPS = [
    { file: C + "patch-recalcitrant-cafe-2026-10-13.macro.js",          label: "The Recalcitrant Cafe (expect 0 — already in the live campaign)" },
    { file: C + "seed-hexknight-encounter-2026-10-13.macro.js",         label: "The Hexknight encounter (expect 0)" },
    { file: C + "seed-high-tier-travel-tables-2026-10-13.macro.js",     label: "High-tier travel tables (expect 0)" },
    { file: "modules/bbttcc-tikkun/tools/load-sparks-pack.macro.js",    label: "Sparks pack (compendium, this instance)" },
    { file: "modules/bbttcc-master-content/tools/retro-apply-class-l1-aptitudes.macro.js", label: "Class L1 aptitudes retro (the golden's Stewards predate the 10-12 fix)" },
  ];

  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const saves = game.bbttcc?.api?.world?.saves;
  if (!saves?.load || !saves?.importFile || !saves?.save) return ui.notifications.error("Save Games API (bbttcc-world) not loaded.");
  const NS = "bbttcc-campaign";
  const tag = (r) => `[Golden 15 · run ${r} · ${DRY_RUN ? "DRY RUN" : "APPLY"}]`;
  const card = async (title, html) => ChatMessage.create({ whisper: [game.user.id], content: `<h3>${title}</h3>${html}` });

  // ── which run is this? ─────────────────────────────────────────────────────
  let camps = game.settings.get(NS, "campaigns"); if (typeof camps === "string") { try { camps = JSON.parse(camps); } catch (_e) { camps = {}; } }
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const scripts = Object.keys(camps?.[cid]?.story?.scripts || {}).length;
  const turn = Number(game.bbttcc?.api?.world?.getState?.()?.turn ?? 0) || 0;
  const phase = Number(game.settings.get(NS, "storyPhase") ?? 0) || 0;
  const isBase = turn <= 1 && phase === 0 && scripts >= 20;
  const RUN = FORCE_RUN || (isBase ? 2 : 1);
  console.log(`${tag(RUN)} world: turn ${turn}, story phase ${phase}, ${scripts} story scripts → run ${RUN}`);

  // ── RUN 1: load the base ───────────────────────────────────────────────────
  if (RUN === 1) {
    let res; try { res = await fetch(`${BASE_URL}?t=${Date.now()}`); } catch (e) { return ui.notifications.error(`Cannot fetch the base: ${e?.message || e}`); }
    if (!res.ok) return ui.notifications.error(`Base save not on the server (${res.status}): ${BASE_URL}`);
    const text = await res.text(); let snap; try { snap = JSON.parse(text); } catch (e) { return ui.notifications.error("Base save is not valid JSON."); }
    if (snap?.kind !== "bbttcc-savegame") return ui.notifications.error("Base file is not a Bad Eden save.");
    let plan = null; try { plan = saves.plan ? await saves.plan(snap) : null; } catch (e) { console.warn(tag(1), "plan failed", e); }
    const p = plan || {};
    const summary = `<p><b>${snap.label}</b> — turn ${snap.turn}, phase ${snap.storyPhase}; ${snap.counts?.actors} actors, ${snap.counts?.scenes} scenes, ${snap.counts?.drawings} drawings.</p>` +
      `<p>A load would: update ${p.actorsUpdate ?? "?"} actors, create ${p.actorsCreate ?? "?"}, DELETE ${p.actorsDelete?.length ?? "?"} (made in play since golden 12)${p.actorsDelete?.length ? `: ${p.actorsDelete.slice(0, 25).join(", ")}${p.actorsDelete.length > 25 ? "…" : ""}` : ""}; ` +
      `restore ${p.scenesKnown ?? "?"} scenes${p.scenesMissing?.length ? ` (${p.scenesMissing.length} not in this world, skipped)` : ""}; change ${p.settingsChange ?? "?"} settings.${p.others?.length ? ` Connected players who will be reloaded: ${p.others.join(", ")}.` : ""}</p>`;
    console.log(tag(1), plan);
    if (DRY_RUN) { await card(tag(1), summary + "<p>Nothing written. Set DRY_RUN = false to save the current world as a safety slot and load the base.</p>"); return ui.notifications.info(`${tag(1)} plan in chat + console. Set DRY_RUN=false to load the base.`); }
    ui.notifications.info(`${tag(1)} saving the current world first…`);
    try { await saves.save({ label: "Before Golden 15 (auto)", note: "auto-saved by run-golden-15 before loading the base" }); } catch (e) { return ui.notifications.error(`Safety save failed — nothing loaded: ${e?.message || e}`); }
    const row = await saves.importFile(new File([text], "golden15-base.json", { type: "application/json" }));
    await card(tag(1), summary + `<p>Imported as slot <code>${row.id}</code>. Loading now — every client reloads. <b>Then run this macro again</b> (dry first).</p>`);
    await saves.load(row.id, { deleteExtras: true });
    return;
  }

  // ── RUN 2: the owed queue, then the golden save ────────────────────────────
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const summary = []; const t0 = Date.now();
  if (!DRY_RUN) {
    try { const raw = game.settings.get(NS, "campaigns"); (foundry.utils.saveDataToFile ?? saveDataToFile)(typeof raw === "string" ? raw : JSON.stringify(raw), "text/json", `backup-campaigns-before-golden15-queue-${Date.now()}.json`); }
    catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  }
  const saved = { confirm: globalThis.Dialog?.confirm, log: console.log };
  if (AUTO_CONFIRM && globalThis.Dialog) { try { Dialog.confirm = async () => true; } catch (_e) {} }
  try {
    for (const step of STEPS) {
      const captured = []; console.log = (...a) => { captured.push(a.map(x => typeof x === "string" ? x : JSON.stringify(x)).join(" ")); saved.log.apply(console, a); };
      const macroErrors = []; const savedNotifyError = ui.notifications.error; ui.notifications.error = (m, ...rest) => { macroErrors.push(String(m)); return savedNotifyError.call(ui.notifications, m, ...rest); };
      const started = Date.now();
      try {
        const res = await fetch(`${step.file}?t=${Date.now()}`); if (!res.ok) throw new Error(`fetch ${res.status}`);
        let src = await res.text();
        if (!/const DRY_RUN\s*=\s*(true|false)/.test(src)) throw new Error("no DRY_RUN constant in this macro — refusing to run it blind");
        src = src.replace(/const DRY_RUN\s*=\s*(true|false)/, `const DRY_RUN = ${DRY_RUN}`);
        if (SUPPRESS_STEP_BACKUPS) src = src.replace(/foundry\.utils\.saveDataToFile\s*(\?\?|\|\|)\s*saveDataToFile/g, "(() => {})");
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
        console.log = saved.log; console.error(`${tag(2)} ✗ ${step.label}:`, e);
        summary.push({ step: step.label, result: "FAILED: " + (e?.message || e), changes: "", ms: Date.now() - started });
        if (!CONTINUE_ON_ERROR) { ui.notifications.error(`${tag(2)} stopped at "${step.label}": ${e?.message || e} — later steps not run, no golden saved.`); break; }
      } finally { console.log = saved.log; ui.notifications.error = savedNotifyError; }
    }
  } finally {
    if (saved.confirm && globalThis.Dialog) { try { Dialog.confirm = saved.confirm; } catch (_e) {} }
    console.log = saved.log;
  }
  const ran = summary.filter(s => s.result === "ok").length, failed = summary.filter(s => /^FAILED/.test(s.result)).length;
  let goldenLine = "";
  if (!DRY_RUN && !failed && ran === STEPS.length) {
    try { const row = await saves.save({ label: GOLDEN_LABEL, golden: true, note: "run-golden-15-2026-10-13: base (Golden 14.01 state + live content 10-13) + the verification queue" }); goldenLine = `<p>★ Saved <b>${GOLDEN_LABEL}</b> as the golden master (slot <code>${row.id}</code>). From the Top = 💾 Saves → ⟲ Load golden master.</p>`; }
    catch (e) { goldenLine = `<p>✗ Golden save FAILED: ${e?.message || e} — save it by hand from 💾 Saves (★).</p>`; }
  } else if (!DRY_RUN) goldenLine = "<p>No golden saved (a step failed or was not run). Fix and run again — every step is idempotent.</p>";
  console.log(`${tag(2)} ${ran} ok · ${failed} failed · ${((Date.now() - t0) / 1000).toFixed(1)} s`); console.table(summary);
  const rows = summary.map(s => `<tr><td>${s.step}</td><td>${s.result}</td><td>${s.changes}</td></tr>`).join("");
  await card(tag(2), `<table><tr><th>step</th><th>result</th><th>changes</th></tr>${rows}</table><p>${ran} ok · ${failed} failed${DRY_RUN ? " — nothing written. Set DRY_RUN = false to apply and save the golden." : ""}</p>${goldenLine}<p>Remember: run load-sparks-pack on the foundry instance too.</p>`);
  ui.notifications[failed ? "warn" : "info"](`${tag(2)} ${ran} ok · ${failed} failed — chat card + console.${DRY_RUN ? "" : " F5."}`);
})();

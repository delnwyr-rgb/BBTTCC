/* run-golden-13-2026-10-02.macro.js — GOLDEN MASTER 13 in one macro, two runs. RUN IN-WORLD (GM, ember).
 * ─────────────────────────────────────────────────────────────────────────────
 * Golden 12 (c2bab28jbixz, 2026-09-21) predates the whole story-data layer and every retrofit wave, so it is NOT patched up
 * macro by macro. Instead `modules/bbttcc-world/tools/build-golden-base.py` built a BASE save offline: golden 12's clean
 * turn-1 play state (turn, factions, hexes held, fired beats, player stewards) + the live world's CONTENT (rmh94lhf20ee,
 * "Pre Golden Master 13 save": all 948 beats + 24 story scripts, 37 new NPCs, persona edits, door drawings, scene setups,
 * hex campaign hooks + resource-node loot tables). The mal-voice API key is NOT in it (it lives in the GM's browser now).
 * The base sits on the server at Data/bbttcc-saves/roll-for-initiation-bad-eden/_golden13-base-source.json.
 *
 * The macro decides which run this is from the world itself:
 *   RUN 1 (the world is NOT the base yet — e.g. the live turn-3 world):
 *     dry  → fetches the base and prints what a load would change.
 *     apply→ saves the current world as "Before Golden 13 (auto)", imports the base as a slot, LOADS it.
 *            Every client reloads. Then run this macro again.
 *   RUN 2 (the world IS the base: turn 1, story phase 0, story scripts present):
 *     dry  → every owed patch below, dry, in order (counts on later steps read low: dry steps create nothing).
 *     apply→ every owed patch below, applied, in order (one campaigns backup up front), then SAVES
 *            "Golden Master 13" and marks it ★ golden.
 *
 * THE OWED QUEUE (both threads, 2026-10-02; order from the review thread's list + Mags'):
 *   review thread: vault-allies (no-op when present) → template patches A → B → C → Fixit early alliance → Fixit board vault
 *   gate → Burnt Flats registry (added after Golden 13's first save) → Tikkun atonement → load the sparks pack (writes the bbttcc-tikkun.sparks COMPENDIUM on THIS instance only — run
 *   load-sparks-pack once on the foundry instance too);
 *   Mags: the Hum at Tier 2 ("The Two Tents") → owner canon (Marnie, the Sigil Bridge, the Wendigo's gift, the railway,
 *   the rename, the camp on Khezek-Tor) → Jeargan + the Garden at ninety-six;
 *   town hubs: Chuckle Creek, Soft Landing, Stillwater, Crown Mall, Maneuver Vault, Gloomgill, Port Kudzu, and the Widening
 *   Trail sites (2026-10-04): the Rotating Chapel, the Burnt Flats, the Singing Mire, Anchor Reach, Legansus Waystation.
 * SKIPPED on purpose (mid-play repairs, no-ops on a fresh golden): purge-stale-hex-requests, repair-siege-and-boons.
 *
 * HOW TO RUN: 0) full cache bust (hard reload / clear site data), GM first. 1) run as-is (DRY_RUN = true), read the chat card
 * + console. 2) DRY_RUN = false, run → the world loads the base and reloads. 3) run again with DRY_RUN = true (run 2 preview),
 * 4) DRY_RUN = false → patches + "Golden Master 13" ★. 5) export a bundle for bin/ft-lint-campaign + bin/ft-replay-story.
 */
(async () => {
  const DRY_RUN = true;                        // <-- master switch
  const FORCE_RUN = 0;                        // 0 = decide from the world; 1 or 2 to force a run
  const BASE_URL = "bbttcc-saves/roll-for-initiation-bad-eden/_golden13-base-source.json";
  const GOLDEN_LABEL = "Golden Master 14";    // 2026-10-05: re-run on a loaded Golden Master 13 adds Legansus → Gearbox; new name so the two slots don't collide
  const CONTINUE_ON_ERROR = false, AUTO_CONFIRM = true, SUPPRESS_STEP_BACKUPS = true;

  const C = "modules/bbttcc-campaign/tools/", HUB = "modules/bbttcc-travel/tools/town-hubs/setup-town-hub.macro.js";
  const STEPS = [
    { file: C + "patch-vault-allies.macro.js",                          label: "Vault makes allies (prereq for patch C; no-op when present)" },
    { file: C + "patch-template-review-fixes-2026-10-01.macro.js",      label: "Template review fixes A" },
    { file: C + "patch-template-review-fixes-b-2026-10-01.macro.js",    label: "Template review fixes B" },
    { file: C + "patch-template-review-fixes-c-2026-10-02.macro.js",    label: "Template review fixes C" },
    { file: C + "patch-fixit-early-alliance-2026-10-02.macro.js",       label: "Fixit early alliance" },
    { file: C + "patch-fixit-board-vault-gate-2026-10-02.macro.js",     label: "Fixit board vault gate" },
    { file: C + "patch-burnt-flats-quest-registry-2026-10-02.macro.js", label: "Burnt Flats registry row + the Widening Trail's name (lint E, review thread)" },
    { file: C + "seed-tikkun-atonement.macro.js",                       label: "Tikkun atonement (5 beats)" },
    { file: "modules/bbttcc-tikkun/tools/load-sparks-pack.macro.js",    label: "Sparks pack (compendium, this instance)" },
    { file: C + "seed-sarmoung-hum-retrofit.macro.js",                  label: "The Two Tents (the Hum at Tier 2)" },
    { file: C + "patch-owner-canon-2026-10-02.macro.js",                label: "Owner canon 10-02 (Marnie, bridge, Wendigo, railway, rename, camp)" },
    { file: C + "patch-legansus-second-hearing-2026-10-03.macro.js",     label: "Legansus second hearing (one desk, reclassification, the Finale reads either)" },
    { file: C + "patch-performance-contests-2026-10-04.macro.js",       label: "Performance contests (the Cadence's floor, the Tanneritos' skate-off)" },
    { file: C + "patch-wick-cover-2026-10-04.macro.js",                 label: "Wick's cover + Father Tamsin's answer + the pilgrim's room" },
    { file: C + "patch-absolutely-reliable-2026-10-04.macro.js",        label: "The Absolutely Reliable (the lease, buy / earn / lapse to the Vacancy)" },
    { file: C + "patch-act01-wordsmith-2026-10-05.macro.js",            label: "Dave's Act 0–1 wordsmithing (Beat Polish read-back, up to the title card)" },
    { file: C + "patch-gearbox-wordless-2026-10-05.macro.js",           label: "Young Gearbox says almost nothing (and offers coffee)" },
    { file: C + "patch-vacancy-rescene-2026-10-05.macro.js",            label: "The Vacancy re-shot (new POVs, upstairs hall, shrine + Leygate shots for Wick)" },
    { file: C + "patch-jeargan-garden-canon-2026-10-02.macro.js",       label: "Jeargan + the Garden at ninety-six" },
    ...["chuckle", "softlanding", "stillwater", "crownmall", "maneuvervault", "gloomgill", "portkudzu", "wtchapel", "wtflats", "wtmire", "wtreach", "wtlegansus", "ag", "agvacancy"].map(k => ({ file: HUB, label: `Town hub: ${k}`, vars: { TOWN_KEY: k } }))
  ];

  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const saves = game.bbttcc?.api?.world?.saves;
  if (!saves?.load || !saves?.importFile || !saves?.save) return ui.notifications.error("Save Games API (bbttcc-world) not loaded.");
  const NS = "bbttcc-campaign";
  const tag = (r) => `[Golden 13 · run ${r} · ${DRY_RUN ? "DRY RUN" : "APPLY"}]`;
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
    try { await saves.save({ label: "Before Golden 13 (auto)", note: "auto-saved by run-golden-13 before loading the base" }); } catch (e) { return ui.notifications.error(`Safety save failed — nothing loaded: ${e?.message || e}`); }
    const row = await saves.importFile(new File([text], "golden13-base.json", { type: "application/json" }));
    await card(tag(1), summary + `<p>Imported as slot <code>${row.id}</code>. Loading now — every client reloads. <b>Then run this macro again</b> (dry first).</p>`);
    await saves.load(row.id, { deleteExtras: true });
    return;
  }

  // ── RUN 2: the owed queue, then the golden save ────────────────────────────
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const summary = []; const t0 = Date.now();
  if (!DRY_RUN) {
    try { const raw = game.settings.get(NS, "campaigns"); (foundry.utils.saveDataToFile ?? saveDataToFile)(typeof raw === "string" ? raw : JSON.stringify(raw), "text/json", `backup-campaigns-before-golden13-queue-${Date.now()}.json`); }
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
    try { const row = await saves.save({ label: GOLDEN_LABEL, golden: true, note: "run-golden-13-2026-10-02: base (golden 12 state + live content) + the owed queue" }); goldenLine = `<p>★ Saved <b>${GOLDEN_LABEL}</b> as the golden master (slot <code>${row.id}</code>). From the Top = 💾 Saves → ⟲ Load golden master.</p>`; }
    catch (e) { goldenLine = `<p>✗ Golden save FAILED: ${e?.message || e} — save it by hand from 💾 Saves (★).</p>`; }
  } else if (!DRY_RUN) goldenLine = "<p>No golden saved (a step failed or was not run). Fix and run again — every step is idempotent.</p>";
  console.log(`${tag(2)} ${ran} ok · ${failed} failed · ${((Date.now() - t0) / 1000).toFixed(1)} s`); console.table(summary);
  const rows = summary.map(s => `<tr><td>${s.step}</td><td>${s.result}</td><td>${s.changes}</td></tr>`).join("");
  await card(tag(2), `<table><tr><th>step</th><th>result</th><th>changes</th></tr>${rows}</table><p>${ran} ok · ${failed} failed${DRY_RUN ? " — nothing written. Set DRY_RUN = false to apply and save the golden." : ""}</p>${goldenLine}<p>Remember: run load-sparks-pack on the foundry instance too.</p>`);
  ui.notifications[failed ? "warn" : "info"](`${tag(2)} ${ran} ok · ${failed} failed — chat card + console.${DRY_RUN ? "" : " F5."}`);
})();

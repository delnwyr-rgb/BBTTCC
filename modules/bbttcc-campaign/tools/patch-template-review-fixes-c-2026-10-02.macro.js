/* patch-template-review-fixes-c-2026-10-02.macro.js — RUN IN-WORLD (GM, ember). DRY_RUN default true.
 * ─────────────────────────────────────────────────────────────────────────────
 * OWNER RULING 2026-10-02 — the Fixit Route Board is a REWARD FOR ALIGNMENT. Repairs the ALREADY-SEEDED live campaign the same way
 * seed-fixit-retrofit now seeds a fresh world (its "OWNER RULING 2026-10-02" comments). Run AFTER patch-template-review-fixes(-b)-2026-10-01;
 * order among them does not matter (different fields). One run, one backup.
 *
 *  BEATS (additive — the gate condition is appended, nothing removed)
 *   • fixit_route_board + fixit_route_board_after: the Back Stairs' allied gate (`{ relation: <Jackalopes>, is: "allied" }`, read off
 *     fixit_backstairs_exterior so the two stay one gate) + inject.hardGate:true (checked on every path, as on the stairs)
 *  STORY SCRIPT (campaign.story, edited IN PLACE — `after`, doors and wordsmithed lines kept)
 *   • fixit_farm: the "board" step is dropped from the NOW card (the Back Stairs door — "allies" — reaches the board)
 *
 * Idempotent: a second APPLY reports 0 changes.
 *
 * HOW TO RUN: 1) hard-reload; 2) run as-is (DRY_RUN = true) → read the console (F12) report; 3) set DRY_RUN = false, run again
 *   (a backup-campaigns-before-review-fixes-c-<ts>.json downloads first); 4) F5. Then export a fresh bundle and run
 *   `bin/ft-lint-campaign <bundle>` and `bin/ft-replay-story <export> --act=6`.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));

  // ── helpers (same as patch -b / the seeders) ──────────────────────────────
  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id} (its seeder never ran here?)`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  const reqsOf = (x) => Array.isArray(x) ? x : (x && typeof x === "object" ? [x] : []);

  // ── constants — VERBATIM from seed-fixit-retrofit ─────────────────────────
  const BOARD_BEATS = ["fixit_route_board", "fixit_route_board_after"];

  // ── 1. beats ──────────────────────────────────────────────────────────────
  say("— Fixit: the Route Board is an allies' reward —");
  const ALLY = reqsOf(byId.get("fixit_backstairs_exterior")?.inject?.requires).find(r => r && r.relation && r.is === "allied") || null;
  if (!ALLY) say("✗ fixit_backstairs_exterior has no allied gate (patch-vault-allies never ran here?) — the Route Board is NOT gated; run that first, then this again");
  else for (const id of BOARD_BEATS) edit(id, b => { b.inject = b.inject || {}; const r = reqsOf(b.inject.requires).slice(); if (!r.some(x => JSON.stringify(x) === JSON.stringify(ALLY))) b.inject.requires = [...r, { ...ALLY }]; if (b.inject.hardGate !== true) b.inject.hardGate = true; }, "allies only (the Back Stairs' hard gate)");
  const beatChanges = changes;

  // ── 2. story script (campaign.story, edited in place) ─────────────────────
  camp.story = camp.story && typeof camp.story === "object" ? camp.story : { quests: {}, scripts: {} };
  camp.story.scripts = camp.story.scripts || {};
  const scriptKeysChanged = [];
  const editScript = (key, fn, what) => {
    const sc = camp.story.scripts[key];
    if (!sc || !Array.isArray(sc.steps)) return say(`✗ campaign.story.scripts.${key} missing — its seeder never wrote the story data here; re-run that seeder instead`);
    const before = JSON.stringify(sc); const afterBefore = JSON.stringify(sc.after || []);
    fn(sc);
    if (JSON.stringify(sc.after || []) !== afterBefore) { say(`✗ ${key}: \`after\` changed unexpectedly — NOT writing this script`); camp.story.scripts[key] = JSON.parse(before); return; }
    if (JSON.stringify(sc) !== before) { changes++; scriptKeysChanged.push(key); say(`✦ story script ${key}: ${what}`); } else say(`· ok story script ${key}`);
  };
  editScript("fixit_farm", sc => { sc.steps = sc.steps.filter(s => !(s && s.id === "board")); }, "the Route Board leaves the NOW card (the Back Stairs door reaches it)");

  // ── 3. report / write ─────────────────────────────────────────────────────
  console.log(`[patch-template-review-fixes-c-2026-10-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Review fixes (c) DRY RUN: ${changes} change(s) — see console (F12). Set DRY_RUN = false to apply.`);
  if (!changes) return ui.notifications.info("Review fixes (c): nothing to do.");
  if (beatChanges || scriptKeysChanged.length) {
    try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-review-fixes-c-${Date.now()}.json`); }
    catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
    await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  }
  // re-save each changed script through the story API so the engine re-applies campaign.story now (and storyUpdated fires)
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  for (const key of scriptKeysChanged) { try { if (storyApi?.saveQuest) await storyApi.saveQuest(campaignId, key, { script: camp.story.scripts[key] }); } catch (e) { console.warn(`[patch-template-review-fixes-c] saveQuest ${key} failed (data is written; F5 applies it)`, e); } }
  ui.notifications.info(`Review fixes (c) APPLIED: ${changes} change(s). F5.`);
})();

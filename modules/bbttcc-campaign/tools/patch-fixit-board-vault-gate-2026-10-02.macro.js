/* patch-fixit-board-vault-gate-2026-10-02.macro.js — RUN IN-WORLD (GM, ember). DRY_RUN default true.
 * ─────────────────────────────────────────────────────────────────────────────
 * OWNER RULING 2026-10-02 — the PRE-VAULT Route Board (fixit_route_board: "Pip's. For when he finishes the lesson.") shows only
 * while PIP IS MISSING and the party is allied with the Jackalopes. "Pip is missing" = the Maneuver Vault quest is ACTIVE: the
 * store starts it on the first Vault beat played (fc_mara_pip_summons, "Mara Finds You … Pip didn't come home"; or
 * maneuver_vault_acceptance), and a closer moves it to completed. Until now the board was gated "Vault NOT completed", which with
 * THE LATE RUN (patch-fixit-early-alliance) let Acts 2–3 allies read Pip's late route while Pip stood in the yard.
 * Order of play this keeps: Pike → Fixit (Act 2) → the Fixit quests (+ the Late Run) → Pip goes missing (Vault quest starts, Act 4)
 * → the board → the Vault rescue → the after-Vault board. Repairs the ALREADY-SEEDED live campaign the same way seed-fixit-retrofit
 * now seeds a fresh world. Run AFTER patch-template-review-fixes-c-2026-10-02 and patch-fixit-early-alliance-2026-10-02.
 *
 *  BEATS (the old condition is REPLACED in place — `{questBucket:<Vault>, isNot:"completed"}` → `{questBucket:<Vault>, is:"active"}`)
 *   • fixit_route_board — inject.requires: Vault ACTIVE (+ the allied hard gate patch -c put there, kept)
 *   • fixit_backstairs_exterior — the "Go up" choice (→ fixit_route_board) shows only while the Vault is ACTIVE
 *     (allies before Pip goes missing get the Back Stairs' runner-loft prose and "Leave"; the after-Vault choice is unchanged)
 *   • fixit_route_board_after — NOT touched (allied + Vault completed)
 *  STORY SCRIPT (campaign.story, edited IN PLACE — `after`, doors and wordsmithed lines kept)
 *   • fixit_farm: a step that still lists fixit_route_board is dropped from the NOW card (patch -c already did this; a no-op there)
 *
 * Idempotent: a second APPLY reports 0 changes.
 *
 * HOW TO RUN: 1) hard-reload; 2) run as-is (DRY_RUN = true) → read the console (F12) report; 3) set DRY_RUN = false, run again
 *   (a backup-campaigns-before-fixit-board-vault-gate-<ts>.json downloads first); 4) F5. Then export a fresh bundle and run
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
  for (const need of ["fixit_route_board", "fixit_backstairs_exterior"]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — run seed-fixit-retrofit (not this patch) on this world.`);

  // ── helpers (same as patch -c / the seeder) ───────────────────────────────
  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  const reqsOf = (x) => Array.isArray(x) ? x : (x && typeof x === "object" ? [x] : []);

  // ── constants + gate — VERBATIM from seed-fixit-retrofit ──────────────────
  const Q_VAULT = "quest_NwiADv8ZDoklqwEJ";
  const PIP_MISSING = { questBucket: Q_VAULT, is: "active" };
  const isPM = (x) => !!x && x.questBucket === Q_VAULT && x.is === "active" && x.isNot == null;
  const pipMissing = (list) => {   // the old "Vault not completed" becomes "Vault active", in place (once); added if absent
    const r = reqsOf(list).map(x => (x && x.questBucket === Q_VAULT && x.isNot === "completed" && x.is == null) ? { ...PIP_MISSING } : x);
    const out = r.filter((x, i) => !isPM(x) || r.findIndex(isPM) === i);
    if (!out.some(isPM)) out.push({ ...PIP_MISSING });
    return out;
  };

  // ── 1. beats ──────────────────────────────────────────────────────────────
  say("— Fixit: the pre-Vault Route Board waits for Pip to go missing (Vault quest ACTIVE) —");
  edit("fixit_route_board", b => {
    b.inject = b.inject || {}; const r = pipMissing(b.inject.requires);
    if (JSON.stringify(r) !== JSON.stringify(b.inject.requires)) b.inject.requires = r;
  }, "requires the Vault quest ACTIVE (Pip is missing), not merely unfinished");
  if (!reqsOf(byId.get("fixit_route_board")?.inject?.requires).some(r => r && r.relation && r.is === "allied") || byId.get("fixit_route_board")?.inject?.hardGate !== true)
    say("⚠ fixit_route_board has no allied hard gate — run patch-template-review-fixes-c-2026-10-02 too (without hardGate a route can still open the board past its gates)");
  edit("fixit_backstairs_exterior", b => {
    const up = (b.choices || []).find(c => c && c.next === "fixit_route_board"); if (!up) return;
    const r = pipMissing(up.requires);
    if (JSON.stringify(r) !== JSON.stringify(up.requires)) up.requires = r;
  }, "\"Go up\" (the pre-Vault board) shows only while the Vault quest is ACTIVE");
  if (!(byId.get("fixit_backstairs_exterior")?.choices || []).some(c => c && c.next === "fixit_route_board")) say("⚠ fixit_backstairs_exterior has no choice to fixit_route_board — nothing to gate there");
  { const a = byId.get("fixit_route_board_after"); say(a ? `· fixit_route_board_after left as is: ${JSON.stringify(reqsOf(a.inject?.requires))}${a.inject?.hardGate === true ? " (hard gate)" : ""}` : "⚠ fixit_route_board_after missing"); }
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
  editScript("fixit_farm", sc => { sc.steps = sc.steps.filter(s => !(s && Array.isArray(s.beats) && s.beats.includes("fixit_route_board"))); }, "the Route Board is not a NOW-card step (the Back Stairs door reaches it)");

  // ── 3. report / write ─────────────────────────────────────────────────────
  console.log(`[patch-fixit-board-vault-gate-2026-10-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Fixit board Vault gate DRY RUN: ${changes} change(s) — see console (F12). Set DRY_RUN = false to apply.`);
  if (!changes) return ui.notifications.info("Fixit board Vault gate: nothing to do.");
  if (beatChanges || scriptKeysChanged.length) {
    try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-fixit-board-vault-gate-${Date.now()}.json`); }
    catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
    await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  }
  // re-save each changed script through the story API so the engine re-applies campaign.story now (and storyUpdated fires)
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  for (const key of scriptKeysChanged) { try { if (storyApi?.saveQuest) await storyApi.saveQuest(campaignId, key, { script: camp.story.scripts[key] }); } catch (e) { console.warn(`[patch-fixit-board-vault-gate] saveQuest ${key} failed (data is written; F5 applies it)`, e); } }
  ui.notifications.info(`Fixit board Vault gate APPLIED: ${changes} change(s). The route waits for its runner. F5.`);
})();

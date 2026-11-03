/**
 * patch-quest-registry-rows-2026-11-02.macro.js — quest registry rows a data-layer quest names but the registry (setting
 * bbttcc-campaign.quests) never got. Live-caught 11-02: the Father Tamsin quest (built 11-02) declared registryId quest_father_tamsin,
 * no registry row existed → lint Q01 ×42 and the quest log titled it with its raw id. ADD-ONLY: an existing row is never touched.
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const ROWS = [
    { id: "quest_father_tamsin", name: "Father Tamsin", giver: "Father Tamsin, who pours the tea before you ask",
      description: "<p>Father Tamsin keeps St Gilliam's, rations nothing, and is bad at metaphor. The tea is always poured before you ask. He looks, these days, like a man who is sleeping badly and pouring well, and the third candle from the door is never quite where you left it.</p>",
      nextLine: "Visit Father Tamsin in Allesh-Gilliam and sit with him a while." }
  ];
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const raw = game.settings.get(NS, "quests"); const wasStr = typeof raw === "string";
  const Q = JSON.parse(wasStr ? raw : JSON.stringify(raw || {}));
  const report = []; let changes = 0; const now = Date.now();
  for (const r of ROWS) {
    if (Q[r.id]) { report.push(`· ok ${r.id} (exists — left alone)`); continue; }
    Q[r.id] = { id: r.id, v: 1, name: r.name, description: r.description, tags: [], createdTs: now, updatedTs: now, status: "active", ...(r.giver ? { giver: r.giver } : {}), ...(r.nextLine ? { nextLine: r.nextLine } : {}) };
    changes++; report.push(`✚ ${r.id}: "${r.name}"`);
  }
  console.log(`[quest registry rows 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__qrows = { dry: DRY_RUN, changes, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([wasStr ? raw : JSON.stringify(raw)], `backup-quests-pre-registry-rows-${now}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "quests", wasStr ? JSON.stringify(Q) : Q);
  ui.notifications.info(`Applied ${changes} registry row(s).`);
})();

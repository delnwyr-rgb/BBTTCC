/**
 * patch-quest-steps.macro.js — GM macro/console. DRY_RUN default true.
 *
 * Makes intra-quest order CANON (2026-08-23): for every quest, beats get
 * questStep = 10, 20, 30… in authoring order — but only where questStep is
 * empty, so anything already hand-ordered is preserved. questStep now drives
 * the Visualizer's quest-order NEXT guidance and beat sorting; gaps of 10
 * leave room to slot later beats between (edit in the Beat Editor's
 * Quest Step field).
 *
 * Within a quest, authoring order is usually the intended order — the
 * cross-quest interleaving was the real chaos. Spot-check the report and
 * hand-tune the exceptions.
 */
(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : campsRaw;
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);

  const perQuest = new Map(); // questId → next step counter
  let stamped = 0, kept = 0, unquested = 0;
  for (const b of camp.beats || []) {
    const qid = String(b.questId || "").trim();
    if (!qid) { unquested++; continue; }
    if (!perQuest.has(qid)) perQuest.set(qid, 10);
    const has = b.questStep != null && Number.isFinite(Number(b.questStep));
    if (has) {
      kept++;
      // Keep the counter ahead of hand-authored steps so new stamps append after.
      perQuest.set(qid, Math.max(perQuest.get(qid), Math.floor(Number(b.questStep) / 10) * 10 + 10));
      continue;
    }
    b.questStep = perQuest.get(qid);
    perQuest.set(qid, b.questStep + 10);
    stamped++;
  }

  const summary = [...perQuest.entries()].map(([q, n]) => `  ${q}: through step ${n - 10}`).join("\n");
  console.log(`[patch-quest-steps] ${DRY_RUN ? "DRY RUN" : "APPLY"} — stamped ${stamped}, kept ${kept} hand-authored, ${unquested} unquested\n${summary}`);
  if (DRY_RUN) return ui.notifications.info(`Quest steps DRY RUN: would stamp ${stamped} beat(s), keep ${kept} (console). Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name; a.click();
  };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-quest-steps-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Quest steps APPLIED: ${stamped} stamped, ${kept} preserved. Backup downloaded.`);
})();

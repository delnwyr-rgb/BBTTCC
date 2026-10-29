/**
 * patch-kt-cage-shaft-last-resort-2026-10-28.macro.js — Dave, 10-28: "Keep [sending the cage down empty] free, the eerie
 * moment is worth it — but ONLY if they fail all the checks first."
 * After patch-kt-cage-shaft-paths. "Send the cage down empty" (kt_cage_shaft) shows only once BOTH checks have missed:
 *   · the rope missed = kt_cage_shaft_fail played (Sable's "better rope" — the rope's failNext, and the after-chart climb's)
 *   · the chart missed = NEW ans_kt_cage_shaft_chart_missed played (the chart's failNext; it used to share the rope's beat)
 * The after-chart answer loses its "Send the cage down empty" (a read chart is not a failure).
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const beats = Array.isArray(camp.beats) ? camp.beats : (camp.beats = Object.values(camp.beats || {}));
  const byId = (id) => beats.find(b => b && String(b.id) === id);
  const J = (x) => JSON.stringify(x);
  const report = []; let changes = 0;
  const PID = "kt_cage_shaft", ROPE_MISS = "kt_cage_shaft_fail", CHART_MISS = "ans_kt_cage_shaft_chart_missed", CHART = "ans_kt_cage_shaft_chart";
  const parent = byId(PID), ropeMiss = byId(ROPE_MISS), chartAns = byId(CHART);
  if (!parent || !ropeMiss || !chartAns) return ui.notifications.error("Run patch-kt-cage-shaft-paths first (cage shaft beats missing).");
  const pick = (b, re) => (b.choices || []).find(c => re.test(String(c?.label || "")));
  const chart = pick(parent, /^Read the chart first/), cage = pick(parent, /^Send the cage down empty/);
  if (!chart || !cage) return ui.notifications.error("kt_cage_shaft choices not as expected — nothing changed.");

  // the chart's own miss
  if (!byId(CHART_MISS)) {
    const b = JSON.parse(J(ropeMiss));
    Object.assign(b, {
      id: CHART_MISS, label: "Khezek-Tor — The Cage Shaft — The Chart, Misread",
      description: "The chart is in Sable's hand, and Sable's hand is not a hand anyone else reads. You lose the rung somewhere between Four and the mark. \"Charts take practice,\" Sable says, and takes it back.",
      choices: [{ label: "Try another way.", next: PID, description: "", checkStat: "", checkDC: 0, failNext: "" }],
      dialogueOffer: false, timeScale: "moment", timePoints: 0, worldEffects: {},
      inject: { repeatable: true, evergreen: true, requires: [{ flag: "storyPhase", gte: 2 }] }
    });
    delete b.questId; delete b.story;
    beats.push(b); changes++; report.push(`+ ${CHART_MISS}`);
  }
  if (chart.failNext !== CHART_MISS) { chart.failNext = CHART_MISS; changes++; report.push(`✎ ${PID}: "Read the chart first." misses → ${CHART_MISS}`); }

  // the empty cage: last resort
  const GATE = [{ beatMark: ROPE_MISS }, { beatMark: CHART_MISS }];
  if (J(cage.gate || null) !== J(GATE)) { cage.gate = GATE; changes++; report.push(`✎ ${PID}: "Send the cage down empty." only once the rope AND the chart have missed`); }
  const before = (chartAns.choices || []).length;
  chartAns.choices = (chartAns.choices || []).filter(c => !/^Send the cage down empty/.test(String(c?.label || "")));
  if (chartAns.choices.length !== before) { changes++; report.push(`− ${CHART}: no empty cage after a good read`); }

  console.log(`[kt cage shaft last resort 2026-10-28] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__ktCageLast = { dry: DRY_RUN, changes, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-kt-cage-last-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the empty cage is the last resort.`);
})();

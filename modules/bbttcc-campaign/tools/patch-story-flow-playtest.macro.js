/**
 * patch-story-flow-playtest.macro.js — GM macro/console. DRY_RUN default true.
 *
 * STORY FLOW · PLAYTEST FIXES (2026-09-18, live-caught by the owner in Act 1). Accumulates the content-side fixes from the
 * tire-kick; every section is idempotent, so re-running after a new section is added applies only the new one.
 *
 *  P1. The Crossroads and Day's End are placeless. Day one's hub sits "at the edge of your holdings" and the ledger closes
 *      wherever the party stands — but both beats inherited Allesh-Gilliam as their place from the quest, so "Call it a day"
 *      from Khezek-Tor's cookline routed into a beat the location guard refused as "at Allesh-Gilliam". `where: "anywhere"`.
 *
 *  P2. The Tree's Session is a ROAD encounter. The Forest of Early Tifaret fires on the first ride to Furrier's Fixit-Farm
 *      (pinned leg), and every beat of the session — approach, merge, the three questions, the Obstructor, the tally, the
 *      endings — plays right there on the road. All nineteen inherited PolygonForest.d from the quest, so NOW would have sent
 *      the Travel Console to the forest hex and the guard would have refused any beat fired by hand. `where: "anywhere"`.
 *
 * Backup download before write; GM only.
 */
(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = []; let changes = 0; const say = (s) => report.push(s);
  const setField = (id, k, v) => { const b = byId.get(id); if (!b) return say(`✗ MISSING beat ${id}`); if (JSON.stringify(b[k]) === JSON.stringify(v)) return say(`· ok ${id} ${k}`); b[k] = v; changes++; say(`⚙ ${id}: ${k} = ${JSON.stringify(v)}`); };

  // P1
  setField("ag_crossroads_first_rides", "where", "anywhere");
  setField("ag_days_end", "where", "anywhere");
  setField("ag_ride_khezek_tor", "where", "anywhere");
  setField("ag_ride_lyrenn", "where", "anywhere");

  // P2
  for (const b of camp.beats || []) if (b?.story?.quest === "tifaret" || /^forest_of_tifaret_/.test(String(b?.id || ""))) setField(b.id, "where", "anywhere");

  console.log(`[patch-story-flow-playtest] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Playtest patch DRY RUN: ${changes} change(s) (console). Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-playtest-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Playtest patch APPLIED: ${changes} change(s). Backup downloaded.`);
})();

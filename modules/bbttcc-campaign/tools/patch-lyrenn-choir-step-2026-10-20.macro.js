/* patch-lyrenn-choir-step-2026-10-20.macro.js — the Water Choir reads as ONE chain in the quest log and the Beat Polish doc
 *  (Dave, 2026-10-20 night: "how is the Water Choir supposed to flow"). Live had the Choir twice in Lyrenn's script: a DOOR
 *  "choir" (hub + reading) and a STEP "choir" (the children grade you). The doc walks steps before doors, so the children
 *  came first and the hub three hundred lines later. The step now carries the whole chain in play order — hub → reading →
 *  children — and says so explicitly when it is done (the children played, which is what it meant before).
 *  Idempotent; DRY_RUN default true; backs up `campaigns`. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const report = []; let changes = 0;
  const WANT = ["lyrenn_water_choir", "lyrenn_water_choir_reading", "lyrenn_choir_children"];
  const st = (camp.story?.scripts?.lyrenn?.steps || []).find(s => s.id === "choir");
  if (!st) report.push("⚠ lyrenn step 'choir' not found");
  else if (JSON.stringify(st.beats) === JSON.stringify(WANT) && st.done?.mark === "lyrenn_choir_children") report.push("· ok lyrenn step 'choir': the whole chain");
  else { st.beats = WANT; st.done = { mark: "lyrenn_choir_children" }; st.line = "The Water Choir is tuning to you. Stand in it, listen, and let the children grade you. Ask which basin is flat. Not why."; changes++; report.push("✚ lyrenn step 'choir': hub → reading → children, done = the children played"); }
  console.log(`[lyrenn-choir-step 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-lyrenn-choir-step-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the Choir is one chain.`);
})();

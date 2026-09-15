// Bad Eden — Phase 2 migration: beats DECLARE quest · chapter · ending; the store is bootstrapped (2026-09-13)
// ─────────────────────────────────────────────────────────────────────────────
// What this does (idempotent, DRY_RUN first, backs up `campaigns`):
//   1. Stamps `beat.story = {quest, chapter?, role?, ending?, alsoStarts?}` on every beat of the active
//      campaign, derived from QUEST_MAP + the beats' own questEffects rows + questRole (story-model.js
//      `declarationsFor`). Existing hand-authored `beat.story` blocks are kept.
//   2. Bootstraps the story store (setting bbttcc-campaign.storyState) from the fired ledgers + the
//      coalition quest buckets, so the live game keeps every fact it already holds.
//   3. Projects the buckets from the store (the Quest Log keeps working; one writer from now on).
// After this: worldEffects.questEffects accept/complete rows no longer move buckets on declared beats,
// seals derive from the store (keystones never seal; started quests stay open across acts), and the
// Visualizer reads the store. Run as GM with "Thatward's Ho!" active. Flip DRY_RUN in the pasted copy.

(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications?.error("GM only");
  const story = game.bbttcc?.api?.campaign?.story;
  if (!story?.declarationsFor && !story?.declOf) return ui.notifications?.error("story API not loaded — F5 after deploy");
  const { declarationsFor } = await import("/modules/bbttcc-campaign/scripts/story-model.js");

  let campaigns = game.settings.get(NS, "campaigns");
  if (typeof campaigns === "string") { try { campaigns = JSON.parse(campaigns); } catch (_e) {} }
  campaigns = foundry.utils.deepClone(campaigns || {});
  const cid = game.bbttcc.api.campaign.getActiveCampaignId();
  const camp = cid && campaigns[cid];
  if (!camp?.beats) return ui.notifications?.error("No active campaign with beats");

  const { decls, report } = declarationsFor(camp.beats);
  let stamped = 0, kept = 0;
  for (const b of camp.beats) {
    const d = decls[String(b.id)]; if (!d) continue;
    if (b.story && b.story.quest && b.story.__hand === true) { kept++; continue; }
    // an authored role/ending survives re-derivation (patch-opening-closer's ending on the Opening Scene, 2026-09-14)
    if (b.story && b.story.role && !d.role) { d.role = b.story.role; if (b.story.ending) d.ending = b.story.ending; if (b.story.chapter && !d.chapter) d.chapter = b.story.chapter; }
    if (JSON.stringify(b.story) === JSON.stringify(d)) continue;
    b.story = d; stamped++;
  }
  const lines = [
    `<b>migrate-story-declarations — ${DRY_RUN ? "DRY RUN (nothing written)" : "APPLIED"}</b>`,
    `declarations: ${Object.keys(decls).length} beats · starts ${report.starts} · endings ${report.endings} · closers ${report.closers} · cross-quest starts ${report.also}`,
    `stamped ${stamped} · kept (hand-authored) ${kept}`,
    report.dropped.length ? `<b>cross-quest completes NOT carried (${report.dropped.length})</b> — a beat completing a different quest than its own (the old daisy chains); each target quest now closes on its own closer:<br>${report.dropped.map(x => `&nbsp;${x.beat} → ${x.as}`).join("<br>")}` : "no cross-quest completes",
    report.unmapped.length ? `<b>unmapped questIds (${report.unmapped.length})</b>: ${report.unmapped.slice(0, 20).join(", ")}` : "every beat maps to a quest"
  ];
  if (!DRY_RUN) {
    const raw = game.settings.get(NS, "campaigns");
    (foundry.utils.saveDataToFile || saveDataToFile)(typeof raw === "string" ? raw : JSON.stringify(raw), "application/json", `backup-campaigns-before-story-declarations-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await game.settings.set(NS, "campaigns", campaigns);
    const boot = await story.bootstrap(cid);
    lines.push(`store bootstrapped: ${boot.changes?.length || 0} facts recorded · buckets projected: ${boot.projected} moved`);
    const st = story.state(cid);
    lines.push(`store now: ${Object.keys(st.played || {}).length} played · ${Object.keys(st.started || {}).length} quests started · ${Object.keys(st.closed || {}).length} closed`);
  } else {
    lines.push("<i>on apply: bootstrap the store from the fired ledgers + buckets, then project the buckets</i>");
  }
  console.log("[migrate-story-declarations]", { report, stamped, kept });
  await ChatMessage.create({ content: `<div style="font-size:12px">${lines.join("<hr>")}</div>`, whisper: game.users.filter(u => u.isGM).map(u => u.id) });
  ui.notifications?.info(`story declarations: ${DRY_RUN ? "dry run posted" : "applied"}`);
})();

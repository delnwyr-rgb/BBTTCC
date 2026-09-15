// Bad Eden — the Opening closes Act 0 (2026-09-14) — DRY_RUN
// Live-caught: after the Cold Open + Opening Scene the story was still in Act 0, and the future-act
// guard (rightly) refused the Act-1 Allesh-Gilliam opening. The Phase Charter says the Offices' closer
// "fires Cold Open + Opening Scene → storyPhase = 1"; the data never carried that setter (Joans' speech,
// three beats later, did). This stamps `worldEffects.phaseAdvance = {set: 1}` on thatwards_ho_opening_scene
// and declares it the closer of the Opening chapter. Idempotent; backs up `campaigns`.
(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications?.error("GM only");
  let campaigns = game.settings.get(NS, "campaigns");
  if (typeof campaigns === "string") { try { campaigns = JSON.parse(campaigns); } catch (_e) {} }
  campaigns = foundry.utils.deepClone(campaigns || {});
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = cid && campaigns[cid];
  if (!camp?.beats) return ui.notifications?.error("No active campaign with beats");
  const b = camp.beats.find(x => String(x.id) === "thatwards_ho_opening_scene");
  if (!b) return ui.notifications?.error("thatwards_ho_opening_scene not found");
  const report = []; let changed = 0;
  b.worldEffects = b.worldEffects || {};
  if (Number(b.worldEffects.phaseAdvance?.set) !== 1) { b.worldEffects.phaseAdvance = { set: 1 }; changed++; report.push("✚ thatwards_ho_opening_scene: phaseAdvance {set: 1} — the Opening closes Act 0"); } else report.push("· ok (already) phaseAdvance 1");
  const wantStory = { quest: "offices", chapter: "opening", role: "closer", ending: "opened" };
  if (JSON.stringify(b.story) !== JSON.stringify(wantStory)) { b.story = wantStory; changed++; report.push("✚ thatwards_ho_opening_scene: closer of the Opening chapter"); } else report.push("· ok (already) story closer");
  if (!DRY_RUN && changed) {
    const raw = game.settings.get(NS, "campaigns");
    (foundry.utils.saveDataToFile || saveDataToFile)(typeof raw === "string" ? raw : JSON.stringify(raw), "application/json", `backup-campaigns-before-opening-closer-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await game.settings.set(NS, "campaigns", campaigns);
  }
  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply." : "APPLIED.";
  console.log("[patch-opening-closer]", banner, report);
  await ChatMessage.create({ content: `<div style="font-size:12px"><b>patch-opening-closer — ${banner}</b><br>${report.map(r => "&nbsp;" + r).join("<br>")}<br><i>If the Opening Scene has already played this game: run it once more from the Visualizer (or set the act to 1 in the Reset Console) and the Allesh-Gilliam opening will open as a door.</i></div>`, whisper: game.users.filter(u => u.isGM).map(u => u.id) });
  ui.notifications?.info(`Opening closer: ${banner}`);
})();

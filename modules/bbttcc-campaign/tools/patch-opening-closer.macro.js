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
  // the Act-2 door beat is Act 2 content: gate it ≥2 so it is never a DOOR in Act 1 (the phase door fires it
  // after the phase is set, and that source bypasses the guard) — replay-caught 2026-09-14
  const night = camp.beats.find(x => String(x.id) === "a2_that_one_night");
  if (night) { const reqs = Array.isArray(night.inject?.requires) ? night.inject.requires : []; if (!reqs.some(r => r && r.flag === "storyPhase" && Number(r.gte) >= 2)) { night.inject = Object.assign({}, night.inject || {}, { requires: [...reqs, { flag: "storyPhase", gte: 2 }] }); changed++; report.push("✚ a2_that_one_night: gate storyPhase ≥ 2 (never a door in Act 1)"); } else report.push("· ok (already) a2_that_one_night gated ≥ 2"); }
  else report.push("⚠ a2_that_one_night not found — run seed-lyrenn-blast-treatment first");
  b.worldEffects = b.worldEffects || {};
  if (Number(b.worldEffects.phaseAdvance?.set) !== 1) { b.worldEffects.phaseAdvance = { set: 1 }; changed++; report.push("✚ thatwards_ho_opening_scene: phaseAdvance {set: 1} — the Opening closes Act 0"); } else report.push("· ok (already) phaseAdvance 1");
  const wantStory = { quest: "offices", chapter: "opening", role: "ending", ending: "opened", __hand: true };   // __hand: the migration never re-derives this one   // ENDING of the Opening chapter — "closer" would close the whole Offices quest (caught by the offline replay 2026-09-14)
  if (JSON.stringify(b.story) !== JSON.stringify(wantStory)) { b.story = wantStory; changed++; report.push("✚ thatwards_ho_opening_scene: ending of the Opening chapter (role ending)"); } else report.push("· ok (already) story closer");
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

/**
 * patch-backlog-round-2026-11-03.macro.js — THE FAILURE-PASS BACKLOG (Dave 2026-11-03: "Yes please"). Content half; code half: the
 * "@payer" factionEffects token (world-mutation-engine), courier auto-delete + sweep, Resume card Lock the Turn, Scout Signs hex name,
 * planner default Domain, stale ride pause cleared on Resume.
 *   1. THE GOOD ROOM asked "Ask what the room is FOR now." twice — once on kt_good_room (it opens the Back-Room Roster) and again on
 *      the Roster (it opens the real answer, "A rematch"). The Roster's ask becomes "Ask what she means to do with the room."
 *   2. THE LONG MARKET's intro carried an authoring placeholder, "Something else", that closed the window — removed.
 *   3. PURCHASES PAY ONCE: five story purchases charged every Domain on the roster ("@coalition") — Etta's preserves, the caravan
 *      fee, the Absolutely Reliable, the two Stormborn papers. Their cost rows now charge "@payer" (the picked Steward's Domain).
 *   4. THE GHOST DOMAIN: the campaign roster listed ji3RBtuYsfE4XypC (no such actor) and the lead twice — computed live, removed.
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const BACKLOG_ROUND = (() => {
  const PURCHASES = ["ag_etta_bought_in", "ag_market_caravan_paid", "reliable_bought", "enc_trade_convoy_paper_friend", "enc_trade_convoy_paper_warning"];
  const OLD_ASK = "Ask what the room is FOR now.", NEW_ASK = "Ask what she means to do with the room.";
  function apply(camp, liveIds) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    // 1 — every copy of the Roster's ask that opens the answer (the Roster and any answer menu that copies it)
    for (const b of beats) for (const c of (b.choices || [])) {
      if (c && c.label === OLD_ASK && c.next === "ans_kt_back_room_for") { c.label = NEW_ASK; changes++; report.push(`✚ ${b.id}: "${NEW_ASK}"`); }
    }
    // 2
    const lm = beats.find(b => b?.id === "allesh_gilliam_the_long_market_intro");
    if (lm) { const before = (lm.choices || []).length; lm.choices = (lm.choices || []).filter(c => !(/^Something else$/i.test(String(c?.label || "").trim()) && !c.next)); if (lm.choices.length !== before) { changes++; report.push("✂ allesh_gilliam_the_long_market_intro: \"Something else\""); } }
    else conflicts.push("allesh_gilliam_the_long_market_intro not found");
    // 3
    for (const id of PURCHASES) {
      const b = beats.find(x => x?.id === id); if (!b) { report.push(`· ${id}: not found`); continue; }
      for (const f of (b.worldEffects?.factionEffects || [])) {
        if (f && f.factionId === "@coalition" && Object.values(f.opDeltas || {}).some(v => Number(v) < 0)) { f.factionId = "@payer"; changes++; report.push(`✚ ${id}: cost → @payer`); }
      }
    }
    // 4
    if (Array.isArray(liveIds)) {
      const norm = (x) => String(x || "").replace(/^Actor\./, "");
      const lead = norm(camp.factionId);
      const want = [], seen = []; for (const x of (camp.factionIds || [])) { const id = norm(x); if (!id || !liveIds.includes(id) || seen.includes(id)) continue; seen.push(id); want.push(x); }   // missing + duplicate ids only; each kept entry keeps its stored form ("Actor.<id>"); the lead stays where it was
      const before = JSON.stringify(camp.factionIds || []);
      if (JSON.stringify(want) !== before) { report.push(`✚ campaign roster: ${before} → ${JSON.stringify(want)} (lead ${lead})`); camp.factionIds = want; changes++; }
    }
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = BACKLOG_ROUND;
} else (async () => {
  const DRY_RUN = (globalThis.__backlogDry ?? true);
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const liveIds = (game.actors?.contents || []).map(a => a.id);
  const { changes, report, conflicts } = BACKLOG_ROUND.apply(camp, liveIds);
  console.log(`[backlog round 2026-11-03] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__backlog = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-backlog-round-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied — backlog round (${changes}).`);
})();

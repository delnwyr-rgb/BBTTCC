/* prep-dress-rehearsal.macro.js — set the Fixit Farm first-visit stage (2026-07-03)
 *
 * Does TWO things, in order:
 *  A. Marks the three routing-only speaker beats `dialogueOffer: false`
 *     (fixit_leyline_stabilizer_no_deal, gullywasher_cultural_summit_success/
 *     _failure) — they carry bounce-back/vestigial choices and must never be
 *     offered as conversation entries. (Engine support deployed 2026-07-03.)
 *  B. Starts the first-visit quests — Furrier's Fixit Farm, The Weeping
 *     Prisoner, The Leyline Stabilizer — by running a TEMPORARY beat with
 *     questEffects accept×3 through the REAL pipeline (runBeat →
 *     _applyQuestEffects → coalition fan-out to all campaign factions), then
 *     removing it. Because it resolves like any beat, the invite scan fires
 *     the rehearsal's opening move by itself: expect a public card —
 *     "Mara Quickhands is ready to talk terms on the Leyline Stabilizer."
 *     (Dougan may light up too; his hub is an ungated repeatable.)
 *
 * DRY_RUN default true. Idempotent-ish: skips quests already active/completed;
 * re-marking dialogueOffer is harmless. Run as GM with "Thatward's Ho!" active.
 */
(async () => {
  const DRY_RUN = false;

  const NS = "bbttcc-campaign";
  const NO_OFFER = ["fixit_leyline_stabilizer_no_deal", "gullywasher_cultural_summit_success", "gullywasher_cultural_summit_failure"];
  const ACCEPT = [
    { questId: "quest_nrkJabUwZOLAJFYn", label: "Furrier's Fixit Farm" },
    { questId: "quest_uDuNp2yQxbuKkHx7", label: "The Weeping Prisoner" },
    { questId: "quest_bSwOIWzxqNBwJ5NM", label: "The Leyline Stabilizer" }
  ];
  const TEMP_ID = "rehearsal_stage_setter_temp";

  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign;
  if (!api?.runBeat) return ui.notifications.error("Campaign API missing.");
  const campaignId = api.getActiveCampaignId();

  let raw = game.settings.get(NS, "campaigns");
  const wasString = typeof raw === "string";
  const data = wasString ? JSON.parse(raw) : raw;
  const c = data?.[campaignId];
  if (!c) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const write = () => game.settings.set(NS, "campaigns", wasString ? JSON.stringify(data) : data);

  const report = [];

  // A. dialogueOffer opt-outs
  for (const id of NO_OFFER) {
    const b = (c.beats || []).find(x => x?.id === id);
    if (!b) { report.push(`❌ ${id}: not found`); continue; }
    if (b.dialogueOffer === false) { report.push(`= ${id}: already dialogueOffer:false`); continue; }
    report.push(`+ ${id}: dialogueOffer:false`);
    if (!DRY_RUN) b.dialogueOffer = false;
  }

  // B. which quests actually need starting? (check the first campaign faction's buckets)
  const fids = (c.factionIds || [c.factionId]).filter(Boolean).map(s => String(s).replace(/^Actor\./, ""));
  const f0 = game.actors.get(fids[0]);
  const track = f0?.flags?.["bbttcc-factions"]?.quests || {};
  const needed = ACCEPT.filter(q => !track.active?.[q.questId] && !track.completed?.[q.questId]);
  for (const q of ACCEPT) report.push(`${needed.includes(q) ? "+" : "="} quest "${q.label}": ${needed.includes(q) ? "ACCEPT (via temp beat)" : "already active/completed — skipped"}`);

  if (!DRY_RUN) {
    // write the dialogueOffer marks (and prune any stale temp beat) first
    c.beats = (c.beats || []).filter(b => b?.id !== TEMP_ID);
    if (needed.length) {
      c.beats.push({
        id: TEMP_ID, label: "Arrival at Furrier's Fixit Farm (stage setter)",
        type: "dialog", timeScale: "scene", tags: "rehearsal", description:
          "The Farm takes you in: the chimes, the Counter, the humming Gate. Work finds you quickly.",
        outcomes: { success: null, failure: null }, choices: [], actors: [], refs: {},
        worldEffects: { questEffects: needed.map(q => ({ action: "accept", questId: q.questId, text: `Accepted: ${q.label}` })) }
      });
    }
    await write();
    if (needed.length) {
      await api.runBeat(campaignId, TEMP_ID);
      // re-read (runBeat path may have re-saved) then remove the temp beat
      let raw2 = game.settings.get(NS, "campaigns");
      const data2 = (typeof raw2 === "string") ? JSON.parse(raw2) : raw2;
      const c2 = data2?.[campaignId];
      if (c2) { c2.beats = (c2.beats || []).filter(b => b?.id !== TEMP_ID); await game.settings.set(NS, "campaigns", (typeof raw2 === "string") ? JSON.stringify(data2) : data2); }
    }
  }

  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply." : "APPLIED.";
  console.log(`[prep-dress-rehearsal] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`Dress-rehearsal prep: ${banner} (see console)`);
  if (!DRY_RUN) console.log("[prep-dress-rehearsal] Watch chat: the invitation card(s) should arrive within a few seconds. " +
    "Then click 'Talk to Mara' and negotiate the stabilizer in her own words — no menus.");
})();

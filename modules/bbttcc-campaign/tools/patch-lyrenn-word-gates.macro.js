/**
 * patch-lyrenn-word-gates.macro.js — GM console/macro. DRY_RUN=true by default.
 *
 * Live-caught 2026-09-13 (Post Lyrenn Act 2, V1): leaving Lyrenn posted "Word from
 * Lyrenn — The Treeline Moves" (Rowan's summons for The Forest Will Not Be Fought)
 * AFTER the party had already played that thread in person. The two authored
 * "Word from Lyrenn" summons beats gate only on turn ≥ 2 — nothing ties them to the
 * quest they summon for. This adds the same gates the quest's own acceptance beat
 * carries:  { questBucket: <quest>, isNot: "active" } + { …, isNot: "completed" }.
 *
 * Also repairs what the same session left behind (engine bug fixed the same day —
 * executeBeat applied quest effects at chain SETTLE, so the closing beat's "complete"
 * landed before the acceptance beat's "accept" and flipped three finished quests
 * back to active): moves The Field That Remembers You / The Forest Will Not Be
 * Fought / The Gentle Pest to COMPLETED on every coalition faction's track, drops
 * the stale Treeline invitation from directorState.invited, and deletes its open
 * chat card. Idempotent. Backs up `campaigns` + `directorState` to downloads first.
 */
(async () => {
  const DRY_RUN = false;                          // ← set false to apply
  const NS = "bbttcc-campaign", MODF = "bbttcc-factions";
  const GATES = {
    lyrenn_word_treeline: "quest_feX6WHsBXuVbtjMM",   // Lyrenn - The Forest Will Not Be Fought
    lyrenn_word_channels: "quest_uMKbX648SllKTpEH"    // Lyrenn - The Gentle Pest
  };
  const COMPLETE = ["quest_0HBaQXGlhFvNke2B", "quest_feX6WHsBXuVbtjMM", "quest_uMKbX648SllKTpEH"];
  const STALE_INVITES = ["lyrenn_word_treeline"];

  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign;
  const cid = api?.getActiveCampaignId?.();
  let rawC = game.settings.get(NS, "campaigns"); const cStr = typeof rawC === "string";
  const camps = cStr ? JSON.parse(rawC) : foundry.utils.deepClone(rawC);
  const camp = camps?.[cid];
  if (!camp) return ui.notifications.error("No active campaign.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  if (!Array.isArray(camp.beats)) camp.beats = beats;
  const changes = [];

  // 1) gates on the summons beats
  let campChanged = false;
  for (const [beatId, questId] of Object.entries(GATES)) {
    const beat = beats.find(b => b?.id === beatId);
    if (!beat) { changes.push(`SKIP ${beatId}: not in the active campaign`); continue; }
    beat.inject = (beat.inject && typeof beat.inject === "object") ? beat.inject : {};
    const reqs = Array.isArray(beat.inject.requires) ? beat.inject.requires : [];
    for (const st of ["active", "completed"]) {
      if (reqs.some(c => c && String(c.questBucket) === questId && String(c.isNot || "") === st)) continue;
      reqs.push({ questBucket: questId, isNot: st }); campChanged = true;
      changes.push(`GATE ${beatId}: + {questBucket:${questId}, isNot:"${st}"}`);
    }
    beat.inject.requires = reqs;
  }

  // 2) coalition tracks: the three Lyrenn quests are COMPLETED
  const factionIds = [...new Set([].concat(camp.factionIds || [], camp.factionId ? [camp.factionId] : []).map(x => String(x || "").replace(/^Actor\./, "")).filter(Boolean))];   // dedupe: factionId is also in factionIds
  const trackWrites = [];
  for (const fid of factionIds) {
    const F = game.actors.get(String(fid).replace(/^Actor\./, "")); if (!F) continue;
    const cur = foundry.utils.deepClone(F.getFlag(MODF, "quests") || {});
    cur.active ||= {}; cur.completed ||= {}; cur.archived ||= {};
    let n = 0;
    for (const q of COMPLETE) {
      const row = cur.active[q]; if (!row) continue;
      row.status = "completed"; row.completedTs = row.completedTs || Date.now(); row.lastTouchedTs = Date.now();
      row.history = Array.isArray(row.history) ? row.history : [];
      row.history.push({ ts: Date.now(), type: "complete", beatId: null, effectBeatId: null, state: "completed", text: "Repair 2026-09-13: closing beat had fired; acceptance re-applied at chain settle flipped it back (engine fixed).", by: game.user.id });
      cur.completed[q] = row; delete cur.active[q]; n++;
      changes.push(`TRACK ${F.name}: ${q} active → completed`);
    }
    if (n) trackWrites.push({ F, cur });
  }

  // 3) stale invitations: Director record + open chat card
  const rawD = game.settings.get(NS, "directorState"); const dStr = typeof rawD === "string";
  const dstate = dStr ? JSON.parse(rawD) : foundry.utils.deepClone(rawD || {});
  let dirChanged = false; const cardIds = [];
  for (const bid of STALE_INVITES) {
    if (dstate?.invited?.[bid]) { delete dstate.invited[bid]; dirChanged = true; changes.push(`INVITED −${bid}`); }
    for (const m of game.messages.contents) { const f = m.getFlag(NS, "talkInvite"); if (f && !f.accepted && (f.beatIds || []).map(String).includes(bid)) { cardIds.push(m.id); changes.push(`CARD delete ${m.id} (${bid})`); } }
  }

  console.group(`[lyrenn-word-gates] ${DRY_RUN ? "DRY RUN — " : ""}${changes.length} change(s)`); changes.forEach(c => console.log(" •", c)); console.groupEnd();
  if (!changes.length) return ui.notifications.info("Nothing to do — gates, tracks and invitations already in order.");
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes.length} change(s) listed in console (F12). Set DRY_RUN=false to apply.`);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const save = foundry.utils.saveDataToFile || saveDataToFile;
  save(JSON.stringify(cStr ? JSON.parse(rawC) : rawC), "application/json", `backup-campaigns-before-lyrenn-word-gates-${stamp}.json`);
  save(JSON.stringify(dStr ? JSON.parse(rawD) : rawD), "application/json", `backup-directorState-before-lyrenn-word-gates-${stamp}.json`);
  if (campChanged) await game.settings.set(NS, "campaigns", cStr ? JSON.stringify(camps) : camps);
  for (const { F, cur } of trackWrites) { await F.unsetFlag(MODF, "quests"); await F.setFlag(MODF, "quests", cur); }   // setFlag merges — unset first
  if (dirChanged) await game.settings.set(NS, "directorState", dStr ? JSON.stringify(dstate) : dstate);
  if (cardIds.length) await ChatMessage.deleteDocuments(cardIds);
  ui.notifications.info(`Lyrenn word gates + track repair applied (${changes.length} change(s)).`);
})();

// Bad Eden Audit Quest ↔ Hex Links
// GM macro — scans every scene's hex drawings and the quest registry for
// orphan / mismatched links and offers a one-click cleanup. Reports:
//   1. Hex flag references a quest that no longer exists in the registry.
//   2. Quest hexIds[] references a hex that no longer exists in any scene.
//   3. Hex flag and quest registry disagree (one side has the link, the other doesn't).

(async () => {
  if (!game.user?.isGM) { ui.notifications.warn("GM only."); return; }

  const ql = game?.bbttcc?.api?.territory?.questLinks;
  const cApi = game?.bbttcc?.api?.campaign?.quests;
  if (!ql || !cApi) { ui.notifications.error("Quest-links / campaign API not loaded."); return; }

  const issues = ql.auditOrphans();
  const totals =
    issues.hexRefsMissingQuest.length +
    issues.questRefsMissingHex.length +
    issues.mismatches.length;

  if (!totals) {
    ui.notifications.info("Audit clean — no orphan or mismatched quest-hex links.");
    return;
  }

  const fmtRow = (r, kind) => {
    if (kind === "hexRefsMissingQuest")
      return `<li><b>Hex</b> drawing <code>${r.drawingId}</code> on scene <code>${r.sceneId}</code> references missing quest <code>${r.questId}</code>.</li>`;
    if (kind === "questRefsMissingHex")
      return `<li><b>Quest</b> <code>${r.questId}</code> references missing hex drawing <code>${r.drawingId}</code>.</li>`;
    return `<li><b>Mismatch</b> — quest <code>${r.questId}</code> ↔ drawing <code>${r.drawingId}</code> (${r.side}).</li>`;
  };

  const html = `
    <div style="max-height:60vh; overflow:auto;">
      ${issues.hexRefsMissingQuest.length ? `<h3>Hex → Missing Quest (${issues.hexRefsMissingQuest.length})</h3><ul>${issues.hexRefsMissingQuest.map(r => fmtRow(r,"hexRefsMissingQuest")).join("")}</ul>` : ""}
      ${issues.questRefsMissingHex.length ? `<h3>Quest → Missing Hex (${issues.questRefsMissingHex.length})</h3><ul>${issues.questRefsMissingHex.map(r => fmtRow(r,"questRefsMissingHex")).join("")}</ul>` : ""}
      ${issues.mismatches.length ? `<h3>Mismatches (${issues.mismatches.length})</h3><ul>${issues.mismatches.map(r => fmtRow(r,"mismatches")).join("")}</ul>` : ""}
      <p style="margin-top:8px; opacity:.8;">Cleanup will: remove dead quest-id entries from hex flags, drop missing drawing ids from quest hexIds[], and re-stamp the missing side of any mismatch.</p>
    </div>`;

  const yes = await Dialog.confirm({
    title: `Audit — ${totals} issue${totals === 1 ? "" : "s"}`,
    content: html,
    yes: () => true,
    no: () => false,
    defaultYes: false
  });
  if (!yes) return;

  let fixed = 0;
  // 1. Hex → missing quest
  for (const r of issues.hexRefsMissingQuest) {
    try {
      const sc = game.scenes.get(r.sceneId);
      const dr = sc?.drawings?.get(r.drawingId);
      if (!dr) continue;
      const map = foundry.utils.deepClone(dr.flags?.["bbttcc-territory"]?.quests || {});
      if (map[r.questId]) {
        delete map[r.questId];
        await dr.setFlag("bbttcc-territory", "quests", map);
        fixed++;
      }
    } catch (e) { console.warn("audit cleanup hex→missing failed", e); }
  }
  // 2. Quest → missing hex
  for (const r of issues.questRefsMissingHex) {
    try {
      const q = cApi.getQuest(r.questId);
      if (!q) continue;
      const next = (q.hexIds || []).filter(id => String(id) !== String(r.drawingId));
      await cApi.saveQuest(r.questId, { ...q, hexIds: next });
      fixed++;
    } catch (e) { console.warn("audit cleanup quest→missing failed", e); }
  }
  // 3. Mismatches — re-stamp via linkHexQuest (idempotent) so both sides agree.
  for (const r of issues.mismatches) {
    try {
      await ql.linkHexQuest(r.drawingId, r.questId, {});
      fixed++;
    } catch (e) { console.warn("audit re-stamp failed", e); }
  }

  ui.notifications.info(`Audit cleanup applied: ${fixed} change${fixed === 1 ? "" : "s"}.`);
})();

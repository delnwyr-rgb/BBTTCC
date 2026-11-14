/*
 * patch-cr-parley-player-facing-2026-11-13.macro.js — Dave (2026-11-13), on the ride to Lyrenn: "My seat doesn't seem to have
 * advanced yet." The Circuit Riders road encounter mirrors its first card (approach / observe) to the player seats, but the rest of
 * the Parley chain — opening, respect / humor / skepticism, resolution, alliance / neutral / flagged — was GM-only
 * (playerFacing false on all five flags), so the players' seats stuck on the approach card. Every enc_circuit_riders_parley_* beat,
 * plus any beat the chain's choices lead to that is GM-only, becomes player-facing like the approach.
 * Ember Bad Eden. globalThis.__crFacingDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__crFacingDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const byId = new Map(beats.map(b => [b.id, b]));
  const FLAGS = ["playerFacing", "playerFacingDialog", "dialogPlayerFacing", "playerFacingContent", "showToPlayers"];
  const chain = beats.filter(b => /^(ans_)?enc_circuit_riders_parley/.test(b.id));
  if (!chain.length) throw new Error("Circuit Riders Parley beats missing");
  const ids = new Set(chain.map(b => b.id));
  for (const b of chain) for (const ch of b.choices || []) for (const n of [ch.next, ch.failNext]) if (n && byId.has(n)) ids.add(n);
  for (const id of ids) {
    const b = byId.get(id);
    if (FLAGS.every(k => b[k] === true)) continue;
    for (const k of FLAGS) b[k] = true;
    report.changed.push(id);
  }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("CRFACING " + JSON.stringify(report));
  return report;
})();

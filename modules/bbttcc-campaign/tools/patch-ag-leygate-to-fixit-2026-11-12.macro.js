/*
 * patch-ag-leygate-to-fixit-2026-11-12.macro.js — Dave (2026-11-12): "it totally makes sense for the Leygate to lead to the Fixit
 * Farm, that would be a great outcome." Installing the stabilizer was story-only; the Allesh-Gilliam gate pointed at a hex on a
 * scene that no longer exists (pre-one-map), and Fixit's gate went one way to Port Kudzu.
 *  1. ag_leygate_installed gains worldEffects.leygate { Allesh-Gilliam ↔ Furrier's Fixit-Farm, T1, strength 0.55, twoWay } —
 *     the new WME op (world-mutation-engine.js 2g-gate) writes both hexes' flags.bbttcc-territory.leylines.gate.
 *     Fixit's old link to Port Kudzu is replaced (Port Kudzu's own end stays as it was — off).
 *  2. If the install has already played in this world, the pair is written now (the beat was on screen when this shipped).
 * Ember Bad Eden. globalThis.__agFixitDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__agFixitDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const inst = beats.find(b => b.id === "ag_leygate_installed"); if (!inst) throw new Error("ag_leygate_installed missing");
  const LG = { hexName: "Allesh-Gilliam", linkHexName: "Furrier's Fixit-Farm", enabled: true, strength: 0.55, minFactionTier: "T1", twoWay: true };
  if (JSON.stringify(inst.worldEffects?.leygate) !== JSON.stringify(LG)) {
    inst.worldEffects = { ...(inst.worldEffects || {}), leygate: LG };
    report.changed.push("installed: worldEffects.leygate AG ↔ Fixit");
  }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });

  // 2 — this world: already installed?
  const st = C.story; const played = !!st?.hasMark?.("ag_leygate_installed");
  report.installedPlayed = played;
  if (played) {
    const M = "bbttcc-territory";
    const byName = (n) => { for (const s of game.scenes) for (const d of s.drawings) { const tf = d.flags?.[M]; if (tf && (tf.isHex === true || tf.kind === "territory-hex") && String(tf.name || d.text).trim() === n) return d; } return null; };
    const a = byName(LG.hexName), b = byName(LG.linkHexName);
    if (!a || !b) throw new Error("gate hexes not found");
    for (const [doc, link] of [[a, b], [b, a]]) {
      const cur = foundry.utils.deepClone(doc.flags[M].leylines?.gate || {});
      const next = { ...cur, enabled: true, linkHexUuid: link.uuid, strength: LG.strength, minFactionTier: LG.minFactionTier, locked: false };
      if (JSON.stringify(next) === JSON.stringify(cur)) continue;
      report.changed.push(`gate written: ${doc.flags[M].name} → ${link.flags[M].name}`);
      if (!DRY_RUN) await doc.update({ [`flags.${M}.leylines.gate`]: next });
    }
  }
  console.log("AGFIXIT " + JSON.stringify(report));
  return report;
})();

/* patch-bunker-hex-coast-2026-10-20.macro.js — THE VALHAULAN BUNKER HEX MOVES TO THE COAST (Dave, Story Review Ledger round 2 open asks,
 *  2026-10-20): "Hex Scene.ve5hTwcmNddNlPxW.Drawing.lTgks2dfBN8uk3SN, and yes it does [the finale's scene link moves with it]."
 *
 *  The finale's only link to the map is the campaign's `hexOverrides` entry whose onEnterBeatIds fires `raid_thatwards_ho_finale_entry`
 *  when the party enters the hex. It sat on "Inconvenient Mountains.h" (Scene.mjV0QxxlmeZj4EHj, the Iron Reaches — inland, the wrong
 *  end of every "coastward" heading). It now sits on "Hexen Myre.o" (Scene.ve5hTwcmNddNlPxW, the Saltwake Coast — "Coastal mire
 *  country with intermittent wrong signals"), where the Triangle, the seal break and the Mall heading all point. Neither hex carries a
 *  travel hub scene, so nothing else moves. The old hex keeps nothing of the finale.
 *
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

  const OLD = "Scene.mjV0QxxlmeZj4EHj.Drawing.CqyhFsgBNRC4mEaL";   // Inconvenient Mountains.h — the Iron Reaches
  const NEW = "Scene.ve5hTwcmNddNlPxW.Drawing.lTgks2dfBN8uk3SN";   // Hexen Myre.o — the Saltwake Coast
  const BEAT = "raid_thatwards_ho_finale_entry";
  const ov = camp.hexOverrides && typeof camp.hexOverrides === "object" ? camp.hexOverrides : (camp.hexOverrides = {});
  const ids = (v) => Array.isArray(v?.onEnterBeatIds) ? v.onEnterBeatIds.filter(Boolean) : (v?.onEnterBeatId ? [v.onEnterBeatId] : []);

  // 1. the old hex loses the finale entry
  if (ov[OLD]) {
    const rest = ids(ov[OLD]).filter(x => x !== BEAT);
    if (ids(ov[OLD]).includes(BEAT)) {
      if (rest.length) { ov[OLD] = { ...ov[OLD], onEnterBeatIds: rest }; delete ov[OLD].onEnterBeatId; report.push(`✚ ${OLD}: finale entry removed, ${rest.length} other beat(s) kept`); }
      else { delete ov[OLD]; report.push(`✚ ${OLD} (Inconvenient Mountains.h): finale entry removed — override gone`); }
      changes++;
    } else report.push(`· ok ${OLD}: no finale entry`);
  } else report.push(`· ok ${OLD}: no override`);

  // 2. the coast hex gains it
  {
    const cur = ids(ov[NEW]);
    if (cur.includes(BEAT)) report.push(`· ok ${NEW}: finale entry already set`);
    else { ov[NEW] = { ...(ov[NEW] || {}), onEnterBeatIds: [...cur, BEAT] }; delete ov[NEW].onEnterBeatId; changes++; report.push(`✚ ${NEW} (Hexen Myre.o, the Saltwake Coast): entering fires ${BEAT}`); }
  }
  // 3. sanity: the hex exists on this world (report only — the setting write does not need the scene)
  try {
    const sc = game.scenes?.get("ve5hTwcmNddNlPxW"); const d = sc?.drawings?.get("lTgks2dfBN8uk3SN");
    report.push(d ? `· hex check: ${d.flags?.["bbttcc-territory"]?.name} on ${sc.name}` : "⚠ hex check: drawing lTgks2dfBN8uk3SN not found on scene ve5hTwcmNddNlPxW (offline sim?)");
  } catch (_e) { report.push("· hex check skipped"); }

  console.log(`[bunker-hex-coast 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-bunker-hex-coast-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the bunker is on the coast.`);
})();

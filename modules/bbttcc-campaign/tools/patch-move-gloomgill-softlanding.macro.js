/* patch-move-gloomgill-softlanding.macro.js — RUN IN-WORLD (GM). DRY_RUN default true.
 *
 * Owner rulings 2026-09-25: Sweet Release already holds Odaroloc River.c at dev 2 (claimed before the
 * quest markers existed), so GLOOMGILL moves to LAKE SUSPICIOUS (Scene.zjVbB2ykTV6PcSiv.Drawing.fiyeCSNkwUXIUMbL);
 * SOFT LANDING moves from Saltwake Reach a to YNNERMIRE.B (Drawing 0Tx4lrGqqteg7JEU). The code QUEST_MAP has
 * already moved (story-model.js); this macro moves the LIVE world:
 *   1. beats: gloomgill_intro.hexName → Lake Suspicious · soft_landing_arrival.hexName → Ynnermire.b
 *   2. hex drawings: flags.bbttcc-territory.campaign.onEnterBeatId — cleared on River.c, set on Lake Suspicious
 *      (gloomgill_intro) and on Ynnermire.b (soft_landing_arrival)
 *   3. campaign.story quest defs for gloomgill + soft_landing written with the new hex (data = live before F5)
 * Idempotent. Backs up the campaigns setting before writing.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign", TERR = "bbttcc-territory";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const MOVES = [
    { key: "gloomgill",    beat: "gloomgill_intro",      from: "Odaroloc River.c", to: "Lake Suspicious", toUuid: "Scene.zjVbB2ykTV6PcSiv.Drawing.fiyeCSNkwUXIUMbL" },
    { key: "soft_landing", beat: "soft_landing_arrival", from: "Saltwake Reach a", to: "Ynnermire.b",     toUuid: "Scene.zjVbB2ykTV6PcSiv.Drawing.0Tx4lrGqqteg7JEU" }
  ];
  const report = []; let changes = 0; const say = (m) => report.push(m);
  const hexByName = (name) => { for (const sc of game.scenes) for (const d of sc.drawings) { const t = d.flags?.[TERR]; if (t && (t.isHex || t.kind === "territory-hex") && String(t.name || "").trim().toLowerCase() === name.toLowerCase()) return d; } return null; };

  // 1. beats
  let campsRaw = game.settings.get(NS, "campaigns"); const wasStr = typeof campsRaw === "string";
  const camps = wasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.(); const camp = camps?.[cid];
  if (!camp) return ui.notifications.error(`Active campaign '${cid}' not found.`);
  for (const mv of MOVES) {
    const b = (camp.beats || []).find(x => x.id === mv.beat);
    if (!b) { say(`✗ beat ${mv.beat} missing`); continue; }
    if (b.hexName === mv.to) { say(`· ok ${mv.beat} already at ${mv.to}`); continue; }
    b.hexName = mv.to; if (b.targetHexUuid) b.targetHexUuid = mv.toUuid; changes++; say(`✎ ${mv.beat}: hexName ${mv.from} → ${mv.to}`);
  }
  // 2. hex on-enter wiring
  const hexWrites = [];
  for (const mv of MOVES) {
    const oldHex = hexByName(mv.from), newHex = await fromUuid(mv.toUuid);
    if (oldHex && oldHex.flags?.[TERR]?.campaign?.onEnterBeatId === mv.beat) { hexWrites.push([oldHex, { [`flags.${TERR}.campaign.-=onEnterBeatId`]: null }]); changes++; say(`✎ ${mv.from}: onEnter ${mv.beat} cleared`); }
    if (!newHex) { say(`✗ ${mv.to}: drawing ${mv.toUuid} not found`); continue; }
    if (newHex.flags?.[TERR]?.campaign?.onEnterBeatId !== mv.beat) { hexWrites.push([newHex, { [`flags.${TERR}.campaign.onEnterBeatId`]: mv.beat }]); changes++; say(`✎ ${mv.to}: onEnter → ${mv.beat}`); }
    else say(`· ok ${mv.to} onEnter already ${mv.beat}`);
  }
  // 3. story data quest defs (live before F5; the code QUEST_MAP has moved in the repo)
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {} };
  const have = storyApi?.get?.(cid) || { quests: {} };
  const questWrites = [];
  for (const mv of MOVES) {
    const cur = have.quests?.[mv.key] || code.quests?.[mv.key]; if (!cur) { say(`✗ no quest def for ${mv.key}`); continue; }
    if (cur.hex === mv.to && have.quests?.[mv.key]) { say(`· ok story quest ${mv.key} at ${mv.to}`); continue; }
    questWrites.push([mv.key, { ...cur, hex: mv.to }]); changes++; say(`✦ story quest ${mv.key}: hex → ${mv.to} (campaign.story)`);
  }

  console.log(`[move-gloomgill-softlanding] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Move DRY RUN: ${changes} change(s) — see console.`);
  if (!changes) return ui.notifications.info("Move: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(wasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-move-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  for (const [doc, upd] of hexWrites) await doc.update(upd);
  for (const [key, quest] of questWrites) await storyApi.saveQuest(cid, key, { quest });
  try { game.bbttcc?.api?.territory?.questMarkers?.refresh?.(); } catch (_e) {}
  ui.notifications.info(`Moved: Gloomgill → Lake Suspicious, Soft Landing → Ynnermire.b (${changes} change(s)). F5.`);
})();

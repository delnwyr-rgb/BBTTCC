/**
 * patch-tuning-round-2026-11-03.macro.js — THE FAILURE PASS TUNING ROUND (Dave 2026-11-03: "Let's fix 'em all in whatever order you feel
 * is best!"). Content half (code half: compat-bridge doctrine defs, tikkun spark target, campaign roster pick on ctx, travel rate/tables).
 *   1. STALE LEYGATE REFERENCES — six `Scene.K5IFzXw6DK5HqgYH.Drawing.*` refs (Lyrenn, Khezek-Tor, the Fixit-Farm, Port Kudzu, Legansus,
 *      the Crown Mall) pre-date the one-map migration; the Crown Mall archive's Leygate beat failed "not-found". Rewritten to the
 *      drawing's scene on the one map (computed live: only refs whose drawing is gone but whose id lives on the one map).
 *   2. The Forest's harmonious ending unlocked `battlefield_harmony`, retired 2026-05-24 (merged into Rally the Line) → `rally_the_line`.
 *   3. KILLED THE VIBE has a cost — "The Tanneritos don't fight. They remember." Coalition → Tanneritos one step down.
 *   4. FAIL CARDS STING (Dave: a failed Summit = a Darkness tick): the Summit's failure ticked the JACKALOPES' Darkness, not the
 *      coalition's → +1 coalition Darkness; the seal's flare and the shipment's fail ("The darkness does not abate.") get the same tick.
 *   5. ACT FOUR and ACT FIVE title cards (there were none; Act 4 opened silently inside the Crown Mall). autoFire, banded to their own
 *      act (gte N, lte N) so a table already past them never sees them out of order. Prose = drafts in the a3/a6 voice — Dave edits.
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const TUNING_ROUND = (() => {
  const J = (v) => JSON.stringify(v);
  const TANNERITOS = "ibpWpT3LPv0sZHio";
  const tick = { factionId: "@coalition", moraleDelta: 0, loyaltyDelta: 0, unityDelta: 0, darknessDelta: 1, opDeltas: {}, allowOvercap: false };
  const CARDS = [
    { id: "a4_title_card", label: "THATWARDS HO! — Act Four", act: 4,
      description: "The archive held. A mall's worth of dead ads, kiosk invoices and one camcorder clip agreed with the harbor and the waystation: somebody re-aimed the region's debt on purpose, and had help doing it.\n\nThe projector hums again over the Frontier Formerly Known As Texas, and the letters come down two stories tall:\n\nA C T   F O U R   —   T H E   M A L L   A N D   T H E   V A U L T\n\nA runner who always comes back hasn't. A garden of stone is counting itself. Somewhere a door in a hill is still welcoming pupils.\n\n⚙ GM: this card marks Act 4 (the Crown Mall archive raised the act)." },
    { id: "a5_title_card", label: "THATWARDS HO! — Act Five", act: 5,
      description: "The bunker isn't hidden. It never was. The ships over it land sideways on purpose, and the court inside has been keeping somebody else's books.\n\nThe projector hums again over the Frontier Formerly Known As Texas:\n\nA C T   F I V E   —   T H E   S K Y   B R E A K S   S I D E W A Y S\n\nCount who comes with you. Every road you own points at the same cracked mouth in the hill now.\n\n⚙ GM: this card marks Act 5 (The Sky Is Waiting raised the act)." }
  ];
  function apply(camp, refFix) {
    if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
    const by = new Map(camp.beats.map(b => [b.id, b]));
    const report = [], conflicts = []; let changes = 0;
    // 1
    if (refFix && Object.keys(refFix).length) {
      let raw = J(camp); let n = 0;
      for (const [from, to] of Object.entries(refFix)) { const parts = raw.split(from); if (parts.length > 1) { n += parts.length - 1; raw = parts.join(to); } }
      if (n) { const fixed = JSON.parse(raw); for (const k of Object.keys(camp)) delete camp[k]; Object.assign(camp, fixed); changes += n; report.push(`✚ ${n} stale Leygate reference(s) → the one map`); }
    }
    const B = Array.isArray(camp.beats) ? camp.beats : []; const get = (id) => B.find(b => b?.id === id);
    // 2
    const forest = get("forest_of_tifaret_harmonious_ending");
    if (forest?.unlocks?.maneuvers?.includes("battlefield_harmony")) { forest.unlocks.maneuvers = forest.unlocks.maneuvers.map(k => k === "battlefield_harmony" ? "rally_the_line" : k); changes++; report.push("✚ forest harmonious ending: battlefield_harmony (retired) → rally_the_line"); }
    // 3
    const kv = get("enc_forgotten_yesterdays_tanneritos_hostile");
    if (kv) { kv.worldEffects = kv.worldEffects || {}; const rel = kv.worldEffects.relationshipEffects = kv.worldEffects.relationshipEffects || [];
      if (!rel.some(r => r && r.targetFactionId === TANNERITOS)) { rel.push({ sourceFactionId: "@coalition", targetFactionId: TANNERITOS, step: -1 }); changes++; report.push("✚ Killed the Vibe: coalition → Tanneritos −1 step"); } }
    else conflicts.push("enc_forgotten_yesterdays_tanneritos_hostile not found");
    // 4
    for (const id of ["gullywasher_cultural_summit_failure", "khezek_tor_seal_fail", "khezek_tor_shipment_fail"]) {
      const b = get(id); if (!b) { conflicts.push(`${id} not found`); continue; }
      b.worldEffects = b.worldEffects || {}; const fe = b.worldEffects.factionEffects = Array.isArray(b.worldEffects.factionEffects) ? b.worldEffects.factionEffects : [];
      if (!fe.some(f => f && f.factionId === "@coalition" && Number(f.darknessDelta) > 0)) { fe.push({ ...tick }); changes++; report.push(`✚ ${id}: coalition Darkness +1`); }
    }
    // 5
    for (const C of CARDS) {
      if (get(C.id)) continue;
      const after = get(C.act === 4 ? "map_crown_mall_intro" : "vs_bridge_triangle") || B[B.length - 1];
      const beat = { id: C.id, label: C.label, type: "dialog", where: "anywhere", tags: "", politicalTags: "", timeScale: "moment", timePoints: 0,
        outcomes: { success: null, failure: null }, actors: [], encounter: { key: "", tier: null, actorName: "" }, refs: {},
        playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
        worldEffects: {}, description: C.description, choices: [{ label: "Onward", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
        dialogueOffer: false,
        inject: { repeatable: false, autoFire: true, requires: [{ flag: "storyPhase", gte: C.act }, { flag: "storyPhase", lte: C.act }] } };
      B.splice(B.indexOf(after) + 1, 0, beat); changes++; report.push(`✚ ${C.id} (autoFire, Act ${C.act} only)`);
    }
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = TUNING_ROUND;
} else (async () => {
  const DRY_RUN = (globalThis.__tuneDry ?? true);
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.(); const camp = camps?.[cid]; if (!camp) return ui.notifications.error("Active campaign not found.");
  // stale drawing refs: drawing gone from its scene, same id alive on the one map
  const one = [...game.scenes].find(s => /Whole Map/i.test(s.name)); const refFix = {};
  for (const u of new Set(JSON.stringify(camp).match(/Scene\.[A-Za-z0-9]{16}\.Drawing\.[A-Za-z0-9]{16}/g) || [])) {
    const [, sid, , did] = u.split("."); if (game.scenes.get(sid)?.drawings?.get(did)) continue;
    const d = one?.drawings?.get(did); if (d) refFix[u] = d.uuid;
  }
  const { changes, report, conflicts } = TUNING_ROUND.apply(camp, refFix);
  console.log(`[tuning round 2026-11-03] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__tune = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-tuning-round-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  camps[cid] = camp;
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied — tuning round (${changes}).`);
})();

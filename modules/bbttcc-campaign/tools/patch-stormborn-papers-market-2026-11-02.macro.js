/**
 * patch-stormborn-papers-market-2026-11-02.macro.js — THE STORMBORN PAPERS MOVE INTO THE MARKET (Dave 2026-11-02, failure pass: "Can we
 * move the ability to purchase our magical memory messing receipts into the market proper? That way each player can access and spend
 * their own marks on a receipt, and then have it available to play whether they are leading the party or supporting.")
 * Live-caught: the Convoy's "Buy a friend's name (5 Economy)" charged @coalition → Errata 5 AND Sweet Release 5, and its Continue closed
 * the stall (no second paper, no road).
 *   • catalog: the Trade Caravan stocks two `receipt` entries (new market kind, market.js) — "Stormborn paper — a Friend" (favorShift)
 *     and "— a Warning" (stirThePot), 5 Economy each, granted to the BUYER's own Domain through the story's Receipt path
 *   • enc_trade_convoy_paper: the two buy choices become "Look over her papers." → enc_trade_convoy_paper_browse, which opens the
 *     Trade Caravan market (worldEffects.openMarket) and offers the road; "Not today." stays. The old friend/warning beats are left
 *     unreferenced (history; nothing routes to them).
 * Idempotent (rerun = 0). DRY_RUN first. Backups (campaigns + catalog) → Data/bbttcc-exports/. GM only.
 */
const STORMBORN_PAPERS = (() => {
  const VENDOR_NAME = "Trade Caravan";
  const TRUTH_F = "A Stormborn paper: who passed this way, what they carried, which road they feared. Produce it in a court or at a Parley and say the faction's name — the room warms to them, or to you on their behalf. One paper, one name, one use.";
  const TRUTH_W = "A Stormborn paper: who passed this way, what they carried, which road they were afraid of. Produce it in a court or at a Parley and say the faction's name — the room grows wary of them. One paper, one name, one use.";
  const entries = (vendorId) => [
    { id: "stormborn-paper-friend", vendorId, kind: "receipt", name: "Stormborn paper — a Friend", blurb: "Who passed this way, folded toward warmth. Say a name at a court or a Parley and the room warms to them — or to you on their behalf. One paper, one name, one use. Your Domain keeps it.", cost: { economy: 5 }, tier: 1, rarity: "common",
      receipt: { label: "Who Passed — a Friend", effectKey: "favorShift", acquisition: "earned", source: { name: "the Stormborn stall" }, truth: TRUTH_F } },
    { id: "stormborn-paper-warning", vendorId, kind: "receipt", name: "Stormborn paper — a Warning", blurb: "Same paper, folded the other way. Say a name at a court or a Parley and the room starts wondering about them. One paper, one name, one use. Your Domain keeps it.", cost: { economy: 5 }, tier: 1, rarity: "common",
      receipt: { label: "Who Passed — a Warning", effectKey: "stirThePot", acquisition: "earned", source: { name: "the Stormborn stall" }, truth: TRUTH_W } }
  ];
  function applyCatalog(catalog, vendorId) {
    const report = []; let changes = 0;
    for (const e of entries(vendorId)) {
      const i = catalog.findIndex(x => x && x.id === e.id);
      if (i < 0) { catalog.push(e); changes++; report.push(`✚ catalog: ${e.name}`); }
      else if (JSON.stringify(catalog[i]) !== JSON.stringify({ ...catalog[i], ...e })) { catalog[i] = { ...catalog[i], ...e }; changes++; report.push(`✚ catalog: ${e.name} (updated)`); }
    }
    return { changes, report };
  }
  function applyCamp(camp, vendorId) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    const paper = beats.find(b => b?.id === "enc_trade_convoy_paper"); if (!paper) { conflicts.push("enc_trade_convoy_paper not found"); return { changes, report, conflicts }; }
    const before = (paper.choices || []).length;
    paper.choices = (paper.choices || []).filter(c => !/^enc_trade_convoy_paper_(friend|warning)$/.test(String(c?.next || "")));
    if (paper.choices.length !== before) { changes++; report.push("✂ enc_trade_convoy_paper: the two buy choices"); }
    if (!paper.choices.some(c => c?.next === "enc_trade_convoy_paper_browse")) {
      paper.choices.unshift({ label: "Look over her papers.", next: "enc_trade_convoy_paper_browse", description: "", checkStat: "", checkDC: 0, failNext: "" }); changes++; report.push("✚ enc_trade_convoy_paper: Look over her papers.");
    }
    if (!beats.some(b => b?.id === "enc_trade_convoy_paper_browse")) {
      const gate = (Array.isArray(paper.inject?.requires) ? paper.inject.requires : []).filter(r => r && r.flag === "storyPhase");
      beats.splice(beats.indexOf(paper) + 1, 0, {
        id: "enc_trade_convoy_paper_browse", label: "Trade Convoy — Her Papers", type: ["dialog", "narration"].includes(paper.type) ? paper.type : "dialog",
        tags: paper.tags || "", politicalTags: "", speakerActorId: paper.speakerActorId || null, sceneId: paper.sceneId || null,
        outcomes: { success: null, failure: null }, actors: [], encounter: { key: "", tier: null, actorName: "" }, refs: {},
        playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
        description: "She fans the papers out on the counter — both folds, five marks a sheet. \"Everybody pays their own way,\" she says, \"and everybody keeps their own paper.\" Whoever's purse it is, it's theirs to play: leading the table or riding along.",
        worldEffects: { openMarket: { vendorId, vendorName: VENDOR_NAME, note: "Stormborn papers — five marks a sheet" } },
        choices: [{ label: "Back on the road", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
        dialogueOffer: false, timeScale: "moment", timePoints: 0,
        inject: { repeatable: true, oncePerHex: false, evergreen: true, requires: gate }
      }); changes++; report.push("✚ enc_trade_convoy_paper_browse (opens the Trade Caravan)");
    }
    return { changes, report, conflicts };
  }
  return { applyCatalog, applyCamp, VENDOR_NAME };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = STORMBORN_PAPERS;
} else (async () => {
  const DRY_RUN = (globalThis.__papersDry ?? true);
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const vendor = (game.bbttcc?.api?.market?.listVendors?.() || []).find(v => v.name === STORMBORN_PAPERS.VENDOR_NAME);
  if (!vendor) return ui.notifications.error("Trade Caravan vendor not found.");
  const catRaw = game.settings.get("bbttcc-market", "catalog"); const catWasStr = typeof catRaw === "string";
  const catalog = JSON.parse(catWasStr ? catRaw : JSON.stringify(catRaw || []));
  const campsRaw = game.settings.get("bbttcc-campaign", "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const c1 = STORMBORN_PAPERS.applyCatalog(Array.isArray(catalog) ? catalog : [], vendor.id);
  const c2 = STORMBORN_PAPERS.applyCamp(camp, vendor.id);
  const changes = c1.changes + c2.changes, report = [...c1.report, ...c2.report], conflicts = c2.conflicts;
  console.log(`[stormborn papers market 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__papers = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-papers-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
    await FP.upload("data", "bbttcc-exports", new File([catWasStr ? catRaw : JSON.stringify(catRaw)], `backup-catalog-pre-papers-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  if (c1.changes) await game.settings.set("bbttcc-market", "catalog", catWasStr ? JSON.stringify(catalog) : catalog);
  if (c2.changes) await game.settings.set("bbttcc-campaign", "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied — the Stormborn papers are in the Trade Caravan's market (${changes}).`);
})();

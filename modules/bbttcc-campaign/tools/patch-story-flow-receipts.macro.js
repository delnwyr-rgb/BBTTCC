/**
 * patch-story-flow-receipts.macro.js — GM macro/console. DRY_RUN default true.
 *
 * STORY FLOW ENCODE · PHASE D-4 content (2026-09-17). Now that a beat can GRANT a Receipt
 * (world-mutation-engine: worldEffects.receipts → api.raid.courtlySecrets.addSecret), the rulings
 * that pay Receipts get their rows:
 *
 *  · The Long Table's name-cards → three "A Name From the Table" Receipts (Chuckle Creek / Soft Landing /
 *    Stillwater) — produced at the town's choice they count as consent for the true ending.
 *  · The grief-quartet capstone → "Misapplied Love" (court-usable anywhere).
 *  · The Confessor's Debt endings → Reached: "The Confessor's Channel" + "The Sink's True Ledger";
 *    Measured (Pike): "The Confessor's Channel (Measured)"; Counterfeit Ledger: the channel, STOLEN
 *    (costs Suspicion when played); Daylight: nothing — the channel burned.
 *  · The Tree's Session, "What will you do for me?" answered → "Which Way the Figure Faces"
 *    (the Forest's persona arms the same Receipt for those who chat for it; a faction never holds two).
 *
 * Idempotent; backup download before write; GM only.
 */
(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = []; let changes = 0; const say = (s) => report.push(s);
  const setReceipts = (id, rows) => {
    const b = byId.get(id); if (!b) return say(`✗ MISSING beat ${id}`);
    b.worldEffects = (b.worldEffects && typeof b.worldEffects === "object") ? b.worldEffects : {};
    if (JSON.stringify(b.worldEffects.receipts) === JSON.stringify(rows)) return say(`· ok ${id} (${rows.length} receipt(s))`);
    b.worldEffects.receipts = rows; changes++; say(`🧾 ${id}: ${rows.map(r => r.label).join(" · ")}`);
  };
  const tamsin = (game.actors?.contents || []).find(a => /father tamsin/i.test(a.name))?.id || "";
  const forest = (game.actors?.contents || []).find(a => a.name === "The Forest of Early Tifaret")?.id || "";
  const pike = (game.actors?.contents || []).find(a => /yarrow pike/i.test(a.name))?.id || "";

  setReceipts("wendigo_confluence_name_cards", [
    { label: "A Name From the Table — Chuckle Creek", effectKey: "favorPlus2", acquisition: "earned", source: { name: "the Long Table" }, truth: "A place set for a tired boy who gets flattened by a piano and springs up laughing, and the names that hang, hand-lettered, between the scenes at Chuckle Creek. Produce it there and the town hears its dead named by someone who came back for them." },
    { label: "A Name From the Table — Soft Landing", effectKey: "favorPlus2", acquisition: "earned", source: { name: "the Long Table" }, truth: "The names Soft Landing padded every surface of its life against, written in someone else's hand. Produce it there and the landing has a witness." },
    { label: "A Name From the Table — Stillwater", effectKey: "favorPlus2", acquisition: "earned", source: { name: "the Long Table" }, truth: "A place set for a son who was on the 4:10. Produce it on the platform and the held hour has permission to end." }
  ]);
  setReceipts("grief_quartet_capstone", [
    { label: "Misapplied Love", effectKey: "rollPlus3", acquisition: "earned", source: { name: "the coalition, out loud" }, truth: "Four communities, four ways to not grieve, one ache: forget it, don't let it count, freeze before it, pad against it. Every one of them was somebody's mercy. Every one of them was a cage. Managed grief is the coalition becoming the region's Wendigo, and knowing it is the only thing that keeps it from being true. Nobody who hears it can un-hear it." }
  ]);
  setReceipts("ag_confessor_redeemed", [
    { label: "The Confessor's Channel", effectKey: "doubleAgent", acquisition: "earned", source: { name: "Father Tamsin", npcActorId: tamsin }, truth: "The candles, the pilgrims, every gentle question he ever passed along — confessed, and the channel now runs backward. The cult still thinks it has a confessor." },
    { label: "The Sink's True Ledger", effectKey: "stirThePot", acquisition: "earned", source: { name: "Father Tamsin", npcActorId: tamsin }, truth: "What the Valhaulans are rebinding under the mountain, in the confessor's own words: the sink was built to hold Spark bleed, and they are re-addressing whose debt it holds." }
  ]);
  setReceipts("ag_confessor_pike", [
    { label: "The Confessor's Channel (Measured)", effectKey: "doubleAgent", acquisition: "earned", source: { name: "Marshal Yarrow Pike", npcActorId: pike }, truth: "Every pilgrim, candle and scrap of waxed fiber now passes through the Marshal's ledger before it passes anywhere else. The channel grew a supervisor." }
  ]);
  setReceipts("ag_confessor_counterfeit", [
    { label: "The Confessor's Channel (Counterfeit)", effectKey: "doubleAgent", acquisition: "stolen", source: { name: "Father Tamsin, deceived", npcActorId: tamsin }, truth: "Troop counts wrong by half, timetables that slip, a party always somewhere it isn't — fed to the mountain through a good man who kneels every night in a church with moved candles. Playing this costs Suspicion. It should." }
  ]);
  setReceipts("forest_of_tifaret_session_do_ok", [
    { label: "Which Way the Figure Faces", effectKey: "rollPlus2", acquisition: "earned", source: { name: "The Forest of Early Tifaret", npcActorId: forest }, truth: "The stone figure mid-stride in the ring is facing the others — the direction the standing stones went quiet. A heading nobody else has." }
  ]);

  console.log(`[patch-story-flow-receipts] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Receipts patch DRY RUN: ${changes} change(s) (console). Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-receipts-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Receipts patch APPLIED: ${changes} change(s). Backup downloaded.`);
})();

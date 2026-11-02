/**
 * repair-story-receipts-2026-11-02.macro.js — click-through (2026-11-02): the five-per-Domain Receipt cap (bbttcc-raid courtly-secrets
 * enforceCap) dropped the OLDEST Receipt silently every time a new one landed — the story's own went first (the Rental Slip, the
 * Gate Sequence, the Caravan Ledger, the Dropped Manifest, the Back-Room Roster …). Fixed in code: story receipts carry
 * secret.story and the cap never trims them. This repairs a world that already lost some:
 *   1. every Receipt a Domain holds whose label matches a story beat's worldEffects.receipts gets secret.story = true;
 *   2. every PLAYED beat whose receipts no Domain holds re-grants them (receipts only — nothing else in the beat re-applies),
 *      to the campaign's lead Domain unless the receipt names a factionId.
 * Idempotent (rerun = 0). DRY_RUN first. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const capi = game.bbttcc?.api?.campaign; const cid = capi?.getActiveCampaignId?.(); const camp = cid ? capi.getCampaign(cid) : null;
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const played = capi.story?.state?.()?.played || {};
  const lead = game.actors.get(String(camp.factionId || (camp.factionIds || [])[0] || "").replace(/^Actor\./, ""));
  const storyLabels = new Set(); const toGrant = [];
  for (const b of (camp.beats || [])) for (const r of (Array.isArray(b?.worldEffects?.receipts) ? b.worldEffects.receipts : [])) if (r?.label) { storyLabels.add(String(r.label)); if (played[b.id]) toGrant.push({ beat: b.id, r }); }
  const domains = game.actors.filter(a => a.type !== "character" && a.items?.some(i => i.flags?.["bbttcc-raid"]?.secret));
  const held = new Map(); for (const a of domains) for (const i of a.items) if (i.flags?.["bbttcc-raid"]?.secret) held.set(String(i.name), { a, i });
  const isHeld = (label) => [...held.keys()].some(n => n === label || n.startsWith(label + " — "));
  const report = []; let changes = 0;
  const stamp = [];
  for (const [name, { a, i }] of held) { const base = [...storyLabels].find(l => name === l || name.startsWith(l + " — ")); if (base && i.flags["bbttcc-raid"].secret.story !== true) { stamp.push({ a, i }); changes++; report.push(`✚ ${a.name}: "${name}" marked a story receipt`); } }
  const grants = toGrant.filter(g => !isHeld(String(g.r.label)));
  for (const g of grants) { changes++; report.push(`✚ re-grant "${g.r.label}" (played ${g.beat})`); }
  console.log(`[repair story receipts 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__storyReceipts = { dry: DRY_RUN, changes, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to repair.");
  for (const { i } of stamp) await i.setFlag("bbttcc-raid", "secret.story", true);
  for (const g of grants) {
    const fid = String(g.r.factionId || lead?.id || "").replace(/^Actor\./, "");
    try { await game.bbttcc.api.worldMutation.applyWorldEffects({ id: `repair_receipts_${g.beat}`, worldEffects: { receipts: [g.r] } }, { campaignId: cid, factionId: fid }); }
    catch (e) { console.warn("[repair story receipts] grant failed", g.r.label, e); }
  }
  ui.notifications.info(`Repaired ${changes} story receipt(s).`);
})();

/*
 * patch-receipts-clearout-2026-11-11.macro.js — Dave (2026-11-11): "That's a LOT of receipts without a home … I think
 * that we should get rid of all of them, and then build specific receipts for them that enrich the story and give
 * players more things to do." Follow-up: "Include the hoard, keep NPC truths."
 *
 *  1. Story grants: every beat / choice worldEffects.receipts moves to worldEffects.receiptsRetired (the engine reads
 *     only `receipts`; nothing is granted). Includes the Halloween hoard set and the Proof of Purchase.
 *  2. NPC secrets: each mal-voice persona.secretsRaw line becomes plain knowledge in persona.notes (a "THINGS YOU KNOW"
 *     block placed before the first @after: gate, so it is always true) — the NPC still knows and can say it, but
 *     handing it over makes no item. secretsRaw moves to persona.secretsRawRetired.
 *  3. Held receipts: every Item with flags.bbttcc-raid.secret on any actor (world actors + unlinked scene tokens) is
 *     archived and deleted.
 *  4. Market: catalog entries of kind "receipt" are archived and removed.
 *  Archive: JournalEntry "Retired Receipts (2026-11-11)" flags.bbttcc-campaign.archive holds items + market rows.
 *  The courtly-secrets compendium stays (templates only; the engine no longer blind-draws from it).
 *
 * Ember Bad Eden. globalThis.__rcptDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__rcptDry !== false;
  const report = { DRY_RUN, beats: [], npcs: [], items: [], market: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);

  // 1 — story grants
  const retire = (we, where) => {
    if (!we || !Array.isArray(we.receipts) || !we.receipts.length) return false;
    we.receiptsRetired = [...(Array.isArray(we.receiptsRetired) ? we.receiptsRetired : []), ...we.receipts];
    report.beats.push(`${where}: ${we.receipts.map(r => r?.label).join(" / ")}`);
    we.receipts = [];
    return true;
  };
  let beatChanges = 0;
  for (const b of beats) {
    if (retire(b.worldEffects, b.id)) beatChanges++;
    for (const ch of (b.choices || [])) if (retire(ch.worldEffects, `${b.id} › ${String(ch.label || "").slice(0, 40)}`)) beatChanges++;
  }

  // 2 — NPC secrets → knowledge
  const parse = (raw) => String(raw || "").split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"))
    .map(l => l.split("::").map(s => s.trim())).filter(p => p.length >= 4)
    .map(p => ({ label: p[0], condition: p[2], truth: p.slice(3).join(" :: ") }));
  const npcUpdates = [];
  for (const a of game.actors.contents) {
    const persona = a.flags?.["bbttcc-mal-voice"]?.persona;
    if (!persona || !String(persona.secretsRaw || "").trim()) continue;
    const rows = parse(persona.secretsRaw);
    const block = rows.length ? [
      "THINGS YOU KNOW (no papers or proof to hand over — just what you know. Share it in your own words when the conversation earns it, never as a recital):",
      ...rows.map(r => `- ${r.label}: ${r.truth} (you'd let this out when ${r.condition})`)
    ].join("\n") : "";
    let notes = String(persona.notes || "");
    if (block && !notes.includes(block)) {
      const lines = notes.split(/\r?\n/);
      const gi = lines.findIndex(ln => /^\s*@after:/i.test(ln));
      if (gi < 0) notes = (notes.trim() ? notes.trimEnd() + "\n\n" : "") + block;
      else notes = [...lines.slice(0, gi), block, "", ...lines.slice(gi)].join("\n");
    }
    report.npcs.push(`${a.name}: ${rows.length} truth(s) kept as knowledge`);
    npcUpdates.push({ a, data: { "flags.bbttcc-mal-voice.persona.notes": notes,
      "flags.bbttcc-mal-voice.persona.secretsRawRetired": persona.secretsRaw, "flags.bbttcc-mal-voice.persona.secretsRaw": "" } });
  }

  // 3 — held receipts (world actors + unlinked tokens)
  const holders = [...game.actors.contents];
  for (const s of game.scenes.contents) for (const t of s.tokens.contents) if (!t.actorLink && t.actor) holders.push(t.actor);
  const archItems = [];
  const itemDeletes = [];
  for (const a of holders) {
    const hits = a.items.filter(i => i.flags?.["bbttcc-raid"]?.secret);
    if (!hits.length) continue;
    const who = a.isToken ? `${a.name} (token ${a.token?.parent?.name})` : a.name;
    report.items.push(`${who}: ${hits.map(i => i.name).join(" / ")}`);
    for (const i of hits) archItems.push({ holder: who, actorId: a.id, tokenUuid: a.isToken ? a.token?.uuid : null, item: i.toObject() });
    itemDeletes.push({ a, ids: hits.map(i => i.id) });
  }

  // 4 — market
  const cat = game.settings.get("bbttcc-market", "catalog") || [];
  const mRcpt = cat.filter(e => e?.kind === "receipt");
  report.market = mRcpt.map(e => `${e.name} (${e.vendorId || "?"})`);

  report.counts = { beatsAndChoices: beatChanges, npcs: npcUpdates.length, receiptItems: archItems.length, market: mRcpt.length };
  if (!DRY_RUN) {
    const ARCH = "Retired Receipts (2026-11-11)";
    let j = game.journal.getName(ARCH);
    if (!j) j = await JournalEntry.create({ name: ARCH, ownership: { default: 0 } });
    const prev = j.getFlag("bbttcc-campaign", "archive") || { items: [], market: [] };
    await j.setFlag("bbttcc-campaign", "archive", { items: [...prev.items, ...archItems], market: [...prev.market, ...mRcpt] });
    if (beatChanges) await C.saveCampaign(cid, { ...c, beats });
    for (const u of npcUpdates) await u.a.update(u.data);
    for (const d of itemDeletes) await d.a.deleteEmbeddedDocuments("Item", d.ids);
    if (mRcpt.length) await game.settings.set("bbttcc-market", "catalog", cat.filter(e => e?.kind !== "receipt"));
  }
  console.log("RCPTCLEAR " + JSON.stringify(report.counts));
  globalThis.__rcptReport = report;
  return report;
})();

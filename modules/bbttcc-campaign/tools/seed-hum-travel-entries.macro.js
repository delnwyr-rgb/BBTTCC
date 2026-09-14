// Bad Eden — The Sarmoung Hum rungs ride the roads (2026-09-14) — DRY_RUN
// ─────────────────────────────────────────────────────────────────────────────
// "Travel tables per act" (owner, 2026-09-14): one table per terrain, and each ENTRY says which acts it
// may appear in (conditions.phaseGte / phaseLte — evaluated by runRandomTable since today) and whether
// it is drawn once (`once`, spent when the story store holds the beat as played). The five later rungs
// of the Sarmoung Hum ladder become rare road sightings in their act, on the terrains where they belong:
//   act 1  The Meeting Under the Big Canvas   plains · river
//   act 2  Travelers Who Won't Eat            every road
//   act 3  She Already Knew How               plains · river · forest
//   act 4  The Post with the Tally on It      plains · canyons · ashwastes · mountains
//   act 5  The House the Kudzu Wrote On       forest · swamp · river
// (The Tent at the Edge of Town is on rails out of Allesh-Gilliam — patch-hum-tent-rails.)
// Idempotent (one entry per beat per table); backs up `encounterTables`.

(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications?.error("GM only");
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  if (!cid) return ui.notifications?.error("No active campaign");
  let tables = game.settings.get(NS, "encounterTables");
  if (typeof tables === "string") { try { tables = JSON.parse(tables); } catch (_e) {} }
  tables = foundry.utils.deepClone(tables || {});
  const isMap = !Array.isArray(tables);
  const list = isMap ? Object.values(tables) : tables;
  const byId = new Map(list.map(t => [String(t.id || t._key || ""), t]));

  const RUNGS = [
    { beat: "hum_loud_revival",     act: 1, weight: 1, terrains: ["plains", "river"] },
    { beat: "hum_quiet_decline",    act: 2, weight: 1, terrains: ["plains", "forest", "mountains", "canyons", "river", "swamp", "ashwastes"] },
    { beat: "hum_loud_echo",        act: 3, weight: 1, terrains: ["plains", "river", "forest"] },
    { beat: "hum_quiet_ledger",     act: 4, weight: 1, terrains: ["plains", "canyons", "ashwastes", "mountains"] },
    { beat: "hum_loud_handwriting", act: 5, weight: 1, terrains: ["forest", "swamp", "river"] },
  ];
  const report = []; let added = 0;
  for (const r of RUNGS) for (const terr of r.terrains) {
    const tid = `travel_${terr}_t1`; const t = byId.get(tid);
    if (!t) { report.push(`⚠ table ${tid} not found`); continue; }
    t.entries = Array.isArray(t.entries) ? t.entries : [];
    const cur = t.entries.find(e => String(e?.beatId) === r.beat);
    const want = { campaignId: cid, beatId: r.beat, weight: r.weight, once: true, conditions: { terrain: terr, tier: "1", phaseGte: r.act } };
    if (cur) {
      if (JSON.stringify(cur) === JSON.stringify(want)) { report.push(`· ok (already) ${tid} ← ${r.beat}`); continue; }
      Object.assign(cur, want); added++; report.push(`~ ${tid} ← ${r.beat} (act ${r.act}, once)`);
    } else { t.entries.push(want); added++; report.push(`✚ ${tid} ← ${r.beat} (act ${r.act}, once, w${r.weight})`); }
  }
  if (!DRY_RUN && added) {
    const raw = game.settings.get(NS, "encounterTables");
    (foundry.utils.saveDataToFile || saveDataToFile)(typeof raw === "string" ? raw : JSON.stringify(raw), "application/json", `backup-encounterTables-before-hum-entries-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await game.settings.set(NS, "encounterTables", tables);
  }
  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply." : "APPLIED.";
  console.log(`[seed-hum-travel-entries] ${banner}\n` + report.map(x => "  • " + x).join("\n"));
  await ChatMessage.create({ content: `<div style="font-size:12px"><b>seed-hum-travel-entries — ${banner}</b> (${added} entries)<br>${report.map(x => "&nbsp;" + x.replace(/</g, "&lt;")).join("<br>")}</div>`, whisper: game.users.filter(u => u.isGM).map(u => u.id) });
  ui.notifications?.info(`Hum on the roads: ${banner}`);
})();

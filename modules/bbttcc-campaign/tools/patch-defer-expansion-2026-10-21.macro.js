/* patch-defer-expansion-2026-10-21.macro.js — DEFER the strands Dave moved to the expansion pile (2026-10-21, "Coco Chanel" cut):
 *    whole quests: A Gift (Not a Trojan) · the Hex Flooded Towns (Hod) · the Balcones · the Sarmoung Hum (Tier 2 + the Tier-1
 *                  wandering beats; the Act-One tent `hum_quiet_tent` + `hum_quiet_tent_ask` STAY as the glimpse)
 *    chapters:     Lyrenn · The Gentle Pest · Lyrenn · The Forest Will Not Be Fought · Khezek-Tor · The Shipment of UTTER DARKNESS
 *                  (+ their three exterior door cards)
 *
 *  NOTHING IS DELETED. "Deferred" = parked behind an Act-9 gate (the acts run 0–6, so it never opens):
 *   · every deferred beat gets { flag:"storyPhase", gte:9 } appended to inject.requires — the director, hex arrivals, the NOW rail and
 *     the seals all honour it (no warnings: storyPhase is a known gate source). The original requires is kept on beat._deferred.
 *   · every choice in a KEPT beat that leads into deferred content gets requires { flag:"storyPhase", gte:9 } (hidden); original on
 *     choice._deferred.
 *   · the three chapter steps leave the Lyrenn / Khezek-Tor quest ladders (campaign.story.scripts) and are parked on the script as
 *     _deferredSteps [{index, step}], so the ladders never wait on them.
 *   · the three whole quests' definitions go to act 9 (original on the def as _deferredAct; fallback 3).
 *   · travel-table rows for deferred beats go to weight 0 (original on the row as _deferredWeight).
 *
 *  MODE = "defer" (default) or "restore" (puts every original back exactly). Idempotent both ways; DRY_RUN default true; backs up
 *  `campaigns` + `encounterTables`. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const MODE = "defer";                 // "defer" | "restore"
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const GATE = { flag: "storyPhase", gte: 9 };
  const isGate = (c) => c && typeof c === "object" && c.flag === "storyPhase" && Number(c.gte) === 9;
  const DEFER_QUESTS = ["trojan_gift", "flooded_towns", "balcones", "sarmoung_hum"];
  const ACT9_QUESTS = ["trojan_gift", "flooded_towns", "balcones"];          // the Hum keeps its act — its Act-One tent still plays
  const DEFER_CHAPTERS = [["lyrenn", "the_gentle_pest"], ["lyrenn", "the_forest_will_not_be_fought"], ["khezek_tor", "the_shipment_of_utter_darkness_sometimes"]];
  const KEEP = new Set(["hum_quiet_tent", "hum_quiet_tent_ask"]);
  const EXTRA = ["lyrenn_gentle_pest_exterior", "lyrenn_forest_exterior", "khezek_tor_yard_exterior"];
  const STEPS = { lyrenn: ["pest", "forest"], khezek_tor: ["shipment"] };

  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const tabRaw = game.settings.get(NS, "encounterTables");
  const tabWasStr = typeof tabRaw === "string";
  const tables = tabWasStr ? JSON.parse(tabRaw) : foundry.utils.deepClone(tabRaw || {});
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const report = []; let changes = 0, tableChanges = 0;

  // the deferred set: declared members of the deferred quests/chapters, minus the kept tent, plus the door cards
  const D = new Set();
  for (const b of camp.beats) {
    const q = b?.story?.quest, ch = b?.story?.chapter;
    if (KEEP.has(b.id)) continue;
    if (DEFER_QUESTS.includes(q) || DEFER_CHAPTERS.some(([a, c]) => a === q && c === ch)) D.add(b.id);
  }
  for (const id of EXTRA) if (camp.beats.some(b => b.id === id)) D.add(id);
  report.push(`deferred set: ${D.size} beats`);

  if (MODE === "defer") {
    for (const b of camp.beats) {
      if (D.has(b.id)) {
        if (b._deferred) continue;
        const hadInject = b.inject != null; b.inject = b.inject || {};
        const orig = b.inject.requires ?? null;
        b._deferred = { requires: orig == null ? null : foundry.utils.deepClone(orig), hadInject, at: "2026-10-21" };
        const arr = orig == null ? [] : (Array.isArray(orig) ? foundry.utils.deepClone(orig) : [foundry.utils.deepClone(orig)]);
        arr.push({ ...GATE }); b.inject.requires = arr; changes++;
        continue;
      }
      for (const c of (b.choices || [])) {
        if (!c || c._deferred) continue;
        if (!(D.has(String(c.next || "")) || D.has(String(c.failNext || "")))) continue;
        c._deferred = { requires: c.requires == null ? null : foundry.utils.deepClone(c.requires), at: "2026-10-21" };
        c.requires = { ...GATE }; changes++; report.push(`✚ ${b.id}: hid "${c.label}" → ${c.next}`);
      }
    }
    report.push(`✚ ${[...D].filter(id => camp.beats.find(b => b.id === id)?._deferred).length} beats parked behind the Act-9 gate`);
    const scripts = camp.story?.scripts || {};
    for (const [qk, ids] of Object.entries(STEPS)) {
      const sc = scripts[qk]; if (!sc) { report.push(`⚠ script ${qk}: not found`); continue; }
      sc._deferredSteps = sc._deferredSteps || [];
      const found = ids.map(sid => ({ sid, i: (sc.steps || []).findIndex(s => s.id === sid) }));
      for (const f of found) if (f.i < 0) report.push(`· ok ${qk}: step ${f.sid} already parked`);
      for (const f of found.filter(f => f.i >= 0).sort((a, b) => b.i - a.i)) {   // original indices, removed from the highest down
        const [step] = sc.steps.splice(f.i, 1); sc._deferredSteps.push({ index: f.i, step }); changes++; report.push(`✚ ${qk}: step "${step.label}" parked`);
      }
    }
    for (const qk of ACT9_QUESTS) {
      const q = camp.story?.quests?.[qk]; if (!q) { report.push(`⚠ quest ${qk}: not found`); continue; }
      if (Number(q.act) === 9) { report.push(`· ok ${qk}: act 9`); continue; }
      q._deferredAct = q.act; q.act = 9; changes++; report.push(`✚ ${qk}: act ${q._deferredAct} → 9`);
    }
    for (const t of Object.values(tables)) for (const e of (t?.entries || [])) {
      if (!e || !D.has(String(e.beatId || "")) || e._deferredWeight != null) continue;
      e._deferredWeight = e.weight; e.weight = 0; tableChanges++;
    }
    report.push(`✚ ${tableChanges} travel-table rows set to weight 0`);
  } else {
    for (const b of camp.beats) {
      if (b._deferred) { const o = b._deferred.requires; if (o == null) { if (b.inject) delete b.inject.requires; } else b.inject.requires = o;
        if (b._deferred.hadInject === false && b.inject && !Object.keys(b.inject).length) delete b.inject; delete b._deferred; changes++; }
      else if (Array.isArray(b.inject?.requires) && b.inject.requires.some(isGate)) { b.inject.requires = b.inject.requires.filter(c => !isGate(c)); changes++; }
      for (const c of (b.choices || [])) if (c?._deferred) { const o = c._deferred.requires; if (o == null) delete c.requires; else c.requires = o; delete c._deferred; changes++; }
    }
    const scripts = camp.story?.scripts || {};
    for (const qk of Object.keys(STEPS)) {
      const sc = scripts[qk]; if (!sc?._deferredSteps?.length) continue;
      for (const { index, step } of sc._deferredSteps.slice().sort((a, b) => a.index - b.index)) { if (!(sc.steps || []).some(s => s.id === step.id)) { sc.steps.splice(Math.min(index, sc.steps.length), 0, step); changes++; report.push(`✚ ${qk}: step "${step.label}" restored`); } }
      delete sc._deferredSteps;
    }
    for (const qk of ACT9_QUESTS) { const q = camp.story?.quests?.[qk]; if (q && Number(q.act) === 9) { q.act = q._deferredAct ?? 3; delete q._deferredAct; changes++; report.push(`✚ ${qk}: act → ${q.act}`); } }
    for (const t of Object.values(tables)) for (const e of (t?.entries || [])) if (e && e._deferredWeight != null) { e.weight = e._deferredWeight; delete e._deferredWeight; tableChanges++; }
    report.push(`✚ restored ${tableChanges} travel-table weights`);
  }

  console.log(`[defer expansion 2026-10-21 · ${MODE}] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} campaign change(s), ${tableChanges} table row(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN (${MODE}) — ${changes} change(s) + ${tableChanges} table rows; see console.`);
  if (!changes && !tableChanges) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify({ campaigns: campsWasStr ? JSON.parse(campsRaw) : campsRaw, encounterTables: tabWasStr ? JSON.parse(tabRaw) : tabRaw }, null, 2), "application/json", `backup-pre-defer-${MODE}-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  if (changes) await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (tableChanges) await game.settings.set(NS, "encounterTables", tabWasStr ? JSON.stringify(tables) : tables);
  try { await game.bbttcc?.api?.campaign?.story?.data?.reapply?.(); } catch (_e) {}
  ui.notifications.info(`${MODE === "defer" ? "Deferred" : "Restored"} — ${changes} change(s), ${tableChanges} table row(s).`);
})();

/**
 * patch-ag-leygate-scene-2026-10-30.macro.js — Dave, 10-30: "have the Allesh Gilliam Leygate scene link to
 * Scene.dR3w3H2YOWQuCwrH, rather than the Battlemap." The Leygate story beats move off the battlemap onto the scene
 * the Leygate exterior already uses:
 *   ag_leygate_visit · ag_leygate_delivery · ag_leygate_installed   sceneId → dR3w3H2YOWQuCwrH
 * And (Dave, same night: "didn't get the option to talk to Garren and get the part"): the visit IS Garren handing over the
 * Tetrarch Spanner, but its only button was Leave. It now leads with "Take the spanner — ride for Fixit" → ag_ride_fixit
 * (the Saddle-up road beat), Leave kept.
 * QUEST ITEM (Dave 10-30, engine choice.questItems / withItem / requires questItem): the Tetrarch Spanner is a real item now —
 *   ag_leygate_visit: both choices grant it to the roster pick (idempotent: one spanner)
 *   every choice → ag_ride_fixit: withItem → "Ride for Furrier's Fixit Farm — with the Tetrarch Spanner"
 *   fixit_leyline_stabilizer: "Hand over the Tetrarch Spanner" needs it held; "We didn't bring one" only when it isn't
 *   ag_leygate_delivery: both choices hand it back to Garren (removed)
 *   BACKFILL: a table that already met Garren (ag_leygate_visit played) and holds no spanner gets one, on the lead's played Steward.
 * Prints both scene names in the dry run. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const TO = "dR3w3H2YOWQuCwrH";
  const IDS = ["ag_leygate_visit", "ag_leygate_delivery", "ag_leygate_installed"];
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  if (!game.scenes.get(TO)) return ui.notifications.error(`Scene ${TO} not found in this world.`);
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const report = []; const conflicts = []; let changes = 0;
  const nm = (id) => game.scenes.get(id)?.name || `(missing ${id})`;
  for (const id of IDS) {
    const b = beats.find(x => x && String(x.id) === id);
    if (!b) { conflicts.push(`${id}: beat not found`); continue; }
    const cur = String(b.sceneId || "").replace(/^Scene\./, "");
    if (cur !== TO) { b.sceneId = TO; changes++; report.push(`✎ ${id}: scene "${nm(cur)}" → "${nm(TO)}"`); }
  }
  const visit = beats.find(x => x && String(x.id) === "ag_leygate_visit");
  if (!beats.some(x => x && String(x.id) === "ag_ride_fixit")) conflicts.push("ag_ride_fixit: beat not found");
  else if (visit) {
    visit.choices = Array.isArray(visit.choices) ? visit.choices : [];
    if (!visit.choices.some(c => String(c?.next) === "ag_ride_fixit")) {
      visit.choices.unshift({ label: "Take the spanner — ride for Fixit", next: "ag_ride_fixit", description: "Garren's spanner in the oilcloth. Whatever they sell you at Fixit, it has to fit this.", checkStat: "", checkDC: 0, failNext: "" });
      changes++; report.push("✚ ag_leygate_visit: \"Take the spanner — ride for Fixit\" → ag_ride_fixit");
    }
  }
  const KEY = "tetrarch_spanner";
  const GRANT = { key: KEY, name: "Tetrarch Spanner", img: "icons/tools/hand/spanner-steel-grey.webp",
    description: "The Leygate's own spanner, brass gone green at the jaws. Garren's words: whatever they sell you at Fixit, it fits THIS, or it's a very expensive doorstop." };
  const J = (x) => JSON.stringify(x);
  const Bx = (id) => beats.find(x => x && String(x.id) === id);
  if (visit) for (const c of visit.choices || []) {
    if (!(c.questItems || []).some(q => q?.key === KEY)) { c.questItems = [...(c.questItems || []), GRANT]; changes++; report.push(`✚ ag_leygate_visit "${c.label}": grants the Tetrarch Spanner`); }
  }
  for (const b of beats) for (const c of (b?.choices || [])) {
    if (String(c?.next) === "ag_ride_fixit" && c.withItem !== KEY) { c.withItem = KEY; changes++; report.push(`✚ ${b.id} "${c.label}": withItem spanner`); }
  }
  const stab = Bx("fixit_leyline_stabilizer");
  if (!stab) conflicts.push("fixit_leyline_stabilizer: beat not found");
  else {
    const hand = (stab.choices || []).find(c => /Tetrarch Spanner/i.test(c.label || ""));
    const none = (stab.choices || []).find(c => String(c.next) === "fixit_no_spanner");
    if (!hand || !none) conflicts.push("fixit_leyline_stabilizer: hand-over / no-spanner choice not found");
    else {
      if (J(hand.requires || null) !== J([{ questItem: KEY }])) { hand.requires = [{ questItem: KEY }]; changes++; report.push("✚ fixit_leyline_stabilizer hand-over: needs the spanner"); }
      if (J(none.requires || null) !== J([{ questItem: KEY, not: true }])) { none.requires = [{ questItem: KEY, not: true }]; changes++; report.push("✚ fixit_leyline_stabilizer \"We didn't bring one\": only without it"); }
    }
  }
  const del = Bx("ag_leygate_delivery");
  if (!del) conflicts.push("ag_leygate_delivery: beat not found");
  else for (const c of del.choices || []) {
    if (!(c.questItems || []).some(q => q?.key === KEY && q.remove === true)) { c.questItems = [...(c.questItems || []), { key: KEY, remove: true }]; changes++; report.push(`✚ ag_leygate_delivery "${c.label}": hands the spanner back`); }
  }
  // BACKFILL (world items, not campaign data — written only on APPLY, after the campaign save)
  let backfill = null;
  try {
    const playedVisit = !!game.bbttcc?.api?.campaign?.story?.state?.(camp.id)?.played?.ag_leygate_visit;
    const held = (game.actors?.contents || []).some(a => a.items.some(i => i.flags?.["bbttcc-campaign"]?.questItem?.key === KEY));
    const delivered = !!game.bbttcc?.api?.campaign?.story?.state?.(camp.id)?.played?.ag_leygate_delivery;
    if (playedVisit && !held && !delivered) {
      const lead = String(camp.factionId || (camp.factionIds || [])[0] || "").replace(/^Actor\./, "");
      const st = game.bbttcc?.api?.radiation?.partyStewardsOf?.(lead) || [];
      backfill = st.find(a => a.hasPlayerOwner) || st[0] || null;
      if (backfill) { changes++; report.push(`✚ BACKFILL: ${backfill.name} receives the Tetrarch Spanner (Garren already handed it over)`); }
      else conflicts.push("backfill: no Steward found to hold the spanner");
    }
  } catch (eBF) { conflicts.push("backfill check failed: " + eBF.message); }
  console.log(`[ag leygate scene 2026-10-30] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__agLeygateScene = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-ag-leygate-scene-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (backfill) {
    await backfill.createEmbeddedDocuments("Item", [{ name: GRANT.name, type: "gear", img: GRANT.img,
      system: { description: { value: `<p>${GRANT.description}</p>`, chat: "" }, category: "gear", quantity: 1 },
      flags: { "bbttcc-campaign": { questItem: { key: KEY, beatId: "ag_leygate_visit", at: Date.now(), backfill: true } } } }]);
    await ChatMessage.create({ speaker: { alias: "Bad Eden" }, content: `<div style="border-left:3px solid #d4a72c;padding:.35em .6em;background:rgba(212,167,44,.08);">🎒 <b>Item received</b> — Tetrarch Spanner <span style="opacity:.75">(${backfill.name} carries it · Inventory → Quest Items)</span></div>` });
  }
  ui.notifications.info(`Applied ${changes} change(s) — the Leygate beats play on ${nm(TO)}; the Tetrarch Spanner is a quest item.`);
})();

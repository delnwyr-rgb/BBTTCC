/* patch-menace-predators-2026-10-21.macro.js — MENACES (owner ruling 2026-10-21): the predator beats already say "these are
 * the kinds of problems you have on your land" — now the engine remembers.
 *
 *  1. Every travel-table entry that points at a predator / wildlife / horror beat gets `conditions.scale: "foot"` — a party
 *     in a medium or heavy rig never draws it blind; when it IS a menace the warning card explains the rig waits at the edge.
 *  2. Each predator beat gets `beat.menace = { enabled, label }` — the locals' warning card on the road (Help / Not now).
 *  3. Their winning endings (the parley_success beat and the Win outcome beat) get `worldEffects.hexMenace = { action: "clear" }`
 *     — dealing with it lifts the Menace state from the hex and pays the reward (hex Loyalty +2 by default).
 *  Other beats on the tables that LOOK like predators but are not in the list are reported as candidates, not stamped.
 *  Idempotent; DRY_RUN default true; backs up `campaigns` + `encounterTables`. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  // THE LIST (ids are the live ids; labels are what the card calls the thing)
  const MENACES = {
    enc_apex_predator:      { label: "Apex Predator",      clock: 3 },
    enc_mutant_wildlife_t2: { label: "mutant pack",        clock: 3 },
    enc_mutant_wildlife_t3: { label: "Waste Stalkers",     clock: 3 },
    enc_geometry_serpent:   { label: "Geometry Serpent",   clock: 4 },
    enc_qlipothic_shambler: { label: "Qlipothic Shambler", clock: 3 },
    enc_slippage_wraith:    { label: "Slippage Wraith",    clock: 4 }
  };
  const LOOKS_LIKE = /predator|wildlife|stalker|wolves|wolf|pack\b|serpent|shambler|wraith|beast|hound|raptor/i;

  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const beatsIsArray = Array.isArray(camp.beats);
  const beatList = beatsIsArray ? camp.beats : Object.values(camp.beats || {});
  const byId = new Map(beatList.map(b => [b.id, b]));

  const tablesRaw = game.settings.get(NS, "encounterTables");
  const tablesWasStr = typeof tablesRaw === "string";
  const tables = tablesWasStr ? JSON.parse(tablesRaw) : foundry.utils.deepClone(tablesRaw || {});

  const report = []; let beatChanges = 0, tableChanges = 0;
  const candidates = new Set();

  // 1. table entries → scale foot
  for (const [tid, t] of Object.entries(tables)) {
    if (!t || !Array.isArray(t.entries)) continue;
    if (!/^travel_/.test(tid)) continue;
    for (const e of t.entries) {
      const bid = String(e?.beatId || ""); if (!bid) continue;
      if (MENACES[bid]) {
        e.conditions = (e.conditions && typeof e.conditions === "object") ? e.conditions : {};
        if (e.conditions.scale === "foot") { report.push(`· ok ${tid} → ${bid}: scale foot`); continue; }
        e.conditions.scale = "foot"; tableChanges++; report.push(`✚ ${tid} → ${bid}: scale foot`);
      } else {
        const b = byId.get(bid); const lab = String(b?.label || "");
        if (LOOKS_LIKE.test(bid) || LOOKS_LIKE.test(lab)) candidates.add(`${bid} (${lab || "?"}) on ${tid}`);
      }
    }
  }

  // 2. beat.menace + 3. endings clear
  const stampClear = (id, why) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: ending not found (${why})`); return; }
    b.worldEffects = (b.worldEffects && typeof b.worldEffects === "object" && !Array.isArray(b.worldEffects)) ? b.worldEffects : {};
    if (b.worldEffects.hexMenace) { report.push(`· ok ${id}: hexMenace present (${why})`); return; }
    b.worldEffects.hexMenace = { action: "clear" }; beatChanges++; report.push(`✚ ${id}: hexMenace clear (${why})`);
  };
  for (const [id, spec] of Object.entries(MENACES)) {
    const b = byId.get(id);
    if (!b) { report.push(`⚠ ${id}: beat not found in the live campaign`); continue; }
    const m = (b.menace && typeof b.menace === "object") ? b.menace : null;
    if (m && m.enabled !== false && m.label) report.push(`· ok ${id}: menace "${m.label}"`);
    else { b.menace = Object.assign({}, m || {}, { enabled: true, label: spec.label, clock: spec.clock }); beatChanges++; report.push(`✚ ${id}: menace "${spec.label}" clock ${spec.clock}`); }
    // endings: every choice target; an *_outcome(s) hub's Win target; a parley_success beat
    const nexts = (b.choices || []).map(c => String(c?.next || "")).filter(Boolean);
    for (const n of nexts) {
      const nb = byId.get(n); if (!nb) { report.push(`⚠ ${id}: choice target ${n} not found`); continue; }
      if (/parley_success|_win$|outcomes_win$/.test(n)) stampClear(n, "parley / win ending");
      else if (/_outcomes?$/.test(n)) {
        const win = (nb.choices || []).find(c => /^win$/i.test(String(c?.label || "")));
        if (win?.next) stampClear(String(win.next), `Win of ${n}`); else report.push(`⚠ ${n}: no Win choice with a target`);
      } else if (!n) { /* a choice that ends the card (cut it down) — the fight itself resolves on the map; GM clears by hand or the beat's own ending */ }
    }
    if (!nexts.length) report.push(`⚠ ${id}: no choice targets — nothing to stamp a clear on (GM may clear via the Menace row on any beat, or api.travel.menace.clear)`);
  }

  if (candidates.size) { report.push(""); report.push("Candidates on the tables that LOOK like predators but are not in THE LIST (not stamped):"); for (const c of candidates) report.push(`   ? ${c}`); }

  const summary = `menace patch — ${beatChanges} beat change(s), ${tableChanges} table change(s)${DRY_RUN ? " (DRY RUN — nothing written)" : ""}`;
  console.log("[patch-menace-predators]", summary); console.log(report.join("\n"));
  ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id), speaker: { alias: "Bad Eden" }, content: `<div style="border-left:3px solid #c9a227;padding:.35em .6em;"><b>${summary}</b><pre style="white-space:pre-wrap;font-size:.8em;max-height:420px;overflow:auto;margin:.3em 0 0;">${foundry.utils.escapeHTML(report.join("\n"))}</pre></div>` });
  if (DRY_RUN || (!beatChanges && !tableChanges)) return;

  // backups (download, same convention as the pass-3 macros) + write
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-menace-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  if (tableChanges) { try { saveDataToFile(JSON.stringify(tablesWasStr ? JSON.parse(tablesRaw) : tablesRaw, null, 2), "application/json", `encounterTables-backup-pre-menace-${Date.now()}.json`); } catch (e) { console.warn("tables backup download failed", e); } }
  if (beatChanges) await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (tableChanges) await game.settings.set(NS, "encounterTables", tablesWasStr ? JSON.stringify(tables) : tables);
  ui.notifications.info(summary);
})();

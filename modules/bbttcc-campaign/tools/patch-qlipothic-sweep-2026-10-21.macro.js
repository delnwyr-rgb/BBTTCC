/* patch-qlipothic-sweep-2026-10-21.macro.js — ONE SPELLING: "Qlipothic" (Dave, 2026-10-21) across every player-facing text field.
 *  Fixes the KT mine beat (road R16 had gone the other way), the seven Whorl labels + card + memory, the evt_ placeholder label, and the quest
 *  registry's one hit. Beat ids, encounter keys and tags are machine strings and stay as they are. The NOUN "Qliphoth" (the Tree's shadow) and the
 *  pack-name "Qliphothic Bestiary" in a GM note are left alone — different words.
 *  Idempotent; DRY_RUN default true; backs up `campaigns` (and writes `quests`). GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0; let questsDirty = false;
  const fieldRep = (field) => (id, from, to, note) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; }
    const d = String(b[field] || "");
    if (to && !from.includes(to) && d.includes(to)) { report.push(`· ok ${id}: ${note}`); return; }
    if (d.includes(from)) { b[field] = d.replace(from, to); changes++; report.push(`✚ ${id}: ${note}`); return; }
    if (to === "" || (to && d.includes(to))) { report.push(`· ok ${id}: ${note}`); return; }
    report.push(`⚠ ${id}: baseline ${field} not found for "${note}"`);
  };
  const rep = fieldRep("description"), repMem = fieldRep("memoryText");
  const prefix = (id, from, to, note) => { const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; } const d = String(b.description || "");
    if (d.startsWith(to)) { report.push(`· ok ${id}: ${note}`); return; } if (d.startsWith(from)) { b.description = to + d.slice(from.length); changes++; report.push(`✚ ${id}: ${note}`); return; } report.push(`⚠ ${id}: baseline not found for "${note}"`); };
  const relabel = (id, from, to, note) => { const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; } if (b.label === to) { report.push(`· ok ${id}: ${note}`); return; } if (b.label === from) { b.label = to; changes++; report.push(`✚ ${id}: ${note}`); return; } report.push(`⚠ ${id}: label is not the expected baseline — skipped`); };
  const choice = (id, label, field, from, to, note) => { const b = byId.get(id); const c = b?.choices?.find(x => x.label === label) || b?.choices?.find(x => String(x[field] ?? "") === to); if (!c) { report.push(`⚠ ${id}: choice "${label}" not found`); return; }
    const cur = String(c[field] ?? ""); if (cur === to || (field !== "label" && to && !from.includes(to) && cur.includes(to))) { report.push(`· ok ${id}: ${note}`); return; }
    if (cur === from) { c[field] = to; changes++; report.push(`✚ ${id}: ${note}`); return; } if (from && cur.includes(from)) { c[field] = cur.replace(from, to); changes++; report.push(`✚ ${id}: ${note}`); return; } if (to && cur.includes(to)) { report.push(`· ok ${id}: ${note}`); return; } report.push(`⚠ ${id}: choice "${label}" ${field} is not the expected baseline — skipped`); };
  const dropGate = (id) => { const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; } const rq = b.inject?.requires; if (!Array.isArray(rq)) { report.push(`· ok ${id}: no gate list`); return; }
    const n = rq.length; b.inject.requires = rq.filter(r => !(r && r.flag === "storyPhase" && r.lte === 1)); if (b.inject.requires.length < n) { changes++; report.push(`✚ ${id}: storyPhase ≤ 1 gate dropped (A1/A15)`); } else report.push(`· ok ${id}: no upper gate`); };

  rep("khezek_tor_mine_that_answered_back_open", "an open Qliphothic energy sink", "an open Qlipothic energy sink", "KT mine: Qlipothic (Dave's final ruling)");
  rep("enc_qliphotic_whorl", "That's a Qliphotic Whorl", "That's a Qlipothic Whorl", "Whorl card");
  relabel("enc_qliphotic_whorl", "Qliphotic Whorl", "Qlipothic Whorl", "Whorl label");
  relabel("enc_qliphotic_whorl_go_around", "Qliphotic Whorl (Go Around)", "Qlipothic Whorl (Go Around)", "Whorl label");
  relabel("enc_qliphotic_whorl_diffuse_the_whorl", "Qliphotic Whorl (Diffuse the Whorl)", "Qlipothic Whorl (Diffuse the Whorl)", "Whorl label");
  relabel("enc_qliphotic_whorl_move_through_the_whorl", "Qliphotic Whorl (Move Through the Whorl)", "Qlipothic Whorl (Move Through the Whorl)", "Whorl label");
  relabel("enc_qliphotic_whorl_go_around_fail", "Qliphotic Whorl (Go Around - Fail)", "Qlipothic Whorl (Go Around - Fail)", "Whorl label");
  relabel("enc_qliphotic_whorl_diffuse_the_whorl_fail", "Qliphotic Whorl (Diffuse the Whorl - Fail)", "Qlipothic Whorl (Diffuse the Whorl - Fail)", "Whorl label");
  relabel("enc_qliphotic_whorl_move_through_the_whorl_fail", "Qliphotic Whorl (Move Through the Whorl, Fail)", "Qlipothic Whorl (Move Through the Whorl, Fail)", "Whorl label");
  repMem("enc_qliphotic_whorl_parley_success", "the qliphotic whorl", "the qlipothic whorl", "Whorl memory");
  relabel("evt_qliphothic_pit_demon_hunt", "⧗ PLACEHOLDER — Qliphothic Pit — Demon Hunt", "⧗ PLACEHOLDER — Qlipothic Pit — Demon Hunt", "placeholder label");

  // the quest registry (one hit)
  let quests = null, questsWasStr = false;
  try { const qRaw = game.settings.get(NS, "quests"); if (qRaw) { questsWasStr = typeof qRaw === "string"; quests = questsWasStr ? JSON.parse(qRaw) : foundry.utils.deepClone(qRaw); } } catch (_e) {}
  if (quests && typeof quests === "object") { for (const [k, q] of Object.entries(quests)) { for (const f of Object.keys(q || {})) { if (typeof q[f] === "string" && /Qliphothic|Qliphotic|qliphothic|qliphotic/.test(q[f])) { const nv = q[f].replace(/Qliphothic|Qliphotic/g, "Qlipothic").replace(/qliphothic|qliphotic/g, "qlipothic"); if (nv !== q[f]) { q[f] = nv; questsDirty = true; changes++; report.push(`✚ quests[${k}].${f}: Qlipothic`); } } } } }
  else report.push("· (quests registry not available here — written on the live seat)");

  console.log(`[qlipothic sweep 2026-10-21] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-qlipothic-sweep-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (questsDirty) await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(quests) : quests);
  ui.notifications.info(`Applied ${changes} change(s) — one spelling: Qlipothic.`);
})();

/* quest-log-cleanup.macro.js — ONE pass to put the Quest Log right (2026-09-09)
 *
 * Does, in order, idempotently:
 *  1. UNDO any over-broad repair: drops every ACTIVE track entry that carries the
 *     repair note and is not a `word_*` invitation (the catalog is not a to-do list).
 *  2. REPAIR: every `word_*` invitation quest in the registry missing from a
 *     campaign faction's track is added to ACTIVE (invitations only exist in the
 *     registry once the GM accepted them).
 *  3. RETRACT the invitations in RETRACT (track, registry, Director once-gate, cards).
 *  4. RENAME every `word_*` quest with the engine's scheme and scrub doubled speaker
 *     names from stored descriptions / notes; Tamsin's Act-2 invite line rewritten.
 *  5. Clear Director once-gates + unaccepted cards for invitations posted while the
 *     phantom quests looked active.
 * DRY_RUN default true. Paste THIS file fresh (a saved world Macro may be stale).
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const RETRACT = ["word_fixit_leyline_stabilizer_negotiation"];   // <-- accepted Words to take back
  const NS = "bbttcc-campaign", MODF = "bbttcc-factions", NOTE = "repair-quest-track-from-registry";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const nameFor = globalThis.__bbttccInviteQuestName, lineFor = globalThis.__bbttccInviteLine;
  if (typeof nameFor !== "function" || typeof lineFor !== "function") return ui.notifications.error("Hard-reload first — the invitation helpers are not loaded.");
  const api = game.bbttcc?.api?.campaign; const cid = api?.getActiveCampaignId?.();
  const rawC = game.settings.get(NS, "campaigns"); const cStr = typeof rawC === "string"; const camps = cStr ? JSON.parse(rawC) : foundry.utils.deepClone(rawC); const camp = camps?.[cid]; if (!camp) return ui.notifications.error("No active campaign.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {}); const byId = Object.fromEntries(beats.map(b => [b.id, b]));
  const refs = [...(camp.factionIds || []), camp.factionId].filter(Boolean).map(r => String(r).replace(/^Actor\./, "")); const factions = [...new Set(refs)].map(id => game.actors.get(id)).filter(Boolean);
  let reg = game.settings.get(NS, "quests"); const rStr = typeof reg === "string"; if (rStr) { try { reg = JSON.parse(reg); } catch (_e) { reg = {}; } } reg = foundry.utils.deepClone(reg || {});
  let ds = game.settings.get(NS, "directorState"); if (typeof ds === "string") { try { ds = JSON.parse(ds); } catch (_e) { ds = {}; } } ds = foundry.utils.deepClone(ds || {}); ds.invited = ds.invited || {};
  const changes = []; let regDirty = false, dsDirty = false, campDirty = false; const now = Date.now(); let repairTs = Infinity;
  const tracks = factions.map(F => [F, foundry.utils.deepClone(F.getFlag(MODF, "quests") || {})]);
  for (const [, t] of tracks) { t.schemaVersion = t.schemaVersion || 1; t.active = t.active || {}; t.completed = t.completed || {}; t.archived = t.archived || {}; }

  // 1. undo over-broad repairs
  for (const [F, t] of tracks) for (const [qid, e] of Object.entries(t.active)) {
    const hs = (e.history || []).filter(h => h && h.note === NOTE); if (!hs.length || qid.startsWith("word_")) continue;
    repairTs = Math.min(repairTs, ...hs.map(h => Number(h.ts) || Infinity)); delete t.active[qid]; changes.push(`undo ${F.name}: − ${e.questName || qid}`);
  }
  // 2. repair word_ quests
  for (const [qid, q] of Object.entries(reg)) {
    if (!qid.startsWith("word_") || RETRACT.includes(qid)) continue;
    for (const [F, t] of tracks) { if (t.active[qid] || t.completed[qid] || t.archived[qid]) continue;
      t.active[qid] = { v: 1, questId: qid, questName: String(q.name || qid), status: "active", acceptedTs: Number(q.createdTs) || now, lastTouchedTs: now, state: "", notes: "", progress: { beats: {} }, history: [{ ts: now, type: "accept", by: game.user.id, note: NOTE }] };
      changes.push(`repair ${F.name}: + ${q.name}`); }
  }
  // 3. retract
  for (const qid of RETRACT) {
    for (const [F, t] of tracks) for (const b of ["active", "completed", "archived"]) if (t[b][qid]) { delete t[b][qid]; changes.push(`retract ${F.name}: − ${qid} (${b})`); }
    if (reg[qid]) { delete reg[qid]; regDirty = true; changes.push(`retract registry: − ${qid}`); }
    const beatId = qid.replace(/^word_/, ""); if (ds.invited[beatId]) { delete ds.invited[beatId]; dsDirty = true; changes.push(`retract once-gate: − ${beatId}`); }
  }
  const retractCards = game.messages.filter(m => { const inv = m.getFlag(NS, "talkInvite"); return inv && (RETRACT.includes(inv.questId) || (inv.beatIds || []).some(b => RETRACT.includes("word_" + b))); });
  for (const m of retractCards) changes.push(`retract chat: delete card ${m.id}`);
  // 4. rename + scrub; Tamsin's line
  const tam = byId.allesh_gilliam_father_tamsin_conversation, TAM = "has set the kettle aside. There is a story he was a different man in, and he has decided you should hear it before anyone else tells it worse.";
  if (tam && tam.inviteText !== TAM) { tam.inviteText = TAM; campDirty = true; changes.push("Tamsin Act-2 invite line rewritten"); }
  const renamed = {}, plainOf = {}, speakerOf = {};
  for (const [qid, q] of Object.entries(reg)) {
    if (!qid.startsWith("word_")) continue; const beat = byId[qid.slice(5)]; const actor = beat ? game.actors.get(beat.speakerActorId) : null; if (!beat || !actor) continue;
    const nm = nameFor(actor, beat); if (nm !== q.name) { changes.push(`rename ${qid}: "${q.name}" → "${nm}"`); q.name = nm; regDirty = true; }
    renamed[qid] = nm; const line = lineFor(actor, beat.inviteText); plainOf[qid] = line.plain; speakerOf[qid] = actor.name;
    const esc = actor.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); const doubled = new RegExp(`<p><b>${esc}</b> `);
    if (line.html.indexOf("<b>") !== 0 && doubled.test(String(q.description || ""))) { q.description = String(q.description).replace(doubled, "<p>"); regDirty = true; changes.push(`scrub ${qid}: description`); }
  }
  for (const [F, t] of tracks) for (const b of ["active", "completed", "archived"]) for (const [qid, e] of Object.entries(t[b])) {
    if (renamed[qid] && e.questName !== renamed[qid]) { e.questName = renamed[qid]; changes.push(`rename track ${F.name}: ${qid}`); }
    const nm = speakerOf[qid], plain = plainOf[qid]; if (!nm || !plain || plain.indexOf(nm) === 0) continue;
    if (typeof e.notes === "string" && e.notes.startsWith(nm + " ") && e.notes !== plain) { e.notes = plain; changes.push(`scrub track ${F.name}: ${qid} notes`); }
    for (const h of (e.history || [])) for (const k of ["text", "note"]) if (h && typeof h[k] === "string" && h[k].startsWith(nm + " ") && h[k] !== plain && h[k] !== NOTE) { h[k] = plain; }
  }
  // 5. phantom invitations posted after a bad repair
  const phantom = [];
  if (Number.isFinite(repairTs)) for (const [beatId, rec] of Object.entries(ds.invited)) if (Number(rec?.ts) >= repairTs) { phantom.push(beatId); delete ds.invited[beatId]; dsDirty = true; changes.push(`once-gate: − ${beatId} (posted after the bad repair)`); }
  const phantomCards = game.messages.filter(m => { const inv = m.getFlag(NS, "talkInvite"); return inv && !inv.accepted && (inv.beatIds || []).some(b => phantom.includes(b)); });
  for (const m of phantomCards) changes.push(`chat: delete unaccepted phantom card ${m.id}`);
  const acceptedPhantom = game.messages.filter(m => { const inv = m.getFlag(NS, "talkInvite"); return inv && inv.accepted && (inv.beatIds || []).some(b => phantom.includes(b)) && !RETRACT.includes(inv.questId); });
  for (const m of acceptedPhantom) changes.push(`⚠ accepted phantom left in place: ${m.getFlag(NS, "talkInvite").questId} — add it to RETRACT if unwanted`);

  console.group(`[quest-log-cleanup] ${DRY_RUN ? "DRY RUN — " : ""}${changes.length} change(s)`); changes.forEach(c => console.log(" •", c)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`Cleanup DRY RUN: ${changes.length} change(s) in console (F12). Set DRY_RUN=false to apply.`);
  for (const [F, t] of tracks) { await F.unsetFlag(MODF, "quests"); await F.setFlag(MODF, "quests", t); }
  if (regDirty) await game.settings.set(NS, "quests", rStr ? JSON.stringify(reg) : reg);
  if (dsDirty) await game.settings.set(NS, "directorState", ds);
  if (campDirty) await game.settings.set(NS, "campaigns", cStr ? JSON.stringify(camps) : camps);
  const del = [...retractCards, ...phantomCards].map(m => m.id); if (del.length) await ChatMessage.deleteDocuments([...new Set(del)]);
  ui.notifications.info(`Quest Log cleanup applied: ${changes.length} change(s). Now make a save.`);
})();

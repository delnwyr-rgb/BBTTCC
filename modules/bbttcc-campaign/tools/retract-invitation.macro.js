/* retract-invitation.macro.js — take back an accepted "A Word from …" (2026-09-09)
 *
 * For each word_<beatId> in RETRACT: removes it from every campaign faction's
 * track (all buckets), deletes the registry entry, clears the Director's
 * once-gate for the beat (so the invitation can post again when it is truly
 * earned), and deletes its chat cards. Use it for invitations that fired early
 * or wrongly — e.g. Mara Quickhands "Leyline Stabilizer Negotiation" when Mara
 * is already in the know. DRY_RUN default true. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const RETRACT = [                      // <-- edit: word_ quest ids to take back
    "word_fixit_leyline_stabilizer_negotiation"
    // candidates from the same phantom batch (posted only because the bad repair made their quests look active):
    // "word_khezek_tor_mine_that_answered_back", "word_khezek_tor_darkness_shipment", "word_gullywasher_cultural_summit", "word_ag_tamsin_confrontation"
  ];
  const NS = "bbttcc-campaign", MODF = "bbttcc-factions";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign; const cid = api?.getActiveCampaignId?.(); const camp = api?.getCampaign?.(cid); if (!camp) return ui.notifications.error("No active campaign.");
  const refs = [...(camp.factionIds || []), camp.factionId].filter(Boolean).map(r => String(r).replace(/^Actor\./, ""));
  const factions = [...new Set(refs)].map(id => game.actors.get(id)).filter(Boolean);
  const changes = []; const writes = [];
  for (const F of factions) {
    const t = foundry.utils.deepClone(F.getFlag(MODF, "quests") || {}); let dirty = false;
    for (const qid of RETRACT) for (const b of ["active", "completed", "archived"]) if (t[b]?.[qid]) { delete t[b][qid]; dirty = true; changes.push(`${F.name}: − ${qid} (${b})`); }
    if (dirty) writes.push([F, t]);
  }
  let reg = game.settings.get(NS, "quests"); const regStr = typeof reg === "string"; if (regStr) { try { reg = JSON.parse(reg); } catch (_e) { reg = {}; } } reg = foundry.utils.deepClone(reg || {}); let regDirty = false;
  for (const qid of RETRACT) if (reg[qid]) { delete reg[qid]; regDirty = true; changes.push(`registry: − ${qid}`); }
  let ds = game.settings.get(NS, "directorState"); if (typeof ds === "string") { try { ds = JSON.parse(ds); } catch (_e) { ds = {}; } } ds = foundry.utils.deepClone(ds || {}); let dsDirty = false;
  for (const qid of RETRACT) { const beatId = qid.replace(/^word_/, ""); if (ds.invited?.[beatId]) { delete ds.invited[beatId]; dsDirty = true; changes.push(`director.invited: − ${beatId}`); } }
  const cards = game.messages.filter(m => { const inv = m.getFlag(NS, "talkInvite"); return inv && (RETRACT.includes(inv.questId) || (inv.beatIds || []).some(b => RETRACT.includes("word_" + b))); });
  for (const m of cards) changes.push(`chat: delete invitation card ${m.id}`);
  console.group(`[retract-invitation] ${DRY_RUN ? "DRY RUN — " : ""}${changes.length} change(s)`); changes.forEach(c => console.log(" •", c)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`Retract DRY RUN: ${changes.length} change(s) in console (F12). Set DRY_RUN=false to apply.`);
  for (const [F, t] of writes) { await F.unsetFlag(MODF, "quests"); await F.setFlag(MODF, "quests", t); }
  if (regDirty) await game.settings.set(NS, "quests", regStr ? JSON.stringify(reg) : reg);
  if (dsDirty) await game.settings.set(NS, "directorState", ds);
  if (cards.length) await ChatMessage.deleteDocuments(cards.map(m => m.id));
  ui.notifications.info(`Retracted ${RETRACT.length} invitation(s): ${changes.length} change(s).`);
})();

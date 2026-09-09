/* patch-invite-names.macro.js — tell the two "A Word from X" quests apart (2026-09-09)
 *
 * 1. Renames every existing `word_*` quest in the registry AND in each campaign
 *    faction's track using the engine's new _inviteQuestName (beat label minus
 *    town prefix and speaker name; generic labels fall back to "(Act N)"):
 *      A Word from Father Tamsin — Nobody Gets Measured   (Act 1 welcome)
 *      A Word from Father Tamsin (Act 2)                   (Act 2 conversation)
 * 2. Father Tamsin's Act-2 invite line no longer repeats the kettle.
 * DRY_RUN default true; idempotent. Run as GM with "Thatward's Ho!" active, AFTER
 * a hard reload (the rename helper ships in module.js).
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign", MODF = "bbttcc-factions";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const nameFor = globalThis.__bbttccInviteQuestName; if (typeof nameFor !== "function") return ui.notifications.error("Reload first — the rename helper is not loaded.");
  const api = game.bbttcc?.api?.campaign; const cid = api?.getActiveCampaignId?.();
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : foundry.utils.deepClone(raw); const camp = camps?.[cid]; if (!camp) return ui.notifications.error("No active campaign.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {}); const byId = Object.fromEntries(beats.map(b => [b.id, b]));
  const changes = []; let campDirty = false;

  // 2. Tamsin's second word
  const tam = byId.allesh_gilliam_father_tamsin_conversation;
  const TAM = "has set the kettle aside. There is a story he was a different man in, and he has decided you should hear it before anyone else tells it worse.";
  if (tam && tam.inviteText !== TAM) { tam.inviteText = TAM; campDirty = true; changes.push("allesh_gilliam_father_tamsin_conversation: new inviteText"); }

  // 1. rename word_* quests
  let reg = game.settings.get(NS, "quests"); const regStr = typeof reg === "string"; if (regStr) { try { reg = JSON.parse(reg); } catch (_e) { reg = {}; } }
  reg = foundry.utils.deepClone(reg || {}); const renamed = {}; let regDirty = false;
  for (const [qid, q] of Object.entries(reg)) {
    if (!qid.startsWith("word_")) continue;
    const beatId = qid.slice(5); const beat = byId[beatId]; if (!beat) continue;
    const actor = game.actors.get(beat.speakerActorId) || (beat.speakerActorId ? null : null);
    const nm = actor ? nameFor(actor, beat) : null; if (!nm || nm === q.name) continue;
    changes.push(`${qid}: "${q.name}" → "${nm}"`); q.name = nm; renamed[qid] = nm; regDirty = true;
  }
  const refs = [...(camp.factionIds || []), camp.factionId].filter(Boolean).map(r => String(r).replace(/^Actor\./, ""));
  const factions = [...new Set(refs)].map(id => game.actors.get(id)).filter(Boolean); const trackUpdates = [];
  for (const F of factions) {
    const t = foundry.utils.deepClone(F.getFlag(MODF, "quests") || {}); let dirty = false;
    for (const b of ["active", "completed", "archived"]) for (const [qid, e] of Object.entries(t[b] || {})) if (renamed[qid] && e.questName !== renamed[qid]) { e.questName = renamed[qid]; dirty = true; }
    if (dirty) trackUpdates.push([F, t]);
  }
  console.group(`[invite-names] ${DRY_RUN ? "DRY RUN — " : ""}${changes.length} change(s)`); changes.forEach(c => console.log(" •", c)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`Invite names DRY RUN: ${changes.length} change(s) in console (F12). Set DRY_RUN=false to apply.`);
  if (campDirty) await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  if (regDirty) await game.settings.set(NS, "quests", regStr ? JSON.stringify(reg) : reg);
  for (const [F, t] of trackUpdates) { await F.unsetFlag(MODF, "quests"); await F.setFlag(MODF, "quests", t); }
  ui.notifications.info(`Invite names applied: ${changes.length} change(s).`);
})();

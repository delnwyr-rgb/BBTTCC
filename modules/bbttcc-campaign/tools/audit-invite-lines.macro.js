/* audit-invite-lines.macro.js — invitation copy that reads badly (2026-09-09, "all six" #6)
 * Read-only. An invite line renders as "<Speaker> <line>" unless the line already
 * names the speaker. Lines that start with a capitalised word that is NOT the
 * speaker (e.g. "Word up the road…") print as "Elsin Quade Word up the road".
 * Lists every beat with an inviteText + speaker, flags the awkward ones, and
 * shows exactly how the card will read. Run as GM with the campaign active.
 */
(() => {
  const api = game.bbttcc?.api?.campaign; const cid = api?.getActiveCampaignId?.(); const camp = api?.getCampaign?.(cid); if (!camp) return ui.notifications.error("No active campaign.");
  const lineFor = globalThis.__bbttccInviteLine; if (typeof lineFor !== "function") return ui.notifications.error("Hard-reload first — the invitation helper is not loaded.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {}); const rows = [];
  for (const b of beats) {
    const text = String(b.inviteText || "").trim(); if (!text) continue;
    const actor = game.actors.get(b.speakerActorId); if (!actor) { rows.push({ beat: b.id, speaker: "(no speaker)", reads: text, flag: "⚠ no speakerActorId" }); continue; }
    const line = lineFor(actor, text); const namesItself = line.html.indexOf("<b>") !== 0;
    const firstWord = text.split(/\s+/)[0] || ""; const capital = /^[A-Z]/.test(firstWord);
    const flag = (!namesItself && capital) ? "⚠ reads as '" + actor.name + " " + firstWord + "…'" : (namesItself ? "" : "");
    rows.push({ beat: b.id, speaker: actor.name, reads: line.plain, flag });
  }
  rows.sort((a, b) => (b.flag.length - a.flag.length) || a.beat.localeCompare(b.beat));
  const bad = rows.filter(r => r.flag);
  console.group(`[audit-invite-lines] ${rows.length} invite line(s), ${bad.length} awkward`); console.table(rows); console.groupEnd();
  const esc = foundry.utils.escapeHTML;
  ChatMessage.create({ whisper: [game.user.id], content: `<b>Invite lines</b> — ${rows.length} authored, ${bad.length} read awkwardly:<ul style="font-size:11px">${bad.map(r => `<li><code>${esc(r.beat)}</code> — “${esc(r.reads)}” <i>${esc(r.flag)}</i></li>`).join("") || "<li>none</li>"}</ul><p style="font-size:11px">Fix = start the line with a verb (“sends word up the road…”) or with the speaker's name. Full table in the console.</p>` });
})();

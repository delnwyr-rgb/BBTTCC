/* audit-hex-arrivals.macro.js — every hex's arrival, per act (2026-09-09, "all six" #4)
 * Read-only. For each hex Drawing that carries an on-enter beat (drawing flag) or a
 * campaign hexOverride (onEnterBeatId / onEnterBeatIds), lists the arrival list in
 * order with each beat's act gate, and which acts 0–6 would arrive on SOMETHING.
 * Hexes with a gap (an act where every listed beat is gated away) are flagged ⚠.
 * Run as GM with the campaign active. Output: console table + GM chat card.
 */
(() => {
  const NS = "bbttcc-campaign", TERR = "bbttcc-territory";
  const api = game.bbttcc?.api?.campaign; const cid = api?.getActiveCampaignId?.(); const camp = api?.getCampaign?.(cid); if (!camp) return ui.notifications.error("No active campaign.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {}); const byId = Object.fromEntries(beats.map(b => [b.id, b]));
  const reqs = (b) => { const r = b?.inject?.requires; return !r ? [] : (Array.isArray(r) ? r : [r]); };
  const actOf = (b) => { let a = null; for (const r of reqs(b)) if (r && r.flag === "storyPhase" && Number.isFinite(+r.gte)) a = Math.max(a ?? -Infinity, +r.gte); return a; };
  const questGated = (b) => reqs(b).some(r => r && (r.questBucket != null || r.beatMark != null));
  const ov = camp.hexOverrides || {}; const rows = []; const curPhase = Number(game.settings.get(NS, "storyPhase") || 0);
  for (const sc of game.scenes) for (const d of sc.drawings) {
    const tf = d.flags?.[TERR]; if (!tf || !(tf.isHex || tf.kind === "territory-hex" || tf.name)) continue;
    const rec = ov[d.uuid] || {}; const list = [];
    const push = (v) => { for (const s of String(v || "").split("|")) { const t = s.trim(); if (t && !list.includes(t)) list.push(t); } };
    if (Array.isArray(rec.onEnterBeatIds)) rec.onEnterBeatIds.forEach(push); push(rec.onEnterBeatId || rec.beatId); push(tf.campaign?.onEnterBeatId);
    if (!list.length) continue;
    const acts = []; for (let a = 0; a <= 6; a++) { const hit = list.find(id => { const b = byId[id]; if (!b) return false; const g = actOf(b); return g == null || g <= a; }); acts.push(hit ? (questGated(byId[hit]) ? "◐" : "●") : "○"); }
    const gaps = acts.map((s, a) => s === "○" ? a : null).filter(a => a != null && a >= 1);
    rows.push({ hex: String(tf.name || d.id).replace(/[\s ]+/g, " "), scene: sc.name, list: list.map(id => `${id}${byId[id] ? ` (Act ${actOf(byId[id]) ?? "any"}${questGated(byId[id]) ? ", quest-gated" : ""})` : " ⚠ MISSING BEAT"}`).join(" → "), acts: acts.join(""), gaps: gaps.join(","), flag: gaps.includes(curPhase) ? "⚠ NOW" : (gaps.length ? "⚠" : "") });
  }
  rows.sort((a, b) => (b.flag.length - a.flag.length) || a.hex.localeCompare(b.hex));
  console.group(`[audit-hex-arrivals] ${rows.length} hex(es) with an arrival · current Act ${curPhase} · ● arrives · ◐ arrives if its quest gate passes · ○ nothing`); console.table(rows); console.groupEnd();
  const esc = foundry.utils.escapeHTML;
  ChatMessage.create({ whisper: [game.user.id], content: `<b>Hex arrivals by act</b> (acts 0–6; ● arrives · ◐ quest-gated · ○ nothing; current Act ${curPhase})<table style="font-size:11px;width:100%"><tr><th>Hex</th><th>0123456</th><th>gaps</th></tr>${rows.map(r => `<tr><td>${esc(r.hex)}</td><td style="font-family:monospace">${r.acts}</td><td>${esc(r.gaps || "—")} ${esc(r.flag)}</td></tr>`).join("")}</table><p style="font-size:11px">Full arrival lists in the console (F12).</p>` });
})();

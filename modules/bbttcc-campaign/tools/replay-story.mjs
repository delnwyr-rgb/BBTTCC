#!/usr/bin/env node
// ft-replay-story — OFFLINE story replay (2026-09-14). Walks a save (or bundle) the way the table would:
// takes what the NOW card says next, runs it through the entry guards (seal · future-act with the opener
// exemption · hard gate), follows routes the way the model does, rides to towns on arrival, and advances
// the turn when the model says THE TURN. Stops on refusals, loops, or dead ends. This is the tool the
// Director rebuild lacked: every seam bug on 2026-09-14 (Act 0→1, the hub loop, step-order fallback, pool
// beats as doors) was found by it in seconds instead of at the table.
//   bin/ft-replay-story <save.json|bundle.json> [--max=160] [--act=2]
// Gates evaluated offline: storyPhase / turn / questBucket (via the store projection) / beatMark; other
// meters read as unmet. Arrivals: a ride beat "arrives" at its town's on-enter opener (ARRIVE table).
import fs from "fs";
import path from "path"; import { fileURLToPath } from "url";
const __dir = path.dirname(fileURLToPath(import.meta.url));
const m = await import(path.join(__dir, "..", "scripts", "story-model.js"));
const argv = process.argv.slice(2); const file = argv.find(a => !a.startsWith("--")); if (!file) { console.error("usage: ft-replay-story <save.json|bundle.json> [--max N] [--act N]"); process.exit(2); }
const MAX = Number((argv.find(a => a.startsWith("--max=")) || "--max=160").slice(6)); const TRACE = argv.includes("--trace"); const STOP_TURN = Number((argv.find(a => a.startsWith("--turns=")) || "--turns=3").slice(8)); const STOP_ACT = Number((argv.find(a => a.startsWith("--act=")) || "--act=2").slice(6));
const raw = JSON.parse(fs.readFileSync(file, "utf8")); const j = raw.kind === "bbttcc-campaign-bundle" ? { settings: [{ ns: "bbttcc-campaign", key: "campaigns", value: { [raw.campaignId]: raw.campaign } }, { ns: "bbttcc-campaign", key: "activeCampaignId", value: raw.campaignId }], scenes: [] } : raw;
const settings = j.settings || []; const get = (ns, k) => { const r = settings.find(s => s.ns === ns && s.key === k); let v = r?.value; if (typeof v === "string") { try { v = JSON.parse(v) } catch { } } return v; };
const cid = get("bbttcc-campaign", "activeCampaignId"); const c = get("bbttcc-campaign", "campaigns")[cid];
const byId = new Map(c.beats.map(b => [b.id, b]));
// ── world state ──
// start FROM the save's own state when it has one (a mid-game save replays forward, not from the top)
const savedStore = (() => { try { const r = (j.settings || []).find(s => s.ns === "bbttcc-campaign" && s.key === "storyState"); let v = r?.value; if (typeof v === "string") v = JSON.parse(v); return v?.[cid] || null; } catch (_e) { return null; } })();
const resume = !!(savedStore && Object.keys(savedStore.played || {}).length);
let phase = resume ? Number(j.storyPhase) || 0 : 0, turn = resume ? Number(j.turn) || 1 : 1;
const st = resume ? JSON.parse(JSON.stringify(savedStore)) : m.emptyState(); let t = resume ? Math.max(1, ...Object.values(st.played).map(p => Number(p.ts) || 0)) + 1 : 1; const log = []; const refusals = [];
if (resume) log.push(`  ▶ resuming from the save: turn ${turn}, act ${phase}, ${Object.keys(st.played).length} beats played`);
const idx = new Map(c.beats.map((b, i) => [b.id, i])); const seqOf = b => { const n = Number(b?.questStep); return (b?.questStep != null && Number.isFinite(n)) ? n : 1e6 + (idx.get(b?.id) ?? 0); };
const actOf = b => { const rs = reqs(b); let a = null; for (const x of rs) if (x?.flag === "storyPhase" && Number.isFinite(Number(x.gte))) a = Math.max(a ?? -Infinity, Number(x.gte)); return a; };
const reqs = b => { const r = b?.inject?.requires; return Array.isArray(r) ? r.filter(Boolean) : (r && typeof r === "object" ? [r] : []); };
const bucketOf = () => { const p = m.projection(st); return (rid) => p[rid] || null; };
function gateOK(b) {   // mirror of _beatRequiresMet (approx.)
  const bo = bucketOf(); const own = Number(b?.worldEffects?.phaseAdvance?.set);
  for (const x of reqs(b)) {
    if (x.flag === "storyPhase") { let val = phase; if (Number.isFinite(own) && own === val + 1) val = own; if (x.gte != null && val < Number(x.gte)) return { ok: false, why: `storyPhase ≥ ${x.gte}` }; if (x.lte != null && val > Number(x.lte)) return { ok: false, why: `storyPhase ≤ ${x.lte}` }; continue; }
    if (x.flag === "turn") { if (x.gte != null && turn < Number(x.gte)) return { ok: false, why: `turn ≥ ${x.gte}` }; continue; }
    if (x.questBucket) { const cur = bo(String(x.questBucket)); const met = x.is != null ? cur === x.is : (x.isNot != null ? cur !== x.isNot : true); if (!met) return { ok: false, why: `quest ${String(x.questBucket).slice(-6)} ${x.is ? "is " + x.is : "isNot " + x.isNot} (now ${cur})` }; continue; }
    if (x.beatMark) { if (!st.played[x.beatMark]) return { ok: false, why: `beatMark ${x.beatMark}` }; continue; }
    if (x.flag) { return { ok: false, why: `meter ${x.flag} (unknown offline)` }; }
  }
  const seal = m.sealOfDecl(b, st, phase); if (seal && seal.sealed) return { ok: false, why: "SEAL: " + seal.why };
  return { ok: true };
}
function guards(b, source) {   // executeBeat entry refusals
  const seal = m.sealOfDecl(b, st, phase); if (seal?.sealed) return "SEAL " + seal.why;
  const act = actOf(b); const own = Number(b?.worldEffects?.phaseAdvance?.set); const steps = Number.isFinite(own) && act !== null && own === act && phase === act - 1;
  if (source !== "phase-door" && act !== null && act > phase && !steps) return `FUTURE-ACT (act ${act} > phase ${phase})`;
  if (b.inject?.hardGate === true) { const g = gateOK(b); if (!g.ok) return "HARD-GATE " + g.why; }
  return null;
}
const ARRIVE = { ag_ride_khezek_tor: "khezek_tor_main_scene", ag_ride_lyrenn: "lyrenn_opening_scene", lyrenn_word_ride: "lyrenn_opening_scene", ride_back_home: "allesh_gilliam_introduction_to_hq" };
function play(id, source = "gm") {
  const b = byId.get(id); if (!b) { log.push(`  ✗ missing beat ${id}`); return false; }
  const why = guards(b, source); if (why) { refusals.push({ id, why, phase, turn }); log.push(`  ⛔ ${id} REFUSED: ${why}`); return false; }
  const ch = m.applyRecord(st, b, { ts: t++, turn }); const setP = Number(b.worldEffects?.phaseAdvance?.set);
  let note = ch.map(x => x.kind.replace("quest-", "Q:").replace("chapter-", "C:") + ":" + (x.quest || "") + (x.chapter ? "·" + x.chapter : "") + (x.ending ? "=" + x.ending : "")).join(" ");
  if (Number.isFinite(setP) && setP > phase) { phase = setP; note += ` ▶ ACT ${phase}`; }
  log.push(`${String(turn).padStart(2)}/A${phase} ${id}${note ? "  [" + note + "]" : ""}`);
  return true;
}
function situation() {
  const played = new Set(Object.keys(st.played)); const ts = Object.fromEntries(Object.entries(st.played).map(([k, v]) => [k, v.ts]));
  const isAmb = b => !!b?.pacing?.ambient || b?.timeScale === "leg" || !!b?.targetHexUuid || /\bdiscovery\b/i.test(String(b?.tags || ""));
  const anchorId = [...played].filter(id => m.isAnchorable(byId.get(id))).sort((a, b) => ts[b] - ts[a])[0] || null;
  return m.deriveSituation({ beats: c.beats, firedSet: played, firedTs: id => ts[id] || 0, readyOf: id => { const b = byId.get(id); if (!b) return null; const g = gateOK(b); return { ready: g.ok, reasons: g.ok ? [] : [{ met: false, text: g.why }] }; }, bucketOf: bucketOf(), invitedIds: new Set(), phase, turn, anchorId, seqOf, questNames: {}, state: st, openingBeatId: c.openingBeatId });
}
// ── the walk: do what the NOW card says; inside a beat, take the first unplayed route (player pick) ──
if (!resume) play(c.openingBeatId, "opening");
for (let step = 0; step < MAX; step++) {
  const s = situation(); const n = s.now;
  if (TRACE) log.push(`     ↳ now=${n?.quest?.name || "-"}/${n?.why || "-"} → ${n?.next?.beat?.id || "-"}${n?.next?.revisit ? " (revisit)" : ""} | in play: ${s.inPlay.map(q => `${q.name}→${q.next?.beat?.id || "-"}${q.next?.ready ? "" : "⛩"}`).join(", ") || "-"} | doors: ${s.doors.map(q => q.name).join(", ") || "-"}`);
  let next = n?.next?.beat || null; let why = n?.why || "-";
  if (n?.why === "turn") { log.push(`  🔁 THE TURN — nothing more opens this turn`); if (turn >= STOP_TURN) break; turn++; const DOORS = [[2, 2], [6, 3], [10, 4], [14, 5]]; for (const [tg, ph] of DOORS) if (turn >= tg && phase < ph) { phase = ph; log.push(`  ⏩ ADVANCE → turn ${turn}, calendar door → ACT ${phase}`); if (ph === 2) play("a2_that_one_night", "phase-door"); } if (!log[log.length - 1].includes("ADVANCE")) log.push(`  ⏩ ADVANCE → turn ${turn}`); continue; }
  if (!next || n?.why === "complete" || n?.why === "empty" || n?.why === "done-no-closer") {
    // nothing in the story's quest → a door (dormant quest with ready start), then IN PLAY
    const d = s.doors[0]; const ip = s.inPlay.find(q => q.next?.beat);
    if (d) { next = d.next.beat; why = "DOOR:" + d.name; } else if (ip) { next = ip.next.beat; why = "IN PLAY:" + ip.name; }
  }
  if (!next) { log.push(`  ■ nothing to do (${why}) — model says: ${JSON.stringify({ now: n?.why, doors: s.doors.map(q => q.name), inPlay: s.inPlay.map(q => q.name + "→" + (q.next?.beat?.id || "-")) })}`); 
    if (turn === 1) { // the table advances the turn (day's end): calendar door opens Act 2 + the night
      turn = 2; if (phase < 2) { phase = 2; log.push(`  ⏩ ADVANCE → turn 2, calendar door → ACT 2`); play("a2_that_one_night", "phase-door"); } continue; }
    break; }
  if (!n?.next?.ready && !why.startsWith("DOOR") && !why.startsWith("IN PLAY")) { log.push(`  ⏳ NOW waits: ${next.id} — ${(n.next.reasons || []).map(r => r.text).join(", ")}; roads: ${(n.roads || []).map(r => r.quest.name + "→" + (r.beat?.id || "-") + (r.ready ? "⚡" : "⛩")).join(" | ") || "-"}`); 
    const r = (n.roads || []).find(r => r.beat && r.ready); if (r) next = r.beat; else { if (turn === 1) { turn = 2; if (phase < 2) { phase = 2; log.push(`  ⏩ ADVANCE → turn 2, calendar door → ACT 2`); play("a2_that_one_night", "phase-door"); } continue; } break; } }
  const last3 = log.slice(-3).map(l => l.trim().split(/\s+/)[1]); if (last3.length === 3 && last3.every(x => x === next.id)) { log.push(`  ■ LOOP on ${next.id} — the model keeps offering the same beat; stopping`); break; }
  if (!play(next.id, why.startsWith("DOOR") ? "door" : "gm")) { if (refusals.length > 6) break; }
  if (ARRIVE[next.id]) { log.push(`  🐎 ride → arrive ${ARRIVE[next.id]}`); play(ARRIVE[next.id], "hex"); }
  if (phase >= STOP_ACT && turn >= 2 && step > 40) break;
}
console.log(log.join("\n"));
console.log("\nREFUSALS:", refusals.length ? JSON.stringify(refusals, null, 0) : "none");
const s = situation(); console.log("\nEND: phase", phase, "turn", turn, "| quests:", s.quests.filter(q => q.state !== "dormant" && q.state !== "closed").map(q => `${q.name}=${q.state}`).join(", "));

#!/usr/bin/env node
// ft-replay-story — OFFLINE story replay (2026-09-14). Walks a save (or bundle) the way the table would:
// takes what the NOW card says next, runs it through the entry guards (seal · future-act with the opener
// exemption · hard gate), follows routes the way the model does, rides to towns on arrival, and advances
// the turn when the model says THE TURN. Stops on refusals, loops, or dead ends. This is the tool the
// Director rebuild lacked: every seam bug on 2026-09-14 (Act 0→1, the hub loop, step-order fallback, pool
// beats as doors) was found by it in seconds instead of at the table.
//   bin/ft-replay-story <save.json|bundle.json> [--max=160] [--act=2]
// Gates evaluated offline: storyPhase / turn / questBucket (via the store projection) / beatMark / relation (as beats set it); other
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
const REL = ["at_war", "hostile", "unfriendly", "neutral", "friendly", "allied"]; const rel = {};   // faction id → the coalition's standing, as beats set it (relationshipEffects with @coalition on the other side)
function gateOK(b) {   // mirror of _beatRequiresMet (approx.)
  const bo = bucketOf(); const own = Number(b?.worldEffects?.phaseAdvance?.set);
  for (const x of reqs(b)) {
    if (Array.isArray(x?.anyOf)) { const any = x.anyOf.some(sub => gateOK({ inject: { requires: [sub] }, worldEffects: b?.worldEffects }).ok); if (!any) return { ok: false, why: "anyOf" }; continue; }
    if (x.flag === "storyPhase") { let val = phase; if (Number.isFinite(own) && own === val + 1) val = own; if (x.gte != null && val < Number(x.gte)) return { ok: false, why: `storyPhase ≥ ${x.gte}` }; if (x.lte != null && val > Number(x.lte)) return { ok: false, why: `storyPhase ≤ ${x.lte}` }; continue; }
    if (x.flag === "turn") { if (x.gte != null && turn < Number(x.gte)) return { ok: false, why: `turn ≥ ${x.gte}` }; continue; }
    if (x.questBucket) { const cur = bo(String(x.questBucket)); const met = x.is != null ? cur === x.is : (x.isNot != null ? cur !== x.isNot : true); if (!met) return { ok: false, why: `quest ${String(x.questBucket).slice(-6)} ${x.is ? "is " + x.is : "isNot " + x.isNot} (now ${cur})` }; continue; }
    if (x.beatMark) { const pl = !!st.played[x.beatMark]; if (pl === (x.not === true)) return { ok: false, why: `beatMark ${x.not === true ? "not " : ""}${x.beatMark}` }; continue; }
    if (x.relation) { const tid = String(x.relation).replace(/^Actor\./, ""); const cur = rel[tid] || "neutral"; const want = String(x.is ?? x.atLeast ?? "").toLowerCase(); const ok = x.is != null ? cur === want : REL.indexOf(cur) >= REL.indexOf(want); if (!ok) return { ok: false, why: `standing with ${tid.slice(-6)} ${x.is != null ? "is" : "≥"} ${want} (now ${cur})` }; continue; }
    if (x.flag === "crVerify") { const D = { enc_circuit_riders_doctrine_good: 1, enc_circuit_riders_darkness_good: 1, enc_circuit_riders_witness_good: 1, enc_circuit_riders_witness_success: 1, enc_circuit_riders_doctrine_bad: -1, enc_circuit_riders_darkness_bad: -1, enc_circuit_riders_witness_bad: -1 }; const v = Object.keys(st.played).reduce((n, id) => n + (D[id] || 0), 0); if (x.gte != null && v < Number(x.gte)) return { ok: false, why: `crVerify ≥ ${x.gte} (is ${v})` }; continue; }   // the Riders' tally, mirrored from CR_VERIFY_DELTAS
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
  if (where && source !== "phase-door" && source !== "hex") { const p = m.placeOf(b, null); if (p && p !== "anywhere" && knownHexes.has(m.hexKey(p)) && m.hexKey(p) !== m.hexKey(where)) return `NOT HERE (at ${p}; the party is at ${where})`; }
  return null;
}
const ARRIVE = { ag_ride_home: "allesh_gilliam_town_walk", ag_ride_khezek_tor: "khezek_tor_main_scene", ag_ride_lyrenn: "lyrenn_opening_scene", lyrenn_word_ride: "lyrenn_opening_scene", ride_back_home: "allesh_gilliam_introduction_to_hq", ag_ride_fixit: "fixit_cinematic_intro" };
const ARRIVE_AT = { "allesh-gilliam": "allesh_gilliam_introduction_to_hq", "lyrenn": "lyrenn_opening_scene", "khezek-tor": "khezek_tor_main_scene", "furrier's fixit-farm": "fixit_cinematic_intro" };   // hexKey → the town's on-enter opener
const ARRIVE_AT_ACT1 = { "allesh-gilliam": "allesh_gilliam_town_walk" };   // Act 1 (2026-09-17): riding home on day one re-opens the Welcome Round, not the Act 2 HQ
const RIDE_TO = { ag_ride_home: "Allesh-Gilliam", ag_ride_khezek_tor: "Khezek-Tor", ag_ride_lyrenn: "Lyrenn", lyrenn_word_ride: "Lyrenn", ride_back_home: "Allesh-Gilliam", ag_ride_fixit: "Furrier's Fixit-Farm" };
// WHERE (2026-09-15): the party's hex — from the save's recorded arrival, moved by rides; every hex name on the save's maps is "known"
const knownHexes = new Set(); (function walk(o, d) { if (d > 12) return; if (Array.isArray(o)) { for (const v of o) walk(v, d + 1); } else if (o && typeof o === "object") { const tf = o.flags?.["bbttcc-territory"]; if (tf && (tf.isHex === true || tf.kind === "territory-hex" || tf.hexId || tf.name)) { const k = m.hexKey(tf.name || o.text); if (k) knownHexes.add(k); } for (const v of Object.values(o)) if (v && typeof v === "object") walk(v, d + 1); } })(j, 0);
let where = (() => { try { const fid = String(c.factionId || (c.factionIds || [])[0] || "").replace(/^Actor\./, ""); const a = (j.actors || []).find(x => x._id === fid); return a?.flags?.["bbttcc-factions"]?.travel?.atHexName || null; } catch (_e) { return null; } })();
if (where) log.push(`  📍 the party stands at ${where} (${knownHexes.size} hexes known)`);
// PINNED LEGS (D-9, 2026-09-17): a beat with pinLeg.to matching the destination plays on the leg (once; gates apply)
function playPinned(dest) {
  const k = m.hexKey(dest);
  for (const b of c.beats) { const pin = b?.pinLeg; if (!pin || typeof pin !== "object" || !pin.to) continue; if (m.hexKey(pin.to) !== k) continue; if (st.played[b.id] && b.inject?.repeatable !== true) continue; if (!gateOK(b).ok) continue; log.push(`  📌 pinned leg → ${b.id}`); play(b.id, "hex"); }
}
function play(id, source = "gm") {
  const b = byId.get(id); if (!b) { log.push(`  ✗ missing beat ${id}`); return false; }
  const why = guards(b, source); if (why) { refusals.push({ id, why, phase, turn }); log.push(`  ⛔ ${id} REFUSED: ${why}`); return false; }
  const ch = m.applyRecord(st, b, { ts: t++, turn }); const setP = Number(b.worldEffects?.phaseAdvance?.set);
  for (const r of (Array.isArray(b.worldEffects?.relationshipEffects) ? b.worldEffects.relationshipEffects : [])) { if (!r?.setStatus) continue; for (const side of [r.sourceFactionId, r.targetFactionId]) { const id = String(side || "").replace(/^Actor\./, ""); if (id && !/^@/.test(id)) rel[id] = String(r.setStatus).toLowerCase(); } }
  let note = ch.map(x => x.kind.replace("quest-", "Q:").replace("chapter-", "C:") + ":" + (x.quest || "") + (x.chapter ? "·" + x.chapter : "") + (x.ending ? "=" + x.ending : "")).join(" ");
  if (Number.isFinite(setP) && setP > phase) { phase = setP; note += ` ▶ ACT ${phase}`; }
  log.push(`${String(turn).padStart(2)}/A${phase} ${id}${note ? "  [" + note + "]" : ""}`);
  return true;
}
function situation() {
  const played = new Set(Object.keys(st.played)); const ts = Object.fromEntries(Object.entries(st.played).map(([k, v]) => [k, v.ts]));
  const isAmb = b => !!b?.pacing?.ambient || b?.timeScale === "leg" || !!b?.targetHexUuid || /\bdiscovery\b/i.test(String(b?.tags || ""));
  const anchorId = [...played].filter(id => m.isAnchorable(byId.get(id))).sort((a, b) => ts[b] - ts[a])[0] || null;
  return m.deriveSituation({ where, knownHexes, beats: c.beats, firedSet: played, firedTs: id => ts[id] || 0, readyOf: id => { const b = byId.get(id); if (!b) return null; const g = gateOK(b); return { ready: g.ok, reasons: g.ok ? [] : [{ met: false, text: g.why }] }; }, bucketOf: bucketOf(), invitedIds: new Set(), phase, turn, anchorId, seqOf, questNames: {}, state: st, openingBeatId: c.openingBeatId });
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
    const r = (n.roads || []).find(r => r.beat && r.ready); const d = s.doors[0]; const ip = s.inPlay.find(q => q.next?.beat && q.next.ready && q.next.beat.id !== next.id);
    if (r) next = r.beat; else if (d) { next = d.next.beat; why = "DOOR:" + d.name; log.push(`  🚪 open a door instead: ${d.name}`); } else if (ip) { next = ip.next.beat; why = "IN PLAY:" + ip.name; log.push(`  ↪ in play instead: ${ip.name}`); }
    else { if (turn >= STOP_TURN) break; turn++; log.push(`  ⏩ ADVANCE → turn ${turn} (everything waits)`); const DOORS = [[2, 2], [6, 3], [10, 4], [14, 5]]; for (const [tg, ph] of DOORS) if (turn >= tg && phase < ph) { phase = ph; log.push(`  ⏩ calendar door → ACT ${phase}`); if (ph === 2) play("a2_that_one_night", "phase-door"); } continue; } }
  // the Travel Console (2026-09-15): whatever the walker picked (NOW, a road, a door, IN PLAY) is a ride away → the GM plots
  // the ride first; arrival opens the town, then the situation is recomputed with the party standing there
  { const p = m.placeOf(next, null); if (where && p && p !== "anywhere" && knownHexes.has(m.hexKey(p)) && m.hexKey(p) !== m.hexKey(where)) { const dest = String(p); where = dest; log.push(`  🐎 Travel Console → ${dest} (📍 ${dest})`); playPinned(dest); const opener = ((phase <= 1 && ARRIVE_AT_ACT1[m.hexKey(dest)]) || ARRIVE_AT[m.hexKey(dest)]); if (opener && byId.get(opener) && !st.played[opener]) play(opener, "hex"); continue; } }
  const last3 = log.slice(-3).map(l => l.trim().split(/\s+/)[1]); if (last3.length === 3 && last3.every(x => x === next.id)) { log.push(`  ■ LOOP on ${next.id} — the model keeps offering the same beat; stopping`); break; }
  if (!play(next.id, why.startsWith("DOOR") ? "door" : "gm")) { if (refusals.length > 6) break; }
  if (ARRIVE[next.id] && byId.get(ARRIVE[next.id])) { if (RIDE_TO[next.id]) where = RIDE_TO[next.id]; log.push(`  🐎 ride → arrive ${ARRIVE[next.id]}${where ? ` (📍 ${where})` : ""}`); playPinned(where); play(ARRIVE[next.id], "hex"); }
  if (phase >= STOP_ACT && turn >= 2 && step > 40) break;
}
console.log(log.join("\n"));
console.log("\nREFUSALS:", refusals.length ? JSON.stringify(refusals, null, 0) : "none");
const s = situation(); console.log("\nEND: phase", phase, "turn", turn, "| quests:", s.quests.filter(q => q.state !== "dormant" && q.state !== "closed").map(q => `${q.name}=${q.state}`).join(", "));

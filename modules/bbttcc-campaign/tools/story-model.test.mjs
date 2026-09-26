#!/usr/bin/env node
// story-model.test.mjs — offline tests for the STORY MODEL's scripted quests (Phase A, 2026-09-17).
//   node modules/bbttcc-campaign/tools/story-model.test.mjs            (fixture suite)
//   node modules/bbttcc-campaign/tools/story-model.test.mjs <save.json>  (+ a smoke pass over a real save with a trial script)
// No framework: assert + a tiny runner. Exit 1 on any failure.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dir = path.dirname(fileURLToPath(import.meta.url));
const m = await import(path.join(__dir, "..", "scripts", "story-model.js"));

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log("  ✓", name); } catch (e) { fail++; console.log("  ✗", name, "\n     ", String(e.message || e).split("\n")[0]); } };

// ── fixture: a tiny world with one scripted quest + one unscripted helper quest ─────────────────────────
const Q = "allesh_gilliam";               // a real QUEST_MAP key (act 2, chapters exist)
const H = "fixit_farm";                   // handoff target
const beat = (id, extra = {}) => ({ id, label: id, type: "dialog", story: { quest: Q }, choices: [], inject: { requires: [] }, ...extra });
const beats = [
  beat("a_welcome", { inject: { requires: [{ flag: "storyPhase", gte: 1 }] } }),
  beat("a_round", { inject: { requires: [{ flag: "storyPhase", gte: 1 }] } }),
  beat("b_hq", { inject: { requires: [{ flag: "storyPhase", gte: 2 }] } }),
  beat("b_wall", { inject: { requires: [{ flag: "storyPhase", gte: 2 }] } }),
  beat("b_wall_ok"), beat("b_wall_bad"),
  beat("b_gate", { inject: { requires: [{ flag: "storyPhase", gte: 2 }] } }),
  beat("b_ride"),
  beat("b_install", { inject: { requires: [{ questBucket: "quest_fixit_stab", is: "completed" }] } }),
  beat("b_close", { story: { quest: Q, role: "closer", ending: "closure" } }),
  beat("d_tamsin"),
  // the handoff target quest's start (unscripted): the model's inference offers it
  { id: "f_start", label: "f_start", type: "dialog", story: { quest: H, role: "start" }, choices: [], inject: { requires: [] } }
];
const script = {
  giver: "Marshal Yarrow Pike", description: "Pike gave you two errands.",
  arrival: { act: 1, steps: [
    { id: "welcome", label: "Welcome!", beats: ["a_welcome"], line: "Get off the Jackalope." },
    { id: "round", label: "The Welcome Round", beats: ["a_round"], line: "Walk the town." }
  ] },
  steps: [
    { id: "hq", label: "The Trouble Starts", beats: ["b_hq"], line: "Hear the errands." },
    { id: "wall", label: "The East Wall", beats: ["b_wall"], group: "errands", line: "Walk the wall.", done: { anyOf: ["b_wall_ok", "b_wall_bad"] } },
    { id: "gate", label: "The Gate", beats: ["b_gate"], group: "errands", line: "See Garren.", hereLine: "Garren is right here." },
    { id: "ride", label: "Ride for Fixit", beats: ["b_ride"], line: "Ride with the spanner.", handoff: { quest: H }, done: { quest: H } },
    { id: "install", label: "The Gate Remembers Right", beats: ["b_install"], line: "Bring the crate to Garren." },
    { id: "close", label: "Pike Updates the Map", beats: ["b_close"], line: "See your names on the map." }
  ],
  doors: [{ id: "tamsin", label: "Father Tamsin", beats: ["d_tamsin"], line: "Ask about the dream." }],
  after: []
};
const byId = new Map(beats.map(b => [b.id, b]));
const gateOK = (b, phase, buckets) => (b.inject?.requires || []).every(r => r.flag === "storyPhase" ? phase >= r.gte : r.questBucket ? (buckets[r.questBucket] || null) === r.is : true);
function situation({ fired = [], phase = 2, buckets = {}, where = null, anchor = null } = {}) {
  const firedSet = new Set(fired);
  const state = m.emptyState(); for (const id of fired) m.applyRecord(state, byId.get(id), { ts: 1, turn: 1 });
  return m.deriveSituation({ beats, firedSet, firedTs: () => 1, readyOf: id => { const b = byId.get(id); return b ? { ready: gateOK(b, phase, buckets), reasons: gateOK(b, phase, buckets) ? [] : [{ met: false, text: "gate" }] } : null; },
    bucketOf: rid => buckets[rid] || null, phase, turn: phase, anchorId: anchor, seqOf: b => beats.indexOf(b), state, where, knownHexes: null });
}
const q = (sit) => sit.byKey[Q];

console.log("story-model scripts — fixture suite");
// ── evergreen quests (2026-09-25): a grief town never act-seals; a plain act-2 quest still does ─────────
test("evergreen: Chuckle Creek (act 2) is NOT act-sealed in Act 3; Allesh-Gilliam (act 2) is", () => {
  const st = m.emptyState();
  const cc = m.sealOfDecl({ id: "x", story: { quest: "chuckle_creek", role: "start" } }, st, 3);
  assert.equal(cc.sealed, false);
  const ag = m.sealOfDecl({ id: "y", story: { quest: "allesh_gilliam", role: "start" } }, st, 3);
  assert.equal(ag.sealed, true); assert.equal(ag.kind, "act");
  assert.equal(m.QUEST_MAP.quests.stillwater.evergreen, true); assert.equal(m.QUEST_MAP.quests.soft_landing.evergreen, true);
  assert.equal(m.normalizeQuestDef("z", { name: "Z", act: 2, evergreen: true }).evergreen, true);
  assert.equal("evergreen" in m.normalizeQuestDef("z", { name: "Z", act: 2 }), false);
});

// the real Acts 0–2 scripts register at load; the fixture swaps in its own for the two keys it uses and restores after
const realQ = m.QUEST_SCRIPTS[Q], realH = m.QUEST_SCRIPTS[H];
delete m.QUEST_SCRIPTS[H];   // the fixture's helper quest is UNSCRIPTED on purpose
m.registerScripts({ [Q]: script });

test("fresh quest at act 1: next = the first Arrival step, with its line", () => {
  const s = q(situation({ phase: 1 }));
  assert.equal(s.next?.beat?.id, "a_welcome"); assert.equal(s.next.line, "Get off the Jackalope."); assert.equal(s.script.steps[0].status, "current");
});
test("arrival done, act 2: Arrival steps done/sealed; next = The Trouble Starts", () => {
  const s = q(situation({ fired: ["a_welcome"], phase: 2 }));
  assert.equal(s.script.steps.find(x => x.id === "round").status, "sealed");
  assert.equal(s.next?.beat?.id, "b_hq"); assert.equal(s.next.line, "Hear the errands.");
});
test("group = any order: both errands current; next = the first ready", () => {
  const s = q(situation({ fired: ["a_welcome", "a_round", "b_hq"], phase: 2 }));
  assert.deepEqual(s.script.current, ["wall", "gate"]); assert.equal(s.next?.beat?.id, "b_wall");
});
test("explicit done: the wall's intro played is NOT done until an outcome plays", () => {
  const s = q(situation({ fired: ["a_welcome", "a_round", "b_hq", "b_wall"], phase: 2 }));
  assert.equal(s.script.steps.find(x => x.id === "wall").status, "current"); assert.equal(s.next?.beat?.id, "b_gate");
  const s2 = q(situation({ fired: ["a_welcome", "a_round", "b_hq", "b_wall", "b_wall_ok"], phase: 2 }));
  assert.equal(s2.script.steps.find(x => x.id === "wall").status, "done"); assert.equal(s2.next?.beat?.id, "b_gate");
});
test("hereLine: when the party is at the quest's hex, the line becomes the 'go and see' variant", () => {
  const s = q(situation({ fired: ["a_welcome", "a_round", "b_hq", "b_wall_ok"], phase: 2, where: "Allesh-Gilliam" }));
  assert.equal(s.next?.beat?.id, "b_gate"); assert.equal(s.next.line, "Garren is right here.");
});
test("handoff: ride played, target quest not done → next is the TARGET quest's beat, line stays ours", () => {
  const s = q(situation({ fired: ["a_welcome", "a_round", "b_hq", "b_wall_ok", "b_gate", "b_ride"], phase: 2 }));
  assert.equal(s.next?.beat?.id, "f_start"); assert.equal(s.next.line, "Ride with the spanner."); assert.equal(s.why, "next");
});
test("handoff satisfied (bucket completed) → the step is done; next = install, gated → waiting with reasons", () => {
  const s = q(situation({ fired: ["a_welcome", "a_round", "b_hq", "b_wall_ok", "b_gate", "b_ride"], phase: 2, buckets: { [m.QUEST_MAP.quests[H].registryId]: "completed" } }));
  assert.equal(s.script.steps.find(x => x.id === "ride").status, "done");
  assert.equal(s.next?.beat?.id, "b_install"); assert.equal(s.next.ready, false); assert.equal(s.why, "waiting"); assert.equal(s.next.reasons.length, 1);
});
test("closer: everything done → next = the closer; after the closer the quest is completed and next is null", () => {
  const done = ["a_welcome", "a_round", "b_hq", "b_wall_ok", "b_gate", "b_ride", "b_install"];
  const s = q(situation({ fired: done, phase: 2, buckets: { [m.QUEST_MAP.quests[H].registryId]: "completed", quest_fixit_stab: "completed" } }));
  assert.equal(s.next?.beat?.id, "b_close"); assert.equal(s.next.line, "See your names on the map.");
  const s2 = q(situation({ fired: [...done, "b_close"], phase: 2, buckets: { [m.QUEST_MAP.quests[H].registryId]: "completed", quest_fixit_stab: "completed" } }));
  assert.equal(s2.state, "completed"); assert.equal(s2.next, null);
});
test("doors: listed with their line and readiness, never offered as next", () => {
  const s = q(situation({ fired: ["a_welcome", "a_round", "b_hq"], phase: 2 }));
  assert.equal(s.script.doors[0].line, "Ask about the dream."); assert.equal(s.script.doors[0].ready, true); assert.notEqual(s.next?.beat?.id, "d_tamsin");
});
test("unscripted quests are untouched: the fixit_farm helper has no script and its next is the inferred start", () => {
  const s = situation({ phase: 2 }).byKey[H];
  assert.equal(s.script, null); assert.equal(s.next?.beat?.id, "f_start");
});
delete m.QUEST_SCRIPTS[Q]; if (realQ) m.QUEST_SCRIPTS[Q] = realQ; if (realH) m.QUEST_SCRIPTS[H] = realH;   // restore the real scripts

// ── optional: a smoke pass over a real save with a trial Offices script ───────────────────────────────
const save = process.argv[2];
if (save) {
  console.log("smoke: real save + trial 'offices' script");
  const j = JSON.parse(fs.readFileSync(save, "utf8"));
  const get = (k) => { const r = j.settings.find(s => s.ns === "bbttcc-campaign" && s.key === k); let v = r?.value; if (typeof v === "string") { try { v = JSON.parse(v); } catch { } } return v; };
  const camps = get("campaigns"); const cid = Object.keys(camps).find(k => camps[k]?.beats?.length); const cb = camps[cid].beats; const cById = new Map(cb.map(b => [b.id, b]));
  m.registerScripts({ offices: { giver: "Mal", description: "Before you had a body…", steps: [
    { id: "sayings", label: "The Sayings", beats: ["fates_and_destinies_saying_as_above", "fates_and_destinies_saying_form_consciousness", "fates_and_destinies_map_territory", "fates_and_destinies_attention_energy", "fates_and_destinies_bus_explodes", "fates_and_destinies_attention_remember", "fates_and_destinies_incarnate"], line: "Listen. Mal is speaking.", done: { mark: "fates_and_destinies_incarnate" } },
    { id: "guess", label: "Guess What", beats: ["fates_and_destinies_adam_kadmon"], line: "Adam Kadmon has something prepared." },
    { id: "slides", label: "The Ten Slides", beats: ["fates_and_destinies_1", "fates_and_destinies_2", "fates_and_destinies_3", "fates_and_destinies_4", "fates_and_destinies_5", "fates_and_destinies_6", "fates_and_destinies_7", "fates_and_destinies_8", "fates_and_destinies_9", "fates_and_destinies_10"], line: "Ten slides. Progress the deck.", done: { mark: "fates_and_destinies_10" } },
    { id: "cold", label: "Cold Open", beats: ["thatwards_ho_cold_open"], line: "Watch." },
    { id: "ho", label: "Thatwards Ho!", beats: ["thatwards_ho_opening_scene"], line: "Read the briefing." }
  ] } });
  const run = (fired) => { const st = m.emptyState(); for (const id of fired) m.applyRecord(st, cById.get(id), { ts: 1, turn: 1 }); return m.deriveSituation({ beats: cb, firedSet: new Set(fired), firedTs: () => 1, readyOf: () => ({ ready: true, reasons: [] }), bucketOf: () => null, phase: 0, turn: 1, anchorId: fired[fired.length - 1] || null, seqOf: b => Number(b.questStep) || 1e6, state: st, where: null }).byKey.offices; };
  test("offices fresh → the first Saying, line 'Listen. Mal is speaking.'", () => { const s = run([]); assert.equal(s.next?.beat?.id, "fates_and_destinies_saying_as_above"); assert.equal(s.next.line, "Listen. Mal is speaking."); });
  test("offices mid-sayings → the next unplayed Saying (declared order, no routing needed)", () => { const s = run(["fates_and_destinies_saying_as_above", "fates_and_destinies_saying_form_consciousness"]); assert.equal(s.next?.beat?.id, "fates_and_destinies_map_territory"); });
  test("offices after 'incarnate' → Guess What (done by mark, even with the bus skipped)", () => { const s = run(["fates_and_destinies_saying_as_above", "fates_and_destinies_incarnate"]); assert.equal(s.next?.beat?.id, "fates_and_destinies_adam_kadmon"); });
  test("offices after slide 10 → the Cold Open, then Thatwards Ho!", () => { const s = run(["fates_and_destinies_incarnate", "fates_and_destinies_adam_kadmon", "fates_and_destinies_10"]); assert.equal(s.next?.beat?.id, "thatwards_ho_cold_open"); const s2 = run(["fates_and_destinies_incarnate", "fates_and_destinies_adam_kadmon", "fates_and_destinies_10", "thatwards_ho_cold_open"]); assert.equal(s2.next?.beat?.id, "thatwards_ho_opening_scene"); });
  test("unscripted quests in the save keep their inferred next (the Sarmoung Hum has no script; the spine resolves a next)", () => { const sit = m.deriveSituation({ beats: cb, firedSet: new Set(), readyOf: () => ({ ready: true, reasons: [] }), bucketOf: () => null, phase: 2, turn: 2, seqOf: b => Number(b.questStep) || 1e6, state: m.emptyState() }); assert.equal(sit.byKey.sarmoung_hum.script, null); /* the spine gained a script in the Acts 3–6 encode (2026-09-20) — only the Hum stays unscripted */ assert.ok(sit.byKey.valhaulan_spine.next?.beat); });
  test("every registered script resolves a next for a fresh quest at its act (no script is empty)", () => { const sit = m.deriveSituation({ beats: cb, firedSet: new Set(), readyOf: () => ({ ready: true, reasons: [] }), bucketOf: () => null, phase: 2, turn: 2, seqOf: b => Number(b.questStep) || 1e6, state: m.emptyState() }); for (const k of Object.keys(m.QUEST_SCRIPTS)) { const q = sit.byKey[k]; assert.ok(q, k); assert.ok(q.script, k + " script"); assert.ok(q.next?.beat || q.next?.handoff, k + " next"); assert.ok(q.next.line, k + " line"); } });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

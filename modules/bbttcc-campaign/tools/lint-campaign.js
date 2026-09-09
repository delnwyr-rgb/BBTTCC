#!/usr/bin/env node
/* lint-campaign.js — offline static lint for a Bad Eden campaign export (node CLI, NOT a Foundry macro).
 * Versioned here with the campaign tools; `bin/ft-lint-campaign` is a symlink to this file.
 *
 * Answers "will the beats fire as intended?" BEFORE anyone opens Foundry: graph
 * integrity, gate grammar, phase ladder, quest ordering, effect payload shapes,
 * travel tables, engine-held ids. Every rule mirrors what bbttcc-campaign's
 * module.js / world-mutation-engine.js ACTUALLY evaluate (surveyed 2026-09-05):
 *
 *   gates      _beatRequiresMet — inject.requires[] of {flag,gte|lte|eq} |
 *              {questBucket,is|isNot} | {beatMark,quest,state}; unknown flag = unmet
 *   routing    runBeat/executeBeat NEVER consult gates — only the director,
 *              injector and dialogue surfaces do (choice.next fires regardless)
 *   checks     op.<key> pays 1 OP from the faction bank (unknown key = phantom
 *              channel); every other checkStat → GM adjudication
 *   effects    WME reads factionEffects/relationshipEffects/worldModifiers/
 *              turnRequests as ARRAYS (anything else is silently dropped)
 *
 * INPUTS (any mix, later files win for the campaign; quests/tables come from
 * whichever file carries them):
 *   • Foundry JournalEntry export whose flags["bbttcc-campaign"].export is a
 *     bundle (Builder → Export Bundle → export the journal)  ← best: has quests+tables
 *   • a raw bundle payload {kind:"bbttcc-campaign-bundle", campaign, quests, tables}
 *   • a `campaigns` setting backup (keyed map {id: campaign}) — the quest-backups dir
 *   • a `quests` or `tables` setting export (object keyed by id)
 *
 * USAGE
 *   ft-lint-campaign <file...> [--act N] [--campaign ID] [--full] [--info] [--json out.json]
 *     --act N        only report beat findings for beats gated at storyPhase N
 *                    (tables/quests/ladder findings always shown)
 *     --info         include INFO-level findings (default: ERROR + WARN)
 *     --full         list every finding (default: first 12 per rule)
 *     --json FILE    also write the full findings list as JSON
 *   exit 1 if any ERROR, else 0.
 */
"use strict";
const fs = require("fs");
const path = require("path");

// ─── engine facts (keep in sync with module.js) ─────────────────────────────
const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
const CHECK_STATS = new Set(["gm","str","dex","con","int","wis","cha","save.str","save.dex","save.con","save.int","save.wis","save.cha","acr","ani","arc","ath","dec","his","ins","itm","inv","med","nat","prc","prf","per","rel","slt","ste","sur"]);
const GATE_FLAGS = {              // name → [min, max] sanity band (null = unbounded)
  storyPhase: [0, 6], wendigoRung: [0, 4], tikkunDividend: [0, 5], hexesClaimed: [0, null], turn: [0, null],
  banditMercy: [0, null], banditFear: [0, null],
  cadenceRespect: [0, 1], cadenceTribute: [0, 1], cadenceUncontested: [0, 1],
  geburahEarned: [0, 3], geburahForced: [0, 3],
  chucklecreekSeen: [0, 4], stillwaterCrack: [0, 4], softlandingGive: [0, 4]
};
const GM_DRIVEN_FLAGS = new Set(["chucklecreekSeen","stillwaterCrack","softlandingGive"]); // raised by GM today
const QUEST_BUCKETS = new Set(["active","completed","archived"]);
const QUEST_ACTIONS = new Set(["accept","complete","completed","archive","archived","activate","reopen","beat"]);
const SPARK_ACTIONS = new Set(["acquire","gather","integrate"]);
const TIME_SCALES = new Set(["moment","scene","leg","turn","arc","campaign",""]);
const TABLE_COND_KEYS = new Set(["hexWhitelist","hexBlacklist","tagsAll","tagsAny"]);
const PHASE_MAX = 6;
// Ids the ENGINE holds as string constants (module.js) — must exist in the data.
const ENGINE_IDS = {
  "acid_bog_logistics_success": "wendigo rung (travel)", "acid_bog_logistics_failure": "wendigo rung (travel)",
  "enc_broken_bridge_go_around_success": "wendigo rung (travel)", "enc_broken_bridge_go_around_fail": "wendigo rung (travel)",
  "enc_minor_radiation_pocket_go_around": "wendigo rung (travel)", "enc_minor_radiation_pocket_go_around_fail": "wendigo rung (travel)",
  "wendigo_confluence_repair": "wendigo confluence", "wendigo_confluence_redirect": "wendigo confluence", "wendigo_confluence_break": "wendigo confluence",
  "gullywasher_cultural_summit_success": "gullywasher summit", "gullywasher_cultural_summit_failure": "gullywasher summit",
  "gullywasher_dougan_points_to_confluence": "gullywasher", "fixit_gullywasher_interior_convo": "fixit", "fixit_intro_scene": "fixit",
  "bandit_accord_opening": "bandit ledger arms", "bandit_ambush_arms_down": "bandit mercy", "bandit_arms_down_accept": "bandit mercy",
  "bandit_arms_down_violence": "bandit fear", "bandit_summit_humiliation": "bandit summit",
  "spark_geburah_northreach_b_worthy": "geburah earned", "spark_geburah_mountains_q_worthy": "geburah earned", "spark_geburah_mountains_o_worthy": "geburah earned",
  "spark_geburah_northreach_b_force": "geburah forced", "spark_geburah_mountains_q_force": "geburah forced", "spark_geburah_mountains_o_force": "geburah forced",
  "ag_title_card": "Act 2 opener — the Title Card turn gate runBeats it"
};
// Soft engine ids — hub/boundary lists that .filter() on existence (WARN, not ERROR)
const ENGINE_SOFT_IDS = {
  "ag_crossroads_first_rides": "visualizer boundary", "ag_days_end": "visualizer boundary",
  "allesh_gilliam_town_walk": "visualizer hub", "khezek_tor_main_scene": "visualizer hub", "lyrenn_main_scene": "visualizer hub", "lyrenn_opening_scene": "visualizer hub"
};
const CADENCE_OUTCOME_IDS = ["cadence_win_style","cadence_win_ugly","cadence_lose","cadence_refuse","cadence_cameo_spent"];

// ─── args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opt = { act: null, campaign: null, full: false, info: false, json: null, files: [] };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--act") opt.act = Number(argv[++i]);
  else if (a === "--campaign") opt.campaign = argv[++i];
  else if (a === "--full") opt.full = true;
  else if (a === "--info") opt.info = true;
  else if (a === "--json") opt.json = argv[++i];
  else if (a === "-h" || a === "--help") { console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]); process.exit(0); }
  else opt.files.push(a);
}
if (!opt.files.length) { console.error("usage: ft-lint-campaign <export.json...> [--act N] [--info] [--full] [--json out]"); process.exit(2); }

// ─── load + shape-detect ────────────────────────────────────────────────────
let campaign = null, quests = null, tables = null;
const sources = { campaign: null, quests: null, tables: null };
const looksLikeCampaign = (o) => o && typeof o === "object" && (Array.isArray(o.beats) || (o.beats && typeof o.beats === "object")) && ("id" in o || "label" in o);
const asBeatArray = (b) => Array.isArray(b) ? b : Object.values(b || {});
const pickCampaign = (map, file) => {
  const list = Object.entries(map).filter(([, v]) => looksLikeCampaign(v));
  if (!list.length) return null;
  let pick = opt.campaign ? list.find(([k, v]) => k === opt.campaign || v.id === opt.campaign) : null;
  if (!pick) pick = list.sort((a, b) => asBeatArray(b[1].beats).length - asBeatArray(a[1].beats).length)[0];
  if (list.length > 1 && !opt.campaign) console.error(`note: ${file} holds ${list.length} campaigns — linting the largest ('${pick[1].label || pick[0]}'); use --campaign ID to choose`);
  return pick[1];
};
for (const f of opt.files) {
  let raw = JSON.parse(fs.readFileSync(f, "utf8"));
  if (typeof raw === "string") raw = JSON.parse(raw);
  const bundle = raw?.flags?.["bbttcc-campaign"]?.export || (raw?.kind === "bbttcc-campaign-bundle" ? raw : null);
  if (bundle) {
    if (bundle.campaign) { campaign = bundle.campaign; sources.campaign = f; }
    if (bundle.quests && Object.keys(bundle.quests).length) { quests = bundle.quests; sources.quests = f; }
    if (bundle.tables && Object.keys(bundle.tables).length) { tables = bundle.tables; sources.tables = f; }
    continue;
  }
  if (looksLikeCampaign(raw)) { campaign = raw; sources.campaign = f; continue; }
  if (raw && typeof raw === "object") {
    const vals = Object.values(raw);
    if (vals.some(looksLikeCampaign)) { campaign = pickCampaign(raw, f); sources.campaign = f; continue; }
    if (vals.length && vals.every(v => v && Array.isArray(v.entries))) { tables = raw; sources.tables = f; continue; }
    if (vals.length && vals.every(v => v && typeof v === "object" && ("name" in v) && !("beats" in v))) { quests = raw; sources.quests = f; continue; }
  }
  console.error(`warning: could not identify the shape of ${f} — ignored`);
}
if (!campaign) { console.error("no campaign found in the given files"); process.exit(2); }
const beats = asBeatArray(campaign.beats);
const byId = new Map();
const normFid = (v) => String(v ?? "").trim().replace(/^Actor\./, "");
const factionIds = new Set([campaign.factionId, ...(campaign.factionIds || [])].filter(Boolean).map(normFid));
const foreignFactions = new Map();   // factionId → {n, beats:Set}

// ─── findings ───────────────────────────────────────────────────────────────
const findings = [];
const F = (rule, sev, beatId, msg, extra = {}) => findings.push({ rule, sev, beatId: beatId || null, msg, ...extra });
const isNum = (v) => v != null && v !== "" && Number.isFinite(Number(v));
const s = (v) => String(v ?? "").trim();
const condsOf = (b) => { const r = b?.inject?.requires; if (!r) return []; return (Array.isArray(r) ? r : [r]).filter(c => c && typeof c === "object"); };
const phaseOf = (b) => { let p = null; for (const c of condsOf(b)) if (c.flag === "storyPhase" && isNum(c.gte)) p = Math.max(p ?? -1, Number(c.gte)); return p; };
const tagsOf = (b) => Array.isArray(b?.tags) ? b.tags.map(String) : s(b?.tags) ? s(b.tags).split(/[,\s]+/) : [];
const isEmptyBeat = (b) => !s(b.description) && !(b.choices || []).length;
const labeledChoices = (b) => (b.choices || []).filter(ch => s(ch?.label));
const routeTargets = (b) => {                          // [target, via] pairs the engine will runBeat()
  const out = [];
  if (s(b.next)) out.push([s(b.next), "next"]);
  for (const [i, ch] of (b.choices || []).entries()) {
    if (!ch) continue;
    if (s(ch.next)) out.push([s(ch.next), `choice[${i}].next`]);
    if (s(ch.checkStat)) {                                     // fail edges exist only when a check exists
      if (s(ch.failNext)) out.push([s(ch.failNext), `choice[${i}].failNext`]);
      else if (s(b.outcomes?.failure)) out.push([s(b.outcomes.failure), `choice[${i}] fail→outcomes.failure`]);
    }
  }
  if (s(b.phaseEntry?.to)) out.push([s(b.phaseEntry.to), "phaseEntry.to"]);
  if (s(b.handoff?.beatId)) {                                  // handoff posts the HUB's choices as GM-clicked doors; the hub itself never runs
    const hub = byId.get(s(b.handoff.beatId));
    if (hub) for (const [j, d] of (hub.choices || []).entries()) if (s(d?.next)) out.push([s(d.next), `handoff door[${j}] "${d.label || ""}"`]);
  }
  if (s(b.offerQuest?.acceptBeatId)) out.push([s(b.offerQuest.acceptBeatId), "offerQuest.acceptBeatId"]);
  for (const k of ["onCaught", "onEscaped"]) {
    const v = b.chase?.[k]; const id = typeof v === "string" ? v : v?.beatId; if (s(id)) out.push([s(id), `chase.${k}`]);
    const fu = v?.followUp; const fid = typeof fu === "string" ? fu : fu?.beatId; if (s(fid)) out.push([s(fid), `chase.${k}.followUp`]);
  }
  return out;
};

// ── G01 duplicate ids ───────────────────────────────────────────────────────
for (const b of beats) {
  const id = s(b?.id);
  if (!id) { F("G01", "ERROR", null, `beat with no id (label "${b?.label || ""}")`); continue; }
  if (byId.has(id)) F("G01", "ERROR", id, `duplicate beat id`);
  byId.set(id, b);
}
const exists = (id) => byId.has(s(id));

// ── G02 dangling refs + incoming graph ──────────────────────────────────────
const incoming = new Map();                  // id → [{from, via}]
const addIn = (to, from, via) => { if (!incoming.has(to)) incoming.set(to, []); incoming.get(to).push({ from, via }); };
for (const b of beats) {
  for (const [to, via] of routeTargets(b)) {
    if (!exists(to)) F("G02", "ERROR", b.id, `${via} → '${to}' does not exist`);
    else addIn(to, b.id, via);
  }
  if (s(b.handoff?.beatId) && !exists(b.handoff.beatId)) F("G02", "ERROR", b.id, `handoff.beatId → '${b.handoff.beatId}' does not exist`);
  for (const [i, ch] of (b.choices || []).entries()) if (ch && !s(ch.checkStat) && s(ch.failNext) && !exists(ch.failNext)) F("G02", "WARN", b.id, `choice[${i}].failNext → '${ch.failNext}' does not exist (edge is dead anyway — no checkStat)`);
  for (const row of (Array.isArray(b.worldEffects?.questEffects) ? b.worldEffects.questEffects : [])) {
    if (s(row?.beatId) && !exists(row.beatId)) F("G02", "WARN", b.id, `questEffects.beatId '${row.beatId}' names no beat (mark key still written; beatMark gates must spell it the same)`);
  }
}
if (s(campaign.openingBeatId) && !exists(campaign.openingBeatId)) F("G02", "ERROR", null, `campaign.openingBeatId '${campaign.openingBeatId}' does not exist`);
const hexOnEnter = new Map();   // beatId → drawing uuid (campaign.hexOverrides; the live scene flags may hold MORE)
for (const [uuid, ov] of Object.entries(campaign.hexOverrides || {})) {
  const bid = s(ov?.onEnterBeatId); if (!bid) continue;
  if (!exists(bid)) F("G02", "ERROR", null, `hexOverrides ${uuid}.onEnterBeatId '${bid}' does not exist`);
  else { hexOnEnter.set(bid, uuid); addIn(bid, `hex:${uuid}`, "onEnter"); }
}
// npcPlacements rules[].when share the gate grammar (module.js evaluates them via _beatRequiresMet)
for (const pl of (Array.isArray(campaign.npcPlacements) ? campaign.npcPlacements : Object.values(campaign.npcPlacements || {}))) {
  for (const [ri, rule] of (Array.isArray(pl?.rules) ? pl.rules : []).entries()) {
    for (const c of (Array.isArray(rule?.when) ? rule.when : [])) {
      if (!c || typeof c !== "object") continue;
      const tag = `placement ${pl.actorId} rule[${ri}]`;
      if (c.questBucket != null) {
        const bucket = s(c.is == null && c.isNot != null ? c.isNot : c.is);
        if (!QUEST_BUCKETS.has(bucket)) F("P05", "ERROR", null, `${tag}: questBucket bucket '${bucket || "(missing)"}' unknown — rule never matches`);
        if (quests && !quests[s(c.questBucket)]) F("P05", "ERROR", null, `${tag}: quest '${c.questBucket}' not in registry`);
      } else if (c.beatMark == null && !(s(c.flag) in GATE_FLAGS)) F("P01", "ERROR", null, `${tag}: unknown gate flag '${c.flag}' — rule never matches`);
    }
    if (!s(rule?.sceneId) && !s(rule?.sceneName)) F("E06", "WARN", null, `placement ${pl.actorId} rule[${ri}] has neither sceneId nor sceneName`);
  }
}

// ── E01 engine-held ids ─────────────────────────────────────────────────────
for (const [id, why] of Object.entries(ENGINE_IDS)) if (!exists(id)) F("E01", "ERROR", id, `engine-held id missing from data (${why}) — the engine's wiring points at nothing`);
for (const [id, why] of Object.entries(ENGINE_SOFT_IDS)) if (!exists(id)) F("E01", "WARN", id, `engine hub/boundary id missing (${why}) — visualizer degrades`);
for (const id of CADENCE_OUTCOME_IDS) if (!exists(id)) F("E01", "WARN", id, `cadence outcome id missing — CADENCE_OUTCOME_FLAGS will never write its flag`);

// ── tables: T01–T03 (+ reachability roots) ──────────────────────────────────
const tableRoots = new Set();
if (tables) {
  for (const [tid, t] of Object.entries(tables)) {
    const entries = Array.isArray(t?.entries) ? t.entries : [];
    let eligible = 0;
    for (const [i, e] of entries.entries()) {
      const bid = s(e?.beatId), cid = s(e?.campaignId);
      if (!bid) { F("T01", "ERROR", null, `table '${tid}' entry[${i}] has no beatId`, { table: tid }); continue; }
      if (cid && cid !== s(campaign.id)) { F("T01", "WARN", null, `table '${tid}' entry '${bid}' targets campaign '${cid}' (this campaign is '${campaign.id}')`, { table: tid }); continue; }
      if (!exists(bid)) { F("T01", "ERROR", null, `table '${tid}' entry '${bid}' does not exist`, { table: tid }); continue; }
      if (!(Number(e.weight) > 0)) { F("T01", "WARN", null, `table '${tid}' entry '${bid}' has weight ${e.weight} — can never be picked`, { table: tid }); continue; }
      eligible++; tableRoots.add(bid); addIn(bid, `table:${tid}`, "table");
      for (const k of Object.keys(e.conditions || {})) if (!TABLE_COND_KEYS.has(k)) F("T02", "INFO", null, `table '${tid}' entry '${bid}' condition '${k}' is not evaluated by runRandomTable (only ${[...TABLE_COND_KEYS].join("/")}) — table choice happens by id upstream`, { table: tid });
    }
    if (!eligible) F("T03", "ERROR", null, `table '${tid}' has no eligible entries`, { table: tid });
  }
}

// ── reachability: G03 ───────────────────────────────────────────────────────
// roots: opener, engine ids, tables, director-eligible (storyChain/questRole/requires),
// dialogue-offerable (speaker + labeled choices), hex onEnter (LIVE ONLY — unknowable here)
const rootReason = new Map();
const root = (id, why) => { if (exists(id) && !rootReason.has(id)) rootReason.set(id, why); };
root(s(campaign.openingBeatId), "opener");
for (const id of hexOnEnter.keys()) root(id, "hex-onEnter");
for (const id of Object.keys(ENGINE_IDS)) root(id, "engine");
for (const id of Object.keys(ENGINE_SOFT_IDS)) root(id, "engine-hub");
for (const id of tableRoots) root(id, "table");
for (const b of beats) {
  const chain = b.storyChain || b.inject?.storyChain;
  if (chain) root(b.id, `director:${chain}`);                    // _storyBeatsFor: storyChain beats ONLY
  if (tagsOf(b).includes("inject.travel_threshold")) root(b.id, "injector");   // _matchesTravelThreshold
  if (s(b.speakerActorId) && labeledChoices(b).length && b.dialogueOffer !== false) root(b.id, "dialogue");
  if (s(b.targetHexUuid) || tagsOf(b).some(t => /^discovery$|onenter|on-enter|arrival/i.test(t))) root(b.id, "hex-arrival");
  if (b.questRole === "start") root(b.id, "quest-start");        // acceptance prompt / visualizer fresh route
}
// hex.<slug> tags → on-enter entry (wire-hex-onenter-from-tags rule: sole claimant, else the questRole:start claimant)
{
  const claims = new Map();
  for (const b of beats) for (const t of tagsOf(b)) if (t.startsWith("hex.")) { if (!claims.has(t)) claims.set(t, []); claims.get(t).push(b); }
  for (const [t, list] of claims) {
    const entry = list.length === 1 ? list[0] : list.find(b => b.questRole === "start");
    if (entry) { root(entry.id, `hex-tag:${t}`); addIn(entry.id, `hex-tag:${t}`, "onEnter"); }
    else F("G03", "INFO", null, `${t} is claimed by ${list.length} beats and none is questRole:start — on-enter wiring can't pick an entry (${list.map(b => b.id).join(", ")})`);
  }
}
// quest-order (visualizer hero): with no authored route, the GM is offered the next ready unfired
// beat of the SAME quest by questStep — so consecutive steps form a chain. Edges are "hero" edges.
const heroEdges = new Map();
for (const [q, list] of (() => { const m = new Map(); for (const b of beats) { const qid = s(b.questId); if (!qid) continue; if (!m.has(qid)) m.set(qid, []); m.get(qid).push(b); } return m; })()) {
  const stepped = list.filter(b => isNum(b.questStep)).sort((a, b) => Number(a.questStep) - Number(b.questStep));
  for (let i = 0; i + 1 < stepped.length; i++) { const from = stepped[i].id, to = stepped[i + 1].id; if (!heroEdges.has(from)) heroEdges.set(from, []); heroEdges.get(from).push(to); addIn(to, from, "quest-order"); }
  if (stepped.length && !stepped.some(b => b.questRole === "start")) root(stepped[0].id, `quest-order:${q}`);   // lowest step is where the hero starts
}
const reach = new Set(rootReason.keys());
{ const q = [...reach]; while (q.length) { const id = q.shift(); const nexts = routeTargets(byId.get(id)).map(([to]) => to).concat(heroEdges.get(id) || []); for (const to of nexts) if (exists(to) && !reach.has(to)) { reach.add(to); q.push(to); } } }
for (const b of beats) {
  if (reach.has(b.id)) continue;
  if (isEmptyBeat(b)) F("G03", "INFO", b.id, `DEAD — unreachable and empty (safe to archive)`);
  else if (/^enc_/.test(b.id) || b.type === "encounter" || b.type === "travel") F("G03", "WARN", b.id, `STRANDED travel/encounter beat — no table entry routes here in the tables file given (export a FRESH bundle; live tables/hex on-enter may differ)`);
  else F("G03", "WARN", b.id, `STRANDED — no surface reaches it: not routed, not quest-ordered, no storyChain, not injector/discovery/hex-tagged, not offerable, no table/hexOverride entry in the files given — GM manual fire only (live hex on-enter flags may differ)`);
}
// G04 self-route
for (const b of beats) for (const [to, via] of routeTargets(b)) if (to === b.id) F("G04", "INFO", b.id, `${via} routes to itself (hub loop)`);

// ── phase ladder: P01–P07 ───────────────────────────────────────────────────
const setters = new Map();     // phase → [beatId]
for (const b of beats) {
  const pa = b.worldEffects?.phaseAdvance;
  if (pa == null) continue;
  const set = Number(pa.set);
  if (!Number.isInteger(set) || set < 1 || set > PHASE_MAX) { F("E05", "ERROR", b.id, `phaseAdvance.set = ${JSON.stringify(pa.set)} is not an integer 1..${PHASE_MAX}`); continue; }
  if (!setters.has(set)) setters.set(set, []);
  setters.get(set).push(b.id);
  const own = phaseOf(b);
  if (own != null && own > set) F("P03", "ERROR", b.id, `sets phase ${set} but is gated storyPhase ≥ ${own} — can never fire before the act it opens`);
  if (!reach.has(b.id)) F("P03", "ERROR", b.id, `phase ${set} setter is unreachable`);
}
for (let p = 1; p <= PHASE_MAX; p++) if (!setters.has(p)) F("P03", "WARN", null, `no beat sets storyPhase ${p} (calendar hard door is the only way in)`);

for (const b of beats) {
  const conds = condsOf(b);
  const raw = b.inject?.requires;
  if (raw && !Array.isArray(raw) && typeof raw !== "object") F("P01", "ERROR", b.id, `inject.requires is ${typeof raw}, not an array of conditions`);
  for (const c of conds) {
    if (c.questBucket != null) {
      const negated = c.is == null && c.isNot != null;
      const bucket = s(negated ? c.isNot : c.is);
      if (!QUEST_BUCKETS.has(bucket)) F("P05", "ERROR", b.id, `questBucket gate bucket '${bucket || "(missing is/isNot)"}' unknown — treated as unmet forever`);
      if (quests && !quests[s(c.questBucket)]) F("P05", "ERROR", b.id, `questBucket gate names quest '${c.questBucket}' which is not in the quest registry`);
      continue;
    }
    if (c.beatMark != null) {
      const q = s(c.quest), want = s(c.state) || "seen";
      if (!q) { F("P06", "ERROR", b.id, `beatMark gate missing 'quest'`); continue; }
      if (want !== "seen" && want !== "completed") { F("P06", "ERROR", b.id, `beatMark gate state '${c.state}' unknown (seen|completed)`); continue; }
      if (quests && !quests[q]) F("P06", "ERROR", b.id, `beatMark gate names quest '${q}' not in registry`);
      // a writer = any questEffects row for quest q carrying beatId == mark with sufficient state
      const writers = [];
      for (const w of beats) for (const row of (Array.isArray(w.worldEffects?.questEffects) ? w.worldEffects.questEffects : []))
        if (s(row?.questId) === q && (s(row?.beatId) || w.id) === s(c.beatMark)) writers.push({ w: w.id, state: s(row.state) });   // engine: row.beatId || beat.id
      if (!writers.length) F("P06", "ERROR", b.id, `beatMark '${c.beatMark}' (quest ${q}) is never written — no questEffects row with that beatId/questId`);
      else if (!writers.some(x => want === "seen" ? (x.state === "seen" || x.state === "completed") : x.state === "completed"))
        F("P06", "ERROR", b.id, `beatMark '${c.beatMark}' wants '${want}' but writers only set state ${JSON.stringify([...new Set(writers.map(x => x.state || "(empty)"))])}`);
      continue;
    }
    const flag = s(c.flag);
    if (!(flag in GATE_FLAGS)) { F("P01", "ERROR", b.id, `unknown gate flag '${flag || "(none)"}' — _resolveGateValue returns null → unmet forever`); continue; }
    if (c.gte == null && c.lte == null && c.eq == null) F("P02", "WARN", b.id, `gate on '${flag}' has no gte/lte/eq — always passes`);
    const [lo, hi] = GATE_FLAGS[flag];
    for (const k of ["gte", "lte", "eq"]) {
      if (c[k] == null) continue;
      if (!isNum(c[k])) { F("P02", "ERROR", b.id, `gate ${flag} ${k} ${JSON.stringify(c[k])} is not numeric`); continue; }
      const v = Number(c[k]);
      if (v < lo || (hi != null && v > hi)) F("P02", "WARN", b.id, `gate ${flag} ${k} ${v} outside the meter's band [${lo}..${hi ?? "∞"}] — ${k === "gte" && hi != null && v > hi ? "can never pass" : "check intent"}`);
      if (k === "eq" && typeof c.eq === "string") F("P02", "ERROR", b.id, `gate ${flag} eq "${c.eq}" is a STRING — engine compares with === against a number, never passes`);
    }
    if (GM_DRIVEN_FLAGS.has(flag)) F("P05", "INFO", b.id, `gate '${flag}' is raised by the GM by hand today (no engine setter) — plan to set it during the playtest`);
  }
}
// reachAct: the earliest act a beat can actually be reached in — max(own gate, min over routes in)
// (roots start at their own gate; fixpoint relaxation over the routing graph)
const reachAct = new Map();
for (const id of reach) reachAct.set(id, rootReason.has(id) ? (phaseOf(byId.get(id)) ?? 0) : Infinity);
for (let iter = 0, changed = true; changed && iter < 50; iter++) {
  changed = false;
  for (const id of reach) {
    const b = byId.get(id), own = phaseOf(b) ?? 0;
    let best = rootReason.has(id) ? own : Infinity;
    for (const x of (incoming.get(id) || [])) if (byId.has(x.from) && reachAct.has(x.from) && x.via !== "quest-order") best = Math.min(best, Math.max(own, reachAct.get(x.from)));
    for (const x of (incoming.get(id) || [])) if (x.via === "quest-order" && byId.has(x.from) && reachAct.has(x.from)) best = Math.min(best, Math.max(own, reachAct.get(x.from)));
    if (best < reachAct.get(id)) { reachAct.set(id, best); changed = true; }
  }
}
const routeAct = new Map();   // like reachAct but ROUTING edges only (no quest-order) — what P07 means by "fires from"
for (const id of reach) routeAct.set(id, rootReason.has(id) && !rootReason.get(id).startsWith("quest-order") ? (phaseOf(byId.get(id)) ?? 0) : Infinity);
for (let iter = 0, changed = true; changed && iter < 50; iter++) {
  changed = false;
  for (const id of reach) {
    const own = phaseOf(byId.get(id)) ?? 0; let best = routeAct.get(id);
    for (const x of (incoming.get(id) || [])) if (x.via !== "quest-order" && byId.has(x.from) && routeAct.has(x.from)) best = Math.min(best, Math.max(own, routeAct.get(x.from)));
    if (best < routeAct.get(id)) { routeAct.set(id, best); changed = true; }
  }
}
// P07 direct routing across acts (gates are NOT enforced on runBeat)
for (const b of beats) {
  const ra = routeAct.get(b.id);
  if (phaseOf(b) == null && !(Number.isFinite(ra))) continue;          // ungated + only quest-ordered/GM-launched: no routing act to compare
  const from = Number.isFinite(ra) ? ra : phaseOf(b);
  for (const [to, via] of routeTargets(b)) {
    if (!exists(to) || via.startsWith("handoff")) continue;
    const t = byId.get(to), tp = phaseOf(t);
    if (tp != null && (from == null || tp > from)) {
      const setsIt = Number(t.worldEffects?.phaseAdvance?.set) === tp;
      const jump = tp - (from ?? 0), advances = !!t.worldEffects?.phaseAdvance;
      if (!setsIt) F("P07", (jump >= 2 || advances) ? "WARN" : "INFO", b.id, `${via} → '${to}' is gated storyPhase ≥ ${tp} but routing ignores gates — fires from Act ${from ?? "—"}${phaseOf(b) == null ? " (ungated beat, act inferred from routes in)" : ""} anyway${advances ? " (and ADVANCES the phase)" : ""}${jump >= 2 ? ` (jumps ${jump} acts)` : ""}`);
    }
  }
}
// P04 redundant gate (all predecessors already sit at or above the gate)
for (const b of beats) {
  const own = phaseOf(b); if (own == null || own === 0) continue;
  const ins = (incoming.get(b.id) || []).filter(x => byId.has(x.from));
  if (!ins.length || rootReason.has(b.id)) continue;
  if (ins.every(x => (phaseOf(byId.get(x.from)) ?? -1) >= own)) F("P04", "INFO", b.id, `storyPhase ≥ ${own} gate is redundant — every route in already sits at Act ${own}+`);
}

// ── choices: C01–C07 ────────────────────────────────────────────────────────
for (const b of beats) {
  for (const [i, ch] of (b.choices || []).entries()) {
    if (!ch || typeof ch !== "object") { F("C04", "ERROR", b.id, `choice[${i}] is not an object`); continue; }
    if (!s(ch.label)) F("C04", "WARN", b.id, `choice[${i}] has no label (dialogue surfaces skip unlabeled choices; beat may be unofferable)`);
    const stat = s(ch.checkStat).toLowerCase();
    if (stat) {
      if (stat.startsWith("op.")) {
        const key = stat.slice(3);
        if (!OP_KEYS.includes(key)) F("C01", "ERROR", b.id, `choice[${i}] "${ch.label}" checkStat '${ch.checkStat}' — '${key}' is not an OP channel (${OP_KEYS.join("/")}); pays from a phantom bank → blocked or negative marks`);
      } else if (!CHECK_STATS.has(stat)) {
        F("C02", "WARN", b.id, `choice[${i}] "${ch.label}" checkStat '${ch.checkStat}' not in the engine's label map — GM adjudication with the raw string as the label`);
      }
      if (!isNum(ch.checkDC)) F("C03", "WARN", b.id, `choice[${i}] "${ch.label}" has a check but checkDC ${JSON.stringify(ch.checkDC)} is not numeric (shows DC 0)`);
      const fail = s(ch.failNext) || s(b.outcomes?.failure);
      if (!fail) F("C05", "WARN", b.id, `choice[${i}] "${ch.label}" check has no failNext and no outcomes.failure — failure is a dead end`);
      else if (!s(ch.failNext) && !exists(fail)) F("C05", "WARN", b.id, `choice[${i}] "${ch.label}" failure falls back to outcomes.failure '${fail}' which is not a beat id (outcomes also serve as scene/resolution keys — the fail path will warn 'Beat not found')`);
      if (s(ch.failNext) && s(ch.failNext) === s(ch.next)) F("C06", "INFO", b.id, `choice[${i}] "${ch.label}" failNext === next — the check is cosmetic`);
      if (ch.checkMode != null) F("C07", "INFO", b.id, `choice[${i}] checkMode '${ch.checkMode}' is ignored since 2026-08-30 (every non-OP check goes to the table)`);
    } else if (s(ch.failNext) && s(ch.failNext) !== s(ch.next)) {
      F("C05", "WARN", b.id, `choice[${i}] "${ch.label}" has failNext but no checkStat — failNext can never be taken`);
    }
    if (!s(ch.next) && !s(ch.failNext)) F("C05", "INFO", b.id, `choice[${i}] "${ch.label}" routes nowhere (terminal choice)`);
    const ss = ch.supportSpend ?? ch.support?.spend;
    if (ss != null && ss !== "" && (!Number.isInteger(Number(ss)) || Number(ss) % 10 !== 0)) F("C08", "WARN", b.id, `choice[${i}] "${ch.label}" supportSpend ${JSON.stringify(ss)} — backing is MARKS in steps of 10 (+2 per 10)`);
  }
}

// ── C09 no-exit menus (mirrors the engine boot beat-lint, module.js ~8013): every labeled choice checked → a failed
//    roll re-offers the trap. Doctrine (patch-no-exit-menus 2026-08-28): add an UNCHECKED exit that costs time or collapses
//    into the bad outcome — never one strictly better than rolling.
for (const b of beats) {
  const lc = labeledChoices(b);
  if (lc.length && lc.every(ch => s(ch.checkStat))) F("C09", "WARN", b.id, `no-exit menu — all ${lc.length} choices are checked; add an unchecked exit (slow lane costing timePoints, or the existing bad outcome)`);
}

// ── quests: Q01–Q08 ─────────────────────────────────────────────────────────
const questBeats = new Map();  // questId → beats
for (const b of beats) {
  const q = s(b.questId); if (!q) continue;
  if (!questBeats.has(q)) questBeats.set(q, []);
  questBeats.get(q).push(b);
  if (quests && !quests[q]) F("Q01", "ERROR", b.id, `questId '${q}' is not in the quest registry`);
}
const accepted = new Set(), completed = new Set();
for (const b of beats) {
  const rows = b.worldEffects?.questEffects;
  if (rows == null) continue;
  if (!Array.isArray(rows)) { F("E03", "ERROR", b.id, `worldEffects.questEffects is ${typeof rows}, not an array — silently dropped`); continue; }
  for (const [i, row] of rows.entries()) {
    const action = s(row?.action).toLowerCase() || "accept", q = s(row?.questId);
    if (!q) { F("Q02", "ERROR", b.id, `questEffects[${i}] has no questId`); continue; }
    if (quests && !quests[q]) F("Q02", "ERROR", b.id, `questEffects[${i}] names quest '${q}' not in registry`);
    if (!QUEST_ACTIONS.has(action)) F("Q02", "ERROR", b.id, `questEffects[${i}] action '${row.action}' unknown (${[...QUEST_ACTIONS].join("/")})`);
    if (action === "accept") accepted.add(q);
    if (action.startsWith("complete")) completed.add(q);
  }
  if (s(b.offerQuest?.questId)) accepted.add(s(b.offerQuest.questId));
}
for (const [q, list] of questBeats) {
  const name = quests?.[q]?.name ? `${quests[q].name} (${q})` : q;
  const starts = list.filter(b => b.questRole === "start"), res = list.filter(b => b.questRole === "resolution");
  if (!starts.length) F("Q03", "INFO", null, `quest ${name}: no questRole:start beat among ${list.length} beats`, { quest: q });
  if (starts.length > 1) F("Q03", "WARN", null, `quest ${name}: ${starts.length} start beats (${starts.map(b => b.id).join(", ")})`, { quest: q });
  if (!res.length) F("Q03", "INFO", null, `quest ${name}: no questRole:resolution beat`, { quest: q });
  if (!accepted.has(q) && !starts.length) F("Q06", "WARN", null, `quest ${name}: ${list.length} beats but no questRole:start beat, no questEffects accept, no offerQuest — nothing in data starts it (GM/quest-log only)`, { quest: q });
  if (accepted.has(q) && !completed.has(q)) F("Q07", "INFO", null, `quest ${name}: accepted but never completed by any questEffects row`, { quest: q });
  const stepped = list.filter(b => isNum(b.questStep)).sort((a, b) => Number(a.questStep) - Number(b.questStep));
  const seen = new Map();
  for (const b of stepped) { const k = Number(b.questStep); if (seen.has(k)) F("Q04", "WARN", b.id, `quest ${name}: questStep ${k} duplicates '${seen.get(k)}' — hero/visualizer order is ambiguous`, { quest: q }); else seen.set(k, b.id); }
  { // anchors: a step whose act gate is HIGHER than some later step's — report the anchor once
    const gated = stepped.filter(b => phaseOf(b) != null);
    for (let i = 0; i < gated.length; i++) {
      const a = gated[i], ap = phaseOf(a);
      const later = gated.slice(i + 1).filter(b => phaseOf(b) < ap);
      if (!later.length) continue;
      const alreadyCovered = gated.slice(0, i).some(x => phaseOf(x) >= ap);      // an earlier anchor already reported this
      if (alreadyCovered) continue;
      const acts = [...new Set(later.map(b => phaseOf(b)))].sort().join("/");
      F("Q05", "WARN", a.id, `quest ${name}: step ${a.questStep} is gated Act ${ap} but ${later.length} LATER step${later.length > 1 ? "s" : ""} (${later.slice(0, 3).map(b => b.questStep).join(", ")}${later.length > 3 ? "…" : ""}) are gated Act ${acts} — quest order and act ladder disagree`, { quest: q });
    }
  }
  if (starts.length === 1 && stepped.length && isNum(starts[0].questStep) && Number(starts[0].questStep) !== Number(stepped[0].questStep)) F("Q08", "INFO", starts[0].id, `quest ${name}: start beat has questStep ${starts[0].questStep} but '${stepped[0].id}' has the lowest (${stepped[0].questStep})`, { quest: q });
}
if (quests) for (const [q, qd] of Object.entries(quests)) if (!questBeats.has(q) && !accepted.has(q)) F("Q06", "INFO", null, `registry quest "${qd?.name || q}" (${q}) has no beats and is never accepted`, { quest: q });

// ── seals & acceptance: S01–S04, Q09–Q10 (2026-09-09, after the Lyrenn East Channels stall) ──
{
  // Q09: a beat gated on `questBucket is active` for a quest that NO beat ever accepts.
  const acceptors = new Map();   // questId → [beatId]
  for (const b of beats) for (const row of (b.worldEffects?.questEffects || [])) {
    if (String(row?.action || "") === "accept" && s(row.questId)) { if (!acceptors.has(s(row.questId))) acceptors.set(s(row.questId), []); acceptors.get(s(row.questId)).push(b.id); }
  }
  const warnedQ = new Set();
  for (const b of beats) for (const c of condsOf(b)) {
    if (c.questBucket == null || s(c.is) !== "active") continue;
    const q = s(c.questBucket); if (acceptors.has(q) || warnedQ.has(q)) continue;
    warnedQ.add(q);
    F("Q09", "ERROR", b.id, `gated on quest '${quests?.[q]?.name || q}' being ACTIVE, but no beat has a questEffects accept for it — unreachable by play (Reset Console / GM only)`);
  }
  // Q10: an acceptance beat that accepts nothing, or a different quest than its own.
  for (const b of beats) {
    if (!/acceptance/i.test(s(b.id)) && !/quest acceptance/i.test(s(b.label))) continue;
    const own = s(b.questId);
    const acc = (b.worldEffects?.questEffects || []).filter(r => String(r?.action || "") === "accept").map(r => s(r.questId));
    if (!acc.length) F("Q10", "ERROR", b.id, `acceptance beat accepts NO quest (own quest ${quests?.[own]?.name || own || "(none)"})`);
    else if (own && !acc.includes(own)) F("Q10", "ERROR", b.id, `acceptance beat accepts ${acc.map(q => quests?.[q]?.name || q).join(", ")} but belongs to '${quests?.[own]?.name || own}'`);
  }
  // S01: a route DOWN the act ladder — once the source's act is open the target is sealed (unless inject.evergreen).
  let down = 0;
  for (const b of beats) {
    const from = phaseOf(b); if (from == null || from < 2) continue;
    for (const [to, via] of routeTargets(b)) {
      const t = byId.get(s(to)); if (!t) continue;
      const tp = phaseOf(t); if (tp == null || tp < 1 || tp >= from || t.inject?.evergreen === true) continue;
      // phaseEntry = { belowPhase: N, to } redirects ONLY while storyPhase < N — safe when N ≤ target act + 1 (the target is never sealed when the redirect fires).
      if (/^phaseEntry/.test(String(via)) && isNum(b.phaseEntry?.belowPhase) && Number(b.phaseEntry.belowPhase) <= tp + 1) continue;
      down++;
      F("S01", "WARN", b.id, `${via} → '${to}' (${t.label || to}) is Act ${tp} content — SEALED once Act ${from} opens; route to an Act-${from} hub or set inject.evergreen`);
    }
  }
  // S02: a "ride" choice that does not open travel — a letter teleporting the party.
  for (const b of beats) for (const [i, ch] of (b.choices || []).entries()) {
    if (!/^(🐎|ride (for|to|back|home|out|on)\b|saddle)/i.test(s(ch?.label))) continue;   // travel verbs only — not "ride the surge"/"ride it backward"
    const t = byId.get(s(ch.next)); if (!t) continue;
    if (!t.worldEffects?.openTravel && t.type !== "travel" && !/travel/i.test(s(t.tags))) F("S02", "WARN", b.id, `choice[${i}] "${ch.label}" → '${ch.next}' has no openTravel — the party arrives without a travel leg`);
  }
  // S03: hex arrival with a single act-gated beat and no per-act list.
  for (const [uuid, rec] of Object.entries(campaign.hexOverrides || {})) {
    if (Array.isArray(rec?.onEnterBeatIds)) continue;
    const bid = s(rec?.onEnterBeatId || rec?.beatId); const t = byId.get(bid); if (!t) continue;
    const tp = phaseOf(t); if (tp == null) continue;
    F("S03", "INFO", bid, `hexOverride ${uuid} arrives on an Act-${tp} beat only — arrivals in other acts get nothing (use onEnterBeatIds: [act-N hub, ...])`);
  }
}

// ── effects: E02–E14 ────────────────────────────────────────────────────────
const arrayKeys = ["factionEffects", "relationshipEffects", "worldModifiers", "turnRequests", "purifyHexes"];
const ladder = [];
for (const b of beats) {
  const we = b.worldEffects;
  if (we == null) continue;
  if (Array.isArray(we)) { if (we.length) F("E03", "ERROR", b.id, `worldEffects is a NON-EMPTY array — WME reads keys off an object; all ${we.length} entries are dropped`); else F("E03", "INFO", b.id, `worldEffects is [] (editor default; harmless)`); continue; }
  if (typeof we !== "object") { F("E03", "ERROR", b.id, `worldEffects is ${typeof we}`); continue; }
  for (const k of arrayKeys) if (we[k] != null && !Array.isArray(we[k])) F("E03", "ERROR", b.id, `worldEffects.${k} is ${typeof we[k]} (${JSON.stringify(we[k]).slice(0, 40)}…) — WME requires an array; silently dropped`);
  { // duplicate identical rows STACK — WME applies each row (verified by the 2026-09-06 walk: observed = Σ rows)
    const seen = new Map();
    for (const row of (Array.isArray(we.factionEffects) ? we.factionEffects : [])) { const k = JSON.stringify(row); seen.set(k, (seen.get(k) || 0) + 1); }
    for (const [k, n] of seen) if (n > 1) { const r = JSON.parse(k); const live = Object.entries(r).filter(([kk, v]) => /Delta$/.test(kk) && Number(v)).map(([kk, v]) => `${kk.replace("Delta", "")} ${v > 0 ? "+" : ""}${v}`).concat(Object.entries(r.opDeltas || {}).filter(([, v]) => Number(v)).map(([kk, v]) => `op.${kk} ${v > 0 ? "+" : ""}${v}`)); if (live.length) F("E02", "WARN", b.id, `factionEffects has ${n} IDENTICAL rows on faction '${r.factionId || "(default)"}' (${live.join(", ")}) — the engine applies every row, so this lands ×${n}`); }
  }
  for (const [i, row] of (Array.isArray(we.factionEffects) ? we.factionEffects : []).entries()) {
    if (!row || typeof row !== "object") { F("E02", "ERROR", b.id, `factionEffects[${i}] not an object`); continue; }
    if (s(row.factionId) && factionIds.size && !factionIds.has(normFid(row.factionId))) { const k = normFid(row.factionId); if (!foreignFactions.has(k)) foreignFactions.set(k, { n: 0, beats: new Set() }); const ff = foreignFactions.get(k); ff.n++; ff.beats.add(b.id); }
    for (const k of ["moraleDelta", "loyaltyDelta", "unityDelta", "darknessDelta", "vpDelta"]) if (row[k] != null && row[k] !== "" && !isNum(row[k])) F("E02", "WARN", b.id, `factionEffects[${i}].${k} = ${JSON.stringify(row[k])} not numeric`);
    for (const [ok, ov] of Object.entries(row.opDeltas || {})) {
      const nk = ok.toLowerCase().replace(/[_\s]/g, "");
      if (!OP_KEYS.includes(nk === "nonlethal" || nk === "softpower" ? nk : ok)) F("E02", "ERROR", b.id, `factionEffects[${i}].opDeltas key '${ok}' is not an OP channel`);
      if (!isNum(ov)) F("E02", "WARN", b.id, `factionEffects[${i}].opDeltas.${ok} = ${JSON.stringify(ov)} not numeric`);
      else if (!Number.isInteger(Number(ov))) F("E02", "ERROR", b.id, `factionEffects[${i}].opDeltas.${ok} = ${ov} is fractional — quantities are whole MARKS (owner ruling 2026-09-06)`);
      // marks are the unit everywhere — small integer opDeltas are intended (Momentum economy).
    }
    const anyDelta = ["moraleDelta","loyaltyDelta","unityDelta","darknessDelta","vpDelta"].some(k => Number(row[k]) !== 0 && isNum(row[k])) || Object.values(row.opDeltas || {}).some(v => Number(v) !== 0 && isNum(v)) || row.deferred || row.recurring;
    if (!anyDelta) F("E02", "INFO", b.id, `factionEffects[${i}] is all zeros (editor default noise)`);
  }
  for (const [i, r] of (Array.isArray(we.relationshipEffects) ? we.relationshipEffects : []).entries())
    if (!s(r?.target) || (r?.step == null && r?.setStatus == null)) F("E10", "WARN", b.id, `relationshipEffects[${i}] needs target + (step | setStatus)`);
  for (const [i, m] of (Array.isArray(we.worldModifiers) ? we.worldModifiers : []).entries())
    if (!s(m?.key)) F("E11", "WARN", b.id, `worldModifiers[${i}] has no key`);
  for (const [i, r] of (Array.isArray(we.turnRequests) ? we.turnRequests : []).entries())
    if (!s(r?.key)) F("E14", "WARN", b.id, `turnRequests[${i}] has no key — skipped by WME`);
  if (we.levelEffects != null) {
    const le = we.levelEffects;
    for (const [k, lo, hi] of [["stewardLevelFloor", 1, 20], ["factionTierFloor", 0, 6]]) {
      if (le[k] == null) continue;
      if (!isNum(le[k])) F("E04", "WARN", b.id, `levelEffects.${k} = ${JSON.stringify(le[k])} not numeric`);
      else if (Number(le[k]) < lo || Number(le[k]) > hi) F("E04", "WARN", b.id, `levelEffects.${k} = ${le[k]} outside [${lo}..${hi}]`);
    }
    ladder.push({ id: b.id, phase: phaseOf(b), lvl: Number(le.stewardLevelFloor) || null, tier: Number(le.factionTierFloor) || null });
  }
  if (we.tikkunDelta != null && !isNum(we.tikkunDelta.add)) F("E06", "WARN", b.id, `tikkunDelta.add ${JSON.stringify(we.tikkunDelta?.add)} not numeric — no-op`);
  if (we.openTravel != null && !s(we.openTravel.hexName)) F("E06", "WARN", b.id, `openTravel has no hexName — opens the travel console with no destination`);
  if (Array.isArray(we.purifyHexes) && we.purifyHexes.some(n => !s(n))) F("E06", "WARN", b.id, `purifyHexes contains an empty name`);
  if (we.territoryOutcome != null && !s(we.territoryOutcome)) F("E06", "INFO", b.id, `territoryOutcome is empty`);
}
for (const [fid, ff] of foreignFactions) F("E02", "INFO", null, `factionEffects target faction '${fid}' is not a campaign faction — ${ff.n} rows on ${ff.beats.size} beats (NPC/rival faction? confirm the Actor exists live)`);
{ // E04 ladder monotonic across acts
  const byPhase = ladder.filter(x => x.phase != null).sort((a, b) => a.phase - b.phase);
  let ml = 0, mt = 0;
  for (const x of byPhase) {
    if (x.lvl != null && x.lvl < ml) F("E04", "INFO", x.id, `stewardLevelFloor ${x.lvl} at Act ${x.phase} is below an earlier act's floor ${ml} — no-op`);
    if (x.tier != null && x.tier < mt) F("E04", "INFO", x.id, `factionTierFloor ${x.tier} at Act ${x.phase} is below an earlier act's floor ${mt} — no-op`);
    ml = Math.max(ml, x.lvl || 0); mt = Math.max(mt, x.tier || 0);
  }
}
for (const b of beats) {
  const sl = b.sparkLink;
  if (sl && typeof sl === "object") {
    const hasRef = s(sl.sparkUuid) || s(sl.sparkKey);
    if (hasRef && !SPARK_ACTIONS.has(s(sl.action))) F("E07", "WARN", b.id, `sparkLink.action '${sl.action}' not in ${[...SPARK_ACTIONS].join("/")} — tikkun listener does nothing`);
    if (!hasRef && SPARK_ACTIONS.has(s(sl.action))) F("E07", "WARN", b.id, `sparkLink.action '${sl.action}' but no sparkUuid/sparkKey`);
    if (s(sl.methodTag) && !OP_KEYS.includes(s(sl.methodTag).toLowerCase())) F("E07", "WARN", b.id, `sparkLink.methodTag '${sl.methodTag}' is not an OP channel`);
  }
  if (b.gateUnlocks != null) {
    if (!Array.isArray(b.gateUnlocks)) F("E08", "ERROR", b.id, `gateUnlocks is ${typeof b.gateUnlocks}, not an array`);
    else for (const [i, u] of b.gateUnlocks.entries()) {
      if (!s(u?.hexUuid)) F("E08", "ERROR", b.id, `gateUnlocks[${i}] has no hexUuid — skipped`);
      const a = s(u?.action).toLowerCase(); if (a && a !== "enable" && a !== "disable") F("E08", "WARN", b.id, `gateUnlocks[${i}] action '${u.action}' (enable|disable) — treated as enable`);
    }
  }
  if (b.unlocks != null && (typeof b.unlocks !== "object" || Array.isArray(b.unlocks) || Object.keys(b.unlocks).some(k => k !== "maneuvers" && k !== "strategics")))
    F("E09", "WARN", b.id, `unlocks should be {maneuvers:[], strategics:[]} — got ${JSON.stringify(b.unlocks).slice(0, 60)}`);
  if (b.type === "encounter" && !s(b.encounter?.key) && !s(b.encounterKey)) F("E12", "INFO", b.id, `type encounter but no encounter.key (falls back to id inference)`);
  if (b.encounter?.tier != null && b.encounter.tier !== "" && !isNum(b.encounter.tier)) F("E12", "WARN", b.id, `encounter.tier ${JSON.stringify(b.encounter.tier)} not numeric`);
  if (b.timePoints != null && b.timePoints !== "" && (!isNum(b.timePoints) || Number(b.timePoints) < 0)) F("E13", "WARN", b.id, `timePoints ${JSON.stringify(b.timePoints)} invalid`);
  if (b.timeScale != null && !TIME_SCALES.has(s(b.timeScale).toLowerCase())) F("E13", "WARN", b.id, `timeScale '${b.timeScale}' unknown — treated as 0 time`);
  if (b.handoff && !s(b.handoff.beatId)) F("E06", "WARN", b.id, `handoff has no beatId`);
  if (b.offerQuest && (!s(b.offerQuest.questId) || !s(b.offerQuest.acceptBeatId))) F("E06", "WARN", b.id, `offerQuest needs questId + acceptBeatId`);
  if (b.phaseEntry && (!s(b.phaseEntry.to) || !isNum(b.phaseEntry.belowPhase))) F("E06", "WARN", b.id, `phaseEntry needs {belowPhase:N, to:beatId}`);
}

// ── content: K01–K03 ────────────────────────────────────────────────────────
for (const b of beats) {
  if (reach.has(b.id) && isEmptyBeat(b) && ["dialog", "narration", "skill_scene", "custom"].includes(b.type)) {
    if (b.questRole === "start") F("K01", "INFO", b.id, `blank ${b.type} start beat — the quest-acceptance prompt is its only content`);
    else F("K01", "WARN", b.id, `reachable ${b.type} beat with no description and no choices — fires as a blank`);
  }
  if (s(b.speakerActorId) && b.dialogueOffer !== false) {
    if (!labeledChoices(b).length) { const routed = (incoming.get(b.id) || []).length > 0; F("K02", routed ? "INFO" : "WARN", b.id, routed ? `speaker beat with no labeled choices — reached by routing only, never offerable (fine for an outcome; set dialogueOffer:false to silence)` : `speaker beat with no labeled choices AND no incoming route — can neither be offered nor reached`); }
    if (!s(b.memoryText)) F("K03", "INFO", b.id, `speaker beat without memoryText — NPC memory falls back to the label`);
  }
}

// ─── report ─────────────────────────────────────────────────────────────────
const actOf = (id) => id && byId.has(id) ? phaseOf(byId.get(id)) : undefined;
for (const f of findings) f.act = f.beatId ? actOf(f.beatId) : null;
let shown = findings.filter(f => opt.info || f.sev !== "INFO");
if (opt.act != null) shown = shown.filter(f => !f.beatId || f.act === opt.act);
const sevRank = { ERROR: 0, WARN: 1, INFO: 2 };
shown.sort((a, b) => sevRank[a.sev] - sevRank[b.sev] || a.rule.localeCompare(b.rule) || String(a.beatId).localeCompare(String(b.beatId)));

const pad = (v, n) => String(v).padEnd(n);
console.log(`\nft-lint-campaign — "${campaign.label || campaign.id}" (${campaign.id})`);
console.log(`  campaign: ${sources.campaign}\n  quests:   ${sources.quests || "(none — Q01/Q02/P05/P06 registry checks skipped)"}\n  tables:   ${sources.tables || "(none — T01–T03 skipped; table-fired beats may show as STRANDED)"}`);
// per-act summary
const acts = new Map();
for (const b of beats) {
  const p = phaseOf(b), k = p == null ? "—" : String(p);
  if (!acts.has(k)) acts.set(k, { beats: 0, math: 0, speakers: new Set(), quests: new Set(), scenes: new Set(), reach: 0 });
  const a = acts.get(k); a.beats++; if (reach.has(b.id)) a.reach++;
  const we = b.worldEffects || {}; if (Object.keys(we).some(k2 => /faction|level|relationship|radiation|tikkun|territory|worldModifiers|turnRequests|quest|phase|purify/i.test(k2))) a.math++;
  if (s(b.speakerActorId)) a.speakers.add(s(b.speakerActorId)); if (s(b.questId)) a.quests.add(s(b.questId)); if (s(b.sceneId || b.scene)) a.scenes.add(s(b.sceneId || b.scene));
}
console.log(`\n  ${pad("act", 5)}${pad("beats", 7)}${pad("reach", 7)}${pad("w/effects", 11)}${pad("speakers", 10)}${pad("quests", 8)}scenes   setters`);
for (const k of [...acts.keys()].sort((a, b) => (a === "—") - (b === "—") || Number(a) - Number(b))) {
  const a = acts.get(k);
  console.log(`  ${pad(k, 5)}${pad(a.beats, 7)}${pad(a.reach, 7)}${pad(a.math, 11)}${pad(a.speakers.size, 10)}${pad(a.quests.size, 8)}${pad(a.scenes.size, 9)}${(setters.get(Number(k)) || []).join(", ")}`);
}
const tally = { ERROR: 0, WARN: 0, INFO: 0 }; for (const f of findings) tally[f.sev]++;
const shownTally = { ERROR: 0, WARN: 0, INFO: 0 }; for (const f of shown) shownTally[f.sev]++;
console.log(`\n  findings: ${tally.ERROR} ERROR · ${tally.WARN} WARN · ${tally.INFO} INFO   (showing ${shown.length}${opt.act != null ? ` for Act ${opt.act} + global` : ""}${opt.info ? "" : ", INFO hidden — add --info"})`);

const groups = new Map();
for (const f of shown) { const k = `${f.sev} ${f.rule}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(f); }
const LIMIT = opt.full ? Infinity : 12;
for (const [k, list] of groups) {
  console.log(`\n■ ${k}  ×${list.length}`);
  for (const f of list.slice(0, LIMIT)) console.log(`   ${f.beatId ? `[${f.act ?? "—"}] ${f.beatId}: ` : ""}${f.msg}`);
  if (list.length > LIMIT) console.log(`   … ${list.length - LIMIT} more (--full)`);
}
if (opt.json) { fs.writeFileSync(opt.json, JSON.stringify({ campaign: campaign.id, label: campaign.label, sources, tally, findings }, null, 2)); console.log(`\n  json → ${opt.json}`); }
console.log();
process.exit(tally.ERROR ? 1 : 0);

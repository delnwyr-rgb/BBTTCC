/* ============================================================================
 * Bad Eden — HEADLESS ACT WALKER (2026-09-05)
 * ----------------------------------------------------------------------------
 * Fires every beat of one act through the REAL engine — runBeat → executeBeat →
 * WME → questEffects → gates — inside a throwaway sandbox, and asserts what
 * landed. Layer 2 of the Act 2 test plan (layer 1 = bin/ft-lint-campaign).
 *
 *   EFFECTS pass   — each in-scope beat runs once with no choice taken
 *                    (ctx.__enactChoice out of range → _enactChoiceCore falls out,
 *                    no dialog, no routing; effects still apply). Asserts:
 *                    resolved · questEffects landed in the faction's buckets ·
 *                    phaseAdvance/tikkunDelta moved the meters · factionEffects
 *                    opDeltas/morale landed (or are reported as an ENGINE GAP if
 *                    api.factions.applyDelta is absent) · no console errors.
 *   TRANSITION pass — each labeled choice runs with ctx.__enactChoice = i (the
 *                    same path the dialogue engine uses). The routed beat's own
 *                    dialog is auto-CLOSED by the autopilot, so the chain stops
 *                    after exactly one hop. Asserts routed === choice.next.
 *                    Choices with a check run TWICE: forced PASS (d20 pinned to 20,
 *                    GM adjudication answered SUCCESS) and forced FAIL (d20 = 1,
 *                    FAIL) → asserts next / failNext; OP checks assert the −10
 *                    marks debit.
 *
 * SANDBOX (everything restored in finally, even on throw):
 *   · throwaway campaign = deep clone of the active one under a temp id, set
 *     active; temp coalition faction (OP bank seeded 20 marks/channel before every
 *     run) + temp steward; foreign factionIds in factionEffects remapped to temp
 *     "[WALK] foreign" actors so no real faction is touched
 *   · beats sanitized: audio/cinematic/chase/sparkLink/gateUnlocks removed;
 *     purifyHexes/openTravel/radiationDelta/territoryOutcome/turnRequests/
 *     relationshipEffects STRIPPED (recorded as "declared"); npcPlacements and
 *     hexOverrides emptied
 *   · live-touching APIs stubbed + recorded: encounter launchers/spawner,
 *     resolution.runResolution, territory.applyOutcome, world.addTime,
 *     transition.consumeDive, worldMutation.pullTableToScene, turn.enqueueRequest,
 *     Scene.prototype.activate/view
 *   · ALL bbttcc-campaign world settings snapshotted/restored (storyPhase forced to
 *     the act under test, directorState cleared), activeCampaignId restored,
 *     speaker NPC memories (flags.bbttcc-mal-voice.memories) restored, every chat
 *     message created during the run deleted (KEEP_CHAT to keep)
 *   · Dialog autopilot: beat choice dialogs → close; GM adjudication → verdict;
 *     yes/no → yes; Dialog.confirm → true; DialogV2 → default
 *
 * ⚠ GM client. Run with NO players connected — player-facing dialog broadcasts go
 *   over the socket and the run creates hundreds of transient cards. ~5–8 min for
 *   Act 2 (≈275 beats, ≈470 choices). Progress in console; summary card + JSON
 *   download at the end. Safe to re-run. Stop early: set window.__bbttccWalkStop = true.
 * ==========================================================================*/
(async () => {
  const CFG = {
    ACT: 2,                        // storyPhase gate value that defines the act
    INCLUDE_UNGATED_NEIGHBORS: true, // also walk ungated beats the act's choices route into (fail beats etc.)
    ONLY: null,                    // e.g. /^fixit_/ or ["beat_a","beat_b"] to narrow
    LIMIT: 0,                      // 0 = all
    TRANSITIONS: true,
    FAIL_PATHS: true,
    STEP_MS: 40,
    TIMEOUT_MS: 12000,
    DOWNLOAD: true,
    KEEP_CHAT: false
  };
  const NS = "bbttcc-campaign", FNS = "bbttcc-factions", TAG = "[walk]";
  const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
  const SEED_MARKS = 20;
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign;
  if (!api?.runBeat || !api?.setActiveCampaignId) return ui.notifications.error("Campaign API missing — deploy + F5 first.");
  const activeUsers = game.users.filter(u => u.active && !u.isGM);
  if (activeUsers.length) {
    const go = await Dialog.confirm({ title: "Headless walker", content: `<p><b>${activeUsers.length} player client(s) connected.</b> The walk broadcasts player-facing dialogs and floods chat. Continue anyway?</p>` });
    if (!go) return;
  }
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const s = (v) => String(v ?? "").trim();
  const isNum = (v) => v != null && v !== "" && Number.isFinite(Number(v));
  const startedAt = Date.now();
  window.__bbttccWalkStop = false;

  // ── Source campaign ──────────────────────────────────────────────────────────
  const liveCid = api.getActiveCampaignId();
  let rawCamps = game.settings.get(NS, "campaigns");
  const wasString = typeof rawCamps === "string";
  const camps = wasString ? JSON.parse(rawCamps) : foundry.utils.deepClone(rawCamps);
  const live = camps?.[liveCid];
  if (!live) return ui.notifications.error("No active campaign to walk.");
  const liveBeats = Array.isArray(live.beats) ? live.beats : Object.values(live.beats || {});
  const byId = new Map(liveBeats.map(b => [b.id, b]));
  const TEST_ID = `walk_${liveCid}_tmp`;

  // ── Scope ────────────────────────────────────────────────────────────────────
  const condsOf = (b) => { const r = b?.inject?.requires; if (!r) return []; return (Array.isArray(r) ? r : [r]).filter(c => c && typeof c === "object"); };
  const phaseOf = (b) => { let p = null; for (const c of condsOf(b)) if (c.flag === "storyPhase" && isNum(c.gte)) p = Math.max(p ?? -1, Number(c.gte)); return p; };
  const only = (id) => !CFG.ONLY ? true : (CFG.ONLY instanceof RegExp ? CFG.ONLY.test(id) : (Array.isArray(CFG.ONLY) ? CFG.ONLY.includes(id) : true));
  let scope = liveBeats.filter(b => phaseOf(b) === CFG.ACT);
  if (CFG.INCLUDE_UNGATED_NEIGHBORS) {
    const extra = new Set();
    for (const b of scope) {
      const targets = [b.next, b.phaseEntry?.to, ...(b.choices || []).flatMap(ch => [ch?.next, ch?.checkStat ? ch?.failNext : null])].map(s).filter(Boolean);
      for (const t of targets) { const tb = byId.get(t); if (tb && phaseOf(tb) == null) extra.add(t); }
    }
    for (const id of extra) if (!scope.some(b => b.id === id)) scope.push(byId.get(id));
  }
  scope = scope.filter(b => only(b.id));
  if (CFG.LIMIT > 0) scope = scope.slice(0, CFG.LIMIT);
  if (!scope.length) return ui.notifications.warn("Walker: nothing in scope.");
  console.log(TAG, `scope: ${scope.length} beats (act ${CFG.ACT}${CFG.INCLUDE_UNGATED_NEIGHBORS ? " + ungated neighbors" : ""})`);

  // ── Snapshots ────────────────────────────────────────────────────────────────
  const settingKeys = [...game.settings.settings.keys()].filter(k => k.startsWith(NS + ".")).map(k => k.slice(NS.length + 1));
  const snapSettings = {};
  for (const k of settingKeys) { try { snapSettings[k] = foundry.utils.deepClone(game.settings.get(NS, k)); } catch (_e) {} }
  const TIKKUN_KEY = settingKeys.find(k => /^tikkun/i.test(k) && !/threshold|dividend[A-Z]/.test(k)) || settingKeys.find(k => /tikkun/i.test(k)) || null;
  const speakerIds = [...new Set(scope.map(b => s(b.speakerActorId)).filter(Boolean))];
  const snapMemories = new Map();
  for (const id of speakerIds) { const a = game.actors.get(id); if (a) snapMemories.set(id, foundry.utils.deepClone(foundry.utils.getProperty(a, "flags.bbttcc-mal-voice.memories"))); }
  const applyDeltaExists = typeof game.bbttcc?.api?.factions?.applyDelta === "function";
  const opApiExists = typeof game.bbttcc?.api?.factions?.op?.commit === "function" || typeof game.bbttcc?.api?.op?.commit === "function";

  // ── Temp actors ──────────────────────────────────────────────────────────────
  const seedBank = () => Object.fromEntries(OP_KEYS.map(k => [k, SEED_MARKS]));
  const seedMeters = () => ({ morale: 5, loyalty: 5, victory: { unity: 5 }, darkness: { global: 5 } });   // mid-range so ± deltas both register
  const tempFaction = await Actor.create({ name: "[WALK] Coalition Faction (safe to delete)", type: "npc", flags: { [FNS]: { isFaction: true, tier: 1, opBank: seedBank(), ...seedMeters() } } });
  const tempSteward = await Actor.create({ name: "[WALK] Steward (safe to delete)", type: "character" });
  const foreign = new Map();       // original factionId → temp Actor
  const liveFactionIds = new Set([live.factionId, ...(live.factionIds || [])].filter(Boolean).map(v => s(v).replace(/^Actor\./, "")));
  const mapFaction = async (fid) => {
    const k = s(fid).replace(/^Actor\./, "");
    if (!k || liveFactionIds.has(k)) return tempFaction.id;
    if (!foreign.has(k)) {
      const src = game.actors.get(k);
      foreign.set(k, await Actor.create({ name: `[WALK] foreign ${src?.name || k} (safe to delete)`, type: "npc", flags: { [FNS]: { isFaction: true, tier: 1, opBank: seedBank(), ...seedMeters() } } }));
    }
    return foreign.get(k).id;
  };

  // ── Clone + sanitize ─────────────────────────────────────────────────────────
  const STRIP = ["purifyHexes","openTravel","radiationDelta","territoryOutcome","turnRequests","relationshipEffects"];
  const declared = {};             // beatId → [stripped effect keys]
  const clones = [];
  for (const b of liveBeats) {
    const c = foundry.utils.deepClone(b);
    delete c.audio; delete c.chase; delete c.sparkLink; delete c.gateUnlocks;
    if (c.cinematic && typeof c.cinematic === "object") { c.cinematic.durationMs = 0; delete c.cinematic.duration; delete c.cinematic.ms; }   // keep enabled: type "cinematic" only opens its choice dialog on this path; scene dives are stubbed
    const we = c.worldEffects;
    if (we && typeof we === "object" && !Array.isArray(we)) {
      for (const k of STRIP) if (we[k] != null) { (declared[b.id] ||= []).push(k); delete we[k]; }
      if (Array.isArray(we.factionEffects)) for (const row of we.factionEffects) if (row && typeof row === "object") row.factionId = await mapFaction(row.factionId);
    }
    clones.push(c);
  }
  const testCampaign = { ...foundry.utils.deepClone(live), id: TEST_ID, label: "[WALK] throwaway (safe to delete)", factionId: "Actor." + tempFaction.id, factionIds: ["Actor." + tempFaction.id], beats: clones, npcPlacements: [], hexOverrides: {} };
  const cloneById = new Map(clones.map(c => [c.id, c]));

  // ── Stubs ────────────────────────────────────────────────────────────────────
  const restorers = [];
  const stub = (obj, key, fn) => { if (!obj) return; const had = Object.prototype.hasOwnProperty.call(obj, key); const orig = obj[key]; obj[key] = fn; restorers.push(() => { if (had) obj[key] = orig; else delete obj[key]; }); };
  const calls = [];
  const WALK = { current: null, seq: [], verdict: "pass", captured: [] };
  const record = (what) => async (...a) => { calls.push({ beat: WALK.current, what, args: a.slice(0, 2).map(x => typeof x === "string" ? x : (x?.id ?? x?.name ?? x?.key ?? typeof x)) }); return { ok: true, stubbed: true }; };
  const A = game.bbttcc.api;
  for (const k of ["launchScenario","run","startScenario","fireScenario","runScenario","launch"]) if (typeof A.encounters?.[k] === "function") stub(A.encounters, k, record(`encounters.${k}`));
  if (A.encounters) stub(A.encounters, "_spawner", { spawnAtCenter: record("encounters._spawner.spawnAtCenter") });
  if (A.resolution) stub(A.resolution, "runResolution", record("resolution.runResolution"));
  if (A.territory) stub(A.territory, "applyOutcome", record("territory.applyOutcome"));
  if (A.world) stub(A.world, "addTime", async (pts, ...rest) => { calls.push({ beat: WALK.current, what: "world.addTime", args: [Number(pts)] }); return true; });
  if (A.transition) stub(A.transition, "consumeDive", () => null);
  if (A.worldMutation) stub(A.worldMutation, "pullTableToScene", async () => null);
  if (A.turn) stub(A.turn, "enqueueRequest", record("turn.enqueueRequest"));
  stub(Scene.prototype, "activate", async function () { calls.push({ beat: WALK.current, what: "scene.activate", args: [this.name] }); return this; });
  stub(Scene.prototype, "view", async function () { calls.push({ beat: WALK.current, what: "scene.view", args: [this.name] }); return this; });

  // Dialog autopilot
  const origRender = Dialog.prototype.render, origConfirm = Dialog.confirm, origPrompt = Dialog.prompt;
  const DV2 = foundry.applications?.api?.DialogV2;
  const origDV2 = DV2 ? { confirm: DV2.confirm, prompt: DV2.prompt, wait: DV2.wait } : null;
  Dialog.prototype.render = function () {
    try {
      const btns = this.data?.buttons ?? {}; const keys = Object.keys(btns);
      const html = $(`<div>${this.data?.content ?? ""}</div>`);
      let action;
      if (keys.some(k => /^c\d+$/.test(k))) action = "__close";                              // beat choice dialog: stop the chain here
      else if (btns.success && btns.fail) action = WALK.verdict === "fail" ? "fail" : "success"; // GM adjudication
      else if (btns.yes && btns.no) action = "yes";
      else action = (this.data?.default && btns[this.data.default]) ? this.data.default : keys[0];
      setTimeout(() => { try { if (action === "__close" || !action) this.data?.close?.(html); else btns[action]?.callback?.(html); } catch (_e) {} }, 5);
    } catch (_e) {}
    return this;
  };
  Dialog.confirm = async () => true;
  Dialog.prompt = async ({ callback } = {}) => { try { return callback?.($("<div></div>")); } catch (_e) { return null; } };
  if (DV2) {
    DV2.confirm = async () => true;
    DV2.prompt = async (cfg = {}) => { try { return (await cfg.ok?.callback?.(null, { form: { elements: {} } }, null)) ?? true; } catch (_e) { return true; } };
    DV2.wait = async (cfg = {}) => { const bl = Array.isArray(cfg.buttons) ? cfg.buttons : Object.values(cfg.buttons ?? {}); const d = bl.find(b => b?.default) ?? bl[0]; try { return d?.callback ? await d.callback(null, { form: { elements: {} } }, null) : (d?.action ?? "ok"); } catch (_e) { return d?.action ?? "ok"; } };
  }
  restorers.push(() => { Dialog.prototype.render = origRender; Dialog.confirm = origConfirm; Dialog.prompt = origPrompt; if (DV2 && origDV2) Object.assign(DV2, origDV2); });
  const forceCloseDialogs = () => { for (const w of Object.values(ui.windows)) if (w instanceof Dialog) { try { w.close({ force: true }); } catch (_e) {} } };

  // Deterministic dice
  const origRandom = CONFIG.Dice.randomUniform;
  const pinDice = (hi) => { CONFIG.Dice.randomUniform = () => (hi ? 0.0001 : 0.9999); };   // Die.mapRandomFace = ceil((1-u)*faces): u→0 is the TOP face
  restorers.push(() => { CONFIG.Dice.randomUniform = origRandom; });

  // Captures
  const hookResolved = Hooks.on("bbttcc:beat:resolved", ({ beat } = {}) => { WALK.seq.push(s(beat?.id)); });
  const createdChat = new Set();
  const hookChat = Hooks.on("createChatMessage", (m) => { createdChat.add(m.id); });
  const origErr = console.error, origWarn = console.warn;
  const NOISE = /deprecat|legacy\s+syntax|autosize/i;
  console.error = (...a) => { const t = a.map(x => (x?.message ?? String(x))).join(" "); if (!NOISE.test(t)) WALK.captured.push("ERR: " + t.slice(0, 200)); origErr(...a); };
  console.warn = (...a) => { const t = a.map(x => (x?.message ?? String(x))).join(" "); if (/error|failed|exception|not found|refused|cannot|missing/i.test(t) && !NOISE.test(t)) WALK.captured.push("WARN: " + t.slice(0, 200)); origWarn(...a); };
  restorers.push(() => { console.error = origErr; console.warn = origWarn; Hooks.off("bbttcc:beat:resolved", hookResolved); Hooks.off("createChatMessage", hookChat); });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const results = [];
  const flat = (o, p = "", out = {}) => { if (o && typeof o === "object" && !Array.isArray(o)) { for (const [k, v] of Object.entries(o)) flat(v, p ? `${p}.${k}` : k, out); } else out[p] = Array.isArray(o) ? JSON.stringify(o) : o; return out; };
  const NOISY = /Ts$|\.ts$|history|warLogs|opSchedules|lastTouched|updatedAt|createdAt/;
  const diff = (a, b) => { const fa = flat(a), fb = flat(b); const out = []; for (const k of new Set([...Object.keys(fa), ...Object.keys(fb)])) if (fa[k] !== fb[k] && !NOISY.test(k)) out.push({ path: k, before: fa[k], after: fb[k] }); return out; };
  const fflags = (a) => foundry.utils.deepClone(a?.flags?.[FNS] ?? {});
  const snap = () => ({
    phase: Number(game.settings.get(NS, "storyPhase")) || 0,
    tikkun: TIKKUN_KEY ? Number(game.settings.get(NS, TIKKUN_KEY)) || 0 : null,
    main: fflags(tempFaction),
    foreign: Object.fromEntries([...foreign.entries()].map(([k, a]) => [k, fflags(a)])),
    calls: calls.length
  });
  const reseed = async () => { for (const a of [tempFaction, ...foreign.values()]) await a.update({ [`flags.${FNS}.opBank`]: seedBank(), [`flags.${FNS}.morale`]: 5, [`flags.${FNS}.loyalty`]: 5, [`flags.${FNS}.victory.unity`]: 5, [`flags.${FNS}.darkness.global`]: 5 }); };   // meters back to mid-range every run so ± deltas never clamp
  const fire = async (fn) => {
    WALK.seq = []; WALK.captured = [];
    let error = null, ret = null;
    try { ret = await Promise.race([Promise.resolve(fn()), sleep(CFG.TIMEOUT_MS).then(() => { forceCloseDialogs(); throw new Error(`timeout ${CFG.TIMEOUT_MS}ms`); })]); }
    catch (e) { error = String(e?.message ?? e).slice(0, 240); }
    await sleep(CFG.STEP_MS);
    return { ret, error, seq: WALK.seq.slice(), captured: WALK.captured.slice() };
  };
  const rowsFor = (beatIds) => beatIds.map(id => cloneById.get(id)).filter(Boolean).flatMap(c => Array.isArray(c.worldEffects?.factionEffects) ? c.worldEffects.factionEffects : []);
  const expectedOp = (beatIds, actorId) => { const out = {}; for (const r of rowsFor(beatIds)) if (r.factionId === actorId) for (const [k, v] of Object.entries(r.opDeltas || {})) { const kk = k.toLowerCase(); if (Number(v)) out[kk] = (out[kk] || 0) + Number(v); } return out; };
  const bankDiff = (before, after) => { const out = {}; for (const k of OP_KEYS) { const d = (Number(after?.opBank?.[k]) || 0) - (Number(before?.opBank?.[k]) || 0); if (d) out[k] = d; } return out; };
  const push = (row) => { results.push(row); const mark = row.ok ? "✓" : (row.gap ? "◐" : "✗"); (row.ok ? console.log : console.warn)(`${TAG} ${mark} ${row.kind} ${row.beat}${row.choice != null ? ` [${row.choice}] "${row.label}"` : ""}${row.verdict ? ` (${row.verdict})` : ""} ${row.fails?.length ? "— " + row.fails.join(" · ") : ""}`); };

  // ── Arm the sandbox ──────────────────────────────────────────────────────────
  camps[TEST_ID] = testCampaign;
  const writeCamps = async (map) => game.settings.set(NS, "campaigns", wasString ? JSON.stringify(map) : map);
  ui.notifications.info(`🚶 Headless walker — act ${CFG.ACT}, ${scope.length} beats. Watch the console.`);
  try {
    await writeCamps(camps);
    await api.setActiveCampaignId(TEST_ID);
    await game.settings.set(NS, "directorState", {});
    await game.settings.set(NS, "storyPhase", CFG.ACT);

    let n = 0;
    for (const b of scope) {
      if (window.__bbttccWalkStop) { console.warn(TAG, "stopped by request"); break; }
      n++; WALK.current = b.id;
      const c = cloneById.get(b.id);
      const we = (c.worldEffects && typeof c.worldEffects === "object" && !Array.isArray(c.worldEffects)) ? c.worldEffects : {};

      // ── EFFECTS pass ──
      await reseed();
      const before = snap();
      WALK.verdict = "pass"; pinDice(true);
      const r = await fire(() => api.runBeat(TEST_ID, b.id, { __enactChoice: 9999 }));
      const after = snap();
      const fails = [], notes = []; let gap = false;
      if (r.error) fails.push(r.error);
      const redirected = !r.seq.includes(b.id) && r.seq.length > 0;
      if (redirected) notes.push(`ENTRY REDIRECT → ${r.seq.join("→")} (engine gate: phaseEntry / feud cause) — effect assertions skipped`);
      else if (!r.seq.includes(b.id)) fails.push("never resolved");
      // quests
      for (const row of (redirected ? [] : (Array.isArray(we.questEffects) ? we.questEffects : []))) {
        const q = s(row?.questId), action = s(row?.action).toLowerCase() || "accept";
        if (!q) continue;
        const buckets = after.main.quests || {};
        const inB = (bk) => !!buckets[bk]?.[q];
        const ok = action === "accept" || action === "activate" || action === "reopen" ? (inB("active") || inB("completed") || inB("archived"))
                 : action.startsWith("complete") ? (inB("completed") || inB("archived"))
                 : action.startsWith("archive") ? inB("archived") : true;
        if (!ok) fails.push(`questEffects ${action} ${q} not reflected in faction buckets`);
      }
      // phase / tikkun
      const pa = Number(we.phaseAdvance?.set);
      if (!redirected && Number.isFinite(pa) && after.phase !== Math.max(before.phase, pa)) fails.push(`phaseAdvance ${pa}: storyPhase ${before.phase}→${after.phase}`);
      const tk = Math.floor(Number(we.tikkunDelta?.add) || 0);
      if (!redirected && tk && TIKKUN_KEY && after.tikkun - before.tikkun !== tk) fails.push(`tikkunDelta +${tk}: ${before.tikkun}→${after.tikkun}`);
      // faction effects
      const frows = redirected ? [] : (Array.isArray(we.factionEffects) ? we.factionEffects : []);
      const targets = [...new Set(frows.map(r2 => r2.factionId))];
      for (const tid of targets) {
        const actor = tid === tempFaction.id ? tempFaction : [...foreign.values()].find(a => a.id === tid);
        if (!actor) continue;
        const bf = tid === tempFaction.id ? before.main : before.foreign[[...foreign.entries()].find(([, a]) => a.id === tid)?.[0]];
        const af = tid === tempFaction.id ? after.main : after.foreign[[...foreign.entries()].find(([, a]) => a.id === tid)?.[0]];
        const expOp = expectedOp([b.id], tid), gotOp = bankDiff(bf, af);
        const declaredMeters = frows.filter(r2 => r2.factionId === tid).some(r2 => ["moraleDelta","loyaltyDelta","unityDelta","darknessDelta","vpDelta"].some(k => Number(r2[k])));
        const meterDiffs = diff(bf, af).filter(d => !d.path.startsWith("opBank") && !d.path.startsWith("quests"));
        if (!applyDeltaExists) {
          if (Object.keys(expOp).length || declaredMeters) { gap = true; notes.push(`ENGINE GAP: factionEffects declared (${Object.keys(expOp).length ? "opDeltas " + JSON.stringify(expOp) : ""}${declaredMeters ? " meters" : ""}) but api.factions.applyDelta is missing — WME skips the whole row`); }
          if (Object.keys(gotOp).length) notes.push(`unexpected opBank change ${JSON.stringify(gotOp)}`);
        } else {
          for (const k of new Set([...Object.keys(expOp), ...Object.keys(gotOp)])) if ((expOp[k] || 0) !== (gotOp[k] || 0)) fails.push(`opBank.${k} expected ${expOp[k] || 0} got ${gotOp[k] || 0} (marks)`);
          if (declaredMeters && !meterDiffs.length) fails.push("morale/loyalty/unity/darkness declared but no faction flag changed");
          if (meterDiffs.length) notes.push("meters: " + meterDiffs.map(d => `${d.path} ${d.before}→${d.after}`).join(", "));
        }
      }
      const myCalls = calls.slice(before.calls).map(x => `${x.what}(${x.args.join(",")})`);
      if (myCalls.length) notes.push("stubbed: " + myCalls.join(" · "));
      if (declared[b.id]) notes.push("stripped (declared only): " + declared[b.id].join(", "));
      const errs = r.captured.filter(x => x.startsWith("ERR:"));
      if (errs.length) fails.push(...errs);
      const warns = r.captured.filter(x => x.startsWith("WARN:"));
      if (warns.length) notes.push(...warns.slice(0, 4));
      push({ kind: "effects", beat: b.id, act: phaseOf(b), type: b.type, ok: !fails.length, gap, fails, notes, seq: r.seq });

      // ── TRANSITION pass ──
      if (!CFG.TRANSITIONS) continue;
      const choices = Array.isArray(c.choices) ? c.choices : [];
      for (let i = 0; i < choices.length; i++) {
        const ch = choices[i]; if (!ch || !s(ch.label)) continue;
        const hasCheck = !!s(ch.checkStat), isOp = /^op\./i.test(s(ch.checkStat)), opKey = isOp ? s(ch.checkStat).slice(3).toLowerCase() : null;
        const runs = hasCheck && CFG.FAIL_PATHS ? ["pass", "fail"] : ["pass"];
        for (const verdict of runs) {
          if (window.__bbttccWalkStop) break;
          await reseed();
          const bf = snap();
          WALK.verdict = verdict; pinDice(verdict === "pass");
          const rr = await fire(() => api.runBeat(TEST_ID, b.id, { __enactChoice: i }));
          const af = snap();
          const expected = verdict === "pass" ? s(ch.next) : (s(ch.failNext) || s(c.outcomes?.failure));
          const f2 = [], n2 = [];
          if (rr.error) f2.push(rr.error);
          // beat:resolved fires innermost-first: [ ...deeper hops, routed, source ]
          const iB = rr.seq.lastIndexOf(b.id);
          if (iB === -1) f2.push(rr.seq.length ? `source never resolved; saw ${rr.seq.join("→")} (entry redirect?)` : "beat never resolved");
          const got = iB > 0 ? rr.seq[iB - 1] : "";
          const deeper = iB > 1 ? rr.seq.slice(0, iB - 1) : [];
          if (expected && got !== expected) f2.push(`routed to '${got || "(nothing)"}', expected '${expected}'${!cloneById.has(expected) ? " (target does not exist)" : ""}`);
          if (!expected && got) n2.push(`no authored next, but the engine fired → ${got} (engine follow-up: rung/redirect)`);
          if (deeper.length) n2.push(`chain continued past the hop: ${deeper.join("→")}`);
          if (isOp && OP_KEYS.includes(opKey)) {
            const exp = -10 + (applyDeltaExists ? (expectedOp(rr.seq, tempFaction.id)[opKey] || 0) : 0);
            const gotD = bankDiff(bf.main, af.main)[opKey] || 0;
            if (gotD !== exp) f2.push(`OP debit on ${opKey}: expected ${exp} marks got ${gotD}`);
          } else if (isOp) f2.push(`checkStat '${ch.checkStat}' is not an OP channel`);
          const errs2 = rr.captured.filter(x => x.startsWith("ERR:")); if (errs2.length) f2.push(...errs2);
          const warns2 = rr.captured.filter(x => x.startsWith("WARN:")); if (warns2.length) n2.push(...warns2.slice(0, 3));
          push({ kind: "transition", beat: b.id, act: phaseOf(b), choice: i, label: s(ch.label), verdict: hasCheck ? verdict : null, check: s(ch.checkStat) || null, dc: ch.checkDC ?? null, expected: expected || null, got: got || null, ok: !f2.length, fails: f2, notes: n2, seq: rr.seq });
        }
      }
      if (n % 10 === 0) console.log(TAG, `… ${n}/${scope.length} beats (${results.filter(r2 => !r2.ok).length} failing so far)`);
    }
  } catch (e) {
    console.error(TAG, "walker aborted:", e);
    ui.notifications.error("Walker aborted — see console. Restoring…");
  } finally {
    // ── Teardown ──
    WALK.current = null;
    for (const fn of restorers.reverse()) { try { fn(); } catch (e) { origErr(TAG, "restore failed", e); } }
    forceCloseDialogs();
    try { await api.setActiveCampaignId(liveCid || ""); } catch (e) { console.error(TAG, "active campaign restore failed", e); }
    for (const k of settingKeys) { if (!(k in snapSettings)) continue; try { await game.settings.set(NS, k, snapSettings[k]); } catch (_e) {} }
    try { await tempFaction.delete(); await tempSteward.delete(); for (const a of foreign.values()) await a.delete(); } catch (e) { console.error(TAG, "temp actor cleanup failed", e); }
    for (const [id, mem] of snapMemories) { const a = game.actors.get(id); if (!a) continue; try { if (mem === undefined) await a.unsetFlag("bbttcc-mal-voice", "memories"); else await a.update({ "flags.bbttcc-mal-voice.memories": mem }); } catch (e) { console.error(TAG, "memory restore failed", id, e); } }
    if (!CFG.KEEP_CHAT) { try { const ids = [...createdChat].filter(id => game.messages.has(id)); for (let i = 0; i < ids.length; i += 100) await ChatMessage.deleteDocuments(ids.slice(i, i + 100)); } catch (e) { console.error(TAG, "chat cleanup failed", e); } }
  }

  // ── Report ───────────────────────────────────────────────────────────────────
  const eff = results.filter(r => r.kind === "effects"), tr = results.filter(r => r.kind === "transition");
  const summary = {
    act: CFG.ACT, beats: eff.length, effectsPass: eff.filter(r => r.ok).length, effectsFail: eff.filter(r => !r.ok).length, engineGapBeats: eff.filter(r => r.gap).length,
    transitions: tr.length, transitionsPass: tr.filter(r => r.ok).length, transitionsFail: tr.filter(r => !r.ok).length,
    applyDeltaExists, secs: Math.round((Date.now() - startedAt) / 1000)
  };
  console.group(`%c${TAG} ACT ${CFG.ACT} WALK — ${summary.secs}s`, "font-weight:bold");
  console.table([summary]);
  const failing = results.filter(r => !r.ok);
  if (failing.length) console.table(failing.map(r => ({ kind: r.kind, beat: r.beat, choice: r.choice ?? "", label: r.label ?? "", verdict: r.verdict ?? "", expected: r.expected ?? "", got: r.got ?? "", fails: r.fails.join(" · ") })));
  if (!applyDeltaExists) console.warn(TAG, `ENGINE GAP: game.bbttcc.api.factions.applyDelta is not defined — world-mutation-engine skips EVERY factionEffects row (morale/loyalty/unity/darkness AND immediate opDeltas). ${summary.engineGapBeats} in-scope beats declare such effects.`);
  console.groupEnd();
  const payload = { generatedAt: new Date().toISOString(), world: game.world.id, campaign: liveCid, cfg: { ...CFG, ONLY: String(CFG.ONLY ?? "") }, summary, declared, stubCalls: calls, results };
  if (CFG.DOWNLOAD) { try { (foundry.utils.saveDataToFile || saveDataToFile)(JSON.stringify(payload, null, 1), "application/json", `walk-act${CFG.ACT}-${new Date().toISOString().slice(0, 10)}.json`); } catch (_e) {} }
  const li = failing.slice(0, 25).map(r => `<li><code>${r.beat}</code>${r.choice != null ? ` [${r.choice}] “${r.label}”${r.verdict ? ` (${r.verdict})` : ""}` : ""} — ${r.fails.map(f => f.replace(/</g, "&lt;")).join(" · ")}</li>`).join("");
  ChatMessage.create({
    whisper: [game.user.id],
    content: `<div class="bbttcc-campaign-dialog"><h3>🚶 Act ${CFG.ACT} headless walk — ${failing.length ? `${failing.length} FAILING` : "ALL PASS ✓"}</h3>` +
      `<p>${summary.beats} beats · effects ${summary.effectsPass}/${summary.beats} · transitions ${summary.transitionsPass}/${summary.transitions} · ${summary.secs}s</p>` +
      (!applyDeltaExists ? `<p style="color:#c66;"><b>ENGINE GAP:</b> <code>api.factions.applyDelta</code> missing — WME dropped factionEffects on ${summary.engineGapBeats} beats (morale/loyalty/unity/darkness + opDeltas).</p>` : "") +
      (li ? `<ul style="font-size:12px;">${li}</ul>${failing.length > 25 ? `<p>… ${failing.length - 25} more in the JSON.</p>` : ""}` : "") +
      `<p style="opacity:.7;font-size:11px;">Sandbox restored: throwaway campaign, temp actors, settings, speaker memories, chat.</p></div>`
  });
  ui.notifications[failing.length ? "warn" : "info"](`Walk done: ${failing.length} failing of ${results.length} checks (${summary.secs}s).`);
})();

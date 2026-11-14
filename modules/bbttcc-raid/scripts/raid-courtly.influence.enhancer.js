// modules/bbttcc-raid/scripts/raid-courtly.influence.enhancer.js
// Bad Eden — Courtly Intrigue Scenario Engine (Social Combat)
//
// Based on Gap Analysis §5c "Courtly Intrigue (Social Combat)":
// - Each side has Influence HP = 10 + committed Diplomacy OP + (Soft Power OP / 2).
// - Each exchange, each side chooses an action:
//     • Persuade (Diplomacy): 1d20 + Persuasion + (spent Diplomacy OP / 2)
//     • Inspire (Soft Power): 1d20 + Performance + (spent Soft Power OP / 2)
//     • Expose (Intrigue): 1d20 + Deception/Insight + (spent Intrigue OP / 2)
//         - On hit by 6+, apply Scandal (–2 to target rolls next exchange).
//     • Intimidate (Violence aura):
//         1d20 + Intimidation + (Violence OP presence bonus: +1 per 5 current Violence OP, cap +4)
//         - On fail by 5+, backlash: lose 2 Influence HP.
// - Damage: winner deals the full margin (min 1) to the loser’s Influence HP. HP ≤ 0 = social victory.
//   (Ruled 2026-10-09; was ceil(margin/2), which stalemated even duels.)
// - Coalition OP bonus + court bonus combined cap at +5 per side (ruled 2026-10-09).
//
// API surface (attached to game.bbttcc.api.raid):
//   const court = await game.bbttcc.api.raid.courtly({
//     attackerId,
//     defenderId,
//     atkInitDip, atkInitSoft,
//     defInitDip, defInitSoft,
//     label
//   });
//
//   // Each exchange:
//   await court.step({
//     atkAction, defAction,   // "persuade" | "inspire" | "expose" | "intimidate"
//     atkSpend,  defSpend,    // OP spent from the relevant category
//     atkSkillBonus,          // e.g. Persuasion mod
//     defSkillBonus,
//     note
//   });
//
//   const state = court.getState();
//
// The most recent scenario is also exposed as:
//   game.bbttcc.api.raid._lastCourtly
//
// Safe to load alongside other raid enhancers.

(() => {
  const MOD_R = "bbttcc-raid";
  const MODF  = "bbttcc-factions";
  // Table announcements (2026-10-12): Apply-time turn cards, track updates and raid round cards used
  // to be hard-whispered to the GM list, so players never saw a Turn go by. World setting
  // bbttcc-territory.tableAnnouncements decides: "public" (default) = whole table, "gm" = whisper.
  const tableAudience = () => { try { if (game.settings.get("bbttcc-territory", "tableAnnouncements") === "gm") return (game.users ?? []).filter(u => u.isGM).map(u => u.id); } catch (_e) {} return []; };
  const TAG   = "[bbttcc-raid/courtly]";

  const clamp = (v,min,max)=>Math.max(min,Math.min(max,Number(v||0)));
  const dup   = (x)=>foundry.utils.duplicate(x||{});
  const gmIds = () => game.users?.filter(u=>u.isGM).map(u=>u.id) ?? [];

  function getFX() {
    return game?.bbttcc?.api?.fx || null;
  }

  // Phase F — Multiplayer VFX relay. Fires the bbttcc:courtly:vfx hook
  // locally + broadcasts the same event to other clients via socket so
  // the VFX renderer (raid-courtly.vfx.js) plays the same effect on every
  // connected player. Mirrors _emitInfilHookRelay from raid-infiltration.
  // Manifest socket flag already set per [[foundry-v13-socket-manifest]].
  function _emitCourtlyVfx(kind, payload = {}) {
    const evt = { kind, ts: Date.now(), ...payload };
    try { Hooks.callAll("bbttcc:courtly:vfx", evt); } catch (_e) {}
    try {
      if (game?.socket?.emit) {
        game.socket.emit(`module.${MOD_R}`, { t: "courtlyHook", hook: "bbttcc:courtly:vfx", payload: evt });
      }
    } catch (_e) {}
  }

  // Convo-sprint #3 multiplayer completion (2026-07-14): relay the scenario
  // STATE snapshot to all clients whenever it changes. The raid console's
  // existing courtlyHook socket handler re-fires bbttcc:courtly:state
  // locally on every client, so player-side consumers (npc-dialogue's
  // live-court board) can read a synced snapshot even though the scenario
  // OBJECT lives only on the committing client. `__relayed` guards the
  // echo — a re-fired hook must never re-emit.
  Hooks.on("bbttcc:courtly:state", (payload) => {
    try {
      if (!payload || payload.__relayed) return;
      const st = payload.state || payload?.scenario?.getState?.() || null;
      if (!st) return;
      game.socket?.emit?.(`module.${MOD_R}`, {
        t: "courtlyHook", hook: "bbttcc:courtly:state",
        payload: { state: st, __relayed: true }
      });
    } catch (_e) {}
  });

  async function playRollFX(ctx = {}) {
    try {
      const fx = getFX();
      if (!fx || typeof fx.playRolls !== "function") return;
      await fx.playRolls({
        raidType: "courtly",
        label: "Courtly Exchange",
        attackerName: ctx.attackerName,
        defenderName: ctx.defenderName,
        attackerTotal: ctx.attackerTotal,
        defenderTotal: ctx.defenderTotal,
        margin: ctx.margin
      }, { broadcast: true });   // the scenario lives on the GM seat — relay so players see the exchange (2026-10-22)
    } catch (_e) {}
  }

  async function playInfluenceFX(ctx = {}) {
    try {
      const fx = getFX();
      if (!fx || typeof fx.playScenarioShift !== "function") return;
      await fx.playScenarioShift("courtly_exchange", {
        raidType: "courtly",
        outcome: `Influence ${ctx.beforeA}/${ctx.beforeD} → ${ctx.afterA}/${ctx.afterD}`
      }, { raidType: "courtly", broadcast: true });   // every seat sees the influence swing (was GM-local, 2026-10-22)
    } catch (_e) {}
  }


  async function adjustOpBank(actor, key, delta, scenarioLabel="Parley") {
    if (!actor || !key || !delta) return;
    const flags = dup(actor.flags?.[MODF] || {});
    const bank  = dup(flags.opBank || {});
    const k = String(key).toLowerCase();
    bank[k] = clamp((bank[k]||0) + delta, 0, 999);
    flags.opBank = bank;

    const war = Array.isArray(flags.warLogs) ? flags.warLogs.slice() : [];
    const sign = delta > 0 ? "+" : "";
    war.push({
      ts: Date.now(),
      type: "scenario",
      scenario: "courtly",
      summary: `${scenarioLabel}: ${k} ${sign}${delta}`
    });
    flags.warLogs = war;

    await actor.update({ [`flags.${MODF}`]: flags });
  }

  // Spends arrive in MARKS (owner ruling 2026-09-06); influence math counts per 10 marks.
  // Payable marks (whole tens) so every spend is clamped to the bank — a broke
  // faction can no longer buy bonuses on credit (2026-08-22 playtest finding).
  function bankOpOf(actor, key) {
    const b = actor?.flags?.[MODF]?.opBank || {};
    return Math.floor(Math.max(0, Number(b[String(key || "").toLowerCase()]) || 0) / 10) * 10;
  }
  // Inputs are MARKS (owner ruling 2026-09-06); mechanics count "per 10 marks". Round spends down to whole tens.
  const _m10 = (v) => Math.floor(Math.max(0, Number(v) || 0) / 10) * 10;

  async function sendChat(lines, {title="Parley"}={}) {
    if (!lines.length) return;
    await ChatMessage.create({
      content: `<p><b>${title}</b></p>${lines.join("<br/>")}`,
      whisper: tableAudience(),
      speaker: { alias: "Bad Eden Parley" }
    }).catch(()=>{});
  }

  function whenRaidReady(cb, tries=0) {
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api) return cb(api);
      if (tries > 60) return console.warn(TAG, "raid API not ready after timeout");
      setTimeout(() => whenRaidReady(cb, tries+1), 250);
    };
    if (game?.ready) go(); else Hooks.once("ready", go);
  }

  // Survey audit — Diplomatic Envoys (the Social specialist CREW). An ACTIVE Diplomatic Envoys
  // crew on a side softens the court: that side's Expose/Intimidate cost −1 Suspicion (the
  // Covert-Ops-Cell analog — raising tolerance for the obstacle). Name match slash/space-insensitive.
  function _sideHasActiveCrew(actor, crewName) {
    try {
      const ac = actor?.flags?.fourththing?.echoAssets?.activeCrew;
      if (!Array.isArray(ac)) return false;
      const norm = (s) => String(s || "").toLowerCase().replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ").trim();
      const want = norm(crewName);
      return ac.some(n => norm(n) === want);
    } catch { return false; }
  }

  function computeInfluenceHP({ baseCommitDip=0, baseCommitSoft=0 }) {
    return Math.max(
      1,
      10 + Math.floor(Number(baseCommitDip||0)) + Math.floor(Number(baseCommitSoft||0)/2)
    );
  }

  function actionToOpKey(action) {
    switch (String(action||"").toLowerCase()) {
      case "persuade":   return "diplomacy";
      case "inspire":    return "softpower";
      case "expose":     return "intrigue";
      case "intimidate": return "violence";
      default:           return null;
    }
  }

  // Phase C — Court Bonus: sum of favors of courtiers aligned with `factionId`
  // (those whose courtFavor[factionId] >= 1), capped to ±5 per spec §4.2.
  // Reads the scene's courtiers (api.raid.tableau.courtiers — any scene since 2026-10-22); safe if canvas isn't loaded yet.
  // DISFAVOR COUNTS (Dave 2026-11-13: "a way for people to already be disfavorable with people from the get go"): an observer
  // who holds a grudge against the OTHER side (courtFavor[oppFactionId] <= -1) adds |favor| to this side — before, negative
  // favor was simply ignored, so a soured observer cost nothing.
  function computeCourtBonus(factionId, oppFactionId = null) {
    try {
      if (!factionId || !canvas?.tokens?.placeables) return 0;
      let total = 0;
      for (const tk of (game.bbttcc?.api?.raid?.tableau?.courtiers?.() ?? [])) {
        const cf = tk?.actor?.flags?.[MOD_R]?.courtFavor || {};
        const fav = Number(cf[factionId] ?? 0);
        if (fav >= 1) total += fav;
        if (oppFactionId) { const opp = Number(cf[oppFactionId] ?? 0); if (opp <= -1) total += -opp; }
      }
      return clamp(total, -5, 5);
    } catch (e) {
      console.warn(TAG, "computeCourtBonus failed", e);
      return 0;
    }
  }

  // Phase C — rel-delta on outcome. Shifts the directional relations tier
  // by `delta` steps using the existing factions.relations API. Negative
  // = toward hostility, positive = toward friendship. Clamped to ladder.
  async function shiftRelTier(fromActor, toActor, delta, reason) {
    if (!delta || !fromActor || !toActor) return;
    try {
      const relations = game?.bbttcc?.api?.factions?.relations;
      if (!relations) return;
      const keys = relations.TIER_KEYS || [];
      const curTier = relations.get(fromActor, toActor);
      const curIdx = keys.indexOf(curTier);
      if (curIdx < 0) return;
      const newIdx = Math.max(0, Math.min(keys.length - 1, curIdx + delta));
      const newTier = keys[newIdx];
      if (newTier === curTier) return;
      await relations.set(fromActor, toActor, newTier, { reason });
    } catch (e) {
      console.warn(TAG, "shiftRelTier failed", e);
    }
  }

  // Spec §4.4 — outcome-driven rel-delta magnitudes. Keyed by outcomeKind +
  // winner side. Phase E replaces Phase C's 3-outcome simplification.
  // For asymmetric outcomes (cleanTriumph / tarnishedVictory / publicHumiliation),
  // "attacker"/"defender" suffix indicates which side IS the winner; the
  // table entry's att2def / def2att stay attacker-centric so callers don't
  // need to flip arguments based on who won.
  const REL_DELTA_TABLE = Object.freeze({
    // attacker wins
    cleanTriumph_attacker:       { att2def: -1, def2att: -2 },
    tarnishedVictory_attacker:   { att2def: -1, def2att: -1 },
    publicHumiliation_attacker:  { att2def: -1, def2att: -3 }, // attacker won, defender publicly humiliated
    // defender wins (mirrored)
    cleanTriumph_defender:       { att2def: -2, def2att: -1 },
    tarnishedVictory_defender:   { att2def: -1, def2att: -1 },
    publicHumiliation_defender:  { att2def: +1, def2att: -2 }, // attacker publicly humiliated
    // symmetric
    stalemate:                   { att2def:  0, def2att:  0 },
    mutualRuin:                  { att2def: -2, def2att: -2 }
  });

  async function applyRelDeltas(A, D, outcomeKind, winner, label) {
    if (!outcomeKind) return;
    const key = outcomeKind === "stalemate" || outcomeKind === "mutualRuin"
      ? outcomeKind
      : `${outcomeKind}_${winner === "A" ? "attacker" : "defender"}`;
    const d = REL_DELTA_TABLE[key];
    if (!d) return;
    const reason = `${label || "Parley"}: ${outcomeKind}`;
    await shiftRelTier(A, D, d.att2def, reason);
    await shiftRelTier(D, A, d.def2att, reason);
  }

  // Phase E — outcome flavor detector. Maps damage-based win + suspicion +
  // scandal state to one of the 5 outcomes per spec §6. Returns null if
  // still ongoing.
  function detectOutcomeKind(state) {
    if (state.outcome === "ongoing") return null;
    if (state.outcome === "stalemate") return "stalemate";
    if (state.outcome === "mutualRuin") return "mutualRuin";
    const winner = state.outcome === "attackerWin" ? "A" : "D";
    const loser  = winner === "A" ? "D" : "A";
    const loserScandal  = loser === "A" ? state.scandalOnA : state.scandalOnD;
    const winnerScandal = winner === "A" ? state.scandalOnA : state.scandalOnD;
    // Suspicion 10 collapse OR loser had scandal at end → Public Humiliation.
    if (state.courtCollapsed || loserScandal) return "publicHumiliation";
    // Winner had scandal at end OR suspicion ≥5 OR winner's influence ≤50% → Tarnished.
    const winnerInf = winner === "A" ? state.influenceA : state.influenceD;
    const winnerMax = winner === "A" ? state.maxA       : state.maxD;
    const pct = winnerMax > 0 ? winnerInf / winnerMax : 0;
    if (winnerScandal || state.suspicion >= 5 || pct <= 0.5) return "tarnishedVictory";
    return "cleanTriumph";
  }

  function outcomeWinner(state) {
    if (state.outcome === "attackerWin") return "A";
    if (state.outcome === "defenderWin") return "D";
    return null;
  }

  // Phase E — Scandal Scar writer. Pushes a scar entry to the actor's flag.
  // Severity: "light" (-2 first roll next courtly raid; cleared by Clean
  // Triumph) or "heavy" (-3 first + -1 second; persists until laundering or
  // 3-session timeout — laundering is out of S.2 scope per spec §10).
  async function writeScandalScar(actor, severity, sourceRaidId) {
    if (!actor) return null;
    const sev = (severity === "heavy") ? "heavy" : "light";
    const scars = foundry.utils.duplicate(actor.flags?.["bbttcc-raid"]?.scandalScars || []);
    scars.push({
      severity: sev,
      ts: Date.now(),
      sourceRaidId: String(sourceRaidId || ""),
      status: "pending"
    });
    await actor.update({ "flags.bbttcc-raid.scandalScars": scars });
    return scars[scars.length - 1];
  }

  // Clear all light scars on the actor (Clean Triumph reward per spec §6).
  async function clearLightScars(actor) {
    if (!actor) return 0;
    const scars = actor.flags?.["bbttcc-raid"]?.scandalScars || [];
    const kept = scars.filter(s => s.severity !== "light");
    if (kept.length === scars.length) return 0;
    await actor.update({ "flags.bbttcc-raid.scandalScars": kept });
    return scars.length - kept.length;
  }

  // ── PERFORMANCE CONTESTS (2026-10-04, Dave: "genericize it for any type of performance style battle") ──────────────
  // Profiles live in modules/bbttcc-raid/data/performance-profiles.json (loaded at ready; built-ins below as the fallback).
  const PERF_BUILTIN = {
    dance: { label: "The Floor", fuel: ["culture", "softpower"], crowd: "the floor", crowdTrack: "Crowd", foul: "intimidate", foulText: "drew steel on the floor. The music stops.",
      actions: { persuade: { label: "Find the Pocket", pool: "culture" }, inspire: { label: "Showstopper", pool: "softpower" }, expose: { label: "Call-Out", pool: "culture" }, intimidate: { label: "Draw Steel", pool: "violence" } } },
    skate: { label: "The Skate-Off", fuel: ["culture", "softpower"], crowd: "the rail", crowdTrack: "Rail", foul: "intimidate", foulText: "went full mall cop and shut the session down.",
      actions: { persuade: { label: "Land the Line", pool: "culture" }, inspire: { label: "Go Big", pool: "softpower" }, expose: { label: "Call Their Bail", pool: "culture" }, intimidate: { label: "Bust Them (Mall Cop)", pool: "violence" } } }
  };
  // ALPHA CUT ruling 3 (2026-10-18): Impress with no particular style = a plain show. Same four moves, the crowd judges.
  PERF_BUILTIN.show = { label: "The Show", fuel: ["softpower", "culture"], crowd: "the crowd", crowdTrack: "Crowd", foul: "intimidate", foulText: "turned the show into a brawl.",
    actions: { persuade: { label: "Hold the Room", pool: "softpower" }, inspire: { label: "Showstopper", pool: "culture" }, expose: { label: "Upstage Them", pool: "softpower" }, intimidate: { label: "Start a Brawl", pool: "violence" } } };
  let PERF_PROFILES = { ...PERF_BUILTIN };
  async function _loadPerfProfiles() {
    try {
      const res = await fetch(`modules/bbttcc-raid/data/performance-profiles.json?t=${Date.now()}`);
      if (!res.ok) return;
      const j = await res.json();
      for (const [k, v] of Object.entries(j || {})) if (!k.startsWith("_") && v && typeof v === "object") PERF_PROFILES[k] = v;
    } catch (e) { console.warn(TAG, "performance profiles: using built-ins", e); }
  }
  function _perfProfile(key) { const k = String(key || "").trim(); const p = PERF_PROFILES[k]; return p ? { key: k, ...p } : null; }

  whenRaidReady((raidApi) => {
    // Ruling 3: the console's Impress style picker reads the loaded profiles here.
    raidApi.performanceProfiles = () => ({ ...PERF_PROFILES });
    raidApi.courtly = async function createCourtlyScenario({
      attackerId,
      defenderId,
      atkInitDip = 0,
      atkInitSoft = 0,
      defInitDip = 0,
      defInitSoft = 0,
      label = "Parley",
      performance = null,             // PERFORMANCE MODE (2026-10-04): a profile key or object — see raid-performance below
      goal = "persuade",              // ALPHA CUT ruling 3: persuade | deceive | impress | unnoticed — one per Parley
      domainStrength = null,          // ALPHA CUT ruling 5: { atk:{dip,soft}, def:{dip,soft} } in OP — Influence from what the Domain owns, nothing debited
      audience = null,                // 2026-11-11 (Dave): who is being swayed — observers | judges | jury | crowd | court (raid.audienceWords)
      rounds = null,                  // 2026-11-13 (Dave, the Circuit Riders): NAMED ROUNDS — [{ topic, prompt }]; the Parley runs exactly that many
                                      // exchanges (roundCap) and each round's topic + prompt is posted to the table as it opens
      restore = null                  // 2026-11-11: a saved state (the courtlyActive mirror) — rebuild the SAME Parley after a GM reload: nothing charged again, no scars / door re-consumed
    } = {}) {
      const A = game.actors.get(String(attackerId||"").replace(/^Actor\./,""));
      const D = game.actors.get(String(defenderId||"").replace(/^Actor\./,""));
      if (!A || !D) throw new Error(`${TAG} attacker or defender not found`);
      const RESTORE = (restore && typeof restore === "object" && restore.outcome === "ongoing"
        && String(restore.attackerId) === A.id && String(restore.defenderId) === D.id) ? restore : null;
      // A restore that doesn't fit (ended, or another pairing) must never quietly open a NEW Parley — that would consume
      // scars / the door again. The caller decides what to do.
      if (restore && !RESTORE) throw new Error(`${TAG} restore refused — that Parley is over or belongs to another pairing`);
      if (RESTORE) {
        goal = RESTORE.goal || goal;
        performance = RESTORE.performance?.key || null;
        label = RESTORE.label || label;
      }

      // Spend initial commitment OPs & compute starting Influence HP
      // Spends are OP; banks store marks. Clamp to what each side can pay,
      // debit at marks scale (×10).
      // PERFORMANCE MODE: the profile's two fuel pools stand in for Diplomacy (full) and Soft Power (half)
      goal = String(goal || "persuade").toLowerCase();
      if (goal === "impress" && !performance) performance = "show";
      const PERF = performance ? (typeof performance === "object" ? performance : _perfProfile(performance)) : null;
      if (performance && !PERF) throw new Error(`${TAG} unknown performance profile ${performance}`);
      if (PERF) goal = "impress";
      const GOAL_LABELS = { persuade: "Persuade", deceive: "Deceive", impress: "Impress", unnoticed: "Stay unnoticed" };
      if (!GOAL_LABELS[goal]) goal = "persuade";
      const FUEL1 = PERF?.fuel?.[0] || "diplomacy", FUEL2 = PERF?.fuel?.[1] || "softpower";
      if (PERF && !label || (PERF && (label === "Parley" || label === "Courtly Intrigue"))) label = PERF.label || label;
      if (domainStrength) {
        // Ruling 5: Influence opens from the Domain's own OP ratings (what its marks already bought). No debit.
        atkInitDip = Math.max(0, Math.floor(Number(domainStrength.atk?.dip || 0)));
        atkInitSoft = Math.max(0, Math.floor(Number(domainStrength.atk?.soft || 0)));
        defInitDip = Math.max(0, Math.floor(Number(domainStrength.def?.dip || 0)));
        defInitSoft = Math.max(0, Math.floor(Number(domainStrength.def?.soft || 0)));
      } else if (!RESTORE) {
      const atkInitDipM = Math.min(_m10(atkInitDip), bankOpOf(A, FUEL1));   // marks
      const atkInitSoftM = Math.min(_m10(atkInitSoft), bankOpOf(A, FUEL2));   // marks
      const defInitDipM = Math.min(_m10(defInitDip), bankOpOf(D, FUEL1));   // marks
      const defInitSoftM = Math.min(_m10(defInitSoft), bankOpOf(D, FUEL2));   // marks

      if (atkInitDipM) await adjustOpBank(A, FUEL1, -atkInitDipM, label);
      if (atkInitSoftM) await adjustOpBank(A, FUEL2, -atkInitSoftM, label);
      if (defInitDipM) await adjustOpBank(D, FUEL1, -defInitDipM, label);
      if (defInitSoftM) await adjustOpBank(D, FUEL2, -defInitSoftM, label);
      // influence math counts per 10 marks
      atkInitDip = atkInitDipM / 10; atkInitSoft = atkInitSoftM / 10; defInitDip = defInitDipM / 10; defInitSoft = defInitSoftM / 10;
      }

      let initInfluenceA = computeInfluenceHP({ baseCommitDip: atkInitDip, baseCommitSoft: atkInitSoft });
      let initInfluenceD = computeInfluenceHP({ baseCommitDip: defInitDip, baseCommitSoft: defInitSoft });
      // Harmonized Grove (STORY FLOW D-5, 2026-09-17): "the next town you ride into will hear that a forest vouched for you" —
      // a side that holds a hex carrying the Grove opens court with +1 Influence
      try {
        const holdsGrove = (F) => { for (const sc of game.scenes ?? []) for (const d of sc.drawings ?? []) { const tf = d.flags?.["bbttcc-territory"]; if (!tf) continue; if (String(tf.factionId || tf.ownerId || "") !== String(F.id)) continue; if ((tf.modifiers || []).some(m => String(m || "").toLowerCase() === "harmonized grove")) return true; } return false; };
        if (holdsGrove(A)) { initInfluenceA += 1; console.log(TAG, "Harmonized Grove: attacker opens with +1 Influence"); }
        if (holdsGrove(D)) { initInfluenceD += 1; console.log(TAG, "Harmonized Grove: defender opens with +1 Influence"); }
      } catch (_eG) {}
      // Phase E — Consume pending "Influence cap −N next courtly raid" mark
      // (left by a prior Clean Triumph against this faction). Flag deleted
      // after consume per [[foundry-setflag-recursive-merge]].
      const aCapDelta = Number(A.flags?.["bbttcc-raid"]?.nextCourtlyInfluenceCapDelta || 0);
      const dCapDelta = Number(D.flags?.["bbttcc-raid"]?.nextCourtlyInfluenceCapDelta || 0);
      if (aCapDelta && !RESTORE) {
        initInfluenceA = Math.max(1, initInfluenceA + aCapDelta);
        await A.unsetFlag(MOD_R, "nextCourtlyInfluenceCapDelta");
      }
      if (dCapDelta && !RESTORE) {
        initInfluenceD = Math.max(1, initInfluenceD + dCapDelta);
        await D.unsetFlag(MOD_R, "nextCourtlyInfluenceCapDelta");
      }
      const _namedRounds = (Array.isArray(rounds) ? rounds : [])
        .map(r => (r && typeof r === "object") ? { topic: String(r.topic || "").trim(), prompt: String(r.prompt || "").trim() } : { topic: String(r || "").trim(), prompt: "" })
        .filter(r => r.topic || r.prompt).slice(0, 12);
      const _postRound = async (i) => {   // round i (0-based) opens: the table hears its topic
        const R = state.rounds?.[i]; if (!R) return;
        const e = (t) => foundry.utils.escapeHTML(String(t || ""));
        try { await ChatMessage.create({ speaker: { alias: state.label || "Parley" }, content: `<div class="bbttcc-parley-round" style="border-left:3px solid #c9a227;padding:.35em .6em;"><b>Round ${i + 1} of ${state.rounds.length}${R.topic ? ` — ${e(R.topic)}` : ""}</b>${R.prompt ? `<div style="margin-top:.25em">${e(R.prompt)}</div>` : ""}</div>` }); }
        catch (eR) { console.warn(TAG, "round topic post failed", eR); }
      };
      const state = {
        id: foundry.utils.randomID(),  // ruling 4: receipts drawn here are stamped with THIS Parley
        goal,                          // ruling 3
        goalLabel: GOAL_LABELS[goal],
        suspicionEnabled: goal === "unnoticed",   // ruling 3: Suspicion is the Stay-unnoticed goal (Impress has its crowd track instead)
        trackLabel: PERF ? (PERF.crowdTrack || "Crowd") : (goal === "unnoticed" ? "Suspicion" : null),
        attackerId: A.id,
        defenderId: D.id,
        sceneId: canvas?.scene?.id || null,   // review C66: the scene the Parley opened on — tableau.courtiers() falls back to it off-canvas
        label,
        round: 0,
        rounds: _namedRounds,          // 2026-11-13 — [{ topic, prompt }] or []
        roundCap: _namedRounds.length || 6,   // Phase E — spec §8 resolution 5; a named-rounds Parley runs exactly its rounds
        outcome: "ongoing", // "ongoing" | "attackerWin" | "defenderWin" | "mutualRuin" | "stalemate"
        outcomeKind: null,             // Phase E — one of "cleanTriumph"|"tarnishedVictory"|"stalemate"|"publicHumiliation"|"mutualRuin"
        influenceA: initInfluenceA,
        influenceD: initInfluenceD,
        maxA: initInfluenceA,          // Phase E — captured for % calc in outcome detector
        maxD: initInfluenceD,
        scandalOnA: false,
        scandalOnD: false,
        // Phase C — Suspicion / Court Bonus / collapse flag
        suspicion: 0,                  // 0..10 per spec §4.1
        suspicionQuietStreak: 0,       // consecutive rounds with no expose/intimidate
        courtBonusA: 0,                // computed at step() entry from courtier favor
        courtBonusD: 0,
        courtCollapsed: false,         // set when suspicion hits 10
        // Social obstacle-KEY (survey audit) — "The Last Word" (Cosmic Linguist signature):
        // the armed side's NEXT Expose/Intimidate raises NO Suspicion (bypassing the meter that
        // punishes the social hammer — the courtly analog of Catastrophic Entry vs a wall's
        // Threshold). Once per side per scenario.
        lastWordA: false, lastWordD: false, lastWordUsedA: false, lastWordUsedD: false,
        // Diplomatic Envoys (Social specialist crew) — that side's aggressive plays cost −1 Suspicion.
        envoysA: _sideHasActiveCrew(A, "Diplomatic Envoys"),
        envoysD: _sideHasActiveCrew(D, "Diplomatic Envoys"),
        // Phase C/D — Pending mods queue.
        // Schema: { side, type: "bonus"|"forceReroll"|"actionBonus", value?, source,
        //          actionFilter? (D), fireOnRound? (E — gate to specific round) }
        pendingMods: [],
        history: [],
        performance: PERF ? { key: PERF.key, label: PERF.label, crowd: PERF.crowd || "the Crowd", foul: PERF.foul || null, actions: Object.fromEntries(Object.entries(PERF.actions || {}).map(([k, v]) => [k, v?.label || k])) } : null,
        foulBy: null,
        audienceKey: (raidApi.audienceWords?.(audience)?.key) || "observers"
      };
      if (RESTORE) { try { Object.assign(state, structuredClone(RESTORE)); } catch (_eR) { Object.assign(state, JSON.parse(JSON.stringify(RESTORE))); } }
      else if (state.rounds.length) _postRound(0);
      const AUD = () => (raidApi.audienceWords?.(state) || { one: "observer", many: "observers", One: "Observer", Many: "Observers" });

      // Phase E — Consume pending Scandal Scars on both factions. Each scar
      // queues a one-shot penalty mod that fires at a specific round, then
      // gets marked status:"applied" on the actor. Light = -2 on round 1;
      // heavy = -3 on round 1 + -1 on round 2.
      async function _consumeScarsForSide(actor, side) {
        const scars = foundry.utils.duplicate(actor.flags?.["bbttcc-raid"]?.scandalScars || []);
        let mutated = false;
        for (const scar of scars) {
          if (scar.status !== "pending") continue;
          if (scar.severity === "light") {
            state.pendingMods.push({
              side, type: "bonus", value: -2, source: `scar:light(${scar.sourceRaidId || "prior"})`,
              fireOnRound: 1
            });
          } else if (scar.severity === "heavy") {
            state.pendingMods.push({
              side, type: "bonus", value: -3, source: `scar:heavy(${scar.sourceRaidId || "prior"})`,
              fireOnRound: 1
            });
            state.pendingMods.push({
              side, type: "bonus", value: -1, source: `scar:heavy(${scar.sourceRaidId || "prior"})`,
              fireOnRound: 2
            });
          }
          scar.status = "applied";
          mutated = true;
        }
        if (mutated) await actor.update({ "flags.bbttcc-raid.scandalScars": scars });
      }
      if (!RESTORE) {
        await _consumeScarsForSide(A, "A");
        await _consumeScarsForSide(D, "D");
      }

      // Conversation door (bbttcc-mal-voice on-ramp): an NPC ushered the
      // attacker into THIS court in dialogue (open_court_door tool). Consumed
      // only when the scenario's defender matches the door's — a door into
      // one court says nothing about another. Invited = warm introduction
      // (+2 on the first exchange); conceded = grudging access (+1, and the
      // court starts wary at Suspicion 1). Flag deleted after consume per
      // [[foundry-setflag-recursive-merge]].
      const door = RESTORE ? null : A.flags?.[MOD_R]?.courtlyDoor;
      if (door && String(door.defenderId || "") === D.id) {
        const invited = door.method !== "conceded";
        state.pendingMods.push({
          side: "A", type: "bonus", value: invited ? 2 : 1,
          source: `door:${invited ? "invited" : "conceded"}(${door.npcName || "an insider"})`,
          fireOnRound: 1
        });
        if (!invited && !_suspOff()) state.suspicion = Math.max(state.suspicion, 1);   // ruling 3: no Suspicion for Persuade / Deceive (2026-10-28)
        // unsetFlag, not a raw "-=key" update — v14 deprecated the legacy
        // deletion syntax (owner hit the compat error 2026-07-14); the core
        // helper always emits whatever the running core expects.
        await A.unsetFlag(MOD_R, "courtlyDoor");
        const esc = foundry.utils.escapeHTML;
        await sendChat([
          `${esc(door.npcName || "An insider")} holds the door: ${invited
            ? `${esc(A.name)} enters on a warm introduction (+2 on the first exchange).`
            : `${esc(A.name)} pushed their way in (+1 on the first exchange, but the ${AUD().many} are already wary — Suspicion starts at 1).`}`
        ], { title: `${label}: The Door Was Opened In Conversation` });
      }

      function presenceBonus(actor) {
        const flags = actor.flags?.[MODF] || {};
        const bank  = flags.opBank || {};
        const v = Number(bank.violence || 0);
        return Math.min(4, Math.floor(v / 50));   // the bank is MARKS: +1 per 5 OP = 50 marks, cap +4
      }

      async function step({
        atkAction = "persuade",
        defAction = "persuade",
        atkSpend = 0,
        defSpend = 0,
        atkSkillBonus = 0,
        defSkillBonus = 0,
        atkOpBonus = 0,
        defOpBonus = 0,
        atkSweeten = 0,   // ruling 5: Sweeten the deal — marks to the OTHER side, in the open
        defSweeten = 0,
        // Maneuvers + staged marks (2026-11-11): the console's pre-roll consumer (B3) and the staged-marks bonus land here,
        // OUTSIDE the backing cap — they were paid for. Modes: "normal" | "adv" | "dis" (roll twice, keep the better / worse).
        atkManBonus = 0,
        defManBonus = 0,
        atkMode = "normal",
        defMode = "normal",
        manNotes = [],
        note = ""
      } = {}) {
        if (state.outcome !== "ongoing") {
          return { ...state, note: "scenario already resolved" };
        }

        state.round += 1;

        const atkAct = String(atkAction||"").toLowerCase();
        const defAct = String(defAction||"").toLowerCase();
        const _opKey = (act) => PERF ? (PERF.actions?.[act]?.pool || actionToOpKey(act)) : actionToOpKey(act);
        const _nm = (act) => (PERF && PERF.actions?.[act]?.label) || act;
        const atkKey = _opKey(atkAct);
        const defKey = _opKey(defAct);

        // PERFORMANCE MODE — the foul ends it. Whoever plays the profile's foul takes the floor by force: the contest is over,
        // the outcome is "foul" (routes to the story's won-ugly ending), and no roll is made. Both foul = mutual ruin.
        if (PERF?.foul && (atkAct === PERF.foul || defAct === PERF.foul)) {
          const aF = atkAct === PERF.foul, dF = defAct === PERF.foul;
          state.foulBy = aF && dF ? "both" : (aF ? "A" : "D");
          state.outcome = aF && dF ? "mutualRuin" : (aF ? "attackerWin" : "defenderWin");
          state.outcomeKind = "foul";
          state.history.push({ round: state.round, atkAction: atkAct, defAction: defAct, foul: state.foulBy, note });
          const who = state.foulBy === "both" ? "Both sides" : foundry.utils.escapeHTML((aF ? A : D).name);
          await sendChat([`<b>${who}</b> ${foundry.utils.escapeHTML(PERF.foulText || "broke the one rule.")}`, `The contest is over. Nobody calls this a win, whatever the scoreboard says.`], { title: `${label}: Round ${state.round} — Foul` });
          await _expireParleyReceipts().catch(() => {});
          _emitCourtlyVfx("outcome", { outcome: state.outcome, outcomeKind: "foul", winnerSide: outcomeWinner(state), attackerName: A.name, defenderName: D.name });
          try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
          try { Hooks.callAll("bbttcc:performance:resolved", { profile: PERF.key, state: getState() }); } catch (_e) {}
          return { ...state };
        }

        let atkSpendM = Math.min(_m10(atkSpend), atkKey ? bankOpOf(A, atkKey) : 0);   // marks
        let defSpendM = Math.min(_m10(defSpend), defKey ? bankOpOf(D, defKey) : 0);
        let atkSpendInt = atkSpendM / 10;   // effect units: per 10 marks
        let defSpendInt = defSpendM / 10;

        // Phase D — Call the Question: cap spending for `roundsRemaining` round(s).
        const _lockCapM = state.spendLock?.roundsRemaining > 0 ? Number(state.spendLock.maxSpend ?? 0) * 10 : null;   // rule unit: maxSpend is per 10 marks — Sweeten obeys the lock too (2026-10-28)
        if (state.spendLock?.roundsRemaining > 0) {
          const cap = Number(state.spendLock.maxSpend ?? 0);
          if (atkSpendInt > cap || defSpendInt > cap) {
            await sendChat([`Spending lock active: capped at ${cap * 10} marks per side this round.`]   /* rule unit: cap is per 10 marks */, { title: `${label}: Spending Lock` });
          }
          atkSpendInt = Math.min(atkSpendInt, cap); atkSpendM = atkSpendInt * 10;
          defSpendInt = Math.min(defSpendInt, cap); defSpendM = defSpendInt * 10;
          state.spendLock.roundsRemaining -= 1;
          if (state.spendLock.roundsRemaining <= 0) delete state.spendLock;
        }

        // Spend OP from relevant pools
        if (atkKey && atkSpendM) await adjustOpBank(A, atkKey, -atkSpendM, label);
        if (defKey && defSpendM) await adjustOpBank(D, defKey, -defSpendM, label);

        // ALPHA CUT ruling 5 — Sweeten the deal. The marks move NOW to the other side's pool for the chosen action and
        // stay there whatever the roll says; the sweetener rolls +1 per SWEETEN_PER marks this exchange (the staged-OP price).
        const sweetNotes = [];
        const SWEETEN_PER = Math.max(1, Math.round(10 * 2 * ((Number(raidApi.PRICE_MULT) > 0) ? Number(raidApi.PRICE_MULT) : 0.75)));
        const _sweeten = async (from, to, poolKey, marks) => {
          const pk = poolKey || "diplomacy";
          let m = Math.min(_m10(marks), bankOpOf(from, pk));
          if (_lockCapM !== null && m > _lockCapM) { sweetNotes.push(`Spending lock: ${foundry.utils.escapeHTML(from.name)}'s sweetener capped at ${_lockCapM} marks.`); m = _lockCapM; }   // freezePurse / Call the Question (2026-10-28)
          if (m <= 0) return 0;
          await adjustOpBank(from, pk, -m, `${label}: sweetened the deal`);
          await adjustOpBank(to, pk, +m, `${label}: ${from.name} sweetened the deal`);
          const b = Math.ceil(m / SWEETEN_PER);
          sweetNotes.push(`${foundry.utils.escapeHTML(from.name)} sweetens the deal: ${m} marks to ${foundry.utils.escapeHTML(to.name)}, in the open (+${b} this exchange).`);
          return b;
        };
        const atkSweetBonus = atkSweeten > 0 ? await _sweeten(A, D, atkKey, atkSweeten) : 0;
        const defSweetBonus = defSweeten > 0 ? await _sweeten(D, A, defKey, defSweeten) : 0;

        // Compute bonuses
        let atkBonus = Number(atkSkillBonus || 0) + atkSweetBonus;
        let defBonus = Number(defSkillBonus || 0) + defSweetBonus;

        // Lead + Support coalition OP bonus (for the chosen action's category).
        // Caller computes via _rcCoalitionBonus on action's matched key (persuade→diplomacy,
        // inspire→softpower, expose→intrigue, intimidate→violence) and passes the totals here.
        const atkOpBonusInt = Math.max(0, Math.floor(Number(atkOpBonus || 0)));
        const defOpBonusInt = Math.max(0, Math.floor(Number(defOpBonus || 0)));
        atkBonus += atkOpBonusInt;
        defBonus += defOpBonusInt;

        if (atkAct === "persuade")  atkBonus += Math.ceil(atkSpendInt / 2);
        if (defAct === "persuade")  defBonus += Math.ceil(defSpendInt / 2);

        if (atkAct === "inspire")   atkBonus += Math.ceil(atkSpendInt / 2);
        if (defAct === "inspire")   defBonus += Math.ceil(defSpendInt / 2);

        if (atkAct === "expose")    atkBonus += Math.ceil(atkSpendInt / 2);
        if (defAct === "expose")    defBonus += Math.ceil(defSpendInt / 2);

        if (atkAct === "intimidate") {
          atkBonus += Math.ceil(atkSpendInt / 2);
          atkBonus += presenceBonus(A);
        }
        if (defAct === "intimidate") {
          defBonus += Math.ceil(defSpendInt / 2);
          defBonus += presenceBonus(D);
        }

        // Phase C — Court Bonus from courtier favor. Computed AT step entry
        // so the value the HUD displays is consistent with what the roll uses.
        const courtBonusA = computeCourtBonus(state.attackerId, state.defenderId);
        const courtBonusD = computeCourtBonus(state.defenderId, state.attackerId);
        state.courtBonusA = courtBonusA;
        state.courtBonusD = courtBonusD;
        atkBonus += courtBonusA;
        defBonus += courtBonusD;

        // Balance ruling 2026-10-09 (Dave): coalition OP bonus + court bonus
        // combined is capped at +COURTLY_BACKING_CAP per side, so lopsided
        // backing can't blow the duel out before skill and spend matter.
        const COURTLY_BACKING_CAP = 5;
        const capNotes = [];
        const _capBacking = (opInt, cb, who) => {
          const over = Math.max(0, opInt + Math.max(0, cb) - COURTLY_BACKING_CAP);
          if (over > 0) capNotes.push(`${who} backing capped at +${COURTLY_BACKING_CAP} (allies +${opInt}, ${AUD().many} ${cb >= 0 ? "+" : ""}${cb}).`);
          return over;
        };
        atkBonus -= _capBacking(atkOpBonusInt, courtBonusA, "Attacker");
        defBonus -= _capBacking(defOpBonusInt, courtBonusD, "Defender");

        // Phase C — Suspicion threshold-5 effects ("Court is uneasy" per
        // spec §4.1). Reads suspicion BEFORE this round's updates.
        const uneasy = !_suspOff() && state.suspicion >= 5;   // ruling 3: hidden track never makes the court uneasy (2026-10-28)
        if (uneasy) {
          if (atkAct === "expose")   atkBonus += 1;
          if (defAct === "expose")   defBonus += 1;
          if (atkAct === "persuade") atkBonus -= 1;
          if (defAct === "persuade") defBonus -= 1;
        }

        // Maneuvers + staging (paid, so never capped).
        const atkManInt = Math.trunc(Number(atkManBonus) || 0), defManInt = Math.trunc(Number(defManBonus) || 0);
        atkBonus += atkManInt;
        defBonus += defManInt;

        // Apply scandal penalties (–2 next exchange)
        if (state.scandalOnA) atkBonus -= 2;
        if (state.scandalOnD) defBonus -= 2;

        // Phase C — Consume pendingMods queue (one-shot bonuses + reroll flags
        // queued by secret plays / Phase D anytimes).
        // Phase D — `actionBonus` entries match-or-carry.
        // Phase E — `fireOnRound` gates Scar penalties to a specific round
        //           (heavy = round 1 + round 2 split). Mods with fireOnRound
        //           set are skipped on non-matching rounds; carried forward.
        let forceAReroll = false, forceDReroll = false;
        let truce = false, decree = null;   // Halloween hoard receipts (2026-10-31): Recess / Sovereign Writ, queued as pendingMods
        const consumedMods = [];
        const carriedMods = [];
        for (const mod of (state.pendingMods || [])) {
          // Round-gated mods (Scar penalties): skip + carry if not this round.
          if (mod.fireOnRound != null && Number(mod.fireOnRound) !== state.round) {
            // Once past the target round, drop it.
            if (Number(mod.fireOnRound) < state.round) { /* expired — drop */ }
            else carriedMods.push(mod);
            continue;
          }
          if (mod.type === "bonus" && mod.side === "A") { atkBonus += Number(mod.value || 0); consumedMods.push(`atk ${mod.value > 0 ? "+" : ""}${mod.value} (${mod.source || "secret"})`); }
          else if (mod.type === "bonus" && mod.side === "D") { defBonus += Number(mod.value || 0); consumedMods.push(`def ${mod.value > 0 ? "+" : ""}${mod.value} (${mod.source || "secret"})`); }
          else if (mod.type === "forceReroll" && mod.side === "A") { forceAReroll = true; consumedMods.push(`atk forced to reroll — rolls twice, keeps the worse (${mod.source || "secret"})`); }
          else if (mod.type === "forceReroll" && mod.side === "D") { forceDReroll = true; consumedMods.push(`def forced to reroll — rolls twice, keeps the worse (${mod.source || "secret"})`); }
          else if (mod.type === "truce") { truce = true; consumedMods.push(`recess — no Influence lost this exchange (${mod.source || "receipt"})`); }
          else if (mod.type === "decree" && (mod.side === "A" || mod.side === "D")) { decree = mod.side; consumedMods.push(`${mod.side === "A" ? "atk" : "def"} wins this exchange outright (${mod.source || "receipt"})`); }
          else if (mod.type === "actionBonus") {
            const sideAct = mod.side === "A" ? atkAct : defAct;
            const filter = Array.isArray(mod.actionFilter) ? mod.actionFilter : [];
            if (filter.includes(sideAct)) {
              if (mod.side === "A") atkBonus += Number(mod.value || 0);
              else defBonus += Number(mod.value || 0);
              consumedMods.push(`${mod.side} ${sideAct} ${mod.value > 0 ? "+" : ""}${mod.value} (${mod.source || "anytime"})`);
            } else {
              carriedMods.push(mod);  // wait for a matching action next round
            }
          }
          else carriedMods.push(mod);
        }
        state.pendingMods = carriedMods;

        // Clear scandal markers; new ones may be set based on this round
        let nextScandalOnA = false;
        let nextScandalOnD = false;

        // Exploding dice + armed Momentum / Surge (owner ruling 2026-11-04). The armed die rides the first throw.
        // Advantage / disadvantage (maneuvers) = a second plain throw, keep the better / worse. A forced reroll
        // ("force your opponent to reroll", 2026-11-11) used to throw again and keep the new roll — statistically
        // nothing. It now bites: that side rolls twice and keeps the worse (cancels an advantage).
        const _courtRoll = (bonus, faction) => (game.bbttcc?.dice?.rollArmed?.("2d10x10 + @b", { b: bonus }, { faction }) ?? new Roll("2d10x10 + @b", { b: bonus }).evaluate());
        const _plainRoll = (bonus) => new Roll("2d10x10 + @b", { b: bonus }).evaluate();
        const _modeOf = (m) => { const k = String(m || "normal").toLowerCase(); return (k === "adv" || k === "advantage") ? "adv" : (k === "dis" || k === "disadvantage") ? "dis" : "normal"; };
        let aMode = _modeOf(atkMode), dMode = _modeOf(defMode);
        if (forceAReroll) aMode = (aMode === "adv") ? "normal" : "dis";
        if (forceDReroll) dMode = (dMode === "adv") ? "normal" : "dis";
        const _rollMode = async (bonus, faction, mode) => {
          const r1 = await _courtRoll(bonus, faction);
          if (mode === "normal") return r1;
          const r2 = await _plainRoll(bonus);
          const t1 = Number(r1.total ?? 0), t2 = Number(r2.total ?? 0);
          return (mode === "adv") ? (t2 > t1 ? r2 : r1) : (t2 < t1 ? r2 : r1);
        };
        let atkRoll = await _rollMode(atkBonus, A, aMode);
        let defRoll = await _rollMode(defBonus, D, dMode);

        const atkTotal = atkRoll.total ?? 0;
        const defTotal = defRoll.total ?? 0;
        let margin     = atkTotal - defTotal;

        let result;
        if (atkTotal === defTotal) {
          result = "tie";
        } else if (atkTotal > defTotal) {
          result = "attacker";
        } else {
          result = "defender";
        }
        // Sovereign Writ (2026-10-31): the decreed side wins this exchange outright — the dice still show, the record reads a 3-point win
        // at least (a Writ is not a rout). Scandal / backlash / Suspicion then follow the forced result as they would any other.
        if (decree === "A") { result = "attacker"; if (margin < 3) margin = 3; }
        else if (decree === "D") { result = "defender"; if (margin > -3) margin = -3; }

        // Influence damage
        let damageToD = 0;
        let damageToA = 0;
        let extraNotes = [...capNotes, ...sweetNotes, ...(Array.isArray(manNotes) ? manNotes.map(n => foundry.utils.escapeHTML(String(n))) : [])];
        if (aMode !== "normal") extraNotes.push(`${foundry.utils.escapeHTML(A.name)} rolled twice and kept the ${aMode === "adv" ? "better" : "worse"}.`);
        if (dMode !== "normal") extraNotes.push(`${foundry.utils.escapeHTML(D.name)} rolled twice and kept the ${dMode === "adv" ? "better" : "worse"}.`);
        if (decree) extraNotes.push(`Sovereign Writ: ${decree === "A" ? A.name : D.name} wins this exchange by decree.`);
        if (truce)  extraNotes.push("Recess: nobody loses Influence this exchange — the table talked, and the record shows it.");

        if (result === "attacker") {
          const dmg = Math.max(1, Math.abs(margin));
          damageToD += dmg;

          // Expose → Scandal if big hit
          if (atkAct === "expose" && margin >= 6) {
            nextScandalOnD = true;
            extraNotes.push("Expose: Scandal applied to defender (–2 next exchange).");
          }
          if (state.goal === "deceive" && atkAct === "expose") { damageToD += 1; extraNotes.push("Deceive: exposed — 1 extra Influence lost."); }

          // Defender intimidated and failed badly → backlash
          if (defAct === "intimidate" && margin >= 5) {   // attacker won by 5+ → defender failed by 5+
            damageToD += 2;
            extraNotes.push("Intimidate backlash: defender loses 2 extra Influence.");
          }
        } else if (result === "defender") {
          const dmg = Math.max(1, Math.abs(margin));
          damageToA += dmg;

          if (defAct === "expose" && -margin >= 6) {
            nextScandalOnA = true;
            extraNotes.push("Expose: Scandal applied to attacker (–2 next exchange).");
          }
          // Ruling 3 — Deceive: a liar caught out bleeds one more.
          if (state.goal === "deceive" && defAct === "expose") { damageToA += 1; extraNotes.push("Deceive: exposed — 1 extra Influence lost."); }
          if (atkAct === "intimidate" && -margin >= 5) {   // defender won by 5+ → attacker failed by 5+
            damageToA += 2;
            extraNotes.push("Intimidate backlash: attacker loses 2 extra Influence.");
          }
        }

        // Apply damage
        if (truce) { damageToA = 0; damageToD = 0; }   // Recess (2026-10-31)
        const beforeA = state.influenceA;
        const beforeD = state.influenceD;
        state.influenceA = Math.max(0, state.influenceA - damageToA);
        state.influenceD = Math.max(0, state.influenceD - damageToD);

        // Phase C — Suspicion updates from this round's actions (spec §4.1).
        const suspBefore = state.suspicion;
        let suspDelta = 0;
        const susReasons = [];
        if (atkAct === "expose")    { suspDelta += 1; susReasons.push("attacker expose +1"); }
        if (defAct === "expose")    { suspDelta += 1; susReasons.push("defender expose +1"); }
        if (atkAct === "intimidate"){ suspDelta += 1; susReasons.push("attacker intimidate +1"); }
        if (defAct === "intimidate"){ suspDelta += 1; susReasons.push("defender intimidate +1"); }
        // Failed expose by 5+ — both sides checked
        if (atkAct === "expose" && result === "defender" && (-margin) >= 5) {
          suspDelta += 2; susReasons.push("attacker expose failed by 5+ → +2");
        }
        if (defAct === "expose" && result === "attacker" && margin >= 5) {
          suspDelta += 2; susReasons.push("defender expose failed by 5+ → +2");
        }
        // Quiet streak: neither side did expose or intimidate this round.
        const wasQuiet = !["expose", "intimidate"].includes(atkAct)
                      && !["expose", "intimidate"].includes(defAct);
        if (wasQuiet) {
          state.suspicionQuietStreak += 1;
          // Per spec §4.1: "maintaining 2 consecutive rounds with no
          // expose/intimidate (–1 per quiet round)" — drop starts on 3rd
          // consecutive quiet round so the 2-round maintenance is the
          // earned gate.
          if (state.suspicionQuietStreak > 2) {
            suspDelta -= 1; susReasons.push(`quiet round ${state.suspicionQuietStreak} → −1`);
          }
        } else {
          state.suspicionQuietStreak = 0;
        }

        // ── Social obstacle-KEY effects ──────────────────────────────────────
        // "The Last Word" (Cosmic Linguist): the armed side's aggressive play this round raises
        // NO Suspicion. Diplomatic Envoys (crew): −1 Suspicion on that side's aggressive play.
        // Per-side — computed from this round's OWN contributions so only the acting side is hit.
        const _sideSuspContribution = (act, isAtk) => {
          let s = 0;
          if (act === "expose") s += 1;
          if (act === "intimidate") s += 1;
          if (act === "expose" && ((isAtk && result === "defender" && (-margin) >= 5) || (!isAtk && result === "attacker" && margin >= 5))) s += 2;
          return s;
        };
        const _lwA = !!state.lastWordA, _lwD = !!state.lastWordD;   // Envoys can't cut below zero once Last Word zeroed the side (2026-10-28)
        if (state.lastWordA) { const s = _sideSuspContribution(atkAct, true); if (s > 0) { suspDelta -= s; susReasons.push("⚜ The Last Word — attacker raises no Suspicion"); } state.lastWordA = false; }
        if (state.lastWordD) { const s = _sideSuspContribution(defAct, false); if (s > 0) { suspDelta -= s; susReasons.push("⚜ The Last Word — defender raises no Suspicion"); } state.lastWordD = false; }
        if (state.envoysA && !_lwA) { if (_sideSuspContribution(atkAct, true) > 0) { suspDelta -= 1; susReasons.push("Diplomatic Envoys — attacker Suspicion −1"); } }
        if (state.envoysD && !_lwD) { if (_sideSuspContribution(defAct, false) > 0) { suspDelta -= 1; susReasons.push("Diplomatic Envoys — defender Suspicion −1"); } }

        // Ruling 3 — Suspicion only runs for Stay unnoticed (Impress keeps it as the crowd track). Persuade / Deceive: nobody is hiding.
        if (!PERF && state.suspicionEnabled === false) { suspDelta = 0; susReasons.length = 0; state.suspicionQuietStreak = 0; }
        state.suspicion = clamp(suspBefore + suspDelta, 0, 10);

        // Phase F — VFX hooks for suspicion threshold crosses (broadcast to all clients).
        if (state.suspicion >= 5 && suspBefore < 5) {
          _emitCourtlyVfx("suspicion-threshold", { level: 5, before: suspBefore, after: state.suspicion });
        }
        if (state.suspicion >= 8 && suspBefore < 8) {
          _emitCourtlyVfx("suspicion-threshold", { level: 8, before: suspBefore, after: state.suspicion });
        }
        if (state.suspicion >= 10 && suspBefore < 10) {
          _emitCourtlyVfx("court-collapse", { suspicion: state.suspicion });
        }

        // Phase C — Suspicion threshold reactions (spec §4.1).
        // Threshold 8 — neutral courtier defects to higher-influence side.
        if (!_suspOff() && state.suspicion >= 8 && suspBefore < 8) {
          try {
            const higherSideId = (state.influenceA >= state.influenceD) ? state.attackerId : state.defenderId;
            const neutralToken = (game.bbttcc?.api?.raid?.tableau?.courtiers?.() ?? []).find(tk => {   // courtiers on ANY scene (2026-10-22)
              const cf = tk.actor?.flags?.[MOD_R]?.courtFavor || {};
              return Number(cf[state.attackerId] || 0) === 0 && Number(cf[state.defenderId] || 0) === 0;
            });
            if (neutralToken?.actor) {
              const cf = foundry.utils.duplicate(neutralToken.actor.flags?.[MOD_R]?.courtFavor || {});
              cf[higherSideId] = 1;
              await neutralToken.actor.update({ [`flags.${MOD_R}.courtFavor`]: cf });
              extraNotes.push(`Crisis (suspicion ≥ 8): ${neutralToken.actor.name} defects to the ${higherSideId === state.attackerId ? "attacker" : "defender"}'s side (favor +1).`);
            } else {
              extraNotes.push(`Crisis (suspicion ≥ 8): no neutral ${AUD().one} available to defect.`);
            }
          } catch (e) { console.warn(TAG, "threshold-8 defect failed", e); }
        }
        // Threshold 10 — court collapses; force outcome by lower influence.
        // Phase E will replace with the full Public Humiliation 5-outcome.
        if (!_suspOff() && state.suspicion >= 10 && !state.courtCollapsed) {
          state.courtCollapsed = true;
          extraNotes.push(`Collapse (suspicion = 10): the ${AUD().many} turn on the noisier side.`);
        }

        // Determine outcome (collapse may force; otherwise damage-based)
        if (state.courtCollapsed && state.outcome === "ongoing") {
          if (state.influenceA < state.influenceD) state.outcome = "defenderWin";
          else if (state.influenceD < state.influenceA) state.outcome = "attackerWin";
          else state.outcome = "mutualRuin";
        } else if (state.influenceA <= 0 && state.influenceD <= 0) {
          state.outcome = "mutualRuin";
        } else if (state.influenceD <= 0) {
          state.outcome = "attackerWin";
        } else if (state.influenceA <= 0) {
          state.outcome = "defenderWin";
        }
        // Phase E — Round cap (spec §8 resolution 5). If we hit the cap with
        // no decisive outcome and both sides above 25% max, declare stalemate.
        else if (state.round >= state.roundCap) {
          const aPct = state.maxA > 0 ? state.influenceA / state.maxA : 0;
          const dPct = state.maxD > 0 ? state.influenceD / state.maxD : 0;
          // A named-rounds Parley (2026-11-13) is short by design — at its last round the side ahead by 15 points of
          // Influence carries the table; closer than that is a stalemate.
          if (state.rounds?.length) state.outcome = (aPct - dPct >= 0.15) ? "attackerWin" : (dPct - aPct >= 0.15) ? "defenderWin" : "stalemate";
          else if (aPct > 0.25 && dPct > 0.25) state.outcome = "stalemate";
          else if (aPct < dPct) state.outcome = "defenderWin";
          else if (dPct < aPct) state.outcome = "attackerWin";
          else state.outcome = "stalemate";
        }
        // Phase E — Map damage-based outcome to flavored kind for marks.
        if (state.outcome !== "ongoing" && !state.outcomeKind) {
          state.outcomeKind = detectOutcomeKind(state);
        }
        // Ruling 3 — a Deceive win is recorded as a deception for later beats to read.
        if (state.outcome === "attackerWin" && state.goal === "deceive") state.deceived = D.id;
        if (state.outcome === "defenderWin" && state.goal === "deceive") state.deceived = A.id;

        // Record new scandal flags
        state.scandalOnA = nextScandalOnA;
        state.scandalOnD = nextScandalOnD;

        const histEntry = {
          round: state.round,
          atkAction: atkAct,
          defAction: defAct,
          atkSpend: atkSpendInt,
          defSpend: defSpendInt,
          atkTotal,
          defTotal,
          margin,
          result,
          damageToA,
          damageToD,
          influenceA_before: beforeA,
          influenceD_before: beforeD,
          influenceA_after: state.influenceA,
          influenceD_after: state.influenceD,
          scandalOnA: state.scandalOnA,
          scandalOnD: state.scandalOnD,
          suspicion_before: suspBefore,
          suspicion_after: state.suspicion,
          suspicion_delta: suspDelta,
          suspicion_reasons: susReasons,
          courtBonusA,
          courtBonusD,
          uneasy,
          courtCollapsed: state.courtCollapsed,
          note
        };
        state.history.push(histEntry);

        await playRollFX({
          attackerName: A.name,
          defenderName: D.name,
          attackerTotal: atkTotal,
          defenderTotal: defTotal,
          margin
        });
        await playInfluenceFX({ beforeA, beforeD, afterA: state.influenceA, afterD: state.influenceD });

        const _opLine = (lbl, k, opb) => {
          const parts = [];
          if (opb > 0) parts.push(`coalition ${k} +${opb}`);
          return parts.length ? ` <small style="opacity:.7;">(${parts.join(", ")})</small>` : "";
        };
        const _cbLine = (cb) => cb !== 0 ? ` <small style="opacity:.7;">(${AUD().many} ${cb > 0 ? "+" : ""}${cb})</small>` : "";
        const lines = [
          `Round ${state.round}: <b>${foundry.utils.escapeHTML(A.name)}</b> vs <b>${foundry.utils.escapeHTML(D.name)}</b>`,
          `Actions: Attacker <i>${foundry.utils.escapeHTML(_nm(atkAct))}</i> (spend ${atkSpendInt})${_opLine("atk", atkKey || "", atkOpBonusInt)}${_cbLine(courtBonusA)} vs Defender <i>${foundry.utils.escapeHTML(_nm(defAct))}</i> (spend ${defSpendInt})${_opLine("def", defKey || "", defOpBonusInt)}${_cbLine(courtBonusD)}`,
          `Rolls: Attacker ${atkTotal} vs Defender ${defTotal} (margin ${margin >= 0 ? "+"+margin : margin})`,
          `Result: ${result.toUpperCase()} — Influence ${beforeA}/${beforeD} → ${state.influenceA}/${state.influenceD}`
        ];
        // One-shot mods (door introductions, scar penalties, secret plays)
        // were consumed silently before 2026-07-14 — surface the receipt.
        if (consumedMods.length) {
          lines.splice(3, 0, `Mods: <small style="opacity:.8;">${consumedMods.map(m => foundry.utils.escapeHTML(m)).join("; ")}</small>`);
        }
        if (suspDelta !== 0 || uneasy) {
          lines.push(`${PERF ? foundry.utils.escapeHTML(PERF.crowdTrack || "Crowd") : "Suspicion"} ${suspBefore} → ${state.suspicion}${uneasy ? ` <small style="opacity:.7;">(${PERF ? "the crowd is restless" : "court uneasy"})</small>` : ""}${susReasons.length ? ` <small style=\"opacity:.7;\">(${susReasons.join("; ")})</small>` : ""}`);
        }
        if (extraNotes.length) lines.push(...extraNotes.map(n => foundry.utils.escapeHTML(n)));
        if (note) lines.push(foundry.utils.escapeHTML(note));

        let title = `${label}: Round ${state.round}`;
        if (state.outcome === "attackerWin") title += " — Attacker Wins";
        else if (state.outcome === "defenderWin") title += " — Defender Wins";
        else if (state.outcome === "mutualRuin") title += " — Mutual Ruin";

        await sendChat(lines, { title });

        // Phase C/E — Rel-delta on outcome transition. Step() early-returns
        // when state.outcome !== "ongoing" at entry, so any non-ongoing
        // outcome we see here IS this round's transition. Fires once.
        if (state.outcome !== "ongoing") {
          // PERFORMANCE MODE: a contest is friendly — no relation shifts, no scandal scars or court marks; the story's own
          // ending beats carry the consequences (raid-performance routes them).
          if (!PERF) {
          try { await applyRelDeltas(A, D, state.outcomeKind, outcomeWinner(state), label); }
          catch (e) { console.warn(TAG, "applyRelDeltas failed", e); }
          // Phase E — apply per-outcome marks (scars, favor gifts, secrets,
          // suspicion reset, courtier loss). Fires once.
          try { await _applyOutcomeMarks(); }
          catch (e) { console.warn(TAG, "_applyOutcomeMarks failed", e); }
          } else { try { Hooks.callAll("bbttcc:performance:resolved", { profile: PERF.key, state: getState() }); } catch (_e) {} }
          // Phase F — broadcast outcome VFX to all clients.
          await _expireParleyReceipts().catch(() => {});
          _emitCourtlyVfx("outcome", {
            outcome: state.outcome,
            outcomeKind: state.outcomeKind,
            winnerSide: outcomeWinner(state),
            attackerName: A.name,
            defenderName: D.name
          });
        }

        if (state.outcome === "ongoing" && state.rounds?.length && state.round < state.rounds.length) await _postRound(state.round);
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}

        return { ...state };
      }

      // ALPHA CUT ruling 4 — receipts belong to the Parley that made them. When this one ends, its unspent receipts go.
      async function _expireParleyReceipts() {
        let n = 0;
        for (const actor of [A, D]) {
          const ids = (actor?.items?.contents || []).filter(i => i.flags?.[MOD_R]?.secret?.parleyId === state.id).map(i => i.id);
          if (!ids.length) continue;
          try { await actor.deleteEmbeddedDocuments("Item", ids); n += ids.length; } catch (e) { console.warn(TAG, "receipt expiry failed", e); }
        }
        if (n) await sendChat([`${n} receipt${n === 1 ? "" : "s"} from this Parley ${n === 1 ? "is" : "are"} spent — ${n === 1 ? "it" : "they"} belonged to this table.`], { title: `${label}: Receipts` });
      }

      function getState() {
        try { return structuredClone(state); }
        catch { return JSON.parse(JSON.stringify(state)); }
      }

      // Phase C — API surface for Phase D anytimes + GM/macro callers.
      // Ruling 3 — Suspicion is off for Persuade / Deceive: outside raises (stolen receipts, Stir the Pot, Mask Off…) do nothing (2026-10-28).
      function _suspOff() { return !PERF && state.suspicionEnabled === false; }
      async function raiseSuspicion(n = 1, why = "") {
        if (_suspOff()) return state.suspicion;
        const before = state.suspicion;
        state.suspicion = clamp(before + Math.max(0, Math.floor(Number(n) || 0)), 0, 10);
        // External rises break the quiet streak.
        state.suspicionQuietStreak = 0;
        if (state.suspicion > before) {
          await sendChat([`Suspicion ${before} → ${state.suspicion}${why ? ` <small style="opacity:.7;">(${foundry.utils.escapeHTML(why)})</small>` : ""}`], { title: `${label}: Suspicion +${state.suspicion - before}` });
          try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        }
        return state.suspicion;
      }
      async function lowerSuspicion(n = 1, why = "") {
        const before = state.suspicion;
        state.suspicion = clamp(before - Math.max(0, Math.floor(Number(n) || 0)), 0, 10);
        if (state.suspicion < before) {
          await sendChat([`Suspicion ${before} → ${state.suspicion}${why ? ` <small style="opacity:.7;">(${foundry.utils.escapeHTML(why)})</small>` : ""}`], { title: `${label}: Suspicion −${before - state.suspicion}` });
          try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        }
        return state.suspicion;
      }
      // One write target for favor (2026-10-28): the courtier TOKEN's actor (unlinked → its ActorDelta), which is what
      // every reader (court bonus, HUD pills, Patron gate) sees. Accepts an Actor document, a token id, or an actor id.
      function _courtierActor(ref) {
        if (ref && typeof ref === "object" && typeof ref.update === "function") return ref;
        const id = String(ref || "").replace(/^(Actor|Token)\./, "");
        if (!id) return null;
        const toks = (game.bbttcc?.api?.raid?.tableau?.courtiers?.() ?? []);
        return toks.find(t => t.id === id)?.actor || toks.find(t => t.actor?.id === id)?.actor || game.actors?.get(id) || null;
      }
      async function adjustFavor(actorId, factionId, delta) {
        const actor = _courtierActor(actorId);
        if (!actor || !factionId || !delta) return null;
        const cur = foundry.utils.duplicate(actor.flags?.[MOD_R]?.courtFavor || {});
        const before = Number(cur[factionId] ?? 0);
        const after = clamp(before + Math.floor(Number(delta) || 0), -3, 3);
        if (after === before) return before;
        cur[factionId] = after;
        await actor.update({ [`flags.${MOD_R}.courtFavor`]: cur });
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        // Phase F — broadcast favor VFX (floating +N/-N near courtier token)
        _emitCourtlyVfx("favor", { actorId: actor.id, factionId, before, after, delta: after - before });
        return after;
      }

      // Phase C — Pending-mod queuers for secret-card / anytime effects.
      // `side` is "attacker" or "defender" (normalized to "A"/"D" internally).
      function _normSide(side) {
        const s = String(side || "").toLowerCase();
        if (s === "a" || s === "attacker" || s === "att" || s === state.attackerId) return "A";
        if (s === "d" || s === "defender" || s === "def" || s === state.defenderId) return "D";
        return null;
      }
      function queueRollMod(side, value, source = "secret") {
        const s = _normSide(side);
        if (!s || !Number.isFinite(Number(value))) return false;
        state.pendingMods.push({ side: s, type: "bonus", value: Math.floor(Number(value)), source });
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return true;
      }
      function queueReroll(side, source = "secret") {
        const s = _normSide(side);
        if (!s) return false;
        state.pendingMods.push({ side: s, type: "forceReroll", source });
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return true;
      }
      // ── Halloween hoard receipts (2026-10-31) — the reality-bending set. Each is a one-shot the step() consumes or a state edit. ──
      // Recess: the NEXT exchange deals no Influence damage to either side (scandal, Suspicion and marks still happen).
      function queueTruce(source = "receipt") {
        state.pendingMods.push({ side: "both", type: "truce", source });
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return true;
      }
      // Sovereign Writ: the side wins the NEXT exchange outright (result forced, margin at least 3 in their favour).
      function queueDecree(side, source = "receipt") {
        const s = _normSide(side);
        if (!s) return false;
        state.pendingMods.push({ side: s, type: "decree", source });
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return true;
      }
      // The Room Remembers Differently: strike the LAST exchange from the record — Influence, Suspicion, scandal and the round
      // counter go back to where they stood before it. Marks spent and receipts played in it stay spent (the table remembers
      // the money, if not the words). Only while the court is ongoing; a foul round cannot be struck.
      async function undoLastExchange(source = "receipt") {
        if (state.outcome !== "ongoing") return { ok: false, why: "the court has concluded" };
        const h = Array.isArray(state.history) ? state.history : [];
        const last = h.length ? h[h.length - 1] : null;
        if (!last || last.foul || typeof last.influenceA_before !== "number") return { ok: false, why: "no exchange on the record to strike" };
        h.pop();
        const prev = h.length ? h[h.length - 1] : null;
        state.influenceA = Math.max(0, Number(last.influenceA_before) || 0);
        state.influenceD = Math.max(0, Number(last.influenceD_before) || 0);
        if (typeof last.suspicion_before === "number") state.suspicion = Math.max(0, last.suspicion_before);
        state.scandalOnA = !!(prev && prev.scandalOnA);
        state.scandalOnD = !!(prev && prev.scandalOnD);
        state.courtCollapsed = false;
        state.round = Math.max(0, Number(state.round) - 1);
        await sendChat([`The room remembers differently: exchange ${last.round} is struck from the record. ${foundry.utils.escapeHTML(A.name)} ${state.influenceA} · ${foundry.utils.escapeHTML(D.name)} ${state.influenceD}${state.suspicionEnabled ? ` · Suspicion ${state.suspicion}` : ""} <small style=\"opacity:.7;\">(${foundry.utils.escapeHTML(source)})</small>`], { title: `${label}: Struck` });
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return { ok: true, round: last.round };
      }
      // Name the Price: every courtier's favor toward BOTH sides, plus the court bonus each side carries — whispered to the asking
      // side's seats and the GM only (it is their receipt; the other side bought no price list).
      async function revealCourt(side, source = "receipt") {
        const s = _normSide(side);
        if (!s) return { ok: false, why: "no side" };
        const selfFid = s === "A" ? state.attackerId : state.defenderId, oppFid = s === "A" ? state.defenderId : state.attackerId;
        const tokens = (game.bbttcc?.api?.raid?.tableau?.courtiers?.() ?? []);
        const rows = tokens.map(t => t?.actor).filter(Boolean).map(c => `· <b>${esc(c.name)}</b> — ${_favorOf(c, selfFid)} toward you, ${_favorOf(c, oppFid)} toward them`);
        const bonusLine = `${AUD().Many}' favor this round: ${esc(A.name)} +${Number(state.courtBonusA) || 0} · ${esc(D.name)} +${Number(state.courtBonusD) || 0}`;
        const faction = game.actors?.get?.(selfFid);
        const whisper = (game.users?.contents ?? []).filter(u => u.isGM || (faction && faction.testUserPermission?.(u, "OWNER"))).map(u => u.id);
        const lines = rows.length ? rows : [`<i>No ${AUD().many} are marked at this table (🎭) — the price list is blank.</i>`];
        await ChatMessage.create({
          content: `<p><b>${esc(label)}: The Price List</b> <small style=\"opacity:.7;\">(${esc(source)})</small></p>${lines.join("<br/>")}<br/><small>${bonusLine}</small>`,
          whisper, speaker: { alias: "Bad Eden Parley" }
        }).catch(() => {});
        return { ok: true, courtiers: rows.length };
      }
      // Rewrite the Stake: change what this Parley is FOR — Persuade / Deceive / Stay unnoticed. A performance contest keeps its
      // profile (Impress is a crowd track, not a goal you can pencil in), so it refuses there.
      async function setGoal(goal, source = "receipt") {
        const g = String(goal || "").toLowerCase();
        if (PERF || g === "impress" || !GOAL_LABELS[g]) return false;
        if (g === state.goal) return false;
        const before = state.goalLabel;
        state.goal = g; state.goalLabel = GOAL_LABELS[g];
        state.suspicionEnabled = g === "unnoticed";
        state.trackLabel = g === "unnoticed" ? "Suspicion" : null;
        await sendChat([`The agenda is amended in pencil: this Parley is now <b>${esc(state.goalLabel)}</b> (was ${esc(before)}). <small style=\"opacity:.7;\">(${esc(source)})</small>`], { title: `${label}: Stake rewritten` });
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return true;
      }
      // Counterfeit Truth: the side's NEXT stolen receipt plays as earned — no Suspicion bump, no betrayal memory. Armed here,
      // consumed by the secrets API at play time.
      function armCounterfeit(side, source = "receipt") {
        const s = _normSide(side);
        if (!s) return false;
        state[`counterfeit${s}`] = String(source || "receipt");
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return true;
      }
      function consumeCounterfeit(side) {
        const s = _normSide(side);
        if (!s || !state[`counterfeit${s}`]) return false;
        delete state[`counterfeit${s}`];
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return true;
      }
      async function dealInfluenceDamage(side, n, source = "secret") {
        const s = _normSide(side);
        const amount = Math.max(0, Math.floor(Number(n) || 0));
        if (!s || !amount) return null;
        const key = s === "A" ? "influenceA" : "influenceD";
        const before = state[key];
        state[key] = Math.max(0, before - amount);
        await sendChat([`Influence damage outside exchange: ${s === "A" ? A.name : D.name} loses ${amount} (${before} → ${state[key]}) <small style="opacity:.7;">(${foundry.utils.escapeHTML(source)})</small>`], { title: `${label}: Influence Damage` });
        // Check for outcome — if a side hits 0 mid-step, mark it.
        if (state.outcome === "ongoing") {
          if (state.influenceA <= 0 && state.influenceD <= 0) state.outcome = "mutualRuin";
          else if (state.influenceD <= 0) state.outcome = "attackerWin";
          else if (state.influenceA <= 0) state.outcome = "defenderWin";
          if (state.outcome !== "ongoing") {
            // Same once-only outcome transition step() runs (kind → rel deltas → marks → VFX).
            if (!state.outcomeKind) state.outcomeKind = detectOutcomeKind(state);
            if (!PERF) {   // a performance contest is friendly — same guard as step() (2026-10-28)
            try { await applyRelDeltas(A, D, state.outcomeKind, outcomeWinner(state), label); } catch (e) { console.warn(TAG, e); }
            try { await _applyOutcomeMarks(); } catch (e) { console.warn(TAG, "_applyOutcomeMarks failed", e); }
            } else { try { Hooks.callAll("bbttcc:performance:resolved", { profile: PERF.key, state: getState() }); } catch (_e) {} }
            // Ended OUTSIDE an exchange — the console only routes after its own step(), so say so (2026-10-28).
            try { Hooks.callAll("bbttcc:courtly:resolved", { scenario: apiObj, state: getState(), source }); } catch (_e) {}
            try {
              await _expireParleyReceipts().catch(() => {});
          _emitCourtlyVfx("outcome", {
                outcome: state.outcome,
                outcomeKind: state.outcomeKind,
                winnerSide: outcomeWinner(state),
                attackerName: A.name,
                defenderName: D.name
              });
            } catch (_e) {}
          }
        }
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return state[key];
      }
      async function clearScandal(side, source = "secret") {
        const s = _normSide(side);
        if (!s) return false;
        const key = s === "A" ? "scandalOnA" : "scandalOnD";
        if (!state[key]) return false;
        state[key] = false;
        await sendChat([`Scandal cleared on ${s === "A" ? A.name : D.name} <small style="opacity:.7;">(${foundry.utils.escapeHTML(source)})</small>`], { title: `${label}: Scandal Cleared` });
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return true;
      }

      // Phase D — extended effect queuers + content-driven dispatchers.
      // queueActionBonus: bonus that lands ONLY if the side's next action
      // matches one of `actionFilter`. Used by Public Toast (persuade only),
      // Sidle Closer (persuade|inspire), Patron's Word (anything but
      // intimidate). Consumed at step() bonus calc after action read.
      function queueActionBonus(side, actionFilter, value, source = "anytime") {
        const s = _normSide(side);
        if (!s || !Number.isFinite(Number(value))) return false;
        const filter = Array.isArray(actionFilter) ? actionFilter.slice() : [String(actionFilter || "")];
        state.pendingMods.push({
          side: s, type: "actionBonus",
          actionFilter: filter, value: Math.floor(Number(value)),
          source
        });
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return true;
      }

      // Phase D — Stage a Distraction: opp discards a stolen secret if held.
      async function discardSecret(side, filter = {}) {
        const s = _normSide(side);
        if (!s) return null;
        const targetActor = s === "A" ? A : D;
        const items = (targetActor.items?.contents || []).filter(i => {
          const sec = i.flags?.[MOD_R]?.secret;
          if (!sec) return false;
          if (filter.acquisition && sec.acquisition !== filter.acquisition) return false;
          return true;
        });
        if (items.length === 0) {
          await sendChat([`${esc(targetActor.name)} holds no matching secret to discard.`], { title: `${label}: Discard` });
          return null;
        }
        const target = items[Math.floor(Math.random() * items.length)];
        await targetActor.deleteEmbeddedDocuments("Item", [target.id]);
        await sendChat([`${esc(targetActor.name)} discards a secret: <b>${esc(target.name)}</b>`], { title: `${label}: Discard` });
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return target.name;
      }

      // Phase D — Call the Question: cap spending on next exchange.
      function lockSpend(rounds = 1, maxSpend = 0) {
        state.spendLock = { roundsRemaining: Math.max(1, Math.floor(Number(rounds) || 1)), maxSpend: Math.max(0, Math.floor(Number(maxSpend) || 0)) };
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return state.spendLock;
      }

      // Social obstacle-KEY — "The Last Word" (Cosmic Linguist signature). Arms the side's NEXT
      // Expose/Intimidate to raise NO Suspicion — bypassing the meter that punishes the social
      // hammer (the courtly analog of Catastrophic Entry ignoring a wall's Threshold). Once per
      // side per scenario. (Class-affinity gate to a Cosmic Linguist on the roster = a follow-on
      // when the class-grant layer lands; v1 is invoke-gated by once-per-scenario.)
      async function armLastWord(side, source = "The Last Word") {
        const s = _normSide(side);
        if (!s) return false;
        const usedKey = s === "A" ? "lastWordUsedA" : "lastWordUsedD";
        const who = s === "A" ? A.name : D.name;
        // Class gate (class-grant layer): The Last Word is the Cosmic Linguist's signature — it
        // requires a Cosmic Linguist on that side's roster. GM may always invoke for adjudication.
        const fac = s === "A" ? A : D;
        const hasCL = !!game.bbttcc?.api?.raid?.factionHasClass?.(fac, "Cosmic Linguist");
        if (!hasCL && !game.user?.isGM) {
          await sendChat([`The Last Word requires a <b>Cosmic Linguist</b> on ${esc(who)}'s roster.`], { title: `${label}: The Last Word` });
          return false;
        }
        if (state[usedKey]) {
          await sendChat([`The Last Word has already been spoken by ${esc(who)} this scenario.`], { title: `${label}: The Last Word` });
          return false;
        }
        state[s === "A" ? "lastWordA" : "lastWordD"] = true;
        state[usedKey] = true;
        await sendChat([`<b>⚜ The Last Word</b> — ${esc(who)} prepares the unanswerable argument. Their next <b>Expose/Intimidate raises no Suspicion</b>. <small style="opacity:.7;">(${esc(source)})</small>`], { title: `${label}: The Last Word` });
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return true;
      }

      // Phase D — the room's receipts. Dave 2026-11-11: "get rid of all of them, and then build specific receipts" —
      // receipts are unique, serve a specific purpose and play in a specific Parley, so the blind draw from the
      // courtly-secrets compendium is retired (the pack stays as templates only). A Parley may carry its own
      // story-authored papers (state.roomReceipts: [{ label, effectKey, truth, acquisition? }]); Read the Room /
      // Eavesdrop turn up the next one not yet found. None authored → the room gives up nothing.
      async function drawSecret(side, acquisition = "earned") {
        const s = _normSide(side);
        if (!s) return null;
        const targetActor = s === "A" ? A : D;
        const pool = Array.isArray(state.roomReceipts) ? state.roomReceipts : [];
        state.roomReceiptsFound = Array.isArray(state.roomReceiptsFound) ? state.roomReceiptsFound : [];
        const row = pool.find(r => r && String(r.label || "").trim() && !state.roomReceiptsFound.includes(String(r.label).trim()));
        if (!row) {
          await sendChat([`${esc(targetActor.name)} works the ${esc(AUD().many)} — nothing here they can use.`], { title: `${label}: Draw` });
          return null;
        }
        const api = game.bbttcc?.api?.raid?.courtlySecrets;
        const PACK_ID = "bbttcc-master-content.courtly-secrets";
        const pack = game.bbttcc?.packs?.get?.(PACK_ID) ?? game.packs?.get(PACK_ID);
        const template = pack ? (await pack.getDocuments())[0] : null;
        if (!api?.addSecret || !template) { await sendChat([`Receipts API or template missing.`], { title: `${label}: Draw` }); return null; }
        const src = template.toObject();
        src.name = String(row.label).trim();
        src.flags = { ...(src.flags || {}), [MOD_R]: { ...(src.flags?.[MOD_R] || {}), secret: { effectKey: String(row.effectKey || "") } } };   // the row's key, not the template's
        if (row.truth) src.system = { ...(src.system || {}), description: { ...(src.system?.description || {}), value: `<p><em>${esc(row.truth)}</em></p>` } };
        const created = await api.addSecret(targetActor.id, src, { acquisition: row.acquisition || acquisition, effectKey: row.effectKey, story: true });
        if (created) {
          state.roomReceiptsFound.push(String(row.label).trim());
          await sendChat([`${esc(targetActor.name)} turns up <b>${esc(created.name)}</b>.`], { title: `${label}: Draw` });
        }
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return created;
      }

      // Backlog #3 (convo sprint) — Converse-flavored secret gathering.
      // Read the Room / Eavesdrop are conversations, not card draws: if any
      // flagged tableau courtier has ARMED extractable secrets (probed via
      // bbttcc-mal-voice's armedSecretCount API), offer to open a REAL
      // dialogue with them — nudged with maneuver-specific framing — and let
      // the divulge_secret bridge decide what (if anything) is given up.
      // Fail-soft: no mal-voice, no candidates, or the table prefers it →
      // the classic blind compendium draw, exactly as before.
      async function converseSecret(side, acquisition = "earned", flavor = "readTheRoom") {
        const s = _normSide(side);
        if (!s) return null;
        const mal = game.bbttcc?.mal?.npc;
        const canConverse = typeof mal?.nudge === "function" && typeof mal?.armedSecretCount === "function";
        const candidates = !canConverse ? [] : (game.bbttcc?.api?.raid?.tableau?.courtiers?.() ?? [])   // courtiers on ANY scene (2026-10-22)
          .map(t => ({ actor: t.actor, armed: mal.armedSecretCount(t.actor) }))
          .filter(c => c.armed > 0);
        if (!candidates.length) return drawSecret(s, acquisition);

        const asker = s === "A" ? A : D;
        const isRead = flavor !== "eavesdrop";
        const title = isRead ? "Read the Room" : "Eavesdrop";
        const opts2 = candidates.map(c =>
          `<option value="${esc(c.actor.id)}">${esc(c.actor.name)} (${c.armed} guarded truth${c.armed === 1 ? "" : "s"})</option>`).join("");
        const pick = await new Promise(resolve => {
          new Dialog({
            title: `${title} — a conversation, or the blind draw?`,
            content: `<form>
              <p style="font-size:.85em;opacity:.85;">${isRead
                ? `Someone among the ${AUD().many} is holding something. Work them in a REAL conversation — what they give up is what you get (routed through the usual divulge/approval flow) — or take the blind draw.`
                : "Slip within earshot of someone unguarded. What slips out is what you get (an overheard truth counts as stolen) — or take the blind draw."}</p>
              <div class="form-group"><label>${AUD().One}</label><select name="cid">${opts2}</select></div>
            </form>`,
            buttons: {
              talk: { label: isRead ? "Work them" : "Listen in", callback: html => resolve({ mode: "talk", actor: game.actors.get(html[0].querySelector("[name=cid]").value) || null }) },
              draw: { label: "Blind draw", callback: () => resolve({ mode: "draw" }) },
              cancel: { label: "Cancel", callback: () => resolve(null) }
            },
            default: "talk",
            close: () => resolve(null)
          }, { width: 420 }).render(true);
        });
        if (!pick) return null;
        if (pick.mode === "draw" || !pick.actor) return drawSecret(s, acquisition);

        const npc = pick.actor;
        await sendChat([isRead
          ? `${esc(asker.name)} reads the room — and marks <b>${esc(npc.name)}</b>. Work the conversation; what they give up is what you get.`
          : `${esc(asker.name)} finds an alcove within earshot of <b>${esc(npc.name)}</b>. What slips out is what you get.`
        ], { title: `${label}: ${title}` });
        const context = isRead
          ? `Amid the courtly engagement "${label}", ${asker.name} reads the room — and a Steward draws close to YOU through the press of the court. You feel seen, weighed, and strangely inclined to talk. Open with a remark that betrays your mood tonight and a hint of what weighs on you.`
          : `You believe yourself UNOBSERVED — an alcove, a colonnade, a breath alone amid the courtly engagement "${label}". Think aloud in character: what worries you tonight, whom you distrust, what you would never say in the open. Words spoken to no one can still be overheard — if the pressure of this night would TRULY loosen one of your guarded truths, you may let it slip, and a slipped truth is a stolen one. Judge that honestly.`;
        try { await mal.nudge(npc, context); }
        catch (e) { console.warn(TAG, "converse nudge failed, falling back to draw", e); return drawSecret(s, acquisition); }
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return { conversed: npc.id };
      }

      // Phase D — Patron's Word: spend −1 favor on a courtier with favor >= 2
      // toward self side, then queue a +3 bonus on next non-Intimidate action.
      async function spendFavorAndBoost(side, opts = {}) {
        const s = _normSide(side);
        if (!s) return null;
        const factionId = s === "A" ? state.attackerId : state.defenderId;
        const minFavor = Number(opts.minFavor ?? 2);
        // Find candidate courtiers with favor >= minFavor toward this side.
        const candidates = (game.bbttcc?.api?.raid?.tableau?.courtiers?.() ?? [])   // courtiers on ANY scene (2026-10-22)
          .filter(t => Number(t.actor.flags?.[MOD_R]?.courtFavor?.[factionId] ?? 0) >= minFavor);
        if (!candidates.length) {
          ui.notifications?.warn?.(`No ${AUD().one} has favor ≥ ${minFavor} toward you. Cannot invoke Patron's Word.`);
          return null;
        }
        const opts2 = candidates.map(t => `<option value="${esc(t.id)}">${esc(t.actor.name)} (favor ${_favorOf(t.actor, factionId)})</option>`).join("");   // token id → token's actor (2026-10-28)
        const pick = await new Promise(resolve => {
          new Dialog({
            title: "Patron's Word",
            content: `<form><p>Spend −1 favor with a patron (favor ≥ ${minFavor}) to call in their boon.</p><div class="form-group"><label>Patron</label><select name="cid">${opts2}</select></div></form>`,
            buttons: {
              ok: { label: "Invoke", callback: html => resolve(_courtierActor(html[0].querySelector("[name=cid]").value)) },
              cancel: { label: "Cancel", callback: () => resolve(null) }
            },
            default: "ok",
            close: () => resolve(null)
          }, { width: 360 }).render(true);
        });
        if (!pick) return null;
        await adjustFavor(pick, factionId, -1);
        queueActionBonus(s, ["persuade", "inspire", "expose"], 3, `Patron's Word (${pick.name})`);
        return pick;
      }

      function _favorOf(actor, factionId) {
        return Number(actor?.flags?.[MOD_R]?.courtFavor?.[factionId] ?? 0);
      }
      function esc(x) { return foundry.utils.escapeHTML(String(x ?? "")); }

      // Phase D — Generic scenarioEffects dispatcher called by the raid
      // console after a maneuver fires. Default `side: "A"` matches the
      // attacker-runs-the-console pattern; callers can override.
      async function applyEffects(scenarioEffects, opts = {}) {
        const selfSide = String(opts.side || "A").toUpperCase();
        const oppSide  = selfSide === "A" ? "D" : "A";
        const selfFactionId = selfSide === "A" ? state.attackerId : state.defenderId;
        const oppFactionId  = selfSide === "A" ? state.defenderId : state.attackerId;
        const resolveSide = (s) => {
          const v = String(s || "self").toLowerCase();
          if (v === "self" || v === "a" && selfSide === "A" || v === "d" && selfSide === "D") return selfSide;
          if (v === "opp" || v === "opponent" || v === "a" && selfSide === "D" || v === "d" && selfSide === "A") return oppSide;
          if (v === "either") return null; // caller handles picker
          return _normSide(s) || selfSide;
        };
        const resolveFaction = (s) => resolveSide(s) === "A" ? state.attackerId : state.defenderId;
        let burnFailed = false;   // Mask Off: no scar to burn → the rest of the bundle doesn't fire (2026-10-28)
        for (const eff of (Array.isArray(scenarioEffects) ? scenarioEffects : [])) {
          if (burnFailed) break;
          const t = String(eff?.type || "");
          try {
            switch (t) {
              case "suspicionRise":
                await raiseSuspicion(eff.delta || 1, eff.reason || "anytime"); break;
              case "suspicionFall":
                await lowerSuspicion(eff.delta || 1, eff.reason || "anytime"); break;
              case "queueRollMod":
                queueRollMod(resolveSide(eff.side), eff.value, eff.source || "anytime"); break;
              case "queueReroll":
                queueReroll(resolveSide(eff.side), eff.source || "anytime"); break;
              case "queueActionBonus":
                queueActionBonus(resolveSide(eff.side), eff.actionFilter, eff.value, eff.source || "anytime"); break;
              case "clearScandal":
                await clearScandal(resolveSide(eff.side), eff.source || "anytime"); break;
              case "favorShift": {
                // Picker for chosen courtier; favor toward resolved faction.
                const fid = resolveFaction(eff.side);
                const tokens = (game.bbttcc?.api?.raid?.tableau?.courtiers?.() ?? []);   // courtiers on ANY scene (2026-10-22)
                if (!tokens.length) { ui.notifications?.warn?.(`No ${AUD().many} on this scene — mark one with the 🎭 button on its token HUD.`); break; }
                const opts2 = tokens.map(t => `<option value="${esc(t.id)}">${esc(t.actor.name)} (favor ${_favorOf(t.actor, fid)})</option>`).join("");   // token id → token's actor (2026-10-28)
                const pick = await new Promise(resolve => {
                  new Dialog({
                    title: eff.title || "Adjust Favor",
                    content: `<form><p>${esc(eff.prompt ? String(eff.prompt).replace(/\b(courtier|observer)\b/gi, AUD().one) : `Choose ${AUD().one} (favor ${eff.delta > 0 ? "+" : ""}${eff.delta} toward ${selfSide === "A" ? A.name : D.name})`)}.</p><div class="form-group"><label>${AUD().One}</label><select name="cid">${opts2}</select></div></form>`,
                    buttons: {
                      ok: { label: "Choose", callback: html => resolve(_courtierActor(html[0].querySelector("[name=cid]").value)) },
                      cancel: { label: "Cancel", callback: () => resolve(null) }
                    },
                    default: "ok",
                    close: () => resolve(null)
                  }, { width: 360 }).render(true);
                });
                if (pick) await adjustFavor(pick, fid, eff.delta || 1);
                break;
              }
              case "discardSecret":
                await discardSecret(resolveSide(eff.side), eff.filter || {}); break;
              case "lockSpend":
                lockSpend(eff.rounds || 1, eff.maxSpend ?? 0);
                await sendChat([`Spending capped to ${(eff.maxSpend ?? 0) * 10} marks per side for ${eff.rounds || 1} round(s) (Call the Question).`], /* rule unit: maxSpend is per 10 marks */ { title: `${label}: Spending Lock` });
                break;
              case "armLastWord":
                await armLastWord(resolveSide(eff.side), eff.source || "The Last Word"); break;
              case "drawSecret":
                await drawSecret(resolveSide(eff.side), eff.acquisition || "earned"); break;
              case "converseSecret":
                await converseSecret(resolveSide(eff.side), eff.acquisition || "earned", eff.flavor || "readTheRoom"); break;
              case "spendFavor":
                await spendFavorAndBoost(selfSide, { minFavor: eff.minFavor ?? 2 }); break;
              case "noteForGM":
                await ChatMessage.create({ content: `<p><em>${esc(eff.text || "")}</em></p>`, whisper: gmIds(), speaker: { alias: "Bad Eden Parley" } }).catch(()=>{});
                break;
              case "burnScandalScar": {
                const ok = await burnScandalScar(resolveSide(eff.side));
                // If burn failed (no scar), suppress subsequent effects on this entry.
                if (!ok) burnFailed = true;
                break;
              }
              case "phaseEStub":
                ui.notifications?.warn?.(`${eff.maneuver || "This maneuver"} requires Phase E (Scandal Scars). Stubbed for now.`);
                break;
              default:
                console.warn(TAG, "unknown scenarioEffect type:", t, eff);
            }
          } catch (e) { console.warn(TAG, "applyEffects handler failed", t, e); }
        }
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
      }

      // Phase E — Mask Off API. Burns a pending light scar on `side` and
      // returns true if one was burned (lets the dispatcher decide whether
      // to follow up with the bonus + suspicion rise).
      async function burnScandalScar(side) {
        const s = _normSide(side);
        if (!s) return false;
        const actor = s === "A" ? A : D;
        const scars = foundry.utils.duplicate(actor.flags?.["bbttcc-raid"]?.scandalScars || []);
        const lightIdx = scars.findIndex(x => x.severity === "light");
        if (lightIdx < 0) {
          ui.notifications?.warn?.(`${actor.name} has no Scandal Scar to burn.`);
          return false;
        }
        scars.splice(lightIdx, 1);
        await actor.update({ "flags.bbttcc-raid.scandalScars": scars });
        await sendChat([`${esc(actor.name)} burns a Scandal Scar — Mask Off.`], { title: `${label}: Mask Off` });
        try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}
        return true;
      }

      // Phase E — Per-outcome marks per spec §6. Called once after the
      // outcome is determined; idempotent guard via state.marksApplied.
      async function _applyOutcomeMarks() {
        if (state.marksApplied) return;
        state.marksApplied = true;
        const winner = outcomeWinner(state); // "A"|"D"|null
        const kind = state.outcomeKind;
        const winActor = winner === "A" ? A : winner === "D" ? D : null;
        const losActor = winner === "A" ? D : winner === "D" ? A : null;
        const winFid   = winner === "A" ? state.attackerId : winner === "D" ? state.defenderId : null;
        const raidId   = `${state.attackerId}::${state.defenderId}::${Date.now()}`;
        const lines = [];

        const courtierTokens = () => (game.bbttcc?.api?.raid?.tableau?.courtiers?.() ?? []);   // courtiers on ANY scene (2026-10-22)

        async function bumpFavor(targetActor, factionId, delta, cap = 3) {
          const cur = foundry.utils.duplicate(targetActor.flags?.["bbttcc-raid"]?.courtFavor || {});
          const before = Number(cur[factionId] ?? 0);
          const after = Math.max(-3, Math.min(cap, before + delta));
          if (after === before) return false;
          cur[factionId] = after;
          await targetActor.update({ "flags.bbttcc-raid.courtFavor": cur });
          return true;
        }

        if (kind === "cleanTriumph" && winActor && winFid) {
          // +1 favor with all on-tableau courtiers (cap +3 per courtier)
          let bumped = 0;
          for (const tk of courtierTokens()) {
            if (await bumpFavor(tk.actor, winFid, +1, 3)) bumped++;
          }
          lines.push(`Clean Triumph — ${esc(winActor.name)} gains +1 favor with ${bumped} ${bumped === 1 ? AUD().one : (AUD().plural || AUD().many)}.`);
          // Loser: -1 Influence cap on next courtly raid (flag on the faction)
          if (losActor) {
            const flags = foundry.utils.duplicate(losActor.flags?.["bbttcc-raid"] || {});
            flags.nextCourtlyInfluenceCapDelta = Math.min(-1, Number(flags.nextCourtlyInfluenceCapDelta || 0) - 1);
            await losActor.update({ "flags.bbttcc-raid": flags });
            lines.push(`${esc(losActor.name)} suffers −1 Influence cap on their next Parley.`);
          }
          // Clear winner's light scars (spec §4.1 lifecycle)
          const cleared = await clearLightScars(winActor);
          if (cleared > 0) lines.push(`${esc(winActor.name)} clears ${cleared} light Scandal Scar(s).`);
        }
        else if (kind === "tarnishedVictory" && winActor && winFid && losActor) {
          // Winner: 1 Earned Secret + 1 Favor with 1 courtier (highest current favor)
          await drawSecret(winner, "earned");
          const cands = courtierTokens()
            .map(t => ({ t, fav: Number(t.actor.flags?.["bbttcc-raid"]?.courtFavor?.[winFid] ?? 0) }))
            .sort((a, b) => b.fav - a.fav);
          if (cands.length > 0) {
            await bumpFavor(cands[0].t.actor, winFid, +1, 3);
            lines.push(`${esc(winActor.name)} earns the loyalty of <b>${esc(cands[0].t.actor.name)}</b> (+1 favor).`);
          }
          // Loser: light Scandal Scar
          await writeScandalScar(losActor, "light", raidId);
          lines.push(`${esc(losActor.name)} earns a Scandal Scar (light).`);
        }
        else if (kind === "stalemate") {
          // Both: 1 Earned Secret each; suspicion resets to 3
          await drawSecret("A", "earned");
          await drawSecret("D", "earned");
          state.suspicion = 3;
          state.suspicionQuietStreak = 0;
          lines.push("Stalemate — both factions draw an Earned secret. Suspicion resets to 3.");
        }
        else if (kind === "publicHumiliation" && winActor && winFid && losActor) {
          // Loser: Scandal Scar (heavy) + Disgraced pip
          await writeScandalScar(losActor, "heavy", raidId);
          const flags = foundry.utils.duplicate(losActor.flags?.["bbttcc-raid"] || {});
          flags.disgracedUntil = Date.now() + (3 * 7 * 24 * 60 * 60 * 1000); // ~3 weekly sessions
          await losActor.update({ "flags.bbttcc-raid": flags });
          lines.push(`${esc(losActor.name)} earns a Scandal Scar (HEAVY) — Disgraced.`);
          // Winner: +1 favor on top 2 courtiers
          const cands = courtierTokens()
            .map(t => ({ t, fav: Number(t.actor.flags?.["bbttcc-raid"]?.courtFavor?.[winFid] ?? 0) }))
            .sort((a, b) => b.fav - a.fav)
            .slice(0, 2);
          for (const { t } of cands) {
            await bumpFavor(t.actor, winFid, +1, 3);
          }
          if (cands.length) lines.push(`${esc(winActor.name)} consolidates support among <b>${cands.map(c => esc(c.t.actor.name)).join(", ")}</b> (+1 favor each).`);
        }
        else if (kind === "mutualRuin") {
          // Both: Scandal Scar (light); 2 courtiers retire (unflag)
          await writeScandalScar(A, "light", raidId);
          await writeScandalScar(D, "light", raidId);
          const all = courtierTokens();
          const shuf = all.slice().sort(() => Math.random() - 0.5).slice(0, 2);
          for (const tk of shuf) {
            await tk.document.update({ "flags.bbttcc-raid.tableauActor": false });
          }
          if (shuf.length) lines.push(`Mutual Ruin — <b>${shuf.map(t => esc(t.actor.name)).join(", ")}</b> retire from court in disgust.`);
          lines.push("Both factions earn a Scandal Scar (light).");
        }

        if (lines.length) await sendChat(lines, { title: `${label}: ${kind || "Outcome"}` });
      }

      // Persist a lightweight participant/outcome mirror on both actors so
      // OTHER clients can see the live scenario — _lastCourtly exists only on
      // the client that created it, which left the faction sheet's secret
      // Play gate reading null on the player side (2026-08-22 playtest).
      async function _persistCourtlyMirror() {
        // `state` snapshot added 2026-10-17 so player seats (and a reloaded GM) can draw the
        // Court HUD from the flag — the scenario object itself never leaves this client.
        const mirror = { attackerId: state.attackerId, defenderId: state.defenderId, outcome: state.outcome, round: state.round, ts: Date.now(), state: getState() };
        for (const actor of [A, D]) {
          try { await actor.setFlag(MOD_R, "courtlyActive", mirror); } catch (e) { console.warn(TAG, "courtly mirror persist failed", e); }
        }
      }
      const _stepRaw = step;
      const _applyEffectsRaw = applyEffects;
      async function _stepPersist(args) { const r = await _stepRaw(args); await _persistCourtlyMirror(); return r; }
      async function _applyEffectsPersist(fx, opts) { const r = await _applyEffectsRaw(fx, opts); await _persistCourtlyMirror(); return r; }   // keep opts ({side}) — a defender-fired bundle must resolve as D

      const apiObj = { step: _stepPersist, getState, raiseSuspicion, lowerSuspicion, adjustFavor, queueRollMod, queueReroll, dealInfluenceDamage, clearScandal, queueActionBonus, discardSecret, lockSpend, drawSecret, converseSecret, spendFavorAndBoost, applyEffects: _applyEffectsPersist, burnScandalScar, armLastWord,
        // Halloween hoard receipts (2026-10-31)
        queueTruce, queueDecree, undoLastExchange, revealCourt, setGoal, armCounterfeit, consumeCounterfeit };
      // Every state edit persists (2026-11-11): only step/applyEffects used to, so a reload lost queued receipts,
      // Suspicion moves and favor spends. The mirror is also what a reloaded GM restores the Parley from.
      for (const [k, fn] of Object.entries(apiObj)) {
        if (k === "getState" || k === "step" || k === "applyEffects" || typeof fn !== "function") continue;
        apiObj[k] = async function (...args) { const out = await fn(...args); try { await _persistCourtlyMirror(); } catch (_eP) {} return out; };
      }
      apiObj.restored = !!RESTORE;

      // Convenience for GM
      raidApi._lastCourtly = apiObj;
      await _persistCourtlyMirror();

      console.log(TAG, "Courtly Intrigue scenario created:", {
        attacker: A.name, defender: D.name,
        influenceA: state.influenceA,
        influenceD: state.influenceD
      });

      try { Hooks.callAll("bbttcc:courtly:state", { scenario: apiObj, state: getState() }); } catch (_e) {}

      return apiObj;
    };

    console.log(TAG, "Courtly Intrigue engine attached to raid API.");

    // ── api.raid.performance — run a performance contest and route its ending into the story ──────────────────────────
    // open({ profile, challengerId|challengerName, defenderId|defenderName ("@coalition" = the party), routes:{triumph,grace,ugly},
    //        partySide?: "A"|"D" (default: whichever side is a coalition faction), label? }) — GM dialogs: commitments, then one
    // exchange per round until it ends (Cancel pauses; open() again resumes the same contest). On the end the matching route beat
    // runs (force: the contest is the authority, like a choice route).
    const _esc = (x) => foundry.utils.escapeHTML(String(x ?? ""));
    const _coalition = () => { try { const capi = game.bbttcc?.api?.campaign; const cid = capi?.getActiveCampaignId?.(); const c = cid && capi.getCampaign ? capi.getCampaign(cid) : null; return [...new Set([].concat(c?.factionIds || [], c?.factionId ? [c.factionId] : []).map(x => String(x || "").replace(/^Actor\./, "")).filter(Boolean))]; } catch (_e) { return []; } };
    const _actorOf = (id, name) => {
      if (id === "@coalition" || name === "@coalition") { const f = _coalition()[0]; return f ? game.actors.get(f) : null; }
      if (id) return game.actors.get(String(id).replace(/^Actor\./, "")) || null;
      const nn = String(name || "").replace(/[\s ]+/g, " ").trim().toLowerCase();
      return nn ? (game.actors.find(a => a.flags?.["bbttcc-factions"]?.isFaction && String(a.name).replace(/[\s ]+/g, " ").trim().toLowerCase() === nn) || game.actors.find(a => String(a.name).trim().toLowerCase() === nn) || null) : null;
    };
    const _dlg = (title, content, okLabel = "OK", extra = {}) => new Promise((resolve) => {
      const buttons = { ok: { label: okLabel, callback: (html) => resolve({ ok: true, form: html[0].querySelector("form") }) }, ...Object.fromEntries(Object.entries(extra).map(([k, l]) => [k, { label: l, callback: () => resolve({ [k]: true }) }])), cancel: { label: "Pause", callback: () => resolve(null) } };
      new Dialog({ title, content, buttons, default: "ok", close: () => resolve(null) }, { width: 560 }).render(true);
    });
    const perf = { _active: null };
    perf.profiles = () => Object.fromEntries(Object.entries(PERF_PROFILES).map(([k, v]) => [k, { key: k, ...v }]));
    perf.getProfile = _perfProfile;
    perf.reload = _loadPerfProfiles;
    perf.routeOf = (st, partySide) => {
      if (!st || st.outcome === "ongoing") return null;
      if (st.outcomeKind === "foul") return "ugly";
      const winner = st.outcome === "attackerWin" ? "A" : st.outcome === "defenderWin" ? "D" : null;
      return winner && winner === partySide ? "triumph" : "grace";
    };
    async function _route(run) {
      const st = run.scenario.getState(); const r = perf.routeOf(st, run.partySide); const beatId = r ? run.routes?.[r] : null;
      perf._active = null;
      const P = run.profile; const party = run.partySide === "A" ? run.A : run.D;
      const names = { triumph: "won it clean", grace: "lost it with grace (or held it to a draw)", ugly: "ended it ugly" };
      await ChatMessage.create({ speaker: { alias: P.label }, content: `<div style="border-left:3px solid #ffd54f;padding:.3em .6em;"><b>${_esc(P.label)}</b> — ${_esc(party?.name || "The party")} ${_esc(names[r] || "finished")}.${beatId ? "" : " <i>(no ending beat set for this result)</i>"}</div>` });
      try { Hooks.callAll("bbttcc:performance:routed", { profile: P.key, route: r, beatId, state: st }); } catch (_e) {}
      if (!beatId) return { ok: true, route: r };
      const capi = game.bbttcc?.api?.campaign; const cid = capi?.getActiveCampaignId?.();
      try { const res = await capi.runBeat(cid, beatId, { source: "performance", force: true, performance: P.key }); return { ok: !(res && res.ok === false), route: r, beatId }; }
      catch (e) { console.warn(TAG, "performance route failed", e); ui.notifications?.warn?.(`${P.label}: play "${beatId}" by hand (route failed).`); return { ok: false, route: r, beatId }; }
    }
    perf.open = async function open(opts = {}) {
      if (!game.user?.isGM) return ui.notifications?.warn?.("Performance contests are run from the GM seat.");
      let run = perf._active;
      if (!run || (opts.profile && run.profile.key !== opts.profile)) {
        const P = _perfProfile(opts.profile); if (!P) return ui.notifications?.error?.(`Unknown performance profile "${opts.profile}".`);
        const A = _actorOf(opts.challengerId, opts.challengerName), D = _actorOf(opts.defenderId || (opts.defenderName ? null : "@coalition"), opts.defenderName);
        if (!A || !D) return ui.notifications?.error?.(`${P.label}: challenger or defender faction not found (${opts.challengerName || opts.challengerId} vs ${opts.defenderName || opts.defenderId || "@coalition"}).`);
        const coal = _coalition(); const partySide = opts.partySide || (coal.includes(D.id) ? "D" : coal.includes(A.id) ? "A" : "D");
        const pool = (a, k) => Math.floor(bankOpOf(a, k));
        const [f1, f2] = P.fuel || ["culture", "softpower"];
        const init = await _dlg(`${P.label} — Take Your Places`, `<form><p class="hint">${_esc(A.name)} challenges ${_esc(D.name)}. Starting presence = 10, plus 1 per 10 marks of ${_esc(f1)} committed, plus 1 per 20 marks of ${_esc(f2)}. ${_esc(P.crowd ? `Judged by ${P.crowd}.` : "")} The foul — <b>${_esc(P.actions?.[P.foul]?.label || P.foul)}</b> — ends it ugly.</p>
          <div class="form-group"><label>${_esc(A.name)}: ${_esc(f1)} marks (has ${pool(A, f1)})</label><input type="number" name="a1" value="${Math.min(30, pool(A, f1))}" min="0" step="10"/></div>
          <div class="form-group"><label>${_esc(A.name)}: ${_esc(f2)} marks (has ${pool(A, f2)})</label><input type="number" name="a2" value="${Math.min(20, pool(A, f2))}" min="0" step="10"/></div><hr/>
          <div class="form-group"><label>${_esc(D.name)}: ${_esc(f1)} marks (has ${pool(D, f1)})</label><input type="number" name="d1" value="${Math.min(30, pool(D, f1))}" min="0" step="10"/></div>
          <div class="form-group"><label>${_esc(D.name)}: ${_esc(f2)} marks (has ${pool(D, f2)})</label><input type="number" name="d2" value="${Math.min(20, pool(D, f2))}" min="0" step="10"/></div></form>`, "Begin");
        if (!init?.ok) return null;
        const f = init.form;
        const scenario = await raidApi.courtly({ attackerId: A.id, defenderId: D.id, atkInitDip: Number(f.a1.value || 0), atkInitSoft: Number(f.a2.value || 0), defInitDip: Number(f.d1.value || 0), defInitSoft: Number(f.d2.value || 0), label: opts.label || P.label, performance: P });
        run = perf._active = { profile: P, A, D, partySide, routes: opts.routes || {}, scenario };
      }
      const P = run.profile; const acts = ["persuade", "inspire", "expose", "intimidate"];
      const opt = (sel) => acts.map(k => `<option value="${k}"${k === sel ? " selected" : ""}>${_esc(P.actions?.[k]?.label || k)}${k === P.foul ? " ⚠ FOUL" : ""} (${_esc(P.actions?.[k]?.pool || "")})</option>`).join("");
      const hints = acts.map(k => `<li><b>${_esc(P.actions?.[k]?.label || k)}</b>${k === P.foul ? " ⚠" : ""} — ${_esc(P.actions?.[k]?.hint || "")}</li>`).join("");
      while (run.scenario.getState().outcome === "ongoing") {
        const st = run.scenario.getState();
        const ex = await _dlg(`${P.label} — Round ${st.round + 1}`, `<form><p><b>${_esc(run.A.name)}</b> ${st.influenceA}/${st.maxA} · <b>${_esc(run.D.name)}</b> ${st.influenceD}/${st.maxD} · ${_esc(P.crowdTrack || "Crowd")} ${st.suspicion}/10 · round cap ${st.roundCap}</p><ul style="font-size:.9em;margin:.2em 0 .6em 1em">${hints}</ul>
          <div class="form-group"><label>${_esc(run.A.name)}</label><select name="aa">${opt("persuade")}</select></div>
          <div class="form-group"><label>${_esc(run.A.name)} spend (marks)</label><input type="number" name="as" value="20" min="0" step="10"/></div><hr/>
          <div class="form-group"><label>${_esc(run.D.name)}</label><select name="da">${opt("inspire")}</select></div>
          <div class="form-group"><label>${_esc(run.D.name)} spend (marks)</label><input type="number" name="ds" value="20" min="0" step="10"/></div>
          <div class="form-group"><label>Steward skill bonus (party side)</label><input type="number" name="sk" value="0" step="1"/></div></form>`, "Play the round");
        if (!ex?.ok) { ui.notifications?.info?.(`${P.label} paused — run the contest again (or api.raid.performance.open()) to resume.`); return { paused: true, state: run.scenario.getState() }; }
        const f = ex.form; const sk = Number(f.sk.value || 0);
        await run.scenario.step({ atkAction: f.aa.value, defAction: f.da.value, atkSpend: Number(f.as.value || 0), defSpend: Number(f.ds.value || 0), atkSkillBonus: run.partySide === "A" ? sk : 0, defSkillBonus: run.partySide === "D" ? sk : 0 });
      }
      return _route(run);
    };
    raidApi.performance = perf;
    _loadPerfProfiles().then(() => console.log(TAG, "performance contests ready:", Object.keys(PERF_PROFILES).join(", ")));
  });
})();

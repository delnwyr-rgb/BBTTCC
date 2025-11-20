/* bbttcc-raid/compat-bridge.js â€” Maneuvers (pre+post), Strategic Activities (final costs/benefits),
 * Turn-Advance consumer, EFFECTS, planner derivation, viewport shim
 * + DC now includes defender faction Defense and nextRaid.defenseBonus
 * Foundry v13.348 / dnd5e 5.1.9
 *
 * v1.3.10-queuefix.10-compat (TURN-only edition)
 * - Writes post-roll queues to flags.*.turn.pending (no legacy POST)
 * - Publishes API to both game.bbttcc.api.raid and module.api.raid
 * - Ready-time migration: post.pending -> turn.pending; nextRound -> nextTurn
 */

const MOD_FACTIONS  = "bbttcc-factions";
const MOD_TERRITORY = "bbttcc-territory";
const MOD_ID        = "bbttcc-raid";

const TAG = "[bbttcc-raid/compat-bridge]";
const log  = (...a)=>console.log(TAG, ...a);
const warn = (...a)=>console.warn(TAG, ...a);

// --- Global TURN guard to prevent recursion / infinite loop ---
if (!window._bbttccTurnLock) {
  window._bbttccTurnLock = false;
  Hooks.on("bbttcc:advanceTurn:begin", () => (window._bbttccTurnLock = true));
  Hooks.on("bbttcc:advanceTurn:end",   () => (window._bbttccTurnLock = false));
}

/* ---------------------- Utils ---------------------- */
const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
const clamp0 = v => Math.max(0, Number(v ?? 0) || 0);
const copy = (obj)=>foundry.utils.duplicate(obj ?? {});
function zOP(){ const o={}; for (const k of OP_KEYS) o[k]=0; return o; }
function addInto(dst, src){ for (const k of Object.keys(src||{})){ const kk=String(k).toLowerCase(); if (!OP_KEYS.includes(kk)) continue; dst[kk]=(dst[kk]||0)+Number(src[k]||0); } return dst; }
function spendBank(bank=zOP(), cost=zOP()){ const next=copy(bank); for (const k of OP_KEYS) next[k]=clamp0((next[k]||0)-(cost[k]||0)); return next; }
function canAfford(bank=zOP(), cost=zOP()){ for (const k of OP_KEYS) if (Number(bank[k]||0) < Number(cost[k]||0)) return false; return true; }
function fmtCost(cost=zOP()){ const keys=OP_KEYS.filter(k=>Number(cost[k]||0)>0); return keys.length? keys.map(k=>`${k}:${Number(cost[k])}`).join(", ") : "â€”"; }
function nowISO(){ try { return new Date().toLocaleString(); } catch { return ""; } }
function ensure(obj, path, init) {
  const parts = String(path).split(".");
  let cur = obj;
  for (let i=0;i<parts.length;i++) {
    const k = parts[i];
    if (cur[k] === undefined) cur[k] = (i === parts.length-1 ? (init ?? {}) : {});
    cur = cur[k];
  }
  return cur;
}
const _stripActorId = id => (typeof id === "string" && id.startsWith("Actor.")) ? id.slice(6) : id;

/* ---------------- War Log helper ---------------- */
async function pushWarLog(actor, entry){
  const flags = copy(actor.flags?.[MOD_FACTIONS] ?? {});
  const wl = Array.isArray(flags.warLogs) ? flags.warLogs.slice() : [];
  wl.push({ ts: Date.now(), date: nowISO(), ...entry });
  await actor.update({ [`flags.${MOD_FACTIONS}.warLogs`]: wl });
}

/* ---------------- PRE-ROLL benefit rules -------------- */
/* NOTE
 * - Attacker maneuvers may set: { attBonus, adv, autowin }
 * - Defender maneuvers may set: { dcBonus, autowin }
 * Resolver applies attacker/defender sets separately.
 */
const PRE_ROLL = {
  // T1/T2/T4 existing
  qliphothic_gambit:      { attBonus:+6 },
  divine_favor:           { attBonus:+3 },
  flank_attack:           { attBonus:+2 },
  overclock_the_golems:   { attBonus:+3 },
  spy_network:            { adv:true },
  defensive_entrenchment: { dcBonus:+3 },
  sephirotic_intervention:{ autowin:true },
  echo_strike_protocol:   { attBonus:+3 },
  reality_hack:           { adv:true },
  unity_surge:            { attBonus:+2 },
  command_overdrive:      { attBonus:+2 },
  saboteurs_edge:         { dcBonus:-2 },
  psychic_disruption:     { adv:true },

  /* === New Tier 3 hooks === */
  moral_high_ground:      { adv:true },
  quantum_shield:         { dcBonus:+3 },
  counter_propaganda_wave:{ dcBonus:+2 }
};

/* ---------------- Strategic queue writer (shared) ---------------- */
async function queueStrategic({ actor, key, entry }) {
  // Writes to faction + (optional) hex turn.pending using your schema
  const A = actor;
  const Aflags = copy(A.flags?.[MOD_FACTIONS] ?? {});
  const pend = ensure(Aflags, "turn.pending", {});

  let hexActor = null, hexFlags = null, hexPend = null;
  const targetUuid = entry?.targetUuid ?? null;
  if (targetUuid){
    let hexDoc = null;
    try { hexDoc = await fromUuid(targetUuid); } catch {}
    const doc = hexDoc?.document ?? hexDoc;
    const hexId = _stripActorId(doc?.id || "");
    if (hexId) {
      const H = game.actors.get(hexId) || null;
      if (H) {
        hexActor = H;
        hexFlags = copy(H.flags?.[MOD_TERRITORY] ?? {});
        hexPend  = ensure(hexFlags, "turn.pending", {});
      } else if (doc) {
        hexActor = doc; // DrawingDocument
        hexFlags = copy(doc.flags?.[MOD_TERRITORY] ?? {});
        hexPend  = ensure(hexFlags, "turn.pending", {});
      }
    }
  }
  const inc = (obj, k, d=1)=> { obj[k] = Number(obj[k]||0) + Number(d||0); };
  return { A, Aflags, pend, hexActor, hexFlags, hexPend, inc };
}

/* -------------- EFFECTS registry (finalized costs + apply) -------------- */
const EFFECTS = {
  /* ---------------- In-Round Maneuvers (existing + tiers) ---------------- */
  suppressive_fire:   { kind:"maneuver", tier:1, rarity:"common",    label:"Suppressive Fire",   cost:{ violence:2 } },
  smoke_and_mirrors:  { kind:"maneuver", tier:1, rarity:"common",    label:"Smoke and Mirrors",  cost:{ intrigue:1, softpower:1 } },
  rally_the_line:     { kind:"maneuver", tier:1, rarity:"common",    label:"Rally the Line",     cost:{ softpower:1 } },
  patch_the_breach:   { kind:"maneuver", tier:1, rarity:"common",    label:"Patch the Breach",   cost:{ nonlethal:1, economy:1 } },
  flash_bargain:      { kind:"maneuver", tier:1, rarity:"common",    label:"Flash Bargain",      cost:{ diplomacy:1 } },

  saboteurs_edge:     { kind:"maneuver", tier:2, rarity:"rare",      label:"Saboteurâ€™s Edge",    cost:{ intrigue:3 } },
  bless_the_fallen:   { kind:"maneuver", tier:2, rarity:"rare",      label:"Bless the Fallen",   cost:{ faith:2 } },
  logistical_surge:   { kind:"maneuver", tier:2, rarity:"rare",      label:"Logistical Surge",   cost:{ economy:2, logistics:1 } },
  command_overdrive:  { kind:"maneuver", tier:2, rarity:"rare",      label:"Command Overdrive",  cost:{ violence:3 } },
  psychic_disruption: { kind:"maneuver", tier:2, rarity:"rare",      label:"Psychic Disruption", cost:{ intrigue:2, faith:1 } },

  echo_strike_protocol:{ kind:"maneuver", tier:3, rarity:"very_rare", label:"Echo Strike Protocol",cost:{ violence:4, intrigue:1 } },
  moral_high_ground:  { kind:"maneuver", tier:3, rarity:"very_rare", label:"Moral High Ground",  cost:{ softpower:3 } },
  quantum_shield:     { kind:"maneuver", tier:3, rarity:"very_rare", label:"Quantum Shield",     cost:{ economy:3, faith:2 } },
  overclock_the_golems:{kind:"maneuver", tier:3, rarity:"very_rare", label:"Overclock the Golems",cost:{ economy:2, violence:2 } },
  counter_propaganda_wave:{kind:"maneuver", tier:3, rarity:"very_rare", label:"Counter-Propaganda Wave", cost:{ softpower:3, intrigue:2 } },

  sephirotic_intervention:{kind:"maneuver", tier:4, rarity:"legendary", label:"Sephirotic Intervention", cost:{ faith:5, softpower:5 } },
  ego_breaker:        { kind:"maneuver", tier:4, rarity:"legendary", label:"Ego Breaker",        cost:{ violence:6 } },
  reality_hack:       { kind:"maneuver", tier:4, rarity:"legendary", label:"Reality Hack",       cost:{ intrigue:5, economy:3 } },
  unity_surge:        { kind:"maneuver", tier:4, rarity:"legendary", label:"Unity Surge",        cost:{ diplomacy:5, softpower:5 } },
  qliphothic_gambit:  { kind:"maneuver", tier:4, rarity:"legendary", label:"Qliphothic Gambit",  cost:{ violence:6 } },

  flank_attack:        { kind:"maneuver", tier:2, rarity:"rare",      label:"Flank Attack",        cost:{ violence:5 } },
  supply_surge:        { kind:"maneuver", tier:1, rarity:"common",    label:"Supply Surge",        cost:{ economy:5 } },
  spy_network:         { kind:"maneuver", tier:2, rarity:"rare",      label:"Spy Network",         cost:{ intrigue:3 } },
  propaganda_push:     { kind:"maneuver", tier:2, rarity:"rare",      label:"Propaganda Push",     cost:{ diplomacy:3 } },
  divine_favor:        { kind:"maneuver", tier:3, rarity:"very_rare", label:"Divine Favor",        cost:{ faith:5 } },
  technocrat_override: { kind:"maneuver", tier:3, rarity:"very_rare", label:"Technocrat Override", cost:{ economy:5 } },

  defensive_entrenchment:{kind:"maneuver", tier:2, rarity:"rare",     label:"Defensive Entrenchment", cost:{ violence:4 } },

  /* ---------------- Strategic Turn Activities ---------------- */
  develop_infrastructure:{
    kind:"strategic", label:"Develop Infrastructure", cost:{ economy:10 },
    apply: async ({ actor, entry })=>{
      const { A, Aflags, pend, hexActor, hexFlags, hexPend, inc } = await queueStrategic({ actor, key:"develop_infrastructure", entry });
      if (hexPend){ inc(hexPend,"defenseDelta",+1); inc(hexPend,"tradeYieldDelta",+5); }
      else { inc(pend,"infrastructure.globalCount",+1); }
      await Promise.all([
        actor.update({ [`flags.${MOD_FACTIONS}.turn.pending`]: pend }),
        hexActor && hexActor.update({ [`flags.${MOD_TERRITORY}.turn.pending`]: hexPend })
      ]);
      return "+1 Defense & +5 Trade Yield (queued)";
    }
  },

  expand_territory:{ kind:"strategic", label:"Expand Territory", cost:{ violence:15, logistics:4 },
    apply: async ({ actor, entry })=>{ const { pend } = await queueStrategic({ actor, key:"expand_territory", entry });
      const reqs = ensure(pend,"territory.createHexRequests",[]);
      const baseHex = entry?.targetUuid ? _stripActorId((await fromUuid(entry.targetUuid))?.document?.id || "") : null;
      reqs.push({ adjacentTo: baseHex, at: Date.now() });
      await actor.update({ [`flags.${MOD_FACTIONS}.turn.pending`]: pend });
      return "Create a new adjacent Hex (request queued)";
    }
  },

  conduct_research:{ kind:"strategic", label:"Conduct Research", cost:{ intrigue:8, economy:2 },
    apply: async ({ actor })=>{ const flags = copy(actor.flags?.[MOD_FACTIONS] ?? {}); const mods=ensure(flags,"mods",{}); mods.techScore = Number(mods.techScore||0) + 1;
      await actor.update({ [`flags.${MOD_FACTIONS}`]: flags }); return "+1 Technology Score (immediate)"; }
  },

  diplomatic_mission:{ kind:"strategic", label:"Diplomatic Mission", cost:{ diplomacy:6, softpower:2 },
    apply: async ({ actor })=>{ const flags = copy(actor.flags?.[MOD_FACTIONS] ?? {}); const mods=ensure(flags,"mods",{}); mods.loyalty = Number(mods.loyalty||0) + 5;
      await actor.update({ [`flags.${MOD_FACTIONS}`]: flags }); return "+5 Loyalty (immediate)"; }
  },

  cultural_festival:{ kind:"strategic", label:"Cultural Festival", cost:{ culture:4, faith:1 },
    apply: async ({ actor })=>{ const flags = copy(actor.flags?.[MOD_FACTIONS] ?? {}); const mods=ensure(flags,"mods",{}); mods.morale = Number(mods.morale||0) + 1;
      await actor.update({ [`flags.${MOD_FACTIONS}`]: flags }); return "+1 Morale (immediate)"; }
  },

  faith_campaign:{ kind:"strategic", label:"Faith Campaign", cost:{ faith:8, softpower:2 },
    apply: async ({ actor })=>{ const flags = copy(actor.flags?.[MOD_FACTIONS] ?? {}); const pend = ensure(flags,"turn.pending",{}); ensure(pend,"enlightenmentAttempt",0); pend.enlightenmentAttempt += 1;
      ensure(pend,"consumeSpark",0); pend.consumeSpark += 1; await actor.update({ [`flags.${MOD_FACTIONS}.turn.pending`]: pend }); return "Enlightenment attempt queued (consumes 1 Spark if available)"; }
  },

  rearm_forces:{ kind:"strategic", label:"Rearm Forces", cost:{ violence:10 },
    apply: async ({ actor })=>{ const flags = copy(actor.flags?.[MOD_FACTIONS] || {}); const nr = ensure(flags,"bonuses.nextRaid",{}); nr.defenseBonus = Number(nr.defenseBonus||0) + 5;
      await actor.update({ [`flags.${MOD_FACTIONS}`]: flags }); return "+5 Next-Raid Defense (immediate)"; }
  },

  economic_boom:{ kind:"strategic", label:"Economic Boom", cost:{ diplomacy:10, economy:5 }, apply: async ({ actor })=>{ const flags = copy(actor.flags?.[MOD_FACTIONS] || {}); const nt=ensure(flags,"bonuses.nextTurn",{}); nt.opGainPct = Number(nt.opGainPct||0) + 10; nt.boomActive = true; await actor.update({ [`flags.${MOD_FACTIONS}`]: flags }); return "+10% OP output next Strategic Turn (immediate)"; }},
  harvest_season:{ kind:"strategic", label:"Harvest Season", cost:{ economy:1 }, apply: async ({ actor })=>{ const flags = copy(actor.flags?.[MOD_FACTIONS] || {}); const nt=ensure(flags,"bonuses.nextTurn",{}); nt.economyRegenDelta = Number(nt.economyRegenDelta||0) + 1; await actor.update({ [`flags.${MOD_FACTIONS}`]: flags }); return "+1 Economy regen next turn (immediate)"; }},
  recon_sweep:{ kind:"strategic", label:"Recon Sweep", cost:{ intrigue:1, logistics:1 }, apply: async ({ actor, entry })=>{ const flags = copy(actor.flags?.[MOD_FACTIONS] || {}); const pend=ensure(flags,"turn.pending",{}); const recon=ensure(pend,"recon",{}); const arr=Array.isArray(recon.adjacentRevealRequests)?recon.adjacentRevealRequests.slice():[]; arr.push({ baseHex: entry?.targetUuid ?? null, at: Date.now() }); recon.adjacentRevealRequests = arr; flags.turn = { ...(flags.turn||{}), pending: pend }; await actor.update({ [`flags.${MOD_FACTIONS}`]: flags }); return "Queued 1 adjacent Hex reveal (pending)"; }},
  ration_distribution:{ kind:"strategic", label:"Ration Distribution", cost:{ softpower:1, logistics:1 }, apply: async ({ actor, entry })=>{ const { pend, hexActor, hexPend, inc } = await queueStrategic({ actor, key:"ration_distribution", entry }); if (hexPend) inc(hexPend,"loyaltyDelta",+1); else inc(pend,"loyaltyDelta",+1); await Promise.all([ actor.update({ [`flags.${MOD_FACTIONS}.turn.pending`]: pend }), hexActor && hexActor.update({ [`flags.${MOD_TERRITORY}.turn.pending`]: hexPend }) ]); return "+1 Loyalty (queued)"; }},
  minor_repair:{ kind:"strategic", label:"Minor Repair", cost:{ economy:1, materials:1 }, apply: async ({ actor, entry })=>{ const { pend, hexActor, hexPend } = await queueStrategic({ actor, key:"minor_repair", entry }); const r = ensure(hexPend ?? pend, "repairs.requests", []); r.push({ target: hexActor ? hexActor.id : null, tag: "Damaged Infrastructure" }); await Promise.all([ actor.update({ [`flags.${MOD_FACTIONS}.turn.pending`]: pend }), hexActor && hexActor.update({ [`flags.${MOD_TERRITORY}.turn.pending`]: hexPend }) ]); return "Remove 'Damaged Infrastructure' (queued)"; }},
  local_festival:{ kind:"strategic", label:"Local Festival", cost:{ culture:1, faith:1 }, apply: async ({ actor })=>{ const flags = copy(actor.flags?.[MOD_FACTIONS] || {}); ensure(flags,"mods",{}).empathy = Number(flags.mods.empathy||0) + 1; await actor.update({ [`flags.${MOD_FACTIONS}`]: flags }); return "+1 Empathy (immediate)"; }},
  smuggling_network:{ kind:"strategic", label:"Smuggling Network", cost:{ intrigue:3 }, apply: async ({ actor })=>{ const flags = copy(actor.flags?.[MOD_FACTIONS] || {}); const pend  = ensure(flags,"turn.pending",{}); const t = ensure(pend,"trade",{}); const routes = ensure(t,"routesCreate", []); routes.push({ at: Date.now() }); const nt = ensure(pend,"nextTurn",{}); nt.diplomacyRegenDelta = Number(nt.diplomacyRegenDelta||0) + 1; flags.turn = { ...(flags.turn||{}), pending: pend }; await actor.update({ [`flags.${MOD_FACTIONS}`]: flags }); return "New trade route +1 Diplomacy regen next turn (queued)"; }},
  training_drills:{ kind:"strategic", label:"Training Drills", cost:{ violence:3, nonlethal:2 }, apply: async ({ actor })=>{ const flags = copy(actor.flags?.[MOD_FACTIONS] || {}); const caps = ensure(flags,"mods.caps",{}); caps.violence = Number(caps.violence||0)+1; const dur = ensure(flags,"turn.pending.duration",{}); dur.training_drills = 2; await actor.update({ [`flags.${MOD_FACTIONS}`]: flags }); return "+1 Violence Cap for 2 turns (queued duration)"; }},
  reconstruction_drive:{ kind:"strategic", label:"Reconstruction Drive", cost:{ economy:2, softpower:2 }, apply: async ({ actor, entry })=>{ const { pend, hexActor, hexPend } = await queueStrategic({ actor, key:"reconstruction_drive", entry }); if (hexPend) hexPend.statusSet = "Claimed"; else ensure(pend,"hex.statusSetRequests",[]).push({ status:"Claimed", target:null }); await Promise.all([ actor.update({ [`flags.${MOD_FACTIONS}.turn.pending`]: pend }), hexActor && hexActor.update({ [`flags.${MOD_TERRITORY}.turn.pending`]: hexPend }) ]); return "Set Hex status â†’ Claimed (queued)"; }},
  cultural_exchange:{ kind:"strategic", label:"Cultural Exchange", cost:{ diplomacy:2, softpower:2 }, apply: async ({ actor, entry })=>{ const { pend } = await queueStrategic({ actor, key:"cultural_exchange", entry }); const s = ensure(pend,"alignment.shareRequests",[]); const baseHex = entry?.targetUuid ? _stripActorId((await fromUuid(entry.targetUuid))?.document?.id || "") : null; s.push({ source: baseHex, at: Date.now() }); await actor.update({ [`flags.${MOD_FACTIONS}.turn.pending`]: pend }); return "Share Alignment bonus (queued)"; }},
  spy_insertion:{ kind:"strategic", label:"Spy Insertion", cost:{ intrigue:2, diplomacy:1 }, apply: async ({ actor })=>{ const flags = copy(actor.flags?.[MOD_FACTIONS] || {}); ensure(flags,"intel",{}).revealEnemyOpPoolsNextTurn = true; await actor.update({ [`flags.${MOD_FACTIONS}`]: flags }); return "Reveal enemy OP pools next turn (immediate)"; }},
  terraforming_project:{ kind:"strategic", label:"Terraforming Project", cost:{ economy:4, faith:4 }, apply: async ({ actor, entry })=>{ const { pend, hexActor, hexPend } = await queueStrategic({ actor, key:"terraforming_project", entry }); if (hexPend) hexPend.cleanseCorruption = true; else ensure(pend,"hex.cleanseRequests",[]).push({ target: null }); await Promise.all([ actor.update({ [`flags.${MOD_FACTIONS}.turn.pending`]: pend }), hexActor && hexActor.update({ [`flags.${MOD_TERRITORY}.turn.pending`]: hexPend }) ]); return "Cleanse Corruption (queued)"; }},
  alliance_summit:{ kind:"strategic", label:"Alliance Summit", cost:{ diplomacy:3, softpower:3 }, apply: async ({ actor })=>{ const flags = copy(actor.flags?.[MOD_FACTIONS] || {}); ensure(flags,"bonuses.nextTurn",{}).mergeResources = true; await actor.update({ [`flags.${MOD_FACTIONS}`]: flags }); return "Merge resources for next Strategic Turn (immediate)"; }},
  industrial_revolution:{ kind:"strategic", label:"Industrial Revolution", cost:{ economy:4, materials:4 }, apply: async ({ actor })=>{ const flags = copy(actor.flags?.[MOD_FACTIONS] || {}); const nextTurns = ensure(flags,"bonuses.nextTurns",[]); nextTurns.push({ op:"economy", multiplier:2, duration:2, at: Date.now() }); await actor.update({ [`flags.${MOD_FACTIONS}`]: flags }); return "Double Economy output for 2 turns (immediate series)"; }},
  psych_ops_broadcast:{ kind:"strategic", label:"Psych-Ops Broadcast", cost:{ softpower:3, intrigue:3 }, apply: async ({ actor, entry })=>{ const { pend, hexActor, hexPend, inc } = await queueStrategic({ actor, key:"psych_ops_broadcast", entry }); if (hexPend) inc(hexPend,"enemyLoyaltyDelta",-2); else inc(pend,"enemyLoyaltyDelta",-2); await Promise.all([ actor.update({ [`flags.${MOD_FACTIONS}.turn.pending`]: pend }), hexActor && hexActor.update({ [`flags.${MOD_TERRITORY}.turn.pending`]: hexPend }) ]); return "Enemy Loyalty âˆ’2 (queued)"; }},
  purification_rite:{ kind:"strategic", label:"Purification Rite", cost:{ faith:3, softpower:2 }, apply: async ({ actor })=>{ const flags = copy(actor.flags?.[MOD_FACTIONS] || {}); const pend = ensure(flags,"turn.pending",{}); ensure(pend,"darknessDelta",0); pend.darknessDelta -= 2; await actor.update({ [`flags.${MOD_FACTIONS}.turn.pending`]: pend }); return "Darkness âˆ’2 (queued)"; }},
  great_work_ritual:{ kind:"strategic", label:"Great Work Ritual", cost:{ faith:10, culture:5 }, apply: async ({ actor })=>{ const flags = copy(actor.flags?.[MOD_FACTIONS] || {}); const q = ensure(flags,"turn.pending.tikkun.phaseCRequests",[]); q.push({ at: Date.now() }); await actor.update({ [`flags.${MOD_FACTIONS}`]: flags }); return "Trigger Tikkun Phase C (queued)"; }},
  mass_mobilization:{ kind:"strategic", label:"Mass Mobilization", cost:{ violence:6, economy:6, logistics:3 }, apply: async ({ actor })=>{ const flags = copy(actor.flags?.[MOD_FACTIONS] || {}); const mm = ensure(flags,"bonuses.nextTurn.massMobilization",{}); mm.up = +25; mm.down = -25; await actor.update({ [`flags.${MOD_FACTIONS}`]: flags }); return "+25% OP next turn, then âˆ’25% (immediate flag)"; }},
  enlightenment_congress:{ kind:"strategic", label:"Enlightenment Congress", cost:{ faith:5, diplomacy:5 }, apply: async ({ actor })=>{ const flags = copy(actor.flags?.[MOD_FACTIONS] || {}); ensure(flags,"mods",{}).enlightenmentAll = Number(flags.mods.enlightenmentAll||0)+1; await actor.update({ [`flags.${MOD_FACTIONS}`]: flags }); return "Enlightenment +1 for all PCs (immediate)"; }},
  project_eden:{ kind:"strategic", label:"Project Eden", cost:{ economy:10, softpower:5, faith:2 }, apply: async ({ actor, entry })=>{ const { pend } = await queueStrategic({ actor, key:"project_eden", entry }); const reqs = ensure(pend,"eden.createRequests",[]); const baseHex = entry?.targetUuid ? _stripActorId((await fromUuid(entry.targetUuid))?.document?.id || "") : null; reqs.push({ aligned:"Tiferet", at: Date.now(), target: baseHex }); await actor.update({ [`flags.${MOD_FACTIONS}.turn.pending`]: pend }); return "Create Garden City (Tiferet) request (queued)"; }},
  apocalyptic_weapon_test:{ kind:"strategic", label:"Apocalyptic Weapon Test", cost:{ violence:8, intrigue:4 }, apply: async ({ actor, entry })=>{ const { pend, hexActor, hexPend } = await queueStrategic({ actor, key:"apocalyptic_weapon_test", entry }); if (hexPend) hexPend.destroyHex = true; ensure(pend,"darknessDelta",0); pend.darknessDelta += 3; await Promise.all([ actor.update({ [`flags.${MOD_FACTIONS}.turn.pending`]: pend }), hexActor && hexActor.update({ [`flags.${MOD_TERRITORY}.turn.pending`]: hexPend }) ]); return "Destroy target Hex (queued); +3 Darkness (queued)"; }}
};

/* ---------------------- Re-entrancy guard ---------------------- */
const _locks = new Map();
function _tryLock(fid){ if (_locks.get(fid)) return false; _locks.set(fid, true); return true; }
function _unlock(fid){ _locks.delete(fid); }

/* ---------------------- consumePlanned (calls EFFECTS.apply) ---------------------- */
async function consumePlanned({ factionId, apply=true } = {}){
  if (!apply) return { ok:true, changed:false, note:"dry-run disabled at compat layer" };
  const actor = game.actors.get(_stripActorId(factionId));
  if (!actor) return { ok:false, error:"Faction not found" };
  if (!_tryLock(actor.id)) return { ok:false, note:"already-running" };

  try {
    const flags = copy(actor.flags?.[MOD_FACTIONS] ?? {});
    let bank    = copy(flags.opBank || zOP());
    let pools   = copy(flags.pools  || zOP());
    const warLogs = Array.isArray(flags.warLogs) ? flags.warLogs.slice() : [];

    const idxs = [];
    for (let i=0;i<warLogs.length;i++){
      const e = warLogs[i];
      if (String(e?.type).toLowerCase() === "planned") idxs.push(i);
    }
    if (!idxs.length) return { ok:true, changed:false };

    for (const i of idxs){
      const e = warLogs[i] || {};
      const key = String(e.activity || e.activityKey || "").trim().toLowerCase();
      const spec = EFFECTS[key];
      if (!spec){
        warLogs[i] = { ...e, type:"raid", summary:`[SKIP] Unknown activity '${key}'.` };
        continue;
      }
      const cost = copy(spec.cost || {});
      if (!canAfford(bank, cost)){
        warLogs[i] = { ...e, type:"raid", activity:key, summary:`[COST] Cannot afford ${spec.label} (need ${fmtCost(cost)}).` };
        continue;
      }

      bank  = spendBank(bank, cost);
      pools = spendBank(pools, cost);

      let effectNote = "";
      try {
        if (typeof spec.apply === "function") {
          const res = await spec.apply({ actor, entry: e, key, spec, cost });
          effectNote = res || "";
        }
      } catch (err) { warn("apply() failed", key, err); effectNote = "(effect apply failed; see console)"; }

      const baseSummary = `Strategic: ${spec.label} â€” Spent ${fmtCost(cost)}.`;
      const extra = effectNote ? ` ${effectNote}` : "";
      warLogs[i] = { ...e, type:"raid", activity:key, summary: `${baseSummary}${extra}` };
    }

    await actor.update({
      [`flags.${MOD_FACTIONS}.opBank`]: bank,
      [`flags.${MOD_FACTIONS}.pools`]: pools,
      [`flags.${MOD_FACTIONS}.warLogs`]: warLogs
    });

    return { ok:true, changed:true, count: idxs.length };
  } finally { _unlock(actor.id); }
}

/* ---------------------- PRE-ROLL resolver â€” includes faction Defense ---------------------- */
async function resolveRoundWithManeuvers({ attackerId, defenderId=null, round, maneuversAtt=[], maneuversDef=[] } = {}) {
  const attacker = attackerId ? game.actors.get(_stripActorId(attackerId)) : null;
  const defender = defenderId ? game.actors.get(_stripActorId(defenderId)) : null;
  if (!attacker || !round) throw new Error("resolveRoundWithManeuvers: missing attacker or round");

  const costA = zOP(), costD = zOP();
  for (const key of maneuversAtt){ const eff = EFFECTS[key]; if (eff?.cost) addInto(costA, eff.cost); }
  for (const key of maneuversDef){ const eff = EFFECTS[key]; if (eff?.cost) addInto(costD, eff.cost); }

  const cat = String(round?.view?.cat || round?.key || round?.activityKey || "violence").toLowerCase();
  const stagedA = Math.max(0, Number(round?.localStaged?.att?.[cat] || 0));
  const stagedD = Math.max(0, Number(round?.localStaged?.def?.[cat] || 0));
  if (stagedA > 0) costA[cat] = (costA[cat]||0) + stagedA;
  if (stagedD > 0) costD[cat] = (costD[cat]||0) + stagedD;

  // Spend if affordable (dual-write)
  const flagsA = copy(attacker.flags?.[MOD_FACTIONS] ?? {});
  let bankA  = copy(flagsA.opBank || zOP());
  let poolsA = copy(flagsA.pools  || zOP());
  const canA = canAfford(bankA, costA);

  let bankD=zOP(), poolsD=zOP(), canD=true, flagsD={};
  if (defender) {
    flagsD = copy(defender.flags?.[MOD_FACTIONS] ?? {});
    bankD  = copy(flagsD.opBank || zOP());
    poolsD = copy(flagsD.pools  || zOP());
    canD   = canAfford(bankD, costD);
  }
  if (canA) { bankA = spendBank(bankA, costA); poolsA = spendBank(poolsA, costA); await attacker.update({ [`flags.${MOD_FACTIONS}.opBank`]: bankA, [`flags.${MOD_FACTIONS}.pools`]: poolsA }); }
  if (defender && canD) { bankD = spendBank(bankD, costD); poolsD = spendBank(poolsD, costD); await defender.update({ [`flags.${MOD_FACTIONS}.opBank`]: bankD, [`flags.${MOD_FACTIONS}.pools`]: poolsD }); }

  // Pre-roll effects & flags
  let bonusAtt = 0, bonusDC = 0, adv = false, autoWinAtt = false, autoWinDef = false;
  for (const key of maneuversAtt){ const pr = PRE_ROLL[key]; if (!pr) continue; if (pr.attBonus) bonusAtt += Number(pr.attBonus||0); if (pr.adv) adv = true; if (pr.autowin) autoWinAtt = true; }
  for (const key of maneuversDef){ const pr = PRE_ROLL[key]; if (!pr) continue; if (pr.dcBonus)  bonusDC  += Number(pr.dcBonus ||0); if (pr.autowin) autoWinDef = true; }

  // Base numbers
  const sBonus  = Math.ceil((Number(stagedA)||0) / 2);
  const dBonus  = Math.ceil((Number(stagedD)||0) / 2);
  const diffAdj = Number(round?.diffOffset || 0);
  const baseDC  = Number(round?.DC || 10);
  const baseAtt = Number(round?.attBonus || 0);

  // Include defender faction Defense and any Next-Raid defense bonus.
  const defFacDefense = defender ? Number(flagsD?.mods?.defense ?? 0) : 0;
  const defNextRaid   = defender ? Number(flagsD?.bonuses?.nextRaid?.defenseBonus ?? 0) : 0;

  const dcFinal = (autoWinDef ? 999 : (baseDC + dBonus + bonusDC + diffAdj + defFacDefense + defNextRaid));

  // Roll
  let rollUsed = null, totalFinal = 0;
  if (autoWinAtt) {
    totalFinal = 999;
  } else if (adv) {
    const r1 = new Roll("1d20 + @b", { b: baseAtt + sBonus + bonusAtt });
    const r2 = new Roll("1d20 + @b", { b: baseAtt + sBonus + bonusAtt });
    await r1.evaluate(); await r2.evaluate();
    rollUsed = (r1.total >= r2.total) ? r1 : r2;
    totalFinal = Math.max(r1.total, r2.total);
  } else {
    const r = new Roll("1d20 + @b", { b: baseAtt + sBonus + bonusAtt });
    await r.evaluate();
    rollUsed = r;
    totalFinal = r.total;
  }

  return {
    totalFinal,
    dcFinal,
    roll: rollUsed,
    spentApplied: true,
    meta: {
      costA, costD, bonusAtt, bonusDC, adv, autoWinAtt, autoWinDef,
      stagedA, stagedD, cat,
      defFactionDefense: defFacDefense,
      defNextRaidBonus:  defNextRaid
    }
  };
}

/* ---------------------- POST-ROLL effects (TURN-only writes) ---------------------- */
async function applyPostRoundEffects({ attackerId, defenderId, success, maneuversAtt=[], maneuversDef=[], targetHexId=null } = {}) {
  const attacker = attackerId ? game.actors.get(_stripActorId(attackerId)) : null;
  const defender = defenderId ? game.actors.get(_stripActorId(defenderId)) : null;
  if (!attacker) throw new Error("applyPostRoundEffects: attacker not found");

  const attFlags = copy(attacker.flags?.[MOD_FACTIONS] ?? {});
  const defFlags = defender ? copy(defender.flags?.[MOD_FACTIONS] ?? {}) : {};

  // ðŸ” Write to TURN.pending, not POST.pending
  const attPending = ensure(attFlags, "turn.pending", {});
  const defPending = defender ? ensure(defFlags, "turn.pending", {}) : null;

  // Hex scope (also TURN.pending)
  let hexActor = null, hexFlags = null, hexPending = null;
  if (targetHexId) {
    try {
      const d = await fromUuid(targetHexId);
      const doc = d?.document ?? d; // DrawingDocument or Actor
      if (doc) {
        hexActor = doc;
        hexFlags = copy(doc.flags?.[MOD_TERRITORY] ?? {});
        hexPending = ensure(hexFlags, "turn.pending", {});
      }
    } catch (e) {}
  }
  const inc = (obj, key, delta=1) => { obj[key] = Number(obj[key]||0) + Number(delta||0); };
  const attSet = new Set((maneuversAtt||[]).map(k=>String(k).toLowerCase()));

  // Existing handlers (unchanged effects, new target = TURN pending)
  if (attSet.has("flank_attack") && success && defender) {
    inc(defPending, "defenseLoss", 1);
    await pushWarLog(defender, { type:"raid", activity:"flank_attack", summary:"+1 Defense loss (queued) from Flank Attack." });
  }
  if (attSet.has("propaganda_push") && success) {
    if (hexPending) {
      inc(hexPending, "moraleDelta", +2);
      await pushWarLog(attacker, { type:"raid", activity:"propaganda_push", summary:"+2 Morale queued on target hex." });
    } else {
      inc(attPending, "moraleDelta", +2);
      await pushWarLog(attacker, { type:"raid", activity:"propaganda_push", summary:"+2 Morale queued (no hex specified)." });
    }
  }
  if (attSet.has("divine_favor") && !success) {
    if (hexPending) {
      inc(hexPending, "radiationRisk", +1);
      await pushWarLog(attacker, { type:"raid", activity:"divine_favor", summary:"+1 Radiation risk queued on target hex (failure)." });
    } else if (defender) {
      inc(defPending, "radiationRisk", +1);
      await pushWarLog(attacker, { type:"raid", activity:"divine_favor", summary:"+1 Radiation risk queued vs defender (failure, no hex)." });
    } else {
      inc(attPending, "radiationRisk", +1);
      await pushWarLog(attacker, { type:"raid", activity:"divine_favor", summary:"+1 Radiation risk queued (failure, fallback scope)." });
    }
  }
  if (attSet.has("technocrat_override") && success) {
    const nextTurn = ensure(attPending, "nextTurn", {});
    nextTurn.opGainPct = Number(nextTurn.opGainPct || 0) + 10;
    await pushWarLog(attacker, { type:"raid", activity:"technocrat_override", summary:"+10% OP gain next Strategic Turn (queued)." });
  }
  if (attSet.has("echo_strike_protocol") && success && defender) {
    inc(defPending, "defenseLoss", 1);
    await pushWarLog(defender, { type:"raid", activity:"echo_strike_protocol", summary:"+1 Defense loss (queued) from Echo Strike Protocol." });
  }
  if (attSet.has("reality_hack") && success) {
    if (hexPending) {
      inc(hexPending, "enemyLoyaltyDelta", -2);
      await pushWarLog(attacker, { type:"raid", activity:"reality_hack", summary:"Enemy Loyalty âˆ’2 queued on target hex (success)." });
    } else {
      inc(attPending, "enemyLoyaltyDelta", -2);
      await pushWarLog(attacker, { type:"raid", activity:"reality_hack", summary:"Enemy Loyalty âˆ’2 queued (success, no hex specified)." });
    }
  }
  if (attSet.has("unity_surge") && success) {
    const nt = ensure(attPending, "nextTurn", {});
    nt.opGainPct = Number(nt.opGainPct || 0) + 5;
    inc(attPending, "moraleDelta", +1);
    await pushWarLog(attacker, { type:"raid", activity:"unity_surge", summary:"+5% OP next turn & +1 Morale (queued) on success." });
  }
  if (attSet.has("moral_high_ground") && success) {
    inc(attPending, "moraleDelta", +1);
    await pushWarLog(attacker, { type:"raid", activity:"moral_high_ground", summary:"+1 Morale (queued) from Moral High Ground (success)." });
  }

  // No-op coverage (log usage for maneuvers without special post handlers)
  try {
    const handledAtt = new Set([
      "flank_attack","propaganda_push","divine_favor","technocrat_override",
      "echo_strike_protocol","reality_hack","unity_surge","moral_high_ground"
    ]);
    const handledDef = new Set([]);
    const logNoop = async (who, keys) => {
      for (const k of keys) {
        const kk = String(k||"").toLowerCase(); if (!kk) continue;
        await pushWarLog(who, { type:"raid", activity: kk, summary:"Maneuver used (no special post effect)." });
      }
    };
    const attAll = new Set((maneuversAtt||[]).map(k=>String(k||"").toLowerCase()));
    const defAll = new Set((maneuversDef||[]).map(k=>String(k||"").toLowerCase()));
    const noopAtt = [...attAll].filter(k => !handledAtt.has(k));
    const noopDef = [...defAll].filter(k => !handledDef.has(k));
    if (noopAtt.length) await logNoop(attacker, noopAtt);
    if (defender && noopDef.length) await logNoop(defender, noopDef);
  } catch (e) {}

  const updates = [];
  updates.push(attacker.update({ [`flags.${MOD_FACTIONS}.turn.pending`]: attPending }));
  if (defender && defPending) updates.push(defender.update({ [`flags.${MOD_FACTIONS}.turn.pending`]: defPending }));
  if (hexActor && hexPending) updates.push(hexActor.update({ [`flags.${MOD_TERRITORY}.turn.pending`]: hexPending }));
  await Promise.all(updates);

  return { ok:true, pending:{ attacker:attPending, defender:defender?defPending:null, hex:hexPending||null } };
}

/* ---------------------- Turn Advance: consume queued Strategic effects ---------------------- */
async function consumeQueuedTurnEffects({ factionId } = {}) {
  const A = game.actors.get(_stripActorId(factionId));
  if (!A) throw new Error("consumeQueuedTurnEffects: faction not found");
  const flags = copy(A.flags?.[MOD_FACTIONS] ?? {});
  const pend  = copy(flags.turn?.pending ?? {});
  if (!Object.keys(pend).length) {
    await pushWarLog(A, { type:"turn", activity:"consumeQueuedTurnEffects", summary:"No queued effects to apply." });
    return { ok:true, changed:false, note:"empty" };
  }

  // --- Apply to faction mods/bonuses
  const mods     = ensure(flags, "mods", {});
  const bonuses  = ensure(flags, "bonuses", {});
  const intel    = ensure(flags, "intel", {});
  const applied  = ensure(flags, "turn.applied", []);
  const ts = Date.now();

  const inc = (obj, k, d=1)=> { obj[k] = Number(obj[k]||0) + Number(d||0); };

  if (pend.techScoreDelta) inc(mods, "techScore", pend.techScoreDelta);
  if (pend.loyaltyDelta)   inc(mods, "loyalty",   pend.loyaltyDelta);
  if (pend.moraleDelta)    inc(mods, "morale",    pend.moraleDelta);
  if (pend.empathyDelta)   inc(mods, "empathy",   pend.empathyDelta);
  if (pend.darknessDelta)  inc(mods, "darkness",  pend.darknessDelta);
  if (pend.enlightenmentForAllDelta) inc(mods, "enlightenmentAll", pend.enlightenmentForAllDelta);

  if (pend.capsDelta && typeof pend.capsDelta === "object") {
    const caps = ensure(mods, "caps", {});
    for (const [k,v] of Object.entries(pend.capsDelta)) inc(caps, k, Number(v||0));
  }

  if (pend.nextRaid && pend.nextRaid.defenseBonus) inc(ensure(bonuses,"nextRaid",{}), "defenseBonus", pend.nextRaid.defenseBonus);
  if (pend.nextTurn) {
    const nt = ensure(bonuses, "nextTurn", {});
    for (const [k,v] of Object.entries(pend.nextTurn)) { if (typeof v === "number") inc(nt, k, v); else nt[k] = v; }
  }
  if (pend.nextTurns) ensure(bonuses,"nextTurns",[]).push(...pend.nextTurns);

  if (pend.intel?.revealEnemyOpPoolsNextTurn) intel.revealEnemyOpPoolsNextTurn = true;
  if (pend.mergeResourcesNextTurn?.active) ensure(bonuses,"nextTurn",{}).mergeResources = true;

  const requests = {};
  for (const key of ["territory","eden","tikkun","alignment","recon","hex","trade","repairs"]) if (pend[key]) requests[key] = pend[key];
  if (Object.keys(requests).length) ensure(flags,"requests", Object.assign(ensure(flags,"requests",{}), requests));

  const hexUpdates = [];
  for (const hex of game.actors) {
    const hx = hex.flags?.[MOD_TERRITORY];
    if (!hx?.turn?.pending) continue;
    const hflags = copy(hex.flags?.[MOD_TERRITORY] ?? {});
    const hpend  = copy(hflags.turn?.pending ?? {});
    if (!Object.keys(hpend).length) continue;

    const hmods = ensure(hflags, "mods", {});
    const incH = (k,d)=>{ hmods[k] = Number(hmods[k]||0)+Number(d||0); };
    if (hpend.defenseDelta)      incH("defense", hpend.defenseDelta);
    if (hpend.tradeYieldDelta)   incH("tradeYield", hpend.tradeYieldDelta);
    if (hpend.loyaltyDelta)      incH("loyalty", hpend.loyaltyDelta);
    if (hpend.enemyLoyaltyDelta) incH("enemyLoyalty", hpend.enemyLoyaltyDelta);

    const hreq = ensure(hflags, "requests", {});
    if (hpend.statusSet)         hreq.statusSet = hpend.statusSet;
    if (hpend.cleanseCorruption) hreq.cleanseCorruption = true;
    if (hpend.destroyHex)        hreq.destroyHex = true;

    const happlied = ensure(hflags, "turn.applied", []);
    happlied.push({ ts, data: hpend });
    if (hflags.turn) hflags.turn.pending = {};

    hexUpdates.push(hex.update({ [`flags.${MOD_TERRITORY}`]: hflags }));
  }

  applied.push({ ts, data: pend });
  if (flags.turn) flags.turn.pending = {};

  await Promise.all([ ...hexUpdates, A.update({ [`flags.${MOD_FACTIONS}`]: flags }) ]);
  await pushWarLog(A, { type:"turn", activity:"consumeQueuedTurnEffects", summary:"Applied queued Strategic effects; pending cleared." });

  return { ok:true, changed:true, appliedAt: ts };
}

/* ---------------------- Planner derivation: robust getActivities ---------------------- */
function _buildActivitiesFromEffects() {
  const list = [];
  for (const [key, spec] of Object.entries(EFFECTS)) {
    if (spec?.kind !== "strategic") continue;
    list.push({
      key,
      label: spec.label || key.replace(/_/g," ").replace(/\b\w/g, c=>c.toUpperCase()),
      summary: spec.summary || "",
      cost: spec.cost || {}
    });
  }
  list.sort((a,b)=> a.label.localeCompare(b.label, undefined, { sensitivity:"base" }));
  return list;
}

/* ---------------------- Migration helpers (POST â†’ TURN; nextRound â†’ nextTurn) -------- */
function _normalizeQueueFlags(flags) {
  const f = copy(flags || {});
  const F = f[MOD_FACTIONS];
  if (!F) return f;

  const post = F.post?.pending;
  if (post && typeof post === "object") {
    const tp = ensure(F, "turn.pending", {});
    for (const [k,v] of Object.entries(post)) if (tp[k] === undefined) tp[k] = v;
    delete F.post;
  }
  const tp = F.turn?.pending;
  if (tp && typeof tp === "object" && "nextRound" in tp && tp.nextTurn === undefined) {
    tp.nextTurn = tp.nextRound;
    delete tp.nextRound;
  }
  return f;
}

async function _migrateActor(actor) {
  const flags = copy(actor.flags || {});
  const norm  = _normalizeQueueFlags(flags);
  if (!foundry.utils.isObjectEqual(flags, norm)) {
    await actor.update({ flags: norm });
    return true;
  }
  return false;
}

/* ---------------------- Expose API (publish in BOTH namespaces) ---------------------- */
function ensureNS(){
  game.bbttcc ??= { api:{} };
  game.bbttcc.api ??= {};
  game.bbttcc.api.raid ??= {};
}

function publishCompat() {
  try {
    ensureNS();

    // Merge any existing raid API (preserves planner opener and other extenders)
    const existing = (game.bbttcc?.api?.raid) || (game.modules.get(MOD_ID)?.api?.raid) || {};

    // Primary API object we will publish in both places
    const raidAPI = Object.assign({}, existing, {
      EFFECTS,
      __compatStamp: Date.now(),
      consumePlanned,
      resolveRoundWithManeuvers,
      applyPostRoundEffects,
      applyStrategicActivity: (args)=>queueStrategic(args),
      getActivities: () => _buildActivitiesFromEffects(),
      consumeQueuedTurnEffects,

      // NEW: accept attackerId OR factionId (Planner-friendly)
      async planActivity({ factionId, attackerId, activityKey, targetUuid=null, notes="", label=null } = {}) {
        const fid = factionId || attackerId;
        if (!fid || !activityKey) throw new Error("Missing factionId/attackerId or activityKey");

        const A = game.actors.get(_stripActorId(fid)) ||
                  (String(fid).startsWith("Actor.") ? await fromUuid(fid) : null);
        if (!A) throw new Error("Faction actor not found");

        // Resolve target name (optional)
        let tName = null;
        if (targetUuid) {
          try {
            const doc = await fromUuid(targetUuid);
            tName = doc?.flags?.[MOD_TERRITORY]?.name || doc?.name || doc?.text || null;
          } catch {}
        }

        const entry = {
          ts: Date.now(),
          date: nowISO(),
          type: "planned",
          activity: String(activityKey).toLowerCase(),
          targetUuid,
          targetName: tName,
          label: label || activityKey,
          notes
        };

        const flags = copy(A.flags?.[MOD_FACTIONS] || {});
        const wl = Array.isArray(flags.warLogs) ? flags.warLogs.slice() : [];
        wl.push(entry);
        await A.update({ [`flags.${MOD_FACTIONS}.warLogs`]: wl }, { diff:true, recursive:true });
        return entry;
      },

      // Migration helpers for manual invocation
      runQueueMigration: async () => {
        const actors = game.actors?.contents || [];
        let changed = 0;
        for (const a of actors) changed += (await _migrateActor(a)) ? 1 : 0;
        ui.notifications?.info?.(`[${MOD_ID}] Queue migration complete. Actors changed: ${changed}`);
        return changed;
      },
      _queueCompatInfo: () => {
        const f = game.actors.find(a => a.getFlag(MOD_FACTIONS, "isFaction"));
        if (!f) return { note: "No faction actor found." };
        const post = f.getFlag(MOD_FACTIONS, "post");
        const turn = f.getFlag(MOD_FACTIONS, "turn");
        return {
          hasLegacyPost: !!post,
          turnPendingKeys: Object.keys(turn?.pending || {}),
          version: game.modules.get(MOD_ID)?.version
        };
      }
    });

    // Publish to game.bbttcc.api.raid
    game.bbttcc.api.raid = raidAPI;

    // And also to module namespace for compatibility with callers using M.api
    const mod = game.modules.get(MOD_ID);
    mod.api ??= {};
    mod.api.raid = raidAPI;

    log("Compat bridge (re)published â€” latest handlers installed (dual namespace, merged).");
  } catch (e) { warn("Compat bridge publish failed:", e); }
}

if (globalThis?.Hooks?.once) Hooks.once("ready", async () => {
  // One-shot world migration on ready
  try {
    const actors = game.actors?.contents || [];
    let changed = 0;
    for (const a of actors) changed += (await _migrateActor(a)) ? 1 : 0;
    if (changed) log(`Migrated ${changed} actor(s) to TURN-only queue shape.`);
  } catch (e) { warn("ready migration error", e); }

  publishCompat();
});

try { if (globalThis?.game?.ready === true) publishCompat(); } catch {}

/* ---------------------- Viewport fit / scroll shim ---------------------- */
function fitRaidConsoleViewport(app){
  try {
    const el = app?.element instanceof jQuery ? app.element[0] : app?.element;
    if (!el) return;
    const win = el.closest?.(".app.window-app") || el;
    const content = win.querySelector?.(".window-content") || el;
    const H = Math.max(window.innerHeight || 800, 600);
    const maxH = Math.floor(H - 120);
    win.style.maxHeight = `${maxH}px`;
    win.style.height = `${Math.min(maxH, (win.offsetHeight || maxH))}px`;
    content.style.maxHeight = `${maxH - 60}px`;
    content.style.overflowY = "auto";
  } catch (e) {}
}
if (globalThis?.Hooks?.on) {
  Hooks.on("renderBBTTCC_RaidConsole", (app) => fitRaidConsoleViewport(app));
  Hooks.on("resizeBBTTCC_RaidConsole",  (app) => fitRaidConsoleViewport(app));
}

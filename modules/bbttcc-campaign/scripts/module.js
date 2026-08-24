// Bad Eden Campaign Builder - Module Entry
//
// v1.3.5 - AutoDebt Threshold + GM Decline + FallbackOnDecline
//
// RESTORE PASS (Dialog / Choices):
// - Beats can display a prompt+choices dialog even when beat.type === "scene_transition"
// - If beat.description and/or beat.choices exist, we present a dialog and route to next beats.
import "../apps/campaign-tag-picker.js";
import "../scripts/casualties-engine.js";
import "../apps/player-beat-mirror-app.js";
import "./bbttcc-rolls-api.js";

const MOD_ID  = "bbttcc-campaign";
const TAG     = "[bbttcc-campaign]";
const SETTING_CAMPAIGNS = "campaigns";
const SETTING_INJECT_STATE = "injectState";
const SETTING_TABLES = "encounterTables";
const SETTING_QUESTS = "quests";
const SETTING_ACTIVE_CAMPAIGN = "activeCampaignId";
const SETTING_LAST_TURN_ANNOUNCED = "lastTurnAnnounced"; // Campaign Turn Flow announcements
const SETTING_OVERSHOOT_BEATS = "overshoot.drawsBeats";  // Reality-Tear → Adversary beat draw
const SETTING_DIRECTOR_ENABLED = "director.enabled";     // Story Director: World-Turn tick on/off
const SETTING_DIRECTOR_STATE = "directorState";          // Story Director runtime state (budget, fired beats, level floors, pressure)
const SETTING_DIRECTOR_PRESSURE_THRESHOLD = "director.pressureThreshold"; // pressure needed for a MID-TURN director look
const SETTING_DIRECTOR_AUTOINVITE = "director.autoInvite"; // auto-post "NPC wants a word" cards when speaker moments open
const SETTING_DIRECTOR_TTONLY_CHAINS = "director.turnTickOnlyChains"; // CSV of storyChains that only fire on the world-turn tick (seam-excluded)
// Turn Ledger (2026-07-08): one World Turn = a time budget in days. Beats and
// travel legs debit it (world.addTime — the previously-dormant sink); the
// remainder banks into development. Soft budget: overspend carries as debt.
const SETTING_TURN_TIME_BUDGET = "ledger.turnTimeBudget";           // days per Strategic Turn (world.time.turnLength syncs to this)
const SETTING_LEDGER_ENTRIES = "ledgerEntries";                     // this turn's debit entries (what the days went to)
const SETTING_LEDGER_TRAVEL_TIER_DAYS = "ledger.travelDaysPerTier"; // CSV days-to-cross one hex, terrain tiers 1..4
// Phase 4 pressure accrual weights: how much each seam event raises story pressure.
// The World-Turn tick is the guaranteed heartbeat regardless; pressure only
// governs whether the director ALSO looks mid-turn (travel legs, raid rounds,
// resolved beats). Firing a story beat resets pressure; a GM decline halves it.
const DIRECTOR_PRESSURE = { turn: 30, leg: 8, raidRound: 10, beat: 3 };

// Forgotten-Cause arc (Wendigo leyline network). Per-world 0–4 "something OFF"
// escalation meter, bumped each time a Wendigo travel-encounter beat resolves.
// Step 1 of the meter wiring: store + increment only (escalation cards, feud
// flags, and the Dougan>=3 gate land in later steps).
const SETTING_WENDIGO_RUNG = "wendigoRung";
const SETTING_DOUGAN_POINTED = "wendigoDouganPointed"; // step 4: Dougan has pointed to the Confluence (fire-once)
const WENDIGO_RUNG_MAX = 4;
const WENDIGO_TRAVEL_BEAT_IDS = new Set([
  "acid_bog_logistics_success",
  "acid_bog_logistics_failure",
  "enc_broken_bridge_go_around_success",
  "enc_broken_bridge_go_around_fail",
  "enc_minor_radiation_pocket_go_around",
  "enc_minor_radiation_pocket_go_around_fail"
]);
// Per-rung "something OFF" detail Mal posts when a Wendigo travel beat resolves
// (step 2). Indexed by the post-increment rung (1–4); escalates funny -> uncanny
// -> awful, matching the Wendigo leyline-network spec.
const WENDIGO_RUNG_DETAILS = {
  1: "One of them hands your canteen back with a small, courteous bow. You are fairly sure you never dropped your canteen.",
  2: "One thanks you &mdash; warmly, and at some length &mdash; for the excellent directions. You did not give it any.",
  3: "One calls a name after you as you go. Not yours. The name of someone you used to know, and don&rsquo;t, anymore.",
  4: "One presses into your hands a thing you have not lost yet. (You will, next leg.) And you find, already, that you cannot picture the face that handed it over."
};
// Mal's aphorism, used only at the deep rungs — punctuation, never every card.
const WENDIGO_RUNG_MAL = {
  3: "They know a name you&rsquo;d stopped saying out loud. Ask who&rsquo;s been keeping it warm.",
  4: "You keep calling them kind. Kind things give. These ones keep the change."
};

// Forgotten-Cause arc, step 3 — feud state flags on the Jackalopes faction actor.
// The Confluence endings set whether the original cause was recovered (→ the Summit
// can truly close the Ledger); the Summit success/failure move the Grievance heat;
// `break` is peace-by-deletion (erases the grievance's ghost, ends the feud). Flags
// live on the faction actor under "bbttcc-factions" (canonical per-faction store).
const FF_NS = "bbttcc-factions";
const FORGOTTEN_CAUSE_FACTION_ID = "U5YaO2p189LBMvVq"; // "The Jackalopes" (Ember) — fallback if a beat carries no factionEffects
const FEUD_CONFLUENCE_RECOVER_IDS = new Set(["wendigo_confluence_repair", "wendigo_confluence_redirect"]);
const FEUD_BREAK_ID = "wendigo_confluence_break";
const FEUD_SUMMIT_SUCCESS_ID = "gullywasher_cultural_summit_success";
const FEUD_SUMMIT_FAILURE_ID = "gullywasher_cultural_summit_failure";

// Bandit Accord arc (Drowned South swamp bandits, HEX-VIGNETTES-2026-07-08 §3).
// Twin per-world meters — MERCY (spared bandits) and FEAR (executed ones) —
// armed only once the opening beat announces the theme (owner decision
// 2026-07-13 #3: nothing counts before the announcement). Wendigo-rung clone.
const SETTING_BANDIT_ARMED = "banditLedgerArmed";
const SETTING_BANDIT_MERCY = "banditMercy";
const SETTING_BANDIT_FEAR  = "banditFear";
const BANDIT_OPENING_BEAT_ID = "bandit_accord_opening";
const BANDIT_ARMS_DOWN_BEAT_ID     = "bandit_ambush_arms_down";
const BANDIT_ARMS_DOWN_ACCEPT_ID   = "bandit_arms_down_accept";
const BANDIT_ARMS_DOWN_VIOLENCE_ID = "bandit_arms_down_violence";
const BANDIT_HUMILIATION_BEAT_ID   = "bandit_summit_humiliation";
// Mercy rungs (post-increment mercy count → rung): 1 word-spreads ≥2 ·
// 2 volunteers ≥3 · 3 arms-down ≥4 · 4 the-envoy ≥6. The summit itself is
// routed from the envoy beat's choices, not a rung.
const BANDIT_MERCY_RUNG_AT = [2, 3, 4, 6];   // index+1 = rung
// The ambush family resolves by id pattern (win_free/win_jail = mercy,
// win_kill = fear) so outcome-id spelling variants in the live corpus still
// count; the authored arms-down beats are matched by exact id above.
const BANDIT_ENC_RE     = /^enc_bandit/i;
const BANDIT_MERCY_RE   = /(free|jail)/i;
const BANDIT_FEAR_RE    = /kill|execute/i;
// Reed-telegraph cards (posted when a rung is NEWLY reached), funny → moving.
const BANDIT_RUNG_DETAILS = {
  1: "A spared bandit leaves a fish on your waypost. Cleaned. The good kind. No note &mdash; in the Drowned South, that IS the note.",
  2: "Two of them are waiting at the Muster gate at dawn, hats in hands, boots almost clean. They have practiced saying &lsquo;gainful&rsquo; and it shows.",
  3: "An ambush breaks off mid-spring &mdash; arms down before the reeds stop moving. &lsquo;We yield. Is the program still open?&rsquo; The reeds pass it along like a password.",
  4: "A punt noses out of the mist under a white rag: a letter in a waxed pouch, and a lieutenant who salutes everything that moves. The Bandit Lord requests a summit."
};
const BANDIT_RUNG_MAL = {
  3: "You&rsquo;ve invented a weapon that recruits the people it&rsquo;s pointed at. Do keep it loaded.",
  4: "Mercy compounds faster than fear. Fear discounts. Ask any lender."
};

// The Cadence (HEX-VIGNETTES-2026-07-08 §1, owner decision #5: RECURRING
// soft-power antagonist / support-faction cameo reward). Three world flags,
// written by the outcome beats, read by inject.requires gates:
//   cadenceRespect     1 = out-danced with style; ONE allied-raid cameo owed
//   cadenceTribute     1 = lost gracefully; standing rematch offer each turn
//   cadenceUncontested 1 = refused; they perform AT your border until answered
const SETTING_CADENCE_RESPECT     = "cadenceRespect";
const SETTING_CADENCE_TRIBUTE     = "cadenceTribute";
const SETTING_CADENCE_UNCONTESTED = "cadenceUncontested";

// ── GRIEF-REFUSALS rung meters (2026-08-18) ────────────────────────────────
// The indict ladders for Chuckle Creek / Stillwater / Soft Landing. Each is a
// hidden 0–4 counter; every rung beat gates on it with { flag, gte }. Raised by
// the GM today (see seed-*.macro.js headers); when the "hex refuses consequence"
// substrate lands (`noncanon` / `stasis` / `cushioned`) the engine drives them.
// ── GEBURAH CONDUCT LEDGER (2026-08-18) ───────────────────────────────────
// The Lost Stone Statues grade, and they confer. Two 0–3 counters recording
// HOW each fragment was taken; the statues' later greetings and the final
// verdict gate on them. Canon already said they knew ("somewhere in the
// distance, something old and martial decides you may not be a joke after
// all") — this makes the knowing mechanical.
const SETTING_GEBURAH_EARNED = "geburahEarned";
const SETTING_GEBURAH_FORCED = "geburahForced";
const GEBURAH_EARNED_BEAT_IDS = new Set([
  "spark_geburah_northreach_b_worthy",
  "spark_geburah_mountains_q_worthy",
  "spark_geburah_mountains_o_worthy"
]);
const GEBURAH_FORCED_BEAT_IDS = new Set([
  "spark_geburah_northreach_b_force",
  "spark_geburah_mountains_q_force",
  "spark_geburah_mountains_o_force"
]);

const SETTING_CHUCKLE_SEEN   = "chucklecreekSeen";
const SETTING_STILLWATER_CRACK = "stillwaterCrack";
const SETTING_SOFTLANDING_GIVE = "softlandingGive";
const CADENCE_OUTCOME_FLAGS = {
  cadence_win_style: { respect: 1, tribute: 0, uncontested: 0 },  // cameo opens
  cadence_win_ugly:  { respect: 0, tribute: 0, uncontested: 0 },  // you won the hex, lost the region
  cadence_lose:      {             tribute: 1, uncontested: 0 },  // rematch stands
  cadence_refuse:    {                         uncontested: 1 },  // the border show begins
  cadence_cameo_spent: { respect: 0 }   // the owed raid is CALLED IN (the offer's
                                        // "hold the favor" exit resolves the parent
                                        // cadence_cameo beat without touching flags)
};

const DEFAULT_FACTION_UUID = "Actor.LjUgo0DxmSuEXMbs";
const DEBT_PREFIX = "[HV_DEBT:";

const log  = (...args) => console.log(TAG, ...args);
const warn = (...args) => console.warn(TAG, ...args);
const err  = (...args) => console.error(TAG, ...args);

// ---------------------------------------------------------------------------
// Dialog autosize helper (V1 Dialog / toast popouts)
// Fixes clipped bottom buttons by resizing to content after render.
// Safe, no modern syntax.
// ---------------------------------------------------------------------------
function __bbttccAutosizeDialog(app, opts) {
  try {
    opts = opts || {};
    var pad = (opts.pad == null) ? 26 : opts.pad;
    var minH = (opts.minH == null) ? 220 : opts.minH;
    var maxH = (opts.maxH == null) ? Math.floor(window.innerHeight * 0.92) : opts.maxH;

    var el =
      (app && app.element && app.element[0] instanceof HTMLElement) ? app.element[0] :
      (app && app.element instanceof HTMLElement) ? app.element :
      null;
    if (!el) return;

    var header = el.querySelector("header.window-header");
    var content = el.querySelector(".window-content") || el;

    if (content && content.style) content.style.overflowY = "auto";

    var hHeader = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    var hContent = content ? Math.ceil(content.scrollHeight) : 0;

    var target = hHeader + hContent + pad;
    if (target < minH) target = minH;
    if (target > maxH) target = maxH;

    if (typeof app.setPosition === "function") app.setPosition({ height: target });
  } catch (_e) {}
}


function __bbttccAutosizeDialogDeferred(app, opts) {
  try {
    setTimeout(function(){ try { __bbttccAutosizeDialog(app, opts); } catch (_e1) {} }, 0);
    setTimeout(function(){ try { __bbttccAutosizeDialog(app, opts); } catch (_e2) {} }, 75);
    setTimeout(function(){ try { __bbttccAutosizeDialog(app, opts); } catch (_e3) {} }, 200);
  } catch (_e) {}
}

// ---------------------------------------------------------------------------
// HexChrome Dialog hook (V1 Dialog)
// Ensures any Dialog (including first render after reload) gets HexChrome classes.
// ---------------------------------------------------------------------------
try {
  if (!globalThis.__bbttccHexChromeDialogHookInstalled) {
    globalThis.__bbttccHexChromeDialogHookInstalled = true;
    Hooks.on("renderDialog", function (app, html) {
      try { html?.addClass?.("bbttcc-choice-roll-dialog bbttcc-hexchrome-dialog"); } catch (_e) {}
      try { __bbttccAutosizeDialogDeferred(app, { pad: 40, maxH: Math.floor(window.innerHeight * 0.94) }); } catch (_e2) {}
    });
    // Foundry v14: Dialog.confirm / Dialog.prompt and DialogV2 render through
    // DialogV2 → fire "renderDialogV2" (NOT "renderDialog") and pass a raw
    // HTMLElement (not jQuery). Mirror the theming there so every dialog gets
    // HexChrome on v14, exactly like the V1 path above.
    Hooks.on("renderDialogV2", function (app, element) {
      try {
        const el = (element instanceof HTMLElement) ? element : (element?.[0] ?? app?.element ?? null);
        el?.classList?.add("bbttcc-choice-roll-dialog", "bbttcc-hexchrome-dialog");
      } catch (_e) {}
    });
    log("HexChrome Dialog hook installed (renderDialog + renderDialogV2).");
  }
} catch (_e) {}


// ---------------------------------------------------------------------------
// Campaign Encounter -> Encounter Engine registry bridge (A/B/C)
// - Rebuilds a runtime scenario index from campaign beats of type "encounter".
// - Prefers Encounter Engine external registry APIs (registerCampaignBeatScenario / registerScenario).
// - Falls back to legacy scenario-map injection when needed.
// ---------------------------------------------------------------------------

let _campaignEncounterKeys = new Set();
let _rebuildEncountersTimer = null;

function _getEncountersAPI() {
  return game?.bbttcc?.api?.encounters ?? null;
}

function _getScenarioMap(enc) {
  // Legacy / internal shapes (fallback only)
  return enc?.SCENARIOS ?? enc?.scenarios ?? enc?.__scenarios ?? null;
}

function _scheduleEncounterRebuild() {
  if (_rebuildEncountersTimer) clearTimeout(_rebuildEncountersTimer);
  _rebuildEncountersTimer = setTimeout(() => {
    _rebuildEncountersTimer = null;
    try { _rebuildCampaignEncounterIndex(); }
    catch (e) { warn("Encounter index rebuild failed:", e); }
  }, 250);
}

function _scenarioKeyForBeat(beat) {
  const k =
    beat?.encounter?.key ??
    beat?.encounterKey ??
    beat?.scenarioKey ??
    beat?.mechanics?.encounterKey ??
    beat?.mechanics?.scenarioKey ??
    "";
  return String(k || beat?.id || "").trim();
}

function _makeCampaignScenario({ campaignId, beat }) {
  const key = _scenarioKeyForBeat(beat);
  const label = beat?.label ?? key;
  const tier = Number.isFinite(Number(beat?.encounter?.tier)) ? Number(beat.encounter.tier) : null;

  // Provide multiple handler names to match whichever encounters API expects.
  const runner = async (ctx = {}) => {
    return game.bbttcc.api.campaign.runBeat(campaignId, beat.id, ctx);
  };

  return {
    key,
    label,
    type: "campaign",
    category: "campaign",
    tier,
    campaignId,
    beatId: beat.id,
    _source: `campaign:${campaignId}`, // Encounter Engine external registry uses this for cleanup
    // handlers
    run: runner,
    exec: runner,
    execute: runner,
    handler: runner,
    launch: runner,
    fn: runner
  };
}

function _unregisterScenario(enc, key) {
  if (!enc || !key) return false;

  if (typeof enc.unregisterScenario === "function") { enc.unregisterScenario(key); return true; }
  if (typeof enc.removeScenario === "function") { enc.removeScenario(key); return true; }

  const map = _getScenarioMap(enc);
  if (map && typeof map === "object" && key in map) {
    delete map[key];
    return true;
  }

  return false;
}

function _registerScenario(enc, scenario) {
  if (!enc || !scenario?.key) return false;

  // Prefer explicit API methods if available.
  if (typeof enc.registerScenario === "function") { enc.registerScenario(scenario, { source: scenario._source || "campaign", force: true }); return true; }
  if (typeof enc.addScenario === "function") { enc.addScenario(scenario); return true; }
  if (typeof enc.upsertScenario === "function") { enc.upsertScenario(scenario); return true; }

  // Fallback: write into scenario map if it exists.
  const map = _getScenarioMap(enc);
  if (map && typeof map === "object") {
    map[scenario.key] = scenario;
    return true;
  }

  return false;
}

function _clearPreviouslyRegisteredCampaignScenarios(enc) {
  // Best: Encounter Engine external registry supports listScenarios + unregisterScenario
  if (typeof enc?.listScenarios === "function" && typeof enc?.unregisterScenario === "function") {
    const list = enc.listScenarios();
    const mine = list.filter(s => String(s?._source || "").startsWith("campaign:"));
    for (const s of mine) enc.unregisterScenario(s.key);
    _campaignEncounterKeys = new Set();
    return;
  }

  // Fallback: remove the ones we registered last pass
  for (const k of _campaignEncounterKeys) _unregisterScenario(enc, k);
  _campaignEncounterKeys = new Set();
}

function _rebuildCampaignEncounterIndex() {
  const enc = _getEncountersAPI();
  if (!enc) return;

  _clearPreviouslyRegisteredCampaignScenarios(enc);

  const all = getAllCampaigns();
  for (const [campaignId, raw] of Object.entries(all)) {
    const c = _normalizeCampaign(campaignId, raw);
    for (const beat of (c.beats || [])) {
      if (!beat) continue;
      if (beat.type !== "encounter" && beat.type !== "cinematic" && !(beat.cinematic && beat.cinematic.enabled)) continue;

      // Preferred: Encounter Engine helper to turn a campaign beat into a scenario.
      if (typeof enc.registerCampaignBeatScenario === "function") {
        try {
          enc.registerCampaignBeatScenario(campaignId, beat, { source: `campaign:${campaignId}`, force: true });
          const key = _scenarioKeyForBeat(beat);
          if (key) _campaignEncounterKeys.add(key);
          continue;
        } catch (e) {
          warn("registerCampaignBeatScenario failed; falling back to manual scenario build", e);
        }
      }

      const key = _scenarioKeyForBeat(beat);
      if (!key) continue;

      const scenario = _makeCampaignScenario({ campaignId, beat });
      const ok = _registerScenario(enc, scenario);
      if (ok) _campaignEncounterKeys.add(key);
    }
  }

  log("Campaign encounters registered into Encounter Engine:", _campaignEncounterKeys.size);
}


// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function _normBeatId(v) {
  return String(v || "").trim();
}

function _dedupeBeats(beatsIn = []) {
  const beats = [];
  const seen = new Map();
  for (const b of beatsIn) {
    if (!b) continue;
    const id = _normBeatId(b.id);
    if (!id) continue;
    const beat = b;
    beat.id = id;
    if (seen.has(id)) {
      // last-write wins, preserve original slot
      beats[seen.get(id)] = beat;
    } else {
      seen.set(id, beats.length);
      beats.push(beat);
    }
  }
  return beats;
}


function _normalizeCampaign(id, data = {}) {
  const label = data?.label ?? data?.title ?? id;

  // Defensive: de-dupe beats by ID on write.
  // This prevents UI bugs or multi-hook races from persisting duplicate beats.
  const beatsIn = Array.isArray(data?.beats) ? data.beats : [];
  const beatsOut = [];
  const seen = new Map(); // beatId -> index in beatsOut
  for (const b of beatsIn) {
    const bid = String(b?.id || "").trim();
    if (!bid) {
      beatsOut.push(b);
      continue;
    }
    if (seen.has(bid)) {
      beatsOut[seen.get(bid)] = b;
      continue;
    }
    seen.set(bid, beatsOut.length);
    beatsOut.push(b);
  }

  // Multi-faction roster. factionId remains the PRIMARY (used for inheritance,
  // war-log targeting, casualty defaults). factionIds is the full active roster
  // — all factions involved in the campaign (used for credit/quest/WME fan-out).
  const primary = String(data?.factionId || "").trim() || null;
  const rawIds = Array.isArray(data?.factionIds) ? data.factionIds : [];
  const idsSet = new Set();
  const factionIds = [];
  if (primary) { idsSet.add(primary); factionIds.push(primary); }
  for (const raw of rawIds) {
    const id = String(raw || "").trim();
    if (!id || idsSet.has(id)) continue;
    idsSet.add(id);
    factionIds.push(id);
  }
  const factionIdFinal = primary || factionIds[0] || null;

  return {
    // Preserve extension fields (npcPlacements, future additions) — this used
    // to return a FIXED shape, silently stripping anything it didn't know
    // about on every read AND permanently on every save (live-caught
    // 2026-07-03: npcPlacements vanished between the seeder and the engine).
    ...(data && typeof data === "object" ? data : {}),
    id,
    label,
    title: label,
    description: data?.description ?? "",
    // Primary faction — default for beat inheritance / war log / casualty targeting.
    factionId: factionIdFinal,
    // Full active roster — credit + WME fan-out across all involved factions.
    factionIds,
    beats: beatsOut
  };
}

// ---------------------------------------------------------------------------
// Campaign Turn Flow (Phase 1)
// - Beats can be assigned to a Strategic Turn number (beat.turnNumber).
// - We sync a compact per-turn availability map into bbttcc-world setting "turnBeats"
//   so the world engine (and other UIs) can see what's now available when the turn advances.
// - The Campaign Builder uses beat.turnNumber locally for filtering/grouping; the world map is a convenience.
// ---------------------------------------------------------------------------

function _getWorldAPI() {
  try { return game && game.bbttcc && game.bbttcc.api ? game.bbttcc.api.world : null; } catch (_e) { return null; }
}

function _safeInt(v, fallback) {
  var n = parseInt(v, 10);
  if (!isFinite(n)) n = parseInt(fallback, 10);
  if (!isFinite(n)) n = 0;
  return n;
}

function _extractTurnNumber(beat) {
  var n = _safeInt(beat && (beat.turnNumber != null ? beat.turnNumber : (beat.turn != null ? beat.turn : beat.availableTurn)), 0);
  return n >= 1 ? n : 0;
}

function _syncWorldTurnBeatsForCampaign(campaignId) {
  try {
    var w = _getWorldAPI();
    if (!w) return false;

    // Prefer API helper if present; otherwise write the setting directly.
    var campaign = getCampaign(campaignId);
    if (!campaign) return false;

    var map = {};
    var beats = Array.isArray(campaign.beats) ? campaign.beats : [];
    for (var i = 0; i < beats.length; i++) {
      var b = beats[i];
      if (!b) continue;
      var tn = _extractTurnNumber(b);
      if (!tn) continue;
      var key = String(tn);
      if (!Array.isArray(map[key])) map[key] = [];
      map[key].push({
        v: 1,
        campaignId: campaign.id,
        beatId: String(b.id || ""),
        label: String(b.label || b.id || ""),
        type: String(b.type || "custom")
      });
    }

    // Keep entries deterministic (helps diffing and keeps UI stable)
    Object.keys(map).forEach(function (k) {
      map[k].sort(function (a, b) {
        return String(a.label || "").localeCompare(String(b.label || "")) || String(a.beatId).localeCompare(String(b.beatId));
      });
    });

    if (typeof w.setTurnBeatsMap === "function") {
      w.setTurnBeatsMap(map);
      return true;
    }

    // Fallback: write hidden setting directly (api.world.js ensures it's registered).
    try {
      if (game && game.settings && typeof game.settings.set === "function") {
        game.settings.set("bbttcc-world", "turnBeats", map);
        return true;
      }
    } catch (_e2) {}

    return false;
  } catch (e) {
    warn("syncWorldTurnBeatsForCampaign failed:", e);
    return false;
  }
}

function _gmIds() {
  try { return (game.users || []).filter(function (u) { return u && u.isGM; }).map(function (u) { return u.id; }); } catch (_e) { return []; }
}

function _announceTurnAvailabilityIfNeeded() {
  try {
    // GM-only. This persists the world setting `lastTurnAnnounced` and its whole
    // output is a GM whisper, but it ran on every client from bbttcc:advanceTurn:end
    // — so a player advancing/previewing a Turn threw "lacks permission to update
    // Setting" (the try/catch swallowed the JS error, Foundry still logged the
    // server rejection). 2026-08-17. Also: with several GMs the lastTurnAnnounced
    // check keeps the whisper single anyway.
    if (!game.user?.isGM) return;

    var w = _getWorldAPI();
    if (!w || typeof w.getState !== "function" || typeof w.getTurnBeats !== "function") return;

    var state = w.getState();
    var turn = _safeInt(state && state.turn, 0);
    if (!turn || turn < 1) return;

    var last = 0;
    try { last = _safeInt(game.settings.get(MOD_ID, SETTING_LAST_TURN_ANNOUNCED), 0); } catch (_e0) { last = 0; }
    if (turn <= last) return;

    var entries = w.getTurnBeats(turn) || [];
    if (!Array.isArray(entries)) entries = [];

    // Persist last announced turn (so we don't repeat on re-load)
    try { game.settings.set(MOD_ID, SETTING_LAST_TURN_ANNOUNCED, String(turn)); } catch (_e1) {}

    if (!entries.length) return;

    // Director record: badge beats that have already fired on any surface.
    var dstate = null;
    try { dstate = _readDirectorState(); } catch (_eDS) { dstate = null; }

    var lines = [];
    lines.push('<p><b>Strategic Turn ' + String(turn) + '  -  Now Available</b></p>');
    lines.push('<ul>');
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i] || {};
      var lbl = String(e.label || e.beatId || "Beat");
      var bid = String(e.beatId || "");
      var typ = String(e.type || "");
      var fired = null;
      try { fired = dstate ? _beatFiredInfo(dstate, bid) : null; } catch (_eF) { fired = null; }
      var firedBadge = fired
        ? ' <span style="color:#5ac878;font-size:.85em" title="Already fired (' + fired.via + (fired.turn ? ', turn ' + fired.turn : "") + ')">&#10003; fired</span>'
        : '';
      lines.push('<li><b>' + foundry.utils.escapeHTML(lbl) + '</b>' + firedBadge + ' <span style="opacity:.75">(' + foundry.utils.escapeHTML(typ) + ')  - </span> <code>' + foundry.utils.escapeHTML(bid) + '</code></li>');
    }
    lines.push('</ul>');

    var gm = _gmIds();
    if (!gm.length) return;

    ChatMessage.create({
      content: lines.join(""),
      whisper: gm,
      speaker: { alias: "Bad Eden Campaign" }
    });
  } catch (e) {
    warn("announceTurnAvailabilityIfNeeded failed:", e);
  }
}

function getAllCampaigns() {
  try {
    const stored = game.settings.get(MOD_ID, SETTING_CAMPAIGNS);
    if (!stored || typeof stored !== "object") return {};
    return foundry.utils.deepClone(stored);
  } catch (e) {
    warn("getAllCampaigns failed:", e);
    return {};
  }
}

async function setAllCampaigns(campaigns) {
  await game.settings.set(MOD_ID, SETTING_CAMPAIGNS, campaigns ?? {});
  return campaigns ?? {};
}

function getCampaign(id) {
  const all = getAllCampaigns();
  const c = all[id] ?? null;
  return c ? _normalizeCampaign(id, c) : null;
}

async function saveCampaign(id, data) {
  if (!id) throw new Error("saveCampaign: id required");
  const all = getAllCampaigns();
  all[id] = _normalizeCampaign(id, data);
  await setAllCampaigns(all);
  log("Saved campaign", id);
  _scheduleEncounterRebuild();
  // Campaign Turn Flow: sync per-turn availability for the active campaign.
  try {
    var active = getActiveCampaignId();
    if (String(active || "") === String(id)) _syncWorldTurnBeatsForCampaign(id);
  } catch (_e) {}
  return all[id];
}

async function createCampaign(id, data = {}) {
  if (!id) throw new Error("createCampaign: id required");
  const all = getAllCampaigns();
  if (all[id]) return _normalizeCampaign(id, all[id]);
  all[id] = _normalizeCampaign(id, data);
  await setAllCampaigns(all);
  log("Created campaign", id);
  _scheduleEncounterRebuild();
  try {
    var active = getActiveCampaignId();
    if (String(active || "") === String(id)) _syncWorldTurnBeatsForCampaign(id);
  } catch (_e) {}
  return all[id];
}

async function deleteCampaign(id) {
  const all = getAllCampaigns();
  if (!(id in all)) return false;
  delete all[id];
  await setAllCampaigns(all);
  log("Deleted campaign", id);
  _scheduleEncounterRebuild();
  // If we deleted the active campaign, clear the world turn-beats map.
  try {
    var active = getActiveCampaignId();
    if (String(active || "") === String(id)) {
      var w = _getWorldAPI();
      if (w && typeof w.setTurnBeatsMap === "function") w.setTurnBeatsMap({});
      else if (game && game.settings && typeof game.settings.set === "function") game.settings.set("bbttcc-world", "turnBeats", {});
    }
  } catch (_e) {}
  return true;
}

function listCampaigns() {
  const all = getAllCampaigns();
  return Object.entries(all).map(([id, c]) => _normalizeCampaign(id, c));
}

// ---------------------------------------------------------------------------
// Encounter Tables (NEW)
// ---------------------------------------------------------------------------

function _normalizeTable(id, data = {}) {
  return {
    id,
    label: data?.label ?? id,
    scope: data?.scope ?? "global",
    tags: Array.isArray(data?.tags) ? data.tags : [],
    entries: Array.isArray(data?.entries) ? data.entries : []
  };
}

function getAllTables() {
  try {
    const stored = game.settings.get(MOD_ID, SETTING_TABLES);
    if (!stored || typeof stored !== "object") return {};
    return foundry.utils.deepClone(stored);
  } catch (e) {
    warn("getAllTables failed:", e);
    return {};
  }
}

async function setAllTables(tables) {
  await game.settings.set(MOD_ID, SETTING_TABLES, tables ?? {});
  return tables ?? {};
}

// ---------------------------------------------------------------------------
// Quests (Definitions Registry)
// Stored in world settings (bbttcc-campaign.quests)
// ---------------------------------------------------------------------------

function _normalizeQuest(id, data = {}) {
  const q = data || {};
  return {
    id,
    v: q?.v ?? 1,
    // Display / authoring
    name: String(q?.name ?? q?.label ?? id),
    description: String(q?.description ?? ""),
    tags: Array.isArray(q?.tags) ? q.tags : [],

    // NEW: status + order (registry workflow)
    status: String(q?.status ?? "active"),
    order: (q?.order != null) ? Number(q.order) : (q?.createdTs ?? Date.now()),

    // Optional: campaign association (future-proof; safe to ignore)
    campaignId: String(q?.campaignId ?? "") || null,

    // Hex links — Drawing IDs of Bad Eden hexes this quest is associated with.
    // Bidirectional with hex flag flags["bbttcc-territory"].quests[questId].
    hexIds: Array.isArray(q?.hexIds) ? Array.from(new Set(q.hexIds.map(String))) : [],

    createdTs: q?.createdTs ?? Date.now(),
    updatedTs: q?.updatedTs ?? Date.now()
  };
}

function getAllQuests() {
  try {
    const stored = game.settings.get(MOD_ID, SETTING_QUESTS);
    if (!stored || typeof stored !== "object") return {};
    return foundry.utils.deepClone(stored);
  } catch (e) {
    warn("getAllQuests failed:", e);
    return {};
  }
}

async function setAllQuests(quests) {
  await game.settings.set(MOD_ID, SETTING_QUESTS, quests ?? {});
  return quests ?? {};
}

function listQuests(opts = {}) {
  // opts: { campaignId, status: "all"|"active"|"completed"|"archived", search }
  const all = getAllQuests();
  const campaignId = String(opts?.campaignId || "").trim() || null;
  const status = String(opts?.status || "all").trim().toLowerCase();
  const search = String(opts?.search || "").trim().toLowerCase();

  let out = Object.entries(all).map(([id, q]) => _normalizeQuest(id, q));

  if (campaignId) {
    out = out.filter(q => !q.campaignId || String(q.campaignId) === String(campaignId));
  }

  if (status && status !== "all") {
    out = out.filter(q => String(q.status || "active").trim().toLowerCase() === status);
  }

  if (search) {
    out = out.filter(q => {
      const id = String(q.id || "").toLowerCase();
      const nm = String(q.name || "").toLowerCase();
      return id.includes(search) || nm.includes(search);
    });
  }

  // Stable sort: order asc, then name, then id
  out.sort((a, b) => {
    const ao = Number(a.order ?? a.createdTs ?? 0) || 0;
    const bo = Number(b.order ?? b.createdTs ?? 0) || 0;
    if (ao !== bo) return ao - bo;
    const an = String(a.name || a.id || "");
    const bn = String(b.name || b.id || "");
    return an.localeCompare(bn) || String(a.id || "").localeCompare(String(b.id || ""));
  });

  return out;
}

function getQuest(id) {
  const all = getAllQuests();
  const q = all[id] ?? null;
  return q ? _normalizeQuest(id, q) : null;
}

async function saveQuest(id, data = {}) {
  if (!id) throw new Error("saveQuest: id required");
  const all = getAllQuests();
  const prev = all[id] ?? {};
  const merged = Object.assign({}, prev, data, { updatedTs: Date.now() });
  all[id] = _normalizeQuest(id, merged);
  await setAllQuests(all);
  return getQuest(id);
}

async function createQuest(id, data = {}) {
  if (!id) throw new Error("createQuest: id required");
  const all = getAllQuests();
  if (all[id]) return getQuest(id);
  const q = Object.assign({}, data, { createdTs: Date.now(), updatedTs: Date.now() });
  all[id] = _normalizeQuest(id, q);
  await setAllQuests(all);
  return getQuest(id);
}

async function setQuestStatus(id, status) {
  status = String(status || "active").trim().toLowerCase();
  if (!status) status = "active";
  if (status !== "active" && status !== "completed" && status !== "archived") status = "active";
  const cur = getQuest(id);
  if (!cur) throw new Error("setQuestStatus: quest not found: " + String(id || ""));
  return await saveQuest(id, Object.assign({}, cur, { status: status }));
}

async function deleteQuest(id) {
  const all = getAllQuests();
  if (!(id in all)) return false;
  delete all[id];
  await setAllQuests(all);
  return true;
}


function getTable(id) {
  const all = getAllTables();
  const t = all[id] ?? null;
  return t ? _normalizeTable(id, t) : null;
}

async function saveTable(id, data) {
  if (!id) throw new Error("saveTable: id required");
  const all = getAllTables();
  all[id] = _normalizeTable(id, data);
  await setAllTables(all);
  log("Saved encounter table", id);
  return all[id];
}

async function createTable(id, data = {}) {
  if (!id) throw new Error("createTable: id required");
  const all = getAllTables();
  if (all[id]) return _normalizeTable(id, all[id]);
  all[id] = _normalizeTable(id, data);
  await setAllTables(all);
  log("Created encounter table", id);
  return all[id];
}

async function deleteTable(id) {
  const all = getAllTables();
  if (!(id in all)) return false;
  delete all[id];
  await setAllTables(all);
  log("Deleted encounter table", id);
  return true;
}

function listTables() {
  const all = getAllTables();
  return Object.entries(all).map(([id, t]) => _normalizeTable(id, t));
}

// ---------------------------------------------------------------------------
// Random Table Execution
// ---------------------------------------------------------------------------

function _canonicalizeCampaignTag(tag) {
  const raw = String(tag || "").trim();
  if (!raw) return "";
  const map = {
    "trigger.travel_threshold": "inject.travel_threshold",
    "travel_threshold": "inject.travel_threshold",
    "enforcement": "inject.enforcement",
    "debt": "inject.debt_pressure",
    "hv.hidden_vault": "theme.discovery",
    "gilbert": "theme.auditor",
    "locals": "theme.locals",
    "denizens": "theme.denizens",
    "order": "politics.order",
    "security": "politics.security",
    "surveillance": "politics.surveillance",
    "repression": "politics.repression",
    "redistribution": "politics.redistribution",
    "privatization": "politics.privatization",
    "deregulation": "politics.deregulation",
    "welfare": "politics.welfare",
    "union_power": "politics.union_power",
    "collectivize": "politics.collectivize",
    "civil_liberties": "politics.civil_liberties",
    "property_rights": "politics.property_rights",
    "faith_law": "politics.faith_law",
    "clerical_rule": "politics.clerical_rule",
    "ethnonationalism": "politics.ethnonationalism",
    "purge": "politics.purge",
    "mutual_aid": "politics.mutual_aid",
    "decentralize": "politics.decentralize"
  };
  return map[raw] || raw;
}

function _tagArray(tagStr) {
  return String(tagStr || "").split(/[\s,]+/g).map(s => _canonicalizeCampaignTag(s.trim())).filter(Boolean);
}

function _passesEntryConditions(entry, { hexUuid = null, tags = "" } = {}) {
  const c = entry?.conditions || {};
  const tagList = _tagArray(tags);

  // hex allow/deny
  if (Array.isArray(c.hexWhitelist) && c.hexWhitelist.length && hexUuid) {
    if (!c.hexWhitelist.includes(hexUuid)) return false;
  }
  if (Array.isArray(c.hexBlacklist) && c.hexBlacklist.length && hexUuid) {
    if (c.hexBlacklist.includes(hexUuid)) return false;
  }

  // tag matching
  if (Array.isArray(c.tagsAll) && c.tagsAll.length) {
    const want = new Set(c.tagsAll);
    for (const t of want) if (!tagList.includes(t)) return false;
  }
  if (Array.isArray(c.tagsAny) && c.tagsAny.length) {
    const want = new Set(c.tagsAny);
    let ok = false;
    for (const t of tagList) if (want.has(t)) { ok = true; break; }
    if (!ok) return false;
  }

  return true;
}

function _weightedPick(entries) {
  const pool = entries
    .map(e => ({ e, w: Number(e?.weight ?? 0) }))
    .filter(x => x.w > 0);

  const total = pool.reduce((s, x) => s + x.w, 0);
  if (!total) return null;

  let r = Math.random() * total;
  for (const x of pool) {
    r -= x.w;
    if (r <= 0) return x.e;
  }
  return pool[pool.length - 1]?.e ?? null;
}

/**
 * Run a random encounter table by selecting an entry and delegating to runBeat().
 * Tables select beats. Beats execute exactly as-is (dialogs, encounters, world effects).
 *
 * Pass { dryRun: true } to roll through the SAME condition filter + weighted
 * pick but return the selection WITHOUT executing the beat (no scene, no
 * dialogs, no world effects, no time cost). Used by the Builder's Preview Roll.
 */
async function runRandomTable({ tableId, hexUuid = null, tags = "", ctx = {}, dryRun = false } = {}) {
  if (!tableId) throw new Error("runRandomTable: tableId required");

  const table = getTable(tableId);
  if (!table) {
    ui.notifications?.warn?.(`Random Table '${tableId}' not found.`);
    return { ok: false, reason: "table_not_found" };
  }

  const entries = Array.isArray(table.entries) ? table.entries : [];
  const filtered = entries.filter(ent => _passesEntryConditions(ent, { hexUuid, tags }));

  if (!filtered.length) {
    warn("runRandomTable: no eligible entries after filtering", { tableId, hexUuid, tags });
    ui.notifications?.warn?.(`Random Table '${table.label || tableId}': no eligible entries.`);
    return { ok: false, reason: "no_entries" };
  }

  const pick = _weightedPick(filtered);
  if (!pick) {
    warn("runRandomTable: weightedPick returned null", { tableId });
    ui.notifications?.warn?.(`Random Table '${table.label || tableId}': roll failed.`);
    return { ok: false, reason: "roll_failed" };
  }

  const campaignId = String(pick.campaignId || "").trim();
  const beatId = String(pick.beatId || "").trim();
  if (!campaignId || !beatId) {
    warn("runRandomTable: pick missing campaignId/beatId", pick);
    ui.notifications?.warn?.(`Random Table '${table.label || tableId}': entry missing campaignId/beatId.`);
    return { ok: false, reason: "bad_entry" };
  }

  if (dryRun) {
    log("Random Table dry-run (beat NOT executed)", { tableId, campaignId, beatId, hexUuid, tags });
    return { ok: true, dryRun: true, tableId, campaignId, beatId };
  }

  log("Random Table fired", { tableId, campaignId, beatId, hexUuid, tags });

  // Delegate to beat execution (keeps all existing mechanics intact)
  // Pass table context through so encounter beats can launch with hexUuid/tags awareness.
  await runBeat(campaignId, beatId, { ...ctx, tableId, hexUuid, tags });

  return { ok: true, tableId, campaignId, beatId };
}

// ---------------------------------------------------------------------------
// Gottgait
// ---------------------------------------------------------------------------

async function logBeatToGottgait(campaign, beat) {
  const story = game.bbttcc?.api?.story?.gottgait;
  if (!story?.logBeat) return;
  try {
    await story.logBeat(
      `Campaign '${campaign.label}' beat '${beat.label || beat.id}' (${beat.type})`,
      { source: "bbttcc-campaign", campaignId: campaign.id, beatId: beat.id, beatType: beat.type }
    );
  } catch (e) {
    warn("logBeatToGottgait failed:", e);
  }
}

// ---------------------------------------------------------------------------
// Dialog / Choices (RESTORED)
// ---------------------------------------------------------------------------

function _escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------------------------------------------------------------------------
// Journal auto-open (Beat.journal)  -  GM-only
// - beat.journal: { enabled:boolean, entryId:"JournalEntry.<id>"|"<id>", force:boolean }
// - When enabled, executeBeat will open the Journal Entry for the GM only
//   (mirrors clicking it in the Journal sidebar).
// ---------------------------------------------------------------------------

function _normalizeJournalId(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (s.indexOf("JournalEntry.") === 0) return s.slice("JournalEntry.".length);
  return s;
}

function _openJournalForGM(doc) {
  try {
    if (!doc) return;

    // Mirrors sidebar open: render the sheet for the local GM.
    if (doc.sheet && typeof doc.sheet.render === "function") {
      doc.sheet.render(true);
      return;
    }

    // Fallback (rare): some documents expose show(); keep GM-only intent.
    if (typeof doc.show === "function") doc.show(false);
  } catch (e) {
    warn("openJournalForGM failed:", e);
  }
}

function _maybeShowBeatJournal(beat) {
  try {
    const j = beat?.journal;
    if (!j || !j.enabled) return;

    const id = _normalizeJournalId(j.entryId);
    if (!id) return;

    const je = game?.journal?.get?.(id) || null;
    if (!je) return;

    _openJournalForGM(je);
  } catch (e) {
    warn("Beat journal auto-open failed:", e);
  }
}



// ---------------------------------------------------------------------------
// Beat Audio (Narration)  -  local playback helper (GM-side)
// - beat.audio: { enabled, src, volume (0..1), loop, autoplay }
// - Default behavior: only the local client plays audio (no broadcast).
// - We stop any prior beat audio before playing a new one (prevents stacking).
// ---------------------------------------------------------------------------

let __bbttccBeatAudioNow = null;
let __bbttccBeatAudioSrcNow = "";
let __bbttccBeatAudioActive = new Set();
let __bbttccBeatAudioPlayToken = 0;
let __bbttccBeatAudioStartedAt = 0;

// Reference to the beat currently shown in a _runBeatDialog. Set when the
// dialog renders and cleared on close. Read by the document-level Play
// delegation below so the Play button works even if the dialog-scoped
// jQuery delegation attached before the element was populated.
let __bbttccCurrentBeatDialogBeat = null;
let __bbttccBeatDialogPlayDelegationInstalled = false;
function _installBeatDialogPlayDelegation() {
  if (__bbttccBeatDialogPlayDelegationInstalled) return;
  __bbttccBeatDialogPlayDelegationInstalled = true;
  try {
    document.addEventListener("click", (ev) => {
      try {
        const btn = ev.target?.closest?.(".bbttcc-beat-audio-play");
        if (!btn) return;
        ev.preventDefault();
        const beat = __bbttccCurrentBeatDialogBeat;
        _audioDebug("doc:play-click", { beatId: beat?.id || null, hasBeatRef: !!beat });
        if (!beat) return;
        _playBeatAudio(beat, { caller: "doc-play-click" }).catch(() => {});
      } catch (_eH) {}
    }, { capture: false });
  } catch (_e) {}
}

// Phase 0 observability. No-op unless the `audio.debug` client setting is on.
// Pass a short caller tag + a payload object; we enrich with isGM, token, ts.
function _audioDebug(tag, payload) {
  let on = false;
  try { on = !!game?.settings?.get?.(MOD_ID, "audio.debug"); } catch (_e) {}
  if (!on) return;
  try {
    const meta = {
      t: Date.now(),
      isGM: !!game?.user?.isGM,
      token: __bbttccBeatAudioPlayToken,
      srcNow: __bbttccBeatAudioSrcNow || null
    };
    console.log("[bbttcc-audio]", tag, { ...meta, ...(payload || {}) });
  } catch (_e) {}
}

function _rememberBeatAudio(sound) {
  try {
    if (!sound) return;
    __bbttccBeatAudioActive.add(sound);
  } catch (_e) {}
}

function _forgetBeatAudio(sound) {
  try {
    if (!sound) return;
    __bbttccBeatAudioActive.delete(sound);
  } catch (_e) {}
}

// Foundry stores Sound.src URL-encoded (e.g. "Mal%20Voice%20Acting/...")
// while beat.audio.src may be saved un-encoded. Normalize both sides of any
// src comparison so the sweep actually matches.
function _normalizeAudioSrc(s) {
  const raw = String(s || "").trim();
  if (!raw) return "";
  try { return decodeURIComponent(raw); } catch (_e) { return raw; }
}

// Returns a promise that resolves once the sound is fully stopped. v13/v14
// Sound#stop is async; firing-and-forgetting leaves the old sound still
// fading while the next one starts, producing player-side echo/delay.
function _stopOneBeatAudio(sound) {
  try {
    if (!sound) return Promise.resolve();
    if (typeof sound.stop === "function") {
      // {fade: 0} kills the sound instantly instead of letting v13/v14's
      // default fade-out bleed into the next play (player-side echo source).
      return Promise.resolve(sound.stop({ fade: 0 })).catch(() => {
        try { return sound.stop(); } catch (_e) {}
      });
    }
    if (typeof sound.fade === "function") {
      return Promise.resolve(sound.fade(0, { duration: 0 })).catch(() => {});
    }
  } catch (_e) {}
  return Promise.resolve();
}

async function _stopBeatAudio(opts) {
  opts = opts || {};
  const m = _mgr();
  if (!m) return;
  return m.stopAll({ caller: opts.caller || "unknown", push: !!opts.push });
}



// ---------------------------------------------------------------------------
// Beat Audio socket broadcast (GM -> players)
// - When beat.audio.broadcastPlayers is true, GM will broadcast playback to all
//   connected non-GM clients so narration becomes audible to the table.
// - Clients receive {type:'bbttccBeatAudio'} messages and play/stop locally.
// ---------------------------------------------------------------------------

const __BBTTCC_BEAT_AUDIO_SOCKET = `module.${MOD_ID}`;

const __BBTTCC_PLAYER_CHAT_FLAG = "playerFacingCourier";

function _extractPlayerFacingChatPayload(message) {
  try {
    const f = message && message.flags && message.flags[MOD_ID] ? message.flags[MOD_ID] : null;
    const row = f && f[__BBTTCC_PLAYER_CHAT_FLAG] ? f[__BBTTCC_PLAYER_CHAT_FLAG] : null;
    return row && typeof row === "object" ? row : null;
  } catch (_e) { return null; }
}

function _playerFacingRecipientIds() {
  try {
    return (game.users || [])
      .filter(function (u) { return u && !u.isGM; })
      .map(function (u) { return u.id; });
  } catch (_e) { return []; }
}

async function _broadcastPlayerFacingDialogViaChat(action, payload) {
  try {
    if (!game || !game.user || !game.user.isGM) return false;
    const recipients = _playerFacingRecipientIds();
    if (!recipients.length) return false;

    const row = {
      action: String(action || ""),
      payload: payload || {},
      ts: Date.now()
    };

    await ChatMessage.create({
      content: '<span style="display:none">Bad Eden Courier</span>',
      whisper: recipients,
      speaker: { alias: "Bad Eden Campaign" },
      flags: {
        [MOD_ID]: {
          [__BBTTCC_PLAYER_CHAT_FLAG]: row
        }
      }
    });

    return true;
  } catch (e) {
    warn("Player-facing chat bridge failed:", e);
    return false;
  }
}

function _installPlayerFacingChatBridge() {
  try {
    if (globalThis.__bbttccPlayerFacingChatBridgeInstalled) return;
    globalThis.__bbttccPlayerFacingChatBridgeInstalled = true;

    Hooks.on("createChatMessage", function (message) {
      try {
        const row = _extractPlayerFacingChatPayload(message);
        if (!row) return;
        if (game && game.user && game.user.isGM) return;

        const action = String(row.action || "");
        const payload = row.payload || {};

        if (action === "show") {
          _showPlayerFacingDialogLocal(payload);
          return;
        }
        if (action === "close") {
          _closePlayerFacingDialogLocal();
          return;
        }
        // audioPlay / audioStop are no longer broadcast via chat courier;
        // Foundry's native AudioHelper.push handles the play fan-out, and the
        // module socket channel handles stop (see _installBeatAudioSocket).
      } catch (e) {
        warn("Player-facing createChatMessage bridge failed:", e);
      }
    });

    Hooks.on("renderChatMessageHTML", function (message, html) {
      try {
        const row = _extractPlayerFacingChatPayload(message);
        if (!row) return;
        try {
          if (html && html.style) html.style.display = "none";
        } catch (_e1) {}
        try {
          if (html && html.classList) html.classList.add("bbttcc-hidden-courier");
        } catch (_e2) {}
      } catch (_e) {}
    });

    log("Player-facing chat bridge installed.");
  } catch (_e) {}
}


// Deprecated no-op. The socket listener is now installed by
// BeatAudioManager.init() (scripts/audio/beat-audio-manager.js). Kept as a
// named function because module.js's ready-hook still calls it; the manager's
// init is idempotent so double-calls are harmless. Remove in Phase 5.
function _installBeatAudioSocket() {
  try { globalThis.__bbttccBeatAudioManager?.init(); } catch (_e) {}
}

// NOTE: _broadcastBeatAudio (chat-courier based fan-out) was removed as part
// of the audio refactor. Play fan-out now rides Foundry's native
// AudioHelper.push mechanism; stop fan-out uses the module socket channel
// (see _installBeatAudioSocket). Player-facing dialog mirror still uses the
// chat courier via _broadcastPlayerFacingDialog below.

// ---------------------------------------------------------------------------
// Player-Facing Beat Dialog mirror (GM -> players)
// - When beat.playerFacing is true, GM broadcasts a read-only mirror dialog
//   to connected non-GM clients.
// - Players can read the beat description + visible choices, but cannot choose.
// - Mirror closes automatically when the GM resolves/closes the controlling dialog.
// ---------------------------------------------------------------------------

let __bbttccPlayerFacingDialog = null;

function _closePlayerFacingDialogLocal() {
  try {
    const pm = game?.bbttcc?.api?.campaign?.playerMirror || globalThis.BBTTCCPlayerBeatMirrorApp || null;
    if (pm && typeof pm.close === "function") pm.close();
  } catch (_ePM) {}
  try {
    const d = __bbttccPlayerFacingDialog;
    if (d && typeof d.close === "function") d.close();
  } catch (_e) {}
  __bbttccPlayerFacingDialog = null;
}

function _buildPlayerFacingDialogHtml(payload) {
  try {
    const title = _escapeHtml(payload && payload.title ? payload.title : "Beat");
    const desc = String(payload && payload.desc ? payload.desc : "").trim();
    const choices = Array.isArray(payload && payload.choices ? payload.choices : []) ? payload.choices : [];

    var parts = [];
    parts.push('<div class="bbttcc-campaign-dialog bbttcc-player-facing-dialog">');
    parts.push('<div style="font-weight:800; margin-bottom:8px;">' + title + '</div>');

    if (desc) {
      parts.push('<div class="bbttcc-campaign-dialog-desc" style="margin-bottom:10px;">' + _escapeHtml(desc).replace(/\n/g, "<br/>") + '</div>');
    }

    if (choices.length) {
      parts.push('<div class="bbttcc-campaign-dialog-choices">');
      for (var i = 0; i < choices.length; i++) {
        var ch = choices[i] || {};
        var label = _escapeHtml(ch.label || ("Choice " + (i + 1)));
        var cdesc = String(ch.description || "").trim();
        var checkLabel = String(ch.checkLabel || "").trim();
        var checkDC = _num(ch.checkDC, 0);

        parts.push('<div style="padding:8px 10px; border:1px solid rgba(255,255,255,0.10); border-radius:10px; margin:8px 0;">');
        parts.push('<div style="font-weight:700;">' + label + '</div>');
        if (cdesc) parts.push('<div style="opacity:0.85; margin-top:6px;">' + _escapeHtml(cdesc).replace(/\n/g, "<br/>") + '</div>');
        if (checkLabel) {
          parts.push('<div style="opacity:0.85; font-size:12px; margin-top:6px;"><b>Check:</b> ' + _escapeHtml(checkLabel) + '  -  <b>Difficulty:</b> ' + _escapeHtml(String(checkDC)) + '</div>');
        }
        parts.push('</div>');
      }
      parts.push('</div>');
    } else {
      parts.push('<div style="opacity:.8; margin-top:8px;">No choices are available for players on this beat.</div>');
    }

    parts.push('<div style="opacity:.72; font-size:12px; margin-top:10px;">Player-facing view. The GM resolves the outcome.</div>');
    parts.push('</div>');
    return parts.join("");
  } catch (_e) {
    return '<div class="bbttcc-campaign-dialog"><p>Player-facing beat dialog.</p></div>';
  }
}

function _showPlayerFacingDialogLocal(payload) {
  try {
    _closePlayerFacingDialogLocal();

    var title = String(payload && payload.title ? payload.title : "Beat");
    var content = _buildPlayerFacingDialogHtml(payload);

    // Player-facing mirror is intentionally read-only.
    // We rely on the window close control / GM close broadcast rather than footer buttons.
    var dlg = new Dialog({
      title: title,
      content: content,
      buttons: {},
      close: function () { __bbttccPlayerFacingDialog = null; }
    });

    __bbttccPlayerFacingDialog = dlg;
    dlg.render(true);

    try {
      setTimeout(function(){
        try { __bbttccAutosizeDialogDeferred(dlg, { pad: 40, maxH: Math.floor(window.innerHeight * 0.94) }); } catch (_eA) {}
        try {
          if (dlg && dlg.element && dlg.element.addClass) dlg.element.addClass("bbttcc-choice-roll-dialog bbttcc-hexchrome-dialog");
        } catch (_eB) {}
        try {
          var btnWrap = dlg && dlg.element && dlg.element.find ? dlg.element.find(".dialog-buttons") : [];
          if (btnWrap && btnWrap.length) {
            try { btnWrap[0].style.display = "none"; } catch (_eC0) {}
          }
        } catch (_eD) {}
      }, 0);
    } catch (_e1) {}
  } catch (e) {
    warn("showPlayerFacingDialogLocal failed:", e);
    try {
      ui.notifications && ui.notifications.info && ui.notifications.info(String(payload && payload.title ? payload.title : "Beat"));
    } catch (_eN) {}
  }
}

function _broadcastPlayerFacingDialog(action, payload) {
  try {
    return _broadcastPlayerFacingDialogViaChat(action, payload);
  } catch (e) {
    warn("Player-facing dialog broadcast failed:", e);
    return false;
  }
}


// Resume any suspended Foundry audio contexts. V13 splits audio into three
// contexts (music, environment, interface); a suspended context lets
// AudioHelper.play resolve without emitting sound — the usual cause of
// silent or flaky beat audio.
async function _resumeAudioContext() {
  try {
    const g = game?.audio || {};
    const candidates = [g.music, g.environment, g.interface, g.context].filter(
      c => c && typeof c.resume === "function"
    );
    for (const ctx of candidates) {
      try { if (ctx.state === "suspended") await ctx.resume(); } catch (_e) {}
    }
  } catch (_e) {}
}

// --------------------------------------------------------------------------
// Phase 1 shims. Real implementation lives in
// scripts/audio/beat-audio-manager.js (exposed on globalThis). These wrappers
// preserve the legacy function names so existing call sites keep working
// while we migrate. All audio state (currentSound, tokens, inflight promise)
// lives in the manager — the module-level `__bbttccBeatAudio*` globals above
// are no longer load-bearing (left as no-op ballast until Phase 5 deletes them).
// --------------------------------------------------------------------------

function _mgr() { return globalThis.__bbttccBeatAudioManager || null; }

// Emergency fallback if the BeatAudioManager isn't on globalThis (manifest
// cache, esmodule load failure, etc.). Plays directly via AH.play with no
// dedupe, no event bus — just "don't leave the user without audio while we
// figure out why the manager didn't load."
async function _playBeatAudioFallback(beat) {
  try {
    const a = beat && beat.audio ? beat.audio : null;
    if (!a || !a.enabled) return null;
    const src = String(a.src || "").trim();
    if (!src) return null;
    if (!game.user || !game.user.isGM) return null;
    const AH = foundry?.audio?.AudioHelper || globalThis.AudioHelper || null;
    if (!AH || typeof AH.play !== "function") return null;
    const vol0 = Number(a.volume);
    const volume = Number.isFinite(vol0) ? Math.max(0, Math.min(1, vol0)) : 0.85;
    const loop = !!a.loop;
    const push = !!a.broadcastPlayers;
    return await AH.play({ src, volume, loop }, { push });
  } catch (_e) { return null; }
}

async function _playBeatAudio(beat, opts) {
  const m = _mgr();
  if (!m) {
    warn("BeatAudioManager not initialized — using emergency fallback (no dedupe)");
    return _playBeatAudioFallback(beat);
  }
  const trigger = (opts && opts.caller) || "external";
  return m.playForBeat(beat, { trigger });
}

async function _maybePlayBeatAudio(beat) {
  try {
    const a = beat && beat.audio ? beat.audio : null;
    if (!a || !a.enabled) return false;
    if (!a.autoplay) return false;
    const m = _mgr();
    if (!m) return false;
    await m.playForBeat(beat, { trigger: "autoplay" });
    return true;
  } catch (_e) {
    return false;
  }
}

function _choiceHasCheck(ch) {
  return !!(ch?.checkStat && String(ch.checkStat).trim());
}

function _choiceCheckLabel(key) {
  const k = String(key || "").trim().toLowerCase();
  const map = {
    gm: "GM Adjudication",

    str: "Strength",
    dex: "Dexterity",
    con: "Constitution",
    int: "Intelligence",
    wis: "Wisdom",
    cha: "Charisma",

    "save.str": "Strength Save",
    "save.dex": "Dexterity Save",
    "save.con": "Constitution Save",
    "save.int": "Intelligence Save",
    "save.wis": "Wisdom Save",
    "save.cha": "Charisma Save",

    acr: "Acrobatics",
    ani: "Animal Handling",
    arc: "Arcana",
    ath: "Athletics",
    dec: "Deception",
    his: "History",
    ins: "Insight",
    itm: "Intimidation",
    inv: "Investigation",
    med: "Medicine",
    nat: "Nature",
    prc: "Perception",
    prf: "Performance",
    per: "Persuasion",
    rel: "Religion",
    slt: "Sleight of Hand",
    ste: "Stealth",
    sur: "Survival",

    "op.violence": "Violence",
    "op.nonlethal": "Nonlethal",
    "op.intrigue": "Intrigue",
    "op.economy": "Economy",
    "op.softpower": "Soft Power",
    "op.diplomacy": "Diplomacy",
    "op.logistics": "Logistics",
    "op.cult": "Culture",
    "op.faith": "Faith"
  };
  return map[k] || key;
}


function _isGMAdjudicatedChoice(ch) {
  try {
    if (!ch) return false;
    if (String(ch.checkMode || "").trim().toLowerCase() === "gm") return true;
    if (String(ch.checkStat || "").trim().toLowerCase() === "gm") return true;
  } catch (_e) {}
  return false;
}

function _gmAdjudicate(title, promptHtml) {
  return new Promise(function (resolve) {
    try {
      var content =
        '<div class="bbttcc-campaign-dialog" style="min-width:360px;">' +
        (promptHtml || "") +
        '</div>';

      var dlg = new Dialog({
        title: title || "Adjudicate Outcome",
        content: content,
        buttons: {
          success: { icon: '<i class="fas fa-check"></i>', label: "SUCCESS", callback: function () { resolve(true); } },
          fail:    { icon: '<i class="fas fa-times"></i>', label: "FAIL",    callback: function () { resolve(false); } }
        },
        default: "success",
        close: function () { resolve(false); }
      });

      dlg.render(true);
      try { __bbttccAutosizeDialogDeferred(dlg, { pad: 40, maxH: Math.floor(window.innerHeight * 0.94) }); } catch (_e1) {}
      try { setTimeout(function(){ try { if (dlg && dlg.element && dlg.element.addClass) dlg.element.addClass("bbttcc-choice-roll-dialog bbttcc-hexchrome-dialog"); } catch (_eX) {} }, 0); } catch (_e2) {}
    } catch (e) {
      console.warn(TAG, "gmAdjudicate failed:", e);
      resolve(false);
    }
  });
}


function _num(v, d=0) {
  const s = String(v ?? "").replace(/\u2212/g, "-").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : d;
}


async function _evalRoll(roll) {
  // Foundry v13: Roll#evaluate is async by default; the {async:true} option is deprecated.
  try { return await roll.evaluate(); } catch (_e1) {}
  try { return await roll.evaluate({ async: true }); } catch (_e2) {}
  try { return roll.evaluateSync(); } catch (_e3) {}
  return roll;
}

async function _resolveFaction(id) {
  if (!id) return null;
  if (String(id).includes(".")) {
    try { return await fromUuid(id); } catch {}
  }
  return game.actors?.get?.(id) || null;
}

function _characterBelongsToFactionForCampaign(char, faction) {
  try {
    if (!char || !faction) return false;
    const byId = char.getFlag?.("bbttcc-factions", "factionId");
    if (byId) return String(byId) === String(faction.id);
    const byName = char.getFlag?.("bbttcc-factions", "factionName");
    if (byName) return String(byName).trim() === String(faction.name).trim();
    return false;
  } catch (_e) {
    return false;
  }
}

async function _getFactionRoster(faction) {
  try {
    const out = [];
    const seen = new Set();
    const raw = (faction && faction.getFlag) ? (faction.getFlag("bbttcc-factions", "roster") || []) : [];

    for (let i=0; i<raw.length; i++) {
      const entry = raw[i];

      // Support roster entries as:
      // - actor id: "abcd1234..."
      // - uuid-ish: "Actor.<id>"
      // - object: { id, uuid }
      const s = (typeof entry === "string") ? entry : (entry && (entry.uuid || entry.id)) ? String(entry.uuid || entry.id) : "";
      if (!s) continue;

      // Direct id
      const id = String(s).replace(/^Actor\./, "").trim();

      // Prefer local world actors
      let a = game.actors.get(id) || null;

      // If not found and looks like a UUID, try fromUuid
      if (!a && (String(s).indexOf(".") !== -1) && typeof fromUuid === "function") {
        try { a = await fromUuid(String(s)); } catch (_eU) { a = null; }
      }

      if (a && !seen.has(String(a.id))) {
        seen.add(String(a.id));
        out.push(a);
      }
    }

    // Fallback: if no explicit roster flag exists, mirror the faction-sheet roster logic
    // by scanning all character actors linked by bbttcc-factions.factionId / factionName.
    if (!out.length) {
      const actors = Array.from(game.actors?.contents || []);
      for (let i=0; i<actors.length; i++) {
        const a = actors[i];
        if (!a) continue;
        if (String(a.type || "") !== "character") continue;
        if (!_characterBelongsToFactionForCampaign(a, faction)) continue;
        if (seen.has(String(a.id))) continue;
        seen.add(String(a.id));
        out.push(a);
      }
    }

    return out;
  } catch (_e) {
    return [];
  }
}

function _readOpBank(faction, key) {
  const bank = faction?.getFlag("bbttcc-factions", "opBank") || {};
  return _num(bank[key], 0);
}

function _readActorOp(actor, key) {
  try {
    const k = String(key || "").trim().toLowerCase();
    const v =
      foundry.utils.getProperty(actor, `flags.bbttcc-character-options.calculatedOPs.${k}`) ??
      foundry.utils.getProperty(actor, `flags.bbttcc-character-options.opBonuses.${k}`) ??
      foundry.utils.getProperty(actor, `flags.bbttcc.opBonuses.${k}`) ??
      foundry.utils.getProperty(actor, `flags.bbttcc-factions.opContrib.${k}`) ??
      0;
    return _num(v, 0);
  } catch (_e) {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// OP Gating (Campaign Dialog)  -  attempt requires 1 OP of type
// - Adds tooltips + disables OP-check choice buttons when OP is empty.
// - Optional Desperation (UI + confirm) when ctx.allowDesperation === true.
// - Adds OP hover chips to beat dialogs.
// NOTE: This is UI gating + (optional) 1-OP spend on attempt for OP checks.
// ---------------------------------------------------------------------------

function _opKeyLabel(key) {
  key = String(key || "").trim().toLowerCase();
  if (!key) return "OP";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

// Marks helpers — bank values are stored in marks (1 OP = 10 marks).
const _OP_TO_MARKS = 10;
function _marksToOpDisplay(marks) {
  const n = _num(marks, 0);
  const op = n / _OP_TO_MARKS;
  if (Number.isInteger(op)) return String(op);
  return op.toFixed(1);
}

function _readOpBankAll(faction) {
  try {
    const bank = (faction && faction.getFlag) ? (faction.getFlag("bbttcc-factions", "opBank") || {}) : ((faction && faction.flags && faction.flags["bbttcc-factions"] && faction.flags["bbttcc-factions"].opBank) || {});
    const out = {};
    for (const k of Object.keys(bank || {})) out[String(k)] = _num(bank[k], 0);
    return out;
  } catch (_e) { return {}; }
}

async function _computeFactionOpRollBonusMap(faction) {
  try {
    const bank = _readOpBankAll(faction);
    const roster = await _getFactionRoster(faction);
    const keys = new Set(Object.keys(bank || {}));
    ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"].forEach(k => keys.add(k));
    const out = {};
    for (const k of keys) {
      const key = String(k || "").trim().toLowerCase();
      if (!key) continue;
      const base = _num(bank[key], 0);
      const rosterSum = Array.isArray(roster) ? roster.reduce((s, a) => s + _readActorOp(a, key), 0) : 0;
      out[key] = base + rosterSum;
    }
    return out;
  } catch (_e) { return {}; }
}

function _buildOpChipsHtml(bank, focusKey) {
  try {
    const keys = Object.keys(bank || {});
    keys.sort((a,b)=>String(a).localeCompare(String(b)));
    const chips = [];

    for (let i=0; i<keys.length; i++) {
      const k = String(keys[i] || "").trim();
      const vMarks = _num(bank[k], 0);
      const opDisplay = _marksToOpDisplay(vMarks);
      const label = _opKeyLabel(k);
      // "ok" = at least 1 full OP available (10 marks). "empty" = below 1 OP.
      const state = (vMarks >= _OP_TO_MARKS) ? "ok" : "empty";
      const focus = (focusKey && String(focusKey) === String(k)) ? " focus" : "";
      const tt = (vMarks >= _OP_TO_MARKS)
        ? ("Faction " + label + " OP available: " + opDisplay + " (" + vMarks + " marks)")
        : ("No " + label + " OP available (" + vMarks + " marks)");

      chips.push(
        `<span class="bbttcc-op-chip ${state}${focus}" data-op="${_escapeHtml(k)}" title="${_escapeHtml(tt)}">${_escapeHtml(label)}: ${opDisplay}</span>`
      );
    }

    if (focusKey && !Object.prototype.hasOwnProperty.call(bank || {}, focusKey)) {
      const label2 = _opKeyLabel(focusKey);
      const tt2 = "No " + label2 + " OP available";
      chips.unshift(
        `<span class="bbttcc-op-chip empty focus" data-op="${_escapeHtml(focusKey)}" title="${_escapeHtml(tt2)}">${_escapeHtml(label2)}: 0</span>`
      );
    }

    return `<div class="bbttcc-op-chips">${chips.join("")}</div>`;
  } catch (_e) {
    return "";
  }
}

function _buildOpRollBonusChipsHtml(bonuses, focusKey) {
  try {
    const keys = Object.keys(bonuses || {});
    keys.sort((a,b)=>String(a).localeCompare(String(b)));
    const chips = [];

    for (let i=0; i<keys.length; i++) {
      const k = String(keys[i] || "").trim();
      const v = _num(bonuses[k], 0);
      const label = _opKeyLabel(k);
      const focus = (focusKey && String(focusKey) === String(k)) ? " focus" : "";
      const tt = "Faction " + label + " OP roll bonus: +" + v;

      chips.push(
        `<span class="bbttcc-op-chip roll${focus}" data-op-roll="${_escapeHtml(k)}" title="${_escapeHtml(tt)}">${_escapeHtml(label)}: +${v}</span>`
      );
    }

    if (focusKey && !Object.prototype.hasOwnProperty.call(bonuses || {}, focusKey)) {
      const label2 = _opKeyLabel(focusKey);
      const tt2 = "Faction " + label2 + " OP roll bonus: +0";
      chips.unshift(
        `<span class="bbttcc-op-chip roll focus" data-op-roll="${_escapeHtml(focusKey)}" title="${_escapeHtml(tt2)}">${_escapeHtml(label2)}: +0</span>`
      );
    }

    return `<div class="bbttcc-op-chips bbttcc-op-roll-bonuses">${chips.join("")}</div>`;
  } catch (_e) {
    return "";
  }
}

function _evalOpGateForKey(faction, opKey, allowDesperation) {
  // pool is in MARKS; gate = ≥1 OP available (10 marks).
  const v = _readOpBank(faction, opKey);
  if (v >= _OP_TO_MARKS) return { ok: true, mode: "normal", pool: v };
  if (allowDesperation) return { ok: true, mode: "desperation", pool: v };
  return { ok: false, mode: "blocked", pool: v };
}

function _applyOpGatesToDialogButtons(dlg, faction, choices, allowDesperation) {
  try {
    if (!dlg || !dlg.element) return;
    const el = dlg.element;

    const byButtonId = {};
    for (let i=0; i<choices.length; i++) byButtonId["c" + i] = i;

    const btns = el.find(".dialog-buttons button");
    btns.each(function () {
      const $b = $(this);
      const bid = $b.attr("data-button") || "";
      const idx = (bid in byButtonId) ? byButtonId[bid] : null;
      if (idx == null) return;

      const ch = choices[idx] || {};
      const stat = String(ch.checkStat || "").trim().toLowerCase();
      if (stat.indexOf("op.") !== 0) return;

      const opKey = String(stat.split(".")[1] || "").trim().toLowerCase();
      if (!opKey) return;

      const gate = _evalOpGateForKey(faction, opKey, allowDesperation);

      if (!gate.ok) {
        $b.prop("disabled", true);
        $b.addClass("bbttcc-roll-blocked");
        $b.attr("title", "Action Unavailable\nRequires 1 " + _opKeyLabel(opKey) + " OP.\nThe faction cannot support this action.");
        return;
      }

      if (gate.mode === "desperation") {
        $b.prop("disabled", false);
        $b.addClass("bbttcc-roll-desperate");
        $b.attr("title", "Desperation Attempt\nNo " + _opKeyLabel(opKey) + " OP remains.\nRoll proceeds, but consequences are guaranteed.");
        try { el.find('.bbttcc-op-chip[data-op="' + opKey + '"]').addClass("desperate"); } catch (_e2) {}
        return;
      }

      $b.prop("disabled", false);
      $b.removeClass("bbttcc-roll-blocked bbttcc-roll-desperate");
      $b.attr("title", "Faction Support Available\nSpending 1 " + _opKeyLabel(opKey) + " OP authorizes this roll.");
    });
  } catch (e) {
    warn("applyOpGatesToDialogButtons failed:", e);
  }
}

async function _confirmDesperation(opKey) {
  return new Promise(function (resolve) {
    const label = _opKeyLabel(opKey);
    new Dialog({
      title: "Proceed in Desperation?",
      content:
        "<p>You are attempting an action without faction support.</p>" +
        "<p><b>This roll is a Desperation Attempt.</b></p>" +
        "<p style='opacity:.85'>No <b>" + label + " OP</b> remains. Consequences are guaranteed.</p>",
      buttons: {
        yes: { icon: '<i class="fas fa-exclamation-triangle"></i>', label: "Proceed Anyway", callback: function () { resolve(true); } },
        no:  { icon: '<i class="fas fa-ban"></i>', label: "Stand Down",     callback: function () { resolve(false); } }
      },
      default: "no",
      close: function () { resolve(false); }
    }).render(true);
  });
}

async function _spendOneOpForAttempt(faction, opKey, reason) {
  try {
    const api = game && game.bbttcc && game.bbttcc.api ? game.bbttcc.api : null;
    const op = api && api.op ? api.op : null;
    if (!op || typeof op.commit !== "function") return false;

    const factionId = faction && faction.id ? faction.id : null;
    if (!factionId) return false;

    const deltas = {};
    // Spend 1 OP per attempt = 10 marks.
    deltas[String(opKey)] = -_OP_TO_MARKS;

    await op.commit(factionId, deltas, reason || ("Campaign OP check: " + String(opKey)));
    return true;
  } catch (e) {
    warn("OP spend failed (attempt spendOneOpForAttempt).", e);
    try { ui.notifications && ui.notifications.warn && ui.notifications.warn("Could not spend 1 " + _opKeyLabel(opKey) + " OP (see console)."); } catch (_e2) {}
    return false;
  }
}

async function _spendFactionOpSupport(faction, opKey, amount, reason) {
  try {
    amount = _num(amount, 0);
    if (!faction || !opKey || amount <= 0) return false;

    // amount arrives in OP (UI-facing); convert to marks at the engine boundary.
    const amountMarks = Math.round(Math.abs(amount) * _OP_TO_MARKS);

    const api = game && game.bbttcc && game.bbttcc.api ? game.bbttcc.api : null;
    const op = api && api.op ? api.op : null;

    if (op && typeof op.commit === "function") {
      const deltas = {};
      deltas[String(opKey)] = -amountMarks;
      await op.commit(faction.id, deltas, reason || ("Faction backing: " + String(opKey)));
      return true;
    }

    const bank = _readOpBankAll(faction);
    const cur = _num(bank[String(opKey)], 0);  // marks
    if (cur < amountMarks) return false;
    bank[String(opKey)] = Math.max(0, cur - amountMarks);
    await faction.setFlag("bbttcc-factions", "opBank", bank);
    return true;
  } catch (e) {
    warn("spendFactionOpSupport failed", e);
    return false;
  }
}
function _supportBonusForSpend(spend) {
  spend = _num(spend, 0);
  return Math.max(0, spend) * 2; // +2 per OP
}

async function _sacrificeHpToFactionOp(actor, faction, opKey, hpCost, reason) {
  try {
    hpCost = _num(hpCost, 5);
    if (!actor || !faction || !opKey) return false;

    const hp = actor.system && actor.system.attributes && actor.system.attributes.hp ? actor.system.attributes.hp : null;
    const cur = hp ? _num(hp.value, 0) : 0;
    if (cur < hpCost) {
      ui.notifications?.warn?.("Not enough HP to sacrifice (" + hpCost + " required).");
      return false;
    }

    await actor.update({ "system.attributes.hp.value": Math.max(0, cur - hpCost) });

    const api = game && game.bbttcc && game.bbttcc.api ? game.bbttcc.api : null;
    const op = api && api.op ? api.op : null;
    if (op && typeof op.commit === "function") {
      // HP sacrifice → +1 OP = +10 marks.
      const deltas = {}; deltas[String(opKey)] = +_OP_TO_MARKS;
      await op.commit(faction.id, deltas, reason || ("HP sacrifice -> " + String(opKey)));
    } else {
      const bank = _readOpBankAll(faction);
      bank[String(opKey)] = _num(bank[String(opKey)], 0) + _OP_TO_MARKS;
      await faction.setFlag("bbttcc-factions", "opBank", bank);
    }

    ui.notifications?.info?.("Sacrifice accepted: -" + hpCost + " HP  ->  +1 " + _opKeyLabel(opKey) + " OP (Faction).");
    return true;
  } catch (e) {
    warn("sacrificeHpToFactionOp failed", e);
    try { ui.notifications?.warn?.("Sacrifice failed (see console)."); } catch(_e2){}
    return false;
  }
}




// fourththing lane (2026-08-22): this system has no rollSkill and stores no
// `abilities`, so every actor-side beat check was silently falling through to
// a NAKED 1d20 — the campaign's skill scenes were stat-blind coin flips.
// Content was also authored with dnd5e-era 3-letter codes; alias them to the
// system's real skill keys and roll through the system's own skillCheck
// (2d10x10 + faculty + rank, Surge-aware). Freeform stats like
// "Investigation (Mind)" resolve by their first word.
const _FT_SKILL_ALIASES = {
  per: "perception", prc: "perception", inv: "investigation", ins: "insight",
  arc: "occult", rel: "faith", nat: "lore", his: "lore", sur: "lore",
  prf: "performance", ath: "athletics", acr: "athletics", ste: "stealth",
  slt: "streetwise", dec: "streetwise", itm: "intimidation", med: "meditation",
  dip: "diplomacy", emp: "empathy", pil: "piloting", hac: "hacking", tin: "tinkering",
  // 2026-08-22 armor-skill rename: weave→fitting (light), warding→bracing (medium).
  weave: "fitting", warding: "bracing"
};
function _ftSkillKeyFor(stat) {
  let s = String(stat || "").trim().toLowerCase();
  const m = s.match(/^([a-z]+)/);
  if (m) s = m[1];
  return _FT_SKILL_ALIASES[s] || s;
}

async function _rollChoiceCheck(choice, ctx={}) {
  const stat = String(choice.checkStat || "").trim().toLowerCase();
  const dc = _num(choice.checkDC, 0);
  const supportKey = String((ctx.supportOpKey || (ctx.support || {}).opKey) || "").trim().toLowerCase();
  const supportSpend = _num((ctx.supportSpend != null ? ctx.supportSpend : (ctx.support || {}).spend), 0);
  const supportBonus = _supportBonusForSpend(supportSpend);

  if (stat.startsWith("op.")) {
    const key = stat.split(".")[1];
    const factionId = ctx.factionId || ctx.factionUuid || ctx.actorId || null;
    const faction = await _resolveFaction(factionId);
    if (!faction) {
      const roll = await _evalRoll(new Roll("1d20"));
      return { kind:"op", stat, dc, total:roll.total, ok:roll.total>=dc, roll };
    }
    // OP-check roll bonus: faction bank contributes whole OPs only (marks/10 floor).
    // Roster contributions stay as-is (already authored in OP units).
    const baseMarks = _readOpBank(faction, key);
    const baseOp = Math.floor(baseMarks / _OP_TO_MARKS);
    const roster = await _getFactionRoster(faction);
    const rosterSum = roster.reduce((s,a)=>s+_readActorOp(a,key),0);
    const bonus = baseOp + rosterSum;
    const roll = await _evalRoll(new Roll("1d20 + @b", { b: bonus }));
    const total = roll.total ?? 0;
    return { kind:"op", stat, opKey:key, dc, bonus, breakdown:{ base: baseOp, baseMarks, roster:rosterSum }, total, ok:total>=dc, roll };
  }

  let actor = null;
  if (ctx.rosterActorId) actor = game.actors.get(ctx.rosterActorId) || null;
  if (actor) {
    try {

      // fourththing lane — must run BEFORE the dnd5e-shaped branches below
      // (this system satisfies neither `rollSkill` nor `system.abilities`).
      const ftRolls = game.fourththing?.rolls;
      if (ftRolls?.skillCheck) {
        const ftSys = actor.system?.system ?? actor.system;
        const ftKey = _ftSkillKeyFor(stat);
        if (ftSys?.skills && ftKey && ftSys.skills[ftKey]) {
          const r = await ftRolls.skillCheck(actor, { skill: ftKey });
          const total = _num(r?.total, 0) + supportBonus;
          return { kind:"actor", subkind:"ft-skill", stat, skill:ftKey, dc, actorName:actor.name, total, ok: total>=dc, roll:r?.roll ?? null, support:{ opKey:supportKey, spend:supportSpend, bonus:supportBonus } };
        }
        if (ftSys?.attributes && ftKey && ftSys.attributes[ftKey]) {
          const av = _num(ftSys.attributes[ftKey]?.value, 0);
          const r = await _evalRoll(new Roll("2d10x10 + @a", { a: av }));
          const total = (r.total ?? 0) + supportBonus;
          return { kind:"actor", subkind:"ft-faculty", stat, faculty:ftKey, dc, actorName:actor.name, total, ok: total>=dc, roll:r, support:{ opKey:supportKey, spend:supportSpend, bonus:supportBonus } };
        }
      }

      // Saving throw support: checkStat "save.str" / "save.dex" / etc.
      if (stat.indexOf("save.") === 0) {
        const abil = String(stat.slice(5) || "").trim().toLowerCase();
        if (typeof actor.rollAbilitySave === "function") {
          const r = await actor.rollAbilitySave(abil, { chatMessage:false });
          return { kind:"actor", subkind:"save", stat, dc, actorName:actor.name, total:(r.total + supportBonus), ok:(r.total + supportBonus)>=dc, roll:r, support:{ opKey:supportKey, spend:supportSpend, bonus:supportBonus } };
        }
        if (typeof actor.rollAbilityTest === "function") {
          const r = await actor.rollAbilityTest(abil, { chatMessage:false });
          return { kind:"actor", subkind:"save_fallback", stat, dc, actorName:actor.name, total:(r.total + supportBonus), ok:(r.total + supportBonus)>=dc, roll:r, support:{ opKey:supportKey, spend:supportSpend, bonus:supportBonus } };
        }
      }

      if (actor.system?.skills?.[stat]) {
        const r = await actor.rollSkill(stat, { chatMessage:false });
        return { kind:"actor", stat, dc, actorName:actor.name, total:(r.total + supportBonus), ok:(r.total + supportBonus)>=dc, roll:r, support:{ opKey:supportKey, spend:supportSpend, bonus:supportBonus } };
      }
      if (actor.system?.abilities?.[stat]) {
        const r = await actor.rollAbilityTest(stat, { chatMessage:false });
        return { kind:"actor", stat, dc, actorName:actor.name, total:(r.total + supportBonus), ok:(r.total + supportBonus)>=dc, roll:r, support:{ opKey:supportKey, spend:supportSpend, bonus:supportBonus } };
      }
    } catch {}
  }

  const roll = await _evalRoll(new Roll("1d20"));
  return { kind:"basic", stat, dc, total:roll.total, ok:roll.total>=dc, roll };
}

async function _runBeatDialog(campaign, beat, ctx={}) {
  try { if (ctx && ctx.allowDesperation == null) ctx.allowDesperation = true; } catch (_eAD) {}

  // Dialogue-driven enactment (mal-voice contract): a choice already committed
  // through NPC conversation arrived via ctx.__enactChoice — resolve it through
  // the same semantics as a dialog pick, with NO dialog UI and NO player-facing
  // broadcast (the conversation itself was the surface). executeBeat still
  // applies the host beat's worldEffects/questEffects and fires beat:resolved
  // with this result as the outcome, exactly like a menu pick.
  if (ctx && ctx.__enactChoice != null) {
    const r = await _enactChoiceCore(campaign, beat, Number(ctx.__enactChoice), ctx);
    try { ctx.__enactResult = r; } catch (_eER) {}
    return r;
  }

  const title = `${beat.label || beat.id || "Beat"}`;
  const desc = String(beat.description || "").trim();
  const choices = Array.isArray(beat.choices) ? beat.choices : [];
  const isPlayerFacing = !!(beat && (beat.playerFacing || beat.playerFacingDialog || beat.dialogPlayerFacing || beat.playerFacingContent || beat.showToPlayers));

  if (isPlayerFacing) {
    try {
      _broadcastPlayerFacingDialog("show", {
        title: title,
        desc: desc,
        choices: choices.map(function (ch, i) {
          return {
            label: ch && ch.label ? ch.label : ('Choice ' + (i + 1)),
            description: String(ch && ch.description ? ch.description : '').trim(),
            checkLabel: _choiceHasCheck(ch) ? _choiceCheckLabel(ch.checkStat) : '',
            checkDC: _choiceHasCheck(ch) ? _num(ch.checkDC, 0) : 0
          };
        })
      });
    } catch (_ePF) {}
  }

  // If no prompt text and no choices, nothing to show
  if (!desc && !choices.length) return { acted: false };

  const factionId =
    ctx.factionId || beat.factionId || campaign.factionId || null;

  let roster = [];
  if (factionId) {
    try {
      const fac = await _resolveFaction(factionId);
      const actors = await _getFactionRoster(fac);
      roster = actors.map(a => ({ id: a.id, name: a.name }));
    } catch (_eR) {}
  }

  const rosterHtml = roster.length ? `
    <div class="bbttcc-field" style="margin:8px 0;">
      <label><b>Roster Member (for individual checks)</b></label>
      <select name="bbttccRosterActor" data-id="rosterActorId" style="width:100%;">
        ${roster.map(r=>`<option value="${_escapeHtml(r.id)}" ${ctx && ctx.rosterActorId && String(ctx.rosterActorId)===String(r.id) ? "selected" : ""}>${_escapeHtml(r.name)}</option>`).join("")}
      </select>
      <div style="opacity:.75;font-size:12px;">Ignored for OP checks</div>
    </div>
  ` : "";

  // OP bank chips (faction visibility)
  let faction = null;
  let opBankAll = {};
  let opRollBonusAll = {};
  let opChipsHtml = "";
  let opRollBonusHtml = "";
  if (factionId) {
    try {
      faction = await _resolveFaction(factionId);
      if (faction) {
        opBankAll = _readOpBankAll(faction);
        opRollBonusAll = await _computeFactionOpRollBonusMap(faction);
        opChipsHtml = _buildOpChipsHtml(opBankAll, null);
        opRollBonusHtml = _buildOpRollBonusChipsHtml(opRollBonusAll, null);
      }
    } catch (_eB) {}
  }


  const bodyHtml = `
    <div class="bbttcc-campaign-dialog">

${
  (beat && beat.audio && beat.audio.enabled && (String(beat.audio.src || "").trim() || String(beat.audio.playlistSoundUuid || "").trim()))
    ? `<div class="bbttcc-beat-audio-controls" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin:0 0 10px 0;">
         <button type="button" class="bbttcc-button bbttcc-beat-audio-play" data-src="${_escapeHtml(String(beat.audio.src || "").trim())}" data-playlist-sound-uuid="${_escapeHtml(String(beat.audio.playlistSoundUuid || "").trim())}">
           <i class="fas fa-volume-up"></i> Play Narration
         </button>
         <button type="button" class="bbttcc-button bbttcc-beat-audio-stop">
           <i class="fas fa-stop"></i> Stop
         </button>
         <span class="bbttcc-muted" style="opacity:.7; font-size:12px;">(local)</span>
       </div>`
    : ""
}
      ${desc ? `<div class="bbttcc-campaign-dialog-desc">${_escapeHtml(desc).replaceAll("\n", "<br/>")}</div>` : ""}
      ${rosterHtml}
      ${opChipsHtml ? `<div class="bbttcc-muted" style="margin-top:6px;">Faction OP Pools</div>${opChipsHtml}` : ""}
      ${opRollBonusHtml ? `<div class="bbttcc-muted" style="margin-top:6px;">Faction Roll Bonuses</div>${opRollBonusHtml}` : ""}
      ${
        choices.length
          ? `<div class="bbttcc-campaign-dialog-choices">
               ${choices.map((ch, i) => {
                 const label = _escapeHtml(ch.label || `Choice ${i + 1}`);
                 const cdesc = String(ch.description || "").trim();
                 const meta = _choiceHasCheck(ch)
                   ? (() => {
                       const statRaw = String((ch && ch.checkStat) || "").trim().toLowerCase();
                       const statLabel = _choiceCheckLabel(statRaw);
                       const isOp = statRaw.indexOf("op.") === 0;
                       const opKey = isOp ? String(statRaw.split(".")[1] || "").trim().toLowerCase() : "";
                       const dc = _num((ch && ch.checkDC) != null ? ch.checkDC : 0, 0);
                 
                       const line =
                         '<div class="bbttcc-choice-checkmeta" style="margin-top:8px;">' +
                           '<div class="bbttcc-choice-checkmeta__row" style="display:flex; gap:8px; align-items:center; margin-bottom:4px;">' +
                             '<span class="bbttcc-choice-checkmeta__label" style="min-width:78px; opacity:.72; font-size:12px; text-transform:uppercase; letter-spacing:.08em;">Check</span>' +
                             '<span class="bbttcc-choice-checkmeta__value" style="font-weight:700;">' + _escapeHtml(statLabel) + '</span>' +
                           '</div>' +
                           '<div class="bbttcc-choice-checkmeta__row" style="display:flex; gap:8px; align-items:center;">' +
                             '<span class="bbttcc-choice-checkmeta__label" style="min-width:78px; opacity:.72; font-size:12px; text-transform:uppercase; letter-spacing:.08em;">Difficulty</span>' +
                             '<span class="bbttcc-choice-checkmeta__value" style="font-weight:700;">' + dc + '</span>' +
                           '</div>' +
                         '</div>';

                       const chips = (isOp && opChipsHtml) ? _buildOpChipsHtml(opBankAll, opKey) : "";
                       const rollChips = (isOp && opRollBonusHtml) ? _buildOpRollBonusChipsHtml(opRollBonusAll, opKey) : "";
                       const pool = (isOp && opKey) ? _num(opBankAll[opKey], 0) : 0;
                       let sac = "";
                       if (isOp && opKey && pool <= 0 && ctx && ctx.rosterActorId) {
                         sac = '<div style="margin-top:6px;">' +
                                 '<button type="button" class="bbttcc-sacrifice-btn" data-op="' + _escapeHtml(opKey) + '" data-hp="5" title="Convert 5 HP into +1 ' + _escapeHtml(_opKeyLabel(opKey)) + ' OP for the faction.">' +
                                   ' Bleed (5 HP) ? +1 ' + _escapeHtml(_opKeyLabel(opKey)) + ' OP' +
                                 '</button>' +
                               '</div>';
                       }
                       return line + (chips ? chips : "") + (rollChips ? rollChips : "") + sac;
                     })()
                   : "";
                 return `
                   <div style="padding:8px 10px; border:1px solid rgba(255,255,255,0.10); border-radius:10px; margin:8px 0;">
                     <div style="font-weight:700;">${label}</div>
                     ${cdesc ? '<div style="opacity:0.85; margin-top:6px;">' + _escapeHtml(cdesc).replace(/\n/g, "<br/>") + '</div>' : ""}
                     ${meta}
                   </div>
                 `;
               }).join("")}
             </div>`
          : ""
      }
    </div>
  `;

  // Expose this beat to the document-level Play delegation so clicks on the
  // "Play Narration" button can resolve to the right beat even if the
  // per-dialog jQuery delegation attached before the DOM was ready.
  __bbttccCurrentBeatDialogBeat = beat;
  _installBeatDialogPlayDelegation();

  return await new Promise(resolve => {
    let done = false;
    const finish = (payload) => {
      if (done) return;
      done = true;
      try {
        if (isPlayerFacing) _broadcastPlayerFacingDialog("close", {});
      } catch (_ePFClose) {}
      try {
        const a = beat && beat.audio ? beat.audio : null;
        if (a && a.enabled) {
          // Broadcast stop (push:true) fans out to players via module socket;
          // local GM stop is a no-op if nothing is playing.
          try { _stopBeatAudio({ push: !!a.broadcastPlayers, caller: "dialog-close" }); } catch (_eStopL) {}
        }
      } catch (_eStopAny) {}
      // Clear the beat ref only if this is still the currently-shown beat.
      // (A subsequent dialog may have opened on top.)
      if (__bbttccCurrentBeatDialogBeat === beat) __bbttccCurrentBeatDialogBeat = null;
      resolve(payload);
    };

    const buttons = {};

    // Build one button per choice
    if (choices.length) {
      for (let i = 0; i < choices.length; i++) {
        const ch = choices[i];
        const label = ch.label || `Choice ${i + 1}`;

        buttons[`c${i}`] = {
          label,
          callback: async (html) => {
            try {
              const sel = html && html[0] ? html[0].querySelector('select[name="bbttccRosterActor"]') : null;
              const rosterActorId = sel ? (sel.value || null) : null;

              // Support/backing (Faction OP spend -> +2 per OP bonus)  -  optional
              // NOTE: Support UI may be absent; fall back to ctx/choice fields.
              var supportOpKey = String(
                (ch && (ch.supportOpKey || (ch.support && ch.support.opKey))) ||
                (ctx && (ctx.supportOpKey || (ctx.support && ctx.support.opKey))) ||
                ""
              ).trim().toLowerCase();
              var supportSpend = _num(
                (ch && (ch.supportSpend != null ? ch.supportSpend : (ch.support && ch.support.spend))) != null
                  ? (ch.supportSpend != null ? ch.supportSpend : (ch.support && ch.support.spend))
                  : (ctx && (ctx.supportSpend != null ? ctx.supportSpend : (ctx.support && ctx.support.spend))),
                0
              );


              // If choice has a check, resolve now
              if (_choiceHasCheck(ch)) {

                // GM adjudication mode (no automation)
                if (_isGMAdjudicatedChoice(ch)) {
                  const dcTxt = (ch.checkDC != null && String(ch.checkDC).trim() !== "") ? String(_num(ch.checkDC != null ? ch.checkDC : 0, 0)) : "";
                  const statTxt = String((ch && ch.checkStat) || "").trim() || "gm";
                  const prompt = String((ch && (ch.checkPrompt || ch.prompt)) || "").trim();

                  const prettyStat = _choiceCheckLabel(statTxt);
                  const metaLine = (prettyStat || dcTxt)
                    ? '<div style="opacity:0.9;font-size:12px;margin-top:6px;">' +
                        (prettyStat ? '<b>Check:</b> ' + _escapeHtml(prettyStat) : '') +
                        (dcTxt ? ((prettyStat ? '  -  ' : '') + '<b>Difficulty:</b> ' + _escapeHtml(dcTxt)) : '') +
                      '</div>'
                    : "";

                  const promptLine = prompt
                    ? '<div style="opacity:0.92; margin-top:6px;">' + _escapeHtml(prompt).replace(/\n/g, "<br/>") + '</div>'
                    : '';

                  const ok = await _gmAdjudicate(label, '<div style="font-weight:700;">' + _escapeHtml(label) + '</div>' + promptLine + metaLine);

                  const nextId = ok ? (ch.next || "") : (ch.failNext || beat.outcomes?.failure || "");
                  if (nextId) await runBeat(campaign.id, nextId);

                  finish({
                    acted: true,
                    routed: !!nextId,
                    choiceIndex: i,
                    choice: ch,
                    check: { stat: statTxt, dc: _num(ch.checkDC, 0), ok: !!ok, kind: "gm" }
                  });
                  return;
                }


                // Default behavior for non-OP checks: GM adjudication (player resolves rolls via MidiQOL/manual/etc).
                // To force auto-rolling, author choice.checkMode = "auto".
                const mode = String(ch.checkMode || "").trim().toLowerCase();
                const statTxt0 = String(ch.checkStat || "").trim().toLowerCase();
                const isOp = statTxt0.indexOf("op.") === 0;

                if (!isOp && mode !== "auto") {
                  const dcTxt = (ch.checkDC != null && String(ch.checkDC).trim() !== "") ? String(_num(ch.checkDC != null ? ch.checkDC : 0, 0)) : "";
                  const statTxt = String((ch && ch.checkStat) || "").trim() || "check";
                  const prompt = String((ch && (ch.checkPrompt || ch.prompt)) || "").trim();

                  const prettyStat = _choiceCheckLabel(statTxt);
                  const metaLine = (prettyStat || dcTxt)
                    ? '<div style="opacity:0.9;font-size:12px;margin-top:6px;">' +
                        (prettyStat ? '<b>Check:</b> ' + _escapeHtml(prettyStat) : '') +
                        (dcTxt ? ((prettyStat ? '  -  ' : '') + '<b>Difficulty:</b> ' + _escapeHtml(dcTxt)) : '') +
                      '</div>'
                    : "";

                  const promptLine = prompt
                    ? '<div style="opacity:0.92; margin-top:6px;">' + _escapeHtml(prompt).replace(/\n/g, "<br/>") + '</div>'
                    : '';

                  const ok = await _gmAdjudicate(label, '<div style="font-weight:700;">' + _escapeHtml(label) + '</div>' + promptLine + metaLine);

                  const nextId = ok ? (ch.next || "") : (ch.failNext || beat.outcomes?.failure || "");
                  if (nextId) await runBeat(campaign.id, nextId);

                  finish({
                    acted: true,
                    routed: !!nextId,
                    choiceIndex: i,
                    choice: ch,
                    check: { stat: statTxt, dc: _num(ch.checkDC, 0), ok: !!ok, kind: "gm" }
                  });
                  return;
                }

// Auto-resolved roll (OP / actor if roster selected)
                
                // OP gating (requires 1 OP to attempt)
                if (isOp) {
                  try {
                    const allowDesperation = !!(ctx && ctx.allowDesperation);
                    const opKey = String(statTxt0.split(".")[1] || "").trim().toLowerCase();
                    if (faction && opKey) {
                      const gate = _evalOpGateForKey(faction, opKey, allowDesperation);
                      if (!gate.ok) {
                        try { ui.notifications?.warn?.("This action requires 1 " + _opKeyLabel(opKey) + " OP."); } catch (_eN) {}
                        return false; // keep dialog open
                      }
                      if (gate.mode === "desperation") {
                        const ok = await _confirmDesperation(opKey);
                        if (!ok) return false; // keep dialog open
                      }
                      // Spend 1 OP on attempt (optional; safe if op.commit exists)
                      await _spendOneOpForAttempt(faction, opKey, "Campaign OP check: " + (beat.label || beat.id || ""));
                    }
                  } catch (_eG) {}
                }

// Spend faction OP backing (if any) before rolling
                if (supportOpKey && supportSpend > 0) {
                  const pool2 = _readOpBank(faction, supportOpKey);
                  if (pool2 < supportSpend) {
                    ui.notifications?.warn?.("Not enough " + _opKeyLabel(supportOpKey) + " OP for backing.");
                    return false;
                  }
                  const okSpend2 = await _spendFactionOpSupport(faction, supportOpKey, supportSpend, "Faction backing: " + (beat.label || beat.id || ""));
                  if (!okSpend2) {
                    ui.notifications?.warn?.("Could not spend faction OP for backing (see console).");
                    return false;
                  }
                }

                const res = await _rollChoiceCheck(ch, { factionId, rosterActorId, supportOpKey, supportSpend });

                if (res.kind === "op") {
                  ui.notifications?.info?.(
                    `${label}: ${res.total} (1d20 + ${res.bonus}) vs DC ${res.dc}  ->  ${res.ok ? "SUCCESS" : "FAIL"}`
                  );
                } else {
                  ui.notifications?.info?.(
                    `${label}: ${res.total} vs DC ${res.dc}  ->  ${res.ok ? "SUCCESS" : "FAIL"}`
                  );
                }

                const nextId = res.ok
                  ? (ch.next || "")
                  : (ch.failNext || beat.outcomes?.failure || "");

                if (nextId) await runBeat(campaign.id, nextId);

                finish({
                  acted: true,
                  routed: !!nextId,
                  choiceIndex: i,
                  choice: ch,
                  check: { stat: res.stat, dc: res.dc, total: res.total, ok: res.ok, kind: res.kind, bonus: (res.bonus != null ? res.bonus : null) }
                });
                return;
              }

// No check: route to next
              const nextId = ch.next || "";
              if (nextId) await runBeat(campaign.id, nextId);

              finish({
                acted: true,
                routed: !!nextId,
                choiceIndex: i,
                choice: ch,
                check: null
              });
            } catch (e) {
              warn("Choice handling failed:", e);
              ui.notifications?.error?.("Error running choice; see console.");
              finish({ acted: true, routed: false, error: true, choiceIndex: i, choice: ch, check: null });
            }
          }
        };
      }
    } else {
      // No choices: just an OK button
      buttons.ok = {
        label: "OK",
        callback: () => finish({ acted: true, routed: false, choiceIndex: null, choice: null, check: null })
      };
    }

    const dlg = new Dialog({
      title,
      content: bodyHtml,
      buttons,
      default: Object.keys(buttons)[0] || "ok",
      close: () => finish({ acted: false, closed: true })
    });

    dlg.render(true);
    try { __bbttccAutosizeDialogDeferred(dlg, { pad: 40, maxH: Math.floor(window.innerHeight * 0.94) }); } catch (_eAuto) {}

    // HexChrome styling hook (works for V1 Dialog)
    setTimeout(() => {
      try { dlg.element?.addClass("bbttcc-choice-roll-dialog bbttcc-hexchrome-dialog"); } catch (_eC) {}
    }, 0);


// Beat audio controls (if present in this dialog)
try {
  // Warm the sound cache the moment the beat dialog renders. Even if the
  // user never opened the beat editor in this session, the manager will
  // have the file decoded by the time they click Play — killing the
  // cold-cache first-play ghost (AH.play resolves with a logically-playing
  // Sound that produced no audio because the context wasn't ready).
  try {
    if (beat?.audio?.enabled && beat.audio?.src) {
      const _audioApi = game?.bbttcc?.api?.campaign?.audio;
      if (_audioApi && typeof _audioApi.preload === "function") _audioApi.preload(beat.audio.src);
    }
  } catch (_ePreload) {}

  setTimeout(() => {
    try {
      const $el = dlg.element;
      if (!$el || typeof $el.on !== "function") return;
      // jQuery event delegation: bind to the dialog root and match on
      // selector. Resilient to Dialog re-renders that replace the button DOM
      // (which silently kills direct addEventListener bindings) and also to
      // the button not yet being in the DOM when this setTimeout fires.
      // `.bbttccAudio` namespace lets us clean-slate on re-entry.
      try { $el.off("click.bbttccAudio"); } catch (_eOff) {}
      $el.on("click.bbttccAudio", ".bbttcc-beat-audio-play", async function (ev) {
        ev.preventDefault();
        _audioDebug("dialog:play-click", { beatId: beat?.id || null });
        // Click == user gesture, so AudioContext is armed. push=true inside
        // _playBeatAudio handles player broadcast via Foundry's native socket.
        try { await _playBeatAudio(beat, { caller: "dialog-play" }); } catch (_eP) {}
      });
      $el.on("click.bbttccAudio", ".bbttcc-beat-audio-stop", async function (ev) {
        ev.preventDefault();
        _audioDebug("dialog:stop-click", { beatId: beat?.id || null });
        try { await _stopBeatAudio({ push: true, caller: "dialog-stop" }); } catch (_eS) {}
      });
    } catch (_e) {}
  }, 0);
} catch (_e2) {}
  });
}


// Quest Acceptance (Option A): quest is tracked only after GM accepts on the start beat.

async function _resolveActorRef(ref) {
  try {
    if (!ref) return null;
    // If already an Actor document
    if (ref && ref.documentName === "Actor") return ref;
    const s = String(ref);

    // Raw ID
    if (game && game.actors && typeof game.actors.get === "function") {
      const direct = game.actors.get(s);
      if (direct) return direct;
    }

    // "Actor.<id>" form
    if (s.indexOf("Actor.") === 0) {
      const id = s.slice("Actor.".length);
      if (game && game.actors && typeof game.actors.get === "function") {
        const byId = game.actors.get(id);
        if (byId) return byId;
      }
    }

    // UUID via fromUuid
    try {
      if (typeof fromUuid === "function") {
        const doc = await fromUuid(s);
        if (doc && doc.documentName === "Actor") return doc;
      }
    } catch (_e) {}

    return null;
  } catch (_e2) {
    return null;
  }
}

// Resolve a campaign's participating factions (the "coalition") to Actor docs.
// Source = `campaign.factionIds` (the roster authored in the Campaign Builder;
// UUIDs, primary forced to index 0), with the primary `campaign.factionId` folded
// in and de-duped by actor.id. Falls back to `ctx.factionId` ONLY when no roster
// exists (backward-compatible). factionIds holds UUIDs → resolve to Actor docs
// before keying on actor.id. This is the coalition quest-progress fans out across.
async function _resolveCampaignFactions(campaign, ctx) {
  const refs = [];
  if (campaign && Array.isArray(campaign.factionIds) && campaign.factionIds.length) refs.push(...campaign.factionIds);
  if (campaign && campaign.factionId) refs.push(campaign.factionId);
  if (!refs.length && ctx && ctx.factionId) refs.push(ctx.factionId);   // fallback: no roster
  const out = [];
  const seen = new Set();
  for (const ref of refs) {
    if (!ref) continue;
    const actor = await _resolveActorRef(ref);
    if (!actor || !actor.id || seen.has(actor.id)) continue;
    seen.add(actor.id);
    out.push(actor);
  }
  return out;
}

async function _maybePromptQuestAcceptance(campaign, beat, ctx) {
  try {
    const questId = beat && (beat.questId || beat.questID || beat.quest);
    const role = String(beat && beat.questRole || "").trim();
    if (!questId || role !== "start") return;

    // Resolve the coalition (campaign.factionIds); dedup + prompt off the primary.
    const factions = await _resolveCampaignFactions(campaign, ctx);
    if (!factions.length) {
      if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("Quest acceptance: No faction configured for this campaign.");
      return;
    }
    const MOD = "bbttcc-factions";
    const faction = factions[0];                 // primary — drives the single prompt + dedup
    const cur = (faction.getFlag ? (faction.getFlag(MOD, "quests") || {}) : {});
    const active = (cur && cur.active) ? cur.active : {};
    const completed = (cur && cur.completed) ? cur.completed : {};
    if (active[questId] || completed[questId]) return;   // coalition already has it

    // Resolve quest name (best effort)
    let questName = questId;
    try {
      const reg = (game.settings && game.settings.get) ? (game.settings.get("bbttcc-campaign", "quests") || {}) : {};
      const q = reg[questId];
      if (q && q.name) questName = q.name;
    } catch (e) {}

    const title = "Accept Quest?";
    const memberNote = factions.length > 1 ? (" + " + (factions.length - 1) + " allied faction(s)") : "";
    const content =
      "<p><b>" + questName + "</b></p>" +
      "<p>Add this quest to <b>" + faction.name + "</b>" + memberNote + "'s Quest Log?</p>";

    let accepted = false;
    try {
      if (Dialog && typeof Dialog.confirm === "function") {
        accepted = await Dialog.confirm({
          title: title,
          content: content,
          yes: function(){ return true; },
          no: function(){ return false; },
          defaultYes: true
        });
      } else {
        accepted = true;
      }
    } catch (e2) {
      // If dialog was closed without choice, treat as "not yet"
      accepted = false;
    }

    if (!accepted) return;

    // Write tracking — fan out the identical accept entry to every coalition member
    // (reconcile-on-write: each member's own quests flag, only this questId added).
    const acceptTs = Date.now();
    for (const member of factions) {
      const mcur = (member.getFlag ? (member.getFlag(MOD, "quests") || {}) : {}) || {};
      let mnext;
      try {
        mnext = foundry.utils && foundry.utils.deepClone ? foundry.utils.deepClone(mcur) : JSON.parse(JSON.stringify(mcur || {}));
      } catch (e3) { mnext = {}; }
      mnext.schemaVersion = mnext.schemaVersion || 1;
      mnext.active = mnext.active || {};
      mnext.completed = mnext.completed || {};
      mnext.archived = mnext.archived || {};
      if (mnext.active[questId] || mnext.completed[questId]) continue;   // this member already has it
      mnext.active[questId] = {
        v: 1,
        questId: questId,
        status: "active",
        acceptedTs: acceptTs,
        lastTouchedTs: acceptTs,
        notes: "",
        progress: { beats: {} },
        history: [{ ts: acceptTs, type: "accept", by: (game.user ? game.user.id : null) }]
      };
      if (member.setFlag) await member.setFlag(MOD, "quests", mnext);
      // Refresh, never OPEN: force-rendering here popped every coalition
      // faction's sheet on quest accept (owner hit this 2026-07-03).
      try { if (member.sheet?.rendered) member.sheet.render(false); } catch (e6) {}
    }

    // Notify (toast + GM whisper)
    try { if (ui && ui.notifications && ui.notifications.info) ui.notifications.info("Quest accepted: " + questName); } catch (e4) {}
    try {
      const gmIds = (game.users || []).filter(function(u){ return u && u.isGM; }).map(function(u){ return u.id; });
      if (ChatMessage && ChatMessage.create) {
        const who = factions.length > 1 ? ("the coalition (" + factions.length + " factions)") : ("<b>" + faction.name + "</b>");
        ChatMessage.create({ whisper: gmIds, content: "<p><b>Bad Eden Quest:</b> accepted <i>" + questName + "</i> for " + who + ".</p>" });
      }
    } catch (e5) {}
  } catch (e) {
    console.warn("[bbttcc-campaign] Quest acceptance failed", e);
  }
}

async function _applyQuestEffects(campaign, beat, ctx) {
  try {
    const we = beat && beat.worldEffects ? beat.worldEffects : null;
    const rows = Array.isArray(we && we.questEffects) ? we.questEffects : [];
    if (!rows.length) return { applied: false, count: 0 };

    const factions = await _resolveCampaignFactions(campaign, ctx);
    if (!factions.length) {
      ui.notifications?.warn?.("Quest effects: No faction configured for this campaign.");
      return { applied: false, count: 0 };
    }

    const MOD = "bbttcc-factions";
    let anyFaction = false;
    let totalApplied = 0;

    // Fan out to the whole coalition (campaign.factionIds): reconcile-on-write — each
    // member's own quests flag is read, cloned, and mutated for just this questId, so
    // shared story progress lands identically on every participating faction.
    for (const faction of factions) {
    const cur = (faction.getFlag ? (faction.getFlag(MOD, "quests") || {}) : {}) || {};
    let next;
    try {
      next = foundry.utils?.deepClone
        ? foundry.utils.deepClone(cur)
        : JSON.parse(JSON.stringify(cur || {}));
    } catch (_eClone) {
      next = {};
    }

    next.schemaVersion = next.schemaVersion || 1;
    next.active = next.active || {};
    next.completed = next.completed || {};
    next.archived = next.archived || {};

    const reg = game.bbttcc?.api?.campaign?.quests || null;

    function nowTs() {
      return Date.now();
    }

    function ensureEntry(bucketName, questId) {
      const bucket = next[bucketName] || {};
      let entry = bucket[questId];
      if (!entry) {
        const q = reg?.getQuest ? reg.getQuest(questId) : null;
        entry = {
          v: 1,
          questId: questId,
          questName: String(q?.name || questId),
          status: bucketName,
          acceptedTs: nowTs(),
          lastTouchedTs: nowTs(),
          state: "",
          notes: "",
          progress: { beats: {} },
          history: []
        };
        bucket[questId] = entry;
        next[bucketName] = bucket;
      }
      entry.progress = entry.progress || { beats: {} };
      entry.history = Array.isArray(entry.history) ? entry.history : [];
      return entry;
    }

    function getBucketNameForQuest(questId) {
      if (next.active[questId]) return "active";
      if (next.completed[questId]) return "completed";
      if (next.archived[questId]) return "archived";
      return null;
    }

    function removeFromAllBuckets(questId) {
      delete next.active[questId];
      delete next.completed[questId];
      delete next.archived[questId];
    }

    function moveQuest(questId, destBucket) {
      const srcBucket = getBucketNameForQuest(questId);
      const srcEntry =
        (srcBucket === "active" ? next.active[questId] :
        srcBucket === "completed" ? next.completed[questId] :
        srcBucket === "archived" ? next.archived[questId] : null);

      const entry = srcEntry || ensureEntry(destBucket, questId);
      removeFromAllBuckets(questId);
      entry.status = destBucket;
      entry.lastTouchedTs = nowTs();
      next[destBucket][questId] = entry;
      return entry;
    }

    let applied = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const action = String(row.action || "accept").trim().toLowerCase();
      const questId = String(row.questId || "").trim();
      const beatId = String(row.beatId || beat?.id || "").trim();
      const state = String(row.state || "").trim();
      const text = String(row.text || "").trim();

      if (!questId) continue;

      let entry = null;

      if (action === "accept") {
        if (!getBucketNameForQuest(questId)) {
          entry = ensureEntry("active", questId);
          entry.status = "active";
          entry.acceptedTs = entry.acceptedTs || nowTs();
        } else {
          entry = moveQuest(questId, "active");
        }
      }
      else if (action === "complete" || action === "completed") {
        entry = moveQuest(questId, "completed");
      }
      else if (action === "archive" || action === "archived") {
        entry = moveQuest(questId, "archived");
      }
      else if (action === "activate" || action === "reopen") {
        entry = moveQuest(questId, "active");
      }
      else {
        const bucketName = getBucketNameForQuest(questId) || "active";
        entry = ensureEntry(bucketName, questId);
      }

      if (!entry) continue;

      if (state) entry.state = state;
      if (text) entry.notes = text;
      if (beatId) {
        entry.progress = entry.progress || { beats: {} };
        entry.progress.beats[beatId] = {
          ts: nowTs(),
          state: state || "",
          text: text || ""
        };
      }

      entry.lastTouchedTs = nowTs();
      entry.history = Array.isArray(entry.history) ? entry.history : [];
      entry.history.push({
        ts: nowTs(),
        type: action,
        beatId: beat?.id || null,
        effectBeatId: beatId || null,
        state: state || "",
        text: text || "",
        by: game.user ? game.user.id : null
      });

      applied++;
    }

    if (!applied) continue;                      // nothing to write for this member
    anyFaction = true;
    totalApplied = applied;                      // identical across members

    if (faction.setFlag) {
      // setFlag MERGES objects: keys deleted from `next` (bucket transitions
      // via moveQuest/removeFromAllBuckets) silently SURVIVE in the database.
      // Live-caught 2026-07-03: completing the stabilizer quest left it in
      // BOTH active and completed, so "is active" gates never closed and the
      // sealed Leygate deal stayed offerable. Explicitly delete removed keys
      // first, then merge the new state.
      try {
        const del = {};
        for (const bucket of ["active", "completed", "archived"]) {
          for (const qid of Object.keys((cur && cur[bucket]) || {})) {
            if (!next[bucket] || !next[bucket][qid]) del[`flags.${MOD}.quests.${bucket}.-=${qid}`] = null;
          }
        }
        if (Object.keys(del).length) await faction.update(del, { render: false });
      } catch (eDel) { console.warn("[bbttcc-campaign] quest bucket deletion sync failed", eDel); }
      await faction.setFlag(MOD, "quests", next);
    }
    try {
      // Refresh, never OPEN (same popping-sheets fix as the accept path).
      if (faction.sheet?.rendered) faction.sheet.render(false);
    } catch (_eSheet) {}
    }                                            // end coalition fan-out loop

    if (!anyFaction) return { applied: false, count: 0 };
    try {
      ui.notifications?.info?.("Quest effects applied.");
    } catch (_eToast) {}
    return { applied: true, count: totalApplied, factions: factions.length };
  } catch (e) {
    console.warn("[bbttcc-campaign] Quest effects failed", e);
    return { applied: false, count: 0, error: e };
  }
}

const AAE_MOD_ID = "bbttcc-aae";

function _polTagList(raw) {
  if (Array.isArray(raw)) return raw.map(s => String(s || "").trim()).filter(Boolean);
  return String(raw || "").split(/\s+/g).map(s => s.trim()).filter(Boolean);
}
function _uniqTags(arr) {
  const out = [];
  const seen = new Set();
  for (const t of (arr || [])) {
    const k = String(t || "").trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}
function _choicePoliticalTags(choice) {
  if (!choice) return [];
  const raw =
    choice?.political?.tags ??
    choice?.politicalTags ??
    choice?.politics?.tags ??
    choice?.tags ??
    "";
  return _polTagList(raw);
}
function _prettySeverity(sev) {
  switch (String(sev || "")) {
    case "affirmation_minor":   return "Minor affirmation";
    case "neutral":             return "Neutral";
    case "dissonance_minor":    return "Minor dissonance";
    case "dissonance_major":    return "Major dissonance";
    case "dissonance_critical": return "Critical dissonance";
    default:                    return String(sev || "Unknown");
  }
}
function _consequenceRowForSeverity(sev) {
  switch (String(sev || "")) {
    case "affirmation_minor":   return { unityDelta: +1, darknessDelta: 0, loyaltyDelta: 0, moraleDelta: 0 };
    case "dissonance_minor":    return { unityDelta: -1, darknessDelta: +1, loyaltyDelta: 0, moraleDelta: 0 };
    case "dissonance_major":    return { unityDelta: -2, darknessDelta: +2, loyaltyDelta: 0, moraleDelta: 0 };
    case "dissonance_critical": return { unityDelta: -4, darknessDelta: +4, loyaltyDelta: -1, moraleDelta: 0 };
    default:                    return null; // neutral or unknown => no auto consequence
  }
}
async function _resolveFactionActorByIdOrUuid(idOrUuid) {
  const v = String(idOrUuid || "").trim();
  if (!v) return null;
  if (v.includes(".")) {
    try { return await fromUuid(v); } catch { return null; }
  }
  return game.actors?.get?.(v) || null;
}
async function _appendAAEDecisionHistory(factionId, record, cap = 50) {
  try {
    const actor = await _resolveFactionActorByIdOrUuid(factionId);
    if (!actor?.getFlag || !actor?.setFlag) return false;

    const cur = actor.getFlag(AAE_MOD_ID, "decisionHistory");
    const arr = Array.isArray(cur) ? cur.slice(0) : [];
    arr.push(record);
    while (arr.length > cap) arr.shift();

    await actor.setFlag(AAE_MOD_ID, "decisionHistory", arr);
    return true;
  } catch (e) {
    warn("AAE decisionHistory write failed:", e);
    return false;
  }
}


// ---------------------------------------------------------------------------
// Runtime execution
// ---------------------------------------------------------------------------

async function executeBeat(campaign, beat, ctx = {}) {
  if (!beat) return;

  await logBeatToGottgait(campaign, beat);

  const type  = beat.type || "unknown";
  const label = beat.label || beat.id || "(unnamed)";

  const resolution = game.bbttcc?.api?.resolution;
  const territory  = game.bbttcc?.api?.territory;
  const encounters = game.bbttcc?.api?.encounters;

  log("Executing beat", { campaignId: campaign.id, beatId: beat.id, type });

  // Record the firing in the director's history AT ENTRY (2026-08-24) — it
  // lived at the tail, so a beat that parks awaiting its dialog/completion
  // (Teaching Slide 10's endless "run it again?" loop) never registered and
  // the Visualizer's hero re-offered it forever. A beat that STARTED counts
  // as fired for the driving layer. GM-side only (world-state write).
  try {
    if (game.user?.isGM && beat?.id) {
      await _mutateDirectorState(async (st) => {
        st.firedStoryBeats = st.firedStoryBeats || {};
        if (!st.firedStoryBeats[beat.id]) {
          st.firedStoryBeats[beat.id] = { turn: Number(campaign?.turn) || 0, ts: Date.now() };
        }
      });
    }
  } catch (e) { warn("fired-history record failed:", e); }

  // Cinematic dive: a travel trigger (hex-entry beat / travel encounter) may have
  // stashed a one-shot dive request just before running this beat. If present, this
  // beat's scene launch becomes a GM-solo cinematic dive (zoom→flash→view, with a
  // "⇪ pull table" on the far side) instead of a plain scene.activate() that yanks
  // the whole table. Consumed ONCE per beat so chained/sceneless beats don't replay.
  const _tx = game.bbttcc?.api?.transition;
  const _dive = _tx?.consumeDive?.() || null;
  const _diveScene = async (scene) => {
    if (!scene) return;
    if (_dive && _tx?.dive) {
      await _tx.dive(scene.uuid, {
        focus: _dive.focus, hexUuid: _dive.hexUuid,
        audience: _dive.audience || "view", label: _dive.label || label,
        originUuid: _dive.originUuid
      });
    } else if (scene.activate) {
      await scene.activate();
    }
  };

  const isCinematic =
    (String(type || "").trim() === "cinematic") ||
    !!(beat && beat.cinematic && beat.cinematic.enabled);

  // Journal auto-open (optional)
  _maybeShowBeatJournal(beat);

  // Beat audio (optional). Dialogue-sourced runs skip it: under the
  // intro-on-open doctrine the hub's recording already played when the
  // conversation window opened, and the routed OUTCOME beat's audio is
  // played by dialogueEnact at the curtain call — replaying the hub track
  // mid-conversation would double-perform.
  if (String(ctx?.source || "") !== "dialogue") await _maybePlayBeatAudio(beat);

  // Cinematic beats run through Encounter Engine step runner (auto-advance supported).
  // IMPORTANT: do NOT also activate beat.sceneId here, or you'll "eat" the chain.
  if (isCinematic) {

    // Prefer a local cinematic chain when author provided explicit start/next scenes.
    // This restores the intended UX: scene + description/dialog launch together (no blocking),
    // and narration auto-play / controls work for cinematic beats.
    const cin = beat && beat.cinematic ? beat.cinematic : null;
    const hasLocalChain = !!(cin && cin.enabled && (cin.startSceneId || cin.nextSceneId));

    if (hasLocalChain) {
      try {
        const hasDialogContentLocal =
          (String(beat.description || "").trim().length > 0) ||
          (Array.isArray(beat.choices) && beat.choices.length > 0);

        // Kick the dialog without blocking the cinematic scene activation.
        let dlgPromise = null;
        if (hasDialogContentLocal) {
          try { dlgPromise = _runBeatDialog(campaign, beat, ctx); } catch (_eDlg) {}
        }

        // Narration (auto-play) is already handled once at beat start.

        // Activate Start Scene
        const raw1 = String(cin.startSceneId || "").trim();
        let sc1 = null;
        if (raw1) {
          try { sc1 = raw1.includes(".") ? await fromUuid(raw1) : (game.scenes?.get?.(raw1) || null); } catch (_eS1) {}
          if (!sc1 && raw1 && !raw1.includes(".")) {
            try { sc1 = await fromUuid(`Scene.${raw1}`); } catch (_eS1b) {}
          }
        }
        await _diveScene(sc1);  // cinematic start scene — dives if a request is pending

        // Schedule Next Scene (if configured)
        const raw2 = String(cin.nextSceneId || "").trim();
        const dur0 = Number(cin.durationMs != null ? cin.durationMs : (cin.duration != null ? cin.duration : cin.ms));
        const dur = Number.isFinite(dur0) ? Math.max(0, dur0) : 0;

        if (raw2 && dur > 0) {
          setTimeout(async () => {
            try {
              let sc2 = null;
              try { sc2 = raw2.includes(".") ? await fromUuid(raw2) : (game.scenes?.get?.(raw2) || null); } catch (_eS2) {}
              if (!sc2 && raw2 && !raw2.includes(".")) {
                try { sc2 = await fromUuid(`Scene.${raw2}`); } catch (_eS2b) {}
              }
              if (sc2?.activate) await sc2.activate();
            } catch (_eN) {
              warn("Local cinematic next-scene activation failed:", _eN);
            }
          }, dur);
        }

        // If choices exist, wait for dialog result so routing can occur,
        // but DO NOT block the cinematic start scene.
        if (dlgPromise && Array.isArray(beat.choices) && beat.choices.length) {
          try { await dlgPromise; } catch (_eWait) {}
        }
      } catch (e) {
        err("Local cinematic chain failed:", e);
        ui.notifications?.error?.("Cinematic launch failed; see console.");
      }
    } else {
    if (!encounters) {
      ui.notifications?.warn?.(`Campaign: Encounter API not available for cinematic beat '${label}'.`);
    } else {
      const launchKey = _scenarioKeyForBeat(beat);
      const launchCtx = {
        ...ctx,
        source: "bbttcc-campaign",
        campaignId: campaign.id,
        campaignTitle: campaign.label,
        beatId: beat.id,
        beatLabel: label,
        beatType: type,
        launchKey
      };

      try {
        // Ensure the scenario exists (newer Encounter Engine supports this helper).
        if (typeof encounters.registerCampaignBeatScenario === "function") {
          try {
            encounters.registerCampaignBeatScenario(campaign.id, beat, { source: `campaign:${campaign.id}`, force: true });
          } catch (e) {
            warn("Cinematic: registerCampaignBeatScenario failed (continuing to launch)", e);
          }
        }

        // Launch using whichever method the encounters API exposes.
        if (typeof encounters.runScenario === "function") {
          await encounters.runScenario(launchKey, launchCtx);
        } else if (typeof encounters.run === "function") {
          await encounters.run(launchKey, launchCtx);
        } else if (typeof encounters.launchScenario === "function") {
          try {
            await encounters.launchScenario(launchKey, launchCtx);
          } catch (e1) {
            try {
              await encounters.launchScenario({ key: launchKey, scenarioKey: launchKey, ctx: launchCtx, ...launchCtx });
            } catch (e2) {
              throw e2;
            }
          }
        } else if (typeof encounters.startScenario === "function") {
          await encounters.startScenario(launchKey, launchCtx);
        } else if (typeof encounters.fireScenario === "function") {
          await encounters.fireScenario(launchKey, launchCtx);
        } else if (typeof encounters.testFire === "function") {
          await encounters.testFire(launchKey, launchCtx);
        } else {
          ui.notifications?.warn?.(`Campaign: Encounter API found, but no known launcher method for cinematic beat '${label}'.`);
          warn("Encounter API has no known launcher method (cinematic)", { keys: Object.keys(encounters || {}), launchKey });
        }
      } catch (e) {
        err("Cinematic scenario launch failed:", e);
        ui.notifications?.error?.("Cinematic launch failed; see console.");
      }
    }
    }
  } else {
    // Scene activation for non-cinematic beats
    const rawSceneRef = String(beat.sceneId || "").trim();
    if (rawSceneRef) {
      try {
        let scene = null;
        if (rawSceneRef.includes(".")) scene = await fromUuid(rawSceneRef);
        else scene = game.scenes?.get?.(rawSceneRef) || null;

        if (!scene && !rawSceneRef.includes(".")) {
          const maybe = `Scene.${rawSceneRef}`;
          try { scene = await fromUuid(maybe); } catch (e2) {}
        }

        await _diveScene(scene);  // non-cinematic beat scene — dives if a request is pending
      } catch (e) {
        err("Scene activation failed:", e);
        ui.notifications?.error?.("Error activating scene for campaign beat; see console.");
      }
    }
  }

  // [OK] RESTORED: prompt/choices can appear for ANY non-encounter beat.
  const hasDialogContent =
    (String(beat.description || "").trim().length > 0) ||
    (Array.isArray(beat.choices) && beat.choices.length > 0);


  // Quest/Encounter helpers
  const hasEncounterKey = !!(
    (beat && beat.encounter && beat.encounter.key && String(beat.encounter.key).trim()) ||
    (beat && beat.encounterKey && String(beat.encounterKey).trim()) ||
    (beat && beat.mechanics && beat.mechanics.encounterKey && String(beat.mechanics.encounterKey).trim())
  );

  // CHANGE: allow dialogs for outcome_trigger and other non-encounter beats.
  let dialogRes = null;

  // CHANGE: allow dialogs for outcome_trigger and other non-encounter beats.
  if (hasDialogContent && (type !== "encounter" || !hasEncounterKey) && !isCinematic) {
    dialogRes = await _runBeatDialog(campaign, beat, ctx);
    // After dialog resolves, we still apply world effects below (keeps pipeline).
  }

  // Quest acceptance prompt (only on questRole=start beats)
  await _maybePromptQuestAcceptance(campaign, beat, ctx);

  switch (type) {

    case "cinematic": {
      // Already handled above via Encounter Engine scenario runner.
      break;
    }

    case "scene_transition": {

      // Scene transitions can author actor spawns (Beat Editor: actors[]).
      // Only the GM should spawn tokens (permissions + authoritative scene mutation).
      if (!game.user?.isGM) break;

      try {
        const actors = Array.isArray(beat.actors) ? beat.actors.filter(Boolean) : [];
        log("scene_transition: spawn check", { beatId: beat.id, sceneId: beat.sceneId, actors });

        if (actors.length) {
          const sp = game.bbttcc?.api?.encounters?._spawner;
          if (!sp || typeof sp.spawnAtCenter !== "function") {
            warn("scene_transition: spawner not available (encounters._spawner.spawnAtCenter missing).");
            break;
          }

          const rawSceneRef = String(beat.sceneId || "").trim();
          let scene = null;

          if (rawSceneRef.includes(".")) {
            scene = await fromUuid(rawSceneRef);
          } else {
            scene = game.scenes?.get?.(rawSceneRef) || null;
            if (!scene && rawSceneRef) {
              try { scene = await fromUuid(`Scene.${rawSceneRef}`); } catch (_e) {}
            }
          }

          if (!scene) {
            warn("scene_transition: could not resolve scene for spawn", { rawSceneRef });
            break;
          }

          const spawnedBy = `campaign:${campaign.id}:${beat.id}`;

          await sp.spawnAtCenter(scene, actors, {
            spawnedBy,
            hidden: false,
            role: "npc"
          });

          // Post-check: how many tokens carry our spawnedBy flag?
          try {
            const toks = (scene.tokens?.contents || []).filter(t => t?.flags?.["bbttcc-encounters"]?.spawnedBy === spawnedBy);
            log("scene_transition: spawn complete", { spawnedBy, count: toks.length });
          } catch (_e2) {}
        }
      } catch (e) {
        warn("scene_transition spawn failed:", e);
      }

      break;
    }

    case "outcome_trigger": {
      const key = beat.outcomes?.success || beat.outcomes?.failure;
      if (!key) break;

      const ctx2 = { source: "bbttcc-campaign", campaignId: campaign.id, beatId: beat.id, beatType: type };

      let applied = false;
      if (resolution?.runResolution) {
        try { await resolution.runResolution(key, ctx2); applied = true; } catch (e) { warn("Resolution failed", key, e); }
      }
      if (!applied && territory?.applyOutcome) {
        try { await territory.applyOutcome({ outcomeKey: key, ctx: ctx2 }); applied = true; } catch (e) { warn("Territory.applyOutcome failed", key, e); }
      }
      if (!applied) ui.notifications?.warn?.(`No Resolution/Territory engine available for outcome '${key}'.`);
      break;
    }

    case "encounter": {
      const inferredFromId = (String(beat.id || "").startsWith("enc_")) ? String(beat.id).slice(4) : null;
      const encounterKey = beat.encounter?.key || beat.encounterKey || beat.mechanics?.encounterKey || inferredFromId || null;
      const scenarioKey  = beat.mechanics?.scenarioKey || beat.scenarioKey || null;

      if (!encounters) {
        ui.notifications?.warn?.(`Campaign: Encounter API not available for '${label}'.`);
        break;
      }

      let launchKey = scenarioKey || null;
      try {
        if (!launchKey && encounterKey && typeof encounters.getScenarioKeyForEncounter === "function") {
          launchKey = encounters.getScenarioKeyForEncounter(encounterKey);
        }
        if (!launchKey) launchKey = encounterKey || scenarioKey;
      } catch {
        launchKey = encounterKey || scenarioKey;
      }

      if (!launchKey) {
        ui.notifications?.warn?.(`Campaign: encounter beat '${label}' has no encounter key yet (campaign-local encounter).`);
        break;
      }

      const launchCtx = {
        ...ctx,
        source: "bbttcc-campaign",
        campaignId: campaign.id,
        campaignTitle: campaign.label,
        beatId: beat.id,
        beatLabel: label,
        beatType: type,
        encounterKey,
        scenarioKey,
        launchKey
      };

      try {
        if (typeof encounters.runScenario === "function") {
          await encounters.runScenario(launchKey, launchCtx);
        } else if (typeof encounters.run === "function") {
          await encounters.run(launchKey, launchCtx);
        } else if (typeof encounters.launchScenario === "function") {
          try {
            await encounters.launchScenario(launchKey, launchCtx);
          } catch (e1) {
            try {
              await encounters.launchScenario({ key: launchKey, scenarioKey: launchKey, ctx: launchCtx, ...launchCtx });
            } catch (e2) {
              throw e2;
            }
          }
        } else if (typeof encounters.startScenario === "function") {
          await encounters.startScenario(launchKey, launchCtx);
        } else if (typeof encounters.fireScenario === "function") {
          await encounters.fireScenario(launchKey, launchCtx);
        } else {
          ui.notifications?.warn?.(`Campaign: Encounter API found, but no known launcher method for '${label}'.`);
          warn("Encounter API has no known launcher method", { keys: Object.keys(encounters || {}), launchKey });
        }
      } catch (e) {
        err("Encounter launch failed:", e);
        ui.notifications?.error?.("Encounter launch failed; see console.");
      }

      break;
    }

    default: {
      ui.notifications?.info?.(`(Stub) Campaign '${campaign.label}': ran beat '${label}' of type '${type}'.`);
      break;
    }
  }

  // World mutation (unchanged)
  try {
    const wm = game.bbttcc?.api?.worldMutation;
    if (wm?.applyWorldEffects) {
      await wm.applyWorldEffects(beat, {
        source: "bbttcc-campaign",
        campaignId: campaign.id,
        campaignTitle: campaign.label,
        beatId: beat.id
      });
    }

    // Quest effects (Beat Editor -> World Effects -> Quest Effects)
    try {
      await _applyQuestEffects(campaign, beat, ctx);
    } catch (eQuestFx) {
      warn("Quest effects failed:", eQuestFx);
    }

    // Phase Charter closers (worldEffects.phaseAdvance) — advance the act +
    // raise leveling floors. Runs after quest effects so a closer can both
    // complete its quest and open the next act in one beat.
    try {
      await _applyPhaseAdvance(campaign, beat);
    } catch (ePhase) {
      warn("Phase advance failed:", ePhase);
    }

    // Tikkun Dividend rungs + anchor-hex Purified cascades (landmark closers).
    try {
      await _applyTikkunDelta(campaign, beat);
      await _applyPurifyHexes(campaign, beat);
    } catch (eTik) {
      warn("Tikkun effects failed:", eTik);
    }

    // -------------------------------------------------------------------
    // Casualty Engine (Beat tags)  -  applies hex/faction casualty effects + war logs
    // Runs after worldEffects apply so it can append receipts and use ctx/hex resolution.
    // -------------------------------------------------------------------
    try {
      const cas = game.bbttcc?.api?.casualties;
      if (cas && typeof cas.applyFromBeat === "function") {
        await cas.applyFromBeat(beat, ctx, {
          source: "bbttcc-campaign",
          campaignId: campaign.id,
          campaignTitle: campaign.label,
          beatId: beat.id,
          beatLabel: label,
          beatType: type
        });
      }
    } catch (eCas) {
      warn("Casualty engine failed:", eCas);
    }

    // -------------------------------------------------------------------
    // AAE Political Pressure (optional)
    // Fires AFTER worldEffects apply, so it reflects the final beat outcome.
    // NOW: choice-aware + decision memory + consequences.
    // -------------------------------------------------------------------
    try {
      const aae = game.bbttcc?.api?.aae;
      if (aae?.applyPoliticalImpact) {

        const rawBeatTags =
          beat?.politicalTags ??
          beat?.politics?.tags ??
          beat?.worldEffects?.politicalTags ??
          beat?.worldEffects?.politics?.tags ??
          beat?.inject?.politicalTags ??
          "";

        const beatTags = _polTagList(rawBeatTags);
        const choiceTags = _choicePoliticalTags(dialogRes?.choice);

        // Choice tags refine the beat tag intent; we merge (unique) so beat-level can provide "context"
        const tags = _uniqTags([ ...choiceTags, ...beatTags ]);

        const factionId =
          String(ctx?.factionId || "").trim() ||
          String(beat?.factionId || "").trim() ||
          String(campaign?.factionId || "").trim() ||
          null;

        if (factionId && tags.length) {

          const res = await aae.applyPoliticalImpact({
            factionId,
            actorIds: ctx?.actorIds || ctx?.actors || [],
            tags,
            source: {
              kind: "campaignBeat",
              campaignId: campaign.id,
              beatId: beat.id,
              beatType: type,
              choiceIndex: (dialogRes && dialogRes.choiceIndex != null) ? dialogRes.choiceIndex : null,
              choiceLabel: dialogRes?.choice?.label || null
            }
          });

          // ---- Decision Memory (append-only, capped)
          try {
            const driftDelta = Number(res?.driftDelta ?? 0) || 0;
            const record = {
              v: 1,
              ts: Date.now(),
              turn: (typeof _getTurnNumberSafe === "function") ? _getTurnNumberSafe() : 0,

              factionId,
              campaignId: campaign.id,
              beatId: beat.id,
              beatType: type,
              beatLabel: label,

              choiceIndex: (dialogRes && dialogRes.choiceIndex != null) ? dialogRes.choiceIndex : null,
              choiceLabel: dialogRes?.choice?.label || null,
              check: dialogRes?.check || null,

              tags,

              aae: {
                severity: res?.severity || null,
                severityState: res?.severityState || null,
                driftDelta,
                driftScoreBefore: res?.driftScoreBefore ?? null,
                driftScoreAfter:  res?.driftScoreAfter ?? null,
                centerKey: res?.centerKey || null,
                minorityPressure: res?.minorityPressure ?? null
              }
            };

            await _appendAAEDecisionHistory(factionId, record, 50);
          } catch (e) {
            warn("AAE decision record failed:", e);
          }

          // ---- Table visibility (2026-07-15): drift flags and the warlog
          // never reach the table, so pressure lands as a GM chat card —
          // majors name the dissenting stewards so the pressure has faces.
          try {
            if (res?.ok && res.severity && res.severity !== "neutral") {
              const sevLabel = _prettySeverity(String(res.severity));
              const dd = Number(res.driftDelta ?? 0) || 0;
              const dissenters = (res.perActor || []).filter(p =>
                p.severity === "dissonance_major" || p.severity === "dissonance_critical");
              const fName = game.actors?.get?.(factionId)?.name || "Faction";
              const rows = [
                `<b>${fName}</b> — ${sevLabel} (drift ${dd >= 0 ? "+" : ""}${dd} → ${res.driftScoreAfter ?? "?"} · ${res.severityState || "stable"})`,
                res.centerLabel ? `Center: ${res.centerLabel}` : null,
                tags.length ? `Tags: ${tags.join(", ")}` : null,
                dialogRes?.choice?.label ? `Choice: ${dialogRes.choice.label}` : null,
                res.minorityPressure ? `<b>⚠ Minority pressure</b> — a dissenting bloc escalates this.` : null,
                dissenters.length ? `Dissenting stewards: ${dissenters.map(p => `<b>${p.name}</b> (${p.philosophy})`).join(", ")}` : null
              ].filter(Boolean);
              const gmIds = (game.users?.filter?.(u => u.isGM) || []).map(u => u.id);
              await ChatMessage.create({
                content: `<div class="bbttcc-aae-pressure"><h3>🗳️ Political Pressure</h3><p>${rows.join("</p><p>")}</p></div>`,
                whisper: gmIds
              });
            }
          } catch (e) {
            warn("AAE pressure chat card failed:", e);
          }

          // ---- Consequences (alpha-safe, uses World Mutation Engine)
          try {
            const severity = String(res?.severity || "neutral");
            const row = _consequenceRowForSeverity(severity);

            if (row) {
              const wm2 = game.bbttcc?.api?.worldMutation;

              // only write warlog if there's an actual consequence row
              const driftDelta = Number(res?.driftDelta ?? 0) || 0;
              const driftStr = `${driftDelta >= 0 ? "+" : ""}${driftDelta}`;
              const sevLabel = _prettySeverity(severity);
              const choiceLabel = dialogRes?.choice?.label ? `  -  Choice: ${dialogRes.choice.label}` : "";
              const tagStr = tags.length ? `  -  tags: ${tags.join(", ")}` : "";

              const warLog = `AAE: Political pressure  -  ${sevLabel} (drift ${driftStr})${choiceLabel}${tagStr}`;

              if (wm2?.applyWorldEffects) {
                await wm2.applyWorldEffects(
                  {
                    factionEffects: [
                      { factionId, ...row }
                    ],
                    warLog
                  },
                  {
                    source: "bbttcc-campaign",
                    campaignId: campaign.id,
                    beatId: beat.id,
                    factionId,
                    logType: "aaepolitics"
                  }
                );
              }
            }
          } catch (e) {
            warn("AAE consequence apply failed:", e);
          }
        }
      }
    } catch (e) {
      warn("AAE political impact failed:", e);
    }

  } catch (e) {
    warn("World mutation failed:", e);
  }

  // Time Points (optional): accumulate beat-time into world clock
  await _applyBeatTimePoints(campaign, beat, ctx);

  // Subscriber hook for cross-module reactions to beat resolution. Tikkun
  // module subscribes to advance spark state when a beat carries
  // `beat.sparkLink` metadata (Phase B of B3). Other modules can subscribe
  // for their own reactions. Errors in listeners are isolated so they cannot
  // break the beat lifecycle.
  try {
    Hooks.callAll("bbttcc:beat:resolved", {
      campaign,
      beat,
      ctx,
      outcome: dialogRes ?? null
    });
  } catch (e) {
    warn("bbttcc:beat:resolved listeners failed:", e);
  }

  // Quest offer (2026-08-24, owner spec): a beat may carry
  //   offerQuest = { questId, acceptBeatId, label?, text? }
  // On resolution it posts a public ASSIGNMENT card; accepting runs the
  // accept beat — which should itself carry the questEffects `accept` row,
  // so accepting IS what begins tracking. The table decides; the GM's click
  // seals it (runBeat is a world write).
  try {
    const oq = beat?.offerQuest;
    if (oq && oq.acceptBeatId && game.user?.isGM) {
      const esc = foundry.utils.escapeHTML;
      const qname = String(oq.label || oq.questId || "the assignment");
      await ChatMessage.create({
        content:
          `<div class="bbttcc-quest-offer" data-campaign-id="${esc(String(campaign.id))}" data-accept-beat="${esc(String(oq.acceptBeatId))}">` +
          `<h3>📜 Assignment offered: ${esc(qname)}</h3>` +
          (oq.text ? `<p>${oq.text}</p>` : "") +
          `<p style="font-size:0.8rem;opacity:0.8">The table decides. Accepting opens the questline.</p>` +
          `<button type="button" class="bbttcc-quest-accept">✓ Accept the assignment</button></div>`
      });
    }
  } catch (e) { warn("quest-offer card failed:", e); }
}

// Title-card trigger (2026-08-24, owner's movie model): the first applied
// turn advance while the story sits in Act 1 (the prologue) offers the GM
// the TITLE CARD beat — whose phaseAdvance raises Act 2 and the trouble
// starts. Beat id `ag_title_card`; skipped once fired.
Hooks.on("bbttcc:advanceTurn:end", ({ apply } = {}) => {
  try {
    if (!apply || !game.user?.isGM) return;
    if (_storyPhaseGet() !== 1) return;
    const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
    const camp = cid ? getCampaign(cid) : null;
    if (!camp || !(camp.beats || []).some(b => String(b?.id) === "ag_title_card")) return;
    try {
      const ds = game.bbttcc?.api?.campaign?.director?.state?.() || {};
      if (ds.firedStoryBeats?.ag_title_card) return;
    } catch (_e) {}
    ChatMessage.create({
      whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
      content: `<div class="bbttcc-title-card-offer" data-campaign-id="${foundry.utils.escapeHTML(String(cid))}">` +
        `<h3>🎬 The first turn is in the books</h3>` +
        `<p>The prologue is over. Roll the title card — Act 2 opens and the trouble starts.</p>` +
        `<button type="button" class="bbttcc-title-card-run">🎬 Roll the title card</button></div>`
    });
  } catch (e) { warn("title-card offer failed:", e); }
});

// Quest-offer accept binder (both chat-render hooks, per the war-log pattern
// below). GM click runs the accept beat; players get pointed at their GM.
for (const hk of ["renderChatMessageHTML", "renderChatMessage"]) {
  Hooks.on(hk, (_msg, html) => {
    const root = html?.[0] ?? html;
    root?.querySelectorAll?.(".bbttcc-quest-accept")?.forEach(btn => {
      if (btn.dataset.bbttccBound) return;
      btn.dataset.bbttccBound = "1";
      btn.addEventListener("click", async () => {
        if (!game.user?.isGM) return ui.notifications?.warn?.("Tell your GM the table accepts — their click seals it.");
        const wrap = btn.closest(".bbttcc-quest-offer");
        const cid = wrap?.dataset?.campaignId, bid = wrap?.dataset?.acceptBeat;
        if (!cid || !bid) return;
        btn.disabled = true; btn.textContent = "✓ Accepted — opening…";
        try { await game.bbttcc.api.campaign.runBeat(cid, bid); }
        catch (e) { console.warn("[bbttcc-campaign] quest accept failed", e); btn.disabled = false; }
      });
    });
    root?.querySelectorAll?.(".bbttcc-title-card-run")?.forEach(btn => {
      if (btn.dataset.bbttccBound) return;
      btn.dataset.bbttccBound = "1";
      btn.addEventListener("click", async () => {
        if (!game.user?.isGM) return;
        const cid = btn.closest(".bbttcc-title-card-offer")?.dataset?.campaignId;
        if (!cid) return;
        btn.disabled = true; btn.textContent = "🎬 Rolling…";
        try { await game.bbttcc.api.campaign.runBeat(cid, "ag_title_card"); }
        catch (e) { console.warn("[bbttcc-campaign] title card failed", e); btn.disabled = false; }
      });
    });
  });
}

async function runCampaign(id, ctx = {}) {
  const c = getCampaign(id);
  if (!c) return ui.notifications?.warn?.(`Campaign '${id}' not found.`);
  const first = (c.beats || [])[0];
  if (!first) return ui.notifications?.warn?.(`Campaign '${c.label}' has no beats.`);
  await executeBeat(c, first, ctx);
}

// Story Director — state-gated beat-entry redirect (step 5). Returns a replacement
// beat id (or null) to run *instead* of the requested one, BEFORE it executes — so
// the redirected-away beat's dialog AND worldEffects never fire. Today it enforces
// one rule: the Cultural Summit only closes the Ledger if the original cause was
// recovered; without it, the success beat reroutes to the failure beat (and the
// feud subscriber then raises Grievance off that failure). Generalizes as the
// director grows. Fail-soft: any error → no redirect.
function _beatEntryRedirect(beatId, campaign) {
  try {
    if (beatId === FEUD_SUMMIT_SUCCESS_ID) {
      const fac = game.actors?.get?.(FORGOTTEN_CAUSE_FACTION_ID);
      const recovered = !!fac?.getFlag?.(FF_NS, "feudCauseRecovered");
      if (!recovered) {
        log("[feud] Cultural Summit reached without the recovered cause → rerouting success → failure.");
        return FEUD_SUMMIT_FAILURE_ID;
      }
    }
    // Phase-entry redirect (hospitality pass): a beat may carry
    // phaseEntry = { belowPhase: N, to: "beat_id" } — while storyPhase < N,
    // entering it lands on `to` instead (its Phase-1 hospitality variant).
    // This is the seam that keeps choice navigation phase-honest: runBeat
    // deliberately ignores inject.requires (gates are the Director's concern),
    // so "Leave → quest hub" wiring needs the reroute to happen here.
    const b = (campaign?.beats || []).find(x => String(x?.id) === String(beatId));
    const pe = b?.phaseEntry;
    if (pe && pe.to && Number.isFinite(Number(pe.belowPhase)) && _storyPhaseGet() < Number(pe.belowPhase)) {
      const to = String(pe.to);
      if ((campaign?.beats || []).some(x => String(x?.id) === to)) {
        log(`[phaseEntry] '${beatId}' → '${to}' (storyPhase ${_storyPhaseGet()} < ${Number(pe.belowPhase)})`);
        return to;
      }
      warn(`[phaseEntry] '${beatId}' names missing redirect target '${to}' — running the original.`);
    }
  } catch (e) { warn("[director] beat-entry redirect failed:", e); }
  return null;
}

async function runBeat(id, beatId, ctx = {}) {
  const c = getCampaign(id);
  if (!c) return ui.notifications?.warn?.(`Campaign '${id}' not found.`);
  const redirectId = _beatEntryRedirect(beatId, c);               // step 5: state-gated reroute
  const effectiveId = (redirectId && redirectId !== beatId) ? redirectId : beatId;
  const b = (c.beats || []).find(x => x.id === effectiveId);
  if (!b) return ui.notifications?.warn?.(`Beat '${effectiveId}' not found in '${id}'.`);
  await executeBeat(c, b, ctx);
}

// ---------------------------------------------------------------------------
// Injector helpers
// ---------------------------------------------------------------------------


function _getWorldTurnLengthSafe() {
  try {
    const w = game.bbttcc?.api?.world;
    const s = w?.getState ? w.getState() : null;
    const tl = Number(s?.time?.turnLength ?? 0);
    return Number.isFinite(tl) && tl > 0 ? tl : 12;
  } catch (e) {}
  return 12;
}

function _timePointsForBeat(beat, ctx = {}) {
  // Explicit override wins — INCLUDING an explicit 0. This matters: the beat
  // editor stamped timeScale "scene" on ~500 beats as a form default (never
  // human intent), which maps to a full day each. timePoints: 0 is how the
  // backfill seeder silences that noise per beat. Fractions are legal — a
  // half-day site visit is timePoints 0.5 (the old floor() turned 0.5 into 0).
  const rawVal = beat?.timePoints ?? beat?.time?.points ?? ctx?.timePoints;
  if (rawVal != null && rawVal !== "") {
    const raw = Number(rawVal);
    if (Number.isFinite(raw) && raw >= 0) return Math.round(raw * 100) / 100;
  }

  // Map timeScale to default points
  const scale = String(beat?.timeScale ?? beat?.time?.scale ?? "").trim().toLowerCase();
  const tl = _getWorldTurnLengthSafe();

  if (scale === "moment") return 0;
  if (scale === "scene")  return 1;
  if (scale === "leg")    return 1;
  if (scale === "turn")   return tl;
  if (scale === "arc")    return tl * 3;
  if (scale === "campaign") return 0;

  // Default: no time unless explicitly authored
  return 0;
}

async function _applyBeatTimePoints(campaign, beat, ctx = {}) {
  try {
    const w = game.bbttcc?.api?.world;
    if (!w?.addTime) return false;

    const tp = _timePointsForBeat(beat, ctx);
    if (!tp) return false;

    const label = beat?.label || beat?.id || "(beat)";
    const note = `Beat time +${tp}: ${campaign?.label || campaign?.id || "campaign"}  -  ${label}`;

    await w.addTime(tp, { source: "beat", note, autoAdvance: true, campaignId: campaign?.id || null });
    return true;
  } catch (e) {
    warn("applyBeatTimePoints failed:", e);
    return false;
  }
}

// ── Turn Ledger (2026-07-08) ─────────────────────────────────────────────────
// world.addTime is the clock; this is the LEDGER over it. Entries record what
// the days went to (for the turn-end whisper and the HUD chip); the travel
// listener converts legs into days; the advanceTurn:end listener settles the
// month — whisper summary, debt carry, entry reset. Owner-locked design:
// T=30 days · soft budget (overage borrows from next turn) · party ledger,
// unspent days auto-bank into development (P4 wires the funding gate).

function _ledgerBudgetSetting() {
  try {
    const n = Number(game.settings.get(MOD_ID, SETTING_TURN_TIME_BUDGET));
    if (Number.isFinite(n) && n > 0) return n;
  } catch (_e) {}
  return 30;
}

function _ledgerEntriesRead() {
  try {
    const raw = game.settings.get(MOD_ID, SETTING_LEDGER_ENTRIES);
    return {
      turn: Number(raw?.turn) || 0,
      entries: Array.isArray(raw?.entries) ? raw.entries : []
    };
  } catch (_e) { return { turn: 0, entries: [] }; }
}

function _ledgerGet() {
  const w = game.bbttcc?.api?.world;
  const b = w?.getTimeBudget ? w.getTimeBudget() : { budget: _ledgerBudgetSetting(), spent: 0, remaining: _ledgerBudgetSetting(), debt: 0 };
  return { ...b, entries: _ledgerEntriesRead().entries };
}

async function _ledgerSpend(points, meta = {}) {
  const w = game.bbttcc?.api?.world;
  if (!w?.addTime) return { ok: false, reason: "no_world_api" };
  return w.addTime(points, { source: meta.source || "manual", note: meta.note || "", ...meta });
}

// Single funnel: EVERY accrual (beat path calls world.addTime directly, travel
// and manual spends come through _ledgerSpend) lands here exactly once, on the
// GM client that performed the write.
function _onTimeAccruedLedger(payload) {
  try {
    if (!game.user?.isGM) return;
    const data = _ledgerEntriesRead();
    data.turn = _getTurnNumberSafe();
    data.entries.push({
      at: Date.now(),
      points: Number(payload?.points) || 0,
      source: String(payload?.source || "manual"),
      note: String(payload?.note || "")
    });
    if (data.entries.length > 300) data.entries = data.entries.slice(-300);
    game.settings.set(MOD_ID, SETTING_LEDGER_ENTRIES, data);
  } catch (e) { warn("[ledger] accrual record failed:", e); }
}

function _ledgerTravelTierDays() {
  try {
    const parts = String(game.settings.get(MOD_ID, SETTING_LEDGER_TRAVEL_TIER_DAYS) || "")
      .split(",").map(s => Number(s.trim()));
    if (parts.length >= 4 && parts.slice(0, 4).every(Number.isFinite)) return parts;
  } catch (_e) {}
  return [1, 1, 2, 3];
}

// Travel legs carry distance (hex units) + terrain tier, not time — convert.
// Exactly-once accounting across the hook's THREE emitters: (a) hex-travel's
// resolution emit (plain, has distance) — debit; (b) the travel console's
// informational re-emit for encounter legs (has .encounter, source
// "travel-console") — skip, (a) already paid; (c) the GM-arbitration relay for
// PLAYER travel (has .encounter, source "travel-console-relay") — debit: it is
// the only GM-side fire for that leg (defaults price it at ~1 day; plain
// player legs never reach the GM client — same pre-existing limitation as
// director travel pressure).
function _onAfterTravelLedger(tctx) {
  try {
    if (!game.user?.isGM) return;
    if (tctx?.encounter && String(tctx?.source || "") !== "travel-console-relay") return;
    const units = Math.max(1, Number(tctx?.distanceUnits) || 1);
    const tier = Math.min(4, Math.max(1, Number(tctx?.terrainTier) || 1));
    const perHex = Number(_ledgerTravelTierDays()[tier - 1]) || 1;
    const days = Math.round(units * perHex * 100) / 100;
    if (!(days > 0)) return;
    const terrain = String(tctx?.terrainKey || "terrain");
    _ledgerSpend(days, { source: "travel", note: `Travel: ${terrain} (tier ${tier}) × ${units} hex` })
      .catch(e => warn("[ledger] travel debit failed:", e));
  } catch (e) { warn("[ledger] travel listener failed:", e); }
}

// Turn-end settle: whisper where the month went, carry overspend as debt into
// the new month (it starts pre-spent), reset entries, re-sync budget setting.
async function _onAdvanceTurnEndLedger(tctx) {
  if (!tctx || tctx.apply !== true) return;

  // Phase Charter calendar doors: the clock keeps its own promises. If the
  // world turn has reached a hard-door threshold and the phase lags, advance
  // it (the GM whisper names the door; the authored summons beat is the
  // narrative face — run it from the console when it appears).
  try {
    const tNow = _getTurnNumberSafe();
    for (const [turnGte, phaseMin] of PHASE_CALENDAR_DOORS) {
      if (tNow >= turnGte) await _storyPhaseAdvance(phaseMin, { via: `calendar hard door (turn ${tNow})` });
    }
  } catch (ePhaseCal) {
    warn("[phase] calendar door check failed:", ePhaseCal);
  }
  if (!game.user?.isGM) return;
  const w = game.bbttcc?.api?.world;
  if (!w?.getTimeBudget || !w?.getState || !w?.setState) return;

  const before = w.getTimeBudget();
  const { entries } = _ledgerEntriesRead();
  const esc = foundry.utils.escapeHTML;

  const bySource = {};
  for (const e of entries) {
    const k = String(e?.source || "manual");
    bySource[k] = Math.round(((bySource[k] || 0) + (Number(e?.points) || 0)) * 100) / 100;
  }
  const srcRows = Object.entries(bySource)
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td style="text-align:right">${v}</td></tr>`).join("");
  const detailRows = entries.slice(-40)
    .map(e => `<tr><td style="opacity:.8">${esc(String(e?.source || ""))}</td><td style="text-align:right">${Number(e?.points) || 0}</td><td>${esc(String(e?.note || ""))}</td></tr>`).join("");

  const banked = before.remaining;
  const debt = before.debt;
  const verdict = debt > 0
    ? `<p>⚠ The month ran <b>${debt} day(s) over</b> — the debt carries: the new month starts on Day ${debt}.</p>`
    : `<p><b>${banked} day(s) unspent</b> bank into development.</p>`;

  try {
    await ChatMessage.create({
      content: `
        <div class="bbttcc-turn-ledger-summary">
          <h3>Turn Ledger — where the month went</h3>
          <p>Spent <b>${before.spent}</b> of <b>${before.budget}</b> days.</p>
          ${srcRows ? `<table style="width:100%"><tbody>${srcRows}</tbody></table>` : `<p style="opacity:.7">No time debits recorded this turn.</p>`}
          ${verdict}
          ${detailRows ? `<details><summary>Entries (${entries.length})</summary><table style="width:100%;font-size:.9em"><tbody>${detailRows}</tbody></table></details>` : ""}
        </div>`,
      whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
      speaker: { alias: "Turn Ledger" }
    });
  } catch (e) { warn("[ledger] turn-end whisper failed:", e); }

  try {
    const budget = _ledgerBudgetSetting();
    const s = w.getState();
    const carried = Math.max(0, Math.round((s.time.progress - s.time.turnLength) * 100) / 100);
    s.time.turnLength = budget;
    s.time.progress = carried;
    await w.setState(s);
    await game.settings.set(MOD_ID, SETTING_LEDGER_ENTRIES, {
      turn: _getTurnNumberSafe(),
      entries: carried > 0
        ? [{ at: Date.now(), points: carried, source: "debt", note: `Carried from last turn — the month starts ${carried} day(s) in the hole` }]
        : []
    });
  } catch (e) { warn("[ledger] turn-end reset failed:", e); }
}

// GM-facing time price on director offers: the party chooses knowing what the
// moment displaces ("that's a day the wall crew doesn't get"). Player-facing
// surfaces stay silent about costs (mal-voice doctrine).
function _ledgerOfferPriceLine(beat) {
  try {
    const tp = _timePointsForBeat(beat);
    if (!tp) return "";
    const lg = _ledgerGet();
    const context = lg.budget > 0 ? ` — Day ${lg.spent} of ${lg.budget}${lg.debt > 0 ? `, ${lg.debt} owed` : ""}` : "";
    return `<p style="opacity:.75;font-size:.9em"><i class="fas fa-hourglass-half"></i> Time: ≈ ${tp} day(s)${context}.</p>`;
  } catch (_e) { return ""; }
}

// Keep the world clock's month length in step with the setting (GM, on ready).
async function _ledgerSyncBudget() {
  try {
    const w = game.bbttcc?.api?.world;
    if (!w?.getState || !w?.setState) return;
    const budget = _ledgerBudgetSetting();
    const s = w.getState();
    if (s.time.turnLength === budget) return;
    s.time.turnLength = budget;
    await w.setState(s);
    log(`[ledger] world.time.turnLength synced to ${budget} (Turn Time Budget setting).`);
  } catch (e) { warn("[ledger] budget sync failed:", e); }
}


function _getTurnNumberSafe() {
  // The authoritative world turn lives at bbttcc-world's worldState.turn —
  // `game.bbttcc.api.turn` has never exposed getTurnNumber/turnNumber, so the
  // old read below always returned 0 (which also made injector cooldownTurns
  // a silent no-op). World API first; legacy paths kept as a fallback.
  try {
    const w = game.bbttcc?.api?.world;
    if (w?.getState) {
      const t = Number(w.getState()?.turn);
      if (Number.isFinite(t) && t > 0) return t;
    }
  } catch (e) {}
  try {
    const t = game.bbttcc?.api?.turn;
    if (t?.getTurnNumber) return Number(t.getTurnNumber()) || 0;
    if (t?.turnNumber != null) return Number(t.turnNumber) || 0;
  } catch (e) {}
  return 0;
}

function _readInjectState() {
  try {
    const s = game.settings.get(MOD_ID, SETTING_INJECT_STATE);
    return (s && typeof s === "object") ? foundry.utils.deepClone(s) : {};
  } catch {
    return {};
  }
}

async function _writeInjectState(state) {
  await game.settings.set(MOD_ID, SETTING_INJECT_STATE, state || {});
  return state || {};
}

function _splitTags(tagStr) {
  return String(tagStr || "").split(/[\s,]+/g).map(s => _canonicalizeCampaignTag(s.trim())).filter(Boolean);
}

function _matchesTravelThreshold(beat) {
  const tags = _splitTags(beat?.tags);
  return tags.includes("inject.travel_threshold");
}

function _matchesInjectorTags(beat, ctxTags) {
  const tags = _splitTags(beat?.tags);
  if (!tags.length) return false;
  const wanted = Array.isArray(ctxTags) ? ctxTags.filter(Boolean) : [];
  const injectWanted = wanted.filter(function (t) { return String(t || "").indexOf("inject.") === 0; });
  if (!injectWanted.length) return _matchesTravelThreshold(beat);
  for (const t of injectWanted) {
    if (tags.includes(String(t))) return true;
  }
  return false;
}

function _scoreBeat(beat, ctxTags = []) {
  const tags = _splitTags(beat?.tags);
  if (!tags.length) return 0;
  if (!_matchesInjectorTags(beat, ctxTags)) return 0;

  let score = 100;
  const set = new Set(tags);
  for (const t of ctxTags) {
    if (!t) continue;
    if (set.has(t)) score += (String(t).indexOf("inject.") === 0 ? 12 : 10);
  }
  if (set.has("inject.travel_threshold")) score += 1;
  return score;
}

function _injectKeyFor(beat, ctx) {
  const campaignId = ctx?.campaignId || "any";
  const hexUuid = ctx?.hexUuid || ctx?.hexId || "nohex";
  return `${campaignId}:${beat.id}:${hexUuid}`;
}

function _cooldownKeyFor(beat, ctx) {
  const campaignId = ctx?.campaignId || "any";
  return `${campaignId}:${beat.id}:cooldown`;
}

function _globalHexGateKey(campaignId, hexUuid) {
  return `${campaignId || "any"}:HEX:${hexUuid || "nohex"}:GLOBAL`;
}

function _declineHexGateKey(campaignId, hexUuid) {
  return `${campaignId || "any"}:HEX:${hexUuid || "nohex"}:DECLINED`;
}

function _isDebtishBeat(beat) {
  const tags = _splitTags(beat?.tags);
  const set = new Set(tags);
  return set.has("inject.debt_pressure") || set.has("theme.auditor") || set.has("thread.E") || set.has("auditor");
}

function _countDebtMarkersInWarLogs(actor, windowSize = 50) {
  try {
    const wl = actor?.flags?.["bbttcc-factions"]?.warLogs || [];
    const slice = wl.slice(-Math.max(1, Number(windowSize) || 50));
    let count = 0;
    for (const entry of slice) {
      const s = String(entry?.summary || "");
      if (s.includes(DEBT_PREFIX)) count += 1;
    }
    return count;
  } catch {
    return 0;
  }
}

function _resolveDebtAnchorActor(ctx = {}) {
  const uuid = ctx.factionUuid || ctx.actorUuid || ctx.factionActorUuid || DEFAULT_FACTION_UUID;
  try { return fromUuidSync(uuid); } catch { return null; }
}

async function _gmPromptDebtBeat({ campaignId, beatId, beatLabel, hexUuid }) {
  return new Promise((resolve) => {
    const content = `
      <p><strong>${beatLabel || beatId}</strong></p>
      <p>This beat is debt-driven (the vault is calling in favors / consequences).</p>
      <p><em>Run it now?</em></p>
      <hr/>
      <p style="opacity:0.8">Campaign: <code>${campaignId}</code><br/>Hex: <code>${hexUuid || "(none)"}</code></p>
    `;

    new Dialog({
      title: "Bad Eden: Debt Pressure Beat",
      content,
      buttons: {
        run:     { icon: '<i class="fas fa-play"></i>', label: "Run",     callback: () => resolve(true) },
        decline: { icon: '<i class="fas fa-ban"></i>',  label: "Decline", callback: () => resolve(false) }
      },
      default: "run",
      close: () => resolve(false)
    }).render(true);
  });
}

// ---------------------------------------------------------------------------
// Injector
// ---------------------------------------------------------------------------

// ─── Story Director: the Gate organ (`inject.requires`) ──────────────────────
// A beat may carry `inject.requires` — a condition, or an array of conditions
// (AND-combined), gating whether the injector will offer it. Condition shapes:
//   { flag, gte|lte|eq }              — a meter source resolved by _resolveGateValue
//                                       (today only "wendigoRung", a world setting)
//   { questBucket, is }               — quest sits in the coalition's
//                                       active|completed|archived bucket
//   { beatMark, quest, state }        — beat is marked "seen"|"completed" in that
//                                       quest's progress ("completed" satisfies "seen")
// Quest state = the coalition's shared per-faction quests flag (fan-out keeps all
// campaign.factionIds members identical → read one; see _coalitionQuestTrack).
// Fail-OPEN on a thrown error (never hide a beat because the evaluator broke);
// fail-CLOSED + warn on an unknown/misconfigured condition (a bad gate must not
// silently fire a story beat early). Beats with no `requires` are unaffected.
// ---------------------------------------------------------------------------
// Phase Charter machinery (2026-07-15, PHASE-CHARTER-2026-07-15.md v1.2):
// storyPhase is the campaign's act ladder. Landmark "closer" beats carry
// worldEffects.phaseAdvance = { set: N }; floors come from PHASE_FLOORS so the
// charter's leveling ladder lives in exactly one place. Phase only ever RISES.
// ---------------------------------------------------------------------------
const SETTING_STORY_PHASE = "storyPhase";
const PHASE_NAMES = ["THE OFFICES", "SETTLING", "SPARKS", "THE WIDENING TRAIL", "THE VAULT & THE SKY", "THATWARDS HO!", "GLOOMGILL"];
const PHASE_FLOORS = { 2: { steward: 2, faction: 1 }, 3: { steward: 4, faction: 2 }, 4: { steward: 6, faction: 3 }, 5: { steward: 8, faction: 4 }, 6: { steward: 9, faction: 4 } };
// Calendar hard doors (charter §2): turn threshold → minimum phase.
const PHASE_CALENDAR_DOORS = [[2, 2], [6, 3], [10, 4], [14, 5]];

function _storyPhaseGet() {
  try { return Number(game.settings.get(MOD_ID, SETTING_STORY_PHASE)) || 0; } catch (_e) { return 0; }
}

async function _storyPhaseAdvance(target, { via = "beat" } = {}) {
  const cur = _storyPhaseGet();
  const next = Math.max(cur, Math.floor(Number(target) || 0));
  if (next === cur) return false;
  await game.settings.set(MOD_ID, SETTING_STORY_PHASE, next);
  const floors = PHASE_FLOORS[next];
  if (floors) {
    await _mutateDirectorState(async (st) => {
      st.stewardLevelFloor = Math.max(Number(st.stewardLevelFloor) || 0, floors.steward);
      st.factionTierFloor = Math.max(Number(st.factionTierFloor) || 0, floors.faction);
    });
    try { await directorReconcileLevels({ reason: `phase ${next}` }); } catch (eR) { warn("[phase] reconcileLevels failed:", eR); }
  }
  const nm = PHASE_NAMES[next] || `PHASE ${next}`;
  try {
    await ChatMessage.create({
      whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
      content: `<div class="bbttcc-phase-advance"><h3>🚦 ACT ${next} — ${nm}</h3>` +
        `<p>Story phase advanced (${via}).` +
        (floors ? ` Level floors raised: steward <b>${floors.steward}</b>, faction <b>T${floors.faction}</b>.` : "") +
        `</p></div>`
    });
  } catch (_e) {}
  return true;
}

async function _applyPhaseAdvance(campaign, beat) {
  const pa = beat?.worldEffects?.phaseAdvance;
  if (!pa || pa.set == null) return;
  await _storyPhaseAdvance(pa.set, { via: `beat “${beat.label || beat.id}”` });
}

// ---------------------------------------------------------------------------
// Tikkun Dividend (FINALE-WIN-COUPLING-2026-07-15.md v2): the arc-1 legacy
// meter. Earned ONLY by landmark outcome beats carrying
// worldEffects.tikkunDelta = { add: 1 } (Seal restored · Finale on friendly
// terms · Gloomgill passed). Read by the epic isHexAligned predicate, the
// leyline purity drift, and garrison integration upkeep — redemption's
// home-field advantage. Like storyPhase, it only ever RISES; arc-1 rungs cap
// at 3, TIKKUN_MAX leaves headroom for arc-2 rungs.
// ---------------------------------------------------------------------------
const SETTING_TIKKUN = "tikkunDividend";
const TIKKUN_MAX = 5;

function _tikkunGet() {
  try {
    return Math.max(0, Math.min(TIKKUN_MAX, Number(game.settings.get(MOD_ID, SETTING_TIKKUN)) || 0));
  } catch (_e) { return 0; }
}

async function _applyTikkunDelta(campaign, beat) {
  const add = Math.floor(Number(beat?.worldEffects?.tikkunDelta?.add) || 0);
  if (add <= 0) return;
  const cur = _tikkunGet();
  const next = Math.min(TIKKUN_MAX, cur + add);
  if (next === cur) return;
  await game.settings.set(MOD_ID, SETTING_TIKKUN, next);
  try {
    await ChatMessage.create({
      whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
      content: `<div class="bbttcc-phase-advance"><h3>✨ TIKKUN ×${next}</h3>` +
        `<p>The land remembers how this was done — <b>${beat.label || beat.id}</b>. ` +
        `Redemption comes easier: hexes count healed at darkness ≤ <b>${3 + next}</b>, ` +
        `integration runs <b>${15 * next}%</b> lighter.</p></div>`
    });
  } catch (_e) {}
}

// worldEffects.purifyHexes: ["Hex Name", ...] — anchor cascades: the story's
// landmark outcomes visibly heal the hexes the story touched (the Purified
// condition then spreads via the existing per-turn neighbor cleansing).
// Hex lookup is NBSP-safe by name across all scenes.
async function _applyPurifyHexes(campaign, beat) {
  const names = beat?.worldEffects?.purifyHexes;
  if (!Array.isArray(names) || !names.length) return;
  const setC = game.bbttcc?.api?.territory?.setCondition;
  if (typeof setC !== "function") { warn("purifyHexes: territory.setCondition unavailable"); return; }
  // NBSP-safe + decoration-safe: hex labels can grow a leading "✦ " when
  // claimed — strip leading non-letter marks so the name still matches.
  const normH = s => String(s || "").replace(/\s+/g, " ").trim()
    .replace(/^[^\p{L}\p{N}]+/u, "").trim().toLowerCase();
  const wanted = new Map(names.map(n => [normH(n), n]));
  for (const sc of game.scenes ?? []) {
    for (const dr of sc.drawings ?? []) {
      if (!wanted.size) return;
      const tf = dr.flags?.["bbttcc-territory"];
      if (!tf || !(tf.isHex === true || tf.kind === "territory-hex" || tf.hexId)) continue;
      const nm = normH(dr.text || tf.name);
      if (!wanted.has(nm)) continue;
      wanted.delete(nm);
      try { await setC(dr.uuid, "Purified", true); }
      catch (e) { warn(`purifyHexes: failed on "${nm}"`, e); }
    }
  }
  for (const [, orig] of wanted) warn(`purifyHexes: hex not found: "${orig}"`);
}

// Deed gate value: how many atlas hexes the coalition's factions hold.
// Cadence's opener uses { flag:"hexesClaimed", gte:2 } — the home hex counts
// as the first, so the first EXPANSION trips the wire.
function _hexesClaimedCount() {
  try {
    const cid = getActiveCampaignId();
    const camp = cid ? getCampaign(cid) : null;
    const fids = new Set((camp?.factionIds || []).map(String));
    if (!fids.size) return 0;
    let n = 0;
    for (const scene of game.scenes) {
      for (const dr of scene.drawings.contents) {
        const f = dr.flags?.["bbttcc-territory"];
        if (!f) continue;
        if (!(f.isHex === true || f.kind === "territory-hex" || f.hexId)) continue;
        if (fids.has(String(f.factionId || ""))) n++;
      }
    }
    return n;
  } catch (_e) { return 0; }
}

function _resolveGateValue(name) {
  switch (name) {
    case "wendigoRung": return _wendigoRungGet();
    case "storyPhase": return _storyPhaseGet();    // Phase Charter act ladder
    case "tikkunDividend": return _tikkunGet();    // arc-1 legacy meter (0–5)
    case "hexesClaimed": return _hexesClaimedCount(); // coalition-held hex count
    case "turn": return _getTurnNumberSafe();      // world turn — e.g. { flag:"turn", gte:6 }
    case "banditMercy": return _banditMeterGet(SETTING_BANDIT_MERCY);   // Bandit Accord mercy count
    case "banditFear":  return _banditMeterGet(SETTING_BANDIT_FEAR);    // Bandit Accord fear count
    case "cadenceRespect":     return _banditMeterGet(SETTING_CADENCE_RESPECT);     // Cadence: cameo owed
    case "cadenceTribute":     return _banditMeterGet(SETTING_CADENCE_TRIBUTE);     // Cadence: rematch standing
    case "cadenceUncontested": return _banditMeterGet(SETTING_CADENCE_UNCONTESTED); // Cadence: border show
    case "geburahEarned": return _banditMeterGet(SETTING_GEBURAH_EARNED);        // Geburah fragments taken by restraint (0-3)
    case "geburahForced": return _banditMeterGet(SETTING_GEBURAH_FORCED);        // Geburah fragments taken by force (0-3)
    case "chucklecreekSeen": return _banditMeterGet(SETTING_CHUCKLE_SEEN);       // Chuckle Creek indict rung (0-4)
    case "stillwaterCrack":  return _banditMeterGet(SETTING_STILLWATER_CRACK);   // Stillwater crack rung (0-4)
    case "softlandingGive":  return _banditMeterGet(SETTING_SOFTLANDING_GIVE);   // Soft Landing give rung (0-4)
    default: return null;            // unknown source — caller treats as unmet + warns
  }
}

const QUEST_GATE_BUCKETS = ["active", "completed", "archived"];

// The coalition's shared quest-progress track, read off the first resolved
// campaign faction. Returns the { active, completed, archived } buckets object,
// or null when the campaign has no resolvable faction (→ quest gates unmet).
// Deliberately does NOT catch: a throw rejects the memoized promise, reaches
// _beatRequiresMet's outer catch, and fails OPEN. Memoized per campaign object
// (listCampaigns builds fresh objects each injectorFire, so the WeakMap acts as
// a per-fire cache) so many quest-gated beats resolve the roster once.
const _questTrackMemo = new WeakMap();
function _coalitionQuestTrack(campaign, ctx) {
  if (!campaign || typeof campaign !== "object") return Promise.resolve(null);
  if (!_questTrackMemo.has(campaign)) {
    _questTrackMemo.set(campaign, (async () => {
      const factions = await _resolveCampaignFactions(campaign, ctx);
      const faction = factions[0];
      if (!faction || typeof faction.getFlag !== "function") return null;
      return faction.getFlag("bbttcc-factions", "quests") || {};
    })());
  }
  return _questTrackMemo.get(campaign);
}

async function _beatRequiresMet(beat, campaign, ctx) {
  try {
    const req = beat?.inject?.requires;
    if (!req) return true;                         // ungated → always eligible
    const conds = Array.isArray(req) ? req : [req];
    for (const c of conds) {
      if (!c || typeof c !== "object") continue;

      // { questBucket: "<questId>", is: "active"|"completed"|"archived" }
      // or the negation { questBucket, isNot: "<bucket>" } — true when the quest
      // is NOT in that bucket (e.g. "offer this until the quest is underway").
      if (c.questBucket != null) {
        const negated = c.is == null && c.isNot != null;
        const bucket = String((negated ? c.isNot : c.is) || "").trim();
        if (!QUEST_GATE_BUCKETS.includes(bucket)) {
          warn(`[inject.requires] questBucket condition on beat '${beat?.id}' has unknown bucket '${negated ? c.isNot : c.is}' — treating as unmet.`);
          return false;
        }
        const track = await _coalitionQuestTrack(campaign, ctx);
        if (!track) {
          warn(`[inject.requires] questBucket gate on beat '${beat?.id}' but the campaign has no resolvable faction — treating as unmet.`);
          return false;
        }
        const inBucket = !!track[bucket]?.[String(c.questBucket)];
        if (negated ? inBucket : !inBucket) return false;
        continue;
      }

      // { beatMark: "<beatId>", quest: "<questId>", state: "seen"|"completed" }
      if (c.beatMark != null) {
        const questId = String(c.quest || "").trim();
        const want = String(c.state || "seen").trim();
        if (!questId) {
          warn(`[inject.requires] beatMark condition on beat '${beat?.id}' is missing 'quest' — treating as unmet.`);
          return false;
        }
        if (want !== "seen" && want !== "completed") {
          warn(`[inject.requires] beatMark condition on beat '${beat?.id}' has unknown state '${c.state}' — treating as unmet.`);
          return false;
        }
        const track = await _coalitionQuestTrack(campaign, ctx);
        if (!track) {
          warn(`[inject.requires] beatMark gate on beat '${beat?.id}' but the campaign has no resolvable faction — treating as unmet.`);
          return false;
        }
        let entry = null;
        for (const bk of QUEST_GATE_BUCKETS) {
          entry = track[bk]?.[questId];
          if (entry) break;
        }
        const got = String(entry?.progress?.beats?.[String(c.beatMark)]?.state || "");
        const ok = (want === "seen") ? (got === "seen" || got === "completed") : (got === "completed");
        if (!ok) return false;
        continue;
      }

      // { flag: "<meter>", gte|lte|eq } — the original meter form
      const val = _resolveGateValue(c.flag);
      if (val === null) {
        warn(`[inject.requires] unknown gate source '${c.flag}' on beat '${beat?.id}' — treating as unmet.`);
        return false;
      }
      if (c.gte != null && !(val >= Number(c.gte))) return false;
      if (c.lte != null && !(val <= Number(c.lte))) return false;
      if (c.eq  != null && !(val === c.eq)) return false;
    }
    return true;                                   // all conditions held (AND)
  } catch (e) {
    warn("[inject.requires] eval failed (fail-open):", e);
    return true;
  }
}

// Per-condition gate report for GM consoles (2026-07-14, situation-console
// arc). Same three condition forms and the same met-semantics as
// _beatRequiresMet, but returns WHICH conditions hold instead of one bool:
//   { gated, met, conditions: [{ text, met, kind, current }] }
// Never throws; on evaluation error mirrors the evaluator's fail-open with
// { met:true, error:true }.
async function _beatGateReport(beat, campaign, ctx = {}) {
  const out = { gated: false, met: true, conditions: [], error: false };
  try {
    const req = beat?.inject?.requires;
    if (!req) return out;
    const conds = Array.isArray(req) ? req : [req];
    if (!conds.length) return out;
    out.gated = true;

    let questNames = {};
    try { questNames = getAllQuests() || {}; } catch (_e) {}
    const qName = (qid) => questNames[String(qid)]?.name || String(qid);

    for (const c of conds) {
      if (!c || typeof c !== "object") continue;

      if (c.questBucket != null) {
        const negated = c.is == null && c.isNot != null;
        const bucket = String((negated ? c.isNot : c.is) || "").trim();
        const text = `quest “${qName(c.questBucket)}” ${negated ? "not " : ""}${bucket || "?"}`;
        if (!QUEST_GATE_BUCKETS.includes(bucket)) {
          out.conditions.push({ text: text + " (unknown bucket)", met: false, kind: "questBucket" });
          out.met = false;
          continue;
        }
        const track = await _coalitionQuestTrack(campaign, ctx);
        const inBucket = !!track?.[bucket]?.[String(c.questBucket)];
        const ok = track ? (negated ? !inBucket : inBucket) : false;
        out.conditions.push({ text, met: ok, kind: "questBucket" });
        if (!ok) out.met = false;
        continue;
      }

      if (c.beatMark != null) {
        const questId = String(c.quest || "").trim();
        const want = String(c.state || "seen").trim();
        const text = `beat “${String(c.beatMark)}” ${want}${questId ? ` (${qName(questId)})` : ""}`;
        if (!questId || (want !== "seen" && want !== "completed")) {
          out.conditions.push({ text: text + " (malformed)", met: false, kind: "beatMark" });
          out.met = false;
          continue;
        }
        const track = await _coalitionQuestTrack(campaign, ctx);
        let entry = null;
        for (const bk of QUEST_GATE_BUCKETS) { entry = track?.[bk]?.[questId]; if (entry) break; }
        const got = String(entry?.progress?.beats?.[String(c.beatMark)]?.state || "");
        const ok = (want === "seen") ? (got === "seen" || got === "completed") : (got === "completed");
        out.conditions.push({ text, met: ok, kind: "beatMark", current: got || "(unseen)" });
        if (!ok) out.met = false;
        continue;
      }

      const val = _resolveGateValue(c.flag);
      const op = c.gte != null ? `≥ ${c.gte}` : c.lte != null ? `≤ ${c.lte}` : c.eq != null ? `= ${c.eq}` : "?";
      const text = `${String(c.flag)} ${op}`;
      if (val === null) {
        out.conditions.push({ text: text + " (unknown meter)", met: false, kind: "flag" });
        out.met = false;
        continue;
      }
      let ok = true;
      if (c.gte != null && !(val >= Number(c.gte))) ok = false;
      if (c.lte != null && !(val <= Number(c.lte))) ok = false;
      if (c.eq  != null && !(val === c.eq)) ok = false;
      out.conditions.push({ text, met: ok, kind: "flag", current: val });
      if (!ok) out.met = false;
    }
    return out;
  } catch (e) {
    warn("[gateReport] eval failed (fail-open, matching _beatRequiresMet):", e);
    out.met = true;
    out.error = true;
    return out;
  }
}

async function injectorFire(ctx = {}) {
  const {
    campaignId = null,
    tags = "",
    hexUuid = null,
    allowMulti = false,
    maxFire = 2,
    oncePerHexGlobal = false,

    // Auto-debt
    autoDebt = true,
    autoDebtWindow = 50,
    autoDebtThreshold = 2,

    // GM prompt
    promptDebt = true,

    // NEW: fallback behavior
    fallbackOnDecline = false
  } = ctx;

  const ctxTags = _splitTags(tags);
  const all = listCampaigns();
  const campaigns = campaignId ? all.filter(c => c.id === campaignId) : all;

  const turn = _getTurnNumberSafe();
  const state = _readInjectState();

  if (oncePerHexGlobal && hexUuid) {
    const gk = _globalHexGateKey(campaignId, hexUuid);
    if (state[gk]) {
      log("Injector: global once-per-hex gate tripped", { campaignId, hexUuid });
      return { fired: [], reason: "global_once_per_hex" };
    }
  }

  // AutoDebt (threshold gating for "debt")
  if (autoDebt) {
    const actor = _resolveDebtAnchorActor(ctx);
    const debtCount = _countDebtMarkersInWarLogs(actor, autoDebtWindow);

    if (debtCount > 0) {
      const dtag = `debt:${debtCount}`;
      if (!ctxTags.includes(dtag)) ctxTags.push(dtag);

      const threshold = Math.max(1, Number(autoDebtThreshold) || 2);
      const enabled = debtCount >= threshold;

      if (enabled && !ctxTags.includes("debt")) ctxTags.push("debt");

      log("Injector: autoDebt detected", {
        actor: actor?.name,
        debtCount,
        threshold,
        enabledDebtTag: enabled,
        addedTags: enabled ? ["debt", dtag] : [dtag]
      });
    }
  }

  // Build candidates
  const candidates = [];
  const dstate = _readDirectorState();
  for (const c of campaigns) {
    const beats = Array.isArray(c.beats) ? c.beats : [];
    // Phase 4 foreshadow: chains "in motion" (any story beat already fired) —
    // vignettes tagged foreshadow.<chain> score higher once their chain lives.
    const chainsInMotion = new Set(
      _storyBeatsFor(c).filter(sb => dstate.firedStoryBeats[sb.id]).map(_storyChainOf).filter(Boolean)
    );
    for (const b of beats) {
      const inject = b.inject || {};
      if (!_matchesTravelThreshold(b)) continue;
      if (!(await _beatRequiresMet(b, c, ctx))) continue;   // Story Director gate (inject.requires)

      if (inject.oncePerHex && hexUuid) {
        const k = _injectKeyFor(b, { campaignId: c.id, hexUuid });
        if (state[k]) continue;
      }

      const cd = Number(inject.cooldownTurns || 0) || 0;
      if (cd > 0) {
        const ck = _cooldownKeyFor(b, { campaignId: c.id });
        const lastTurn = Number(state[ck] || 0) || 0;
        if (turn > 0 && (turn - lastTurn) < cd) continue;
      }

      let score = _scoreBeat(b, ctxTags);
      if (score <= 0) continue;

      // Foreshadow bonus: this vignette plants a clue for a chain that's in motion.
      for (const t of _splitTags(b.tags)) {
        if (t.indexOf("foreshadow.") === 0 && chainsInMotion.has(t.slice("foreshadow.".length))) {
          score += 15;
          break;
        }
      }

      candidates.push({ campaignId: c.id, beatId: b.id, score, beat: b });
    }
  }

  if (!candidates.length) {
    log("Injector: no eligible beats", { campaignId, hexUuid, tags, ctxTags });
    return { fired: [], reason: "no_candidates" };
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return `${a.campaignId}:${a.beatId}`.localeCompare(`${b.campaignId}:${b.beatId}`);
  });

  const want = allowMulti ? Math.max(1, Number(maxFire || 2)) : 1;

  const finalPicks = [];
  const declinedBeatIds = new Set();

  for (const cand of candidates) {
    if (finalPicks.length >= want) break;
    if (declinedBeatIds.has(cand.beatId)) continue;

    if (promptDebt && hexUuid && _isDebtishBeat(cand.beat)) {
      const dk = _declineHexGateKey(campaignId, hexUuid);
      const alreadyDeclinedHere = !!state[dk];

      if (alreadyDeclinedHere) {
        if (fallbackOnDecline) continue;
        return { fired: [], reason: "gm_declined_or_skipped" };
      }

      const ok = await _gmPromptDebtBeat({
        campaignId: cand.campaignId,
        beatId: cand.beatId,
        beatLabel: cand.beat?.label,
        hexUuid
      });

      if (!ok) {
        state[dk] = { turn, ts: Date.now(), beatId: cand.beatId };
        declinedBeatIds.add(cand.beatId);
        log("Injector: GM declined debt beat", { campaignId: cand.campaignId, beatId: cand.beatId, hexUuid });

        if (fallbackOnDecline) continue;
        return { fired: [], reason: "gm_declined_or_skipped" };
      }
    }

    finalPicks.push(cand);
  }

  if (!finalPicks.length) {
    await _writeInjectState(state);
    return { fired: [], reason: "gm_declined_or_skipped" };
  }

  for (const pick of finalPicks) {
    const inject = pick.beat.inject || {};
    if (inject.oncePerHex && hexUuid) {
      const k = _injectKeyFor(pick.beat, { campaignId: pick.campaignId, hexUuid });
      state[k] = { turn, ts: Date.now() };
    }
    const cd = Number(inject.cooldownTurns || 0) || 0;
    if (cd > 0) {
      const ck = _cooldownKeyFor(pick.beat, { campaignId: pick.campaignId });
      state[ck] = turn || 0;
    }
  }

  if (oncePerHexGlobal && hexUuid) {
    const gk = _globalHexGateKey(campaignId, hexUuid);
    state[gk] = { turn, ts: Date.now() };
  }

  await _writeInjectState(state);

  log("Injector: firing beats", {
    allowMulti,
    picks: finalPicks.map(s => ({ campaignId: s.campaignId, beatId: s.beatId, score: s.score })),
    oncePerHexGlobal: !!oncePerHexGlobal,
    fallbackOnDecline: !!fallbackOnDecline
  });

  for (const pick of finalPicks) {
    await runBeat(pick.campaignId, pick.beatId);
  }

  return { fired: finalPicks.map(s => ({ campaignId: s.campaignId, beatId: s.beatId, score: s.score })) };
}

// Hook listeners
function installInjectorHooks() {
  const handler = async (ctx = {}) => {
    try {
      const tags = Array.isArray(ctx?.tags) ? ctx.tags.join(" ") : (ctx?.tags || "");
      await injectorFire({ ...ctx, tags });
    } catch (e) {
      warn("Injector hook handler failed:", e);
    }
  };

  Hooks.on("trigger.travel_threshold", handler);
  Hooks.on("bbttcc:travel_threshold", handler);
  Hooks.on("bbttcc.travel_threshold", handler);

  log("Injector hooks installed (trigger.travel_threshold / bbttcc:travel_threshold / bbttcc.travel_threshold).");
}

// ═══ STORY DIRECTOR (Phase 3) — chain registry + World-Turn tick + level cadence ═══
//
// The director is the loop that fires authored main-story beats at the right
// cadence amid free hex play. Phase 3 = the World-Turn tick: every APPLIED turn
// advance, look at the active campaign's STORY beats (any beat carrying a
// `storyChain` field), keep the ones whose `inject.requires` gate passes
// (quest-aware since Phase 2), and offer the highest-priority one to the GM
// (veto prompt) — at most ONE story beat per world turn (the drip budget).
// Chains need no separate authoring surface: `storyChain` groups beats, the
// beats array order is the in-chain order, and inter-chain dependencies are
// just gates. Phase 4 adds PRESSURE + mid-turn seams (travel legs, raid
// rounds, resolved beats) and foreshadow-tag scoring — see the pressure
// section below the chains view.
//
// LEVEL CADENCE rides the same organ. A milestone beat may carry
//   worldEffects.levelEffects = { stewardLevelFloor: N, factionTierFloor: T }
// Floors are MONOTONIC (only ever rise) and stored in directorState. Reconcile
// raises whoever is below the floor: stewards get a public Level-Up chat card
// whose button runs the fourththing level-up wizard (the engine guarantees the
// level; the player keeps the choices — click again while still below floor);
// coalition factions are raised directly to the tier floor (guided-campaign
// bypass of the reach/stability/identity gates, owner-locked 2026-07-01) with
// OP caps lifted to the tier band. Reconcile re-runs on every turn tick so
// late joiners and reincarnated stewards snap back onto the curve.
// Owner-locked cadence ladder: one TIER per campaign arc — Valhaulan arc ends
// at L6/T2, then L11/T3, L16/T4, L18+ epic gate.

function _readDirectorState() {
  try {
    const s = game.settings.get(MOD_ID, SETTING_DIRECTOR_STATE);
    const o = (s && typeof s === "object") ? foundry.utils.deepClone(s) : {};
    o.firedStoryBeats = (o.firedStoryBeats && typeof o.firedStoryBeats === "object") ? o.firedStoryBeats : {};
    o.dialogueFired = (o.dialogueFired && typeof o.dialogueFired === "object") ? o.dialogueFired : {};
    o.invited = (o.invited && typeof o.invited === "object") ? o.invited : {};
    o.levelPrompts = (o.levelPrompts && typeof o.levelPrompts === "object") ? o.levelPrompts : {};
    o.lastStoryTurn = Number(o.lastStoryTurn) || 0;
    o.stewardLevelFloor = Number(o.stewardLevelFloor) || 0;
    o.factionTierFloor = Number(o.factionTierFloor) || 0;
    o.pressure = Math.max(0, Number(o.pressure) || 0);
    return o;
  } catch (e) {
    return { firedStoryBeats: {}, dialogueFired: {}, invited: {}, levelPrompts: {}, lastStoryTurn: 0, stewardLevelFloor: 0, factionTierFloor: 0, pressure: 0 };
  }
}
async function _writeDirectorState(state) {
  await game.settings.set(MOD_ID, SETTING_DIRECTOR_STATE, state || {});
  return state || {};
}

// ALL directorState mutations flow through this serialized queue. Multiple
// listeners write concurrently off the same event (pressure accrual on
// beat:resolved vs dialogue-consumption marks vs tick fires) and bare
// read-modify-writes lose updates — live-caught 2026-07-02: a pressure write
// clobbered a dialogueFired mark, which could re-offer a consumed one-shot
// dialogue moment. The mutator receives the fresh state and edits in place.
let _directorStateQueue = Promise.resolve();
function _mutateDirectorState(mutator) {
  const p = _directorStateQueue.then(async () => {
    const state = _readDirectorState();
    await mutator(state);
    await _writeDirectorState(state);
    return state;
  });
  _directorStateQueue = p.catch(() => {});
  return p;
}

function _storyBeatsFor(campaign) {
  const beats = Array.isArray(campaign?.beats) ? campaign.beats : [];
  return beats.filter(b => b && (b.storyChain || b.inject?.storyChain));
}
function _storyChainOf(beat) {
  return String(beat?.storyChain || beat?.inject?.storyChain || "").trim() || null;
}
function _storyPriorityRank(beat) {
  const p = String(beat?.priority || beat?.inject?.priority || "normal").trim();
  if (p === "high") return 0;
  if (p === "background") return 2;
  return 1;
}

// GM veto prompt — the director PROPOSES, the GM decides (mirror of the debt
// prompt). Declining does NOT mark the beat fired; it is offered again on a
// later tick while its gate still holds.
async function _gmPromptStoryBeat(beat, turn, eligibleCount) {
  return new Promise((resolve) => {
    const chain = _storyChainOf(beat);
    const content = `
      <p><b>Story Director</b> — Turn ${turn}: conditions are right for a story beat.</p>
      <p style="margin:4px 0"><b>${beat?.label || beat?.id}</b>${chain ? ` <span style="opacity:.7">(chain: ${chain})</span>` : ""}</p>
      ${_ledgerOfferPriceLine(beat)}
      ${eligibleCount > 1 ? `<p style="opacity:.7;font-size:.9em">${eligibleCount - 1} other story beat(s) also eligible — highest priority offered first.</p>` : ""}
      <p style="opacity:.8;font-size:.9em">Fire it now? (Declining keeps it eligible for a later turn.)</p>
    `;
    new Dialog({
      title: "Bad Eden: Story Director",
      content,
      buttons: {
        run:     { icon: '<i class="fas fa-play"></i>', label: "Fire",    callback: () => resolve(true) },
        decline: { icon: '<i class="fas fa-clock"></i>', label: "Not now", callback: () => resolve(false) }
      },
      default: "run",
      close: () => resolve(false)
    }).render(true);
  });
}

// The director tick. Runs GM-side on every APPLIED world-turn advance (also
// callable manually via game.bbttcc.api.campaign.director.tick()).
// opts: { turn?, force? (ignore the per-turn budget), silent? (skip GM prompt) }
async function directorTick(opts = {}) {
  try {
    if (!game.user?.isGM) return { fired: null, reason: "not_gm" };
    let enabled = true;
    try { enabled = !!game.settings.get(MOD_ID, SETTING_DIRECTOR_ENABLED); } catch (_e) {}
    if (!enabled) return { fired: null, reason: "disabled" };

    const turn = Number(opts.turn) || _getTurnNumberSafe();
    const state = _readDirectorState();
    if (!opts.force && turn > 0 && state.lastStoryTurn === turn)
      return { fired: null, reason: "budget_spent", turn };

    const campaignId = getActiveCampaignId();
    const campaign = campaignId ? getCampaign(campaignId) : null;
    if (!campaign) return { fired: null, reason: "no_active_campaign" };

    const story = _storyBeatsFor(campaign);
    if (!story.length) return { fired: null, reason: "no_story_beats", turn };

    // Seam-excluded chains (interleave doctrine): spine legs should land on
    // world-turn ticks so hex play breathes between them — a mid-turn seam
    // (travel / raid round / beat:resolved) must not fire the next leg the
    // instant the previous one completes. Gates stay the same; only TIMING
    // narrows. Configured as a CSV setting; default = the Valhaulan spine.
    let ttOnly = new Set();
    if (opts.seam) {
      try {
        ttOnly = new Set(String(game.settings.get(MOD_ID, SETTING_DIRECTOR_TTONLY_CHAINS) || "")
          .split(",").map(s => s.trim()).filter(Boolean));
      } catch (_e) {}
    }

    const candidates = [];
    for (const b of story) {
      if (opts.seam && ttOnly.has(_storyChainOf(b) || "")) continue;
      if (state.firedStoryBeats[b.id] && !b.inject?.repeatable) continue;
      // Location-anchored discovery beats (2026-08-23): tagged `discovery`
      // or hex-targeted — they fire when the party ARRIVES (travel hex_enter
      // injector), never by director offer. Without this the director was
      // suggesting Chuckle Creek's delight-open at Turn 1 of Act 0.
      if (b.targetHexUuid || /\bdiscovery\b/i.test(String(b.tags || ""))) continue;
      // Travel-leg beats (2026-08-24, canon: timeScale === "leg") belong to
      // the travel tables — the director offered "The Tent at the Edge of
      // Town" at the town gate on day one. Travel fires them, never offers.
      if (String(b.timeScale) === "leg") continue;
      const sid = String(b.speakerActorId || "").trim();
      if (sid) {
        // Speaker beats are conversations: consumed ones are done, invited
        // ones are already pointed at, and an OPEN dialogue window with that
        // NPC means the moment is live right now — the director stands down
        // and lets the conversation carry it.
        if (state.dialogueFired[b.id] && !b.inject?.repeatable) continue;
        if (state.invited[b.id]) continue;
        if (game.bbttcc?.mal?.npc?._apps?.has?.(sid)) { log(`[director] '${b.id}' suppressed — speaker in conversation.`); continue; }
      }
      if (!(await _beatRequiresMet(b, campaign, {}))) continue;
      candidates.push(b);
    }
    if (!candidates.length) return { fired: null, reason: "no_eligible", turn, storyBeats: story.length };

    // Highest priority wins; ties resolve by authored order (stable sort).
    const pick = candidates
      .map((b, i) => ({ b, i }))
      .sort((x, y) => (_storyPriorityRank(x.b) - _storyPriorityRank(y.b)) || (x.i - y.i))[0].b;

    // A speaker beat never fires as narration from the tick — the director
    // INVITES instead (owner-locked handoff doctrine): GM veto → public
    // "wants a word" card → the moment plays out through dialogue.enact.
    const pickSid = String(pick.speakerActorId || "").trim();
    if (pickSid) {
      const speaker = game.actors?.get?.(pickSid);
      if (speaker) {
        const okInvite = opts.silent ? true : await _gmPromptTalkInvite(pick, speaker, turn);
        if (!okInvite) {
          await _mutateDirectorState(s => { s.pressure = Math.floor(s.pressure / 2); });
          return { fired: null, reason: "gm_declined", offered: pick.id, turn };
        }
        await _mutateDirectorState(s => {
          s.invited[pick.id] = { turn, ts: Date.now(), via: "director" };
          s.lastStoryTurn = turn;     // an invitation IS this turn's story movement
          s.pressure = 0;
        });
        await _postTalkInvitation(speaker, [pick]);
        log(`[director] invitation posted for '${pick.id}' via ${speaker.name} on turn ${turn}.`);
        return { fired: null, invited: pick.id, speaker: speaker.name, turn };
      }
      // Speaker actor missing (deleted?) — fall through to a normal fire.
    }

    const ok = opts.silent ? true : await _gmPromptStoryBeat(pick, turn, candidates.length);
    // State writes go through the serialized mutate queue — the GM prompt can
    // stay open a long time while seam listeners accrue pressure concurrently.
    if (!ok) {
      await _mutateDirectorState(s => { s.pressure = Math.floor(s.pressure / 2); });   // back off, rebuild
      return { fired: null, reason: "gm_declined", offered: pick.id, turn };
    }

    await _mutateDirectorState(s => {
      s.firedStoryBeats[pick.id] = { turn, ts: Date.now() };
      s.lastStoryTurn = turn;
      s.pressure = 0;                                     // story landed — release
    });
    log(`[director] firing story beat '${pick.id}' (chain: ${_storyChainOf(pick) || "—"}) on turn ${turn}.`);
    await runBeat(campaignId, pick.id);
    return { fired: pick.id, chain: _storyChainOf(pick), turn };
  } catch (e) {
    warn("[director] tick failed:", e);
    return { fired: null, reason: "error", error: String(e?.message || e) };
  }
}

// GM inspection view: the chain registry, derived from the active campaign's
// story beats. Per chain: beats in authored order with fired/eligible status.
async function directorChains() {
  const campaignId = getActiveCampaignId();
  const campaign = campaignId ? getCampaign(campaignId) : null;
  if (!campaign) return {};
  const state = _readDirectorState();
  const out = {};
  for (const b of _storyBeatsFor(campaign)) {
    const chain = _storyChainOf(b) || "(unchained)";
    out[chain] = out[chain] || [];
    out[chain].push({
      beatId: b.id,
      label: b.label || b.id,
      priority: String(b.priority || b.inject?.priority || "normal"),
      fired: state.firedStoryBeats[b.id] || null,
      eligible: await _beatRequiresMet(b, campaign, {})
    });
  }
  return out;
}

// ── Pressure + mid-turn seams (Phase 4) ─────────────────────────────────────
// Pressure = TIMING, gates = ELIGIBILITY, kept strictly separate. Pressure
// accrues from play (turns, travel legs, raid rounds, resolved beats). The
// World-Turn tick always looks (heartbeat, budget-capped); the mid-turn seams
// below only wake the director when pressure has crossed the GM-configurable
// threshold — so story arrives in the flow of play when it's been building,
// instead of only at turn boundaries. Fire → pressure 0; decline → halved.

async function _directorAddPressure(n, source) {
  try {
    if (!game.user?.isGM) return 0;
    const amt = Number(n) || 0;
    if (!amt) return _readDirectorState().pressure;
    const state = await _mutateDirectorState(s => { s.pressure = Math.max(0, s.pressure + amt); });
    return state.pressure;
  } catch (e) {
    warn("[director] addPressure failed:", e);
    return 0;
  }
}

async function _directorSeamLook(source) {
  try {
    if (!game.user?.isGM) return;
    let enabled = true;
    try { enabled = !!game.settings.get(MOD_ID, SETTING_DIRECTOR_ENABLED); } catch (_e) {}
    if (!enabled) return;
    let threshold = 60;
    try { threshold = Number(game.settings.get(MOD_ID, SETTING_DIRECTOR_PRESSURE_THRESHOLD)) || 60; } catch (_e) {}
    const state = _readDirectorState();
    if (state.pressure < threshold) return;
    log(`[director] pressure ${state.pressure} >= ${threshold} at seam '${source}' — looking.`);
    await directorTick({ seam: source });   // budget, gates, GM veto still apply; turn-tick-only chains excluded
  } catch (e) {
    warn("[director] seam look failed:", e);
  }
}

// ── Level cadence ────────────────────────────────────────────────────────────

// Mirror of bbttcc-factions' raiseOpCapsToTierBand (module-private there).
// Explicit opCaps shadow tier-derived bands forever, so a tier raise must lift
// them; max()-only, never lowers; no explicit caps → derived path follows tier.
const _FT_OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
const _FT_CAP_BAND = [50, 70, 90, 110, 130];
async function _directorRaiseFactionOpCaps(actor, tier) {
  try {
    const t = Math.max(0, Math.min(4, Math.floor(Number(tier) || 0)));
    const band = _FT_CAP_BAND[t] ?? _FT_CAP_BAND[0];
    const raw = foundry.utils.getProperty(actor, "flags.bbttcc-factions.opCaps");
    if (!raw || typeof raw !== "object") return false;
    const next = {};
    let changed = false;
    for (const k of _FT_OP_KEYS) {
      const cur = Math.max(0, Math.floor(Number(raw[k]) || 0));
      next[k] = Math.max(cur, band);
      if (next[k] !== cur) changed = true;
    }
    if (!changed) return false;
    await actor.update({ "flags.bbttcc-factions.opCaps": next });
    return true;
  } catch (e) {
    warn("[director] opCaps raise failed for", actor?.name, e);
    return false;
  }
}

async function _postLevelUpCard(actor, fromLevel, floor, milestone) {
  const gap = floor - fromLevel;
  const content = `
    <div style="border:1px solid #7a5c2e;border-radius:6px;padding:8px 10px">
      <p style="margin:0 0 4px 0">🎉 <b>${actor.name}</b> — <b>Level Up!</b></p>
      ${milestone ? `<p style="margin:0 0 4px 0;opacity:.8">Milestone: <i>${milestone}</i></p>` : ""}
      <p style="margin:0 0 6px 0">Level ${fromLevel} → <b>${floor}</b>${gap > 1 ? ` (${gap} level-ups banked — click once per level)` : ""}</p>
      <button type="button" class="bbttcc-director-levelup" data-actor-id="${actor.id}" data-floor="${floor}">
        <i class="fas fa-angles-up"></i> Level Up
      </button>
    </div>`;
  await ChatMessage.create({ content, speaker: { alias: "Story Director" } });
}

async function _postFactionTierCard(lines, tierFloor, milestone) {
  const content = `
    <div style="border:1px solid #7a5c2e;border-radius:6px;padding:8px 10px">
      <p style="margin:0 0 4px 0">🏰 <b>Coalition grows in stature</b>${milestone ? ` — <i>${milestone}</i>` : ""}</p>
      <p style="margin:0">${lines.join("<br>")}</p>
      <p style="margin:4px 0 0 0;opacity:.8;font-size:.9em">OP pool ceilings raised to the Tier ${tierFloor} band.</p>
    </div>`;
  await ChatMessage.create({ content, speaker: { alias: "Story Director" } });
}

// Raise anyone below the stored floors. Stewards = each non-GM user's ASSIGNED
// character (the canonical "party" — assign characters in Player Configuration).
// One card per (steward, floor) — re-running is spam-free; opts.force re-posts.
// Factions = the active campaign's coalition roster.
async function directorReconcileLevels(opts = {}) {
  const out = { stewardsPrompted: [], factionsRaised: [] };
  try {
    if (!game.user?.isGM) return out;
    const state = _readDirectorState();
    const floor = state.stewardLevelFloor;
    const tierFloor = state.factionTierFloor;
    if (floor <= 1 && tierFloor <= 0) return out;
    const promptsToSet = {};

    if (floor > 1) {
      const seen = new Set();
      for (const user of game.users) {
        if (user.isGM) continue;
        const a = user.character;
        if (!a || a.type !== "character" || seen.has(a.id)) continue;
        seen.add(a.id);
        const sys = a.system?.system ?? a.system;
        const lvl = Number(sys?.details?.level ?? 1) || 1;
        if (lvl >= floor) continue;
        if (!opts.force && Number(state.levelPrompts[a.id]) >= floor) continue;
        promptsToSet[a.id] = floor;
        await _postLevelUpCard(a, lvl, floor, opts.milestone);
        out.stewardsPrompted.push(a.name);
      }
    }

    if (tierFloor > 0) {
      const campaignId = getActiveCampaignId();
      const campaign = opts.campaign || (campaignId ? getCampaign(campaignId) : null);
      const factions = campaign ? await _resolveCampaignFactions(campaign, opts.ctx || {}) : [];
      const lines = [];
      for (const f of factions) {
        const cur = Number(f.getFlag("bbttcc-factions", "tier") ?? 0) || 0;
        if (cur >= tierFloor) continue;
        await f.update({ "flags.bbttcc-factions.tier": tierFloor });
        await _directorRaiseFactionOpCaps(f, tierFloor);
        lines.push(`<b>${f.name}</b>: Tier ${cur} → <b>Tier ${tierFloor}</b>`);
        out.factionsRaised.push(`${f.name} T${cur}→T${tierFloor}`);
        log(`[director] faction '${f.name}' tier ${cur} → ${tierFloor} (cadence floor).`);
      }
      if (lines.length) await _postFactionTierCard(lines, tierFloor, opts.milestone);
    }

    if (Object.keys(promptsToSet).length) {
      await _mutateDirectorState(s => {
        for (const [id, f] of Object.entries(promptsToSet)) {
          s.levelPrompts[id] = Math.max(Number(s.levelPrompts[id]) || 0, f);
        }
      });
    }
  } catch (e) {
    warn("[director] reconcileLevels failed:", e);
  }
  return out;
}

// Beat-resolved subscriber: milestone beats raise the floors.
// worldEffects.levelEffects = { stewardLevelFloor?, factionTierFloor? }
async function _onBeatResolvedLevelEffects({ campaign, beat, ctx } = {}) {
  try {
    if (!game.user?.isGM) return;                 // only the GM writes world settings
    const fx = beat?.worldEffects?.levelEffects;
    if (!fx || typeof fx !== "object") return;
    let changed = false;
    const state = await _mutateDirectorState(s => {
      const lf = Math.floor(Number(fx.stewardLevelFloor) || 0);
      if (lf > s.stewardLevelFloor) { s.stewardLevelFloor = lf; changed = true; }
      const tf = Math.floor(Number(fx.factionTierFloor) || 0);
      if (tf > s.factionTierFloor) { s.factionTierFloor = tf; changed = true; }
    });
    if (!changed) return;
    log(`[director] level floors raised by beat '${beat?.id}': steward L${state.stewardLevelFloor}, faction T${state.factionTierFloor}.`);
    await directorReconcileLevels({ milestone: beat?.label || beat?.id, campaign, ctx });
  } catch (e) {
    warn("[director] levelEffects subscriber failed:", e);
  }
}

// Level-Up card button → the fourththing level-up wizard, on the CLICKING
// client (players own their steward; the wizard's choices are theirs). Same
// document-level delegation idiom as the beat-audio Play button.
let __bbttccDirectorLevelupDelegationInstalled = false;
function _installDirectorLevelupDelegation() {
  if (__bbttccDirectorLevelupDelegationInstalled) return;
  __bbttccDirectorLevelupDelegationInstalled = true;
  try {
    document.addEventListener("click", async (ev) => {
      try {
        const btn = ev.target?.closest?.(".bbttcc-director-levelup");
        if (!btn) return;
        ev.preventDefault();
        const actor = game.actors?.get(btn.dataset.actorId);
        if (!actor) return void ui.notifications?.warn("Steward not found.");
        if (!actor.isOwner) return void ui.notifications?.warn("Only this steward's owner (or a GM) can level them.");
        const floor = Number(btn.dataset.floor) || 0;
        const sysBefore = actor.system?.system ?? actor.system;
        const before = Number(sysBefore?.details?.level ?? 1) || 1;
        if (floor && before >= floor)
          return void ui.notifications?.info(`${actor.name} is already at the milestone level (L${before}).`);
        const levelUp = game.fourththing?._progression?.levelUp;
        if (typeof levelUp !== "function")
          return void ui.notifications?.error("Level-up wizard unavailable (fourththing progression API missing).");
        await levelUp(actor);
        const sysAfter = actor.system?.system ?? actor.system;
        const after = Number(sysAfter?.details?.level ?? before) || before;
        if (floor && after < floor)
          ui.notifications?.info(`${actor.name} is L${after} — ${floor - after} more level-up(s) banked. Click the button again.`);
      } catch (eH) {
        warn("[director] level-up button failed:", eH);
      }
    }, { capture: false });
  } catch (_e) {}
}

// ═══ DIALOGUE-DRIVEN BEATS (mal-voice contract) ══════════════════════════════
//
// Contract: badeden-bible/new-content/dialogue-driven-beats-spec.md.
// Beat choices surface through natural NPC conversation (bbttcc-mal-voice):
// a beat may carry `speakerActorId` — the actor who EMBODIES its choices. The
// dialogue engine queries choicesFor(actorId) each send; when the conversation
// naturally reaches the decision and a Steward commits, it calls enact(), which
// runs the SAME pipeline as picking that choice in the beat dialog. Dialogue is
// the surface; the director stays the spine — the tool enum is closed, nothing
// fires without enact, and the menu path remains fully functional.
//
// Offerability = all existing director gating (inject.requires incl. quest
// buckets/marks/isNot, cooldownTurns, oncePerHex when ctx.hexUuid given, story
// fired-once) PLUS one-shot consumption: a speaker beat that has resolved (any
// surface — menu, travel, dialogue) is not re-offered unless inject.repeatable.
// Authoring pattern: repeatable hubs consume via quest-state gates ("Delay"
// keeps the moment open; sealing the deal completes the quest and closes it);
// one-shot moral moments consume on first resolution.
//
// NPC event memory: whenever a beat with speakerActorId resolves, a plain-text
// line (authorable `beat.memoryText`, else generated from label + chosen
// choice) is appended to the actor's flags["bbttcc-mal-voice"].memories
// ({ts, text}, cap 30) — how Mara remembers the Leygate handoff when she later
// calls about Pip, whichever surface it happened on.

const SPEAKER_MEMORY_CAP = 30;

// All beats the given actor currently embodies AND may offer. Shared by
// choicesFor (query) and enact (guardrail re-verification).
async function _dialogueOfferableBeats(actorId, ctx = {}) {
  const out = [];
  const aid = String(actorId || "").trim();
  if (!aid) return out;
  const campaignId = getActiveCampaignId();
  const campaign = campaignId ? getCampaign(campaignId) : null;
  if (!campaign) return out;
  const state = _readDirectorState();
  const injState = _readInjectState();
  const turn = _getTurnNumberSafe();
  for (const b of (Array.isArray(campaign.beats) ? campaign.beats : [])) {
    if (!b || String(b.speakerActorId || "").trim() !== aid) continue;
    // A speaker beat with NO labeled choices is a memory-carrier (outcome
    // beats wear speakerActorId so the NPC remembers when they resolve) —
    // it is never a conversation moment: nothing to offer, nothing to
    // enact, and the invite scan must not announce it.
    if (!(b.choices || []).some(ch => String(ch?.label || "").trim())) continue;
    // Authored opt-out: outcome/routing nodes that DO carry choices (bounce-
    // backs like "Try something else", vestigial "Leave") but must only be
    // reached by routing, never offered as a conversation entry.
    if (b.dialogueOffer === false) continue;
    const repeatable = !!b.inject?.repeatable;
    if (!repeatable && (state.dialogueFired[b.id] || (b.storyChain && state.firedStoryBeats[b.id]))) continue;
    const cd = Number(b.inject?.cooldownTurns || 0) || 0;
    if (cd > 0) {
      const ck = _cooldownKeyFor(b, { campaignId: campaign.id });
      const lastTurn = Number(injState[ck] || 0) || 0;
      if (turn > 0 && (turn - lastTurn) < cd) continue;
    }
    if (b.inject?.oncePerHex && ctx.hexUuid) {
      const k = _injectKeyFor(b, { campaignId: campaign.id, hexUuid: ctx.hexUuid });
      if (injState[k]) continue;
    }
    if (!(await _beatRequiresMet(b, campaign, ctx))) continue;
    out.push({ campaign, beat: b });
  }
  return out;
}

// Query API (contract §2): the choices currently offerable through this NPC.
// Empty array = no live story moments (the dialogue engine omits the tool).
async function dialogueChoicesFor(actorId, ctx = {}) {
  try {
    const stripHtml = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const rows = [];
    for (const { beat } of await _dialogueOfferableBeats(actorId, ctx)) {
      const choices = Array.isArray(beat.choices) ? beat.choices : [];
      // The beat's description is the NPC's authored script for the scene —
      // the dialogue engine plays it in-voice when the conversation arrives.
      const beatDescription = stripHtml(beat.description);
      choices.forEach((ch, i) => {
        const label = String(ch?.label || "").trim();
        if (!label) return;
        rows.push({
          beatId: beat.id,
          beatLabel: beat.label || beat.id,
          beatDescription,
          choiceIndex: i,
          choiceKey: `${beat.id}:${i}`,
          label,
          description: stripHtml(ch?.description)
        });
      });
    }
    return rows;
  } catch (e) {
    warn("[dialogue] choicesFor failed:", e);
    return [];
  }
}

// The distilled choice-resolution semantics of the beat dialog's pick handler
// (GM adjudication / auto roll / OP gate + spend / route to next), with no UI.
// Reuses the exact same helpers; returns the dialog's finish(...) shape plus
// routedBeatId / error, and becomes the beat's `outcome` on bbttcc:beat:resolved.
async function _enactChoiceCore(campaign, beat, i, ctx = {}) {
  const choices = Array.isArray(beat.choices) ? beat.choices : [];
  const ch = choices[i];
  // e.g. a beat-entry redirect swapped in a beat whose choices don't line up —
  // fall out safely rather than firing an arbitrary choice.
  if (!ch) return { acted: false, error: "Choice " + i + " not found on beat '" + (beat?.id || "?") + "' (possibly redirected)." };
  const label = String(ch.label || `Choice ${i + 1}`);
  const factionId = ctx.factionId || beat.factionId || campaign.factionId || null;
  let faction = null;
  if (factionId) { try { faction = await _resolveFaction(factionId); } catch (_eF) {} }
  const rosterActorId = ctx.rosterActorId || null;
  const supportOpKey = String(ctx.supportOpKey || "").trim().toLowerCase();
  const supportSpend = _num(ctx.supportSpend, 0);

  if (_choiceHasCheck(ch)) {
    const statTxt0 = String(ch.checkStat || "").trim().toLowerCase();
    const isOp = statTxt0.indexOf("op.") === 0;
    const mode = String(ch.checkMode || "").trim().toLowerCase();

    // GM adjudication (explicit "gm" stat, or any non-OP check not marked auto)
    if (_isGMAdjudicatedChoice(ch) || (!isOp && mode !== "auto")) {
      const prompt = String((ch && (ch.checkPrompt || ch.prompt)) || "").trim();
      const dcTxt = (ch.checkDC != null && String(ch.checkDC).trim() !== "") ? String(_num(ch.checkDC, 0)) : "";
      const prettyStat = _choiceCheckLabel(String(ch.checkStat || "").trim() || "gm");
      const body =
        '<div style="font-weight:700;">' + _escapeHtml(label) + '</div>' +
        '<div style="opacity:.8;font-size:12px;margin-top:4px;">(committed in conversation — dialogue-driven beat)</div>' +
        (prompt ? '<div style="opacity:0.92;margin-top:6px;">' + _escapeHtml(prompt).replace(/\n/g, "<br/>") + '</div>' : '') +
        ((prettyStat || dcTxt)
          ? '<div style="opacity:0.9;font-size:12px;margin-top:6px;">' +
              (prettyStat ? '<b>Check:</b> ' + _escapeHtml(prettyStat) : '') +
              (dcTxt ? ((prettyStat ? '  -  ' : '') + '<b>Difficulty:</b> ' + _escapeHtml(dcTxt)) : '') +
            '</div>'
          : '');
      const ok = await _gmAdjudicate(label, body);
      const nextId = ok ? (ch.next || "") : (ch.failNext || beat.outcomes?.failure || "");
      if (nextId) await runBeat(campaign.id, nextId);
      return { acted: true, routed: !!nextId, routedBeatId: nextId || null, choiceIndex: i, choice: ch,
               check: { stat: String(ch.checkStat || "gm").trim().toLowerCase(), dc: _num(ch.checkDC, 0), ok: !!ok, kind: "gm" } };
    }

    // OP gating (1 OP to attempt) — mirror of the dialog handler
    if (isOp) {
      try {
        const opKey = String(statTxt0.split(".")[1] || "").trim().toLowerCase();
        if (faction && opKey) {
          const gate = _evalOpGateForKey(faction, opKey, ctx.allowDesperation !== false);
          if (!gate.ok) return { acted: false, error: "This action requires 1 " + _opKeyLabel(opKey) + " OP and the faction cannot pay." };
          if (gate.mode === "desperation") {
            const okD = await _confirmDesperation(opKey);
            if (!okD) return { acted: false, error: "Desperation spend declined by the GM." };
          }
          await _spendOneOpForAttempt(faction, opKey, "Campaign OP check: " + (beat.label || beat.id || ""));
        }
      } catch (_eG) {}
    }
    if (supportOpKey && supportSpend > 0 && faction) {
      const pool2 = _readOpBank(faction, supportOpKey);
      if (pool2 < supportSpend) return { acted: false, error: "Not enough " + _opKeyLabel(supportOpKey) + " OP for backing." };
      const okSpend2 = await _spendFactionOpSupport(faction, supportOpKey, supportSpend, "Faction backing: " + (beat.label || beat.id || ""));
      if (!okSpend2) return { acted: false, error: "Could not spend faction OP for backing." };
    }

    const res = await _rollChoiceCheck(ch, { factionId, rosterActorId, supportOpKey, supportSpend });
    try {
      ui.notifications?.info?.(`${label}: ${res.total}${res.kind === "op" ? ` (1d20 + ${res.bonus})` : ""} vs DC ${res.dc}  ->  ${res.ok ? "SUCCESS" : "FAIL"}`);
    } catch (_eN) {}
    const nextId = res.ok ? (ch.next || "") : (ch.failNext || beat.outcomes?.failure || "");
    if (nextId) await runBeat(campaign.id, nextId);
    return { acted: true, routed: !!nextId, routedBeatId: nextId || null, choiceIndex: i, choice: ch,
             check: { stat: res.stat, dc: res.dc, total: res.total, ok: res.ok, kind: res.kind, bonus: (res.bonus != null ? res.bonus : null) } };
  }

  // No check: route to next
  const nextId = ch.next || "";
  if (nextId) await runBeat(campaign.id, nextId);
  return { acted: true, routed: !!nextId, routedBeatId: nextId || null, choiceIndex: i, choice: ch };
}

// Execution API (contract §3): run a committed conversational choice through
// the real pipeline. Returns { ok, summary, error? } — `summary` is what the
// NPC's model reads back as the tool_result and narrates onward from.
async function dialogueEnact(opts = {}) {
  try {
    if (!game.user?.isGM) return { ok: false, error: "dialogue.enact must run on a GM client." };
    const beatId = String(opts.beatId || "").trim();
    const idx = Number(opts.choiceIndex);
    const speakerActorId = opts.speakerActorId != null ? String(opts.speakerActorId) : null;
    const userId = opts.userId != null ? String(opts.userId) : null;

    const campaignId = getActiveCampaignId();
    const campaign = campaignId ? getCampaign(campaignId) : null;
    if (!campaign) return { ok: false, error: "No active campaign." };
    const beat = (campaign.beats || []).find(b => b?.id === beatId);
    if (!beat) return { ok: false, error: "Beat '" + beatId + "' not found in the active campaign." };
    const choice = Array.isArray(beat.choices) ? beat.choices[idx] : null;
    if (!choice) return { ok: false, error: "Choice " + opts.choiceIndex + " not found on beat '" + beatId + "'." };
    if (speakerActorId && String(beat.speakerActorId || "") !== speakerActorId)
      return { ok: false, error: "That beat is not embodied by this speaker." };

    // Guardrail: re-verify the moment is STILL offerable (gates may have moved
    // since choicesFor; consumed moments must not fire twice).
    const offer = await _dialogueOfferableBeats(String(beat.speakerActorId || speakerActorId || ""), opts.ctx || {});
    if (!offer.some(o => o.beat.id === beatId))
      return { ok: false, error: "That story moment is no longer available." };

    log(`[dialogue] enacting ${beatId}:${idx}` + (speakerActorId ? ` via speaker ${speakerActorId}` : ""));
    const ctx = { ...(opts.ctx || {}), source: "dialogue", speakerActorId: beat.speakerActorId || speakerActorId || null, userId, __enactChoice: idx };
    await runBeat(campaign.id, beatId, ctx);
    const res = ctx.__enactResult || null;
    if (res && res.error) return { ok: false, error: res.error };
    if (!res || !res.acted) return { ok: false, error: "The choice did not resolve (see console)." };

    // Plain-text mechanical account for the NPC's model to narrate from.
    const routedBeat = res.routedBeatId
      ? (campaign.beats || []).find(b => b?.id === res.routedBeatId)
      : null;
    const routedLabel = routedBeat ? (routedBeat.label || routedBeat.id) : (res.routedBeatId || null);
    let summary = `The moment happens: "${String(choice.label || "").trim()}"`;
    if (res.check) {
      summary += res.check.kind === "gm"
        ? ` — the GM ruled it ${res.check.ok ? "a success" : "a failure"}`
        : ` — the check came up ${res.check.ok ? "a success" : "a failure"} (${res.check.total} vs DC ${res.check.dc})`;
    }
    summary += ".";
    if (routedLabel) summary += ` It leads on to "${routedLabel}".`;

    // The routed OUTCOME beat's description is the authored curtain call —
    // per-outcome closing scene (the reveal, the stinger, who exits where).
    // Play it: post it player-facing as narration, and hand its text to the
    // NPC's model so the in-window continuation mirrors the authored scene
    // instead of inventing its own ending.
    // Outcome stinger (intro-on-open doctrine): the routed beat's recording
    // plays AT the curtain call — the enact is its moment on the dialogue path.
    if (routedBeat) { try { await _maybePlayBeatAudio(routedBeat); } catch (_eA) {} }
    if (routedBeat && String(routedBeat.description || "").trim()) {
      try {
        await ChatMessage.create({
          speaker: { alias: "Bad Eden" },
          content: `<div class="bbttcc-narration" style="border-left:3px solid #b8974d;padding:.45em .6em;background:rgba(184,151,77,.08);">${routedBeat.description}</div>`
        });
      } catch (_eN) {}
      const plain = String(routedBeat.description).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (plain) summary += ` THE SCENE PLAYS OUT AS AUTHORED (deliver its substance in your own voice, then let the scene close): ${plain}`;
    }

    // GM log whisper (transcript excerpt when provided).
    try {
      const speakerName = (speakerActorId && game.actors?.get?.(speakerActorId)?.name) || beat.speakerActorId || "NPC";
      const tx = Array.isArray(opts.transcript) ? opts.transcript.join("<br>") : String(opts.transcript || "").trim();
      await ChatMessage.create({
        whisper: game.users.filter(u => u.isGM).map(u => u.id),
        content: `<b>🗣 Dialogue-driven beat enacted</b><br><b>${speakerName}</b> → "${beat.label || beat.id}" / choice "${String(choice.label || "").trim()}"<br><i>${summary}</i>` +
          (tx ? `<hr><span style="opacity:.8;font-size:.9em">${tx}</span>` : "")
      });
    } catch (_eW) {}

    try { Hooks.callAll("bbttcc:dialogue:choiceEnacted", { beatId, choiceIndex: idx, speakerActorId, userId }); } catch (_eH) {}
    return { ok: true, summary };
  } catch (e) {
    warn("[dialogue] enact failed:", e);
    return { ok: false, error: String(e?.message || e) };
  }
}

// Story-state snapshot (contract ADDENDUM, 2026-07-02): narrative time for the
// NPC knowledge layer. Live testing showed an NPC given her whole written story
// pushes future arcs (Pip's rescue on the first Fixit visit) — knowing what has
// NOT happened is load-bearing. Moments already respect time via choicesFor
// gates; this gives knowledge the same spine: mal-voice filters the chronicle
// sweep to FIRED beats, suppresses `unstarted` quests ("never allude"), and
// builds the "YOUR PRESENT MOMENT" persona section from the buckets.
// `unstarted` is campaign-scoped (quests the active campaign's beats reference,
// not the whole registry) — a suppression list, not a spoiler dump. archived
// counts as completed (it HAS happened). firedBeatIds = director fires +
// speaker-beat resolutions + per-beat quest progress marks (best available
// "actually fired" record). actorId reserved for per-NPC scoping later.
async function dialogueStoryStateFor(_actorId = null) {
  const empty = { turn: null, quests: { completed: [], active: [], unstarted: [] }, firedBeatIds: [] };
  try {
    const campaignId = getActiveCampaignId();
    const campaign = campaignId ? getCampaign(campaignId) : null;
    if (!campaign) return empty;

    const turnN = _getTurnNumberSafe();

    let reg = {};
    try { reg = getAllQuests() || {}; } catch (_eR) {}
    const row = (id) => ({ id, title: String(reg?.[id]?.name || id) });

    const track = (await _coalitionQuestTrack(campaign, {})) || {};
    const activeIds = Object.keys(track.active || {});
    const completedIds = [...Object.keys(track.completed || {}), ...Object.keys(track.archived || {})];
    const started = new Set([...activeIds, ...completedIds]);

    // Quests this campaign references: beats' questId + questEffects rows.
    const referenced = new Set();
    const beats = Array.isArray(campaign.beats) ? campaign.beats : [];
    for (const b of beats) {
      const qid = String(b?.questId || "").trim();
      if (qid) referenced.add(qid);
      for (const r of (Array.isArray(b?.worldEffects?.questEffects) ? b.worldEffects.questEffects : [])) {
        const q2 = String(r?.questId || "").trim();
        if (q2) referenced.add(q2);
      }
    }
    const unstartedIds = [...referenced].filter(id => !started.has(id));

    const state = _readDirectorState();
    const fired = new Set([...Object.keys(state.firedStoryBeats), ...Object.keys(state.dialogueFired)]);
    for (const bucket of ["active", "completed", "archived"]) {
      for (const entry of Object.values(track[bucket] || {})) {
        for (const bid of Object.keys(entry?.progress?.beats || {})) fired.add(bid);
      }
    }

    return {
      turn: turnN > 0 ? turnN : null,
      quests: {
        completed: completedIds.map(row),
        active: activeIds.map(row),
        unstarted: unstartedIds.map(row)
      },
      firedBeatIds: [...fired]
    };
  } catch (e) {
    warn("[dialogue] storyStateFor failed:", e);
    return empty;
  }
}

// NPC event memory (contract §4) + one-shot consumption. Fires for EVERY
// resolution surface (menu, travel, dialogue) so the NPC remembers regardless
// of how the moment happened. Serialized through one promise chain: a routed
// chain resolves several speaker beats back-to-back, and concurrent
// read-modify-writes of the memories flag / directorState would drop entries.
let _speakerMemoryChain = Promise.resolve();
function _onBeatResolvedSpeakerMemory({ beat, outcome } = {}) {
  try {
    if (!game.user?.isGM) return;
    const sid = String(beat?.speakerActorId || "").trim();
    if (!sid) return;
    _speakerMemoryChain = _speakerMemoryChain.then(async () => {
      // Consume the moment (unless the beat is authored repeatable).
      try {
        await _mutateDirectorState(s => {
          if (!s.dialogueFired[beat.id]) s.dialogueFired[beat.id] = { ts: Date.now() };
        });
      } catch (_eS) {}

      const actor = game.actors?.get?.(sid);
      if (!actor) return;
      let text = String(beat.memoryText || "").trim();
      if (!text) {
        const chLabel = String(outcome?.choice?.label || "").trim();
        text = `${beat.label || beat.id}${chLabel ? ` — the Stewards chose "${chLabel}"` : ""}.`;
      }
      const cur = foundry.utils.getProperty(actor, "flags.bbttcc-mal-voice.memories");
      const arr = Array.isArray(cur) ? cur.slice(-(SPEAKER_MEMORY_CAP - 1)) : [];
      arr.push({ ts: Date.now(), text });
      await actor.update({ "flags.bbttcc-mal-voice.memories": arr });
      log(`[dialogue] memory written for ${actor.name}: ${text}`);
    }).catch(e => warn("[dialogue] speaker memory failed:", e));
  } catch (e) {
    warn("[dialogue] speaker memory listener failed:", e);
  }
}

// ─── Surface reconciliation (2026-07-03 integration arc) ────────────────────
// Owner-locked doctrine: consumption is GLOBAL, offering is per-surface.
// (1) ANY surface firing a storyChain beat marks directorState.firedStoryBeats
//     — before this, only the director's own tick wrote it, so the director
//     was blind to GM menu/Console fires and could re-offer a played moment.
// (2) GM surfaces (Builder / Story Console / turn whisper) BADGE fired beats
//     and soft-confirm re-runs — never blocked; the base menu stays a full
//     fallback.
// (3) Speaker beats are conversations, not cinema: the director INVITES
//     ("Mara wants a word" chat card → Talk button) instead of narrating, and
//     stands down entirely while that NPC's dialogue window is open GM-side.

// Fired-state lookup shared by the badges/whisper/soft-locks.
function _beatFiredInfo(state, beatId) {
  const id = String(beatId || "").trim();
  if (!id) return null;
  const f = state?.firedStoryBeats?.[id];
  const d = state?.dialogueFired?.[id];
  if (!f && !d) return null;
  return { via: f ? "story" : "dialogue", turn: (f && f.turn) || null };
}

// (1) Unified fired-marking: every storyChain beat resolution lands in
// firedStoryBeats, whichever surface ran it. Idempotent — the director tick
// pre-marks its own fires before runBeat and this skips existing entries.
function _onBeatResolvedStoryMark({ beat } = {}) {
  try {
    if (!game.user?.isGM) return;
    if (!beat?.id || !_storyChainOf(beat)) return;
    _mutateDirectorState(s => {
      if (!s.firedStoryBeats[beat.id])
        s.firedStoryBeats[beat.id] = { turn: _getTurnNumberSafe(), ts: Date.now(), via: "resolved" };
    }).catch(e => warn("[director] story-mark failed:", e));
  } catch (e) { warn("[director] story-mark listener failed:", e); }
}

// (3) The invitation card — the narration→conversation handoff. Public,
// diegetic, opt-in: a Talk button opens the NPC's dialogue window on the
// clicking player's own client (mal-voice provides talkTo; the card degrades
// to a plain nudge without it). Authorable `beat.inviteText` replaces the
// default line.
async function _postTalkInvitation(actor, beats = []) {
  try {
    const esc = foundry.utils.escapeHTML;
    const first = Array.isArray(beats) ? beats[0] : beats;
    const inviteText = String(first?.inviteText || "").trim() || "wants a word.";
    await ChatMessage.create({
      speaker: { alias: "Bad Eden" },
      content: `<div class="bbttcc-talk-invite" style="border-left:3px solid #4db8b0;padding:.45em .6em;background:rgba(77,184,176,.08);">
        <img src="${esc(actor.img || "icons/svg/mystery-man.svg")}" style="width:28px;height:28px;object-fit:cover;border:1px solid #666;border-radius:4px;vertical-align:middle;margin-right:.4em;"/>
        <b>${esc(actor.name)}</b> ${esc(inviteText)}<br>
        <button type="button" data-bbttcc-talk="${esc(actor.id)}" style="width:auto;padding:.25em .8em;margin-top:.35em;">
          <i class="fa-solid fa-comments"></i> Talk to ${esc(actor.name)}</button>
      </div>`,
      flags: { [MOD_ID]: { talkInvite: { actorId: actor.id, beatIds: (Array.isArray(beats) ? beats : [beats]).map(b => b?.id).filter(Boolean) } } }
    });
  } catch (e) { warn("[dialogue] talk invitation failed:", e); }
}

function _bindTalkInviteButtons(message, root) {
  try {
    if (!root || !message?.getFlag?.(MOD_ID, "talkInvite")) return;
    for (const btn of root.querySelectorAll("[data-bbttcc-talk]")) {
      if (btn.dataset.bbttccBound) continue;   // v13 fires BOTH render hooks — bind once
      btn.dataset.bbttccBound = "1";
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        const talkTo = game.bbttcc?.mal?.npc?.talkTo;
        const actor = game.actors?.get?.(btn.dataset.bbttccTalk);
        if (!actor) return ui.notifications?.warn?.("That person is nowhere to be found.");
        if (typeof talkTo !== "function") return ui.notifications?.warn?.("NPC dialogue (bbttcc-mal-voice) is not available.");
        talkTo(actor);
      });
    }
  } catch (e) { warn("[dialogue] invite button bind failed:", e); }
}

// Talk buttons open the NPC dialogue window on the clicking user's own client
// (players and GM alike). Top-level registration so cards already in the chat
// log re-bind on reload; v13+ fires renderChatMessageHTML, older cores the
// jQuery renderChatMessage — bind both defensively.
Hooks.on("renderChatMessageHTML", (message, html) => { try { _bindTalkInviteButtons(message, html); } catch (_e) {} });
Hooks.on("renderChatMessage",     (message, html) => { try { _bindTalkInviteButtons(message, html?.[0] ?? html); } catch (_e) {} });

// (3c) Narrative handoff — "the way forward" card. Authored per beat:
//   beat.handoff = { beatId, focus?, text? }
// When one of THIS beat's moments is enacted through conversation, post a
// public card presenting the handoff beat's choices as curated doors —
// `focus` (a choice label) leads and is highlighted, `text` is the diegetic
// line ("Mara nods you toward the Arc Bay…"). Buttons run the chosen door's
// next beat via runBeat — GM-driven like every launch surface; players see
// the signpost. This is how a closed deal points at the next scene.
function _onDialogueChoiceEnactedHandoff({ beatId } = {}) {
  try {
    if (!game.user?.isGM) return;
    const campaignId = getActiveCampaignId();
    const campaign = campaignId ? getCampaign(campaignId) : null;
    if (!campaign) return;
    const beat = (campaign.beats || []).find(b => b?.id === beatId);
    const h = beat?.handoff;
    if (!h?.beatId) return;
    const hub = (campaign.beats || []).find(b => b?.id === String(h.beatId));
    if (!hub) return warn(`[dialogue] handoff target '${h.beatId}' not found`);
    const esc = foundry.utils.escapeHTML;
    const doors = (hub.choices || [])
      .map((ch, i) => ({ label: String(ch?.label || "").trim(), next: String(ch?.next || "").trim(), i }))
      .filter(d => d.label && d.next);
    if (!doors.length) return;
    const focus = String(h.focus || "").trim().toLowerCase();
    doors.sort((a, b) => (a.label.toLowerCase() === focus ? -1 : 0) - (b.label.toLowerCase() === focus ? -1 : 0));
    const btn = (d, lead) => `<button type="button" data-bbttcc-handoff="${esc(campaignId)}:${esc(d.next)}"
      style="width:auto;padding:.25em .8em;margin:.15em .25em 0 0;${lead ? "border-color:#4db8b0;box-shadow:0 0 4px rgba(77,184,176,.55);font-weight:bold;" : "opacity:.85;"}">
      ${lead ? '<i class="fa-solid fa-location-arrow"></i> ' : ""}${esc(d.label)}</button>`;
    ChatMessage.create({
      speaker: { alias: "Bad Eden" },
      content: `<div class="bbttcc-handoff" style="border-left:3px solid #4db8b0;padding:.45em .6em;background:rgba(77,184,176,.08);">
        <i>${esc(String(h.text || "The way forward:"))}</i><br>
        ${doors.map((d, idx) => btn(d, focus && idx === 0 && d.label.toLowerCase() === focus)).join("")}
      </div>`,
      flags: { [MOD_ID]: { handoffCard: { beatId: beat.id, hubId: hub.id } } }
    }).catch(e => warn("[dialogue] handoff card failed:", e));
  } catch (e) { warn("[dialogue] handoff listener failed:", e); }
}
Hooks.on("bbttcc:dialogue:choiceEnacted", _onDialogueChoiceEnactedHandoff);

function _bindHandoffButtons(message, root) {
  try {
    if (!root || !message?.getFlag?.(MOD_ID, "handoffCard")) return;
    for (const btn of root.querySelectorAll("[data-bbttcc-handoff]")) {
      if (btn.dataset.bbttccBound) continue;   // v13 fires BOTH render hooks — bind once
      btn.dataset.bbttccBound = "1";
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        if (!game.user.isGM) return ui.notifications?.info?.("The way opens when the GM leads on.");
        const [cid, target] = String(btn.dataset.bbttccHandoff).split(":");
        if (cid && target) runBeat(cid, target);
      });
    }
    // Scene doors: activate the beat's scene + narrate its description —
    // the party MOVES, but the beat does not resolve and no menu opens
    // (the moment stays alive in the conversation).
    for (const btn of root.querySelectorAll("[data-bbttcc-scenedoor]")) {
      if (btn.dataset.bbttccBound) continue;   // v13 fires BOTH render hooks — bind once
      btn.dataset.bbttccBound = "1";
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        if (!game.user.isGM) return ui.notifications?.info?.("The way opens when the GM leads on.");
        try {
          const beatId = String(btn.dataset.bbttccScenedoor || "");
          const campaign = getCampaign(getActiveCampaignId());
          const beat = (campaign?.beats || []).find(b => b?.id === beatId);
          if (!beat) return ui.notifications?.warn?.("That way has closed (beat not found).");
          const sid = String(beat.sceneId || beat.refs?.sceneId || "").replace(/^Scene\./, "");
          const scene = sid ? game.scenes?.get?.(sid) : null;
          if (scene && !scene.active) await scene.activate();
          const desc = String(beat.description || "").trim();
          if (desc) await ChatMessage.create({
            speaker: { alias: "Bad Eden" },
            content: `<div class="bbttcc-narration" style="border-left:3px solid #b8974d;padding:.45em .6em;background:rgba(184,151,77,.08);">${desc}</div>`
          });
        } catch (e) { warn("[dialogue] scene door failed:", e); }
      });
    }
  } catch (e) { warn("[dialogue] handoff button bind failed:", e); }
}
Hooks.on("renderChatMessageHTML", (message, html) => { try { _bindHandoffButtons(message, html); } catch (_e) {} });
Hooks.on("renderChatMessage",     (message, html) => { try { _bindHandoffButtons(message, html?.[0] ?? html); } catch (_e) {} });

// (3d) Mid-conversation doors — point_the_way. The fiction moves before the
// enact does ("she leads him back through the crates…") and the WORLD must
// be able to follow. Doors an NPC can open right now = each offerable
// moment's own SCENE (beat.sceneId — "take them there") + its handoff hub's
// choices. The dialogue engine offers these as a closed-enum tool; calling
// it posts a public signpost card. GM clicks the door: scene doors ACTIVATE
// the beat's scene + narrate its description (no beat resolution, no menu —
// the moment stays in the conversation); run doors fire runBeat as usual.
async function dialogueDoorsFor(actorId, ctx = {}) {
  try {
    const doors = [];
    const seen = new Set();
    const campaignId = getActiveCampaignId();
    const campaign = campaignId ? getCampaign(campaignId) : null;
    for (const { beat } of await _dialogueOfferableBeats(actorId, ctx)) {
      const sid = String(beat.sceneId || beat.refs?.sceneId || "").trim();
      if (sid && !seen.has(`scene:${beat.id}`)) {
        seen.add(`scene:${beat.id}`);
        doors.push({ key: `scene:${beat.id}`, label: String(beat.label || beat.id), kind: "scene" });
      }
      const h = beat.handoff;
      if (h?.beatId && campaign) {
        const hub = (campaign.beats || []).find(b => b?.id === String(h.beatId));
        for (const ch of (hub?.choices || [])) {
          const label = String(ch?.label || "").trim();
          const next = String(ch?.next || "").trim();
          if (!label || !next || seen.has(`run:${next}`)) continue;
          seen.add(`run:${next}`);
          doors.push({ key: `run:${next}`, label, kind: "run" });
        }
      }
    }
    // PERSON doors — the baton pass. Other NPCs who hold live story moments
    // AND have a token in the active scene ("she's right there") become
    // doors too: "I'll walk you over" hands the conversation to them.
    try {
      const aid = String(actorId || "").trim();
      const sids = new Set((campaign?.beats || [])
        .filter(b => b && String(b.speakerActorId || "").trim() && String(b.speakerActorId).trim() !== aid)
        .map(b => String(b.speakerActorId).trim()));
      const present = new Set((game.scenes?.active?.tokens ?? []).map(t => t.actorId).filter(Boolean));
      for (const sid of sids) {
        if (!present.has(sid) || seen.has(`talk:${sid}`)) continue;
        const other = game.actors?.get?.(sid);
        if (!other) continue;
        const offerable = await _dialogueOfferableBeats(sid, {});
        if (!offerable.length) continue;
        seen.add(`talk:${sid}`);
        doors.push({ key: `talk:${sid}`, label: `Hand them to ${other.name}`, kind: "talk" });
      }
    } catch (_eP) { /* scene/token data unavailable — place+run doors still work */ }
    return doors;
  } catch (e) { warn("[dialogue] doorsFor failed:", e); return []; }
}

async function dialoguePointTheWay({ actorId, doorKey, line, transcript } = {}) {
  try {
    const doors = await dialogueDoorsFor(actorId, {});
    const door = doors.find(d => String(d.key) === String(doorKey || ""));
    if (!door) return { ok: false, error: "no such door" };
    const actor = game.actors?.get?.(String(actorId || ""));
    const esc = foundry.utils.escapeHTML;

    // Person door — the baton pass: open the target NPC's conversation on
    // this client right away (the talk continues), and post a Talk card so
    // the rest of the table can step in too.
    if (door.kind === "talk") {
      const target = game.actors?.get?.(door.key.slice(5));
      if (!target) return { ok: false, error: "that person is gone" };
      await ChatMessage.create({
        speaker: { alias: "Bad Eden" },
        content: `<div class="bbttcc-talk-invite" style="border-left:3px solid #4db8b0;padding:.45em .6em;background:rgba(77,184,176,.08);">
          <i>${esc(String(line || "").trim() || `${actor?.name || "Someone"} hands you to ${target.name}.`)}</i><br>
          <button type="button" data-bbttcc-talk="${esc(target.id)}" style="width:auto;padding:.25em .8em;margin-top:.3em;border-color:#4db8b0;box-shadow:0 0 4px rgba(77,184,176,.55);font-weight:bold;">
            <i class="fa-solid fa-comments"></i> Talk to ${esc(target.name)}</button>
        </div>`,
        flags: { [MOD_ID]: { talkInvite: { actorId: target.id, via: "pointTheWay" } } }
      });
      // The handed-to NPC speaks FIRST (nudge opens the window and feeds the
      // scene note); fall back to just opening the window if nudge is absent.
      try {
        const npcApi = game.bbttcc?.mal?.npc;
        if (npcApi?.nudge) {
          // Carry the scene across the baton pass: the handed-to NPC sees the
          // tail of the previous conversation as things they just witnessed.
          const tail = String(transcript || "").trim().slice(-1500);
          npcApi.nudge(target,
            `The Stewards have just been handed to you${actor ? ` by ${actor.name}` : ""}: "${String(line || "").trim() || "they're all yours"}".`
            + (tail ? `\nWhat just happened, which you witnessed or were just told (treat as known, react accordingly):\n${tail}` : ""))
            .catch?.(() => {});
        } else npcApi?.talkTo?.(target);
      } catch (_eT) {}
      return { ok: true, summary: `${target.name} now has the Stewards' attention — your part of the conversation winds down naturally.` };
    }

    const attr = door.kind === "scene"
      ? `data-bbttcc-scenedoor="${esc(door.key.slice(6))}"`
      : `data-bbttcc-handoff="${esc(getActiveCampaignId())}:${esc(door.key.slice(4))}"`;
    await ChatMessage.create({
      speaker: { alias: "Bad Eden" },
      content: `<div class="bbttcc-handoff" style="border-left:3px solid #4db8b0;padding:.45em .6em;background:rgba(77,184,176,.08);">
        <i>${esc(String(line || "").trim() || `${actor?.name || "Someone"} points the way.`)}</i><br>
        <button type="button" ${attr} style="width:auto;padding:.25em .8em;margin-top:.3em;border-color:#4db8b0;box-shadow:0 0 4px rgba(77,184,176,.55);font-weight:bold;">
          <i class="fa-solid fa-location-arrow"></i> ${esc(door.label)}</button>
      </div>`,
      flags: { [MOD_ID]: { handoffCard: { via: "pointTheWay", doorKey: door.key } } }
    });
    return { ok: true, summary: `The way to "${door.label}" now stands open before the Stewards — continue leading them in character.` };
  } catch (e) { warn("[dialogue] pointTheWay failed:", e); return { ok: false, error: String(e?.message || e) }; }
}

// ─── Situational NPC placement (2026-07-03) ─────────────────────────────────
// "The scenes consult the quest status to see where people should be."
// campaign.npcPlacements = [{ actorId, rules: [{ when: <requires conds>,
// sceneId | sceneName, x?, y?, hidden? }] }] — per NPC, ordered rules in the
// SAME gate vocabulary as beats (questBucket is/isNot, flags, beatMark);
// first matching rule wins; empty/absent `when` = always (the default spot).
// The engine reconciles the VIEWED scene on canvasReady and re-checks when
// beats resolve — so Miliard leaves the back room the moment the rite ends
// and is waiting at the Gullywasher when anyone next looks. Only actors
// listed in npcPlacements are ever touched. GM-side (token CRUD).

function _placementSceneId(rule) {
  const sid = String(rule?.sceneId || "").replace(/^Scene\./, "").trim();
  if (sid && game.scenes?.get?.(sid)) return sid;
  const name = String(rule?.sceneName || "").trim();
  if (name) {
    const s = game.scenes?.getName?.(name) || game.scenes?.contents?.find(x => x.name === name);
    if (s) return s.id;
  }
  return null;
}

async function _placementRuleMatches(rule, campaign) {
  const conds = rule?.when;
  if (!conds || (Array.isArray(conds) && !conds.length)) return true;   // default spot
  try { return await _beatRequiresMet({ id: "npc-placement", inject: { requires: conds } }, campaign, {}); }
  catch (_e) { return false; }
}

async function reconcileNpcPlacements({ sceneId = null, reason = "manual" } = {}) {
  try {
    if (!game.user?.isGM) return { ok: false, reason: "not_gm" };
    if (game.users?.activeGM && !game.users.activeGM.isSelf) return { ok: false, reason: "not_primary_gm" };
    const scene = sceneId ? game.scenes?.get?.(String(sceneId).replace(/^Scene\./, "")) : canvas?.scene;
    if (!scene) return { ok: false, reason: "no_scene" };
    const campaignId = getActiveCampaignId();
    const campaign = campaignId ? getCampaign(campaignId) : null;
    const placements = Array.isArray(campaign?.npcPlacements) ? campaign.npcPlacements : [];
    if (!placements.length) return { ok: true, changed: 0 };

    let changed = 0;
    for (const p of placements) {
      const actor = game.actors?.get?.(String(p?.actorId || ""));
      if (!actor) continue;
      let desired = null;
      for (const rule of (Array.isArray(p.rules) ? p.rules : [])) {
        if (await _placementRuleMatches(rule, campaign)) { desired = rule; break; }
      }
      if (!desired) continue;                                   // no opinion — leave the world alone
      const desiredSceneId = _placementSceneId(desired);
      const here = scene.tokens.filter(t => t.actorId === actor.id);
      if (desiredSceneId === scene.id) {
        if (!here.length) {
          const td = await actor.getTokenDocument({
            x: Number.isFinite(desired.x) ? desired.x : Math.round(scene.width / 2),
            y: Number.isFinite(desired.y) ? desired.y : Math.round(scene.height / 2),
            hidden: !!desired.hidden
          });
          await scene.createEmbeddedDocuments("Token", [td.toObject()]);
          changed++;
          log(`[placement] ${actor.name} appears in '${scene.name}' (${reason}).`);
        }
      } else if (desiredSceneId && here.length) {
        await scene.deleteEmbeddedDocuments("Token", here.map(t => t.id));
        changed++;
        log(`[placement] ${actor.name} is elsewhere now — removed from '${scene.name}' (${reason}).`);
      }
    }
    return { ok: true, changed };
  } catch (e) { warn("[placement] reconcile failed:", e); return { ok: false, error: String(e?.message || e) }; }
}

Hooks.on("canvasReady", () => {
  try { reconcileNpcPlacements({ reason: "canvasReady" }).catch(() => {}); } catch (_e) {}
});
Hooks.on("bbttcc:beat:resolved", () => {
  // Quest state may have moved people. Chain after the consumption writes.
  try {
    if (!game.user?.isGM) return;
    setTimeout(() => reconcileNpcPlacements({ reason: "beat:resolved" }).catch(() => {}), 500);
  } catch (_e) {}
});

// GM veto for director-driven invitations (mirror of _gmPromptStoryBeat).
async function _gmPromptTalkInvite(beat, speaker, turn) {
  return new Promise((resolve) => {
    const chain = _storyChainOf(beat);
    new Dialog({
      title: "Bad Eden: Story Director",
      content: `
        <p><b>Story Director</b> — Turn ${turn}: a story moment is live, carried by <b>${foundry.utils.escapeHTML(speaker?.name || "an NPC")}</b>.</p>
        <p style="margin:4px 0"><b>${beat?.label || beat?.id}</b>${chain ? ` <span style="opacity:.7">(chain: ${chain})</span>` : ""}</p>
        ${_ledgerOfferPriceLine(beat)}
        <p style="opacity:.8;font-size:.9em">Speaker beats play out in conversation, not narration. Post a public "${foundry.utils.escapeHTML(speaker?.name || "NPC")} wants a word" invitation? (Declining keeps the moment quietly available in dialogue.)</p>`,
      buttons: {
        invite:  { icon: '<i class="fas fa-comments"></i>', label: "Invite",  callback: () => resolve(true) },
        decline: { icon: '<i class="fas fa-clock"></i>',    label: "Not now", callback: () => resolve(false) }
      },
      default: "invite",
      close: () => resolve(false)
    }).render(true);
  });
}

// (3b) Newly-opened speaker moments announce themselves: after each beat
// resolution (quest effects already applied), any speaker beat that has
// BECOME offerable and was never invited gets one invitation card — grouped
// per NPC, marked in directorState.invited so it never repeats. Chained onto
// _speakerMemoryChain so the just-resolved beat's own consumption mark is
// written before we compute offerability. Setting-gated (director.autoInvite).
function _onBeatResolvedInviteScan({ beat } = {}) {
  try {
    if (!game.user?.isGM) return;
    let auto = true;
    try { auto = !!game.settings.get(MOD_ID, SETTING_DIRECTOR_AUTOINVITE); } catch (_e) {}
    if (!auto) return;
    const resolvedId = beat?.id || null;
    _speakerMemoryChain = _speakerMemoryChain.then(async () => {
      const campaignId = getActiveCampaignId();
      const campaign = campaignId ? getCampaign(campaignId) : null;
      if (!campaign) return;
      const state = _readDirectorState();
      const sids = new Set((campaign.beats || [])
        .filter(b => b && String(b.speakerActorId || "").trim())
        .map(b => String(b.speakerActorId).trim()));
      for (const sid of sids) {
        const actor = game.actors?.get?.(sid);
        if (!actor) continue;
        // Mid-conversation: the moment is already live in that window.
        if (game.bbttcc?.mal?.npc?._apps?.has?.(sid)) continue;
        const offerable = (await _dialogueOfferableBeats(sid, {}))
          .map(r => r.beat)
          .filter(b => b.id !== resolvedId && !state.invited[b.id]);
        if (!offerable.length) continue;
        await _mutateDirectorState(s => {
          for (const b of offerable) s.invited[b.id] = { ts: Date.now(), via: "auto" };
        });
        await _postTalkInvitation(actor, offerable);
        log(`[dialogue] invitation posted: ${actor.name} (${offerable.map(b => b.id).join(", ")})`);
      }
    }).catch(e => warn("[dialogue] invite scan failed:", e));
  } catch (e) { warn("[dialogue] invite-scan listener failed:", e); }
}

// ─── Reality Tear → Adversary draws a Beat ───────────────────────────────────
// The fourththing system broadcasts `fourththing.overshoot` whenever a roll
// overshoots its DC into a Reality-Tear band (systems/fourththing/module.js,
// applyOvershoot). The two strong bands narrate an Adversary response —
// "Adversary / Watcher takes notice" (rupture) and "Adversary draws a Beat"
// (sundering). Here we make that real by drawing a tag-matched Beat through the
// existing injector. GM-authored `adversary`-tagged beats are the content; if
// none are tagged, this is a graceful no-op plus a one-line GM nudge. The system
// stays fully decoupled — it only emits the hook.
const _OVERSHOOT_BEAT_TAGS = {
  rupture:   ["adversary", "reality-tear", "reality-rupture", "notice"],
  sundering: ["adversary", "reality-tear", "reality-sundering", "draw"]
};

function _bbttccBandCap(b) { return b ? b.charAt(0).toUpperCase() + b.slice(1) : b; }

// Only ONE GM should perform the world-writing draw so a multi-GM table doesn't
// draw N copies. Prefer Foundry's designated activeGM; fall back to the
// lowest-id active GM.
function _bbttccIsPrimaryGM() {
  try {
    const active = game.users?.activeGM;
    if (active) return active.isSelf === true;
  } catch (_e) {}
  try {
    const gms = (game.users?.filter?.(u => u.isGM && u.active) ?? []).slice();
    if (!gms.length) return false;
    gms.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return gms[0]?.id === game.user?.id;
  } catch (_e) { return !!game.user?.isGM; }
}

// Perform the actual draw on the GM client. `info` is the socket-safe shape:
// { actorUuid, targetUuid, over, band, kind }.
async function _drawAdversaryBeat(info = {}) {
  try {
    if (!game.settings.get(MOD_ID, SETTING_OVERSHOOT_BEATS)) return;
    const band = String(info.band || "");
    const tags = _OVERSHOOT_BEAT_TAGS[band];
    if (!tags) return; // ripple / tear / unknown — no Adversary response

    const campaignId = getActiveCampaignId();
    if (!campaignId) { log("Overshoot beat: no active campaign — skipping."); return; }

    const over   = Number(info.over) || 0;
    const actor  = info.actorUuid  ? (globalThis.fromUuidSync?.(info.actorUuid)  ?? null) : null;
    const target = info.targetUuid ? (globalThis.fromUuidSync?.(info.targetUuid) ?? null) : null;

    const res = await injectorFire({
      campaignId,
      tags: tags.join(" "),
      autoDebt:   false,  // overshoot is itself the trigger — don't double-count war-log debt
      promptDebt: false,  // fire directly, no GM debt dialog
      allowMulti: false,
      maxFire:    1
    });

    const fired = Array.isArray(res?.fired) ? res.fired : [];
    if (fired.length) {
      log(`Overshoot ${band} (+${over}) drew Adversary beat(s): ${fired.map(f => f.beatId).join(", ")}`);
    } else {
      // Nothing authored to match — nudge the GM so the narrative line isn't empty.
      const who = actor?.name  ? ` by ${actor.name}`  : "";
      const vs  = target?.name ? ` vs. ${target.name}` : "";
      try {
        ChatMessage.create({
          whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
          content: `<div class="fourththing-roll"><div class="ft-roll-header"><span class="ft-roll-name" style="color:#ff8a3d">✦ Reality ${_bbttccBandCap(band)} — Adversary stirs${who}${vs}</span></div><p style="margin:.2rem 0;font-size:.8rem;opacity:.85">No <b>adversary</b>-tagged Beat is authored in the active campaign, so none could be drawn. Author one (tags: <code>${tags.join(", ")}</code>) to give this teeth.</p></div>`
        });
      } catch (_eMsg) {}
      log(`Overshoot ${band} (+${over}): no adversary-tagged beat to draw (reason: ${res?.reason ?? "none"}).`);
    }
  } catch (e) {
    warn("Adversary beat draw failed:", e);
  }
}

// Hook entry — runs on the rolling client. The primary GM draws directly;
// everyone else (players, non-primary GMs) relays a socket-safe payload, since
// only the GM can write campaign/world state and the overshoot is usually a
// player's roll.
function _onOvershootHook(payload = {}) {
  try {
    const band = String(payload?.band || "");
    if (!_OVERSHOOT_BEAT_TAGS[band]) return; // only rupture / sundering summon a response
    const info = {
      actorUuid:  payload?.actor?.uuid  ?? null,
      targetUuid: payload?.target?.uuid ?? null,
      over:       Number(payload?.over) || 0,
      band,
      kind:       String(payload?.kind || "tactical")
    };
    if (_bbttccIsPrimaryGM()) {
      _drawAdversaryBeat(info);
    } else {
      try { game.socket.emit(`module.${MOD_ID}`, { type: "bbttccOvershootBeat", info }); } catch (_e) {}
    }
  } catch (e) {
    warn("Overshoot hook handler failed:", e);
  }
}

// Socket receiver — the primary GM draws on behalf of a player (or non-primary
// GM) who overshot. Shares the module channel with beat audio, which ignores
// any message whose type isn't its own.
function _installOvershootSocket() {
  try {
    const sock = game?.socket;
    if (!sock || typeof sock.on !== "function") return;
    sock.on(`module.${MOD_ID}`, (msg) => {
      try {
        if (!msg || msg.type !== "bbttccOvershootBeat") return;
        if (!_bbttccIsPrimaryGM()) return;
        _drawAdversaryBeat(msg.info || {});
      } catch (e) { warn("Overshoot socket handler failed:", e); }
    });
  } catch (_e) {}
}

function getActiveCampaignId() {
  try { return String(game.settings.get(MOD_ID, SETTING_ACTIVE_CAMPAIGN) || "").trim() || null; }
  catch { return null; }
}
async function setActiveCampaignId(id) {
  await game.settings.set(MOD_ID, SETTING_ACTIVE_CAMPAIGN, String(id || ""));
  // Campaign Turn Flow: update the world turn-beats map to reflect the new active campaign.
  try {
    var cid = String(id || "").trim();
    if (cid) _syncWorldTurnBeatsForCampaign(cid);
  } catch (_e) {}
  return getActiveCampaignId();
}

// UI
async function openBuilder(campaignId = null) {
  try {
    const mod = await import("../apps/campaign-builder-app.js");
    const App = mod?.BBTTCCCampaignBuilderApp || mod?.default || null;
    if (!App) {
      ui.notifications?.warn?.("Campaign Builder loaded, but BBTTCCCampaignBuilderApp export missing.");
      return null;
    }
    // Prefer the App's own open() helper if present, otherwise instantiate.
    if (typeof App.open === "function") return App.open({ campaignId });
    const inst = new App({ campaignId });
    inst.render(true);
    return inst;
  } catch (e) {
    warn("openBuilder failed:", e);
    ui.notifications?.error?.("Could not open Campaign Builder. See console.");
    return null;
  }
}


// ---------------------------------------------------------------------------
// Campaign I/O (Interim): Export/Import campaign bundles via JournalEntry compendium
// - Stores campaign + optional tables/quests into a JournalEntry flag payload.
// - Adds stable reference keys (flags.bbttcc.key) to enable cross-world remap.
// - Remap pass attempts to restore Scene/Actor/Journal references after import.
//
// NOTE: This is the interim transport layer. It is designed to be Adventure-compatible:
//       When we later ship a Foundry Adventure/module pack, the same JournalEntry bundle
//       can be included as content and imported in exactly the same way.
// ---------------------------------------------------------------------------

function _bbttccGetFlag(obj, mod, key) {
  try {
    if (!obj) return null;
    if (typeof obj.getFlag === "function") return obj.getFlag(mod, key);
    if (obj.flags && obj.flags[mod] && (key in obj.flags[mod])) return obj.flags[mod][key];
  } catch (_e) {}
  return null;
}

function _bbttccSetFlagPath(doc, mod, key, value) {
  try {
    if (!doc || typeof doc.setFlag !== "function") return false;
    doc.setFlag(mod, key, value);
    return true;
  } catch (_e) { return false; }
}

function _bbttccStableKeyOf(doc) {
  try {
    var k =
      _bbttccGetFlag(doc, "bbttcc", "key") ||
      _bbttccGetFlag(doc, "bbttcc", "stableKey") ||
      _bbttccGetFlag(doc, "bbttcc-campaign", "key") ||
      null;
    k = String(k || "").trim();
    return k || null;
  } catch (_e) { return null; }
}

function _bbttccFindByStableKey(collection, key) {
  try {
    key = String(key || "").trim();
    if (!key) return null;
    var list = (collection && collection.contents) ? collection.contents : (collection || []);
    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      var k = _bbttccStableKeyOf(d);
      if (k && String(k) === key) return d;
    }
  } catch (_e) {}
  return null;
}

async function _bbttccResolveDoc(ref, docName) {
  try {
    var s = String(ref || "").trim();
    if (!s) return null;

    // UUID path
    if (s.indexOf(".") !== -1 && typeof fromUuid === "function") {
      try {
        var doc = await fromUuid(s);
        if (!docName) return doc;
        if (doc && String(doc.documentName || doc.documentName) === String(docName)) return doc;
      } catch (_eU) {}
    }

    // "Type.id" path
    var parts = s.split(".");
    if (parts.length === 2) {
      var type = parts[0];
      var id = parts[1];
      if (type === "Scene" && game.scenes) return game.scenes.get(id) || null;
      if (type === "Actor" && game.actors) return game.actors.get(id) || null;
      if (type === "JournalEntry" && game.journal) return game.journal.get(id) || null;
      if (type === "Playlist" && game.playlists) return game.playlists.get(id) || null;
      if (type === "RollTable" && game.tables) return game.tables.get(id) || null;
    }

    // raw id fallback by docName
    if (docName === "Scene" && game.scenes) return game.scenes.get(s) || null;
    if (docName === "Actor" && game.actors) return game.actors.get(s) || null;
    if (docName === "JournalEntry" && game.journal) return game.journal.get(s) || null;
    if (docName === "Playlist" && game.playlists) return game.playlists.get(s) || null;
    if (docName === "RollTable" && game.tables) return game.tables.get(s) || null;

    return null;
  } catch (_e) { return null; }
}

function _bbttccListJournalPacks() {
  try {
    var out = [];
    var packs = game && game.packs ? Array.from(game.packs) : [];
    for (var i = 0; i < packs.length; i++) {
      var p = packs[i];
      if (!p) continue;
      // CompendiumCollection shape
      var dn = String(p.documentName || p.metadata && p.metadata.type || "");
      if (dn !== "JournalEntry") continue;
      out.push({
        id: String(p.collection || p.metadata && p.metadata.id || ""),
        label: String(p.title || (p.metadata && p.metadata.label) || p.collection || "Journal Pack"),
        locked: !!p.locked
      });
    }
    out.sort(function (a, b) { return String(a.label).localeCompare(String(b.label)); });
    return out;
  } catch (_e) { return []; }
}

function _bbttccGetPack(packId) {
  try {
    if (!packId) return null;
    return game && game.packs ? game.packs.get(String(packId)) : null;
  } catch (_e) { return null; }
}

function _bbttccClone(obj) {
  try { return foundry.utils.deepClone(obj); } catch (_e) {
    try { return JSON.parse(JSON.stringify(obj || {})); } catch (_e2) { return obj; }
  }
}

function _bbttccHasAnyRef(beat) {
  try {
    if (!beat) return false;
    if (beat.sceneId) return true;
    if (beat.cinematic && (beat.cinematic.startSceneId || beat.cinematic.nextSceneId)) return true;
    if (beat.actors && beat.actors.length) return true;
    if (beat.journal && beat.journal.entryId) return true;
    return false;
  } catch (_e) { return false; }
}

// Attach stable keys to beats.refs for later remap
async function _bbttccStampRefsIntoCampaign(campaign) {
  var c = _bbttccClone(campaign || {});
  var beats = Array.isArray(c.beats) ? c.beats : [];
  for (var i = 0; i < beats.length; i++) {
    var b = beats[i];
    if (!b || typeof b !== "object") continue;
    if (!_bbttccHasAnyRef(b)) continue;

    b.refs = b.refs && typeof b.refs === "object" ? b.refs : {};

    // Scene (primary)
    if (b.sceneId) {
      var sc = await _bbttccResolveDoc(b.sceneId, "Scene");
      var k = sc ? _bbttccStableKeyOf(sc) : null;
      if (k) b.refs.sceneKey = k;
    }

    // Cinematic scenes
    try {
      if (b.cinematic && b.cinematic.startSceneId) {
        var sc1 = await _bbttccResolveDoc(b.cinematic.startSceneId, "Scene");
        var k1 = sc1 ? _bbttccStableKeyOf(sc1) : null;
        if (k1) b.refs.cinematicStartKey = k1;
      }
      if (b.cinematic && b.cinematic.nextSceneId) {
        var sc2 = await _bbttccResolveDoc(b.cinematic.nextSceneId, "Scene");
        var k2 = sc2 ? _bbttccStableKeyOf(sc2) : null;
        if (k2) b.refs.cinematicNextKey = k2;
      }
    } catch (_eC) {}

    // Actors
    try {
      var akeys = [];
      var au = Array.isArray(b.actors) ? b.actors : [];
      for (var j = 0; j < au.length; j++) {
        var ad = await _bbttccResolveDoc(au[j], "Actor");
        var ak = ad ? _bbttccStableKeyOf(ad) : null;
        if (ak) akeys.push(ak);
      }
      if (akeys.length) b.refs.actorKeys = akeys;
    } catch (_eA) {}

    // Journal
    try {
      var je = (b.journal && b.journal.entryId) ? await _bbttccResolveDoc(b.journal.entryId, "JournalEntry") : null;
      var jk = je ? _bbttccStableKeyOf(je) : null;
      if (jk) b.refs.journalKey = jk;
    } catch (_eJ) {}
  }
  return c;
}

function _bbttccScrubExternalRefs(campaign) {
  var c = _bbttccClone(campaign || {});
  var beats = Array.isArray(c.beats) ? c.beats : [];
  for (var i = 0; i < beats.length; i++) {
    var b = beats[i];
    if (!b || typeof b !== "object") continue;
    // Keep refs (keys) but clear IDs so import doesn't wedge on missing docs
    b.sceneId = null;
    if (b.cinematic) {
      b.cinematic.startSceneId = null;
      b.cinematic.nextSceneId = null;
    }
    b.actors = [];
    if (b.journal) b.journal.entryId = null;
  }
  return c;
}

async function exportCampaignBundleToCompendium(opts) {
  opts = opts || {};
  var campaignId = String(opts.campaignId || "").trim();
  var packId = String(opts.packId || "").trim();
  if (!campaignId) throw new Error("exportCampaignBundleToCompendium: campaignId required");
  if (!packId) throw new Error("exportCampaignBundleToCompendium: packId required");

  var pack = _bbttccGetPack(packId);
  if (!pack) throw new Error("exportCampaignBundleToCompendium: pack not found: " + packId);
  if (pack.locked) throw new Error("exportCampaignBundleToCompendium: pack is locked: " + packId);

  var campaign = getCampaign(campaignId);
  if (!campaign) throw new Error("exportCampaignBundleToCompendium: campaign not found: " + campaignId);

  // Build payload
  var c1 = await _bbttccStampRefsIntoCampaign(campaign);
  if (opts.scrubExternalRefs) c1 = _bbttccScrubExternalRefs(c1);

  var payload = {
    v: 1,
    kind: "bbttcc-campaign-bundle",
    exportedAt: Date.now(),
    campaignId: campaignId,
    campaignLabel: String(campaign.label || campaignId),
    includeTables: !!opts.includeTables,
    includeQuests: !!opts.includeQuests,
    campaign: c1,
    tables: null,
    quests: null
  };

  if (opts.includeTables) payload.tables = getAllTables();
  if (opts.includeQuests) payload.quests = getAllQuests();

  // Find existing entry for this campaignId (by flag)
  var entryDoc = null;
  try {
    var index = await pack.getIndex();
    for (var i = 0; i < index.length; i++) {
      var row = index[i];
      var doc = await pack.getDocument(row._id || row.id);
      if (!doc) continue;
      var ex = _bbttccGetFlag(doc, "bbttcc-campaign", "export");
      if (ex && String(ex.campaignId || "") === campaignId) { entryDoc = doc; break; }
    }
  } catch (_eFind) {}

  var name = String(opts.entryName || "").trim();
  if (!name) name = "Campaign Bundle  -  " + (campaign.label || campaign.id || campaignId);

  if (!entryDoc) {
    entryDoc = await pack.documentClass.create({
      name: name,
      content: "<p><b>Bad Eden Campaign Bundle</b></p><p>Use the Bad Eden Campaign Builder to import this bundle.</p>",
      flags: {
        "bbttcc-campaign": {
          export: payload
        }
      }
    }, { pack: pack.collection });
  } else {
    await entryDoc.update({
      name: name,
      flags: { "bbttcc-campaign": { export: payload } }
    });
  }

  return {
    ok: true,
    packId: packId,
    entryId: entryDoc.id,
    entryName: entryDoc.name,
    campaignId: campaignId,
    campaignLabel: payload.campaignLabel
  };
}

async function importCampaignBundleFromCompendium(opts) {
  opts = opts || {};
  var packId = String(opts.packId || "").trim();
  var entryId = String(opts.entryId || "").trim();
  if (!packId) throw new Error("importCampaignBundleFromCompendium: packId required");
  if (!entryId) throw new Error("importCampaignBundleFromCompendium: entryId required");

  var pack = _bbttccGetPack(packId);
  if (!pack) throw new Error("importCampaignBundleFromCompendium: pack not found: " + packId);

  var entryDoc = await pack.getDocument(entryId);
  if (!entryDoc) throw new Error("importCampaignBundleFromCompendium: entry not found: " + entryId);

  var payload = _bbttccGetFlag(entryDoc, "bbttcc-campaign", "export");
  if (!payload || String(payload.kind || "") !== "bbttcc-campaign-bundle") {
    throw new Error("importCampaignBundleFromCompendium: entry is not a Bad Eden campaign bundle");
  }

  var mode = String(opts.mode || "merge").trim().toLowerCase(); // merge | duplicate
  var idPrefix = String(opts.idPrefix || "").trim();
  var setActive = !!opts.setActive;

  var c = payload.campaign || null;
  if (!c) throw new Error("importCampaignBundleFromCompendium: payload missing campaign");

  var targetCampaignId = String(payload.campaignId || c.id || "").trim();
  if (!targetCampaignId) targetCampaignId = "campaign_" + randomID();

  if (mode === "duplicate") {
    var prefix = idPrefix || ("import_" + randomID().slice(0, 4) + "_");
    targetCampaignId = prefix + targetCampaignId;
    c = _bbttccClone(c);
    c.id = targetCampaignId;
  }

  // Merge tables/quests into this world (optional)
  if (payload.tables && typeof payload.tables === "object") {
    var curT = getAllTables();
    curT = curT && typeof curT === "object" ? curT : {};
    var incT = payload.tables;
    for (var k in incT) if (Object.prototype.hasOwnProperty.call(incT, k)) curT[k] = incT[k];
    await setAllTables(curT);
  }

  if (payload.quests && typeof payload.quests === "object") {
    var curQ = getAllQuests();
    curQ = curQ && typeof curQ === "object" ? curQ : {};
    var incQ = payload.quests;
    for (var qk in incQ) if (Object.prototype.hasOwnProperty.call(incQ, qk)) curQ[qk] = incQ[qk];
    await setAllQuests(curQ);
  }

  await saveCampaign(targetCampaignId, c);

  // Remap references based on refs.* keys
  var remapRes = await remapCampaignReferences(targetCampaignId, { dryRun: false });

  if (setActive) {
    try { await setActiveCampaignId(targetCampaignId); } catch (_eA) {}
  }

  return {
    ok: true,
    campaignId: targetCampaignId,
    label: String(c.label || c.title || targetCampaignId),
    remap: remapRes
  };
}

async function remapCampaignReferences(campaignId, opts) {
  opts = opts || {};
  campaignId = String(campaignId || "").trim();
  if (!campaignId) throw new Error("remapCampaignReferences: campaignId required");

  var dryRun = !!opts.dryRun;

  var campaign = getCampaign(campaignId);
  if (!campaign) throw new Error("remapCampaignReferences: campaign not found: " + campaignId);

  var c = _bbttccClone(campaign);
  var beats = Array.isArray(c.beats) ? c.beats : [];
  var changes = [];

  var resolveSceneIdByKey = function (key) {
    var sc = _bbttccFindByStableKey(game.scenes, key);
    if (!sc) return null;
    return "Scene." + String(sc.id);
  };
  var resolveActorUuidByKey = function (key) {
    var a = _bbttccFindByStableKey(game.actors, key);
    if (!a) return null;
    return "Actor." + String(a.id);
  };
  var resolveJournalUuidByKey = function (key) {
    var j = _bbttccFindByStableKey(game.journal, key);
    if (!j) return null;
    return "JournalEntry." + String(j.id);
  };

  for (var i = 0; i < beats.length; i++) {
    var b = beats[i];
    if (!b || typeof b !== "object") continue;
    var refs = b.refs && typeof b.refs === "object" ? b.refs : null;
    if (!refs) continue;

    // Scene (primary)
    if (refs.sceneKey) {
      var exists = await _bbttccResolveDoc(b.sceneId, "Scene");
      if (!exists) {
        var next = resolveSceneIdByKey(refs.sceneKey);
        if (next && next !== b.sceneId) {
          changes.push({ beatId: b.id, field: "sceneId", from: b.sceneId || null, to: next, key: refs.sceneKey });
          b.sceneId = next;
        }
      }
    }

    // Cinematic
    if (b.cinematic && refs.cinematicStartKey) {
      var ex1 = await _bbttccResolveDoc(b.cinematic.startSceneId, "Scene");
      if (!ex1) {
        var nx1 = resolveSceneIdByKey(refs.cinematicStartKey);
        if (nx1 && nx1 !== b.cinematic.startSceneId) {
          changes.push({ beatId: b.id, field: "cinematic.startSceneId", from: b.cinematic.startSceneId || null, to: nx1, key: refs.cinematicStartKey });
          b.cinematic.startSceneId = nx1;
        }
      }
    }
    if (b.cinematic && refs.cinematicNextKey) {
      var ex2 = await _bbttccResolveDoc(b.cinematic.nextSceneId, "Scene");
      if (!ex2) {
        var nx2 = resolveSceneIdByKey(refs.cinematicNextKey);
        if (nx2 && nx2 !== b.cinematic.nextSceneId) {
          changes.push({ beatId: b.id, field: "cinematic.nextSceneId", from: b.cinematic.nextSceneId || null, to: nx2, key: refs.cinematicNextKey });
          b.cinematic.nextSceneId = nx2;
        }
      }
    }

    // Actors
    if (Array.isArray(refs.actorKeys) && refs.actorKeys.length) {
      // If any actor uuids fail to resolve, we rebuild the list from keys.
      var okAll = true;
      var au = Array.isArray(b.actors) ? b.actors : [];
      for (var j = 0; j < au.length; j++) {
        var exA = await _bbttccResolveDoc(au[j], "Actor");
        if (!exA) { okAll = false; break; }
      }
      if (!okAll) {
        var nextActors = [];
        for (var k = 0; k < refs.actorKeys.length; k++) {
          var ax = resolveActorUuidByKey(refs.actorKeys[k]);
          if (ax) nextActors.push(ax);
        }
        if (nextActors.length) {
          changes.push({ beatId: b.id, field: "actors", from: au, to: nextActors, key: refs.actorKeys.slice(0) });
          b.actors = nextActors;
        }
      }
    }

    // Journal
    if (b.journal && refs.journalKey) {
      var exJ = await _bbttccResolveDoc(b.journal.entryId, "JournalEntry");
      if (!exJ) {
        var nj = resolveJournalUuidByKey(refs.journalKey);
        if (nj && nj !== b.journal.entryId) {
          changes.push({ beatId: b.id, field: "journal.entryId", from: b.journal.entryId || null, to: nj, key: refs.journalKey });
          b.journal.entryId = nj;
        }
      }
    }
  }

  if (!dryRun && changes.length) {
    await saveCampaign(campaignId, c);
  }

  // Build unresolved report (keys that couldn't be mapped)
  var unresolved = [];
  for (var ci = 0; ci < beats.length; ci++) {
    var bb = beats[ci];
    var rr = bb && bb.refs ? bb.refs : null;
    if (!rr) continue;

    if (rr.sceneKey && !resolveSceneIdByKey(rr.sceneKey)) unresolved.push({ beatId: bb.id, kind: "Scene", key: rr.sceneKey, field: "sceneId" });
    if (rr.cinematicStartKey && !resolveSceneIdByKey(rr.cinematicStartKey)) unresolved.push({ beatId: bb.id, kind: "Scene", key: rr.cinematicStartKey, field: "cinematic.startSceneId" });
    if (rr.cinematicNextKey && !resolveSceneIdByKey(rr.cinematicNextKey)) unresolved.push({ beatId: bb.id, kind: "Scene", key: rr.cinematicNextKey, field: "cinematic.nextSceneId" });

    if (Array.isArray(rr.actorKeys)) {
      for (var kk = 0; kk < rr.actorKeys.length; kk++) {
        if (!resolveActorUuidByKey(rr.actorKeys[kk])) unresolved.push({ beatId: bb.id, kind: "Actor", key: rr.actorKeys[kk], field: "actors" });
      }
    }
    if (rr.journalKey && !resolveJournalUuidByKey(rr.journalKey)) unresolved.push({ beatId: bb.id, kind: "JournalEntry", key: rr.journalKey, field: "journal.entryId" });
  }

  return { ok: true, campaignId: campaignId, dryRun: dryRun, changes: changes, unresolved: unresolved };
}

// Tooling helpers for authors (stable keys)
async function setStableKeyOnDoc(ref, key) {
  key = String(key || "").trim();
  if (!key) throw new Error("setStableKeyOnDoc: key required");
  var doc = await _bbttccResolveDoc(ref, null);
  if (!doc || !doc.setFlag) throw new Error("setStableKeyOnDoc: doc not found: " + String(ref || ""));
  await doc.setFlag("bbttcc", "key", key);
  return { ok: true, docName: doc.documentName, id: doc.id, name: doc.name, key: key };
}

function scanStableKeysReport() {
  var rep = { scenes: { missing: [], present: [] }, actors: { missing: [], present: [] }, journals: { missing: [], present: [] } };
  try {
    var s = (game.scenes && game.scenes.contents) ? game.scenes.contents : [];
    for (var i = 0; i < s.length; i++) {
      var k = _bbttccStableKeyOf(s[i]);
      (k ? rep.scenes.present : rep.scenes.missing).push({ id: s[i].id, name: s[i].name, key: k || "" });
    }
  } catch (_eS) {}
  try {
    var a = (game.actors && game.actors.contents) ? game.actors.contents : [];
    for (var j = 0; j < a.length; j++) {
      var ak = _bbttccStableKeyOf(a[j]);
      (ak ? rep.actors.present : rep.actors.missing).push({ id: a[j].id, name: a[j].name, key: ak || "" });
    }
  } catch (_eA) {}
  try {
    var jn = (game.journal && game.journal.contents) ? game.journal.contents : [];
    for (var k2 = 0; k2 < jn.length; k2++) {
      var jk = _bbttccStableKeyOf(jn[k2]);
      (jk ? rep.journals.present : rep.journals.missing).push({ id: jn[k2].id, name: jn[k2].name, key: jk || "" });
    }
  } catch (_eJ) {}
  return rep;
}

// API
function buildCampaignAPI() {
  return {
    listCampaigns,
    getCampaign,
    saveCampaign,
    createCampaign,
    deleteCampaign,
    getAllCampaigns,
    setAllCampaigns,
    runCampaign,
    runBeat,
    injector: { fire: injectorFire },
    // Gate introspection for GM consoles: report(beat, campaign?, ctx?) gives
    // per-condition met/unmet; requiresMet is the boolean the engine itself uses.
    gates: {
      report: async (beat, campaign, ctx = {}) => {
        const c = campaign || getCampaign(getActiveCampaignId());
        return _beatGateReport(beat, c, ctx);
      },
      requiresMet: async (beat, campaign, ctx = {}) => {
        const c = campaign || getCampaign(getActiveCampaignId());
        return _beatRequiresMet(beat, c, ctx);
      },
      value: _resolveGateValue
    },
    // Tikkun Dividend — cross-module readers (epic repair, territory turn
    // engine, garrison upkeep) come through here; falls back to 0 if absent.
    tikkun: { get: _tikkunGet, max: TIKKUN_MAX },
    director: {
      tick: directorTick,
      chains: directorChains,
      reconcileLevels: directorReconcileLevels,
      state: _readDirectorState,
      addPressure: _directorAddPressure
    },
    dialogue: {
      choicesFor: dialogueChoicesFor,
      enact: dialogueEnact,
      storyStateFor: dialogueStoryStateFor,
      doorsFor: dialogueDoorsFor,
      pointTheWay: dialoguePointTheWay
    },
    placements: { reconcile: reconcileNpcPlacements },
    ledger: {
      get: _ledgerGet,
      spend: _ledgerSpend,
      remaining: () => _ledgerGet().remaining,
      timePointsForBeat: _timePointsForBeat
    },
    tables: { listTables, getTable, saveTable, createTable, deleteTable, getAllTables, setAllTables, runRandomTable },
    quests: { listQuests, getQuest, saveQuest, createQuest, deleteQuest, setQuestStatus, getAllQuests, setAllQuests },
    io: {
      listJournalPacks: _bbttccListJournalPacks,
      exportBundleToCompendium: exportCampaignBundleToCompendium,
      importBundleFromCompendium: importCampaignBundleFromCompendium,
      remapCampaignReferences: remapCampaignReferences,
      setStableKeyOnDoc: setStableKeyOnDoc,
      scanStableKeysReport: scanStableKeysReport
    },
    openBuilder,
    getActiveCampaignId,
    setActiveCampaignId,
    builderClass: null
  };
}

// INIT
/* ── Forgotten-Cause arc: Wendigo rung meter (step 1) ─────────────────────────
 * Per-world 0–WENDIGO_RUNG_MAX counter, bumped once each time a Wendigo travel-
 * encounter beat resolves. World-scope setting → only the GM (who drives the
 * beat dialog and fires `bbttcc:beat:resolved`) writes it. Pure reaction: no
 * existing beat behavior changes. Escalation cards / feud flags / Dougan gate
 * follow in later steps.
 * ───────────────────────────────────────────────────────────────────────────*/
function _wendigoRungGet() {
  try { return Number(game.settings.get(MOD_ID, SETTING_WENDIGO_RUNG)) || 0; }
  catch (_e) { return 0; }
}
// Post Mal's per-rung "something OFF" card for the given (post-increment) rung.
async function _postWendigoRungCard(rung) {
  try {
    if (!game.user?.isGM) return;                 // GM posts once; ChatMessage broadcasts to all
    const r = Math.max(1, Math.min(WENDIGO_RUNG_MAX, Number(rung) || 1));
    const detail = WENDIGO_RUNG_DETAILS[r];
    if (!detail) return;
    const mal = WENDIGO_RUNG_MAL[r];
    const content =
        `<div style="border-left:3px solid #6b8f9e;padding:.35em .6em;">`
      + `<div style="font-variant:small-caps;letter-spacing:.04em;opacity:.7;font-size:.85em;">&hellip; something a little OFF about those Wendigo</div>`
      + `<div style="margin-top:.25em;">${detail}</div>`
      + (mal ? `<div style="margin-top:.4em;font-style:italic;opacity:.85;">&mdash; ${mal}</div>` : "")
      + `</div>`;
    await ChatMessage.create({ content, speaker: { alias: "Mal" } });
  } catch (e) {
    warn("[wendigo-rung] card failed:", e);
  }
}
// The statues confer. Each fragment outcome bumps the matching counter; the
// later arrivals and the final verdict read the ledger. Pure reaction — the
// beat runner fires `bbttcc:beat:resolved` and this only counts.
async function _onBeatResolvedGeburah({ beat } = {}) {
  try {
    if (!game.user?.isGM) return;                 // only the GM writes world settings
    const id = beat?.id;
    if (!id) return;
    const earned = GEBURAH_EARNED_BEAT_IDS.has(id);
    const forced = GEBURAH_FORCED_BEAT_IDS.has(id);
    if (!earned && !forced) return;
    const key = earned ? SETTING_GEBURAH_EARNED : SETTING_GEBURAH_FORCED;
    const cur = _banditMeterGet(key);
    const next = Math.min(3, cur + 1);
    if (next === cur) { log(`[geburah] '${id}' fired; ${key} already at max ${cur}.`); return; }
    await game.settings.set(MOD_ID, key, next);
    log(`[geburah] '${id}' → ${key} ${cur} → ${next} (earned ${_banditMeterGet(SETTING_GEBURAH_EARNED)} / forced ${_banditMeterGet(SETTING_GEBURAH_FORCED)}).`);
  } catch (e) {
    warn("[geburah] ledger increment failed:", e);
  }
}

async function _onBeatResolvedWendigoRung({ beat } = {}) {
  try {
    if (!game.user?.isGM) return;                 // only the GM can write world settings
    const id = beat?.id;
    if (!id || !WENDIGO_TRAVEL_BEAT_IDS.has(id)) return;
    const cur = _wendigoRungGet();
    const next = Math.min(WENDIGO_RUNG_MAX, cur + 1);
    if (next !== cur) {
      await game.settings.set(MOD_ID, SETTING_WENDIGO_RUNG, next);
      log(`[wendigo-rung] '${id}' fired → rung ${cur} → ${next}.`);
    } else {
      log(`[wendigo-rung] '${id}' fired; already at max rung ${cur}.`);
    }
    await _postWendigoRungCard(next);             // every Wendigo encounter gets its OFF card
  } catch (e) {
    warn("[wendigo-rung] increment failed:", e);
  }
}

// Resolve the feud's faction actor — prefer the beat's own factionEffects target
// (data-driven, world-portable), else the known Jackalopes id.
function _feudFactionActor(beat) {
  try {
    const fid = beat?.worldEffects?.factionEffects?.find?.(fe => fe?.factionId)?.factionId
              || FORGOTTEN_CAUSE_FACTION_ID;
    return game.actors?.get?.(fid) || null;
  } catch (_e) { return null; }
}
// Step 3 subscriber: move the feud state when the Confluence / Cultural Summit
// beats resolve. Separate from the rung subscriber (own beat-id set). GM-only
// (faction-flag writes need the GM, who drives the beat).
async function _onBeatResolvedFeudState({ beat } = {}) {
  try {
    if (!game.user?.isGM) return;
    const id = beat?.id;
    if (!id) return;
    const isRecover  = FEUD_CONFLUENCE_RECOVER_IDS.has(id);
    const isBreak    = id === FEUD_BREAK_ID;
    const isSummitOK = id === FEUD_SUMMIT_SUCCESS_ID;
    const isSummitNo = id === FEUD_SUMMIT_FAILURE_ID;
    if (!(isRecover || isBreak || isSummitOK || isSummitNo)) return;

    const fac = _feudFactionActor(beat);
    if (!fac) { warn(`[feud] '${id}' fired but the Jackalope faction actor was not found.`); return; }

    if (isRecover) {
      // The recovered cause: the Summit can now truly close the Ledger.
      await fac.setFlag(FF_NS, "feudCauseRecovered", true);
      log(`[feud] '${id}' → ${fac.name}: feudCauseRecovered = true.`);
    } else if (isBreak) {
      // Peace-by-deletion: the grievance's ghost is erased; the feud quietly ends,
      // no Summit needed. No recovered cause survives a severed network.
      await fac.setFlag(FF_NS, "feudHeat", 0);
      await fac.setFlag(FF_NS, "feudCauseRecovered", false);
      await fac.setFlag(FF_NS, "feudResolvedByDeletion", true);
      log(`[feud] '${id}' → ${fac.name}: peace-by-deletion (feudHeat=0, resolvedByDeletion).`);
    } else if (isSummitOK) {
      // The Ledger closes: Grievance zeroed, feud reconciled.
      await fac.setFlag(FF_NS, "feudHeat", 0);
      await fac.setFlag(FF_NS, "feudResolved", true);
      log(`[feud] '${id}' → ${fac.name}: Summit closed the Ledger (feudHeat=0, resolved).`);
    } else if (isSummitNo) {
      // A botched Summit raises the Grievance.
      const cur = Number(fac.getFlag(FF_NS, "feudHeat")) || 0;
      await fac.setFlag(FF_NS, "feudHeat", cur + 1);
      log(`[feud] '${id}' → ${fac.name}: Summit failed (feudHeat ${cur} → ${cur + 1}).`);
    }
  } catch (e) {
    warn("[feud] state update failed:", e);
  }
}

// Step 4: when the Dougan convo resolves and the world's Wendigo rung is >= 3,
// Dougan upgrades his line into a direct pointer at the Confluence. Fires once
// (latched by SETTING_DOUGAN_POINTED) — which also breaks the pointer's
// "back to the bar" → convo-hub → re-fire loop. GM-only (drives the beat).
async function _onBeatResolvedDouganPointer({ beat, campaign } = {}) {
  try {
    if (!game.user?.isGM) return;
    if (beat?.id !== "fixit_gullywasher_interior_convo") return;
    if (_wendigoRungGet() < 3) return;
    if (game.settings.get(MOD_ID, SETTING_DOUGAN_POINTED)) return;     // already pointed
    const campaignId = campaign?.id || getActiveCampaignId();
    if (!campaignId) return;
    await game.settings.set(MOD_ID, SETTING_DOUGAN_POINTED, true);     // latch BEFORE firing
    log("[dougan] rung>=3 at the Gullywasher → pointing to the Confluence.");
    await game.bbttcc.api.campaign.runBeat(campaignId, "gullywasher_dougan_points_to_confluence");
  } catch (e) {
    warn("[dougan] pointer failed:", e);
  }
}

/* ── Bandit Accord: the mercy ledger (Wendigo-rung clone) ─────────────────────
 * Two per-world counters bumped by bandit-encounter resolutions, ARMED only
 * once the opening beat announces the theme. Mercy (freed/jailed) climbs the
 * rung ladder toward the summit; fear (killed) is the parallel suppressor.
 * The arms-down variant (offered automatically at rung ≥ 3 when an ambush
 * fires) counts double on accept; violence there resets mercy to the rung-2
 * threshold and the story of it travels (dossier page gates on the beat).
 * Pure reaction — no existing beat behavior changes. GM-only writes.
 * ───────────────────────────────────────────────────────────────────────────*/
function _banditMeterGet(key) {
  try { return Number(game.settings.get(MOD_ID, key)) || 0; }
  catch (_e) { return 0; }
}
function _banditArmed() {
  try { return !!game.settings.get(MOD_ID, SETTING_BANDIT_ARMED); }
  catch (_e) { return false; }
}
// Highest rung the given mercy count has reached (0 = none).
function _banditRungFor(mercy) {
  let rung = 0;
  for (let i = 0; i < BANDIT_MERCY_RUNG_AT.length; i++) if (mercy >= BANDIT_MERCY_RUNG_AT[i]) rung = i + 1;
  return rung;
}
async function _postBanditRungCard(rung) {
  try {
    if (!game.user?.isGM) return;                 // GM posts once; ChatMessage broadcasts to all
    const detail = BANDIT_RUNG_DETAILS[rung];
    if (!detail) return;
    const mal = BANDIT_RUNG_MAL[rung];
    const content =
        `<div style="border-left:3px solid #7a8f6b;padding:.35em .6em;">`
      + `<div style="font-variant:small-caps;letter-spacing:.04em;opacity:.7;font-size:.85em;">&hellip; word moves through the reeds</div>`
      + `<div style="margin-top:.25em;">${detail}</div>`
      + (mal ? `<div style="margin-top:.4em;font-style:italic;opacity:.85;">&mdash; ${mal}</div>` : "")
      + `</div>`;
    await ChatMessage.create({ content, speaker: { alias: "Mal" } });
  } catch (e) {
    warn("[bandit-ledger] card failed:", e);
  }
}
async function _onBeatResolvedBanditLedger({ beat, campaign } = {}) {
  try {
    if (!game.user?.isGM) return;                 // only the GM can write world settings
    const id = beat?.id;
    if (!id) return;

    // The opening beat arms the ledger (owner decision: nothing counts before it).
    if (id === BANDIT_OPENING_BEAT_ID) {
      if (!_banditArmed()) {
        await game.settings.set(MOD_ID, SETTING_BANDIT_ARMED, true);
        log("[bandit-ledger] opening beat fired — the mercy ledger is ARMED.");
      }
      return;
    }
    if (!_banditArmed()) return;

    const mercy = _banditMeterGet(SETTING_BANDIT_MERCY);
    const fear  = _banditMeterGet(SETTING_BANDIT_FEAR);

    // Rung ≥ 3: an ambush that fires surrenders BEFORE the roll — offer the
    // arms-down variant (Dougan-pointer pattern; repeatable, GM veto is the
    // beat dialog itself).
    if (BANDIT_ENC_RE.test(id) && !BANDIT_MERCY_RE.test(id) && !BANDIT_FEAR_RE.test(id)) {
      if (_banditRungFor(mercy) >= 3) {
        const campaignId = campaign?.id || getActiveCampaignId();
        if (campaignId) {
          log("[bandit-ledger] ambush at rung ≥ 3 → arms-down variant.");
          await game.bbttcc.api.campaign.runBeat(campaignId, BANDIT_ARMS_DOWN_BEAT_ID);
        }
      }
      return;
    }

    // Classify the resolution.
    let mercyDelta = 0, fearDelta = 0, resetToRung2 = false, inheritRemnant = false;
    if (id === BANDIT_ARMS_DOWN_ACCEPT_ID) mercyDelta = 2;                     // mercy counts double here
    else if (id === BANDIT_ARMS_DOWN_VIOLENCE_ID) { resetToRung2 = true; fearDelta = 1; }
    else if (id === BANDIT_HUMILIATION_BEAT_ID) inheritRemnant = true;         // FEAR inherits the remnant
    else if (BANDIT_ENC_RE.test(id) && BANDIT_MERCY_RE.test(id)) mercyDelta = 1;
    else if (BANDIT_ENC_RE.test(id) && BANDIT_FEAR_RE.test(id))  fearDelta = 1;
    else return;

    const nextMercy = resetToRung2
      ? Math.min(mercy, BANDIT_MERCY_RUNG_AT[1])   // back to the rung-2 threshold
      : mercy + mercyDelta;
    const nextFear = inheritRemnant ? Math.max(fear, mercy) : fear + fearDelta;

    if (nextMercy !== mercy) await game.settings.set(MOD_ID, SETTING_BANDIT_MERCY, nextMercy);
    if (nextFear !== fear)   await game.settings.set(MOD_ID, SETTING_BANDIT_FEAR, nextFear);
    log(`[bandit-ledger] '${id}' → mercy ${mercy} → ${nextMercy}, fear ${fear} → ${nextFear}.`);

    // A newly reached rung gets its reed-telegraph card (one per rung step).
    const before = _banditRungFor(mercy), after = _banditRungFor(nextMercy);
    for (let r = before + 1; r <= after; r++) await _postBanditRungCard(r);
    if (resetToRung2 && before > _banditRungFor(nextMercy))
      log(`[bandit-ledger] violence at a surrender — mercy reset to rung 2; the story travels.`);
  } catch (e) {
    warn("[bandit-ledger] update failed:", e);
  }
}

/* ── The Cadence: dance-battle state flags ────────────────────────────────────
 * The outcome beats write three world flags; the standing offers (rematch /
 * border performance / the owed cameo) are director beats gated on them via
 * inject.requires. Pure reaction, GM-only writes, no beat behavior changes.
 * ───────────────────────────────────────────────────────────────────────────*/
async function _onBeatResolvedCadence({ beat } = {}) {
  try {
    if (!game.user?.isGM) return;
    const fx = CADENCE_OUTCOME_FLAGS[beat?.id];
    if (!fx) return;
    const KEYS = { respect: SETTING_CADENCE_RESPECT, tribute: SETTING_CADENCE_TRIBUTE, uncontested: SETTING_CADENCE_UNCONTESTED };
    for (const [k, v] of Object.entries(fx)) {
      if (_banditMeterGet(KEYS[k]) !== v) await game.settings.set(MOD_ID, KEYS[k], v);
    }
    log(`[cadence] '${beat.id}' → ${Object.entries(fx).map(([k, v]) => `${k}=${v}`).join(", ")}.`);
  } catch (e) {
    warn("[cadence] state update failed:", e);
  }
}

// ---------------------------------------------------------------------------
// Central hover-help: the "campaign" dictionary (bbttcc-core, game.bbttcc.help).
// Consumed by templates via {{bbttccTip 'campaign' '<key>'}} and by JS-built DOM
// via game.bbttcc.help.tip("campaign", key). The Operator tour reads the SAME
// entries (help.entry / help.dict), so tooltip and tour text can never drift.
// House style: "Name — what it is. What it does mechanically. When/why."
// The Builder is a GM-only surface (toolbar button is GM-gated), so entries do
// not carry a "GM —" prefix.
// ---------------------------------------------------------------------------
const CAMPAIGN_HELP = {
  // ── Header / tabs ─────────────────────────────────────────────────────────
  title: "Campaign Builder — the GM authoring console for campaign spines: beats, quests, travel encounter tables, bundles, and the flow visualizer. The heading shows the currently selected campaign.",
  "campaign-id": "Campaign ID — the campaign's stable key in the world setting. Bundles, encounter-table entries, and beat references all point at this id; it never changes after creation.",
  tabs: "Tabs — the Builder's five surfaces: Campaign (list, bundles, settings), Travel Tables, Beats, Quests, and the Visualizer. Switching tabs is pure UI — nothing fires.",
  "tab-campaign": "Campaign — manage campaign definitions: create/select/delete campaigns, set the world's Active campaign, export/import bundles, and edit label, description, and the faction roster.",
  "tab-travel": "Travel Tables — the travel encounter tables the travel engine rolls when a journey leg triggers an encounter. Create, repair, preview, and edit them here.",
  "tab-beats": "Beats — the selected campaign's content, beat by beat, in canonical order: filters, reordering, and Run/Edit per row. A beat is one runnable unit (scene + dialog + effects).",
  "tab-quests": "Quests — the quest registry for this campaign: status bookkeeping, ordering, and hex links (map hints) per quest. Beats join a quest via beat.questId.",
  "tab-flow": "Visualizer — a read-only pan/zoom flow map of the campaign built from beat links (Next/Success/Failure/Choices). Two views: quest bubbles (overview) or the per-beat decision tree (detail).",

  // ── Campaign tab ──────────────────────────────────────────────────────────
  campaigns: "Campaigns — every campaign definition stored in this world (hidden world setting). Click one to load it into the Beats/Quests/Visualizer tabs; the ★ Active one is what the automated systems read.",
  "select-campaign": "Select — loads this campaign into the Builder (Beats, Quests, Visualizer, Selected Campaign panel). Selection is UI-only; it does not change the world's Active campaign.",
  "active-chip": "★ Active — this is the world's Active campaign. The Story Director's turn tick, Reality-Tear adversary beat draws, and Strategic-Turn 'now available' announcements all read the Active campaign only.",
  "set-active": "Set Active — makes this the world's Active campaign (world setting). The Story Director tick, Reality-Tear adversary draws, and Turn-N availability announcements only ever look at the Active campaign.",
  "run-campaign": "Run First Beat — executes this campaign's FIRST beat right now (journal, narration audio, scene, dialog, world effects, time cost). Exactly 'run beat #1' — not a queue and not a mode.",
  "delete-campaign": "Delete — permanently removes this campaign and all its beats from the world setting (confirm first, no undo). Quests and encounter tables live in separate registries and survive; the confirm dialog lists every encounter table whose entries point at this campaign's beats, since those entries go dead.",
  "new-campaign": "+ New Campaign — creates an empty campaign, sets it Active, and selects it. In the dialog, check every involved faction (all checked factions receive credit and world-effect fan-out); the radio marks the ★ primary (beat inheritance, war-log targeting, casualty defaults).",
  bundles: "Bundles — move whole campaigns between worlds. A bundle is a JournalEntry compendium entry carrying the campaign, optionally plus the global encounter tables and the quest registry.",
  "io-export": "Export — writes the selected campaign into an unlocked JournalEntry compendium as a bundle entry. Options: include the global encounter tables, include the quest registry, and scrub world-specific scene/actor/journal references.",
  "io-import": "Import — reads a bundle entry from a JournalEntry compendium. Merge overwrites the campaign with the same id; Duplicate creates a new id with your prefix. Optionally sets the import Active; unresolved references are reported for Remap.",
  "io-remap": "Remap — after an import, re-links beat references to Scenes/Actors/Journals by matching the stable flags.bbttcc.key values recorded at export time. Anything unresolvable is listed in the console.",
  "io-scan-keys": "Key Report — lists every Scene/Actor/Journal missing a flags.bbttcc.key stable key. Set keys on anything your beats reference BEFORE exporting, or Remap can't reconnect them in the destination world.",
  selected: "Selected Campaign — a read-only snapshot of the loaded campaign (label, description, faction roster). Use Campaign Settings… to change anything here.",
  "campaign-settings": "Campaign Settings… — edit the label, description, and active-faction roster, and toggle Active. Changing the ★ primary faction also rewrites every beat and world-effect row that inherited the old primary so they point at the new one.",
  "meta-label": "Label — the campaign's display name. Read-only here; edit via Campaign Settings….",
  "meta-description": "Description — GM notes for the campaign. Read-only here; edit via Campaign Settings….",
  "active-factions": "Active Factions — the campaign roster. Every listed faction receives credit / world-mutation fan-out from beats; the ★ Primary is the default target for beat inheritance, the war log, and casualty defaults.",
  "primary-chip": "★ Primary — the campaign's default faction: beats set to 'inherit' resolve to it, and it is the default for war-log targeting and casualty bookkeeping.",

  // ── Travel Tables tab ─────────────────────────────────────────────────────
  "travel-list": "Travel Tables — encounter tables with scope 'travel' from the global table registry. The travel engine resolves them by EXACT id (travel_<terrain>_t<tier>) when a leg rolls an encounter — a table with a malformed id silently never fires (use Fix Travel Tables).",
  "travel-terrain": "Terrain — filters the list to one terrain (parsed from table id/tags/label). Display filter only; it never changes which table the engine rolls in play.",
  "travel-tier": "Tier — filters the list to one tier (the _t<n> id suffix). Display filter only.",
  "travel-show-all": "Show All — clears the terrain and tier filters so every travel table is listed.",
  "travel-preview": "Preview Roll — a true DRY RUN: rolls the travel table matching the current terrain/tier through the live engine's own conditions and weights, then shows which beat WOULD fire — nothing executes (no scene, no dialogs, no world effects, no time). The result dialog offers a clearly-labeled 'Run This Beat Now' button if you want to fire it for real.",
  "fix-travel-tables": "Fix Travel Tables — scans for non-canonical or duplicate travel ids and for entries whose terrain/tier conditions contradict their own table, shows a review plan, and only writes after you confirm. Run it whenever a terrain 'stopped producing' encounters.",
  "new-travel-table": "+ New Travel Table — creates an empty travel table; the id is composed automatically as travel_<terrain>_t<tier> so the engine can resolve it, then the Table Editor opens. Entries point at campaign beats with weights and conditions.",
  "travel-scope": "Scope — where the table applies. 'travel' tables are resolved automatically by the travel engine; other scopes only fire when run by hand or by another system.",
  "travel-tags": "Tags — free-form labels on the table. Terrain/tier tags also serve as a parsing fallback when the id is malformed (Fix Travel Tables uses them to recover the canonical id).",
  "edit-table": "Edit — opens the Table Editor. Each entry is (campaign, beat, weight, conditions); a roll filters entries by conditions, then weighted-picks ONE beat and runs it.",
  "duplicate-table": "Duplicate — copies this table's entries into a new table. Travel copies must pick a terrain/tier (the id is composed to stay engine-resolvable); other tables take a free slugified id.",
  "delete-table": "Delete — removes the table from the registry (confirm, no undo). The beats its entries pointed at are untouched.",

  // ── Beats tab ─────────────────────────────────────────────────────────────
  "beats-list": "Beats — the selected campaign's beats in canonical array order. Order matters: it is the # column, the Visualizer's root (first beat), and what Run (campaign) fires first.",
  "beats-count": "Shown / total — how many beats survive the current filters, out of the campaign's full list.",
  "beats-search": "Filter — live text match against beat id, label, and type. Display only.",
  "beats-type": "Type — show only one beat type (the list is collected from this campaign's beats: cinematic, encounter, custom…).",
  "beats-turn": "Turn — show only beats assigned to one Strategic Turn (beat.turnNumber, or a turn:N tag). 'Unassigned' = beats with no turn gate.",
  "beats-quest": "Quest — show only beats linked to one quest (beat.questId, set in the Beat Editor).",
  "beats-quest-status": "Quest status — show only beats whose linked quest is active / completed / archived. Independent of the Quests tab's status dropdown; filtering here never filters there.",
  "reindex-beats": "Compact Order — rewrites the beats array, dropping null/empty slots, and renumbers the # column. Housekeeping only; run it if numbering looks wrong after heavy editing.",
  "add-beat": "+ Add Beat — appends a stub beat to the END of the list and opens it in the Beat Editor. Remember: the FIRST beat in the list is what Run (campaign) fires.",
  "fired-chip": "✓ fired — the Story Director record shows this beat already ran on some surface (director tick, this Builder, Story Console, or NPC dialogue). Soft lock: ▶ Run asks for one confirmation; it never blocks.",
  "quest-chip": "Quest — the quest this beat belongs to (beat.questId) and that quest's current status. Assigned in the Beat Editor.",
  "turn-chip": "Turn gate — this beat is whispered to the GM as 'now available' when the Strategic Turn reaches this number (world turn-availability map). Advisory only: you can still run the beat at any time.",
  "move-top": "⤒ — move this beat to the top of the canonical order (position 1).",
  "move-up": "▲ — move this beat one slot up in the canonical order.",
  "move-down": "▼ — move this beat one slot down in the canonical order.",
  "move-bottom": "⤓ — move this beat to the bottom of the canonical order.",
  "set-index": "Set index — type a 1-based position; the beat is spliced to that slot in the canonical order. Order drives the # column, the Visualizer root, and Run (campaign).",
  "run-beat": "▶ Run — executes the beat NOW: journal auto-open, narration audio, scene activation (or cinematic chain), description/choices dialog, encounter launch, world & quest effects, and its time cost (timeScale → world time points). Already-fired beats ask for one confirm.",
  "edit-beat": "Edit — opens the Beat Editor (label/type/turn, scene, dialog & choices, outcomes, actors, encounter, world effects, audio…). Saving an id change rewrites other beats' outcome/choice links to follow it.",
  "beat-menu": "More actions — Duplicate and Delete.",
  "duplicate-beat": "Duplicate — deep-copies the beat under a new id (…_copy_xxxx), appends it to the list, and opens it in the editor. Its outcome/choice links still point wherever the original pointed.",
  "delete-beat": "Delete — removes the beat (no undo). The confirm dialog first scans for anything linking to it (other beats' next/outcome/choice routes and encounter-table entries) and offers 'Delete + Clear Links' (also nulls those routes and removes the table entries) or 'Delete Only' (leaves them dangling).",

  // ── Quests tab ────────────────────────────────────────────────────────────
  "quests-list": "Quests — the world quest registry filtered to this campaign. A quest is grouping + bookkeeping: beats reference it via beat.questId, hexes via quest links; status feeds filters and the Visualizer's bubble colors.",
  "quest-search": "Search — live text match on quest name and id. Display only.",
  "quest-status": "Status — filter quests by active / completed / archived. Independent control: it no longer affects the Beats tab's quest-status filter.",
  "new-quest": "+ New Quest — creates a quest record scoped to the selected campaign. The Quest ID is the stable key beats reference (beat.questId) — it is locked after creation.",
  "quest-status-chip": "Status — active (in play), completed, or archived. Status is bookkeeping: it colors the Visualizer bubble and drives filters; beats linked to the quest still run regardless.",
  "link-hex": "＋ Link Hex — arms a one-shot canvas picker: click a Bad Eden hex drawing to link it to this quest (two-way: a flag on the hex + quest.hexIds). Clicking anything that isn't a hex cancels.",
  "hex-hint-status": "hinted / fog-gated — players see this quest's marker on the hex if the hex is fog-revealed OR its hint is on ('hinted' = rumor preview through fog). The GM always sees everything.",
  "toggle-hint": "Reveal / Hide — toggles this one hex's hint flag: Reveal lets players see the quest marker through fog; Hide returns it to fog-gated visibility.",
  "reveal-all-hints": "Reveal All Hints — turns the hint flag ON for every hex linked to this quest, so players see all of its markers through fog.",
  "clear-all-hints": "Clear Hints — turns every linked hex's hint flag OFF (back to fog-gated visibility).",
  "pan-to-hex": "⌖ — switches to the hex's scene if needed and pans the canvas to the hex.",
  "unlink-hex": "✕ — removes the hex↔quest link on both sides (confirm). The hex and the quest themselves are untouched.",
  "quest-move-up": "▲ — swap this quest one slot up in the FULL registry order (the sort used in quest lists, dropdowns, and the Visualizer's bubbles). With a search/status filter active the true neighbor may be hidden, so the visible list can look unchanged.",
  "quest-move-down": "▼ — swap this quest one slot down in the FULL registry order (with a filter active the swap partner may be a hidden quest).",
  "edit-quest": "Edit — change the quest's name, status, and description. The Quest ID is locked because beats reference it.",
  "complete-quest": "Complete — sets status to 'completed'. Pure bookkeeping: filters update and the Visualizer bubble turns green; beats keep their questId and can still run.",
  "archive-quest": "Archive — sets status to 'archived' (shelved: hidden by the Active filter, gray in the Visualizer). Reversible with Reopen.",
  "reopen-quest": "Reopen — sets the quest's status back to 'active'.",
  "delete-quest": "Delete — removes the quest record from the registry (confirm). Beats KEEP their questId (their chip just loses its name). Every linked hex is listed in the confirm and unlinked automatically (both sides) — no orphaned hex flags.",

  // ── Visualizer tab ────────────────────────────────────────────────────────
  flow: "Visualizer — a read-only flow map of the selected campaign built from beat links: Next/Success/Failure are solid edges (green/red for outcomes), Choices are dashed. Nothing here mutates the campaign.",
  "flow-toggle-travel": "Show/Hide Travel — include or exclude the travel lane (beats with timeScale 'leg' or a travel tag) from the graph.",
  "flow-zoom-in": "Zoom in (+30% per click). Tip: the mouse wheel zooms straight to the cursor.",
  "flow-zoom-out": "Zoom out (−30% per click). Tip: the mouse wheel zooms straight to the cursor.",
  "flow-reset": "Fit — returns zoom and pan to the whole-graph view.",
  "flow-canvas": "Flow map — drag the background to pan. Beats view: click a node to open it in the Beat Editor. Quests view: click a bubble to expand its inner beat chips; click a chip to edit that beat.",
  "flow-turn": "Turn — restrict the graph to beats assigned to one Strategic Turn (All Turns = the whole campaign).",
  "flow-quest": "Quest — keep only that quest's beats PLUS everything reachable from them (forward closure), so cross-quest hand-offs stay visible.",
  "flow-view": "View — Quests (overview): one bubble per quest with aggregated cross-quest links. Lanes (arc): one horizontal lane per quest in authoring order, every beat shown (nothing pruned), gates surfaced as ⛩ badges. Beats (detail): the per-beat decision tree — disconnected beats root their own trees to the right. Your choice persists per user."
};

function _registerCampaignHelp() {
  try { game.bbttcc?.help?.register?.("campaign", CAMPAIGN_HELP); }
  catch (e) { warn("campaign help registration failed:", e); }
}

Hooks.once("init", () => {
  game.settings.register(MOD_ID, SETTING_CAMPAIGNS, {
    name: "Bad Eden Campaign Definitions",
    hint: "Internal storage for Bad Eden Campaign Builder. Do not edit manually.",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MOD_ID, SETTING_INJECT_STATE, {
    name: "Bad Eden Campaign Injector State",
    hint: "Internal gating state for campaign beat injection (cooldowns / oncePerHex).",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MOD_ID, SETTING_TABLES, {
    name: "Bad Eden Encounter Tables",
    hint: "Internal storage for Bad Eden Random Encounter Tables. Do not edit manually.",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MOD_ID, SETTING_QUESTS, {
    name: "Bad Eden Quest Registry",
    hint: "Internal storage for Bad Eden Quests (definitions). Do not edit manually.",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  // NEW: UI preference  -  which campaign is "active" (auto-selected in Builder)
  game.settings.register(MOD_ID, SETTING_ACTIVE_CAMPAIGN, {
    name: "Bad Eden Active Campaign",
    hint: "Internal UI preference: the campaign which should be selected by default in the Campaign Builder.",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  // NEW: Campaign Turn Flow  -  remembers the last Strategic Turn we announced
  // so we don't spam messages on reload. Stored as an integer.
  game.settings.register(MOD_ID, SETTING_LAST_TURN_ANNOUNCED, {
    name: "Bad Eden Campaign Turn Announcements (Last Turn)",
    hint: "Internal: last Strategic Turn number for which Campaign Turn Flow was announced.",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });

  // Turn Ledger (2026-07-08): one World Turn = a time budget in days.
  game.settings.register(MOD_ID, SETTING_TURN_TIME_BUDGET, {
    name: "Bad Eden: Turn Time Budget (days)",
    hint: "Days in one Strategic Turn — the month. Beats and travel debit it; unspent days bank into development at turn end. world.time.turnLength is kept in sync with this.",
    scope: "world",
    config: true,
    type: Number,
    default: 30
  });
  game.settings.register(MOD_ID, SETTING_LEDGER_ENTRIES, {
    name: "Bad Eden Turn Ledger Entries",
    hint: "Internal: this turn's time debits (source, days, note). Reset on each applied turn advance.",
    scope: "world",
    config: false,
    type: Object,
    default: { turn: 0, entries: [] }
  });
  game.settings.register(MOD_ID, SETTING_LEDGER_TRAVEL_TIER_DAYS, {
    name: "Bad Eden: Travel Days per Hex by Tier",
    hint: "CSV: days to cross one hex for terrain tiers 1..4 (default 1,1,2,3). Calibration-pass fodder — tune with the global DC pass.",
    scope: "world",
    config: true,
    type: String,
    default: "1,1,2,3"
  });

  // Forgotten-Cause arc: per-world Wendigo "something OFF" rung (0–4). Bumped
  // when a Wendigo travel-encounter beat resolves; gates the Dougan -> Confluence
  // pointer (rung >= 3) and the Mal escalation cards (wired in later steps).
  game.settings.register(MOD_ID, SETTING_WENDIGO_RUNG, {
    name: "Bad Eden Wendigo Rung",
    hint: "Internal: per-world Wendigo 'something OFF' escalation meter (0–4). Do not edit manually.",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });

  // Phase Charter act ladder (PHASE-CHARTER-2026-07-15.md). Advanced by
  // landmark closer beats (worldEffects.phaseAdvance) and calendar hard
  // doors; GM can override via the Reset Console's World section.
  game.settings.register(MOD_ID, SETTING_STORY_PHASE, {
    name: "Bad Eden Story Phase",
    hint: "Internal: the campaign's act (0 Offices → 6 Gloomgill). Gates use { flag:'storyPhase', gte:N }.",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });

  // Tikkun Dividend (FINALE-WIN-COUPLING-2026-07-15.md v2): arc-1 legacy
  // meter, raised only by landmark closers (worldEffects.tikkunDelta).
  game.settings.register(MOD_ID, SETTING_TIKKUN, {
    name: "Bad Eden Tikkun Dividend",
    hint: "Internal: earned redemption ease (0–5). Raised by landmark outcome beats; read by epic alignment, purity drift, and integration upkeep.",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });

  // Step 4: fire-once latch so Dougan points to the Confluence at most once.
  game.settings.register(MOD_ID, SETTING_DOUGAN_POINTED, {
    name: "Bad Eden Dougan Pointed",
    hint: "Internal: whether Dougan has already pointed players to the Wendigo Confluence. Do not edit manually.",
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  // Bandit Accord: the mercy ledger — armed latch + twin meters (mercy/fear).
  game.settings.register(MOD_ID, SETTING_BANDIT_ARMED, {
    name: "Bad Eden Bandit Ledger Armed",
    hint: "Internal: whether the Bandit Accord opening beat has announced the theme (mercy counts only after). Do not edit manually.",
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });
  game.settings.register(MOD_ID, SETTING_BANDIT_MERCY, {
    name: "Bad Eden Bandit Mercy",
    hint: "Internal: Bandit Accord mercy count (spared/jailed bandits). Do not edit manually.",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });
  game.settings.register(MOD_ID, SETTING_BANDIT_FEAR, {
    name: "Bad Eden Bandit Fear",
    hint: "Internal: Bandit Accord fear count (killed bandits; suppresses the mercy arc). Do not edit manually.",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });

  // Geburah conduct ledger (0-3 each). Written by the fragment outcome beats.
  for (const [key, name] of [
    [SETTING_GEBURAH_EARNED, "Bad Eden Geburah Earned"],
    [SETTING_GEBURAH_FORCED, "Bad Eden Geburah Forced"]
  ]) {
    game.settings.register(MOD_ID, key, {
      name, hint: "Internal: how the Lost Stone Statues' fragments were taken. Drives the statues' later greetings and the final verdict.",
      scope: "world", config: false, type: Number, default: 0
    });
  }

  // Grief-Refusals indict ladders (0-4). GM-raised until the frozen-hex engine exists.
  for (const [key, name] of [
    [SETTING_CHUCKLE_SEEN,     "Bad Eden Chuckle Creek Rung"],
    [SETTING_STILLWATER_CRACK, "Bad Eden Stillwater Crack"],
    [SETTING_SOFTLANDING_GIVE, "Bad Eden Soft Landing Give"]
  ]) {
    game.settings.register(MOD_ID, key, {
      name, hint: "Internal: Grief-Refusals indict rung (0-4). Gates that hex's ladder beats.",
      scope: "world", config: false, type: Number, default: 0
    });
  }

  // The Cadence: dance-battle standing-state flags (0/1), written by outcomes.
  for (const [key, name] of [
    [SETTING_CADENCE_RESPECT, "Bad Eden Cadence Respect"],
    [SETTING_CADENCE_TRIBUTE, "Bad Eden Cadence Tribute"],
    [SETTING_CADENCE_UNCONTESTED, "Bad Eden Cadence Uncontested"]
  ]) {
    game.settings.register(MOD_ID, key, {
      name,
      hint: "Internal: Cadence dance-battle standing state (0/1). Do not edit manually.",
      scope: "world",
      config: false,
      type: Number,
      default: 0
    });
  }

  // Phase 0 observability: verbose beat-audio console tracing. Off by default.
  // When on, every enter/exit of the audio path logs caller, token, src, and
  // flags so we can prove behavior before/after each audio-refactor phase.
  game.settings.register(MOD_ID, "audio.debug", {
    name: "Bad Eden Audio Debug Logging",
    hint: "Log every beat-audio play/stop/socket event to the browser console. Useful for diagnosing echo/ghost-sound issues; leave off during normal play.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MOD_ID, SETTING_OVERSHOOT_BEATS, {
    name: "Reality Tear — Adversary draws a Beat",
    hint: "When a roll overshoots its DC into the Rupture (+40) or Sundering (+50) band, draw a matching 'adversary'-tagged Beat from the active campaign (the injector auto-selects it). Off = the system's Reality-Tear chat line stays purely narrative.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MOD_ID, SETTING_DIRECTOR_ENABLED, {
    name: "Story Director — World-Turn tick",
    hint: "Each applied world-turn advance, the Story Director checks the active campaign's story beats (beats with a storyChain) and offers the highest-priority eligible one to the GM — at most one story beat per turn. Off = story beats only fire by hand or via other channels.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MOD_ID, SETTING_DIRECTOR_STATE, {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MOD_ID, SETTING_DIRECTOR_AUTOINVITE, {
    name: "Story Director — auto-invite to conversations",
    hint: "When a story moment carried by an NPC (a beat with a speaker) becomes available, post a public '<NPC> wants a word' chat card with a Talk button — the narration→conversation handoff. Each moment invites once. Off = moments stay quietly available in dialogue and via the director's turn-tick prompt.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MOD_ID, SETTING_DIRECTOR_PRESSURE_THRESHOLD, {
    name: "Story Director — mid-turn pressure threshold",
    hint: "Story pressure builds from play (world turn +30, travel leg +8, raid round +10, resolved beat +3). When it crosses this threshold, the director may also offer a story beat MID-turn (travel legs, raid rounds, beat resolutions) instead of waiting for the next turn tick. Firing resets pressure; declining halves it. Higher = story only at turn boundaries; lower = story leans into the flow of play.",
    scope: "world",
    config: true,
    type: Number,
    default: 60
  });

  game.settings.register(MOD_ID, SETTING_DIRECTOR_TTONLY_CHAINS, {
    name: "Story Director — turn-tick-only chains",
    hint: "Comma-separated storyChain names that only fire on the world-turn tick, never from mid-turn seams (travel legs, raid rounds, beat resolutions). Keeps spine legs from cascading the moment their gate opens — hex play breathes between them. Gates are unchanged; only timing narrows.",
    scope: "world",
    config: true,
    type: String,
    default: "valhaulan_spine"
  });

  try {
    const H = globalThis.Handlebars;
    if (H) {
      if (!H.helpers.add) H.registerHelper("add", (a, b) => Number(a || 0) + Number(b || 0));
      if (!H.helpers.eq)  H.registerHelper("eq", (a, b) => a === b);
      // Fallback {{bbttccTip}} so our templates render even when this module's
      // init runs before bbttcc-core's (or bbttcc-core is disabled — a mustache
      // with args and no helper would otherwise throw "Missing helper").
      if (!H.helpers.bbttccTip) {
        H.registerHelper("bbttccTip", (appKey, key) => game.bbttcc?.help?.tip?.(appKey, key) ?? "");
      }
    }
  } catch (e) {
    warn("Handlebars helpers failed:", e);
  }

  // Central help dictionary (best-effort here; re-run at ready in case
  // bbttcc-core's init hasn't installed game.bbttcc.help yet).
  _registerCampaignHelp();

  log("Initialized, settings registered, helpers ready.");
});

// READY
Hooks.once("ready", () => {
  game.bbttcc ??= { api: {} };
  game.bbttcc.api ??= {};
  game.bbttcc.api.campaign = buildCampaignAPI();
  // Open-choice introspection (2026-08-24): the Visualizer's hero shows the
  // REAL state of play — when a beat dialog is open, the table is choosing,
  // and that IS what's next. Reads the module-level current-dialog ref.
  game.bbttcc.api.campaign.openBeatDialog = () => {
    const b = __bbttccCurrentBeatDialogBeat;
    if (!b) return null;
    return {
      beatId: b.id,
      label: b.label || b.id,
      choices: (b.choices || []).map(c => String(c?.label || "")).filter(Boolean)
    };
  };
  // Help registry is guaranteed installed by now (bbttcc-core init < any ready).
  _registerCampaignHelp();
  installInjectorHooks();
  // Reality Tear → Adversary draws a Beat. Listen for the system's overshoot
  // broadcast; primary GM draws a tag-matched beat, players relay via socket.
  Hooks.on("fourththing.overshoot", _onOvershootHook);
  _installOvershootSocket();
  // Forgotten-Cause arc (step 1): bump the per-world Wendigo rung when a Wendigo
  // travel beat resolves. Pure reactive subscriber — no behavior change to beats.
  Hooks.on("bbttcc:beat:resolved", _onBeatResolvedWendigoRung);
  Hooks.on("bbttcc:beat:resolved", _onBeatResolvedGeburah);
  // Forgotten-Cause arc (step 3): move feud state (causeRecovered / heat /
  // peace-by-deletion) when the Confluence + Cultural Summit beats resolve.
  Hooks.on("bbttcc:beat:resolved", _onBeatResolvedFeudState);
  // Step 4: Dougan points to the Confluence when his convo resolves at rung >= 3.
  Hooks.on("bbttcc:beat:resolved", _onBeatResolvedDouganPointer);
  // Bandit Accord: mercy/fear ledger — armed by the opening beat, bumped by
  // bandit-encounter resolutions, offers the arms-down variant at rung ≥ 3.
  Hooks.on("bbttcc:beat:resolved", _onBeatResolvedBanditLedger);
  // The Cadence: outcome beats write the respect/tribute/uncontested flags
  // that gate the standing offers (rematch, border show, the owed cameo).
  Hooks.on("bbttcc:beat:resolved", _onBeatResolvedCadence);
  // Story Director (Phase 3): milestone beats raise steward/faction level floors.
  Hooks.on("bbttcc:beat:resolved", _onBeatResolvedLevelEffects);
  // Dialogue-driven beats: NPC event memory + one-shot moment consumption for
  // beats with a speakerActorId (any resolution surface — menu or dialogue).
  Hooks.on("bbttcc:beat:resolved", _onBeatResolvedSpeakerMemory);
  // Surface reconciliation: EVERY storyChain beat resolution marks
  // firedStoryBeats (consumption is global, whichever surface ran it) …
  Hooks.on("bbttcc:beat:resolved", _onBeatResolvedStoryMark);
  // … and newly-opened speaker moments announce themselves with a public
  // "wants a word" invitation card (once each; setting director.autoInvite).
  Hooks.on("bbttcc:beat:resolved", _onBeatResolvedInviteScan);
  // Story Director (Phase 3): the World-Turn tick. Apply-only (skip previews);
  // the advanceTurn driver fires this hook locally on the advancing GM client,
  // and the world clock is already bumped when it arrives. Reconcile runs each
  // turn too, so late joiners / reincarnated stewards snap back onto the curve.
  Hooks.on("bbttcc:advanceTurn:end", (tctx) => {
    try {
      if (!tctx || tctx.apply !== true) return;
      if (!game.user?.isGM) return;
      _directorAddPressure(DIRECTOR_PRESSURE.turn, "turn")
        .then(() => directorTick({}))
        .catch(e => warn("[director] turn tick failed:", e));
      directorReconcileLevels({}).catch(e => warn("[director] turn reconcile failed:", e));
    } catch (e) {
      warn("[director] advanceTurn listener failed:", e);
    }
  });
  // Turn Ledger (2026-07-08): record every accrual, convert travel legs to
  // days, settle the month on each applied turn advance. The beat debit path
  // (_applyBeatTimePoints → world.addTime) lights up on its own now that the
  // sink exists — no beat-side wiring needed here.
  Hooks.on("bbttcc:time:accrued", _onTimeAccruedLedger);
  Hooks.on("bbttcc:afterTravel", _onAfterTravelLedger);
  Hooks.on("bbttcc:advanceTurn:end", (tctx) => {
    _onAdvanceTurnEndLedger(tctx).catch(e => warn("[ledger] turn-end listener failed:", e));
  });
  if (game.user?.isGM) _ledgerSyncBudget();
  // Story Director (Phase 4): mid-turn seams. Each accrues pressure; the
  // director only actually looks once pressure crosses the threshold (see
  // _directorSeamLook — budget + gates + GM veto still apply).
  Hooks.on("bbttcc:afterTravel", (tctx) => {
    try {
      if (!game.user?.isGM) return;
      _directorAddPressure(DIRECTOR_PRESSURE.leg, "travel")
        .then(() => _directorSeamLook("travel"))
        .catch(e => warn("[director] travel seam failed:", e));
    } catch (e) { warn("[director] afterTravel listener failed:", e); }
  });
  Hooks.on("bbttcc:raid:roundCommit", (rctx) => {
    try {
      if (!game.user?.isGM) return;
      _directorAddPressure(DIRECTOR_PRESSURE.raidRound, "raid")
        .then(() => _directorSeamLook("raid"))
        .catch(e => warn("[director] raid seam failed:", e));
    } catch (e) { warn("[director] roundCommit listener failed:", e); }
  });
  Hooks.on("bbttcc:beat:resolved", (bctx) => {
    try {
      if (!game.user?.isGM) return;
      // Story beats don't build story pressure (no feedback loop): the beat
      // the director just fired must not immediately re-arm the director.
      if (bctx?.beat && _storyChainOf(bctx.beat)) return;
      _directorAddPressure(DIRECTOR_PRESSURE.beat, "beat")
        .then(() => _directorSeamLook("beat"))
        .catch(e => warn("[director] beat seam failed:", e));
    } catch (e) { warn("[director] beat-resolved seam listener failed:", e); }
  });
  // Story Director: Level-Up chat-card button (runs on every client — players
  // click their own steward's card).
  _installDirectorLevelupDelegation();
  // BeatAudioManager owns the socket listener and all audio state.
  try { globalThis.__bbttccBeatAudioManager?.init(); } catch (_eMgrInit) {}
  _installBeatAudioSocket();
  _installPlayerFacingChatBridge();
  // Beat Narration controls + event-sourced audio facade.
  try {
    const mgr = globalThis.__bbttccBeatAudioManager || null;
    game.bbttcc.api.campaign.audio = mgr ? {
      play: (beat, opts) => mgr.playForBeat(beat, opts || {}),
      stop: (opts) => mgr.stopAll(opts || {}),
      preview: (beat) => mgr.previewBeat(beat),
      preload: (src) => mgr.preload(src),
      on: (event, fn) => mgr.on(event, fn),
      off: (event, fn) => mgr.off(event, fn),
      get current() { return { beatId: mgr.currentBeatId, src: mgr.currentSrc }; }
    } : null;

    game.bbttcc.api.campaign.stopBeatNarration = () => {
      try { _stopBeatAudio({ push: true, caller: "api-stopBeatNarration" }); } catch (_eS) {}
    };
    game.bbttcc.api.campaign.closePlayerFacingBeatDialog = () => {
      try { _closePlayerFacingDialogLocal(); } catch (_eS2) {}
      try { _broadcastPlayerFacingDialog("close", {}); } catch (_eB2) {}
      try { _stopBeatAudio({ push: true, caller: "api-closeDialog" }); } catch (_eS2b) {}
    };
    game.bbttcc.api.campaign.showPlayerFacingBeatDialog = (payload) => {
      try { _showPlayerFacingDialogLocal(payload || {}); } catch (_eS3) {}
      try { _broadcastPlayerFacingDialog("show", payload || {}); } catch (_eB3) {}
    };
  } catch (_eAPI) {}

  log("Campaign API installed on game.bbttcc.api.campaign.", game.bbttcc.api.campaign);
  // Build Encounter Engine scenario index from campaign encounter beats.
  _scheduleEncounterRebuild();

  // Campaign Turn Flow: keep bbttcc-world's per-turn availability map in sync for the active campaign.
  try {
    var active = getActiveCampaignId();
    if (active) _syncWorldTurnBeatsForCampaign(active);
  } catch (_e0) {}

  // Campaign Turn Flow: announce "now available" beats when Strategic Turns advance.
  // Turn Driver fires bbttcc:advanceTurn:end after it completes.
  try {
    if (!globalThis.__bbttccCampaignTurnFlowHookInstalled) {
      globalThis.__bbttccCampaignTurnFlowHookInstalled = true;
      // A preview (apply:false) hasn't advanced anything — don't announce it.
      Hooks.on("bbttcc:advanceTurn:end", function(payload){
        if (payload && payload.apply === false) return;
        _announceTurnAvailabilityIfNeeded();
      });
    }
  } catch (_e1) {}
});

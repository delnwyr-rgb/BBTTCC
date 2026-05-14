/* bbttcc-agent-api.js
 * BBTTCC Agent Boundary (Dry-Run v0.5)
 *
 * Adds dual-registry support:
 * - Runtime: game.bbttcc.api.raid.EFFECTS (live Raid Console source)
 * - Design: JSON file (bbttcc_maneuvers_v1_4.json)
 *
 * Hard rules:
 * - NEVER commits raids
 * - NEVER spends OP
 * - NEVER mutates world state
 * - NEVER calls World Mutation Engine
 */
(function () {
  "use strict";

  const TAG = "[bbttcc-agent]";
  const log  = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);

  const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];

  // Path relative to the bbttcc-raid module root.
  // Your current location: Data/modules/bbttcc-raid/data/bbttcc_maneuvers_v1_4.json
  const JSON_MANEUVER_REL_PATH = "data/bbttcc_maneuvers_v1_4.json";

  function copy(obj) {
    try { return foundry.utils.duplicate(obj ?? {}); }
    catch { return JSON.parse(JSON.stringify(obj ?? {})); }
  }

  function clamp0(v) { v = Number(v ?? 0) || 0; return v < 0 ? 0 : v; }

  function zOP() {
    const o = {};
    for (const k of OP_KEYS) o[k] = 0;
    return o;
  }

  function normalizeOPKey(k) {
    const s = String(k || "").trim();
    if (!s) return "";
    const low = s.toLowerCase();

    // Canonicalize common aliases / casing
    if (k === "softPower") return "softpower";
    if (k === "nonLethal") return "nonlethal";

    if (low === "soft_power" || low === "soft power") return "softpower";
    if (low === "non_lethal" || low === "non lethal") return "nonlethal";

    if (OP_KEYS.includes(low)) return low;
    return low;
  }

  function normalizeCost(cost) {
    const out = zOP();
    const c = cost ?? {};
    for (const [k, v] of Object.entries(c)) {
      const nk = normalizeOPKey(k);
      if (!nk || !OP_KEYS.includes(nk)) continue;
      out[nk] = clamp0(v);
    }
    return out;
  }

  function isSuccessTier(tierOrResult) {
    const s = String(tierOrResult ?? "").toLowerCase();
    return (s === "success" || s === "greatsuccess" || s === "great_success" || s === "win" || s === "won");
  }

  function getRaidAPI() {
    return game.bbttcc?.api?.raid || null;
  }

  function getEffectsRegistry() {
    const raid = getRaidAPI();
    return raid?.EFFECTS || {};
  }

  // Normalize raidTypes from JSON-ish strings to a stable key-ish format
  // Examples:
  // "Assault" -> "assault"
  // "Assault (defense)" -> "assault_defense"
  // "Ritual/Tikkun" -> "ritual_tikkun"
  function normalizeRaidType(rt) {
    let s = String(rt || "").trim().toLowerCase();
    if (!s) return "";
    s = s.replace(/[\/]+/g, "_");
    s = s.replace(/\s*\(\s*/g, "_").replace(/\s*\)\s*/g, "");
    s = s.replace(/[^a-z0-9_]+/g, "_").replace(/_+/g, "_");
    return s;
  }

  function deriveKeyFromName(name) {
    // "Rally the Line [T1]" -> "rally_the_line"
    let s = String(name || "").toLowerCase();
    s = s.replace(/\[[^\]]+\]/g, "");     // drop [T1]
    s = s.replace(/[’']/g, "");          // drop apostrophes
    s = s.replace(/[^a-z0-9]+/g, "_");   // non-alnum to _
    s = s.replace(/^_+|_+$/g, "");
    return s;
  }

  // ----------------------------
  // Design Registry (JSON file)
  // ----------------------------
  let _jsonCache = null;
  let _jsonCacheTs = 0;

  async function loadJsonManeuvers() {
    if (_jsonCache && (Date.now() - _jsonCacheTs) < 10_000) return _jsonCache;

    const mod = game.modules.get("bbttcc-raid") || null;
    if (!mod?.active) {
      warn("bbttcc-raid module not active; JSON registry unavailable.");
      _jsonCache = [];
      _jsonCacheTs = Date.now();
      return _jsonCache;
    }

    const base =
      (typeof mod.url === "string" && mod.url) ? mod.url :
      (typeof mod.path === "string" && mod.path) ? mod.path :
      `/modules/${mod.id}`;

    const url = `${base.replace(/\/+$/,"")}/${JSON_MANEUVER_REL_PATH.replace(/^\/+/,"")}`;

    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();

      const mans = [];
      for (const it of (Array.isArray(data) ? data : [])) {
        const bb = it?.flags?.bbttcc;
        if (!bb || bb.kind !== "maneuver") continue;

        const key = bb.unlockKey || deriveKeyFromName(it.name);
        mans.push({
          key,
          label: it.name?.replace(/\s*\[[^\]]+\]\s*/g, "") || key,
          tier: Number(bb.tier ?? 1) || 1,
          availability: String(bb.availability || "standard").toLowerCase(),
          unlockKey: bb.unlockKey || null,
          rarity: bb.rarity || null,
          defenderAccess: bb.defenderAccess || null,
          minFactionTier: Number(bb.minFactionTier ?? 1) || 1,
          raidTypes: Array.isArray(bb.raidTypes) ? bb.raidTypes.map(normalizeRaidType).filter(Boolean) : [],
          effectsText: bb.effects?.text || "",
          cost: normalizeCost(bb.opCosts || {})
        });
      }

      mans.sort((a,b) => (a.tier-b.tier) || String(a.label).localeCompare(String(b.label)));
      _jsonCache = mans;
      _jsonCacheTs = Date.now();
      return mans;
    } catch (e) {
      warn("Failed to load JSON maneuvers from", url, e);
      _jsonCache = [];
      _jsonCacheTs = Date.now();
      return _jsonCache;
    }
  }

  // ----------------------------
  // Runtime Registry (raid.EFFECTS)
  // ----------------------------
  function listRaidManeuvers() {
    const EFFECTS = getEffectsRegistry();
    const out = [];
    for (const [key, eff0] of Object.entries(EFFECTS)) {
      const eff = eff0 || {};
      if (String(eff.kind || "") !== "maneuver") continue;
      out.push({
        key,
        label: eff.label || key,
        tier: Number(eff.tier ?? eff.meta?.tier ?? 1) || 1,
        availability: String(eff.availability || eff.meta?.availability || "standard").toLowerCase(),
        unlockKey: eff.unlockKey || eff.meta?.unlockKey || null,
        raidTypes: Array.isArray(eff.raidTypes) ? eff.raidTypes.map(normalizeRaidType) : [],
        primaryKey: eff.primaryKey || eff.meta?.primaryKey || null,
        cost: normalizeCost(eff.cost || eff.opCosts || eff.meta?.cost || eff.meta?.opCosts || {})
      });
    }
    out.sort((a,b) => (a.tier-b.tier) || String(a.label).localeCompare(String(b.label)));
    return out;
  }

  /* ============================================================
   * BBTTCC Agent Dry-Run Intent Spec (v1)
   *
   * Purpose:
   * - THROUGHPUT handlers return preview-only “intent” objects.
   * - These are NOT applied automatically; they are inspected/audited now,
   *   and will later be mapped to real execution (Raid resolver + WME).
   *
   * Shape (all optional):
   * {
   *   roundEffects?:   Array<{ type: string, ... }>,
   *   scenarioEffects?:Array<{ type: string, ... }>,
   *   worldEffects?:   Array<{ type: string, ... }>,
   *   factionEffects?: Array<{ factionId?: string, ...deltas }>
   *   meta?: { source:"throughput", maneuverKey:string, preview:true }
   * }
   *
   * ---- roundEffects.type (30) ----
   * advantage
   * allyAttackReroll
   * armistice
   * attackerMarginDelta
   * autoWinOpposedRoll
   * borrowOP
   * buffUnit
   * cancelEffectTags
   * cancelEnemyManeuver
   * conditionalPenalty
   * conditionalReward
   * convertEnemyDarknessGain
   * damageMultiplier
   * defenderDCDelta
   * disadvantage
   * forceRerollLowestD20
   * ignoreModifier
   * ignoreStructureLoss
   * momentumControl
   * negateCasualty
   * nullifyAllManeuvers
   * reflectEnemyManeuver
   * repeatAttackEffect
   * repeatLastManeuver
   * rerunFailedRoll
   * rewindRound
   * rollBonus
   * summonEntity
   * tacticalEdge
   * unitSelfDamage
   *
   * ---- scenarioEffects.type (3) ----
   * alarmDelta
   * removeTag
   * structureDelta
   *
   * ---- worldEffects.type (3) ----
   * permanentCapDelta
   * purifySpark
   * restoreHex
   *
   * ---- factionEffects keys observed (9) ----
   * factionId (required when applying; optional in preview)
   * moraleDelta
   * darknessDelta
   * unityDelta
   * deferred: { when:"nextRound"|..., opDeltas:{...} }
   * recurring: { turns:number, opDeltas:{...} }
   * riskModifiers: { darknessRiskMultiplier?:number, ... }
   * when: "afterRound"|"afterVictory"|...
   * note: string
   *
   * Notes:
   * - “preview-only” means these intents are safe to generate at any time.
   * - Real application will:
   *   (a) validate context (target, raidType, role, scenario)
   *   (b) map these intents into Raid state changes and/or WME calls
   *   (c) enforce caps, visibility, and GM authority rules
   * ============================================================ */

  // ----------------------------
  // THROUGHPUT wiring table (preview only)
  // ----------------------------
  const THROUGHPUT = Object.create(null);

  THROUGHPUT["radiant_rally"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;
    return {
      factionEffects: [
        {
          factionId: ctx.attackerFactionId || null,
          moraleDelta: 2,
          darknessDelta: -1,
          note: "Radiant Rally (preview): +2 Morale, -1 Darkness on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "radiant_rally", preview: true }
    };
  };

  THROUGHPUT["supply_overrun"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      factionEffects: [
        {
          factionId: ctx.attackerFactionId || null,
          // Supply Overrun v2: real profit + logistics relief next turn
          label: "Supply Overrun",
          maneuverKey: "supply_overrun",
          deferred: { when: "nextRound", opDeltas: { economy: 2, logistics: 1 } },
          note: "Supply Overrun (preview): Next round gain +2 Economy and +1 Logistics on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "supply_overrun", preview: true }
    };
  };

  THROUGHPUT["prayer_in_the_smoke"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;
    return {
      factionEffects: [
        {
          factionId: ctx.attackerFactionId || null,
          deferred: { when: "nextRound", opDeltas: { faith: 1 } },
          note: "Prayer in the Smoke (preview): +1 Faith OP next round on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "prayer_in_the_smoke", preview: true }
    };
  };

  THROUGHPUT["rally_the_line"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;
    return {
      roundEffects: [
        {
          type: "rollBonus",
          scope: "allies",
          appliesTo: ["attack", "defense"],
          when: "nextRoll",
          amount: 1,
          note: "Rally the Line (preview): +1 to next attack/defense for allies."
        }
      ],
      meta: { source: "throughput", maneuverKey: "rally_the_line", preview: true }
    };
  };

  THROUGHPUT["smoke_and_mirrors"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;
    return {
      scenarioEffects: [
        { type: "alarmDelta", delta: -1, note: "Smoke and Mirrors (preview): Reduce Alarm Level by 1." }
      ],
      meta: { source: "throughput", maneuverKey: "smoke_and_mirrors", preview: true }
    };
  };

  THROUGHPUT["flash_bargain"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;
    return {
      roundEffects: [
        { type: "borrowOP", amount: 1, from: "defender", to: "attacker", note: "Flash Bargain (preview): Borrow +1 enemy OP for this round." }
      ],
      meta: { source: "throughput", maneuverKey: "flash_bargain", preview: true }
    };
  };

  // --- T1 STANDARD: Flank Attack ---
  // Text (runtime): "Strike from an unexpected angle; pressure the line and seize momentum."
  // Preview intent: +1 attacker margin (or +1 to attacker roll) this round.
  THROUGHPUT["flank_attack"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "attackerMarginDelta",
          delta: +1,
          window: "thisRound",
          note: "Flank Attack (preview): Treat attacker margin as +1 higher this round on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "flank_attack", preview: true }
    };
  };

  // --- T1 STANDARD: Defensive Entrenchment ---
  // Text (runtime): "Dig in and harden positions; defender DC +3 this round."
  THROUGHPUT["defensive_entrenchment"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "defenderDCDelta",
          delta: +3,
          window: "thisRound",
          note: "Defensive Entrenchment (preview): Defender DC +3 this round on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "defensive_entrenchment", preview: true }
    };
  };

  // --- T1 STANDARD: Supply Surge ---
  // Text (runtime): "A sudden logistics push; gain a small tactical supply edge this round (GM adjudicates)."
  // Preview intent: advantage-like bump to attacker (kept abstract).
  THROUGHPUT["supply_surge"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "tacticalEdge",
          scope: "attacker",
          amount: 1,
          window: "thisRound",
          note: "Supply Surge (preview): Attacker gains a small tactical supply edge this round on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "supply_surge", preview: true }
    };
  };

  // --- T1 STANDARD: Divine Favor ---
  // Text (runtime): "Call on providence; on success reduce Darkness pressure or negate a minor setback (GM adjudicates)."
  // Preview intent: reduce Darkness by 1 (attacker) as a safe default.
  THROUGHPUT["divine_favor"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      factionEffects: [
        {
          factionId: ctx.attackerFactionId || null,
          darknessDelta: -1,
          note: "Divine Favor (preview): Reduce attacker Darkness by 1 on success (default; GM may adjudicate alternate minor negation)."
        }
      ],
      meta: { source: "throughput", maneuverKey: "divine_favor", preview: true }
    };
  };

  // --- T1 LEARNED: Flash Interdict ---
  // "Cancel enemy Rally/Propaganda maneuver."
  THROUGHPUT["flash_interdict"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "cancelEnemyManeuver",
          tags: ["rally", "propaganda"],
          note: "Flash Interdict (preview): Cancel enemy Rally/Propaganda maneuver on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "flash_interdict", preview: true }
    };
  };

  // --- T1 LEARNED: Last-Stand Banner ---
  // "Defenders ignore first Structure loss this round."
  THROUGHPUT["last_stand_banner"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "ignoreStructureLoss",
          scope: "defender",
          count: 1,
          window: "thisRound",
          note: "Last-Stand Banner (preview): Defenders ignore first Structure loss this round."
        }
      ],
      meta: { source: "throughput", maneuverKey: "last_stand_banner", preview: true }
    };
  };

  // --- T1 LEARNED: Patch the Breach ---
  // "Restore 1 Structure Point."
  THROUGHPUT["patch_the_breach"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      scenarioEffects: [
        {
          type: "structureDelta",
          scope: "defender",
          delta: +1,
          note: "Patch the Breach (preview): Restore 1 Structure Point on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "patch_the_breach", preview: true }
    };
  };

  // --- T1 LEARNED: Suppressive Fire ---
  // "Force enemy reroll lowest d20 this round."
  THROUGHPUT["suppressive_fire"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "forceRerollLowestD20",
          scope: "enemy",
          count: 1,
          window: "thisRound",
          note: "Suppressive Fire (preview): Force enemy reroll lowest d20 this round on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "suppressive_fire", preview: true }
    };
  };

  // --- T2 LEARNED: Industrial Sabotage ---
  // "Target loses 1 Economy OP per turn for 3 turns."
  THROUGHPUT["industrial_sabotage"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      factionEffects: [
        {
          // Industrial Sabotage targets the DEFENDER.
          factionId: ctx.defenderFactionId || null,
          label: "Industrial Sabotage",
          maneuverKey: "industrial_sabotage",
          recurring: {
            turns: 3,
            opDeltas: { economy: -1 }
          },
          note: "Industrial Sabotage (preview): Defender loses 1 Economy OP per turn for 3 turns on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "industrial_sabotage", preview: true }
    };
  };

  // --- T2 LEARNED: Psychic Disruption ---
  // "Opponents roll at Disadvantage this round."
  THROUGHPUT["psychic_disruption"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "disadvantage",
          scope: "opponents",
          window: "thisRound",
          note: "Psychic Disruption (preview): Opponents roll at Disadvantage this round on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "psychic_disruption", preview: true }
    };
  };

  // --- T2 LEARNED: Signal Hijack ---
  // "Enemy communications fail; their Alarm Level +2."
  THROUGHPUT["signal_hijack"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      scenarioEffects: [
        {
          type: "alarmDelta",
          delta: +2,
          note: "Signal Hijack (preview): Enemy Alarm Level +2 on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "signal_hijack", preview: true }
    };
  };

  // --- T2 LEARNED: Tactical Overwatch ---
  // "Reroll one attack die per ally within range."
  THROUGHPUT["tactical_overwatch"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "allyAttackReroll",
          count: "perAllyInRange",
          window: "thisRound",
          note: "Tactical Overwatch (preview): Each ally within range may reroll one attack die this round on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "tactical_overwatch", preview: true }
    };
  };

  // --- T2 LEARNED: Command Overdrive ---
  // "Gain initiative for next round."
  // BBTTCC interpretation: attacker keeps momentum—may retain attacker role next round (no forced flip),
  // or may choose roles next round (GM adjudicates; preview intent only).
  THROUGHPUT["command_overdrive"] = function (ctx) {
    // Narrative-only (Alpha): Command Overdrive affects activity/role order.
    // We intentionally DO NOT emit intents here; the GM adjudicates ordering.
    // Returning null keeps this maneuver purely narrative while preserving its registry entry.
    return null;
  };

  // --- T2 LEARNED: Empathic Surge ---
  // "Empathy Meter +1 after round; heal morale."
  THROUGHPUT["empathic_surge"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      factionEffects: [
        {
          factionId: ctx.attackerFactionId || null,
          unityDelta: +1,
          moraleDelta: +1,
          when: "afterRound",
          note: "Empathic Surge (preview): +1 Unity (Empathy) after round; +1 Morale on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "empathic_surge", preview: true }
    };
  };

  // --- T2 LEARNED: Faithful Intervention ---
  // "Remove 1 Darkness; cancel Qliphothic effects."
  THROUGHPUT["faithful_intervention"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      factionEffects: [
        {
          factionId: ctx.attackerFactionId || null,
          darknessDelta: -1,
          note: "Faithful Intervention (preview): Remove 1 Darkness on success."
        }
      ],
      roundEffects: [
        {
          type: "cancelEffectTags",
          tags: ["qliphothic"],
          window: "thisRound",
          note: "Faithful Intervention (preview): Cancel Qliphothic effects this round on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "faithful_intervention", preview: true }
    };
  };

  // --- T2 LEARNED: Logistical Surge ---
  // "Repeat last round’s maneuver at no cost."
  THROUGHPUT["logistical_surge"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "repeatLastManeuver",
          scope: "attacker",
          costOverride: "free",
          when: "nextRound",
          note: "Logistical Surge (preview): Attacker may repeat last round’s maneuver at no cost next round on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "logistical_surge", preview: true }
    };
  };

  // --- T2 LEARNED: Bless the Fallen ---
  // "Negate first casualty this round."
  THROUGHPUT["bless_the_fallen"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "negateCasualty",
          scope: "attacker",
          count: 1,
          window: "thisRound",
          note: "Bless the Fallen (preview): Negate first casualty this round on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "bless_the_fallen", preview: true }
    };
  };

  // --- T3 LEARNED: Defender’s Reversal ---
  // "Reflect first enemy maneuver used this round."
  THROUGHPUT["defender_s_reversal"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "reflectEnemyManeuver",
          count: 1,
          window: "thisRound",
          note: "Defender’s Reversal (preview): Reflect the first enemy maneuver used this round on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "defender_s_reversal", preview: true }
    };
  };

  // --- T3 LEARNED: Moral High Ground ---
  // "+2 to Empathy Meter after victory."
  // Empathy Meter is legacy; BBTTCC interpretation: +2 Unity after a successful round/victory.
  THROUGHPUT["moral_high_ground"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      factionEffects: [
        {
          factionId: ctx.attackerFactionId || null,
          unityDelta: +2,
          when: "afterVictory",
          note: "Moral High Ground (preview): +2 Unity after victory on success (legacy Empathy Meter)."
        }
      ],
      meta: { source: "throughput", maneuverKey: "moral_high_ground", preview: true }
    };
  };

  // --- T3 LEARNED: Quantum Shield ---
  // "Reduce incoming damage by half for one round."
  THROUGHPUT["quantum_shield"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "damageMultiplier",
          scope: "incoming",
          target: "defender",
          multiplier: 0.5,
          window: "thisRound",
          note: "Quantum Shield (preview): Reduce incoming damage by half for one round on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "quantum_shield", preview: true }
    };
  };

  // --- T2 LEARNED: Saboteur’s Edge ---
  // "Ignore one Fortified modifier this turn."
  THROUGHPUT["saboteur_s_edge"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "ignoreModifier",
          modifier: "fortified",
          count: 1,
          window: "thisTurn",
          note: "Saboteur’s Edge (preview): Ignore one Fortified modifier this turn on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "saboteur_s_edge", preview: true }
    };
  };

  // --- T3 LEARNED: Counter-Propaganda Wave ---
  // "Cancel enemy Soft Power effect this round."
  THROUGHPUT["counter_propaganda_wave"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "cancelEffectTags",
          scope: "enemy",
          tags: ["softpower"],
          window: "thisRound",
          note: "Counter-Propaganda Wave (preview): Cancel enemy Soft Power effects this round on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "counter_propaganda_wave", preview: true }
    };
  };

  // --- T3 LEARNED: Harmonic Chant ---
  // "Allies gain Advantage; Darkness −1."
  THROUGHPUT["harmonic_chant"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "advantage",
          scope: "allies",
          window: "thisRound",
          note: "Harmonic Chant (preview): Allies gain Advantage this round on success."
        }
      ],
      factionEffects: [
        {
          factionId: ctx.attackerFactionId || null,
          darknessDelta: -1,
          note: "Harmonic Chant (preview): Attacker Darkness −1 on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "harmonic_chant", preview: true }
    };
  };

  // --- T3 LEARNED: Siege Breaker Volley ---
  // "Remove 'Fortified' tag from target."
  THROUGHPUT["siege_breaker_volley"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      scenarioEffects: [
        {
          type: "removeTag",
          tag: "fortified",
          target: ctx.target || null,
          note: "Siege Breaker Volley (preview): Remove 'Fortified' tag from target on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "siege_breaker_volley", preview: true }
    };
  };

  // --- T3 LEARNED: Chrono-Loop Command ---
  // "Rerun a failed roll this round; if used twice, Darkness +1."
  THROUGHPUT["chrono_loop_command"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "rerunFailedRoll",
          scope: "attacker",
          window: "thisRound",
          note: "Chrono-Loop Command (preview): Rerun a failed roll this round on success."
        },
        {
          type: "conditionalPenalty",
          condition: "secondUseThisRound",
          factionDelta: { darknessDelta: +1 },
          note: "Chrono-Loop Command (preview): If used twice in the same round, attacker Darkness +1."
        }
      ],
      meta: { source: "throughput", maneuverKey: "chrono_loop_command", preview: true }
    };
  };

  // --- T3 LEARNED: Echo Strike Protocol ---
  // "Apply attack effect twice vs different targets."
  THROUGHPUT["echo_strike_protocol"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "repeatAttackEffect",
          times: 2,
          targetMode: "differentTargets",
          window: "thisRound",
          note: "Echo Strike Protocol (preview): Apply attack effect twice vs different targets this round on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "echo_strike_protocol", preview: true }
    };
  };

  // --- T3 LEARNED: Overclock the Golems ---
  // "+3 attack for one construct; loses 1 HP."
  THROUGHPUT["overclock_the_golems"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "buffUnit",
          unitType: "construct",
          selector: "one",
          buffs: { attackDelta: +3 },
          window: "thisRound",
          note: "Overclock the Golems (preview): +3 attack for one construct this round on success."
        },
        {
          type: "unitSelfDamage",
          unitType: "construct",
          selector: "sameUnit",
          hpDelta: -1,
          when: "afterEffect",
          note: "Overclock the Golems (preview): That construct loses 1 HP after overclock."
        }
      ],
      meta: { source: "throughput", maneuverKey: "overclock_the_golems", preview: true }
    };
  };

  // --- T3 LEARNED: Radiant Retaliation ---
  // "Convert enemy Darkness gain to −1 for you."
  THROUGHPUT["radiant_retaliation"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "convertEnemyDarknessGain",
          conversion: { enemyDarknessGainToAttacker: -1 },
          window: "thisRound",
          note: "Radiant Retaliation (preview): Convert enemy Darkness gain into Darkness −1 for attacker this round on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "radiant_retaliation", preview: true }
    };
  };

  // --- T4 LEARNED: Qliphothic Gambit ---
  // "+6 to Violence roll; Darkness +2."
  THROUGHPUT["qliphothic_gambit"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "rollBonus",
          scope: "attacker",
          appliesTo: ["violenceRoll"],
          when: "thisRound",
          amount: 6,
          note: "Qliphothic Gambit (preview): +6 to Violence roll this round on success."
        }
      ],
      factionEffects: [
        {
          factionId: ctx.attackerFactionId || null,
          darknessDelta: +2,
          note: "Qliphothic Gambit (preview): Attacker Darkness +2 on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "qliphothic_gambit", preview: true }
    };
  };

  // --- T4 LEARNED: Sephirotic Intervention ---
  // "Auto-win one opposed roll; Darkness −1."
  THROUGHPUT["sephirotic_intervention"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "autoWinOpposedRoll",
          scope: "attacker",
          count: 1,
          window: "thisRound",
          note: "Sephirotic Intervention (preview): Auto-win one opposed roll this round on success."
        }
      ],
      factionEffects: [
        {
          factionId: ctx.attackerFactionId || null,
          darknessDelta: -1,
          note: "Sephirotic Intervention (preview): Attacker Darkness −1 on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "sephirotic_intervention", preview: true }
    };
  };

  // --- T4 LEARNED: Unity Surge ---
  // "All allies gain +2 to every OP next round."
  THROUGHPUT["unity_surge"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    const opAll = { violence: 2, nonlethal: 2, intrigue: 2, economy: 2, softpower: 2, diplomacy: 2, logistics: 2, culture: 2, faith: 2 };

    return {
      factionEffects: [
        {
          factionId: ctx.attackerFactionId || null,
          deferred: {
            when: "nextRound",
            opDeltas: opAll
          },
          note: "Unity Surge (preview): Attacker gains +2 to every OP next round on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "unity_surge", preview: true }
    };
  };

  // --- T4 LEARNED: Void-Signal Collapse ---
  // "Nullify all maneuvers this round; Darkness +1."
  THROUGHPUT["void_signal_collapse"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "nullifyAllManeuvers",
          scope: "bothSides",
          window: "thisRound",
          note: "Void-Signal Collapse (preview): Nullify all maneuvers this round on success."
        }
      ],
      factionEffects: [
        {
          factionId: ctx.attackerFactionId || null,
          darknessDelta: +1,
          note: "Void-Signal Collapse (preview): Attacker Darkness +1 on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "void_signal_collapse", preview: true }
    };
  };

  // --- T4 LEARNED: Temporal Armistice ---
  // "End combat for 1 round; Darkness −2 if enemy accepts."
  THROUGHPUT["temporal_armistice"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "armistice",
          durationRounds: 1,
          scope: "combat",
          note: "Temporal Armistice (preview): End combat for 1 round on success (enemy acceptance adjudicated by GM)."
        },
        {
          type: "conditionalReward",
          condition: "enemyAccepts",
          factionDelta: { darknessDelta: -2 },
          note: "Temporal Armistice (preview): If enemy accepts, attacker Darkness −2."
        }
      ],
      meta: { source: "throughput", maneuverKey: "temporal_armistice", preview: true }
    };
  };

  // --- T4 LEARNED: Reality Hack ---
  // "Re-run last round as if it never occurred."
  THROUGHPUT["reality_hack"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "rewindRound",
          scope: "lastRound",
          note: "Reality Hack (preview): Re-run the last round as if it never occurred on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "reality_hack", preview: true }
    };
  };

  // --- T4 LEARNED: Engine of Absolution ---
  // "Restore 1 destroyed Hex to GenPop status."
  THROUGHPUT["engine_of_absolution"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      worldEffects: [
        {
          type: "restoreHex",
          target: ctx.target || null,
          toState: "genpop",
          amount: 1,
          note: "Engine of Absolution (preview): Restore 1 destroyed Hex to GenPop status on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "engine_of_absolution", preview: true }
    };
  };

  // --- T4 LEARNED: Crown of Mercy ---
  // "Instantly purify a Corrupted Spark; requires Victory context."
  THROUGHPUT["crown_of_mercy"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      worldEffects: [
        {
          type: "purifySpark",
          target: ctx.target || null,
          requires: ["victoryContext"],
          note: "Crown of Mercy (preview): Instantly purify a Corrupted Spark (requires Victory context) on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "crown_of_mercy", preview: true }
    };
  };

  // --- T4 LEARNED: Ego Breaker ---
  // "Reduce enemy leader’s OP cap by 3 permanently."
  THROUGHPUT["ego_breaker"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      worldEffects: [
        {
          type: "permanentCapDelta",
          scope: "enemyLeader",
          stat: "opCap",
          delta: -3,
          note: "Ego Breaker (preview): Reduce enemy leader’s OP cap by 3 permanently on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "ego_breaker", preview: true }
    };
  };

  // --- T4 LEARNED: Ego-Dragon Echo ---
  // "Summon Ego-Dragon fragment; +4 attack, double Darkness risk."
  THROUGHPUT["ego_dragon_echo"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "summonEntity",
          entity: "egoDragonFragment",
          buffs: { attackDelta: +4 },
          duration: "sceneOrRound",
          note: "Ego-Dragon Echo (preview): Summon Ego-Dragon fragment with +4 attack on success."
        }
      ],
      factionEffects: [
        {
          factionId: ctx.attackerFactionId || null,
          riskModifiers: { darknessRiskMultiplier: 2 },
          note: "Ego-Dragon Echo (preview): Double Darkness risk for attacker (interpretation hook) on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "ego_dragon_echo", preview: true }
    };
  };

  // --- T1 NARRATIVE UNLOCK: Ghost-Slip Infiltration ---
  // Runtime intent: ignore one defensive circumstance; +2 attacker roll in infiltration/espionage.
  // No-new-types approach: represent as tacticalEdge + conditional rollBonus.
  THROUGHPUT["ghost_slip_infiltration"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "tacticalEdge",
          scope: "attacker",
          amount: 1,
          window: "thisRound",
          note: "Ghost-Slip Infiltration (preview): Ignore one defensive circumstance (represented as tactical edge)."
        },
        {
          type: "conditionalReward",
          condition: "raidTypeIn:[infiltration,espionage]",
          roundDelta: { rollBonus: 2 },
          note: "Ghost-Slip Infiltration (preview): If raid type is Infiltration/Espionage, attacker gets +2 this round."
        }
      ],
      meta: { source: "throughput", maneuverKey: "ghost_slip_infiltration", preview: true }
    };
  };

  // --- T1 NARRATIVE UNLOCK: Battlefield Harmony ---
  // Runtime intent: margin treated as +2 higher for outcome tiering.
  THROUGHPUT["battlefield_harmony"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "attackerMarginDelta",
          delta: +2,
          window: "thisRound",
          note: "Battlefield Harmony (preview): Treat margin as +2 higher for outcome tiering on success."
        }
      ],
      meta: { source: "throughput", maneuverKey: "battlefield_harmony", preview: true }
    };
  };

  // --- T1 NARRATIVE UNLOCK: Sympathetic Stabilization ---
  // Runtime intent: reduce one negative consequence on Fail OR reduce incoming siege damage by 1.
  // No-new-types approach: encode as conditionalReward hooks and note.
  // (We allow it to appear on both success and fail; execution layer will decide.)
  THROUGHPUT["sympathetic_stabilization"] = function (ctx) {
    const s = String(ctx?.outcomeTier || ctx?.result || "").toLowerCase();
    const isFail = s.includes("fail");
    if (!isFail && !isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "tacticalEdge",
          scope: "attacker",
          amount: 1,
          window: isFail ? "onFail" : "thisRound",
          note: "Sympathetic Stabilization (preview): Mitigate one negative consequence (represented as tactical edge; GM adjudicates)."
        },
        {
          type: "conditionalReward",
          condition: "raidTypeIn:[siege,siege_defense,assault_defense]",
          roundDelta: { incomingSiegeDamageDelta: -1 },
          note: "Sympathetic Stabilization (preview): If siege/defense context, reduce incoming siege damage by 1 (hook)."
        }
      ],
      meta: { source: "throughput", maneuverKey: "sympathetic_stabilization", preview: true }
    };
  };

  // --- T1 NARRATIVE UNLOCK: Gradient Surge ---
  // Runtime intent: convert 1 staged Economy<->Logistics this round.
  // No-new-types approach: represent as borrowOP-like staging flexibility note + tacticalEdge.
  THROUGHPUT["gradient_surge"] = function (ctx) {
    if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;

    return {
      roundEffects: [
        {
          type: "tacticalEdge",
          scope: "attacker",
          amount: 1,
          window: "thisRound",
          note: "Gradient Surge (preview): Convert 1 staged Economy↔Logistics for this round (represented as tactical edge; GM adjudicates)."
        }
      ],
      meta: { source: "throughput", maneuverKey: "gradient_surge", preview: true }
    };
  };

  // ----------------------------
  // Agent API
  // ----------------------------
  async function snapshot(opts) {
    opts = opts || {};
    const includeRegistry = opts.includeRegistry !== false;

    const raid = getRaidAPI();
    const s = {
      ts: Date.now(),
      ready: !!game.ready,
      user: { id: game.user?.id || null, name: game.user?.name || null, isGM: !!game.user?.isGM },
      system: { id: game.system?.id || null, version: game.system?.version || null },
      raidApi: {
        present: !!raid,
        hasEffects: !!raid?.EFFECTS,
        hasResolveRaidRound: typeof raid?.resolveRaidRound === "function"
      }
    };

    if (includeRegistry) {
      const jsonMans = await loadJsonManeuvers();
      s.registry = {
        raidManeuvers: listRaidManeuvers(),
        jsonManeuvers: jsonMans,
        throughputKeys: Object.keys(THROUGHPUT).slice().sort()
      };
    }
    return s;
  }

  async function registryManeuvers(opts) {
    opts = opts || {};
    const source = String(opts.source || "raid").toLowerCase();

    if (source === "raid") return listRaidManeuvers();
    if (source === "json") return await loadJsonManeuvers();

    // merged
    const raid = listRaidManeuvers();
    const json = await loadJsonManeuvers();
    const map = Object.create(null);

    for (const m of json) {
      map[m.key] = Object.assign({ source: "json" }, m);
    }

    for (const m of raid) {
      map[m.key] = Object.assign(
        { source: map[m.key] ? "both" : "raid" },
        map[m.key] || {},
        m
      );
    }

    const out = Object.values(map);
    out.sort((a, b) => (a.tier - b.tier) || String(a.label).localeCompare(String(b.label)));
    return out;
  }

  async function auditCoverage() {
    const raid = listRaidManeuvers();
    const json = await loadJsonManeuvers();

    const raidKeys = new Set(raid.map(m => m.key));
    const jsonKeys = new Set(json.map(m => m.key));

    const onlyRaid = raid.filter(m => !jsonKeys.has(m.key)).map(m => m.key).sort();
    const onlyJson = json.filter(m => !raidKeys.has(m.key)).map(m => m.key).sort();
    const both = raid.filter(m => jsonKeys.has(m.key)).map(m => m.key).sort();

    return { ts: Date.now(), raidTotal: raid.length, jsonTotal: json.length, overlap: both.length, onlyRaid, onlyJson };
  }

  async function auditThroughputWiring() {
    const merged = await registryManeuvers({ source: "merged" });
    const wiredKeys = new Set(Object.keys(THROUGHPUT));

    const wired = [];
    const unwired = [];

    for (const m of merged) {
      if (wiredKeys.has(m.key)) wired.push(m.key);
      else unwired.push(m.key);
    }

    return { ts: Date.now(), mergedTotal: merged.length, wired: wired.length, unwired: unwired.length, wiredKeys: wired.sort(), unwiredKeys: unwired.sort() };
  }

  async function auditThroughputWiringByTier() {
    const merged = await registryManeuvers({ source: "merged" });
    const wiredKeys = new Set(Object.keys(THROUGHPUT));

    const byTier = Object.create(null);
    for (const m of merged) {
      const t = Number(m.tier ?? 1) || 1;
      byTier[t] ??= { tier: t, total: 0, wired: 0, unwired: 0, wiredKeys: [], unwiredKeys: [] };
      byTier[t].total++;
      if (wiredKeys.has(m.key)) {
        byTier[t].wired++;
        byTier[t].wiredKeys.push(m.key);
      } else {
        byTier[t].unwired++;
        byTier[t].unwiredKeys.push(m.key);
      }
    }

    const tiers = Object.keys(byTier).map(Number).sort((a,b)=>a-b);
    for (const t of tiers) {
      byTier[t].wiredKeys.sort();
      byTier[t].unwiredKeys.sort();
    }

    return { ts: Date.now(), tiers, byTier };
  }

  async function auditThroughputWiringByAvailability() {
    const merged = await registryManeuvers({ source: "merged" });
    const wiredKeys = new Set(Object.keys(THROUGHPUT));

    const byAvail = {
      standard: { availability: "standard", total: 0, wired: 0, unwired: 0, wiredKeys: [], unwiredKeys: [] },
      learned:  { availability: "learned",  total: 0, wired: 0, unwired: 0, wiredKeys: [], unwiredKeys: [] }
    };

    const normAvail = (m) => {
      const key = String(m?.key || "").toLowerCase();
      const tier = Number(m?.tier ?? 1) || 1;

      // Canon: all Tier 2+ are learned (even if registry says "standard")
      if (tier >= 2) return "learned";

      // Canon: known Tier-1 learned set (even if unlockKey is missing)
      const learnedT1 = new Set(["suppressive_fire","patch_the_breach","flash_interdict","last_stand_banner"]);
      if (tier === 1 && learnedT1.has(key)) return "learned";

      // Canon: Tier 1 can still be learned if unlock-gated
      if (m?.unlockKey) return "learned";

      // Otherwise fall back to explicit string (if present)
      const a = String(m?.availability || "").toLowerCase().trim();
      if (a === "learned") return "learned";

      return "standard";
    };

    for (const m of merged) {
      const a = normAvail(m);
      const bucket = byAvail[a];
      bucket.total++;
      if (wiredKeys.has(m.key)) {
        bucket.wired++;
        bucket.wiredKeys.push(m.key);
      } else {
        bucket.unwired++;
        bucket.unwiredKeys.push(m.key);
      }
    }

    byAvail.standard.wiredKeys.sort();
    byAvail.standard.unwiredKeys.sort();
    byAvail.learned.wiredKeys.sort();
    byAvail.learned.unwiredKeys.sort();

    return { ts: Date.now(), byAvail };
  }

  async function auditThroughputWiringByRaidType() {
    const merged = await registryManeuvers({ source: "merged" });
    const wiredKeys = new Set(Object.keys(THROUGHPUT));

    const byRaidType = Object.create(null);

    for (const m of merged) {
      const rts = Array.isArray(m.raidTypes) && m.raidTypes.length ? m.raidTypes : ["(none)"];
      for (const rt of rts) {
        const key = String(rt || "(none)");
        byRaidType[key] ??= { raidType: key, total: 0, wired: 0, unwired: 0, wiredKeys: [], unwiredKeys: [] };
        byRaidType[key].total++;
        if (wiredKeys.has(m.key)) {
          byRaidType[key].wired++;
          byRaidType[key].wiredKeys.push(m.key);
        } else {
          byRaidType[key].unwired++;
          byRaidType[key].unwiredKeys.push(m.key);
        }
      }
    }

    const raidTypes = Object.keys(byRaidType).sort();
    for (const rt of raidTypes) {
      byRaidType[rt].wiredKeys.sort();
      byRaidType[rt].unwiredKeys.sort();
    }

    return { ts: Date.now(), raidTypes, byRaidType };
  }

  async function simulateManeuver(req) {
    req = req || {};
    const maneuverKey = String(req.maneuverKey || "").trim();
    if (!maneuverKey) return { ok: false, error: "missing-maneuverKey" };

    const raidList = listRaidManeuvers();
    const jsonList = await loadJsonManeuvers();

    const raidM = raidList.find(m => m.key === maneuverKey) || null;
    const jsonM = jsonList.find(m => m.key === maneuverKey) || null;

    const declared = raidM || jsonM || null;
    const declaredSource = raidM && jsonM ? "both" : (raidM ? "raid" : (jsonM ? "json" : "none"));

    const ctx = {
      maneuverKey,
      outcomeTier: req.outcomeTier || req.result || "unknown",
      raidType: req.raidType ? normalizeRaidType(req.raidType) : null,
      attackerFactionId: req.attackerFactionId || req.factionId || null,
      defenderFactionId: req.defenderFactionId || null,
      target: copy(req.target || null),
      meta: copy(req.meta || {})
    };

    const warnings = [];
    if (!declared) warnings.push("Maneuver not found in raid registry or JSON registry.");

    const fn = THROUGHPUT[maneuverKey] || null;
    let previewWE = null;
    if (!fn) warnings.push("No throughput handler: maneuver not mechanized (dry-run).");
    else {
      try { previewWE = fn(ctx) || null; }
      catch (e) {
        previewWE = null;
        warnings.push("Throughput handler threw: " + String(e));
      }
    }

    return { ok: true, ts: Date.now(), request: ctx, declared: declared ? copy(declared) : null, declaredSource, previewWorldEffects: previewWE, warnings };
  }

  async function validateManeuver(req) {
    const sim = await simulateManeuver(req);
    if (!sim.ok) return sim;

    const failures = [];
    if (!sim.declared) failures.push("missing-declared-definition");

    const isWired = !!THROUGHPUT[String(sim.request.maneuverKey)];
    if (!isWired) failures.push("unwired-no-throughput-handler");

    const c = sim.declared?.cost || {};
    for (const k of Object.keys(c)) {
      if (!OP_KEYS.includes(k)) failures.push("unknown-op-key:" + k);
    }

    return { ok: failures.length === 0, ts: Date.now(), maneuverKey: sim.request.maneuverKey, failures, sim };
  }

  async function auditIntentTypes() {
    const T = THROUGHPUT;

    const ctx = {
      maneuverKey: "",
      outcomeTier: "success",
      attackerFactionId: "FACTION_A",
      defenderFactionId: "FACTION_B",
      raidType: "assault",
      target: { id: "TARGET" },
      meta: {}
    };

    const roundTypes = new Set();
    const scenarioTypes = new Set();
    const worldTypes = new Set();
    const factionKeys = new Set();
    const metaKeys = new Set();

    const failures = [];

    for (const [k, fn] of Object.entries(T)) {
      try {
        ctx.maneuverKey = k;
        const out = fn(ctx) || {};

        for (const e of (out.roundEffects || [])) roundTypes.add(e?.type || "(missing)");
        for (const e of (out.scenarioEffects || [])) scenarioTypes.add(e?.type || "(missing)");
        for (const e of (out.worldEffects || [])) worldTypes.add(e?.type || "(missing)");

        for (const e of (out.factionEffects || [])) {
          for (const key of Object.keys(e || {})) factionKeys.add(key);
        }

        for (const key of Object.keys(out.meta || {})) metaKeys.add(key);
      } catch (e) {
        failures.push({ maneuverKey: k, error: String(e) });
      }
    }

    return {
      ts: Date.now(),
      roundEffectTypes: Array.from(roundTypes).sort(),
      scenarioEffectTypes: Array.from(scenarioTypes).sort(),
      worldEffectTypes: Array.from(worldTypes).sort(),
      factionEffectKeys: Array.from(factionKeys).sort(),
      metaKeys: Array.from(metaKeys).sort(),
      failures
    };
  }

  // ----------------------------
  // Agentic Testing Sprint 1 (v0.4.1)
  // Observation + Planner + Evals
  // ----------------------------
  function getFactionActor(factionId) {
    if (!factionId) return null;
    return game.actors?.get?.(factionId)
      || game.actors?.contents?.find?.(a => a?.id === factionId)
      || null;
  }

  function sumOP(op) {
    let n = 0;
    for (const k of OP_KEYS) n += Number(op?.[k] || 0) || 0;
    return n;
  }

  function getActorItemsArray(actor) {
    const items = actor?.items;
    if (!items) return [];
    if (Array.isArray(items)) return items;
    if (Array.isArray(items?.contents)) return items.contents;
    try { return Array.from(items); } catch (_) {}
    return [];
  }

  function getFactionFlags(actor) {
    return copy(actor?.flags?.["bbttcc-factions"] || {});
  }

  function getRaidFlags(actor) {
    return copy(actor?.flags?.["bbttcc-raid"] || {});
  }

  function inferFactionTrack(flags, key, fallback) {
    const v = flags?.[key];
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && !isNaN(Number(v))) return Number(v);
    if (typeof fallback === 'number') return fallback;
    return 0;
  }

  function summarizeRecentWarLogs(flags, limit) {
    const rows = Array.isArray(flags?.warLogs) ? flags.warLogs.slice() : [];
    rows.sort((a,b) => Number(b?.ts || b?.createdAt || 0) - Number(a?.ts || a?.createdAt || 0));
    return rows.slice(0, limit || 12).map(r => ({
      type: r?.type || null,
      label: r?.label || r?.title || r?.activityKey || null,
      activityKey: r?.activityKey || null,
      targetName: r?.targetName || null,
      targetUuid: r?.targetUuid || null,
      targetType: r?.targetType || null,
      result: r?.result || r?.outcome || null,
      margin: Number(r?.margin || 0) || 0,
      attackerTotal: Number(r?.attackerTotal || 0) || 0,
      defenderTotal: Number(r?.defenderTotal || 0) || 0,
      contestedKey: r?.contestedKey || null,
      maneuvers: Array.isArray(r?.maneuvers) ? copy(r.maneuvers) : [],
      summary: r?.summary || null,
      ts: Number(r?.ts || r?.createdAt || Date.now()) || Date.now()
    }));
  }

  function collectTerritoryForFaction(factionId) {
    const out = { ownedHexes: [], travelTraces: [], currentSceneId: game.scenes?.current?.id || null };
    for (const scene of (game.scenes?.contents || [])) {
      for (const d of (scene.drawings || [])) {
        const tf = d?.flags?.["bbttcc-territory"];
        if (!tf) continue;
        const row = {
          sceneId: scene.id,
          sceneName: scene.name || null,
          drawingId: d.id,
          hexUuid: d.uuid,
          hexName: d.text || tf?.name || d.id,
          factionId: tf?.factionId || null,
          terrainType: tf?.terrainType || tf?.terrain || null,
          development: Number(tf?.development || 0) || 0,
          integration: Number(tf?.integration || 0) || 0,
          leylines: copy(tf?.leylines || {}),
          travel: copy(tf?.travel || null)
        };
        if (row.factionId && String(row.factionId) === String(factionId)) out.ownedHexes.push(row);
        if (row.travel && String(row.travel?.factionId || '') === String(factionId)) out.travelTraces.push(row);
      }
    }
    return out;
  }

  function getCampaignContext() {
    const out = { activeCampaignId: null, campaigns: [] };
    try {
      out.activeCampaignId = game.settings?.get?.('bbttcc-campaign', 'activeCampaignId') || null;
    } catch (_) {}

    for (const j of (game.journal?.contents || [])) {
      const exp = j?.flags?.['bbttcc-campaign']?.export;
      if (!exp?.campaign) continue;
      out.campaigns.push({
        journalId: j.id,
        journalName: j.name,
        campaignId: exp.campaignId || exp.campaign?.id || null,
        campaignLabel: exp.campaignLabel || exp.campaign?.label || j.name,
        includeTables: !!exp.includeTables,
        includeQuests: !!exp.includeQuests,
        beatCount: Array.isArray(exp.campaign?.beats) ? exp.campaign.beats.length : (exp.campaign?.beats ? Object.keys(exp.campaign.beats).length : 0),
        questCount: Array.isArray(exp.quests) ? exp.quests.length : (exp.quests ? Object.keys(exp.quests).length : 0),
        tableCount: Array.isArray(exp.tables) ? exp.tables.length : (exp.tables ? Object.keys(exp.tables).length : 0)
      });
    }
    return out;
  }

  function inferAvailableStrategicActions(actor) {
    const items = getActorItemsArray(actor);
    const byKey = new Map();
    for (const it of items) {
      const bb = it?.flags?.bbttcc || {};
      const kind = String(bb?.kind || '').toLowerCase();
      if (kind !== 'strategic' && kind !== 'activity' && kind !== 'strategic_activity') continue;
      const key = bb.key || bb.unlockKey || deriveKeyFromName(it.name);
      if (!key) continue;
      const cost = normalizeCost(bb.opCosts || bb.cost || {});
      const row = byKey.get(key) || {
        key,
        label: it.name || key,
        cost,
        source: 'actor-item',
        sourceCount: 0,
        itemIds: []
      };
      row.sourceCount += 1;
      if (it?.id) row.itemIds.push(it.id);
      if (!sumOP(row.cost) && sumOP(cost)) row.cost = cost;
      if (!row.label && it?.name) row.label = it.name;
      byKey.set(key, row);
    }
    return Array.from(byKey.values()).sort((a,b) => String(a.label || a.key).localeCompare(String(b.label || b.key)));
  }

  function estimateCandidateRiskFromHistory(history, activityKey, targetUuid, targetName, targetType) {
    const rows0 = Array.isArray(history) ? history.filter(r => String(r?.type || '').toLowerCase() === 'raid') : [];
    const sameActivity = rows0.filter(r => !activityKey || String(r.activityKey || '') === String(activityKey || ''));
    const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
    const sameUuid = sameActivity.filter(r => targetUuid && String(r.targetUuid || '') === String(targetUuid));
    const sameName = sameActivity.filter(r => targetName && norm(r.targetName) === norm(targetName));
    const sameType = sameActivity.filter(r => targetType && String(r.targetType || '') === String(targetType || ''));
    const fallback = sameActivity.length ? sameActivity : rows0;
    const rows = sameUuid.length ? sameUuid : (sameName.length ? sameName : (sameType.length ? sameType : fallback));
    if (!rows.length) {
      return {
        successRate: null,
        averageMargin: null,
        count: 0,
        riskBand: 'unknown',
        matchMode: 'none',
        sameActivityCount: sameActivity.length,
        totalRaidCount: rows0.length,
        exactTargetCount: 0,
        targetNameCount: 0,
        targetTypeCount: 0
      };
    }
    let wins = 0, margin = 0;
    for (const r of rows) {
      if (isSuccessTier(r.result)) wins += 1;
      margin += Number(r.margin || 0) || 0;
    }
    const sr = wins / rows.length;
    const am = margin / rows.length;
    let riskBand = 'medium';
    if (sr >= 0.66 && am >= 0) riskBand = 'low';
    else if (sr <= 0.33 || am < -2) riskBand = 'high';
    const matchMode = sameUuid.length ? 'activity+targetUuid' : (sameName.length ? 'activity+targetName' : (sameType.length ? 'activity+targetType' : (sameActivity.length ? 'activityOnly' : 'allRaids')));
    return {
      successRate: sr,
      averageMargin: am,
      count: rows.length,
      riskBand,
      matchMode,
      sameActivityCount: sameActivity.length,
      totalRaidCount: rows0.length,
      exactTargetCount: sameUuid.length,
      targetNameCount: sameName.length,
      targetTypeCount: sameType.length
    };
  }

  async function getObservationSnapshot(factionId, opts) {
    opts = opts || {};
    const actor = getFactionActor(factionId);
    if (!actor) return { ok: false, error: 'Faction actor not found.', factionId };

    const ff = getFactionFlags(actor);
    const rf = getRaidFlags(actor);
    const territory = collectTerritoryForFaction(actor.id);
    const recentWarLogs = summarizeRecentWarLogs(ff, opts.recentWarLogLimit || 12);
    const campaign = getCampaignContext();
    const worldApi = game.bbttcc?.api?.world || null;
    let worldState = null;
    try {
      worldState = typeof worldApi?.getState === 'function' ? copy(await worldApi.getState()) : null;
    } catch (_) { worldState = null; }

    const actorItems = getActorItemsArray(actor);
    const maneuvers = Array.from(new Map(actorItems
      .map(it => ({ it, bb: it?.flags?.bbttcc || {} }))
      .filter(({bb}) => String(bb.kind || '').toLowerCase() === 'maneuver')
      .map(({it, bb}) => [(bb.key || deriveKeyFromName(it.name)), {
        key: bb.key || deriveKeyFromName(it.name),
        label: it.name || bb.key || deriveKeyFromName(it.name)
      }])
    ).values());

    const strategics = inferAvailableStrategicActions(actor);
    const homeHexUuid = ff?.homeHexUuid || null;
    const startHexes = Array.isArray(ff?.startHexes) ? copy(ff.startHexes) : [];

    return {
      ok: true,
      spec: 'bbttcc.observation.v1',
      capturedAt: new Date().toISOString(),
      factionId: actor.id,
      world: {
        turn: worldState?.turn ?? ff?.turn?.number ?? null,
        darkness: copy(worldState?.darkness ?? ff?.darkness ?? null),
        locks: copy(worldState?.locks || null),
        source: worldState ? 'game.bbttcc.api.world.getState' : 'fallback'
      },
      faction: {
        id: actor.id,
        name: actor.name,
        tier: Number(ff?.tier ?? ff?.factionLevel ?? 0) || 0,
        opBank: normalizeCost(ff?.opBank || {}),
        opCaps: normalizeCost(ff?.opCaps || {}),
        opTotal: sumOP(ff?.opBank || {}),
        morale: inferFactionTrack(ff, 'morale'),
        loyalty: inferFactionTrack(ff, 'loyalty'),
        darkness: copy(ff?.darkness || null),
        victory: copy(ff?.victory || null),
        logistics: copy(ff?.logistics || null),
        pressure: copy(ff?.pressure || null),
        bonuses: copy(ff?.bonuses || null),
        homeHexUuid,
        startHexes,
        maneuvers,
        strategics,
        recentWarLogs
      },
      territory: {
        ownedHexes: territory.ownedHexes,
        ownedHexCount: territory.ownedHexes.length,
        travelTraceCount: territory.travelTraces.length,
        homeHexUuid,
        startHexes
      },
      travel: {
        traces: territory.travelTraces.map(x => ({
          hexUuid: x.hexUuid,
          hexName: x.hexName,
          sceneId: x.sceneId,
          terrainType: x.terrainType,
          travel: x.travel
        })),
        latest: territory.travelTraces.length ? copy(territory.travelTraces[territory.travelTraces.length - 1]) : null
      },
      raid: {
        activeSession: copy(rf?.raidSession || null),
        hasActiveSession: !!rf?.raidSession,
        recentRaidLogs: recentWarLogs.filter(r => String(r.type || '').toLowerCase() === 'raid')
      },
      campaign,
      constraints: {
        dryRun: true,
        canMutate: false,
        canSpendOP: false,
        canCommitRaid: false,
        canCallWME: false
      },
      telemetry: {
        actorItemCount: actorItems.length,
        sceneCount: game.scenes?.contents?.length || 0,
        warningCount: strategics.length ? 0 : 1,
        warnings: strategics.length ? [] : ['No strategic actions found on actor items; planner may return no strategic candidates.']
      }
    };
  }

  async function listLegalStrategicActions(factionId, obs) {
    const observation = obs || await getObservationSnapshot(factionId);
    if (!observation?.ok) return observation;
    const bank = normalizeCost(observation?.faction?.opBank || {});
    const strategics = Array.isArray(observation?.faction?.strategics) ? observation.faction.strategics : [];
    const actions = strategics.map(s => {
      const cost = normalizeCost(s?.cost || {});
      const deficits = [];
      for (const k of OP_KEYS) {
        if ((cost[k] || 0) > (bank[k] || 0)) deficits.push(k);
      }
      return {
        type: 'strategic_activity',
        key: s.key,
        label: s.label || s.key,
        legal: deficits.length === 0,
        cost,
        reasons: deficits.length ? ['Insufficient OP: ' + deficits.join(', ')] : [],
        source: s.source || 'actor-item',
        sourceCount: Number(s.sourceCount || 1) || 1,
        duplicateGrantWarning: (Number(s.sourceCount || 1) || 1) > 1 ? `Observed ${Number(s.sourceCount || 1)} copies of this strategic on the faction; deduped by key for planner output.` : null,
        scoreHints: {
          opCostTotal: sumOP(cost),
          hasEconomyCost: (cost.economy || 0) > 0,
          hasLogisticsCost: (cost.logistics || 0) > 0
        }
      };
    });
    return { ok: true, ts: Date.now(), factionId, actions };
  }

  async function estimateTravel(req) {
    req = req || {};
    const observation = req.observation || await getObservationSnapshot(req.factionId);
    if (!observation?.ok) return observation;
    const traces = Array.isArray(observation?.travel?.traces) ? observation.travel.traces : [];
    const territoryRows = Array.isArray(observation?.territory?.ownedHexes) ? observation.territory.ownedHexes : [];
    const candidate = traces.find(t => String(t?.travel?.hexFrom || '') === String(req.fromHexUuid || ''))
      || traces.find(t => String(t?.travel?.hexTo || '') === String(req.toHexUuid || ''))
      || territoryRows.find(t => String(t?.hexUuid || '') === String(req.toHexUuid || ''))
      || null;

    const terrain = candidate?.terrainType || candidate?.travel?.terrainType || 'unknown';
    const travelData = copy(candidate?.travel || {});
    const opCost = normalizeCost(travelData?.finalCost || travelData?.cost || { economy: travelData?.opCost || 0 });
    if (!sumOP(opCost) && Number(travelData?.opCost || 0) > 0) opCost.economy = Number(travelData.opCost);
    const encounterTier = Number(travelData?.encounterTier || 0) || 0;
    const riskBand = encounterTier >= 3 ? 'high' : encounterTier >= 2 ? 'medium' : 'low';
    const logisticsImpact = terrain === 'mountain' ? 1 : (terrain === 'plains' ? 0 : null);
    return {
      ok: true,
      ts: Date.now(),
      factionId: req.factionId,
      fromHexUuid: req.fromHexUuid || null,
      toHexUuid: req.toHexUuid || null,
      terrain,
      projectedCost: opCost,
      projectedCostTotal: sumOP(opCost),
      distanceUnits: Number(travelData?.distanceUnits || 0) || null,
      distanceMiles: Number(travelData?.distanceMiles || 0) || null,
      encounterTier: encounterTier || null,
      riskBand,
      logisticsImpact,
      explanation: 'Estimated from recorded travel traces/territory flags only; no OP committed.'
    };
  }

  async function estimateRaid(req) {
    req = req || {};
    const observation = req.observation || await getObservationSnapshot(req.factionId);
    if (!observation?.ok) return observation;
    const session = observation?.raid?.activeSession || {};
    const targetUuid = req.targetUuid || session?.targetUuid || null;
    const activityKey = req.activityKey || session?.activityKey || null;
    const targetName = req.targetName || session?.targetName || null;
    const targetType = req.targetType || session?.targetType || null;
    const recent = Array.isArray(observation?.raid?.recentRaidLogs) ? observation.raid.recentRaidLogs : [];
    const hist = estimateCandidateRiskFromHistory(recent, activityKey, targetUuid, targetName, targetType);
    const maneuvers = Array.isArray(req.maneuvers) ? req.maneuvers : [];
    const previews = [];
    const reg = await registryManeuvers({ source: 'merged' });
    const maneuverCost = zOP();
    for (const key of maneuvers) {
      const sim = await simulateManeuver({
        maneuverKey: key,
        outcomeTier: req.outcomeTier || 'success',
        attackerFactionId: req.factionId,
        defenderFactionId: req.defenderFactionId || session?.defenderId || null,
        raidType: req.raidType || activityKey || session?.raidType || 'assault',
        target: { id: targetUuid, uuid: targetUuid }
      });
      previews.push({
        maneuverKey: key,
        ok: !!sim?.ok,
        warnings: copy(sim?.warnings || []),
        previewWorldEffects: copy(sim?.previewWorldEffects || null)
      });
      const hit = reg.find(m => String(m?.key || '') === String(key || '')) || null;
      if (hit?.cost) for (const opk of OP_KEYS) maneuverCost[opk] += Number(hit.cost?.[opk] || 0) || 0;
    }
    const matchingRows = recent.filter(r => String(r?.type || '').toLowerCase() === 'raid' && (!activityKey || String(r.activityKey || '') === String(activityKey)));
    const histCost = zOP();
    let histCostRows = 0;
    for (const r of matchingRows) {
      const s = String(r?.summary || '');
      const m = s.match(/OP−\(Att\)\s*([^;]+)/i) || s.match(/OP-\(Att\)\s*([^;]+)/i);
      if (!m) continue;
      histCostRows += 1;
      const bits = String(m[1] || '').split(/,\s*/);
      for (const bit of bits) {
        const mm = bit.match(/([A-Za-z_ ]+)\s*:\s*(-?\d+)/);
        if (!mm) continue;
        const k = normalizeOPKey(mm[1]);
        if (!OP_KEYS.includes(k)) continue;
        histCost[k] += clamp0(Number(mm[2] || 0));
      }
    }
    let expectedCost = null;
    if (sumOP(maneuverCost) > 0) expectedCost = maneuverCost;
    else if (histCostRows > 0) {
      expectedCost = zOP();
      for (const k of OP_KEYS) expectedCost[k] = Math.round((Number(histCost[k] || 0) / histCostRows) * 100) / 100;
    }
    let expectedBand = 'medium';
    if (hist.riskBand === 'low') expectedBand = 'high';
    else if (hist.riskBand === 'high') expectedBand = 'low';

    const riskFlags = [];
    let explanation = 'Estimated from historical raid logs and dry-run maneuver previews only.';
    if (!hist.count) {
      riskFlags.push('No historical raid logs available for this faction baseline.');
      explanation = 'No usable raid history found; estimate is based only on dry-run maneuver previews and generic baseline assumptions.';
    } else if (hist.matchMode === 'activity+targetUuid') {
      explanation = `Estimated from exact historical matches for ${activityKey} against this target plus dry-run maneuver previews.`;
    } else if (hist.matchMode === 'activity+targetName' || hist.matchMode === 'activity+targetType') {
      riskFlags.push(`Historical match used fallback mode: ${hist.matchMode}.`);
      explanation = `No exact target UUID history found; using ${hist.matchMode} history for ${activityKey} plus dry-run maneuver previews.`;
    } else if (hist.matchMode === 'activityOnly') {
      riskFlags.push('No prior history for this activity against this target; using faction history for this activity across other targets.');
      explanation = `No prior ${activityKey} history found for this target; using faction-wide ${activityKey} history plus dry-run maneuver previews.`;
    } else if (hist.matchMode === 'allRaids') {
      riskFlags.push('Historical match used fallback mode: allRaids.');
      if (hist.sameActivityCount > 0) explanation = `Target-specific history was unavailable; using broader faction raid baseline for ${activityKey}.`;
      else explanation = `No prior ${activityKey} history found; using faction-wide raid baseline plus dry-run maneuver previews.`;
    }

    if (!sumOP(expectedCost || {})) expectedCost = null;
    return {
      ok: true,
      ts: Date.now(),
      factionId: req.factionId,
      targetUuid,
      activityKey,
      legal: !!targetUuid && !!activityKey,
      expectedSuccessBand: expectedBand,
      historicalRisk: hist,
      matchMode: hist.matchMode,
      maneuverPreviewSummary: previews,
      expectedCost,
      riskFlags,
      explanation
    };
  }

  async function scoreCandidates(req) {
    req = req || {};
    const observation = req.observation || await getObservationSnapshot(req.factionId);
    if (!observation?.ok) return observation;
    const candidates = Array.isArray(req.candidates) ? req.candidates : [];
    const recentRaids = Array.isArray(observation?.raid?.recentRaidLogs) ? observation.raid.recentRaidLogs : [];

    const pressure = summarizePressure(observation) || {};
    const logisticsPressure =
      Number(pressure?.logistics?.overextensionBand || 0)
      || Number(pressure?.logistics?.pressureBand || 0)
      || Number(pressure?.pressure?.logistics || 0)
      || Number(pressure?.pressure?.overextension || 0)
      || 0;
    const darkGlobal =
      Number(observation?.faction?.darkness?.global || 0)
      || Number(observation?.world?.darkness?.global || 0)
      || 0;

    const ownedHexes = Array.isArray(observation?.territory?.ownedHexes) ? observation.territory.ownedHexes : [];
    const ownedHexSet = new Set(ownedHexes.map(h => String(h?.hexUuid || "")).filter(Boolean));
    const startHexSet = new Set((Array.isArray(observation?.territory?.startHexes) ? observation.territory.startHexes : []).map(x => String(x || "")));
    const activeCampaignId = observation?.campaign?.activeCampaignId || null;
    const latestTravelHexUuid = getLatestTravelHexUuid(observation);
    const travelTraceFreq = getTravelTraceFrequency(observation);
    const campaignTravelHooks = inferCampaignTravelHooks(observation);
    const repairNeed = inferRepairNeed(observation);
    const repairNeedLevel = Number(repairNeed?.level || 0) || 0;
    const repairNeedSource = String(repairNeed?.source || "none");
    const economyNeed = inferEconomyNeed(observation);
    const moraleNeed = inferMoraleNeed(observation);

    const scored = candidates.map(c => {
      const out = copy(c);
      const factors = {
        opEfficiency: 0,
        risk: 0,
        darknessBenefit: 0,
        historyPenalty: 0,
        campaignFit: 0,
        duplicatePenalty: 0,
        pressureFit: 0,
        certainty: 0,
        explorationValue: 0,
        missionValue: 0,
        situationalFit: 0
      };
      const relevanceReasons = [];

      const label = String(c?.label || c?.key || c?.activityKey || "").toLowerCase();
      const costTotal = sumOP(c?.cost || c?.projectedCost || c?.expectedCost || {});
      factors.opEfficiency = costTotal === 0 ? 2 : costTotal <= 1 ? 1 : costTotal <= 3 ? 0 : -1;

      const riskBand = c?.riskBand || c?.historicalRisk?.riskBand || 'unknown';
      factors.risk = riskBand === 'low' ? 2 : riskBand === 'medium' ? 0 : riskBand === 'high' ? -2 : -1;
      if (costTotal >= 5) factors.opEfficiency -= 1;
      else if (costTotal >= 3) factors.opEfficiency -= 0.5;

      if (darkGlobal > 0) {
        if (/tikkun|sephirotic|purif|radiant|mercy|harmony|faith|charity/.test(label)) {
          factors.darknessBenefit += 2;
          relevanceReasons.push("helps relieve darkness pressure");
        } else if (/harvest|ration|minor_repair|repair|civic/.test(label)) {
          factors.darknessBenefit += 1;
        }
      }

      if (c?.type === 'raid' && c?.activityKey) {
        const hist = c?.historicalRisk?.count ? c.historicalRisk : estimateCandidateRiskFromHistory(recentRaids, c.activityKey, c.targetUuid || null, c.targetName || null, c.targetType || null);
        if (hist.count >= 1) {
          if (hist.successRate === 0) factors.historyPenalty -= (hist.count >= 3 ? 3 : 2);
          else if (hist.successRate <= 0.33) factors.historyPenalty -= 1;
          if ((Number(hist.averageMargin || 0) || 0) < -10) factors.historyPenalty -= 2;
          else if ((Number(hist.averageMargin || 0) || 0) < 0) factors.historyPenalty -= 1;
        }
        const mm = String(c?.matchMode || hist.matchMode || "none");
        if (mm === "activity+targetUuid") {
          factors.certainty += 2;
          relevanceReasons.push("uses exact target history");
        } else if (mm === "activity+targetName" || mm === "activity+targetType") {
          factors.certainty += 1;
        } else if (mm === "activityOnly") factors.certainty -= 1;
        else if (mm === "allRaids" || mm === "none") factors.certainty -= 2;
      }

      if ((Number(c?.sourceCount || 1) || 1) > 3) factors.duplicatePenalty -= 0.15;

      if (activeCampaignId) {
        factors.campaignFit += 0.5;
        if (c?.type === "raid" && observation?.raid?.hasActiveSession) {
          factors.campaignFit += 0.5;
          relevanceReasons.push("aligned to active raid context");
        }
      }

      if (c?.type === "strategic") {
        if (/minor_repair|repair/.test(label)) {
          if (repairNeedLevel > 0) {
            if (repairNeedSource === "live") {
              factors.situationalFit += Math.min(3, 1 + (repairNeedLevel * 0.75));
              relevanceReasons.push("live structural damage suggests repair relevance");
            } else {
              factors.situationalFit += 0.75;
              relevanceReasons.push("war-log history suggests possible repair relevance");
            }
          } else {
            factors.situationalFit -= 1;
          }
        }
        if (/harvest|supply|logistic/.test(label)) {
          if (economyNeed > 0 || logisticsPressure > 0) {
            factors.pressureFit += 2;
            relevanceReasons.push("supports economy/logistics pressure");
          } else {
            factors.pressureFit -= 0.35;
          }
        }
        if (/ration|charity|unity|faith/.test(label)) {
          if (moraleNeed > 0) {
            factors.pressureFit += 2;
            relevanceReasons.push("helps morale/loyalty strain");
          } else {
            factors.pressureFit -= 0.35;
          }
        }
        if (/training|drill/.test(label)) {
          if (observation?.raid?.hasActiveSession) {
            factors.pressureFit += 1.5;
            relevanceReasons.push("useful with active raid posture");
          } else {
            factors.pressureFit -= 0.2;
          }
        }
        if (/civic/.test(label) && moraleNeed > 0) {
          factors.pressureFit += 1;
          relevanceReasons.push("supports internal stability");
        }
      }

      if (c?.type === "travel") {
        const toHexUuid = String(c?.toHexUuid || "");
        const fromHexUuid = String(c?.fromHexUuid || "");
        const seenCount = Number(travelTraceFreq.get(toHexUuid) || 0) || 0;

        if (toHexUuid && fromHexUuid && toHexUuid === fromHexUuid) factors.explorationValue -= 5;
        if (toHexUuid && !ownedHexSet.has(toHexUuid)) {
          factors.explorationValue += 1.5;
          relevanceReasons.push("extends reach beyond owned hexes");
        }
        if (toHexUuid && ownedHexSet.has(toHexUuid)) factors.explorationValue -= 0.5;
        if (toHexUuid && startHexSet.has(toHexUuid)) factors.explorationValue -= 0.5;
        if (toHexUuid && latestTravelHexUuid && toHexUuid === latestTravelHexUuid) factors.explorationValue -= 0.75;
        if (seenCount === 0) {
          factors.explorationValue += 1;
          relevanceReasons.push("offers fresher exploration value");
        } else if (seenCount >= 2) {
          factors.explorationValue -= 0.75;
        }

        const encounterTier = Number(c?.encounterTier || 0) || 0;
        if (encounterTier <= 1) {
          factors.explorationValue += 0.5;
          relevanceReasons.push("keeps encounter risk low");
        } else if (encounterTier >= 3) {
          factors.explorationValue -= 1.5;
        }

        if (logisticsPressure > 0 && Number(c?.logisticsImpact || 0) > 0) factors.missionValue -= 1;
        if (toHexUuid && campaignTravelHooks.has(toHexUuid)) {
          factors.missionValue += 1.5;
          relevanceReasons.push("touches current campaign/raid geography");
        }
        if (observation?.raid?.hasActiveSession && toHexUuid && campaignTravelHooks.has(toHexUuid)) {
          factors.missionValue += 0.5;
        }
      }

      const score = Object.values(factors).reduce((a,b)=>a+(Number(b)||0),0);
      out.score = Math.round(score * 100) / 100;
      out.factors = factors;
      out.relevanceReasons = relevanceReasons;
      out.explanation = c?.explanation || 'Heuristic score from cost, risk, darkness pressure, history, campaign context, and advisor tie-breakers.';
      return out;
    }).sort((a,b) => {
      const ds = (Number(b.score)||0) - (Number(a.score)||0);
      if (ds) return ds;
      const rb = bandRank(a?.riskBand) - bandRank(b?.riskBand);
      if (rb) return rb;
      const dc = (sumOP(a?.cost || a?.projectedCost || a?.expectedCost || {})) - (sumOP(b?.cost || b?.projectedCost || b?.expectedCost || {}));
      if (dc) return dc;
      return String(a?.label || a?.key || "").localeCompare(String(b?.label || b?.key || ""));
    });
    return { ok: true, ts: Date.now(), factionId: observation.factionId || observation?.faction?.id || req.factionId || null, scored };
  }
  function uniqueBy(arr, keyFn) {
    const out = [];
    const seen = new Set();
    for (const row of (Array.isArray(arr) ? arr : [])) {
      const k = String(keyFn(row) || "");
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(row);
    }
    return out;
  }

  function bandRank(b) {
    const s = String(b || "").toLowerCase();
    if (s === "low") return 1;
    if (s === "medium") return 2;
    if (s === "high") return 3;
    return 0;
  }

  function topCandidate(rows) {
    return Array.isArray(rows) && rows.length ? copy(rows[0]) : null;
  }

  function summarizePressure(observation) {
    const f = observation?.faction || {};
    const p = copy(f?.pressure || {});
    return {
      morale: Number(f?.morale || 0) || 0,
      loyalty: Number(f?.loyalty || 0) || 0,
      logistics: copy(f?.logistics || null),
      pressure: p
    };
  }


  function summarizeDarkness(observation) {
    const d = copy(observation?.faction?.darkness || observation?.world?.darkness || null);
    return d;
  }

  function collectDamageSignals(root, path, out, depth) {
    if (!root || depth > 5) return;
    if (Array.isArray(root)) {
      for (let i = 0; i < root.length; i++) collectDamageSignals(root[i], `${path}[${i}]`, out, depth + 1);
      return;
    }
    if (typeof root !== "object") return;

    const keys = Object.keys(root);
    const hasDirectDamage =
      keys.some(k => /damage(step|state)?|hittrack|hitsremaining|destroy(ed)?|breach|ruin|crippl|repair|condition|hp|maxhp|structure/i.test(k))
      || /damage(step|state)?|hittrack|destroy(ed)?|breach|ruin|crippl|repair|condition|structure/i.test(path || "");

    if (hasDirectDamage) {
      const damageStep = Number(root?.damageStep ?? root?.damage ?? root?.damageState ?? 0) || 0;
      const hitsRemaining = Number(root?.hitsRemaining ?? 0) || 0;
      const hp = Number(root?.hp ?? root?.health ?? 0);
      const maxHp = Number(root?.maxHp ?? root?.maxHealth ?? 0);
      const destroyed = !!(root?.destroyed || root?.ruined || root?.crippled);
      const needsRepair = !!(root?.needsRepair || root?.repairNeeded);

      let score = 0;
      if (damageStep > 0) score += 2;
      if (destroyed) score += 3;
      if (needsRepair) score += 2;
      if (hitsRemaining > 0 && hitsRemaining <= 2) score += 1;
      if (Number.isFinite(hp) && Number.isFinite(maxHp) && maxHp > 0 && hp < maxHp) score += 2;

      if (score > 0) out.push({ path, score });
    }

    for (const [k, v] of Object.entries(root)) {
      if (v && typeof v === "object") collectDamageSignals(v, path ? `${path}.${k}` : k, out, depth + 1);
    }
  }

  function getRepairSignals(observation) {
    const out = [];
    try { collectDamageSignals(observation?.faction || null, "observation.faction", out, 0); } catch (_) {}
    try { collectDamageSignals(observation?.raid?.activeSession || null, "observation.raid.activeSession", out, 0); } catch (_) {}
    try { collectDamageSignals(observation?.territory?.ownedHexes || null, "observation.territory.ownedHexes", out, 0); } catch (_) {}
    return out;
  }
  function getRecentTextCorpus(observation) {
    const rows = []
      .concat(Array.isArray(observation?.faction?.recentWarLogs) ? observation.faction.recentWarLogs : [])
      .concat(Array.isArray(observation?.raid?.recentRaidLogs) ? observation.raid.recentRaidLogs : []);
    return rows.map(r => [r?.type, r?.label, r?.activityKey, r?.targetName, r?.summary].filter(Boolean).join(" ").toLowerCase()).join(" || ");
  }

  function inferRepairNeed(observation) {
    const signals = getRepairSignals(observation);
    if (signals.length) {
      const total = signals.reduce((n, s) => n + (Number(s?.score || 0) || 0), 0);
      if (total >= 6) return { level: 3, source: "live", signals };
      if (total >= 3) return { level: 2, source: "live", signals };
      return { level: 1, source: "live", signals };
    }

    const corpus = getRecentTextCorpus(observation);
    if (corpus && /(breach|damag|destroy|ruin|crippl|repair|facility|rig|siege|boss)/.test(corpus)) {
      return { level: 1, source: "history", signals: [] };
    }

    return { level: 0, source: "none", signals: [] };
  }

  function inferEconomyNeed(observation) {
    const pressure = summarizePressure(observation) || {};
    const bank = normalizeCost(observation?.faction?.opBank || {});
    const logistics = pressure?.logistics || {};
    const ratio = Number(logistics?.ratio || 0) || 0;
    let need = 0;
    if ((bank.economy || 0) <= 1) need += 1;
    if ((bank.logistics || 0) <= 1) need += 1;
    if (ratio >= 0.8) need += 2;
    else if (ratio >= 0.65) need += 1;
    return need;
  }

  function inferMoraleNeed(observation) {
    const pressure = summarizePressure(observation) || {};
    const morale = Number(pressure?.morale || 0) || 0;
    const loyalty = Number(pressure?.loyalty || 0) || 0;
    return (morale > 0 ? 1 : 0) + (loyalty > 0 ? 1 : 0);
  }

  function getTravelTraceFrequency(observation) {
    const map = new Map();
    const traces = Array.isArray(observation?.travel?.traces) ? observation.travel.traces : [];
    for (const t of traces) {
      const key = String(t?.travel?.hexTo || t?.hexUuid || "");
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }

  function getLatestTravelHexUuid(observation) {
    return String(observation?.travel?.latest?.hexUuid || observation?.travel?.latest?.travel?.hexTo || "");
  }

  function inferCampaignTravelHooks(observation) {
    const hooks = new Set();
    const session = observation?.raid?.activeSession || null;
    if (session?.targetUuid) hooks.add(String(session.targetUuid));
    const recent = Array.isArray(observation?.raid?.recentRaidLogs) ? observation.raid.recentRaidLogs : [];
    for (const r of recent.slice(0, 4)) {
      if (r?.targetUuid) hooks.add(String(r.targetUuid));
    }
    return hooks;
  }

  function formatFactorLabel(key) {
    const map = {
      opEfficiency: "OP efficiency",
      risk: "risk",
      darknessBenefit: "darkness relief",
      historyPenalty: "history",
      campaignFit: "campaign fit",
      duplicatePenalty: "duplicated grant copies",
      pressureFit: "pressure fit",
      certainty: "certainty",
      explorationValue: "exploration value",
      missionValue: "mission value",
      situationalFit: "situational fit"
    };
    return map[key] || key;
  }

  function deriveConfidence(candidate, runnerUp) {
    if (!candidate) return { band: "none", reason: "No candidate available." };
    if (candidate?.legal === false) return { band: "avoid", reason: "Candidate is currently illegal." };

    const risk = String(candidate?.riskBand || candidate?.historicalRisk?.riskBand || "unknown").toLowerCase();
    const successBand = String(candidate?.expectedSuccessBand || "").toLowerCase();
    const score = Number(candidate?.score || 0) || 0;
    const spread = (Number(candidate?.score || 0) || 0) - (Number(runnerUp?.score || 0) || 0);
    const certainty = Number(candidate?.factors?.certainty || 0) || 0;
    const historyPenalty = Number(candidate?.factors?.historyPenalty || 0) || 0;

    if (risk === "high" && (successBand === "low" || historyPenalty <= -2)) {
      return { band: "avoid", reason: "High-risk option with weak raid outlook." };
    }
    if (spread >= 2 && score >= 4 && risk === "low") {
      return { band: "strong", reason: "Clear lead with low risk." };
    }
    if (spread >= 1 && score >= 2 && risk !== "high" && certainty >= 0) {
      return { band: "moderate", reason: "Positive edge over runner-up." };
    }
    if (score > 0 && risk !== "high") {
      return { band: "moderate", reason: "Reasonable option, but edge is modest." };
    }
    if (score >= -1 && risk !== "high") {
      return { band: "weak", reason: "Best available, but only marginally favorable." };
    }
    return { band: "avoid", reason: "Best available option still looks poor." };
  }

  function buildDecisionBasis(candidate) {
    if (!candidate) return [];
    const basis = [];
    const reasons = Array.isArray(candidate?.relevanceReasons) ? candidate.relevanceReasons : [];
    for (const r of reasons.slice(0, 3)) {
      if (!basis.includes(r)) basis.push(r);
    }
    const positives = Object.entries(candidate?.factors || {})
      .filter(([, v]) => Number(v || 0) > 0)
      .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0));
    for (const [k] of positives.slice(0, 2)) {
      const label = formatFactorLabel(k);
      if (!basis.some(x => x.toLowerCase().includes(label.toLowerCase()))) basis.push(`helped by ${label}`);
    }
    const risk = String(candidate?.riskBand || candidate?.historicalRisk?.riskBand || "").toLowerCase();
    if (risk === "low" && !basis.includes("keeps risk low")) basis.push("keeps risk low");
    return basis.slice(0, 4);
  }

  function explainWinningCandidate(candidate, category) {
    if (!candidate) return `No ${category} candidates were available.`;

    const label = candidate.label || candidate.key || candidate.activityKey || candidate.toHexName || candidate.toHexUuid || "candidate";
    const bits = [label];

    const risk = candidate.riskBand || candidate.historicalRisk?.riskBand || null;
    if (category === "travel") {
      const terrain = candidate.terrain || null;
      const tier = Number(candidate.encounterTier || 0) || 0;
      if (risk) bits.push(`${risk}-risk travel`);
      if (terrain && terrain !== "unknown") bits.push(terrain);
      if (tier) bits.push(`encounter tier ${tier}`);
      if (candidate.toHexName) bits.push(`toward ${candidate.toHexName}`);
    } else if (category === "strategic") {
      if (risk) bits.push(`${risk}-risk`);
      const reasons = Array.isArray(candidate.relevanceReasons) ? candidate.relevanceReasons.slice(0, 2) : [];
      if (reasons.length) bits.push(reasons.join(", "));
    } else if (category === "raid") {
      const cost = sumOP(candidate.cost || candidate.projectedCost || candidate.expectedCost || {});
      if (cost > 0) bits.push(`cost ${cost} OP`);
      if (risk) bits.push(`risk ${risk}`);
      if (candidate.expectedSuccessBand) bits.push(`expected success ${candidate.expectedSuccessBand}`);
      if (candidate.matchMode) bits.push(`match ${candidate.matchMode}`);
      if (candidate.targetName) bits.push(`target ${candidate.targetName}`);
    } else {
      if (risk) bits.push(`risk ${risk}`);
      const reasons = Array.isArray(candidate.relevanceReasons) ? candidate.relevanceReasons.slice(0, 2) : [];
      if (reasons.length) bits.push(reasons.join(", "));
      else if (candidate.toHexName) bits.push(`destination ${candidate.toHexName}`);
      else if (candidate.targetName) bits.push(`target ${candidate.targetName}`);
    }

    if (candidate?.confidence) bits.push(`confidence ${candidate.confidence}`);
    return bits.filter(Boolean).join(" • ");
  }
  function explainWhyNot(top, runnerUp, category) {
    if (!top || !runnerUp) return null;
    const loser = runnerUp.label || runnerUp.key || runnerUp.activityKey || runnerUp.toHexName || "runner-up";
    const reasons = [];
    const scoreDelta = Math.round((((Number(top.score || 0) - Number(runnerUp.score || 0)) || 0) * 100)) / 100;
    if (scoreDelta) reasons.push(`scored ${scoreDelta} lower`);

    const topRisk = bandRank(top?.riskBand);
    const loseRisk = bandRank(runnerUp?.riskBand);
    if (loseRisk > topRisk) reasons.push(`carried higher risk`);
    const topCost = sumOP(top?.cost || top?.projectedCost || top?.expectedCost || {});
    const loseCost = sumOP(runnerUp?.cost || runnerUp?.projectedCost || runnerUp?.expectedCost || {});
    if (loseCost > topCost) reasons.push(`cost more OP`);

    const negFactors = Object.entries(runnerUp?.factors || {}).filter(([,v]) => Number(v || 0) < 0).sort((a,b)=>Number(a[1])-Number(b[1]));
    if (negFactors.length) reasons.push(`penalized on ${formatFactorLabel(negFactors[0][0])}`);

    return `${loser} placed behind ${category} winner because it ${reasons.join(", ")}.`;
  }

  function malBandPhrase(confidence) {
    const s = String(confidence || "").toLowerCase();
    if (s === "strong") return "This is the clean play.";
    if (s === "moderate") return "This is probably your smartest move right now.";
    if (s === "weak") return "You can do it, but I would not carve it into stone tablets.";
    if (s === "avoid") return "This is technically on the board and spiritually a trap.";
    return "The board is not giving me a clean sermon here.";
  }

  function malDecisionBasis(bits) {
    const arr = Array.isArray(bits) ? bits.filter(Boolean) : [];
    if (!arr.length) return "The evidence stack is thin, so I am operating on vibes and telemetry.";
    if (arr.length === 1) return `Why? ${arr[0]}.`;
    if (arr.length === 2) return `Why? ${arr[0]}, and ${arr[1]}.`;
    return `Why? ${arr.slice(0, -1).join(", ")}, and ${arr[arr.length - 1]}.`;
  }

  function malExplainCandidate(candidate, category) {
    if (!candidate) {
      if (category === "raid") return "No raid recommendation, sweetheart. The machine looked into the abyss and chose restraint.";
      if (category === "travel") return "No travel recommendation. Apparently nowhere is calling loud enough to matter.";
      if (category === "strategic") return "No strategic recommendation. Which is impressive, because this game tracks enough moving parts to frighten a lesser god.";
      return "No recommendation. The board has gone quiet.";
    }

    const label = candidate.label || candidate.key || candidate.activityKey || candidate.toHexName || candidate.toHexUuid || "candidate";
    const conf = malBandPhrase(candidate?.confidence);
    const basis = malDecisionBasis(candidate?.decisionBasis || candidate?.relevanceReasons || []);
    const risk = String(candidate?.riskBand || candidate?.historicalRisk?.riskBand || "unknown").toLowerCase();

    if (category === "strategic") {
      return `${label}. ${conf} ${basis} Risk is ${risk}.`;
    }
    if (category === "travel") {
      const terrain = candidate?.terrain && candidate.terrain !== "unknown" ? ` Terrain reads as ${candidate.terrain}.` : "";
      const tier = Number(candidate?.encounterTier || 0) || 0;
      const tierTxt = tier ? ` Encounter tier looks like ${tier}.` : "";
      return `${label}. ${conf} ${basis} Risk is ${risk}.${terrain}${tierTxt}`;
    }
    if (category === "raid") {
      const target = candidate?.targetName ? ` Target is ${candidate.targetName}.` : "";
      const success = candidate?.expectedSuccessBand ? ` Expected success is ${candidate.expectedSuccessBand}.` : "";
      const cost = sumOP(candidate?.cost || candidate?.projectedCost || candidate?.expectedCost || {});
      const costTxt = cost > 0 ? ` It wants ${cost} OP.` : "";
      return `${label}. ${conf} ${basis} Risk is ${risk}.${success}${costTxt}${target}`;
    }
    return `${label}. ${conf} ${basis} Risk is ${risk}.`;
  }

  function malExplainWhyNot(top, runnerUp, category) {
    if (!top || !runnerUp) return null;
    const label = runnerUp.label || runnerUp.key || runnerUp.activityKey || runnerUp.toHexName || "runner-up";
    const why = explainWhyNot(top, runnerUp, category);
    const topLabel = top.label || top.key || top.activityKey || top.toHexName || "the winner";
    const topScore = Number(top?.score || 0) || 0;
    const loseScore = Number(runnerUp?.score || 0) || 0;
    const spread = Math.round((topScore - loseScore) * 100) / 100;
    const riskGap = bandRank(runnerUp?.riskBand) - bandRank(top?.riskBand);

    if (!why || /because it\s*\.$/.test(why)) {
      if (Math.abs(spread) < 0.01) {
        return `${label} did not get the nod. It was effectively tied with ${topLabel}, but the advisor gave ${topLabel} the slightest edge on tie-break ordering.`;
      }
      if (spread <= 0.5 && riskGap <= 0) {
        return `${label} did not get the nod. It was a very close second, but the advisor leaned toward ${topLabel} by a hair.`;
      }
      return `${label} did not get the nod. ${topLabel} looked a little cleaner in context, even if the gap was small.`;
    }

    return `${label} did not get the nod. ${why}`;
  }
  async function buildStrategicCandidates(factionId, observation, opts) {
    opts = opts || {};
    const legal = await listLegalStrategicActions(factionId, observation);
    if (!legal?.ok) return legal;

    const out = [];
    for (const a of (legal.actions || [])) {
      const cost = normalizeCost(a.cost || {});
      out.push({
        type: "strategic",
        category: "strategic",
        key: a.key,
        label: a.label || a.key,
        legal: !!a.legal,
        cost,
        projectedCost: cost,
        projectedCostTotal: sumOP(cost),
        source: a.source || "actor-item",
        sourceCount: Number(a.sourceCount || 1) || 1,
        duplicateGrantWarning: a.duplicateGrantWarning || null,
        reasons: copy(a.reasons || []),
        riskBand: a.legal ? "low" : "high",
        explanation: a.legal
          ? "Legal strategic action available on actor items; dry-run only."
          : "Strategic action is currently illegal due to OP deficit; dry-run only."
      });
    }

    return { ok: true, ts: Date.now(), factionId, candidates: out };
  }

  async function buildTravelCandidates(factionId, observation, opts) {
    opts = opts || {};
    const owned = Array.isArray(observation?.territory?.ownedHexes) ? observation.territory.ownedHexes : [];
    const traces = Array.isArray(observation?.travel?.traces) ? observation.travel.traces : [];
    const latest = observation?.travel?.latest || null;
    const homeHexUuid = observation?.territory?.homeHexUuid || null;

    const seeds = [];
    for (const row of owned) {
      seeds.push({ fromHexUuid: homeHexUuid || latest?.hexUuid || null, toHexUuid: row.hexUuid, toHexName: row.hexName || row.hexUuid });
    }
    for (const t of traces) {
      seeds.push({
        fromHexUuid: t?.travel?.hexFrom || latest?.hexUuid || null,
        toHexUuid: t?.travel?.hexTo || t?.hexUuid || null,
        toHexName: t?.travel?.toHexName || t?.hexName || t?.hexUuid || null
      });
    }

    const deduped = uniqueBy(seeds, s => `${s.fromHexUuid || ""}::${s.toHexUuid || ""}`)
      .filter(s => !!s.toHexUuid)
      .filter(s => !(s.fromHexUuid && s.toHexUuid && String(s.fromHexUuid) === String(s.toHexUuid)));

    const out = [];

    for (const seed of deduped.slice(0, Number(opts.travelCandidateLimit || 12) || 12)) {
      const est = await estimateTravel({
        factionId,
        observation,
        fromHexUuid: seed.fromHexUuid || null,
        toHexUuid: seed.toHexUuid
      });
      if (!est?.ok) continue;
      if (est?.fromHexUuid && est?.toHexUuid && String(est.fromHexUuid) === String(est.toHexUuid)) continue;

      out.push({
        type: "travel",
        category: "travel",
        label: seed.toHexName || est.toHexUuid || "Travel",
        toHexUuid: est.toHexUuid,
        toHexName: seed.toHexName || est.toHexUuid || null,
        fromHexUuid: est.fromHexUuid || null,
        terrain: est.terrain || "unknown",
        projectedCost: normalizeCost(est.projectedCost || {}),
        projectedCostTotal: sumOP(est.projectedCost || {}),
        encounterTier: est.encounterTier,
        riskBand: est.riskBand || "unknown",
        logisticsImpact: est.logisticsImpact ?? null,
        explanation: est.explanation || "Travel estimate from recorded traces only; dry-run."
      });
    }

    return { ok: true, ts: Date.now(), factionId, candidates: out };
  }

  

  async function buildRaidCandidates(factionId, observation, opts) {
    opts = opts || {};
    const session = observation?.raid?.activeSession || null;
    const recent = Array.isArray(observation?.raid?.recentRaidLogs) ? observation.raid.recentRaidLogs : [];
    const seeds = [];

    if (session?.activityKey || session?.targetUuid) {
      seeds.push({
        activityKey: session?.activityKey || null,
        targetUuid: session?.targetUuid || null,
        targetName: session?.targetName || null,
        targetType: session?.targetType || null,
        maneuvers: Array.isArray(session?.maneuvers) ? copy(session.maneuvers) : []
      });
    }

    for (const r of recent) {
      if (!r?.activityKey && !r?.targetUuid) continue;
      seeds.push({
        activityKey: r.activityKey || null,
        targetUuid: r.targetUuid || null,
        targetName: r.targetName || null,
        targetType: r.targetType || null,
        maneuvers: Array.isArray(r?.maneuvers) ? copy(r.maneuvers) : []
      });
    }

    const deduped = uniqueBy(seeds, s => `${s.activityKey || ""}::${s.targetUuid || ""}::${s.targetName || ""}::${s.targetType || ""}`);
    const out = [];

    for (const seed of deduped.slice(0, Number(opts.raidCandidateLimit || 12) || 12)) {
      const est = await estimateRaid({
        factionId,
        observation,
        activityKey: seed.activityKey || null,
        targetUuid: seed.targetUuid || null,
        targetName: seed.targetName || null,
        targetType: seed.targetType || null,
        maneuvers: Array.isArray(seed.maneuvers) ? seed.maneuvers : []
      });
      if (!est?.ok) continue;

      out.push({
        type: "raid",
        category: "raid",
        label: seed.activityKey || "Raid",
        activityKey: est.activityKey || seed.activityKey || null,
        targetUuid: est.targetUuid || seed.targetUuid || null,
        targetName: seed.targetName || null,
        targetType: seed.targetType || null,
        legal: !!est.legal,
        expectedSuccessBand: est.expectedSuccessBand || "unknown",
        expectedCost: normalizeCost(est.expectedCost || {}),
        projectedCost: normalizeCost(est.expectedCost || {}),
        projectedCostTotal: sumOP(est.expectedCost || {}),
        historicalRisk: copy(est.historicalRisk || {}),
        riskBand: est.historicalRisk?.riskBand || "unknown",
        matchMode: est.matchMode || "none",
        maneuverPreviewSummary: copy(est.maneuverPreviewSummary || []),
        riskFlags: copy(est.riskFlags || []),
        explanation: est.explanation || "Raid estimate from history plus dry-run maneuver previews only."
      });
    }

    return { ok: true, ts: Date.now(), factionId, candidates: out };
  }

  function collectAdvisorWarnings(raw) {
    const warnings = [];
    const strategic = Array.isArray(raw?.strategic) ? raw.strategic : [];
    const dupes = strategic.filter(c => (Number(c?.sourceCount || 1) || 1) > 1);
    for (const c of dupes) {
      const label = c?.label || c?.key || "Strategic";
      const count = Number(c?.sourceCount || 1) || 1;
      warnings.push(`${label}: observed ${count} duplicated grant copies on the faction; recommendation score lightly deweighted and surfaced for cleanup.`);
    }
    return warnings;
  }

  async function recommendNextActions(factionId, opts) {
    opts = opts || {};
    const includeStrategic = opts.includeStrategic !== false;
    const includeTravel = opts.includeTravel !== false;
    const includeRaid = opts.includeRaid !== false;
    const debug = !!opts.debug;

    const observation = opts.observation || await getObservationSnapshot(factionId, opts.observationOpts || {});
    if (!observation?.ok) return observation;

    const warnings = [];
    const raw = { strategic: [], travel: [], raid: [] };
    const buckets = {
      strategic: [],
      travel: [],
      raid: [],
      overall: []
    };

    if (includeStrategic) {
      const strategic = await buildStrategicCandidates(factionId, observation, opts);
      if (strategic?.ok) {
        raw.strategic = copy(strategic.candidates || []);
        const scored = await scoreCandidates({ factionId, observation, candidates: strategic.candidates });
        if (scored?.ok) buckets.strategic = scored.scored || [];
        else warnings.push("Failed to score strategic candidates.");
      } else warnings.push("Failed to build strategic candidates.");
    }

    if (includeTravel) {
      const travel = await buildTravelCandidates(factionId, observation, opts);
      if (travel?.ok) {
        raw.travel = copy(travel.candidates || []);
        const scored = await scoreCandidates({ factionId, observation, candidates: travel.candidates });
        if (scored?.ok) buckets.travel = scored.scored || [];
        else warnings.push("Failed to score travel candidates.");
      } else warnings.push("Failed to build travel candidates.");
    }

    if (includeRaid) {
      const raid = await buildRaidCandidates(factionId, observation, opts);
      if (raid?.ok) {
        raw.raid = copy(raid.candidates || []);
        const scored = await scoreCandidates({ factionId, observation, candidates: raid.candidates });
        if (scored?.ok) buckets.raid = scored.scored || [];
        else warnings.push("Failed to score raid candidates.");
      } else warnings.push("Failed to build raid candidates.");
    }

    buckets.overall = []
      .concat(buckets.strategic || [], buckets.travel || [], buckets.raid || [])
      .sort((a,b) => {
        const ds = (Number(b?.score || 0) - Number(a?.score || 0));
        if (ds) return ds;
        const rb = bandRank(a?.riskBand) - bandRank(b?.riskBand);
        if (rb) return rb;
        const dc = (sumOP(a?.cost || a?.projectedCost || a?.expectedCost || {})) - (sumOP(b?.cost || b?.projectedCost || b?.expectedCost || {}));
        if (dc) return dc;
        return String(a?.label || a?.key || "").localeCompare(String(b?.label || b?.key || ""));
      });

    const top = {
      strategic: topCandidate(buckets.strategic),
      travel: topCandidate(buckets.travel),
      raid: topCandidate(buckets.raid),
      overall: topCandidate(buckets.overall)
    };
    const runnersUp = {
      strategic: (buckets.strategic || [])[1] || null,
      travel: (buckets.travel || [])[1] || null,
      raid: (buckets.raid || [])[1] || null,
      overall: (buckets.overall || [])[1] || null
    };

    for (const key of ["strategic", "travel", "raid", "overall"]) {
      const cand = top[key];
      if (!cand) continue;
      const confidence = deriveConfidence(cand, runnersUp[key]);
      cand.confidence = confidence.band;
      cand.confidenceReason = confidence.reason;
      cand.decisionBasis = buildDecisionBasis(cand);
    }

    if (!buckets.overall.length) warnings.push("No candidates available from the requested advisor categories.");
    warnings.push(...collectAdvisorWarnings(raw));

    const result = {
      ok: true,
      spec: "bbttcc.advisor.v0.6.1-mal",
      ts: Date.now(),
      factionId: observation?.faction?.id || factionId || null,
      observationSummary: {
        factionName: observation?.faction?.name || null,
        tier: Number(observation?.faction?.tier || 0) || 0,
        opTotal: Number(observation?.faction?.opTotal || 0) || 0,
        ownedHexCount: Number(observation?.territory?.ownedHexCount || 0) || 0,
        hasActiveRaidSession: !!observation?.raid?.hasActiveSession,
        activeCampaignId: observation?.campaign?.activeCampaignId || null,
        pressureSummary: summarizePressure(observation),
        darknessSummary: summarizeDarkness(observation)
      },
      top,
      ranked: buckets,
      confidence: {
        strategic: top.strategic?.confidence || null,
        travel: top.travel?.confidence || null,
        raid: top.raid?.confidence || null,
        overall: top.overall?.confidence || null
      },
      decisionBasis: {
        strategic: copy(top.strategic?.decisionBasis || []),
        travel: copy(top.travel?.decisionBasis || []),
        raid: copy(top.raid?.decisionBasis || []),
        overall: copy(top.overall?.decisionBasis || [])
      },
      rationale: {
        strategic: explainWinningCandidate(top.strategic, "strategic"),
        travel: explainWinningCandidate(top.travel, "travel"),
        raid: explainWinningCandidate(top.raid, "raid"),
        overall: explainWinningCandidate(top.overall, "overall")
      },
      whyNot: {
        strategic: explainWhyNot(top.strategic, runnersUp.strategic, "strategic"),
        travel: explainWhyNot(top.travel, runnersUp.travel, "travel"),
        raid: explainWhyNot(top.raid, runnersUp.raid, "raid"),
        overall: explainWhyNot(top.overall, runnersUp.overall, "overall")
      },
      mal: {
        strategic: malExplainCandidate(top.strategic, "strategic"),
        travel: malExplainCandidate(top.travel, "travel"),
        raid: malExplainCandidate(top.raid, "raid"),
        overall: malExplainCandidate(top.overall, "overall"),
        whyNot: {
          strategic: malExplainWhyNot(top.strategic, runnersUp.strategic, "strategic"),
          travel: malExplainWhyNot(top.travel, runnersUp.travel, "travel"),
          raid: malExplainWhyNot(top.raid, runnersUp.raid, "raid"),
          overall: malExplainWhyNot(top.overall, runnersUp.overall, "overall")
        }
      },
      warnings,
      constraints: copy(observation?.constraints || {
        dryRun: true,
        canMutate: false,
        canSpendOP: false,
        canCommitRaid: false,
        canCallWME: false
      })
    };

    if (debug) {
      result.debug = {
        strategicCandidates: copy(raw.strategic),
        travelCandidates: copy(raw.travel),
        raidCandidates: copy(raw.raid),
        scored: {
          strategic: copy(buckets.strategic || []),
          travel: copy(buckets.travel || []),
          raid: copy(buckets.raid || []),
          overall: copy(buckets.overall || [])
        },
        repairSignals: copy(getRepairSignals(observation))
      };
    }

    return result;
  }


  // ----------------------------
  // GM Advisor Sprint 2 (v0.9)
  // Terrain-aware table suggestions + beat bridge
  // ----------------------------
  function getStoryStateSafe() {
    try {
      return game && game.bbttcc && game.bbttcc.api && game.bbttcc.api.story && game.bbttcc.api.story.gottgait
        && typeof game.bbttcc.api.story.gottgait.getState === "function"
        ? copy(game.bbttcc.api.story.gottgait.getState() || {})
        : {};
    } catch (_) { return {}; }
  }

  function inferGMFactionId(opts) {
    opts = opts || {};
    if (opts.factionId) {
      const raw = String(opts.factionId || "").trim();
      return raw.startsWith("Actor.") ? raw.slice(6) : raw;
    }

    const storyState = getStoryStateSafe();
    const activeCampaignId = String(opts.activeCampaignId || storyState.activeCampaignId || "").trim();

    try {
      if (activeCampaignId) {
        const raw = game.settings && game.settings.get ? game.settings.get("bbttcc-campaign", "campaigns") : null;
        const list = Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? Object.values(raw) : []);
        for (const c of (list || [])) {
          if (!c) continue;
          const cid = String(c.id || c.campaignId || "").trim();
          if (cid !== activeCampaignId) continue;
          const fid = c.factionId || c.defaultFactionId || (c.campaign && c.campaign.factionId) || null;
          if (fid) {
            const rawF = String(fid || "").trim();
            return rawF.startsWith("Actor.") ? rawF.slice(6) : rawF;
          }
        }
      }
    } catch (_) {}

    try {
      const actors = (game.actors && game.actors.contents) ? game.actors.contents : [];
      for (const a of actors) {
        const ff = a && a.flags ? a.flags["bbttcc-factions"] : null;
        if (!ff) continue;
        const terr = collectTerritoryForFaction(a.id);
        if ((terr.ownedHexes && terr.ownedHexes.length) || (terr.travelTraces && terr.travelTraces.length)) return String(a.id);
      }
      for (const a of actors) {
        if (a && a.flags && a.flags["bbttcc-factions"]) return String(a.id);
      }
    } catch (_) {}

    return null;
  }

  function detectStabilityDrift(observation) {
    const pressure = summarizePressure(observation) || {};
    const morale = Number(pressure.morale || 0) || 0;
    const loyalty = Number(pressure.loyalty || 0) || 0;
    const dark = summarizeDarkness(observation) || {};
    const globalDark = Number(dark.global || 0) || 0;
    let score = 0;
    const signals = [];
    if (morale >= 20 || loyalty >= 20) { score += 2; signals.push("faction strain is elevated"); }
    else if (morale >= 10 || loyalty >= 10) { score += 1; signals.push("faction strain is noticeable"); }
    if (globalDark >= 10) { score += 2; signals.push("darkness is materially rising"); }
    else if (globalDark >= 5) { score += 1; signals.push("darkness pressure is present"); }
    let band = "stable";
    if (score >= 4) band = "unstable";
    else if (score >= 2) band = "drifting";
    return { band, score, signals };
  }

  function detectOverextension(observation) {
    const pressure = summarizePressure(observation) || {};
    const logistics = pressure.logistics || {};
    const bank = normalizeCost(observation && observation.faction ? observation.faction.opBank || {} : {});
    const ownedHexCount = Number(observation && observation.territory ? observation.territory.ownedHexCount || 0 : 0) || 0;
    const travelTraceCount = Number(observation && observation.territory ? observation.territory.travelTraceCount || 0 : 0) || 0;
    const ratio = Number(logistics.ratio || 0) || 0;
    let score = 0;
    const signals = [];
    if (ratio >= 0.85) { score += 3; signals.push("logistics ratio is near cap"); }
    else if (ratio >= 0.65) { score += 2; signals.push("logistics ratio is running hot"); }
    if ((bank.logistics || 0) <= 1) { score += 1; signals.push("logistics bank is thin"); }
    if ((bank.economy || 0) <= 1) { score += 1; signals.push("economy bank is thin"); }
    if (ownedHexCount >= 6) { score += 1; signals.push("territory footprint is broadening"); }
    if (travelTraceCount >= 3) { score += 1; signals.push("travel activity suggests expansion tempo"); }
    let band = "contained";
    if (score >= 5) band = "overextended";
    else if (score >= 3) band = "pressured";
    return { band, score, signals };
  }

  function detectNarrativeMomentum(observation) {
    const campaign = observation && observation.campaign ? observation.campaign : {};
    const activeCampaignId = String(campaign.activeCampaignId || "").trim();
    const recent = Array.isArray(observation && observation.faction ? observation.faction.recentWarLogs : []) ? observation.faction.recentWarLogs : [];
    const raidCount = recent.filter(function (r) { return String(r && r.type || "").toLowerCase() === "raid"; }).length;
    const travelCount = Number(observation && observation.territory ? observation.territory.travelTraceCount || 0 : 0) || 0;
    let score = 0;
    const signals = [];
    if (activeCampaignId) { score += 1; signals.push("active campaign is present"); }
    else signals.push("no active campaign is set");
    if (raidCount >= 2) { score += 1; signals.push("recent raids provide strong hooks"); }
    if (travelCount >= 2) { score += 1; signals.push("travel movement offers beat injection windows"); }
    const band = score >= 3 ? "hot" : (score >= 1 ? "warm" : "cold");
    return { band, score, signals, activeCampaignId: activeCampaignId || null };
  }

  function detectDifficultyPressure(observation) {
    const recent = Array.isArray(observation && observation.raid ? observation.raid.recentRaidLogs : []) ? observation.raid.recentRaidLogs : [];
    let wins = 0, losses = 0, marginTotal = 0, counted = 0;
    for (const r of recent) {
      if (isSuccessTier(r && r.result)) wins += 1;
      else if (String(r && r.result || "").toLowerCase().includes("fail")) losses += 1;
      if (r && r.margin != null) { marginTotal += Number(r.margin || 0) || 0; counted += 1; }
    }
    const avgMargin = counted ? (marginTotal / counted) : 0;
    let recommendedTierAdjustment = 0;
    const signals = [];
    if (wins >= 3 && wins > losses && avgMargin >= 2) {
      recommendedTierAdjustment = 1;
      signals.push("faction is outperforming recent raid opposition");
    } else if (losses >= 2 && losses >= wins && avgMargin < 0) {
      recommendedTierAdjustment = -1;
      signals.push("faction is absorbing losses and may need air");
    } else {
      signals.push("current opposition looks roughly on pace");
    }
    const band = recommendedTierAdjustment > 0 ? "raise" : (recommendedTierAdjustment < 0 ? "ease" : "hold");
    return { band, recommendedTierAdjustment, avgMargin, signals };
  }

  function buildWorldSignalRecommendations(observation, detectors) {
    const recs = [];
    const stability = detectors.stability || {};
    const overextension = detectors.overextension || {};
    const narrative = detectors.narrative || {};
    const difficulty = detectors.difficulty || {};

    if (stability.band === "unstable") recs.push({ key: "pressure.corruption_surge", type: "world_pressure", priority: 95, rationale: "World stability is unstable; add corruption, unrest, or punitive pressure." });
    else if (stability.band === "drifting") recs.push({ key: "pressure.destabilize_local_region", type: "world_pressure", priority: 75, rationale: "Faction strain suggests adding a moderate destabilizing signal." });

    if (overextension.band === "overextended") {
      recs.push({ key: "pressure.logistics_crunch", type: "economy_pressure", priority: 92, rationale: "Logistics telemetry shows overextension; a supply crisis or convoy problem is warranted." });
      recs.push({ key: "beat.caravan_ambush", type: "campaign_beat", priority: 82, rationale: "Expansion pressure makes caravan or route disruption highly relevant." });
    } else if (overextension.band === "pressured") {
      recs.push({ key: "beat.supply_shortfall", type: "campaign_beat", priority: 68, rationale: "Resource pressure suggests a softer logistics complication." });
    }

    if (narrative.band === "hot") recs.push({ key: "injector.advance_active_thread", type: "narrative", priority: 85, rationale: "The table is generating enough motion to escalate an active campaign thread." });
    else if (narrative.band === "warm") recs.push({ key: "injector.seed_followup", type: "narrative", priority: 62, rationale: "Momentum is present; a follow-up beat would keep cadence healthy." });
    else recs.push({ key: "injector.discovery_ping", type: "narrative", priority: 58, rationale: "Momentum is cool; seed a discovery or invitation beat." });

    if (difficulty.recommendedTierAdjustment > 0) recs.push({ key: "difficulty.raise_encounter_tier", type: "difficulty", priority: 78, rationale: "Recent results suggest the faction can absorb sharper opposition." });
    else if (difficulty.recommendedTierAdjustment < 0) recs.push({ key: "difficulty.offer_breathing_room", type: "difficulty", priority: 70, rationale: "Recent results suggest easing pressure for a beat." });

    recs.sort(function (a, b) { return Number(b.priority || 0) - Number(a.priority || 0); });
    return recs;
  }

  function malExplainWorldSignals(observation, detectors, recommendations) {
    const factionName = observation && observation.faction ? (observation.faction.name || "this faction") : "this faction";
    const stability = detectors && detectors.stability ? detectors.stability.band || "stable" : "stable";
    const overextension = detectors && detectors.overextension ? detectors.overextension.band || "contained" : "contained";
    const narrative = detectors && detectors.narrative ? detectors.narrative.band || "warm" : "warm";
    const top = recommendations && recommendations.length ? recommendations[0] : null;
    const topTxt = top ? ("Top move: " + top.key + ".") : "I do not yet have a clean top move.";
    return factionName + " is reading as stability=" + stability + ", overextension=" + overextension + ", narrative=" + narrative + ". " + topTxt + " The world is not asleep, darling. It is waiting for you to make it inconvenient.";
  }

  async function getWorldSignals(factionId, opts) {
    opts = opts || {};
    const fid = factionId || inferGMFactionId(opts);
    if (!fid) return { ok: false, error: "no-faction-context" };
    const observation = await getObservationSnapshot(fid, opts.observationOpts || {});
    if (!observation || !observation.ok) return observation;

    const stability = detectStabilityDrift(observation);
    const overextension = detectOverextension(observation);
    const narrative = detectNarrativeMomentum(observation);
    const difficulty = detectDifficultyPressure(observation);
    const recommendations = buildWorldSignalRecommendations(observation, { stability, overextension, narrative, difficulty });

    return {
      ok: true,
      ts: Date.now(),
      factionId: fid,
      observation,
      stability,
      overextension,
      narrative,
      difficulty,
      recommendations
    };
  }

  function _safeCampaignStoreList() {
    try {
      const raw = game.settings && game.settings.get ? game.settings.get("bbttcc-campaign", "campaigns") : null;
      if (!raw) return [];
      if (Array.isArray(raw)) return raw.filter(Boolean);
      if (typeof raw === "object") return Object.keys(raw).map(function (k) { return raw[k]; }).filter(Boolean);
    } catch (_) {}
    return [];
  }

  function _safeTableStoreList() {
    try {
      const raw = game.settings && game.settings.get ? game.settings.get("bbttcc-campaign", "encounterTables") : null;
      if (!raw) return [];
      if (Array.isArray(raw)) return raw.filter(Boolean);
      if (typeof raw === "object") return Object.keys(raw).map(function (k) { return raw[k]; }).filter(Boolean);
    } catch (_) {}
    return [];
  }

  function _safeActiveCampaignRecord(activeCampaignId) {
    const cid = String(activeCampaignId || "").trim();
    if (!cid) return null;
    const list = _safeCampaignStoreList();
    for (const c of list) {
      const id = String((c && (c.id || c.campaignId)) || "").trim();
      if (id === cid) return copy(c);
    }
    return null;
  }

  function _gmSplitTags(tagStr) {
    return String(tagStr || "").split(/\s+/g).map(function (s) { return String(s || "").trim(); }).filter(Boolean);
  }

  function _gmCanonicalTag(tag) {
    const raw = String(tag || "").trim();
    if (!raw) return "";
    const map = {
      "trigger.travel_threshold": "inject.travel_threshold",
      "travel_threshold": "inject.travel_threshold",
      "enforcement": "inject.enforcement",
      "debt": "inject.debt_pressure",
      "hv.hidden_vault": "theme.discovery",
      "gilbert": "theme.auditor",
      "auditor": "theme.auditor",
      "locals": "theme.locals",
      "denizens": "theme.denizens",
      "machine_logic": "theme.machine_logic",
      "exploitation": "theme.exploitation",
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

  function _safeBeatTags(beat) {
    const tags = _gmSplitTags(beat && beat.tags ? beat.tags : "");
    return Array.from(new Set(tags.map(function (t) { return _gmCanonicalTag(t); }).filter(Boolean)));
  }

  function _recommendationTagHints(recKey, difficultyBand) {
    const key = String(recKey || "").trim();
    const map = {
      "pressure.destabilize_local_region": ["inject.enforcement", "inject.debt_pressure"],
      "pressure.corruption_surge": ["inject.debt_pressure", "inject.enforcement", "theme.auditor"],
      "pressure.logistics_crunch": ["inject.debt_pressure", "inject.travel_threshold"],
      "beat.caravan_ambush": ["inject.travel_threshold", "inject.enforcement"],
      "beat.supply_shortfall": ["inject.debt_pressure", "inject.travel_threshold"],
      "injector.advance_active_thread": ["inject.enforcement", "inject.debt_pressure", "theme.discovery", "theme.auditor"],
      "injector.seed_followup": ["inject.travel_threshold", "theme.discovery"],
      "injector.discovery_ping": ["theme.discovery", "inject.travel_threshold"],
      "difficulty.raise_encounter_tier": ["inject.enforcement", "inject.travel_threshold"],
      "difficulty.offer_breathing_room": ["theme.discovery", "inject.travel_threshold"]
    };
    const out = Array.isArray(map[key]) ? map[key].slice() : [];
    if (difficultyBand === "raise" && out.indexOf("inject.enforcement") === -1) out.push("inject.enforcement");
    return Array.from(new Set(out.map(function (t) { return _gmCanonicalTag(t); }).filter(Boolean)));
  }

  function _normalizeAdvisorTerrainKey(rawTerrain) {
    const s = String(rawTerrain || "").trim().toLowerCase();
    if (!s) return "plains";
    const map = {
      plain: "plains",
      plains: "plains",
      forest: "forest",
      woods: "forest",
      woodland: "forest",
      mountain: "mountains",
      mountains: "mountains",
      canyon: "canyons",
      canyons: "canyons",
      swamp: "swamp",
      marsh: "swamp",
      desert: "desert",
      river: "river",
      ocean: "ocean",
      sea: "ocean",
      ruin: "ruins",
      ruins: "ruins",
      wasteland: "wasteland"
    };
    return map[s] || s.replace(/\s+/g, "_");
  }

  function _inferAdvisorTerrain(observation) {
    const latest = observation && observation.travel ? observation.travel.latest || null : null;
    const latestTerrain = latest ? (latest.terrainType || (latest.travel ? latest.travel.terrainType : null) || null) : null;
    if (latestTerrain) return _normalizeAdvisorTerrainKey(latestTerrain);
    const owned = Array.isArray(observation && observation.territory ? observation.territory.ownedHexes : []) ? observation.territory.ownedHexes : [];
    if (owned.length) {
      const last = owned[owned.length - 1] || null;
      const terr = last ? (last.terrainType || last.terrain || null) : null;
      if (terr) return _normalizeAdvisorTerrainKey(terr);
    }
    return "plains";
  }

  function _findAdvisorTableCandidate(activeCampaignId, terrainKey, tierWanted) {
    const tables = _safeTableStoreList();
    if (!tables.length) return null;
    const terrain = _normalizeAdvisorTerrainKey(terrainKey);
    const wantedTier = Number(tierWanted || 1) || 1;
    const exactId = "travel_" + terrain + "_t" + wantedTier;
    const fallbackId = "travel_" + terrain + "_t1";
    const normalizedCampaignId = String(activeCampaignId || "").trim();

    const pool = tables.filter(function (t) {
      if (!t) return false;
      const tcid = String((t.campaignId || t.campaign || t.parentCampaignId || "")).trim();
      if (!normalizedCampaignId) return true;
      return !tcid || tcid === normalizedCampaignId;
    });

    function scoreTable(t) {
      const id = String((t && t.id) || "").trim();
      const terrainField = _normalizeAdvisorTerrainKey(t && (t.terrain || t.terrainType || t.biome || ""));
      const tierField = Number((t && (t.tier || t.tableTier)) || 0) || 0;
      let score = 0;
      if (id === exactId) score += 10;
      if (id === fallbackId) score += 7;
      if (terrainField === terrain) score += 4;
      if (tierField === wantedTier) score += 3;
      else if (wantedTier === 1 && tierField === 0) score += 1;
      if (/^travel_/.test(id)) score += 1;
      return score;
    }

    const ranked = pool.map(function (t) { return { table: t, score: scoreTable(t) }; })
      .filter(function (row) { return row.score > 0; })
      .sort(function (a, b) {
        return (Number(b.score || 0) - Number(a.score || 0)) || String((a.table && a.table.id) || "").localeCompare(String((b.table && b.table.id) || ""));
      });

    if (!ranked.length) return null;
    return copy(ranked[0].table);
  }

  function _extractAdvisorTableTier(table) {
    const id = String((table && table.id) || "").trim();
    const tierField = Number((table && (table.tier || table.tableTier)) || 0) || 0;
    if (tierField > 0) return tierField;
    const m = id.match(/_t(\d+)$/i);
    return m ? (Number(m[1] || 1) || 1) : 1;
  }

  function _computeAdvisorTableTier(observation, detectors, recommendations, opts) {
    opts = opts || {};
    const maxTier = Math.max(1, Number(opts.maxAdvisorTableTier || 3) || 3);
    const difficultyBand = String(detectors && detectors.difficulty ? detectors.difficulty.band || "" : "").toLowerCase();
    const difficultyDelta = Number(detectors && detectors.difficulty ? detectors.difficulty.recommendedTierAdjustment || 0 : 0) || 0;
    const stabilityBand = String(detectors && detectors.stability ? detectors.stability.band || "" : "").toLowerCase();
    const overBand = String(detectors && detectors.overextension ? detectors.overextension.band || "" : "").toLowerCase();
    const factionTier = Number(observation && observation.faction ? observation.faction.tier || 0 : 0) || 0;
    const dark = summarizeDarkness(observation) || {};
    const globalDark = Number(dark.global || 0) || 0;
    const recs = Array.isArray(recommendations) ? recommendations : [];
    const topRec = recs[0] || null;

    let tier = 1;
    if (difficultyBand === "raise" || difficultyDelta > 0) tier += 1;
    if (stabilityBand === "unstable") tier += 1;
    else if (stabilityBand === "drifting" && globalDark >= 8) tier += 1;
    if (overBand === "overextended") tier += 1;
    if (factionTier >= 3 && (difficultyBand === "raise" || stabilityBand === "unstable" || overBand === "overextended")) tier += 1;
    if (topRec && String(topRec.key || "") === "pressure.corruption_surge") tier += 1;
    if (globalDark >= 15) tier += 1;

    if (difficultyBand === "ease") tier -= 1;
    tier = Math.max(1, Math.min(maxTier, tier));
    return tier;
  }

  function resolveCampaignTableSuggestions(observation, detectors, recommendations, opts) {
    opts = opts || {};
    const activeCampaignId = String((opts.activeCampaignId || (observation && observation.campaign ? observation.campaign.activeCampaignId : "") || "")).trim();
    const terrainKey = _inferAdvisorTerrain(observation);
    const tierWanted = _computeAdvisorTableTier(observation, detectors, recommendations, opts);

    let table = null;
    for (let t = tierWanted; t >= 1; t--) {
      table = _findAdvisorTableCandidate(activeCampaignId, terrainKey, t);
      if (table) break;
    }
    if (!table) table = _findAdvisorTableCandidate(activeCampaignId, terrainKey, 1);
    if (!table) return [];

    const recs = Array.isArray(recommendations) ? recommendations : [];
    const topRec = recs[0] || null;
    const id = String((table && table.id) || "").trim();
    const label = String((table && (table.label || table.name || table.id)) || id || "Encounter Table").trim();
    const selectedTier = _extractAdvisorTableTier(table);
    const tierReasonBits = [];
    if (tierWanted >= 2) tierReasonBits.push("pressure supports a sharper encounter tier");
    if (String(detectors && detectors.stability ? detectors.stability.band || "" : "") === "unstable") tierReasonBits.push("stability is unstable");
    if (String(detectors && detectors.overextension ? detectors.overextension.band || "" : "") === "overextended") tierReasonBits.push("logistics are overextended");
    const fallbackNote = selectedTier < tierWanted ? (" Best available table tops out at tier " + selectedTier + ".") : "";

    return [{
      tableId: id,
      tableLabel: label,
      campaignId: activeCampaignId || null,
      terrain: terrainKey,
      tier: selectedTier,
      desiredTier: tierWanted,
      recommendationKey: topRec && topRec.key ? topRec.key : "table.travel",
      recommendationType: topRec && topRec.type ? topRec.type : "table",
      score: Math.max(80, 100 - (Math.max(0, tierWanted - selectedTier) * 8)),
      reason: "Current terrain reads as " + terrainKey + ". " + (topRec && topRec.rationale ? topRec.rationale : "Procedural pressure is a better fit than a direct authored beat right now.") + (tierReasonBits.length ? (" Recommended tier logic: " + tierReasonBits.join(", ") + ".") : "") + fallbackNote
    }];
  }

  function _advisorBeatHistoryEntries(observation, opts) {
    opts = opts || {};
    const state = getStoryStateSafe();
    const activeCampaignId = String((opts.activeCampaignId || (observation && observation.campaign ? observation.campaign.activeCampaignId : "") || state.activeCampaignId || "")).trim();
    const raw = Array.isArray(state && state.beats ? state.beats : []) ? state.beats.slice() : [];
    const out = [];
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const meta = row.meta && typeof row.meta === "object" ? row.meta : {};
      const campaignId = String((row.campaignId || meta.campaignId || row.sourceCampaignId || "")).trim();
      if (activeCampaignId && campaignId && campaignId !== activeCampaignId) continue;
      const beatId = String((row.beatId || meta.beatId || row.id || "")).trim();
      const tags = Array.isArray(row.tags) ? row.tags.map(_gmCanonicalTag).filter(Boolean) : _safeBeatTags({ tags: row.tags || meta.tags || "" });
      out.push({
        beatId: beatId || null,
        campaignId: campaignId || null,
        ts: Number(row.ts || row.createdAt || meta.ts || 0) || 0,
        hexUuid: String((row.hexUuid || meta.hexUuid || row.targetUuid || meta.targetUuid || "")).trim() || null,
        tags: tags,
        raw: copy(row)
      });
    }
    out.sort(function (a, b) { return Number(b.ts || 0) - Number(a.ts || 0); });
    return out;
  }

  function _advisorBeatWeighting(beat, matchedTags, history, currentHexUuid) {
    const beatId = String((beat && (beat.id || beat.beatId)) || "").trim();
    const tags = _safeBeatTags(beat);
    const factors = {
      tagScore: 0,
      typeBonus: 0,
      recommendationBonus: 0,
      recencyPenalty: 0,
      sameHexPenalty: 0,
      familyPenalty: 0
    };

    for (const t of (Array.isArray(matchedTags) ? matchedTags : [])) {
      if (String(t).indexOf("inject.") === 0) factors.tagScore += 4;
      else if (String(t).indexOf("theme.") === 0) factors.tagScore += 2;
      else factors.tagScore += 1;
    }

    const recent = Array.isArray(history) ? history.slice(0, 6) : [];
    const sameBeat = recent.filter(function (h) { return beatId && String(h && h.beatId || "") === beatId; });
    if (sameBeat.length) {
      const nearestIdx = recent.findIndex(function (h) { return beatId && String(h && h.beatId || "") === beatId; });
      if (nearestIdx === 0) factors.recencyPenalty -= 8;
      else if (nearestIdx > -1 && nearestIdx <= 2) factors.recencyPenalty -= 5;
      else factors.recencyPenalty -= 2;
    }

    const currentHex = String(currentHexUuid || "").trim();
    if (currentHex) {
      const sameHexBeat = recent.find(function (h) {
        return beatId && String(h && h.beatId || "") === beatId && String(h && h.hexUuid || "") === currentHex;
      });
      if (sameHexBeat) factors.sameHexPenalty -= 6;
      else {
        const sameHexFamily = recent.find(function (h) {
          if (!h || String(h.hexUuid || "") !== currentHex) return false;
          const histTags = Array.isArray(h.tags) ? h.tags : [];
          for (const t of matchedTags || []) {
            if (histTags.indexOf(String(t)) !== -1) return true;
          }
          return false;
        });
        if (sameHexFamily) factors.sameHexPenalty -= 3;
      }
    }

    const recentFamilies = recent.map(function (h) {
      const histTags = Array.isArray(h && h.tags) ? h.tags : [];
      return histTags.find(function (t) { return String(t).indexOf("inject.") === 0; }) || "";
    }).filter(Boolean);
    const primary = Array.isArray(matchedTags) ? (matchedTags.find(function (t) { return String(t).indexOf("inject.") === 0; }) || "") : "";
    if (primary) {
      const familyHits = recentFamilies.filter(function (t) { return t === primary; }).length;
      if (familyHits >= 2) factors.familyPenalty -= 2;
      else if (familyHits >= 1) factors.familyPenalty -= 1;
    }

    const total = Object.keys(factors).reduce(function (n, k) { return n + (Number(factors[k] || 0) || 0); }, 0);
    return { total: total, factors: factors, historySampleSize: recent.length };
  }

  function resolveCampaignBeatSuggestions(observation, detectors, recommendations, opts) {
    opts = opts || {};
    const activeCampaignId = String((opts.activeCampaignId || (observation && observation.campaign ? observation.campaign.activeCampaignId : "") || "")).trim();
    const campaign = _safeActiveCampaignRecord(activeCampaignId);
    const beats = Array.isArray(campaign && campaign.beats ? campaign.beats : []) ? campaign.beats : [];
    const out = [];
    if (!campaign || !beats.length) return out;

    const difficultyBand = String(detectors && detectors.difficulty ? detectors.difficulty.band || "" : "").toLowerCase();
    const seenBeatIds = new Set();
    const history = _advisorBeatHistoryEntries(observation, opts);
    const currentHexUuid = getLatestTravelHexUuid(observation) || (observation && observation.travel && observation.travel.latest ? (observation.travel.latest.travel ? observation.travel.latest.travel.hexTo : observation.travel.latest.hexUuid) : "") || "";

    for (const rec of (Array.isArray(recommendations) ? recommendations : [])) {
      const recKey = String(rec && rec.key || "").trim();
      if (!recKey) continue;
      const desiredTags = _recommendationTagHints(recKey, difficultyBand);
      if (!desiredTags.length) continue;

      const ranked = [];
      for (const beat of beats) {
        const beatId = String((beat && (beat.id || beat.beatId)) || "").trim();
        if (!beatId || seenBeatIds.has(beatId)) continue;
        const tags = _safeBeatTags(beat);
        if (!tags.length) continue;

        const matched = [];
        for (const t of desiredTags) {
          if (tags.indexOf(t) !== -1) matched.push(t);
        }
        if (!matched.length) continue;

        const type = String(beat && beat.type || "").toLowerCase();
        const weighting = _advisorBeatWeighting(beat, matched, history, currentHexUuid);
        if (type === "encounter" || type === "cinematic" || type === "scene_transition") weighting.factors.typeBonus += 1;
        if (String(rec && rec.type || "") === "world_pressure" && matched.indexOf("inject.enforcement") !== -1) weighting.factors.recommendationBonus += 1;
        if (String(rec && rec.type || "") === "economy_pressure" && matched.indexOf("inject.debt_pressure") !== -1) weighting.factors.recommendationBonus += 1;
        if (String(recKey) === "injector.discovery_ping" && matched.indexOf("theme.discovery") !== -1) weighting.factors.recommendationBonus += 1;
        if (String(recKey) === "injector.seed_followup" && matched.indexOf("inject.travel_threshold") !== -1) weighting.factors.recommendationBonus += 1;
        weighting.total = Object.keys(weighting.factors).reduce(function (n, k) { return n + (Number(weighting.factors[k] || 0) || 0); }, 0);

        ranked.push({
          campaignId: activeCampaignId,
          beatId: beatId,
          beatLabel: beat && (beat.label || beat.title || beatId) || beatId,
          beatType: type || "beat",
          matchedTags: matched,
          score: weighting.total,
          factors: copy(weighting.factors || {}),
          historySampleSize: Number(weighting.historySampleSize || 0) || 0,
          recommendationKey: recKey,
          recommendationType: rec && rec.type ? rec.type : null,
          reason: rec && rec.rationale ? rec.rationale : ""
        });
      }
      ranked.sort(function (a, b) {
        return (Number(b.score || 0) - Number(a.score || 0)) || String(a.beatLabel || "").localeCompare(String(b.beatLabel || ""));
      });
      if (ranked.length) {
        seenBeatIds.add(ranked[0].beatId);
        out.push(ranked[0]);
      }
    }

    out.sort(function (a, b) {
      return (Number(b.score || 0) - Number(a.score || 0)) || String(a.beatLabel || "").localeCompare(String(b.beatLabel || ""));
    });
    return out.slice(0, Number(opts.maxSuggestedBeats || 5) || 5);
  }

  async function recommendWorldSignals(factionId, opts) {
    opts = opts || {};
    const sig = await getWorldSignals(factionId, opts);
    if (!sig || !sig.ok) return sig;

    const detectors = {
      stability: sig.stability,
      overextension: sig.overextension,
      narrative: sig.narrative,
      difficulty: sig.difficulty
    };

    const suggestedTables = resolveCampaignTableSuggestions(sig.observation, detectors, sig.recommendations || [], opts);
    const suggestedBeats = resolveCampaignBeatSuggestions(sig.observation, detectors, sig.recommendations || [], opts);

    const suggestedEvents = suggestedBeats.map(function (b) {
      return {
        kind: "beat",
        key: b.recommendationKey,
        label: b.beatLabel,
        beatId: b.beatId,
        campaignId: b.campaignId,
        beatType: b.beatType,
        matchedTags: copy(b.matchedTags || []),
        score: Number(b.score || 0) || 0,
        reason: (b.reason || "") + ((b.matchedTags && b.matchedTags.length) ? (" Matched tags: " + b.matchedTags.join(", ") + ".") : "")
      };
    });

    const suggestedTableEvents = suggestedTables.map(function (t) {
      return {
        kind: "table",
        key: t.recommendationKey,
        label: t.tableLabel || t.tableId,
        tableId: t.tableId,
        campaignId: t.campaignId,
        terrain: t.terrain || null,
        tier: Number(t.tier || 1) || 1,
        score: Number(t.score || 0) || 0,
        reason: t.reason || ""
      };
    });

    return {
      ok: true,
      spec: "bbttcc.gm-advisor.v1.2-narrative-escalation",
      ts: Date.now(),
      factionId: sig.factionId,
      factionName: sig.observation && sig.observation.faction ? sig.observation.faction.name || null : null,
      stability: sig.stability,
      overextension: sig.overextension,
      narrative: sig.narrative,
      difficulty: sig.difficulty,
      recommendations: copy(sig.recommendations || []),
      suggestedTables: copy(suggestedTables || []),
      suggestedBeats: copy(suggestedBeats || []),
      suggestedEvents: copy(suggestedEvents || []),
      suggestedTableEvents: copy(suggestedTableEvents || []),
      mal: {
        summary: malExplainWorldSignals(sig.observation, detectors, sig.recommendations || [])
      },
      constraints: copy(sig.observation && sig.observation.constraints ? sig.observation.constraints : {}),
      diagnostics: {
        activeCampaignId: sig.observation && sig.observation.campaign ? sig.observation.campaign.activeCampaignId || null : null,
        ownedHexCount: sig.observation && sig.observation.territory ? sig.observation.territory.ownedHexCount || 0 : 0,
        travelTraceCount: sig.observation && sig.observation.territory ? sig.observation.territory.travelTraceCount || 0 : 0,
        suggestedBeatCount: suggestedBeats.length,
        suggestedTableCount: suggestedTables.length,
        advisorBeatHistoryCount: _advisorBeatHistoryEntries(sig.observation, opts).length,
        terrainSuggestion: _inferAdvisorTerrain(sig.observation),
        desiredTableTier: suggestedTables.length ? (Number(suggestedTables[0].desiredTier || suggestedTables[0].tier || 1) || 1) : null,
        selectedTableTier: suggestedTables.length ? (Number(suggestedTables[0].tier || 1) || 1) : null
      }
    };
  }

  function attach() {
    try {
      game.bbttcc ??= { api: {} };
      game.bbttcc.api ??= {};
      game.bbttcc.api.agent ??= {};

      Object.assign(game.bbttcc.api.agent, {
        snapshot,
        registry: { maneuvers: registryManeuvers },
        audit: {
          coverage: auditCoverage,
          throughputWiring: auditThroughputWiring,
          throughputWiringByTier: auditThroughputWiringByTier,
          throughputWiringByAvailability: auditThroughputWiringByAvailability,
          throughputWiringByRaidType: auditThroughputWiringByRaidType,
          intentTypes: auditIntentTypes
        },

        getObservationSnapshot,
        listLegalStrategicActions,
        estimateTravel,
        estimateRaid,
        scoreCandidates,
        buildStrategicCandidates,
        buildTravelCandidates,
        buildRaidCandidates,
        recommendNextActions,
        simulate: { maneuver: simulateManeuver },
        validate: { maneuver: validateManeuver },
        __THROUGHPUT: THROUGHPUT
      });

      game.bbttcc.api.agent.gm = Object.assign(game.bbttcc.api.agent.gm || {}, {
        inferFactionId: inferGMFactionId,
        getWorldSignals: getWorldSignals,
        recommendWorldSignals: recommendWorldSignals,
        computeAdvisorTableTier: _computeAdvisorTableTier,
        resolveCampaignBeatSuggestions: resolveCampaignBeatSuggestions,
        resolveCampaignTableSuggestions: resolveCampaignTableSuggestions
      });

      log('Agent API published (dry-run v0.6.1-mal, advisor Mal voice layer + A4 narrative escalation).');
      log('JSON maneuver registry path:', JSON_MANEUVER_REL_PATH);
    } catch (e) {
      warn('Failed to attach Agent API', e);
    }
  }

  Hooks.once('ready', attach);
  if (game.ready) attach();

})();
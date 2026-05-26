// scripts/maneuvers-balance-content.enhancer.js
// ─────────────────────────────────────────────────────────────────────────────
// MANEUVER_BALANCE_PASS.md Wave 1 (additive) — 8 new maneuvers:
//   4 Siege Breach-Scene tactical (engine violence, raidTypes ["siege","violence"])
//   4 Universal top-up (engine universal, raidTypes ["any"])
//
// Both groups reuse the EXISTING S1 scene-intent verbs (damageSceneTokens /
// buffSceneTokens / playCanvasVfx) + the strategic roundEffects/factionEffects
// vocab — NO new substrate. Siege breach maneuvers act on the bound breach
// battle scene exactly as Artillery Salvo (S2) does; the siege turn-economy
// actions stay in the Strategic Activities planner (siege-counter-activities.js)
// and are deliberately NOT duplicated here.
//
// Single source of truth per maneuver — each self-registers into:
//   1. game.bbttcc.api.raid.EFFECTS         — picker visibility + cost lookup
//   2. game.bbttcc.api.agent.__THROUGHPUT   — preview intent emitter
//   3. EFFECTS[key].fireMode                — Phase 4D categorization
//
// Seed macro: bbttcc-master-content/tools/seed-balance-maneuvers.macro.js reads
// game.bbttcc.api.raid.balanceManeuvers and creates the doctrine pack docs.
//
// Tier↔cost-band kept coherent (T1→light, T2/T3→medium, T4→heavy) per the
// parent spec's locked bands. Per [[feedback_bbttcc_api_exposure_pattern]]
// registration is two-pass (script-load + Hooks.once("ready")).
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  const TAG = "[bbttcc-raid:balance-content]";

  function isSuccessTier(tierOrResult) {
    const s = String(tierOrResult ?? "").toLowerCase();
    return (s === "success" || s === "greatsuccess" || s === "great_success" || s === "win" || s === "won");
  }

  const BALANCE_MANEUVERS = [

    // ══ SIEGE BREACH-SCENE TACTICAL (4) ═════════════════════════════════════
    // engine violence so they ride the existing Violence picker + breach budget;
    // raidTypes ["siege","violence"] surfaces them in both contexts.

    // ── Sap the Walls — T1 tactical-out anytime light (attacker) ─────────────
    {
      key: "sap_the_walls",
      label: "Sap the Walls",
      tier: 1,
      engine: "violence",
      raidTypes: ["siege", "violence"],
      layer: "tactical-out",
      fireMode: "anytime",
      costBand: "light",
      cost: { violence: 2 }, // 20 marks
      effectsText: "Sappers work the base of the wall: all enemy structure/tokens on the breach scene take 4 damage.",
      description: "<p>Picks and powder at the foundation while the line keeps their heads down. <b>All enemy tokens on the bound breach scene take 4 damage</b> (~1d6 avg). Needs a battle scene to land; narrative-only otherwise.</p>",
      throughput: function (ctx) {
        return {
          roundEffects: [{
            type: "damageSceneTokens", scope: "enemies", factionId: ctx.attackerFactionId || null,
            damage: 4, damageType: "kinetic",
            note: "Sap the Walls: 4 dmg to enemy breach tokens."
          }],
          meta: { source: "throughput", maneuverKey: "sap_the_walls", preview: true }
        };
      }
    },

    // ── Shore the Gate — T1 tactical-down anytime light (defender) ───────────
    {
      key: "shore_the_gate",
      label: "Shore the Gate",
      tier: 1,
      engine: "violence",
      raidTypes: ["siege", "violence"],
      layer: "tactical-down",
      fireMode: "anytime",
      costBand: "light",
      cost: { logistics: 2 }, // 20 marks
      effectsText: "Defenders brace the gate: friendly tokens gain 'Braced' for 1 round.",
      description: "<p>Beams, rubble, and stubbornness jammed against the failing gate. If a breach scene is bound, <b>all friendly tokens gain Braced</b> (hold the line, +1 defense) for one round.</p>",
      throughput: function (ctx) {
        return {
          roundEffects: [{
            type: "buffSceneTokens", scope: "allies", factionId: ctx.defenderFactionId || null,
            ae: {
              name: "Braced",
              icon: "icons/svg/shield.svg",
              changes: [],
              duration: { rounds: 1 },
              description: "Shore the Gate: dug in, +1 defense (narrative), 1 round."
            },
            durationRounds: 1,
            note: "Shore the Gate: defender breach buff."
          }],
          meta: { source: "throughput", maneuverKey: "shore_the_gate", preview: true }
        };
      }
    },

    // ── Sortie en Masse — T3 cross-layer anytime medium (defender) ───────────
    {
      key: "sortie_en_masse",
      label: "Sortie en Masse",
      tier: 3,
      engine: "violence",
      raidTypes: ["siege", "violence"],
      layer: "cross-layer",
      fireMode: "anytime",
      costBand: "medium",
      cost: { violence: 3, softpower: 1 }, // 40 marks
      effectsText: "The garrison pours out: friendly tokens gain 'Sally' (+1 attack) 1 round; enemy tokens take 4 damage from the charge.",
      description: "<p>The gates swing wide and the defenders come out screaming. <b>Friendly tokens gain Sally (+1 attack)</b> for one round and <b>all enemy tokens take 4 damage</b> from the sudden charge.</p>",
      throughput: function (ctx) {
        return {
          roundEffects: [
            { type: "buffSceneTokens", scope: "allies", factionId: ctx.defenderFactionId || null,
              ae: {
                name: "Sally",
                icon: "icons/svg/sword.svg",
                changes: [],
                duration: { rounds: 1 },
                description: "Sortie en Masse: all-out charge, +1 attack (narrative), 1 round."
              },
              durationRounds: 1,
              note: "Sortie en Masse: defender charge buff." },
            { type: "damageSceneTokens", scope: "enemies", factionId: ctx.defenderFactionId || null,
              damage: 4, damageType: "kinetic",
              note: "Sortie en Masse: 4 dmg to besieger tokens." }
          ],
          meta: { source: "throughput", maneuverKey: "sortie_en_masse", preview: true }
        };
      }
    },

    // ── Crack the Keep — T4 cross-layer post-commit heavy (attacker) ─────────
    {
      key: "crack_the_keep",
      label: "Crack the Keep",
      tier: 4,
      engine: "violence",
      raidTypes: ["siege", "violence"],
      layer: "cross-layer",
      fireMode: "post-commit",
      costBand: "heavy",
      cost: { violence: 5, logistics: 2 }, // 70 marks
      effectsText: "On a breached round: all enemy tokens take 11 damage; the wall comes down in dust and fire (breach VFX).",
      description: "<p>Everything the faction has, thrown at one point in the wall. On a successful round the keep finally gives. <b>All enemy tokens take 11 damage</b> (~3d6 avg) and the battle scene erupts with a breach burst.</p>",
      throughput: function (ctx) {
        if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;
        return {
          roundEffects: [
            { type: "damageSceneTokens", scope: "enemies", factionId: ctx.attackerFactionId || null,
              damage: 11, damageType: "kinetic",
              note: "Crack the Keep: 11 dmg to enemy breach tokens." },
            { type: "playCanvasVfx", kind: "impact", color: 0xc24a1f,
              note: "Crack the Keep: breach burst VFX." }
          ],
          factionEffects: [{
            factionId: ctx.attackerFactionId || null, moraleDelta: 1, when: "afterRound",
            note: "Crack the Keep: +1 morale on the breach."
          }],
          meta: { source: "throughput", maneuverKey: "crack_the_keep", preview: true }
        };
      }
    },

    // ══ UNIVERSAL TOP-UP (4) ════════════════════════════════════════════════

    // ── War Chest — T1 strategic pre-roll light (economy outlet) ─────────────
    {
      key: "war_chest",
      label: "War Chest",
      tier: 1,
      engine: "universal",
      raidTypes: ["any"],
      layer: "strategic",
      fireMode: "pre-roll",
      costBand: "light",
      cost: { economy: 2 }, // 20 marks
      effectsText: "Bankroll the push: +1 to the attacker's roll this round.",
      description: "<p>Coin talks. Fresh pay, fresh gear, fresh nerve bought at the last moment. <b>+1 to the attacker's roll this round.</b></p>",
      throughput: function (ctx) {
        return {
          roundEffects: [{
            type: "rollBonus", scope: "attacker", appliesTo: ["attack"], amount: 1, window: "thisRound",
            note: "War Chest: +1 attacker roll."
          }],
          meta: { source: "throughput", maneuverKey: "war_chest", preview: true }
        };
      }
    },

    // ── Field Chaplaincy — T2 strategic anytime medium (faith) ───────────────
    {
      key: "field_chaplaincy",
      label: "Field Chaplaincy",
      tier: 2,
      engine: "universal",
      raidTypes: ["any"],
      layer: "cross-layer",
      fireMode: "anytime",
      costBand: "medium",
      cost: { faith: 2, softpower: 1 }, // 30 marks
      effectsText: "Chaplains walk the line: darkness −1; friendly tokens gain 'Blessed' for 2 rounds.",
      description: "<p>A steady voice between the volleys, hands on shoulders, names remembered. <b>Darkness −1.</b> If a battle scene is bound, all friendly tokens gain <i>Blessed</i> for 2 rounds.</p>",
      throughput: function (ctx) {
        return {
          factionEffects: [{
            factionId: ctx.attackerFactionId || null, darknessDelta: -1, when: "thisRound",
            note: "Field Chaplaincy: −1 darkness."
          }],
          roundEffects: [{
            type: "buffSceneTokens", scope: "allies", factionId: ctx.attackerFactionId || null,
            ae: {
              name: "Blessed",
              icon: "icons/svg/angel.svg",
              changes: [],
              duration: { rounds: 2 },
              description: "Field Chaplaincy: steadied nerves, +1 vs fear (narrative), 2 rounds."
            },
            durationRounds: 2,
            note: "Field Chaplaincy: friendly blessing."
          }],
          meta: { source: "throughput", maneuverKey: "field_chaplaincy", preview: true }
        };
      }
    },

    // ── Cultural Offensive — T2 strategic post-commit medium (culture) ───────
    {
      key: "cultural_offensive",
      label: "Cultural Offensive",
      tier: 2,
      engine: "universal",
      raidTypes: ["any"],
      layer: "strategic",
      fireMode: "post-commit",
      costBand: "medium",
      cost: { culture: 3, softpower: 1 }, // 40 marks
      effectsText: "On success: win hearts as well as ground — faction morale +2.",
      description: "<p>Songs, stories, and the right gift at the right time turn a victory into a legend people repeat. On a successful round, <b>faction morale +2.</b></p>",
      throughput: function (ctx) {
        if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;
        return {
          factionEffects: [{
            factionId: ctx.attackerFactionId || null, moraleDelta: 2, when: "afterRound",
            note: "Cultural Offensive: +2 morale on success."
          }],
          meta: { source: "throughput", maneuverKey: "cultural_offensive", preview: true }
        };
      }
    },

    // ── Total Mobilization — T3 cross-layer pre-roll medium (logistics+econ) ──
    {
      key: "total_mobilization",
      label: "Total Mobilization",
      tier: 3,
      engine: "universal",
      raidTypes: ["any"],
      layer: "cross-layer",
      fireMode: "pre-roll",
      costBand: "medium",
      cost: { logistics: 3, economy: 2 }, // 50 marks
      effectsText: "Everyone in: +1 to all friendly rolls this round; friendly tokens gain +5 ft movement for 1 round.",
      description: "<p>The whole faction leans into it at once — every hand, every cart, every reserve. <b>+1 to all friendly rolls this round.</b> If a battle scene is bound, friendly tokens surge with +5 ft movement for one round.</p>",
      throughput: function (ctx) {
        return {
          roundEffects: [
            { type: "rollBonus", scope: "allies", appliesTo: ["attack", "defense", "save"], amount: 1, window: "thisRound",
              note: "Total Mobilization: +1 to friendly rolls." },
            { type: "buffSceneTokens", scope: "allies", factionId: ctx.attackerFactionId || null,
              ae: {
                name: "Mobilized",
                icon: "icons/svg/upgrade.svg",
                changes: [{ key: "system.attributes.movement.bonus", mode: 2, value: 5 }],
                duration: { rounds: 1 },
                description: "Total Mobilization: full surge, +5 ft movement, 1 round."
              },
              durationRounds: 1,
              note: "Total Mobilization: scene movement buff." }
          ],
          meta: { source: "throughput", maneuverKey: "total_mobilization", preview: true }
        };
      }
    }
  ];

  // ── Registration (mirrors maneuvers-sprint2-content.enhancer.js) ────────────
  function _register() {
    const raid = game.bbttcc?.api?.raid;
    const agent = game.bbttcc?.api?.agent;
    if (!raid?.EFFECTS) return false;

    const EFFECTS = raid.EFFECTS;
    const THROUGHPUT = agent?.__THROUGHPUT || null;

    let added = 0;
    for (const m of BALANCE_MANEUVERS) {
      EFFECTS[m.key] = {
        kind: "maneuver",
        key: m.key,
        label: m.label,
        tier: m.tier,
        raidTypes: m.raidTypes.slice(),
        cost: foundry.utils.deepClone(m.cost),
        fireMode: m.fireMode,
        text: m.effectsText,
        description: m.description,
        meta: {
          tier: m.tier,
          engine: m.engine,
          layer: m.layer,
          costBand: m.costBand,
          authoredSprint: "balance-w1",
          availability: "standard"
        }
      };
      if (THROUGHPUT && typeof m.throughput === "function") {
        THROUGHPUT[m.key] = m.throughput;
      }
      added++;
    }

    raid.balanceManeuvers = BALANCE_MANEUVERS;
    console.log(TAG, `registered ${added} balance-wave-1 maneuvers; tiers:`,
      BALANCE_MANEUVERS.reduce((a, m) => (a[`T${m.tier}`] = (a[`T${m.tier}`] || 0) + 1, a), {})
    );
    return true;
  }

  if (!_register()) {
    Hooks.once("ready", () => Promise.resolve().then(_register));
  } else {
    Hooks.once("ready", () => Promise.resolve().then(_register));
  }
})();

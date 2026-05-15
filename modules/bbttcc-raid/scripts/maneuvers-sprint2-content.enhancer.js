// scripts/maneuvers-sprint2-content.enhancer.js
// ─────────────────────────────────────────────────────────────────────────────
// Sprint 2 content for MANEUVER_CATALOG_SPEC.md §5: 10 new maneuvers
// (5 Universal pool + 4 Violence + 1 Presence) authored against the S1 substrate.
// 2026-05-15: extended to 10 entries — added Coordinated Advance + Infernal
// Bargain to rescue the two legacy `opt_*` orphan pack docs that had no
// runtime EFFECTS / THROUGHPUT.
//
// Single source of truth per maneuver. At load time, each entry self-registers
// into THREE runtime surfaces:
//   1. game.bbttcc.api.raid.EFFECTS              — picker visibility + cost lookup
//   2. game.bbttcc.api.agent.__THROUGHPUT        — preview intent emitter
//   3. EFFECTS[key].fireMode                     — Phase 4D categorization
//
// The seed macro in `bbttcc-master-content/tools/seed-sprint2-maneuvers.macro.js`
// reads `game.bbttcc.api.raid.sprint2Maneuvers` and creates the doc entries in
// the doctrines pack so they appear in the compendium for players.
//
// Coverage of the §3 grid:
//   Universal: 2 strategic (U1,U2) + 3 cross-layer (U3,U4,U5)
//   Violence:  1 tactical-down (V2) + 2 tactical-out (V1,V4) + 1 cross-layer (V3)
//   Presence:  1 strategic (P1)
//
// Fire-mode mix: 2 pre-roll · 6 anytime · 2 post-commit
// Cost-band mix: 6 light · 4 medium
// Tier mix: 6 T1 · 2 T2 · 2 T3
//
// Per [[feedback_bbttcc_api_exposure_pattern]] all registration is installed
// twice: at script-load (after compat-bridge publishes EFFECTS) AND on
// Hooks.once("ready") to survive cache + load-order races.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  const TAG = "[bbttcc-raid:s2-content]";

  // ── Shared helpers ─────────────────────────────────────────────────────────
  function isSuccessTier(tierOrResult) {
    const s = String(tierOrResult ?? "").toLowerCase();
    return (s === "success" || s === "greatsuccess" || s === "great_success" || s === "win" || s === "won");
  }

  // ── Catalog ────────────────────────────────────────────────────────────────
  const SPRINT2_MANEUVERS = [

    // ── U1 · Logistics Surge — T1 strategic anytime light universal ──────────
    {
      key: "logistics_surge_s2",
      label: "Logistics Surge",
      tier: 1,
      engine: "universal",
      raidTypes: ["any"],
      layer: "strategic",
      fireMode: "anytime",
      costBand: "light",
      cost: { logistics: 1, economy: 1 }, // 20 marks total
      effectsText: "Sudden logistics push: +1 to all friendly rolls this round.",
      description: "<p>The faction's quartermaster reroutes supply lines on the fly, giving every commander on the field a momentary edge. <b>All friendly rolls this round +1.</b></p>",
      throughput: function (ctx) {
        return {
          roundEffects: [{
            type: "rollBonus",
            scope: "allies",
            appliesTo: ["attack", "defense", "save"],
            amount: 1,
            window: "thisRound",
            note: "Logistics Surge: +1 to friendly rolls this round."
          }],
          meta: { source: "throughput", maneuverKey: "logistics_surge_s2", preview: true }
        };
      }
    },

    // ── U2 · Diplomatic Channel — T2 strategic anytime medium universal ──────
    {
      key: "diplomatic_channel",
      label: "Diplomatic Channel",
      tier: 2,
      engine: "universal",
      raidTypes: ["any"],
      layer: "strategic",
      fireMode: "anytime",
      costBand: "medium",
      cost: { diplomacy: 4 }, // 40 marks
      effectsText: "Open a back-channel: defender may opt-in to a negotiated outcome (GM adjudicates).",
      description: "<p>An envoy slips through the lines with a sealed offer. The defender may, at their option, pause hostilities for one round of negotiation.</p><p><b>GM adjudicates terms;</b> a successful negotiation can end the raid without further bloodshed. Refusal forfeits no resources but signals contempt.</p>",
      throughput: function (ctx) {
        return {
          factionEffects: [{
            factionId: ctx.defenderFactionId || null,
            when: "thisRound",
            note: "Diplomatic Channel (preview): defender prompted to negotiate. GM adjudicates."
          }],
          meta: { source: "throughput", maneuverKey: "diplomatic_channel", preview: true }
        };
      }
    },

    // ── U3 · Faction-wide Rally — T1 cross-layer pre-roll light universal ────
    {
      key: "faction_wide_rally",
      label: "Faction-wide Rally",
      tier: 1,
      engine: "universal",
      raidTypes: ["any"],
      layer: "cross-layer",
      fireMode: "pre-roll",
      costBand: "light",
      cost: { softpower: 2 }, // 20 marks
      effectsText: "Inspire the line: +1 attacker roll this round; friendly tokens on the battle scene gain 'Rallied' for 1 round.",
      description: "<p>A wave of inspiration ripples through the faction. <b>+1 to the attacker's roll this round.</b> If a battle scene is bound, every friendly token gains the <i>Rallied</i> status for one round.</p>",
      throughput: function (ctx) {
        return {
          roundEffects: [
            { type: "rollBonus", scope: "attacker", appliesTo: ["attack"], amount: 1, window: "thisRound",
              note: "Faction-wide Rally: +1 attacker roll." },
            { type: "buffSceneTokens", scope: "allies", factionId: ctx.attackerFactionId || null,
              ae: {
                name: "Rallied",
                icon: "icons/svg/upgrade.svg",
                changes: [{ key: "system.attributes.movement.bonus", mode: 2, value: 5 }],
                duration: { rounds: 1 },
                description: "Faction-wide Rally: morale flush, +5 ft movement, 1 round."
              },
              durationRounds: 1,
              note: "Faction-wide Rally: scene buff." }
          ],
          meta: { source: "throughput", maneuverKey: "faction_wide_rally", preview: true }
        };
      }
    },

    // ── U4 · Prayer Pulse — T3 cross-layer post-commit medium universal ──────
    {
      key: "prayer_pulse",
      label: "Prayer Pulse",
      tier: 3,
      engine: "universal",
      raidTypes: ["any"],
      layer: "cross-layer",
      fireMode: "post-commit",
      costBand: "medium",
      cost: { faith: 4, softpower: 2 }, // 40 marks (faith=10/mark + softpower=10/mark)
      effectsText: "On success: faction morale +2, darkness −1. Scene-bound: 'Prayer's Grace' on allies + gold pulse VFX.",
      description: "<p>The faction's faithful raise their voices as one. On a successful round, the rebuke of the dark resonates outward.</p><p><b>Faction morale +2, darkness −1.</b> If a battle scene is bound, all friendly tokens gain <i>Prayer's Grace</i> for 3 rounds and the canvas pulses gold.</p>",
      throughput: function (ctx) {
        if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;
        return {
          factionEffects: [{
            factionId: ctx.attackerFactionId || null,
            moraleDelta: 2,
            darknessDelta: -1,
            when: "afterRound",
            note: "Prayer Pulse: +2 Morale, −1 Darkness on success."
          }],
          roundEffects: [
            { type: "buffSceneTokens", scope: "allies", factionId: ctx.attackerFactionId || null,
              ae: {
                name: "Prayer's Grace",
                icon: "icons/svg/holy-shield.svg",
                changes: [],
                duration: { rounds: 3 },
                description: "Prayer Pulse: divine attention, +1 save (narrative)."
              },
              durationRounds: 3,
              note: "Prayer Pulse: friendly token blessing." },
            { type: "playCanvasVfx", kind: "blessing", color: 0xffd900,
              note: "Prayer Pulse: gold pulse across the battle scene." }
          ],
          meta: { source: "throughput", maneuverKey: "prayer_pulse", preview: true }
        };
      }
    },

    // ── V1 · Suppressive Volley — T1 tactical-out anytime light violence ─────
    {
      key: "suppressive_volley",
      label: "Suppressive Volley",
      tier: 1,
      engine: "violence",
      raidTypes: ["violence"],
      layer: "tactical-out",
      fireMode: "anytime",
      costBand: "light",
      cost: { violence: 2 }, // 20 marks
      effectsText: "Hose the line: all enemy tokens on the battle scene take 4 damage (1d6 avg).",
      description: "<p>The faction's gunners pour fire into the enemy line. <b>All enemy tokens on the bound battle scene take 4 damage</b> (~1d6 avg). Strategic-map only? Narrative-only; needs a battle scene to land.</p>",
      throughput: function (ctx) {
        return {
          roundEffects: [{
            type: "damageSceneTokens",
            scope: "enemies",
            factionId: ctx.attackerFactionId || null,
            damage: 4,
            damageType: "kinetic",
            note: "Suppressive Volley: scene-wide 4 dmg to enemy tokens."
          }],
          meta: { source: "throughput", maneuverKey: "suppressive_volley", preview: true }
        };
      }
    },

    // ── V2 · Forward Resupply — T1 tactical-down anytime light violence ──────
    {
      key: "forward_resupply",
      label: "Forward Resupply",
      tier: 1,
      engine: "violence",
      raidTypes: ["violence"],
      layer: "tactical-down",
      fireMode: "anytime",
      costBand: "light",
      cost: { logistics: 2 }, // 20 marks — cross-pool spend (universal fuel funds violence engine)
      effectsText: "Cache drop: all friendly tokens on the battle scene gain 'Resupplied' (+1 attack) for 1 round.",
      description: "<p>A vanguard team breaks contact long enough to redistribute spare magazines, batteries, and stim packs. <b>All friendly tokens gain Resupplied (+1 attack)</b> for one round.</p>",
      throughput: function (ctx) {
        return {
          roundEffects: [{
            type: "buffSceneTokens",
            scope: "allies",
            factionId: ctx.attackerFactionId || null,
            ae: {
              name: "Resupplied",
              icon: "icons/svg/regen.svg",
              changes: [],
              duration: { rounds: 1 },
              description: "Forward Resupply: fresh ammo, +1 attack next round (narrative)."
            },
            durationRounds: 1,
            note: "Forward Resupply: friendly token buff."
          }],
          meta: { source: "throughput", maneuverKey: "forward_resupply", preview: true }
        };
      }
    },

    // ── V3 · Coordinated Strike — T2 cross-layer post-commit medium violence ─
    {
      key: "coordinated_strike",
      label: "Coordinated Strike",
      tier: 2,
      engine: "violence",
      raidTypes: ["violence"],
      layer: "cross-layer",
      fireMode: "post-commit",
      costBand: "medium",
      cost: { violence: 3, softpower: 1 }, // 40 marks
      effectsText: "On success: enemy tokens take 7 damage, allied tokens gain 'Press the Advantage', faction morale +1.",
      description: "<p>The faction's officers synchronize an attack with parade precision. On a successful round, the enemy line buckles.</p><p><b>All enemy tokens take 7 damage</b> (~2d6 avg), <b>allied tokens gain Press the Advantage</b> for 1 round, and faction morale ticks +1.</p>",
      throughput: function (ctx) {
        if (!isSuccessTier(ctx?.outcomeTier || ctx?.result)) return null;
        return {
          roundEffects: [
            { type: "damageSceneTokens", scope: "enemies", factionId: ctx.attackerFactionId || null,
              damage: 7, damageType: "kinetic",
              note: "Coordinated Strike: scene-wide 7 dmg." },
            { type: "buffSceneTokens", scope: "allies", factionId: ctx.attackerFactionId || null,
              ae: {
                name: "Press the Advantage",
                icon: "icons/svg/sword.svg",
                changes: [],
                duration: { rounds: 1 },
                description: "Coordinated Strike: +1 to next attack, 1 round."
              },
              durationRounds: 1,
              note: "Coordinated Strike: friendly buff." }
          ],
          factionEffects: [{
            factionId: ctx.attackerFactionId || null,
            moraleDelta: 1,
            when: "afterRound",
            note: "Coordinated Strike: +1 morale on success."
          }],
          meta: { source: "throughput", maneuverKey: "coordinated_strike", preview: true }
        };
      }
    },

    // ── U5 · Coordinated Advance — T1 cross-layer pre-roll light universal ──
    // (S2.5: rescues legacy `opt_coordinated_advance` orphan pack doc.)
    {
      key: "opt_coordinated_advance",
      label: "Coordinated Advance",
      tier: 1,
      engine: "universal",
      raidTypes: ["any"],
      layer: "cross-layer",
      fireMode: "pre-roll",
      costBand: "light",
      cost: { logistics: 2 }, // 20 marks
      effectsText: "Sync the advance: +1 attacker roll; friendly tokens on the scene gain 'Coordinated' (+1 attack) for 1 round.",
      description: "<p>Junior officers signal across the line and the advance moves as one body. <b>+1 to the attacker's roll this round.</b> If a battle scene is bound, every friendly token gains <i>Coordinated</i> (+1 attack) for one round.</p>",
      throughput: function (ctx) {
        return {
          roundEffects: [
            { type: "rollBonus", scope: "attacker", appliesTo: ["attack"], amount: 1, window: "thisRound",
              note: "Coordinated Advance: +1 attacker roll." },
            { type: "buffSceneTokens", scope: "allies", factionId: ctx.attackerFactionId || null,
              ae: {
                name: "Coordinated",
                icon: "icons/svg/sword.svg",
                changes: [],
                duration: { rounds: 1 },
                description: "Coordinated Advance: synced movement, +1 attack (narrative), 1 round."
              },
              durationRounds: 1,
              note: "Coordinated Advance: scene buff." }
          ],
          meta: { source: "throughput", maneuverKey: "opt_coordinated_advance", preview: true }
        };
      }
    },

    // ── P1 · Infernal Bargain — T1 strategic anytime light presence ─────────
    // (S2.5: rescues legacy `opt_infernal_bargain` orphan pack doc.)
    // Defender-facing tool: offer a darkness-tinted favor exchange.
    {
      key: "opt_infernal_bargain",
      label: "Infernal Bargain",
      tier: 1,
      engine: "presence",
      raidTypes: ["presence"],
      layer: "strategic",
      fireMode: "anytime",
      costBand: "light",
      cost: { diplomacy: 1, faith: 1 }, // 20 marks
      effectsText: "Offer the defender a sealed bargain: accept (+2 to defender's next roll, attacker gains 1 darkness) or refuse (defender morale −1 from the snubbed offer).",
      description: "<p>The attacker's emissary presents a sealed offer with an unmistakable cost.</p><p><b>Defender chooses one (GM adjudicates):</b><ul><li><b>Accept</b> — defender gains +2 to their next exchange roll; attacker's faction gains 1 darkness.</li><li><b>Refuse</b> — defender's morale drops by 1 (the snub is read as weakness in the back-channels).</li></ul></p>",
      throughput: function (ctx) {
        return {
          factionEffects: [{
            factionId: ctx.defenderFactionId || null,
            when: "thisRound",
            note: "Infernal Bargain (preview): defender presented with bargain — GM adjudicates accept/refuse. On accept: defender +2 next roll, attacker darkness +1. On refuse: defender morale −1."
          }],
          meta: { source: "throughput", maneuverKey: "opt_infernal_bargain", preview: true }
        };
      }
    },

    // ── V4 · Artillery Salvo — T3 tactical-out anytime medium violence ───────
    {
      key: "artillery_salvo",
      label: "Artillery Salvo",
      tier: 3,
      engine: "violence",
      raidTypes: ["violence"],
      layer: "tactical-out",
      fireMode: "anytime",
      costBand: "medium",
      cost: { violence: 3, logistics: 2 }, // 50 marks (top of medium band)
      effectsText: "Devastating barrage: 11 damage (3d6 avg) to all enemy tokens; orange impact VFX across the scene.",
      description: "<p>Long-range tube artillery walks rounds across the enemy position. <b>All enemy tokens take 11 damage</b> (~3d6 avg). The battle scene flashes with impact bursts.</p>",
      throughput: function (ctx) {
        return {
          roundEffects: [
            { type: "damageSceneTokens", scope: "enemies", factionId: ctx.attackerFactionId || null,
              damage: 11, damageType: "kinetic",
              note: "Artillery Salvo: scene-wide 11 dmg to enemy tokens." },
            { type: "playCanvasVfx", kind: "impact", color: 0xff5500,
              note: "Artillery Salvo: orange impact VFX." }
          ],
          meta: { source: "throughput", maneuverKey: "artillery_salvo", preview: true }
        };
      }
    }
  ];

  // ── Registration ───────────────────────────────────────────────────────────
  function _register() {
    const raid = game.bbttcc?.api?.raid;
    const agent = game.bbttcc?.api?.agent;
    if (!raid?.EFFECTS) return false;

    const EFFECTS = raid.EFFECTS;
    const THROUGHPUT = agent?.__THROUGHPUT || null;

    let added = 0;
    for (const m of SPRINT2_MANEUVERS) {
      // EFFECTS entry: picker uses .raidTypes / .cost / .label; fireMode tag here.
      EFFECTS[m.key] = {
        kind: "maneuver",
        key: m.key,
        label: m.label,
        tier: m.tier,
        raidTypes: m.raidTypes.slice(),
        cost: foundry.utils.deepClone(m.cost),
        fireMode: m.fireMode,
        text: m.effectsText,
        meta: {
          tier: m.tier,
          engine: m.engine,
          layer: m.layer,
          costBand: m.costBand,
          authoredSprint: 2,
          availability: "standard"
        }
      };

      if (THROUGHPUT && typeof m.throughput === "function") {
        THROUGHPUT[m.key] = m.throughput;
      }
      added++;
    }

    // Expose the catalog for the seed macro + UI inspection.
    raid.sprint2Maneuvers = SPRINT2_MANEUVERS;

    console.log(TAG, `registered ${added} maneuvers; tiers:`,
      SPRINT2_MANEUVERS.reduce((a, m) => (a[`T${m.tier}`] = (a[`T${m.tier}`] || 0) + 1, a), {})
    );
    return true;
  }

  // Two-pass install — script-load AND Hooks.once("ready").
  if (!_register()) {
    Hooks.once("ready", () => Promise.resolve().then(_register));
  } else {
    // Re-register at ready to defend against compat-bridge clobber on its own ready hook.
    Hooks.once("ready", () => Promise.resolve().then(_register));
  }
})();

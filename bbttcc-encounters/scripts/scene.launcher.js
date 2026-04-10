// bbttcc-encounters/scripts/scene.launcher.js

(() => {
  const TAG = "[bbttcc-encounters/launcher]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  const clone = (o)=> (o && typeof o === "object") ? foundry.utils.deepClone(o) : o;

  async function activateScene(scene) {
    if (!scene) return;
    try { await scene.activate(); } catch (e) { warn("Failed to activate scene", scene, e); }
  }

  async function waitForGM(label) {
    if (!game.user?.isGM) return;
    return Dialog.prompt({
      title: "Encounter Sequence",
      content: `<p>${label}</p>`,
      label: "Continue",
      callback: () => true,
      rejectClose: false
    });
  }


async function showTextStep(step, ctx) {
  // GM-facing narrative briefing; players proceed without a modal.
  if (!game.user?.isGM) return;
  const title = step?.title || "Encounter";
  const html  = String(step?.html || "").trim();
  if (!html) return;

  return Dialog.prompt({
    title,
    content: `<div class="bbttcc-encounter-text-step">${html}</div>`,
    label: "Continue",
    callback: () => true,
    rejectClose: false
  });
}

  function getSpawner() {
    return game.bbttcc?.api?.encounters?._spawner || null;
  }

  function getOutcomeAPI() {
    const api = game.bbttcc?.api?.encounters || {};
    return {
      getSetForScenario: api.getOutcomeSetForScenario || (()=>null)
    };
  }

  // ---------------------------------------------------------------------------
  // World mutation for scenarios
  // ---------------------------------------------------------------------------

  async function applyWorldEffectsForOutcome(scenario, choice, ctx) {
    if (!scenario || !choice) return;
    if (ctx?.source === "manual-testFire") return;

    const actor = ctx?.actor;
    if (!actor) {
      log("No faction actor in ctx; world effects skipped.");
      return;
    }

    let hexDoc = ctx?.to?.obj ?? ctx?.to?.document ?? ctx?.to ?? null;
    if (!hexDoc) {
      log("No hex context in ctx.to; world effects skipped.");
      return;
    }

    const scenarioKey = scenario.key;
    const outcomeKey  = choice.key;

    const hexFlagsOrig = clone(hexDoc.flags?.["bbttcc-territory"] ?? {});
    const fFlagsOrig   = clone(actor.flags?.["bbttcc-factions"] ?? {});

    const hexFlags = clone(hexFlagsOrig);
    const fFlags   = clone(fFlagsOrig);

    const mods      = clone(hexFlags.mods || {});
    const modifiers = Array.isArray(hexFlags.modifiers) ? hexFlags.modifiers.slice() : [];
    const requests  = clone(hexFlags.requests || {});
    const resources = clone(hexFlags.resources || {});

    const opBank    = clone(fFlags.opBank || {});
    const tracks    = clone(fFlags.tracks || {});

    const hasMod    = (m) => modifiers.includes(m);
    const addMod    = (m) => { if (!modifiers.includes(m)) modifiers.push(m); };
    const removeMod = (m) => {
      const idx = modifiers.indexOf(m);
      if (idx >= 0) modifiers.splice(idx, 1);
    };

    const ensureOp  = (k) => { if (opBank[k] == null) opBank[k] = 0; };
    ["violence","economy","softpower","diplomacy","logistics"].forEach(ensureOp);

    const n = (x)=>Number(x||0);

    let touchedHex    = false;
    let touchedOp     = false;
    let touchedTracks = false;

    // --- Rockslide (P0) -----------------------------------------------------
    if (scenarioKey === "travel_rockslide_t3") {
      switch (outcomeKey) {
        case "pass_blocked_total": {
          if (!hasMod("Blocked Pass"))      addMod("Blocked Pass");
          if (!hasMod("Difficult Terrain")) addMod("Difficult Terrain");
          opBank.logistics = Math.max(0, n(opBank.logistics) - 2);
          touchedHex = touchedOp = true;
          break;
        }
        case "pass_blocked_clearable": {
          if (!hasMod("Difficult Terrain")) addMod("Difficult Terrain");
          requests.clearRockslide = true;
          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          touchedHex = touchedOp = true;
          break;
        }
        case "narrow_passage_remains": {
          if (!hasMod("Difficult Terrain")) addMod("Difficult Terrain");
          touchedHex = true;
          break;
        }
        case "catastrophic_collapse": {
          if (!hasMod("Difficult Terrain")) addMod("Difficult Terrain");
          if (!hasMod("Ruins"))             addMod("Ruins");
          hexFlags.type = "wasteland";
          resources.knowledge = Math.max(0, n(resources.knowledge) + 1);
          opBank.logistics    = Math.max(0, n(opBank.logistics) - 1);
          hexFlags.resources  = resources;
          touchedHex = touchedOp = true;
          break;
        }
        default: break;
      }
    }

    // --- Bandit Ambush (P0) -------------------------------------------------
    else if (scenarioKey === "travel_bandit_ambush_t2") {
      switch (outcomeKey) {
        case "bandits_routed": {
          if (!hasMod("Patrolled")) addMod("Patrolled");
          removeMod("Supply Line Vulnerable");
          removeMod("Hostile Population");

          opBank.violence  = Math.max(0, n(opBank.violence)  - 1);
          opBank.economy   = Math.max(0, n(opBank.economy)   + 1);
          opBank.softpower = Math.max(0, n(opBank.softpower) + 1);
          touchedHex = touchedOp = true;
          break;
        }
        case "costly_victory": {
          if (!hasMod("Patrolled")) addMod("Patrolled");
          opBank.violence  = Math.max(0, n(opBank.violence)  - 2);
          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          touchedHex = touchedOp = true;
          break;
        }
        case "forced_retreat": {
          if (!hasMod("Hostile Population"))     addMod("Hostile Population");
          if (!hasMod("Supply Line Vulnerable")) addMod("Supply Line Vulnerable");
          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          opBank.economy   = Math.max(0, n(opBank.economy)   - 1);
          touchedHex = touchedOp = true;
          break;
        }
        case "negotiated_passage": {
          if (!hasMod("Trade Hub")) addMod("Trade Hub");
          opBank.economy   = Math.max(0, n(opBank.economy)   - 1);
          opBank.diplomacy = Math.max(0, n(opBank.diplomacy) + 1);
          opBank.softpower = Math.max(0, n(opBank.softpower) + 1);
          touchedHex = touchedOp = true;
          break;
        }
        default: break;
      }
    }

    // --- Hidden Ruins (P0) --------------------------------------------------
    else if (scenarioKey === "travel_hidden_ruins_t2") {
      switch (outcomeKey) {
        case "shallow_survey": {
          break;
        }
        case "deep_alliance": {
          break;
        }
        case "disturbed_things": {
          const radNow = n(mods.radiation);
          mods.radiation = radNow + 1;

          const radLabel = "Radiation Zone (Low)";
          if (!hasMod(radLabel)) addMod(radLabel);

          hexFlags.mods      = mods;
          hexFlags.modifiers = modifiers;
          touchedHex = true;

          try {
            const tApi = game.bbttcc?.api?.tikkun;
            if (tApi?.gatherSpark && actor?.id) {
              tApi.gatherSpark(actor.id, {
                key:        "spark_splintered_hod",
                name:       "Spark of Splintered Hod",
                kind:       "conceptual",
                sephirah:   "hod",
                status:     "gathered",
                description: "A shard of impossible symmetry and ruined splendor, left in the explorers' minds by whatever woke in the vault."
              });
            }
          } catch (e) {
            warn("Failed to grant Spark of Splintered Hod:", e);
          }
          break;
        }
        default: break;
      }
    }

    // --- Minor Radiation Pocket (P0) ----------------------------------------
    else if (scenarioKey === "travel_minor_radiation_t2") {
      switch (outcomeKey) {
        case "skirt_the_edge": {
          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          touchedOp = true;
          break;
        }

        case "push_through_heat": {
          const radNow = n(mods.radiation);
          mods.radiation = radNow + 1;
          const label = "Radiation Pocket (Minor)";
          if (!hasMod(label)) addMod(label);
          hexFlags.mods      = mods;
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        case "mutagenic_flare": {
          const radNow = n(mods.radiation);
          mods.radiation = radNow + 2;
          const label = "Mutagenic Hotspot";
          if (!hasMod(label)) addMod(label);
          hexFlags.mods      = mods;
          hexFlags.modifiers = modifiers;
          touchedHex = true;

          tracks.morale   = n(tracks.morale)   - 1;
          tracks.darkness = n(tracks.darkness) + 1;
          touchedTracks = true;

          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          touchedOp = true;
          break;
        }

        case "resonant_pulse": {
          const radNow = n(mods.radiation);
          mods.radiation = radNow + 1;
          const label = "Resonant Radiation Pocket";
          if (!hasMod(label)) addMod(label);
          hexFlags.mods      = mods;
          hexFlags.modifiers = modifiers;
          touchedHex = true;

          tracks.darkness = n(tracks.darkness) + 1;
          touchedTracks = true;

          try {
            const tApi = game.bbttcc?.api?.tikkun;
            if (tApi?.gatherSpark && actor?.id) {
              tApi.gatherSpark(actor.id, {
                key:        "spark_minor_fallout",
                name:       "Spark of Minor Fallout",
                kind:       "conceptual",
                sephirah:   "hod",
                status:     "gathered",
                description: "A small but persistent echo of irradiated Hod, caught in the faction's wake as they traversed the pocket."
              });
            }
          } catch (e) {
            warn("Failed to grant Spark of Minor Fallout:", e);
          }
          break;
        }

        default: break;
      }
    }

    // --- Vault Depths (P0) --------------------------------------------------
    else if (scenarioKey === "travel_vault_depths_t3") {
      switch (outcomeKey) {
        case "careful_mapping": {
          resources.knowledge = Math.max(0, n(resources.knowledge) + 1);
          const label = "Secured Vault Routes";
          if (!hasMod(label)) addMod(label);
          hexFlags.resources = resources;
          touchedHex = true;
          break;
        }
        case "depths_bite_back": {
          const hazardLabel = "Hazardous Vault Depths";
          if (!hasMod(hazardLabel)) addMod(hazardLabel);
          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          opBank.violence  = Math.max(0, n(opBank.violence)  - 1);
          touchedHex = touchedOp = true;
          break;
        }
        case "qliphotic_echoes": {
          const radNow = n(mods.radiation);
          mods.radiation = radNow + 1;
          const echoLabel = "Qliphotic Echoes";
          if (!hasMod(echoLabel)) addMod(echoLabel);
          hexFlags.mods      = mods;
          hexFlags.modifiers = modifiers;
          touchedHex = true;

          try {
            const tApi = game.bbttcc?.api?.tikkun;
            if (tApi?.gatherSpark && actor?.id) {
              tApi.gatherSpark(actor.id, {
                key:        "spark_qliphotic_vault",
                name:       "Spark of the Qliphotic Vault",
                kind:       "conceptual",
                sephirah:   "yesod",
                status:     "gathered",
                description: "A shard of inverted Yesod carried up from the depths, humming with Qliphotic pressure."
              });
            }
          } catch (e) {
            warn("Failed to grant Spark of the Qliphotic Vault:", e);
          }

          tracks.darkness = n(tracks.darkness) + 1;
          touchedTracks = true;
          break;
        }
        case "awakening_in_the_dark": {
          const breachLabel = "Sealed Qliphotic Breach";
          if (!hasMod(breachLabel)) addMod(breachLabel);

          const radNow = n(mods.radiation);
          mods.radiation = radNow + 1;
          hexFlags.mods      = mods;
          hexFlags.modifiers = modifiers;
          touchedHex = true;

          tracks.morale   = n(tracks.morale)   - 1;
          tracks.unity    = n(tracks.unity)    - 1;
          tracks.darkness = n(tracks.darkness) + 2;
          touchedTracks = true;
          break;
        }
        default: break;
      }
    }

    // --- Acid Bog (P0) ------------------------------------------------------
    else if (scenarioKey === "travel_acid_bog_t2") {
      switch (outcomeKey) {
        case "careful_crossing": {
          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          if (!hasMod("Damaged Equipment")) addMod("Damaged Equipment");
          requests.repairGear = true;
          touchedHex = touchedOp = true;
          break;
        }
        case "bog_claims_tithe": {
          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          opBank.economy   = Math.max(0, n(opBank.economy)   - 1);
          if (!hasMod("Equipment Loss"))     addMod("Equipment Loss");
          if (!hasMod("Hazardous Crossing")) addMod("Hazardous Crossing");
          touchedHex = touchedOp = true;
          break;
        }
        case "mutagenic_awakening": {
          const radNow = n(mods.radiation);
          mods.radiation = radNow + 1;
          const radLabel = "Radiation Zone (Low)";
          if (!hasMod(radLabel)) addMod(radLabel);
          hexFlags.mods      = mods;
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }
        default: break;
      }
    }

    // --- Spark Echo (P0) ----------------------------------------------------
    else if (scenarioKey === "travel_spark_echo_t2") {
      const tApi = game.bbttcc?.api?.tikkun;
      switch (outcomeKey) {
        case "harmonic_resonance": {
          try {
            if (tApi?.gatherSpark && actor?.id) {
              tApi.gatherSpark(actor.id, {
                key:        "spark_shattered_chorus",
                name:       "Spark of the Shattered Chorus",
                kind:       "conceptual",
                sephirah:   "hod",
                status:     "gathered",
                description: "A splintered chord of Hod, resonating through the Spark Echo and settling into the faction’s story."
              });
            }
          } catch (e) {
            warn("Failed to grant Spark of the Shattered Chorus:", e);
          }
          tracks.morale = n(tracks.morale) + 1;
          tracks.unity  = n(tracks.unity)  + 1;
          touchedTracks = true;
          break;
        }

        case "disruptive_feedback": {
          tracks.morale   = n(tracks.morale)   - 1;
          tracks.unity    = n(tracks.unity)    - 1;
          tracks.darkness = n(tracks.darkness) + 1;
          touchedTracks = true;

          mods.radiation = n(mods.radiation) + 1;
          hexFlags.mods  = mods;
          touchedHex = true;
          break;
        }

        case "splintered_reflection": {
          try {
            if (tApi?.gatherSpark && actor?.id) {
              tApi.gatherSpark(actor.id, {
                key:        "spark_shattered_chorus",
                name:       "Spark of the Shattered Chorus",
                kind:       "conceptual",
                sephirah:   "hod",
                status:     "gathered",
                description: "A fractured echo of Hod, half-formed and half-forgotten, seeded by the Spark Echo event."
              });
            }
          } catch (e) {
            warn("Failed to grant Spark of the Shattered Chorus (splintered_reflection):", e);
          }

          mods.radiation = n(mods.radiation) + 1;
          const label = "Unstable Spark Echo";
          if (!hasMod(label)) addMod(label);
          hexFlags.mods      = mods;
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        default: break;
      }
    }

    // --- Faction Parley (P0: travel_faction_parley_t2) ----------------------
    else if (scenarioKey === "travel_faction_parley_t2") {
      switch (outcomeKey) {
        case "diplomatic_breakthrough": {
          tracks.morale   = n(tracks.morale)   + 1;
          tracks.unity    = n(tracks.unity)    + 2;
          tracks.darkness = Math.max(0, n(tracks.darkness) - 1);
          touchedTracks = true;

          opBank.diplomacy = n(opBank.diplomacy) + 1;
          opBank.softpower = n(opBank.softpower) + 1;
          touchedOp = true;
          break;
        }

        case "tense_standoff": {
          tracks.morale = n(tracks.morale) - 1;
          touchedTracks = true;

          if (!hasMod("Tense Frontier")) addMod("Tense Frontier");
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        case "hostile_escalation": {
          tracks.darkness = n(tracks.darkness) + 1;
          tracks.morale   = n(tracks.morale)   - 1;
          touchedTracks = true;

          if (!hasMod("Hot Border")) addMod("Hot Border");
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        case "backchannel_deal": {
          tracks.unity = n(tracks.unity) + 1;
          tracks.morale = n(tracks.morale) - 1;
          touchedTracks = true;

          const label = "Secret Agreement";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        default: break;
      }
    }

    // --- Border Incident (P0: travel_border_incident_t2) --------------------
    else if (scenarioKey === "travel_border_incident_t2") {
      switch (outcomeKey) {
        case "controlled_deescalation": {
          tracks.morale = n(tracks.morale) - 1;
          tracks.unity  = n(tracks.unity)  + 1;
          touchedTracks = true;

          opBank.diplomacy = Math.max(0, n(opBank.diplomacy) - 1);
          touchedOp = true;

          if (!hasMod("Tense Frontier")) addMod("Tense Frontier");
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        case "shots_over_line": {
          tracks.darkness = n(tracks.darkness) + 1;
          touchedTracks = true;

          opBank.violence  = Math.max(0, n(opBank.violence)  - 1);
          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          touchedOp = true;

          if (!hasMod("Hot Border")) addMod("Hot Border");
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        case "escalation_to_skirmish": {
          tracks.morale   = n(tracks.morale)   + 1;
          tracks.darkness = n(tracks.darkness) + 2;
          touchedTracks = true;

          opBank.violence  = Math.max(0, n(opBank.violence)  - 2);
          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          touchedOp = true;

          if (!hasMod("Battlefield")) addMod("Battlefield");
          hexFlags.modifiers = modifiers;

          requests.cleanBattlefield = true;
          hexFlags.requests = requests;
          touchedHex = true;
          break;
        }

        case "strategic_withdrawal": {
          tracks.morale = n(tracks.morale) - 1;
          tracks.unity  = n(tracks.unity)  + 1;
          touchedTracks = true;

          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          touchedOp = true;

          if (!hasMod("Strategic Setback")) addMod("Strategic Setback");
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        default: break;
      }
    }

    // --- Rail Yard Takeover (P0) -------------------------------------------
    else if (scenarioKey === "travel_rail_yard_takeover_t3") {
      switch (outcomeKey) {
        case "seized_yard": {
          const label1 = "Seized Rail Yard";
          const label2 = "Logistics Hub (Friendly)";
          if (!hasMod(label1)) addMod(label1);
          if (!hasMod(label2)) addMod(label2);

          opBank.logistics = n(opBank.logistics) + 2;
          opBank.economy   = n(opBank.economy)   + 1;
          touchedOp = true;

          tracks.morale = n(tracks.morale) + 1;
          tracks.unity  = n(tracks.unity)  + 1;
          touchedTracks = true;
          touchedHex = true;
          break;
        }

        case "sabotaged_lines": {
          const label = "Sabotaged Rail Lines";
          if (!hasMod(label)) addMod(label);

          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          touchedOp = true;

          tracks.darkness = n(tracks.darkness) + 1;
          touchedTracks = true;
          touchedHex = true;
          break;
        }

        case "botched_operation": {
          const label = "Failed Rail Operation";
          if (!hasMod(label)) addMod(label);

          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          opBank.softpower = Math.max(0, n(opBank.softpower) - 1);
          touchedOp = true;

          tracks.morale = n(tracks.morale) - 1;
          tracks.unity  = n(tracks.unity)  - 1;
          touchedTracks = true;
          touchedHex = true;
          break;
        }

        case "workers_uprising": {
          const label1 = "Workers’ Commune Rail Hub";
          if (!hasMod(label1)) addMod(label1);
          removeMod("Seized Rail Yard");

          opBank.logistics = n(opBank.logistics) + 1;
          touchedOp = true;

          tracks.morale   = n(tracks.morale)   + 1;
          tracks.unity    = n(tracks.unity)    + 2;
          tracks.darkness = Math.max(0, n(tracks.darkness) - 1);
          touchedTracks = true;
          touchedHex = true;
          break;
        }

        default: break;
      }
    }

    // --- Weather Front (NEW) -----------------------------------------------
    else if (scenarioKey === "travel_weather_front_t3") {
      switch (outcomeKey) {
        case "ride_it_out": {
          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          touchedOp = true;

          const label = "Weather-Scoured Route";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        case "reroute_around_storm": {
          opBank.logistics = Math.max(0, n(opBank.logistics) - 2);
          touchedOp = true;

          const label = "Storm Detour Known";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        case "catastrophic_front": {
          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          opBank.economy   = Math.max(0, n(opBank.economy)   - 1);
          touchedOp = true;

          tracks.morale   = n(tracks.morale)   - 1;
          tracks.darkness = n(tracks.darkness) + 1;
          touchedTracks = true;

          const label = "Storm-Scarred Route";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;

          requests.repairStormDamage = true;
          hexFlags.requests = requests;
          touchedHex = true;
          break;
        }

        default: break;
      }
    }

    // --- Supply Shortage (NEW) ---------------------------------------------
    else if (scenarioKey === "travel_supply_shortage_t2") {
      switch (outcomeKey) {
        case "reprioritized_cargo": {
          opBank.economy = Math.max(0, n(opBank.economy) - 1);
          touchedOp = true;
          break;
        }

        case "cut_rations": {
          tracks.morale = n(tracks.morale) - 1;
          touchedTracks = true;
          break;
        }

        case "cannibalize_assets": {
          opBank.economy   = Math.max(0, n(opBank.economy)   - 1);
          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          touchedOp = true;

          const label = "Asset-Stripped Convoy";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        default: break;
      }
    }

    // --- Wilderness Push (NEW) ---------------------------------------------
    else if (scenarioKey === "travel_wilderness_push_t3") {
      switch (outcomeKey) {
        case "push_to_limit": {
          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          touchedOp = true;

          resources.knowledge = n(resources.knowledge) + 1;
          hexFlags.resources = resources;

          const label = "Overgrown Route";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        case "controlled_withdrawal": {
          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          touchedOp = true;

          tracks.morale = n(tracks.morale) - 1;
          touchedTracks = true;
          break;
        }

        case "lost_in_the_green": {
          const label = "Disorienting Wilderness";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;

          tracks.morale   = n(tracks.morale)   - 1;
          tracks.darkness = n(tracks.darkness) + 1;
          touchedTracks = true;

          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          touchedOp = true;
          break;
        }

        default: break;
      }
    }

    // --- Mutant Wildlife T2 (NEW) ------------------------------------------
    else if (scenarioKey === "travel_mutant_wildlife_t2") {
      switch (outcomeKey) {
        case "clean_hunt": {
          opBank.violence = Math.max(0, n(opBank.violence) - 1);
          touchedOp = true;

          tracks.morale = n(tracks.morale) + 1;
          touchedTracks = true;

          const label = "Culled Predators";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        case "messy_clash": {
          opBank.violence  = Math.max(0, n(opBank.violence)  - 1);
          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          touchedOp = true;

          tracks.morale = n(tracks.morale) - 1;
          touchedTracks = true;

          const label = "Disturbed Hunting Grounds";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        case "predators_hold_ground": {
          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          touchedOp = true;

          const label = "Predator Territory";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        default: break;
      }
    }

    // --- Mutant Wildlife T3 (NEW) ------------------------------------------
    else if (scenarioKey === "travel_mutant_wildlife_t3") {
      switch (outcomeKey) {
        case "apex_brought_down": {
          opBank.violence = Math.max(0, n(opBank.violence) - 2);
          touchedOp = true;

          tracks.morale = n(tracks.morale) + 1;
          touchedTracks = true;

          const label = "Slain Apex";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        case "costly_repulse": {
          opBank.violence  = Math.max(0, n(opBank.violence)  - 2);
          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          touchedOp = true;

          tracks.morale   = n(tracks.morale)   - 1;
          tracks.darkness = n(tracks.darkness) + 1;
          touchedTracks = true;

          const label = "Scarred Hunting Ground";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        case "apex_claims_tithe": {
          opBank.violence  = Math.max(0, n(opBank.violence)  - 1);
          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          opBank.economy   = Math.max(0, n(opBank.economy)   - 1);
          touchedOp = true;

          tracks.morale   = n(tracks.morale)   - 1;
          tracks.darkness = n(tracks.darkness) + 2;
          touchedTracks = true;

          const label = "Apex Tithe";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        default: break;
      }
    }

    // --- Qlipothic Shambler (NEW) ------------------------------------------
    else if (scenarioKey === "travel_qlipothic_shambler_t2") {
      switch (outcomeKey) {
        case "shambler_banished": {
          const label = "Shambler Scars";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;

          tracks.morale = n(tracks.morale) + 1;
          touchedTracks = true;
          break;
        }

        case "shambler_marks_hex": {
          const label = "Qliphotic Stain";
          if (!hasMod(label)) addMod(label);
          const radNow = n(mods.radiation);
          mods.radiation = radNow + 1;
          hexFlags.mods      = mods;
          hexFlags.modifiers = modifiers;
          touchedHex = true;

          tracks.darkness = n(tracks.darkness) + 1;
          touchedTracks = true;
          break;
        }

        case "shambler_ignored": {
          const label = "Ignored Anomaly";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        default: break;
      }
    }

    // --- Geometry Serpent (NEW) --------------------------------------------
    else if (scenarioKey === "travel_geometry_serpent_t3") {
      switch (outcomeKey) {
        case "route_rewritten": {
          const label = "Rerouted Around Serpent";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;

          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          touchedOp = true;
          touchedHex = true;
          break;
        }

        case "path_shattered": {
          const label = "Geometry-Shattered Path";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;

          opBank.logistics = Math.max(0, n(opBank.logistics) - 2);
          touchedOp = true;

          tracks.darkness = n(tracks.darkness) + 1;
          touchedTracks = true;
          touchedHex = true;
          break;
        }

        case "serpent_hunted": {
          resources.knowledge = n(resources.knowledge) + 1;
          hexFlags.resources = resources;

          const label = "Serpent Study Site";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;

          touchedHex = true;
          break;
        }

        default: break;
      }
    }

    // --- Slippage Wraith (NEW) ---------------------------------------------
    else if (scenarioKey === "travel_slippage_wraith_t3") {
      switch (outcomeKey) {
        case "wraith_dispersed": {
          const label = "Cleansed Slippage";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;

          tracks.morale = n(tracks.morale) + 1;
          touchedTracks = true;
          break;
        }

        case "wraith_bound": {
          const label = "Bound Wraith Relic";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;

          resources.knowledge = n(resources.knowledge) + 1;
          hexFlags.resources = resources;
          touchedHex = true;
          break;
        }

        case "wraith_marks_soul": {
          const label = "Slippage Mark";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;

          tracks.morale   = n(tracks.morale)   - 1;
          tracks.darkness = n(tracks.darkness) + 1;
          touchedTracks = true;
          break;
        }

        default: break;
      }
    }

    // --- Qliphotic Whorl (NEW) ---------------------------------------------
    else if (scenarioKey === "travel_qliphotic_whorl_t4") {
      switch (outcomeKey) {
        case "mapped_the_pattern": {
          resources.knowledge = n(resources.knowledge) + 2;
          hexFlags.resources = resources;
          touchedHex = true;
          break;
        }

        case "entered_the_whorl": {
          const label = "Whorl-Laced Hex";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;

          tracks.darkness = n(tracks.darkness) + 2;
          touchedTracks = true;
          touchedHex = true;
          break;
        }

        case "sealed_the_whorl": {
          const label = "Sealed Whorl Scar";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;

          tracks.darkness = n(tracks.darkness) + 1;
          tracks.unity    = n(tracks.unity)    + 1;
          touchedTracks = true;
          break;
        }

        default: break;
      }
    }

    // --- Apex Predator (NEW) -----------------------------------------------
    else if (scenarioKey === "travel_apex_predator_t4") {
      switch (outcomeKey) {
        case "predator_slain": {
          const label = "Legendary Kill Site";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;

          tracks.morale   = n(tracks.morale)   + 2;
          tracks.unity    = n(tracks.unity)    + 1;
          tracks.darkness = Math.max(0, n(tracks.darkness) - 1);
          touchedTracks = true;
          break;
        }

        case "predator_driven_off": {
          const label = "Predator Repelled";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;

          tracks.morale = n(tracks.morale) + 1;
          touchedTracks = true;
          break;
        }

        case "predator_claims_tithe": {
          const label = "Predator Tithe";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;

          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          opBank.economy   = Math.max(0, n(opBank.economy)   - 1);
          touchedOp = true;

          tracks.morale   = n(tracks.morale)   - 1;
          tracks.darkness = n(tracks.darkness) + 2;
          touchedTracks = true;
          break;
        }

        default: break;
      }
    }

    // --- Border Incident Remote (NEW) --------------------------------------
    else if (scenarioKey === "travel_border_incident_remote_t2") {
      switch (outcomeKey) {
        case "rumor_only": {
          const label = "Rumored Flashpoint";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        case "new_flashpoint": {
          const label = "Designated Flashpoint";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;

          tracks.darkness = n(tracks.darkness) + 1;
          touchedTracks = true;
          break;
        }

        case "sparked_skirmish_elsewhere": {
          const label = "Skirmish Ripples";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;

          tracks.morale = n(tracks.morale) - 1;
          touchedTracks = true;
          break;
        }

        default: break;
      }
    }

    // --- Faction Parley Roaming (NEW) --------------------------------------
    else if (scenarioKey === "travel_faction_parley_roaming_t2") {
      switch (outcomeKey) {
        case "traveling_alliance": {
          const label = "Travel Alliance Route";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;

          tracks.unity  = n(tracks.unity)  + 2;
          tracks.morale = n(tracks.morale) + 1;
          touchedTracks = true;
          break;
        }

        case "temporary_truce": {
          const label = "Parley Zone";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        case "poisoned_offers": {
          const label = "Poisoned Accord";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;

          tracks.unity    = n(tracks.unity)    - 1;
          tracks.darkness = n(tracks.darkness) + 1;
          touchedTracks = true;
          break;
        }

        default: break;
      }
    }

    // --- Spark Echo Rare (NEW) ---------------------------------------------
    else if (scenarioKey === "travel_spark_echo_rare_t3") {
      switch (outcomeKey) {
        case "rare_alignment": {
          tracks.morale   = n(tracks.morale)   + 1;
          tracks.unity    = n(tracks.unity)    + 1;
          tracks.darkness = Math.max(0, n(tracks.darkness) - 1);
          touchedTracks = true;
          break;
        }

        case "paradoxic_echo": {
          tracks.morale   = n(tracks.morale)   - 1;
          tracks.unity    = n(tracks.unity)    - 1;
          tracks.darkness = n(tracks.darkness) + 2;
          touchedTracks = true;
          break;
        }

        case "echo_shards": {
          const label = "Echo Shards Scattered";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        default: break;
      }
    }

    // --- Desenitarius Maarg — Worldboss (NEW) ------------------------------
    else if (scenarioKey === "travel_desenitarius_maarg_t4") {
      switch (outcomeKey) {
        case "dragon_driven_off": {
          opBank.violence  = Math.max(0, n(opBank.violence)  - 3);
          opBank.logistics = Math.max(0, n(opBank.logistics) - 2);
          touchedOp = true;

          tracks.morale   = n(tracks.morale)   + 1;
          tracks.darkness = n(tracks.darkness) + 1;
          touchedTracks = true;

          const label = "Dragon-Scorched Trail";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        case "dragon_devours_route": {
          opBank.violence  = Math.max(0, n(opBank.violence)  - 3);
          opBank.logistics = Math.max(0, n(opBank.logistics) - 3);
          opBank.economy   = Math.max(0, n(opBank.economy)   - 3);
          touchedOp = true;

          tracks.morale   = n(tracks.morale)   - 2;
          tracks.unity    = n(tracks.unity)    - 1;
          tracks.darkness = n(tracks.darkness) + 3;
          touchedTracks = true;

          hexFlags.type = "wasteland";
          const label1 = "Dragon Graveyard";
          const label2 = "Devoured Route";
          if (!hasMod(label1)) addMod(label1);
          if (!hasMod(label2)) addMod(label2);
          hexFlags.modifiers = modifiers;

          requests.rebuildRoute = true;
          hexFlags.requests = requests;
          touchedHex = true;
          break;
        }

        case "dragon_bound_in_myth": {
          opBank.violence  = Math.max(0, n(opBank.violence)  - 1);
          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          touchedOp = true;

          tracks.unity    = n(tracks.unity)    + 2;
          tracks.darkness = n(tracks.darkness) + 2;
          touchedTracks = true;

          const label = "Dragon Pact Route";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        default: break;
      }
    }

    // --- Raider Raze Team (NEW) --------------------------------------------
    else if (scenarioKey === "travel_raider_raze_team_t3") {
      switch (outcomeKey) {
        case "raze_team_broken": {
          const label = "Raze Team Defeated";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;
          touchedHex = true;

          tracks.morale = n(tracks.morale) + 1;
          touchedTracks = true;
          break;
        }

        case "partial_razing": {
          const label = "Partially Razed";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;

          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          touchedOp = true;

          tracks.darkness = n(tracks.darkness) + 1;
          touchedTracks = true;
          touchedHex = true;
          break;
        }

        case "raze_team_scorches_earth": {
          const label = "Scorched Earth";
          if (!hasMod(label)) addMod(label);
          hexFlags.modifiers = modifiers;

          hexFlags.type = "wasteland";
          opBank.logistics = Math.max(0, n(opBank.logistics) - 2);
          opBank.economy   = Math.max(0, n(opBank.economy)   - 1);
          touchedOp = true;

          tracks.darkness = n(tracks.darkness) + 2;
          touchedTracks = true;
          touchedHex = true;
          break;
        }

        default: break;
      }
    }

    // -----------------------------------------------------------------------
    // Commit updates
    // -----------------------------------------------------------------------
    const hexUpdates   = {};
    const actorUpdates = {};

    if (touchedHex) {
      hexFlags.modifiers = modifiers;
      hexFlags.requests  = requests;
      hexFlags.mods      = mods;

      hexUpdates["flags.bbttcc-territory.modifiers"] = hexFlags.modifiers;
      hexUpdates["flags.bbttcc-territory.requests"]  = hexFlags.requests;
      hexUpdates["flags.bbttcc-territory.mods"]      = hexFlags.mods;

      if (hexFlags.type && hexFlags.type !== hexFlagsOrig.type) {
        hexUpdates["flags.bbttcc-territory.type"] = hexFlags.type;
      }
      if (hexFlags.resources && hexFlags.resources !== hexFlagsOrig.resources) {
        hexUpdates["flags.bbttcc-territory.resources"] = hexFlags.resources;
      }
    }

    if (touchedOp) {
      actorUpdates["flags.bbttcc-factions.opBank"] = opBank;
    }
    if (touchedTracks) {
      actorUpdates["flags.bbttcc-factions.tracks"] = tracks;
    }

    if (!Object.keys(hexUpdates).length && !Object.keys(actorUpdates).length) return;

    try {
      if (Object.keys(hexUpdates).length) await hexDoc.update(hexUpdates);
      if (Object.keys(actorUpdates).length) await actor.update(actorUpdates);

      log("Applied encounter world effects", {
        scenarioKey,
        outcomeKey,
        hexUpdates,
        actorUpdates
      });
    } catch (e) {
      warn("Failed to apply encounter world effects", e);
      ui.notifications?.error?.("Failed to apply encounter world effects. See console.");
    }
  }

  // ---------------------------------------------------------------------------
  // Resolution Engine hook
  // ---------------------------------------------------------------------------

  async function applyResolutionForOutcome(scenario, set, choice, ctx) {
    try {
      if (!scenario || !choice) return;
      if (ctx?.source === "manual-testFire") return;

      const actor = ctx?.actor;
      if (!actor) return;

      let hexDoc = ctx?.to?.obj ?? ctx?.to?.document ?? ctx?.to ?? null;
      if (!hexDoc) return;

      const terrApi = game.bbttcc?.api?.territory || {};
      const applyOutcome = terrApi.applyOutcome;
      if (typeof applyOutcome !== "function") return;

      const options = set?.options || [];
      const opt = options.find(o => o.key === choice.key) || choice;

      const resChoices = Array.isArray(opt.resolutionChoices) ? opt.resolutionChoices : [];
      if (!resChoices.length) return;

      const res = resChoices[0] || {};
      const resolutionKey = res.resolutionKey;
      if (!resolutionKey) return;

      const tier =
        res.defaultTier ||
        ctx?.encounter?.tier ||
        "partial";

      const enc = ctx?.encounter || {};
      const encKey = enc.result?.key || enc.key || null;

      const payload = {
        factionId: actor.id,
        hexUuid: hexDoc.uuid,
        outcomeKey: resolutionKey,
        tier,
        context: {
          source: "encounter",
          scenarioKey: scenario.key,
          encounterKey: encKey,
          microOutcomeKey: choice.key,
          microOutcomeLabel: choice.label,
          travel: {
            fromUuid: ctx?.from?.uuid ?? ctx?.from?.hexUuid ?? null,
            toUuid: hexDoc.uuid,
            tier: enc.tier ?? null
          }
        }
      };

      log("Calling territory.applyOutcome from Encounter Engine", payload);
      await applyOutcome(payload);
    } catch (e) {
      warn("applyResolutionForOutcome failed", e);
      ui.notifications?.error?.("Resolution Engine integration failed. See console.");
    }
  }

  // ---------------------------------------------------------------------------
  // Auto-return to parent map scene
  // ---------------------------------------------------------------------------

  async function autoReturnToParentScene(ctx) {
    try {
      if (!ctx || ctx.source === "manual-testFire") return;

      let targetScene = null;
      const retId = ctx.returnSceneUuid || ctx.returnToSceneUuid;
      if (retId) {
        let sceneId = retId;
        if (typeof sceneId === "string" && sceneId.startsWith("Scene.")) {
          sceneId = sceneId.split(".")[1] || sceneId;
        }
        targetScene = game.scenes?.get(sceneId) ?? null;
      }

      if (!targetScene) {
        let hexDoc = ctx?.to?.obj ?? ctx?.to?.document ?? ctx?.to ?? null;
        const parentScene = hexDoc?.parent;
        if (!parentScene) return;
        targetScene = parentScene;
      }

      if (!targetScene) return;
      if (canvas?.scene?.id === targetScene.id) return;
      await targetScene.activate();
      log("Auto-returned to scene after encounter:", targetScene.name);
    } catch (e) {
      warn("autoReturnToParentScene failed", e);
    }
  }

  // ---------------------------------------------------------------------------
  // Outcome dialog & warLog writing
  // ---------------------------------------------------------------------------

  async function promptOutcomeForScenario(scenario, ctx) {
    if (!game.user?.isGM) return null;

    // Campaign-authored scenarios typically use Campaign Engine for outcomes/choices.
    // Unless an explicit outcome set exists, we skip the Encounter Engine outcome prompt.
    if (scenario?.type === "campaign") return null;

    const { getSetForScenario } = getOutcomeAPI();
    const set = getSetForScenario(scenario.key);

    if (!set || !Array.isArray(set.options) || !set.options.length) {
      try {
        const api = game.bbttcc?.api?.encounters || {};
        const known = (typeof api.listOutcomeSets === "function")
          ? (api.listOutcomeSets() || []).map(s => s.key).filter(Boolean)
          : [];
        warn("No outcome set for scenario (or empty options).", {
          scenarioKey: scenario?.key,
          hasSet: !!set,
          optionCount: Array.isArray(set?.options) ? set.options.length : null,
          knownCount: known.length,
          knownSample: known.slice(0, 12)
        });
        ui.notifications?.warn?.(`No outcome dialog configured for: ${scenario?.label || scenario?.key}`);
      } catch (e) {
        // ignore
      }
      return null;
    }

    const options = set.options;
    const defaultOpt = options.find(o => o.default) || options[0];

    let resolved = false;

    return new Promise(resolve => {
      const rows = options.map(o => {
        const checked = o === defaultOpt ? "checked" : "";
        const escLabel = foundry.utils.escapeHTML(o.label);
        const escSummary = foundry.utils.escapeHTML(o.summary || "");
        return `
          <div class="bbttcc-outcome-row" style="margin-bottom:0.35rem;">
            <label style="display:flex;align-items:flex-start;gap:.4rem;">
              <input type="radio" name="bbttcc-outcome" value="${o.key}" ${checked} />
              <span>
                <strong>${escLabel}</strong><br/>
                <small style="opacity:.85;">${escSummary}</small>
              </span>
            </label>
          </div>
        `;
      }).join("");

      const desc = set.description ? `<p>${foundry.utils.escapeHTML(set.description)}</p>` : "";
      const content = `
        ${desc}
        <form class="bbttcc-outcome-form">
          ${rows}
        </form>
      `;

      const dlg = new Dialog({
        title: set.label || (scenario.label || "Encounter Outcome"),
        content,
        buttons: {
          ok: {
            icon: '<i class="fas fa-check"></i>',
            label: "Apply Outcome",
            callback: html => {
              if (resolved) return;
              resolved = true;
              const $html = html instanceof jQuery ? html : $(html);
              const val = String($html.find('input[name="bbttcc-outcome"]:checked').val() || defaultOpt.key);
              const choice = options.find(o => o.key === val) || defaultOpt;
              resolve(choice);
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Skip",
            callback: () => {
              if (resolved) return;
              resolved = true;
              resolve(null);
            }
          }
        },
        default: "ok",
        close: () => {
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
        }
      });
      dlg.render(true);
    });
  }

  // NOTE: FIXED SIGNATURE — no "set" param here
  async function recordOutcomeInWarLog(scenario, ctx, choice) {
    if (!choice) return;

    if (ctx?.source === "manual-testFire") {
      log("Outcome (test only)", { scenarioKey: scenario.key, outcomeKey: choice.key });
      return;
    }

    const actor = ctx?.actor;
    if (!actor) {
      log("No faction actor in ctx; outcome will not be written to warLogs.");
      return;
    }

    const fFlags = clone(actor.flags?.["bbttcc-factions"] ?? {});
    const warLogs = Array.isArray(fFlags.warLogs) ? fFlags.warLogs.slice() : [];

    const enc = ctx?.encounter || {};
    const encKey = enc.result?.key || enc.key || null;

    let hexDoc = ctx?.to?.obj ?? ctx?.to?.document ?? ctx?.to ?? null;
    const hexFlags = hexDoc?.flags?.["bbttcc-territory"] || {};
    const hexName =
      hexFlags.name ||
      hexDoc?.text ||
      hexDoc?.name ||
      hexDoc?.id ||
      "Unknown Hex";

    const entry = {
      ts: Date.now(),
      date: new Date().toISOString(),
      type: "encounterOutcome",
      scenarioKey: scenario.key,
      encounterKey: encKey,
      outcomeKey: choice.key,
      outcomeLabel: choice.label,
      summary: `${scenario.label || scenario.key}: ${choice.label} at ${hexName}`,
      hexUuid: hexDoc?.uuid || null,
      hexName
    };

    warLogs.push(entry);

    try {
      await actor.update({ "flags.bbttcc-factions.warLogs": warLogs });
      log("Recorded encounter outcome in warLogs", entry);
    } catch (e) {
      warn("Failed to record encounter outcome in warLogs", e);
      ui.notifications?.error?.("Failed to record encounter outcome in warLogs. See console.");
    }

    const { getSetForScenario } = getOutcomeAPI();
    const set = getSetForScenario(scenario.key);
    await applyWorldEffectsForOutcome(scenario, choice, ctx);
    await applyResolutionForOutcome(scenario, set, choice, ctx);
  }

  // ---------------------------------------------------------------------------
  // Scenario player
  // ---------------------------------------------------------------------------

  async function playScenario(scenario, ctx = {}) {
    if (!scenario || !Array.isArray(scenario.steps) || !scenario.steps.length) {
      warn("playScenario: scenario has no steps", scenario);
      return;
    }

    log("Playing scenario", scenario.key, { scenario, ctx });

    const spawner = getSpawner();

    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i];
      const stepLabel = step.role || `step ${i + 1}`;

      // Text / narrative step (no scene)
      if ((step.kind || "scene") === "text") {
        await showTextStep(step);
        continue;
      }

      let scene = null;
      try {
        scene = await fromUuid(step.uuid);
      } catch (e) {
        warn("Failed to resolve scene from uuid", step, e);
      }

      if (!scene) {
        warn("playScenario: step scene not found", step);
        continue;
      }

      const desc =
        step.kind === "scene"
          ? `Activate scene <strong>${scene.name}</strong> (${stepLabel.toUpperCase()}).`
          : `Run step "${stepLabel}" in scene <strong>${scene.name}</strong>.`;


await activateScene(scene);

// Campaign / external scenarios may request a simple actor drop-in without a dedicated spawnerKey.
// If provided, we ask the spawner interface to place them (idempotent via spawnedBy flag).
try {
  const spawn = scenario.spawn || null;
  const spawnActors = Array.isArray(spawn?.actors) ? spawn.actors : [];
  const spawnMode = spawn?.mode || "center";
  const spawnedBy = spawn?.spawnedBy || scenario.key;

  if (spawner && spawnActors.length) {
    if (spawnMode === "center" && typeof spawner.spawnAtCenter === "function") {
      await spawner.spawnAtCenter(scene, spawnActors, { spawnedBy });
    } else if (typeof spawner.spawnActors === "function") {
      await spawner.spawnActors(scene, spawnActors, { spawnedBy, mode: spawnMode });
    }
  }
} catch (e) {
  warn("Error spawning campaign actors for scenario", scenario?.key, e);
}

// Core scenarios may provide a spawnerKey for bespoke placement logic.
if (
  spawner &&
  typeof spawner.run === "function" &&
  scenario.scale !== "macro" &&
  scenario.spawnerKey &&
  (step.role === "main" || !step.role)
) {
  try {
    await spawner.run(scenario.spawnerKey, { ctx, scenario, step, scene });
  } catch (e) {
    warn("Error running spawner for scenario", scenario.key, e);
  }
}

      const autoMs = Number(step.autoAdvanceMs || 0);
      if (autoMs > 0) {
        await new Promise(r => setTimeout(r, autoMs));
      } else {
        await waitForGM(desc);
      }
    }

    const outcomeChoice = await promptOutcomeForScenario(scenario, ctx);
    if (outcomeChoice) {
      await recordOutcomeInWarLog(scenario, ctx, outcomeChoice);
    }

    await autoReturnToParentScene(ctx);

    log("Scenario complete", scenario.key, ctx);
  }

  // ---------------------------------------------------------------------------
  // Launcher install
  // ---------------------------------------------------------------------------

  function installLauncher() {
    game.bbttcc ??= { api: {} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.encounters ??= game.bbttcc.api.encounters || {};

    const prev = game.bbttcc.api.encounters;

    game.bbttcc.api.encounters = {
      ...prev,
      _launcher: {
        ...(prev._launcher || {}),
        playScenario
      }
    };

    log("Scene launcher installed (playScenario wired).");
  }

  Hooks.once("ready", installLauncher);
  try {
    if (game?.ready) installLauncher();
  } catch (e) {
    warn("installLauncher immediate call failed:", e);
  }
})();

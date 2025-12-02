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

    // --- Rockslide ---------------------------------------------------------
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

          hexFlags.type = hexFlags.type || "wasteland";
          if (hexFlags.type !== "wasteland") hexFlags.type = "wasteland";

          resources.knowledge = Math.max(0, n(resources.knowledge) + 1);
          opBank.logistics    = Math.max(0, n(opBank.logistics) - 1);

          hexFlags.resources = resources;
          touchedHex = touchedOp = true;
          break;
        }
        default: break;
      }
    }

    // --- Bandit Ambush -----------------------------------------------------
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

    // --- Hidden Ruins ------------------------------------------------------
    else if (scenarioKey === "travel_hidden_ruins_t2") {
      switch (outcomeKey) {
        case "shallow_survey": {
          break;
        }
        case "deep_alliance": {
          // Resolution Engine handles integration.
          break;
        }
        case "disturbed_things": {
          const radNow = n(mods.radiation);
          mods.radiation = radNow + 1;

          const radLabel = "Radiation Zone (Low)";
          if (!modifiers.includes(radLabel)) modifiers.push(radLabel);

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
            warn("Failed to grant Spark of Splintered Hod via Tikkun API:", e);
          }
          break;
        }
        default: break;
      }
    }

    // --- Minor Radiation Pocket -------------------------------------------
    else if (scenarioKey === "travel_minor_radiation_t2") {
      switch (outcomeKey) {
        case "skirt_the_edge": {
          // The faction takes the long way around, burning time and logistics.
          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          touchedOp = true;
          break;
        }

        case "push_through_heat": {
          // Direct traversal through the pocket; mild but lasting contamination.
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
          // A surge catches the expedition in transit; flesh and spirit both pay.
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
          // The faction deliberately leans into the resonance, courting minor anomalies.
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
            warn("Failed to grant Spark of Minor Fallout via Tikkun API:", e);
          }
          break;
        }

        default: break;
      }
    }


    // --- Vault Depths ------------------------------------------------------
    else if (scenarioKey === "travel_vault_depths_t3") {
      switch (outcomeKey) {
        case "careful_mapping": {
          // Mapping, stabilizing, and quietly securing the deeper corridors.
          resources.knowledge = Math.max(0, n(resources.knowledge) + 1);

          const label = "Secured Vault Routes";
          if (!hasMod(label)) addMod(label);

          hexFlags.resources = resources;
          touchedHex = true;
          break;
        }

        case "depths_bite_back": {
          // Internal hazards: traps, collapses, hostile denizens.
          const hazardLabel = "Hazardous Vault Depths";
          if (!hasMod(hazardLabel)) addMod(hazardLabel);

          opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
          opBank.violence  = Math.max(0, n(opBank.violence)  - 1);
          touchedHex = touchedOp = true;
          break;
        }

        case "qliphotic_echoes": {
          // Qliphotic anomalies ripple through the vault and into the hex.
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
            warn("Failed to grant Spark of the Qliphotic Vault via Tikkun API:", e);
          }

          tracks.darkness = n(tracks.darkness) + 1;
          touchedTracks = true;
          break;
        }

        case "awakening_in_the_dark": {
          // A singular "something" wakes; the faction chooses to seal or reshape the vault.
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


    // --- Acid Bog ----------------------------------------------------------
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
          if (!modifiers.includes(radLabel)) modifiers.push(radLabel);

          hexFlags.mods      = mods;
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }
        default: break;
      }
    }

    // --- Spark Echo --------------------------------------------------------
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
          if (!modifiers.includes(label)) modifiers.push(label);

          hexFlags.mods      = mods;
          hexFlags.modifiers = modifiers;
          touchedHex = true;
          break;
        }

        default: break;
      }
    }

    // --- Border Incident ---------------------------------------------------
else if (scenarioKey === "travel_border_incident_t2") {
  switch (outcomeKey) {
    case "controlled_deescalation": {
      // Costly but peace-preserving
      tracks.morale = n(tracks.morale) - 1;
      tracks.unity  = n(tracks.unity)  + 1;
      touchedTracks = true;

      opBank.diplomacy = Math.max(0, n(opBank.diplomacy) - 1);
      touchedOp = true;

      if (!modifiers.includes("Tense Frontier")) modifiers.push("Tense Frontier");
      hexFlags.modifiers = modifiers;
      touchedHex = true;
      break;
    }

    case "shots_over_line": {
      // Warning shots; simmering anger
      tracks.morale   = n(tracks.morale);         // shell-shocked, not clearly up/down
      tracks.darkness = n(tracks.darkness) + 1;
      touchedTracks = true;

      opBank.violence  = Math.max(0, n(opBank.violence)  - 1);
      opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
      touchedOp = true;

      if (!modifiers.includes("Hot Border")) modifiers.push("Hot Border");
      hexFlags.modifiers = modifiers;
      touchedHex = true;
      break;
    }

    case "escalation_to_skirmish": {
      // Brief firefight
      tracks.morale   = n(tracks.morale)   + 1;
      tracks.darkness = n(tracks.darkness) + 2;
      touchedTracks = true;

      opBank.violence  = Math.max(0, n(opBank.violence)  - 2);
      opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
      touchedOp = true;

      if (!modifiers.includes("Battlefield")) modifiers.push("Battlefield");
      hexFlags.modifiers = modifiers;

      // Optional: mark a cleanup project
      requests.cleanBattlefield = true;
      hexFlags.requests = requests;

      touchedHex = true;
      break;
    }

    case "strategic_withdrawal": {
      // Give ground intentionally
      tracks.morale = n(tracks.morale) - 1;
      tracks.unity  = n(tracks.unity)  + 1;
      touchedTracks = true;

      opBank.logistics = Math.max(0, n(opBank.logistics) - 1);
      touchedOp = true;

      if (!modifiers.includes("Strategic Setback")) modifiers.push("Strategic Setback");
      hexFlags.modifiers = modifiers;

      // You can also tweak hexFlags.status here if you like:
      // hexFlags.status = "contested";
      touchedHex = true;
      break;
    }

    default: break;
  }
}

    // --- Rail Yard Takeover -----------------------------------------------
    else if (scenarioKey === "travel_rail_yard_takeover_t3") {
      switch (outcomeKey) {
        case "seized_yard": {
          // Yard captured and converted into a friendly logistics hub.
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
          // Lines are damaged; throughput drops, and the zone becomes unstable.
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
          // Operation falls apart; assets and reputation take a hit.
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
          // Yard becomes a more just, worker-led hub; logistics stabilize with strong communal backing.
          const label1 = "Workers’ Commune Rail Hub";
          if (!hasMod(label1)) addMod(label1);
          removeMod("Seized Rail Yard"); // if it was previously taken purely by force

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


	else if (scenarioKey === "travel_faction_parley_t2") {
  switch (outcomeKey) {
    case "diplomatic_breakthrough":
      // Morale+1, Unity+2, Diplomacy/Softpower OP+1, add "Truce Ground"
      break;
    case "tense_standoff":
      // Morale-1, add "Tense Frontier"
      break;
    case "hostile_escalation":
      // Darkness+1, Morale-1, add "Hot Border"
      break;
    case "backchannel_deal":
      // Unity+1, Loyalty-1, add "Secret Agreement"
      break;
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

    // 1) Explicit override via ctx.returnSceneUuid / ctx.returnToSceneUuid
    let targetScene = null;
    const retId = ctx.returnSceneUuid || ctx.returnToSceneUuid;
    if (retId) {
      let sceneId = retId;
      if (typeof sceneId === "string" && sceneId.startsWith("Scene.")) {
        sceneId = sceneId.split(".")[1] || sceneId;
      }
      targetScene = game.scenes?.get(sceneId) ?? null;
    }

    // 2) Fallback: parent scene of the hex/target document
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

    const { getSetForScenario } = getOutcomeAPI();
    const set = getSetForScenario(scenario.key);
    if (!set || !Array.isArray(set.options) || !set.options.length) return null;

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

  async function recordOutcomeInWarLog(scenario, ctx, set, choice) {
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

    log("Playing scenario", scenario.key, scenario);

    const spawner = getSpawner();

    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i];
      const stepLabel = step.role || `step ${i+1}`;

      let scene = null;
      try { scene = await fromUuid(step.uuid); }
      catch (e) { warn("Failed to resolve scene from uuid", step, e); }

      if (!scene) {
        warn("playScenario: step scene not found", step);
        continue;
      }

      const desc =
        step.kind === "scene"
          ? `Activate scene <strong>${scene.name}</strong> (${stepLabel.toUpperCase()}).`
          : `Run step "${stepLabel}" in scene <strong>${scene.name}</strong>.`;

      await activateScene(scene);

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
      if (autoMs > 0) await new Promise(r => setTimeout(r, autoMs));
      else await waitForGM(desc);
    }

    const outcomeChoice = await promptOutcomeForScenario(scenario, ctx);
    if (outcomeChoice) {
      const { getSetForScenario } = getOutcomeAPI();
      const set = getSetForScenario(scenario.key);
      await recordOutcomeInWarLog(scenario, ctx, set, outcomeChoice);
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
    game.bbttcc.api.encounters ??= {};

    const prev = game.bbttcc.api.encounters;

    game.bbttcc.api.encounters = {
      ...prev,
      _launcher: {
        ...(prev._launcher || {}),
        playScenario
      }
    };

    log("Scene launcher installed");
  }

  Hooks.once("ready", installLauncher);
  try {
    // Safety: if this file loads after game.ready, still install launcher.
    if (game?.ready) installLauncher();
  } catch (e) {
    warn("installLauncher immediate call failed:", e);
  }
})();

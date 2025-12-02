// ============================================================================
// BBTTCC — Radiation Mutations Enhancer (Phase D, Narrative Only)
// Listens for bbttcc.mutationRoll(actor, rp) and records a narrative mutation
// on the actor under flags["bbttcc-radiation"].mutations.
//
// Public API on game.bbttcc.api.radiation.mutations:
//   - list(actorOrId)
//   - add(actorOrId, mutationObject)
//   - remove(actorOrId, mutationId)
//   - clear(actorOrId)
// ============================================================================

(() => {
  const TAG = "[bbttcc-radiation/mutations]";
  const MOD = "bbttcc-radiation";

  // ----- Helpers -------------------------------------------------------------

  function asActor(aOrId) {
    if (!aOrId) return null;
    if (aOrId instanceof Actor) return aOrId;
    const id = String(aOrId).replace(/^Actor\./, "");
    return game.actors?.get(id) ?? null;
  }

  function dup(x) {
    return foundry.utils.duplicate(x ?? {});
  }

  function listRaw(actor) {
    const A = asActor(actor);
    if (!A) return [];
    const arr = A.getFlag(MOD, "mutations") || [];
    return Array.isArray(arr) ? arr : [];
  }

  async function writeList(actor, list) {
    const A = asActor(actor);
    if (!A) return;
    await A.setFlag(MOD, "mutations", list);
  }

  function makeId() {
    return "mut_" + Date.now().toString(36) + "_" + Math.floor(Math.random() * 1e5).toString(36);
  }

  function tierForRP(rp) {
    const v = Number(rp || 0);
    if (v >= 100) return "cataclysmic";
    if (v >= 80)  return "major";
    if (v >= 60)  return "significant";
    if (v >= 50)  return "minor";
    return "minor";
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Narrative-only tables
  const TABLES = {
    minor: [
      {
        name: "Chromatic Freckles",
        description: "Specks of bioluminescent color bloom across the skin, pulsing faintly when radiation is nearby."
      },
      {
        name: "Static Halo",
        description: "Hair and clothing cling with a constant static charge, crackling in the dark."
      },
      {
        name: "Echo Breath",
        description: "Every breath leaves a faint, shimmering trail that lingers for a heartbeat."
      },
      {
        name: "Glass Nails",
        description: "Fingernails and toenails look like translucent glass, refracting ambient light."
      }
    ],
    significant: [
      {
        name: "Leyline Sight",
        description: "You can vaguely see the flow of leyline fractures as ghostly currents in the air."
      },
      {
        name: "Fractured Shadow",
        description: "Your shadow moves a half-beat out of sync, sometimes lagging, sometimes leaping ahead."
      },
      {
        name: "Radiant Whispers",
        description: "Exposure left a buzzing chorus in your mind; sometimes it mutters warnings, sometimes temptations."
      },
      {
        name: "Phase-Soft Bones",
        description: "Your bones feel lighter, occasionally bending instead of breaking under stress."
      }
    ],
    major: [
      {
        name: "Twin Afterimage",
        description: "A faint afterimage of you lags behind, visible to those attuned to the Weird."
      },
      {
        name: "Starlit Veins",
        description: "Veins glow like constellations when you exert yourself or channel power."
      },
      {
        name: "Gravity Skip",
        description: "For a heartbeat at a time, gravity forgets about you. Steps become long, drifting arcs."
      },
      {
        name: "Echoed Voice",
        description: "Your voice always sounds like it’s speaking from two places at once."
      }
    ],
    cataclysmic: [
      {
        name: "Localized Event Horizon",
        description: "Space warps subtly around you; small objects bend toward or away from you in erratic pulses."
      },
      {
        name: "Radiant Core",
        description: "A burning point of light sometimes shines from within your chest, like a captured star."
      },
      {
        name: "Temporal Blur",
        description: "People looking at you sometimes see you a few moments ahead or behind your actual actions."
      },
      {
        name: "Qliphotic Echo",
        description: "You carry a faint imprint of the Inverse Tree; certain Qliphotic entities recognize you on sight."
      }
    ]
  };

  function rollMutation(rp, { source = "radiation", sceneName = null, notes = "" } = {}) {
    const tier = tierForRP(rp);
    const table = TABLES[tier] || TABLES.minor;
    const base = pick(table);
    const mut = {
      id: makeId(),
      tier,
      name: base.name,
      description: base.description,
      source,
      scene: sceneName,
      rpAtTrigger: Number(rp || 0),
      notes: notes || "",
      ts: Date.now()
    };
    return mut;
  }

  // ----- API object ----------------------------------------------------------

  function publishAPI() {
    game.bbttcc ??= { api:{} };
    game.bbttcc.api ??= game.bbttcc.api || {};
    game.bbttcc.api.radiation ??= game.bbttcc.api.radiation || {};

    const existing = game.bbttcc.api.radiation.mutations || {};

    const mutationsAPI = {
      list(actorOrId) {
        return listRaw(actorOrId);
      },

      async add(actorOrId, mutation) {
        const A = asActor(actorOrId);
        if (!A) throw new Error("Mutations.add: actor not found");
        const list = listRaw(A);
        const mut = { id: makeId(), ...mutation };
        list.push(mut);
        await writeList(A, list);
        return mut;
      },

      async remove(actorOrId, id) {
        const A = asActor(actorOrId);
        if (!A) throw new Error("Mutations.remove: actor not found");
        const list = listRaw(A).filter(m => m.id !== id);
        await writeList(A, list);
        return true;
      },

      async clear(actorOrId) {
        const A = asActor(actorOrId);
        if (!A) throw new Error("Mutations.clear: actor not found");
        await writeList(A, []);
        return true;
      }
    };

    game.bbttcc.api.radiation.mutations = { ...existing, ...mutationsAPI };

    console.log(TAG, "Mutations API published on game.bbttcc.api.radiation.mutations");
  }

  // ----- Hook: bbttcc.mutationRoll -------------------------------------------

  async function onMutationRoll(actor, rp) {
    try {
      const A = asActor(actor);
      if (!A) return;

      // Generate a narrative-only mutation
      const scName = canvas?.scene?.name || null;
      const mut = rollMutation(rp, {
        source: "radiation",
        sceneName: scName,
        notes: ""
      });

      const list = listRaw(A);
      list.push(mut);
      await writeList(A, list);

      // GM card
      const tierLabel = mut.tier.charAt(0).toUpperCase() + mut.tier.slice(1);
      const gmIds = game.users.filter(u => u.isGM).map(u => u.id);

      const lines = [
        `<b>Mutation Event</b> — ${foundry.utils.escapeHTML(A.name)}`,
        `Tier: <b>${foundry.utils.escapeHTML(tierLabel)}</b>`,
        `RP at trigger: ${mut.rpAtTrigger}`,
        `Mutation: <b>${foundry.utils.escapeHTML(mut.name)}</b>`,
        `<span style="font-size:0.9em; opacity:0.9;">${foundry.utils.escapeHTML(mut.description)}</span>`
      ];

      if (mut.scene) {
        lines.splice(2, 0, `Scene: ${foundry.utils.escapeHTML(mut.scene)}`);
      }

      await ChatMessage.create({
        content: `<p>${lines.join("<br/>")}</p>`,
        whisper: gmIds,
        speaker: { alias: "BBTTCC Radiation" }
      }).catch(() => {});

      console.log(TAG, "Recorded mutation for", A.name, mut);
    } catch (e) {
      console.warn(TAG, "onMutationRoll failed:", e);
    }
  }

  // ----- Install -------------------------------------------------------------

  function install() {
    publishAPI();
    Hooks.on("bbttcc.mutationRoll", onMutationRoll);
    console.log(TAG, "Mutation enhancer ready (listening for bbttcc.mutationRoll).");
  }

  Hooks.once("ready", install);
  try { if (game?.ready) install(); } catch {}

})();

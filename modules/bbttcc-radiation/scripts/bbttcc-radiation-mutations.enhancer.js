// ============================================================================
// Bad Eden — Radiation Mutations Enhancer (Phase 3 — Mechanical Teeth)
// Listens for bbttcc.mutationRoll(actor, rp) and records a mutation on the actor
// under flags["bbttcc-radiation"].mutations. Each mutation is now DOUBLE-EDGED:
// it carries an `effects` payload (a boon + a bane) that is applied as a real,
// persistent ActiveEffect — radiation as a mutagen, not just a poison.
//
// SAFE EFFECT CHANNELS: mutation effects target the derived defense aeBonus keys
// (system.derived.{guard,evasion,resolve}.aeBonus). Those are single-application
// by design — the system reads them in prepareDerivedData and folds them into the
// defense value. We deliberately AVOID system.attributes.*.value because the roll
// paths both read the live (AE-applied) attribute AND sum the AE again → a double
// count. Defenses are rolled against constantly, so the teeth still bite hard.
//
// Public API on game.bbttcc.api.radiation.mutations:
//   - list(actorOrId)
//   - add(actorOrId, mutationObject)   → also applies its effects AE
//   - remove(actorOrId, mutationId)    → also deletes its effects AE
//   - clear(actorOrId)                 → also deletes every mutation AE
// ============================================================================

(() => {
  const TAG = "[bbttcc-radiation/mutations]";
  const MOD = "bbttcc-radiation";

  // Safe, single-application effect keys. All are aeBonus-style channels the
  // system folds into a derived value once (defenses + initiative + the max
  // Integrity/Stress channels added in prepareDerivedData). We deliberately do
  // NOT target attributes.*.value (those double-count on rolls).
  const K = {
    guard:      "system.derived.guard.aeBonus",
    evasion:    "system.derived.evasion.aeBonus",
    resolve:    "system.derived.resolve.aeBonus",
    initiative: "system.derived.initiative.bonus",
    integrity:  "system.derived.integrity.aeBonus",
    stress:     "system.derived.stress.aeBonus",
    casting:    "system.magic.castBonus"
  };
  const DEF_LABEL = {
    [K.guard]:      "Guard",
    [K.evasion]:    "Evasion",
    [K.resolve]:    "Resolve",
    [K.initiative]: "Initiative",
    [K.integrity]:  "Max Integrity",
    [K.stress]:     "Max Stress",
    [K.casting]:    "Casting"
  };

  // ----- Helpers -------------------------------------------------------------

  function asActor(aOrId) {
    if (!aOrId) return null;
    if (aOrId instanceof Actor) return aOrId;
    const id = String(aOrId).replace(/^Actor\./, "");
    return game.actors?.get(id) ?? null;
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
    return "minor";
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function fmtEffects(effects) {
    return (effects || [])
      .map(e => `${Number(e.value) >= 0 ? "+" : "−"}${Math.abs(Number(e.value))} ${DEF_LABEL[e.key] ?? e.key}`)
      .join(", ");
  }

  // Double-edged mutation tables. Each entry: { name, description, effects[] }.
  // effects target the safe defense aeBonus channel; every mutation pairs a boon
  // with a bane (net is usually a slight gain — mutation is a risky power).
  const TABLES = {
    minor: [
      { name: "Chromatic Freckles", description: "Specks of bioluminescent color bloom across the skin, pulsing faintly when radiation is nearby.",
        effects: [{ key: K.resolve, value: 1 }, { key: K.evasion, value: -1 }] },
      { name: "Static Halo", description: "Hair and clothing cling with a constant static charge, crackling in the dark.",
        effects: [{ key: K.initiative, value: 1 }, { key: K.casting, value: -1 }] },
      { name: "Echo Breath", description: "Every breath leaves a faint, shimmering trail that lingers for a heartbeat.",
        effects: [{ key: K.evasion, value: 1 }, { key: K.integrity, value: -1 }] },
      { name: "Glass Nails", description: "Fingernails and toenails look like translucent glass, refracting ambient light.",
        effects: [{ key: K.guard, value: 1 }, { key: K.integrity, value: -1 }] }
    ],
    significant: [
      { name: "Leyline Sight", description: "You can vaguely see the flow of leyline fractures as ghostly currents in the air.",
        effects: [{ key: K.casting, value: 2 }, { key: K.evasion, value: -2 }] },
      { name: "Fractured Shadow", description: "Your shadow moves a half-beat out of sync, sometimes lagging, sometimes leaping ahead.",
        effects: [{ key: K.evasion, value: 2 }, { key: K.initiative, value: -1 }] },
      { name: "Radiant Whispers", description: "Exposure left a buzzing chorus in your mind; sometimes it mutters warnings, sometimes temptations.",
        effects: [{ key: K.stress, value: 3 }, { key: K.resolve, value: -1 }] },
      { name: "Phase-Soft Bones", description: "Your bones feel lighter, occasionally bending instead of breaking under stress.",
        effects: [{ key: K.evasion, value: 2 }, { key: K.integrity, value: -3 }] }
    ],
    major: [
      { name: "Twin Afterimage", description: "A faint afterimage of you lags behind, visible to those attuned to the Weird.",
        effects: [{ key: K.evasion, value: 3 }, { key: K.resolve, value: -2 }] },
      { name: "Starlit Veins", description: "Veins glow like constellations when you exert yourself or channel power.",
        effects: [{ key: K.integrity, value: 2 }, { key: K.guard, value: 1 }, { key: K.evasion, value: -2 }] },
      { name: "Gravity Skip", description: "For a heartbeat at a time, gravity forgets about you. Steps become long, drifting arcs.",
        effects: [{ key: K.initiative, value: 3 }, { key: K.evasion, value: 1 }, { key: K.guard, value: -2 }] },
      { name: "Echoed Voice", description: "Your voice always sounds like it’s speaking from two places at once.",
        effects: [{ key: K.resolve, value: 3 }, { key: K.stress, value: -2 }] }
    ],
    cataclysmic: [
      { name: "Localized Event Horizon", description: "Space warps subtly around you; small objects bend toward or away from you in erratic pulses.",
        effects: [{ key: K.guard, value: 4 }, { key: K.evasion, value: -2 }] },
      { name: "Radiant Core", description: "A burning point of light sometimes shines from within your chest, like a captured star.",
        effects: [{ key: K.casting, value: 3 }, { key: K.integrity, value: 3 }, { key: K.evasion, value: -3 }] },
      { name: "Temporal Blur", description: "People looking at you sometimes see you a few moments ahead or behind your actual actions.",
        effects: [{ key: K.initiative, value: 4 }, { key: K.evasion, value: 2 }, { key: K.resolve, value: -3 }] },
      { name: "Qliphotic Echo", description: "You carry a faint imprint of the Inverse Tree; certain Qliphotic entities recognize you on sight.",
        effects: [{ key: K.resolve, value: 4 }, { key: K.stress, value: 2 }, { key: K.integrity, value: -4 }] }
    ]
  };

  function rollMutation(rp, { source = "radiation", sceneName = null, notes = "" } = {}) {
    const tier = tierForRP(rp);
    const table = TABLES[tier] || TABLES.minor;
    const base = pick(table);
    return {
      id: makeId(),
      tier,
      name: base.name,
      description: base.description,
      effects: foundry.utils.duplicate(base.effects || []),
      source,
      scene: sceneName,
      rpAtTrigger: Number(rp || 0),
      notes: notes || "",
      ts: Date.now()
    };
  }

  // ----- Effect application (persistent AE per mutation) ----------------------

  function canMutate(A) {
    return !!A && (A.isOwner || game.user?.isGM);
  }

  async function applyMutationEffects(A, mut) {
    if (!canMutate(A) || !Array.isArray(mut?.effects) || !mut.effects.length) return;
    // Dedupe — never stack a second AE for the same mutation id.
    if (A.effects?.some(e => e.flags?.[MOD]?.mutationId === mut.id)) return;
    await A.createEmbeddedDocuments("ActiveEffect", [{
      name:   `Mutation: ${mut.name}`,
      img:    "icons/svg/biohazard.svg",
      icon:   "icons/svg/biohazard.svg",
      tint:   "#7ec850",
      origin: A.uuid,
      disabled: false,
      // mode 2 = ADD. Defense aeBonus is the single-application channel (see header).
      changes: mut.effects.map(e => ({ key: e.key, mode: 2, value: String(e.value), priority: 20 })),
      flags:  { [MOD]: { mutationId: mut.id, mutation: true } }
    }]).catch(err => console.warn(TAG, "applyMutationEffects failed:", err));
  }

  async function removeMutationEffects(A, id) {
    if (!canMutate(A)) return;
    const ids = (A.effects ?? []).filter(e => e.flags?.[MOD]?.mutationId === id).map(e => e.id);
    if (ids.length) await A.deleteEmbeddedDocuments("ActiveEffect", ids).catch(() => {});
  }

  async function removeAllMutationEffects(A) {
    if (!canMutate(A)) return;
    const ids = (A.effects ?? []).filter(e => e.flags?.[MOD]?.mutation === true).map(e => e.id);
    if (ids.length) await A.deleteEmbeddedDocuments("ActiveEffect", ids).catch(() => {});
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
        const mut = { id: makeId(), effects: [], ...mutation };
        list.push(mut);
        await writeList(A, list);
        await applyMutationEffects(A, mut);
        return mut;
      },

      async remove(actorOrId, id) {
        const A = asActor(actorOrId);
        if (!A) throw new Error("Mutations.remove: actor not found");
        await removeMutationEffects(A, id);
        const list = listRaw(A).filter(m => m.id !== id);
        await writeList(A, list);
        return true;
      },

      async clear(actorOrId) {
        const A = asActor(actorOrId);
        if (!A) throw new Error("Mutations.clear: actor not found");
        await removeAllMutationEffects(A);
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

      const scName = canvas?.scene?.name || null;
      const mut = rollMutation(rp, { source: "radiation", sceneName: scName, notes: "" });

      const list = listRaw(A);
      list.push(mut);
      await writeList(A, list);
      await applyMutationEffects(A, mut);

      // GM card
      const tierLabel = mut.tier.charAt(0).toUpperCase() + mut.tier.slice(1);
      const gmIds = game.users.filter(u => u.isGM).map(u => u.id);
      const effectsStr = fmtEffects(mut.effects);

      const lines = [
        `<b>Mutation Event</b> — ${foundry.utils.escapeHTML(A.name)}`,
        `Tier: <b>${foundry.utils.escapeHTML(tierLabel)}</b>`,
        `RP at trigger: ${mut.rpAtTrigger}`,
        `Mutation: <b>${foundry.utils.escapeHTML(mut.name)}</b>`,
        `<span style="font-size:0.9em; opacity:0.9;">${foundry.utils.escapeHTML(mut.description)}</span>`
      ];
      if (effectsStr) {
        lines.push(`<span style="color:#7ec850;font-weight:600;">⚙ ${foundry.utils.escapeHTML(effectsStr)}</span>`);
      }
      if (mut.scene) {
        lines.splice(2, 0, `Scene: ${foundry.utils.escapeHTML(mut.scene)}`);
      }

      await ChatMessage.create({
        content: `<p>${lines.join("<br/>")}</p>`,
        whisper: gmIds,
        speaker: { alias: "Bad Eden Radiation" }
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
